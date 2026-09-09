/* ═══════════════════════════════════════════════════════════════
   Phase 64 D8 — 딥링크 파싱 (import 0 · npm run test:deeplink)

   Phase 52(D5)/53(E)의 `?view=bazaar | p&id= | shared&id=` 규약을 AppShell에서
   추출했다 — AppShell(데스크톱)과 PhoneApp(폰)이 같은 함수를 읽는다(사본 금지).
   ⚠ 처리 시점 규약은 호출부 소유: 둘 다 로그인 후에만 1회 소비하고
     window.history.replaceState('/')로 지운다(v2 S-10 — 비로그인 딥링크는 무동작이 현행).
   ═══════════════════════════════════════════════════════════════ */

export type DeepLink =
  | { view: 'bazaar' }
  | { view: 'p'; id: string }
  | { view: 'shared'; id: string };

/** location.search('?view=…')를 파싱한다. 모르는 값·id 누락은 null. */
export function parseDeepLink(search: string): DeepLink | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const v = params.get('view');
  const id = params.get('id');
  if (v === 'bazaar') return { view: 'bazaar' };
  if (v === 'p' && id) return { view: 'p', id };
  if (v === 'shared' && id) return { view: 'shared', id };
  return null;
}
