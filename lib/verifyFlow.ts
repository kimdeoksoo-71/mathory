/**
 * Phase 61b — 검증 실행 흐름 (클라이언트 공용)
 *
 * 편집창(EditorView)과 열람뷰(ProblemView)가 같은 흐름을 쓴다.
 *
 * ⚠️ **이 파일을 `lib/verify/`에 두지 말 것.** 그 폴더는 전부 import 0 순수 모듈이고
 *    `npm run test:verify`가 tsc로 단독 컴파일한다. 이 파일은 firestore·comments를 import한다.
 *
 * ⚠️ 요청은 **두 번**이다(1차 후보 생성 → 2차 판정). 한 요청에 다 넣으면 어려운 문항에서
 *    Vercel `maxDuration`(300초)을 넘긴다 — 실측 228초. 중간 상태는 클라가 들고 다시 보낸다.
 */

import type { Block, TabMeta, VerifyKind, VerifyReport } from '../types/problem';
import { addComment } from './comments';
import { setVerification } from './firestore';
import { blockKeyOf } from './caseBlock';
import { collectCurrentContent } from './version/adapter';
import { hashPerTab, sha256 } from './version/hash';

/** 검증에 넘길 블록. 미디어 블록은 텍스트가 없으므로 제외하고 hasImages로만 센다. */
export function verifyBlocksOf(blocks: Block[]): { blockKey: string; type: string; text: string }[] {
  return blocks
    .filter((b) => !['image', 'svg', 'ggb'].includes(b.type))
    .map((b) => ({
      blockKey: blockKeyOf(b),
      type: b.type,
      text: (b.title ? `### ${b.title}\n` : '') + (b.raw_text || ''),
    }))
    .filter((b) => b.text.trim());
}

export function hasMedia(blocks: Block[]): boolean {
  return blocks.some((b) => ['image', 'svg', 'ggb'].includes(b.type));
}

/** `/api/verify`가 돌려준 HTTP 상태를 실은 오류 (Phase 61d D5①) */
export interface VerifyError extends Error { status?: number }

/**
 * 이 문항×종류를 검증할 때 서버가 세게 될 글자 수.
 *
 * ⚠️ **서버 셈법과 같아야 한다** — `route.ts`는 `totalChars(problemBlocks) + totalChars(solutionBlocks)`를
 *    보고, 클라가 보내는 `solutionBlocks`는 `kind === 'solution'`일 때만 채워진다. 즉 문제 검증은
 *    question만, 풀이 검증은 question+solution이다. 빈 텍스트 블록은 양쪽 모두 제외한다
 *    (`verifyBlocksOf` ↔ 서버 `normalizeBlocks`).
 *
 * ⚠️ 사본을 만들지 말 것 — 셈법이 갈리면 "클라는 보내는데 서버가 400"이 된다.
 *    소비처: 편집창 칩 · 열람뷰 칩 · 일괄 검증 프리플라이트(Phase 61d).
 */
export function verifyCharCountOf(
  blocksByTab: Record<string, Block[]>,
  kind: VerifyKind,
): number {
  const q = verifyBlocksOf(blocksByTab['question'] || []);
  const sol = kind === 'solution' ? verifyBlocksOf(blocksByTab['solution'] || []) : [];
  return [...q, ...sol].reduce((n, b) => n + b.text.length, 0);
}

/**
 * 검증 대상 탭의 정규화 해시 (stale 판정 기준).
 *
 * ⚠️ problem 해시에는 **answer를 함께 넣는다.** `canonicalizeTab`은 제목·정답을 포함하지
 *    않는데(meta는 canonicalize에만 있다), 문제 검증의 `answerCheck`는 answer에 의존하므로
 *    정답만 고쳐도 그 리포트는 낡는다.
 */
export async function computeVerifyHashes(args: {
  tabs: TabMeta[];
  blocksByTab: Record<string, Block[]>;
  title: string;
  answer: string;
  tabLoadErrors?: Record<string, string>;
}): Promise<Partial<Record<VerifyKind, string>>> {
  const content = collectCurrentContent(args);
  const per = await hashPerTab(content);
  const out: Partial<Record<VerifyKind, string>> = {};
  if (per['question'] !== undefined) {
    out.problem = await sha256(`${per['question']}\n#answer:${args.answer || ''}`);
  }
  if (per['solution'] !== undefined) out.solution = per['solution'];
  return out;
}

export interface VerifyUsage { inputTokens: number; outputTokens: number; costUsd: number }

/**
 * 검증 실행 → 리포트 메시지 저장 → `Problem.verification` 갱신.
 * 실패하면 던진다 — 호출부가 `verification`을 손대지 않도록 (D13′).
 */
export async function runVerifyFlow(args: {
  kind: VerifyKind;
  problemId: string;
  idToken: string;
  sessionId: string;
  /** 리포트 메시지가 달릴 탭 (잔존 필드 — 필터·권한 미사용) */
  tabId: string;
  tabs: TabMeta[];
  blocksByTab: Record<string, Block[]>;
  title: string;
  answer: string;
  tabLoadErrors?: Record<string, string>;
  /** 리포트 markdown 조립 (컴포넌트가 주입 — lib이 컴포넌트를 import하지 않도록) */
  buildMarkdown: (report: VerifyReport) => string;
}): Promise<{ report: VerifyReport; usage: VerifyUsage; commentId: string }> {
  const question = args.blocksByTab['question'] || [];
  const solution = args.blocksByTab['solution'] || [];
  const targetRaw = args.kind === 'solution' ? solution : question;

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.idToken}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      // Phase 61d(D5①): 상태 코드를 실어 보낸다 — 배치가 401/403(토큰·허용목록)을 만나면
      // 이후 전건이 반드시 실패하므로 즉시 전체를 멈춰야 한다. 기존 호출부는 `.message`만
      // 읽으므로 영향 0이고, 던지는 값의 타입도 그대로 Error다.
      const err = new Error(data.error || `검증 실패 (HTTP ${res.status})`) as VerifyError;
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const base = {
    kind: args.kind,
    problemBlocks: verifyBlocksOf(question),
    solutionBlocks: args.kind === 'solution' ? verifyBlocksOf(solution) : [],
    answer: args.answer || '',
    // 답안 형식 문구는 서버가 만든다 — 클라가 lib/verify/prompts를 import하면
    // 프롬프트 전문이 클라이언트 번들에 실린다. 재료만 넘긴다.
    hasChoices: question.some((b) => b.type === 'choices'),
    hasGanaOrRoman: question.some((b) => b.type === 'gana' || b.type === 'roman'),
    hasImages: hasMedia(targetRaw),
  };

  const first = await call({ ...base, phase: 'first' });

  // 1차가 이미 결론을 낸 경우(그림 의존 skip · 후보 없음) — 2차를 부르지 않는다
  let report: VerifyReport;
  let usage: VerifyUsage = first.usage;
  if (first.report) {
    report = first.report as VerifyReport;
  } else {
    const second = await call({
      ...base, phase: 'judge',
      candidates: first.candidates,
      derivedAnswer: first.derivedAnswer,
      answerCheck: first.answerCheck,
    });
    report = second.report as VerifyReport;
    usage = {
      inputTokens: (first.usage?.inputTokens || 0) + (second.usage?.inputTokens || 0),
      outputTokens: (first.usage?.outputTokens || 0) + (second.usage?.outputTokens || 0),
      costUsd: (first.usage?.costUsd || 0) + (second.usage?.costUsd || 0),
    };
  }

  // 리포트는 일반 AI 메시지로 저장한다 → 후속 대화가 기존 discuss 파이프라인 무변경으로 된다
  const commentId = await addComment({
    problemId: args.problemId,
    tabId: args.tabId,
    authorUid: 'ai:verify',
    content: args.buildMarkdown(report),
    parentCommentId: null,
    authorType: 'ai',
    modelId: 'verify',
    discussionSessionId: args.sessionId,
    aiUsage: {
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd,
    },
  });

  const hashes = await computeVerifyHashes({
    tabs: args.tabs, blocksByTab: args.blocksByTab,
    title: args.title, answer: args.answer || '',
    tabLoadErrors: args.tabLoadErrors,
  });
  await setVerification(args.problemId, args.kind, {
    verdict: report.verdict,
    verifiedAt: report.verifiedAt,
    contentHash: hashes[args.kind] || '',
    stale: false,
    reportCommentId: commentId,
  });

  return { report, usage, commentId };
}
