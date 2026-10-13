/**
 * Phase 70 — IR 빌더(prepare.ts · ir.ts) 검증.
 *
 * 실행: npm run test:exportir
 *
 * 파서는 **렌더와 같은 것**(unified + remark-parse + remark-math + remark-gfm)을 주입한다(D7′).
 * P0-9 동치 검사는 같은 원문을 ① 내보내기 경로(prepareMarkdown) ② 렌더 경로(lib/preprocess의 preprocess)
 * 로 각각 파싱해 mdast 노드 종류별 개수가 같은지 본다 — 구조 동치가 "전처리가 같은 줄 구조를 만드는가"로
 * 환원된다는 D7′ 논증을 실행으로 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc, parseChoices } from '../.test-build/lib/export/ir.js';
import { prepareMarkdown } from '../.test-build/lib/export/prepare.js';
import { preprocess } from '../.test-build/lib/preprocess.js';
import { sampleProblem } from './fixtures/export/sampleProblem.mjs';

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);
const R = String.raw;

function build(input, warnings = []) {
  return buildExportDoc(input, { parse, warn: (m) => warnings.push(m) });
}
function one(raw, type = 'text') {
  const warnings = [];
  const doc = build({ title: 't', tabs: [{ id: 'question', label: '문제', blocks: [{ id: 'b', type, raw_text: raw }] }] }, warnings);
  return { block: doc.tabs[0].blocks[0], doc, warnings };
}
const body = (raw, type) => one(raw, type).block.body;

/* ═══ 수식 · \tag ═══ */

test('I1 텍스트 행 끝 \\tag{n} → 문단 tag "(n)", 글자에서 빠진다', () => {
  const [p] = body(R`산술평균에 의하여 $f \ge 2$이다. \tag{2}`);
  assert.equal(p.t, 'p');
  assert.equal(p.tag, '(2)');
  assert.deepEqual(p.inline.at(-1), { t: 'text', text: '이다.' });
});

test('I2 display 안 \\tag → tag 속성, latex에서 빠진다', () => {
  const [d] = body('$$\nx = 1 \\tag{3}\n$$');
  assert.deepEqual(d, { t: 'display', latex: 'x = 1', tag: '(3)' });
});

test('I3 비숫자 \\tag{가} → "(가)" · \\tag*{(1)} → 그대로 "(1)"', () => {
  assert.equal(body('$$\ny \\tag{가}\n$$')[0].tag, '(가)');
  assert.equal(body('$$\ny \\tag*{(1)}\n$$')[0].tag, '(1)');
});

test('I4 bare \\\\ display → rows(꼬리 \\\\ 제거) · 행 간격 인수도 구분자로', () => {
  const [d] = body('$$\na = 1 \\\\\nb = 2 \\\\[4pt]\nc = 3 \\\\\n$$');
  assert.deepEqual(d.rows, ['a = 1', 'b = 2', 'c = 3']);
});

test('I5 환경이 있으면 rows로 나누지 않는다', () => {
  const [d] = body(R`$$
\begin{aligned} a &= 1 \\ b &= 2 \end{aligned}
$$`);
  assert.equal(d.rows, undefined);
});

test('I6 한 줄 $$x$$ → 인라인 수식 textStyle(화면처럼 \\displaystyle 주입 대상 아님)', () => {
  const [p] = body('값은 $$x^2$$이다.');
  assert.equal(p.t, 'p');
  assert.deepEqual(p.inline[1], { t: 'math', latex: 'x^2', textStyle: true });
});

test('I7 \\( \\) → 인라인 $ · 행바꿈 \\\\[4pt]는 수식 구분자로 먹지 않는다(뒤돌아보기)', () => {
  const [p] = body(R`값 \(x+1\) 이다`);
  assert.deepEqual(p.inline[1], { t: 'math', latex: 'x+1' });
  const [d] = body('$$\na \\\\[4pt] b\n$$\n\n끝 \\]');
  assert.equal(d.t, 'display');
  assert.deepEqual(d.rows, ['a', 'b']);
});

test('I8 \\ref{n} — 텍스트는 "(n)", 수식 안은 \\text{(n)}', () => {
  const [p] = body(R`식 \ref{1}에 $\ref{2}+1$을 대입`);
  assert.equal(p.inline[0].text, '식 (1)에 ');
  assert.equal(p.inline[1].latex, R`\text{(2)}+1`);
});

test('I9 인라인 수식 안 \\tag는 빼고 경고', () => {
  const { block, warnings } = one(R`값 $x \tag{1}$ 이다`);
  assert.equal(block.body[0].inline[1].latex.trim(), 'x');
  assert.ok(warnings.some((w) => w.includes('인라인 수식 안의')));
});

/* ═══ 문단 구조 ═══ */

test('I10 마커 3종은 각자 문단 + marker 속성(비ASCII 공백 소비)', () => {
  const ps = body('(가) 첫째\n(나) 둘째\nㄱ. 셋째\n\u00A0① 넷째', 'text');
  assert.deepEqual(ps.map((p) => p.marker), [
    { kind: 'gana', text: '(가)' }, { kind: 'gana', text: '(나)' },
    { kind: 'giyeok', text: 'ㄱ.' }, { kind: 'circled', text: '①' },
  ]);
  assert.deepEqual(ps.map((p) => p.inline[0].text), ['첫째', '둘째', '셋째', '넷째']);
});

test('I11 수식 전용 행이 연달아 오면 각자 문단(M1 A) · 산문 뒤 수식 행은 이어 붙는다', () => {
  assert.equal(body('$a=1$\n$b=2$\n$c=3$').length, 3);
  assert.equal(body('그러므로\n$a=1$').length, 1);
});

test('I12 동형 초성 ㄱ(U+1100)도 stripInvisibles(Q18) 뒤 마커로 산다', () => {
  const jamo = String.fromCharCode(0x1100);
  const [p] = body(`${jamo}. 참이다`);
  assert.deepEqual(p.marker, { kind: 'giyeok', text: 'ㄱ.' });
});

test('I13 본문 C1·C2a → caseRef(/g 상수 lastIndex 오염 없이 반복 호출)', () => {
  for (let i = 0; i < 3; i++) {
    const [p] = body('C1과 C2a에서 ABC1은 아니다');
    assert.deepEqual(p.inline.filter((x) => x.t === 'caseRef').map((x) => x.text), ['C1', 'C2a']);
  }
});

test('I14 Fig.3 → [그림3]', () => {
  assert.equal(body('Fig.3을 보라')[0].inline[0].text, '[그림3]을 보라');
});

test('I15 표 — 머리·행·정렬 · 칸 안 수식', () => {
  const [t] = body('| $x$ | 1 |\n|:---|---:|\n| $y$ | 2 |');
  assert.equal(t.t, 'table');
  assert.deepEqual(t.align, ['left', 'right']);
  assert.deepEqual(t.head[0], [{ t: 'math', latex: 'x' }]);
  assert.deepEqual(t.rows[0][1], [{ t: 'text', text: '2' }]);
});

test('I16 mathory-graph 펜스 → placeholder · 일반 펜스 → code', () => {
  assert.deepEqual(body('```mathory-graph\n{}\n```')[0], { t: 'placeholder', what: 'graph' });
  assert.deepEqual(body('```python\nprint(1)\n```')[0], { t: 'code', text: 'print(1)', lang: 'python' });
});

test('I17 목록 + 원문자 리터럴 행(목록 블록 프리셋)', () => {
  const f = body('- 첫째\n- 둘째\n\n① 하나\n② 둘', 'list');
  assert.equal(f[0].t, 'ul');
  assert.equal(f[0].items.length, 2);
  assert.deepEqual(f.slice(1).map((p) => p.marker.text), ['①', '②']);
});

test('I18 parseChoices — 빈 항목 건너뜀 · 최대 5 · 줄 앞뒤 공백 무시', () => {
  // 빈 ②는 칸을 차지하지 않으므로 다섯 번째 자리에 뒤의 ①6이 들어온다 — PrintChoicesBlock과 같은 동작
  assert.deepEqual(parseChoices('① 1\n② \n  ③ 3  \n④ 4\n⑤ 5\n① 6\n② 7').map((c) => c.label + c.content), ['①1', '③3', '④4', '⑤5', '①6']);
});

/* ═══ 표본 문항 통째 ═══ */

test('S1 표본 — 탭 tone · 블록 kind 순서 · 경고', () => {
  const warnings = [];
  const doc = build(sampleProblem, warnings);
  assert.deepEqual(doc.tabs.map((t) => t.tone), ['question', 'solution']);
  assert.deepEqual(doc.tabs[0].blocks.map((b) => b.kind), ['para', 'framed', 'framed', 'figure', 'choices']);
  assert.deepEqual(doc.tabs[1].blocks.map((b) => b.kind), [
    'heading', 'para', 'case', 'para', 'case', 'case', 'admonition', 'indent', 'para', 'para', 'para',
    'figure', 'figure', 'heading', 'case', 'para', 'para',
  ]);
  assert.ok(warnings.some((w) => w.includes('future_type')), '미지 타입 경고');
});

test('S2 표본 — 경우 라벨(이어짓기 null · 하위 C1a · heading 리셋 C1)', () => {
  const cases = build(sampleProblem).tabs[1].blocks.filter((b) => b.kind === 'case');
  assert.deepEqual(cases.map((c) => [c.variant, c.label, c.title === null]), [
    ['top', 'C1', false], ['top', null, true], ['sub', 'C1a', false], ['top', 'C1', false],
  ]);
  assert.equal(cases[1].body[0].inline.find((x) => x.t === 'caseRef').text, 'C1');
});

test('S3 표본 — 그림 등록(같은 URL 한 번) · 폭·회색·svg 높이 · ggb', () => {
  const doc = build(sampleProblem);
  assert.deepEqual(doc.figures, [
    { id: 'fig-1', url: 'https://example.com/fig1.png' },
    { id: 'fig-2', url: 'https://example.com/a.svg' },
  ]);
  const img = doc.tabs[0].blocks[3];
  assert.deepEqual(img, { kind: 'figure', variant: 'image', ref: 'fig-1', widthPx: 360, frame: false, gray: true });
  const inlineImg = doc.tabs[1].blocks[3].body[0].inline[0];
  assert.deepEqual(inlineImg, { t: 'img', ref: 'fig-1' });
  const [svg, ggb] = doc.tabs[1].blocks.filter((b) => b.kind === 'figure');
  assert.deepEqual(svg, { kind: 'figure', variant: 'svg', ref: 'fig-2', heightPx: 240 });
  assert.deepEqual(ggb, { kind: 'figure', variant: 'ggb' });
});

test('S4 표본 — 선택지 4개(빈 ④ 건너뜀) · 내용은 인라인 수식', () => {
  const ch = build(sampleProblem).tabs[0].blocks[4];
  assert.deepEqual(ch.items.map((i) => i.label), ['①', '②', '③', '⑤']);
  assert.deepEqual(ch.items[2].inline, [{ t: 'math', latex: R`\dfrac{3}{8}` }]);
});

test('S5 결정성 — 같은 입력 두 번 → 같은 IR', () => {
  assert.deepEqual(build(sampleProblem), build(sampleProblem));
});

/* ═══ P0-9 렌더 동치 ═══ */

const COUNTED = ['paragraph', 'heading', 'math', 'inlineMath', 'list', 'listItem', 'table', 'tableRow', 'blockquote', 'code', 'thematicBreak'];
function census(root) {
  const c = Object.fromEntries(COUNTED.map((k) => [k, 0]));
  (function walk(n) {
    if (n.type in c) c[n.type] += 1;
    for (const ch of n.children ?? []) walk(ch);
  })(root);
  return c;
}

test('P0-9 렌더 경로와 mdast 구조 동치 — 표본 전 블록', () => {
  const raws = sampleProblem.tabs.flatMap((t) => t.blocks)
    .filter((b) => !['image', 'svg', 'ggb', 'choices'].includes(b.type))
    .map((b) => b.raw_text);
  const extra = [
    '(가) 첫째\n(나) 둘째\nㄱ. 셋째',
    '$a=1$\n$b=2$\n산문 뒤\n$c=3$',
    '설명\n- 하나\n- 둘\n**Case 1.** 레거시',
    '> 인용 $x$\n> 이어짐',
    '| a | b |\n|---|---|\n| 1 | 2 |',
    '문단 \\tag{4}\n다음 문단',
    '---\n\n제목 아래\n===',
  ];
  for (const raw of [...raws, ...extra]) {
    const mine = census(parse(prepareMarkdown(raw, 'ko')));
    const render = census(parse(preprocess(raw, 'ko')));
    assert.deepEqual(mine, render, `구조가 갈렸다:\n${raw}`);
  }
});
