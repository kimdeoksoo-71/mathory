/**
 * Phase 71 R10 — 경우 라벨·본문 인용의 HWPX 표기. import 0.
 *   C1 → `(ⅰ)` · C2 → `(ⅱ)` · C1a → `(ⅰ-1)` · C2b → `(ⅱ-2)` — 유니코드 소문자 로마 숫자(U+2170~), 공백 없음.
 *   ⚠ 옛 표기 `( i )`(ASCII 글자 + 괄호 안 공백)는 넓어서 해설-단계 탭 자리를 넘겨 본문이 다음 탭(오른쪽 끝)으로
 *   밀렸다 — 덕수 실물 2026-10-15: 유니코드 한 글자 숫자 + 공백 없음이면 탭 자리에 딱 맞는다.
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

/** 1~12는 한 글자(ⅰ~ⅻ), 그 위는 글자마다 유니코드 로마 숫자(xiii → ⅹⅰⅰⅰ) */
const SMALL_ROMAN_LETTER: Record<string, string> = { i: 'ⅰ', v: 'ⅴ', x: 'ⅹ', l: 'ⅼ', c: 'ⅽ', d: 'ⅾ', m: 'ⅿ' };
export function smallRoman(n: number): string {
  const k = Math.max(1, Math.floor(n));
  if (k <= 12) return String.fromCharCode(0x2170 + k - 1);
  return [...toRoman(k)].map((ch) => SMALL_ROMAN_LETTER[ch]).join('');
}

/** `C1`·`C1a`(끝의 `.` 허용) → `(ⅰ)`·`(ⅰ-1)`. 모양이 아니면 null */
export function caseLabelHwp(label: string): string | null {
  const m = /^C(\d{1,3})([a-z]*)\.?$/.exec(label.trim());
  if (!m) return null;
  const top = smallRoman(parseInt(m[1], 10));
  return m[2] ? `(${top}-${letterIndex(m[2])})` : `(${top})`;
}
