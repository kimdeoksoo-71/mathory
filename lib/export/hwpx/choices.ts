/**
 * Phase 71 N9 — 긴 선택지 판정(선지-5 한 줄 vs 선지-3 두 문단 3+2). import 0.
 *
 * 한글은 측정 API가 없으므로 **폭 추정**(HWPUNIT)이다. 기준은 평가원 문항의 실례(템플릿 3~5차 실측):
 *   3+2로 낸 선택지의 수식 폭 3437~4995 · 5열로 낸 선택지의 최대 폭 2741 → 수식이 든 선택지는 임계 ≈3000.
 * 글자만 있는 선택지(`ㄱ, ㄴ, ㄷ` 합답형 등)는 그 임계로 재면 대부분 3+2가 되는데 실제 시험지는 5열이다 —
 * 그래서 **글자뿐이면 한 칸의 수용 폭**(선지-5 탭 간격 6123 − 라벨 ≈ 1400 = 약 4700 · 추정 오차를 보아 5000)을 임계로 쓴다(착수판 §11 기록).
 * 판정이 애매하면 선지-3 쪽(R14 — 넘쳐 겹치는 것보다 낫다).
 */

export type ChoicePiece = { t: 'text'; s: string } | { t: 'math'; latex: string };

const EM = 1100;                 // 수식 baseUnit · 본문 11.5pt ≈ 1150 — 근사는 1100으로
export const MATH_LIMIT = 3000;
export const TEXT_LIMIT = 5000;   // "ㄱ, ㄴ, ㄷ" 추정 4620 — 실제 시험지는 5열

/** 글자 폭(em) — 한글·한자 1 · 전각 기호 1 · ASCII 0.5 · 공백 0.3 */
function textEm(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += 0.3;
    else if (/[ᄀ-ᇿ㄰-㆏가-힣一-鿿①-⓿㈀-㋿]/.test(ch)) w += 1;
    else if (/[,.;:]/.test(ch)) w += 0.3;
    else w += 0.5;
  }
  return w;
}

/** 수식 폭(em) 근사 — 렌더러 없이 LaTeX 구조만 본다 */
export function mathEm(latex: string): number {
  let s = latex.replace(/\\(displaystyle|textstyle|left|right|,|;|!|quad|qquad)/g, ' ');
  let w = 0;
  // 분수: 분자·분모 중 넓은 쪽 + 여백
  for (let guard = 0; guard < 50; guard++) {
    const m = /\\[dtc]?frac\s*/.exec(s);
    if (!m) break;
    const a = group(s, m.index + m[0].length);
    if (!a) break;
    const b = group(s, a.end);
    if (!b) break;
    w += Math.max(mathEm(a.body), mathEm(b.body)) + 0.3;
    s = s.slice(0, m.index) + ' ' + s.slice(b.end);
  }
  // 근호: 기호 + 안
  for (let guard = 0; guard < 50; guard++) {
    const m = /\\sqrt\s*(\[[^\]]*\])?\s*/.exec(s);
    if (!m) break;
    const a = group(s, m.index + m[0].length);
    if (!a) break;
    w += mathEm(a.body) + 0.9;
    s = s.slice(0, m.index) + ' ' + s.slice(a.end);
  }
  // 첨자: 70%
  s = s.replace(/[\^_]\s*\{([^{}]*)\}/g, (_, x: string) => { w += mathEm(x) * 0.7; return ' '; });
  s = s.replace(/[\^_]\s*(\\[a-zA-Z]+|.)/g, (_, x: string) => { w += 0.4; void x; return ' '; });
  // 함수 이름(ln·log·sin …)은 로만 글자 + 뒤 공백
  s = s.replace(/\\(ln|log|sin|cos|tan|exp|lim|max|min)(?![a-zA-Z])/g, (_, f: string) => { w += f.length * 0.5 + 0.3; return ' '; });
  // 그 밖의 명령(그리스 문자·기호) 한 글자
  s = s.replace(/\\[a-zA-Z]+/g, () => { w += 0.6; return ' '; });
  for (const ch of s) {
    if (/\s|[{}]/.test(ch)) continue;
    if (/[+\-=<>]/.test(ch)) w += 0.9;          // 앞뒤 간격 포함
    else if (/[(),|]/.test(ch)) w += 0.35;
    else if (/[ᄀ-ᇿ㄰-㆏가-힣]/.test(ch)) w += 1;
    else w += 0.5;
  }
  return w;
}

function group(s: string, i: number): { body: string; end: number } | null {
  let j = i;
  while (j < s.length && s[j] === ' ') j++;
  if (s[j] !== '{') return j < s.length ? { body: s[j], end: j + 1 } : null;
  let d = 0;
  for (let k = j; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (d === 0) return { body: s.slice(j + 1, k), end: k + 1 }; }
  }
  return null;
}

/** 선택지 하나의 폭(HWPUNIT) · 수식 포함 여부 */
export function choiceWidth(pieces: ChoicePiece[]): { width: number; hasMath: boolean } {
  let em = 0;
  let hasMath = false;
  for (const p of pieces) {
    if (p.t === 'text') em += textEm(p.s);
    else { em += mathEm(p.latex); hasMath = true; }
  }
  return { width: Math.round(em * EM), hasMath };
}

/** 4~5개 선택지가 한 줄 5칸에 들어가지 않는가(→ 선지-3 두 문단) */
export function isLongChoices(items: ChoicePiece[][]): boolean {
  return items.some((it) => {
    const { width, hasMath } = choiceWidth(it);
    return width > (hasMath ? MATH_LIMIT : TEXT_LIMIT);
  });
}
