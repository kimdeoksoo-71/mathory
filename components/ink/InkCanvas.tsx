'use client';

/**
 * Phase 69 D4·D5·D5′ — iPad 필기 패드의 쓰기 면.
 *
 * 캔버스 두 장: 격자(보조선·구분선·예시 수식 — 포인터 무반응, 내보내기에 안 들어간다) + 획.
 * 입력: Pencil(`pointerType 'pen'`)만 획 — `allowMouse`(개발용 `?input=mouse`)면 마우스도. touch는 획이 되지 않고,
 *       **두 손가락**만 확대·이동이 된다(손바닥 규칙은 lib/ink/view — 실물 조율 상수 4개가 그 파일 한 곳).
 * 좌표: 전부 **종이 좌표**(쓰기 면 CSS px, 1배 기준). 보기 변환은 그릴 때 `setTransform` 하나 — 데이터에 흔적이 없다.
 *
 * ⚠ 캔버스는 화면 크기 그대로(쓰기 면 × DPR) — 확대를 큰 버퍼로 만들면 iOS 캔버스 면적 상한을 넘는다.
 * ⚠ 상태는 ref에 둔다 — 포인터 이벤트마다 React 렌더를 돌리지 않는다. 부모에는 바뀐 요약만 `onState`로.
 * ⚠ 캔버스는 `var()`를 못 받는다 — 색은 마운트 때 `getComputedStyle`로 토큰을 읽는다(앱 토큰이 진실 — 샘플 값 아님).
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  GUIDE, STROKE_WIDTH, exampleLayout, exportPlan, strokeBounds, toMathpixStrokes,
  type ExampleFamily, type Stroke,
} from '../../lib/ink/strokes';
import {
  IDENTITY, beyondSlop, canStartPinch, pinchView, toPaper, zoomPercent, type Pt, type View,
} from '../../lib/ink/view';

export interface InkCanvasState {
  strokeCount: number;
  canUndo: boolean;
  /** 배율 % (100 = 1배) */
  zoom: number;
  drawing: boolean;
}

export interface InkExport {
  dataUrl: string;
  blob: Blob;
  w: number;
  h: number;
}

export interface InkCanvasHandle {
  undo(): void;
  clear(): void;
  resetView(): void;
  /** 전송 성공 뒤 — 획·되돌리기 스택·보기를 모두 처음으로 */
  resetAll(): void;
  exportPng(maxDim?: number): Promise<InkExport | null>;
  strokesJson(): string;
  /** 현재 보기 변환(하니스·진단용) */
  getView(): View;
}

type UndoEntry = 'stroke' | { type: 'clear'; strokes: Stroke[] };

interface TouchPt { x: number; y: number; down: number }
interface Gesture { ida: number; idb: number; a0: Pt; b0: Pt; v0: View; live: boolean }

const FONT: Record<ExampleFamily, (s: number) => string> = {
  math: (s) => `italic ${s}px KaTeX_Math, "Times New Roman", serif`,
  main: (s) => `${s}px KaTeX_Main, serif`,
  size2: (s) => `${s}px KaTeX_Size2, serif`,
};

function tokenColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** `#RRGGBB`(또는 `#RGB`) + 알파 → rgba(). 토큰이 hex가 아니면 그대로(알파 없이) */
function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function strokePath(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.x.length === 0) return;
  ctx.beginPath();
  if (s.x.length === 1) {
    ctx.arc(s.x[0], s.y[0], STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(s.x[0], s.y[0]);
  for (let i = 1; i < s.x.length; i++) ctx.lineTo(s.x[i], s.y[i]);
  ctx.stroke();
}

const InkCanvas = forwardRef<InkCanvasHandle, {
  allowMouse: boolean;
  onState: (s: InkCanvasState) => void;
}>(function InkCanvas({ allowMouse, onState }, ref) {
  const paperRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<HTMLCanvasElement>(null);
  const iRef = useRef<HTMLCanvasElement>(null);

  // ── 모든 가변 상태는 ref(포인터 이벤트마다 렌더하지 않는다) ──
  const st = useRef({
    strokes: [] as Stroke[],
    undo: [] as UndoEntry[],
    cur: null as Stroke | null,
    penId: null as number | null,
    rect: null as DOMRect | null,
    view: IDENTITY as View,
    W: 1, H: 1, dpr: 1,
    touches: new Map<number, TouchPt>(),
    gesture: null as Gesture | null,
    lastPenUpAt: null as number | null,
    raf: 0,
    dirtyGuides: false,
    dirtyInk: false,
    colors: { ink: '#2D2A23', guide: '#BC5F3F', text: '#2D2A23' },
    lastEmit: '',
  });
  const allowMouseRef = useRef(allowMouse);
  allowMouseRef.current = allowMouse;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  const emit = useCallback(() => {
    const s = st.current;
    const next: InkCanvasState = {
      strokeCount: s.strokes.length,
      canUndo: s.undo.length > 0,
      zoom: zoomPercent(s.view),
      drawing: !!s.cur,
    };
    const key = `${next.strokeCount}|${next.canUndo}|${next.zoom}|${next.drawing}`;
    if (key === s.lastEmit) return;
    s.lastEmit = key;
    onStateRef.current(next);
  }, []);

  /* ── 그리기 ── */
  const setView = (ctx: CanvasRenderingContext2D) => {
    const { dpr, view: v } = st.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
  };

  const drawGuides = useCallback(() => {
    const c = gRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const s = st.current, { W, H } = s, k = s.view.s;
    setView(ctx);
    const rowH = H / GUIDE.rows;
    // 1배에서는 픽셀 격자에 맞춰 선을 또렷하게(샘플과 같다). 확대 중에는 선 굵기·점 간격을 화면 기준으로 고정
    const snap = (y: number) => (k === 1 ? Math.round(y) + 0.5 : y);
    ctx.lineWidth = 1 / k;
    ctx.lineCap = 'round';
    // 줄 사이 구분선(연한 실선)
    ctx.strokeStyle = `rgba(0,0,0,${GUIDE.sepAlpha})`;
    ctx.setLineDash([]);
    for (let i = 1; i < GUIDE.rows; i++) {
      const y = snap(i * rowH);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // 보조선 2개(점선)
    ctx.strokeStyle = withAlpha(s.colors.guide, GUIDE.alpha);
    ctx.setLineDash([GUIDE.dash[0] / k, GUIDE.dash[1] / k]);
    for (let r = 0; r < GUIDE.rows; r++) {
      for (const p of GUIDE.lines) {
        const y = snap(r * rowH + rowH * p);
        ctx.beginPath(); ctx.moveTo(GUIDE.inset, y); ctx.lineTo(W - GUIDE.inset, y); ctx.stroke();
      }
    }
    // 마지막 줄 오른쪽 끝 예시 수식
    const top = (GUIDE.rows - 1) * rowH;
    const yU = top + rowH * GUIDE.lines[0], yB = top + rowH * GUIDE.lines[1];
    const measure = (t: string, size: number, fam: ExampleFamily) => { ctx.font = FONT[fam](size); return ctx.measureText(t).width; };
    const { ops, width } = exampleLayout(yU, yB, measure);
    const ox = Math.max(GUIDE.inset, W - 32 - width);
    const col = withAlpha(s.colors.text, 0.2);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.textBaseline = 'alphabetic'; ctx.setLineDash([]);
    for (const op of ops) {
      if (op.kind === 'text') { ctx.font = FONT[op.family](op.size); ctx.fillText(op.text, ox + op.x, op.y); }
      else { ctx.lineWidth = op.width; ctx.beginPath(); ctx.moveTo(ox + op.x0, op.y); ctx.lineTo(ox + op.x1, op.y); ctx.stroke(); }
    }
  }, []);

  const drawInk = useCallback(() => {
    const c = iRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const s = st.current;
    setView(ctx);
    ctx.strokeStyle = s.colors.ink; ctx.fillStyle = s.colors.ink;
    ctx.lineWidth = STROKE_WIDTH; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const k of s.strokes) strokePath(ctx, k);
    if (s.cur) strokePath(ctx, s.cur);
  }, []);

  /** rAF당 1회로 묶는다(핀치 프레임·coalesced 펜 점) */
  const schedule = useCallback((guides: boolean, ink: boolean) => {
    const s = st.current;
    s.dirtyGuides ||= guides;
    s.dirtyInk ||= ink;
    if (s.raf) return;
    s.raf = requestAnimationFrame(() => {
      s.raf = 0;
      if (s.dirtyGuides) { s.dirtyGuides = false; drawGuides(); }
      if (s.dirtyInk) { s.dirtyInk = false; drawInk(); }
    });
  }, [drawGuides, drawInk]);

  /* ── 크기: 쓰기 면 실측(회전·Split View 포함) → 캔버스 버퍼 · 보기는 1배로(D4 ⑤) ── */
  useEffect(() => {
    const paper = paperRef.current; if (!paper) return;
    const s = st.current;
    s.colors = {
      ink: tokenColor('--text-primary', '#2D2A23'),
      guide: tokenColor('--mathory-red-dark', '#BC5F3F'),
      text: tokenColor('--text-primary', '#2D2A23'),
    };
    const layout = () => {
      const r = paper.getBoundingClientRect();
      const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (W === s.W && H === s.H && dpr === s.dpr) return;
      s.W = W; s.H = H; s.dpr = dpr;
      s.view = IDENTITY;
      s.gesture = null;
      for (const c of [gRef.current, iRef.current]) {
        if (!c) continue;
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      }
      drawGuides(); drawInk(); emit();
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(paper);
    // 예시 수식 글꼴(KaTeX — 루트 레이아웃 CSS가 @font-face를 선언한다)이 늦게 오면 다시 그린다(캔버스 텍스트는 로드를 트리거하지 않는다)
    if (document.fonts?.load) {
      Promise.all([
        document.fonts.load('italic 40px KaTeX_Math'),
        document.fonts.load('40px KaTeX_Main'),
        document.fonts.load('40px KaTeX_Size2', '∫'),
      ]).then(() => drawGuides(), () => {});
    }
    return () => { ro.disconnect(); if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; };
  }, [drawGuides, drawInk, emit]);

  /* ── 포인터 ── */
  useEffect(() => {
    const c = iRef.current; if (!c) return;
    const s = st.current;

    const local = (e: { clientX: number; clientY: number }, rect: DOMRect): Pt => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const isPenLike = (e: PointerEvent) => e.pointerType === 'pen' || (allowMouseRef.current && e.pointerType === 'mouse');

    const endGesture = () => { s.gesture = null; };

    const onDown = (e: PointerEvent) => {
      if (isPenLike(e)) {
        if (s.cur || !(e.buttons & 1)) return;               // Pencil 호버(buttons 0)는 획이 아니다
        e.preventDefault();
        endGesture();                                         // 펜 우선 — 진행 중 제스처는 끝낸다
        try { c.setPointerCapture(e.pointerId); } catch { /* 이미 해제됨 */ }
        s.penId = e.pointerId;
        s.rect = c.getBoundingClientRect();
        const p = toPaper(s.view, ...xy(local(e, s.rect)));
        s.cur = { x: [p.x], y: [p.y], t: [e.timeStamp] };
        schedule(false, true); emit();
        return;
      }
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch { /* */ }
      const rect = c.getBoundingClientRect();
      const me: TouchPt = { ...local(e, rect), down: e.timeStamp };
      // 짝: 이미 닿아 있던 손가락 중 가장 최근 것. 셋째 손가락부터는 무시(제스처가 이미 있으면 새 짝을 찾지 않는다)
      if (!s.gesture && s.touches.size >= 1) {
        let partner: [number, TouchPt] | null = null;
        for (const entry of s.touches) if (!partner || entry[1].down > partner[1].down) partner = entry;
        if (partner && canStartPinch({ downA: partner[1].down, downB: me.down, penActive: !!s.cur, lastPenUpAt: s.lastPenUpAt })) {
          s.gesture = { ida: partner[0], idb: e.pointerId, a0: { x: partner[1].x, y: partner[1].y }, b0: { x: me.x, y: me.y }, v0: s.view, live: false };
        }
      }
      s.touches.set(e.pointerId, me);
    };

    const onMove = (e: PointerEvent) => {
      if (s.cur && e.pointerId === s.penId) {
        if (!(e.buttons & 1) || !s.rect) return;
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        for (const ce of evs.length ? evs : [e]) {               // coalesced는 x·y만 쓴다(pointerId·target 의존 금지)
          const p = toPaper(s.view, ...xy(local(ce, s.rect)));
          s.cur.x.push(p.x); s.cur.y.push(p.y); s.cur.t.push(ce.timeStamp);
        }
        schedule(false, true);
        return;
      }
      const t = s.touches.get(e.pointerId);
      if (!t) return;
      const rect = c.getBoundingClientRect();
      const p = local(e, rect);
      t.x = p.x; t.y = p.y;
      const g = s.gesture;
      if (!g || (e.pointerId !== g.ida && e.pointerId !== g.idb)) return;
      const a = s.touches.get(g.ida), b = s.touches.get(g.idb);
      if (!a || !b) return;
      const a1 = { x: a.x, y: a.y }, b1 = { x: b.x, y: b.y };
      if (!g.live) {
        if (!beyondSlop(g.a0, g.b0, a1, b1)) return;
        g.live = true;
      }
      s.view = pinchView(g.v0, g.a0, g.b0, a1, b1, s.W, s.H);
      schedule(true, true); emit();
    };

    const onUp = (e: PointerEvent) => {
      if (s.cur && e.pointerId === s.penId) {
        s.strokes.push(s.cur); s.undo.push('stroke');
        s.cur = null; s.penId = null; s.rect = null;
        s.lastPenUpAt = e.timeStamp;
        schedule(false, true); emit();
        return;
      }
      if (s.touches.delete(e.pointerId)) {
        const g = s.gesture;
        if (g && (e.pointerId === g.ida || e.pointerId === g.idb)) endGesture();
      }
    };

    // iOS Safari 안전망: 캔버스의 기본 터치 동작(스크롤·확대) 차단 — 포인터 이벤트는 그대로 온다
    const onTouchMove = (e: TouchEvent) => e.preventDefault();

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('lostpointercapture', onUp);
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
      c.removeEventListener('lostpointercapture', onUp);
      c.removeEventListener('touchmove', onTouchMove);
    };
  }, [schedule, emit]);

  /* ── 핸들 ── */
  useImperativeHandle(ref, () => ({
    undo() {
      const s = st.current;
      const u = s.undo.pop();
      if (!u) return;
      if (u === 'stroke') s.strokes.pop();
      else s.strokes = u.strokes;
      schedule(false, true); emit();
    },
    clear() {
      const s = st.current;
      if (!s.strokes.length) return;
      s.undo.push({ type: 'clear', strokes: s.strokes });
      s.strokes = [];
      schedule(false, true); emit();
    },
    resetView() {
      const s = st.current;
      s.view = IDENTITY; s.gesture = null;
      schedule(true, true); emit();
    },
    resetAll() {
      const s = st.current;
      s.strokes = []; s.undo = []; s.cur = null; s.penId = null;
      s.view = IDENTITY; s.gesture = null;
      schedule(true, true); emit();
    },
    async exportPng(maxDim = 2000) {
      const s = st.current;
      const b = strokeBounds(s.strokes);
      if (!b) return null;
      const plan = exportPlan(b, { maxDim, strokeWidth: STROKE_WIDTH });
      const cv = document.createElement('canvas');
      cv.width = plan.w; cv.height = plan.h;
      const ctx = cv.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, plan.w, plan.h);
      ctx.setTransform(plan.scale, 0, 0, plan.scale, -plan.ox * plan.scale, -plan.oy * plan.scale);
      ctx.strokeStyle = s.colors.ink; ctx.fillStyle = s.colors.ink;
      ctx.lineWidth = STROKE_WIDTH; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const k of s.strokes) strokePath(ctx, k);
      const dataUrl = cv.toDataURL('image/png');
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
      if (!blob) return null;
      return { dataUrl, blob, w: plan.w, h: plan.h };
    },
    getView() {
      return st.current.view;
    },
    strokesJson() {
      const s = st.current;
      const t0 = s.strokes[0]?.t[0] ?? 0;
      return JSON.stringify({
        v: 1, cssW: s.W, cssH: s.H, dpr: s.dpr, strokeWidth: STROKE_WIDTH,
        strokes: toMathpixStrokes(s.strokes),
        t: s.strokes.map((k) => k.t.map((v) => Math.round(v - t0))),
      });
    },
  }), [schedule, emit]);

  return (
    <div ref={paperRef} style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--bg-functional)' }}>
      <canvas
        ref={gRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
      <canvas
        ref={iRef}
        data-ink-surface=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
      />
    </div>
  );
});

function xy(p: Pt): [number, number] {
  return [p.x, p.y];
}

export default InkCanvas;
