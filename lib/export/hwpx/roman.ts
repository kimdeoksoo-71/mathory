/**
 * Phase 71 R10 — 경우 라벨·본문 인용의 HWPX 표기. import 0.
 *   C1 → `( i )` · C2 → `( ii )` · C1a → `( i - 1 )` · C2b → `( ii - 2 )` (ASCII 소문자 로마자, 괄호 안 공백)
 * 굵게 없음(R10). PDF·.typ·.tex는 `C1.` 그대로 — 이 표기는 HWPX 전용이다.
 */

const ROMAN: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];

export function toRoman(n: number): string {
  let out = '';
  let r = Math.max(1, Math.floor(n));
  for (const [v, s] of ROMAN) while (r >= v) { out += s; r -= v; }
  return out;
}

/** 소문자 글자 번호(a=1 … z=26 · aa=27 — caseBlock.letters의 역) */
function letterIndex(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 96);
  return n;
}

/** `C1`·`C1a`(끝의 `.` 허용) → `( i )`·`( i - 1 )`. 모양이 아니면 null */
export function caseLabelHwp(label: string): string | null {
  const m = /^C(\d{1,3})([a-z]*)\.?$/.exec(label.trim());
  if (!m) return null;
  const top = toRoman(parseInt(m[1], 10));
  return m[2] ? `( ${top} - ${letterIndex(m[2])} )` : `( ${top} )`;
}
