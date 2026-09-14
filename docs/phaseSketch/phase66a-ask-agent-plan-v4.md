# Phase 66a — 문답 검증 1단계: agent 탭 질문 리스트 구현 계획서 v4 (CLI 실측 · 착수판)

작성일: 2026-09-14 · 작성: **CLI 실측 재검증** · 기준 커밋: **mathory `origin/main 9061cf9`**
계보: 덕수 스케치 → 66 v1(전체 구상) → 브레인스토밍 → 66a v1(web) → 66a v2(CLI) → 66a v3(web 재검증) → **66a v4 = 착수판**
(부록 D가 v3 판정 — **역정정 9건 전부 수용** · 인용 12건 재확인 · **신규 보완 12(W1~W12)**)
착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

> **v4는 정정판이 아니라 보완판이다.** v3의 역정정 C1~C9는 실물과 하나도 어긋나지 않았고(v2의 행 번호가
> 6곳 틀렸다), v3가 새로 인용한 행 12개도 전부 맞았다. v4가 더하는 것은 **v3가 결정은 했으나 확인하지
> 않은 것들** — 특히 `maxTokens`를 8배 올리면서 시간 예산을 한 줄도 보지 않은 자리(W1)와,
> 실패 신호가 정의되지 않은 `onBeforeAskSend` 계약(W2)이다.

---

## 0. 요약

agent 대화창 입력 상단에 **질문 리스트 버튼**을 달고, 거기서 고른 검증 질문을 선택한 AI에게 보낸다.
질문 문안은 `users/{uid}/ask_questions`에 살며 **앱 안에서 추가·수정·복제·삭제**한다.

**이번 판의 목적은 기능 완성이 아니라 실험이다.** 어떤 질문 문안이 좋은 답을 내는지는 써 보기 전에는 모른다 —
그래서 질문 3개를 씨앗으로 넣고, 문안을 고치는 왕복이 배포 없이 도는 구조를 먼저 만든다.

**서버 0 · 프롬프트(`lib/verify/prompts.ts`) 0 · 61b/61d/61h 코드 0 · 문항 스키마 0 · 렌더 5사이트 0 · 폰 0.**
Firestore 규칙 **1블록 추가** · 신규 3파일 · 기존 7파일 수정 · **ICONS 60 → 61종** ·
**로직 검증 439 → 445건**(`test:ask` 6 — W10).

**핵심 설계 셋**
- **D15′ 히스토리 미첨부** — 문답 전송만 `discussionHistory: []`. 한 세션에 질문 셋을 나란히 쌓아 읽으면서도
  앞 답이 뒤 질문을 오염시키지 않는다. v3의 결정이고 v4가 부수 효과 둘을 확인했다(W8·§2-1).
- **D14 실험 전용 모델 문서** — 800자·"단계 나열 금지"는 **시스템 프롬프트**에 있어 질문 본문으로는 못 이긴다.
  콘솔에서 문서 하나를 더 만들어 `appendPrompt`로 덮는다. 코드 0. ⚠ 필드 체크리스트가 v3보다 넓다(W6).
- **씨앗 3개 + 앱 안 편집** — 문안이 진실이 아니라 Firestore가 진실이다. 다음 질문은 배포 없이 추가한다.

---

## 1. 범위 — 무엇을 **안** 하는가, 그리고 왜

| 항목 | 66 v1 | 66a | 이유 |
|---|---|---|---|
| [문제 검증]·[풀이 검증] 칩 | 삭제 | **남긴다** | 지금 그 칩이 **대조군**이다. 같은 문항에서 칩은 "이상 없음", 질문은 "지적 3건"이 나오는 비교가 판정 근거다. 삭제는 실험이 끝난 뒤(66c) |
| `buildContext`·`invokeOneAI` lib 추출 | S2(최대 위험 커밋) | **안 한다** | 추출이 필요한 이유는 폴더뷰 배치가 CommentPanel 밖에서 같은 조립을 써야 하기 때문. agent 탭 안에서만 쓰는 동안은 현재 자리가 맞다 |
| 폴더뷰 순차 실행 | 포함 | **안 한다** | 예상 시간·비용·중단 정책이 전부 추정치다. 1단계 실사용으로 실측한 뒤 설계한다 |
| 문제 검증 질문 4종·논리 질문 2종 | 목록에 포함 | **안 넣는다** | 추측이다. 씨앗은 군더더기 3개뿐이고 나머지는 앱 안에서 추가한다 |
| 결과 요약 팝업·`verification` 배지 | 포함 | **안 한다** | 답은 세션 메시지로 남는다. 대화 기록이 곧 실험 로그 |
| 컨텍스트 길이 사전 경고 | — | **안 한다**(G6) | 검증 칩의 `verifyCharCount`는 검증 셈법이라 재사용이 어긋난다. dev 콘솔 `console.warn`로 본다 |
| 폰 대응 | — | **필요 없다**(V5) | `PhoneApp.tsx:392`가 `panelSlot('agent', false)`로 마운트해 `canComment=false` → 컴포저(`CommentPanel:1099`)가 렌더되지 않는다 → `headerLeft`도 질문 버튼도 없다. **폰 전용 코드 0** |

**남는 것.** 질문 컬렉션 + 씨앗 3개 + 리스트 팝오버(선택·수정·복제·삭제) + 전송.

---

## 2. 확정 사실 (origin/main `9061cf9` — v3 인용을 전수 재확인, 행 번호는 이 커밋 기준)

### 2-1. 전송 경로는 이미 있다 — 바꿀 것은 `content`·모델 목록·히스토리뿐

`handleSendMessage`(`CommentPanel.tsx:680-787`)의 실제 순서:

| 지점 | 행 | 내용 |
|---|---|---|
| `writeSessionId` 삼항 | `:684-686` | 댓글 모드면 `commentSessionId`, agent면 `activeSessionId` |
| **답글 분기** | **`:689-700`** | `if (replyingTo) { … addComment(parentCommentId) ; return }` — **AI 0회** |
| 댓글 모드 분기 | `:703-712` | `if (isCommentsMode) { … return }` |
| 세션 가드 | `:715-718` | `if (!activeSessionId) { alertDialog('먼저 세션을 만들어 주세요.'); return }` |
| 모델 해석 | `:721-724` | `invokedIds = isAISession ? [...selectedModelIds] : []` → `aiModels.find`로 `invokedModels` |
| 사람 메시지 저장 | `:726-733` | `invokedModelIds` 포함 |
| 조기 반환 | `:735` | `if (invokedIds.length === 0) return` |
| 컨텍스트·히스토리 | `:738-739` | `buildContext()`(`:554-583`) · `buildHistory()`(`:585-615`) |
| 그림 유무 판정 | `:746-747` | `hasAnyFig = … || historySlots.some((a) => a.length > 0)` |
| 바디 조립 | `:749-764` | `discussionHistory: history` · `images.history: historySlots`(`:760`) |
| 병렬 호출 | `:784-786` | `Promise.allSettled(invokedModels.map(invokeOneAI))` |

`CommentEditor.onSubmit` 타입은 `(content: string) => Promise<void>`(`CommentEditor.tsx:26`)이므로
**두 번째 매개변수를 옵셔널로 더해도 계약이 깨지지 않는다.**

⚠ 그 경로의 함정 셋:
- `replyingTo`가 켜져 있으면 `:689`에서 답글로 저장하고 **`return`** — AI 0회(E2·D17).
- `invokedIds`는 `selectedModelIds`를 읽으므로 override는 **대체**여야 한다. 합집합이면 칩으로 켜 둔 다른 모델까지
  같은 질문을 받아 비용이 배로 든다(E3).
- **`buildHistory()`가 무조건 돈다**(`:739`) — 최근 5개(`HISTORY_LIMIT` `:33` · `:600`)가 딸려간다(G5 → D15′).

**D15′의 부수 효과 두 가지를 실물로 확인했다.**
`historySlots`가 `[]`면 ① `:747`의 `historySlots.some(...)`이 false라 `hasAnyFig` 계산이 자연히 맞고
(문항·메시지 그림은 그대로 첨부된다) ② `:760`의 `images.history`도 `[]`가 된다 —
**61f의 슬롯 번호 매기기(D19)가 히스토리 몫만큼 비는 것이 아니라 애초에 존재하지 않게** 되므로
`[그림 k]` 번호가 밀리지 않는다. 별도 처리 0.

⚠ `runVerify`(`:807-836`)는 실행과 함께 `setSelectedModelIds([])`(`:822`)를 한다.
**문답 전송은 칩 선택을 건드리지 않는다** — override로 자기 모델을 따로 들고 가므로 칩은 타이핑 대화용으로 남는다(G7).

### 2-2. 사용자별 편집 가능 컬렉션의 전례 — `math_snippets`

- 규칙 **`firestore.rules:30-32`**(v3의 역정정이 옳다 — v2가 틀렸다, C1):
  ```
  30:      match /math_snippets/{snippetId} {
  31:        allow read, write: if request.auth != null && request.auth.uid == userId;
  32:      }
  ```
  `toolbar_config`는 `:35-37`. 새 블록은 그 아래(`:38`의 `}` 앞).
- CRUD(`lib/snippets.ts:16-64`): `collection(db,'users',userId,'math_snippets')` · `listSnippets`(orderBy) ·
  `createSnippet`(addDoc + `serverTimestamp()`) · `updateSnippet` · `deleteSnippet`. 타입은 `types/snippet.ts`
  (`created_at`/`updated_at`을 `Date`로 변환해 내보낸다 — 같은 형태를 따를 것).

→ `ask_questions`는 이 두 파일을 **형태 그대로** 복제한다. `orderBy('order')` 단일 필드라 복합 인덱스도 없다.
⚠ **`orderBy`는 그 필드가 없는 문서를 결과에서 제외한다**(V6) — 콘솔에서 손으로 만든 문서에 `order`가 빠지면
목록에서 **조용히 사라진다**. 정상 경로(씨앗·생성·복제)는 항상 쓰므로 안전하되 규약으로 못 박는다.
⚠ 스니펫 관리 UI는 이 저장소에 **없다**(`listSnippets` 소비처가 에디터 단축키뿐) — 편집 모달은 베낄 전례가 없고
`dialogStyles` 규격으로 새로 만든다.

### 2-3. 상단 바에 자리가 있다 (단, 좁다)

`headerLeft`(`CommentPanel.tsx:1156-1180`)는 `flex; flexWrap: wrap; gap 6` 컨테이너에
`AIChipBar`(전폭 div, `:1384` · `models={aiModels}` `:1161`) + `VerifyChips`(`:1439`).
- ⚠ `:1157-1158` 주석 — fragment로 나란히 두면 아랫줄로 밀린다. 기존 flex 컨테이너 **안**에 넣을 것.
- ⚠ `:1458-1460` — 칩 래퍼에 `position:relative`를 두면 팝오버 기준이 칩 묶음이 되어 패널 밖으로 넘친다.
- **팝오버 기준 상자 = 컴포저 래퍼 `:1100-1104`**(`padding:'10px 16px 12px'` · `position:'relative'`).
  `CommentEditor` 루트(`:213-216`)와 headerLeft 래퍼(`:219-223`)는 positioned가 아니라 중간에 기준이 끼지 않는다.
  ⚠ 패널 기본 폭 420(`PANEL_WIDTH_DEFAULT`)에서 래퍼 내부 폭은 388이므로 **`width:250` 리터럴을 베끼지 말고
  `left:0; right:0`**(E10 — `VerifyChips` 팝오버는 `:1490-1491`이 `width:250; left:50%; translateX(-50%)`).
- ⚠ 컴포저 전체가 **`canComment ? … : …`**(`:1099`) 안에 있다 → `canComment=false`면 상단 바 자체가 없다(V5, 폰).

게이트 재료: `ownerUid`(`:67`) · `currentUid`(`:70`) · `isAISession`(`:359`) · `activeSessionId`.

### 2-4. 아이콘은 한 키를 늘려야 한다

`PH.listChecks`는 이미 **`ProofreadIcon`(교정)**이 쓴다(`scripts/gen-phosphor-paths.mjs:78`의 `// ProofreadIcon` 주석 ·
`UnifiedToolbar.tsx:83`). EditorView에서는 Row 2 툴바와 agent 드로어가 **동시에 화면에 있으므로** 같은 글리프가 두 뜻을 갖는다.
→ ICONS에 한 줄:
```
listDashes: ['list-dashes', 'regular'],   // IconQuestionList — 문답 검증 질문 목록 (66a)
```
**존재 확인**: `lib/phosphor-ko.json`(카탈로그 1,414종)에 `"list-dashes"` 1건 실재 — 저장소 안에서 검증 가능(C9).
`npm run icons:gen` 후 빌드 로그가 **`[icons:check] OK — 61종`**이어야 한다(현재 60종).
`Icons.tsx`에는 `export const IconQuestionList = phIcon(PH.listDashes, 16);` 한 줄(팩토리 `:38-43`).

### 2-5. 알고 쓰는 제약

| 제약 | 근거 | 대응 |
|---|---|---|
| **답변 규칙은 길이만이 아니다** — 800자(고난도 1200자, `route.ts:98`) **+ "단계 나열(1./2./3.… 번호로 풀이 재작성)" 금지(`:101`) + "장황한 사고 과정 서술은 응답이 무효 처리되는 사유"(`:88`) + 최우선 출력 규칙 머리말(`:62`)** | `BASE_SYSTEM_PROMPT` | 질문 본문으로는 **시스템 프롬프트를 못 이긴다**. 레버는 `appendPrompt` → **D14** |
| **시간 예산은 넉넉하다**(W1) | `maxDuration = 300`(`route.ts:19`) · `TIMEOUT_MS = 280_000`(`:58`) · `withTimeout(provider.complete(...), TIMEOUT_MS)`(`:570-579`) | 문답은 **1요청**이라 61b가 2요청으로 쪼갠 이유(300초)에 걸리지 않는다. `maxTokens` 8배도 안전. 닿으면 500 + `[discuss] … 실패` |
| `ai_models.maxTokens` 기본 **1024** | `lib/ai-models.ts:24` · `route.ts:571`이 `config.maxTokens`를 그대로 넘긴다 | D14에서 8192. ⚠ **21,333 미만 유지**(V4) |
| `getEnabledModels`는 **모듈 캐시** | `lib/ai-models.ts:13-14, 50-58` | 콘솔에서 문서를 고쳐도 **새로고침 전까지 반영 0**(E6) |
| `appendPrompt`는 시스템 프롬프트 뒤쪽 | `route.ts:241-243`(`[추가 지침] …`) | ⚠ 맨 뒤는 아니다(C3) — `STRUCTURED_OUTPUT_INSTRUCTION`(`:245`)이 뒤에 올 수 있으나 **DeepSeek 전용**이라 Claude 경로에서는 실질적 맨 뒤 |
| `/api/discuss` 무인증 · 오류 500 일괄 | catch `:600` · 반환 `:603-606` | 1단계는 단건 수동 실행이라 중단 정책이 필요 없다 |
| 컨텍스트 15,000자 자름 | `CommentPanel.tsx:553, 568-573`(`console.warn`만) | dev 콘솔로 확인(G6) |
| **히스토리 최근 5개가 딸려간다** | `HISTORY_LIMIT = 5`(`:33`) · `:600` · `:739` | **D15′ — 문답 전송은 히스토리를 싣지 않는다** |
| 리포트 라벨이 '정밀 검증' | `CommentPanel.tsx:405` | **61b UI만 '교차 검증'으로 개명**(D1′). ⚠ 라벨은 렌더 시 결정이라 **옛 리포트 표시도 함께 바뀐다**(W11 — 데이터 무접촉, 의도) |
| AI 댓글 create는 오너만 | `firestore.rules:262-268` — `authorType=='ai'` ∧ `authorUid.matches('^ai:.*')` ∧ **`resolved == false`** ∧ `isOwnerCmt()` | `addComment`가 항상 `resolved:false`를 쓴다(`lib/comments.ts:101`) → 추가 작업 0 |
| 비용은 **메시지마다** 이미 보인다 | `:1940`($ 5자리) · title에 **입력·출력 토큰**(`:1938`) · 세션 합계 `:362, 970-982` | §9-2의 **잘림 판정**에 출력 토큰을 쓴다(W5) |
| 질문 본문은 `currentMessage` 별도 필드 | `invokeOneAI` `:632` | 질문이 길어도 `CONTEXT_CHAR_CAP`(탭 블록만 셈)을 잡아먹지 않는다(G4) |
| `CommentEditor.maxLength 1000`은 **문답에 안 걸린다** | `CommentEditor.tsx:51, 236` — textarea 전용 | 문답은 `handleSendMessage`를 직접 부른다. 유일한 상한은 `validateQuestion`의 8000자(V8) |
| 재시도가 공짜로 따라온다 | `handleRetryAI` `:838-858` + `retryContext` `:669` | 문답도 일반 모델 경로. ⚠ **재시도는 D15′를 보존한다**(W8) |

---

## 3. 결정표 (v4)

| # | 결정 | 근거 |
|---|---|---|
| **D1′** | **새 기능 = '문답 검증'** · 61b UI 라벨만 `'정밀 검증'` → **`'교차 검증'`**(`:405`) | '정밀 검증'은 CLAUDE.md·roadmap에서 61b/61d/61h 파이프라인을 가리킨다 — 뒤집으면 기존 문서가 오독된다. 61b는 스스로도 "두 모델로 교차검증합니다"(`:1500`)라 UI 개명은 정확해지는 방향 |
| **D2** | 질문 저장 = `users/{uid}/ask_questions` | 2-2. 사용자 하위면 규칙 3줄 |
| **D3** | 스키마 `{ label, target, text, order, enabled, rev, created_at, updated_at }` | `target`은 **저장만**(1단계 UI에선 그룹 라벨). ⚠ `order` 필수(V6) |
| **D4** | 컬렉션이 비어 있으면 **씨앗 3개 자동 생성** — 트리거는 **팝오버 첫 열기** + **uid별 in-flight Map**(W9) | 패널은 EditorView·ProblemView(·폰)에서 마운트된다. 마운트 훅이면 문항을 열 때마다 읽기가 돈다(G1). 계정 전환 시 다른 uid의 약속을 재사용하면 안 된다 |
| **D5** | 편집 UI는 **팝오버 안에** — 행 ⋮ → 수정·복제·삭제, 하단 [+ 새 질문] | 문안을 고치고 싶어지는 순간은 시원찮은 답을 본 직후, 그 화면에서다 |
| **D6** | **복제가 1급 기능** | "G2를 조금 바꿔 G2b를 만들고 같은 문항에 둘 다 돌린다". 복제가 없으면 원본을 덮어써 비교 대상이 사라진다. 쓸모없어진 판본은 `enabled:false` |
| **D7** | 저장 시 `rev` 자동 +1 · 전송 메시지 **첫 줄 `[문답 검증 · {label} r{rev}]`** | 대화 기록이 실험 로그가 된다 |
| **D8** | 모델 기본 선택 = `localStorage` → 없으면 **`provider==='anthropic'` 중 `order`가 가장 작은 문서** | 문안을 비교하려면 모델이 고정 변수여야 한다. ⚠ 그래서 D14 문서의 `order`를 기존 Claude보다 **작게** 줘야 기본값이 실험 문서로 잡힌다(W6) |
| **D9** | 선택 기억 = `localStorage['mathory.ask.v1'] = { modelIds }`, try/catch | 질문은 매번 고르는 것이 맞다(그게 목적). 모델만 기억 |
| **D10** | 버튼 = `headerLeft`의 **기존 flex 컨테이너 맨 앞**, 라벨 `[≡ 질문]` | 2-3. 두 줄로 밀리면 아이콘 단독으로 축소 |
| **D11** | 치환 **없음** | 씨앗 3개가 전부 풀이 대상. 치환은 문제 질문을 넣을 때(66b) |
| **D12** | 전송 시 편집창이면 **저장 먼저** · **실패는 throw**(W2) | discuss 컨텍스트는 Firestore 저장본을 읽는다. 61b 칩의 dirty 가드(`EditorView.tsx:3113-3116`)를 그대로 물려받는다 — 그 경로는 `throw`로 실패를 알리므로 **팝오버가 catch해 `alertDialog` + 전송 중단**(§5). **열람뷰는 해당 없음** |
| **D13** | ICONS에 `listDashes` 1키 추가(60 → **61종**) | 2-4 |
| **D14** | **실험 전용 `ai_models` 문서 1개** — 콘솔 작업, **코드 0**. ⚠ 필드 체크리스트는 §8(W6) | 2-5. 800자·"단계 나열 금지"·"장황하면 무효"는 **시스템 프롬프트**에 있다. 기존 Claude 문서를 고치면 타이핑 대화·다른 경로까지 바뀐다 → 별 문서로 격리 |
| **D15′** | **문답 전송은 히스토리를 싣지 않는다** — `discussionHistory: []` · `images.history: []` | 오염은 실재하나(G5) 처방이 세션 분리면 문항 5 × 질문 3 = 세션 15개를 손으로 만들어야 하고 세 답이 흩어진다. 한 줄 분기로 오염을 없애고 한 세션에 나란히 쌓는다. §2-1이 부수 효과 둘을 확인했고 66b가 쓸 갈래를 미리 만든다 |
| **D16** | [보내기] 활성 = **해석된 모델 ≥ 1** ∧ `activeSessionId` ∧ **busy 아님** — busy = `pendingAI.some(p => p.sessionId === activeSessionId && !p.error)`(W4) | `invokedModels`는 `aiModels.find`로 해석되므로(`:722-724`) 사라진/비활성 modelId가 저장돼 있으면 **사람 메시지만 저장되고 AI 0회**(E4). busy 정의가 없으면 연타로 같은 질문이 두 번 나간다 |
| **D17** | 전송 직전 `setReplyingTo(null)` · 문답은 답글 분기를 타지 않는다 | E2. 답글 모드에서 보내면 조용히 답글로 저장되고 끝난다(`:689`) |
| **D18** | `createAskQuestion`의 `order` = 현재 최대 + 10 · 복제는 원본 `order + 1` | 수동 번호 관리 없이 끝에 붙고, 복제본은 원본 바로 아래 |
| **D19** | **`appendPrompt`는 실험 중 통제 변수다 — 고정하고 건드리지 말 것**(W12) | 씨앗 G1·G2 꼬리의 "길이 제한보다 빠짐없이"와 `appendPrompt`의 완화 문구가 같은 일을 한다. 둘 다 움직이면 §9 판정에서 **무엇이 작동했는지 못 가른다**. 변수는 **문안 하나**여야 한다 |

---

## 4. 데이터 모델

```
users/{uid}/ask_questions/{qid}
  label       string   '군더더기(원문)'          // 리스트 표시 · 메시지 첫 줄 라벨
  target      'problem' | 'solution'
  text        string   // 질문 본문 (꼬리 포함 — 꼬리도 실험 변수라 본문에 둔다)
  order       number   // ⚠ 필수 — 없으면 orderBy 쿼리에서 제외된다(V6)
  enabled     boolean
  rev         number   // 저장할 때마다 +1
  created_at / updated_at   serverTimestamp
```

규칙 — `firestore.rules`의 `match /users/{userId}` 블록 안, `toolbar_config`(`:35-37`) 아래:
```
// 문답 검증 질문(Phase 66a): 본인만
match /ask_questions/{qid} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

⚠ **꼬리를 코드가 붙이지 않는다** — 출력 형식 지시야말로 "답이 잘리는가"를 가르는 실험 변수다.
본문에 포함시켜 문안과 함께 고칠 수 있게 한다.

### 씨앗 3개 (`lib/ask/seed.ts` · import 0)

공통 전제: **문제는 오류가 없고 정답이 하나로 정해지는 정상 문항, 풀이의 결론도 옳다.**
축이 둘로 갈린다 — G2는 **"지워도 되는 것"**(61h 정의), G3는 **"더 짧게 쓸 수 있는 것"**(61h가 일부러 제외한 영역).
G1은 덕수가 실제로 쳐서 좋은 답을 받은 문장이라 **기준선**이다. G2·G3가 G1을 이기지 못하면 둘을 버린다.

**G1 · 군더더기(원문)** `order 10`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.
그런 전제에서, 풀이에 군더더기가 있으면 사소한 거라도 빠짐없이 찾아서 알려줘.

각 지적마다 원문을 짧게 인용하고, 왜 군더더기인지와 수정 방향을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.
```

**G2 · 군더더기(삭제 검사)** `order 20`
```
이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

풀이의 각 대목을 지워 보면서, 그 대목을 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지
논증이 완결되는 곳을 사소한 것이라도 빠짐없이 찾아줘. 이런 것들이 여기 해당해:
- 최종 답에 쓰이지 않는 양을 구하거나 성질을 밝힌 곳
- 뒤에서 한 번도 참조되지 않는 중간 결과
- 앞 결론에 새 내용을 보태지 않고 말만 바꾼 되풀이
- 동치 변형만으로 확정된 답을 다시 대입해 확인하는 검산

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

⚠ **G3는 시스템 프롬프트와 정면으로 부딪힌다**(E5). `BASE_SYSTEM_PROMPT`가
"**단계 나열(1./2./3.… 번호로 풀이 재작성) 금지**"(`route.ts:101`)와
"장황한 사고 과정 서술은 **응답이 무효 처리되는 사유**"(`:88`)를 못 박는데, G3가 요구하는 것이
정확히 **풀이 재작성**이다. D14의 `appendPrompt` 없이 G3를 돌리면 측정 대상이 "문안의 질"이 아니라
"시스템 프롬프트의 저항"이 된다. 출력이 가장 길어 `maxTokens`·시간·비용도 셋 다 G1·G2보다 크다 — §9.

---

## 5. UX

**버튼.** `headerLeft`의 기존 flex 컨테이너 맨 앞에 `[≡ 질문]`. 게이트 = `isAISession && currentUid === ownerUid`
(AI 답 저장이 오너 전용 — `firestore.rules:262-268`). 숨김 사유는 dev 콘솔에(61b의 `[Phase61b] 검증 칩 숨김: …` 문법).

**`AskListPopover` prop 표면**(W3) — D16·D4·씨앗·CRUD에 필요한 재료를 전부 받는다:
```
uid: string                      // ask_questions 경로 · ensureSeeded
models: AIModelConfig[]          // = aiModels (D16 해석 · 칩 렌더)
busy: boolean                    // = pendingAI.some(p => p.sessionId === activeSessionId && !p.error)
canSend: boolean                 // = !!activeSessionId
onSend: (message: string, modelIds: string[]) => Promise<void>   // CommentPanel이 D15′·D17·D12를 담당
onBeforeSend?: () => Promise<void>   // D12 — 실패 시 throw
```

**팝오버 1단 — 목록.** 컴포저 래퍼 기준 `position:absolute; bottom:calc(100% + 6px); left:0; right:0`(E10) ·
`maxHeight 320` + `overflowY:auto` · `zIndex 20`.
- 행 = `{label} r{rev}` + 본문 첫 줄 회색 미리보기 + ⋮
- 행 클릭 → 2단. ⋮ → 수정 · 복제 · 삭제(`confirmDialog({ message, danger:true })`) · 사용 여부 토글
- 하단 [+ 새 질문]
- `enabled:false`는 목록 맨 아래 흐리게(완전히 숨기면 되살릴 길이 없다)
- ⚠ **로드 실패(규칙 미배포 등)는 빈 목록 + 안내 한 줄로 흘린다**(W9) — 크래시 금지

**팝오버 2단 — 전송.** 질문 라벨 · 모델 칩(기본 D8) · **"이 전송은 이전 대화를 참조하지 않습니다"** 한 줄(D15′) ·
[취소] [보내기](활성 조건 D16).
누르면 →
1. `onBeforeSend?.()` — **throw하면 `alertDialog(메시지)` 후 중단하고 팝오버는 열어 둔다**(W2)
2. 팝오버 닫힘 → `setReplyingTo(null)`(D17)
3. `handleSendMessage(전송문, { modelIds, noHistory: true })`

사람 메시지가 대화에 뜨고 `PendingAIBubble`이 모델 수만큼(실패 시 [재시도]도 그대로 — G2·W8).
입력창의 미완성 텍스트는 건드리지 않는다.

**편집 모달.** `dialogStyles` 규격(`dialogOverlay`·`dialogBody`·`dialogHead`(57)·`dialogContent`·`dialogFoot`·
`dialogInput`·**`dialogBtn(...)`** — `export function`이라 `export const` 목록만 훑으면 안 보인다, `:79`).
라벨(1줄) · 대상(문제/해설 셀렉트) · 본문(textarea 12줄 이상) · 사용 여부 · [취소] [저장]. 저장 시 `rev+1`.
복제는 `label + ' 사본'` · `rev 1` · `order = 원본+1`(D18)로 새 문서를 만들고 곧바로 편집 모달을 연다.
⚠ `Z_DIALOG 10500`이라 팝오버(20) 위에 뜬다 — 팝오버를 닫지 않아도 된다.
⚠ `position:fixed` 안전(V9): 같은 패널 안 `SelectionInsertPopup.tsx:291`이 이미 fixed로 동작한다.

**전송문 조립** = `[문답 검증 · {label} r{rev}]\n\n{text}` (D7).
⚠ 이 전문이 **사람 메시지로 대화에 그대로 남는다**(V7) — G2는 ~600자라 답 앞에 벽이 선다.
**실험 로그로는 이득**(문안이 답 옆에 박제된다)이라 1단계는 수용. 시끄러우면 66c에서 첫 줄만 보이고 접는 렌더.

---

## 6. 구현 항목

### 신규

| 파일 | 내용 |
|---|---|
| `lib/ask/seed.ts` (**import 0**) | `AskQuestion` 타입 · `SEED_QUESTIONS`(§4 셋) · `ASK_LABEL_PREFIX = '문답 검증'` · `buildAskMessage(q)` · `nextRev(n)` · `nextOrder(list)` · `validateQuestion(q)` — `npm run test:ask`가 단독 컴파일 |
| `lib/askQuestions.ts` (firestore 접촉 · ⚠ `lib/ask/`에 두지 말 것) | `listAskQuestions(uid)`(⚠ `order` 없는 문서는 쿼리에서 빠진다 — dev 경고) · `createAskQuestion` · `updateAskQuestion`(rev+1) · `duplicateAskQuestion` · `deleteAskQuestion` · `ensureSeeded(uid)`(**uid별 in-flight Map** — W9) — `lib/snippets.ts:16-64` 형태 그대로 |
| `components/comment/AskListPopover.tsx` | 1단·2단·편집 모달 (prop 표면은 §5) |

### 수정

| 파일 | 변경 |
|---|---|
| `components/comment/CommentPanel.tsx` | ① `handleSendMessage(content, opts?: { modelIds?: string[]; noHistory?: boolean })` — `:721`을 `isAISession ? [...(opts?.modelIds ?? selectedModelIds)] : []`로(**대체**, 합집합 금지 — E3), `:739`를 `const { history, slots: historySlots } = opts?.noHistory ? { history: [], slots: [] } : buildHistory();`로(D15′) ② `headerLeft` flex 컨테이너 맨 앞에 `<AskListPopover>`(prop 6종) ③ `:405` `'정밀 검증'` → `'교차 검증'` ④ `onBeforeAskSend?: () => Promise<void>` prop(D12) ⑤ 문답 전송 래퍼에서 `setReplyingTo(null)`(D17) |
| `components/editor/EditorView.tsx` | `handleRunVerify`(`:3106`)의 dirty 저장 블록(`:3113-3116`)을 `ensureSavedForAI` 콜백으로 뽑아 `onBeforeAskSend`와 공유(**throw 계약 유지** — W2). **ProblemView는 안 넘긴다** |
| `components/ui/Icons.tsx` | `export const IconQuestionList = phIcon(PH.listDashes, 16);`(팩토리 `:38-43`) |
| `scripts/gen-phosphor-paths.mjs` | `listDashes` 1키(D13) → `npm run icons:gen` |
| `firestore.rules` + `tests/firestore.rules.test.mjs` | §4 블록 + **케이스 64·65**(마지막 번호가 63 — E7) |
| `package.json` | `test:ask`(⚠ **`--rootDir .` 필수** — 산출물이 `.test-build/lib/ask/`로 떨어져야 한다, E8) |
| `CLAUDE.md` · `docs/roadmap.md` | Phase 66a 절 · **로직 검증 439 → 445건**(W10) |

### 커밋

| S | 범위 | 완료 기준 |
|---|---|---|
| S1 | `lib/ask/seed.ts` + `test:ask` + 규칙 + 규칙 테스트 | `npm run test:ask`(6) · `npm run test:rules`(65) 통과 |
| S2 | `listDashes` + `IconQuestionList` | `npm run icons:check` → **`OK — 61종`** |
| S3 | `lib/askQuestions.ts` + `AskListPopover` + CommentPanel 배선(D15′·D16·D17 포함) + D1′ 개명 | 씨앗 3개 자동 생성 · 목록·수정·복제·삭제 · 전송 · **요청 바디 `discussionHistory: []`** |
| S4 | `onBeforeAskSend`(EditorView) + 실패 처리(W2) | dirty 상태 전송 → 저장 후 전송 · 저장 실패 → 안내 후 중단 |
| S5 | 문서 | — |

---

## 7. 테스트 — `tests/ask.test.mjs`

| # | 단언 |
|---|---|
| T1 | `SEED_QUESTIONS` 3개 · label 유일 · `target` 전부 `'solution'` · `order` 10/20/30 · `enabled` true · `rev` 1 |
| T2 | 셋 다 본문에 정상 문항 전제(`오류가 없고`) 포함 · G1·G2는 `빠짐없이` 포함 |
| T3 | `buildAskMessage({label:'군더더기(원문)',rev:3,text:'…'})` 첫 줄 === `[문답 검증 · 군더더기(원문) r3]` · 본문 **무변경**(치환 없음 — `$$`·`$&` 안전, `String.replace` 문자열 인자 금지 규약) |
| T4 | `nextRev(3)===4` · `nextRev(undefined)===1` |
| T5 | `validateQuestion`: 빈 label·빈 text 거부 · text 8000자 초과 거부 · 정상 통과 |
| T6 | `nextOrder([])===10` · `nextOrder([{order:10},{order:30}])===40` (D18) |

규칙 테스트(에뮬레이터): **64.** 본인 uid로 `users/{uid}/ask_questions` read/write 허용 · **65.** 다른 uid 거부.

**실물 검수**
1. agent 탭에서 G1·G2·G3를 같은 고난도 문항에 각 1회 — **같은 세션에 연달아** 보내고,
   네트워크 탭에서 **`discussionHistory: []`**·`images.history` 부재 확인(D15′). → §9 기록
2. 편집 모달로 G2 복제 → 문안 수정 → `rev` 증가 · 목록 순서(원본 바로 아래) 확인
3. **답글 화살표를 누른 상태에서** 질문 전송 → AI가 호출되는지(D17 회귀)
4. 모델 칩을 2개 켜 둔 상태에서 질문 전송 → **D14 문서 하나만** 호출되고 **칩 선택이 그대로 남는지**(E3·G7)
5. **저장 실패 경로**(W2) — 편집창에서 네트워크를 끊고 dirty 상태로 전송 → 안내가 뜨고 전송이 중단되는지
6. **재시도**(W8) — 실패한 문답을 [재시도] → 히스토리가 다시 붙지 않는지(네트워크 탭)
7. 회귀: 기존 타이핑 전송(히스토리 **정상 첨부**) · 검증 칩(라벨 '교차 검증') · 그림 첨부(61f) 무변경
8. 폰(기기 모드) agent 시트 — 질문 버튼이 **없어야** 한다(V5)

---

## 8. 덕수 준비물

### 1. 실험 전용 `ai_models` 문서 1개 생성 (콘솔, D14)

기존 Claude 문서를 복제하고 아래를 맞춘다. ⚠ **`mapDoc`(`lib/ai-models.ts:17-36`)이 읽는 필드가
v3 목록보다 넓다**(W6) — 빠지면 기본값으로 떨어지는데 그중 둘은 **조용한 고장**이다.

| 필드 | 값 | 빠지면 |
|---|---|---|
| `apiModelName` | 원본과 동일한 실제 API 모델명 | **문서 id가 모델명으로 쓰인다**(`?? id`) → 존재하지 않는 모델로 호출돼 500 |
| `provider` | `'anthropic'` | 프로바이더 분기가 깨진다 |
| `maxTokens` | **8192** (⚠ **21,333 미만** — SDK 비스트리밍 가드, V4) | 1024로 떨어져 실험 자체가 무의미 |
| `inputCostPerMillion` / `outputCostPerMillion` | **원본과 같은 값** | `calcCost`가 0 → **§9-5(비용 관측)가 통째로 죽는다**(V3) |
| `order` | 기존 Claude 문서보다 **작게** | D8 기본 선택이 실험 문서로 안 잡힌다 |
| `nickname` | 기존과 다른 한 음절(예 '문') | 닉네임 충돌 |
| `displayName` | 구별되는 이름 | 칩 라벨 혼동 |
| `enabled` | `true` | 목록에 안 뜬다 |
| `appendPrompt` | 길이·형식 완화 한두 줄<br>예: *"이 요청에서는 800자 제한과 단계 나열 금지를 적용하지 않는다. 지적을 빠짐없이 항목으로 적어라."* | D14의 목적 자체가 사라진다 |

⚠ **기존 Claude 문서를 고치지 말 것** — 타이핑 대화·다른 경로까지 함께 바뀐다.
⚠ 문서를 만든 뒤 **브라우저 새로고침** 필요(모듈 캐시 — E6).
⚠ `enabled:true`인 문서는 **모든 문항의 agent 칩 바에 칩으로 뜬다**(V2) — 전역 `ai_models`라 그렇다.
⚠ **실험이 끝나 `enabled:false`로 내려도 닉네임 예약은 남는다**(W7) —
`getReservedNicknames`가 `getAllModels`(enabled 무관, `:73-76`)를 읽는다. 1인 사용이라 무해하되 알고 둘 것.
⚠ **`appendPrompt`는 실험 중 고정**(D19) — 문안과 함께 움직이면 무엇이 작동했는지 못 가른다.

### 2. 실험 대상 문항 3~5개 선정
**군더더기가 있을 법한 고난도·긴 풀이.** 같은 문항에 세 문안을 돌려야 비교가 된다.

### 3. 규칙 배포 (`firestore.rules`) — S1 이후

---

## 9. 실험 운용 — 이 Phase가 실제로 얻으려는 것

문안 3개를 같은 문항에 돌리고(한 세션에 연달아 — D15′가 오염을 막는다) 아래 여섯을 본다.
기록은 대화 세션 자체 — 별도 표를 만들지 않는다.

1. **지적 건수와 질** — G1 대비 G2·G3가 더 찾는가, 아니면 오탐만 느는가
2. **답이 잘리는가** — 판정 방법이 있다(W5): AI 메시지 하단 비용 배지의 **`title`에 출력 토큰 수**가 있다(`:1938`).
   그 값이 `maxTokens`(8192)에 근접하면 잘린 것이고, 라우트가 미종결 코드펜스를 잘림으로 보고 제거·안내를 붙인다(`:278`).
   `appendPrompt` 완화가 먹히지 않으면 후속에서 `/api/discuss`에 시스템 프롬프트 갈래를 넣어야 한다는 신호다
3. **시스템 프롬프트의 저항** — G3가 "풀이 재작성"을 실제로 해 주는가, 아니면 결론 한 줄로 뭉개는가(E5)
4. **시간** — 특히 G3. 라운드당 몇 분인지가 폴더뷰 배치 설계의 입력값이다.
   ⚠ 한 요청 예산은 **280초**(W1) — 닿으면 500이 난다
5. **비용** — 메시지 하단 `$…`(`:1940`)를 문항당 합산 · 세션 합계(`:982`)도 함께 → 배치 예상 비용
6. **61h 정의와의 충돌** — G3가 잡는 "더 짧게 쓸 수 있는 것"을 덕수가 군더더기로 받아들이는지(§11-4)

**판정.** 셋 중 하나가 확실히 나으면 나머지를 `enabled:false`. 우열이 안 갈리면 복제해서 변형을 만든다.
어느 쪽이든 **다음 질문을 코드 없이 추가할 수 있다**는 것이 이 Phase의 산출물이다.

⚠ 61b 실측 교훈: **작은 표본으로 판본을 가리지 말 것.** 문항 3~5개의 차이는 노이즈일 수 있다 —
"이게 확실히 낫다"가 안 보이면 결론을 내리지 말고 표본을 늘린다.

---

## 10. 하지 말 것

- `/api/verify`·`lib/verify/*`·`batchVerify`·`BatchVerifyDialog`·`verification` 필드 **무접촉**.
- **검증 칩을 지우지 말 것**(§1 — 대조군). `buildContext`·`invokeOneAI`를 lib으로 빼지 말 것(66b에서).
- **`invokedIds`를 합집합으로 만들지 말 것**(E3) · **답글 분기를 그대로 통과시키지 말 것**(E2·D17).
- **문답 전송에 히스토리를 싣지 말 것**(D15′) · 반대로 **타이핑 전송의 히스토리를 끄지 말 것**(그건 대화다).
- **`onBeforeAskSend`의 throw를 삼키지 말 것**(W2) — 저장이 실패했는데 전송이 이어지면 **옛 저장본이 검증된다**.
- 질문 문안을 코드에 박지 말 것 — 씨앗(`seed.ts`)은 **최초 1회 복사본**이고 이후 진실은 Firestore다.
  씨앗을 고쳐도 이미 만들어진 문서는 바뀌지 않는다(의도).
- 꼬리(출력 형식 지시)를 코드가 붙이지 말 것 — 본문의 일부다(§4).
- **`order` 없는 문서를 만들지 말 것**(V6) — `orderBy` 쿼리에서 조용히 사라진다.
- 팝오버 래퍼에 `position:relative` 금지(`:1458-1460`) · `width:250` 리터럴 복제 금지(E10).
  네이티브 `alert/confirm` 금지(`lib/dialogs.ts`).
- **`PH.listChecks`를 재사용하지 말 것**(E1) — 교정 아이콘이고 EditorView에서 동시에 보인다.
- **기존 Claude `ai_models` 문서를 고치지 말 것**(D14) · **`maxTokens`를 21,333 이상으로 올리지 말 것**(V4) ·
  **실험 중 `appendPrompt`를 바꾸지 말 것**(D19).
- `lib/ask/seed.ts`에 import 문 금지 · `lib/askQuestions.ts`를 `lib/ask/`에 두지 말 것.
- 새 색은 토큰으로(M6 팔레트 셋).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지(push는 덕수) · roadmap 갱신 · 확정본만 `docs/phasedocs/`.

---

## 11. 구상 노트 — 이후 방향 (합의됐으나 이번 판에 넣지 않는 것)

> 브레인스토밍(2026-09-14)의 결론들. **결정이지 확정 설계가 아니다** — 1단계 실측에 따라 수치·범위가 바뀐다.

### 11-1. 66b — 폴더뷰 순차 실행

- **진입은 지금의 [일괄 검증] 버튼 하나.** 누르면 모드 선택 팝오버가 먼저 뜬다 — **교차 검증**(현 `BatchVerifyDialog` 그대로) /
  **문답 검증**(새 다이얼로그). 61d 코드는 **0** — 버튼 핸들러가 `setBatchOpen(true)` 대신 팝오버를 여는 것뿐.
- 모드 팝오버는 마지막 선택을 **기억하지 않는다**(어느 쪽이 열릴지 예측 가능해야 한다).
- 선택 바(`n개 선택`)에 버튼을 더하지 않는다 — 66 v1의 "[폴더 변경…] 뒤 [정밀 검증]"은 이 모드 선택으로 갈음.
- 문답 검증 선택 화면 = 한 화면에 셋: **문항 표**(체크박스 · 오너 아닌 행 비활성 · 프리플라이트) ·
  **검증 항목 체크**(`ask_questions`의 enabled 목록) · **의뢰 대상 모델 칩**. 하단에 라운드 수·예상 시간·비용·[시작].
- **문항 기본 체크 = 전부 해제.** 61d와 달리 "검증이 필요하다"는 신호(`verification.stale`)가 없고,
  대상이 "고른 고난도 몇 개"라 전체 체크 기본값은 사고를 부른다. [전체 선택]은 둔다.
- 실행 순서 = 문항 직렬 → 질문 직렬 → 모델 병렬. 히스토리는 없다 —
  **D15′ 덕에 1단계와 배치가 같은 갈래를 쓴다**(추출 시 `noHistory` 분기를 그대로 들고 간다).
- 여기서 비로소 `buildContext`·`invokeOneAI`의 lib 추출(66 v1의 S2)이 필요해진다.
- ⚠ 배치 설계 입력값 둘은 1단계에서만 얻을 수 있다: **라운드당 시간**(§9-4)과 **문항당 비용**(§9-5).
- 결과 요약 팝업 내용은 **미결**: 문항×질문 표에 「지적 N건」만으로 충분한지, 셀 클릭 → 해당 문항 agent 탭 이동까지 필요한지.

### 11-2. 66c — 정리

- **검증 칩 삭제** — `VerifyChips`·`VERIFY_CHAR_CAP`·`runVerify`·`PendingAIBubble`의 `kind:'verify'` 합성 갈래 ·
  `handleRetryAI`의 verify 분기(`:841-845`) · `onRunVerify`/`verifyCharCount` prop 배선
  (`EditorView:3106, 4137, 4139` · `ProblemView:341, 1282, 1284`). 폰은 `onRunVerify`를 안 넘겨 영향 0.
  `runVerifyFlow` 호출부는 `batchVerify` 하나만 남는다.
- 질문 전문이 대화에 벽으로 서는 문제(V7)가 거슬리면 여기서 접는 렌더를 넣는다.
- 삭제 시점은 **실험 종료 후**. 그때까지 칩은 대조군이다.

### 11-3. 질문 목록의 장래

- 66 v1의 문제 검증 4종(정답 대조·조건 결함·선택지·표기)과 논리 2종(줄 단위·전역)은 **후보로만** 남긴다.
  문제 질문을 넣을 때 `{answer_line}` 치환이 처음 필요해진다 —
  ⚠ **`Problem.answer`는 discuss 컨텍스트에 없다**(`buildContext`가 탭 블록만 조립한다, `:554-583`).
- **한 질문에 한 잣대** — 61b 실측(태그 7개를 한 프롬프트에 넣으면 눈에 띄는 것부터 소모하고 나머지가 묻힌다)이 근거.
  길이 자체는 문제가 아니다(입력 토큰은 싸고 빠르다). 표적 개수가 문제다.
- **제미나이 제안(2026-09-14 덕수 공유)의 소화**: 4개 렌즈 중 ①미사용 부산물은 G2에 흡수, ②우회 경로·
  ③자명한 단계 과다·④잉여 케이스는 전부 **압축 축**이라 G3의 세부. ⚠ 체크리스트 4개를 **한 프롬프트에**
  넣는 형태는 위 원칙에 어긋나 채택하지 않았다.
- **모델 고정**: 실험 중에는 D14 문서 하나로. 항목별로 다른 모델이 낫다는 실측이 나오면 질문 문서에 `preferredModelId`를 추가.
- **시스템 프롬프트 갈래**: §9-2·9-3이 "`appendPrompt`로 부족하다"로 나오면 `/api/discuss`에 `mode:'ask'` 같은 필드를 두고
  `BASE_SYSTEM_PROMPT`의 형식 규칙만 갈아끼우는 작업이 생긴다.
  ⚠ 그때 **`aiProviderParams` 스냅샷 계약**(61f D10 — 기존 요청 바이트 동일)을 먼저 확인할 것.

### 11-4. 두 축의 충돌 (기록해 둘 것)

61h(코드)의 군더더기 정의는 **"지워도 되는 것"**이고 "짧게 쓸 수 있다는 것만으로는 군더더기가 아니다"를 명시한다.
G3(압축 재작성)는 그 제외 영역을 정면으로 겨냥한다. 문답형이 그쪽에서 더 유용하다고 판명되면,
**두 정의가 갈린 채로 공존**하는 것이 맞는지(문답형 = 편집용, 61h = 검증용) 아니면 61h 쪽을 손대야 하는지 결정이 필요하다.
후자라면 그 작업은 M1 방침("61b/61h는 동결, 발전은 audition에서")에 걸린다.

---

## 부록 A. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| 66 v1 | web | 전체 구상 — 질문 9종 · 폴더뷰 배치 · D1~D19 |
| 66a v1 | web | 1단계로 축소 — 칩 유지·lib 추출 유예·질문 3개·Firestore 편집 구조 · D1~D12 |
| 66a v2 | CLI 실측 | 정정 10(E1~E10) · 보완 8(G1~G8) · D1′·D13~D18 · S1~S5 · T6 · 규칙 64·65 |
| 66a v3 | web 재검증 | **역정정 9(C1~C9)** · 보완 10(V1~V10) · **D15 → D15′** |
| **66a v4** | **CLI 실측 (2026-09-14)** | **v3 역정정 9건 전수 확인(전부 사실) · v3 신규 인용 12건 확인 · 신규 보완 12(W1~W12) · D19 신설 · prop 표면·busy·실패 계약 명문화 · 착수 가능** |

## 부록 B. v3 역정정 재확인 — **9건 전부 사실**

| v3 | 실측 | 판정 |
|---|---|---|
| **C1** `math_snippets`는 **30-32**(v2의 29-31이 오류) | `grep -n` → `match` 30 · `allow` 31 · `}` 32 | ✓ v3 옳음 · **v2가 틀렸다** |
| **C2** 단계 나열 금지 = `:101`(v2의 102는 일반론 서론) | `:101` 단계 나열 · `:102` 일반론 서론 | ✓ |
| **C3** `appendPrompt`가 맨 뒤는 아니다 | `:241-243` 뒤 `:245` `STRUCTURED_OUTPUT_INSTRUCTION` | ✓ (DeepSeek 전용 — Claude 경로에선 실질 맨 뒤) |
| **C4** AI 댓글 규칙 `:262-268` + `resolved == false` | `:264` authorType · `:265` `^ai:.*` · `:267` `isOwnerCmt()` · `comments.ts:101` `resolved:false` | ✓ |
| **C5** dirty 가드 `:3113-3116` | `if (dirty)` 3113 · `handleSave(true)` 3114 · `lastSaveOkRef` 3115 · `}` 3116 | ✓ |
| **C6** `phIcon` 팩토리 `:38-43` | `function phIcon` = 38 | ✓ |
| **C7** 답글 `:689` · 댓글 `:703-712` · 세션 `:715-718` · `setSelectedModelIds([])` `:822` | grep 전부 일치(v2의 686·701·714·821이 오류) | ✓ |
| **C8** discuss catch `:600` · 500 반환 `:603-606` | `} catch (e)` 600 · `NextResponse.json(..., {status:500})` 603-606 | ✓ |
| **C9** `list-dashes` 근거를 `phosphor-ko.json`으로 | `"list-dashes"` 1건 실재 · `node_modules`는 환경 의존 | ✓ 방법론까지 옳다 |

**v3가 새로 인용한 행 12개도 전부 확인했다**: `ai-models.ts:13-14, 24, 50-58, 73` · `CommentEditor.tsx:51, 236` ·
`SelectionInsertPopup.tsx:291` · `PhoneApp.tsx:392`(`panelSlot('agent', false)`) · `CommentPanel.tsx:669, 739, 1940` ·
`dialogStyles.ts:79`. **어긋난 것 0.**

## 부록 C. v4 신규 보완 (W1~W12)

| # | 내용 |
|---|---|
| **W1** | **라우트 시간 예산을 아무도 확인하지 않았다** — v3는 `maxTokens`를 1024 → 8192로 **8배** 올리면서 시간을 한 줄도 보지 않았다. 실측: `maxDuration = 300`(`route.ts:19`) · `TIMEOUT_MS = 280_000`(`:58`)이고 `provider.complete`가 그 안에서 돈다(`:570-579`). **문답은 1요청이라 61b가 2요청으로 쪼갠 이유(300초)에 걸리지 않는다** — 결론은 "안전"이지만 근거 없이 안전했던 것이라 §2-5·§9-4에 못 박는다 |
| **W2** | **`onBeforeAskSend`의 실패 신호가 정의되지 않았다** — v3가 반환형을 `Promise<void>`로 바꿨는데, 물려받는 EditorView 경로는 **throw로 실패를 알린다**(`:3115` `throw new Error('저장에 실패해 검증을 중단했습니다')`). void면 팝오버가 catch해야 하고, 안 잡으면 unhandled rejection으로 **전송도 안 되고 안내도 없는** 상태가 된다. 계약: **throw → `alertDialog` → 중단, 팝오버는 열어 둔다**. 검수 항목 5 신설 |
| **W3** | **`AskListPopover`의 prop 표면이 없었다** — D16(해석된 모델 ≥1)에는 `models`가, D4(씨앗)·CRUD에는 `uid`가, busy 판정에는 `pendingAI` 파생값이 필요하다. 6종을 §5에 명시 |
| **W4** | **busy의 정의가 없었다** — D16이 "진행 중 아님"이라고만 했다. `pendingAI.some(p => p.sessionId === activeSessionId && !p.error)`. 없으면 연타로 같은 질문이 두 번 나가고 비용이 두 배가 된다 |
| **W5** | **"답이 잘리는가"(§9-2)의 관측 방법이 없었다** — AI 메시지 하단 비용 배지의 `title`에 **출력 토큰 수**가 있다(`:1938`). `maxTokens`에 근접하면 잘린 것이고, 라우트가 미종결 펜스를 잘림으로 보고 제거·안내를 붙인다(`:278`). 측정 가능한 절차로 바꿨다 |
| **W6** | **D14 문서 필드 체크리스트가 좁았다** — v3는 5개만 적었으나 `mapDoc`(`ai-models.ts:17-36`)은 9개를 읽는다. 특히 ① **`apiModelName`이 없으면 문서 id가 모델명으로 쓰여**(`?? id`) 존재하지 않는 모델로 호출돼 500 ② **`order`가 D8 기본 선택을 좌우**하므로 기존 Claude보다 작아야 한다. §8을 표로 재작성 |
| **W7** | **`enabled:false`로 내려도 닉네임 예약은 남는다** — `getReservedNicknames`가 `getAllModels`(enabled 무관, `:73-76`)를 읽는다. 1인 사용이라 무해하되 "실험 후 비활성"이 완전한 원복이 아님을 알고 둘 것 |
| **W8** | **재시도가 D15′를 보존한다** — `retryContext`(`:669`)가 `discussionHistory: []`를 그대로 들고 있고 `handleRetryAI`가 그것을 재사용한다(`:857`). 실패한 문답을 재시도해도 히스토리가 다시 붙지 않는다. G2(재시도 공짜)와 D15′가 충돌하지 않는다는 확인 — 검수 항목 6 |
| **W9** | **`ensureSeeded`의 실패·계정 전환** — 규칙 미배포 상태에서 팝오버를 열면 permission-denied다. 빈 목록 + 안내로 흘리고 크래시 금지. in-flight 싱글턴은 **uid별 Map**으로(전역 하나면 계정 전환 시 남의 약속을 재사용한다) |
| **W10** | **하니스 총계가 빠졌다** — 현재 로직 검증 **439건**(M7 기준)이고 `test:ask` 6으로 **445건**. 규칙 테스트는 63 → 65. CLAUDE.md·roadmap 갱신 시 이 수를 적을 것 |
| **W11** | **D1′ 개명은 옛 리포트에도 소급된다** — `:405`는 `modelId === 'verify'`일 때 `modelDisplayName`을 **렌더 시** 정한다(저장된 것은 modelId뿐). 과거 리포트 표시도 함께 '교차 검증'이 된다 — **데이터 무접촉이고 의도된 결과**지만 검수 때 놀라지 않게 적어 둔다 |
| **W12** | **실험 변수가 둘이 될 뻔했다** — 씨앗 G1·G2 꼬리의 "답변 길이 제한보다 빠짐없이"와 D14 `appendPrompt`의 완화 문구가 같은 일을 한다. 둘 다 움직이면 §9 판정에서 무엇이 작동했는지 못 가른다 → **D19: `appendPrompt`는 통제 변수, 문안만 변수** |

---

*v4 — 착수 가능. 덕수 준비물은 §8(콘솔 문서 1건 + 문항 선정 + 규칙 배포). 서버·프롬프트·61b/61d/61h 코드 변경 0.*
