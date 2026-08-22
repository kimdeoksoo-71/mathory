/**
 * Phase 61b 스텝 0 — 회귀 방어.
 *
 * Phase 61b는 discuss·proofread가 함께 쓰는 provider에 옵션을 추가한다.
 * **옵션을 넘기지 않으면 요청 바디가 기존과 완전히 같아야** 두 기능이 무사하다.
 * 아래 스냅샷이 그것을 고정한다 — 깨지면 discuss/proofread가 조용히 달라진 것이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  buildClaudeParams, buildGeminiConfig, resolveMaxToolTurns, DEFAULT_MAX_TOOL_TURNS,
} = await import('../.test-build/lib/verify/providerParams.js');

const MSGS = [{ role: 'user', content: 'hi' }];

test('Claude — 옵션 미전달 시 기존 바디와 바이트 단위 동일 (code exec off)', () => {
  const got = buildClaudeParams({
    model: 'claude-opus-4-8', system: 'S', messages: MSGS,
    maxTokens: 1024, enableCodeExecution: false,
  });
  assert.equal(
    JSON.stringify(got),
    JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 1024, system: 'S', messages: MSGS }),
  );
});

test('Claude — 옵션 미전달 + code exec on = Phase 41 바디 그대로', () => {
  const got = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 2048, enableCodeExecution: true,
  });
  assert.equal(
    JSON.stringify(got),
    JSON.stringify({
      model: 'm', max_tokens: 2048, system: 'S', messages: MSGS,
      tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
    }),
  );
});

test('Claude — forceCodeExecution은 tool_choice:any (discuss 경로 유지)', () => {
  const got = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 1,
    enableCodeExecution: true, opts: { forceCodeExecution: true },
  });
  assert.deepEqual(got.tool_choice, { type: 'any' });
});

test('Claude — thinking/effort는 옵션이 있을 때만 생긴다', () => {
  const off = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 1, enableCodeExecution: false,
    opts: { jsonMode: true },   // 무관한 옵션은 바디를 바꾸지 않는다
  });
  assert.equal('thinking' in off, false);
  assert.equal('output_config' in off, false);

  const on = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 16000, enableCodeExecution: false,
    opts: { thinking: 'adaptive', effort: 'high' },
  });
  assert.deepEqual(on.thinking, { type: 'adaptive' });
  assert.deepEqual(on.output_config, { effort: 'high' });
  // ⚠ Opus 4.7+ 에서 400. 절대 나오면 안 된다.
  assert.equal('budget_tokens' in on, false);
});

test('Claude — enableCodeExecution 옵션이 인스턴스 기본값을 이긴다 (F1 env 게이트)', () => {
  const forcedOn = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 1,
    enableCodeExecution: false, opts: { enableCodeExecution: true },
  });
  assert.ok(Array.isArray(forcedOn.tools));

  const forcedOff = buildClaudeParams({
    model: 'm', system: 'S', messages: MSGS, maxTokens: 1,
    enableCodeExecution: true, opts: { enableCodeExecution: false },
  });
  assert.equal('tools' in forcedOff, false);
});

test('Gemini — 옵션 미전달 시 generationConfig는 maxOutputTokens 하나뿐', () => {
  assert.equal(JSON.stringify(buildGeminiConfig(1024)), JSON.stringify({ maxOutputTokens: 1024 }));
  // 무관한 옵션(jsonMode는 OpenAI 전용)은 Gemini 바디를 바꾸지 않는다
  assert.equal(
    JSON.stringify(buildGeminiConfig(1024, { jsonMode: true, forceCodeExecution: true })),
    JSON.stringify({ maxOutputTokens: 1024 }),
  );
});

test('Gemini — 검증 1차는 JSON mime + thinkingLevel (시트 STEP3 등가)', () => {
  const got = buildGeminiConfig(8192, { geminiJsonMime: true, geminiThinkingLevel: 'HIGH' });
  assert.deepEqual(got, {
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'HIGH' },
  });
});

test('resolveMaxToolTurns — 기본 3, 0 허용, 음수/비수치는 기본값', () => {
  assert.equal(resolveMaxToolTurns(undefined), DEFAULT_MAX_TOOL_TURNS);
  assert.equal(resolveMaxToolTurns({}), 3);
  assert.equal(resolveMaxToolTurns({ maxToolTurns: 0 }), 0);
  assert.equal(resolveMaxToolTurns({ maxToolTurns: 5 }), 5);
  assert.equal(resolveMaxToolTurns({ maxToolTurns: -1 }), 3);
});
