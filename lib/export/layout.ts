/**
 * Phase 70 D19 — 내보내기 레이아웃 상수 (단일 원천).
 *
 * Phase 70c(2026-10-13 덕수 — 권장안 A~H): PDF·.typ의 쪽은 **수능 시험지 양식**(`docs/reference/suneung-typst-v1/`)에서
 * 머리말·'5지선다형'/'단답형'·확인 사항·저작권 문구를 뺀 것이다 — 모든 쪽 같은 규격(표지면 없음), 위 가로 괘선 ·
 * 가운데 세로 괘선 · 하단 쪽 번호 상자는 남긴다. 글자 11.5pt Noto Serif KR + 원본 실측 자간·어절 간격(A).
 * 블록 사이 간격은 옛 CSS 인쇄(PrintStyles, 10pt 기준) 실측값을 **글자 비율(×1.15)로 키워** 쓴다(D).
 * 직렬화기 두 벌(`latex.ts` A4 1단 · `typst.ts` 수능 양식 A3 2단)이 이 표만 읽는다.
 *
 * ⚠ import 0 · 순수 상수 + 변환 함수뿐.
 * ⚠ Typst의 세로 간격(`par.spacing`·`block(above/below)`)은 **줄 상자 끝↔끝**이라 CSS 마진과 뜻이 다르다(D26) —
 *   CSS 값을 그대로 쓰지 말고 `typstGap()`을 거칠 것.
 */

/* ═══ 글자 · 행간 (70c A·B) ═══ */

/** 본문 글자 크기(pt) — 수능 양식 11.5pt(옛 CSS 인쇄 10pt) */
export const BODY_PT = 11.5;
/** 옛 CSS 인쇄 본문(pt) — 블록 간격 비율 환산의 기준 */
export const CSS_BODY_PT = 10;
/** 블록 간격 배율(D) = 11.5 / 10 */
export const GAP_SCALE = BODY_PT / CSS_BODY_PT;

/** 자간·어절 간격 — 수능 원본 실측(템플릿 TRACKING · WORD-SPACING) */
export const TRACKING_EM = -0.048;
export const WORD_SPACING_PCT = 168;

/**
 * 행간(B) — 템플릿과 같은 줄 상자(top-edge ascender · bottom-edge descender) + leading 0.69em.
 * 실측: 평범한 줄 기준선 간격 20.8pt(수능 원본 20.2pt) · 큰 인라인 수식이 든 줄은 자동으로 벌어진다
 * (분수 23.5 · 시그마 27.8 · 적분 28.7 · 번분수 29.2pt — 가변 행간은 Typst가 줄마다 높이를 재서 저절로 된다).
 */
export const TYPST_TOP_EDGE = 'ascender';
export const TYPST_BOTTOM_EDGE = 'descender';
export const TYPST_LEADING_EM = 0.69;
export const TYPST_LEADING_PT = TYPST_LEADING_EM * BODY_PT;

/** 옛 CSS 세로 간격(pt, 10pt 기준 — 철거 전 PrintStyles 실측) */
export const CSS_GAP_PT = {
  paragraph: 6,        // p { margin: 0 0 6pt }
  display: 11,         // .katex-display { margin: 11pt 0 }
  callout: 11,         // .callout-block { margin: 11pt 0 }
  coach: 11,           // .coach-block { margin: 11pt 0 }
  case: 11,            // .case-block { margin: 11pt 0 }
  framed: 12,          // .print-bordered-block { margin: 12pt 0 }
  circledRun: 11,      // ① 밭 위·아래
  choices: 6,          // .print-choices-row { margin: 6pt 0 }
  tabLabelBelow: 8,    // .print-tab-label { margin-bottom: 8pt }
  table: 6,            // table { margin: 6pt 0 }
} as const;

/** heading 블록(첫 블록 제외) 위 여백 */
export const HEADING_ABOVE_EM = 1;

/** D26·70c D — 옛 CSS 세로 마진(pt) → Typst 블록 간격(pt) = CSS × 1.15 + leading. P0-8′ 실물 조율 대상 */
export function typstGap(cssPt: number): number {
  return round2(cssPt * GAP_SCALE + TYPST_LEADING_PT);
}

/** 본문 제목 크기(pt) — 본문(11.5)과 탭 제목(13) 사이: h1 13 · h2 12.5 · h3 12 · 굵기 600 */
export const HEADING_PT: Readonly<Record<1 | 2 | 3, number>> = { 1: 13, 2: 12.5, 3: 12 };
export const HEADING_WEIGHT = 600;

/** 탭 제목(70c C) — 본문보다 한 단계 크고 굵게(13pt Bold, 템플릿 문항 번호 크기) · 밑줄 없음 */
export const TAB_TITLE = { pt: 13, weight: 700, belowPt: 10 } as const;

/** 70c C — 문제 탭 '문제' · 풀이 탭 '해설'(앱 화면 이름은 '풀이') · 그 밖의 탭은 이름 그대로 */
export function tabTitle(id: string, label: string): string {
  if (id === 'question') return '문제';
  if (id === 'solution') return '해설';
  return label;
}

/** 들여쓰기 */
export const INDENT_EM = {
  display: 2,          // fleqn 2em
  callout: 2,          // .callout-block padding-left 2em
  gana: 2.5,           // (가)·ㄱ. 내어쓰기
  circled: 2,          // ① 내어쓰기
  circledRunLeft: 1,   // ① 밭 margin-left 1em
  coach: 1,            // .coach-block padding-left 1em
} as const;

/** 선 굵기(mm) */
export const STROKE_MM = {
  framed: 0.13,        // 70c — 글상자·ㄱㄴㄷ·가나·상자(옛 0.3mm "부담스럽게 두껍다") = 템플릿 BOX-STROKE
  coachBar: 0.3,       // 코칭 왼쪽 바(신호 — 그대로)
  tableCell: 0.2,      // th, td
  hr: 0.1,             // hr #999
} as const;

/** 테두리 상자 안쪽 여백(mm) — 70c: 위아래를 넉넉히(템플릿 조건 상자 3.5mm · 옛 6pt 8pt) */
export const FRAMED_INSET_MM = { y: 3.5, x: 3.5 } as const;

/** 마커·라벨 굵기 */
export const WEIGHT = {
  marker: 400,         // 70c E — (가)·ㄱ.·① 본문과 같은 굵기(화면과 일치 · 옛 인쇄 600)
  caseTitle: 600,      // 경우 제목행 전체
  caseRef: 600,        // 본문 C1·C2a
  coachLabel: 700,     // 코칭 'Tip'
  solutionStrong: 700, // 풀이 탭 strong
  choiceLabel: 400,    // 선택지 라벨
} as const;

/**
 * 경우 dot(Q14 — dot만): 거터 −0.9em · 지름 0.44em(하위 0.26em) · 검정.
 * xEm: 옛 인쇄 −1.2em은 70c 양식의 가운데 세로 괘선(단 간격 11mm의 한가운데 ≈ 15.6pt)에 dot이 닿았다(오른쪽 단, PNG 확인) → −0.9em(≈10.4pt).
 * centerFromTopEm = 제목행 첫 줄 상자 위끝에서 dot 중심까지(줄 상자가 ascender부터라 cap-height 시절 0.38em보다 깊다 — PNG로 확인)
 */
export const CASE_DOT = { xEm: -0.9, topEm: 0.44, subEm: 0.26, centerFromTopEm: 0.78 } as const;

/** 선택지 — 1~3개 3열 · 4~5개 5열(한 항목이라도 5열 칸을 넘으면 3열 — 70c F) · 열 간격 8pt · 라벨↔내용 0.5em · 세로 가운데 */
export const CHOICES = { columnGapPt: 8, labelGapEm: 0.5, rowGapEm: 0.8 } as const;
export function choiceColumns(n: number): number {
  return n <= 3 ? 3 : 5;
}

/** 표 — 내용 폭 · 가운데(70c) · 글자 11pt(옛 9.5pt × 1.15) · 셀 패딩 3pt 6pt · th 600 + #f5f5f5 */
export const TABLE = { pt: 11, padYPt: 3, padXPt: 6, headFill: '#f5f5f5', headWeight: 600 } as const;

/** ①~⑳ 크기(Q17) */
export const CIRCLED_SCALE = 0.88;

/** cases·행렬 행간(D27·N2) */
export const CASES_GAP_EM = 1;

/* ═══ 쪽 규격 ═══ */

/**
 * PDF·.typ — 수능 시험지 양식(70c): A3 세로 · 좌우 31mm · 위 가로 괘선 52mm(0.4mm) · 본문 56~376.5mm ·
 * 2단 · 단 간격 11mm · 가운데 세로 괘선 0.3mm(52~376.5mm) · 하단 중앙 쪽 번호 상자 18×7.8mm(사선 · 12pt · 선 0.13mm).
 * 값은 `docs/reference/suneung-typst-v1/suneung-template.typ`의 실측 상수와 같다.
 */
export const SUNEUNG_PAGE = {
  paper: 'a3', widthMm: 297, heightMm: 420,
  sideMm: 31, ruleYMm: 52, bodyTopMm: 56, bodyBottomMm: 376.5,
  columns: 2, gutterMm: 11,
  ruleWMm: 0.4, colRuleWMm: 0.3,
  pageBox: { wMm: 18, hMm: 7.8, pt: 12, strokeMm: 0.13, dyMm: 1.6, padXMm: 1.5, padYMm: 0.6 },
} as const;

/** .tex — A4 1단 · 여백 20mm(D10 — 원고용, 70c에서도 그대로) */
export const LATEX_PAGE = { paper: 'a4', widthMm: 210, marginMm: 20 } as const;

/** px → pt (CSS 1px = 0.75pt) */
export const PX_TO_PT = 0.75;

/** 그림 기본 폭·상한(px) */
export const IMAGE_DEFAULT_PX = 400;
export const IMAGE_MAX_PX = 600;
/** svg 상자 기본 높이(px) */
export const SVG_DEFAULT_HEIGHT_PX = 300;
/** 그림 폭 상한 = 열 폭의 90% */
export const IMAGE_MAX_RATIO = 0.9;

const MM_TO_PT = 72 / 25.4;

/** Typst 한 열의 폭(mm) = (297 − 2·31 − 11) / 2 = 112 */
export function typstColumnWidthMm(): number {
  const p = SUNEUNG_PAGE;
  return (p.widthMm - 2 * p.sideMm - p.gutterMm * (p.columns - 1)) / p.columns;
}

/** LaTeX 본문 폭(mm) = 210 − 2·20 = 170 */
export function latexTextWidthMm(): number {
  return LATEX_PAGE.widthMm - 2 * LATEX_PAGE.marginMm;
}

/**
 * D20 — 그림 폭(pt) = min(px × 0.75, 열 폭 × 0.9). 그림은 최상위 블록뿐이라 열 폭이 확정이다.
 * ⚠ Typst `calc.min(길이, 90%)`는 "cannot compare ratio and length" 컴파일 오류 — 숫자로 계산해 넘긴다.
 */
export function imageWidthPt(widthPx: number | null | undefined, target: 'typst' | 'latex'): number {
  const px = Math.min(widthPx && widthPx > 0 ? widthPx : IMAGE_DEFAULT_PX, IMAGE_MAX_PX);
  const colMm = target === 'typst' ? typstColumnWidthMm() : latexTextWidthMm();
  const capPt = colMm * MM_TO_PT * IMAGE_MAX_RATIO;
  return round2(Math.min(px * PX_TO_PT, capPt));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
