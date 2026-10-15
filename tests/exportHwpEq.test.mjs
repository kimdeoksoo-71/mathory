/**
 * Phase 71 — LaTeX → 한글 수식(hwpEq.ts).
 *
 * 실행: npm run test:exporthwpeq
 *
 * Q1~ : md2hwp(`md_preprocessor.py`)와 규칙이 같은 자리 — md2hwp 출력을 기대값으로(2026-10-15 맥에서 `python3 -I`로 뽑았다).
 *       단 `\sqrt[3]` 지수는 `{3}`로 감싼다(한글 수식에서 같은 뜻) · `\,`는 백틱(가는 공백 — md2hwp는 `~`).
 * D1~ : 의도한 차이(착수판 §11) · R1~ : 인용 표지 · 빈칸
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { latexToHwp, splitDisplayRows, refMark, splitRows, circleRefs } from '../.test-build/lib/export/hwpx/hwpEq.js';

const R = String.raw;
const eq = (latex) => latexToHwp(latex).script;

test('Q1 분수(중첩·dfrac) — md2hwp와 같다', () => {
  assert.equal(eq(R`\frac{1}{2}+\dfrac{a_{n+1}}{a_n}`), '{1} over {2} + {a_{n+1}} over {a_n}');
  assert.equal(eq(R`\frac{\frac{1}{2}}{3}`), '{{1} over {2}} over {3}');
  assert.equal(eq(R`25^{\frac13}`), '25^{{1} over {3}}');
});

test('Q2 근호 · 극한 · 집합 괄호 · cases — md2hwp와 같다', () => {
  assert.equal(eq(R`\sqrt{3}`), 'sqrt {3}');
  assert.equal(eq(R`\sqrt[3]{x}`), 'root {3} of {x}');
  assert.equal(eq(R`\lim_{n \to \infty} \frac{1}{n}`), 'lim _{n `->` inf} {1} over {n}');
  assert.equal(eq(R`\left\{ x \mid x > 0 \right\}`), 'left lbrace x ~ vert ~ x > 0 right rbrace');
  assert.equal(eq(R`\begin{cases} x+1 & (x<0) \\ x^2 & (x \ge 0) \end{cases}`), 'cases{x+1 & ~~ (x<0) # x^2 & ~~ (x geq 0)}');
});

test('Q3 미분 기호 — 백틱 1 + 아포스트로피 N(md2hwp 규칙)', () => {
  assert.equal(eq(R`f'(x)`), "f`'(x)");
  assert.equal(eq(R`f''(x)`), "f`''(x)");
  assert.equal(eq(R`f^{\prime\prime}(x)`), "f`''(x)");
  assert.equal(eq(R`f^\prime(x)`), "f`'(x)");
});

test('D1 명령 이름 단위 치환 — \\left\\langle의 \\le를 먹지 않는다(md2hwp는 "leq ft")', () => {
  assert.equal(eq(R`\left\langle a \right\rangle \le c`), 'left langle a right rangle leq c');
  assert.equal(eq(R`a \in A,\ b \notin B, \infty`), 'a in A, ~ b notin B, inf');
  assert.equal(eq(R`x \leftarrow y`), 'x `leftarrow` y');
});

test('D2 \\text 보호 — 따옴표 문자열, 안의 공백·기호 보존', () => {
  assert.equal(eq(R`a_n = \text{이 홀수인 경우}`), 'a_n = "이 홀수인 경우"');
  assert.equal(eq(R`\text{f'(x)는 \le}`), `"f'(x)는 \\le"`);
  // `~`는 한글 따옴표 안에서 글자로 찍힌다 → 공백(실데이터 QULUP.26FS02 26번 `\text{~또는~}`)
  assert.equal(eq(R`a \text{~또는~} b`), 'a " 또는 " b');
});

test('D3 환경 — aligned → eqalign · gathered → pile · 한 열 array → lpile/pile/rpile · 행렬 & #', () => {
  assert.equal(eq(R`\begin{aligned} a &= b \\ &= c \end{aligned}`), 'eqalign{a &= b # &= c}');
  assert.equal(eq(R`\begin{gathered} a \\ b \end{gathered}`), 'pile{a # b}');
  assert.equal(eq(R`\begin{array}{l} a \\ b \end{array}`), 'lpile{a # b}');
  assert.equal(eq(R`\begin{array}{c} a \\ b \end{array}`), 'pile{a # b}');
  assert.equal(eq(R`\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`), 'left ( matrix{1 & 2 # 3 & 4} right )');
  assert.equal(eq(R`\begin{vmatrix} a & b \\ c & d \end{vmatrix}`), 'left | matrix{a & b # c & d} right |');
  // 중첩 — 안쪽부터
  assert.equal(eq(R`\begin{cases} \begin{aligned} a \\ b \end{aligned} & x \\ c & y \end{cases}`), 'cases{eqalign{a # b} & ~~ x # c & ~~ y}');
  // cases 빈 칸 패딩(md2hwp)
  assert.equal(eq(R`\begin{cases} a & b \\ c \end{cases}`), 'cases{a & ~~ b # c & ~~}');
});

test('D4 크기 명령 삭제 · 큰 연산자 · 가는 공백', () => {
  assert.equal(eq(R`\displaystyle \sum_{k=1}^{n} k^2`), 'SUM _{k=1}^{n} k^2');
  assert.equal(eq(R`\int_0^1 f(x)\,dx`), 'INT _0^1 f(x) ` dx');
  assert.equal(eq(R`\Big( x \Big)`), '( x )');
});

test('R1 빈칸 box · 수식 안 인용 표지 → ㉠', () => {
  assert.equal(eq(R`\boxed{~\text{(가)}~}`), 'box{~"(가)"~}');
  assert.equal(eq(R`\fbox{3}`), 'box{3}');
  assert.equal(eq(R`x = \mathoryref{1} + \mathoryref{14}`), 'x = "㉠" + "㉭"');
  assert.equal(refMark('(2)'), '㉡');
  assert.equal(refMark('3'), '㉢');
  assert.equal(refMark('(가)'), '(가)');
  assert.equal(refMark('15'), '15');
});

test('R2 모르는 명령은 낱말로 남기고 알린다 · 예약어 경고(G8)', () => {
  const r = latexToHwp(R`\overset{a}{b} + pi + \pi`);
  assert.deepEqual(r.unknown, ['overset']);
  assert.deepEqual(r.reserved, ['pi']);
  assert.deepEqual(latexToHwp(R`\begin{cases} a \end{cases}`).reserved, []);
});

test('R3 splitRows는 깊이 0 \\\\만 · 꼬리 빈 행 버림', () => {
  assert.deepEqual(splitRows(R`a \\[4pt] {b \\ c} \\ `), ['a', R`{b \\ c}`]);
});

test('R3′ 여러 줄 display → 행(덕수 2026-10-15 — 정렬 없음) — aligned 계열·한 열 array · 환경 안 \\·& 보존 · & 지움 · 칸 쌍 사이 \quad', () => {
  assert.deepEqual(splitDisplayRows(R`\begin{aligned} f(x) &= a \\[2pt] &= b \\ \end{aligned}`), { rows: ['f(x) = a', '= b'] });
  // 행 안의 cases는 쪼개지 않는다
  assert.deepEqual(splitDisplayRows(R`\begin{align*} y &= \begin{cases} 1 & x>0 \\ 0 & x \le 0 \end{cases} \\ z \end{align*}`).rows, [
    R`y = \begin{cases} 1 & x>0 \\ 0 & x \le 0 \end{cases}`, 'z',
  ]);
  assert.deepEqual(splitDisplayRows(R`\begin{aligned}[t] a &= 1 & b &= 2 \end{aligned}`).rows, [R`a = 1 \quad b = 2`]);
  assert.deepEqual(splitDisplayRows(R`\begin{eqnarray} a &=& 1 \\ b &=& 2 \end{eqnarray}`).rows, ['a = 1', 'b = 2']);
  assert.deepEqual(splitDisplayRows(R`\begin{alignedat}{2} a &= 1 \\ b &= 2 \end{alignedat}`).rows, ['a = 1', 'b = 2']);
  assert.deepEqual(splitDisplayRows(R`\begin{gathered} a \\ bb \end{gathered}`), { rows: ['a', 'bb'] });
  // 한 열 array{l}도 행으로(덕수 2026-10-16 — \Rightarrow\left[ … \right. 행 포함) · 여러 열 array는 표라 그대로
  assert.deepEqual(splitDisplayRows(R`\begin{array}{l} S=1 \\ \Rightarrow\left[\begin{array}{l} a \\ b \end{array}\right. \end{array}`).rows,
    ['S=1', R`\Rightarrow\left[\begin{array}{l} a \\ b \end{array}\right.`]);
  assert.equal(splitDisplayRows(R`\begin{array}{ll} a & b \\ c & d \end{array}`), null);
  // 앞뒤 평평한 조각은 prefix·suffix로 / 행을 가로지르는 것(\left\{ · 바깥 환경 · 감싼 중괄호)이 붙으면 그대로(한 수식)
  assert.deepEqual(splitDisplayRows(R`\text { - } \begin{aligned} a &= 1 \\ &= 2 \end{aligned}.`), {
    rows: ['a = 1', '= 2'], prefix: R`\text { - }`, suffix: '.',
  });
  assert.equal(splitDisplayRows(R`\left\{ \begin{aligned} a \\ b \end{aligned} \right.`), null);
  assert.deepEqual(splitDisplayRows(R`\begin{array}{l} x \\ \begin{aligned} a \\ b \end{aligned} \end{array}`).rows, ['x', R`\begin{aligned} a \\ b \end{aligned}`]);
  assert.equal(splitDisplayRows(R`\boxed{\begin{aligned} a \\ b \end{aligned}}`), null);
  assert.equal(splitDisplayRows(R`\begin{cases} a \\ b \end{cases}`), null);
  assert.equal(splitDisplayRows(R`a + b`), null);
});

test('R5 \\left\\{ 환경 \\right. → cases(덕수 실물 2026-10-16 — S-7: 옛 left lbrace matrix right none이 깨졌다)', () => {
  assert.equal(eq(R`a_{n+1} = \left\{\begin{array}{ll} a_n+3 & (a_n \le 0) \\ \frac{1}{a_n}-3 & (a_n>0) \end{array}\right.`),
    'a_{n+1} = cases{a_n+3 & ~~ (a_n leq 0) # {1} over {a_n} -3 & ~~ (a_n>0)}');
  assert.equal(eq(R`f(x)=\left\{ \begin{aligned} -x & (x<0) \\ x & (x \geq 0) \end{aligned} \right.`),
    'f(x)= cases{-x & ~~ (x<0) # x & ~~ (x geq 0)}');
  // 한 열 array도 cases · 짝이 \right.가 아니면 그대로
  assert.equal(eq(R`\left\{\begin{array}{l} p \\ q \end{array}\right.`), 'cases{p # q}');
  assert.ok(eq(R`\left\{\begin{array}{l} p \\ q \end{array}\right\}`).includes('right rbrace'));
  assert.ok(!eq(R`\left\{\begin{array}{ll} a & b \\ c & d \end{array}\right.`).includes('none'));
});

test('R6 \\right. → 아무것도 내지 않는다(덕수 2026-10-16 — right none은 한글에서 깨진다 · left [ 만 두면 왼쪽 괄호로 묶는다)', () => {
  assert.equal(eq(R`\Rightarrow\left[\begin{array}{l} \bullet a \\ \bullet b \end{array}\right.`), '`Rightarrow` left [ lpile{bullet a # bullet b}');
  assert.equal(eq(R`\left( a+b \right.`), 'left ( a+b');
  assert.ok(!eq(R`\left[ x \right.`).includes('none'));
});

test('R7 해설 수식의 (n) → ㉠ — \\text{…(n)…}·\\because (n)만(맨 (n)은 f(2) 같은 인자라 그대로) · refs 없으면 그대로', () => {
  assert.equal(latexToHwp(R`9(\because \text { (1) })`, { refs: true }).script, '9( because " ㉠ ")');
  assert.equal(latexToHwp(R`r \neq 0 \; (\because (2))`, { refs: true }).script, 'r neq 0 ~ ( because "㉡")');
  assert.equal(latexToHwp(R`f(2)=3 \text{ (15) }`, { refs: true }).script, 'f(2)=3 " (15) "');
  assert.equal(latexToHwp(R`9(\because \text { (1) })`).script, '9( because " (1) ")');
  assert.equal(circleRefs('(1)과 (14), (15)'), '㉠과 ㉭, (15)');
});

test('R4 HWP 특수 문자 이스케이프 — \\# \\& \\_ 는 따옴표', () => {
  assert.equal(eq(R`a \# b \& c \_ d \%`), 'a "#" b "&" c "_" d %');
});
