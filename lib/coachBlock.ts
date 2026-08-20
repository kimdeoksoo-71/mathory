/* ═══════════════════════════════════════════════════════════════
   Phase 59a — 코칭(coaching) 블록

   Phase 59가 세운 두 기획 의도 중 남은 하나(signaling)의 구현이다.
   GitHub alert의 시각 문법(왼쪽 색 바 + 아이콘 + 라벨 어절)을 가져오되,
   `> [!IMPORTANT]` 인라인 문법은 지원하지 않는다 — 이 앱은 블록이 편집 단위이므로
   **타입이 의미를 나른다**. raw_text에는 본문만 들어가고 라벨은 렌더 시 붙는다
   (경우 블록의 번호와 같은 방침: 저장은 내용만, 표시는 파생).

   ⚠ 강조 체계의 네 축 중 '신호'를 담당한다. 나머지 셋과 섞지 말 것:
       위치 = 들여쓰기 블록(callout) · 색/굵기 = 인라인 `**` ·
       요약 = '요약에 넣기' 스위치 · **신호 = 코칭 블록**
   ═══════════════════════════════════════════════════════════════ */

/** 라벨 어절은 영문 그대로 쓴다 — GitHub alert의 시각 문법을 통째로 가져온 것이라
 *  어절도 원본을 유지해야 학습된 의미가 그대로 전달된다 (v4 Q2). */
export const COACH_LABELS: Record<string, string> = {
  coach_important: 'Important',
  coach_caution: 'Caution',
};

export function isCoachBlock(type: string): boolean {
  return type === 'coach_important' || type === 'coach_caution';
}

/** 렌더 사이트가 최상위 블록 요소에 붙일 className.
 *  ⚠ 색은 `.coach-important`/`.coach-caution`이 --coach-accent를 세우고
 *    `.coach-block`이 그것을 소비한다 — 두 클래스가 **같은 요소**에 있어야 한다. */
export function coachClassName(type: string): string {
  return `coach-block ${type === 'coach_caution' ? 'coach-caution' : 'coach-important'}`;
}
