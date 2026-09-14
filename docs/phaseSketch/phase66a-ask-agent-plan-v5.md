# Phase 66a — 문답 검증 1단계: agent 탭 질문 리스트 구현 계획서 v5 (web 재검증 · 착수판)

작성일: 2026-09-14 · 작성: **web 재검증** · 기준 커밋: **mathory `origin/main 9061cf9`**
계보: 66 v1 → 브레인스토밍 → 66a v1(web) → v2(CLI) → v3(web) → v4(CLI) → **v5 = web 재검증 착수판**
(부록 D가 v4 판정 — 수용 9 · **정정 2(X2·X3)** · **신규 11(X1~X11)**)
착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

> **v5가 바꾸는 것은 셋이다.**
> ① **W1의 결론이 뒤집힌다** — 문답은 브라우저→서버 1요청이지만 **서버→Anthropic은 최대 4회**다
>    (`getProviderForModel`이 Claude를 `enableCodeExecution: true`로 만들고 `DEFAULT_MAX_TOOL_TURNS = 3`).
>    "1요청이라 안전"은 성립하지 않는다(X1).
> ② **씨앗 G2가 실험을 무효화한다** — 본문의 낱말 **"검산"**이 `CODE_EXEC_TRIGGER_RE`에 걸려
>    사용자 메시지에 "반드시 SymPy를 실행하라, 아니면 무효"가 강제 부착되고 `tool_choice:{type:'any'}`가 붙는다.
>    G2가 **묻는 것**(검산이 군더더기인가)이 모델에게는 **요청**(검산해 달라)으로 도착한다(X2).
> ③ **저장 실패 경로에 v4가 못 본 구멍이 둘 더 있다** — `handleSave`는 throw하지 않고(X4),
>    자동 저장이 진행 중이면 **조용히 즉시 반환**해 가드가 통과한다(X5).

---

## 0. 요약

agent 대화창 입력 상단에 **질문 리스트 버튼**을 달고, 거기서 고른 검증 질문을 선택한 AI에게 보낸다.
질문 문안은 `users/{uid}/ask_questions`에 살며 **앱 안에서 추가·수정·복제·삭제**한다.

**이번 판의 목적은 기능 완성이 아니라 실험이다.** 그래서 질문 3개를 씨앗으로 넣고,
문안을 고치는 왕복이 배포 없이 도는 구조를 먼저 만든다.

**서버 0 · 프롬프트(`lib/verify/prompts.ts`) 0 · 61b/61d/61h 코드 0 · 문항 스키마 0 · 렌더 5사이트 0 · 폰 0.**
Firestore 규칙 1블록 · 신규 3파일 · 기존 7파일 수정 · **ICONS 60 → 61종** ·
**로직 검증 439 → 446건**(`test:ask` 7 — X2가 T7을 더한다) · **규칙 테스트 블록 65 → 67**(번호 64·65, X10).

**핵심 설계 넷**
- **D15′ 히스토리 미첨부** — 문답 전송만 `discussionHistory: []`. 한 세션에 질문 셋을 나란히 쌓으면서도
  앞 답이 뒤 질문을 오염시키지 않는다. 서버가 빈 배열을 정상 처리하는 것까지 확인했다(X9).
- **D14 실험 전용 모델 문서** — 800자·"단계 나열 금지"는 **시스템 프롬프트**에 있어 질문 본문으로는 못 이긴다.
  콘솔 문서 하나를 더 만들어 `appendPrompt`로 덮는다. 코드 0.
- **D20 트리거 낱말 회피(신설)** — 질문 본문은 `/api/discuss`의 두 정규식(`CODE_EXEC_TRIGGER_RE`·`GRAPH_TRIGGER_RE`)을
  건드리면 안 된다. 씨앗을 고치고 `validateQuestion`이 경고한다(X2).
- **D12′ 저장 가드(보강)** — `lastSaveOkRef` 판독 + **`savingRef` 침묵 대기** + deps 고정(X4·X5·X6).

---

## 1. 범위 — 무엇을 **안** 하는가

| 항목 | 66 v1 | 66a | 이유 |
|---|---|---|---|
| [문제 검증]·[풀이 검증] 칩 | 삭제 | **남긴다** | 지금 그 칩이 **대조군**이다. 삭제는 실험이 끝난 뒤(66c) |
| `buildContext`·`invokeOneAI` lib 추출 | S2(최대 위험) | **안 한다** | 폴더뷰 배치가 CommentPanel 밖에서 같은 조립을 써야 할 때 필요해진다(66b) |
| 폴더뷰 순차 실행 | 포함 | **안 한다** | 시간·비용·중단 정책이 전부 추정치다. 1단계 실측 후 설계 |
| 문제 검증 4종·논리 2종 | 목록에 포함 | **안 넣는다** | 추측이다. 씨앗은 군더더기 3개뿐 |
| 결과 요약 팝업·`verification` 배지 | 포함 | **안 한다** | 대화 기록이 곧 실험 로그 |
| 컨텍스트 길이 사전 경고 | — | **안 한다**(G6) | 검증 칩의 `verifyCharCount`는 검증 셈법이라 어긋난다. dev 콘솔로 본다 |
| 폰 대응 | — | **필요 없다**(V5) | `PhoneApp.tsx:392`가 `panelSlot('agent', false)` → `canComment=false` → 컴포저(`CommentPanel:1099`) 자체가 없다 |
| **서버 트리거 우회** | — | **안 한다**(X2) | `mode:'ask'` 필드로 접미 부착을 끄는 것은 서버 변경이다 → 66b 이후. 1단계는 **문안 회피**로 푼다 |

---

## 2. 확정 사실 (origin/main `9061cf9` — v4 인용 전수 재확인 + 신규 실측)

### 2-1. 전송 경로

`handleSendMessage`(`CommentPanel.tsx:680-787`):

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
| 바디 조립 | `:749-764` | `discussionHistory: history` · `images.history: historySlots`(`:760`) |
| 병렬 호출 | `:784-786` | `Promise.allSettled(invokedModels.map(invokeOneAI))` |

`CommentEditor.onSubmit` 타입은 `(content: string) => Promise<void>`(`CommentEditor.tsx:26`)이라
**두 번째 매개변수를 옵셔널로 더해도 계약이 깨지지 않는다.**

⚠ 함정 셋: 답글 분기(`:689`)가 AI를 삼킨다(D17) · override는 **대체**여야 한다(E3) ·
`buildHistory()`가 무조건 돈다(`:739` → D15′).

**D15′의 서버 쪽 귀결까지 확인했다(X9).** `validate()`는 `Array.isArray(discussionHistory)`만 보므로 `[]`가 통과하고
(`route.ts:452`), `buildUserPrompt`는 `if (body.discussionHistory.length)`라 **빈 배열이면 "## 토론 히스토리" 절 자체를
넣지 않는다**(`:408-415`). 빈 머리말이 남지 않는다. 클라 쪽 귀결도 그대로다 — `historySlots=[]`이면
`:747`의 `some(...)`이 false라 `hasAnyFig` 계산이 자연히 맞고 `:760`의 `images.history`가 `[]`가 된다.

⚠ `runVerify`(`:807-836`)는 `setSelectedModelIds([])`(`:822`)를 하지만 **문답은 칩 선택을 건드리지 않는다**(G7).

### 2-2. 사용자별 편집 가능 컬렉션의 전례 — `math_snippets`

- 규칙 **`firestore.rules:30-32`**(v3 역정정이 옳다): `match` 30 · `allow` 31 · `}` 32. `toolbar_config`는 `:35-37`.
- CRUD(`lib/snippets.ts:16-64`): `listSnippets`(orderBy) · `createSnippet`(addDoc + `serverTimestamp()`) ·
  `updateSnippet` · `deleteSnippet`. 타입은 `types/snippet.ts`(`created_at`/`updated_at`을 `Date`로 변환).

⚠ **`orderBy`는 그 필드가 없는 문서를 제외한다**(V6) — `order` 없는 문서는 목록에서 조용히 사라진다.
⚠ 스니펫 관리 UI는 저장소에 **없다** — 편집 모달은 `dialogStyles` 규격으로 새로 만든다.

### 2-3. 상단 바

`headerLeft`(`:1156-1180`) = `flex; flexWrap: wrap; gap 6` 안에 `AIChipBar`(전폭 div, `:1384` · `models={aiModels}` `:1161`)
+ `VerifyChips`(`:1439`).
- ⚠ fragment로 나란히 두면 밀린다(`:1157-1158`) · 칩 래퍼에 `position:relative` 금지(`:1458-1460`).
- **기준 상자 = 컴포저 래퍼 `:1100-1104`**(`padding:'10px 16px 12px'` · `position:'relative'`).
  `CommentEditor` 루트(`:213-216`)·headerLeft 래퍼(`:219-223`)는 positioned가 아니다.
  ⚠ 패널 420에서 래퍼 내부 폭 388 → **`width:250` 리터럴 금지, `left:0; right:0`**(E10).
- ⚠ 컴포저 전체가 `canComment ? … : …`(`:1099`) 안 → 폰은 상단 바 자체가 없다(V5).

게이트 재료: `ownerUid`(`:67`) · `currentUid`(`:70`) · `isAISession`(`:359`) · `activeSessionId`.

### 2-4. 아이콘

`PH.listChecks`는 **`ProofreadIcon`(교정)**이 쓴다(`gen-phosphor-paths.mjs:78` 주석 · `UnifiedToolbar.tsx:83`) —
EditorView에서 Row 2 툴바와 agent 드로어가 동시에 보이므로 재사용 금지(E1).
→ `listDashes: ['list-dashes', 'regular'],` 1키. **존재 확인**: `lib/phosphor-ko.json`(1,414종)에 `"list-dashes"` 실재(C9).
`icons:gen` 후 빌드 로그 **`[icons:check] OK — 61종`**. `Icons.tsx`에 `export const IconQuestionList = phIcon(PH.listDashes, 16);`(팩토리 `:38-43`).

### 2-5. ⚠ 시간 예산 — **1요청이 아니다** (X1, W1 정정)

| 사실 | 근거 |
|---|---|
| 라우트 예산 300초 · 내부 타임아웃 **280초** | `maxDuration = 300`(`route.ts:19`) · `TIMEOUT_MS = 280_000`(`:58`) · `withTimeout(provider.complete(...), TIMEOUT_MS)`(`:570-579`) |
| 타임아웃 메시지 | `'AI 응답 시간 초과 (약 4.5분)'` → 500으로 나간다(catch `:600` · 반환 `:603-606`) |
| **discuss의 Claude는 code execution 도구가 항상 붙는다** | `getProviderForModel`: `new ClaudeProvider(apiKey, config.apiModelName, **true**)`(`ai-provider.ts:556`). 검증 판정자는 `false`(`:592`)라 **비대칭**이다 |
| 도구가 붙으면 `params.tools`가 실린다 | `buildClaudeParams`: `const codeExec = opts?.enableCodeExecution ?? args.enableCodeExecution; if (codeExec) params.tools = [CLAUDE_CODE_EXEC_TOOL];`(`providerParams.ts`) |
| **한 요청 안에서 Anthropic 호출이 최대 4회** | `stop_reason === 'pause_turn'`이면 assistant 턴을 이어 붙여 재요청(`ai-provider.ts:422, 449-452`), 상한 `DEFAULT_MAX_TOOL_TURNS = 3`(`providerParams.ts:34`) → turn 0·1·2·3 |
| 각 호출이 `max_tokens`까지 뽑는다 | `params.max_tokens = maxTokens` — 8192로 올리면 최악 4 × 8192 = **32,768 출력 토큰**이 280초 안에 |
| 참고 실측(61b) | Claude 단건 판정 **38~52초**, 군더더기 판정 **184초 이상치**(CLAUDE.md 61h 절). 8192는 32k보다 작지만 **턴이 곱해지면 280초가 여유롭지 않다** |

**결론.** `maxTokens 8192` 자체는 SDK 가드(21,333)에도, 단일 호출 시간에도 걸리지 않는다.
**위험은 토큰이 아니라 턴이다** — 도구 호출이 시작되면 시간이 배수로 는다. 그래서 D20(트리거 회피)이
성능 문제가 아니라 **실험 성립 조건**이다. 닿으면 500이고 사람 메시지는 이미 저장돼 있어 [재시도]로 복구된다.

### 2-6. ⚠ 사용자 메시지가 서버에서 **가로채인다** (X2 — 이번 판 최대 발견)

`route.ts:520-531`:
```
const codeExecForced = codeExecution && CODE_EXEC_TRIGGER_RE.test(body.currentMessage);
const graphForced   = graphEnabled  && GRAPH_TRIGGER_RE.test(body.currentMessage);
let currentMessage = body.currentMessage;
if (codeExecForced) currentMessage += USER_MESSAGE_CODEEXEC_SUFFIX;
if (graphForced)    currentMessage += USER_MESSAGE_GRAPH_SUFFIX;
```
- `CODE_EXEC_TRIGGER_RE = /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i` (`:256`)
- `codeExecution = isCodeExecutionModel(config)` → **anthropic 포함**(`:378-380` 계열)
- 부착되는 문장(`:259-263`): *"이 메시지는 명시적인 검산 요청입니다. 추론만으로 답하지 말고 반드시
  Python(SymPy) 코드를 **실제로 실행**해 결과를 확인한 뒤 결론을 내세요. 코드 실행 없이 답하면
  **응답이 무효 처리됩니다**."*
- 그리고 `forceCodeExecution: codeExecForced && provider==='anthropic'`(`:571`) →
  `buildClaudeParams`가 **`params.tool_choice = { type: 'any' }`** → 도구 호출이 **강제**된다.

**씨앗 G2 본문에 "검산"이 들어 있다.** 그러면 이렇게 된다:
G2가 묻는 것은 *"동치 변형 뒤의 검산이 군더더기인가"*인데, 모델에게 도착하는 것은
*"검산해 달라, 코드 없이 답하면 무효"*다. 여기에 강제 도구 호출이 얹혀 pause_turn 루프까지 돈다.
→ **측정 대상이 문안의 질이 아니라 서버 접미사의 압력이 된다.** 시간·비용도 함께 배로 뛴다.

⚠ `GRAPH_TRIGGER_RE`(`:266-267`)는 씨앗 셋 모두 걸리지 않지만(그래프 명사 + 그리기 동사 결합형),
앞으로 추가할 질문이 "그래프를 그려 설명해줘"류면 같은 일이 벌어진다.

### 2-7. 알고 쓰는 제약

| 제약 | 근거 | 대응 |
|---|---|---|
| 답변 규칙 = 800자(`:98`) + **단계 나열 금지**(`:101`) + **장황하면 무효**(`:88`) | `BASE_SYSTEM_PROMPT` | 질문 본문으로는 못 이긴다 → `appendPrompt`(D14) |
| `ai_models.maxTokens` 기본 **1024** | `ai-models.ts:24` · `route.ts:571` | D14에서 8192(⚠ 21,333 미만 — V4 · 그러나 위험은 턴이다 — X1) |
| `getEnabledModels`는 **모듈 캐시** | `ai-models.ts:13-14, 50-58` | 콘솔 수정 후 **새로고침** 필요(E6) |
| `appendPrompt`는 시스템 프롬프트 뒤쪽 | `:241-243` | ⚠ 맨 뒤는 아니다 — `STRUCTURED_OUTPUT_INSTRUCTION`(`:245`)이 뒤에 오나 **DeepSeek 전용**이라 Claude에선 실질 맨 뒤(C3) |
| `/api/discuss` 무인증 · 오류 500 일괄 | catch `:600` · 반환 `:603-606` | 1단계는 단건 수동 실행 |
| 컨텍스트 15,000자 자름 | `CommentPanel:553, 568-573`(`console.warn`만) | dev 콘솔(G6) |
| 히스토리 최근 5개 | `HISTORY_LIMIT`(`:33`) · `:600` · `:739` | **D15′** |
| 리포트 라벨 '정밀 검증' | `:405` | **61b UI만 '교차 검증'**(D1′). ⚠ 렌더 시 결정이라 **옛 리포트 표시도 함께 바뀐다**(W11 — 데이터 무접촉, 의도) |
| AI 댓글 create는 오너만 | `firestore.rules:262-268` — `authorType=='ai'` ∧ `^ai:.*` ∧ **`resolved == false`** ∧ `isOwnerCmt()` | `addComment`가 항상 `resolved:false`(`comments.ts:101`) → 작업 0 |
| **잘림 신호는 출력 토큰 하나뿐**(X3) | 비용 배지 `title`에 입력·출력 토큰(`:1938`) · 응답 `DiscussSuccess`에 `stop_reason` 없음 | §9-2. ⚠ v4가 든 `:342` 잘림 안내는 **`sanitizeGraphFences` 안의 그래프 명세 전용**이고 `if (graphEnabled)`(`:584`)인데 `isGraphModel`은 **google·openai뿐**(`:385-387`) → **Claude 경로에선 아예 안 돈다** |
| 질문 본문은 `currentMessage` 별도 필드 | `invokeOneAI` `:632` | `CONTEXT_CHAR_CAP`을 잡아먹지 않는다(G4) |
| `CommentEditor.maxLength 1000`은 문답에 안 걸린다 | `:51, 236` — textarea 전용 | 유일 상한은 `validateQuestion`의 8000자(V8) |
| 재시도가 공짜 | `handleRetryAI` `:838-858` · `retryContext` `:669` · 재사용 `:857` | **재시도가 D15′를 보존한다**(W8 ✓ 확인) |

---

## 3. 결정표 (v5)

| # | 결정 | 근거 |
|---|---|---|
| **D1′** | 새 기능 = **'문답 검증'** · 61b UI 라벨만 `'정밀 검증'` → **`'교차 검증'`**(`:405`) | '정밀 검증'은 문서 전반에서 61b/61d/61h를 가리킨다 |
| **D2** | 저장 = `users/{uid}/ask_questions` | 2-2 |
| **D3** | 스키마 `{ label, target, text, order, enabled, rev, created_at, updated_at }` | `order` 필수(V6) |
| **D4** | 컬렉션이 비면 **씨앗 3개 자동 생성** — 트리거는 **팝오버 첫 열기** + **uid별 in-flight Map**(W9) | 마운트 훅이면 문항마다 읽기가 돈다 |
| **D5** | 편집 UI는 팝오버 안에 — ⋮ → 수정·복제·삭제, 하단 [+ 새 질문] | 고치고 싶어지는 순간이 그 화면이다 |
| **D6** | **복제가 1급 기능** | 원본을 덮어쓰면 비교 대상이 사라진다 |
| **D7** | 저장 시 `rev`+1 · 전송 첫 줄 `[문답 검증 · {label} r{rev}]` | 대화 기록 = 실험 로그 |
| **D8** | 모델 기본 = `localStorage` → 없으면 `provider==='anthropic'` 중 **`order` 최소** | D14 문서의 `order`를 기존 Claude보다 **작게**(W6) |
| **D9** | `localStorage['mathory.ask.v1'] = { modelIds }`, try/catch | 질문은 매번 고른다(그게 목적) |
| **D10** | 버튼 = `headerLeft` 기존 flex 컨테이너 맨 앞, `[≡ 질문]` | 두 줄로 밀리면 아이콘 단독 |
| **D11** | 치환 없음 | 씨앗이 전부 풀이 대상. 치환은 66b |
| **D12′** | **저장 가드 3중**(X4·X5·X6): ① `await handleSave(true)` 뒤 **`lastSaveOkRef.current` 판독**(handleSave는 throw하지 않는다) ② 진입 시 `savingRef.current`가 true면 **가라앉을 때까지 대기 후** 재판정 ③ `useCallback` deps에 **`dirty`·`handleSave` 필수**. 실패 시 `throw` → 팝오버가 `alertDialog` 후 중단 | 저장 실패·미저장이 조용히 통과하면 **옛 저장본이 검증된다** |
| **D13** | ICONS `listDashes` 1키(60 → **61종**) | 2-4 |
| **D14** | 실험 전용 `ai_models` 문서 1개 — 콘솔, 코드 0. 필드 체크리스트 §8 | 2-7 |
| **D15′** | 문답 전송은 **히스토리 미첨부** — `discussionHistory: []` · `images.history: []` | 오염 차단 + 한 세션에 나란히. 서버 처리 확인(X9) |
| **D16** | [보내기] 활성 = 해석된 모델 ≥ 1 ∧ `activeSessionId` ∧ **busy 아님** — busy = `pendingAI.some(p => p.sessionId === activeSessionId && !p.error)`(W4) | 해석 실패 시 사람 메시지만 저장되고 AI 0회(E4) · 연타 방지 |
| **D17** | 전송 직전 `setReplyingTo(null)` | 답글 모드면 조용히 답글로 저장되고 끝난다(`:689`) |
| **D18** | `order` = 최대 + 10 · 복제는 원본 + 1 | 수동 번호 관리 없음 |
| **D19** | **`appendPrompt`는 통제 변수 — 실험 중 고정** | 문안과 함께 움직이면 무엇이 작동했는지 못 가른다(W12) |
| **D20** | **질문 본문은 `/api/discuss` 트리거 낱말을 피한다**(신설, X2) — 씨앗 G2에서 "검산" 제거 · `validateQuestion`이 트리거 낱말을 **경고**(차단 아님) · 편집 모달에 노란 줄로 표시 | 걸리면 사용자 메시지에 "SymPy로 실행하라, 아니면 무효"가 부착되고 `tool_choice:{type:'any'}`로 도구가 강제된다 — 측정 대상이 바뀌고 시간·비용이 배로 뛴다 |
| **D21** | **문답 전송 전체를 팝오버가 try/catch**한다(신설, X7) — `onBeforeSend`만이 아니라 `handleSendMessage`까지 | `CommentEditor.handleSubmit`은 `try/finally`만 있고 **catch가 없다**(`:140-144`) — 타이핑 경로는 `addComment` 실패가 조용히 사라진다(기존 잠복). 문답은 그 경로를 타지 않으므로 스스로 잡아야 한다 |

---

## 4. 데이터 모델

```
users/{uid}/ask_questions/{qid}
  label       string                  // 리스트 표시 · 메시지 첫 줄 라벨
  target      'problem' | 'solution'
  text        string                  // 질문 본문 (꼬리 포함 — 꼬리도 실험 변수)
  order       number                  // ⚠ 필수 — 없으면 orderBy에서 제외(V6)
  enabled     boolean
  rev         number                  // 저장할 때마다 +1
  created_at / updated_at   serverTimestamp
```

규칙 — `match /users/{userId}` 블록 안, `toolbar_config`(`:35-37`) 아래:
```
// 문답 검증 질문(Phase 66a): 본인만
match /ask_questions/{qid} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

⚠ **꼬리를 코드가 붙이지 않는다** — 출력 형식 지시야말로 "답이 잘리는가"를 가르는 실험 변수다.

### 씨앗 3개 (`lib/ask/seed.ts` · import 0)

공통 전제: **문제는 오류가 없고 정답이 하나로 정해지는 정상 문항, 풀이의 결론도 옳다.**
G2는 **"지워도 되는 것"**(61h 정의), G3는 **"더 짧게 쓸 수 있는 것"**(61h가 일부러 제외한 영역).
G1은 덕수가 실제로 쳐서 좋은 답을 받은 문장이라 **기준선**이다.

**G1 · 군더더기(원문)** `order 10`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.
그런 전제에서, 풀이에 군더더기가 있으면 사소한 거라도 빠짐없이 찾아서 알려줘.

각 지적마다 원문을 짧게 인용하고, 왜 군더더기인지와 수정 방향을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.
```

**G2 · 군더더기(삭제 검사)** `order 20` — ⚠ **v5에서 한 줄 수정**(D20 · X2)
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
> **바뀐 것은 넷째 항목 한 줄뿐이다**: ~~"…다시 대입해 확인하는 **검산**"~~ → "…다시 대입해 **맞는지 확인하는 절차**".
> 낱말 "검산"이 `CODE_EXEC_TRIGGER_RE`에 걸려 질문이 요청으로 둔갑한다(§2-6). 뜻은 그대로다.

**G3 · 군더더기(압축 재작성)** `order 30`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

이 풀이를 논리적 완결성은 그대로 둔 채 가장 짧게 다시 써 줘.
그리고 줄어든 부분이 각각 왜 없어도 되는지 항목으로 정리해 줘 — 안 쓰이는 계산이었는지,
알려진 정리로 한 줄에 갈 수 있었는지, 단순 이항·통분을 여러 줄로 늘린 것이었는지,
나누지 않아도 되는 경우를 나눈 것이었는지.

수식은 $...$로 감싸.
```

⚠ **G3는 시스템 프롬프트와 정면으로 부딪힌다**(E5): "단계 나열(1./2./3.… 번호로 풀이 재작성) 금지"(`route.ts:101`) ·
"장황한 사고 과정 서술은 **응답이 무효 처리되는 사유**"(`:88`). D14의 `appendPrompt` 없이 돌리면
측정 대상이 "문안의 질"이 아니라 "시스템 프롬프트의 저항"이 된다. 출력이 가장 길어 시간·비용도 셋 중 최대다.

### 트리거 낱말 (D20 · `lib/ask/seed.ts`가 함께 소유)

```ts
/** ⚠ app/api/discuss/route.ts:256·266-267의 **의도적 이중**이다.
 *  이 파일은 import 0이라 라우트를 못 읽는다 — 라우트를 고치면 여기도 함께 고칠 것.
 *  (전례: lib/listColumns.ts verifyRank ↔ VERIFY_VERDICT_META — CLAUDE.md Phase 63 절) */
export const DISCUSS_TRIGGER_RES = [
  { re: /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i, why: '코드 실행이 강제됩니다(SymPy 실행 요구 문구 부착)' },
  { re: /(그래프|좌표\s*평면|개형)\s*(을|를|으로|로)?\s*(좀\s*)?(그려|그리|보여|시각화)|도시해|plot\b/i, why: '그래프 펜스 출력이 강제됩니다' },
];
export function triggerWarnings(text: string): string[];   // 걸린 why 목록 (빈 배열 = 안전)
```
**차단이 아니라 경고다** — 앞으로 "진짜 검산을 시켜 보는" 질문을 만들 수도 있다. 다만 모르고 걸리는 것을 막는다.

---

## 5. UX

**버튼.** `headerLeft` 기존 flex 컨테이너 맨 앞 `[≡ 질문]`. 게이트 = `isAISession && currentUid === ownerUid`
(`firestore.rules:262-268`). 숨김 사유는 dev 콘솔(61b `[Phase61b] 검증 칩 숨김: …` 문법).

**`AskListPopover` prop 표면**(W3)
```
uid: string                      // ask_questions 경로 · ensureSeeded
models: AIModelConfig[]          // = aiModels (D16 해석 · 칩 렌더)
busy: boolean                    // = pendingAI.some(p => p.sessionId === activeSessionId && !p.error)
canSend: boolean                 // = !!activeSessionId
onSend: (message: string, modelIds: string[]) => Promise<void>   // CommentPanel이 D15′·D17을 담당
onBeforeSend?: () => Promise<void>   // D12′ — 실패 시 throw
```

**팝오버 1단 — 목록.** 컴포저 래퍼 기준 `position:absolute; bottom:calc(100% + 6px); left:0; right:0` ·
`maxHeight 320` + `overflowY:auto` · `zIndex 20`.
- 행 = `{label} r{rev}` + 본문 첫 줄 회색 미리보기 + ⋮ (⚠ 트리거 경고가 있으면 행에 작은 ⚠ 표식)
- 행 클릭 → 2단. ⋮ → 수정 · 복제 · 삭제(`confirmDialog({ danger:true })`) · 사용 여부 토글
- 하단 [+ 새 질문] · `enabled:false`는 맨 아래 흐리게
- ⚠ **로드 실패(규칙 미배포 등)는 빈 목록 + 안내 한 줄**(W9) — 크래시 금지

**팝오버 2단 — 전송.** 질문 라벨 · 모델 칩(기본 D8) · "이 전송은 이전 대화를 참조하지 않습니다"(D15′) ·
트리거 경고가 있으면 노란 줄(D20) · [취소] [보내기](D16).
누르면 **전체를 하나의 try/catch로 감싼다(D21)**:
1. `await onBeforeSend?.()` — **throw하면 `alertDialog(메시지)` 후 중단, 팝오버는 열어 둔다**(W2)
2. 팝오버 닫힘 → `setReplyingTo(null)`(D17)
3. `await handleSendMessage(전송문, { modelIds, noHistory: true })` — **여기서 throw해도 `alertDialog`**(D21)

사람 메시지가 대화에 뜨고 `PendingAIBubble`이 모델 수만큼(실패 시 [재시도]도 그대로 — G2·W8).
입력창의 미완성 텍스트는 건드리지 않는다.

**편집 모달.** `dialogStyles` 규격(`dialogOverlay`·`dialogBody`·`dialogHead`(57)·`dialogContent`·`dialogFoot`·
`dialogInput`·**`dialogBtn(...)`** — `export function`이라 `export const` 목록엔 안 보인다, `:79`).
라벨 · 대상 셀렉트 · 본문 textarea(12줄+) · 사용 여부 · **트리거 경고 줄**(D20) · [취소] [저장]. 저장 시 `rev+1`.
복제는 `label + ' 사본'` · `rev 1` · `order = 원본+1`(D18) 후 곧바로 편집 모달.
⚠ `Z_DIALOG 10500`이라 팝오버(20) 위 · `position:fixed` 안전(`SelectionInsertPopup.tsx:291` 전례, V9).

**전송문** = `[문답 검증 · {label} r{rev}]\n\n{text}` (D7).
⚠ 전문이 사람 메시지로 남는다(V7) — 실험 로그로는 이득이라 수용. 거슬리면 66c에서 접는 렌더.

---

## 6. 구현 항목

### 신규

| 파일 | 내용 |
|---|---|
| `lib/ask/seed.ts` (**import 0**) | `AskQuestion` 타입 · `SEED_QUESTIONS` · `ASK_LABEL_PREFIX = '문답 검증'` · `buildAskMessage(q)` · `nextRev` · `nextOrder` · `validateQuestion` · **`DISCUSS_TRIGGER_RES`·`triggerWarnings`**(D20) |
| `lib/askQuestions.ts` (firestore · ⚠ `lib/ask/`에 두지 말 것) | `listAskQuestions`(⚠ `order` 없는 문서는 빠진다 — dev 경고) · `createAskQuestion` · `updateAskQuestion`(rev+1) · `duplicateAskQuestion` · `deleteAskQuestion` · `ensureSeeded`(**uid별 in-flight Map**, W9) |
| `components/comment/AskListPopover.tsx` | 1단·2단·편집 모달 (prop 표면 §5) |

### 수정

| 파일 | 변경 |
|---|---|
| `components/comment/CommentPanel.tsx` | ① `handleSendMessage(content, opts?: { modelIds?: string[]; noHistory?: boolean })` — `:721`을 `isAISession ? [...(opts?.modelIds ?? selectedModelIds)] : []`(**대체**), `:739`를 `opts?.noHistory ? { history: [], slots: [] } : buildHistory()` ② `headerLeft` 맨 앞에 `<AskListPopover>` ③ `:405` `'정밀 검증'` → `'교차 검증'` ④ `onBeforeAskSend?: () => Promise<void>` prop ⑤ 전송 래퍼에서 `setReplyingTo(null)` |
| `components/editor/EditorView.tsx` | `handleRunVerify`(`:3106`)의 dirty 블록(`:3113-3116`)을 **`ensureSavedForAI`**로 뽑되 **D12′ 3중 가드**로 보강: `savingRef` 대기 → `if (dirty) { await handleSave(true); if (!lastSaveOkRef.current) throw … }`. deps는 `handleRunVerify`와 동일하게 **`dirty`·`handleSave` 포함**(현행 `:3136`). `handleRunVerify`도 이 콜백을 쓰게 바꾼다(동작 동일). **ProblemView는 안 넘긴다** |
| `components/ui/Icons.tsx` | `IconQuestionList = phIcon(PH.listDashes, 16)` |
| `scripts/gen-phosphor-paths.mjs` | `listDashes` 1키 → `npm run icons:gen` |
| `firestore.rules` + `tests/firestore.rules.test.mjs` | §4 블록 + **케이스 64·65**(현재 블록 65개, 번호 최대 63 — X10) |
| `package.json` | `test:ask`(⚠ **`--rootDir .` 필수**, E8) |
| `CLAUDE.md` · `docs/roadmap.md` | Phase 66a 절 · **로직 검증 439 → 446건** · **규칙 블록 65 → 67** |

### 커밋

| S | 범위 | 완료 기준 |
|---|---|---|
| S1 | `lib/ask/seed.ts` + `test:ask` + 규칙 + 규칙 테스트 | `npm run test:ask`(7) · `npm run test:rules`(67 블록) 통과 |
| S2 | `listDashes` + `IconQuestionList` | `npm run icons:check` → **`OK — 61종`** |
| S3 | `lib/askQuestions.ts` + `AskListPopover` + CommentPanel 배선 + D1′ 개명 | 씨앗 3개 자동 생성 · CRUD · 전송 · **요청 바디 `discussionHistory: []`** · 트리거 경고 표시 |
| S4 | `ensureSavedForAI`(EditorView) + D21 try/catch | dirty 전송 → 저장 후 전송 · 저장 실패 → 안내 후 중단 · **자동 저장 중 전송 → 대기 후 전송** |
| S5 | 문서 | — |

---

## 7. 테스트 — `tests/ask.test.mjs` (7건)

| # | 단언 |
|---|---|
| T1 | `SEED_QUESTIONS` 3개 · label 유일 · `target` 전부 `'solution'` · `order` 10/20/30 · `enabled` true · `rev` 1 |
| T2 | 셋 다 `오류가 없고` 포함 · G1·G2는 `빠짐없이` 포함 |
| T3 | `buildAskMessage` 첫 줄 === `[문답 검증 · {label} r{rev}]` · 본문 **무변경**(치환 0 — `$$`·`$&` 안전) |
| T4 | `nextRev(3)===4` · `nextRev(undefined)===1` |
| T5 | `validateQuestion`: 빈 label·빈 text 거부 · 8000자 초과 거부 · 정상 통과 |
| T6 | `nextOrder([])===10` · `nextOrder([{order:10},{order:30}])===40` |
| **T7** | **`triggerWarnings(q.text) === []` for 씨앗 3개 전부**(D20 회귀 — 문안을 고치다 "검산"을 되살리면 실패한다) · `triggerWarnings('검산해줘').length === 1` · `triggerWarnings('그래프를 그려줘').length === 1` |

규칙 테스트(에뮬레이터): **64.** 본인 uid read/write 허용 · **65.** 다른 uid 거부.

**실물 검수**
1. G1·G2·G3를 같은 고난도 문항에 각 1회(**같은 세션에 연달아**) — 네트워크 탭에서
   **`discussionHistory: []`** 확인. ⚠ `images.history`는 **부재가 아니라 빈 배열**이고,
   그림이 하나도 없으면 `images` 키 자체가 없다(X8)
2. 네트워크 탭 요청 바디의 `currentMessage`에 **`[필수] … 검산 요청입니다` 접미가 붙지 않는지**(D20·X2 회귀)
3. 편집 모달로 G2 복제 → 수정 → `rev` 증가 · 순서(원본 바로 아래) · 트리거 경고 줄 동작
4. **답글 화살표를 누른 상태**에서 전송 → AI 호출됨(D17)
5. 모델 칩 2개 켜 둔 상태에서 전송 → **D14 문서 하나만** 호출 · 칩 선택 유지(E3·G7)
6. **저장 실패**(X4) — 편집창에서 네트워크 끊고 dirty 전송 → 안내 후 중단
7. **자동 저장 중 전송**(X5) — 탭 전환(자동 저장 유발) 직후 곧바로 전송 → **대기 후 최신본으로** 전송되는지
8. **재시도**(W8) — 실패한 문답 [재시도] → 히스토리가 다시 붙지 않는지
9. 회귀: 타이핑 전송(히스토리 **정상 첨부**) · 검증 칩(라벨 '교차 검증') · 그림 첨부(61f)
10. 폰(기기 모드) agent 시트 — 질문 버튼 **없음**(V5)

---

## 8. 덕수 준비물

### 1. 실험 전용 `ai_models` 문서 1개 (콘솔, D14)

⚠ `mapDoc`(`lib/ai-models.ts:17-36`)이 읽는 필드 전부를 채운다. 빠지면 기본값으로 떨어지고 둘은 **조용한 고장**이다.

| 필드 | 값 | 빠지면 |
|---|---|---|
| `apiModelName` | 원본과 동일한 실제 API 모델명 | **문서 id가 모델명으로 쓰인다**(`?? id`) → 없는 모델로 호출돼 500 |
| `provider` | `'anthropic'` | 프로바이더 분기가 깨진다 |
| `maxTokens` | **8192** (21,333 미만 — V4) | 1024로 떨어져 실험이 무의미 |
| `inputCostPerMillion` / `outputCostPerMillion` | **원본과 같은 값** | `calcCost`가 0 → §9-5가 죽는다(V3) |
| `order` | 기존 Claude보다 **작게** | D8 기본 선택이 실험 문서로 안 잡힌다 |
| `nickname` | 다른 한 음절(예 '문') | 닉네임 충돌 |
| `displayName` | 구별되는 이름 | 칩 라벨 혼동 |
| `enabled` | `true` | 목록에 안 뜬다 |
| `appendPrompt` | 길이·형식 완화 한두 줄<br>예: *"이 요청에서는 800자 제한과 단계 나열 금지를 적용하지 않는다. 지적을 빠짐없이 항목으로 적어라."* | D14의 목적이 사라진다 |

⚠ **기존 Claude 문서를 고치지 말 것** · 만든 뒤 **새로고침**(모듈 캐시, E6) ·
`enabled:true`면 **모든 문항의 칩 바에 칩이 하나 더**(V2) ·
`enabled:false`로 내려도 **닉네임 예약은 남는다**(`getReservedNicknames` → `getAllModels`, `ai-models.ts:73-76`, W7) ·
**`appendPrompt`는 실험 중 고정**(D19).

### 2. 실험 대상 문항 3~5개 — 군더더기가 있을 법한 고난도·긴 풀이
### 3. 규칙 배포(`firestore.rules`) — S1 이후

---

## 9. 실험 운용

문안 3개를 같은 문항에 돌리고(한 세션에 연달아 — D15′) 아래 여섯을 본다. 기록은 대화 세션 자체.

1. **지적 건수와 질** — G1 대비 G2·G3가 더 찾는가, 오탐만 느는가
2. **답이 잘리는가** — 신호는 **출력 토큰 하나뿐**(비용 배지 `title`, `:1938`). `maxTokens`(8192)에 근접하면 잘린 것이다.
   ⚠ 잘림 안내 문구는 **그래프 명세 전용이고 Claude 경로엔 없다**(X3) — 다른 신호를 기대하지 말 것
3. **시스템 프롬프트의 저항** — G3가 "풀이 재작성"을 해 주는가, 결론 한 줄로 뭉개는가(E5)
4. **시간** — 라운드당 몇 분인지가 66b 설계의 입력값. ⚠ 한 요청 예산 **280초**이고
   **도구 턴이 돌면 그 안에서 Anthropic 호출이 최대 4회**다(X1). 닿으면 500
5. **비용** — 메시지 하단 `$…`(`:1940`) 합산 · 세션 합계(`:982`)
6. **61h 정의와의 충돌** — G3가 잡는 "더 짧게 쓸 수 있는 것"을 군더더기로 받아들이는지(§11-4)

**판정.** 하나가 확실히 나으면 나머지를 `enabled:false`. 우열이 안 갈리면 복제해 변형을 만든다.
⚠ **작은 표본으로 판본을 가리지 말 것**(61b 교훈) — 문항 3~5개의 차이는 노이즈일 수 있다.

---

## 10. 하지 말 것

- `/api/verify`·`lib/verify/*`·`batchVerify`·`BatchVerifyDialog`·`verification` **무접촉**.
- **검증 칩을 지우지 말 것**(대조군) · `buildContext`·`invokeOneAI`를 lib으로 빼지 말 것(66b).
- **`invokedIds`를 합집합으로 만들지 말 것**(E3) · **답글 분기를 통과시키지 말 것**(D17).
- **문답 전송에 히스토리를 싣지 말 것**(D15′) · **타이핑 전송의 히스토리를 끄지 말 것**.
- **`handleSave`를 try/catch로 감싸 "실패를 잡았다"고 여기지 말 것**(X4) — 그 함수는 throw하지 않는다.
  유일한 신호는 `await` 뒤의 **`lastSaveOkRef.current`**다.
- **`savingRef`를 무시하지 말 것**(X5) — 자동 저장 중이면 `handleSave`가 즉시 반환하고
  `lastSaveOkRef`는 직전 성공값이라 **미저장 편집이 그대로 전송된다**.
- **`ensureSavedForAI`의 deps에서 `dirty`를 빼지 말 것**(X6) — stale `false`면 저장을 건너뛴다.
- **전송 호출을 catch 없이 두지 말 것**(D21) — `CommentEditor`의 `try/finally`를 흉내 내면 실패가 사라진다.
- **질문 본문에 트리거 낱말을 쓰지 말 것**(D20) — `검산`·`sympy`·`파이썬으로`·`코드로 확인/검증/계산`·
  `계산해 확인` / 그래프 그리기 결합형.
- 질문 문안을 코드에 박지 말 것 — 씨앗은 **최초 1회 복사본**, 이후 진실은 Firestore다.
- 꼬리(출력 형식 지시)를 코드가 붙이지 말 것 · **`order` 없는 문서를 만들지 말 것**(V6).
- 팝오버 래퍼에 `position:relative` 금지 · `width:250` 리터럴 복제 금지 · 네이티브 `alert/confirm` 금지.
- **`PH.listChecks` 재사용 금지**(E1) · **기존 Claude 문서 수정 금지**(D14) ·
  **`maxTokens` 21,333 이상 금지**(V4) · **실험 중 `appendPrompt` 변경 금지**(D19).
- `lib/ask/seed.ts`에 import 문 금지 · `lib/askQuestions.ts`를 `lib/ask/`에 두지 말 것.
- 새 색은 토큰으로(M6 팔레트 셋).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지(push는 덕수) · roadmap 갱신 · 확정본만 `docs/phasedocs/`.

---

## 11. 구상 노트 — 이후 방향

### 11-1. 66b — 폴더뷰 순차 실행
- 진입은 지금의 [일괄 검증] 버튼 하나 → 모드 선택 팝오버(**교차 검증** / **문답 검증**). 61d 코드 **0**.
- 모드 팝오버는 마지막 선택을 기억하지 않는다. 선택 바에는 버튼을 더하지 않는다.
- 선택 화면 = 문항 표(체크박스·오너 게이트·프리플라이트) + 검증 항목 체크 + 모델 칩 + 라운드/시간/비용/[시작].
- **문항 기본 체크 = 전부 해제**(61d와 달리 `stale` 같은 신호가 없다). [전체 선택]은 둔다.
- 실행 = 문항 직렬 → 질문 직렬 → 모델 병렬, 히스토리 없음 — **D15′ 덕에 1단계와 같은 갈래**.
- ⚠ 배치 설계 입력값 둘은 1단계에서만 얻는다: **라운드당 시간**(§9-4)과 **문항당 비용**(§9-5).
  ⚠ 시간 추정에는 **도구 턴 배수**(X1)를 반드시 반영할 것 — 문항 수 × 질문 수 × (최대 4회)다.
- 결과 요약 팝업 내용은 미결.

### 11-2. 66c — 정리
- 검증 칩 삭제 — `VerifyChips`·`VERIFY_CHAR_CAP`·`runVerify`·`PendingAIBubble`의 `kind:'verify'` 갈래 ·
  `handleRetryAI`의 verify 분기(`:841-845`) · prop 배선(`EditorView:3106, 4137, 4139` · `ProblemView:338, 1282, 1284`).
- 질문 전문이 벽으로 서는 문제(V7)가 거슬리면 접는 렌더.
- 삭제 시점은 **실험 종료 후**.

### 11-3. 질문 목록의 장래
- 문제 검증 4종·논리 2종은 후보로만. 문제 질문에 `{answer_line}` 치환이 처음 필요해진다 —
  ⚠ `Problem.answer`는 discuss 컨텍스트에 없다(`buildContext`가 탭 블록만 조립, `:554-583`).
- **한 질문에 한 잣대**(61b 실측). 길이가 아니라 표적 개수가 문제다.
- 제미나이 4렌즈: ①은 G2에 흡수, ②③④는 압축 축이라 G3 세부. 체크리스트 4개를 한 프롬프트에 넣는 형태는 불채택.
- 모델 고정: 실험 중 D14 문서 하나. 항목별 차이가 실측되면 질문 문서에 `preferredModelId`.
- **서버 갈래**: §9-2·9-3이 "`appendPrompt`로 부족"이면 `/api/discuss`에 `mode:'ask'`를 두고
  ① `BASE_SYSTEM_PROMPT`의 형식 규칙 교체 ② **트리거 접미 부착·`forceCodeExecution` 끄기**(X2의 근본 처방)를 함께.
  ⚠ 그때 `aiProviderParams` 스냅샷 계약(61f D10)을 먼저 확인할 것.

### 11-4. 두 축의 충돌
61h의 군더더기 정의는 **"지워도 되는 것"**이고 "짧게 쓸 수 있다는 것만으로는 군더더기가 아니다"를 명시한다.
G3는 그 제외 영역을 겨냥한다. 문답형이 그쪽에서 더 유용하면 **두 정의가 갈린 채 공존**(문답 = 편집용, 61h = 검증용)이
맞는지 결정이 필요하고, 61h를 손대는 쪽은 M1 방침("61b/61h 동결")에 걸린다.

---

## 부록 A. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| 66 v1 | web | 전체 구상 — 질문 9종 · 폴더뷰 배치 |
| 66a v1 | web | 1단계로 축소 — 칩 유지·lib 추출 유예·질문 3개·Firestore 편집 |
| 66a v2 | CLI | 정정 10(E) · 보완 8(G) · D1′·D13~D18 |
| 66a v3 | web | 역정정 9(C) · 보완 10(V) · **D15 → D15′** |
| 66a v4 | CLI | v3 전수 확인 · 보완 12(W) · D19 · prop 표면·busy·실패 계약 |
| **66a v5** | **web (2026-09-14)** | **v4 수용 9 · 정정 2(X2·X3) · 신규 11(X1~X11) · D20·D21 신설 · D12′ 3중 가드 · T7 · 착수 가능** |

## 부록 B. v4 W항목 판정

| W | 판정 |
|---|---|
| W1 시간 예산 | **절반 사실** — 배선(`:19`·`:58`·`:570-579`)은 정확하나 **결론이 틀렸다**. 브라우저→서버는 1요청이지만 서버→Anthropic은 최대 4회다 → **X1로 대체** |
| W2 `onBeforeAskSend` throw 계약 | ✓ 사실이고 중요하다. 다만 **범위가 좁다** → X4·X5·X6·X7(D12′·D21)로 확장 |
| W3 prop 표면 | ✓ 수용(§5) |
| W4 busy 정의 | ✓ 수용(D16) |
| W5 잘림 판정 | **절반 정정** — `title`의 출력 토큰(`:1938`)은 ✓. 그러나 "라우트가 미종결 펜스를 잘림으로 보고 안내를 붙인다(`:278`)"는 **그래프 명세 전용**이고 `isGraphModel`이 google·openai뿐이라 **Claude 경로엔 아예 없다** → X3 |
| W6 D14 필드 체크리스트 | ✓ 수용(§8). `mapDoc:17-36` · `apiModelName ?? id` · `order ?? 999` · 단가 기본 0 전부 확인 |
| W7 닉네임 예약 잔존 | ✓ `getReservedNicknames` → `getAllModels`(`:73-76`) |
| W8 재시도가 D15′ 보존 | ✓ `retryContext`(`:669`) → `invokeOneAI(model, pending.retryContext, sessionId)`(`:857`) |
| W9 `ensureSeeded` 실패·uid Map | ✓ 수용(D4·§5) |
| W10 하니스 총계 | ✓ 439건(CLAUDE.md M7 절) → `test:ask` 7로 **446**. 규칙은 X10 참조 |
| W11 개명 소급 | ✓ `:405`가 렌더 시 결정 — 데이터 무접촉 |
| W12 실험 변수 둘 | ✓ 수용(D19) |

## 부록 C. v5 신규·정정 (X1~X11)

| # | 내용 |
|---|---|
| **X1** | **W1 결론 뒤집기 — 한 요청 안에서 Anthropic 호출이 최대 4회다.** `getProviderForModel`이 Claude를 `enableCodeExecution: true`로 만들고(`ai-provider.ts:556`, 검증 판정자는 `:592`에서 `false` — 비대칭), `buildClaudeParams`가 그때 `params.tools`를 싣는다. `stop_reason === 'pause_turn'`이면 assistant 턴을 이어 붙여 재요청하고(`:422, 449-452`) 상한은 `DEFAULT_MAX_TOOL_TURNS = 3`(`providerParams.ts:34`). 각 턴이 `max_tokens`까지 뽑으므로 8192면 최악 32,768 출력 토큰이 **280초** 안에 들어가야 한다. 61b 실측(Claude 단건 38~52초, 군더더기 184초 이상치)에 비추면 여유롭지 않다. **위험은 토큰이 아니라 턴이다** |
| **X2** | **씨앗 G2가 실험을 무효화한다 — 이번 판 최대 발견.** `CODE_EXEC_TRIGGER_RE = /검산\|sympy\|코드로\s*(확인\|검증\|계산)\|파이썬으로\|계산해\s*확인/i`(`route.ts:256`)가 `body.currentMessage` **전체**를 본다. G2 본문의 "…확인하는 **검산**"이 걸려 ① 사용자 메시지 끝에 *"반드시 Python(SymPy) 코드를 실제로 실행… 코드 실행 없이 답하면 응답이 무효 처리됩니다"*(`:259-263`)가 붙고 ② `forceCodeExecution`(`:571`) → `params.tool_choice = { type: 'any' }`로 **도구 호출이 강제**된다. G2가 *묻는* 것(검산이 군더더기인가)이 모델에겐 *요청*(검산해 달라)으로 도착한다. 시간·비용도 X1대로 배가된다. → **D20 신설**: 씨앗 한 줄 수정("맞는지 확인하는 절차") · `triggerWarnings` 경고 · **T7이 회귀를 고정** |
| **X3** | **W5 정정 — Claude 경로에 잘림 안내가 없다.** `:342`의 *"(그래프 명세가 토큰 한도로 잘려 제거되었습니다)"*는 `sanitizeGraphFences` 내부이고 호출이 `if (graphEnabled)`(`:584`)인데 `isGraphModel`은 **google·openai뿐**(`:385-387`). 응답 `DiscussSuccess`에 `stop_reason`도 없다 → **잘림 신호는 출력 토큰 하나뿐** |
| **X4** | **`handleSave`는 throw하지 않는다.** `catch`에서 `setStatus` · `setSaveError(true)` · `lastSaveOkRef.current = false`로 삼킨다(`EditorView.tsx:3086-3090`). 따라서 `try { await handleSave(true) } catch {}`로 감싸면 **아무것도 못 잡는다**. 유일한 신호는 `await` 뒤의 `lastSaveOkRef.current` 판독이고, 현행 `:3115`가 정확히 그렇게 한다 — 추출할 때 이 구조를 바꾸지 말 것 |
| **X5** | **진짜 조용한 경로 — 자동 저장 중이면 가드가 그냥 통과한다.** `handleSave` 머리의 **`if (savingRef.current) return;`**(`:2944`)이 즉시 반환하고, 이때 `lastSaveOkRef.current`는 **직전 성공값(초깃값도 `true`, `:2941`)** 그대로다 → `if (!lastSaveOkRef.current) throw`가 통과 → **미저장 편집 상태로 전송**된다. 저장이 도는 경우: 30분 자동 저장(M7 D12) · **탭 전환 자동 저장**(`switchTab` → `handleSave(true)`, `:3092`) · 저장 버튼 직후. ⚠ **61b 검증 칩에도 이미 있는 잠복 버그**이고 66a가 그 코드를 두 번째 호출부로 복제하려던 참이다. 처방(D12′): `ensureSavedForAI`가 진입 시 `savingRef.current`를 보고 **가라앉을 때까지 대기**(상한 둔 폴링) 후 평소 경로 |
| **X6** | **`useCallback` deps.** `ensureSavedForAI`가 `dirty`·`handleSave`를 deps에서 빠뜨리면 stale `dirty=false`로 저장을 건너뛴다 — X5와 같은 부류의 조용한 실패. 현행 `handleRunVerify`는 `[problem, user, dirty, handleSave, …]`(`:3136`)로 옳다 |
| **X7** | **전송 자체의 실패도 조용히 사라진다.** `CommentEditor.handleSubmit`은 `try { await onSubmit(trimmed) } finally { setSubmitting(false) }`로 **catch가 없다**(`:140-144`) → 타이핑 경로에서 `addComment`가 실패하면 unhandled rejection이 되고 **입력만 비워진 채 아무 일도 안 일어난다**(기존 잠복 — 이번 범위 밖). 문답은 `handleSendMessage`를 **직접** 부르므로 그 흉내를 내면 같은 구멍이 생긴다 → **D21: 전송 전체를 try/catch** |
| **X8** | 검수 문구 정정 — D15′에서 `images.history`는 **부재가 아니라 빈 배열**이고, 그림이 하나도 없으면 `images` 키 자체가 없다(`:756-763`의 `hasAnyFig` 분기) |
| **X9** | **D15′의 서버 쪽 확인** — `validate()`는 `Array.isArray`만 보므로 `[]` 통과(`:452`), `buildUserPrompt`는 `if (body.discussionHistory.length)`라 **빈 절 머리말을 만들지 않는다**(`:408-415`). 프롬프트가 깨끗하다 |
| **X10** | 규칙 테스트 수치 — 현재 **블록 65개**이고 **번호 최대는 63**이다(`26a`·`26b`·`27a`·`27b` 4개가 접미형). 새 케이스는 **번호 64·65 / 블록 67개**. v4의 "63 → 65"는 번호 기준이라 맞지만 CLAUDE.md에 적을 때 블록 수와 섞지 말 것 |
| **X11** | 실험 로그 이득 — 사람 메시지에 **`invokedModelIds`가 저장된다**(`:731`). 문답 전송은 override를 넘기므로 **어느 모델에 물었는지가 대화에 남는다**. §9 판정에서 별도 기록이 필요 없다 |

---

*v5 — 착수 가능. 준비물 §8(콘솔 문서 1건 + 문항 선정 + 규칙 배포). 서버·프롬프트·61b/61d/61h 코드 변경 0.*
