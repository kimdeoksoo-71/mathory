# Phase 61d 구현 계획서 — 폴더 일괄 정밀 검증 (v3 최종)

> 대상: CLI Claude (구현) · 계보: v1(web 2026-08-23) → v2(CLI 실측 교차검증) → **v3(web 재검증·판정·덕수 재결 반영, 2026-08-23)**
> 진실 원천: mathory **origin/main `3a85141`** (61b·61c 구현 완료본, 미배포)
> 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md` B-6 · `docs/phaseSketch/Phase61b 정밀 검증 구현 계획서 v4 실행판.md` A5
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. v3 판정 요약 — v2 교차검증에 대한 재검증 결과

**v2의 코드 인용을 전수 재검증했고, 전부 사실로 확인되어 수용한다.** 확인 목록:
§3-3(`resolveCommentStream` `lib/comments.ts:80-91` · 공개 read `commentStream==true` 규칙) ·
§3-4(서버 400 4종 `route.ts:169-173` · `VersionLoadError` `adapter.ts:27-31` · **그 예외가 `runVerifyFlow`에서
`addComment` 뒤에 터진다는 순서 지적** — verifyFlow 실물 대조로 확인, v2의 최고 수확) ·
§3-5(rules AI create 오너 전용 · `apiAuth.ts` fail-closed 401/403) · §3-12(AppShell `view.type` 분기
`:710-718` — 사이드바 폴더 전환은 key 없는 같은 자리 재렌더라 prop 변경만 · `SheetImportModal.tsx:78`
`fixed; inset:0; zIndex:9000` · `EditorView.tsx:2851` beforeunload · AppShell 조상에 transform 없음) ·
§3-13(Gemini 단가 env 기본 0, `route.ts:148-149`) · D4(useAuth가 인증 콜백마다 `upsertUserProfile`) ·
D7(테스트 하니스 = `tsc <파일> 단독 컴파일`, package.json 실측) · 부록 B Q5(`getPreviewBlocks`는
"내용 있는 첫 탭" 반환, `firestore.ts:280-297`).

**결정 이력 대조에서 나온 문제 2건은 덕수 재결로 해소됐다.** v2의 D1(기본 체크에서 check·fail 제외)과
§3-11(연속 3건 실패 시 전체 중단)은 기술 지적이 아니라 **덕수가 이미 확정한 E61d-2·E61d-3의 개정**이었다 —
61b v3 교훈("교차검토는 코드만이 아니라 결정 이력과도 해야 한다") 그대로, 계획서가 임의로 바꿀 수 없는 부류다.
v3는 두 건을 그대로 수용하는 대신 **덕수에게 재결을 요청했고, 2026-08-23 두 건 모두 v2안이 승인**됐다.
아래 E61d-5·E61d-6으로 격상해 기록한다. (v2안 자체는 옳았다 — 문제는 내용이 아니라 절차였고, 이제 절차도 완결됐다.)

**v3가 고친 것 1건 + 신규 보강 4건:**

- **C1 (정정)** — "`npm run test:verify` 37개 유지"(v2 스텝 1): 그 스크립트는 `tests/verify.test.mjs`(37개)와
  `tests/aiProviderParams.test.mjs`(8개) **두 파일**을 돌린다. 완료 기준은 "test:verify 전체(45개) 통과"로.
- **V1 (신규 — D2′ 개정)** — **프리플라이트 스냅샷을 AI 루프에서 재사용하지 말 것.** §3-14 참조.
  배치는 수십 분~시간 단위인데 다른 브라우저 탭에서의 편집은 모달이 못 막는다. 프리플라이트 시점(T0) 블록으로
  검증하면, T0~검증 사이에 편집·저장된 문항은 **리포트와 contentHash가 낡은 본을 가리키는데 stale도 안 붙는다**
  (stale 계산은 `handleSave` 경로에서만 도는데, 그 저장이 `setVerification`보다 먼저였으면 다시 돌 계기가 없다).
  → 각 문항 차례에 `getProblemWithBlocks`를 **다시** 읽고 스킵 사유도 재판정한 뒤 그 본으로 검증한다.
  Firestore 읽기 2배는 AI 호출 비용 대비 0이다.
- **V2 (신규)** — 연속 실패 카운터의 정의를 `batchPlan`에 고정: **AI 호출을 실제로 시도한 종류(kind) 단위**로
  세고, 건너뜀(사전 차단)은 카운트에 넣지 않으며, 성공 1건이면 0으로 리셋, [실패 항목만 다시 실행] 시작 시 리셋.
  (정의가 느슨하면 "건너뜀 3연속"이 장애로 오판된다.)
- **V3 (신규)** — `beforeunload`는 **실행 중(프리플라이트·AI 루프)에만** 등록하고 선택·요약 상태에서는 해제한다.
  요약 화면에서 새로고침까지 막으면 안 된다. (EditorView 선례도 dirty 조건부다.)
- **V4 (신규)** — 세션 확보(`listSessions`/`createNormalSession`) 실패와 `addComment` 실패는 **문항 고유
  실패로 분류**해 기록하고 계속 진행한다(연속 실패 카운트에는 포함). AI 호출 전 실패면 비용 0, 호출 후
  저장 실패면 D13′대로 `verification` 미갱신 — 어느 쪽도 전체 중단 사유는 아니다(권한류는 401/403 규칙이 잡는다).

---

## 0-1. 결정 확정 (덕수, 2026-08-23)

| # | 결정 |
|---|---|
| E61d-1 | **하위폴더 문항은 제외.** 선택한 폴더의 직속 문항만 대상 |
| E61d-2 | 대상 선정은 **체크박스 선택 화면**으로 |
| E61d-3 | 문항 고유 실패는 **건너뛰고 계속**, 종료 시 요약 표시 |
| E61d-4 | 결과 요약은 **화면 표시만** — 배치 이력을 Firestore에 저장하지 않는다. 영속 기록은 `Problem.verification` 배지가 담당 |
| **E61d-5** | **(재결)** 기본 체크 = `!verification[kind] ∨ stale`. **check·fail은 기본 해제**(수동 체크는 가능) — 내용 불변 재검증은 같은 리포트를 한 번 더 쌓을 뿐, 그 상태는 사람이 볼 차례다. 내용을 고치면 stale이 되어 자동으로 기본 체크에 복귀한다 |
| **E61d-6** | **(재결)** 401/403은 **즉시 전체 중단**(이후 전건이 반드시 실패), 서로 다른 문항 **연속 3건 실패도 전체 중단**(모델·네트워크 장애 간주). 그 외 실패는 E61d-3대로 계속 |

### v2 교차검증 결정 (D1~D8 — 전부 채택, E61d-5·6은 위로 격상)

| # | 결정 | 근거 |
|---|---|---|
| D2′ | **프리플라이트 일괄 로드**(동시 5건 상한)로 스킵을 조기 확정·표시하되, **검증 자체는 각 문항 차례에 재로드한 본으로**(V1) | 프리플라이트 = 계획 확정용, 실행 시점 로드 = 검증 대상. 다른 탭 동시 편집 창을 없앤다 |
| D3 | 버튼 노출 = **일반 폴더 + 미지정**. 휴지통·공유받음·공유보낸(passthrough·listContext) 제외 | 미지정 문항도 내 소유고 필터가 이미 있다 |
| D4 | `user`는 **AppShell → FolderView prop** | Sidebar·SheetImportModal 관례. `useAuth`는 마운트마다 `upsertUserProfile` 쓰기를 한 번 더 한다 |
| D5 | `lib/verifyFlow.ts`에 **additive 변경 2건 허용** (① 던지는 Error에 HTTP `status` 부착 ② `verifyCharCountOf` 공용 export). 동작·결과물 변경 금지 | ①이 없으면 403에서 n건을 헛돈다(기존 두 호출부는 `.message`만 읽어 영향 0). ②는 사본이 이미 2개다 |
| D6 | 세션 식별 = **이름 `일괄 검증` + `type:'normal'` 매칭만** | 동명 사용자 세션과 충돌해도 무해(리포트가 그 세션에 쌓일 뿐). 마커 필드는 타입·`mapDoc` 확장이 딸려온다 |
| D7 | 순수 판정 로직을 **`lib/verify/batchPlan.ts`(import 0)** 로 분리 + `npm run test:batch` 신설 | 하니스가 tsc 단독 컴파일이라 firestore를 import하는 파일은 못 태운다 |
| D8 | 선택 건수 **하드캡 없음**, 30건 초과 시 예상 시간 경고 문구만 | 중단 버튼이 있다 |

---

## 1. 한 줄 요약

FolderView에 [일괄 검증] 버튼을 달아, 폴더 직속 문항을 체크박스로 고른 뒤
기존 `runVerifyFlow`(61b)를 **문항×종류(문제/풀이) 단위로 순차 호출**하는 클라이언트 루프를 돈다.
**서버·규칙·스키마 변경 0** — 61b A5("배치는 후속 Phase에서 클라 루프로 얹는다")의 이행이다.

## 2. 아키텍처

**신규는 UI(다이얼로그)와 클라 오케스트레이터뿐이다.**

- `/api/verify`는 stateless 단건 그대로 → **라우트 무변경**. 배치의 "상태"는 실행 중인 브라우저 탭 메모리에만 있다.
- 문항 하나의 검증·저장·`verification` 갱신은 61b의 `runVerifyFlow`(`lib/verifyFlow.ts`)를 **그대로** 호출한다.
  배치가 61b와 다른 결과물을 만들면 안 된다 — 단건 검증과 결과물이 비트 단위로 같은 것이 정합성의 기준.
- 결과 열람도 기존 경로 그대로: 개별 리포트는 각 문항의 agent 세션 메시지, 목록 표시는 `VerifyBadge`.

---

## 3. 확정 사실 (origin/main `3a85141` — v2 실측, v3 전 항목 재확인)

### 3-1. `runVerifyFlow`는 이미 "편집창 없이" 돈다 — 선례는 ProblemView

검증 흐름이 `lib/verifyFlow.ts`로 추출되어 EditorView와 **ProblemView(열람뷰)가 공용**한다.
ProblemView는 저장본(`problem.tabBlocks`)만으로 호출한다(`ProblemView.tsx:256`). 배치도 같다 —
`getProblemWithBlocks(problemId)`(`lib/firestore.ts:212`)가 재료 전부(tabs·tabBlocks·tabLoadErrors·
title·answer)를 반환하므로 **문항을 열지 않고** 검증할 수 있다. 편집창의 "dirty면 저장 먼저"(D11)
단계는 배치에 없다 — 저장본이 곧 대상이다.

### 3-2. 문항×종류당 HTTP 2회, 최장 수백 초 → 순차가 강제 사항이다

61b는 실측(1차 두 패스+2차 = 228초) 때문에 요청을 `phase:'first'` → `phase:'judge'`로 쪼갰다
(각 단계 `maxDuration` 300초). 한 문항의 문제+풀이 검증은 HTTP 최대 4회·수 분이다. n문항 배치는
**수십 분~시간 단위**가 정상이며, 병렬화는 Vercel 동시 실행·API rate limit·비용 폭주를 부른다.
**1문항×1종류씩 직렬**로만 돈다.

### 3-3. 리포트에는 세션이 필요하다 — 반드시 `normal` 세션이어야 한다

리포트는 `addComment({ discussionSessionId })`로 저장된다. 배치는 문항을 열지 않으므로 세션을 스스로
마련한다: `createNormalSession`(`lib/discussion-sessions.ts:67`) · `listSessions`(`:105`).

⚠ **댓글 세션(`type:'comment'`)에 넣으면 안 된다.** `resolveCommentStream`이 세션으로 `commentStream`을
정하고(`lib/comments.ts:80-91`), 공개 문항의 `commentStream==true` 메시지는 `commentsVisible()`이면
**비로그인 열람자까지 읽는다**(firestore.rules 댓글 read 절). `normal` 세션이어야 차단된다.

### 3-4. 사전 차단 사유는 넷이다 (전부 AI 호출 전에 판정 가능)

| 사유 | 근거 | 판정 재료 |
|---|---|---|
| 15,000자 초과 | 클라 `VERIFY_CHAR_CAP`(`CommentPanel.tsx:1315`) · 서버 400(`route.ts` `MAX_INPUT_CHARS`) | `verifyBlocksOf` 글자 합 (서버 셈법과 동일: problem은 question만, solution은 question+solution) |
| 풀이 없음 | 서버 400 `풀이 내용이 비어 있습니다`(`route.ts:171-173`) | solution 탭 텍스트 블록 0 |
| 문제 비어 있음 | 서버 400 `문제 내용이 비어 있습니다`(`route.ts:169`) | question 탭 텍스트 블록 0 |
| **탭 로드 실패** | `computeVerifyHashes` → `collectCurrentContent`가 `tabLoadErrors` 존재 시 `VersionLoadError`를 던진다(`lib/version/adapter.ts:27-31`) | `getProblemWithBlocks`의 `tabLoadErrors` |

⚠ **넷째가 특히 위험하다.** 그 예외는 `runVerifyFlow` 안에서 `addComment` **뒤**(해시 계산 시점)에 터진다 —
AI 비용을 다 쓰고 리포트는 저장됐는데 `verification`만 미갱신인 반쪽 상태로 끝난다. 반드시 호출 전에 거른다.

이 넷은 전부 "건너뜀"으로 요약에만 기록한다. **`skip` verdict로 적지 않는다** — `skip`은 AI가 판정한
검증 불가(그림 의존) 전용 어휘다(61b D14′).

### 3-5. 오너 게이트 — 규칙이 강제한다

AI 댓글 create는 오너만(`firestore.rules`: `authorType=='ai' && authorUid.matches('^ai:.*') && isOwnerCmt()`).
기준은 ProblemView `isVerifyOwner`와 동일하게 **`problem.authorUid === user.uid`**(authorUid 없는 레거시
문항은 오너로 치지 않는다). 버튼 노출과 개별 항목 활성화 **양쪽**에 건다.

또한 `/api/verify`에는 허용목록이 있다 — `VERIFY_ALLOWED_UIDS`(폴백 `AUDITION_ALLOWED_UIDS`), 비면 전원
거부(`lib/apiAuth.ts` fail-closed: 토큰 불량 401, 미등록 403). 미등록 사용자는 전건 403 → §3-11.

### 3-6. "폴더 직속만"은 기존 필터와 자연 일치 — 재귀 수집기를 만들지 말 것

`folderProblems`는 이미 `p.folder_id === folder.id`만 남긴다(`FolderView.tsx:182-190`) — 하위폴더 문항은
`problems` prop에 있어도 걸러진다. 하위 폴더는 `getChildren`으로 **표시만** 된다(E61d-1 = 이 필터 재사용).
미지정 폴더는 같은 필터의 `!p.folder_id` 분기이며 역시 내 소유 → D3에 따라 포함.

### 3-7. "검증 필요" 판정은 목록 데이터만으로 된다 — 블록 로드 0

기본 체크(E61d-5)의 재료는 `Problem.verification` 요약(verdict·stale)뿐이고 목록 문서에 이미 있다
(`listProblems`의 `...data` 스프레드). `VerifyBadge`와 같은 소스라 화면과 다이얼로그가 어긋나지 않는다.

```
기본 체크 = !verification[kind] || verification[kind].stale
```

check·fail은 기본 해제(E61d-5)이되 **수동 체크 가능** — "전부 재검증" 시나리오는 [전체 선택]으로 산다.

### 3-8. `setVerification`은 `updated_at`을 건드리지 않는다 — 배치가 정렬을 흔들지 않는다

61b가 `updateProblem` 대신 전용 `setVerification`(`lib/firestore.ts:72`)을 쓴다. 배지 갱신을 위한 목록
리프레시는 `onUpdated`(FolderView prop 기존 존재)를 **배치 종료 시 1회**만 — 문항별 호출은 목록 전체
리로드를 n번 유발한다. 진행 상황은 다이얼로그가 자체 표시.

### 3-9. idToken은 문항마다 새로 받는다

토큰 수명 1시간 < 배치 시간. 루프가 **문항마다 `user.getIdToken()`**(SDK 캐시·자동 갱신, 비용 0).
시작 시 1회만 받으면 1시간 뒤부터 전부 401이다.

### 3-10. 진행 표시는 자체 UI다 — `PendingAIBubble` 재사용 불가

61b의 진행 표시는 CommentPanel의 세션 좌표에 붙은 합성 항목이다. 배치는 폴더 화면에서 돈다 →
다이얼로그 자체 표시. 재시도 어휘도 다르다 — "실패 항목만 다시 실행"(요약 화면)이 배치의 재시도다.

### 3-11. 실패는 두 종류다 — 건너뛸 실패와 멈춰야 할 실패 (E61d-6)

- 문항 고유 실패(파싱·모델 오류·타임아웃·세션/저장 실패[V4]) → 기록하고 계속(E61d-3).
- HTTP **401/403**(토큰·허용목록) → **즉시 전체 중단** — 이후 전건이 반드시 실패한다.
- **서로 다른 문항 연속 3건 실패** → **전체 중단**(모델·네트워크 장애 간주). 카운트 정의는 V2:
  AI 호출을 실제 시도한 종류(kind) 단위, 건너뜀 미포함, 성공 시 리셋, 재실행 시작 시 리셋.

이 판정을 위해 `runVerifyFlow`가 던지는 Error에 `status`를 싣는다(D5 ①).

### 3-12. 다이얼로그는 전체 뷰포트 모달이어야 한다

FolderView는 AppShell `view.type === 'folder'`일 때만 렌더된다(`AppShell.tsx:710-718`) — 홈·편집·문항
이동 시 **언마운트되어 배치가 끊긴다**(사이드바의 다른 폴더 선택은 key 없는 같은 자리라 prop 변경일 뿐 —
안전). 처방은 SheetImportModal 관례(`SheetImportModal.tsx:78`)의 **`position:fixed; inset:0; zIndex:9000`**
전체 뷰포트 오버레이 — 사이드바 클릭 자체가 막힌다. 실측: `main`은 z-index 없는 `position:relative`라
스태킹 컨텍스트를 만들지 않고, 조상 체인에 `transform`이 없어 fixed가 잘리지 않는다.
브라우저 이탈은 `beforeunload`(EditorView 선례 `:2851`)로 — 단 **실행 중에만 등록**(V3).

### 3-13. 비용 표시는 2차(Claude) 기준이다

`VERIFY_GEMINI_COST_IN/OUT` 기본값이 0(`route.ts:148-149`) → `usage.costUsd`는 사실상 Claude 판정분만.
라벨을 **"누적 비용(2차 Claude 기준)"**으로 적어 과소 표시를 숨기지 않는다.

### 3-14. 배치는 길다 — 프리플라이트 스냅샷을 검증에 쓰면 안 된다 (V1)

모달은 같은 탭의 이동만 막는다 — **다른 브라우저 탭·기기에서의 편집·저장은 못 막는다.** 프리플라이트(T0)
블록으로 T2에 검증하면, T0~T2 사이(수십 분일 수 있다)에 저장된 편집(T1)에 대해: 리포트·`contentHash`가
T0 본 기준으로 저장되는데, T1 저장은 그보다 먼저라 `handleSave`의 stale 비교가 다시 돌 계기가 없다 →
**배지는 "최신 ✓"인데 내용은 다른** 상태가 남는다. 단건 검증(61b)의 노출 창은 초 단위라 무시했지만
배치는 아니다. → 각 문항 차례에 `getProblemWithBlocks` **재로드** + `preflightSkip` **재판정** 후 그 본으로
검증한다(D2′). 프리플라이트 로드본은 계획 표시(대상 k회·건너뜀 f회 예고)에만 쓴다.

---

## 4. UX 설계 — 다이얼로그 3상태

**진입**: FolderView 제목행(행 1, `minHeight 57`)의 정렬·보기 컨트롤 옆 [일괄 검증] 텍스트 버튼.
노출 조건 §3-5 + D3. 직속 문항 0건이면 비활성.

**상태 1 — 선택**: 문항 표. 행 = 직속 문항(현재 정렬 순서), 열 = [문제 검증 ☐] [풀이 검증 ☐] + 현재 배지.

- 기본 체크: `!verification[kind] || stale`(E61d-5). 판정 있고 stale 아닌 종류는 해제 상태로 보이되 체크 가능.
- 오너 게이트 불통과 행(authorUid 불일치)은 체크 불가 비활성 + 사유 표기.
- 하단: `n문항 · 검증 m회 · 종류당 1~4분 · 예상 x~y분 · API 비용 발생` + [전체 선택/해제] + [실행].
  30건 초과 시 예상 시간 강조(D8). 별도 확인 팝오버 없음 — 이 화면이 관문(61b E-5 취지 충족).

**상태 2 — 진행**: 두 단계.

1. **프리플라이트**(D2′): 대상 문항 `getProblemWithBlocks`를 동시 5건 상한으로 읽어 §3-4 네 사유를
   조기 판정, "대상 k회 · 건너뜀 f회" 표시 후 곧바로 2로. AI 호출 0.
2. **AI 루프**: 각 행이 대기 → 진행 중(스피너·현재 종류) → 완료(verdict 배지) / 실패(사유) / 건너뜀으로
   갱신. **각 문항 차례에 재로드 + 스킵 재판정 후 검증**(V1). 상단
   `k / m 완료 · 누적 비용(2차 Claude 기준) $x.xx · 경과 mm:ss` + [중단](D61d-5).

**상태 3 — 요약**: 집계(✓ a · ⚠ b · ✕ c · skip d · 실패 e · 건너뜀 f) + 실패·건너뜀 목록(사유) +
총 실측 비용·소요 시간 + [실패 항목만 다시 실행] + [닫기]. 닫으면 `onUpdated()` 1회.

---

## 5. 구현 항목

### 5-1. `lib/verify/batchPlan.ts` (신규 · **import 0 순수 모듈**)

> ⚠ 폴더 규약: import 문 금지, 타입 로컬 정의(`parse.ts` 전례). `npm run test:batch`가 단독 컴파일.

- `defaultChecked(state, kind): boolean` — E61d-5 규칙
- `preflightSkip(input): SkipReason | null` — §3-4 네 사유. `SkipReason = 'too_long' | 'no_solution' | 'empty_question' | 'tab_load_error' | 'missing'`
- `charsOf(blocks, kind)` — 클라·서버 동일 셈법(§3-4)
- `isFatalStatus(status): boolean` — 401·403
- `nextFailureCount(prev, event): number` — V2 규칙(시도 실패 +1 · 성공 0 리셋 · 건너뜀 유지)과 `shouldAbort(count) = count >= 3`
- `summarize(rows): BatchSummary` — 요약 집계
- `estimateMinutes(runCount): [min, max]` — 종류당 1~4분

### 5-2. `lib/batchVerify.ts` (신규 · 오케스트레이터)

```
runBatchVerify({ items, uid, getIdToken, buildMarkdown, callbacks, stopRef })
  ① 프리플라이트: 동시 5건 상한 getProblemWithBlocks → preflightSkip → onPlan()   // 표시용
  ② 직렬 루프 { 문항 { stopRef 확인 → getIdToken → **재로드 + preflightSkip 재판정(V1)**
       → 세션 확보 → kind 루프 { stopRef 확인 → runVerifyFlow → onProgress } } }
  ③ 실패 분류: isFatalStatus(err.status) → 전체 중단 · shouldAbort(연속 카운트) → 전체 중단
       · 그 외(세션·저장 실패 포함[V4]) → 기록하고 계속
```

- `ensureBatchSession(problemId, uid)`: `listSessions` → `type==='normal' && name==='일괄 검증'` 재사용,
  없으면 `createNormalSession`(D6)
- ⚠ **`lib/verify/`에 두지 말 것** — firestore·verifyFlow를 import한다(`verifyFlow.ts` 헤더 경고와 동일 이유)

### 5-3. `components/problem/BatchVerifyDialog.tsx` (신규)

3상태 다이얼로그. 전체 뷰포트 오버레이(§3-12). `user`는 prop(D4). `beforeunload`는 실행 중에만(V3).
verdict 색·라벨은 `VerifyBadge`에서 export한 `VERIFY_VERDICT_META` 재사용(사본 4개째 방지).

### 5-4. 기존 파일 수정 (전부 additive)

| 파일 | 변경 |
|---|---|
| `components/problem/FolderView.tsx` | `user` prop 수용 · [일괄 검증] 버튼 · 다이얼로그 마운트 · 노출 게이트 |
| `components/layout/AppShell.tsx` | FolderView 2곳(`:711`·`:757`)에 `user={user}` 전달 |
| `lib/verifyFlow.ts` | ① 던지는 Error에 `status` 부착 ② `verifyCharCountOf(blocksByTab, kind)` export (D5) |
| `components/editor/EditorView.tsx` · `components/problem/ProblemView.tsx` | 각자의 `verifyCharCount` 사본을 `verifyCharCountOf` 호출로 교체 |
| `components/ui/VerifyBadge.tsx` | `META` → `VERIFY_VERDICT_META`로 export |
| `package.json` | `test:batch` 스크립트 |

서버·규칙·타입·마이그레이션: **0**. `runVerifyFlow` 동작·결과물, `/api/verify`, 프롬프트, 파서: **무변경**.

---

## 6. 결정표

| # | 결정 |
|---|---|
| D61d-1 | **서버 변경 0.** 배치는 클라 루프 — 61b A5의 이행 |
| D61d-2 | 대상 = 폴더 직속만(E61d-1, §3-6). 문항×종류 체크박스, 기본 체크 = `!verification[kind] ∨ stale`(E61d-5) |
| D61d-3 | **완전 직렬** — 1문항×1종류씩. 병렬·프리페치 금지(§3-2). 단 프리플라이트 읽기만 동시 5건 |
| D61d-4 | 문항 고유 실패는 기록하고 계속(E61d-3). 401/403 즉시·연속 3건 실패 시 **전체 중단**(E61d-6, §3-11, 카운트 정의 V2). 실패·건너뜀은 `verification` 미갱신(61b D13′ 계승) |
| D61d-5 | 중단 = **진행 중인 종류는 완료·저장까지 마친 뒤** 멈춘다. in-flight abort 금지 — first 비용을 쓰고 judge를 끊으면 D13′에 의해 통째로 버려진다 |
| D61d-6 | 세션 = `type:'normal' && name==='일괄 검증'` 재사용, 없으면 생성. **댓글 세션 사용 금지**(§3-3) |
| D61d-7 | 요약은 화면만(E61d-4). Firestore 신규 스키마·컬렉션 0 |
| D61d-8 | 브라우저 이탈은 `beforeunload`(실행 중에만 — V3), 앱 내 이동은 전체 뷰포트 모달로 차단(§3-12). 이탈해도 완료된 문항의 리포트·배지는 저장돼 있다 — **문항×종류가 커밋 단위**, 배치 원자성은 없음(정상) |
| D61d-9 | 비용: 사전은 "API 비용 발생" 문구, 사후는 usage 합산을 **"2차 Claude 기준"** 명시(§3-13) |
| D61d-10 | 사전 차단 4종(§3-4)은 AI 호출 전에 확정. `skip` verdict 기록 금지 |
| D61d-11 | 순수 판정 = `lib/verify/batchPlan.ts`, 부수효과 = `lib/batchVerify.ts`(D7) |
| **D61d-12** | **검증 대상은 실행 시점 재로드본이다**(V1, §3-14). 프리플라이트 로드본은 계획 표시 전용. 재판정에서 새로 걸리면 건너뜀 처리 |

---

## 7. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/verify/batchPlan.ts` + `npm run test:batch` | 기본 체크(E61d-5)·스킵 4종(§3-4)·치명 상태·연속 카운터(V2)·집계 테스트 통과 |
| 1 | `lib/verifyFlow.ts` additive 2건 + 두 호출부 사본 제거 + `VERIFY_VERDICT_META` export | 61b 단건 검증 회귀 없음(칩 경로 동작·리포트 동일). `npm run test:verify` 전체(45개) 통과 [C1] |
| 2 | `lib/batchVerify.ts` + 선택 화면 + FolderView 버튼·게이트 + AppShell `user` 전달 | 기본 체크가 배지 상태와 일치. 비오너·휴지통·공유받음·공유보낸에서 버튼 부재, 미지정에서 존재 |
| 3 | 프리플라이트·진행·요약 + 중단 + `beforeunload`(실행 중만) | 2~3문항 소배치: 스킵 조기 표시 · 진행 갱신 · 중단이 종류 경계에서 멈춤 · `onUpdated` 1회. **동시 편집 시나리오**: 배치 중 다른 탭에서 한 문항 편집·저장 → 그 문항은 편집 후 본으로 검증됨(V1) 확인 |
| 4 | 실패 경로: 15,000자 초과·풀이 없음·탭 로드 실패·401/403 위장·연속 3건 | 건너뜀/중단이 규칙대로, `verification` 오염 0, [실패 항목만 다시 실행] 동작(카운터 리셋 포함) |
| 5 | 마무리: roadmap·CLAUDE.md Phase 61d 절 | 61b 단건 검증 회귀 재확인 |

**배포 순서**: 61b·61c가 아직 미배포다. 61d는 **61b 배포·프로덕션 실동작 확인 이후**에 얹고,
첫 실전 배치는 2~3문항으로 시작한다 — 단건이 검증되지 않은 상태의 배치는 비용이 n배로 샌다.

---

## 8. 하지 말 것

- 하위폴더 재귀 수집기 금지(E61d-1) — `folderProblems` 필터 재사용(§3-6).
- **프리플라이트 스냅샷으로 검증하지 말 것**(D61d-12) — 실행 시점 재로드본만.
- `updateProblem`으로 verification 쓰지 말 것 — `setVerification`만(§3-8).
- 사전 차단·실패를 `skip` verdict로 기록하지 말 것(§3-4, 61b D14′).
- 리포트를 **댓글 세션**에 넣지 말 것 — 공개 문항에서 비로그인까지 읽는다(§3-3).
- `runVerifyFlow`·`/api/verify`·프롬프트의 **동작** 수정 금지. 허용된 것은 D5의 additive 2건뿐.
- idToken을 배치 시작 시 1회만 받지 말 것(§3-9).
- `PendingAIBubble`·CommentPanel 재사용 시도 금지(§3-10).
- 문항별 `onUpdated` 호출 금지 — 종료 시 1회(§3-8).
- `lib/verify/batchPlan.ts`에 import 문 금지(§5-1) · `lib/batchVerify.ts`를 `lib/verify/`에 두지 말 것(§5-2).
- `beforeunload`를 상시 등록하지 말 것 — 실행 중에만(V3).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 9. 범위 밖

하위폴더 포함 옵션 · 배치 이력 영속화 · 정기/예약 실행 · 병렬화 · 공유받은 문항 검증 · 서버 측 배치 큐 ·
배치 전용 리포트 형식. **전부 0건.**
신규 파일 3개(`lib/verify/batchPlan.ts` · `lib/batchVerify.ts` · `components/problem/BatchVerifyDialog.tsx`)
+ 기존 6파일 소폭 additive 수정.

---

## 부록 A. v2 → v3 판정 이력

| # | v2 | v3 판정 |
|---|---|---|
| D1(기본 체크 check/fail 제외) | CLI가 개정 제안 | **덕수 재결 승인 → E61d-5.** 단 이는 E61d-2의 개정이므로 재결 없이는 수용 불가였다 — 61b v3 교훈(결정 이력 대조) 재확인 |
| §3-11 연속 3건 중단 | CLI가 신설 | **덕수 재결 승인 → E61d-6** (같은 사유 — E61d-3에서 명시적으로 고르지 않았던 옵션의 부활이었다). 카운터 정의는 V2로 고정 |
| D2 프리플라이트 일괄 로드 | 로드본 재사용 함의 | **D2′로 개정** — 프리플라이트는 표시용, 검증은 실행 시점 재로드본(V1, §3-14). 스냅샷 검증은 "배지 최신·내용 상이"를 만든다 |
| 코드 인용 전체 | §3-3~3-13 · D4·D7 · 부록 B | **전수 재검증 — 전부 사실**(§0 목록). 유일한 수치 정정: test:verify는 두 파일 45개(C1) |
| 신규 보강 | — | V2(연속 카운터 정의) · V3(beforeunload 실행 중만) · V4(세션·저장 실패는 문항 실패로 계속) |

## 부록 B. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web (2026-08-23) | E61d-1~4 · 사실표 §3-1~3-10 · D61d-1~9 · 교차검토 질문 5건 |
| v2 | CLI (2026-08-23) | 실측 교차검증 — 정정 8건·보완 7건(탭 로드 실패 사전 차단·댓글 세션 노출·전체 뷰포트 모달 등) · D1~D8 |
| **v3** | **web (2026-08-23)** | **v2 전 인용 재검증(전부 사실) · 덕수 재결 2건(E61d-5·6) · D2′/D61d-12 개정(실행 시점 재로드) · C1 정정 · V2~V4 보강 · 착수 가능** |

교훈(61a·61b 계승): 이번에도 v2의 코드 지적은 전건 사실이었다 — 특히 "탭 로드 실패 예외가 `addComment`
뒤에서 터진다"(§3-4)는 v1이 못 본 반쪽 상태 버그를 사전에 막았다. 그리고 이번에도 남은 쟁점은 코드가
아니라 **결정 이력**이었다(E61d-2·3의 개정 2건) — 다만 61b 때와 달리 v2안의 내용 자체는 옳았고, 필요한
것은 원복이 아니라 재결이었다. 교차검토가 상위 결정과 충돌할 때의 처방은 "코드가 옳으니 채택"도
"결정이 먼저니 원복"도 아니고, **결정권자에게 되돌려 묻는 것**이다.

*v3 — 착수 가능. 덕수 준비물 없음(신규 env·비밀 0). 배포는 61b 프로덕션 확인 후.*
