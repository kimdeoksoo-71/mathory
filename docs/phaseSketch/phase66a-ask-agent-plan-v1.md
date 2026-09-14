# Phase 66a — 정밀 검증(문답형) 1단계: agent 탭 질문 리스트 구현 계획서 v1

작성일: 2026-09-14 · 작성: web · 기준 커밋: **mathory `origin/main 9061cf9`**
계보: 덕수 스케치(2026-09-14) → Phase 66 v1(전체 구상) → **브레인스토밍(2026-09-14) → 66a = 1단계만 잘라낸 착수 후보**
착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 요약

agent 대화창 입력 상단에 **질문 리스트 버튼**을 달고, 거기서 고른 검증 질문을 선택한 AI에게 보낸다.
질문 문안은 `users/{uid}/ask_questions`에 살며 **앱 안에서 추가·수정·복제·삭제**한다.

**이번 판의 목적은 기능 완성이 아니라 실험이다.** 어떤 질문 문안이 좋은 답을 내는지는 써 보기 전에는 모른다 —
그래서 질문 3개를 씨앗으로 넣고, 문안을 고치는 왕복이 배포 없이 도는 구조를 먼저 만든다.

**서버 0 · 프롬프트(`lib/verify/prompts.ts`) 0 · 61b/61d 코드 0 · 스키마(문항) 0.**
Firestore 규칙 **1블록 추가**(기존 `math_snippets` 문법 그대로) · 신규 3파일 · 기존 2파일 수정.

---

## 1. 범위 — 무엇을 **안** 하는가, 그리고 왜

| 항목 | 66 v1 | 66a | 이유 |
|---|---|---|---|
| [문제 검증]·[풀이 검증] 칩 | 삭제 | **남긴다** | 지금 그 칩이 **대조군**이다. 같은 문항에서 칩은 "이상 없음", 질문은 "지적 3건"이 나오는 비교가 이번 실험의 판정 근거다. 삭제는 실험이 끝난 뒤 마지막 정리 커밋(66c) |
| `buildContext`·`invokeOneAI` lib 추출 | S2(최대 위험 커밋) | **안 한다** | 추출이 필요한 이유는 폴더뷰 배치가 CommentPanel 밖에서 같은 조립을 써야 하기 때문. agent 탭 안에서만 쓰는 동안은 현재 자리 그대로가 맞다 |
| 폴더뷰 순차 실행 | 포함 | **안 한다** | 예상 시간·비용·중단 정책이 전부 추정치다. 1단계 실사용으로 실측한 뒤 설계한다 |
| 문제 검증 질문 4종·논리 질문 2종 | 목록에 포함 | **안 넣는다** | 추측이다. 씨앗은 군더더기 3개뿐이고 나머지는 앱 안에서 추가한다 |
| 결과 요약 팝업·`verification` 배지 | 포함 | **안 한다** | 답은 세션 메시지로 남는다. 대화 기록이 곧 실험 로그 |

**남는 것.** 질문 컬렉션 + 씨앗 3개 + 리스트 팝오버(선택·수정·복제·삭제) + 전송.

---

## 2. 확정 사실 (origin/main `9061cf9` 실측)

### 2-1. 전송 경로는 이미 있다 — 바꿀 것은 `content`와 모델 목록뿐

`handleSendMessage`(`CommentPanel.tsx:680-787`)가 사람 메시지 저장(`:726-732`) → 컨텍스트 조립(`buildContext` `:554-583`) →
히스토리(`buildHistory` `:585-615`) → 모델마다 `invokeOneAI`(`:618-677`)를 `Promise.allSettled`로 병렬(`:784-786`).
모델 선택은 `selectedModelIds: string[]`(`:187`), 목록은 `getEnabledModels()`(`:234`, Firestore `ai_models`).

→ 질문 전송 = `handleSendMessage(문안, 모델목록)`. **새 요청 형식·새 라우트 0.**

### 2-2. 사용자별 편집 가능 컬렉션의 전례가 있다 — `math_snippets`

- 규칙(`firestore.rules:30-32`):
  ```
  match /math_snippets/{snippetId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```
- CRUD(`lib/snippets.ts:16-65`): `collection(db,'users',userId,'math_snippets')` · `listSnippets`(orderBy) ·
  `createSnippet`(addDoc + `serverTimestamp()`) · `updateSnippet` · `deleteSnippet`.

→ `ask_questions`는 이 두 파일을 **형태 그대로** 복제한다. 규칙은 같은 `match /users/{userId}` 블록 안에 3줄 추가 —
설계할 것이 없다.

### 2-3. 상단 바에 자리가 있다 (단, 좁다)

`headerLeft`(`:1156-1180`)는 `flex; flexWrap: wrap; gap 6` 컨테이너에 `AIChipBar`(전폭 div, `:1384`) + `VerifyChips`(`:1439`).
⚠ `:1157-1158` 주석 — fragment로 나란히 두면 아랫줄로 밀린다. ⚠ `:1458-1460` — 칩 래퍼에 `position:relative`를 두면
팝오버 기준이 칩 묶음이 되어 패널(기본 420px) 밖으로 넘친다. 기준은 컴포저 래퍼.
게이트 재료도 이미 있다: `currentUid`·`ownerUid` prop(`:150`), `isAISession`(`:359`).

**칩을 남긴 채 버튼을 하나 더 얹으므로 상단 바가 두 줄이 될 수 있다.** 실측 후 필요하면 질문 버튼을 아이콘 단독(라벨 없음)으로 (D10).

### 2-4. 아이콘은 추가 없이 된다

`PH.listChecks`(`list-checks`)가 이미 생성 파일에 있고 `UnifiedToolbar.tsx:83`이 `PhIcon`으로 쓴다.
`Icons.tsx`에 `IconQuestionList = () => <PhIcon d={PH.listChecks} …>` 한 줄만 추가하면 **ICONS 표·`icons:gen`·`icons:check` 60종 무변경**.

### 2-5. 알고 쓰는 제약

| 제약 | 근거 | 대응 |
|---|---|---|
| 답변 **800자(고난도 1200자)** 규칙 | `BASE_SYSTEM_PROMPT` `route.ts:98` | 질문 문안 끝의 "빠짐없이" 문구로 완화. **1단계의 핵심 관측 대상**(§9) |
| `ai_models.maxTokens` 기본 **1024** | `lib/ai-models.ts` mapDoc | 지적이 길면 잘린다. **덕수 준비물**: Claude 모델 문서의 `maxTokens`를 4096~8192로(콘솔, 코드 0) |
| `/api/discuss` 무인증·500 일괄 | `route.ts` 전역 · `:601-607` | 1단계는 단건 수동 실행이라 중단 정책이 필요 없다 |
| 컨텍스트 15,000자 자름 | `CommentPanel.tsx:553,568-573`(`console.warn`만) | 긴 문항은 풀이 뒷부분이 조용히 잘린다 — 1단계에선 dev 콘솔로 확인 |
| 리포트 라벨이 '정밀 검증' | `CommentPanel.tsx:405` `modelDisplayName: '정밀 검증'` | **이번에 '교차 검증'으로 개명**(D1) — 새 기능이 그 이름을 가져간다 |

---

## 3. 결정표 (v1 권장안)

| # | 결정 | 근거 |
|---|---|---|
| **D1** | 61b 리포트 작성자 라벨 `'정밀 검증'` → **`'교차 검증'`** | 새 기능이 '정밀 검증'이다. 한 세션에 두 파이프라인의 답이 나란히 쌓이므로 구별이 필수 |
| **D2** | 질문 저장 = `users/{uid}/ask_questions` | 2-2. 전역 컬렉션이면 "누가 쓰나" 규칙을 새로 설계해야 한다. 사용자 하위면 규칙 3줄 |
| **D3** | 문서 스키마 `{ label, target, text, order, enabled, rev, created_at, updated_at }` | `target: 'problem'|'solution'`은 **저장만**(1단계 UI에선 그룹 라벨로만 보인다 — 씨앗 3개가 전부 solution) |
| **D4** | 컬렉션이 비어 있으면 **씨앗 3개 자동 생성**(1회) | 초기 설정 화면 없이 첫 클릭부터 목록이 차 있다. 씨앗 원본은 `lib/ask/seed.ts`(import 0) |
| **D5** | 편집 UI는 **팝오버 안에** — 행 ⋮ → 수정·복제·삭제, 하단 [+ 새 질문] | 문안을 고치고 싶어지는 순간은 시원찮은 답을 본 직후, 그 화면에서다. 콘솔로 가면 문맥이 끊긴다 |
| **D6** | **복제가 1급 기능** | 실험은 "G2를 조금 바꿔 G2b를 만들고 같은 문항에 둘 다 돌린다". 복제가 없으면 원본을 덮어써 비교 대상이 사라진다. 쓸모없어진 판본은 `enabled:false`로 — 삭제는 거의 안 쓴다 |
| **D7** | 저장 시 `rev` 자동 +1 · 전송 메시지 **첫 줄에 `[정밀 검증 · {label} r{rev}]`** | 대화 기록이 실험 로그가 된다. 모델도 그 줄을 보지만 무해 |
| **D8** | 모델은 **Claude 기본 선택**, 변경 가능 | 문안을 비교하려면 모델이 고정 변수여야 한다. `provider==='anthropic'`인 첫 모델을 기본값으로, 없으면 선택 없음 |
| **D9** | 선택 기억 = `localStorage['mathory.ask.v1'] = { modelIds }`, try/catch | 질문은 매번 고르는 것이 맞다(그게 목적). 모델만 기억 |
| **D10** | 버튼 위치 = `headerLeft` **맨 앞**, 라벨 `[≡ 질문]` | 2-3. 두 줄로 밀리면 아이콘 단독으로 축소 |
| **D11** | 치환 **없음** | 씨앗 3개가 전부 풀이 대상이라 `{answer}`가 필요 없다. 치환은 문제 질문을 넣을 때(66b) |
| **D12** | 전송 시 편집창이면 **저장 먼저** | discuss 컨텍스트는 Firestore 저장본을 읽는다(`fetchTabBlocksForModel`). 저장 안 한 편집은 모델이 못 본다 — 61b 칩의 "dirty면 저장 먼저"(`EditorView.tsx:3118`)와 같은 가드를 물려받는다. **열람뷰는 해당 없음**(저장본만 보인다) |

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

규칙 — `firestore.rules`의 `match /users/{userId}` 블록 안에 추가:
```
// 정밀 검증 질문(Phase 66a): 본인만
match /ask_questions/{qid} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

⚠ **꼬리를 코드가 붙이지 않는다**(D3 주석) — 66 v1은 `ASK_TAIL`을 코드 상수로 뒀지만, 출력 형식 지시야말로
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

⚠ **G3는 출력이 길다**(풀이 전문 재작성). `maxTokens`·시간·비용이 셋 다 G1·G2보다 크다 — §9의 관측 대상.

---

## 5. UX

**버튼.** `headerLeft` 맨 앞 `[≡ 질문]`. 게이트 = `isAISession && currentUid === ownerUid`
(AI 답 저장이 오너 전용이라 — 61b 칩과 같은 조건). 숨김 사유는 dev 콘솔에 남긴다(CLAUDE.md 규약).

**팝오버 1단 — 목록.** 입력창 위에 뜬다(`VerifyChips` 팝오버 문법 `:1488-1526` 재사용: `position:absolute; bottom:calc(100%+6px)`).
- 행 = `{label} r{rev}` + 본문 첫 줄 회색 미리보기 + ⋮
- 행 클릭 → 2단. ⋮ → 수정 · 복제 · 삭제(`confirmDialog`) · 사용 여부 토글
- 하단 [+ 새 질문]
- `enabled:false`는 목록 맨 아래에 흐리게(완전히 숨기면 되살릴 길이 없다)

**팝오버 2단 — 전송.** 질문 라벨 · 모델 칩(기본 Claude) · [취소] [보내기](모델 0개면 비활성).
[보내기] → (편집창이고 dirty면 저장 먼저, D12) → 팝오버 닫힘 → `handleSendMessage(전송문, modelIds)`.
사람 메시지가 대화에 뜨고 `PendingAIBubble`이 모델 수만큼. 입력창의 미완성 텍스트는 건드리지 않는다.

**편집 모달.** `dialogStyles` 규격. 라벨(1줄) · 대상(문제/해설 셀렉트) · 본문(textarea, 12줄 이상) · 사용 여부 · [취소] [저장].
저장 시 `rev+1`. 복제는 `label + ' 사본'` · `rev 1` · `order = 원본+1`로 새 문서를 만들고 곧바로 편집 모달을 연다.

**전송문 조립** = `[정밀 검증 · {label} r{rev}]\n\n{text}` (D7).

---

## 6. 구현 항목

### 신규

| 파일 | 내용 |
|---|---|
| `lib/ask/seed.ts` (**import 0**) | `SEED_QUESTIONS`(§4 셋) · `ASK_LABEL_PREFIX` · `buildAskMessage(q)` · `nextRev(n)` · `validateQuestion(q)` — `npm run test:ask`가 단독 컴파일 |
| `lib/askQuestions.ts` (firestore 접촉 · ⚠ `lib/ask/`에 두지 말 것) | `listAskQuestions(uid)` · `createAskQuestion` · `updateAskQuestion`(rev+1) · `duplicateAskQuestion` · `deleteAskQuestion` · `ensureSeeded(uid)` — `lib/snippets.ts:16-65` 형태 그대로 |
| `components/comment/AskListPopover.tsx` | 1단·2단·편집 모달 |

### 수정

| 파일 | 변경 |
|---|---|
| `components/comment/CommentPanel.tsx` | ① `handleSendMessage(content, modelIdsOverride?: string[])` — `:721`의 `invokedIds`를 override 우선으로 ② `headerLeft` 맨 앞에 `<AskListPopover>` ③ `:405` `'정밀 검증'` → `'교차 검증'` ④ `onBeforeAskSend?: () => Promise<boolean>` prop 추가(D12) |
| `components/editor/EditorView.tsx` | `onBeforeAskSend`로 기존 "dirty면 저장" 경로를 넘긴다(`:3118` 근처 로직 재사용). ProblemView는 안 넘긴다 |
| `components/ui/Icons.tsx` | `IconQuestionList`(= `PH.listChecks`) 한 줄 — ICONS 표 무변경(2-4) |
| `firestore.rules` + `tests/firestore.rules.test.mjs` | §4 블록 + 케이스 2(본인 read/write 허용 · 남의 것 거부) |
| `package.json` | `test:ask` |
| `CLAUDE.md` · `docs/roadmap.md` | Phase 66a 절 |

### 커밋

| S | 범위 | 완료 기준 |
|---|---|---|
| S1 | `lib/ask/seed.ts` + `test:ask` + 규칙 + 규칙 테스트 | `npm run test:ask` · `npm run test:rules` 통과 |
| S2 | `lib/askQuestions.ts` + `AskListPopover` + CommentPanel 배선 + 개명 | 씨앗 3개 자동 생성 · 목록·수정·복제·삭제 · 전송 |
| S3 | `onBeforeAskSend`(EditorView) | 편집창에서 dirty 상태로 전송 → 저장 후 전송 |
| S4 | 문서 | — |

---

## 7. 테스트 — `tests/ask.test.mjs`

| # | 단언 |
|---|---|
| T1 | `SEED_QUESTIONS` 3개 · label 유일 · `target` 전부 `'solution'` · `order` 10/20/30 · `enabled` true · `rev` 1 |
| T2 | 셋 다 본문에 정상 문항 전제(`오류가 없고`)와 `빠짐없이`(G3 제외) 포함 |
| T3 | `buildAskMessage({label:'군더더기(원문)',rev:3,text:'…'})` 첫 줄 === `[정밀 검증 · 군더더기(원문) r3]` · 본문은 **무변경**(치환 없음 — LaTeX `$$`·`$&` 안전) |
| T4 | `nextRev(3)===4` · `nextRev(undefined)===1` |
| T5 | `validateQuestion`: 빈 label·빈 text 거부 · text 8000자 초과 거부 · 정상 통과 |

규칙 테스트(에뮬레이터): 본인 uid로 `users/{uid}/ask_questions` read/write 허용 · 다른 uid 거부.

실물 검수: agent 탭에서 G1·G2·G3를 같은 고난도 문항에 각 1회 → §9 기록. 편집 모달로 G2 복제 → 문안 수정 → `rev` 증가 확인.
회귀: 기존 타이핑 전송·재시도·검증 칩·그림 첨부(61f) 무변경.

---

## 8. 덕수 준비물

1. `ai_models`의 Claude 문서 `maxTokens`를 **4096 이상**으로(콘솔). 현재 기본 1024면 지적 목록이 잘린다(2-5).
2. 실험 대상 문항 3~5개 선정 — **군더더기가 있을 법한 고난도·긴 풀이**. 같은 문항에 세 문안을 돌려야 비교가 된다.

---

## 9. 실험 운용 — 이 Phase가 실제로 얻으려는 것

문안 3개를 같은 문항에 돌리고 **다음 다섯 가지를 본다.** (기록은 대화 세션 자체 — 별도 표를 만들지 않는다)

1. **지적 건수와 질** — G1 대비 G2·G3가 더 찾는가, 아니면 오탐만 느는가
2. **답이 잘리는가** — 800자 규칙(2-5)을 "빠짐없이" 문구가 이기는지. 잘리면 후속에서 `/api/discuss`에 길이 완화 필드
3. **시간** — 특히 G3(전문 재작성). 라운드당 몇 분인지가 폴더뷰 배치 설계의 입력값이다
4. **비용** — `costUsd`(`route.ts:587`)가 답 하단에 이미 실린다. 문항당 실측치 → 배치 예상 비용 산정
5. **61h 정의와의 충돌** — G3가 잡는 "더 짧게 쓸 수 있는 것"을 덕수가 군더더기로 받아들이는지.
   받아들이면 61h 정의(`prompts.ts` 군더더기 [4] "문체·길이 자체는 아니다")와 문답형의 정의가 갈리는 것이고, 그 사실을 기록해야 한다

**판정.** 셋 중 하나가 확실히 나으면 나머지를 `enabled:false`. 우열이 안 갈리면 복제해서 변형을 만든다.
어느 쪽이든 **다음 질문을 코드 없이 추가할 수 있다**는 것이 이 Phase의 산출물이다.

---

## 10. 하지 말 것

- `/api/verify`·`lib/verify/prompts.ts`·`parse.ts`·`batchVerify`·`BatchVerifyDialog`·`verification` 필드 **무접촉**.
- **검증 칩을 지우지 말 것**(§1 — 대조군). `buildContext`·`invokeOneAI`를 lib으로 빼지 말 것(66b에서).
- 질문 문안을 코드에 박지 말 것 — 씨앗(`seed.ts`)은 **최초 1회 복사본**이고 이후 진실은 Firestore다.
  씨앗을 고쳐도 이미 만들어진 문서는 바뀌지 않는다(의도).
- 꼬리(출력 형식 지시)를 코드가 붙이지 말 것 — 본문의 일부다(§4).
- 팝오버 래퍼에 `position:relative` 금지(`:1458-1460`). 네이티브 `alert/confirm` 금지(`lib/dialogs.ts`).
- ICONS 표를 늘리지 말 것 — `PH.listChecks` 재사용(2-4). 새 색은 토큰으로(M6 팔레트).
- `lib/ask/seed.ts`에 import 문 금지 · `lib/askQuestions.ts`를 `lib/ask/`에 두지 말 것.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지(push는 덕수) · roadmap 갱신 · 확정본만 `docs/phasedocs/`.

---

## 11. 구상 노트 — 이후 방향 (합의됐으나 이번 판에 넣지 않는 것)

> 브레인스토밍(2026-09-14)에서 나온 결론들. **결정이지 확정 설계가 아니다** — 1단계 실측 결과에 따라 수치·범위가 바뀐다.

### 11-1. 66b — 폴더뷰 순차 실행

- **진입은 지금의 [일괄 검증] 버튼 하나.** 누르면 모드 선택 팝오버가 먼저 뜬다 — **교차 검증**(현 `BatchVerifyDialog` 그대로) /
  **정밀 검증**(새 다이얼로그). 61d 코드는 **0** — 버튼 핸들러가 `setBatchOpen(true)` 대신 팝오버를 여는 것뿐.
- 모드 팝오버는 마지막 선택을 **기억하지 않는다**(어느 쪽이 열릴지 예측 가능해야 한다).
- 선택 바(`n개 선택`)에 버튼을 더하지 않는다 — 66 v1의 "[폴더 변경…] 뒤 [정밀 검증]"은 이 모드 선택으로 갈음.
- 정밀 검증 선택 화면 = 한 화면에 셋: **문항 표**(체크박스 · 오너 아닌 행 비활성 · 프리플라이트 결과) ·
  **검증 항목 체크**(`ask_questions`의 enabled 목록) · **의뢰 대상 모델 칩**. 하단에 라운드 수·예상 시간·비용·[시작].
- **문항 기본 체크 = 전부 해제.** 61d와 달리 "검증이 필요하다"는 신호(`verification.stale`)가 없고, 대상이 "고른 고난도 몇 개"라
  전체 체크 기본값은 사고를 부른다. [전체 선택]은 둔다.
- 실행 순서 = 문항 직렬 → 질문 직렬 → 모델 병렬. 배치는 **히스토리 없이**(질문 간 독립).
- 여기서 비로소 `buildContext`·`invokeOneAI`의 lib 추출(66 v1의 S2)이 필요해진다 — CommentPanel 밖에서 같은 조립을 써야 하므로.
- 결과 요약 팝업에 무엇을 담을지는 **미결**: 문항×질문 표에 「지적 N건」만으로 충분한지, 셀 클릭 → 해당 문항 agent 탭 이동까지 필요한지.

### 11-2. 66c — 정리

- **검증 칩 삭제** — `VerifyChips`·`runVerify`·`VERIFY_CHAR_CAP`·`PendingAIBubble`의 `kind:'verify'` 합성 갈래 ·
  `onRunVerify`/`verifyCharCount` prop 배선(`EditorView:3118,4137` · `ProblemView:345,1282`). 폰 셸은 `onRunVerify`를 안 넘겨 영향 0.
  `runVerifyFlow` 호출부는 `batchVerify` 하나만 남는다.
- 삭제 시점은 **실험 종료 후**. 그때까지 칩은 대조군이다.

### 11-3. 질문 목록의 장래

- 66 v1이 적어 둔 문제 검증 4종(정답 대조·조건 결함·선택지·표기)과 논리 2종(줄 단위·전역)은 **후보로만** 남긴다.
  필요해지면 앱에서 추가한다. 문제 질문을 넣을 때 `{answer_line}` 치환이 처음 필요해진다(`Problem.answer`는 discuss 컨텍스트에 없다).
- **한 질문에 한 잣대** — 61b 실측(태그 7개를 한 프롬프트에 넣으면 눈에 띄는 것부터 소모하고 나머지가 묻힌다)이 근거.
  길이 자체는 문제가 아니다(입력 토큰은 싸고 빠르다). 표적 개수가 문제다.
- **제미나이 제안(2026-09-14 덕수 공유)의 소화**: 4개 렌즈 중 ①미사용 부산물은 G2에 흡수됐고,
  ②우회 경로·③자명한 단계 과다·④잉여 케이스는 전부 **압축 축**이라 G3의 세부로 들어갔다.
  ⚠ 그 문서의 체크리스트 4개를 **한 프롬프트에 모두** 넣는 형태는 위 원칙에 어긋나므로 채택하지 않았다.
- **모델 고정**: 실험 중에는 Claude 하나로. 항목별로 다른 모델이 낫다는 실측이 나오면 그때 질문 문서에 `preferredModelId`를 추가.

### 11-4. 두 축의 충돌 (기록해 둘 것)

61h(코드)의 군더더기 정의는 **"지워도 되는 것"**이고 "짧게 쓸 수 있다는 것만으로는 군더더기가 아니다"를 명시한다.
G3(압축 재작성)는 그 제외 영역을 정면으로 겨냥한다. 문답형이 그쪽에서 더 유용하다고 판명되면,
**두 정의가 갈린 채로 공존**하는 것이 맞는지(문답형 = 편집용, 61h = 검증용) 아니면 61h 쪽을 손대야 하는지 결정이 필요하다.
후자라면 그 작업은 M1 방침("61b/61h는 동결, 발전은 audition에서")에 걸린다.

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| 66 v1 | web (2026-09-14) | 전체 구상 — 질문 9종 · 폴더뷰 배치 · 결정 D1~D19 |
| **66a v1** | **web (2026-09-14)** | **1단계로 축소** — 칩 유지·lib 추출 유예·질문 3개·Firestore 편집 구조 · 결정 D1~D12 · 실험 운용 §9 · 구상 노트 §11 |

다음: 덕수 확정 → (필요시 CLI 실측 교차검토) → S1~S4 착수 → 실험 §9 → 66b 설계.
