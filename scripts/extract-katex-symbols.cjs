/**
 * extract-katex-symbols.cjs — Phase 40 골격 시드 생성기
 *
 * 출처: node_modules/katex/src/symbols.js (KaTeX, MIT License)
 *  - 각 defineSymbol(mode, font, group, replace, name) 리터럴 호출을 샌드박스 평가로 추출
 *  - for-loop 내 변수 호출(영문자/숫자/그리스 생성 등)은 eval 실패 → 자동 스킵
 *  - 추출된 LaTeX 명령을 실제 katex.renderToString으로 렌더 검증 → katexSupported 확정
 *  - 구조형 명령(\frac, \sqrt, \int …)은 displayLatex 포함 수작업 오버레이로 보강
 *
 * 산출: lib/data/katex-symbols.seed.json
 * 주의: 본체는 KaTeX(MIT)에서만 추출 → 라이선스 청정. unicode-math(LPPL)는 미사용.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', 'katex', 'src', 'symbols.js');
const OUT_DIR = path.join(ROOT, 'lib', 'data');
const OUT = path.join(OUT_DIR, 'katex-symbols.seed.json');
const katexVersion = require(path.join(ROOT, 'node_modules', 'katex', 'package.json')).version;

const raw = fs.readFileSync(SRC, 'utf8');

// symbols.js 상단의 상수와 동일하게 샌드박스 구성
const SANDBOX = `
const math="math",text="text",main="main",ams="ams";
const accent="accent-token",bin="bin",close="close",inner="inner",mathord="mathord",
      op="op-token",open="open",punct="punct",rel="rel",spacing="spacing",textord="textord";
`;

// ── 1. defineSymbol 리터럴 호출 추출 (라인 기반, 다중행 호출도 누적 처리) ──
const lines = raw.split('\n');
let section = null;        // 직전 // 주석을 KaTeX 원본 섹션 힌트로 보관
let buf = '';
const extracted = [];
let skipped = 0;

for (const line of lines) {
  const t = line.trim();
  if (!buf) {
    const cm = t.match(/^\/\/\s*(.+?)\s*$/);
    if (cm) { section = cm[1]; continue; }
    if (!t.startsWith('defineSymbol(')) continue;
  }
  buf += (buf ? ' ' : '') + t;
  if (!buf.includes(');')) continue;       // 호출이 다음 줄로 이어짐

  const call = buf.slice(buf.indexOf('defineSymbol('), buf.lastIndexOf(');') + 1);
  buf = '';
  try {
    const fn = new Function(
      SANDBOX +
      'let __r=null; function defineSymbol(mode,font,group,replace,name){__r={mode,font,group,replace,name};} ' +
      call + '; return __r;'
    );
    const r = fn();
    if (r && typeof r.name === 'string') extracted.push({ ...r, section });
  } catch (_e) {
    skipped++;                              // 루프 변수 호출 등 → 스킵
  }
}

// ── 2. 렌더 검증 (support_table 문서 불신, 실렌더로 판정) ──
function renderOnce(latex) {
  try { katex.renderToString(latex, { throwOnError: true }); return true; }
  catch (_e) { return false; }
}
// 단독 렌더 실패 시 인자({x})를 붙여 재시도 — 악센트 등 인자 필요 명령의 위양성 방지
function renders(latex) {
  if (renderOnce(latex)) return true;
  return renderOnce(latex + '{x}');
}

// math 모드 우선, (mode,name) 중복 제거
const seen = new Set();
const symbols = [];
let renderFail = 0;
for (const e of extracted.sort((a, b) => (a.mode === 'math' ? -1 : 1))) {
  const key = e.mode + '|' + e.name;
  if (seen.has(key)) continue;
  seen.add(key);
  const ok = renders(e.name);
  if (!ok) renderFail++;
  symbols.push({
    latex: e.name,                 // 삽입용 (예: "\\equiv")
    unicode: e.replace || null,    // 표시용 유니코드 (예: "≡")
    mathClass: e.group,            // 구조적 클래스 (rel/bin/op-token/open/…)
    mode: e.mode,                  // math | text
    font: e.font,                  // main | ams
    katexSection: e.section,       // KaTeX 원본 섹션 힌트(분야 부여 참고용)
    katexSupported: ok,
    // displayLatex 없음 → 하이브리드 렌더에서 unicode passthrough (단일 기호 ~60%)
  });
}

// ── 3. 구조형 명령 오버레이 (displayLatex 포함, 표준 LaTeX = 라이선스 무관) ──
const STRUCTURED_RAW = [
  ['\\frac{}{}',        '\\frac{a}{b}',                                   6,  'fraction',        'arithmetic'],
  ['\\dfrac{}{}',       '\\dfrac{a}{b}',                                  7,  'display fraction','arithmetic'],
  ['\\tfrac{}{}',       '\\tfrac{a}{b}',                                  7,  'text fraction',   'arithmetic'],
  ['\\sqrt{}',          '\\sqrt{x}',                                      6,  'square root',     'arithmetic'],
  ['\\sqrt[]{}',        '\\sqrt[n]{x}',                                   6,  'nth root',        'arithmetic'],
  ['^{}',               'x^{n}',                                          2,  'superscript',     'arithmetic'],
  ['_{}',               'x_{n}',                                          2,  'subscript',       'arithmetic'],
  ['\\overline{}',      '\\overline{AB}',                                10,  'overline',        'geometry'],
  ['\\vec{}',           '\\vec{v}',                                       5,  'vector',          'vector'],
  ['\\overrightarrow{}','\\overrightarrow{AB}',                          15,  'ray/vector',      'vector'],
  ['\\hat{}',           '\\hat{x}',                                       5,  'hat',             'statistics'],
  ['\\int_{}^{}',       '\\int_{a}^{b}',                                  6,  'definite integral','calculus'],
  ['\\iint_{}^{}',      '\\iint_{D}',                                     7,  'double integral', 'calculus'],
  ['\\oint_{}^{}',      '\\oint_{C}',                                     7,  'contour integral','calculus'],
  ['\\sum_{}^{}',       '\\sum_{k=1}^{n}',                                6,  'summation',       'calculus'],
  ['\\prod_{}^{}',      '\\prod_{k=1}^{n}',                               7,  'product',         'calculus'],
  ['\\lim_{}',          '\\lim_{x \\to 0}',                               6,  'limit',           'calculus'],
  ['\\frac{d}{dx}',     '\\frac{d}{dx}',                                 12,  'derivative',      'calculus'],
  ['\\binom{}{}',       '\\binom{n}{r}',                                  7,  'binomial',        'discrete'],
  ['{}_{}\\mathrm{P}_{}','{}_{n}\\mathrm{P}_{r}',                         1,  'permutation',     'discrete'],
  ['{}_{}\\mathrm{C}_{}','{}_{n}\\mathrm{C}_{r}',                         1,  'combination',     'discrete'],
  ['\\begin{pmatrix} \\end{pmatrix}', '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', 15, 'matrix (paren)', 'linear-algebra'],
  ['\\begin{bmatrix} \\end{bmatrix}', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', 15, 'matrix (bracket)', 'linear-algebra'],
  ['\\begin{cases} \\end{cases}',     '\\begin{cases}a&x>0\\\\b&x\\le 0\\end{cases}', 14, 'cases', 'analysis'],
  ['\\left( \\right)',  '\\left( x \\right)',                             7,  'auto paren',      'arithmetic'],
  ['\\left[ \\right]',  '\\left[ x \\right]',                             7,  'auto bracket',    'arithmetic'],
  ['\\left\\{ \\right\\}','\\left\\{ x \\right\\}',                       8,  'auto brace',      'set'],
  ['\\left| \\right|',  '\\left| x \\right|',                            7,  'absolute value',  'arithmetic'],
];
const structured = STRUCTURED_RAW.map(([latex, displayLatex, cursorOffset, en, field]) => ({
  latex,
  displayLatex,
  cursorOffset,
  mathClass: 'structured',
  en,
  field,
  katexSupported: renders(displayLatex),
}));
const structFail = structured.filter(s => !s.katexSupported);

// ── 4. 산출 ──
fs.mkdirSync(OUT_DIR, { recursive: true });
const payload = {
  _meta: {
    generatedFrom: 'node_modules/katex/src/symbols.js',
    katexVersion,
    license: 'MIT (KaTeX, Copyright Khan Academy and contributors)',
    note: 'Single symbols extracted from KaTeX defineSymbol() calls; structured overlay is standard LaTeX. unicode-math(LPPL) not used.',
    generatedBy: 'scripts/extract-katex-symbols.cjs',
  },
  counts: {
    singleSymbols: symbols.length,
    structured: structured.length,
    skippedNonLiteral: skipped,
    renderFailSingle: renderFail,
    renderFailStructured: structFail.length,
  },
  symbols,
  structured,
};
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

// ── 5. 콘솔 리포트 ──
console.log('KaTeX version :', katexVersion);
console.log('단일 기호 추출 :', symbols.length, '(중복제거 후)');
console.log('  ├ math 모드  :', symbols.filter(s => s.mode === 'math').length);
console.log('  └ text 모드  :', symbols.filter(s => s.mode === 'text').length);
console.log('비리터럴 스킵   :', skipped, '(for-loop 생성 영문자/숫자/그리스 등)');
console.log('렌더 실패(단일):', renderFail);
console.log('구조형 오버레이:', structured.length, '/ 렌더 실패:', structFail.length,
            structFail.length ? '→ ' + structFail.map(s => s.latex).join(', ') : '');
const byClass = {};
for (const s of symbols) byClass[s.mathClass] = (byClass[s.mathClass] || 0) + 1;
console.log('mathClass 분포 :', byClass);
console.log('→ 산출:', path.relative(ROOT, OUT));
