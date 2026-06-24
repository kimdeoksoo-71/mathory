# Phase 51 — 문항 공개: 스냅샷 + 실시간 + 로그인 댓글

> 공유 개편 후속. **Phase 50의 "웹에 공개(스냅샷)"를 흡수해, 하나의 "문항 공개" 개념으로 통합**한다.
> 핵심 추가: **(가) 실시간 공개**(원본 편집 즉시 반영) + **(나) 로그인 회원 댓글**. 비로그인 댓글은 범위 밖(D7).
> 번호: 기존 `Phase 51 수식 필기 입력` 스케치는 추후 덕수가 52로 이동 예정 → 이 문서가 **51**.
> **이 개정본은 외부(웹 Claude Code) 코드 대조 검토(P1~P10)를 반영했다.** load-bearing 3건(P1·P2·P3)을 1단계에 못박는다.

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
| 댓글 | 불가 | 로그인 시 가능 |
| 만료 | 있음(칩) | 없음(on/off) |

## 0. 선행 확인 (구현 전 반드시 읽을 것) — 코드 대조 완료

- `types/problem.ts` — `Visibility='private'|'link'|'public'`(존재), `commentsVisible`/`commentsWritable`(P47), `memberTabVisibility`. **`commentSessionId`·`publishedAt` 필드 신설(§3).**
- `firestore.rules`:
  - `problems` read = `isOwner()||isPublic()||isMember()`, `isPublic()` 인증 불요 → 비로그인 live 읽기 가능. ✓
  - 블록 서브컬렉션 read: public이면 블록 공개되나 **탭 필터가 멤버에게만 적용** → §4-1 보완.
  - `tab_comments` read = `isOwnerCmt()||(isMemberCmt()&&commentsVisible())` → §4-2 추가.
  - `tab_comments` create = 오너/commenter 멤버만(+AI는 오너) → §4-3 추가.
  - `tab_comments` delete = `(human&&본인)||(ai&&오너)` → §4-4는 **통째 교체 금지, human 분기에만 `||isOwnerCmt()` 머지**.
  - **`discussion_sessions` read = `isOwnerSess()||isMemberSess()`** → 공개 비멤버는 세션 못 읽음 → **P1: commentSessionId 포인터 비정규화(§4-5)**.
  - **`discussion_sessions` create = comment·normal 둘 다 `isOwnerSess()`** → 공개 작성자는 세션 생성 불가. 단 P4로 **세션 생성 자체가 불필요**(null-sid 경로).
- `lib/discussion-sessions.ts` — **P3 버그**: `mapDoc`의 `type: data.type==='public'?'public':'normal'`이 **`'comment'`을 `'normal'`로 뭉갬**. `CommentPanel`의 `find(type==='comment')` 항상 null, `countAgentSessions`(normal 카운트)가 댓글 세션 오인 가능 → §5-3에서 수정.
- `lib/firestore.ts` — **P2: 블록 `onSnapshot` 전무**(전부 `getDocs`). live 본문은 §5-1 `watchTabBlocks` 신설 필요. `/shared` 재사용은 **`TabContent` 렌더링만** 가능(스냅샷이라 live-read 0).
- `lib/comments.ts` — `isCommentStream(c, commentSessionId)`(P47), `watchAllComments`(댓글 실시간 구독 존재).
- `app/shared/[shareId]/page.tsx` — 스냅샷 뷰어(그대로). `TabContent` 패턴 재사용 대상.
- `lib/membership.ts` — `canComment`(owner/commenter만) → public 경로.
- `lib/session.ts` — 단일 활성 세션. 공개 뷰어 로그인과 충돌 여부 확인(P10).

## 1. 목표 & 비목표
**목표**: "문항 공개" 단일 개념(스냅샷+실시간 한 리스트) / 실시간 공개(비로그인 열람·편집 즉시 반영) / 로그인 댓글(비멤버 포함) / 오너 모더레이션·비공개.
**비목표**: 비로그인 댓글(D7) · 실시간 공동 편집 · agent 메시지 완전 차단용 컬렉션 분리(D3, 별도 Phase).

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
- **`publishedAt: Timestamp`(신설, P9)**: 실시간 공개 ON 시 1회 스탬프, 리스트 정렬용.
- **`commentSessionId: string`(신설, P1)**: `ensureCommentSession`이 1회 기록(§4-5/§5-2). public 뷰어가 problem 문서에서 읽어 `isCommentStream`에 사용.
- 공개 탭: `memberTabVisibility` 재사용(멤버·실시간 공통, §4-1). 스냅샷은 생성 시 `tabVisibility` 동결(기존).
- 댓글 정책: `commentsVisible`/`commentsWritable`(P47) 재사용.
- 비정규화 원칙(P49) 예외는 **`commentSessionId` 단일 포인터뿐** — 세션 리스트 쿼리 의미를 안 건드림. 댓글 수는 여전히 클라 계산.

## 4. 보안 규칙 변경 (`firestore.rules`)
> 적용 대상: `problems/{problemId}` 하위 match 블록. `isSignedIn()`은 상위 `problems` match에 정의돼 호출 가능. `parentIsPublic()`은 일반 서브컬렉션 match에만 있으니 **tab_comments match엔 별도 정의 추가**.

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

### 4-2. tab_comments 읽기 — 공개 + 로그인 (D2)
tab_comments match에 `parentIsPublic()` 정의 추가 후:
```
allow read: if isOwnerCmt()
  || (isMemberCmt() && commentsVisible())
  || (parentIsPublic() && isSignedIn() && commentsVisible());
```
⚠️ D3: 규칙 레벨에선 공개 로그인 사용자가 agent 메시지도 읽을 수 있음. 뷰어가 `isCommentStream`으로 UI 차단(§5). "민감 문항 공개 금지" 안내.

### 4-3. tab_comments 생성 — 비멤버 로그인 commenter (D2, P4 반영)
기존 **인간 댓글** create 그룹에 public 가지를 **OR로 추가**(AI 가지 그대로). author 본인·human·resolved=false 기존 조건 유지.
```
|| (parentIsPublic() && isSignedIn() && commentsWritable()
    && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)))
```
> **P4: `isCommentSessionRef(null)==true`** → 공개 댓글은 `discussionSessionId=null`(legacy 버킷)로 그냥 생성하면 됨. **세션 미리 만들 필요 없음.** non-null을 넘기면 `type=='comment'` 세션만 통과(agent 오염 차단). → §10의 "세션 생성 권한 (a)/(b)" 라인 **삭제**(불필요).

### 4-4. 모더레이션 — 오너 인간 댓글 delete 허용 (D4, P5 반영)
**기존 delete 규칙 통째 교체 금지.** AI-삭제(오너) 가지를 보존하고 인간 가지에만 `||isOwnerCmt()` 머지.
```
allow delete: if (
  resource.data.get('authorType','human') == 'human'
  && (resource.data.authorUid == request.auth.uid || isOwnerCmt())   // ← 오너 모더레이션 추가
) || (
  resource.data.authorType == 'ai' && isOwnerCmt()                   // ← 기존 유지
);
```
> 정책 변경: 기존 주석 "오너도 남의 댓글 삭제 불가"는 모더레이션 대상으로 **주석도 갱신**.

### 4-5. commentSessionId 포인터 — 규칙 변경 없음, 데이터/lib만 (P1 핵심)
공개 뷰어는 `discussion_sessions`를 못 읽으므로(read=owner/member), `isCommentStream` 필터가 댓글-세션 태깅 댓글을 식별 못 한다. **`problems/{id}.commentSessionId` 단일 포인터를 비정규화**해 public-readable한 problem 문서에서 읽게 한다.
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
현재 `type: data.type==='public'?'public':'normal'`이 'comment'를 'normal'로 뭉갬:
```ts
type: data.type === 'comment' ? 'comment'
    : data.type === 'public'  ? 'public'
    : 'normal',
```
> 수정 후 **회귀 확인 필수**: 에디터 agent 패널에 점령 "댓글" 카드가 없는지, `countAgentSessions`(normal 카운트)가 정확한지. 이 버그가 현재 댓글 필터를 "전부 null-sid라 우연히 동작"하게 만들고 있으니, 고친 뒤 기존 댓글/AI 배지 동작을 재검증한다.

### 5-4. SSR 메타데이터 / Open Graph (`app/p/[problemId]/page.tsx`, P7 — 2차 검토 반영)
`/p/[problemId]`를 **서버 컴포넌트**로 만들고 `generateMetadata`로 OG 태그(제목/설명/고정 이미지)를 주입한다. 목적은 **메신저 링크 미리보기**(카카오톡 등)다. 그 안에서 client `PublicProblemView`를 렌더.
> **범위 잠금(L1·L2):** ① OG 이미지는 **정적 기본 1장**(`public/og-default.png`, 로고+슬로건) — `types/problem.ts`에 thumbnail/description 필드가 **없어** 문항별 동적 썸네일은 데이터원이 없음(v2). ② generateMetadata가 주는 건 **OG 메타뿐** — 본문은 client `onSnapshot` 렌더라 **검색엔진 본문 인덱싱은 v1 비목표**(메신저 카드만). 본문 SSR(검색 인덱싱)은 v2.
- 서버 read: **firebase-admin 미설치(`firebase` ^12.9.0만)** → **Firestore REST**로만. 공개 문항은 world-readable이라 비인증 REST가 `isPublic()` 통과.
  - URL: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/problems/${id}` (`projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`, 서버 접근 가능). `(default)`는 경로에 그대로.
  - 파싱: `data.fields?.title?.stringValue` (옵셔널 체이닝 — `fields`/`title`/`stringValue` 어느 단계든 없을 수 있음).
  - **`fetch(url, { cache: 'no-store' })` 필수** — Next 14 서버 fetch 기본 캐시라, 비공개 전환 후 stale 방지.
  - `generateMetadata`는 `async` + try/catch로 실패/비공개 시 **기본 메타(서비스명) fallback**(절대 throw 금지 — 페이지 전체가 죽음).
  - `metadata.metadataBase = new URL('https://mathory.app')` 설정(정적 OG 이미지 경로가 절대 URL로 풀리도록).
- 본문·댓글의 onSnapshot은 client(`PublicProblemView`)에서. 페이지(서버)는 `problemId`만 전달.

### 5-5. 뷰어 동작 (`PublicProblemView`, client)
- `problems/{id}`(public read) 구독 + visible 탭마다 `watchTabBlocks` 구독 → 편집 즉시 반영.
- `TabContent`(/shared) 렌더 패턴 재사용: `EditorPreview borderless locale="ko"`, `ChoicesBlock`, `imageTreatmentStyle`.
- 댓글: `CommentPanel`(공개 commenter 모드). **`commentSessionId`는 problem 문서에서 읽어** `isCommentStream`으로 필터 → 오너/멤버 댓글 표시 + agent 메시지 제외. 공개 작성은 `discussionSessionId=null`(P4).
- 비로그인: 본문 + "댓글은 로그인 후"(Google 로그인). **P10**: 단일 활성 세션(`lib/session.ts`)과 충돌(에디터 탭 로그아웃) 여부 확인 — 공개 뷰어가 세션 클레임 경로에 안 들어가게.
- 비공개 전환: 구독 permission-denied → "비공개로 전환되었습니다" 안내.
- 헤더: /shared 뷰어와 동일 로고/슬로건(메인 통일 스타일).

## 6. 오너 UI (`ShareSettingsPanel` → "문항 공개")
- 현 '웹에 공개' 섹션을 **"문항 공개"**로 개편. 방식 **라디오: ○ 스냅샷으로 공개  ○ 실시간 공개**.
  - 스냅샷: 만료 프리셋(기본 무기한) → `createShare(...)` → `/shared/{id}`.
  - 실시간: `updateProblem(id,{visibility:'public', publishedAt})` → `/p/{id}`. 댓글 허용/표시 토글(`commentsWritable`/`commentsVisible`)을 **실시간 공개 UI에 명시 노출**(오너가 기본값=허용을 인지·끌 수 있게).
  - **실시간 공개 ON 시 `ensureCommentSession(id, ownerUid)` 1회 호출**(2차 검토): `CommentPanel:223`은 오너가 댓글 패널을 열 때만 세션을 만들므로, 패널을 안 열고 공개만 켜면 `commentSessionId`가 비어 §4-5 포인터가 늦게 채워진다. 공개 토글 핸들러에서 선제 호출해 포인터 일관성 보장(없어도 깨지진 않으나 권장).
- 공개 탭은 기존 "공유할 탭" 체크박스 공통. 라벨로 "스냅샷=동결 / 실시간=반영·댓글" 명시.
- 주의: `commentsVisible`/`commentsWritable`는 멤버·공개 **공용 필드**(기본 true) — "공개만 댓글 OFF" 같은 분리는 불가(§10 알려진 제약).

## 7. (참고) Phase 50 자산 개편 맵
`WebShareList`→`PublishList`(두 소스+방식 배지) · ShareTree/AppShell "웹에 공개"→"문항 공개" · ShareSettingsPanel '웹에 공개'→"문항 공개"(방식 라디오). 스냅샷 로직(`lib/shares.ts`, `/shared`)은 유지.

## 8. 결정 (확정)
- D1 public 블록 탭 필터 적용 · D2 public 댓글 read/create 추가 · D3 agent 누출=UI 필터 한정 · D4 오너 모더레이션 delete · D5 새 경량 PublicProblemView · D6 방식별 하위 노드 없음(단일 "문항 공개") · D7 비로그인 댓글 불가 · D8 스냅샷·실시간 "문항 공개" 통합 · **D9 `publishedAt` 스탬프로 live 정렬(P9)** · **D10 `/p` SSR+OG = 메신저 링크 미리보기 한정(정적 OG 이미지), 검색 본문 인덱싱은 v2(L1·L2)**.

## 9. 단계 (단계별 커밋)
1. **규칙 + load-bearing 3건(P1·P2·P3)**: §4-1~4-4 규칙 + §5-2 commentSessionId 포인터 + §5-3 `mapDoc` 'comment' 보존 + §5-1 `watchTabBlocks` 신설. **mapDoc 수정 후 기존 댓글/AI 배지 회귀 재검증.** 규칙 스모크 테스트.
2. **통합 리스트**: `WebShareList`→`PublishList`(스냅샷+실시간, 방식 배지, publishedAt 정렬), ShareTree/AppShell 라벨 "문항 공개".
3. **오너 UI**: ShareSettingsPanel "문항 공개"(방식 라디오+실시간 토글, publishedAt 스탬프), `canComment` public 경로.
4. **Live 뷰어**: `app/p/[problemId]` 서버 컴포넌트(generateMetadata/OG) + client `PublicProblemView`(`watchTabBlocks`, 비공개 안내).
5. **공개 댓글**: `CommentPanel` public 모드(problem.commentSessionId로 `isCommentStream` 필터, null-sid 작성), 클라 길이 캡(P8).
6. **마감**: 비공개 전환 안내 + 회귀(멤버/스냅샷/댓글/AI 배지) 점검 + build + 규칙 배포 스모크.

## 10. 리스크 & 주의사항
- **P3 회귀(load-bearing)**: `mapDoc` 수정이 기존 댓글 필터·`countAgentSessions`에 영향. 1단계에서 반드시 재검증.
- **P2 실시간**: live 본문은 `watchTabBlocks` 신규 구독에 의존(기존 `getDocs`/`getPreviewBlocks` 재사용 불가).
- **AI 메시지 누출(D3)**: 규칙으론 세션 필터 불가 → UI 필터 의존. 민감 문항 공개 금지 안내. 완전 차단은 agent 분리(별도 Phase).
- **P6 탭 가시성 결합**: `memberTabVisibility`가 멤버·공개 공용 → 멤버에 숨긴 탭은 공개에도 숨고, 그 반대 조합 불가(v1 수용, 알려진 제약).
- **P8 스팸**: 로그인 추적성 + 오너 모더레이션(D4) + **클라 길이 캡 + uid별 작성 쿨다운**(비용 0). 신고/차단·서버 레이트리밋은 후속.
- **P9 정렬**: `updated_at` 대신 `publishedAt`(편집마다 순서 튐 방지).
- **P10 단일 세션 충돌**: 공개 뷰어 로그인이 에디터 탭을 로그아웃시키지 않는지 확인.
- **regression**: 멤버 공유/스냅샷/기존 댓글 회귀 점검.
- **publishedAt 갱신 정책**: `serverTimestamp()` 1회 스탬프, 비공개→재공개 시 갱신(리스트 상단 복귀). §3 반영.
- **PublishList 댓글 수 비용**: 실시간 행마다 `tab_comments` 읽어 `countComments` → 공개 문항 많아지면 비용↑. v1 수용, 필요 시 펼침 lazy 로드.
- **v2 스코프(명시)**: ① 문항별 동적 OG 이미지(미리보기 렌더), ② 본문 SSR 검색 인덱싱, ③ 멤버용≠공개용 탭/댓글 분리, ④ 서버측 레이트리밋·신고/차단.

## 11. 수락 기준
- [ ] "문항 공개" 노드 하나에 스냅샷·실시간이 방식 배지로 한 리스트에 보임(publishedAt 정렬)
- [ ] 오너가 방식 라디오로 공개, 각 링크 발급
- [ ] 실시간: 비로그인 열람, 공개 탭 필터 적용, **편집 즉시 반영(`watchTabBlocks`)**
- [ ] 로그인 사용자(비멤버) 댓글 작성/조회, **agent 메시지 비노출(`commentSessionId` 포인터 필터)**
- [ ] `mapDoc` 수정 후 에디터 댓글/AI 배지 회귀 없음
- [ ] 오너 악성 댓글 삭제(모더레이션), AI-삭제 분기 회귀 없음
- [ ] `/p/{id}` 메신저 공유 시 OG 링크 카드(제목/설명/고정 이미지) 노출 (검색 본문 인덱싱은 v1 비목표)
- [ ] 비공개 전환 후 재공유 시 OG 메타가 stale하지 않음(`cache: 'no-store'`)
- [ ] 비공개 전환 시 뷰 차단 + 안내
- [ ] build 통과, 규칙 스모크 테스트 통과, 기존 멤버/스냅샷/댓글 회귀 없음

## 12. 커밋 & 푸시
- 구현·커밋까지만. `git push`·규칙 배포는 덕수가 직접. **규칙 변경 있음** → 배포 전 권한 스모크 테스트 필수.
