# Phase 61d 구현 계획서 — 폴더 일괄 정밀 검증 (v2 착수판)

> 계보: v1 web(2026-08-23) → **v2 CLI 실측 교차검증판**
> 진실 원천: mathory **origin/main `3a85141`** (61b·61c 구현 완료본, 미배포)
> 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md` B-6 · `Phase61b … v4 실행판.md` **A5**
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 결정 확정 (2026-08-23)

### 0-1. 덕수 결정 (v1 계승)

| # | 결정 |
|---|---|
| E61d-1 | **하위폴더 문항은 제외.** 선택한 폴더의 직속 문항만 대상 |
| E61d-2 | 대상 선정은 **체크박스 선택 화면**으로. 기본값은 "검증 필요" 문항만 체크 |
| E61d-3 | 한 문항 실패 시 **건너뛰고 계속**, 종료 시 요약 표시 |
| E61d-4 | 결과 요약은 **화면 표시만** — Firestore에 배치 이력을 저장하지 않는다. 영속 기록은 기존 `Problem.verification` 배지가 담당 |

### 0-2. v2 교차검증 결정 (D1~D8 — 전부 추천안 채택)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 기본 체크 = **`!verification[kind] ∨ stale`** — `check`·`fail`은 기본 해제 | 내용이 안 바뀐 `check`/`fail`을 다시 돌리면 거의 같은 리포트가 한 번 더 쌓이고 비용만 든다. 61b 철학상 그 상태는 *사람이 볼 차례*다 |
| D2 | **프리플라이트 일괄 로드** — 실행 시작 시 대상 전건의 블록을 먼저 읽어 스킵을 확정한 뒤 AI 루프 시작 | 어차피 `getProblemWithBlocks`는 문항마다 필요하다(추가 읽기 0). 지연 로드면 15번째 문항의 "풀이 없음"을 28분 뒤에 알려 준다 |
| D3 | 버튼 노출 = **일반 폴더 + 미지정**. 휴지통·공유받음·공유보낸(passthrough·listContext) 제외 | 미지정 문항도 내 소유고 필터가 이미 있다 |
| D4 | `user`는 **AppShell → FolderView prop** | Sidebar·SheetImportModal이 같은 관례. `useAuth`는 마운트마다 `upsertUserProfile` 쓰기를 한 번 더 한다 |
| D5 | `lib/verifyFlow.ts`에 **additive 변경 2건 허용** (① Error에 HTTP status 부착 ② `verifyCharCountOf` 공용 export). 동작·결과물 변경은 금지 | ①이 없으면 403(허용목록 미등록)에서 n건을 헛돈다. ②는 사본이 이미 2개다 |
| D6 | 세션 식별 = **이름 `일괄 검증` 매칭만** | 사용자 세션과 충돌해도 무해(리포트가 그 세션에 쌓일 뿐). 마커 필드는 규칙상 가능하지만 타입·`mapDoc` 확장이 딸려온다 |
| D7 | 순수 판정 로직을 **`lib/verify/batchPlan.ts`(import 0)** 로 분리 + `npm run test:batch` 신설 | 기존 테스트 하니스는 `tsc <파일 하나>` 단독 컴파일이다 — firestore를 import하는 파일은 못 태운다 |
| D8 | 선택 건수 **하드캡 없음**, 30건 초과 시 예상 시간 경고 문구만 | 중단 버튼이 있다 |

---

## 1. 한 줄 요약

FolderView에 [일괄 검증] 버튼을 달아, 폴더 직속 문항을 체크박스로 고른 뒤
기존 `runVerifyFlow`(61b)를 **문항×종류(문제/풀이) 단위로 순차 호출**하는 클라이언트 루프를 돈다.
**서버·규칙·스키마 변경 0** — 61b v3 A5("배치는 나중 Phase에서 클라 루프로 얹는다")의 이행이다.

## 2. 아키텍처

**신규는 UI(다이얼로그)와 클라 오케스트레이터뿐이다.**

- `/api/verify`는 stateless 단건 그대로 → **라우트 무변경**. 배치의 "상태"는 실행 중인 브라우저 탭 메모리에만 있다.
- 문항 하나의 검증·저장·`verification` 갱신은 61b의 `runVerifyFlow`(`lib/verifyFlow.ts`)를 **그대로** 호출한다.
  배치가 61b와 다른 결과물을 만들면 안 된다 — 단건 검증과 결과물이 비트 단위로 같은 것이 적합성의 기준.
- 결과 이동도 기존 경로 그대로: 개별 리포트는 각 문항의 agent 세션 메시지, 목록 표시는 `VerifyBadge`.

---

## 3. 확정 사실 (origin/main `3a85141` 실측)

### 3-1. `runVerifyFlow`는 이미 "편집창 없이" 돈다 — 선례는 ProblemView

61b 구현이 계획서와 달라진 지점이 배치에 유리하다: 검증 흐름이 `lib/verifyFlow.ts`로 추출되어
EditorView와 **ProblemView(열람뷰)가 공용**한다. ProblemView는 저장본(`problem.tabBlocks`)만으로
`runVerifyFlow`를 호출한다(`ProblemView.tsx:256`). 배치도 같은 방식이다 —
`getProblemWithBlocks(problemId)`(`lib/firestore.ts:212`)가 필요한 재료 전부(tabs·tabBlocks·
tabLoadErrors·title·answer)를 반환하므로 **문항을 열지 않고** 폴더 목록에서 바로 검증할 수 있다.
편집창의 "dirty면 저장 먼저"(D11) 단계는 배치에 없다 — 열람뷰와 같은 이유로, 저장본이 곧 대상이다.

### 3-2. 문항×종류당 HTTP 2회, 최장 수백 초 → 순차가 강제 사항이다

61b는 실측(1차 두 패스 + 2차 = 228초) 때문에 요청을 `phase:'first'` → `phase:'judge'` 두 번으로
쪼갰다(각 단계 `maxDuration` 300초). 즉 한 문항의 문제+풀이 검증은 HTTP 최대 4회·수 분이다.
n문항 배치는 **수십 분~시간 단위**가 정상이며, 병렬화하면 Vercel 동시 실행·API rate limit·비용
폭주를 한꺼번에 부른다. **1문항×1종류씩 직렬**로만 돈다.

### 3-3. 리포트에는 세션이 필요하다 — 배치가 스스로 확보해야 한다

리포트는 `addComment({ discussionSessionId })`로 저장된다. 칩 경로에서는 사용자가 고른 활성
세션이 있지만, 배치는 문항을 열지 않으므로 세션을 스스로 마련해야 한다.
`createNormalSession(problemId, name, uid)`(`lib/discussion-sessions.ts:67`) ·
`listSessions`(`:105`) · `DiscussionSession.type:'normal'`(`types/problem.ts:186`)이 재료다. → D61d-6.

⚠ **댓글 세션(`type:'comment'`)에 넣으면 안 된다.** `resolveCommentStream`이 세션으로
`commentStream`을 정하고(`lib/comments.ts:80-91`), 공개 문항의 `commentStream=true` 메시지는
**비로그인 열람자까지 읽는다**(`firestore.rules:234-236`). `normal` 세션이어야 차단된다.

### 3-4. 사전 차단 사유는 넷이다 (전부 AI 호출 전에 판정 가능)

| 사유 | 근거 | 판정 재료 |
|---|---|---|
| 15,000자 초과 | 클라 `VERIFY_CHAR_CAP`(`CommentPanel.tsx:1315`) · 서버 `MAX_INPUT_CHARS` 400(`app/api/verify/route.ts:49`) | `verifyBlocksOf` 글자 합 |
| 풀이 없음 | 서버 400 `풀이 내용이 비어 있습니다`(`route.ts:171-173`) | solution 탭 텍스트 블록 0 |
| 문제 비어 있음 | 서버 400 `문제 내용이 비어 있습니다`(`route.ts:170`) | question 탭 텍스트 블록 0 |
| **탭 로드 실패** | `computeVerifyHashes` → `collectCurrentContent`가 `tabLoadErrors`가 있으면 `VersionLoadError`를 던진다(`lib/version/adapter.ts:27-31`) | `getProblemWithBlocks`가 반환하는 `tabLoadErrors` |

⚠ **넷째가 특히 위험하다.** 그 예외는 `addComment` **뒤**에서 터진다 → AI 비용을 다 쓰고
리포트는 저장됐는데 `verification`은 미갱신인 상태로 끝난다. 반드시 프리플라이트에서 거른다.

이 넷은 전부 "건너뜀"으로 요약에만 기록한다. **`skip` verdict로 적지 않는다** —
`skip`은 AI가 판단한 검증 불가(그림 의존) 전용 어휘다(61b D14′).

### 3-5. 오너 게이트 — 규칙이 강제한다

AI 댓글 create는 오너만 허용한다(`firestore.rules:262-268`: `authorType=='ai'` &&
`authorUid.matches('^ai:.*')` && `isOwnerCmt()`). 기준은 ProblemView의 `isVerifyOwner`와 동일하게
**`problem.authorUid === user.uid`** (authorUid 없는 레거시 문항은 오너로 치지 않는다).
버튼 노출과 개별 항목 활성화 **양쪽**에 이 게이트를 건다.

또한 `/api/verify`에는 **허용목록**이 있다 — `VERIFY_ALLOWED_UIDS`(없으면 `AUDITION_ALLOWED_UIDS`
폴백), 비면 전원 거부(`lib/apiAuth.ts:46-48`). 미등록 사용자는 **전건 403**이므로 배치는
첫 401/403에서 전체를 중단한다(§3-11).

### 3-6. "폴더 직속만"은 기존 필터와 자연 일치 — 재귀 수집기를 만들지 말 것

`folderProblems`는 이미 `p.folder_id === folder.id`만 남긴다(`FolderView.tsx:182-190`) —
하위폴더 문항은 `problems` prop에 있어도 걸러진다. 하위 폴더는 `getChildren(folders, folder.id)`로
**표시만** 된다. E61d-1은 이 필터를 그대로 쓰면 끝이다.

미지정 폴더는 같은 필터의 `!p.folder_id` 분기이며 역시 내 소유 문항이다 → D3에 따라 대상에 포함.

### 3-7. "검증 필요" 판정은 목록 데이터만으로 된다 — 블록 로드 0

기본 체크 규칙(D1)의 재료는 `Problem.verification`의 요약(verdict·stale)뿐이고, 이것은 목록
문서에 이미 있다(`listProblems`가 `...data` 스프레드 — `lib/firestore.ts:158-168`). `VerifyBadge`와
같은 소스다. 종류(kind)별 판정:

```
검증 필요 = !verification[kind] || verification[kind].stale
```

⚠ `check`·`fail`은 **기본 해제**다(D1). 다시 체크하면 재검증되므로 "전부 재검증" 시나리오는 그대로 산다.
⚠ `stale`은 EditorView 저장 경로에서만 계산된다(`EditorView.tsx:2631-2656`) — 배지와 같은 신호를
쓰므로 화면과 다이얼로그가 어긋나지 않는다.

### 3-8. `setVerification`은 `updated_at`을 건드리지 않는다 — 배치가 정렬을 흔들지 않는다

61b가 이미 `updateProblem`(무조건 `updated_at` 갱신) 대신 전용 `setVerification`
(`lib/firestore.ts:72`)을 쓴다. 배치 n건을 돌려도 목록 순서는 그대로다. 단 배지 갱신을 위해
목록 리프레시는 필요하다 → `onUpdated` 콜백(FolderView prop에 이미 존재)을 **배치 종료 시 1회** 호출.
문항별 호출은 진행 중 목록 전체 리로드를 n번 유발하므로 하지 않는다 — 진행 상황은 다이얼로그가 자체 표시.

### 3-9. idToken은 문항마다 새로 받는다

Firebase ID 토큰 수명은 1시간인데 배치는 그보다 길 수 있다. `runVerifyFlow`는 토큰 문자열을
받으므로, 루프가 **문항마다 `user.getIdToken()`을 다시 호출**한다(SDK가 캐시·자동 갱신 → 비용 없음).
배치 시작 시 한 번 받아 돌려쓰면 1시간 뒤부터 전부 401이다.

### 3-10. 진행 표시는 자체 UI다 — `PendingAIBubble` 재사용 불가

61b의 진행 표시는 CommentPanel의 세션 좌표에 붙은 합성 항목이다. 배치는 폴더 화면에서 도므로
다이얼로그가 자체적으로 그린다. 재시도 어휘도 다르다 — 개별 재시도 버튼 대신
"실패 항목만 다시 실행"(요약 화면)이 배치의 재시도다.

### 3-11. 실패는 두 종류다 — 건너뛸 실패와 멈춰야 할 실패

E61d-3("건너뛰고 계속")은 문항 고유 실패(파싱·모델 오류·타임아웃)에 대한 규칙이다.
**환경 실패는 전건 실패**이므로 계속 돌면 n배로 헛돈다:

- HTTP **401/403** (토큰 만료·허용목록 미등록) → 즉시 전체 중단
- **연속 3건 실패** → 전체 중단 (모델·네트워크 장애로 간주)

이 판정을 위해 `runVerifyFlow`가 던지는 Error에 `status`를 실어야 한다(D5 ①).
동작·결과물은 그대로이고 기존 두 호출부는 `.message`만 읽으므로 영향 0이다.

### 3-12. 다이얼로그는 전체 뷰포트 모달이어야 한다 (Q2 해소)

FolderView는 AppShell의 `view.type === 'folder'`일 때만 렌더된다(`AppShell.tsx:710-718`) →
홈·편집·문항으로 이동하면 **언마운트되고 배치가 끊긴다**(사이드바에서 다른 폴더를 고르는 것은
prop 변경일 뿐이라 안전하다). 처방은 SheetImportModal 관례의 **`position:fixed; inset:0; zIndex:9000`**
전체 뷰포트 오버레이 — 사이드바 클릭 자체가 막힌다. 실측 확인:
`main`은 `position:relative`(z-index 없음)라 스태킹 컨텍스트를 만들지 않고,
FolderView 조상 체인에 `transform`이 없어 `overflow:hidden`이 fixed를 자르지 않는다.
브라우저 이탈은 `beforeunload`로 막는다(EditorView 선례 `:2851`).

### 3-13. 비용 표시는 2차(Claude) 기준이다

`VERIFY_GEMINI_COST_IN/OUT`의 기본값이 **0**이다(`app/api/verify/route.ts:150-151`) →
`runVerifyFlow`가 돌려주는 `usage.costUsd`는 사실상 Claude 판정분만이다.
라벨을 "누적 비용(2차 Claude 기준)"으로 적어 과소 표시를 숨기지 않는다.

---

## 4. UX 설계 — 다이얼로그 3상태

**진입**: FolderView 제목행(행 1, `minHeight 57`)의 정렬·보기 컨트롤 옆 [일괄 검증] 텍스트 버튼.
노출 조건은 §3-5 + D3. 직속 문항 0건이면 비활성.

**상태 1 — 선택**: 문항 표. 행 = 직속 문항(현재 정렬 순서 그대로), 열 = [문제 검증 ☐] [풀이 검증 ☐] + 현재 배지 상태.

- 기본 체크: `!verification[kind] || stale` (D1). 이미 판정이 있고 stale이 아닌 종류는 해제 상태로 보이되 **체크 가능**하다(전부 재검증 시나리오 보존).
- 오너 게이트를 통과하지 못하는 행(authorUid 불일치)은 체크 불가로 비활성 + 사유 표기.
- 하단: `n문항 · 검증 m회 · 종류당 1~4분 · 예상 x~y분 · API 비용 발생` + [전체 선택/해제] + [실행].
  30건 초과면 예상 시간 문구를 강조한다(하드캡 없음 — D8).
- 별도 실행 확인 팝오버는 두지 않는다. 이 화면 자체가 명시적 관문이다(61b E-5의 "실수 클릭 방지" 취지 충족).

**상태 2 — 진행**: 두 단계다.

1. **프리플라이트**(D2): 대상 문항의 `getProblemWithBlocks`를 동시 5건 상한으로 읽어
   §3-4의 네 사유를 확정한다. AI 호출 0. 끝나면 "대상 k회 · 건너뜀 f회"를 확정 표시하고 곧바로 2로 넘어간다.
2. **AI 루프**: 표를 유지한 채 각 행이 대기 → 진행 중(스피너·현재 종류) → 완료(verdict 배지) /
   실패(사유) / 건너뜀으로 갱신. 상단에 `k / m 완료 · 누적 비용(2차 Claude 기준) $x.xx · 경과 mm:ss`.
   [중단] 버튼(D61d-5).

**상태 3 — 요약**: 집계(✓ a · ⚠ b · ✕ c · skip d · 실패 e · 건너뜀 f) + 실패·건너뜀 목록(사유 포함)
+ 총 실측 비용·소요 시간 + [실패 항목만 다시 실행] + [닫기]. 닫으면 `onUpdated()` 1회로 목록 배지 갱신.

---

## 5. 구현 항목

### 5-1. `lib/verify/batchPlan.ts` (신규 · **import 0 순수 모듈**)

> ⚠ 이 폴더 규약: import 문 금지, 타입도 로컬 정의(`parse.ts` 전례). `npm run test:batch`가 단독 컴파일한다.

- `defaultChecked(state, kind): boolean` — D1 규칙
- `preflightSkip(input): SkipReason | null` — §3-4 네 사유. `SkipReason = 'too_long' | 'no_solution' | 'empty_question' | 'tab_load_error' | 'missing'`
- `charsOf(blocks, kind)` — 클라·서버와 같은 셈법(§3-4)
- `isFatalStatus(status): boolean` — 401·403
- `shouldAbort(consecutiveFailures): boolean` — ≥3
- `summarize(rows): BatchSummary` — 요약 집계
- `estimateMinutes(runCount): [min, max]` — 종류당 1~4분

### 5-2. `lib/batchVerify.ts` (신규 · 오케스트레이터)

```
runBatchVerify({ items, uid, getIdToken, buildMarkdown, callbacks, stopRef })
  ① 프리플라이트: 동시 5건 상한으로 getProblemWithBlocks → batchPlan.preflightSkip → onPlan()
  ② 직렬 루프 { 문항 { getIdToken → 세션 확보 → kind 루프 { stopRef 확인 → runVerifyFlow → onProgress } } }
  ③ 실패 분류: isFatalStatus || shouldAbort → 전체 중단, 그 외는 기록하고 계속
```

- `ensureBatchSession(problemId, uid)`: `listSessions` → `type==='normal' && name==='일괄 검증'` 재사용, 없으면 `createNormalSession` (D6)
- ⚠ **`lib/verify/`에 두지 말 것** — firestore·verifyFlow를 import한다(`verifyFlow.ts` 헤더 경고와 동일 이유)

### 5-3. `components/problem/BatchVerifyDialog.tsx` (신규)

3상태 다이얼로그. 전체 뷰포트 오버레이(§3-12). `user`는 prop(D4). 실행 중 `beforeunload` 등록.
verdict 색·라벨은 `VerifyBadge`에서 export한 `VERIFY_VERDICT_META`를 재사용(사본 4개째 방지).

### 5-4. 기존 파일 수정 (전부 additive)

| 파일 | 변경 |
|---|---|
| `components/problem/FolderView.tsx` | `user` prop 수용 · [일괄 검증] 버튼 · 다이얼로그 마운트 · 노출 게이트 |
| `components/layout/AppShell.tsx` | FolderView 2곳에 `user={user}` 전달 |
| `lib/verifyFlow.ts` | ① 던지는 Error에 `status` 부착 ② `verifyCharCountOf(blocksByTab, kind)` export (D5) |
| `components/editor/EditorView.tsx` · `components/problem/ProblemView.tsx` | 각자의 `verifyCharCount` 사본을 `verifyCharCountOf` 호출로 교체 |
| `components/ui/VerifyBadge.tsx` | `META` → `VERIFY_VERDICT_META`로 export |
| `package.json` | `test:batch` 스크립트 |

서버·규칙·타입·마이그레이션: **0**. `runVerifyFlow`의 동작·결과물, `/api/verify`, 프롬프트, 파서: **무변경**.

---

## 6. 결정표

| # | 결정 |
|---|---|
| D61d-1 | **서버 변경 0.** 배치는 클라 루프 — 61b A5의 이행. `/api/verify`·프롬프트·파서 무변경 |
| D61d-2 | 대상 = 폴더 직속만(E61d-1, §3-6). 선택은 문항×종류 체크박스, 기본 체크 = `!verification[kind] ∨ stale`(D1, §3-7) |
| D61d-3 | **완전 직렬** — 1문항×1종류씩. 병렬·프리페치 금지(§3-2). 단 프리플라이트 읽기만 동시 5건 |
| D61d-4 | 문항 고유 실패는 기록하고 계속(E61d-3). 401/403·연속 3건 실패는 **전체 중단**(§3-11). 실패·건너뜀은 `verification` 미갱신(61b D13′ 계승) |
| D61d-5 | 중단 = **진행 중인 종류는 완료·저장까지 마친 뒤** 멈춘다. in-flight abort 금지 — 1차(first) 비용을 이미 썼는데 2차(judge)를 끊으면 D13′에 의해 그 비용이 통째로 버려진다 |
| D61d-6 | 세션 = 각 문항에서 `type:'normal'`이고 이름이 `일괄 검증`인 세션을 재사용, 없으면 생성. 댓글 세션 사용 금지(§3-3) |
| D61d-7 | 요약은 화면만(E61d-4). Firestore 신규 스키마·컬렉션 0 |
| D61d-8 | 실행 중 브라우저 이탈은 `beforeunload`로, 앱 내 이동은 전체 뷰포트 모달로 막는다(§3-12). 이탈해도 **이미 완료된 문항의 리포트·배지는 저장돼 있다** — 문항 단위가 커밋 단위다 |
| D61d-9 | 비용: 사전 표시는 "API 비용 발생" 문구만, 사후는 `runVerifyFlow`의 usage 합산을 **"2차 Claude 기준"** 이라 밝혀 표시(§3-13) |
| D61d-10 | 사전 차단 4종은 AI 호출 전 프리플라이트에서 확정한다(D2, §3-4). `skip` verdict로 기록 금지 |
| D61d-11 | 순수 판정 로직은 `lib/verify/batchPlan.ts`, 부수효과는 `lib/batchVerify.ts`(D7) |

---

## 7. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/verify/batchPlan.ts` + `npm run test:batch` | 기본 체크 규칙(D1)·스킵 4종(§3-4)·치명 상태·연속 실패·집계 테스트 통과 |
| 1 | `lib/verifyFlow.ts` additive 2건 + 두 호출부 사본 제거 + `VERIFY_VERDICT_META` export | 61b 단건 검증 회귀 없음(칩 경로 동작·리포트 동일). `npm run test:verify` 37개 유지 |
| 2 | `lib/batchVerify.ts` + 선택 화면 + FolderView 버튼·게이트 + AppShell `user` 전달 | 기본 체크가 배지 상태와 일치. 비오너·휴지통·공유받음·공유보낸에서 버튼 부재, 미지정에서는 존재 |
| 3 | 프리플라이트·진행·요약 화면 + 중단 + `beforeunload` | 2~3문항 소배치: 스킵 즉시 확정 · 진행 갱신 · 중단이 종류 경계에서 멈춤 · `onUpdated` 1회 |
| 4 | 실패 경로: 15,000자 초과·풀이 없음·탭 로드 실패·401/403 위장 배치 | 건너뜀/중단이 규칙대로, `verification` 오염 0, [실패 항목만 다시 실행] 동작 |
| 5 | 마무리: roadmap·CLAUDE.md Phase 61d 절 | 61b 단건 검증 회귀 확인(칩 경로 무변경) |

**배포 순서**: 61b·61c가 아직 미배포다. 61d는 **61b 배포·프로덕션 실동작 확인 이후**에 얹고,
첫 실전 배치는 2~3문항으로 시작한다 — 단건이 검증되지 않은 상태의 배치는 비용이 n배로 샌다.

---

## 8. 하지 말 것

- 하위폴더 재귀 수집기 금지(E61d-1) — `folderProblems` 필터 재사용(§3-6).
- `updateProblem`으로 verification 쓰지 말 것 — `setVerification`만(§3-8).
- 사전 차단·실패를 `skip` verdict로 기록하지 말 것(§3-4, 61b D14′).
- 리포트를 **댓글 세션**에 넣지 말 것 — 공개 문항에서 비로그인까지 읽는다(§3-3).
- `runVerifyFlow`·`/api/verify`·프롬프트의 **동작** 수정 금지. 허용된 것은 D5의 additive 2건뿐.
- idToken을 배치 시작 시 1회만 받지 말 것(§3-9).
- `PendingAIBubble`·CommentPanel 재사용 시도 금지(§3-10).
- 문항별 `onUpdated` 호출 금지 — 종료 시 1회(§3-8).
- `lib/verify/batchPlan.ts`에 import 문을 두지 말 것(§5-1).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 9. 범위 밖

하위폴더 포함 옵션 · 배치 이력 영속화 · 정기/예약 실행 · 병렬화 · 공유받은 문항 검증 ·
서버 측 배치 큐 · 배치 전용 리포트 형식. **전부 0건.**
신규 파일 3개(`lib/verify/batchPlan.ts` · `lib/batchVerify.ts` · `components/problem/BatchVerifyDialog.tsx`)
+ 기존 6파일 소폭 additive 수정.

---

## 부록 A. v1 → v2 정정 이력

| # | v1 | v2 |
|---|---|---|
| A1 | 스텝0에서 `lib/batchVerify.ts` 단위 테스트 | 불가능(하니스가 단독 컴파일) → 순수 로직 `lib/verify/batchPlan.ts` 분리(D7) |
| A2 | 글자 수 초과는 "실행 중 발견이 맞다" | 설계 선택일 뿐 — 프리플라이트로 AI 호출 0에 전건 확정(D2) |
| A3 | 기본 체크에 `check`·`fail` 포함 | 제외(D1) — 내용 불변이면 같은 리포트가 또 쌓인다 |
| A4 | 미지정 폴더 제외 | 포함(D3) — 내 소유 문항이고 필터가 이미 있다 |
| A5 | "누적 비용 $x.xx" | Gemini 단가 env 기본값 0 → "2차 Claude 기준" 명시(§3-13) |
| A6 | `runVerifyFlow` 수정 전면 금지 | additive 2건 허용(D5) — 없으면 403에서 n건을 헛돈다 |
| A7 | Q4 마커 필드 가능 여부 미확인 | 규칙상 가능(create에 `hasOnly` 없음)이나 `mapDoc` 확장이 딸려옴 → 이름 매칭만(D6) |
| A8 | `VerifyReportCard.tsx:50` | 경로는 `components/comment/VerifyReportCard.tsx:50` |
| **신규** | — | 탭 로드 실패 사전 차단(§3-4 넷째 · `addComment` 뒤에 터지는 예외) |
| **신규** | — | 401/403·연속 3건 실패 시 전체 중단(§3-11) |
| **신규** | — | 리포트를 댓글 세션에 넣으면 공개 노출(§3-3) |
| **신규** | — | 전체 뷰포트 모달로 Q2(언마운트) 해소 · 스태킹/transform 실측(§3-12) |
| **신규** | — | `VERIFY_VERDICT_META` export로 verdict 색 사본 방지(§5-3) |
| **신규** | — | 예상 시간은 종류당 1~4분(61b 실측 최장 228초/문항) |
| **신규** | — | 배포 순서 — 61b 프로덕션 확인 후(§7) |

## 부록 B. v1 교차검토 질문 답

| Q | 답 |
|---|---|
| Q1 | AppShell prop. Sidebar·SheetImportModal이 같은 관례이고, `useAuth`는 마운트마다 `upsertUserProfile` 쓰기를 더 한다 |
| Q2 | FolderView는 `view.type` 변경으로 언마운트된다(사이드바 폴더 전환은 prop 변경이라 안전). 전체 뷰포트 모달 + `beforeunload`로 해소(§3-12) |
| Q3 | v1이 맞다 — kind 경계 중단으로 충분. first만 태우고 끊으면 D13′ 위반(§D61d-5) |
| Q4 | 마커 필드는 규칙 변경 없이 가능하나 타입·`mapDoc` 확장이 따라온다 → 이름 매칭만(D6) |
| Q5 | 캐시 재활용 불가 — `questionBlocksMap`은 카드 모드에서만 채워지고, `getPreviewBlocks`는 "내용 있는 첫 탭"을 돌려줘 풀이 유무를 모른다. 프리플라이트로 해결(D2) |

## 부록 C. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web (2026-08-23) | E61d-1~4 · 사실확정 §3-1~3-10 · D61d-1~9 · 교차검토 질문 5건 |
| **v2** | **CLI (2026-08-23)** | **실측 교차검증 — 정정 8건·보완 7건 · D1~D8 확정 · §3-1~3-13 · D61d-1~11 · 착수 가능** |
