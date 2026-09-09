# Phase 64 구현 계획서 — 휴대폰 열람 전용 화면(모바일 웹) (v4 — CLI 착수판)

> 대상: CLI Claude (구현 착수) · 원시 자료: 목시 캔버스 「Mathory 모바일 열람 화면」(web, 2026-09-07, 7장) · 덕수 전제 확정(2026-09-07) · 결정 Q1~Q11 전항 확정(권장안)
> 계보: v1(web) → v2(CLI 실측 교차검토 — E-1~E-9 · S-1~S-11) → v3(web 재검증 — F-1~F-5 · T-1~T-6 · §8-0) → **v4(CLI 착수판, 2026-09-09 — v3 전항 실측 재확인(오류 0) + HEAD 재앵커링 G-1~G-5)**
> 진실 원천: **로컬 main `a7ee791`** (M6 6차 검수 종결 후 · push 대기 — v3 앵커 `1c171ad`에서 **33커밋 이동**: Phase 65 · 61g · M6). 인용 라인은 v4에서 전량 이 해시로 재실측했다. ⚠ Phase 64 커밋은 M6 push 뒤 그 위에 쌓는다.
> 범위: 휴대폰(판별식 D1) 접속 시 **열람 전용 셸**로 분기. 공개 라우트(`/p`·`/shared`·`/bazaar`) + 로그인 앱(`/`)의 열람(내 문항·받은 문항·Bazaar·agent 열람). **편집 없음.**
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

이것은 **모바일 웹**이다 — 같은 Next.js 앱 안에서 휴대폰이면 `PhoneShell`을, 그 외(PC·태블릿·폴더블 펼침)는 지금 화면을 그대로 낸다. 네이티브 앱·스토어·별도 코드베이스는 없다.
데스크톱 컴포넌트는 **한 줄도 바꾸지 않는 것을 목표**로 하고(예외 목록 §5-3, 전부 데스크톱 픽셀 무변경), `MiniShell`을 참조로 새 셸을 만들며, 이미 폭에 유연한 부품(`ProblemTabContent`·`PublicComments`)을 재사용한다.
**서버 0 · Firestore 규칙 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI + 라우트 page.tsx **2개**의 서버 컴포넌트화(`/`·`/bazaar`).

---

## 0-1. 판본 정정 계보 (요약 — 상세는 v2 §0-1 · v3 §0-1·0-2)

- **v2(E-1~E-9)**: 판별식 자기모순 해소(coarse 결합) · :hover 8개 · 글자 기본 15 · `resizable` prop 불필요 · svg/ggb 분기는 신설 · 기기 수치 393×852 · RefTooltip 합성 mouseover · ContextMenu 미검증 단서. 보완 S-1~S-11(멤버 commentsVisible 게이트 · 비로그인 폰 홈 · 인앱 로그인 · BottomSheet 규약 4 · callout 수식 취소 규칙 · Wordmark textShadow · `/` ○→ƒ · outline 기본 full · 딥링크 로그인 전제 · mtv 필터).
- **v3(F-1~F-5 · T-1~T-6)**: **`/bazaar`도 `'use client'`**(서버화 대상 2개) · UA 정규식 태블릿 오탐 수정 · PdfDialog 재발견(`components/problem/`) · forceDesktop을 matchMedia보다 먼저 · §8-0 로컬 검증 환경 · `next/dynamic ssr:false`(저장소 첫 도입) · ResponsiveShell 두 엘리먼트 패턴 확인.
- **v4(G-1~G-5, 아래)**: v3 전항 실측 재확인(**신규 오류 0**) + 33커밋 드리프트 재앵커링.

## 0-2. v3 → v4 재앵커링 (G-1~G-5, `a7ee791` 실측)

| # | 항목 | 내용 |
|---|---|---|
| **G-1** | **기준 커밋 이동** `1c171ad` → `a7ee791`(Phase 65 편집창 줄바꿈 · 61g 검증 태그 확장 · M6 디자인 조정 — 인용 파일 18개 변경). 본문 라인 인용은 전량 재실측 값이다. 이동분: ProblemView agent 게이트 `:819` · PdfDialog 소비 `:1262` · globals `:hover` 8개(`:329`·`:937`·`:938`·`:943`·`:1021-1022`·`:1076`·`:1081`) · Sidebar 워드마크 `:771-775` · AppShell HomeView `:1075-1077` · CommentPanel 루트 `:883` · TabBody svg 분기 `:142` 등. **불변 확인**: `FONT_SIZE_*`(ProblemView:41-45) · `WIDTH_EM_*`(constants:36-39) · firestore.rules · RefTooltip · SizeStepper(14×11) · PublicViewerShell · useOutlineState 기본 'full' · AppShell `100vh`(:803) |
| **G-2** | **D11 개정 — M6 카드 위계 편입.** v3 D11의 "radius 6(`CARD_RADIUS`)"은 **폐기된 세계다** — M6가 `CARD_RADIUS = 0`(풀이) · `CARD_RADIUS_QUESTION = 12`(문제)로 바꾸고(TabBody:55·61) 문제 카드에만 `--card-shadow-problem`(globals:96, 드로어의 절반 강도 2겹)을 준다. 판별 `!isToneScoped(tab.id)`(:95·315-316), 테두리는 둘 다 0.5px `--border-content`. **폰 리더 카드도 이 위계를 그대로 따른다**(E3 통일성 — "읽는 대상/쓰는 대상"을 모서리·그림자로 가르는 언어를 폰만 다르게 말할 이유가 없다). hold-to-peek 카드가 이미 `CARD_RADIUS_QUESTION`을 쓴다(ProblemView:995 "M6 D9") — 폰 문제 카드 12와 자연 정합 |
| **G-3** | **v3 신규 주장 전항 실측 일치**: F-1(`app/bazaar/page.tsx` `'use client'` + `useAuth`/`useRouter` 리다이렉트 + `miniShellSubRowStyle` 소비) · F-3(`components/problem/PdfDialog.tsx:50` minWidth 260/maxWidth 340) · T-3(입력창 세로 리사이즈 `:1079`) · B-3(`:922` SelectionInsertPopup · `:1071` canComment 게이트) — 전부 확인. F-2 UA 정규식은 Android 폰/태블릿 · iPad 두 모드 · Firefox Android 폰/태블릿 전 갈래 추적으로 논리 확인 |
| **G-4** | **M6 신규 규약과 폰의 접점**: ① `useHoverTip` 소비처는 ListView·UnifiedToolbar뿐 — 폰 트리 무접촉(hover 들러붙음 걱정 없음) ② 전역 체크박스 커스텀 도안(globals:266-282) — 폰 1차 UI에 체크박스 없음, 쓰게 되면 자동 적용 ③ **폰 신규 UI의 색은 M6 팔레트 규약(아이보리·클레이·빨강 + 성공 올리브)을 따른다** — hex 금지, 토큰으로 ④ 사이드바 헤더 bold 3종·스테퍼 제목행 이전은 데스크톱 전용이라 무접점 |
| **G-5** | MiniShell 워드마크는 `<div style={logoStyle}>`(`:33`, logoStyle `:78-81`) — v3 서술과 동일 사양(19/600/`--mathory-red`/무그림자), 위치만 갱신 |

---

## 1. 전제 (덕수 확정, 2026-09-07)

| # | 전제 | 계획 반영 |
|---|---|---|
| E1 | **6.1인치급** 최다 사용 폰 크기에 맞춘다 | 기준 뷰포트 **393×852 CSS px**(iPhone 15/16 · Galaxy S 384~412 대표). 360·430은 **깨지지만 않게**, 튜닝은 §10 |
| E2 | **세로 보기만** | 폰 가로에서도 가로 레이아웃을 따로 만들지 않고 세로 레이아웃이 그대로 늘어난다(D3) |
| E3 | 색·아이콘·글꼴·로고를 그대로 쓸 수 있는지 확인 | §7 점검 완료 — **전부 그대로 쓴다.** 부채 정리 3건(아이콘 크기 상향·워드마크 공용화·hover 격리) + 워드마크 textShadow 복제 + **카드 위계는 M6 언어 그대로**(G-2) |
| E4 | 폰에서 **편집은 하지 않는다** | 폰 셸에 `EditorView` 진입점 0. 문항 메뉴 '편집'은 비활성 + "PC·태블릿에서" |
| E5 | **agent 화면**도 로그인 회원에 한해 **열람** | `CommentPanel mode='agent' canComment={false}`. "회원" = 오너 + 그 문항의 멤버(Q1), 멤버는 `commentsVisible` 게이트 포함(P4) |
| E6 | 폰이면 폰 셸, 폴더블 펼침·태블릿·PC = 기본 화면 | D1·D2 |
| E7 | 목시 기본 구조 승인 — 상단 바 고정·2탭·바텀 시트·하단 탭 3개 | §6이 목시 7장과 1:1 대응 |

---

## 2. 타당성 판정 (P1~P5 — 확정)

| # | 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | 서버 UA 힌트로 첫 렌더 선택 | **`app/page.tsx`와 `app/bazaar/page.tsx`가 `'use client'`** → `headers()` 불가. `/p`·`/shared`는 서버 컴포넌트(`generateMetadata`) | 두 페이지를 서버 컴포넌트로: `/`는 `'use client'` 제거, `/bazaar`는 본문을 `BazaarLanding.tsx`로 추출(F-1 — `miniShellSubRowStyle` import 포함 이전). 빌드 출력 `/`·`/bazaar` ○→ƒ — 실질 무해, Stage 0 기록 |
| **P2** | 폰 셸을 AppShell 안에서 분기 | `AppShell.tsx`(1,100줄+)는 loadData·DnD·뷰 상태 한 몸 | **최상단 조기 반환 1줄** `if (isPhone) return <PhoneApp user … />`. `PhoneApp`은 자기 데이터를 자기가 읽는다(`listProblems`·`listRecentProblems`·`listSharedWithMe`·`listFolders` — `AppShell.tsx:182-227` 실측). 상태 공유 0 |
| **P3** | 앱 열람뷰를 폰에 이식 | `ProblemView` 최소 폭 758px(라벨 열 7em + 카드 600), `WIDTH_EM_MIN 35`(constants:36-39) | **이식하지 않는다.** 폰 리더는 `ProblemTabContent`(props 2개, `width:100%`)로 새로 조립. 라벨 열은 탭이 대신 |
| **P4** | agent를 "로그인 회원"에게 | UI 게이트 `ProblemView.tsx:819` `user && isOwnerView`(오너 전용). 실제 인가는 규칙: 세션 read = 오너∨멤버(`firestore.rules:333`), 메시지 read = 오너∨(멤버∧`commentsVisible()`)(`:200-202, 234-236`) | "회원" = 오너+멤버(Q1), 규칙 0. 폰 아이콘 노출 = `오너 OR (멤버 && problem.commentsVisible !== false)`. 데스크톱 오너 전용 유지(Q9) — **비대칭은 의도**, PC 확장은 §10 |
| **P5** | 우측 드로어 3종 규약 | `CommentPanel` 루트 self-positioned(`:883` `absolute; top/right/bottom: DRAWER_INSET(8); width; maxWidth:90vw; zIndex:50`) | 규약은 **데스크톱 한정**, 폰은 바텀 시트 문법(D9). positioned 래퍼 + `width:'100%'`로 무변경 재사용, 인셋 8은 시트 여백으로 흡수. `SelectionInsertPopup`(`:922`)만 `selectionPopup` prop으로 차단(E-5: 리사이즈 핸들은 소비처 소유라 prop 불요) |

---

## 3. 확정 사실 (전부 `a7ee791` 실측)

### A. 진입·판별

| # | 사실 | 위치 |
|---|---|---|
| A-1 | `app/page.tsx` = `'use client'` + `<AppShell />`. **`app/bazaar/page.tsx`도 `'use client'`**(useAuth·useRouter, 로그인 시 `/?view=bazaar` replace, `miniShellSubRowStyle` 소비). `/p`·`/shared`는 서버 컴포넌트. `next.config.*`·`vercel.json` 없음. `viewport` export 없음 | `app/page.tsx:1-7`, `app/bazaar/page.tsx:1-44` |
| A-2 | UA·`pointer:coarse`·`matchMedia` 사용 0건. `next/dynamic` 사용 0건. 폭 분기는 `PublicViewerShell.tsx:35`(≥880)와 `BazaarView.tsx:40-48`(620/480) 둘뿐 | grep 전수 |
| A-3 | `AppShell` 루트 `height:'100vh'`(`:803`). `MiniShell.tsx:29`·`bazaar/page.tsx`는 `100dvh` | 불일치 |
| A-4 | AppShell은 로그인 화면을 따로 안 그린다(비로그인도 Sidebar+main, loadData만 user 게이트). 딥링크 effect는 `if (!user …) return`(`:254-256`) — 로그인 후에만, 1회 읽고 `replaceState('/')` | `AppShell.tsx:182-227, 254-278` |
| A-5 | 루트 레이아웃이 `<DialogHost/>`·`<RefTooltip/>` 전역 1회 마운트 → 폰 셸도 공짜. `dialogBody` `maxWidth:92vw, maxHeight:88vh` | `layout.tsx`, `dialogStyles.ts` |

### B. 재사용 부품

| # | 사실 | 위치 |
|---|---|---|
| B-1 | `ProblemTabContent({blocks, tabId})` — props 2개, 요약 토글 내장(question 제외), **svg·ggb 분기 없음**(TabBody 헤더 "통합하지 않는다 D16"). `useOutlineState(sorted)` 기본 **'full'** | `ProblemTabContent.tsx:29`, `useOutlineState.ts:38` |
| B-2 | `PublicComments({problemId, commentSessionId, writeEnabled?})` — 자기 구독·auth·로그인 버튼 내장, 루트 `width:100%`, 위치 미지정 | `PublicComments.tsx` |
| B-3 | `CommentPanel` — `canComment=false`면 입력·AI 칩·검증 칩 블록이 통째로 안 그려짐(`:1071`). 루트 self-positioned(`:883`). `width`는 `number\|string`. `SelectionInsertPopup` `:922` 내부 마운트. 입력창 세로 리사이즈 핸들 `:1079-`(pointer 이벤트 — agent에선 입력째 사라져 무관, 앱 댓글에선 터치 무해라 그대로 둠) | `CommentPanel.tsx` |
| B-4 | `PublicViewerShell` = 880 미만 1단+탭 폴백 기존재. 카드 padding 좌우 124px 고정 소모·fontSize 15 하드코딩·aside 380 — **폰 리더로 안 쓰고 참조만** | `PublicViewerShell.tsx`(무변경 확인) |
| B-5 | hold-to-peek 알약은 이미 `onPointerDown/Up/Cancel` + `touchAction:'none'`(`:918-937`), 페이크 = `TabBody hideLabel` + `maxHeight:80vh` + **radius `CARD_RADIUS_QUESTION`(:995, M6 D9)** | `ProblemView.tsx` |
| B-6 | `RefTooltip` = document 4리스너(mouseover/mouseout/scroll capture/resize), `DELAY_MS 500`, 게이트 `[data-ref-tooltip]`, `Z_TOOLTIP`(10400). 터치 탭은 합성 mouseover를 발화 | `RefTooltip.tsx`(무변경 확인) |
| B-7 | `SvgViewer` pinch 활성, `GgbViewer` 전체화면 `fixed; inset:0` + `100vw/100vh`, `window.GGBApplet` 의존 | |
| B-8 | `SizeStepper` 버튼 14×11(`:15-19`, 무변경) — 터치 미달, 폰은 시트 안 44×36 새로 | `SizeStepper.tsx` |
| B-9 | `ContextMenu` document mousedown 닫기(합성 mousedown으로 닫힐 가능성 높음 — 미검증·폰 무관). `BazaarView` 게시물 액션 `mine && hovered`(`:270`) | |
| B-10 | PDF: `components/problem/PdfDialog.tsx`(`:50` 260/340) ← `ProblemView.tsx:12, 1262` · `lib/pdfPrint.tsx:108`. 폰 트리는 ProblemView·EditorView를 안 그린다 | F-3·G-1 |
| B-11 | **M6 카드 위계(G-2)**: `CARD_RADIUS = 0`(풀이) · `CARD_RADIUS_QUESTION = 12`(문제) 둘 다 **TabBody가 export** · 문제만 `--card-shadow-problem`(globals:96) · 판별 `!isToneScoped(tab.id)` · 테두리 공통 0.5px `--border-content` | `TabBody.tsx:55, 61, 315-316` |

### C. 데이터 경로

| # | 사실 | 위치 |
|---|---|---|
| C-1 | 폴더·문항·받은 문항: `AppShell.loadData`(`:182-227`)가 `listProblems`·`listRecentProblems(uid,10)`·`listSharedWithMe`·`listSharedByMe`·`listFolders` 직접 호출. 최근 문항 휴지통 제외 | `lib/firestore.ts` |
| C-2 | Bazaar: `listBazaarFeed(q)`(`lib/bazaar.ts:100`), `BazaarView({uid, filter, onOpenPost?})` | |
| C-3 | 앱 열람 = `getProblemWithBlocks` 1회 + **멤버 `memberTabVisibility` 필터**(`ProblemView.tsx:555-559`). 공개 = `watchProblem`+`watchTabBlocks` 실시간 + 같은 필터(`PublicProblemView.tsx:44-49`). 미통합 | |
| C-4 | agent = `discussion_sessions`(`'normal'`) + `tab_comments`(`commentStream=false`). 세션 read 오너∨멤버 / 메시지 read 오너∨(멤버∧commentsVisible) | `firestore.rules:200-202, 234-236, 333`(무변경 확인) |

### D. 색·글꼴·아이콘·로고

| # | 사실 | 위치 |
|---|---|---|
| D-1 | 글꼴 링크 3(Pretendard·Google Fonts·KaTeX 0.16.28) + `@font-face` 2(D2Coding · **MathoryCircled** `local()` 3종 → gstatic 폴백, ①~⑳, size-adjust 88%) | `layout.tsx`, `globals.css:37-47` 부근 |
| D-2 | 안드로이드엔 `local()` 3종이 전부 없어 gstatic 폴백이 실경로. **Mac DevTools 재현 불가 → "Disable local fonts"**(T-5) | |
| D-3 | 워드마크 인라인 3벌: MiniShell(`:33`·`:78-81`, 19/600/`--mathory-red`/무그림자) · Sidebar(`:771-775`, 19/400/`#944728` + `textShadow 0 1px 0 rgba(0,0,0,0.06)`) · HomeView(`AppShell.tsx:1075-1077`, 48/400/`--mathory-red-dark` + 같은 그림자) | |
| D-4 | Phosphor regular 단일(현재 61종), `phIcon(d, defaultSize)` size 자유, "최소 14px" | `Icons.tsx` |
| D-5 | `@media` 0개, `:hover` **8개**: `:329`(스크롤바) · `:937` · `:938` · `:943` · `:1021-1022` · `:1076` · **`:1081`(.case-head.is-static — :1021-1022의 취소 규칙, 쌍으로 이동)** | `globals.css` |
| D-6 | 색 토큰 `:root` 한 벌·다크 없음. 명암비 구속 `#E8DFCE`. **M6 팔레트 규약: 신규 색은 hex 금지·토큰으로**(아이보리·클레이·빨강 + 성공 올리브) | CLAUDE.md M6 절 |
| D-7 | `FONT_SIZE_KEY 'mathory-content-font-size'` · DEFAULT 15 · MIN 11 · MAX 24 — `ProblemView.tsx:41-45` 지역 상수 | |
| D-8 | 로그인은 전부 `signInWithPopup`(`MiniShell.tsx:25` 등) — 카톡·인스타 인앱 웹뷰 실패 사례 알려짐. redirect 전환은 Safari ITP가 별개 이슈라 안 한다(Q10) | |

---

## 4. 결정 (D1~D16 — 확정)

### 판별·진입

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **`lib/device.ts` 신설(import 0).** `PHONE_MAX_SHORT_SIDE = 599`. `isPhoneViewport(w, h, coarse) = w <= 599 \|\| (h <= 599 && coarse)`. **`guessPhoneFromHeaders(ua, chUaMobile)`**: `chUaMobile` 있으면 `=== '?1'`만; 없으면 `if (/iPad\|Tablet\|Android(?!.*Mobile)/i.test(ua)) return false; return /iPhone\|iPod\|Android.*Mobile\|Mobi/i.test(ua)`(F-2). `tests/device.test.mjs` 기기 표: iPhone 15 393×852 coarse → 폰 · S24 384×824 coarse → 폰 · 폰 가로 852×393 coarse → 폰 · PC 1200×500 fine → 데스크톱 · PC 599×800 fine → 폰 · Z Fold 펼침 673×841 → 데스크톱 · Pixel Fold 883×736 → 데스크톱 · iPad mini 744×1133 → 데스크톱 · UA: Android 태블릿(Mobile 없음) false · iPad "모바일 웹사이트" UA false · `?0`+Android UA false | E6·E-1·F-2 |
| **D2** | **두 겹 판별.** ① 서버: page.tsx(서버)가 `headers()`로 `guessPhoneFromHeaders(ua, sec-ch-ua-mobile)` → `initialPhone` prop. ② 클라: `hooks/useIsPhone.ts` — 첫 렌더는 `initialPhone` 그대로(hydration 0), effect에서 `matchMedia('(max-width:599px), ((max-height:599px) and (pointer:coarse))')` 보정 + change 구독. iPadOS Safari(Macintosh UA)는 데스크톱으로 찍고 그게 맞다 | P1 |
| **D3** | **가로 레이아웃 없음.** 상단 바 52 + 탭 44 = 96px 고정, 나머지 스크롤 | E2 |
| **D4** | **탈출구 = ⋯ 시트 "PC 화면으로 보기".** `sessionStorage['mathory.forceDesktop']='1'`(탭 수명, Q2). effect에서 **forceDesktop을 matchMedia보다 먼저** 읽고, 참이면 matchMedia 구독 자체를 건너뛴다(F-5). 서버 첫 렌더가 폰일 수 있어 한 번 다시 그려지는 것 허용. 데스크톱 쪽 복귀 버튼 없음 | Q2·F-5 |
| **D5** | `app/layout.tsx`에 `export const viewport = { width:'device-width', initialScale:1, viewportFit:'cover' }`. `maximumScale` 없음(수식 핀치 확대는 독자의 권리) | A-1 |

### 셸·라우팅

| # | 결정 | 근거 |
|---|---|---|
| **D6** | **`components/layout/PhoneShell.tsx` 신설** — props `{ title?, left?: 'back'\|'wordmark', right?, tabs?, footer?, children }`. 루트 `height:100dvh` flex 열 + **`data-phone` 속성**, 상단 바 52(`--bg-functional`, 하단 1px `--border-light`), 본문 `flex:1; overflow:auto`(문서 자체는 스크롤 안 함 — 시트 스크롤 잠금이 쉬워진다), footer `padding-bottom: env(safe-area-inset-bottom)`. `MiniShell.tsx:13` U8 주석 갱신 | P2 |
| **D7** | **공개 라우트 3개는 page.tsx에서 셸만 바꾼다.** `<ResponsiveShell initialPhone phone={…} desktop={…}>`(클라, `useIsPhone` 소비). `/bazaar`는 `BazaarLanding.tsx`(클라) 추출 후 그 안에서 ResponsiveShell(F-1). `PublicProblemView`·`SnapshotView`에 `reader?: 'desktop'\|'phone'` prop 1개 | F-1 |
| **D8** | **로그인 앱 = AppShell 조기 반환 1줄 + `PhoneApp`.** 뷰 상태 `home\|folder\|received\|bazaar\|problem\|agent` 자체 소유·데이터 자체 로드(받은 문항 열람에 `memberTabVisibility` 필터·휴지통 제외 직접 적용 — C-3의 `ProblemView.tsx:555-559`와 같은 규칙). 딥링크는 `lib/deepLink.ts`(import 0) 공용, 둘 다 로그인 후만(현행). 하단 탭 3 = 내 문항·받은 문항·Bazaar. **비로그인 폰 `/` = 로그인 화면**(Q11): 워드마크(48 사양)+슬로건+Google 로그인+"Bazaar 둘러보기"(하단 탭 Bazaar만 활성) | P2·A-4 |
| **D9** | **`components/ui/BottomSheet.tsx`** — `{ open, height, onClose, children }`. `position:absolute`(PhoneShell 루트 기준) 바닥 고정, `--bg-drawer`+`--drawer-shadow`, 그립 36×4 `--border-content`, 딤 `rgba(45,42,35,0.32)`, 닫기 = 딤 탭+그립 드래그(60px)+X. 애니메이션 0.2s 하나. 규약 4: ① `dialogStyles.ts`에 **`Z_SHEET = 9500`**(`Z_TOOLTIP` 10400·`Z_DIALOG` 10500 **아래** — 시트 안에서 띄운 confirm·말풍선이 시트를 덮어야 한다) ② 열림 중 PhoneShell 본문 `overflow:hidden` ③ 시트도 `padding-bottom: env(safe-area-inset-bottom)` ④ iOS 키보드 가림은 실기기 검수(visualViewport 보정은 실측되면) | P5 |

### 리더

| # | 결정 | 근거 |
|---|---|---|
| **D10** | **`components/phone/PhoneReader.tsx`** = 상단 바(←·제목·💬n·⋯) + 탭(문제/풀이 2등분 44px, 활성 accent 2px 밑줄) + 탭당 `ProblemTabContent` 카드. 탭 비영속(진입 시 문제 탭). 문제 탭 하단 `[풀이 보기]`(48px), 풀이 탭 상단 `[문제 보기]` 알약(32px → 시트에 문제 카드). 요약 보기 기본 **full**(Q8, 코드 0줄) | E7·B-1 |
| **D11** | **카드 = M6 위계를 그대로 따른다(G-2)**: 배경 `--bg-content` · 테두리 0.5px `--border-content` · **문제 탭(=`!isToneScoped(tabId)`) radius `CARD_RADIUS_QUESTION`(12) + `--card-shadow-problem` / 풀이 계열 radius `CARD_RADIUS`(0) + 그림자 없음** — 상수는 **TabBody의 export를 import**(사본 금지), 판별은 `lib/keyTone.ts`의 `isToneScoped` 공용. 좌우 margin 10, padding `1.1em 1em 1.2em 2.2em`, 글자 기본 15, `line-height 1.8`. 좌 2.2em = 경우 rail·dot 거터 보존(Q5). `--card-pad-l/r` = `2.2em`/`1em`. 본문 폭 393−20−33−15 = **325px ≈ 21.7em@15**. ⚠ 풀이 직각 카드가 폰 좁은 화면에서 자연스러운지는 Stage 2 실물 판정 항목 | G-2·목시 |
| **D12** | **글자 11~24, 기본 15, `localStorage 'mathory-content-font-size'` 공유**(Q7). `FONT_SIZE_*` 4종을 `lib/constants.ts`로 이동·export, ProblemView·폰 공용(값 무변경). 스테퍼는 ⋯ 시트 안 44×36 버튼(SizeStepper 14×11은 안 씀) | D-7·B-8 |
| **D13** | **수식 넘침 = 수식만 가로 스크롤.** `[data-phone]` 3규칙: ① `.katex-display { padding-left:1em; overflow-x:auto; overflow-y:hidden }` ② `.callout-block { padding-left:1em }` ③ `.callout-block .katex-display { padding-left:0 }`(동특이도 순서 의존 차단 — 기존 `.callout-block .katex-display` 규칙과 (0,2,0) 동률). `@media` 아님(함정 2) | S-6 |
| **D14** | **svg·ggb(Q3)**: `ProblemTabContent`에 `viewers?: boolean`(기본 false) 분기 **신설**, TabBody `:142-` 와 같은 렌더. `SvgViewer`·`GgbViewer`는 **`next/dynamic(…, { ssr:false })`**(저장소 첫 사용 — GgbViewer가 `window.GGBApplet`을 만진다). GgbViewer 전체화면 `100vh → 100dvh`. GeoGebra 터치는 Stage 2 실기기 | E-6·T-4 |
| **D15** | **참조 말풍선 = 탭, 실기기 판정 우선.** Stage 2에서 (a) 합성 mouseover로 이미 뜨면 → `[data-phone]` 조상일 때 `DELAY_MS` 500→0 (b) 안 뜨면 → `pointerup` 리스너 + 이중 발화 가드. 말풍선 박스는 현행 유지 | E-8 |
| **D16** | **댓글·agent 시트.** 공개 댓글 = `PublicComments` 그대로. 앱 댓글·agent = `CommentPanel`을 `BottomSheet(78%)` 안 positioned 래퍼 + `width:'100%'` + `selectionPopup={false}`. **agent는 `canComment={false}` 고정**, 아이콘 노출 = `오너 OR (멤버 && commentsVisible !== false)`. 앱 댓글은 `canCommentOnProblem` 현행 — CodeMirror 폰 IME는 Stage 4 검수 | P4·B-3 |

---

## 5. 아키텍처

### 5-1. 신설 (전부 클라이언트)

| 파일 | 역할 | 추정 |
|---|---|---|
| `lib/device.ts` + `tests/device.test.mjs` + `test:device` | 판별 순수 함수(뷰포트·UA·CH) | 50줄+테스트 |
| `lib/deepLink.ts` (+`test:deeplink`) | `?view=…&id=` 파싱(import 0) | 30줄 |
| `hooks/useIsPhone.ts` | forceDesktop → initialPhone → matchMedia 보정 | 40줄 |
| `components/layout/ResponsiveShell.tsx` | `{initialPhone, phone, desktop}` | 20줄 |
| `components/layout/PhoneShell.tsx` | 프레임 + `data-phone` | 150줄 |
| `components/share/BazaarLanding.tsx` | 현행 `/bazaar` 클라 본문 이전(F-1, `miniShellSubRowStyle` 포함) + ResponsiveShell | 50줄(이동) |
| `components/ui/BottomSheet.tsx` | 시트(Z_SHEET·스크롤 잠금·safe-area) | 130줄 |
| `components/ui/Wordmark.tsx` | 워드마크 공용 — props `{size, weight, color, shadow}`, 그림자 포함 3벌 픽셀 재현 | 30줄 |
| `components/phone/PhoneReader.tsx` · `PhoneMoreSheet.tsx` · `PhoneApp.tsx` · `PhoneList.tsx` · `PhoneBazaar.tsx` · `PhoneItemMenu.tsx` | 리더·⋯시트·앱 루트·리스트·Bazaar·문항 메뉴 | 350·120·320·150·180·80줄 |

### 5-2. 데이터 흐름

```
/p/[id]   page.tsx(서버) —headers()→ ResponsiveShell ─┬─ MiniShell + PublicProblemView(reader='desktop')   ← 현행
                                                      └─ PhoneShell + PublicProblemView(reader='phone') → PhoneReader
/bazaar   page.tsx(서버) —headers()→ BazaarLanding(클라) → ResponsiveShell ─┬─ MiniShell + BazaarView
                                                                           └─ PhoneShell + PhoneBazaar
/         page.tsx(서버) —headers()→ AppShell(initialPhone) ─┬─ (현행 트리, 무변경)
                                                             └─ isPhone → PhoneApp → PhoneList / PhoneBazaar / PhoneReader
```
`PhoneReader({ problem, tabs, tabBlocks, commentsSlot?, agentSlot?, onBack })`는 표시만. 데이터는 호출자가(공개 = 실시간 구독 / 앱 = 1회 fetch + `memberTabVisibility` 필터 + 휴지통 제외).

### 5-3. 기존 파일 수정 (전부 데스크톱 픽셀 무변경)

| # | 파일 | 변경 |
|---|---|---|
| ① | `app/page.tsx`, `app/bazaar/page.tsx` | 서버 컴포넌트화 + `headers()` → `initialPhone`. 빌드 출력 ○→ƒ 기록 |
| ② | `PublicProblemView.tsx`, `SnapshotView.tsx` | `reader` prop |
| ③ | `CommentPanel.tsx` | `selectionPopup?: boolean = true` |
| ④ | `AppShell.tsx` | 딥링크 → `lib/deepLink.ts` · 조기 반환 1줄 · `:803` `100vh → 100dvh` |
| ⑤ | `ProblemView.tsx` + `lib/constants.ts` | `FONT_SIZE_*` 이동·export(값 무변경) |
| ⑥ | `ProblemTabContent.tsx` | svg/ggb 분기 추가(`viewers` 기본 false, `next/dynamic ssr:false`) |

그 외: `RefTooltip`(Stage 2 판정 후 D15 (a)/(b)) · `GgbViewer` `100dvh` · `globals.css` `[data-phone]` 3규칙 + `:hover` 7개(+`:1081` 쌍)를 `@media (hover: hover)`로 · `layout.tsx` viewport · `dialogStyles.ts` `Z_SHEET` · `MiniShell.tsx:13` 주석.

### 함정 (구현 중 상시 참조)

1. **hydration**: `useIsPhone` 초기 상태는 반드시 `initialPhone`. matchMedia·forceDesktop은 effect에서만. 보정 시 한 번 다시 그려지는 것 허용.
2. **`[data-phone]`에 `@media` 금지**: 폰 셸 여부는 훅 하나가 정하고 CSS는 결과만 본다. 예외는 `@media (hover: hover)`(입력 장치 질의).
3. **`CommentPanel` 인셋 8**: 시트 본문 `position:relative; height:100%` + `width:'100%'` → 좌 0·우 8·상하 8 — 우·상하는 시트 여백으로 흡수, 좌측만 `paddingLeft:8` 대칭.
4. **동특이도 순서 의존**: `[data-phone]` 규칙을 더할 때마다 같은 특이도의 기존 규칙 확인, 취소 규칙으로 해소(D13 ③ 전례).
5. **공개 라우트 번들**: `/p`(36)·`/shared`(29) closure에 뷰어 2종이 없다. 정적 import 금지, `next/dynamic ssr:false`만.
6. **ResponsiveShell 두 엘리먼트**(T-2): `phone`/`desktop` 둘 다 엘리먼트로 생성되지만 마운트는 한쪽만 — effect 구독은 마운트된 쪽만 시작. 분기 전환 시 이전 쪽 cleanup 확인(`PublicProblemView`는 있다).
7. **카드 상수 사본 금지**(G-2): radius·그림자 판별을 폰 쪽에 리터럴로 다시 적지 말 것 — `CARD_RADIUS`·`CARD_RADIUS_QUESTION`(TabBody export)·`isToneScoped`를 import. M6가 값을 또 바꿔도 폰이 자동 추종한다.

---

## 6. 화면 사양 (목시 7장 + 3)

| 목시 | 화면 | 구성 | 근거 |
|---|---|---|---|
| 1 | 열람·문제 | 상단 바(←·제목·💬n·⋯) · 탭 · **radius 12+그림자** 문제 카드 · `[풀이 보기]` · 메타 · 슬로건 | D10·D11 |
| 2 | 열람·풀이 | `[문제 보기]` 알약 · **직각** 풀이 카드(dim/key · rail·dot · Tip · display 수식 1em) | D10·D13 |
| 3 | 댓글 시트 | `BottomSheet 78%` · "댓글 n" · 리스트 · Google 로그인(익명)/입력창(회원) | D16 |
| 4 | ⋯ 시트 | 글자 크기(15 기본) · 링크 복사 · Bazaar · PC 화면으로 보기 · 로그인 | D4·D12 |
| 5 | Bazaar | 상단 바(워드마크·로그인) · 검색 44+정렬 · 2행 카드 · 내 게시물 ⋯(칩 보류 Q4) | C-2 |
| 6 | 내 문항 | 상단 바(워드마크·검색·아바타) · 폴더 행 · 최근 수정 행 · 하단 탭 3 | D8 |
| 7 | 문항 메뉴 | 열람 · 공유 링크 복사 · **편집(비활성 "PC·태블릿에서")** · 폴더 이동 | E4 |
| ＋ | agent 열람 | 상단 바 `IconAgent`(오너 OR 멤버∧commentsVisible) → 시트 + `CommentPanel agent canComment=false`. 데스크톱(오너 전용)과의 비대칭은 의도(Q9) | D16 |
| ＋ | 받은 문항 | `PhoneList` ← `listSharedWithMe`, 보조줄 = 공유자·수정일, 열람 시 탭 필터 | C-3 |
| ＋ | 비로그인 `/` | 워드마크(48)+슬로건+Google 로그인+"Bazaar 둘러보기" | Q11 |

공통: 폴더 DnD·다중 선택·칼럼 조정·리사이즈·버전 드로어·PDF/인쇄·시트 가져오기·일괄 검증 → **폰 진입점 없음.**

---

## 7. 통일성 점검 (E3) — 결론: 전부 그대로 쓴다

| 축 | 판정 | 불가피한 변경 |
|---|---|---|
| 7-1 색 | 신규 팔레트 토큰 0. **폰 신규 UI 색은 M6 팔레트 규약(토큰만, hex 금지)**. `#E8DFCE` 구속은 폰에 hover가 없어 완화 | 없음 |
| 7-2 글꼴 | CDN 동일. `--katex-scale`·`line-height`·`keep-all` 그대로 | 안드로이드 ①~⑳ gstatic 폴백 — Stage 1 실기기(Mac은 "Disable local fonts", T-5). 실패 시 `public/fonts/` 자체 호스팅 |
| 7-3 아이콘 | Phosphor regular 그대로(61종). 폰 상단 바·시트·탭 22, 보조 12~14 | 14 기본 아이콘을 44 히트 영역 안에서 20~22로(하한 규칙과 충돌 없음) |
| 7-4 로고 | 글꼴·자간·색 그대로 | `Wordmark.tsx` 공용 추출 — `{size, weight, color, shadow}`로 3벌 픽셀 재현(그림자 포함). 폰은 MiniShell 사양 |
| 7-5 상호작용 | — | `:hover` 8개 중 화면 7개를 `@media (hover: hover)`로(`:1081`은 `:1021-1022`와 쌍). 스크롤바(`:329`)는 무해 |
| 7-6 카드 | **M6 위계 그대로**(문제 12+그림자/풀이 직각/테두리 공통) — 상수 import로 자동 추종 | 없음(G-2) |

---

## 8. 단계(Stage) · 검수

### 8-0. 로컬 검증 환경 (착수 전 준비 — v3 §8-0 승계)

**A. Chrome 기기 모드(1차 검증)**: DevTools 기기 툴바 → custom device `iPhone 15` 393×852 DPR 3 Mobile(UA iPhone) + `Galaxy S24` 384×824(UA Android Mobile). 재현되는 것: 뷰포트·터치(`pointer:coarse`·`hover:none`)·**UA + `Sec-CH-UA-Mobile: ?1`**(→ D2 서버 분기가 dev 서버에서 그대로 검증된다)·회전. 재현 안 되는 것(실기기로): `100dvh` 주소창 · safe-area(항상 0, T-6) · 키보드·IME · **①~⑳ 폴백**(Rendering 패널 "Disable local fonts"로 강제 가능, T-5) · GeoGebra 터치. 서버 분기 단독 확인: `curl -A "…iPhone…" -H "Sec-CH-UA-Mobile: ?1" localhost:3000/p/<id> | grep -c data-phone`.

**B. 실기기(최종 판정)**: 같은 Wi‑Fi `next dev -H 0.0.0.0` → `http://<Mac IP>:3000`(Google 로그인은 여기선 실패 — 승인 도메인에 IP 불가). 로그인까지는 **Tailscale**(`tailscale serve --https=443 localhost:3000` + Firebase 승인 도메인 등록, PWA 후속에도 그대로). 원격 검사: iOS 웹 속성 검사기 / `chrome://inspect`. 카톡 인앱은 실기기에서 링크를 카톡으로 보내 열기(Q10).

**C. (선택) 자동 스크린샷**: `npx playwright` + `devices['iPhone 15']` — 저장소 의존성으로 넣지 않는다(덕수 확정 전).

### 8-1. Stage (A = 기기 모드 · R = 실기기 iPhone 6.1" Safari + Galaxy Chrome + 카톡 인앱)

| Stage | 내용 | 검수 |
|---|---|---|
| **0** | `lib/device.ts`+테스트 · `lib/deepLink.ts` · `useIsPhone` · `ResponsiveShell` · viewport · `AppShell 100dvh` · `:hover` 격리(7+쌍) · `Wordmark` · `FONT_SIZE_*` 이동 · `Z_SHEET` · `/`·`/bazaar` 서버화 | `npm run test:device`(태블릿 UA 포함) · 데스크톱 3곳 워드마크 픽셀 동일(그림자 포함) · A: PC 599×800(fine) 폰 / 1200×500(fine) 데스크톱 · 빌드 `/`·`/bazaar` ƒ 기록 · **비로그인 데스크톱 `/bazaar` 현행 동일**(F-1 이전 검증) |
| **1** | `PhoneShell` · `BottomSheet` · `PhoneBazaar` | A: 비로그인 Bazaar 진입·검색·게시물→`/p` · 시트 스크롤 잠금 · 시트 위 confirm이 시트를 덮음(Z_SHEET) · R: 안드로이드 ①~⑳(또는 A+Disable local fonts) · safe-area 하단(T-6) |
| **2** | `PhoneReader` + `/p`·`/shared` · ⋯ 시트 · 글자 크기 · 수식 스크롤 · 참조 탭 · svg/ggb | A: rail·dot 좌표 **11/15/24** 전부 카드 안 · display 수식만 스크롤 + callout 이중 들여쓰기 없음 · 요약 토글 · 문제 보기 알약 시트 · body 가로 overflow 0 · 회전 시 안 깨짐 · **카드 위계(문제 12+그림자/풀이 직각) 실물 판정 — 덕수**(G-2) · R: 핀치 허용 · **참조 말풍선 합성 mouseover 판정 → D15 (a)/(b)** · GeoGebra 터치 · `100dvh` 주소창 |
| **3** | `PublicComments` 시트 | A: 익명 읽기+Google 버튼 · R: 로그인 작성 · 스와이프 닫힘 · **카톡 인앱 Google 로그인**(Q10) · iOS 키보드 가림(D9 ④) |
| **4** | `PhoneApp`(로그인 화면·내 문항·받은 문항·폴더·문항 메뉴) + 앱 열람 + 댓글/agent 시트 | 편집 진입점 0 · agent 아이콘 = 오너+(멤버∧commentsVisible), 비멤버 미노출 · `canComment=false` 입력 UI 없음 · 받은 문항 가려진 탭 미노출 · R: 앱 댓글 CodeMirror IME(한글 조합·`$`) · 딥링크 `?view=p&id=` 로그인 상태 동작 · 비로그인 `/` 로그인 화면 |
| **5** | CLAUDE.md(§11) · `docs/phasedocs/` 등록 · roadmap | 배포 후 ⇧⌘R(PC) + 폰 캐시 삭제 |

각 Stage는 배포 가능 단위. Stage 2가 핵심(수요 90% = `/p`).

---

## 9. 확정 결정 (Q1~Q11 — 2026-09-07 덕수, 전항 권장안)

| # | 질문 | 확정 |
|---|---|---|
| Q1 | agent "회원" | 오너+멤버, 규칙 0. 멤버는 commentsVisible 포함 |
| Q2 | PC 화면 기억 | sessionStorage(탭 수명). forceDesktop이 matchMedia보다 먼저(F-5) |
| Q3 | svg·ggb | 켠다 — 분기 신설 + `next/dynamic ssr:false` |
| Q4 | Bazaar 과목 칩 | 보류, 검색만 |
| Q5 | rail 거터 2.2em | 유지 |
| Q6 | 판별식 | `w≤599 ∨ (h≤599 ∧ coarse)` + UA 태블릿 제외(F-2) |
| Q7 | 글자 기본 | 15 공유(`lib/constants.ts`) |
| Q8 | 요약 보기 기본 | full(코드 0줄) |
| Q9 | 데스크톱 agent 멤버 확장 | 하지 않음 — 비대칭 의도 명문화 |
| Q10 | 인앱 로그인 | 현상 유지 + Stage 3 검수. 실패 시 "기본 브라우저로 열기" 안내 |
| Q11 | 비로그인 폰 `/` | 로그인 화면 + Bazaar 둘러보기 |

---

## 10. 후속 과제

PWA(manifest+512px 마스터+standalone) · 데스크톱 agent 멤버 확장(Q9) · Bazaar 칩(Q4) · 인앱 로그인 개선(Q10) · 큰/작은 폰 튜닝(E1) · 가로 보기(E2) · 공개 문항 agent 확대(Q1-b) · 폰 알림. 폰 편집은 하지 않는다(E4).

---

## 11. CLAUDE.md 개정 항목 (Stage 5)

1. 「핵심 파일 구조」: `components/phone/` · `PhoneShell` · `BottomSheet` · `BazaarLanding` · `lib/device.ts` · `lib/deepLink.ts` · `test:device`(`test:deeplink`).
2. 「핵심 패턴」: **"폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 `[data-phone]`만 본다 — 판별용 `@media` 금지, `@media (hover: hover)`만 허용. 판별식 `w≤599 ∨ (h≤599 ∧ coarse)`, 서버 UA 추정은 태블릿(`iPad`·`Tablet`·`Mobile` 없는 `Android`) 제외. forceDesktop이 matchMedia보다 먼저."**
3. 우측 드로어 3종 규약에 **"데스크톱 한정 · 폰은 BottomSheet(Z_SHEET 9500, 다이얼로그·말풍선 아래)"** 단서.
4. `[data-phone]` CSS 추가 시 동특이도 순서 의존을 취소 규칙으로 제거(함정 4).
5. **라우트 page.tsx는 서버 컴포넌트로 두고 클라 로직은 `components/`로** — `/`·`/bazaar` 전환 이후 되돌리지 말 것. `next/dynamic`은 뷰어 2종에만, 반드시 `ssr:false`.
6. `MiniShell.tsx:13` U8 해소 · `AppShell 100dvh` · `FONT_SIZE_*`는 `lib/constants.ts` 소유(사본 금지).
7. 판별 기기 표(D1) · 탈출구(D4) · agent 게이트 비대칭(Q9) 명문화.
8. **폰 카드는 M6 위계 상수를 import한다**(`CARD_RADIUS`·`CARD_RADIUS_QUESTION`·`isToneScoped`) — 리터럴 사본 금지, M6 규약 개정 시 폰 자동 추종(G-2).
9. 「작업 규칙」에 §8-0 요지: 폰 검수는 기기 모드(A) 먼저, `100dvh`·safe-area·로그인·IME·①~⑳ 폴백은 실기기(R). 실기기 로그인 검수는 Tailscale 도메인을 Firebase 승인 도메인에 등록.

---

## 12. 구현 기록 (2026-09-09, CLI — Stage 0~4 코드 완료 · 덕수 검수 대기)

커밋 8개(S1~S8), 신규 13파일 · 수정 15파일. `npx tsc --noEmit` 0오류 · 프로덕션 빌드 통과
(`/`·`/bazaar`·`/p`·`/shared` 전부 ƒ — S-8 예상대로) · 로직 검증 373 → **387건**
(`test:device` 10 + `test:deeplink` 4 신설, locale 30·case 46·list 17 무회귀) ·
dev 서버 UA 프로브 4갈래 정확(iPhone UA→폰 · 데스크톱→데스크톱 · `?1`→폰 · Android 태블릿→데스크톱).

| 커밋 | 내용 |
|---|---|
| S1 | `lib/device.ts` · `lib/deepLink.ts` + 테스트 14건 |
| S2 | `useIsPhone`(forceDesktop 선행) · `ResponsiveShell` · `Wordmark`(그림자 포함 3벌 픽셀 재현) · viewport(cover) · `Z_SHEET` · `FONT_SIZE_*` constants 이관 · AppShell 딥링크 배선·100dvh · `:hover` 7종 `@media (hover:hover)` 격리 |
| S3 | `PhoneShell`(data-phone·본문 단일 스크롤러·safe-area footer·overlay 슬롯) · `BottomSheet`(Z_SHEET·딤 스크롤 차단·그립 드래그 닫기·0.2s) |
| S4 | `/bazaar` 서버화 + `BazaarLanding` 추출(F-1) + `PhoneBazaar`(2행 카드·검색 44·내 게시물 상시 액션) |
| S5 | 카드 반지름 상수 constants 이관(**R2**) · `ProblemTabContent` svg/ggb 분기(`viewers` 기본 false·`next/dynamic ssr:false`) · GgbViewer 100dvh · `[data-phone]` 수식 3규칙 |
| S6 | `PhoneReader`·`PhoneMoreSheet` · `/p`·`/shared` 폰 경로(`reader` prop + ResponsiveShell) |
| S7 | `PhoneList`·`PhoneItemMenu`(폴더 이동 = FolderPickerDialog 공용) · CommentPanel `selectionPopup` prop |
| S8 | `PhoneApp`(하단 탭 3·자체 로드·딥링크·로그인 화면 Q11·문항 열람·댓글/agent 시트) · `/` 서버화 |

**계획 개정(R1~R5) — v4 본문을 이기는 실측 확정:**
- **R1 — AppShell 조기 반환(P2·D8)은 폐기, 분기는 `app/page.tsx`의 ResponsiveShell이다**: `if (isPhone) return` 뒤에 훅이 이어지는 구조는 isPhone이 바뀔 때(창 리사이즈·forceDesktop) 훅 수가 변해 **Rules of Hooks를 깬다**. 스위치 분기는 언마운트/마운트라 안전하고 **AppShell은 한 줄도 안 바뀌었다**(P2의 목적을 더 잘 달성).
- **R2 — `CARD_RADIUS`·`CARD_RADIUS_QUESTION`은 TabBody import가 아니라 `lib/constants.ts` 이관 + TabBody 재export**: G-2(사본 금지)와 함정 5(공개 라우트 번들)가 충돌했다 — TabBody가 SvgViewer·GgbViewer를 **정적 import**라 상수만 가지러 가도 뷰어가 /p 번들에 딸려온다.
- **R3 — PhoneReader의 comments/agent 슬롯은 render-prop**(`(close)=>ReactNode` 허용): CommentPanel의 X가 시트를 닫으려면 close 콜백이 슬롯 안으로 들어가야 한다. 공개 경로(PublicComments)는 평면 노드 그대로.
- **R4 — 리더는 풀이 탭을 볼 때 문제 카드를 `visibility:hidden`+`position:absolute`로 DOM에 남긴다**: 폰은 탭을 하나만 그리므로 참조 말풍선 정의부(M2 C — 언마운트 금지)가 계획서에 없던 필수 처방이었다. `[data-ref-tooltip]` 게이트는 본문 래퍼 하나, 시트(overlay)는 게이트 밖(P13).
- **R5 — Bazaar 내 게시물 액션은 ⋯ 시트가 아니라 2행 우측 상시 버튼**(링크·내리기): hover 부재의 최소 처방.

**보류·미구현(검수 시 판정):** ① 홈 상단 검색(목시 6) — 후속(SearchOverlay 폰 미검증) ② 받은 문항 보조줄의 공유자 닉네임 — 프로필 비정규화 없인 N+1이라 수정일만 ③ **D15(참조 말풍선 탭) 코드 0** — 실기기에서 합성 mouseover로 이미 뜨는지 먼저 판정(뜨면 (a) 딜레이 단축만) ④ 시트 닫힘 애니메이션은 180ms 내부 상태로 구현(열림 200ms).

**검수 절차는 §8-1 그대로** — Stage 0·1·2 검수의 A(기기 모드) 항목부터. 서버 분기·판별식·빌드는 위에서 실측 통과.

### 12-1. 덕수 검수 1차 (2026-09-09) — 판정 대기 2건 종결

1. **카드 위계(G-2) — 정상 판정**: 폰 좁은 화면에서 문제 12+그림자 / 풀이 직각이 자연스럽다.
   M6 위계의 폰 편입은 이대로 확정.
2. **참조 말풍선(D15) — 정상 판정 → (a) 갈래로 종결, 코드 0**: 실기기 탭에서 합성
   mouseover 경로로 이미 뜬다. ⚠ 계획서 (a)의 "폰에서 `DELAY_MS` 500→0 단축" 처방은
   **적용하지 않았다** — 검수가 현행 500ms 그대로를 정상으로 닫았으므로 승인된 동작을
   바꾸지 않는다. 탭 즉시 뜨기를 원하면 `[data-phone]` 조상 판정 1줄이면 된다(후속 옵션).
   RefTooltip 수정 0인 채로 D15 닫힘 — v4 §5-3 "그 외" 목록에서 RefTooltip 항목 소멸.

미판정 잔여(실기기 R): 안드로이드 ①~⑳ 폴백(7-2) · 카톡 인앱 Google 로그인(Q10) ·
iOS 키보드 가림(D9 ④) · 앱 댓글 CodeMirror IME · 딥링크 폰 동작 · safe-area 하단(T-6).
Stage 5(CLAUDE.md·phasedocs·roadmap)는 검수 종결 선언 후.
