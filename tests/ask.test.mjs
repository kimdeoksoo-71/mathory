/* Phase 66a — lib/ask/seed.ts 계약 검증 (import 0, tsc 단독 컴파일)
 *
 * T7이 이 파일의 존재 이유다: 씨앗 문안을 고치다 "검산" 같은 낱말을 되살리면 /api/discuss가
 * 사용자 메시지에 "반드시 SymPy를 실행하라, 아니면 무효"를 붙이고 도구 호출을 강제한다(v5 X2).
 * 그 순간 실험은 문안의 질이 아니라 서버 접미사의 압력을 재게 된다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const A = require('../.test-build/lib/ask/seed.js');

test('T1. 씨앗 3개 — label 유일 · target 전부 solution · order 10/20/30 · enabled · rev 1', () => {
  const s = A.SEED_QUESTIONS;
  assert.equal(s.length, 3);
  assert.equal(new Set(s.map((q) => q.label)).size, 3);
  assert.deepEqual(s.map((q) => q.target), ['solution', 'solution', 'solution']);
  assert.deepEqual(s.map((q) => q.order), [10, 20, 30]);
  assert.ok(s.every((q) => q.enabled === true && q.rev === 1));
});

test('T2. 셋 다 정상 문항 전제 포함 · G1·G2는 "빠짐없이" 포함', () => {
  const s = A.SEED_QUESTIONS;
  assert.ok(s.every((q) => q.text.includes('오류가 없고')));
  assert.ok(s[0].text.includes('빠짐없이'));
  assert.ok(s[1].text.includes('빠짐없이'));
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

test('T6. nextOrder — 비면 10, 아니면 최대+10', () => {
  assert.equal(A.nextOrder([]), 10);
  assert.equal(A.nextOrder([{ order: 10 }, { order: 30 }]), 40);
  assert.equal(A.nextOrder([{ order: 30 }, { order: 10 }]), 40);
});

test('T7. 트리거 낱말 — 씨앗 3개 전부 안전 · 검산/그래프 문장은 걸린다 (D20 회귀)', () => {
  for (const q of A.SEED_QUESTIONS) {
    assert.deepEqual(A.triggerWarnings(q.text), [], `${q.label}: 서버 트리거에 걸린다`);
  }
  assert.equal(A.triggerWarnings('검산해줘').length, 1);
  assert.equal(A.triggerWarnings('그래프를 그려줘').length, 1);
  assert.equal(A.triggerWarnings('이 그래프 문제를 검토해줘').length, 0, '그래프에 *관한* 질문은 안 걸려야 한다');
  // 반복 호출 안전(정규식에 g 플래그가 없어야 한다)
  assert.equal(A.triggerWarnings('검산해줘').length, 1);
  // v5 X2 실측 — 원문 G2의 낱말
  assert.equal(A.triggerWarnings('다시 대입해 확인하는 검산').length, 1);
  assert.equal(A.triggerWarnings('다시 대입해 맞는지 확인하는 절차').length, 0);
});
