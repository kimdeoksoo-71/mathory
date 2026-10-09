/**
 * Phase 68c D5·D6′ — 스마트 붙여넣기의 **판정·변환** 단일 원천. 순수 모듈(DOM 0 · `npm run test:mathpaste`).
 * CM 배선은 `lib/math-editor-extensions.ts` `createMathPaste()`(블록·댓글 편집기 공용 — 작업 규칙 9),
 * HTML 클립보드 → 미니 트리는 `lib/snodeDom.ts`(브라우저 전용), 미니 트리 → 마크다운은 61c `lib/chatExtract.serializeNodes`.
 *
 * `smartPasteText(text, doc, from, to)` 순서(규칙이다):
 *   ① `stripInvisibles`(M9 G — 폭 0·NFD·단독 초성·전각 마침표)
 *   ② 구분자 정규화 — `\(…\)` → `$…$` · `\[…\]` → **펜스형** `$$\n…\n$$`(한 줄 `$$x$$`는 렌더가 **인라인**이라 — Phase 59 실측).
 *      코드 펜스·인라인 코드·기존 `$`/`$$`·`\\`(행바꿈 — `\\[4pt]`의 `\[`를 여는 구분자로 먹지 않는다, 61a C6)·`\$`는 보존.
 *      짝이 없으면(미닫힘) 무접촉. 앞뒤 빈 줄은 저장 정규화(`normalizeDisplayMathSpacing`)의 몫이라 여기서 넣지 않는다 —
 *      다만 `$$`가 **자기 줄**에 서야 펜스가 되므로 같은 줄 앞뒤 글자가 있으면 줄바꿈 하나씩은 넣는다.
 *   ③ 수식 안 정규화 — 붙인 결과 문서를 `scanMathRegions`로 스캔해 **붙인 구간과 겹치는 수식 영역 안**만 D6 변환.
 *      붙이는 자리가 수식 안이면 평문 전체 · 평문이 `$`를 품으면 그 안만 · 둘 다 아니면 무접촉. `\text{…}` 계열 인자 안은 제외.
 *
 * D6′ 유니코드 → LaTeX 표 = `ALL_SYMBOLS`(1코드포인트 비ASCII · 순수 명령 또는 ASCII 한 글자 · katexSupported)에서
 *   **최단형 우선, 동률이면 id 오름차순**(Q13 — 결정적) → `PREFERRED`(최단형 규칙의 예외) → `OVERRIDES`(표에 없거나 정본과 다른 것) 순으로 덮는다.
 *   ⚠ 중복 기호 42종의 최종값은 `tests/mathPaste.test.mjs` 스냅샷이 고정한다 — 표를 고치면 스냅샷이 깨져야 정상이다.
 *   ⚠ 결합 문자(`˙→\dot{}`·`⃗→\vec{}` 등 9종)는 구조형이라 제외. 한글·한자·가나는 표에 없어 무접촉. 전각 `＄`는 바꾸지 않는다(Q9).
 */
import { ALL_SYMBOLS } from './math-symbols';
import { scanMathRegions } from './mathRegions';
import { TEXT_CMDS } from './mathAscii';
import { readGroup } from './latexScan';
import { stripInvisibles } from './invisibles';

/** 최단형 규칙의 예외(Q5·Q6·Q13). 최단형이 GFM 함정(`∥→\|` — M1 W1)이거나 교재 관례와 다른 것 */
export const PREFERRED: Readonly<Record<string, string>> = {
  '∥': '\\parallel',
  '∣': '\\mid',
  '⊥': '\\perp',
  '←': '\\leftarrow',
  '△': '\\triangle',
  '∅': '\\varnothing',
  '¬': '\\neg',
  '∧': '\\wedge',
  '∨': '\\vee',
  '…': '\\cdots',
  '∫': '\\int',
  '†': '\\dagger',
  '‡': '\\ddagger',
  '⊨': '\\models',
  '□': '\\square',
  '◊': '\\lozenge',
};

/** 표에 없거나 표의 명령이 정본과 다른 것(Q7·Q8). `√`·첨자 런은 코드가 따로 다룬다 */
export const OVERRIDES: Readonly<Record<string, string>> = {
  '≠': '\\ne',
  '⋯': '\\cdots',
  '·': '\\cdot',
  '⋅': '\\cdot',
  '×': '\\times',
  '÷': '\\div',
  '−': '-',
  '′': "'",
  '″': "''",
  '‴': "'''",
  '°': '^\\circ',
};

function buildTable(): Map<string, string> {
  const best = new Map<string, { latex: string; id: number }>();
  for (const s of ALL_SYMBOLS) {
    if (!s.katexSupported) continue;
    const sym = s.symbol;
    if (!sym || Array.from(sym).length !== 1 || (sym.codePointAt(0) ?? 0) <= 0x7f) continue;
    const L = s.latex;
    if (L === sym) continue;                                        // ȷ·ı 항등
    if (!/^\\(?:[A-Za-z]+|[^A-Za-z\s])$/.test(L) && !/^[!-~]$/.test(L)) continue;   // 순수 명령 또는 ASCII 한 글자만(구조형 제외)
    const cur = best.get(sym);
    if (!cur || L.length < cur.latex.length || (L.length === cur.latex.length && s.id < cur.id)) best.set(sym, { latex: L, id: s.id });
  }
  const out = new Map<string, string>();
  best.forEach((v, k) => out.set(k, v.latex));
  for (const k of Object.keys(PREFERRED)) out.set(k, PREFERRED[k]);
  for (const k of Object.keys(OVERRIDES)) out.set(k, OVERRIDES[k]);
  return out;
}

export const UNICODE_TO_LATEX: ReadonlyMap<string, string> = buildTable();

const SUP: Readonly<Record<string, string>> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n', 'ⁱ': 'i',
};
const SUB: Readonly<Record<string, string>> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't',
  'ᵢ': 'i', 'ⱼ': 'j',
};

/** 전각 ASCII(U+FF01–FF5E) → ASCII · 전각 공백 → 공백. ⚠ 전각 `＄`(U+FF04)는 그대로(Q9 — 수식 안에선 오지 않고, 오면 의도가 불분명) */
function fullwidthToAscii(ch: string): string | null {
  const c = ch.charCodeAt(0);
  if (c === 0x3000) return ' ';
  if (c >= 0xff01 && c <= 0xff5e && c !== 0xff04) return String.fromCharCode(c - 0xfee0);
  return null;
}

/**
 * 수식 **안** 문자열 하나를 변환한다(영역 판정은 호출부 몫). 이미 명령형인 것·한글은 무접촉.
 * `√` 뒤가 `{`·`(`가 아니면 **다음 토큰 하나**(숫자 런 · 영문자 하나 · 표의 유니코드 하나 · `\명령`)만 감싼다(`√2x` = `\sqrt{2}x`).
 * 명령(`\le` 꼴) 바로 뒤가 영숫자면 공백 하나(`≤x` → `\le x` — 없으면 `\lex`라는 다른 명령이 된다).
 */
export function convertUnicodeMath(seg: string): string {
  const ch = Array.from(seg);
  let out = '';
  let sep = false;                                                  // 직전 조각이 `\명령`으로 끝났다
  const emit = (piece: string, converted: boolean) => {
    if (!piece) return;
    if (sep && /^[A-Za-z0-9]/.test(piece)) out += ' ';
    sep = converted && /\\[A-Za-z]+$/.test(piece);
    out += piece;
  };
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (SUP[c] !== undefined || SUB[c] !== undefined) {
      const map = SUP[c] !== undefined ? SUP : SUB;
      let run = '';
      while (i < ch.length && map[ch[i]] !== undefined) { run += map[ch[i]]; i++; }
      i--;
      emit((map === SUP ? '^{' : '_{') + run + '}', true);
      continue;
    }
    if (c === '√') {
      emit('\\sqrt', true);
      const n = ch[i + 1];
      if (n === '(') {
        let depth = 0;
        let k = i + 1;
        for (; k < ch.length; k++) {
          if (ch[k] === '(') depth++;
          else if (ch[k] === ')' && --depth === 0) break;
        }
        if (k < ch.length) {
          emit('{' + convertUnicodeMath(ch.slice(i + 2, k).join('')) + '}', true);
          i = k;
        }
        continue;
      }
      if (n === undefined || n === '{') continue;
      if (/[0-9]/.test(n)) {
        let k = i + 1;
        let run = '';
        while (k < ch.length && /[0-9.]/.test(ch[k])) { run += ch[k]; k++; }
        if (run.endsWith('.')) { run = run.slice(0, -1); k--; }
        emit('{' + run + '}', true);
        i = k - 1;
        continue;
      }
      if (/[A-Za-z]/.test(n)) { emit('{' + n + '}', true); i++; continue; }
      if (n === '\\') {
        let k = i + 2;
        while (k < ch.length && /[A-Za-z]/.test(ch[k])) k++;
        if (k > i + 2) { emit('{' + ch.slice(i + 1, k).join('') + '}', true); i = k - 1; }
        continue;
      }
      const m = UNICODE_TO_LATEX.get(n);
      if (m) { emit('{' + m + '}', true); i++; }
      continue;
    }
    const fw = fullwidthToAscii(c);
    if (fw !== null) { emit(fw, false); continue; }
    const m = UNICODE_TO_LATEX.get(c);
    if (m !== undefined) { emit(m, true); continue; }
    emit(c, false);
  }
  return out;
}

/* ── ② 구분자 정규화 ─────────────────────────────────────────────────────── */

/** `\]`·`\)` 닫는 짝. `\\`(행바꿈)는 짝으로 건너뛴다. 인라인은 빈 줄을 넘지 않는다 */
function findClose(text: string, from: number, closeCh: string, inline: boolean): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] === '\\' && text[j + 1] === '\\') { j++; continue; }
    if (text[j] === '\\' && text[j + 1] === closeCh) return j;
    if (inline && text[j] === '\n' && text[j + 1] === '\n') return -1;
  }
  return -1;
}

export function normalizeMathDelimitersForPaste(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    // 코드 펜스 통째로 보존
    if (text.startsWith('```', i)) {
      const close = text.indexOf('```', i + 3);
      const end = close === -1 ? n : close + 3;
      out += text.slice(i, end); i = end; continue;
    }
    // 인라인 코드 보존(같은 행)
    if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);
      if (close !== -1 && text.slice(i + 1, close).indexOf('\n') === -1) { out += text.slice(i, close + 1); i = close + 1; continue; }
    }
    if (text[i] === '\\') {
      const c = text[i + 1];
      if (c === '\\' || c === '$') { out += text.slice(i, i + 2); i += 2; continue; }
      if (c === '(' || c === '[') {
        const inline = c === '(';
        const close = findClose(text, i + 2, inline ? ')' : ']', inline);
        const inner = close === -1 ? '' : text.slice(i + 2, close).trim();
        if (close !== -1 && inner) {
          if (inline) {
            // 인접 `$`와 붙으면 마크다운이 `$a$$b$`를 수식 하나로 읽는다(M7 D1) — 공백 하나
            const pre = out.endsWith('$') ? ' ' : '';
            const post = text[close + 2] === '$' ? ' ' : '';
            out += pre + '$' + inner + '$' + post;
            i = close + 2;
          } else {
            const lineHead = out.slice(out.lastIndexOf('\n') + 1);
            if (lineHead.trim()) out = out.replace(/[ \t]+$/, '') + '\n';
            out += '$$\n' + inner + '\n$$';
            i = close + 2;
            const nl = text.indexOf('\n', i);
            const restLine = text.slice(i, nl === -1 ? n : nl);
            if (restLine.trim()) { out += '\n'; while (text[i] === ' ' || text[i] === '\t') i++; }
          }
          continue;
        }
      }
      out += text[i]; i++; continue;
    }
    // 기존 수식 보존 — `$$…$$` · `$…$`(닫는 짝 = 백슬래시 없는 다음 `$`, 빈 줄에서 종료)
    if (text[i] === '$') {
      if (text[i + 1] === '$') {
        const close = text.indexOf('$$', i + 2);
        if (close !== -1) { out += text.slice(i, close + 2); i = close + 2; continue; }
        out += '$$'; i += 2; continue;
      }
      let found = -1;
      for (let j = i + 1; j < n; j++) {
        if (text[j] === '$' && text[j - 1] !== '\\') { found = j; break; }
        if (text[j] === '\n' && text[j + 1] === '\n') break;
      }
      if (found !== -1) { out += text.slice(i, found + 1); i = found + 1; continue; }
    }
    out += text[i]; i++;
  }
  return out;
}

/* ── ③ 영역 판정 + 합성 ──────────────────────────────────────────────────── */

const TEXT_CMD_RE = new RegExp(`\\\\(?:${TEXT_CMDS.join('|')})\\{`, 'g');

/** 수식 내부 `[a, b)`에서 `\text{…}` 계열 인자 구간을 뺀 조각들(문서 좌표) */
function minusTextArgs(doc: string, a: number, b: number, innerFrom: number, innerTo: number): Array<[number, number]> {
  const holes: Array<[number, number]> = [];
  const head = doc.slice(innerFrom, innerTo);
  TEXT_CMD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEXT_CMD_RE.exec(head)) !== null) {
    const open = innerFrom + m.index + m[0].length - 1;
    const close = readGroup(doc, open);
    const end = close === -1 || close > innerTo ? innerTo : close;
    holes.push([open + 1, end]);
    if (close !== -1) TEXT_CMD_RE.lastIndex = Math.max(TEXT_CMD_RE.lastIndex, close - innerFrom);
  }
  const out: Array<[number, number]> = [];
  let cur = a;
  for (const [hs, he] of holes) {
    if (he <= cur || hs >= b) continue;
    if (hs > cur) out.push([cur, Math.min(hs, b)]);
    cur = Math.max(cur, he);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}

export function smartPasteText(text: string, doc: string, from: number, to: number): string {
  if (!text) return text;
  const t = normalizeMathDelimitersForPaste(stripInvisibles(text));
  const merged = doc.slice(0, from) + t + doc.slice(to);
  const a = from;
  const b = from + t.length;
  const spans: Array<[number, number]> = [];
  for (const r of scanMathRegions(merged)) {
    if (r.empty) continue;
    if (r.innerFrom >= b) break;
    const s = Math.max(r.innerFrom, a);
    const e = Math.min(r.innerTo, b);
    if (s < e) spans.push(...minusTextArgs(merged, s, e, r.innerFrom, r.innerTo));
  }
  if (!spans.length) return t;
  let out = '';
  let cur = 0;
  for (const [s, e] of spans) {
    const rs = s - a;
    const re = e - a;
    out += t.slice(cur, rs) + convertUnicodeMath(t.slice(rs, re));
    cur = re;
  }
  return out + t.slice(cur);
}
