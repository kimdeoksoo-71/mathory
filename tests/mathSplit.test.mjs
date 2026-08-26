/**
 * 개선묶음 M1 스텝 1 — 수식행 분할 회귀.
 *
 * 이 파일이 지키는 것:
 *   ① 쪼개면 의미가 깨지는 환경(cases·matrix·표 array)은 **건드리지 않는다**
 *   ② 해석하지 못한 형태는 **반쪽 결과를 내지 않는다**(쓰레기 잔재 0)
 *   ③ `\tag`는 `$…$` 밖으로 나간다 — 인라인 모드 `\tag`는 KaTeX 오류다
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../.test-build/lib/mathSplit.js');

/** `$$` 안에 body를 넣고 커서를 그 안에 둔 채 분할한다 */
const split = (body, before = '', after = '') => {
  const content = `${before}$$\n${body}\n$$${after}`;
  return M.splitDisplayMathToRows(content, before.length + 4);
};

/* ═══ ① 정상 분할 ═══ */

test('aligned 3행 — & 제거, 행마다 인라인 수식', () => {
  const r = split('\\begin{aligned}\na &= b \\\\[4pt]\nc &= d \\\\\ne &= f\n\\end{aligned}');
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$a = b$', '$c = d$', '$e = f$']);
});

test('환경 없는 다행 — \\\\ 만으로 분할', () => {
  const r = split('x = 1 \\\\ y = 2');
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$x = 1$', '$y = 2$']);
});

test('array{ll} — 태그만 제거하고 분할 (M1 D4″)', () => {
  const r = split('\\begin{array}{ll}\na &= b \\\\\nc &= d\n\\end{array}');
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$a = b$', '$c = d$']);
});

test('이스케이프된 \\& 는 보존된다', () => {
  const r = split('A \\& B \\\\ C \\& D');
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$A \\& B$', '$C \\& D$']);
});

/* ═══ ② 차단·실패 — 반쪽 결과 금지 ═══ */

test('cases / pmatrix 는 차단', () => {
  for (const env of ['cases', 'pmatrix', 'bmatrix', 'gathered', 'split']) {
    const r = split(`\\begin{${env}} a \\\\ b \\end{${env}}`);
    assert.equal(r.ok, false, env);
    assert.match(r.reason, /cases \/ matrix/);
  }
});

test('표 형태의 array(\\hline)는 차단', () => {
  const r = split('\\begin{array}{|c|c|}\n\\hline\na & b \\\\\nc & d\n\\end{array}');
  assert.equal(r.ok, false);
  assert.match(r.reason, /hline/);
});

test('중첩 중괄호 열 지정 p{2cm} — 해석 실패로 물러난다 (W2)', () => {
  // ⚠ 정규식 \{[^}]*\} 로 자르면 `\begin{array}{|p{2cm}` 까지만 먹고 `|l|}` 가 본문에 남는다.
  //   그 잔재가 결과에 섞이지 않는지가 이 테스트의 요점이다.
  const r = split('\\begin{array}{|p{2cm}|l|}\na & b \\\\\nc & d\n\\end{array}');
  assert.equal(r.ok, true);                       // 균형 스캔이 성공적으로 떼어낸다
  // `&`를 지운 자리에 공백이 남는 것은 기존 동작이다(LaTeX 렌더 결과는 동일). 요점은 `|l|}` 잔재가 없는 것
  assert.deepEqual(r.rows, ['$a  b$', '$c  d$']);
});

test('열 지정이 닫히지 않으면 실패 (반쪽 분할 금지)', () => {
  const r = split('\\begin{array}{|p{2cm\na & b \\\\\nc & d\n\\end{array}');
  assert.equal(r.ok, false);
  assert.match(r.reason, /열 지정/);
});

test('행이 하나뿐이면 실패', () => {
  const r = split('x = 1');
  assert.equal(r.ok, false);
  assert.match(r.reason, /2개 이상/);
});

test('커서가 $$ 밖이면 실패', () => {
  const content = 'before\n\n$$\nx \\\\ y\n$$';
  const r = M.splitDisplayMathToRows(content, 2);
  assert.equal(r.ok, false);
  assert.match(r.reason, /커서/);
});

/* ═══ ③ \tag — 인라인 모드 금지 (D2) ═══ */

test('행 안 \\tag 는 $…$ 밖으로 나간다', () => {
  const r = split('x = 1 \\tag{3} \\\\ y = 2');
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$x = 1$ \\tag{3}', '$y = 2$']);
});

test('한 행에 \\tag 가 둘이면 실패', () => {
  const r = split('x \\tag{1} \\tag{2} \\\\ y');
  assert.equal(r.ok, false);
  assert.match(r.reason, /tag/);
});

test('\\tag 만 있는 행은 실패', () => {
  const r = split('\\tag{1} \\\\ y = 2');
  assert.equal(r.ok, false);
});

/* ═══ ④ before / after 보존 ═══ */

test('앞뒤 원문이 그대로 실려 온다', () => {
  const r = split('x \\\\ y', '앞 문장\n\n', '\n\n뒤 문장');
  assert.equal(r.ok, true);
  assert.equal(r.before, '앞 문장\n\n');
  assert.equal(r.after, '\n\n뒤 문장');
});

test('앞이 비면 before 가 빈 문자열 (호출부의 자기 타입 변경 조건)', () => {
  const r = split('x \\\\ y');
  assert.equal(r.ok, true);
  assert.equal(r.before, '');
  assert.equal(r.after, '');
});

/* ═══ ⑤ 알려진 한계를 고정한다 (M1 D22) ═══ */

test('findEnclosingDisplayMath 는 인라인 $ 를 구분하지 못한다 — 현 동작 고정', () => {
  // `$a$ ... $b$` 의 첫 두 `$`는 `$$`가 아니므로 스캔이 건너뛰고, 이어지는 `$$`만 본다.
  // 이번 묶음에서 고치지 않기로 한 한계다 — 바뀌면 이 테스트가 먼저 깨진다.
  const content = 'x $a$ y\n\n$$\np \\\\ q\n$$';
  const r = M.splitDisplayMathToRows(content, content.indexOf('p'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, ['$p$', '$q$']);
});
