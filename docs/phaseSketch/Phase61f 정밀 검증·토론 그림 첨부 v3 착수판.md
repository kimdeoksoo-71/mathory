# Phase 61f — 정밀 검증·agent 토론 그림 첨부 v3 착수판

> 계보: v1(web 09-03 → 09-04 토론 포함 개정) → v2(CLI 실측 교차검토) → **v3(착수판 = 이 문서)**
> 대조 기준: mathory `a208e9e` · `node_modules` 실물 타입 · gas-project-audition `8ebb218`
> **결정 D1~D20 전부 확정.** web v3 재검증은 건너뛴다(덕수 판정 2026-09-04). 이 문서대로 구현한다.

---

## 0. 한 줄 요약과 규모

**Mathory의 AI 경로 두 개(정밀 검증 · agent 토론) 어느 쪽도 그림 바이트를 모델에 보내지 않는다.** GAS 패치 12·13을 이식해 서버가 Storage의 그림을 받아 provider별 이미지 파트로 첨부하고, 본문에는 `[그림 k]` 자리표시자를, 꼬리말에 첨부·누락 목록을 붙인다. **검증과 토론이 한 모듈(`lib/verify/figures.ts`)을 공유**한다.

| 구분 | 내용 |
|---|---|
| 신규 2 | `lib/verify/figures.ts`(순수, import 0) · `lib/figureFetch.ts`(서버 전용) |
| 수정 8 | `lib/verify/prompts.ts` · `lib/verify/providerParams.ts` · `lib/ai-provider.ts` · `lib/verifyFlow.ts` · `app/api/verify/route.ts` · `components/comment/CommentPanel.tsx` · `app/api/discuss/route.ts` · `scripts/verifyProbe.mjs` |
| 테스트 | `tests/figures.test.mjs`(신설) · `tests/aiProviderParams.test.mjs` · `tests/verify.test.mjs` |
| 변경 0 | **GAS · Firestore 규칙 · Storage 규칙 · 블록 스키마 · `ai_models` 문서 · 전처리 파이프라인 · 렌더 5사이트 · 마이그레이션** |
| 핵심 불변식 | **그림이 없는 요청의 provider 바디는 바이트 단위로 지금과 같다**(D10) |

---

## 1. 원인 (실측 확정)

| # | 자리 | 사실 |
|---|---|---|
| R1 | `lib/verifyFlow.ts:21-30` | `verifyBlocksOf`가 `image·svg·ggb`를 **통째로 제외** → 모델이 받는 본문에 그림의 존재 흔적조차 없다 |
| R2 | `verifyFlow.ts:135` → `app/api/verify/route.ts:116` | `hasImages`를 보내지만 **소비처 0**(전수 grep) — 61e v5 R2가 지목한 죽은 필드 |
| R3 | `lib/verify/prompts.ts:91-92` · `:315` | *"당신은 이미지를 보지 못합니다"* → 모델은 규약대로 `skip`을 낸다 |
| R4 | `app/api/verify/route.ts:236-247` | 두 패스가 다 skip이면 `report(kind,'skip',…)`, `models.judge: null` — 화면의 *"검증 안 함"* 이 정확히 이 분기다 |
| R5·R6 | `ai-provider.ts:103` · `:379` | Gemini `generateContent(userPrompt)` · Claude `[{role:'user', content: userPrompt}]` — **provider 계층에 이미지 통로가 없다** |
| R7 | `CommentPanel.tsx:478-495` | `fetchTabBlocksText`가 모든 블록을 `title+raw_text`로 이어 붙인다 → 모델은 200자짜리 **URL 문자열**을 본다. ⚠ 다만 `snap.docs.map(d => d.data() as Block)`이라 **타입은 이미 손에 있다**(D11의 전제) |
| R8 | `CommentEditor.tsx:78-80` | 토론에 붙인 그림도 `<img src="…" alt="…" width="400" />` 문자열 |
| R9·R10 | `discuss/route.ts:363-388` · `types/problem.ts:170` | 문자열로만 합성. provider 다섯 종(google·openai·anthropic·deepseek·xai), 라우트는 **무인증** |

**배제 확인**: 그림 블록 자체는 정상(`TabBody.tsx:120`) · Gemini는 멀티모달(GAS가 같은 모델로 성공 중) · `storage.rules`의 `problems/{problemId}/{fileName=**}`는 `allow read;`(무조건) · 비용 표시 `$0.00000`은 env 단가가 0이라서다.

**왜 61e 이전에는 덜 아팠나**: 그때는 그림이 `\includegraphics{파일명}` **텍스트**로 남아 `verifyBlocksOf`를 통과했다 → 모델이 최소한 "여기 그림이 있다"는 사실은 알았다. 61e가 image 블록으로 바꾸며 그 문자열이 사라졌고, 그것이 61e v5 R2·D19의 "알고 두는 손실"이다. ⚠ **61e-2차 D26의 "우선순위 하향" 문구는 이 문서로 폐기한다** — 일괄 검증의 주 대상이 곧 시트에서 가져온 그림 문항이다.

---

## 2. 설계 — GAS 패치 12·13 이식

| GAS (`Itemverification.gs`) | Mathory 61f |
|---|---|
| `iv_imageParts_(texts)` — 참조 수집 → Drive에서 받아 `{inline_data}` 배열. 장수·장당·합계 상한, 캐시, **실패해도 텍스트만으로 계속** | `fetchFigures(slots, bucket)`(`lib/figureFetch.ts`) — Storage URL fetch → base64. 같은 상한·같은 실패 정책. **verify·discuss 두 라우트가 같은 함수** |
| `iv_imageNote_(imgs)` — 꼬리말 + 누락부 | `buildImageNote(attached, missing)` — 순수 함수 |
| `userParts = [{text}].concat(imgParts)` — **텍스트 먼저, 이미지 뒤** | Gemini `generateContent([{text}, …inlineData])` / Claude `content:[{type:'text'}, …{type:'image'}]` / OpenAI `input:[{role:'user', content:[{type:'input_text'}, …{type:'input_image'}]}]` — **같은 순서** |
| Y열 `fig_info` | 검증은 리포트 `note`의 누락부만. 토론은 기록하지 않는다(꼬리말은 모델만 본다) |

**그림 표기 계약(공통)** — 모델이 보는 본문에서 그림은
`[그림 k]`(첨부 성공) 또는 `[그림 k — 첨부되지 않음: 사유]`(실패·미지원)로 나타난다.
**k는 한 요청 안에서의 등장 순서**이고, 꼬리말이 k와 첨부 이미지의 순서를 잇는다.

### 2-1. 슬롯 모델 (구현의 뼈대)

번호 어긋남을 구조적으로 막기 위해 **"슬롯"** 하나로 통일한다.

- **슬롯** = 최종 프롬프트 문자열에 남은 `[그림]` 자리표시자 하나. 각 슬롯은 URL 하나 또는 `null`(svg·ggb).
- **번호 매기기는 프롬프트 문자열이 확정된 뒤 한 번에 한다** — 자르기·조립이 끝난 **다음**이다(D19).
- **같은 URL은 같은 k를 받고 한 번만 내려받는다**(GAS `seen[]` 등가). `null` 슬롯은 서로 다른 슬롯이다.

---

## 3. 결정 (D1~D20 전부 확정)

### 3-1. 공통·정밀 검증

| # | 확정 | 근거 |
|---|---|---|
| **D1** | **서버가 Storage 다운로드 URL을 fetch해 base64로 첨부** | 클라가 바디에 실으면 Vercel **요청 바디 4.5MB 상한**에 걸린다(그림 3장이면 위험). Gemini Files API는 Claude·OpenAI에 못 쓴다. `storage.rules`의 read 허용을 그대로 쓰므로 Admin SDK도 불필요 |
| **D2** | fetch 대상은 **자기 버킷 Firebase 다운로드 URL + `problems/` 경로**만 | discuss는 **무인증**이라(R10) 이 통제가 없으면 인터넷 전체가 우리 서버를 프록시로 쓴다(SSRF). 허용 형태: `https://firebasestorage.googleapis.com/v0/b/<NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET>/o/problems%2F…`. 응답 `content-type`이 `FIG_MIME_OK` 밖이면 누락 처리 |
| **D3** | **1차·2차 모두** 첨부 | 2차만 텍스트면 `prompts.ts:315` 규약대로 그림 의존 후보가 전부 `uncertain`이 되어 1차 첨부의 실익이 사라진다. judge 요청은 클라가 블록을 다시 보내므로 서버가 다시 fetch한다 |
| **D4** | `verifyBlocksOf`가 image 블록을 **`{blockKey, type:'image', text:'[그림]', imageUrl}`로 포함** | 본문 안 원래 위치가 보존된다. `[그림]` 4자가 클라 `verifyCharCountOf`와 서버 `totalChars`에 **똑같이** 들어가 61d W1 대칭이 유지된다 |
| **D5** | svg·ggb는 **첨부하지 않고** `[그림 k — 첨부되지 않음: SVG/GeoGebra]` | Gemini inline이 SVG를 받지 않고 래스터화는 `sharp` 의존성 + Vercel 바이너리 문제다. 자리표시자만으로도 61e 이전 수준("그림이 있다")은 회복된다 |
| **D6** | 첨부 실패는 **텍스트만으로 계속** + 자리표시자·꼬리말에 명시 | GAS 패치 13과 동일. 오류로 끝내면 Storage 일시 장애가 일괄 검증 전건과 토론 전 모델을 죽인다 |
| **D7** | 상한: 요청당 **6장** · 장당 **4MB** · 합계 **12MB** | `uploadImage`가 600px로 재인코딩해 올리므로 실물은 수십~수백 KB다(시트 가져오기 그림도 이 경로를 탄다). 상한은 방어용. 초과분은 D6 누락 처리 |
| **D8** | 검증 프롬프트를 **조건부로 고친다** — *"그림이 첨부되어 있으면 그림을 보고 판단합니다. `[그림 k — 첨부되지 않음]`으로 표시된 그림을 보아야만 판단할 수 있으면 `skip`"* | 현행 *"당신은 이미지를 보지 못합니다"* 는 첨부 후 **거짓**이 되어 모델이 첨부된 그림을 무시할 수 있다. ⚠ 61e D19가 기각한 "hasImages 프롬프트 배선"과 다르다 — A/B가 아니라 **사실에 맞게 고치는 것**이다 |
| **D9** | `hasImages` **완전 제거** — 클라 전송·서버 타입 선언·`hasMedia` 함수까지 | ⚠ **v1에서 바뀐 항목.** v1은 서버 타입에 optional로 남기려 했으나, `req.json()`은 미지 필드를 무시하므로 구클라 호환 문제가 없다. `hasMedia`의 소비처는 `verifyFlow.ts:135` **하나뿐**이라 함께 죽는다 — 죽은 필드를 없애며 죽은 함수를 남기면 같은 실수다 |
| **D10** | **그림이 없으면 요청 바디가 바이트 단위로 지금과 동일** | `images`가 비면 Gemini는 문자열, Claude는 `content: string`, OpenAI는 `input: string` 그대로. proofread·ai-complete·그림 없는 토론이 이 불변식으로 보호된다. **회귀 스냅샷이 지킨다** |

### 3-2. agent 토론

| # | 확정 | 근거 |
|---|---|---|
| **D11** | **클라(`CommentPanel`)가 블록·메시지에서 URL을 뽑아** `images`로 보내고 본문은 `[그림]`으로 치환 | 클라는 이미 블록 단위로 로드하며 `type`을 안다(R7). 서버가 문자열을 정규식으로 파싱하면 사용자가 손으로 쓴 `<img>`·코드 예시까지 그림으로 오인하고, svg·ggb(URL만 있는 블록)는 태그가 없어 못 잡는다. 검증(D4)과 같은 구조라 **한 계약**이 된다 |
| **D12** | 첨부 우선순위: **① 문항 블록(문제 → 풀이·참고) ② 현재 메시지의 `<img>` ③ 히스토리(최근 것부터)** — 상한까지 | 사용자가 토론에 그림을 붙이는 이유가 "이걸 봐 달라"(R8)인데 문항 블록만 보면 그걸 못 본다. 통상 문항 1~2장 + 메시지 1장이라 6장 안에 다 들어간다 |
| **D13** | vision 미지원 provider(deepseek·xai)는 **자리표시자 + `[그림 k — 첨부되지 않음: 이 모델은 이미지를 받지 않음]`** | 모델이 "그림이 있는데 자기는 못 본다"는 사실을 알고 답한다 — 지금은 그것조차 URL에서 추측한다. 판정은 provider 기반 순수 함수 `isVisionProvider`(= `google\|anthropic\|openai`), `isCodeExecutionModel`·`isGraphModel`(`discuss/route.ts:352-361`)과 같은 관례. **`ai_models` 문서 변경 0** |
| **D14** | 그림 바이트는 `CONTEXT_CHAR_CAP 15,000`과 **별도**(상한은 `FIG_LIMITS`) | URL 문자열(~200자)이 `[그림]` 4자로 줄어 **텍스트 예산은 오히려 늘어난다** |
| **D15** | 토론 시스템 프롬프트에 규칙 1건 추가(#14) — *"본문의 `[그림 k]`는 이 요청에 첨부된 k번째 이미지다. 첨부되지 않은 그림을 근거로 단정하지 말고 '그림 확인 필요'로 남긴다"* | 토론 프롬프트에는 "이미지를 보지 못한다"는 문구가 없어 고칠 것이 없고 의미만 알려 주면 된다. **모든 provider에** 넣는다(첨부 여부는 꼬리말이 말한다) — 식(DeepSeek)의 JSON 강제와 충돌하지 않는다 |
| **D16** | `stripForHistory`에서 **`[그림 k]` → `[그림]`** 으로 번호를 지운다 | 히스토리에 남은 k는 **그 요청 당시의 번호**라 이번 요청과 어긋난다. Firestore 저장본은 건드리지 않는다(그 함수의 기존 역할 — `CommentPanel.tsx:36-42`) |
| **D17** | discuss 라우트 인증은 **이번 범위 밖** | 무인증은 61b 때부터의 상태다. 비용 남용 방어는 D2(임의 URL 불가)·D7(상한)이 맡는다. 인증을 넣으려면 공개 문항의 비로그인 열람 경로부터 정리해야 한다 → 별도 Phase |

### 3-3. v2에서 신설 (확정)

| # | 확정 | 근거 |
|---|---|---|
| **D18** | 그림 fetch 캐시 **두지 않는다** — 요청 내 같은 URL 중복만 제거 | 토론은 모델 수만큼 **별도 요청**이라 같은 그림을 N번 받지만, 람다 인스턴스가 갈리면 모듈 캐시의 적중률이 낮다. 600px 재인코딩 이미지라 장당 수십~수백 KB. 신선도·메모리 위험 대비 이득이 작다 — 지연이 실측에서 문제가 되면 그때 연다 |
| **D19** | **번호 매기기는 프롬프트 문자열이 확정된 뒤**(자르기 포함) 한 번에. 잘려 나간 자리표시자의 이미지는 **함께 버린다** | ⚠ **이것이 v2의 최대 수확이다.** `buildContext`는 `otherContent.slice(0, room)`으로 **문자열 중간을 자르는데**(`CommentPanel.tsx:509-512`), `images`가 그와 무관하면 잘려 나간 `[그림]`의 이미지가 그대로 첨부돼 **k가 밀린다 — 모델이 다른 그림을 가리킨다.** 자르기 방식(question 보존·뒤에서 자름)은 Phase 47 규약이라 건드리지 않는다 |
| **D20** | image 블록을 검증 앵커 후보에서 **빼지 않는다** | 서버 `anchorByQuote`는 번호가 붙은 블록 텍스트를 보므로 그림 인용이 그 블록에 정상 앵커되고 클릭 점프도 된다. ⚠ **알고 두는 손실**: 클라 `findQuoteRange`는 블록 `raw_text`(`<img …>`)를 보므로(`ProblemView.tsx:391`·`EditorView.tsx:2934`) **글자 하이라이트만 안 걸린다.** 빼면 그림 지적이 엉뚱한 텍스트 블록에 앵커되거나 `check`로 강등돼 더 나쁘다 |

---

## 4. 구현 사양

### 4-1. `lib/verify/figures.ts` (신규 · **import 0** · `test:verify`의 tsc 목록에 추가)

```ts
export const FIG_PLACEHOLDER = '[그림]';                 // 클라가 보내는 무번호 자리표시자
export const FIG_LIMITS = { maxCount: 6, maxBytes: 4 * 1024 * 1024, maxTotalBytes: 12 * 1024 * 1024 };
export const FIG_MIME_OK = ['image/png', 'image/jpeg', 'image/webp'];

export type FigStatus = { ok: true } | { ok: false; reason: string };

/** image 블록 raw_text(`<img src="…">`)에서 src 추출. 없으면 '' */
export function imageSrcOf(rawText: string): string;
/** 텍스트 속 `<img src="…">`를 등장 순서로 (메시지·히스토리용) */
export function scanImgTags(text: string): { src: string; index: number; length: number }[];
/** D2 화이트리스트: 자기 버킷 Firebase 다운로드 URL + `problems/` 경로만 */
export function isOwnStorageUrl(url: string, bucket: string): boolean;
/** i번째 `[그림]` → `[그림 k]` / `[그림 k — 첨부되지 않음: 사유]`. **자르기가 끝난 문자열에 적용**(D19) */
export function numberFigures(text: string, statuses: FigStatus[], startIndex?: number): string;
/** GAS iv_imageNote_ 이식. attached·missing이 모두 0이면 `''`(그림 없는 요청 = 프롬프트 불변, D10) */
export function buildImageNote(attached: number, missing: { k: number; reason: string }[]): string;
/** 슬롯 목록 → {번호, 내려받을 URL 목록}. 같은 URL은 같은 k·한 번만(D18·§2-1) */
export function planSlots(slots: (string | null)[], bucket: string): {
  fetchUrls: string[];                       // 중복 제거된 순서
  slotToK: number[];                         // 슬롯 i → k
  preRejected: Map<number, string>;          // k → 사유 (null 슬롯 · 화이트리스트 탈락 · 개수 상한)
};
```
⚠ **클라(`verifyFlow.ts`·`CommentPanel.tsx`)는 이 파일에서 `FIG_PLACEHOLDER`·`imageSrcOf`·`scanImgTags`만 import한다** — 프롬프트 전문(`prompts.ts`)이 클라 번들에 실리지 않게 하는 61b 규약을 그대로 지킨다.

### 4-2. `lib/figureFetch.ts` (신규 · 서버 전용)

```ts
export async function fetchFigures(
  slots: (string | null)[], bucket: string,
): Promise<{ parts: ImagePart[]; statuses: FigStatus[] }>;
```
`planSlots` → 각 URL을 `fetch(url, { signal: AbortSignal.timeout(10_000) })` **병렬**로 → `content-type` ∈ `FIG_MIME_OK` → 장당·합계 상한 → base64.
어떤 이유로든 실패한 항목은 `{ok:false, reason}`으로 돌려주고 **던지지 않는다**(D6).
⚠ `lib/verify/` 밖에 두는 이유: `fetch`·`AbortSignal`을 쓰므로 import-0 tsc 하니스에 넣을 수 없다(61b·61d와 같은 규약).

### 4-3. `lib/verify/prompts.ts`

- **`LabeledBlock`(`:36`)에 `imageUrl?: string` 추가** ⚠ 이 타입은 **import 0 모듈이 소유**하고 `labelBlocks`·`totalChars`가 쓴다. 여기를 안 고치면 `normalizeBlocks`에서 필드를 실을 수 없다.
- `COMMON_RULES` `:91-92`를 D8 문구로, 2차 `:315`를 *"첨부되지 않은 그림을 보아야만…"* 으로.
- 그 밖의 상수·함수는 `figures.ts`가 소유한다 — `prompts.ts`는 **프롬프트 문구만** 갖는다.

### 4-4. `lib/verify/providerParams.ts` · `lib/ai-provider.ts`

```ts
export interface ImagePart { mimeType: string; data: string }      // data = base64
// ⚠ ParamOptions(providerParams:13)와 CompleteOptions(ai-provider:37)는 **별개 선언의 사본**이다.
//   images를 **양쪽에** 넣을 것 — 한쪽만 넣으면 타입은 통과하고 값이 조용히 안 넘어간다.
export function buildGeminiContent(userPrompt: string, opts?: ParamOptions): string | unknown[];
export function buildClaudeUserContent(userPrompt: string, opts?: ParamOptions): string | unknown[];
export function buildOpenAIResponsesInput(userPrompt: string, opts?: ParamOptions): string | unknown[];
```
- 셋 다 **`images`가 비면 입력 문자열을 그대로 반환**한다(D10 — 테스트가 `===`로 고정).
- Gemini: `[{ text }, …{ inlineData: { mimeType, data } }]` — SDK 0.24가 `Array<string | Part>`를 받는다(실측).
- Claude: `[{ type:'text', text }, …{ type:'image', source:{ type:'base64', media_type, data } }]`. ⚠ `media_type`은 **닫힌 유니온**이라 `string`을 그대로 넣으면 타입 오류 → `buildClaudeParams`가 이미 쓰는 `unknown` 캐스트 관례를 따른다.
- OpenAI Responses: `[{ role:'user', content:[{ type:'input_text', text }, …{ type:'input_image', image_url:`data:${mime};base64,${data}`, detail:'auto' }] }]`. ⚠ **`detail`은 선택이 아니라 필수 필드다**(SDK 6.39 `ResponseInputImage`).
- ⚠ **OpenAI 빌더는 확장이 아니라 신설 이관이다** — Responses 바디는 지금 `ai-provider.ts:212`가 직접 만든다. 회귀 스냅샷 대상이 하나 는다.
- `OpenAICompatProvider`(deepseek·xai)는 **`images`를 무시**한다 — D13에 따라 라우트가 애초에 넘기지 않지만, 넘어와도 바디가 변하지 않게 방어한다.

### 4-5. `lib/verifyFlow.ts` (검증 클라)

```ts
export interface VerifyBlockPayload { blockKey: string; type: string; text: string; imageUrl?: string }

export function verifyBlocksOf(blocks: Block[]): VerifyBlockPayload[] {
  return blocks
    .map((b) => {
      if (b.type === 'image' || b.type === 'svg' || b.type === 'ggb') {
        const src = b.type === 'image' ? imageSrcOf(b.raw_text) : '';   // svg·ggb는 URL을 보내지 않는다(D5)
        return { blockKey: blockKeyOf(b), type: b.type, text: FIG_PLACEHOLDER, ...(src ? { imageUrl: src } : {}) };
      }
      return { blockKey: blockKeyOf(b), type: b.type, text: (b.title ? `### ${b.title}\n` : '') + (b.raw_text || '') };
    })
    .filter((b) => b.text.trim());
}
```
- **`hasMedia` 함수 삭제 · `hasImages` 전송 삭제**(D9).
- `verifyCharCountOf`는 **무변경** — `[그림]` 4자가 자연히 포함된다.
- **부수 효과(의도됨)**: `lib/batchVerify.ts:76-77`이 `verifyBlocksOf(...).length`로 `questionBlockCount`를 만들고 `batchPlan.ts:110`이 그것으로 `empty_question`을 판정한다 → **그림뿐인 문항의 사전 차단이 저절로 풀린다.** `batchPlan`은 수치 주입형(W1)이라 **코드 변경 0**.

### 4-6. `app/api/verify/route.ts`

1. `readEnv`에 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 추가(필수).
2. **`normalizeBlocks`(`:394-406`)에 `imageUrl` 추가** — ⚠ 이 함수는 받은 객체를 `{blockKey,type,text}`로 **재구성**한다. 여기를 안 고치면 클라가 보낸 `imageUrl`이 조용히 사라진다. `isOwnStorageUrl` 통과분만 남긴다.
3. `chars` 계산(`:175`)은 **현행 그대로 · 번호 매기기 이전**에 — 클라 셈법과 대칭 유지.
4. 슬롯 = `[...problemBlocks, ...solutionBlocks]`의 `text === FIG_PLACEHOLDER`인 블록들(등장 순서, `imageUrl`이 없으면 `null`) → `fetchFigures` → `numberFigures`로 각 블록 `text`를 덮어쓴다.
5. 1차 두 패스(병렬)·2차 모두 같은 `figs.parts`를 넘기고, user 프롬프트 뒤에 `buildImageNote(…)`를 붙인다.
6. 리포트 `note`: 누락이 있으면 `'첨부되지 않은 그림 n장: …'`을 이어 붙인다.
7. `VerifyRequestBody`에서 **`hasImages` 선언 삭제**(D9).

### 4-7. `components/comment/CommentPanel.tsx` (토론 클라)

- `fetchTabBlocksText` → **`fetchTabBlocksForModel(tabId): Promise<{ text: string; slots: (string|null)[] }>`**. image는 `[그림]`+URL, svg·ggb는 `[그림]`+`null`(D5). ⚠ 소비처는 `buildContext` **하나뿐**이라 시그니처 변경이 안전하다(전수 grep).
- `buildContext`: 자르기(`slice(0, room)`)는 **그대로 두고**, **자른 뒤 남은 `[그림]` 개수만큼만 슬롯을 남긴다**(D19). question은 잘리지 않으므로 그 슬롯은 전부 살아 있다.
- `currentMessage`: `scanImgTags`로 `<img>`를 `[그림]`으로 치환하고 src를 슬롯 **②** 자리에. **원문(Firestore 저장본)은 건드리지 않는다** — 전송용 사본에서만.
- `buildHistory` → `stripForHistory`: 기존 세 치환 뒤 `<img …>` → `[그림]`(src를 슬롯 **③**), 그리고 **옛 `[그림 k]` → `[그림]`**(D16).
- `invokeOneAI`의 fetch 바디에 `images`(= 슬롯 배열) 추가. 상한은 **서버가** 적용한다 — 클라는 순서만 책임진다.

### 4-8. `app/api/discuss/route.ts` (토론 서버)

1. `DiscussRequest.images?: (string | null)[]`. `validate`: 배열이면 통과, 항목은 문자열 또는 null, **길이 상한 50**(방어).
2. `isVisionProvider(config)` = `google | anthropic | openai`(D13) — `isCodeExecutionModel` 옆에 같은 꼴로.
3. `const figs = isVisionProvider(config) ? await fetchFigures(images, bucket) : allMissing(images, '이 모델은 이미지를 받지 않음')`.
4. **`buildUserPrompt(body)`로 최종 문자열을 만든 뒤** `numberFigures`를 **한 번에** 적용한다 — 등장 순서가 곧 D12 순서이고, 자르기는 클라에서 이미 끝났다(D19).
5. `+ buildImageNote(…)` → `provider.complete(system, userPrompt, maxTokens, { …기존, images: figs.parts })`.
6. `buildSystemPrompt`에 `FIGURE_INSTRUCTION`(#14, D15)을 `GRAPH_INSTRUCTION` 뒤에 — **모든 provider에**.
7. 버킷 env가 비면 **그림을 전부 누락 처리하고 텍스트로 계속**(D6) — 토론은 검증과 달리 500으로 막지 않는다.

### 4-9. `scripts/verifyProbe.mjs`

라우트와 프롬프트·파서·바디 조립을 공유하므로 **images 경로를 함께 태운다.** ⚠ 안 고치면 D8 문구 판본 비교가 성립하지 않는다.

---

## 5. 테스트

| 하니스 | 케이스 |
|---|---|
| `tests/figures.test.mjs` (신설) | `imageSrcOf`(정상·속성 순서 뒤바뀜·빈 값) · `scanImgTags`(0·1·2개) · `isOwnStorageUrl`(자기 버킷 `problems/` ✓ / 다른 버킷 ✗ / `problems` 아닌 경로 ✗ / http ✗ / `firebasestorage.googleapis.com.evil.com` ✗) · `planSlots`(같은 URL 중복 → 같은 k·fetch 1회, null 슬롯 분리, 개수 상한 초과분 preRejected) · `numberFigures`(성공·누락 혼합, **자리표시자 수 ≠ statuses 수**일 때 남는 것은 `[그림 — 첨부되지 않음: 참조 없음]`) · `buildImageNote`(0,[]→`''`) · **D19 회귀: 자른 문자열에 대해 번호가 1부터 연속인지** |
| `tests/aiProviderParams.test.mjs` | 세 빌더 × images 없음 → **입력 문자열과 `===`**(D10) / 1·2장 → 파트 순서(텍스트 먼저)·필드명(`inlineData.mimeType` · `source.media_type`+`type:'base64'` · `image_url` data URL + **`detail` 존재**) 스냅샷 |
| `tests/verify.test.mjs` | `labelBlocks`가 image 블록을 `[블록 n] (image)\n[그림 1]`로 낸다 · 프롬프트 문구가 D8로 바뀌었다 |
| 수동(실사용) | 강대모의X14 07번: ① 문제·풀이 검증이 `skip`이 아니라 실제 판정 ② 토론에서 민(Gemini)·클(Claude)·쳇(GPT)이 그림 기반 답, 식(DeepSeek)은 "그림 확인 필요" ③ 메시지에 그림을 붙여 물으면 그것을 본다 ④ `usage.inputTokens`가 장당 +수백~1,000 수준 ⑤ **그림 없는 문항의 요청 바디가 이전과 동일**(로그) ⑥ **그림뿐인 문항이 61d 일괄 검증에서 `empty_question`으로 차단되지 않는다** |

⚠ **D8 문구 확정은 `scripts/verifyProbe.mjs`로 한다.** 61b 규약: *"n=10 표본으로 프롬프트 판본을 가리지 말 것"*(검출 3↔4는 노이즈다) · *"UI 왕복은 1회 1~2분이라 못 쓴다"*.

---

## 6. 영향 범위

| 영역 | 영향 |
|---|---|
| proofread · ai-complete | **0** — `images`를 안 넘기므로 바디 동일(D10, 스냅샷이 고정) |
| 토론(그림 없는 문항) | 시스템 프롬프트에 규칙 #14 한 단락만 늘어난다 — 유일한 차이 |
| 토론(그림 있는 문항) | URL 문자열이 `[그림 k]`로 바뀌어 **컨텍스트가 줄고** 그림이 첨부된다. 식·xai는 자리표시자+꼬리말만 |
| 61d 일괄 검증 | `questionBlockCount`·`chars`에 자리표시자(4자/장) 반영. `too_long` 사실상 불변, `empty_question`은 **의도된 해소 1건** |
| stale 판정 | **0** — `canonicalizeTab` 기반 |
| 편집창·열람뷰 칩 | 그림 1장당 +4자. 무시 가능 |
| Firestore·Storage 규칙 · 블록 스키마 · `ai_models` · GAS | **0** |
| 저장본 | **바뀌지 않는다** — 자리표시자 치환은 전송용 사본에서만 |
| 비용 | 그림 1장당 Gemini ~258~1,032 · Claude ~500 · GPT 수백 토큰(600px 기준). 토론은 모델 수 × 장수. `calcCost`는 provider가 보고한 `inputTokens`를 쓰므로 **변경 0** |
| 시간 예산 | Storage fetch 수백 ms × 장수(병렬). verify `PHASE_BUDGET_MS` 280초 · discuss `TIMEOUT_MS` 280초 안에서 무시 가능. judge 단계의 예산 검사(`route.ts:325`)는 fetch **뒤**에 오도록 순서 유지 |

---

## 7. 작업 순서 · 관문

1. **`lib/verify/figures.ts` + `tests/figures.test.mjs`** — 순수 함수부터. 관문: `test:verify` 통과, 기존 45건 무회귀.
2. **`providerParams` 3종 빌더 + `ai-provider` 배선** — 관문: **images 미전달 시 바디가 문자열 그대로**(D10) 스냅샷.
3. **`lib/figureFetch.ts`** — 관문: SSRF 케이스 표 전건(자기 버킷 `problems/`만 통과).
4. **검증 경로**(verifyFlow · verify/route · prompts D8 · probe) — 관문: 그림 문항이 `skip`이 아니라 실제 판정을 낸다.
5. **토론 경로**(CommentPanel · discuss/route) — 관문: **자르기 뒤 번호 정합**(D19) · vision 미지원 모델의 자리표시자.
6. `npm run build` + 로직 검증 10종 무회귀.
7. **실사용 검수** §5 수동 표 ①~⑥.
8. 문서: `docs/phasedocs/`에 실행판 등록 · roadmap·CLAUDE.md 갱신 · 각서 — *"AI 경로에 무엇을 보내는지는 provider 계층까지 따라가 확인할 것. `hasImages`는 3개 Phase 동안 '보내고 있다'고 믿긴 채 아무도 읽지 않았다."*

---

## 8. 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| Q2 | Claude `image` + `thinking:'adaptive'` + `output_config.effort`, 그리고 토론의 `tools:code_execution`과 동시 사용 | **타입은 확인됐고 실호출만 남았다** — 4번 관문에서 |
| Q5 | D12-③(히스토리 그림)이 상한 6장을 실제로 밀어내는지 | 밀어내면 "문항 블록 + 현재 메시지만"으로 좁힌다 |
| Q6 | `scanImgTags`가 코드펜스 안 `<img>`를 그림으로 잡는 손실 | ⚠ **61c에 전례가 있다** — `lib/chatExtract.ts`가 코드펜스·인라인 코드를 **길이·개행을 보존하며 마스킹**한 뒤 인덱싱한다. 필요해지면 그 방식을 가져올 것(새로 짜지 말 것) |
| Q7 | 그림 1장당 실제 `inputTokens` 증가분 | 비용보다 **300초 예산** 영향이 핵심 |
| — | svg·ggb 래스터화(D5 후속) | 되면 D5·D12의 null 슬롯이 그대로 채워진다 |
| — | discuss 라우트 인증(D17) | 별도 Phase |
| — | xai vision 지원 | `isVisionProvider`에 넣기 전 실제 사용 모델로 실측. 넣으려면 `ai_models` 필드 승격 검토 |

---

*v3 착수판 — 결정 D1~D20 확정, 착수 가능. 인용: mathory `a208e9e` · node_modules 실물 타입 · audition `8ebb218`.*
