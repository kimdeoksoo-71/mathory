/**
 * Phase 61b — AI 요청 파라미터 조립 (순수 함수, import 0)
 *
 * `lib/ai-provider.ts`에서 분리한 이유는 하나다: **회귀를 코드로 막기 위해서**.
 * Phase 61b는 discuss·proofread가 쓰는 provider에 옵션을 추가하는데, 옵션을
 * 넘기지 않았을 때 요청 바디가 **바이트 단위로 기존과 같아야** 두 기능이 무사하다.
 * 조립을 순수 함수로 빼 두면 `tests/aiProviderParams.test.mjs`가 그것을 고정한다.
 *
 * ⚠️ 이 파일에 import를 두지 말 것 — `npm run test:verify`가 tsc로 단독 컴파일한다.
 *    옵션 타입도 로컬 정의한다(`lib/ai-provider.ts`의 `CompleteOptions`와 구조적으로 호환).
 */

export interface ParamOptions {
  jsonMode?: boolean;
  forceCodeExecution?: boolean;
  thinking?: 'adaptive';
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  enableCodeExecution?: boolean;
  maxToolTurns?: number;
  geminiThinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  geminiJsonMime?: boolean;
}

/** Claude code execution 서버 도구 타입. Phase 41에서 검증된 값 */
export const CLAUDE_CODE_EXEC_TOOL = { type: 'code_execution_20250825', name: 'code_execution' };

/** pause_turn 재요청 기본 상한 */
export const DEFAULT_MAX_TOOL_TURNS = 3;

/**
 * Anthropic Messages API 요청 바디.
 *
 * 키 순서는 기존 구현(model → max_tokens → system → messages → tools → tool_choice)을
 * 그대로 유지한다. Phase 61b 키(thinking·output_config)는 **뒤에** 붙고 옵션이 있을 때만 생긴다.
 *
 * ⚠️ `budget_tokens`를 넣지 말 것 — Opus 4.7+ 에서 400이다. adaptive thinking이 대체한다.
 * ⚠️ assistant prefill(마지막 assistant 턴 선주입)도 400이다. JSON을 `{`로 강제할 수 없다.
 */
export function buildClaudeParams(args: {
  model: string;
  system: string;
  messages: unknown[];
  maxTokens: number;
  /** 인스턴스 기본값 */
  enableCodeExecution: boolean;
  opts?: ParamOptions;
}): Record<string, unknown> {
  const { model, system, messages, maxTokens, opts } = args;
  const params: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
  };

  // 호출 단위 지정이 인스턴스 기본값을 이긴다 (Phase 61b F1의 env 게이트가 이 경로를 탄다)
  const codeExec = opts?.enableCodeExecution ?? args.enableCodeExecution;
  if (codeExec) {
    params.tools = [CLAUDE_CODE_EXEC_TOOL];
    if (opts?.forceCodeExecution) {
      params.tool_choice = { type: 'any' };
    }
  }

  if (opts?.thinking) params.thinking = { type: opts.thinking };
  if (opts?.effort) params.output_config = { effort: opts.effort };

  return params;
}

/**
 * Gemini `generationConfig`.
 * 시트 STEP3 1차는 `response_mime_type` + `thinkingConfig`를 함께 쓴다
 * (gas-project-audition `QualityVerification.gs:480-486`, origin/main b6b91f6).
 */
export function buildGeminiConfig(
  maxTokens: number,
  opts?: ParamOptions,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = { maxOutputTokens: maxTokens };
  if (opts?.geminiJsonMime) cfg.responseMimeType = 'application/json';
  if (opts?.geminiThinkingLevel) cfg.thinkingConfig = { thinkingLevel: opts.geminiThinkingLevel };
  return cfg;
}

/** pause_turn 재요청 상한 (옵션 미지정 시 기본값) */
export function resolveMaxToolTurns(opts?: ParamOptions): number {
  const n = opts?.maxToolTurns;
  return typeof n === 'number' && n >= 0 ? n : DEFAULT_MAX_TOOL_TURNS;
}
