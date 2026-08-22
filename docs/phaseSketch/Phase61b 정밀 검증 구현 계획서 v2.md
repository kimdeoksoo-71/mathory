# Phase 61b 구현 계획서 — 정밀 검증 (agent 대화창 통합) (v2)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **B축**
> v1(2026-08-22 web) → **v2(2026-08-22 CLI 실측 교차검토)**. v1의 결정 D1~D7은 **D4·D5·D6만 개정**, 나머지는 유지.
> 진실 원천: mathory `6b764e3`(로컬 main) · gas-project-audition **`b6b91f6` = origin/main** (fetch로 동일 확인, 로컬 clone 인용 가능)
> 범위: 기획서 D 진행표의 **단계 2(검증 코어) + 단계 3(agent 통합) + 단계 4(상태 관리)**. C축(대화→편집창 삽입)은 61c.

---

## 0. 한 줄 요약

시트 STEP3에서 검증된 **비대칭 교차검증(1차 Gemini 후보 생성 → 2차 Claude 엄격 판정)** 을
Mathory 서버 라우트(`/api/verify`)로 이식하고, 실행은 agent 대화창의 **칩 2개 + 비용 확인 팝오버**,
결과는 대화 스레드에 꽂히는 **리포트 카드**(지적 클릭 → 블록 선택), 상태는 `Problem.verification` additive 필드 + 목록 배지.

**v1 대비 핵심 변경 4가지**
1. 현재 `lib/ai-provider.ts`로는 **STEP3 등가 호출이 불가능하다** — thinking·effort 미전달, provider 클래스 미export, `pause_turn` 미처리. 세 가지를 먼저 손봐야 한다(§3-1).
2. **LaTeX × JSON 이스케이프 충돌**이 v1에 통째로 빠져 있었다 — 파싱이 *성공하면서* 조용히 망가지는 부류라 파싱 폴백만으로는 못 막는다(§3-2).
3. **D5(stale = 저장 경로 훅)는 현재 저장 구현에서 성립하지 않는다** — `handleSave`가 전 탭을 매번 저장한다. 탭 정규화 해시로 교체(§3-4).
4. **D6(`<details>` 스포일러 방지)는 실효가 없다** — 리포트 댓글은 규칙상 멤버가 그대로 읽는다. 접기는 UI일 뿐 데이터가 이미 건너간다(§3-5).

---

## 1. 아키텍처 (v1 유지)

**서버는 검증 엔진 프록시, 컨텍스트 조립과 저장은 클라이언트.** (discuss 관례 그대로)

- `app/api/verify/route.ts` — 블록 배열을 받아 2단 교차검증을 수행하고 리포트 JSON만 반환. **Firestore 미접촉.**
- 클라이언트 — 블록 수집 → 라우트 호출 → 결과를 agent 메시지로 `addComment` → `Problem.verification` 갱신.

이유: (a) discuss·proofread와 동일 구조라 요구가 하나로 유지된다. (b) 리포트가 일반 메시지라 후속 대화가 기존 discuss 파이프라인 **무변경**으로 된다. (c) Firestore 규칙 0 · 마이그레이션 0.

---

## 2. v1 사실표 검증 결과 — 유지되는 항목

v1 §2-1·§2-2의 다음 항목은 **실측으로 전부 확인**했다. 인용 위치만 정정한다.

| v1 주장 | 판정 | 정정된 위치 |
|---|---|---|
| agent 패널 = `CommentPanel(mode='agent')`, AI 칩+입력창이 하단 | ✓ | `CommentPanel.tsx:44-46, 872-`. 칩은 `CommentEditor`의 `headerLeft`에 `isAISession`일 때만 |
| AI 메시지 저장 관례 `addComment({authorUid:'ai:{id}', authorType:'ai', modelId, discussionSessionId, aiUsage})` | ✓ | `CommentPanel.tsx:521-534` |
| fenced 특수 블록 선례(`mathory-graph`) + `stripForHistory` | ✓ | `CommentPanel.tsx:32-36`(정의) · `494`(사용) · `1354`(감지) |
| discuss = 얇은 프록시, 컨텍스트는 클라(15,000자 상한), `maxDuration=300`, 무인증 | ✓ | `discuss/route.ts:13-17` · `CommentPanel.tsx:450-471` |
| KaTeX `$...$` 강제 규약 + 검산 지침 기존재 | ✓ | `discuss/route.ts:44-` |
| SymPy 검산 인프라 기존재 | ✓ (단 §3-1 참조) | `ai-provider.ts:52-66, 327-430` |
| proofread가 Claude + tool_use 강제로 구조화 출력 (SDK 직접) | ✓ | `proofread/route.ts:12, 52-` |
| provider env 3종 기존재, Gemini는 `jsonMode` 미지원 | ✓ | `ai-provider.ts:69, 439-445` |
| 라우트 인증 선례 `verifyUid`(토큰 릴레이 + `accounts:lookup` + 허용목록 fail-closed + `ApiError`) | ✓ | `sheet-import/route.ts:34-90`. ⚠ env는 4종이 아니라 **5종**(+`NEXT_PUBLIC_FIREBASE_API_KEY`) |
| `Problem` additive 필드는 배선 0 (`listProblems` 스프레드, 규칙 화이트리스트 없음) | ✓ | `firestore.ts:140-151` · `firestore.rules:82-89`(update는 오너만, 필드 제약 없음) |
| 목록 배지 선례 (💬 / AI) | ✓ | `ListView.tsx:139-147, 224` · `FolderView.tsx:553, 566` |
| `stemHash` 기존재 | ✓ | `lib/sheetImport.ts:195` |
| STEP1·2 프롬프트는 pmt.csv, **STEP3 2세트는 없다** | ✓ **확정** | pmt.csv 실측 12행 = `gemini_problem_verify_*`·`gpt_problem_verify_*`·`gpt_solution_verify_*`·`gemini_solution_verify_*` 각 3행. `quality`·`judge` 접두 **0건** |
| STEP3 구조(후보 0 → Claude 미호출 / valid≥1→fail / uncertain≥1→check / else ok), 후보 상한 8 | ✓ | `QualityVerification.gs:72`(`MAX_CANDIDATES: 8`) · `285-289`(후보 0) · `384-387`(주석) · `428`(코드) |
| STEP3 모델 = `gemini-3.1-pro-preview`(thinking HIGH) / `claude-opus-4-8`(effort high, max_tokens 16000, 샘플링 금지) | ✓ | `QualityVerification.gs:48-57, 484, 578-583` |
| 판정 어휘가 갈려 있다 (STEP1·2 `ok/check/error/skip`, STEP3 `ok/check/fail/skip`) | ✓ | pmt.csv system 본문 · `QualityVerification.gs:25` |
| 보수 판정 철학이 프롬프트에 명문화 | ✓ | pmt.csv 각 system |
| `{format}`은 K열(answer_type)로 정해짐 | ✓ | 정의는 `Itemverification.gs:522-528`(v1이 적은 286-304는 *호출* 위치) |

**`claude-opus-4-8`은 현재 유효한 모델 ID다** (Opus 4.8, 1M 컨텍스트, $5/$25 per 1M). 시트의 `thinking:{type:'adaptive'}` + `output_config:{effort:'high'}` 조합도 이 모델의 **현행 정식 API**다 — 구식이 아니다. `budget_tokens`는 이 모델에서 400이므로 되살리지 말 것.

---

## 3. 정정 — v1이 틀렸거나 빠뜨린 것

### 3-1. 현재 provider로는 STEP3 등가 호출이 안 된다 (v1 §2-1·§4.2 보강)

v1은 "SymPy 검산 인프라 기존재"에서 "그러니 쓰면 된다"로 건너뛰었다. 실측하면 **세 군데가 막혀 있다.**

**(a) provider 클래스가 export되지 않는다.** `lib/ai-provider.ts`의 export는 `getProviderForModel(config: AIModelConfig)`(:448)과 `getAIProvider()`(:478) 둘뿐이고, `GeminiProvider`(:52)·`ClaudeProvider`(:327)는 모듈 내부다. 그리고 `getProviderForModel`은 **Firestore `ai_models` 문서 전체**를 요구한다 — env 고정 모델에는 그 문서가 없다.
→ `getVerifyProviders()`(또는 `getProviderByName(provider, model, opts)`) 팩토리를 **추가 export**한다. proofread처럼 SDK를 직접 부르는 길도 있지만, 그러면 아래 (c)의 code_execution 파싱(:370-415, 블록 타입 3갈래 + bash 이중 nesting)을 통째로 재작성해야 한다 — **재사용이 정답이다.**

**(b) thinking·effort가 전달되지 않는다. 이것이 가장 위험하다.**
- `ClaudeProvider.complete`가 보내는 params는 `model / max_tokens / system / messages`(+tools)뿐(:339-344). `thinking`도 `output_config`도 없다.
- **Opus 4.8은 `thinking`을 생략하면 사고가 꺼진 채 돈다.** 오류도 경고도 없고 **품질만 조용히 떨어진다** — STEP3가 effort high + adaptive thinking으로 얻던 정밀도가 사라지는데 리포트는 멀쩡해 보인다.
- Gemini도 같다. `GeminiProvider`는 `generationConfig.maxOutputTokens`만 보낸다(:70-73). 시트는 `thinkingConfig:{thinkingLevel:'HIGH'}`(`QualityVerification.gs:484`)를 준다.
→ `CompleteOptions`에 `thinking`/`effort`/`thinkingLevel`을 additive로 추가하고 두 provider에 배선한다. **discuss·proofread는 옵션을 안 넘기므로 무변경이다.**

**(c) `pause_turn`을 처리하지 않는다.** `ClaudeProvider.complete`는 `messages.create`를 **한 번만** 부르고(:364), `stop_reason`은 `max_tokens`만 본다(:418). 서버 도구(code_execution)가 붙은 요청은 `pause_turn`으로 끊길 수 있다. 토론에서는 "답이 좀 짧다"로 끝나지만 **검증에서는 JSON이 잘린 채 와서 리포트가 통째로 날아간다.**
→ verify 경로는 `stop_reason === 'pause_turn'`이면 assistant content를 그대로 이어 붙여 재요청하는 루프를 둔다(상한 3회).

**(d) `tool_choice:{type:'any'}`(= `forceCodeExecution`)를 verify에 쓰지 말 것.** "무조건 도구를 부르라"는 강제라 모델이 **최종 JSON 턴을 낼 수 없다.** 검산은 프롬프트로 유도하고 강제는 끄는 것이 맞다(시트도 강제하지 않는다).

**(e) assistant prefill은 400이다.** Opus 4.8/4.7/4.6·Sonnet 5·Opus 5 전부에서 마지막 assistant 프리필이 거부된다. 시트 1차 Gemini는 prefill 슬롯을 쓰지만(`getPromptSet`의 `assistant` 행), **Claude 다리는 prefill로 `{`를 밀어 넣을 수 없다.** → D3(JSON-in-text + 견고 파싱)의 근거는 "tool_use와 code_execution 충돌"이 아니라 **이쪽**이다. (구조화 출력이 필요하면 deprecated `output_format`이 아니라 `output_config.format`을 쓴다 — `output_config.effort`와 한 객체에 공존한다. 다만 §3-2 때문에 **어느 쪽을 택해도 복구 단계는 면제되지 않는다.**)

### 3-2. LaTeX × JSON 이스케이프 충돌 — v1에 통째로 빠진 함정

`"\frac"`은 JSON에서 **파싱이 성공한다.** `\f`가 유효 이스케이프(form feed)라 결과는 `␌ + "rac"`이 된다. 즉 **오류 없이 조용히 망가진다.** 수식이 본문인 이 도메인에서는 이것이 상시 발생한다.

시트는 두 겹으로 막는다.
- **파싱 실패 대응**: `safeParseGeminiJson_`(`Itemverification.gs:690-728`) — 펜스 제거 → 객체 추출 → 직접 파싱 → 잘못된 이스케이프만 수정 → 문자 단위 처리 → 정규식 필드 추출, 4단계.
- **파싱 성공 후 복구**: `repairLatexControlChars_`를 `sanitizeCandidates_`가 **trim보다 먼저** 호출한다(`QualityVerification.gs:355-357` — "★ 복구를 trim보다 먼저: 선두의 \f 등 제어문자가 trim에 공백으로 소실되기 전에 복원").

v1 §4.2는 앞의 것만 언급했다. **뒤의 것이 진짜다.** 그리고 이 복구는 tool_use·structured output을 써도 필요하다 — SDK가 결국 `JSON.parse`를 하기 때문이다.
→ `lib/verify/prompts.ts`(또는 `lib/verify/parse.ts`)에 **두 함수를 함께 이식**하고, `npm run test:verify`의 1급 회귀 대상으로 삼는다.

### 3-3. 프롬프트 치환에서 `String.replace`의 `$` 특수 패턴

`.replace(/\{problem\}/g, text)`에서 `text`에 `$$`·`$&`·`` $` ``가 있으면 치환값이 아니라 **패턴으로 해석되어 LaTeX가 손상된다.** 시트 STEP3는 함수형 치환으로 막았다(`QualityVerification.gs:271-273, 305-308` — 주석 "★ 함수형 치환 필수"). 반면 STEP1은 아직 `.replace('{problem}', stem)`(`Itemverification.gs:302-303`)이다 — **고쳐지지 않은 자리**이니 그쪽을 베끼지 말 것.
→ `lib/verify/prompts.ts`의 모든 치환은 **함수형 콜백** 또는 `split(token).join(value)`로 쓴다. (테스트에 `$$` 포함 케이스를 반드시 넣는다.)

### 3-4. D5 개정 — stale은 저장 경로 훅이 아니라 탭 해시로

**v1 D5는 현재 구현에서 성립하지 않는다.** `handleSave`는 탭 구분 없이 **매 저장마다 전 탭을 delete-all → re-add** 한다(`EditorView.tsx:2543-2564`). "question 탭을 저장하면"이라는 분기가 존재하지 않으므로, D5를 그대로 구현하면 **어떤 편집이든 문제·풀이 두 kind가 동시에 stale**이 된다 — 배지가 상시 켜져 신호가 죽는다.

v1이 콘텐츠 비교를 기각한 근거("목록 렌더 시 블록 로드가 필요")는 *목록에서 비교한다*는 전제의 오해다. **비교는 저장 시점에 하고 목록은 불리언만 읽으면 된다.** 재료도 이미 있다.

- `canonicalizeTab(t)` — `lib/version/canonicalize.ts:44` (block_key·타임스탬프 제외, order 정렬, `''`/부재 동치)
- `sha256(s)` — `lib/version/hash.ts:5`

**개정 D5′**
1. 검증 성공 시 `verification[kind] = { verdict, verifiedAt, contentHash, reportCommentId }` — `contentHash`는 대상 탭의 `sha256(canonicalizeTab(...))`.
2. `handleSave`에서 블록이 손에 있을 때 같은 해시를 계산해 `stale = (hash !== contentHash)`를 **불리언으로 기록**.
3. 목록·폴더뷰는 불리언만 읽는다 → 블록 로드 0(v1 요구 충족).

이점: 탭별로 정확하고, **되돌리면 stale이 자동 해제**되며, 저장마다 무의미한 쓰기가 나가지 않는다(값이 바뀔 때만 write).
⚠ `snapshotCurrent`의 `last_version_tab_hashes`를 재사용하고 싶어지지만 **쓰지 말 것** — 스냅샷은 `!silent`일 때만 돈다(`EditorView.tsx:2627`). 자동저장(탭 전환·이탈)에서는 갱신되지 않아 신호가 샌다.

### 3-5. D6 개정 — `<details>`로는 스포일러를 못 막는다

두 가지가 겹친다.

**(a) 데이터가 이미 멤버에게 간다.** `tab_comments` read 규칙은
`isOwnerCmt() || (isMemberCmt() && commentsVisible()) || (공개 && commentStream==true)` (`firestore.rules:234-236`).
agent(normal) 세션 메시지는 `commentStream=false`라 **공개 뷰어는 차단되지만**, **멤버는 세션 구분 없이 전부 읽는다**(주석이 "오너·멤버는 제약 없음(에디터 전체 열람)"이라 명시). 접기는 UI일 뿐이다.

**(b) `<details>`는 이미 예약된 문법이다.** `stripForHistory`가 `<details>…</details>`를 **`[검산 코드 첨부됨]`으로 치환**한다(`CommentPanel.tsx:35`). 리포트가 `<details>`로 정답을 감싸면 후속 대화 히스토리에 "검산 코드 첨부됨"이라는 **거짓 문구**가 들어간다.

**개정 D6′**: `derivedAnswer`는 리포트 **markdown 본문(content)에 넣지 않는다.** ` ```mathory-verify ` JSON 안에만 두고, 카드 UI가 클릭으로 펼친다(접기는 `<details>`가 아니라 카드 자체 상태). 멤버가 문서를 직접 읽으면 여전히 보이지만 — 그건 "감출 수 없다"를 아는 채로 두는 것이고, 감춘 척하지는 않는다.
⚠ 반대로 `Problem.verification`은 **public·member가 읽는다**(`firestore.rules:82`). verdict·시각·stale만 두고 findings·derivedAnswer는 **절대 넣지 말 것** — v1 §4.1은 이미 그렇게 돼 있다 ✓.

### 3-6. D4 격상 — "정책"이 아니라 규칙이 강제한다

`tab_comments` create의 AI 분기는 **오너만** 허용한다(`firestore.rules:240·262-`, 주석 "(b) AI 댓글: 오너만 가능"). 즉 오너가 아니면 리포트 저장이 **규칙 레벨에서 실패**한다. 칩을 비오너에게 노출하면 "API 비용은 다 쓰고 저장만 실패"가 된다.
→ D4는 비용 정책이 아니라 **필수 게이트**다.

### 3-7. 블록 앵커 — v1 결정은 옳고, 근거와 사각이 빠졌다

**결정(`block_key` 앵커)은 맞다. 근거가 이것이다**: 저장이 delete-all → re-add라 **저장할 때마다 블록 doc id가 전부 갈린다**. 그래서 교정 결과도 저장 후 통째로 버린다 — `setProofreadResults({})`, 코드 주석 그대로 "저장 시 블록 ID가 갱신되어 교정 결과 매칭이 깨지므로 초기화"(`EditorView.tsx:2612`). 리포트가 `id`를 들고 있으면 **첫 저장에 죽는다.**

**빠진 사각 2개**
- `data-block-id`의 값은 `block.id`다 — `block_key`가 아니다(`EditorView.tsx:3389`, `TabBody.tsx:143,173`). 클릭 시 `allBlocks`에서 `blockKeyOf(b) === blockKey`인 블록을 찾아 **그 `id`로** 셀렉터를 만들어야 한다(`lib/caseBlock.ts:34`의 `blockKeyOf` 재사용 — `block_key || id` 폴백).
- `block_key`는 **optional**이고 로드 시 `b.block_key || nanoid()`로 즉석 발급된다(`EditorView.tsx:1158, 2596`). **한 번도 저장된 적 없는 레거시 블록은 새로고침마다 키가 바뀌어 앵커가 죽는다.** → §3-8의 "검증 전 저장 강제"가 이 문제도 같이 없앤다(`toPersistedBlock`이 키를 영속시킨다).

### 3-8. 검증 대상 본문의 출처 — v1에 명시가 없다

`fetchTabBlocksText`는 **Firestore에서** 읽는다(`CommentPanel.tsx:429-436`). 편집 중 미저장 내용은 보이지 않는다 → 사용자는 "지금 화면"을 검증했다고 믿는데 **서버본**이 검증된다. 지적 위치도 어긋난다.
→ 실행 직전 `dirty`면 `handleSave()`를 먼저 돌리고, 저장 실패면 **실행하지 않는다**(돈이 나가는 동작이므로 조용한 진행은 금물).

### 3-9. `updateProblem`은 `updated_at`을 갱신한다

`updateProblem`은 무조건 `updated_at: serverTimestamp()`를 붙이고(`firestore.ts:57-64`), `listProblems`는 `updated_at desc` 정렬(`:126-131`)이다 → **검증만 돌려도 문항이 목록 맨 위로 올라온다.** 편집하지 않았는데 "최근 수정"이 바뀌는 것은 오해를 부른다.
→ `verification` 쓰기는 `updateProblem`을 타지 말고 전용 `setVerification(problemId, kind, patch)`를 `lib/firestore.ts`에 둔다(`updateDoc`으로 해당 필드만, `updated_at` 미갱신).

### 3-10. `CommentPanel`은 두 곳에 마운트된다

`EditorView.tsx:3508`과 **`ProblemView.tsx:886`**(열람뷰). v1은 편집창만 상정했다. 열람뷰에는 스크롤 헬퍼도 `allBlocks`도 없다.
**선례가 이미 있다**: `onInsertGraphBlock`은 EditorView에서만 넘기고(`:3519`) ProblemView는 안 넘긴다 — prop 주입 유무가 곧 게이트다.
→ `onRunVerify` / `onJumpToBlock`도 **EditorView에서만 주입**한다. 게이트 코드 추가 0, 열람뷰 변경 0.

### 3-11. 블록 점프는 CommentPanel이 직접 못 한다

스크롤 헬퍼는 전부 EditorView 내부 `useCallback`이고 `previewRef`를 잡는다(`EditorView.tsx:1898-1990`, `fastScrollTo` 경유 — `scrollIntoView` 금지는 CLAUDE.md 규약).
→ `onJumpToBlock(blockKey, tabId)` 콜백이 필요하고, 구현 시 **세 가지**를 지킨다.
1. 대상이 다른 탭이면 `switchTab`을 거친다 — ⚠ `switchTab`은 **자동저장을 동반한다**(`:2643-2647`).
2. 활성 블록을 바꾸면 CLAUDE.md의 `skipNextBlockScrollRef` 계약을 맺는다(직접 스크롤을 부르는 핸들러는 effect 게이트를 우회하므로 조건을 자기 안에 다시 적어야 한다).
3. 해당 `block_key`가 사라졌으면 토스트로 안내하고 스크롤하지 않는다.

### 3-12. `{format}` 대체가 너무 거칠다

시트 `getFormatGuide`(`Itemverification.gs:522-528`)는 combo / math / int / 기본 **4갈래**다. v1의 `hasChoices: boolean`은 2갈래로 줄인다.
Mathory에서 더 정확히 뽑을 수 있다 — `choices` 블록 존재 → 선다형(①~⑤), `gana`/`roman` 블록 + choices → 조합형("ㄱ" 또는 "ㄱ, ㄴ"), `Problem.answer`가 1~999 정수 → 자연수형, 그 외 → 표준 수치.
→ 클라가 `answerFormat: string`(안내 문구 그대로)을 만들어 보낸다. 서버는 `{format}`에 그대로 꽂는다.

### 3-13. 시간 예산이 없다

discuss는 `TIMEOUT_MS = 280_000` 단발이다(`discuss/route.ts:44`). verify는 **2콜 직렬**(Gemini thinking HIGH → Opus effort high / 16k)이라 300초를 넘길 수 있다 — `maxDuration=300`(Vercel Pro)이 상한이고 그걸 넘으면 **비용은 쓰고 결과는 0**이다.
시트는 예산을 반으로 쪼갠다(`gemBudget = max((budget - elapsed)/2, API_CALL_RESERVE_MS)`, `QualityVerification.gs:275`).
→ 같은 방식으로 다리별 `AbortController` 예산을 두고, **2차 예산이 부족하면 `check` + 사유로 정직하게 종료**한다(무응답 타임아웃보다 낫다).

### 3-14. 컨텍스트 상한이 없다

agent 컨텍스트는 15,000자 상한이 있다(`CommentPanel.tsx:452`). verify는 블록 배열을 통째로 보내므로 상한이 없다 → 장문 문항에서 토큰이 폭주한다.
→ 동일 상한을 두고 **초과 시 `verdict:'skip'` + 사유**로 끝낸다(자르고 검증하면 "검증했다"는 거짓 신호가 남는다).

### 3-15. 인용 실재성 검사 — 시트에 있는데 v1이 안 가져왔다

시트는 후보의 `quote`가 실제 풀이에 있는지 검사한다 — `normalizeForQuoteCheck_`(공백 전량 제거 후 `indexOf`, `QualityVerification.gs:369-371`) → `c._quoteFound`, 감사 로그에 `|quote원문불일치`로 남긴다.
**Mathory는 한 걸음 더 갈 수 있다**: 공백 제거한 각 블록 `raw_text`에서 인용을 찾아 **서버가 `blockKey`를 확정**한다.
- 모델이 준 `[블록 n]` 라벨을 믿지 않아도 된다 → 앵커가 결정론적이 된다.
- 어디에서도 못 찾으면 **환각 신호**다 → 해당 지적을 `check`로 강등하고 `blockKey: null`.
→ v1의 "`[블록 n]` 라벨 부여"는 유지하되 **1차 힌트로 격하**하고, 확정은 인용 매칭이 한다.

---

## 4. 공유 자산 · 프롬프트 (v1 §3 유지 + 보강)

원본은 Mathory `lib/verify/prompts.ts`. 시트 pmt는 이후 이 원본에서 손복사(운용 규칙, 코드 자동화 없음).

- **판정 어휘 `ok / check / fail / skip` 통일**(D2 유지). 시트 STEP1·2의 `error`(= 내용 결함)는 `fail`에 대응. ⚠ **API 실패는 verdict가 아니다** — HTTP 오류로 처리하고 `verification`을 갱신하지 않는다.
- **지적 태그**(D2와 함께 union 고정):
  문제 `조건결함 | 답없음 | 선택지오류 | 표기` / 풀이 `계산오류 | 표기오류 | 논리비약 | 논리오류 | 수식비일관 | 경우누락 | 문제풀이불일치` / 공통 `정답불일치`.
  서버가 `sanitizeFindings`로 화이트리스트 정규화(시트 `sanitizeCandidates_` 등가: 미지 태그는 근사 매핑, quote·reason 둘 다 빈 것은 제거, id 재부여).
- 프롬프트는 시트 자산을 **기반으로 신규 작성**(그대로 복사 불가 — 출력 스키마가 다르다: 시트는 사람이 읽는 `error_report` 문자열, Mathory는 블록 앵커·태그가 달린 `findings` 배열).
  **계승할 것**: 보수 판정 문구("판정 없으면 check", "모델이 못 풀었다고 fail 아님"), fail 판정 전 재검토 1회, 후보 상한 8, `$...$` 규약, 축약 인용 규칙.
- 프롬프트 문안은 **파일뿐(실행 1 관문)에서 실물로 확정**한다 — 61a A-4와 같은 방침. 계획서에 전문을 싣지 않는다.
- **착수 전 준비물**: 시트에서 `pushPromptCsvToGithub` 1회 실행 → STEP3 2세트를 pmt.csv에 반영(현재 누락이라 GitHub에서 원문을 읽을 수 없다). ⚠ `getPromptSet`은 `enabled` 열이 TRUE인 행만 읽고 `startsWith(prefix)`로 고른다 — push 후 `gemini_quality_verify_*` / `claude_quality_judge_*` **접두와 enabled 값**을 함께 확인할 것.

---

## 5. 구현 항목

### 5.1 타입 (`types/problem.ts`, 전부 additive)

```ts
export type VerifyKind = 'problem' | 'solution';
export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

export interface VerifyFinding {
  tag: string;                 // §4 태그 union
  verdict: 'fail' | 'check';   // 2차 Claude: valid → fail, uncertain → check
  blockKey: string | null;     // 인용 매칭으로 서버가 확정 (§3-15). 못 찾으면 null + check 강등
  quote: string;
  reason: string;
  suggestion?: string;
  quoteFound: boolean;         // 신규 — 인용 실재성 (환각 신호)
}

export interface VerifyReport {
  kind: VerifyKind;
  verdict: VerifyVerdict;
  findings: VerifyFinding[];
  derivedAnswer?: string;                            // JSON에만 존재. markdown 본문 금지 (D6′)
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  models: { first: string; judge: string | null };   // null = 2차 미실행 (후보 0 또는 예산 소진)
  note?: string;                                     // '(후보 없음)' · '(예산 부족으로 1차만)' 등
  verifiedAt: number;
}

// Problem 안:
verification?: Partial<Record<VerifyKind, {
  verdict: VerifyVerdict;
  verifiedAt: number;
  contentHash: string;        // 개정 D5′ — 검증 대상 탭의 sha256(canonicalizeTab)
  stale?: boolean;
  reportCommentId?: string;
}>>;
```

### 5.2 서버 라우트 — `app/api/verify/route.ts`

```
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

POST /api/verify
headers: Authorization: Bearer <Firebase ID token>
body: {
  kind, problemBlocks: [{ blockKey, type, text }], solutionBlocks?,
  answer: string, answerFormat: string, hasImages: boolean,
}
응답: { report: VerifyReport, usage: { inputTokens, outputTokens, costUsd } }
```

파이프라인 — ❶ 1차 Gemini(thinking HIGH)로 후보 생성(상한 8, `[블록 n]` 라벨 힌트) → ❷ **인용 실재성 매칭으로 `blockKey` 확정**(§3-15) → ❸ 후보 0이면 즉시 `ok` 반환(2차 미호출, 비용 절감) → ❹ 2차 Claude(adaptive thinking + effort high + `code_execution`, `tool_choice` 강제 없음, `pause_turn` 루프) → ❺ 합성(`fail≥1 → fail / check≥1 → check / else ok`).
문제 검증은 1차가 STEP1 계승 — 독립적으로 풀어 `derivedAnswer`를 내고, 서버가 `answer`와 대조해 `answerCheck`를 산출(빈 answer → `no_answer`).

- **인증**: `verifyUid`를 `lib/apiAuth.ts`로 추출해 sheet-import와 공용(D1). env는 `AUDITION_ALLOWED_UIDS` 재사용 — 다만 이름이 기능과 안 맞으므로 `VERIFY_ALLOWED_UIDS ?? AUDITION_ALLOWED_UIDS` 순으로 읽어 나중에 분리할 여지를 남긴다(env 추가 0은 유지).
- **모델 env**: `VERIFY_GEMINI_MODEL`(기본 `gemini-3.1-pro-preview`) · `VERIFY_CLAUDE_MODEL`(기본 `claude-opus-4-8`). `CLAUDE_PROOFREAD_MODEL` 선례와 같은 형태(`proofread/route.ts:17`). API 키는 기존 재사용 → **신규 비밀 0**.
- **파싱**: `safeParseJson`(4단계) + **`repairLatexControlChars`(파싱 후, trim 전)** — §3-2. 실패 시 재시도 1회 후 오류 반환.
- **예산**: 다리별 `AbortController`(§3-13). 2차 예산 부족 → `check` + `note`.
- **비용**: 모델이 env 고정이라 `ai_models` 단가를 못 쓴다. 라우트 상수 테이블로 둔다 — **Opus 4.8 = $5 / $25 per 1M**(2026-06 기준, 출처 주석 필수). Gemini 단가는 프로젝트에 원천이 없으므로 `VERIFY_GEMINI_COST_IN/OUT` env(기본 0 = 미집계)로 뺀다.
- 오류: `ApiError` 화이트리스트(61a). 원본 에러 객체 비노출.

### 5.3 `lib/ai-provider.ts` 확장 (신규 — v1에 없던 항목)

`CompleteOptions`에 additive: `thinking?: 'adaptive'` · `effort?: 'low'|'medium'|'high'|'xhigh'|'max'` · `geminiThinkingLevel?: 'HIGH'|...` · `maxToolTurns?: number`.
`ClaudeProvider`는 `thinking:{type:'adaptive'}` + `output_config:{effort}` 전달 + `pause_turn` 루프, `GeminiProvider`는 `thinkingConfig` 전달.
`getVerifyProviders(models)` 팩토리 export.
⚠ **discuss·proofread는 새 옵션을 안 넘기므로 동작 무변경** — 회귀 위험을 여기서 끊는다.

### 5.4 프롬프트 — `lib/verify/prompts.ts`

순수 함수 모듈(import 0, 61a `sheetImport.ts` 관례). 세트: `problem_first` · `solution_first` · `judge`.
치환은 **함수형**(§3-3). 공통 명문화: 보수 판정 · fail 전 재검토 1회 · `$...$` · 축약 인용 · **그림 의존이면 `skip` + 이유**(B-8) · `[블록 n]` 라벨 유지 의무.

### 5.5 실행 UI — 칩 2개 + 비용 확인

`CommentPanel` agent 모드에서 `CommentEditor`의 `headerLeft`(현재 `AIChipBar`가 있는 자리, `:932`) 옆에 **[문제 검증] [풀이 검증]**.
게이트: `onRunVerify` prop이 있을 때만(= EditorView 전용, §3-10) **AND** `currentUid === ownerUid`(§3-6).
클릭 → 확인 팝오버(비용 발생 고지 + 대상 + 실행). 진행 표시는 `PendingAIBubble` 재사용 — `PendingAI`가 `{provider, emoji, nickname}`을 받으므로 합성 항목이 그대로 그려진다(`:1195-1240`). ⚠ **재시도 경로는 분기 필요** — `handleRetryAI`가 `aiModels.find(...)`를 탄다.
실행 흐름: dirty면 저장(§3-8) → 블록 수집(`block_key` 포함) → `/api/verify` → 리포트 `addComment` → `setVerification` → 스레드에 카드 등장.
⚠ D7(현재 활성 세션에 꽂는다) 유지 — **agent 모드는 세션이 없으면 전송 자체가 막힌다**(`CommentPanel.tsx:594-597`). 세션이 없으면 `createNormalSession`으로 자동 생성한다.

### 5.6 리포트 카드

저장 형태 = `mathory-graph` 선례 그대로: `content`에 사람이 읽는 markdown 요약(종합 판정 + "지적 n건" — 공개 뷰어·폴백용) + ` ```mathory-verify ` 펜스에 `VerifyReport` JSON.
렌더: `VerifyReportCard` — 종합 배지(ok/check/fail/skip) + 지적 목록(태그 칩 · 인용 · 이유 · 제안 · `quoteFound=false`면 "원문 미확인" 표시) + `answerCheck` + 모델·비용 각주 + `derivedAnswer`는 카드 자체 토글(**`<details>` 금지** — §3-5(b)).
지적 클릭 → `onJumpToBlock(blockKey, tabId)`(§3-11).
`stripForHistory`에 `mathory-verify` 펜스 치환 추가 → 후속 대화 히스토리에는 markdown 요약만 남는다.

### 5.7 상태 관리

- `setVerification(problemId, kind, patch)` — `lib/firestore.ts` 신규, `updated_at` 미갱신(§3-9).
- stale = 탭 해시 비교(§3-4), `handleSave`에서 값이 바뀔 때만 write.
- 배지: `ListView`·`FolderView`에 ✓/⚠/✕ + stale이면 "재검증 필요". 기존 `badgeStyle` 관례.
- 규칙 0 · 마이그레이션 0(미검증 문항은 필드 자체가 없다).

---

## 6. 결정사항 (v1 D1~D7 + 신규 D8~D14)

| # | 결정 | v1 대비 |
|---|---|---|
| D1 | `/api/verify` 인증 = `verifyUid` 공용 모듈 추출 + 허용목록 fail-closed. env는 `VERIFY_ALLOWED_UIDS ?? AUDITION_ALLOWED_UIDS` | 보강 |
| D2 | 판정 어휘 `ok/check/fail/skip` 통일. API 실패는 verdict가 아니다 | 유지 |
| D3 | 2차 Claude 출력 = JSON-in-text + 견고 파싱 — **근거는 prefill 400**(§3-1e) | 근거 정정 |
| D4 | 검증 칩은 **오너 전용 (규칙이 강제)** | **정책 → 필수** |
| D5′ | stale = **탭 정규화 해시 비교**(`canonicalizeTab` + `sha256`), 저장 시 계산·불리언 기록 | **개정** |
| D6′ | `derivedAnswer`는 JSON에만. markdown 본문·`<details>` 금지. 멤버 열람은 막히지 않음을 인지 | **개정** |
| D7 | 리포트는 현재 활성 세션에 꽂는다(없으면 자동 생성) | 유지 |
| **D8** | provider 확장으로 간다 — `CompleteOptions`에 thinking/effort additive + `getVerifyProviders` export. SDK 직접 호출(proofread식)은 code_execution 파싱 재작성 비용 때문에 기각 | 신규 |
| **D9** | verify에서 `tool_choice:{type:'any'}` 금지 + `pause_turn` 루프(상한 3) 필수 | 신규 |
| **D10** | 블록 앵커는 **인용 매칭으로 서버가 확정**, `[블록 n]` 라벨은 힌트로 격하. 미매칭 지적은 `check` 강등 + `blockKey:null` | 신규 |
| **D11** | 검증 전 dirty면 저장 강제, 저장 실패면 미실행 | 신규 |
| **D12** | 칩·블록점프는 `onRunVerify`/`onJumpToBlock` **EditorView 주입 전용**(ProblemView 무변경) | 신규 |
| **D13** | 부분 실패(1차 성공·2차 실패) = **`check` + 1차 후보를 `check` findings로 반환 + `models.judge=null`**. 전부 버리지 않는다 | 신규 |
| **D14** | 컨텍스트 15,000자 상한 초과 → `skip` + 사유. 자르고 검증하지 않는다 | 신규 |

---

## 7. 작업 순서 (파일뿐 우선 — 각 스텝이 기획서 단계 2→3→4에 대응)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/ai-provider.ts` 확장(D8·D9) + `lib/apiAuth.ts` 추출 | discuss·proofread 회귀 없음(수동 1회씩), thinking/effort가 실제 요청 바디에 실림(로그 확인) |
| 1 | `lib/verify/prompts.ts` + `lib/verify/parse.ts` + `npm run test:verify` | `$$` 치환·`\frac` 복구·4단계 폴백·합성 규칙 회귀 통과 |
| 2 | `/api/verify` 라우트(인증·예산·비용) | 실제 문항 3~5건(61a로 가져온 것 중 오류 포함 문항 섞어서) 수동 호출 → **유일한 관문: 프롬프트·판정 문의 실물 확정**. 중/과검출 피드백 반영. 토큰·비용 실측 기록 |
| 3 | 칩 2개 + 비용 팝오버 + 최소 표시(요약 markdown만) | agent 창에서 버튼으로 실행·확인 (단계 2 완성) |
| 4 | `mathory-verify` 카드 + 블록 점프 + `stripForHistory` | 지적 클릭 → 블록 이동, 카드 아래 후속 대화로 재추궁 동작 (단계 3) |
| 5 | `verification` + stale 해시 + 목록 배지 | 검증 → 배지 / 해당 탭 편집 → "재검증 필요" / **되돌리면 자동 해제** (단계 4) |
| 6 | 마무리: 부분 실패·타임아웃·상한 초과 경로, roadmap·Phase 문서 | 실패 시 이중 갱신·배지 오염 없음 확인 |

**스텝 2가 유일한 프롬프트 관문이다** — 판정 품질은 사양이 아니라 실물로 확정한다.

---

## 8. 하지 말 것 / 주의

- 교정(proofread)과 합치지 말 것 — 별도 유지가 기획서 B-2 확정.
- GAS 프로젝트·시트 수정 금지. GAS 인용은 origin/main(`b6b91f6`)만 (61a Z2 규칙).
- 그림(이미지) 이해 검증 시도 금지 → `skip` + 이유. "더 좋은 풀이 제안" 범위 밖.
- `verification`에 findings·derivedAnswer를 넣지 말 것 — 그 문서는 public·member가 읽는다.
- 리포트를 별도 컬렉션에 저장하지 말 것 — 메시지(comment)가 단일 저장소.
- API 실패·파싱 실패 시 `verification`을 갱신하지 말 것.
- `snapshotCurrent`의 `last_version_tab_hashes`를 stale 신호로 쓰지 말 것(자동저장에서 갱신 안 됨).
- `<details>`를 리포트에 쓰지 말 것(`stripForHistory`가 "검산 코드 첨부됨"으로 치환).
- `EditorView.scrollIntoView` 금지 — 스크롤은 `lib/editorScroll.ts` 경유(CLAUDE.md).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 9. 이 Phase가 건드리지 않는 것

시트 가져오기 · Firestore 보안 규칙 · 마이그레이션 · 인쇄 · 공개 뷰어 · 전처리 파이프라인 · discuss/proofread/ocr/ai-complete **라우트**. **전부 0건.**
신규 파일 5개(`app/api/verify/route.ts`, `lib/verify/prompts.ts`, `lib/verify/parse.ts`, `lib/apiAuth.ts`, `components/comment/VerifyReportCard.tsx`) + `types/problem.ts` additive + `lib/ai-provider.ts`(additive 옵션) + `lib/firestore.ts`(`setVerification`) + `CommentPanel`·`EditorView`·`ListView`·`FolderView` 각 소폭.

---

## 10. 웹 클로드에 물을 것 (v2 검증 턴 안건)

1. **D13(부분 실패 → check 강등)** — 1차 후보만으로 만든 리포트를 사용자에게 보여주는 것이 정직한가, 아니면 "2차 실패"로 아무것도 안 주는 편이 나은가? 후보는 recall 편향(과검출)이라 그대로 보이면 오탐이 늘어난다.
2. **D6′의 남은 구멍** — 멤버가 문서를 직접 읽으면 `derivedAnswer`가 보인다. (a) 그대로 두고 카드에서만 감춘다 / (b) `derivedAnswer`를 아예 저장하지 않고 서버가 `answerCheck`만 돌려준다 / (c) 리포트를 오너 전용 서브컬렉션으로 뺀다(규칙 변경 발생, 기획서 "규칙 0" 위배). 어느 쪽?
3. **D10(인용 매칭 앵커)** — 공백 제거 후 `indexOf`는 축약 인용("…" 생략)에 약하다. 앞 20자 프리픽스 매칭 등으로 완화할지, 아니면 프롬프트에서 **연속 원문 인용**을 강제할지.
4. **스텝 0의 범위** — `ai-provider.ts`를 건드리는 것이 discuss 회귀 위험을 만든다. 대안으로 verify 전용 얇은 클라이언트를 새로 쓰되 code_execution 파싱만 헬퍼로 뽑아 공유하는 안은 어떤가?
5. **검증 단위** — 지금은 탭 전체다. 61a로 대량 가져온 문항을 상대하면 "폴더 단위 일괄 검증"이 곧 필요해진다. 61b에서 배치 훅(큐·진행률)을 미리 남길지, 61c로 미룰지.
