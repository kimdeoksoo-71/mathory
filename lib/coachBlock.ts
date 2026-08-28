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

/** 라벨 어절은 'Tip' 하나다 (개선묶음 M2 G · E-M2-4).
 *
 *  ⚠ Phase 59a v4 Q2의 "라벨 어절은 영문 원본(Important/Caution)을 유지한다"는 결정을
 *    **여기서 번복한다**. 근거: 그 결정의 전제는 "GitHub alert의 어휘 **체계**를 통째로
 *    가져온다"였는데, 종류가 1개로 줄면 Important↔Caution의 대비가 사라져 체계 자체가
 *    소멸한다. 대비가 없는 자리에 남은 영문 어절은 관례가 아니라 그냥 낯선 낱말이다.
 *  ⚠ 타입 id는 2종 그대로 둔다(E-M2-4, 마이그레이션 0). 표시만 통일한다 —
 *    레거시 coach_caution 블록은 EditorView의 normalizeBlockType이 편집 시점에
 *    coach_important로 정규화한다(math_block·bullet과 같은 전례). */
export const COACH_LABELS: Record<string, string> = {
  coach_important: 'Tip',
  coach_caution: 'Tip',
};

export function isCoachBlock(type: string): boolean {
  return type === 'coach_important' || type === 'coach_caution';
}

/** 렌더 사이트가 최상위 블록 요소에 붙일 className.
 *  ⚠ 색은 `.coach-important`가 --coach-accent를 세우고 `.coach-block`이 그것을
 *    소비한다 — 두 클래스가 **같은 요소**에 있어야 한다.
 *  ⚠ 개선묶음 M2: 타입과 무관하게 항상 `coach-important`(보라 #6639ba)를 낸다.
 *    `.coach-caution` 규칙과 --coach-caution 토큰은 globals.css에서 삭제했다. */
export function coachClassName(_type: string): string {
  return 'coach-block coach-important';
}
