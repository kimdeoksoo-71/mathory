/**
 * Phase 69 D5′ — iPad 필기 패드의 **두 손가락 확대·이동**(보기 변환) 판정. 순수 모듈(**import 0** · `npm run test:ink`).
 *
 * 보기 변환 `{ s, tx, ty }`: 화면 = 종이 · s + t(쓰기 면 기준 CSS px). 획·격자·예시는 전부 종이 좌표에 있고
 * 그릴 때 `ctx.setTransform(dpr·s, 0, 0, dpr·s, dpr·tx, dpr·ty)` 한 번으로 바뀐다 → 데이터에 흔적이 없다.
 *
 * ⚠ 캔버스는 화면 크기 그대로 둔다 — 확대를 큰 버퍼로 만들면 iOS 캔버스 면적 상한(약 1,678만 px)을 넘는다.
 * ⚠ 손바닥 규칙 상수 넷(PAIR_WINDOW_MS · PEN_COOLDOWN_MS · SLOP_PX · ZOOM_MAX)은 **실물에서 조율**한다 — 이 파일 한 곳.
 */

export interface View { s: number; tx: number; ty: number }
export interface Pt { x: number; y: number }

export const IDENTITY: View = { s: 1, tx: 0, ty: 0 };
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
/** 두 손가락의 착지 시각 차가 이 안이어야 제스처 — 먼저 닿아 있던 손바닥 + 나중 손가락은 안 된다 */
export const PAIR_WINDOW_MS = 250;
/** 펜을 뗀 뒤 이 시간 안에 닿은 touch는 무시(쓰는 손 손바닥이 들리거나 닿는 순간) */
export const PEN_COOLDOWN_MS = 300;
/** 두 점 거리·중점이 이만큼 움직이기 전에는 보기를 바꾸지 않는다(가만히 댄 손가락의 떨림) */
export const SLOP_PX = 6;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 화면 점(쓰기 면 기준) → 종이 점 */
export function toPaper(v: View, x: number, y: number): Pt {
  return { x: (x - v.tx) / v.s, y: (y - v.ty) / v.s };
}

/** 배율 [ZOOM_MIN, ZOOM_MAX] · 종이가 화면을 늘 덮도록 이동 제한(1배면 이동 0) */
export function clampView(v: View, W: number, H: number): View {
  const s = clamp(v.s, ZOOM_MIN, ZOOM_MAX);
  return { s, tx: clamp(v.tx, W - W * s, 0), ty: clamp(v.ty, H - H * s, 0) };
}

/**
 * 핀치 한 프레임. 시작 보기 `v0`·시작 두 점(a0·b0) → 지금 두 점(a1·b1).
 * 배율은 두 점 거리 비, 이동은 "처음 중점 아래 종이 점이 지금 중점을 따라간다" — 확대와 두 손가락 이동이 한 식이다.
 */
export function pinchView(v0: View, a0: Pt, b0: Pt, a1: Pt, b1: Pt, W: number, H: number): View {
  const d0 = dist(a0, b0), d1 = dist(a1, b1);
  const s = clamp(d0 > 0 ? v0.s * (d1 / d0) : v0.s, ZOOM_MIN, ZOOM_MAX);
  const m0 = mid(a0, b0), m1 = mid(a1, b1);
  const p = toPaper(v0, m0.x, m0.y);
  return clampView({ s, tx: m1.x - p.x * s, ty: m1.y - p.y * s }, W, H);
}

/** 두 점 거리 변화나 중점 이동이 문턱을 넘었나 */
export function beyondSlop(a0: Pt, b0: Pt, a1: Pt, b1: Pt, slop: number = SLOP_PX): boolean {
  return Math.abs(dist(a1, b1) - dist(a0, b0)) > slop || dist(mid(a0, b0), mid(a1, b1)) > slop;
}

/**
 * 두 touch로 제스처를 시작해도 되나 — 손바닥 규칙 ⓐ 펜 진행 중이 아님 ⓑ 착지 시각 차 ≤ PAIR_WINDOW_MS
 * ⓒ 둘 중 먼저 닿은 손가락이 펜을 뗀 뒤 PEN_COOLDOWN_MS 이상 지나서 닿았다.
 */
export function canStartPinch(o: { downA: number; downB: number; penActive: boolean; lastPenUpAt: number | null }): boolean {
  if (o.penActive) return false;
  if (Math.abs(o.downA - o.downB) > PAIR_WINDOW_MS) return false;
  if (o.lastPenUpAt != null && Math.min(o.downA, o.downB) - o.lastPenUpAt < PEN_COOLDOWN_MS) return false;
  return true;
}

export function isZoomed(v: View): boolean {
  return v.s > 1.001;
}

export function zoomPercent(v: View): number {
  return Math.round(v.s * 100);
}
