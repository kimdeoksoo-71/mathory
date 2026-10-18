/**
 * M10 E — agent(normal) 세션 이름 규칙 (import 0 · `npm run test:sessions`).
 *
 * `+ 새 토론`은 이름을 묻지 않고 곧바로 만든다: `새 토론` → `새 토론 2` → `새 토론 3` …(현재 목록 최댓값 + 1 —
 * 지운 번호는 재사용하지 않는다). 이름은 활성 알약을 다시 클릭해 바꾼다(CommentPanel `SessionTabBar`).
 *
 * ⚠ 예약 이름 `BATCH_SESSION_NAME`('일괄 검증')은 `lib/batchVerify.ts ensureBatchSession`이 **이름으로 찾아 재사용**한다 —
 *   자동 이름이 그것을 내면 일괄 리포트가 사용자 세션에 섞인다. 테스트가 고정한다. 댓글 세션 이름 '댓글'은 type이 달라 무관하지만 같이 배제한다.
 */

export const BATCH_SESSION_NAME = '일괄 검증';
export const AUTO_SESSION_BASE = '새 토론';

const AUTO_RE = /^새 토론(?: (\d+))?$/;

export function nextSessionName(existing: readonly string[]): string {
  let max = 0;
  for (const n of existing) {
    const m = AUTO_RE.exec(n.trim());
    if (m) max = Math.max(max, m[1] ? Number(m[1]) : 1);
  }
  return max === 0 ? AUTO_SESSION_BASE : `${AUTO_SESSION_BASE} ${max + 1}`;
}
