// Phase 67 S1 — lib/sidebarPeek.ts 상태기계 검증 (npm run test:peek)
// 사양: docs/phaseSketch/Phase67-sidebar-hover-peek-plan-v4.md §3 D4 · §5-8
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_PEEK_STATE, reducePeek, needsCloseTimer, peekView, isHoverPointerType,
  PEEK_OPEN_DELAY, PEEK_CLOSE_GRACE, PEEK_CLOSE_FALLBACK, PEEK_PIN_FALLBACK,
} from '../.test-build/lib/sidebarPeek.js';

const S0 = INITIAL_PEEK_STATE;
/** 이벤트 열을 순서대로 먹인다 — React 18이 한 렌더로 합친 배치도 리듀서 수준에서는 이 순차 적용과 같다 */
const run = (events, s = S0) => events.reduce(reducePeek, s);
const enter = (section = 'my', dragKind = null) => ({ type: 'railEnter', section, dragKind });
const E = (type, extra = {}) => ({ type, ...extra });

/** hover로 열린 상태(포인터는 패널 안) */
const openHover = (section = 'my') => run([E('panelEnter'), enter(section), E('openTimer')]);
/** 터치로 열린 상태 */
const openTouch = (section = 'my') => run([{ type: 'railClick', section, pointerType: 'touch' }]);
/** 마지막으로, 불변식 idle ⇒ section·fresh·via 초기화 */
function assertIdleClean(s) {
  assert.equal(s.phase, 'idle');
  assert.equal(s.section, null);
  assert.equal(s.fresh, false);
  assert.equal(s.via, null);
}

// ─── 상수 ───
test('상수: 폴백은 transition 시간 + 60ms', () => {
  assert.equal(PEEK_OPEN_DELAY, 80);
  assert.equal(PEEK_CLOSE_GRACE, 180);
  assert.equal(PEEK_CLOSE_FALLBACK, 160 + 60);
  assert.equal(PEEK_PIN_FALLBACK, 200 + 60);
});

test('isHoverPointerType: mouse·pen만 hover, touch·빈 값은 아니다', () => {
  assert.equal(isHoverPointerType('mouse'), true);
  assert.equal(isHoverPointerType('pen'), true);
  assert.equal(isHoverPointerType('touch'), false);
  assert.equal(isHoverPointerType(''), false);
});

// ─── 열림 ───
test('스침: railEnter → railLeave(80ms 전) → idle', () => {
  const s = run([enter('share'), E('railLeave')]);
  assertIdleClean(s);
});

test('열림: railEnter → openTimer → open(fresh·hover·섹션)', () => {
  const s = openHover('recent');
  assert.equal(s.phase, 'open');
  assert.equal(s.section, 'recent');
  assert.equal(s.fresh, true);
  assert.equal(s.via, 'hover');
  assert.equal(s.inside, true);
  assert.equal(needsCloseTimer(s), false);
});

test('railEnter는 inside를 세우고 pendingSeq를 올린다', () => {
  const s = run([enter('my')]);
  assert.equal(s.phase, 'pending');
  assert.equal(s.inside, true);
  assert.equal(s.pendingSeq, 1);
});

test('railClick(touch) — 즉시 open · inside=true · via=touch (V9)', () => {
  const s = openTouch('share');
  assert.equal(s.phase, 'open');
  assert.equal(s.section, 'share');
  assert.equal(s.inside, true);
  assert.equal(s.fresh, true);
  assert.equal(s.via, 'touch');
  assert.equal(needsCloseTimer(s), false, '터치로 열자마자 닫힘 타이머가 걸리면 안 된다');
});

test('railClick(mouse) in pending — 80ms 전 클릭도 즉시 open · via=hover', () => {
  const s = run([enter('my'), { type: 'railClick', section: 'my', pointerType: 'mouse' }]);
  assert.equal(s.phase, 'open');
  assert.equal(s.via, 'hover');
});

// ─── W1 — seq ───
test('W1: pending 중 다른 섹션 railEnter → section 교체 · pendingSeq 증가', () => {
  const a = run([enter('my')]);
  const b = reducePeek(a, enter('share'));
  assert.equal(b.phase, 'pending');
  assert.equal(b.section, 'share');
  assert.ok(b.pendingSeq > a.pendingSeq);
});

test('W1: railLeave→railEnter 배치 뒤 phase는 pending 그대로지만 pendingSeq는 달라진다', () => {
  const a = run([enter('my')]);
  const b = run([E('railLeave'), enter('share')], a);
  assert.equal(a.phase, 'pending');
  assert.equal(b.phase, 'pending', '렌더된 phase만 보면 변화가 없다 — 그래서 deps에 seq가 필요하다');
  assert.notEqual(b.pendingSeq, a.pendingSeq);
});

test('W1: panelLeave(참→거짓)마다 leaveSeq 증가 — leave→enter→leave 배치도 +2', () => {
  const o = openHover();
  const a = reducePeek(o, E('panelLeave'));
  assert.equal(a.leaveSeq, o.leaveSeq + 1);
  const b = run([E('panelEnter'), E('panelLeave')], a);
  assert.equal(a.inside, b.inside, '렌더된 inside는 같다');
  assert.equal(b.leaveSeq, a.leaveSeq + 1);
});

// ─── 닫힘 ───
test('panelLeave 뒤 needsCloseTimer 참 → closeTimer → closing → panelTransitionEnd → idle', () => {
  let s = reducePeek(openHover('share'), E('panelLeave'));
  assert.equal(needsCloseTimer(s), true);
  s = reducePeek(s, E('closeTimer'));
  assert.equal(s.phase, 'closing');
  assert.equal(s.section, 'share', 'closing 동안 섹션은 남는다(펼침 레이아웃 유지)');
  s = reducePeek(s, E('panelTransitionEnd'));
  assertIdleClean(s);
});

test('V13: closing 중 panelEnter → open 되감기 · fresh=false', () => {
  let s = run([E('panelLeave'), E('closeTimer')], openHover());
  s = reducePeek(s, E('panelEnter'));
  assert.equal(s.phase, 'open');
  assert.equal(s.fresh, false);
  assert.equal(s.inside, true);
});

test('W3: 두 번째 peek(idle→pending→open)에서 fresh=true 다시', () => {
  let s = run([E('panelLeave'), E('closeTimer'), E('panelTransitionEnd')], openHover());
  assertIdleClean(s);
  s = run([E('panelEnter'), enter('my'), E('openTimer')], s);
  assert.equal(s.fresh, true);
});

test('outsidePointerDown: open → closing', () => {
  assert.equal(reducePeek(openHover(), E('outsidePointerDown')).phase, 'closing');
  assert.equal(reducePeek(openTouch(), E('outsidePointerDown')).phase, 'closing');
});

test('W5: holds>0에서도 outsidePointerDown → closing', () => {
  const s = reducePeek(openHover(), E('hold'));
  assert.equal(reducePeek(s, E('outsidePointerDown')).phase, 'closing');
});

test('W6: 터치 peek은 itemSelected로 닫힌다 · 마우스 peek은 같은 객체', () => {
  assert.equal(reducePeek(openTouch(), E('itemSelected')).phase, 'closing');
  const h = openHover();
  assert.strictEqual(reducePeek(h, E('itemSelected')), h);
});

test('W6: 터치 peek이 idle로 끝나면 via=null', () => {
  const s = run([E('itemSelected'), E('panelTransitionEnd')], openTouch());
  assertIdleClean(s);
});

// ─── hold ───
test('hold 중 needsCloseTimer 거짓 → release 후 참', () => {
  let s = run([E('hold'), E('panelLeave')], openHover());
  assert.equal(needsCloseTimer(s), false);
  assert.strictEqual(reducePeek(s, E('closeTimer')), s, 'hold 중 closeTimer는 무시');
  s = reducePeek(s, E('release'));
  assert.equal(needsCloseTimer(s), true);
});

test('open 뒤 hold → leave → 안 닫힘 → release → 닫힘', () => {
  let s = run([E('hold'), E('panelLeave'), E('closeTimer')], openHover());
  assert.equal(s.phase, 'open');
  s = run([E('release'), E('closeTimer')], s);
  assert.equal(s.phase, 'closing');
});

test('G5: holds는 phase와 독립 — idle에서 hold → peek 열고 떠나도 release 전엔 안 닫힘', () => {
  let s = reducePeek(S0, E('hold'));
  assert.equal(s.holds, 1);
  s = run([E('panelEnter'), enter('my'), E('openTimer'), E('panelLeave'), E('closeTimer')], s);
  assert.equal(s.phase, 'open');
  s = run([E('release'), E('closeTimer')], s);
  assert.equal(s.phase, 'closing');
});

test('holds는 음수가 되지 않는다 — 0에서 release는 같은 객체', () => {
  assert.strictEqual(reducePeek(S0, E('release')), S0);
  const s = run([E('hold'), E('hold'), E('release'), E('release'), E('release')]);
  assert.equal(s.holds, 0);
});

test('release가 holds를 0으로 풀 때만 leaveSeq 증가', () => {
  const two = run([E('hold'), E('hold')]);
  const one = reducePeek(two, E('release'));
  assert.equal(one.leaveSeq, two.leaveSeq);
  const zero = reducePeek(one, E('release'));
  assert.equal(zero.leaveSeq, one.leaveSeq + 1);
});

// ─── DnD ───
test('V10·Y4: DnD 중 railEnter 무시 → 같은 객체', () => {
  assert.strictEqual(reducePeek(S0, enter('my', 'problem')), S0);
  assert.strictEqual(reducePeek(S0, enter('my', 'folder')), S0);
});

test('pending 중 dragStart → idle · open이면 같은 객체', () => {
  assertIdleClean(reducePeek(run([enter('recent')]), E('dragStart')));
  const o = openHover();
  assert.strictEqual(reducePeek(o, E('dragStart')), o);
});

test('V12: setInside(true) 뒤 needsCloseTimer 거짓 — 드롭 뒤 재판정이 peek을 살린다', () => {
  // DragOverlay가 포인터 밑에 들어와 panelLeave가 났고, 드롭 뒤 재판정이 안이라고 알린다
  let s = run([E('hold'), E('panelLeave'), E('release')], openHover());
  assert.equal(needsCloseTimer(s), true);
  s = reducePeek(s, { type: 'setInside', inside: true });
  assert.equal(needsCloseTimer(s), false);
});

test('Y2: setInside(false) 두 번째는 같은 객체 · leaveSeq 불변', () => {
  const a = reducePeek(openHover(), { type: 'setInside', inside: false });
  const b = reducePeek(a, { type: 'setInside', inside: false });
  assert.strictEqual(b, a);
});

test('Y2: setInside(true)가 inside를 바꿀 때 leaveSeq 불변 · phase도 불변(되감기는 panelEnter의 몫)', () => {
  const c = run([E('panelLeave'), E('closeTimer')], openHover());
  const d = reducePeek(c, { type: 'setInside', inside: true });
  assert.equal(d.inside, true);
  assert.equal(d.leaveSeq, c.leaveSeq);
  assert.equal(d.phase, 'closing');
});

// ─── pin ───
test('pin → pinning → asideTransitionEnd → idle', () => {
  let s = reducePeek(openHover(), E('pin'));
  assert.equal(s.phase, 'pinning');
  s = reducePeek(s, { type: 'collapsedChanged', collapsed: false });
  assert.equal(s.phase, 'pinning', '펼침 신호는 pinning을 끝내지 않는다');
  s = reducePeek(s, E('asideTransitionEnd'));
  assertIdleClean(s);
});

test('V8: pinning 중 panelTransitionEnd는 무시 — 같은 객체', () => {
  const p = reducePeek(openHover(), E('pin'));
  assert.strictEqual(reducePeek(p, E('panelTransitionEnd')), p);
});

test('pin in closing(되감기 없이) → pinning', () => {
  const c = run([E('panelLeave'), E('closeTimer')], openHover());
  assert.equal(reducePeek(c, E('pin')).phase, 'pinning');
});

test('Y4: pinning 중 collapsedChanged(true) → idle (200ms 안 더블 토글)', () => {
  const p = reducePeek(openHover(), E('pin'));
  assertIdleClean(reducePeek(p, { type: 'collapsedChanged', collapsed: true }));
});

test('불변식 !collapsed ⇒ idle(pinning 제외): pending·open·closing에서 collapsedChanged(false) → idle', () => {
  assertIdleClean(reducePeek(run([enter('my')]), { type: 'collapsedChanged', collapsed: false }));
  assertIdleClean(reducePeek(openHover(), { type: 'collapsedChanged', collapsed: false }));
  const c = run([E('panelLeave'), E('closeTimer')], openHover());
  assertIdleClean(reducePeek(c, { type: 'collapsedChanged', collapsed: false }));
});

test('W8: idle에서 collapsedChanged(false)(레일 열기 버튼) → 같은 객체', () => {
  assert.strictEqual(reducePeek(S0, { type: 'collapsedChanged', collapsed: false }), S0);
});

// ─── 섹션 전환 ───
test('switchSection: open에서 섹션 교체', () => {
  const s = reducePeek(openHover('my'), { type: 'switchSection', section: 'recent' });
  assert.equal(s.section, 'recent');
  assert.equal(s.phase, 'open');
});

test('N3: hold 중 switchSection 무시 — 같은 객체', () => {
  const h = reducePeek(openHover('my'), E('hold'));
  assert.strictEqual(reducePeek(h, { type: 'switchSection', section: 'share' }), h);
});

test('활성 섹션으로 switchSection은 같은 객체(헤더 클릭 no-op)', () => {
  const o = openHover('share');
  assert.strictEqual(reducePeek(o, { type: 'switchSection', section: 'share' }), o);
});

// ─── Y2 — no-op은 같은 객체 ───
test('Y2: 무시 이벤트는 입력 state를 그대로 돌려준다', () => {
  const o = openHover('my');
  const pending = run([enter('my')]);
  const pinning = reducePeek(o, E('pin'));
  const cases = [
    ['railClick in open', o, { type: 'railClick', section: 'share', pointerType: 'mouse' }],
    ['panelTransitionEnd in open', o, E('panelTransitionEnd')],
    ['asideTransitionEnd in open', o, E('asideTransitionEnd')],
    ['railLeave in open', o, E('railLeave')],
    ['closeTimer with inside', o, E('closeTimer')],
    ['openTimer in open', o, E('openTimer')],
    ['railEnter in open', o, enter('share')],
    ['panelEnter already inside', o, E('panelEnter')],
    ['pin in pending', pending, E('pin')],
    ['outsidePointerDown in pending', pending, E('outsidePointerDown')],
    ['switchSection in pending', pending, { type: 'switchSection', section: 'recent' }],
    ['panelTransitionEnd in pinning', pinning, E('panelTransitionEnd')],
    ['railClick in pinning', pinning, { type: 'railClick', section: 'my', pointerType: 'touch' }],
    ['openTimer in idle', S0, E('openTimer')],
    ['panelLeave already outside', S0, E('panelLeave')],
    ['closeTimer in idle', S0, E('closeTimer')],
    ['itemSelected in idle', S0, E('itemSelected')],
  ];
  for (const [name, s, ev] of cases) assert.strictEqual(reducePeek(s, ev), s, name);
});

// ─── peekView (D1·D2·D6·D17) ───
test('peekView: 고정 펼침 idle — 펼침 레이아웃 · 래퍼 100% · 카드 아님 · z auto', () => {
  const v = peekView(S0, false);
  assert.deepEqual(v, {
    peeking: false, expandedLook: true, renderCollapsed: false, lockContentWidth: false,
    playPeekIn: false, peekCard: false, raised: false, panelWide: true,
  });
});

test('peekView: 접힘 idle — 레일 · 56 · z auto', () => {
  const v = peekView(S0, true);
  assert.equal(v.renderCollapsed, true);
  assert.equal(v.panelWide, false);
  assert.equal(v.raised, false);
});

test('peekView: pending — 레일 그대로지만 z 80(D1)', () => {
  const v = peekView(run([enter('my')]), true);
  assert.equal(v.renderCollapsed, true);
  assert.equal(v.raised, true);
  assert.equal(v.panelWide, false);
  assert.equal(v.peekCard, false);
});

test('peekView: open — 펼침 · 폭 고정 · 넓은 패널 · 카드 · peekIn(fresh)', () => {
  const v = peekView(openHover(), true);
  assert.deepEqual(v, {
    peeking: true, expandedLook: true, renderCollapsed: false, lockContentWidth: true,
    playPeekIn: true, peekCard: true, raised: true, panelWide: true,
  });
});

test('peekView: closing — 펼침 유지 · 패널 56 · 카드 유지 · peekIn 없음(W3)', () => {
  const v = peekView(run([E('panelLeave'), E('closeTimer')], openHover()), true);
  assert.equal(v.expandedLook, true);
  assert.equal(v.panelWide, false);
  assert.equal(v.peekCard, true);
  assert.equal(v.playPeekIn, false);
});

test('peekView: 되감기 open(fresh=false)은 peekIn을 재생하지 않는다(V13)', () => {
  const s = run([E('panelLeave'), E('closeTimer'), E('panelEnter')], openHover());
  assert.equal(peekView(s, true).playPeekIn, false);
});

test('peekView: pinning(collapsed=false) — 펼침 · 폭 고정(W7) · 카드 아님(D17) · z 80(E1) · 섹션은 고정값', () => {
  const v = peekView(reducePeek(openHover(), E('pin')), false);
  assert.equal(v.expandedLook, true);
  assert.equal(v.lockContentWidth, true);
  assert.equal(v.peekCard, false);
  assert.equal(v.raised, true);
  assert.equal(v.peeking, false);
  assert.equal(v.panelWide, true);
});
