import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIModelConfig } from '../types/problem';

export interface AIProviderResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
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

  constructor(apiKey: string, modelName: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
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
    });
    const result = await model.generateContent(userPrompt);
    const usage = result.response.usageMetadata;
    let content = result.response.text();
    // 토큰 한도로 잘렸으면 사용자에게 표시
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    return {
      content,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
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
    return new GeminiProvider(apiKey, config.apiModelName);
  }

  if (config.provider === 'anthropic') {
    return new ClaudeProvider(apiKey, config.apiModelName);
  }

  const baseURL = PROVIDER_BASE_URLS[config.provider];
  // GPT-5 계열은 max_completion_tokens 필수. DeepSeek/xAI는 max_tokens 사용
  const useCompletionTokens = config.provider === 'openai';
  return new OpenAICompatProvider(apiKey, baseURL, config.apiModelName, useCompletionTokens);
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
