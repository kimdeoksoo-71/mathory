/**
 * Phase 69 — iPad 필기 패드의 획·격자·내보내기 **판정**. 순수 모듈(**import 0** · `npm run test:ink`).
 *
 * 좌표는 전부 **종이 좌표**(쓰기 면 CSS px, 확대 1배 기준)다. 확대(lib/ink/view)는 그릴 때의 보기 변환일 뿐이라
 * 획 데이터·내보내기 PNG·획 JSON 어디에도 흔적이 없다.
 *
 * 수치의 원천은 덕수 확정 샘플 「Mathory Ink Pad」 v4(2026-10-10, iPad 실기기 확인) — 계획서 v4 §5-4·§5-5.
 * ⚠ 브라우저 API(`measureText`·canvas)는 쓰지 않는다 — 글자 폭은 `exampleLayout`에 주입받는다.
 */

export interface Stroke {
  x: number[];
  y: number[];
  /** 각 점의 시각(ms, performance.now 기준) — Mathpix strokes 후속 비교용 */
  t: number[];
}

/** 획 굵기(종이 단위). 확대하면 화면에서 같이 굵어진다 — 종이처럼 */
export const STROKE_WIDTH = 2.5;

/** 확정 디자인: 5줄 · 보조선 2개(줄 높이 34%·68% — 윗선 = 본문 글자 윗선, 아랫선 = 기준선) · 점선 · 28% · 줄 사이 구분선 7% */
export const GUIDE = {
  rows: 5,
  lines: [0.34, 0.68] as const,
  dash: [1.5, 5] as const,
  alpha: 0.28,
  sepAlpha: 0.07,
  inset: 16,
};

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

/** 모든 점을 덮는 최소 사각형. 점이 하나도 없으면 null */
export function strokeBounds(strokes: Stroke[]): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) {
    for (let i = 0; i < s.x.length; i++) {
      if (s.x[i] < x0) x0 = s.x[i];
      if (s.x[i] > x1) x1 = s.x[i];
      if (s.y[i] < y0) y0 = s.y[i];
      if (s.y[i] > y1) y1 = s.y[i];
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

export interface ExportPlan {
  /** 내보낼 영역의 종이 좌표 왼쪽 위 — 그릴 때 이만큼 빼고 scale을 곱한다 */
  ox: number;
  oy: number;
  /** 결과 PNG 크기(px) */
  w: number;
  h: number;
  scale: number;
}

/**
 * 내보내기 계획 — 흰 배경 · 획 bounds + 여백 24 + 획 굵기 · 축척 = min(2, maxDim / 긴 변).
 * ⚠ 축척은 기기 DPR과 무관하다(샘플 `exportPng`) — iPad 기종이 달라도 같은 획이면 같은 이미지.
 * Mathpix base64 상한 2MB를 넘으면 호출부가 `maxDim: 1400`으로 다시 계획한다(계획서 D7).
 */
export function exportPlan(
  b: Bounds,
  opts: { pad?: number; strokeWidth?: number; maxDim?: number; maxScale?: number } = {},
): ExportPlan {
  const pad = opts.pad ?? 24;
  const sw = opts.strokeWidth ?? STROKE_WIDTH;
  const maxDim = opts.maxDim ?? 2000;
  const maxScale = opts.maxScale ?? 2;
  const bw = b.x1 - b.x0 + pad * 2 + sw;
  const bh = b.y1 - b.y0 + pad * 2 + sw;
  const scale = Math.min(maxScale, maxDim / Math.max(bw, bh));
  return {
    ox: b.x0 - pad - sw / 2,
    oy: b.y0 - pad - sw / 2,
    w: Math.max(1, Math.round(bw * scale)),
    h: Math.max(1, Math.round(bh * scale)),
    scale,
  };
}

/** Mathpix `/v3/strokes` 요청의 `strokes.strokes` 형식(획마다 하위 배열) — 좌표는 소수 1자리 */
export function toMathpixStrokes(strokes: Stroke[]): { x: number[][]; y: number[][] } {
  const r = (v: number) => Math.round(v * 10) / 10;
  return { x: strokes.map((s) => s.x.map(r)), y: strokes.map((s) => s.y.map(r)) };
}

/** 줄 `row`(0부터)의 보조선 y(종이 좌표). 줄 높이 = 쓰기 면 높이 / rows */
export function guideYs(rowH: number, row: number): number[] {
  return GUIDE.lines.map((p) => row * rowH + rowH * p);
}

/* ── 마지막 줄 오른쪽 끝 예시 `\int_{a}^{b}\frac{4}{3}x^{2} dx` ──────────────────────────────
   샘플 `drawExample` 그대로. 본문 글자(x·d·숫자)는 두 선 사이, 위첨자(b·²)는 윗선 위, 아래첨자(a)는
   기준선 아래, ∫와 분수는 두 선을 넘는다 — 보조선 쓰는 법을 보여 주는 것이 목적. */

export type ExampleFamily = 'math' | 'main' | 'size2';
export type ExampleOp =
  | { kind: 'text'; text: string; size: number; family: ExampleFamily; x: number; y: number }
  | { kind: 'line'; x0: number; x1: number; y: number; width: number };

/** 글자 폭 측정(브라우저에서는 canvas measureText) */
export type MeasureFn = (text: string, size: number, family: ExampleFamily) => number;

/**
 * 예시 수식의 그리기 명령. x는 수식 왼쪽 끝 기준(호출부가 `max(inset, W − 32 − width)`만큼 민다), y는 종이 좌표.
 * `yU`·`yB` = 마지막 줄의 윗선·기준선.
 */
export function exampleLayout(yU: number, yB: number, measure: MeasureFn): { ops: ExampleOp[]; width: number } {
  const bh = yB - yU, F = bh / 0.72, yM = (yU + yB) / 2;
  const ops: ExampleOp[] = [];
  let x = 0;
  const text = (t: string, size: number, family: ExampleFamily, dx: number, y: number): number => {
    ops.push({ kind: 'text', text: t, size, family, x: x + dx, y });
    return measure(t, size, family);
  };

  // ∫ — KaTeX display 적분 글리프(높이 1.36em · 깊이 0.862em)
  const iH = bh * 2.2, iS = iH / 2.222, iTop = yM - iH / 2;
  const iW = text('∫', iS, 'size2', 0, iTop + 1.36 * iS);
  // 적분 한계(KaTeX 배치): 위첨자 b는 글리프 폭 + 이탤릭 보정(0.444em) 뒤 · 아래첨자 a는 글리프 폭 바로 뒤
  const sF = F * 0.62;
  const bX = iW + iS * 0.444;
  const wb = text('b', sF, 'math', bX, iTop + sF * 0.72);
  const aX = iW + iS * 0.02;
  const wa = text('a', sF, 'math', aX, iTop + iH + sF * 0.02);
  x += Math.max(bX + wb, aX + wa) + F * 0.22;

  // 분수 4/3 — 가로줄이 두 선 사이 가운데
  const nF = F * 0.8;
  const w4 = measure('4', nF, 'main'), w3 = measure('3', nF, 'main');
  const fw = Math.max(w4, w3) + F * 0.24, fx = x;
  text('4', nF, 'main', (fw - w4) / 2, yM - F * 0.13);
  text('3', nF, 'main', (fw - w3) / 2, yM + F * 0.13 + nF * 0.68);
  ops.push({ kind: 'line', x0: fx, x1: fx + fw, y: yM, width: Math.max(1, F * 0.03) });
  x += fw + F * 0.12;

  // x² — 소스 `x^{2} dx`엔 `\,`이 없다 — LaTeX대로 붙여 쓴다
  x += text('x', F, 'math', 0, yB);
  x += text('2', sF, 'main', F * 0.02, yU + bh * 0.2) + F * 0.08;

  // dx — 둘 다 수식 이탤릭
  x += text('d', F, 'math', 0, yB);
  x += text('x', F, 'math', 0, yB);

  return { ops, width: x };
}
