/* Phase 68c D5·D6′ — lib/mathPaste.ts (순수). npm run test:mathpaste */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNICODE_TO_LATEX, convertUnicodeMath, normalizeMathDelimitersForPaste, smartPasteText,
} from '../.test-build/lib/mathPaste.js';

/** `|`(커서) 또는 `[…]`(선택)이 든 문서에 text를 붙인 결과 */
function paste(src, text) {
  let from, to, doc;
  if (src.includes('[')) { from = src.indexOf('['); to = src.indexOf(']') - 1; doc = src.replace('[', '').replace(']', ''); }
  else { from = to = src.indexOf('|'); doc = src.replace('|', ''); }
  const out = smartPasteText(text, doc, from, to);
  return doc.slice(0, from) + out + doc.slice(to);
}

test('구분자 — \\( \\) → $ $ · \\[ \\] → 펜스형', () => {
  assert.equal(normalizeMathDelimitersForPaste('\\(x\\)'), '$x$');
  assert.equal(normalizeMathDelimitersForPaste('\\( x+1 \\)'), '$x+1$');
  assert.equal(normalizeMathDelimitersForPaste('\\[x\\]'), '$$\nx\n$$');
  assert.equal(normalizeMathDelimitersForPaste('foo \\[x\\] bar'), 'foo\n$$\nx\n$$\nbar');
  assert.equal(normalizeMathDelimitersForPaste('그러면\n\\[\na = 1\n\\]\n이다'), '그러면\n$$\na = 1\n$$\n이다');
});

test('구분자 — 행바꿈 \\\\[4pt] 보존(61a C6) · 이스케이프 · 미닫힘 · 빈 짝 무접촉', () => {
  assert.equal(normalizeMathDelimitersForPaste('\\[\n a \\\\[4pt] b \n\\]'), '$$\na \\\\[4pt] b\n$$');
  assert.equal(normalizeMathDelimitersForPaste('a \\\\[6pt] b'), 'a \\\\[6pt] b');
  assert.equal(normalizeMathDelimitersForPaste('\\\\(x\\\\)'), '\\\\(x\\\\)');
  assert.equal(normalizeMathDelimitersForPaste('\\(x'), '\\(x');
  assert.equal(normalizeMathDelimitersForPaste('\\(x\n\ny\\)'), '\\(x\n\ny\\)');
  assert.equal(normalizeMathDelimitersForPaste('\\(\\)'), '\\(\\)');
  assert.equal(normalizeMathDelimitersForPaste('가격 \\$5'), '가격 \\$5');
});

test('구분자 — 코드·기존 수식 안 무접촉 · 인접 $ 공백', () => {
  assert.equal(normalizeMathDelimitersForPaste('```\n\\(x\\)\n```'), '```\n\\(x\\)\n```');
  assert.equal(normalizeMathDelimitersForPaste('`\\(x\\)`'), '`\\(x\\)`');
  assert.equal(normalizeMathDelimitersForPaste('$a \\(x\\) b$'), '$a \\(x\\) b$');
  assert.equal(normalizeMathDelimitersForPaste('$$\n\\(x\\)\n$$'), '$$\n\\(x\\)\n$$');
  assert.equal(normalizeMathDelimitersForPaste('$y$\\(x\\)'), '$y$ $x$');
  assert.equal(normalizeMathDelimitersForPaste('\\(x\\)$y$'), '$x$ $y$');
  assert.equal(normalizeMathDelimitersForPaste('혼합 \\(a\\)와 \\(b\\), 그리고 $c$'), '혼합 $a$와 $b$, 그리고 $c$');
});

test('표 — 대표 기호', () => {
  const cases = {
    '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '→': '\\to', '←': '\\leftarrow', '∞': '\\infty', 'π': '\\pi', 'θ': '\\theta',
    '△': '\\triangle', '∠': '\\angle', '…': '\\cdots', '⋯': '\\cdots', '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot',
    '−': '-', '∗': '*', '′': "'", '″': "''", '°': '^\\circ', '∅': '\\varnothing', '∥': '\\parallel', '∣': '\\mid', '⊥': '\\perp',
    '∑': '\\sum', '∫': '\\int', '∈': '\\in',
  };
  for (const [k, v] of Object.entries(cases)) assert.equal(UNICODE_TO_LATEX.get(k), v, k);
});

test('표 — 결합 문자·항등·한글은 없다', () => {
  for (const k of ['˙', '⃗', 'ˇ', '¨', 'ȷ', 'ı', '가', 'ㄱ']) assert.equal(UNICODE_TO_LATEX.has(k), false, k);
});

test('표 — 중복 기호 43종 스냅샷(최단형 · 동률 id 오름차순 · PREFERRED · OVERRIDES — Q5·Q13)', () => {
  const SNAP = {"£":"\\pounds","…":"\\cdots","∫":"\\int","∥":"\\parallel","∣":"\\mid","†":"\\dagger","▽":"\\triangledown","△":"\\triangle","→":"\\to","≤":"\\le","←":"\\leftarrow","⊨":"\\models","≥":"\\ge","≈":"\\approx","∨":"\\vee","∧":"\\wedge","∖":"\\setminus","⋅":"\\cdot","∗":"*","∅":"\\varnothing","⊥":"\\perp","¬":"\\neg","↾":"\\restriction","⇝":"\\leadsto","⋓":"\\Cup","⋒":"\\Cap","≑":"\\Doteq","⋈":"\\Join","⊳":"\\rhd","⊲":"\\lhd","⋙":"\\ggg","⋘":"\\lll","∝":"\\propto","⊵":"\\unrhd","∼":"\\sim","⌢":"\\frown","⌣":"\\smile","⊴":"\\unlhd","◊":"\\lozenge","□":"\\square","ℏ":"\\hbar","‡":"\\ddagger","∋":"\\ni"};
  assert.equal(Object.keys(SNAP).length, 43);
  for (const [k, v] of Object.entries(SNAP)) assert.equal(UNICODE_TO_LATEX.get(k), v, k);
});

test('변환 — 공백 · 첨자 런 · √ 한 토큰 · 전각 · 무접촉', () => {
  const cases = [
    ['α≤β', '\\alpha\\le\\beta'], ['≤3', '\\le 3'], ['≤x', '\\le x'], ['≤(', '\\le('],
    ['x²', 'x^{2}'], ['x²³', 'x^{23}'], ['x⁻¹', 'x^{-1}'], ['x²+y²', 'x^{2}+y^{2}'], ['a₁₂', 'a_{12}'], ['aₙ₊₁', 'a_{n+1}'], ['xᵢⱼ', 'x_{ij}'],
    ['√x', '\\sqrt{x}'], ['√2x', '\\sqrt{2}x'], ['√2.5', '\\sqrt{2.5}'], ['√(x+1)', '\\sqrt{x+1}'], ['√(√x)', '\\sqrt{\\sqrt{x}}'],
    ['√{x}', '\\sqrt{x}'], ['√π', '\\sqrt{\\pi}'], ['√\\pi', '\\sqrt{\\pi}'],
    ['（ｘ＋１）', '(x+1)'], ['＄', '＄'], ['30°C', '30^\\circ C'], ['f′(x)', "f'(x)"], ['a≠b', 'a\\ne b'],
    ['한글α', '한글\\alpha'], ['\\alpha', '\\alpha'], ['x^{2}', 'x^{2}'],
  ];
  for (const [a, b] of cases) assert.equal(convertUnicodeMath(a), b, a);
});

test('영역 판정 — 붙이는 자리·평문의 $', () => {
  assert.equal(paste('a $|$ b', 'α≤β'), 'a $\\alpha\\le\\beta$ b');                 // 커서가 수식 안
  assert.equal(paste('a $x+|$ b', '√2'), 'a $x+\\sqrt{2}$ b');
  assert.equal(paste('본문 |', 'α≤β'), '본문 α≤β');                                  // 본문 커서 → 무접촉
  assert.equal(paste('본문 |', 'x $α$ y'), '본문 x $\\alpha$ y');                    // 평문의 $ 안만
  assert.equal(paste('본문 |', '（가） $（ｘ）$'), '본문 （가） $(x)$');               // 본문 전각은 그대로(P8)
  assert.equal(paste('$≤$ 그리고 |', 'α'), '$≤$ 그리고 α');                          // 붙인 구간 밖의 기존 수식 무접촉
  assert.equal(paste('a $\\text{|}$ b', 'α'), 'a $\\text{α}$ b');                    // \text{} 안 무접촉
  assert.equal(paste('a $\\text{가} |$ b', 'α'), 'a $\\text{가} \\alpha$ b');
  assert.equal(paste('본문 |', '\\(α≤1\\)'), '본문 $\\alpha\\le 1$');                // 구분자 정규화 뒤 영역
  assert.equal(paste('a $[old]$ b', '≥'), 'a $\\ge$ b');                            // 선택 대체
});

test('영역 판정 — URL·파일명(drop 경로 포함) 무접촉', () => {
  assert.equal(paste('|', 'https://drive.google.com/file/d/abc/view'), 'https://drive.google.com/file/d/abc/view');
  assert.equal(paste('|', 'a_fig1.jpg'), 'a_fig1.jpg');
});

test('불변 — 빈 문자열 · 폭 0 문자 제거(① stripInvisibles)', () => {
  assert.equal(smartPasteText('', 'abc', 1, 1), '');
  assert.equal(paste('|', 'a\u200Bb'), 'ab');
});
