# Phase 51 — 문항 공개: 스냅샷 + 실시간 + 댓글 공개 열람

> 공유 개편 후속. **Phase 50의 "웹에 공개(스냅샷)"를 흡수해, 하나의 "문항 공개" 개념으로 통합**한다.
> 핵심 추가: **(가) 실시간 공개**(원본 편집 즉시 반영) + **(나) 댓글 공개 열람**(누구나 읽기, 작성은 기존 멤버만).
> 번호: 기존 `Phase 51 수식 필기 입력` 스케치는 추후 덕수가 52로 이동 예정 → 이 문서가 **51**.
> **이 개정본은 외부(웹 Claude Code) 코드 대조 검토(P1~P10) + CLI 코드 재검증 + 덕수 결정(아래 §결정 로그)을 반영했다.** load-bearing 3건(P1·P2·P3)을 1단계에 못박는다.

## 결정 로그 (2026-06-24 확정)
- **댓글 작성 권한 = 멤버만 (비멤버·비로그인 작성 불가).** 공개로 댓글의 *작성*을 열지 않는다. 작성은 기존 오너/commenter 멤버가 에디터 댓글 패널에서 한다. → 원안의 §4-3 공개 create 규칙은 **폐기**.
- **댓글 읽기 = 누구나(비로그인 포함).** 공개 문항은 본문이 비로그인 열람 가능하니, 댓글도 비로그인 포함 누구나 읽을 수 있게 한다. → §4-2에서 `isSignedIn()` 조건 **제거**.
- **공개 뷰어는 완전 읽기 전용** — 본문 live + 댓글 표시(작성 입력창 없음). `/p`에 로그인 버튼 없음 → P10(단일 세션 충돌) 소멸.
- **P1(commentSessionId 포인터)·P3(mapDoc 'comment')은 유지** — 공개 뷰어가 agent 메시지를 `isCommentStream`으로 거르려면 포인터가 필요하고, mapDoc은 현존 에디터 버그라 독립적으로 고친다.
- **OG/SSR(P7) 이번 Phase 포함** — L1·L2 최소 범위(정적 OG 1장, 메신저 링크 카드 한정). 1단계(규칙)를 먼저 배포·검증 후 4~5단계.

## 핵심 UX 결정: "문항 공개" 하나로 통합 (D8)

스냅샷/실시간을 **별도 카테고리로 나누지 않는다.** "이 문항을 공개했는가"가 하나의 개념이고, 스냅샷·실시간은 그 공개의 **방식(속성)**일 뿐.
- 사이드바 노드: **"문항 공개"** 1개(현 "웹에 공개" 대체).
- **같은 리스트**에 스냅샷 + 실시간을 함께 나열, 각 행에 `[스냅샷]`/`[실시간]` **방식 배지**.
- 생성 UI: '공유 설정'의 "문항 공개" 섹션에서 **라디오로 방식 선택** 후 발급.
- 한 문항이 여러 행으로 보일 수 있음(스냅샷 N + 실시간 1) → 수용.

| 방식 | 스냅샷으로 공개 (Phase 50) | 실시간 공개 (Phase 51) |
|---|---|---|
| 저장 | `shares/{shareId}` (문항당 여러 개) | `problems/{id}.visibility='public'` (문항당 1개) |
| 편집 반영 | ✗ (재발급) | ✓ (저장 즉시, onSnapshot) |
| 링크 | `/shared/{shareId}` | `/p/{problemId}` |
| 댓글 | 불가 | **누구나 읽기 / 작성은 멤버만** |
| 만료 | 있음(칩) | 없음(on/off) |

## 0. 선행 확인 (구현 전 반드시 읽을 것) — 코드 대조 완료

- `types/problem.ts` — `Visibility='private'|'link'|'public'`(존재), `commentsVisible`/`commentsWritable`(P47), `memberTabVisibility`. **`commentSessionId`·`publishedAt` 필드 신설(§3).**
- `firestore.rules`:
  - `problems` read = `isOwner()||isPublic()||isMember()`, `isPublic()` 인증 불요 → 비로그인 live 읽기 가능. ✓
  - 블록 서브컬렉션 read: public이면 블록 공개되나 **탭 필터가 멤버에게만 적용** → §4-1 보완.
  - `tab_comments` read = `isOwnerCmt()||(isMemberCmt()&&commentsVisible())` → §4-2에 **public 읽기(비로그인 포함) 가지 추가**.
  - `tab_comments` create = 오너/commenter 멤버만(+AI는 오너) → **변경 없음**(공개 작성 미지원, 결정 로그).
  - `tab_comments` delete = `(human&&본인)||(ai&&오너)` → §4-4는 **통째 교체 금지, human 분기에만 `||isOwnerCmt()` 머지**.
  - **`discussion_sessions` read = `isOwnerSess()||isMemberSess()`** → 공개 비멤버는 세션 못 읽음 → **P1: commentSessionId 포인터 비정규화(§4-5)**.
- `lib/discussion-sessions.ts` — **P3 버그**: `mapDoc`의 `type: data.type==='public'?'public':'normal'`이 **`'comment'`을 `'normal'`로 뭉갬**(코드 재확인: `lib/discussion-sessions.ts:50`). 그 결과 `CommentPanel:209`의 `find(type==='comment')`가 항상 null → `commentSessionId` 항상 null, **댓글 세션이 `normalSessions`(`CommentPanel:1014`)에 섞여 agent 패널에 유령 카드로 노출 + `countAgentSessions` +1 오류.** 현존 라이브 버그 → §5-3에서 수정.
- `lib/firestore.ts` — **P2: 블록 `onSnapshot` 전무**(전부 `getDocs`). live 본문은 §5-1 `watchTabBlocks` 신설 필요. `/shared` 재사용은 **`TabContent` 렌더링만** 가능(스냅샷이라 live-read 0).
- `lib/comments.ts` — `isCommentStream(c, commentSessionId)`(`comments.ts:140`), `watchAllComments`(댓글 실시간 구독 존재).
- `app/shared/[shareId]/page.tsx` — 스냅샷 뷰어(그대로). `TabContent` 패턴 재사용 대상.
- `lib/membership.ts` — `canComment`(owner/commenter만) → 그대로 사용(공개 작성 미지원이라 public 경로 불요).
- `package.json` — `firebase ^12.9.0`, **`firebase-admin` 미설치** → 서버 read는 Firestore REST(§5-4).
- `CommentPanel.tsx:223` — `ensureCommentSession`은 `isCommentsMode && isOwner && !commentSession`일 때만 실행(오너가 댓글 패널 첫 진입). 패널 안 열고 공개만 켜면 `commentSessionId` 미설정 → §6에서 공개 토글 시 선제 호출.

## 1. 목표 & 비목표
**목표**: "문항 공개" 단일 개념(스냅샷+실시간 한 리스트) / 실시간 공개(비로그인 열람·편집 즉시 반영) / **댓글 공개 열람**(비로그인 포함 누구나 읽기, agent 메시지 비노출) / 오너 모더레이션·비공개 전환.
**비목표**: **비멤버/비로그인 댓글 작성(D7 — 작성은 멤버 전용 유지)** · 실시간 공동 편집 · agent 메시지 완전 차단용 컬렉션 분리(D3, 별도 Phase) · 문항별 동적 OG·본문 SSR 검색 인덱싱(v2).

## 2. 통합 "문항 공개" 리스트 (`PublishList`)
`WebShareList`(P50)를 확장 → 두 소스 합쳐 렌더:
- 스냅샷: `listSharesByOwner(uid)` → `[스냅샷]` 행.
- 실시간: `allProblems` 중 `visibility==='public'` → `[실시간]` 행(추가 쿼리 불요).
- 정렬: **`publishedAt` 내림차순**(P9 — `updated_at`은 편집마다 순서가 튐).

| 컬럼 | 공통 | 스냅샷 | 실시간 |
|---|---|---|---|
| 방식 배지 | `[스냅샷]`/`[실시간]` | | |
| 제목(클릭) | 뷰어 새 탭 | `/shared/{id}` | `/p/{id}` |
| 공개일 | createdAt / publishedAt | | |
| 만료 | | 칩(변경=재발급) | — |
| 댓글 | | — | 미해결 수(클라 `countComments`) |
| 링크 복사·중단 | ✓ | revoke(delete) | `visibility='private'` |

메타·블록체인 배지 없음(P50 일관).

## 3. 데이터 모델
- `visibility='public'` 재사용. 토글 = `updateProblem(id,{ visibility })`.
- **`publishedAt: Timestamp`(신설, P9/B4)**: 실시간 공개 ON 시 스탬프, 리스트 정렬용. 스탬프 정책은 §6·§10 참조(최초 1회 + 비공개→재공개 시 갱신, 일반 편집 시 불변).
- **`commentSessionId: string`(신설, P1/B4)**: `ensureCommentSession`이 1회 기록(§4-5/§5-2). public 뷰어가 problem 문서에서 읽어 `isCommentStream`에 사용.
- 공개 탭: `memberTabVisibility` 재사용(멤버·실시간 공통, §4-1). 스냅샷은 생성 시 `tabVisibility` 동결(기존).
- 댓글 정책: `commentsVisible`/`commentsWritable`(P47) 재사용. **공개 시 기존 멤버 댓글이 공개로 노출**됨(§6에서 오너에게 인지시킴).
- 비정규화 원칙(P49) 예외는 **`commentSessionId` 단일 포인터뿐** — 세션 리스트 쿼리 의미를 안 건드림. 댓글 수는 여전히 클라 계산.

## 4. 보안 규칙 변경 (`firestore.rules`)
> 적용 대상: `problems/{problemId}` 하위 match 블록. `isSignedIn()`은 상위 `problems` match에 정의돼 호출 가능. `parentIsPublic()`은 일반 서브컬렉션 match에만 있으니 **tab_comments match엔 별도 정의 추가**.
> **이번 Phase의 규칙 변경은 §4-1(블록 탭 필터) + §4-2(공개 댓글 read) + §4-4(오너 모더레이션 delete) 세 곳.** create(§4-3)는 변경 없음.

### 4-1. 블록 읽기 public 탭 필터 (D1)
`parentData`/`tabIdFromSubcol`/`isBlocksSubcol`/`tabAllowedForMember`는 이미 존재 — 재사용.
```
function tabAllowedForPublic() {
  return parentData().get('memberTabVisibility', {}).get(tabIdFromSubcol(), true) == true;
}
allow read: if !isCommentsCol() && (
  parentOwner()
  || (parentIsPublic() && (!isBlocksSubcol() || tabAllowedForPublic()))
  || (parentIsMember() && (!isBlocksSubcol() || tabAllowedForMember()))
);
// write는 기존 그대로: allow write: if !isCommentsCol() && parentOwner();
```

### 4-2. tab_comments 읽기 — 공개(비로그인 포함) (D2)
tab_comments match에 `parentIsPublic()` 정의 추가 후 public 가지 추가. **`isSignedIn()`을 걸지 않는다** — 본문이 비로그인 열람 가능하므로 댓글도 비로그인 포함 누구나 읽게 한다(결정 로그).
```
allow read: if isOwnerCmt()
  || (isMemberCmt() && commentsVisible())
  || (parentIsPublic() && commentsVisible());
```
⚠️ **D3(수용)**: 규칙 레벨에선 공개 열람자(비로그인 포함)가 agent 메시지도 읽을 수 있음. 뷰어가 `isCommentStream`으로 UI 차단(§5-5). 규칙 레벨 누출은 수용하되 **"민감 문항 공개 금지" 안내** + 완전 차단은 agent 컬렉션 분리(별도 Phase).

### 4-3. tab_comments 생성 — 변경 없음 (결정: 작성은 멤버만)
공개로 댓글 *작성*을 열지 않는다. 기존 create 규칙(오너 + commenter 멤버 + AI는 오너) **그대로 유지**. 공개 뷰어에는 작성 UI를 두지 않으며, 멤버 작성은 에디터 댓글 패널 경로(변경 없음)로 이뤄진다.
> (원안의 public create OR 가지 + P4 null-sid 경로는 **폐기**. `membership.ts`의 `canComment` public 분기도 불필요.)

### 4-4. 모더레이션 — 오너 인간 댓글 delete 허용 (D4, P5 반영)
**기존 delete 규칙 통째 교체 금지.** AI-삭제(오너) 가지를 보존하고 인간 가지에만 `||isOwnerCmt()` 머지. **동기 갱신**: 댓글이 *공개로 노출*되므로(§3) 부적절 멤버 댓글을 오너가 내릴 수 있어야 한다.
```
allow delete: if (
  resource.data.get('authorType','human') == 'human'
  && (resource.data.authorUid == request.auth.uid || isOwnerCmt())   // ← 오너 모더레이션 추가
) || (
  resource.data.authorType == 'ai' && isOwnerCmt()                   // ← 기존 유지
);
```
> 정책 변경: 기존 주석 "오너도 남의 댓글 삭제 불가"는 **공개 노출에 따른 모더레이션 도입으로 폐기 — 주석도 갱신**.

### 4-5. commentSessionId 포인터 — 규칙 변경 없음, 데이터/lib만 (P1 핵심)
공개 뷰어는 `discussion_sessions`를 못 읽으므로(read=owner/member), `isCommentStream` 필터가 댓글-세션 태깅 댓글(오너/멤버가 댓글 패널에서 작성)과 agent 메시지를 구분 못 한다. **`problems/{id}.commentSessionId` 단일 포인터를 비정규화**해 public-readable한 problem 문서에서 읽게 한다.
- 규칙 추가 불요: `problems` update는 `isOwner()`가 이미 커버(오너가 `commentSessionId` 쓰는 경로).
- `ensureCommentSession`이 세션 생성/확인 시 1회 기록(§5-2).

## 5. Live 공개 뷰어 + lib 신설
> ⚠️ D5의 "/shared 재사용"은 **렌더링(`TabContent`)만**. `/shared`는 동결 스냅샷이라 live-read 0 → **신규 구독 헬퍼 필수(P2)**.

### 5-1. lib 신설 — 블록 실시간 구독 (`lib/firestore.ts`, P2)
`onSnapshot`을 import에 추가하고 탭별 구독 헬퍼 신설:
```ts
/** Phase 51: 한 탭의 블록 실시간 구독 (공개 live 뷰어용). 비공개 탭은 규칙(4-1)으로 permission-denied. */
export function watchTabBlocks(problemId: string, tabId: string, cb: (blocks: Block[]) => void): () => void {
  const q = query(collection(db, 'problems', problemId, tabSubcollection(tabId)), orderBy('order'));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Block))),
    (err) => console.warn(`[watchTabBlocks] ${tabId}:`, err));
}
```
> live 뷰어는 `getPreviewBlocks`를 쓰지 말 것("내용 있는 첫 탭만 반환 + 권한 에러 silent" → 다중 탭 부적합). visible 탭마다 `watchTabBlocks` 구독.

### 5-2. lib 수정 — 댓글 세션 포인터 기록 (`lib/discussion-sessions.ts`, P1)
`ensureCommentSession`이 세션 id를 problem 문서에 1회 비정규화(멱등). 순환참조 피하려 `updateProblem` import 대신 `updateDoc(doc(db,'problems',id),...)` 직접 사용.
```ts
// 세션 확보 후:
await updateDoc(doc(db, 'problems', problemId), { commentSessionId: sid }).catch(() => {});
```

### 5-3. lib 수정 — `mapDoc`이 'comment' 보존 (`lib/discussion-sessions.ts`, P3 load-bearing)
현재 `type: data.type==='public'?'public':'normal'`이 'comment'를 'normal'로 뭉갬(`:50`):
```ts
type: data.type === 'comment' ? 'comment'
    : data.type === 'public'  ? 'public'
    : 'normal',
```
> 수정 후 **회귀 확인 필수**: 에디터 agent 패널에 유령 "댓글" 카드가 없는지(`normalSessions = filter(type==='normal')`, `CommentPanel:1014`), `countAgentSessions`가 정확한지. 이 버그가 현재 "전부 null-sid라 우연히 동작"을 만들고 있으니, 고친 뒤 기존 댓글/AI 배지 동작을 재검증한다. (수정 후 오너 댓글은 실제 commentSessionId로 저장되고, 공개 뷰어는 §4-5 포인터로 동일 id를 읽어 필터하므로 일관.)

### 5-4. SSR 메타데이터 / Open Graph (`app/p/[problemId]/page.tsx`, P7 — 범위 잠금)
`/p/[problemId]`를 **서버 컴포넌트**로 만들고 `generateMetadata`로 OG 태그(제목/설명/고정 이미지)를 주입한다. 목적은 **메신저 링크 미리보기**(카카오톡 등)다. 그 안에서 client `PublicProblemView`를 렌더.
> **범위 잠금(L1·L2):** ① OG 이미지는 **정적 기본 1장**(`public/og-default.png`, 로고+슬로건) — `types/problem.ts`에 thumbnail/description 필드가 **없어** 문항별 동적 썸네일은 데이터원이 없음(v2). ② generateMetadata가 주는 건 **OG 메타뿐** — 본문은 client `onSnapshot` 렌더라 **검색엔진 본문 인덱싱은 v1 비목표**(메신저 카드만). 본문 SSR(검색 인덱싱)은 v2.
- 서버 read: **firebase-admin 미설치(`firebase` ^12.9.0만)** → **Firestore REST**로만. 공개 문항은 world-readable이라 비인증 REST가 `isPublic()` 통과.
  - URL: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/problems/${id}` (`projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`, 서버 접근 가능). `(default)`는 경로에 그대로.
  - 파싱: `data.fields?.title?.stringValue` (옵셔널 체이닝 — `fields`/`title`/`stringValue` 어느 단계든 없을 수 있음).
  - **`fetch(url, { cache: 'no-store' })` 필수** — Next 14 서버 fetch 기본 캐시라, 비공개 전환 후 stale 방지.
  - `generateMetadata`는 `async` + try/catch로 실패/비공개 시 **기본 메타(서비스명) fallback**(절대 throw 금지 — 페이지 전체가 죽음).
  - `metadata.metadataBase = new URL('https://mathory.app')` 설정(정적 OG 이미지 경로가 절대 URL로 풀리도록).
- 본문·댓글의 onSnapshot은 client(`PublicProblemView`)에서. 페이지(서버)는 `problemId`만 전달.

### 5-5. 뷰어 동작 (`PublicProblemView`, client) — 완전 읽기 전용
- `problems/{id}`(public read) 구독 + visible 탭마다 `watchTabBlocks` 구독 → 편집 즉시 반영.
- `TabContent`(/shared) 렌더 패턴 재사용: `EditorPreview borderless locale="ko"`, `ChoicesBlock`, `imageTreatmentStyle`.
- **댓글(읽기 전용)**: 댓글 스레드를 **표시만** 한다(작성 입력창 없음). **`commentSessionId`는 problem 문서에서 읽어** `isCommentStream`으로 필터 → 오너/멤버 댓글 표시 + agent 메시지 제외. `CommentPanel`을 그대로 쓰기보다 **읽기 전용 렌더(스레드 표시 컴포넌트)** 분리 권장(작성/AI/세션 UI 비노출).
  - 포인터(`commentSessionId`)가 비어 있으면(오너가 댓글 패널·공개 토글을 아직 안 거친 경우) `isCommentStream(c, null)`로 동작 → legacy null-sid 댓글만 표시, agent 메시지는 여전히 제외. §6의 공개 토글 선제 호출로 포인터를 채워 일관성 확보.
- **로그인 버튼 없음**: 공개 문항은 비로그인 열람·댓글 읽기 모두 가능하므로 `/p`에 로그인 플로우를 두지 않는다 → **P10(단일 세션 충돌) 소멸**. (멤버가 댓글을 쓰려면 에디터에서.)
- 비공개 전환: 구독 permission-denied → "비공개로 전환되었습니다" 안내.
- 헤더: /shared 뷰어와 동일 로고/슬로건(메인 통일 스타일).

## 6. 오너 UI (`ShareSettingsPanel` → "문항 공개")
- 현 '웹에 공개' 섹션을 **"문항 공개"**로 개편. 방식 **라디오: ○ 스냅샷으로 공개  ○ 실시간 공개**.
  - 스냅샷: 만료 프리셋(기본 무기한) → `createShare(...)` → `/shared/{id}`.
  - 실시간: `updateProblem(id,{visibility:'public', publishedAt})` → `/p/{id}`. 댓글 표시 토글(`commentsVisible`)을 **실시간 공개 UI에 명시 노출**.
- **공개 시 기존 멤버 댓글이 공개로 노출됨을 인지시킨다** — `commentsVisible`(기본 true, 멤버·공개 공용 필드)이므로 켜는 순간 멤버 토론이 공개로 보인다. 오너가 끄거나 인지하고 켤 수 있게 토글·안내 노출. ("공개만 댓글 OFF" 분리는 필드 공용이라 불가 — §10 알려진 제약.)
- **실시간 공개 ON 시 `ensureCommentSession(id, ownerUid)` 1회 호출**: `CommentPanel:223`은 오너가 댓글 패널을 열 때만 세션을 만들므로, 패널을 안 열고 공개만 켜면 `commentSessionId`가 비어 §4-5 포인터가 늦게 채워진다. 공개 토글 핸들러에서 선제 호출해 포인터 일관성 보장.
- **`publishedAt` 스탬프 정책(B8)**: 비공개→공개 전환 핸들러에서만 조건부 스탬프. 최초 공개 시 `serverTimestamp()` 1회, 이미 `publishedAt`이 있고 재공개면 갱신(리스트 상단 복귀), **일반 편집(`updateProblem`)에는 절대 넣지 않는다**(P9 — 순서 튐 방지).
- 공개 탭은 기존 "공유할 탭" 체크박스 공통. 라벨로 "스냅샷=동결 / 실시간=반영·댓글 열람" 명시.

## 7. (참고) Phase 50 자산 개편 맵
`WebShareList`→`PublishList`(두 소스+방식 배지) · ShareTree/AppShell "웹에 공개"→"문항 공개" · ShareSettingsPanel '웹에 공개'→"문항 공개"(방식 라디오). 스냅샷 로직(`lib/shares.ts`, `/shared`)은 유지.

## 8. 결정 (확정)
- D1 public 블록 탭 필터 적용 · **D2 public 댓글 read 추가(비로그인 포함, create는 멤버만 유지)** · D3 agent 누출=UI 필터 한정(규칙 누출 수용) · D4 오너 모더레이션 delete(공개 노출 대비) · D5 새 경량 읽기전용 PublicProblemView · D6 방식별 하위 노드 없음(단일 "문항 공개") · **D7 비멤버/비로그인 댓글 작성 불가(작성=멤버 전용)** · D8 스냅샷·실시간 "문항 공개" 통합 · D9 `publishedAt` 스탬프로 live 정렬(P9) · D10 `/p` SSR+OG = 메신저 링크 미리보기 한정(정적 OG 이미지), 검색 본문 인덱싱은 v2(L1·L2).

## 9. 단계 (단계별 커밋)
1. **규칙 + load-bearing 3건(P1·P2·P3)**: §4-1·§4-2·§4-4 규칙 + §5-2 commentSessionId 포인터 + §5-3 `mapDoc` 'comment' 보존 + §5-1 `watchTabBlocks` 신설 + `types/problem.ts`에 `publishedAt`·`commentSessionId` 필드 추가(B4). **mapDoc 수정 후 기존 댓글/AI 배지·`countAgentSessions` 회귀 재검증.** 규칙 스모크 테스트. **이 단계를 먼저 배포·검증한 뒤 다음 진행(A2).**
2. **통합 리스트**: `WebShareList`→`PublishList`(스냅샷+실시간, 방식 배지, publishedAt 정렬), ShareTree/AppShell 라벨 "문항 공개".
3. **오너 UI**: ShareSettingsPanel "문항 공개"(방식 라디오+실시간 토글, publishedAt 조건부 스탬프, 공개 토글 시 `ensureCommentSession` 선제 호출, 멤버 댓글 공개 노출 안내).
4. **Live 뷰어**: `app/p/[problemId]` 서버 컴포넌트(generateMetadata/OG, REST+no-store) + client `PublicProblemView`(`watchTabBlocks`, 읽기전용 댓글, 비공개 안내).
5. **읽기전용 댓글 렌더**: `isCommentStream`(problem.commentSessionId) 필터로 오너/멤버 댓글만 표시, agent 메시지 제외, 작성 UI 없음.
6. **마감**: 비공개 전환 안내 + 회귀(멤버/스냅샷/댓글/AI 배지) 점검 + build + 규칙 배포 스모크.

## 10. 리스크 & 주의사항
- **P3 회귀(load-bearing)**: `mapDoc` 수정이 기존 댓글 필터·`countAgentSessions`·유령 카드에 영향. 1단계에서 반드시 재검증.
- **P2 실시간**: live 본문은 `watchTabBlocks` 신규 구독에 의존(기존 `getDocs`/`getPreviewBlocks` 재사용 불가).
- **AI 메시지 누출(D3)**: 규칙으론 세션 필터 불가 + read에 `isSignedIn`도 없어 **비로그인까지 규칙상 읽기 가능** → UI 필터(`isCommentStream`)에 전적으로 의존. 민감 문항 공개 금지 안내. 완전 차단은 agent 분리(별도 Phase).
- **P6 탭 가시성 결합**: `memberTabVisibility`가 멤버·공개 공용 → 멤버에 숨긴 탭은 공개에도 숨고, 그 반대 조합 불가(v1 수용, 알려진 제약).
- **댓글 공개 노출**: `commentsVisible` 기본 true·공용 필드라, 공개를 켜면 기존 멤버 댓글이 즉시 공개로 보인다(§6 안내로 완화). "공개 전용 댓글 OFF"는 v2.
- **P8 스팸**: 작성이 멤버 전용이라 공개 스팸 벡터는 작다. 멤버 작성에도 **클라 길이 캡**은 유지(비용 0). 서버 레이트리밋·신고/차단은 후속.
- **P9/B8 정렬·스탬프**: `updated_at` 대신 `publishedAt`. 일반 편집에 스탬프 금지, 비공개→재공개만 갱신(§6).
- **P10 단일 세션**: `/p`에 로그인 플로우가 없어 충돌 소멸. 단 오너가 자기 `/p`를 열어도 세션을 클레임하지 않는지(읽기 전용) 1회 확인.
- **regression**: 멤버 공유/스냅샷/기존 댓글 회귀 점검.
- **PublishList 댓글 수 비용**: 실시간 행마다 `tab_comments` 읽어 `countComments` → 공개 문항 많아지면 비용↑. v1 수용, 필요 시 펼침 lazy 로드.
- **신규 로그인 표시명(B5)**: 공개 뷰어는 읽기 전용이라 신규 작성자가 생기지 않음 → 표시명 fallback 이슈 **무의미(해소)**.
- **v2 스코프(명시)**: ① 문항별 동적 OG 이미지(미리보기 렌더), ② 본문 SSR 검색 인덱싱, ③ 멤버용≠공개용 탭/댓글 분리, ④ 공개 댓글 *작성* 개방(+서버 레이트리밋·신고/차단).

## 11. 수락 기준
- [ ] "문항 공개" 노드 하나에 스냅샷·실시간이 방식 배지로 한 리스트에 보임(publishedAt 정렬)
- [ ] 오너가 방식 라디오로 공개, 각 링크 발급
- [ ] 실시간: 비로그인 열람, 공개 탭 필터 적용, **편집 즉시 반영(`watchTabBlocks`)**
- [ ] **비로그인 포함 누구나** 댓글 **읽기** 가능, **agent 메시지 비노출**(`commentSessionId` 포인터 + `isCommentStream` 필터)
- [ ] 공개 뷰어에 **댓글 작성 UI 없음**(작성은 멤버가 에디터에서만)
- [ ] `mapDoc` 수정 후 에디터 댓글/AI 배지·`countAgentSessions`·유령 카드 회귀 없음
- [ ] 오너가 부적절 멤버 댓글 삭제(모더레이션), AI-삭제 분기 회귀 없음
- [ ] 공개 토글 시 `ensureCommentSession` 선제 호출로 `commentSessionId` 채워짐
- [ ] `publishedAt`: 최초 공개 1회 스탬프, 일반 편집 시 불변, 재공개 시 갱신
- [ ] `/p/{id}` 메신저 공유 시 OG 링크 카드(제목/설명/고정 이미지) 노출 (검색 본문 인덱싱은 v1 비목표)
- [ ] 비공개 전환 후 재공유 시 OG 메타가 stale하지 않음(`cache: 'no-store'`)
- [ ] 비공개 전환 시 뷰 차단 + 안내
- [ ] build 통과, 규칙 스모크 테스트 통과, 기존 멤버/스냅샷/댓글 회귀 없음

## 12. 커밋 & 푸시
- 구현·커밋까지만. `git push`·규칙 배포는 덕수가 직접. **규칙 변경 있음(§4-1·§4-2·§4-4)** → 배포 전 권한 스모크 테스트 필수.
