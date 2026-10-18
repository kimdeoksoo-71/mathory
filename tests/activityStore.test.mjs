/**
 * M10 B — `lib/activityStore.ts` 회귀. busy 카운터 · end 멱등 · 완료 점은 숨김일 때만 · acknowledge · 구독 알림.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const A = await import('../.test-build/lib/activityStore.js');

test('busy는 카운터 — 겹쳐도 마지막 end에서 0', () => {
  const e1 = A.beginActivity();
  const e2 = A.beginActivity();
  assert.equal(A.getSnapshot().busy, 2);
  e1();
  assert.equal(A.getSnapshot().busy, 1);
  e2();
  assert.equal(A.getSnapshot().busy, 0);
});

test('end는 두 번 불러도 한 번만 −1 · 0 밑으로 내려가지 않는다', () => {
  const e1 = A.beginActivity();
  const e2 = A.beginActivity();
  e1(); e1();
  assert.equal(A.getSnapshot().busy, 1);
  e2();
  assert.equal(A.getSnapshot().busy, 0);
});

test('완료 점: 보고 있던 탭이면 켜지 않는다 · 숨김이면 켠다 · acknowledge로 끈다', () => {
  A.markDone(false);
  assert.equal(A.getSnapshot().unseenDone, false);
  A.markDone(true);
  assert.equal(A.getSnapshot().unseenDone, true);
  A.acknowledge();
  assert.equal(A.getSnapshot().unseenDone, false);
});

test('구독: 상태가 바뀔 때만 알리고 같은 스냅샷 객체를 유지한다 · 해지', () => {
  let n = 0;
  const off = A.subscribe(() => { n++; });
  const s0 = A.getSnapshot();
  A.acknowledge();                       // 이미 꺼짐 → 무알림
  assert.equal(n, 0);
  assert.equal(A.getSnapshot(), s0);
  const end = A.beginActivity();
  end();
  assert.equal(n, 2);
  off();
  A.beginActivity()();
  assert.equal(n, 2);
});

test('isTabHidden: document가 없으면 false', () => {
  assert.equal(A.isTabHidden(), false);
});
