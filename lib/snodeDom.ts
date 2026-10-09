/**
 * DOM → 61c 미니 트리(`SNode`) 어댑터. **브라우저 전용**(Range·DOMParser·Element) — 규칙(직렬화)은 `lib/chatExtract.ts`가 소유한다.
 *
 * 소비처 둘이 **한 벌**을 쓴다(Phase 68c F5·H6 — 같은 "외부 렌더 → Mathory 표기" 규칙이 두 벌이면 한쪽만 고쳐진다):
 *   ① 61c 대화 선택 삽입 — `components/comment/SelectionInsertPopup.tsx`(`fallbackMath`·`toSNodes`·`HOST_SEL`, Range 절단)
 *   ② 68c 붙여넣기 — `lib/math-editor-extensions.ts` `createMathPaste()`(`htmlToSNodes` — 클립보드 HTML 문서 전체)
 *
 * ⚠ 61c 왕복 테스트(`tests/chatExtract.test.mjs`)는 hast→미니트리로 들어가므로 **이 파일에 닿지 않는다** — 이쪽은 CDP·실물 검수가 지킨다.
 * ⚠ 수식 호스트는 SNode `cls: ['katex']`로 정규화해 넘긴다 — 직렬화기는 `has('katex')`로 호스트를 알아본다(61c 무수정).
 */
import { stripPreviewArtifacts } from './chatExtract';
import type { SNode } from './chatExtract';

export const HOST_SEL = '.katex, .katex-error';

export interface MathInfo { latex: string; display: boolean }

/** range가 node를 통째로 품는가. ⚠ `Range`에는 `containsNode`가 없다 — 그건 `Selection`의 메서드다 */
function rangeContainsNode(range: Range, node: Node): boolean {
  try {
    return range.comparePoint(node, 0) >= 0
        && range.comparePoint(node, node.childNodes.length) <= 0;
  } catch {
    return false;
  }
}

/** KaTeX 호스트(`.katex`·`.katex-error`) → 구분자 포함 latex. annotation은 **전처리된 TeX**라 `stripPreviewArtifacts`로 흔적을 걷는다(61c) */
export function fallbackMath(el: Element, inPreview: boolean): MathInfo {
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

const ATTR_KEYS = ['href', 'src', 'alt', 'start'];

/** DOM → 미니 트리. `range`가 있으면 그 범위로 텍스트를 자른다(61c 선택), 없으면 전부(표는 `complete`) */
export function toSNodes(root: Node, math: Map<Element, MathInfo>, range?: Range): SNode[] {
  const conv = (node: Node): SNode | null => {
    if (node.nodeType === 3) {
      const full = node.nodeValue || '';
      let text = full;
      if (range) {
        if (node === range.startContainer && node === range.endContainer) {
          text = full.slice(range.startOffset, range.endOffset);
        } else if (node === range.startContainer) {
          text = full.slice(range.startOffset);
        } else if (node === range.endContainer) {
          text = full.slice(0, range.endOffset);
        } else if (!range.intersectsNode(node)) {
          return null;
        }
      }
      if (!text) return null;
      return { tag: null, cls: [], text, children: [] };
    }
    if (node.nodeType !== 1) return null;
    const el = node as HTMLElement;
    if (range && !range.intersectsNode(el)) return null;

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
    if (out.tag === 'table') out.complete = range ? rangeContainsNode(range, el) : true;
    return out;
  };
  const r = conv(root);
  return r ? [r] : [];
}

/* ═══ 68c — 클립보드 HTML 문서 → 미니 트리 ═══ */

/** 외부 렌더러의 수식 호스트. 바깥 것이 이긴다(안쪽 `math`는 호스트 안이라 다시 잡지 않는다) */
const PASTE_HOST_SEL = '.katex, .katex-error, mjx-container, .mwe-math-element, math';
const TEX_ANNOTATION_SEL = 'annotation[encoding="application/x-tex"], annotation[encoding="TeX"], annotation[encoding="application/x-latex"]';
/** 공백뿐인 텍스트 노드를 버리는 블록 컨테이너 — 소스 HTML의 줄바꿈·들여쓰기(68c I1) */
const WS_CONTAINER: Record<string, true> = {
  html: true, body: true, div: true, section: true, article: true, ul: true, ol: true,
  table: true, thead: true, tbody: true, tfoot: true, tr: true, blockquote: true, main: true,
};
/** 붙여넣기에서 통째로 버린다(직렬화기 SKIP과 별개로 — 문서 머리) */
const PASTE_DROP: Record<string, true> = { head: true, meta: true, title: true, link: true, template: true };

/** 위키 annotation의 `{\displaystyle …}` 껍질(68c I2) — `\displaystyle`만 지우면 `{…}`가 남는다 */
function unwrapStyleShell(tex: string): string {
  const m = /^\s*\{\\(?:display|text)style\s+([\s\S]*)\}\s*$/.exec(tex);
  return m ? m[1] : tex;
}

export type BareConverter = (mathEl: Element) => string | null;

/**
 * 붙여넣기 전용. `doc`는 `DOMParser`가 만든 문서.
 * 반환 `bare` = annotation이 없는 `<math>`(P9(b) — `mathml-to-latex` 대상). `convertBare`가 있으면 그것으로 채우고, 없거나 실패하면 `textContent`.
 * `pre`는 61c 직렬화기 SKIP이라 `div`+텍스트로 바꿔 살린다(D8a — 61c 선택 삽입은 종전대로 건너뛴다).
 */
export function htmlToSNodes(doc: Document, convertBare?: BareConverter): { nodes: SNode[]; bare: Element[] } {
  const body = doc.body;
  if (!body) return { nodes: [], bare: [] };
  const math = new Map<Element, MathInfo>();
  const bare: Element[] = [];

  const all = Array.from(body.querySelectorAll(PASTE_HOST_SEL));
  const hosts = all.filter((el) => !el.parentElement || !el.parentElement.closest(PASTE_HOST_SEL));
  for (const el of hosts) {
    if (el.classList.contains('katex') || el.classList.contains('katex-error')) {
      const info = fallbackMath(el, true);
      if (info.latex) { math.set(el, info); continue; }
    }
    const mathEl = el.tagName.toLowerCase() === 'math' ? el : el.querySelector('math');
    const ann = el.querySelector(TEX_ANNOTATION_SEL);
    let tex = ann?.textContent || '';
    if (!tex && el.classList.contains('mwe-math-element')) tex = el.querySelector('img[alt]')?.getAttribute('alt') || '';
    if (!tex && mathEl) {
      bare.push(mathEl);
      tex = (convertBare && convertBare(mathEl)) || mathEl.textContent || '';
    }
    tex = stripPreviewArtifacts(unwrapStyleShell(tex));
    const display = !!el.closest('.katex-display')
      || (!!mathEl && mathEl.getAttribute('display') === 'block')
      || el.getAttribute('display') === 'true'
      || !!el.querySelector('.mwe-math-fallback-image-display');
    math.set(el, tex ? { latex: display ? `$$\n${tex}\n$$` : `$${tex}$`, display } : { latex: '', display: false });
  }

  const conv = (node: Node, parentTag: string): SNode | null => {
    if (node.nodeType === 3) {
      const v = (node.nodeValue || '').replace(/[ \t\n\r\f]+/g, ' ');
      if (!v || (v === ' ' && WS_CONTAINER[parentTag])) return null;
      return { tag: null, cls: [], text: v, children: [] };
    }
    if (node.nodeType !== 1) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (PASTE_DROP[tag]) return null;
    const info = math.get(el);
    if (info) return { tag: 'span', cls: ['katex'], text: null, attrs: {}, children: [], math: info };
    if (el.getAttribute('aria-hidden') === 'true') return null;     // 시각 사본(MathJax 2 등) — 수식은 호스트가 이미 담는다
    if (tag === 'pre') {
      const t = el.textContent || '';
      return { tag: 'div', cls: [], text: null, attrs: {}, children: t ? [{ tag: null, cls: [], text: t.replace(/\n$/, ''), children: [] }] : [] };
    }
    const attrs: Record<string, string> = {};
    for (const k of ATTR_KEYS) {
      const v = el.getAttribute(k);
      if (v !== null) attrs[k] = v;
    }
    const out: SNode = {
      tag,
      cls: Array.from(el.classList),
      text: null,
      attrs,
      children: Array.from(el.childNodes).map((c) => conv(c, tag)).filter(Boolean) as SNode[],
      math: null,
    };
    if (tag === 'table') out.complete = true;
    return out;
  };
  const r = conv(body, 'html');
  return { nodes: r ? [r] : [], bare };
}
