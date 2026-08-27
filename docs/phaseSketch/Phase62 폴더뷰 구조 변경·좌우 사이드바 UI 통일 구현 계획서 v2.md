# Phase 62 구현 계획서 — 폴더뷰 구조 변경 · 좌우 사이드바 UI 통일 (v2, CLI 교차검토판)

> 계보: v1(web, 2026-08-26) → **v2(CLI 실측 교차검토 + 결정 확정, 2026-08-27)** → v3(web 재검증) 예정
> 진실 원천: mathory **origin/main `431c6f6`**. 이 문서의 모든 라인 인용은 그 커밋을 직접 읽어 확인했다.
> 원 구상: `docs/phaseSketch/Phase62 구상.md` (덕수, 2026-08-26)
> 범위: **A축** FolderView 바탕·카드·리스트 개편 / **B축** 좌·우 사이드바·드로어 폭 조절 통일
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

FolderView에서 U자 클레이 프레임을 걷어내 바탕을 아이보리로 두고, 카드·리스트 행을 **클레이 카드**로 뒤집어
"문항 하나를 보는 중(클레이)" ↔ "문항 밖으로 나옴(아이보리)"을 색으로 구분한다. 동시에 EditorView·ProblemView에
**두 벌로 복제된** 우측 패널 리사이즈 코드를 훅 1 + 핸들 컴포넌트 1로 뽑아, 좌측 사이드바·버전 드로어·ProblemView
우측 단까지 같은 문법으로 폭을 조절하게 한다. **서버 0 · Firestore 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI.

---

## 1. v1에서 뒤집힌 것 (실측 정정)

v1의 라인 인용은 A-1~A-15 · B-1~B-9 · C-1~C-5 전부 정확했다. 그러나 **구현 불가 2건 · 사실 오류 3건**이 나왔다.
아래는 v2에서 바뀐 결론만 적는다. 원인 분석은 §3 사실표에 사실로 편입했다.

| # | v1의 서술 | 실측 결과 | v2 처리 |
|---|---|---|---|
| **E1** | D12: 사이드바 핸들을 `<aside>`에 `position:relative` 부여 후 `right:-5px`로 마운트 | **불가.** `<aside>`에 `overflow: hidden`(Sidebar.tsx:815)이 걸려 있어 튀어나온 핸들이 통째로 잘린다. 게다가 `position:relative`를 주면 내부 트리 항목의 `absolute`(:265) 기준까지 바뀐다 | **AppShell 루트**(`display:flex` div, :635)에 `position:relative`를 부여하고 aside·main의 **형제**로 마운트 → D18′ |
| **E1′** | (v1에 없음) D9: ProblemView 우측 단 좌변에 핸들 | **불가.** 우측 단은 `overflowY:'auto'`(:796)다. CSS는 한 축이 `visible`이 아니면 다른 축도 `auto`로 계산하므로 **가로로도 잘린다**(E1과 같은 함정) | **ProblemView 루트**(`position:relative`, :539-544)에 마운트 → D17′ |
| **E2** | D9: 우측 단 150~360 리사이즈 | **새 버그를 만든다.** 핸들 zIndex 100 > CommentPanel zIndex 50(:802). 패널 최소 폭 360 > 단 최대 220이라 패널이 열리면 단은 완전히 가려지는데 **핸들만 살아남아 패널 한복판에 세로선이 그어진다** | 패널이 열리면 우측 단·핸들을 **렌더하지 않는다** → D16′ |
| **E3** | Q7: "패널과 우측 단이 겹치는지 확인" | **지금도 겹친다.** 패널·핸들은 컨텐츠 행 **밖**, 루트 기준 absolute(:1000 이후). 우측 단은 flex 형제(:793). 본문은 `paddingRight(panelWidth+8)`(:677)와 우측 단 220에 **이중으로** 밀려 본문 우단과 패널 좌단 사이에 **228px 死공간**이 생긴다. 단을 360까지 키우면 368px | D16′가 함께 해소(패널 열림 시 단 미렌더 → 死공간 0) |
| **E4** | D2: `--card-border: #DDD3C3` (약 1.25:1) | **재계산 1.29:1**, hover(`#E8DFCE`) 위에서는 **1.12:1**로 소멸. 그런데 globals.css:80 주석이 *"`#DCD3C2`(1.24:1)는 너무 흐려 식별이 안 됐다(덕수)"* 로 같은 대역을 이미 기각했다 | **신규 토큰을 만들지 않고 `--border-content #D2C8B8` 재사용**(1.45 / hover 1.25) → D2′ |
| **E5** | D7: `gap`(12·24)을 훅 파라미터로 흡수 | **12·24 둘 다 실제 경계선 위치(`panelWidth+8`)와 어긋난 값이다.** 드래그 시작 순간 패널이 각각 4px·16px 튄다. 파라미터화하면 버그를 훅에 이식한다 | `gap` 폐지. **pointerdown 시 커서↔패널변 offset을 캡처**해 유지 → D11′ |
| **E6** | A-9: 클레이 상단 가로선 = 하위폴더 행 선 | 후보가 **둘**이다: ① 하위폴더 행 `borderBottom`(FolderView:454, 1136px, 카드·리스트 공통) ② ListView 제목행 `borderBottom`(:102, 좌우 인셋 16 때문에 **1104px**, 리스트 전용). 폭 기준선은 ① | 사실표를 A-9 / A-9′ 두 줄로 분리. D5′가 **둘 다** 제거하므로 결론은 동일 |
| **E7** | Q9: sticky ↔ dnd-kit·ContextMenu 충돌? | **충돌 없음.** ListView에 dnd-kit은 **0건**(Draggable/Droppable은 카드 보기 전용). ContextMenu는 `position:fixed; zIndex:1000`(ContextMenu.tsx:71-74)이라 sticky(z 2)를 이긴다 | Q 해소 |
| **E8** | Q8: 사이드바 확장 시 가로 스크롤? | **페이지는 안 깨진다.** `content-frame`이 `overflowX:auto` 스크롤 컨테이너라 flex `min-width:auto`가 0으로 풀린다. 다만 편집창 최소 폭 = 좌 420 + 미리보기 `38.5em+32`(:3602) + 24 ≈ **1054px**(15px 기준)이라 사이드바 480 + 1440 창이면 main 960 → content-frame 가로 스크롤(현재도 1280 창에서 발생) | 사이드바 max를 창 비례로 묶는다 → D13′ |
| **E9** | — | stale 주석 4건: EditorView:1031 "드로어가 zIndex 60"(실제 110) · :3765 "200ms dwell 후 활성"(dwell 없음) · FolderView:493 "상단 14px 라운드"(직각) · `--sidebar-collapsed`도 소비처가 한 곳뿐 | §5에서 함께 정리 |
| **E10** | §9 영향 범위 | FolderView는 **공유 스코프 화면**(받은/보낸 문항, AppShell:720~)에도 재사용된다. A축 변경이 그 화면에도 적용된다 | §9에 명시(의도된 파급) |

---

## 2. 적합성 판정 — 기존 정책과 정면으로 만나는 지점

**불가능 판정 0건.** 아래 5건은 규칙 자체를 개정하거나 구상을 조정해야 한다.

| # | 구상 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | FolderView U자 프레임 제거 | CLAUDE.md **"U자 프레임은 3곳 공유 — 한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 셋을 항상 함께"**(Phase 45a). FolderView:494-503 · EditorView:3484-3489 · ProblemView:681-689이 동일 스타일 | **의도적 위반 → 규칙을 개정한다.** 그 규칙이 막으려던 "점멸"이 곧 이번 구상이 원하는 **상황 변화 신호**다. 규칙을 "U자 프레임은 **문항 단위 화면 2곳**이 공유하고 FolderView는 **의도적으로 프레임이 없다**"로 고쳐 쓴다(§9). 안 고치면 다음 Phase에서 누군가 "3곳 동일"을 복원한다 |
| **P2** | 카드 색을 클레이로 낮춤 | CLAUDE.md **"명암비 구속 조건은 가장 어두운 카드 배경 `#E8DFCE`"** — Phase 58·59·59a의 dot·dim·코칭 색이 전부 이 값 기준 | **밝아지는 방향이라 대비는 전부 개선.** 단 **hover를 `#E8DFCE`보다 어둡게 가면 구속 조건이 깨진다.** hover = `--block-bg-active`(#E8DFCE)로 **고정**해 화면 최악 배경을 지금과 동일하게 유지한다(D3′). 현행 hover `#E4DBCB`(:542)는 #E8DFCE보다 어두워 dot 여유 0.28을 이미 갉아먹고 있었다 → 이번에 정리 |
| **P3** | 카드·행 hover 그림자 | CLAUDE.md E형 **"선은 전부 0.5px이고 그림자는 쓰지 않는다"** | **충돌 없음** — 그 규칙은 명시적으로 "편집창 블록" 한정이고 "열람·공유·인쇄에는 적용하지 않는다"고 못 박혀 있다. FolderView 카드는 이미 hover 그림자를 쓴다(:542). 단 **테두리 두께는 E형과 같은 0.5px**로 맞춘다(현행 1px, :558) |
| **P4** | ProblemView 우측 단에 "동일한 기준(폭 너비, 크기 조절)" | 우측 드로어 3종 규약(2026-08-18)은 **absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`**. 우측 단은 **flex 열**(:793-801)이고 폭 220이 :732·:782에 리터럴로 박혀 있다 | **문자 그대로 적용하면 안 된다.** 메뉴 열에 360 최소폭은 무의미하고, absolute로 바꾸면 글자크기 컨트롤·토글의 좌표 연쇄가 깨진다. 통일할 것은 **조작 문법**(훅·핸들·커서·활성선)이고 **폭 수치는 패널마다 별도**다(D9′). 우측 단은 flex 열을 유지한 채 `width` 소스만 상태로 바꾼다 |
| **P5** | 좌측 사이드바 폭 조절 | `--sidebar-expanded: 260px`(globals.css:191) + `transition: width var(--transition-normal)`(Sidebar.tsx:814). 접힘 애니메이션이 이 transition에 의존 | **드래그 중에는 transition을 꺼야 한다** — 켠 채로 끌면 0.2s씩 지연돼 핸들이 커서를 못 따라온다. 토큰 소비처는 Sidebar.tsx:809 한 곳뿐이므로 **토큰 2개를 삭제하고 상수 export**로 옮긴다(파급 0) |

---

## 3. 확정 사실 (실측, 전부 `431c6f6`)

### A. FolderView · ListView

| # | 사실 | 위치 |
|---|---|---|
| A-1 | FolderView 루트 배경 = `--bg-functional`(아이보리). 제목바(minHeight 98)·하위 폴더 행은 이미 아이보리 chrome | `FolderView.tsx:376-378` |
| A-2 | **U자 프레임** = `background: var(--bg-content)` + `borderTop/Left/Right: 0.5px solid var(--border-content)` + `overflow:auto` + `position:relative` + `fontSize: contentFontSize` — **이것이 스크롤 컨테이너다** | `:494-503` (배경 `:496` · 3면 경계 `:499-501` · 섹션 주석 `:493` · Phase 45a 주석 `:502`) |
| A-3 | 프레임 안 폭 제한 = `maxWidth 1200, margin 0 auto, padding '0 32px'` → 내용 폭 **1136px**. 제목바(:379)와 동일 컨테이너 | `:504` · `:379` |
| A-4 | 카드: `background: var(--block-bg-active)`(#E8DFCE, `:557`) · `border: 1px solid var(--border-light)`(#E8E4DF, `:558`) · radius 12 · padding 18/22 · height 320 · `overflow:hidden` · transition box-shadow/transform/background. **테두리는 배경보다 밝아(1.05:1) 사실상 안 보인다** | `:555-568` |
| A-5 | hover = 카드 그리드 안 인라인 `<style>`: `background:#E4DBCB !important` + `box-shadow 0 4px 14px rgba(0,0,0,0.08) !important`, 페이드도 같은 색으로 동조. **`!important`가 필요한 이유는 카드 배경이 인라인 style이기 때문**(인라인은 `!important` 없는 모든 시트 규칙을 이긴다) | `:540-544` |
| A-6 | 하단 페이드 = `linear-gradient(180deg, rgba(232,223,206,0) 0%, var(--block-bg-active) 100%)` — **시작색이 하드코딩**. 주석이 "토큰이 바뀌면 따라오지 않는다"고 경고(커밋 `78a780f` 사고) | `:640-647` (배경 `:645`) |
| A-7 | 카드 그리드: `repeat(auto-fill, 520px)` · `justifyContent:center` · gap 20 · paddingTop 28 · paddingBottom 20vh | `:531-538` |
| A-8 | 색 토큰: 아이보리 `--bg-functional #FEFDFB` · 클레이 `--bg-content #F4EFE7` · `--block-bg #F0EAE0` · `--block-bg-active #E8DFCE` · `--border-content #D2C8B8` · `--border-content-active #B89B78` · `--border-light #E8E4DF` · `--bg-hover #F0EBE3` · `--block-hairline #C2B7A2` | `globals.css:48-92` |
| **A-9** | **"클레이 상단 중앙 가로 구분선" 1번 후보 = 하위 폴더 행 `borderBottom: 1px solid var(--border-light)`.** 제목바 컨테이너(1136px) 안이라 **폭 1136**. 카드·리스트 보기 공통이고 **하위 폴더가 없으면 사라진다.** 제목바 minHeight 98(행1 57 + 행2 41) 때문에 이 선의 Y가 U자 프레임 borderTop과 겹친다 | `FolderView.tsx:449-456` |
| **A-9′** | **2번 후보 = ListView 제목행 `borderBottom: 1px solid var(--border-light)`.** ListView 루트 좌우 인셋 16 때문에 **폭 1104**, 리스트 보기 전용 | `ListView.tsx:102` |
| A-10 | ListView 루트 `padding: '8px 16px 32px'` → A-9 선(1136)보다 좌우 **각 16px 좁다**(합 32) | `ListView.tsx:97` |
| A-11 | 행: `display:flex · gap 12 · padding '9px 10px' · borderBottom 1px --border-light · cursor pointer`, hover는 **인라인 `onMouseEnter/Leave`로 `--bg-hover` 토글**(CSS `:hover` 아님) | `:122-132` (padding `:126` · borderBottom `:127` · hover 핸들러 `:130-131`) |
| A-12 | 제목행: `padding '6px 10px' · fontSize 11.5 · 600 · --text-muted` + 정렬 버튼 `HeaderCell`. **배경이 없다(투명)** → sticky로 띄우면 행이 비쳐 보인다 | `:99-109` |
| A-13 | 스크롤 컨테이너 = A-2의 U자 div. 그 사이 조상(:504)에 `overflow`가 없다 → 제목행 `position:sticky; top:0`이 **성립한다**(sticky는 가장 가까운 스크롤 조상 기준) | 구조 실측 |
| A-14 | ListView에 **dnd-kit이 없다**(Draggable/Droppable 0건). 행 메뉴는 `ContextMenu`(`position:fixed; zIndex:1000`)로 ListView 루트 직속 렌더 | `ListView.tsx:193-221` · `ui/ContextMenu.tsx:71-74` |
| A-15 | `.problem-card` 클래스에 Phase 59a Q5 예외(`content: none` 3줄)가 걸려 있다 → **클래스명 유지 필수**. 리스트 행에 이 클래스를 붙이면 그 예외가 딸려온다 | `globals.css:744-746` |
| A-16 | 카드 DnD(dnd-kit `Draggable`)는 `opacity`만 만진다. DragOverlay는 별도 알약 UI(:686-699) → 색·테두리 변경과 무관 | `:551-553, 566` |

### B. 우측 패널 · 드로어

| # | 사실 | 위치 |
|---|---|---|
| B-1 | EditorView 댓글·agent 폭 = `panelWidth` 상태(기본 420) + `resizeHover`/`resizeDragging`. `PANEL_MIN 360`, max `innerWidth*0.9`, onMove 보정 **-12**. 핸들은 `el.setPointerCapture` + el 리스너 | `EditorView.tsx:1002-1004, 2977-3006` |
| B-2 | ProblemView 동일 로직 **사본**: 기본 420, MIN 360, 보정 **-24**, `window` 리스너, pointer capture **없음** | `ProblemView.tsx:156-158, 496-519` |
| **B-3** | **두 보정값 모두 실제 경계선 위치와 어긋난다.** 콘텐츠 우단 = `panelWidth + 8`(paddingRight)인데 onMove는 `innerWidth - clientX - 12`(-24) → 드래그 시작 시 **4px·16px 점프** | `EditorView.tsx:2988` · `ProblemView.tsx:504` · `:3479` · `:677` |
| B-4 | 핸들 JSX 사본 2벌: `absolute; top:0; bottom:0; right: calc(panelWidth + 3px); width:10; zIndex:100; cursor:col-resize` + 가운데 1.5px/0 활성선 `--border-content-active`, `transition: width 0.1s` | `EditorView.tsx:3763-3784` · `ProblemView.tsx:1006-1025` |
| B-5 | 밀어내기: EditorView는 `rightPanelWidth = max(panelWidth, VERSION_DRAWER_WIDTH)`가 Row1·Row2·Row3 `paddingRight`(:3138·:3283·:3479)를 공급. ProblemView는 `panelWidth`가 제목바(:549)·컨텐츠 래퍼(:677)와 글자크기·토글(:732·:782)의 `right` 연쇄에 들어간다 | 실측 |
| B-6 | **VersionDrawer 폭은 상수** `VERSION_DRAWER_WIDTH = 460`(export) · `maxWidth 90vw` · `position:absolute; zIndex 110` · 배경 `--bg-panel-agent`. 리사이즈 없음. **루트에 `overflow` 지정이 없다** → 안쪽에 튀어나온 자식을 둘 수 있다 | `VersionDrawer.tsx:26, 272-285` |
| B-7 | 드로어 zIndex 110 > 핸들 100 > CommentPanel 50인 이유 = 스태킹 컨텍스트. 드로어 안 `RestoreConfirm(fixed·1400)`이 바깥을 덮으려면 드로어 자신이 화면 최대여야 한다 → **드로어 핸들을 루트에 zIndex>110으로 두면 모달 위에 strip이 뜬다** | `VersionDrawer.tsx:273-278, 421` · CLAUDE.md |
| B-8 | CommentPanel 루트 = `absolute; top/right/bottom:0; width: props.width; maxWidth:90vw; zIndex:50`. `width` 기본 `'35em'`. 자체 리사이즈는 입력창 **세로** 핸들뿐(row-resize) | `CommentPanel.tsx:59, 118, 796-802` |
| **B-9** | ProblemView 우측 단 = **flex 열** `flex:1, minWidth:150, maxWidth:220, padding '32px 16px', overflowY:'auto', position:'relative', --bg-functional`. **`overflowY:auto` 때문에 가로도 잘린다.** 폭 220이 :732·:782에 리터럴 중복 | `ProblemView.tsx:793-801` |
| **B-10** | 패널·핸들은 컨텐츠 행 **밖**, ProblemView 루트 기준 absolute. 패널(≥360)이 우측 단(≤220)을 **완전히 덮고**, 본문은 paddingRight와 우측 단에 이중으로 밀려 **228px 死공간**이 생긴다 | `:539-544, 987-1025` |
| B-11 | (참고) 폭 영속은 어디에도 없다. `localStorage`는 `FONT_SIZE_KEY`(EditorView:189-196), `mathory.viewMode.<folder>`·정렬(FolderView:46, 137-160)만 | 실측 |

### C. 좌측 사이드바

| # | 사실 | 위치 |
|---|---|---|
| C-1 | `<aside>` = `width: collapsed ? var(--sidebar-collapsed) : var(--sidebar-expanded)` · `flexShrink:0` · **`overflow: hidden`** · `transition: width var(--transition-normal)`(0.2s) | `Sidebar.tsx:807-817` (width `:809` · transition `:814` · overflow `:815`) |
| C-2 | 토큰 260/56의 소비처는 C-1 **한 곳뿐**(grep 전수) | `globals.css:191-192` |
| C-3 | `collapsed` 소유자 = AppShell(:87), `<Sidebar collapsed onToggle …/>`(:636). AppShell 루트 = `display:flex; height:100vh; overflow:hidden` (**position 미지정**), `<main flex:1 position:relative>` | `AppShell.tsx:87, 635, 671-683` |
| C-4 | Sidebar 안 절대배치는 트리 항목 드롭 인디케이터(`absolute`, :265) 하나뿐. 컨텍스트 메뉴·툴팁은 전부 `position:fixed`(:115, :444, :506) → **aside에 `position:relative`를 주면 :265의 기준만 바뀐다**(그래서 안 준다) | `Sidebar.tsx` |
| C-5 | 폴더명 잘림 = 트리 항목 `paddingLeft: 12 + depth*16` + `textOverflow: ellipsis`(:283, :322). **폭이 늘면 코드 변경 0으로 해소** | `Sidebar.tsx:281-322` |
| C-6 | 편집창 최소 폭 = 좌 420(`:3495`) + 미리보기 `calc(38.5em + 32px)` + marginLeft 24(`:3601-3603`) ≈ 1054px@15px. `content-frame`이 `overflowX:auto`라 그 아래에서는 **프레임 안에서** 가로 스크롤 | `EditorView.tsx` |
| C-7 | 이 프로젝트에 다크 모드는 없다 → 새 색 토큰에 다크 정의 금지 | CLAUDE.md |

### D. 명암비 실측 (`((c+0.055)/1.055)^2.4`, 배경 = 새 카드색 `#F4EFE7` / hover `#E8DFCE`)

| 테두리 후보 | on `#F4EFE7` | on `#E8DFCE`(hover) | 판정 |
|---|---|---|---|
| `#DDD3C3` (v1 원안) | **1.29:1** | **1.12:1** | ✗ `#DCD3C2`(1.24:1) 기각 전례와 동급, hover에서 소멸 |
| **`--border-content #D2C8B8`** | **1.45:1** | **1.25:1** | ✓ **채택** — 신규 토큰 0 |
| `--block-hairline #C2B7A2` | 1.73:1 | 1.50:1 | 예비 — 실물에서 흐리면 한 단 올림 |
| (현행) `--border-light #E8E4DF` on `#E8DFCE` | — | 1.05:1 | 참고: 지금 카드 테두리는 배경보다 **밝다** |

---

## 4. 아키텍처

**전부 클라이언트. 리사이즈는 훅 1 + 핸들 컴포넌트 1로 단일화, FolderView는 스타일 치환.**

- `hooks/useDrawerResize.ts` — 폭 상태 + 드래그 핸들러. B-1의 pointer capture 방식을 채택(오버레이·iframe 위에서 안전).
- `components/ui/DrawerResizeHandle.tsx` — B-4 JSX의 단일 사본.
- 소비처 5: EditorView(댓글·agent / 버전 드로어), ProblemView(댓글·agent / 우측 단), AppShell(좌측 사이드바).
- FolderView·ListView — 스타일 치환만. 데이터·훅·DnD 무변경.

**⚠ `anchor`와 `side`는 다른 개념이다 (이 Phase의 최대 함정)**

- 훅의 **`anchor`** = 패널이 **뷰포트의 어느 변에 고정**되어 있는가 → 드래그 방향 계산에 쓴다.
- 핸들의 **`side`** = strip을 **positioned 부모의 어느 변**에서 offset할 것인가 → 렌더 위치에 쓴다.

버전 드로어가 둘이 갈리는 유일한 사례다: 뷰포트 우측에 고정(`anchor:'right'`)인데 핸들은 드로어의 **왼쪽 변**에 붙는다(`side:'left', offset:-5`). 한 이름으로 합치면 반드시 틀린다.

**⚠ 핸들을 `overflow`가 걸린 상자 안에 넣지 말 것** — E1·E1′의 원인이다. 마운트 후보 상자의 `overflow`를 먼저 확인한다.

| 마운트 대상 | 상자 | `overflow` | 결론 |
|---|---|---|---|
| 좌측 사이드바 | `<aside>` | **hidden** | ✗ → AppShell 루트로 |
| ProblemView 우측 단 | 우측 단 div | **auto(Y)→X도 auto** | ✗ → ProblemView 루트로 |
| 버전 드로어 | 드로어 루트 | 미지정(visible) | ✓ 안쪽 `left:-5` |
| 댓글·agent | (현행) 화면 루트 | — | ✓ 현행 유지 |

---

## 5. 결정 (D1′~D20′ — 결정 7건 덕수 승인 완료, 2026-08-27)

### A축 — FolderView

| # | 결정 | 근거 |
|---|---|---|
| **D1′** | **U자 프레임 철거.** `:495`의 `background`와 `:499-501`의 3줄을 삭제. `flex/minHeight/width`·`overflow:auto`·`position:relative`·`fontSize`는 **유지**(스크롤·sticky·DnD 기준). 섹션 주석(`:493`)을 개정 — 현행 "3면 경계 + 상단 14px 라운드"는 라운드 부분이 이미 stale이다 | 구상 · P1 |
| **D2′** | **카드 = 클레이 카드.** `background: var(--bg-content)`(`:557`) · `border: 0.5px solid var(--border-content)`(`:558`) · radius 12 유지. **신규 토큰을 만들지 않는다** — `#DDD3C3`은 기각 전례와 동급(§3-D). "클레이 영역의 경계선 색이 이제 클레이 카드의 경계선"으로 서사가 그대로 이어진다 | E4 · P3 |
| **D3′** | **hover = `--block-bg-active`(#E8DFCE) + 현행 그림자.** 화면 최악(가장 어두운) 배경이 지금과 **동일하게** 유지되므로 Phase 58·59·59a 명암비 판정이 전부 그대로 유효하다 | P2 |
| **D4′** | **페이드 하드코딩을 변수로 소거.** `.problem-card`에 `--card-bg`를 정의하고 `:hover`에서 그 변수만 갈아끼운다. 페이드는 `linear-gradient(180deg, transparent 0%, var(--card-bg) 100%)` → **hover용 페이드 규칙 자체가 사라지고** 하드코딩 rgba 2곳이 소멸한다. `transparent`는 현대 브라우저가 premultiplied alpha로 보간하므로 회색이 끼지 않는다(주석의 우려는 그 이전 세대 것) — **T1에서 육안 확인** | A-6 · `78a780f` 재발 차단 |
| **D5′** | **가로 구분선 2개 모두 제거**: FolderView:454(하위폴더 행) · ListView:102(제목행). 구상이 지목한 선이 어느 쪽이든 결과가 같다 | E6 · 구상 |
| **D6″** | **리스트 행 = 가로로 긴 클레이 카드.** `background: var(--bg-content)` · `border: 0.5px solid var(--border-content)` · `borderRadius: 8` · `padding: '9px 14px'`(세로 두께 현행 유지, 라운드 때문에 좌우만 +4) · `marginBottom: 4`(아이보리 바닥 노출 · 카드 gap 20보다 훨씬 좁게) · `borderBottom` 삭제 · `transition: 'background .15s, box-shadow .15s'` 추가. hover는 **인라인 핸들러를 걷어내고 CSS로**: `.folder-row:hover { background: var(--block-bg-active) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }`. 그림자는 카드(4px 14px)보다 작게 — 간격 4px에 맞춘다. ⚠ **`problem-card` 클래스를 붙이지 말 것**(A-15 예외가 딸려온다) → 별도 `folder-row` | 구상 · A-11 · A-15 |
| **D7″** | **제목행 = 행과 같은 기하의 고정 카드.** `position:sticky; top:0; zIndex:2` · `background: var(--bg-hover)`(#F0EBE3 — 아이보리보다 톤, 클레이보다 밝음 = "살짝만") · `borderRadius: 8` · `padding: '6px 14px'`(행과 좌우 정렬) · `marginBottom: 4` · `borderBottom` 삭제. **배경이 있어야 스크롤된 행이 비치지 않는다**(A-12). sticky 성립은 A-13이 보장 | 구상 · A-12·A-13 |
| **D8′** | **ListView 좌우 인셋 16 → 0**(`padding: '8px 0 32px'`). 행 폭 = 1136px = 제목바·하위폴더 행과 같은 컨테이너 폭이므로 문항 제목이 폴더 제목과 세로로 정렬된다 | A-10 · 구상 |
| **D9″** | **hover 규칙은 globals.css 한 곳에 모은다**(카드·행 둘 다). `.problem-card` 규칙이 이미 globals.css:744-746에 있어 자연스럽고, "공용 컴포넌트가 붙이는 클래스는 스타일도 공용"(Phase 61b 교훈)에도 맞는다. FolderView:540-544의 인라인 `<style>`은 삭제. ⚠ **`background`에는 `!important`가 계속 필요하다** — 카드·행의 기본 배경이 인라인 style이라 시트 규칙이 못 이긴다(A-5). `box-shadow`와 `--card-bg`는 인라인이 아니므로 불필요 | A-5 · CLAUDE.md |
| **D10′** | 카드 그리드 `justifyContent: center` **유지**. 행은 1136 전폭인데 2열 카드는 1060이라 좌단이 어긋나지만, 열 수 계산 규약을 건드리는 일이라 이번 범위 밖 | 범위 관리 |

### B축 — 리사이즈 통일

| # | 결정 | 근거 |
|---|---|---|
| **D11′** | **`useDrawerResize` 신설.** 시그니처는 §6. 핵심은 **`gap` 폐지**: pointerdown 시 커서와 패널 변 사이 offset을 캡처해 드래그 내내 유지한다 → 12·24 상수가 사라지고 시작 스냅(4px·16px)이 없어지며 left/right가 대칭이 된다. 추가로 ① 언마운트 시 `body.style.cursor/userSelect` 복원(드래그 중 화면 전환하면 커서가 `col-resize`로 굳는다) ② `window.resize` 시 폭 재클램프. **폭 영속 없음** — 새로고침·재진입은 매번 기본값(덕수 확정, localStorage 코드 금지) | E5 · B-1·B-2 |
| **D12′** | **`DrawerResizeHandle` 신설.** B-4 JSX의 단일 사본. props `{ side, offset, active, zIndex = 100, ...handleProps }`. `data-resize-handle` 속성을 달고 `onPointerDown`에서 `stopPropagation`(dnd-kit 충돌 방지, 현행 유지) | B-4 |
| **D13′** | **폭 수치는 패널별 · 문법만 공유**(P4): 댓글·agent `360 ~ innerWidth*0.9 / 420`(현행) · 버전 드로어 `360 ~ innerWidth*0.9 / 460` · ProblemView 우측 단 `150 ~ 360 / 220` · 좌측 사이드바 `200 ~ min(480, innerWidth*0.33) / 260`. 사이드바 상한을 창 비례로 묶는 것은 E8(편집창 최소 폭 1054px) 때문 | P4·P5·E8 |
| **D14′** | **버전 드로어 핸들은 드로어 안쪽 좌변에 마운트**(`side:'left', offset:-5`, `anchor:'right'`). 드로어 루트에 overflow가 없어 안전하고(B-6), 드로어의 스태킹 컨텍스트(110) **안**이라 `RestoreConfirm(1400)`이 핸들 위를 덮는다. **루트에 zIndex>110으로 두지 말 것**(B-7). VersionDrawer에는 `width?: number`와 `resizeHandle?: ReactNode` prop만 추가해 훅을 모르게 둔다 | B-6·B-7 |
| **D15′** | **EditorView는 핸들을 하나만 렌더한다** — `rightPanelWidth`를 소유한(더 넓은) 쪽. 동률이면 드로어(위에 있다). 판정이 일의적이고, 좁은 쪽 핸들은 어차피 넓은 패널에 가려지거나(드로어 110 > 핸들 100) 패널 한복판에 뜬다 | B-5·B-7 |
| **D16′** | **ProblemView: 패널이 열리면 우측 단과 그 핸들을 렌더하지 않는다**(`rightOpen && !panelMode`). 이유 셋: ① 핸들만 패널 위에 살아남는 새 버그를 원천 차단(E2) ② 228~368px 死공간 제거(E3) ③ 어차피 보이지 않던 열이다. `rightOpen` 상태는 유지되므로 패널을 닫으면 그대로 돌아온다. 좌표 연쇄도 함께 정리: `:732`·`:782`의 `right`를 `16 + (panelMode ? panelWidth + 8 : (rightOpen ? rightWidth : 0))`으로 | E2·E3 |
| **D17′** | **우측 단 핸들은 ProblemView 루트에 마운트**(`anchor:'right', side:'right', offset: rightWidth - 5`). 우측 단 자신은 `overflowY:auto`라 안쪽이 잘린다(E1′). offset이 댓글 패널(`panelWidth + 3`)과 다른 것은 **경계선 위치가 다르기 때문**이다 — 패널은 8px 갭 뒤에 경계가 있고 우측 단은 자기 좌변이 곧 경계다. 10px strip의 **가운데가 경계에 오도록** 각각 `+3`·`-5`. 우측 단 자체는 `flex:1/minWidth/maxWidth` → `width: rightWidth, flexShrink: 0` | E1′·B-9·P4 |
| **D18′** | **좌측 사이드바 핸들은 AppShell 루트에 마운트**(`anchor:'left', side:'left', offset: width - 5`). 루트 div에 `position:'relative'` 부여(AppShell에 절대배치 요소가 0건이라 파급 없음). aside에는 손대지 않는다(C-4). **접힘 상태에서는 미렌더**(56px 고정) | E1·C-3·C-4 |
| **D19′** | **사이드바 폭 상태는 AppShell 소유**, `<Sidebar width dragging>`으로 전달. aside는 `width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width`, **`transition: dragging ? 'none' : 'width var(--transition-normal)'`**(P5). 접힘/펼침 애니메이션은 그대로 산다 | P5·C-1 |
| **D20′** | **`--sidebar-expanded`·`--sidebar-collapsed` 토큰 삭제**, `Sidebar.tsx`에서 `SIDEBAR_WIDTH_DEFAULT = 260` / `SIDEBAR_COLLAPSED_WIDTH = 56` export. 소비처가 한 곳뿐이라 파급 0이고, 폭이 상태가 된 이상 토큰을 남기면 진실이 두 곳이 된다 | C-2 |

---

## 6. 새 모듈 계약

```ts
// hooks/useDrawerResize.ts
export function useDrawerResize(opts: {
  defaultWidth: number;
  min: number;
  max: number | (() => number);   // 창 비례 상한은 함수로
  anchor: 'left' | 'right';       // 패널이 뷰포트의 어느 변에 고정되어 있는가
}): {
  width: number;
  dragging: boolean;
  hover: boolean;
  setWidth: (w: number) => void;
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
};
```

**드래그 수식 (gap 없음).** pointerdown에서 offset을 한 번 재고, 이후 그 값을 유지한다.

```
anchor 'right':  delta = e.clientX - window.innerWidth + width
                 next  = window.innerWidth - ev.clientX + delta
anchor 'left':   delta = e.clientX - width
                 next  = ev.clientX - delta
둘 다:            setWidth(clamp(next, min, resolveMax()))
```
두 경우 모두 시작 시점에 `next === width`가 되어 **스냅이 없다**(현행은 4px·16px 튄다).

부수 규약: `el.setPointerCapture(pointerId)` + el 리스너(B-1 방식) · 드래그 중 `document.body`의 `cursor:'col-resize'`/`userSelect:'none'` · pointerup과 **언마운트 양쪽에서** 복원 · `window.resize`에서 재클램프.

```tsx
// components/ui/DrawerResizeHandle.tsx
<DrawerResizeHandle
  side="right"        // strip을 positioned 부모의 어느 변에서 offset할지 (anchor와 별개)
  offset={panelWidth + 3}
  active={dragging || hover}
  zIndex={100}        // 기본값. 버전 드로어 안에서는 그대로 두면 된다(드로어가 110 컨텍스트)
  {...handleProps}
/>
```
렌더: `position:absolute; top:0; bottom:0; width:10; cursor:col-resize; display:flex; justifyContent:center` + `left|right: offset` + 안쪽 `width: active ? 1.5 : 0; height:100%; background: var(--border-content-active); transition: width .1s`.

**offset 표 (10px strip의 가운데를 경계선에 맞춘 값)**

| 소비처 | anchor | side | offset | 마운트 상자 |
|---|---|---|---|---|
| EditorView 댓글·agent | right | right | `panelWidth + 3` | EditorView 루트(현행) |
| EditorView 버전 드로어 | right | left | `-5` | **VersionDrawer 루트 안쪽** |
| ProblemView 댓글·agent | right | right | `panelWidth + 3` | ProblemView 루트(현행) |
| ProblemView 우측 단 | right | right | `rightWidth - 5` | **ProblemView 루트** |
| 좌측 사이드바 | left | left | `width - 5` | **AppShell 루트** |

---

## 7. 구현 항목 (파일 · 라인)

### 7.1 A축

```
components/problem/FolderView.tsx
  :454        하위폴더 행 borderBottom 삭제 (D5′)
  :493        섹션 주석 개정 — "U-프레임: 클레이 + 3면 경계 + 상단 14px 라운드"
              → "스크롤 컨테이너(프레임 없음, Phase 62). 바탕은 루트의 아이보리"
  :496        background: 'var(--bg-content)' 삭제 (D1′)
  :499-501    borderTop/Left/Right 3줄 삭제 (D1′)
  :502        Phase 45a 주석 → Phase 62 주석으로 교체 (§9 규칙 개정과 같은 문구)
  :540-544    인라인 <style> 블록 통째로 삭제 → globals.css로 (D9″)
  :557        background: 'var(--block-bg-active)' → 'var(--bg-content)' (D2′)
  :558        border: '1px solid var(--border-light)' → '0.5px solid var(--border-content)' (D2′)
  :642-645    페이드 주석 3줄 + background를 var(--card-bg) 방식으로 교체 (D4′)
              background: 'linear-gradient(180deg, transparent 0%, var(--card-bg) 100%)'

components/problem/ListView.tsx
  :97         padding '8px 16px 32px' → '8px 0 32px' (D8′)
  :99-109     제목행: sticky/zIndex/background/borderRadius/marginBottom 추가,
              borderBottom 삭제, padding '6px 10px' → '6px 14px' (D7″)
  :122-132    행: className="folder-row", background/border/borderRadius/marginBottom/transition 추가,
              borderBottom 삭제, padding '9px 10px' → '9px 14px',
              onMouseEnter/onMouseLeave 2줄 삭제 (D6″)

app/globals.css
  :744 근처   .problem-card / .folder-row 규칙을 Phase 59a Q5 예외 옆에 모은다 (D4′·D6″·D9″)
```

```css
/* Phase 62 — 폴더뷰 카드·행. 기본 배경/테두리는 컴포넌트 인라인 style이 갖고 있으므로
   background만 !important가 필요하다(인라인은 !important 없는 시트 규칙을 이긴다).
   --card-bg 하나로 페이드가 따라오므로 hover용 그라디언트 규칙이 따로 없다 — 78a780f 사고 재발 차단. */
.problem-card { --card-bg: var(--bg-content); }
.problem-card:hover {
  --card-bg: var(--block-bg-active);
  background: var(--block-bg-active) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
.folder-row:hover {
  background: var(--block-bg-active) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

### 7.2 B축

```
hooks/useDrawerResize.ts               신설 (D11′)
components/ui/DrawerResizeHandle.tsx   신설 (D12′)

components/editor/EditorView.tsx
  :1002-1004  panelWidth·resizeHover·resizeDragging 3상태 → useDrawerResize 2개(comment · version)
  :1028-1032  rightPanelWidth = max(comment.width, version.width) + 활성 핸들 판정 (D15′)
  :1031       stale 주석 "드로어가 zIndex 60" → 110 (E9)
  :2977-3006  PANEL_MIN·handleResizeStart·resizeActive 전부 삭제 (훅으로)
  :3114-3130  <VersionDrawer width={version.width} resizeHandle={…}> (D14′)
  :3763-3784  → <DrawerResizeHandle …> (활성 핸들이 'comment'일 때만, D15′)
  :3765       stale 주석 "200ms dwell 후 활성" 삭제 (E9)

components/version/VersionDrawer.tsx
  :25-26      VERSION_DRAWER_WIDTH 주석을 "기본값"으로 개정 (export 유지)
  props       width?: number · resizeHandle?: React.ReactNode 추가
  :279-285    width: props.width ?? VERSION_DRAWER_WIDTH · 루트 첫 자식으로 {resizeHandle} (D14′)

components/problem/ProblemView.tsx
  :156-158    → useDrawerResize(comment) + useDrawerResize(rightCol)
  :496-519    handleResizeStart 등 삭제 (훅으로)
  :732·:782   right: 16 + (panelMode ? panelWidth + 8 : (rightOpen ? rightWidth : 0))  (D16′)
  :793-801    렌더 조건 rightOpen → rightOpen && !panelMode,
              flex:1/minWidth/maxWidth → width: rightWidth, flexShrink: 0            (D16′·D17′)
  :1006-1025  → <DrawerResizeHandle …>  + 우측 단 핸들 1개 추가(루트 직속)            (D17′)

components/layout/AppShell.tsx
  :87 근처    const sidebar = useDrawerResize({ defaultWidth: SIDEBAR_WIDTH_DEFAULT,
                min: 200, max: () => Math.min(480, Math.round(window.innerWidth * 0.33)),
                anchor: 'left' })                                                     (D13′)
  :635        루트 div에 position: 'relative' 추가                                     (D18′)
  :636        <Sidebar width={sidebar.width} dragging={sidebar.dragging} …>            (D19′)
  :670 근처   {!collapsed && <DrawerResizeHandle side="left" offset={sidebar.width - 5}
                active={sidebar.dragging || sidebar.hover} {...sidebar.handleProps} />} (D18′)

components/layout/Sidebar.tsx
  상단        export const SIDEBAR_WIDTH_DEFAULT = 260; SIDEBAR_COLLAPSED_WIDTH = 56;  (D20′)
  props       width: number · dragging: boolean 추가
  :809·:814   width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width
              transition: dragging ? 'none' : 'width var(--transition-normal)'         (D19′)
  ⚠ <aside>에는 position/overflow를 건드리지 않는다 (E1·C-4)

app/globals.css
  :191-192    --sidebar-expanded · --sidebar-collapsed 삭제 (D20′)
```

---

## 8. 작업 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **1** | **B축 훅·핸들 추출 → 댓글·agent 2곳 치환 먼저.** 폭 수치·마운트 위치 그대로 | T5 통과. ⚠ 완료 기준은 "픽셀 단위 동일"이 **아니다** — **드래그 시작 스냅(EditorView 4px · ProblemView 16px)이 사라지는 것이 의도된 변화**다(D11′). 그 외(최소 360·최대 90vw·활성선·커서·pointer capture)는 동일 |
| **2** | 버전 드로어(D14′·D15′) · ProblemView 우측 단(D16′·D17′) · 좌측 사이드바(D18′~D20′) | T6~T9 |
| **3** | **A축**: D1′ → D2′ → D3′·D4′ 카드 → D5′~D9″ 리스트 | T1~T4. 테두리가 흐리면 `--block-hairline #C2B7A2`로 한 단 올림(§3-D) |
| **4** | 마무리: CLAUDE.md 규칙 개정 2건(§9) · roadmap Phase 62 절 · stale 주석 4건(E9) | §10 체크리스트 |

**B축을 먼저 하는 이유**: 단계 1은 동작 불변 리팩터링이라 회귀 판정이 명확하다. A축의 색·톤 변경과 섞이면 어느 쪽 변화인지 구분이 흐려진다.

---

## 9. 하지 말 것 · 규칙 개정

**CLAUDE.md 개정 1 — U자 프레임 (Phase 45a 항목 교체)**
> U자 프레임(상·좌·우 0.5px, 상단 직각)은 **문항 단위 화면 2곳**(`EditorView` · `ProblemView`)이 공유한다. **한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 둘을 항상 함께** 손댈 것. **`FolderView`는 Phase 62부터 의도적으로 프레임이 없다** — 클레이 = "문항 하나를 보는 중", 아이보리 = "문항 밖". 클레이는 카드·리스트 행이 담당한다. **FolderView에 프레임을 되살리지 말 것.**

**CLAUDE.md 개정 2 — 명암비 구속 조건 (Phase 58 D3 항목 보정)**
> 실배경 중 가장 어두운 값은 여전히 **`#E8DFCE`**지만, Phase 62 이후 그것은 **FolderView 카드의 hover 배경**이다(정지 상태 카드는 `#F4EFE7`). `--case-dot` 3.28 / `--tone-dim` 4.76은 그대로 유효하다. **hover를 `#E8DFCE`보다 어둡게 내리면 이 계산이 전부 무너진다.**

**그 외**
- 페이드 색을 다시 하드코딩하지 말 것 — `--card-bg` 하나가 카드·hover·페이드를 함께 움직인다(D4′). 이것이 `78a780f` 사고의 구조적 해소다.
- 리스트 행에 `problem-card` 클래스를 붙이지 말 것 — Phase 59a Q5 예외(`content:none`)가 딸려온다(A-15). 반드시 `folder-row`.
- 핸들을 `overflow`가 걸린 상자 안에 넣지 말 것(§4 표). 특히 `overflow-y: auto`는 **가로도 함께 잘린다**.
- 버전 드로어 핸들을 루트에 zIndex>110으로 두지 말 것 — `RestoreConfirm`(1400) 위에 strip이 뜬다(B-7).
- 사이드바 드래그 중 transition 제거 필수(P5) — 빠뜨리면 핸들이 커서에 0.2s 뒤처진다.
- 폭 영속(localStorage) 코드를 넣지 말 것 — 매번 기본값이 확정 사양이다(D11′).
- 다크 토큰 금지(C-7) · `[data-noscroll]` 세로 스크롤 금지 · CM `scrollIntoView` 금지 — 전부 현행 규칙 유지.
- 커밋까지만(push는 덕수) · 수정 전 파일 읽기 · 완료 시 roadmap 갱신.

---

## 10. 검증 체크리스트

**A축**
- **T1** 카드 보기: 바탕 아이보리 · 카드 클레이(`#F4EFE7`) + 0.5px 테두리가 **보인다** · hover 시 `#E8DFCE` + 그림자 · **하단 페이드에 회색 띠가 끼지 않는다**(D4′ `transparent` 확인) · hover 상태에서도 페이드 끝색이 카드색과 일치.
- **T2** 리스트 보기: 행이 카드로 보인다 · 행 사이로 아이보리 바닥이 드러난다 · hover 그림자가 그 간격 안에서 보인다 · 제목행이 스크롤에 고정되고 **행이 비쳐 보이지 않는다** · 제목행 라운드 모서리로 행이 살짝 비치는 정도는 허용.
- **T3** 가로 구분선 0: 하위 폴더가 **있는** 폴더와 **없는** 폴더 각각에서, 카드·리스트 두 보기 모두 확인(선 후보가 둘이었다 — E6).
- **T4** 행 좌단이 폴더 제목·하위폴더 칩과 세로로 정렬(1136px) · ⋮ 메뉴가 sticky 제목행 위로 뜬다(z 1000).
- **T5** FolderView → ProblemView/EditorView 전환 시 **그 두 화면의 U자 프레임에 변화 0** · Phase 59a Q5 예외 유지(카드 안 경우 블록에 rail·dot 미표시) · dnd-kit 카드 드래그·폴더 드롭 정상.

**B축**
- **T6** 댓글·agent 리사이즈: 최소 360 · 최대 90vw · 활성선 1.5px · 커서 col-resize — EditorView·ProblemView 둘 다. **드래그 시작 시 패널이 튀지 않는다**(의도된 개선) · 드래그 중 텍스트 선택 안 됨 · 놓으면 body 커서 복원.
- **T7** 버전 드로어: 좌변 핸들로 리사이즈 · 열린 상태에서 복원 모달(`RestoreConfirm`)이 **핸들 위를 덮는다** · 댓글과 동시에 열면 **더 넓은 쪽 핸들 하나만** 보인다(D15′) · 드로어를 좁혔다 넓혀도 Row1~3 밀어내기가 따라온다.
- **T8** ProblemView 우측 단: 150~360 조절 · 글자크기 컨트롤·토글 버튼이 폭을 따라간다 · **댓글 패널을 열면 우측 단이 사라지고 본문이 넓어진다**(死공간 0) · 패널을 닫으면 이전 폭 그대로 복귀 · 패널 위에 떠 있는 세로선이 **없다**(E2).
- **T9** 좌측 사이드바: 200~min(480, 창의 33%) 조절 · **드래그 지연 0** · 접힘/펼침 애니메이션 유지 · 접힘 상태에서 핸들 미표시 · 긴 폴더명·깊은 하위 폴더가 폭을 늘리면 드러난다 · 핸들이 잘리지 않는다(E1) · 사이드바를 최대로 넓혀도 페이지 전체가 가로로 밀리지 않는다(편집창 내부 가로 스크롤은 정상 — E8).
- **T10** 새로고침 후 모든 폭이 기본값(420 · 460 · 220 · 260)으로 복귀 · 드래그 중 다른 화면으로 이동해도 커서가 `col-resize`로 굳지 않는다 · 창을 좁혔다 넓혀도 패널이 화면 밖으로 나가지 않는다.

**공유 화면**
- **T11** 사이드바 '받은 문항 / 보낸 문항' 화면(FolderView 재사용, E10)에서 A축 변경이 동일하게 적용되고 소유자·권한 열이 깨지지 않는다.

---

## 11. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · 인쇄 · 공개 뷰어(`PublicViewerShell`·`/p`·`/shared`) · `BazaarView` · **EditorView·ProblemView의 U자 프레임 자체** · CommentPanel 내부 · 블록 렌더 5사이트 · `.problem-card`의 Phase 59a Q5 예외. **전부 0건.**

신규 2 (`hooks/useDrawerResize.ts` · `components/ui/DrawerResizeHandle.tsx`) + 수정 7 (FolderView · ListView · EditorView · ProblemView · VersionDrawer · AppShell · Sidebar) + `globals.css` + CLAUDE.md · roadmap. **신규 색 토큰 0**(v1의 `--card-border` 폐기), **삭제 토큰 2**(`--sidebar-expanded`·`--sidebar-collapsed`).

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 적합성 판정 P1~P5 · 사실표 A·B·C · D1~D12 · 검증 요청 Q1~Q9 |
| v1 보정 | web + 덕수 | Q1~Q4 답변 반영 |
| **v2** | **CLI** | **실측 교차검토: 구현 불가 2건(E1·E1′) · 새 버그 유발 1건(E2) · 사실 오류 3건(E3~E5) 정정 · Q5~Q9 전건 답변 · 결정 7건 승인 반영 → D1′~D20′ 확정 · 새 모듈 계약(§6) · offset 표 · 체크리스트 T1~T11** |
| v3 | web | 재검증·확정 (예정) |

*v2 → web 재검증 대기. 인용은 전부 origin/main `431c6f6` 기준.*
