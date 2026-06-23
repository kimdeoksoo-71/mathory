// Phase 49: 좌측 공유 트리 스코프 (AppShell ↔ Sidebar/ShareTree 공용, 순환 import 방지)

export type ShareScope =
  | { kind: 'received-all' }
  | { kind: 'received-by'; uid: string }
  | { kind: 'sent-web' }
  | { kind: 'sent-by'; uid: string };

export function shareScopeKey(s: ShareScope): string {
  return s.kind === 'received-by' || s.kind === 'sent-by' ? `${s.kind}:${s.uid}` : s.kind;
}
