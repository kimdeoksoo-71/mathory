# Phase 66a — 문답 검증 1단계: agent 탭 질문 리스트 구현 계획서 **v6 착수판** (CLI 실측 · 덕수 확정 2026-09-15)

> **구현 완료(2026-09-15) — 구현·후속·첫 실험 기록은 §13.** 착수판 본문(§0~§12)은 착수 시점 그대로 두었다. §13-2의 이탈 R1~R4와 §13-3의 실측 E1~E3가 본문보다 우선한다.

작성일: 2026-09-14 · 작성: **CLI 실측 재검증** · 기준 커밋: **mathory `origin/main 9061cf9`**
계보: 66 v1 → 브레인스토밍 → 66a v1(web) → v2(CLI) → v3(web) → v4(CLI) → v5(web) → **v6 = CLI 착수판**
(부록 B가 v5 판정 — **X1~X11 전부 사실** · **역정정 1(X3)** · 행 미세 정정 3 · 신규 보완 Y1~Y7 · **결정 Q1~Q6**)
착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

> **v6가 바꾸는 것은 셋이다.**
> ① **X3의 결론이 뒤집힌다** — Claude 경로에도 잘림 신호가 **있다**. `ClaudeProvider.complete`가 `stop_reason === 'max_tokens'`면
>    *"…응답이 토큰 한도(maxTokens)로 잘렸습니다."*, 도구 턴 상한이면 *"…도구 호출이 상한에 도달해 응답이 미완성입니다."*를
>    **답 본문 끝에 직접 붙인다**(`ai-provider.ts:508-513`). 출력 토큰을 셀 필요가 없다(Y1).
> ② **저장 가드는 ref 4종만으로 쓴다** — `savingRef`·`lastSaveOkRef`·`dirtyRef`·`handleSaveRef`가 **이미 있다**
>    (`:2939, 2941, 3226, 3218`). 클로저 값을 안 읽으면 v5의 X6(deps 누락)이 **원천 소멸**하고,
>    v5가 못 본 함정 — **대기 뒤에는 클로저 `dirty`가 반드시 stale이다** — 도 함께 닫힌다(Y2).
> ③ **code_execution 도구는 트리거와 무관하게 늘 붙는다** — D20은 *강제*만 막는다. G1·G3에서도 모델이
>    스스로 코드를 돌리면 턴이 곱해진다. 다만 그때는 답에 `<details>` 검산 코드가 붙어 **관측된다**(Y3).

---

## 0. 결정 사항 (Q1~Q6 — **덕수 확정 2026-09-15: 전항 권장안**. Q2는 "맞는지 확인하는 절차" 문안 승인)

| # | 결정 | 권장안 | 대안 | 근거 |
|---|---|---|---|---|
| **Q1** | 자동 저장 진행 중일 때 문답 전송의 저장 가드가 어떻게 기다리나 | **(A) ref 폴링** — `savingRef.current`가 false가 될 때까지 50ms 간격, 상한 15초, 초과 시 throw | (B) `handleSave`가 진행 중 promise를 돌려주도록 시그니처 변경 | A는 `handleSave` **무접촉**. B는 호출부 4곳(탭 전환·검증·자동 저장·저장 버튼)의 계약이 바뀐다. 저장은 전 탭 delete-all → re-add라 수 초가 걸릴 수 있어 상한이 필요하다 |
| **Q2** | 씨앗 G2 넷째 항목의 낱말 교체 승인 — "…다시 대입해 확인하는 **검산**" → "…다시 대입해 **맞는지 확인하는 절차**" | **승인** | 서버에 `mode:'ask'`를 두어 접미 부착을 끄기 | 실측: 원문은 `CODE_EXEC_TRIGGER_RE`에 **걸리고** 수정문은 안 걸린다(부록 C). 대안은 서버 변경이라 66b 이후. 씨앗은 덕수의 실험 변수라 **낱말 교체는 덕수가 승인해야 한다** |
| **Q3** | 실험 문서 `maxTokens` | **8192 유지** | 4096 | 위험은 토큰이 아니라 턴(X1)이고, 잘림·턴 상한 둘 다 **답에 마커가 붙어 관측된다**(Y1). 500이 실제로 나오면 그때 4096으로 내린다 |
| **Q4** | 트리거 낱말 검사(D20)는 경고인가 차단인가 | **경고** — 편집 모달·목록 행에 표식, 저장·전송은 막지 않는다 | 차단 | 앞으로 "진짜 검산을 시켜 보는" 질문을 만들 수도 있다. 모르고 걸리는 것만 막는다 |
| **Q5** | `ensureSavedForAI`를 61b 검증 칩(`handleRunVerify`)에도 적용하나 | **적용** — 같은 콜백을 두 호출부가 쓴다 | 66a 경로만 | X5(자동 저장 중이면 가드가 통과)는 **61b에 이미 있던 잠복 버그**다. 같은 함수를 만드는데 한쪽만 고치면 두 갈래가 생긴다. ⚠ 이 경우 "61b 코드 0"이 아니라 **"61b 서버 0 · 클라 저장 가드 1곳 공유"**다 |
| **Q6** | D1′ 개명(`'정밀 검증'` → `'교차 검증'`)이 **옛 리포트 표시에도 소급**되는 것을 수용하나 | **수용** | 옛 리포트는 그대로 두려면 저장 시각 분기 필요 | 라벨은 렌더 시 결정(`:405`)이라 데이터 무접촉이고, 한 화면에 옛·새 라벨이 섞이는 쪽이 더 헷갈린다 |

---

## 1. 요약

agent 대화창 입력 상단에 **질문 리스트 버튼**을 달고, 거기서 고른 검증 질문을 선택한 AI에게 보낸다.
질문 문안은 `users/{uid}/ask_questions`에 살며 **앱 안에서 추가·수정·복제·삭제**한다.

**이번 판의 목적은 기능 완성이 아니라 실험이다.** 질문 3개를 씨앗으로 넣고, 문안을 고치는 왕복이 배포 없이 도는 구조를 먼저 만든다.

**서버 0 · 프롬프트(`lib/verify/prompts.ts`) 0 · 61d/61h 코드 0 · 61b 서버 0(클라 저장 가드 1곳 공유 — Q5) ·
문항 스키마 0 · 렌더 5사이트 0 · 폰 0.**
Firestore 규칙 1블록 · 신규 3파일 · 기존 7파일 수정 · **ICONS 60 → 61종** ·
**로직 검증 439 → 446건**(`test:ask` 7) · **규칙 테스트 블록 65 → 67**(번호 64·65).

**핵심 설계 다섯**
- **D15′ 히스토리 미첨부** — 문답 전송만 `discussionHistory: []`. 클라(`hasAnyFig`·`images.history`)·서버(`validate`·`buildUserPrompt`)·
  **모델**(시스템 규칙 10 "히스토리가 비어있으면 첫 발언으로 간주", `route.ts:110` — Y5) 세 층이 전부 빈 배열을 정상 처리한다.
- **D14 실험 전용 모델 문서** — 800자·"단계 나열 금지"는 **시스템 프롬프트**에 있어 질문 본문으로는 못 이긴다. 콘솔 문서 하나로 `appendPrompt`를 덮는다. 코드 0.
- **D20 트리거 낱말 회피** — 질문 본문이 `/api/discuss`의 두 정규식에 걸리면 접미 부착 + `tool_choice:{type:'any'}`로 도구가 강제된다. 씨앗을 고치고 `triggerWarnings`가 경고한다.
- **D12″ 저장 가드 = ref 4종·deps 0**(Y2) — 진행 중 대기(Q1-A) → `dirtyRef` 재판독 → 저장 → `lastSaveOkRef` 판독 → 실패면 throw.
- **D21 전송 전체 try/catch** — `CommentEditor.handleSubmit`은 catch가 없다. 문답은 그 경로를 안 타므로 스스로 잡는다.

---

## 2. 범위 — 무엇을 **안** 하는가

| 항목 | 66a | 이유 |
|---|---|---|
| [문제 검증]·[풀이 검증] 칩 | **남긴다** | **대조군**. 삭제는 실험 뒤(66c) |
| `buildContext`·`invokeOneAI` lib 추출 | **안 한다** | 폴더뷰 배치(66b)가 CommentPanel 밖에서 같은 조립을 쓸 때 필요해진다 |
| 폴더뷰 순차 실행 | **안 한다** | 시간·비용·중단 정책이 추정치다. 1단계 실측 후 |
| 문제 검증 4종·논리 2종 | **안 넣는다** | 추측이다. 씨앗은 군더더기 3개뿐 |
| 결과 요약 팝업·`verification` 배지 | **안 한다** | 대화 기록이 곧 실험 로그 |
| 컨텍스트 길이 사전 경고 | **안 한다** | 검증 칩의 `verifyCharCount`는 검증 셈법이라 어긋난다. dev 콘솔로 본다 |
| 폰 대응 | **필요 없다** | `PhoneApp.tsx:392` `panelSlot('agent', false)` → `canComment=false` → 컴포저(`CommentPanel:1099`) 자체가 없다 |
| 서버 트리거 우회(`mode:'ask'`) | **안 한다** | 서버 변경이다 → 66b 이후. 1단계는 문안 회피(D20) |
| `truncated`를 discuss 응답에 싣기 | **안 한다** | 서버 변경이고, 마커가 이미 본문에 붙어 불필요하다(Y1) |

---

## 3. 확정 사실 (origin/main `9061cf9` — v5 인용 전수 재확인 + 신규 실측)

### 3-1. 전송 경로 (`handleSendMessage` `CommentPanel.tsx:680-787`)

| 지점 | 행 | 내용 |
|---|---|---|
| `writeSessionId` | `:684-686` | 댓글 모드면 `commentSessionId`, agent면 `activeSessionId` |
| **답글 분기** | **`:689-700`** | `if (replyingTo) { … ; return }` — **AI 0회** |
| 댓글 모드 분기 | `:703-712` | `return` |
| 세션 가드 | `:715-718` | `alertDialog('먼저 세션을 만들어 주세요.')` |
| 모델 해석 | `:721-724` | `invokedIds = isAISession ? [...selectedModelIds] : []` → `aiModels.find` |
| 사람 메시지 저장 | `:726-733` | **`invokedModelIds` 포함**(`:731`) — 어느 모델에 물었는지가 대화에 남는다(X11) |
| 조기 반환 | `:735` | `if (invokedIds.length === 0) return` |
| 컨텍스트·히스토리 | `:738-739` | `buildContext()` · `buildHistory()` |
| 그림 유무 | `:746-747` | `hasAnyFig = … || historySlots.some(a => a.length > 0)` |
| 바디 조립 | `:749-764` | `discussionHistory: history` · `images`는 `hasAnyFig`일 때만(`:756-763`) |
| 병렬 호출 | `:784-786` | `Promise.allSettled(invokedModels.map(invokeOneAI))` |

`CommentEditor.onSubmit`은 `(content: string) => Promise<void>`(`CommentEditor.tsx:26`) — 옵셔널 둘째 인자를 더해도 계약이 안 깨진다.
⚠ 함정 셋: 답글 분기가 AI를 삼킨다(D17) · override는 **대체**(E3) · `buildHistory()`가 무조건 돈다(D15′).
⚠ `runVerify`(`:807-836`)는 `setSelectedModelIds([])`(`:822`) — 문답은 칩 선택을 건드리지 않는다(G7).
⚠ **재시도는 D15′를 보존한다** — `retryContext`(`:669`)를 `handleRetryAI`가 재사용(`:857`).

### 3-2. `math_snippets` 전례

규칙 `firestore.rules:30-32`(`match` 30 · `allow` 31 · `}` 32) · `toolbar_config` `:35-37` · CRUD `lib/snippets.ts:16-64` · 타입 `types/snippet.ts`.
⚠ `orderBy`는 그 필드가 없는 문서를 제외한다(V6). ⚠ 스니펫 관리 UI는 저장소에 없다 — 편집 모달은 `dialogStyles`로 새로.

### 3-3. 상단 바

`headerLeft`(`:1156-1180`) = `flex; flexWrap: wrap; gap 6` 안에 `AIChipBar`(`:1384`, `models={aiModels}` `:1161`) + `VerifyChips`(`:1439`).
fragment 금지(`:1157-1158`) · 칩 래퍼 `position:relative` 금지(`:1458-1460`) · **기준 상자 = 컴포저 래퍼 `:1100-1104`** ·
패널 420에서 내부 폭 388 → `left:0; right:0`(E10) · 컴포저는 `canComment ? … : …`(`:1099`) 안.
게이트 재료: `ownerUid`(`:67`) · `currentUid`(`:70`) · `isAISession`(`:359`) · `activeSessionId`.

### 3-4. 아이콘

`PH.listChecks`는 `ProofreadIcon`(교정)이 쓴다(`gen-phosphor-paths.mjs:78` · `UnifiedToolbar.tsx:83`) — 재사용 금지(E1).
`listDashes: ['list-dashes', 'regular'],` 1키 · `lib/phosphor-ko.json`에 `"list-dashes"` 실재 · `icons:gen` → 빌드 로그 **`OK — 61종`** ·
`Icons.tsx`에 `export const IconQuestionList = phIcon(PH.listDashes, 16);`(팩토리 `:38-43`).

### 3-5. 시간 예산과 도구 턴 (X1 ✓ · Y3)

| 사실 | 근거 |
|---|---|
| 라우트 300초 · 내부 타임아웃 **280초** | `maxDuration = 300`(`route.ts:19`) · `TIMEOUT_MS = 280_000`(`:58`) · `withTimeout(provider.complete(...), TIMEOUT_MS)`(`:570-579`) · 초과 시 500(catch `:600`) |
| **discuss의 Claude는 code_execution 도구가 늘 붙는다** | `new ClaudeProvider(apiKey, config.apiModelName, **true**)`(`ai-provider.ts:556`) · 검증 판정자는 `false`(`:592`) |
| **트리거와 무관하게** `params.tools`가 실린다(Y3) | `buildClaudeParams`: `codeExec = opts?.enableCodeExecution ?? args.enableCodeExecution; if (codeExec) params.tools = [CLAUDE_CODE_EXEC_TOOL]`(`providerParams.ts:63-65`). 트리거는 **`tool_choice:{type:'any'}`**(`:66-67`)만 좌우한다 |
| 한 요청 안에서 Anthropic 호출 **최대 4회** | `for (let turn = 0; ; turn++)` · `pause_turn`이면 assistant 턴을 이어 붙여 재요청 · `if (turn >= maxTurns) { truncated = true; break }`(`ai-provider.ts:430-452`) · `DEFAULT_MAX_TOOL_TURNS = 3`(`providerParams.ts:34`, discuss는 `maxToolTurns`를 안 넘겨 기본값) |
| 각 턴이 같은 `max_tokens`를 받는다 | `buildClaudeParams({ … maxTokens … })`가 루프 안(`:431-438`) → 8192면 최악 4 × 8192 |
| **두 잘림 모두 답 본문에 마커가 붙는다**(Y1) | `stop_reason === 'max_tokens'` → *"…응답이 토큰 한도(maxTokens)로 잘렸습니다."* · 턴 상한 → *"…도구 호출이 상한에 도달해 응답이 미완성입니다."*(`ai-provider.ts:508-513`) — `content`에 포함돼 Firestore에 저장되고 말풍선에 보인다 |
| **코드가 돌면 답에 `<details>` 검산 코드가 붙는다** | `appendCodeExecDetails(body, codeBlocks)`(`:506` · 정의 `:28-35`) — 턴이 곱해졌는지를 사후에 안다 |

**결론.** 위험은 토큰이 아니라 턴이다. D20이 *강제*를 막고, 자발적 도구 사용은 답의 `<details>`로 관측한다. 닿으면 500이고 사람 메시지는 저장돼 있어 [재시도]로 복구된다.

### 3-6. 사용자 메시지가 서버에서 가로채인다 (X2 ✓ — 실측으로 재확인)

`route.ts:520-531`: `codeExecForced = codeExecution && CODE_EXEC_TRIGGER_RE.test(body.currentMessage)` → `currentMessage += USER_MESSAGE_CODEEXEC_SUFFIX` · `graphForced` 동일.
- `CODE_EXEC_TRIGGER_RE = /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i`(`:256`) · `codeExecution = isCodeExecutionModel(config)` — **anthropic 포함**(`:378-380`)
- 접미(`:259-262`): *"[필수] 이 메시지는 명시적인 검산 요청입니다. … 반드시 Python(SymPy) 코드를 **실제로 실행**해 … 코드 실행 없이 답하면 응답이 무효 처리됩니다."*
- `forceCodeExecution: codeExecForced && config.provider === 'anthropic'`(`:575`) → `tool_choice = { type: 'any' }`
- `GRAPH_TRIGGER_RE`(`:266-267`)는 `isGraphModel`(google·openai, `:385-387`) 전용이라 Claude엔 접미가 안 붙지만 **앞으로 모델을 바꾸면** 걸린다 — 경고는 둘 다 낸다.

**실측(부록 C)**: 씨앗 원문 G2는 `code: true`, 수정 G2·G1·G3는 전부 `false`. 낱말 하나("검산")가 질문을 요청으로 바꿨다.

### 3-7. 저장 가드의 실물 (X4·X5·X6 ✓ → Y2)

| 사실 | 행 |
|---|---|
| `savingRef`(초기 false) · `lastSaveOkRef`(**초기 true**) | `EditorView.tsx:2939, 2941` |
| `handleSave` 머리 **`if (savingRef.current) return;`** — 진행 중이면 즉시 반환, 신호 없음 | `:2944` |
| 성공 `lastSaveOkRef = true` · 실패는 `catch`에서 **삼킨다**(`setStatus`·`setSaveError`·`lastSaveOkRef = false`, throw 없음) · `finally`에서 `savingRef = false` | `:3066` · `:3081-3084` · `:3086` |
| 61b 가드 `if (dirty) { await handleSave(true); if (!lastSaveOkRef.current) throw … }` — deps에 `dirty`·`handleSave` | `:3113-3116` · `:3137` |
| 자동 저장 경로 셋: 탭 전환 `switchTab → handleSave(true)` · 30분 인터벌 · 저장 버튼 | `:3094` · `:3229-3240` · `:3213` |
| **`dirtyRef`·`handleSaveRef`가 이미 있다** — 30분 자동 저장 effect가 그것으로 클로저를 피한다 | `:3226-3227` · `:3218-3219` |

**Y2 — 왜 ref만으로 써야 하나.** v5의 D12′ ③ "deps에 `dirty` 포함"은 필요조건이지만 충분하지 않다.
가드가 진행 중 저장을 **기다린 뒤**에는 그 사이 사용자가 친 글자로 `dirty`가 바뀌어 있어도 클로저의 `dirty`는 렌더 시점 값이다.
`dirtyRef.current`를 **대기 뒤에** 읽어야 한다. 그러면 deps가 `[]`가 되어 X6도 사라진다.

### 3-8. 그 밖의 제약

| 제약 | 근거 | 대응 |
|---|---|---|
| 답변 규칙 = 800자(`:98`) + 단계 나열 금지(`:101`) + 장황하면 무효(`:88`) | `BASE_SYSTEM_PROMPT` | `appendPrompt`(D14) |
| `ai_models.maxTokens` 기본 1024 | `ai-models.ts:24` · `route.ts:571` | 8192(Q3) · 21,333 미만(V4) |
| `getEnabledModels` 모듈 캐시 | `ai-models.ts:13-14, 50-58` | 콘솔 수정 후 새로고침 |
| `appendPrompt`는 Claude 경로에서 실질 맨 뒤 | `:241-243` · `STRUCTURED_OUTPUT_INSTRUCTION`(`:245`)은 DeepSeek 전용 | — |
| 컨텍스트 15,000자 자름(`console.warn`만) | `CommentPanel:553, 568-573` | dev 콘솔 |
| D15′의 서버 처리 | `validate` `Array.isArray`(`:452`) · `if (body.discussionHistory.length)`(`:408-415`) · 시스템 규칙 10(`:110`) | 빈 절 머리말 없음 · 모델도 첫 발언으로 읽는다(Y5) |
| AI 댓글 create 오너만 · `resolved == false` | `firestore.rules:262-268` · `comments.ts:101` | 작업 0 |
| `CommentEditor.maxLength 1000`은 문답에 안 걸린다 | `:51, 236` | 유일 상한 8000자(`validateQuestion`) |
| `CommentEditor.handleSubmit`은 `try/finally`뿐 — catch 없음 | `:140-144` | 문답은 스스로 잡는다(D21) |
| 규칙 테스트 | 블록 65 · 번호 최대 63(`26a·26b·27a·27b` 접미형) | 새 케이스 번호 64·65 / 블록 67 |

---

## 4. 결정표 (v6)

| # | 결정 | 근거 |
|---|---|---|
| **D1′** | 새 기능 = **'문답 검증'** · 61b UI 라벨 `'정밀 검증'` → `'교차 검증'`(`:405`) · 소급 수용(Q6) | '정밀 검증'은 문서 전반에서 61b/61d/61h |
| **D2** | 저장 = `users/{uid}/ask_questions` | 규칙 3줄 |
| **D3** | `{ label, target, text, order, enabled, rev, created_at, updated_at }` — `order` 필수 | V6 |
| **D4** | 비면 씨앗 3개 자동 생성 — 팝오버 첫 열기 + **uid별 in-flight Map** | 마운트 훅이면 문항마다 읽기 |
| **D5** | 편집 UI는 팝오버 안 — ⋮ → 수정·복제·삭제, [+ 새 질문] | 고치고 싶어지는 순간이 그 화면 |
| **D6** | 복제가 1급 | 덮어쓰면 비교 대상이 사라진다 |
| **D7** | `rev`+1 · 첫 줄 `[문답 검증 · {label} r{rev}]` | 대화 = 실험 로그(+`invokedModelIds` — X11) |
| **D8** | 모델 기본 = `localStorage` → `provider==='anthropic'` 중 `order` 최소 | D14 문서 `order`를 작게 |
| **D9** | `localStorage['mathory.ask.v1'] = { modelIds }` try/catch | 질문은 매번 고른다 |
| **D10** | 버튼 = `headerLeft` flex 맨 앞 `[≡ 질문]` | 밀리면 아이콘 단독 |
| **D11** | 치환 없음 | 66b |
| **D12″** | **저장 가드 = ref 4종 · deps `[]`**(Y2 · Q1-A): ① `savingRef.current`가 true면 50ms 폴링, 15초 초과 시 throw ② `dirtyRef.current`가 true면 `await handleSaveRef.current(true)` ③ `lastSaveOkRef.current`가 false면 throw. `handleRunVerify`도 이 콜백을 쓴다(Q5) | X4(throw 안 함) · X5(진행 중 통과) · X6(deps) · **대기 뒤 stale `dirty`**를 한 구조로 닫는다 |
| **D13** | ICONS `listDashes`(60 → 61) | E1 |
| **D14** | 실험 전용 `ai_models` 문서 — 콘솔, 코드 0, 필드 §9 | 시스템 프롬프트를 `appendPrompt`로 덮는다 |
| **D15′** | 문답만 `discussionHistory: []` | 클라·서버·모델 세 층 확인 |
| **D16** | [보내기] = 해석 모델 ≥1 ∧ `activeSessionId` ∧ `!busy`(`pendingAI.some(p => p.sessionId === activeSessionId && !p.error)`) | E4 · 연타 |
| **D17** | 전송 직전 `setReplyingTo(null)` | `:689` |
| **D18** | `order` = 최대+10 · 복제 = 원본+1 | — |
| **D19** | `appendPrompt`는 통제 변수 — 실험 중 고정 | 변수는 문안 하나 |
| **D20** | 질문 본문은 트리거 낱말을 피한다 — 씨앗 G2 한 줄 수정(Q2) · `triggerWarnings` **경고**(Q4) · T7 회귀 | X2 |
| **D21** | 문답 전송 전체 try/catch — `onBeforeSend`와 `handleSendMessage` 둘 다 | X7 |
| **D22** | **자발적 코드 실행은 막지 않고 기록한다**(Y3) — 답에 `<details>` 검산 코드가 붙으면 §10 기록에 "코드 실행됨"으로 남긴다 | 막으려면 서버 변경. 관측 가능하므로 1단계는 기록만 |

---

## 5. 데이터 모델

```
users/{uid}/ask_questions/{qid}
  label       string
  target      'problem' | 'solution'
  text        string        // 꼬리 포함 — 꼬리도 실험 변수
  order       number        // ⚠ 필수(V6)
  enabled     boolean
  rev         number
  created_at / updated_at   serverTimestamp
```
규칙 — `match /users/{userId}` 안, `toolbar_config`(`:35-37`) 아래:
```
// 문답 검증 질문(Phase 66a): 본인만
match /ask_questions/{qid} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### 씨앗 3개 (`lib/ask/seed.ts` · import 0)

공통 전제: 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항, 풀이의 결론도 옳다.
G2 = "지워도 되는 것"(61h 정의) · G3 = "더 짧게 쓸 수 있는 것"(61h 제외 영역) · G1 = 기준선.

**G1 · 군더더기(원문)** `order 10`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.
그런 전제에서, 풀이에 군더더기가 있으면 사소한 거라도 빠짐없이 찾아서 알려줘.

각 지적마다 원문을 짧게 인용하고, 왜 군더더기인지와 수정 방향을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.
```

**G2 · 군더더기(삭제 검사)** `order 20` — ⚠ 넷째 항목 한 줄이 v5에서 바뀌었다(Q2 승인 대상)
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

풀이의 각 대목을 지워 보면서, 그 대목을 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지
논증이 완결되는 곳을 사소한 것이라도 빠짐없이 찾아줘. 이런 것들이 여기 해당해:
- 최종 답에 쓰이지 않는 양을 구하거나 성질을 밝힌 곳
- 뒤에서 한 번도 참조되지 않는 중간 결과
- 앞 결론에 새 내용을 보태지 않고 말만 바꾼 되풀이
- 동치 변형만으로 확정된 답을 다시 대입해 맞는지 확인하는 절차

다만 문제 조건을 기호로 정리하는 첫머리, 정의·표기 선언, 경우 나눔의 표지, 답을 확정하는 문장,
필요조건으로 좁힌 뒤의 충분성 확인은 제외해.

각 지적마다 삭제 범위를 "'…'부터 '…'까지"로 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.
```

**G3 · 군더더기(압축 재작성)** `order 30`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

이 풀이를 논리적 완결성은 그대로 둔 채 가장 짧게 다시 써 줘.
그리고 줄어든 부분이 각각 왜 없어도 되는지 항목으로 정리해 줘 — 안 쓰이는 계산이었는지,
알려진 정리로 한 줄에 갈 수 있었는지, 단순 이항·통분을 여러 줄로 늘린 것이었는지,
나누지 않아도 되는 경우를 나눈 것이었는지.

수식은 $...$로 감싸.
```
⚠ G3는 시스템 프롬프트("단계 나열 금지" `:101` · "장황하면 무효" `:88`)와 정면으로 부딪힌다. D14 없이는 측정 대상이 문안이 아니라 시스템 프롬프트의 저항이다.

### 트리거 낱말 (D20 · `lib/ask/seed.ts`)
```ts
/** ⚠ app/api/discuss/route.ts:256·266-267의 의도적 이중 — 이 파일은 import 0이라 라우트를 못 읽는다.
 *  라우트를 고치면 여기도 함께. (전례: listColumns verifyRank ↔ VERIFY_VERDICT_META) */
export const DISCUSS_TRIGGER_RES = [
  { re: /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i, why: '코드 실행이 강제됩니다(SymPy 실행 요구 문구 부착)' },
  { re: /(그래프|좌표\s*평면|개형)\s*(을|를|으로|로)?\s*(좀\s*)?(그려|그리|보여|시각화)|도시해|plot\b/i, why: '그래프 펜스 출력이 강제됩니다(google·openai 모델)' },
];
export function triggerWarnings(text: string): string[];
```

---

## 6. UX

**버튼.** `headerLeft` flex 맨 앞 `[≡ 질문]`. 게이트 `isAISession && currentUid === ownerUid`. 숨김 사유 dev 콘솔.

**`AskListPopover` prop**
```
uid · models(= aiModels) · busy · canSend(= !!activeSessionId)
onSend: (message, modelIds) => Promise<void>      // CommentPanel이 D15′·D17 담당
onBeforeSend?: () => Promise<void>                // D12″ — 실패 시 throw
```

**1단 목록.** 컴포저 래퍼 기준 `absolute; bottom:calc(100%+6px); left:0; right:0` · `maxHeight 320; overflowY:auto` · `zIndex 20`.
행 = `{label} r{rev}` + 첫 줄 미리보기 + (트리거 경고면 ⚠) + ⋮ → 수정·복제·삭제(`confirmDialog({danger:true})`)·사용 토글.
[+ 새 질문] · `enabled:false`는 맨 아래 흐리게 · 로드 실패는 빈 목록 + 안내(크래시 금지).

**2단 전송.** 라벨 · 모델 칩(기본 D8) · "이 전송은 이전 대화를 참조하지 않습니다" · 트리거 경고 줄 · [취소] [보내기](D16).
**전체 try/catch**(D21): ① `await onBeforeSend?.()` — throw면 `alertDialog` 후 중단, 팝오버 유지 ② 닫기 → `setReplyingTo(null)` ③ `await handleSendMessage(전송문, { modelIds, noHistory: true })` — throw면 `alertDialog`.

**편집 모달.** `dialogStyles`(`dialogOverlay`·`dialogBody`·`dialogHead`·`dialogContent`·`dialogFoot`·`dialogInput`·`dialogBtn()` `:79`).
라벨 · 대상 · textarea 12줄+ · 사용 여부 · 트리거 경고 줄 · [취소] [저장](`rev`+1). 복제 = `label + ' 사본'` · `rev 1` · `order 원본+1` → 곧바로 모달.
`Z_DIALOG 10500` · `position:fixed` 전례 `SelectionInsertPopup.tsx:291`.

**전송문** = `[문답 검증 · {label} r{rev}]\n\n{text}`. 전문이 사람 메시지로 남는다(실험 로그 — 거슬리면 66c).

---

## 7. 구현 항목

### 신규
| 파일 | 내용 |
|---|---|
| `lib/ask/seed.ts` (import 0) | `AskQuestion` · `SEED_QUESTIONS` · `ASK_LABEL_PREFIX` · `buildAskMessage` · `nextRev` · `nextOrder` · `validateQuestion` · `DISCUSS_TRIGGER_RES` · `triggerWarnings` |
| `lib/askQuestions.ts` (firestore · ⚠ `lib/ask/` 밖) | `listAskQuestions`(order 없는 문서 dev 경고) · `createAskQuestion` · `updateAskQuestion` · `duplicateAskQuestion` · `deleteAskQuestion` · `ensureSeeded`(uid별 Map) |
| `components/comment/AskListPopover.tsx` | 1단·2단·편집 모달 |

### 수정
| 파일 | 변경 |
|---|---|
| `CommentPanel.tsx` | ① `handleSendMessage(content, opts?: { modelIds?; noHistory? })` — `:721` 대체 · `:739` `opts?.noHistory ? { history: [], slots: [] } : buildHistory()` ② `headerLeft` 맨 앞 `<AskListPopover>` ③ `:405` 개명 ④ `onBeforeAskSend?` prop ⑤ 전송 래퍼 `setReplyingTo(null)` |
| `EditorView.tsx` | **`ensureSavedForAI = useCallback(async () => { …ref 4종… }, [])`** — `savingRef`·`lastSaveOkRef`·`dirtyRef`·`handleSaveRef`만 읽는다(Y2). 정의 위치는 `dirtyRef`(`:3226`) **뒤**. `handleRunVerify`(`:3113-3116`)의 dirty 블록을 이 콜백 호출로 교체(Q5) · `onBeforeAskSend={ensureSavedForAI}`. ProblemView는 안 넘긴다 |
| `Icons.tsx` | `IconQuestionList` |
| `gen-phosphor-paths.mjs` | `listDashes` → `icons:gen` |
| `firestore.rules` + `tests/firestore.rules.test.mjs` | 블록 + 케이스 64·65 |
| `package.json` | `test:ask`(`--rootDir .`) |
| `CLAUDE.md` · `roadmap.md` | Phase 66a 절 · 446건 · 규칙 블록 67 |

### `ensureSavedForAI` 골격
```ts
const ensureSavedForAI = useCallback(async () => {
  // ① 진행 중 저장이 가라앉을 때까지 (Q1-A: 50ms × 최대 300회 = 15초)
  for (let i = 0; savingRef.current; i++) {
    if (i >= 300) throw new Error('저장이 끝나지 않아 전송을 중단했습니다');
    await new Promise((r) => setTimeout(r, 50));
  }
  // ② 대기 뒤 재판정 — 클로저 dirty가 아니라 ref (Y2)
  if (dirtyRef.current) {
    await handleSaveRef.current(true);
    if (!lastSaveOkRef.current) throw new Error('저장에 실패해 전송을 중단했습니다');
  }
}, []);
```

### 커밋
| S | 범위 | 완료 기준 |
|---|---|---|
| S1 | `seed.ts` + `test:ask` + 규칙 + 규칙 테스트 | `test:ask` 7 · `test:rules` 67 블록 |
| S2 | `listDashes` + `IconQuestionList` | `icons:check` **61종** |
| S3 | `askQuestions.ts` + `AskListPopover` + CommentPanel 배선 + 개명 | 씨앗 생성 · CRUD · 전송 · 바디 `discussionHistory: []` · 접미 미부착 · 경고 표시 |
| S4 | `ensureSavedForAI`(EditorView, Q5 포함) + D21 | 저장 실패 → 중단 · 자동 저장 중 → 대기 후 최신본 전송 · 검증 칩도 같은 경로 |
| S5 | 문서 | — |

---

## 8. 테스트

**`tests/ask.test.mjs`(7)**: T1 씨앗 3·유일·solution·10/20/30·enabled·rev 1 / T2 `오류가 없고`·`빠짐없이` / T3 첫 줄 + 본문 무변경 /
T4 `nextRev` / T5 `validateQuestion` / T6 `nextOrder` / **T7 `triggerWarnings(seed.text)` 셋 다 `[]` · `'검산해줘'` 1건 · `'그래프를 그려줘'` 1건**.
규칙: 64 본인 허용 · 65 타인 거부.

**실물 검수**
1. G1·G2·G3 같은 문항·같은 세션 — 네트워크 탭 `discussionHistory: []` · `images.history`는 그림이 있을 때만 빈 배열, 없으면 `images` 키 자체가 없다
2. 요청 바디 `currentMessage`에 `[필수] … 검산 요청입니다` 접미 **없음**(D20)
3. 답 끝의 마커 확인(Y1) — *"…토큰 한도(maxTokens)로 잘렸습니다"* / *"…도구 호출이 상한에 도달"* / `<details>` 검산 코드 유무를 기록
4. G2 복제 → 수정 → `rev`·순서·경고 줄
5. 답글 모드에서 전송 → AI 호출됨
6. 칩 2개 켠 채 전송 → D14 하나만 · 칩 유지
7. 저장 실패(네트워크 끊고) → 안내 후 중단
8. **자동 저장 중**(탭 전환 직후) 전송 → 대기 후 최신본
9. 재시도 → 히스토리 미첨부 유지
10. 회귀: 타이핑 전송(히스토리 정상) · 검증 칩('교차 검증' · **자동 저장 중 실행도 이제 대기한다** — Q5) · 그림 첨부
11. 폰 agent 시트 — 버튼 없음

---

## 9. 덕수 준비물

### 1. 실험 전용 `ai_models` 문서 (콘솔, D14) — `mapDoc`(`ai-models.ts:17-36`) 전 필드

| 필드 | 값 | 빠지면 |
|---|---|---|
| `apiModelName` | 원본과 동일 | 문서 id가 모델명으로(`?? id`) → 500 |
| `provider` | `'anthropic'` | 분기 붕괴 |
| `maxTokens` | **8192**(Q3 · 21,333 미만) | 1024 |
| `inputCostPerMillion` / `outputCostPerMillion` | 원본과 동일 | 비용 0 → §10-5 무효 |
| `order` | 기존 Claude보다 **작게** | D8 기본이 안 잡힌다 |
| `nickname` | 다른 한 음절(예 '문') | 충돌 |
| `displayName` | 구별되는 이름 | 칩 혼동 |
| `enabled` | `true` | 안 뜬다 |
| `appendPrompt` | 예: *"이 요청에서는 800자 제한과 단계 나열 금지를 적용하지 않는다. 지적을 빠짐없이 항목으로 적어라."* | D14 무의미 |

⚠ 기존 Claude 문서 무접촉 · 새로고침 · 칩이 하나 늘어난다 · `enabled:false`로 내려도 닉네임 예약은 남는다(`getReservedNicknames` → `getAllModels` `:73-76`) · `appendPrompt` 고정(D19).

### 2. 실험 문항 3~5개 — 군더더기가 있을 법한 고난도·긴 풀이
### 3. 규칙 배포 — S1 이후
### 4. **Q1~Q6 판정** — 권장안과 다르면 착수 전에

---

## 10. 실험 운용

문안 3개를 같은 문항·같은 세션에 돌리고 여섯을 본다. 기록은 세션 자체(+ `invokedModelIds`).
1. **지적 건수와 질**
2. **잘림** — 답 끝 마커 두 종(Y1). 마커가 없으면 안 잘린 것이다. 출력 토큰(`:1938`)은 보조
3. **시스템 프롬프트의 저항** — G3가 재작성을 해 주는가
4. **시간** — 280초 예산 · 턴 최대 4회 · `<details>`가 붙었으면 턴이 곱해진 것(D22)
5. **비용** — `$…`(`:1940`) 합산 · 세션 합계(`:982`)
6. **61h 정의와의 충돌**(§12-4)

**판정.** 하나가 확실히 나으면 나머지 `enabled:false`. 안 갈리면 복제해 변형. ⚠ 작은 표본으로 판본을 가리지 말 것.

---

## 11. 하지 말 것

- `/api/verify`·`lib/verify/*`·`batchVerify`·`BatchVerifyDialog`·`verification` 무접촉 · 검증 칩 삭제 금지 · lib 추출 금지.
- `invokedIds` 합집합 금지 · 답글 분기 통과 금지 · 문답에 히스토리 금지 · 타이핑 히스토리 끄기 금지.
- **`handleSave`를 try/catch로 "잡았다"고 여기지 말 것**(throw 안 함) · **`savingRef` 무시 금지** · **가드 안에서 클로저 `dirty`·`handleSave`를 읽지 말 것**(ref 4종만 — Y2).
- 전송을 catch 없이 두지 말 것(D21) · 트리거 낱말 금지(D20) · `order` 없는 문서 금지 · 꼬리를 코드가 붙이지 말 것.
- 팝오버 `position:relative` 금지 · `width:250` 금지 · 네이티브 다이얼로그 금지 · `PH.listChecks` 금지.
- 기존 Claude 문서 수정 금지 · `maxTokens` 21,333 이상 금지 · 실험 중 `appendPrompt` 변경 금지.
- `seed.ts` import 금지 · `askQuestions.ts`를 `lib/ask/`에 두지 말 것 · 새 색은 토큰.
- CLAUDE.md 작업 규칙: 수정 전 읽기 · 커밋까지 · roadmap · 확정본만 `phasedocs/`.

---

## 12. 구상 노트

### 12-1. 66b — 폴더뷰 순차 실행
[일괄 검증] → 모드 팝오버(교차 / 문답) · 61d 코드 0 · 기억 안 함 · 선택 바 무변경 · 선택 화면(문항 표 + 항목 + 모델 + 예산) ·
기본 체크 전부 해제 · 문항 직렬 → 질문 직렬 → 모델 병렬 · 히스토리 없음(D15′ 갈래 재사용) · lib 추출은 여기서.
⚠ 시간 추정 = 문항 × 질문 × **턴 최대 4회**(X1). 1단계 §10-4·10-5가 입력값.

### 12-2. 66c — 정리
검증 칩 삭제(`VerifyChips`·`VERIFY_CHAR_CAP`·`runVerify`·`kind:'verify'` 갈래·`handleRetryAI` verify 분기 `:841-845`·prop 배선) · V7 접는 렌더 · 실험 종료 후.

### 12-3. 질문 목록의 장래
문제 질문 4종·논리 2종은 후보 · `{answer_line}` 치환은 그때(`Problem.answer`는 컨텍스트에 없다) · 한 질문에 한 잣대 · 제미나이 4렌즈는 G2·G3에 흡수 ·
`preferredModelId`는 실측 후 · **서버 갈래 `mode:'ask'`** = ① 형식 규칙 교체 ② 트리거 접미·`forceCodeExecution` 끄기 ③ (선택) `enableCodeExecution` 끄기 — `aiProviderParams` 스냅샷 계약 먼저.

### 12-4. 두 축의 충돌
61h = "지워도 되는 것" · G3 = "짧게 쓸 수 있는 것". 문답형이 후자에서 유용하면 공존(문답 = 편집용 / 61h = 검증용)인지 결정. 61h 수정은 M1 방침에 걸린다.

---

## 13. 구현 기록 (2026-09-15)

### 13-1. 커밋

| 커밋 | 내용 |
|---|---|
| `4a3588f` S1 | `lib/ask/seed.ts`(씨앗 3 · 트리거 정규식 이중 · 순수 함수 4) · `test:ask` 7 · 규칙 블록 · 규칙 테스트 64·65 |
| `1bb67f4` S2 | ICONS `listDashes` · `IconQuestionList` · 60 → **61종** |
| `b927ff3` S3 | `lib/askQuestions.ts` · `AskListPopover` · CommentPanel 배선(대체 override · D15′ · D17) · 61b 라벨 '교차 검증' |
| `ae55a97` S4 | `ensureSavedForAI` — 61b 검증 칩과 공유(Q5), 잠복 버그 동반 수정 |
| `115b6e1` S5 | 확정본 등록 · CLAUDE.md 규약 5절 · roadmap |
| `7a50cdd` 후속 1 | 문답 전송을 문제 + `solution` 탭만으로(R2 — 후속 2가 대체) |
| `5aeae5f` 후속 2 | 추가 탭을 "참고 자료" 표시로 되살림 · 범위 안내(R3) |

**검증**: `test:ask` 7 · 로직 하니스 18종 합계 **446** · `test:rules` **67블록** · `tsc --noEmit` 통과.
⚠ **`npm run build`는 로컬에서 돌리지 않았다** — 작업 내내 dev 서버가 떠 있었다(CLAUDE.md 규칙 5).
push 후 Vercel 빌드 로그에서 `[icons:check] OK — 61종`을 확인할 것.

### 13-2. 계획 대비 이탈

| # | 계획 | 실제 | 이유 |
|---|---|---|---|
| **R1** | §7 "`ensureSavedForAI`는 `dirtyRef`(`:3226`) 뒤에 정의" | `dirtyRef`·`handleSaveRef` **선언을** `switchTab` 뒤로 올리고 그 아래에 정의 | 두 ref가 30분 자동 저장 블록에 있어 `handleRunVerify`(`:3106`)보다 **뒤**였다. 뒤에 정의하면 `handleRunVerify`의 deps 배열이 초기화 전 변수를 읽어 **렌더 시점에 TDZ로 터진다**. 계획서의 위치 지정만으로는 Q5(칩과 공유)가 성립하지 않았다. 옛 자리에는 포인터 주석 |
| **R2** | 문답 컨텍스트 = `buildContext` 그대로(문제 + 모든 탭) | 문제 + `solution` 탭만(`7a50cdd`) | 덕수 요청 — 'AI 풀이' 탭이 섞이면 모델이 AI 풀이의 군더더기를 지적한다. **R3가 대체** |
| **R3** | (계획에 없음) | 추가 탭(`extra_N`)은 **참고 자료**로 함께 보내고 절 제목에 `— 검증 대상`/`— 참고 자료 (검증 대상 아님)` 표시, 맨 앞에 `ASK_SCOPE_NOTE`(`5aeae5f`) | 덕수 요청 — "AI 풀이는 참고만, 지적은 문제·풀이만". 서버 `buildUserPrompt`가 탭 내용을 전부 "## 현재 풀이" 한 제목 아래 붙이므로 표시 없이 보내면 AI 풀이까지 검증 대상으로 읽힌다. **풀이 탭을 맨 앞에** 둔다(15,000자 자르기가 뒤에서 잘라 참고 자료가 먼저 잘린다 · 그림 슬롯도 같은 순서). 안내는 질문 문안이 아니라 컨텍스트에 둔다(세 질문에 같은 통제 조건). 탭은 id로 가른다. 타이핑 대화 무변경 |
| **R4** | D7 "저장 시 `rev`+1" | 사용 여부 토글(`setAskQuestionEnabled`)은 `rev`를 **올리지 않는다** | 문안이 그대로면 실험 판본도 같다 |

### 13-3. 첫 실험에서 나온 것

| # | 증상 | 원인 | 조치 |
|---|---|---|---|
| **E1** | 답 본문이 **0자**이고 *"…응답이 토큰 한도(maxTokens)로 잘렸습니다."*만 남음 | 실험 문서의 `maxTokens`를 콘솔에서 **string**으로 저장 → `mapDoc`의 `typeof === 'number'` 검사가 무시하고 **1024**로 떨어짐. 청구액 $0.07483이 1024 산식(출력 약 $0.026 + 입력 약 1만 토큰 $0.05)과 맞아 짚었다 | 덕수가 int64로 수정. ⚠ **§9 준비물 표에 "유형" 칸이 없었다** — 숫자 4종(`maxTokens`·`order`·단가 2)은 number, `enabled`는 boolean이어야 한다. 틀려도 오류 없이 기본값으로 떨어진다 |
| **E2** | (E1의 "본문 0자"라는 모양) | Opus 5는 **사고가 기본으로 켜져** 있고 사고 토큰도 `max_tokens`에서 깎인다. `ClaudeProvider`의 텍스트 추출은 `text` 블록만 모으므로 사고 중 한도에 닿으면 본문이 **빈 채로** 끝난다 | §3-5의 "잘림은 마커로 보인다"는 맞지만 실제 증상은 **"마커만 보인다"**다. 한도가 여유 있어야 한다 — 문제 검증 질문(66b)은 16000 권장 |
| **E3** | 대화 기록의 질문 끝이 *"수식은 …로 감싸"*로 보임 | 사람 메시지도 `EditorPreview`로 렌더돼 `$...$`가 수식(점 세 개)으로 그려진다. **후속 턴에 권했던 백틱도 실패** — 인라인 `\displaystyle` 주입(`EditorPreview.tsx:228-233`)이 코드**펜스**만 보호하고 인라인 코드는 보호하지 않아 `` `$\displaystyle ...$` ``가 보인다(렌더러 정규식 + 실제 remark-math로 실행 확인) | **AI가 받는 원문은 처음부터 멀쩡했다**(전송은 전처리 전). 안전 문안 = `수식은 달러 기호($) 한 쌍으로 감싸.`(본문 전체에 `$`가 하나일 때). 씨앗 반영은 66b 계획 D5, 덕수의 기존 G1~G3 문서는 앱에서 직접 수정 |

### 13-4. 남은 일

- 실험 §10 재개(E1 수정 후) · 실물 검수 11항(§8)을 실험과 함께
- **66b 구현 완료(2026-09-15)** — `docs/phasedocs/Phase66b 문답 검증 질문 카테고리·문제 검증 질문 v3 착수판.md`
  (질문 카테고리 [문제]·[풀이] · 문제 검증 질문 P1~P4 · 씨앗 보충). ⚠ **이름 확정(66b Q8)**: 이 문서 §12의
  "66b = 폴더뷰 순차 실행 · 66c = 칩 정리"는 각각 **66c · 66d**로 밀렸다
- 작업물 정리(2026-09-15): 부록 A 계보의 66a v1~v6 판본은 phaseSketch에서 삭제했다 — 이 확정본이 유일한 사양이다.
  중간 판본은 git `115b6e1`에서 복구 가능

---

## 부록 A. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| 66a v1 | web | 1단계 축소 |
| v2 | CLI | E1~E10 · G1~G8 |
| v3 | web | C1~C9 · V1~V10 · D15′ |
| v4 | CLI | W1~W12 · D19 |
| v5 | web | X1~X11 · D20·D21 · D12′ |
| **v6 착수판** | **CLI (2026-09-14)** | **X 전수 확인 · 역정정 1(X3) · Y1~Y7 · D12″·D22 · Q1~Q6** |

## 부록 B. v5 판정

| X | 판정 |
|---|---|
| X1 도구 턴 최대 4회 | ✓ `ai-provider.ts:556`(true) · `:592`(false) · 루프 `:430-452` · `providerParams.ts:34, 63-67`. 같은 `maxTokens`가 매 턴 |
| **X2 G2 "검산" 트리거** | ✓ **실행 검증** — 원문 `code: true`, 수정문 `false`(부록 C) |
| **X3 잘림 신호는 출력 토큰뿐** | **✗ 역정정** — 그래프 안내(`route.ts:342`)가 Claude 경로에 없는 것은 맞으나, **provider가 두 마커를 본문에 직접 붙인다**(`ai-provider.ts:508-513`). → Y1 |
| X4 `handleSave` throw 안 함 | ✓ catch `:3081-3084`(v5의 3086-3090은 finally까지 포함한 범위) |
| X5 `savingRef` 즉시 반환 | ✓ `:2944` · 초기 `lastSaveOkRef = true` `:2941` · 탭 전환 `:3094`(v5 :3092) |
| X6 deps | ✓ `:3137`(v5 :3136) — **그러나 Y2로 원천 소멸** |
| X7 `handleSubmit` catch 없음 | ✓ `CommentEditor.tsx:140-144` |
| X8 `images` 키 조건부 | ✓ `:756-763` |
| X9 서버 빈 히스토리 | ✓ `:452` · `:408-415` · **+ 시스템 규칙 10 `:110`**(Y5) |
| X10 규칙 블록 65 · 번호 63 | ✓ `26a·26b·27a·27b` |
| X11 `invokedModelIds` | ✓ `:731` |

## 부록 C. 씨앗 실행 검증 (node, 라우트 정규식 그대로)
```
G1     code: false  graph: false
G2     code: false  graph: false     ← 수정문
G2old  code: true   graph: false     ← "확인하는 검산"
G3     code: false  graph: false
```

## 부록 D. v6 신규 (Y1~Y7)

| # | 내용 |
|---|---|
| **Y1** | **X3 역정정.** `ClaudeProvider.complete`가 `stop_reason === 'max_tokens'`면 *"…응답이 토큰 한도(maxTokens)로 잘렸습니다."*, 턴 상한이면 *"…도구 호출이 상한에 도달해 응답이 미완성입니다."*를 `content`에 붙인다(`ai-provider.ts:508-513`). Firestore에 저장되고 말풍선에 보인다. §10-2를 마커 기준으로 다시 썼다. discuss가 `result.truncated`를 안 읽는 것(`verify/route.ts:482, 495`만 읽는다)은 사실이지만 **마커가 있어 무관** |
| **Y2** | **저장 가드는 ref 4종만으로.** `dirtyRef`(`:3226-3227`)·`handleSaveRef`(`:3218-3219`)가 30분 자동 저장을 위해 **이미 있다**. 가드가 진행 중 저장을 기다린 뒤에는 클로저 `dirty`가 **반드시** stale이다(그 사이 입력) — deps를 채워도 못 막는다. `dirtyRef.current`를 대기 뒤에 읽으면 deps `[]`로 X6이 사라진다. 골격 §7 |
| **Y3** | **code_execution 도구는 트리거와 무관하게 늘 붙는다** — `enableCodeExecution: true`가 `params.tools`를 싣고(`providerParams.ts:63-65`), 트리거는 `tool_choice:'any'`만 좌우(`:66-67`). D20은 *강제*를 막을 뿐이고 G1·G3에서도 모델이 자발적으로 코드를 돌릴 수 있다. 그때는 답에 `<details>` 검산 코드(`:506`)가 붙어 사후 관측된다 → D22 |
| **Y4** | **Q5 — 61b 검증 칩의 잠복 버그를 같은 콜백으로 닫는다.** v5 X5가 지적한 "자동 저장 중이면 가드 통과"는 `handleRunVerify`에 이미 있다. `ensureSavedForAI`를 두 호출부가 쓰면 함께 닫히고, 그러면 "61b 코드 0"이 아니라 "61b 서버 0 · 클라 가드 1곳 공유"다 — 요약 문구를 그렇게 고쳤다 |
| **Y5** | **D15′의 모델 층** — 시스템 규칙 10(`route.ts:110`) "히스토리가 비어있으면 첫 발언으로 간주하고 처음부터 답하세요"가 빈 배열을 정상 상태로 읽는다. 클라·서버·모델 세 층이 일치 |
| **Y6** | **폴링 상한** — 저장은 전 탭 delete-all → re-add(`handleSave` 본문)라 수 초가 걸릴 수 있다. 상한 없이 기다리면 저장이 영원히 안 끝날 때(네트워크) 전송도 영원히 걸린다 → 15초 후 throw(Q1-A) |
| **Y7** | 행 미세 정정 3 — X4 catch `:3081-3084` · X5 탭 전환 `:3094` · X6 deps `:3137`. 실행에 영향 없음 |

---

*v6 착수판 — Q1~Q6 전항 권장안 확정 · S1~S5 + 후속 2 구현 완료(2026-09-15, §13). 서버·프롬프트·61d/61h 코드 0 · 61b 클라 가드 1곳 공유(Q5).*
