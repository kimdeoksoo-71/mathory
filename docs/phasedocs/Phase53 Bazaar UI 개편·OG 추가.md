# Phase 53 — Bazaar UI 개편방안 + OG 추가  (v2.2 · 2026-07-02 임베드 편입·OG 이미지 확보 반영)

> Phase 52(Bazaar) 구현 완료 후의 후속 개편. **Bazaar 페이지 디자인을 앱 공통 문법(아이보리 헤더 + U-프레임)으로 개편** + **`/p`·`/shared` 공개 열람을 MiniShell로 감싸 앱과 시각 통일(기존 공개 컴포넌트는 삭제하지 않고 리스타일)** + **OG는 이번 Phase에 `/shared` SSR 메타 + 확보된 정적 OG 이미지까지(동적 OG 이미지는 후속)** + **로그인 사용자용 앱 셸 내 공개 뷰어 임베드(step E, 스코프 가드)**.
> 기준 커밋: `01235b3`. 라인번호는 이 시점 기준 — CLI는 작업 전 각 파일을 직접 열어 재확인할 것.
>
> **버전 이력**
> - **v2:** 공개 뷰어 3종 "폐기·CommentPanel 이관" → **"삭제하지 않고 리스타일 유지"**(규칙 충돌·크래시 회피). OG 동적 이미지 후속 연기. 단계 재배치(3→4→1·2). §0에 firestore 규칙 제약 명시.
> - **v2.1(웹 Claude 재검증):** 규칙 제약·코드 사실 6건 대조 재확인(전부 참). `?view=p&id=` 딥링크는 오너 검증 후에만 ProblemView, 비오너는 `/p/{id}` 리다이렉트. 공개 뷰어를 '임베드 가능 형태'로 리스타일(100dvh→100%, U6)해 후속 임베드 포석.
> - **v2.2(현재):** ① **임베드를 후속 별도 Phase → 이번 Phase step E로 편입**(코드 대조로 규모 "중간" 판정, C 재작업 회피). 단 **A~D 안착·검증 후 착수, 부풀면 이연하는 스코프 가드**. ② **OG 이미지 확보됨**(1200×630 브랜드 카드) → step B는 "덕수 배치 필요"에서 "확보된 파일을 `public/og-default.png`로 배치"로 확정. ③ U6은 step D에서 수행(임베드 E의 선결).
> - **v2.3(C 착수 시점):** **모바일(휴대폰 크기) 적응은 후속 과제로 분리**(U8). C·D의 MiniShell(고정 232px 좌측 사이드바)은 **데스크톱·태블릿 기준**으로 구현 — 공유 링크가 주로 모바일에서 열리지만, 소형 화면 대응(사이드바 접힘/상단바 전환)은 구상이 더 여문 뒤 별도 Phase에서. 현재는 데스크톱·태블릿 완성도 우선.

---

## 결정 로그 (2026-07-02 최종)

- **U1 — 공개 열람 셸 통일(개정).** 비로그인·로그인-비멤버 방문자 모두 **MiniShell**(미니 사이드바: 공유>Bazaar만 — 기존 `/bazaar` 랜딩 패턴)로 감싼 **리스타일된 공개 뷰어**로 제자리 렌더(step C 기준). 풀 앱 리다이렉트는 오너 전용 "편집" 진입점으로 한정. 근거: 공개 뷰어(`PublicComments`)는 이미 내부에서 `useAuth`로 로그인 사용자의 **댓글 작성**을 처리하므로(규칙 정합 스코프 쓰기), 로그인 사용자를 풀 앱의 `ProblemView`로 보낼 이유가 없다(ProblemView는 비오너·비멤버에게 규칙상 깨짐 — §0). "회원다움"(닉네임)은 쓰기 시점 닉네임 게이트(Phase 52 B3)가 담당하므로 열람 분기에 쓰지 않음.
- **U2 — 공개 뷰어 리스타일 유지(v1 "폐기" 철회).** `/p`·`/shared` **URL 라우트·`generateMetadata`(OG)는 존치**. **뷰어 컴포넌트도 삭제하지 않고 클레이 문법·`--bg-bazaar` 토큰·MiniShell로 리스타일**. `PublicViewerShell`의 "셸(사이드바·헤더) 역할"만 MiniShell로 대체, "콘텐츠 렌더(ProblemTabContent 기반) 역할"은 유지·리스타일. 규칙 정합 데이터 경로(`watchCommentStream`, `problem.commentSessionId` 필드)는 **그대로 둔다**.
- **U3 — 공개 댓글은 기존 `PublicComments` 유지·리스타일(v1 "CommentPanel 이관" 폐기).** `PublicComments`는 규칙에 맞는 스코프 읽기·쓰기를 이미 구현 → 로직 그대로, **겉모습만 클레이 문법으로 통일**. 로그인 작성(`authorName` 비정규화)·비로그인 읽기+로그인 버튼 유지.
- **U4 — Bazaar 페이지 디자인(유지).** 상단 아이보리 2단(1단 타이틀 "Bazaar" / 2단 검색 바) + 그 아래 **U-프레임**: `borderTopLeftRadius/RightRadius: 10`(코드 대조 완료 — 실제 값 **10**, `EditorView.tsx:2666` 주석 "14px"는 stale), **테두리 없음**.
- **U5 — Bazaar 영역 배경색 = 테라코타 워시 `#F2E3D5`(유지).** `--accent-primary`(#c96442)의 저채도 틴트. 클레이(`--bg-content` #F4EFE7)와 웜톤 조화. **하드코딩 금지, `globals.css`에 `--bg-bazaar` 시맨틱 토큰.**
- **O3 — OG는 SSR 메타 + 확보된 정적 이미지까지(동적 이미지 연기).** 이번 Phase: ① **`/shared` SSR 메타**(`generateMetadata` — server/client 분리, `shares/{id}` REST → `snapshot.title`). ② `/p`는 기존 `generateMetadata` 유지 + **확보된 OG 카드(1200×630)를 `public/og-default.png`로 배치**(현재 404 해소). **동적 OG 이미지(`opengraph-image.tsx`/`next/og`)는 후속** — 폰트(한글 satori)·런타임 검증 필요. 후속 카드 구성은 제목·닉네임(사진 제외)·태그·브랜딩(satori KaTeX 미지원). 카카오 리치 공유는 후속(외부 키).
- **U6 — 공개 뷰어를 임베드 가능 형태로 리스타일(step D에서 수행).** `100dvh`/`100vh` 등 전면(full-page) 가정을 `height:100%` + 상위 위임으로 교체(높이는 라우트 페이지의 100dvh 래퍼가 제공). step E(임베드)의 선결.
- **U7 — 로그인 사용자용 앱 셸 내 공개 뷰어 임베드(v2.2 신규, step E · 스코프 가드).** 리스타일된 공개 뷰어가 로그인-비멤버에게도 규칙상 안전하게 동작함을 이용해, **AppShell 콘텐츠 영역에 공개 뷰어를 임베드**(비오너면 ProblemView 대신 공개 뷰어 렌더). 원 스펙 1.2("로그인 후: 좌측 사이드바 전체가 남는 페이지")를 문항 열람까지 규칙 무충돌로 회복. **A~D 안착·검증 후 착수하며, AppShell 작업이 부풀면 A~D만 배포하고 E는 이연**(A~D가 독립적으로 서므로 낭비 없음).

---

## 0. 선행 확인 (코드 대조 완료 — 2026-07-02)

### 확인된 사실
- `lib/shares.ts` — **snapshot은 share 문서 내부 map**(`mapShareDoc`의 `snapshot: data.snapshot`, L46~57). 서브컬렉션 아님 → `/shared` OG 메타는 **`shares/{id}` REST 단일 GET**으로 `fields.snapshot.mapValue.fields.title` 파싱 가능(v1 R13 "2회 조회" 우려 해소).
- `app/p/[problemId]/page.tsx` — **server 페이지 + `generateMetadata`(L29)**. `fetchPublicTitle`이 Firestore REST(`cache:'no-store'`)로 `visibility=='public'` 확인 후 title 반환(L12~27). 이 REST 패턴을 `/shared` 메타에 복제. **현재 `OG_IMAGE='/og-default.png'`(L5) 참조 파일이 `public/`에 없어 OG 이미지 404 → v2.2에서 확보된 카드 배치로 해소.**
- `app/shared/[shareId]/page.tsx` — **전체가 `'use client'`(L1)** → SSR 메타 불가. server `page.tsx`(신규 `generateMetadata`) + client 자식으로 분리 필요. `getShare`/`isShareExpired`(lib/shares.ts) 사용 중.
- `components/share/PublicComments.tsx` — **규칙 정합 데이터 경로의 표준**: 읽기 `watchCommentStream`(스코프 쿼리, L41), `commentSessionId`는 **부모가 `problem.commentSessionId` 필드에서 prop 전달**(L27, `PublicProblemView.tsx:75`), 쓰기 `addComment({ ..., authorName, discussionSessionId: commentSessionId, commentSessionId })`(L68~72). 내부 `useAuth`로 **로그인 사용자 작성 처리**(L31·L47~53·L57~61). → **익명 읽기 + 로그인 쓰기를 규칙 안에서 이미 지원**(step E 임베드의 근거).
- `components/share/PublicProblemView.tsx` — `problem.visibility !== 'public'`이면 안내(L27), `commentSessionId={problem.commentSessionId ?? null}`(L75), `writeEnabled={problem.publicCommentsEnabled === true}`(L76). **L86 `minHeight:'100vh'` = 전면 가정(U6 대상)**. 콘텐츠는 `commentsSlot`으로 `PublicComments` 주입.
- `components/share/PublicViewerShell.tsx` — **L49 `height:'100dvh'`(U6 대상)**. main flex 열·분리 스크롤 구조(L77·L111).
- `components/share/BazaarView.tsx` — h2(L105)+인라인 검색(L118~121)이 **스크롤 컨테이너(L104) 안** → 헤더 고정/프레임 스크롤 분리 재구조(step A). **행은 `<a href={path} target="_blank">`(L210), `path = post.mode==='live' ? '/p/'+problemId : '/shared/'+shareId`(L192)** → step E에서 `onOpenPost` 콜백으로 앱 내부 라우팅 흡수(콜백 없으면 기존 앵커 유지 = /bazaar 랜딩·익명).
- `app/globals.css` — `--bg-functional` #FEFDFB(L36), `--bg-content` #F4EFE7(L37), `--accent-primary` #c96442(L59). **`--bg-bazaar: #F2E3D5` 신규 추가.**
- `components/editor/EditorView.tsx:2673` — 클레이 U-프레임 실제 `borderTopLeftRadius: 10, borderTopRightRadius: 10`(라운드 **10** 확정).
- `components/layout/AppShell.tsx` — **`ViewState` 판별 유니온(L34~40: home·folder·share·problem·editor·new)**, `?view=bazaar` 파싱(L224~231), `type:'problem'` 콘텐츠 렌더 존재 → step E는 **콘텐츠 렌더에 오너/비오너 분기 + `?view=p&id=`·`?view=shared&id=` 파싱 추가**(국소 변경).
- `app/bazaar/page.tsx` — 공개 랜딩. 미니 사이드바 인라인 구현 → `MiniShell` 추출 원천(step C).

### ⚠️ 규칙 제약 (v1이 놓쳐 개정을 유발한 핵심 — `firestore.rules`)
- **`discussion_sessions` read = 오너 OR 멤버만**(L300). → 익명·비멤버는 `listSessions()`(CommentPanel·ProblemView 호출) permission-denied.
- **공개 `tab_comments` read = `commentStream == true` 필터 쿼리 강제**(L201~203). → `watchAllComments`/`listAllComments`(비필터 전체 읽기)는 익명·비멤버 permission-denied. 공개는 반드시 `watchCommentStream`.
- **공개 작성**(L223~225)은 `publicCommentsEnabled && commentsVisible && isThePublicCommentSession(discussionSessionId) && commentStream==true` 요구. `isThePublicCommentSession`은 `sid == parentData().commentSessionId`(L181~183) — 문항 문서 `commentSessionId` 필드와 정확 일치 필요.
- **결론:** `ProblemView`/`CommentPanel`은 `useAuth().user.uid`(예 `ProblemView.tsx:1016`)·`watchAllComments`(L196)·`listSessions`(L206) 의존 → 익명 크래시, 로그인-비멤버 permission-denied. v1의 "공개 열람에 ProblemView 재사용/CommentPanel 이관"은 불가. **규칙에 맞는 것은 공개 컴포넌트(리스타일)뿐이고, 그 컴포넌트는 로그인-비멤버에게도 동작하므로 step E 임베드의 대상이 된다.**

---

## 1. 목표 & 비목표

**목표**
1. Bazaar 페이지 디자인 개편(아이보리 2단 헤더 + `--bg-bazaar` U-프레임, radius 10, 무테) — `/bazaar`·앱 내 양쪽 동일.
2. `/shared` SSR 메타(server/client 분리) + `/p`·`/shared`에 확보된 정적 OG 카드 배치.
3. `MiniShell` 추출 후 `/p`·`/shared` 비로그인·비멤버 열람을 MiniShell로 감싸 앱과 시각 통일.
4. 공개 뷰어 3종을 **삭제하지 않고 클레이 문법으로 리스타일**(셸 역할은 MiniShell로 대체) + **임베드 가능 형태로(U6)**.
5. (step E·스코프 가드) 로그인 사용자에게 **앱 셸 내 공개 뷰어 임베드**로 원 스펙 1.2 회복.

**비목표**
- **동적 OG 이미지(`opengraph-image.tsx`/satori)** — 후속 Phase.
- 카카오 리치 공유(외부 키), 본문 전문검색, 큐레이션(채택·추천) — 후속.
- **`ProblemView`/`CommentPanel`의 공개·익명 개조** — 하지 않음(규칙 충돌). 임베드도 공개 뷰어를 얹는 방식.
- 공개 뷰어 3종 삭제 — 하지 않음(리스타일 유지).

---

## 2. 단계 개요 (A → B → C → D → E)

| 단계 | 내용 | 독립성 | 주요 파일 |
|---|---|---|---|
| **A** | Bazaar 디자인 개편(토큰·아이보리 헤더·U-프레임) | 독립 | `globals.css`, `BazaarView.tsx`, `app/bazaar/page.tsx` |
| **B** | OG: `/shared` SSR 메타(server 분리) + `public/og-default.png` 배치. 동적 이미지 제외 | 독립 | `app/shared/[shareId]/page.tsx`, `public/og-default.png` |
| **C** | `MiniShell` 추출 + `/p`·/shared 비로그인·비멤버 열람 통합 | C→D 순서 | `MiniShell.tsx`, `app/p/*`, `app/shared/*` |
| **D** | 공개 뷰어 3종 리스타일(클레이 문법) + **U6(임베드 가능 형태)**. 삭제 아님 | C 이후 | `PublicViewerShell.tsx`, `PublicProblemView.tsx`, `PublicComments.tsx` |
| **E** | (스코프 가드) 로그인 사용자용 앱 셸 내 공개 뷰어 임베드 + BazaarView 앱 내부 라우팅 | **D 이후·최후·이연 가능** | `AppShell.tsx`, `BazaarView.tsx` |

> A·B는 서로·C~E와 독립 → 병행 가능. **A부터 착수 권장**(충돌 0). E는 A~D 안착·검증 후 착수하고, AppShell 작업이 부풀면 **E만 이연**(A~D는 완결된 가치).

---

## 3. 상세

### 3-A. Bazaar 디자인 개편 (단계 A)

- `globals.css`: `--bg-bazaar: #F2E3D5;` 추가(주석: "Bazaar 광장 영역 — 테라코타 워시, accent 저채도 틴트").
- `BazaarView` 재구조:
  - **아이보리 헤더(고정, `--bg-functional`)**: 1단 타이틀 "Bazaar"(내 게시물이면 "Bazaar · 내 게시물") / 2단 검색 바(현 L118~121을 헤더로 이동). `flexShrink:0`.
  - **U-프레임(스크롤 영역)**: `background: var(--bg-bazaar)`, `borderTopLeftRadius: 10, borderTopRightRadius: 10`, **테두리 없음**, `flex:1, minHeight:0, overflowY:'auto'`. 현재 스크롤 컨테이너가 최상단(L104)이라 헤더/프레임 2분할로 재작성.
  - 행 배경(#fff 계열)·호버 색이 `#F2E3D5` 위에서 대비 유지되는지 확인.
- `/bazaar` 랜딩과 AppShell 내 렌더 양쪽 동일 적용(BazaarView 단일 수정).

### 3-B. OG — SSR 메타 + 확보된 정적 이미지 (단계 B)

**(a) `/shared` SSR 메타** — `/p` 패턴(`page.tsx` L12~27) 복제:
- `app/shared/[shareId]/page.tsx`를 **server `page.tsx`(신규 `generateMetadata`) + client 자식**으로 분리. client 로직은 그대로 자식 컴포넌트로 이동.
- `generateMetadata`: `shares/{shareId}` REST 조회(규칙 `allow read: if true`) → 부재/만료(`expiresAt` 비교)면 기본 메타, 유효하면 `{snapshot.title} · Mathory`. snapshot이 문서 내 map이므로 `fields.snapshot.mapValue.fields.title.stringValue` 파싱(단일 GET). `cache:'no-store'`.
- 이미지는 `/og-default.png`(정적) — `/p`와 동일 키.

**(b) `og-default.png` 배치** — **이미지 확보됨**(1200×630 브랜드 카드: 로고 "Mathory" + "Write the logic. Preserve the insight." + "수학 문항 저작·공유 플랫폼" + mathory.app):
- 파일을 **`public/og-default.png`로 배치**(현재 404 해소). 배치 후 `/p`·`/shared` 메타 이미지가 실제 노출.
- ⚠️ **바이너리 배치는 덕수 수작업**(CLI가 첨부 이미지를 직접 파일로 못 씀) — `public/og-default.png`로 저장. 배치 여부는 `ls public/og-default.png`로 확인.

**(연기) 동적 OG 이미지** — 후속 Phase. `next/og` `ImageResponse`, `runtime='nodejs'`, Pretendard subset `.ttf` 번들, 카드=제목·닉네임(사진 제외)·태그·브랜딩, 폰트 미로드 폴백(정적). 비공개·실패 시 기본 구성.

### 3-C. MiniShell 추출 + 셸 통합 (단계 C)

- `app/bazaar/page.tsx`의 미니 사이드바(로고 → `공유` 라벨 → Bazaar 행 → 전체[·내 게시물] → 로그인 버튼)를 `components/layout/MiniShell.tsx`로 추출. props: `{ children, active?: 'bazaar' }`. `/bazaar`·`/p`·`/shared` 비로그인·비멤버 렌더 공용. 콘텐츠는 `children`.
- **`/p/[problemId]`**(server `page.tsx` generateMetadata 존치): client 자식이 방문자(익명·로그인-비멤버 공통)를 `<MiniShell>`로 감싼 리스타일 공개 뷰어(3-D) 렌더. 비공개면 안내.
- **`/shared/[shareId]`**(3-B에서 server 분리): client 자식이 `<MiniShell>` + 스냅샷 뷰어. 만료·부재 안내.
- **오너 전용 편집 진입점**: 방문자가 오너면 헤더 "편집" 버튼 → `/?view=...`(풀 앱). 비오너·익명은 풀 앱으로 보내지 않음. `ShareButton`(SNS v1)은 공개 뷰어 헤더 유지.
- 이 단계는 **로그인-비멤버도 MiniShell 뷰어로 통일**(E 착수 전 안전한 종착). E가 나중에 로그인 사용자를 임베드로 승격.

### 3-D. 공개 뷰어 3종 리스타일 + 임베드 가능 형태 (단계 D)

- **삭제 아님. 데이터 로직 불변, 스타일만 클레이 문법으로.**
- `PublicViewerShell.tsx`: 자체 사이드바·헤더 역할은 MiniShell로 대체(중복 제거), 콘텐츠 렌더(`ProblemTabContent` 기반)만 남겨 리스타일 → "얇은 콘텐츠 렌더러"로 축소.
- `PublicProblemView.tsx`·`PublicComments.tsx`: 배경(`--bg-bazaar`/`--bg-content`)·카드·타이포를 앱 토큰으로 교체. **`watchCommentStream`·`commentSessionId`(problem 필드)·`authorName` 로직은 그대로.**
- **U6(임베드 가능 형태)**: `PublicViewerShell.tsx:49` `height:'100dvh'`, `PublicProblemView.tsx:86` `minHeight:'100vh'` → `height:'100%'` + 상위 위임으로 교체. 높이는 라우트 페이지(/p·/shared)의 100dvh 래퍼가 제공. → step E에서 AppShell 콘텐츠 영역에 스타일 수정 없이 얹을 수 있게.
- 회귀 확인: 익명 읽기 / 로그인 작성(`authorName` 표시) / `writeEnabled=false`(publicCommentsEnabled·commentsVisible) 안내가 여전히 동작.

### 3-E. 앱 셸 내 공개 뷰어 임베드 (단계 E · 스코프 가드)

> **전제:** A~D 완료·검증, U6로 공개 뷰어가 `height:100%`. **AppShell(메인 앱) 회귀 위험 최대 → 마지막에 착수, 부풀면 이연.**

- **AppShell 콘텐츠 렌더 분기**: `type:'problem'`(또는 신규 `type:'public-problem'`) 렌더에서 **오너/멤버면 ProblemView, 비오너면 `PublicProblemView` 임베드**. `?view=p&id=`·`?view=shared&id=` 파싱을 기존 `?view=bazaar`(L224~231)에 확장. 사이드바는 AppShell의 전체 사이드바 → **원 스펙 1.2 회복**.
- **BazaarView 앱 내부 라우팅**: `onOpenPost?(post)` 콜백 prop 추가 → 앱 내부(로그인) 렌더에서는 클릭 시 앱 뷰 전환(`?view=p&id=` 상당, `history.pushState`로 뒤로가기 지원). **콜백 미전달(=`/bazaar` 랜딩·익명)이면 기존 `<a target="_blank">` 유지.** ShareButton이 뿌리는 공유 URL은 여전히 `/p`·`/shared` 절대경로(OG 유지) — 앱 내부 라우팅과 무관.
- **`/p`·`/shared` 직접 접근(로그인)**: 로그인 상태로 URL 직접 진입 시 `/?view=p&id=`로 리다이렉트해 앱 셸 임베드로 착지(원 스펙 1.2). 크롤러는 server `generateMetadata`만 소비하므로 OG 무영향.
- **오너 상태 이동 주의(R-E2)**: 오너가 자기 게시물을 피드에서 클릭하면 ProblemView(편집 가능)로, 비오너면 공개 뷰어로 — 오너 분기 누락 시 오너가 공개 뷰어로 떨어져 편집 불가.
- **스크롤 중첩(R-E1)**: AppShell 콘텐츠 영역 overflow ↔ 공개 뷰어 내부 분리 스크롤(2단·댓글). 콘텐츠 영역 1겹 스크롤 정책으로 통일, U6 높이 위임이 제대로 먹는지 확인.

---

## 4. 리스크 & 주의

- **R10 (규칙 경로 유지)**: 리스타일·임베드 시 `watchCommentStream`을 `watchAllComments`로 바꾸거나 `listSessions`를 끌어들이면 익명·비멤버가 깨진다. **데이터 훅 절대 교체 금지** — 스타일·배치만.
- **R11 (OG 캐시 stale)**: 동적 OG(후속)는 크롤러/메신저 캐시 잔존 가능. 이번엔 정적이라 무관, `/shared` 메타는 만료 후 `no-store`로 기본 메타 반환.
- **R12 (og-default.png 배치)**: 파일이 실제로 `public/`에 없으면 SSR 메타는 텍스트 카드만·이미지 깨짐. **덕수 배치가 step B 선결.** 확보됨 → 저장만 하면 됨.
- **R13 (server/client 분리 회귀)**: `/shared` 분리 시 기존 로딩·만료·`ShareButton`·`OwnerBadge`가 client 자식으로 온전히 이동했는지 확인.
- **R14 (BazaarView 양쪽 반영)**: 헤더/프레임 2분할이 `/bazaar` 랜딩·AppShell 양쪽에서 동일한지(단일 컴포넌트, 스크롤 높이 계층 차이 주의).
- **R-E1 (임베드 스크롤 중첩)**: §3-E 참조. 콘텐츠 영역 1겹 스크롤로 통일.
- **R-E2 (오너 분기 누락)**: §3-E 참조. 오너=편집 뷰/비오너=공개 뷰 분기 전수 점검.
- **R-E3 (AppShell 회귀)**: E가 메인 앱 뷰 머신을 건드림 → 기존 home/folder/problem/editor 뷰 전환·뒤로가기 회귀 점검. **부풀면 A~D만 배포하고 E 이연.**
- **레이아웃 손실 수용**: v1의 "구 뷰어 폐기·CommentPanel 이관"은 규칙 충돌로 철회. 통일감·원 스펙은 리스타일+임베드로 달성.

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
- [ ] 오너만 "편집" 진입점 노출(`/?view=...`). 비오너·익명은 풀 앱으로 이동하지 않음.
- [ ] ShareButton 동작, 뿌리는 URL은 여전히 `/p`·`/shared`.

**단계 D (리스타일 + U6)**
- [ ] 공개 뷰어 3종이 클레이 문법으로 통일. **데이터 훅(`watchCommentStream` 등) 불변.**
- [ ] 익명 읽기 / 로그인 작성(`authorName`·정확한 `commentSessionId`) / `writeEnabled=false` 안내 회귀 없음.
- [ ] 구 뷰어 3종 미삭제(리스타일만). 공개 경로에서 `CommentPanel`·`ProblemView` 미사용 확인.
- [ ] 공개 뷰어에 `100dvh`/`100vh` 전면 가정 0건(U6, 임베드 가능 형태) — 높이는 라우트 래퍼가 제공.

**단계 E (임베드 · 스코프 가드)**
- [ ] 로그인 사용자: Bazaar 피드 클릭 → 새 탭 없이 앱 뷰 전환, 전체 사이드바 + 공개 뷰어. 뒤로가기로 피드 복귀.
- [ ] 로그인 `/p`·`/shared` 직접 진입 → `/?view=p&id=` 앱 셸 임베드 착지. 익명 → MiniShell 유지.
- [ ] 오너 클릭 → ProblemView(편집 가능), 비오너 → 공개 뷰어. 분기 누락 0.
- [ ] 임베드 상태 댓글 읽기/작성(`publicCommentsEnabled`)·ShareButton(절대경로 URL) 정상. 스크롤 중첩·AppShell 뷰 전환 회귀 없음.
- [ ] (이연 시) A~D만 배포해도 무결 — E 미착수가 A~D 가치를 훼손하지 않음.

---

## 6. 커밋 & 푸시

- 단계별 1커밋(권장 순서 A→B→C→D→E):
  - `Phase 53 A단계: Bazaar 디자인 개편 — --bg-bazaar 토큰·아이보리 헤더·U-프레임(U4·U5)`
  - `Phase 53 B단계: OG — /shared SSR 메타(server 분리) + og-default.png 정적(O3)`
  - `Phase 53 C단계: MiniShell 추출 + /p·/shared 비멤버 열람 셸 통합(U1)`
  - `Phase 53 D단계: 공개 뷰어 3종 클레이 리스타일 + 임베드 가능 형태(U2·U3·U6)`
  - `Phase 53 E단계: 앱 셸 내 공개 뷰어 임베드 — 원 스펙 1.2 회복(U7)`  ← 스코프 가드, 이연 가능
- **푸시는 덕수가 직접**. CLI는 커밋까지. 각 단계 후 `docs/roadmap.md` 갱신, 빌드 이슈 시 `rm -rf .next`. **`public/og-default.png` 배치는 덕수 수작업.**
