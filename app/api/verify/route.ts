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
import { priceFor, calcCostUsd, envPrice } from '../../../lib/aiPricing';
import {
  PROMPT_PROBLEM_FIRST, SOLUTION_FIRST_PASSES, PROMPT_JUDGE, PROMPT_GARBAGE_JUDGE, MERGE_CANDIDATE_CAP,
  fillTemplate, labelBlocks, formatCandidatesForJudge, totalChars, deriveAnswerFormat,
  type LabeledBlock, type FirstPass,
} from '../../../lib/verify/prompts';
import {
  parseAndRepair, sanitizeFindings, mergeCandidates, splitBySeverity, anchorByQuote, indexJudgments,
  normalizeTag, synthesizeVerdict, compareAnswer, repairLatexControlCharsInString,
  type RawFinding, type VerifyKind,
} from '../../../lib/verify/parse';
import { figureLabel, buildImageNote } from '../../../lib/verify/figures';
import { fetchFigures, type FigureSet } from '../../../lib/figureFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel: Hobby 최대 60s, Pro 최대 300s. 2콜 직렬이라 한도 최대치가 필요하다.
export const maxDuration = 300;

/** agent 컨텍스트와 같은 상한 (CommentPanel의 CONTEXT_CHAR_CAP). 초과분을 잘라서 검증하면
 *  "검증했다"는 거짓 신호가 남으므로 자르지 않고 거절한다. */
const MAX_INPUT_CHARS = 15_000;

/* 후보 상한은 `lib/verify/prompts.ts`가 단독 소유한다 (61g D9) —
   패스별 상한은 각 프롬프트 객체의 `cap`, 병합 상한은 `MERGE_CANDIDATE_CAP`.
   ⚠ 여기에 사본을 두지 말 것: 모델에게 알리는 수와 코드가 강제하는 수가 갈린다. */

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
/* ⚠ 이 값은 Anthropic SDK의 비스트리밍 가드 문턱(21,333)을 **넘는다**. 안전한 것은
   `ClaudeProvider`가 클라이언트에 timeout을 명시해 두었기 때문뿐이다(lib/ai-provider.ts
   `CLAUDE_REQUEST_TIMEOUT_MS` 주석 = 2026-09-11 사고). 그 명시를 지우면 2차 판정이
   요청도 못 보내고 전부 죽는다 — 프로브는 raw fetch라 멀쩡해서 더 찾기 어렵다. */

/** 단계별 시간 예산. maxDuration보다 앞에서 멈춰 Vercel의 강제 종료를 피한다.
 *  단계를 쪼갠 뒤로는 한 단계가 이 예산을 통째로 쓴다. */
const PHASE_BUDGET_MS = 280_000;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** 클라이언트로 내보낼 오류 문구에서 키처럼 보이는 토큰을 지운다(위 catch 주석 참조). */
const redactSecrets = (s: string) =>
  s.replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,})|(?:key|api[_-]?key|token)=[A-Za-z0-9_.-]{8,}/gi,
            '[redacted]');

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
  /** Phase 61h — 군더더기 절. 종합 판정(`verdict`)에 들어가지 않는다. 비면 필드 자체가 없다. */
  garbage?: VerifyFinding[];
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
  // Phase 61f — 그림 fetch의 D2 화이트리스트가 자기 버킷명을 요구한다.
  const bucket = need('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  // 허용목록은 시트 가져오기와 같은 사람이라 env를 재사용한다. 사용자 집합이 갈리는 날
  // VERIFY_ALLOWED_UIDS만 채우면 분리된다.
  const allowedRaw = process.env.VERIFY_ALLOWED_UIDS || process.env.AUDITION_ALLOWED_UIDS || '';
  if (!allowedRaw) missing.push('VERIFY_ALLOWED_UIDS (또는 AUDITION_ALLOWED_UIDS)');
  if (missing.length) {
    // 값은 절대 노출하지 않고 "어떤 변수가 없는지" 이름만 알린다.
    throw new ApiError(500, `서버 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
  }
  return {
    apiKey, bucket,
    allowedUids: allowedRaw.split(',').map((s) => s.trim()).filter(Boolean),
    geminiModel: process.env.VERIFY_GEMINI_MODEL || 'gemini-3.1-pro-preview',
    // 2026-09-10 Opus 4.8 → Opus 5 (같은 단가 $5/$25). 같은 행 10개 A/B: 4.8은 실재하는 표기 결함 4건(행 1543,
    // 기호가 깨져 흰 공·검은 공이 같은 ◯)을 전부 기각(기각률 92%)했고 Opus 5는 확정했다(기각률 50% = 베이스라인).
    // 판정 최장 52.6s → 38.1s. ⚠ thinking은 Opus 5에서 기본 켜짐이지만 `thinking:'adaptive'` 명시는 그대로 둔다.
    claudeModel: process.env.VERIFY_CLAUDE_MODEL || 'claude-opus-5',
    // F1: 2차 판정의 code_execution은 시트 STEP3에 전례가 없는 신규 요소다(그쪽 payload에는
    //     tools가 아예 없다). 기본 off로 두고 실측 후 켠다.
    judgeCodeExec: process.env.VERIFY_JUDGE_CODE_EXEC === '1',
    // M9 D15′ — 단가: env override(VERIFY_*_COST_IN/OUT) → lib/aiPricing 표 → warn + 0.
    //   옛 코드는 Claude 5/25 리터럴(모델을 바꿔도 남았다)과 Gemini env 기본 0이라 **운영의 1차 Gemini 비용이 $0**이었다(§1-C12).
    ...verifyPrices(
      process.env.VERIFY_CLAUDE_MODEL || 'claude-opus-5',
      process.env.VERIFY_GEMINI_MODEL || 'gemini-3.1-pro-preview',
    ),
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

    /* ── Phase 61f: 그림 실물 첨부 + 자리표시자 번호 확정 ──
       슬롯 = 미디어 타입 블록(등장 순서). 텍스트를 `[그림 k]` 계열로 덮어쓴 **뒤에**
       labelBlocks·anchorByQuote가 돌므로 앵커도 그 번호를 본다(D20).
       ⚠ `chars` 상한 검사는 이 위(자리표시자 4자 기준)에서 이미 끝났다 — 클라 셈법과 대칭.
       1차·2차가 같은 첨부를 쓰고, judge 단독 요청도 이 경로로 다시 fetch한다(D3). */
    const figBlocks = [...problemBlocks, ...solutionBlocks]
      .filter((b) => b.type === 'image' || b.type === 'svg' || b.type === 'ggb');
    const figs: FigureSet = await fetchFigures(
      figBlocks.map((b) => b.imageUrl ?? null), env.bucket, 'SVG/GeoGebra');
    figBlocks.forEach((b, i) => { b.text = figureLabel(figs.slotStatuses[i]); });
    const imageNote = buildImageNote(figs.attachedKs, figs.missing);

    const { first, judge } = getVerifyProviders({
      gemini: env.geminiModel, claude: env.claudeModel,
    });

    /* ═══ phase = 'judge' — 2차만 수행하고 끝낸다 ═══ */
    if (body.phase === 'judge') {
      const given = Array.isArray(body.candidates) ? body.candidates : [];
      if (given.length === 0) return fail(400, '판정할 후보가 없습니다');
      return await runJudge({
        kind, judge, env, problemBlocks, solutionBlocks, targetBlocks, figs, imageNote,
        candidates: given,
        derivedAnswer: body.derivedAnswer,
        answerCheck: body.answerCheck,
        carriedIn: 0, carriedOut: 0, carriedUsd: 0,
        startedAt,
      });
    }

    /* ── ❶ 1차: 후보 생성 (recall) ──
       문제 검증은 한 패스, 풀이 검증은 **계산·표기 / 논리 / 군더더기 세 패스**다(앞 둘은 시트
       STEP2·STEP3 구조, 셋째는 Phase 61h의 별도 축). 한 프롬프트에 태그를 다 넣으면 눈에 띄는
       표기·계산이 먼저 소모되고 논리가 묻힌다.
       ⚠ 호출은 **병렬**이다 — 직렬로 보내면 300초 예산이 무너진다. */
    const vars = {
      problem: labelBlocks(problemBlocks),
      solution: labelBlocks(solutionBlocks),
      format: deriveAnswerFormat({
        hasChoices: !!body.hasChoices,
        hasGanaOrRoman: !!body.hasGanaOrRoman,
        answer: String(body.answer ?? ''),
      }),
    };
    const passes: FirstPass[] = kind === 'problem' ? [PROMPT_PROBLEM_FIRST] : SOLUTION_FIRST_PASSES;

    const firstResults = await Promise.all(passes.map((pr) =>
      first.complete(pr.system, fillTemplate(pr.user, vars) + imageNote, FIRST_MAX_TOKENS, {
        geminiThinkingLevel: 'HIGH',
        geminiJsonMime: true,
        // Phase 61f — 두 패스·2차가 같은 첨부를 쓴다. 비면 바디는 기존과 바이트 동일(D10).
        ...(figs.parts.length ? { images: figs.parts } : {}),
      })));

    let inputTokens = 0;
    let outputTokens = 0;
    for (const r of firstResults) { inputTokens += r.inputTokens; outputTokens += r.outputTokens; }
    const usdFirst = cost(inputTokens, outputTokens, env.geminiCostIn, env.geminiCostOut);

    /* ⚠ 파싱 결과를 **그 패스와 짝지어** 들고 다닌다 (61g).
       `alive`는 null을 거른 배열이라, 여기서 `passes[i]`를 인덱스로 대응시키면
       한 패스가 실패했을 때 상한이 어긋난다(계산이 죽으면 논리 후보에 cap 8이 걸린다). */
    const firstParsed = firstResults.map((r, i) => ({
      pass: passes[i],
      json: parseAndRepair(r.content) as Record<string, unknown> | null,
    }));
    /* ⚠ 두 게이트(전부 실패 · 전부 skip)는 **결함 패스만** 본다 (Phase 61h E4·N1).
       군더더기 패스(`severity:'garbage'`)까지 세면 ① 결함 패스 둘이 다 죽어도 군더더기가 살아
       "ok + 군더더기"가 나오고 ② 결함 패스 둘이 그림 의존 skip이어도 `ok`가 나온다 — 61b D13′·
       61f B-8 계약이 조용히 깨진다. 군더더기 패스의 실패·skip은 "군더더기 없음"으로 흘린다. */
    const isParsed = (p: typeof firstParsed[number]): p is { pass: FirstPass; json: Record<string, unknown> } =>
      p.json !== null;
    const defectParsed = firstParsed.filter((p) => !p.pass.severity);
    // 결함 패스가 **전부** 실패했을 때만 오류다. 하나가 살면 그것으로 진행한다 —
    // 패스는 서로 독립이므로 한쪽 실패가 다른 쪽을 버릴 이유가 없다.
    if (defectParsed.every((p) => p.json === null)) {
      throw new ApiError(502, '1차 검토 응답을 해석하지 못했습니다 — 잠시 후 다시 시도하세요');
    }

    // 그림 의존으로 판단 불가 — AI가 스스로 내린 판정만 skip이 된다 (B-8).
    // 결함 패스가 다 skip일 때만 skip이다(한쪽만이면 나머지 패스의 후보를 살린다).
    const alive = firstParsed.filter(isParsed);
    const defectAlive = alive.filter((p) => !p.pass.severity);
    if (defectAlive.length > 0 && defectAlive.every((p) => p.json.skip === true)) {
      return NextResponse.json({
        report: report(kind, 'skip', [], {
          models: { first: env.geminiModel, judge: null },
          note: String(defectAlive[0]?.json.skip_reason || '그림을 보아야 판단할 수 있어 검증하지 않았습니다'),
        }),
        usage: { inputTokens, outputTokens, costUsd: round4(usdFirst) },
      });
    }

    const derivedAnswer = kind === 'problem'
      ? repairLatexControlCharsInString(String(defectAlive[0]?.json.derived_answer ?? '')).trim()
      : undefined;
    const answerCheck = kind === 'problem'
      ? compareAnswer(String(body.answer ?? ''), derivedAnswer)
      : undefined;

    // 61h — 군더더기 패스는 `severity`를 실어 정제한다(태그 정규화가 갈린다). 병합 키에도 severity가 들어가
    //   같은 인용의 결함·군더더기 후보가 둘 다 남는다. 순서는 이어 붙이기(결함 앞, 군더더기 뒤).
    const candidates = mergeCandidates(
      alive.map((p) => sanitizeFindings(p.json.candidates, kind, p.pass.cap, p.pass.severity)),
      MERGE_CANDIDATE_CAP,
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
    const quota = quotaExhaustedMessage(e);
    if (quota) {
      console.error('[verify] AI 할당량 초과:', quota);
      return fail(429, quota);
    }
    console.error('[verify] 예상치 못한 오류:', e);
    /* 사유를 함께 준다 — 2026-09-11 SDK 가드 사고 때 UI에도 서버 로그에도 "검증 중 오류가
       발생했습니다" 한 줄뿐이라 원인을 짚는 데 하루가 걸렸다.
       ⚠ 오늘의 세 SDK(Anthropic·OpenAI·Google)는 키를 **헤더**로 보내고 오류 메시지에 싣지
       않는 것을 확인했다(Gemini의 `RequestUrl.toString()`에도 key가 없다). 그래도 그대로
       흘리지는 않는다 — 이 사고 자체가 SDK 업그레이드로 동작이 바뀐 사례다. */
    const why = e instanceof Error && e.message ? `: ${redactSecrets(e.message).slice(0, 160)}` : '';
    return fail(500, `검증 중 오류가 발생했습니다${why}`);
  }
}

/**
 * 제공자 429(할당량 초과)를 사람이 읽을 메시지로 (2026-09-10 실측).
 *
 * 실측 사고: Gemini `GenerateRequestsPerDayPerProjectPerModel` = **250회/일**(gemini-3.1-pro)이
 * 프로브·일괄 검증으로 소진되자 이 라우트가 500 "예상치 못한 오류"를 돌려주고, 일괄 검증은
 * 429를 "한 건의 사정"으로 보고 3건 연속 실패 뒤 "연속 실패가 이어져 중단"만 남겼다 — 원인(할당량)과
 * 회복 시각(RetryInfo)이 어디에도 안 보였다. ⚠ 61h로 풀이 검증 1회당 Gemini 호출이 2 → **3**이 됐다
 * (문제 1 + 풀이 3 = 문항당 4회) — 38문항 배치 ≈ 152회라 250회/일의 6할이다.
 *
 * Google SDK 오류는 `status: 429` + `errorDetails[]`(QuotaFailure.violations · RetryInfo.retryDelay "Ns").
 * 다른 제공자도 `status`/`statusCode` 429면 같이 잡는다(세부는 없을 수 있다).
 */
function quotaExhaustedMessage(e: unknown): string | null {
  const o = (e ?? {}) as Record<string, unknown>;
  const status = Number(o.status ?? o.statusCode ?? NaN);
  const msg = String(o.message ?? '');
  if (status !== 429 && !/\b429\b|Too Many Requests|RESOURCE_EXHAUSTED/.test(msg)) return null;

  let retrySec = 0;
  let quota = '';
  const details = Array.isArray(o.errorDetails) ? o.errorDetails as Record<string, unknown>[] : [];
  for (const d of details) {
    const t = String(d['@type'] ?? '');
    if (t.endsWith('RetryInfo')) {
      const m = String(d.retryDelay ?? '').match(/^(\d+)/);
      if (m) retrySec = Number(m[1]);
    } else if (t.endsWith('QuotaFailure')) {
      const v = (Array.isArray(d.violations) ? d.violations[0] : null) as Record<string, unknown> | null;
      if (v) {
        const dims = (v.quotaDimensions ?? {}) as Record<string, unknown>;
        const perDay = /PerDay/i.test(String(v.quotaId ?? '')) ? '일일 ' : '';
        quota = ` (${perDay}${String(v.quotaValue ?? '?')}회${dims.model ? ` · ${String(dims.model)}` : ''})`;
      }
    }
  }
  let when = '잠시 후';
  if (retrySec >= 3600) {
    const at = new Date(Date.now() + retrySec * 1000);
    const hh = String(at.getHours()).padStart(2, '0');
    const mm = String(at.getMinutes()).padStart(2, '0');
    when = `약 ${Math.ceil(retrySec / 3600)}시간 뒤(${at.getMonth() + 1}/${at.getDate()} ${hh}:${mm} 이후)`;
  } else if (retrySec > 0) {
    when = `${Math.ceil(retrySec)}초 뒤`;
  }
  return `AI 할당량 초과${quota} — ${when} 다시 시도하세요`;
}

/* ═══ 2차: 엄격 판정 (precision) ═══ */

async function runJudge(a: {
  kind: VerifyKind;
  judge: AIProvider;
  env: ReturnType<typeof readEnv>;
  problemBlocks: LabeledBlock[];
  solutionBlocks: LabeledBlock[];
  targetBlocks: LabeledBlock[];
  /** Phase 61f — 핸들러가 이미 fetch·번호 확정을 끝낸 결과 (블록 text는 `[그림 k]` 계열) */
  figs: FigureSet;
  imageNote: string;
  candidates: RawFinding[];
  derivedAnswer?: string;
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  carriedIn: number; carriedOut: number; carriedUsd: number;
  startedAt: number;
}) {
  const { kind, judge, env, problemBlocks, solutionBlocks, targetBlocks, candidates } = a;
  let inputTokens = a.carriedIn;
  let outputTokens = a.carriedOut;

  /* 앵커 확정: 모델의 [블록 n] 신고가 아니라 인용 실재성으로 정한다 (D10).
     61h — id 키 Map. 병합 후 id는 유일하고(문제 검증의 c0 unshift도 재부여) 두 판정 배열이 공용한다. */
  const anchors = new Map(candidates.map((c) => [c.id, anchorByQuote(c.quote, targetBlocks)] as const));

  /* Phase 61h — 결함 후보와 군더더기 후보는 **판정자가 다르다**(성향이 반대 — D4).
     옛 클라이언트가 severity 없이 되돌린 후보는 전부 결함이다(G3). */
  const { defect, garbage } = splitBySeverity(candidates);

  /* 예산 검사 — 이 단계가 시작도 못 할 만큼 늦었으면 부르지 않는다 (D13′) */
  if (PHASE_BUDGET_MS - (Date.now() - a.startedAt) <= 0) {
    throw new ApiError(504, '시간이 부족해 판정을 마치지 못했습니다 — 다시 시도하세요');
  }

  {
    const judgeVars = {
      problem: labelBlocks(problemBlocks),
      solution: kind === 'problem' ? labelBlocks(problemBlocks) : labelBlocks(solutionBlocks),
    };
    const judgeOpts = {
      // ⚠ Opus 4.8은 thinking을 생략하면 사고가 꺼진 채 돈다. 시트 STEP3와 같은 설정.
      thinking: 'adaptive' as const,
      effort: 'high' as const,
      // F1: 시트에 전례가 없는 신규 요소라 env로 켠다. tool_choice 강제는 절대 하지 않는다
      //     (도구 호출을 강제하면 모델이 최종 JSON 턴을 낼 수 없다).
      enableCodeExecution: env.judgeCodeExec,
      // Phase 61f D3 — 2차도 같은 첨부를 본다. 비면 바디는 기존과 바이트 동일(D10).
      ...(a.figs.parts.length ? { images: a.figs.parts } : {}),
    };

    /* ⚠ 두 판정은 **병렬**이다(61h D3·D4). 결함 판정이 없으면(군더더기 후보만) 그쪽은 부르지 않는다. */
    const [dRes, gRes] = await Promise.all([
      defect.length
        ? judge.complete(PROMPT_JUDGE.system,
            fillTemplate(PROMPT_JUDGE.user, { ...judgeVars, candidates: formatCandidatesForJudge(defect) }) + a.imageNote,
            JUDGE_MAX_TOKENS, judgeOpts)
        : null,
      garbage.length
        ? judge.complete(PROMPT_GARBAGE_JUDGE.system,
            fillTemplate(PROMPT_GARBAGE_JUDGE.user, { ...judgeVars, candidates: formatCandidatesForJudge(garbage) }) + a.imageNote,
            JUDGE_MAX_TOKENS, judgeOpts)
        : null,
    ]);
    let usdJudge = 0;
    for (const r of [dRes, gRes]) {
      if (!r) continue;
      inputTokens += r.inputTokens;
      outputTokens += r.outputTokens;
      usdJudge += cost(r.inputTokens, r.outputTokens, env.claudeCostIn, env.claudeCostOut);
    }

    /* 결함 판정 실패 = 리포트 없음 (D13′ 그대로) */
    let judgments: unknown[] = [];
    if (dRes) {
      if (dRes.truncated) {
        throw new ApiError(502, '판정이 도구 호출 상한에서 끊겼습니다 — 다시 시도하세요');
      }
      const judgeJson = parseAndRepair(dRes.content) as Record<string, unknown> | null;
      if (!Array.isArray(judgeJson?.judgments)) {
        throw new ApiError(502, '판정 응답을 해석하지 못했습니다 — 다시 시도하세요');
      }
      judgments = judgeJson.judgments;
    }
    /* 군더더기 판정 실패 = 결함 리포트는 살리고 군더더기 절만 뺀다 (61h N2).
       별도 축이고 종합 판정 무영향이라 D13′의 보호 대상(결함 판정)은 훼손되지 않고, 1차 후보도 노출하지
       않는다. 전체 실패로 두면 재시도가 1차 3호출 + 2차 2호출을 통째로 다시 쓴다. */
    let garbageJudgments: unknown[] | null = null;
    if (gRes && !gRes.truncated) {
      const gj = parseAndRepair(gRes.content) as Record<string, unknown> | null;
      if (Array.isArray(gj?.judgments)) garbageJudgments = gj.judgments;
    }
    const garbageJudgeFailed = garbage.length > 0 && garbageJudgments === null;

    /* ── ❼ 합성: 코드가 어휘를 정한다 ── */
    const rulings = indexJudgments(judgments);
    const findings: VerifyFinding[] = [];
    defect.forEach((c) => {
      const j = rulings[c.id];
      const ruling = j?.ruling ?? 'uncertain';   // 판정 누락은 uncertain (시트와 동일)
      if (ruling === 'invalid') return;          // 기각된 후보는 사라진다

      const anchor = anchors.get(c.id)!;
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

    /* 61h — 군더더기 합성. `report.garbage`는 종합 판정에 들어가지 않는다(D2).
       escalate(판정자가 "이건 결함")만 `findings`에 **`check`**로 넘어간다 — `fail`은 절대 아니다(D5). */
    const gRul = indexJudgments(garbageJudgments ?? []);
    const garbageOut: VerifyFinding[] = [];
    if (!garbageJudgeFailed) {
      garbage.forEach((c) => {
        const j = gRul[c.id];
        const ruling = j?.ruling ?? 'uncertain';
        const anchor = anchors.get(c.id)!;
        if (j?.escalate) {
          findings.push({
            tag: normalizeTag(j.escalateTag, 'solution'),   // 빈 값이면 `논리오류` 폴백(G4)
            verdict: 'check',
            blockKey: anchor.blockKey,
            quote: c.quote,
            reason: `[군더더기 검토에서 격상] ${j.note || c.reason}`,   // N4 — 결함 절에 섞이므로 출처를 남긴다
            quoteFound: anchor.found,
          });
          return;
        }
        if (ruling === 'invalid') return;
        // 프로브 실측(Stage 3 행 2001): uncertain인데 suggestion에 "삭제"가 온다 — 프롬프트 [3]의 "valid일 때만"을
        // 모델이 안 지킨다. 어휘는 코드가 정한다 → 확정(valid)일 때만 제안을 싣는다.
        const suggestion = ruling === 'valid' ? (j?.suggestion || c.suggestion || '') : '';
        garbageOut.push({
          tag: c.tag,
          verdict: ruling === 'valid' && anchor.found ? 'fail' : 'check',
          blockKey: anchor.blockKey,
          quote: c.quote,
          reason: j?.note || c.reason,
          ...(suggestion ? { suggestion } : {}),
          quoteFound: anchor.found,
        });
      });
    }

    const notes: string[] = [];
    // Phase 61f — 누락 그림은 사람이 알아야 한다 (Y열 fig_info의 등가물)
    if (a.figs.missing.length) {
      notes.push(`첨부되지 않은 그림 ${a.figs.missing.length}장: ${a.figs.missing.map((m) => `[그림 ${m.k} — ${m.reason}]`).join(', ')}`);
    }
    if (garbageJudgeFailed) notes.push('군더더기 판정 실패 — 이번 리포트에 군더더기 절 없음');

    return NextResponse.json({
      report: report(kind, synthesizeVerdict(findings), findings, {
        models: { first: env.geminiModel, judge: env.claudeModel },
        derivedAnswer: a.derivedAnswer, answerCheck: a.answerCheck,
        garbage: garbageOut,
        ...(notes.length ? { note: notes.join(' · ') } : {}),
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
      // Phase 61f — imageUrl을 함께 실어야 한다(이 함수는 받은 객체를 **재구성**한다 — v2 C1).
      //   화이트리스트 판정은 여기서 하지 않는다: planSlots가 하면 탈락 사유가
      //   "허용되지 않는 그림 주소"로 정확히 남는다.
      const imageUrl = typeof o.imageUrl === 'string' && o.imageUrl ? { imageUrl: o.imageUrl } : {};
      // M7 D20 — 경우 라벨(C1·C2a)도 같은 이유로 여기서 실어야 한다
      const caseLabel = typeof o.caseLabel === 'string' && o.caseLabel ? { caseLabel: o.caseLabel } : {};
      return {
        blockKey: String(o.blockKey ?? ''),
        type: String(o.type ?? 'text'),
        text: String(o.text ?? ''),
        ...imageUrl,
        ...caseLabel,
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
    /** 61h — 비면 필드를 싣지 않는다(옛 리포트와 JSON 동일) */
    garbage?: VerifyFinding[];
  },
): VerifyReport {
  return {
    kind, verdict, findings,
    ...(extra.garbage && extra.garbage.length ? { garbage: extra.garbage } : {}),
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
  return calcCostUsd(inTok, outTok, { in: inPerM, out: outPerM });
}

/** M9 D15′ — env override가 있으면 그것, 없으면 표. 둘 다 없으면 warn + 0(모른다는 것이 틀린 값보다 낫다) */
function verifyPrices(claudeModel: string, geminiModel: string) {
  const pick = (model: string, prefix: 'CLAUDE' | 'GEMINI') => {
    const inEnv = envPrice(process.env[`VERIFY_${prefix}_COST_IN`]);
    const outEnv = envPrice(process.env[`VERIFY_${prefix}_COST_OUT`]);
    const table = priceFor(model);
    if (inEnv === null && outEnv === null && !table) console.warn('[aiPricing] 단가 없음 — 비용 0으로 기록', model);
    return { in: inEnv ?? table?.in ?? 0, out: outEnv ?? table?.out ?? 0 };
  };
  const c = pick(claudeModel, 'CLAUDE');
  const g = pick(geminiModel, 'GEMINI');
  return { claudeCostIn: c.in, claudeCostOut: c.out, geminiCostIn: g.in, geminiCostOut: g.out };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
