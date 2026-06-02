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

/** 기호 미리보기 HTML: 구조형은 displayLatex, 단일은 latex. */
export function symbolPreviewHtml(sym: { displayLatex?: string; latex: string }): string {
  return renderKatexCached(sym.displayLatex ?? sym.latex);
}
