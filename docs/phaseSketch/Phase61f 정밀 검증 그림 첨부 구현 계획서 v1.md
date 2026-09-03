# Phase 61f — 정밀 검증 그림 첨부 구현 계획서 v1

> 작성: web Claude, 2026-09-03. 관례대로 CLI Claude의 실측 교차검토(v2) → web 재검증(v3)을 거친다.
> 참조 리포지토리: `kimdeoksoo-71/mathory` origin/main (2026-09-03 clone), `kimdeoksoo-71/gas-project-audition` origin/main.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 증상 | 그림이 정상적으로 image 블록으로 들어 있는 문항(예: 강대모의X14(260903)_1공통07)을 일괄 검증하면 문제·풀이 검증 모두 **"검증 안 함 · 이미지를 확인할 수 없어…"** 로 끝난다 |
| 원인 한 문장 | **Mathory 정밀 검증은 그림을 모델에 보내지 않는다.** 클라이언트가 image 블록을 걸러내고(`verifyBlocksOf`), 서버는 `hasImages`를 읽지 않으며(죽은 필드), 프롬프트가 "당신은 이미지를 보지 못합니다 → skip"을 명시한다. Gemini의 답은 정확하다 — 실제로 아무 이미지도 받지 못했다 |
| 성격 | **버그가 아니라 61e에서 "알고 두는 손실"로 기록하고 61f로 미룬 항목**이다(61e v5 R2·D19, `CLAUDE.md:288`). 시트 쪽은 GAS 패치 12·13(2026-09-02 파이프라인 테스트 성공)으로 이미 해결됐고, Mathory만 남았다 |
| 해결 | GAS 패치 12·13을 이식한다 — 서버가 Storage의 그림을 받아 **Gemini `inlineData`·Claude `image` 블록으로 첨부**하고, 본문에는 `[그림 n]` 자리표시자, 꼬리말에 첨부·누락 목록을 붙인다. 그림이 없는 문항의 요청 바디는 **바이트 단위로 기존과 동일**하게 유지한다 |
| 손대는 파일 | `lib/verifyFlow.ts` · `app/api/verify/route.ts` · `lib/ai-provider.ts` · `lib/verify/providerParams.ts` · `lib/verify/prompts.ts` · 테스트 2건. **GAS·Firestore 규칙·Storage 규칙·블록 스키마 변경 0** |

---

## 1. 원인 — 실측

### 1-1. 그림이 모델까지 가는 길이 세 군데에서 끊겨 있다

| # | 자리 | 실측 | 결과 |
|---|---|---|---|
| R1 | `lib/verifyFlow.ts:21-30` `verifyBlocksOf` | `.filter((b) => !['image','svg','ggb'].includes(b.type))` — 미디어 블록을 **통째로 제외**하고 텍스트 블록만 `{blockKey,type,text}`로 보낸다 | 모델이 받는 본문에는 "그래프가 그림과 같다"는 문장만 남고 그림의 **존재 표시조차 없다** |
| R2 | `lib/verifyFlow.ts:135` → `app/api/verify/route.ts:116` | 클라는 `hasImages: hasMedia(targetRaw)`를 보내지만 서버 `VerifyRequestBody.hasImages`는 **선언만 있고 어디서도 읽지 않는다** (grep 결과 소비처 0) | 61e v5 R2가 지적한 "죽은 필드" 그대로 |
| R3 | `lib/verify/prompts.ts:91` `COMMON_RULES` | *"그림·도형 이미지를 보아야만 판단할 수 있으면 판정하지 말고 `skip`을 택하고 이유를 적습니다. **당신은 이미지를 보지 못합니다.**"* / 2차 `:315` *"그림을 보아야만 판단할 수 있는 후보는 uncertain"* | 모델은 규약대로 `skip:true` + `skip_reason`을 낸다 |
| R4 | `app/api/verify/route.ts:235-246` | `alive.every((j) => j.skip === true)` → `report(kind,'skip',[],{note: skip_reason})`, `models.judge: null` | 화면의 "검증 안 함 · (후보 없음 — 판정 생략)"이 정확히 이 분기다 |
| R5 | `lib/ai-provider.ts:103` `GeminiProvider.complete` | `model.generateContent(userPrompt)` — **문자열 하나**만 넘긴다. `CompleteOptions`에 이미지 개념이 없다 | provider 계층에도 그림을 실을 통로가 없다 |
| R6 | `lib/ai-provider.ts:377` `ClaudeProvider.complete` | `messages = [{ role:'user', content: userPrompt }]` — 문자열 content | 2차 판정도 마찬가지 |

### 1-2. 왜 지금 드러났나

61e 이전에는 시트에서 가져온 문항의 그림이 `\includegraphics{파일명}` **텍스트**로 본문에 남아 있었다. 그 문자열은 `verifyBlocksOf`를 통과하므로 모델이 최소한 "여기 그림이 있다"는 사실은 알았다(61e review v2 §표). 61e가 그림을 image 블록으로 바꾸면서 그 문자열이 사라졌고, 이것이 61e에서 **"알고 두는 손실"**(C1·D19·R2)로 기록된 바로 그 현상이다. 61e-2차 D26은 *"GAS 검증(패치 12)이 그림 첨부를 이미 해결했으므로 Mathory 쪽 61f 자리표시자의 우선순위를 낮춘다"*고 했는데, 이번 실측은 그 우선순위를 다시 올려야 함을 보여 준다 — **일괄 검증의 주 대상이 시트에서 가져온 그림 문항**이기 때문이다.

### 1-3. 원인이 아닌 것 (확인·배제)

- 그림 블록 자체는 정상이다. 화면에 렌더되고 `raw_text`에 `<img src="https://firebasestorage.googleapis.com/…">`가 있다(`TabBody.tsx:120`).
- Gemini가 이미지를 못 읽는 모델이 아니다. `gemini-3.1-pro-preview`는 멀티모달이고, 같은 모델이 GAS 패치 12·13에서 `inline_data`로 그림을 받아 검증하고 있다.
- Storage 권한 문제가 아니다. `storage.rules`는 `problems/{problemId}/**` **read 전면 허용**(다운로드 URL 토큰이 접근 제어)이라 서버가 URL을 그대로 fetch할 수 있다.
- 비용 표시 `$0.00000`은 `VERIFY_GEMINI_COST_IN/OUT` env가 0이라서이지 호출이 안 된 것이 아니다(토큰은 실제로 소비됐다).

---

## 2. 해결 방향 — GAS 패치 12·13 이식

시트 파이프라인(`gas-project-audition` `Itemverification.gs:645-712`, `callGeminiUnified_:815`)이 이미 검증한 구조를 그대로 옮긴다.

| GAS (패치 12·13) | Mathory 61f 대응 |
|---|---|
| `iv_imageParts_(texts)` — 본문의 그림 참조를 모아 Drive에서 받아 `{inline_data:{mime_type,data}}` 배열로. 장수·장당 4MB·합계 상한, 캐시, **실패 시 텍스트만으로 계속** | 서버 `collectImageParts(blocks)` — image 블록의 Storage URL을 fetch → base64. 같은 상한·같은 실패 정책 |
| `iv_imageNote_(imgs)` — 꼬리말 *"(참고: 본문의 그림 n장이 이 요청에 이미지로 첨부되어 있습니다: …)"* + 누락분 *"[그림: … — 첨부되지 않음]"* | `buildImageNote(attached, missing)` — 순수 함수, `lib/verify/prompts.ts` |
| `userParts = [{text: usr}].concat(imgParts)` — **텍스트 먼저, 이미지 뒤** | Gemini: `generateContent([{text}, ...inlineData])` / Claude: `content: [{type:'text'}, ...{type:'image'}]` 같은 순서 |
| Y열 `fig_info`에 첨부/누락 기록 | 리포트 `note`에 누락분만 기록(첨부 성공은 기록하지 않는다 — 리포트 소음 방지) |

**그림 표기 계약**: 본문(`labelBlocks` 출력)에서 image 블록은 `[블록 n] (image)` 아래 `[그림 k]`(첨부 성공) 또는 `[그림 k — 첨부되지 않음: 사유]`(실패)로 보인다. 꼬리말이 k와 첨부 이미지의 순서를 잇는다.

---

## 3. 결정사항 (권장안 첫 번째)

| # | 결정 | 선택지 | 권장 · 근거 |
|---|---|---|---|
| **D1** | 그림 바이트를 누가 받나 | (a) **서버가 Storage 다운로드 URL을 fetch해 base64로 첨부** (b) 클라가 blob→base64로 요청 바디에 실어 보냄 (c) Gemini Files API에 올리고 URI 참조 | **(a)**. (b)는 Vercel 서버리스 **요청 바디 4.5 MB 상한**에 걸린다 — 그림 3장이면 넘친다. 또 클라 번들에 첨부 규칙이 들어가 서버 셈법과 갈릴 위험이 생긴다. (c)는 서버가 무상태라는 라우트 원칙과 어긋나고 Claude 2차에는 쓸 수 없다. (a)는 `storage.rules`의 read 허용을 그대로 쓰고, 61e가 피한 Admin SDK도 필요 없다 |
| **D2** | 서버가 fetch할 URL 범위 | (a) **자기 버킷의 Firebase Storage 다운로드 URL + `problems/` 경로 접두만 허용** (b) https면 전부 | **(a)**. (b)는 인증된 사용자가 서버로 **임의 URL을 대신 읽게 하는(SSRF)** 구멍이다. 허용 형식: `https://firebasestorage.googleapis.com/v0/b/<NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET>/o/problems%2F…`. 응답 `content-type`이 `image/png·jpeg·webp`가 아니면 누락 처리 |
| **D3** | 2차(Claude 판정)에도 첨부하나 | (a) **1차·2차 모두 첨부** (b) 1차만 | **(a)**. 2차만 텍스트면 규약 `:315`대로 그림 의존 후보가 전부 `uncertain`으로 남아 1차 첨부의 실익이 사라진다. Opus 4.8은 이미지를 받는다(`{type:'image', source:{type:'base64', media_type, data}}`). judge 요청은 클라가 블록을 다시 보내므로 서버가 다시 fetch한다 — Storage 재요청은 싸다(수백 KB) |
| **D4** | `verifyBlocksOf`의 image 블록 처리 | (a) **`{blockKey, type:'image', text:'[그림]', imageUrl}`로 포함** (b) 현행 제외 유지 + 서버가 별도 필드로 받음 | **(a)**. 본문 순서 안의 위치("그림과 같다" 문장 바로 뒤)가 보존돼 모델이 어느 그림인지 안다. `text` 길이(4자)가 클라 `verifyCharCountOf`와 서버 `totalChars`에 **똑같이** 들어가므로 셈법 동치(61d W1·verifyFlow.ts:47)가 유지된다. ⚠ 서버는 셈을 마친 뒤에 `[그림]`→`[그림 k]`로 바꿔 쓴다(§4-2) |
| **D5** | svg·ggb 블록 | (a) **첨부하지 않고 `[그림 k — 첨부되지 않음: SVG/GeoGebra]` 자리표시자만** (b) 서버에서 래스터화해 첨부 | **(a)**. Gemini inline은 SVG를 받지 않고, 래스터화는 `sharp`류 의존성 추가 + Vercel 바이너리 문제다. 자리표시자만으로도 "그림이 있다"는 사실은 전달되어 61e 이전 수준(`\includegraphics` 텍스트)은 회복된다. 래스터화는 후속 |
| **D6** | 첨부 실패 정책 | (a) **텍스트만으로 계속 + 자리표시자·꼬리말에 누락 명시** (b) 검증 실패(오류) | **(a)**. GAS 패치 13과 동일("실패해도 검증은 텍스트만으로 계속"). 모델은 규약대로 그 그림에 의존하는 판단만 skip/uncertain으로 남긴다. (b)는 Storage 일시 장애가 일괄 검증 전건을 죽인다 |
| **D7** | 상한 | 문항당 **6장**, 장당 **4 MB**, 합 **12 MB** (GAS `MAX_IMAGES_PER_CALL`·`MAX_IMAGE_BYTES`와 같은 급) | `uploadImage`가 600px로 줄여 올리므로 실물은 장당 수십~수백 KB다. 상한은 방어용. 초과분은 D6의 누락 처리 |
| **D8** | 프롬프트 규약 | (a) **조건부로 고쳐 쓴다** — *"그림이 첨부되어 있으면 그림을 보고 판단합니다. `[그림 k — 첨부되지 않음]`으로 표시된 그림을 보아야만 판단할 수 있으면 skip"* (b) 현행 유지 + 꼬리말만 | **(a)**. 현행 문구 *"당신은 이미지를 보지 못합니다"*는 첨부 후에는 **거짓**이 되어 모델이 첨부된 그림을 무시하고 skip할 수 있다. 61e D19가 기각한 "hasImages 프롬프트 배선(판본 실험)"과 다르다 — 이것은 A/B가 아니라 **사실에 맞게 고치는 것**이다 |
| **D9** | `hasImages` 필드 | (a) **클라 전송 중단, 서버 타입은 optional로 남겨 구클라 허용** (b) 그대로 | **(a)**. 죽은 필드를 살려 두면 훗날 "이미 처리됨"으로 읽힌다(61e D19 경고와 같은 이유) |
| **D10** | 그림이 없는 문항의 요청 | **바이트 단위 불변** — `images`가 비면 Gemini는 `generateContent(string)`, Claude는 `content: string` 그대로 | 61b가 `providerParams` 회귀 테스트로 지키는 원칙. discuss·proofread·ai-complete가 같은 provider를 쓴다 |

---

## 4. 구현 사양

### 4-1. `lib/verifyFlow.ts` (클라)

```ts
/** 검증에 넘길 블록. image는 `[그림]` 자리표시자 + Storage URL로 보낸다(61f D4).
 *  svg·ggb는 자리표시자만(D5). ⚠ `text` 길이는 서버 `totalChars`와 같은 셈법에 들어간다 —
 *  자리표시자 문자열을 바꾸면 클라 칩·프리플라이트 수치도 함께 바뀐다(자동 동치). */
export interface VerifyBlockPayload { blockKey: string; type: string; text: string; imageUrl?: string }

export function verifyBlocksOf(blocks: Block[]): VerifyBlockPayload[] {
  return blocks
    .map((b) => {
      if (b.type === 'image') {
        const src = b.raw_text.match(/src="([^"]+)"/)?.[1] || '';
        return { blockKey: blockKeyOf(b), type: 'image', text: VERIFY_FIG_PLACEHOLDER, ...(src ? { imageUrl: src } : {}) };
      }
      if (b.type === 'svg' || b.type === 'ggb') {
        return { blockKey: blockKeyOf(b), type: b.type, text: VERIFY_FIG_PLACEHOLDER };
      }
      return { blockKey: blockKeyOf(b), type: b.type, text: (b.title ? `### ${b.title}\n` : '') + (b.raw_text || '') };
    })
    .filter((b) => b.text.trim());
}
```
- `VERIFY_FIG_PLACEHOLDER = '[그림]'` — **`lib/verify/prompts.ts`에 두고 양쪽이 import** (서버가 문자열을 소유; 클라는 상수 하나만 가져오므로 프롬프트 전문이 번들에 실리지 않는다 — `verifyFlow.ts:131` 주석의 우려는 상수 1개에는 해당 없음. ⚠ 다만 `prompts.ts`가 클라 번들에 통째로 들어가지 않는지 CLI가 tree-shaking을 실측할 것 — 안 되면 상수를 `types/problem.ts` 옆 별도 파일로).
- `hasMedia`·`hasImages` 전송 제거(D9). `hasMedia`는 다른 소비처가 없으면 함께 삭제.
- `verifyCharCountOf`는 변경 0 — `[그림]` 4자가 자연히 포함된다.
- **효과 1건(의도됨)**: question 탭이 image 블록뿐인 문항이 61d 프리플라이트 `empty_question`에 더는 걸리지 않는다(61e N-8의 사전 차단 해소). 그림이 첨부되므로 검증 가능한 것이 맞다.

### 4-2. `app/api/verify/route.ts` (서버)

1. `normalizeBlocks`: `imageUrl`을 받되 **D2 화이트리스트를 통과한 것만** 남긴다(`isOwnStorageUrl(url, env.bucket)`). `bucket`은 `readEnv`에 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` 추가(필수).
2. `chars` 계산(`:175`)은 **현행 그대로 자리표시자 포함 상태에서** 한다 — 클라 셈법과 동치.
3. 그 다음 `const figs = await collectImageParts([...problemBlocks, ...solutionBlocks], limits)`:
   - image 블록을 등장 순서대로 k=1,2,…로 번호 매김.
   - `imageUrl` 있는 것만 fetch(`AbortSignal.timeout(10_000)`), `content-type`·크기·합계 검사(D2·D7). 성공 → `{mimeType, data(base64)}`를 `attached`에, 실패·svg·ggb·URL 없음 → `missing`에 `{k, reason}`.
   - 블록 `text`를 `[그림 k]` 또는 `[그림 k — 첨부되지 않음: ${reason}]`로 **덮어쓴다**(셈은 이미 끝났다).
   - 같은 URL이 두 번 나오면(61e D17처럼 문제·풀이가 같은 그림) 한 번만 받아 재사용하되 번호는 각각 준다.
4. 1차 두 패스(풀이)·2차 모두 같은 `figs.parts`를 넘긴다: `first.complete(system, user + buildImageNote(figs), FIRST_MAX_TOKENS, { …, images: figs.parts })`, `judge.complete(…, { …, images: figs.parts })`.
5. 리포트 `note`: `missing`이 있으면 `'첨부되지 않은 그림 n장: …'`을 붙인다(skip 분기의 `note`와 충돌하지 않게 이어 붙임).
6. `hasImages` — `VerifyRequestBody`에 optional로 남기고 읽지 않는다는 주석을 **"61f: 구클라 호환용 잔존, 소비처 없음"**으로 고친다.

### 4-3. `lib/verify/providerParams.ts` (순수, import 0)

```ts
export interface ImagePart { mimeType: string; data: string }   // data = base64
export interface ParamOptions { …기존…; images?: ImagePart[] }

/** Gemini generateContent 인자. images가 비면 **문자열 그대로**(D10). 텍스트 먼저, 이미지 뒤(GAS 순서) */
export function buildGeminiContent(userPrompt: string, opts?: ParamOptions): string | unknown[] {
  const imgs = opts?.images ?? [];
  if (imgs.length === 0) return userPrompt;
  return [{ text: userPrompt }, ...imgs.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } }))];
}
/** Anthropic user content. images가 비면 문자열 그대로(D10) */
export function buildClaudeUserContent(userPrompt: string, opts?: ParamOptions): string | unknown[] {
  const imgs = opts?.images ?? [];
  if (imgs.length === 0) return userPrompt;
  return [{ type: 'text', text: userPrompt },
          ...imgs.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mimeType, data: i.data } }))];
}
```
`lib/ai-provider.ts`: `GeminiProvider.complete`의 `generateContent(userPrompt)` → `generateContent(buildGeminiContent(userPrompt, _opts))`, `ClaudeProvider.complete`의 첫 메시지 content → `buildClaudeUserContent(userPrompt, opts)`. `CompleteOptions.images?: ImagePart[]` 추가. OpenAI 계열 provider는 검증 경로에 없으므로 **변경 0**(옵션 무시).

### 4-4. `lib/verify/prompts.ts`

- `COMMON_RULES` `:91` 두 줄을 D8 문구로 교체. 2차 `:315`도 *"첨부되지 않은 그림을 보아야만…"*으로.
- `export const VERIFY_FIG_PLACEHOLDER = '[그림]'`.
- `export function buildImageNote(attached: number, missing: {k:number; reason:string}[]): string` — GAS `iv_imageNote_` 문구를 그대로 옮긴다. 둘 다 0이면 `''`(그림 없는 문항의 프롬프트 불변 — D10).

### 4-5. 테스트

| 하니스 | 추가 케이스 |
|---|---|
| `npm run test:verify` (`tests/aiProviderParams.test.mjs`) | `buildGeminiContent`·`buildClaudeUserContent`: images 없음 → **입력 문자열과 `===`** / 1장·2장 → 파트 순서(텍스트 먼저)·필드명(`inlineData.mimeType` vs `source.media_type`) 스냅샷 |
| `npm run test:verify` (`tests/verify.test.mjs`) | `buildImageNote`: (0,[]) → `''` / (2,[]) / (1,[{k:2,reason:'SVG'}]) 문구 스냅샷 · `labelBlocks`에 image 블록이 `[블록 n] (image)\n[그림 1]`로 나오는지 |
| 수동 (CLI 실측) | 강대모의X14 07번으로 문제·풀이 검증 → `skip`이 아닌 판정이 나오는지, `usage.inputTokens`가 그림 없는 문항 대비 **+300~1,100 토큰/장** 수준인지(Gemini 258토큰/타일·Claude ≈ w·h/750), 그림 없는 문항의 Firebase·Vercel 로그 요청 바디가 이전과 동일한지 |

---

## 5. 영향 범위·무회귀 점검

| 영역 | 영향 |
|---|---|
| discuss · proofread · ai-complete | **0** — `images` 옵션을 넘기지 않으므로 provider 요청이 기존과 동일(D10, 회귀 테스트로 고정) |
| 61d 일괄 검증 프리플라이트 | `questionBlockCount`·`chars`에 image 자리표시자가 들어간다(4자/장). `too_long` 판정은 사실상 불변, `empty_question`은 §4-1의 의도된 해소 1건 |
| stale 해시 (`computeVerifyHashes`) | **0** — `canonicalizeTab` 기반이라 `verifyBlocksOf`와 무관 |
| 편집창·열람뷰 글자 수 칩 | 그림 1장당 +4자 표시. 상한 15,000자 대비 무시 가능 |
| Firestore·Storage 규칙 · 블록 스키마 · GAS | **0** |
| 비용 | 그림 1장당 Gemini ≈ 258~1,032 토큰, Claude ≈ 500 토큰(600px 기준). 문항당 몇 센트 이하 |
| 시간 예산 | Storage fetch 수백 ms × 장수, 병렬. `PHASE_BUDGET_MS` 280초 안에서 무시 가능. 단 judge 단계는 fetch 뒤에 예산 검사(`:325`)를 하므로 순서 유지 |

---

## 6. 범위 밖 (기록)

- **agent 토론(새 토론)도 같은 맹점이다** — `CommentPanel`의 컨텍스트 조립에 image 처리가 없다(grep 0건). 검증과 같은 `images` 옵션을 쓰면 되지만 컨텍스트 상한·비용 정책이 달라 별도 Phase.
- svg·ggb 래스터화(D5 후속).
- 61e-2차 D26의 "우선순위 낮춤" 문구는 이 계획서로 **폐기** — 61e-2차 문서를 고치지 않고 여기 기록으로 대체한다.

## 7. 열린 질문 (CLI 교차검토 요청)

1. `@google/generative-ai@0.24`의 `generateContent([{text}, {inlineData}])` 시그니처와 `gemini-3.1-pro-preview`의 `thinkingConfig` 병용이 실측에서 문제없는지(GAS는 REST 직접 호출이라 SDK 경로는 첫 사용).
2. `@anthropic-ai/sdk@0.32.1`에서 `image` 블록 + `thinking: adaptive` + `output_config.effort` 조합 실측.
3. `prompts.ts`에서 상수 1개를 클라가 import할 때 프롬프트 전문이 번들에 실리는지(§4-1) — 실리면 상수 파일 분리.
4. Vercel 환경의 outbound fetch로 `firebasestorage.googleapis.com` 다운로드 URL을 받을 때 리다이렉트·`content-type` 실측(간혹 `application/octet-stream`으로 올라간 그림이 있다면 `uploadImage`의 `file.type` 지정 여부 확인).
