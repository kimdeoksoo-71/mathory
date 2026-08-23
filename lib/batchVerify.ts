/**
 * Phase 61d — 폴더 일괄 검증 오케스트레이터 (클라이언트)
 *
 * 61b의 `runVerifyFlow`를 **문항×종류 단위로 순차 호출**하는 루프. 서버·규칙·스키마 변경 0.
 * 배치가 61b와 다른 결과물을 만들면 안 된다 — **단건 검증과 결과물이 비트 단위로 같은 것이
 * 적합성의 기준**이다.
 *
 * ⚠️ **이 파일을 `lib/verify/`에 두지 말 것.** 그 폴더는 전부 import 0 순수 모듈이고
 *    `npm run test:batch`/`test:verify`가 tsc로 단독 컴파일한다. 이 파일은 firestore를 import한다.
 *    (판정 로직은 `lib/verify/batchPlan.ts`에 있다 — 그쪽이 테스트로 고정된다.)
 *
 * ⚠️ **검증 대상은 실행 시점 재로드본이다 (D61d-12).** 프리플라이트 로드본으로 검증하면,
 *    그 사이 다른 탭·기기에서 저장된 편집에 대해 배지는 "최신 ✓"인데 내용은 다른 상태가 남는다
 *    (`stale` 계산은 `handleSave` 경로에만 있어서, 검증 쓰기가 저장보다 뒤면 다시 돌 계기가 없다).
 *    프리플라이트 로드본은 **계획 표시(대상 k회·건너뜀 f회)에만** 쓴다.
 */

import type { Block, TabMeta, VerifyKind, VerifyReport } from '../types/problem';
import { getProblemWithBlocks } from './firestore';
import { createNormalSession, listSessions } from './discussion-sessions';
import { runVerifyFlow, verifyBlocksOf, verifyCharCountOf, type VerifyError, type VerifyUsage } from './verifyFlow';
import {
  PREFLIGHT_CONCURRENCY, isFatalStatus, nextFailureCount, preflightSkip, shouldAbort,
  type RowOutcome, type SkipReason,
} from './verify/batchPlan';

/** 배치 리포트가 쌓이는 agent 세션 이름. ⚠ 댓글 세션에 넣으면 공개 문항에서 비로그인까지 읽는다 */
export const BATCH_SESSION_NAME = '일괄 검증';

export interface BatchItem {
  problemId: string;
  title: string;
  /** 사용자가 선택 화면에서 고른 종류 (문항당 1~2개) */
  kinds: VerifyKind[];
}

export interface BatchRow {
  problemId: string;
  title: string;
  kind: VerifyKind;
  outcome: RowOutcome;
}

export type AbortCause = 'user' | 'fatal' | 'streak';

export interface BatchResult {
  rows: BatchRow[];
  usage: VerifyUsage;
  aborted?: AbortCause;
  /** 중단 사유 안내 문구 (aborted가 있을 때만) */
  abortMessage?: string;
}

export interface BatchCallbacks {
  /** 프리플라이트 종료 — 스킵이 확정된 전체 행 */
  onPlan?: (rows: BatchRow[]) => void;
  /** 한 행의 상태가 바뀔 때마다 */
  onRow?: (row: BatchRow) => void;
  /** 누적 usage가 늘 때마다 */
  onUsage?: (usage: VerifyUsage) => void;
}

const rowKey = (problemId: string, kind: VerifyKind) => `${problemId}:${kind}`;

/** 로드된 문항에서 프리플라이트 판정에 필요한 재료만 뽑는다 */
function skipOf(
  loaded: { authorUid?: string; tabBlocks: Record<string, Block[]>; tabLoadErrors?: Record<string, string> } | null,
  uid: string,
  kind: VerifyKind,
): SkipReason | null {
  return preflightSkip({
    kind,
    missing: !loaded,
    isOwner: !!loaded?.authorUid && loaded.authorUid === uid,
    tabLoadErrorCount: Object.keys(loaded?.tabLoadErrors || {}).length,
    questionBlockCount: verifyBlocksOf(loaded?.tabBlocks['question'] || []).length,
    solutionBlockCount: verifyBlocksOf(loaded?.tabBlocks['solution'] || []).length,
    chars: loaded ? verifyCharCountOf(loaded.tabBlocks, kind) : 0,
  });
}

async function loadSafe(problemId: string) {
  try {
    return await getProblemWithBlocks(problemId);
  } catch (e) {
    console.warn('[Phase61d] 문항 로드 실패:', problemId, e);
    return null;
  }
}

/** 동시 상한을 둔 map. ⚠ **읽기 전용**이다 — AI 루프는 완전 직렬이다(D61d-3) */
async function mapPooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * 배치 리포트가 쌓일 agent 세션. 같은 이름의 세션이 있으면 재사용한다.
 *
 * ⚠️ **`type:'normal'`이어야 한다.** 댓글 세션에 넣으면 `commentStream=true`가 되어 공개 문항에서
 *    비로그인 열람자까지 읽는다(`resolveCommentStream` → firestore.rules 댓글 read).
 * ⚠️ 호출 시점에 주의 — **실제로 돌 종류가 1개 이상일 때만** 부른다(W4). 전건 스킵 문항에
 *    빈 '일괄 검증' 세션이 생기면 세션 목록이 오염된다.
 */
async function ensureBatchSession(problemId: string, uid: string): Promise<string> {
  const sessions = await listSessions(problemId);
  const found = sessions.find((s) => s.type === 'normal' && s.name === BATCH_SESSION_NAME);
  if (found) return found.id;
  return createNormalSession(problemId, BATCH_SESSION_NAME, uid);
}

/**
 * 일괄 검증 실행.
 *
 * @param stopRef `current`가 true가 되면 **진행 중인 종류를 끝낸 뒤** 멈춘다.
 *   ⚠ in-flight abort 금지(D61d-5) — 1차(first) 비용을 이미 썼는데 2차(judge)를 끊으면
 *     61b D13′에 의해 리포트가 만들어지지 않아 그 비용이 통째로 버려진다.
 */
export async function runBatchVerify(args: {
  items: BatchItem[];
  uid: string;
  getIdToken: () => Promise<string>;
  buildMarkdown: (report: VerifyReport) => string;
  stopRef: { current: boolean };
  callbacks?: BatchCallbacks;
}): Promise<BatchResult> {
  const { items, uid, getIdToken, buildMarkdown, stopRef, callbacks } = args;

  /* ─── 행 테이블 (문항×종류) ─── */
  const rows: BatchRow[] = [];
  const index = new Map<string, BatchRow>();
  for (const it of items) {
    for (const kind of it.kinds) {
      const row: BatchRow = { problemId: it.problemId, title: it.title, kind, outcome: { state: 'pending' } };
      rows.push(row);
      index.set(rowKey(it.problemId, kind), row);
    }
  }
  const setOutcome = (problemId: string, kind: VerifyKind, outcome: RowOutcome) => {
    const row = index.get(rowKey(problemId, kind));
    if (!row) return;
    row.outcome = outcome;
    callbacks?.onRow?.({ ...row });
  };

  const usage: VerifyUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const addUsage = (u?: VerifyUsage) => {
    if (!u) return;
    usage.inputTokens += u.inputTokens || 0;
    usage.outputTokens += u.outputTokens || 0;
    usage.costUsd += u.costUsd || 0;
    callbacks?.onUsage?.({ ...usage });
  };

  /* ═══ ① 프리플라이트 — 표시용. AI 호출 0 (D2′) ═══ */
  await mapPooled(items, PREFLIGHT_CONCURRENCY, async (it) => {
    if (stopRef.current) return;
    const loaded = await loadSafe(it.problemId);
    for (const kind of it.kinds) {
      const reason = skipOf(loaded, uid, kind);
      if (reason) setOutcome(it.problemId, kind, { state: 'skipped', reason });
    }
  });
  callbacks?.onPlan?.(rows.map((r) => ({ ...r })));
  if (stopRef.current) return { rows, usage, aborted: 'user', abortMessage: '사용자가 중단했습니다' };

  /* ═══ ② 직렬 루프 ═══ */
  let streak = 0;

  for (const it of items) {
    if (stopRef.current) return { rows, usage, aborted: 'user', abortMessage: '사용자가 중단했습니다' };

    // 이 문항에서 아직 돌 것이 남아 있는가 (프리플라이트에서 전건 스킵이면 로드조차 하지 않는다)
    const pending = it.kinds.filter((k) => index.get(rowKey(it.problemId, k))?.outcome.state === 'pending');
    if (pending.length === 0) continue;

    /* ★ 실행 시점 재로드 + 재판정 (D61d-12·§3-14) — 프리플라이트 본으로 검증하지 않는다 */
    const fresh = await loadSafe(it.problemId);
    const runnable: VerifyKind[] = [];
    for (const kind of pending) {
      const reason = skipOf(fresh, uid, kind);
      if (reason) setOutcome(it.problemId, kind, { state: 'skipped', reason });
      else runnable.push(kind);
    }
    if (runnable.length === 0 || !fresh) continue;    // 세션을 만들지 않는다(W4)

    /* 세션·토큰은 이 문항에서 실제로 돌 것이 확정된 뒤에 확보한다.
       ⚠ idToken은 **문항마다** 새로 받는다 — 배치가 토큰 수명(1시간)보다 길 수 있다(§3-9). */
    let sessionId: string;
    let idToken: string;
    try {
      idToken = await getIdToken();
      sessionId = await ensureBatchSession(it.problemId, uid);
    } catch (e) {
      // 세션·토큰 확보 실패는 **문항 고유 실패**로 다룬다(V4). AI 호출 전이라 비용 0.
      const message = e instanceof Error ? e.message : '세션을 준비하지 못했습니다';
      for (const kind of runnable) setOutcome(it.problemId, kind, { state: 'failed', message });
      streak = nextFailureCount(streak, 'fail');
      if (shouldAbort(streak)) {
        return { rows, usage, aborted: 'streak', abortMessage: '연속 실패가 이어져 중단했습니다' };
      }
      continue;
    }

    const tabs: TabMeta[] = fresh.tabs || [];

    for (const kind of runnable) {
      if (stopRef.current) return { rows, usage, aborted: 'user', abortMessage: '사용자가 중단했습니다' };

      setOutcome(it.problemId, kind, { state: 'running' });
      try {
        const { report, usage: u } = await runVerifyFlow({
          kind,
          problemId: it.problemId,
          idToken,
          sessionId,
          tabId: tabs[0]?.id || 'question',
          tabs,
          blocksByTab: fresh.tabBlocks,
          title: fresh.title,
          answer: fresh.answer || '',
          tabLoadErrors: fresh.tabLoadErrors,
          buildMarkdown,
        });
        addUsage(u);
        setOutcome(it.problemId, kind, { state: 'done', verdict: report.verdict });
        streak = nextFailureCount(streak, 'ok');
      } catch (e) {
        const err = e as VerifyError;
        const message = err?.message || '검증에 실패했습니다';
        setOutcome(it.problemId, kind, { state: 'failed', message });

        // 401/403은 이후 전건이 반드시 실패한다 → 즉시 전체 중단 (E61d-6)
        if (isFatalStatus(err?.status)) {
          return {
            rows, usage, aborted: 'fatal',
            abortMessage: err.status === 403
              ? '이 계정에 검증 권한이 없어 중단했습니다'
              : '로그인이 만료되어 중단했습니다 — 새로고침 후 다시 시도하세요',
          };
        }
        streak = nextFailureCount(streak, 'fail');
        if (shouldAbort(streak)) {
          return { rows, usage, aborted: 'streak', abortMessage: '연속 실패가 이어져 중단했습니다' };
        }
      }
    }
  }

  return { rows, usage };
}
