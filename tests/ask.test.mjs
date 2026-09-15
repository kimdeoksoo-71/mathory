/* Phase 66a·66b — lib/ask/seed.ts 계약 검증 (import 0, tsc 단독 컴파일)
 *
 * 이 파일이 지키는 조용한 실패 셋:
 * - T7: 씨앗 문안에 "검산" 같은 낱말이 되살아나면 /api/discuss가 "반드시 SymPy를 실행하라, 아니면 무효"를
 *   붙이고 도구 호출을 강제한다 — 실험이 문안이 아니라 서버 접미사를 재게 된다(66a v5 X2).
 * - T8: 씨앗 보충이 "이미 제안한 키"를 무시하면 덕수가 지운 질문이 다음 열기에 되살아난다(66b D4).
 * - T9: 씨앗에 `$`가 들어가면 대화 말풍선에서 `…`·`$\displaystyle ...$`로 깨져 보인다(66a E3 · 66b D5′).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const A = require('../.test-build/lib/ask/seed.js');

const byKey = (k) => A.SEED_QUESTIONS.find((q) => q.seedKey === k);

test('T1′. 씨앗 7개 — label·seedKey 유일 · 문제 4 / 풀이 3 · order · enabled · rev 1 · withTabs는 P1만 false', () => {
  const s = A.SEED_QUESTIONS;
  assert.equal(s.length, 7);
  assert.equal(new Set(s.map((q) => q.label)).size, 7);
  assert.deepEqual(s.map((q) => q.seedKey), ['P1', 'P2', 'P3', 'P4', 'G1', 'G2', 'G3']);
  assert.deepEqual(s.map((q) => q.target), ['problem', 'problem', 'problem', 'problem', 'solution', 'solution', 'solution']);
  assert.deepEqual(s.map((q) => q.order), [10, 20, 30, 40, 50, 60, 70]);
  assert.ok(s.every((q) => q.enabled === true && q.rev === 1));
  assert.deepEqual(s.map((q) => q.withTabs), [false, true, true, true, true, true, true]);
});

test('T2′. 풀이 질문만 정상 문항 전제 — 문제 질문은 문제를 의심하므로 전제가 없어야 한다', () => {
  for (const k of ['G1', 'G2', 'G3']) assert.ok(byKey(k).text.includes('오류가 없고'), `${k}: 전제 누락`);
  for (const k of ['P1', 'P2', 'P3', 'P4']) assert.ok(!byKey(k).text.includes('오류가 없고'), `${k}: 전제가 있으면 안 된다`);
  assert.ok(byKey('G1').text.includes('빠짐없이'));
  assert.ok(byKey('G2').text.includes('빠짐없이'));
});

test('T3. buildAskMessage — 첫 줄 라벨 · 본문 무변경($$·$& 안전)', () => {
  const text = '수식 $$x$$ 과 $& 와 $1 을 그대로';
  const m = A.buildAskMessage({ label: '군더더기(원문)', rev: 3, text });
  const lines = m.split('\n');
  assert.equal(lines[0], '[문답 검증 · 군더더기(원문) r3]');
  assert.equal(lines[1], '');
  assert.equal(m.slice(lines[0].length + 2), text, '본문은 한 글자도 바뀌면 안 된다');
});

test('T4. nextRev', () => {
  assert.equal(A.nextRev(3), 4);
  assert.equal(A.nextRev(undefined), 1);
  assert.equal(A.nextRev(null), 1);
  assert.equal(A.nextRev(0), 1);
});

test('T5. validateQuestion — 빈 label·빈 text·8000자 초과 거부, 정상 통과', () => {
  assert.notEqual(A.validateQuestion({ label: '', text: 'x' }), null);
  assert.notEqual(A.validateQuestion({ label: '  ', text: 'x' }), null);
  assert.notEqual(A.validateQuestion({ label: 'a', text: '' }), null);
  assert.notEqual(A.validateQuestion({ label: 'a', text: 'x'.repeat(8001) }), null);
  assert.equal(A.validateQuestion({ label: 'a', text: 'x'.repeat(8000) }), null);
  assert.equal(A.validateQuestion({ label: 'a', text: '질문' }), null);
});

test('T6′. nextOrder — target 안에서만 최대+10 (66b D11)', () => {
  assert.equal(A.nextOrder([], 'problem'), 10);
  const mixed = [{ order: 10, target: 'problem' }, { order: 30, target: 'solution' }];
  assert.equal(A.nextOrder(mixed, 'problem'), 20);
  assert.equal(A.nextOrder(mixed, 'solution'), 40);
  // 덕수 계정 모양 — G 10~30 · 보충 P 10~40 → 새 풀이 질문은 40이어야 한다(전역 최대면 50)
  const duksu = [10, 20, 30].map((o) => ({ order: o, target: 'solution' }))
    .concat([10, 20, 30, 40].map((o) => ({ order: o, target: 'problem' })));
  assert.equal(A.nextOrder(duksu, 'solution'), 40);
});

test('T7′. 트리거 낱말 — 씨앗 7개 전부 안전 · 검산/그래프 문장은 걸린다 (66a D20 회귀)', () => {
  for (const q of A.SEED_QUESTIONS) {
    assert.deepEqual(A.triggerWarnings(q.text), [], `${q.label}: 서버 트리거에 걸린다`);
  }
  assert.equal(A.triggerWarnings('검산해줘').length, 1);
  assert.equal(A.triggerWarnings('그래프를 그려줘').length, 1);
  assert.equal(A.triggerWarnings('이 그래프 문제를 검토해줘').length, 0, '그래프에 *관한* 질문은 안 걸려야 한다');
  assert.equal(A.triggerWarnings('검산해줘').length, 1, '반복 호출 안전(g 플래그 금지)');
  assert.equal(A.triggerWarnings('다시 대입해 확인하는 검산').length, 1);
  assert.equal(A.triggerWarnings('다시 대입해 맞는지 확인하는 절차').length, 0);
});

test('T8. planSeedTopUp — 기존 사용자엔 P만 보충 · 지운 질문은 되살아나지 않는다 · effectiveWithTabs', () => {
  const ALL = ['P1', 'P2', 'P3', 'P4', 'G1', 'G2', 'G3'];
  const keys = (r) => r.toCreate.map((s) => s.seedKey);

  // ① 기록 없음 + 목록 있음 = 66a 사용자(덕수) → P1~P4만, 기록 7
  const r1 = A.planSeedTopUp({ offered: undefined, collectionEmpty: false });
  assert.deepEqual(keys(r1), ['P1', 'P2', 'P3', 'P4']);
  assert.deepEqual([...r1.nextOffered].sort(), [...ALL].sort());
  assert.equal(r1.record, true);

  // ② 기록 없음 + 목록 비었음 = 처음 쓰는 사용자 → 7개 전부
  const r2 = A.planSeedTopUp({ offered: undefined, collectionEmpty: true });
  assert.deepEqual(keys(r2), ALL);
  assert.equal(r2.record, true);

  // ③ 기록 7 + 목록 있음 → 생성 0 · 기록 불필요
  const r3 = A.planSeedTopUp({ offered: ALL, collectionEmpty: false });
  assert.deepEqual(keys(r3), []);
  assert.equal(r3.record, false);

  // ④ 기록 7 + 목록 비었음(전부 지움) → 생성 0 — 되살아나지 않는다
  const r4 = A.planSeedTopUp({ offered: ALL, collectionEmpty: true });
  assert.deepEqual(keys(r4), []);
  assert.equal(r4.record, false);

  // ⑤ undefined와 []는 다르다 — [] = 기록은 있고 제안한 것 없음 → 전부
  assert.deepEqual(keys(A.planSeedTopUp({ offered: [], collectionEmpty: false })), ALL);

  // ⑥ effectiveWithTabs — 풀이 질문은 저장값과 무관하게 항상 탭을 보낸다(Z2)
  assert.equal(A.effectiveWithTabs({ target: 'problem', withTabs: false }), false);
  assert.equal(A.effectiveWithTabs({ target: 'problem', withTabs: true }), true);
  assert.equal(A.effectiveWithTabs({ target: 'problem' }), true, '필드 없는 옛 문서 = true');
  assert.equal(A.effectiveWithTabs({ target: 'solution', withTabs: false }), true);
});

test('T9. 씨앗 7개 본문의 `$`는 0개 (66b D5′ — 말풍선 표시 회귀)', () => {
  for (const q of A.SEED_QUESTIONS) {
    assert.equal((q.text.match(/\$/g) || []).length, 0, `${q.label}: 본문에 $가 있으면 말풍선에서 깨져 보인다`);
  }
});
