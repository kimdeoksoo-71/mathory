/**
 * build-supplement.cjs — 시드(symbols.js)에 없는 KaTeX 연산자(함수명) 보강
 *
 * \log \ln \sin 등은 symbols.js의 defineSymbol이 아니라 functions/op.js에 정의돼 있어
 * 자동 추출에서 빠졌다. 표준 함수 연산자를 수작업 큐레이션으로 추가한다.
 * 각 항목을 katex.renderToString으로 검증 후 lib/data/curated-supplement.json 생성.
 * (id는 build-symbols.cjs에서 기존 최대 id 다음으로 부여 — 계획서 §1 'ID는 영원히')
 */
'use strict';
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const ROOT = path.join(__dirname, '..');

// [latex, ko, en, field, tier]
const OPS = [
  ['\\log', '로그', 'logarithm', 'function', 1],
  ['\\ln', '자연로그', 'natural logarithm', 'function', 1],
  ['\\lg', '상용로그', 'common logarithm', 'function', 2],
  ['\\exp', '지수함수', 'exponential', 'function', 1],
  ['\\lim', '극한', 'limit', 'function', 1],
  ['\\limsup', '상극한', 'limit superior', 'analysis', 3],
  ['\\liminf', '하극한', 'limit inferior', 'analysis', 3],
  ['\\sup', '상한', 'supremum', 'analysis', 2],
  ['\\inf', '하한', 'infimum', 'analysis', 2],
  ['\\max', '최댓값', 'maximum', 'function', 1],
  ['\\min', '최솟값', 'minimum', 'function', 1],
  ['\\sin', '사인', 'sine', 'function', 1],
  ['\\cos', '코사인', 'cosine', 'function', 1],
  ['\\tan', '탄젠트', 'tangent', 'function', 1],
  ['\\cot', '코탄젠트', 'cotangent', 'function', 2],
  ['\\sec', '시컨트', 'secant', 'function', 2],
  ['\\csc', '코시컨트', 'cosecant', 'function', 2],
  ['\\arcsin', '아크사인', 'arcsine', 'function', 2],
  ['\\arccos', '아크코사인', 'arccosine', 'function', 2],
  ['\\arctan', '아크탄젠트', 'arctangent', 'function', 2],
  ['\\sinh', '쌍곡사인', 'hyperbolic sine', 'function', 2],
  ['\\cosh', '쌍곡코사인', 'hyperbolic cosine', 'function', 2],
  ['\\tanh', '쌍곡탄젠트', 'hyperbolic tangent', 'function', 2],
  ['\\coth', '쌍곡코탄젠트', 'hyperbolic cotangent', 'function', 3],
  ['\\det', '행렬식', 'determinant', 'linear-algebra', 2],
  ['\\dim', '차원', 'dimension', 'linear-algebra', 2],
  ['\\ker', '핵', 'kernel', 'linear-algebra', 3],
  ['\\deg', '차수', 'degree', 'algebra', 2],
  ['\\gcd', '최대공약수', 'greatest common divisor', 'discrete', 1],
  ['\\arg', '편각', 'argument', 'function', 2],
  ['\\hom', '준동형', 'hom', 'algebra', 4],
  ['\\Pr', '확률', 'probability', 'probability', 2],
  // 생략점 — \cdots는 op.js 매크로라 자동 추출에서 빠짐(점·생략 카테고리로 분류됨)
  ['\\cdots', '가운데 생략점', 'centered ellipsis', 'arithmetic', 1],
];

// 글꼴 명령 (구조형 — 인자 받음). 카탈로그 '수학 글꼴' 채움. tier 3 → 팔레트 기본 노출 제외.
// [latex, displayLatex, cursorOffset, ko, en]
const FONTS = [
  ['\\mathbb{}', '\\mathbb{R}', 8, '칠판체', 'blackboard bold'],
  ['\\mathcal{}', '\\mathcal{F}', 9, '필기체', 'calligraphic'],
  ['\\mathfrak{}', '\\mathfrak{g}', 9, '프락투어', 'fraktur'],
  ['\\mathbf{}', '\\mathbf{v}', 8, '굵게', 'bold'],
  ['\\mathit{}', '\\mathit{x}', 8, '이탤릭', 'italic'],
  ['\\mathrm{}', '\\mathrm{d}', 8, '로만체(직립)', 'roman'],
  ['\\mathsf{}', '\\mathsf{A}', 8, '산세리프', 'sans-serif'],
  ['\\mathtt{}', '\\mathtt{x}', 8, '타자체', 'typewriter'],
  ['\\boldsymbol{}', '\\boldsymbol{\\alpha}', 12, '굵은 기호', 'bold symbol'],
];

// 확률·통계 표기 (생성). catalogCategory는 classify의 EXPLICIT[21]/field에서 21로.
// [latex, displayLatex, cursorOffset, ko, en, field, tier]
const STATS = [
  ['\\mathrm{P}()', '\\mathrm{P}(A)', 11, '확률', 'probability', 'probability', 1],
  ['\\mathrm{V}()', '\\mathrm{V}(X)', 11, '분산', 'variance', 'statistics', 1],
  ['\\sigma()', '\\sigma(X)', 7, '표준편차', 'standard deviation', 'statistics', 1],
  ['{}_{}\\Pi_{}', '{}_{n}\\Pi_{r}', 4, '중복순열', 'permutation with repetition', 'discrete', 2],
  ['{}_{}\\mathrm{H}_{}', '{}_{n}\\mathrm{H}_{r}', 4, '중복조합', 'combination with repetition', 'discrete', 2],
  ['\\mathrm{N}()', '\\mathrm{N}(m,\\ \\sigma^2)', 11, '정규분포', 'normal distribution', 'probability', 2],
  ['\\mathrm{B}()', '\\mathrm{B}(n,\\ p)', 11, '이항분포', 'binomial distribution', 'probability', 2],
];

function renders(latex) {
  try { katex.renderToString(latex, { throwOnError: true }); return true; }
  catch { try { katex.renderToString(latex + '{x}', { throwOnError: true }); return true; } catch { return false; } }
}

const items = [];
const fail = [];
for (const [latex, ko, en, field, tier] of OPS) {
  if (!renders(latex)) { fail.push(latex); continue; }
  items.push({
    latex,
    symbol: '',                 // 멀티문자 → KaTeX로 렌더(displayLatex 없음 → latex 렌더)
    mathClass: 'op-token',
    field,
    tier,
    name: { ko, en },
    katexSupported: true,
    needsReview: false,
  });
}
for (const [latex, displayLatex, cursorOffset, ko, en] of FONTS) {
  if (!renders(displayLatex)) { fail.push(latex); continue; }
  items.push({
    latex, symbol: '', displayLatex, cursorOffset,
    mathClass: 'mathord',       // 구조형 검사 회피 → classify에서 글꼴(19)로
    field: 'algebra', tier: 3,  // tier 3 → 팔레트 기본 제외, 카탈로그에만
    name: { ko, en },
    katexSupported: true, needsReview: false,
  });
}
for (const [latex, displayLatex, cursorOffset, ko, en, field, tier] of STATS) {
  if (!renders(displayLatex)) { fail.push(latex); continue; }
  items.push({
    latex, symbol: '', displayLatex, cursorOffset,
    mathClass: 'mathord',
    field, tier,
    name: { ko, en },
    katexSupported: true, needsReview: false,
  });
}

fs.writeFileSync(
  path.join(ROOT, 'lib', 'data', 'curated-supplement.json'),
  JSON.stringify({ _meta: { note: 'KaTeX functions/op.js 연산자 보강(수작업). build-symbols.cjs에서 id 부여.' }, count: items.length, items }, null, 2) + '\n',
  'utf8',
);
console.log('보강 연산자:', items.length, '/ 렌더 실패:', fail.length, fail.length ? fail : '');
console.log('→ lib/data/curated-supplement.json');
