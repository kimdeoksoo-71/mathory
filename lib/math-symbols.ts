/**
 * lib/math-symbols.ts — Phase 40 수식 기호 데이터 (전체 큐레이션 v2)
 *
 * ⚠️ 자동 생성 파일. 직접 수정 금지.
 *    재생성: node scripts/build-symbols.cjs  (입력: lib/data/curated-full.json)
 *    구조필드(latex/symbol/mathClass/displayLatex) = KaTeX(MIT) 시드
 *    분야/이름(ko·en)/등급/needsReview = 멀티에이전트 큐레이션 (KMS 대조 전)
 *    출처/파이프라인: docs/phasedocs/Phase40_기호설정화면_설계_최신.md §18
 *
 * ALL_SYMBOLS=552개(전체 레지스트리) · CURATED_SYMBOLS=201개(팔레트 표시 subset).
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
    "id": "relation",
    "label": "관계",
    "fields": [
      "algebra"
    ]
  },
  {
    "id": "set-logic",
    "label": "집합·논리",
    "fields": [
      "set",
      "logic"
    ]
  },
  {
    "id": "greek",
    "label": "그리스",
    "fields": [
      "greek"
    ]
  },
  {
    "id": "geometry",
    "label": "기하·기타",
    "fields": [
      "geometry",
      "probability",
      "statistics",
      "discrete",
      "linear-algebra"
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

/** 전체 레지스트리 (552). 카탈로그/설정 화면용. */
export const ALL_SYMBOLS: MathSymbol[] = [
  {
    "id": 1,
    "latex": "ℎ",
    "symbol": "h",
    "mathClass": "mathord",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "h(이탤릭 소문자 h)",
      "en": "planck constant style h"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "유니코드 PLANCK CONSTANT(U+210E). 수학 변수 h의 이탤릭 글리프"
  },
  {
    "id": 2,
    "latex": "ℤ",
    "symbol": "Z",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "정수 집합",
      "en": "set of integers"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "정수 전체의 집합 기호"
  },
  {
    "id": 3,
    "latex": "ℝ",
    "symbol": "R",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "실수 집합",
      "en": "set of real numbers"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "실수 전체의 집합 기호"
  },
  {
    "id": 4,
    "latex": "ℚ",
    "symbol": "Q",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "유리수 집합",
      "en": "set of rational numbers"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유리수 전체의 집합 기호"
  },
  {
    "id": 5,
    "latex": "ℙ",
    "symbol": "P",
    "mathClass": "textord",
    "field": "probability",
    "tier": 3,
    "name": {
      "ko": "확률 측도",
      "en": "probability measure"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "확률 P 또는 소수 집합으로도 쓰임"
  },
  {
    "id": 6,
    "latex": "ℕ",
    "symbol": "N",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "자연수 집합",
      "en": "set of natural numbers"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "자연수 전체의 집합 기호"
  },
  {
    "id": 7,
    "latex": "ℍ",
    "symbol": "H",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "사원수 집합",
      "en": "quaternions"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "해밀턴 사원수 집합. 한국 교과서 거의 미사용"
  },
  {
    "id": 8,
    "latex": "ℂ",
    "symbol": "C",
    "mathClass": "textord",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "복소수 집합",
      "en": "set of complex numbers"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "복소수 전체의 집합 기호"
  },
  {
    "id": 9,
    "latex": "\\maltese",
    "symbol": "✠",
    "mathClass": "textord",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "몰타 십자 기호",
      "en": "maltese cross"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "장식 기호. 수학적 의미 없음"
  },
  {
    "id": 10,
    "latex": "\\mathsterling",
    "symbol": "£",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "파운드화 기호",
      "en": "pound sterling sign"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "통화 기호. 수학 용도 거의 없음"
  },
  {
    "id": 11,
    "latex": "\\pounds",
    "symbol": "£",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "파운드화 기호",
      "en": "pound sterling sign"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "통화 기호. \\mathsterling과 동일"
  },
  {
    "id": 12,
    "latex": "\\degree",
    "symbol": "°",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "도(각도)",
      "en": "degree"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "각도 단위 기호 °"
  },
  {
    "id": 13,
    "latex": "ȷ",
    "symbol": "ȷ",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "점 없는 j",
      "en": "dotless j"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\jmath용 글리프. 보통 벡터 단위/허수와 함께 사용"
  },
  {
    "id": 14,
    "latex": "ı",
    "symbol": "ı",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "점 없는 i",
      "en": "dotless i"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\imath용 글리프"
  },
  {
    "id": 15,
    "latex": "\\@jmath",
    "symbol": "",
    "mathClass": "mathord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "점 없는 j (내부 매크로)",
      "en": "dotless j internal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "KaTeX 내부 매크로. 직접 입력 비권장"
  },
  {
    "id": 16,
    "latex": "\\@imath",
    "symbol": "",
    "mathClass": "mathord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "점 없는 i (내부 매크로)",
      "en": "dotless i internal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "KaTeX 내부 매크로. 직접 입력 비권장"
  },
  {
    "id": 17,
    "latex": "\\mathring",
    "symbol": "˚",
    "mathClass": "accent-token",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "고리 악센트",
      "en": "ring accent"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문자 위 작은 원 악센트"
  },
  {
    "id": 18,
    "latex": "\\dot",
    "symbol": "˙",
    "mathClass": "accent-token",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "점 (1계 미분 표기)",
      "en": "dot accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "뉴턴식 시간 미분 표기"
  },
  {
    "id": 19,
    "latex": "\\vec",
    "symbol": "⃗",
    "mathClass": "accent-token",
    "field": "vector",
    "tier": 1,
    "name": {
      "ko": "벡터 (화살표 표기)",
      "en": "vector arrow accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "문자 위 화살표로 벡터 표시"
  },
  {
    "id": 20,
    "latex": "\\hat",
    "symbol": "^",
    "mathClass": "accent-token",
    "field": "statistics",
    "tier": 2,
    "name": {
      "ko": "모자 (추정값/단위벡터)",
      "en": "hat accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "추정량 또는 단위벡터 표기"
  },
  {
    "id": 21,
    "latex": "\\check",
    "symbol": "ˇ",
    "mathClass": "accent-token",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "체크 악센트",
      "en": "check accent"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문자 위 역캐럿(하체크) 악센트"
  },
  {
    "id": 22,
    "latex": "\\breve",
    "symbol": "˘",
    "mathClass": "accent-token",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "반달 악센트",
      "en": "breve accent"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "짧은 반달형 악센트"
  },
  {
    "id": 23,
    "latex": "\\bar",
    "symbol": "ˉ",
    "mathClass": "accent-token",
    "field": "statistics",
    "tier": 1,
    "name": {
      "ko": "바 (평균/켤레)",
      "en": "bar accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "표본평균, 켤레복소수, 집합 폐포 등에 사용"
  },
  {
    "id": 24,
    "latex": "\\tilde",
    "symbol": "~",
    "mathClass": "accent-token",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "틸드 악센트",
      "en": "tilde accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "문자 위 물결 악센트"
  },
  {
    "id": 25,
    "latex": "\\ddot",
    "symbol": "¨",
    "mathClass": "accent-token",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "두 점 (2계 미분 표기)",
      "en": "double dot accent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "뉴턴식 2계 시간 미분 표기"
  },
  {
    "id": 26,
    "latex": "\\grave",
    "symbol": "ˋ",
    "mathClass": "accent-token",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "그레이브 악센트",
      "en": "grave accent"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문자 위 그레이브 악센트. 수학 용도 드묾"
  },
  {
    "id": 27,
    "latex": "\\acute",
    "symbol": "ˊ",
    "mathClass": "accent-token",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "아큐트 악센트",
      "en": "acute accent"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문자 위 아큐트 악센트. 수학 용도 드묾"
  },
  {
    "id": 28,
    "latex": "\\varvdots",
    "symbol": "⋮",
    "mathClass": "textord",
    "field": "bracket",
    "tier": 3,
    "name": {
      "ko": "세로 생략 점",
      "en": "vertical ellipsis variant"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\vdots 변형 글리프"
  },
  {
    "id": 29,
    "latex": "\\ddots",
    "symbol": "⋱",
    "mathClass": "inner",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "대각 생략 점",
      "en": "diagonal ellipsis"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "행렬 대각 생략 표기"
  },
  {
    "id": 30,
    "latex": "\\@cdots",
    "symbol": "⋯",
    "mathClass": "inner",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "가운데 생략 점 (내부 매크로)",
      "en": "centered ellipsis internal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\cdots 내부 매크로"
  },
  {
    "id": 31,
    "latex": "\\ldots",
    "symbol": "…",
    "mathClass": "inner",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "아래 생략 점",
      "en": "lower ellipsis"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "기준선 생략 부호 …"
  },
  {
    "id": 32,
    "latex": "\\mathellipsis",
    "symbol": "…",
    "mathClass": "inner",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "수학 생략 점",
      "en": "math ellipsis"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\ldots와 동일 글리프 …"
  },
  {
    "id": 33,
    "latex": "\\smallint",
    "symbol": "∫",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "작은 적분 기호",
      "en": "small integral"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "작은 크기의 적분 기호"
  },
  {
    "id": 34,
    "latex": "\\bigsqcup",
    "symbol": "⨆",
    "mathClass": "op-token",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "큰 합집합 결합 기호",
      "en": "big square union"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "분리합집합(coproduct) 대형 연산자"
  },
  {
    "id": 35,
    "latex": "\\oiiint",
    "symbol": "∰",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 4,
    "name": {
      "ko": "삼중 닫힌 곡면 적분",
      "en": "closed volume integral"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "닫힌 삼중적분. 한국 교과서 미사용"
  },
  {
    "id": 36,
    "latex": "\\oiint",
    "symbol": "∯",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "닫힌 면적분",
      "en": "closed surface integral"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "닫힌 곡면에 대한 이중적분"
  },
  {
    "id": 37,
    "latex": "\\oint",
    "symbol": "∮",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "선적분 (닫힌 경로)",
      "en": "closed contour integral"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "닫힌 경로 선적분 기호"
  },
  {
    "id": 38,
    "latex": "\\bigodot",
    "symbol": "⨀",
    "mathClass": "op-token",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "큰 원 안 점 곱",
      "en": "big circled dot operator"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "n-ary 직합/직곱 연산자. 한국 교과서에 없음"
  },
  {
    "id": 39,
    "latex": "\\bigoplus",
    "symbol": "⨁",
    "mathClass": "op-token",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "직합",
      "en": "big direct sum"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "벡터공간/가군의 직합 연산자"
  },
  {
    "id": 40,
    "latex": "\\bigotimes",
    "symbol": "⨂",
    "mathClass": "op-token",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "텐서곱",
      "en": "big tensor product"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "n-ary 텐서곱 연산자"
  },
  {
    "id": 41,
    "latex": "\\sum",
    "symbol": "∑",
    "mathClass": "op-token",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "합(시그마)",
      "en": "summation"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "수열의 합 기호"
  },
  {
    "id": 42,
    "latex": "\\prod",
    "symbol": "∏",
    "mathClass": "op-token",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "곱(파이)",
      "en": "product"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "연속 곱 기호"
  },
  {
    "id": 43,
    "latex": "\\iiint",
    "symbol": "∭",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "삼중적분",
      "en": "triple integral"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 44,
    "latex": "\\iint",
    "symbol": "∬",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "이중적분",
      "en": "double integral"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 45,
    "latex": "\\intop",
    "symbol": "∫",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "적분",
      "en": "integral"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\int의 변형(아래첨자 위치 다름). 직접 입력은 드묾"
  },
  {
    "id": 46,
    "latex": "\\int",
    "symbol": "∫",
    "mathClass": "op-token",
    "field": "calculus",
    "tier": 1,
    "name": {
      "ko": "적분",
      "en": "integral"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "적분 기호"
  },
  {
    "id": 47,
    "latex": "\\bigcup",
    "symbol": "⋃",
    "mathClass": "op-token",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "합집합(대문자)",
      "en": "big union"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "여러 집합의 합집합"
  },
  {
    "id": 48,
    "latex": "\\bigcap",
    "symbol": "⋂",
    "mathClass": "op-token",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "교집합(대문자)",
      "en": "big intersection"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "여러 집합의 교집합"
  },
  {
    "id": 49,
    "latex": "\\biguplus",
    "symbol": "⨄",
    "mathClass": "op-token",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "분리합집합(대문자)",
      "en": "big disjoint union"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "중복도 포함 합집합. 한국 교과서에 없음"
  },
  {
    "id": 50,
    "latex": "\\bigwedge",
    "symbol": "⋀",
    "mathClass": "op-token",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "논리곱(대문자)",
      "en": "big logical and"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "전체 논리곱 / 쐐기곱"
  },
  {
    "id": 51,
    "latex": "\\bigvee",
    "symbol": "⋁",
    "mathClass": "op-token",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "논리합(대문자)",
      "en": "big logical or"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "전체 논리합"
  },
  {
    "id": 52,
    "latex": "\\coprod",
    "symbol": "∐",
    "mathClass": "op-token",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "쌍대곱(분리합)",
      "en": "coproduct"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "범주론의 쌍대곱. 한국 교과서에 없음"
  },
  {
    "id": 53,
    "latex": "\\Updownarrow",
    "symbol": "⇕",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "위아래 두 줄 화살표",
      "en": "up down double arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "주로 동치/구분자 용도"
  },
  {
    "id": 54,
    "latex": "\\updownarrow",
    "symbol": "↕",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "위아래 화살표",
      "en": "up down arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 55,
    "latex": "\\Downarrow",
    "symbol": "⇓",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "아래 두 줄 화살표",
      "en": "down double arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 56,
    "latex": "\\downarrow",
    "symbol": "↓",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "아래 화살표",
      "en": "down arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단조감소 수렴 표기 등에 사용"
  },
  {
    "id": 57,
    "latex": "\\Uparrow",
    "symbol": "⇑",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "위 두 줄 화살표",
      "en": "up double arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 58,
    "latex": "\\uparrow",
    "symbol": "↑",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "위 화살표",
      "en": "up arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단조증가 수렴 표기 등에 사용"
  },
  {
    "id": 59,
    "latex": "\\Vert",
    "symbol": "∥",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "노름(이중 막대)",
      "en": "double vertical bar (norm)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "노름 ||x||에 사용. 평행 기호로도 쓰임"
  },
  {
    "id": 60,
    "latex": "\\|",
    "symbol": "∥",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "노름(이중 막대)",
      "en": "double vertical bar (norm)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\Vert와 동일"
  },
  {
    "id": 61,
    "latex": "\\vert",
    "symbol": "∣",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "세로 막대",
      "en": "vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "절댓값, 조건제시법 '~such that', 정함 a|b 등"
  },
  {
    "id": 62,
    "latex": "|",
    "symbol": "∣",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "세로 막대",
      "en": "vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "절댓값, 조건제시법, 약수 표기 등"
  },
  {
    "id": 63,
    "latex": "\\backslash",
    "symbol": "\\",
    "mathClass": "textord",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "역슬래시(차집합)",
      "en": "backslash"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합의 차집합 A\\B. 한국 교과서는 주로 A-B 사용"
  },
  {
    "id": 64,
    "latex": "\\rceil",
    "symbol": "⌉",
    "mathClass": "close",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "천장 닫음 괄호",
      "en": "right ceiling"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "올림(천장) 함수 닫는 괄호"
  },
  {
    "id": 65,
    "latex": "\\lceil",
    "symbol": "⌈",
    "mathClass": "open",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "천장 여는 괄호",
      "en": "left ceiling"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "올림(천장) 함수 여는 괄호"
  },
  {
    "id": 66,
    "latex": "\\rfloor",
    "symbol": "⌋",
    "mathClass": "close",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "바닥 닫음 괄호",
      "en": "right floor"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "내림(바닥)/가우스 기호 닫는 괄호"
  },
  {
    "id": 67,
    "latex": "\\lfloor",
    "symbol": "⌊",
    "mathClass": "open",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "바닥 여는 괄호",
      "en": "left floor"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "내림(바닥)/가우스 기호 여는 괄호. 한국은 [x] 표기도 사용"
  },
  {
    "id": 68,
    "latex": "\\rparen",
    "symbol": ")",
    "mathClass": "close",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "닫는 소괄호",
      "en": "right parenthesis"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 69,
    "latex": "\\lparen",
    "symbol": "(",
    "mathClass": "open",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "여는 소괄호",
      "en": "left parenthesis"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 70,
    "latex": "\\rbrack",
    "symbol": "]",
    "mathClass": "close",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "닫는 대괄호",
      "en": "right square bracket"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 71,
    "latex": "\\lbrack",
    "symbol": "[",
    "mathClass": "open",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "여는 대괄호",
      "en": "left square bracket"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 72,
    "latex": "\\rbrace",
    "symbol": "}",
    "mathClass": "close",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "닫는 중괄호",
      "en": "right curly brace"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합 표기에 사용"
  },
  {
    "id": 73,
    "latex": "\\lbrace",
    "symbol": "{",
    "mathClass": "open",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "여는 중괄호",
      "en": "left curly brace"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합 표기에 사용"
  },
  {
    "id": 74,
    "latex": "\\}",
    "symbol": "}",
    "mathClass": "close",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "닫는 중괄호",
      "en": "right curly brace"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\rbrace와 동일"
  },
  {
    "id": 75,
    "latex": "\\{",
    "symbol": "{",
    "mathClass": "open",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "여는 중괄호",
      "en": "left brace"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합 표기에서 원소 나열을 여는 괄호"
  },
  {
    "id": 76,
    "latex": "\\triangleright",
    "symbol": "▹",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "오른쪽 삼각형 연산자",
      "en": "triangle right"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국어 표준명 없음. 이항연산 기호로 사용"
  },
  {
    "id": 77,
    "latex": "\\triangleleft",
    "symbol": "◃",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "왼쪽 삼각형 연산자",
      "en": "triangle left"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "정규부분군(normal subgroup) 표기 등에 사용. 한국어 표준명 없음"
  },
  {
    "id": 78,
    "latex": "\\star",
    "symbol": "⋆",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "별표 연산자",
      "en": "star operator"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "일반 이항연산 기호. 합성곱 등에 사용"
  },
  {
    "id": 79,
    "latex": "\\diamond",
    "symbol": "⋄",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "다이아몬드 연산자",
      "en": "diamond operator"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "일반 이항연산 기호. 한국어 표준명 없음"
  },
  {
    "id": 80,
    "latex": "\\dagger",
    "symbol": "†",
    "mathClass": "bin",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "단검표(켤레전치)",
      "en": "dagger"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "에르미트 수반(conjugate transpose) 표기에 사용. 음역 '대거'로도 불림"
  },
  {
    "id": 81,
    "latex": "\\bigtriangledown",
    "symbol": "▽",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "아래 큰 삼각형",
      "en": "big triangle down"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "이항연산 기호. \\nabla와 모양 유사하나 구별됨"
  },
  {
    "id": 82,
    "latex": "\\bigtriangleup",
    "symbol": "△",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "위 큰 삼각형",
      "en": "big triangle up"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "대칭차집합 등에 사용되기도 함. 한국어 표준명 없음"
  },
  {
    "id": 83,
    "latex": "\\boxdot",
    "symbol": "⊡",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "점 든 사각형 연산자",
      "en": "boxed dot"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국어 표준명 없음. 특수 이항연산"
  },
  {
    "id": 84,
    "latex": "\\circledcirc",
    "symbol": "⊚",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "원 안의 원 연산자",
      "en": "circled circle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국어 표준명 없음. 특수 이항연산"
  },
  {
    "id": 85,
    "latex": "\\oslash",
    "symbol": "⊘",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "빗금 든 원 연산자",
      "en": "circled slash"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국어 표준명 없음. 특수 이항연산"
  },
  {
    "id": 86,
    "latex": "\\partial",
    "symbol": "∂",
    "mathClass": "textord",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "편미분 기호(라운드 디)",
      "en": "partial derivative"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "편미분에서 사용. '디(d)' 또는 '라운드'로 읽음"
  },
  {
    "id": 87,
    "latex": "\\otimes",
    "symbol": "⊗",
    "mathClass": "bin",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "텐서곱",
      "en": "tensor product"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "크로네커곱/텐서곱 기호. 직접곱과 구별"
  },
  {
    "id": 88,
    "latex": "\\oplus",
    "symbol": "⊕",
    "mathClass": "bin",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "직합",
      "en": "direct sum"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "벡터공간 직합. 배타적 논리합으로도 사용"
  },
  {
    "id": 89,
    "latex": "\\odot",
    "symbol": "⊙",
    "mathClass": "bin",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "원 안의 점 연산자",
      "en": "circled dot"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "아다마르곱(원소별 곱) 등에 사용"
  },
  {
    "id": 90,
    "latex": "\\veebar",
    "symbol": "⊻",
    "mathClass": "bin",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "배타적 논리합",
      "en": "exclusive or (xor)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "XOR 연산. 한국 교과서에서는 드묾"
  },
  {
    "id": 91,
    "latex": "\\barwedge",
    "symbol": "⊼",
    "mathClass": "bin",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "부정 논리곱(NAND)",
      "en": "nand"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국어 표준명 불확실. 논리 NAND 표기"
  },
  {
    "id": 92,
    "latex": ";",
    "symbol": ";",
    "mathClass": "punct",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "세미콜론",
      "en": "semicolon"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "구분 기호. 조건부 표기 등에 사용"
  },
  {
    "id": 93,
    "latex": ",",
    "symbol": ",",
    "mathClass": "punct",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "쉼표",
      "en": "comma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "나열 구분 기호"
  },
  {
    "id": 94,
    "latex": "\\allowbreak",
    "symbol": "",
    "mathClass": "spacing",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "줄바꿈 허용",
      "en": "allow break"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호 아님. 조판용 줄바꿈 허용 명령"
  },
  {
    "id": 95,
    "latex": "\\nobreak",
    "symbol": "",
    "mathClass": "spacing",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "줄바꿈 금지",
      "en": "no break"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호 아님. 조판용 줄바꿈 방지 명령"
  },
  {
    "id": 96,
    "latex": "\\nobreakspace",
    "symbol": " ",
    "mathClass": "spacing",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "줄바꿈 없는 공백",
      "en": "non-breaking space"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호 아님. 조판용 비분리 공백"
  },
  {
    "id": 97,
    "latex": "\\space",
    "symbol": " ",
    "mathClass": "spacing",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "공백",
      "en": "space"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호 아님. 조판용 공백 명령"
  },
  {
    "id": 98,
    "latex": "\\ ",
    "symbol": " ",
    "mathClass": "spacing",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "강제 공백",
      "en": "control space"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호 아님. 명시적 공백 삽입"
  },
  {
    "id": 99,
    "latex": "\\nleq",
    "symbol": "≰",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "이하가 아님",
      "en": "not less than or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "≤의 부정"
  },
  {
    "id": 100,
    "latex": "\\ngeq",
    "symbol": "≱",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "이상이 아님",
      "en": "not greater than or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "≥의 부정"
  },
  {
    "id": 101,
    "latex": "\\to",
    "symbol": "→",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "화살표(향함)",
      "en": "to (rightarrow)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "극한·함수 대응·수렴 표기. '~로 간다'로 읽음"
  },
  {
    "id": 102,
    "latex": "\\rightarrow",
    "symbol": "→",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "오른쪽 화살표",
      "en": "right arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수 대응·함의·수렴. \\to와 동일"
  },
  {
    "id": 103,
    "latex": "\\lt",
    "symbol": "<",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "미만",
      "en": "less than"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "부등호 <. \\lt는 < 와 동일"
  },
  {
    "id": 104,
    "latex": "\\leq",
    "symbol": "≤",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "이하",
      "en": "less than or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "부등호 ≤. 한국 교과서는 보통 ≤ 표기"
  },
  {
    "id": 105,
    "latex": "\\le",
    "symbol": "≤",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "이하",
      "en": "less than or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\leq와 동일"
  },
  {
    "id": 106,
    "latex": "\\leftarrow",
    "symbol": "←",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "왼쪽 화살표",
      "en": "left arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함의·대응 표기에 사용"
  },
  {
    "id": 107,
    "latex": "\\models",
    "symbol": "⊨",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "만족 관계(모델)",
      "en": "models (entails)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "모형론·논리에서 의미론적 함의. 한국 교과서에 거의 없음"
  },
  {
    "id": 108,
    "latex": "\\nsupseteq",
    "symbol": "⊉",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "위집합이 아님",
      "en": "not superset of or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "⊇의 부정"
  },
  {
    "id": 109,
    "latex": "\\nsubseteq",
    "symbol": "⊈",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "부분집합이 아님",
      "en": "not subset of or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "⊆의 부정"
  },
  {
    "id": 110,
    "latex": "\\supseteq",
    "symbol": "⊇",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "포함집합(상위집합)",
      "en": "superset of or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "A⊇B는 A가 B를 포함. 한국 교과서는 ⊃와 혼용"
  },
  {
    "id": 111,
    "latex": "\\subseteq",
    "symbol": "⊆",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "부분집합",
      "en": "subset of or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "A⊆B는 A가 B의 부분집합. 한국 교과서는 ⊂를 부분집합 포함으로 쓰는 관행 있음"
  },
  {
    "id": 112,
    "latex": "\\supset",
    "symbol": "⊃",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "포함한다(상위집합)",
      "en": "superset"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "A⊃B는 A가 B를 포함(A는 B의 상위집합). 한국 교과서에서는 ⊃를 진부분집합이 아닌 포함 관계로 사용."
  },
  {
    "id": 113,
    "latex": "\\subset",
    "symbol": "⊂",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "부분집합",
      "en": "subset"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 교과서는 ⊂를 부분집합(등호 포함) 기호로 사용하는 관행."
  },
  {
    "id": 114,
    "latex": "\\@not",
    "symbol": "",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "부정(not 합성용)",
      "en": "not (combining)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "KaTeX 내부 합성용 명령으로 단독 사용되지 않음. 한국 교과서에 등장하지 않음."
  },
  {
    "id": 115,
    "latex": "\\in",
    "symbol": "∈",
    "mathClass": "rel",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "원소이다",
      "en": "element of"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "a∈A는 a가 A의 원소임을 나타냄."
  },
  {
    "id": 116,
    "latex": "\\gt",
    "symbol": ">",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "초과",
      "en": "greater than"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "> 와 동일."
  },
  {
    "id": 117,
    "latex": "\\gets",
    "symbol": "←",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "왼쪽 화살표(대입)",
      "en": "leftarrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\leftarrow와 동일. 알고리즘에서 대입 기호로 사용."
  },
  {
    "id": 118,
    "latex": "\\geq",
    "symbol": "≥",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "이상",
      "en": "greater than or equal"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 119,
    "latex": "\\ge",
    "symbol": "≥",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "이상",
      "en": "greater than or equal"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\geq와 동일."
  },
  {
    "id": 120,
    "latex": "\\cong",
    "symbol": "≅",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "합동",
      "en": "congruent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "도형의 합동. 대수에서는 동형(isomorphic)으로도 쓰임."
  },
  {
    "id": 121,
    "latex": "\\approx",
    "symbol": "≈",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 1,
    "name": {
      "ko": "근사적으로 같다",
      "en": "approximately equal"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 122,
    "latex": ":",
    "symbol": ":",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "비(콜론)",
      "en": "colon (ratio)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "a:b 비의 표현. 집합 조건제시에도 사용."
  },
  {
    "id": 123,
    "latex": "=",
    "symbol": "=",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "같다",
      "en": "equals"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 124,
    "latex": "\\rVert",
    "symbol": "∥",
    "mathClass": "close",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "노름 닫음(이중 세로선)",
      "en": "right double vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "노름 ‖·‖의 오른쪽 구분자."
  },
  {
    "id": 125,
    "latex": "\\rvert",
    "symbol": "∣",
    "mathClass": "close",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "세로선 닫음",
      "en": "right vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "절댓값·정적분 평가의 오른쪽 구분자."
  },
  {
    "id": 126,
    "latex": "\\rangle",
    "symbol": "⟩",
    "mathClass": "close",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "오른쪽 꺾쇠",
      "en": "right angle bracket"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "내적 ⟨u,v⟩의 오른쪽 괄호."
  },
  {
    "id": 127,
    "latex": "!",
    "symbol": "!",
    "mathClass": "close",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "팩토리얼(느낌표)",
      "en": "factorial"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "n! 계승."
  },
  {
    "id": 128,
    "latex": "?",
    "symbol": "?",
    "mathClass": "close",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "물음표",
      "en": "question mark"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학 기호로는 거의 안 쓰임. 조건 연산 등에서 보조적으로 사용."
  },
  {
    "id": 129,
    "latex": "\\lVert",
    "symbol": "∥",
    "mathClass": "open",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "노름 열음(이중 세로선)",
      "en": "left double vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "노름 ‖·‖의 왼쪽 구분자."
  },
  {
    "id": 130,
    "latex": "\\lvert",
    "symbol": "∣",
    "mathClass": "open",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "세로선 열음",
      "en": "left vertical bar"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "절댓값의 왼쪽 구분자."
  },
  {
    "id": 131,
    "latex": "\\langle",
    "symbol": "⟨",
    "mathClass": "open",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "왼쪽 꺾쇠",
      "en": "left angle bracket"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "내적 ⟨u,v⟩의 왼쪽 괄호."
  },
  {
    "id": 132,
    "latex": "\\surd",
    "symbol": "√",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "근호",
      "en": "radical sign"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "제곱근 기호. 보통 \\sqrt 사용."
  },
  {
    "id": 133,
    "latex": "\\vee",
    "symbol": "∨",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리합(또는)",
      "en": "logical or"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "또는(OR). 격자론에서는 결합(join)."
  },
  {
    "id": 134,
    "latex": "\\wedge",
    "symbol": "∧",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리곱(그리고)",
      "en": "logical and"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "그리고(AND). 격자론에서는 만남(meet)."
  },
  {
    "id": 135,
    "latex": "\\lor",
    "symbol": "∨",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리합(또는)",
      "en": "logical or"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\vee와 동일."
  },
  {
    "id": 136,
    "latex": "\\land",
    "symbol": "∧",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "논리곱(그리고)",
      "en": "logical and"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\wedge와 동일."
  },
  {
    "id": 137,
    "latex": "\\setminus",
    "symbol": "∖",
    "mathClass": "bin",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "차집합",
      "en": "set minus"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "A∖B 차집합. 한국 교과서는 A−B 표기를 더 흔히 사용."
  },
  {
    "id": 138,
    "latex": "\\cup",
    "symbol": "∪",
    "mathClass": "bin",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "합집합",
      "en": "union"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 139,
    "latex": "\\cap",
    "symbol": "∩",
    "mathClass": "bin",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "교집합",
      "en": "intersection"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 140,
    "latex": "\\times",
    "symbol": "×",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "곱하기",
      "en": "multiplication"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "곱셈, 벡터의 외적, 집합의 곱집합(데카르트 곱)에도 사용."
  },
  {
    "id": 141,
    "latex": "\\pm",
    "symbol": "±",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "플러스 마이너스",
      "en": "plus minus"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 142,
    "latex": "\\div",
    "symbol": "÷",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "나누기",
      "en": "division"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 143,
    "latex": "\\circ",
    "symbol": "∘",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "합성",
      "en": "composition"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수의 합성 f∘g. 도(degree) 기호와 혼동 주의."
  },
  {
    "id": 144,
    "latex": "\\cdot",
    "symbol": "⋅",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "점곱(가운뎃점)",
      "en": "dot (multiplication)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "곱셈 기호, 벡터의 내적에도 사용."
  },
  {
    "id": 145,
    "latex": "-",
    "symbol": "−",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "빼기",
      "en": "minus"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 146,
    "latex": "+",
    "symbol": "+",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "더하기",
      "en": "plus"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 147,
    "latex": "*",
    "symbol": "∗",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "별표(연산)",
      "en": "asterisk (operation)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "이항연산·합성곱 등 일반 연산 기호로 사용."
  },
  {
    "id": 148,
    "latex": "\\varphi",
    "symbol": "φ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이(변형)",
      "en": "phi (variant)"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "그리스 문자 phi의 변형 자형. 황금비·오일러 피 함수 등에 사용."
  },
  {
    "id": 149,
    "latex": "\\varsigma",
    "symbol": "ς",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 4,
    "name": {
      "ko": "시그마(변형)",
      "en": "variant sigma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "소문자 시그마의 어말형(final sigma) 변형. 수학에서 거의 쓰이지 않음"
  },
  {
    "id": 150,
    "latex": "\\varrho",
    "symbol": "ϱ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "로(변형)",
      "en": "variant rho"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\rho의 변형 글리프"
  },
  {
    "id": 151,
    "latex": "\\varpi",
    "symbol": "ϖ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "파이(변형)",
      "en": "variant pi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\pi의 변형 글리프"
  },
  {
    "id": 152,
    "latex": "\\vartheta",
    "symbol": "ϑ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "세타(변형)",
      "en": "variant theta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\theta의 변형 글리프"
  },
  {
    "id": 153,
    "latex": "\\varepsilon",
    "symbol": "ε",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "엡실론(변형)",
      "en": "variant epsilon"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\epsilon의 변형 글리프, 곡선형 엡실론"
  },
  {
    "id": 154,
    "latex": "\\omega",
    "symbol": "ω",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "오메가",
      "en": "omega"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 155,
    "latex": "\\psi",
    "symbol": "ψ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "프시",
      "en": "psi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "'프사이'로도 음역"
  },
  {
    "id": 156,
    "latex": "\\chi",
    "symbol": "χ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "카이",
      "en": "chi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "통계 카이제곱(\\chi^2)에서 자주 등장"
  },
  {
    "id": 157,
    "latex": "\\phi",
    "symbol": "ϕ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이",
      "en": "phi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "'피'로도 음역. \\theta와 함께 각도 표기에 사용"
  },
  {
    "id": 158,
    "latex": "\\upsilon",
    "symbol": "υ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "웁실론",
      "en": "upsilon"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 159,
    "latex": "\\tau",
    "symbol": "τ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "타우",
      "en": "tau"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 160,
    "latex": "\\sigma",
    "symbol": "σ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "시그마",
      "en": "sigma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "통계 표준편차 기호로 사용"
  },
  {
    "id": 161,
    "latex": "\\rho",
    "symbol": "ρ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "로",
      "en": "rho"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "상관계수, 밀도 등에 사용"
  },
  {
    "id": 162,
    "latex": "\\pi",
    "symbol": "π",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "파이",
      "en": "pi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "원주율 기호"
  },
  {
    "id": 163,
    "latex": "\\omicron",
    "symbol": "ο",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 4,
    "name": {
      "ko": "오미크론",
      "en": "omicron"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "라틴 o와 구분 어려워 수학에서 거의 안 씀"
  },
  {
    "id": 164,
    "latex": "\\xi",
    "symbol": "ξ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "크시",
      "en": "xi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "'크사이'로도 음역"
  },
  {
    "id": 165,
    "latex": "\\nu",
    "symbol": "ν",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "뉴",
      "en": "nu"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "자유도, 진동수 등에 사용"
  },
  {
    "id": 166,
    "latex": "\\mu",
    "symbol": "μ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "뮤",
      "en": "mu"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "통계 평균 기호로 사용"
  },
  {
    "id": 167,
    "latex": "\\lambda",
    "symbol": "λ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "람다",
      "en": "lambda"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "고유값, 파장 등에 사용"
  },
  {
    "id": 168,
    "latex": "\\kappa",
    "symbol": "κ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "카파",
      "en": "kappa"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "곡률 등에 사용"
  },
  {
    "id": 169,
    "latex": "\\iota",
    "symbol": "ι",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "이오타",
      "en": "iota"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 170,
    "latex": "\\theta",
    "symbol": "θ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "세타",
      "en": "theta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "각도 기호로 가장 흔히 사용"
  },
  {
    "id": 171,
    "latex": "\\eta",
    "symbol": "η",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "에타",
      "en": "eta"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 172,
    "latex": "\\zeta",
    "symbol": "ζ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "제타",
      "en": "zeta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "리만 제타 함수 등에 사용"
  },
  {
    "id": 173,
    "latex": "\\epsilon",
    "symbol": "ϵ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "엡실론",
      "en": "epsilon"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "해석학 극한 정의(엡실론-델타)에 사용"
  },
  {
    "id": 174,
    "latex": "\\delta",
    "symbol": "δ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "델타",
      "en": "delta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "변화량, 극한 정의에 사용"
  },
  {
    "id": 175,
    "latex": "\\gamma",
    "symbol": "γ",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "감마",
      "en": "gamma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "감마 함수 등에 사용"
  },
  {
    "id": 176,
    "latex": "\\beta",
    "symbol": "β",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "베타",
      "en": "beta"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 177,
    "latex": "\\alpha",
    "symbol": "α",
    "mathClass": "mathord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "알파",
      "en": "alpha"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 178,
    "latex": "\\varnothing",
    "symbol": "∅",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "공집합",
      "en": "empty set"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\emptyset의 변형(원형 슬래시). 한국 교과서에서 공집합 기호로 사용"
  },
  {
    "id": 179,
    "latex": "\\emptyset",
    "symbol": "∅",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "공집합",
      "en": "empty set"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 교과서 표기와 동일"
  },
  {
    "id": 180,
    "latex": "\\bot",
    "symbol": "⊥",
    "mathClass": "textord",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "거짓(모순)",
      "en": "bottom"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "논리에서 모순/거짓. 기하에서는 수직(perpendicular) \\perp와 글리프 동일하나 의미 구분"
  },
  {
    "id": 181,
    "latex": "\\top",
    "symbol": "⊤",
    "mathClass": "textord",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "참",
      "en": "top"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "논리에서 항진/참"
  },
  {
    "id": 182,
    "latex": "\\lnot",
    "symbol": "¬",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "부정",
      "en": "logical not"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\neg과 동일. 한국 교과서는 부정을 ~p 또는 p의 윗줄로도 표기"
  },
  {
    "id": 183,
    "latex": "\\neg",
    "symbol": "¬",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "부정",
      "en": "negation"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\lnot과 동일"
  },
  {
    "id": 184,
    "latex": "Χ",
    "symbol": "X",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "대문자 카이",
      "en": "capital chi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "그리스 대문자 카이. 글리프가 라틴 대문자 X와 동일하여 혼동 주의"
  },
  {
    "id": 185,
    "latex": "Τ",
    "symbol": "T",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "대문자 타우",
      "en": "capital tau"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "그리스 대문자 타우. 글리프가 라틴 대문자 T와 동일하여 혼동 주의"
  },
  {
    "id": 186,
    "latex": "Ρ",
    "symbol": "P",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "로(대문자)",
      "en": "capital rho"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Rho. 형태가 라틴 P와 동일"
  },
  {
    "id": 187,
    "latex": "Ο",
    "symbol": "O",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "오미크론(대문자)",
      "en": "capital omicron"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Omicron. 라틴 O와 동일하여 거의 안 쓰임"
  },
  {
    "id": 188,
    "latex": "Ν",
    "symbol": "N",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "뉴(대문자)",
      "en": "capital nu"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Nu. 라틴 N과 동일"
  },
  {
    "id": 189,
    "latex": "Μ",
    "symbol": "M",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "뮤(대문자)",
      "en": "capital mu"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Mu. 라틴 M과 동일"
  },
  {
    "id": 190,
    "latex": "Κ",
    "symbol": "K",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "카파(대문자)",
      "en": "capital kappa"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Kappa. 라틴 K와 동일"
  },
  {
    "id": 191,
    "latex": "Ι",
    "symbol": "I",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "이오타(대문자)",
      "en": "capital iota"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Iota. 라틴 I와 동일"
  },
  {
    "id": 192,
    "latex": "Η",
    "symbol": "H",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "에타(대문자)",
      "en": "capital eta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Eta. 라틴 H와 동일"
  },
  {
    "id": 193,
    "latex": "Ζ",
    "symbol": "Z",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "제타(대문자)",
      "en": "capital zeta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Zeta. 라틴 Z와 동일"
  },
  {
    "id": 194,
    "latex": "Ε",
    "symbol": "E",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "엡실론(대문자)",
      "en": "capital epsilon"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Epsilon. 라틴 E와 동일"
  },
  {
    "id": 195,
    "latex": "Β",
    "symbol": "B",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "베타(대문자)",
      "en": "capital beta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Beta. 라틴 B와 동일"
  },
  {
    "id": 196,
    "latex": "Α",
    "symbol": "A",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "알파(대문자)",
      "en": "capital alpha"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "유니코드 그리스 대문자 Alpha. 라틴 A와 동일"
  },
  {
    "id": 197,
    "latex": "\\Omega",
    "symbol": "Ω",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "오메가(대문자)",
      "en": "capital omega"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "전기저항 단위(옴), 표본공간 등에 사용"
  },
  {
    "id": 198,
    "latex": "\\Psi",
    "symbol": "Ψ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "프사이(대문자)",
      "en": "capital psi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "파동함수 등에 사용. 프시로도 표기"
  },
  {
    "id": 199,
    "latex": "\\Phi",
    "symbol": "Φ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "파이(대문자)",
      "en": "capital phi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "표준정규분포 누적분포함수 등에 사용. 피로도 표기"
  },
  {
    "id": 200,
    "latex": "\\Upsilon",
    "symbol": "Υ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 4,
    "name": {
      "ko": "웁실론(대문자)",
      "en": "capital upsilon"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "입실론으로도 표기. 거의 안 쓰임"
  },
  {
    "id": 201,
    "latex": "\\Sigma",
    "symbol": "Σ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "시그마(대문자)",
      "en": "capital sigma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "합 기호로 널리 사용"
  },
  {
    "id": 202,
    "latex": "\\Pi",
    "symbol": "Π",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "파이(대문자)",
      "en": "capital pi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "곱 기호로 사용. 소문자 \\pi와 구별"
  },
  {
    "id": 203,
    "latex": "\\Xi",
    "symbol": "Ξ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "크사이(대문자)",
      "en": "capital xi"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "크시로도 표기"
  },
  {
    "id": 204,
    "latex": "\\Lambda",
    "symbol": "Λ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "람다(대문자)",
      "en": "capital lambda"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "고윳값, 우주상수 등에 사용"
  },
  {
    "id": 205,
    "latex": "\\Theta",
    "symbol": "Θ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "세타(대문자)",
      "en": "capital theta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "점근 표기법 빅세타 등에 사용. 시타로도 표기"
  },
  {
    "id": 206,
    "latex": "\\Delta",
    "symbol": "Δ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 1,
    "name": {
      "ko": "델타(대문자)",
      "en": "capital delta"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "판별식, 변화량, 라플라스 연산자 등에 사용"
  },
  {
    "id": 207,
    "latex": "\\Gamma",
    "symbol": "Γ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 2,
    "name": {
      "ko": "감마(대문자)",
      "en": "capital gamma"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "감마함수 등에 사용"
  },
  {
    "id": 208,
    "latex": "\\triangle",
    "symbol": "△",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "삼각형",
      "en": "triangle"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "삼각형 ABC 등 도형 표기에 사용"
  },
  {
    "id": 209,
    "latex": "\\prime",
    "symbol": "′",
    "mathClass": "textord",
    "field": "calculus",
    "tier": 1,
    "name": {
      "ko": "프라임",
      "en": "prime"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "도함수 f'(x) 표기. 분(각도) 표기에도 사용"
  },
  {
    "id": 210,
    "latex": "\\infty",
    "symbol": "∞",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 1,
    "name": {
      "ko": "무한대",
      "en": "infinity"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 211,
    "latex": "\\angle",
    "symbol": "∠",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "각",
      "en": "angle"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "각 ABC 표기에 사용"
  },
  {
    "id": 212,
    "latex": "\\_",
    "symbol": "_",
    "mathClass": "textord",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "밑줄",
      "en": "underscore"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "이스케이프된 언더스코어 문자. 수학 의미보다 표기용"
  },
  {
    "id": 213,
    "latex": "\\%",
    "symbol": "%",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "퍼센트",
      "en": "percent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "백분율 기호"
  },
  {
    "id": 214,
    "latex": "\\$",
    "symbol": "$",
    "mathClass": "textord",
    "field": "bracket",
    "tier": 2,
    "name": {
      "ko": "달러 기호",
      "en": "dollar sign"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "이스케이프된 달러 문자. 수학 기호는 아님"
  },
  {
    "id": 215,
    "latex": "`",
    "symbol": "‘",
    "mathClass": "textord",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "여는 작은따옴표",
      "en": "left single quote"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "백틱/여는 인용부호. 수학 기호 아님"
  },
  {
    "id": 216,
    "latex": "\\restriction",
    "symbol": "↾",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "제한",
      "en": "restriction"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수의 정의역 제한 f↾A 표기. 한국 교과서에서는 거의 안 쓰임"
  },
  {
    "id": 217,
    "latex": "\\Rrightarrow",
    "symbol": "⇛",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "삼중 오른쪽 화살표",
      "en": "triple right arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "이중함의보다 강한 관계 등에 드물게 사용"
  },
  {
    "id": 218,
    "latex": "\\leadsto",
    "symbol": "⇝",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "물결 화살표(이끎)",
      "en": "leads to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "환원/유도 관계 등에 사용. 한국 교과서 미사용"
  },
  {
    "id": 219,
    "latex": "\\rightsquigarrow",
    "symbol": "⇝",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 물결 화살표",
      "en": "right squiggly arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\leadsto와 동일 기호. 환원/대응 표기"
  },
  {
    "id": 220,
    "latex": "\\downharpoonright",
    "symbol": "⇂",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "아래쪽 오른갈고리 화살표",
      "en": "down harpoon right"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 표기"
  },
  {
    "id": 221,
    "latex": "\\upharpoonright",
    "symbol": "↾",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "위쪽 오른갈고리 화살표(제한)",
      "en": "up harpoon right"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "함수 제한 기호로도 사용(↾). 한국 교과서 미사용"
  },
  {
    "id": 222,
    "latex": "\\downdownarrows",
    "symbol": "⇊",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "아래 이중 화살표",
      "en": "down down arrows"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 표기"
  },
  {
    "id": 223,
    "latex": "\\Rsh",
    "symbol": "↱",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 위로 꺾인 화살표",
      "en": "right-shift arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서에서 거의 안 쓰임"
  },
  {
    "id": 224,
    "latex": "\\circlearrowright",
    "symbol": "↻",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "시계방향 원형 화살표",
      "en": "clockwise circle arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 225,
    "latex": "\\curvearrowright",
    "symbol": "↷",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 굽은 화살표",
      "en": "rightward curved arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 226,
    "latex": "\\looparrowright",
    "symbol": "↬",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 고리 화살표",
      "en": "rightward loop arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 227,
    "latex": "\\rightarrowtail",
    "symbol": "↣",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "단사 화살표",
      "en": "right arrow with tail"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "범주론/집합론에서 단사(injective) 사상 표기"
  },
  {
    "id": 228,
    "latex": "\\twoheadrightarrow",
    "symbol": "↠",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "전사 화살표",
      "en": "two-headed right arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "범주론에서 전사(surjective) 사상 표기"
  },
  {
    "id": 229,
    "latex": "\\rightleftarrows",
    "symbol": "⇄",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "오른쪽-왼쪽 화살표쌍",
      "en": "right-left arrows"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "화학 반응 등에서 사용"
  },
  {
    "id": 230,
    "latex": "\\rightrightarrows",
    "symbol": "⇉",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 이중 화살표",
      "en": "rightward paired arrows"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 231,
    "latex": "\\leftrightsquigarrow",
    "symbol": "↭",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "좌우 물결 화살표",
      "en": "left-right squiggle arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 232,
    "latex": "\\multimap",
    "symbol": "⊸",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "멀티맵",
      "en": "multimap"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "선형논리에서 함의 기호로 사용"
  },
  {
    "id": 233,
    "latex": "\\imageof",
    "symbol": "⊷",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "상(image) 기호",
      "en": "image of"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서에서 거의 안 쓰임"
  },
  {
    "id": 234,
    "latex": "\\origof",
    "symbol": "⊶",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "원상(original) 기호",
      "en": "original of"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서에서 거의 안 쓰임"
  },
  {
    "id": 235,
    "latex": "\\downharpoonleft",
    "symbol": "⇃",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 아래 작살 화살표",
      "en": "down harpoon left"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 236,
    "latex": "\\upharpoonleft",
    "symbol": "↿",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 위 작살 화살표",
      "en": "up harpoon left"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 237,
    "latex": "\\upuparrows",
    "symbol": "⇈",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "위쪽 이중 화살표",
      "en": "upward paired arrows"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 238,
    "latex": "\\Lsh",
    "symbol": "↰",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 위로 꺾인 화살표",
      "en": "left-shift arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서에서 거의 안 쓰임"
  },
  {
    "id": 239,
    "latex": "\\circlearrowleft",
    "symbol": "↺",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "반시계방향 원형 화살표",
      "en": "counterclockwise circle arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 240,
    "latex": "\\curvearrowleft",
    "symbol": "↶",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 굽은 화살표",
      "en": "leftward curved arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 241,
    "latex": "\\leftrightharpoons",
    "symbol": "⇋",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "좌우 작살 화살표쌍",
      "en": "left-right harpoons"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "화학 평형 등에서 사용"
  },
  {
    "id": 242,
    "latex": "\\looparrowleft",
    "symbol": "↫",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 고리 화살표",
      "en": "leftward loop arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 243,
    "latex": "\\leftarrowtail",
    "symbol": "↢",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "왼쪽 단사 화살표",
      "en": "left arrow with tail"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "범주론 단사 사상 표기"
  },
  {
    "id": 244,
    "latex": "\\twoheadleftarrow",
    "symbol": "↞",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "왼쪽 전사 화살표",
      "en": "two-headed left arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "범주론 전사 사상 표기"
  },
  {
    "id": 245,
    "latex": "\\Lleftarrow",
    "symbol": "⇚",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 삼중선 화살표",
      "en": "triple left arrow"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 246,
    "latex": "\\leftrightarrows",
    "symbol": "⇆",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽-오른쪽 화살표쌍",
      "en": "left-right arrows"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 247,
    "latex": "\\leftleftarrows",
    "symbol": "⇇",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 이중 화살표",
      "en": "leftward paired arrows"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 248,
    "latex": "\\dashleftarrow",
    "symbol": "⇠",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "왼쪽 점선 화살표",
      "en": "dashed left arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "가환도식에서 사용"
  },
  {
    "id": 249,
    "latex": "\\dashrightarrow",
    "symbol": "⇢",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "오른쪽 점선 화살표",
      "en": "dashed right arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "대수기하 유리사상 등에서 사용"
  },
  {
    "id": 250,
    "latex": "\\boxtimes",
    "symbol": "⊠",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "네모곱",
      "en": "boxed times"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "텐서곱/외부곱 등의 변형 표기"
  },
  {
    "id": 251,
    "latex": "\\doublecup",
    "symbol": "⋓",
    "mathClass": "bin",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "이중 합집합",
      "en": "double cup"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 252,
    "latex": "\\doublecap",
    "symbol": "⋒",
    "mathClass": "bin",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "이중 교집합",
      "en": "double cap"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 253,
    "latex": "\\intercal",
    "symbol": "⊺",
    "mathClass": "bin",
    "field": "linear-algebra",
    "tier": 3,
    "name": {
      "ko": "전치 기호",
      "en": "intercal (transpose)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "행렬 전치 위첨자로 사용"
  },
  {
    "id": 254,
    "latex": "\\centerdot",
    "symbol": "⋅",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "가운뎃점 곱",
      "en": "center dot"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "곱셈 기호로 사용 (\\cdot과 유사)"
  },
  {
    "id": 255,
    "latex": "\\circledast",
    "symbol": "⊛",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "원 별표 연산",
      "en": "circled asterisk"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "합성곱 등 추상 이항연산 표기"
  },
  {
    "id": 256,
    "latex": "\\circleddash",
    "symbol": "⊝",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "원 빼기 연산",
      "en": "circled dash"
    },
    "katexSupported": true,
    "needsReview": true
  },
  {
    "id": 257,
    "latex": "\\curlyvee",
    "symbol": "⋎",
    "mathClass": "bin",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "말림 논리합",
      "en": "curly vee"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "격자론 결합(join) 등에서 사용"
  },
  {
    "id": 258,
    "latex": "\\curlywedge",
    "symbol": "⋏",
    "mathClass": "bin",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "말림 논리곱",
      "en": "curly wedge"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "격자론 만남(meet) 등에서 사용"
  },
  {
    "id": 259,
    "latex": "\\rightthreetimes",
    "symbol": "⋌",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "오른쪽 세겹곱",
      "en": "right three times"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "반직접곱 표기에서 사용"
  },
  {
    "id": 260,
    "latex": "\\leftthreetimes",
    "symbol": "⋋",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "왼쪽 반직접곱",
      "en": "left semidirect product"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 군론 반직접곱 기호의 변형"
  },
  {
    "id": 261,
    "latex": "\\rtimes",
    "symbol": "⋊",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "오른쪽 반직접곱",
      "en": "right semidirect product"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "군론에서 N⋊H 형태로 사용"
  },
  {
    "id": 262,
    "latex": "\\ltimes",
    "symbol": "⋉",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "왼쪽 반직접곱",
      "en": "left semidirect product"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "군론에서 H⋉N 형태로 사용"
  },
  {
    "id": 263,
    "latex": "\\divideontimes",
    "symbol": "⋇",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "나눗셈곱 기호",
      "en": "divide on times"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 이항연산 기호"
  },
  {
    "id": 264,
    "latex": "\\boxplus",
    "symbol": "⊞",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "네모 덧셈",
      "en": "boxed plus"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 직합/특수연산 표기에 사용"
  },
  {
    "id": 265,
    "latex": "\\boxminus",
    "symbol": "⊟",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "네모 뺄셈",
      "en": "boxed minus"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 이항연산 기호"
  },
  {
    "id": 266,
    "latex": "\\doublebarwedge",
    "symbol": "⩞",
    "mathClass": "bin",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "이중막대 쐐기",
      "en": "double bar wedge"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 연산 기호"
  },
  {
    "id": 267,
    "latex": "\\Cup",
    "symbol": "⋓",
    "mathClass": "bin",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "이중 합집합",
      "en": "double cup"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 다중집합 합집합 등에 사용"
  },
  {
    "id": 268,
    "latex": "\\Cap",
    "symbol": "⋒",
    "mathClass": "bin",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "이중 교집합",
      "en": "double cap"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 다중집합 교집합 등에 사용"
  },
  {
    "id": 269,
    "latex": "\\smallsetminus",
    "symbol": "∖",
    "mathClass": "bin",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "차집합",
      "en": "set minus"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "작은 차집합 기호. A∖B 형태로 차집합 표기"
  },
  {
    "id": 270,
    "latex": "\\dotplus",
    "symbol": "∔",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "점 덧셈",
      "en": "dot plus"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 직합 등 특수 덧셈 표기"
  },
  {
    "id": 271,
    "latex": "\\Doteq",
    "symbol": "≑",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "같다고 정의됨",
      "en": "doteq"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 정의에 의한 같음 표기 변형"
  },
  {
    "id": 272,
    "latex": "\\Join",
    "symbol": "⋈",
    "mathClass": "rel",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "조인",
      "en": "join"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 관계대수 조인 연산"
  },
  {
    "id": 273,
    "latex": "\\eqsim",
    "symbol": "≂",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "같고 닮음",
      "en": "equals or similar"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 점근적 동치 등에 사용"
  },
  {
    "id": 274,
    "latex": "\\rhd",
    "symbol": "⊳",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군 기호",
      "en": "normal subgroup (right)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 정규부분군 N⊳G 표기"
  },
  {
    "id": 275,
    "latex": "\\lhd",
    "symbol": "⊲",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군 기호",
      "en": "normal subgroup (left)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 정규부분군 N⊲G 표기"
  },
  {
    "id": 276,
    "latex": "\\gggtr",
    "symbol": "⋙",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "매우 큼",
      "en": "much much greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 세 겹 부등호"
  },
  {
    "id": 277,
    "latex": "\\llless",
    "symbol": "⋘",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "매우 작음",
      "en": "much much less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 세 겹 부등호"
  },
  {
    "id": 278,
    "latex": "\\because",
    "symbol": "∵",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "왜냐하면",
      "en": "because"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "증명에서 이유 표기. 한국 교과서에서 사용"
  },
  {
    "id": 279,
    "latex": "\\blacktriangleright",
    "symbol": "▶",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "검은 오른쪽 삼각형",
      "en": "black right-pointing triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 장식/관계 기호"
  },
  {
    "id": 280,
    "latex": "\\backepsilon",
    "symbol": "∍",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "원소로 포함",
      "en": "contains as member"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. ∋의 변형"
  },
  {
    "id": 281,
    "latex": "\\therefore",
    "symbol": "∴",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "따라서",
      "en": "therefore"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "증명에서 결론 표기. 한국 교과서에서 사용"
  },
  {
    "id": 282,
    "latex": "\\blacktriangleleft",
    "symbol": "◀",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "검은 왼쪽 삼각형",
      "en": "black left-pointing triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 장식/관계 기호"
  },
  {
    "id": 283,
    "latex": "\\varpropto",
    "symbol": "∝",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "비례",
      "en": "proportional to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "∝의 변형. 비례 관계 표기"
  },
  {
    "id": 284,
    "latex": "\\pitchfork",
    "symbol": "⋔",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "횡단교차",
      "en": "pitchfork"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 미분기하 횡단성 기호"
  },
  {
    "id": 285,
    "latex": "\\between",
    "symbol": "≬",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "사이",
      "en": "between"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 특수 관계 기호"
  },
  {
    "id": 286,
    "latex": "\\shortparallel",
    "symbol": "∥",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "평행",
      "en": "short parallel"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "평행 기호의 짧은 변형. 한국은 ∥ 사용"
  },
  {
    "id": 287,
    "latex": "\\shortmid",
    "symbol": "∣",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "나누어떨어짐",
      "en": "short mid (divides)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "정수론 가분성 ∣의 짧은 변형"
  },
  {
    "id": 288,
    "latex": "\\Vdash",
    "symbol": "⊩",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "강제",
      "en": "forces"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 집합론 forcing 기호"
  },
  {
    "id": 289,
    "latex": "\\trianglerighteq",
    "symbol": "⊵",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군 또는 같음",
      "en": "normal subgroup of or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 ⊵ 표기 (정규부분군 포함)"
  },
  {
    "id": 290,
    "latex": "\\vartriangleright",
    "symbol": "⊳",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군 기호",
      "en": "normal subgroup (right)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론 정규부분군 ⊳의 변형"
  },
  {
    "id": 291,
    "latex": "\\succapprox",
    "symbol": "⪸",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "우선하거나 근사",
      "en": "succeeds or approximately"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서관계 기호"
  },
  {
    "id": 292,
    "latex": "\\succsim",
    "symbol": "≿",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "우선하거나 닮음",
      "en": "succeeds or similar"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서관계/선호관계 기호"
  },
  {
    "id": 293,
    "latex": "\\curlyeqsucc",
    "symbol": "⋟",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "같거나 우선",
      "en": "equal to or succeeds (curly)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서관계 기호"
  },
  {
    "id": 294,
    "latex": "\\succcurlyeq",
    "symbol": "≽",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "우선하거나 같음",
      "en": "succeeds or equals (curly)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서관계 기호"
  },
  {
    "id": 295,
    "latex": "\\sqsupset",
    "symbol": "⊐",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "네모 진부분집합 포함",
      "en": "square proper superset"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서/포함 관계 기호"
  },
  {
    "id": 296,
    "latex": "\\Supset",
    "symbol": "⋑",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "이중 상위집합",
      "en": "double superset"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. ⊃의 이중선 변형"
  },
  {
    "id": 297,
    "latex": "\\supseteqq",
    "symbol": "⫆",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진초집합 포함(등호 포함)",
      "en": "superset of or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊇의 이중선 변형. 한국 교과서 미사용"
  },
  {
    "id": 298,
    "latex": "\\thickapprox",
    "symbol": "≈",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "근사적으로 같음",
      "en": "approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\approx의 굵은 변형"
  },
  {
    "id": 299,
    "latex": "\\thicksim",
    "symbol": "∼",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "비슷함",
      "en": "similar to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\sim의 굵은 변형"
  },
  {
    "id": 300,
    "latex": "\\triangleq",
    "symbol": "≜",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "정의에 의해 같음",
      "en": "defined as equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "정의 기호로 사용"
  },
  {
    "id": 301,
    "latex": "\\circeq",
    "symbol": "≗",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "원 등호",
      "en": "ring equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 302,
    "latex": "\\eqcirc",
    "symbol": "≖",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "등호 원",
      "en": "equal to with ring"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 303,
    "latex": "\\gtreqqless",
    "symbol": "⪌",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 같거나 작음(이중)",
      "en": "greater than, equal to, or less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 304,
    "latex": "\\gtreqless",
    "symbol": "⋛",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 같거나 작음",
      "en": "greater than, equal to, or less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 305,
    "latex": "\\gtrless",
    "symbol": "≷",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 작음",
      "en": "greater than or less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 306,
    "latex": "\\ggg",
    "symbol": "⋙",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "매우 큼(삼중)",
      "en": "much much greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\gg의 강조형"
  },
  {
    "id": 307,
    "latex": "\\gtrdot",
    "symbol": "⋗",
    "mathClass": "bin",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "점보다 큼",
      "en": "greater than with dot"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론에서 cover 관계. bin 분류"
  },
  {
    "id": 308,
    "latex": "\\gtrapprox",
    "symbol": "⪆",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "크거나 근사적으로 같음",
      "en": "greater than or approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 309,
    "latex": "\\gtrsim",
    "symbol": "≳",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "크거나 비슷함",
      "en": "greater than or similar to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "점근 분석에서 사용"
  },
  {
    "id": 310,
    "latex": "\\eqslantgtr",
    "symbol": "⪖",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "기울어진 등호보다 큼",
      "en": "slanted equal to or greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 311,
    "latex": "\\geqslant",
    "symbol": "⩾",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "크거나 같음",
      "en": "greater than or equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\geq의 기울어진 변형. 유럽식 표기"
  },
  {
    "id": 312,
    "latex": "\\geqq",
    "symbol": "≧",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 같음(이중)",
      "en": "greater than or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\geq의 이중선 변형"
  },
  {
    "id": 313,
    "latex": "\\Bumpeq",
    "symbol": "≎",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "범프 등호(대문자)",
      "en": "bumpy equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 314,
    "latex": "\\bumpeq",
    "symbol": "≏",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "범프 등호",
      "en": "bumpy equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 315,
    "latex": "\\smallfrown",
    "symbol": "⌢",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "작은 호",
      "en": "small frown"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "호 표기 변형"
  },
  {
    "id": 316,
    "latex": "\\smallsmile",
    "symbol": "⌣",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "작은 호(아래)",
      "en": "small smile"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "호 표기 변형"
  },
  {
    "id": 317,
    "latex": "\\Vvdash",
    "symbol": "⊪",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "삼중 턴스타일",
      "en": "triple turnstile"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "강제법(forcing) 등에서 사용"
  },
  {
    "id": 318,
    "latex": "\\vDash",
    "symbol": "⊨",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "의미론적 함의",
      "en": "models / satisfies"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "모델 이론에서 만족 관계"
  },
  {
    "id": 319,
    "latex": "\\trianglelefteq",
    "symbol": "⊴",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군 또는 같음",
      "en": "normal subgroup of or equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "군론 정규부분군 표기"
  },
  {
    "id": 320,
    "latex": "\\vartriangleleft",
    "symbol": "⊲",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "정규부분군",
      "en": "normal subgroup of"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "군론 정규부분군 표기"
  },
  {
    "id": 321,
    "latex": "\\precapprox",
    "symbol": "⪷",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "선행하거나 근사적으로 같음",
      "en": "precedes or approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론에서 사용"
  },
  {
    "id": 322,
    "latex": "\\precsim",
    "symbol": "≾",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "선행하거나 비슷함",
      "en": "precedes or similar to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론에서 사용"
  },
  {
    "id": 323,
    "latex": "\\curlyeqprec",
    "symbol": "⋞",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "곱슬 등호 선행",
      "en": "curly equals precedes"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 324,
    "latex": "\\preccurlyeq",
    "symbol": "≼",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "선행하거나 같음",
      "en": "precedes or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 선행 관계"
  },
  {
    "id": 325,
    "latex": "\\sqsubset",
    "symbol": "⊏",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "사각 진부분집합",
      "en": "square subset of"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론/도메인 이론에서 사용"
  },
  {
    "id": 326,
    "latex": "\\Subset",
    "symbol": "⋐",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "콤팩트 포함",
      "en": "compactly contained in"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "해석학에서 콤팩트 포함 관계"
  },
  {
    "id": 327,
    "latex": "\\subseteqq",
    "symbol": "⫅",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "부분집합 포함(등호 포함)",
      "en": "subset of or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊆의 이중선 변형. 한국 교과서 미사용"
  },
  {
    "id": 328,
    "latex": "\\backsimeq",
    "symbol": "⋍",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "역방향 닮음 등호",
      "en": "reversed similar equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 329,
    "latex": "\\backsim",
    "symbol": "∽",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "역방향 비슷함",
      "en": "reversed similar to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\sim의 역방향 변형"
  },
  {
    "id": 330,
    "latex": "\\fallingdotseq",
    "symbol": "≒",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "근삿값(약등호)",
      "en": "approximately equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 교과서에서 근삿값 ≒로 사용"
  },
  {
    "id": 331,
    "latex": "\\risingdotseq",
    "symbol": "≓",
    "mathClass": "rel",
    "field": "arithmetic",
    "tier": 3,
    "name": {
      "ko": "근삿값(올림 점 등호)",
      "en": "approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "≒(falling)이 한국 표준. rising은 드묾"
  },
  {
    "id": 332,
    "latex": "\\doteqdot",
    "symbol": "≑",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "근사적으로 같음(점 양쪽)",
      "en": "approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 333,
    "latex": "\\lesseqqgtr",
    "symbol": "⪋",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "작거나 같거나 큼(이중)",
      "en": "less than, equal to, or greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 334,
    "latex": "\\lesseqgtr",
    "symbol": "⋚",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "작거나 같거나 큼",
      "en": "less than equal to or greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 순서관계 비교 기호"
  },
  {
    "id": 335,
    "latex": "\\lessgtr",
    "symbol": "≶",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "작거나 큼",
      "en": "less than or greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 336,
    "latex": "\\lll",
    "symbol": "⋘",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "매우 작음(삼중 부등호)",
      "en": "very much less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\ll의 강조형. 한국 교과서 미사용"
  },
  {
    "id": 337,
    "latex": "\\lessdot",
    "symbol": "⋖",
    "mathClass": "bin",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "덮음 관계(작음)",
      "en": "less than with dot"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 covering relation. 한국 교과서 미사용"
  },
  {
    "id": 338,
    "latex": "\\approxeq",
    "symbol": "≊",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "근사적으로 같음",
      "en": "approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "≈와 = 결합. 한국 교과서 미사용"
  },
  {
    "id": 339,
    "latex": "\\lessapprox",
    "symbol": "⪅",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "작거나 거의 같음",
      "en": "less than or approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 340,
    "latex": "\\lesssim",
    "symbol": "≲",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "작거나 비슷함",
      "en": "less than or similar to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "점근 비교에서 사용. 한국 교과서 미사용"
  },
  {
    "id": 341,
    "latex": "\\eqslantless",
    "symbol": "⪕",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "기울어진 작거나 같음",
      "en": "slanted less than or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 342,
    "latex": "\\leqslant",
    "symbol": "⩽",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "이하",
      "en": "less than or equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\leq의 기울어진 변형. 의미는 ≤와 동일"
  },
  {
    "id": 343,
    "latex": "\\leqq",
    "symbol": "≦",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "이하",
      "en": "less than or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "이중선 변형. 한국 교과서는 ≤ 사용"
  },
  {
    "id": 344,
    "latex": "\\@lrcorner",
    "symbol": "┘",
    "mathClass": "close",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "우하단 모서리",
      "en": "lower right corner"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 구분자 명령. 직접 사용 드묾"
  },
  {
    "id": 345,
    "latex": "\\@llcorner",
    "symbol": "└",
    "mathClass": "open",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "좌하단 모서리",
      "en": "lower left corner"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 구분자 명령. 직접 사용 드묾"
  },
  {
    "id": 346,
    "latex": "\\@urcorner",
    "symbol": "┐",
    "mathClass": "close",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "우상단 모서리",
      "en": "upper right corner"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 구분자 명령. 직접 사용 드묾"
  },
  {
    "id": 347,
    "latex": "\\@ulcorner",
    "symbol": "┌",
    "mathClass": "open",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "좌상단 모서리",
      "en": "upper left corner"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 구분자 명령. 직접 사용 드묾"
  },
  {
    "id": 348,
    "latex": "\\varkappa",
    "symbol": "ϰ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 3,
    "name": {
      "ko": "카파(변형)",
      "en": "variant kappa"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "그리스 문자 카파의 변형꼴"
  },
  {
    "id": 349,
    "latex": "\\digamma",
    "symbol": "ϝ",
    "mathClass": "textord",
    "field": "greek",
    "tier": 4,
    "name": {
      "ko": "디감마",
      "en": "digamma"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "고대 그리스 문자. 한국 교과서 미사용"
  },
  {
    "id": 350,
    "latex": "\\gimel",
    "symbol": "ℷ",
    "mathClass": "textord",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "기멜",
      "en": "gimel"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "히브리 문자. 기수 이론에서 사용"
  },
  {
    "id": 351,
    "latex": "\\daleth",
    "symbol": "ℸ",
    "mathClass": "textord",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "달레트",
      "en": "daleth"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "히브리 문자. 집합론 기수"
  },
  {
    "id": 352,
    "latex": "\\beth",
    "symbol": "ℶ",
    "mathClass": "textord",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "베트",
      "en": "beth"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "히브리 문자. 베트 수(beth number)"
  },
  {
    "id": 353,
    "latex": "\\checkmark",
    "symbol": "✓",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "체크 표시",
      "en": "checkmark"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "확인/참 표시용"
  },
  {
    "id": 354,
    "latex": "\\yen",
    "symbol": "¥",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "엔화 기호",
      "en": "yen sign"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "통화 기호. 수학 기호 아님"
  },
  {
    "id": 355,
    "latex": "\\Diamond",
    "symbol": "◊",
    "mathClass": "textord",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "마름모(가능성 연산자)",
      "en": "diamond operator"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "양상논리 가능성 연산자로 사용"
  },
  {
    "id": 356,
    "latex": "\\Box",
    "symbol": "□",
    "mathClass": "textord",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "네모(필연성 연산자)",
      "en": "box operator"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "양상논리 필연성 연산자로 사용"
  },
  {
    "id": 357,
    "latex": "\\square",
    "symbol": "□",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "정사각형",
      "en": "square"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "증명 종료(Q.E.D.) 표시로도 사용"
  },
  {
    "id": 358,
    "latex": "\\diagdown",
    "symbol": "╲",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "우하향 대각선",
      "en": "diagonal down"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 359,
    "latex": "\\diagup",
    "symbol": "╱",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "우상향 대각선",
      "en": "diagonal up"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 360,
    "latex": "\\eth",
    "symbol": "ð",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "에드",
      "en": "eth"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문자 기호. 한국 교과서 미사용"
  },
  {
    "id": 361,
    "latex": "\\complement",
    "symbol": "∁",
    "mathClass": "textord",
    "field": "set",
    "tier": 1,
    "name": {
      "ko": "여집합",
      "en": "complement"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합의 여집합. 한국 교과서는 A^c 표기 일반적"
  },
  {
    "id": 362,
    "latex": "\\sphericalangle",
    "symbol": "∢",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "구면각",
      "en": "spherical angle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용. 각 기호 변형"
  },
  {
    "id": 363,
    "latex": "\\bigstar",
    "symbol": "★",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 3,
    "name": {
      "ko": "큰 별표",
      "en": "big star"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "강조 표식용"
  },
  {
    "id": 364,
    "latex": "\\blacklozenge",
    "symbol": "⧫",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "검은 마름모",
      "en": "black lozenge"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "표식용"
  },
  {
    "id": 365,
    "latex": "\\blacksquare",
    "symbol": "■",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "검은 정사각형",
      "en": "black square"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "증명 종료(Q.E.D.) 표시로 흔히 사용"
  },
  {
    "id": 366,
    "latex": "\\blacktriangledown",
    "symbol": "▼",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "검은 아래 삼각형",
      "en": "black down-pointing triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "표식용"
  },
  {
    "id": 367,
    "latex": "\\blacktriangle",
    "symbol": "▲",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "검은 위 삼각형",
      "en": "black up-pointing triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "표식용"
  },
  {
    "id": 368,
    "latex": "\\backprime",
    "symbol": "‵",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "역 프라임",
      "en": "reversed prime"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "프라임의 좌측 변형. 한국 교과서 미사용"
  },
  {
    "id": 369,
    "latex": "\\Game",
    "symbol": "⅁",
    "mathClass": "textord",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "뒤집힌 G",
      "en": "turned sans-serif capital G"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "게임/기술 기호. 한국 교과서 미사용"
  },
  {
    "id": 370,
    "latex": "\\Finv",
    "symbol": "Ⅎ",
    "mathClass": "textord",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "뒤집힌 F",
      "en": "turned capital F"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국 교과서 미사용"
  },
  {
    "id": 371,
    "latex": "\\mho",
    "symbol": "℧",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "모(컨덕턴스 단위)",
      "en": "mho"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "전기 컨덕턴스 단위(옴을 거꾸로). 수학 교과서에서 거의 안 쓰임."
  },
  {
    "id": 372,
    "latex": "\\nexists",
    "symbol": "∄",
    "mathClass": "textord",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "존재하지 않는다",
      "en": "there does not exist"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "∃에 사선을 그은 부정 한정기호."
  },
  {
    "id": 373,
    "latex": "\\measuredangle",
    "symbol": "∡",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 3,
    "name": {
      "ko": "측정각",
      "en": "measured angle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "각의 크기를 나타내는 기호. 한국 교과서는 보통 ∠ 사용."
  },
  {
    "id": 374,
    "latex": "\\circledR",
    "symbol": "®",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "등록상표 기호",
      "en": "circled R"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수학적 의미보다 상표 기호. 거의 안 쓰임."
  },
  {
    "id": 375,
    "latex": "\\circledS",
    "symbol": "Ⓢ",
    "mathClass": "textord",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "원 S 기호",
      "en": "circled S"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "특수 기호. 수학 교과서에서 거의 안 쓰임."
  },
  {
    "id": 376,
    "latex": "\\lozenge",
    "symbol": "◊",
    "mathClass": "textord",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "마름모(양상논리 가능 연산자)",
      "en": "lozenge"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "양상논리에서 '가능' 연산자로 쓰임. 한국 교과 비표준."
  },
  {
    "id": 377,
    "latex": "\\triangledown",
    "symbol": "▽",
    "mathClass": "textord",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "아래 삼각형",
      "en": "down-pointing triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "역삼각형 기호. nabla(∇)와 구별."
  },
  {
    "id": 378,
    "latex": "\\hslash",
    "symbol": "ℏ",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "플랑크 상수(에이치바)",
      "en": "reduced Planck constant"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "물리 상수 ℏ. 수학보다 물리에서 사용."
  },
  {
    "id": 379,
    "latex": "\\vartriangle",
    "symbol": "△",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 3,
    "name": {
      "ko": "삼각형",
      "en": "triangle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "관계 기호로 분류된 삼각형 변형."
  },
  {
    "id": 380,
    "latex": "\\nLeftrightarrow",
    "symbol": "⇎",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "동치가 아님",
      "en": "not if and only if"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "양방향 함의 부정. ⇔에 사선."
  },
  {
    "id": 381,
    "latex": "\\nleftrightarrow",
    "symbol": "↮",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "양방향 화살표 부정",
      "en": "not left-right arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단선 양방향 화살표의 부정."
  },
  {
    "id": 382,
    "latex": "\\nRightarrow",
    "symbol": "⇏",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "함의하지 않음",
      "en": "does not imply"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⇒의 부정. P가 Q를 함의하지 않음."
  },
  {
    "id": 383,
    "latex": "\\nLeftarrow",
    "symbol": "⇍",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "역함의하지 않음",
      "en": "is not implied by"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⇐의 부정."
  },
  {
    "id": 384,
    "latex": "\\nrightarrow",
    "symbol": "↛",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 화살표 부정",
      "en": "does not map to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단선 오른쪽 화살표의 부정. 수렴 안 함 등에도 사용."
  },
  {
    "id": 385,
    "latex": "\\nleftarrow",
    "symbol": "↚",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "왼쪽 화살표 부정",
      "en": "not left arrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단선 왼쪽 화살표의 부정."
  },
  {
    "id": 386,
    "latex": "\\unrhd",
    "symbol": "⊵",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 또는 같음(오른쪽)",
      "en": "contains as normal subgroup or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 정규부분군 포함 관계. 한국 교과 비표준."
  },
  {
    "id": 387,
    "latex": "\\unlhd",
    "symbol": "⊴",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 또는 같음(왼쪽)",
      "en": "normal subgroup of or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론 정규부분군 관계. 한국 교과 비표준."
  },
  {
    "id": 388,
    "latex": "\\@nsubseteqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "부분집합 아님(이중선)",
      "en": "not a subset of nor equal (double)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 명령(@). ⊈의 이중선 변형. 일반 입력용 아님."
  },
  {
    "id": 389,
    "latex": "\\succneqq",
    "symbol": "⪶",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "뒤서지만 같지 않음",
      "en": "succeeds but not equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서관계 ≻와 같지 않음의 결합. 한국 교과 비표준."
  },
  {
    "id": 390,
    "latex": "\\precneqq",
    "symbol": "⪵",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "앞서지만 같지 않음",
      "en": "precedes but not equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서관계 ≺와 같지 않음의 결합. 한국 교과 비표준."
  },
  {
    "id": 391,
    "latex": "\\nVdash",
    "symbol": "⊮",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "강제하지 않음(이중 세로선)",
      "en": "does not force"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "증명론/모형론의 ⊩ 부정. 한국 교과 비표준."
  },
  {
    "id": 392,
    "latex": "\\@varsupsetneqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진상위집합 아님 변형(이중선)",
      "en": "variant superset but not equal (double)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 명령(@). 일반 입력용 아님."
  },
  {
    "id": 393,
    "latex": "\\supsetneqq",
    "symbol": "⫌",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진상위집합(이중선)",
      "en": "superset of but not equal (double)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "진부분집합의 상위집합 버전, 이중 등호선."
  },
  {
    "id": 394,
    "latex": "\\@varsupsetneq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진상위집합 아님 변형",
      "en": "variant superset but not equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 명령(@). 일반 입력용 아님."
  },
  {
    "id": 395,
    "latex": "\\supsetneq",
    "symbol": "⊋",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "진상위집합",
      "en": "superset of but not equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊋. 진부분집합 ⊊의 대칭. 한국 교과는 보통 ⊃ 사용."
  },
  {
    "id": 396,
    "latex": "\\@nsupseteqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "상위집합 아님(이중선)",
      "en": "not a superset of nor equal (double)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 명령(@). 일반 입력용 아님."
  },
  {
    "id": 397,
    "latex": "\\ntrianglerighteq",
    "symbol": "⋭",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 또는 같음 아님(오른쪽)",
      "en": "does not contain as normal subgroup or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊵의 부정. 군론. 한국 교과 비표준."
  },
  {
    "id": 398,
    "latex": "\\ntriangleright",
    "symbol": "⋫",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 아님(오른쪽)",
      "en": "not normal subgroup (right)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊳의 부정. 군론. 한국 교과 비표준."
  },
  {
    "id": 399,
    "latex": "\\nVDash",
    "symbol": "⊯",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "의미함의하지 않음(이중)",
      "en": "does not entail"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⊨의 부정. 모형론 의미적 함의. 한국 교과 비표준."
  },
  {
    "id": 400,
    "latex": "\\nparallel",
    "symbol": "∦",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "평행하지 않다",
      "en": "not parallel to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "∥의 부정. 두 직선이 평행하지 않음."
  },
  {
    "id": 401,
    "latex": "\\@nshortparallel",
    "symbol": "",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "짧은 평행 아님",
      "en": "not short parallel"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 명령(@). 짧은 평행기호의 부정. 일반 입력용 아님."
  },
  {
    "id": 402,
    "latex": "\\ncong",
    "symbol": "≆",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "합동이 아니다",
      "en": "not congruent to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "≅의 부정. 도형이 합동이 아님 또는 위상 동형 아님."
  },
  {
    "id": 403,
    "latex": "\\succnapprox",
    "symbol": "⪺",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "뒤서며 근사하지 않음",
      "en": "succeeds but not approximately"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서관계 변형. 한국 교과 비표준."
  },
  {
    "id": 404,
    "latex": "\\succnsim",
    "symbol": "⋩",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "뒤서며 유사하지 않음",
      "en": "succeeds but not similar"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서관계 변형. 한국 교과 비표준."
  },
  {
    "id": 405,
    "latex": "\\nsucceq",
    "symbol": "⋡",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "뒤서거나 같지 않음",
      "en": "does not succeed or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "⪰의 부정. 순서관계. 한국 교과 비표준."
  },
  {
    "id": 406,
    "latex": "\\nsucc",
    "symbol": "⊁",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "뒤서지 않음",
      "en": "does not succeed"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "≻의 부정. 순서관계. 한국 교과 비표준."
  },
  {
    "id": 407,
    "latex": "\\gnapprox",
    "symbol": "⪊",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "크지만 근사하지 않음",
      "en": "greater than but not approximately"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "부등호 변형. 한국 교과 비표준."
  },
  {
    "id": 408,
    "latex": "\\gnsim",
    "symbol": "⋧",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 크고 닮지 않음",
      "en": "greater than but not equivalent to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론(order theory)에서 쓰는 부정 관계 기호. 한국 교과서에 표준어 없음"
  },
  {
    "id": 409,
    "latex": "\\@gvertneqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 크고 같지 않음(세로선 변형)",
      "en": "greater than but not equal to (variant)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 410,
    "latex": "\\gneqq",
    "symbol": "≩",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 크고 같지 않음",
      "en": "greater than but not equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\geq의 부정형. 한국 교과서에서는 단순히 부등호로 표기"
  },
  {
    "id": 411,
    "latex": "\\gneq",
    "symbol": "⪈",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 크고 같지 않음",
      "en": "greater than and not equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\gneqq의 단선 변형"
  },
  {
    "id": 412,
    "latex": "\\@ngeqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 같지 않음",
      "en": "not greater than or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 413,
    "latex": "\\@ngeqslant",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "크거나 같지 않음(기울임)",
      "en": "not greater than or equal to (slanted)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). \\geqslant의 부정"
  },
  {
    "id": 414,
    "latex": "\\ngtr",
    "symbol": "≯",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "보다 크지 않음",
      "en": "not greater than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\gtr의 부정. 한국 교과서에서는 \\leq로 표기"
  },
  {
    "id": 415,
    "latex": "\\@varsubsetneqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진부분집합이고 같지 않음(변형)",
      "en": "subset of but not equal to (variant)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 416,
    "latex": "\\subsetneqq",
    "symbol": "⫋",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "진부분집합",
      "en": "subset of but not equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "한국에서는 ⊊ 또는 ⊂를 진부분집합으로 표기하는 관행이 흔함"
  },
  {
    "id": 417,
    "latex": "\\@varsubsetneq",
    "symbol": "",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "진부분집합(변형)",
      "en": "subset of and not equal to (variant)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 418,
    "latex": "\\subsetneq",
    "symbol": "⊊",
    "mathClass": "rel",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "진부분집합",
      "en": "subset of and not equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 교과서·대학에서 진부분집합(proper subset)을 ⊊로 표기"
  },
  {
    "id": 419,
    "latex": "\\ntrianglelefteq",
    "symbol": "⋬",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 아님(또는 같지 않음)",
      "en": "not normal subgroup of or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 정규부분군 부정. 한국 표준어 없음"
  },
  {
    "id": 420,
    "latex": "\\ntriangleleft",
    "symbol": "⋪",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "정규부분군 아님",
      "en": "not normal subgroup of"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론에서 정규부분군 부정 관계"
  },
  {
    "id": 421,
    "latex": "\\nvDash",
    "symbol": "⊭",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "의미론적으로 함의하지 않음",
      "en": "does not semantically entail"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "모형론/논리학의 충족 부정. 한국 교과서에 없음"
  },
  {
    "id": 422,
    "latex": "\\nvdash",
    "symbol": "⊬",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "증명할 수 없음",
      "en": "does not prove / not provable"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "증명론의 turnstile 부정. 한국 교과서에 없음"
  },
  {
    "id": 423,
    "latex": "\\nmid",
    "symbol": "∤",
    "mathClass": "rel",
    "field": "discrete",
    "tier": 2,
    "name": {
      "ko": "나누어떨어지지 않음",
      "en": "does not divide"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "정수론에서 a∤b. 한국 대학 정수론에서 사용"
  },
  {
    "id": 424,
    "latex": "\\@nshortmid",
    "symbol": "",
    "mathClass": "rel",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "나누어떨어지지 않음(짧은 변형)",
      "en": "does not divide (short variant)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 425,
    "latex": "\\nsim",
    "symbol": "≁",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "닮지 않음",
      "en": "not similar to / not equivalent to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\sim의 부정. 동치/닮음 관계 부정"
  },
  {
    "id": 426,
    "latex": "\\precnapprox",
    "symbol": "⪹",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "선행하지만 근사적으로 같지 않음",
      "en": "precedes but not approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 부정 관계. 한국 표준어 없음"
  },
  {
    "id": 427,
    "latex": "\\precnsim",
    "symbol": "⋨",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "선행하지만 동치 아님",
      "en": "precedes but not equivalent to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 부정 관계. 한국 표준어 없음"
  },
  {
    "id": 428,
    "latex": "\\npreceq",
    "symbol": "⋠",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "선행하거나 같지 않음",
      "en": "does not precede or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론의 \\preceq 부정"
  },
  {
    "id": 429,
    "latex": "\\nprec",
    "symbol": "⊀",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "선행하지 않음",
      "en": "does not precede"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론의 \\prec 부정"
  },
  {
    "id": 430,
    "latex": "\\lnapprox",
    "symbol": "⪉",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 작지만 근사적으로 같지 않음",
      "en": "less than but not approximately equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 부정 관계. 한국 표준어 없음"
  },
  {
    "id": 431,
    "latex": "\\lnsim",
    "symbol": "⋦",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 작지만 동치 아님",
      "en": "less than but not equivalent to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 부정 관계. 한국 표준어 없음"
  },
  {
    "id": 432,
    "latex": "\\@lvertneqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 작고 같지 않음(세로선 변형)",
      "en": "less than but not equal to (variant)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 433,
    "latex": "\\lneqq",
    "symbol": "≨",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 작고 같지 않음",
      "en": "less than but not equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\leq의 부정형. 한국 교과서에서는 부등호로 표기"
  },
  {
    "id": 434,
    "latex": "\\lneq",
    "symbol": "⪇",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "보다 작고 같지 않음",
      "en": "less than and not equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\lneqq의 단선 변형"
  },
  {
    "id": 435,
    "latex": "\\@nleqq",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "작거나 같지 않음",
      "en": "not less than or equal to"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). 일반 사용 안 함"
  },
  {
    "id": 436,
    "latex": "\\@nleqslant",
    "symbol": "",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "작거나 같지 않음(기울임)",
      "en": "not less than or equal to (slanted)"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "내부 매크로(@ 접두). \\leqslant의 부정"
  },
  {
    "id": 437,
    "latex": "\\nless",
    "symbol": "≮",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "보다 작지 않음",
      "en": "not less than"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "\\less의 부정. 한국 교과서에서는 \\geq로 표기"
  },
  {
    "id": 438,
    "latex": "\\rightleftharpoons",
    "symbol": "⇌",
    "mathClass": "rel",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "오른쪽왼쪽 갈고리 화살표(평형)",
      "en": "rightleft harpoons"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "화학 평형 반응 기호로 널리 사용. 수학에서는 가역 관계 표시"
  },
  {
    "id": 439,
    "latex": "\\nwarrow",
    "symbol": "↖",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "북서쪽 화살표",
      "en": "northwest arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "좌상향 대각 화살표"
  },
  {
    "id": 440,
    "latex": "\\rightharpoondown",
    "symbol": "⇁",
    "mathClass": "rel",
    "field": "vector",
    "tier": 3,
    "name": {
      "ko": "오른쪽 아래 갈고리 화살표",
      "en": "right harpoon down"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "벡터 표기·화살표 갈고리. 한국 교과서에 표준어 없음"
  },
  {
    "id": 441,
    "latex": "\\leftharpoondown",
    "symbol": "↽",
    "mathClass": "rel",
    "field": "vector",
    "tier": 3,
    "name": {
      "ko": "왼쪽 아래 갈고리 화살표",
      "en": "left harpoon down"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "벡터 표기·화살표 갈고리. 한국 교과서에 표준어 없음"
  },
  {
    "id": 442,
    "latex": "\\swarrow",
    "symbol": "↙",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 2,
    "name": {
      "ko": "남서쪽 화살표",
      "en": "southwest arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "좌하향 대각 화살표"
  },
  {
    "id": 443,
    "latex": "\\rightharpoonup",
    "symbol": "⇀",
    "mathClass": "rel",
    "field": "vector",
    "tier": 3,
    "name": {
      "ko": "오른쪽 위 갈고리 화살표",
      "en": "right harpoon up"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "약수렴(weak convergence) 표시에도 사용. 벡터 표기"
  },
  {
    "id": 444,
    "latex": "\\leftharpoonup",
    "symbol": "↼",
    "mathClass": "rel",
    "field": "vector",
    "tier": 3,
    "name": {
      "ko": "왼쪽 위 갈고리 화살표",
      "en": "left harpoon up"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "갈고리 화살표. 한국 교과서에 표준어 없음"
  },
  {
    "id": 445,
    "latex": "\\searrow",
    "symbol": "↘",
    "mathClass": "rel",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "우하향 화살표(감소)",
      "en": "southeast arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수 증감표에서 감소를 나타낼 때 쓰임"
  },
  {
    "id": 446,
    "latex": "\\hookrightarrow",
    "symbol": "↪",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "포함 사상 화살표",
      "en": "hookrightarrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단사 사상(injection)·포함 사상 표기. 한국 교과서에 거의 없음"
  },
  {
    "id": 447,
    "latex": "\\hookleftarrow",
    "symbol": "↩",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "왼쪽 갈고리 화살표",
      "en": "hookleftarrow"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "단사 사상 표기의 좌향형. 한국 교과서에 거의 없음"
  },
  {
    "id": 448,
    "latex": "\\nearrow",
    "symbol": "↗",
    "mathClass": "rel",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "우상향 화살표(증가)",
      "en": "northeast arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수 증감표에서 증가를 나타낼 때 쓰임"
  },
  {
    "id": 449,
    "latex": "\\longmapsto",
    "symbol": "⟼",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "긴 대응 화살표",
      "en": "long maps to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "함수의 원소 대응(x ↦ f(x))의 긴 형태"
  },
  {
    "id": 450,
    "latex": "\\mapsto",
    "symbol": "↦",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "대응 화살표",
      "en": "maps to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "원소 대응 x ↦ f(x). 대학 수학부터 사용"
  },
  {
    "id": 451,
    "latex": "\\Longleftrightarrow",
    "symbol": "⟺",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "필요충분조건(긴 동치)",
      "en": "long if and only if"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "동치(필요충분조건)의 긴 형태"
  },
  {
    "id": 452,
    "latex": "\\Leftrightarrow",
    "symbol": "⇔",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "필요충분조건",
      "en": "if and only if"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 고교에서 '필요충분조건' 기호로 사용"
  },
  {
    "id": 453,
    "latex": "\\longleftrightarrow",
    "symbol": "⟷",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "긴 양방향 화살표",
      "en": "long left right arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "양방향 대응의 긴 형태"
  },
  {
    "id": 454,
    "latex": "\\leftrightarrow",
    "symbol": "↔",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "양방향 화살표",
      "en": "left right arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "논리에서 쌍조건(↔)으로도 쓰임"
  },
  {
    "id": 455,
    "latex": "\\Longrightarrow",
    "symbol": "⟹",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "함의(긴 화살표)",
      "en": "long implies"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "'~이면'의 긴 형태"
  },
  {
    "id": 456,
    "latex": "\\Rightarrow",
    "symbol": "⇒",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "함의",
      "en": "implies"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "한국 고교에서 '~이면(충분조건)' 기호로 사용"
  },
  {
    "id": 457,
    "latex": "\\longrightarrow",
    "symbol": "⟶",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "긴 오른쪽 화살표",
      "en": "long right arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "극한·사상에서 '~로 향함' 표기의 긴 형태"
  },
  {
    "id": 458,
    "latex": "\\Longleftarrow",
    "symbol": "⟸",
    "mathClass": "rel",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "역함의(긴 화살표)",
      "en": "long is implied by"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "역방향 함의의 긴 형태"
  },
  {
    "id": 459,
    "latex": "\\Leftarrow",
    "symbol": "⇐",
    "mathClass": "rel",
    "field": "logic",
    "tier": 1,
    "name": {
      "ko": "역함의",
      "en": "is implied by"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "역방향 함의(필요조건 방향)"
  },
  {
    "id": 460,
    "latex": "\\longleftarrow",
    "symbol": "⟵",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "긴 왼쪽 화살표",
      "en": "long left arrow"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 461,
    "latex": "\\And",
    "symbol": "&",
    "mathClass": "bin",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "그리고(앰퍼샌드)",
      "en": "ampersand / and"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수식 정렬·논리곱 맥락. 한국 교과서 표준 기호 아님"
  },
  {
    "id": 462,
    "latex": "\\amalg",
    "symbol": "⨿",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "쌍대곱(아말감)",
      "en": "amalgamation / coproduct"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "여곱(coproduct)·자유곱 표기. 학부 고학년 이상"
  },
  {
    "id": 463,
    "latex": "\\wr",
    "symbol": "≀",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 4,
    "name": {
      "ko": "화환곱",
      "en": "wreath product"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "군론의 화환곱(wreath product). 전공·연구 수준"
  },
  {
    "id": 464,
    "latex": "\\ddagger",
    "symbol": "‡",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "이중단검표",
      "en": "double dagger"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "주석 기호. 수학 본문보다 각주용"
  },
  {
    "id": 465,
    "latex": "\\bullet",
    "symbol": "∙",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "불릿(점)",
      "en": "bullet"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "이항 연산·내적·목록 표시 등으로 사용"
  },
  {
    "id": 466,
    "latex": "\\bigcirc",
    "symbol": "◯",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 3,
    "name": {
      "ko": "큰 원",
      "en": "big circle"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "합성 등 이항 연산자로 쓰이기도 함"
  },
  {
    "id": 467,
    "latex": "\\sqcup",
    "symbol": "⊔",
    "mathClass": "bin",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "분리합집합(사각 합)",
      "en": "square cup / disjoint union"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "서로소 합집합(disjoint union)·상한 표기"
  },
  {
    "id": 468,
    "latex": "\\ast",
    "symbol": "∗",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "별표(곱셈/합성곱)",
      "en": "asterisk"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "이항 연산·합성곱(convolution) 등에 사용"
  },
  {
    "id": 469,
    "latex": "\\sqcap",
    "symbol": "⊓",
    "mathClass": "bin",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "사각 교집합",
      "en": "square cap"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "하한(meet)·격자 연산 표기"
  },
  {
    "id": 470,
    "latex": "\\uplus",
    "symbol": "⊎",
    "mathClass": "bin",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "중복합집합",
      "en": "multiset union / disjoint union"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "중복집합 합·서로소 합 표기. 이산수학에서 가끔 사용"
  },
  {
    "id": 471,
    "latex": "\\ominus",
    "symbol": "⊖",
    "mathClass": "bin",
    "field": "algebra",
    "tier": 3,
    "name": {
      "ko": "원 안의 빼기",
      "en": "circled minus"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "대칭차·직합 보수 등 맥락별 의미. 한국 교과서 비표준"
  },
  {
    "id": 472,
    "latex": "\\mp",
    "symbol": "∓",
    "mathClass": "bin",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "마이너스 플러스",
      "en": "minus-or-plus"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "복호. ±와 부호 순서가 반대(∓)"
  },
  {
    "id": 473,
    "latex": "\\lgroup",
    "symbol": "⟮",
    "mathClass": "open",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "왼쪽 그룹 괄호",
      "en": "left group delimiter"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "큰 묶음용 구분자. 일반 교과서에 거의 없음"
  },
  {
    "id": 474,
    "latex": "\\rgroup",
    "symbol": "⟯",
    "mathClass": "close",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "오른쪽 그룹 괄호",
      "en": "right group delimiter"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "큰 묶음용 구분자. 일반 교과서에 거의 없음"
  },
  {
    "id": 475,
    "latex": "\\lmoustache",
    "symbol": "⎰",
    "mathClass": "open",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "왼쪽 콧수염 구분자",
      "en": "left moustache delimiter"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "큰 적분 등의 구분자. 거의 안 쓰임"
  },
  {
    "id": 476,
    "latex": "\\rmoustache",
    "symbol": "⎱",
    "mathClass": "close",
    "field": "bracket",
    "tier": 4,
    "name": {
      "ko": "오른쪽 콧수염 구분자",
      "en": "right moustache delimiter"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "큰 적분 등의 구분자. 거의 안 쓰임"
  },
  {
    "id": 477,
    "latex": "\\ddag",
    "symbol": "‡",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "이중단검표",
      "en": "double dagger"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "각주 기호. \\ddagger의 텍스트형"
  },
  {
    "id": 478,
    "latex": "\\dag",
    "symbol": "†",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "단검표",
      "en": "dagger"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "각주 기호. 수학에서는 켤레전치(†)로도 쓰임"
  },
  {
    "id": 479,
    "latex": "\\P",
    "symbol": "¶",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "단락 기호",
      "en": "pilcrow / paragraph sign"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문서 단락 표시. 수학 기호 아님"
  },
  {
    "id": 480,
    "latex": "\\S",
    "symbol": "§",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 3,
    "name": {
      "ko": "절 기호",
      "en": "section sign"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "문서의 절(section) 참조 표시"
  },
  {
    "id": 481,
    "latex": "\\spadesuit",
    "symbol": "♠",
    "mathClass": "textord",
    "field": "arithmetic",
    "tier": 4,
    "name": {
      "ko": "스페이드",
      "en": "spade suit"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "카드 무늬 기호. 확률 예제나 임의 기호로 사용"
  },
  {
    "id": 482,
    "latex": "\\Im",
    "symbol": "ℑ",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "허수부",
      "en": "imaginary part"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "복소수의 허수부. 한국 교과서에서는 Im(z) 표기 사용"
  },
  {
    "id": 483,
    "latex": "\\heartsuit",
    "symbol": "♡",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "하트",
      "en": "heart suit"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "트럼프 무늬 기호. 수학 기호로는 거의 안 쓰임"
  },
  {
    "id": 484,
    "latex": "\\Re",
    "symbol": "ℜ",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "실수부",
      "en": "real part"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "복소수의 실수부. 한국 교과서에서는 Re(z) 표기 사용"
  },
  {
    "id": 485,
    "latex": "\\diamondsuit",
    "symbol": "♢",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "다이아몬드",
      "en": "diamond suit"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "트럼프 무늬 기호. 수학 기호로는 거의 안 쓰임"
  },
  {
    "id": 486,
    "latex": "\\sharp",
    "symbol": "♯",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "샤프",
      "en": "sharp"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "음악 기호(올림표). 집합 농도(#) 의미로도 쓰임"
  },
  {
    "id": 487,
    "latex": "\\wp",
    "symbol": "℘",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "바이어슈트라스 p함수",
      "en": "weierstrass p"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "타원함수론에서 사용. 멱집합 기호로도 쓰임"
  },
  {
    "id": 488,
    "latex": "\\clubsuit",
    "symbol": "♣",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "클로버",
      "en": "club suit"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "트럼프 무늬 기호. 집합론 클럽 원리(♣) 기호로도 쓰임"
  },
  {
    "id": 489,
    "latex": "\\natural",
    "symbol": "♮",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "제자리표",
      "en": "natural"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "음악 기호. 수학 기호로는 거의 안 쓰임"
  },
  {
    "id": 490,
    "latex": "\\ell",
    "symbol": "ℓ",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "엘(필기체 l)",
      "en": "script l"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "길이, 직선, 수열공간 등에 변수로 자주 사용"
  },
  {
    "id": 491,
    "latex": "\\flat",
    "symbol": "♭",
    "mathClass": "textord",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "플랫",
      "en": "flat"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "음악 기호(내림표). 미분기하 음악 동형사상에서도 사용"
  },
  {
    "id": 492,
    "latex": "\\nabla",
    "symbol": "∇",
    "mathClass": "textord",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "나블라",
      "en": "nabla"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "기울기/발산/회전 연산자(델 연산자). grad·div·curl"
  },
  {
    "id": 493,
    "latex": "\\exists",
    "symbol": "∃",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "존재한다",
      "en": "there exists"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "존재 양화사. '어떤 ~가 존재한다'"
  },
  {
    "id": 494,
    "latex": "\\hbar",
    "symbol": "ℏ",
    "mathClass": "textord",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "에이치바(디랙 상수)",
      "en": "reduced planck constant"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "물리학 상수(h/2π). 순수 수학에서는 거의 안 쓰임"
  },
  {
    "id": 495,
    "latex": "\\forall",
    "symbol": "∀",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "모든",
      "en": "for all"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "전칭 양화사. '모든 ~에 대하여'"
  },
  {
    "id": 496,
    "latex": "\\aleph",
    "symbol": "ℵ",
    "mathClass": "textord",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "알레프",
      "en": "aleph"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "무한 기수(초한수) 표기. ℵ₀ 등"
  },
  {
    "id": 497,
    "latex": "\\&",
    "symbol": "&",
    "mathClass": "textord",
    "field": "logic",
    "tier": 2,
    "name": {
      "ko": "앤드(그리고)",
      "en": "ampersand"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "논리곱(AND)으로도 쓰임. 행렬 정렬 구분자로도 사용"
  },
  {
    "id": 498,
    "latex": "\\#",
    "symbol": "#",
    "mathClass": "textord",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "우물정(농도/개수)",
      "en": "hash"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "집합의 농도/원소 개수(#A) 표기"
  },
  {
    "id": 499,
    "latex": "\\cdotp",
    "symbol": "⋅",
    "mathClass": "punct",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "가운뎃점(구두점)",
      "en": "centered dot punctuation"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "구두점용 가운뎃점. 곱셈점(\\cdot)과 구분"
  },
  {
    "id": 500,
    "latex": "\\ldotp",
    "symbol": ".",
    "mathClass": "punct",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "마침표(구두점)",
      "en": "period punctuation"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "구두점용 아래점. 소수점·마침표 위치"
  },
  {
    "id": 501,
    "latex": "\\owns",
    "symbol": "∋",
    "mathClass": "rel",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "원소로 가진다",
      "en": "contains as member"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "\\ni와 동일. 'A는 x를 원소로 가진다'"
  },
  {
    "id": 502,
    "latex": "\\dashv",
    "symbol": "⊣",
    "mathClass": "rel",
    "field": "logic",
    "tier": 4,
    "name": {
      "ko": "오른쪽 결합자",
      "en": "left tack"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "수반 관계(adjoint), 비추론 표기 등. 한국 교과서 미사용"
  },
  {
    "id": 503,
    "latex": "\\vdash",
    "symbol": "⊢",
    "mathClass": "rel",
    "field": "logic",
    "tier": 3,
    "name": {
      "ko": "증명한다(추론)",
      "en": "turnstile"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "증명 가능 관계(syntactic consequence)"
  },
  {
    "id": 504,
    "latex": "\\propto",
    "symbol": "∝",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "비례",
      "en": "proportional to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "정비례 기호. 'y∝x'"
  },
  {
    "id": 505,
    "latex": "\\ni",
    "symbol": "∋",
    "mathClass": "rel",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "원소로 가진다",
      "en": "contains as member"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "∈의 좌우 반전. 'A∋x'"
  },
  {
    "id": 506,
    "latex": "\\frown",
    "symbol": "⌢",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "호(아래로 볼록)",
      "en": "frown"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "호 표기 등에 드물게 사용. 한국 교과서 미사용"
  },
  {
    "id": 507,
    "latex": "\\doteq",
    "symbol": "≐",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "근사적으로 같음",
      "en": "approximately equals"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "정의에 의해 같음 또는 근사 등호. 한국은 ≈ 선호"
  },
  {
    "id": 508,
    "latex": "\\sqsupseteq",
    "symbol": "⊒",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "사각 포함(역)",
      "en": "square superset or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론/격자에서 포함관계. 한국 교과서 미사용"
  },
  {
    "id": 509,
    "latex": "\\sqsubseteq",
    "symbol": "⊑",
    "mathClass": "rel",
    "field": "set",
    "tier": 4,
    "name": {
      "ko": "사각 부분집합",
      "en": "square subset or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론/격자에서 포함관계. 한국 교과서 미사용"
  },
  {
    "id": 510,
    "latex": "\\smile",
    "symbol": "⌣",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 4,
    "name": {
      "ko": "호(위로 볼록)",
      "en": "smile"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "호 표기, 컵곱(cup product) 등. 한국 교과서 미사용"
  },
  {
    "id": 511,
    "latex": "\\bowtie",
    "symbol": "⋈",
    "mathClass": "rel",
    "field": "discrete",
    "tier": 4,
    "name": {
      "ko": "보타이(조인)",
      "en": "bowtie"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "관계대수의 자연조인(join) 등. 한국 교과서 미사용"
  },
  {
    "id": 512,
    "latex": "\\parallel",
    "symbol": "∥",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "평행",
      "en": "parallel"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "두 직선이 평행함. 노름 기호로도 사용"
  },
  {
    "id": 513,
    "latex": "\\asymp",
    "symbol": "≍",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 4,
    "name": {
      "ko": "점근적으로 같음",
      "en": "asymptotically equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "점근적 동치. 한국 교과서 미사용"
  },
  {
    "id": 514,
    "latex": "\\gg",
    "symbol": "≫",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "매우 크다",
      "en": "much greater than"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "훨씬 크다(>>). 부등식 비교"
  },
  {
    "id": 515,
    "latex": "\\ll",
    "symbol": "≪",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 2,
    "name": {
      "ko": "매우 작다",
      "en": "much less than"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "훨씬 작다(<<). 부등식 비교"
  },
  {
    "id": 516,
    "latex": "\\mid",
    "symbol": "∣",
    "mathClass": "rel",
    "field": "set",
    "tier": 2,
    "name": {
      "ko": "~such that(조건)",
      "en": "mid"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "집합 조건제시법의 세로줄, 정수론의 나눗셈 가능(a|b)"
  },
  {
    "id": 517,
    "latex": "\\simeq",
    "symbol": "≃",
    "mathClass": "rel",
    "field": "analysis",
    "tier": 3,
    "name": {
      "ko": "근사적으로 같음",
      "en": "asymptotically equal to"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "근사 등호 또는 동형(isomorphic) 표기"
  },
  {
    "id": 518,
    "latex": "\\succeq",
    "symbol": "⪰",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "우선하거나 같음",
      "en": "succeeds or equals"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서관계(부분순서). 한국 교과서 미사용"
  },
  {
    "id": 519,
    "latex": "\\preceq",
    "symbol": "⪯",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "선행하거나 같음",
      "en": "precedes or equal"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론(order theory)의 부분순서 기호. 한국 교과서에 거의 없음"
  },
  {
    "id": 520,
    "latex": "\\perp",
    "symbol": "⊥",
    "mathClass": "rel",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "수직",
      "en": "perpendicular"
    },
    "katexSupported": true,
    "needsReview": false
  },
  {
    "id": 521,
    "latex": "\\sim",
    "symbol": "∼",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "닮음",
      "en": "similar/tilde"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "도형의 닮음, 동치관계, 점근 등 맥락에 따라 다름"
  },
  {
    "id": 522,
    "latex": "\\succ",
    "symbol": "≻",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "후행함",
      "en": "succeeds"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 기호. 한국 교과서에 거의 없음"
  },
  {
    "id": 523,
    "latex": "\\prec",
    "symbol": "≺",
    "mathClass": "rel",
    "field": "set",
    "tier": 3,
    "name": {
      "ko": "선행함",
      "en": "precedes"
    },
    "katexSupported": true,
    "needsReview": true,
    "note": "순서론 기호. 한국 교과서에 거의 없음"
  },
  {
    "id": 524,
    "latex": "\\equiv",
    "symbol": "≡",
    "mathClass": "rel",
    "field": "algebra",
    "tier": 2,
    "name": {
      "ko": "합동",
      "en": "equivalent/congruent"
    },
    "katexSupported": true,
    "needsReview": false,
    "note": "정수론의 합동(mod), 항등 등 맥락에 따라 다름"
  },
  {
    "id": 525,
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
    "needsReview": false,
    "displayLatex": "\\frac{a}{b}",
    "cursorOffset": 6
  },
  {
    "id": 526,
    "latex": "\\dfrac{}{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "분수(디스플레이)",
      "en": "display fraction"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\dfrac{a}{b}",
    "cursorOffset": 7,
    "note": "display 스타일 분수, 표기는 일반 분수와 동일"
  },
  {
    "id": 527,
    "latex": "\\tfrac{}{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 1,
    "name": {
      "ko": "분수(텍스트)",
      "en": "text fraction"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\tfrac{a}{b}",
    "cursorOffset": 7,
    "note": "text 스타일 분수, 표기는 일반 분수와 동일"
  },
  {
    "id": 528,
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
    "needsReview": false,
    "displayLatex": "\\sqrt{x}",
    "cursorOffset": 6,
    "note": "근호"
  },
  {
    "id": 529,
    "latex": "\\sqrt[]{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "arithmetic",
    "tier": 2,
    "name": {
      "ko": "거듭제곱근",
      "en": "nth root"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\sqrt[n]{x}",
    "cursorOffset": 6,
    "note": "n제곱근, 근호"
  },
  {
    "id": 530,
    "latex": "^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "위 첨자",
      "en": "superscript"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "x^{n}",
    "cursorOffset": 2,
    "note": "지수 표기에 사용"
  },
  {
    "id": 531,
    "latex": "_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "아래 첨자",
      "en": "subscript"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "x_{n}",
    "cursorOffset": 2
  },
  {
    "id": 532,
    "latex": "\\overline{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "geometry",
    "tier": 1,
    "name": {
      "ko": "오버라인",
      "en": "overline"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\overline{AB}",
    "cursorOffset": 10,
    "note": "선분(\\overline{AB}), 켤레복소수, 순환소수 등 맥락에 따라 다름"
  },
  {
    "id": 533,
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
    "needsReview": false,
    "displayLatex": "\\vec{v}",
    "cursorOffset": 5
  },
  {
    "id": 534,
    "latex": "\\overrightarrow{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "vector",
    "tier": 1,
    "name": {
      "ko": "벡터(방향)",
      "en": "vector arrow"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\overrightarrow{AB}",
    "cursorOffset": 15,
    "note": "방향이 있는 벡터 표기(\\overrightarrow{AB})"
  },
  {
    "id": 535,
    "latex": "\\hat{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "statistics",
    "tier": 2,
    "name": {
      "ko": "햇",
      "en": "hat"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\hat{x}",
    "cursorOffset": 5,
    "note": "추정량(통계), 단위벡터 등 맥락에 따라 다름"
  },
  {
    "id": 536,
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
    "needsReview": false,
    "displayLatex": "\\int_{a}^{b}",
    "cursorOffset": 6
  },
  {
    "id": 537,
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
    "needsReview": false,
    "displayLatex": "\\iint_{D}",
    "cursorOffset": 7,
    "note": "다변수 미적분"
  },
  {
    "id": 538,
    "latex": "\\oint_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 3,
    "name": {
      "ko": "선적분(폐곡선)",
      "en": "contour integral"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\oint_{C}",
    "cursorOffset": 7,
    "note": "폐곡선 적분, 벡터해석"
  },
  {
    "id": 539,
    "latex": "\\sum_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "discrete",
    "tier": 1,
    "name": {
      "ko": "합(시그마)",
      "en": "summation"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\sum_{k=1}^{n}",
    "cursorOffset": 6,
    "note": "수열의 합"
  },
  {
    "id": 540,
    "latex": "\\prod_{}^{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "discrete",
    "tier": 2,
    "name": {
      "ko": "곱(파이)",
      "en": "product"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\prod_{k=1}^{n}",
    "cursorOffset": 7,
    "note": "총곱"
  },
  {
    "id": 541,
    "latex": "\\lim_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "극한",
      "en": "limit"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\lim_{x \\to 0}",
    "cursorOffset": 6
  },
  {
    "id": 542,
    "latex": "\\frac{d}{dx}",
    "symbol": "",
    "mathClass": "structured",
    "field": "calculus",
    "tier": 2,
    "name": {
      "ko": "미분(도함수)",
      "en": "derivative"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\frac{d}{dx}",
    "cursorOffset": 12,
    "note": "라이프니츠 미분 연산자"
  },
  {
    "id": 543,
    "latex": "\\binom{}{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "probability",
    "tier": 2,
    "name": {
      "ko": "이항계수",
      "en": "binomial coefficient"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\binom{n}{r}",
    "cursorOffset": 7,
    "note": "한국 교과서는 보통 {}_nC_r 표기를 더 많이 씀"
  },
  {
    "id": 544,
    "latex": "{}_{}\\mathrm{P}_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "probability",
    "tier": 1,
    "name": {
      "ko": "순열",
      "en": "permutation"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "{}_{n}\\mathrm{P}_{r}",
    "cursorOffset": 1,
    "note": "{}_nP_r, 한국 교과서 표준 표기"
  },
  {
    "id": 545,
    "latex": "{}_{}\\mathrm{C}_{}",
    "symbol": "",
    "mathClass": "structured",
    "field": "probability",
    "tier": 1,
    "name": {
      "ko": "조합",
      "en": "combination"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "{}_{n}\\mathrm{C}_{r}",
    "cursorOffset": 1,
    "note": "{}_nC_r, 한국 교과서 표준 표기"
  },
  {
    "id": 546,
    "latex": "\\begin{pmatrix} \\end{pmatrix}",
    "symbol": "",
    "mathClass": "structured",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "행렬(소괄호)",
      "en": "matrix (parentheses)"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}",
    "cursorOffset": 15,
    "note": "소괄호 행렬"
  },
  {
    "id": 547,
    "latex": "\\begin{bmatrix} \\end{bmatrix}",
    "symbol": "",
    "mathClass": "structured",
    "field": "linear-algebra",
    "tier": 2,
    "name": {
      "ko": "행렬(대괄호)",
      "en": "matrix (brackets)"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}",
    "cursorOffset": 15,
    "note": "대괄호 행렬"
  },
  {
    "id": 548,
    "latex": "\\begin{cases} \\end{cases}",
    "symbol": "",
    "mathClass": "structured",
    "field": "algebra",
    "tier": 1,
    "name": {
      "ko": "경우 나눔",
      "en": "cases"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\begin{cases}a&x>0\\\\b&x\\le 0\\end{cases}",
    "cursorOffset": 14,
    "note": "조건별 정의(분수함수/연립 등)"
  },
  {
    "id": 549,
    "latex": "\\left( \\right)",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "자동 크기 소괄호",
      "en": "auto-sized parentheses"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\left( x \\right)",
    "cursorOffset": 7
  },
  {
    "id": 550,
    "latex": "\\left[ \\right]",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "자동 크기 대괄호",
      "en": "auto-sized brackets"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\left[ x \\right]",
    "cursorOffset": 7
  },
  {
    "id": 551,
    "latex": "\\left\\{ \\right\\}",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "자동 크기 중괄호",
      "en": "auto-sized braces"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\left\\{ x \\right\\}",
    "cursorOffset": 8
  },
  {
    "id": 552,
    "latex": "\\left| \\right|",
    "symbol": "",
    "mathClass": "structured",
    "field": "bracket",
    "tier": 1,
    "name": {
      "ko": "절댓값(자동 크기)",
      "en": "absolute value"
    },
    "katexSupported": true,
    "needsReview": false,
    "displayLatex": "\\left| x \\right|",
    "cursorOffset": 7,
    "note": "절댓값/노름/행렬식 등 맥락에 따라 다름"
  }
];

/** 사용 팔레트 표시 subset (tier<=2 && !needsReview). */
export const CURATED_SYMBOLS: MathSymbol[] = ALL_SYMBOLS.filter(
  (s) => s.tier <= 2 && !s.needsReview && s.katexSupported,
);

/** field → 기본 카테고리 id 역매핑 */
export const FIELD_TO_CATEGORY: Record<string, string> = {
  "arithmetic": "basic",
  "vector": "basic",
  "calculus": "calculus",
  "analysis": "calculus",
  "algebra": "relation",
  "set": "set-logic",
  "logic": "set-logic",
  "greek": "greek",
  "geometry": "geometry",
  "probability": "geometry",
  "statistics": "geometry",
  "discrete": "geometry",
  "linear-algebra": "geometry",
  "bracket": "brackets"
};
