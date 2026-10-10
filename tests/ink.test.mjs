/* Phase 69 — lib/ink/{strokes,view,payload,presence}.ts (전부 import 0). npm run test:ink */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  strokeBounds, exportPlan, toMathpixStrokes, guideYs, exampleLayout, GUIDE, STROKE_WIDTH,
} from '../.test-build/lib/ink/strokes.js';
import {
  IDENTITY, ZOOM_MAX, PAIR_WINDOW_MS, PEN_COOLDOWN_MS, SLOP_PX,
  toPaper, clampView, pinchView, beyondSlop, canStartPinch, isZoomed, zoomPercent,
} from '../.test-build/lib/ink/view.js';
import { composeInkText, shapeInkPayload, singleMathInner } from '../.test-build/lib/ink/payload.js';
import {
  presenceStatus, presenceMessage, presenceLabel, PRESENCE_STALE_MS,
} from '../.test-build/lib/ink/presence.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const S = (xs, ys) => ({ x: xs, y: ys, t: xs.map((_, i) => i) });

/* ── strokes ── */
test('strokeBounds — 최소 사각형 · 점 없으면 null', () => {
  assert.deepEqual(strokeBounds([S([10, 30], [5, 8]), S([2], [40])]), { x0: 2, y0: 5, x1: 30, y1: 40 });
  assert.equal(strokeBounds([]), null);
  assert.equal(strokeBounds([S([], [])]), null);
});
test('exportPlan — bounds + 24 + 획 굵기 · 축척 min(2, 2000/긴 변)', () => {
  const p = exportPlan({ x0: 100, y0: 50, x1: 300, y1: 150 });
  const bw = 200 + 48 + STROKE_WIDTH, bh = 100 + 48 + STROKE_WIDTH;
  assert.equal(p.scale, 2);
  assert.equal(p.w, Math.round(bw * 2));
  assert.equal(p.h, Math.round(bh * 2));
  near(p.ox, 100 - 24 - STROKE_WIDTH / 2);
  near(p.oy, 50 - 24 - STROKE_WIDTH / 2);
});
test('exportPlan — 긴 변이 크면 2000에 맞춰 축소 · maxDim 1400 재계획', () => {
  const b = { x0: 0, y0: 0, x1: 1800, y1: 300 };
  const p = exportPlan(b);
  assert.ok(p.scale < 2);
  assert.ok(Math.max(p.w, p.h) <= 2000);
  const q = exportPlan(b, { maxDim: 1400 });
  assert.ok(Math.max(q.w, q.h) <= 1400);
});
test('toMathpixStrokes — 순서·길이 보존 · 소수 1자리', () => {
  const r = toMathpixStrokes([S([1.234, 5.678], [9.99, 0.04]), S([3], [4])]);
  assert.deepEqual(r, { x: [[1.2, 5.7], [3]], y: [[10, 0], [4]] });
});
test('guideYs — 34%·68%', () => {
  const ys = guideYs(100, 2);
  near(ys[0], 234); near(ys[1], 268);
  assert.equal(GUIDE.rows, 5);
});
test('exampleLayout — 기준선·첨자·분수선 위치와 진행 순서', () => {
  const measure = (t, size) => size * 0.5;                       // 가짜 폭: 글자 크기의 절반
  const yU = 53.4, yB = 106.9, yM = (yU + yB) / 2;
  const { ops, width } = exampleLayout(yU, yB, measure);
  const texts = ops.filter((o) => o.kind === 'text');
  assert.deepEqual(texts.map((o) => o.text), ['∫', 'b', 'a', '4', '3', 'x', '2', 'd', 'x']);
  const by = (t, i = 0) => texts.filter((o) => o.text === t)[i];
  near(by('x').y, yB); near(by('d').y, yB); near(by('x', 1).y, yB);   // 본문 글자 = 기준선
  // 위 한계 b: 기준선은 윗선 바로 아래(샘플 배치), 글자 몸통(어센더 ≈ 0.69em)은 윗선 위로 올라간다
  assert.ok(by('b').y < yM, '위 한계 b의 기준선은 띠 가운데보다 위');
  assert.ok(by('b').y - 0.69 * by('b').size < yU, '위 한계 b의 몸통은 윗선 위');
  assert.ok(by('2').y < yB && by('2').y < by('x').y, '위첨자 2는 본문보다 높다');
  assert.ok(by('a').y > yB, '아래 한계 a는 기준선 아래');
  const line = ops.find((o) => o.kind === 'line');
  near(line.y, yM);
  // x 좌표 단조 증가(∫ < b < 4 < x < 2 < d < x)
  const order = [by('∫'), by('b'), by('4'), by('x'), by('2'), by('d'), by('x', 1)].map((o) => o.x);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `x 단조 ${i}`);
  assert.ok(width > by('x', 1).x);
  assert.equal(by('∫').family, 'size2'); assert.equal(by('b').family, 'math'); assert.equal(by('4').family, 'main');
});

test('exampleLayout — 프로덕션 압축(SWC)본도 같은 배치 (2026-10-10 iPad: 압축이 += 연쇄를 합쳐 분수 뒤 글자가 겹쳤다)', async (t) => {
  let minify;
  try { ({ minify } = createRequire(import.meta.url)('next/dist/build/swc')); } catch { t.skip('next swc 없음'); return; }
  const code = readFileSync(new URL('../.test-build/lib/ink/strokes.js', import.meta.url), 'utf8');
  const { code: min } = await minify(code, { compress: true, mangle: true });
  const mod = { exports: {} };
  new Function('exports', 'module', min)(mod.exports, mod);
  const measure = (s, size) => size * (s === '∫' ? 0.556 : 0.5);
  const a = exampleLayout(53.4, 106.9, measure);
  const b = mod.exports.exampleLayout(53.4, 106.9, measure);
  assert.equal(b.ops.length, a.ops.length);
  near(b.width, a.width, 1e-9);
  a.ops.forEach((o, i) => {
    const q = b.ops[i];
    if (o.kind === 'text') { assert.equal(q.text, o.text); near(q.x, o.x, 1e-9); near(q.y, o.y, 1e-9); }
    else { near(q.x0, o.x0, 1e-9); near(q.x1, o.x1, 1e-9); }
  });
  // 압축본에서도 x 좌표 단조 증가(겹침 없음)
  const xs = ['x', '2', 'd'].map((c) => b.ops.find((o) => o.kind === 'text' && o.text === c).x);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2], `압축본 겹침: ${xs}`);
});

/* ── view (핀치 줌) ── */
test('toPaper — 항등 · 역변환', () => {
  assert.deepEqual(toPaper(IDENTITY, 10, 20), { x: 10, y: 20 });
  const v = { s: 2, tx: -100, ty: -50 };
  const p = toPaper(v, 300, 150);
  near(p.x * v.s + v.tx, 300); near(p.y * v.s + v.ty, 150);
});
test('clampView — 배율 상하한 · 1배면 이동 0 · 2배면 tx ∈ [−W, 0]', () => {
  const W = 1000, H = 800;
  assert.deepEqual(clampView({ s: 0.5, tx: 30, ty: -30 }, W, H), { s: 1, tx: 0, ty: 0 });
  assert.equal(clampView({ s: 9, tx: 0, ty: 0 }, W, H).s, ZOOM_MAX);
  const v = clampView({ s: 2, tx: -5000, ty: 100 }, W, H);
  assert.equal(v.tx, -W); assert.equal(v.ty, 0);
});
test('pinchView — 두 점이 2배로 벌어지면 2배 · 중점 아래 종이 점이 따라간다', () => {
  const W = 1000, H = 800;
  const a0 = { x: 450, y: 400 }, b0 = { x: 550, y: 400 };
  const a1 = { x: 400, y: 400 }, b1 = { x: 600, y: 400 };
  const v = pinchView(IDENTITY, a0, b0, a1, b1, W, H);
  near(v.s, 2);
  const p = toPaper(v, 500, 400);                                   // 중점(500,400) 아래 종이 점
  near(p.x, 500); near(p.y, 400);
});
test('pinchView — 상한 3배에서 멈춤 · 1배 아래로 안 줄어듦', () => {
  const W = 1000, H = 800;
  const v = pinchView(IDENTITY, { x: 490, y: 400 }, { x: 510, y: 400 }, { x: 100, y: 400 }, { x: 900, y: 400 }, W, H);
  assert.equal(v.s, ZOOM_MAX);
  const w = pinchView(IDENTITY, { x: 100, y: 400 }, { x: 900, y: 400 }, { x: 490, y: 400 }, { x: 510, y: 400 }, W, H);
  assert.equal(w.s, 1);
});
test('pinchView — 확대 중 두 점 평행 이동 = 배율 그대로 이동만', () => {
  const W = 1000, H = 800;
  const v0 = { s: 2, tx: -500, ty: -400 };
  const v = pinchView(v0, { x: 400, y: 400 }, { x: 600, y: 400 }, { x: 450, y: 420 }, { x: 650, y: 420 }, W, H);
  near(v.s, 2); near(v.tx, -450); near(v.ty, -380);
});
test('canStartPinch — 착지 차 · 펜 진행 · 펜 뗀 뒤 냉각', () => {
  const base = { penActive: false, lastPenUpAt: null };
  assert.equal(canStartPinch({ ...base, downA: 1000, downB: 1000 + PAIR_WINDOW_MS - 1 }), true);
  assert.equal(canStartPinch({ ...base, downA: 1000, downB: 1000 + PAIR_WINDOW_MS + 1 }), false);
  assert.equal(canStartPinch({ ...base, penActive: true, downA: 1000, downB: 1010 }), false);
  assert.equal(canStartPinch({ penActive: false, lastPenUpAt: 1000, downA: 1000 + PEN_COOLDOWN_MS - 1, downB: 1300 }), false);
  assert.equal(canStartPinch({ penActive: false, lastPenUpAt: 1000, downA: 1000 + PEN_COOLDOWN_MS + 1, downB: 1310 }), true);
});
test('beyondSlop — 문턱 6px', () => {
  const a0 = { x: 0, y: 0 }, b0 = { x: 100, y: 0 };
  assert.equal(beyondSlop(a0, b0, { x: 0, y: 0 }, { x: 100 + SLOP_PX - 1, y: 0 }), false);
  assert.equal(beyondSlop(a0, b0, { x: 0, y: 0 }, { x: 100 + SLOP_PX + 1, y: 0 }), true);
  assert.equal(beyondSlop(a0, b0, { x: 7, y: 7 }, { x: 107, y: 7 }), true);   // 중점 이동 ≈ 9.9
});
test('isZoomed · zoomPercent', () => {
  assert.equal(isZoomed(IDENTITY), false);
  assert.equal(isZoomed({ s: 1.5, tx: 0, ty: 0 }), true);
  assert.equal(zoomPercent({ s: 2.004, tx: 0, ty: 0 }), 200);
});

/* ── payload ── */
test('composeInkText — latex_styled 우선 · 행바꿈·환경이면 블록', () => {
  assert.equal(composeInkText({ ocrLatex: 'x^{2}', ocrText: '$x^2$' }), '$x^{2}$');
  assert.equal(composeInkText({ ocrLatex: 'a \\\\ b' }), '$$\na \\\\ b\n$$');
  assert.equal(composeInkText({ ocrLatex: '\\begin{aligned} a&=b \\end{aligned}' }), '$$\n\\begin{aligned} a&=b \\end{aligned}\n$$');
  assert.equal(composeInkText({ ocrLatex: '  ', ocrText: ' $a$ 그리고 $b$ ' }), '$a$ 그리고 $b$');
  assert.equal(composeInkText({}), '');
});
test('singleMathInner', () => {
  assert.equal(singleMathInner('$x^2$'), 'x^2');
  assert.equal(singleMathInner('$$\nx\n$$'), 'x');
  assert.equal(singleMathInner('$a$ 그리고 $b$'), null);
  assert.equal(singleMathInner('$$x$$'), null);
});
test('shapeInkPayload — 인라인 공백 보정', () => {
  const o = (prev, next) => ({ prev, next, inMath: false });
  assert.equal(shapeInkPayload('$x^2$', { inMath: false }), '$x^2$');
  assert.equal(shapeInkPayload('$x^2$', o('a')), ' $x^2$');
  assert.equal(shapeInkPayload('$x^2$', o('함')), ' $x^2$');
  assert.equal(shapeInkPayload('$x^2$', o('$')), ' $x^2$');
  assert.equal(shapeInkPayload('$x^2$', o(' ')), '$x^2$');
  assert.equal(shapeInkPayload('$x^2$', o('(')), '$x^2$');
  assert.equal(shapeInkPayload('$x^2$', o('\n')), '$x^2$');
  assert.equal(shapeInkPayload('$x^2$', o(undefined, '$')), '$x^2$ ');
  assert.equal(shapeInkPayload('$x^2$', o(undefined, '는')), '$x^2$');
});
test('shapeInkPayload — 블록·문장은 \\n…\\n · 빈 문자열', () => {
  assert.equal(shapeInkPayload('$$\nx\n$$', { inMath: false }), '\n$$\nx\n$$\n');
  assert.equal(shapeInkPayload('$a$ 그리고 $b$', { inMath: false }), '\n$a$ 그리고 $b$\n');
  assert.equal(shapeInkPayload('   ', { inMath: false }), '');
});
test('shapeInkPayload — 수식 안이면 구분자를 벗긴다(수식 하나일 때만)', () => {
  assert.equal(shapeInkPayload('$x^2$', { inMath: true, prev: 'a' }), 'x^2');
  assert.equal(shapeInkPayload('$$\nx\n$$', { inMath: true }), 'x');
  assert.equal(shapeInkPayload('$a$ 그리고 $b$', { inMath: true }), '$a$ 그리고 $b$');
});

/* ── presence ── */
test('presenceStatus', () => {
  const now = 1_000_000;
  assert.deepEqual(presenceStatus(null, now), { kind: 'none' });
  assert.deepEqual(presenceStatus({ canInsert: true, updatedAtMs: null }, now), { kind: 'stale' });
  assert.deepEqual(presenceStatus({ canInsert: true, updatedAtMs: now - PRESENCE_STALE_MS - 1000 }, now), { kind: 'stale' });
  assert.deepEqual(presenceStatus({ canInsert: true, label: 'L', updatedAtMs: now - PRESENCE_STALE_MS + 1000 }, now), { kind: 'ok', label: 'L' });
  assert.deepEqual(presenceStatus({ canInsert: false, reason: 'collapsed', updatedAtMs: now }, now), { kind: 'blocked', reason: 'collapsed' });
  assert.deepEqual(presenceStatus({ canInsert: false, updatedAtMs: now }, now), { kind: 'blocked', reason: 'no-block' });
  assert.deepEqual(presenceStatus({ canInsert: true, label: 'L', updatedAtMs: now + 5000 }, now), { kind: 'ok', label: 'L' });  // 시계 차
});
test('presenceMessage · presenceLabel', () => {
  assert.equal(presenceMessage({ kind: 'ok', label: 'A · 풀이 · 블록 3' }).tone, 'ok');
  assert.match(presenceMessage({ kind: 'blocked', reason: 'collapsed' }).text, /접힌 블록/);
  assert.match(presenceMessage({ kind: 'blocked', reason: 'not-text' }).text, /텍스트 블록/);
  assert.equal(presenceMessage({ kind: 'stale' }).tone, 'off');
  assert.equal(presenceLabel('  ', '풀이', 2), '제목 없음 · 풀이 · 블록 3');
});
