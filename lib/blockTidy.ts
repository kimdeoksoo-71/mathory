/**
 * M7 D19 — 블록 정돈(broom). 순수 모듈 — import는 `./mathRegions`·`./proofread`·`./invisibles`뿐(`npm run test:tidy`가 단독 컴파일).
 *
 * 취지: 시트 가져오기·OCR로 들어온 "한 덩어리" 텍스트를 Mathory의 블록 체계에 맞게 **분할**하고,
 * 가능한 경우 **타입**(경우·하위 경우·제목)을 부여하며, 편집 스타일의 **결정적 정형화**를 한 번에 태운다.
 * 교정(proofread)은 이제 API 내용 검토만 한다(D19-4). ⚠ `autoFixDeterministicIssues`의 소비처는 **둘**이다 —
 * 이 모듈과 `lib/ocr.ts`(편집창·댓글 OCR 후처리). M7 때 "이 모듈 하나"라 적었던 것은 틀렸다(M9 §1-H7).
 *
 * 규칙 순서(순서가 규칙이다 — 분할 뒤에 정형화해야 새 블록도 받는다):
 *   R0 (M9 D29) `\section*{…}` 계열 벗기기 — 분할 **앞**이라 `\section*{STEP1}`이 곧바로 제목 블록이 된다. autoFix 옵션 무관
 *   R1 분할  (text 계열만 · choices·image·svg·ggb 무접촉)
 *       ① `$$…$$` 독립 display 안에 `\begin{aligned|cases|array|matrix…}`이 있는 다행 덩어리 → 자기 블록(text)
 *          (한 줄짜리·`\begin` 없는 다행은 떼지 않는다 — P12)
 *       ② `(i) … 인 경우` 행 → `case` 블록(괄호 로마숫자 삭제, `…인 경우` 문장만)
 *       ③ `(i-1)`·`(i)-1` 꼴 → `subcase`
 *       ④ `[참고]` 행 → `heading`(`## [참고] …` — 표지 보존, P13)   ⑤ `STEP n` 행 → `heading`(`## STEP3 …`)
 *       ⑥ (M9 D30) `GUIDE` 행 → `heading`(`## GUIDE …` — STEP과 같은 형식)
 *       분할된 조각 중 특수 타입이 아닌 첫 조각은 **원 블록 타입 유지**(case 제목행 보존), 이후는 `text`.
 *   R2 머리 정리 — (M9 D26) question 탭: 첫 블록 첫 행 문제번호 `15. `만 제거(정답 행 규칙 없음)
 *       · question이 아닌 탭(solution + extra 전부, P14):
 *       탭 첫 블록 첫 행 앞머리 `15.` 제거 · 2행 이하에서 행 전체가 `정답 ③`·`정답: 56` 이면 그 행 삭제(콜론 허용, N4)
 *   R3 결정적 정형화 = `autoFixDeterministicIssues` 전부(⓪~③ + ⇒ 규칙). choices는 skipJamoRefs, 그림 있는 choices는 제외
 *   R4 trim = 저장 정규화(`toPersistedBlock`)와 같은 앞뒤 빈 줄 제거 — 정돈 직후 화면에서 보이게
 *
 * ⚠ 정규식은 행 시작 앵커 + `[ \t]*`(`\s*` 금지 — 개행을 빨아들인다, CLAUDE.md 규약).
 * ⚠ 새 조각의 `block_key`·id는 **호출부**가 부여한다(모듈은 nanoid를 모른다). `origin`이 입력 인덱스다.
 */

import { scanMathRegions } from './mathRegions';
import { autoFixDeterministicIssues, unwrapSectionCommands } from './proofread';
import { stripInvisibles, isInvisibleTarget } from './invisibles';

export interface TidyIn { type: string; raw_text: string; title?: string }
export interface TidyOut { type: string; raw_text: string; title?: string; origin: number }
export interface TidyStats { split: number; fixed: number; removed: number; /** M9 Q16 — 식 번호 충돌로 ㉠→\tag 변환을 건너뛴 블록 수 */ tagConflict: number }
export interface TidyOptions { tab: 'question' | 'solution' | 'extra'; autoFix?: boolean }

/** EditorView.SPLITTABLE_TYPES와 같다(사본 — 그쪽은 컴포넌트 상수라 import 0 규약상 여기 다시 적는다) */
const SPLITTABLE = new Set(['text', 'heading', 'list', 'callout', 'coach_important', 'coach_caution', 'case', 'subcase', 'gana', 'roman', 'box']);
const NO_FIX = new Set(['image', 'svg', 'ggb']);

/** 시트 가져오기의 CHOICE_FIG_RE — 그림 표기가 든 선택지는 정형화하지 않는다(61e 가드, 여기로 이전) */
const CHOICE_FIG_RE = /\\includegraphics|!\[(?:[^\[\]\n]|\[[^\[\]\n]*\])*\]\([ \t]*https:\/\/drive\.google\.com\//;

const ROMAN = '(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)';
const CASE_RE = new RegExp(`^\\(${ROMAN}\\)[ \\t]*(.+?인 경우)[ \\t]*[:,.]?[ \\t]*$`);
const SUBCASE_RE = new RegExp(`^\\(${ROMAN}(?:-\\d+\\)|\\)-\\d+)[ \\t]*(.+?인 경우)[ \\t]*[:,.]?[ \\t]*$`);
const REF_RE = /^\[참고\]/;
const STEP_RE = /^STEP[ \t]?\d+/;
const GUIDE_RE = /^GUIDE(?![A-Za-z])/;   // M9 D30
const MULTILINE_ENV_RE = /\\begin\{(?:aligned|cases|dcases|rcases|array|gathered|split|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix|smallmatrix)\}/;

const NUMBER_HEAD_RE = /^\d{1,2}\.[ \t]*\n?/;
/** M9 D26 — 문제 탭 문제번호: 2자리 이하 자연수 + 마침표 + 공백(1개 이상, Q23) 또는 번호 단독 행. 소수 `1.5`는 공백 조건으로 비껴간다 */
const QUESTION_NUMBER_HEAD_RE = /^\d{1,2}\.(?:[ \t]+|[ \t]*(?:\n|$))/;
const ANSWER_LINE_RE = /^정답[ \t]*[:：]?[ \t]*(?:[①-⑮]|\d{1,3})[ \t]*$/;

type Piece = { type: string | null; text: string };   // type null = 원 블록 타입을 잇는 "나머지" 조각

function splitLines(text: string): { start: number; end: number; line: string }[] {
  const out: { start: number; end: number; line: string }[] = [];
  let i = 0;
  while (i <= text.length) {
    const nl = text.indexOf('\n', i);
    const end = nl === -1 ? text.length : nl;
    out.push({ start: i, end, line: text.slice(i, end) });
    if (nl === -1) break;
    i = nl + 1;
  }
  return out;
}

/** R1 — 한 블록을 조각으로. 분할이 없으면 null */
function splitBlock(text: string): Piece[] | null {
  const lines = splitLines(text);
  // display 덩어리(①): 다행 + 다행 환경. 행 인덱스 범위로 기록
  const display: { from: number; to: number }[] = [];
  for (const r of scanMathRegions(text)) {
    if (r.kind !== 'display' || !r.closed || r.empty) continue;
    const inner = text.slice(r.innerFrom, r.innerTo);
    if (!inner.includes('\n') || !MULTILINE_ENV_RE.test(inner)) continue;
    const li = lines.findIndex((l) => l.start <= r.from && r.from <= l.end);
    const lj = lines.findIndex((l) => l.start <= r.to - 1 && r.to - 1 <= l.end);
    if (li >= 0 && lj >= 0) display.push({ from: li, to: lj });
  }
  const inDisplay = (k: number) => display.some((d) => d.from <= k && k <= d.to);

  const pieces: Piece[] = [];
  let buf: string[] = [];
  const flush = () => { if (buf.length) { pieces.push({ type: null, text: buf.join('\n') }); buf = []; } };
  let split = false;
  for (let k = 0; k < lines.length; k++) {
    const d = display.find((x) => x.from === k);
    if (d) {
      flush();
      pieces.push({ type: 'text', text: lines.slice(d.from, d.to + 1).map((l) => l.line).join('\n') });
      k = d.to; split = true;
      continue;
    }
    if (inDisplay(k)) { buf.push(lines[k].line); continue; }
    const line = lines[k].line;
    let m: RegExpMatchArray | null;
    if ((m = line.match(SUBCASE_RE))) { flush(); pieces.push({ type: 'subcase', text: m[1] }); split = true; continue; }
    if ((m = line.match(CASE_RE))) { flush(); pieces.push({ type: 'case', text: m[1] }); split = true; continue; }
    if (REF_RE.test(line) || STEP_RE.test(line) || GUIDE_RE.test(line)) { flush(); pieces.push({ type: 'heading', text: '## ' + line.trim() }); split = true; continue; }
    buf.push(line);
  }
  flush();
  return split ? pieces : null;
}

const trimBlock = (t: string) => t.replace(/^\s*\n/, '').replace(/\n\s*$/, '');

export function tidyBlocks(blocks: TidyIn[], opts: TidyOptions): { blocks: TidyOut[]; stats: TidyStats } {
  const stats: TidyStats = { split: 0, fixed: 0, removed: 0, tagConflict: 0 };
  const out: TidyOut[] = [];

  // M9 D24-1′ — 비가시·단독 초성 정규화를 가장 먼저(분할·머리 정리 정규식이 깨끗한 글자를 보도록)
  blocks = blocks.map((b) => (isInvisibleTarget(b.type) ? { ...b, raw_text: stripInvisibles(b.raw_text) } : b));

  // R0 (M9 D29) — `\section*{…}` 벗기기. 분할 앞이어야 `\section*{STEP1}`이 제목 블록으로 나뉜다
  blocks = blocks.map((b) => {
    if (!SPLITTABLE.has(b.type)) return b;
    const r = unwrapSectionCommands(b.raw_text);
    if (!r.count) return b;
    stats.fixed += r.count;
    return { ...b, raw_text: r.fixed };
  });

  // R1
  blocks.forEach((b, origin) => {
    if (!SPLITTABLE.has(b.type)) { out.push({ ...b, origin }); return; }
    const pieces = splitBlock(b.raw_text);
    if (!pieces) { out.push({ ...b, origin }); return; }
    let restSeen = false;
    const kept: TidyOut[] = [];
    for (const p of pieces) {
      if (p.type === null) {
        if (!p.text.trim()) continue;                       // 빈 나머지는 버린다
        kept.push({ type: restSeen ? 'text' : b.type, raw_text: p.text, title: restSeen ? undefined : b.title, origin });
        restSeen = true;
      } else {
        kept.push({ type: p.type, raw_text: p.text, origin });
      }
    }
    if (!kept.length) { out.push({ ...b, origin }); return; }   // 통째로 비면 그대로 1개 유지(61a 무그림 계약의 정신)
    stats.split += kept.length - 1;
    out.push(...kept);
  });

  // R2-Q (M9 D26) — 문제 탭: 첫 블록 첫 행의 문제번호만
  if (opts.tab === 'question') {
    const first = out[0];
    if (first && SPLITTABLE.has(first.type)) {
      const m = first.raw_text.match(QUESTION_NUMBER_HEAD_RE);
      if (m) { first.raw_text = first.raw_text.slice(m[0].length); stats.removed++; }
    }
  }

  // R2 (question이 아닌 탭)
  if (opts.tab !== 'question') {
    out.forEach((o, idx) => {
      if (!SPLITTABLE.has(o.type)) return;
      let text = o.raw_text;
      if (idx === 0) {
        const m = text.match(NUMBER_HEAD_RE);
        if (m) { text = text.slice(m[0].length); stats.removed++; }
      }
      const lines = text.split('\n');
      const kept = lines.filter((line, k) => {
        const eligible = idx > 0 || k > 0;                   // 탭 2행 이하
        if (eligible && ANSWER_LINE_RE.test(line)) { stats.removed++; return false; }
        return true;
      });
      o.raw_text = kept.join('\n');
    });
  }

  // R3 · R4
  // M9 Q16 — 규칙 ⑤(㉠→\tag{n})의 번호 충돌 판정은 **탭 전체**의 기존 \tag 번호로(블록마다 부르므로 블록 안만 보면 놓친다)
  const reservedTagNumbers = [...new Set(out.flatMap((o) => [...o.raw_text.matchAll(/\\tag\*?\{(\d+)\}/g)].map((x) => Number(x[1]))))];
  for (const o of out) {
    if (opts.autoFix !== false && !NO_FIX.has(o.type) && !(o.type === 'choices' && CHOICE_FIG_RE.test(o.raw_text))) {
      const r = autoFixDeterministicIssues(o.raw_text, { skipJamoRefs: o.type === 'roman' || o.type === 'choices', reservedTagNumbers });
      o.raw_text = r.fixed; stats.fixed += r.count;
      if (r.tagConflict) stats.tagConflict++;
    }
    if (SPLITTABLE.has(o.type)) o.raw_text = trimBlock(o.raw_text);
  }
  return { blocks: out, stats };
}
