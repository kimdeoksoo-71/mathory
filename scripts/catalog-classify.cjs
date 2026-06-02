/**
 * catalog-classify.cjs — 기호를 20개 카탈로그 카테고리로 분류 (첨부 문서 기준)
 *
 * 우선순위: 명시 매핑(EXPLICIT) → 구조/악센트/함수/괄호/그리스/글꼴/수체계/점/화살표 규칙 → field 폴백.
 * 출처: latex-math-symbol-categories.md (Comprehensive LaTeX Symbol List 요약, 20 카테고리).
 */
'use strict';

const CATALOG_CATEGORIES = [
  { id: 1, ko: '그리스 문자', en: 'Greek Letters' },
  { id: 2, ko: '기본 연산자', en: 'Basic & Unary Operators' },
  { id: 3, ko: '이항 연산자', en: 'Binary Operators' },
  { id: 4, ko: '큰 연산자', en: 'Big Operators' },
  { id: 5, ko: '관계 기호', en: 'Relation Symbols' },
  { id: 6, ko: '부등호', en: 'Inequality Symbols' },
  { id: 7, ko: '집합 기호', en: 'Set Symbols' },
  { id: 8, ko: '수 체계', en: 'Number Sets' },
  { id: 9, ko: '논리 기호', en: 'Logic Symbols' },
  { id: 10, ko: '화살표', en: 'Arrows' },
  { id: 11, ko: '괄호·구분자', en: 'Delimiters & Brackets' },
  { id: 12, ko: '첨자·악센트', en: 'Accents' },
  { id: 13, ko: '점·생략 기호', en: 'Dots & Ellipses' },
  { id: 14, ko: '분수·근호·첨자 구조', en: 'Fractions, Roots & Scripts' },
  { id: 15, ko: '미적분 기호', en: 'Calculus' },
  { id: 16, ko: '함수·연산 이름', en: 'Named Functions' },
  { id: 21, ko: '확률·통계', en: 'Probability & Statistics' },
  { id: 17, ko: '기하 기호', en: 'Geometry Symbols' },
  { id: 18, ko: '문자형 기호', en: 'Letter-like Symbols' },
  { id: 19, ko: '수학 글꼴', en: 'Math Alphabets / Fonts' },
  { id: 20, ko: '기타 기호', en: 'Miscellaneous Symbols' },
];

// 명시 매핑 (문서의 명령어 목록 → 단일 카테고리. 충돌은 1차 용도로 해소)
const BY_CAT = {
  2: ['+', '-', '\\pm', '\\mp', '\\times', '\\div', '\\cdot', '\\ast', '\\centerdot', '\\cdotp'],
  3: ['\\cup', '\\cap', '\\uplus', '\\sqcap', '\\sqcup', '\\oplus', '\\otimes', '\\ominus', '\\oslash',
      '\\odot', '\\star', '\\circ', '\\bullet', '\\wr', '\\rhd', '\\lhd', '\\amalg', '\\diamond',
      '\\bigtriangleup', '\\bigtriangledown', '\\triangleleft', '\\triangleright', '\\boxplus',
      '\\boxminus', '\\boxtimes', '\\boxdot', '\\ltimes', '\\rtimes', '\\dotplus', '\\smallsetminus',
      '\\barwedge', '\\veebar', '\\curlywedge', '\\curlyvee', '\\divideontimes', '\\Cap', '\\Cup',
      '\\doublebarwedge', '\\circledast', '\\circledcirc', '\\circleddash', '\\intercal', '\\unlhd', '\\unrhd'],
  4: ['\\sum', '\\prod', '\\coprod', '\\bigcup', '\\bigcap',
      '\\bigsqcup', '\\bigoplus', '\\bigotimes', '\\bigodot', '\\bigvee', '\\bigwedge', '\\biguplus'],
  5: ['=', '\\neq', '\\ne', '\\approx', '\\equiv', '\\sim', '\\simeq', '\\propto', '\\doteq', '\\asymp',
      '\\bowtie', '\\thickapprox', '\\approxeq', '\\fallingdotseq', '\\risingdotseq', '\\doteqdot',
      '\\eqcirc', '\\circeq', '\\triangleq', '\\backsim', '\\thicksim', '\\precsim', '\\succsim',
      '\\prec', '\\succ', '\\preceq', '\\succeq', '\\backsimeq', '\\eqsim', '\\Bumpeq', '\\bumpeq', '\\between'],
  6: ['<', '>', '\\lt', '\\gt', '\\gggtr', '\\llless', '\\gnapprox', '\\lnapprox', '\\gnsim', '\\lnsim',
      '\\leq', '\\geq', '\\le', '\\ge', '\\leqq', '\\geqq', '\\ll', '\\gg', '\\lll', '\\ggg',
      '\\lesssim', '\\gtrsim', '\\lessapprox', '\\gtrapprox', '\\lesseqgtr', '\\gtreqless', '\\nless',
      '\\ngtr', '\\nleq', '\\ngeq', '\\leqslant', '\\geqslant', '\\lneq', '\\gneq', '\\lneqq', '\\gneqq',
      '\\lessgtr', '\\gtrless', '\\lessdot', '\\gtrdot', '\\nleqq', '\\ngeqq', '\\nleqslant', '\\ngeqslant',
      '\\lvertneqq', '\\gvertneqq', '\\lesseqqgtr', '\\gtreqqless', '\\eqslantless', '\\eqslantgtr'],
  7: ['\\in', '\\notin', '\\ni', '\\owns', '\\subset', '\\supset', '\\subseteq', '\\supseteq',
      '\\subsetneq', '\\supsetneq', '\\emptyset', '\\varnothing', '\\setminus', '\\complement',
      '\\sqsubset', '\\sqsupset', '\\sqsubseteq', '\\sqsupseteq', '\\Subset', '\\Supset', '\\subseteqq',
      '\\supseteqq', '\\subsetneqq', '\\supsetneqq', '\\nsubseteq', '\\nsupseteq', '\\notni', '\\not\\in'],
  9: ['\\land', '\\wedge', '\\lor', '\\vee', '\\neg', '\\lnot', '\\implies', '\\iff', '\\forall',
      '\\exists', '\\nexists', '\\vdash', '\\models', '\\top', '\\bot', '\\therefore', '\\because',
      '\\blacksquare', '\\Vdash', '\\Vvdash', '\\dashv', '\\nvdash', '\\nvDash', '\\vDash', '\\Rrightarrow'],
  15: ['\\partial', '\\nabla', '\\prime', '\\backprime',
       // 적분 일체 (기호 + \int_{}^{} 템플릿)
       '\\int', '\\iint', '\\iiint', '\\oint', '\\oiint', '\\oiiint', '\\smallint', '\\intop',
       '\\int_{}^{}', '\\iint_{}^{}', '\\oint_{}^{}',
       // lim 일체 (\lim 연산자 + \lim_{x \to} 템플릿)
       '\\lim', '\\lim_{}', '\\limsup', '\\liminf', '\\varlimsup', '\\varliminf', '\\injlim', '\\projlim',
       // d/dx
       '\\frac{d}{dx}'],
  16: ['\\sup', '\\inf'],
  21: ['{}_{}\\mathrm{P}_{}', '{}_{}\\mathrm{C}_{}', '{}_{}\\Pi_{}', '{}_{}\\mathrm{H}_{}',
       '\\mathrm{P}()', '\\mathrm{V}()', '\\sigma()', '\\mathrm{N}()', '\\mathrm{B}()'],
  17: ['\\angle', '\\measuredangle', '\\perp', '\\parallel', '\\nparallel', '\\triangle', '\\square',
       '\\cong', '\\frown', '\\bigcirc', '\\sphericalangle', '\\vartriangle', '\\smile', '\\blacktriangle',
       '\\blacktriangledown', '\\diagup', '\\diagdown', '\\shortparallel', '\\nshortparallel',
       // 선분/방향 표기 (기하)
       '\\bar{}', '\\overrightarrow{}', '\\overline{}'],
  8: ['ℕ', 'ℤ', 'ℚ', 'ℝ', 'ℂ', 'ℙ', 'ℍ', '𝔽', '\\N', '\\Z', '\\Q', '\\R', '\\C'],
  11: ['\\Vert', '\\|', '\\vert', '\\lVert', '\\rVert', '\\lvert', '\\rvert', '\\|'],
  18: ['\\infty', '\\hbar', '\\hslash', '\\aleph', '\\beth', '\\gimel', '\\daleth', '\\ell', '\\Re',
       '\\Im', '\\wp', '\\Finv', '\\Game', '\\mho', '\\eth', '\\imath', '\\jmath',
       'ℎ', 'ℏ', 'ℓ', 'ȷ', 'ı', '\\@imath', '\\@jmath'],
  20: ['\\permil', '\\%', '\\checkmark', '\\flat', '\\natural', '\\sharp', '\\dagger', '\\ddagger',
       '\\S', '\\P', '\\clubsuit', '\\diamondsuit', '\\heartsuit', '\\spadesuit', '\\maltese',
       '\\surd', '\\backslash', '\\pounds', '\\mathsterling', '\\yen', '\\degree', '\\circledR',
       '\\circledS', '\\bigstar', '\\lightning', '\\angle\\,', '\\copyright'],
};
const EXPLICIT = {};
for (const [cat, list] of Object.entries(BY_CAT)) for (const cmd of list) EXPLICIT[cmd] = Number(cat);

const DOTS = new Set(['\\ldots', '\\cdots', '\\vdots', '\\ddots', '\\dots', '\\dotsc', '\\dotsb', '\\dotsm', '\\dotsi', '\\mathellipsis', '\\varvdots', '\\@cdots']);
const ACCENTS = new Set(['\\hat', '\\bar', '\\vec', '\\dot', '\\ddot', '\\tilde', '\\acute', '\\grave', '\\check', '\\breve', '\\widehat', '\\widetilde', '\\overline', '\\underline', '\\overrightarrow', '\\overleftarrow', '\\mathring', '\\dddot', '\\ddddot']);

function classify(sym) {
  const L = sym.latex;

  if (EXPLICIT[L] != null) return EXPLICIT[L];
  if (DOTS.has(L)) return 13;
  if (ACCENTS.has(L) || sym.mathClass === 'accent-token') return 12;

  // 글꼴 명령(\mathbb{} 등 템플릿) → 글꼴 (구조형 검사보다 먼저)
  if (/^\\(math(bb|cal|frak|bf|it|rm|sf|tt|scr)|boldsymbol|pmb)\b/.test(L)) return 19;
  if (/[ℕℤℚℝℂℙℍ𝔽𝔼]/.test(sym.symbol || '')) return 8;

  // 구조형(분수·근호·첨자) vs 자동 괄호
  if (sym.mathClass === 'structured') {
    if (/langle|lfloor|lceil|\\left|\\right/.test(L)) return 11;
    return 14;
  }

  // 함수
  if (sym.field === 'function') return 16;

  // 괄호·구분자
  if (sym.mathClass === 'open' || sym.mathClass === 'close' || sym.field === 'bracket') return 11;

  // 화살표
  if (/arrow|harpoon|mapsto|hook|nearrow|nwarrow|searrow|swarrow|leadsto|rightleftharpoons|leftrightharpoons|\\to\b|\\gets\b|leftrightarrows|rightrightarrows|leftleftarrows|downdownarrows|upuparrows|rightsquigarrow|curvearrow|circlearrow/i.test(L)) return 10;

  // 그리스
  if (sym.field === 'greek') return 1;

  // field 폴백
  switch (sym.field) {
    case 'logic': return 9;
    case 'set': return 7;
    case 'geometry': return 17;
    case 'calculus': return 15;
    case 'analysis': return 15;
    case 'discrete': return 4;
    case 'linear-algebra': return 3;
    case 'vector': return 17;
    case 'probability': return 21;
    case 'statistics': return 21;
    case 'arithmetic': return 2;
    case 'algebra': return 5;
    default: return 20;
  }
}

module.exports = { CATALOG_CATEGORIES, classify };
