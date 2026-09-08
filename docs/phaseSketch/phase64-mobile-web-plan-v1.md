# Phase 64 구현 계획서 — 휴대폰 열람 전용 화면(모바일 웹) (v1)

> 대상: CLI Claude (실측 교차검토 → 구현) · 상위 자료: 목업 캔버스 「Mathory 모바일 열람 화면」(web, 2026-09-07, 7장) · 덕수 전제 확정(2026-09-07)
> 계보: **v1(web, 2026-09-07)** → v2(CLI 실측 교차검토) → v3(web 재검증·판정) 예정
> 진실 원천: mathory **origin/main `1c171ad`** (M5 배포 후. 인용 라인은 전부 이 해시 기준)
> 범위: 휴대폰(짧은 변 < 600 CSS px) 접속 시 **열람 전용 셸**로 분기. 공개 라우트(`/p`·`/shared`·`/bazaar`) + 로그인 앱(`/`)의 열람(내 문항·받은 문항·Bazaar·agent 열람). **편집 없음.**
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

이것은 **모바일 웹**이다 — 같은 Next.js 앱 안에서 휴대폰이면 `PhoneShell`을, 그 외(PC·태블릿·폴더블 펼침)는 지금 화면을 그대로 낸다. 네이티브 앱·스토어·별도 코드베이스는 없다.
데스크톱 컴포넌트는 **한 줄도 바꾸지 않는 것을 목표**로 하고(예외 4곳, §5-3), 폰 셸은 `MiniShell`의 형제로 신설해 이미 폭에 유연한 부품(`ProblemTabContent`·`PublicComments`·`PublicViewerShell` 1단 폴백)을 재사용한다.
**서버 0 · Firestore 규칙 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI + `app/page.tsx` 서버 컴포넌트화 3줄.

---

## 1. 전제 (덕수 확정, 2026-09-07)

| # | 전제 | 계획서 반영 |
|---|---|---|
| E1 | **6.1인치급** 최다 사용 폰 크기에 맞춘다. 더 크거나 작은 폰은 차후 | 기준 뷰포트 **390×844 CSS px**(iPhone 15/16 · Galaxy S 계열 384~412와 동급). 360(소형)·430(Pro Max)은 **깨지지만 않게** — 고정 px 최소화, 별도 튜닝은 §10 |
| E2 | **세로 보기만.** 가로는 필요 제기 시 확장 | 판별식이 짧은 변 기준이라 폰 가로에서도 폰 셸이 뜬다. 1차는 **가로 레이아웃을 따로 만들지 않고** 세로 레이아웃이 그대로 늘어난다(§4 D3) |
| E3 | 현행 **색·아이콘·글꼴·로고**를 통일성 있게 그대로 쓸 수 있는지 타진, 불가피한 변경은 미리 점검 | §7 통일성 점검표 — 결론: **전부 그대로 쓴다.** 불가피한 변경 3건(아이콘 최소 크기·워드마크 사본·`:hover` 규칙)은 폰 전용이 아니라 **기존 부채 정리**다 |
| E4 | 휴대폰에서 **편집은 하지 않는다**(대전제) | 폰 셸에 `EditorView` 진입점 0. 문항 메뉴의 '편집'은 비활성 + "PC·태블릿에서" |
| E5 | **AI 에이전트 화면**도 로그인 회원에 한해 **열람** | `CommentPanel mode='agent' canComment={false}` 재사용(읽기 전용 구조가 이미 있다, §3 B-3). **"회원"의 범위는 Firestore 규칙이 정한다** — §2 P4 |
| E6 | (앞서 확정) 판별 = 화면 짧은 변 < 600 CSS px. 폴더블 펼침·태블릿·PC = 기본 화면 | §4 D1·D2 |
| E7 | (앞서 확정) 목업 기본 구조 승인 — 상단 바 고정·2탭·바텀 시트·하단 탭 3개 | §6 화면 사양이 목업 7장과 1:1 대응 |

---

## 2. 타당성 판정 — 불가능하거나 기존 정책과 정면으로 만나는 지점

**불가능 판정 0건.** 아래 5건은 규칙을 개정하거나 구상을 조정해야 한다.

| # | 구상 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | 서버에서 UA 힌트로 첫 렌더를 고른다 | `app/page.tsx`가 **`'use client'`**(3줄) → `headers()`를 부를 수 없다. `/p`·`/shared`·`/bazaar`의 page.tsx는 이미 서버 컴포넌트 | `app/page.tsx`의 `'use client'`를 떼고 서버 컴포넌트로 되돌린다. `AppShell`이 자체 `'use client'`라 중첩은 문제없다. **변경 3줄**(§5-3 ①) |
| **P2** | 폰 셸을 `AppShell` 안에서 분기 | `AppShell.tsx`(1,103줄)는 `loadData`·DnD 컨텍스트·뷰 상태를 한 몸에 갖는다. 폰 트리를 그 안에 끼우면 데스크톱과 상태를 공유하게 되어 "데스크톱 무변경"이 깨진다 | **`AppShell` 최상단 조기 반환** `if (isPhone) return <PhoneApp user … />` 한 줄만 넣고, `PhoneApp`은 **자기 데이터를 자기가 읽는다**(`listRecentProblems`·`listFolders`·`listSharedWithMe` — 전부 `lib/`에 있음). 상태 공유 0, 데스크톱 코드 경로 무변경 |
| **P3** | 앱 열람뷰를 폰에 옮긴다 | `ProblemView`는 최소 폭 758px(라벨 열 `7em`=105 + 카드 600), `WIDTH_EM_MIN 35`라 35em 아래로 못 줄인다(`lib/constants.ts:36-39`, `TabBody.tsx:92-102`) | **옮기지 않는다.** 폰 리더는 `ProblemTabContent`(props 2개, `width:100%`)로 새로 조립한다. 라벨 열(문제/풀이)은 **탭**이 대신한다 |
| **P4** | agent 화면을 "로그인 회원"에게 연다 | UI 게이트는 `ProblemView.tsx:820` `user && isOwnerView`(오너 전용)이지만, **실제 인가는 Firestore 규칙**이다: agent 세션 read = 오너 OR **멤버**(`firestore.rules:333`), agent 메시지 read = 오너 OR (멤버 && commentsVisible)(`:234-236`). 공개 문항의 비멤버 로그인 사용자는 `commentStream==true`(댓글) 메시지만 읽는다 | **1차의 "회원" = 그 문항의 멤버(공유받은 사람) + 오너.** 규칙 변경 0으로 즉시 성립한다. "공개 문항이면 로그인한 누구나 agent 열람"은 규칙 개정 + 기존 메시지 백필이 필요한 **정책 결정**이라 v1은 넣지 않는다 → **Q1** |
| **P5** | 우측 드로어 3종 규약(absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`) | `CommentPanel` 루트가 **자기 위치를 스스로 정한다**(`:876-893` `position:absolute; top/right/bottom:8; width; maxWidth:90vw; zIndex:50`). 폰에서 밀어내기·리사이즈는 무의미 | 규약은 **데스크톱 한정**으로 두고 폰은 **바텀 시트 하나의 문법**으로 통일한다(D9). `CommentPanel`은 positioned 래퍼 + `width:'100%'`로 감싸 **무변경 재사용**, 인셋 8px은 시트 안쪽 여백으로 흡수한다. 리사이즈 핸들·`SelectionInsertPopup`은 폰에서 렌더하지 않도록 **prop 2개 추가**(§5-3 ③) |

---

## 3. 확정 사실 (실측, 전부 `1c171ad`)

### A. 진입·판별

| # | 사실 | 위치 |
|---|---|---|
| A-1 | `app/page.tsx` = `'use client'` + `<AppShell />` 3줄. `next.config.*`·`vercel.json` 없음. `layout.tsx`에 `viewport` export 없음(Next 14 기본 `width=device-width, initial-scale=1` 주입) | `app/page.tsx:1-6`, `app/layout.tsx` |
| A-2 | UA·`pointer:coarse`·`matchMedia` 사용 **0건**. 폭 분기는 `PublicViewerShell.tsx:35`(innerWidth ≥ 880 → 2단)와 `BazaarView.tsx:43`(ResizeObserver 620/480) 둘뿐 | grep 전수 |
| A-3 | `AppShell` 루트 `height:'100vh'`(`:803`) — iOS Safari 주소창에 하단이 잘린다. `MiniShell.tsx:29`·`bazaar/page.tsx:27`는 이미 `100dvh` | 불일치 |
| A-4 | `AppShell`은 로그인 화면을 따로 그리지 않는다 — 비로그인이어도 Sidebar+main을 그리고 `loadData`만 게이트(`:225`). 딥링크는 `?view=bazaar\|p\|shared&id=` 1회 읽고 `replaceState('/')`(`:255-294`) | `AppShell.tsx` |
| A-5 | 루트 레이아웃이 `<DialogHost/>`·`<RefTooltip/>`을 전역 1벌 마운트 → 폰 셸도 자동 상속. `dialogBody`는 `maxWidth:92vw, maxHeight:88vh`라 폰에서 자동 축소 | `layout.tsx:29-35`, `dialogStyles.ts:36-43` |

### B. 재사용 부품

| # | 사실 | 위치 |
|---|---|---|
| B-1 | `ProblemTabContent({blocks, tabId})` — props 2개, 요약 보기 토글 내장(`:127-131`, question 탭 제외), **svg·ggb 분기 없음**(공개 뷰어 D16 의도) | `ProblemTabContent.tsx:29` · `TabBody.tsx:27` |
| B-2 | `PublicComments({problemId, commentSessionId, writeEnabled?})` — 자기 구독·자기 auth·로그인 버튼 내장, 루트 `width:100%`, 위치 미지정 → 그대로 임베드 가능 | `PublicComments.tsx:21-30, 114-117` |
| B-3 | `CommentPanel` — `mode:'comments'\|'agent'`, `canComment=false`면 입력 UI·AI 칩·검증 칩이 전부 빠지고 **메시지 리스트만 남는다**(`:1071`, `:1141`). `width` 타입 `number\|string`. `window.innerWidth` 0건. 입력창은 CodeMirror 6(`LatexInputEditor`) | `CommentPanel.tsx:64-101, 876-893, 1071` |
| B-4 | `PublicViewerShell` = `height:100%` + 880 미만 **1단+탭 버튼 폴백**(`:90-102`) 이미 존재. 다만 카드 `padding 32/36/40` + 열 `24` = 좌우 124px 고정 소모, `fontSize:15` 하드코딩, 댓글 aside `width:380` | `PublicViewerShell.tsx:124, 139-148, 176` |
| B-5 | hold-to-peek '문제' 알약은 이미 `onPointerDown/Up/Cancel` + `touchAction:'none'`(`:898-917`). 팝업은 `TabBody hideLabel` 한 벌 더 + `maxHeight:80vh`(`:966-993`) | `ProblemView.tsx` |
| B-6 | `RefTooltip` = `document` `mouseover/mouseout` 위임 1개(`:179-180`), 순수 DOM `show(el, root)`/`close()`, 정의부 탐색 `findDefinition()`(`:97-113`). 게이트 `[data-ref-tooltip]`. **탭(click) 리스너 하나 추가로 같은 lookup 재사용 가능** | `RefTooltip.tsx` |
| B-7 | `SvgViewer`는 `react-zoom-pan-pinch` pinch 활성(`:66`), `GgbViewer` 전체화면 `100vw/100vh` fixed(`:322-330`) — 터치는 살아 있고 `100vh`만 문제 | `SvgViewer.tsx`, `GgbViewer.tsx` |
| B-8 | `SizeStepper` 버튼 14×11px — 터치 타깃 미달(권장 44) | `SizeStepper.tsx:52-63` |
| B-9 | `ContextMenu` 닫기 = `document` **`mousedown`만**(`:40`) → 터치 바깥 탭으로 안 닫힌다. `BazaarView` 내 게시물 액션은 `mine && hovered`(`:270`) hover 전용 | `ContextMenu.tsx`, `BazaarView.tsx` |
| B-10 | `PdfDialog`·`window.print()`는 데스크톱 게이트 없음 — 폰에서도 뜬다 | `PdfDialog.tsx:49`, `lib/pdfPrint.tsx:108` |

### C. 데이터 경로

| # | 사실 | 위치 |
|---|---|---|
| C-1 | 폴더·문항·받은 문항: 훅 없음. `AppShell.loadData`(`:181-224`)가 `listProblems`·`listRecentProblems(uid,10)`·`listSharedWithMe`·`listSharedByMe`·`listFolders`를 직접 호출해 prop으로 뿌린다 | `lib/*` |
| C-2 | Bazaar: `listBazaarFeed(q)`(`lib/bazaar.ts:100`), `BazaarView({uid, filter, onOpenPost?})` | |
| C-3 | 앱 열람 = `getProblemWithBlocks` **1회 fetch** + 오너/멤버 규칙. 공개 열람 = `watchProblem`+`watchTabBlocks` **실시간** + `visibility==='public'`. 두 경로는 통합돼 있지 않다 | `ProblemView.tsx:277`, `PublicProblemView.tsx:33-57` |
| C-4 | agent 데이터 = `problems/{id}/discussion_sessions`(type `'normal'`) + `tab_comments`(`commentStream=false`). read: 오너 OR 멤버 | `firestore.rules:234-236, 333` |

### D. 색·글꼴·아이콘·로고 (통일성 점검 근거 — §7)

| # | 사실 | 위치 |
|---|---|---|
| D-1 | 글꼴 링크 3: Pretendard(jsDelivr) · Google Fonts(Noto Serif KR/Noto Sans KR/JetBrains Mono) · KaTeX 0.16.28 CSS. `@font-face` 2: D2Coding(jsDelivr) · **MathoryCircled**(`local()` 3종 → gstatic Noto Sans KR 서브셋 URL, ①~⑳, `size-adjust 88%`) | `layout.tsx:15-27`, `globals.css:8-16, 37-45` |
| D-2 | **안드로이드 폰에는 `local('AppleGothic'/'Apple SD Gothic Neo'/'Malgun Gothic')`이 전부 없다** → MathoryCircled는 gstatic URL 폴백이 실경로가 된다. 그 URL은 주석이 "언젠가 404 가능"이라 표시한 자리 | `globals.css:37-45` |
| D-3 | 워드마크는 **인라인 3벌**이고 서로 다르다: MiniShell(19/600/`--mathory-red`) · Sidebar(19/**400**/`#944728` 하드코딩) · HomeView(48/400/`--mathory-red-dark`). 로고 파일은 `app/icon.svg`(64, `#D97757` 배경 흰 M)·`og-default.png`뿐 | `MiniShell.tsx:78-81`, `Sidebar.tsx:780-786`, `AppShell.tsx:1078` |
| D-4 | 아이콘 = Phosphor regular, `phIcon(d, defaultSize)`의 `size`는 자유 숫자. 헤더 주석 "최소 렌더 14px(D4), 임의 축소 금지". 기본값 14인 아이콘이 다수(`IconComment`·`IconShare`·`IconChevron`…) | `Icons.tsx:39-44, 80-104` |
| D-5 | `globals.css`에 `@media` 0개, `:hover` 규칙 6개(`.problem-card` `:868`, `.folder-row` `:869`, `.list-folder-row` `:874`, **`.section-head, .case-head` `:952-953`**, `.verify-finding-row` `:1007`, 스크롤바) — 터치에서는 탭 후 hover가 **들러붙는다** | `globals.css` |
| D-6 | 색 토큰은 전부 `:root` 한 벌, 다크 없음(CLAUDE.md:137). 명암비 구속 조건 `#E8DFCE`(CLAUDE.md:219) | |

---

## 4. 결정 (D1~D16 — v1 제안, 교차검토 대상)

### 판별·진입

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **`lib/device.ts` 신설(import 0).** `PHONE_MAX_SHORT_SIDE = 599`. `isPhoneViewport(w, h) = Math.min(w, h) <= 599`. `guessPhoneFromHeaders(ua, chUaMobile)` = `chUaMobile === '?1'` 우선, 없으면(Safari) `/Mobi\|Android\|iPhone/i.test(ua)`. `tests/device.test.mjs`로 기기 표(iPhone 15 390×844 · S24 384×824 · Z Fold 펼침 673×841 · Pixel Fold 883×736 · iPad mini 744×1133 · 폰 가로 844×390)를 고정한다 | E6 · CLAUDE.md "순수 로직은 lib/ import 0 + tsc 테스트" |
| **D2** | **두 겹 판별.** ① 서버: 라우트 page.tsx(서버 컴포넌트)가 `headers()`로 `guessPhoneFromHeaders`를 계산해 `initialPhone` prop으로 내린다. ② 클라이언트: `hooks/useIsPhone.ts`가 **첫 렌더는 `initialPhone`을 그대로 쓰고**(hydration 불일치 0), `useEffect`에서 `matchMedia('(max-width:599px), (max-height:599px)')`로 보정 + `change` 구독. iPadOS Safari는 Macintosh UA라 서버가 데스크톱으로 찍지만 태블릿이므로 결과는 맞다 | P1 · A-1 |
| **D3** | **가로 레이아웃 없음.** 짧은 변 기준이라 폰 가로에서도 폰 셸이 뜨고, 세로 레이아웃이 그대로 늘어난다(상단 바 52 + 탭 44 = 96px 고정, 나머지 스크롤). 가로 전용 조정은 하지 않는다 | E2 |
| **D4** | **탈출구 = ⋯ 시트의 "PC 화면으로 보기".** `sessionStorage['mathory.forceDesktop']='1'`(탭 세션 한정, 새 탭이면 다시 자동 판별). 데스크톱 셸에는 되돌아오는 버튼을 두지 않는다 — 탭을 닫으면 풀린다. ⚠ CLAUDE.md의 "폭 영속 없음·localStorage 금지"는 드로어 폭에 관한 결정이라 여기 해당 없음이나 **Q2**로 확인 | 판별 오류 대비 |
| **D5** | **`app/layout.tsx`에 `export const viewport = { width:'device-width', initialScale:1, viewportFit:'cover' }` 명시.** `viewportFit:'cover'`는 하단 탭 바의 `env(safe-area-inset-bottom)` 때문. `maximumScale`은 **두지 않는다**(수식 핀치 확대는 독자의 권리) | A-1 |

### 셸·라우팅

| # | 결정 | 근거 |
|---|---|---|
| **D6** | **`components/layout/PhoneShell.tsx` 신설** — `MiniShell`의 형제. props `{ title?, left?: 'back'\|'wordmark', right?: ReactNode, tabs?: ReactNode, footer?: ReactNode, children }`. 루트 `height:100dvh` flex 열, 상단 바 52(`--bg-functional`, 하단 1px `--border-light`), 본문 `flex:1; overflow:auto`, footer(하단 탭 바) `padding-bottom: env(safe-area-inset-bottom)`. `MiniShell.tsx:13`의 "U8 후속 과제" 주석을 이 Phase로 갱신 | P2 · B-4 |
| **D7** | **공개 라우트 3개는 page.tsx에서 셸만 바꾼다.** `<ResponsiveShell initialPhone phone={<PhoneShell…>} desktop={<MiniShell…>}>`(클라이언트 래퍼, `useIsPhone` 소비). `PublicProblemView`·`SnapshotView`·`BazaarView`는 **무변경**으로 두 셸에 그대로 들어간다 — 단 `/p`·`/shared`의 본문은 폰에서 `PublicViewerShell` 대신 **`PhoneReader`**(D10)를 쓰므로 `PublicProblemView`에 `reader?: 'desktop'\|'phone'` prop 1개 추가(§5-3 ②) | H · B-4 |
| **D8** | **로그인 앱은 `AppShell` 조기 반환 1줄 + `PhoneApp` 신설.** `PhoneApp`은 뷰 상태 `home\|folder\|received\|bazaar\|problem\|agent`를 자체 소유하고 데이터도 자체 로드(C-1의 `lib/` 함수 직접 호출). `AppShell`의 딥링크 규약(`?view=…&id=`)은 `PhoneApp`도 같은 함수로 읽는다(`lib/`로 추출, §5-3 ④). 폰 하단 탭 3개 = 내 문항 · 받은 문항 · Bazaar | P2 · A-4 |
| **D9** | **바텀 시트 1종 `components/ui/BottomSheet.tsx`** — 우측 드로어 3종의 폰 번역. `{ open, height: number\|'auto', onClose, children }`. `position:absolute; inset` 바닥 고정, `--bg-drawer` + `--drawer-shadow`, 상단 그립 36×4 `--border-content`, 딤 `rgba(45,42,35,0.32)`, 닫기 = 딤 탭 + 그립 아래로 드래그(`pointer` 이벤트, 60px 임계) + 시트 안 X. **스와이프 이외 애니메이션은 열림/닫힘 0.2s 하나뿐**(`--transition-normal`) — 튀는 연출 금지 원칙 | P5 · 8/29 판정 |

### 리더

| # | 결정 | 근거 |
|---|---|---|
| **D10** | **`components/phone/PhoneReader.tsx` 신설** = 상단 바(뒤로·제목·댓글 수·⋯) + 탭(문제/풀이, 2등분 44px, 활성 = accent 2px 밑줄) + 탭당 `ProblemTabContent` 카드. 탭 상태는 **비영속**(진입 시 항상 문제 탭 — 스포일러 방지). 문제 탭 하단 `[풀이 보기]`(48px, 탭 전환), 풀이 계열 탭 상단 `[문제 보기]` 알약(32px, 탭 → 바텀 시트에 문제 탭 카드 한 벌 더, B-5의 팝업과 같은 구조) | E7 · B-1 · B-5 |
| **D11** | **카드 = 클레이 `--bg-content`, radius 6(`CARD_RADIUS`), 좌우 margin 10, padding `1.1em 1em 1.2em 2.2em`, 글자 기본 16px, `line-height 1.8`.** 좌 2.2em은 경우 rail·dot 거터(`--case-rail-x -1.3em`, 필요 거터 2.06em)를 **그대로 보존**하기 위한 값 — `.problem-card`처럼 rail을 끄지 않는다. `--card-pad-l/r`를 `2.2em`/`1em`으로 세워 `.outline-section` 전폭 톤이 맞게 한다(TabBody:302-303 문법). 본문 폭 = 390 − 20 − 35 − 16 = **319px ≈ 20em** | 목업 · globals.css:180-210 |
| **D12** | **글자 크기 11~24, 기본 16, `localStorage 'mathory-content-font-size'` 공유** — 앱 열람뷰의 `FONT_SIZE_KEY`(ProblemView:41-45)와 **같은 키**를 써 PC↔폰이 한 값을 본다. 조절 UI는 ⋯ 시트의 스테퍼(44×36 버튼) — `SizeStepper`는 14×11이라 폰에서 쓰지 않고 `BottomSheet` 행에 새로 그린다 | B-8 · 목업 |
| **D13** | **수식 넘침 = 수식만 가로 스크롤.** 폰 셸 루트에 `data-phone` 속성을 달고 `globals.css`에 `[data-phone] .katex-display { padding-left:1em; overflow-x:auto; overflow-y:hidden }`·`[data-phone] .callout-block { padding-left:1em }` 두 규칙만 추가. `@media`가 아니라 **속성 스코프**인 이유: 폰 셸일 때만 적용되어야지 PC 창을 좁혔을 때 데스크톱 화면이 바뀌면 안 된다. 본문(`.preview-content p`)은 `keep-all + overflow-wrap:break-word`가 이미 있어 가로 스크롤이 나지 않는다 | globals.css:394-396, 559-565 |
| **D14** | **svg·ggb 블록**: `ProblemTabContent`에 `viewers?: boolean` prop을 추가해 **폰 리더에서만** `TabBody.tsx:135-160`의 svg/ggb 분기를 켠다(기본 false → 공개 뷰어 D16 동작 무변경). `GgbViewer` 전체화면의 `100vh`는 `100dvh`로 | B-1 · B-7 · **Q3** |
| **D15** | **참조 말풍선 = 탭.** `RefTooltip`에 `click` 위임 하나 추가: `[data-phone]` 조상이 있을 때만 `pointerup`으로 `show()`, 바깥 탭·스크롤에 `close()`. 말풍선 자체는 폰에서 **하단 시트 형태가 아니라 현행 fixed 박스** 유지(`max-width: min(35em, 80vw)`가 이미 폰에 맞다). 데스크톱 hover 경로 무변경 | B-6 |
| **D16** | **댓글·agent 시트.** 공개(`/p`) 댓글 = `PublicComments` 그대로(익명 읽기, 쓰기는 Google 로그인). 앱 열람 댓글·agent = `CommentPanel`을 `BottomSheet(height 78%)` 안 positioned 래퍼에 `width:'100%'`로. **agent는 `canComment={false}` 고정**(폰은 열람만, E4·E5) → 입력창(CodeMirror)·AI 칩·검증 칩이 렌더되지 않아 폰 IME 문제를 아예 만나지 않는다. 앱 댓글은 `canComment`를 현행 `canCommentOnProblem` 그대로 — 단 CodeMirror 입력창의 폰 IME 검증이 Stage 4 검수 항목 | B-3 · P4 |

---

## 5. 아키텍처

### 5-1. 신설 (전부 클라이언트)

| 파일 | 역할 | 크기 추정 |
|---|---|---|
| `lib/device.ts` + `tests/device.test.mjs` | 판별 순수 함수(import 0) | 40줄 + 테스트 |
| `hooks/useIsPhone.ts` | `initialPhone` → matchMedia 보정 + forceDesktop | 40줄 |
| `components/layout/ResponsiveShell.tsx` | `{initialPhone, phone, desktop}` 스위치 | 20줄 |
| `components/layout/PhoneShell.tsx` | 상단 바·본문·하단 탭 바 프레임 | 150줄 |
| `components/ui/BottomSheet.tsx` | 시트 1종 | 120줄 |
| `components/ui/Wordmark.tsx` | 워드마크 공용(§7-4) | 30줄 |
| `components/phone/PhoneReader.tsx` | 문항 열람(문제/풀이 탭·알약·⋯·댓글/agent 시트) | 350줄 |
| `components/phone/PhoneMoreSheet.tsx` | 글자 크기·링크 복사·Bazaar·PC 화면·로그인 | 120줄 |
| `components/phone/PhoneApp.tsx` | 로그인 앱 폰 루트(뷰 상태·데이터 로드·하단 탭) | 300줄 |
| `components/phone/PhoneList.tsx` | 폴더 행·문항 행(수정일·검증·댓글 수)·zebra | 150줄 |
| `components/phone/PhoneBazaar.tsx` | Bazaar 2행 카드 목록(배지·제목 / 닉·날짜·태그) + 검색 | 180줄 |
| `components/phone/PhoneItemMenu.tsx` | 문항 행 ⋯: 열람·공유 링크 복사·편집(비활성)·폴더 이동 | 80줄 |

### 5-2. 데이터 흐름

```
/p/[id]  page.tsx(서버) ─headers()→ ResponsiveShell ─┬─ MiniShell + PublicProblemView(reader='desktop')   ← 현행
                                                     └─ PhoneShell + PublicProblemView(reader='phone') → PhoneReader
/        page.tsx(서버) ─headers()→ AppShell(initialPhone) ─┬─ (현행 트리, 무변경)
                                                            └─ isPhone → PhoneApp → PhoneList / PhoneBazaar / PhoneReader
```
`PhoneReader`의 데이터 소스는 호출자가 준다: 공개 경로는 `watchProblem`+`watchTabBlocks`(실시간), 앱 경로는 `getProblemWithBlocks`(1회) — C-3의 두 경로를 **통합하지 않고** `PhoneReader({ problem, tabs, tabBlocks, commentsSlot?, agentSlot?, onBack })`이 순수 표시만 맡는다.

### 5-3. 기존 파일 수정 (4곳, 전부 최소)

| # | 파일 | 변경 |
|---|---|---|
| ① | `app/page.tsx` | `'use client'` 제거 → 서버 컴포넌트, `headers()` 읽어 `<AppShell initialPhone={…} />`. **3줄** |
| ② | `components/share/PublicProblemView.tsx`, `SnapshotView.tsx` | `reader?: 'desktop'\|'phone'` prop — `'phone'`이면 `PublicViewerShell` 대신 `PhoneReader`. 데이터 로직 무변경 |
| ③ | `components/comment/CommentPanel.tsx` | `resizable?: boolean = true`, `selectionPopup?: boolean = true` prop 2개 — 폰에서 false. 기본값이 현행이라 데스크톱 무변경 |
| ④ | `components/layout/AppShell.tsx` | 딥링크 파서를 `lib/deepLink.ts`(import 0)로 추출 + 조기 반환 1줄. `:803` `100vh → 100dvh`(A-3, 데스크톱에도 무해) |

그 외: `ProblemTabContent` `viewers` prop(D14) · `RefTooltip` click 위임(D15) · `GgbViewer` `100dvh`(D14) · `globals.css` 규칙 2개(D13) + `:hover` 6개를 `@media (hover: hover)`로 감싸기(§7-5) · `layout.tsx` viewport(D5) · `MiniShell.tsx:13` 주석.

### ⚠ 함정 1 — hydration

서버가 폰으로 찍었는데 클라이언트 첫 렌더가 데스크톱을 그리면 React가 트리 불일치를 낸다. `useIsPhone`의 **초기 상태는 반드시 `initialPhone`**이고, matchMedia 보정은 `useEffect` 안에서만 한다. 보정이 일어나는 경우는 (a) 데스크톱 창을 599 이하로 줄인 상태 (b) UA 스푸핑 (c) 폴더블을 펼친 채 접속 — 셋 다 드물고, 보정 순간 한 번 다시 그리는 것은 허용한다.

### ⚠ 함정 2 — `[data-phone]` 스코프와 `@media`를 섞지 말 것

D13의 수식 규칙은 속성 스코프다. 같은 것을 `@media (max-width:599px)`로 쓰면 **PC에서 창을 좁혔을 때 데스크톱 화면의 수식 들여쓰기가 바뀐다**(현재 데스크톱은 그 폭에서도 데스크톱 셸이다 — 짧은 변 판별은 `min(w,h)`라 PC 창 599×800은 폰이 되지만, 1200×500은 아니다). 폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 그 결과(`data-phone`)만 본다. 예외는 §7-5의 `@media (hover: hover)` — 이것은 폭이 아니라 **입력 장치** 질의라 혼동이 없다.

### ⚠ 함정 3 — `CommentPanel`을 시트에 넣을 때 `position:absolute` 인셋

루트가 `top/right/bottom:8`을 스스로 갖는다(B-3). 시트 본문에 `position:relative; height:100%`를 준 뒤 `width:'100%'`를 넘기면 좌 0·우 8·상하 8의 인셋이 남는다 — **인셋 8을 시트 안쪽 여백으로 받아들이고**(그립 아래 8px이 자연스럽다) 좌측만 `paddingLeft:8`로 대칭을 맞춘다. 상수를 prop화하는 개조보다 싸다.

---

## 6. 화면 사양 (목업 7장 대응)

| 목업 | 화면 | 구성 | 데이터 |
|---|---|---|---|
| 1 | 열람·문제 | 상단 바(◀·제목·💬n·⋯) · 탭 · 클레이 카드(문제) · `[풀이 보기]` · 메타(실시간 공개·게시자) · 슬로건 | D10·D11 |
| 2 | 열람·풀이 | `[문제 보기]` 알약 · 풀이 카드(`solution-tone` dim/key · 경우 rail·dot · Tip 코칭 · display 수식 1em) | D10·D13 |
| 3 | 댓글 시트 | `BottomSheet 78%` · 헤더 "댓글 n" · 리스트 · 하단 Google 로그인(익명) / 입력창(회원) | D16 |
| 4 | ⋯ 시트 | 글자 크기 스테퍼 · 링크 복사 · Bazaar 광장 · PC 화면으로 보기 · 로그인(비로그인 시) | D4·D12 |
| 5 | Bazaar | 상단 바(워드마크·로그인) · 헤더 · 검색 44 + 정렬 · 칩(전체/과목) · 2행 카드 목록(배지·제목 / 닉·날짜·#태그) · 내 게시물 ⋯ | C-2 · **Q4**(과목 칩은 현행 태그 필터의 재포장 — 실물 판정) |
| 6 | 내 문항 | 상단 바(워드마크·검색·아바타) · 폴더 행(아이콘·이름·개수) · 최근 수정 행(제목 / 폴더·수정일·검증·댓글) · 하단 탭 3 | D8 · C-1 |
| 7 | 문항 메뉴 | `BottomSheet` — 열람 · 공유 링크 복사 · **편집(비활성, "PC·태블릿에서")** · 폴더 이동 | E4 |
| — | agent 열람(목업 외) | 열람 상단 바에 agent 아이콘(`IconAgent`, 오너·멤버에게만) → `BottomSheet` + `CommentPanel mode='agent' canComment={false}`. 세션이 여럿이면 현행 세션 셀렉터 그대로 | D16 · P4 |
| — | 받은 문항(목업 외) | 내 문항과 같은 `PhoneList` — `listSharedWithMe` 결과, 행 보조줄 = 공유자 닉 · 수정일 | C-1 |

공통: 폴더 DnD·다중 선택·칼럼 조절·리사이즈 핸들·버전 드로어·PDF/인쇄·시트 가져오기·일괄 검증 — **폰에서 진입점 없음**(B-9·B-10 문제를 만나지 않는다).

---

## 7. 통일성 점검 — 색·아이콘·글꼴·로고 (E3)

| 축 | 그대로 쓸 수 있는가 | 불가피한 변경 | 판정 |
|---|---|---|---|
| **7-1 색** | **전부 그대로.** 폰 셸은 `--bg-functional`(바) · `--bg-content`(카드) · `--bg-sidebar`(하단 탭 바) · `--bg-drawer`+`--drawer-shadow`(시트) · `--bg-bazaar`(Bazaar) · `--accent-primary`(활성 탭·배지) · `--tone-dim`/`--case-dot`/`--case-rail`/`--coach-important`(본문)를 새 토큰 0으로 조합한다. 명암비 구속 조건 `#E8DFCE`는 폰에서 hover가 없어 **오히려 완화**된다(최악 배경이 클레이 `#F4EFE7`) | 없음 | ✓ |
| **7-2 글꼴** | Pretendard·KaTeX·D2Coding·Noto 전부 CDN이라 폰에서도 같은 링크로 로드. `--katex-scale 1.08em`·`line-height 1.8`·`keep-all` 그대로 | **안드로이드에서 MathoryCircled(①~⑳)의 `local()` 3종이 전부 없어 gstatic 폴백 URL이 실경로**(D-2). 지금도 Windows 외 환경에선 폴백을 타므로 폰 전용 변경은 아니지만, **①~⑳이 안드로이드에서 88% 축소로 보이는지**는 Stage 1 검수 항목. 실패 시 대안 = Noto Sans KR 서브셋을 `public/fonts/`에 자체 호스팅(404 위험 제거, 어차피 주석이 권한 방향) | ✓ (검수 1건) |
| **7-3 아이콘** | Phosphor regular 그대로, `size` prop 자유. 폰은 상단 바 22 · 시트 행 22 · 하단 탭 22 · 행 보조 12~14 | **14px 기본 아이콘을 44px 히트 영역 안에서 20~22로 키운다** — "최소 14, 임의 축소 금지"(D-4)는 하한 규칙이라 충돌 없음. 히트 영역은 padding, 아이콘은 크기만 | ✓ |
| **7-4 로고** | 워드마크 글꼴·자간(`-0.03em`)·색 계열 그대로 | **인라인 3벌이 서로 다르다**(D-3: 600/red vs 400/#944728 vs 400/red-dark). 폰 헤더에 4번째 사본을 만들면 부채가 는다 → **`components/ui/Wordmark.tsx` 공용 추출**, props `{size:19\|48, weight, color}`로 세 벌을 그대로 재현하고 폰은 MiniShell 사양(19/600/`--mathory-red`)을 쓴다. 데스크톱 3곳은 렌더 결과 동일(픽셀 무변경). **로고 아이콘(`app/icon.svg`)은 PWA manifest용으로 512px 래스터가 필요하나 이번 범위 밖(§10)** | ✓ (정리 1건) |
| **7-5 상호작용** | — | **`:hover` 6개를 `@media (hover: hover)`로 감싼다**(D-5). 특히 `.section-head:hover, .case-head:hover`는 요약 보기 여닫이라 폰 리더 핵심 경로에서 탭 후 배경이 들러붙는다. 데스크톱은 hover 장치이므로 결과 무변경 | ✓ (정리 1건) |

**결론: 색·아이콘·글꼴·로고 모두 현행을 그대로 쓴다.** 변경 3건(아이콘 크기 상향·워드마크 공용화·hover 미디어 가드)은 전부 **데스크톱 픽셀 무변경**인 정리 작업이고, 유일한 위험은 안드로이드 ①~⑳ 폴백(7-2)이다.

---

## 8. 단계 (Stage) · 검수

| Stage | 내용 | 검수 (실기기: iPhone 6.1" Safari + Galaxy 6.1~6.2" Chrome) |
|---|---|---|
| **0** | `lib/device.ts` + 테스트 · `useIsPhone` · `ResponsiveShell` · viewport · `AppShell 100dvh` · `:hover` 가드 · `Wordmark` 추출 | `npm run test:device` 통과 · 데스크톱 3곳 워드마크 픽셀 동일 · PC 창 599×800에서 폰 셸, 1200×500에서 데스크톱 |
| **1** | `PhoneShell` · `BottomSheet` · `/bazaar` 폰 화면(`PhoneBazaar`) | 비로그인 폰에서 Bazaar 진입 · 검색 · 게시물 탭 → `/p` 이동 · 안드로이드 ①~⑳ 표시(7-2) |
| **2** | `PhoneReader` + `/p`·`/shared` 폰 경로(`reader='phone'`) · ⋯ 시트 · 글자 크기 · 수식 스크롤 · 참조 탭 · svg/ggb | 경우 rail·dot 좌표(11/16/24px 전부 카드 안) · display 수식 넘침 시 수식만 스크롤 · 요약 보기 토글 · 문제 보기 알약 시트 · 핀치 확대 허용 · 세로만(가로 회전 시 깨지지 않음) |
| **3** | `PublicComments` 시트(익명 읽기·로그인 쓰기) | 익명: 읽기만 + Google 버튼 · 로그인: 작성 · 스와이프 닫힘 |
| **4** | `PhoneApp`(내 문항·받은 문항·폴더·문항 메뉴) + 앱 열람 → `PhoneReader` + 댓글/agent 시트 | 편집 진입점 0 · agent: 오너·멤버만 아이콘 노출, 비멤버 로그인은 미노출(P4) · `canComment=false`로 입력 UI 없음 · 앱 댓글 CodeMirror 입력 IME(한글 조합·수식 `$`) 검증 · 딥링크 `?view=p&id=` 폰에서 동작 |
| **5** | CLAUDE.md 갱신(§11) · `docs/phasedocs/` 등록 · roadmap | 배포 후 Cmd+Shift+R(PC) + 폰 캐시 삭제 확인 |

각 Stage는 **배포 가능 단위**다 — Stage 1까지만 배포해도 데스크톱은 무변경이고 폰 사용자는 Bazaar만 새 화면을 본다. Stage 2가 이 Phase의 핵심(소비자 90%가 오는 `/p`).

---

## 9. 열린 질문 (Q1~Q5 — 덕수 판정)

| # | 질문 | v1 권고 |
|---|---|---|
| **Q1** | agent 열람의 "로그인 회원" 범위: (a) 오너 + 그 문항의 멤버(규칙 변경 0) / (b) 공개 문항이면 로그인한 누구나(규칙 개정 + `commentStream` 백필 + agent 메시지의 프롬프트·검증 내용이 공개되는 정책 판단) | **(a)**. (b)는 별도 Phase로 — agent 대화에는 정밀 검증 보고·그림 첨부가 섞여 있어 공개 범위를 따로 정해야 한다 |
| **Q2** | "PC 화면으로 보기"의 기억 방식: sessionStorage(탭 세션) / 기억 없음(매번 자동) / URL `?pc=1` | **sessionStorage**. 새로고침마다 풀리면 탈출구가 아니다 |
| **Q3** | 폰 리더에서 svg·ggb 블록 표시: 켠다(D14, `viewers` prop) / 1차는 "PC에서 보세요" 자리표시 | **켠다** — SvgViewer는 핀치가 이미 살아 있고 GgbViewer는 폭 100% 반응. 단 GeoGebra 애플릿 터치 조작은 Stage 2 실기기에서 판정 |
| **Q4** | Bazaar 폰 화면의 과목 칩(전체/미적분/확통/기하): 현행 태그 필터의 재포장으로 둘지, 뺄지 | **실물 판정** — 태그 체계가 자유 입력이라 칩 후보를 어떻게 뽑을지(상위 빈도 태그 N개)가 먼저 정해져야 한다. 1차는 검색만 두고 칩은 보류가 안전 |
| **Q5** | 폰 열람 카드의 rail 거터 2.2em(319px 본문) vs rail 끄고 1em(342px 본문) | **2.2em 유지** — 경우 구조는 Mathory 풀이의 정체성이고, 본문 20em은 한글 독서에 충분 |

---

## 10. 후속 과제 (이번 범위 밖)

- **PWA**: `manifest.webmanifest` + 512px 아이콘 래스터 + `display: standalone` — 모바일 웹 완성 뒤 값싼 한 단계("홈 화면에 추가"). 네이티브 앱은 별개의 대형 프로젝트(스토어·알림·재검증).
- **큰/작은 폰 튜닝**(E1): 360px에서 탭 라벨·행 보조줄 줄바꿈 점검, 430px에서 카드 폭 상한.
- **가로 보기**(E2): 필요 제기 시 `PhoneReader`만 2단(문제|풀이) 검토.
- **공개 문항 agent 열람 확대**(Q1-b), **폰 편집**(E4 대전제 유지 — 하지 않는다), 폰 알림.

---

## 11. CLAUDE.md 개정 항목 (Stage 5)

1. 「핵심 파일 구조」에 `components/phone/`·`PhoneShell`·`BottomSheet`·`lib/device.ts` 추가, `test:device` 스크립트.
2. 「핵심 패턴」에 규약 신설: **"폰 셸 여부는 `useIsPhone` 하나가 정하고 CSS는 `[data-phone]`만 본다 — 폭 `@media` 금지, `@media (hover: hover)`만 허용"**(함정 2).
3. 우측 드로어 3종 규약(2026-08-18)에 **"데스크톱 한정 · 폰은 BottomSheet"** 단서.
4. `MiniShell.tsx:13` U8 주석 해소, `AppShell 100dvh`.
5. 판별 기기 표(D1)와 탈출구(D4)를 명문화 — 다음 Phase에서 누군가 UA만으로 되돌리지 않도록.
