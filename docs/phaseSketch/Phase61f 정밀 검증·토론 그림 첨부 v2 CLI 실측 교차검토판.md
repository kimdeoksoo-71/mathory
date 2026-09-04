# Phase 61f — 정밀 검증·agent 토론 그림 첨부 v2 (CLI 실측 교차검토판)

> 작성: CLI(Claude Code) 2026-09-04 · 저본: v1(web, 09-03 초안 → 09-04 토론 포함 개정)
> 계보: v1(web) → **v2(CLI 실측 교차검토)** → v3(web 재검증) → v4(착수판)
> 대조 기준: mathory `aa938a4`(= 61e-2차 검수 완료 시점) · `node_modules` 실물 타입 · gas-project-audition `8ebb218`

---

## 0. 판정

**v1의 원인 분석(R1~R10)은 전항 실측 확인됐고, 해결 방향과 결정 D1~D17도 그대로 유효하다.** 반려·기각할 항목은 없다.

다만 **정정·보완 10건(C1~C10)** 이 나왔고 그중 하나는 계획대로 구현하면 **조용히 어긋난다**:

- **C2 — 토론 컨텍스트의 15,000자 자르기가 그림 번호를 깬다.** `buildContext`는 문자열 **중간을 자르는데**(`otherContent.slice(0, room)`), 잘려 나간 `[그림]`의 이미지는 여전히 첨부된다 → **k 번호가 밀려 모델이 다른 그림을 가리킨다.** D14가 "텍스트 예산이 오히려 늘어난다"만 보고 이 어긋남을 놓쳤다. → **D19 신설.**

그리고 **v1의 열린 질문 1·3·4는 이 판에서 해소**됐다(SDK 타입 실물 확인). 2·5·6은 실호출/실사용이라 남는다.

신규 결정 **3건(D18~D20)** 을 §4에 권장안과 함께 둔다.

---

## 1. v1 사실 검증 (R1~R10 전항)

| # | v1 주장 | 판정 | 실측 |
|---|---|---|---|
| R1 | `verifyBlocksOf`가 미디어 블록을 통째로 제외 | **확인** | `lib/verifyFlow.ts:21-30` — `.filter((b) => !['image','svg','ggb'].includes(b.type))` |
| R2 | `hasImages`는 선언만 있고 아무도 안 읽는다 | **확인** | 클라 `verifyFlow.ts:135` 전송 · 서버 `app/api/verify/route.ts:116` 선언. 전수 grep에서 **소비처 0** |
| R3 | 프롬프트가 "당신은 이미지를 보지 못합니다 → skip" | **확인 + 정정** | `lib/verify/prompts.ts:**91-92**`(v1은 `:91`만 적었다. 두 줄이다) · 2차 `:315` |
| R4 | 두 패스가 다 skip이면 `report(kind,'skip',…)`, `judge: null` | **확인** | `route.ts:236-247` (v1의 "235-246"과 1줄 차) |
| R5 | Gemini는 문자열 하나만 넘긴다 | **확인** | `lib/ai-provider.ts:103` `model.generateContent(userPrompt)` |
| R6 | Claude도 문자열 content | **확인 + 정정** | `messages` 조립은 `:377`이 아니라 **`:379`** — `const messages: unknown[] = [{ role:'user', content: userPrompt }]` |
| R7 | `fetchTabBlocksText`가 모든 블록을 `title+raw_text`로 이어 붙인다 | **확인** | `CommentPanel.tsx:478-495`. `snap.docs.map(d => d.data() as Block)`이라 **`type`은 이미 손에 있다** → D11-(a)의 전제가 성립 |
| R8 | 토론 메시지 그림도 `<img …>` 문자열 | **확인** | `CommentEditor.tsx:78-80` `<img src="${url}" alt="${baseName}" width="400" />` |
| R9 | `buildUserPrompt`가 문자열로만 합성 | **확인** | `discuss/route.ts:363-388` |
| R10 | provider 다섯 종 · 무인증 | **확인** | `types/problem.ts:170` `'google'\|'openai'\|'deepseek'\|'xai'\|'anthropic'`, `getProviderForModel`(`ai-provider.ts:501-526`)이 google/anthropic/openai를 분기하고 **나머지는 `OpenAICompatProvider`** 로 떨어진다 |

**배제 항목도 확인**: `storage.rules`의 `problems/{problemId}/{fileName=**}`는 `allow read;`(무조건) — 서버가 다운로드 URL을 그대로 fetch할 수 있다. `TARGET_WIDTH = 600`(`lib/storage.ts:7`).

---

## 2. SDK·플랫폼 실측 (v1 §7 열린 질문 1·3·4 해소)

| # | 질문 | 답 |
|---|---|---|
| **Q1** | `@google/generative-ai@0.24`가 `[{text},{inlineData}]`를 받나 | **받는다.** `generateContent(request: GenerateContentRequest \| string \| Array<string \| Part>)`(`generative-ai.d.ts:754`), `InlineDataPart { inlineData: GenerativeContentBlob }`(`:1034`), `Part` 유니온에 포함(`:1152`). ⚠ `thinkingConfig`는 **`getGenerativeModel({generationConfig})`** 쪽이라(`ai-provider.ts:97`) content 경로와 **닿지 않는다 — 구조상 충돌 없다.** 남은 것은 실호출 확인뿐 |
| **Q3** | Responses `input_image`의 형태와 `detail` 기본값 | **`detail`은 선택이 아니라 필수다.** `ResponseInputImage`(`openai/resources/responses/responses.d.ts:2843-2862`)에서 `detail: 'low'\|'high'\|'auto'\|'original'` — **`?`가 없다.** `image_url?: string\|null`이 "fully qualified URL 또는 base64 data URL"을 받는다. → v1의 `detail:'auto'`는 옳고 **생략 불가** |
| **Q4** | Storage에 저장되는 `content-type` | **`image/png` 또는 `image/jpeg` 둘뿐이다.** `resizeImage`가 canvas `toBlob(outputType)`으로 재인코딩하고(`storage.ts:48-49` — 원본이 png면 png, **그 외는 전부 jpeg**) 그 Blob을 `uploadBytes`에 넘긴다(`:88`). `application/octet-stream`은 `.ggb` 때문에 규칙에 허용돼 있을 뿐 이미지 경로엔 안 나온다. **매직 바이트 폴백은 불필요하다.** ⚠ 부수 사실 둘: **webp 원본도 jpeg로 재인코딩**되므로 `FIG_MIME_OK`의 webp는 리사이즈 실패 폴백에서만 쓰인다(남겨 두는 편이 안전). 그리고 **시트 가져오기 그림도 `uploadImage`를 탄다**(`SheetImportModal` N-9) → 600px 리사이즈가 걸려 D7의 장당 4MB는 넉넉하다 |
| **Q2′** | Claude `image` 블록 타입 | `ImageBlockParam.Source { data, media_type: 'image/jpeg'\|'image/png'\|'image/gif'\|'image/webp', type: 'base64' }`(`messages.d.ts:28-38`). **닫힌 유니온**이라 우리 `mimeType: string`을 그대로 넣으면 타입 오류 → `buildClaudeParams`가 이미 쓰는 `unknown` 캐스트 관례를 따를 것. ⚠ **gif는 Claude·OpenAI가 받고 Gemini가 안 받는다** → `FIG_MIME_OK`에서 gif를 뺀 v1의 판단(최소공통분모)이 맞다. `thinking`·`code_execution`과의 병용은 실호출로만 확인 가능 → 열린 채 |

---

## 3. 정정·보완 (C1~C10)

### C1 — `normalizeBlocks`가 미지 필드를 **버린다** (v1 §4-2가 "받아"로 뭉갠 자리)

`app/api/verify/route.ts:394-406`은 받은 객체를 그대로 쓰지 않고 **`{blockKey, type, text}`로 재구성**한다. `imageUrl`을 실으려면 **두 자리**를 함께 고쳐야 한다:

1. `LabeledBlock`(**`lib/verify/prompts.ts:36`** — import 0 모듈이 소유하고 `labelBlocks`·`totalChars`가 쓴다)에 `imageUrl?: string`
2. `normalizeBlocks`에 그 필드 추가 + `isOwnStorageUrl` 통과분만 유지

### C2 — ⚠ **토론 컨텍스트 자르기가 그림 번호를 깬다** (v1 누락, 이 판의 최대 수확)

```ts
// CommentPanel.tsx:509-512
const room = Math.max(0, CONTEXT_CHAR_CAP - problemContent.length);
if (otherContent.length > room) otherContent = otherContent.slice(0, room);   // ← 문자열 중간을 자른다
```

`images` 배열을 자르기와 **무관하게** 만들면, 잘려 나간 `[그림]`의 이미지가 그대로 첨부돼 **k 번호가 밀린다**. 모델이 `[그림 4]`를 본문에서 못 찾거나 **다른 그림을 가리킨다.** D14는 "URL이 4자로 줄어 텍스트 예산이 오히려 늘어난다"만 보고 이 어긋남을 못 봤다(그 서술 자체는 맞다). → **D19.**

### C3 — `hasMedia`는 D9와 함께 **죽는다**

전수 grep 결과 소비처는 `verifyFlow.ts:135` **하나뿐**이다. D9로 전송을 끊으면 `hasMedia`는 완전한 죽은 코드가 된다 → **함께 삭제할 것.** (죽은 필드 하나를 없애면서 죽은 함수를 남기면 같은 실수를 반복하는 것이다.)

### C4 — D4의 61d 파급은 **코드 변경 0으로 전파된다** (좋은 소식, v1이 경로를 안 적었다)

`lib/batchVerify.ts:76-77`이 `verifyBlocksOf(...).length`로 `questionBlockCount`를 만들고, `batchPlan.ts:110`이 그 수치를 받아 `empty_question`을 판정한다. `batchPlan`은 **수치 주입형(W1)** 이라 무변경이다 → **image 블록이 포함되는 순간 사전 차단이 저절로 풀린다.** 검수 항목으로 명시할 것.

### C5 — `providerParams.ts`에 **OpenAI 빌더가 없다**

현재 export는 `buildClaudeParams` · `buildGeminiConfig` · `resolveMaxToolTurns` · 상수 2개뿐이고, **Responses 바디는 `ai-provider.ts:212`가 직접 만든다.** 따라서 `buildOpenAIResponsesInput`은 "확장"이 아니라 **이관 신설**이고 회귀 스냅샷 대상이 하나 는다.
⚠ 그리고 **`ParamOptions`(providerParams:13)와 `CompleteOptions`(ai-provider:37)는 별개 선언의 사본**이다 — `images`를 **양쪽에** 넣어야 한다. 한쪽만 넣으면 타입은 통과하고 값이 조용히 안 넘어간다.

### C6 — OpenAI `detail`은 **필수**(Q3). C7 — Claude `media_type`은 **닫힌 유니온 + `type:'base64'` 필수**(Q2′). C8 — Gemini 배열 content는 **타입상 유효**(Q1).

### C9 — content-type 폴백은 **불필요**(Q4). v1 §7-4의 "매직 바이트 판별 폴백 검토"는 닫아도 된다.

### C10 — 앵커의 **알고 둘 손실** (v1 미기재)

image 블록이 `targetBlocks`에 들어가면, 서버의 `anchorByQuote`는 **번호가 붙은 블록 텍스트**(`[그림 1]`)를 보므로 그림 인용이 그 블록에 정상 앵커된다. 그러나 클라의 `findQuoteRange`는 **블록 `raw_text`** 를 본다(`ProblemView.tsx:391` · `EditorView.tsx:2934`) — image 블록의 raw_text는 `<img src="…">`라 `[그림 1]`이 없다 → **점프는 되고 글자 하이라이트만 안 걸린다.** 수용 가능하지만 검수에서 "버그 아님"으로 알아볼 수 있게 기록해 둘 것.

### C10′ — D8은 **모든** 검증 요청의 프롬프트를 바꾼다

`COMMON_RULES`는 그림 유무와 무관하게 전 요청에 들어간다. 61b가 남긴 규약 두 개가 여기 걸린다: **"n=10 표본으로 프롬프트 판본을 가리지 말 것"**(검출 3↔4는 노이즈다), **"프롬프트 조정은 `scripts/verifyProbe.mjs`로"**. → D8 문구 확정은 프로브로 하고, **소표본 A/B로 되돌리지 말 것.** ⚠ 프로브가 라우트와 프롬프트·파서·바디 조립을 공유하므로, **images를 태우려면 프로브도 함께 고쳐야** 판본 비교가 성립한다.

---

## 4. 신규 결정 (권장안 먼저)

### D18 — 그림 fetch 캐시

| 선택지 | 내용 |
|---|---|
| **(a) 요청 내 중복만 제거, 크로스 요청 캐시 없음 (권장)** | 같은 URL은 한 번만 받아 재사용 |
| (b) 모듈 스코프 LRU (GAS `IV_IMG_CACHE` 등가) | warm 인스턴스에서 재사용 |

**권장 (a).** 토론은 **모델 수만큼 별도 요청**이다(클라 `invokeOneAI`가 모델별로 `/api/discuss`를 부른다) → 같은 그림을 N번 받는다. 그래도 (b)는 **람다 인스턴스가 갈리면 적중률이 낮고**, 600px 재인코딩 이미지라 장당 수십~수백 KB다. 신선도(그림 교체)·메모리 위험 대비 이득이 작다. 실측에서 지연이 문제가 되면 그때 연다.

### D19 — 자르기와 그림 번호의 정합 (C2)

| 선택지 | 내용 |
|---|---|
| **(a) 자르기를 먼저 하고, 남은 텍스트의 `[그림]`을 기준으로 images를 거른다 (권장)** | `buildContext`의 동작은 그대로 |
| (b) 자르기를 **블록 경계**로 바꾸고 잘려 나간 블록의 이미지를 제외 | 컨텍스트 조립 자체를 개편 |

**권장 (a).** 번호 매기기는 **반드시 자른 뒤**여야 한다는 것이 핵심이고, (a)는 그 한 가지만 보장하면서 `buildContext`의 기존 동작(question 보존·뒤에서 자름)을 건드리지 않는다. (b)는 더 깔끔하지만 Phase 47부터의 컨텍스트 규약을 바꾸는 일이라 이번 범위 밖이다.
⚠ 구현 규약으로 남길 것: **`numberFigures`는 최종 프롬프트 문자열이 확정된 뒤 한 번에 적용한다**(v1 §4-6-4가 이미 "한 번에 순회"라고 적었다 — C2는 그 앞단인 *자르기*가 그 순회 밖에 있다는 문제다).

### D20 — image 블록을 검증 앵커 후보에서 뺄지 (C10)

**권장: 그대로 둔다.** 그림 지적이 그림 블록을 가리키는 것이 자연스럽고, 점프는 정상 동작한다. 하이라이트 부재는 **알고 두는 손실**로 기록한다. (빼면 그림 지적이 엉뚱한 텍스트 블록에 앵커되거나 `check`로 강등된다 — 더 나쁘다.)

---

## 5. v1에서 바뀌는 것 (착수 전 반영 목록)

| # | v1 항목 | v2 반영 |
|---|---|---|
| 1 | §4-2-2 "`normalizeBlocks`: `imageUrl`을 받아…" | **`LabeledBlock`(prompts.ts:36) 확장 + `normalizeBlocks` 필드 추가** 두 자리로 구체화(C1) |
| 2 | §4-5 토론 클라 | **자르기 뒤 images 재정렬**을 명시(C2·D19). `fetchTabBlocksText` 소비처는 `buildContext` **하나뿐**이라 시그니처 변경은 안전 |
| 3 | D9 "`hasImages` 전송 중단" | **`hasMedia` 함수도 함께 삭제**(C3) |
| 4 | §4-1 "효과 1건(의도됨)" | 경로 명시 — `batchVerify.ts:76` → `batchPlan.ts:110`, **batchPlan 코드 변경 0**(C4) |
| 5 | §4-3 "`providerParams.ts`(확장)" | **OpenAI 빌더는 신설 이관**이고 `ParamOptions`·`CompleteOptions` **양쪽에** `images`(C5) |
| 6 | §4-3 OpenAI `detail:'auto'` | **필수 필드**임을 명시(C6) |
| 7 | §2-1 `FIG_MIME_OK` | gif 제외 근거 유지 + **webp는 사실상 미사용**(Q4) 주석 |
| 8 | §7-1·3·4 열린 질문 | **해소**(§2). §7-4의 매직 바이트 폴백 검토는 **닫는다** |
| 9 | §4-7 테스트 | `tests/figures.test.mjs`에 **자르기 뒤 번호 정합**(D19) 케이스 추가. 앵커 손실(C10)은 테스트 대상 아님 — 검수 항목으로 |
| 10 | §5 무회귀 | **프로브(`scripts/verifyProbe.mjs`)도 images를 태워야** D8 판본 비교가 성립(C10′) |

**v1의 D1~D17은 전부 유지된다.** 특히 D1(서버 fetch) · D2(SSRF 화이트리스트) · D5(svg·ggb는 자리표시자만) · D6(실패해도 텍스트로 계속) · D10(그림 없으면 바이트 동일) · D13(vision 미지원 provider도 자리표시자+꼬리말)은 실측으로 근거가 더 단단해졌다.

---

## 6. 작업 순서 · 관문

1. **`lib/verify/figures.ts` + `tests/figures.test.mjs`** — 순수 함수부터. 관문: `test:verify` 통과, 기존 45건 무회귀.
2. **`providerParams` 3종 빌더 + `ai-provider` 배선** — 관문: **images 미전달 시 요청 바디가 문자열 그대로**(D10)를 스냅샷으로 고정. proofread·ai-complete·discuss(그림 없는 문항)가 바이트 동일.
3. **`lib/figureFetch.ts`** — 관문: 자기 버킷 `problems/` URL만 통과, 그 밖 전부 거절(SSRF 케이스 표).
4. **검증 경로**(verifyFlow · verify/route · prompts D8) — 관문: 그림 문항이 `skip`이 아니라 실제 판정을 낸다.
5. **토론 경로**(CommentPanel · discuss/route) — 관문: **자르기 뒤 번호 정합**(D19)과 vision 미지원 모델의 자리표시자.
6. **실사용 검수** — v1 §4-7 "수동(CLI 실측)" 표 그대로 + ⑥ **그림만 있는 문항이 61d 일괄 검증에서 `empty_question`으로 차단되지 않는다**(C4).

---

## 7. 남은 열린 질문 (v3/실호출로)

1. **Q2** — Claude `image` + `thinking:'adaptive'` + `output_config.effort` 병용, 그리고 토론 경로의 `tools:code_execution`과 동시 사용. **타입은 확인됐고 실호출만 남았다.**
2. **Q5** — D12-③(히스토리 그림)이 상한 6장을 실제로 밀어내는지. 밀어내면 D12-(c)로 좁힌다.
3. **Q6** — `scanImgTags`가 코드 펜스 안 `<img>`를 그림으로 잡는 손실이 실제로 나오는지. ⚠ **61c에 전례가 있다** — `lib/chatExtract.ts`가 코드펜스·인라인 코드를 **길이·개행을 보존하며 마스킹**한 뒤 인덱싱한다. 필요해지면 그 방식을 그대로 가져올 것(새로 짜지 말 것).
4. **Q7(신설)** — 그림 1장당 실제 `inputTokens` 증가분(Gemini/Claude/GPT). v1 추정(258~1,032 / 500 / 수백)의 검증. 비용보다 **300초 예산**에 영향이 있는지가 핵심.

---

*v2 — mathory `aa938a4` · node_modules 실물 타입 대조. R1~R10 전항 확인 · 정정 10건(C1~C10′) · 열린 질문 3건 해소 · 신규 결정 3건(D18~D20). 다음: web 재검증(v3).*
