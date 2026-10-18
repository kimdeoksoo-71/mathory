/**
 * M10 D3·P29 — 문항별 **진행 중 저장** 레지스트리 (import 0).
 *
 * 편집창을 나가면(언마운트) 진행 중 저장을 기다렸다가 한 번 더 저장한다(최대 15초 + 저장 1회). 그 사이 **같은 문항**을
 * 다시 편집하면 새 편집창이 커밋 전·후 어느 쪽인지 모를 블록 id를 읽고, 다음 저장이 남은 쪽을 못 지워 블록이 두 벌이 된다.
 * → 새 편집창의 로드는 `whenIdle(problemId)`를 먼저 기다린다.
 *
 * 등록 주체 둘: ① `EditorView.handleSave`(자기 저장 구간) ② 언마운트 cleanup(**"대기 + 저장" 사슬 전체** — handleSave 안
 * 등록만으로는 첫 커밋 종료 ~ 둘째 저장 시작 사이가 빈다, M10 v4 R1).
 * 삭제는 `finally`에서 **같은 Promise일 때만**(늦게 끝난 옛 사슬이 나중 등록을 지우지 않게). 실패는 삼킨다(기다림만 끝나면 된다).
 */

const pending = new Map<string, Promise<void>>();

export function registerPending(problemId: string, p: Promise<unknown>): void {
  const q: Promise<void> = p.then(() => undefined, () => undefined);
  pending.set(problemId, q);
  void q.then(() => { if (pending.get(problemId) === q) pending.delete(problemId); });
}

export function whenIdle(problemId: string): Promise<void> {
  return pending.get(problemId) ?? Promise.resolve();
}
