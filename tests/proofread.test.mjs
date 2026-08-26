/**
 * 개선묶음 M1 스텝 2 — 결정 규칙 2종 회귀.
 *
 * 이 파일이 지키는 것:
 *   ① `\begin{tabular}`이 **GFM 표**가 되고, 셀 안 파이프가 표를 깨지 않는다(실측 규칙)
 *   ② 확신 없는 형태(`\multicolumn`·열 수 불일치)는 **손대지 않는다**
 *   ③ `(ㄱ)` → `(1)` 이 수식·코드·보기 라벨을 침범하지 않는다
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const P = await import('../.test-build/lib/proofread.js');

/* ═══ ① tabular → GFM 표 ═══ */

const TABULAR = [
  '\\begin{tabular}{|c|c|c|}',
  '\\hline',
  '$x$ & 0 & 3 \\\\',
  '\\hline',
  '$f(x)$ & 1 & 2 \\\\',
  '\\hline',
  '\\end{tabular}',
].join('\n');

test('tabular → 헤더 + :---: 정렬행 + 본문, 앞뒤 빈 줄', () => {
  const { fixed, count } = P.convertTabularToMarkdown(TABULAR);
  assert.equal(count, 1);
  assert.equal(fixed, [
    '', '',
    '| $x$ | 0 | 3 |',
    '| :---: | :---: | :---: |',
    '| $f(x)$ | 1 | 2 |',
    '', '',
  ].join('\n'));
});

test('바로 감싼 $$ 는 함께 걷어낸다 (Mathpix가 표를 수식 안에 넣는 경우)', () => {
  const { fixed, count } = P.convertTabularToMarkdown(`앞\n\n$$\n${TABULAR}\n$$\n\n뒤`);
  assert.equal(count, 1);
  assert.ok(!fixed.includes('$$'), fixed);
  assert.ok(fixed.startsWith('앞') && fixed.trimEnd().endsWith('뒤'));
});

test('중첩 중괄호 열 지정 {|p{2cm}|l|} 도 정확히 떼어낸다 (W2)', () => {
  const src = '\\begin{tabular}{|p{2cm}|l|}\na & b \\\\\nc & d\n\\end{tabular}';
  const { fixed, count } = P.convertTabularToMarkdown(src);
  assert.equal(count, 1);
  assert.ok(!fixed.includes('|l|}'), fixed);      // 쓰레기 잔재 0
  assert.ok(fixed.includes('| a | b |'), fixed);
});

test('\\multicolumn 이 있으면 손대지 않는다', () => {
  const src = '\\begin{tabular}{|c|c|}\n\\multicolumn{2}{c}{합계} \\\\\na & b\n\\end{tabular}';
  const { fixed, count } = P.convertTabularToMarkdown(src);
  assert.equal(count, 0);
  assert.equal(fixed, src);
});

test('행별 열 수가 다르면 손대지 않는다', () => {
  const src = '\\begin{tabular}{|c|c|}\na & b \\\\\nc\n\\end{tabular}';
  const { fixed, count } = P.convertTabularToMarkdown(src);
  assert.equal(count, 0);
  assert.equal(fixed, src);
});

test('\\end{tabular} 가 없으면 손대지 않는다', () => {
  const src = '\\begin{tabular}{cc}\na & b';
  assert.equal(P.convertTabularToMarkdown(src).count, 0);
});

/* ═══ ② 셀 안 파이프 — 실측 규칙(W1) ═══ */

test('수식 안 bare | 는 \\vert 로 (표 분해 방지 · 글리프 동일)', () => {
  const src = '\\begin{tabular}{cc}\n$|x|$ & b \\\\\nc & d\n\\end{tabular}';
  const { fixed } = P.convertTabularToMarkdown(src);
  assert.ok(fixed.includes('$\\vert x\\vert $'), fixed);
  assert.ok(!/\$\|/.test(fixed), fixed);
});

test('이미 \\| 인 것은 그대로 둔다 (‖ 는 이스케이프된 채로 표를 통과한다)', () => {
  const src = '\\begin{tabular}{cc}\n$\\|x\\|$ & b \\\\\nc & d\n\\end{tabular}';
  const { fixed } = P.convertTabularToMarkdown(src);
  assert.ok(fixed.includes('$\\|x\\|$'), fixed);
  assert.ok(!fixed.includes('\\\\|'), fixed);       // 이중 이스케이프는 표를 깬다
});

test('수식 밖 bare | 는 \\| 로 이스케이프', () => {
  const src = '\\begin{tabular}{cc}\na|b & c \\\\\nd & e\n\\end{tabular}';
  const { fixed } = P.convertTabularToMarkdown(src);
  assert.ok(fixed.includes('| a\\|b | c |'), fixed);
});

/* ═══ ③ (ㄱ) → (1) ═══ */

test('행머리·행중 모두 변환, 전각 괄호도 반각 숫자로', () => {
  assert.equal(P.convertJamoRefs('(ㄱ)에서 (ㄴ)은 참이다').fixed, '(1)에서 (2)은 참이다');
  assert.equal(P.convertJamoRefs('（ㄷ）만 옳다').fixed, '(3)만 옳다');
  assert.equal(P.convertJamoRefs('(ㅊ)').fixed, '(10)');
});

test('보기 라벨 `ㄱ.` 은 건드리지 않는다', () => {
  const src = 'ㄱ. 옳다\nㄴ. 그르다';
  assert.equal(P.convertJamoRefs(src).fixed, src);
});

test('코드·펜스·HTML 태그 안은 보호', () => {
  for (const src of ['`(ㄱ)` 은 코드', '```\n(ㄱ)\n```', '<img alt="(ㄱ)">']) {
    assert.equal(P.convertJamoRefs(src).fixed, src, src);
  }
});

test('수식 안도 변환한다 (덕수 2026-08-26) — 자모는 수식 기호가 아니라 라벨이다', () => {
  assert.equal(P.convertJamoRefs('$(ㄱ)$ 은 참').fixed, '$(1)$ 은 참');
  assert.equal(P.convertJamoRefs('$$\\text{(ㄴ)} = 2$$').fixed, '$$\\text{(2)} = 2$$');
  assert.equal(P.convertJamoRefs('보기 $(ㄱ), (ㄷ)$ 만').fixed, '보기 $(1), (3)$ 만');
});

test('count 는 치환 건수', () => {
  assert.equal(P.convertJamoRefs('(ㄱ) (ㄴ) (ㄷ)').count, 3);
  assert.equal(P.convertJamoRefs('없음').count, 0);
});

/* ═══ ④ 전체 파이프라인 ═══ */

test('autoFixDeterministicIssues — 표가 md가 된 뒤 셀 숫자가 수식화된다 (순서가 규칙)', () => {
  const { fixed, count } = P.autoFixDeterministicIssues(TABULAR);
  assert.ok(fixed.includes('| :---: |'), fixed);
  assert.ok(fixed.includes('$0$'), fixed);          // 셀의 맨 숫자가 수식으로
  assert.ok(count >= 1);
});

test('autoFixDeterministicIssues — skipJamoRefs 옵션', () => {
  const src = '(ㄱ)에서';
  assert.ok(P.autoFixDeterministicIssues(src).fixed.startsWith('(1)'));
  assert.equal(P.autoFixDeterministicIssues(src, { skipJamoRefs: true }).fixed, src);
});

test('autoFixDeterministicIssues — 반환 형태는 그대로 { fixed, count }', () => {
  const r = P.autoFixDeterministicIssues('평범한 문장');
  assert.equal(typeof r.fixed, 'string');
  assert.equal(typeof r.count, 'number');
});
