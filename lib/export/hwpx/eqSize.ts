/**
 * Phase 71 — 수식 개체 크기(sz)·기준선(baseLine). import 0(추정 함수) — 브라우저 측정은 `createKatexMeasurer`.
 *
 * ⚠ **한글 2022(12.0.0.4426)는 hwpx를 열 때 수식 크기를 다시 재지 않는다**(2026-10-15 덕수 실물: 상자가 위아래·좌우로 크고
 *   수식이 왼쪽 위에 붙는다 — 수식 편집기에 들어갔다 나오면 그때야 맞는다). python-hwpx 6.5.0 문서의 "Hancom re-measures on open"은
 *   이 판에서 틀렸다. 그래서 크기를 **우리가 잰다**: 브라우저는 KaTeX로 실제 조판해 재고, Node(테스트)는 구조 추정을 쓴다.
 *
 * 한글의 수식 상자: 높이 = 위 + 아래, `baseLine` = 위 / 높이 × 100(%). 글자만 있는 수식의 최소 위·아래는
 *   한글 본문 글꼴 높이 — 옛 템플릿 실측 `1` = 525 × 1125 · baseLine 85(baseUnit 1100) → 위 0.87em · 아래 0.153em.
 * 수식이 상자보다 크면 뒤 글자와 겹치고, 작으면 빈칸이 생긴다 → 폭은 2% 넉넉히.
 */

export interface EqSize { w: number; h: number; base: number }

export const EQ_MIN_ASCENT = 0.87;
export const EQ_MIN_DESCENT = 0.153;
const WIDTH_PAD = 1.02;

/** em 단위(위·아래·폭) → 한글 수식 sz */
export function sizeFromEm(widthEm: number, ascentEm: number, descentEm: number, baseUnit = 1100): EqSize {
  const asc = Math.max(EQ_MIN_ASCENT, ascentEm);
  const desc = Math.max(EQ_MIN_DESCENT, descentEm);
  const h = Math.round((asc + desc) * baseUnit);
  return {
    w: Math.max(Math.round(0.3 * baseUnit), Math.round(widthEm * baseUnit * WIDTH_PAD)),
    h,
    base: Math.round((asc / (asc + desc)) * 100),
  };
}

/* ═══ 구조 추정(Node·측정 실패 대비) ═══ */

function group(s: string, i: number): { body: string; end: number } | null {
  let j = i;
  while (j < s.length && s[j] === ' ') j++;
  if (s[j] !== '{') return j < s.length ? { body: s[j], end: j + 1 } : null;
  let d = 0;
  for (let k = j; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (d === 0) return { body: s.slice(j + 1, k), end: k + 1 }; }
  }
  return null;
}

/** LaTeX의 (폭, 위, 아래)(em) 대략값 — 분수·첨자·근호·큰 연산자·행 수만 본다 */
export function estimateEm(latex: string): { w: number; asc: number; desc: number } {
  let s = latex.replace(/\\(displaystyle|textstyle|left|right|big|Big|bigg|Bigg)(?![a-zA-Z])/g, ' ');
  let w = 0;
  let asc = 0.7;
  let desc = 0.05;
  // 행(환경·\\) — 행마다 1.2em
  const rows = s.split(/\\\\/).length;
  if (rows > 1) { asc = 0.6 * rows + 0.2; desc = 0.6 * rows - 0.4; }
  for (let guard = 0; guard < 50; guard++) {
    const m = /\\[dtc]?frac\s*/.exec(s);
    if (!m) break;
    const a = group(s, m.index + m[0].length);
    if (!a) break;
    const b = group(s, a.end);
    if (!b) break;
    const ea = estimateEm(a.body);
    const eb = estimateEm(b.body);
    w += Math.max(ea.w, eb.w) + 0.25;
    asc = Math.max(asc, 0.5 + ea.asc + ea.desc + 0.1);
    desc = Math.max(desc, eb.asc + eb.desc + 0.05);
    s = s.slice(0, m.index) + ' ' + s.slice(b.end);
  }
  for (let guard = 0; guard < 50; guard++) {
    const m = /\\sqrt\s*(\[[^\]]*\])?\s*/.exec(s);
    if (!m) break;
    const a = group(s, m.index + m[0].length);
    if (!a) break;
    const ea = estimateEm(a.body);
    w += ea.w + 0.9;
    asc = Math.max(asc, ea.asc + 0.2);
    desc = Math.max(desc, ea.desc + 0.1);
    s = s.slice(0, m.index) + ' ' + s.slice(a.end);
  }
  if (/\\(sum|int|prod|lim|oint)(?![a-zA-Z])/.test(s)) { asc = Math.max(asc, 1.3); desc = Math.max(desc, 0.9); }
  if (/\^/.test(s)) asc = Math.max(asc, 1.0);
  if (/_/.test(s)) desc = Math.max(desc, 0.35);
  s = s.replace(/[\^_]\s*\{([^{}]*)\}/g, (_, x: string) => { w += estimateEm(x).w * 0.7; return ' '; });
  s = s.replace(/[\^_]\s*(\\[a-zA-Z]+|.)/g, () => { w += 0.4; return ' '; });
  s = s.replace(/\\(ln|log|sin|cos|tan|exp|lim|max|min)(?![a-zA-Z])/g, (_, f: string) => { w += f.length * 0.5 + 0.2; return ' '; });
  s = s.replace(/\\text\s*\{([^{}]*)\}/g, (_, t: string) => { w += [...t].reduce((a, ch) => a + (/[가-힣ㄱ-ㅎ]/.test(ch) ? 0.9 : ch === ' ' ? 0.3 : 0.5), 0); return ' '; });
  s = s.replace(/\\(cdots|ldots)(?![a-zA-Z])/g, () => { w += 1.2; return ' '; });
  s = s.replace(/\\[a-zA-Z]+/g, () => { w += 0.6; return ' '; });
  for (const ch of s) {
    if (/\s|[{}&]/.test(ch)) continue;
    if (/[+\-=<>]/.test(ch)) w += 0.8;
    else if (/[(),|[\]]/.test(ch)) w += 0.35;
    else if (/[가-힣ㄱ-ㅎ㉠-㉭]/.test(ch)) w += 0.9;
    else w += 0.5;
  }
  return { w, asc, desc };
}

export function estimateSize(latex: string, baseUnit = 1100): EqSize {
  const e = estimateEm(latex);
  return sizeFromEm(e.w, e.asc, e.desc, baseUnit);
}
