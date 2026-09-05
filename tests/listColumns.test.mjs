// Phase 63 S4 — lib/listColumns.ts 로직 검증 (npm run test:list)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONAL_COLUMN_IDS, MIN_COL_WIDTH,
  defaultPrefs, sanitizePrefs, toggledListSort, movedOrder,
  visibleColumns, buildGridTemplate, verifyRank, blockchainRank, columnLabel,
} from '../.test-build/lib/listColumns.js';

/* ─── 기본값 ─── */
test('defaultPrefs: 전부 보이기 · 레지스트리 순 · 자동폭 · 제목 오름차순', () => {
  const p = defaultPrefs();
  assert.deepEqual(p.hidden, []);
  assert.deepEqual(p.order, OPTIONAL_COLUMN_IDS);
  assert.deepEqual(p.widths, {});
  assert.deepEqual(p.sort, { key: 'title', dir: 'asc' });
});

test('defaultPrefs: 휴지통은 수정일 내림차순(D41 — 최근 버린 순)', () => {
  assert.deepEqual(defaultPrefs({ trash: true }).sort, { key: 'updated', dir: 'desc' });
});

/* ─── sanitize ─── */
test('sanitizePrefs: null·비객체·버전 불일치는 기본값', () => {
  assert.deepEqual(sanitizePrefs(null), defaultPrefs());
  assert.deepEqual(sanitizePrefs('x'), defaultPrefs());
  assert.deepEqual(sanitizePrefs({ v: 2, hidden: ['agent'] }), defaultPrefs());
});

test('sanitizePrefs: 모르는 id는 버리고 새 id는 뒤에 붙는다(D6)', () => {
  const p = sanitizePrefs({ v: 1, hidden: ['agent', 'ghost'], order: ['comments', 'ghost', 'agent'] });
  assert.deepEqual(p.hidden, ['agent']);
  // 저장에 없던 나머지 optional이 뒤에 순서대로
  assert.deepEqual(p.order, ['comments', 'agent', ...OPTIONAL_COLUMN_IDS.filter((id) => id !== 'comments' && id !== 'agent')]);
});

test('sanitizePrefs: widths는 조절 대상만·최소 40·정수 반올림', () => {
  const p = sanitizePrefs({ v: 1, widths: { agent: 10, updated: 90.6, title: 500, ghost: 80, comments: NaN } });
  assert.equal(p.widths.agent, MIN_COL_WIDTH);
  assert.equal(p.widths.updated, 91);
  assert.equal('title' in p.widths, false);   // 제목(1fr)은 조절 대상 아님(D7)
  assert.equal('ghost' in p.widths, false);
  assert.equal('comments' in p.widths, false);
});

test('sanitizePrefs: sort 키·방향 검증 — 불명이면 기본', () => {
  assert.deepEqual(sanitizePrefs({ v: 1, sort: { key: 'agent', dir: 'desc' } }).sort, { key: 'agent', dir: 'desc' });
  assert.deepEqual(sanitizePrefs({ v: 1, sort: { key: 'ghost', dir: 'desc' } }).sort, { key: 'title', dir: 'asc' });
  assert.deepEqual(sanitizePrefs({ v: 1, sort: { key: 'title', dir: 'up' } }).sort, { key: 'title', dir: 'asc' });
});

/* ─── 정렬 토글 ─── */
test('toggledListSort: 같은 키 반전 · 새 키 기본 방향(제목만 asc)', () => {
  assert.deepEqual(toggledListSort({ key: 'title', dir: 'asc' }, 'title'), { key: 'title', dir: 'desc' });
  assert.deepEqual(toggledListSort({ key: 'title', dir: 'asc' }, 'updated'), { key: 'updated', dir: 'desc' });
  assert.deepEqual(toggledListSort({ key: 'updated', dir: 'desc' }, 'title'), { key: 'title', dir: 'asc' });
  assert.deepEqual(toggledListSort({ key: 'updated', dir: 'desc' }, 'agent'), { key: 'agent', dir: 'desc' });
});

test('toggledListSort: 정렬 불가 키는 무시', () => {
  const prev = { key: 'title', dir: 'asc' };
  assert.equal(toggledListSort(prev, 'owner'), prev);
});

/* ─── 순서 이동 ─── */
test('movedOrder: 한 칸 이동 · 경계 무시 · 원본 불변', () => {
  const o = ['a', 'b', 'c'];
  assert.deepEqual(movedOrder(o, 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(movedOrder(o, 'b', 1), ['a', 'c', 'b']);
  assert.equal(movedOrder(o, 'a', -1), o);
  assert.equal(movedOrder(o, 'c', 1), o);
  assert.equal(movedOrder(o, 'x', 1), o);
  assert.deepEqual(o, ['a', 'b', 'c']);
});

/* ─── 표시 칼럼 · 템플릿 ─── */
test('visibleColumns: 제목 → optional(순서·숨김) → mode → 수정일', () => {
  const p = sanitizePrefs({ v: 1, hidden: ['blockchain'], order: ['comments', 'agent', 'verify_problem', 'verify_solution', 'blockchain'] });
  assert.deepEqual(visibleColumns(p, 'my'), ['title', 'comments', 'agent', 'verify_problem', 'verify_solution', 'updated']);
  assert.deepEqual(visibleColumns(p, 'received').includes('owner'), true);
  assert.deepEqual(visibleColumns(p, 'sent').includes('perm'), true);
  // mode 칼럼은 updated 바로 앞
  const vs = visibleColumns(p, 'sent');
  assert.equal(vs.indexOf('perm'), vs.length - 2);
});

test('buildGridTemplate: 스페이서 2px + 제목 1fr + 자동/지정 폭 + mode 고정 + 28px + 2px', () => {
  const t = buildGridTemplate(['title', 'agent', 'owner', 'updated'], { agent: 64 });
  assert.equal(t, '2px minmax(0, 1fr) 64px 120px max-content 28px 2px');
});

test('buildGridTemplate: checkbox 트랙(D16)은 좌 스페이서 다음 24px', () => {
  const t = buildGridTemplate(['title', 'updated'], {}, true);
  assert.equal(t, '2px 24px minmax(0, 1fr) max-content 28px 2px');
});

/* ─── 서열 ─── */
test('verifyRank: 없음 < skip < ok < check < fail, stale은 한 단 아래(D4)', () => {
  const seq = [
    verifyRank(undefined, false),        // 없음
    verifyRank('skip', true),
    verifyRank('skip', false),
    verifyRank('ok', true),
    verifyRank('ok', false),
    verifyRank('check', true),
    verifyRank('check', false),
    verifyRank('fail', true),
    verifyRank('fail', false),
  ];
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] > seq[i - 1], `seq[${i}] > seq[${i - 1}]`);
  assert.equal(verifyRank(undefined, true), 0); // 없음은 stale과 무관하게 최하
});

test('blockchainRank: 없음 0 < 수정됨 1 < 인증 2', () => {
  assert.equal(blockchainRank(false, false), 0);
  assert.equal(blockchainRank(true, true), 1);
  assert.equal(blockchainRank(true, false), 2);
});

test('columnLabel: 레지스트리·mode 칼럼·불명 id', () => {
  assert.equal(columnLabel('verify_problem'), '검증(문제)');
  assert.equal(columnLabel('owner'), '소유자');
  assert.equal(columnLabel('ghost'), 'ghost');
});
