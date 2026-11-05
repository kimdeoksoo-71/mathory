/**
 * M7 D19 — `lib/blockTidy.ts` 회귀. 분할(R1) · 머리 정리(R2) · 정형화 경유(R3) · trim(R4) · origin 매핑을 고정한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { tidyBlocks, preserveSourceLineBreaks } = await import('../.test-build/lib/blockTidy.js');
const { hardBreakKinds } = await import('../.test-build/lib/proofread.js');
// R6(원본 줄바꿈, 2026-11-05)은 기본 켬 — 기존 회귀 표본은 R6을 끄고 본다. R6 표본은 T6(기본 = 켬)
const T = (raw, tab = 'solution', type = 'text', autoFix = false) =>
  tidyBlocks([{ type, raw_text: raw }], { tab, autoFix, lineBreaks: false });
const T6 = (raw, tab = 'solution', type = 'text', autoFix = false) =>
  tidyBlocks([{ type, raw_text: raw }], { tab, autoFix });
const shape = (r) => r.blocks.map((b) => `${b.type}:${JSON.stringify(b.raw_text)}`);

/* ═══ R5 행 환경 레이아웃 (Phase 68 D17) ═══ */
test('R5: 펜스형 $$ 안 한 줄 aligned → \\begin·\\end 자기 줄 + 행 분리 + 2칸 들여쓰기 · stats.fixed · 멱등', () => {
  const r = T('앞\n\n$$\n\\begin{aligned}a&=1\\\\b&=2\\end{aligned}\n$$\n\n뒤');
  // R1 ①이 display를 먼저 자기 블록으로 떼고, 그 조각이 R5를 받는다
  assert.deepEqual(shape(r), [ 'text:"앞"', 'text:"$$\\n\\\\begin{aligned}\\n  a&=1 \\\\\\\\\\n  b&=2\\n\\\\end{aligned}\\n$$"', 'text:"뒤"' ]);
  assert.equal(r.stats.fixed, 1);
  const again = tidyBlocks(r.blocks.map((b) => ({ type: b.type, raw_text: b.raw_text })), { tab: 'solution', autoFix: false });
  assert.deepEqual(shape(again), shape(r));
  assert.equal(again.stats.fixed, 0);
});

test('R5: 한 줄 $$…$$·인라인·(c) 형태는 무접촉 · autoFix 켬에서도 돈다 · choices 무접촉', () => {
  for (const raw of ['$$\\begin{aligned}a\\\\b\\end{aligned}$$', '본문 $\\begin{cases}a\\\\b\\end{cases}$', '$$\\begin{aligned}\na\\\\b\n\\end{aligned}$$']) {
    const r = T(raw);
    assert.deepEqual(shape(r), [`text:${JSON.stringify(raw)}`], raw);
    assert.equal(r.stats.fixed, 0);
  }
  const on = T('$$\n\\begin{cases}a\\\\b\\end{cases}\n$$', 'solution', 'text', true);
  assert.deepEqual(shape(on), ['text:"$$\\n\\\\begin{cases}\\n  a \\\\\\\\\\n  b\\n\\\\end{cases}\\n$$"']);
  const ch = T('$$\n\\begin{cases}a\\\\b\\end{cases}\n$$', 'solution', 'choices');
  assert.equal(ch.stats.fixed, 0);
});

test('R5: R1 ①로 떼어 낸 display 조각도 레이아웃을 받는다 · ROW_ENV_RE라 align*도 R1 ① 대상', () => {
  const r = T('앞\n$$\n\\begin{align*}a&=1\\\\\nb&=2\\end{align*}\n$$\n뒤', 'question');
  assert.deepEqual(shape(r), [
    'text:"앞"',
    'text:"$$\\n\\\\begin{align*}\\n  a&=1 \\\\\\\\\\n  b&=2\\n\\\\end{align*}\\n$$"',
    'text:"뒤"',
  ]);
});

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

test('R1 ① \\begin 환경이 든 다행 display만 자기 블록으로 — 한 줄·환경 없는 다행은 유지 (조각은 R5 레이아웃을 받는다)', () => {
  const r = T('앞\n$$\n\\begin{aligned}\na&=1\\\\\nb&=2\n\\end{aligned}\n$$\n중간\n$$\nx=1\n$$\n$$y=2$$\n끝', 'question');
  assert.deepEqual(shape(r), [
    'text:"앞"', 'text:"$$\\n\\\\begin{aligned}\\n  a&=1 \\\\\\\\\\n  b&=2\\n\\\\end{aligned}\\n$$"',
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

test('R4(M10 P26): case·subcase 이어짓기의 빈 첫 줄은 하나 남긴다 — 정돈이 이어짓기를 제목 있는 경우로 바꾸지 않는다', () => {
  assert.deepEqual(shape(T('\n\n본문\n\n', 'solution', 'case')), ['case:"\\n본문"']);
  assert.deepEqual(shape(T('\n본문', 'solution', 'subcase')), ['subcase:"\\n본문"']);
  assert.deepEqual(shape(T('조건\n본문\n\n', 'solution', 'case')), ['case:"조건\\n본문"']);
});

/* ═══ R0b itemize 벗기기 (M10 D24 → 2026-11-05 개정: 라벨·번호·글머리 없이 내용만 · 항목 경계는 hard break) ═══ */
test('R0b: 환경 줄 삭제 · 내용 앞 마커는 남는다(마커 줄 사이는 렌더가 가른다) · 비마커 항목은 글머리 없이 hard break', () => {
  assert.deepEqual(shape(T('\\begin{itemize}\n\\item ㄱ. 첫째\n\\item ㄴ. 둘째\n\\end{itemize}')), ['text:"ㄱ. 첫째\\nㄴ. 둘째"']);
  assert.deepEqual(shape(T('\\begin{itemize}\n\\item 첫째 조건\n\\item 둘째 조건\n\\end{itemize}')), ['text:"첫째 조건  \\n둘째 조건"']);
});
test('R0b: 라벨은 무엇이든 버린다 — \\item[] · (1) · - · $\\bullet$ · (가) · description 용어', () => {
  assert.deepEqual(shape(T('\\begin{itemize}\n\\item[] ① a\n\\item[(가)] b\n\\item[(1)] c\n\\end{itemize}')), ['text:"① a  \\nb  \\nc"']);
  assert.deepEqual(shape(T('\\begin{itemize}\n\\item[-] a\n\\item[$\\bullet$] b\n\\end{itemize}')), ['text:"a  \\nb"']);
  assert.deepEqual(shape(T('\\begin{description}\n\\item[용어] 정의\n\\end{description}')), ['text:"정의"']);
});
test('R0b: enumerate도 번호를 만들지 않는다 — 문제·풀이 탭 모두', () => {
  for (const tab of ['question', 'solution']) {
    assert.deepEqual(shape(T('\\begin{enumerate}\n\\item a\n\\item b\n\\end{enumerate}', tab)), ['text:"a  \\nb"'], tab);
  }
  assert.deepEqual(shape(T('\\begin{enumerate}[label=(\\arabic*)]\n\\item a\n\\end{enumerate}')), ['text:"a"']);
});
test('R0b: 앞 문장↔첫 항목 · 마지막 항목↔뒤 문장도 가른다(환경 줄 삭제 자리) · R6을 꺼도 R0b는 가른다', () => {
  assert.deepEqual(shape(T('다음 조건을 만족시킨다.\n\\begin{itemize}\n\\item[(가)] a\n\\item b\n\\end{itemize}\n그러므로')),
    ['text:"다음 조건을 만족시킨다.  \\na  \\nb  \\n그러므로"']);
});
test('R0b: 한 줄 출력(Mathpix)도 줄을 갈라 처리 · 앞뒤 본문 보존', () => {
  assert.deepEqual(shape(T('다음 중 옳은 것은? \\begin{itemize}\\item ㄱ. a \\item ㄴ. b\\end{itemize} 뒤')), ['text:"다음 중 옳은 것은?\\nㄱ. a\\nㄴ. b  \\n뒤"']);
});
test('R0b: \\tag 줄은 빈 줄로 단독 문단 — 앞 줄이 이미 두 칸이어도(v3 G1)', () => {
  assert.deepEqual(shape(T('\\begin{itemize}\n\\item a \\tag{1}\n\\item b\n\\end{itemize}')), ['text:"a \\\\tag{1}\\n\\nb"']);
  assert.deepEqual(shape(T('앞  \n\\begin{itemize}\n\\item x \\tag{2}\n\\end{itemize}')), ['text:"앞  \\n\\nx \\\\tag{2}"']);
});
test('R0b: 수식·코드 안은 무접촉 · \\items 같은 매크로 무접촉 · stats.fixed · 멱등', () => {
  const keep = '$\\text{\\item}$ 와 `\\begin{itemize}` 그리고 \\itemsep';
  const r0 = T(keep);
  assert.deepEqual(shape(r0), [`text:${JSON.stringify(keep)}`]);
  assert.equal(r0.stats.fixed, 0);
  const fenced = '```\n\\begin{itemize}\n\\item a\n\\end{itemize}\n```';
  assert.deepEqual(shape(T(fenced)), [`text:${JSON.stringify(fenced)}`]);
  const r = T('\\begin{itemize}\n\\item 첫째\n\\item 둘째\n\\end{itemize}');
  assert.ok(r.stats.fixed > 0);
  const again = tidyBlocks(r.blocks.map((b) => ({ type: b.type, raw_text: b.raw_text })), { tab: 'solution', autoFix: false });
  assert.deepEqual(shape(again), shape(r));
  assert.equal(again.stats.fixed, 0);
  assert.equal(again.stats.lineBreaks, 0);
});
test('R0b: choices·image는 무접촉(SPLITTABLE 밖)', () => {
  const src = '\\begin{itemize}\n\\item a\n\\end{itemize}';
  assert.deepEqual(shape(T(src, 'solution', 'choices')), [`choices:${JSON.stringify(src)}`]);
});

/* ═══ R6 원본 줄바꿈 → hard break (2026-11-05 정돈 소폭 개선) ═══ */
const same = (raw, tab, type) => assert.deepEqual(shape(T6(raw, tab, type)), [`${type ?? 'text'}:${JSON.stringify(raw)}`], raw);
test('R6: 문단 안 줄바꿈마다 두 칸 · stats.lineBreaks · lineBreaks:false면 무발동', () => {
  const r = T6('첫째 줄\n둘째 줄\n셋째 줄');
  assert.deepEqual(shape(r), ['text:"첫째 줄  \\n둘째 줄  \\n셋째 줄"']);
  assert.equal(r.stats.lineBreaks, 2);
  assert.deepEqual(shape(T('첫째 줄\n둘째 줄')), ['text:"첫째 줄\\n둘째 줄"']);
});
test('R6: 수식 안·$$ 앞뒤·$$\\begin 같은 줄(R10)·코드펜스는 무접촉', () => {
  same('앞\n$$\nx=1\n$$\n뒤');
  same('$$\\begin{aligned}\na\\\\b\n\\end{aligned}$$');
  same('```\na\nb\n```\n뒤');
});
test('R6: 스스로 문단을 끊는 줄 앞은 무접촉 — 표·제목·인용·글머리·1)·마커 / 2)는 두 칸', () => {
  same('| a | b |\n| --- | --- |\n| 1 | 2 |');
  same('## 제목\n본문');
  same('설명\n- a\n- b');
  same('설명\n1) a');
  same('설명\n(가) 첫째\n(나) 둘째');
  same('a \\\\\nb');
  assert.deepEqual(shape(T6('이다.\n2) b')), ['text:"이다.  \\n2) b"']);
  assert.deepEqual(shape(T6('(가) 첫째\n이어지는 설명')), ['text:"(가) 첫째  \\n이어지는 설명"']);
});
test('R6: \\tag 줄은 앞뒤 빈 줄로 단독 문단(N1)', () => {
  const r = T6('설명 줄\n식 $a=1$ \\tag{1}\n다음 줄');
  assert.deepEqual(shape(r), ['text:"설명 줄\\n\\n식 $a=1$ \\\\tag{1}\\n\\n다음 줄"']);
  assert.equal(r.stats.lineBreaks, 2);
});
test('R6: case 제목 행↔본문은 무접촉 · 본문 줄 사이는 두 칸 · 이어짓기 빈 첫 줄 보존', () => {
  assert.deepEqual(shape(T6('조건인 경우\n본문 하나\n본문 둘', 'solution', 'case')), ['case:"조건인 경우\\n본문 하나  \\n본문 둘"']);
  assert.deepEqual(shape(T6('\n본문 하나\n본문 둘', 'solution', 'case')), ['case:"\\n본문 하나  \\n본문 둘"']);
});
test('R6: choices·list·gana·heading 무접촉', () => {
  same('① a\n② b', 'solution', 'choices');
  same('- a\n설명', 'solution', 'list');
  same('(가) a\n설명', 'solution', 'gana');
  assert.equal(preserveSourceLineBreaks('## a\nb', 'heading').count, 0);
});
test('R6: R0b가 붙인 두 칸에 이중으로 붙지 않는다 · 멱등(두 번째 정돈 stats 0)', () => {
  const r = T6('\\begin{itemize}\n\\item a\n\\item b\n\\end{itemize}\n뒤 문장\n끝');
  assert.deepEqual(shape(r), ['text:"a  \\nb  \\n뒤 문장  \\n끝"']);
  const again = tidyBlocks(r.blocks.map((b) => ({ type: b.type, raw_text: b.raw_text })), { tab: 'solution', autoFix: false });
  assert.deepEqual(shape(again), shape(r));
  assert.deepEqual([again.stats.split, again.stats.fixed, again.stats.removed, again.stats.lineBreaks], [0, 0, 0, 0]);
  const t = T6('설명 줄\n식 \\tag{1}\n다음');
  const t2 = tidyBlocks(t.blocks.map((b) => ({ type: b.type, raw_text: b.raw_text })), { tab: 'solution', autoFix: false });
  assert.deepEqual(shape(t2), shape(t));
  assert.equal(t2.stats.lineBreaks, 0);
});
test('hardBreakKinds: 경계 판정 단위', () => {
  assert.deepEqual(hardBreakKinds(['a', 'b']), ['spaces']);
  assert.deepEqual(hardBreakKinds(['a', '', 'b']), ['none', 'none']);
  assert.deepEqual(hardBreakKinds(['a  ', 'b']), ['none']);
  assert.deepEqual(hardBreakKinds(['$x', 'y$ 끝', 'z']), ['none', 'spaces']);   // 줄을 넘는 인라인 수식 안
  assert.deepEqual(hardBreakKinds(['a $\\tag{1}$', 'b']), ['spaces']);            // 수식 안 \tag는 번호 줄이 아니다
  assert.deepEqual(hardBreakKinds(['a', '* b', '+ c', '> d']), ['none', 'none', 'none']);
  assert.deepEqual(hardBreakKinds(['a', '-']), ['spaces']);                        // 빈 글머리는 문단을 못 끊는다
});

test('origin: 여러 입력 블록의 조각이 각자 입력 인덱스를 가리킨다', () => {
  const r = tidyBlocks([{ type: 'text', raw_text: 'a\n(i) b인 경우' }, { type: 'text', raw_text: 'c' }], { tab: 'question', autoFix: false });
  assert.deepEqual(r.blocks.map((b) => b.origin), [0, 0, 1]);
});

test('M9 D24-1′: 정돈은 단독 초성 U+1100을 호환 자모로 먼저 정규화한다(roman 첫 행)', () => {
  const r = tidyBlocks([{ type: 'roman', raw_text: '\u1100. $t=1$이면\n\u1102. 둘째' }], { tab: 'question' });
  assert.equal(r.blocks[0].raw_text, 'ㄱ. $t=1$이면\nㄴ. 둘째');
});
