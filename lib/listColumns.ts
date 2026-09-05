/**
 * Phase 63 S4(D4·D6) — 리스트 칼럼 레지스트리 · prefs 검증 · 정렬 규칙.
 *
 * ⚠ import 0 규약 — `npm run test:list`가 이 파일 하나를 tsc로 단독 컴파일한다(61a 선례).
 *   타입도 전부 로컬 정의다. 값 추출(Problem 필드 접근)은 ListView가 하고, 여기는
 *   순수 규칙(순서·검증·서열)만 산다.
 *
 * 스키마 원칙(D6): "모르는 id는 무시, 새 id는 뒤에 붙임" — 후속 칼럼(해시태그·배점·대단원)이
 * 저장된 prefs를 깨지 않는다.
 */

export type ListSortDir = 'asc' | 'desc';
export interface ListSort { key: string; dir: ListSortDir }

export interface ListColumnDef {
  id: string;
  label: string;
  /** fixed = 위치 고정(제목 1열·수정일 마지막), optional = 보이기/순서 조절 대상 */
  kind: 'fixed' | 'optional';
}

/** 레지스트리 — optional의 나열 순서가 기본 표시 순서다 */
export const LIST_COLUMNS: ListColumnDef[] = [
  { id: 'title', label: '제목', kind: 'fixed' },
  { id: 'blockchain', label: '원본인증', kind: 'optional' },
  { id: 'verify_problem', label: '검증(문제)', kind: 'optional' },
  { id: 'verify_solution', label: '검증(풀이)', kind: 'optional' },
  { id: 'agent', label: 'Agent', kind: 'optional' },
  { id: 'comments', label: '댓글', kind: 'optional' },
  { id: 'updated', label: '수정일', kind: 'fixed' },
];

export const OPTIONAL_COLUMN_IDS: string[] = LIST_COLUMNS.filter((c) => c.kind === 'optional').map((c) => c.id);

/** mode 전용 고정 칼럼(received=owner · sent=perm) — 레지스트리 밖, 위치는 updated 앞 */
export const MODE_COLUMN_LABELS: Record<string, string> = { owner: '소유자', perm: '권한' };

export function columnLabel(id: string): string {
  return LIST_COLUMNS.find((c) => c.id === id)?.label ?? MODE_COLUMN_LABELS[id] ?? id;
}

/** 폭 조절 대상(D7) — 제목(1fr)은 직접 조절하지 않는다. mode 칼럼은 고정 px */
export const WIDTH_ADJUSTABLE_IDS: string[] = [...OPTIONAL_COLUMN_IDS, 'updated'];
export const MIN_COL_WIDTH = 40;

const SORTABLE_IDS = new Set(['title', 'updated', ...OPTIONAL_COLUMN_IDS]);

export interface ListPrefs {
  v: 1;
  /** 숨긴 optional 칼럼 id */
  hidden: string[];
  /** optional 칼럼 표시 순서(고정 칼럼 제외) */
  order: string[];
  /** 칼럼 id → 사용자 지정 폭 px (없으면 자동폭 = max-content) */
  widths: Record<string, number>;
  sort: ListSort;
}

export function defaultPrefs(opts?: { trash?: boolean }): ListPrefs {
  return {
    v: 1,
    hidden: [],
    order: [...OPTIONAL_COLUMN_IDS],
    widths: {},
    // D41 — 휴지통만 수정일 내림차순("최근 버린 순" — moveToTrash만 updated_at을 찍는다, Q14)
    sort: opts?.trash ? { key: 'updated', dir: 'desc' } : { key: 'title', dir: 'asc' },
  };
}

/** localStorage에서 읽은 값을 레지스트리로 검증 — 실패·불명은 조용히 기본값으로 */
export function sanitizePrefs(raw: unknown, opts?: { trash?: boolean }): ListPrefs {
  const d = defaultPrefs(opts);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return d;

  const known = new Set(OPTIONAL_COLUMN_IDS);
  const hidden = Array.isArray(r.hidden)
    ? r.hidden.filter((x): x is string => typeof x === 'string' && known.has(x))
    : [];
  const orderIn = Array.isArray(r.order)
    ? r.order.filter((x): x is string => typeof x === 'string' && known.has(x))
    : [];
  // 새 id는 뒤에 붙임 — 저장 당시 없던 칼럼이 사라지지 않는다
  const order = [...orderIn, ...OPTIONAL_COLUMN_IDS.filter((id) => !orderIn.includes(id))];

  const widths: Record<string, number> = {};
  if (r.widths && typeof r.widths === 'object') {
    const adjustable = new Set(WIDTH_ADJUSTABLE_IDS);
    for (const [k, v] of Object.entries(r.widths as Record<string, unknown>)) {
      if (adjustable.has(k) && typeof v === 'number' && Number.isFinite(v)) {
        widths[k] = Math.max(MIN_COL_WIDTH, Math.round(v));
      }
    }
  }

  let sort = d.sort;
  const s = r.sort as { key?: unknown; dir?: unknown } | undefined;
  if (s && typeof s.key === 'string' && SORTABLE_IDS.has(s.key) && (s.dir === 'asc' || s.dir === 'desc')) {
    sort = { key: s.key, dir: s.dir };
  }

  return { v: 1, hidden, order, widths, sort };
}

/** 헤더 클릭 토글 — 같은 키면 방향 반전, 새 키면 기본 방향(제목만 오름차순) */
export function toggledListSort(prev: ListSort, key: string): ListSort {
  if (!SORTABLE_IDS.has(key)) return prev;
  if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'title' ? 'asc' : 'desc' };
}

/** 팝오버 ▲▼ — optional order 안에서 한 칸 이동(경계에서 무시) */
export function movedOrder(order: string[], id: string, delta: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= order.length) return order;
  const next = [...order];
  next[i] = next[j];
  next[j] = id;
  return next;
}

/** 표시 칼럼 나열(제목 → optional(순서·숨김 적용) → mode 칼럼 → 수정일) */
export function visibleColumns(prefs: ListPrefs, mode: string): string[] {
  const opts = prefs.order.filter((id) => !prefs.hidden.includes(id));
  const modeCols = mode === 'received' ? ['owner'] : mode === 'sent' ? ['perm'] : [];
  return ['title', ...opts, ...modeCols, 'updated'];
}

/** mode 칼럼 고정 폭(현행 값 유지) */
const MODE_COLUMN_TRACK: Record<string, string> = { owner: '120px', perm: '64px' };

/**
 * grid-template-columns 문자열(D5).
 * 좌우 가장자리는 2px 스페이서 트랙 — columnGap 12와 합쳐 기존 좌우 인셋 14를 만든다
 * (subgrid에 컨테이너 패딩을 주면 첫·끝 트랙이 부모와 어긋난다 — 스페이서가 정답).
 * checkbox(D16 — 다중 선택 열 24px)는 좌 스페이서 다음. 마지막 28px = ⋮/칼럼 설정 트랙.
 */
export function buildGridTemplate(visible: string[], widths: Record<string, number>, checkbox = false): string {
  const tracks = visible.map((id) => {
    if (id === 'title') return 'minmax(0, 1fr)';
    if (widths[id]) return `${widths[id]}px`;
    return MODE_COLUMN_TRACK[id] ?? 'max-content';
  });
  return ['2px', ...(checkbox ? ['24px'] : []), ...tracks, '28px', '2px'].join(' ');
}

/* ═══ 정렬 서열 ═══ */

/** 검증 서열: 없음 0 < skip < ok < check < fail — stale은 같은 verdict의 한 단 아래(D4).
 *  ⚠ verdict 어휘의 소유자는 VERIFY_VERDICT_META(VerifyBadge)다 — import 0 규약상 여기
 *  순서 배열을 따로 적었고, 어휘 일치는 검수가 대조한다(어휘 추가 시 양쪽 함께). */
export function verifyRank(verdict?: string, stale?: boolean): number {
  const base = verdict === 'skip' ? 1 : verdict === 'ok' ? 2 : verdict === 'check' ? 3 : verdict === 'fail' ? 4 : 0;
  if (base === 0) return 0;
  return base * 2 - (stale ? 1 : 0);
}

/** 원본인증 서열: 없음 0 < 인증 후 수정됨 1 < 인증 2 (BlockchainBadge 판정식과 동일) */
export function blockchainRank(hasTx: boolean, modified: boolean): number {
  return hasTx ? (modified ? 1 : 2) : 0;
}
