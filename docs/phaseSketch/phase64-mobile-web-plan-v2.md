# Phase 64 구현 계획서 — 휴대폰 열람 전용 화면(모바일 웹) (v2 — CLI 실측 교차검토판)

> 대상: web Claude (재검증 → v3 확정) · 원시 자료: 목시 캔버스 「Mathory 모바일 열람 화면」(web, 2026-09-07, 7장) · 덕수 전제 확정 (2026-09-07) + **결정 Q1~Q11 전항 확정(2026-09-07, 권장안 채택)**
> 계보: v1(web, 2026-09-07) → **v2(CLI 실측 교차검토, 2026-09-07 — 정정 E-1~E-9 · 보완 S-1~S-11 · 결정 Q1~Q11 편입)** → v3(web 재검증·확정) 예정
> 진실 원천: mathory **origin/main `1c171ad`** (M5 배포 후). 인용 라인은 전부 이 해시 기준이며 **v2에서 전 인용을 실파일로 재검증했다** — v1의 인용 오류는 §정정 이력에 남긴다.
> 범위: 휴대폰(판별식은 D1) 접속 시 **열람 전용 셸**로 분기. 공개 라우트(`/p`·`/shared`·`/bazaar`) + 로그인 앱(`/`)의 열람(내 문항·받은 문항·Bazaar·agent 열람). **편집 없음.**
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

이것은 **모바일 웹**이다 — 같은 Next.js 앱 안에서 휴대폰이면 `PhoneShell`을, 그 외(PC·태블릿·폴더블 펼침)는 지금 화면을 그대로 낸다. 네이티브 앱·스토어·별도 코드베이스는 없다.
데스크톱 컴포넌트는 **한 줄도 바꾸지 않는 것을 목표**로 하고(예외 목록 §5-3, 전부 데스크톱 픽셀 무변경), 큰 셸 `MiniShell`을 참조로 새 셸을 만들며, 이미 폭에 유연한 부품(`ProblemTabContent`·`PublicComments`·`PublicViewerShell` 1단 폴백)을 재사용한다.
**서버 0 · Firestore 규칙 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI + `app/page.tsx` 서버 컴포넌트화.

---

## 0-1. v1 → v2 정정 이력 (실측 근거 — v3 재검증 시 이 표를 먼저 볼 것)

| # | v1의 오류 | 실측 정정 |
|---|---|---|
| E-1 | **판별식 자기모순**: D1 `min(w,h)≤599`·D2 `(max-width:599px), (max-height:599px)`는 PC 창 1200×500을 폰으로 판정하는데, 함정 2·Stage 0 검수는 "1200×500은 데스크톱"이라 단언 | 세로 조건에만 터치를 결합: `(max-width:599px), ((max-height:599px) and (pointer:coarse))`. 순수 함수는 `isPhoneViewport(w, h, coarse)`. §4 D1·D2 개정 |
| E-2 | `PdfDialog.tsx:49` 인용 — **그 파일은 없다** | 실물은 `components/print/PdfDownloadButton.tsx`(레거시)와 `lib/pdfPrint.tsx:108`(`window.print()`). 결론(폰 트리가 EditorView를 안 그려 만날 일 없음)은 유효 |
| E-3 | `:hover` 규칙 6개 | **8개**: 계획의 6개 + 스크롤바(`globals.css:260`) + **`:1012 .case-head.is-static:hover { background:none }`**. 1012는 952-953의 취소 규칙이라 `@media (hover:hover)`로 **함께** 옮겨야 한다 |
| E-4 | 글자 기본 16px | **15**다(`ProblemView.tsx:42` `FONT_SIZE_DEFAULT = 15`). 키를 공유하면 기본값도 15 공유(Q7). 검수 좌표도 11/**15**/24 |
| E-5 | `CommentPanel`에 `resizable` prop 추가 | **불필요** — 리사이즈 핸들은 패널 내부가 아니라 소비처(EditorView·ProblemView·AppShell)가 마운트한다. 폰 트리는 그 화면을 렌더하지 않으므로 핸들은 저절로 없다. 남는 prop은 `selectionPopup` 하나(`CommentPanel.tsx:922`가 내부 마운트) |
| E-6 | D14 "ProblemTabContent에 prop을 줘 TabBody:135-160의 svg/ggb 분기를 켠다" | ProblemTabContent에는 그 분기가 **원래 없다**(별개 렌더 사이트 — TabBody 헤더 주석이 "통합하지 않는다(D16)"를 명시). 분기를 **새로 추가**하는 작업이고, SvgViewer·GgbViewer가 `/p`·`/shared` 번들에 새로 편입되므로 `next/dynamic` 지연 로드 필수. §4 D14 개정 |
| E-7 | 기준 뷰포트 390×844 = iPhone 15/16 | iPhone 15/16은 **393×852**(390×844는 iPhone 12~14). 기준 393×852로 정정, 결론 무변경 |
| E-8 | D15 — RefTooltip에 click 리스너를 추가한다 | 터치 탭은 **합성 mouseover를 발화**하므로 현행 코드로도 탭 후 500ms(`DELAY_MS`, RefTooltip.tsx:30)면 이미 뜰 가능성이 높고, 스크롤 즉시 닫힘(:177-181)도 이미 있다. 리스너를 얹으면 이중 발화 위험 → **실기기 판정 우선** 처방으로 개정(§4 D15) |
| E-9 | B-9 "ContextMenu는 터치 바깥 탭으로 안 닫힌다" | **미검증 단정** — 터치 탭은 합성 mousedown을 발화하므로 닫힐 가능성이 높다. 폰 트리가 ContextMenu를 안 쓰므로 결론 무영향 |

보완 S-1~S-11은 각 절에 ★ 표시로 편입했다.

---

## 1. 전제 (덕수 확정, 2026-09-07)

| # | 전제 | 계획서 반영 |
|---|---|---|
| E1 | **6.1인치급** 최다 사용 폰 크기에 맞춘다. 더 크거나 작은 폰은 차후 | 기준 뷰포트 **393×852 CSS px**(iPhone 15/16 · Galaxy S 계열 384~412의 대표). 360(소형)·430(Pro Max)은 **깨지지만 않게** — 고정 px 최소화, 별도 튜닝은 §10 |
| E2 | **세로 보기만.** 가로는 회전을 못 막으니 후순위 | 폰 가로에서도 **가로 레이아웃을 따로 만들지 않고** 세로 레이아웃이 그대로 늘어난다(§4 D3) |
| E3 | 폰도 **색·아이콘·글꼴·로고**를 통일성 있게 그대로 쓸 수 있는지 확인, 불가피한 변경은 미리 점검 | §7 점검 완료 — **전부 그대로 쓴다.** 불가피한 변경 3건은 기존 부채 정리(아이콘 크기 상향·워드마크 공용화·hover 격리) + 워드마크는 **textShadow까지** 복제(★S-7) |
| E4 | 휴대폰에서 **편집은 하지 않는다** | 폰 셸에 `EditorView` 진입점 0. 문항 메뉴의 '편집'은 비활성 + "PC·태블릿에서" |
| E5 | **AI 에이전트 화면**도 로그인 회원에 한해 **열람** | `CommentPanel mode='agent' canComment={false}` 재사용. "회원" = **오너 + 그 문항의 멤버**(Q1 확정). ★멤버는 `commentsVisible` 게이트가 하나 더 있다(S-1, §2 P4) |
| E6 | 판별 = 폰이면 폰 셸, 폴더블 펼침·태블릿·PC = 기본 화면 | §4 D1·D2 (E-1 정정 반영) |
| E7 | 목시 기본 구조 승인 — 상단 바 고정·2탭·바텀 시트·하단 탭 3개 | §6 화면 사양이 목시 7장과 1:1 대응 |

---

## 2. 타당성 판정 — 기존 구조와 정면으로 만나는 지점

**불가능 판정 0건.** 아래 5건은 규칙을 감안하거나 구조를 조정해야 한다.

| # | 구상 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | 서버에서 UA 힌트로 첫 렌더를 고른다 | `app/page.tsx`가 **`'use client'`**(실측: 'use client' + `<AppShell />`, 7행) → `headers()`를 부를 수 없다. `/p`·`/shared`·`/bazaar`의 page.tsx는 이미 서버 컴포넌트 | `app/page.tsx`의 `'use client'`를 빼고 서버 컴포넌트로 되돌린다. `AppShell`이 자체 `'use client'`라 중첩은 문제없다. ★이 순간 `/`가 정적(○)→동적(ƒ)이 된다(S-8) — 실질 무해(현재도 클라 셸)지만 Stage 0 검수에 빌드 출력 변화를 명시 |
| **P2** | 폰 셸을 `AppShell` 안에서 분기 | `AppShell.tsx`(1,103줄)는 `loadData`·DnD 컨텍스트·뷰 상태를 한 몸에 갖는다. 폰 트리를 그 안에 끼우면 상태를 공유하게 되어 "데스크톱 무변경"이 깨진다 | **`AppShell` 최상단 조기 반환** `if (isPhone) return <PhoneApp user … />` 한 줄만 넣고, `PhoneApp`은 **자기 데이터를 자기가 읽는다**(`listProblems`·`listRecentProblems`·`listSharedWithMe`·`listFolders` — 전부 `lib/`에 있음, AppShell.tsx:194-201 실측). 상태 공유 0, 데스크톱 코드 경로 무변경 |
| **P3** | 앱 열람뷰를 폰에 옮긴다 | `ProblemView`는 최소 폭 758px(라벨 열 `7em`=105@15 + 카드 600), `WIDTH_EM_MIN 35`라 35em 아래로 못 줄인다(`lib/constants.ts:36-39` · `TabBody.tsx:92-102` 실측) | **옮기지 않는다.** 폰 리더는 `ProblemTabContent`(props 2개, `width:100%`)로 새로 조립한다. 라벨 열(문제/풀이)은 **탭**이 대신한다 |
| **P4** | agent 화면을 "로그인 회원"에게 연다 | UI 게이트는 `ProblemView.tsx:820` `user && isOwnerView`(오너 전용)이지만, **실제 인가는 Firestore 규칙**이다: agent 세션 read = 오너 OR **멤버**(`firestore.rules:333`), agent **메시지** read = 오너 OR (멤버 && **`commentsVisible()`**)(`firestore.rules:200-202, 235` — `problems.commentsVisible != false`). 공개 문항의 비멤버 로그인 사용자는 `commentStream==true`(댓글) 메시지만 읽는다 | **"회원" = 오너 + 멤버(Q1-a 확정), 규칙 변경 0.** ★폰 agent 아이콘 노출 조건은 `오너 OR (멤버 && problem.commentsVisible !== false)`(S-1) — 안 그러면 멤버가 "세션 목록은 뜨는데 메시지가 전부 빈" 상태를 본다. ★데스크톱은 오너 전용 그대로 둔다(Q9 확정) — **폰이 데스크톱보다 넓은 비대칭은 의도된 것**이며 PC 확장은 후속(§10. canComment 계산을 모드별로 갈라야 해서 1줄이 아니다) |
| **P5** | 우측 드로어 3종 규약(absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`) | `CommentPanel` 루트가 **자기 위치를 스스로 정한다**(실측 `position:absolute; top/right/bottom: DRAWER_INSET(8); width; maxWidth:90vw; zIndex:50`). 폰에서 밀어내기·리사이즈는 무의미 | 규약을 **데스크톱 한정**으로 두고 폰은 **바텀 시트 하나의 문법**으로 통일(D9). `CommentPanel`은 positioned 래퍼 + `width:'100%'`로 감싸 **무변경 재사용**, 인셋 8px은 시트 안쪽 여백으로 흡수. ~~리사이즈 핸들·~~`SelectionInsertPopup`이 폰에서 렌더되지 않도록 **prop 1개 추가**(`selectionPopup` — E-5 정정: 리사이즈 핸들은 소비처 소유라 prop 불필요) |

---

## 3. 확정 사실 (실측, 전부 `1c171ad` — v2에서 전 항목 재검증 완료)

### A. 진입·판별

| # | 사실 | 위치 |
|---|---|---|
| A-1 | `app/page.tsx` = `'use client'` + `<AppShell />`. `next.config.*`·`vercel.json` **없음**(실측 재확인). `layout.tsx`에 `viewport`/`generateViewport` export 없음(Next 14 기본 `width=device-width, initial-scale=1` 주입) | `app/page.tsx:1-7`, `app/layout.tsx` |
| A-2 | UA·`pointer:coarse`·`matchMedia` 사용 **0건**(전 저장소 grep 재확인). 폭 분기는 `PublicViewerShell.tsx:35`(innerWidth ≥ 880 → 2단)와 `BazaarView.tsx:40-48`(ResizeObserver, showTags 620 / showDate 480) 둘뿐 | grep 전수 |
| A-3 | `AppShell` 루트 `height:'100vh'`(`:803`) — iOS Safari 주소창에 하단이 잘린다. `MiniShell.tsx:29`·`bazaar/page.tsx:27`는 이미 `100dvh` | 불일치 |
| A-4 | `AppShell`은 로그인 화면을 따로 그리지 않는다 — 비로그인이어도 Sidebar+main을 그리고 `loadData`만 user 게이트(조기 반환). 딥링크는 `?view=bazaar\|p\|shared&id=` 1회 읽고 `replaceState('/')`(`:258-278`) — ★**effect가 `user` 게이트라 로그인 후에만 돈다**(S-10) | `AppShell.tsx:183-192, 258-278` |
| A-5 | 루트 레이아웃이 `<DialogHost/>`·`<RefTooltip/>`을 전역 1번 마운트(주석: "루트 레이아웃이라 admin·공개 뷰어까지 전부 커버") → 폰 셸도 얻어 쓴다. `dialogBody`는 `maxWidth:92vw, maxHeight:88vh`라 폰에서도 안 넘친다 | `layout.tsx:29-40`, `dialogStyles.ts:36-43` |

### B. 재사용 부품

| # | 사실 | 위치 |
|---|---|---|
| B-1 | `ProblemTabContent({blocks, tabId})` — props 2개, 요약 보기 토글 내장(question 탭 제외), **svg·ggb 분기 없음**(공개 뷰어 D16 의도 — TabBody 헤더 주석이 "통합하지 않는다"고 명시). ★`useOutlineState(sorted)` 인자 없이 호출 → 기본 **'full'**(`useOutlineState.ts:38`, S-9) | `ProblemTabContent.tsx:29`, `TabBody.tsx:20-28` |
| B-2 | `PublicComments({problemId, commentSessionId, writeEnabled?})` — 자기 구독·자기 auth·로그인 버튼 내장, 루트 `width:100%`, 위치 미지정 → 그대로 시트에 임베드 가능 | `PublicComments.tsx:21-31, 113-117` |
| B-3 | `CommentPanel` — `mode:'comments'\|'agent'`, `canComment=false`면 입력 UI·AI 칩·검증 칩 블록이 통째로 안 그려진다(`:1071` `{canComment ? …}`). 루트가 스스로 `position:absolute; top/right/bottom: DRAWER_INSET; width; maxWidth:90vw; zIndex:50`(`:877-893`). `width`는 `number\|string`. `window.innerWidth` 사용은 입력창 세로 리사이즈의 `innerHeight`뿐. 입력창은 CodeMirror 6. ★`SelectionInsertPopup`은 `:922`에서 **내부 마운트** — 폰 차단은 prop이 필요하다 | `CommentPanel.tsx:64-101, 877-893, 922, 1071` |
| B-4 | `PublicViewerShell` = `height:100%` + 880 미만 **1단+탭 버튼 폴백** 이미 존재. 카드 `padding '32px 36px 32px 40px'` + 열 `24` = 좌우 124px 고정 소모, `fontSize:15` 하드코딩, `--card-pad-l/r` px 리터럴, 댓글 aside `width:380` | `PublicViewerShell.tsx:25-40, 139-160, 176-180` |
| B-5 | hold-to-peek '문제' 알약은 이미 `onPointerDown/Up/Cancel` + `touchAction:'none'`(`:897-917`). 페이크는 `TabBody hideLabel` 한 번 더 + `maxHeight:80vh`(`:966-993`) | `ProblemView.tsx` |
| B-6 | `RefTooltip` = document 위임 **4리스너**(mouseover/mouseout/scroll capture/resize, `:179-183` — v1 "1개"는 부정확), 열림 지연 `DELAY_MS 500`(`:30`), 스크롤 즉시 닫힘 기존재. 정의부 탐색 `findDefinition()`(`:97-113`), 게이트 `[data-ref-tooltip]`, zIndex `Z_TOOLTIP`(= `Z_DIALOG − 100` = 10400). ★**터치 탭은 합성 mouseover를 발화**하므로 현행 코드로도 탭 → 500ms 후 말풍선이 뜰 가능성이 높다(E-8) | `RefTooltip.tsx`, `dialogStyles.ts:27` |
| B-7 | `SvgViewer`는 `react-zoom-pan-pinch` pinch 활성(`:65` `pinch:{disabled:false}`), `GgbViewer` 전체화면 `fixed; inset:0` + `100vw/100vh`(`:322-330`) → 터치는 이상 없고 `100vh`만 문제 | `SvgViewer.tsx:60-70`, `GgbViewer.tsx:318-332` |
| B-8 | `SizeStepper` 버튼 `CHEVRON_BTN` 14×11px(`:15-19`) — 터치 타깃 미달(권장 44) | `SizeStepper.tsx:15-19` |
| B-9 | `ContextMenu` 닫기 = document `mousedown`(`:35-42`). ★터치 탭도 합성 mousedown을 발화하므로 "안 닫힌다"는 **미검증**(E-9) — 폰 트리가 ContextMenu를 안 쓰므로 무관. `BazaarView` 내 게시물 액션은 `mine && hovered`(`:270`) hover 전용 | `ContextMenu.tsx`, `BazaarView.tsx:270` |
| B-10 | PDF 진입은 EditorView 3점 메뉴 → `lib/pdfPrint.tsx:108` `window.print()` (E-2 정정: `PdfDialog.tsx`는 없고 `PdfDownloadButton.tsx`가 레거시). 폰 트리는 EditorView를 안 그리므로 만날 일 없음 | `lib/pdfPrint.tsx:108` |

### C. 데이터 경로

| # | 사실 | 위치 |
|---|---|---|
| C-1 | 폴더·문항·받은 문항: 한 원천. `AppShell.loadData`(`:183-227`)가 `listProblems`·`listRecentProblems(uid,10)`·`listSharedWithMe`·`listSharedByMe`·`listFolders`를 직접 호출해 prop으로 뿌린다. 최근 문항은 휴지통(`TRASH_FOLDER_ID`) 제외 필터 | `lib/firestore.ts` |
| C-2 | Bazaar: `listBazaarFeed(q)`(`lib/bazaar.ts:100`), `BazaarView({uid, filter, onOpenPost?})` | |
| C-3 | 앱 열람 = `getProblemWithBlocks` **1회 fetch** + 오너/멤버 규칙. 공개 열람 = `watchProblem`+`watchTabBlocks` **실시간** + `visibility==='public'` + ★**`memberTabVisibility` 탭 필터**(`mtv[t.id] !== false`, `PublicProblemView.tsx:44-49` — S-11: 폰 앱 경로 로더도 같은 필터를 직접 해야 한다). 두 경로는 통합돼 있지 않다 | `PublicProblemView.tsx:30-64` |
| C-4 | agent 데이터 = `problems/{id}/discussion_sessions`(type `'normal'`) + `tab_comments`(`commentStream=false`). 세션 read: 오너 OR 멤버(`:333`) / 메시지 read: 오너 OR (멤버 && `commentsVisible()`)(`:200-202, 234-236`) | `firestore.rules` |

### D. 색·글꼴·아이콘·로고 (통일성 점검 근거 → §7)

| # | 사실 | 위치 |
|---|---|---|
| D-1 | 글꼴 링크 3: Pretendard(jsDelivr) · Google Fonts(Noto Serif KR/Noto Sans KR/JetBrains Mono) · KaTeX 0.16.28 CSS. `@font-face` 2: D2Coding · **MathoryCircled**(`local()` 3종 — AppleGothic·Apple SD Gothic Neo·Malgun Gothic — 실패 시 gstatic Noto Sans KR 서브셋 URL, ①~⑳, `size-adjust 88%`, `font-display: swap`) | `layout.tsx:14-28`, `globals.css:37-47` |
| D-2 | **안드로이드 폰에는 `local()` 3종이 전부 없다** → MathoryCircled는 gstatic URL 폴백이 실경로가 된다. 그 URL은 주석이 "언젠가 404 가능"이라 표시한 자리 | `globals.css:35-45` |
| D-3 | 워드마크는 **인라인 3벌**이고 서로 다르다: MiniShell(19/600/`--mathory-red`, shadow 없음, `:78-81`) · Sidebar(19/**400**/`#944728` 하드코딩 + **`textShadow: 0 1px 0 rgba(0,0,0,0.06)`**, `:779-784`) · HomeView(48/400/`--mathory-red-dark` + **같은 textShadow**, `AppShell.tsx:1074-1078`). ★textShadow가 두 벌에 있다(S-7) — 공용화 시 props에 포함해야 픽셀 무변경 | 실측 |
| D-4 | 아이콘 = Phosphor regular, `phIcon(d, defaultSize)`의 `size`는 자유 숫자(`Icons.tsx:37-41`). 헤더 규약 "최소 렌더 14px, 임의 축소 금지". 기본값 14인 아이콘 다수 | `Icons.tsx` |
| D-5 | `globals.css`에 `@media` **0개**, `:hover` 규칙 **8개**(E-3 정정): 스크롤바 `:260` · `.problem-card` `:868` · `.folder-row` `:869` · `.list-folder-row` `:874` · `.section-head,.case-head` `:952-953` · `.verify-finding-row` `:1007` · **`.case-head.is-static:hover` `:1012`(952-953의 취소 규칙 — 쌍으로 움직일 것)** — 터치에서는 탭 후 hover가 들러붙는다 | `globals.css` |
| D-6 | 색 토큰 전부 `:root` 한 벌, 다크 없음(CLAUDE.md). 명암비 구속 조건 `#E8DFCE`(FolderView 카드 hover) | |
| D-7 | ★글자 크기 상수(S-4·E-4): `FONT_SIZE_KEY 'mathory-content-font-size'` · `FONT_SIZE_DEFAULT 15` · MIN 11 · MAX 24 — `ProblemView.tsx:41-45` **지역 상수** | `ProblemView.tsx:41-45` |
| D-8 | ★로그인은 전부 `signInWithPopup`(MiniShell `:24-26`, PublicComments 등) — **카카오톡·인스타 인앱 웹뷰에서 popup이 자주 실패**하는 알려진 경로(S-4). redirect 전환은 Safari ITP 이슈가 별개라 이번에 안 건드린다(Q10 확정) | `MiniShell.tsx:24-26` |

---

## 4. 결정 (D1~D16 — Q1~Q11 확정 반영. v3 재검증 대상)

### 판별·진입

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **`lib/device.ts` 신설(import 0).** `PHONE_MAX_SHORT_SIDE = 599`. **`isPhoneViewport(w, h, coarse) = w <= 599 \|\| (h <= 599 && coarse)`** (E-1 정정 — 세로 조건은 터치 기기에만). `guessPhoneFromHeaders(ua, chUaMobile)` = `chUaMobile === '?1'` 우선, 없으면(Safari) `/Mobi\|Android\|iPhone/i.test(ua)`. `tests/device.test.mjs`로 기기 표를 고정: iPhone 15 393×852 coarse → 폰 · S24 384×824 coarse → 폰 · **폰 가로 852×393 coarse → 폰** · **PC 창 1200×500 fine → 데스크톱** · PC 창 599×800 fine → 폰(폭 조건) · Z Fold 펼침 673×841 → 데스크톱 · Pixel Fold 883×736 → 데스크톱 · iPad mini 744×1133 → 데스크톱 | E6 · E-1 · CLAUDE.md "순수 로직은 lib/ import 0 + tsc 테스트" |
| **D2** | **두 겹 판별.** ① 서버: 라우트 page.tsx(서버 컴포넌트)가 `headers()`로 `guessPhoneFromHeaders`를 계산해 `initialPhone` prop으로 내린다. ② 클라이언트: `hooks/useIsPhone.ts`가 **첫 렌더는 `initialPhone` 그대로**(hydration 불일치 0), `useEffect`에서 **`matchMedia('(max-width:599px), ((max-height:599px) and (pointer:coarse))')`**(E-1 정정)로 보정 + `change` 구독. iPadOS Safari는 Macintosh UA라 서버가 데스크톱으로 찍지만 태블릿이므로 결과는 맞다 | P1 · A-1 |
| **D3** | **가로 레이아웃 없음.** 폰 가로에서도 세로 레이아웃이 그대로 늘어난다(상단 바 52 + 탭 44 = 96px 고정, 나머지 스크롤). 가로 전용 조정을 하지 않는다 | E2 |
| **D4** | **탈출구 = ⋯ 시트의 "PC 화면으로 보기".** `sessionStorage['mathory.forceDesktop']='1'`(탭 살아 있는 동안, 새 탭이면 다시 자동 판별 — **Q2 확정**). 적용은 `useIsPhone`의 effect에서 읽어 반영 — 서버 첫 렌더는 폰일 수 있으므로 한 번 다시 그려지는 것을 허용(함정 1과 같은 성질). 데스크톱 셸에는 되돌아오는 버튼을 두지 않는다 | 판별 오류 대비 |
| **D5** | **`app/layout.tsx`에 `export const viewport = { width:'device-width', initialScale:1, viewportFit:'cover' }` 명시.** `viewportFit:'cover'`는 하단 탭 바의 `env(safe-area-inset-bottom)` 때문. `maximumScale`은 **두지 않는다**(수식 핀치 확대는 독자의 권리) | A-1 |

### 셸·라우팅

| # | 결정 | 근거 |
|---|---|---|
| **D6** | **`components/layout/PhoneShell.tsx` 신설** — `MiniShell`을 참조로 새로 만든다. props `{ title?, left?: 'back'\|'wordmark', right?: ReactNode, tabs?: ReactNode, footer?: ReactNode, children }`. 루트 `height:100dvh` flex 열 + **`data-phone` 속성**(D13의 CSS 스코프), 상단 바 52(`--bg-functional`, 하단 1px `--border-light`), 본문 `flex:1; overflow:auto`, footer(하단 탭 바) `padding-bottom: env(safe-area-inset-bottom)`. `MiniShell.tsx:13`의 "U8 후속 과제" 주석을 이 Phase로 갱신 | P2 · B-4 |
| **D7** | **공개 라우트 3개는 page.tsx에서 셸만 바꾼다.** `<ResponsiveShell initialPhone phone={<PhoneShell…>} desktop={<MiniShell…>}>`(클라이언트 래퍼, `useIsPhone` 소비). `PublicProblemView`·`SnapshotView`·`BazaarView`는 **무변경**으로 두 셸에 그대로 들어간다 — 단 `/p`·`/shared`의 본문은 폰에서 `PublicViewerShell` 대신 **`PhoneReader`**(D10)를 쓰므로 `PublicProblemView`·`SnapshotView`에 `reader?: 'desktop'\|'phone'` prop 1개 추가(§5-3 ②) | B-4 |
| **D8** | **로그인 앱은 `AppShell` 조기 반환 1줄 + `PhoneApp` 신설.** `PhoneApp`은 뷰 상태 `home\|folder\|received\|bazaar\|problem\|agent`를 자체 소유하고 데이터도 자체 로드(C-1의 `lib/` 함수 직접 호출 — ★받은 문항 열람에는 `memberTabVisibility` 필터·휴지통 제외를 **직접** 적용, S-11). 딥링크 규약(`?view=…&id=`)은 `lib/deepLink.ts`(import 0)로 추출해 AppShell·PhoneApp이 같은 함수를 읽는다 — ★둘 다 로그인 후에만 처리(현행 유지, S-10). 폰 하단 탭 3개 = 내 문항 · 받은 문항 · Bazaar. ★**비로그인 폰 `/` = 로그인 화면**(Q11 확정): 워드마크(48 사양) + Google 로그인 버튼 + "Bazaar 둘러보기" 링크(하단 탭은 Bazaar만 활성) | P2 · A-4 · S-3 |
| **D9** | **바텀 시트 1종 `components/ui/BottomSheet.tsx`** — 우측 드로어 3종의 폰 번역. `{ open, height: number\|'auto', onClose, children }`. `position:absolute`(PhoneShell 루트 기준) 바닥 고정, `--bg-drawer` + `--drawer-shadow`, 상단 그립 36×4 `--border-content`, 딤 `rgba(45,42,35,0.32)`, 닫기 = 딤 탭 + 그립 아래로 드래그(pointer 이벤트, 60px 임계) + 시트 안 X. 애니메이션은 열림/닫힘 0.2s 하나뿐(`--transition-normal`). ★세부 규약 4건(S-5): ① z-index는 `dialogStyles.ts`에 **`Z_SHEET = 9500`** 등록 — `Z_TOOLTIP`(10400)·`Z_DIALOG`(10500) **아래**여야 시트 안에서 띄운 confirm·참조 말풍선이 시트를 덮는다 ② 열림 중 **배경 스크롤 잠금**(PhoneShell 본문 `overflow:hidden` 토글) ③ 시트 자신도 `padding-bottom: env(safe-area-inset-bottom)` ④ **iOS 키보드가 입력창을 가리는지**는 실기기 검수 항목(Stage 3·4) — visualViewport 보정은 실측되면 넣는다 | P5 · S-5 |

### 리더

| # | 결정 | 근거 |
|---|---|---|
| **D10** | **`components/phone/PhoneReader.tsx` 신설** = 상단 바(뒤로·제목·댓글 수·⋯) + 탭(문제/풀이, 2등분 44px, 활성 = accent 2px 밑줄) + 탭당 `ProblemTabContent` 카드. 탭 상태는 **비영속**(직전 진입 탭은 문제 탭 — 스포일러 방지). 문제 탭 하단 `[풀이 보기]`(48px, 탭 전환), 풀이 계열 탭 상단 `[문제 보기]` 알약(32px, 탭 → 바텀 시트에 문제 탭 카드 한 번 더 — B-5의 페이크와 같은 구조). ★요약 보기 기본은 **전 경로 'full'**(Q8 확정 — `useOutlineState` 기본값 그대로라 **코드 0줄**. 데스크톱 앱 'outline'과 다른 것은 수용: 작은 화면은 곧장 읽기가 자연스럽고 토글은 그대로 있다) | E7 · B-1 · S-9 |
| **D11** | **카드 = 클레이 `--bg-content`, radius 6(`CARD_RADIUS`), 좌우 margin 10, padding `1.1em 1em 1.2em 2.2em`, 글자 기본 15px(E-4 정정), `line-height 1.8`.** 좌 2.2em은 경우 rail·dot 거터(`--case-rail-x -1.3em`, dot 좌단 1.56em)를 **그대로 보존**하기 위한 값(**Q5 확정 — 유지**) — `.problem-card`(Phase 59a Q5)처럼 rail을 끄지 않는다. `--card-pad-l/r`를 `2.2em`/`1em`으로 세워 `.outline-section` 전폭 톤이 맞게 한다(TabBody:298-305 문법). 본문 폭 = 393 − 20 − 33 − 15 = **325px ≈ 21.7em @15px** | 목시 · globals.css |
| **D12** | **글자 크기 11~24, 기본 15, `localStorage 'mathory-content-font-size'` 공유**(**Q7 확정** — 키를 공유하면 기본값도 공유해야 PC↔폰이 안 갈린다). ★상수 4종(`FONT_SIZE_KEY/DEFAULT/MIN/MAX`)을 `lib/constants.ts`로 옮겨 export하고 `ProblemView`·폰 쪽이 함께 import(사본 금지 — §5-3 ⑤). 조절 UI는 ⋯ 시트의 스테퍼(44×36 버튼) — `SizeStepper`는 14×11(B-8)이라 폰에서 안 쓰고 시트 안에 새로 그린다 | B-8 · E-4 |
| **D13** | **수식 넘침 = 수식만 가로 스크롤.** `globals.css`에 `[data-phone]` 스코프 3규칙: ① `[data-phone] .katex-display { padding-left:1em; overflow-x:auto; overflow-y:hidden }` ② `[data-phone] .callout-block { padding-left:1em }` ③ ★**`[data-phone] .callout-block .katex-display { padding-left:0 }`**(S-6 — 기존 `globals.css:647`과 동특이도(0,2,0)라 파일 순서로 승부가 갈리는 것을 차단. 이 줄이 없으면 callout 안 display 수식이 1em을 다시 받아 이중 들여쓰기). `@media`가 아니라 **속성 스코프**인 이유: 폰 셸일 때만 적용되어야지 PC 창을 좁힌 데스크톱 화면이 바뀌면 안 된다(함정 2). 본문은 `keep-all + overflow-wrap:break-word`가 이미 있어 가로 스크롤이 안 생긴다(`globals.css:557-565`) | globals.css:394-396, 637-647 |
| **D14** | **svg·ggb 블록(Q3 확정 — 켠다)**: `ProblemTabContent`에 svg/ggb **분기를 새로 추가**한다(`viewers?: boolean` prop, 기본 false — E-6 정정: TabBody의 분기를 "켜는" 게 아니라 별개 사이트에 새로 쓰는 것). TabBody:117-160과 같은 렌더(SvgViewer/GgbViewer + 높이·초기뷰 props). ★`SvgViewer`(react-zoom-pan-pinch)·`GgbViewer`가 `/p`·`/shared` 번들 클로저에 새로 편입되므로 **`next/dynamic` 지연 로드**로 넣는다(viewers=false 경로의 공개 페이지 무부담). `GgbViewer` 전체화면 `100vh` → `100dvh`. GeoGebra 애플릿 터치 조작은 Stage 2 실기기에서 판정 | B-1 · B-7 · E-6 |
| **D15** | **참조 말풍선 = 탭 — 단 실기기 판정이 먼저다(E-8 정정).** 터치 탭은 합성 `mouseover`를 발화하므로 **현행 코드로도 탭 → 500ms 후 뜰 가능성이 높다**(닫기도 스크롤 즉시 닫힘·바깥 mouseout이 이미 있다). Stage 2 실기기에서: (a) 합성 경로가 동작하면 → `[data-phone]` 조상일 때 `DELAY_MS`만 500→0으로 단축(리스너 추가 0) (b) 안 동작하면 → 그때만 `pointerup` 리스너 추가(합성 mouseover와 이중 발화 가드 필수). 말풍선 자체는 폰에서도 현행 fixed 박스 유지(`max-width: min(35em, 80vw)`가 이미 폰에 맞다). 데스크톱 hover 경로 무변경 | B-6 · E-8 |
| **D16** | **댓글·agent 시트.** 공개(`/p`) 댓글 = `PublicComments` 그대로(익명 읽기, 쓰기는 Google 로그인). 앱 열람 댓글·agent = `CommentPanel`을 `BottomSheet(height 78%)` 안 positioned 래퍼에 `width:'100%'`로. **agent는 `canComment={false}` 고정**(폰은 열람만, E4·E5) — 입력창(CodeMirror)·AI 칩·검증 칩이 안 그려져 폰 IME 문제를 애초에 안 만든다. ★agent 아이콘 노출 = `오너 OR (멤버 && problem.commentsVisible !== false)`(Q1+S-1). 앱 댓글은 `canComment`를 현행 `canCommentOnProblem(problem, uid)` 그대로 — 단 CodeMirror 입력창의 폰 IME 검증이 Stage 4 검수 항목 | B-3 · P4 |

---

## 5. 아키텍처

### 5-1. 신설 (전부 클라이언트)

| 파일 | 역할 | 크기 추정 |
|---|---|---|
| `lib/device.ts` + `tests/device.test.mjs` | 판별 순수 함수(import 0, coarse 인자 포함) | 40줄 + 테스트 |
| `lib/deepLink.ts` + (기존 `test:` 하니스 편입 여부는 v3에서) | `?view=…&id=` 파싱(import 0) — AppShell·PhoneApp 공용 | 30줄 |
| `hooks/useIsPhone.ts` | `initialPhone` → matchMedia 보정 + forceDesktop(sessionStorage) | 40줄 |
| `components/layout/ResponsiveShell.tsx` | `{initialPhone, phone, desktop}` 스위치 | 20줄 |
| `components/layout/PhoneShell.tsx` | 상단 바·본문·하단 탭 바 프레임 + `data-phone` | 150줄 |
| `components/ui/BottomSheet.tsx` | 시트 1종(Z_SHEET·스크롤 잠금·safe-area) | 130줄 |
| `components/ui/Wordmark.tsx` | 워드마크 공용(§7-4 — **shadow 포함** 3벌 재현) | 30줄 |
| `components/phone/PhoneReader.tsx` | 문항 열람(문제/풀이 탭·알약·⋯·댓글/agent 시트) | 350줄 |
| `components/phone/PhoneMoreSheet.tsx` | 글자 크기·링크 복사·Bazaar·PC 화면·로그인 | 120줄 |
| `components/phone/PhoneApp.tsx` | 로그인 앱 폰 루트(뷰 상태·데이터 로드·하단 탭·비로그인 로그인 화면) | 320줄 |
| `components/phone/PhoneList.tsx` | 폴더 행·문항 행(수정일·검증·댓글 수)·zebra | 150줄 |
| `components/phone/PhoneBazaar.tsx` | Bazaar 2행 카드 목록 + 검색(칩 없음 — Q4 확정 보류) | 180줄 |
| `components/phone/PhoneItemMenu.tsx` | 문항 행 ⋯: 열람·공유 링크 복사·편집(비활성)·폴더 이동 | 80줄 |

### 5-2. 데이터 흐름

```
/p/[id]  page.tsx(서버) —headers()→ ResponsiveShell ─┬─ MiniShell + PublicProblemView(reader='desktop')   ← 현행
                                                     └─ PhoneShell + PublicProblemView(reader='phone') → PhoneReader
/        page.tsx(서버) —headers()→ AppShell(initialPhone) ─┬─ (현행 트리, 무변경)
                                                            └─ isPhone → PhoneApp → PhoneList / PhoneBazaar / PhoneReader
```

`PhoneReader`는 표시만 맡는다 — `PhoneReader({ problem, tabs, tabBlocks, commentsSlot?, agentSlot?, onBack })`. 데이터 소스는 호출자가 준다: 공개 경로 = `watchProblem`+`watchTabBlocks`(실시간), 앱 경로 = `getProblemWithBlocks`(1회). C-3의 두 경로를 **통합하지 않는다.** ★앱 경로 로더(PhoneApp)는 `memberTabVisibility` 필터(`mtv[t.id] !== false`)와 휴지통 제외를 직접 적용한다(S-11 — `PublicProblemView.tsx:44-49`와 같은 규칙).

### 5-3. 기존 파일 수정 (전부 데스크톱 픽셀 무변경)

| # | 파일 | 변경 |
|---|---|---|
| ① | `app/page.tsx` | `'use client'` 제거 → 서버 컴포넌트, `headers()` 읽어 `<AppShell initialPhone={…} />`. ★빌드 출력 `/`가 ○→ƒ로 바뀐다(S-8, Stage 0 검수에 명시) |
| ② | `components/share/PublicProblemView.tsx`, `SnapshotView.tsx` | `reader?: 'desktop'\|'phone'` prop — `'phone'`이면 `PublicViewerShell` 대신 `PhoneReader`. 데이터 로직 무변경 |
| ③ | `components/comment/CommentPanel.tsx` | **`selectionPopup?: boolean = true` prop 1개**(폰에서 false — `:922`의 `SelectionInsertPopup` 게이트). ~~`resizable` prop~~ 은 불필요(E-5 — 리사이즈 핸들은 소비처 소유) |
| ④ | `components/layout/AppShell.tsx` | 딥링크 파싱을 `lib/deepLink.ts`로 추출 + 조기 반환 1줄 + `:803` `100vh → 100dvh`(A-3, 데스크톱 무해) |
| ⑤ | `components/problem/ProblemView.tsx` + `lib/constants.ts` | `FONT_SIZE_*` 4종을 `lib/constants.ts`로 이동·export(D12 — 사본 금지). 값 무변경 |
| ⑥ | `components/share/ProblemTabContent.tsx` | svg/ggb 분기 **추가**(`viewers` prop 기본 false + `next/dynamic`) — 기본 경로 렌더 결과 무변경(D14) |

그 외: `RefTooltip` — Stage 2 판정 후 (a) 또는 (b)(D15) · `GgbViewer` `100dvh`(D14) · `globals.css` `[data-phone]` 3규칙(D13) + `:hover` **8개 중 화면용 7개**를 `@media (hover: hover)`로 감싸기(§7-5 — `:1012`는 `:952-953`과 쌍으로) · `layout.tsx` viewport(D5) · `dialogStyles.ts` `Z_SHEET` 추가(D9) · `MiniShell.tsx:13` 주석 갱신.

### ⚠ 함정 1 — hydration

서버가 폰으로 찍었는데 클라이언트 첫 렌더가 데스크톱을 그리면 React가 트리 불일치를 낸다. `useIsPhone`의 **초기 상태는 반드시 `initialPhone`**이고, matchMedia 보정·forceDesktop 반영은 `useEffect` 안에서만 한다. 보정이 일어나는 경우는 (a) 데스크톱 창을 599 이하로 줄인 상태 (b) UA 오탐 (c) forceDesktop 복원 — 전부 드물고, 보정 시 한 번 다시 그리는 것을 허용한다.

### ⚠ 함정 2 — `[data-phone]` 스코프에 `@media`를 섞지 말 것

폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 그 결과(`data-phone`)만 본다. 같은 것을 `@media (max-width:599px)`로 쓰면 PC에서 창을 좁힌 데스크톱 화면의 수식 들여쓰기가 바뀐다. 유일한 예외는 §7-5의 `@media (hover: hover)` — 이것은 폰 판별이 아니라 **입력 장치** 질의라 혼동이 없다.

### ⚠ 함정 3 — `CommentPanel`을 시트에 넣을 때 `position:absolute` 인셋

루트가 `top/right/bottom: 8`을 스스로 갖는다(B-3). 시트 본문에 `position:relative; height:100%`를 준 뒤 `width:'100%'`를 넘기면 좌 0·우 8·상하 8의 인셋이 남는다 — **인셋 8을 시트 안쪽 여백으로 받아들이고**(그립 아래 8px이 자연스럽다) 좌측만 `paddingLeft:8`로 대칭을 맞춘다. 위치를 prop화하는 개조보다 싸다.

### ⚠ 함정 4 — 폰 CSS와 기존 규칙의 순서 의존 (S-6)

`[data-phone] .katex-display`(0,2,0)는 기존 `.callout-block .katex-display { padding-left:0 }`(`globals.css:647`, 동특이도)과 파일 내 순서로 승부가 갈린다. D13 ③의 취소 규칙 한 줄로 순서 의존을 제거한다 — 규칙을 추가할 때마다 같은 특이도의 기존 규칙이 있는지 볼 것.

### ⚠ 함정 5 — 공개 라우트 번들 (E-6)

`/p`(36파일)·`/shared`(29파일)의 import closure에는 지금 SvgViewer·GgbViewer가 없다. `ProblemTabContent`에 정적 import로 넣으면 `viewers=false`인 공개 페이지도 react-zoom-pan-pinch를 싣는다 → `next/dynamic`으로만 넣을 것.

---

## 6. 화면 사양 (목시 7장 + 3)

| 목시 | 화면 | 구성 | 데이터 |
|---|---|---|---|
| 1 | 열람·문제 | 상단 바(←·제목·💬n·⋯) · 탭 · 클레이 카드(문제) · `[풀이 보기]` · 메타(실시간 공개·검증일) · 슬로건 | D10·D11 |
| 2 | 열람·풀이 | `[문제 보기]` 알약 · 풀이 카드(`solution-tone` dim/key · 경우 rail·dot · Tip 코칭 · display 수식 1em) | D10·D13 |
| 3 | 댓글 시트 | `BottomSheet 78%` · 헤더 "댓글 n" · 리스트 · 하단 Google 로그인(익명) / 입력창(회원) | D16 |
| 4 | ⋯ 시트 | 글자 크기 스테퍼(15 기본) · 링크 복사 · Bazaar 광장 · PC 화면으로 보기 · 로그인(비로그인 시) | D4·D12 |
| 5 | Bazaar | 상단 바(워드마크·로그인) · 헤더 · 검색 44 + 정렬 · 2행 카드 목록(배지·제목 / 명·날짜·#태그) · 내 게시물 ⋯ | C-2 · 칩 보류(Q4 확정) |
| 6 | 내 문항 | 상단 바(워드마크·검색·아바타) · 폴더 행(아이콘·이름·개수) · 최근 수정 행(제목 / 폴더·수정일·검증·댓글) · 하단 탭 3 | D8 · C-1 |
| 7 | 문항 메뉴 | `BottomSheet` — 열람 · 공유 링크 복사 · **편집(비활성, "PC·태블릿에서")** · 폴더 이동 | E4 |
| ＋ | agent 열람(목시 외) | 열람 상단 바에 agent 아이콘(`IconAgent`) — 노출 = **오너 OR (멤버 && `commentsVisible !== false`)**(Q1+S-1) → `BottomSheet` + `CommentPanel mode='agent' canComment={false}`. ★데스크톱(오너 전용)보다 넓은 비대칭은 **의도**(Q9 — PC 확장은 §10 후속) | D16 · P4 |
| ＋ | 받은 문항(목시 외) | 내 문항과 같은 `PhoneList` ← `listSharedWithMe`, 행 보조줄 = 공유자 명 · 수정일. ★열람 시 `memberTabVisibility` 필터(S-11) | C-1 |
| ＋ | ★비로그인 `/`(Q11) | 워드마크(48 사양) + "Write the logic. Preserve the insight." + Google 로그인 버튼 + "Bazaar 둘러보기" — 하단 탭은 Bazaar만 활성 | D8 |

공통: 폴더 DnD·다중 선택·칼럼 조정·리사이즈 핸들·버전 드로어·PDF/인쇄·시트 가져오기·일괄 검증 → **폰에서 진입점 없음**(B-9·B-10을 만나지 않는다).

---

## 7. 통일성 점검 — 색·아이콘·글꼴·로고 (E3) — 결론: 전부 그대로 쓴다

| 축 | 판정 | 불가피한 변경 |
|---|---|---|
| **7-1 색** | **전부 그대로.** `--bg-functional`(바) · `--bg-content`(카드) · `--bg-sidebar`(하단 탭 바) · `--bg-drawer`+`--drawer-shadow`(시트) · `--accent-primary`(활성 탭·배지) · 본문 톤 토큰들을 신규 토큰 0으로 조합. 명암비 구속 `#E8DFCE`는 폰에 hover가 없어 오히려 완화(최악 배경이 클레이 `#F4EFE7`) | 없음 |
| **7-2 글꼴** | 전부 CDN이라 폰에서도 같은 링크. `--katex-scale 1.08em`·`line-height 1.8`·`keep-all` 그대로 | **안드로이드에서 MathoryCircled(①~⑳)는 gstatic 폴백 URL이 실경로**(D-2). Stage 1 검수 항목 — 실패 시 대응 = Noto Sans KR 서브셋을 `public/fonts/` 자체 호스팅(404 리스크 제거, 어차피 주석이 권한 방향) |
| **7-3 아이콘** | Phosphor regular 그대로, `size` prop 자유. 폰 상단 바 22 · 시트 행 22 · 하단 탭 22 · 행 보조 12~14 | 14px 기본 아이콘을 44px 히트 영역 안에서 20~22로 키운다 — "최소 14, 임의 축소 금지"(D-4)는 하한 규칙이라 충돌 없음. 히트 영역은 padding으로 |
| **7-4 로고** | 워드마크 글꼴·자간(`-0.03em`)·색 계열 그대로 | **인라인 3벌이 서로 다르다**(D-3: 600/red/무그림자 vs 400/#944728/**그림자** vs 400/red-dark/**그림자**). 4번째 사본 대신 **`Wordmark.tsx` 공용 추출** — props `{size, weight, color, shadow}`(★S-7: `textShadow: 0 1px 0 rgba(0,0,0,0.06)`까지 재현해야 픽셀 무변경). 폰은 MiniShell 사양(19/600/`--mathory-red`/shadow 없음). PWA용 512px 마스터는 §10 |
| **7-5 상호작용** | — | **`:hover` 8개 중 화면 규칙 7개를 `@media (hover: hover)`로 감싼다**(D-5·E-3). `:952-953`(.section-head/.case-head)은 요약 보기 여닫이라 폰 리더 핵심 경로 — 탭 후 배경이 들러붙는다. **`:1012`(.case-head.is-static 취소 규칙)는 반드시 952-953과 함께** 이동. 스크롤바 hover(`:260`)는 폰에 스크롤바 hover가 없어 그대로 둬도 무해(같이 감싸도 됨). 데스크톱은 hover 장치라 결과 무변경 |

---

## 8. 단계(Stage) · 검수 (중기기: iPhone 6.1" Safari + Galaxy 6.1~6.2" Chrome, **+ 카카오톡 인앱 브라우저**)

| Stage | 내용 | 검수 |
|---|---|---|
| **0** | `lib/device.ts`+테스트 · `lib/deepLink.ts` · `useIsPhone` · `ResponsiveShell` · viewport · `AppShell 100dvh` · `:hover` 격리(7개+쌍) · `Wordmark` 추출 · `FONT_SIZE_*` 이동 · `Z_SHEET` | `npm run test:device` 통과 · 데스크톱 3곳 워드마크 **픽셀 동일(그림자 포함)** · PC 창 599×800(fine)에서 폰 셸, **1200×500(fine)에서 데스크톱**(E-1 정정 후 성립) · ★빌드 출력에서 `/`가 ƒ Dynamic으로 바뀐 것 확인·기록(S-8) |
| **1** | `PhoneShell` · `BottomSheet` · `/bazaar` 폰 화면(`PhoneBazaar`) | 비로그인 폰에서 Bazaar 진입 · 검색 · 게시물 탭 → `/p` 열람 · **안드로이드 ①~⑳ 표시**(7-2) · 시트 열림 중 배경 스크롤 잠김 · 시트 위에서 confirm 다이얼로그가 시트를 덮음(Z_SHEET) |
| **2** | `PhoneReader` + `/p`·`/shared` 폰 경로(`reader='phone'`) · ⋯ 시트 · 글자 크기 · 수식 스크롤 · 참조 탭 · svg/ggb | 경우 rail·dot 좌표(**11 / 15 / 24px** 전부 카드 안 — E-4 정정) · display 수식 넘침 시 수식만 스크롤 + **callout 안 수식 이중 들여쓰기 없음**(S-6) · 요약 보기 토글 · 문제 보기 알약 시트 · 핀치 확대 허용 · 세로만(가로 회전 시 깨지지 않음) · ★**참조 말풍선: 합성 mouseover로 이미 뜨는지 먼저 판정 → D15 (a)/(b) 분기**(E-8) · ★폰 셸 body 가로 overflow 0(수식 카드 밖 leak 검사) · GeoGebra 터치 조작 판정(Q3) |
| **3** | `PublicComments` 시트(익명 읽기·로그인 쓰기) | 익명: 읽기 + Google 버튼 · 로그인: 작성 · 스와이프 닫힘 · ★**카카오톡 인앱 브라우저에서 Google 로그인**(Q10 — 실패가 실측되면 "기본 브라우저로 열기" 안내 문구가 최소 처방, redirect 전환은 안 한다) · ★iOS 키보드가 입력창을 가리는지(S-5④ — 가리면 visualViewport 보정 추가) |
| **4** | `PhoneApp`(비로그인 로그인 화면·내 문항·받은 문항·폴더·문항 메뉴) + 앱 열람 → `PhoneReader` + 댓글/agent 시트 | 편집 진입점 0 · agent: **오너 + (멤버 && commentsVisible)만 아이콘 노출**, 비멤버 로그인은 미노출(S-1) · `canComment=false`로 입력 UI 없음 · 받은 문항 열람에서 가려진 탭 안 보임(S-11) · 앱 댓글 CodeMirror 입력 IME(한글 조합·수식 `$`) 검증 · 딥링크 `?view=p&id=` **로그인 상태에서** 폰 동작(S-10) · 비로그인 `/` = 로그인 화면(Q11) |
| **5** | CLAUDE.md 갱신(§11) · `docs/phasedocs/` 등록 · roadmap | 배포 후 Cmd+Shift+R(PC) + 폰 캐시 삭제 확인 |

각 Stage는 **배포 가능 단위**다 — Stage 1까지만 배포해도 데스크톱은 무변경이고 폰 사용자는 Bazaar만 새 화면을 본다. Stage 2가 이 Phase의 핵심(수요의 90%가 오는 `/p`).

---

## 9. 확정 결정 (Q1~Q11 — 2026-09-07 덕수, 전항 권장안 채택)

| # | 질문 | 확정 |
|---|---|---|
| Q1 | agent 열람 "회원" 범위 | **(a) 오너 + 그 문항의 멤버, 규칙 변경 0.** 노출 게이트에 멤버는 `commentsVisible` 포함(S-1). "공개 문항이면 로그인 누구나"(b)는 규칙 개정+백필+공개 범위 정책이 걸린 별도 Phase |
| Q2 | "PC 화면으로 보기" 기억 | **sessionStorage**(탭 수명). CLAUDE.md의 "폭은 세션 내 상태·localStorage 금지"는 드로어 폭 결정이라 무관함 확인 |
| Q3 | 폰 리더 svg·ggb | **켠다** — 방식은 E-6 정정대로 "ProblemTabContent에 분기 추가 + next/dynamic". GeoGebra 터치는 Stage 2 판정 |
| Q4 | Bazaar 과목 칩 | **보류, 검색만.** 태그가 자유 입력이라 칩 후보 산출(상위 빈도 N개)이 먼저 — 후속 |
| Q5 | 폰 카드 rail 거터 2.2em | **유지** — 경우 구조는 Mathory 풀이의 정체성, 본문 ~21.7em은 한글 충분 |
| Q6 | 판별식(E-1 모순 해소) | **세로 조건에 `pointer:coarse` 결합** — `w≤599 ∨ (h≤599 ∧ coarse)`. 폰 가로는 폰, PC 낮은 창은 데스크톱 |
| Q7 | 폰 글자 기본값 | **15 공유**(키·기본·범위를 `lib/constants.ts` 한 곳으로) |
| Q8 | 폰 요약 보기 기본 | **전 경로 full**(코드 0줄 — `useOutlineState` 기본값). 토글은 그대로 제공 |
| Q9 | 데스크톱 agent 버튼 멤버 확장 | **폰만 열고 PC는 후속** — PC는 canComment 계산을 모드별로 갈라야 해서 1줄이 아님. 비대칭은 §6에 명문화했다 |
| Q10 | 인앱 브라우저 로그인 | **v1 현상 유지 + Stage 3 검수 항목화.** 실패 실측 시 "기본 브라우저로 열기" 안내가 최소 처방. redirect 전환은 Safari ITP 이슈가 별개라 이번에 안 한다 |
| Q11 | 비로그인 폰 `/` | **로그인 화면(워드마크+Google 버튼) + Bazaar 둘러보기**(하단 탭 Bazaar만 활성) |

---

## 10. 후속 과제 (이번 범위 밖)

- **PWA**: `manifest.webmanifest` + 512px 아이콘 마스터 + `display: standalone` — 모바일 웹 완성 뒤("홈 화면에 추가"). 네이티브 앱은 별개의 대형 프로젝트.
- **데스크톱 agent 버튼 멤버 확장**(Q9-b): `ProblemView:820` 게이트 + agent 모드 전용 canComment 계산 분리.
- **Bazaar 과목 칩**(Q4): 태그 빈도 기반 칩 후보 산출부터.
- **인앱 브라우저 로그인 개선**(Q10): Stage 3 실측 결과에 따라 안내 문구 또는 redirect 검토(ITP 왕복 검증 전제).
- **큰/작은 폰 튜닝**(E1): 360px 탭 라벨·행 보조줄 줄바꿈, 430px 카드 폭 상한.
- **가로 보기**(E2): 회전 잠금이 없으니 `PhoneReader`만 2단(문제|풀이) 검토.
- **공개 문항 agent 열람 확대**(Q1-b), **폰 편집**(E4 — 하지 않는다는 결정 유지), 폰 알림.

---

## 11. CLAUDE.md 개정 항목 (Stage 5)

1. 「핵심 파일 구조」에 `components/phone/` · `PhoneShell` · `BottomSheet` · `lib/device.ts` · `lib/deepLink.ts` 추가, `test:device` 스크립트.
2. 「핵심 패턴」 규약 신설: **"폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 `[data-phone]`만 본다 — 판별용 `@media` 금지, `@media (hover: hover)`만 허용(입력 장치 질의). 판별식은 `w≤599 ∨ (h≤599 ∧ coarse)` — 세로 조건에서 coarse를 빼면 PC 낮은 창이 폰이 된다."**(함정 2 + E-1).
3. 우측 드로어 3종 규약(2026-08-18)에 **"데스크톱 한정 · 폰은 BottomSheet(Z_SHEET 9500, 다이얼로그·말풍선 아래)"** 단서.
4. `[data-phone]` CSS를 더할 때 **동특이도 기존 규칙과의 순서 의존을 취소 규칙으로 제거할 것**(함정 4 — callout 수식 전례).
5. `MiniShell.tsx:13` U8 주석 해소, `AppShell 100dvh`, `FONT_SIZE_*`는 `lib/constants.ts`가 소유(사본 금지).
6. 판별 기기 표(D1)와 탈출구(D4)를 명문화 — 다음 Phase에서 누군가 UA만으로 되돌리지 않도록.
7. agent 열람 게이트 비대칭(폰 오너+멤버 / PC 오너)은 **의도**임을 기록(Q9).
