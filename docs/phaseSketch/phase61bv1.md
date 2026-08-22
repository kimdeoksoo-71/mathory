# Phase 61b 구현 계획서 — 정밀 검증 (agent 대화창 통합) (v1)

> 대상: CLI Claude (교차검토 → 구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **B축**
> 작성: 2026-08-22 web Claude · **결정사항 D1~D7 덕수 확정(2026-08-22, 초안 제안 전건 수용) 반영 완성판**
> **진실 원천: mathory `6833fe9` · gas-project-audition `b6b91f6` (둘 다 GitHub origin/main — 61a 교훈 1에 따라 커밋 해시 명기, 로컬 사본 인용 금지)**
> 범위: 기획서 D 진행표의 **단계 2(검증 코어) + 단계 3(agent 통합) + 단계 4(상태 관리)**. C축(대화→편집창 삽입)은 61c.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

시트 시스템(STEP1~3)에서 검증된 **비대칭 교차검증(1차 Gemini 후보 생성 → 2차 Claude 엄격 판정)** 을
Mathory 서버 라우트(`/api/verify`)로 이식하고, 실행은 agent 대화창의 **칩 2개([문제 검증]/[풀이 검증]) + 비용 확인 팝업(E-5)**,
결과는 대화 스레드에 꽂히는 **리포트 카드**(지적 클릭 → 블록 점프), 상태는 `Problem.verification` additive 필드 + 목록 배지로 만든다.

---

## 1. 아키텍처

**서버는 검증 엔진 프록시, 컨텍스트 조립과 저장은 클라이언트.** (discuss 관례 그대로)

- 서버 `app/api/verify/route.ts` — 블록 배열을 받아 2단 교차검증을 수행하고 리포트 JSON만 반환. **Firestore 미접촉.**
- 클라이언트 — 블록 수집(기존 `fetchTabBlocksText` 관례를 블록 단위로 확장) → 라우트 호출 → 결과를 **agent 메시지(comment)로 저장**(`addComment`, `authorType:'ai'`) → `Problem.verification` 갱신.

이유: (a) discuss·proofread와 동일 구조라 입구가 하나로 유지된다(기획서 B-1 "새 화면을 만들지 않는다"). (b) 리포트가 일반 메시지로 저장되므로 후속 대화("2번 지적 반례 들어봐")가 기존 discuss 파이프라인을 **무변경**으로 탄다. (c) Firestore 규칙 0 · 마이그레이션 0.

---

## 2. 실측으로 확정한 사실

### 2-1. Mathory (`6833fe9`)

| 사실 | 위치 |
|---|---|
| agent 패널 = `CommentPanel` (`mode='agent'`), 세션형(`discussion_sessions`), AI 칩 + 입력창 영역이 하단에 있음 | `components/comment/CommentPanel.tsx:46-98, 873-` |
| AI 메시지 저장 관례: `addComment({ authorUid:'ai:{modelId}', authorType:'ai', modelId, discussionSessionId, aiUsage })` | `CommentPanel.tsx:521-534` |
| **fenced 특수 블록 선례**: AI 응답 속 ` ```mathory-graph ` 펜스를 감지해 그래프 카드로 렌더, 히스토리 전송 시 `stripForHistory`가 `[그래프 첨부됨]`으로 치환 | `CommentPanel.tsx:34, 1354` |
| discuss 라우트 = 얇은 프록시. 컨텍스트 조립은 클라(`buildContext`, 15,000자 상한). `maxDuration=300`(Vercel Pro 필수). **인증 없음** | `app/api/discuss/route.ts:14-18`, `CommentPanel.tsx:450-471` |
| discuss 시스템 프롬프트에 KaTeX `$...$` 강제 규약 + 검산 지침(Phase 41) 기존재 | `app/api/discuss/route.ts:44-, 139-` |
| **SymPy 검산 인프라 기존재**: Gemini `codeExecution`, Claude `code_execution_20250825`(+`tool_choice:any` 강제 옵션), GPT `code_interpreter`. 검산 코드·결과는 `<details>` 부록으로 직렬화 | `lib/ai-provider.ts:32-66, 327-` |
| **구조화 출력 선례**: proofread가 Claude + **tool_use 강제**로 JSON 스키마 응답을 받는다 (Anthropic SDK 직접 사용, AIProvider 미경유) | `app/api/proofread/route.ts` |
| provider env: `GEMINI_API_KEY`·`ANTHROPIC_API_KEY`·`OPENAI_API_KEY` 등 기존재. `GeminiProvider`는 현재 `jsonMode` 미지원(opts 무시) | `lib/ai-provider.ts:440-446, 69` |
| **라우트 인증 선례(61a D1)**: `verifyUid` = ID 토큰 릴레이 + `accounts:lookup` 검증 + uid 허용목록(fail-closed) + `ApiError` 화이트리스트 | `app/api/sheet-import/route.ts:70-` |
| 블록 앵커: 미리보기 DOM에 `data-block-id` 존재, 스크롤은 `lib/editorScroll.ts`(`fastScrollTo` 등) 경유가 규약 | `EditorView.tsx:1904-1987`, `CLAUDE.md` |
| **`block_key`는 저장을 넘어 안정**(Phase 55 diff 연속성), 블록 문서 `id`는 저장 시 바뀔 수 있음 → 영속 앵커는 `block_key`로 | `EditorView.tsx:1158, 1726` |
| `Problem`에 additive 필드 추가는 배선 0 (`listProblems` 스프레드 매핑, 규칙 화이트리스트 없음, update는 오너만) | `lib/firestore.ts:142-151`, `firestore.rules:84-90` |
| 목록 배지 선례: ListView가 문항 행에 💬(미해결 댓글)·AI 대화 배지를 이미 단다 | `components/problem/ListView.tsx:138-146, 224` |
| `ImportSource.stem_hash`용 해시 함수가 `lib/sheetImport.ts`에 기존재 (61a) | `lib/sheetImport.ts` |
| 교정(proofread)은 표면 검사 전담으로 **그대로 별도 유지** (기획서 B-2) | — |

### 2-2. 시트 시스템 (gas-project-audition `b6b91f6`)

| 사실 | 위치 |
|---|---|
| STEP1(문제)·STEP2(풀이) 프롬프트는 `prompts/pmt.csv`에 있음: `gemini_problem_verify_*` · `gemini_solution_verify_*` (+gpt 판본). 플레이스홀더 `{problem}` `{solution}` `{format}` | `prompts/pmt.csv` |
| ⚠️ **STEP3 프롬프트 2세트(`gemini_quality_verify` / `claude_quality_judge`)는 pmt.csv에 없다** — pmt 시트에만 존재. `pushPromptCsvToGithub`(`pushPrompt.gs`)로 push 가능 | 실측 (csv 키 전수 확인) |
| STEP3 교차검증 구조: 1차 Gemini(recall, 후보 상한 **8**) → 후보 0이면 ok로 종료(Claude 미호출, 비용 절감) → 2차 Claude(precision) → 코드 합성: **valid≥1 → fail / uncertain≥1 → check / else ok** | `QualityVerification.gs:17-22, 283, 428` |
| STEP3 모델: 1차 `gemini-3.1-pro-preview`(thinking HIGH) · 2차 `claude-opus-4-8`(effort high, max_tokens 16000, 샘플링 파라미터 설정 시 400) | `QualityVerification.gs:48-57` |
| **판정 어휘가 갈려 있다**: STEP1·2는 `ok/check/error/skip`, STEP3는 `ok/check/fail/skip`(error·timeout은 API 실패 전용) | `pmt.csv`, `QualityVerification.gs:23-24` |
| 보수 판정 철학이 프롬프트에 명문화: "확신 없으면 check", "모델이 못 풀었다고 error 아님", error 확정 전 재검토 1회 | `pmt.csv` 각 system |
| STEP1 `{format}`은 K열(answer_type)로 유도 — **Mathory에는 K열이 없다**(61a에서 미가져옴). 선택지 블록 유무로 대체 유도 필요 | `Itemverification.gs:286-304` |
| 61a 실측 이월: **D열(공식 정답)은 3.9%만 채워짐** → `Problem.answer`가 빈 문항이 다수 → 삼자 대조(B-3 정답 불일치)는 answer가 있을 때만 3자, 없으면 2자(AI 도출답 ↔ 풀이 결론)로 축소 동작해야 한다 | roadmap 61a 교훈 3 |

---

## 3. 공유 자산 이식 (기획서 B-7)

원본을 Mathory 저장소 **`lib/verify/prompts.ts`** 에 둔다 (프롬프트 세트 · 판정 어휘 · 태그 체계 · 교차검증 정책 상수). 시트 pmt는 이후 이 원본에서 손 복사(운용 규칙, 코드 아님).

- **판정 어휘는 `ok / check / fail / skip`으로 통일** (STEP3 어휘). 시트 STEP1·2의 `error`는 이식 시 `fail`에 대응시킨다. 기획서 B-4가 이미 이 4어휘를 확정했다.
- **지적 태그**: 기획서 B-3 표 그대로 union 타입으로 —
  문제: `조건결함 | 답유일성 | 선택지오류 | 표기` / 풀이: `계산오류 | 표기오류 | 논리비약 | 논리오류 | 서술비일관 | 경우누락 | 문제풀이불일치` / 공통: `정답불일치`.
- 프롬프트는 시트 자산을 **기반으로 신규 작성**한다(그대로 복사 불가): 출력 스키마가 다르다 — 시트는 셀에 넣을 문자열(error_report), Mathory는 **블록 앵커·태그가 달린 findings 배열**이어야 한다. 계승할 것: 보수 판정 문구, 재검토 1회 규칙, 후보 상한 8, `$...$` 규약, 축약 인용 규칙.
- **덕수 할 일(코드 밖)**: 시트에서 `pushPromptCsvToGithub` 1회 실행 → STEP3 프롬프트 2세트를 pmt.csv에 반영 (현재 누락 상태라 이식 원문을 GitHub에서 읽을 수 없다).

---

## 4. 구현 항목

### 4.1 타입 (`types/problem.ts`, 전부 additive)

```ts
export type VerifyKind = 'problem' | 'solution';
export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

export interface VerifyFinding {
  tag: string;               // §3 태그 union
  verdict: 'fail' | 'check'; // 지적 단위 판정 (2차 Claude의 valid → fail, uncertain → check)
  blockKey: string | null;   // 해당 블록 block_key (특정 불가 시 null)
  quote: string;             // 해당 구절 축약 인용
  reason: string;            // 무엇이 왜 문제인지
  suggestion?: string;       // 수정 제안 (가능할 때)
}

export interface VerifyReport {
  kind: VerifyKind;
  verdict: VerifyVerdict;               // 종합 (합성 규칙: fail≥1 → fail / check≥1 → check / else ok)
  findings: VerifyFinding[];
  derivedAnswer?: string;               // 문제 검증: AI 독립 풀이 도출답 (삼자 대조 재료)
  answerCheck?: 'match' | 'mismatch' | 'no_answer';  // 등록 정답 대조 결과 (answer 없으면 no_answer)
  models: { first: string; judge: string };
  verifiedAt: number;
}

// Problem 에:
verification?: Partial<Record<VerifyKind, {
  verdict: VerifyVerdict;
  verifiedAt: number;
  stale?: boolean;            // 편집 후 재검증 필요 (B-6)
  reportCommentId?: string;   // 리포트 카드 메시지
}>>;
```

### 4.2 서버 라우트 — `app/api/verify/route.ts`

```
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;          // discuss 관례 (Vercel Pro)

POST /api/verify
headers: Authorization: Bearer <Firebase ID token>     (D1 — 61a verifyUid 관례 재사용)
body: {
  kind: 'problem' | 'solution',
  problemBlocks: Array<{ blockKey: string, type: string, text: string }>,  // question 탭
  solutionBlocks?: 동일,                  // kind='solution'일 때
  answer: string,                        // Problem.answer ('' 가능 — 3.9% 현실)
  hasChoices: boolean,                   // {format} 유도용 (K열 대체)
  hasImages: boolean,                    // 그림 의존 skip 판단 재료 (B-8)
}
응답: { report: VerifyReport, usage: { inputTokens, outputTokens, costUsd } }
```

- **파이프라인 (STEP3 구조 이식)**: ① 1차 Gemini — 전량 후보 생성(상한 8), 블록별 텍스트에 `[블록 n]` 라벨을 붙여 보내 앵커를 회수한다. ② 후보 0 → 즉시 ok 반환(2차 미호출, 비용 절감). ③ 2차 Claude — 후보를 엄격 판정(valid/uncertain/rejected), **`code_execution` 활성**으로 계산 오류는 SymPy 검산으로 확정(기획서 B-4의 "기계 검산" — 시트에 없던 Mathory 신규 가치). ④ 코드 합성 — STEP3 규칙 그대로.
- 문제 검증(kind='problem')의 1차는 STEP1 계승: AI가 독립적으로 풀어 `derivedAnswer` 도출 → 서버가 `answer`와 대조해 `answerCheck` 산출(삼자 대조의 재료. answer가 비면 `no_answer`).
- **JSON 수취 방식 (D3 확정)**: 1차 Gemini는 JSON-in-text + 견고 파스(시트 `safeParseGeminiJson_` 관례를 TS로 이식). 2차 Claude는 code_execution과 tool_use 강제가 충돌하므로 **JSON-in-text + 견고 파스로 통일** (시트에서 검증된 방식, 검산과 공존). 파싱 실패는 재시도 1회 후 오류 반환 — 어중간한 리포트를 만들지 않는다.
- 모델은 env 고정(레지스트리 미경유, STEP3 관례): `VERIFY_GEMINI_MODEL`(기본 `gemini-3.1-pro-preview`) · `VERIFY_CLAUDE_MODEL`(기본 `claude-opus-4-8`). API 키는 기존 `GEMINI_API_KEY`·`ANTHROPIC_API_KEY` 재사용 — **신규 비밀 0**.
- 오류 처리: `ApiError` 화이트리스트 관례(61a). 원본 에러 객체 비노출.

### 4.3 프롬프트 — `lib/verify/prompts.ts`

- 순수 상수 모듈 (import 0 지향, 61a `sheetImport.ts` 관례). 세트: `problem_first`(STEP1 계승+태그·앵커 확장) · `solution_first`(STEP2+STEP3 gemini_quality_verify 통합 — 계산·표기·논리를 한 번에 후보화) · `judge`(claude_quality_judge 계승+SymPy 검산 지시).
- 공통 명문화: 보수 판정(확신 없으면 check) · fail 확정 전 재검토 1회 · `$...$` LaTeX · 축약 인용 · **그림 의존으로 판단 불가면 verdict='skip' + 이유** (B-8) · 블록 라벨 `[블록 n]` 회신 의무.
- 프롬프트 문안은 **파일럿(스텝 1 관문)에서 실물로 확정**한다 — 61a A-4와 같은 원칙. 계획서에 전문을 싣지 않는다.

### 4.4 실행 UI — 칩 2개 + 비용 확인 (기획서 B-2, E-5)

- `CommentPanel` agent 모드의 "AI 칩 + 입력창" 영역 상단에 **[문제 검증] [풀이 검증]** 칩 2개. **문항 오너에게만 노출** (D4 — 비용 주체 명확). 교정 기능은 무변경.
- 클릭 → 확인 팝업: "이 검증은 API 비용이 발생합니다" + 대상(문제/풀이) + 실행 버튼 (E-5). 실행 중에는 기존 `PendingAIBubble` 관례로 진행 표시, 칩은 중복 실행 방지 disabled.
- 실행 흐름(클라): 블록 수집(question/solution 탭, `block_key` 포함) → `/api/verify` → 응답 `report`를 §4.5 형식의 메시지로 `addComment` → `Problem.verification[kind]` 갱신(`stale` 해제) → 대화 스레드에 카드 등장.

### 4.5 리포트 카드 (기획서 B-5)

- 저장 형식 = **`mathory-graph` 선례 그대로**: 메시지 `content`에 사람이 읽는 markdown 요약(종합 판정 + 지적 nn건 — 공개 뷰어·폴백용) + ` ```mathory-verify ` 펜스에 `VerifyReport` JSON.
- 렌더: 펜스 감지 시 `VerifyReportCard` 컴포넌트 — 상단 종합 배지(ok/check/fail/skip) + 지적 목록(태그 칩 · 인용 · 이유 · 수정 제안) + `answerCheck` 표시 + 모델·비용(`aiUsage` 관례) 각주. `derivedAnswer`는 **접힘(`<details>` 스타일)으로 노출** (D6 — 정답 스포일러 방지와 삼자 대조 진단 양립).
- **블록 점프**: 지적 클릭 → `blockKey`로 현재 블록을 찾고(`allBlocks`) → `data-block-id` 요소로 `lib/editorScroll.ts` 경유 스크롤 (CLAUDE.md 스크롤 규약 준수 — `scrollIntoView` 금지). 블록이 삭제된 경우 토스트로 안내.
- `stripForHistory`에 `mathory-verify` 펜스 치환 추가 — 후속 대화 히스토리에는 markdown 요약이 실려 AI가 리포트 맥락을 안다. **후속 대화 자체는 기존 discuss 파이프라인 무변경.**

### 4.6 상태 관리 (기획서 B-6)

- 배지: `ListView`·`FolderView` 문항 행에 ✓(ok) / △(check) / ✗(fail) / (미검증), `stale`이면 "재검증 필요" 표시. 기존 💬 배지 옆, `badgeStyle` 관례.
- **stale 전환은 저장 경로 훅으로 (D5 확정)**: EditorView가 question 탭 블록을 저장하면 `verification.problem.stale=true`, solution 탭이면 `verification.solution.stale=true` (extra 탭은 무관). 이미 stale이거나 미검증이면 쓰기 생략 — 저장마다 추가 쓰기가 나가지 않게. 해시 비교 방식은 목록 렌더 시 전 문항 블록 로드가 필요해 기각.
- `verification` 갱신은 기존 `updateProblem` 경유. 규칙 0 · 마이그레이션 0 (미검증 문항은 필드 자체가 없음).

---

## 5. 작업 순서 (파일럿 우선 — 각 스텝이 기획서 단계 2→3→4에 대응)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | `lib/verify/prompts.ts` + `/api/verify` 라우트 (인증 포함) | 실제 문항 3~5건(61a로 가져온 것 중 오류 포함 문항 섞어서)을 수동 호출 → **덕수 검수 관문: 프롬프트·판정 문안 확정**. 오검출·과검출 피드백 반영. 토큰·비용 실측 기록 |
| 2 | 칩 2개 + 비용 팝업 + 최소 표시(요약 markdown만) | agent 창에서 버튼으로 검증 실행·결과 확인 (기획서 단계 2 완성) |
| 3 | `mathory-verify` 카드 + 블록 점프 + `stripForHistory` | 지적 클릭 → 블록 이동, 카드 아래 후속 대화로 재추궁 동작 (단계 3) |
| 4 | `Problem.verification` + stale 훅 + 목록 배지 | 검증 → 배지 표시, 해당 탭 편집 → "재검증 필요" 전환 (단계 4) |
| 5 | 마무리: 부분 실패·타임아웃 처리, roadmap·Phase 문서 | 파싱 실패·API 실패 시 어중간한 상태 미저장 확인 |

**스텝 1이 유일한 프롬프트 관문이다** — 판정 품질은 사양이 아니라 실물로 확정한다.

---

## 6. 하지 말 것 / 주의

- **교정(proofread)과 합치지 말 것** — 별도 유지가 기획서 B-2 확정.
- GAS 프로젝트·시트 수정 금지. GAS 인용은 GitHub origin/main(`b6b91f6`)만 (61a Z2 규칙).
- 그림(이미지) 이해 검증 시도 금지 — skip + 이유 (B-8). "더 좋은 풀이 제안" 범위 밖.
- `verification`은 additive로만 — 기존 문항 마이그레이션 없음. Firestore 규칙 변경 0.
- discuss·proofread 라우트는 무변경. `CommentPanel` 변경은 칩·카드·strip 확장으로 국한.
- 리포트를 별도 컬렉션에 저장하지 말 것 — 메시지(comment)가 단일 저장소. `verification` 필드는 최신 상태 요약만.
- API 실패·파싱 실패 시 `verification`을 갱신하지 말 것 — 실패가 배지를 오염시키면 안 된다.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 7. 이 Phase가 건드리지 않는 것

시트 가져오기(61a 산출물) · Firestore 보안 규칙 · 마이그레이션 · 인쇄 · 공개 뷰어 · 전처리 파이프라인 · discuss/proofread/ocr/ai-complete 라우트. **전부 0건.**
신규 파일 3~4개(`app/api/verify/route.ts`, `lib/verify/prompts.ts`, `VerifyReportCard`, 필요시 서버 파이프라인 분리 모듈) + `types/problem.ts` additive + `CommentPanel`·`EditorView`(stale 훅)·`ListView`·`FolderView` 각 소폭.

---

## 8. 확정 결정사항 (D1~D7 — 덕수 확정 2026-08-22, 초안 제안 전건 수용)

| # | 결정 |
|---|---|
| **D1** | `/api/verify` 인증 = 61a `verifyUid` 관례 재사용(ID 토큰 릴레이 + `accounts:lookup` + 허용목록 fail-closed). 허용목록 env는 **`AUDITION_ALLOWED_UIDS` 그대로 재사용**(같은 사람, env 추가 0). `verifyUid`는 sheet-import에서 공용 모듈로 추출 |
| **D2** | 판정 어휘는 `ok / check / fail / skip`으로 통일 (기획서 B-4 어휘). 시트 STEP1·2의 `error`는 이식 시 `fail`에 대응 |
| **D3** | 2차 Claude 출력 = **JSON-in-text + 견고 파스** (tool_use 강제는 code_execution 검산과 충돌 리스크로 기각. 시트에서 검증된 방식) |
| **D4** | 검증 칩은 **문항 오너에게만** 노출 (비용 주체 명확) |
| **D5** | stale 전환 = **저장 경로 훅** (콘텐츠 해시 비교는 목록 렌더 시 블록 전량 로드가 필요해 기각) |
| **D6** | `derivedAnswer`는 카드에 노출하되 **접힘**(`<details>` 스타일) — 정답 스포일러 방지와 삼자 대조 진단을 양립 |
| **D7** | 리포트 메시지는 **현재 활성 세션**에 꽂는다 (B-1 "버튼으로 시작하고 대화로 이어진다" 철학. 세션이 없으면 생성 유도) |

---

*v1 완성 — 실측 기반, D1~D7 확정 반영. 교차검토(CLI) → 필요 시 v2 → 착수. 착수 전 덕수 준비물: 시트에서 `pushPromptCsvToGithub` 1회 실행(STEP3 프롬프트 원문 확보), Vercel에 `VERIFY_*` 모델 env 2종(선택, 기본값 있음).*
