# Phase 49 — 공유 기능 확장개편 (B) : 좌측 공유 트리 · 모달 · 리스트 보기

> **공유 개편 3부작 중 2부.** Phase 48(A) 배포 후 진행. 웹 공개 UI 재배치는 Phase 50(C).
> 이 단계가 가장 크다. **데이터 모델은 거의 그대로 두고(결정 A: 탭 가시성 전역 유지), IA·UI만 재편**한다.

## 0. 선행 확인 (구현 전 반드시 읽을 것)

- `components/layout/Sidebar.tsx` — 현재 사이드바. `SHARED_WITH_ME_FOLDER_ID` 특수 폴더 렌더 패턴(≈969행)
- `components/layout/AppShell.tsx` — view 상태/라우팅, `sharedProblems` 로드(`listSharedWithMe`), folderCounts
- `components/problem/FolderView.tsx` — 카드 그리드, `isSharedWithMe` 분기
- `components/problem/ProblemView.tsx` — 우측 `SharePanel` 렌더(≈806행)
- `components/editor/SharePanel.tsx` — 제거·이전 대상(웹공개+멤버+탭가시성 통합 패널)
- `components/comment/CommentPanel.tsx` — `+ 새 토론` 버튼(≈974행), `isOwner`, `canComment`
- `lib/membership.ts` — A에서 추가된 `searchUsers`, `listSharedByMe`, 멤버 CRUD, `setMemberTabVisibility`
- `lib/comments.ts` — **현재 댓글 스키마 확인 필수.** `resolved` 제거가 반영됐는지 보고, 배지는 **전체 댓글 수**로 처리(미해결 카운트 아님)
- `lib/firestore.ts` — `duplicateProblem`, 특수폴더 상수, `listProblems`

## 1. 목표 (결정 반영)

1. 좌측 사이드바에 `My`와 대칭되는 **상위 카테고리 `공유`** 신설 + 사람별 트리.
2. 우측 `SharePanel` **제거** → 기능을 좌측 트리 + 공유 모달 + 문항 단위 공유설정으로 이전.
3. 공유 보낸 노드에 **`+` 버튼 → 받는 사람 검색 모달**(대화명/이메일). 이 모달이 **DnD 대안 경로**도 겸함.
4. **리스트 보기** 신설(단일 `ListView` 컴포넌트 + 맥락별 컬럼셋).
5. 토론/댓글 분리 및 agent 오너 전용화는 **Phase 46에서 별도 처리**(이 문서의 #7을 대체).

## 2. 좌측 `공유` 트리 구조

```
My                       (기존)
공유                      ★신규 상위 카테고리
├─ 공유 받은 문항          (집계 = 기존 SHARED_WITH_ME, 소유자 컬럼 노출)
│   ├─ [아바타] 대화명A    (authorUid 별 그룹)
│   └─ [아바타] 대화명B
└─ 공유 보낸 문항
    ├─ 웹에 공개           (shares where ownerUid==me)
    └─ 개인          [+]  ← 받는 사람 추가 버튼
        ├─ [아바타] 대화명C (memberUid 별 그룹)
        └─ [아바타] 대화명D
```

### 그룹핑 데이터 소스 (신규 컬렉션 없음)
- **받은·사람별**: `listSharedWithMe(uid)` 결과를 `authorUid`로 그룹 → 각 owner의 `UserProfile`(아바타+대화명) 조회.
- **보낸·사람별**: `listSharedByMe(uid)`(A에서 추가) 결과를 `memberUids` 펼쳐 recipient uid별로 그룹. 한 문항이 N명에게 가면 N개 노드에 등장.
- **웹에 공개**: `shares` `where(ownerUid==uid)`.

> UserProfile 다건 조회는 `getUserProfile`을 uid 집합에 대해 `Promise.all`로 캐시. 트리 렌더마다 재조회하지 않도록 AppShell 레벨에서 메모.

## 3. View 라우팅 (AppShell)

기존 `view: { type:'folder', folder }` 패턴을 확장한다. 권장:
```ts
type ShareView =
  | { type: 'share'; scope: 'received-all' }
  | { type: 'share'; scope: 'received-by'; ownerUid: string }
  | { type: 'share'; scope: 'sent-web' }
  | { type: 'share'; scope: 'sent-by'; recipientUid: string };
```
- 가짜 folder_id 남발 대신 명시적 `scope`를 권장(특수폴더 상수 패턴과 공존). 기존 `SHARED_WITH_ME_FOLDER_ID` 집계 뷰는 `received-all`로 매핑.
- 콘텐츠 영역은 scope에 맞는 problems/shares를 로드해 **ListView**(기본) 또는 카드로 렌더.

## 4. 받는 사람 검색 모달 (#3 + #6 DnD 대안)

`components/share/ShareTargetModal.tsx` (신규)
- 트리거: ① `공유 > 개인`의 `+` 버튼 ② My 카드/리스트 행의 **"공유" 액션** ③ My 문항을 `개인` 노드로 드롭(기존 DnD 유지 시).
- 흐름: 검색 입력(`searchUsers`, 2자↑, IME 가드) → 후보 리스트(아바타+대화명+이메일) → 선택 → **권한 선택(보기/댓글, 기본 댓글)** → 추가(`addMember(problemId, uid, role)`).
- 이미 멤버면 "이미 공유됨" 표시 + 권한 변경 제안.
- 모달 1개로 "신규 공유"와 "대상 추가" 모두 처리. 모달이 곧 DnD 없이도 공유를 거는 정식 경로 → **모바일/접근성 해결**.

## 5. 리스트 보기 (`ListView`)

`components/problem/ListView.tsx` (신규, 단일 컴포넌트). FolderView/공유뷰가 공용.

### 5-1. 컬럼셋 (메타 컬럼 없음 — 결정 반영)
| 컬럼 | My | 보낸·개인N | 받은(집계/사람별) | 웹에 공개 |
|---|---|---|---|---|
| 제목 (클릭=열기) | ● 편집 | ● 편집 | ● 보기 | ● 뷰어 |
| 소유자 | – | – | ●집계 / –사람노드 | – |
| 수정일 / 게시일 | 수정일 ● | 수정일 ● | 수정일 ● | **게시일** ● |
| 블록체인 배지 | ● | ● | ● | ● |
| 댓글 배지(**전체 수**) | ● | ● | ● | – |
| 권한(보기/댓글) | – | ● 편집(사람별) | ● 읽기전용(내 권한) | – |
| 공유 탭 | – | ● 읽기전용 칩(전역) | – | ● 읽기전용(스냅샷) |
| 만료 | – | – | – | (C에서) |
| 액션 | 공유·사본·삭제 | 공유 중단 | 공유 나가기 | (C에서) |

- **메타(과목/연도/유형/난이도) 컬럼은 넣지 않는다.**
- 행 클릭=열기. 모든 액션/풀다운 버튼은 `onClick`에서 `e.stopPropagation()`(dnd-kit 주의사항 동일 패턴).
- **헤더 클릭 정렬**: 제목, 수정일/게시일. 받은/보낸은 array-contains 쿼리라 **클라이언트 정렬**(기존 `listSharedWithMe` 방식).

### 5-2. 값 셀 동작
- **권한(보낸·개인N)**: 풀다운 `보기/댓글` → `updateMemberRole(problemId, recipientUid, role)`. **사람별**이라 정확.
- **공유 탭(보낸·개인N)**: **읽기전용 칩.** 전역(`memberTabVisibility`)이라 행에서 직접 못 바꿈. 칩 클릭 시 "공유 탭은 이 문항의 모든 공유 대상 공통입니다" 안내 + **문항 공유설정**(7절)로 유도.
- **내 권한(받은·개인N)**: `getMemberRole`로 읽기전용 표시(보기/댓글).

### 5-3. 액션 셀
- **My**: `공유`(ShareTargetModal) · `사본`(`duplicateProblem`) · `삭제`(휴지통 이동).
- **보낸·개인N**: `공유 중단` → `removeMember(problemId, recipientUid)`. 해당 사람 노드 리스트에서만 사라짐(그 grant만 해제).
- **받은·개인N / 집계**: `공유 나가기`(overflow) → `leaveAsMember(problemId, myUid)`. 확인 다이얼로그 후 목록에서 제거. 사본/삭제 없음(IP 보호).
- **웹에 공개**: 링크복사·공개중단 → Phase 50에서.

### 5-4. 댓글 배지 = 전체 댓글 수 (비용 주의)
N개 행마다 `tab_comments`를 세면 읽기 비용 폭증. **`problem.commentCount`(전체 댓글 수)를 비정규화**한다.
```
problems/{id}.commentCount: number   // 전체 댓글 수 (AI 포함 여부는 아래 결정)
```
- `lib/comments.ts`의 `addComment`에서 `increment(+1)`, `deleteComment`에서 `increment(-1)`로 갱신.
- **포함 범위:** **'댓글' 스트림만 카운트** — 즉 `authorType==='human'` & `discussionSessionId == null`인 사람 댓글만. agent(AI 세션) 메시지는 제외. (Phase 46의 댓글/agent 분리와 일치.) `addComment`/`deleteComment`가 이 조건일 때만 증감.
- 기존 문항 백필: `scripts/backfill-comment-count.ts`(1회성) — 각 문항 `tab_comments` 카운트 후 기록.
- 규칙: `commentCount`는 댓글 create/delete의 부수효과로 problem 문서를 갱신해야 하므로, 멤버(commenter)도 problem의 `commentCount`만 변경 가능하도록 **제한적 update 허용**이 필요. (아래 6절)

> **⚠️ 댓글 스키마 확인:** clone 시점 코드에 `resolved`가 남아 있었음. 현재 레포에서 `resolved`가 제거됐는지 `lib/comments.ts`·`types/problem.ts`를 먼저 확인하고, 배지는 **전체 수**로만 처리(미해결 카운트 로직에 의존하지 말 것).

### 5-5. 카드/리스트 토글
- FolderView 상단에 카드/리스트 스위치. 선택값 `localStorage`에 `mathory.viewMode.{scope}` 키로 기억.
- 기본값: **My·일반 폴더 = 카드**, **공유 보낸/받은 = 리스트**(컬럼이 많아 리스트가 적합).
- 일괄 선택/체크박스는 이번 범위 제외(후속).

## 6. 보안 규칙 — `commentCount` 부수 갱신 허용

`problems/{id}` update 규칙에, 댓글 작성 권한자가 **`commentCount`(+ `updated_at`)만** 바꾸는 경우를 허용 추가:
```
function isCommentCountBump() {
  return isSignedIn()
    && (isOwner() || isMember())
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['commentCount', 'updated_at']);
}
allow update: if isOwner() || isMemberSelfLeave() || isCommentCountBump();
```
> 대안: Cloud Function trigger로 서버측 집계(권한 표면 최소화). 다만 현 프로젝트는 Function 미사용 → 위 규칙 방식이 가벼움. 무결성은 클라이언트 신뢰에 의존하므로, 카운트는 표시용 캐시일 뿐 인가 판단에 쓰지 않는다.

## 7. SharePanel 제거 & 기능 이전

`SharePanel.tsx`가 담당하던 3기능을 이전한다.
| SharePanel 기능 | 이전 위치 |
|---|---|
| 멤버 추가/권한/제거 | ShareTargetModal + 좌측 보낸·개인 트리 + 리스트 행 |
| 웹 공개 생성/만료/링크 | Phase 50 (웹에 공개 노드 + 리스트) |
| 탭 가시성(전역) | **문항 단위 "공유 설정"** — 3점 메뉴 또는 문항 헤더에 "공유 설정" 진입점. `setMemberTabVisibility`로 전역 탭 토글. 라벨 "모든 공유 대상에게 공통 적용" 명시 |

- `ProblemView.tsx`(≈806)와 `components/editor/SharePanel.tsx` 참조 제거. ProblemView 우측은 토론 패널(CommentPanel)만 남김.
- 멤버/공유받은 사용자에게 편집 메뉴 숨기는 기존 분기(`ProblemView.tsx:438`)는 유지.

## 8. 토론/댓글 분리 → Phase 46로 이관

기존 통합 토론 패널을 **'댓글'(사람 전용)**과 **'agent'(오너↔AI)**로 분리하고, agent 버튼을 오너 전용으로 두는 작업은 **Phase 46 (댓글/agent 분리)** 문서에서 처리한다. (이 항목이 원래 담던 `+ 새 토론` 라벨변경·오너게이팅은 그 분리에 흡수됨.)

> 권장 진행 순서상 Phase 46을 이 문서(B)보다 먼저 끝내두면, 진입 버튼·패널 구조가 정리된 상태에서 B의 IA 작업을 얹을 수 있어 충돌이 적다.

## 9. 리스크 & 주의사항
- **교차영역 DnD(콘텐츠→좌측 트리)**: dnd-kit drop 영역 등록 필요. 구현 부담이 크면 **DnD는 후속으로 미루고 ShareTargetModal(버튼) 경로만 먼저** 완성해도 기능적으로 완결됨(#6 대안이 본 경로). 우선순위: 모달 > DnD.
- **사람별 트리 렌더 비용**: owner/recipient UserProfile 다건 조회는 캐시. 트리 펼침 시 lazy 로드 허용.
- **한 문항 N노드 등장**: 보낸·개인에서 정상. 중단은 grant 단위라는 점 UI 카피로 분명히.
- **stopPropagation 누락 시** 행 클릭과 액션이 충돌. 모든 인터랙티브 셀에 적용.
- **CommentPanel 시그니처 변경 금지**: `isOwner`/`canComment` prop은 이미 존재 — 버튼 가드에 그대로 사용. 다른 prop 드롭 주의(EditorView/ProblemView 양쪽 호출).

## 10. 수락 기준 (체크리스트)
- [ ] 좌측에 `공유` 상위 카테고리가 `My`와 대칭으로 보인다
- [ ] 받은·보낸이 사람별 노드(아바타+대화명)로 그룹된다
- [ ] `공유 > 개인`의 `+` → 검색 모달 → 대화명/이메일로 사용자 추가(권한 선택) 동작
- [ ] My 행/카드의 "공유" 버튼으로도 동일 모달이 열린다(DnD 없이 공유 가능)
- [ ] 리스트 보기: 메타 컬럼 없음, 제목/수정일/배지/맥락별 셀만 노출
- [ ] 댓글 배지가 전체 댓글 수를 표시(비정규화 카운트), 백필 스크립트로 기존 문항 반영
- [ ] 보낸·개인N 행에서 권한(사람별) 변경, 공유 중단(그 사람만 해제) 동작
- [ ] 받은 문항에서 "공유 나가기" 동작(`leaveAsMember`)
- [ ] 우측 SharePanel이 사라지고, 멤버/탭가시성 기능이 이전 위치에서 동작
- [ ] (토론/댓글 분리·agent 오너 전용은 Phase 46 수락 기준에서 검증)
- [ ] `npm run build` 통과 + 멤버/웹공유/댓글 회귀 없음

## 11. 커밋 & 푸시
- 구현·커밋까지만. `git push`/규칙 배포는 덕수가 직접.
- 규모가 크므로 단계별 커밋 권장: (트리) → (모달+멤버) → (ListView) → (SharePanel 제거). 각 커밋 후 빌드. (토론/댓글 분리는 Phase 46에서 별도.)
