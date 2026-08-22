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
 *
 * ⚠️ **요청은 두 번이다** (`phase: 'first'` → `phase: 'judge'`).
 *    한 요청에 다 넣으면 어려운 문항에서 `maxDuration`(Vercel Pro 상한 300초)을 넘긴다 —
 *    실측 2026-08-22: 1차 두 패스(thinking HIGH) + 2차가 한 문항에 228초. 최악이라는 보장도 없다.
 *    쪼개면 각 단계가 온전히 300초를 받으므로 **thinking을 낮춰 품질을 깎지 않아도 된다.**
 *    중간 상태(후보 배열)는 클라이언트가 들고 다시 보낸다 — 서버는 여전히 무상태다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiError, verifyUid } from '../../../lib/apiAuth';
import { getVerifyProviders, type AIProvider } from '../../../lib/ai-provider';
import {
  PROMPT_PROBLEM_FIRST, SOLUTION_FIRST_PASSES, PROMPT_JUDGE,
  fillTemplate, labelBlocks, formatCandidatesForJudge, totalChars, deriveAnswerFormat,
  type LabeledBlock,
} from '../../../lib/verify/prompts';
import {
  parseAndRepair, sanitizeFindings, mergeCandidates, anchorByQuote, indexJudgments,
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

/** 1차 패스 **하나당** 후보 상한 (시트 QCONFIG.MAX_CANDIDATES) */
const MAX_CANDIDATES_PER_PASS = 8;
/** 병합 후 상한. 풀이 검증은 계산·표기 / 논리 두 패스라 합이 커진다 */
const MAX_CANDIDATES = 12;

/**
 * ⚠️ **올리지 말 것. 실측으로 반증됐다.**
 *
 * "thinking이 예산을 먹어 reason이 필러로 퇴화한다"는 가설로 8k→32k를 시도했으나
 * 두 번의 측정이 모두 나빠졌다(후보 2.50 → 1.70 → 1.40, 기각률 72% → 86%, 검출 4 → 1).
 * 가설의 근거였던 "출력 10,713토큰"은 **1차 두 패스 + 2차 판정의 합계**를 개별 호출값으로
 * 잘못 읽은 것이었다 — 예산에 닿았다는 증거가 애초에 없었다.
 * thinking을 길게 준다고 후보가 좋아지지 않고, 오히려 후보를 덜 낸다.
 */
const FIRST_MAX_TOKENS = 8_000;
/** 시트 QCONFIG.CLAUDE_MAX_TOKENS는 16k였지만, 단계를 쪼개 300초를 온전히 받으므로
 *  판정에 여유를 준다. thinking + 응답 합산 하드캡이라 넉넉해야 판정이 잘리지 않는다. */
const JUDGE_MAX_TOKENS = 32_000;

/** 단계별 시간 예산. maxDuration보다 앞에서 멈춰 Vercel의 강제 종료를 피한다.
 *  단계를 쪼갠 뒤로는 한 단계가 이 예산을 통째로 쓴다. */
const PHASE_BUDGET_MS = 280_000;

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
  /** 'first' = 후보 생성 / 'judge' = 엄격 판정. 미지정은 'first'(구버전 클라 호환) */
  phase?: 'first' | 'judge';
  kind?: string;
  /** phase='judge'에서 클라가 되돌려 보내는 1차 산출물 */
  candidates?: RawFinding[];
  derivedAnswer?: string;
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
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

    /* ═══ phase = 'judge' — 2차만 수행하고 끝낸다 ═══ */
    if (body.phase === 'judge') {
      const given = Array.isArray(body.candidates) ? body.candidates : [];
      if (given.length === 0) return fail(400, '판정할 후보가 없습니다');
      return await runJudge({
        kind, judge, env, problemBlocks, solutionBlocks, targetBlocks,
        candidates: given,
        derivedAnswer: body.derivedAnswer,
        answerCheck: body.answerCheck,
        carriedIn: 0, carriedOut: 0, carriedUsd: 0,
        startedAt,
      });
    }

    /* ── ❶ 1차: 후보 생성 (recall) ──
       문제 검증은 한 패스, 풀이 검증은 **계산·표기 / 논리 두 패스**다(시트 STEP2·STEP3 구조).
       한 프롬프트에 태그를 다 넣으면 눈에 띄는 표기·계산이 먼저 소모되고 논리가 묻힌다.
       ⚠ 두 호출은 **병렬**이다 — 직렬로 보내면 300초 예산이 무너진다. */
    const vars = {
      problem: labelBlocks(problemBlocks),
      solution: labelBlocks(solutionBlocks),
      format: deriveAnswerFormat({
        hasChoices: !!body.hasChoices,
        hasGanaOrRoman: !!body.hasGanaOrRoman,
        answer: String(body.answer ?? ''),
      }),
    };
    const passes = kind === 'problem' ? [PROMPT_PROBLEM_FIRST] : SOLUTION_FIRST_PASSES;

    const firstResults = await Promise.all(passes.map((pr) =>
      first.complete(pr.system, fillTemplate(pr.user, vars), FIRST_MAX_TOKENS, {
        geminiThinkingLevel: 'HIGH',
        geminiJsonMime: true,
      })));

    let inputTokens = 0;
    let outputTokens = 0;
    for (const r of firstResults) { inputTokens += r.inputTokens; outputTokens += r.outputTokens; }
    const usdFirst = cost(inputTokens, outputTokens, env.geminiCostIn, env.geminiCostOut);

    const firstJsons = firstResults.map((r) => parseAndRepair(r.content) as Record<string, unknown> | null);
    // 패스가 **전부** 실패했을 때만 오류다. 하나가 살면 그것으로 진행한다 —
    // 두 패스는 서로 독립이므로 한쪽 실패가 다른 쪽을 버릴 이유가 없다.
    if (firstJsons.every((j) => j === null)) {
      throw new ApiError(502, '1차 검토 응답을 해석하지 못했습니다 — 잠시 후 다시 시도하세요');
    }

    // 그림 의존으로 판단 불가 — AI가 스스로 내린 판정만 skip이 된다 (B-8).
    // 두 패스가 다 skip일 때만 skip이다(한쪽만이면 나머지 패스의 후보를 살린다).
    const alive = firstJsons.filter((j): j is Record<string, unknown> => j !== null);
    if (alive.every((j) => j.skip === true)) {
      return NextResponse.json({
        report: report(kind, 'skip', [], {
          models: { first: env.geminiModel, judge: null },
          note: String(alive[0]?.skip_reason || '그림을 보아야 판단할 수 있어 검증하지 않았습니다'),
        }),
        usage: { inputTokens, outputTokens, costUsd: round4(usdFirst) },
      });
    }

    const derivedAnswer = kind === 'problem'
      ? repairLatexControlCharsInString(String(alive[0]?.derived_answer ?? '')).trim()
      : undefined;
    const answerCheck = kind === 'problem'
      ? compareAnswer(String(body.answer ?? ''), derivedAnswer)
      : undefined;

    const candidates = mergeCandidates(
      alive.map((j) => sanitizeFindings(j.candidates, kind, MAX_CANDIDATES_PER_PASS)),
      MAX_CANDIDATES,
    );

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

    /* ── ❹ 1차 종료 — 후보를 돌려주고 여기서 요청을 끝낸다.
           2차는 클라이언트가 이 후보를 들고 **새 요청**으로 부른다(각 단계가 300초를 온전히 받는다). ── */
    return NextResponse.json({
      phase: 'first',
      candidates, derivedAnswer, answerCheck,
      models: { first: env.geminiModel },
      usage: { inputTokens, outputTokens, costUsd: round4(usdFirst) },
    });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.userMessage);
    console.error('[verify] 예상치 못한 오류:', e);
    return fail(500, '검증 중 오류가 발생했습니다');
  }
}

/* ═══ 2차: 엄격 판정 (precision) ═══ */

async function runJudge(a: {
  kind: VerifyKind;
  judge: AIProvider;
  env: ReturnType<typeof readEnv>;
  problemBlocks: LabeledBlock[];
  solutionBlocks: LabeledBlock[];
  targetBlocks: LabeledBlock[];
  candidates: RawFinding[];
  derivedAnswer?: string;
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  carriedIn: number; carriedOut: number; carriedUsd: number;
  startedAt: number;
}) {
  const { kind, judge, env, problemBlocks, solutionBlocks, targetBlocks, candidates } = a;
  let inputTokens = a.carriedIn;
  let outputTokens = a.carriedOut;

  /* 앵커 확정: 모델의 [블록 n] 신고가 아니라 인용 실재성으로 정한다 (D10) */
  const anchors = candidates.map((c) => anchorByQuote(c.quote, targetBlocks));

  /* 예산 검사 — 이 단계가 시작도 못 할 만큼 늦었으면 부르지 않는다 (D13′) */
  if (PHASE_BUDGET_MS - (Date.now() - a.startedAt) <= 0) {
    throw new ApiError(504, '시간이 부족해 판정을 마치지 못했습니다 — 다시 시도하세요');
  }

  {
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
        derivedAnswer: a.derivedAnswer, answerCheck: a.answerCheck,
      }),
      usage: { inputTokens, outputTokens, costUsd: round4(a.carriedUsd + usdJudge) },
    });
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
