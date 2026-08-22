/**
 * lib/katex-render.ts — KaTeX 렌더 캐시 헬퍼 (팔레트·설정 모달 공용)
 *
 * 하이브리드 전략(계획서 §14): 동일 LaTeX는 세션당 1회만 렌더 후 캐시.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

const cache = new Map<string, string>();

export function renderKatexCached(latex: string): string {
  const hit = cache.get(latex);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    html = '';
  }
  cache.set(latex, html);
  return html;
}

/* ═══ Phase 61b: 텍스트에 섞인 인라인 수식 ═══ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** `$$…$$` 먼저(더 긴 구분자), 그다음 `$…$`. 개행을 넘지 않게 해 미닫힌 `$` 하나가
 *  뒷문장 전체를 삼키는 것을 막는다. */
const INLINE_MATH_RE = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * 검증 리포트의 인용·이유처럼 **짧은 혼합 텍스트**를 HTML로.
 *
 * 왜 `EditorPreview`를 안 쓰는가: 그쪽은 마크다운 문서 렌더러라 `.preview-content`의
 * 글자 크기·문단 여백을 통째로 들여온다. 카드 안의 11~12px 한두 줄에는 과하고,
 * 지적 하나당 3개씩 인스턴스를 만들게 된다.
 *
 * ⚠️ 텍스트 부분은 반드시 이스케이프한다 — 모델 출력이 그대로 innerHTML로 들어간다.
 *    KaTeX 출력은 기본값(`trust: false`)이라 `\href` 같은 것이 무력화되어 있다.
 * ⚠️ 렌더 실패 시 빈 문자열이 아니라 **원문을 그대로** 남긴다. 수식이 조용히 사라지면
 *    "인용이 잘못됐다"로 오해된다.
 */
export function renderInlineMathHtml(
  text: string,
  opts?: { autoMath?: boolean },
): string {
  const src = String(text ?? '');

  /* `$` 구분자가 통째로 빠진 인용 구제 (실측 2026-08-22).
     프롬프트가 "원문 그대로"를 요구해도 모델이 옮겨 적으면서 `$`를 떨어뜨리는 일이 있다.
     - `$`가 하나도 없고
     - TeX 제어열(`\frac`, `\mathrm` 등)이 있으면
     전체를 수식으로 본다. 한국어 산문에는 백슬래시+영문자가 없으므로 오작동하지 않는다.
     ⚠️ 인용(quote)에만 켤 것 — 이유(reason)는 산문이라 통째 수식화하면 안 된다. */
  if (opts?.autoMath && !src.includes('$') && /\\[a-zA-Z]/.test(src)) {
    return renderKatexCached(src.trim()) || escapeHtml(src);
  }

  let out = '';
  let last = 0;
  for (const m of src.matchAll(INLINE_MATH_RE)) {
    const at = m.index ?? 0;
    out += escapeHtml(src.slice(last, at));
    const latex = (m[1] ?? m[2] ?? '').trim();
    out += renderKatexCached(latex) || escapeHtml(m[0]);
    last = at + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

/** 기호 미리보기 HTML: 구조형은 displayLatex, 단일은 latex. */
export function symbolPreviewHtml(sym: { displayLatex?: string; latex: string }): string {
  return renderKatexCached(sym.displayLatex ?? sym.latex);
}
