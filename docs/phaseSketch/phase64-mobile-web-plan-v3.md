# Phase 64 구현 계획서 — 휴대폰 열람 전용 화면(모바일 웹) (v3 — web 재검증·확정판)

> 대상: CLI Claude (착수) · 원시 자료: 목업 캔버스 「Mathory 모바일 열람 화면」(web, 2026-09-07, 7장) · 덕수 전제 확정(2026-09-07) · 결정 Q1~Q11 전항 확정(권장안)
> 계보: v1(web) → v2(CLI 실측 교차검토 — E-1~E-9 · S-1~S-11) → **v3(web 재검증, 2026-09-07 — v2 정정 F-1~F-5 · 보완 T-1~T-6 · §8-0 로컬 검증 환경 신설)**
> 진실 원천: mathory **origin/main `1c171ad`** (M5 배포 후). 인용 라인은 전부 이 해시 기준. v3에서 v2의 정정 9건을 저장소로 다시 확인했다 — 8건 유지, **1건(E-2) 재정정**, 그리고 v2가 놓친 **`/bazaar` 클라이언트 페이지**(F-1)·**UA 정규식의 태블릿 오탐**(F-2)을 잡았다.
> 범위: 휴대폰(판별식 D1) 접속 시 **열람 전용 셸**로 분기. 공개 라우트(`/p`·`/shared`·`/bazaar`) + 로그인 앱(`/`)의 열람(내 문항·받은 문항·Bazaar·agent 열람). **편집 없음.**
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

이것은 **모바일 웹**이다 — 같은 Next.js 앱 안에서 휴대폰이면 `PhoneShell`을, 그 외(PC·태블릿·폴더블 펼침)는 지금 화면을 그대로 낸다. 네이티브 앱·스토어·별도 코드베이스는 없다.
데스크톱 컴포넌트는 **한 줄도 바꾸지 않는 것을 목표**로 하고(예외 목록 §5-3, 전부 데스크톱 픽셀 무변경), `MiniShell`을 참조로 새 셸을 만들며, 이미 폭에 유연한 부품(`ProblemTabContent`·`PublicComments`)을 재사용한다.
**서버 0 · Firestore 규칙 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI + 라우트 page.tsx **2개**의 서버 컴포넌트화(`/`·`/bazaar` — F-1).

---

## 0-1. v1 → v2 정정 이력 (v2 작성, v3 재검증 결과 병기)

| # | v1의 오류 | v2 정정 | v3 재검증 |
|---|---|---|---|
| E-1 | 판별식 `min(w,h)≤599`가 PC 창 1200×500을 폰으로 판정(함정 2·Stage 0과 자기모순) | 세로 조건에 터치 결합: `w≤599 ∨ (h≤599 ∧ coarse)` | **유지** |
| E-2 | `PdfDialog.tsx:49` 인용 — "그 파일은 없다" | 실물은 `PdfDownloadButton.tsx`·`lib/pdfPrint.tsx` | **재정정(F-3)** — 파일은 **`components/problem/PdfDialog.tsx`**에 있다(v2가 `components/print/`만 봤다). `minWidth:260, maxWidth:340`은 `:50`. 소비처는 `ProblemView.tsx:12, 1244`. 결론(폰 트리가 ProblemView·EditorView를 안 그려 만날 일 없음)은 v1·v2 모두 유효 |
| E-3 | `:hover` 6개 | **8개** — `:260` 스크롤바 · `:868` · `:869` · `:874` · `:952-953` · `:1007` · **`:1012 .case-head.is-static:hover`(952-953의 취소 규칙, 쌍으로 이동)** | **유지**(grep 재확인, 8줄 정확) |
| E-4 | 글자 기본 16px | **15**(`ProblemView.tsx:42` `FONT_SIZE_DEFAULT = 15`). 키 공유 = 기본값 공유 | **유지**(`:41-45` 재확인) |
| E-5 | `CommentPanel`에 `resizable` prop | 불필요 — 폭 리사이즈 핸들은 소비처(EditorView·ProblemView·AppShell) 소유 | **유지** + 보완(T-3): 패널 **안**에는 입력창 **세로** 리사이즈 핸들(`:1078-1091`, hover 2상태)이 따로 있다. `canComment=false`(agent)면 입력 블록째 안 그려져 무관, 앱 댓글(`canComment=true`)에서는 남는다 — 터치에서 무해(pointer 이벤트)하므로 그대로 둔다 |
| E-6 | "TabBody의 svg/ggb 분기를 켠다" | ProblemTabContent에는 분기가 **없다** — 새로 추가 + `next/dynamic` | **유지** + 보완(T-4): 저장소에 `next/dynamic` 사용이 **0건**이라 이번이 첫 도입. `GgbViewer`는 `window.GGBApplet`(`:83`)을 만지므로 `{ ssr:false }` 필수 |
| E-7 | 390×844 = iPhone 15/16 | 393×852(390×844는 12~14) | **유지** |
| E-8 | RefTooltip에 click 리스너 추가 | 터치 탭은 합성 `mouseover`를 발화 → 실기기 판정 우선 | **유지** |
| E-9 | ContextMenu 터치 바깥 탭 미닫힘 | 미검증 단정 — 합성 `mousedown`으로 닫힐 가능성 높음. 폰 트리 무관 | **유지** |

## 0-2. v2 → v3 정정·보완 (실측 근거)

| # | 항목 | 내용 |
|---|---|---|
| **F-1** | **`/bazaar/page.tsx`는 `'use client'`다** — v2 P1의 "`/p`·`/shared`·`/bazaar`의 page.tsx는 이미 서버 컴포넌트"는 `/bazaar`에서 틀렸다. `useAuth`·`useRouter`로 로그인 사용자를 `/?view=bazaar`로 보내는 클라이언트 페이지(`app/bazaar/page.tsx:1-44`) | 처방: 현행 본문을 `components/share/BazaarLanding.tsx`(클라이언트)로 옮기고 `page.tsx`는 서버 컴포넌트로 `headers()` → `<BazaarLanding initialPhone />`. 서버 컴포넌트화 대상은 **`/`·`/bazaar` 2개**(§5-3 ①) |
| **F-2** | **UA 정규식의 태블릿 오탐** — v2 D1의 `/Mobi\|Android\|iPhone/i`는 ① Android 태블릿(Chrome은 태블릿 UA에서 `Mobile` 토큰을 뺀다 — `Android`만 있으면 태블릿)을 폰으로, ② iPad Safari의 "모바일 웹사이트 요청" UA(`iPad … Mobile/15E148`)를 폰으로 찍는다. 클라이언트가 보정하긴 하지만 태블릿마다 한 번씩 깜빡인다 | `guessPhoneFromHeaders`: `chUaMobile`이 있으면 그것만(`?1`=폰, `?0`=아님 — Android 태블릿은 `?0`). 없으면 `if (/iPad\|Tablet\|Android(?!.*Mobile)/i.test(ua)) return false; return /iPhone\|iPod\|Android.*Mobile\|Mobi/i.test(ua)`. 테스트 표에 Android 태블릿 UA·iPad 모바일 UA 두 줄 추가(D1) |
| **F-3** | E-2 재정정 | 위 표 참조 |
| **F-4** | v2 오탈자 | "목시"→**목업**, "중기기"→**실기기**, "감안하거나"→"개정하거나". 본문 반영 |
| **F-5** | D1 실행 순서 누락 | `useIsPhone` effect에서 **forceDesktop(sessionStorage)을 matchMedia보다 먼저** 읽어야 한다 — 순서가 뒤집히면 "PC 화면으로 보기" 직후 `change` 이벤트가 폰으로 되돌린다. D4에 명시 |
| **T-1** | §8-0 **로컬 검증 환경** 신설(덕수 질문) — Chrome 기기 모드로 무엇이 재현되고 무엇이 안 되는지, 실기기 연결, 서버 분기 확인법 | §8-0 |
| **T-2** | `ResponsiveShell`에 서버 컴포넌트가 만든 엘리먼트(`<MiniShell>…`)를 prop으로 넘기는 것은 Next 14에서 정상(클라이언트 경계 너머로 RSC 엘리먼트 전달) — 단 `phone`/`desktop` **둘 다 엘리먼트로 만들어지지만 마운트는 한쪽만** 되므로 데이터 구독은 마운트 후에만 시작된다. 확인용 메모 | §5 함정 6 |
| **T-3** | E-5 보완 | 위 표 |
| **T-4** | E-6 보완 `ssr:false` | 위 표 · D14 |
| **T-5** | 안드로이드 ①~⑳ 폴백은 **Mac의 DevTools로는 재현이 안 된다**(`local('Apple SD Gothic Neo')`가 Mac에 있어 항상 로컬 글꼴을 탄다) — DevTools Rendering 패널의 **"Disable local fonts"**로 강제하거나 실기기 | §8-0 |
| **T-6** | 하단 탭 바의 `env(safe-area-inset-bottom)`은 DevTools에서 **항상 0** — 실기기 검수 항목으로 고정 | §8-0 |

---

## 1. 전제 (덕수 확정, 2026-09-07)

| # | 전제 | 계획서 반영 |
|---|---|---|
| E1 | **6.1인치급** 최다 사용 폰 크기에 맞춘다. 더 크거나 작은 폰은 차후 | 기준 뷰포트 **393×852 CSS px**(iPhone 15/16 · Galaxy S 계열 384~412의 대표). 360(소형)·430(Pro Max)은 **깨지지만 않게** — 고정 px 최소화, 별도 튜닝은 §10 |
| E2 | **세로 보기만.** 가로는 회전을 못 막으니 후순위 | 폰 가로에서도 **가로 레이아웃을 따로 만들지 않고** 세로 레이아웃이 그대로 늘어난다(D3) |
| E3 | 폰도 **색·아이콘·글꼴·로고**를 통일성 있게 그대로 쓸 수 있는지 확인, 불가피한 변경은 미리 점검 | §7 점검 완료 — **전부 그대로 쓴다.** 불가피한 변경 3건은 기존 부채 정리(아이콘 크기 상향·워드마크 공용화·hover 격리), 워드마크는 textShadow까지 복제 |
| E4 | 휴대폰에서 **편집은 하지 않는다** | 폰 셸에 `EditorView` 진입점 0. 문항 메뉴의 '편집'은 비활성 + "PC·태블릿에서" |
| E5 | **AI 에이전트 화면**도 로그인 회원에 한해 **열람** | `CommentPanel mode='agent' canComment={false}` 재사용. "회원" = **오너 + 그 문항의 멤버**(Q1). 멤버는 `commentsVisible` 게이트가 하나 더 있다(P4) |
| E6 | 판별 = 폰이면 폰 셸, 폴더블 펼침·태블릿·PC = 기본 화면 | D1·D2 |
| E7 | 목업 기본 구조 승인 — 상단 바 고정·2탭·바텀 시트·하단 탭 3개 | §6 화면 사양이 목업 7장과 1:1 대응 |

---

## 2. 타당성 판정 — 기존 구조와 정면으로 만나는 지점

**불가능 판정 0건.** 아래 5건은 규칙을 개정하거나 구조를 조정해야 한다.

| # | 구상 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | 서버에서 UA 힌트로 첫 렌더를 고른다 | **`app/page.tsx`와 `app/bazaar/page.tsx`가 `'use client'`**(F-1) → `headers()`를 부를 수 없다. `/p`·`/shared`는 `generateMetadata`가 있는 서버 컴포넌트 | 두 페이지를 서버 컴포넌트로: `/`는 `'use client'` 제거(3줄), `/bazaar`는 본문을 `BazaarLanding.tsx`로 추출 후 page.tsx가 `headers()`만 읽는다. 이 순간 `/`·`/bazaar`가 빌드 출력에서 정적(○)→동적(ƒ)이 된다 — 실질 무해(둘 다 이미 클라이언트 셸)지만 Stage 0 검수에 명시 |
| **P2** | 폰 셸을 `AppShell` 안에서 분기 | `AppShell.tsx`(1,103줄)는 `loadData`·DnD 컨텍스트·뷰 상태를 한 몸에 갖는다. 폰 트리를 그 안에 끼우면 상태를 공유하게 되어 "데스크톱 무변경"이 깨진다 | **`AppShell` 최상단 조기 반환** `if (isPhone) return <PhoneApp user … />` 한 줄만 넣고, `PhoneApp`은 **자기 데이터를 자기가 읽는다**(`listProblems`·`listRecentProblems`·`listSharedWithMe`·`listFolders` — `lib/firestore.ts`, `AppShell.tsx:194-201`). 상태 공유 0 |
| **P3** | 앱 열람뷰를 폰에 옮긴다 | `ProblemView`는 최소 폭 758px(라벨 열 `7em`=105@15 + 카드 600), `WIDTH_EM_MIN 35`(`lib/constants.ts:36-39` · `TabBody.tsx:92-102`) | **옮기지 않는다.** 폰 리더는 `ProblemTabContent`(props 2개, `width:100%`)로 새로 조립. 라벨 열(문제/풀이)은 **탭**이 대신한다 |
| **P4** | agent 화면을 "로그인 회원"에게 연다 | UI 게이트 `ProblemView.tsx:820` `user && isOwnerView`(오너 전용). **실제 인가는 Firestore 규칙**: agent 세션 read = 오너 OR 멤버(`firestore.rules:333`), agent 메시지 read = 오너 OR (멤버 && `commentsVisible()`)(`:234-236`). 공개 문항의 비멤버 로그인 사용자는 `commentStream==true`(댓글)만 읽는다 | **"회원" = 오너 + 멤버(Q1), 규칙 변경 0.** 폰 agent 아이콘 노출 = `오너 OR (멤버 && problem.commentsVisible !== false)` — 없으면 멤버가 "세션 목록은 뜨는데 메시지가 빈" 상태를 본다. 데스크톱은 오너 전용 그대로(Q9) — **폰이 데스크톱보다 넓은 비대칭은 의도**, PC 확장은 §10 |
| **P5** | 우측 드로어 3종 규약(absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`) | `CommentPanel` 루트가 자기 위치를 정한다(`:877-893` `position:absolute; top/right/bottom: DRAWER_INSET(8); width; maxWidth:90vw; zIndex:50`) | 규약은 **데스크톱 한정**, 폰은 **바텀 시트 하나의 문법**(D9). `CommentPanel`은 positioned 래퍼 + `width:'100%'`로 **무변경 재사용**, 인셋 8은 시트 안쪽 여백으로 흡수. `SelectionInsertPopup`(`:922` 내부 마운트)만 `selectionPopup` prop 1개로 차단 |

---

## 3. 확정 사실 (실측, 전부 `1c171ad`)

### A. 진입·판별

| # | 사실 | 위치 |
|---|---|---|
| A-1 | `app/page.tsx` = `'use client'` + `<AppShell />`. **`app/bazaar/page.tsx`도 `'use client'`**(`useAuth`·`useRouter`, 로그인 시 `/?view=bazaar` replace). `/p`·`/shared`는 서버 컴포넌트(`generateMetadata`). `next.config.*`·`vercel.json` 없음. `layout.tsx`에 `viewport` export 없음(Next 14 기본 주입) | `app/page.tsx:1-7`, `app/bazaar/page.tsx:1-44`, `app/p/[problemId]/page.tsx:30`, `app/shared/[shareId]/page.tsx:39` |
| A-2 | UA·`pointer:coarse`·`matchMedia` 사용 **0건**. 폭 분기는 `PublicViewerShell.tsx:35`(≥880 → 2단)와 `BazaarView.tsx:40-48`(ResizeObserver 620/480) 둘뿐. **`next/dynamic` 사용 0건** | grep 전수 |
| A-3 | `AppShell` 루트 `height:'100vh'`(`:803`). `MiniShell.tsx:29`·`bazaar/page.tsx:27`는 `100dvh` | 불일치 |
| A-4 | `AppShell`은 로그인 화면을 따로 그리지 않는다(비로그인도 Sidebar+main, `loadData`만 user 게이트). 딥링크 effect는 **`if (!user …) return`으로 로그인 후에만 돈다**(`:255-258`), `?view=bazaar\|p\|shared&id=` 1회 읽고 `replaceState('/')` | `AppShell.tsx:183-192, 253-294` |
| A-5 | 루트 레이아웃이 `<DialogHost/>`·`<RefTooltip/>`을 전역 1벌 마운트 → 폰 셸도 상속. `dialogBody`는 `maxWidth:92vw, maxHeight:88vh` | `layout.tsx:29-40`, `dialogStyles.ts:36-43` |

### B. 재사용 부품

| # | 사실 | 위치 |
|---|---|---|
| B-1 | `ProblemTabContent({blocks, tabId})` — props 2개, 요약 보기 토글 내장(question 탭 제외), **svg·ggb 분기 없음**(TabBody 헤더 주석 "통합하지 않는다 D16"). `useOutlineState(sorted)` 인자 없음 → 기본 **'full'** | `ProblemTabContent.tsx:29`, `TabBody.tsx:20-28`, `useOutlineState.ts:38` |
| B-2 | `PublicComments({problemId, commentSessionId, writeEnabled?})` — 자기 구독·자기 auth·로그인 버튼 내장, 루트 `width:100%`, 위치 미지정 → 그대로 시트에 임베드 | `PublicComments.tsx:21-31, 113-117` |
| B-3 | `CommentPanel` — `mode:'comments'\|'agent'`, `canComment=false`면 입력 UI·AI 칩·검증 칩 블록이 통째로 안 그려진다(`:1071`). 루트 self-positioned(`:877-893`). `width`는 `number\|string`. `window.innerWidth` 0건(`innerHeight`는 입력창 세로 리사이즈 클램프 1곳). 입력창은 CodeMirror 6. `SelectionInsertPopup` `:922` 내부 마운트. 입력창 세로 리사이즈 핸들 `:1078-1091`(hover 2상태, pointer 이벤트) | `CommentPanel.tsx` |
| B-4 | `PublicViewerShell` = `height:100%` + 880 미만 1단+탭 폴백. 카드 `padding '32px 36px 32px 40px'` + 열 `24` = 좌우 124px 고정, `fontSize:15` 하드코딩, 댓글 aside `width:380` → **폰 리더로 쓰지 않고 참조만** | `PublicViewerShell.tsx:25-40, 139-160, 176-180` |
| B-5 | hold-to-peek '문제' 알약은 이미 `onPointerDown/Up/Cancel` + `touchAction:'none'`(`:897-917`). 팝업은 `TabBody hideLabel` 한 벌 더 + `maxHeight:80vh`(`:966-993`) | `ProblemView.tsx` |
| B-6 | `RefTooltip` = document 위임 4리스너(mouseover/mouseout/scroll capture/resize, `:179-183`), `DELAY_MS 500`(`:30`), 정의부 탐색 `findDefinition()`(`:97-113`), 게이트 `[data-ref-tooltip]`, zIndex `Z_TOOLTIP`(10400). 터치 탭은 합성 mouseover를 발화 | `RefTooltip.tsx`, `dialogStyles.ts:24-27` |
| B-7 | `SvgViewer` pinch 활성(`:65`), `GgbViewer` 전체화면 `fixed; inset:0` + `100vw/100vh`(`:322-330`), `window.GGBApplet`(`:83`) | `SvgViewer.tsx`, `GgbViewer.tsx` |
| B-8 | `SizeStepper` 버튼 14×11(`:15-19`) — 터치 타깃 미달 | `SizeStepper.tsx` |
| B-9 | `ContextMenu` 닫기 = document `mousedown`(`:35-42`) — 합성 mousedown으로 닫힐 가능성 높음(미검증, 폰 트리 무관). `BazaarView` 내 게시물 액션 `mine && hovered`(`:270`) | |
| B-10 | PDF: `components/problem/PdfDialog.tsx`(`minWidth:260, maxWidth:340`, `:50`) ← `ProblemView.tsx:1244` · `lib/pdfPrint.tsx:108` `window.print()` ← `ProblemView.tsx:537`. 폰 트리는 ProblemView·EditorView를 안 그린다 | F-3 |

### C. 데이터 경로

| # | 사실 | 위치 |
|---|---|---|
| C-1 | 폴더·문항·받은 문항: `AppShell.loadData`(`:183-227`)가 `listProblems`·`listRecentProblems(uid,10)`·`listSharedWithMe`·`listSharedByMe`·`listFolders`를 직접 호출. 최근 문항은 휴지통(`TRASH_FOLDER_ID`) 제외 | `lib/firestore.ts` |
| C-2 | Bazaar: `listBazaarFeed(q)`(`lib/bazaar.ts:100`), `BazaarView({uid, filter, onOpenPost?})` | |
| C-3 | 앱 열람 = `getProblemWithBlocks` 1회 + **멤버는 `memberTabVisibility` 필터**(`ProblemView.tsx:555-559`). 공개 열람 = `watchProblem`+`watchTabBlocks` 실시간 + `visibility==='public'` + 같은 필터(`PublicProblemView.tsx:44-49`). 두 경로 미통합 | |
| C-4 | agent 데이터 = `discussion_sessions`(type `'normal'`) + `tab_comments`(`commentStream=false`). 세션 read 오너 OR 멤버 / 메시지 read 오너 OR (멤버 && `commentsVisible()`) | `firestore.rules:200-202, 234-236, 333` |

### D. 색·글꼴·아이콘·로고

| # | 사실 | 위치 |
|---|---|---|
| D-1 | 글꼴 링크 3: Pretendard(jsDelivr) · Google Fonts · KaTeX 0.16.28. `@font-face` 2: D2Coding · **MathoryCircled**(`local()` 3종 → gstatic Noto Sans KR 서브셋, ①~⑳, `size-adjust 88%`) | `layout.tsx:14-28`, `globals.css:37-47` |
| D-2 | 안드로이드에는 `local()` 3종이 전부 없다 → gstatic 폴백이 실경로. **Mac DevTools에서는 재현 불가**(T-5) | |
| D-3 | 워드마크 인라인 3벌: MiniShell(19/600/`--mathory-red`/무그림자, `:78-81`) · Sidebar(19/400/`#944728` + `textShadow 0 1px 0 rgba(0,0,0,0.06)`, `:779-784`) · HomeView(48/400/`--mathory-red-dark` + 같은 그림자, `AppShell.tsx:1074-1078`) | |
| D-4 | Phosphor regular, `phIcon(d, defaultSize)` `size` 자유(`Icons.tsx:37-41`). "최소 14px, 임의 축소 금지" | |
| D-5 | `@media` 0개, `:hover` **8개**(`:260, 868, 869, 874, 952-953, 1007, 1012`) | `globals.css` |
| D-6 | 색 토큰 `:root` 한 벌, 다크 없음. 명암비 구속 `#E8DFCE` | |
| D-7 | `FONT_SIZE_KEY/DEFAULT 15/MIN 11/MAX 24/STEP 1` — `ProblemView.tsx:41-45` 지역 상수 | |
| D-8 | 로그인은 전부 `signInWithPopup`(MiniShell `:24-26` 등) — 카카오톡·인스타 인앱 웹뷰에서 popup 실패 사례 알려짐. redirect 전환은 Safari ITP가 별개 이슈라 이번엔 안 한다(Q10) | |

---

## 4. 결정 (D1~D16 — 확정)

### 판별·진입

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **`lib/device.ts` 신설(import 0).** `PHONE_MAX_SHORT_SIDE = 599`. `isPhoneViewport(w, h, coarse) = w <= 599 \|\| (h <= 599 && coarse)`. **`guessPhoneFromHeaders(ua, chUaMobile)`**(F-2): `chUaMobile`이 있으면 `=== '?1'`만; 없으면 `if (/iPad\|Tablet\|Android(?!.*Mobile)/i.test(ua)) return false; return /iPhone\|iPod\|Android.*Mobile\|Mobi/i.test(ua)`. `tests/device.test.mjs` 기기 표: iPhone 15 393×852 coarse → 폰 · S24 384×824 coarse → 폰 · 폰 가로 852×393 coarse → 폰 · PC 창 1200×500 fine → 데스크톱 · PC 창 599×800 fine → 폰(폭 조건) · Z Fold 펼침 673×841 → 데스크톱 · Pixel Fold 883×736 → 데스크톱 · iPad mini 744×1133 → 데스크톱 · **UA: Android 태블릿(`Mobile` 없음) → false · iPad "모바일 웹사이트" UA → false · `Sec-CH-UA-Mobile: ?0` + Android UA → false** | E6 · E-1 · F-2 |
| **D2** | **두 겹 판별.** ① 서버: 라우트 page.tsx(서버 컴포넌트)가 `headers()`로 `guessPhoneFromHeaders(ua, sec-ch-ua-mobile)` → `initialPhone` prop. ② 클라이언트: `hooks/useIsPhone.ts`가 첫 렌더는 `initialPhone` 그대로(hydration 불일치 0), `useEffect`에서 `matchMedia('(max-width:599px), ((max-height:599px) and (pointer:coarse))')` 보정 + `change` 구독. iPadOS Safari(Macintosh UA)는 서버가 데스크톱으로 찍고 그게 맞다 | P1 · A-1 |
| **D3** | **가로 레이아웃 없음.** 상단 바 52 + 탭 44 = 96px 고정, 나머지 스크롤 | E2 |
| **D4** | **탈출구 = ⋯ 시트의 "PC 화면으로 보기".** `sessionStorage['mathory.forceDesktop']='1'`(탭 수명, Q2). `useIsPhone` effect는 **forceDesktop을 먼저 읽고, 참이면 matchMedia 구독 자체를 건너뛴다**(F-5 — 순서가 뒤집히면 `change` 이벤트가 폰으로 되돌린다). 서버 첫 렌더가 폰일 수 있으므로 한 번 다시 그려지는 것을 허용. 데스크톱 셸에 되돌아오는 버튼은 없다 | Q2 · F-5 |
| **D5** | `app/layout.tsx`에 `export const viewport = { width:'device-width', initialScale:1, viewportFit:'cover' }`. `maximumScale` 없음(수식 핀치 확대는 독자의 권리) | A-1 |

### 셸·라우팅

| # | 결정 | 근거 |
|---|---|---|
| **D6** | **`components/layout/PhoneShell.tsx` 신설** — props `{ title?, left?: 'back'\|'wordmark', right?, tabs?, footer?, children }`. 루트 `height:100dvh` flex 열 + **`data-phone` 속성**, 상단 바 52(`--bg-functional`, 하단 1px `--border-light`), 본문 `flex:1; overflow:auto`(**문서 자체는 스크롤하지 않는다** — 시트 스크롤 잠금이 쉬워진다), footer `padding-bottom: env(safe-area-inset-bottom)`. `MiniShell.tsx:13` U8 주석 갱신 | P2 · B-4 |
| **D7** | **공개 라우트 3개는 page.tsx에서 셸만 바꾼다.** `<ResponsiveShell initialPhone phone={…} desktop={…}>`(클라이언트, `useIsPhone` 소비). `/bazaar`는 F-1대로 `BazaarLanding.tsx`(클라이언트) 추출 후 그 안에서 `ResponsiveShell`. `PublicProblemView`·`SnapshotView`에 `reader?: 'desktop'\|'phone'` prop 1개 | F-1 · B-4 |
| **D8** | **로그인 앱 = `AppShell` 조기 반환 1줄 + `PhoneApp`.** 뷰 상태 `home\|folder\|received\|bazaar\|problem\|agent` 자체 소유, 데이터 자체 로드(받은 문항 열람에 `memberTabVisibility` 필터·휴지통 제외 직접 적용). 딥링크는 `lib/deepLink.ts`(import 0)로 추출해 AppShell·PhoneApp 공용, 둘 다 로그인 후에만 처리(현행). 하단 탭 3 = 내 문항 · 받은 문항 · Bazaar. **비로그인 폰 `/` = 로그인 화면**(Q11): 워드마크(48 사양) + Google 로그인 + "Bazaar 둘러보기" | P2 · A-4 |
| **D9** | **`components/ui/BottomSheet.tsx`** — `{ open, height, onClose, children }`. `position:absolute`(PhoneShell 루트 기준) 바닥 고정, `--bg-drawer` + `--drawer-shadow`, 그립 36×4 `--border-content`, 딤 `rgba(45,42,35,0.32)`, 닫기 = 딤 탭 + 그립 드래그(60px) + X. 애니메이션 0.2s 하나. 규약 4: ① `dialogStyles.ts`에 **`Z_SHEET = 9500`**(`Z_TOOLTIP` 10400·`Z_DIALOG` 10500 **아래**) ② 열림 중 PhoneShell 본문 `overflow:hidden` ③ 시트도 `padding-bottom: env(safe-area-inset-bottom)` ④ iOS 키보드 가림은 실기기 검수(visualViewport 보정은 실측되면) | P5 |

### 리더

| # | 결정 | 근거 |
|---|---|---|
| **D10** | **`components/phone/PhoneReader.tsx`** = 상단 바(←·제목·💬n·⋯) + 탭(문제/풀이 2등분 44px, 활성 accent 2px 밑줄) + 탭당 `ProblemTabContent` 카드. 탭 상태 비영속(진입 시 항상 문제 탭). 문제 탭 하단 `[풀이 보기]`(48px), 풀이 탭 상단 `[문제 보기]` 알약(32px → 바텀 시트에 문제 카드). 요약 보기 기본 **full**(Q8, 코드 0줄) | E7 · B-1 |
| **D11** | **카드 = `--bg-content`, radius 6, 좌우 margin 10, padding `1.1em 1em 1.2em 2.2em`, 기본 15px, `line-height 1.8`.** 좌 2.2em = 경우 rail·dot 거터 보존(Q5). `--card-pad-l/r` = `2.2em`/`1em`(`.outline-section` 전폭 톤). 본문 폭 393−20−33−15 = **325px ≈ 21.7em@15** | 목업 |
| **D12** | **글자 크기 11~24, 기본 15, `localStorage 'mathory-content-font-size'` 공유**(Q7). `FONT_SIZE_*` 4종을 `lib/constants.ts`로 이동·export, `ProblemView`·폰 공용(사본 금지). 스테퍼는 ⋯ 시트 안 44×36 버튼 | B-8 · D-7 |
| **D13** | **수식 넘침 = 수식만 가로 스크롤.** `[data-phone]` 스코프 3규칙: ① `.katex-display { padding-left:1em; overflow-x:auto; overflow-y:hidden }` ② `.callout-block { padding-left:1em }` ③ `.callout-block .katex-display { padding-left:0 }`(기존 `:647`과 동특이도 순서 의존 차단). `@media` 아님(함정 2) | globals.css:394, 637-647 |
| **D14** | **svg·ggb(Q3 — 켠다)**: `ProblemTabContent`에 `viewers?: boolean`(기본 false) 분기를 **새로 추가**, TabBody:117-160과 같은 렌더. `SvgViewer`·`GgbViewer`는 **`next/dynamic(…, { ssr:false })`**(저장소 첫 사용 — `GgbViewer`가 `window.GGBApplet`을 만진다). `GgbViewer` 전체화면 `100vh → 100dvh`. GeoGebra 터치 조작은 Stage 2 실기기 | E-6 · T-4 |
| **D15** | **참조 말풍선 = 탭, 실기기 판정 우선.** Stage 2에서 (a) 합성 mouseover로 이미 뜨면 → `[data-phone]` 조상일 때 `DELAY_MS` 500→0 (b) 안 뜨면 → `pointerup` 리스너 + 이중 발화 가드. 말풍선 박스 현행 유지 | B-6 · E-8 |
| **D16** | **댓글·agent 시트.** 공개 댓글 = `PublicComments` 그대로. 앱 댓글·agent = `CommentPanel`을 `BottomSheet(78%)` 안 positioned 래퍼 + `width:'100%'` + `selectionPopup={false}`. **agent는 `canComment={false}` 고정**, 아이콘 노출 = `오너 OR (멤버 && commentsVisible !== false)`. 앱 댓글은 `canCommentOnProblem` 현행 — CodeMirror 폰 IME는 Stage 4 검수 | B-3 · P4 |

---

## 5. 아키텍처

### 5-1. 신설 (전부 클라이언트)

| 파일 | 역할 | 추정 |
|---|---|---|
| `lib/device.ts` + `tests/device.test.mjs` + `test:device` | 판별 순수 함수(뷰포트·UA·CH) | 50줄 + 테스트 |
| `lib/deepLink.ts` | `?view=…&id=` 파싱(import 0), `test:deeplink` | 30줄 |
| `hooks/useIsPhone.ts` | forceDesktop → initialPhone → matchMedia 보정 | 40줄 |
| `components/layout/ResponsiveShell.tsx` | `{initialPhone, phone, desktop}` | 20줄 |
| `components/layout/PhoneShell.tsx` | 프레임 + `data-phone` | 150줄 |
| `components/share/BazaarLanding.tsx` | 현행 `/bazaar` 클라이언트 본문 이전(F-1) + `ResponsiveShell` | 50줄(이동) |
| `components/ui/BottomSheet.tsx` | 시트(Z_SHEET·스크롤 잠금·safe-area) | 130줄 |
| `components/ui/Wordmark.tsx` | 워드마크 공용(그림자 포함 3벌 재현) | 30줄 |
| `components/phone/PhoneReader.tsx` · `PhoneMoreSheet.tsx` · `PhoneApp.tsx` · `PhoneList.tsx` · `PhoneBazaar.tsx` · `PhoneItemMenu.tsx` | v2와 동일 | 350·120·320·150·180·80줄 |

### 5-2. 데이터 흐름

```
/p/[id]   page.tsx(서버) —headers()→ ResponsiveShell ─┬─ MiniShell + PublicProblemView(reader='desktop')   ← 현행
                                                      └─ PhoneShell + PublicProblemView(reader='phone') → PhoneReader
/bazaar   page.tsx(서버) —headers()→ BazaarLanding(클라) → ResponsiveShell ─┬─ MiniShell + BazaarView
                                                                          └─ PhoneShell + PhoneBazaar
/         page.tsx(서버) —headers()→ AppShell(initialPhone) ─┬─ (현행 트리, 무변경)
                                                             └─ isPhone → PhoneApp → PhoneList / PhoneBazaar / PhoneReader
```
`PhoneReader({ problem, tabs, tabBlocks, commentsSlot?, agentSlot?, onBack })`는 표시만. 데이터 소스는 호출자(공개 = 실시간 구독, 앱 = 1회 fetch + `memberTabVisibility` 필터)가 준다.

### 5-3. 기존 파일 수정 (전부 데스크톱 픽셀 무변경)

| # | 파일 | 변경 |
|---|---|---|
| ① | `app/page.tsx`, **`app/bazaar/page.tsx`** | 서버 컴포넌트화 + `headers()` → `initialPhone`. 빌드 출력 `/`·`/bazaar` ○→ƒ(Stage 0 기록) |
| ② | `PublicProblemView.tsx`, `SnapshotView.tsx` | `reader` prop |
| ③ | `CommentPanel.tsx` | `selectionPopup?: boolean = true` |
| ④ | `AppShell.tsx` | 딥링크 → `lib/deepLink.ts` · 조기 반환 1줄 · `:803` `100vh → 100dvh` |
| ⑤ | `ProblemView.tsx` + `lib/constants.ts` | `FONT_SIZE_*` 이동·export(값 무변경) |
| ⑥ | `ProblemTabContent.tsx` | svg/ggb 분기 추가(`viewers` 기본 false, `next/dynamic ssr:false`) |

그 외: `RefTooltip`(Stage 2 판정 후) · `GgbViewer` `100dvh` · `globals.css` `[data-phone]` 3규칙 + `:hover` 7개(+`:1012` 쌍)를 `@media (hover: hover)`로 · `layout.tsx` viewport · `dialogStyles.ts` `Z_SHEET` · `MiniShell.tsx:13` 주석.

### ⚠ 함정 1 — hydration
`useIsPhone` 초기 상태는 반드시 `initialPhone`. matchMedia·forceDesktop은 effect에서만. 보정 재렌더는 (a) PC 창 599 이하 (b) UA 오탐 (c) forceDesktop 복원 — 드물고 허용.

### ⚠ 함정 2 — `[data-phone]`에 `@media`를 섞지 말 것
폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 `data-phone`만 본다. 예외는 `@media (hover: hover)`(입력 장치 질의).

### ⚠ 함정 3 — `CommentPanel` 인셋 8
시트 본문 `position:relative; height:100%` + `width:'100%'` → 좌 0·우 8·상하 8 인셋. 좌측만 `paddingLeft:8`로 대칭.

### ⚠ 함정 4 — 동특이도 순서 의존
`[data-phone] .katex-display`(0,2,0) vs `.callout-block .katex-display`(0,2,0, `:647`) → D13 ③ 취소 규칙으로 해소. 규칙 추가 때마다 같은 특이도 기존 규칙 확인.

### ⚠ 함정 5 — 공개 라우트 번들
`/p`·`/shared` closure에 SvgViewer·GgbViewer가 없다. 정적 import 금지, `next/dynamic` + `ssr:false`만.

### ⚠ 함정 6 — `ResponsiveShell`의 두 엘리먼트 (T-2)
`phone`/`desktop`은 서버 컴포넌트가 만든 RSC 엘리먼트를 클라이언트 경계 너머로 넘기는 정상 패턴이다. 둘 다 엘리먼트로 **생성**되지만 **마운트는 한쪽만** — `useEffect` 기반 구독(`watchProblem` 등)은 마운트된 쪽만 시작한다. 분기 전환 시 이전 쪽은 언마운트되어 구독이 해제된다(cleanup이 있는지 각 뷰 확인 — `PublicProblemView.tsx:33-64`는 있다).

---

## 6. 화면 사양 (목업 7장 + 3)

| 목업 | 화면 | 구성 | 근거 |
|---|---|---|---|
| 1 | 열람·문제 | 상단 바(←·제목·💬n·⋯) · 탭 · 클레이 카드 · `[풀이 보기]` · 메타 · 슬로건 | D10·D11 |
| 2 | 열람·풀이 | `[문제 보기]` 알약 · 풀이 카드(dim/key 톤 · 경우 rail·dot · Tip · display 수식 1em) | D10·D13 |
| 3 | 댓글 시트 | `BottomSheet 78%` · "댓글 n" · 리스트 · Google 로그인(익명) / 입력창(회원) | D16 |
| 4 | ⋯ 시트 | 글자 크기(15 기본) · 링크 복사 · Bazaar · PC 화면으로 보기 · 로그인 | D4·D12 |
| 5 | Bazaar | 상단 바(워드마크·로그인) · 검색 44 + 정렬 · 2행 카드 · 내 게시물 ⋯ (칩 보류, Q4) | C-2 |
| 6 | 내 문항 | 상단 바(워드마크·검색·아바타) · 폴더 행 · 최근 수정 행 · 하단 탭 3 | D8 |
| 7 | 문항 메뉴 | 열람 · 공유 링크 복사 · **편집(비활성, "PC·태블릿에서")** · 폴더 이동 | E4 |
| ＋ | agent 열람 | 상단 바 `IconAgent`(오너 OR 멤버&&commentsVisible) → 시트 + `CommentPanel agent canComment=false` | D16 |
| ＋ | 받은 문항 | `PhoneList` ← `listSharedWithMe`, 보조줄 = 공유자·수정일, 열람 시 탭 필터 | C-3 |
| ＋ | 비로그인 `/` | 워드마크(48) + 슬로건 + Google 로그인 + "Bazaar 둘러보기" | Q11 |

공통: 폴더 DnD·다중 선택·칼럼 조정·리사이즈·버전 드로어·PDF/인쇄·시트 가져오기·일괄 검증 → **폰 진입점 없음.**

---

## 7. 통일성 점검 (E3) — 결론: 전부 그대로 쓴다

| 축 | 판정 | 불가피한 변경 |
|---|---|---|
| 7-1 색 | 신규 토큰 0. 명암비 구속 `#E8DFCE`는 폰에 hover가 없어 완화 | 없음 |
| 7-2 글꼴 | CDN 동일. `--katex-scale`·`line-height`·`keep-all` 그대로 | 안드로이드 ①~⑳ gstatic 폴백(D-2) — Stage 1 실기기 검수(Mac DevTools 재현 불가, T-5). 실패 시 `public/fonts/` 자체 호스팅 |
| 7-3 아이콘 | Phosphor 그대로, 폰 상단 바·시트·탭 22, 보조 12~14 | 14 기본 아이콘을 44 히트 영역 안에서 20~22로(하한 규칙과 충돌 없음) |
| 7-4 로고 | 글꼴·자간·색 계열 그대로 | `Wordmark.tsx` 공용 추출 — props `{size, weight, color, shadow}`로 3벌 픽셀 재현. 폰은 MiniShell 사양(19/600/`--mathory-red`/무그림자) |
| 7-5 상호작용 | — | `:hover` 8개 중 화면 규칙 7개를 `@media (hover: hover)`로(`:1012`는 `:952-953`과 쌍). 스크롤바(`:260`)는 무해 |

---

## 8. 단계(Stage) · 검수

### 8-0. 로컬 검증 환경 (T-1 — 착수 전 준비)

**A. Chrome 기기 모드(1차 검증, 대부분 여기서 끝난다)**
- `npm run dev` → Chrome에서 `http://localhost:3000` → DevTools(⌥⌘I) → 기기 툴바(⇧⌘M).
- 프리셋에 iPhone 15가 없으면 **Edit… → Add custom device**: 이름 `iPhone 15`, **393 × 852**, DPR **3**, 종류 **Mobile**, UA `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`. 소형 검증용 `Galaxy S24` 384×824 DPR 3 Mobile(UA에 `Android … Mobile`)도 하나.
- 기기 모드가 **재현하는 것**: 뷰포트·DPR · 터치 이벤트(`pointer:coarse`, `hover:none` → `@media (hover:hover)` 가드와 D2의 matchMedia가 그대로 동작) · **UA 문자열 + `Sec-CH-UA-Mobile: ?1`**(종류 Mobile일 때 클라이언트 힌트도 함께 위장 → **D2 서버 분기가 dev 서버에서 그대로 검증된다**) · 회전 버튼(D3 검수).
- **재현 못 하는 것**(실기기 항목으로 고정): `100dvh`의 주소창 신축 · `env(safe-area-inset-*)`(항상 0, T-6) · iOS `signInWithPopup` 동작 · 가상 키보드·IME(Stage 3·4) · **안드로이드 ①~⑳ 폴백**(Mac에 Apple SD Gothic Neo가 있어 `local()`이 항상 잡힌다 → Rendering 패널 **"Disable local fonts"**를 켜면 gstatic 폴백 경로를 강제로 탈 수 있다, T-5) · GeoGebra 터치.
- 서버 분기 단독 확인: `curl -s -A "…iPhone…" -H "Sec-CH-UA-Mobile: ?1" http://localhost:3000/p/<id> | grep -c data-phone` → 1이면 폰 셸, 헤더를 빼고 다시 → 0.

**B. 실기기(Stage 1~4 검수의 최종 판정)**
- 같은 Wi‑Fi: `next dev -H 0.0.0.0` → 폰에서 `http://<Mac IP>:3000`. **Google 로그인은 여기서 실패한다**(Firebase Auth 승인 도메인에 IP는 못 넣는다) — 열람·수식·시트·회전 검수는 가능.
- 로그인까지 검수하려면 **Tailscale**: Mac에서 `tailscale serve --https=443 localhost:3000` → `https://<mac>.<tailnet>.ts.net`을 Firebase 콘솔 Authentication → 승인된 도메인에 추가. HTTPS라 PWA 후속(§10)에도 그대로 쓴다.
- 원격 검사: iPhone은 설정 → Safari → 고급 → 웹 속성 검사기 ON 후 Mac Safari 개발자 메뉴에서, Android는 `chrome://inspect`.
- 카카오톡 인앱 브라우저는 실기기에서 링크를 카톡 나에게 보내 열어 검수(Q10).

**C. (선택) 자동 스크린샷** — Playwright는 devDependency가 아니다. CLI Claude가 자기 검수용으로 `npx playwright`의 `devices['iPhone 15']`로 dev 서버를 찍는 스크립트를 쓸 수는 있으나 저장소에 넣지 않는다(의존성 추가 금지, 덕수 확정 전).

### 8-1. Stage

| Stage | 내용 | 검수 (A = 기기 모드 · R = 실기기 iPhone 6.1" Safari + Galaxy Chrome + 카카오톡 인앱) |
|---|---|---|
| **0** | `lib/device.ts`+테스트 · `lib/deepLink.ts` · `useIsPhone` · `ResponsiveShell` · viewport · `AppShell 100dvh` · `:hover` 격리(7+쌍) · `Wordmark` · `FONT_SIZE_*` 이동 · `Z_SHEET` · **`/`·`/bazaar` 서버 컴포넌트화** | `npm run test:device` 통과(태블릿 UA 2줄 포함) · 데스크톱 3곳 워드마크 픽셀 동일(그림자 포함) · A: PC 창 599×800(fine) 폰 / 1200×500(fine) 데스크톱 · 빌드 출력 `/`·`/bazaar` ƒ 기록 · **비로그인 데스크톱 `/bazaar` 현행 동일**(F-1 이전 검증) |
| **1** | `PhoneShell` · `BottomSheet` · `PhoneBazaar` | A: 비로그인 Bazaar 진입·검색·게시물 → `/p` · 시트 스크롤 잠금 · 시트 위 confirm이 시트를 덮음(Z_SHEET) · R: **안드로이드 ①~⑳**(또는 A+Disable local fonts) · safe-area 하단 여백(T-6) |
| **2** | `PhoneReader` + `/p`·`/shared` · ⋯ 시트 · 글자 크기 · 수식 스크롤 · 참조 탭 · svg/ggb | A: rail·dot 좌표 11/15/24 카드 안 · display 수식만 스크롤 + callout 이중 들여쓰기 없음 · 요약 보기 토글 · 문제 보기 알약 시트 · body 가로 overflow 0 · 회전 시 안 깨짐 · R: 핀치 확대 · **참조 말풍선 합성 mouseover 판정 → D15 (a)/(b)** · GeoGebra 터치(Q3) · `100dvh` 주소창 |
| **3** | `PublicComments` 시트 | A: 익명 읽기 + Google 버튼 · R: 로그인 작성 · 스와이프 닫힘 · **카카오톡 인앱 Google 로그인**(Q10) · iOS 키보드 가림(D9④) |
| **4** | `PhoneApp`(로그인 화면·내 문항·받은 문항·폴더·문항 메뉴) + 앱 열람 + 댓글/agent 시트 | 편집 진입점 0 · agent 아이콘 = 오너 + (멤버&&commentsVisible), 비멤버 미노출 · `canComment=false` 입력 UI 없음 · 받은 문항 가려진 탭 미노출 · R: 앱 댓글 CodeMirror IME(한글 조합·`$`) · 딥링크 `?view=p&id=` 로그인 상태 동작 · 비로그인 `/` 로그인 화면 |
| **5** | CLAUDE.md(§11) · `docs/phasedocs/` · roadmap | 배포 후 ⇧⌘R(PC) + 폰 캐시 삭제 |

각 Stage는 배포 가능 단위. Stage 2가 핵심(수요 90%가 오는 `/p`).

---

## 9. 확정 결정 (Q1~Q11 — 2026-09-07 덕수, 전항 권장안)

| # | 질문 | 확정 |
|---|---|---|
| Q1 | agent 열람 "회원" | **오너 + 그 문항의 멤버, 규칙 변경 0.** 멤버는 `commentsVisible` 포함 |
| Q2 | "PC 화면으로 보기" 기억 | **sessionStorage**(탭 수명). forceDesktop은 matchMedia보다 먼저(F-5) |
| Q3 | svg·ggb | **켠다** — 분기 신설 + `next/dynamic ssr:false` |
| Q4 | Bazaar 과목 칩 | **보류, 검색만** |
| Q5 | rail 거터 2.2em | **유지** |
| Q6 | 판별식 | `w≤599 ∨ (h≤599 ∧ coarse)` + UA는 태블릿 제외(F-2) |
| Q7 | 글자 기본 | **15 공유**(`lib/constants.ts`) |
| Q8 | 요약 보기 기본 | **full**(코드 0줄) |
| Q9 | 데스크톱 agent 멤버 확장 | **후속** — 비대칭 의도 명문화 |
| Q10 | 인앱 브라우저 로그인 | 현상 유지 + Stage 3 검수. 실패 시 "기본 브라우저로 열기" 안내 |
| Q11 | 비로그인 폰 `/` | 로그인 화면 + Bazaar 둘러보기 |

---

## 10. 후속 과제

PWA(manifest + 512px 마스터 + standalone — Tailscale HTTPS로 사전 검증 가능) · 데스크톱 agent 멤버 확장(Q9) · Bazaar 칩(Q4) · 인앱 로그인 개선(Q10) · 큰/작은 폰 튜닝(E1) · 가로 보기(E2) · 공개 문항 agent 열람 확대(Q1-b) · 폰 알림. 폰 편집은 하지 않는다(E4).

---

## 11. CLAUDE.md 개정 항목 (Stage 5)

1. 「핵심 파일 구조」: `components/phone/` · `PhoneShell` · `BottomSheet` · `BazaarLanding` · `lib/device.ts` · `lib/deepLink.ts`, `test:device`·`test:deeplink`.
2. 「핵심 패턴」 규약: **"폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 `[data-phone]`만 본다 — 판별용 `@media` 금지, `@media (hover: hover)`만 허용. 판별식 `w≤599 ∨ (h≤599 ∧ coarse)`, 서버 UA 추정은 태블릿(`iPad`·`Tablet`·`Mobile` 없는 `Android`) 제외. forceDesktop은 matchMedia보다 먼저."**
3. 우측 드로어 3종 규약에 **"데스크톱 한정 · 폰은 BottomSheet(Z_SHEET 9500, 다이얼로그·말풍선 아래)"**.
4. `[data-phone]` CSS 추가 시 동특이도 순서 의존을 취소 규칙으로 제거(함정 4).
5. **라우트 page.tsx는 서버 컴포넌트로 두고 클라이언트 로직은 `components/`로** — `/`·`/bazaar` 전환 이후 되돌리지 말 것(F-1). `next/dynamic`은 viewer 2종에만, 반드시 `ssr:false`.
6. `MiniShell.tsx:13` U8 해소 · `AppShell 100dvh` · `FONT_SIZE_*`는 `lib/constants.ts` 소유.
7. 판별 기기 표(D1)·탈출구(D4)·agent 게이트 비대칭(Q9) 명문화.
8. 「작업 규칙」에 §8-0 요지: 폰 검수는 기기 모드(A)로 먼저, `100dvh`·safe-area·로그인·IME·①~⑳ 폴백은 실기기(R). 실기기 로그인 검수는 Tailscale 도메인을 Firebase 승인 도메인에 등록.
