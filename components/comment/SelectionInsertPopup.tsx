'use client';

/**
 * Phase 61c — agent 대화 선택 영역 → 편집창 삽입 / 마크다운 복사
 *
 * 대화창(메시지 본문·검증 리포트 카드)에서 드래그하면 선택 근처에 미니 팝업이 뜬다.
 * 선택 영역을 **Mathory 표기 규약의 마크다운으로 직렬화**해서 넘긴다.
 *
 * 이 파일은 **DOM 어댑터**다 — 규칙 자체는 `lib/chatExtract.ts`가 소유한다.
 * ⚠️ `tests/chatExtract.test.mjs`의 hast→미니트리 변환기와 **같은 규칙 한 벌**이어야 한다.
 *    저쪽은 왕복 테스트가 지키지만 **이쪽(Range 절단·closest 판정·스킵)은 테스트가 닿지 않는다**
 *    — 실물 대화 검수로만 확인된다(계획서 v4 §4.6).
 *
 * ⚠️ `selection.toString()`을 쓰지 말 것 — 우리는 평문이 아니라 마크다운이 필요하다
 *    (마커·강조·수식 복원이 전부 죽는다).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildRenderedMathIndex, stripPreviewArtifacts, serializeNodes,
} from '../../lib/chatExtract';
import type { SNode } from '../../lib/chatExtract';

interface Props {
  /** 메시지 리스트 스크롤 컨테이너 — 스크롤하면 팝업을 접는다 */
  scrollRef: React.RefObject<HTMLDivElement>;
  /** 댓글 id → 렌더에 쓰인 마크다운 소스(검증 리포트면 펜스를 뺀 body) */
  getSource: (commentId: string) => string | null;
  /** **편집 화면에서만 전달** — 없으면 [편집창에 삽입] 버튼이 뜨지 않는다.
   *  (`onInsertGraphBlock` 선례. 팝업 자체는 열람뷰에도 마운트돼 [복사]가 산다) */
  onInsertToEditor?: (text: string) => 'inserted' | 'no-target';
}

const HOST_SEL = '.katex, .katex-error';
const POPUP_W = 190;
const POPUP_H = 34;

/* ═══ DOM 헬퍼 ═══ */

function asElement(n: Node | null): HTMLElement | null {
  if (!n) return null;
  return (n.nodeType === 1 ? (n as HTMLElement) : n.parentElement) || null;
}

/** range가 node를 통째로 품는가.
 *  ⚠ `Range`에는 `containsNode`가 없다 — 그건 `Selection`의 메서드다.
 *  `comparePoint(node, offset)`: 그 점이 range보다 앞이면 -1, 안이면 0, 뒤면 1. */
function rangeContainsNode(range: Range, node: Node): boolean {
  try {
    return range.comparePoint(node, 0) >= 0
        && range.comparePoint(node, node.childNodes.length) <= 0;
  } catch {
    return false;
  }
}

/** 선택 양끝이 수식 안에 걸리면 그 수식 전체를 포함하도록 넓힌다(D6). 원본 Range는 건드리지 않는다 */
function expandToMathHosts(range: Range): Range {
  const r = range.cloneRange();
  const startHost = asElement(r.startContainer)?.closest(HOST_SEL);
  if (startHost) r.setStartBefore(startHost);
  const endHost = asElement(r.endContainer)?.closest(HOST_SEL);
  if (endHost) r.setEndAfter(endHost);
  return r;
}

/** 선택이 **하나의** 댓글 본문 안에 있는가(D4). 아니면 null */
function singleCommentBody(range: Range): HTMLElement | null {
  const start = asElement(range.startContainer)?.closest('.comment-body') as HTMLElement | null;
  const end = asElement(range.endContainer)?.closest('.comment-body') as HTMLElement | null;
  if (!start || !end || start !== end) return null;
  return start;
}

/* ═══ 수식 복원 ═══ */

interface MathInfo { latex: string; display: boolean }

/**
 * 그 댓글의 수식 호스트 → 복원된 latex(구분자 포함).
 *
 * ⚠️ 호스트는 `.katex`(성공)와 **`.katex-error`(파싱 실패)를 함께** 센다 — 실패한 수식도
 *    소스 인덱스를 한 칸 소비하기 때문이다. `.katex`만 세면 에러 하나에 순번이 통째로 밀린다.
 * ⚠️ 그래서 `data-math-id`를 쓰지 않는다 — `EditorPreview`의 부여 effect는 `.katex`만 훑는다
 *    (그 속성은 Phase 56이 쓰는 것이니 지우지는 말 것).
 */
function buildMathMap(body: HTMLElement, source: string | null): Map<Element, MathInfo> {
  const map = new Map<Element, MathInfo>();
  const preview = body.querySelector('.preview-content');
  const previewHosts = preview ? Array.from(preview.querySelectorAll(HOST_SEL)) : [];
  const index = source ? buildRenderedMathIndex(source) : [];
  const sliceable = !!source && previewHosts.length === index.length;

  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production' && !sliceable && source) {
    console.debug(
      `[Phase61c] 수식 개수 게이트 실패 — 원본 슬라이스 대신 annotation 폴백 ` +
      `(호스트 ${previewHosts.length} / 인덱스 ${index.length})`,
    );
  }

  previewHosts.forEach((el, i) => {
    if (sliceable) {
      const latex = index[i].latex;
      map.set(el, { latex, display: /^(\$\$|\\\[)/.test(latex) && latex.indexOf('\n') !== -1 });
    } else {
      map.set(el, fallbackMath(el, true));
    }
  });

  /* 검증 리포트 카드 안의 수식 — 소스가 없다(카드는 마크다운이 아니라 구조화 데이터를 그린다).
     대신 그쪽 annotation은 **전처리를 안 거친 원본 latex**이고 전부 인라인으로 그려진다. */
  Array.from(body.querySelectorAll(HOST_SEL)).forEach((el) => {
    if (!map.has(el)) map.set(el, fallbackMath(el, false));
  });

  return map;
}

function fallbackMath(el: Element, inPreview: boolean): MathInfo {
  const isErr = el.classList.contains('katex-error');
  const raw = isErr
    ? (el.textContent || '')
    : (el.querySelector('annotation')?.textContent || '');
  const tex = stripPreviewArtifacts(raw);
  if (!tex) return { latex: '', display: false };
  /* 에러 span에는 조상 단서가 없다(rehype-katex가 `.math-display` 요소를 splice로 지운다)
     → 개행 유무가 유일하게 남은 신호다. 카드 안은 언제나 인라인. */
  const display = inPreview && (isErr ? tex.indexOf('\n') !== -1 : !!el.closest('.katex-display'));
  return { latex: display ? `$$\n${tex}\n$$` : `$${tex}$`, display };
}

/* ═══ DOM → 미니 트리 ═══ */

const ATTR_KEYS = ['href', 'src', 'alt', 'start'];

function toSNodes(range: Range, root: Node, math: Map<Element, MathInfo>): SNode[] {
  const conv = (node: Node): SNode | null => {
    if (node.nodeType === 3) {
      const full = node.nodeValue || '';
      let text = full;
      if (node === range.startContainer && node === range.endContainer) {
        text = full.slice(range.startOffset, range.endOffset);
      } else if (node === range.startContainer) {
        text = full.slice(range.startOffset);
      } else if (node === range.endContainer) {
        text = full.slice(0, range.endOffset);
      } else if (!range.intersectsNode(node)) {
        return null;
      }
      if (!text) return null;
      return { tag: null, cls: [], text, children: [] };
    }
    if (node.nodeType !== 1) return null;
    const el = node as HTMLElement;
    if (!range.intersectsNode(el)) return null;

    const attrs: Record<string, string> = {};
    for (const k of ATTR_KEYS) {
      const v = el.getAttribute(k);
      if (v !== null) attrs[k] = v;
    }
    const info = math.get(el);
    const out: SNode = {
      tag: el.tagName.toLowerCase(),
      cls: Array.from(el.classList),
      text: null,
      attrs,
      /* 수식 호스트의 서브트리는 들어가지 않는다 — `.katex-mathml`과 `.katex-html`이
         같은 내용을 두 벌 담고 있어 그대로 훑으면 수식이 두 번 나온다 */
      children: info ? [] : Array.from(el.childNodes).map(conv).filter(Boolean) as SNode[],
      math: info || null,
    };
    if (out.tag === 'table') out.complete = rangeContainsNode(range, el);
    return out;
  };
  const r = conv(root);
  return r ? [r] : [];
}

/** 선택 → Mathory 마크다운. 빈 결과면 null */
export function serializeSelection(
  range: Range,
  getSource: (commentId: string) => string | null,
): string | null {
  const body = singleCommentBody(range);
  if (!body) return null;
  const expanded = expandToMathHosts(range);
  const id = body.getAttribute('data-comment-id');
  const source = id ? getSource(id) : null;
  const math = buildMathMap(body, source);
  const out = serializeNodes(toSNodes(expanded, body, math));
  return out || null;
}

/* ═══ 컴포넌트 ═══ */

interface Anchor { left: number; top: number; range: Range }

export default function SelectionInsertPopup({ scrollRef, getSource, onInsertToEditor }: Props) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => { setAnchor(null); setNotice(null); }, []);

  const evaluate = useCallback(() => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hide(); return; }
    const range = sel.getRangeAt(0);
    if (!range.toString().trim()) { hide(); return; }
    if (!singleCommentBody(range)) { hide(); return; }

    const rects = range.getClientRects();
    const last = rects.length ? rects[rects.length - 1] : null;
    if (!last) { hide(); return; }

    /* ⚠ scrollIntoView 금지(CLAUDE.md) — 좌표는 rect 계산으로만 */
    const left = Math.max(8, Math.min(last.right - POPUP_W / 2, window.innerWidth - POPUP_W - 8));
    const below = last.bottom + 6;
    const top = below + POPUP_H > window.innerHeight - 8 ? Math.max(8, last.top - POPUP_H - 6) : below;
    setNotice(null);
    setAnchor({ left, top, range: range.cloneRange() });   // D10′: 스냅샷으로 직렬화한다
  }, [hide]);

  useEffect(() => {
    const onSelectionChange = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => { rafRef.current = null; evaluate(); });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerup', onSelectionChange);
    window.addEventListener('resize', hide);
    const scroller = scrollRef.current;
    scroller?.addEventListener('scroll', hide);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('pointerup', onSelectionChange);
      window.removeEventListener('resize', hide);
      scroller?.removeEventListener('scroll', hide);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [evaluate, hide, scrollRef]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const flashFor = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2000);
  };

  const handleInsert = () => {
    if (!anchor || !onInsertToEditor) return;
    const text = serializeSelection(anchor.range, getSource);
    if (!text) { setNotice('넣을 내용을 찾지 못했습니다'); return; }
    const result = onInsertToEditor(text);
    if (result === 'no-target') { setNotice('텍스트 블록을 먼저 선택하세요'); return; }
    flashFor('삽입됨');
    window.getSelection()?.removeAllRanges();
    setAnchor(null);
  };

  const handleCopy = async () => {
    if (!anchor) return;
    const text = serializeSelection(anchor.range, getSource);
    if (!text) { setNotice('복사할 내용을 찾지 못했습니다'); return; }
    try {
      await navigator.clipboard.writeText(text);
      flashFor('복사됨');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setNotice('복사에 실패했습니다');
    }
  };

  if (!anchor) return null;

  return (
    <div
      style={{
        position: 'fixed', left: anchor.left, top: anchor.top, zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', borderRadius: 6,
        border: '1px solid var(--border-primary)', background: 'var(--bg-card)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 11.5, fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
      }}
      /* 팝업 안에서의 mousedown이 선택을 지우지 않게 한다 */
      onMouseDown={(e) => e.preventDefault()}
    >
      {notice ? (
        <span style={{ color: 'var(--text-muted)' }}>{notice}</span>
      ) : flash ? (
        <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{flash}</span>
      ) : (
        <>
          {onInsertToEditor && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsert}
              style={{
                border: 'none', background: 'var(--accent-primary)', color: '#fff',
                borderRadius: 4, padding: '3px 9px', fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
              }}
            >
              편집창에 삽입
            </button>
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopy}
            style={{
              border: '1px solid var(--border-primary)', background: 'transparent',
              borderRadius: 4, padding: '3px 9px', fontSize: 11, cursor: 'pointer',
              color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
            }}
          >
            복사
          </button>
        </>
      )}
    </div>
  );
}
