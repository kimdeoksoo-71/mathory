# Phase 61d 구현 계획서 — 폴더 일괄 정밀 검증 (v1)

> 대상: CLI Claude (교차검토용 초안) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md` B-6, `Phase61b 정밀 검증 구현 계획서 v3.md` **A5**
> 작성: 2026-08-23 web · 진실 원천: mathory **origin/main `3a85141`** (61b·61c 구현 완료 반영본)
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 덕수 결정사항 (2026-08-23, 착수 전 확정)

| # | 결정 |
|---|---|
| E61d-1 | **하위폴더 문항은 제외.** 선택한 폴더의 직속 문항만 대상 |
| E61d-2 | 대상 선정은 **체크박스 선택 화면**으로. 기본값은 "검증 필요" 문항만 체크(미검증·재검증 필요·check/fail), 이미 ✓이고 stale 아닌 것은 해제 상태로 표시 |
| E61d-3 | 한 문항 실패(API 오류·15,000자 초과 등) 시 **건너뛰고 계속**, 종료 시 요약 표시 |
| E61d-4 | 결과 요약은 **화면 표시만** — Firestore에 배치 이력을 저장하지 않는다. 영속 기록은 기존 검증 배지(`Problem.verification`)가 담당 |

## 1. 한 줄 요약

FolderView에 [일괄 검증] 버튼을 달아, 폴더 직속 문항들을 체크박스로 고른 뒤
기존 `runVerifyFlow`(61b)를 **문항×종류(문제/풀이) 단위로 순차 호출**하는 클라이언트 루프를 돈다.
서버·규칙·스키마 변경 0 — 61b v3 A5("배치는 후속 Phase에서 클라 루프로 얹는다")의 이행이다.

## 2. 아키텍처

**신규는 UI(다이얼로그)와 클라 오케스트레이터뿐이다.**

- `/api/verify`는 stateless 단건 그대로 — **라우트 무변경**. 배치의 "상태"는 실행 중인 브라우저 탭의 메모리에만 있다.
- 문항 하나의 검증·저장·`verification` 갱신은 61b의 `runVerifyFlow`(`lib/verifyFlow.ts`)를 **그대로** 호출한다. 배치가 61b와 다른 리포트를 만들면 안 된다 — 단건 검증과 결과물이 비트 단위로 같은 것이 정합성의 기준.
- 결과 열람도 기존 경로 그대로: 개별 리포트는 각 문항의 agent 세션 메시지, 목록 표시는 `VerifyBadge`.

## 3. 확정 사실 (origin/main `3a85141` 실측)

### 3-1. `runVerifyFlow`는 이미 "편집창 없이" 돈다 — 선례는 ProblemView

61b 구현이 계획서와 달라진 지점이 배치에 유리하다: 검증 흐름이 `lib/verifyFlow.ts`로 추출되어
EditorView와 **ProblemView(열람뷰)가 공용**한다. ProblemView는 저장본(`problem.tabBlocks`)만으로
`runVerifyFlow`를 호출한다(`ProblemView.tsx:256-`). 배치도 같은 방식이다 —
`getProblemWithBlocks(problemId)`(`lib/firestore.ts:212`)가 필요한 재료 전부(tabs·tabBlocks·
tabLoadErrors·title·answer)를 반환하므로, **문항을 열지 않고** 폴더 목록에서 바로 검증할 수 있다.
편집창의 "dirty면 저장 먼저"(D11) 단계는 배치에 없다 — 열람뷰와 같은 이유로, 저장본이 곧 대상이다.

### 3-2. 문항×종류당 HTTP 2회, 최악 수백 초 — 순차가 강제 사유다

61b는 실측(1차 두 패스+2차 = 228초) 때문에 요청을 `phase:'first'` → `phase:'judge'` 두 번으로
쪼갰다(`verifyFlow.ts` 헤더 주석, 각 단계 `maxDuration` 300초). 즉 한 문항의 문제+풀이 검증은
HTTP 최대 4회·수 분이다. n문항 배치는 **수십 분~시간 단위**가 정상이며, 병렬화하면 Vercel
동시 실행·API rate limit·비용 폭주를 한꺼번에 부른다. 덕수 요청("순차적으로")대로
**1문항×1종류씩 직렬**로만 돈다.

### 3-3. 리포트에는 세션이 필요하다 — 배치가 자동 확보해야 한다

리포트는 `addComment(discussionSessionId: ...)`로 저장된다. 칩 경로에서는 사용자가 고른 활성
세션이 있지만, 배치는 문항을 열지 않으므로 세션을 스스로 마련해야 한다.
`createNormalSession(problemId, name, uid)`(`lib/discussion-sessions.ts:67`) ·
`listSessions`(`:105`) · `DiscussionSession.type: 'normal'`(`types/problem.ts:186`)이 재료다. → D61d-6.

### 3-4. 15,000자 상한은 실행 직전 클라 차단 — verdict가 아니다 (61b D14′ 계승)

칩은 팝오버 전에 길이를 재고(`CommentPanel.tsx` `VERIFY_CHAR_CAP = 15_000`), 서버도
`MAX_INPUT_CHARS`로 400 방어한다(`app/api/verify/route.ts`). 배치도 같은 검사를 **각 문항 블록
로드 직후, 호출 전에** 하고, 초과 문항은 "건너뜀(사전 차단)"으로 요약에만 기록한다.
`skip` verdict로 적지 않는다 — skip은 AI가 판정한 검증 불가(B-8) 전용 어휘다.
선택 화면에서는 글자 수를 미리 보여줄 수 없다(목록은 블록을 로드하지 않는다, 3-7) — 실행 중 발견이 맞다.

### 3-5. 오너 게이트 — 규칙이 강제한다 (61b D4 계승)

AI 댓글 create는 오너만(firestore.rules). 기준은 ProblemView의 `isVerifyOwner`와 동일하게
**`problem.authorUid === user.uid`** (authorUid 없는 레거시 문항은 오너 취급하지 않는다 —
규칙상 AI 댓글이 막히므로). 배치 버튼 노출과 개별 항목 활성화 **양쪽**에 이 게이트를 건다:
버튼은 일반 폴더(휴지통·미지정·공유 뷰 제외, `listContext`·`passthrough` 없음)에서만,
항목은 게이트 통과 못 하면 체크 불가로 비활성.

### 3-6. "폴더 직속만"은 기존 필터와 자연 일치 — 재귀 수집을 만들지 말 것

FolderView의 `folderProblems`는 이미 `p.folder_id === folder.id`만 남긴다(하위폴더 문항은
`problems` prop에 있어도 걸러진다). 하위 폴더는 `getChildren(folders, folder.id)`로 **표시만**
된다. E61d-1은 이 필터를 그대로 쓰면 끝이다 — 하위폴더 재귀 수집 코드를 새로 쓰는 순간
결정을 위반한다.

### 3-7. "검증 필요" 판정은 목록 데이터만으로 된다 — 블록 로드 0

기본 체크 규칙(E61d-2)의 재료는 `Problem.verification`의 요약(verdict·stale)뿐이고, 이것은
목록 문서에 이미 있다(61b D5′가 그렇게 설계한 이유). `VerifyBadge`와 같은 소스를 읽으므로
선택 화면은 추가 Firestore 읽기 없이 뜬다. 종류(kind)별 판정:
`검증 필요 = !verification[kind] || stale || verdict ∈ {check, fail}`.

### 3-8. `setVerification`은 `updated_at`을 건드리지 않는다 — 배치가 정렬을 흔들지 않는다

61b가 이미 `updateProblem`(무조건 `updated_at` 갱신) 대신 전용 `setVerification`
(`lib/firestore.ts:72`)을 쓴다. 배치 n건을 돌려도 목록 순서는 그대로다. 단 배지 갱신을 위해
목록 리프레시는 필요하다 → `onUpdated` 콜백(FolderView prop에 이미 존재)을 **배치 종료 시 1회** 호출.
문항별 호출은 진행 중 목록 전체 리로드를 n번 유발하므로 하지 않는다 — 진행 상황은 다이얼로그가 자체 표시.

### 3-9. idToken은 문항마다 새로 받는다

Firebase ID 토큰 수명은 1시간인데 배치는 그보다 길 수 있다. `runVerifyFlow`는 토큰 문자열을
받으므로, 루프가 **문항마다 `user.getIdToken()`을 다시 호출**한다(SDK가 캐시·자동 갱신 —
비용 없음). 배치 시작 시 한 번 받아 돌려쓰면 1시간 뒤부터 전부 401이다.

### 3-10. 진행 표시는 자체 UI다 — `PendingAIBubble` 재사용 불가

61b의 진행 표시는 CommentPanel의 세션 종속 합성 항목이다. 배치는 패널 밖(폴더 화면)에서
돌므로 다이얼로그가 자체적으로 그린다. 재시도도 배치 어휘가 다르다 — 개별 재시도 버튼 대신
"실패 항목만 다시 실행"(요약 화면)이 배치식 재시도다.

## 4. UX 설계 — 다이얼로그 3상태

**진입**: FolderView 헤더(정렬·보기 전환 컨트롤 옆)에 [일괄 검증] 버튼. 노출 조건은 §3-5.
직속 문항 0건이면 버튼 비활성.

**상태 1 — 선택**: 문항 표. 행 = 직속 문항(현재 정렬 순서 그대로), 열 = [문제 검증 ☑] [풀이 검증 ☑] + 현재 배지 상태.

- 기본 체크: §3-7 규칙. 이미 ✓(ok·stale 아님)인 종류는 해제 상태 — 다시 체크하면 재검증 가능(전부 재검증 시나리오 포섭).
- 풀이 탭에 텍스트 블록이 하나도 없는 문항은 [풀이 검증] 비활성 + "풀이 없음" 표시. (목록에서 판정 불가하므로 이 판정만은 실행 시점으로 미루고, 선택 화면에서는 체크 허용 후 실행 중 "건너뜀(풀이 없음)" 처리 — 교차검토 Q5)
- 하단: "n문항 · 검증 m회 · 회당 1~2분, API 비용 발생" + [전체 선택/해제] + [실행].
- 실행 확인은 별도 팝업 없이 이 화면이 관문이다(E-5의 취지 = 실수 클릭 방지 — 선택 화면 자체가 명시적 관문).

**상태 2 — 진행**: 표는 유지, 각 행이 대기 → 진행 중(스피너, 현재 종류 표시) → 완료(verdict 배지) / 실패(사유) / 건너뜀으로 갱신. 상단에 "k / m 완료 · 누적 비용 $x.xx". [중단] 버튼(→ D61d-5).

**상태 3 — 요약**: 집계(✓ a · ⚠ b · ✕ c · skip d · 실패 e · 건너뜀 f) + 실패·건너뜀 목록(사유 포함) + 총 실측 비용·소요 시간 + [실패 항목만 다시 실행] + [닫기]. 닫으면 `onUpdated()` 1회로 목록 배지 갱신.

## 5. 구현 항목

- **`lib/batchVerify.ts` (신규)** — 오케스트레이터. `runBatchVerify(items, callbacks)`:
  문항 루프 { `getIdToken` → `getProblemWithBlocks` → 세션 확보(D61d-6) → kind 루프 {
  사전 차단 검사(§3-4, 풀이 없음 포함) → `runVerifyFlow` → 진행 콜백 } } + 중단 플래그.
  ⚠ `lib/verify/`에 두지 말 것 — 그 폴더는 import 0 순수 모듈 전용(`verifyFlow.ts` 헤더 경고와 동일).
- **`components/problem/BatchVerifyDialog.tsx` (신규)** — 3상태 다이얼로그. `useAuth`로 user 확보.
- **`FolderView.tsx` (소폭)** — 버튼 + 다이얼로그 마운트 + 노출 게이트.
- 서버·규칙·타입·마이그레이션: **0.** `runVerifyFlow`·`buildReportMarkdown`(`VerifyReportCard.tsx:50`)·`setVerification` 재사용.

## 6. 결정사항

| # | 결정 |
|---|---|
| D61d-1 | **서버 변경 0.** 배치는 클라 루프 — 61b A5의 이행. `/api/verify`·프롬프트·파싱 무변경 |
| D61d-2 | 대상 = 폴더 직속만(E61d-1, §3-6). 선택은 문항×종류 체크박스, 기본 체크 = `!verification[kind] ∥ stale ∥ check ∥ fail`(E61d-2, §3-7) |
| D61d-3 | **완전 직렬** — 1문항×1종류씩. 병렬·프리페치 금지(§3-2) |
| D61d-4 | 실패 = 기록하고 계속(E61d-3). 실패·건너뜀은 `verification` 미갱신(61b D13′ 계승) — 배치라고 실패를 verdict로 만들지 않는다. "건너뜀(사전 차단·풀이 없음)"은 요약에만 존재 |
| D61d-5 | 중단 = **진행 중인 종류는 완료·저장까지 마친 뒤** 멈춘다. in-flight abort 금지 — 1차(first) 비용을 이미 썼는데 2차(judge)를 끊으면 D13′에 의해 그 비용이 통째로 버려진다 |
| D61d-6 | 세션 = 각 문항에서 `type:'normal'`이고 이름이 `일괄 검증`인 세션을 찾아 재사용, 없으면 `createNormalSession`으로 생성. 배치마다 새 세션을 만들면 세션 목록이 오염된다 |
| D61d-7 | 요약은 화면만(E61d-4). Firestore 신규 스키마·컬렉션 0 |
| D61d-8 | 배치 진행 중 페이지 이탈은 `beforeunload` 경고로 막는다(브라우저 표준 confirm). 이탈해도 **이미 완료된 문항의 리포트·배지는 저장돼 있다** — 문항 단위가 커밋 단위이고, 배치 전체의 원자성은 애초에 없다(정상) |
| D61d-9 | 비용: 사전 표시는 회수만(모델 단가는 변동·env 종속), 요약에는 `runVerifyFlow`가 돌려주는 실측 usage 합산 |

## 7. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/batchVerify.ts` — 루프·중단·사전 차단·세션 확보 | 단위: 대상 판정 규칙(D61d-2)·중단 시점(D61d-5) 테스트. 세션 재사용 확인(2회 실행 시 세션 1개) |
| 1 | `BatchVerifyDialog` 선택 화면 + FolderView 버튼·게이트 | 기본 체크 규칙이 배지 상태와 일치. 비오너·특수 폴더·공유 뷰에서 버튼 부재 |
| 2 | 진행·요약 화면 + 중단 + `beforeunload` | 3~5문항 실배치: 진행 갱신·중단 동작·요약 집계·`onUpdated` 1회 확인 |
| 3 | 실패 경로: 15,000자 초과·풀이 없음·API 오류 섞은 배치 | 실패 문항 건너뛰고 완주, `verification` 오염 0, [실패 항목만 다시 실행] 동작 |
| 4 | 마무리: roadmap·Phase 문서 갱신 | 61b 단건 검증 회귀(칩 경로 무변경) 확인 |

## 8. 하지 말 것 / 주의

- 하위폴더 재귀 수집 금지(E61d-1) — `folderProblems` 필터 재사용.
- `updateProblem`으로 verification 쓰지 말 것 — `setVerification`만(§3-8).
- 사전 차단·실패를 `skip` verdict로 기록하지 말 것(§3-4, 61b D14′).
- `runVerifyFlow`·`/api/verify`·프롬프트 수정 금지 — 배치는 호출자일 뿐. 단건과 결과물이 달라지면 실패.
- idToken을 배치 시작 시 1회만 받지 말 것(§3-9).
- `PendingAIBubble`·CommentPanel 재사용 시도 금지(§3-10) — 다이얼로그 자체 표시.
- 문항별 `onUpdated` 호출 금지(§3-8) — 종료 시 1회.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 9. 범위 밖

하위폴더 포함 옵션 · 배치 이력 영속화 · 정기/예약 실행 · 병렬화 · 공유받은 문항 검증 ·
서버 측 배치 큐. **전부 0건.** 신규 파일 2개(`lib/batchVerify.ts` · `components/problem/BatchVerifyDialog.tsx`) + `FolderView.tsx` 소폭.

## 10. 교차검토 질문 (CLI Claude에게)

1. **Q1** `FolderView`는 user를 받지 않는다 — 다이얼로그에서 `useAuth` 직접 호출로 충분한가, AppShell에서 prop으로 내리는 관례가 있는가?
2. **Q2** `beforeunload`는 브라우저 이탈만 막는다 — Next.js 클라이언트 라우팅(사이드바 폴더 전환 등)으로 FolderView가 언마운트되는 경로가 있는지, 있다면 다이얼로그를 어디에 마운트해야 배치가 살아남는지 실측 필요.
3. **Q3** `runVerifyFlow`의 두 fetch 사이(first 완료~judge 시작)에 중단 확인 지점을 넣으려면 optional 콜백/플래그 인자 추가(additive)가 필요한가, 아니면 kind 경계 중단(D61d-5)으로 충분한가? — v1은 kind 경계로 충분하다고 본다(first만 끝난 중단은 D13′ 위반 소지).
4. **Q4** `일괄 검증` 세션 이름 매칭이 사용자가 같은 이름으로 만든 일반 세션과 충돌할 수 있다 — 세션 문서에 additive 마커 필드가 나은가? (규칙 변경 없이 가능한지 확인)
5. **Q5** 풀이 없음 판정을 선택 화면에서 하려면 전 문항 블록 로드가 필요하다(§3-7 위반) — 실행 시점 건너뜀 처리(§4)로 확정해도 되는가, 아니면 카드 모드가 이미 로드하는 `getPreviewBlocks` 캐시를 재활용할 여지가 있는가?

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| **v1** | **web (2026-08-23)** | 초안 — E61d-1~4 반영, 사실표 §3-1~3-10 (origin/main `3a85141` 실측), D61d-1~9, 교차검토 질문 5건 |

*v1 — CLI Claude 교차검토(실측 대조) 요청. 특히 §3-6 필터 재사용, D61d-5 중단 시점, Q2 언마운트 경로를 코드로 확인해 줄 것.*
