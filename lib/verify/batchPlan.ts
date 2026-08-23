/**
 * Phase 61d — 폴더 일괄 검증의 순수 판정 로직 (import 0)
 *
 * ⚠️ **이 파일에 import를 두지 말 것** — `npm run test:batch`가 tsc로 단독 컴파일한다.
 *    타입도 로컬 정의다(`parse.ts` 전례).
 *
 * ⚠️ **글자 수·블록 수를 여기서 세지 말 것 (W1).** import 0이라 `verifyBlocksOf`를 쓸 수 없고,
 *    직접 세면 서버 셈법(`route.ts` `normalizeBlocks` + `totalChars`)의 **세 번째 사본**이 된다.
 *    유일 구현은 `lib/verifyFlow.ts`의 `verifyCharCountOf`이고, 여기서는 **계산된 수치를 주입받는다.**
 *
 * ── 이 파일이 존재하는 이유 ──
 * 배치의 위험은 전부 "조용히 어긋나는 것"이다: 기본 체크가 배지와 다르거나, 사전에 막을 수 있는
 * 문항에 AI 비용을 쓰거나, 장애 상황에서 n건을 헛돌거나. 그 판정을 부수효과 없는 함수로 떼어
 * 테스트가 고정한다. 부수효과(로드·검증·저장)는 `lib/batchVerify.ts`가 맡는다.
 */

/* ═══════════════════════════════════════════════════════ */
/* 타입 · 상수 (로컬 정의 — import 0 규약)                    */
/* ═══════════════════════════════════════════════════════ */

export type BatchKind = 'problem' | 'solution';

/**
 * 사전 차단 사유. **전부 AI 호출 전에 판정된다** — 비용 0으로 막을 수 있는 것을 호출 뒤에 알리지 않는다.
 *
 * ⚠️ 이것을 `skip` verdict로 기록하지 말 것(61b D14′). `skip`은 **AI가 판단한** 검증 불가
 *    (그림 의존) 전용 어휘다. 사전 차단은 요약 화면에만 존재한다.
 */
export type SkipReason =
  | 'missing'          // 문서 없음(삭제·권한 상실)
  | 'not_owner'        // AI 댓글 create는 오너만 — 규칙이 막는다
  | 'tab_load_error'   // 탭 로드 실패 → computeVerifyHashes가 VersionLoadError를 던진다
  | 'empty_question'   // 서버 400 '문제 내용이 비어 있습니다' (route.ts:170)
  | 'no_solution'      // 서버 400 '풀이 내용이 비어 있습니다' (route.ts:172)
  | 'too_long';        // 서버 400 15,000자 초과 (route.ts:178)

/** ⚠ `CommentPanel.VERIFY_CHAR_CAP` · `route.ts MAX_INPUT_CHARS`와 같은 값의 사본이다.
 *  세 곳이 갈리면 "클라는 보내는데 서버가 거절"이 되므로 함께 고칠 것. */
export const CHAR_CAP = 15_000;

/** 서로 다른 문항 연속 실패가 이 수에 닿으면 전체 중단 (E61d-6) */
export const ABORT_STREAK = 3;

/** 프리플라이트 읽기 동시 상한. `SheetImportModal.SAVE_CONCURRENCY`(=4) 전례에 맞춘다.
 *  ⚠ AI 루프는 여전히 완전 직렬이다 — 이 값은 **읽기에만** 쓴다(D61d-3). */
export const PREFLIGHT_CONCURRENCY = 4;

/** `Problem.verification[kind]`에서 이 판정이 실제로 보는 것만 추린 모양 */
export interface VerifyStateLike {
  verdict: string;
  stale?: boolean;
}

/* ═══════════════════════════════════════════════════════ */
/* 선택 화면 — 기본 체크 (E61d-5)                            */
/* ═══════════════════════════════════════════════════════ */

/**
 * 그 종류를 기본 체크할 것인가.
 *
 * ```
 * 기본 체크 = !verification[kind] || verification[kind].stale
 * ```
 *
 * ⚠️ **`check`·`fail`은 기본 해제다.** 내용이 안 바뀐 재검증은 거의 같은 리포트를 한 번 더 쌓을 뿐이고,
 *    그 상태는 *사람이 볼 차례*지 AI가 다시 돌 차례가 아니다. 내용을 고치면 `stale`이 되어 자동 복귀한다.
 *    (사용자가 손으로 체크하는 길은 열려 있다 — "전부 재검증" 시나리오는 [전체 선택]으로 산다.)
 */
export function defaultChecked(state: VerifyStateLike | undefined): boolean {
  if (!state) return true;
  return state.stale === true;
}

/* ═══════════════════════════════════════════════════════ */
/* 프리플라이트 — 사전 차단 (§3-4)                            */
/* ═══════════════════════════════════════════════════════ */

export interface PreflightInput {
  kind: BatchKind;
  /** getProblemWithBlocks가 null을 돌려줬는가 */
  missing: boolean;
  /** problem.authorUid === 실행자 uid */
  isOwner: boolean;
  /** getProblemWithBlocks의 tabLoadErrors 키 개수 */
  tabLoadErrorCount: number;
  /** verifyBlocksOf(question).length — 서버의 normalizeBlocks와 같은 셈법(빈 텍스트 제외) */
  questionBlockCount: number;
  /** verifyBlocksOf(solution).length */
  solutionBlockCount: number;
  /** verifyCharCountOf(blocksByTab, kind) */
  chars: number;
}

/**
 * 이 문항×종류를 AI에 보내기 전에 막아야 하는가. 막을 이유가 없으면 null.
 *
 * ⚠️ **`tab_load_error`가 가장 위험하다.** 그 예외는 `runVerifyFlow` 안에서 `addComment` **뒤**
 *    (해시 계산 시점)에 터진다 → AI 비용을 다 쓰고 리포트는 저장됐는데 `verification`만 미갱신인
 *    반쪽 상태로 끝난다. 반드시 호출 전에 거른다.
 *
 * ⚠️ **`empty_question`은 두 종류 모두를 막는다 (W6).** 풀이 검증 요청에도 `problemBlocks`가 실려
 *    가고 서버는 그것이 비면 400을 낸다(`route.ts:170`) — 풀이만 있으면 될 것 같지만 안 된다.
 *
 * 판정 순서는 "더 근본적인 것 먼저"다. 문서가 없는데 글자 수를 논할 수 없다.
 */
export function preflightSkip(i: PreflightInput): SkipReason | null {
  if (i.missing) return 'missing';
  if (!i.isOwner) return 'not_owner';
  if (i.tabLoadErrorCount > 0) return 'tab_load_error';
  if (i.questionBlockCount === 0) return 'empty_question';
  if (i.kind === 'solution' && i.solutionBlockCount === 0) return 'no_solution';
  // 서버와 같은 경계: 정확히 CHAR_CAP은 통과한다(`chars > MAX_INPUT_CHARS`)
  if (i.chars > CHAR_CAP) return 'too_long';
  return null;
}

/** 사유 문구는 여기가 소유한다 — UI가 사본을 만들면 두 벌로 갈린다(D61d-13).
 *  Record로 둔 것은 의도적이다: 사유를 추가하면 라벨 누락이 **컴파일 오류**가 된다. */
const SKIP_LABELS: Record<SkipReason, string> = {
  missing: '문항을 불러오지 못함',
  not_owner: '내 문항이 아님',
  tab_load_error: '탭 로드 실패',
  empty_question: '문제 내용이 비어 있음',
  no_solution: '풀이 없음',
  too_long: `${CHAR_CAP.toLocaleString()}자 초과`,
};

export function skipLabel(reason: SkipReason): string {
  return SKIP_LABELS[reason];
}

/* ═══════════════════════════════════════════════════════ */
/* 실패 처리 — 건너뛸 실패와 멈춰야 할 실패 (E61d-6)           */
/* ═══════════════════════════════════════════════════════ */

/**
 * 이 상태 코드면 **이후 전건이 반드시 실패한다** → 즉시 전체 중단.
 *   401 = 토큰 불비·만료 / 403 = `VERIFY_ALLOWED_UIDS` 미등록 (`lib/apiAuth.ts` fail-closed)
 * 429·5xx는 한 건의 사정일 수 있으므로 여기 넣지 않는다 — 그쪽은 연속 카운터가 잡는다.
 */
export function isFatalStatus(status?: number): boolean {
  return status === 401 || status === 403;
}

/**
 * 연속 실패 카운터 (V2).
 *
 * ⚠️ 정의가 느슨하면 "건너뜀 3연속"이 장애로 오인된다. 규칙:
 *   - `fail` = **AI 호출을 실제로 시도한** 종류 단위 실패 → +1
 *   - `ok`   = 성공 1건이면 장애가 아니다 → 0으로 리셋
 *   - `skip` = 사전 차단은 시도한 적이 없다 → 그대로 유지
 * (배치 시작 · [실패 항목만 다시 실행] 시작 시에도 0에서 출발한다 — 호출부 책임)
 */
export function nextFailureCount(prev: number, ev: 'ok' | 'fail' | 'skip'): number {
  if (ev === 'ok') return 0;
  if (ev === 'fail') return prev + 1;
  return prev;
}

export function shouldAbort(consecutiveFailures: number): boolean {
  return consecutiveFailures >= ABORT_STREAK;
}

/* ═══════════════════════════════════════════════════════ */
/* 집계 · 예상 시간                                          */
/* ═══════════════════════════════════════════════════════ */

export type RowOutcome =
  | { state: 'pending' }
  | { state: 'running' }
  | { state: 'done'; verdict: 'ok' | 'check' | 'fail' | 'skip' }
  | { state: 'failed'; message: string }
  | { state: 'skipped'; reason: SkipReason };

export interface BatchSummary {
  ok: number; check: number; fail: number; skip: number;
  failed: number; skipped: number;
  /** 아직 돌지 않은 것(중단 시 남는다) */
  remaining: number;
}

export function summarize(rows: RowOutcome[]): BatchSummary {
  const s: BatchSummary = { ok: 0, check: 0, fail: 0, skip: 0, failed: 0, skipped: 0, remaining: 0 };
  for (const r of rows) {
    if (r.state === 'done') s[r.verdict] += 1;
    else if (r.state === 'failed') s.failed += 1;
    else if (r.state === 'skipped') s.skipped += 1;
    else s.remaining += 1;                      // pending · running
  }
  return s;
}

/**
 * 예상 소요 (분). 61b 실측 기준 **종류당 1~4분**(최장 228초/문항).
 * 순차 실행이므로 단순 곱이 맞다 — 병렬 가정이 들어가면 안 된다(D61d-3).
 */
export function estimateMinutes(runCount: number): [number, number] {
  const n = Math.max(0, Math.floor(runCount));
  return [n, n * 4];
}
