/**
 * Phase 61b — 정밀 검증 (비대칭 교차검증)
 *
 * POST /api/verify
 * headers: Authorization: Bearer <Firebase ID token>
 *
 * 시트 시스템 STEP3(gas-project-audition `QualityVerification.gs`, origin/main b6b91f6)에서
 * 검증된 구조를 이식한다: **1차 Gemini가 후보를 넓게 만들고(recall), 2차 Claude가
 * 엄격히 판정한다(precision).** 코드가 어휘를 합성한다 — 모델이 최종 판정을 내리지 않는다.
 *
 * **이 라우트는 Firestore를 건드리지 않는다.** 리포트 JSON만 돌려주고, 저장은 클라이언트가
 * 기존 `addComment`/`updateDoc` 경로로 한다 → 수동 작성과 경로가 같아 규칙과 자연히 정합.
 *
 * ⚠️ 인증이 필수다. 기존 AI 라우트(discuss·proofread)는 무인증이지만 그건 *비용*만 새는
 *    것이고, 이 라우트는 무인증이면 남의 문항 전문을 대신 읽어 준다.
 *
 * ⚠️ **2차 판정이 완료되지 않은 검증은 검증이 아니다** (D13′). 1차 후보는 recall 편향이라
 *    그대로 보여 주면 2차가 존재하는 이유(보수 판정)가 무너진다 → 실패 시 리포트를 만들지
 *    않고 오류를 돌려준다. 클라이언트는 `verification`을 갱신하지 않는다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiError, verifyUid } from '../../../lib/apiAuth';
import { getVerifyProviders } from '../../../lib/ai-provider';
import {
  PROMPT_PROBLEM_FIRST, PROMPT_SOLUTION_FIRST, PROMPT_JUDGE,
  fillTemplate, labelBlocks, formatCandidatesForJudge, totalChars, deriveAnswerFormat,
  type LabeledBlock,
} from '../../../lib/verify/prompts';
import {
  parseAndRepair, sanitizeFindings, anchorByQuote, indexJudgments,
  synthesizeVerdict, compareAnswer, repairLatexControlCharsInString,
  type RawFinding, type VerifyKind,
} from '../../../lib/verify/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel: Hobby 최대 60s, Pro 최대 300s. 2콜 직렬이라 한도 최대치가 필요하다.
export const maxDuration = 300;

/** agent 컨텍스트와 같은 상한 (CommentPanel의 CONTEXT_CHAR_CAP). 초과분을 잘라서 검증하면
 *  "검증했다"는 거짓 신호가 남으므로 자르지 않고 거절한다. */
const MAX_INPUT_CHARS = 15_000;

/** 1차 후보 상한 (시트 QCONFIG.MAX_CANDIDATES) */
const MAX_CANDIDATES = 8;

const FIRST_MAX_TOKENS = 8_000;
/** 시트 QCONFIG.CLAUDE_MAX_TOKENS — thinking + 응답 합산 하드캡 */
const JUDGE_MAX_TOKENS = 16_000;

/** 전체 시간 예산. maxDuration보다 넉넉히 앞에서 멈춰 Vercel의 강제 종료를 피한다. */
const TOTAL_BUDGET_MS = 280_000;
/** 2차 판정에 최소한 남겨 둬야 하는 시간. 이보다 적으면 호출하지 않고 실패한다
 *  (시트 QCONFIG.API_CALL_RESERVE_MS와 같은 취지). */
const JUDGE_RESERVE_MS = 60_000;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/* ═══ 타입 ═══ */

export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

interface VerifyFinding {
  tag: string;
  verdict: 'fail' | 'check';
  blockKey: string | null;
  quote: string;
  reason: string;
  suggestion?: string;
  quoteFound: boolean;
}

interface VerifyReport {
  kind: VerifyKind;
  verdict: VerifyVerdict;
  findings: VerifyFinding[];
  derivedAnswer?: string;
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  models: { first: string; judge: string | null };
  note?: string;
  verifiedAt: number;
}

interface VerifyRequestBody {
  kind?: string;
  problemBlocks?: LabeledBlock[];
  solutionBlocks?: LabeledBlock[];
  answer?: string;
  /** 답안 형식 문구의 재료. 문구 자체는 서버가 만든다 —
   *  클라가 prompts를 import하면 프롬프트 전문이 클라이언트 번들에 실린다. */
  hasChoices?: boolean;
  hasGanaOrRoman?: boolean;
  hasImages?: boolean;
}

/* ═══ 환경변수 ═══ */

function readEnv() {
  const missing: string[] = [];
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) { missing.push(name); return ''; }
    return v;
  };
  const apiKey = need('NEXT_PUBLIC_FIREBASE_API_KEY');
  // 허용목록은 시트 가져오기와 같은 사람이라 env를 재사용한다. 사용자 집합이 갈리는 날
  // VERIFY_ALLOWED_UIDS만 채우면 분리된다.
  const allowedRaw = process.env.VERIFY_ALLOWED_UIDS || process.env.AUDITION_ALLOWED_UIDS || '';
  if (!allowedRaw) missing.push('VERIFY_ALLOWED_UIDS (또는 AUDITION_ALLOWED_UIDS)');
  if (missing.length) {
    // 값은 절대 노출하지 않고 "어떤 변수가 없는지" 이름만 알린다.
    throw new ApiError(500, `서버 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
  }
  return {
    apiKey,
    allowedUids: allowedRaw.split(',').map((s) => s.trim()).filter(Boolean),
    geminiModel: process.env.VERIFY_GEMINI_MODEL || 'gemini-3.1-pro-preview',
    claudeModel: process.env.VERIFY_CLAUDE_MODEL || 'claude-opus-4-8',
    // F1: 2차 판정의 code_execution은 시트 STEP3에 전례가 없는 신규 요소다(그쪽 payload에는
    //     tools가 아예 없다). 기본 off로 두고 실측 후 켠다.
    judgeCodeExec: process.env.VERIFY_JUDGE_CODE_EXEC === '1',
    // 단가는 모델이 env 고정이라 ai_models 문서를 못 쓴다 → 라우트 상수.
    // Claude Opus 4.8: $5 / $25 per 1M (2026-06 기준 Anthropic 공시가).
    claudeCostIn: 5, claudeCostOut: 25,
    geminiCostIn: Number(process.env.VERIFY_GEMINI_COST_IN || 0),
    geminiCostOut: Number(process.env.VERIFY_GEMINI_COST_OUT || 0),
  };
}

/* ═══ 핸들러 ═══ */

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const env = readEnv();
    await verifyUid(req.headers.get('authorization'), env.apiKey, env.allowedUids);

    const body = (await req.json().catch(() => ({}))) as VerifyRequestBody;

    const kind = body.kind as VerifyKind;
    if (kind !== 'problem' && kind !== 'solution') {
      return fail(400, "kind는 'problem' 또는 'solution'이어야 합니다");
    }

    const problemBlocks = normalizeBlocks(body.problemBlocks);
    const solutionBlocks = normalizeBlocks(body.solutionBlocks);
    if (problemBlocks.length === 0) return fail(400, '문제 내용이 비어 있습니다');
    if (kind === 'solution' && solutionBlocks.length === 0) {
      return fail(400, '풀이 내용이 비어 있습니다');
    }

    const chars = totalChars(problemBlocks) + totalChars(solutionBlocks);
    if (chars > MAX_INPUT_CHARS) {
      // 클라이언트가 이미 막지만 서버도 방어한다.
      return fail(400, `문항이 너무 깁니다 — ${chars.toLocaleString()}자 / ${MAX_INPUT_CHARS.toLocaleString()}자`);
    }

    // 지적이 가리킬 대상: 문제 검증은 문제 블록, 풀이 검증은 풀이 블록
    const targetBlocks = kind === 'problem' ? problemBlocks : solutionBlocks;

    const { first, judge } = getVerifyProviders({
      gemini: env.geminiModel, claude: env.claudeModel,
    });

    /* ── ❶ 1차: 후보 생성 (recall) ── */
    const firstPrompt = kind === 'problem' ? PROMPT_PROBLEM_FIRST : PROMPT_SOLUTION_FIRST;
    const firstUser = fillTemplate(firstPrompt.user, {
      problem: labelBlocks(problemBlocks),
      solution: labelBlocks(solutionBlocks),
      format: deriveAnswerFormat({
        hasChoices: !!body.hasChoices,
        hasGanaOrRoman: !!body.hasGanaOrRoman,
        answer: String(body.answer ?? ''),
      }),
    });

    const firstRes = await first.complete(firstPrompt.system, firstUser, FIRST_MAX_TOKENS, {
      geminiThinkingLevel: 'HIGH',
      geminiJsonMime: true,
    });
    const firstJson = parseAndRepair(firstRes.content) as Record<string, unknown> | null;
    if (!firstJson) {
      throw new ApiError(502, '1차 검토 응답을 해석하지 못했습니다 — 잠시 후 다시 시도하세요');
    }

    let inputTokens = firstRes.inputTokens;
    let outputTokens = firstRes.outputTokens;
    const usdFirst = cost(firstRes.inputTokens, firstRes.outputTokens, env.geminiCostIn, env.geminiCostOut);

    // 그림 의존으로 판단 불가 — AI가 스스로 내린 판정만 skip이 된다 (B-8)
    if (firstJson.skip === true) {
      return NextResponse.json({
        report: report(kind, 'skip', [], {
          models: { first: env.geminiModel, judge: null },
          note: String(firstJson.skip_reason || '그림을 보아야 판단할 수 있어 검증하지 않았습니다'),
        }),
        usage: { inputTokens, outputTokens, costUsd: round4(usdFirst) },
      });
    }

    const derivedAnswer = kind === 'problem'
      ? repairLatexControlCharsInString(String(firstJson.derived_answer ?? '')).trim()
      : undefined;
    const answerCheck = kind === 'problem'
      ? compareAnswer(String(body.answer ?? ''), derivedAnswer)
      : undefined;

    const candidates = sanitizeFindings(firstJson.candidates, kind, MAX_CANDIDATES);

    /* ── ❷ 정답 불일치는 후보가 0이어도 그냥 넘길 수 없다 (V2) ──
       일치 대조가 어긋났다는 것 자체가 의심 지점이다. 원인(문제 결함/풀이 오류/정답 입력
       실수)은 2차 판정이 가린다. */
    if (answerCheck === 'mismatch' && !candidates.some((c) => c.tag === '정답불일치')) {
      candidates.unshift({
        id: 'c0',
        tag: '정답불일치',
        quote: '',
        reason: `등록된 정답 "${String(body.answer ?? '').trim()}"과 독립적으로 도출한 답 "${derivedAnswer}"이 다릅니다.`
              + ' 문제 결함인지, 도출 과정의 오류인지, 등록된 정답이 잘못된 것인지 판정하세요.',
      });
      // id 재부여 — 2차 판정이 id로 맞물린다
      candidates.forEach((c, i) => { c.id = `c${i + 1}`; });
    }

    /* ── ❸ 후보 0 → 즉시 ok. 2차 미호출로 비용을 아낀다 (시트 STEP3와 동일) ── */
    if (candidates.length === 0) {
      return NextResponse.json({
        report: report(kind, 'ok', [], {
          models: { first: env.geminiModel, judge: null },
          note: '(후보 없음)',
          derivedAnswer, answerCheck,
        }),
        usage: { inputTokens, outputTokens, costUsd: round4(usdFirst) },
      });
    }

    /* ── ❹ 앵커 확정: 모델의 [블록 n] 신고가 아니라 인용 실재성으로 정한다 (D10) ── */
    const anchors = candidates.map((c) => anchorByQuote(c.quote, targetBlocks));

    /* ── ❺ 예산 검사: 2차에 쓸 시간이 없으면 호출하지 않고 실패한다 (D13′) ── */
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < JUDGE_RESERVE_MS) {
      throw new ApiError(504, '시간이 부족해 판정을 마치지 못했습니다 — 다시 시도하세요');
    }

    /* ── ❻ 2차: 엄격 판정 (precision) ── */
    const judgeUser = fillTemplate(PROMPT_JUDGE.user, {
      problem: labelBlocks(problemBlocks),
      solution: kind === 'problem' ? labelBlocks(problemBlocks) : labelBlocks(solutionBlocks),
      candidates: formatCandidatesForJudge(candidates),
    });

    const judgeRes = await judge.complete(PROMPT_JUDGE.system, judgeUser, JUDGE_MAX_TOKENS, {
      // ⚠ Opus 4.8은 thinking을 생략하면 사고가 꺼진 채 돈다. 시트 STEP3와 같은 설정.
      thinking: 'adaptive',
      effort: 'high',
      // F1: 시트에 전례가 없는 신규 요소라 env로 켠다. tool_choice 강제는 절대 하지 않는다
      //     (도구 호출을 강제하면 모델이 최종 JSON 턴을 낼 수 없다).
      enableCodeExecution: env.judgeCodeExec,
    });
    inputTokens += judgeRes.inputTokens;
    outputTokens += judgeRes.outputTokens;
    const usdJudge = cost(judgeRes.inputTokens, judgeRes.outputTokens, env.claudeCostIn, env.claudeCostOut);

    if (judgeRes.truncated) {
      throw new ApiError(502, '판정이 도구 호출 상한에서 끊겼습니다 — 다시 시도하세요');
    }
    const judgeJson = parseAndRepair(judgeRes.content) as Record<string, unknown> | null;
    const judgments = judgeJson?.judgments;
    if (!Array.isArray(judgments)) {
      throw new ApiError(502, '판정 응답을 해석하지 못했습니다 — 다시 시도하세요');
    }

    /* ── ❼ 합성: 코드가 어휘를 정한다 ── */
    const rulings = indexJudgments(judgments);
    const findings: VerifyFinding[] = [];
    candidates.forEach((c, i) => {
      const j = rulings[c.id];
      const ruling = j?.ruling ?? 'uncertain';   // 판정 누락은 uncertain (시트와 동일)
      if (ruling === 'invalid') return;          // 기각된 후보는 사라진다

      const anchor = anchors[i];
      // 인용이 원문에서 확인되지 않으면 환각 신호 → 결함 확정으로 올리지 않는다
      const verdict: 'fail' | 'check' =
        ruling === 'valid' && anchor.found ? 'fail' : 'check';

      const suggestion = pickSuggestion(judgments, c);
      findings.push({
        tag: c.tag,
        verdict,
        blockKey: anchor.blockKey,
        quote: c.quote,
        reason: j?.note || c.reason,
        ...(suggestion ? { suggestion } : {}),
        quoteFound: anchor.found,
      });
    });

    return NextResponse.json({
      report: report(kind, synthesizeVerdict(findings), findings, {
        models: { first: env.geminiModel, judge: env.claudeModel },
        derivedAnswer, answerCheck,
      }),
      usage: { inputTokens, outputTokens, costUsd: round4(usdFirst + usdJudge) },
    });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.userMessage);
    console.error('[verify] 예상치 못한 오류:', e);
    return fail(500, '검증 중 오류가 발생했습니다');
  }
}

/* ═══ 헬퍼 ═══ */

function normalizeBlocks(raw: unknown): LabeledBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      return {
        blockKey: String(o.blockKey ?? ''),
        type: String(o.type ?? 'text'),
        text: String(o.text ?? ''),
      };
    })
    .filter((b) => b.blockKey && b.text.trim());
}

function report(
  kind: VerifyKind,
  verdict: VerifyVerdict,
  findings: VerifyFinding[],
  extra: {
    models: { first: string; judge: string | null };
    note?: string;
    derivedAnswer?: string;
    answerCheck?: 'match' | 'mismatch' | 'no_answer';
  },
): VerifyReport {
  return {
    kind, verdict, findings,
    ...(extra.derivedAnswer ? { derivedAnswer: extra.derivedAnswer } : {}),
    ...(extra.answerCheck ? { answerCheck: extra.answerCheck } : {}),
    models: extra.models,
    ...(extra.note ? { note: extra.note } : {}),
    verifiedAt: Date.now(),
  };
}

function pickSuggestion(judgments: unknown[], c: RawFinding): string {
  const j = judgments.find(
    (x) => String(((x ?? {}) as Record<string, unknown>).id ?? '') === c.id,
  ) as Record<string, unknown> | undefined;
  const s = repairLatexControlCharsInString(String(j?.suggestion ?? '')).trim();
  return s || (c.suggestion ?? '');
}

function cost(inTok: number, outTok: number, inPerM: number, outPerM: number): number {
  return (inTok / 1_000_000) * inPerM + (outTok / 1_000_000) * outPerM;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
