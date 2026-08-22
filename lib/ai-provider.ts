import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { AIModelConfig } from '../types/problem';
import {
  buildClaudeParams, buildGeminiConfig, resolveMaxToolTurns,
} from './verify/providerParams';

export interface AIProviderResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  /** 통계용: 응답에 코드 실행(SymPy 검산)이 포함되었는지 */
  hasCodeExecution?: boolean;
  /** Phase 61b: pause_turn 재요청 상한에 걸려 응답이 미완성인지. 검증 라우트가 실패 처리에 쓴다 */
  truncated?: boolean;
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
  return `${body}\n\n<details>\n<summary>{ / } 검산 코드 (${codeBlocks.length}개)</summary>\n${details}\n</details>`;
}

export interface CompleteOptions {
  /** OpenAI 호환 provider에서 response_format을 json_object로 강제 (식 전용) */
  jsonMode?: boolean;
  /** 검산 트리거 감지 시 Claude의 code_execution tool 호출을 강제 (tool_choice).
   *  Anthropic Claude는 시스템 프롬프트만으론 도구를 잘 안 부르는 경향이 있어
   *  명시적으로 강제해야 안정적으로 SymPy를 실행함.
   *  ⚠️ Phase 61b 검증 라우트에서는 쓰지 말 것 — 도구 호출을 강제하면 모델이
   *     최종 JSON 턴을 낼 수 없다 (D9). */
  forceCodeExecution?: boolean;

  /* ─── Phase 61b (정밀 검증) additive. 미전달 시 요청 바디는 기존과 완전히 동일하다 ─── */

  /** Claude adaptive thinking. ⚠️ Opus 4.8은 이 값을 생략하면 **사고가 꺼진 채** 돈다 —
   *  오류도 경고도 없이 품질만 조용히 떨어지므로 검증 경로는 반드시 지정할 것.
   *  ⚠️ `budget_tokens`는 Opus 4.7+ 에서 400이다. 되살리지 말 것. */
  thinking?: 'adaptive';
  /** Claude `output_config.effort`. 검증 2차 판정은 'high' (시트 STEP3 등가) */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** 인스턴스 생성 시의 code execution 기본값을 호출 단위로 덮어쓴다.
   *  Phase 61b F1: 2차 판정의 code_execution은 시트에 전례가 없는 신규 요소라 env로 게이트한다. */
  enableCodeExecution?: boolean;
  /** Claude `pause_turn` 재요청 상한 (기본 3). 서버 도구가 붙은 요청은 턴이 끊길 수 있고,
   *  그대로 두면 JSON이 잘린 채 온다. */
  maxToolTurns?: number;
  /** Gemini `generationConfig.thinkingConfig.thinkingLevel` (시트 STEP3 1차는 'HIGH') */
  geminiThinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Gemini `generationConfig.responseMimeType = 'application/json'`.
   *  ⚠️ 켜도 `\f` 계열 이스케이프 손상은 막지 못한다 — 파싱 후 복구가 여전히 필요하다. */
  geminiJsonMime?: boolean;
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
    _opts?: CompleteOptions, // jsonMode(OpenAI 전용)는 미사용. Phase 61b의 geminiJsonMime·geminiThinkingLevel은 사용.
  ): Promise<AIProviderResult> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
      generationConfig: buildGeminiConfig(maxTokens, _opts) as { maxOutputTokens: number },
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
    // 일부 SDK/모델 버전에서는 outputs가 별도 item으로 분리되어 옴 — call_id로 매칭
    const callIdToCode = new Map<string, string>();
    const outputsByCallId = new Map<string, string>();
    for (const it of res.output ?? []) {
      const item = it as unknown as Record<string, unknown>;
      if (item.type === 'message') {
        const content = item.content as Array<{ type: string; text?: string }>;
        for (const c of content) {
          if (c.type === 'output_text' && c.text) body += c.text;
        }
      } else if (item.type === 'code_interpreter_call') {
        const code = (item.code as string) ?? '';
        const callId = (item.id as string) ?? (item.call_id as string) ?? '';
        if (callId) callIdToCode.set(callId, code);
        // outputs가 함께 오는 경우도 처리
        const outputs = item.outputs as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(outputs)) {
          const logs = outputs
            .map((o) => {
              if (o.type === 'logs' && typeof o.logs === 'string') return o.logs;
              // 다른 가능성 — text/content 등
              if (typeof o.text === 'string') return o.text;
              if (typeof o.content === 'string') return o.content;
              return '';
            })
            .filter(Boolean)
            .join('\n');
          if (logs) {
            // 이미 outputs가 인라인으로 같이 옴 — 바로 codeBlocks에 push
            codeBlocks.push({ code, output: logs });
            continue;
          }
        }
        // outputs가 비었거나 별도 아이템으로 올 경우 — 일단 stash
        if (callId) {
          codeBlocks.push({ code, output: '' }); // 후처리에서 채움
        }
      } else if (
        item.type === 'code_interpreter_call_outputs'
        || item.type === 'code_interpreter_call_output'
        || item.type === 'tool_call_output'
      ) {
        // 별도 아이템으로 오는 outputs
        const callId = (item.call_id as string) ?? (item.tool_call_id as string) ?? '';
        const outputs = item.outputs as Array<Record<string, unknown>> | undefined;
        const output = item.output as string | undefined;
        let logs = '';
        if (Array.isArray(outputs)) {
          logs = outputs
            .map((o) => (typeof o.logs === 'string' ? o.logs : typeof o.text === 'string' ? o.text : ''))
            .filter(Boolean)
            .join('\n');
        } else if (typeof output === 'string') {
          logs = output;
        }
        if (callId) outputsByCallId.set(callId, logs);
      }
    }
    // 후처리: outputsByCallId의 결과를 빈 codeBlocks에 채워넣기
    if (outputsByCallId.size > 0) {
      // 빈 codeBlocks를 outputsByCallId와 순서대로 매칭 (call_id 없을 수도 있어 단순 순서 매칭)
      const emptyIdxs = codeBlocks
        .map((b, i) => (b.output === '' ? i : -1))
        .filter((i) => i >= 0);
      const outputValues = Array.from(outputsByCallId.values());
      emptyIdxs.forEach((idx, k) => {
        if (k < outputValues.length) codeBlocks[idx].output = outputValues[k];
      });
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

/**
 * 신규 content block 타입 (SDK 0.32.1 미정의) — 런타임 형태 기준 좁힘용.
 * code_execution_20250825 / code_execution_20260120 도구 응답 구조.
 *
 * 실제 응답에서 도구가 분기됨:
 *  - bash_code_execution (Bash 명령 실행) — name: 'bash_code_execution'
 *  - text_editor_code_execution (파일 편집) — name: 'text_editor_code_execution'
 *  - python REPL (legacy code_execution_20250522) — name: 'code_execution'
 * 결과 블록 타입도 위와 짝지어:
 *  - bash_code_execution_tool_result (content.stdout / stderr / return_code)
 *  - text_editor_code_execution_tool_result
 *  - code_execution_tool_result (legacy/REPL)
 * 각 *_tool_result_error는 실패.
 */
interface AnthropicServerToolUseBlock {
  type: 'server_tool_use';
  id: string;
  name: string;
  input?: { code?: string; command?: string } | unknown;
}
interface AnthropicCodeExecResultBlock {
  type: string; // *_code_execution_tool_result
  tool_use_id?: string;
  content?: { stdout?: string; stderr?: string; return_code?: number; type?: string } | unknown;
}
interface AnthropicCodeExecErrorBlock {
  type: string; // *_code_execution_tool_result_error
  tool_use_id?: string;
  content?: { error_code?: string; error_message?: string } | unknown;
}

function isCodeExecResultType(t: string): boolean {
  return /_?code_execution_tool_result$/.test(t);
}
function isCodeExecErrorType(t: string): boolean {
  return /_?code_execution_tool_result_error$/.test(t);
}
function isCodeExecToolName(name: string): boolean {
  return name === 'code_execution'
    || name === 'bash_code_execution'
    || name === 'text_editor_code_execution';
}

class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private modelName: string;
  /** SymPy 검산용 code execution tool 활성화 (Phase 41) */
  private enableCodeExecution: boolean;

  constructor(apiKey: string, modelName: string, enableCodeExecution = false) {
    this.client = new Anthropic({ apiKey });
    this.modelName = modelName;
    this.enableCodeExecution = enableCodeExecution;
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1024,
    opts?: CompleteOptions, // Anthropic은 JSON mode 미지원. forceCodeExecution은 사용.
  ): Promise<AIProviderResult> {
    // SDK 0.32.1은 code_execution tool 타입을 모르므로 params를 unknown cast로 전달.
    // 조립은 lib/verify/providerParams.ts의 순수 함수에 있다 (Phase 61b — 회귀 스냅샷 대상).
    // code_execution_20250825는 모든 지원 모델에서 사용 가능 (Bash 기반).
    // 호출되는 도구는 bash_code_execution / text_editor_code_execution / (legacy) code_execution
    // 으로 분기되며, 결과 블록도 *_code_execution_tool_result로 다양함.
    const messages: unknown[] = [{ role: 'user', content: userPrompt }];

    // Phase 61b: 서버 도구가 붙은 요청은 stop_reason='pause_turn'으로 끊길 수 있다.
    // 토론에서는 "답이 짧다"로 끝나지만 검증에서는 JSON이 잘린 채 와서 리포트가 통째로 날아간다.
    // → assistant 턴을 그대로 이어 붙여 재요청한다. 도구가 없으면 1회로 끝나 기존 동작과 동일.
    const maxTurns = resolveMaxToolTurns(opts);
    let inputTokens = 0;
    let outputTokens = 0;
    let truncated = false;
    const contentBlocks: unknown[] = [];
    let lastStopReason: string | null = null;

    for (let turn = 0; ; turn++) {
      const params = buildClaudeParams({
        model: this.modelName,
        system: systemPrompt,
        messages,
        maxTokens,
        enableCodeExecution: this.enableCodeExecution,
        opts,
      });
      const rawRes = await this.client.messages.create(
        params as unknown as Parameters<typeof this.client.messages.create>[0],
      );
      // 스트리밍 미사용이지만 SDK 타입이 Stream | Message 합집합 — 비스트리밍 분기 단언
      const turnRes = rawRes as Anthropic.Messages.Message;
      inputTokens += turnRes.usage.input_tokens;
      outputTokens += turnRes.usage.output_tokens;
      contentBlocks.push(...(turnRes.content as unknown[]));
      // SDK 0.32.1의 stop_reason 유니온에는 'pause_turn'이 없다(서버 도구 이후 추가된 값) → 문자열로 넓힌다
      lastStopReason = turnRes.stop_reason as string | null;

      if (lastStopReason !== 'pause_turn') break;
      if (turn >= maxTurns) { truncated = true; break; }
      messages.push({ role: 'assistant', content: turnRes.content });
    }

    const res = {
      content: contentBlocks,
      stop_reason: lastStopReason,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    } as unknown as Anthropic.Messages.Message;

    // content 블록 순회 — text/code/result 분리
    // bash_code_execution / text_editor_code_execution / legacy code_execution 모두 처리
    let body = '';
    const codeBlocks: Array<{ code: string; output: string }> = [];
    let pendingCode: string | null = null;
    for (const rawBlock of res.content as Array<
      Anthropic.ContentBlock | AnthropicServerToolUseBlock
      | AnthropicCodeExecResultBlock | AnthropicCodeExecErrorBlock
    >) {
      const block = rawBlock as { type: string } & Record<string, unknown>;
      if (block.type === 'text') {
        body += (block as unknown as Anthropic.TextBlock).text;
      } else if (block.type === 'server_tool_use') {
        const tu = block as unknown as AnthropicServerToolUseBlock;
        if (isCodeExecToolName(tu.name)) {
          const input = tu.input as { code?: string; command?: string } | undefined;
          // bash 도구는 command, python REPL은 code 필드. 둘 다 대응.
          pendingCode = input?.code ?? input?.command ?? '';
        }
      } else if (isCodeExecResultType(block.type)) {
        const r = block as unknown as AnthropicCodeExecResultBlock;
        const c = r.content as
          | { stdout?: string; stderr?: string; return_code?: number; type?: string; content?: unknown }
          | undefined;
        // bash 응답은 한 단계 더 nested: content: { type: 'bash_code_execution_result', stdout, ... }
        const inner = (c && typeof c === 'object' && 'type' in c && c.content)
          ? (c.content as { stdout?: string; stderr?: string; return_code?: number })
          : c;
        const stdout = (inner as { stdout?: string })?.stdout ?? '';
        const stderr = (inner as { stderr?: string })?.stderr ?? '';
        const output = [stdout, stderr ? `[stderr]\n${stderr}` : ''].filter(Boolean).join('\n');
        codeBlocks.push({ code: pendingCode ?? '', output: output || '(no output)' });
        pendingCode = null;
      } else if (isCodeExecErrorType(block.type)) {
        const e = block as unknown as AnthropicCodeExecErrorBlock;
        const c = e.content as { error_code?: string; error_message?: string } | undefined;
        const msg = `[execution error] ${c?.error_code ?? ''} ${c?.error_message ?? ''}`.trim();
        codeBlocks.push({ code: pendingCode ?? '', output: msg });
        pendingCode = null;
      }
    }
    // pendingCode가 남아있으면 결과 없이라도 코드는 보존 (강제 호출 후 결과 누락 케이스)
    if (pendingCode !== null && pendingCode !== '') {
      codeBlocks.push({ code: pendingCode, output: '(실행 결과 누락 — 도구 응답 미수신)' });
      pendingCode = null;
    }

    let content = appendCodeExecDetails(body, codeBlocks);
    // 토큰 한도로 잘렸으면 사용자에게 표시
    if (res.stop_reason === 'max_tokens') {
      content += '\n\n_…응답이 토큰 한도(maxTokens)로 잘렸습니다._';
    }
    if (truncated) {
      content += '\n\n_…도구 호출이 상한에 도달해 응답이 미완성입니다._';
    }
    return {
      content,
      inputTokens,
      outputTokens,
      hasCodeExecution: codeBlocks.length > 0,
      ...(truncated ? { truncated: true } : {}),
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
    // 토론용 Claude(Opus 등)도 SymPy 검산 code execution 활성 (Phase 41)
    return new ClaudeProvider(apiKey, config.apiModelName, true);
  }

  if (config.provider === 'openai') {
    // 토론용 GPT(쳇)는 Responses API + code_interpreter(SymPy 검산) 사용 (Phase 41)
    return new OpenAIResponsesProvider(apiKey, config.apiModelName);
  }

  // DeepSeek/xAI는 Responses API 미지원 — chat.completions 기반 OpenAICompat 사용. max_tokens.
  const baseURL = PROVIDER_BASE_URLS[config.provider];
  return new OpenAICompatProvider(apiKey, baseURL, config.apiModelName, false);
}

// ═══ Phase 61b: 정밀 검증 전용 provider (env 고정 모델) ═══

/**
 * 검증 라우트용 provider 2개.
 *
 * `getProviderForModel`을 못 쓰는 이유: 그쪽은 Firestore `ai_models` 문서(AIModelConfig)
 * 전체를 요구하는데, 검증 모델은 env로 고정하므로 그 문서가 없다.
 *
 * code execution은 **인스턴스 기본값을 false로 둔다** — Phase 61b F1:
 * 시트 STEP3의 2차 판정(`QualityVerification.gs:573-584`)에는 `tools`가 아예 없다.
 * 즉 검산은 "이식"이 아니라 신규 요소라 호출 단위 옵션(`enableCodeExecution`)으로만 켠다.
 */
export function getVerifyProviders(models: { gemini: string; claude: string }): {
  first: AIProvider;
  judge: AIProvider;
} {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다');

  return {
    first: new GeminiProvider(geminiKey, models.gemini, false),
    judge: new ClaudeProvider(claudeKey, models.claude, false),
  };
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
