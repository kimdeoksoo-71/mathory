/**
 * M9 D8′ — 우측 패널(agent·댓글·버전 드로어) 상태의 원천. 모듈 싱글턴 + useSyncExternalStore.
 *
 * 취지: ProblemView ↔ EditorView 전환은 서브트리를 통째로 언마운트한다(AppShell 형제 조건 렌더). agent의
 * fetch·저장은 원래 살아남지만(AbortController 0 · addComment가 클로저에서 저장), 열림 상태·선택 세션·모델 칩·
 * 진행 표시·입력 초안·스크롤·폭이 컴포넌트 state라 전부 초기화됐다. 패널을 AppShell로 끌어올리는 대신
 * **그 상태만** 여기로 올린다(P10 — 호이스팅은 콜백 5종·절대배치·밀기 산식을 건드리는 큰 수술).
 *
 * 규약(CLAUDE.md M9 절):
 *  - 갱신은 **함수형**(`updatePanel(key, fn)`) — 여러 모델이 Promise.allSettled로 병렬로 pending을 고친다.
 *    `fn`은 **현재 저장된 값**을 받는다(React 스냅샷이 아니다) → 언마운트 뒤 도착한 응답도 유실 없이 반영된다.
 *  - 알림 대상(PanelEntry)과 **passive**(초안·스크롤·캐시)를 가른다. 초안을 알림형에 두면 키 입력마다 패널 전체가
 *    리렌더된다(61c "선택 위에 얹힌 UI에서 리렌더 자체가 버그").
 *  - 키 = `${uid}:${problemId}` — 계정 전환 시 이전 사용자의 캐시·초안이 보이지 않게.
 *  - `replyingTo`·`editingId`·`freshAiCommentId`·세션 생성/개명 입력은 **복원하지 않는다**(D17: 답글 분기는 AI를 안 부른다).
 *  - localStorage 금지 — 수명은 앱 세션(useDrawerResize 규약과 같다).
 * ⚠ 런타임 import는 React(useSyncExternalStore) 하나.
 */
import { useSyncExternalStore } from 'react';
import type { ProblemComment, DiscussionSession, UserProfile, VerifyKind } from '../types/problem';

export interface DiscussRequestContext {
  problemContent: string;
  currentTabContent?: string;
  currentTabLabel?: string;
  discussionHistory: Array<{ role: 'human' | 'ai'; nickname: string; content: string }>;
  participantNicknames: string[];
  currentMessage: string;
  /** Phase 61f — 필드별 자리표시자(⟦그림⟧)와 정렬된 그림 URL (서버 DiscussImages와 동일 계약) */
  images?: {
    problem: (string | null)[];
    tab: (string | null)[];
    history: (string | null)[][];
    message: (string | null)[];
  };
}

export interface PendingAI {
  modelId: string;
  nickname: string;
  emoji: string;
  provider?: string;
  /** 이 호출이 시작된 세션 ID — 다른 세션으로 전환해도 알림은 원래 세션에서만 보여야 함 */
  sessionId: string;
  error?: string;
  /** 재시도 시 사용할 원본 호출 컨텍스트 */
  retryContext?: DiscussRequestContext;
  /** Phase 61b: 'verify'면 aiModels에 없는 합성 항목이다 — 재시도 경로가 다르다 */
  kind?: 'discuss' | 'verify';
  /** Phase 61b: 검증 재시도용 */
  verifyKind?: VerifyKind;
  /** Phase 61b: 여러 모델이 함께 도는 작업의 아이콘들(검증 = 1차 Gemini → 2차 Claude) */
  providers?: string[];
}

export type PanelMode = 'comments' | 'agent' | null;

/** 알림 대상 — 바뀌면 구독자가 리렌더된다 */
export interface PanelEntry {
  mode: PanelMode;
  sessionId: string;
  modelIds: string[];
  pending: PendingAI[];
  inputHeight: number;
  versionOpen: boolean;
}

/** 알림 없음 — 키 입력·스크롤마다 리렌더하지 않는다 */
export interface PanelPassive {
  draft: { comments: string; agent: string };
  scrollTop: { comments: number | null; agent: number | null };
  cache: {
    comments: ProblemComment[];
    sessions: DiscussionSession[];
    profiles: Record<string, UserProfile>;
    myProfile: UserProfile | null;
  } | null;
}

const DEFAULT_ENTRY: PanelEntry = Object.freeze({
  mode: null, sessionId: '', modelIds: [], pending: [], inputHeight: 120, versionOpen: false,
}) as PanelEntry;

const entries = new Map<string, PanelEntry>();
const passives = new Map<string, PanelPassive>();
const listeners = new Set<() => void>();
/** cache를 가진 키의 최근 사용 순서(LRU 20, D13) */
const cacheOrder: string[] = [];
const CACHE_LIMIT = 20;

export const panelKey = (uid: string, problemId: string) => `${uid}:${problemId}`;

export function readPanel(key: string): PanelEntry {
  return entries.get(key) ?? DEFAULT_ENTRY;
}

/** 함수형 갱신 — `fn`은 저장된 현재 값을 받는다. 바뀐 필드가 없으면 알리지 않는다 */
export function updatePanel(key: string, fn: (s: PanelEntry) => Partial<PanelEntry>): void {
  if (!key) return;
  const cur = readPanel(key);
  const patch = fn(cur);
  let changed = false;
  for (const k of Object.keys(patch) as (keyof PanelEntry)[]) {
    if (patch[k] !== cur[k]) { changed = true; break; }
  }
  if (!changed) return;
  entries.set(key, { ...cur, ...patch });
  listeners.forEach((l) => l());
}

export function readPassive(key: string): PanelPassive {
  let p = passives.get(key);
  if (!p) {
    p = { draft: { comments: '', agent: '' }, scrollTop: { comments: null, agent: null }, cache: null };
    passives.set(key, p);
  }
  return p;
}

/** 알림 없는 쓰기(초안·스크롤·캐시) */
export function writePassive(key: string, patch: Partial<PanelPassive>): void {
  if (!key) return;
  const p = readPassive(key);
  Object.assign(p, patch);
  if (patch.cache) {
    const i = cacheOrder.indexOf(key);
    if (i !== -1) cacheOrder.splice(i, 1);
    cacheOrder.push(key);
    while (cacheOrder.length > CACHE_LIMIT) {
      const old = cacheOrder.shift()!;
      const op = passives.get(old);
      if (op) op.cache = null;
    }
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** 스냅샷은 같은 키·같은 값이면 같은 객체(useSyncExternalStore 안정성) — updatePanel이 바뀔 때만 새 객체를 만든다 */
export function usePanel(key: string): PanelEntry {
  return useSyncExternalStore(subscribe, () => readPanel(key), () => DEFAULT_ENTRY);
}

/* ─── 폭(전역 1값, Q6) — 두 뷰의 댓글·agent 패널 규격이 같다(min 360 · max 0.9vw · 기본 420) ─── */
let panelWidth: number | null = null;
export const getPanelWidth = () => panelWidth;
export const setPanelWidth = (w: number) => { panelWidth = w; };

/** Q5 — 같은 문항의 ProblemView↔EditorView 전환 밖으로 나가면 열림 상태를 닫는다(AppShell이 부른다) */
export function clearPanelMode(key: string): void {
  updatePanel(key, () => ({ mode: null, versionOpen: false }));
}
