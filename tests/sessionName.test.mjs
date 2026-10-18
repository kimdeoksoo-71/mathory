/**
 * M10 E — `lib/sessionName.ts` 회귀. 자동 세션 이름(`새 토론` · `새 토론 2` …) · 예약 이름 배제.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../.test-build/lib/sessionName.js');

test('빈 목록 → 새 토론 · 하나 있으면 → 새 토론 2', () => {
  assert.equal(S.nextSessionName([]), '새 토론');
  assert.equal(S.nextSessionName(['새 토론']), '새 토론 2');
});

test('최댓값 + 1 — 지운 번호는 재사용하지 않는다', () => {
  assert.equal(S.nextSessionName(['새 토론', '새 토론 3']), '새 토론 4');
  assert.equal(S.nextSessionName(['새 토론 2']), '새 토론 3');
  assert.equal(S.nextSessionName(['검산', '일괄 검증', '새 토론 9']), '새 토론 10');
});

test('비슷하지만 다른 이름은 세지 않는다', () => {
  assert.equal(S.nextSessionName(['새 토론2', '새토론 5', '새 토론 x', '새 토론 3 메모']), '새 토론');
  assert.equal(S.nextSessionName(['  새 토론 4  ']), '새 토론 5');   // 앞뒤 공백은 저장 때 trim되므로 같은 이름
});

test('예약 이름(일괄 검증 · 댓글)을 절대 내지 않는다', () => {
  const pool = ['새 토론', '일괄 검증', '댓글', '새 토론 7', '메모', '새 토론 12', '검산'];
  for (let i = 0; i < 100; i++) {
    const list = pool.filter(() => Math.random() < 0.5);
    const name = S.nextSessionName(list);
    assert.notEqual(name, S.BATCH_SESSION_NAME);
    assert.notEqual(name, '댓글');
    assert.ok(name.startsWith(S.AUTO_SESSION_BASE));
  }
});
