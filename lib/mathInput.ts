/**
 * Phase 68 — 편집창 수식 입력 보조의 **판정** 모듈(순수).
 * import는 `./mathRegions`·`./latexScan`뿐 — `npm run test:mathinput`이 tsc로 단독 컴파일한다.
 * 키 바인딩·dispatch는 `components/editor/MarkdownEditor.tsx`가, 자리(slot) 상태는 `lib/mathSlots.ts`가 맡는다.
 *
 * 담당:
 *   - ROW_ENVS / AMP_ENVS / ROW_ENV_RE  행 환경 이름의 **단일 원천**(D15 — blockTidy R1 ①·R5·Enter·Tab이 전부 읽는다.
 *                                      ⚠ `lib/mathSplit.ts`의 BLOCKED_ENVS는 "분할 차단" 의미라 별개)
 *   - DEFAULT_ABBREVS                   기본 수식 단축어 8종(D5). `▢`(SLOT_CHAR)가 입력 자리
 *   - parseSlots                        단축어 내용 → 텍스트 + 자리 오프셋(D7). ⚠ CM `snippet()` 템플릿을 쓰지 않는다 —
 *                                      그쪽 `\{` 이스케이프 제거에 필드 위치 버그가 있다(착수판 §0-1 N1, 프로브 실측)
 *   - findEnclosingEnv / groupDepth     Tab `&`·Enter 판정용
 *   - nextSlot                          Tab 자리 이동(D11): 그룹 탈출 우선 → 커서 뒤 빈 괄호
 *   - matchAbbrev                       커서 앞 약어(가장 긴 것)
 *   - autoFracAt                        `(A)/` → `\frac{A}{}` 판정(D19)
 *   - rowEnterPlan                      행 환경 안 Enter(D16)
 *   - layoutRowEnvs                     정돈 R5 — 펜스형 `$$` 안 행 환경 레이아웃(D17)
 *   - isFencedDisplay                   R5의 "펜스형" 판정 단일 원천(68b D8)
 *   - mathExitPos / displayTabExit      Phase 68b — 수식 나오기 위치(D5) · Tab ⑥′(D7). 안/밖 판정은 `mathRegions.exitRegionAt`
 *   - isEmptyDisplay / emptyDisplayDeleteRange  68b Q11 — 빈 블록 `$$\n\n$$`를 Ctrl+M이 지우는 범위
 *
 * ⚠ 행 단위 정규식은 `[ \t]*`(`\s*` 금지 — 개행을 빨아들인다, CLAUDE.md 규약).
 */

import { scanMathRegions, type MathRegion } from './mathRegions';
import { readGroup, skipEnvArgs } from './latexScan';
import { isInTextArg } from './mathAscii';

/* ─── 행 환경 ─────────────────────────────────────────────────────────── */

export const ROW_ENVS: readonly string[] = [
  'aligned', 'alignedat', 'align', 'align*', 'alignat', 'alignat*',
  'cases', 'dcases', 'rcases', 'drcases',
  'array', 'darray',
  'gathered', 'gather', 'gather*',
  'split',
  'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'Bmatrix', 'smallmatrix',
  'matrix*', 'pmatrix*', 'bmatrix*', 'vmatrix*', 'Vmatrix*', 'Bmatrix*',
];

/** Tab이 `&`를 넣는 환경 — 열이 없는 gathered 계열 제외 */
export const AMP_ENVS: ReadonlySet<string> = new Set(ROW_ENVS.filter((n) => !/^gather/.test(n)));

const ROW_ENV_SET: ReadonlySet<string> = new Set(ROW_ENVS);

/** `\begin{env}` 매칭(이름만 — 인수는 `skipEnvArgs`로). blockTidy R1 ①이 `MULTILINE_ENV_RE` 대신 쓴다 */
export const ROW_ENV_RE = new RegExp(`\\\\begin\\{(?:${ROW_ENVS.map((n) => n.replace(/\*/g, '\\*')).join('|')})\\}`);

/* ─── 기본 수식 단축어 ───────────────────────────────────────────────── */

export const SLOT_CHAR = '▢';

export const DEFAULT_ABBREVS: Readonly<Record<string, string>> = {
  b1: '\\overline{\\mathrm{▢}}',
  b2: '{\\overline{\\mathrm{▢}}}^{2}',
  log: '\\log_{▢}{▢}',
  sq: '\\sqrt{▢}',
  root: '\\sqrt[▢]{▢}',
  lim: '\\lim_{▢ \\to ▢}{▢}',
  int: '\\int_{▢}^{▢}{▢ dx}',
  sum: '\\sum_{k=▢}^{▢}{▢}',
};

/* ─── 공용 ───────────────────────────────────────────────────────────── */

/** `text[k]` 앞의 백슬래시 개수가 홀수면 이스케이프된 글자(`\{`·`\(`). `\\{`는 줄바꿈 + 그룹이라 이스케이프가 아니다 */
function isEscaped(text: string, k: number): boolean {
  let n = 0;
  for (let i = k - 1; i >= 0 && text[i] === '\\'; i--) n++;
  return n % 2 === 1;
}

const OPEN = '{([';
const CLOSE = '})]';
const CLOSE_OF: Record<string, string> = { '{': '}', '(': ')', '[': ']' };

const lineStartOf = (text: string, pos: number) => text.lastIndexOf('\n', pos - 1) + 1;
const lineEndOf = (text: string, pos: number) => { const nl = text.indexOf('\n', pos); return nl === -1 ? text.length : nl; };
const leadingWs = (line: string) => (line.match(/^[ \t]*/) as RegExpMatchArray)[0];

/* ─── parseSlots (D7) ──────────────────────────────────────────────────── */

/**
 * 단축어 내용 → `{ text, slots }`. `▢`가 있으면 그 자리들(문자는 지운다), 없으면 빈 `{}`·`[]`·`()` 안쪽.
 * 끝에는 항상 탈출 자리(`text.length`)를 붙인다(마지막 자리가 이미 끝이면 생략). 이스케이프 처리 없음.
 */
export function parseSlots(content: string): { text: string; slots: number[] } {
  const slots: number[] = [];
  let text = '';
  if (content.includes(SLOT_CHAR)) {
    for (const ch of content) {
      if (ch === SLOT_CHAR) slots.push(text.length);
      else text += ch;
    }
  } else {
    text = content;
    for (let i = 0; i + 1 < text.length; i++) {
      if (OPEN.includes(text[i]) && text[i + 1] === CLOSE_OF[text[i]] && !isEscaped(text, i)) slots.push(i + 1);
    }
  }
  if (slots.length === 0 || slots[slots.length - 1] !== text.length) slots.push(text.length);
  return { text, slots };
}

/* ─── 환경 탐색 ──────────────────────────────────────────────────────── */

export interface EnvInfo {
  name: string;
  /** `\begin` 시작 */
  beginFrom: number;
  /** 인수 뒤 = 본문 시작 */
  bodyFrom: number;
  /** `\end` 시작 = 본문 끝(exclusive). 미닫힘이면 영역 끝 */
  bodyTo: number;
  /** `\end{…}` 바로 뒤(exclusive). 미닫힘이면 영역 끝 */
  endTo: number;
  /** `\begin`이 있는 행의 선두 공백 */
  beginIndent: string;
}

/** 커서를 품는 **가장 안쪽** 행 환경(ROW_ENVS). 헤더(`\begin{…}{인수}`) 위도 품은 것으로 본다 */
export function findEnclosingEnv(doc: string, pos: number, region: MathRegion): EnvInfo | null {
  type Open = { name: string; beginFrom: number; bodyFrom: number };
  const stack: Open[] = [];
  let best: EnvInfo | null = null;
  const consider = (o: Open, bodyTo: number, endTo: number) => {
    if (!ROW_ENV_SET.has(o.name)) return;
    if (pos < o.beginFrom || pos > endTo) return;
    if (!best || o.beginFrom > best.beginFrom) {
      const ls = lineStartOf(doc, o.beginFrom);
      best = { name: o.name, beginFrom: o.beginFrom, bodyFrom: o.bodyFrom, bodyTo, endTo, beginIndent: leadingWs(doc.slice(ls, lineEndOf(doc, ls))) };
    }
  };
  let i = region.innerFrom;
  const end = region.innerTo;
  while (i < end) {
    if (doc[i] === '\\' && !isEscaped(doc, i)) {
      if (doc.startsWith('\\begin{', i)) {
        const close = readGroup(doc, i + 6);
        if (close === -1 || close >= end) break;
        const name = doc.slice(i + 7, close);
        let after = skipEnvArgs(doc, close + 1);
        if (after === -1 || after > end) after = close + 1;
        stack.push({ name, beginFrom: i, bodyFrom: after });
        i = after;
        continue;
      }
      if (doc.startsWith('\\end{', i)) {
        const close = readGroup(doc, i + 4);
        if (close === -1 || close >= end) break;
        const name = doc.slice(i + 5, close);
        // 이름이 맞는 것까지 pop(어긋난 중간 것은 미닫힘으로 버린다)
        let k = stack.length - 1;
        while (k >= 0 && stack[k].name !== name) k--;
        if (k >= 0) {
          const popped = stack.splice(k);
          consider(popped[0], i, close + 1);
        }
        i = close + 1;
        continue;
      }
      i += 2;
      continue;
    }
    i++;
  }
  for (const o of stack) consider(o, end, end);   // 미닫힘(타이핑 중)
  return best;
}

/** `from`~`pos` 사이 `{}`·`()`·`[]` 깊이(이스케이프 제외). 음수면 0으로 보지 않는다 — 호출부가 0 비교만 한다 */
export function groupDepth(doc: string, from: number, pos: number): number {
  let d = 0;
  for (let i = from; i < pos; i++) {
    const c = doc[i];
    if (c === '\\') { i++; continue; }
    if (OPEN.includes(c)) d++;
    else if (CLOSE.includes(c)) d--;
  }
  return d;
}

/* ─── nextSlot (D11) ──────────────────────────────────────────────────── */

/** 커서를 감싼 가장 안쪽 그룹 `{open, close}`(같은 종류끼리 짝이 맞을 때만 — `[0, 1)`은 그룹이 아니다) */
function innermostGroup(doc: string, pos: number, region: MathRegion): { open: number; close: number } | null {
  let best: { open: number; close: number } | null = null;
  for (const o of OPEN) {
    const c = CLOSE_OF[o];
    let depth = 0, open = -1;
    for (let i = pos - 1; i >= region.innerFrom; i--) {
      if (isEscaped(doc, i)) continue;
      if (doc[i] === c) depth++;
      else if (doc[i] === o) { if (depth === 0) { open = i; break; } depth--; }
    }
    if (open === -1) continue;
    depth = 0;
    let close = -1;
    for (let i = pos; i < region.innerTo; i++) {
      if (isEscaped(doc, i)) continue;
      if (doc[i] === o) depth++;
      else if (doc[i] === c) { if (depth === 0) { close = i; break; } depth--; }
    }
    if (close === -1) continue;
    if (!best || open > best.open) best = { open, close };
  }
  return best;
}

/**
 * D11 — 그룹 안이면: 닫는 괄호 뒤 3자 안에 `{`·`[`가 열리면 그 안(형제 인수 — `}{`·`}^{`·`}_{`·`]{`), 아니면 닫는 괄호 바로 뒤.
 * 그룹 밖이면: 커서 뒤의 다음 **빈** `{}`·`[]`·`()` 안. 없으면 null. 수식 경계를 넘지 않는다.
 */
export function nextSlot(doc: string, pos: number, region: MathRegion): number | null {
  const g = innermostGroup(doc, pos, region);
  if (g) {
    const limit = Math.min(g.close + 4, region.innerTo);
    for (let i = g.close + 1; i < limit; i++) {
      if ((doc[i] === '{' || doc[i] === '[') && !isEscaped(doc, i)) return i + 1;
    }
    return g.close + 1;
  }
  for (let i = pos; i + 1 < region.innerTo; i++) {
    if (OPEN.includes(doc[i]) && doc[i + 1] === CLOSE_OF[doc[i]] && !isEscaped(doc, i)) return i + 1;
  }
  return null;
}

/* ─── matchAbbrev ─────────────────────────────────────────────────────── */

/** 커서 앞 영숫자 런의 **접미사** 중 가장 긴 약어. 약어 바로 앞이 영문자·`\`면 불일치(`\log`·`alog`). `2sq`는 `sq` */
export function matchAbbrev(
  doc: string, pos: number, abbrevs: Record<string, string>, region: MathRegion,
): { from: number; content: string } | null {
  let i = pos;
  while (i > region.innerFrom && /[A-Za-z0-9]/.test(doc[i - 1])) i--;
  for (let start = i; start < pos; start++) {
    const cand = doc.slice(start, pos);
    if (!Object.prototype.hasOwnProperty.call(abbrevs, cand)) continue;
    const prev = start > 0 ? doc[start - 1] : '';
    if (/[A-Za-z\\]/.test(prev)) continue;
    return { from: start, content: abbrevs[cand] };
  }
  return null;
}

/* ─── autoFracAt (D19) ────────────────────────────────────────────────── */

/**
 * `pos` = `/`가 들어갈 자리(= `)` 바로 뒤). 바로 앞이 `)`이고 짝 `(`가 **항의 시작**(앞 글자 없음·공백·`+ - = < > , & { ( [`·줄바꿈 `\\`)이면
 * `{ from: '(' 위치, numerator }`. `f(x)/`·`\left(x\right)/`·`\frac{1}{2}(x)/`는 null.
 */
export function autoFracAt(doc: string, pos: number, region: MathRegion): { from: number; numerator: string } | null {
  if (pos < 2 || doc[pos - 1] !== ')' || isEscaped(doc, pos - 1)) return null;
  let depth = 0, open = -1;
  for (let i = pos - 2; i >= region.innerFrom; i--) {
    if (isEscaped(doc, i)) continue;
    if (doc[i] === ')') depth++;
    else if (doc[i] === '(') { if (depth === 0) { open = i; break; } depth--; }
  }
  if (open === -1) return null;
  const prev = open > 0 ? doc[open - 1] : '';
  const termStart = open === region.innerFrom || prev === '' || /[\s+\-=<>,&{(\[]/.test(prev)
    || (prev === '\\' && doc[open - 2] === '\\');
  if (!termStart) return null;
  return { from: open, numerator: doc.slice(open + 1, pos - 1) };
}

/* ─── rowEnterPlan (D16) ─────────────────────────────────────────────── */

export interface EnterPlan { from: number; to: number; insert: string; cursor: number }

const ROW_END_RE = /\\\\(?:\[[^\]\n]*\])?[ \t]*$/;

/**
 * 행 환경 안 Enter. 비관여면 null(기본 Enter).
 *   ⓐ `\begin{…}{인수}` 행 끝         → 줄바꿈 + 한 단계 들여쓰기
 *   ⓑ 행이 비어 있음(들여쓰기뿐)     → 줄바꿈 + 같은 들여쓰기
 *   ⓒ 커서 뒤 같은 행이 `\end{env}`  → (` \\`) + 줄바꿈 + 들여쓰기(커서) + 줄바꿈 + `\begin` 행 들여쓰기 + `\end…`
 *   ⓓ 행 끝이 이미 `\\`              → 줄바꿈 + 같은 들여쓰기
 *   ⓔ 그 밖                          → ` \\` + 줄바꿈 + 같은 들여쓰기
 * "같은 들여쓰기" = 현재 행 선두 공백. 단 현재 행이 `\begin` 행이면(한 줄 환경) `beginIndent + 2칸`.
 */
export function rowEnterPlan(doc: string, pos: number, region: MathRegion): EnterPlan | null {
  const env = findEnclosingEnv(doc, pos, region);
  if (!env) return null;
  if (pos > env.bodyTo) return null;                       // `\end{…}` 위
  const ls = lineStartOf(doc, pos);
  const le = lineEndOf(doc, pos);
  const before = doc.slice(ls, pos);
  const after = doc.slice(pos, le);
  const afterBlank = after.trim() === '';
  const beginOnThisLine = env.beginFrom >= ls;
  const rowIndent = beginOnThisLine ? env.beginIndent + '  ' : leadingWs(before);

  if (pos <= env.bodyFrom) {                               // 헤더 위
    if (beginOnThisLine && pos === env.bodyFrom && afterBlank) {
      const insert = '\n' + env.beginIndent + '  ';
      return { from: pos, to: le, insert, cursor: pos + insert.length };
    }
    return null;
  }

  const rowEmpty = before.trim() === '';
  const trailing = (before.match(/[ \t]*$/) as RegExpMatchArray)[0].length;
  const alreadyBroken = ROW_END_RE.test(before);

  const ws = (after.match(/^[ \t]*/) as RegExpMatchArray)[0].length;
  if (doc.startsWith('\\end{', pos + ws)) {                // ⓒ
    const sep = rowEmpty || alreadyBroken ? '' : ' \\\\';
    const head = sep + '\n' + rowIndent;
    const from = rowEmpty ? pos : pos - trailing;
    return { from, to: pos + ws, insert: head + '\n' + env.beginIndent, cursor: from + head.length };
  }
  if (rowEmpty || alreadyBroken) {                         // ⓑ · ⓓ
    const insert = '\n' + rowIndent;
    return { from: pos, to: pos, insert, cursor: pos + insert.length };
  }
  const insert = ' \\\\\n' + rowIndent;                    // ⓔ
  const from = pos - trailing;
  return { from, to: pos, insert, cursor: from + insert.length };
}

/* ─── displayEnterPlan (2026-10-10 덕수 요청 — `$$ … $$` 안에서도 Enter = ` \\` 행바꿈) ─────── */

/** `from`~`pos`의 중괄호 깊이(`\{` 제외). 소괄호·대괄호는 세지 않는다 — TeX에서 `(a \\ b)`는 정상 행바꿈이고 그룹이 아니다 */
function braceDepth(doc: string, from: number, pos: number): number {
  let d = 0;
  for (let i = from; i < pos; i++) {
    const c = doc[i];
    if (c === '\\') { i++; continue; }
    if (c === '{') d++; else if (c === '}') d--;
  }
  return d;
}
/** `from`~`pos`에서 `\left`가 `\right`보다 많이 열려 있는가(그 안의 `\\`는 KaTeX가 무시한다 — 실측) */
function insideLeftRight(doc: string, from: number, pos: number): boolean {
  let d = 0;
  const re = /\\(left|right)(?![A-Za-z])/g;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc)) !== null && m.index < pos) {
    if (isEscaped(doc, m.index)) continue;
    d += m[1] === 'left' ? 1 : -1;
  }
  return d > 0;
}

/**
 * 펜스형 `$$ … $$` 안(행 환경 밖) Enter. 행 환경 규칙 ⓑ·ⓓ·ⓔ를 "환경 = `$$` 펜스"로 그대로 쓴다. 비관여면 null(기본 Enter).
 * 근거: 렌더 전처리(`EditorPreview.preprocessMath`·`lib/preprocess.ts`)가 `$$` 안 맨 `\\`를 `\begin{array}{l}`로 감싸 행으로 그린다 —
 * KaTeX 자체는 `$$` 최상위 `\\`를 무시하므로(strict warn 실측) 이 규칙은 그 전처리에 **의존**한다. 그래서 전처리가 감싸지 않는 자리는 전부 비관여:
 *   ① 펜스형 `$$`만(`isFencedDisplay` — 한 줄 `$$x$$`·`\[…\]`는 스캐너·렌더 판정이 엇갈린다)
 *   ② 본문에 `\begin{`이 있으면 비관여(전처리 `hasEnvironment` — 환경 밖 맨 `\\`는 그대로 무시된다. 환경 안은 rowEnterPlan 몫)
 *   ③ 중괄호 깊이 0 · `\left…\right` 밖 · `\text{…}` 계열 인자 밖(그 안의 `\\`는 오류 없이 **무시**된다 — KaTeX 실측)
 *   ④ 여는 `$$` 줄·닫는 `$$` 줄 위는 기본 Enter
 * 소스만 나누는 줄바꿈은 Shift+Enter(standardKeymap — 행 환경과 같은 탈출구).
 */
export function displayEnterPlan(doc: string, pos: number, region: MathRegion): EnterPlan | null {
  if (!isFencedDisplay(doc, region)) return null;
  if (pos < region.innerFrom || pos > region.innerTo) return null;
  const body = doc.slice(region.innerFrom, region.innerTo);
  if (/\\begin\s*\{/.test(body)) return null;
  const ls = lineStartOf(doc, pos);
  if (ls <= region.innerFrom || ls >= lineStartOf(doc, region.innerTo)) return null;   // 여는·닫는 `$$` 줄
  if (braceDepth(doc, region.innerFrom, pos) > 0 || insideLeftRight(doc, region.innerFrom, pos) || isInTextArg(doc, pos, region)) return null;
  const before = doc.slice(ls, pos);
  const rowIndent = leadingWs(before);
  const rowEmpty = before.trim() === '';
  const trailing = (before.match(/[ \t]*$/) as RegExpMatchArray)[0].length;
  if (rowEmpty || ROW_END_RE.test(before)) {                // ⓑ · ⓓ
    const insert = '\n' + rowIndent;
    return { from: pos, to: pos, insert, cursor: pos + insert.length };
  }
  const insert = ' \\\\\n' + rowIndent;                    // ⓔ
  const from = pos - trailing;
  return { from, to: pos, insert, cursor: from + insert.length };
}

/* ─── layoutRowEnvs (정돈 R5 · D17) ──────────────────────────────────── */

const ind = (d: number) => '  '.repeat(d);
/** `\\[4pt]`처럼 **크기**로 읽히는 인수만 행 구분자에 붙여 둔다 — `\\[b,c]`는 다음 행이 `[`로 시작하는 것(KaTeX 오류의 원인)이라 떼어 낸다 */
const SPACING_ARG_RE = /^\[[ \t]*-?(?:\d+\.?\d*|\.\d+)[ \t]*[a-zA-Z]+[ \t]*\]/;

function findRowEnvBegin(seg: string, from: number): { at: number; name: string; argsEnd: number } | null {
  let depth = 0;
  for (let i = from; i < seg.length; i++) {
    const c = seg[i];
    if (c === '\\') {
      if (depth === 0 && seg.startsWith('\\begin{', i)) {
        const close = readGroup(seg, i + 6);
        if (close !== -1) {
          const name = seg.slice(i + 7, close);
          if (ROW_ENV_SET.has(name)) {
            let argsEnd = skipEnvArgs(seg, close + 1);
            if (argsEnd === -1) argsEnd = close + 1;
            return { at: i, name, argsEnd };
          }
        }
      }
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return null;
}

/** `from`부터 짝이 맞는 `\end{name}` 시작 인덱스(어떤 환경이든 중첩을 센다). 없으면 -1 */
function findEnvEnd(seg: string, from: number, name: string): number {
  let d = 0;
  for (let i = from; i < seg.length; i++) {
    if (seg[i] !== '\\') continue;
    if (seg.startsWith('\\begin{', i)) { d++; const c = readGroup(seg, i + 6); i = c === -1 ? i + 6 : c; continue; }
    if (seg.startsWith('\\end{', i)) {
      const c = readGroup(seg, i + 4);
      if (c === -1) return -1;
      if (d === 0) return seg.slice(i + 5, c) === name ? i : -1;
      d--; i = c; continue;
    }
    i++;
  }
  return -1;
}

/** 본문을 중괄호 깊이 0 · 중첩 환경 밖의 `\\`로 자른다. `sep`은 그 행 뒤에 있던 ` \\` + 크기 인수('' = 없음) */
function splitRows(body: string): { text: string; sep: string }[] {
  const rows: { text: string; sep: string }[] = [];
  let depth = 0, envDepth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      if (body.startsWith('\\begin{', i)) { envDepth++; const cl = readGroup(body, i + 6); i = cl === -1 ? i + 6 : cl; continue; }
      if (body.startsWith('\\end{', i)) { envDepth--; const cl = readGroup(body, i + 4); i = cl === -1 ? i + 4 : cl; continue; }
      if (body[i + 1] === '\\') {
        if (depth === 0 && envDepth === 0) {
          const m = body.slice(i + 2).match(SPACING_ARG_RE);
          const arg = m ? m[0] : '';
          rows.push({ text: body.slice(start, i), sep: ' \\\\' + arg });
          start = i + 2 + arg.length;
          i = start - 1;
          continue;
        }
        i++;
        continue;
      }
      i++;                                                   // `\{`·`\x` 한 글자 건너뜀
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  rows.push({ text: body.slice(start), sep: '' });
  return rows;
}

function layoutSeg(seg: string, depth: number): string[] {
  const out: string[] = [];
  const emitText = (t: string) => {
    for (const l of t.split('\n')) { const s = l.trim(); if (s) out.push(ind(depth) + s); }
  };
  let cursor = 0;
  for (;;) {
    const b = findRowEnvBegin(seg, cursor);
    if (!b) { emitText(seg.slice(cursor)); break; }
    const endAt = findEnvEnd(seg, b.argsEnd, b.name);
    if (endAt === -1) { emitText(seg.slice(cursor)); break; }   // 미닫힘 — 손대지 않는다
    emitText(seg.slice(cursor, b.at));
    out.push(ind(depth) + seg.slice(b.at, b.argsEnd).trim());
    const rows = splitRows(seg.slice(b.argsEnd, endAt));
    rows.forEach((r, k) => {
      const lines = layoutSeg(r.text, depth + 1);
      if (lines.length === 0) {
        if (r.sep) out.push(ind(depth + 1) + r.sep.trim());  // 빈 행 `\\`
        else if (k < rows.length - 1) out.push(ind(depth + 1));
        return;
      }
      if (r.sep) lines[lines.length - 1] += r.sep;
      out.push(...lines);
    });
    const endClose = readGroup(seg, endAt + 4);
    out.push(ind(depth) + seg.slice(endAt, endClose + 1));
    cursor = endClose + 1;
  }
  return out;
}

/**
 * 정돈 R5 — **펜스형** `$$` display(여는 `$$` 뒤 행 나머지 공백 · 닫는 `$$` 앞 같은 행 공백) 안에 행 환경이 있으면
 * `\begin`·`\end`를 자기 줄로, 행을 `\\` 단위로, 들여쓰기 = 중첩 깊이 × 2칸. 한 줄 `$$…$$`·인라인·(c) 형태·`\[…\]`는 무접촉. 멱등.
 */
export function layoutRowEnvs(text: string): { text: string; changed: boolean } {
  const regions = scanMathRegions(text).filter((r) =>
    r.kind === 'display' && r.delimiter === '$$' && r.closed && !r.empty && r.innerTo > r.innerFrom);
  let out = text;
  let changed = false;
  for (let k = regions.length - 1; k >= 0; k--) {
    const r = regions[k];
    if (!isFencedDisplay(text, r)) continue;                             // (b)·(c)가 아닌 펜스형만 (Phase 68b D8 — 원천 하나)
    const inner = text.slice(r.innerFrom, r.innerTo);
    if (!ROW_ENV_RE.test(inner)) continue;
    const lines = layoutSeg(inner, 0);
    const laid = '\n' + lines.join('\n') + '\n';
    if (laid === inner) continue;
    out = out.slice(0, r.innerFrom) + laid + out.slice(r.innerTo);
    changed = true;
  }
  return { text: out, changed };
}

/* ─── Phase 68b — 수식 나오기(D5·D7·D8) ────────────────────────────────────
   키 바인딩·dispatch는 `lib/math-editor-extensions.ts`(양쪽 편집기 공용)와 `MarkdownEditor`(Tab ⑥′)가 맡는다.
   "안/밖" 판정은 `lib/mathRegions.exitRegionAt`(삽입 뒤 문서 기준 — 행 끝 `$|$` 함정) — 여기서는 받은 region으로 **위치만** 센다. */

/** D8 — 펜스형 `$$`: 여는 `$$` 뒤 행 나머지 공백 ∧ 닫는 `$$` 앞 행 머리 공백. 정돈 R5(`layoutRowEnvs`) 전용 판정 */
export function isFencedDisplay(doc: string, region: MathRegion): boolean {
  if (region.kind !== 'display' || region.delimiter !== '$$' || !region.closed || region.empty) return false;
  if (doc.slice(region.innerFrom, lineEndOf(doc, region.innerFrom)).trim() !== '') return false;
  return doc.slice(lineStartOf(doc, region.innerTo), region.innerTo).trim() === '';
}

/** D5 ①′ — 닫힌 `$$` display이고 안이 공백뿐(한 줄 `$$$$` 포함). Ctrl+M·Shift+Esc가 블록째 지우는 대상(Q11) */
export function isEmptyDisplay(doc: string, region: MathRegion): boolean {
  return region.kind === 'display' && region.delimiter === '$$' && region.closed && !region.empty
    && doc.slice(region.innerFrom, region.innerTo).trim() === '';
}

export interface ExitPlan {
  /** insert 적용 **뒤** 좌표 */
  pos: number;
  insert?: '\n';
  /** insert를 넣을 자리(원 문서 좌표) */
  at?: number;
}

/** D5 — 수식 전체에서 나오는 위치.
 *  ③ 인라인(`$`·`\(`) · `\[…\]` · 미닫힘                      → region.to
 *  ② 닫힌 `$$`(한 줄·펜스형·닫는 `$$` 앞 글자 — 펜스 여부 무관): 닫는 `$$` 뒤 행 나머지 비공백 → region.to
 *     ②-a 다음 행 있고 공백뿐 → 다음 행 시작  ②-b 다음 행 없음·비공백 → `\n`을 넣어 빈 행을 만들고 그 행
 *  한 줄 `$$x$$`도 ②인 이유(v3 F1): 저장 정규화가 어차피 앞뒤를 가르므로 화면에서도 처음부터 다음 행에 쓰게 한다. */
export function mathExitPos(doc: string, region: MathRegion): ExitPlan {
  if (region.kind !== 'display' || region.delimiter !== '$$' || !region.closed) return { pos: region.to };
  const lineEnd = lineEndOf(doc, region.to);
  if (doc.slice(region.to, lineEnd).trim() !== '') return { pos: region.to };
  if (lineEnd >= doc.length) return { pos: lineEnd + 1, insert: '\n', at: lineEnd };
  const nextStart = lineEnd + 1;
  const nextEnd = lineEndOf(doc, nextStart);
  if (doc.slice(nextStart, nextEnd).trim() !== '') return { pos: lineEnd + 1, insert: '\n', at: lineEnd };
  return { pos: nextStart };
}

/** D7 — Tab ⑥′: 닫힌 비empty display 안에서 커서 뒤가 `innerTo`까지 공백뿐일 때만 나간다(식 중간에서 튀지 않게). 아니면 null */
export function displayTabExit(doc: string, pos: number, region: MathRegion): ExitPlan | null {
  if (region.kind !== 'display' || !region.closed || region.empty) return null;
  if (pos < region.innerFrom || pos > region.innerTo) return null;
  if (doc.slice(pos, region.innerTo).trim() !== '') return null;
  return mathExitPos(doc, region);
}

/** D5 ①′ — 빈 블록 삭제 범위(v4 I1). `insertDisplayMathBlock`의 역연산이되 흡수된 공백은 되살릴 수 없으므로 **문단 경계 하나**로 되돌린다.
 *  다행(여는·닫는 `$$`가 다른 행): 좌우 공백(개행 포함) 끝까지를 `''`(문서 시작/끝) 또는 `\n\n`으로. 커서 = 범위 시작(누르기 직전 자리).
 *  한 줄 `$$$$`: region만 지운다. 결과는 저장 정규화(`normalizeDisplayMathSpacing` + 앞뒤 trim) 뒤와 바이트 동일(테스트가 고정) */
export function emptyDisplayDeleteRange(doc: string, region: MathRegion): { from: number; to: number; insert: '' | '\n\n'; cursor: number } {
  const oneLine = lineEndOf(doc, region.from) >= region.to;
  if (oneLine) return { from: region.from, to: region.to, insert: '', cursor: region.from };
  let a = region.from;
  while (a > 0 && /\s/.test(doc[a - 1])) a--;
  let b = region.to;
  while (b < doc.length && /\s/.test(doc[b])) b++;
  const insert = a === 0 || b === doc.length ? '' : '\n\n';
  return { from: a, to: b, insert, cursor: a };
}
