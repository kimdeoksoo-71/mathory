// M8 S4 — lib/chromeAutoHide.ts 판정 로직 검증 (npm run test:chrome)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HYSTERESIS_PX, IGNORE_MS, MIN_EXTRA_PX,
  INITIAL_CHROME_STATE, nextChromeState, markProgrammaticScroll, resetChromeState,
} from '../.test-build/lib/chromeAutoHide.js';

/* 기준 표본: iPhone 15 가로. 크롬 96, 스크롤러 clientHeight 297(=393−96), 긴 문항 scrollHeight 2000 */
const CH = 96;
const base = { scrollHeight: 2000, clientHeight: 297, chromeH: CH };
const at = (y, now = 1000, extra = {}) => ({ y, now, ...base, ...extra });
/** 그 위치에 이미 서 있는 상태(초기 lastY 0에서 첫 샘플이 큰 하향으로 읽히는 것을 피한다) */
const from = (y) => ({ ...INITIAL_CHROME_STATE, lastY: y });

/** 샘플 열을 순서대로 먹여 마지막 결과와 발생한 action 목록을 돌려준다 */
function run(samples, s0 = INITIAL_CHROME_STATE, mode) {
  let s = s0; const actions = [];
  for (const smp of samples) {
    const r = nextChromeState(s, smp, mode);
    s = r.state; if (r.action) actions.push(r.action);
  }
  return { s, actions };
}

test('아래로 문턱 미만(23px) — 유지', () => {
  const { s, actions } = run([at(120), at(143)], from(120));
  assert.deepEqual(actions, []);
  assert.equal(s.hidden, false);
});

test('아래로 문턱 이상(누적 24px) — hide + 무시 창 세움', () => {
  const { s, actions } = run([at(120), at(132), at(144, 1050)], from(120));
  assert.deepEqual(actions, ['hide']);
  assert.equal(s.hidden, true);
  assert.equal(s.ignoreUntil, 1050 + IGNORE_MS);
});

test('러버밴드(음수·초과)는 무시 — 상태 무변경', () => {
  const s0 = { ...INITIAL_CHROME_STATE, hidden: true, lastY: 500 };
  // 맨 아래(max = 2000−393 = 1607, 접힌 뒤 clientHeight 393)에서 초과
  const r1 = nextChromeState(s0, at(1700, 1000, { clientHeight: 393 }));
  assert.equal(r1.action, null); assert.deepEqual(r1.state, s0);
  const r2 = nextChromeState(s0, at(-30));
  assert.equal(r2.action, null); assert.deepEqual(r2.state, s0);
});

test('무시 창 안의 역방향(클램프 이벤트) — show 되지 않는다(진동 차단)', () => {
  const { s, actions } = run([at(300), at(324, 1000)], from(300));   // hide @1000
  assert.deepEqual(actions, ['hide']);
  // 접힘 직후 clientHeight 393으로 자라며 브라우저가 scrollTop을 96 되돌린 경우
  const r = nextChromeState(s, at(228, 1100, { clientHeight: 393 }));
  assert.equal(r.action, null);
  assert.equal(r.state.hidden, true);
  assert.equal(r.state.acc, 0);
});

test('무시 창이 지나면 위로 24px에 show(reveal-on-up)', () => {
  const { s } = run([at(300), at(324, 1000)], from(300));              // hidden
  const { s: s2, actions } = run([at(600, 1400, { clientHeight: 393 }), at(576, 1450, { clientHeight: 393 })], s);
  assert.deepEqual(actions, ['show']);
  assert.equal(s2.hidden, false);
});

test('방향이 바뀌면 누적이 리셋된다', () => {
  const { s } = run([at(300), at(315), at(305)], from(300));           // +15 후 −10
  assert.equal(s.acc, -10);
  assert.equal(s.hidden, false);
});

test('맨 위(y ≤ 0)는 모드와 무관하게 show', () => {
  const s0 = { ...INITIAL_CHROME_STATE, hidden: true, lastY: 40 };
  const r = nextChromeState(s0, at(0, 1000, { clientHeight: 393 }), 'reveal-at-top');
  assert.equal(r.action, 'show');
  assert.equal(r.state.hidden, false);
});

test('콘텐츠가 짧으면 hide 금지 — 접어서 남는 여지 < MIN_EXTRA', () => {
  // max = 430 − 297 = 133, 접으면 133 − 96 = 37 < 40
  const short = { scrollHeight: 430 };
  const { s, actions } = run([at(100, 1000, short), at(130, 1050, short)], from(100));
  assert.deepEqual(actions, []);
  assert.equal(s.hidden, false);
  assert.ok(133 - CH < MIN_EXTRA_PX);
});

test('reveal-at-top 모드 — 위로 스크롤만으로는 show 되지 않는다', () => {
  const s0 = { ...INITIAL_CHROME_STATE, hidden: true, lastY: 600 };
  const r = nextChromeState(s0, at(500, 1000, { clientHeight: 393 }), 'reveal-at-top');
  assert.equal(r.action, null);
  assert.equal(r.state.hidden, true);
});

test('markProgrammaticScroll — 탭 전환 복원(큰 하향 점프)이 hide로 읽히지 않는다', () => {
  const s0 = { ...INITIAL_CHROME_STATE, lastY: 100 };
  const s1 = markProgrammaticScroll(s0, 1200, 1000);
  const r = nextChromeState(s1, at(1200, 1010));
  assert.equal(r.action, null);
  assert.equal(r.state.hidden, false);
  // 창이 지난 뒤 실제 스크롤은 정상 판정
  const r2 = run([at(1200, 1400), at(1230, 1450)], r.state);
  assert.deepEqual(r2.actions, ['hide']);
});

test('상수·리셋', () => {
  assert.equal(HYSTERESIS_PX, 24);
  assert.ok(IGNORE_MS > 200, '무시 창은 크롬 transition(200ms)보다 길어야 한다');
  assert.deepEqual(resetChromeState(), INITIAL_CHROME_STATE);
});
