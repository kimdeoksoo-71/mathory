/* ═══════════════════════════════════════════════════════════════
   Phase 58 P2 — key sentence 톤 시스템 판정 로직
   렌더 사이트 5곳(EditorView 미리보기 · ProblemView · FolderView ·
   ProblemTabContent · PrintableContent)이 공유한다.

   설계 요지 (v4 최종 D4·D9·D13):
   - key 마커는 인라인 `**` **하나뿐**이다. 강조문(callout) 블록은 들여쓰기로
     위치를 강조하는 레이아웃 블록이고 톤과 무관하므로 판정에 넣지 않는다.
   - 풀이에 `**`가 하나도 없으면 톤 낮추기를 아예 발동시키지 않는다(opt-in).
     → 마커 없는 기존 문항은 시각 변화 0.
   - 판정 단위는 블록이 아니라 **탭 전체(블록 배열)**다. 블록 3에만 key가 있어도
     블록 1~5가 전부 흐려져야 대비가 성립한다.
   ═══════════════════════════════════════════════════════════════ */

/**
 * CommonMark 유효 강조(`**...**`)의 근사.
 * - 여는 `**` 뒤와 닫는 `**` 앞이 비공백이어야 한다(`** text **`는 강조가 아니다).
 * - lookbehind를 쓰지 않는다 — 구형 Safari 대비.
 * - 근사로 충분하다: 오탐의 최악 결과가 "톤 시스템이 켜짐"이라 파괴적이지 않다.
 */
const KEY_STRONG_RE = /\*\*(?=\S)[\s\S]*?\S\*\*/;

/**
 * 이 탭의 블록 배열에 key 마커가 하나라도 있는가.
 *
 * ⚠ 블록 타입으로 거르지 않는다. `TEXT_BASED_TYPES`는 EditorView.tsx의 모듈 로컬
 *   상수라 export되지 않고, 사본을 두면 "블록 타입 상수 6종은 전부 EditorView 상단"
 *   규칙이 깨진다. 타입 게이트 없이 raw_text만 봐도 실질 오탐이 없다
 *   (image/svg/ggb의 raw_text는 URL·`<img src>`라 `**`가 등장하지 않는다).
 */
export function solutionHasKey(blocks: { raw_text: string }[]): boolean {
  return blocks.some((b) => KEY_STRONG_RE.test(b.raw_text));
}

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
 * @param tabId  탭 id (question / solution / extra_N)
 * @param blocks 그 탭의 블록 배열
 */
export function toneClass(tabId: string, blocks: { raw_text: string }[]): string {
  if (!isToneScoped(tabId)) return '';
  return solutionHasKey(blocks) ? 'solution-tone has-key' : 'solution-tone';
}
