'use client';

/**
 * Phase 25 — Unified Toolbar
 *
 * 컨텍스트 가시화(수식 안/밖) + 단일 진입점.
 * Step 2 (현재): 골격 + 기존 MathToolbar 분류 풀다운을 수식 안 상태에서만 노출.
 * Step 3 이후: MathToolbar 의존 제거 → 커스터마이징 가능한 그룹 시스템으로 교체.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MathSnippet } from '../../types/snippet';
import MathSymbolPalette from './MathSymbolPalette';
import MathSnippetMenu from './MathSnippetMenu';
import { IconLoader, PhIcon } from '../ui/Icons';
import { PH } from '../ui/phosphorPaths';
import { ICON_SIZE, SVG_PROPS } from './toolbarIcons';

// ═══════════════════════════════════════════════
// Row 2 아이콘 — Phosphor regular · ICON_SIZE 20 (M4 · Final_V4 §3-1).
// 규격은 toolbarIcons.tsx가 소유(SigmaIcon과 공유 — 순환 import 회피).
// 브라켓(CORNER_BRACKETS)은 M4에서 폐기 — 켜짐 프레임은 IconButton의 active 테두리 하나다.
// ═══════════════════════════════════════════════

function InlineMathIcon() {
  return <PhIcon d={PH.dollarSimple} size={ICON_SIZE} />;
}

/** 블록 수식 $$ — currency-dollar-simple을 x 0.62배로 눌러 좌·우 배치 (D7 · Final_V4 §4-3).
 *  비등방 scale은 fill path의 세로 획을 가늘게 한다(20px에서 1.25→0.78px) — 흐리면
 *  대안은 0.8배 등방 축소+겹침(Q5, 컨택트시트 판정).
 *  좌표: path x 56~200(폭 144) → 0.62배 폭 89.3 · 간격 12 → tx −2 / 99. */
function BlockMathIcon() {
  return (
    <svg {...SVG_PROPS}>
      <g transform="translate(-2 0) scale(0.62 1)"><path d={PH.dollarSimple} /></g>
      <g transform="translate(99 0) scale(0.62 1)"><path d={PH.dollarSimple} /></g>
    </svg>
  );
}

function SearchReplaceIcon() {
  return <PhIcon d={PH.magnifyingGlass} size={ICON_SIZE} />;
}

function SnippetIcon() {
  return <PhIcon d={PH.bracketsCurly} size={ICON_SIZE} />;
}

/** 수식 읽기(OCR) — scan (D9). CommentEditor도 이 컴포넌트를 import한다(사본 금지). */
export function OcrIcon({ size = ICON_SIZE }: { size?: number }) {
  return <PhIcon d={PH.scan} size={size} />;
}

function ProofreadIcon() {
  return <PhIcon d={PH.listChecks} size={ICON_SIZE} />;
}

function SpecialCharIcon() {
  return <PhIcon d={PH.numberCircleOne} size={ICON_SIZE} />;
}

function TableAddIcon() {
  return <PhIcon d={PH.table} size={ICON_SIZE} />;
}

/** 전체 접기/펼치기 토글 — collapsed=true면 펼치기(바깥쪽), false면 접기(안쪽) (D10) */
function CollapseAllIcon({ collapsed }: { collapsed: boolean }) {
  return <PhIcon d={collapsed ? PH.collapseOut : PH.collapseIn} size={ICON_SIZE} />;
}

/** 강조(핵심문장) — highlighter */
function KeySentenceIcon() {
  return <PhIcon d={PH.highlighter} size={ICON_SIZE} />;
}

function AiMathGenIcon() {
  return <PhIcon d={PH.sparkle} size={ICON_SIZE} />;
}

// ═══════════════════════════════════════════════
// 특수문자 그룹 (원문자 등) — Step 5에서 사용자 커스터마이징 지원 예정
// ═══════════════════════════════════════════════

interface SpecialCharGroup {
  name: string;
  items: { char: string; title: string }[];
}

const SPECIAL_CHAR_GROUPS: SpecialCharGroup[] = [
  {
    name: '원문자',
    items: [
      { char: '①', title: '원문자 1' },
      { char: '②', title: '원문자 2' },
      { char: '③', title: '원문자 3' },
      { char: '④', title: '원문자 4' },
      { char: '⑤', title: '원문자 5' },
    ],
  },
  {
    name: '검정원문자',
    items: [
      { char: '❶', title: '검정 1' },
      { char: '❷', title: '검정 2' },
      { char: '❸', title: '검정 3' },
      { char: '❹', title: '검정 4' },
      { char: '❺', title: '검정 5' },
    ],
  },
  {
    name: '한글원문자',
    items: [
      { char: '㉠', title: '한글 ㄱ' },
      { char: '㉡', title: '한글 ㄴ' },
      { char: '㉢', title: '한글 ㄷ' },
      { char: '㉣', title: '한글 ㄹ' },
      { char: '㉤', title: '한글 ㅁ' },
      { char: '㉥', title: '한글 ㅂ' },
      { char: '㉦', title: '한글 ㅅ' },
      { char: '㉧', title: '한글 ㅇ' },
    ],
  },
];

// ═══════════════════════════════════════════════
// Props & 공통 스타일
// ═══════════════════════════════════════════════

interface UnifiedToolbarProps {
  cursorInMath: boolean;
  showToolbar: boolean;
  onInsert: (template: string, cursorOffset: number) => void;
  snippets: MathSnippet[];
  onSnippetInsert: (content: string) => void;
  onSnippetAdd: (data: { name: string; shortcutIndex: number; content: string }) => void;
  onSnippetEdit: (snippetId: string, data: Partial<{ name: string; shortcutIndex: number; content: string }>) => void;
  onSnippetDelete: (snippetId: string) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  proofreading: boolean;
  onRunProofread: () => void;
  ocrLoading: boolean;
  onOcrClick: () => void;
  // 블록 영역 — AI 완성은 맞춤법 검사 우측, 전체 접기 토글은 신설
  onAIComplete: () => void;
  aiLoading: boolean;
  collapseMode: boolean;
  onToggleCollapseAll: () => void;
  /** Phase 58 P3 — 선택 영역을 `**…**`로 감싸기/해제 */
  onToggleKey: () => void;
  /** 직전 토글이 규칙 위반으로 거부됐는가 (버튼 흔들림 피드백) */
  keyToggleRejected: boolean;
}

/** D18 — active 배경: 구글 파랑 하드코딩을 accent 틴트로. 브라켓이 사라져 active 프레임이
 *  유일한 사각이 되므로 색이 그대로 드러난다. color-mix 미지원 브라우저만 리터럴 폴백
 *  (= --accent-primary #c96442의 8%). */
const ACTIVE_BG =
  typeof CSS !== 'undefined' && CSS.supports?.('color', 'color-mix(in srgb, red 8%, transparent)')
    ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)'
    : 'rgba(201, 100, 66, 0.08)';

const ICON_BTN_BASE: React.CSSProperties = {
  width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid transparent',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'all 0.15s',
  padding: 0,
};

const TOOLTIP_DELAY_MS = 600;

function IconButton({
  title, onClick, active, disabled, children, buttonRef,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerBtnRef = useRef<HTMLButtonElement | null>(null);

  // 외부 buttonRef와 내부 ref 동시 할당
  const setBtnRef = (el: HTMLButtonElement | null) => {
    innerBtnRef.current = el;
    if (typeof buttonRef === 'function') buttonRef(el);
    else if (buttonRef) (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  };

  const showTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const el = innerBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTipPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    }, TOOLTIP_DELAY_MS);
  };
  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTipPos(null);
  };

  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  return (
    <>
      <button
        ref={setBtnRef}
        onClick={() => { hideTip(); onClick(); }}
        disabled={disabled}
        aria-label={title}
        style={{
          ...ICON_BTN_BASE,
          border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
          background: active ? ACTIVE_BG : 'transparent',
          color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'wait' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!active && !disabled) e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)';
          showTip();
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
          hideTip();
        }}
        onFocus={showTip}
        onBlur={hideTip}
      >
        {children}
      </button>
      {tipPos && (
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            background: 'rgba(33, 33, 33, 0.92)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'var(--font-ui, sans-serif)',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {title}
        </span>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// 특수문자 풀다운
// ═══════════════════════════════════════════════

function SpecialCharDropdown({ onInsert }: { onInsert: (template: string, cursorOffset: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton title="특수문자" onClick={() => setOpen((v) => !v)} active={open}>
        <SpecialCharIcon />
      </IconButton>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            padding: 8,
            minWidth: 200,
          }}
        >
          {SPECIAL_CHAR_GROUPS.map((group, gi) => (
            <div key={group.name} style={{ marginTop: gi > 0 ? 8 : 0 }}>
              <div
                style={{
                  padding: '0 2px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#999',
                  letterSpacing: 0.5,
                  fontFamily: 'var(--font-ui, sans-serif)',
                }}
              >
                {group.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
                {group.items.map((it) => (
                  <button
                    key={it.char}
                    title={it.title}
                    onClick={() => {
                      onInsert(it.char, it.char.length);
                      setOpen(false);
                    }}
                    style={{
                      padding: '6px',
                      fontSize: 16,
                      backgroundColor: '#fff',
                      border: '1px solid #eee',
                      borderRadius: 4,
                      cursor: 'pointer',
                      lineHeight: 1,
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                  >
                    {it.char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 표 삽입 다이얼로그
// ═══════════════════════════════════════════════

function TableInsertDialog({
  open, onClose, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: number, cols: number) => void;
}) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    if (open) {
      setRows(3);
      setCols(3);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const r = Math.max(1, Math.min(50, Math.floor(rows)));
    const c = Math.max(1, Math.min(20, Math.floor(cols)));
    onConfirm(r, c);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          padding: '20px 24px',
          minWidth: 260,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          표 삽입
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ width: 28 }}>행</span>
            <input
              type="number" min={1} max={50}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value) || 1)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              autoFocus
              style={{
                width: 64, padding: '4px 8px', fontSize: 13,
                border: '1px solid var(--border-light)', borderRadius: 4,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ width: 28 }}>열</span>
            <input
              type="number" min={1} max={20}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value) || 1)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              style={{
                width: 64, padding: '4px 8px', fontSize: 13,
                border: '1px solid var(--border-light)', borderRadius: 4,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: 13,
              border: '1px solid var(--border-light)', background: '#fff',
              borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              color: 'var(--text-primary)',
            }}
          >취소</button>
          <button
            onClick={submit}
            style={{
              padding: '6px 14px', fontSize: 13,
              border: '1px solid var(--accent-primary)',
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              fontWeight: 600,
            }}
          >확인</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 행 r, 열 c의 가운데 정렬 markdown 표 문자열 생성.
 * 1행은 헤더(빈 셀), 2행은 정렬 구분자(`:---:`), 이후 r-1개의 빈 본문 행.
 */
function buildMarkdownTable(r: number, c: number): string {
  const empty = '|' + Array(c).fill('   ').join(' | ') + ' |';
  const align = '|' + Array(c).fill(':---:').join(' | ') + ' |';
  const bodyRows = Math.max(0, r - 1);
  const body = bodyRows > 0 ? Array(bodyRows).fill(empty).join('\n') + '\n' : '';
  // GFM 표는 앞뒤에 blank line 필요 → 양쪽에 \n\n 보장
  return `\n\n${empty}\n${align}\n${body}\n`;
}

// ═══════════════════════════════════════════════
// OverflowItems — 가용 폭 부족 시 우측 끝부터 display:none
// ═══════════════════════════════════════════════

function OverflowItems({
  items, leftWidth, rootRef,
}: {
  items: { key: string; node: React.ReactNode }[];
  leftWidth: number;
  rootRef: React.RefObject<HTMLDivElement>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cachedWidthsRef = useRef<number[]>([]);
  const [hideCount, setHideCount] = useState(0);

  // children 폭 캐싱 (모두 보일 때 한 번)
  useLayoutEffect(() => {
    if (cachedWidthsRef.current.length === items.length) return;
    const widths = itemRefs.current.map((r) => r?.offsetWidth || 0);
    if (widths.every((w) => w > 0)) {
      cachedWidthsRef.current = widths;
    }
  });

  // root 폭 변화 + leftWidth 변화 시 hideCount 재계산
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;

    const recalc = () => {
      const widths = cachedWidthsRef.current;
      if (widths.length === 0) return;
      const rootW = root.clientWidth;
      const gap = 4;
      const padding = 16; // 여유 + 가운데 구분선
      const available = rootW - leftWidth - padding;
      let total = widths.reduce((a, b) => a + b + gap, -gap);
      let hide = 0;
      while (total > available && hide < widths.length) {
        total -= widths[widths.length - 1 - hide] + gap;
        hide++;
      }
      setHideCount(hide);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(root);
    return () => ro.disconnect();
  }, [leftWidth, rootRef, items.length]);

  const visibleEnd = items.length - hideCount;

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      {items.map((it, i) => (
        <div
          key={it.key}
          ref={(el) => { itemRefs.current[i] = el; }}
          style={{ display: i < visibleEnd ? 'flex' : 'none', alignItems: 'center' }}
        >
          {it.node}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 메인
// ═══════════════════════════════════════════════

export default function UnifiedToolbar({
  cursorInMath,
  showToolbar,
  onInsert,
  snippets,
  onSnippetInsert,
  onSnippetAdd,
  onSnippetEdit,
  onSnippetDelete,
  searchOpen,
  onToggleSearch,
  proofreading,
  onRunProofread,
  ocrLoading,
  onOcrClick,
  onAIComplete,
  aiLoading,
  collapseMode,
  onToggleCollapseAll,
  onToggleKey,
  keyToggleRejected,
}: UnifiedToolbarProps) {
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);
  const snippetBtnRef = useRef<HTMLButtonElement>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  const insertInlineMath = () => onInsert('$$', 1);
  const insertBlockMath = () => onInsert('$$\n\n$$', 3);

  const insertTable = (rows: number, cols: number) => {
    const md = buildMarkdownTable(rows, cols);
    onInsert(md, md.length);
    setTableDialogOpen(false);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(0);

  // 좌측 폭 측정 — cursorInMath / MathToolbar 펼침 등 변화 모두 감지
  useLayoutEffect(() => {
    if (!leftRef.current) return;
    const el = leftRef.current;
    const update = () => setLeftWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cursorInMath]);

  // 우측 도구 — 좌→우 순서. 끝부터 우선 hide.
  const divider = (key: string) => (
    <div key={key} style={{ width: 1, height: 20, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
  );

  const rightItems: { key: string; node: React.ReactNode }[] = [
    {
      /* Phase 58 P3 — 강조 토글(구 '핵심문장'). rightItems는 폭이 좁아지면 끝부터
         hide되므로 맨 앞에 둬야 좁은 화면에서 살아남는다.
         ⚠ Phase 59a에서 이름만 '강조'로 바꿨다 — 내부 식별자(KeySentenceIcon·
           keyToggle*)는 그대로 두었으니 이름으로 검색할 때 주의. */
      key: 'keysent',
      node: (
        <IconButton
          title={keyToggleRejected ? '감쌀 수 없는 선택입니다 (문단·수식 경계 확인)' : '강조 (**…**)'}
          onClick={onToggleKey}
        >
          {/* ⚠ display:flex 필수 — 인라인 span이면 내부 svg가 baseline 정렬을 받아
              다른 아이콘 11종보다 몇 px 아래로 내려앉는다. 흔들림 애니메이션 때문에
              래퍼가 필요한 것뿐이므로 정렬은 button과 동일하게 맞춘다. */}
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...(keyToggleRejected ? { animation: 'keyShake 0.35s' } : null),
          }}>
            <KeySentenceIcon />
          </span>
        </IconButton>
      ),
    },
    {
      key: 'snippet',
      node: (
        <>
          <IconButton
            title="상용구"
            onClick={() => setSnippetMenuOpen((v) => !v)}
            active={snippetMenuOpen}
            buttonRef={snippetBtnRef}
          >
            <SnippetIcon />
          </IconButton>
          {snippetMenuOpen && (
            <MathSnippetMenu
              snippets={snippets}
              onInsert={onSnippetInsert}
              onAdd={onSnippetAdd}
              onEdit={onSnippetEdit}
              onDelete={onSnippetDelete}
              anchorRef={snippetBtnRef}
              onClose={() => setSnippetMenuOpen(false)}
            />
          )}
        </>
      ),
    },
    { key: 'special', node: <SpecialCharDropdown onInsert={onInsert} /> },
    {
      key: 'table',
      node: (
        <IconButton title="표 삽입" onClick={() => setTableDialogOpen(true)}>
          <TableAddIcon />
        </IconButton>
      ),
    },
    { key: 'd1', node: divider('d1') },
    {
      key: 'proofread',
      node: (
        <IconButton title="맞춤법 검사 (현재 탭)" onClick={onRunProofread} disabled={proofreading}>
          {proofreading ? <IconLoader size={14} /> : <ProofreadIcon />}
        </IconButton>
      ),
    },
    {
      key: 'ai',
      node: (
        <IconButton title="AI 완성 (⌘J)" onClick={onAIComplete} disabled={aiLoading}>
          {aiLoading ? <IconLoader size={14} /> : <AiMathGenIcon />}
        </IconButton>
      ),
    },
    {
      key: 'search',
      node: (
        <IconButton title="찾기 / 바꾸기 (Ctrl+F)" onClick={onToggleSearch} active={searchOpen}>
          <SearchReplaceIcon />
        </IconButton>
      ),
    },
    { key: 'd2', node: divider('d2') },
    {
      key: 'collapseAll',
      node: (
        <IconButton
          title={collapseMode ? '전체 펼치기' : '전체 접기'}
          onClick={onToggleCollapseAll}
          active={collapseMode}
        >
          <CollapseAllIcon collapsed={collapseMode} />
        </IconButton>
      ),
    },
  ];

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        opacity: showToolbar ? 1 : 0.35,
        pointerEvents: showToolbar ? 'auto' : 'none',
        transition: 'opacity 0.15s',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* ── 좌측: 컨텍스트 영역 (항상 보임, 자기 폭 유지) ── */}
      <div ref={leftRef} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {cursorInMath ? (
          <>
            {/* Phase 40: 수식 기호 팔레트 (단일 패널 + 탭 + KaTeX 하이브리드 렌더) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
              <MathSymbolPalette onInsert={onInsert} />
            </div>
          </>
        ) : (
          <>
            <IconButton title="인라인 수식 ($…$)" onClick={insertInlineMath}>
              <InlineMathIcon />
            </IconButton>
            <IconButton title="블록 수식 ($$…$$)" onClick={insertBlockMath}>
              <BlockMathIcon />
            </IconButton>
            {/* M3 A3 — 표 삽입 뒤에 있던 OCR을 컨텍스트 영역으로. 커서가 수식 안이면
                인라인·블록 수식과 함께 사라지고 팔레트가 그 자리에 온다(덕수 메모 그대로).
                수식 안에서 OCR 접근 불가는 수용된 사양(D5). ocrLoading 중 스왑돼도
                진행은 계속된다 — 결과 삽입은 커서 위치 기준. */}
            <IconButton title="수식 읽기" onClick={onOcrClick} disabled={ocrLoading}>
              {ocrLoading ? <IconLoader size={14} /> : <OcrIcon />}
            </IconButton>
          </>
        )}
        {/* 가운데 구분선 */}
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
      </div>

      {/* ── 우측: overflow 처리 (전체 접기 토글 포함) ── */}
      <OverflowItems items={rightItems} leftWidth={leftWidth} rootRef={rootRef} />

      {/* 표 삽입 다이얼로그 (fixed overlay) */}
      <TableInsertDialog
        open={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        onConfirm={insertTable}
      />
    </div>
  );
}
