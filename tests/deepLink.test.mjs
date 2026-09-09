// Phase 64 S1 — lib/deepLink.ts 파싱 검증 (npm run test:deeplink)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeepLink } from '../.test-build/lib/deepLink.js';

test('세 갈래: bazaar / p&id / shared&id', () => {
  assert.deepEqual(parseDeepLink('?view=bazaar'), { view: 'bazaar' });
  assert.deepEqual(parseDeepLink('?view=p&id=abc123'), { view: 'p', id: 'abc123' });
  assert.deepEqual(parseDeepLink('?view=shared&id=sh-1'), { view: 'shared', id: 'sh-1' });
});

test("'?' 유무는 URLSearchParams가 흡수한다", () => {
  assert.deepEqual(parseDeepLink('view=bazaar'), { view: 'bazaar' });
});

test('id 누락·모르는 view·빈 문자열은 null', () => {
  assert.equal(parseDeepLink('?view=p'), null);
  assert.equal(parseDeepLink('?view=shared'), null);
  assert.equal(parseDeepLink('?view=editor&id=x'), null);
  assert.equal(parseDeepLink(''), null);
  assert.equal(parseDeepLink('?foo=1'), null);
});

test('bazaar는 잉여 id를 무시하고 성립한다 (현행 AppShell 동작 보존)', () => {
  assert.deepEqual(parseDeepLink('?view=bazaar&id=zzz'), { view: 'bazaar' });
});
