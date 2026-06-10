# Phase 41: AI 토론자 SymPy 검산 도구

> **목표**: 토론창에서 민·쳇에게 SymPy 코드 실행으로 수치·기호 검산 요청 가능
> **상태**: 계획서 v1 — 구현 대기
> **선행 의존**: Phase 37 (AI 토론 기능)
> **제외 범위**: 식(DeepSeek), 락(Grok), 섬(Gemini Flash)은 이번 phase에서 도구 미적용
>   - 식·락: provider 자체 내장 미지원 (별도 phase에서 Pyodide 등으로 구현 가능)
>   - 섬: 가능하지만 reasoning 약해서 의미 낮음 — 추후 추가 검토

---

## 1. 동작 흐름

```
사용자가 토론 입력창에 자유 텍스트로 입력 (예시 1, 2 등)
   ↓
[/api/discuss] currentMessage에 "검산" 트리거 키워드 감지
   AND 호출 모델이 민(gemini-3.1-pro / 3.5-flash) 또는 쳇(gpt-5.x)
   ↓
provider 호출 시 code execution tool 활성화
   - Gemini: tools: [{ codeExecution: {} }]
   - GPT:    tools: [{ type: 'code_interpreter', container: { type: 'auto' } }] (Responses API)
   ↓
AI 응답이 여러 파트로 옴: text + executableCode + codeExecutionResult
   ↓
[서버] 마크다운 직렬화:
  본문 결론 (text 부분 합침)
  ── 그 뒤에 ──
  <details>
  <summary>🔍 검산 코드</summary>
  ```python
  ...코드...
  ```
  ```
  실행 결과:
  ...output...
  ```
  </details>
   ↓
[토론 패널] 메시지 그대로 마크다운 렌더 (rehype-raw가 <details> 처리)
  기본 접힘, 사용자가 ▶ 클릭 시 펼침
```

## 2. 트리거 감지

서버 측 정규식:
```typescript
const TRIGGER_RE = /(검산|sympy|코드로\s*확인|파이썬으로)/i;
const enableCodeExec = TRIGGER_RE.test(body.currentMessage);
```

추가 정책:
- **트리거 없을 때도 AI 자체 판단으로 도구 사용 허용** (제한 X)
- 즉, 도구 자체는 항상 enable, 시스템 프롬프트에서 "필요할 때만 쓰라"고 안내
- 비용 영향이 커지면 추후 트리거 강제로 전환

따라서 실제 구현은 트리거 감지 제거하고 **민·쳇 호출 시 항상 도구 활성**으로 통일. 더 단순.

## 3. 시스템 프롬프트 추가 지침

기존 BASE_SYSTEM_PROMPT 끝에 다음 규칙 추가 (도구 활성 모델에만):

```
12. 검산 도구 (SymPy/Python 코드 실행):
- 사용자가 "검산해줘", "코드로 확인" 등을 명시하면 반드시 코드를 실행해 검증.
- 명시가 없어도 본인 판단으로 수치·대수 결과의 정확성이 의심되면 자유롭게 실행 가능.
- 사용자가 지정한 대상이 있으면 그것만 검증. 임의로 다른 부분까지 확장 검증 금지.
- 코드는 짧고 한 목적만 — print로 결과 명확히 출력.
- 검산 결과는 최종 결론에 자연어로 반영. 코드/출력 자체는 부록 위치에 자동 첨부됨.
```

## 4. 응답 직렬화 — 마크다운 형식

### Gemini 응답 처리

`@google/generative-ai` SDK의 응답:
```
response.candidates[0].content.parts = [
  { text: "결론 텍스트..." },
  { executableCode: { language: "PYTHON", code: "..." } },
  { codeExecutionResult: { outcome: "OUTCOME_OK", output: "..." } },
  { text: "결론 추가..." },
  ...
]
```

직렬화:
```typescript
let body = '';
let codeBlocks: Array<{ code: string; output: string }> = [];
let pendingCode: string | null = null;

for (const part of parts) {
  if (part.text) body += part.text;
  else if (part.executableCode) pendingCode = part.executableCode.code;
  else if (part.codeExecutionResult) {
    codeBlocks.push({ code: pendingCode ?? '', output: part.codeExecutionResult.output ?? '' });
    pendingCode = null;
  }
}

if (codeBlocks.length === 0) return body;

const details = codeBlocks.map((b) => (
  `\n\`\`\`python\n${b.code}\n\`\`\`\n\n실행 결과:\n\`\`\`\n${b.output}\n\`\`\``
)).join('\n\n---\n\n');

return `${body}\n\n<details>\n<summary>🔍 검산 코드 (${codeBlocks.length}개)</summary>\n${details}\n</details>`;
```

### GPT (Responses API) 응답 처리

`responses.create()` 응답:
```
response.output = [
  { type: 'message', content: [{ type: 'output_text', text: '...' }] },
  { type: 'code_interpreter_call', code: '...', container_id: '...' },
  { type: 'code_interpreter_call_outputs', outputs: [{ type: 'logs', logs: '...' }] },
  ...
]
```

직렬화 로직 동일 구조: text는 본문에, code+outputs는 details 안에.

## 5. 아키텍처 변경 — Provider 분리

### 현재
- `GeminiProvider` — `@google/generative-ai` SDK
- `OpenAICompatProvider` — `openai` SDK + chat.completions.create (provider == 'openai' | 'deepseek' | 'xai')

### 변경 후
- `GeminiProvider` — `tools: [{ codeExecution: {} }]` 옵션 추가
- `OpenAICompatProvider` — DeepSeek, xAI 전용 그대로 유지 (이쪽은 Responses API 미지원)
- **`OpenAIResponsesProvider`** (신규) — OpenAI 전용. `responses.create()` 사용. code_interpreter tool 항상 포함
- `getProviderForModel(config)`:
  - `provider === 'google'` → `GeminiProvider`
  - `provider === 'openai'` → `OpenAIResponsesProvider`
  - `provider === 'deepseek' | 'xai'` → `OpenAICompatProvider`

### AIProviderResult 인터페이스 확장

```typescript
export interface AIProviderResult {
  content: string;          // 마크다운 (본문 + <details> 검산 부록)
  inputTokens: number;
  outputTokens: number;
  hasCodeExecution?: boolean; // 통계용 (UI에서 활용 가능)
}
```

## 6. 구현 단계

| Step | 파일 | 작업 |
|------|------|------|
| A | `lib/ai-provider.ts` | `GeminiProvider.complete()` 수정 — `tools: [{ codeExecution: {} }]` 추가. parts 순회 직렬화 로직 |
| B | `lib/ai-provider.ts` | `OpenAIResponsesProvider` 신규 — `responses.create()` 사용. tools에 code_interpreter 추가. output 직렬화 |
| C | `lib/ai-provider.ts` | `getProviderForModel` 분기 추가: openai → OpenAIResponsesProvider |
| D | `app/api/discuss/route.ts` | 시스템 프롬프트 #12 규칙 추가 (검산 도구 가이드) |
| E | `app/api/discuss/route.ts` | 비용 계산 시 code execution 추가 비용 인지 (Gemini: code execution은 input/output 토큰에 산입; OpenAI: container 시간 별도 청구 가능 — 일단 토큰만 카운트) |
| F | (검증) | dev 서버에서 민·쳇에 "$\\lim_{x\\to 2} \\frac{x^2-4}{x-2}$ 검산해줘" 요청 → 코드 실행 + 결과 표시 확인 |

## 7. 비용 영향

- **Gemini code execution**: 추가 청구 없음 (생성된 code와 output은 통상 토큰에 산입)
- **OpenAI code_interpreter**: 컨테이너 사용 시간에 따라 추가 청구
  - 일반적인 짧은 검산은 무료 한도 내 (자세한 가격: $0.03/세션 등)
  - 토론 패널 헤더의 cost 표시엔 입출력 토큰만 반영, 컨테이너 비용은 별도 추적 안 함
- **전체 예상 영향**: 평균 1회 검산당 +0.5~2¢ 정도 (자세한 건 실측 후 결정)

## 8. UI 영향

- 메시지 본문 렌더링은 기존 EditorPreview 그대로 (rehype-raw로 `<details>` 자동 처리)
- 추가 컴포넌트 작업 0
- 시각 보강(선택): `<details>` 내부 코드 블록에 syntax highlighting — rehype-prism 등 사용 가능 (Phase 41에 포함하지 않고 추후 폴리싱)

## 9. 보안·안정성

- 두 provider 모두 **provider의 자체 sandbox**에서 코드 실행 → 우리 서버·클라이언트에서 코드 실행 안 함. 안전.
- 트리거 키워드 인젝션 위험 없음 (서버 측 단순 정규식)
- code_interpreter 컨테이너 timeout: provider 기본값 사용 (보통 30~60초)

## 10. 후속·확장

- **Phase 41.5**: 식(DeepSeek), 락(Grok)도 Pyodide 기반 자체 실행 추가 (필요해질 때)
- **Phase 41.6**: 편집창에서 식 블록 우클릭 → "검산 토론 시작" 자동 메시지 생성 UX
- **Phase 41.7**: 검산 결과 이력 검색·필터 (사용자가 "최근 검산 실패만 보기" 등)

---

## 11. 검증 시나리오

| # | 입력 | 기대 동작 |
|---|------|-----------|
| 1 | 민·쳇에 "이 풀이 검산해줘. $\\lim_{x \\to 2} \\frac{x^2-4}{x-2}$" | 두 모델 모두 SymPy `limit()` 호출 → 4 도출 → 결론 + 접힌 코드 부록 표시 |
| 2 | 트리거 없이 "이 풀이 어떻게 생각해?" 일반 질문 | 도구 활성 상태이지만 자체 판단으로 사용 안 함. 일반 답변 |
| 3 | 트리거 + 매우 복잡한 식 (시간 초과 가능) | provider 자체 timeout → 에러 메시지를 결론에 자연어로 포함 |
| 4 | `<details>` 펼침/접힘 — 클릭 동작 | 코드 + 실행 결과 표시/숨김 정상 동작 |
| 5 | 식·락에 같은 검산 요청 | 도구 미적용 → 일반 응답 (검산 못 함을 명시하도록 시스템 프롬프트에서 안내 가능) |

---

## 12. 결정된 사항 요약 (사전 점검)

| 항목 | 결정 |
|------|------|
| 트리거 키워드 | `검산`, `sympy`, `코드로 확인`, `파이썬으로` |
| 트리거 없을 때 도구 사용 | **허용** (AI 자체 판단). 비용 폭증 시 재검토 |
| 검산 결과 표시 | 본문 결론 다음 `<details>` 접힌 채로 |
| GPT 모델 | `gpt-5.4-2026-03-05` 사용 — Responses API + code_interpreter 지원 확인됨 |
| 적용 모델 | 민(Gemini 3.1 Pro), 쳇(GPT-5.4) 두 개 우선. 섬·식·락은 제외 |
| 검산 대상 지정 | 사용자가 자유 자연어로 텍스트에 포함 (별도 UI 불필요) |
