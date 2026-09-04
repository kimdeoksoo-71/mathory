# Phase 61f — 정밀 검증·agent 토론 그림 첨부 구현 계획서 v1 (개정: agent 토론 포함)

> 작성: web Claude, 2026-09-03 초안 → 2026-09-04 개정(agent 토론 범위 편입). 관례대로 CLI Claude의 실측 교차검토(v2) → web 재검증(v3)을 거친다.
> 참조 리포지토리: `kimdeoksoo-71/mathory` origin/main (2026-09-03 clone), `kimdeoksoo-71/gas-project-audition` origin/main.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 증상 | 그림이 정상적으로 image 블록으로 들어 있는 문항(예: 강대모의X14(260903)_1공통07)을 일괄 검증하면 문제·풀이 검증 모두 **"검증 안 함 · 이미지를 확인할 수 없어…"** 로 끝난다. agent 토론(새 토론)도 그림을 보지 못한다 — 모델에게는 `<img src="https://firebasestorage…">` **문자열**만 간다 |
| 원인 한 문장 | **Mathory의 AI 경로 두 갈래(정밀 검증·agent 토론) 어느 쪽도 그림 바이트를 모델에 보내지 않는다.** 검증은 image 블록을 걸러내고(`verifyBlocksOf`) 프롬프트가 "당신은 이미지를 보지 못합니다 → skip"을 명시하며, 토론은 `<img>` 태그 문자열을 텍스트로 넘긴다. Gemini의 답은 정확하다 — 실제로 아무 이미지도 받지 못했다 |
| 성격 | 버그가 아니라 61e에서 "알고 두는 손실"로 기록하고 61f로 미룬 항목(61e v5 R2·D19, `CLAUDE.md:288`). 시트 쪽은 GAS 패치 12·13(2026-09-02 파이프라인 테스트 성공)으로 해결됐고 Mathory만 남았다 |
| 해결 | GAS 패치 12·13을 이식한다 — 서버가 Storage의 그림을 받아 **Gemini `inlineData`·Claude `image`·OpenAI `input_image`로 첨부**하고, 본문에는 `[그림 k]` 자리표시자, 꼬리말에 첨부·누락 목록을 붙인다. **검증과 토론이 한 모듈(`lib/verify/figures.ts`)을 공유**한다. 그림이 없는 요청의 바디는 **바이트 단위로 기존과 동일**하게 유지한다 |
| 손대는 파일 | 공용 `lib/verify/figures.ts`(신설) · `lib/figureFetch.ts`(신설) · `lib/verify/providerParams.ts` · `lib/ai-provider.ts` · `lib/verify/prompts.ts` · 검증 `lib/verifyFlow.ts` · `app/api/verify/route.ts` · 토론 `components/comment/CommentPanel.tsx` · `app/api/discuss/route.ts` · 테스트 2건. **GAS·Firestore 규칙·Storage 규칙·블록 스키마·`ai_models` 문서 변경 0** |

---

## 1. 원인 — 실측

### 1-1. 정밀 검증: 그림이 모델까지 가는 길이 세 군데에서 끊겨 있다

| # | 자리 | 실측 | 결과 |
|---|---|---|---|
| R1 | `lib/verifyFlow.ts:21-30` `verifyBlocksOf` | `.filter((b) => !['image','svg','ggb'].includes(b.type))` — 미디어 블록을 **통째로 제외**하고 텍스트 블록만 `{blockKey,type,text}`로 보낸다 | 모델이 받는 본문에는 "그래프가 그림과 같다"는 문장만 남고 그림의 **존재 표시조차 없다** |
| R2 | `lib/verifyFlow.ts:135` → `app/api/verify/route.ts:116` | 클라는 `hasImages: hasMedia(targetRaw)`를 보내지만 서버 `VerifyRequestBody.hasImages`는 **선언만 있고 어디서도 읽지 않는다** (grep 소비처 0) | 61e v5 R2가 지적한 "죽은 필드" 그대로 |
| R3 | `lib/verify/prompts.ts:91` `COMMON_RULES` | *"그림·도형 이미지를 보아야만 판단할 수 있으면 판정하지 말고 `skip`을 택하고 이유를 적습니다. **당신은 이미지를 보지 못합니다.**"* / 2차 `:315` *"그림을 보아야만 판단할 수 있는 후보는 uncertain"* | 모델은 규약대로 `skip:true` + `skip_reason`을 낸다 |
| R4 | `app/api/verify/route.ts:235-246` | `alive.every((j) => j.skip === true)` → `report(kind,'skip',[],{note: skip_reason})`, `models.judge: null` | 화면의 "검증 안 함 · (후보 없음 — 판정 생략)"이 정확히 이 분기다 |
| R5 | `lib/ai-provider.ts:103` `GeminiProvider.complete` | `model.generateContent(userPrompt)` — **문자열 하나**만 넘긴다. `CompleteOptions`에 이미지 개념이 없다 | provider 계층에도 그림을 실을 통로가 없다 |
| R6 | `lib/ai-provider.ts:377` `ClaudeProvider.complete` | `messages = [{ role:'user', content: userPrompt }]` — 문자열 content | 2차 판정도 마찬가지 |

### 1-2. agent 토론: 그림이 "문자열"로 간다

| # | 자리 | 실측 | 결과 |
|---|---|---|---|
| R7 | `components/comment/CommentPanel.tsx:478-495` `fetchTabBlocksText` | 탭의 **모든** 블록을 `title + raw_text`로 이어 붙인다. image 블록의 `raw_text`는 `<img src="https://firebasestorage.googleapis.com/…?alt=media&token=…">`, svg·ggb는 Storage URL | 모델은 200자 남짓의 URL 문자열을 본다. "그림이 있다"는 사실은 알지만 내용은 못 본다. URL이 `CONTEXT_CHAR_CAP 15,000`자를 잠식한다 |
| R8 | `components/comment/CommentEditor.tsx:78-82` | 토론 메시지에 붙인 그림도 `<img src="…" alt="…" width="400" />` 문자열로 본문에 들어간다 | 사용자가 "이 그림 봐줘"라고 붙여도 모델은 태그만 본다 |
| R9 | `app/api/discuss/route.ts:363-388` `buildUserPrompt` | `problemContent`·`currentTabContent`·히스토리·현재 메시지를 **문자열로만** 합성 → `provider.complete(system, userPrompt, …)` | 이미지 통로 없음(R5·R6과 같은 provider) |
| R10 | `app/api/discuss/route.ts` 상단 주석·`getProviderForModel` | 토론은 **provider 다섯 종**(google·anthropic·openai Responses·deepseek·xai)을 쓴다. 라우트는 **무인증**(verify 라우트 주석 `:14`) | 이미지 지원이 모델마다 다르고, 서버가 대신 fetch하는 URL 범위 통제가 검증보다 더 중요하다 |

### 1-3. 왜 지금 드러났나

61e 이전에는 시트에서 가져온 문항의 그림이 `\includegraphics{파일명}` **텍스트**로 본문에 남아 있었다. 그 문자열은 `verifyBlocksOf`를 통과하므로 모델이 최소한 "여기 그림이 있다"는 사실은 알았다. 61e가 그림을 image 블록으로 바꾸면서 그 문자열이 사라졌고, 이것이 61e에서 **"알고 두는 손실"**(C1·D19·R2)로 기록된 바로 그 현상이다. 61e-2차 D26은 *"GAS 검증(패치 12)이 그림 첨부를 이미 해결했으므로 Mathory 쪽 61f 자리표시자의 우선순위를 낮춘다"*고 했는데, 이번 실측은 그 우선순위를 다시 올려야 함을 보여 준다 — **일괄 검증의 주 대상이 시트에서 가져온 그림 문항**이기 때문이다.

### 1-4. 원인이 아닌 것 (확인·배제)

- 그림 블록 자체는 정상이다. 화면에 렌더되고 `raw_text`에 `<img src="https://firebasestorage.googleapis.com/…">`가 있다(`TabBody.tsx:120`).
- Gemini가 이미지를 못 읽는 모델이 아니다. `gemini-3.1-pro-preview`는 멀티모달이고, 같은 모델이 GAS 패치 12·13에서 `inline_data`로 그림을 받아 검증하고 있다.
- Storage 권한 문제가 아니다. `storage.rules`는 `problems/{problemId}/**` **read 전면 허용**(다운로드 URL 토큰이 접근 제어)이라 서버가 URL을 그대로 fetch할 수 있다.
- 비용 표시 `$0.00000`은 `VERIFY_GEMINI_COST_IN/OUT` env가 0이라서이지 호출이 안 된 것이 아니다.

---

## 2. 해결 방향 — GAS 패치 12·13 이식, 검증·토론이 한 모듈을 공유

시트 파이프라인(`gas-project-audition` `Itemverification.gs:645-712`, `callGeminiUnified_:815`)이 검증한 구조를 옮긴다.

| GAS (패치 12·13) | Mathory 61f 대응 |
|---|---|
| `iv_imageParts_(texts)` — 그림 참조를 모아 Drive에서 받아 `{inline_data}` 배열로. 장수·장당 4MB·합계 상한, 캐시, **실패 시 텍스트만으로 계속** | 서버 `fetchFigures(urls, limits)`(`lib/figureFetch.ts`) — Storage URL fetch → base64. 같은 상한·같은 실패 정책. **verify·discuss 두 라우트가 같은 함수** |
| `iv_imageNote_(imgs)` — 꼬리말 *"(참고: 본문의 그림 n장이 이 요청에 이미지로 첨부되어 있습니다: …)"* + 누락분 *"[그림: … — 첨부되지 않음]"* | `buildImageNote(attached, missing)` — 순수 함수, `lib/verify/figures.ts` |
| `userParts = [{text: usr}].concat(imgParts)` — **텍스트 먼저, 이미지 뒤** | Gemini `generateContent([{text}, …inlineData])` / Claude `content: [{type:'text'}, …{type:'image'}]` / OpenAI Responses `content: [{type:'input_text'}, …{type:'input_image'}]` — 같은 순서 |
| Y열 `fig_info` | 검증: 리포트 `note`에 누락분만. 토론: 응답 본문에 기록하지 않음(꼬리말은 모델만 본다) |

**그림 표기 계약(공통)**: 모델이 보는 본문에서 그림은 `[그림 k]`(첨부 성공) 또는 `[그림 k — 첨부되지 않음: 사유]`(실패·미지원)로 나타난다. k는 **한 요청 안에서 등장 순서** 번호다. 꼬리말이 k와 첨부 이미지의 순서를 잇는다.

### 2-1. 공용 모듈 `lib/verify/figures.ts` (신설, import 0, `test:verify`의 tsc 목록에 추가)

```ts
export const FIG_PLACEHOLDER = '[그림]';                          // 클라가 보내는 자리표시자(번호 없음)
export const FIG_LIMITS = { maxCount: 6, maxBytes: 4 * 1024 * 1024, maxTotalBytes: 12 * 1024 * 1024 };
export const FIG_MIME_OK = ['image/png', 'image/jpeg', 'image/webp'];   // gif는 Gemini 미지원 → 누락 처리

/** image 블록 raw_text(`<img src="…">`)·svg/ggb raw_text(URL)에서 src 추출. 없으면 '' */
export function imageSrcOf(type: string, rawText: string): string;
/** 텍스트 안의 `<img src="…">` 태그를 전부 찾아 {src, start, end} 반환(토론 메시지용) */
export function scanImgTags(text: string): { src: string; index: number; length: number }[];
/** D2 화이트리스트: 자기 버킷 Firebase Storage 다운로드 URL + `problems/` 경로만 */
export function isOwnStorageUrl(url: string, bucket: string): boolean;
/** `[그림]` → `[그림 k]` / `[그림 k — 첨부되지 않음: 사유]` 번호 매김 */
export function numberFigures(text: string, statuses: ({ ok: true } | { ok: false; reason: string })[]): string;
/** GAS iv_imageNote_ 이식. attached·missing 모두 0이면 '' (그림 없는 요청의 프롬프트 불변) */
export function buildImageNote(attached: number, missing: { k: number; reason: string }[]): string;
```
클라(`verifyFlow.ts`·`CommentPanel.tsx`)는 이 파일의 `FIG_PLACEHOLDER`·`imageSrcOf`·`scanImgTags`만 import한다 — 프롬프트 전문(`prompts.ts`)은 클라 번들에 실리지 않는다(v1 초안 열린 질문 3 해소).

### 2-2. 서버 전용 `lib/figureFetch.ts` (신설)

`fetchFigures(urls: string[], bucket: string): Promise<{ parts: ImagePart[]; statuses: FigStatus[] }>` — URL마다 `isOwnStorageUrl` → `fetch(url, { signal: AbortSignal.timeout(10_000) })` → `content-type` ∈ `FIG_MIME_OK` → 크기·합계 상한 → base64. 같은 URL은 한 번만 받아 재사용(61e D17과 같은 사정 — 문제·풀이가 같은 그림). 어떤 이유로든 실패한 항목은 `{ok:false, reason}`으로 돌려주고 **던지지 않는다**(D6). `lib/verify/` 밖에 두는 이유: `fetch`·`AbortSignal`을 쓰므로 import-0 tsc 하니스에 넣지 않는다.

---

## 3. 결정사항 (권장안 첫 번째)

### 3-1. 공통·정밀 검증 (D1~D10)

| # | 결정 | 선택지 | 권장 · 근거 |
|---|---|---|---|
| **D1** | 그림 바이트를 누가 받나 | (a) **서버가 Storage 다운로드 URL을 fetch해 base64로 첨부** (b) 클라가 blob→base64로 요청 바디에 실어 보냄 (c) Gemini Files API | **(a)**. (b)는 Vercel 서버리스 **요청 바디 4.5 MB 상한**에 걸린다 — 그림 3장이면 넘친다. 토론은 모델 수만큼 요청이 병렬이라 더 심하다. (c)는 무상태 원칙과 어긋나고 Claude·OpenAI엔 못 쓴다. (a)는 `storage.rules` read 허용을 그대로 쓰고 Admin SDK도 필요 없다 |
| **D2** | 서버가 fetch할 URL 범위 | (a) **자기 버킷의 Firebase Storage 다운로드 URL + `problems/` 경로 접두만** (b) https면 전부 | **(a)**. (b)는 호출자가 서버로 **임의 URL을 대신 읽게 하는(SSRF)** 구멍이다. discuss 라우트는 **무인증**이라(R10) 이 통제가 없으면 인터넷 전체가 우리 서버를 프록시로 쓸 수 있다. 허용 형식: `https://firebasestorage.googleapis.com/v0/b/<NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET>/o/problems%2F…`. 응답 `content-type`이 `FIG_MIME_OK` 밖이면 누락 처리 |
| **D3** | 2차(Claude 판정)에도 첨부하나 | (a) **1차·2차 모두** (b) 1차만 | **(a)**. 2차만 텍스트면 규약 `:315`대로 그림 의존 후보가 전부 `uncertain`으로 남아 1차 첨부의 실익이 사라진다. judge 요청은 클라가 블록을 다시 보내므로 서버가 다시 fetch한다 — Storage 재요청은 싸다 |
| **D4** | `verifyBlocksOf`의 image 블록 처리 | (a) **`{blockKey, type:'image', text:'[그림]', imageUrl}`로 포함** (b) 제외 유지 + 별도 필드 | **(a)**. 본문 순서 안의 위치("그림과 같다" 문장 바로 뒤)가 보존된다. `text` 길이(4자)가 클라 `verifyCharCountOf`와 서버 `totalChars`에 **똑같이** 들어가 셈법 동치(61d W1·`verifyFlow.ts:47`)가 유지된다. ⚠ 서버는 셈을 마친 뒤에 `numberFigures`로 번호를 붙인다 |
| **D5** | svg·ggb 블록 | (a) **첨부하지 않고 `[그림 k — 첨부되지 않음: SVG/GeoGebra]`만** (b) 서버 래스터화 | **(a)**. Gemini inline은 SVG를 받지 않고 래스터화는 `sharp`류 의존성 + Vercel 바이너리 문제다. 자리표시자만으로 61e 이전 수준("그림이 있다")은 회복된다. 래스터화는 후속 |
| **D6** | 첨부 실패 정책 | (a) **텍스트만으로 계속 + 자리표시자·꼬리말에 누락 명시** (b) 오류 | **(a)**. GAS 패치 13과 동일. (b)는 Storage 일시 장애가 일괄 검증 전건·토론 전 모델을 죽인다 |
| **D7** | 상한 | 요청당 **6장**, 장당 **4 MB**, 합 **12 MB** (`FIG_LIMITS`) | `uploadImage`가 600px로 줄여 올리므로 실물은 장당 수십~수백 KB. 상한은 방어용. 초과분은 D6 누락 처리 |
| **D8** | 검증 프롬프트 규약 | (a) **조건부로 고쳐 쓴다** — *"그림이 첨부되어 있으면 그림을 보고 판단합니다. `[그림 k — 첨부되지 않음]`으로 표시된 그림을 보아야만 판단할 수 있으면 skip"* (b) 현행 + 꼬리말만 | **(a)**. 현행 *"당신은 이미지를 보지 못합니다"*는 첨부 후 **거짓**이 되어 모델이 첨부된 그림을 무시하고 skip할 수 있다. 61e D19가 기각한 "hasImages 프롬프트 배선(판본 실험)"과 다르다 — A/B가 아니라 **사실에 맞게 고치는 것**이다 |
| **D9** | `hasImages` 필드 | (a) **클라 전송 중단, 서버 타입은 optional로 남겨 구클라 허용** (b) 그대로 | **(a)**. 죽은 필드를 살려 두면 훗날 "이미 처리됨"으로 읽힌다 |
| **D10** | 그림이 없는 요청 | **바이트 단위 불변** — `images`가 비면 Gemini `generateContent(string)`, Claude `content: string`, OpenAI `input: string` 그대로 | 61b가 `providerParams` 회귀 테스트로 지키는 원칙. discuss·proofread·ai-complete가 같은 provider를 쓴다 |

### 3-2. agent 토론 (D11~D17)

| # | 결정 | 선택지 | 권장 · 근거 |
|---|---|---|---|
| **D11** | 토론에서 그림 URL을 누가 뽑나 | (a) **클라 `CommentPanel`이 블록·메시지에서 뽑아 `images: string[]`로 보내고 본문은 `[그림]`으로 치환** (b) 서버가 `problemContent` 문자열을 정규식으로 파싱 | **(a)**. 클라가 이미 블록 단위로 로드하고 있어(`fetchTabBlocksText`) 블록 타입으로 정확히 가른다. (b)는 사용자가 본문에 손으로 쓴 `<img>`·코드 예시까지 그림으로 오인하고, svg·ggb(URL만 있는 블록)는 태그가 없어 잡지 못한다. 검증(D4)과 같은 구조라 한 계약이 된다 |
| **D12** | 어떤 그림을 첨부하나 | (a) **① 문항 블록(문제→풀이·참고 순) → ② 현재 메시지의 `<img>` → ③ 히스토리(최근 것부터) 순으로 `FIG_LIMITS.maxCount`까지** (b) 문항 블록만 (c) 현재 메시지만 | **(a)**. 사용자가 토론에 그림을 붙이는 이유가 "이걸 봐 달라"(R8)인데 (b)는 그것을 못 본다. 히스토리 그림은 상한이 남을 때만 — 대개 문항 그림 1~2장 + 메시지 그림 1장이라 6장 안에 다 들어간다. 상한을 넘은 것은 `[그림 k — 첨부되지 않음: 장수 상한]` |
| **D13** | 이미지 미지원 provider(deepseek · xai) | (a) **첨부하지 않고 `[그림 k — 첨부되지 않음: 이 모델은 이미지를 받지 않음]` + 꼬리말** (b) 해당 모델을 그림 문항에서 제외 (c) 그림을 텍스트로 묘사해 넘김 | **(a)**. 모델이 "그림이 있는데 자기는 못 본다"는 사실을 알고 답한다 — 지금은 그것조차 URL 문자열에서 추측한다. (b)는 토론 참여자를 줄이고, (c)는 다른 모델의 묘사를 사실처럼 주입하는 것이라 보수적 운영 철학과 어긋난다. 판정은 **provider 기반 순수 함수 `isVisionProvider`** — `isCodeExecutionModel`·`isGraphModel`(`discuss/route.ts:352-361`)과 같은 관례. `ai_models` 문서 필드 추가는 하지 않는다(xai가 vision을 지원하는 모델을 쓰게 되면 그때 필드로 승격) |
| **D14** | 토론 컨텍스트 상한과 그림 | **그림 바이트는 `CONTEXT_CHAR_CAP 15,000`자와 별도**(`FIG_LIMITS`가 상한). URL 문자열이 `[그림]` 4자로 줄어 **텍스트 예산은 오히려 늘어난다** | 그림 1장의 URL이 ~200자였다. 상한 셈법은 현행(`CommentPanel.tsx:499-513`) 그대로 |
| **D15** | 토론 시스템 프롬프트 | (a) **규칙 1건 추가(#14)** — *"본문의 `[그림 k]`는 이 요청에 첨부된 k번째 이미지다. 첨부되지 않은 그림을 근거로 단정하지 말고 '그림 확인 필요'로 남긴다"* (b) 꼬리말만 | **(a)**. 토론 프롬프트는 검증과 달리 "이미지를 보지 못한다"는 문구가 없어 고칠 것은 없고, 자리표시자의 의미만 알려 주면 된다. 규칙은 provider 무관하게 넣고(첨부 여부는 꼬리말이 말한다), 식(DeepSeek) JSON 강제와 충돌하지 않는다 |
| **D16** | 히스토리 안 `[그림 k]` 번호의 유효성 | 히스토리 메시지(사람·AI)에 남은 옛 `[그림 k]`는 **그 요청 당시 번호**라 이번 요청과 어긋날 수 있다 → `stripForHistory`에서 **`[그림 k]` → `[그림]`으로 번호를 지운다** | 옛 번호를 두면 모델이 다른 그림을 가리킨다. 사용자 메시지 저장본(Firestore)은 손대지 않는다 — `stripForHistory`는 전송용 가공만 한다(`CommentPanel.tsx:36-42`의 기존 역할) |
| **D17** | 무인증 라우트의 비용 | 그림 첨부는 **인증을 새로 요구하지 않는다** — discuss가 무인증인 것은 61b 때부터의 상태이고 이번 범위가 아니다. 다만 D2·D7이 **fetch 비용의 상한**을 준다(임의 URL 불가, 요청당 12 MB) | 인증 추가는 별도 Phase(61e v1 §2-2 ②가 언급한 "라우트 인증"). 여기서 섣불리 넣으면 공개 문항의 비로그인 열람자 토론 경로가 어떻게 되는지부터 정리해야 한다 |

---

## 4. 구현 사양

### 4-1. `lib/verifyFlow.ts` (검증 클라)

```ts
export interface VerifyBlockPayload { blockKey: string; type: string; text: string; imageUrl?: string }

export function verifyBlocksOf(blocks: Block[]): VerifyBlockPayload[] {
  return blocks
    .map((b) => {
      if (b.type === 'image' || b.type === 'svg' || b.type === 'ggb') {
        const src = b.type === 'image' ? imageSrcOf(b.type, b.raw_text) : '';   // svg·ggb는 D5: URL을 보내지 않는다
        return { blockKey: blockKeyOf(b), type: b.type, text: FIG_PLACEHOLDER, ...(src ? { imageUrl: src } : {}) };
      }
      return { blockKey: blockKeyOf(b), type: b.type, text: (b.title ? `### ${b.title}\n` : '') + (b.raw_text || '') };
    })
    .filter((b) => b.text.trim());
}
```
- `hasMedia`·`hasImages` 전송 제거(D9). `verifyCharCountOf` 변경 0 — `[그림]` 4자가 자연히 포함된다.
- **효과 1건(의도됨)**: question 탭이 image 블록뿐인 문항이 61d 프리플라이트 `empty_question`에 더는 걸리지 않는다(61e N-8의 사전 차단 해소).

### 4-2. `app/api/verify/route.ts` (검증 서버)

1. `readEnv`에 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 추가(필수).
2. `normalizeBlocks`: `imageUrl`을 받되 `isOwnStorageUrl`을 통과한 것만 남긴다.
3. `chars` 계산(`:175`)은 **현행 그대로 자리표시자 포함 상태에서** — 클라 셈법과 동치.
4. `const figs = await fetchFigures(urlsOf([...problemBlocks, ...solutionBlocks]), env.bucket)` → `numberFigures`로 각 블록 `text`를 `[그림 k]`/`[그림 k — 첨부되지 않음: …]`로 덮어쓴다(svg·ggb는 URL이 없으니 곧장 누락 사유 `SVG/GeoGebra`).
5. 1차 두 패스(풀이)·2차 모두 같은 `figs.parts`: `first.complete(system, user + buildImageNote(…), FIRST_MAX_TOKENS, { …, images: figs.parts })`, `judge.complete(…, { …, images: figs.parts })`.
6. 리포트 `note`: 누락이 있으면 `'첨부되지 않은 그림 n장: …'`을 이어 붙인다.
7. `hasImages` — optional로 남기고 주석을 **"61f: 구클라 호환용 잔존, 소비처 없음"**으로.

### 4-3. `lib/verify/providerParams.ts` (순수, import 0) · `lib/ai-provider.ts`

```ts
export interface ImagePart { mimeType: string; data: string }   // data = base64
export interface ParamOptions { …기존…; images?: ImagePart[] }

/** images가 비면 **문자열 그대로**(D10). 텍스트 먼저, 이미지 뒤(GAS 순서) */
export function buildGeminiContent(userPrompt: string, opts?: ParamOptions): string | unknown[];
export function buildClaudeUserContent(userPrompt: string, opts?: ParamOptions): string | unknown[];
/** OpenAI Responses `input`. images가 비면 문자열. 있으면
 *  [{ role:'user', content:[{type:'input_text', text}, …{type:'input_image', image_url:`data:${mime};base64,${data}`, detail:'auto'}] }] */
export function buildOpenAIResponsesInput(userPrompt: string, opts?: ParamOptions): string | unknown[];
```
`lib/ai-provider.ts`: `GeminiProvider` `generateContent(buildGeminiContent(…))`, `ClaudeProvider` 첫 메시지 content → `buildClaudeUserContent(…)`, `OpenAIResponsesProvider` `input: buildOpenAIResponsesInput(…)`. `OpenAICompatProvider`(deepseek·xai)는 **`images`를 무시**한다 — D13에 따라 라우트가 애초에 넘기지 않지만, 넘어와도 요청이 변하지 않게 방어한다. `CompleteOptions.images?: ImagePart[]` 추가.

### 4-4. `lib/verify/prompts.ts`

- `COMMON_RULES` `:91` 두 줄을 D8 문구로, 2차 `:315`를 *"첨부되지 않은 그림을 보아야만…"*으로.
- 기타 상수·함수는 `figures.ts`로 — `prompts.ts`는 프롬프트 문구만 소유한다.

### 4-5. `components/comment/CommentPanel.tsx` (토론 클라)

```ts
/** 탭 블록 → 모델용 텍스트 + 그림 URL. image 블록은 `[그림]`으로, svg·ggb는 `[그림]`(URL 없음 = D5 누락) */
const fetchTabBlocksForModel = async (tabId): Promise<{ text: string; images: (string | null)[] }> => { … };

const buildContext = async () => {
  const q = await fetchTabBlocksForModel('question');
  … 다른 탭 동일 …
  // D12 ① 문항 블록 순서대로 images 누적 (null = svg/ggb 자리)
  // 15,000자 상한 셈법은 현행 그대로 — 텍스트에는 이미 `[그림]`만 들어 있다 (D14)
  return { problemContent, currentTabContent, currentTabLabel, images };
};
```
- `currentMessage`: `scanImgTags`로 `<img src>`를 `[그림]`으로 치환하고 src를 `images`에 **② 순서**로 덧붙인다. 원문(Firestore 저장본)은 그대로 — 치환은 전송용 사본에서만.
- `buildHistory` → `stripForHistory`: 기존 세 치환 뒤에 `<img …>` → `[그림]`(src를 `images`에 **③ 순서**로), 그리고 옛 `[그림 k]` → `[그림]`(D16). 상한 `FIG_LIMITS.maxCount`는 **서버가** 적용한다 — 클라는 순서만 책임진다.
- `invokeOneAI`의 fetch 바디에 `images` 추가. 재시도(`retryContext`)도 같은 컨텍스트를 들고 있으므로 자동 동행.

### 4-6. `app/api/discuss/route.ts` (토론 서버)

1. `DiscussRequest.images?: (string | null)[]`. `validate`: 배열이면 통과, 항목은 문자열 또는 null, 길이 상한 50(방어).
2. `isVisionProvider(config)` = `google | anthropic | openai`(D13).
3. `const figs = isVisionProvider(config) ? await fetchFigures(images, bucket) : allMissing(images, '이 모델은 이미지를 받지 않음')`. null 항목은 `SVG/GeoGebra` 누락.
4. `numberFigures`를 **`problemContent` → `currentTabContent` → 히스토리 각 메시지 → `currentMessage` 순으로 한 번의 순회**로 적용(등장 순서 = D12 순서와 일치해야 하므로 클라와 같은 순서 규약을 `figures.ts` 주석에 고정).
5. `buildUserPrompt(promptBody) + buildImageNote(…)` → `provider.complete(system, userPrompt, maxTokens, { …기존, images: figs.parts })`.
6. `buildSystemPrompt`에 `FIGURE_INSTRUCTION`(#14, D15)을 `GRAPH_INSTRUCTION` 다음에 추가 — **모든 provider에** 넣는다(첨부 여부는 꼬리말이 말한다).
7. `readEnv`가 없으므로 `process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`을 핸들러에서 읽고, 비어 있으면 **그림을 전부 누락 처리하고 텍스트로 계속**(D6) — 토론은 검증처럼 500으로 막지 않는다.

### 4-7. 테스트

| 하니스 | 추가 케이스 |
|---|---|
| `npm run test:verify` — `tests/aiProviderParams.test.mjs` | `buildGeminiContent`·`buildClaudeUserContent`·`buildOpenAIResponsesInput`: images 없음 → **입력 문자열과 `===`** / 1장·2장 → 파트 순서(텍스트 먼저)·필드명(`inlineData.mimeType` · `source.media_type` · `image_url` data URL) 스냅샷 |
| `npm run test:verify` — 신설 `tests/figures.test.mjs` | `imageSrcOf`(image `<img src>` / svg URL / 빈 값) · `scanImgTags`(0·1·2개, 속성 순서 뒤바뀜, 코드 펜스 안 `<img>`는 **그대로 잡힌다 — 알고 두는 손실** 기록) · `isOwnStorageUrl`(자기 버킷 `problems/` ✓ / 다른 버킷 ✗ / `problems` 아닌 경로 ✗ / http ✗ / `firebasestorage.googleapis.com.evil.com` ✗) · `numberFigures`(성공·누락 혼합, 자리표시자 수 ≠ statuses 수일 때 남는 것은 `[그림 — 첨부되지 않음: 참조 없음]`) · `buildImageNote`((0,[]) → `''` 등) |
| `npm run test:verify` — `tests/verify.test.mjs` | `labelBlocks`에 image 블록이 `[블록 n] (image)\n[그림 1]`로 나오는지 · 프롬프트 문구가 D8로 바뀌었는지 스냅샷 |
| 수동 (CLI 실측) | 강대모의X14 07번: 문제·풀이 검증 → `skip` 아닌 판정 · 토론에서 민(Gemini)·클(Claude)·쳇(GPT)에게 "그림에서 f(1)의 값은?" → 그림 기반 답 · 식(DeepSeek)은 "그림 확인 필요" 유형 답 · 메시지에 그림을 붙여 물었을 때 그것을 보는지 · `usage.inputTokens`가 그림 1장당 **+300~1,100 토큰** 수준인지 · 그림 없는 문항의 요청 바디가 이전과 동일한지(로그) |

---

## 5. 영향 범위·무회귀 점검

| 영역 | 영향 |
|---|---|
| proofread · ai-complete | **0** — `images` 옵션을 넘기지 않으므로 provider 요청이 기존과 동일(D10, 회귀 테스트로 고정) |
| discuss(그림 없는 문항) | 시스템 프롬프트에 규칙 #14 **한 단락이 늘어난다** — 이것만이 유일한 차이. 프롬프트 변경은 토론 품질 회귀 위험이 있으므로 CLI 실측 시 그림 없는 문항 2~3건으로 답변 톤·길이 비교 |
| discuss(그림 있는 문항) | URL 문자열이 `[그림 k]`로 바뀌어 컨텍스트가 **줄고**, 그림이 첨부된다. 식·xai는 자리표시자·꼬리말만 |
| 61d 일괄 검증 프리플라이트 | `questionBlockCount`·`chars`에 자리표시자(4자/장). `too_long` 사실상 불변, `empty_question`은 §4-1의 의도된 해소 1건 |
| stale 해시 (`computeVerifyHashes`) | **0** — `canonicalizeTab` 기반 |
| 편집창·열람뷰 글자 수 칩 | 그림 1장당 +4자. 무시 가능 |
| Firestore·Storage 규칙 · 블록 스키마 · `ai_models` 문서 · GAS | **0** |
| 비용 | 그림 1장당 Gemini ≈ 258~1,032 토큰, Claude ≈ 500, GPT ≈ 수백 토큰(600px 기준). 토론은 모델 수 × 장수. 문항당 몇 센트 이하. `calcCost`는 provider가 보고한 `inputTokens`에 이미지 토큰이 포함되므로 변경 0 |
| 시간 예산 | Storage fetch 수백 ms × 장수(병렬). verify `PHASE_BUDGET_MS` 280초·discuss `TIMEOUT_MS` 280초 안에서 무시 가능. judge 단계의 예산 검사(`:325`)는 fetch **뒤**에 두어 순서 유지 |
| 저장본 | **손대지 않는다** — 블록 `raw_text`·댓글 본문은 그대로. 자리표시자 치환은 모두 전송용 사본에서만 |

---

## 6. 범위 밖 (기록)

- svg·ggb 래스터화(D5 후속) — 되면 D5·D12의 null 자리가 그대로 채워진다.
- discuss 라우트 인증(D17) — 별도 Phase.
- xai 모델의 vision 지원 — `isVisionProvider`에 xai를 넣기 전에 실제 사용 모델로 실측. 넣으려면 `ai_models` 필드 승격 검토.
- 61e-2차 D26의 "우선순위 낮춤" 문구는 이 계획서로 **폐기** — 61e-2차 문서를 고치지 않고 여기 기록으로 대체한다.

## 7. 열린 질문 (CLI 교차검토 요청)

1. `@google/generative-ai@0.24`의 `generateContent([{text}, {inlineData}])` + `gemini-3.1-pro-preview` `thinkingConfig` 병용 실측(GAS는 REST 직접 호출이라 SDK 경로는 첫 사용).
2. `@anthropic-ai/sdk@0.32.1`에서 `image` 블록 + `thinking: adaptive` + `output_config.effort` 조합 실측. 토론 경로에서는 `tools: code_execution` + `image` 동시 사용도.
3. `openai@6.39`의 Responses API `input_image` — `image_url`에 data URL을 넣는 형식과 `detail` 기본값 실측. `code_interpreter` 도구와 동시 사용 시 문제 없는지.
4. Vercel outbound fetch로 `firebasestorage.googleapis.com` 다운로드 URL을 받을 때 `content-type` 실측 — `uploadImage`가 `file.type`을 그대로 올리므로 대개 정확하나, `application/octet-stream`으로 올라간 옛 그림이 있으면 D2에서 누락된다. 실측 후 필요하면 매직 바이트로 판별하는 폴백 검토.
5. D12 ③(히스토리 그림)의 실효 — 실사용에서 히스토리 그림이 상한 6장을 밀어내는 일이 잦으면 "문항 블록 + 현재 메시지만"(D12-c)으로 좁힌다.
6. `scanImgTags`가 코드 펜스 안의 `<img>` 예시를 그림으로 잡는 손실(§4-7) — 토론에서 그런 메시지가 실제로 나오는지. 나오면 펜스 마스킹 추가.
