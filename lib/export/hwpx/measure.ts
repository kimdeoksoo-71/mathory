/**
 * Phase 71 [브라우저] — KaTeX로 수식을 실제로 조판해 한글 수식 상자 크기를 잰다(eqSize.ts 머리 주석 — 한글은 열 때 다시 재지 않는다).
 *
 * 폭 = `.katex-html` 너비 / `.katex` 글자 크기 · 위·아래 = 각 `.base > .strut`의 `height`·`vertical-align`(KaTeX가 em으로 적는다).
 * ⚠ 앱의 `katexMacros`(분수 vphantom)는 쓰지 않는다 — 한글 수식엔 그 여백이 없다. 인라인도 `\displaystyle`(덕수 원칙 — 한글 분수도 제 크기).
 * ⚠ KaTeX 글꼴이 늦게 오면 폭이 대체 글꼴로 재진다 → 쓰는 글꼴을 먼저 `document.fonts.load`로 받는다.
 * run.ts가 동적 import한다(진입 번들 보호).
 */
import katex from 'katex';
import { sizeFromEm, type EqSize } from './eqSize';

const FONTS = ['KaTeX_Main', 'KaTeX_Math', 'KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4', 'KaTeX_AMS'];

export interface KatexMeasurer {
  measure: (latex: string) => EqSize | null;
  dispose: () => void;
}

export async function createKatexMeasurer(): Promise<KatexMeasurer> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;font-size:100px;white-space:nowrap;line-height:normal;';
  document.body.appendChild(host);
  try {
    await Promise.all(FONTS.flatMap((f) => [`100px ${f}`, `italic 100px ${f}`].map((spec) => document.fonts.load(spec, 'x1+()').catch(() => []))));
    await document.fonts.ready;
  } catch { /* 글꼴 API가 없으면 그대로 잰다 */ }

  const cache = new Map<string, EqSize | null>();
  const measure = (latex: string): EqSize | null => {
    const hit = cache.get(latex);
    if (hit !== undefined) return hit;
    let out: EqSize | null = null;
    try {
      host.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: false, strict: 'ignore' });
      const k = host.querySelector('.katex') as HTMLElement | null;
      const html = host.querySelector('.katex-html') as HTMLElement | null;
      if (k && html && !host.querySelector('.katex-error')) {
        const fs = parseFloat(getComputedStyle(k).fontSize) || 100;
        const width = html.getBoundingClientRect().width / fs;
        let asc = 0;
        let desc = 0;
        html.querySelectorAll(':scope > .base > .strut').forEach((el) => {
          const st = (el as HTMLElement).style;
          const h = parseFloat(st.height) || 0;
          const d = -(parseFloat(st.verticalAlign) || 0);
          asc = Math.max(asc, h - d);
          desc = Math.max(desc, d);
        });
        if (width > 0) out = sizeFromEm(width, asc, desc);
      }
    } catch { out = null; }
    cache.set(latex, out);
    return out;
  };
  return { measure, dispose: () => host.remove() };
}
