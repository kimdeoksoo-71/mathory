/**
 * Phase 61d 스텝 0 — 일괄 검증 판정 로직 회귀.
 *
 * 이 파일이 지키는 것: **배치가 조용히 어긋나지 않는 것.**
 *   ① 기본 체크가 목록 배지와 같은 규칙일 것 (다르면 사용자가 무엇을 고른 건지 모른다)
 *   ② 사전에 막을 수 있는 것을 AI 호출 뒤에 알지 않을 것 (비용)
 *   ③ 장애에서 n건을 헛돌지 않을 것 (비용)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../.test-build/lib/verify/batchPlan.js');

/* ═══ ① 기본 체크 (E61d-5) ═══ */

test('defaultChecked — 미검증이면 체크', () => {
  assert.equal(B.defaultChecked(undefined), true);
});

test('defaultChecked — stale이면 verdict와 무관하게 체크', () => {
  for (const verdict of ['ok', 'check', 'fail', 'skip']) {
    assert.equal(B.defaultChecked({ verdict, stale: true }), true, verdict);
  }
});

test('defaultChecked — 판정이 있고 stale이 아니면 해제 (check·fail 포함)', () => {
  for (const verdict of ['ok', 'check', 'fail', 'skip']) {
    assert.equal(B.defaultChecked({ verdict }), false, verdict);
    assert.equal(B.defaultChecked({ verdict, stale: false }), false, `${verdict}/false`);
  }
});

/* ═══ ② 프리플라이트 (§3-4) ═══ */

/** 아무 사유도 없는 정상 입력 */
const ok = (over = {}) => ({
  kind: 'problem', missing: false, isOwner: true,
  tabLoadErrorCount: 0, questionBlockCount: 3, solutionBlockCount: 5, chars: 1200,
  ...over,
});

test('preflightSkip — 정상 입력은 null (문제·풀이 모두)', () => {
  assert.equal(B.preflightSkip(ok()), null);
  assert.equal(B.preflightSkip(ok({ kind: 'solution' })), null);
});

test('preflightSkip — 사유 6종이 각각 잡힌다', () => {
  assert.equal(B.preflightSkip(ok({ missing: true })), 'missing');
  assert.equal(B.preflightSkip(ok({ isOwner: false })), 'not_owner');
  assert.equal(B.preflightSkip(ok({ tabLoadErrorCount: 1 })), 'tab_load_error');
  assert.equal(B.preflightSkip(ok({ questionBlockCount: 0 })), 'empty_question');
  assert.equal(B.preflightSkip(ok({ kind: 'solution', solutionBlockCount: 0 })), 'no_solution');
  assert.equal(B.preflightSkip(ok({ chars: B.CHAR_CAP + 1 })), 'too_long');
});

test('preflightSkip — 판정 순서: 근본적인 것이 먼저', () => {
  // 문서가 없는데 글자 수를 논할 수 없다
  assert.equal(B.preflightSkip(ok({ missing: true, isOwner: false })), 'missing');
  assert.equal(B.preflightSkip(ok({ isOwner: false, tabLoadErrorCount: 2 })), 'not_owner');
  // 탭 로드 실패는 AI 호출 뒤 addComment 다음에 터지므로 어떤 경우에도 먼저 막는다
  assert.equal(
    B.preflightSkip(ok({ tabLoadErrorCount: 1, chars: B.CHAR_CAP + 999 })),
    'tab_load_error',
  );
});

test('preflightSkip — empty_question은 풀이 검증도 막는다 (W6)', () => {
  // 풀이 검증 요청에도 problemBlocks가 실려 가고, 서버는 그것이 비면 400을 낸다
  assert.equal(B.preflightSkip(ok({ kind: 'problem', questionBlockCount: 0 })), 'empty_question');
  assert.equal(
    B.preflightSkip(ok({ kind: 'solution', questionBlockCount: 0, solutionBlockCount: 4 })),
    'empty_question',
  );
});

test('preflightSkip — no_solution은 풀이 검증에서만 발동', () => {
  assert.equal(B.preflightSkip(ok({ kind: 'problem', solutionBlockCount: 0 })), null);
  assert.equal(B.preflightSkip(ok({ kind: 'solution', solutionBlockCount: 0 })), 'no_solution');
});

test('preflightSkip — too_long 경계는 서버와 같다 (초과일 때만 차단)', () => {
  assert.equal(B.CHAR_CAP, 15_000);
  assert.equal(B.preflightSkip(ok({ chars: B.CHAR_CAP - 1 })), null);
  assert.equal(B.preflightSkip(ok({ chars: B.CHAR_CAP })), null);       // 정확히 15,000은 통과
  assert.equal(B.preflightSkip(ok({ chars: B.CHAR_CAP + 1 })), 'too_long');
});

test('skipLabel — 모든 사유에 문구가 있다 (스위치 누락 방지)', () => {
  const reasons = ['missing', 'not_owner', 'tab_load_error', 'empty_question', 'no_solution', 'too_long'];
  for (const r of reasons) {
    const label = B.skipLabel(r);
    assert.equal(typeof label, 'string', r);
    assert.ok(label.trim().length > 0, r);
  }
});

/* ═══ ③ 실패 처리 (E61d-6) ═══ */

test('isFatalStatus — 401·403만 즉시 중단', () => {
  assert.equal(B.isFatalStatus(401), true);
  assert.equal(B.isFatalStatus(403), true);
  for (const s of [undefined, 400, 404, 429, 500, 502, 504]) {
    assert.equal(B.isFatalStatus(s), false, String(s));
  }
});

test('nextFailureCount — fail 누적 · ok 리셋 · skip 유지', () => {
  assert.equal(B.nextFailureCount(0, 'fail'), 1);
  assert.equal(B.nextFailureCount(2, 'fail'), 3);
  assert.equal(B.nextFailureCount(2, 'ok'), 0);
  // 사전 차단은 시도한 적이 없다 — "건너뜀 3연속"이 장애로 오인되면 안 된다
  assert.equal(B.nextFailureCount(2, 'skip'), 2);
  assert.equal(B.nextFailureCount(0, 'skip'), 0);
});

test('shouldAbort — 서로 다른 문항 연속 3건에서 멈춘다', () => {
  assert.equal(B.ABORT_STREAK, 3);
  assert.equal(B.shouldAbort(0), false);
  assert.equal(B.shouldAbort(2), false);
  assert.equal(B.shouldAbort(3), true);
  assert.equal(B.shouldAbort(4), true);
});

test('실패 → 성공 → 실패는 중단이 아니다 (누적 시나리오)', () => {
  let c = 0;
  for (const ev of ['fail', 'fail', 'ok', 'fail', 'skip', 'fail']) {
    c = B.nextFailureCount(c, ev);
    assert.equal(B.shouldAbort(c), false, ev);
  }
  c = B.nextFailureCount(c, 'fail');     // 세 번째 연속
  assert.equal(B.shouldAbort(c), true);
});

/* ═══ 집계 · 예상 시간 ═══ */

test('summarize — 혼합 rows 집계', () => {
  const s = B.summarize([
    { state: 'done', verdict: 'ok' },
    { state: 'done', verdict: 'ok' },
    { state: 'done', verdict: 'check' },
    { state: 'done', verdict: 'fail' },
    { state: 'done', verdict: 'skip' },
    { state: 'failed', message: 'API 오류' },
    { state: 'skipped', reason: 'no_solution' },
    { state: 'skipped', reason: 'too_long' },
    { state: 'pending' },
    { state: 'running' },
  ]);
  assert.deepEqual(s, { ok: 2, check: 1, fail: 1, skip: 1, failed: 1, skipped: 2, remaining: 2 });
});

test('summarize — 빈 배열', () => {
  assert.deepEqual(B.summarize([]), {
    ok: 0, check: 0, fail: 0, skip: 0, failed: 0, skipped: 0, remaining: 0,
  });
});

test('estimateMinutes — 순차 가정(단조 증가), 0건은 0', () => {
  assert.deepEqual(B.estimateMinutes(0), [0, 0]);
  assert.deepEqual(B.estimateMinutes(1), [1, 4]);
  assert.deepEqual(B.estimateMinutes(10), [10, 40]);
  const [lo5, hi5] = B.estimateMinutes(5);
  const [lo6, hi6] = B.estimateMinutes(6);
  assert.ok(lo6 > lo5 && hi6 > hi5);
});
