# Phase 53 — Bazaar UI 개편방안 + OG 추가  (v2.1 · 2026-07-02 웹 검증·보강 반영)

> Phase 52(Bazaar) 구현 완료 후의 후속 개편. **Bazaar 페이지 디자인을 앱 공통 문법(아이보리 헤더 + U-프레임)으로 개편** + **`/p`·`/shared` 공개 열람을 MiniShell로 감싸 앱과 시각 통일(기존 공개 컴포넌트는 삭제하지 않고 리스타일)** + **OG는 이번 Phase에 `/shared` SSR 메타까지만(동적 OG 이미지는 후속)**.
> 기준 커밋: `01235b3`. 라인번호는 이 시점 기준 — CLI는 작업 전 각 파일을 직접 열어 재확인할 것.
>
> **v2 변경 요지(v1 대비):** ① 공개 뷰어 3종 "폐기·CommentPanel 이관" → **"삭제하지 않고 리스타일 유지"**(규칙 충돌·크래시 회피). ② OG **동적 이미지는 후속으로 연기**, 이번엔 SSR 메타 + 정적 이미지. ③ 단계 순서 재배치(**3 → 4 → 1·2**). ④ v1이 놓쳤던 firestore 규칙 제약을 §0에 명시.
>
> **v2.1 보강(웹 Claude 재검증 후):** v2의 규칙 제약·코드 사실 6건 레포 대조 검증 완료(전부 참 — 개정 타당). ⑤ **오너 편집 진입 확정**: `?view=p&id=` 딥링크 이번 구현, 오너 검증 후에만 ProblemView, 비오너는 `/p/{id}` 리다이렉트(§3-C). ⑥ **공개 뷰어는 '임베드 가능 형태'로 리스타일**(100dvh 전면 가정 제거 — §3-D·U6): 후속 Phase에서 앱 셸 내 임베드(풀 사이드바 열람, 원 스펙 1.2 회복)를 여는 포석.

---

## 결정 로그 (2026-07-02 최종)

- **U1 — 공개 열람 셸 통일(개정).** 비로그인·로그인-비멤버 방문자 모두 **MiniShell**(미니 사이드바: 공유>Bazaar만 — 기존 `/bazaar` 랜딩 패턴)로 감싼 **리스타일된 공개 뷰어**로 제자리 렌더. **풀 앱 리다이렉트는 오너 전용 "편집" 진입점으로 한정**(오너가 자기 문항을 열 때만 `/?view=...`). 근거: 공개 뷰어(`PublicComments`)는 이미 내부에서 `useAuth`로 로그인 사용자의 **댓글 작성**을 처리하므로(규칙 정합 스코프 쓰기), 로그인 사용자를 풀 앱으로 보낼 이유가 없다. 오히려 풀 앱의 `ProblemView`는 비오너·비멤버에게 **규칙상 깨진다**(§0 참조). "회원다움"(닉네임)은 쓰기 시점 닉네임 게이트(Phase 52 B3)가 담당하므로 열람 분기에 쓰지 않음.
- **U2 — 공개 뷰어 리스타일 유지(개정, v1 "폐기" 철회).** `/p`·`/shared` **URL 라우트·`generateMetadata`(OG)는 존치**(SNS 공유·기존 링크·메신저 미리보기 기반). **뷰어 컴포넌트도 삭제하지 않고 클레이 문법·`--bg-bazaar` 토큰·MiniShell로 리스타일**. `PublicViewerShell`의 "셸(사이드바·헤더) 역할"만 MiniShell로 대체하고, "콘텐츠 렌더(ProblemTabContent 기반) 역할"은 유지·리스타일. 통일감은 **프레젠테이션 레벨**에서 확보하고, 규칙 정합 데이터 경로(`watchCommentStream`, `problem.commentSessionId` 필드)는 **그대로 둔다**.
- **U3 — 공개 댓글은 기존 공개 컴포넌트(`PublicComments`) 유지·리스타일(개정, v1 "CommentPanel 이관" 폐기).** v1의 "댓글을 `CommentPanel` mode='comments'로 이관"은 **firestore 규칙과 정면충돌**해 폐기(§0-리스크). `PublicComments`는 규칙에 맞는 스코프 읽기·쓰기를 이미 구현하므로 로직은 그대로 두고 **겉모습만 클레이 문법으로 통일**. 로그인 사용자 작성(`authorName` 비정규화)·비로그인 읽기+로그인 버튼은 현행 유지.
- **U4 — Bazaar 페이지 디자인(유지).** 상단 아이보리 영역 2단(1단 타이틀 "Bazaar" / 2단 검색 바) + 그 아래 **U-프레임**: `borderTopLeftRadius/RightRadius: 10`(코드 대조 완료 — 실제 클레이 프레임 값이 **10**, `EditorView.tsx:2666` 주석의 "14px"는 stale), **테두리 없음**(기존 3면 보더 생략 — 배경색이 구분 담당).
- **U5 — Bazaar 영역 배경색 = 테라코타 워시 `#F2E3D5`(유지).** 강조색 `--accent-primary`(#c96442)의 저채도 틴트 — "Bazaar = 강조 공간" 위계를 색으로 전달, 클레이(`--bg-content` #F4EFE7)와 웜톤 조화. **하드코딩 금지, `globals.css`에 `--bg-bazaar` 시맨틱 토큰으로 정의.**
- **O3 — OG는 SSR 메타까지만(개정, 동적 이미지 연기).** 이번 Phase: ① **`/shared` SSR 메타**(`generateMetadata` — server/client 분리, `shares/{id}` REST → `snapshot.title`). ② `/p`는 기존 `generateMetadata` 유지 + **`og-default.png` 실제 파일 배치**(현재 404 상태 — §0). **동적 OG 이미지(`opengraph-image.tsx`/`next/og`)는 후속 Phase로 연기** — 폰트(한글 satori)·런타임 검증 필요. 후속 착수 시 카드 구성은 **제목·닉네임(프로필 사진 제외)·태그·브랜딩**(satori가 KaTeX 미지원이라 수식 제외). 카카오 리치 공유는 여전히 후속(외부 키).
- **U6 — 임베드 가능 리스타일 + 후속 임베드 포석(v2.1 신규).** 리스타일된 공개 뷰어(`PublicProblemView`+`PublicComments`)는 공개 read/write 규칙 가지 덕에 **로그인-비멤버에서도 완전 동작**한다. 따라서 후속 Phase에서 AppShell 콘텐츠 영역에 이 뷰어를 임베드하면(비오너에게 ProblemView 대신 공개 뷰어 렌더) **풀 사이드바 열람(원 스펙 1.2)을 규칙 무충돌로 회복**할 수 있다. 이번 Phase에서는 임베드를 막는 전면 가정(`100dvh` 등)만 제거해 포석을 깔고, 임베드 자체는 후속 소형 Phase.

---

## 0. 선행 확인 (코드 대조 완료 — 2026-07-02)

### 확인된 사실
- `lib/shares.ts` — **snapshot은 share 문서 내부 map**(`mapShareDoc`의 `snapshot: data.snapshot`, L46~57). 서브컬렉션 아님 → `/shared` OG 메타는 **`shares/{id}` REST 단일 GET**으로 `fields.snapshot.mapValue.fields.title` 파싱 가능(v1 R13 "2회 조회" 우려 해소).
- `app/p/[problemId]/page.tsx` — **server 페이지 + `generateMetadata`(L29)**. `fetchPublicTitle`이 Firestore REST(`cache:'no-store'`)로 `visibility=='public'` 확인 후 title 반환(L12~27). 이 REST 패턴을 `/shared` 메타에 복제. **현재 `OG_IMAGE = '/og-default.png'`(L5) 참조 파일이 `public/`에 없음 → 지금도 OG 이미지 404**. 정적 유지 결정에 따라 **덕수가 `public/og-default.png` 실제 배치 필요**.
- `app/shared/[shareId]/page.tsx` — **전체가 `'use client'`(L1)** → SSR 메타 불가. server `page.tsx`(신규 `generateMetadata`) + client 자식으로 분리 필요. `getShare`/`isShareExpired`(lib/shares.ts) 사용 중.
- `components/share/PublicComments.tsx` — **규칙 정합 데이터 경로의 표준**: 읽기는 `watchCommentStream`(스코프 쿼리, L41), `commentSessionId`는 **부모가 `problem.commentSessionId` 필드에서 받아 prop로 전달**(L27, `PublicProblemView.tsx:75`), 쓰기는 `addComment({ ..., authorName, discussionSessionId: commentSessionId, commentSessionId })`(L68~72). 내부에서 `useAuth`로 **로그인 사용자 작성 처리**(L31·L47~53·L57~61). → **이 컴포넌트는 익명 읽기 + 로그인 쓰기를 규칙 안에서 이미 지원.** 리스타일만 하면 됨.
- `components/share/PublicProblemView.tsx` — `problem.visibility !== 'public'`이면 안내(L27), `commentSessionId={problem.commentSessionId ?? null}`(L75), `writeEnabled={problem.publicCommentsEnabled === true}`(L76). 콘텐츠는 `commentsSlot`으로 `PublicComments` 주입.
- `components/share/BazaarView.tsx` — 현재 `<h2>`(L105) + 인라인 검색(L118~121)이 **스크롤 컨테이너(L104, `overflowY:'auto'`) 안에** 있음 → **아이보리 헤더(고정) / U-프레임(스크롤) 분리** 재구조 필요. h2Style에 "Bazaar · 내 게시물" 분기 이미 존재(L105). `/bazaar` 랜딩과 AppShell(`view.type==='share' && scope.kind==='bazaar'`) 양쪽에서 쓰이므로 **BazaarView 단일 수정으로 양쪽 반영**.
- `app/globals.css` — `--bg-functional` #FEFDFB(아이보리, L36), `--bg-content` #F4EFE7(클레이, L37), `--accent-primary` #c96442(L59). **`--bg-bazaar: #F2E3D5` 신규 추가.**
- `components/editor/EditorView.tsx:2673` — 클레이 U-프레임 실제 값 `borderTopLeftRadius: 10, borderTopRightRadius: 10`(라운드 **10** 확정).
- `app/bazaar/page.tsx` — 공개 랜딩. 미니 사이드바(로고·공유>Bazaar·전체·로그인 버튼)가 인라인 구현 → `components/layout/MiniShell.tsx`로 추출해 `/p`·`/shared` 비로그인 렌더에 공용.

### ⚠️ 규칙 제약 (v1이 놓쳐 개정을 유발한 핵심 — `firestore.rules`)
- **`discussion_sessions` read = 오너 OR 멤버만**(L300 `allow read: if isOwnerSess() || isMemberSess()`). → 익명·비멤버는 `listSessions()`(CommentPanel·ProblemView가 호출) **permission-denied**.
- **공개 `tab_comments` read = `commentStream == true` 필터 쿼리 강제**(L201~203 `parentIsPublic() && commentsVisible() && resource.data.commentStream == true`). → `watchAllComments`/`listAllComments`(CommentPanel·ProblemView가 호출하는 **비필터 전체 읽기**)는 익명·비멤버 **permission-denied**. 공개는 반드시 `watchCommentStream`.
- **공개 작성**(L223~225)은 `publicCommentsEnabled && commentsVisible && isThePublicCommentSession(discussionSessionId) && commentStream==true` 요구. `isThePublicCommentSession`은 `sid == parentData().commentSessionId`(L181~183) — 즉 **문항 문서의 `commentSessionId` 필드와 정확히 일치**해야 함(익명은 세션 목록을 못 읽으므로 이 필드 경유가 유일 경로).
- **결론:** `ProblemView`/`CommentPanel`은 `useAuth().user.uid`(예: `ProblemView.tsx:1016` `currentUid={user.uid}`)·`watchAllComments`(L196)·`listSessions`(L206)에 의존 → **익명이면 크래시, 로그인-비멤버면 permission-denied**. 그래서 v1의 "공개 열람에 ProblemView 재사용 / CommentPanel 이관"은 **불가**. 규칙에 맞는 것은 **기존 공개 컴포넌트(리스타일)** 뿐 → U2·U3 개정의 근거.

---

## 1. 목표 & 비목표

**목표**
1. Bazaar 페이지 디자인 개편(아이보리 2단 헤더 + `--bg-bazaar` U-프레임, radius 10, 무테) — `/bazaar` 랜딩·앱 내 양쪽 동일.
2. `/shared` SSR 메타 추가(server/client 분리) + `/p` `og-default.png` 실제 배치.
3. `MiniShell` 추출 후 `/p`·`/shared` 비로그인·비멤버 열람을 MiniShell로 감싸 앱과 시각 통일.
4. 공개 뷰어 3종(`PublicViewerShell`·`PublicProblemView`·`PublicComments`)을 **삭제하지 않고 클레이 문법으로 리스타일**(셸 역할은 MiniShell로 대체).

**비목표**
- **동적 OG 이미지(`opengraph-image.tsx`/satori)** — 후속 Phase(폰트·런타임 검증).
- 카카오 리치 공유(외부 키), 본문 전문검색, 큐레이션(채택·추천) — 후속.
- **`ProblemView`/`CommentPanel`의 공개·익명 개조** — 하지 않음(규칙 충돌). 로그인 사용자도 공개 문항은 리스타일된 공개 뷰어로 열람.
- 공개 뷰어 3종 삭제 — 하지 않음(리스타일 유지).
- **앱 셸 내 공개 뷰어 임베드**(풀 사이드바 열람 회복) — 후속 소형 Phase(이번엔 U6 포석만).

---

## 2. 단계 개요 (순서 재배치: 3 → 4 → 1·2)

| 단계 | 내용 | 주요 파일 |
|---|---|---|
| **A (구 3)** | Bazaar 디자인 개편(토큰·아이보리 헤더·U-프레임) — 독립·안전, 즉시 성과 | `globals.css`, `BazaarView.tsx`, `app/bazaar/page.tsx` |
| **B (구 4 축소)** | OG: `/shared` SSR 메타(server 분리) + `/p` `og-default.png` 배치. 동적 이미지 제외 | `app/shared/[shareId]/page.tsx`(server 분리), `public/og-default.png`(덕수) |
| **C (구 1)** | `MiniShell` 추출 + `/p`·`/shared` 비로그인·비멤버를 MiniShell로 통합 | `app/bazaar/page.tsx`→`components/layout/MiniShell.tsx`, `app/p/[problemId]/*`, `app/shared/[shareId]/*` |
| **D (구 2)** | 공개 뷰어 3종 리스타일(클레이 문법). **삭제 아님** | `PublicViewerShell.tsx`, `PublicProblemView.tsx`, `PublicComments.tsx` |

> A·B는 서로·C/D와 독립 → 병행 가능. C→D는 순서 의존(MiniShell이 먼저 서야 뷰어 리스타일이 그 안에 안착). **A부터 착수 권장**(충돌 0, 성과 확보).

---

## 3. 상세

### 3-A. Bazaar 디자인 개편 (단계 A)

- `globals.css`: `--bg-bazaar: #F2E3D5;` 추가(주석: "Bazaar 광장 영역 — 테라코타 워시, accent 저채도 틴트").
- `BazaarView` 재구조:
  - **아이보리 헤더(고정, `--bg-functional`)**: 1단 타이틀 "Bazaar"(내 게시물이면 "Bazaar · 내 게시물") / 2단 검색 바(현 L118~121의 select+input+button+필터칩을 헤더로 이동). `flexShrink:0`.
  - **U-프레임(스크롤 영역)**: `background: var(--bg-bazaar)`, `borderTopLeftRadius: 10, borderTopRightRadius: 10`, **테두리 없음**, `flex:1, minHeight:0, overflowY:'auto'` — 피드 표는 이 안으로. 현재 스크롤 컨테이너가 최상단(L104)이라 헤더/프레임 2분할로 재작성.
  - 행 배경(#fff 계열)·호버 색이 `#F2E3D5` 위에서 대비 유지되는지 확인.
- `/bazaar` 랜딩과 AppShell 내 렌더 양쪽 동일 적용(BazaarView 단일 수정으로 충족).

### 3-B. OG — SSR 메타 + 정적 이미지 (단계 B)

**(a) `/shared` SSR 메타** — `/p` 패턴(`page.tsx` L12~27 REST fetch) 복제:
- `app/shared/[shareId]/page.tsx`를 **server `page.tsx`(신규 `generateMetadata`) + client 자식**으로 분리. client 로직은 현행 그대로 자식 컴포넌트로 이동.
- `generateMetadata`: `shares/{shareId}` REST 조회(규칙 `allow read: if true`라 비인증 통과) → 문서 부재/만료(`expiresAt` 비교)면 기본 메타, 유효하면 `{snapshot.title} · Mathory`. **snapshot은 문서 내 map이므로** REST 응답의 `fields.snapshot.mapValue.fields.title.stringValue` 파싱(단일 GET). `cache:'no-store'`(만료 전환 후 stale 방지 — /p와 동일 근거).
- 이미지는 이번엔 `/og-default.png`(정적) 사용 — `/p`와 동일 키.

**(b) `/p` — `og-default.png` 실제 배치**:
- 현재 `page.tsx:5` `OG_IMAGE='/og-default.png'` 참조 파일이 없어 404. **덕수가 `public/og-default.png`(1200×630, 로고+슬로건) 배치** → `/p`·`/shared` 메타 이미지가 실제로 뜬다.

**(연기) 동적 OG 이미지** — 후속 Phase. 착수 시: `next/og` `ImageResponse`, `runtime='nodejs'`(폰트 fetch용), Pretendard subset `.ttf` 번들, 카드 = 제목·닉네임(사진 제외)·태그·브랜딩, satori 폰트 미로드 폴백(영문/정적). 비공개·실패 시 기본 구성 반환(R11).

### 3-C. MiniShell 추출 + 셸 통합 (단계 C)

- `app/bazaar/page.tsx`의 미니 사이드바(로고 → `공유` 라벨 → Bazaar 행 → 전체[·내 게시물] → 로그인 버튼)를 `components/layout/MiniShell.tsx`로 추출. props: `{ children, active?: 'bazaar' }`. `/bazaar`·`/p`·`/shared` 비로그인·비멤버 렌더가 공용. 콘텐츠는 `children`.
- **`/p/[problemId]`**(server `page.tsx` generateMetadata 존치): client 자식이 방문자를 `<MiniShell>`로 감싸 리스타일된 공개 뷰어(3-D) 렌더. 공개 문항이 아니면 안내("비공개 문항입니다").
- **`/shared/[shareId]`**(3-B에서 server 분리됨): client 자식이 `<MiniShell>` + 스냅샷 뷰어. 만료·부재 안내.
- **오너 전용 편집 진입점**: 방문자가 오너인 경우에만 헤더에 "편집" 버튼 → `/?view=...`(풀 앱). 비오너·비멤버·익명은 풀 앱으로 보내지 않음(규칙상 ProblemView가 깨지므로). `ShareButton`(SNS v1)은 공개 뷰어 헤더에 유지.
- **AppShell 딥링크 확정(v2.1)**: `?view=p&id=`를 이번에 구현하되 **오너 검증 후에만 ProblemView 열기**(`problem.authorUid === uid` 확인). **비오너·미로그인 접근 시 `/p/{id}`로 리다이렉트**(공개 뷰어 폴백 — 임의 딥링크 공유로 풀 앱이 깨지는 경로 차단). `/shared`의 "편집" 버튼은 share 문서의 `problemId` 원본 문항이 **존재할 때만 노출**(`getProblem` 실패 시 비노출 — 원본 삭제된 스냅샷 대응). (v1의 "비소유 공개 문항을 풀 앱으로 열기"는 규칙상 위험 → 채택 안 함.)

### 3-D. 공개 뷰어 3종 리스타일 (단계 D)

- **삭제 아님. 데이터 로직 불변, 스타일만 클레이 문법으로.**
- `PublicViewerShell.tsx`: 자체 사이드바·헤더 역할은 MiniShell로 대체(중복 제거), 콘텐츠 렌더(`ProblemTabContent` 기반)만 남겨 리스타일. 사실상 "얇은 콘텐츠 렌더러"로 축소.
- `PublicProblemView.tsx`·`PublicComments.tsx`: 배경(`--bg-bazaar`/`--bg-content`)·카드·타이포를 앱 토큰으로 교체. **`watchCommentStream`·`commentSessionId`(problem 필드)·`authorName` 로직은 그대로.**
- **임베드 가능 형태로(v2.1, U6)**: `PublicViewerShell.tsx:49`의 `height: '100dvh'` 등 전면(full-page) 가정을 `height: '100%'` + 상위 위임으로 교체 — 높이는 라우트 페이지의 100dvh 래퍼가 제공. 후속 앱 셸 임베드가 스타일 수정 없이 가능해진다.
- 리스타일 후 회귀 확인: 익명 읽기 / 로그인 작성(`authorName` 표시) / `writeEnabled=false`(publicCommentsEnabled·commentsVisible) 안내가 여전히 동작하는지.

---

## 4. 리스크 & 주의

- **R10 (규칙 경로 유지)**: 리스타일 시 `watchCommentStream`을 `watchAllComments`로 바꾸거나 `listSessions`를 끌어들이면 익명·비멤버가 깨진다. **데이터 훅은 절대 교체 금지** — 스타일만.
- **R11 (OG 캐시 stale)**: 동적 OG(후속)는 크롤러/메신저 캐시에 잔존 가능 — 비공개 전환 즉시 소거 불가. 이번엔 정적이라 무관, 다만 `/shared` 메타는 만료 후 `no-store`로 기본 메타 반환.
- **R12 (og-default.png 배치)**: 파일이 실제로 `public/`에 없으면 SSR 메타는 텍스트 카드만 뜨고 이미지 깨짐. **덕수 배치가 단계 B의 선결.**
- **R13 (server/client 분리 회귀)**: `/shared`를 server+client로 쪼갤 때 기존 로딩·만료·`ShareButton`·`OwnerBadge` 동작이 client 자식으로 온전히 이동했는지 확인.
- **R14 (BazaarView 양쪽 반영)**: 헤더/프레임 2분할이 `/bazaar` 랜딩과 AppShell 내부 양쪽에서 동일하게 보이는지(단일 컴포넌트라 자동이지만 스크롤 높이 계층 차이 주의).
- **레이아웃 손실 수용**: 구상안 v1의 "구 뷰어 폐기·CommentPanel 이관"은 규칙 충돌로 폐기(의도된 철회). 통일감은 리스타일로 달성.

---

## 5. 수락 기준

**단계 A (Bazaar 디자인)**
- [ ] `--bg-bazaar` 토큰 정의·적용. 아이보리 2단 헤더 고정, U-프레임(radius 10·무테) 스크롤.
- [ ] `/bazaar` 랜딩·앱 내 Bazaar 양쪽 동일 외관. 행·호버 대비 정상.

**단계 B (OG)**
- [ ] `/shared` 링크가 메신저/X에서 제목 카드 생성(유효 스냅샷), 만료·부재면 기본 메타.
- [ ] `public/og-default.png` 배치 후 `/p`·`/shared` 메타 이미지 정상 노출(404 해소).
- [ ] `/shared` server/client 분리 후 기존 로딩·만료·ShareButton·OwnerBadge 회귀 없음.

**단계 C (셸 통합)**
- [ ] 비로그인·로그인-비멤버 `/p/{공개문항}`: MiniShell + 리스타일 뷰어. 비공개면 안내.
- [ ] 비로그인·로그인-비멤버 `/shared/{유효}`: MiniShell + 스냅샷. 만료·부재 안내.
- [ ] 오너만 "편집" 진입점 노출. `?view=p&id=` 딥링크: 오너면 ProblemView, 비오너·미로그인이면 `/p/{id}` 리다이렉트.
- [ ] `/shared` 편집 버튼: 원본 문항 존재 시에만 노출(원본 삭제 시 숨김).
- [ ] ShareButton 동작, 뿌리는 URL은 여전히 `/p`·`/shared`.

**단계 D (리스타일)**
- [ ] 공개 뷰어 3종이 클레이 문법으로 통일. **데이터 훅(`watchCommentStream` 등) 불변.**
- [ ] 익명 읽기 / 로그인 작성(`authorName` 표시·정확한 `commentSessionId` 전달) / `writeEnabled=false` 안내 회귀 없음.
- [ ] 구 뷰어 3종은 삭제하지 않음(리스타일만). `CommentPanel`·`ProblemView`는 공개 경로에서 미사용 확인.
- [ ] 공개 뷰어에 `100dvh` 등 전면 가정 잔존 0건(임베드 가능 형태) — 높이는 라우트 래퍼가 제공.

---

## 6. 커밋 & 푸시

- 단계별 1커밋(권장 순서 A→B→C→D):
  - `Phase 53 A단계: Bazaar 디자인 개편 — --bg-bazaar 토큰·아이보리 헤더·U-프레임(U4·U5)`
  - `Phase 53 B단계: OG — /shared SSR 메타(server 분리) + og-default.png 정적(O3)`
  - `Phase 53 C단계: MiniShell 추출 + /p·/shared 비멤버 열람 셸 통합(U1)`
  - `Phase 53 D단계: 공개 뷰어 3종 클레이 리스타일(U2·U3)`
- **푸시는 덕수가 직접**. CLI는 커밋까지. 각 단계 후 `docs/roadmap.md` 갱신, 빌드 이슈 시 `rm -rf .next`. (`public/og-default.png` 배치는 덕수.)
