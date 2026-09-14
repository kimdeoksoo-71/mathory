# Phase 66a — 문답 검증 1단계: agent 탭 질문 리스트 구현 계획서 v2

작성일: 2026-09-14 · 작성: **CLI 실측 교차검토** · 기준 커밋: **mathory `origin/main 9061cf9`**
계보: 덕수 스케치 → Phase 66 v1(전체 구상) → 브레인스토밍 → 66a v1(web) → **66a v2 = CLI 실측판**
(부록 C가 v1 정정 10건 · 보완 8건)
착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 요약

agent 대화창 입력 상단에 **질문 리스트 버튼**을 달고, 거기서 고른 검증 질문을 선택한 AI에게 보낸다.
질문 문안은 `users/{uid}/ask_questions`에 살며 **앱 안에서 추가·수정·복제·삭제**한다.

**이번 판의 목적은 기능 완성이 아니라 실험이다.** 어떤 질문 문안이 좋은 답을 내는지는 써 보기 전에는 모른다 —
그래서 질문 3개를 씨앗으로 넣고, 문안을 고치는 왕복이 배포 없이 도는 구조를 먼저 만든다.

**서버 0 · 프롬프트(`lib/verify/prompts.ts`) 0 · 61b/61d/61h 코드 0 · 문항 스키마 0 · 렌더 5사이트 0.**
Firestore 규칙 **1블록 추가**(기존 `math_snippets` 문법 그대로) · 신규 3파일 · 기존 4파일 수정 ·
**ICONS 60 → 61종**(v1의 "무변경"은 정정 — E1).

⚠ **v1과 달라진 것 중 실험 성패를 가르는 둘**:
- **E2 답글 모드 가드** — 없으면 전송이 조용히 답글로 저장되고 AI가 0회 호출된다.
- **G5 히스토리 오염** — 같은 세션에서 질문 2개를 연달아 보내면 앞 답이 뒤 질문의 히스토리로 들어간다.
  세 문안의 비교가 **성립하지 않는다**. → 질문 1개 = 세션 1개(D15).

---

## 1. 범위 — 무엇을 **안** 하는가, 그리고 왜

| 항목 | 66 v1 | 66a | 이유 |
|---|---|---|---|
| [문제 검증]·[풀이 검증] 칩 | 삭제 | **남긴다** | 지금 그 칩이 **대조군**이다. 같은 문항에서 칩은 "이상 없음", 질문은 "지적 3건"이 나오는 비교가 이번 실험의 판정 근거다. 삭제는 실험이 끝난 뒤 마지막 정리 커밋(66c) |
| `buildContext`·`invokeOneAI` lib 추출 | S2(최대 위험 커밋) | **안 한다** | 추출이 필요한 이유는 폴더뷰 배치가 CommentPanel 밖에서 같은 조립을 써야 하기 때문. agent 탭 안에서만 쓰는 동안은 현재 자리 그대로가 맞다 |
| 폴더뷰 순차 실행 | 포함 | **안 한다** | 예상 시간·비용·중단 정책이 전부 추정치다. 1단계 실사용으로 실측한 뒤 설계한다 |
| 문제 검증 질문 4종·논리 질문 2종 | 목록에 포함 | **안 넣는다** | 추측이다. 씨앗은 군더더기 3개뿐이고 나머지는 앱 안에서 추가한다 |
| 결과 요약 팝업·`verification` 배지 | 포함 | **안 한다** | 답은 세션 메시지로 남는다. 대화 기록이 곧 실험 로그 |
| 컨텍스트 길이 사전 경고 | — | **안 한다**(G6) | 검증 칩의 `verifyCharCount`는 검증 셈법이라 재사용이 어긋난다. 1단계는 dev 콘솔 `console.warn`로 본다 |

**남는 것.** 질문 컬렉션 + 씨앗 3개 + 리스트 팝오버(선택·수정·복제·삭제) + 전송.

---

## 2. 확정 사실 (origin/main `9061cf9` 실측 — 행 번호는 이 커밋 기준)

### 2-1. 전송 경로는 이미 있다 — 바꿀 것은 `content`와 모델 목록뿐

`handleSendMessage`(`CommentPanel.tsx:680-787`)가
답글 분기(`:686-699`) → 댓글 모드 분기(`:701-711`) → 세션 가드(`:714-717`) →
`invokedIds = isAISession ? [...selectedModelIds] : []`(`:721`) → 사람 메시지 저장(`:726-733`) →
`if (invokedIds.length === 0) return`(`:735`) → `buildContext`(`:554-582`) → `buildHistory`(`:585-615`) →
`Promise.allSettled(invokedModels.map(invokeOneAI))`(`:784-786`).

`CommentEditor.onSubmit` 타입은 `(content: string) => Promise<void>`(`CommentEditor.tsx:26`)이므로
**두 번째 매개변수를 옵셔널로 더해도 계약이 깨지지 않는다.**

→ 질문 전송 = `handleSendMessage(문안, modelIds)`. **새 요청 형식·새 라우트 0.**

⚠ **그 경로의 앞머리 두 분기가 v1 설계의 구멍이다**:
- `replyingTo`가 켜져 있으면 `:686`에서 답글로 저장하고 **`return`** — AI 0회(E2·D17).
- `invokedIds`는 `selectedModelIds`를 읽으므로 override는 **대체**여야 한다. 합집합이면 칩으로 켜 둔
  다른 모델까지 같은 질문을 받아 비용이 배로 든다(E3).

⚠ **`runVerify`(`:807-835`)는 실행과 함께 `setSelectedModelIds([])`를 한다**(`:821` — "고른 AI로 검증한다"는
오해 차단). 문답 전송은 **칩 선택을 건드리지 않는다** — override로 자기 모델을 따로 들고 가므로
칩은 타이핑 대화용으로 그대로 남는 것이 맞다.

### 2-2. 사용자별 편집 가능 컬렉션의 전례가 있다 — `math_snippets`

- 규칙(`firestore.rules:29-31`):
  ```
  match /math_snippets/{snippetId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```
- CRUD(`lib/snippets.ts:16-64`): `collection(db,'users',userId,'math_snippets')` · `listSnippets`(orderBy) ·
  `createSnippet`(addDoc + `serverTimestamp()`) · `updateSnippet` · `deleteSnippet`.
- 타입은 `types/snippet.ts`(`MathSnippet` — `created_at`/`updated_at`을 `Date`로 변환해 내보낸다).

→ `ask_questions`는 이 두 파일을 **형태 그대로** 복제한다. 규칙은 같은 `match /users/{userId}` 블록 안에 3줄 추가 —
설계할 것이 없다. ⚠ `orderBy('order')` 단일 필드라 **복합 인덱스도 필요 없다.**
⚠ **스니펫 관리 UI는 이 저장소에 없다**(`listSnippets` 소비처가 에디터 단축키뿐) — 편집 모달은 베낄 전례가 없고
`dialogStyles` 규격으로 새로 만든다.

### 2-3. 상단 바에 자리가 있다 (단, 좁다)

`headerLeft`(`CommentPanel.tsx:1156-1180`)는 `flex; flexWrap: wrap; gap 6` 컨테이너에
`AIChipBar`(전폭 div, `:1384`) + `VerifyChips`(`:1439`).
- ⚠ `:1157-1158` 주석 — fragment로 나란히 두면 아랫줄로 밀린다. 기존 flex 컨테이너 **안**에 넣을 것.
- ⚠ `:1458-1460` — 칩 래퍼에 `position:relative`를 두면 팝오버 기준이 칩 묶음이 되어 패널 밖으로 넘친다.
- **팝오버 기준 상자는 컴포저 래퍼 `:1100-1103`**(`padding:'10px 16px 12px'` + `position:'relative'`)다.
  `CommentEditor` 루트(`:215-217`)는 positioned가 아니라 중간에 기준이 끼지 않는다 — v1 서술 확인.
  ⚠ 패널 기본 폭 420에서 래퍼 내부 폭은 388이므로 **`width:250` 리터럴을 베끼지 말고 `left:0; right:0`**
  로 래퍼 폭을 그대로 쓸 것(E10).

게이트 재료도 이미 있다: `currentUid`·`ownerUid` prop(`:67,70`), `isAISession`(`:359`), `activeSessionId`.

**칩을 남긴 채 버튼을 하나 더 얹으므로 상단 바가 두 줄이 될 수 있다.** 실측 후 필요하면 아이콘 단독으로 (D10).

### 2-4. 아이콘은 한 키를 늘려야 한다 (v1 정정 — E1)

`PH.listChecks`는 이미 **`ProofreadIcon`(교정)**이 쓰고 있다(`scripts/gen-phosphor-paths.mjs:78` 주석 ·
`UnifiedToolbar.tsx:83`). EditorView에서는 Row 2 툴바와 agent 드로어가 **동시에 화면에 있으므로**
같은 글리프가 두 뜻을 갖는다. → ICONS에 한 줄 추가:

```
listDashes: ['list-dashes', 'regular'],   // IconQuestionList — 문답 검증 질문 목록 (66a)
```
`node_modules/@phosphor-icons/core/assets/regular/list-dashes.svg` 존재 확인.
`npm run icons:gen` 후 **빌드 로그가 `[icons:check] OK — 61종`**이어야 한다(현재 60종).
`Icons.tsx`에는 `export const IconQuestionList = phIcon(PH.listDashes, 16);` 한 줄(팩토리는 `:37-42`).

### 2-5. 알고 쓰는 제약 (v1 표를 실측으로 교정)

| 제약 | 근거 | 대응 |
|---|---|---|
| **답변 규칙은 길이만이 아니다** — 800자(고난도 1200자) **+ "단계 나열(1./2./3. 번호로 풀이 재작성)" 금지 + "장황한 사고 과정 서술은 응답이 무효 처리되는 사유"** | `BASE_SYSTEM_PROMPT` `route.ts:88,98-104` | 질문 본문 한 줄로는 **시스템 프롬프트를 못 이긴다**. 레버는 `appendPrompt` → **D14**(실험용 모델 문서) |
| `ai_models.maxTokens` 기본 **1024** | `lib/ai-models.ts:25` · `route.ts:571`이 `config.maxTokens`를 그대로 넘긴다 | 지적이 길면 잘린다. D14에서 8192 |
| `getEnabledModels`는 **모듈 캐시** | `lib/ai-models.ts:14,52-61` | 콘솔에서 문서를 고쳐도 **새로고침 전까지 반영 0**. 준비물에 명시(E6) |
| `appendPrompt`는 시스템 프롬프트 **맨 뒤** | `route.ts:241-243`(`[추가 지침] …`) | 뒤에 오는 지시라 앞 규칙을 완화하는 자리로 쓸 수 있다 |
| `/api/discuss` 무인증·500 일괄 | `route.ts` 전역 · `:598-606` | 1단계는 단건 수동 실행이라 중단 정책이 필요 없다 |
| 컨텍스트 15,000자 자름 | `CommentPanel.tsx:553,568-573`(`console.warn`만) | 긴 문항은 풀이 뒷부분이 조용히 잘린다 — dev 콘솔로 확인(G6) |
| **히스토리 최근 5개가 딸려간다** | `HISTORY_LIMIT = 5`(`:33`) · `buildHistory` `:600` | **같은 세션에 질문 둘을 보내면 비교가 오염된다** → D15 |
| 리포트 라벨이 '정밀 검증' | `CommentPanel.tsx:405` | **61b UI만 '교차 검증'으로 개명**, 새 기능은 **'문답 검증'**(D1′ — v1의 이름 교체를 절반만 수용) |
| 비용은 **메시지마다** 이미 보인다 | `:1931-1940`(`$0.00123` + 토큰 title) · 세션 합계 `:970-982` | §9-4를 메시지 단위로 읽으면 된다 |
| 질문 본문은 `currentMessage` 별도 필드 | `invokeOneAI` `:632` | 질문이 길어도 `CONTEXT_CHAR_CAP`(탭 블록만 셈)을 잡아먹지 않는다(G4) |
| 재시도가 공짜로 따라온다 | `handleRetryAI` `:838-848` + `retryContext` `:672` | 문답도 일반 모델 경로라 실패 시 [재시도] 버블이 그대로 동작(G2) |

---

## 3. 결정표 (v2)

| # | 결정 | 근거 |
|---|---|---|
| **D1′** | **새 기능 = '문답 검증'** · 61b UI 라벨만 `'정밀 검증'` → **`'교차 검증'`**(`:405`) | v1은 새 기능에 '정밀 검증'을 주려 했다. 그 낱말은 CLAUDE.md 12곳·roadmap 10곳에서 **61b/61d/61h 파이프라인**을 가리킨다 — 뒤집으면 기존 문서 전부가 오독된다. 61b는 스스로도 "두 모델로 교차검증합니다"(`:1509`)라 UI 개명은 정확해지는 방향이다 |
| **D2** | 질문 저장 = `users/{uid}/ask_questions` | 2-2. 전역 컬렉션이면 "누가 쓰나" 규칙을 새로 설계해야 한다. 사용자 하위면 규칙 3줄 |
| **D3** | 문서 스키마 `{ label, target, text, order, enabled, rev, created_at, updated_at }` | `target: 'problem'|'solution'`은 **저장만**(1단계 UI에선 그룹 라벨로만 보인다 — 씨앗 3개가 전부 solution) |
| **D4** | 컬렉션이 비어 있으면 **씨앗 3개 자동 생성** — 트리거는 **팝오버 첫 열기**(패널 마운트 아님) | 패널은 EditorView·ProblemView·PhoneApp에서 마운트된다. 마운트 훅이면 문항을 열 때마다 읽기가 돈다. **모듈 in-flight 싱글턴**으로 중복 생성 차단(G1) |
| **D5** | 편집 UI는 **팝오버 안에** — 행 ⋮ → 수정·복제·삭제, 하단 [+ 새 질문] | 문안을 고치고 싶어지는 순간은 시원찮은 답을 본 직후, 그 화면에서다 |
| **D6** | **복제가 1급 기능** | 실험은 "G2를 조금 바꿔 G2b를 만들고 같은 문항에 둘 다 돌린다". 복제가 없으면 원본을 덮어써 비교 대상이 사라진다. 쓸모없어진 판본은 `enabled:false`로 |
| **D7** | 저장 시 `rev` 자동 +1 · 전송 메시지 **첫 줄에 `[문답 검증 · {label} r{rev}]`** | 대화 기록이 실험 로그가 된다. 모델도 그 줄을 보지만 무해 |
| **D8** | 모델은 **D14 실험용 문서 기본 선택**, 변경 가능 | 문안을 비교하려면 모델이 고정 변수여야 한다. `provider==='anthropic'`인 첫 모델을 폴백으로 |
| **D9** | 선택 기억 = `localStorage['mathory.ask.v1'] = { modelIds }`, try/catch | 질문은 매번 고르는 것이 맞다(그게 목적). 모델만 기억. 키 문법은 기존 `mathory.listPrefs.*` 전례 |
| **D10** | 버튼 위치 = `headerLeft`의 **기존 flex 컨테이너 맨 앞**, 라벨 `[≡ 질문]` | 2-3. 두 줄로 밀리면 아이콘 단독으로 축소 |
| **D11** | 치환 **없음** | 씨앗 3개가 전부 풀이 대상이라 `{answer}`가 필요 없다. 치환은 문제 질문을 넣을 때(66b) |
| **D12** | 전송 시 편집창이면 **저장 먼저** | discuss 컨텍스트는 Firestore 저장본을 읽는다(`fetchTabBlocksForModel`). 61b 칩의 dirty 가드(`EditorView.tsx:3111-3115` — `handleSave(true)` 후 `lastSaveOkRef` 확인)를 **같은 방식으로** 물려받는다. **열람뷰는 해당 없음** |
| **D13** | ICONS에 `listDashes` 1키 추가(60 → **61종**) | 2-4. `listChecks`는 교정 아이콘이고 EditorView에서 동시에 보인다 |
| **D14** | **실험 전용 `ai_models` 문서 1개**(Claude 복제 · `maxTokens 8192` · `appendPrompt`로 길이·형식 완화) — 콘솔 작업, **코드 0** | 2-5. 800자·"단계 나열 금지"·"장황하면 무효"는 **시스템 프롬프트**에 있다. 유저 메시지의 "빠짐없이"로는 못 이긴다. 기존 Claude 문서를 고치면 타이핑 대화·다른 경로까지 같이 바뀐다 → 별 문서로 격리 |
| **D15** | **질문 1개 = 세션 1개** (팝오버 2단에 안내 한 줄) | 2-5. `HISTORY_LIMIT 5`가 앞 답을 뒤 질문에 실어 보낸다 → G1 답이 G2 답을 오염시켜 **문안 비교가 성립하지 않는다**. 1단계는 세션 생성을 자동화하지 않는다(수동이 명시적이라 더 안전) |
| **D16** | [보내기] 활성 조건 = **해석된 모델 ≥ 1** ∧ `activeSessionId` ∧ 진행 중 아님 | `invokedModels`는 `aiModels.find`로 해석되므로(`:722-724`) 사라진/비활성 modelId가 저장돼 있으면 **사람 메시지만 저장되고 AI 0회**가 된다(E4) |
| **D17** | 전송 직전 `setReplyingTo(null)` + 문답 경로는 답글 분기를 **타지 않는다** | E2. 답글 모드에서 보내면 조용히 답글로 저장되고 끝난다 |
| **D18** | `createAskQuestion`의 `order` = 현재 최대 + 10 · 복제는 원본 `order + 1` | 수동 번호 관리 없이 끝에 붙고, 복제본은 원본 바로 아래에 선다 |

---

## 4. 데이터 모델

```
users/{uid}/ask_questions/{qid}
  label       string   '군더더기(원문)'          // 리스트 표시 · 메시지 첫 줄 라벨
  target      'problem' | 'solution'
  text        string   // 질문 본문 (꼬리 포함 — 꼬리도 실험 변수라 본문에 둔다)
  order       number
  enabled     boolean
  rev         number   // 저장할 때마다 +1
  created_at / updated_at   serverTimestamp
```

규칙 — `firestore.rules`의 `match /users/{userId}` 블록 안, `toolbar_config` 아래에 추가:
```
// 문답 검증 질문(Phase 66a): 본인만
match /ask_questions/{qid} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

⚠ **꼬리를 코드가 붙이지 않는다** — 66 v1은 `ASK_TAIL`을 코드 상수로 뒀지만, 출력 형식 지시야말로
"답이 잘리는가"를 가르는 실험 변수다. 본문에 포함시켜 문안과 함께 고칠 수 있게 한다.

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

⚠ **G3는 시스템 프롬프트와 정면으로 부딪힌다** (v1이 놓친 것 — E5). `BASE_SYSTEM_PROMPT`가
"**단계 나열(1./2./3.… 번호로 풀이 재작성) 금지**"(`route.ts:102`)와 "장황한 사고 과정 서술은
**응답이 무효 처리되는 사유**"(`:88`)를 못 박는데, G3가 요구하는 것이 정확히 **풀이 재작성**이다.
D14의 `appendPrompt` 없이 G3를 돌리면 측정 대상이 "문안의 질"이 아니라 "시스템 프롬프트의 저항"이 된다.
출력이 가장 길어 `maxTokens`·시간·비용도 셋 다 G1·G2보다 크다 — §9의 관측 대상.

---

## 5. UX

**버튼.** `headerLeft`의 기존 flex 컨테이너 맨 앞에 `[≡ 질문]`. 게이트 = `isAISession && currentUid === ownerUid`
(AI 답 저장이 오너 전용이라 — `firestore.rules:260-266`). 숨김 사유는 dev 콘솔에 남긴다(CLAUDE.md 규약 ·
61b의 `[Phase61b] 검증 칩 숨김: …` 문법).

**팝오버 1단 — 목록.** 입력창 위에 뜬다(`VerifyChips` 팝오버 문법 `:1488-1526` 재사용:
`position:absolute; bottom:calc(100% + 6px)`) — 단 **`left:0; right:0`**(E10) · `maxHeight 320` + `overflowY:auto` ·
`zIndex 20`.
- 행 = `{label} r{rev}` + 본문 첫 줄 회색 미리보기 + ⋮
- 행 클릭 → 2단. ⋮ → 수정 · 복제 · 삭제(`confirmDialog({ message, danger:true })`) · 사용 여부 토글
- 하단 [+ 새 질문]
- `enabled:false`는 목록 맨 아래에 흐리게(완전히 숨기면 되살릴 길이 없다)

**팝오버 2단 — 전송.** 질문 라벨 · 모델 칩(기본 D14 문서) · **"질문마다 새 세션을 쓰세요 — 앞 답이
히스토리로 딸려갑니다"** 한 줄(D15) · [취소] [보내기].
[보내기] 활성 조건은 D16. 누르면 → (편집창이고 dirty면 저장 먼저, D12) → 팝오버 닫힘 →
`setReplyingTo(null)`(D17) → `handleSendMessage(전송문, modelIds)`.
사람 메시지가 대화에 뜨고 `PendingAIBubble`이 모델 수만큼(실패 시 [재시도]도 그대로 — G2).
입력창의 미완성 텍스트는 건드리지 않는다.

**편집 모달.** `dialogStyles` 규격(`dialogOverlay`·`dialogBody`·`dialogHead`(57)·`dialogContent`·`dialogFoot`·`dialogBtn`).
라벨(1줄) · 대상(문제/해설 셀렉트) · 본문(textarea, 12줄 이상) · 사용 여부 · [취소] [저장].
저장 시 `rev+1`. 복제는 `label + ' 사본'` · `rev 1` · `order = 원본+1`(D18)로 새 문서를 만들고 곧바로 편집 모달을 연다.
⚠ 모달은 `Z_DIALOG 10500`이라 팝오버(20) 위에 뜬다 — 팝오버를 닫지 않아도 된다.

**전송문 조립** = `[문답 검증 · {label} r{rev}]\n\n{text}` (D7).

---

## 6. 구현 항목

### 신규

| 파일 | 내용 |
|---|---|
| `lib/ask/seed.ts` (**import 0**) | `AskQuestion` 타입 · `SEED_QUESTIONS`(§4 셋) · `ASK_LABEL_PREFIX = '문답 검증'` · `buildAskMessage(q)` · `nextRev(n)` · `nextOrder(list)` · `validateQuestion(q)` — `npm run test:ask`가 단독 컴파일 |
| `lib/askQuestions.ts` (firestore 접촉 · ⚠ `lib/ask/`에 두지 말 것) | `listAskQuestions(uid)` · `createAskQuestion` · `updateAskQuestion`(rev+1) · `duplicateAskQuestion` · `deleteAskQuestion` · `ensureSeeded(uid)`(모듈 in-flight 싱글턴 — G1) — `lib/snippets.ts:16-64` 형태 그대로 |
| `components/comment/AskListPopover.tsx` | 1단·2단·편집 모달 |

### 수정

| 파일 | 변경 |
|---|---|
| `components/comment/CommentPanel.tsx` | ① `handleSendMessage(content, modelIdsOverride?: string[])` — `:721`을 `isAISession ? [...(modelIdsOverride ?? selectedModelIds)] : []`로(**대체**, 합집합 금지 — E3) ② `headerLeft` flex 컨테이너 맨 앞에 `<AskListPopover>` ③ `:405` `'정밀 검증'` → `'교차 검증'`(D1′) ④ `onBeforeAskSend?: () => Promise<boolean>` prop(D12) ⑤ 문답 전송 래퍼에서 `setReplyingTo(null)`(D17) |
| `components/editor/EditorView.tsx` | `onBeforeAskSend`로 dirty 저장 경로를 넘긴다(`:3111-3115` 로직을 작은 콜백으로 뽑아 `handleRunVerify`와 공유). **ProblemView는 안 넘긴다** |
| `components/ui/Icons.tsx` | `IconQuestionList = phIcon(PH.listDashes, 16)` |
| `scripts/gen-phosphor-paths.mjs` | `listDashes` 1키(D13) → `npm run icons:gen` |
| `firestore.rules` + `tests/firestore.rules.test.mjs` | §4 블록 + **케이스 64·65**(현재 63까지 — E7) |
| `package.json` | `test:ask` (⚠ `--rootDir .` 필수 — 산출물이 `.test-build/lib/ask/`로 떨어져야 한다, E8) |
| `CLAUDE.md` · `docs/roadmap.md` | Phase 66a 절 |

### 커밋

| S | 범위 | 완료 기준 |
|---|---|---|
| S1 | `lib/ask/seed.ts` + `test:ask` + 규칙 + 규칙 테스트 | `npm run test:ask` · `npm run test:rules` 통과 |
| S2 | `listDashes` + `IconQuestionList` | `npm run icons:check` → **`OK — 61종`** |
| S3 | `lib/askQuestions.ts` + `AskListPopover` + CommentPanel 배선 + D1′ 개명 | 씨앗 3개 자동 생성 · 목록·수정·복제·삭제 · 전송 · 답글 모드에서도 AI 호출됨(D17) |
| S4 | `onBeforeAskSend`(EditorView) | 편집창에서 dirty 상태로 전송 → 저장 후 전송 |
| S5 | 문서 | — |

---

## 7. 테스트 — `tests/ask.test.mjs`

| # | 단언 |
|---|---|
| T1 | `SEED_QUESTIONS` 3개 · label 유일 · `target` 전부 `'solution'` · `order` 10/20/30 · `enabled` true · `rev` 1 |
| T2 | 셋 다 본문에 정상 문항 전제(`오류가 없고`) 포함 · G1·G2는 `빠짐없이` 포함 |
| T3 | `buildAskMessage({label:'군더더기(원문)',rev:3,text:'…'})` 첫 줄 === `[문답 검증 · 군더더기(원문) r3]` · 본문은 **무변경**(치환 없음 — `$$`·`$&` 안전. `String.replace` 금지 규약) |
| T4 | `nextRev(3)===4` · `nextRev(undefined)===1` |
| T5 | `validateQuestion`: 빈 label·빈 text 거부 · text 8000자 초과 거부 · 정상 통과 |
| T6 | `nextOrder([])===10` · `nextOrder([{order:10},{order:30}])===40` (D18) |

규칙 테스트(에뮬레이터): **64.** 본인 uid로 `users/{uid}/ask_questions` read/write 허용 · **65.** 다른 uid 거부.

**실물 검수**
1. agent 탭에서 G1·G2·G3를 같은 고난도 문항에 각 1회 — **질문마다 새 세션**(D15) → §9 기록
2. 편집 모달로 G2 복제 → 문안 수정 → `rev` 증가 확인
3. **답글 화살표를 누른 상태에서** 질문 전송 → AI가 호출되는지(D17 회귀)
4. 모델 칩을 2개 켜 둔 상태에서 질문 전송 → **D14 문서 하나만** 호출되는지(E3 회귀)
5. 회귀: 기존 타이핑 전송 · 재시도 · 검증 칩(라벨이 '교차 검증'으로) · 그림 첨부(61f) 무변경

---

## 8. 덕수 준비물

1. **실험 전용 `ai_models` 문서 1개 생성**(콘솔, D14) — 기존 Claude 문서를 복제하고
   - `maxTokens`: **8192**
   - `nickname`: 기존과 다른 한 음절(예약어 충돌 방지 — `getReservedNicknames`)
   - `appendPrompt`: 길이·형식 완화 문장 한두 줄
     (예: *"이 요청에서는 800자 제한과 단계 나열 금지를 적용하지 않는다. 지적을 빠짐없이 항목으로 적어라."*)
   - `enabled`: true
   ⚠ **기존 Claude 문서를 고치지 말 것** — 타이핑 대화·다른 경로까지 함께 바뀐다.
   ⚠ 문서를 만든 뒤 **브라우저 새로고침** 필요(모듈 캐시 — E6).
2. 실험 대상 문항 3~5개 선정 — **군더더기가 있을 법한 고난도·긴 풀이**. 같은 문항에 세 문안을 돌려야 비교가 된다.
3. 규칙 배포(`firestore.rules`) — S1 이후.

---

## 9. 실험 운용 — 이 Phase가 실제로 얻으려는 것

문안 3개를 같은 문항에 **각각 새 세션으로** 돌리고 다음 여섯 가지를 본다.
(기록은 대화 세션 자체 — 별도 표를 만들지 않는다)

1. **지적 건수와 질** — G1 대비 G2·G3가 더 찾는가, 아니면 오탐만 느는가
2. **답이 잘리는가** — `maxTokens 8192` + `appendPrompt` 완화가 실제로 먹히는지.
   안 먹히면 후속에서 `/api/discuss`에 시스템 프롬프트 갈래를 넣어야 한다는 신호다
3. **시스템 프롬프트의 저항** — G3가 "풀이 재작성"을 실제로 해 주는가, 아니면 결론 한 줄로 뭉개는가(E5)
4. **시간** — 특히 G3. 라운드당 몇 분인지가 폴더뷰 배치 설계의 입력값이다
5. **비용** — AI 메시지 하단의 `$…`(`:1940`)를 문항당 합산 → 배치 예상 비용 산정
6. **61h 정의와의 충돌** — G3가 잡는 "더 짧게 쓸 수 있는 것"을 덕수가 군더더기로 받아들이는지.
   받아들이면 61h 정의(`prompts.ts` 군더더기 [4] "문체·길이 자체는 아니다")와 문답형의 정의가 갈리는 것이고, 그 사실을 기록해야 한다

**판정.** 셋 중 하나가 확실히 나으면 나머지를 `enabled:false`. 우열이 안 갈리면 복제해서 변형을 만든다.
어느 쪽이든 **다음 질문을 코드 없이 추가할 수 있다**는 것이 이 Phase의 산출물이다.

⚠ 61b 실측 교훈: **n=10 표본으로 판본을 가리지 말 것.** 문항 3~5개의 차이는 노이즈일 수 있다 —
"이게 확실히 낫다"가 안 보이면 결론을 내리지 말고 표본을 늘린다.

---

## 10. 하지 말 것

- `/api/verify`·`lib/verify/*`·`batchVerify`·`BatchVerifyDialog`·`verification` 필드 **무접촉**.
- **검증 칩을 지우지 말 것**(§1 — 대조군). `buildContext`·`invokeOneAI`를 lib으로 빼지 말 것(66b에서).
- **`invokedIds`를 합집합으로 만들지 말 것**(E3) · **답글 분기를 그대로 통과시키지 말 것**(E2·D17).
- **같은 세션에 질문을 연달아 보내지 말 것**(D15) — 비교가 오염된다.
- 질문 문안을 코드에 박지 말 것 — 씨앗(`seed.ts`)은 **최초 1회 복사본**이고 이후 진실은 Firestore다.
  씨앗을 고쳐도 이미 만들어진 문서는 바뀌지 않는다(의도).
- 꼬리(출력 형식 지시)를 코드가 붙이지 말 것 — 본문의 일부다(§4).
- 팝오버 래퍼에 `position:relative` 금지(`:1458-1460`) · `width:250` 리터럴 복제 금지(E10).
  네이티브 `alert/confirm` 금지(`lib/dialogs.ts`).
- **`PH.listChecks`를 재사용하지 말 것**(E1) — 교정 아이콘이고 EditorView에서 동시에 보인다.
- **기존 Claude `ai_models` 문서를 고치지 말 것**(D14) — 전 경로에 번진다.
- `lib/ask/seed.ts`에 import 문 금지 · `lib/askQuestions.ts`를 `lib/ask/`에 두지 말 것.
- 새 색은 토큰으로(M6 팔레트 셋).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지(push는 덕수) · roadmap 갱신 · 확정본만 `docs/phasedocs/`.

---

## 11. 구상 노트 — 이후 방향 (합의됐으나 이번 판에 넣지 않는 것)

> 브레인스토밍(2026-09-14)에서 나온 결론들. **결정이지 확정 설계가 아니다** — 1단계 실측 결과에 따라 수치·범위가 바뀐다.

### 11-1. 66b — 폴더뷰 순차 실행

- **진입은 지금의 [일괄 검증] 버튼 하나.** 누르면 모드 선택 팝오버가 먼저 뜬다 — **교차 검증**(현 `BatchVerifyDialog` 그대로) /
  **문답 검증**(새 다이얼로그). 61d 코드는 **0** — 버튼 핸들러가 `setBatchOpen(true)` 대신 팝오버를 여는 것뿐.
- 모드 팝오버는 마지막 선택을 **기억하지 않는다**(어느 쪽이 열릴지 예측 가능해야 한다).
- 선택 바(`n개 선택`)에 버튼을 더하지 않는다 — 66 v1의 "[폴더 변경…] 뒤 [정밀 검증]"은 이 모드 선택으로 갈음.
- 문답 검증 선택 화면 = 한 화면에 셋: **문항 표**(체크박스 · 오너 아닌 행 비활성 · 프리플라이트 결과) ·
  **검증 항목 체크**(`ask_questions`의 enabled 목록) · **의뢰 대상 모델 칩**. 하단에 라운드 수·예상 시간·비용·[시작].
- **문항 기본 체크 = 전부 해제.** 61d와 달리 "검증이 필요하다"는 신호(`verification.stale`)가 없고, 대상이 "고른 고난도 몇 개"라
  전체 체크 기본값은 사고를 부른다. [전체 선택]은 둔다.
- 실행 순서 = 문항 직렬 → 질문 직렬 → 모델 병렬. **배치는 히스토리 없이**(질문 간 독립) —
  ⚠ 1단계의 D15(세션 분리)가 배치에서는 "히스토리 0"으로 자연히 해소된다. 추출한 조립 함수에
  `discussionHistory: []`를 넘기는 갈래가 필요하다.
- 여기서 비로소 `buildContext`·`invokeOneAI`의 lib 추출(66 v1의 S2)이 필요해진다 — CommentPanel 밖에서 같은 조립을 써야 하므로.
- 결과 요약 팝업에 무엇을 담을지는 **미결**: 문항×질문 표에 「지적 N건」만으로 충분한지, 셀 클릭 → 해당 문항 agent 탭 이동까지 필요한지.

### 11-2. 66c — 정리

- **검증 칩 삭제** — `VerifyChips`·`VERIFY_CHAR_CAP`·`runVerify`·`PendingAIBubble`의 `kind:'verify'` 합성 갈래 ·
  `handleRetryAI`의 verify 분기 · `onRunVerify`/`verifyCharCount` prop 배선
  (`EditorView:3106,4137` · `ProblemView:343,1282`). 폰 셸은 `onRunVerify`를 안 넘겨 영향 0.
  `runVerifyFlow` 호출부는 `batchVerify` 하나만 남는다.
- 삭제 시점은 **실험 종료 후**. 그때까지 칩은 대조군이다.

### 11-3. 질문 목록의 장래

- 66 v1이 적어 둔 문제 검증 4종(정답 대조·조건 결함·선택지·표기)과 논리 2종(줄 단위·전역)은 **후보로만** 남긴다.
  필요해지면 앱에서 추가한다. 문제 질문을 넣을 때 `{answer_line}` 치환이 처음 필요해진다 —
  ⚠ **`Problem.answer`는 discuss 컨텍스트에 없다**(`buildContext`가 탭 블록만 조립한다, `:554-582`).
- **한 질문에 한 잣대** — 61b 실측(태그 7개를 한 프롬프트에 넣으면 눈에 띄는 것부터 소모하고 나머지가 묻힌다)이 근거.
  길이 자체는 문제가 아니다(입력 토큰은 싸고 빠르다). 표적 개수가 문제다.
- **제미나이 제안(2026-09-14 덕수 공유)의 소화**: 4개 렌즈 중 ①미사용 부산물은 G2에 흡수됐고,
  ②우회 경로·③자명한 단계 과다·④잉여 케이스는 전부 **압축 축**이라 G3의 세부로 들어갔다.
  ⚠ 그 문서의 체크리스트 4개를 **한 프롬프트에 모두** 넣는 형태는 위 원칙에 어긋나므로 채택하지 않았다.
- **모델 고정**: 실험 중에는 D14 문서 하나로. 항목별로 다른 모델이 낫다는 실측이 나오면 그때 질문 문서에 `preferredModelId`를 추가.
- **시스템 프롬프트 갈래**: §9-2·9-3이 "`appendPrompt`로 부족하다"로 나오면 `/api/discuss`에
  `mode: 'ask'` 같은 필드를 두고 `BASE_SYSTEM_PROMPT`의 형식 규칙만 갈아끼우는 작업이 생긴다.
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
| 66 v1 | web (2026-09-14) | 전체 구상 — 질문 9종 · 폴더뷰 배치 · 결정 D1~D19 |
| 66a v1 | web (2026-09-14) | 1단계로 축소 — 칩 유지·lib 추출 유예·질문 3개·Firestore 편집 구조 · D1~D12 |
| **66a v2** | **CLI 실측 (2026-09-14)** | **정정 10 · 보완 8 · 결정 D1′·D13~D18 · 커밋 S1~S5 · 테스트 T6·규칙 64·65** |

다음: 덕수 확정 → S1~S5 착수 → 실험 §9 → 66b 설계.

---

## 부록 B. 실측으로 확인한 v1 서술 (변경 없음)

- `handleSendMessage` → `buildContext` → `buildHistory` → `Promise.allSettled(invokeOneAI)` 경로(2-1) ✓
- `math_snippets` 규칙·CRUD 전례(2-2) ✓ — 행 번호만 30-32 → **29-31**로 정정
- `headerLeft`의 두 함정(fragment 밀림 `:1157` · 칩 래퍼 relative 금지 `:1458`)과
  **기준 상자 = 컴포저 래퍼**(`:1103`) ✓
- 검증 칩 게이트 3종(`onRunVerify`·오너·`isAISession`)과 dev 콘솔 사유 로깅 ✓
- `ai_models.maxTokens` 기본 1024가 `provider.complete`로 그대로 간다(`route.ts:571`) ✓
- `/api/discuss` 무인증 · 오류 500 일괄 ✓
- 컨텍스트 15,000자 자름이 `console.warn`뿐 ✓
- `Problem.answer`가 discuss 컨텍스트에 없다(§11-3) ✓
- `lib/dialogs.ts` 3종 + `dialogStyles` 규격 존재 ✓

---

## 부록 C. v1 → v2 정정·보완

### 정정 (E)

| # | v1 서술 | 실측 | 결과 |
|---|---|---|---|
| **E1** | "`PH.listChecks` 재사용 → ICONS 무변경" | `listChecks`는 **ProofreadIcon(교정)**이고(`gen-phosphor-paths.mjs:78` · `UnifiedToolbar:83`) EditorView에서 Row 2 툴바와 agent 드로어가 동시에 보인다 | `listDashes` 1키 추가 · **60 → 61종** · 빌드 로그 확인(D13) |
| **E2** | 전송 = `handleSendMessage(문안, 모델)` | 그 함수의 **첫 분기가 `replyingTo`**(`:686`)라 답글로 저장하고 `return` — AI 0회 | 전송 직전 `setReplyingTo(null)`(D17) · 검수 항목 3 |
| **E3** | "`invokedIds`를 override 우선으로" | 우선·합집합 어느 쪽으로 읽히는지 모호. 합집합이면 칩으로 켜 둔 모델까지 같은 질문을 받아 비용이 배가 된다 | **대체**로 명문화 · 검수 항목 4 |
| **E4** | 모델 해석 언급 없음 | `aiModels.find`가 못 찾으면 `invokedModels`가 비고, **사람 메시지만 저장된 채 조용히 끝난다**(`:735`) | [보내기] 활성 = 해석된 모델 ≥ 1(D16) |
| **E5** | "제약은 800자(고난도 1200자)" | 길이만이 아니다 — "**단계 나열(풀이 재작성) 금지**"(`route.ts:102`) + "장황한 서술은 **응답 무효 사유**"(`:88`). **G3가 요구하는 것이 바로 풀이 재작성** | D14(실험 전용 모델 문서 + `appendPrompt`) · §9-3 관측 항목 신설 |
| **E6** | `maxTokens`를 콘솔에서 올리라고만 | `getEnabledModels`는 **모듈 캐시**(`ai-models.ts:14`) | 준비물에 "새로고침 필요" 명시 |
| **E7** | "규칙 테스트 케이스 2 추가" | 하니스는 **63번까지** 번호가 붙어 있다 | 64·65로 지정 |
| **E8** | `test:ask` 스크립트 | `--rootDir .`이 없으면 산출물 경로가 어긋난다(CLAUDE.md 기지 함정) | 스크립트에 명시 |
| **E9** | "`costUsd`가 답 하단에 이미 실린다(`route.ts:587`)" | 인용이 API 응답 필드였다. UI 렌더는 `CommentPanel:1931-1940`(메시지별) · `:970-982`(세션 합계) | §9-5를 메시지 단위로 |
| **E10** | 팝오버 = `VerifyChips` 문법 재사용 | 그 팝오버는 `width:250`·`left:50%`·`translateX(-50%)`. 목록·편집에는 좁다 | `left:0; right:0` + `maxHeight 320` + `overflowY:auto` |

### 보완 (G)

| # | 내용 |
|---|---|
| **G1** | 씨앗 트리거를 **팝오버 첫 열기**로(패널은 EditorView·ProblemView·PhoneApp에서 마운트된다) + 모듈 in-flight 싱글턴으로 중복 생성 차단 → D4 |
| **G2** | 문답이 일반 모델 경로를 타므로 **실패 [재시도]가 공짜로 따라온다**(`handleRetryAI` `:838` + `retryContext`). 별도 처리 0 |
| **G3** | 이름 충돌 — '정밀 검증'은 CLAUDE.md 12곳·roadmap 10곳에서 61b를 가리킨다 → 새 기능은 **'문답 검증'**(D1′) |
| **G4** | 질문 본문은 `currentMessage` 별도 필드라 `CONTEXT_CHAR_CAP`(탭 블록만 셈)을 잡아먹지 않는다 — 8000자 상한이 문항을 밀어내지 않는다 |
| **G5** | **`HISTORY_LIMIT 5`가 앞 답을 뒤 질문에 실어 보낸다** — 같은 세션에서 G1→G2→G3를 연달아 돌리면 문안 비교가 성립하지 않는다 → **D15(질문 1개 = 세션 1개)** + 2단 안내 문구. 66b 배치에서는 "히스토리 0"으로 해소(§11-1) |
| **G6** | 문답에는 검증 칩의 길이 사전 경고가 없다(셈법이 다르다) — 1단계는 dev 콘솔 `console.warn`로 본다(§1 범위 밖) |
| **G7** | `runVerify`는 실행 시 `setSelectedModelIds([])`를 하지만 **문답은 칩 선택을 건드리지 않는다**(override로 자기 모델을 든다) — 의도적 비대칭 |
| **G8** | `order` 자동 부여 규칙(최대+10 · 복제는 원본+1)과 테스트 T6 → D18 |
