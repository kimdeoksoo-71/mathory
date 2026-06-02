/**
 * build-curated-symbols.cjs — Phase 40 고빈도 부분집합 큐레이션 빌더
 *
 * 입력: lib/data/katex-symbols.seed.json (KaTeX MIT 시드, 렌더 검증됨)
 * 동작: 아래 CURATION 목록의 각 latex를 시드에서 찾아 unicode/mathClass/cursorOffset를
 *       자동 채우고, 사람이 부여한 field/ko/en/tier를 합친다. 시드에 없는 항목은
 *       override(symbol/displayLatex/cursorOffset/mathClass)로 보강하고 모두 재렌더 검증.
 * 출력: lib/math-symbols.ts (DEFAULT_CATEGORIES + CURATED_SYMBOLS)
 *
 * ko 이름: 한국 교과서/통용 표준 용어. (대한수학회 수학용어집 대조는 후속 — §18-3)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const ROOT = path.join(__dirname, '..');
const seed = require(path.join(ROOT, 'lib', 'data', 'katex-symbols.seed.json'));
const byLatex = new Map();
for (const s of seed.symbols) if (!byLatex.has(s.latex)) byLatex.set(s.latex, s);
for (const s of seed.structured) byLatex.set(s.latex, s);

// ─── 큐레이션 목록 (4개 기본 카테고리) ───
// [latex, ko, en, field, tier, override?]
const CURATION = [
  // ===== 기본 (arithmetic / vector) =====
  ['\\frac{}{}', '분수', 'fraction', 'arithmetic', 1],
  ['\\dfrac{}{}', '큰 분수', 'display fraction', 'arithmetic', 1],
  ['\\sqrt{}', '제곱근', 'square root', 'arithmetic', 1],
  ['\\sqrt[]{}', '거듭제곱근', 'nth root', 'arithmetic', 1],
  ['^{}', '거듭제곱', 'superscript', 'arithmetic', 1],
  ['_{}', '아래첨자', 'subscript', 'arithmetic', 1],
  ['\\overline{}', '위끝선', 'overline', 'arithmetic', 1],
  ['\\vec{}', '벡터', 'vector', 'vector', 1],
  ['\\overrightarrow{}', '벡터(화살표)', 'overrightarrow', 'vector', 1],
  ['\\pm', '플러스마이너스', 'plus-minus', 'arithmetic', 1],
  ['\\mp', '마이너스플러스', 'minus-plus', 'arithmetic', 2],
  ['\\times', '곱셈', 'multiplication', 'arithmetic', 1],
  ['\\div', '나눗셈', 'division', 'arithmetic', 1],
  ['\\cdot', '가운뎃점', 'center dot', 'arithmetic', 1],

  // ===== 미적분 (calculus / analysis) =====
  ['\\int_{}^{}', '정적분', 'definite integral', 'calculus', 2],
  ['\\iint_{}^{}', '이중적분', 'double integral', 'calculus', 3],
  ['\\oint_{}^{}', '선적분', 'contour integral', 'calculus', 3],
  ['\\sum_{}^{}', '시그마(합)', 'summation', 'calculus', 1],
  ['\\prod_{}^{}', '곱(파이)', 'product', 'calculus', 2],
  ['\\lim_{}', '극한', 'limit', 'analysis', 1],
  ['\\frac{d}{dx}', '미분', 'derivative', 'calculus', 2],
  ['\\partial', '편미분', 'partial derivative', 'calculus', 3],
  ['\\nabla', '나블라', 'nabla (del)', 'calculus', 3],
  ['\\infty', '무한대', 'infinity', 'analysis', 1],
  ['\\to', '화살표(접근)', 'approaches', 'analysis', 1],
  ['\\propto', '비례', 'proportional to', 'analysis', 2],

  // ===== 기호 (algebra=관계 / set / logic / geometry / greek) =====
  // 관계
  ['\\leq', '이하', 'less than or equal', 'algebra', 1],
  ['\\geq', '이상', 'greater than or equal', 'algebra', 1],
  ['\\neq', '같지 않음', 'not equal', 'algebra', 1,
    { symbol: '≠', mathClass: 'rel' }],
  ['\\approx', '근사', 'approximately equal', 'algebra', 2],
  ['\\equiv', '합동·항등', 'equivalent / identical', 'algebra', 2],
  ['\\sim', '닮음', 'similar', 'geometry', 1],
  ['\\fallingdotseq', '근삿값(≒)', 'approximately equal (KR ≒)', 'algebra', 1,
    null, { region: 'kr', note: '한국 교과서 근삿값 기호 ≒' }],
  // 집합
  ['\\in', '원소', 'element of', 'set', 1],
  ['\\notin', '원소 아님', 'not an element of', 'set', 1,
    { symbol: '∉', mathClass: 'rel' }],
  ['\\subset', '진부분집합', 'proper subset', 'set', 1,
    null, { region: 'kr', note: '한국 교과서: ⊂를 부분집합(같음 포함)으로 사용하기도 함' }],
  ['\\subseteq', '부분집합', 'subset or equal', 'set', 1],
  ['\\supset', '진상위집합', 'proper superset', 'set', 1],
  ['\\cup', '합집합', 'union', 'set', 1],
  ['\\cap', '교집합', 'intersection', 'set', 1],
  ['\\emptyset', '공집합', 'empty set', 'set', 1],
  ['\\setminus', '차집합', 'set minus', 'set', 2],
  // 논리
  ['\\forall', '모든', 'for all', 'logic', 2],
  ['\\exists', '존재', 'there exists', 'logic', 2],
  ['\\wedge', '논리곱(그리고)', 'logical and', 'logic', 2],
  ['\\vee', '논리합(또는)', 'logical or', 'logic', 2],
  ['\\neg', '부정', 'negation', 'logic', 2],
  ['\\therefore', '따라서', 'therefore', 'logic', 1],
  ['\\because', '왜냐하면', 'because', 'logic', 1],
  // 기하
  ['\\perp', '수직', 'perpendicular', 'geometry', 1],
  ['\\parallel', '평행', 'parallel', 'geometry', 1],
  ['\\angle', '각', 'angle', 'geometry', 1],
  ['\\triangle', '삼각형', 'triangle', 'geometry', 1],
  // 그리스 (소문자)
  ['\\alpha', '알파', 'alpha', 'greek', 1],
  ['\\beta', '베타', 'beta', 'greek', 1],
  ['\\gamma', '감마', 'gamma', 'greek', 1],
  ['\\theta', '세타', 'theta', 'greek', 1],
  ['\\pi', '파이', 'pi', 'greek', 1],
  ['\\phi', '파이(피)', 'phi', 'greek', 1],
  ['\\lambda', '람다', 'lambda', 'greek', 1],
  ['\\mu', '뮤', 'mu', 'greek', 1],
  ['\\sigma', '시그마', 'sigma', 'greek', 1],
  ['\\omega', '오메가', 'omega', 'greek', 1],
  // 그리스 (대문자)
  ['\\Delta', '델타(대문자)', 'Delta', 'greek', 1],
  ['\\Sigma', '시그마(대문자)', 'Sigma', 'greek', 1],
  ['\\Omega', '오메가(대문자)', 'Omega', 'greek', 1],
  ['\\Pi', '파이(대문자)', 'Pi', 'greek', 1],

  // ===== 괄호 (bracket) =====
  ['\\left( \\right)', '소괄호', 'parentheses', 'bracket', 1],
  ['\\left[ \\right]', '대괄호', 'brackets', 'bracket', 1],
  ['\\left\\{ \\right\\}', '중괄호', 'braces', 'bracket', 1],
  ['\\left| \\right|', '절댓값', 'absolute value', 'bracket', 1],
  ['\\left\\langle \\right\\rangle', '꺾쇠(내적)', 'angle brackets', 'bracket', 2,
    { symbol: '⟨⟩', displayLatex: '\\left\\langle x \\right\\rangle', cursorOffset: 14, mathClass: 'structured' }],
  ['\\left\\lfloor \\right\\rfloor', '바닥(버림)', 'floor', 'bracket', 2,
    { symbol: '⌊⌋', displayLatex: '\\left\\lfloor x \\right\\rfloor', cursorOffset: 13, mathClass: 'structured' }],
  ['\\left\\lceil \\right\\rceil', '천장(올림)', 'ceiling', 'bracket', 2,
    { symbol: '⌈⌉', displayLatex: '\\left\\lceil x \\right\\rceil', cursorOffset: 12, mathClass: 'structured' }],
];

// ─── 기본 4개 표시 카테고리 ───
const DEFAULT_CATEGORIES = [
  { id: 'basic', label: '기본', fields: ['arithmetic', 'vector'] },
  { id: 'calculus', label: '미적분', fields: ['calculus', 'analysis'] },
  { id: 'symbols', label: '기호', fields: ['algebra', 'set', 'logic', 'geometry', 'greek'] },
  { id: 'brackets', label: '괄호', fields: ['bracket'] },
];

// ─── 빌드 ───
function renders(latex) {
  try { katex.renderToString(latex, { throwOnError: true }); return true; }
  catch (_e) { try { katex.renderToString(latex + '{x}', { throwOnError: true }); return true; } catch (_e2) { return false; } }
}

const out = [];
const warnings = [];
let id = 1;
for (const [latex, ko, en, field, tier, override, variant] of CURATION) {
  const seedRec = byLatex.get(latex) || (override ? null : undefined);
  if (seedRec === undefined && !override) { warnings.push(`시드에 없고 override도 없음: ${latex}`); continue; }

  const symbol = override?.symbol ?? seedRec?.unicode ?? '';
  const displayLatex = override?.displayLatex ?? seedRec?.displayLatex;
  const cursorOffset = override?.cursorOffset ?? seedRec?.cursorOffset;
  const mathClass = override?.mathClass ?? seedRec?.mathClass ?? 'mathord';
  const katexSupported = renders(latex);
  if (!katexSupported) warnings.push(`렌더 실패: ${latex}`);

  const rec = { id: id++, latex, symbol, mathClass, field, tier, name: { ko, en }, katexSupported };
  if (displayLatex) rec.displayLatex = displayLatex;
  if (cursorOffset !== undefined) rec.cursorOffset = cursorOffset;
  if (variant) rec.variants = [variant];
  out.push(rec);
}

// ─── lib/math-symbols.ts 생성 ───
const header = `/**
 * lib/math-symbols.ts — Phase 40 수식 기호 데이터 (고빈도 큐레이션 v1)
 *
 * ⚠️ 자동 생성 파일. 직접 수정 금지.
 *    재생성: node scripts/build-curated-symbols.cjs
 *    데이터: latex/symbol/mathClass = KaTeX(MIT) 시드 추출 + 렌더 검증
 *            field/tier/name(ko,en) = 수작업 큐레이션
 *    출처/파이프라인: docs/phasedocs/Phase40_기호설정화면_설계_최신.md §18
 *
 * 현재: ${out.length}개 (기본 4개 카테고리). 전체 ~552개 시드는 lib/data/katex-symbols.seed.json.
 */
import type { MathSymbol, PaletteCategory } from '../types/toolbar-config';

export const DEFAULT_CATEGORIES: PaletteCategory[] = ${JSON.stringify(DEFAULT_CATEGORIES, null, 2)};

export const CURATED_SYMBOLS: MathSymbol[] = ${JSON.stringify(out, null, 2)};

/** field → 기본 카테고리 id 역매핑 */
export const FIELD_TO_CATEGORY: Record<string, string> = ${JSON.stringify(
  Object.fromEntries(DEFAULT_CATEGORIES.flatMap(c => c.fields.map(f => [f, c.id]))), null, 2)};
`;

fs.writeFileSync(path.join(ROOT, 'lib', 'math-symbols.ts'), header, 'utf8');

// ─── 리포트 ───
console.log('큐레이션 기호 :', out.length);
const perCat = {};
for (const s of out) {
  const cat = DEFAULT_CATEGORIES.find(c => c.fields.includes(s.field))?.label || '미분류';
  perCat[cat] = (perCat[cat] || 0) + 1;
}
console.log('카테고리 분포 :', perCat);
console.log('렌더 검증     :', out.filter(s => s.katexSupported).length, '/', out.length, '통과');
console.log('경고          :', warnings.length ? warnings : '없음');
console.log('→ 생성: lib/math-symbols.ts');
