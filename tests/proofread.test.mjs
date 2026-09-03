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

/* ═══ ⑤ Phase 61e D15 — 텍스트 영역의 LaTeX 제어열 보호 ═══
 *
 * 없으면 `autoWrapBareLetters`가 `\includegraphics{…}`를 `\$includegraphics${…}`로 파괴한다.
 * 시트 가져오기(61e)는 그 잔재를 그대로 안고 들어오므로, 파괴되면 그림 파일명이 조각나
 * 나중에 `includegraphics`로 검색조차 되지 않는다.
 */

const FIG = '\\includegraphics{연구실모의6회(260824)_문제_1공통07_fig1.jpg}';

test('P-1 \\includegraphics 는 원형 그대로 남는다', () => {
  const { fixed, count } = P.autoFixDeterministicIssues(FIG);
  assert.equal(fixed, FIG);
  assert.equal(count, 0);
});

test('P-1b 문장 속 \\includegraphics — 주변은 고쳐도 태그는 불변', () => {
  const src = `그래프가 그림과 같다. ${FIG} 이때 $f(1)$ 의 값은?`;
  const { fixed } = P.autoFixDeterministicIssues(src);
  assert.ok(fixed.includes(FIG), fixed);            // 태그 원형 보존
  assert.ok(fixed.includes('$f(1)$의'), fixed);     // 조사 공백 제거는 여전히 동작
});

test('P-2 \\begin{itemize} · \\item 은 불변', () => {
  const src = '\\begin{itemize}\n\\item 첫째 조건\n\\item 둘째 조건\n\\end{itemize}';
  const { fixed, count } = P.autoFixDeterministicIssues(src);
  assert.equal(fixed, src);
  assert.equal(count, 0);
});

test('P-3 tabular 변환은 그대로 일어나고 뒤따르는 그림 태그만 보존된다', () => {
  const { fixed } = P.autoFixDeterministicIssues(`${TABULAR}\n\n${FIG}`);
  assert.ok(fixed.includes('| :---: |'), fixed);    // 표 변환 정상
  assert.ok(fixed.includes(FIG), fixed);            // 그림 태그 원형
});

test('P-4 `\\\\[6pt]`(행렬 행간)는 제어열로 오인되지 않는다', () => {
  const src = '$\\begin{aligned} x &= 1 \\\\[6pt] y &= 2 \\end{aligned}$';
  const { fixed } = P.autoFixDeterministicIssues(src);
  assert.ok(fixed.includes('\\\\[6pt]'), fixed);
});

test('P-5 과잉 보호 회귀 — 평범한 본문에서는 자동 수정이 여전히 일한다', () => {
  const { fixed, count } = P.autoFixDeterministicIssues('함수 f가 $x^2$ 일 때');
  assert.ok(fixed.includes('$f$'), fixed);          // 맨 영문자 수식화
  assert.ok(fixed.includes('x^{2}'), fixed);        // 지수 중괄호
  assert.ok(count >= 2);
});

test('P-6 옵션 인자 `[...]`가 붙어도 통째로 보호된다', () => {
  const src = '\\includegraphics[width=5cm]{a_fig1.jpg}';
  assert.equal(P.autoFixDeterministicIssues(src).fixed, src);
});

test('P-7 중첩 중괄호는 균형 스캔으로 흡수된다 (정규식으로 자르면 깨지는 자리)', () => {
  const src = '\\frac{\\frac{1}{2}}{3} 뒤에 텍스트 5개';
  const { fixed } = P.autoFixDeterministicIssues(src);
  assert.ok(fixed.startsWith('\\frac{\\frac{1}{2}}{3}'), fixed);
  assert.ok(fixed.includes('$5$'), fixed);          // 보호 범위 밖은 정상 처리
});

test('P-8 convertJamoRefs 는 제어열 인자 안도 계속 변환한다 (덕수 2026-08-26 사양)', () => {
  assert.equal(P.convertJamoRefs('\\text{(ㄱ)}').fixed, '\\text{(1)}');
});

/* ═══ ④ 마크다운 이미지 보호 (Phase 61e-2차 V1 회귀 고정) ═══
 *
 * `proofread.ts:342·403`의 `!?\[…\](…)` 보호가 **alt까지** 지킨다는 사실을 고정한다.
 * 이 두 건이 깨지면 시트 가져오기의 새 그림 표기(`![파일명](Drive링크)`)에서
 * **파일명 안 숫자가 `$…$`로 감싸여** 프록시 조회가 통째로 실패한다.
 * ⚠ 코드 변경 없이 처음부터 통과해야 하는 테스트다 — 계획서 v3가 "alt는 무방비"로
 *   오판했고 v4가 실행 프로브로 잡았다. 그 판정을 여기 못 박는다. */

test('P-9 마크다운 이미지의 alt는 수식화되지 않는다 (URL도 함께 보호)', () => {
  const url = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=drivesdk';
  const src = `그림과 같다. ![연구실모의6회(260824)_문제_1공통07_fig1.jpg](${url}) 이때 f(1)은?`;
  const { fixed } = P.autoFixDeterministicIssues(src);
  assert.ok(fixed.includes(`![연구실모의6회(260824)_문제_1공통07_fig1.jpg](${url})`), fixed);
  assert.ok(fixed.includes('$f$'), fixed);          // 보호 범위 밖은 정상 처리
});

test('P-10 alt 안 영문자·숫자 둘 다 보호된다 (autoWrapBareLetters 쪽도)', () => {
  const src = '![a_fig1.jpg](https://drive.google.com/file/d/1x/view)\n선택지 2개';
  const { fixed } = P.autoFixDeterministicIssues(src);
  assert.ok(fixed.includes('![a_fig1.jpg](https://drive.google.com/file/d/1x/view)'), fixed);
  assert.ok(fixed.includes('$2$개'), fixed);
});
