# Phase 61b 구현 계획서 — 정밀 검증 (agent 대화창 통합) (v4 실행판)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **B축**
> 계보: v1(web 착안·D1~D7) → v2(CLI 실측 교차검토·D8~D14) → v3(web 재검증·D13′/D14′·V1~V4) → **v4 실행판(CLI, 2026-08-22)**
> 진실 원천: mathory **origin/main `6833fe9`** · gas-project-audition **origin/main `b6b91f6`**
> 범위: 기획서 D 진행표의 **단계 2(검증 코어) + 단계 3(agent 통합) + 단계 4(상태 관리)**. C축(대화→편집창 삽입)은 61c.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 착수 판정

**착수 가능하다.** v3에서 미결 쟁점은 전부 닫혔고, v2가 제기한 15건은 v3가 실측으로 재확인해 수용했다. v4가 v3에 더하는 것은 **정정 1건 + 근거 교정 1건 + 실행 세부 확정**이다.

### 0-1. F1 — 정정: 2차 Claude의 `code_execution`은 시트에서 검증된 적이 없다 ⚠

`callClaudeUnified_`(`QualityVerification.gs:573-584`)의 payload는
`model / max_tokens / system / thinking / output_config / messages` **뿐이다 — `tools` 키가 아예 없다.**
파일 전체에 `tools` 문자열이 0건이다. 즉 **STEP3 2차 판정은 순수 텍스트 판정**이고, SymPy 검산은 STEP3에 존재하지 않는다.

v1은 이걸 정확히 적었다("기획서 B-4의 '기계 검산' → 시트에 없는 Mathory 신규 가치"). 그런데 v2·v3를 지나며 그 문장이 **파이프라인 필수 요소로 승격**됐다. 결과:

- D9(`pause_turn` 루프)의 **유일한 발동 원인이 이 미검증 신규 요소다.**
- 스텝 0의 위험이 사실상 전부 여기서 온다.
- "시트에서 검증된 것을 이식한다"는 이 Phase의 안전 근거가 2차 다리에서만 성립하지 않는다.

**F1 결정 — `VERIFY_JUDGE_CODE_EXEC` env 게이트, 기본 off.**
기본 경로를 시트와 **정확히 동일한 순수 텍스트 판정**으로 두어 STEP3 등가를 먼저 세우고, 검산은 그 위에 얹는 증분으로 다룬다. `pause_turn` 루프(D9)는 그대로 구현한다 — off일 때 발동하지 않을 뿐 무해하고, on 전환 시 이미 준비돼 있다. 스텝 2에서 on/off 대조 측정 후 기본값을 정한다.
⚠ on일 때만 `tool_choice` 금지·`pause_turn` 루프·`maxToolTurns`가 의미를 갖는다.

### 0-2. F2 — 근거 교정: D6′의 A2 논거 절반이 틀렸다 (결론은 유지)

v3 §3-5는 "멤버는 이미 `Problem.answer`와 풀이 탭 전문을 읽으므로 새 유출이 없다"고 했다. 절반만 맞다.

- `Problem.answer` — 맞다. `problems` read는 오너·public·member 전부 통과한다(`firestore.rules:82`).
- **풀이 탭 전문 — 틀렸다.** 블록 읽기는 `memberTabVisibility`로 탭 단위 차단이 가능하다(`firestore.rules:114-117` `tabAllowedForMember`). 풀이 탭을 가린 멤버에게 리포트의 `quote`·`derivedAnswer`는 **새 정보다.**
- 그리고 `Problem.answer`가 빈 문항(시트 D열 실측 3.9%만 채워짐 → Mathory에도 다수)에서는 `derivedAnswer`가 애초에 새 정보다.

**F2 결정 — 결론 (a) 유지, 근거 교체.** "유출이 0이라서"가 아니라 **"유출 범위가 멤버로 한정되고, 그 대가로 일치 대조의 진단 가치를 얻으며, 대안 (b)(c)가 더 나쁘다"** 가 실제 근거다. 그리고 이건 `derivedAnswer`만의 문제가 아니다 — **findings의 `quote` 자체가 같은 성격의 채널**이다. 알고 두는 것으로 확정하고, 문서에 잔여 리스크로 남긴다(§10). 완화가 필요해지면 그때 "탭이 가려진 문항은 칩에 경고" 정도로 족하다.

### 0-3. v3에서 그대로 가져가는 것

§3-1~3-16 전 항목, D1~D12·D13′·D14′·A1~A5·V1~V4. **v4에서 재론하지 않는다** — 아래 §2에 결정표로만 싣는다.

---

## 1. 아키텍처 (v1부터 불변)

**서버는 검증 엔진 프록시, 컨텍스트 조립과 저장은 클라이언트.** (discuss 관례)

- `app/api/verify/route.ts` — 블록 배열을 받아 2단 교차검증을 수행하고 리포트 JSON만 반환. **Firestore 미접촉.**
- 클라이언트 — 블록 수집 → 라우트 호출 → 리포트를 agent 메시지로 `addComment` → `setVerification`.

Firestore 규칙 0 · 마이그레이션 0 · discuss/proofread/ocr/ai-complete 라우트 0.

---

## 2. 확정 결정표

| # | 결정 | 출처 |
|---|---|---|
| D1 | 인증 = `verifyUid`를 `lib/apiAuth.ts`로 공용 추출 + fail-closed. env `VERIFY_ALLOWED_UIDS ?? AUDITION_ALLOWED_UIDS`(신규 env 0) | v1·v2 |
| D2 | 판정 어휘 `ok/check/fail/skip` 통일. **API 실패는 verdict가 아니다** | v1 |
| D3 | 2차 출력 = JSON-in-text + 견고 파싱. 근거 = **assistant prefill 400**(Claude 4.6+) | v2 |
| D4 | 검증 칩은 **오너 전용 — 규칙이 강제한다**(AI 댓글 create는 오너만) | v2 |
| D5′ | stale = 탭 정규화 해시. 배선은 `collectCurrentContent`+`hashPerTab`. problem 해시엔 answer 포함 | v2·v3 |
| D6′ | `derivedAnswer`는 JSON에만, 카드 자체 토글. `<details>` 금지. **근거는 F2로 교체** | v2·v3·**v4** |
| D7 | 리포트는 현재 활성 세션에(없으면 `createNormalSession` 자동 생성) | v1 |
| D8 | provider 확장(additive 옵션 + `getVerifyProviders`). params 조립을 순수 함수로 분리 + 스냅샷 테스트 | v2·v3 |
| D9 | `tool_choice:{type:'any'}` 금지 + `pause_turn` 루프(상한 3) | v2 |
| D10 | 앵커 = 인용 매칭으로 서버가 확정. 연속 원문 인용 강제 + 프리픽스 20자 폴백 + 실패 시 check 강등 | v2·v3 |
| D11 | 검증 전 dirty면 저장 강제, 저장 실패면 미실행 | v2 |
| D12 | `onRunVerify`/`onJumpToBlock`은 EditorView 주입 전용(ProblemView 변경 0) | v2 |
| D13′ | **2차 미완료 = 실패.** 리포트 미생성·`verification` 미갱신·오류+재시도. 1차 후보 노출 금지 | v3 |
| D14′ | 15,000자 초과 = **클라 사전 차단**(팝오버 전). `skip` verdict로 기록 금지 | v3 |
| **F1** | **2차 `code_execution`은 `VERIFY_JUDGE_CODE_EXEC` env 게이트, 기본 off.** 시트 미검증 신규 요소이므로 스텝 2에서 대조 측정 후 결정 | **v4** |
| **F2** | D6′ 근거 교정 — 멤버 유출은 0이 아니라 **한정**이다. `quote`도 같은 채널. 알고 둔다 | **v4** |
| A5 | 폴더 단위 일괄 검증은 범위 밖(라우트가 단건 stateless라 나중에 클라 루프로 얹힘) | v3 |

---

## 3. 스텝 0 — provider 확장 · 인증 공용화

### 3-1. `lib/ai-provider.ts` (additive만)

```ts
export interface CompleteOptions {
  jsonMode?: boolean;              // 기존
  forceCodeExecution?: boolean;    // 기존 — verify에서는 쓰지 않는다 (D9)
  // ── Phase 61b additive ──
  thinking?: 'adaptive';                                       // Claude
  effort?: 'low'|'medium'|'high'|'xhigh'|'max';                // Claude — output_config.effort
  enableCodeExecution?: boolean;                               // 인스턴스 기본을 호출 단위로 덮어씀 (F1 게이트)
  maxToolTurns?: number;                                       // pause_turn 재요청 상한 (기본 3)
  geminiThinkingLevel?: 'LOW'|'MEDIUM'|'HIGH';                 // Gemini — thinkingConfig
  geminiJsonMime?: boolean;                                    // Gemini — responseMimeType (V1)
}

/** Phase 61b — env 고정 모델용. Firestore ai_models 문서 없이 provider를 만든다. */
export function getVerifyProviders(models: { gemini: string; claude: string }): {
  first: AIProvider; judge: AIProvider;
};
```

**구현 요구**
- `ClaudeProvider`: `thinking`이 오면 `params.thinking = { type: 'adaptive' }`, `effort`가 오면 `params.output_config = { effort }`.
  ⚠ **`budget_tokens` 금지**(Opus 4.8에서 400). ⚠ **assistant prefill 금지**(400).
- `pause_turn` 루프: `res.stop_reason === 'pause_turn'`이면 `messages`에 assistant content를 그대로 push하고 재요청. `maxToolTurns`회까지. 누적 usage 합산. 상한 도달 시 마지막 응답으로 진행하되 `truncated: true`를 결과에 실어 라우트가 실패 처리할 수 있게 한다.
- `GeminiProvider`: `geminiThinkingLevel` → `generationConfig.thinkingConfig = { thinkingLevel }`, `geminiJsonMime` → `generationConfig.responseMimeType = 'application/json'`.
  (시트 실물: `QualityVerification.gs:480-486` — `response_mime_type` + `thinkingConfig` 동거)
- **params 조립을 순수 함수로 분리**: `buildClaudeParams(model, sys, usr, maxTokens, opts)` / `buildGeminiConfig(maxTokens, opts)`. 두 함수를 export하지 않아도 되지만, 파일 안에서 분리해 두면 아래 회귀 테스트가 가능해진다.

### 3-2. 회귀 방어 (필수)

`tests/aiProviderParams.test.mjs` — **옵션 미전달 시 params가 기존과 바이트 단위 동일**함을 스냅샷으로 고정. discuss·proofread는 새 옵션을 안 넘기므로 이 테스트가 통과하면 두 경로는 동작 불변이다.
추가로 수동 1회: agent 창에서 AI 1개 호출 · 편집창에서 교정 1회.

### 3-3. `lib/apiAuth.ts` (신규)

`app/api/sheet-import/route.ts:34-90`에서 `ApiError` + `verifyUid`를 그대로 옮긴다.

```ts
export class ApiError extends Error { constructor(public status: number, public userMessage: string) }
export async function verifyUid(authorization: string | null, apiKey: string, allowedUids: string[]): Promise<string>
```

⚠ `verifyUid`는 `NEXT_PUBLIC_FIREBASE_API_KEY`를 인자로 받는다(env 5종 중 하나). sheet-import는 import로 교체하고 **동작 무변경**을 확인한다(시트 가져오기 1회 실행).

### 3-4. 완료 기준

파라미터 스냅샷 테스트 통과 · discuss/proofread/sheet-import 수동 1회씩 정상 · 새 옵션이 실제 요청 바디에 실림(개발 로그로 1회 확인).

---

## 4. 스텝 1 — 프롬프트·파서 순수 모듈

### 4-1. 파일

- `lib/verify/prompts.ts` — 프롬프트 3세트 + 치환기 + `answerFormat` 산출 + 블록 라벨링
- `lib/verify/parse.ts` — JSON 파싱·복구·정규화·인용 매칭·합성

**둘 다 외부 import 0**(타입도 로컬 정의). 서로는 import해도 된다 — tsc 컴파일 대상에 둘 다 넣기 때문이다.

`package.json`에 추가:
```
"test:verify": "tsc lib/verify/prompts.ts lib/verify/parse.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/verify.test.mjs"
```
⚠ `--rootDir .`가 있어야 산출물이 `.test-build/lib/verify/`로 떨어진다(61a 관례).

### 4-2. `prompts.ts` 공개 함수

```ts
export function fillTemplate(tpl: string, vars: Record<string, string>): string;
export function labelBlocks(blocks: { blockKey: string; type: string; text: string }[]): string;
export function deriveAnswerFormat(a: { hasChoices: boolean; hasGanaOrRoman: boolean; answer: string }): string;
export const PROMPT_PROBLEM_FIRST: { system: string; user: string };
export const PROMPT_SOLUTION_FIRST: { system: string; user: string };
export const PROMPT_JUDGE: { system: string; user: string };
```

**`fillTemplate` — 함수형 치환 필수.**
```ts
tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
```
⚠ 치환값을 문자열로 넘기면 `$$`·`$&`가 패턴으로 해석돼 LaTeX가 손상된다. 콜백은 이 해석을 하지 않는다. (시트 STEP3가 같은 이유로 함수형을 쓴다 — `QualityVerification.gs:271-273`. **STEP1의 `.replace('{problem}', stem)`(`Itemverification.gs:302-303`)은 아직 안 고쳐진 자리이니 베끼지 말 것.**)

**`labelBlocks`** — `[블록 1] {text}\n\n[블록 2] …`. 라벨은 모델이 위치를 가리키게 하는 **힌트일 뿐**이고 앵커 확정은 인용 매칭이 한다(D10).

**`deriveAnswerFormat`** — 시트 `getFormatGuide`(`Itemverification.gs:522-528`) 4갈래를 Mathory 재료로 재현:

| 조건 | 반환 |
|---|---|
| `hasChoices && hasGanaOrRoman` | `"옳은 선택지 조합 (예: 'ㄱ' 또는 'ㄱ, ㄴ' 등)"` |
| `hasChoices` | `"선택지 번호 하나 (① ~ ⑤)"` |
| `/^\d{1,3}$/.test(answer.trim())` (1~999) | `"1~999 사이의 자연수"` |
| 그 외 | `"표준 수치 형식"` |

### 4-3. `parse.ts` 공개 함수

```ts
export function safeParseJson(raw: string): unknown;                  // 4단계 폴백
export function repairLatexControlChars<T>(v: T): T;                  // 파싱 후, trim 전
export function sanitizeFindings(raw: unknown[]): RawFinding[];       // 태그 화이트리스트·빈 항목 제거·id 재부여
export function normalizeForQuoteCheck(s: string): string;            // 공백 전량 제거
export function anchorByQuote(quote: string, blocks: {blockKey:string;text:string}[]): { blockKey: string|null; found: boolean };
export function synthesizeVerdict(findings: {verdict:'fail'|'check'}[]): 'ok'|'check'|'fail';
```

**`safeParseJson` 4단계** (`Itemverification.gs:690-728` 이식)
① 코드펜스 제거 → `\{[\s\S]*\}` 추출 → `JSON.parse`
② `\\([^"\\\/bfnrtu])` → `\\\\$1` 후 재시도
③ 문자열 내부 문자 단위 이스케이프 교정 후 재시도
④ 정규식 필드 추출(최후)

**`repairLatexControlChars` — 이것이 진짜 함정이다.**
`"\frac"`은 JSON 파싱이 **성공하면서** `␌ + "rac"`이 된다(`\f` = form feed). 오류가 나지 않으므로 ①~④로는 못 잡는다.
제어문자(`\b\f\n\r\t`) 바로 뒤에 영문자가 이어지면 LaTeX 명령으로 보고 백슬래시를 복원한다.
⚠ **`trim()`보다 먼저 호출할 것** — 선두 `␌`가 trim에 공백으로 소실되면 복원 불가다(`QualityVerification.gs:355-357`의 `★` 주석).
⚠ **JSON mime(V1)을 켜도, tool_use·structured output을 써도 면제되지 않는다** — 어느 경로든 결국 `JSON.parse`를 지난다.

**`anchorByQuote`(D10)**
① 공백 제거 후 전문 `indexOf` → 히트한 블록의 `blockKey`, `found: true`
② 실패 시 공백 제거한 앞 20자 프리픽스로 재탐색 → 히트하면 `blockKey`, `found: true`
③ 그래도 실패 → `{ blockKey: null, found: false }` → 라우트가 해당 지적을 `check`로 강등(환각 신호)
④ 2개 이상 블록에 매칭되면 **첫 블록**을 쓴다(순서가 곧 문서 순서다)

**태그 화이트리스트** — 기획서 B-3 원문 그대로. 임의 개명 금지(E-4 확정 체계):
문제 `조건결함 | 답없음 | 선택지오류 | 표기` / 풀이 `계산오류 | 표기오류 | 논리비약 | 논리오류 | 수식비일관 | 경우누락 | 문제풀이불일치` / 공통 `정답불일치`
미지 태그는 근사 매핑, `quote`·`reason`이 둘 다 비면 제거.

### 4-4. 테스트 (`tests/verify.test.mjs`)

1. `fillTemplate` — 값에 `$$x$$`·`$&`·`` $` `` 포함 시 원문 보존
2. `repairLatexControlChars` — `{"quote":"\frac{1}{2}"}` 파싱본이 `\frac`으로 복원
3. `repairLatexControlChars` — 선두 제어문자가 trim 전에 복원됨
4. `safeParseJson` — 펜스 포함 / 앞뒤 잡음 / 잘못된 이스케이프 / 완전 파손(4단계 진입) 각 1건
5. `sanitizeFindings` — 미지 태그 매핑 · 빈 항목 제거 · id 재부여
6. `anchorByQuote` — 전문 매칭 / 공백 차이 / 프리픽스 폴백 / 미매칭
7. `synthesizeVerdict` — `fail≥1→fail` / `check≥1→check` / 빈 배열→`ok`
8. `deriveAnswerFormat` — 4갈래

### 4-5. 프롬프트 문안

**계획서에 전문을 싣지 않는다**(61a A-4). 파일에서 실물로 확정하고 스텝 2에서 조정한다.
계승 필수: 보수 판정("판정 없으면 check", "모델이 못 풀었다고 fail 아님") · fail 전 재검토 1회 · 후보 상한 8 · `$...$` 규약 · **연속 원문 인용 강제**(`…` 생략 금지 — D10이 성립하려면 필수) · 그림 의존이면 `skip`+이유(B-8) · `[블록 n]` 라벨 유지 의무.

**착수 전 준비물**: 시트에서 `pushPromptCsvToGithub` 1회 실행 → STEP3 2세트를 pmt.csv에 반영(현재 csv는 12행뿐, STEP3 프롬프트 0건). push 후 `gemini_quality_verify_*`/`claude_quality_judge_*` **접두와 `enabled` 값**을 확인할 것(`getPromptSet`은 `enabled=TRUE` 행만 읽는다).

---

## 5. 스텝 2 — `/api/verify` 라우트

### 5-1. 계약

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;   // Vercel Pro 필수 (discuss 관례)

// POST /api/verify
// headers: Authorization: Bearer <Firebase ID token>
interface VerifyRequest {
  kind: 'problem' | 'solution';
  problemBlocks: { blockKey: string; type: string; text: string }[];
  solutionBlocks?: { blockKey: string; type: string; text: string }[];  // kind='solution'일 때 필수
  answer: string;          // '' 가능
  answerFormat: string;    // 클라가 deriveAnswerFormat으로 산출
  hasImages: boolean;      // 대상 탭에 image·svg·ggb 블록이 있는가
}
// 200: { report: VerifyReport, usage: { inputTokens, outputTokens, costUsd } }
// 4xx/5xx: { error: string }   ← ApiError 화이트리스트만
```

### 5-2. 파이프라인

```
❶ 인증 (verifyUid, fail-closed)
❷ 입력 검증 — 합산 15,000자 초과면 400 (클라가 이미 막지만 서버도 방어, D14′)
❸ 1차 Gemini
     thinkingLevel: 'HIGH', responseMimeType: 'application/json'  [V1]
     kind='problem' → STEP1 계승: 독립적으로 풀어 derivedAnswer 산출
     후보 상한 8, [블록 n] 라벨 부여
❹ safeParseJson → repairLatexControlChars → sanitizeFindings
❺ anchorByQuote로 blockKey 확정 (미매칭 → check 강등 + blockKey:null)   [D10]
❻ kind='problem': answerCheck 산출
     answer === ''            → 'no_answer'
     정규화 일치              → 'match'
     불일치                   → 'mismatch' → '정답불일치' 후보 1건 자동 추가  [V2]
❼ 후보 0건 AND answerCheck !== 'mismatch'  →  즉시 { verdict:'ok', models.judge:null, note:'(후보 없음)' }
❽ 잔여 예산 검사 — 2차에 부족하면 호출 없이 실패 반환                     [D13′·§3-13]
❾ 2차 Claude
     thinking:'adaptive', effort:'high', max_tokens 16000
     tools: VERIFY_JUDGE_CODE_EXEC === '1' 일 때만 code_execution        [F1]
     tool_choice 강제 없음, pause_turn 루프 상한 3                        [D9]
❿ ❹와 같은 파싱·복구 → judgments 매핑 (valid→fail / uncertain→check / rejected→탈락)
⓫ synthesizeVerdict → VerifyReport 조립 → 200
```

**정규화 일치 판정(❻)**: 양쪽에서 공백·`$`·`\left`/`\right`·후행 마침표를 제거한 뒤 비교. 애매하면 `mismatch`로 두고 2차 판정에 넘긴다 — 일치 대조는 *신호*이지 결론이 아니다.

### 5-3. 실패 정책 (D13′)

**"2차 판정이 완료되지 않은 검증은 검증이 아니다."**

| 상황 | 처리 |
|---|---|
| 1차 실패(API·파싱) | 재시도 1회 → 실패 시 `ApiError` 502. 리포트 없음 |
| 후보 0 + mismatch 아님 | ✅ `ok` 반환 (2차 미호출, 정상 경로. `models.judge:null`) |
| 예산 부족 | 2차 **호출 없이** `ApiError` 504 "시간이 부족해 판정을 마치지 못했습니다" |
| 2차 실패(API·파싱·`pause_turn` 상한 초과) | 재시도 1회 → `ApiError` 502. 리포트 없음 |

**어느 실패 경로에서도 `addComment`·`setVerification`을 하지 않는다.** 1차 후보를 findings로 노출하지 않는다 — recall 편향 후보를 지적으로 보여주면 2차가 존재하는 이유(보수 판정, B-4)가 무너진다.

### 5-4. env

| 이름 | 기본값 | 비고 |
|---|---|---|
| `VERIFY_GEMINI_MODEL` | `gemini-3.1-pro-preview` | `CLAUDE_PROOFREAD_MODEL` 선례 |
| `VERIFY_CLAUDE_MODEL` | `claude-opus-4-8` | 현행 유효 모델. `budget_tokens` 금지 |
| `VERIFY_JUDGE_CODE_EXEC` | `''`(off) | **F1** — 스텝 2 측정 후 결정 |
| `VERIFY_ALLOWED_UIDS` | (없으면 `AUDITION_ALLOWED_UIDS`) | 신규 env 0 |
| `VERIFY_GEMINI_COST_IN/OUT` | `0` | 0이면 미집계 |

API 키는 기존 `GEMINI_API_KEY`·`ANTHROPIC_API_KEY` 재사용 → **신규 비밀 0.**
`readEnv()`는 핸들러 안에서만 호출한다(빌드가 깨지지 않고, 호출 시 없는 변수 이름만 알린다 — 61a 관례).

**비용 상수**: Opus 4.8 = **$5 / $25 per 1M**(2026-06 기준, 출처 주석 필수). Gemini는 프로젝트에 원천이 없어 env로 뺀다. 두 다리 합산해 `usage`로 반환.

### 5-5. 완료 기준 — **이 스텝이 유일한 프롬프트 관문이다**

실제 문항 3~5건(61a로 가져온 것 중 오류 포함 문항 섞어서) 수동 호출.
- 중검출·과검출 피드백을 프롬프트에 반영한다. **판정 품질은 사양이 아니라 실물로 확정한다.**
- `VERIFY_JUDGE_CODE_EXEC` on/off 각 1회 대조 → 검산이 판정을 실제로 바꾸는지, `pause_turn`이 뜨는지, 소요 시간이 예산 안에 드는지 측정 → **F1 기본값 확정.**
- 토큰·비용·소요시간 실측 기록(300초 예산 여유 확인).

---

## 6. 스텝 3 — 실행 UI (칩 2개 + 비용 확인)

### 6-1. `CommentPanel` 변경 (칩·카드·strip만, 그 외 무변경)

props 추가:
```ts
onRunVerify?: (kind: VerifyKind) => Promise<void>;         // EditorView에서만 주입 (D12)
onJumpToBlock?: (blockKey: string, tabId: string) => void; // 〃
```

칩 위치 = `CommentEditor`의 `headerLeft`(현재 `AIChipBar` 자리, `CommentPanel.tsx:932`). `AIChipBar`와 나란히 fragment로 둔다.

게이트 3중:
1. `onRunVerify != null` → EditorView 전용 (D12)
2. `currentUid === ownerUid` → **규칙이 강제한다**(AI 댓글 create는 오너만, D4)
3. `isAISession` → 세션 없으면 전송이 막힌다(`:594-597`)

클릭 → 확인 팝오버: 비용 발생 고지 + 대상(문제/풀이) + 실행 버튼.
⚠ **팝오버를 열기 전에 15,000자 검사**(D14′) — 초과면 "문항이 너무 깁니다 — n자 / 15,000자"로 안내하고 팝오버를 열지 않는다. 비용 0으로 막을 수 있는 것을 호출 뒤에 알리지 않는다.

진행 표시는 `PendingAIBubble` 재사용. `PendingAI`에 `kind?: 'discuss' | 'verify'`를 additive로 추가하고, 합성 항목은 `{ modelId: 'verify:problem', nickname: '검증', emoji: '🔍', provider: 'anthropic', sessionId, kind: 'verify' }`.
⚠ **재시도 경로 분기 필수** — `handleRetryAI`는 `aiModels.find(...)`를 탄다. `kind === 'verify'`면 `onRunVerify`를 다시 부른다.

### 6-2. `EditorView` 변경

```ts
const handleRunVerify = useCallback(async (kind: VerifyKind) => {
  // 1) dirty면 저장 강제 (D11) — 실패하면 여기서 중단
  // 2) allBlocks에서 대상 탭 블록 수집 (blockKey = blockKeyOf(b))
  // 3) answerFormat = deriveAnswerFormat(...), hasImages 산출
  // 4) fetch('/api/verify', { Authorization: Bearer <idToken> })
  // 5) addComment({ authorUid:'ai:verify', authorType:'ai', modelId:'verify',
  //                 discussionSessionId, aiUsage, content: buildReportMarkdown(report) })
  // 6) setVerification(problem.id, kind, { verdict, verifiedAt, contentHash, stale:false, reportCommentId })
}, [...]);
```

**블록 텍스트**는 Firestore가 아니라 **저장 직후의 `allBlocks`**에서 만든다 — 저장이 선행되므로 서버본과 같고, `block_key`도 이때 영속돼 있다(§3-7·3-8이 한 번에 해결된다).
**ID 토큰**은 `sheet-import` 호출부와 같은 방식으로 얻는다(`getIdToken()`).

`hasImages` = 대상 탭 블록 중 `type`이 `image|svg|ggb`인 것이 하나라도 있으면 true.

### 6-3. 완료 기준

agent 창에서 버튼으로 실행 → 요약 markdown이 스레드에 뜬다. 15,000자 초과 문항에서 팝오버가 안 열린다. 오너가 아니면 칩이 안 보인다. 열람뷰(ProblemView)에는 칩이 없다.

---

## 7. 스텝 4 — 리포트 카드 · 블록 점프

### 7-1. 저장 형태 (`mathory-graph` 선례 그대로)

```markdown
**풀이 검증** — ⚠ 확인 필요 · 지적 3건
<빈 줄>
```mathory-verify
{ …VerifyReport JSON… }
```
```

`content`의 markdown 요약은 **폴백·히스토리용**이다(카드를 못 그리는 곳에서도 읽힌다).
⚠ **`<details>` 금지** — `stripForHistory`가 `[검산 코드 첨부됨]`으로 치환한다(`CommentPanel.tsx:35`). 접기는 카드 자체 상태로 한다.
⚠ **`derivedAnswer`·`quote`는 markdown 요약에 넣지 않는다** — JSON 안에만 둔다(D6′). 요약은 판정과 건수까지.

`stripForHistory`에 한 줄 추가:
```ts
.replace(/```mathory-verify[\s\S]*?```/g, '[검증 리포트 첨부됨]')
```

### 7-2. `components/comment/VerifyReportCard.tsx` (신규)

- 상단 종합 배지 — `ok` ✓ / `check` ⚠ / `fail` ✕ / `skip` −
- 지적 목록 — 태그 칩 · 인용 · 이유 · 제안 · `quoteFound === false`면 "원문 미확인" 표시
- `answerCheck` 표시 (`no_answer`면 "등록된 정답 없음")
- `derivedAnswer`는 **카드 자체 토글**로 펼침
- 각주 — 모델 2개 + 비용(`aiUsage` 관례)
- 지적 클릭 → `onJumpToBlock(blockKey, tabId)`. `blockKey === null`이면 클릭 비활성

### 7-3. 블록 점프 (`EditorView.handleJumpToBlock`)

1. 대상 탭이 다르면 `switchTab` 경유 — ⚠ **자동저장을 동반한다**(`:2643-2647`). 저장으로 doc id가 갈리지만 앵커가 `block_key`라 무사하다.
2. `allBlocks[tabId]`에서 `blockKeyOf(b) === blockKey`인 블록을 찾아 **그 `b.id`로** `[data-block-id]` 셀렉터를 만든다(`lib/caseBlock.ts:34`).
3. 활성 블록을 바꾸면 **`skipNextBlockScrollRef` 계약**을 맺는다(CLAUDE.md:100 — 직접 스크롤 핸들러는 effect 게이트를 우회하므로 같은 조건을 자기 안에 다시 적어야 한다).
4. 스크롤은 `lib/editorScroll.ts` 경유. **`scrollIntoView` 금지.**
5. 블록이 사라졌으면 토스트로 안내하고 스크롤하지 않는다.

### 7-4. 완료 기준

지적 클릭 → 해당 블록으로 이동(다른 탭 포함). 카드 아래에 이어서 "2번 지적 자세히" 같은 후속 대화가 기존 discuss 파이프라인 그대로 동작.

---

## 8. 스텝 5 — 상태 관리

### 8-1. 타입 (`types/problem.ts`, 전부 additive)

```ts
export type VerifyKind = 'problem' | 'solution';
export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

export interface VerifyFinding {
  tag: string;                 // 기획서 B-3 원문 union
  verdict: 'fail' | 'check';
  blockKey: string | null;
  quote: string;
  reason: string;
  suggestion?: string;
  quoteFound: boolean;
}

export interface VerifyReport {
  kind: VerifyKind;
  verdict: VerifyVerdict;
  findings: VerifyFinding[];
  derivedAnswer?: string;                            // JSON에만 (D6′)
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  models: { first: string; judge: string | null };   // null = 후보 0으로 2차 미호출 (D13′)
  note?: string;
  verifiedAt: number;
}

// Problem 안 (additive):
verification?: Partial<Record<VerifyKind, {
  verdict: VerifyVerdict;
  verifiedAt: number;
  contentHash: string;
  stale?: boolean;
  reportCommentId?: string;
}>>;
```

⚠ **`verification`에 findings·derivedAnswer를 넣지 말 것** — 이 문서는 public·member가 읽는다(`firestore.rules:82`).

### 8-2. `lib/firestore.ts` 신규

```ts
/** Phase 61b — verification만 갱신. updateProblem과 달리 updated_at을 건드리지 않는다
 *  (목록 정렬이 updated_at desc라 검증만으로 순서가 바뀌면 안 된다). */
export async function setVerification(
  problemId: string, kind: VerifyKind,
  patch: Partial<NonNullable<Problem['verification']>[VerifyKind]>,
): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    [`verification.${kind}`]: patch,   // 점 표기로 해당 kind만 교체
  });
}
```

### 8-3. contentHash (D5′ · V3 · V4)

```ts
async function tabHashFor(kind, { tabs, allBlocks, editTitle, editAnswer, tabLoadErrors }) {
  const content = collectCurrentContent({ tabs, blocksByTab: allBlocks, title: editTitle,
                                          answer: editAnswer, tabLoadErrors });   // lib/version/adapter.ts:20
  const per = await hashPerTab(content);                                          // lib/version/hash.ts:10
  return kind === 'problem'
    ? sha256(per['question'] + '\n#answer:' + (editAnswer || ''))                 // V3
    : per['solution'];
}
```

- **V3의 이유**: `canonicalizeTab`은 제목·정답을 포함하지 않는다(`canonicalize.ts:5-6` — meta는 `canonicalize`에만). 그런데 `answerCheck`는 `Problem.answer`에 의존하므로 answer만 고쳐도 problem 리포트는 낡는다.
- ⚠ `collectCurrentContent`는 탭 로드 실패 시 **`VersionLoadError`를 던진다**(`adapter.ts:29-31`) → **stale 계산 전체를 try/catch로 감싸 저장을 깨뜨리지 말 것.** 실패 시 stale은 손대지 않는다.
- ⚠ `sha256`은 `crypto.subtle`이라 보안 컨텍스트(localhost/https) 전용 — Phase 55가 이미 같은 제약 아래 돌고 있으므로 새 위험은 아니다.
- ⚠ **`snapshotCurrent`의 `last_version_tab_hashes`를 쓰지 말 것** — `!silent`일 때만 갱신되어(`EditorView.tsx:2627`) 자동저장에서 신호가 샌다.

### 8-4. `handleSave` 훅

저장 성공 후(리프레시 뒤, `setProofreadResults({})` 근처):
```
for (kind of ['problem','solution']):
  v = problem.verification?.[kind]
  if (!v) continue                       // 미검증이면 아무 일도 안 한다
  h = await tabHashFor(kind, ...)        // try/catch
  next = (h !== v.contentHash)
  if (next !== !!v.stale) await setVerification(problemId, kind, { ...v, stale: next })
```
값이 바뀔 때만 write → 저장마다 추가 쓰기가 나가지 않고, **되돌리면 stale이 자동 해제된다.**

### 8-5. 배지

`ListView.tsx:139-147` · `FolderView.tsx:553-570`의 `badgeStyle` 관례 옆에 추가.
`ok` ✓ / `check` ⚠ / `fail` ✕ / 미검증 없음. `stale`이면 배지 옆에 "재검증 필요".
목록은 **불리언·verdict만 읽는다 — 블록 로드 0.**

### 8-6. 완료 기준

검증 → 배지 표시 / 해당 탭 편집 → "재검증 필요" 전환 / **되돌리면 자동 해제** / `answer`만 수정 → problem만 stale / 검증해도 목록 순서 불변.

---

## 9. 스텝 6 — 마무리

실패 경로 전수 확인(1차 실패·2차 실패·예산 부족·상한 초과 — **어느 경우에도 리포트·배지 오염 0**), `roadmap.md` 갱신, CLAUDE.md에 Phase 61b 절 추가.

---

## 10. 잔여 리스크 (알고 두는 것)

1. **멤버 열람 채널 (F2)** — 리포트 댓글은 `commentsVisible`이 켜진 멤버가 전부 읽는다(`firestore.rules:234-236`). `memberTabVisibility`로 풀이 탭을 가린 멤버에게 `quote`·`derivedAnswer`는 새 정보다. 공개 뷰어는 `commentStream=false`라 차단된다. **오너 전용 생성 + 멤버 한정 열람**을 수용한 결과이고, 대안((b) answerCheck만 반환 / (c) 오너 전용 서브컬렉션)은 각각 진단 가치 상실 / 규칙 변경을 초래해 더 나쁘다.
2. **F1 미검증 요소** — 2차 `code_execution`은 시트 전례가 없다. 기본 off로 두고 스텝 2에서 측정한다.
3. **`VERIFY_ALLOWED_UIDS` 미설정 시 `AUDITION_ALLOWED_UIDS` 폴백** — 두 기능의 사용자 집합이 갈리는 날 분리해야 한다. 지금은 같은 사람이라 무해하다.
4. **300초 예산** — 2콜 직렬이라 여유가 크지 않다. 스텝 2 실측이 판단 근거다. 초과가 잦으면 스트리밍 또는 1차/2차 분리 호출(2 왕복)로 간다.

---

## 11. 하지 말 것

- 교정(proofread)과 합치지 말 것 — 별도 유지(기획서 B-2).
- GAS·시트 수정 금지. GAS 인용은 origin/main(`b6b91f6`), mathory 인용은 origin/main(`6833fe9`) 기준(61a Z2).
- 그림 이해 검증 시도 금지 → AI가 `skip`+이유. "더 좋은 풀이 제안" 범위 밖.
- `verification`에 findings·derivedAnswer 금지.
- 리포트를 별도 컬렉션에 저장하지 말 것 — 메시지가 단일 저장소.
- 2차 미완료를 리포트·verdict로 만들지 말 것(D13′). API 실패 시 `verification` 미갱신.
- `last_version_tab_hashes`를 stale 신호로 쓰지 말 것.
- **금지 목록**: `<details>`(strip 오치환) · `scrollIntoView`(editorScroll 경유) · `budget_tokens`(400) · assistant prefill(400) · `tool_choice:{type:'any'}`(최종 JSON 턴 불가) · 문자열 인자 `String.replace`(`$$` 손상).
- 태그 이름을 기획서 B-3에서 바꾸지 말 것 — E-4로 확정된 체계다.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 12. 이 Phase가 건드리지 않는 것

시트 가져오기 · Firestore 보안 규칙 · 마이그레이션 · 인쇄 · 공개 뷰어 · 전처리 파이프라인 · discuss/proofread/ocr/ai-complete **라우트**. **전부 0건.**

**신규 파일 6개**
`app/api/verify/route.ts` · `lib/verify/prompts.ts` · `lib/verify/parse.ts` · `lib/apiAuth.ts` · `components/comment/VerifyReportCard.tsx` · `tests/verify.test.mjs`(+`tests/aiProviderParams.test.mjs`)

**기존 파일 수정**
`types/problem.ts`(additive) · `lib/ai-provider.ts`(additive 옵션 + 팩토리) · `lib/firestore.ts`(`setVerification`) · `app/api/sheet-import/route.ts`(apiAuth import로 교체) · `CommentPanel.tsx`(칩·카드·strip·props) · `EditorView.tsx`(실행·점프·stale 훅) · `ListView.tsx`·`FolderView.tsx`(배지) · `package.json`(test:verify)

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 착안 + D1~D7 |
| v2 | CLI | 실측 교차검토 — §3-1~3-15 지적, D5·D6 개정, D8~D14 신설 |
| v3 | web | v2 전 지적 재검증(전건 사실) · 태그 개명 원복 · D13′/D14′ 개정 · A1~A5 · V1~V4 |
| **v4** | **CLI** | **F1(2차 code_execution은 시트 미검증 — env 게이트) · F2(D6′ 근거 교정) · 실행 세부 확정(시그니처·테스트·완료 기준)** |

교훈(61a 계승 · v3 관찰의 연장): v2는 provider 내부와 저장 경로를 봤고, v3은 상위 문서(E-4)와 대조해 v2의 개명 오류를 잡았다. **v4가 잡은 F1은 셋 다 놓쳤다** — v1이 "시트에 없는 신규 가치"라고 정확히 적어 둔 문장이 판본을 지나며 조용히 "이식 대상"으로 승격됐기 때문이다. **판본이 쌓일수록 앞 판본의 *유보 표현*이 뒤 판본에서 확정으로 굳는다** — 교차검토는 새 사실만이 아니라 **전 판본에서 톤이 바뀐 문장**을 찾아야 한다.
