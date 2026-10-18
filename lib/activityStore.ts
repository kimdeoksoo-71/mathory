/**
 * M10 B — 전역 "바쁨" 스토어(import 0 · `npm run test:activity`). 브라우저 탭 아이콘(FaviconController)이 읽는다.
 *
 * 배선은 **두 곳뿐**: `lib/verifyFlow.ts runVerifyFlow`(단건 — 일괄 안의 문항 호출은 `batch`라 완료 표시를 하지 않는다) ·
 * `lib/batchVerify.ts runBatchVerify`(배치 전체). 호출부(EditorView·ProblemView·CommentPanel·BatchVerifyDialog)에 두지 말 것.
 * busy는 **카운터**다 — 단건·일괄이 겹쳐도, 일괄의 문항 사이 공백에도 깜빡이지 않는다.
 * 완료 점(unseenDone)은 **끝난 순간 탭이 비활성**(hidden 또는 창 포커스 없음)일 때만 켠다 — 보고 있던 탭에 점이 남으면
 * 치워야 할 일이 하나 생긴다(M10 D7). 성공·실패·중단 모두(P20). 돌아오면(acknowledge) 사라진다.
 * ⚠ React를 import하지 말 것 — 단독 tsc 테스트가 깨진다. 훅(useSyncExternalStore)은 소비처가 부른다.
 */

export interface ActivityState { busy: number; unseenDone: boolean }

let state: ActivityState = { busy: 0, unseenDone: false };
const subs = new Set<() => void>();
function set(next: ActivityState) {
  state = next;
  subs.forEach((f) => f());
}

export function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
export function getSnapshot(): ActivityState {
  return state;
}

/** 작업 시작. 반환 함수가 끝(두 번 불러도 한 번만 −1) */
export function beginActivity(): () => void {
  set({ ...state, busy: state.busy + 1 });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    set({ ...state, busy: Math.max(0, state.busy - 1) });
  };
}

/** 작업이 끝났다 — `hidden`(끝난 순간 탭이 비활성)일 때만 완료 점을 켠다 */
export function markDone(hidden: boolean): void {
  if (hidden && !state.unseenDone) set({ ...state, unseenDone: true });
}

/** 사용자가 돌아왔다 — 완료 점을 끈다 */
export function acknowledge(): void {
  if (state.unseenDone) set({ ...state, unseenDone: false });
}

/** 지금 탭이 비활성인가(브라우저 밖·SSR에서는 false) */
export function isTabHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
}
