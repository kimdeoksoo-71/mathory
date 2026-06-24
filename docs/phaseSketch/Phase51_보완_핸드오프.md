# Phase 51 보완 메모 — §5-4(SSR/OG) · 운영정책 · 수락기준 패치

> 대상: `Phase51_문항_공개_실시간_로그인_댓글.md`(개정본)의 외부 코드대조 검토 잔여 지적.
> 본 문서는 개정본을 **대체하지 않고 보강**한다. 적용 위치를 각 항목 머리에 명시한다.
> 검토 기준 커밋: `455df4b`(clone 시점). 레포 대조 결과를 file:line으로 명시한다.

---

## 0. 레포 대조로 확정된 사실 (구현 전 재확인 불요)

이 메모의 지적은 아래 코드 사실에 근거한다. CLI는 실제 파일에서 동일한지만 1회 확인하고 진행한다.

- `package.json` — `"firebase": "^12.9.0"`, **`firebase-admin` 미설치**. → 서버 generateMetadata는 admin SDK 불가, **Firestore REST**로만 가능.
- `types/problem.ts:3` — `title: string`(존재). `thumbnail`/`coverImage`/`description` **필드 없음**. → OG 썸네일의 데이터 소스가 없음.
- `lib/firebase.ts:8` — `projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`. → 서버에서도 `NEXT_PUBLIC_*`이라 접근 가능.
- `components/comment/CommentPanel.tsx:223` — `ensureCommentSession`은 **`isCommentsMode && isOwner && !commentSession`일 때만** 실행. 즉 오너가 댓글 패널을 처음 열 때 1회. 실시간 공개만 켜고 패널을 안 열면 `commentSessionId` 미설정.
- `firestore.rules` — `commentsVisible()`/`commentsWritable()` = `parentData().get(..., true) == true` → **미설정 시 기본 true(허용)**. 멤버·공개 **공용 필드**(공개만 따로 기본 OFF 불가).
- `app/p/` — **부재(신규 생성)**.
- Next.js 14 App Router — 서버 `fetch`는 **기본 캐시**(force-cache 성격). 명시적 `cache: 'no-store'` 없으면 stale.

---

## 1. 잠금 결정 (lock — CLI 임의 선택 금지)

개정본 §5-4가 "썸네일/검색 미리보기"를 약속했으나 데이터·렌더 구조상 불가/오해 소지가 있다. 아래로 **확정**한다.

- **L1. OG 이미지 = 정적 기본 1장(v1).** 문항 대표 이미지 필드가 없으므로 본문 첫 이미지 추출 같은 동적 처리는 하지 않는다. `public/`의 고정 OG 이미지(로고+슬로건) 한 장을 사용. (본문 첫 이미지 활용은 v2 후속.)
- **L2. SSR 범위 = "메신저 링크 미리보기"로 한정.** 본문은 client `onSnapshot` 렌더라 검색엔진 본문 인덱싱은 v1에서 구조적으로 불가. `generateMetadata`가 제공하는 것은 OG 메타(카카오톡·메신저 링크 카드)뿐이다. **"검색 미리보기/검색 노출" 표현은 문서·수락기준에서 제거.** 본문 SSR(검색 인덱싱)은 v2 별도 스코프.

---

## 2. §5-4 대체 문안 (개정본 §5-4 통째 교체)

```markdown
### 5-4. SSR 메타데이터 / Open Graph (`app/p/[problemId]/page.tsx`, P7)
`/p/[problemId]`를 **서버 컴포넌트**로 만들고 `generateMetadata`로 OG 태그(제목/설명/고정 이미지)를
주입한다. 목적은 **메신저 링크 미리보기**(카카오톡 등)다. 그 안에서 client `PublicProblemView`를 렌더한다.
> 본문은 client onSnapshot 렌더 → 검색엔진 본문 인덱싱은 v1 비대상(메타만 노출). 본문 SSR은 v2.

- 서버 read: firebase-admin 미설치 → **Firestore REST** 사용. 공개 문항은 world-readable이라
  비인증 REST 호출이 `isPublic()` 규칙을 통과한다.
  - URL: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/problems/${id}`
    (`projectId` = `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`)
  - 응답은 Firestore 특수 포맷 → `data.fields?.title?.stringValue`로 제목 추출.
  - **`fetch(url, { cache: 'no-store' })`** 필수 (Next14 기본 캐시 → 비공개 전환 후 stale 방지).
  - 비공개/삭제/권한거부면 메타 생략하고 기본값(서비스명) fallback.
- OG image: **정적 기본 1장**(`public/og-default.png` 등, 로고+슬로건). 문항별 동적 썸네일은 v2.
- 본문·댓글 onSnapshot은 client(`PublicProblemView`)에서.
```

### 2-1. CLI 구현 체크리스트 (위 문안의 기법 디테일)
- [ ] `generateMetadata`는 `async`로, REST fetch 실패/비공개 시 try/catch → 기본 메타 반환(절대 throw 금지, 페이지 전체가 죽음).
- [ ] REST 파싱은 옵셔널 체이닝(`?.`)으로 방어: `fields`, `title`, `stringValue` 어느 단계든 없을 수 있음.
- [ ] `(default)`는 URL 경로에 그대로 들어감(괄호 인코딩 불필요, 표준 Firestore REST 경로).
- [ ] `metadataBase` 설정(`new URL('https://mathory.app')`)해야 상대 OG 이미지 경로가 절대 URL로 풀림.
- [ ] 페이지 컴포넌트(서버) → client `PublicProblemView`에 `problemId`만 전달, 데이터 fetch는 client에서.

---

## 3. 운영정책 보강

### 3-1. (§6에 한 줄 추가) 실시간 공개 토글 시 `ensureCommentSession` 선제 호출
`CommentPanel:223` 때문에 오너가 댓글 패널을 안 열면 `commentSessionId`가 비어, 공개 뷰어 필터가
포인터 없이 동작한다(공개 댓글은 null-sid라 표시되긴 하나, 오너/멤버 세션태깅 댓글 식별이 늦어짐).

```markdown
- 실시간 공개 ON 시 `ensureCommentSession(id, ownerUid)`를 1회 호출해 `commentSessionId`를
  공개 시점에 보장한다(§4-5/§5-2 포인터가 항상 채워짐).
```
> 동작상 필수는 아니나(없어도 깨지지 않음) 포인터 일관성을 위해 권장. ShareSettingsPanel 실시간 토글 핸들러에 추가.

### 3-2. (§6에 한 줄 추가) 공개 댓글 기본값 노출
`commentsVisible`/`commentsWritable`은 미설정=true, 멤버·공개 공용이라 공개만 기본 OFF 불가.
실시간 공개를 켜는 순간 낯선 로그인 사용자 댓글이 기본 허용된다.

```markdown
- 실시간 공개 UI에 댓글 허용/표시 토글을 **명시적으로 노출**해, 오너가 기본값(허용)을 인지하고
  켜도록 한다. (공개 전용 기본 OFF는 필드 공용이라 불가 — 알려진 제약, §10.)
```

---

## 4. 수락기준 패치 (§11)

- **수정**: `[ ] /p/{id} 공유 시 OG 미리보기(제목/설명) 노출`
  → `[ ] /p/{id} 메신저 공유 시 OG 링크 카드(제목/설명/고정이미지) 노출` *(검색 인덱싱은 비대상으로 명기)*
- **추가**: `[ ] 비공개 전환 후 재공유 시 OG 메타가 stale하지 않음(no-store)`

---

## 5. 사소 / 후속 (v1 수용, 인지만)

- **publishedAt 갱신 정책**: `serverTimestamp()`로 1회 스탬프. 비공개→재공개 시 **갱신 권장**(리스트 상단 복귀). §3에 한 줄 명시.
- **PublishList 미해결 댓글 수**: 실시간 행마다 `tab_comments`를 읽어 `countComments` → 공개 문항이 많아지면 비용 증가. v1 수용, 필요 시 행 펼침 시 lazy 로드로 분리.
- **OG 이미지 동적 생성**(문항 미리보기 렌더)·**본문 SSR 검색 인덱싱**: v2 후속 스코프로 명시.

---

## 6. 1단계 영향 없음 확인

본 보완은 전부 **4단계(Live 뷰어/§5-4)·6단계(오너 UI/§6)** 범위다. load-bearing 3건(P1·P2·P3)이
들어가는 **1단계 규칙+lib 작업에는 영향이 없다.** 1단계는 개정본 그대로 진행 가능.
