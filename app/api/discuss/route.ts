/**
 * Phase 37-B: AI 토론 API 라우트
 *
 * 한 메시지를 받아 지정된 AI 모델에게 전달하고 응답을 반환한다.
 * 컨텍스트 조립(탭별 차등, 히스토리 컷오프)은 클라이언트가 수행 — 서버는 받은 그대로 프롬프트로 합성.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getModelConfig } from '../../../lib/ai-models';
import { getProviderForModel, type AIProvider } from '../../../lib/ai-provider';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

const TIMEOUT_MS = 30_000;

const BASE_SYSTEM_PROMPT = `당신은 한국 고등학교 수학 토론에 참여하는 전문가입니다.

토론 규칙:
1. 수식은 KaTeX 호환 LaTeX로 작성하세요. 인라인: $...$, 블록: $$...$$
2. 토론 히스토리의 모든 발언(사람, AI 구분 없이)을 전체 맥락으로 읽고, 비판적으로 평가하세요.
3. 다른 참여자의 의견에 동의하면 그 이유를, 반대하면 논리적 근거를 명확히 제시하세요.
4. 풀이의 논리적 결함, 비약, 계산 오류를 예리하게 지적하세요.
5. 대안적 풀이 방법이 있다면 제시하세요.
6. 답변은 간결하게 핵심만 전달하세요 (800자 이내 권장).
7. "AI로서", "제 생각에는" 같은 메타 표현은 쓰지 마세요. 바로 본론으로 들어가세요.
8. 곱셈 기호는 \\times, 분수에서는 \\dfrac를 사용하세요.
9. \\tag{}, \\ref{} 등 Mathory 전용 매크로는 사용하지 마세요. 표준 KaTeX만 사용하세요.
10. 다른 토론자를 언급할 때는 닉네임(한 음절)으로 부르세요. "Gemini 3.1 Pro가 말한 것처럼"이 아니라 "민이 말한 것처럼"으로.`;

function buildSystemPrompt(args: {
  appendPrompt: string;
  participantNicknames: string[];
  myNickname: string;
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
  if (args.appendPrompt.trim()) {
    lines.push('', `[추가 지침] ${args.appendPrompt.trim()}`);
  }
  return lines.join('\n');
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
    timer = setTimeout(() => reject(new Error('AI 응답 시간 초과 (30초)')), ms);
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

  const systemPrompt = buildSystemPrompt({
    appendPrompt: config.appendPrompt,
    participantNicknames: body.participantNicknames,
    myNickname: body.myNickname,
  });
  const userPrompt = buildUserPrompt(body);

  try {
    const result = await withTimeout(
      provider.complete(systemPrompt, userPrompt, config.maxTokens),
      TIMEOUT_MS,
    );
    const costUsd = calcCost(
      result.inputTokens,
      result.outputTokens,
      config.inputCostPerMillion,
      config.outputCostPerMillion,
    );
    return NextResponse.json({
      modelId: config.modelId,
      content: result.content,
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
