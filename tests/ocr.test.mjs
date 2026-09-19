/* M9 D25-1·M4 — lib/ocr.ts Mathpix 식 번호 후처리(프로브 실측 출력 그대로). npm run test:ocr */
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { normalizeMathpixEquationTags: N, normalizeAndFix } = await import('../.test-build/lib/ocr.js');

test('M4: equation* 한 겹을 벗기고 \\tag{ㄱ}을 \\tag{1}로', () => {
  assert.equal(N('$$\\begin{equation*}\n=\\frac{2}{(t+1)^{2}} \\tag{ㄱ}\n\\end{equation*}$$'),
    '$$=\\frac{2}{(t+1)^{2}} \\tag{1}$$');
});

test('M4: align* → aligned · 행의 \\tag{ㄴ} → \\tag{2} · (ㄱ)·㉠ 표기도', () => {
  assert.equal(N('$$\\begin{align*}\n& f=1 \\\\\n& g=2 \\tag{ㄴ}\n\\end{align*}$$'),
    '$$\\begin{aligned}\n& f=1 \\\\\n& g=2 \\tag{2}\n\\end{aligned}$$');
  assert.equal(N('\\tag{(ㄷ)}'), '\\tag{3}');
  assert.equal(N('\\tag{㉡}'), '\\tag{2}');
  assert.equal(N('\\tag{3}'), '\\tag{3}');   // 숫자 번호는 무접촉
});

test('M4: normalizeAndFix 전체 경로 — 프로브 원문(ocr-page) 모양', () => {
  const raw = '$$\\begin{equation*}\n=\\frac{2}{(t+1)^{2}} \\tag{ㄱ}\n\\end{equation*}$$\n$f(t)$ 는 부채꼴의 넓이이므로\n$$\\begin{align*}\n& f(t)=\\frac{1}{2} \\times 1^{2} \\times \\theta \\\\\n& \\Rightarrow f^{\\prime}(t)=\\frac{1}{2} \\times \\frac{d \\theta}{d t} \\tag{ㄴ}\n\\end{align*}$$';
  const out = normalizeAndFix(raw);
  assert.ok(out.includes('\\tag{1}') && out.includes('\\tag{2}'), out);
  assert.ok(!/equation\*|align\*|tag\{ㄱ\}|tag\{ㄴ\}/.test(out), out);
  assert.ok(out.includes('\\begin{aligned}'), out);
});

test('M9 H 후속: 리더 잔재가 태그 안에 섞인 형태도 \\tag{n}(덕수 실측 2026-09-19)', () => {
  const src = '& \\Rightarrow \\frac{d t}{d s}=\\frac{2 s^{2}+4 s-2}{\\left(s^{2}+1\\right)^{2}}-\\frac{2 s}{s^{2}+1} \\tag{$\\cdots \\cdots \\cdots \\cdots \\cdots \\cdot($ ㄱ}';
  assert.equal(N(src), '& \\Rightarrow \\frac{d t}{d s}=\\frac{2 s^{2}+4 s-2}{\\left(s^{2}+1\\right)^{2}}-\\frac{2 s}{s^{2}+1} \\tag{1}');
  for (const [inp, out] of [
    ['\\tag{\\cdots \\cdots (ㄴ)}', '\\tag{2}'],
    ['\\tag{ ( ㄷ ) }', '\\tag{3}'],
    ['\\tag{ㄱ)}', '\\tag{1}'],
    ['\\tag{\\text{(ㄹ)}}', '\\tag{4}'],
    ['\\tag{……… ㉡}', '\\tag{2}'],
    ['\\tag{$\\cdots$ (3)}', '\\tag{3}'],
    ['\\tag*{(ㄱ)}', '\\tag*{1}'],
  ]) assert.equal(N(inp), out, inp);
});

test('M9 H 후속: 판단할 수 없는 태그는 무접촉(절 번호·문자·두 글자·숫자 정본)', () => {
  for (const s of ['\\tag{1}', '\\tag{1.2}', '\\tag{A}', '\\tag{ㄱㄴ}', '\\tag{12}']) assert.equal(N(s), s, s);
});

test('M9 H 후속: normalizeAndFix 전체 경로에서도 — 태그 안 $가 수식 판정을 흔들지 않는다', () => {
  const raw = '$$\\begin{align*}\n& f=1 \\\\\n& g=2 \\tag{$\\cdots \\cdots \\cdot($ ㄱ}\n\\end{align*}$$';
  const out = normalizeAndFix(raw);
  assert.ok(out.includes('g=2 \\tag{1}'), out);
  assert.ok(!out.includes('cdots'), out);
});
