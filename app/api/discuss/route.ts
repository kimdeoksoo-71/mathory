/**
 * Phase 37-B: AI 토론 API 라우트
 *
 * 한 메시지를 받아 지정된 AI 모델에게 전달하고 응답을 반환한다.
 * 컨텍스트 조립(탭별 차등, 히스토리 컷오프)은 클라이언트가 수행 — 서버는 받은 그대로 프롬프트로 합성.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getModelConfig } from '../../../lib/ai-models';
import { getProviderForModel, type AIProvider } from '../../../lib/ai-provider';
import type { AIModelConfig } from '../../../types/problem';

export const runtime = 'nodejs';
// Vercel: Hobby 최대 60s, Pro 최대 300s.
// reasoning 모델(식·민)이 고난도 문제에 길게 사고할 수 있도록 Pro 한도 최대치(300)로 설정.
// 운영은 Vercel Pro 플랜 필수 (Hobby에선 60초에서 강제 종료됨).
export const maxDuration = 300;

interface DiscussionMessage {
  role: 'human' | 'ai';
  nickname: string;
  content: string;
}

interface DiscussRequest {
  modelId: string;
  problemContent: string;
  currentTabContent?: string;
  currentTabLabel?: string;
  discussionHistory: DiscussionMessage[];
  participantNicknames: string[];
  myNickname: string;
  currentMessage: string;
}

interface DiscussSuccess {
  modelId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const TIMEOUT_MS = 280_000;

const BASE_SYSTEM_PROMPT = `당신은 한국 고등학교 수학 토론에 참여하는 전문가입니다.

⚠️ 최우선 출력 규칙 (반드시 지킬 것, 위반 시 응답이 무효 처리됩니다):
**모든 수식은 반드시 KaTeX 호환 LaTeX 문법으로 감싸세요.**
- 인라인 수식: \`$...$\` (예: $f(x) = x^2$)
- 블록 수식: \`$$...$$\` (예: $$\\int_0^1 x \\, dx = \\dfrac{1}{2}$$)
- 일반 텍스트 안에 변수·식·숫자 계산이 들어가면 반드시 \`$\`로 감싸세요.

좋은 예:
  "이차함수 $f(x) = (x-2)^2 - 1$의 최솟값은 $-1$이다."
나쁜 예 (절대 금지 — 이렇게 쓰지 마세요):
  "이차함수 f(x) = (x-2)^2 - 1의 최솟값은 -1이다." (← \`$\` 없음)
  "f(x)=x^2-4x+3" (← LaTeX 래핑 없이 본문에 식)
  "x squared minus 4x plus 3" (← 자연어 수식)

위 규칙은 모든 모델에 동일하게 적용되며 예외 없음. 짧은 변수 하나(예: $x$)라도 반드시 \`$\`로 감싸세요.

⚠️ 두 번째 최우선 규칙 — 사고 과정을 출력에 적지 마세요:
당신은 답하기 전 머릿속으로 충분히 사고할 수 있지만, **사고의 과정을 그대로 옮겨 적는 것은 금지**입니다.
사람이 보는 것은 결론과 그 결정적 근거뿐. "먼저 ~를 계산하면 ~가 되고, 이를 정리하면 ~가 되며, 따라서…" 식의 단계 나열은 본인의 사고 흐름일 뿐 사용자에게 가치 없음.

좋은 예 (출력):
  "풀이는 옳음. $(x-2)^2 \\ge 0$에서 최솟값 $-1$ 직접 도출."
나쁜 예 (출력 — 사고 과정을 그대로 쏟아냄):
  "먼저 주어진 함수를 살펴봅시다. $f(x) = x^2 - 4x + 3$이라는 이차함수가 주어져 있습니다.
   이차함수의 최솟값을 구하려면 완전제곱식 형태로 바꿔야 합니다.
   $x^2 - 4x$ 부분을 완전제곱식으로 만들기 위해... 따라서... 정리하면..."

장황한 사고 과정 서술은 **응답이 무효 처리되는 사유**입니다.

토론 규칙:
1. 토론 히스토리의 모든 발언(사람, AI 구분 없이)을 전체 맥락으로 읽고, 비판적으로 평가하세요.
2. 다른 참여자의 의견에 동의하면 그 이유를, 반대하면 논리적 근거를 명확히 제시하세요.
3. 풀이의 논리적 결함, 비약, 계산 오류를 예리하게 지적하세요.
4. 대안적 풀이 방법이 있다면 제시하세요.
5. **답변 형식 — 결론 우선 (Top-down) 엄수**:
   - 첫 줄: **결론 한 문장** (예: "풀이는 옳다", "3번째 줄에 오류", "별해 있음")
   - 다음 줄들: 그 결론의 **결정적 근거 1~5줄**
   - 전체 한국어 **800자 이내** (고난도 문제로 검증 단계가 길게 필요하면 1200자까지 허용)
   - **금지**:
     · 사고 과정 서술 ("먼저 ~를 살펴보면", "이를 정리하면", "다음과 같이 계산하면", "따라서 ~한 결과를 얻고", "이로부터 ~를 알 수 있으므로")
     · 단계 나열 (1./2./3./… 번호로 풀이 재작성)
     · 일반론 서론 ("이 문제는 ~를 묻고 있습니다", "이차함수의 성질을 이용하면")
     · 동일 결론 반복, "또한·추가로·참고로"로 이어지는 부연
   - ✓ 좋은 예: "풀이는 옳음. $(x-2)^2 \\ge 0$에서 최솟값 $-1$이 직접 도출되며 부호 조건도 만족."
   - ✗ 나쁜 예: "이 문제를 풀이하려면 먼저 완전제곱식으로 변형해야 합니다. $f(x) = x^2 - 4x + 3$에서 시작하여 $(x-2)^2 - 1$로 정리하면... 다음으로 우리는... 따라서..."
6. "AI로서", "제 생각에는" 같은 메타 표현은 쓰지 마세요. 바로 본론으로 들어가세요.
7. 곱셈 기호는 \\times, 분수에서는 \\dfrac를 사용하세요. \\cdot, \\frac는 쓰지 마세요.
8. \\tag{}, \\ref{} 등 Mathory 전용 매크로는 사용하지 마세요. 표준 KaTeX만 사용하세요.
9. 다른 토론자를 언급할 때는 닉네임(한 음절)으로 부르세요. "Gemini 3.1 Pro가 말한 것처럼"이 아니라 "민이 말한 것처럼"으로.
10. **세션 독립성**: 아래 "토론 히스토리"에 명시적으로 나오지 않은 내용은 절대 참조하지 마세요. "앞서 논의한 대로", "이전에 말씀드렸듯이" 같은 표현으로 히스토리에 없는 가공의 맥락을 만들지 마세요. 히스토리가 비어있으면 첫 발언으로 간주하고 처음부터 답하세요.
11. **답변 전 의무 검산** (내부적으로만, 출력에 적지 말 것): 결론을 출력하기 전 머릿속으로 확인:
    (a) 수식 변형의 각 단계가 등가인가? (예: 인수분해, 완전제곱, 양변 조작)
    (b) 숫자 대입과 산술이 정확한가? (간단한 계산도 한 번 더)
    (c) 도출한 결론이 문제의 모든 조건을 만족하는가? (정의역·치역·부호 조건 등)
    검산에서 오류 발견 시 결론을 수정해서 출력. **검산 과정 자체는 출력에 쓰지 마세요** ("확인해보면", "다시 계산하면" 같은 메타 서술 금지). 자신 없으면 한 줄로 "검토 필요"만 명시. 추측·직관만으로 단정짓지 마세요.`;

/**
 * 식(DeepSeek) 전용 — 출력 구조 강제용 JSON 스키마 지침.
 * thinking을 보존하면서 표시는 짧게 압축하기 위해 응답 형식 자체를 JSON으로 고정.
 */
const STRUCTURED_OUTPUT_INSTRUCTION = `

⚠️ 출력 형식 강제 (식 전용 — 이 규칙이 위 모든 규칙보다 우선):

이 응답은 **반드시 아래 JSON 형식만으로** 반환하세요. JSON 외의 텍스트(설명, 사고 과정, 코드 펜스 \`\`\` 등) 절대 포함 금지.

스키마:
{
  "conclusion": "결론 한 문장. 50단어 이하. 풀이가 옳음/오류 위치/별해 등.",
  "reasons": ["이유 문장 1", "이유 문장 2", "..."]
}

규칙:
- "conclusion": 정확히 1문장. 50단어 이하.
- "reasons": 최대 4개 항목. 각 항목 1문장, 50단어 이하.
- 결론과 이유에 LaTeX 수식 그대로 포함 가능 ($...$).
- 사고 과정·중간 단계·"확인해보면" 같은 메타 서술 모두 금지.

좋은 예시:
{
  "conclusion": "풀이는 옳음.",
  "reasons": ["완전제곱식 변형이 등가.", "최솟값 $-1$ 직접 도출.", "부호 조건 만족."]
}

나쁜 예시 (절대 금지):
- JSON 밖에 설명 추가
- "conclusion"이 2문장 이상
- reasons가 5개 이상
- 한 항목이 50단어 초과
- 코드 펜스로 감싸기 (\`\`\`json ... \`\`\`)`;

/**
 * Phase 41: 검산 도구(SymPy/Python code execution)가 활성화된 모델(민·쳇)에만 추가하는 지침.
 * BASE_SYSTEM_PROMPT 규칙 #11 다음에 #12로 이어붙는다.
 */
const CODE_EXEC_INSTRUCTION = `
12. **검산 도구 (SymPy/Python 코드 실행)**:
- 사용자가 "검산해줘", "코드로 확인", "파이썬으로" 등을 명시하면 반드시 코드를 실행해 검증하세요.
- 명시가 없어도 본인 판단으로 수치·대수 결과의 정확성이 의심되면 자유롭게 실행 가능.
- 사용자가 검증 대상을 지정했으면 그것만 검증. 임의로 다른 부분까지 확장 검증 금지.
- 코드는 짧고 한 목적만 — print로 결과를 명확히 출력.
- ⚠️ **반드시 기호(exact) 계산만 사용**: 소수점 숫자(예: 0.5, 3.14, 1.414…) 사용 금지. \`sympy.Rational\`·\`sympy.sqrt\`·\`pi\`·\`S()\` 등으로 분수·무리수를 정확값 그대로 다루세요. \`float()\`, \`.evalf()\`, \`N()\`, \`math\` 모듈, 소수 리터럴은 사용 금지입니다.
- ⚠️ **근사값(수치 근사)으로 결론 내는 것 절대 금지**: "≈ 0.333이므로 1/3" 같은 근사 비교로 검증하지 말고, 기호 계산 결과가 정확히 같은지(\`==\`, \`simplify(a-b)==0\`, \`Eq\`)로만 판정하세요.
- 검산 결과는 최종 결론에 **자연어로만** 반영하세요.
- ⚠️ **본문(결론)에는 절대로 코드 블록(\`\`\`python …\`\`\`)이나 실행 출력 텍스트를 적지 마세요.** 실행한 코드와 출력은 시스템이 자동으로 별도 부록(<details>)에 첨부합니다. 본문에 코드를 또 적으면 사용자에게 동일 코드가 **두 번** 보여 무효 처리됩니다. 본문엔 코드 없이 "검산 결과 ~로 확인됨" 같은 자연어 결론만 남기세요.`;

function buildSystemPrompt(args: {
  appendPrompt: string;
  participantNicknames: string[];
  myNickname: string;
  structuredOutput?: boolean;
  codeExecution?: boolean;
}): string {
  const participants = args.participantNicknames.length
    ? args.participantNicknames.join(', ')
    : '(없음)';
  const lines = [
    BASE_SYSTEM_PROMPT,
    '',
    `참여 토론자: ${participants}`,
    `당신의 닉네임: ${args.myNickname}`,
  ];
  // 검산 도구 지침은 BASE 규칙 #11 바로 뒤(#12)에 이어붙는 것이 자연스러움
  if (args.codeExecution) {
    lines.push(CODE_EXEC_INSTRUCTION);
  }
  if (args.appendPrompt.trim()) {
    lines.push('', `[추가 지침] ${args.appendPrompt.trim()}`);
  }
  if (args.structuredOutput) {
    lines.push(STRUCTURED_OUTPUT_INSTRUCTION);
  }
  return lines.join('\n');
}

/** 식 호출 시 user message 끝에 강제 부착 (B3) — 시스템 프롬프트보다 강한 압박 */
const USER_MESSAGE_STRUCTURED_SUFFIX =
  '\n\n[필수 출력 규칙] 사고 과정 적지 말고 JSON 스키마 그대로만 답하기. ' +
  '"conclusion": 1문장 50단어 이하, "reasons": 0~4문장 각 50단어 이하. JSON 외 텍스트 금지.';

/** Phase 41: 사용자가 명시적으로 검산을 요구했는지 감지 (민·쳇 코드 실행 강제용) */
const CODE_EXEC_TRIGGER_RE = /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i;

/** 검산 명시 요청 시 user message 끝에 강제 부착 — 코드 실행 없이 답변 금지 */
const USER_MESSAGE_CODEEXEC_SUFFIX =
  '\n\n[필수] 이 메시지는 명시적인 검산 요청입니다. 추론만으로 답하지 말고 ' +
  '반드시 Python(SymPy) 코드를 **실제로 실행**해 결과를 확인한 뒤 결론을 내세요. ' +
  '코드 실행 없이 답하면 응답이 무효 처리됩니다. (코드/출력은 시스템이 자동 첨부하므로 본문엔 자연어 결론만 적으세요.)';

/** 식 응답(JSON)을 마크다운으로 변환 — 파싱 실패 시 원본 폴백 */
function formatStructuredResponse(raw: string): string {
  const trimmed = raw.trim();
  // 코드 펜스 제거 (\`\`\`json ... \`\`\` 패턴)
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonStr = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    const parsed = JSON.parse(jsonStr);
    const conclusion = typeof parsed.conclusion === 'string' ? parsed.conclusion.trim() : '';
    const reasonsRaw = Array.isArray(parsed.reasons) ? parsed.reasons : [];
    const reasons = reasonsRaw
      .map((r: unknown) => (typeof r === 'string' ? r.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
    const parts: string[] = [];
    if (conclusion) parts.push(`**[결론]** ${conclusion}`);
    if (reasons.length) parts.push(reasons.map((r: string) => `- ${r}`).join('\n'));
    if (!parts.length) return raw; // 빈 응답이면 원본 유지
    return parts.join('\n\n');
  } catch {
    // JSON 파싱 실패 — 원본을 그대로 보여주되 안내 한 줄 추가
    return `_(JSON 형식 위반 — 원본 표시)_\n\n${raw}`;
  }
}

/** 식(DeepSeek) 여부 판정 — provider 기반 */
function isStructuredOutputModel(config: AIModelConfig): boolean {
  return config.provider === 'deepseek';
}

/** 검산 도구(code execution) 활성 모델 판정 — 민(google)·쳇(openai) (Phase 41) */
function isCodeExecutionModel(config: AIModelConfig): boolean {
  return config.provider === 'google' || config.provider === 'openai';
}

function buildUserPrompt(body: DiscussRequest): string {
  const parts: string[] = [];

  parts.push('## 문제:');
  parts.push(body.problemContent || '(문제 내용 없음)');

  if (body.currentTabContent && body.currentTabLabel) {
    parts.push('');
    parts.push(`## 현재 풀이 (탭: ${body.currentTabLabel}):`);
    parts.push(body.currentTabContent);
  }

  if (body.discussionHistory.length) {
    parts.push('');
    parts.push('## 토론 히스토리 (현재 세션):');
    body.discussionHistory.forEach((msg) => {
      parts.push(`[${msg.nickname}] ${msg.content}`);
    });
  }

  parts.push('');
  parts.push('## 현재 메시지:');
  parts.push(body.currentMessage);

  return parts.join('\n');
}

function calcCost(
  inputTokens: number,
  outputTokens: number,
  inputPerMillion: number,
  outputPerMillion: number,
): number {
  return (
    (inputTokens / 1_000_000) * inputPerMillion +
    (outputTokens / 1_000_000) * outputPerMillion
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI 응답 시간 초과 (약 4.5분)')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function validate(body: Partial<DiscussRequest>): string | null {
  if (!body.modelId || typeof body.modelId !== 'string') return 'modelId가 필요합니다';
  if (typeof body.problemContent !== 'string') return 'problemContent가 필요합니다';
  if (!body.currentMessage || typeof body.currentMessage !== 'string')
    return 'currentMessage가 필요합니다';
  if (!Array.isArray(body.discussionHistory)) return 'discussionHistory는 배열이어야 합니다';
  if (!Array.isArray(body.participantNicknames))
    return 'participantNicknames는 배열이어야 합니다';
  if (!body.myNickname || typeof body.myNickname !== 'string')
    return 'myNickname이 필요합니다';
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse<DiscussSuccess | { error: string; modelId?: string }>> {
  let body: DiscussRequest;
  try {
    body = (await req.json()) as DiscussRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 형식입니다' }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const config = await getModelConfig(body.modelId);
  if (!config) {
    return NextResponse.json(
      { error: `등록되지 않은 모델: ${body.modelId}`, modelId: body.modelId },
      { status: 404 },
    );
  }
  if (!config.enabled) {
    return NextResponse.json(
      { error: `비활성화된 모델: ${body.modelId}`, modelId: body.modelId },
      { status: 403 },
    );
  }

  let provider: AIProvider;
  try {
    provider = getProviderForModel(config);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'provider 초기화 실패';
    return NextResponse.json({ error: msg, modelId: body.modelId }, { status: 500 });
  }

  const structured = isStructuredOutputModel(config);
  const codeExecution = isCodeExecutionModel(config);

  const systemPrompt = buildSystemPrompt({
    appendPrompt: config.appendPrompt,
    participantNicknames: body.participantNicknames,
    myNickname: body.myNickname,
    structuredOutput: structured,
    codeExecution,
  });
  // 검산 명시 요청 감지 — 민·쳇은 코드 실행을 강제 (Phase 41)
  const codeExecForced = codeExecution && CODE_EXEC_TRIGGER_RE.test(body.currentMessage);

  // user message 끝에 출력 규칙 강제 부착 — 시스템 프롬프트보다 강하게 작동
  // (식: JSON 스키마 강제 / 민·쳇: 검산 명시 시 코드 실행 강제. provider가 달라 동시 적용 없음)
  let currentMessage = body.currentMessage;
  if (structured) currentMessage += USER_MESSAGE_STRUCTURED_SUFFIX;
  if (codeExecForced) currentMessage += USER_MESSAGE_CODEEXEC_SUFFIX;
  const promptBody: DiscussRequest =
    currentMessage === body.currentMessage ? body : { ...body, currentMessage };
  const userPrompt = buildUserPrompt(promptBody);

  try {
    const result = await withTimeout(
      provider.complete(systemPrompt, userPrompt, config.maxTokens, { jsonMode: structured }),
      TIMEOUT_MS,
    );
    // 식: JSON 응답을 마크다운으로 변환 (실패 시 원본 폴백)
    const finalContent = structured ? formatStructuredResponse(result.content) : result.content;
    // Phase 41 비용: Gemini code execution은 토큰에 산입되므로 그대로 반영.
    // OpenAI code_interpreter 컨테이너 시간은 별도 청구되지만 여기선 입출력 토큰만 카운트한다.
    const costUsd = calcCost(
      result.inputTokens,
      result.outputTokens,
      config.inputCostPerMillion,
      config.outputCostPerMillion,
    );
    return NextResponse.json({
      modelId: config.modelId,
      content: finalContent,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI 호출 실패';
    console.error(`[discuss] ${body.modelId} 실패:`, msg);
    return NextResponse.json(
      { error: msg, modelId: body.modelId },
      { status: 500 },
    );
  }
}
