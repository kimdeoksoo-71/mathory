/**
 * Phase 61a 검증 — 시트 행 → 문항 초안 변환.
 *
 * 실행: npm run test:sheet
 * (lib/sheetImport.ts를 tsc로 뽑아 Node에서 직접 돌린다. test:locale 하니스와 동일 방식)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHEET_COL, SHEET_COL_COUNT, EXPECTED_HEADERS,
  parseRowInput, checkHeaders, normalizeText, rowToDraft, isDraftError, stemHash,
} from '../.test-build/lib/sheetImport.js';

/** 16칸 셀 배열을 만든다. `{ id: 'x', problem_stem: 'y' }` 형태로 지정. */
const cells = (o = {}) => {
  const a = Array(SHEET_COL_COUNT).fill('');
  for (const [k, v] of Object.entries(o)) a[SHEET_COL[k]] = v;
  return a;
};
const mkRow = (o = {}, rowIndex = 2) => ({ rowIndex, cells: cells(o) });
const draft = (o = {}, rowIndex = 2) => {
  const d = rowToDraft(mkRow(o, rowIndex));
  assert.ok(!isDraftError(d), `초안이 아니라 오류가 나왔다: ${d.error}`);
  return d;
};

/* ═══ R — 행 범위 파서 (GAS parseRowInput_와 동일 의미론) ═══ */

test('R1 쉼표·범위·중복·정렬', () => {
  assert.deepEqual(parseRowInput('15, 17, 20-22'), [15, 17, 20, 21, 22]);
  assert.deepEqual(parseRowInput('3,1,2'), [1, 2, 3]);
  assert.deepEqual(parseRowInput('5-7, 6-8'), [5, 6, 7, 8]);       // 중복 제거
});

test('R2 역순 범위도 흡수한다 (GAS Math.min/max)', () => {
  assert.deepEqual(parseRowInput('15-10'), [10, 11, 12, 13, 14, 15]);
});

test('R3 빈 입력·쓰레기 입력은 조용히 걸러진다', () => {
  assert.deepEqual(parseRowInput(''), []);
  assert.deepEqual(parseRowInput('  '), []);
  assert.deepEqual(parseRowInput('abc, 3, 1.5'), [3]);             // 정수만
  assert.deepEqual(parseRowInput(null), []);
});

/* ═══ N — 텍스트 정규화 ═══ */

test('N1 (C6) `\\\\[6pt]`는 절대 건드리지 않는다 — 뒤돌아보기 가드', () => {
  const src = '$$\\begin{array}{l}a\\\\[6pt]b\\end{array}$$';
  assert.equal(normalizeText(src).text, src);
});

test('N2 LaTeX 구분자 변환', () => {
  assert.equal(normalizeText('\\(x+1\\)').text, '$x+1$');
  assert.equal(normalizeText('\\[x=1\\]').text, '$$x=1$$');
});

test('N3 CRLF·연속 빈 줄·앞뒤 공백', () => {
  assert.equal(normalizeText('a\r\nb').text, 'a\nb');
  assert.equal(normalizeText('a\n\n\n\n\nb').text, 'a\n\nb');
  assert.equal(normalizeText('\n\n  a  \n\n').text, 'a');
});

test('N4 `$` 홀수는 고치지 않고 경고만 낸다', () => {
  const r = normalizeText('값은 $x 이다');
  assert.equal(r.text, '값은 $x 이다');                            // 원문 보존
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /홀수/);
  assert.equal(normalizeText('값은 $x$ 이다').warnings.length, 0);
});

test('N5 이스케이프된 `\\$`는 개수 판정에서 빠진다', () => {
  assert.equal(normalizeText('가격 \\$5').warnings.length, 0);
});

/* ═══ H — 헤더 대조 (2026-08-22 실측 헤더) ═══ */

const REAL_HEADER = [
  'id', 'problem', 'given_solution', 'given_answer', 'problem_stem',
  'choice1', 'choice2', 'choice3', 'choice4', 'choice5',
  'answer_type', '', 'get', 'problem_verdict', 'derived_answer', 'sloution_note',
];

test('H1 실측 헤더는 경고 0건', () => {
  assert.deepEqual(checkHeaders(REAL_HEADER), []);
});

test('H2 P열 오타 `sloution_note`가 기대값이다 (고쳐지면 경고)', () => {
  assert.equal(EXPECTED_HEADERS.solution_note, 'sloution_note');
  const fixed = [...REAL_HEADER];
  fixed[SHEET_COL.solution_note] = 'solution_note';
  assert.equal(checkHeaders(fixed).length, 1);
});

test('H3 열이 밀리면 여러 건이 한꺼번에 걸린다', () => {
  const shifted = ['', ...REAL_HEADER].slice(0, SHEET_COL_COUNT);
  assert.ok(checkHeaders(shifted).length >= 5);
});

/* ═══ D — 행 → 초안 ═══ */

test('D1 5지선다 전형: 문제 2블록 · 풀이 1블록 · AI풀이 2블록', () => {
  const d = draft({
    id: 'SET_1공통01', given_solution: '풀이다', given_answer: '3', problem_stem: '문제다',
    choice1: '1', choice2: '2', choice3: '3', choice4: '4', choice5: '5',
    derived_answer: '3', solution_note: 'AI 풀이다',
  });
  assert.equal(d.title, 'SET_1공통01');
  assert.equal(d.source, 'SET_1공통01');           // D4 — A열이 곧 출처
  assert.equal(d.answer, '3');
  assert.deepEqual(d.tabs.map((t) => t.id), ['question', 'solution', 'extra_0']);
  assert.deepEqual(d.blocksByTab.question.map((b) => b.type), ['text', 'choices']);
  assert.equal(d.blocksByTab.question[1].raw_text, '① 1\n② 2\n③ 3\n④ 4\n⑤ 5');
  assert.equal(d.blocksByTab.solution.length, 1);
  assert.equal(d.blocksByTab.extra_0.length, 2);
  assert.equal(d.warnings.length, 0);
});

test('D2 단답형(F~J 전부 빈칸)은 choices 블록을 만들지 않는다', () => {
  const d = draft({ id: 'X', problem_stem: '문제', given_solution: '풀이' });
  assert.deepEqual(d.blocksByTab.question.map((b) => b.type), ['text']);
});

test('D3 (D10) O열 앞에만 `**AI 정답:** ` 접두 — P열은 원문 그대로', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's', derived_answer: '7', solution_note: '왜냐하면' });
  assert.equal(d.blocksByTab.extra_0[0].raw_text, '**AI 정답:** 7');
  assert.equal(d.blocksByTab.extra_0[1].raw_text, '왜냐하면');
});

test('D4 O·P가 모두 비면 AI풀이 탭 자체를 만들지 않는다', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's' });
  assert.deepEqual(d.tabs.map((t) => t.id), ['question', 'solution']);
  assert.equal(d.blocksByTab.extra_0, undefined);
});

test('D5 O만 있어도 탭이 생기고 블록은 1개다', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's', derived_answer: '7' });
  assert.equal(d.blocksByTab.extra_0.length, 1);
  assert.equal(d.blocksByTab.extra_0[0].raw_text, '**AI 정답:** 7');
});

test('D6 선택지 라벨이 건너뛰면 원래 라벨을 지키고 경고한다', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's', choice1: 'a', choice3: 'c', choice4: 'd' });
  assert.equal(d.blocksByTab.question[1].raw_text, '① a\n③ c\n④ d');
  assert.ok(d.warnings.some((w) => /건너뜁니다/.test(w)));
});

test('D7 C·E가 비면 빈 블록을 두고 경고한다 (AppShell 신규 문항 관례)', () => {
  const d = draft({ id: 'X' });
  assert.equal(d.blocksByTab.question[0].raw_text, '');
  assert.equal(d.blocksByTab.solution[0].raw_text, '');
  assert.equal(d.warnings.length, 2);
});

test('D8 A열이 비면 초안이 아니라 오류 행이다', () => {
  const e = rowToDraft(mkRow({ problem_stem: '문제만 있음' }, 42));
  assert.ok(isDraftError(e));
  assert.equal(e.rowIndex, 42);
});

test('D9 블록에 order 필드를 두지 않는다 (Y3 — 순서는 배열이 소유)', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's' });
  for (const blocks of Object.values(d.blocksByTab))
    for (const b of blocks) assert.deepEqual(Object.keys(b).sort(), ['raw_text', 'type']);
});

test('D10 정규화가 본문·선택지·AI풀이 전부에 걸린다', () => {
  const d = draft({ id: 'X', problem_stem: '\\(a\\)', given_solution: '\\[b\\]', choice1: '\\(c\\)', solution_note: '\\(d\\)' });
  assert.equal(d.blocksByTab.question[0].raw_text, '$a$');
  assert.equal(d.blocksByTab.question[1].raw_text, '① $c$');
  assert.equal(d.blocksByTab.solution[0].raw_text, '$$b$$');
  assert.equal(d.blocksByTab.extra_0[0].raw_text, '$d$');
});

test('D11 경고에 열 이름이 붙어 어느 칸이 문제인지 알 수 있다', () => {
  const d = draft({ id: 'X', problem_stem: '$x', given_solution: 's' });
  assert.ok(d.warnings.some((w) => /^E열:/.test(w)));
});

test('D12 ragged row(짧은 배열)가 와도 터지지 않는다', () => {
  const d = rowToDraft({ rowIndex: 5, cells: ['ONLY_ID'] });
  assert.ok(!isDraftError(d));
  assert.equal(d.blocksByTab.solution[0].raw_text, '');
});

/* ═══ S — 본문 해시 (중복 판정 보조 키) ═══ */

test('S1 같은 본문은 같은 해시, 다른 본문은 다른 해시', () => {
  assert.equal(stemHash('문제 본문'), stemHash('문제 본문'));
  assert.notEqual(stemHash('문제 본문'), stemHash('문제 본문!'));
});

test('S2 실측 시나리오: id가 같아도 본문이 다르면 별개 문항으로 갈린다', () => {
  const a = draft({ id: 'VERI.26써킷01.초고_1공통09', problem_stem: '원본 문제', given_solution: 's' });
  const b = draft({ id: 'VERI.26써킷01.초고_1공통09', problem_stem: '개정된 문제', given_solution: 's' });
  assert.equal(a.sourceId, b.sourceId);
  assert.notEqual(a.stemHash, b.stemHash);          // → 중복이 아니다
});

test('S3 Data_DS→Stack 이동(행번호만 변경)은 여전히 중복으로 잡힌다', () => {
  const cells = { id: 'SET_01', problem_stem: '같은 문제', given_solution: 's' };
  const inDs = draft(cells, 5);
  const inStack = draft(cells, 1801);
  assert.equal(inDs.sourceId, inStack.sourceId);
  assert.equal(inDs.stemHash, inStack.stemHash);    // → 중복이다
});

test('S4 CRLF·앞뒤 공백 차이로는 해시가 갈리지 않는다 (정규화 후 해시)', () => {
  const a = draft({ id: 'X', problem_stem: '  줄1\r\n줄2  ', given_solution: 's' });
  const b = draft({ id: 'X', problem_stem: '줄1\n줄2', given_solution: 's' });
  assert.equal(a.stemHash, b.stemHash);
});

test('S5 해시는 문자열이고 비어 있지 않다 (본문이 비어도)', () => {
  const d = draft({ id: 'X' });
  assert.equal(typeof d.stemHash, 'string');
  assert.ok(d.stemHash.length > 0);
});

test('S6 answer는 D열만 쓴다 — O열이 있어도 채우지 않는다', () => {
  const d = draft({ id: 'X', problem_stem: 'q', given_solution: 's', derived_answer: '7' });
  assert.equal(d.answer, '');
  assert.equal(d.blocksByTab.extra_0[0].raw_text, '**AI 정답:** 7');
});
