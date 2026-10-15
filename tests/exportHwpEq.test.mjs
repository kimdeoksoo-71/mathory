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
import { latexToHwp, rowsToHwp, refMark, splitRows } from '../.test-build/lib/export/hwpx/hwpEq.js';

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

test('R3 rows → lpile · splitRows는 깊이 0 \\\\만 · 꼬리 빈 행 버림', () => {
  assert.equal(rowsToHwp(['a=1', 'b=\\frac{1}{2}']).script, 'lpile{a=1 # b= {1} over {2}}');
  assert.deepEqual(splitRows(R`a \\[4pt] {b \\ c} \\ `), ['a', R`{b \\ c}`]);
});

test('R4 HWP 특수 문자 이스케이프 — \\# \\& \\_ 는 따옴표', () => {
  assert.equal(eq(R`a \# b \& c \_ d \%`), 'a "#" b "&" c "_" d %');
});
