/* ═══════════════════════════════════════════════════════════════
   M8 D5 — 폰 가로 보기의 크롬(상단 바 + 탭 행) 자동 숨김 판정. import 0 · npm run test:chrome

   PhoneShell이 본문 스크롤러의 scroll 이벤트마다 `nextChromeState`를 부르고, `action`이
   있을 때만 setState한다(매 스크롤 리렌더 0 — 61c "리렌더 자체가 버그" 규약).

   4중 가드 — 하나라도 빠지면 접힘↔펼침이 **진동**한다:
   ① 러버밴드 무시: iOS는 scrollTop이 음수·초과로 간다. 맨 위에서 당길 때 hide,
      맨 아래에서 당길 때 show가 튄다.
   ② 토글 직후 무시 창(IGNORE_MS): 크롬이 접히면 clientHeight가 chromeH만큼 늘어 브라우저가
      scrollTop을 클램프하며 **역방향 scroll 이벤트**를 낸다 — 이것을 "위로 밀었다"로 읽으면
      접자마자 펼친다. 프로그램적 스크롤(탭 전환 복원)도 같은 창을 쓴다(markProgrammaticScroll).
   ③ 히스테리시스(HYSTERESIS_PX): 같은 방향 누적이 문턱을 넘을 때만 토글, 방향이 바뀌면 누적 리셋.
   ④ 짧은 콘텐츠 금지(MIN_EXTRA_PX): 숨겨서 얻는 여지가 없으면 절대 숨기지 않는다 — ②의
      클램프가 커지고 얻는 게 없다.
   y ≤ 0(맨 위)이면 모드와 무관하게 항상 표시.
   ═══════════════════════════════════════════════════════════════ */

/** 같은 방향 누적 스크롤이 이 값을 넘을 때만 토글 */
export const HYSTERESIS_PX = 24;
/** 토글·프로그램적 스크롤 뒤 scroll 이벤트를 무시하는 창(ms). 크롬 transition(200ms)보다 길어야 한다 */
export const IGNORE_MS = 300;
/** 크롬을 접었을 때 남는 스크롤 여지가 이보다 작으면 접지 않는다 */
export const MIN_EXTRA_PX = 40;

/** 'reveal-on-up' = 위로 HYSTERESIS 이상 밀면 즉시 복귀(Q1 권장) / 'reveal-at-top' = 맨 위에서만 */
export type RevealMode = 'reveal-on-up' | 'reveal-at-top';

export interface ChromeState {
  hidden: boolean;
  lastY: number;
  /** 같은 방향 누적 이동(px, 아래 +) */
  acc: number;
  /** 이 시각(ms)까지의 scroll 이벤트는 무시 */
  ignoreUntil: number;
}

export interface ScrollSample {
  y: number;
  scrollHeight: number;
  clientHeight: number;
  /** 현재 크롬 높이(px, 실측) */
  chromeH: number;
  now: number;
}

export type ChromeAction = 'hide' | 'show' | null;

export const INITIAL_CHROME_STATE: ChromeState = { hidden: false, lastY: 0, acc: 0, ignoreUntil: 0 };

export function nextChromeState(
  s: ChromeState,
  { y, scrollHeight, clientHeight, chromeH, now }: ScrollSample,
  mode: RevealMode = 'reveal-on-up',
): { state: ChromeState; action: ChromeAction } {
  const max = scrollHeight - clientHeight;

  // ① 러버밴드 — 상태 무변경(lastY도 그대로: 복귀 샘플의 dy가 0에 가깝다)
  if (y < 0 || y > max) return { state: s, action: null };

  // ② 무시 창 — 위치만 따라가고 누적은 버린다
  if (now < s.ignoreUntil) return { state: { ...s, lastY: y, acc: 0 }, action: null };

  // 맨 위 — 항상 표시
  if (y <= 0) {
    if (s.hidden) return { state: { hidden: false, lastY: 0, acc: 0, ignoreUntil: now + IGNORE_MS }, action: 'show' };
    return { state: { ...s, lastY: 0, acc: 0 }, action: null };
  }

  const dy = y - s.lastY;
  // ③ 방향이 바뀌면 누적 리셋
  const sameDir = s.acc === 0 || (s.acc > 0) === (dy > 0);
  const acc = sameDir ? s.acc + dy : dy;

  if (!s.hidden) {
    // ④ 접어서 얻는 여지가 있어야 한다(접힌 뒤 max는 max − chromeH)
    const canHide = max - chromeH >= MIN_EXTRA_PX;
    if (acc >= HYSTERESIS_PX && y > chromeH && canHide) {
      return { state: { hidden: true, lastY: y, acc: 0, ignoreUntil: now + IGNORE_MS }, action: 'hide' };
    }
  } else if (mode === 'reveal-on-up' && acc <= -HYSTERESIS_PX) {
    return { state: { hidden: false, lastY: y, acc: 0, ignoreUntil: now + IGNORE_MS }, action: 'show' };
  }

  return { state: { ...s, lastY: y, acc }, action: null };
}

/** 프로그램적 스크롤(탭 전환 복원 등) 직전에 부른다 — 그 이동이 사용자 스크롤로 읽히지 않게 무시 창을 세운다 */
export function markProgrammaticScroll(s: ChromeState, y: number, now: number): ChromeState {
  return { ...s, lastY: Math.max(0, y), acc: 0, ignoreUntil: now + IGNORE_MS };
}

/** 세로로 돌아오거나 기능이 꺼질 때 — 표시 상태로 리셋 */
export function resetChromeState(): ChromeState {
  return { ...INITIAL_CHROME_STATE };
}
