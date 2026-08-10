/* ═══ 편집창 스크롤 공용 유틸 (Phase 56) ═══════════════════════════════
   EditorView.tsx 와 FindReplacePanel.tsx 가 공유한다.
   편집 패널의 모든 자동 스크롤은 이 모듈을 거쳐야 한다:
   - 스크롤 타깃 계산: computeBlockAwareScrollTop (일반) / computeMathCenterScrollTop (수식 클릭)
   - 실제 스크롤 실행: fastScrollTo (경합 취소 포함)
   ═══════════════════════════════════════════════════════════════════ */

/* ─── 애니메이션 세대 관리 ───────────────────────────────────────────
   fastScrollTo는 rAF 루프이므로, 취소 장치가 없으면 두 호출이 겹칠 때
   프레임마다 서로 다른 보간값을 써서 지터가 생긴다. 컨테이너별 세대
   카운터로 이전 루프를 무효화한다. (Phase 56 D14) */
const scrollGen = new WeakMap<HTMLElement, number>();

/** 빠른 부드러운 스크롤 (기본 smooth는 너무 느려 멀미 유발).
 *  같은 컨테이너에 대한 새 호출은 이전 애니메이션을 즉시 무효화한다. */
export function fastScrollTo(container: HTMLElement, top: number, duration = 220) {
  const gen = (scrollGen.get(container) ?? 0) + 1;
  scrollGen.set(container, gen);

  const start = container.scrollTop;
  const delta = Math.max(0, top) - start;
  // 목표가 현재 위치와 같으면 멈춘다 (위에서 이전 루프는 이미 무효화됨)
  if (Math.abs(delta) < 1) return;

  const startTime = performance.now();
  // easeOutCubic: 빠르게 출발해 부드럽게 정착
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    if (scrollGen.get(container) !== gen) return;   // 새 호출이 왔으면 이 루프는 중단
    const t = Math.min(1, (now - startTime) / duration);
    container.scrollTop = start + delta * ease(t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ─── 블록 상단 가시성을 보장하는 스크롤 타깃 계산 ───────────────
   커서를 세로 중앙에 두되, "활성 블록의 상단이 패널 밖으로 밀려나지 않도록"
   상단 가시성을 최우선 보장한다.
   - center: 이상적 중앙 정렬값
   - topVisibleMax: 이 값을 넘겨 스크롤하면 블록 상단이 가려짐 → 상한
   - caretVisibleMin: 이 값보다 작으면 커서가 패널 아래로 넘침 → 하한
   우선순위: (1) 블록 상단 가시성 → (2) 커서 가시성.
   블록이 뷰포트보다 커서 둘을 동시에 만족 못하면 커서 가시성을 택함(깊은 편집 정상 동작).
   첫 블록은 topVisibleMax≈0 이므로 항상 scrollTop 0 으로 수렴 → 상단이 절대 가려지지 않음.
   ⚠️ 편집창의 "일반" 자동 스크롤은 반드시 이 함수를 거칠 것 — 중앙 정렬 버그 재발 방지의 단일 지점.
   예외 2종(각각 사유가 코드에 명기됨):
     ① 수식 클릭 대칭 정렬 → computeMathCenterScrollTop
     ② typewriter 스크롤 → 타자 중 블록 상단 가시성은 요구사항이 아님 */
export function computeBlockAwareScrollTop(
  container: HTMLElement,
  blockEl: HTMLElement,
  cursorViewportTop: number,
): number {
  const containerRect = container.getBoundingClientRect();
  const blockRect = blockEl.getBoundingClientRect();
  const blockTop = blockRect.top - containerRect.top + container.scrollTop;
  const cursorRelativeTop = cursorViewportTop - containerRect.top + container.scrollTop;
  const height = containerRect.height;

  const center = cursorRelativeTop - height / 2;
  const topVisibleMax = blockTop - 8;                         // 상단 8px 여백 유지
  const caretVisibleMin = cursorRelativeTop - (height - 60);  // 커서 하단 60px 여백 유지

  let target = Math.min(center, topVisibleMax);  // 블록 상단 가시성 우선
  target = Math.max(target, caretVisibleMin);    // 그 다음 커서 가시성
  return target;
}

/* ─── 수식 클릭 전용 타깃 계산 (Phase 56 D5‴) ─────────────────────
   수식 클릭의 목적은 "편집창과 미리보기에서 같은 수식이 같은 높이에 오는 것"(대칭)이다.
   그래서 중앙 정렬을 우선하되, 대상 블록이 패널 안에 들어올 때는 블록 상단 가시성을
   지켜 computeBlockAwareScrollTop 과 감각을 맞춘다. 블록이 패널보다 크면(깊은 수식)
   상단 클램프를 포기하고 중앙을 택한다 — 그래야 양쪽 패널이 같은 지점을 가리킨다.
   편집창(커서 좌표)과 미리보기(.katex 요소)가 같은 규칙을 쓰도록 rect만 받는다. */
export function computeMathCenterScrollTop(
  containerRect: DOMRect,
  containerScrollTop: number,
  blockRect: DOMRect,
  targetViewportTop: number,
): number {
  const blockTop = blockRect.top - containerRect.top + containerScrollTop;
  const targetRel = targetViewportTop - containerRect.top + containerScrollTop;
  const center = targetRel - containerRect.height / 2;
  return blockRect.height <= containerRect.height
    ? Math.min(center, blockTop - 8)
    : center;
}
