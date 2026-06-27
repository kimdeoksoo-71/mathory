# Phase 52 — Bazaar: 문항 공개 → 공용 광장 개편 · **확정판**

> 공유·공개 시리즈(Phase 48~51)의 후속. Phase 51에서 "문항 공개"(스냅샷+실시간)를 1개념으로 통합했고, 이번에는 그 공개물을 **모든 로그인 사용자가 함께 탐색·소통하는 공용 광장 "Bazaar"**로 승격한다.
> 핵심: **(가) 전역 피드** + **(나) 해시태그·검색** + **(다) 공개 댓글 작성**(로그인 누구나) + **(라) 공개 뷰어 레이아웃 개편** + **(마) SNS 공유 v1**.
>
> **이 문서가 단일 진실(확정판).** `docs/phaseSketch/Phase52 …` 초안과 웹 Claude V2를 대체한다. CLI 레포 대조(dd5b2ae) + 에뮬레이터 규칙 테스트(29 케이스 통과) + 결정 로그(아래)를 반영했다. **1단계 규칙·타입·인덱스·테스트는 이미 구현·검증 완료**(§4·§12 상태표).

---

## 결정 로그 (2026-06-25 확정)

**1차 (구조)**
- **C1 — "Bazaar 등록"은 공개(visibility)와 별개의 명시적 행위.** 방향만 종속: *live 게시는 공개를 전제*(F1)하지만 *공개가 곧 게시는 아니다*. 전용 컬렉션 `bazaar_posts` 신설.
- **C2 — 뷰어 레이아웃 개편은 `/p`·`/shared` 둘 다 적용**(공통 컴포넌트화). **댓글 패널은 실시간(`/p`)에만**.
- **C3 — 공개 댓글 작성 = 로그인한 누구나.** 비로그인 읽기만. 오너 동결·삭제권으로 모더레이션.
- **게시 개수 제한** — 실시간 1 / 스냅샷 2(문항당). 초과 시 클라 차단(규칙 강제 불가, R3).
- **태그 = 해시태그 입력 / 정규화 배열 저장.** 검색 v1 = 제목(prefix)+닉네임(`nickname_lower`)+태그(array-contains). 본문 전문검색은 Phase 53.
- **사이드바 "문항 공개"(sent-web) → Bazaar로 흡수·승격**(트리 최상단). `PublishList` 기능은 Bazaar "내 게시물"로 이전.

**2차 (CLI 검토 D1~D5 + 웹 Claude 보완)**
- **D1 — 공개 댓글 기본 = opt-in. → N1 플래그 방식으로 확정.** 공개 작성 전용 필드 `Problem.publicCommentsEnabled`(기본 false)를 신설하고 공개 작성 규칙이 이를 요구. 멤버용 `commentsWritable`과 **분리**. ⇒ 1단계 규칙을 단독 배포해도 **기존 public 문항은 자동 개방되지 않는다**(테스트 #16). 3단계 등록 모달의 "공개 댓글 허용" 토글이 이 필드를 세팅.
- **D2 — 고아/끊긴 게시물 = cascade + 피드 필터.** visibility 해제·share revoke·문항 삭제 시 관련 `bazaar_posts` best-effort 삭제 + 피드에서 끊긴 행 숨김(F1·F2). **N4: 피드 행마다 조인 read는 비싸므로 `bazaar_posts.hidden` 비정규화 불리언을 두고 cascade가 갱신, 피드 쿼리는 그 필드로 필터.** 조인검사는 폴백.
- **D3 — takedown(제3자 신고 + 관리자 삭제)를 Phase 52 1단계에 포함. → N2 재확정(A2, 2026-06-27).** "신고만 받고 조치 불가"인 중간 상태를 피하기 위해 `bazaar_reports` 컬렉션 + admin delete를 **함께** 1단계에 둔다(§4-4). 관리자는 **`admins/{uid}` 컬렉션 + `exists()` 체크**로 식별 — uid를 규칙에 하드코딩하지 않아 public 레포 비노출, 추가/제거는 콘솔에서(규칙 재배포 불요). 오너 본인 삭제(중단)는 유지. ⇒ **에뮬레이터 37/37 통과.**
- **D4 — `/p` 댓글용 로그인은 메인 도메인 팝업/리다이렉트 후 복귀.** `/p` 인라인 로그인 지양(단일 세션 P10 재현 방지). `/shared`는 로그인 버튼 미노출.
- **D5 — 스냅샷 게시물 만료 = 무기한 기본, 사용자 명시 시에만 만료.** 만료 시 피드에서 자동 숨김.

**3차 (공유 전략 — OG/SNS)**
- **O1 — SNS 공유 버튼 v1을 Phase 52에 포함.** X intent + Web Share API + 링크복사(비용 0).
- **O2 — 카카오 SDK·`/shared` SSR 메타·동적 OG 이미지는 Phase 53으로 분리.**

**3차 보완 (CLI 재검토 N1~N4)**
- **N1** → D1 확정안(전용 플래그). **구현·검증 완료.**
- **N2** → **A2(2026-06-27)로 재확정: Phase 52 1단계에 포함.** `bazaar_reports`(신고 적재) + `bazaar_posts` admin delete 가지 + `admins/{uid}` 화이트리스트. **구현·검증 완료(37/37).** ~~(구안: Phase 53 이전)~~
- **N3** — `bazaar_posts` 형태 검증의 shareId 키 검사는 **테스트로 검증된 `('shareId' in bp().keys())` 형태로 확정**(맵 멤버십 형태 대신). **구현·검증 완료.**
- **N4** → D2에 반영(`hidden` 비정규화 필드). **3~4단계 구현.**

---

## 0. 선행 확인 (구현 전 반드시 읽을 것)

> CLI는 아래 파일을 현재 버전으로 직접 열어 라인 위치를 재확인할 것(dd5b2ae 기준, 편집 중 밀릴 수 있음).
> ⚠️ 환경: `npm run test:rules`는 firebase-tools가 **JDK 21+** 요구. java 8이면 `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="$JAVA_HOME/bin:$PATH" npm run test:rules`.

- `types/problem.ts` — `Problem`(`visibility`/`publishedAt`/`commentSessionId`/`commentsVisible`/`commentsWritable`/`tags`) 존재. `UserProfile.nickname_lower`(P48) 존재. **신규 `BazaarPost`·`BazaarMode` + `Problem.publicCommentsEnabled?`(N1) + `ProblemComment.authorName?`(F3) 추가 — 1단계 완료.**
- `firestore.rules`
  - `problems` read = `isOwner()||isPublic()||isMember()`, `isPublic()` 인증 불요. ✓
  - `tab_comments` create(인간) — 공개 가지 추가(§4-2). ✓ 완료
  - `tab_comments` read/delete = Phase 51 정책 유지(공개 읽기 + 오너 모더레이션 삭제). ✓
  - `shares` read = `if true`(nanoid 비밀 전제) → Bazaar 노출 시 비밀성 깨짐(R2).
  - 신규 `bazaar_posts` match(§4-1). ✓ 완료
  - 신규 `bazaar_reports` match + `admins/{uid}` + 전역 `isAdmin()` + `bazaar_posts` admin delete 가지(§4-4, A2). ✓ 완료
- `lib/firestore.ts` — `setProblemPublic`(L78, `visibility`+`publishedAt`), `watchProblem`(L271), `watchTabBlocks`(L300), `listProblems`(L116, **owner-scoped → 피드 불가**).
- `lib/shares.ts` — `createShare`(L124), `listSharesByOwner`(L172), `revokeShare`(L179, =문서삭제), `isShareExpired`(L183), `getShareByProblem`(L189). `ShareWithSnapshot`(L76).
- `lib/comments.ts` — `AddCommentInput`(L55)·`addComment`(L69, `resolved:false`/`authorType:'human'` 자동) → **`authorName` 추가(F3, 5단계)**. `mapDoc`(L27)에 `authorName` 매핑 추가(F3, 5단계). `watchAllComments`(L102)·`isCommentStream`(L140)·`buildThreads`(L184) 재사용.
- `lib/discussion-sessions.ts` — `ensureCommentSession`(L118, **오너 전용**, 멱등, `commentSessionId` 비정규화). **Bazaar 실시간 등록 시 오너 호출 보장(§6-2, load-bearing).** ⚠️ 기존 Phase 51 공개 플로우(`ShareSettingsPanel.tsx:117-119`)가 이미 호출하므로 기존 공개 문항은 `commentSessionId` 보유 — N1 플래그가 없으면 자동 개방됐을 지점.
- `lib/share-scope.ts` — `ShareScope`(L3) `received-all|received-by|sent-web|sent-by`. **`sent-web`→`bazaar` 교체(§5-2). 참조처(AppShell·ShareTree·shareScopeKey) 원자적 동시 수정(F8).**
- `components/layout/ShareTree.tsx` — `공유 보낸 문항` 아래 `문항 공개` SubRow(`sent-web`) 제거, **Bazaar ParentRow 최상단 신설(§5-1).**
- `components/layout/AppShell.tsx` — `loadData`(L156~) owner-scoped. `sent-web` 분기(L698~705) → `bazaar` 분기 `<BazaarView/>`.
- `components/share/PublishList.tsx` → Bazaar "내 게시물"로 흡수.
- `components/share/PublicProblemView.tsx`(`/p`)·`app/shared/[shareId]/page.tsx`(`/shared`, **현재 `'use client'`**) → 레이아웃 개편 + SNS 공유 버튼.
- `components/share/ProblemTabContent.tsx` — 탭 본문 공통 렌더러. 재사용.
- `components/share/PublicComments.tsx` — 읽기 전용 → 작성 UI(§7-2).
- `app/p/[problemId]/page.tsx` — `generateMetadata`(L29) 보유(정적 OG). `/shared`는 client라 메타 없음(§8-1).

---

## 1. 목표 & 비목표

**목표**
1. `공유` 트리 최상단 **Bazaar** 신설(`문항 공개` 승격·개명).
2. 자기 소유 문항을 Bazaar에 **등록/삭제**(실시간 1 + 스냅샷 2).
3. 전역 피드 + **태그·제목·닉네임** 검색/필터.
4. 공개 뷰어 **레이아웃 개편**(고정 헤더·2단·분리 스크롤·슬로건 이동·댓글 슬라이딩 패널[실시간만]).
5. **공개 댓글 작성**(로그인 누구나, opt-in 플래그).
6. **SNS 공유 버튼 v1**(X intent + Web Share API + 링크복사).

**비목표(Phase 53 후보)**
- 본문 전문검색 / 태그 다중 AND 서버쿼리(v1 단일 태그) / 카카오톡 리치 공유 / `/shared` SSR OG 메타 / 동적 OG 이미지.
- (참고) 제3자 신고·관리자 takedown은 **Phase 52 1단계에 포함됨**(A2 재확정). 신고 UI(신고 버튼)는 4~5단계, 관리자 콘솔/리스트는 Phase 53.

---

## 2. 단계 개요 (단계별 1커밋)

| 단계 | 내용 | 주요 파일 | 상태 |
|---|---|---|---|
| **1** | 규칙(`bazaar_posts`·공개 댓글 N1·`bazaar_reports`+admin takedown A2) + 모델·타입·인덱스·테스트 (**load-bearing**) | `firestore.rules`, `firestore.indexes.json`, `types/problem.ts`, `tests/firestore.rules.test.mjs` | **✅ 구현·검증 완료(37/37)** |
| **2** | 사이드바 Bazaar 승격 (sent-web 원자 제거, F8) | `ShareTree.tsx`, `share-scope.ts`, `AppShell.tsx` | 대기 |
| **3** | 등록/삭제 UI + 개수 제한 + 해시태그 + 세션 보장 + cascade(D2) | `lib/bazaar.ts`, `ShareSettingsPanel.tsx`/신규 `BazaarPublishModal.tsx` | 대기 |
| **4** | Bazaar 피드 + 검색/필터 (PublishList 흡수) + 피드 필터(D2/N4) | 신규 `BazaarView.tsx`, `lib/bazaar.ts`, `AppShell.tsx` | 대기 |
| **5** | 뷰어 레이아웃 개편 + 공개 댓글 작성 + SNS 공유 v1 | `PublicProblemView.tsx`, `app/shared/[shareId]/page.tsx`, 신규 `PublicViewerShell.tsx`·`ShareButton.tsx`, `PublicComments.tsx`, `lib/comments.ts` | 대기 |

> 1단계 없이 3~5단계 동작 불가. 규칙 롤백 비용이 크므로 1단계 단독 배포·검증 후 진행.

---

## 3. 데이터 모델

### 3-1. 신규 컬렉션 `bazaar_posts/{postId}`

```
mode: 'live' | 'snapshot'
problemId: string            // 원본 문항(정렬·중복검사·실시간 라우팅)
shareId?: string             // mode='snapshot'일 때만. live면 키 자체 없음(F7)
ownerUid: string
authorNickname: string       // 게시 시점 비정규화(R8: 닉 변경 시 stale)
authorNickname_lower: string // 검색용(= nickname_lower)
title: string                // 비정규화(R4: 원본 변경 시 stale)
title_lower: string          // 제목 prefix 검색용
tags: string[]               // '#' 제거·정규화. ≤10개(F7)
createdAt: Timestamp
expiresAt?: Timestamp | null  // snapshot 만료 동기화(D5). live는 null
hidden?: boolean             // N4: cascade가 세팅. 피드 쿼리 필터(끊긴 행 숨김)
```

라우팅: `live`→`/p/{problemId}`, `snapshot`→`/shared/{shareId}`.

### 3-2. `types/problem.ts` (1단계 완료)

```typescript
export type BazaarMode = 'live' | 'snapshot';

export interface BazaarPost {
  id: string;
  mode: BazaarMode;
  problemId: string;
  shareId?: string;
  ownerUid: string;
  authorNickname: string;
  authorNickname_lower: string;
  title: string;
  title_lower: string;
  tags: string[];
  createdAt: Date;
  expiresAt?: Date | null;
}
```
- `Problem`에 `publicCommentsEnabled?: boolean`(N1) 추가.
- `ProblemComment`에 `authorName?: string`(F3) 추가(기존 인터페이스에 **필드만 추가**, 재선언 아님).
- `hidden`은 3~4단계에서 `BazaarPost`에 추가(피드 필터 도입 시점).

### 3-3. 태그 정규화 (`lib/bazaar.ts` 단일 출처)

```
normalizeTag(raw): raw.replace(/^#/, '').trim().toLowerCase() → 빈 문자열 제외
parseTagInput(text): /[\s,]+/ 분리 → normalizeTag → 빈값·중복 제거 → 최대 10개
```
- 태그당 20자, post당 ≤10개(`array-contains-any` 한도). 표시 시에만 `#` 프리픽스.

### 3-4. 인덱스 (`firestore.indexes.json`, 1단계 완료)

복합 인덱스 3개:
- `bazaar_posts`: `tags(CONTAINS)` + `createdAt desc` (태그 필터)
- `bazaar_posts`: `ownerUid(==)` + `createdAt desc` (내 게시물)
- `bazaar_posts`: `authorNickname_lower(==)` + `createdAt desc` (닉네임 검색)

`createdAt desc` 단독·`title_lower` range는 단일필드 자동(미추가).
**⚠️ F4: 제목 prefix 검색**(`title_lower` 부등호)은 **`createdAt desc`와 동시 정렬 불가**(Firestore: 부등호 필드가 첫 정렬 키). → 4단계에서 "제목 검색 결과는 `title_lower` 정렬"로 수용하거나 클라 재정렬.
**N4**: `hidden` 도입 시 위 인덱스에 `hidden(==)` 선행 필드 추가 필요(피드/태그/내게시물 쿼리에 `where hidden == false` 결합).

---

## 4. 보안 규칙 (`firestore.rules`) — 검증 완료(에뮬레이터 37 케이스)

> **부분 머지 원칙(R1)**: `tab_comments` create 블록 통째 교체 금지. 공개 가지 1개만 머지.

### 4-1. 신규 `bazaar_posts` match (`shares` match 다음, F7+F1)

```
match /bazaar_posts/{postId} {
  function bp() { return request.resource.data; }
  function problemData(pid) {
    return get(/databases/$(database)/documents/problems/$(pid)).data;
  }
  function validCreateShape() {
    return bp().ownerUid == request.auth.uid
      && bp().mode in ['live', 'snapshot']
      && bp().problemId is string
      && bp().title is string
      && bp().title_lower is string
      && bp().authorNickname is string
      && bp().authorNickname_lower is string
      && bp().tags is list && bp().tags.size() <= 10
      && (
        (bp().mode == 'snapshot' && ('shareId' in bp().keys()) && bp().shareId is string)
        || (bp().mode == 'live' && !('shareId' in bp().keys()))
      );
  }

  allow read: if request.auth != null;

  allow create: if request.auth != null
    && validCreateShape()
    && problemData(bp().problemId).authorUid == request.auth.uid
    // F1: live 게시는 문항이 이미 공개 상태여야 함(스냅샷은 shares 자체가 비로그인 접근).
    && (bp().mode == 'snapshot'
        || problemData(bp().problemId).get('visibility', 'private') == 'public');

  allow update: if request.auth != null
    && resource.data.ownerUid == request.auth.uid
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['tags', 'title', 'title_lower']);

  // 삭제: 게시자 본인(중단) OR 관리자(takedown, A2 — §4-4).
  allow delete: if isAdmin()
    || (request.auth != null && resource.data.ownerUid == request.auth.uid);
}
```
> **N4 주의**: 피드 필터용 `hidden`을 3~4단계에서 도입하면, owner의 hidden 토글을 위해 update `hasOnly`에 `'hidden'` 추가 또는 cascade를 client write로 처리. cascade는 owner write라 owner 게이트로 충분.

### 4-2. `tab_comments` create — 공개 작성 가지 (C3·N1·F5·F6)

**(a) `tab_comments` match 헬퍼 추가** (`isCommentSessionRef` 정의 뒤):

```
// Phase 52(C3/F6): 공개 작성자는 문항 commentSessionId를 '정확히' 참조(null·agent 우회 차단).
function isThePublicCommentSession(sid) {
  return sid != null && sid == parentData().get('commentSessionId', null);
}
// Phase 52(N1): 공개 댓글 작성 전용 opt-in(미설정 = false). 멤버용 commentsWritable과 분리.
//   기존 public 문항은 이 필드가 없어 기본 차단(자동 개방 방지).
function publicCommentsEnabled() {
  return parentData().get('publicCommentsEnabled', false) == true;
}
```

**(b) 인간 댓글 분기에 OR 가지 추가** (기존 두 가지는 그대로):

```
&& (
  isOwnerCmt()
  || (isMemberCmt() && isCommenter() && commentsWritable()
      && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)))
  // Phase 52(C3): 공개 문항이면 로그인한 누구나 댓글 작성.
  //   N1: publicCommentsEnabled(전용 opt-in) — 기존 public 자동개방 차단·멤버와 분리.
  //   F5: commentsVisible까지 요구 — 숨긴 댓글을 못 읽으면서 쓰는 모순 방지.
  //   F6: 문항 commentSessionId 정확 참조(null·agent 세션 우회 차단).
  || (parentIsPublic() && publicCommentsEnabled() && commentsVisible()
      && isThePublicCommentSession(request.resource.data.get('discussionSessionId', null)))
)
```
- 비로그인은 `authorUid == auth.uid` 불일치로 자동 차단(읽기만).
- 멤버 가지는 `isCommentSessionRef`(legacy null 허용) 유지 → 회귀 방지. 공개 가지만 엄격(세션 정확·플래그·visible).
- `update`/`delete`는 Phase 51 정책 유지(변경 없음).

### 4-3. 검증 — 테스트 케이스(`tests/firestore.rules.test.mjs`, 37/37 통과)

시드: `pubBazaar`(commentSessionId=cs1, **publicCommentsEnabled=true**), `pubNoFlag`(플래그 없음=기존 public 시뮬), `pubHidden`(플래그 ON+visible=false), `otherPub`(타인소유), `bazaar_posts/seedLive`, `bazaar_posts/adminTarget`(takedown용), `admins/adminUid`, `bazaar_reports/seedReport`.

- 공개 댓글: **#12 플래그ON+세션일치+비멤버 로그인 허용(핵심)** / #13 비로그인 거부 / #14 잘못된 세션 거부(F6) / #15 sid=null 거부(F6) / **#16 플래그 없음 거부(N1 자동개방 차단)** / #17 visible=false 거부(F5)
- bazaar_posts: #18 public live 허용 / **#19 private live 거부(F1)** / #20 남의 문항 거부 / #21 snapshot+shareId 누락 거부(F7) / #22 live+shareId 거부(F7) / #23 snapshot은 private여도 허용 / #24 tags 11개 거부(F7) / #25 ownerUid 위조 거부 / #26 update tags만·mode 변경 거부 / #27 delete 본인만
- bazaar_reports(A2): #28 본인명의 신고 허용 / #29 reporterUid 위조 거부 / #30 비로그인 거부 / #31 비관리자 read 거부 / #32 관리자 read 허용 / #33 비관리자 delete 거부 / #34 관리자 delete 허용 / **#35 관리자 bazaar_posts takedown 허용**
- 기존 11 케이스 회귀 없음(특히 #7 비멤버 멤버전용 거부 유지).

### 4-4. 신규 `bazaar_reports` + `admins/{uid}` + 전역 `isAdmin()` (A2)

> 결정: takedown(신고 + 관리자 삭제)을 "신고만 받고 조치 불가"인 중간 상태 없이 **1단계에 함께** 도입(D3/N2 재확정). 관리자 식별은 `admins/{uid}` 존재 검사 — public 레포에 uid를 박지 않고 콘솔에서 관리.

**(a) 전역 헬퍼(문서 루트 `match` 직속, 모든 컬렉션 가시):**
```
function isAdmin() {
  return request.auth != null
    && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
```

**(b) `admins/{uid}` match (콘솔 전용):**
```
match /admins/{uid} {
  allow read, write: if false;   // 클라 차단. isAdmin()의 exists()는 read 규칙 우회.
}
```

**(c) `bazaar_reports/{reportId}` match (`bazaar_posts` 다음):**
```
match /bazaar_reports/{reportId} {
  allow create: if request.auth != null
    && request.resource.data.reporterUid == request.auth.uid
    && request.resource.data.postId is string;
  allow read, delete: if isAdmin();   // 일반 사용자는 자기 신고도 못 읽음
  allow update: if false;             // 신고 불변(재신고 = 새 문서)
}
```

**(d) `bazaar_posts` delete에 admin 가지 추가**(§4-1 반영): `allow delete: if isAdmin() || (본인)`.

> **배포 후 필수**: 덕수가 Firebase 콘솔에서 `admins/{본인uid}` 문서 1개 생성(빈 문서면 충분). 없으면 `isAdmin()`이 항상 false → takedown·신고열람 불가(신고 적재는 정상). uid는 채팅에 적지 않아도 됨.

---

## 5. 사이드바 + 피드 (단계 2·4)

### 5-1. ShareTree — Bazaar ParentRow 최상단
`공유` 헤더 아래, `공유 받은 문항`보다 위에 Bazaar ParentRow. 하위 SubRow 2개(`전체`/`내 게시물`) 권장. 기존 `문항 공개`(sent-web) SubRow 제거.

### 5-2. share-scope (F8: 원자적 동시 수정)
`ShareScope`에서 `{ kind:'sent-web' }` 제거 → `{ kind:'bazaar'; filter?:'all'|'mine' }`. **`shareScopeKey`·`AppShell`·`ShareTree` 참조를 같은 커밋에서 동시 수정**(미수정 시 타입·빌드 깨짐). 2단계 수락기준에 "빌드 통과" 포함.

### 5-3. AppShell
`sent-web` 분기(L698~705) 제거 → `bazaar` 분기 `<BazaarView/>`. `webShares`/`PublishList` 의존을 BazaarView "내 게시물"로 이동.

### 5-4. 신규 `BazaarView.tsx`
- 상단: 검색(제목/닉네임) + 태그 칩 + `전체 | 내 게시물` 토글.
- 피드: `listBazaarFeed`(`orderBy createdAt desc, limit 20`, `startAfter`). **피드 필터(D2/N4)**: `where hidden == false`로 끊긴 행 숨김(비정규화). 조인검사는 폴백.
- 행: 방식 배지(실시간/스냅샷) + 제목 + 닉네임/아바타 + 태그칩 + 작성일 + **공유 버튼(§7-3)**. 클릭 → 라우팅.
- "내 게시물": `where ownerUid==uid` → 중단(삭제)·링크복사·스냅샷 만료칩(PublishList 흡수). `useCommentCounts`로 실시간 행 미해결 댓글 수.

### 5-5. 신규 `lib/bazaar.ts`
```
normalizeTag / parseTagInput
createBazaarPost(input)        // 개수 제한 검사(countOwnerPosts) + 닉네임 비정규화
deleteBazaarPost(postId)
updateBazaarTags(postId, tags)
listBazaarFeed({ cursor?, tag?, ownerUid?, nickname?, titlePrefix? })  // hidden==false 결합
countOwnerPosts(problemId, mode)
cascadeOnUnpublish(problemId)  // D2/N4: visibility 해제·share revoke·문항삭제 시 관련 post hidden/삭제
```

---

## 6. 등록 진입점 + 세션 보장 (단계 3)

### 6-1. 등록 UI (`BazaarPublishModal.tsx` 또는 `ShareSettingsPanel` 내 섹션)
- 방식 선택:
  - 실시간: `setProblemPublic(true)` 보장 → `ensureCommentSession` → `createBazaarPost({mode:'live'})` (순차 await — F1 규칙이 public을 요구하므로 순서 필수).
  - 스냅샷: `createShare(...)` → `createBazaarPost({mode:'snapshot', shareId})`. 만료 기본 무기한(D5).
- 해시태그 입력(`parseTagInput`) — 게시 시 + 사후 편집.
- **"공개 댓글 허용" 토글(D1/N1)** → `Problem.publicCommentsEnabled` 세팅. 기본 OFF.
- 개수 초과 시 안내문(스냅샷 2 / 실시간 1).
- **닉네임 게이트(B3, 3단계 클라 강제)** — 등록 진입 시 `UserProfile.nickname`이 미설정/기본값이면 **등록 차단 + 닉네임 설정 유도**. `bazaar_posts.authorNickname`/`_lower`가 게시 시점 비정규화(R8)이므로, 고유 닉이 없으면 닉네임 검색이 기본값끼리 충돌·표시가 빈약해짐. `createBazaarPost`가 닉 보유를 선결 검사(Phase 48 `nicknames` 예약으로 전역 유일성 보장). 규칙으로는 닉 고유성 강제 불가 → 클라 게이트.
- `lib/comments.ts` `addComment`·`mapDoc`에 `authorName` 배선(F3).

### 6-2. 댓글 세션 보장 (load-bearing for C3)
실시간 게시 시 오너 측 `ensureCommentSession(problemId, ownerUid)` 호출(멱등) → `commentSessionId` 비정규화. **누락 시 `isThePublicCommentSession`이 항상 false → 공개 작성 거부.** 게시 플로우에 필수 포함.

---

## 7. 뷰어 레이아웃 개편 + 공유 (단계 5)

### 7-1. 공통 셸 `PublicViewerShell.tsx`
`/p`·`/shared` 중복 헤더·레이아웃 추출. props `{ title, tabs, tabBlocks, commentsSlot?, shareSlot }`.
- **고정 헤더(4.3)**: `position: sticky; top:0`. 로고만(슬로건 제거). 제목 바 고정.
- **슬로건 이동(4.5)**: 헤더에서 제거(두 파일 동시), 풀이 단 하단 재배치.
- **2단(4.2)**: visibleTabs 정확히 2개면 좌(문제)·우(풀이). 1·3+탭은 단일+탭버튼 폴백(A3·R7). 좁을 때 1단+탭버튼.
- **분리 스크롤(4.4)**: `height: calc(100dvh - headerH)` flex 행, 각 단·패널 독립 `overflow:auto`.
- **댓글 슬라이딩 패널(4.1)**: 우측 토글(말풍선) → 3단. **실시간만**(C2).

### 7-2. 공개 댓글 작성 `PublicComments.tsx`
- 하단 작성 입력창:
  - 비로그인: "댓글을 쓰려면 로그인" + 로그인 버튼(**메인 도메인 팝업/리다이렉트, D4**).
  - 로그인: `LatexInputEditor` 재사용 → `addComment({ problemId, tabId:'', authorUid, content, authorName, discussionSessionId: commentSessionId })`.
  - `publicCommentsEnabled === false`(또는 `commentsVisible===false`): 입력창 숨김 + 안내.
- 표시: `authorName` 우선 → 프로필 백필 → '익명'.

### 7-3. SNS 공유 버튼 v1 `ShareButton.tsx` (O1)
뷰어 헤더 + 피드 행 배치. **비용 0**(키·도메인 등록 불필요):
```
onShare():
  url = canonical(/p/{id} 또는 /shared/{shareId})
  data = { title, text: `${title} · Mathory`, url }
  if (navigator.share) navigator.share(data)            // 모바일 OS 시트(인스타·카톡 등)
  else 폴백: X intent / 링크복사
    X: https://twitter.com/intent/tweet?text=…&url=…&hashtags=tag1,tag2
    복사: navigator.clipboard.writeText(url)
```
- `navigator.share`는 사용자 클릭(transient activation) + HTTPS 필요. 데스크톱 빈약 → 폴백 노출.
- 1차 공유 대상 **실시간(`/p`)** — `/shared`는 SSR OG 없어 맨링크(§8, R9).

---

## 8. SNS 진입 & OG (Phase 53 분리)

- **8-1 현황**: `/p`는 `generateMetadata`로 정적 OG 1장. `/shared`는 `'use client'`라 SSR 메타 없음(SNS 카드 미생성) → Phase 53 server component 전환.
- **8-2 v1 채널**: X intent(0), Web Share API(0). 카카오 리치(앱키·도메인, 53), 인스타 직접공유 불가(R9).
- **8-3 동적 OG**: 정적 1장은 문항 미리보기 없어 클릭률 낮음. 공유 전략 채택 시 Phase 53에서 `@vercel/og` `ImageResponse`로 제목·핵심수식 렌더 우선 권고.

---

## 9. 리스크

- **R1 규칙 롤백**: 1단계 단독 배포. create 통째 교체 금지.
- **R2 스냅샷 비밀성**: shareId 노출 → "등록=명시적 공개" UI. 만료분 피드 숨김(D5).
- **R3 개수 우회**: 클라 검사. 우회 시 피드 중복뿐. v2 Cloud Function.
- **R4 live 제목 stale / R8 닉네임 stale**: 비정규화 → 원본 변경 시 어긋남. 클릭 시 뷰어가 최신. v2 동기화.
- **R5/D4 단일 세션 충돌**: `/p` 로그인 = 메인 도메인 팝업/리다이렉트.
- **R6 agent 메시지 노출**: 뷰어 `isCommentStream`로 UI 차단(Phase 51 방어 유지). 민감 문항 공개 금지 안내.
- **R7 N탭 2단**: 정확히 2탭만 2단. 1·3+ 단일 폴백.
- **R9 인스타·`/shared` 메타**: 인스타 직접공유 불가, `/shared` OG 없음 → v1 공유 `/p` 우선.

---

## 10. 수락 기준

**단계 1 (규칙·모델) — ✅ 완료(37/37)**
- [x] `bazaar_posts` create/update/delete 본인 소유만. private live 거부(F1), snapshot/live+shareId 정합(F7), tags≤10.
- [x] 공개+플래그ON+visible+writable·정확 commentSessionId 참조 시 비멤버 로그인 작성 성공.
- [x] sid=null·잘못된 세션·**플래그 없음(N1)**·visible=false 거부(F5·F6). 비로그인 거부, 읽기 성공.
- [x] **`bazaar_reports` 본인명의 신고 허용·위조/비로그인 거부, 관리자만 read/delete, 관리자 `bazaar_posts` takedown 허용(A2).**
- [x] 멤버/오너 기존 경로 회귀 없음.
- [ ] (배포) 1단계 규칙·인덱스 단독 배포 후 하드 리프레시. **+ 콘솔에서 `admins/{덕수uid}` 문서 생성(A2 takedown 활성화).**

**단계 2~3** — 트리 최상단 Bazaar, sent-web 제거 후 **빌드 통과(F8)** / 실시간 게시 시 `setProblemPublic→ensureCommentSession→createBazaarPost` 순서로 `commentSessionId` 채워짐 / 스냅샷 3·실시간 2 차단 + 안내 / 등록 모달 "공개 댓글 허용" 토글(D1/N1) / **닉네임 미설정 시 등록 차단·설정 유도(B3)** / 해시태그 `#a #b, c`→`['a','b','c']`.

**단계 4** — 타 사용자 게시물 피드 노출, 태그·닉네임·제목 검색 / 끊긴 행 숨김(D2/N4) / "내 게시물" 중단·복사(PublishList 흡수).

**단계 5** — 헤더 고정·슬로건 이동, 2탭 2단+분리 스크롤·1·3+ 폴백 / `/p` 댓글 패널·작성(닉네임 표시), `/shared` 패널 없음 / 공유 버튼 모바일 시트·데스크톱 X·복사 폴백.

---

## 11. 커밋 & 푸시

- 단계별 1커밋:
  - `Phase 52 1단계: bazaar_posts 규칙 + 공개 댓글 작성(N1·F1·F5·F6·F7) + 타입/인덱스/테스트` *(완료, 6e02bde)*
  - `Phase 52 1단계 보강: bazaar_reports·admin takedown(A2) + 닉네임 게이트 명문화(B3) + 문서 정정` *(이번 커밋 — 규칙·테스트·확정판 문서)*
  - `Phase 52 2단계: 사이드바 Bazaar 승격(sent-web 원자 제거)`
  - `Phase 52 3단계: Bazaar 등록/삭제 + 개수 제한 + 해시태그 + 세션 보장 + cascade`
  - `Phase 52 4단계: Bazaar 전역 피드 + 검색/필터 + 피드 필터`
  - `Phase 52 5단계: 공개 뷰어 레이아웃 개편 + 공개 댓글 작성 + SNS 공유 v1`
- **푸시는 덕수가 직접**. CLI는 커밋까지.
- 각 단계 후 `docs/roadmap.md` 갱신. 1단계 배포 후 하드 리프레시. 빌드 이슈 시 `rm -rf .next`. 인덱스 에러는 콘솔 링크로 생성.

---

## 12. 1단계 구현 상태 (2026-06-25, A2 보강 2026-06-27)

| 파일 | 변경 | 검증 |
|---|---|---|
| `firestore.rules` | `bazaar_posts` match + `tab_comments` 공개 가지 + 헬퍼(`isThePublicCommentSession`·`publicCommentsEnabled`) **+ 전역 `isAdmin()` + `admins/{uid}` + `bazaar_reports` match + `bazaar_posts` admin delete 가지(A2)** | 에뮬레이터 37/37 |
| `types/problem.ts` | `BazaarPost`·`BazaarMode` + `Problem.publicCommentsEnabled?` + `ProblemComment.authorName?` | tsc(가산 변경) |
| `firestore.indexes.json` | 복합 인덱스 3개 | — |
| `tests/firestore.rules.test.mjs` | 시드(+admin·report·adminTarget) + 26 케이스(공개댓글·bazaar_posts·**bazaar_reports A2**) | 37/37 |

> **남은 1단계 작업**: 덕수가 ① `firebase deploy --only firestore:rules,firestore:indexes`로 단독 배포 후 검증, ② **Firebase 콘솔에서 `admins/{본인uid}` 문서 1개 생성**(A2 takedown 활성화 — 없으면 신고 적재는 되나 열람·삭제 불가). 커밋(`Phase 52 1단계 …`)·푸시는 덕수.

---

## 부록 — Phase 53 묶음 (SNS·OG·모더레이션)

1. `/shared` SSR OG 메타(server component 전환) + 스냅샷 SNS 카드.
2. 동적 OG 이미지(`@vercel/og` `ImageResponse`).
3. 카카오톡 리치 공유(JS SDK + 앱키 + 도메인 2곳 등록).
4. ~~`bazaar_reports` + admin takedown~~ → **Phase 52 1단계로 당겨 구현 완료(A2, §4-4).** Phase 53에는 **관리자 콘솔/신고 리스트 UI**와 신고 사유 분류·중복 집계만 남김(규칙·적재는 52에서 완결).
5. (검토) 피드 이상 — 추천·정렬·랭킹.
