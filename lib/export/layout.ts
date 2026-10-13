/**
 * Phase 70 D19 — 내보내기 레이아웃 상수 (단일 원천).
 *
 * 정본은 현행 인쇄 CSS(`components/print/PrintStyles.css`) 실측이다 — 70b가 그 파일을 철거한 뒤에도
 * 숫자는 여기 남는다. 직렬화기 두 벌(`latex.ts` A4 1단 · `typst.ts` A3 2단)이 이 표만 읽는다.
 * 각 값 옆의 괄호는 출처 행(철거 전 기준)이다.
 *
 * ⚠ import 0 · 순수 상수 + 변환 함수뿐.
 * ⚠ Typst의 세로 간격(`par.spacing`·`block(above/below)`)은 **줄 상자 끝↔끝**이라 CSS 마진과 뜻이
 *   다르다(D26) — CSS 값을 그대로 쓰지 말고 `typstGap()`을 거칠 것. 실측: `spacing: 6pt`면 문단 사이
 *   13.3pt로 줄 사이(17pt)보다 좁아졌고, `leading + 6pt`면 23.0pt(= CSS 17 + 6)였다(v4 부록 I-3).
 */

/** 본문 글자 크기(pt) — `.print-body { font-size: 10pt }`(33) */
export const BODY_PT = 10;

/** 줄 간격 — CSS `line-height: 1.7`(34) = 기준선 17pt. Typst `par.leading` 시작값 0.97em → 16.99pt 실측(P0-8 종료) */
export const LINE_HEIGHT = 1.7;
export const TYPST_LEADING_EM = 0.97;
export const TYPST_LEADING_PT = TYPST_LEADING_EM * BODY_PT;

/** CSS 세로 간격(pt, 철거 전 PrintStyles 실측) */
export const CSS_GAP_PT = {
  paragraph: 6,        // p { margin: 0 0 6pt }(67)
  display: 11,         // .katex-display { margin: 11pt 0 }(89)
  callout: 11,         // .callout-block { margin: 11pt 0 }(161)
  coach: 11,           // .coach-block { margin: 11pt 0 }(176)
  case: 11,            // .case-block { margin: 11pt 0 }(200)
  framed: 12,          // .print-bordered-block { margin: 12pt 0 }(244)
  circledRun: 11,      // ① 밭 위·아래(154-156)
  choices: 6,          // .print-choices-row { margin: 6pt 0 }(254)
  tabLabelBelow: 8,    // .print-tab-label { margin-bottom: 8pt }(60)
  table: 6,            // table { margin: 6pt 0 }(97)
} as const;

/** heading 블록(첫 블록 제외) 위 여백 — `PrintableContent.tsx:86-88` paddingTop 1em */
export const HEADING_ABOVE_EM = 1;

/** D26 — CSS 세로 마진(pt) → Typst 블록 간격(pt). 시작값은 "CSS + leading", P0-8′에서 기준선 대조로 확정 */
export function typstGap(cssPt: number): number {
  return round2(cssPt + TYPST_LEADING_PT);
}

/** 제목 크기(pt) — h1 13 · h2 12 · h3 11, 굵기 600(64-66) */
export const HEADING_PT: Readonly<Record<1 | 2 | 3, number>> = { 1: 13, 2: 12, 3: 11 };
export const HEADING_WEIGHT = 600;

/** 탭 라벨 — 12pt 600 · 아래 0.15mm `#999` 선 · 패딩 3pt(57-62) */
export const TAB_LABEL = { pt: 12, weight: 600, ruleMm: 0.15, ruleColor: '#999999', padBelowPt: 3 } as const;

/** 들여쓰기 */
export const INDENT_EM = {
  display: 2,          // fleqn 2em(24)
  callout: 2,          // .callout-block padding-left 2em(162)
  gana: 2.5,           // (가)·ㄱ. 내어쓰기(145-147)
  circled: 2,          // ① 내어쓰기(151)
  circledRunLeft: 1,   // ① 밭 margin-left 1em(151)
  coach: 1,            // .coach-block padding-left 1em(178)
} as const;

/** 선 굵기(mm) */
export const STROKE_MM = {
  framed: 0.3,         // .print-bordered-block 0.3mm(241) · blockquote(69)
  coachBar: 0.3,       // .coach-block border-left 0.3mm(177)
  tableCell: 0.2,      // th, td 0.2mm(98)
  hr: 0.1,             // hr 0.1mm #999(86)
} as const;

/** 테두리 상자 안쪽 여백(pt) — 6pt 8pt(243) */
export const FRAMED_INSET_PT = { y: 6, x: 8 } as const;

/** 마커·라벨 굵기 */
export const WEIGHT = {
  marker: 600,         // (가)·ㄱ.·①(145·150)
  caseTitle: 600,      // 경우 제목행 전체(234)
  caseRef: 600,        // 본문 C1·C2a(271)
  coachLabel: 700,     // 코칭 'Tip'(182)
  solutionStrong: 700, // 풀이 탭 strong(54)
  choiceLabel: 400,    // 선택지 라벨(267)
} as const;

/** 경우 dot(Q14 — dot만, rail 없음): 거터 −1.2em · 지름 0.44em(하위 0.26em) · 검정(223-231) */
export const CASE_DOT = { xEm: -1.2, topEm: 0.44, subEm: 0.26 } as const;

/** 선택지 — 1~3개 3열 · 4~5개 5열 · 열 간격 8pt · 라벨↔내용 0.5em · 세로 가운데(M2 B, 250-266) */
export const CHOICES = { columnGapPt: 8, labelGapEm: 0.5 } as const;
export function choiceColumns(n: number): number {
  return n <= 3 ? 3 : 5;
}

/** 표 — 9.5pt · 셀 패딩 3pt 6pt · 가운데 · th 600 + #f5f5f5(97-99) */
export const TABLE = { pt: 9.5, padYPt: 3, padXPt: 6, headFill: '#f5f5f5', headWeight: 600 } as const;

/** ①~⑳ 크기 — 현행 인쇄 MathoryCircled size-adjust 88%(Q17) */
export const CIRCLED_SCALE = 0.88;

/** cases·행렬 행간(D27·N2) 시작값 — mitex는 \arraystretch를 반영하지 않는다(0.2.7은 오류) */
export const CASES_GAP_EM = 1;

/* ═══ 쪽 규격 ═══ */

/** PDF·.typ — 현행 인쇄 그대로(D10): A3 세로 · 상하 30 · 좌우 20 · 2단 10mm(@page · .print-body) */
export const TYPST_PAGE = {
  paper: 'a3', widthMm: 297, marginYMm: 30, marginXMm: 20, columns: 2, gutterMm: 10,
} as const;

/** .tex — A4 1단 · 여백 20mm(D10) */
export const LATEX_PAGE = { paper: 'a4', widthMm: 210, marginMm: 20 } as const;

/** px → pt (CSS 1px = 0.75pt) */
export const PX_TO_PT = 0.75;

/** 그림 기본 폭·상한(px) — `PrintImageBlock` w = imageWidth || 400, min(w, 600)(235-258) */
export const IMAGE_DEFAULT_PX = 400;
export const IMAGE_MAX_PX = 600;
/** svg 상자 기본 높이(px) — `PrintSvgBlock` height = 300 */
export const SVG_DEFAULT_HEIGHT_PX = 300;
/** 그림 폭 상한 = 열 폭의 90%(maxWidth 90%) */
export const IMAGE_MAX_RATIO = 0.9;

const MM_TO_PT = 72 / 25.4;

/** Typst 한 열의 폭(mm) = (297 − 2·20 − 10) / 2 = 123.5 */
export function typstColumnWidthMm(): number {
  const p = TYPST_PAGE;
  return (p.widthMm - 2 * p.marginXMm - p.gutterMm * (p.columns - 1)) / p.columns;
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
