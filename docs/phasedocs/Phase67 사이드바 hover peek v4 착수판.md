# Phase 67 — 좌측 사이드바 hover peek(자동 펼침·접힘) 구현 계획서 v4 (CLI 착수판 · 확정본)

작성일: 2026-09-17 · 작성: CLI v2(레포 실측) → web v3 재검증 → **CLI v4 착수판** · 기준 커밋: **`0b9229b`**(main, 2026-09-16 — `e73fbaf` 이후 1커밋은 `lib/proofread.ts`·`lib/sheetImport.ts`·테스트 2개뿐, 이 Phase 범위와 겹침 0 · 인용 행 번호 불변)
계보: 덕수 구상 `sidebar-auto-folding.md` → v1 web(덕수 확정 D3·D7·D12·D14) → v1 CLI 교차검토(`Phase67-sidebar-hover-peek-review-v1-CLI.md`, 정정 11·보완 16·결정 N1~N7 **전항 권장안 확정** 2026-09-16) → **v2 CLI** → 검증 턴(독립 리뷰 에이전트, 발견 18: ERROR 3 · GAP 8 · OK 7 — §10) → **v3 web 재검증**(발견 10: ERROR 3 · GAP 4 · 정정 1 · OK 2 — §11) → **v4 CLI 착수판**(발견 16: 정정 6 · 보완 10 — §12)
실측: 코드 대조(§1 전수) + headless Chrome CDP 계측(dev `-p 3123` · 비로그인 `/` · 뷰포트 813h). 계측 스크립트·서버는 폐기.
v3 실측: mathory clone `0b9229b` 대조 + `@dnd-kit/core@6.3.1`(package-lock 고정판) dist `core.esm.js` 직접 확인 + React `18.3.1`(자동 배칭) 확인.
v4 실측: `0b9229b` 작업 트리 재대조(v3 사실 주장 전수 일치) + `react-dom@18.3.1` cjs `extractEvents$2`(EnterLeave — `:8014`)·`getEventPriority` 직접 확인.

> **v2의 성격**: v1의 방향(오버레이 peek · 단일 활성 섹션 · 상태 기억)은 그대로. 구조를 바꾼 것은 **`pinning` 단계 신설**(E1) 하나.
> 죽은 장치 둘 삭제(`document pointerleave` · 접기 직후 railEnter 가드) · reduced-motion 제외(N1) · hold 중 섹션 전환 보류(N3) · 착지 좌표 실측값(§1-1).
> **검증 턴이 고친 것(§10)**: 터치 경로가 열자마자 닫히던 구멍(V9) · `ctx.dragging`이 리사이즈와 DnD 둘로 읽히던 혼동(V10) · `transitionend` 출처 분리(V8) · DragOverlay가 포인터 밑에 들어와 `inside`가 굳는 문제(V12) · peekIn 되감기 재생(V13) · D2 래퍼 고정폭이 고정 토글 애니메이션을 바꾸던 것(V16) · ShareButton 배경 서술 역전(V4).
> **v3(web 재검증)이 고친 것(§11)**: 레일 세로 훑기에서 open 타이머가 **재시작되지 않던** 구멍(W1 — React 18 배칭으로 phase가 `pending`에 머물러 effect deps가 안 바뀐다 → `seq` 도입) · open 진입 시 `armedAt`에 쓸 좌표가 없던 것(W2 — pointermove를 `pending`부터) · `peekIn`이 **두 번째 peek부터 재생되지 않던** 것(W3 — `fresh`가 idle에서 안 꺼진다) · 바깥 탭 닫기가 `stopPropagation` 30곳에서 **안 먹던** 것(W4 — capture 단계) · `outsidePointerDown`의 포인터 종류 미정과 D9 주석 모순(W5) · 터치로 연 peek이 항목을 골라도 본문을 덮고 남던 것(W6) · pinning 중 래퍼 폭(W7) · D10 문구(W8).
> **덕수 추가 요청(D17)**: peek 패널은 Chrome 세로 탭 hover 펼침처럼 **우측 위·아래 모서리를 둥글게(10px) + 그림자(`--drawer-shadow`)** — 우측 떠 있는 카드 규격을 재사용한다.
> **v4(CLI 착수판)가 고친 것(§12)**: 콘텐츠 래퍼가 flex column을 이어받지 않아 **푸터 고정·최근 문항 잘림이 무너지던** 것(Y1) · `hold` 식별자·no-op 이벤트가 **리렌더 루프**를 만들 수 있던 것(Y2·Y3) · 공유 레일 슬롯이 54px이 되어 **최근 레일 좌표가 4px 어긋나던** 것(X3) · 키보드 click이 낡은 `via`로 peek을 열던 것(X6) · 터치 peek에서 **새 문제·검색·시트 가져오기**를 눌러도 남던 것(Y5) · W1 발생 조건의 정밀화(X2) · D17 헤어라인이 곡선에서 **가늘어지는 것이 정상**이라는 검수 문구 정정(X4).
> ⚠ 개선묶음 M2 **F(자동접힘 제거)** 와 충돌하지 않는다 — peek은 `collapsed`를 **읽기만** 하는 Sidebar 내부 일시 상태다(§4).

---

## 0. 요약

지금 접힘 모드의 My·최근 문항 아이콘은 `onClick={() => {}}`인 **장식**이고(`Sidebar.tsx:826`, `:984`), 공유는 접힘 모드에서 **렌더되지 않으며**(`:961`), 최근 문항 아래에 점(≤4개, `:986` `slice(0,4)` + `:591-594`)이 찍힌다.

이번 Phase는 접힘 레일을 **[열기] [새 문제] [검색] [시트 가져오기] [My] [공유] [최근 문항]** 으로 정리하고, 뒤 세 아이콘에 **hover peek**을 붙인다.
peek은 AppShell의 `collapsed`를 건드리지 않는 **Sidebar 내부 일시 상태**이며, 패널이 본문 위로 **덮어** 펼쳐진다(본문 리플로 0). 펼친 패널은 **우측 위·아래 모서리가 둥글고 그림자가 진 떠 있는 카드**로 보인다(D17). 펼친 동안 **포인터가 올라간 섹션 하나만** 열리고 나머지 둘은 헤더만 남는다. My 트리는 기존 `mathory:folder:collapsed`(localStorage), 공유 하위(Bazaar·받은·보낸)는 Sidebar로 끌어올린 세션 상태를 쓴다. 최근 문항은 현행 조회(≤10)를 그대로, 넘치면 푸터 경계선 밑으로 잘린다.

변경 파일: `Sidebar.tsx`(주) · `ShareTree.tsx` · `SidebarSectionHeader.tsx` · `globals.css`(토큰 2) · **신규** `lib/sidebarPeek.ts`(순수 리듀서) · `hooks/useSidebarPeek.ts` · `tests/sidebarPeek.test.mjs` · `package.json`(`test:peek`).
**AppShell 0 · Firestore 0 · 스키마 0 · 규칙 0 · 서버 0 · 아이콘 추가 0 · PhoneShell·MiniShell 0**(Sidebar 소비처는 AppShell 하나 — `AppShell.tsx:37·801`).

---

## 1. 현행 — 실측 (`e73fbaf` 실측 · `0b9229b`에서 행 번호 불변 재확인 — v3·v4)

| 항목 | 자리 | 현행 |
|---|---|---|
| 접힘 상태 소유 | `AppShell.tsx:99` | `useState(false)` 세션 상태. 바꾸는 곳은 `onToggle`(`:805`) **하나**(`setCollapsed` 다른 호출 0 — M2 F 이후) |
| 폭 | `Sidebar.tsx:642-643` · `AppShell.tsx:104-109` | 펼침 `sidebar.width`(기본 260, 200~min(480, 33vw)) · 접힘 56 |
| aside | `Sidebar.tsx:746-760` | 흐름 안 flex item · `width: collapsed ? 56 : width` · `transition: dragging ? none : width var(--transition-normal)`(0.2s ease, `globals.css:250`) · `overflow: hidden` · `--bg-sidebar` · 우변 `--rail-hairline` |
| 레이아웃 루트 | `AppShell.tsx:800` | `display:flex; height:100dvh; overflow:hidden; position:relative` — aside·핸들·main 형제. `align-items` 기본 stretch |
| 리사이즈 핸들 | `AppShell.tsx:845-852` | `!collapsed`일 때만, 루트에 `offset: sidebar.width - 5`(`DrawerResizeHandle` 기본 z 100). `dragging` prop(`Sidebar.tsx:651`) = **리사이즈** 드래그 — 접힘에서는 항상 false |
| 접힘 레일 | `Sidebar.tsx:774-791` | 열기 버튼 · 새 문제 · 검색 · 시트 가져오기(`SidebarItem`, `collapsed`면 자동 `title=label` `:53`, hover는 `onMouseEnter/Leave` `:51-52`) |
| My (접힘) | `:824-828` | `SidebarItem` `onClick={() => {}}` — 무동작 |
| 폴더 트리 | `:830-854` | `!collapsed && foldersOpen`일 때만 → 접힘이면 `SortableFolderItem` 전부 언마운트. 미지정 `:858` · 휴지통 `:901` 같은 게이트 |
| 폴더 펼침 기억 | `:727-743` | `mathory:folder:collapsed` localStorage — 이미 영속 |
| My 헤더 열림 | `:723` | `foldersOpen` 세션 상태(기본 true) |
| 공유 (접힘) | `:961` | `!collapsed && <ShareTree/>` — 레일에 없음 |
| 공유 열림·하위 | `ShareTree.tsx:32-35` | `open`(기본 false, Phase 63 D32) · `bazaarOpen/receivedOpen/sentOpen`(기본 true) — ShareTree 내부라 접힘→펼침마다 **리셋** |
| 최근 문항 (접힘) | `:984-995` | 무동작 버튼 + `slice(0,4)` 점(로그인·최근 ≥1일 때) |
| 최근 섹션 | `:975` | `flex: 1; overflow: auto` |
| 최근 개수 | `AppShell.tsx:198·212` | `listRecentProblems(uid, 10)` 뒤 휴지통 제외 → ≤10 |
| 섹션 헤더 | `SidebarSectionHeader.tsx:17-57` | 아이콘 16 · 라벨/chevron 둘 다 `onClick={onToggle}` · chevron `title` '접기'/'펼치기'(`:52`) · `marginBottom 4` |
| 메뉴·피커 | `SortableFolderItem` `menuPos/iconPickerPos/movePos`(`:233-235`) · `DraggableProblemItem` `menuPos`(`:550`) | **비포털 `position: fixed`, 전부 패널의 DOM·fiber 자손**(fragment 형제 / `:624-634`) — FolderMenu z 9999(`:117-120`) · 이동 픽커 z 10000 폭 220(`:459`) · 아이콘 피커 z 10000 폭 316+16(`:519-522`) · ContextMenu z 1000(`ContextMenu.tsx:60-63`). 전부 `document mousedown` 바깥 클릭으로 닫힘. `createPortal` 0건 |
| 아이콘 크기 | `Icons.tsx` | IconSidebar 20 · IconPlus/IconSearch/IconRecent/IconUserCircle 18 · **IconShare 14**(헤더는 `size={16}`) · IconDownload 14(레일에서 `size={18}`) |
| DnD | `AppShell.tsx:790-797` · `dnd.tsx` | 전역 `DndContext` 하나 · `PointerSensor distance 8`(`:514`) · `DragKindContext`(`useDragKind()`) · `DragOverlay` 루트 div **형제**(`:1048`) — dnd-kit 기본 `position: fixed` · **z 999** · `pointer-events` 미설정(`core.esm.js:3631·3907`) → 드래그 시작 순간 **포인터 밑에 들어온다**. v3 확인: `PositionedOverlay`(`core.esm.js:3640-3675`)는 소스 노드 rect에 transform으로 따라가며 `pointer-events`·`setPointerCapture` 둘 다 0건 · `onDragStart/End`는 `unstable_batchedUpdates` 안(`:3092·3153`)이고 `handleAppDragEnd`가 첫 줄에서 `setActiveDragItem(null)`(`AppShell.tsx:531`) → 오버레이 제거와 `dragKind=null`이 **같은 커밋** |
| z-index (좌측 x<480과 겹칠 수 있는 것) | grep 전수 | main은 `position:relative` + z 없음(`AppShell.tsx:854-861`) → 스태킹 컨텍스트 아님. **80 아래**: EditorView FolderPathBar 래퍼 **20**(`:3530`, clip-path 컨텍스트 — 드롭다운 1000 포함) · ProblemView hold-to-peek 오버레이 **40**(`:987`, inset 0) · 우측 단 40 · ShareButton 바깥클릭 배경 **40**(`ShareButton.tsx:58`, fixed inset 0 — 소비처 `SnapshotView:85`·`PublicProblemView:122` 공개 뷰어 임베드). **80 위(비모달·일시)**: Row 2 툴바 풀다운 — UnifiedToolbar 특수문자 1000(`:322-330`) · MathSymbolPalette 1000(`:138-143`) · MathToolbar 1000(`:161-169`) · BlockBottomToolbar fixed 3000(`:135-138`) — Row 2는 x≈72부터라 peek(0~260)과 겹친다 · CM 툴팁 호스트 body 직속 fixed 10200(`MarkdownEditor.tsx:90-91`) · 모달 900~10500(`Z_DIALOG`) · DragOverlay 999 · HoverTip 10400. 100·110(댓글 핸들·EditorView 핸들·VersionDrawer)은 우측 고정이나 드로어 max가 `innerWidth*0.9`(`EditorView.tsx:1063·1067`)라 좁은 창에서 x<480까지 올 수 있다(극단, 기록만) |
| 자식 transition | `Sidebar.tsx` | `transition: all` 4곳(`:69` SidebarItem · `:310` 폴더 행 · `:877` 미지정 · `:927` 휴지통) + `:253`(useSortable transform) · `:277`(grip opacity) · `:587`(최근 행 background) · `:779`(토글 color) · `:326`·`ShareTree.tsx:162`·`SidebarSectionHeader.tsx:50`(chevron transform) — `transitionend`가 전부 **버블링**한다 |
| reduced-motion | grep | 앱 전체 0건 |
| pointerdown 전파 차단 | grep (v3) | `onPointerDown={(e) => e.stopPropagation()}` **30곳**(EditorView·BlockBottomToolbar·SvgViewer·GgbGraphView·GgbViewer·Sidebar·ListView·FolderView·AskListPopover) — React 18은 루트 컨테이너에서 위임하므로 여기서 멈춘 이벤트는 **`document` 버블 리스너에 도달하지 않는다** |
| React | `package.json:55-56` | `18.3.1` — 같은 task 안의 여러 `dispatch`는 **한 번의 렌더로 합쳐진다**(자동 배칭) |
| React enter/leave (v4) | `react-dom.development.js:8014`(`extractEvents$2`) · `getEventPriority` | `onPointerEnter/Leave`는 **네이티브 `pointerout` 한 번**에서 떠난 쪽 leave와 들어간 쪽 enter를 **함께** 디스패치한다(`pointerover`는 React 관리 노드 사이면 무시). 우선순위 `pointerout/over/move` = Continuous · `pointerdown` = Discrete |
| 레일 슬롯 구조 (v4) | `Sidebar.tsx:797·825` | My 레일 = 섹션 div `padding 8px 8px` + 안쪽 div `display:flex · justify center · marginBottom 4` + `SidebarItem`(38) → **슬롯 58**. 최근 레일은 안쪽 div 없이 섹션 div 직속(`:984`) |
| 리듀서 선례 | `lib/chromeAutoHide.ts` + `test:chrome` | 판단은 순수 함수, 타이머·이벤트는 훅 |

### 1-1. 실측 좌표 (CDP, 비로그인 — 뼈대만)

**접힘 레일** (공유 삽입 뒤는 계산 — 섹션 슬롯 58 = 8 + 38 + 4 + 8)

| 요소 | top | h | 중심 y |
|---|---|---|---|
| 헤더 | 0 | 56 | 28 |
| 새 문제 / 검색 / 시트 | 64 / 102 / 140 | 38 | 83 / 121 / 159 |
| **My 버튼** | 194 | 38 | **213** (아이콘 18, left 18.5) |
| **공유 버튼(신설)** | 252 | 38 | **271** |
| **최근 버튼(신설 뒤)** | 310 | 38 | **329** |

**펼침**(peek의 단일 활성 레이아웃을 헤더 접기로 재현. 헤더 행 24 · 헤더 슬롯 44 · 펼침 SidebarItem 34 · 섹션 1 펼침 118 vs 레일 130)

| 활성 | My 헤더 | 공유 헤더 | 최근 헤더 | 활성 콘텐츠 첫 행 | 레일 중심 착지 |
|---|---|---|---|---|---|
| My | 182~206 | 아래 | 아래 | 210~242 (첫 폴더/미지정) | 213 → **+3** |
| 공유 | 182~206 | **226~250** | 433~ | Bazaar 254~283 | 271 → **+17** |
| 최근 | 182~206 | 226~250 | **270~294** | 첫 문항 298~ | 329 → **+31** |

레일 버튼 **히트 영역 전체(38px)** 로 봐도 다른 섹션 헤더와 겹치지 않는다 — 공유 버튼 상단 252 vs My 헤더 하단 206(46px) · 최근 상단 310 vs 공유 헤더 하단 250(60px). My의 +3은 얇지만 겹칠 수 있는 상대가 **My 자신의 헤더**(활성 → `switchSection` no-op)라 무해.
아이콘 x: 레일 18.5(중심 27.5) · 펼침 SidebarItem 24(중심 33) · 섹션 헤더 12(중심 20).

---

## 2. 구상 → 요구사항

| # | 구상 | 요구 |
|---|---|---|
| R1 | 접힌 레일 유지: 열기·새문제·검색·시트·My·최근 | 순서 유지 |
| R2 | 공유 추가 | My와 최근 **사이** |
| R3 | 최근 아래 점 없앰 | `slice(0,4)` 경로·`DraggableProblemItem collapsed` 삭제 |
| R4 | My·공유·최근 hover 동안만 펼침 | hover peek (D1·D4·D5) |
| R5 | 빠르게, 시작·끝 살짝 완만 | `cubic-bezier(0.33,0,0.2,1)` 200/160 (D3 확정) |
| R6 | 포인터 섹션만 펼침, 나머지 접힘 | 단일 활성 섹션 (D6) |
| R7 | My: 직전 폴더 펼침 상태 | localStorage 재사용 |
| R8 | 공유: 마찬가지 | 하위 상태 끌어올림 (D7 확정) |
| R9 | 최근: 넘치면 경계선 밑으로 | 개수 무관(D12 확정) · `overflow: hidden` (D11) |

---

## 3. 결정 사항

### D1 — 오버레이: 자리 56 고정, 패널만 본문 위로 (기본안 · z-index 규칙 개정)
aside를 **자리 표시자**와 **패널** 두 겹으로.
- 바깥 `<aside>`: 흐름 안 폭 `collapsed ? 56 : width`(현행 transition 유지) · **`position: relative` 상시** · `zIndex: phase === 'idle' ? 'auto' : 80` · overflow 없음 · 배경 없음. `onTransitionEnd` → `asideTransitionEnd`(가드 G1).
- 안쪽 패널 `div`: `position: absolute; top:0; bottom:0; left:0` · `overflow: hidden` · 배경·헤어라인·flex column(현 aside 스타일 이동). `onTransitionEnd` → `panelTransitionEnd`.

| phase | 자리 폭 | 패널 폭 | 패널 transition | 그림자 | aside z |
|---|---|---|---|---|---|
| `idle` · 고정 펼침 | width | width | `--transition-normal` | none | auto |
| `idle` · 접힘 | 56 | 56 | `--transition-normal` | none | auto |
| `pending` | 56 | 56 | `--transition-normal` | none | 80 |
| `open` | 56 | width | `--transition-peek-open` | `var(--drawer-shadow)` · 우측 모서리 radius 10 (D17) | 80 |
| `closing` | 56 | 56 | `--transition-peek-close` | 위와 같음(idle까지 유지) | 80 |
| **`pinning`** | 56→width(outer 애니메이션) | width | `--transition-normal` | none · radius 0 | **80** |

리사이즈 드래그 중(`dragging` prop)이면 transition `none`(현행). ⚠ **Y7 — idle에서 바깥 aside와 패널은 같은 `width var(--transition-normal)`**(리사이즈 중이면 둘 다 `none`)을 써야 한다. 고정 토글에서 본문 밀림은 aside가, 사이드바 모양은 패널이 그리므로 곡선·시간이 하나라도 다르면 둘 사이에 본문 배경이 비치는 틈이 생긴다. ⚠ 조건부 스타일은 **키를 항상 두고 값만** 바꾼다(`boxShadow: … : 'none'`, `zIndex: … : 'auto'` — Phase 45a longhand 구멍 규약).
**`pinning`이 필요한 이유(E1)**: pin 직후 idle이면 aside z가 auto로 돌아가는데 바깥 aside는 56→width를 200ms 애니메이션 중이고 패널은 이미 width다. aside는 positioned(relative)이고 main이 DOM 뒤라 **겹치는 부분을 main이 덮는다**. `pinning`은 바깥 aside의 `transitionend(width)`까지 z 80을 유지한다. ⚠ "z 80 상시"는 기각 — 고정 모드에서 aside가 스태킹 컨텍스트가 되어 ShareButton 바깥클릭 배경(fixed z 40) 위로 올라가 "사이드바 클릭 = 팝오버 닫힘"이 깨진다.
**z 80 성립 근거**: 좌측과 겹칠 수 있는 main 요소 중 80 아래는 20·40, 80 위는 Row 2 풀다운(1000·3000)·CM 툴팁(10200)·모달·DragOverlay·툴팁뿐이며 전부 **일시적**(바깥 클릭·Escape로 닫힘)이라 그것들이 peek 위에 뜨는 것이 맞는 방향이다(§1).
**ShareButton 배경(40)과의 관계(V4 정정)**: 공개 뷰어 임베드에서 공유 팝오버가 열려 있는 동안은 배경이 **레일을 덮어** `pointerenter`가 안 오므로 **peek이 열리지 않는다(정상)**. peek이 배경 위에 뜨는 경우는 peek이 이미 열린 채 유예 180ms 안에 main의 공유 버튼을 누른 때뿐 — 무해.
**peek 중 스태킹 컨텍스트(V5)**: aside z 80이면 안의 fixed 메뉴 4종(9999·10000·1000)은 **실효 z 80**이 된다(CLAUDE.md "position:absolute로 바꾸면 그 안의 fixed 모달이 갇힌다" 규약의 적용). 덮을 수 있는 것은 루트의 80 초과뿐(DragOverlay 999 · 툴팁 · 모달 10500 — 메뉴에서 띄우는 `promptDialog`가 메뉴 위인 것은 맞는 방향). 나중에 "peek 안 메뉴가 안 보인다"의 원인 후보로 기록.
⚠ **패널 애니메이션은 `width`다 — `transform`·`translate`·`clip-path` 금지.** 메뉴 4종이 비포털 fixed라 조상 transform이 좌표 기준을 바꾸고, clip-path는 패널 밖으로 나가는 픽커(220·332)를 자른다.

### D2 — 콘텐츠는 목표 폭으로 먼저 배치, 패널이 드러낸다 (기본안 · V13·V16 정정)
`expandedLook = !collapsed || phase ∈ {open, closing, pinning}` · `renderCollapsed = collapsed && !expandedLook`(= `idle`·`pending`).
콘텐츠 래퍼 폭: **`phase ∈ {open, closing, pinning} ? width : '100%'`**(V16 · **W7**: `open` 진입 200ms 안에 pin하면 패널이 아직 목표 폭 미만인데 래퍼가 `100%`로 풀려 pinning 동안 줄바꿈이 흔들린다 — pinning의 패널 목표 폭도 `width`이므로 고정해도 끝값이 같아 `idle` 전환 순간 점프가 없다). peek 중에만 고정해 패널이 56↔width로 움직이는 동안 줄바꿈·말줄임이 흔들리지 않게 한다. `idle`(고정 모드 포함)에서는 `100%`라 **고정 토글 애니메이션은 현행과 동일**(접힘 토글 순간 아이콘이 줄어드는 폭의 중심을 따라 미끄러지는 현행 동작 보존 — 래퍼를 상시 고정하면 t=0에 좌측 열로 점프해 6-1 스크린샷 대조로는 안 잡히는 변화가 생긴다).
⚠ **Y1 — 래퍼가 현 aside의 flex column을 이어받는다**: `display: flex; flexDirection: column; height: 100%; minHeight: 0`. 헤더·섹션1·My·공유·최근·푸터가 지금은 aside의 flex 자식이라 **최근 섹션 `flex: 1`(`:975`)이 남는 높이를 먹고 푸터(`:999`)가 바닥에 붙으며**, My 섹션 `overflow: auto`(`:797`)는 flex 자식이라 줄어들 수 있다(overflow≠visible인 flex 자식의 `min-height: auto`는 0으로 계산). 래퍼가 평범한 block이면 셋이 한꺼번에 깨진다 — 푸터가 내용 바로 밑으로 올라오고, D11의 "푸터 경계선에서 잘림"(R9)이 성립하지 않으며, 긴 폴더 트리가 스크롤 대신 패널 밖으로 넘친다. 패널은 래퍼 하나만 품으므로 패널 쪽의 flex column 선언은 없어도 되지만 `height` 계산을 위해 `display: flex`는 남겨도 무해하다.
닫힐 때는 **폭 애니메이션이 끝날 때까지 펼침 레이아웃 유지**(`closing`), `panelTransitionEnd`에서 레일로.
레일↔펼침 flip의 아이콘 x 이동(레일 27.5 ↔ 헤더 20 / SidebarItem 33): 콘텐츠 래퍼에 `animation: peekIn 90ms`(globals.css `:787` 기존 keyframe, opacity 전용 — ProblemView `:990`이 80ms로 쓴다)를 **`phase === 'open' && fresh`** 일 때만 건다 — `pending/idle → open`에서 fresh=true, `closing → open`(되감기)에서 false(V13). 키는 항상 두고 값은 `phase === 'open' && fresh ? 'peekIn 90ms' : 'none'`.
⚠ **W3 — `fresh`만 조건으로 두면 두 번째 peek부터 재생되지 않는다**: 래퍼 DOM 노드는 idle(레일)과 peek에서 **같은 노드**라 CSS 애니메이션은 `animation` 값이 바뀔 때만 재시작한다. 첫 peek이 되감기 없이 끝나면 fresh=true가 idle까지 남고, 다음 `pending→open`에서도 true → 값 불변 → 재생 없음. `phase === 'open'`을 함께 걸면 `open → closing`에서 `none`이 되어 다음 open에서 `none → peekIn`으로 확실히 재시작한다(closing에서 떼도 90ms 애니메이션은 이미 끝나 시각 변화 없음). 리듀서도 `idle` 진입 시 `fresh=false`로 되돌린다(이중 안전).
⚠ `SidebarItem`의 `transition: all .15s`(`:69`)가 padding `10px 0`↔`8px 12px`·gap을 애니메이션해 새 문제·검색·시트 3개 아이콘이 18.5↔24(5.5px) 슬라이드한다 — 열림은 reveal과 겹쳐 무해, **닫힘은 `idle` 전환 뒤 150ms 꼬리**로 남는다. **수용 · 실물 판정(N6)** — 거슬리면 `transition: background`로 좁힌다(고정 토글의 슬라이드도 함께 사라지는 변경이라 그때 따로).

### D17 — peek 패널 모양: 우측 위·아래 모서리 둥글게 + 그림자 (덕수 추가 요청 2026-09-16 · Chrome 세로 탭 hover 펼침과 같은 모양)
Chrome의 자동 펼침 패널은 본문 위에 **떠 있는 카드**로 읽힌다 — 오른쪽 위·아래 모서리가 둥글고, 오른쪽으로 옅은 그림자가 번진다(덕수 첨부 캡처). peek 중 패널에만 같은 모양을 준다.

| 속성 | `open`·`closing` | 그 외(`idle`·`pending`·`pinning`·고정 펼침) |
|---|---|---|
| `borderRadius` | **`0 10px 10px 0`**(좌상·우상·우하·좌하) | `0` |
| `boxShadow` | **`var(--drawer-shadow)`** | `'none'` |
| `borderRight` | `var(--rail-hairline)`(= `0.25pt solid var(--border-light)`) 그대로 — **곡선 구간에서 가늘어지며 사라진다**(위·아래 변 폭이 0이라 CSS가 모서리에서 폭을 보간한다 — X4, 정상) | 그대로 |

- **값은 새로 만들지 않고 우측 떠 있는 카드의 언어를 가져온다**: radius는 `DRAWER_RADIUS`(10, `components/ui/dialogStyles.ts:100`)를 import하고, 그림자는 `--drawer-shadow`(`globals.css:90-92`, 2겹 — 가까운 윤곽 `0 1px 3px .06` + 넓은 확산 `0 10px 32px .12`)를 쓴다. CLAUDE.md M2 "우측 패널 4종은 떠 있는 카드"와 같은 규격이라 "떠 있다"는 뜻이 앱 안에서 한 문법이 된다. v2의 한 겹 `4px 0 16px rgba(0,0,0,.08)`은 폐기 — 드로어 토큰 주석이 이미 "한 겹짜리는 바탕에 눌어붙어 보였다"고 기록한 형태다.
- **좌측 모서리는 0** — 패널이 화면 왼쪽 벽에 붙어 있어 둥글리면 벽과의 사이에 본문 배경이 비친다(Chrome도 창 가장자리 쪽은 각지다).
- **위·아래 인셋은 두지 않는다(0)** — Chrome 패널은 툴바 아래에서 시작하지만 Mathory 사이드바는 원래 뷰포트 전체 높이다. 인셋 8을 주면 peek과 고정 펼침의 세로 위치가 달라져 레일 → 헤더 착지 좌표(§1-1)가 8px 틀어지고, pin 순간 패널이 위아래로 튄다. 둥근 모서리는 뷰포트 맨 위·맨 아래에서 본문 배경을 비치며 보인다.
- **클리핑**: 패널은 이미 `overflow: hidden`이라 radius가 콘텐츠(헤더 워드마크·푸터 아바타·최근 문항 행)를 곡선으로 자른다. `box-shadow`는 자기 `overflow`에 잘리지 않고, 바깥 aside는 overflow가 없으며, 루트 div(`AppShell.tsx:800`)의 `overflow: hidden`은 뷰포트 경계에서만 자르므로 오른쪽 확산은 본문 위에 그대로 보인다. ⚠ 비포털 `position: fixed` 메뉴 4종은 조상의 `overflow + border-radius` 클리핑을 받지 않는다(containing block이 뷰포트 — transform 조상이 없는 한). D1의 "transform 금지"가 이 성질도 지킨다.
- **상태 전환**: `borderRadius`·`boxShadow`는 **transition에 넣지 않는다**(패널 transition 선언은 `width var(--transition-peek-open|close)` 하나 — 토큰 값 자체는 `<duration> <curve>`이고 속성명은 선언 쪽에 있다, X5). `pending → open`에서 즉시 둥글고 그림자가 켜진 채 폭이 커지고, `closing → idle`에서 폭이 56에 닿은 뒤 즉시 꺼진다(56px 레일에서 1프레임 각져도 보이지 않는다). `open → pinning`에서는 즉시 각지고 그림자가 꺼진다 — 고정 사이드바는 본문과 헤어라인으로만 갈라지는 3단 구조(M2 R7)이기 때문이다. pin 순간 모서리 4px 남짓이 각지는 변화는 수용하고 6-9에서 실물 판정한다.
- **Phase 45a 규약**: 두 속성 모두 키를 항상 두고 값만 바꾼다(`borderRadius: peekCard ? '0 R R 0' : 0`(R = `${DRAWER_RADIUS}px`) · `boxShadow: peekCard ? 'var(--drawer-shadow)' : 'none'`, `peekCard = collapsed && (phase === 'open' || phase === 'closing')` = D6의 `peeking`과 같은 식).
- **밝기 서열(M2 R7)** 불변: 패널 배경은 `--bg-sidebar` 그대로. 그림자가 peek 중에만 생겨 "지금은 떠 있는 상태"를 알린다.

### D3 — 타이밍 (확정)
펼침 200ms · 접힘 160ms · `cubic-bezier(0.33, 0, 0.2, 1)`. 토큰 `--transition-peek-open` · `--transition-peek-close`(`globals.css:250` 옆). `--transition-normal` 불변.
**reduced-motion 규칙은 넣지 않는다(N1)** — 앱 전체 0건이고 고정 토글도 무시하며, CLAUDE.md Phase 64 "판별용 `@media` 금지 — 허용은 `(hover: hover)` 하나뿐"과 문면 충돌. 폴백 타이머(D4)는 탭 비활성 대비로 어차피 둔다.

### D4 — 상태기계: 순수 리듀서 `lib/sidebarPeek.ts` + 타이머 훅 `hooks/useSidebarPeek.ts` (V8·V9·V10·V11·V12·V13 반영)
```ts
export type PeekSection = 'my' | 'share' | 'recent';
export type PeekPhase = 'idle' | 'pending' | 'open' | 'closing' | 'pinning';
export interface PeekState {
  phase: PeekPhase;
  section: PeekSection | null;
  holds: number;       // 닫힘 보류 카운터 — phase와 독립으로 산다(G5)
  inside: boolean;     // 포인터가 패널 안인가 — railEnter·railClick·panelEnter가 true, panelLeave가 false, 훅의 재판정(V12)이 덮어쓴다
  fresh: boolean;      // open이 pending/idle에서 왔는가(peekIn 1회 재생용, V13) — closing→open은 false · idle 진입 시 false(W3)
  pendingSeq: number; // railEnter마다 +1 — open 타이머 effect의 deps(W1)
  leaveSeq: number;   // panelLeave·setInside(false)·release(→0)마다 +1 — close 타이머 effect의 deps(W1)
  via: 'hover' | 'touch' | null; // 어떻게 열렸나(W6) — railClick의 pointerType이 mouse·pen이 아니면 touch
}
/** ⚠ V10 — 리사이즈 드래그(Sidebar `dragging` prop)는 리듀서와 무관하다(transition 스타일만). 여기의 dragKind는 DnD(useDragKind)
 *  ⚠ Y4 — ctx는 리듀서 인자가 아니라 **이벤트 페이로드**로 싣는다: reducePeek(state, event). 판정 기준은 '디스패치한 순간의 값'이고,
 *  React 18의 useReducer는 리듀서를 렌더 시점에 돌리므로 드래그 시작과 같은 배치에 든 railEnter는 렌더 시점 dragKind로 뒤집힐 수 있다. */
type DragKind = null | 'problem' | 'problems' | 'folder';   // import 0 — dnd.tsx 사본(의도적 이중)
export type PeekEvent =
  | { type: 'railEnter'; section; dragKind }   // idle·pending → pending (dragKind===null — 레일은 collapsed일 때만 렌더되므로 collapsed는 싣지 않는다). inside=true · **pendingSeq+1**(W1 — pending→pending 섹션 교체도 타이머 재시작)
  | { type: 'railLeave' }            // pending → idle (다른 phase에서는 무시). 훅: open 타이머 해제(V11)
  | { type: 'openTimer' }            // pending → open (fresh=true)
  | { type: 'railClick'; section; pointerType } // idle·pending → open 즉시 (fresh=true, **inside=true** — V9 · via = mouse|pen ? 'hover' : 'touch' — W6) / open → 무시
  | { type: 'panelEnter' }           // inside=true · closing → open (fresh=false)
  | { type: 'panelLeave' }           // inside=false (상태만 — 타이머는 훅이 needsCloseTimer로)
  | { type: 'setInside'; inside }    // 훅의 재판정 결과(V12 — release·드래그 종료 뒤 elementFromPoint)
  | { type: 'closeTimer' }           // open && holds===0 && !inside → closing
  | { type: 'panelTransitionEnd' }   // closing → idle (그 외 무시 — ⚠ pinning에서도 무시: V8)
  | { type: 'asideTransitionEnd' }   // pinning → idle (그 외 무시)
  | { type: 'switchSection'; section } // open && holds===0 → section 교체 (hold 중 보류, N3)
  | { type: 'hold' } | { type: 'release' }   // holds ± (0 미만 금지)
  | { type: 'pin' }                  // open·closing → pinning
  | { type: 'outsidePointerDown' }   // open → closing (**모든 포인터 종류** — W5 · holds 무시: 포인터가 이미 밖이다)
  | { type: 'itemSelected' }         // open && via==='touch' → closing (W6 — 마우스는 무시: 포인터가 안에 있으니 머문다)
  | { type: 'dragStart' }            // pending → idle (open이면 무변경 — hold는 훅의 dragKind effect가 별도로)
  | { type: 'collapsedChanged'; collapsed };    // false: pinning 아니면 idle / true: pinning이면 idle
```
불변식: `!collapsed && phase !== 'pinning' ⇒ idle` · `holds ≥ 0` · `phase ∈ {idle, pending} ⇒ section` 무의미 · `phase === 'idle' ⇒ fresh === false && via === null`(W3·W6).
파생 `needsCloseTimer(s) = s.phase === 'open' && s.holds === 0 && !s.inside` — **훅은 이 값이 참인 동안만** closeTimer(180ms)를 건다(panelLeave·release·드래그 종료를 한 곳에서 흡수).
**no-op은 같은 객체를 돌려준다(Y2)**: 무시되는 이벤트(틀린 phase의 `transitionEnd`·`railClick` in open·같은 값의 `setInside` 등)에 리듀서는 **입력 `state`를 그대로** 반환한다. React는 같은 참조면 리렌더를 건너뛴다 — 새 객체를 만들면 매번 리렌더되고, 그 리렌더가 아래 hold·재판정 effect를 다시 돌려 루프가 된다. 같은 이유로 **`leaveSeq`는 `inside`가 실제로 true→false로 바뀔 때만** 올린다(v3은 `setInside(false)`마다 올려 재판정마다 유예가 재시작됐다). 테스트가 `assert.strictEqual(reducePeek(s, e), s)`로 고정한다.
**타이머는 전부 phase 조건 effect로**(V11): open 타이머는 `phase === 'pending'` 동안만, **deps `[phase, pendingSeq]`**(W1) · closeTimer는 `needsCloseTimer` 동안, **deps `[needsCloseTimer, leaveSeq]`**(W1) · closeFallback은 `closing` 동안 · pinFallback은 `pinning` 동안 · switch intent는 arm된 헤더 위에 있는 동안. phase가 바뀌면 cleanup이 해제한다.
⚠ **W1 — deps를 `phase`만으로 두면 V11이 막히지 않는다**: My 레일 → 공유 레일로 옮기면 네이티브 `pointerout`(My)·`pointerover`(공유)가 **같은 task**에서 연달아 오고, React 18.3.1은 `railLeave`(→idle)·`railEnter`(→pending) 두 dispatch를 **한 렌더로 합친다**. 렌더된 phase는 `pending → pending`이라 effect가 재실행되지 않고, My에서 건 80ms 타이머가 그대로 발화해 **공유가 진입 20ms 만에 열린다**(V11이 막으려던 바로 그 증상). `pendingSeq`는 합쳐져도 +1 이상 바뀌므로 cleanup·재시작이 확실하다. close 쪽도 같은 구조(`panelLeave → panelEnter → panelLeave`가 한 task에 오면 유예가 첫 이탈 기준으로 짧아진다) — `leaveSeq`로 막는다. seq는 리듀서 상태라 **테스트로 고정**된다(§5-8).
⚠ **X2 — 발생 조건의 정밀화**: React의 `onPointerEnter/Leave`는 네이티브 `pointerout` **한 번**에서 떠남·들어옴을 함께 디스패치하므로(§1) 배칭은 그 둘이 **같은 네이티브 이벤트**에 들 때 확실하다. 그런데 My(194~232)와 공유(252~290) 레일 버튼 사이에는 **20px 틈**(섹션 패딩 8 + marginBottom 4 + 8)이 있어, 보통 속도로 옮기면 "My → 틈"과 "틈 → 공유"가 다른 프레임의 이벤트가 되고 그 사이에 렌더가 돌아 v2 설계로도 재시작된다. **한 프레임에 틈을 건너뛰는 빠른 이동**(≈1,200px/s 이상)에서만 재현된다 — 손으로 천천히 옮겨 보고 "W1은 없다"고 판정하지 말 것(6-3의 재현법 참조). seq는 속도와 무관하게 옳다.
상수: `PEEK_OPEN_DELAY 80` · `PEEK_CLOSE_GRACE 180` · `PEEK_SWITCH_INTENT 150` · `PEEK_MOVE_ARM_PX 4` · `PEEK_CLOSE_FALLBACK 220`(160+60) · `PEEK_PIN_FALLBACK 260`(200+60).
**`transitionend` 출처 둘(V8)**: 패널과 바깥 aside가 각자 자기 이벤트를 듣고 **서로 다른 이벤트**를 보낸다. `pinning` 중에도 패널 폭 transition이 끝날 수 있다(`open` 진입 200ms 안에 pin — 레일 y 213→헤더 28, 빠른 사용자면 가능 / `closing` 중 pin) — 한 이벤트로 합치면 그것이 `pinning → idle`을 조기 발동시켜 E1 겹침이 재현된다. 가드 둘(G1): **`e.target === e.currentTarget`** 과 `propertyName === 'width'`(자식 transition 11곳이 버블링, §1). **Y9 — 되감기·중단된 transition은 `transitionend`가 아니라 `transitioncancel`을 낸다**(closing 도중 panelEnter, open 도중 pin 등). 그 경로는 일부러 듣지 않고 폴백 타이머(220·260)가 받는다 — "끝 이벤트가 안 온다"를 버그로 오인해 `transitioncancel`까지 같은 이벤트로 묶지 말 것(V8의 조기 종료가 되살아난다).
**`inside` 재판정(V12)**: peek 안에서 DnD를 시작하면 DragOverlay(fixed, `pointer-events` 없음)가 **포인터 밑에 들어와** 패널 `pointerleave`가 나고 `inside=false`가 굳는다. 드롭 뒤 오버레이가 사라져도 정지 포인터에 boundary 이벤트가 다시 온다는 보장이 없다 → 폴더에 **성공적으로** 떨어뜨렸는데 180ms 뒤 닫힌다. 훅은 `dragKind`가 null로 돌아올 때와 `release` 뒤에 `panelRef.contains(document.elementFromPoint(lastPointer))`로 `setInside`를 보낸다. 오버레이 제거와 `dragKind=null`이 같은 커밋이라(§1 DnD 행) effect 시점의 `elementFromPoint`는 오버레이에 가로막히지 않는다.
**재판정 트리거(Y3)**: `release` 호출마다가 아니라 **가장자리**에서 한 번 — effect deps `[holds === 0, dragKind === null]`이 둘 다 참으로 바뀐 커밋에서만 `elementFromPoint`를 본다. `lastPointer`가 없으면(터치로 열고 한 번도 움직이지 않음) **보내지 않는다**(`inside`를 그대로 둔다 — 터치 peek은 railClick이 세운 true가 맞다). 결과가 현재 `inside`와 같으면 리듀서가 같은 객체를 돌려준다(Y2).
**좌표 기록 시점(W2)**: `document pointermove`는 **`phase !== 'idle'`(pending부터)** 부착하고, `railEnter` 핸들러가 이벤트의 `clientX/Y`로 `lastPointer`를 **먼저 채운다**. v2의 "peeking 동안"이면 `open` 진입 순간 `lastPointer`가 비어 있어 G3의 "open 진입 시 `armedAt` 기록"이 쓸 좌표가 없고, 착지 직후 헤더 hover가 이동 가드 없이 통과하거나(null=통과로 구현 시) 영영 막힌다(null=차단 시). 리스너는 **capture 단계**(`addEventListener('pointermove', h, { capture: true, passive: true })`) — W4와 같은 이유.

### D5 — hover 판정: `pointerenter/leave` + `pointerType ∈ {mouse, pen}` (정정)
- 레일 My·공유·최근 버튼에 `onPointerEnter/Leave`(`SidebarItem`에 두 prop 추가 — 현행 `onMouseEnter/Leave` hover 상태와 충돌 없음). 새 문제·검색·시트·열기 버튼에는 붙이지 않는다.
- 패널 루트에 `onPointerEnter/Leave`. React의 enter/leave는 fiber 조상 기준 — 패널 밖으로 삐져나온 fixed 메뉴(4종 전부 패널 자손, §1)도 "안"이다.
- **`document pointerleave`는 두지 않는다(E2)** — 패널이 조상이라 창 밖 이탈은 `panelLeave`로 오고, 패널 밖(유예 중) 이탈은 이미 closeTimer가 걸려 있다.
- 세 레일 버튼의 네이티브 `title` 제거 — `SidebarItem`에 `title?: string | false` prop(false면 미부착; 기본은 현행 `collapsed ? label : undefined`).
- **Y6 — 레일 버튼 전부 `aria-label={label}`**: 접힘에서는 라벨 텍스트가 렌더되지 않고(`:74`) 세 버튼은 `title`까지 빠지므로 접근 가능한 이름이 사라진다. `SidebarItem`이 `collapsed`일 때 `aria-label`을 단다(펼침은 텍스트가 이름이라 불필요).
- **Y10 — 섹션 헤더의 hover intent(`headerProps`)도 같은 `pointerType` 필터**를 쓴다. 터치 탭은 `pointerover/enter`를 먼저 내므로 필터가 없으면 150ms intent가 걸린 채 click의 즉시 전환과 겹친다(무해하지만 타이머가 남는다).

### D6 — 단일 활성 섹션 (기본안 · 실측 반영)
```ts
const peeking = collapsed && (phase === 'open' || phase === 'closing');
const myOpen     = peeking ? section === 'my'     : foldersOpen;
const shareOpen  = peeking ? section === 'share'  : shareOpenPinned;
const recentOpen_ = peeking ? section === 'recent' : recentOpen;
```
(`pinning`은 `collapsed === false`라 고정 상태값으로 읽힌다 — pin 순간 섹션 열림이 고정값으로 돌아가는 것은 D10의 의도.) 트리·미지정·휴지통 게이트 `:830·858·901`의 `!collapsed && foldersOpen`이 **`myOpen`** 으로 바뀐다.
peek 중 헤더 클릭(라벨·chevron)은 토글이 아니라 `switchSection`. 활성 섹션 헤더 클릭은 no-op. **hold 중(`holds > 0`)에는 전환도 보류(N3)** — 폴더 메뉴를 연 채 공유 헤더로 가면 My 트리가 언마운트되어 메뉴가 저절로 사라지던 것.
**섹션 전환(hover)** — intent 150ms + **이동 가드**: `armedAt = 마지막 포인터 좌표`를 **`open` 진입 시와 `switchSection` 직후**에 기록하고(G3), 헤더 `pointerenter`는 그 좌표에서 4px 이상 움직인 뒤에만 intent 타이머를 건다. 전환하면 위 섹션이 접히며 아래 헤더가 정지한 포인터 밑으로 미끄러져 들어와 연쇄 전환이 나는 것을 막는다. 클릭은 가드 없이 즉시. 전환 애니메이션 없음.
**착지(§1-1 실측)**: 레일 중심에서 열면 포인터는 활성 섹션 콘텐츠 첫 행(+3/+17/+31)에 놓이고, 히트 영역 전체로도 다른 섹션 헤더에 닿지 않는다. 검수는 **공유 레일 버튼 중심 271** 확인 하나로 축소(G12).

### D7 — 공유 하위 펼침을 Sidebar로 끌어올린다 · 세션 상태 (확정)
`ShareTree`를 제어 컴포넌트로: props `open` · `onToggleOpen` · `subOpen: {bazaar, received, sent}` · `onToggleSub(key)` · `headerProps?`(peek hover·chevronTitle). 내부 `useState` 4개(`:32-35`) 삭제, 기본값(false · true×3) 보존. `sent` ParentRow의 `onClick`(`:113`)도 `onToggleSub('sent')`. 영속 없음(Phase 63 D32).

### D8 — 닫힘 보류(hold) (기본안 · 보강)
`SidebarPeekContext`(`{ hold(): () => void }`, **기본값은 no-op release를 돌려주는 hold** — Provider 밖 방어 G9). 소비처는 `useEffect`로 hold하고 cleanup이 release한다(수동 쌍 금지 — 누수 차단).
1. **메뉴·피커**: `SortableFolderItem` `menuPos || iconPickerPos || movePos`, `DraggableProblemItem` `menuPos`.
2. **DnD**: Sidebar 최상단 `useDragKind()` effect 하나(G6) — non-null: `dragStart`(pending 취소) + hold / null: release + **`setInside` 재판정(V12)**. peek 안 최근 문항·폴더를 끌다 패널이 닫히면 draggable이 언마운트되어 드래그가 끊긴다.
3. 인라인 입력: 현재 없음(이름 변경은 `promptDialog` — `AppShell.tsx:426-430`). 규칙만: 생기면 `focus-within`을 hold로.
`holds`는 phase와 독립이다(G5): 고정 모드에서 메뉴를 연 채 접으면 트리 언마운트 cleanup이 release한다. 모달(이름 변경·삭제)이 뜨면 포인터가 모달로 가서 닫힌다 — 의도.

### D9 — peek 밖에서 시작된 드래그는 peek을 열지 않는다 (V10 정정)
`ctx.dragKind !== null`이면 `railEnter` 무시(⚠ 리사이즈 `dragging` prop이 아니다 — 그것은 `!collapsed`에서만 참이라 레일에서 항상 false). spring-loaded는 §9 후속. ~~유예 180ms 안에 main에서 드래그를 시작하면 hold로 peek이 유지~~ **삭제(W5)** — 드래그는 `pointerdown` 후 8px 이동(`AppShell.tsx:514`)에 시작하므로, 그 앞의 `pointerdown`이 이미 `outsidePointerDown`으로 `closing`을 만든다. `dragStart`는 closing을 되돌리지 않는다.

### D10 — 고정 펼침과의 관계 (개정)
- peek 중 헤더 `IconSidebar` 클릭 → `pin`(→ `pinning`) + `onToggle()` — 같은 핸들러라 배치되어 `pinning ∧ collapsed===true` 프레임이 없다. 바깥 aside가 56→width로 애니메이션되는 동안 패널은 이미 width라 화면상 패널은 그대로, 본문만 밀린다. 바깥 aside `asideTransitionEnd`(폴백 260ms) → `idle`. 섹션 열림은 고정 상태값으로 돌아간다.
- `pinning` 중 다시 접으면(`collapsedChanged(true)`) → idle(200ms 안 더블 토글 — 그 창의 겹침은 수용).
- 고정 펼침에서는 peek 비활성(레일이 없다). **(W8 정정)** `collapsedChanged(false)`는 `idle`에서 레일 맨 위 열기 버튼으로 **정상 도달한다**(pin 없음 → idle 유지, 무해). "pin 없이 도달 불가"는 `open·closing`에 한한 말이다 — 열기 버튼이 패널 안이라 누르려면 포인터가 패널에 있어야 하고, 그러면 `panelEnter`로 이미 `open`이다. 헤더 버튼 핸들러의 분기 조건은 **`phase ∈ {open, closing}` → `pin` + `onToggle()`, 그 외 → `onToggle()`**.
- ~~접기 직후 첫 pointermove 전 railEnter 무시~~ **삭제(E3)** — 토글 버튼은 펼침 헤더 우측(x≈230~247)이라 접힌 뒤 그 좌표는 main. 발생 경로 없음.

### D11 — 최근 문항: peek 중 `overflow: hidden` (기본안)
최근 섹션 래퍼(`:975`) `overflow: peeking ? 'hidden' : 'auto'`. `flex:1`이라 넘친 행은 푸터(`:999`) 경계선에서 잘린다. 행 개수 계산 없음. My 섹션(`:797`)은 peek 중에도 스크롤 유지.

### D12 — 최근 개수: 현행 조회 그대로 (확정 · AppShell 무변경)

### D13 — 레일 정리 (정정)
- `:824-828` My → 레일 버튼(hover D5 · click D15).
- 공유: 접힘일 때 레일 버튼 **`<IconShare size={18} />`**(기본 14 — E4) · `SidebarItem` 규격 · 래퍼는 **My와 같은 두 겹** — 섹션 div `padding '8px 8px'` + 안쪽 div `display:flex · justifyContent:center · marginBottom:4`(`:825` 사본). 펼침/peek일 때 제어형 `ShareTree`. ⚠ **X3**: v3의 "래퍼 `'8px 8px'`"만이면 슬롯이 54px(8+38+8)이 되어 최근 레일 중심이 **325**로 올라가 §1-1의 329·착지 +31이 틀어진다.
- 최근: 레일 버튼만. `slice(0,4)` 분기·`DraggableProblemItem collapsed` prop·점 분기(`:583-594`) 삭제(`grep -rnw` — 정의 `:536`·사용 `:987-990` 외 0).
- `IconShare` import(`:14`)는 현재 사용처 0 — 이번에 소비처가 생긴다.

### D14 — peek 중 title (확정 · 확장)
`IconSidebar` 버튼 title '사이드바 고정'. **chevron title도 peek 중 생략**(G8) — 활성 섹션에서 '접기'가 오해. `SidebarSectionHeader`에 `chevronTitle?: string | null` prop.

### D15 — 터치(태블릿)·키보드 (V9 정정)
- 터치: 레일 3버튼 `onClick` → `railClick`(idle·pending → 즉시 open **+ `inside=true`** · `via`는 click 직전 `pointerdown`의 `pointerType`으로 — `onClick`의 `MouseEvent`엔 pointerType이 없으므로 레일 버튼 `onPointerDown`에서 ref에 기록하고 **click에서 읽는 즉시 비운다** / open → no-op). ⚠ **X6 — `e.detail === 0`인 click은 무시**: 키보드 Enter·Space가 합성한 click이라 앞선 pointerdown이 없고, ref에 남은 낡은 값(또는 null)으로 via가 정해져 닫힘 경로가 엉뚱해진다. 아래 "키보드: 범위 밖"과 현행(레일 My 클릭 무동작)에도 맞는다. 터치는 `pointerType` 필터에 걸려 `railEnter`·`panelLeave`가 오지 않으므로 닫힘 경로는 **`outsidePointerDown`**(바깥 탭)과 **`itemSelected`**(W6, 아래) 둘이다. 마우스에서 80ms 안 클릭도 같은 경로(via='hover'). **open 상태의 마우스 클릭은 no-op 유지(N7)** — "클릭 = 고정"은 §9.
- **`outsidePointerDown` 배선(W4·W5)**: `document.addEventListener('pointerdown', h, true)` — **capture 단계 필수**. 버블이면 `stopPropagation` 30곳(§1 — 편집창 블록·FolderView 카드·ListView 행 등 탭하기 쉬운 자리 전부)에서 이벤트가 끊겨 **바깥 탭으로 안 닫힌다**. 판정은 `!panelRef.current.contains(e.target)`(메뉴·피커는 패널 DOM 자손이라 안). **포인터 종류 무관**: 마우스로 peek 밖(유예 180ms 안)을 누르는 것도 떠날 의사라 즉시 closing이 맞고, 분기가 없어야 D9 주석 같은 모순이 안 생긴다. 부착 조건 `phase ∈ {open, closing}`.
- **`itemSelected`(W6, 기본안)**: 터치로 연 peek은 포인터가 "떠나는" 사건이 없어 폴더·문항을 골라 화면이 바뀐 뒤에도 **본문 좌측 260px을 덮은 채 남는다**(바깥을 한 번 더 탭해야 닫힘). Sidebar가 선택 콜백 **9종**(`onSelectFolder`·`onSelectUnassigned`·`onSelectTrash`·`onSelectShareScope`·`onViewProblem`·`onEditProblem` + **v4 Y5: `onNewProblem`·`onSearch`·`onSheetImport`**)을 부르는 자리에서 `peek.itemSelected()`를 함께 보낸다. 리듀서가 `via==='touch'`일 때만 닫으므로 마우스 peek은 현행 설계 그대로(포인터가 안에 있어 머문다). 헤더 전환·폴더 펼침 chevron·⋯ 메뉴·`+ 새 폴더`는 선택이 아니라 보내지 않는다. **Y5 근거**: 터치 peek은 레이아웃이 펼침이라 섹션 1의 새 문제·검색·시트 가져오기가 peek 안에 보인다. 새 문제는 화면을 편집창으로 바꾸고, 검색·시트 가져오기는 모달(900·9000)을 띄우는데 모달을 닫은 뒤에도 peek이 본문을 덮고 남는다. 설정(`:1020` `router.push`)은 라우트 이동으로 Sidebar가 언마운트되므로 보낼 필요가 없다.
- 키보드: 범위 밖(포커스로 peek을 열지 않는다).

### D16 — 성능 (기본안)
`pending` 80ms 동안 선마운트하지 않는다. 단일 활성이라 동시 마운트는 고정 펼침보다 작다. 첫 프레임 끊김이 보이면 선마운트(opacity 0)로.

---

## 4. 현행 규약 충돌 점검

| 규약 | 이번 계획 | 판정 |
|---|---|---|
| **M2 F** 자동접힘·강제 펼침 금지(`AppShell.tsx:762-767`) | `collapsed` 읽기만. 본문 폭 불변 | 충돌 없음 — CLAUDE.md에 "별개 층" 1항(§5-8) |
| Phase 62 D18 핸들을 overflow 상자 안에 두지 말 것 | 핸들 루트 그대로. overflow는 패널로 이동 | 준수 |
| Phase 62 폭 세션 상태·localStorage 금지 | 새 저장 없음 | 준수 |
| Phase 63 D21 DndContext 하나 · D34 dndId | 불변. hold만 추가 | 준수 |
| Phase 63 D32 공유 열림 세션 상태 | 하위까지 세션 | 준수 |
| M2 R7 3단 밝기 서열 | 패널 배경 `--bg-sidebar` · 그림자는 peek 중만 | 준수 |
| M7 K 섹션 헤더 규격 | 스타일 불변, props만 | 준수 |
| Phase 45a 조건부 longhand 구멍 | 키 상시·값만 변경(D1·D2) | 준수 |
| Phase 64 `@media` 규약 | reduced-motion 제외(N1) | 준수 |
| M4 아이콘 규약 | 신규 0 · IconShare 18(레일)/16(헤더) | 준수 |
| "absolute로 바꾸면 안의 fixed 모달이 갇힌다"(2026-08-18) | peek 중 메뉴 4종 실효 z 80 — D1에 기록 | 알고 둠 |
| ShareButton 바깥클릭 배경 z 40 | aside z는 `idle` 외에만 → 고정 모드 동작 불변 · 팝오버 중 peek 안 열림(정상) | 준수 |

---

## 5. 구현 항목

### 5-1. `lib/sidebarPeek.ts` (신규 · import 0)
D4 타입 + `reducePeek(state, event): PeekState`(ctx는 이벤트 페이로드 — Y4 · no-op은 같은 객체 — Y2) + `needsCloseTimer(state)` + `INITIAL_PEEK_STATE` + 상수 6종. `DragKind` 타입은 `dnd.tsx`를 import하지 않고 로컬 union으로(import 0 규약 — `listColumns` verifyRank ↔ `VERIFY_VERDICT_META` 전례).

### 5-2. `hooks/useSidebarPeek.ts` (신규)
`useReducer` + phase 조건 effect 타이머 5(open·close·closeFallback·pinFallback·switch) + `lastPointer`/`armedAt`/`panelRef` ref.
반환: `{ state, peeking, expandedLook, renderCollapsed, railProps(section), panelProps, asideProps, headerProps(section), hold }`.
- `panelProps`: `ref` · `onPointerEnter/Leave`(pointerType 필터) · `onTransitionEnd`(G1 가드 → `panelTransitionEnd`).
- `asideProps`: `onTransitionEnd`(G1 가드 → `asideTransitionEnd`).
- `railProps(section)`: `onPointerEnter/Leave`(필터) · `onClick → railClick` · `title: false`.
- effect: `collapsed` 변화 → `collapsedChanged` · `dragKind` 변화 → `dragStart`+hold / release+`setInside`(elementFromPoint) · `release` 뒤에도 `setInside` · **`phase !== 'idle'` 동안 `document pointermove`**(좌표, `{capture:true, passive:true}` — W2·W4) · **`phase ∈ {open, closing}` 동안 `document pointerdown`**(capture — W4·W5). open 타이머 deps `[phase, pendingSeq]` · close 타이머 deps `[needsCloseTimer, leaveSeq]`(W1). 언마운트 시 타이머 전부 해제.
- 반환에 `itemSelected()` 추가(W6). `railProps(section)`의 `onPointerEnter`는 `lastPointer`를 이벤트 좌표로 먼저 채우고(W2), `onPointerDown`은 `lastRailPointerType` ref를 기록한다(W6).
- **식별자 안정(Y2)**: `hold`는 `useCallback(() => { dispatch({type:'hold'}); return () => dispatch({type:'release'}); }, [])` — deps 없음(dispatch는 안정). `SidebarPeekContext`의 value는 `useMemo(() => ({ hold }), [hold])`. 소비처 effect의 deps는 **열림 불리언**(`[!!(menuPos || iconPickerPos || movePos)]`)이지 좌표 객체나 `hold`가 아니다 — 좌표가 바뀔 때마다 release→hold가 돌면 holds가 0을 스치며 `leaveSeq`·재판정이 흔들린다.
- **재판정 effect(Y3)**: deps `[state.holds === 0, dragKind === null]` — 둘 다 참으로 **바뀐** 커밋에서만, `lastPointer`가 있을 때만 `setInside`.

### 5-3. `components/layout/Sidebar.tsx`
1. aside 두 겹화(D1) — 바깥 `position: relative` 상시 · `zIndex` phase 조건 · `asideProps` · 안쪽 패널 폭·transition(`width`만)·**`borderRadius`·`boxShadow`(D17, 키 상시)** · `panelProps`. `DRAWER_RADIUS`는 `../ui/dialogStyles`에서 import.
2. 콘텐츠 래퍼(D2) — `width: phase ∈ {open, closing, pinning} ? width : '100%'` · `animation: phase === 'open' && fresh ? 'peekIn 90ms' : 'none'`(W3·W7). · **`display:flex · flexDirection:column · height:100% · minHeight:0`**(Y1 — 현 aside의 flex column을 그대로 이어받는다).
3. `collapsed` 분기 **전부**를 `renderCollapsed`로 — `:766-767`(헤더 justify·padding) · `:771`(Wordmark) · `:781`(토글 title → D14) · `:788`(섹션1 패딩) · `:789-791`(SidebarItem `collapsed` 3개) · `:797`(My 패딩) · `:802`(My 헤더/레일) · **`:830·858·901`**(트리·미지정·휴지통 게이트 → `myOpen`) · `:961`(공유) · `:975-986`(최근) · `:1001-1003`(푸터) · `:1021`(아바타) · `:1068-1080`(로그인 버튼, `:1071` 패딩 포함).
4. 섹션 열림(D6) · 헤더 `onToggle` → `peeking ? switchSection : 토글` · `headerProps` 전달.
5. 공유 상태 끌어올리기(D7): `shareOpen`(false) · `shareSub`({bazaar:true, received:true, sent:true}).
6. 레일 정리(D13) · 레일 3버튼 `railProps`.
7. 최근 overflow(D11).
8. `SidebarPeekContext.Provider`(hold) + `useDragKind()` → 훅에 전달(D8-2).
9. `SortableFolderItem`·`DraggableProblemItem` hold effect(D8-1).
10. 헤더 `IconSidebar`: `phase ∈ {open, closing}`이면 `pin` 후 `onToggle()`(W8) · title(D14). `DraggableProblemItem collapsed` 삭제.
11. `SidebarItem` props 추가: `title?: string | false` · `onPointerEnter?` · `onPointerLeave?` · `onPointerDown?` · collapsed일 때 `aria-label={label}`(Y6).
12. 선택 콜백 **9종** 호출부에 `peek.itemSelected()`(W6 · Y5 — 새 문제·검색·시트 가져오기 포함) — 콜백 prop 자체는 불변(래핑은 Sidebar 안에서).
13. ~~콘텐츠 래퍼 `width`·`animation`~~ → ②로 통합(v3에서 같은 내용이 두 번 적혀 있었다 — ②가 진실).
14. 공유 레일 래퍼를 My 레일(`:825`)과 같은 두 겹으로(X3).
15. 레일 3버튼 `onClick`: `e.detail === 0`이면 무시 · pointerType ref는 읽고 비움(X6).
16. 바깥 aside와 패널의 idle transition을 같은 식 하나에서 만든다(`const idleTransition = dragging ? 'none' : 'width var(--transition-normal)'`) — Y7.

### 5-4. `components/layout/ShareTree.tsx` — D7 제어형. 렌더 트리 불변.
### 5-5. `components/layout/SidebarSectionHeader.tsx` — `onPointerEnter?` · `onPointerLeave?`(루트 div) · `chevronTitle?: string | null`(undefined면 현행). 헤더 주석에 "peek 중 onToggle은 섹션 전환 — 호출부 책임".
### 5-6. `components/layout/AppShell.tsx` — **무변경**.
### 5-7. `app/globals.css` — `:250` 옆 `--transition-peek-open: 200ms cubic-bezier(0.33,0,0.2,1)` · `--transition-peek-close: 160ms cubic-bezier(0.33,0,0.2,1)`. reduced-motion 없음(N1). `peekIn` 재사용.
### 5-8. 테스트 · 문서
- `tests/sidebarPeek.test.mjs` + `package.json` `"test:peek"`(test:chrome 형식). 케이스(약 36 — v3 +7 · v4 +7):
  스침(enter→leave<80 → idle) · 열림(fresh=true) · **railClick 즉시 열림 + inside=true**(V9) · open에서 railClick 무시 · panelLeave 뒤 needsCloseTimer 참 · closeTimer → closing · **closing 중 panelEnter → open(fresh=false)**(V13) · hold 중 needsCloseTimer 거짓 → release 후 참 · **open 뒤 hold → leave → 안 닫힘 → release → 닫힘** · idle에서 hold/release 카운터 유지 · holds 음수 금지 · **dragKind 중 railEnter 무시**(V10) · pending 중 dragStart → idle · **setInside(true) 뒤 needsCloseTimer 거짓**(V12) · pin → pinning → **asideTransitionEnd → idle** · **pinning 중 panelTransitionEnd 무시**(V8) · pinning 중 collapsedChanged(true) → idle · panelTransitionEnd in open 무시 · `!collapsed` 불변식 · switchSection · **hold 중 switchSection 무시**(N3) · outsidePointerDown · **v3 추가**: pending 중 다른 섹션 railEnter → `pendingSeq` 증가·section 교체(W1) · railLeave→railEnter 연속 dispatch 뒤 `pendingSeq`가 이전과 다름(W1 — 배칭 시나리오를 리듀서 수준에서 고정) · panelLeave마다 `leaveSeq` 증가(W1) · closing→idle 뒤 `fresh===false`·`via===null`(W3·W6) · 두 번째 peek(`idle→pending→open`)에서 fresh=true(W3) · railClick(pointerType 'touch') → via='touch' → itemSelected → closing(W6) · railClick('mouse') → via='hover' → itemSelected 무시 · holds>0에서도 outsidePointerDown → closing(W5). · **v4 추가**: 무시 이벤트 7종(`railClick` in open · `panelTransitionEnd` in open·pinning · `asideTransitionEnd` in open · `switchSection` with holds>0 · `railLeave` in open · `closeTimer` with inside)에 **같은 객체 반환**(Y2) · `setInside(false)` 두 번째는 같은 객체·`leaveSeq` 불변(Y2) · `setInside(true)`가 inside를 true로 바꿀 때 `leaveSeq` 불변(Y2) · `railEnter{dragKind:'problem'}` 무시 → 같은 객체(Y4) · `collapsedChanged{collapsed:false}` in pending → idle · `collapsedChanged{collapsed:true}` in pinning → idle(Y4 페이로드) · `pin` in pending 무시(버튼이 없다 — 같은 객체).
- **CLAUDE.md** 핵심 패턴 1항: "사이드바 hover peek(Phase 67): `collapsed`와 별개 층 — M2 F 위반 아님 · 패널은 `width` 애니메이션(transform·clip-path 금지: 비포털 fixed 메뉴 4종) · `pinning` 단계가 pin 전환 200ms의 z 80을 지킨다(상시 80은 ShareButton 배경과 충돌) · `transitionend`는 출처 둘(패널/aside)로 갈라 받고 `target===currentTarget`(자식 transition 11곳 버블링) · `ctx.dragKind`는 DnD이지 리사이즈 `dragging`이 아니다 · 터치는 `railClick`이 `inside`를 세운다 · DnD 뒤 `inside`는 elementFromPoint로 재판정(DragOverlay가 포인터 밑) · **타이머 effect deps는 phase가 아니라 seq(React 18 배칭 — pending→pending 재시작 누락)** · **document 리스너는 capture 단계(stopPropagation 30곳)** · peekIn 조건은 `phase==='open' && fresh`(같은 DOM 노드라 값이 바뀌어야 재생) · 터치 peek은 항목 선택 시 닫힘 · 섹션 열림은 peek 중 단일 활성 · hold 3종 + hold 중 전환 보류 · 공유 하위 상태는 Sidebar 소유 · reduced-motion 규칙 없음 · peek 패널 모양은 드로어 카드 규격(`DRAWER_RADIUS`·`--drawer-shadow`)을 `open·closing`에만, transition 없이 · **콘텐츠 래퍼가 flex column을 이어받는다(안 그러면 푸터 고정·최근 잘림이 무너진다)** · **`hold`는 안정 식별자, no-op 이벤트는 같은 state 객체(리렌더 루프 차단)** · ctx는 이벤트 페이로드 · 레일 슬롯은 My 구조 사본(58px)".
- `docs/roadmap.md` Phase 67 절 · 확정본 `docs/phasedocs/`.

### 5-9. 건드리지 않는 것
`AppShell.tsx` · `useDrawerResize`·`DrawerResizeHandle` · `dnd.tsx` · FolderView·ListView · PhoneShell·MiniShell · 메뉴 컴포넌트 자체 · `lib/firestore.ts` · 헤더 규격 · 워드마크 · 푸터.

---

## 6. 검증 계획

**6-1 회귀(고정 펼침 = 현행)** — `!collapsed` 스크린샷 대조(두 겹화 전후 픽셀 동일) · **고정 토글 0.2s 애니메이션 중 아이콘이 현행처럼 미끄러지는지**(D2 래퍼 100%) · 리사이즈 드래그 · 폴더 DnD·문항 드롭(미지정·휴지통) · 공유 열림/하위 토글 · 최근 스크롤 · 공개 뷰어 임베드에서 공유 팝오버 열린 채 사이드바 클릭 → 팝오버 닫힘(현행 유지). · **고정 토글 중 aside(본문 밀림)와 패널 우변이 같이 움직여 틈이 비치지 않음**(Y7) · 두 겹화 뒤에도 **푸터가 바닥에 붙어 있고 긴 폴더 트리가 My 섹션 안에서 스크롤**(Y1).
**6-2 레일** — 7개 순서 · 점 없음 · My·공유·최근 title 없음 · 공유 아이콘 18 · 새 문제·검색·시트 hover에 peek 없음.
**6-3 peek 기본** — 3개 각각 80ms 뒤 펼침 · 해당 섹션만 · **공유 레일 버튼 중심 y=271**(§1-1) · **레일을 세로로 빠르게 훑을 때 다른 섹션이 이르게 열리지 않음**(V11 · W1 — **손으로는 재현이 불안정하다(X2)**. CDP `Input.dispatchMouseEvent`로 My 중심(y 213)에 `mouseMoved` → 50ms 대기 → **한 번의 `mouseMoved`로 공유 중심(y 271)** → 공유가 그 시점부터 ≥80ms 뒤에 열리는지 `performance.now()` 로그로. 같은 절차를 seq 없이 돌리면 30ms 안팎에 열려야 재현법이 맞는 것이다) · 떠나면 180ms 뒤 접힘 · 본문 리플로 0(Performance 패널).
**6-4 곡선·체감** — 200/160 판정(덕수) · 닫힘 중 재진입 되감기 **깜빡임 없음**(V13) · peekIn 90ms가 **두 번째·세 번째 peek에서도 재생**(W3) · **D17 모양: 우측 위·아래 모서리 10px 곡선 · 오른쪽 그림자가 본문 위로 번짐 · 좌측 모서리 각짐 · 헤더 워드마크·푸터가 곡선에 맞게 잘림 · 헤어라인이 곡선을 따라 가늘어지며 사라짐(정상 — X4) · 닫힘 끝에서 각진 1프레임이 안 보임 · Chrome 세로 탭 hover 펼침과 나란히 놓고 인상 비교(덕수)** · 닫힘 뒤 새 문제·검색·시트 아이콘 150ms 슬라이드 꼬리 판정(N6).
**6-5 섹션 전환** — hover 150ms · 정지 상태 연쇄 없음 · **착지 직후(포인터 정지) 헤더 전환 없음, 4px 움직인 뒤에만 intent**(W2) · 클릭 즉시 · 활성 헤더 클릭 no-op · 메뉴 연 채 다른 헤더 hover → 전환 안 됨.
**6-6 상태 기억** — My 새로고침 후 동일 · 공유 하위 peek 재진입·고정 전환 동일, 새로고침 후 기본값.
**6-7 최근** — 공간만큼 · 창 낮추면 푸터 선에서 잘림·스크롤 없음 · 고정에선 스크롤. · peek 중에도 푸터가 패널 바닥에 붙어 있음(Y1).
**6-8 hold** — ⋯ 메뉴/피커/이동 픽커/⋮ 메뉴 열고 밖으로 → 안 닫힘, 닫고 밖이면 닫힘 · 최근 문항 → 본문 폴더 카드 드롭 · **peek 안 폴더로 최근 문항 드롭 → 드롭 뒤 peek 유지**(V12) · peek 안 폴더 순서 드래그 · 메뉴 좌표 현행과 동일(transform 없음) · peek 중 메뉴가 보임(실효 z 80).
**6-9 가장자리** — peek 중 사이드바 버튼 → 고정, 전환 200ms 동안 패널 우측 안 잘림(E1) · pin 순간 모서리·그림자가 꺼지는 변화가 거슬리지 않는지(D17) · peek 중 폴더 ⋯ 메뉴·이동 픽커가 둥근 패널 경계 밖에서도 잘리지 않음(D17 클리핑) · **open 진입 직후(200ms 안) pin → 패널 잘림 없음**(V8) · 본문 드래그를 레일로 → peek 없음 · 이름 변경 모달 → 닫힘 · 창 밖 이탈 → 닫힘 · z: 우측 단·댓글·Row1 위, 모달·DragOverlay·Row 2 풀다운 아래 · 공개 뷰어 공유 팝오버 열린 동안 레일 hover → **peek 안 열림(정상)** · iPad **탭 열기 → 유지됨(자동 닫힘 없음)** → 밖 탭 닫기 · **편집창 블록·FolderView 카드처럼 pointerdown을 막는 자리를 탭해도 닫힘**(W4 — DevTools 터치 에뮬레이션 가능) · **peek 안 폴더 탭 → 폴더뷰로 이동하며 peek 닫힘**(W6) · 마우스 peek에서 폴더 클릭 → 이동하고 peek 유지(W6 대조) · 마우스 peek 유예 중 본문 클릭 → 즉시 닫힘(W5). · **레일 My에 Tab 포커스 후 Enter → peek 안 열림**(X6) · **터치 peek에서 새 문제 탭 → 편집창으로 가며 peek 닫힘 · 검색 탭 → 오버레이를 닫은 뒤 peek이 남아 있지 않음**(Y5) · VoiceOver/DevTools 접근성 트리에서 레일 3버튼 이름이 My·공유·최근 문항(Y6) · **peek 안 ⋯ 메뉴를 열어 둔 채 5초 — React Profiler에서 커밋이 계속 쌓이지 않음**(Y2 루프 감시).
**6-10 빌드** — `npm run test:peek` · dev 종료 → `npm run build` → dev 재시작(규칙 5).

---

## 7. 위험·트레이드오프

- **두 겹화 회귀**: aside 직속 자식은 헤더·섹션1·My·공유·최근·푸터(접힘 5/펼침 6)뿐. aside `overflow:hidden`에 기대던 것은 드래그 중 소스 항목 클리핑뿐이고 패널로 옮겨도 같다. 그립 `left:-12`를 자르는 것은 섹션 div `:797`의 `overflow:auto`라 무영향. 6-1 픽셀 대조.
- **섹션 전환 연쇄**: 이동 가드가 핵심. `armedAt`을 open 시점에도 세운다.
- **`transitionend` 오발**: 자식 11곳 버블링 + 출처 2 — G1 가드와 이벤트 분리 없이는 closing이 150ms에 끝나거나 pinning이 조기 종료된다.
- **`inside` 오판**: DragOverlay가 포인터 밑에 들어온다 — 재판정 없이는 드롭 성공 뒤 닫힌다.
- **pinning 고착**: `asideTransitionEnd` 누락 → 폴백 260ms. 고착돼도 증상은 "고정 모드에서 aside가 스태킹 컨텍스트"뿐.
- **비포털 fixed 메뉴**: 누가 peek을 `transform`으로 "최적화"하면 메뉴 좌표 전부 깨짐 — CLAUDE.md 항목.
- **hold 누수**: effect cleanup 형태로만.
- **배칭과 타이머(W1)**: 타이머를 phase에 묶는 코드는 "같은 phase로 되돌아오는 합쳐진 전이"를 못 본다. 새 타이머를 더할 때도 seq를 함께 둘 것 — CLAUDE.md 항목에 포함.
- **capture 리스너(W4)**: capture `pointerdown`은 편집창 등 모든 곳의 pointerdown보다 **먼저** 돈다. 핸들러는 dispatch 하나만 하고 `preventDefault`·`stopPropagation`을 **절대 부르지 않는다**(부르면 CodeMirror 포커스·dnd-kit 활성화가 깨진다).
- **리렌더 루프(Y2·Y3)**: hold effect → release → 재판정 dispatch → 리렌더 → (식별자가 불안정하면) effect 재실행 → release … 순환이 가능한 구조다. 막는 장치는 셋이 함께다 — `hold` 안정 식별자 · no-op 같은 객체 반환 · 재판정은 가장자리에서만. 하나라도 빠지면 메뉴를 연 채로 CPU가 도는 증상이 나고 겉으로는 "가끔 버벅인다"로만 보인다.
- **래퍼 구조(Y1)**: 두 겹화에서 가장 조용히 깨지는 자리다 — 폴더·최근 문항이 적은 계정(비로그인 계측 포함)에서는 푸터 위치가 우연히 맞아 보인다. S3 검수는 **폴더가 화면을 넘치는 계정**으로 할 것.
- **발견성**: hover 전용. 레일 클릭은 peek 유지일 뿐 고정 아님(N7) — 후속 후보.
- **My 트리 스크롤 위치**: peek마다 리마운트라 맨 위로. 후속.
- **닫힘 꼬리 150ms(N6)**: 실물 판정.
- **극단 창**: 드로어를 0.9vw까지 넓히면 100·110이 peek을 덮는다 — 기록만.

---

## 8. 커밋 가이드 (CLI)

| 스텝 | 내용 |
|---|---|
| S1 | `lib/sidebarPeek.ts`(pinning · needsCloseTimer · inside/fresh · **pendingSeq/leaveSeq · via** · 이벤트 분리) + `tests/sidebarPeek.test.mjs`(~36 · no-op 같은 객체 · 페이로드 ctx) + `test:peek` |
| S2 | `globals.css` 토큰 2 · `ShareTree` 제어형 + Sidebar 상태 끌어올리기 · `SidebarSectionHeader`·`SidebarItem` props(동작 불변 — 6-1 회귀 먼저) |
| S3 | Sidebar 두 겹화(D1·D2) — **래퍼 flex column(Y1)** · idle transition 공유(Y7) · 공유 레일 두 겹 래퍼(X3). peek 없음, 화면·토글 애니메이션 동일. 픽셀 대조는 **폴더가 넘치는 계정**으로 |
| S4 | `useSidebarPeek`(seq deps · pending부터 capture pointermove · capture pointerdown) + 레일 정리(D13·E4) + peek 배선(D5·D6·D10·D11·D14·D15 · itemSelected) · `hold` 안정 식별자·재판정 가장자리(Y2·Y3) · aria-label(Y6) · keyboard click 무시(X6) · itemSelected 9종(Y5) |
| S5 | hold(D8) + DnD 가드(D9) + `setInside` 재판정 + hold 중 전환 보류 |
| S6 | 문서 — CLAUDE.md 1항 · roadmap · phasedocs 확정본 |

커밋 메시지 `Phase 67 S1: …`. push는 덕수가 VSCode에서.

---

## 9. 건드리지 않는 것 · 후속 후보

건드리지 않음: 고정 펼침 동작 · 폭 조절 · DnD 구조 · FolderView/ListView · 모바일 · Firestore·API.
후속: ① spring-loaded(드래그 중 레일 hover) ② 키보드 peek ③ My 트리 스크롤 위치 기억 ④ 레일 클릭/더블클릭 = 고정 ⑤ reduced-motion(앱 전역으로 할 때 함께).

---

## 10. 검증 턴 기록 (독립 리뷰 에이전트, 2026-09-16)

v2 초안을 레포에 재대조한 결과 18건 — 인용 행 번호는 전수 일치(V1), CLAUDE.md 위반 0(V18). 반영한 것:

| # | 판정 | 내용 | 반영 |
|---|---|---|---|
| V2 | GAP | §5-3 `collapsed` 분기 목록에 `:771·781·789-791·830·858·901·961·1071` 누락 — 특히 `:830/858/901`은 D6 `myOpen`이 대체해야 할 게이트 | 5-3 ③ |
| V3 | GAP | "80 위는 모달뿐"이 아니다 — Row 2 풀다운 1000·3000 · CM 툴팁 10200(비모달·일시) · 드로어 0.9vw 극단 | §1 · D1 |
| V4 | **ERROR** | ShareButton 배경(40)은 idle의 레일(z auto)을 **덮는다** → 팝오버 중 peek이 안 열린다(정상). "peek이 배경 위"는 유예 중 클릭에만 | D1 · 6-9 |
| V5 | OK | peek 중 메뉴 4종 실효 z 80(스태킹 컨텍스트 규약) | D1 · §4 |
| V7 | GAP | transition 인벤토리 +7곳 | §1 |
| V8 | GAP | `transitionEnd` 한 이벤트면 `pinning` 중 패널 폭 종료가 조기 idle → E1 재현 | D4 이벤트 분리 |
| V9 | **ERROR** | 터치: `railClick`이 `inside`를 안 세우면 열자마자 180ms 뒤 닫힘 | D4 · D15 |
| V10 | **ERROR** | `ctx.dragging`이 리사이즈 prop으로 읽히면 D9 무효(레일에서 항상 false). 테스트 시나리오도 모순 | D4 ctx `dragKind` · D9 · 5-8 |
| V11 | GAP | open 타이머 해제 규칙 미기재 — 세로 훑기에서 이른 open | D4 타이머 effect |
| V12 | GAP | DragOverlay가 포인터 밑 → `inside=false` 고착 → 드롭 성공 뒤 닫힘 | D4 `setInside` · D8-2 · 6-8 |
| V13 | GAP | `phase==='open'` 조건 animation은 되감기마다 재생 | D2 `fresh` |
| V16 | GAP | 래퍼 상시 고정폭은 고정 토글 애니메이션을 바꾼다(스크린샷으로 안 잡힘) | D2 `100%` 갈래 · 6-1 |
| V6·V14·V15·V17 | OK | 메뉴는 패널 fiber 자손 · pin+onToggle 배치 · aside stretch 높이·핸들·그립 클리핑 무영향 · SidebarItem 확장 무충돌 | 기록 |

---

## 11. web 재검증 기록 (2026-09-16, `0b9229b` clone · dnd-kit 6.3.1 dist · React 18.3.1)

v2의 인용(§1 행 번호 · IconShare 14 · `peekIn` `:787` · CLAUDE.md `:244` `@media` 규약 · `:1022` 스태킹 규약 · ShareButton `:58` · PointerSensor `:514` · DragOverlay `:1048` · import 0 전례 `listColumns.ts:165` · 새 커밋 범위 무관)은 **전수 일치**. V1~V18 반영도 타당하다. 설계를 다시 따라가며 찾은 것:

| # | 판정 | 내용 | 반영 |
|---|---|---|---|
| W1 | **ERROR** | open 타이머를 `phase` effect에 묶으면 My→공유 이동의 `railLeave`·`railEnter`가 React 18 배칭으로 한 렌더에 합쳐져 phase가 `pending→pending` → effect 미재실행 → My의 80ms 타이머가 공유를 이르게 연다. **V11이 막는다던 증상이 그대로 남는다.** close 쪽도 같은 구조 | D4 `pendingSeq`·`leaveSeq` · 5-2 deps · 테스트 3 · 6-3 |
| W2 | **ERROR** | `document pointermove`가 "peeking 동안"만이면 `open` 진입 순간 좌표가 없다 → G3 `armedAt` 기록 불가 → 착지 직후 헤더 전환 가드가 무력(또는 영구 차단) | D4 · 5-2 — pending부터 부착 + railEnter 좌표 선기록 · 6-5 |
| W3 | **ERROR** | `animation: fresh ? …`는 fresh가 idle에서 안 꺼져 **두 번째 peek부터 재생 안 됨**(같은 DOM 노드 — 값이 바뀌어야 재시작) | D2 조건 `phase==='open' && fresh` · 리듀서 idle에서 fresh=false · 테스트 2 · 6-4 |
| W4 | GAP | `document pointerdown`(버블)은 `onPointerDown` stopPropagation **30곳**에서 끊긴다 — 편집창 블록·카드·행을 탭하면 터치 peek이 안 닫힌다 | D15 capture 단계 · pointermove도 capture · §7 "핸들러는 막지 말 것" · 6-9 |
| W5 | GAP | `outsidePointerDown`의 포인터 종류가 "터치 경로"와 "document pointerdown" 사이에서 미정. 전 종류로 읽으면 D9 주석(유예 중 main 드래그 → peek 유지)이 거짓(pointerdown이 8px 앞선다) | 전 종류로 확정 · D9 주석 삭제 · 테스트 1 |
| W6 | GAP | 터치로 연 peek은 항목을 골라도 떠나는 사건이 없어 본문 좌측을 덮은 채 남는다 | `via` · `itemSelected`(터치만 닫음) · 5-3 ⑫ · 테스트 2 · 6-9 |
| W7 | GAP | D2 래퍼 `100%` 갈래에 `pinning`이 들어 있어 open 직후 pin 시 pinning 200ms 동안 줄바꿈 흔들림 | 래퍼 고정 폭에 pinning 포함(끝값 동일 → 점프 없음) |
| W8 | 정정 | D10 "`collapsedChanged(false)`는 pin 없이 도달 불가"는 idle 레일 열기 버튼 경로와 모순(정상 경로) | 문구 정정 · 헤더 버튼 분기 조건 `phase ∈ {open, closing}` 명시 |
| W9 | OK | V12 전제 실측 — DragOverlay `pointer-events`·pointer capture 0건(dist `:3640-3675`) · onDragEnd 배칭과 `setActiveDragItem(null)` 같은 커밋 → effect 시점 elementFromPoint 유효 | §1 DnD 행 보강 |
| W11 | 추가 | 덕수 요청 — peek 패널 우측 위·아래 radius + 그림자(Chrome 모양). 드로어 카드 규격(`DRAWER_RADIUS 10` · `--drawer-shadow`) 재사용, 좌측 각짐·세로 인셋 0·transition 제외 | **D17 신설** · D1 표 · 5-3 ① · 6-4 · 6-9 |
| W10 | OK | z 80 목록 추가 grep — `SelectionInsertPopup` fixed 60(댓글 패널 선택 앵커, 우측) · `CommentPanel` 50/100(우측 패널 내부) · RefTooltip `Z_TOOLTIP`(body 직속) — 좌측 peek과 새 충돌 없음 | 기록 |

**v3에서 새로 덕수 확정이 필요한 것은 없다** — W6(터치 선택 시 닫힘)만 동작이 추가됐고, 마우스 동작은 v2와 같다. 태블릿에서 "선택해도 열어 두기"를 원하면 `itemSelected` 배선만 빼면 된다.

---

## 12. v4 CLI 착수판 기록 (2026-09-17, `0b9229b` 작업 트리 · react-dom 18.3.1 cjs · dnd-kit 6.3.1 dist)

v3의 새 사실 주장은 **전수 일치**했다: `DRAWER_RADIUS 10`(`dialogStyles.ts:100`) · `--drawer-shadow` 2겹(`globals.css:90-92`) · `--rail-hairline` `0.25pt solid var(--border-light)`(`:100`) · `onPointerDown` stopPropagation **30곳**(EditorView 17 · ListView 3 · BlockBottomToolbar·GgbViewer·SvgViewer 각 2 · AskListPopover·Sidebar·FolderView·GgbGraphView 각 1) · React 18.3.1 · dnd-kit 6.3.1(`zIndex = 999` `:3907` · `unstable_batchedUpdates` `:3092·3153`) · `handleAppDragEnd` 첫 줄 `setActiveDragItem(null)`(`AppShell.tsx:531`) · 앱에 `<iframe>` 0건(터치 peek을 iframe 탭으로 못 닫는 경로 없음). 설계를 따라가며 찾은 것:

| # | 판정 | 내용 | 반영 |
|---|---|---|---|
| X1 | 정정 | §1 제목의 기준 커밋이 `e73fbaf`로 남아 있었다 | §1 제목 |
| X2 | 정정 | W1의 배칭은 React EnterLeave가 `pointerout` 한 번에 leave·enter를 함께 내기 때문이고(`:8014`), 레일 버튼 사이 **20px 틈** 때문에 한 프레임에 틈을 건너뛰는 빠른 이동에서만 재현된다. 설계(seq)는 그대로 옳고, 손 검수로 반증하면 안 된다 | D4 · 6-3 CDP 재현법 · §1 행 |
| X3 | 정정 | 공유 레일 래퍼가 `'8px 8px'`뿐이면 슬롯 54 → 최근 레일 중심 325(§1-1의 329와 4px 어긋남) | D13 두 겹 래퍼 · 5-3 ⑭ |
| X4 | 정정 | 우변만 있는 헤어라인은 둥근 모서리에서 **가늘어지며 사라진다**(CSS 폭 보간) — 6-4 "끊기지 않음"은 달성 불가능한 판정 기준 | D17 표 · 6-4 |
| X5 | 정정 | D17의 "토큰은 `width <duration> <curve>` 형태"는 선언(`width var(--…)`)과 토큰 값(`<duration> <curve>`)을 섞은 문장 | D17 |
| X6 | 정정 | 레일 click의 `via`를 pointerdown ref로 정하면 **키보드 click**(`detail 0`)이 낡은 값으로 peek을 연다 — D15 "키보드 범위 밖"과 모순 | D15 · 5-3 ⑮ · 6-9 |
| Y1 | **보완(중)** | 콘텐츠 래퍼가 flex column을 이어받지 않으면 최근 `flex:1`·푸터 바닥 고정·My `overflow:auto` 수축이 한꺼번에 깨진다(R9·D11 불성립). 폴더가 적은 계정에서는 우연히 맞아 보인다 | D2 · 5-3 ② · 6-1 · 6-7 · §7 · S3 |
| Y2 | **보완(중)** | `hold` 식별자가 불안정하거나 no-op 이벤트가 새 객체를 돌려주면 hold effect ↔ release ↔ 재판정이 **리렌더 루프**. `leaveSeq`도 실제 변화에서만 | D4 · 5-2 · 테스트 · 6-9 · §7 |
| Y3 | 보완 | 재판정은 `release` 호출마다가 아니라 `holds===0 ∧ dragKind===null` 가장자리에서 한 번, `lastPointer` 없으면 생략 | D4 · 5-2 |
| Y4 | 보완 | ctx(`dragKind`·`collapsed`)는 리듀서 인자 대신 이벤트 페이로드 — 디스패치 시점 값으로 판정하고 테스트가 단순해진다 | D4 코드 · 5-1 · 테스트 |
| Y5 | 보완 | 터치 peek의 `itemSelected`에 섹션 1의 새 문제·검색·시트 가져오기 포함(모달을 닫은 뒤 peek이 남는다) | D15 · 6-9 |
| Y6 | 보완 | title을 뺀 레일 버튼은 접근 가능한 이름이 없다 → collapsed `aria-label` | D5 · 5-3 ⑪ · 6-9 |
| Y7 | 보완 | idle에서 aside·패널 transition이 한 식이어야 고정 토글에 틈이 안 비친다 | D1 · 5-3 ⑯ · 6-1 |
| Y8 | 보완 | W1 검수는 CDP 단발 `mouseMoved` 점프로(X2) | 6-3 |
| Y9 | 보완 | 되감기·중단은 `transitioncancel` — 듣지 않고 폴백이 받는다(묶으면 V8 재발) | D4 |
| Y10 | 보완 | 헤더 hover intent에도 `pointerType` 필터 | D5 |

**새로 덕수 확정이 필요한 것은 없다.** Y5(새 문제·검색·시트도 터치 peek을 닫는다)와 X6(키보드 click 무시)은 v3의 W6·D15 방침을 그대로 확장한 기본안이다. 마우스 동작은 v3과 같다.

---

## 13. 구현 기록 (2026-09-17, S1~S6)

| 스텝 | 커밋 | 내용 | 검증 |
|---|---|---|---|
| S1 | `958bb28` | `lib/sidebarPeek.ts` 리듀서 + `peekView` · `test:peek` | 44건 · 변이 7종 전부 검출 · strict tsc |
| S2 | `a5862a5` | ShareTree 제어형 · props(SidebarItem·SidebarSectionHeader) · transition 토큰 2 | 스크린샷 5장 변경 전후 바이트 대조(유일한 차이 = 접었다 펴도 공유 상태 유지, 의도) |
| S3 | `c22340a` | aside 세 겹(자리·패널·콘텐츠 래퍼) — peek 상태 idle 고정 | 하니스 스크린샷 6장·기하·rAF 29프레임(자리↔패널 간격 0)·폴더 메뉴 좌표, 실제 `/` 5장 — 전부 동일 |
| S4 | `2b6360f` | `hooks/useSidebarPeek.ts` · 레일 정리(공유 추가·점 삭제) · peek 배선 | CDP 실제 마우스·터치·키보드 36/36 · W1 변이 FAIL→원복 PASS |
| S5 | `d0c1b67` | 메뉴·피커·DnD hold · 드롭 뒤 inside 재판정 | 14/14 + S4 회귀 36/36 · 변이 2종(아래 13-3) |
| S6 | (이 커밋) | CLAUDE.md 규약 1항·현재 Phase · roadmap · 이 확정본 | 로컬 프로덕션 빌드(13-5) |

신규 3(`lib/sidebarPeek.ts` · `hooks/useSidebarPeek.ts` · `tests/sidebarPeek.test.mjs`) · 수정 5(`Sidebar.tsx` · `ShareTree.tsx` · `SidebarSectionHeader.tsx` · `globals.css` · `package.json`).
**AppShell 0 · 서버 0 · 규칙 0 · 스키마 0 · Firestore 0 · 아이콘 추가 0 · 폰 0.** 로직 검증 448 → **492건**(`test:peek` 44).

### 13-1. 계획과 달라진 것

| # | 내용 | 이유 |
|---|---|---|
| R1 | **`peekView(state, collapsed)` 순수 함수 추가** — D1·D2·D6·D17의 렌더 파생값(펼침 레이아웃·래퍼 폭 고정·peekIn·카드 모양·z 80·패널 폭) | JSX 안 조건은 어떤 테스트도 못 본다(M3 전례). 테스트 ~36 → 44 |
| R2 | **공유 레일 두 겹 래퍼(X3)를 S3 → S4** | 레일에 공유 아이콘을 넣는 순간 접힘 화면이 바뀌어 S3의 "화면 불변" 계약과 충돌. 레일 정리(D13)와 같은 커밋이 맞다 |
| R3 | **S4/S5 경계** — 훅의 `hold`(안정 식별자)·railEnter의 `dragKind` 페이로드는 S4, 소비처 hold 배선·DnD hold·재판정은 S5 | 페이로드는 한 줄이라 D9를 S4에서 닫았다 |
| R4 | **`setInside`는 위치만 바꾼다**(되감기는 `panelEnter`의 몫) · **`leaveSeq`는 inside 참→거짓과 holds→0에서만** | 사양이 비워 둔 세부. Y2(재판정마다 유예 재시작 금지)와 D4 주석을 함께 만족 |
| R5 | **재판정은 `open`일 때만** | idle에서는 pointermove를 기록하지 않아 좌표가 낡았다 — 낡은 좌표로 inside를 흔들 이유가 없다 |
| R6 | hold 소비처는 **`usePeekHold(open)` 헬퍼 한 벌**(열림 불리언 deps) | Y2 규칙을 사이트마다 다시 적지 않게 |

### 13-2. 검증 방법(재사용)
- **임시 라우트 `app/dev-p67`**: AppShell과 같은 루트 레이아웃 + DnD 구성(PointerSensor distance 8 · `DragKindContext` · `DragOverlay` 루트 형제 · 본문 draggable 카드) + 가짜 폴더 40(하위 포함)·최근 문항 10·공유 그룹. **커밋하지 않고 dev를 끈 뒤 삭제** — ⚠ `.next/types/app/dev-p67`도 함께 지워야 `tsc -p .`가 통과한다.
- **비로그인 `/`는 폴더 0**이라 Y1(래퍼 flex) 같은 결함이 보이지 않는다 — 넘치는 데이터 하니스가 필요했다.
- **headless Chrome CDP**: `Input.dispatchMouseEvent`(hover·클릭·드래그 — dnd-kit PointerSensor가 실제로 반응) · `Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent`(pointerType touch) · `Input.dispatchKeyEvent`(Enter → detail 0 click). 페이지 안 rAF 로거로 패널 폭·z·radius·animationName을 프레임마다 기록하고 `pointerover` capture로 입력 시각을 잡는다.
- **화면 불변 단계(S2·S3)**: 기준 스크린샷을 **두 번** 찍어 결정성부터 확인 → 변경 후 바이트 대조.

### 13-3. 변이 결과 — 장치를 빼면 테스트가 실패하는가

| 변이 | 결과 | 읽는 법 |
|---|---|---|
| 리듀서 함정 7종(V9·V8·Y2·W1·N3·W3·V13) | 전부 FAIL | 단위 테스트가 규약을 고정한다 |
| open 타이머 deps `[phase]`(seq 제거) | 레일 빠른 점프 뒤 **67ms**에 열려 FAIL(원복 133ms) | W1은 실재한다. 손으로 천천히 옮기면 안 보인다(X2) |
| 메뉴 hold 제거 | "메뉴 연 채 빈 본문으로"(U1b)·"hold 중 전환 보류"(U4) FAIL · **메뉴 위에 머무는 검사(U1·U3·U5)는 PASS** | 메뉴는 패널의 DOM 자손이라 메뉴 위에서는 pointerleave 자체가 안 난다. hold의 필요는 패널·메뉴 **둘 다의 바깥**으로 나갈 때만 드러난다 — 처음 검사는 이 경우를 안 재서 변이를 못 잡았다 |
| 드롭 뒤 inside 재판정 제거 | headless Chrome에서 **PASS** | Chromium은 오버레이 제거 뒤 `pointerover`를 다시 보내 스스로 복구한다(드롭 뒤 `over:DIV` 기록). 재판정은 다른 엔진(Safari·Firefox) 대비 **안전망** — 훅 주석에 "Chrome 통과를 근거로 지우지 말 것" |

### 13-4. 측정 사고와 교훈
- **dev가 도는 중 `git stash`로 이전 코드를 되살려 재측정**(S3) — HMR 재로드와 겹쳐 프로브가 멈추고 변경분이 stash에 갇혔다. 프로브만 끝내 스크립트가 pop하게 해 손실 0. → **기준은 바꾸기 전에 찍는다.**
- **변이 측정의 준비 신호** — dev 로그의 "Compiled"는 `/_error` 컴파일에도 찍혀 변이 반영 전에 측정이 시작됐다(2회). → 변이 코드에 `globalThis.__mutN` 표식을 심고 **브라우저에서 표식이 보일 때까지** 다시 불러온 뒤 측정.
- **덕수 dev(3000)와 측정용 dev(3123)가 같은 `.next`를 공유**했다(S4·S5 측정 중). 측정 로그의 webpack 캐시 rename 경고가 그 흔적이다 → S6에서 dev 종료 → 빌드 → dev 재시작으로 정리.

### 13-5. 덕수 실물 검수(헤드리스로 판정할 수 없는 것) — **종결(2026-09-17, "모두 정상")**

아래 8항 전항 통과. 2번(닫힘 꼬리 150ms)은 **N6 수용 확정** — `SidebarItem`의 `transition: all`을 좁히지 않는다. 6번(Safari)이 통과해 드롭 뒤 재판정은 그대로 둔다(Chromium에서는 없어도 통과하는 안전망 — §13-3).

1. **곡선 체감**(D3·6-4) — 펼침 200ms·접힘 160ms가 "빠르고 끝이 부드러운가"
2. **닫힘 꼬리 150ms(N6)** — 접힌 뒤 새 문제·검색·시트 아이콘이 5.5px 미끄러지는 것이 거슬리는가(거슬리면 `SidebarItem` transition을 background로 좁힌다 — 고정 토글의 슬라이드도 함께 사라진다)
3. **D17 모양** — Chrome 세로 탭 hover 펼침과 나란히 놓고 인상 비교 · 헤어라인이 곡선에서 가늘어지는 것(정상, X4) · pin 순간 모서리·그림자가 꺼지는 변화
4. **실데이터 로그인 계정** — 폴더·최근·공유가 실제로 있는 상태에서 peek 3섹션·메뉴·DnD(최근 문항 → FolderView 카드 드롭)
5. **편집창·ProblemView 위에서 z** — Row 1·2, 우측 단·댓글 드로어 위에 덮이고 Row 2 풀다운·모달 아래
6. **Safari** — 드롭 뒤 재판정 안전망이 실제로 필요한 엔진(패널 안 드롭 뒤 peek 유지)
7. **iPad** — 탭으로 열기·저절로 안 닫힘·항목 선택/바깥 탭으로 닫힘
8. **공개 뷰어 임베드** — 공유 팝오버가 열린 동안 레일 hover에 peek이 안 열림(정상, V4)

알고 두는 것: 키보드로는 peek을 열지 않는다(현행과 같음) · peek마다 My 트리 스크롤이 맨 위로 · 드래그 중 레일 hover로 열리지 않는다(spring-loaded는 §9 후속).

---

## 부록 A. 확정 사항

| # | 질문 | 확정 | 판 |
|---|---|---|---|
| D3 | 속도 | 200/160 · `cubic-bezier(0.33,0,0.2,1)` | v1 |
| D7 | 공유 하위 기억 | 세션 내 | v1 |
| D12 | 최근 개수 | 개수 무관 · 조회 그대로 | v1 |
| D14 | peek 중 버튼 title | '사이드바 고정' | v1 |
| N1 | reduced-motion | v1 제외 | v2 |
| N2 | pin 전환 z | `pinning` 단계 | v2 |
| N3 | hold 중 섹션 전환 | 보류 | v2 |
| N4 | 접기 직후 railEnter 가드 | 삭제 | v2 |
| N5 | `document pointerleave` | 삭제 | v2 |
| N6 | SidebarItem 닫힘 꼬리 | 수용 · 실물 판정 | v2 |
| N7 | open 상태 레일 클릭 | no-op | v2 |
| W5 | 바깥 누름 닫기 포인터 종류 | 전 종류 · capture 단계 | v3 |
| W6 | 터치 peek 항목 선택 | 닫힘(마우스는 유지) | v3 기본안 |
| D17 | peek 패널 모양 | 우측 위·아래 radius 10 + `--drawer-shadow`(드로어 카드 규격) | v3 덕수 요청 |
| X6 | 키보드로 레일 활성 | 무시(`detail 0`) — peek 안 열림, 현행과 같음 | v4 기본안 |
| Y5 | 터치 peek에서 새 문제·검색·시트 가져오기 | 닫힘(itemSelected 9종) | v4 기본안 |

## 부록 B. 실측 방법 (재사용)
dev `npx next dev -p 3123` + `Google Chrome --headless=new --remote-debugging-port=9333` + Node 22 내장 `WebSocket`으로 CDP `Runtime.evaluate`. **비로그인 `/`에서 Sidebar가 그려진다**(뼈대 좌표 계측 가능, 폴더·최근은 0). 61c 방법의 재사용. 착수 시 S3 픽셀 대조에 같은 방법(`Page.captureScreenshot` 전후 diff).

## 부록 C. 문서 계보
| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 현행 실측 · R1~R9 · D1~D16 · 덕수 확정 4 |
| v1 교차검토 | CLI | 정정 11 · 보완 16 · 결정 N1~N7 (별도 파일) |
| v2 | CLI | 전항 권장안 반영 · `pinning` · 실측 좌표 |
| v2 검증 반영 | CLI 리뷰 에이전트 → CLI | ERROR 3 · GAP 8 반영(§10) · 리듀서 이벤트 분리 · 테스트 22 |
| v3 | web 재검증 | ERROR 3 · GAP 4 · 정정 1 반영(§11) · seq deps · capture 리스너 · itemSelected · **D17 둥근 모서리·그림자(덕수 요청)** · 테스트 ~29 |
| **v4** | **CLI 착수판 → 확정본** | 정정 6 · 보완 10 반영(§12) · 래퍼 flex column · hold 안정 식별자·no-op 같은 객체 · 페이로드 ctx · 공유 레일 두 겹 · 테스트 ~36 |

구현 완료(2026-09-17, S1~S6 — §13) · push 완료 · 덕수 실물 검수 종결(2026-09-17, "모두 정상" — §13-5).
