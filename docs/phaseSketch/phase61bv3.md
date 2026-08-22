# Phase 61b 구현 계획서 — 정밀 검증 (agent 대화창 통합) (v3)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **B축**
> 계보: v1(2026-08-22 web) → v2(CLI 실측 교차검토) → **v3(web 재검증·판정, 2026-08-22)**
> 진실 원천: mathory **origin/main `6833fe9`** · gas-project-audition **origin/main `b6b91f6`**
> 범위: 기획서 D 진행표의 **단계 2(검증 코어) + 단계 3(agent 통합) + 단계 4(상태 관리)**. C축(대화→편집창 삽입)은 61c.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. v3 판정 요약 — v2 교차검토에 대한 재검증 결과

**v2의 실측 지적 §3-1~§3-15를 전 항목 재검증했고, 전부 사실로 확인되어 수용한다.** 인용 라인 전수 대조 결과 v2가 읽은 로컬 main(`6b764e3`)과 origin/main(`6833fe9`) 사이에 코드 드리프트는 없다(인용된 모든 파일·라인이 origin/main 실물과 일치. `6b764e3`은 미push 로컬 커밋이므로 **이 문서의 기준 해시는 `6833fe9`로 통일**한다 — 61a 교훈 1). §3-1(e)의 "assistant prefill 400"은 저장소 밖 주장이라 외부 소스로 교차 확인했다 — Claude 4.6+ 계열에서 "Prefilling assistant messages is no longer supported" 400이 실재한다.

**v2에서 v3가 고친 것은 3건 + 신규 보강 4건이다:**

1. **태그 표기 오기 원복(§4)** — v2가 기획서 B-3의 `답 유일성`을 `답없음`으로, `서술 비일관`을 `수식비일관`으로 바꿔 적었다. 이 체계는 **E-4로 덕수가 전체 수용을 확정한 것**이라 계획서가 임의로 개명할 수 없고, `답없음`은 의미 자체가 다르다(유일성 결여 ≠ 부재). **기획서 원문으로 원복.**
2. **D13 개정(→D13′)** — "2차 실패 시 1차 후보를 check findings로 반환"을 기각한다. v2 스스로 §10-1에서 물었던 그 우려가 맞다: 1차 후보는 recall 편향(과검출)이고, 그것을 지적으로 보여주는 순간 **2차 판정이 존재하는 이유(보수 판정, B-4)가 무너진다**. 2차 미완료는 실패다 — 리포트 미생성·`verification` 미갱신·오류 반환.
3. **D14 개정(→D14′)** — 상한 초과를 서버가 `skip` verdict로 만드는 대신 **클라이언트가 실행 전에 차단**한다. `skip`은 AI가 판정한 "검증 불가"(그림 의존 등, B-8)에 예약된 어휘다. 호출 전에 아는 초과를 verdict로 기록하면 어휘가 오염되고 비용 0으로 막을 수 있는 것을 호출 후에 알게 된다.
4. 신규 보강 V1~V4(§3-16): 1차 Gemini JSON mime 배선 · 정답 불일치 시 후보 0이어도 ok 종료 금지 · 문제 검증 해시에 answer 포함 · D5′ 배선을 `hashPerTab`/`collectCurrentContent` 재사용으로 구체화.

v2 §10의 질문 5건에 대한 답은 §7 결정표의 **A1~A5**다.

---

## 1. 한 줄 요약

시트 STEP3에서 검증된 **비대칭 교차검증(1차 Gemini 후보 생성 → 2차 Claude 엄격 판정)** 을
Mathory 서버 라우트(`/api/verify`)로 이식하고, 실행은 agent 대화창의 **칩 2개 + 비용 확인 팝오버**,
결과는 대화 스레드에 꽂히는 **리포트 카드**(지적 클릭 → 블록 점프), 상태는 `Problem.verification` additive 필드 + 목록 배지.

## 2. 아키텍처 (v1부터 불변)

**서버는 검증 엔진 프록시, 컨텍스트 조립과 저장은 클라이언트.** (discuss 관례 그대로)

- `app/api/verify/route.ts` — 블록 배열을 받아 2단 교차검증을 수행하고 리포트 JSON만 반환. **Firestore 미접촉.**
- 클라이언트 — 블록 수집 → 라우트 호출 → 결과를 agent 메시지로 `addComment` → `setVerification` 갱신.

이유: (a) discuss·proofread와 동일 구조라 AI 입구가 하나로 유지된다. (b) 리포트가 일반 메시지라 후속 대화가 기존 discuss 파이프라인 **무변경**으로 된다. (c) Firestore 규칙 0 · 마이그레이션 0.

---

## 3. 확정 사실 (v1 사실표 + v2 정정, 전부 v3 재검증 완료)

### 3-1. provider 확장이 선행 조건이다 (v2 지적 수용)

현재 `lib/ai-provider.ts`로는 STEP3 등가 호출이 불가능하다 — 다섯 가지 확인:

- **(a)** export는 `getProviderForModel`(:448)·`getAIProvider`(:478)뿐, `GeminiProvider`(:52)·`ClaudeProvider`(:327)는 내부. `getProviderForModel`은 Firestore `ai_models` 문서를 요구 → env 고정 모델용 팩토리 `getVerifyProviders()`를 **추가 export**.
- **(b) thinking·effort 미전달 — 가장 위험.** `ClaudeProvider`는 `model/max_tokens/system/messages`(+tools)만 보낸다(:344-). Opus 4.8은 `thinking` 생략 시 사고가 꺼진 채 돌고 **오류 없이 품질만 조용히 떨어진다**. Gemini도 `thinkingConfig` 미전달(:70-73). 시트는 `thinking:{type:'adaptive'}` + `output_config:{effort:'high'}`(`QualityVerification.gs:578-583`), `thinkingConfig:{thinkingLevel:'HIGH'}`(:484)를 준다 — 실사용으로 검증된 현행 API다. `budget_tokens`는 되살리지 말 것(Opus 4.8에서 400).
- **(c) `pause_turn` 미처리.** `messages.create` 1회 호출·`stop_reason`은 `max_tokens`만 검사(:418). code_execution이 붙으면 `pause_turn`으로 끊길 수 있고 검증에서는 **JSON이 잘린 채 온다** → 이어붙임 재요청 루프(상한 3회).
- **(d) `forceCodeExecution`(`tool_choice:{type:'any'}`) 금지** — 도구 호출을 강제하면 최종 JSON 턴을 못 낸다. 검산은 프롬프트로 유도(시트도 강제하지 않는다).
- **(e) assistant prefill은 400.** Claude 4.6+ 전 계열에서 프리필 거부 — **외부 교차 확인 완료**. D3(JSON-in-text)의 실제 근거는 이것이다(v1의 "tool_use 충돌" 근거를 대체).

### 3-2. LaTeX × JSON 이스케이프 충돌 (v2 지적 수용 — v1 누락)

`"\frac"`은 JSON **파싱이 성공하면서** `␌rac`으로 조용히 망가진다(`\f` = form feed). 시트의 이중 방어를 함께 이식한다:

- 파싱 실패 대응: `safeParseGeminiJson_` 4단계 폴백(`Itemverification.gs:690-728`).
- **파싱 성공 후 복구**: `repairLatexControlChars_`를 **trim보다 먼저**(`QualityVerification.gs:355-357` "★ 복구를 trim보다 먼저" — 선두 제어문자가 trim에 소실되기 전에 복원). tool_use·structured output을 써도 이 복구는 면제되지 않는다.

→ `lib/verify/parse.ts`에 두 함수를 이식하고 `npm run test:verify`의 1급 회귀 대상으로.

### 3-3. 프롬프트 치환은 함수형으로 (v2 지적 수용)

`.replace(pattern, text)`의 `text` 안 `$$`·`$&`가 치환 패턴으로 해석돼 LaTeX가 손상된다. 시트 STEP3는 함수형 치환으로 막았고(`QualityVerification.gs:271-273, 305-308` "★ 함수형 치환 필수"), **STEP1은 아직 안 고쳐진 자리다**(`Itemverification.gs:302-303`) — 그쪽을 베끼지 말 것. 테스트에 `$$` 포함 케이스 필수.

### 3-4. D5′ — stale은 탭 정규화 해시로 (v2 개정 수용 + V4 배선 구체화)

v1 D5(저장 경로 훅)는 성립하지 않는다 — `handleSave`는 탭 구분 없이 **매 저장마다 전 탭 delete-all → re-add**(`EditorView.tsx:2543-2564`). 그대로 구현하면 모든 편집이 두 kind를 동시에 stale로 만들어 신호가 죽는다.

**개정 D5′**: 비교는 저장 시점, 목록은 불리언만.

1. 검증 성공 시 `verification[kind].contentHash` = 대상 탭의 정규화 해시.
2. `handleSave`에서 같은 해시를 계산해 `stale = (hash !== contentHash)`를 값이 바뀔 때만 write.
3. 목록·폴더뷰는 불리언만 읽는다(블록 로드 0).

**배선(V4)**: 해시 조합을 직접 만들지 말고 기존 파이프라인을 재사용한다 — `collectCurrentContent`(`lib/version/adapter.ts`, `toPersistedBlock` 통과본으로 정규화 + 탭 로드 실패 가드 F7까지 공짜) → `hashPerTab`(`lib/version/hash.ts:10`, 내부에서 `canonicalizeTab`+`sha256`). **`snapshotCurrent`의 `last_version_tab_hashes`는 쓰지 말 것** — `!silent`일 때만 갱신되어(`EditorView.tsx:2627`) 자동저장에서 신호가 샌다.

**V3 (신규)**: `canonicalizeTab`은 제목·정답을 포함하지 않는다(`canonicalize.ts:6`). 그런데 **문제 검증의 `answerCheck`는 `Problem.answer`에 의존한다** — answer만 고쳐도 리포트는 낡는다. → kind='problem'의 contentHash는 `sha256(canonicalizeTab(question탭) + '\n#answer:' + answer)`로, kind='solution'은 탭 해시 그대로.

### 3-5. D6′ — derivedAnswer는 JSON에만 (v2 개정 수용, §10-2는 (a)로 확정)

- `tab_comments`는 **멤버가 세션 구분 없이 전부 읽는다**(`firestore.rules:234-236`) — 접기는 UI일 뿐.
- `<details>`는 예약 문법 — `stripForHistory`가 `[검산 코드 첨부됨]`으로 치환한다(`CommentPanel.tsx:35`). 리포트에 쓰면 히스토리에 거짓 문구가 들어간다.

**A2 판정 — (a) 유지가 답이다**: `derivedAnswer`는 ` ```mathory-verify ` JSON에만 두고 카드 자체 토글로 펼친다. (b)(서버가 answerCheck만 반환)는 후속 대화에서 "AI가 구한 답이 뭐였는데?"를 물을 수 없게 만들어 삼자 대조의 진단 가치를 죽이고, (c)(오너 전용 서브컬렉션)는 규칙 변경이라 기획서 "규칙 0"에 위배된다. 그리고 **멤버 열람은 애초에 새 유출이 아니다** — 멤버는 이미 `Problem.answer`와 풀이 탭 전문을 읽는다(problems read = 오너∥공개∥멤버, `firestore.rules:82`). ⚠ 단 `Problem.verification`에는 verdict·시각·해시·stale·reportCommentId만 — findings·derivedAnswer는 **절대 금지**(그 문서는 public도 읽는다).

### 3-6. D4 — 오너 전용은 규칙이 강제한다 (v2 격상 수용)

AI 댓글 create는 **오너만**(`firestore.rules` "(b) AI 댓글: 오너만 가능" — `authorType=='ai' && isOwnerCmt()` 실측 확인). 비오너에게 칩을 노출하면 "비용은 쓰고 저장만 실패"가 된다. D4는 정책이 아니라 필수 게이트.

### 3-7. 블록 앵커 (v2 보강 수용)

- 저장이 delete-all→re-add라 **블록 doc id는 저장마다 전부 갈린다** — 교정 결과도 그래서 저장 시 통째로 버린다(`EditorView.tsx:2612` `setProofreadResults({})`). 앵커는 `block_key`가 맞다(v1 결정 유지, 근거 보강).
- `data-block-id`의 값은 `block.id`다(`EditorView.tsx:3389`, `TabBody.tsx:143,173`) → 클릭 시 `blockKeyOf(b)===blockKey`인 블록을 찾아 **그 id로** 셀렉터를 만든다(`lib/caseBlock.ts:34` 재사용).
- `block_key`는 optional, 로드 시 즉석 발급(`EditorView.tsx:1158`) → 한 번도 저장 안 된 레거시 블록은 새로고침마다 키가 바뀐다. **§3-8의 검증 전 저장 강제가 이 문제를 같이 없앤다**(`toPersistedBlock`이 키를 영속화).

### 3-8. 검증 대상은 저장본이다 (v2 지적 수용 → D11)

`fetchTabBlocksText`는 Firestore에서 읽는다 — 미저장 편집은 검증되지 않는다. 실행 직전 `dirty`면 `handleSave()` 먼저, 저장 실패면 **실행하지 않는다**(비용이 나가는 동작에 조용한 진행 금물).

### 3-9. `verification` 쓰기는 전용 함수로 (v2 지적 수용)

`updateProblem`은 무조건 `updated_at`을 갱신하고(`firestore.ts:57-64`) 목록은 `updated_at desc` 정렬(:126-131) → 검증만 돌려도 문항이 맨 위로 올라온다. `setVerification(problemId, kind, patch)`를 `lib/firestore.ts`에 신설(`updateDoc`, `updated_at` 미갱신).

### 3-10. EditorView 주입 전용 (v2 지적 수용 → D12)

`CommentPanel`은 `EditorView.tsx:3508`과 `ProblemView.tsx:886` **두 곳**에 마운트된다. `onInsertGraphBlock` 선례처럼 `onRunVerify`/`onJumpToBlock`을 **EditorView에서만 주입** — prop 유무가 곧 게이트, ProblemView 변경 0.

### 3-11. 블록 점프 규약 (v2 지적 수용)

스크롤 헬퍼는 EditorView 내부 `useCallback`이다(:1898-1990). `onJumpToBlock(blockKey, tabId)` 콜백으로 구현하되: ① 다른 탭이면 `switchTab` 경유(자동저장 동반, :2643-2647) ② 활성 블록 변경 시 `skipNextBlockScrollRef` 계약 준수(CLAUDE.md:100 — 직접 스크롤 핸들러는 게이트 조건을 자기 안에 다시 적을 것) ③ `block_key` 소실 시 토스트 안내 후 미스크롤. `scrollIntoView` 금지, `lib/editorScroll.ts` 경유.

### 3-12. `{format}` — `answerFormat` 문자열로 (v2 지적 수용)

시트 `getFormatGuide`는 combo/math/int/기본 4갈래(`Itemverification.gs:522-528`). 클라가 블록 구성·answer로 유도한 `answerFormat: string`(안내 문구 그대로)을 보내고 서버는 `{format}`에 꽂는다.

### 3-13. 시간 예산 (v2 지적 수용)

verify는 2콜 직렬이라 300초 상한을 넘길 수 있다. 시트 방식(예산 반분, `QualityVerification.gs:275`)대로 다리별 `AbortController` 예산. **2차 시작 전 잔여 예산을 검사해 부족하면 그 자리에서 실패 처리**(호출 없이) — D13′과 정합.

### 3-14. 컨텍스트 상한 → D14′ (v2 지적을 수용하되 처리 위치 개정)

15,000자 상한(agent 관례) 유지. 단 **클라이언트가 블록 수집 직후, 팝오버 표시 전에 검사해 실행 자체를 차단**한다("문항이 너무 깁니다 — n자/15,000자"). 서버도 400으로 방어. `skip` verdict로 기록하지 않는다 — skip은 AI가 판정한 검증 불가(B-8)에 예약, 그리고 사전 차단이면 비용이 0이다.

### 3-15. 인용 실재성 = 앵커 확정 장치 (v2 지적 수용 + A3 보강)

시트의 quote 실재성 검사(`normalizeForQuoteCheck_` 공백 제거 후 `indexOf`, `QualityVerification.gs:369-371`)를 한 걸음 확장 — 공백 제거한 각 블록 `raw_text`에서 인용을 찾아 **서버가 `blockKey`를 확정**한다. 모델의 `[블록 n]` 라벨은 1차 힌트로 격하.

**A3 판정**: ① 프롬프트에서 **연속 원문 부분 문자열 인용을 강제**한다(생략부호 `…` 금지 — 시트의 "축약 인용"도 짧은 연속 인용이지 중략이 아니다) ② 전문 매칭 실패 시 공백 제거 **앞 20자 프리픽스 폴백** ③ 그래도 실패면 `quoteFound:false` + 해당 지적 `check` 강등 + `blockKey:null` (환각 신호).

### 3-16. 신규 보강 V1·V2 (v3)

- **V1 — 1차 Gemini에 JSON mime 배선**: 시트 STEP3 1차는 `response_mime_type:'application/json'`을 쓴다(`QualityVerification.gs:482`) — 실사용 검증된 설정인데 v2 provider 확장 목록에 빠져 있었다. `CompleteOptions`에 additive로 추가해 verify 1차에 적용. ⚠ mime JSON이어도 `\f` 오염은 파싱을 통과하므로 §3-2 복구는 여전히 필수.
- **V2 — 정답 불일치는 후보 0으로 끝나지 않는다**: v2 파이프라인은 "후보 0 → 즉시 ok"인데, kind='problem'에서 `derivedAnswer ≠ answer`(mismatch)면 후보가 없어도 ok로 끝내면 안 된다 — 삼자 대조가 어긋났다는 것 자체가 의심 지점이다. → mismatch면 서버가 `정답불일치` 후보 1건을 자동 생성해 **2차 판정으로 넘긴다**(원인 진단: 문제 결함/풀이 오류/정답 입력 실수). `no_answer`(D열 공란 96%)는 해당 없음.

---

## 4. 공유 자산 · 프롬프트

원본은 Mathory `lib/verify/prompts.ts`. 시트 pmt는 이후 이 원본에서 손복사(운용 규칙, 코드 자동화 없음).

- **판정 어휘 `ok / check / fail / skip` 통일**(D2). 시트 STEP1·2의 `error`(내용 결함)는 `fail`에 대응. **API 실패는 verdict가 아니다** — HTTP 오류로 처리하고 `verification` 미갱신.
- **지적 태그 — 기획서 B-3 원문 그대로 (E-4 확정 체계, v2의 개명 원복)**:
  문제 `조건결함 | 답유일성 | 선택지오류 | 표기` / 풀이 `계산오류 | 표기오류 | 논리비약 | 논리오류 | 서술비일관 | 경우누락 | 문제풀이불일치` / 공통 `정답불일치`.
  서버가 `sanitizeFindings`로 화이트리스트 정규화(시트 `sanitizeCandidates_` 등가: 미지 태그 근사 매핑, quote·reason 둘 다 빈 것 제거).
- 프롬프트는 시트 자산 **기반 신규 작성**(출력 스키마가 다르다 — 시트는 사람이 읽는 문자열, Mathory는 블록 앵커·태그 달린 findings 배열). **계승**: 보수 판정 문구("확신 없으면 check", "모델이 못 풀었다고 fail 아님"), fail 확정 전 재검토 1회, 후보 상한 8, `$...$` 규약, **연속 원문 인용 강제(§3-15)**, 그림 의존 시 `skip`+이유(B-8), `[블록 n]` 라벨 유지 의무.
- 프롬프트 문안은 **파일럿(스텝 2 관문)에서 실물로 확정** — 61a A-4 방침. 계획서에 전문을 싣지 않는다.
- **착수 전 준비물**: 시트에서 `pushPromptCsvToGithub` 1회 실행 → STEP3 2세트를 pmt.csv에 반영(현재 누락 — csv 실측 12행뿐). push 후 `gemini_quality_verify_*`/`claude_quality_judge_*` **접두와 enabled 값** 확인(`getPromptSet`은 enabled=TRUE 행만 읽는다).

---

## 5. 구현 항목

### 5.1 타입 (`types/problem.ts`, 전부 additive)

```ts
export type VerifyKind = 'problem' | 'solution';
export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

export interface VerifyFinding {
  tag: string;                 // §4 태그 union (기획서 B-3 원문)
  verdict: 'fail' | 'check';   // 2차 Claude: valid → fail, uncertain → check
  blockKey: string | null;     // 인용 매칭으로 서버가 확정 (§3-15)
  quote: string;
  reason: string;
  suggestion?: string;
  quoteFound: boolean;         // 인용 실재성 (false = 환각 신호, check 강등됨)
}

export interface VerifyReport {
  kind: VerifyKind;
  verdict: VerifyVerdict;
  findings: VerifyFinding[];
  derivedAnswer?: string;                            // JSON에만. markdown 본문 금지 (D6′)
  answerCheck?: 'match' | 'mismatch' | 'no_answer';
  models: { first: string; judge: string | null };   // null = 후보 0으로 2차 미호출 (그 외 미완료는 리포트 자체가 없다 — D13′)
  note?: string;                                     // '(후보 없음)' 등
  verifiedAt: number;
}

// Problem 안:
verification?: Partial<Record<VerifyKind, {
  verdict: VerifyVerdict;
  verifiedAt: number;
  contentHash: string;        // D5′·V3 — problem은 question탭 해시+answer, solution은 탭 해시
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
body: { kind, problemBlocks: [{ blockKey, type, text }], solutionBlocks?,
        answer: string, answerFormat: string, hasImages: boolean }
응답: { report: VerifyReport, usage: { inputTokens, outputTokens, costUsd } }
```

파이프라인: ❶ 1차 Gemini(thinking HIGH + JSON mime[V1])로 후보 생성(상한 8, `[블록 n]` 라벨 힌트. kind='problem'은 STEP1 계승 — 독립적으로 풀어 `derivedAnswer` 도출, 서버가 `answerCheck` 산출) → ❷ 인용 실재성 매칭으로 `blockKey` 확정(§3-15) → ❸ 후보 0 **이고 mismatch 아님** → 즉시 `ok`(2차 미호출). mismatch면 `정답불일치` 자동 후보 생성(V2) → ❹ 잔여 예산 검사 — 부족하면 호출 없이 실패 반환(D13′) → ❺ 2차 Claude(adaptive thinking + effort high + code_execution, `tool_choice` 강제 없음, `pause_turn` 루프 상한 3) → ❻ 합성(`fail≥1 → fail / check≥1 → check / else ok`).

- **인증(D1)**: `verifyUid`를 `lib/apiAuth.ts`로 추출해 sheet-import와 공용. env는 `VERIFY_ALLOWED_UIDS ?? AUDITION_ALLOWED_UIDS`(신규 env 없이 시작, 분리 여지 유지).
- **모델 env**: `VERIFY_GEMINI_MODEL`(기본 `gemini-3.1-pro-preview`) · `VERIFY_CLAUDE_MODEL`(기본 `claude-opus-4-8`) — `CLAUDE_PROOFREAD_MODEL` 선례. API 키 기존 재사용, **신규 비밀 0**.
- **파싱**: `safeParseJson` 4단계 + `repairLatexControlChars`(파싱 후, trim 전 — §3-2). 실패 시 재시도 1회 후 오류.
- **비용**: 라우트 상수 테이블(Opus 4.8 = $5/$25 per 1M, 출처 주석 필수) + `VERIFY_GEMINI_COST_IN/OUT` env(기본 0 = 미집계).
- 오류: `ApiError` 화이트리스트(61a). 원본 에러 객체 비노출.

### 5.3 `lib/ai-provider.ts` 확장 (D8)

`CompleteOptions`에 additive: `thinking?: 'adaptive'` · `effort?: 'low'|'medium'|'high'|'xhigh'|'max'` · `geminiThinkingLevel?` · `geminiJsonMime?: boolean`[V1] · `maxToolTurns?: number`.
`ClaudeProvider`: thinking/output_config 전달 + `pause_turn` 루프. `GeminiProvider`: `thinkingConfig`·`responseMimeType` 전달. `getVerifyProviders()` export.
**A4 판정 — 회귀 방어를 코드로**: params 조립을 순수 함수(`buildClaudeParams`/`buildGeminiParams`)로 분리하고, **옵션 미전달 시 기존 경로와 바이트 단위 동일 바디**임을 스냅샷 테스트로 고정한다. SDK 직접 호출 대안(proofread식)은 code_execution 파싱(:370-415, 블록 타입 3갈래 + bash 이중 nesting) 재작성 비용 때문에 기각 — discuss·proofread는 새 옵션을 안 넘기므로 동작 무변경.

### 5.4 프롬프트 — `lib/verify/prompts.ts` + `lib/verify/parse.ts`

순수 함수 모듈(import 0, 61a 관례). 세트: `problem_first` · `solution_first` · `judge`. 치환은 **함수형**(§3-3 — STEP1의 미수정 `.replace`를 베끼지 말 것). 테스트: `$$` 치환 · `\frac` 복구 · 4단계 폴백 · 합성 규칙 · 프리픽스 폴백 매칭.

### 5.5 실행 UI — 칩 2개 + 비용 확인

- 위치: `CommentEditor`의 `headerLeft`(현 `AIChipBar` 자리, `CommentPanel.tsx:932`) 옆.
- 게이트: `onRunVerify` prop 존재(= EditorView 전용, D12) **AND** `currentUid === ownerUid`(D4 — 규칙이 강제).
- 클릭 → 확인 팝오버(비용 발생 고지 + 대상 + 실행, E-5). **팝오버 전에 15,000자 검사**(D14′). 진행 표시는 `PendingAIBubble` 재사용(합성 `PendingAI` 항목) — ⚠ 재시도 경로는 분기 필요(`handleRetryAI`가 `aiModels.find` 경유).
- 실행 흐름: dirty면 저장, 실패 시 중단(D11) → 블록 수집(`block_key` 포함) → `/api/verify` → 리포트 `addComment` → `setVerification` → 카드 등장.
- D7: 현재 활성 세션에 꽂는다 — agent 모드는 세션 없으면 전송이 막히므로(`CommentPanel.tsx:594-597`) 없으면 `createNormalSession` 자동 생성.

### 5.6 리포트 카드

- 저장 형태 = `mathory-graph` 선례: `content`에 markdown 요약(종합 판정 + "지적 n건" — 폴백·히스토리용) + ` ```mathory-verify ` 펜스에 JSON.
- 렌더 `VerifyReportCard`: 종합 배지 + 지적 목록(태그 칩 · 인용 · 이유 · 제안 · `quoteFound=false`면 "원문 미확인") + `answerCheck` + 모델·비용 각주 + `derivedAnswer`는 **카드 자체 토글**(`<details>` 금지 — §3-5).
- 지적 클릭 → `onJumpToBlock(blockKey, tabId)`(§3-11).
- `stripForHistory`에 `mathory-verify` 펜스 치환 추가 → 히스토리에는 markdown 요약만.

### 5.7 상태 관리

- `setVerification` 신규(`updated_at` 미갱신, §3-9).
- stale = 탭 해시 비교(D5′·V3·V4), `handleSave`에서 값이 바뀔 때만 write.
- 배지: `ListView`·`FolderView`에 ✓/⚠/✕ + stale이면 "재검증 필요"(기존 `badgeStyle` 관례).
- 규칙 0 · 마이그레이션 0.

---

## 6. 부분 실패의 처리 (D13′ — v2 D13 개정)

**"2차 판정이 완료되지 않은 검증은 검증이 아니다."**

- 2차 API 실패·파싱 실패(재시도 1회 소진)·예산 부족: **리포트를 만들지 않는다.** `ApiError`로 실패 사유 반환 → 클라는 `PendingAIBubble` 오류 표시 + 재시도 버튼. `addComment` 없음, `verification` 미갱신.
- 1차 후보를 findings로 노출하지 않는다 — recall 편향 후보를 지적으로 보이면 오탐이 사용자에게 도달해 **2차가 존재하는 이유(보수 판정)가 무너진다.** 비용 손실은 아프지만 잘못된 배지·잘못된 지적보다 싸다.
- 예산 부족은 ❹에서 **호출 전에** 감지해 낭비를 최소화한다(§3-13).
- `models.judge: null`은 후보 0(정상 ok) 전용으로 남는다.

---

## 7. 결정사항 (v1 D1~D7 · v2 D8~D14 · v3 판정)

| # | 결정 | v3 판정 |
|---|---|---|
| D1 | 인증 = `verifyUid` 공용 추출(`lib/apiAuth.ts`) + fail-closed. env `VERIFY_ALLOWED_UIDS ?? AUDITION_ALLOWED_UIDS` | 유지 |
| D2 | 어휘 `ok/check/fail/skip` 통일. API 실패는 verdict 아님 | 유지 |
| D3 | 2차 출력 = JSON-in-text + 견고 파싱. **근거 = prefill 400 (외부 교차 확인 완료)** | 유지(근거 확정) |
| D4 | 칩은 오너 전용 — **규칙이 강제** | 유지 |
| D5′ | stale = 탭 정규화 해시. **배선은 `collectCurrentContent`+`hashPerTab` 재사용(V4), problem 해시에 answer 포함(V3)** | 수용+보강 |
| D6′ | `derivedAnswer`는 JSON에만, 카드 토글, `<details>` 금지. **A2 = (a) 확정** — 멤버는 이미 answer·풀이 전문을 읽으므로 새 유출 아님 | 수용+확정 |
| D7 | 현재 활성 세션(없으면 자동 생성) | 유지 |
| D8 | provider 확장(additive 옵션 + `getVerifyProviders`). **A4: params 조립 순수 함수 분리 + 미전달 시 동일 바디 스냅샷 테스트** | 수용+보강 |
| D9 | `tool_choice:any` 금지 + `pause_turn` 루프(상한 3) | 수용 |
| D10 | 앵커 = 인용 매칭 서버 확정. **A3: 연속 원문 인용 강제 + 프리픽스 20자 폴백 + 실패 시 check 강등** | 수용+보강 |
| D11 | 검증 전 dirty 저장 강제, 실패 시 미실행 | 수용 |
| D12 | `onRunVerify`/`onJumpToBlock` EditorView 주입 전용 | 수용 |
| **D13′** | 2차 미완료 = **실패. 리포트 미생성·`verification` 미갱신·오류+재시도 안내.** 1차 후보를 findings로 노출 금지 (v2 D13 기각 — **A1**) | **개정** |
| **D14′** | 15,000자 초과 = **클라 사전 차단**(팝오버 전 안내, 서버 400 방어). `skip` verdict 기록 금지 — skip은 AI 판정 전용(B-8) | **개정** |
| **A5** | 폴더 단위 일괄 검증은 **범위 밖** — `/api/verify`가 단건 stateless라 배치는 후속 Phase에서 클라 루프로 얹을 수 있고, 선행 훅이 필요 없다. 기획서 B-6("대량 실행은 시트의 몫")과 정합 | 신규 |

---

## 8. 작업 순서 (파일럿 우선 — 기획서 단계 2→3→4 대응)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/ai-provider.ts` 확장(D8·D9·V1) + `lib/apiAuth.ts` 추출 | **params 스냅샷 테스트**: 옵션 미전달 시 기존 바디와 동일. discuss·proofread 수동 1회 회귀. thinking/effort/mime가 요청 바디에 실림(로그) |
| 1 | `lib/verify/prompts.ts` + `lib/verify/parse.ts` + `npm run test:verify` | `$$` 치환 · `\frac` 복구 · 4단계 폴백 · 합성 규칙 · 프리픽스 매칭 회귀 통과 |
| 2 | `/api/verify` 라우트(인증·예산·비용·V2) | 실제 문항 3~5건(61a로 가져온 것 중 오류 포함 섞어서) 수동 호출 → **유일한 관문: 프롬프트·판정 문안 실물 확정**. 오검출·과검출 피드백 반영, 토큰·비용 실측 기록 |
| 3 | 칩 2개 + 비용 팝오버 + 사전 차단(D14′) + 최소 표시 | agent 창에서 실행·확인 (단계 2 완성) |
| 4 | `mathory-verify` 카드 + 블록 점프 + `stripForHistory` | 지적 클릭 → 블록 이동, 카드 아래 후속 대화 재추궁 (단계 3) |
| 5 | `verification` + stale 해시 + 목록 배지 | 검증 → 배지 / 해당 탭 편집 → 재검증 필요 / **되돌리면 자동 해제** / answer 수정 → problem stale (단계 4) |
| 6 | 마무리: 실패 경로(D13′)·타임아웃, roadmap·Phase 문서 | 실패 시 리포트·배지 오염 0 확인 |

---

## 9. 하지 말 것 / 주의

- 교정(proofread)과 합치지 말 것 — 별도 유지 (기획서 B-2).
- GAS·시트 수정 금지. GAS 인용은 origin/main(`b6b91f6`)만, mathory 인용은 origin/main(`6833fe9`) 기준 (61a Z2).
- 그림 이해 검증 시도 금지 → AI가 `skip`+이유. "더 좋은 풀이 제안" 범위 밖.
- `verification`에 findings·derivedAnswer 금지 — public·member가 읽는 문서다.
- 리포트를 별도 컬렉션에 저장하지 말 것 — 메시지가 단일 저장소.
- 2차 미완료 상태를 리포트·verdict로 만들지 말 것(D13′). API 실패 시 `verification` 미갱신.
- `last_version_tab_hashes`를 stale 신호로 쓰지 말 것(자동저장 미갱신).
- `<details>` 금지(`stripForHistory` 오치환) · `scrollIntoView` 금지(`lib/editorScroll.ts` 경유) · `budget_tokens` 금지(400) · `tool_choice:any` 금지 · prefill 금지(400).
- 태그 이름을 기획서 B-3에서 바꾸지 말 것 — E-4로 확정된 체계다.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 10. 이 Phase가 건드리지 않는 것

시트 가져오기 · Firestore 보안 규칙 · 마이그레이션 · 인쇄 · 공개 뷰어 · 전처리 파이프라인 · discuss/proofread/ocr/ai-complete **라우트**. **전부 0건.**
신규 파일 5개(`app/api/verify/route.ts` · `lib/verify/prompts.ts` · `lib/verify/parse.ts` · `lib/apiAuth.ts` · `components/comment/VerifyReportCard.tsx`) + `types/problem.ts` additive + `lib/ai-provider.ts` additive 옵션 + `lib/firestore.ts` `setVerification` + `CommentPanel` · `EditorView` · `ListView` · `FolderView` 각 소폭.

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 초안 + D1~D7 (덕수 확정) |
| v2 | CLI | 실측 교차검토 — §3-1~3-15 지적, D5·D6 개정, D8~D14 신설, 질문 5건 |
| **v3** | **web** | **v2 전 지적 재검증(전건 사실 확인) · 태그 개명 원복 · D13′/D14′ 개정 · A1~A5 판정 · V1~V4 보강** |

교훈(61a 계승): v2의 지적 15건이 전부 실측으로 확인됐다 — **교차검토의 가치는 "누가 옳은가"가 아니라 상대가 안 본 파일을 봤는가에 있다.** v1은 시트 시스템과 저장 규칙을 봤고, v2는 provider 내부·저장 경로·보안 규칙 세부를 봤다. 남은 오류(태그 개명)는 코드가 아니라 **상위 문서(기획서 E-4)와의 대조**에서만 잡히는 부류였다 — 교차검토는 코드만이 아니라 결정 이력과도 해야 한다.

*v3 — 착수 가능. 착수 전 덕수 준비물: 시트에서 `pushPromptCsvToGithub` 1회 실행(STEP3 프롬프트 원문 확보). `VERIFY_*` env는 전부 기본값이 있어 선택.*
