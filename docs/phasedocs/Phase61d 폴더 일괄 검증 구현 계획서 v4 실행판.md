# Phase 61d 구현 계획서 — 폴더 일괄 정밀 검증 (v4 실행판)

> 계보: v1(web) → v2(CLI 실측 교차검증) → v3(web 재검증·덕수 재결) → **v4 CLI 실행판 (2026-08-23)**
> 진실 원천: mathory **origin/main `3a85141`** (61b·61c 구현 완료본, 미배포)
> 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md` B-6 · `docs/phaseSketch/Phase61b 정밀 검증 구현 계획서 v4 실행판.md` **A5**
> **이 문서가 착수 기준이다.** v1~v3은 재론하지 않는다 — 결론만 §0·§6에 결정표로 싣는다.
> 착수 시 CLAUDE.md 규칙 1에 따라 대상 파일을 반드시 다시 읽을 것.

---

## 0. v4에서 확정된 것

v3의 코드 인용은 전건 재확인했다. **수치 정정 2건**과 **실행 세부 7건(W1~W7)** 만 조정한다.

| # | 조정 | 내용 |
|---|---|---|
| **W1** | `batchPlan`은 **글자 수 계산을 소유하지 않는다** | v3 §5-1의 `charsOf(blocks, kind)`는 모순이다 — 그 파일은 import 0이라 `verifyBlocksOf`를 못 쓰고, 직접 구현하면 **서버 셈법의 3번째 사본**이 된다. 유일 구현은 `verifyCharCountOf`(verifyFlow, D5②)이고 `preflightSkip`은 **계산된 수치를 주입받는다** |
| **W2** | 프리플라이트 동시 실행 = **4건** | v3의 5는 근거 없는 숫자다. `SheetImportModal`의 `SAVE_CONCURRENCY = 4`(`:70`) 전례에 맞춘다 |
| **W3** | 라인 앵커 정정 | 서버 400 = `route.ts:170`(문제 비어 있음)·`:172`(풀이 비어 있음)·`:178`(15,000자) / Gemini 단가 env = `:148-149` |
| **W4** | 세션은 **실제로 돌 kind가 1개 이상일 때만** 확보 | 전건 스킵 문항에 빈 `일괄 검증` 세션이 생기면 안 된다(세션 목록 오염) |
| **W5** | 실행 중에는 **[닫기]를 감추고 [중단]만** 노출 | 닫기 confirm과 중단 확인이 두 겹으로 겹치는 것을 없앤다. `onUpdated()`는 **1건이라도 성공했을 때만** 닫을 때 1회 |
| **W6** | `empty_question`은 **두 종류 모두** 막는다 | `kind:'solution'`에도 `problemBlocks`가 실려 가고 서버는 그것이 비면 400을 낸다(`route.ts:170`) — 풀이 검증도 못 돈다 |
| **W7** | `SkipReason`에 `not_owner` 추가 + **`skipLabel`을 `batchPlan`이 소유** | 실행 시점 방어(선택 후 상태가 바뀐 경우)와, 사유 한국어 라벨의 UI 사본 방지 |

**C1(v3) 확정**: `npm run test:verify`는 `tests/verify.test.mjs`(37) + `tests/aiProviderParams.test.mjs`(8) = **45개**를 돌린다(실측).

---

## 0-1. 결정 확정 (덕수)

| # | 결정 |
|---|---|
| E61d-1 | **하위폴더 문항 제외.** 선택한 폴더의 직속 문항만 대상 |
| E61d-2 | 대상 선정은 **체크박스 선택 화면**으로 |
| E61d-3 | 문항 고유 실패는 **건너뛰고 계속**, 종료 시 요약 표시 |
| E61d-4 | 결과 요약은 **화면 표시만** — 배치 이력을 Firestore에 저장하지 않는다. 영속 기록은 `Problem.verification` 배지가 담당 |
| E61d-5 | 기본 체크 = `!verification[kind] ∨ stale`. **check·fail은 기본 해제**(수동 체크는 가능) — 내용 불변 재검증은 같은 리포트를 한 번 더 쌓을 뿐이고, 그 상태는 사람이 볼 차례다. 내용을 고치면 stale이 되어 자동 복귀한다 |
| E61d-6 | **401/403은 즉시 전체 중단**(이후 전건이 반드시 실패), **서로 다른 문항 연속 3건 실패도 전체 중단**(모델·네트워크 장애 간주). 그 외 실패는 E61d-3대로 계속 |

## 0-2. 교차검증 결정 (D1~D8)

| # | 결정 | 근거 |
|---|---|---|
| D2′ | **프리플라이트 일괄 로드**(동시 4건, W2)로 스킵을 조기 확정·표시하되, **검증 자체는 각 문항 차례에 재로드한 본**으로(V1·§3-14) | 프리플라이트 = 계획 표시용, 실행 시점 로드 = 검증 대상 |
| D3 | 버튼 노출 = **일반 폴더 + 미지정**. 휴지통·공유받음·공유보낸(passthrough·listContext) 제외 | 미지정 문항도 내 소유고 필터가 이미 있다 |
| D4 | `user`는 **AppShell → FolderView prop** | Sidebar·SheetImportModal 관례. `useAuth`는 마운트마다 `upsertUserProfile` 쓰기를 한 번 더 한다 |
| D5 | `lib/verifyFlow.ts`에 **additive 2건**: ① 던지는 Error에 HTTP `status` 부착 ② `verifyCharCountOf` export. 동작·결과물 변경 금지 | ①이 없으면 403에서 n건을 헛돈다(기존 두 호출부는 `.message`만 읽어 영향 0). ②는 사본이 이미 2개다 |
| D6 | 세션 = `type:'normal' && name==='일괄 검증'` 매칭만 | 동명 사용자 세션과 충돌해도 무해. 마커 필드는 타입·`mapDoc` 확장을 부른다 |
| D7 | 순수 판정 로직 = **`lib/verify/batchPlan.ts`(import 0)** + `npm run test:batch` | 하니스가 `tsc <파일> 단독 컴파일`이라 firestore를 import하는 파일은 못 태운다 |
| D8 | 선택 건수 **하드캡 없음**, 30건 초과 시 예상 시간 경고 문구만 | 중단 버튼이 있다 |

---

## 1. 한 줄 요약

FolderView에 [일괄 검증] 버튼을 달아, 폴더 직속 문항을 체크박스로 고른 뒤 기존 `runVerifyFlow`(61b)를
**문항×종류(문제/풀이) 단위로 순차 호출**하는 클라이언트 루프를 돈다. **서버·규칙·스키마 변경 0** —
61b A5("배치는 나중 Phase에서 클라 루프로 얹는다")의 이행이다.

## 2. 아키텍처

- `/api/verify`는 stateless 단건 그대로 → **라우트 무변경**. 배치의 "상태"는 실행 중인 브라우저 탭 메모리에만 있다.
- 문항 하나의 검증·저장·`verification` 갱신은 61b의 `runVerifyFlow`를 **그대로** 호출한다.
  **단건 검증과 결과물이 비트 단위로 같은 것이 적합성의 기준이다.**
- 결과 이동도 기존 경로: 개별 리포트는 각 문항의 agent 세션 메시지, 목록 표시는 `VerifyBadge`.

---

## 3. 확정 사실 (origin/main `3a85141` 실측)

### 3-1. `runVerifyFlow`는 이미 "편집창 없이" 돈다 — 선례는 ProblemView
검증 흐름이 `lib/verifyFlow.ts`로 추출돼 EditorView와 **ProblemView가 공용**한다. ProblemView는
저장본만으로 호출한다(`ProblemView.tsx:256`). `getProblemWithBlocks`(`lib/firestore.ts:212`)가 재료 전부
(tabs·tabBlocks·tabLoadErrors·title·answer)를 주므로 **문항을 열지 않고** 검증할 수 있다.
편집창의 "dirty면 저장 먼저"(61b D11)는 배치에 없다 — 저장본이 곧 대상이다.

### 3-2. 문항×종류당 HTTP 2회, 최장 수백 초 → 순차가 강제다
61b는 실측(1차 두 패스 + 2차 = 228초) 때문에 요청을 `phase:'first'` → `phase:'judge'`로 쪼갰다
(각 `maxDuration` 300초). 한 문항의 문제+풀이는 HTTP 최대 4회·수 분. n문항 배치는 **수십 분~시간 단위**가
정상이고, 병렬화는 Vercel 동시 실행·rate limit·비용 폭주를 한꺼번에 부른다. **1문항×1종류씩 직렬**.

### 3-3. 리포트에는 세션이 필요하다 — 반드시 `normal` 세션
`addComment({ discussionSessionId })`로 저장된다. 배치는 문항을 열지 않으므로 세션을 스스로 마련한다:
`createNormalSession`(`lib/discussion-sessions.ts:67`) · `listSessions`(`:105`).
⚠ **댓글 세션(`type:'comment'`)에 넣으면 안 된다.** `resolveCommentStream`이 세션으로 `commentStream`을
정하고(`lib/comments.ts:80-91`), 공개 문항의 `commentStream==true` 메시지는 `commentsVisible`이면
**비로그인 열람자까지 읽는다**(`firestore.rules:234-236`). `normal` 세션이어야 차단된다.

### 3-4. 사전 차단 사유는 다섯이다 (전부 AI 호출 전 판정)

| 사유 | 근거 | 판정 재료 |
|---|---|---|
| `missing` | 삭제·권한 상실 | `getProblemWithBlocks` → null |
| `not_owner` | AI 댓글 create는 오너만(rules) | `authorUid !== uid` (W7 — 실행 시점 방어) |
| `tab_load_error` | `computeVerifyHashes` → `collectCurrentContent`가 `VersionLoadError`(`lib/version/adapter.ts:27-31`) | `tabLoadErrors` 비어 있지 않음 |
| `empty_question` | 서버 400 `문제 내용이 비어 있습니다`(`route.ts:170`) — **두 종류 모두 차단**(W6) | `verifyBlocksOf(question).length === 0` |
| `no_solution` | 서버 400 `풀이 내용이 비어 있습니다`(`route.ts:172`) | `kind==='solution' && verifyBlocksOf(solution).length === 0` |
| `too_long` | 클라 `VERIFY_CHAR_CAP`(`CommentPanel.tsx:1315`) · 서버 400(`route.ts:178`, `chars > 15000`) | `verifyCharCountOf(blocksByTab, kind) > 15000` |

⚠ **`tab_load_error`가 특히 위험하다.** 그 예외는 `runVerifyFlow` 안에서 **`addComment` 뒤**(해시 계산
시점)에 터진다 → AI 비용을 다 쓰고 리포트는 저장됐는데 `verification`만 미갱신인 반쪽 상태로 끝난다.
반드시 호출 전에 거른다.
⚠ 이 다섯은 전부 "건너뜀"으로 요약에만 기록한다. **`skip` verdict로 적지 않는다** — `skip`은 AI가
판단한 검증 불가(그림 의존) 전용 어휘다(61b D14′).
⚠ 서버는 빈 텍스트 블록을 걸러 센다(`normalizeBlocks` `route.ts:394-406`) — `verifyBlocksOf`와 같은 셈법이다.

### 3-5. 오너 게이트 — 규칙이 강제한다
AI 댓글 create는 오너만(`authorType=='ai' && authorUid.matches('^ai:.*') && isOwnerCmt()`).
기준은 ProblemView `isVerifyOwner`와 동일하게 **`problem.authorUid === user.uid`**(authorUid 없는 레거시
문항은 오너로 치지 않는다). 버튼 노출과 개별 항목 활성화 **양쪽**에 건다.
또한 `/api/verify`에는 허용목록이 있다 — `VERIFY_ALLOWED_UIDS`(폴백 `AUDITION_ALLOWED_UIDS`), 비면 전원
거부(`lib/apiAuth.ts` fail-closed: 토큰 불비 401, 미등록 403) → 미등록 사용자는 전건 403(§3-11).

### 3-6. "폴더 직속만"은 기존 필터와 자연 일치 — 재귀 수집기를 만들지 말 것
`folderProblems`는 이미 `p.folder_id === folder.id`만 남긴다(`FolderView.tsx:182-190`). 하위 폴더는
`getChildren`으로 **표시만** 된다. 미지정 폴더는 같은 필터의 `!p.folder_id` 분기이며 역시 내 소유 → D3.

### 3-7. "검증 필요" 판정은 목록 데이터만으로 된다 — 블록 로드 0
재료는 `Problem.verification` 요약(verdict·stale)뿐이고 목록 문서에 이미 있다(`listProblems`의 `...data`
스프레드 `lib/firestore.ts:158-168`). `VerifyBadge`와 같은 소스라 화면과 다이얼로그가 어긋나지 않는다.

```
기본 체크 = !verification[kind] || verification[kind].stale     (E61d-5)
```
`stale`은 `handleSave` 경로에서만 계산된다(`EditorView.tsx:2631-2656`) — 그래서 §3-14가 성립한다.

### 3-8. `setVerification`은 `updated_at`을 안 건드린다 — 배치가 정렬을 흔들지 않는다
61b가 전용 `setVerification`(`lib/firestore.ts:72`)을 쓴다. 배지 갱신용 목록 리프레시는
`onUpdated`(FolderView prop 기존 존재)를 **배치 종료 시 1회**만 — 문항별 호출은 목록 전체 리로드를
n번 유발한다. 진행 상황은 다이얼로그가 자체 표시.

### 3-9. idToken은 문항마다 새로 받는다
토큰 수명 1시간 < 배치 시간. 루프가 **문항마다 `user.getIdToken()`**(SDK 캐시·자동 갱신, 비용 0).
시작 시 1회만 받으면 1시간 뒤부터 전부 401이다.

### 3-10. 진행 표시는 자체 UI다 — `PendingAIBubble` 재사용 불가
61b의 진행 표시는 CommentPanel의 세션 좌표에 붙은 합성 항목이다. 재시도 어휘도 다르다 —
"실패 항목만 다시 실행"(요약 화면)이 배치의 재시도다.

### 3-11. 실패는 두 종류다 (E61d-6)
- 문항 고유 실패(파싱·모델 오류·타임아웃·**세션/저장 실패**) → 기록하고 계속.
- HTTP **401/403** → **즉시 전체 중단**.
- **서로 다른 문항 연속 3건 실패** → **전체 중단**. 카운터 정의는 §5-1 `nextFailureCount`:
  **AI 호출을 실제로 시도한 종류 단위**로 세고, 건너뜀은 카운트하지 않으며, 성공 1건이면 0으로 리셋,
  [실패 항목만 다시 실행] 시작 시 리셋.
- 이 판정을 위해 `runVerifyFlow`가 던지는 Error에 `status`를 싣는다(D5①).

### 3-12. 다이얼로그는 전체 뷰포트 모달이어야 한다
FolderView는 `view.type === 'folder'`일 때만 렌더된다(`AppShell.tsx:710-718`) → 홈·편집·문항 이동 시
**언마운트되고 배치가 끊긴다**(사이드바의 다른 폴더 선택은 key 없는 같은 자리 렌더라 prop 변경일 뿐 —
안전). 처방은 `SheetImportModal.tsx:76-80` 관례의 **`position:fixed; inset:0; zIndex:9000`** 전체 뷰포트
오버레이 → 사이드바 클릭 자체가 막힌다. 실측: `main`은 z-index 없는 `position:relative`라 스태킹
컨텍스트를 만들지 않고, 조상 체인에 `transform`이 없어 fixed가 잘리지 않는다.
브라우저 이탈은 `beforeunload`(선례 `EditorView.tsx:2851`) — 단 **실행 중에만 등록**(V3).

### 3-13. 비용 표시는 2차(Claude) 기준이다
`VERIFY_GEMINI_COST_IN/OUT` 기본값이 0(`route.ts:148-149`) → `usage.costUsd`는 사실상 Claude 판정분만.
라벨을 **"누적 비용(2차 Claude 기준)"** 으로 적어 과소 표시를 숨기지 않는다.

### 3-14. 배치는 길다 — 프리플라이트 스냅샷으로 검증하면 안 된다 (V1)
모달은 같은 탭의 이동만 막는다 — **다른 탭·기기에서의 편집·저장은 못 막는다.** 프리플라이트(T0) 본으로
T2에 검증하면, 그 사이(T1)에 저장된 편집에 대해: 리포트·`contentHash`가 **T0 본** 기준으로 저장되는데
T1 저장은 그보다 먼저라 `handleSave`의 stale 비교가 다시 돌 계기가 없다 →
**배지는 "최신 ✓"인데 내용은 다른** 상태가 남는다. 단건 검증(61b)은 노출 창이 몇 초라 무시하지만 배치는
아니다. → **각 문항 차례에 `getProblemWithBlocks` 재로드 + `preflightSkip` 재판정** 후 그 본으로 검증한다
(D2′·D61d-12). 프리플라이트 로드본은 **계획 표시(대상 k회·건너뜀 f회)에만** 쓴다.

---

## 4. UX 사양

**진입**: FolderView 제목행(행 1, `minHeight 57`)의 `SortControls` 뒤, 휴지통 비우기 버튼과 같은 자리
(`FolderView.tsx:394-397` 구간)에 [일괄 검증] 텍스트 버튼(`fontSize 12`, `--text-secondary`).
노출 = §3-5 오너 + D3(일반 폴더·미지정) + 직속 문항 ≥ 1. 게이트로 숨길 때는 dev 콘솔에 이유를 남긴다
(61b `[Phase61b] 검증 칩 숨김: …` 관례 → `[Phase61d] 일괄 검증 버튼 숨김: …`).

**모달 규격**: `SheetImportModal`의 `S`·`btn` 어휘와 같은 치수(오버레이 `rgba(0,0,0,0.4)`·zIndex 9000,
패널 `min(920px, 94vw)`·`maxHeight 88vh`·radius 10, 헤더/푸터 `minHeight 57`·`padding '0 16px'`,
본문 `padding 16`·`overflowY auto`, 액센트 `--mathory-red-dark`). 그 파일의 상수는 export돼 있지 않으므로
**로컬 사본 + 출처 주석**으로 둔다(다른 파일을 리팩터링하지 않는다).

**상태 1 — 선택**
- 표: 행 = 직속 문항(현재 정렬 순서), 열 = `제목` / `[문제 ☐]` / `[풀이 ☐]` / `현재 배지`(`VerifyBadge`).
- 기본 체크 = E61d-5. 이미 판정이 있고 stale이 아닌 종류는 해제로 보이되 **체크 가능**.
- 오너 게이트 불통과 행은 두 체크박스 비활성 + 사유 표기.
- 표는 `maxHeight 60vh` 스크롤 컨테이너.
- 푸터: `n문항 · 검증 m회 · 종류당 1~4분 · 예상 x~y분 · API 비용 발생` + [전체 선택/해제] + [실행].
  m이 30 초과면 예상 시간 문구를 액센트로 강조(D8). 별도 확인 팝오버 없음 — 이 화면이 관문이다.

**상태 2 — 진행**
1. **프리플라이트**(동시 4건, W2): `getProblemWithBlocks` → `preflightSkip` → 행을 즉시 `건너뜀`으로
   확정. 상단에 `대상 k회 · 건너뜀 f회`. AI 호출 0. 이 단계도 [중단] 가능.
2. **AI 루프**: 각 행 = 대기 → 진행 중(현재 종류 표시) → 완료(verdict 배지) / 실패(메시지) / 건너뜀.
   **각 문항 차례에 재로드 + 재판정 후 검증**(§3-14).
   상단: `k / m 완료 · 누적 비용(2차 Claude 기준) $x.xx · 경과 mm:ss`.
- 실행 중에는 **[닫기]를 감추고 [중단]만** 노출(W5). [중단]은 즉시 눌리고 "현재 종류를 마친 뒤 멈춥니다"를 표시.

**상태 3 — 요약**
집계(`✓ a · ⚠ b · ✕ c · skip d · 실패 e · 건너뜀 f`) + 실패·건너뜀 목록(사유 문구는 `skipLabel`) +
총 실측 비용·소요 시간 + [실패 항목만 다시 실행] + [닫기].
닫을 때 **성공 1건 이상이면** `onUpdated()` 1회(W5).

---

## 5. 구현 사양

### 5-1. `lib/verify/batchPlan.ts` (신규 · **import 0 순수 모듈**)

> ⚠ 폴더 규약: import 문 금지, 타입도 로컬 정의(`parse.ts` 전례). `npm run test:batch`가 단독 컴파일한다.
> ⚠ **글자 수·블록 수를 여기서 세지 말 것**(W1) — 주입받는다. 유일 구현은 `verifyCharCountOf`다.

```ts
export type BatchKind = 'problem' | 'solution';
export type SkipReason =
  | 'missing' | 'not_owner' | 'tab_load_error' | 'empty_question' | 'no_solution' | 'too_long';

export const CHAR_CAP = 15_000;          // CommentPanel·route와 같은 값(사본임을 주석에 명시)
export const ABORT_STREAK = 3;           // E61d-6
export const PREFLIGHT_CONCURRENCY = 4;  // SheetImportModal SAVE_CONCURRENCY 전례(W2)

export interface VerifyStateLike { verdict: string; stale?: boolean }

/** E61d-5 — 미검증이거나 stale이면 기본 체크 */
export function defaultChecked(state: VerifyStateLike | undefined): boolean;

export interface PreflightInput {
  kind: BatchKind;
  missing: boolean;
  isOwner: boolean;
  tabLoadErrorCount: number;
  questionBlockCount: number;   // verifyBlocksOf(question).length
  solutionBlockCount: number;   // verifyBlocksOf(solution).length
  chars: number;                // verifyCharCountOf(blocksByTab, kind)
}
/** 판정 순서: missing → not_owner → tab_load_error → empty_question → no_solution → too_long */
export function preflightSkip(i: PreflightInput): SkipReason | null;
export function skipLabel(r: SkipReason): string;              // 한국어 라벨 — UI 사본 방지(W7)

export function isFatalStatus(status?: number): boolean;       // 401·403
export function nextFailureCount(prev: number, ev: 'ok' | 'fail' | 'skip'): number;
export function shouldAbort(count: number): boolean;           // count >= ABORT_STREAK

export type RowOutcome =
  | { state: 'pending' } | { state: 'running' }
  | { state: 'done'; verdict: 'ok' | 'check' | 'fail' | 'skip' }
  | { state: 'failed'; message: string }
  | { state: 'skipped'; reason: SkipReason };
export function summarize(rows: RowOutcome[]): {
  ok: number; check: number; fail: number; skip: number; failed: number; skipped: number;
};
export function estimateMinutes(runCount: number): [number, number];   // 종류당 1~4분
```

`too_long` 경계는 **서버와 같게** `chars > CHAR_CAP`(정확히 15,000은 통과).

### 5-2. `lib/batchVerify.ts` (신규 · 오케스트레이터)

```
runBatchVerify({ items, uid, getIdToken, buildMarkdown, stopRef, on })
  ① 프리플라이트 (동시 4건):
       getProblemWithBlocks → preflightSkip(kind별) → on.plan(rows)      // 표시용 (D2′)
  ② 직렬 루프 { 문항:
       stopRef 확인
       idToken = await getIdToken()                                       // 문항마다(§3-9)
       fresh = await getProblemWithBlocks(id)                             // ★재로드(§3-14)
       kinds = 선택된 kind 중 preflightSkip(fresh, kind) === null 인 것    // ★재판정
       if (kinds.length === 0) { 건너뜀 기록; continue }                   // 세션 안 만듦(W4)
       sessionId = await ensureBatchSession(id, uid)
       for (kind of kinds) { stopRef 확인 → runVerifyFlow({...fresh, kind, sessionId, idToken,
                              tabId: fresh.tabs[0]?.id ?? 'question', buildMarkdown}) → on.progress }
     }
  ③ 실패 분류:
       isFatalStatus(err.status)            → 전체 중단 (사유: 권한/토큰)
       shouldAbort(nextFailureCount(...))   → 전체 중단 (사유: 연속 실패)
       그 외(세션·저장 실패 포함 V4)         → 기록하고 계속
```

- `ensureBatchSession(problemId, uid)`: `listSessions` → `type==='normal' && name==='일괄 검증'` 재사용,
  없으면 `createNormalSession(problemId, '일괄 검증', uid)` (D6).
- 반환: `{ rows, usageTotal, aborted?: 'fatal' | 'streak' | 'user' }`.
- ⚠ **`lib/verify/`에 두지 말 것** — firestore·verifyFlow를 import한다(`verifyFlow.ts` 헤더 경고와 같은 이유).

### 5-3. `components/problem/BatchVerifyDialog.tsx` (신규)

3상태 다이얼로그(§4). `user`는 prop(D4). `beforeunload`는 실행 중에만 등록(V3).
verdict 색·라벨은 `VerifyBadge`가 export하는 `VERIFY_VERDICT_META` 재사용, 스킵 사유 문구는
`skipLabel`(W7) — 어느 쪽도 사본을 만들지 않는다.

### 5-4. 기존 파일 수정 (전부 additive)

| 파일 | 변경 |
|---|---|
| `components/problem/FolderView.tsx` | `user` prop 수용 · [일괄 검증] 버튼(`:394-397` 구간) · 다이얼로그 마운트 · 노출 게이트 + dev 콘솔 사유 |
| `components/layout/AppShell.tsx` | FolderView **2곳**(`:711`·`:757`)에 `user={user}` |
| `lib/verifyFlow.ts` | ① `call()`의 throw에 `status` 부착 ② `verifyCharCountOf(blocksByTab, kind)` export (D5) |
| `components/editor/EditorView.tsx:2699` · `components/problem/ProblemView.tsx:247` | 각자의 `verifyCharCount` 사본을 `verifyCharCountOf` 호출로 교체 |
| `components/ui/VerifyBadge.tsx:12` | `META` → `VERIFY_VERDICT_META`로 export(내부 사용은 그대로) |
| `package.json` | `"test:batch": "tsc lib/verify/batchPlan.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/batchPlan.test.mjs"` |

서버·규칙·타입·마이그레이션: **0**. `runVerifyFlow` 동작·결과물, `/api/verify`, 프롬프트, 파서: **무변경**.

---

## 6. 결정표

| # | 결정 |
|---|---|
| D61d-1 | **서버 변경 0.** 배치는 클라 루프 — 61b A5의 이행 |
| D61d-2 | 대상 = 폴더 직속만(E61d-1·§3-6). 문항×종류 체크박스, 기본 체크 = `!verification[kind] ∨ stale`(E61d-5) |
| D61d-3 | **완전 직렬** — 1문항×1종류씩. 병렬·프리페치 금지(§3-2). 프리플라이트 **읽기만** 동시 4건(W2) |
| D61d-4 | 문항 고유 실패는 기록하고 계속(E61d-3). 401/403 즉시·연속 3건 시 **전체 중단**(E61d-6·§3-11). 실패·건너뜀은 `verification` 미갱신(61b D13′ 계승) |
| D61d-5 | 중단 = **진행 중인 종류는 완료·저장까지 마친 뒤** 멈춘다. in-flight abort 금지 — first 비용을 쓰고 judge를 끊으면 D13′에 의해 통째로 버려진다 |
| D61d-6 | 세션 = `type:'normal' && name==='일괄 검증'` 재사용/생성. **댓글 세션 금지**(§3-3). 실제로 돌 kind가 있을 때만 확보(W4) |
| D61d-7 | 요약은 화면만(E61d-4). Firestore 신규 스키마·컬렉션 0 |
| D61d-8 | 브라우저 이탈은 `beforeunload`(실행 중에만), 앱 내 이동은 전체 뷰포트 모달로 차단(§3-12). 이탈해도 완료분은 저장돼 있다 — **문항×종류가 커밋 단위**, 배치 원자성은 애초에 없다(정의) |
| D61d-9 | 비용: 사전은 "API 비용 발생" 문구, 사후는 usage 합산을 **"2차 Claude 기준"** 명시(§3-13) |
| D61d-10 | 사전 차단 **5종**(§3-4)은 AI 호출 전 판정. `skip` verdict 기록 금지 |
| D61d-11 | 순수 판정 = `lib/verify/batchPlan.ts`, 부수효과 = `lib/batchVerify.ts`(D7). 글자 수는 batchPlan이 세지 않는다(W1) |
| D61d-12 | **검증 대상은 실행 시점 재로드본이다**(§3-14). 프리플라이트 로드본은 계획 표시 전용. 재판정에서 새로 걸리면 건너뜀 |
| D61d-13 | UI 어휘 단일 소유: verdict = `VERIFY_VERDICT_META`, 스킵 사유 = `skipLabel`, 모달 치수 = SheetImportModal 규격 사본(+출처 주석) |

---

## 7. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | `lib/verify/batchPlan.ts` + `tests/batchPlan.test.mjs` + `test:batch` | 아래 테스트 목록 전항 통과 |
| 1 | `lib/verifyFlow.ts` additive 2건 + 두 사본 제거 + `VERIFY_VERDICT_META` export | 61b 단건 검증 회귀 없음(칩 경로 동작·리포트 동일). **`npm run test:verify` 45개 통과**(C1) |
| 2 | `lib/batchVerify.ts` + 선택 화면 + FolderView 버튼·게이트 + AppShell `user` 2곳 | 기본 체크가 배지 상태와 일치. 비오너·휴지통·공유받음·공유보낸에서 버튼 부재, **미지정에서는 존재** |
| 3 | 프리플라이트·진행·요약 + 중단 + `beforeunload`(실행 중에만) | 2~3문항 소배치: 스킵 조기 확정 · 진행 갱신 · 중단이 종류 경계에서 멈춤 · 성공 시 닫을 때 `onUpdated` 1회. **동시 편집 시나리오**: 배치 중 다른 탭에서 대상 문항을 편집·저장 → 그 문항이 **편집 후 본**으로 검증됨(§3-14) 확인 |
| 4 | 실패 경로 위장 배치 | 15,000자 초과·풀이 없음·탭 로드 실패·401/403·연속 3건: 건너뜀/중단이 규칙대로, `verification` 오염 0, [실패 항목만 다시 실행] 동작(카운터 리셋 포함) |
| 5 | 마무리: `docs/roadmap.md` Phase 61d 절 · CLAUDE.md 절 | 61b 단건 검증 회귀 재확인 · 프로덕션 빌드 통과 |

### 스텝 0 테스트 목록 (`tests/batchPlan.test.mjs`)

1. `defaultChecked`: `undefined`→true · `{verdict:'ok'}`→false · `{verdict:'ok',stale:true}`→true ·
   `{verdict:'check'}`→false · `{verdict:'fail'}`→false · `{verdict:'skip'}`→false
2. `preflightSkip` 사유별 6건 + **판정 순서**(missing이 not_owner보다, tab_load_error가 too_long보다 먼저)
3. `empty_question`이 `kind:'problem'`·`'solution'` **둘 다** 차단(W6)
4. `no_solution`은 `kind:'solution'`에서만 발동
5. `too_long` 경계: `chars === 15000` 통과 · `15001` 차단
6. `isFatalStatus`: 401·403 true / 400·429·500·undefined false
7. `nextFailureCount`·`shouldAbort`: fail 누적 · ok 리셋 · **skip은 유지(증가 안 함)** · 3에서 abort
8. `summarize` 집계(혼합 rows)
9. `estimateMinutes` 단조 증가·하한
10. `skipLabel`이 모든 `SkipReason`에 대해 빈 문자열이 아님(스위치 누락 방지)

**배포 순서**: 61b·61c가 아직 미배포다. 61d는 **61b 배포·프로덕션 실동작 확인 이후**에 얹고,
첫 실전 배치는 2~3문항으로 시작한다 — 단건이 검증되지 않은 상태의 배치는 비용이 n배로 샌다.

---

## 8. 하지 말 것

- 하위폴더 재귀 수집기 금지(E61d-1) → `folderProblems` 필터 재사용(§3-6).
- **프리플라이트 스냅샷으로 검증하지 말 것**(D61d-12·§3-14) — 실행 시점 재로드본만.
- **`batchPlan`에서 글자 수·블록 수를 세지 말 것**(W1) — 서버 셈법의 3번째 사본이 된다.
- `updateProblem`으로 verification 쓰지 말 것 → `setVerification`만(§3-8).
- 사전 차단·실패를 `skip` verdict로 기록하지 말 것(§3-4, 61b D14′).
- 리포트를 **댓글 세션**에 넣지 말 것 — 공개 문항에서 비로그인까지 읽는다(§3-3).
- 전건 스킵 문항에 세션을 만들지 말 것(W4).
- `runVerifyFlow`·`/api/verify`·프롬프트의 **동작** 수정 금지. 허용은 D5의 additive 2건뿐.
- idToken을 배치 시작 시 1회만 받지 말 것(§3-9).
- `PendingAIBubble`·CommentPanel 재사용 시도 금지(§3-10).
- 문항별 `onUpdated` 호출 금지 → 종료 시 1회, 그것도 성공 1건 이상일 때만(§3-8·W5).
- `lib/verify/batchPlan.ts`에 import 문 금지 · `lib/batchVerify.ts`를 `lib/verify/`에 두지 말 것.
- `beforeunload`를 상시 등록하지 말 것 — 실행 중에만(V3).
- verdict 색·스킵 문구·모달 치수를 새로 정의하지 말 것(D61d-13).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 9. 범위 밖

하위폴더 포함 옵션 · 배치 이력 영속화 · 정기/예약 실행 · 병렬화 · 공유받은 문항 검증 ·
서버 측 배치 큐 · 배치 전용 리포트 형식. **전부 0건.**
신규 3파일(`lib/verify/batchPlan.ts` · `lib/batchVerify.ts` · `components/problem/BatchVerifyDialog.tsx`)
+ `tests/batchPlan.test.mjs` + 기존 6파일 소폭 additive.

---

## 부록 A. v3 → v4 조정 (W1~W7 · C1)

| # | v3 | v4 |
|---|---|---|
| W1 | `batchPlan.charsOf(blocks, kind)` | 삭제 — import 0 모듈이 `verifyBlocksOf`를 못 쓰고, 직접 세면 서버 셈법 3번째 사본이 된다. 수치는 주입 |
| W2 | 프리플라이트 동시 5건 | **4건** — `SheetImportModal.SAVE_CONCURRENCY` 전례 |
| W3 | `route.ts:169`·`:171-173` / `:148-149` | 400은 `:170`(문제)·`:172`(풀이)·`:178`(15,000자). 단가 env `:148-149`는 v3이 맞다 |
| W4 | 세션 확보 위치 미지정 | 실제로 돌 kind가 1개 이상일 때만 — 전건 스킵 문항에 빈 세션 금지 |
| W5 | 실행 중 [닫기] 처리 미지정 | 실행 중 [닫기] 숨김·[중단]만. `onUpdated`는 성공 1건 이상일 때 닫으며 1회 |
| W6 | `empty_question`이 문제 검증만 막는 것처럼 읽힘 | 풀이 검증에도 `problemBlocks`가 실려 서버가 400 → **두 종류 모두** 차단 |
| W7 | `SkipReason` 5종 · 라벨 소유자 미지정 | `not_owner` 추가(6종) · `skipLabel`을 batchPlan이 소유 |
| C1 | "test:verify 45개" | 실측 확인(37+8) — v3이 맞다 |

**v3에서 그대로 승계한 것**: E61d-5·6(덕수 재결) · D2′/D61d-12(실행 시점 재로드, V1) · V2(연속 카운터
정의) · V3(beforeunload 실행 중에만) · V4(세션·저장 실패는 문항 실패로 계속) · §3-3·3-4·3-12의 위험 3종.

## 부록 B. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web (2026-08-23) | E61d-1~4 · 사실확정 §3-1~3-10 · D61d-1~9 · 교차검토 질문 5건 |
| v2 | CLI (2026-08-23) | 실측 교차검증 — 정정 8건·보완 7건(탭 로드 실패 사전 차단·댓글 세션 노출·전체 뷰포트 모달) · D1~D8 |
| v3 | web (2026-08-23) | v2 전 인용 재검증(전건 사실) · 덕수 재결 2건(E61d-5·6) · D2′/D61d-12(실행 시점 재로드) · C1 · V2~V4 |
| **v4** | **CLI (2026-08-23)** | **실행판 — W1~W7 조정 · batchPlan API 확정 · 오케스트레이터 의사코드 · 모달 규격 · 스텝 0 테스트 10항 · D61d-1~13. 착수 가능** |

*착수 준비물 없음(신규 env·비밀 0). 배포는 61b 프로덕션 확인 후.*

---

## 부록 — 후속: 대상 목록 정렬 고정 (2026-09-04 · 배포 대기)

정렬 개선(덕수 메모, `docs/phaseSketch/정렬기능 개선.md`)의 일부. `BatchVerifyDialog`가
prop으로 받은 `problems`를 **받는 자리에서 제목 오름차순(`'ko' + numeric`)으로 정렬**한다.

- v4 §의 "폴더 직속 문항 — 현재 정렬 순서 그대로" 계약이 여기서 바뀌었다: 이전에는
  FolderView의 보기 모드·정렬 상태가 **검증 실행 순서**까지 좌우했다(리스트/카드에서 달랐다).
- ⚠ 정렬은 **한 번, prop 경계에서** — 표시(테이블)·실행(`startSelected`)·전체선택(`toggleAll`)이
  전부 같은 배열을 봐야 한다. 렌더 자리마다 따로 정렬하면 셋이 갈린다.

