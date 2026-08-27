# Phase 62 구현 계획서 — 폴더뷰 구조 변경 · 좌우 사이드바 UI 통일 (v1)

> 대상: CLI Claude (실측 교차검토 → 구현) · 상위 문서: `Phase62 구상.md` (덕수, 2026-08-26)
> 계보: **v1(web, 2026-08-26)** → v2(CLI 실측 교차검토) → v3(web 재검증·판정) 예정
> 진실 원천: mathory **origin/main `431c6f6`** (M1 C 반영 후. 인용 라인은 전부 이 해시 기준)
> 범위: 구상 2축 전부 — **A축** FolderView 바탕·카드·리스트 개편 / **B축** 좌·우 사이드바·드로어 폭 조절 통일.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

FolderView에서 U자 클레이 프레임을 걷어내 바탕을 아이보리로 두고, 카드·리스트 행을 **클레이색 카드**로 뒤집어
"문항 하나를 보는 중(클레이)" ↔ "문항 밖으로 나옴(아이보리)"을 색으로 구분한다. 동시에 지금 EditorView·ProblemView에
**두 벌로 복제된** 우측 패널 리사이즈 코드를 훅 + 핸들 컴포넌트 하나로 뽑아 좌측 사이드바·버전 드로어·ProblemView
우측 단까지 같은 문법으로 폭을 조절하게 한다. **서버 0 · Firestore 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI.

---

## 1. 구상 타당성 판정 — 불가능하거나 기존 정책과 충돌하는 지점 (덕수 요청)

전부 **구현 가능**하다. 다만 아래 5건은 기존 규칙·철학과 정면으로 만나므로, 구현 전에 규칙 자체를 개정하거나 구상을 조정해야 한다.
표의 판정은 v1 제안이며 v2·v3 교차검토 대상이다.

| # | 구상 항목 | 충돌하는 기존 정책 | 판정 · 처방 |
|---|---|---|---|
| **P1** | FolderView에서 U자 프레임(클레이 + 3면 0.5px) 제거 | CLAUDE.md 작업 규칙 **"U자 프레임은 3곳 공유 — 한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 셋을 항상 함께 손댈 것"** (Phase 45a). FolderView.tsx:496-501·EditorView.tsx:3484-3489·ProblemView.tsx:682-688 세 곳이 동일 스타일 | **의도적 위반 — 규칙을 개정한다.** 이 규칙의 근거였던 "점멸"은 곧 이번 구상이 원하는 **상황 변화 신호**다. 따라서 규칙을 "U자 프레임은 **문항 단위 화면 2곳**(EditorView·ProblemView)이 공유하고 FolderView는 **의도적으로 프레임이 없다**"로 바꿔 쓴다(§7). 규칙을 안 고치면 다음 Phase에서 누군가 "3곳 동일"을 복원한다 |
| **P2** | 카드 색을 클레이(`--bg-content #F4EFE7`)로 낮춤 | CLAUDE.md **"명암비 구속 조건은 가장 어두운 카드 배경 `#E8DFCE`(`--block-bg-active`)"** — Phase 58·59·59a의 dot·dim·코칭 색이 전부 이 값에 대고 계산됐다 | **안전한 방향이다(밝아지므로 대비는 전부 개선).** 단 hover 톤을 "살짝 짙게"로 고를 때 **`#E8DFCE`보다 어둡게 가면 구속 조건이 깨진다.** v1은 hover = `--block-bg-active`(#E8DFCE, 현재 카드 기본색)로 고정해 **최악 배경을 지금과 동일하게 유지**한다(D3). 현행 hover `#E4DBCB`(:542)는 #E8DFCE보다 어두워 이미 dot 여유 0.28을 갉아먹고 있었다 — 이번에 정리 |
| **P3** | 카드·리스트 행에 hover **그림자** | CLAUDE.md E형 규칙 **"선은 전부 0.5px이고 그림자는 쓰지 않는다"** | **충돌 없음** — 그 규칙은 명시적으로 "편집창 블록"에 한정되고 "열람·공유·인쇄에는 적용하지 않는다". FolderView 카드는 이미 hover 그림자를 쓴다(:542). 단 **테두리 두께는 E형과 같은 0.5px**로 맞춘다(구상의 "얇은 테두리"와 일치, 현재 1px :558) |
| **P4** | ProblemView 우측 단(메뉴·공유·원본인증)에 "동일한 기준(폭 너비, 크기 조절)" | 우측 드로어 3종의 규약(CLAUDE.md 2026-08-18 항목): **absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`**. ProblemView 우측 단은 이와 달리 **flex 열**(:793-801, `flex:1, minWidth 150, maxWidth 220`)이고 폭이 글자크기 버튼·토글 위치(:732·:782의 `rightOpen ? 220 : 0`)에 하드코딩으로 박혀 있다 | **"기준 통일"을 문자 그대로 적용하면 안 된다.** 메뉴 열에 360px 최소폭은 무의미하고, absolute 오버레이로 바꾸면 글자크기 컨트롤·토글의 좌표 산식이 전부 깨진다. 통일할 것은 **조작 문법(핸들 컴포넌트·드래그 훅·커서·활성선)**이고, **폭 수치(min·max·기본)는 패널마다 별도**로 둔다(D5·D9). 우측 단은 flex 열을 유지한 채 `width` 상태만 훅에서 받는다 |
| **P5** | 좌측 사이드바 폭 조절 | 사이드바 폭은 CSS 토큰 `--sidebar-expanded: 260px`(globals.css:191) + `transition: width var(--transition-normal)`(Sidebar.tsx:814). 접힘(56px)↔펼침 전환 애니메이션이 이 transition에 의존 | **가능하나 transition을 드래그 중엔 꺼야 한다** — 켠 채로 드래그하면 0.2s씩 지연돼 핸들이 커서를 못 따라온다(D7). 토큰은 **기본값으로 강등**하고 실제 폭은 AppShell 상태로 올린다. 토큰 소비처는 Sidebar.tsx:809 한 곳뿐(grep 실측)이라 파급 0 |

**불가능 판정 0건.** 그 밖에 v1이 확인한 "구상이 전제한 사실"의 오차 2건은 §3-A 사실 A-9·A-10에 적었다(구분선의 정체, 리스트 가로폭이 이미 일치함).

---

## 2. 아키텍처

**전부 클라이언트. 리사이즈는 훅 1 + 핸들 컴포넌트 1로 단일화, FolderView는 스타일 치환.**

- `hooks/useDrawerResize.ts` — 폭 상태 + 드래그 핸들러(pointer capture, min/max 클램프, body cursor/userSelect 복원, 드래그 중 플래그). 현재 EditorView:2976-3006과 ProblemView:498-519에 **거의 같은 코드가 두 벌**로 있고 세부(리스너 대상 `el` vs `window`, 갭 12 vs 24)만 다르다 — 이 훅이 두 벌을 흡수한다.
- `components/ui/DrawerResizeHandle.tsx` — 10px 투명 strip + 가운데 1.5px 활성선(`--border-content-active`), `side: 'left' | 'right'`(패널의 어느 변에 붙는가). 현재 EditorView:3763-3784·ProblemView:1006-1025의 JSX 사본을 대체.
- 소비처 5곳: EditorView(댓글·agent, **버전 드로어**), ProblemView(댓글·agent, **우측 단**), AppShell(**좌측 사이드바**).
- FolderView·ListView — 스타일 치환만. 데이터·훅·DnD 무변경.

이유: (a) 구상 4번째 항목("추후 새 드로어도 통일된 방식")은 코드가 한 곳에 있어야만 지켜진다. (b) 사본 2벌의 미세 차이가 이미 있다는 것이 통일이 필요한 증거다. (c) FolderView는 색·테두리 문제라 구조를 건드릴 이유가 없다.

---

## 3. 확정 사실 (실측, 전부 `431c6f6`)

### A. FolderView · ListView

| # | 사실 | 위치 |
|---|---|---|
| A-1 | FolderView 루트 배경 = `--bg-functional`(아이보리). 제목바(minHeight 98)·하위 폴더 행은 이미 아이보리 chrome | `FolderView.tsx:376-378` |
| A-2 | **U자 프레임** = `background: var(--bg-content)` + `borderTop/Left/Right: 0.5px solid var(--border-content)`, `overflow: auto` — 이것이 스크롤 컨테이너다 | `:494-503` |
| A-3 | 프레임 안 폭 제한 = `maxWidth 1200, margin 0 auto, padding '0 32px'` — 제목바(:379)와 동일 컨테이너 | `:504` |
| A-4 | 카드: `background: var(--block-bg-active)`(#E8DFCE) · `border: 1px solid var(--border-light)`(#E8E4DF — **배경보다 밝아 사실상 안 보인다**) · radius 12 · padding 18/22 · height 320 · `overflow: hidden` · transition box-shadow/transform/background | `:555-567` |
| A-5 | hover = 인라인 `<style>`: 배경 `#E4DBCB !important` + `box-shadow 0 4px 14px rgba(0,0,0,0.08)`. 페이드도 같은 색으로 동조 | `:541-544` |
| A-6 | 하단 페이드 = `linear-gradient(rgba(232,223,206,0) → var(--block-bg-active))` — **시작색이 하드코딩**. 주석이 "토큰이 바뀌면 따라오지 않는다"고 경고(커밋 `78a780f` 사고) | `:640-647` |
| A-7 | 카드 그리드: `repeat(auto-fill, 520px)` · gap 20 · paddingTop 28 · paddingBottom 20vh | `:531-538` |
| A-8 | 색 토큰: 아이보리 `--bg-functional #FEFDFB` · 클레이 `--bg-content #F4EFE7` · `--block-bg #F0EAE0` · `--block-bg-active #E8DFCE` · `--border-content #D2C8B8` · `--border-content-active #B89B78` · `--border-light #E8E4DF` · `--bg-hover #F0EBE3` | `globals.css:53-87` |
| A-9 | **"클레이 영역 상단 중앙의 가로 구분선"의 정체 = 하위 폴더 행의 `borderBottom: 1px solid var(--border-light)`(FolderView:454)** — **Q1 덕수 확정**(카드·리스트 보기 모두 보이고 하위 폴더가 없으면 사라진다, 스크린샷 2장). 이 선은 U자 프레임 **밖** 아이보리 chrome의 `maxWidth 1200 / padding 0 32px` 컨테이너(:379) 안에 있어 폭 = 1136px. ⚠ v1 초안이 ListView 제목행 선(:99-103)으로 잘못 짚었던 것을 정정. 제목행 선은 별개로 D5에서 함께 제거한다 | `FolderView.tsx:449-456, :379` · `ListView.tsx:99-103` |
| A-10 | ListView 루트 `padding: '8px 16px 32px'` — 행은 A-9 선과 같은 1136px 컨테이너(:504) 안이지만 좌우 16px 인셋 때문에 **32px 좁다**. 구상의 "가로폭을 구분선에 맞춘다" = 인셋 0 (**Q2 덕수 확정**) → D6 | `ListView.tsx:97` |
| A-11 | 행: `display:flex · gap 12 · padding '9px 10px' · borderBottom 1px --border-light · cursor pointer`, hover는 **인라인 onMouseEnter/Leave로 `--bg-hover` 토글**(CSS :hover 아님). 세로 두께 ≈ 9+9+내용(배지 포함 약 20) ≈ **38px** | `:121-132` |
| A-12 | 제목행: `padding '6px 10px' · fontSize 11.5 · 600 · --text-muted` + 정렬 버튼 `HeaderCell`. 배경 없음(투명) → sticky로 띄우면 **행이 비쳐 보인다** | `:99-108` |
| A-13 | 스크롤 컨테이너 = A-2의 U자 div. ListView와 그 사이의 조상(:504 컨테이너)에 `overflow` 없음 → 제목행 `position: sticky; top: 0`이 **성립한다**(sticky는 가장 가까운 스크롤 조상 기준) | 구조 실측 |
| A-14 | `.problem-card` 클래스에 Phase 59a Q5 예외(`content: none` 3줄)가 걸려 있다 — 클래스명은 유지해야 한다 | `globals.css` case 절 말미 · CLAUDE.md |
| A-15 | 카드 DnD(dnd-kit `Draggable`)는 `opacity`만 만진다 — 색·테두리 변경과 무관 | `:551-553, 565` |

### B. 우측 패널 · 드로어

| # | 사실 | 위치 |
|---|---|---|
| B-1 | EditorView 댓글·agent 폭 = `panelWidth` 상태(기본 420) + `resizeHover/Dragging`. `PANEL_MIN 360`, max `innerWidth*0.9`, 갭 12. 핸들 `el.setPointerCapture` + el 리스너 | `EditorView.tsx:1002-1004, 2976-3006` |
| B-2 | ProblemView 동일 로직 **사본**: 기본 420, MIN 360, 갭 **24**, `window` 리스너, pointer capture **없음** | `ProblemView.tsx:156-158, 498-519` |
| B-3 | 핸들 JSX 사본 2벌: `absolute; top:0; bottom:0; right: calc(panelWidth + 3px); width 10; zIndex 100; cursor col-resize` + 안쪽 1.5px/0 활성선 `--border-content-active` | `EditorView.tsx:3763-3784` · `ProblemView.tsx:1006-1025` |
| B-4 | 밀어내기: EditorView는 `rightPanelWidth = max(panelWidth, VERSION_DRAWER_WIDTH)`가 Row1·Row2·Row3 `paddingRight`(:3138·:3283·:3479)를 공급. ProblemView는 `panelWidth`가 제목바(:549)·컨텐츠 래퍼(:677) `paddingRight`와 글자크기 컨트롤·토글(:732·:782)의 `right` 산식에 들어간다 | 실측 |
| B-5 | **VersionDrawer 폭 = 상수** `VERSION_DRAWER_WIDTH = 460`(export) · `maxWidth 90vw` · `position absolute; zIndex 110` · 배경 `--bg-panel-agent`. 리사이즈 없음 | `VersionDrawer.tsx:26, 279-285` |
| B-6 | 드로어 zIndex 110 > 핸들 100인 이유 = 스태킹 컨텍스트: 드로어 안 `RestoreConfirm(fixed·1400)`이 바깥을 덮으려면 드로어 자신이 화면 최대 zIndex 위여야 한다(CLAUDE.md 2026-08-18 항목) → **버전 드로어 핸들을 루트에 zIndex>110으로 두면 모달 위에 strip이 뜬다** | `VersionDrawer.tsx:273-278` · CLAUDE.md |
| B-7 | CommentPanel은 `width` prop을 받는 순수 소비자(:59, :118 기본 `'35em'`, :797 `maxWidth 90vw`). 자체 리사이즈는 입력창 **세로** 핸들뿐(:768-790, `row-resize`) — 같은 패턴(hover/dragging 2상태 + 1→2px 선) | `CommentPanel.tsx` |
| B-8 | ProblemView 우측 단: `rightOpen` 상태, **flex 열** `flex:1, minWidth 150, maxWidth 220, padding '32px 16px', overflowY auto, --bg-functional`. 폭 220이 :732·:782에 리터럴로 중복 | `ProblemView.tsx:171, 793-801` |
| B-9 | (참고) 설정 영속 선례: `FONT_SIZE_KEY`(EditorView:189-196), `mathory.viewMode.<folder>`·정렬(FolderView:46, 137-160) — 전부 `localStorage` + try/catch | 실측 |

### C. 좌측 사이드바

| # | 사실 | 위치 |
|---|---|---|
| C-1 | `<aside>` 폭 = `collapsed ? var(--sidebar-collapsed) : var(--sidebar-expanded)` · `flexShrink 0` · `overflow hidden` · **`transition: width var(--transition-normal)`(0.2s)** | `Sidebar.tsx:806-816` |
| C-2 | 토큰 260/56px — 소비처는 C-1 한 곳(grep 전수) | `globals.css:191-192` |
| C-3 | `collapsed` 상태 소유자 = AppShell(:87), `<Sidebar collapsed onToggle …/>`(:636-638). AppShell 루트 = `display:flex; height:100vh; overflow:hidden`, `<main flex:1 position:relative>` | `AppShell.tsx:87, 635-672` |
| C-4 | 폴더명 잘림 = 트리 항목 `paddingLeft: 12 + depth*16` + `textOverflow: ellipsis; whiteSpace: nowrap`(:283, :322) — 구상의 문제 원인 그대로. 폭이 늘면 자동 해소(코드 변경 0) | `Sidebar.tsx:281-322` |
| C-5 | 이 프로젝트에 다크 모드는 없다 — 새 토큰에 다크 정의 금지 | CLAUDE.md |

---

## 4. 결정 (D1~D12 — v1 제안, 교차검토 대상)

### A축 — FolderView

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **U자 프레임 철거**: FolderView:496-501의 `background`·`borderTop/Left/Right` 삭제 → 프레임 div는 배경 없는 스크롤 컨테이너로만 남는다(루트 아이보리가 비친다). `overflow:auto`·`position:relative`·`fontSize`는 유지(스크롤·sticky·DnD 기준) | 구상 · P1 |
| **D2** | **카드 = 클레이 카드**: `background: var(--bg-content)` · `border: 0.5px solid var(--card-border)` · radius 12 유지. **신규 토큰 `--card-border`** = 클레이보다 살짝 짙은 선. v1 제안값 `#DDD3C3`(클레이 #F4EFE7 대비 약 1.25:1 — 장식선이라 3:1 불요, 너무 진하면 카드가 "상자"로 보인다). 후보 대안 = 기존 `--border-content #D2C8B8`(더 뚜렷). Stage 판정(**Q3**) | 구상 · A-4 · P3 |
| **D3** | **hover = `--block-bg-active`(#E8DFCE) + 기존 그림자**: 인라인 `<style>`(:542-543)의 `#E4DBCB` 두 곳을 `var(--block-bg-active)`로. **페이드 시작색을 카드 새 배경의 투명값 `rgba(244,239,231,0)`로, hover 페이드는 `rgba(232,223,206,0)`로** 교체(A-6의 하드코딩 함정 — 두 곳 다 바꿔야 회색 끼임이 없다). 이렇게 두면 화면의 최악(가장 어두운) 배경이 지금과 같은 #E8DFCE라 **Phase 58·59·59a 명암비 표가 그대로 유효** | P2 · A-5·A-6 |
| **D4** | **리스트 행 = 가로로 긴 클레이 카드**: `background var(--bg-content)` · `border 0.5px solid var(--card-border)` · `borderRadius 8` · `borderBottom` 삭제 · 행 간격 `marginBottom 4px`(아이보리 바닥이 보이는 최소치 — 카드뷰 gap 20보다 훨씬 좁게, 구상) · padding `9px 14px`(세로 두께 현행 유지, 좌우는 라운드 때문에 +4) · hover = `.folder-row:hover { background: var(--block-bg-active); box-shadow: 0 2px 8px rgba(0,0,0,0.06) }`로 **CSS화**(현행 onMouseEnter 인라인 토글(:130-131)은 삭제 — hover 배경을 카드와 같은 문법으로). 그림자는 카드(4px 14px)보다 작게 — 간격 4px에 맞춤 | 구상 · A-11 |
| **D5** | **제목행 sticky + 톤 + 선 제거**: `position: sticky; top: 0; zIndex: 2; background: var(--bg-hover)`(#F0EBE3 — 아이보리보다 한 톤, 클레이보다 밝음 = "살짝만") · 제목행 `borderBottom`(ListView:102) 삭제 · **하위 폴더 행 `borderBottom`(FolderView:454) 삭제 — 구상이 지목한 선(A-9, Q1 확정)** · 좌우 padding을 행과 같은 14로. 배경이 있어야 스크롤된 행이 비치지 않는다(A-12). sticky는 A-13으로 성립 | 구상 · A-9·A-12·A-13 |
| **D6** | **ListView 좌우 인셋 16 → 0**(`padding: '8px 0 32px'`): 행이 제목바 컨테이너(1136px)와 좌우 정렬된다. 하위 폴더 칩 행·제목과 세로 기준선이 맞고, 행 폭 = A-9 선의 폭(1136px). **Q2 덕수 확정** | A-10 |

### B축 — 리사이즈 통일

| # | 결정 | 근거 |
|---|---|---|
| **D7** | **`useDrawerResize({ defaultWidth, min, max, side, gap })` 훅 신설**: 반환 `{ width, dragging, hover, handleProps }`. 내부 = EditorView:2979-3002 로직(pointer capture 방식 채택 — ProblemView의 window 리스너보다 오버레이·iframe 위에서 안전, B-1). `side:'right'`면 `next = innerWidth - clientX - gap`, `'left'`면 `next = clientX - gap`(사이드바용). max는 함수 허용(`() => innerWidth*0.9`). **영속 없음 — 폭은 컴포넌트 상태로만 유지되어 새로고침·재접속 시 기본값으로 돌아간다(Q4 덕수 확정: "매번 기본값"). localStorage 키·읽기·쓰기 코드를 넣지 말 것**. 드래그 중 `document.body` cursor/userSelect 처리·복원은 훅이 소유 | B-1·B-2 · 구상 |
| **D8** | **`<DrawerResizeHandle side offset active {...handleProps} />` 컴포넌트 신설**: B-3 JSX의 단일 사본. `offset`은 패널 변까지의 px(`right: calc(offset + 3px)` 또는 `left:`). zIndex 100 기본, prop으로 조정. `data-resize-handle` 속성으로 dnd-kit 등이 무시하도록(현행 `stopPropagation` 유지) | B-3 |
| **D9** | **폭 수치는 패널별 개별, 문법만 공유**(P4): 댓글·agent 360~90vw/기본 420(현행) · 버전 드로어 **360~90vw/기본 460**(`VERSION_DRAWER_WIDTH`는 기본값으로 강등, export 유지) · ProblemView 우측 단 **150~360/기본 220** · 좌측 사이드바 **200~480/기본 260** | P4·P5 |
| **D10** | **버전 드로어 핸들은 드로어 안쪽 좌변에 마운트**(B-6): `VersionDrawer`에 `width`·`resizeHandle?: ReactNode`(또는 `onResize` 훅 결과) prop을 추가하고 드로어 루트(`position:absolute`) 안에 `left:-5px`로 핸들을 둔다 → 드로어의 스태킹 컨텍스트(110) **안**에 있으므로 `RestoreConfirm(1400)`이 핸들 위를 덮는다. 댓글·agent 핸들은 현행대로 루트 형제(zIndex 100)에 둔다 — 두 위치가 다른 것은 **스태킹 제약**이지 문법 차이가 아니다(주석으로 명기). 대안(RestoreConfirm을 portal로 빼고 드로어 zIndex를 내림)은 범위 밖 — **Q5** | B-5·B-6 |
| **D11** | **EditorView `rightPanelWidth`는 `max(panelWidth, versionWidth)`로 유지**(B-4) — 상수를 상태로 바꾸는 것뿐. 둘 다 열렸을 때 각자 핸들이 보이면 혼란 → **앞에 있는(넓은) 패널의 핸들만 렌더** | B-4 |
| **D12** | **좌측 사이드바**: 폭 상태를 AppShell로(`useDrawerResize({ side:'left', gap:0, min 200, max 480, default 260 })`), `<Sidebar width={…}>`로 전달. Sidebar `<aside>`는 `width: collapsed ? 56 : width`, **`transition: dragging ? 'none' : 'width …'`**(P5). 핸들은 `<aside>` 안 우변(`position:relative` 부여 후 `right:-5px`)에 마운트 — main 위로 5px 걸치는 것은 핸들이 `zIndex 100`이라 문제없음. **접힘 상태에서는 핸들 미렌더**(56px 고정). 토큰 `--sidebar-expanded`는 기본값 주석으로만 남기거나 삭제(소비처 C-2 한 곳) | C-1~C-4 · 구상 |

---

## 5. 구현 항목

### 5.1 A축 파일 변경

```
components/problem/FolderView.tsx
  :454       하위 폴더 행 borderBottom 삭제 (D5 — 구상이 지목한 가로 구분선, Q1 확정)
  :496-501   background·border 3줄 삭제 (D1). 주석 "Phase 45a — 3곳 동일" → "Phase 62 — FolderView는 프레임 없음(의도)"
  :541-544   hover 색 → var(--block-bg-active), 페이드 시작 rgba → 232,223,206 (D3)
  :557-558   background → var(--bg-content) · border → 0.5px solid var(--card-border) (D2)
  :645       페이드 시작 rgba(244,239,231,0) → var(--bg-content) (D3)
components/problem/ListView.tsx
  :97        padding '8px 0 32px' (D6)
  :99-103    sticky · background --bg-hover · borderBottom 삭제 · padding '6px 14px' (D5)
  :121-132   행 스타일 치환 + className="folder-row" + onMouseEnter/Leave 삭제 (D4)
  (인라인 <style> 또는 globals.css) .folder-row:hover 규칙 (D4) — globals.css에 두는 쪽이 FolderView 카드 <style>과 달리 한 곳: Q6
app/globals.css
  :root      --card-border 신설 (D2). 다크 정의 금지(C-5)
```

### 5.2 B축 파일 변경

```
hooks/useDrawerResize.ts              신설 (D7)
components/ui/DrawerResizeHandle.tsx  신설 (D8)
components/editor/EditorView.tsx
  :1002-1004  panelWidth·hover·dragging 3상태 → useDrawerResize 2개(comment · version)
  :1028-1031  rightPanelWidth = max(panelWidth, versionWidth) (D11)
  :2976-3006  handleResizeStart 등 삭제 (훅으로)
  :3114-3120  <VersionDrawer width={versionWidth} resizeHandle={…}> (D10)
  :3763-3784  → <DrawerResizeHandle …> (넓은 패널 것만, D11)
components/version/VersionDrawer.tsx
  :26         VERSION_DRAWER_WIDTH = 기본값으로 의미 변경(주석) · width prop 추가
  :279-285    width: props.width · 루트 안에 핸들 슬롯 (D10)
components/problem/ProblemView.tsx
  :156-158, :498-519  → useDrawerResize(comment, gap 24) · (rightColumn, 150~360)
  :732·:782   `rightOpen ? 220 : 0` → `rightOpen ? rightWidth : 0`
  :793-801    flex:1/minWidth/maxWidth → width: rightWidth, flexShrink 0 + 좌변 핸들 (D9)
  :1006-1025  → <DrawerResizeHandle …>
components/layout/AppShell.tsx  :87 근처 사이드바 폭 훅 · :636 <Sidebar width dragging …> (D12)
components/layout/Sidebar.tsx   :806-816 width·transition 치환 + 핸들 마운트 (D12)
app/globals.css :191-192        --sidebar-expanded 처리 (D12)
```

### 5.3 훅 시그니처 (초안)

```ts
export function useDrawerResize(opts: {
  // (영속 없음 — Q4 확정. localStorage 키 파라미터를 두지 않는다)
  defaultWidth: number;
  min: number;
  max: number | (() => number);
  side: 'left' | 'right';             // 패널이 화면 어느 쪽에 붙어 있는가
  gap?: number;                       // 핸들 기준선과 패널 변 사이 px (현행 12·24 흡수)
}): {
  width: number;
  dragging: boolean;
  hover: boolean;
  handleProps: { onPointerDown; onPointerEnter; onPointerLeave };
  setWidth: (w: number) => void;
}
```

---

## 6. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | **전제 실측**(코드 변경 0): ① sticky 성립 여부(A-13) 브라우저 확인 ② 두 리사이즈 사본의 차이(B-1·B-2)가 의도된 것인지 커밋 로그 확인 | 실측 메모 |
| 1 | **B축 훅·핸들 추출 — 동작 불변 리팩터링 먼저**: 댓글·agent 2곳을 훅으로 치환. 폭 수치·갭 그대로 | 드래그 결과가 리팩터링 전과 픽셀 단위로 동일(T5) |
| 2 | 버전 드로어(D10·D11) · ProblemView 우측 단(D9) · 좌측 사이드바(D12) | T6~T9 |
| 3 | **A축**: D1→D2→D3 카드 → D4~D6 리스트. 토큰 `--card-border` 후보 2값 실물 비교(Q3) | T1~T4 · 덕수 육안 판정 |
| 4 | 마무리: CLAUDE.md 규칙 개정(§7) · roadmap Phase 62 절 · 페이드 하드코딩 주석 갱신 | §8 체크리스트 통과 |

**B축을 먼저 두는 이유**: 리팩터링(스텝 1)은 동작 불변이라 회귀 판정이 명확하고, A축의 육안 판정(색·톤)과 섞이면 어느 쪽 변화인지 구분이 흐려진다.

---

## 7. 하지 말 것 / 주의 (규칙 개정 포함)

- **CLAUDE.md "U자 프레임 3곳 공유" 규칙을 반드시 개정할 것**(P1) — 개정문 초안: *"U자 프레임(상·좌·우 0.5px, 상단 직각)은 **문항 단위 화면 2곳**(EditorView·ProblemView)이 공유한다. FolderView는 Phase 62부터 **의도적으로 프레임이 없다** — 클레이 = '문항 하나를 보는 중', 아이보리 = '문항 밖'. FolderView에 프레임을 되살리지 말 것. 카드·리스트 행이 클레이를 담당한다."*
- **명암비 구속 조건 항목도 개정**: "가장 어두운 카드 배경 `#E8DFCE`"는 이제 **hover 배경**이다 — 정적 카드는 `#F4EFE7`. 값은 같으니 표는 유효하지만 문장을 고쳐야 다음 사람이 헷갈리지 않는다.
- 페이드 시작색 하드코딩(A-6) — **카드 기본·hover 두 곳**을 함께 바꿀 것. 한 곳만 바꾸면 `78a780f` 사고 재현.
- 둥근 모서리 네 변 색 통일(CLAUDE.md Phase 45a) — 카드·행 테두리는 네 변 같은 색으로만.
- `.problem-card` 클래스명 유지(A-14). 리스트 행에는 `problem-card`를 붙이지 말 것(Q5 예외가 딸려온다) — 별도 `folder-row`.
- 사이드바 드래그 중 transition 제거(P5) — 빠뜨리면 핸들이 커서에 뒤처진다.
- 버전 드로어 핸들을 루트 zIndex>110으로 두지 말 것(B-6).
- `[data-noscroll]` 컨테이너 세로 스크롤 금지·`scrollIntoView` 금지·다크 토큰 금지 — 전부 현행 규칙 유지.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 8. 검증 체크리스트 (스텝 4)

T1 FolderView 카드 보기: 바탕 아이보리 · 카드 클레이 + 0.5px 선 · hover 시 #E8DFCE + 그림자 · 페이드에 회색 끼임 0 ·
T2 리스트 보기: 행 카드화 · 행 사이 아이보리 노출 · hover 그림자가 간격 안에서 보임 · 제목행 sticky(스크롤 후 고정, 행이 비치지 않음) · 구분선 0(제목행 선 + 하위 폴더 행 선, 카드 보기에서도) ·
T3 FolderView ↔ ProblemView/EditorView 전환 시 EditorView·ProblemView 프레임은 **변화 0**(3곳 규칙 개정이 나머지 2곳을 건드리지 않았음) ·
T4 Phase 59a Q5 예외(카드 안 경우 블록 rail·dot 미표시) 유지 ·
T5 댓글·agent 리사이즈: 리팩터링 전후 동일(최소 360·최대 90vw·갭·활성선) — EditorView·ProblemView 둘 다 ·
T6 버전 드로어 리사이즈 + 열린 상태에서 RestoreConfirm이 핸들 위를 덮음 · 댓글과 동시 열림 시 넓은 쪽 핸들만 ·
T7 ProblemView 우측 단 150~360 조절 · 글자크기 컨트롤·토글이 폭을 따라감(:732·:782) ·
T8 좌측 사이드바 200~480 조절 · 드래그 중 지연 0 · 접힘/펼침 애니메이션 유지 · 긴 폴더명·깊은 위계가 폭 확대로 드러남 ·
T9 새로고침 후 모든 패널 폭이 기본값(420 · 460 · 220 · 260)으로 복귀 ·
T10 dnd-kit 카드 드래그·폴더 드롭이 핸들·카드 스타일 변경 후에도 정상.

## 9. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · 인쇄 · 공개 뷰어(`PublicViewerShell`·`BazaarView`) · EditorView·ProblemView의 **U자 프레임 자체** · CommentPanel 내부 · 블록 렌더 5사이트. **전부 0건.**
신규 파일 2개(`hooks/useDrawerResize.ts` · `components/ui/DrawerResizeHandle.tsx`) + 토큰 1개 + 수정 7파일(FolderView · ListView · EditorView · ProblemView · VersionDrawer · AppShell · Sidebar) + globals.css + CLAUDE.md·roadmap.

---

## 10. 검증·확인 요청 (v2에서 답할 것)

| # | 대상 | 요청 |
|---|---|---|
| ~~Q1~~ | 덕수 | **답변 완료**: 선 = 하위 폴더 행의 선(FolderView:454) → A-9 정정, D5에 삭제 반영 |
| ~~Q2~~ | 덕수 | **답변 완료**: 인셋 0 (D6 확정) |
| ~~Q3~~ | 덕수 | **답변 완료**: `#DDD3C3` (D2 확정). CLI는 실물에서 선이 보이는지만 확인 |
| ~~Q4~~ | 덕수 | **답변 완료**: 영속 없음 — 매번 기본값으로 복귀 (D7 확정, localStorage 미사용) |
| Q5 | CLI | D10 대안 검토: `RestoreConfirm`을 `createPortal(document.body)`로 빼면 드로어 zIndex 110 제약이 풀려 핸들을 다른 패널과 똑같이 루트에 둘 수 있다. 파급(포커스 트랩·ESC 처리)이 작으면 이번에 함께, 크면 후속 |
| Q6 | CLI | `.folder-row:hover` 규칙 위치 — globals.css(한 곳) vs FolderView 인라인 `<style>`(카드 hover와 나란히). 카드 hover도 globals로 옮겨 한 곳으로 모을지 |
| Q7 | CLI | ProblemView에서 우측 단(flex 열)과 댓글 패널(absolute)이 **동시에** 열릴 때의 겹침 실측 — :732의 산식은 둘이 나란히 있다고 가정하는데, 컨텐츠 행(:672)에 paddingRight가 없어 패널이 열을 덮는 것으로 읽힌다. 실제 동작을 확인하고 폭 조절이 이 상태를 악화시키지 않는지 |
| Q8 | CLI | 사이드바 폭 확대 시 EditorView 좌열 `minWidth 420`(:3494-3495) + 우측 패널 max 90vw의 합이 화면을 넘는 조합(좁은 창)에서 가로 스크롤/찌그러짐 발생 여부. 필요하면 사이드바 max를 `innerWidth`에 비례로 |
| Q9 | CLI | 리스트 제목행 sticky가 dnd-kit `Droppable`·카드 메뉴 ContextMenu의 zIndex와 충돌하지 않는지 |

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| **v1** | **web** | 초안 — 타당성 판정 P1~P5(§1) · 사실표 A·B·C · D1~D12 제안 · 검증 요청 Q1~Q9 |
| v1 보정 | web + 덕수 | Q1~Q4 답변 반영(A-9 정정 · D2·D5·D6·D7 확정). **덕수 확인 항목 0 — CLI 교차검토(v2)로 넘긴다** |
| v2 | CLI | 실측 교차검토 (예정) |
| v3 | web | 재검증·판정 (예정) |

*v1 — 교차검토 대기. 인용은 전부 origin/main `431c6f6` 기준. 사실 분쟁 시 "각자 무엇을 읽었는가"부터 대조할 것.*
