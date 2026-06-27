// Phase 49: 좌측 공유 트리 스코프 (AppShell ↔ Sidebar/ShareTree 공용, 순환 import 방지)
// Phase 52(2단계, F8): sent-web → bazaar 승격. filter로 전역 피드/내 게시물 구분.

export type ShareScope =
  | { kind: 'received-all' }
  | { kind: 'received-by'; uid: string }
  | { kind: 'bazaar'; filter: 'all' | 'mine' }
  | { kind: 'sent-by'; uid: string };

export function shareScopeKey(s: ShareScope): string {
  if (s.kind === 'received-by' || s.kind === 'sent-by') return `${s.kind}:${s.uid}`;
  if (s.kind === 'bazaar') return `bazaar:${s.filter}`;
  return s.kind;
}
