/**
 * lib/math-symbols.ts — Phase 40 수식 기호 데이터 (고빈도 큐레이션 v1)
 *
 * ⚠️ 자동 생성 파일. 직접 수정 금지.
 *    재생성: node scripts/build-curated-symbols.cjs
 *    데이터: latex/symbol/mathClass = KaTeX(MIT) 시드 추출 + 렌더 검증
 *            field/tier/name(ko,en) = 수작업 큐레이션
 *    출처/파이프라인: docs/phasedocs/Phase40_기호설정화면_설계_최신.md §18
 *
 * 현재: 74개 (기본 4개 카테고리). 전체 ~552개 시드는 lib/data/katex-symbols.seed.json.
 */
import type { MathSymbol, PaletteCategory } from '../types/toolbar-config';

export const DEFAULT_CATEGORIES: PaletteCategory[] = [
  {
    "id": "basic",
    "label": "기본",
    "fields": [
      "arithmetic",
      "vector"
    ]
  },
  {
    "id": "calculus",
    "label": "미적분",
    "fields": [
      "calculus",
      "analysis"
    ]
  },
  {
    "id": "symbols",
    "label": "기호",
    "fields": [
      "algebra",
      "set",
      "logic",
      "geometry",
      "greek"
    ]
  },
  {
    "id": "brackets",
    "label": "괄호",
    "fields": [
      "bracket"
    ]
  }
];

export const CURATED_SYMBOLS: MathSymbol[] = [
  {
    "id": 1,
    "latex": "\\frac{}{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "분수",
      "en": "fraction"
    },
    "katexSupported": true,
    "displayLatex": "\\frac{a}{b}",
    "cursorOffset": 6
  },
  {
    "id": 2,
    "latex": "\\dfrac{}{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "큰 분수",
      "en": "display fraction"
    },
    "katexSupported": true,
    "displayLatex": "\\dfrac{a}{b}",
    "cursorOffset": 7
  },
  {
    "id": 3,
    "latex": "\\sqrt{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "제곱근",
      "en": "square root"
    },
    "katexSupported": true,
    "displayLatex": "\\sqrt{x}",
    "cursorOffset": 6
  },
  {
    "id": 4,
    "latex": "\\sqrt[]{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "거듭제곱근",
      "en": "nth root"
    },
    "katexSupported": true,
    "displayLatex": "\\sqrt[n]{x}",
    "cursorOffset": 6
  },
  {
    "id": 5,
    "latex": "^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "거듭제곱",
      "en": "superscript"
    },
    "katexSupported": true,
    "displayLatex": "x^{n}",
    "cursorOffset": 2
  },
  {
    "id": 6,
    "latex": "_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "아래첨자",
      "en": "subscript"
    },
    "katexSupported": true,
    "displayLatex": "x_{n}",
    "cursorOffset": 2
  },
  {
    "id": 7,
    "latex": "\\overline{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "위끝선",
      "en": "overline"
    },
    "katexSupported": true,
    "displayLatex": "\\overline{AB}",
    "cursorOffset": 10
  },
  {
    "id": 8,
    "latex": "\\vec{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "vector",
    "tier": 1,
    "name": {
      "ko": "벡터",
      "en": "vector"
    },
    "katexSupported": true,
    "displayLatex": "\\vec{v}",
    "cursorOffset": 5
  },
  {
    "id": 9,
    "latex": "\\overrightarrow{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "vector",
    "tier": 1,
    "name": {
      "ko": "벡터(화살표)",
      "en": "overrightarrow"
    },
    "katexSupported": true,
    "displayLatex": "\\overrightarrow{AB}",
    "cursorOffset": 15
  },
  {
    "id": 10,
    "latex": "\\pm",
    "symbol": "±",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "플러스마이너스",
      "en": "plus-minus"
    },
    "katexSupported": true
  },
  {
    "id": 11,
    "latex": "\\mp",
    "symbol": "∓",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "마이너스플러스",
      "en": "minus-plus"
    },
    "katexSupported": true
  },
  {
    "id": 12,
    "latex": "\\times",
    "symbol": "×",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "곱셈",
      "en": "multiplication"
    },
    "katexSupported": true
  },
  {
    "id": 13,
    "latex": "\\div",
    "symbol": "÷",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "나눗셈",
      "en": "division"
    },
    "katexSupported": true
  },
  {
    "id": 14,
    "latex": "\\cdot",
    "symbol": "⋅",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "가운뎃점",
      "en": "center dot"
    },
    "katexSupported": true
  },
  {
    "id": 15,
    "latex": "\\int_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "정적분",
      "en": "definite integral"
    },
    "katexSupported": true,
    "displayLatex": "\\int_{a}^{b}",
    "cursorOffset": 6
  },
  {
    "id": 16,
    "latex": "\\iint_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "이중적분",
      "en": "double integral"
    },
    "katexSupported": true,
    "displayLatex": "\\iint_{D}",
    "cursorOffset": 7
  },
  {
    "id": 17,
    "latex": "\\oint_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "선적분",
      "en": "contour integral"
    },
    "katexSupported": true,
    "displayLatex": "\\oint_{C}",
    "cursorOffset": 7
  },
  {
    "id": 18,
    "latex": "\\sum_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 1,
    "name": {
      "ko": "시그마(합)",
      "en": "summation"
    },
    "katexSupported": true,
    "displayLatex": "\\sum_{k=1}^{n}",
    "cursorOffset": 6
  },
  {
    "id": 19,
    "latex": "\\prod_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "곱(파이)",
      "en": "product"
    },
    "katexSupported": true,
    "displayLatex": "\\prod_{k=1}^{n}",
    "cursorOffset": 7
  },
  {
    "id": 20,
    "latex": "\\lim_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "analysis",
    "tier": 1,
    "name": {
      "ko": "극한",
      "en": "limit"
    },
    "katexSupported": true,
    "displayLatex": "\\lim_{x \\to 0}",
    "cursorOffset": 6
  },
  {
    "id": 21,
    "latex": "\\frac{d}{dx}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "미분",
      "en": "derivative"
    },
    "katexSupported": true,
    "displayLatex": "\\frac{d}{dx}",
    "cursorOffset": 12
  },
  {
    "id": 22,
    "latex": "\\partial",
    "symbol": "∂",
    "mathClass": "textord",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "편미분",
      "en": "partial derivative"
    },
    "katexSupported": true
  },
  {
    "id": 23,
    "latex": "\\nabla",
    "symbol": "∇",
    "mathClass": "textord",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "나블라",
      "en": "nabla (del)"
    },
    "katexSupported": true
  },
  {
    "id": 24,
    "latex": "\\infty",
    "symbol": "∞",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 1,
    "name": {
      "ko": "무한대",
      "en": "infinity"
    },
    "katexSupported": true
  },
  {
    "id": 25,
    "latex": "\\to",
    "symbol": "→",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 1,
    "name": {
      "ko": "화살표(접근)",
      "en": "approaches"
    },
    "katexSupported": true
  },
  {
    "id": 26,
    "latex": "\\propto",
    "symbol": "∝",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "비례",
      "en": "proportional to"
    },
    "katexSupported": true
  },
  {
    "id": 27,
    "latex": "\\leq",
    "symbol": "≤",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "이하",
      "en": "less than or equal"
    },
    "katexSupported": true
  },
  {
    "id": 28,
    "latex": "\\geq",
    "symbol": "≥",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "이상",
      "en": "greater than or equal"
    },
    "katexSupported": true
  },
  {
    "id": 29,
    "latex": "\\neq",
    "symbol": "≠",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "같지 않음",
      "en": "not equal"
    },
    "katexSupported": true
  },
  {
    "id": 30,
    "latex": "\\approx",
    "symbol": "≈",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "근사",
      "en": "approximately equal"
    },
    "katexSupported": true
  },
  {
    "id": 31,
    "latex": "\\equiv",
    "symbol": "≡",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "합동·항등",
      "en": "equivalent / identical"
    },
    "katexSupported": true
  },
  {
    "id": 32,
    "latex": "\\sim",
    "symbol": "∼",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "닮음",
      "en": "similar"
    },
    "katexSupported": true
  },
  {
    "id": 33,
    "latex": "\\fallingdotseq",
    "symbol": "≒",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "근삿값(≒)",
      "en": "approximately equal (KR ≒)"
    },
    "katexSupported": true,
    "variants": [
      {
        "region": "kr",
        "note": "한국 교과서 근삿값 기호 ≒"
      }
    ]
  },
  {
    "id": 34,
    "latex": "\\in",
    "symbol": "∈",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "원소",
      "en": "element of"
    },
    "katexSupported": true
  },
  {
    "id": 35,
    "latex": "\\notin",
    "symbol": "∉",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "원소 아님",
      "en": "not an element of"
    },
    "katexSupported": true
  },
  {
    "id": 36,
    "latex": "\\subset",
    "symbol": "⊂",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "진부분집합",
      "en": "proper subset"
    },
    "katexSupported": true,
    "variants": [
      {
        "region": "kr",
        "note": "한국 교과서: ⊂를 부분집합(같음 포함)으로 사용하기도 함"
      }
    ]
  },
  {
    "id": 37,
    "latex": "\\subseteq",
    "symbol": "⊆",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "부분집합",
      "en": "subset or equal"
    },
    "katexSupported": true
  },
  {
    "id": 38,
    "latex": "\\supset",
    "symbol": "⊃",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "진상위집합",
      "en": "proper superset"
    },
    "katexSupported": true
  },
  {
    "id": 39,
    "latex": "\\cup",
    "symbol": "∪",
    "mathClass": "bin",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "합집합",
      "en": "union"
    },
    "katexSupported": true
  },
  {
    "id": 40,
    "latex": "\\cap",
    "symbol": "∩",
    "mathClass": "bin",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "교집합",
      "en": "intersection"
    },
    "katexSupported": true
  },
  {
    "id": 41,
    "latex": "\\emptyset",
    "symbol": "∅",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "공집합",
      "en": "empty set"
    },
    "katexSupported": true
  },
  {
    "id": 42,
    "latex": "\\setminus",
    "symbol": "∖",
    "mathClass": "bin",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "차집합",
      "en": "set minus"
    },
    "katexSupported": true
  },
  {
    "id": 43,
    "latex": "\\forall",
    "symbol": "∀",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "모든",
      "en": "for all"
    },
    "katexSupported": true
  },
  {
    "id": 44,
    "latex": "\\exists",
    "symbol": "∃",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "존재",
      "en": "there exists"
    },
    "katexSupported": true
  },
  {
    "id": 45,
    "latex": "\\wedge",
    "symbol": "∧",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리곱(그리고)",
      "en": "logical and"
    },
    "katexSupported": true
  },
  {
    "id": 46,
    "latex": "\\vee",
    "symbol": "∨",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리합(또는)",
      "en": "logical or"
    },
    "katexSupported": true
  },
  {
    "id": 47,
    "latex": "\\neg",
    "symbol": "¬",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "부정",
      "en": "negation"
    },
    "katexSupported": true
  },
  {
    "id": 48,
    "latex": "\\therefore",
    "symbol": "∴",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "따라서",
      "en": "therefore"
    },
    "katexSupported": true
  },
  {
    "id": 49,
    "latex": "\\because",
    "symbol": "∵",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "왜냐하면",
      "en": "because"
    },
    "katexSupported": true
  },
  {
    "id": 50,
    "latex": "\\perp",
    "symbol": "⊥",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "수직",
      "en": "perpendicular"
    },
    "katexSupported": true
  },
  {
    "id": 51,
    "latex": "\\parallel",
    "symbol": "∥",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "평행",
      "en": "parallel"
    },
    "katexSupported": true
  },
  {
    "id": 52,
    "latex": "\\angle",
    "symbol": "∠",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "각",
      "en": "angle"
    },
    "katexSupported": true
  },
  {
    "id": 53,
    "latex": "\\triangle",
    "symbol": "△",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "삼각형",
      "en": "triangle"
    },
    "katexSupported": true
  },
  {
    "id": 54,
    "latex": "\\alpha",
    "symbol": "α",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "알파",
      "en": "alpha"
    },
    "katexSupported": true
  },
  {
    "id": 55,
    "latex": "\\beta",
    "symbol": "β",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "베타",
      "en": "beta"
    },
    "katexSupported": true
  },
  {
    "id": 56,
    "latex": "\\gamma",
    "symbol": "γ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "감마",
      "en": "gamma"
    },
    "katexSupported": true
  },
  {
    "id": 57,
    "latex": "\\theta",
    "symbol": "θ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "세타",
      "en": "theta"
    },
    "katexSupported": true
  },
  {
    "id": 58,
    "latex": "\\pi",
    "symbol": "π",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이",
      "en": "pi"
    },
    "katexSupported": true
  },
  {
    "id": 59,
    "latex": "\\phi",
    "symbol": "ϕ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이(피)",
      "en": "phi"
    },
    "katexSupported": true
  },
  {
    "id": 60,
    "latex": "\\lambda",
    "symbol": "λ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "람다",
      "en": "lambda"
    },
    "katexSupported": true
  },
  {
    "id": 61,
    "latex": "\\mu",
    "symbol": "μ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "뮤",
      "en": "mu"
    },
    "katexSupported": true
  },
  {
    "id": 62,
    "latex": "\\sigma",
    "symbol": "σ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "시그마",
      "en": "sigma"
    },
    "katexSupported": true
  },
  {
    "id": 63,
    "latex": "\\omega",
    "symbol": "ω",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "오메가",
      "en": "omega"
    },
    "katexSupported": true
  },
  {
    "id": 64,
    "latex": "\\Delta",
    "symbol": "Δ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "델타(대문자)",
      "en": "Delta"
    },
    "katexSupported": true
  },
  {
    "id": 65,
    "latex": "\\Sigma",
    "symbol": "Σ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "시그마(대문자)",
      "en": "Sigma"
    },
    "katexSupported": true
  },
  {
    "id": 66,
    "latex": "\\Omega",
    "symbol": "Ω",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "오메가(대문자)",
      "en": "Omega"
    },
    "katexSupported": true
  },
  {
    "id": 67,
    "latex": "\\Pi",
    "symbol": "Π",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이(대문자)",
      "en": "Pi"
    },
    "katexSupported": true
  },
  {
    "id": 68,
    "latex": "\\left( \\right)",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "소괄호",
      "en": "parentheses"
    },
    "katexSupported": true,
    "displayLatex": "\\left( x \\right)",
    "cursorOffset": 7
  },
  {
    "id": 69,
    "latex": "\\left[ \\right]",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "대괄호",
      "en": "brackets"
    },
    "katexSupported": true,
    "displayLatex": "\\left[ x \\right]",
    "cursorOffset": 7
  },
  {
    "id": 70,
    "latex": "\\left\\{ \\right\\}",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "중괄호",
      "en": "braces"
    },
    "katexSupported": true,
    "displayLatex": "\\left\\{ x \\right\\}",
    "cursorOffset": 8
  },
  {
    "id": 71,
    "latex": "\\left| \\right|",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "절댓값",
      "en": "absolute value"
    },
    "katexSupported": true,
    "displayLatex": "\\left| x \\right|",
    "cursorOffset": 7
  },
  {
    "id": 72,
    "latex": "\\left\\langle \\right\\rangle",
    "symbol": "⟨⟩",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "꺾쇠(내적)",
      "en": "angle brackets"
    },
    "katexSupported": true,
    "displayLatex": "\\left\\langle x \\right\\rangle",
    "cursorOffset": 14
  },
  {
    "id": 73,
    "latex": "\\left\\lfloor \\right\\rfloor",
    "symbol": "⌊⌋",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "바닥(버림)",
      "en": "floor"
    },
    "katexSupported": true,
    "displayLatex": "\\left\\lfloor x \\right\\rfloor",
    "cursorOffset": 13
  },
  {
    "id": 74,
    "latex": "\\left\\lceil \\right\\rceil",
    "symbol": "⌈⌉",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "천장(올림)",
      "en": "ceiling"
    },
    "katexSupported": true,
    "displayLatex": "\\left\\lceil x \\right\\rceil",
    "cursorOffset": 12
  }
];

/** field → 기본 카테고리 id 역매핑 */
export const FIELD_TO_CATEGORY: Record<string, string> = {
  "arithmetic": "basic",
  "vector": "basic",
  "calculus": "calculus",
  "analysis": "calculus",
  "algebra": "symbols",
  "set": "symbols",
  "logic": "symbols",
  "geometry": "symbols",
  "greek": "symbols",
  "bracket": "brackets"
};
