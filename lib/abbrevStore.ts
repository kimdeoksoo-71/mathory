/**
 * Phase 68b 후속(2026-10-09 덕수 검수 21) — 수식 단축어 맵의 **모듈 공유 스토어**.
 *
 * 편집창(`MarkdownEditor`)은 `useSnippets().abbrevMap`을 prop으로 받는다. 댓글·agent 입력창(`LatexInputEditor`)은
 * 그 훅이 없는 화면(문항 보기·공개 페이지)에서도 열리므로, 여기서 **최신 맵을 읽는다**:
 *  - `useSnippets`가 목록을 불러올 때마다 `publishAbbrevs`로 올린다(편집창에서 약어를 고치면 댓글 쪽도 곧바로 같아진다)
 *  - 편집창을 한 번도 안 연 세션이면 `primeAbbrevs(uid)`가 **사용자당 1회** 목록을 읽어 채운다
 *  - 로그인 전·실패면 기본 8종(`DEFAULT_ABBREVS`)
 * ⚠ prime의 응답은 같은 uid로 이미 publish된 것이 있으면 **버린다** — 편집창이 방금 올린 더 새 맵을 덮지 않게.
 */
import { DEFAULT_ABBREVS } from './mathInput';
import { listSnippets } from './snippets';
import type { MathSnippet } from '../types/snippet';

/** 기본 8종 위에 사용자 abbrev를 덮는다(같은 약어면 사용자 우선 — Phase 68 D5). `useSnippets`와 공용 */
export function buildAbbrevMap(snippets: readonly MathSnippet[]): Record<string, string> {
  const out: Record<string, string> = { ...DEFAULT_ABBREVS };
  for (const s of snippets) if (s.kind === 'abbrev' && s.abbrev) out[s.abbrev] = s.content;
  return out;
}

let current: { uid: string | null; map: Record<string, string> } = { uid: null, map: { ...DEFAULT_ABBREVS } };
const inflight = new Set<string>();

export function publishAbbrevs(uid: string | null, map: Record<string, string>): void {
  current = { uid, map };
}

/** Tab 핸들러가 **누를 때마다** 읽는다(클로저에 맵을 잡아 두지 않는다 — 나중에 도착한 목록이 반영되게) */
export function getAbbrevs(): Record<string, string> {
  return current.map;
}

export function primeAbbrevs(uid: string | null): void {
  if (!uid) {
    if (current.uid !== null) current = { uid: null, map: { ...DEFAULT_ABBREVS } };
    return;
  }
  if (current.uid === uid || inflight.has(uid)) return;
  inflight.add(uid);
  listSnippets(uid)
    .then((list) => { if (current.uid !== uid) publishAbbrevs(uid, buildAbbrevMap(list)); })
    .catch(() => { /* 기본 8종으로 남는다 — 단축어는 편의 기능이라 실패를 알리지 않는다 */ })
    .finally(() => inflight.delete(uid));
}
