/**
 * Phase 70 — LaTeX 직렬화기(latex.ts) 검증.
 *
 * 실행: npm run test:exportlatex
 * 스냅샷 갱신: EXPORT_SNAPSHOT_UPDATE=1 npm run test:exportlatex  (갱신 뒤 diff를 사람이 읽을 것)
 *
 * ⚠ 로컬에 TeX 엔진이 없어 실제 컴파일은 P0-7(Overleaf, 덕수)이 맡는다 — 여기서는 문자열을 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc } from '../.test-build/lib/export/ir.js';
import { serializeLatex, escTex, inlineMathTex, LATEX_PREAMBLE } from '../.test-build/lib/export/latex.js';
import { sampleProblem } from './fixtures/export/sampleProblem.mjs';

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);
const R = String.raw;
const figurePath = (id, { gray }) => `figures/${id}${gray ? '-gray' : ''}.png`;

function tex(input) {
  return serializeLatex(buildExportDoc(input, { parse }), { figurePath });
}
function one(raw, type = 'text', extra = {}) {
  return tex({ title: 't', tabs: [{ id: 'question', label: '문제', blocks: [{ id: 'b', type, raw_text: raw, ...extra }] }] });
}

test('X1 텍스트 이스케이프 전수', () => {
  assert.equal(escTex(R`a\b{c}#$%&_~^`), R`a\textbackslash{}b\{c\}\#\$\%\&\_\textasciitilde{}\textasciicircum{}`);
});

test('X2 인라인 \\displaystyle 주입(D9) — 한 줄 $$x$$·이미 붙은 것은 그대로', () => {
  assert.equal(inlineMathTex('x^2'), R`$\displaystyle x^2$`);
  assert.equal(inlineMathTex(R`\displaystyle y`), R`$\displaystyle y$`);
  assert.equal(inlineMathTex('z', true), '$z$');
});

test('X3 프리앰블 — amsmath는 [fleqn]으로 한 번만 · 글꼴 이름 두 벌 + UnBatang 폴백', () => {
  assert.equal((LATEX_PREAMBLE.match(/amsmath/g) || []).length, 1);
  assert.ok(LATEX_PREAMBLE.includes(R`\usepackage[fleqn]{amsmath}`));
  assert.ok(LATEX_PREAMBLE.includes('Noto Serif CJK KR') && LATEX_PREAMBLE.includes('{Noto Serif KR}') && LATEX_PREAMBLE.includes('UnBatang'));
});

test('X4 제목 \\section* · 탭 \\subsection* · 본문 제목은 한 단 아래(Q16)', () => {
  const t = one('## STEP 1', 'heading');
  assert.ok(t.includes(R`\section*{t}`));
  assert.ok(t.includes(R`\subsection*{문제}`));
  assert.ok(t.includes(R`\subsubsection*{STEP 1}`));
});

test('X5 display \\tag → \\tag*{(n)} · rows → array{l} + 행마다 \\displaystyle · 문단 tag → \\hfill', () => {
  assert.ok(one('$$\nx=1 \\tag{3}\n$$').includes('x=1\n\\tag*{(3)}\n\\end{equation*}'));
  assert.ok(one('$$\na=1 \\\\\nb=2\n$$').includes('\\begin{array}{l}\n\\displaystyle a=1 \\\\\n\\displaystyle b=2\n\\end{array}'));
  assert.ok(one(R`값이다. \tag{2}`).includes(R`값이다.\hfill\mbox{(2)}`));
});

test('X6 마커 — (가) 2.5em 내어쓰기 · ① 2em + 밭 왼쪽 1em', () => {
  const t = one('(가) 첫째\n① 둘째');
  assert.ok(t.includes(R`\hangindent=2.5em\hangafter=1\makebox[2.5em][l]{\textbf{(가)}}첫째`));
  assert.ok(t.includes(R`\hangindent=3em\hangafter=1\hspace*{1em}\makebox[2em][l]{\textbf{①}}둘째`));
});

test('X7 선택지 4개 → 5열 · 빈 칸 채움', () => {
  const t = one('① $1$\n② 2\n③ 3\n④ 4', 'choices');
  assert.ok(t.includes(R`{@{}*{5}{X}@{}}`));
  assert.ok(t.includes(R`①\ $\displaystyle 1$ & ②\ 2 & ③\ 3 & ④\ 4 & `));
});

test('X8 그림 — 폭 숫자(D20 LaTeX 상한 433.7pt) · 회색 경로 · 못 받은 그림은 상자', () => {
  const t = one('<img src="https://e/x.png" />', 'image', { imageWidth: 600, imageGray: true });
  assert.ok(t.includes(R`\includegraphics[width=433.7pt]{figures/fig-1-gray.png}`));
  const miss = serializeLatex(buildExportDoc({ title: 't', tabs: [{ id: 'q', label: 'q', blocks: [{ id: 'b', type: 'image', raw_text: '<img src="u" />' }] }] }, { parse }), { figurePath: () => null });
  assert.ok(miss.includes(R`\fbox{그림을 불러오지 못했습니다}`));
});

test('X9 경우 제목행 전체 굵게 · 라벨 C1.', () => {
  assert.ok(one('$x>0$인 경우\n본문', 'case').includes(R`\noindent\textbf{C1.\ $\displaystyle x>0$인 경우}\par`));
});

test('X10 결정성 + 표본 스냅샷', () => {
  const a = tex(sampleProblem);
  assert.equal(a, tex(sampleProblem));
  const snap = new URL('./fixtures/export/sampleProblem.expected.tex', import.meta.url);
  if (process.env.EXPORT_SNAPSHOT_UPDATE === '1' || !existsSync(snap)) {
    writeFileSync(snap, a);
    return;
  }
  assert.equal(a, readFileSync(snap, 'utf8'), '스냅샷과 다르다 — 의도한 변경이면 EXPORT_SNAPSHOT_UPDATE=1로 갱신 후 diff를 읽을 것');
});
