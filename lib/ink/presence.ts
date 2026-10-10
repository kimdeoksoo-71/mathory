/**
 * Phase 69 D8·D9 — 데스크톱 편집창 준비 상태(presence) 판정. 순수 모듈(**import 0** · `npm run test:ink`).
 *
 * 데스크톱 `EditorView`가 `users/{uid}/ink_state/presence`에 `{ canInsert, reason, label, updatedAt }`을 쓰고,
 * iPad `/ink`가 읽어 상단 바 상태 칸에 보인다. **삽입 가능 판정은 데스크톱이 한다**(`TEXT_BASED_TYPES`는
 * EditorView 지역 상수이고 접힌 블록은 텍스트여도 CM이 없다 — iPad에 사본을 만들지 않는다).
 *
 * ⚠ 만료 150초: Chrome은 숨김 5분 뒤 반복 타이머를 분당 1회로 묶는다 — 45초 heartbeat는 실효 60초,
 *   만료는 그 두 배 여유. 오판해도 안내 문구에만 영향(쓰기는 막지 않는다).
 */

export const PRESENCE_HEARTBEAT_MS = 45_000;
export const PRESENCE_STALE_MS = 150_000;
/** iPad가 스냅샷 없이도 만료를 다시 보는 주기(스냅샷은 바뀔 때만 온다) */
export const PRESENCE_RECHECK_MS = 10_000;
/** 데스크톱이 블록 이동마다 쓰지 않도록 */
export const PRESENCE_DEBOUNCE_MS = 1_000;

export type PresenceReason = 'no-block' | 'not-text' | 'collapsed';

export interface PresenceDoc {
  canInsert?: boolean;
  reason?: PresenceReason;
  label?: string;
  /** Firestore Timestamp → ms. 아직 서버 시각이 없으면(null) 신뢰하지 않는다 */
  updatedAtMs?: number | null;
}

export type PresenceStatus =
  | { kind: 'none' }
  | { kind: 'stale' }
  | { kind: 'blocked'; reason: PresenceReason }
  | { kind: 'ok'; label: string };

export function presenceStatus(p: PresenceDoc | null | undefined, nowMs: number): PresenceStatus {
  if (!p) return { kind: 'none' };
  if (p.updatedAtMs == null) return { kind: 'stale' };
  if (nowMs - p.updatedAtMs > PRESENCE_STALE_MS) return { kind: 'stale' };
  if (!p.canInsert) return { kind: 'blocked', reason: p.reason ?? 'no-block' };
  return { kind: 'ok', label: p.label ?? '' };
}

/** 상단 바 상태 칸 문구·점 색 갈래(점 색: ok = --accent-success · warn = --mathory-red · off = --text-muted) */
export function presenceMessage(st: PresenceStatus): { tone: 'ok' | 'warn' | 'off'; text: string } {
  switch (st.kind) {
    case 'ok':
      return { tone: 'ok', text: st.label ? `데스크톱 편집창 → ${st.label}` : '데스크톱 편집창 준비됨' };
    case 'blocked':
      return {
        tone: 'warn',
        text: st.reason === 'collapsed' ? '데스크톱에서 접힌 블록을 펼쳐 주세요' : '데스크톱에서 텍스트 블록을 선택해 주세요',
      };
    default:
      return { tone: 'off', text: '데스크톱 편집창이 열려 있지 않습니다 — 보내 두면 열 때 나타납니다' };
  }
}

/** 데스크톱이 싣는 삽입 위치 라벨 */
export function presenceLabel(title: string, tabLabel: string, blockIndex: number): string {
  return `${title.trim() || '제목 없음'} · ${tabLabel} · 블록 ${blockIndex + 1}`;
}
