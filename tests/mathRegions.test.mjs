/**
 * M7 D2·D3 — `lib/mathRegions.ts` 회귀. R-$$(빈 인라인 쌍)·미닫힘·이스케이프·빈 줄 경계를 고정한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { scanMathRegions, mathRegionAt } = await import('../.test-build/lib/mathRegions.js');
const kinds = (t, o) => scanMathRegions(t, o).map((r) => `${r.kind}${r.empty ? ':empty' : ''}${r.closed ? '' : ':open'}(${t.slice(r.innerFrom, r.innerTo)})`);

test('R-$$ (c): 빈 `$$` + 뒤 display 블록 → 빈 쌍 하나 + 닫힌 display, 미닫힘 0', () => {
  const t = '본문 $$ 뒤\n\n$$\nx=1\n$$\n';
  assert.deepEqual(kinds(t), ['inline:empty()', 'display(\nx=1\n)']);
  assert.ok(scanMathRegions(t).every((r) => r.closed));
});

test('R-$$ (c): `$$$x$` → 빈 쌍 + inline(x)', () => {
  assert.deepEqual(kinds('$$$x$'), ['inline:empty()', 'inline(x)']);
});

test('R-$$ (b): 한 줄 `$$x=1$$` → display closed', () => {
  assert.deepEqual(kinds('a $$x=1$$ b'), ['display(x=1)']);
});

test('R-$$ (a): `$$` 단독 행 → display 펜스, 미닫힘이면 문서 끝까지 open', () => {
  assert.deepEqual(kinds('$$\nx\n$$'), ['display(\nx\n)']);
  assert.deepEqual(kinds('$$\nx\n'), ['display:open(\nx\n)']);
  const r = scanMathRegions('$$\nx\n')[0];
  assert.equal(r.to, 5); assert.equal(r.closed, false);
});

test('빈 쌍의 좌표: from=i, to=i+2, inner 길이 0', () => {
  const [r] = scanMathRegions('ab$$cd');
  assert.deepEqual([r.from, r.to, r.innerFrom, r.innerTo, r.empty], [2, 4, 3, 3, true]);
});

test('`\\$` 이스케이프는 구분자가 아니다', () => {
  assert.deepEqual(kinds('가격 \\$5 와 $x$'), ['inline(x)']);
  assert.deepEqual(kinds('$a\\$b$'), ['inline(a\\$b)']);
});

test('단일 $는 빈 줄에서 끊긴다(미닫힘 → 행 끝까지 open) · inlineSingleLine이면 행에서 끊긴다', () => {
  assert.deepEqual(kinds('$a\n\nb$'), ['inline:open(a)', 'inline:open()']);
  assert.deepEqual(kinds('$a\nb$'), ['inline(a\nb)']);
  assert.deepEqual(kinds('$a\nb$', { inlineSingleLine: true }), ['inline:open(a)', 'inline:open()']);
});

test('`\\[ \\]`·`\\( \\)`는 종전과 같다(미닫힘이면 문서 끝까지)', () => {
  assert.deepEqual(kinds('\\[x\\] \\(y\\)'), ['display(x)', 'inline(y)']);
  assert.deepEqual(kinds('\\[x'), ['display:open(x)']);
});

test('mathRegionAt: 구분자 사이(양 끝 포함)만 안이다 · 빈 쌍은 i+1이 안', () => {
  const t = 'a $xy$ b $$ c';
  const rs = scanMathRegions(t);
  assert.equal(mathRegionAt(rs, 2), null);          // 여는 $ 앞
  assert.ok(mathRegionAt(rs, 3));                   // 여는 $ 직후
  assert.ok(mathRegionAt(rs, 5));                   // 닫는 $ 직전
  assert.equal(mathRegionAt(rs, 6), null);          // 닫는 $ 뒤
  assert.equal(mathRegionAt(rs, 10)?.empty, true);  // 빈 쌍 가운데
  assert.equal(mathRegionAt(rs, 11), null);
});

test('인접 인라인 `$y$$x$`는 두 개로 읽는다(교정 마스킹 규약)', () => {
  assert.deepEqual(kinds('$y$$x$'), ['inline(y)', 'inline(x)']);
});

/* ── Phase 68b — probeInsertionRegion(68a K8, mathAscii에서 이관) · exitRegionAt(D5′) ── */
const { probeInsertionRegion, exitRegionAt } = await import('../.test-build/lib/mathRegions.js');
const exitAt = (src) => { const pos = src.indexOf('|'); return exitRegionAt(src.slice(0, pos) + src.slice(pos + 1), pos); };

test('probeInsertionRegion: 행 끝 `$|$`는 probe로 안 · 본문은 밖', () => {
  assert.equal(mathRegionAt(scanMathRegions('abc $$'), 5), null);                 // R-$$ (a) 오판
  assert.equal(probeInsertionRegion('abc $$', 5).region?.kind, 'inline');
  assert.equal(probeInsertionRegion('abc', 2).region, null);
});

test('exitRegionAt: 행 끝 `$|$` → empty(4-6) · 행 중간 `$|$x` → empty(probe 없이) · `$x|$` → region · 본문 → null', () => {
  assert.deepEqual(exitAt('abc $|$'), { kind: 'empty', from: 4, to: 6 });
  assert.deepEqual(exitAt('a $|$x'), { kind: 'empty', from: 2, to: 4 });
  assert.deepEqual(exitAt('a $|$ b'), { kind: 'empty', from: 2, to: 4 });
  const r = exitAt('$x|$');
  assert.equal(r.kind, 'region'); assert.equal(r.region.kind, 'inline'); assert.equal(r.region.to, 3);
  assert.equal(exitAt('ab|c'), null);
  assert.equal(exitAt('|'), null);
});

test('exitRegionAt: 펜스 안 → region · 행 끝 `$$|`(여는 직후) → 미닫힘 region · `a $|b`는 미닫힘 region(빈 쌍 아님 — I2 가드)', () => {
  const f = exitAt('x\n\n$$\na=|1\n$$\n');
  assert.equal(f.kind, 'region'); assert.equal(f.region.kind, 'display'); assert.equal(f.region.closed, true);
  const u = exitAt('abc $$|');
  assert.equal(u.kind, 'region'); assert.equal(u.region.closed, false);
  const o = exitAt('a $|b');
  assert.equal(o.kind, 'region'); assert.equal(o.region.closed, false);
});
