/**
 * M7 D19 — `lib/blockTidy.ts` 회귀. 분할(R1) · 머리 정리(R2) · 정형화 경유(R3) · trim(R4) · origin 매핑을 고정한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { tidyBlocks } = await import('../.test-build/lib/blockTidy.js');
const T = (raw, tab = 'solution', type = 'text', autoFix = false) =>
  tidyBlocks([{ type, raw_text: raw }], { tab, autoFix });
const shape = (r) => r.blocks.map((b) => `${b.type}:${JSON.stringify(b.raw_text)}`);

/* ═══ R1 분할 ═══ */
test('R1 ②③ 경우·하위 경우 문장만 떼고 본문은 text로', () => {
  const r = T('서론\n(i) $a>0$ 인 경우\n본문1\n(i-1) $b>0$인 경우:\n본문2\n(ii) $a<0$ 인 경우.\n본문3', 'question');
  assert.deepEqual(shape(r), [
    'text:"서론"', 'case:"$a>0$ 인 경우"', 'text:"본문1"', 'subcase:"$b>0$인 경우"',
    'text:"본문2"', 'case:"$a<0$ 인 경우"', 'text:"본문3"',
  ]);
  assert.equal(r.stats.split, 6);
  assert.ok(r.blocks.every((b) => b.origin === 0));
});

test('R1 ③ `(i)-1` 꼴도 하위 경우', () => {
  assert.deepEqual(shape(T('(i)-1 x인 경우\n뒤', 'question')), ['subcase:"x인 경우"', 'text:"뒤"']);
});

test('R1 ④⑤ [참고]·STEP 행은 제목 블록(표지 보존)', () => {
  assert.deepEqual(shape(T('앞\n[참고] 극한의 성질\n뒤\nSTEP3 정수 $a$의 값 구하기\n끝', 'question')),
    ['text:"앞"', 'heading:"## [참고] 극한의 성질"', 'text:"뒤"', 'heading:"## STEP3 정수 $a$의 값 구하기"', 'text:"끝"']);
});

test('R1 ① \\begin 환경이 든 다행 display만 자기 블록으로 — 한 줄·환경 없는 다행은 유지', () => {
  const r = T('앞\n$$\n\\begin{aligned}\na&=1\\\\\nb&=2\n\\end{aligned}\n$$\n중간\n$$\nx=1\n$$\n$$y=2$$\n끝', 'question');
  assert.deepEqual(shape(r), [
    'text:"앞"', 'text:"$$\\n\\\\begin{aligned}\\na&=1\\\\\\\\\\nb&=2\\n\\\\end{aligned}\\n$$"',
    'text:"중간\\n$$\\nx=1\\n$$\\n$$y=2$$\\n끝"',
  ]);
});

test('R1: display 안의 `(i) … 인 경우` 행은 경우로 떼지 않는다', () => {
  const r = T('$$\n\\begin{cases}\n(i) x인 경우\\\\\n\\end{cases}\n$$', 'question');
  assert.equal(r.blocks.length, 1);
});

test('R1: 첫 나머지 조각은 원 타입 유지, 이후는 text · title은 첫 조각만', () => {
  const r = tidyBlocks([{ type: 'callout', raw_text: '가\n(i) a인 경우\n나', title: '제목' }], { tab: 'question', autoFix: false });
  assert.deepEqual(r.blocks.map((b) => [b.type, b.title ?? null]), [['callout', '제목'], ['case', null], ['text', null]]);
});

test('R1: choices·image는 무접촉', () => {
  const r = tidyBlocks([{ type: 'choices', raw_text: '① (i) a인 경우' }, { type: 'image', raw_text: '' }], { tab: 'question', autoFix: false });
  assert.equal(r.blocks.length, 2); assert.equal(r.stats.split, 0);
});

test('R1: 분할 없으면 블록 그대로 · 빈 블록도 1개 유지', () => {
  assert.deepEqual(shape(T('그냥 본문', 'question')), ['text:"그냥 본문"']);
  assert.deepEqual(shape(T('', 'question')), ['text:""']);
});

/* ═══ R2 머리 정리 ═══ */
test('R2: 풀이 탭 첫 블록 첫 행의 `15.` 제거', () => {
  assert.deepEqual(shape(T('15. 풀이 시작\n둘째')), ['text:"풀이 시작\\n둘째"']);
  assert.deepEqual(shape(T('15.\n풀이')), ['text:"풀이"']);
});

/* ═══ M9 I — 블록 정돈 조정(D26~D30) ═══ */

test('M9 D26: 문제 탭 첫 블록 첫 행의 문제번호 제거(공백 1개 이상·번호 단독 행) · 소수·둘째 블록 무접촉', () => {
  assert.deepEqual(shape(T('15. 함수 $f(x)$에 대하여', 'question')), ['text:"함수 $f(x)$에 대하여"']);
  assert.deepEqual(shape(T('7.  다음 중', 'question')), ['text:"다음 중"']);
  assert.deepEqual(shape(T('15.\n본문', 'question')), ['text:"본문"']);
  assert.deepEqual(shape(T('1.5배가 된다', 'question')), ['text:"1.5배가 된다"']);
  assert.deepEqual(shape(T('정답 ③\n본문', 'question')), ['text:"정답 ③\\n본문"']);   // 정답 행 규칙은 문제 탭에 없다
  const r = tidyBlocks([{ type: 'text', raw_text: '본문' }, { type: 'text', raw_text: '3. 둘째' }], { tab: 'question', autoFix: false });
  assert.deepEqual(shape(r), ['text:"본문"', 'text:"3. 둘째"']);
});

test('M9 D29·D30: \\section*{…} 벗기기가 분할 앞이라 STEP·GUIDE 제목 블록이 한 번에 생긴다', () => {
  assert.deepEqual(shape(T('\\section*{STEP1}\n본문')), ['heading:"## STEP1"', 'text:"본문"']);
  assert.deepEqual(shape(T('\\section*{GUIDE}\n풀이 방향')), ['heading:"## GUIDE"', 'text:"풀이 방향"']);
  assert.deepEqual(shape(T('\\subsection{개념}\n본문')), ['text:"개념\\n본문"']);
});

test('M9 D28·D30: GUIDE 행은 제목 블록 · STEP·GUIDE는 수식화되지 않는다(autoFix 켬)', () => {
  assert.deepEqual(shape(T('GUIDE 함수의 증가 감소를 조사한다.\n본문', 'solution', 'text', true)),
    ['heading:"## GUIDE 함수의 증가 감소를 조사한다."', 'text:"본문"']);
  assert.deepEqual(shape(T('STEP 2 극값 구하기', 'solution', 'text', true)), ['heading:"## STEP 2 극값 구하기"']);
  assert.deepEqual(shape(T('GUIDES와 GUIDE는 다르다', 'solution', 'text', false)), ['text:"GUIDES와 GUIDE는 다르다"']);
});

test('R2: 2행 이하의 `정답 ③`·`정답: 56` 행 삭제 · 첫 행은 남긴다 · 문장 속 정답은 무접촉', () => {
  const r = T('풀이\n정답 ③\n따라서 정답: 56\n정답: 56\n끝');
  assert.deepEqual(shape(r), ['text:"풀이\\n따라서 정답: 56\\n끝"']);
  assert.equal(r.stats.removed, 2);
  assert.deepEqual(shape(T('정답 ③\n풀이')), ['text:"정답 ③\\n풀이"']);
});

test('R2: extra 탭도 solution과 같다(P14) · 둘째 블록의 첫 행도 정답이면 삭제', () => {
  const r = tidyBlocks([{ type: 'text', raw_text: '7. 앞' }, { type: 'text', raw_text: '정답 12\n뒤' }], { tab: 'extra', autoFix: false });
  assert.deepEqual(shape(r), ['text:"앞"', 'text:"뒤"']);
});

/* ═══ R3 · R4 ═══ */
test('R3: autoFix 경유(맨 숫자 수식화 · ⇒) · 그림 든 choices는 제외', () => {
  const r = tidyBlocks([
    { type: 'text', raw_text: '$\\Rightarrow x=1$이므로 2개' },
    { type: 'choices', raw_text: '① \\includegraphics{a_fig1.jpg} 2' },
  ], { tab: 'question' });
  assert.equal(r.blocks[0].raw_text, '⇒ $x=1$이므로 $2$개');
  assert.equal(r.blocks[1].raw_text, '① \\includegraphics{a_fig1.jpg} 2');
  assert.ok(r.stats.fixed >= 2);
});

test('R4: 앞뒤 빈 줄 trim(저장 정규화와 동일)', () => {
  assert.deepEqual(shape(T('\n\n본문\n\n', 'question')), ['text:"본문"']);
});

test('origin: 여러 입력 블록의 조각이 각자 입력 인덱스를 가리킨다', () => {
  const r = tidyBlocks([{ type: 'text', raw_text: 'a\n(i) b인 경우' }, { type: 'text', raw_text: 'c' }], { tab: 'question', autoFix: false });
  assert.deepEqual(r.blocks.map((b) => b.origin), [0, 0, 1]);
});

test('M9 D24-1′: 정돈은 단독 초성 U+1100을 호환 자모로 먼저 정규화한다(roman 첫 행)', () => {
  const r = tidyBlocks([{ type: 'roman', raw_text: '\u1100. $t=1$이면\n\u1102. 둘째' }], { tab: 'question' });
  assert.equal(r.blocks[0].raw_text, 'ㄱ. $t=1$이면\nㄴ. 둘째');
});
