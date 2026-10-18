/**
 * M10 B(D8) — `lib/faviconGlyph.ts` 상수가 정본 `app/icon.svg`와 같은지(아이콘을 바꾸면 둘 다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const G = await import('../.test-build/lib/faviconGlyph.js');
const svg = readFileSync(new URL('../app/icon.svg', import.meta.url), 'utf8');

test("'M' path·글자색이 app/icon.svg와 같다", () => {
  const m = svg.match(/<path d="([^"]+)" fill="([^"]+)"/);
  assert.ok(m, 'icon.svg path');
  assert.equal(G.M_PATH, m[1]);
  assert.equal(G.GLYPH.toUpperCase(), m[2].toUpperCase());
});

test('바탕색·모서리·크기가 app/icon.svg와 같다 · 맥박 진폭', () => {
  const r = svg.match(/<rect width="(\d+)" height="(\d+)" rx="(\d+)" fill="([^"]+)"/);
  assert.ok(r, 'icon.svg rect');
  assert.equal(G.ICON_SIZE, Number(r[1]));
  assert.equal(G.ICON_SIZE, Number(r[2]));
  assert.equal(G.ICON_RADIUS, Number(r[3]));
  assert.equal(G.BG.toUpperCase(), r[4].toUpperCase());
  assert.ok(Math.abs(G.pulseScale(G.PULSE_PERIOD_MS / 4) - (1 + G.PULSE_AMP)) < 1e-9);
});
