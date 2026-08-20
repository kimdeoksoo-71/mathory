/* ═══════════════════════════════════════════════════════════════
   Phase 58 P2 — key sentence 톤 시스템 판정 로직
   렌더 사이트 5곳(EditorView 미리보기 · ProblemView · FolderView ·
   ProblemTabContent · PrintableContent)이 공유한다.

   설계 요지 (Phase 58 D9·D13 + Phase 59a 기본화):
   - 강조 마커는 인라인 `**` **하나뿐**이다. 들여쓰기(callout) 블록은 위치만 담당하는
     레이아웃 블록이고 톤과 무관하므로 판정에 넣지 않는다 (Phase 59a: 구 '강조문').
   - ⚠ Phase 59a: **마커 유무 판정을 폐기했다.** Phase 58의 D4는 "`**`가 하나도 없는
     풀이는 톤을 발동시키지 않는다(opt-in)"였으나, 그 결과 문항마다 인상이 달라졌고
     레거시 `**Case n.**` 라벨의 `**`가 강조로 오인돼 톤이 제멋대로 켜졌다.
     이제 풀이 탭이면 언제나 톤이 걸린다 → `solutionHasKey`와 정규식 2종이 사라졌다.
   - 남은 판정 축은 **탭 하나**뿐이다(D9).
   ═══════════════════════════════════════════════════════════════ */

/**
 * 이 탭이 톤 시스템 스코프에 드는가 (D9).
 * 탭은 동적이므로(question · solution · extra_N) "문제 탭만 제외"로 정의한다.
 */
export function isToneScoped(tabId: string): boolean {
  return tabId !== 'question';
}

/**
 * 렌더 사이트가 컨테이너에 붙일 className 조각을 만든다.
 * 5곳이 같은 문자열을 쓰도록 여기서 한 번에 결정한다.
 *
 * ⚠ Phase 59a로 한 줄이 됐지만 함수는 유지한다 — 5개 사이트가 같은 문자열을 쓰게
 *   하는 단일 출처라는 존재 이유는 그대로다. 사이트에 리터럴을 흩뿌리지 말 것.
 *
 * @param tabId 탭 id (question / solution / extra_N)
 */
export function toneClass(tabId: string): string {
  return isToneScoped(tabId) ? 'solution-tone' : '';
}
