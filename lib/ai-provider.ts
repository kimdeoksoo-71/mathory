import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIModelConfig } from '../types/problem';

export interface AIProviderResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  /** 통계용: 응답에 코드 실행(SymPy 검산)이 포함되었는지 */
  hasCodeExecution?: boolean;
}

/**
 * Gemini/GPT 응답의 코드 실행 파트를 접힌 `<details>` 마크다운 부록으로 직렬화.
 * 본문(body) 뒤에 검산 코드+실행결과를 붙여 반환. 코드 블록이 없으면 body 그대로.
 */
function appendCodeExecDetails(
  body: string,
  codeBlocks: Array<{ code: string; output: string }>,
): string {
  if (codeBlocks.length === 0) return body;
  const details = codeBlocks
    .map(
      (b) =>
        `\n\`\`\`python\n${b.code}\n\`\`\`\n\n실행 결과:\n\`\`\`\n${b.output}\n\`\`\``,
    )
    .join('\n\n---\n\n');
  return `${body}\n\n<details>\n<summary>🔍 검산 코드 (${codeBlocks.length}개)</summary>\n${details}\n</details>`;
}

export interface CompleteOptions {
  /** OpenAI 호환 provider에서 response_format을 json_object로 강제 (식 전용) */
  jsonMode?: boolean;
}

export interface AIProvider {
  complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number,
    opts?: CompleteOptions,
  ): Promise<AIProviderResult>;
}

// ═══ 기존 단일 모델 호환 (Phase 23 AI 풀이 자동완성에서 사용) ═══

class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  /** SymPy 검산용 code execution tool 활성화 (Phase 41) */
  private enableCodeExecution: boolean;

  constructor(apiKey: string, modelName: string, enableCodeExecution = false) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.enableCodeExecution = enableCodeExecution;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1024,
    _opts?: CompleteOptions, // Gemini는 JSON mode 미사용 (필요해지면 responseMimeType 활용)
  ): Promise<AIProviderResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: maxTokens },
      ...(this.enableCodeExecution ? { tools: [{ codeExecution: {} }] } : {}),
    });
    const result = await model.generateContent(userPrompt);
    const usage = result.response.usageMetadata;

    // parts 순회 직렬화 — text는 본문, executableCode+codeExecutionResult는 검산 부록으로
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    let body = '';
    const codeBlocks: Array<{ code: string; output: string }> = [];
    let pendingCode: string | null = null;
    for (const part of parts) {
      if (typeof part.text === 'string') {
        body += part.text;
      } else if (part.executableCode) {
        pendingCode = part.executableCode.code ?? '';
      } else if (part.codeExecutionResult) {
        codeBlocks.push({
          code: pendingCode ?? '',
          output: part.codeExecutionResult.output ?? '',
        });
        pendingCode = null;
      }
    }
    // parts가 비어있는 예외적 경우 .text() 폴백
    if (!body && codeBlocks.length === 0) {
      body = result.response.text();
    }

    let content = appendCodeExecDetails(body, codeBlocks);
    // 토큰 한도로 잘렸으면 사용자에게 표시
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    return {
      content,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      hasCodeExecution: codeBlocks.length > 0,
    };
  }
}

class OpenAICompatProvider implements AIProvider {
  private client: OpenAI;
  private modelName: string;
  /** GPT-5 계열은 max_tokens 미지원, max_completion_tokens 사용 */
  private useCompletionTokens: boolean;

  constructor(apiKey: string, baseURL: string, modelName: string, useCompletionTokens: boolean) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.modelName = modelName;
    this.useCompletionTokens = useCompletionTokens;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1024,
    opts?: CompleteOptions,
  ): Promise<AIProviderResult> {
    const params: Record<string, unknown> = {
      model: this.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };
    if (this.useCompletionTokens) {
      params.max_completion_tokens = maxTokens;
    } else {
      params.max_tokens = maxTokens;
    }
    if (opts?.jsonMode) {
      params.response_format = { type: 'json_object' };
    }
    const res = await this.client.chat.completions.create(params as unknown as Parameters<typeof this.client.chat.completions.create>[0]);
    // DeepSeek 등 일부 모델은 reasoning에 토큰을 소비하고 content가 빌 수 있음 — reasoning_content 폴백
    const choice = (res as { choices: Array<{ message: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string }> }).choices[0];
    let content = choice?.message?.content || choice?.message?.reasoning_content || '';
    // 토큰 한도로 잘렸으면 사용자에게 표시
    if (choice?.finish_reason === 'length') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    return {
      content,
      inputTokens: (res as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ?? 0,
      outputTokens: (res as { usage?: { completion_tokens?: number } }).usage?.completion_tokens ?? 0,
    };
  }
}

/**
 * Phase 41: OpenAI 전용 provider — Responses API + code_interpreter(SymPy 검산).
 * DeepSeek/xAI는 Responses API를 지원하지 않으므로 OpenAICompatProvider를 계속 사용.
 */
class OpenAIResponsesProvider implements AIProvider {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.client = new OpenAI({ apiKey });
    this.modelName = modelName;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1024,
    _opts?: CompleteOptions, // OpenAI 토론 모델(쳇)은 JSON mode 미사용
  ): Promise<AIProviderResult> {
    const res = await this.client.responses.create({
      model: this.modelName,
      instructions: systemPrompt,
      input: userPrompt,
      max_output_tokens: maxTokens,
      tools: [{ type: 'code_interpreter', container: { type: 'auto' } }],
    });

    // output 순회 직렬화 — message text는 본문, code_interpreter_call은 검산 부록으로
    let body = '';
    const codeBlocks: Array<{ code: string; output: string }> = [];
    for (const item of res.output ?? []) {
      if (item.type === 'message') {
        for (const c of item.content) {
          if (c.type === 'output_text') body += c.text;
        }
      } else if (item.type === 'code_interpreter_call') {
        const logs = (item.outputs ?? [])
          .filter((o): o is { type: 'logs'; logs: string } => o.type === 'logs')
          .map((o) => o.logs)
          .join('\n');
        codeBlocks.push({ code: item.code ?? '', output: logs });
      }
    }
    // output_text 폴백 (message 파트 누락 등 예외)
    if (!body && codeBlocks.length === 0) {
      body = res.output_text ?? '';
    }

    let content = appendCodeExecDetails(body, codeBlocks);
    // 토큰 한도로 잘렸으면 사용자에게 표시
    if (res.incomplete_details?.reason === 'max_output_tokens') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    return {
      content,
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      hasCodeExecution: codeBlocks.length > 0,
    };
  }
}

class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.client = new Anthropic({ apiKey });
    this.modelName = modelName;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1024,
    _opts?: CompleteOptions, // Anthropic은 JSON mode 미지원 (필요 시 system 지시/prefill로 대체)
  ): Promise<AIProviderResult> {
    // Anthropic: system은 top-level 파라미터, messages는 user/assistant만, max_tokens 필수
    const res = await this.client.messages.create({
      model: this.modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    // content는 블록 배열 — text 블록만 이어붙임
    let content = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    // 토큰 한도로 잘렸으면 사용자에게 표시
    if (res.stop_reason === 'max_tokens') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    return {
      content,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }
}

// ═══ Phase 37: 모델 설정 기반 provider 디스패치 ═══

const PROVIDER_BASE_URLS: Record<'openai' | 'deepseek' | 'xai', string> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1',
};

const PROVIDER_ENV_KEYS: Record<AIModelConfig['provider'], string> = {
  google: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  xai: 'XAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/** AIModelConfig 기반 provider 인스턴스 생성 */
export function getProviderForModel(config: AIModelConfig): AIProvider {
  const envKey = PROVIDER_ENV_KEYS[config.provider];
  const apiKey = process.env[envKey];
  if (!apiKey) {
    throw new Error(`${envKey} 환경변수가 설정되지 않았습니다 (모델: ${config.modelId})`);
  }

  if (config.provider === 'google') {
    // 토론용 Gemini(민)는 SymPy 검산 code execution 활성 (Phase 41)
    return new GeminiProvider(apiKey, config.apiModelName, true);
  }

  if (config.provider === 'anthropic') {
    return new ClaudeProvider(apiKey, config.apiModelName);
  }

  if (config.provider === 'openai') {
    // 토론용 GPT(쳇)는 Responses API + code_interpreter(SymPy 검산) 사용 (Phase 41)
    return new OpenAIResponsesProvider(apiKey, config.apiModelName);
  }

  // DeepSeek/xAI는 Responses API 미지원 — chat.completions 기반 OpenAICompat 사용. max_tokens.
  const baseURL = PROVIDER_BASE_URLS[config.provider];
  return new OpenAICompatProvider(apiKey, baseURL, config.apiModelName, false);
}

// ═══ Phase 23 호환: 기본 단일 provider 반환 ═══

/** 레거시 호환: AI 풀이 자동완성 등에서 사용. 단일 provider 환경변수 기반 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
    const model = process.env.AI_MODEL || 'gemini-2.5-flash';
    return new GeminiProvider(apiKey, model);
  }

  if (provider === 'claude') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');
    const model = process.env.AI_MODEL || 'claude-opus-4-8';
    return new ClaudeProvider(apiKey, model);
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}
