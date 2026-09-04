# Phase 62 구현 계획서 — 폴더뷰 구조 변경 · 좌우 사이드바 UI 통일 (v6 최종판 · 착수)

> 계보: v1(web) → v2(CLI 교차검토) → v3(web 재검증) → v4(CLI 실측) → v5(web 재검증) → **v6(CLI 최종 실측 · 착수, 2026-08-27)**
> **v6의 성격**: v5의 I1~I5를 실측 확인(전건 승인)하고, **라인 오기 2건(J1·J2)을 정정**, **prop 삽입 지점·hover 잔류 처리를 확정(J3·J4)**,
> **새 구조적 한계 1건(K1)을 사실로 편입**했다. 설계 번복 0. **미결 0 · 이 문서로 착수한다.**
> 진실 원천: mathory **origin/main `431c6f6`**. 인용 라인은 v2·v4·v6(CLI)이 그 커밋을 직접 읽어 확인했다.
> 원 구상: `docs/phaseSketch/Phase62 구상.md` (덕수, 2026-08-26)
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

FolderView에서 U자 클레이 프레임을 걷어내 바탕을 아이보리로 두고, 카드·리스트 행을 **클레이 카드**로 뒤집어
"문항 하나를 보는 중(클레이)" ↔ "문항 밖으로 나옴(아이보리)"을 색으로 구분한다. 동시에 EditorView·ProblemView에
**두 벌로 복제된** 우측 패널 리사이즈 코드를 훅 1 + 핸들 컴포넌트 1로 뽑아, 좌측 사이드바·버전 드로어·ProblemView
우측 단까지 같은 문법으로 폭을 조절하게 한다. **서버 0 · Firestore 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI.

---

## 1. v6 차분 (v5 대비)

### 1-1. v5 I1~I5 — 전건 실측 승인

| # | v5 지적 | v6 실측 | 판정 |
|---|---|---|---|
| I1 | §9 규약 본문 "패널 min 360 **>** 단 max **360**"이 자기모순 | D13 이후 관계는 `≥`. 문구를 "패널 min 360 ≥ 단 max 360(현행 220)"으로 | **승인** |
| I2 | v4 §7.2의 VersionDrawer JSX `:3114-3131`이 오기 | 실측 **`:3114`(`<VersionDrawer`) ~ `:3129`(`/>`)** | **승인** |
| I3 | 드래그가 핸들 밖에서 끝나면 `hover`가 남을 수 있다 | pointer capture 중 boundary 이벤트는 캡처 요소로 가고, 해제 후 UA가 실제 커서 위치로 다시 보내는 것이 스펙이지만 구현 편차가 있다 | **승인** — 다만 v6는 관측 항목이 아니라 **코드로 확정**한다(J4) |
| I4 | v4가 `panelWidth` **식별자 치환 지점**을 일부 빠뜨렸다 | 전수 grep: `EditorView` `:1002`(선언) `:1029` `:2989`(삭제됨) `:3759` `:3771` / `ProblemView` `:156`(선언) `:505`(삭제됨) `:549` `:677` `:732` `:782` `:1002` `:1014` | **승인** — §7.2에 전 지점 명시 |
| I5 | 우측 단이 `flex:1/min/max` → 고정폭이 되면 좁은 창에서 먼저 줄어들던 동작이 사라진다 | 본문 래퍼는 `flex:1, minWidth:0`(`:675-676`)이라 대신 줄어든다. 리사이즈 가능한 열이 스스로 줄면 사용자 선택이 무의미해지므로 **의도된 변화** | **승인** — T8 관측 항목 |

### 1-2. J1~J4 — v6 정정·확정

| # | 항목 | v4/v5 | 실제 · 처리 |
|---|---|---|---|
| **J1** | ProblemView **컨텐츠 행** 범위 | v4 `:672~:972`(닫힘 오기) · v5 `:671~:976`(열림 오기) | **`:672`(div) ~ `:976`(닫힘)**. `:671`은 주석, `:974`는 하단 정보 묶음, `:975`는 우측 단 닫힘 |
| **J2** | 글자크기 컨트롤 위치 | v5 "`:729-731 top:16`" | **div `:730` · `top:16` `:731` · `right` `:732`**. `:729`는 주석 |
| **J3** | prop 삽입 지점이 "props"로만 적혀 있다 | — | 확정: `SidebarProps` **`:627-…`**(`:629` 근처에 2줄) · Sidebar 구조분해 **`:666-701`**(`:668` 근처) · VersionDrawer 구조분해 **`:28-34`** + 타입 리터럴 **`:35-43`** · AppShell 핸들 삽입 = `<Sidebar/>` 닫힘 **`:674`** 와 `<main` **`:676`** 사이 |
| **J4** | I3(hover 잔류)의 처리 | v5는 T6 관측 후 조건부 수정 | **코드로 확정한다.** `onUp(ev)`에서 릴리즈 지점이 핸들 rect 안인지 판정해 `setHover(inside)`. 무조건 `setHover(false)`는 커서가 핸들 위에 남아 있는데 `pointerenter`가 재발화하지 않는 브라우저에서 활성선이 꺼지는 **역회귀**를 만든다. rect 판정은 편차가 없다(§6.1) |

### 1-3. K1 — 신규 사실 (구조적 한계, 이번 Phase 범위 밖)

**ProblemView 본문은 고정폭이고 U-프레임이 가로로 잘라낸다.**
U-프레임(`:681-693`)은 `overflowX:'hidden'`(`:684`) + `justifyContent: center`(`:692`)이고, 가운데 영역은 `flexShrink:0`(`:699`)에
`padding '0 32px'`(`:697`)다. 폭 = 라벨 `7×fs` + `LABEL_GAP 28`(`:529`) + 본문 `35×fs` + 패딩 64
→ **fs 15에서 722px, fs 24에서 1100px**. 가용폭이 그보다 좁아지면 `justify-content:center`가 **양쪽으로** 넘치게 만들고
`overflow-x:hidden`이라 **좌측이 잘린 채 스크롤로 닿을 수 없다.**

이는 **기존 한계**다(오늘도 1024 창에서 발생). 다만 사이드바(최대 480)와 우측 단(최대 360)을 둘 다 넓힐 수 있게 되면서
도달 조합이 늘어난다 — 예: 1440 창 + 사이드바 475 + 우측 단 360 → 본문 가용 605px < 722px.

**이번 Phase에서 `overflowX`를 건드리지 않는다**(EditorView의 `content-frame`은 `overflowX:auto`라 같은 상황에서 스크롤되지만,
ProblemView의 `hidden`은 가로 스크롤바를 막으려는 의도적 선택이고 `justifyContent` 분기와 얽혀 있다 — 별건).
**T8″ 관측 항목**으로 남긴다. 실제로 불편하면 정공법은 ① `overflowX:'auto'` ② 글꼴 축소 두 가지다.

---

## 2. 앞선 판본에서 확정된 것 (요약)

### 2-1. v1 대비 정정 (E1~E10) — v2 확정, v3·v4·v5 재승인

§5 결정과 §10 체크리스트가 계속 근거로 인용하므로 착수판에 남긴다.

| # | v1의 서술 | 실측 결과 |
|---|---|---|
| **E1** | 사이드바 핸들을 `<aside>`에 `position:relative` 부여 후 `right:-5px` | **불가.** `<aside>`에 `overflow:hidden`(`Sidebar.tsx:815`) → 잘린다. `position:relative`를 주면 내부 드롭 인디케이터(`:265`) 기준까지 바뀐다 → **AppShell 루트**로(D18) |
| **E1′** | ProblemView 우측 단 좌변에 핸들 | **불가.** 우측 단은 `overflowY:'auto'`(`:796`)이고 CSS는 한 축이 `visible`이 아니면 다른 축도 `auto`로 계산 → **가로도 잘린다** → **ProblemView 루트**로(D17) |
| **E2** | 우측 단 150~360 리사이즈 | **새 버그.** 핸들 zIndex 100 > CommentPanel 50(`:802`), 패널 min 360 ≥ 단 max 360 → 단은 가려지는데 **핸들만 패널 한복판에 살아남는다** → D16 |
| **E3** | "패널과 우측 단이 겹치는지"(v1 Q7) | **지금도 겹친다.** 본문이 `paddingRight(panelWidth+8)`(`:677`)와 우측 단 220에 이중으로 밀려 **228px 死공간**(단을 360까지 키우면 368px) → D16이 해소 |
| **E4** | `--card-border: #DDD3C3` | 클레이 위 **1.29:1** / hover 위 **1.12:1**. `globals.css:80`이 이미 `#DCD3C2`(1.24:1)를 "너무 흐려 식별 안 됨(덕수)"으로 기각 → **`--border-content` 재사용**(D2) |
| **E5** | `gap`(12·24)을 훅 파라미터로 흡수 | **둘 다 실제 경계선(`panelWidth+8`)과 어긋난 값**이라 드래그 시작에 4px·16px 튄다. 파라미터화하면 버그를 이식한다 → **offset 캡처**(D11) |
| **E6** | 클레이 상단 가로선 = 하위폴더 행 선 | **후보가 둘**(A-9 1136px / A-9′ 1104px). D5가 둘 다 제거하므로 결론은 같다 |
| **E7** | sticky ↔ dnd-kit·ContextMenu 충돌?(v1 Q9) | **충돌 없음.** ListView에 dnd-kit 0건, ContextMenu는 `fixed·1000`(A-14) |
| **E8** | 사이드바 확장 시 가로 스크롤?(v1 Q8) | **페이지는 안 깨진다**(content-frame이 `overflowX:auto` 스크롤 컨테이너). 다만 편집창 최소 폭 ≈1054px(C-6)이라 상한을 창 비례로 묶는다(D13) |
| **E9** | — | stale 주석 4건: `EditorView:1027`("zIndex 60"→110) · `:3765`("200ms dwell", 없음) · `FolderView:493`("14px 라운드", 직각) · `--sidebar-collapsed` 소비처 1곳 |
| **E10** | §11 영향 범위 | FolderView는 **공유 스코프 화면에도 재사용**된다(`AppShell:711`·`:758`, C-8) → A축 변경이 '받은/보낸 문항'에도 적용(T11) |

### 2-2. F1~F6 (v3 지적, v4 실측 승인)

| # | 내용 | 반영 |
|---|---|---|
| F1 | `--bg-hover`는 클레이보다 **어둡다** → 제목행 토큰 오선정 | `--block-bg` 채택(D7) |
| F2 | 루트 `paddingTop 8`이 sticky 제목행 바깥이라 행이 그 틈으로 비친다 | sticky 래퍼(D7) |
| F3 | 인라인 `background`를 변수 참조로 두면 `!important`가 불필요 | D4·D9 |
| F4 | **밀어내기 transition도** 드래그 중 꺼야 한다(CommentPanel `width`엔 transition이 없어 본문만 뒤처진다) | D11 |
| F5 | 우측 단 토글 버튼도 패널 열림 중 미렌더 | D16 |
| F6 | `max` 함수는 렌더 중 호출 금지(SSR) | §6.1 |

### 2-3. G1~G4 (v3 문서 오류) · H1~H8 (v4 보완)

| # | 내용 |
|---|---|
| G1 | D1 본문 `:495` → **`:496`** |
| G2 | §7.2 `:1031` → **`:1027`** |
| G3 | E10행 "AppShell:720~" → **`:711`·`:758`** |
| G4 | `## 0.` 중복 → 절 번호 재배열 |
| **H1** | **`--card-bg`는 기존 `--bg-card`(#FEFDFB, `globals:55`)와 뒤집힌 쌍**이고 같은 파일 `FolderView:469·476`이 `--bg-card`를 쓴다 → **`--card-surface`로 개명**(결정 1) |
| **H2** | var 폴백이 없으면 *invalid at computed-value time* → 배경이 통째로 투명 → `var(--card-surface, var(--bg-content))` |
| **H3** | **컨텐츠 행에 `position:relative` 금지** — 글자크기(`:730`)·토글(`:777`)이 그 행 **안**에 있으면서 루트 기준 `top:16`/`top:52`라 98px 내려간다 |
| **H4** | 우측 단 핸들 루트 마운트는 의도 — 핸들 우단 `rightWidth+5` vs 버튼 좌단 `rightWidth+16`, **여유 11px** |
| **H5** | `--block-bg`의 기존 소비처는 `EditorView:747` 한 곳뿐 → 토큰 주석 추가 |
| **H6** | 핸들에 `touchAction:'none'` |
| **H7** | 단계 1·2 완료 기준에 `npm run build` 편입 |
| **H8** | 빈 상태·로딩 텍스트는 카드화하지 않는다(D10′) |

### 2-4. 결정 3건 (덕수 승인, 2026-08-27)

| # | 결정 | 근거 |
|---|---|---|
| **결정 1** | 변수명 = **`--card-surface`** | H1 |
| **결정 2** | ProblemView는 **패널 열림 중 우측 단·핸들·토글 버튼을 전부 미렌더**(공존안 기각) | 공존안은 `CommentPanel`에 `rightOffset`을 추가해 §11의 "CommentPanel 0건"을 깨고, 우측 단을 댓글과 동시에 볼 실사용이 드물다 → 규약으로 못 박음(§9) |
| **결정 3** | 제목행 톤 = **`--block-bg`**(#F0EAE0). Stage 3 실물 판정 유지 | 단조 순서(아이보리 < 행 < 제목행 < hover)가 성립하는 유일한 기존 토큰(F1) |

---

## 3. 적합성 판정 — 기존 정책과 정면으로 만나는 지점

**불가능 판정 0건.** 아래 5건은 규칙 자체를 개정하거나 구상을 조정해야 한다.

| # | 구상 항목 | 충돌 | 처방 |
|---|---|---|---|
| **P1** | FolderView U자 프레임 제거 | CLAUDE.md **"U자 프레임은 3곳 공유 — 한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 셋을 항상 함께"**(Phase 45a). `FolderView:494-503` · `EditorView:3484-3489` · `ProblemView:681-689`가 동일 스타일 | **의도적 위반 → 규칙을 개정한다.** 그 규칙이 막으려던 "점멸"이 곧 이번 구상이 원하는 **상황 변화 신호**다(§9). 안 고치면 다음 Phase에서 누군가 "3곳 동일"을 복원한다 |
| **P2** | 카드 색을 클레이로 낮춤 | CLAUDE.md **"명암비 구속 조건은 가장 어두운 카드 배경 `#E8DFCE`"** — Phase 58·59·59a의 dot·dim·코칭 색이 전부 이 값 기준 | **밝아지는 방향이라 대비는 전부 개선.** 단 **hover를 `#E8DFCE`보다 어둡게 가면 구속 조건이 깨진다.** hover = `--block-bg-active`로 **고정**(D3). 현행 hover `#E4DBCB`(`:542`)는 그보다 어두워 dot 여유 0.28을 이미 갉아먹고 있었다 → 이번에 정리 |
| **P3** | 카드·행 hover 그림자 | CLAUDE.md E형 **"선은 전부 0.5px이고 그림자는 쓰지 않는다"** | **충돌 없음** — 그 규칙은 "편집창 블록" 한정이고 "열람·공유·인쇄에는 적용하지 않는다"고 못 박혀 있다. 단 **테두리 두께는 E형과 같은 0.5px**로(현행 1px, `:558`) |
| **P4** | ProblemView 우측 단에 "동일한 기준" | 우측 드로어 3종 규약(2026-08-18) = **absolute 오버레이 + 밀어내기 + `PANEL_MIN 360`**. 우측 단은 **flex 열**(`:793-801`)이고 폭 220이 `:732`·`:782`에 리터럴로 박혀 있다 | **문자 그대로 적용하면 안 된다.** 통일할 것은 **조작 문법**(훅·핸들·커서·활성선)이고 **폭 수치는 패널마다 별도**(D13). 우측 단은 flex 열을 유지한 채 `width` 소스만 상태로 바꾼다 |
| **P5** | 좌측 사이드바 폭 조절 | `--sidebar-expanded: 260px`(`globals.css:191`) + `transition: width var(--transition-normal)`(`Sidebar.tsx:814`). 접힘 애니메이션이 이 transition에 의존 | **드래그 중에는 transition을 꺼야 한다.** 토큰 소비처는 `Sidebar.tsx:809` 한 곳뿐이므로 **토큰 2개를 삭제하고 상수 export**로(파급 0) |

---

## 4. 확정 사실 (실측, 전부 `431c6f6`)

### A. FolderView · ListView

| # | 사실 | 위치 |
|---|---|---|
| A-1 | FolderView 루트 배경 = `--bg-functional`(아이보리). 제목바(minHeight 98)·하위 폴더 행은 이미 아이보리 chrome | `FolderView.tsx:376-378` |
| A-2 | **U자 프레임** = `background: var(--bg-content)` + `borderTop/Left/Right: 0.5px solid var(--border-content)` + `overflow:auto` + `position:relative` + `fontSize` — **이것이 스크롤 컨테이너다** | `:494-503` (배경 **`:496`** · 3면 경계 `:499-501` · 섹션 주석 `:493` · Phase 45a 주석 `:502`) |
| A-3 | 프레임 안 폭 제한 = `maxWidth 1200, margin 0 auto, padding '0 32px'` → 내용 폭 **1136px**. 제목바(`:379`)와 동일 컨테이너 | `:504` · `:379` |
| A-4 | 카드: `background: var(--block-bg-active)`(`:557`) · `border: 1px solid var(--border-light)`(`:558`) · radius 12 · padding 18/22 · height 320 · `overflow:hidden` · transition box-shadow/transform/background. **테두리가 배경보다 밝아(1.05:1) 사실상 안 보인다** | `:555-568` |
| A-5 | hover = 카드 그리드 안 인라인 `<style>`: `background:#E4DBCB !important` + `box-shadow …!important`. **`!important`가 필요한 이유는 카드 배경이 인라인 style이기 때문** | `:540-544` |
| A-6 | 하단 페이드 = `linear-gradient(180deg, rgba(232,223,206,0) 0%, var(--block-bg-active) 100%)` — **시작색이 하드코딩**. 주석이 "토큰이 바뀌면 따라오지 않는다"고 경고(커밋 `78a780f` 사고) | `:640-647` (배경 `:645` · 경고 주석 `:642-644`) |
| A-7 | 카드 그리드: `repeat(auto-fill, 520px)` · `justifyContent:center` · gap 20 · paddingTop 28 · paddingBottom 20vh | `:531-538` |
| A-8 | 색 토큰: 아이보리 `--bg-functional #FEFDFB` · 클레이 `--bg-content #F4EFE7` · `--block-bg #F0EAE0` · `--block-bg-active #E8DFCE` · `--border-content #D2C8B8` · `--border-content-active #B89B78` · `--border-light #E8E4DF` · `--bg-hover #F0EBE3` · `--block-hairline #C2B7A2` · **`--bg-card #FEFDFB`(`:55` — 신규 `--card-surface`와 혼동 주의, H1)** | `globals.css :root` |
| **A-9** | **가로 구분선 1번 후보 = 하위 폴더 행 `borderBottom: 1px solid var(--border-light)`.** 제목바 컨테이너(1136px) 안이라 **폭 1136**. 카드·리스트 공통이고 **하위 폴더가 없으면 사라진다** | `FolderView.tsx:449-456` (선 `:454`) |
| **A-9′** | **2번 후보 = ListView 제목행 `borderBottom`.** 좌우 인셋 16 때문에 **폭 1104**, 리스트 전용 | `ListView.tsx:102` |
| A-10 | ListView 루트 `padding: '8px 16px 32px'` → A-9 선(1136)보다 좌우 **각 16px 좁다** | `ListView.tsx:97` |
| A-11 | 행: `display:flex · gap 12 · padding '9px 10px' · borderBottom 1px · cursor pointer`, hover는 **인라인 `onMouseEnter/Leave`로 `--bg-hover` 토글** | `:122-132` (padding `:126` · borderBottom `:127` · hover 핸들러 `:130-131`) |
| A-12 | 제목행: `padding '6px 10px' · fontSize 11.5 · 600 · --text-muted` + `HeaderCell`. **배경이 없다(투명)** → sticky로 띄우면 행이 비쳐 보인다 | `:99-109` |
| A-13 | 스크롤 컨테이너 = A-2의 U자 div. 그 사이 조상(`:504`·ListView 루트)에 `overflow`가 없다 → `position:sticky; top:0`이 **성립한다** | 구조 실측 |
| A-14 | ListView에 **dnd-kit이 없다**(0건). 행 메뉴는 `ContextMenu`(`fixed; zIndex:1000`)로 루트 직속 렌더. ListView 안 다른 zIndex는 **0건** → sticky `zIndex:2`와 충돌 없음 | `ListView.tsx:193-221` · `ui/ContextMenu.tsx:71-74` |
| A-15 | `.problem-card` 클래스에 Phase 59a Q5 예외(`content: none` 3줄) → **클래스명 유지 필수**. 리스트 행에 붙이면 그 예외가 딸려온다 | `globals.css:744-746` |
| A-16 | 카드 DnD는 `opacity`만 만진다. DragOverlay는 별도 알약 UI(`:686-699`) | `:551-553, 566` |
| A-17 | `.problem-card`·`folder-row`에 **다른 소비처는 없다**. `--block-bg`의 기존 소비처도 `EditorView:747` **한 곳뿐** | 전수 grep |

### B. 우측 패널 · 드로어

| # | 사실 | 위치 |
|---|---|---|
| B-1 | EditorView 댓글·agent 폭 = `panelWidth`(기본 420) + `resizeHover`/`resizeDragging`. `PANEL_MIN 360`, max `innerWidth*0.9`, onMove 보정 **-12**. `el.setPointerCapture` + el 리스너 | `EditorView.tsx:1002-1004, 2977-3006` |
| B-2 | ProblemView 동일 로직 **사본**: 기본 420, MIN 360, 보정 **-24**, `window` 리스너, pointer capture **없음** | `ProblemView.tsx:156-158, 496-519` |
| **B-3** | **두 보정값 모두 실제 경계선과 어긋난다.** 콘텐츠 우단 = `panelWidth + 8`인데 onMove는 `-12`(`-24`) → 드래그 시작에 **4px·16px 점프** | `EditorView.tsx:2988` · `ProblemView.tsx:504` · `:3479` · `:677` |
| B-4 | 핸들 JSX 사본 2벌: `absolute; top:0; bottom:0; right: calc(panelWidth + 3px); width:10; zIndex:100; cursor:col-resize` + 가운데 1.5px/0 활성선, `transition: width 0.1s` | `EditorView.tsx:3763-3784` · `ProblemView.tsx:1006-1025` |
| B-5 | 밀어내기: EditorView `rightPanelWidth` → Row1·2·3 `paddingRight`(`:3138`·`:3283`·`:3479`) + `transition: 'padding-right 0.2s'`(`:3139`·`:3284`·`:3480`). ProblemView `panelWidth` → 제목바(`:549`/`:550`)·컨텐츠 래퍼(`:677`/`:678`)·글자크기(`:732`/`:734`)·토글(`:782`/`:786`) | 실측 |
| **B-5′** | **CommentPanel `width`에는 transition이 없다** → 패널은 즉시, 본문만 0.2s 뒤처진다(F4의 근거) | `CommentPanel.tsx:796-802` |
| B-6 | **VersionDrawer 폭은 상수** `VERSION_DRAWER_WIDTH = 460`(export) · `maxWidth 90vw` · `absolute; zIndex 110` · `display: open ? 'flex' : 'none'`. **루트에 `overflow` 지정이 없다** → 안쪽에 튀어나온 자식을 둘 수 있다 | `VersionDrawer.tsx:26, 272-285` |
| B-7 | 드로어 110 > 핸들 100 > CommentPanel 50인 이유 = 스태킹 컨텍스트. 드로어 안 `RestoreConfirm(fixed·1400)`이 바깥을 덮으려면 드로어 자신이 화면 최대여야 한다 → **드로어 핸들을 루트에 zIndex>110으로 두면 모달 위에 strip이 뜬다** | `VersionDrawer.tsx:273-278, 421` |
| B-8 | CommentPanel 루트 = `absolute; top/right/bottom:0; width: props.width; maxWidth:90vw; zIndex:50` | `CommentPanel.tsx:59, 118, 796-802` |
| **B-9** | ProblemView 우측 단 = **flex 열** `flex:1, minWidth:150, maxWidth:220, padding '32px 16px', overflowY:'auto', position:'relative'`. **`overflowY:auto` 때문에 가로도 잘린다.** 폭 220이 `:732`·`:782`에 리터럴 중복 | `:793-801` (overflowY `:796`) |
| **B-10** | 패널·핸들은 컨텐츠 행 **밖**, ProblemView 루트(`:539-544`) 기준 absolute. 패널(≥360)이 우측 단(≤220)을 **완전히 덮고**, 본문은 이중으로 밀려 **228px 死공간** | `:539-544, 987-1025` |
| **B-11** | **글자크기 컨트롤(div `:730`, `top:16` `:731`)과 토글 버튼(`:777-790`, `top:52`)은 컨텐츠 행(`:672`~`:976`) 안에 있으면서 루트 기준으로 배치된다** → 컨텐츠 행에 `position:relative`를 주면 **둘이 98px 아래로 내려간다**(H3·J1·J2) | `:672, 730, 777, 976` |
| **B-12** | **ProblemView 본문은 고정폭이고 U-프레임이 가로로 잘라낸다**(K1): U-프레임 `:681-693`(`overflowX:'hidden'` `:684`, `justifyContent:center` `:692`), 가운데 영역 `flexShrink:0`(`:699`)·`padding '0 32px'`(`:697`), `LABEL_GAP 28`(`:529`) → 필요 폭 **722px@fs15 / 1100px@fs24**. 그보다 좁으면 **좌측이 잘리고 스크롤로 닿을 수 없다**(기존 한계, T8″) | `:529, 681-700` |
| B-13 | (참고) 폭 영속은 어디에도 없다. `localStorage`는 `FONT_SIZE_KEY`(`EditorView:189-196`), `mathory.viewMode.<folder>`·정렬(`FolderView:46, 137-160`)만 | 실측 |

### C. 좌측 사이드바

| # | 사실 | 위치 |
|---|---|---|
| C-1 | `<aside>` = `width: collapsed ? var(--sidebar-collapsed) : var(--sidebar-expanded)` · `flexShrink:0` · **`overflow: hidden`** · `transition: width var(--transition-normal)` | `Sidebar.tsx:807-817` (width `:809` · transition `:814` · overflow `:815`) |
| C-2 | 토큰 260/56의 소비처는 C-1 **한 곳뿐** | `globals.css:191-192` |
| C-3 | `collapsed` 소유자 = AppShell(`:87`). AppShell 루트(`:635`) = `display:flex; height:100vh; overflow:hidden` (**position 미지정**), `<Sidebar>` `:636-674`, `<main flex:1 position:relative>` `:676`. **AppShell 안 `position:absolute` 0건** | `AppShell.tsx` |
| C-4 | Sidebar 안 절대배치는 드롭 인디케이터(`:265`) 하나뿐. 컨텍스트 메뉴·툴팁은 전부 `fixed`(`:115, :444, :506`) → **aside에 `position:relative`를 주면 `:265`의 기준만 바뀐다**(그래서 안 준다) | `Sidebar.tsx` |
| C-5 | 폴더명 잘림 = 트리 항목 `paddingLeft: 12 + depth*16` + `textOverflow: ellipsis`(`:283, :322`). **폭이 늘면 코드 변경 0으로 해소** | `Sidebar.tsx:281-322` |
| C-6 | 편집창 최소 폭 = 좌 420(`:3495`) + 미리보기 `calc(38.5em + 32px)` + marginLeft 24(`:3601-3603`) ≈ 1054px@15px. `content-frame`이 `overflowX:auto`라 그 아래에서는 **프레임 안에서** 가로 스크롤 | `EditorView.tsx` |
| C-7 | 다크 모드 없음 → 새 색 토큰에 다크 정의 금지 | CLAUDE.md |
| C-8 | FolderView는 **두 곳**에서 마운트된다: 폴더 화면(`AppShell:711`) · 공유 스코프 화면(`AppShell:758`) | `AppShell.tsx` |
| **C-9** | prop 삽입 지점: `SidebarProps` **`:627-…`** · Sidebar 구조분해 **`:666-701`** · VersionDrawer 구조분해 **`:28-34`** + 타입 리터럴 **`:35-43`** (J3) | 실측 |

### D. 상대휘도·명암비 실측 (`((c+0.055)/1.055)^2.4`)

**휘도 사다리** — 아이보리 `#FEFDFB` 0.9829 > 클레이 `#F4EFE7` 0.8674 > `--bg-hover #F0EBE3` 0.8349 > **`--block-bg #F0EAE0` 0.8276** > `--block-bg-active #E8DFCE` 0.7439.
⇒ `--bg-hover`는 **클레이보다 어둡다**(F1). 아이보리와 클레이 사이(1.13:1)에는 쓸 만한 토큰이 없다.

| 용도 | 값 | 대비 | 판정 |
|---|---|---|---|
| 제목행 배경 | `--block-bg #F0EAE0` | 아이보리 대비 **1.18** · 행(클레이) 대비 **1.05** | ✓ 채택 — 단조 순서 성립(결정 3) |
| 카드·행 테두리 | `#DDD3C3` (v1 원안) | 클레이 위 **1.29** / hover 위 **1.12** | ✗ `#DCD3C2`(1.24) 기각 전례와 동급 |
| 카드·행 테두리 | **`--border-content #D2C8B8`** | **1.45** / **1.25** | ✓ **채택** — 신규 색 토큰 0 |
| 카드·행 테두리 | `--block-hairline #C2B7A2` | 1.73 / 1.50 | 예비 — 실물에서 흐리면 한 단 올림 |
| (현행) | `--border-light #E8E4DF` on `#E8DFCE` | 1.05 | 참고: 지금 카드 테두리는 배경보다 **밝다** |

---

## 5. 아키텍처

**전부 클라이언트. 리사이즈는 훅 1 + 핸들 컴포넌트 1로 단일화, FolderView는 스타일 치환.**

- `hooks/useDrawerResize.ts` — 폭 상태 + 드래그 핸들러. B-1의 pointer capture 방식 채택.
- `components/ui/DrawerResizeHandle.tsx` — B-4 JSX의 단일 사본.
- 소비처 5: EditorView(댓글·agent / 버전 드로어), ProblemView(댓글·agent / 우측 단), AppShell(좌측 사이드바).
- FolderView·ListView — 스타일 치환만. 데이터·훅·DnD 무변경.

### ⚠ 함정 1 — `anchor`와 `side`는 다른 개념이다

- 훅의 **`anchor`** = 패널이 **뷰포트의 어느 변에 고정**되어 있는가 → 드래그 방향 계산.
- 핸들의 **`side`** = strip을 **positioned 부모의 어느 변**에서 offset할 것인가 → 렌더 위치.

버전 드로어가 둘이 갈리는 유일한 사례다: 뷰포트 우측 고정(`anchor:'right'`)인데 핸들은 드로어의 **왼쪽 변**(`side:'left', offset:-13` — L1). 한 이름으로 합치면 반드시 틀린다.

### ⚠ 함정 2 — 핸들을 `overflow`가 걸린 상자 안에 넣지 말 것

| 마운트 후보 | 상자 | `overflow` | 결론 |
|---|---|---|---|
| 좌측 사이드바 | `<aside>` | **hidden** | ✗ → AppShell 루트 |
| ProblemView 우측 단 | 우측 단 div | **auto(Y) → X도 auto** | ✗ → ProblemView 루트 |
| 버전 드로어 | 드로어 루트 | 미지정(visible) | ✓ 안쪽 `left:-5` |
| 댓글·agent | (현행) 화면 루트 | — | ✓ 현행 유지 |

### ⚠ 함정 3 — ProblemView 컨텐츠 행(`:672`)에 `position:relative`를 주지 말 것

"우측 단 핸들을 컨텐츠 행 기준으로 두면 제목바를 안 가리겠네"는 **오답이다.** 글자크기 컨트롤(`:730`)과 토글 버튼(`:777`)이 그 행 **안**에 있으면서 **루트 기준** `top:16`/`top:52`로 배치돼 있다 → 행이 positioned가 되는 순간 두 컨트롤이 제목바 높이(98px)만큼 내려간다.
핸들은 **루트에 `top:0/bottom:0`**으로 두고 제목바를 가로지르게 둔다. 버튼과는 안 겹친다 — 핸들 우단 `rightWidth+5` vs 버튼 좌단 `rightWidth+16`, **여유 11px**(H4). EditorView 댓글 핸들도 Row1~3을 가로지르므로 규약이 같다.

---

## 6. 결정 (D1~D20 — 확정, 미결 0)

### A축 — FolderView

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **U자 프레임 철거.** `:496`의 `background`와 `:499-501`의 3줄 삭제. `flex/minHeight/width`·`overflow:auto`·`position:relative`·`fontSize`는 **유지**(스크롤·sticky·DnD 기준). 섹션 주석(`:493`) 개정 | 구상 · P1 · G1 |
| **D2** | **카드 = 클레이 카드.** 인라인 `background: 'var(--card-surface, var(--bg-content))'`(`:557`) · `border: '0.5px solid var(--border-content)'`(`:558`) · radius 12 유지. **신규 색 토큰 0** | E4 · P3 · H1·H2 |
| **D3** | **hover = `--block-bg-active`(#E8DFCE) + 현행 그림자.** 화면 최악 배경이 지금과 **동일하게** 유지되므로 Phase 58·59·59a 명암비 판정이 전부 유효 | P2 |
| **D4** | **페이드·배경 하드코딩을 변수로 소거.** `.problem-card`·`.folder-row`에 `--card-surface`를 정의하고 `:hover`에서 그 변수만 갈아끼운다. 페이드는 `linear-gradient(180deg, transparent 0%, var(--card-surface, var(--bg-content)) 100%)` → **hover용 페이드 규칙 자체가 사라지고** 하드코딩 rgba 2곳이 소멸. `transparent`는 현대 브라우저가 premultiplied alpha로 보간 → **T1에서 육안 확인** | A-6 · `78a780f` 재발 차단 |
| **D5** | **가로 구분선 2개 모두 제거**: `FolderView:454` · `ListView:102` | E6 |
| **D6** | **리스트 행 = 가로로 긴 클레이 카드.** 인라인 `background: 'var(--card-surface, var(--bg-content))'` · `border: '0.5px solid var(--border-content)'` · `borderRadius: 8` · `padding: '9px 14px'` · `marginBottom: 4` · `borderBottom` 삭제 · `transition: 'background .15s, box-shadow .15s'`. hover는 **인라인 핸들러를 걷어내고 CSS로**. ⚠ **`problem-card` 클래스 금지**(A-15) → `folder-row` | 구상 · A-11 · A-15 |
| **D7** | **제목행 = 행과 같은 기하의 고정 카드, sticky 래퍼 안.** 래퍼 `position:sticky; top:0; zIndex:2; background: var(--bg-functional); padding: '8px 0 4px'`(F2) · 카드 `background: var(--block-bg)`(결정 3·F1) · `borderRadius: 8` · `padding: '6px 14px'` · `borderBottom` 삭제 · 카드 `marginBottom: 0` | 구상 · A-12·A-13 · F1·F2 |
| **D8** | **ListView 루트 `padding: '0 0 32px'`**(좌우 16→0, 상단 8→0 · 상단 8px은 D7 래퍼로 이동). 행 폭 = **1136px** | A-10 · F2 |
| **D9** | **hover 규칙은 globals.css 한 곳에**(규칙 본문 §8.1). `FolderView:540-544`의 인라인 `<style>` 삭제. **`!important` 0건**(F3) | A-5 · F3 |
| **D10** | 카드 그리드 `justifyContent: center` **유지**(범위 밖) | 범위 관리 |
| **D10′** | ListView·FolderView의 **빈 상태·로딩 텍스트는 카드화하지 않는다** | H8 |

### B축 — 리사이즈 통일

| # | 결정 | 근거 |
|---|---|---|
| **D11** | **`useDrawerResize` 신설**(전체 코드 §7.1). 핵심은 **`gap` 폐지**: pointerdown 시 커서↔패널 변 offset을 캡처해 유지 → 12·24 상수 소멸, 시작 스냅 제거, left/right 대칭. 부수 5건: ① 언마운트 시 `body.cursor/userSelect` 복원 ② `window.resize` 재클램프 ③ `max`는 **이벤트 시점에만** 평가(F6) ④ 소비처가 `dragging`을 받아 **밀어내기 transition을 드래그 중 `'none'`**으로(F4) ⑤ **`onUp`에서 릴리즈 지점의 rect 판정으로 `hover` 확정**(J4). **폭 영속 없음** | E5 · B-1~B-3 · B-5′ · I3·J4 |
| **D12** | **`DrawerResizeHandle` 신설**(전체 코드 §7.2). props `{ side, offset, active, zIndex = 100, ...handleProps }` + `data-resize-handle` + **`touchAction:'none'`** | B-4 · H6 |
| **D13** | **폭 수치는 패널별 · 문법만 공유**: 댓글·agent `360 ~ innerWidth*0.9 / 420` · 버전 드로어 `360 ~ innerWidth*0.9 / 460` · ProblemView 우측 단 `150 ~ 360 / 220` · 좌측 사이드바 `200 ~ min(480, innerWidth*0.33) / 260` | P4·P5·E8 |
| **D14** | **버전 드로어 핸들은 드로어 안쪽 좌변**(`side:'left', offset:-13`(L1), `anchor:'right'`). 드로어 루트에 overflow가 없어 안전하고(B-6), 스태킹 컨텍스트(110) **안**이라 `RestoreConfirm(1400)`이 핸들 위를 덮는다. **루트에 zIndex>110 금지**(B-7). 드로어가 닫히면 `display:none`이라 핸들도 함께 사라진다 | B-6·B-7 |
| **D15** | **EditorView는 핸들을 하나만 렌더**한다 — `rightPanelWidth`를 소유한(더 넓은) 쪽. 동률이면 드로어 | B-5·B-7 |
| **D16** | **ProblemView: 패널이 열리면 우측 단·핸들·토글 버튼을 전부 렌더하지 않는다**(`rightOpen && !panelMode` — 결정 2). 좌표 연쇄 정리: `:732`·`:782`의 `right` → `16 + (panelMode ? comment.width + 8 : (rightOpen ? rightCol.width : 0))` | E2·E3·F5 |
| **D17** | **우측 단 핸들은 ProblemView 루트에**(`anchor:'right', side:'right', offset: rightWidth - 5`). 우측 단 자신은 `overflowY:auto`(E1′), **컨텐츠 행 우회 금지**(함정 3). offset이 댓글 패널(`+3`)과 다른 것은 경계선 위치가 다르기 때문. 우측 단 자체는 `width: rightCol.width, flexShrink: 0` | E1′·B-9·B-11 |
| **D18** | **좌측 사이드바 핸들은 AppShell 루트에**(`anchor:'left', side:'left', offset: width - 5`). 루트 div에 `position:'relative'` 부여(C-3). aside에는 손대지 않는다(C-4). **접힘 상태에서는 미렌더** | E1·C-3·C-4 |
| **D19** | **사이드바 폭 상태는 AppShell 소유**, `<Sidebar width dragging>`. aside는 `width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width`, **`transition: dragging ? 'none' : 'width var(--transition-normal)'`** | P5·C-1 |
| **D20** | **`--sidebar-expanded`·`--sidebar-collapsed` 삭제**, `Sidebar.tsx`에서 `SIDEBAR_WIDTH_DEFAULT = 260` / `SIDEBAR_COLLAPSED_WIDTH = 56` export | C-2 |

---

## 7. 새 모듈 (전체 코드 — 그대로 쓴다)

### 7.1 `hooks/useDrawerResize.ts`

```ts
'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface DrawerResizeOptions {
  defaultWidth: number;
  min: number;
  /** 창 비례 상한은 함수로. ⚠ 렌더 중에 부르지 않는다 — SSR에는 window가 없다 (F6) */
  max: number | (() => number);
  /** 패널이 뷰포트의 어느 변에 고정되어 있는가. 핸들의 `side`와 다른 개념이다(§5 함정 1) */
  anchor: 'left' | 'right';
}

export interface DrawerResize {
  width: number;
  dragging: boolean;
  hover: boolean;
  setWidth: (w: number) => void;
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
}

export function useDrawerResize({ defaultWidth, min, max, anchor }: DrawerResizeOptions): DrawerResize {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);

  // 최신 값을 이벤트 시점에 읽는다 — 인라인 화살표로 넘어오는 max가 매 렌더 identity를 바꿔도
  // clamp/onPointerDown이 재생성되지 않게 ref로 받는다.
  const widthRef = useRef(width);  widthRef.current = width;
  const maxRef = useRef(max);      maxRef.current = max;

  const clamp = useCallback((w: number) => {
    const m = maxRef.current;
    const hi = typeof m === 'function' ? m() : m;   // ⚠ 여기서만 호출된다(F6)
    return Math.max(min, Math.min(hi, w));
  }, [min]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();                    // dnd-kit 블록 드래그와 충돌 방지
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    const w0 = widthRef.current;
    // 커서와 패널 변 사이 간격을 한 번만 재고 드래그 내내 유지 → 시작 스냅 0 (E5)
    const delta = anchor === 'right'
      ? e.clientX - window.innerWidth + w0
      : e.clientX - w0;

    try { el.setPointerCapture(pid); } catch {}   // 오버레이·iframe 위에서도 이벤트를 붙잡는다
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const next = anchor === 'right'
        ? window.innerWidth - ev.clientX + delta
        : ev.clientX - delta;
      setWidth(clamp(next));
    };
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      try { el.releasePointerCapture(pid); } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
      // ⚠ capture 중에는 boundary 이벤트가 핸들로만 가므로 hover가 남을 수 있다(I3).
      //   무조건 false로 끄면 커서가 아직 핸들 위인데 활성선이 꺼지는 역회귀가 생긴다 →
      //   릴리즈 지점을 rect로 판정해 확정한다(J4).
      const r = el.getBoundingClientRect();
      setHover(ev.clientX >= r.left && ev.clientX <= r.right
            && ev.clientY >= r.top  && ev.clientY <= r.bottom);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [anchor, clamp]);

  // 창이 줄면 상한이 내려간다 → 패널이 화면 밖으로 나가지 않게 재클램프
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  // 드래그 도중 언마운트되면 body 커서가 col-resize로 굳는다
  useEffect(() => () => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return {
    width, dragging, hover, setWidth,
    handleProps: {
      onPointerDown,
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => setHover(false),
    },
  };
}
```

### 7.2 `components/ui/DrawerResizeHandle.tsx`

```tsx
'use client';
import React from 'react';

/** 드로어·패널 폭 조절 strip. 10px 투명 히트영역 + 가운데 1.5px 활성선.
 *  ⚠ `side`는 "positioned 부모의 어느 변에서 offset할지"이고, 훅의 `anchor`와 다른 개념이다(§5 함정 1).
 *  ⚠ overflow가 걸린 상자 안에 두면 잘린다(§5 함정 2). */
export default function DrawerResizeHandle({
  side, offset, active, zIndex = 100, onPointerDown, onPointerEnter, onPointerLeave,
}: {
  side: 'left' | 'right';
  offset: number;
  active: boolean;
  zIndex?: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <div
      data-resize-handle
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute', top: 0, bottom: 0,
        [side]: offset,
        width: 10, zIndex,
        cursor: 'col-resize',
        touchAction: 'none',          // 터치에서 스크롤 제스처에 뺏기지 않게 (H6)
        display: 'flex', justifyContent: 'center',
      } as React.CSSProperties}
    >
      <div style={{
        width: active ? 1.5 : 0, height: '100%',
        background: 'var(--border-content-active)',
        transition: 'width 0.1s',
      }} />
    </div>
  );
}
```

### 7.3 드래그 수식 · offset 표

```
anchor 'right':  delta = e.clientX - window.innerWidth + width
                 next  = window.innerWidth - ev.clientX + delta
anchor 'left':   delta = e.clientX - width
                 next  = ev.clientX - delta
둘 다:            setWidth(clamp(next, min, resolveMax()))
```
두 경우 모두 시작 시점에 `next === width` → **스냅이 없다**(현행은 4px·16px 튄다).

| 소비처 | anchor | side | offset | 마운트 상자 |
|---|---|---|---|---|
| EditorView 댓글·agent | right | right | `comment.width + 3` | EditorView 루트(현행) |
| EditorView 버전 드로어 | right | left | **`-13`** (L1) | **VersionDrawer 루트 안쪽** |
| ProblemView 댓글·agent | right | right | `comment.width + 3` | ProblemView 루트(현행) |
| ProblemView 우측 단 | right | right | `rightCol.width - 5` | **ProblemView 루트** (컨텐츠 행 금지 — 함정 3) |
| 좌측 사이드바 | left | left | `sidebar.width - 5` | **AppShell 루트** (`:674`↔`:676` 사이) |

**L1 — 버전 드로어만 `-13`인 이유 (T7 검수에서 발견, 2026-08-27)**
`-5`(드로어 좌변 중앙)로 두면 활성선이 댓글·agent보다 **8px 오른쪽**에 뜬다. 클레이 우측 경계선은
드로어 좌변이 아니라 **`rightPanelWidth + 8`**(Row3의 `paddingRight`)이기 때문이다. 즉 나머지 셋과 달리
드로어만 **자기 변 ≠ 경계선**이다(사이드바·우측 단은 자기 변이 곧 경계선이라 `-5`가 맞다).
드로어 안쪽 좌표계로 옮기면 `X + 5 = -8` → **`X = -13`**. 댓글 핸들의 `width + 3`(가운데 `width + 8`)과 같은 지점을 가리킨다.

---

## 8. 구현 항목 (파일 · 라인 — 위에서 아래 순서)

### 8.1 A축

```
components/problem/FolderView.tsx
  :454        하위폴더 행 borderBottom 삭제 (D5)
  :493        섹션 주석 개정 — "U-프레임: 클레이 + 3면 경계 + 상단 14px 라운드"
              → "스크롤 컨테이너(프레임 없음, Phase 62). 바탕은 루트의 아이보리"
  :496        background: 'var(--bg-content)' 삭제 (D1)
  :499-501    borderTop/Left/Right 3줄 삭제 (D1)
  :502        Phase 45a 주석 → Phase 62 주석 (§10 규칙 개정과 같은 문구)
  :540-544    인라인 <style> 블록 통째로 삭제 → globals.css로 (D9)
  :557        background: 'var(--block-bg-active)' → 'var(--card-surface, var(--bg-content))'  (D2·H2)
  :558        border: '1px solid var(--border-light)' → '0.5px solid var(--border-content)'    (D2)
  :642-644    페이드 하드코딩 경고 주석 3줄 → "변수 --card-surface가 카드·hover·페이드를 함께 움직인다"
  :645        background: 'linear-gradient(180deg, transparent 0%, var(--card-surface, var(--bg-content)) 100%)'  (D4)

components/problem/ListView.tsx
  :97         padding '8px 16px 32px' → '0 0 32px'                       (D8·F2)
  :99-109     제목행을 sticky 래퍼로 감싼다 (D7·F2) — 아래 JSX 그대로
  :122-132    행 카드화 + className="folder-row" + 인라인 hover 핸들러 2줄 삭제 (D6) — 아래 JSX 그대로

app/globals.css
  :55 근처    --bg-card 주석에 "⚠ 클레이 카드 표면은 --card-surface다(Phase 62). 이름이 뒤집힌 쌍이니 혼동 주의" (H1)
  :~80        --block-bg 주석에 "Phase 62부터 리스트 제목행 배경도 이 토큰을 쓴다" (H5)
  :191-192    --sidebar-expanded · --sidebar-collapsed 삭제                (D20)
  :744 근처   .problem-card / .folder-row 규칙을 Phase 59a Q5 예외 옆에 모은다 (D4·D6·D9)
```

**globals.css 추가 블록** (`!important` 0건):

```css
/* ═══ Phase 62 — 폴더뷰 카드·리스트 행 ═══
   인라인 background가 var(--card-surface, …)를 참조하므로 :hover는 변수만 갈아끼우면 된다
   → 특이도 경쟁이 없어 !important가 필요 없고, --card-surface 하나가 배경·페이드를 함께 움직인다
   (하드코딩 rgba가 토큰과 어긋났던 78a780f 사고의 구조적 차단).
   ⚠ 기존 --bg-card(#FEFDFB, 아이보리)와 이름이 뒤집힌 쌍이다. 여기 --card-surface는 클레이다. */
.problem-card,
.folder-row         { --card-surface: var(--bg-content); }
.problem-card:hover { --card-surface: var(--block-bg-active); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08); }
.folder-row:hover   { --card-surface: var(--block-bg-active); box-shadow: 0 2px 8px  rgba(0, 0, 0, 0.06); }
```

**ListView 제목행 JSX** (`:99-109` 교체):

```tsx
{/* 제목행 — sticky. 래퍼가 아이보리를 칠해 위 8px 틈으로 행이 비치는 것을 막는다(Phase 62 F2) */}
<div style={{
  position: 'sticky', top: 0, zIndex: 2,
  background: 'var(--bg-functional)',
  padding: '8px 0 4px',
}}>
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px',
    fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
    background: 'var(--block-bg)', borderRadius: 8,
  }}>
    {/* HeaderCell … 현행 그대로 */}
  </div>
</div>
```

**ListView 행 style** (`:125-131` 교체):

```tsx
className="folder-row"
style={{
  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
  background: 'var(--card-surface, var(--bg-content))',
  border: '0.5px solid var(--border-content)',
  borderRadius: 8, marginBottom: 4,
  cursor: 'pointer', opacity: busyId === p.id ? 0.5 : 1,
  transition: 'background .15s, box-shadow .15s',
}}
// onMouseEnter / onMouseLeave 두 줄 삭제 — hover는 globals.css가 담당
```

### 8.2 B축

```
hooks/useDrawerResize.ts               신설 (D11 · 코드 §7.1)
components/ui/DrawerResizeHandle.tsx   신설 (D12 · 코드 §7.2)

components/editor/EditorView.tsx   ── 위→아래 순서
  :1002-1004  panelWidth·resizeHover·resizeDragging 3상태 →
                const comment = useDrawerResize({ defaultWidth: 420, min: 360,
                                  max: () => window.innerWidth * 0.9, anchor: 'right' })
                const version = useDrawerResize({ defaultWidth: VERSION_DRAWER_WIDTH, min: 360,
                                  max: () => window.innerWidth * 0.9, anchor: 'right' })   (D13)
  :1027       stale 주석 "드로어가 zIndex 60" → 110                                        (E9·G2)
  :1028-1032  rightPanelWidth = Math.max(discussionOpen ? comment.width : 0,
                                         versionDrawerOpen ? version.width : 0)            (I4)
              + activeHandle 판정:
                rightPanelWidth === 0 ? null
                  : (versionDrawerOpen && version.width >= (discussionOpen ? comment.width : 0))
                    ? 'version' : 'comment'                                                (D15)
  :2977-3006  PANEL_MIN · handleResizeStart · handleResizeEnter/Leave · resizeActive 전부 삭제
  :3114-3129  <VersionDrawer width={version.width}                    ← v4의 :3131은 오기(I2)
                 resizeHandle={activeHandle === 'version'
                   ? <DrawerResizeHandle side="left" offset={-5}
                       active={version.dragging || version.hover} {...version.handleProps} />
                   : undefined} />                                                         (D14·D15)
  :3139·:3284·:3480  transition: dragging ? 'none' : 'padding-right 0.2s'
                     (dragging = comment.dragging || version.dragging)                     (F4)
  :3759       <CommentPanel width={comment.width}>                                         (I4)
  :3763-3784  → activeHandle === 'comment' && <DrawerResizeHandle side="right"
                 offset={comment.width + 3} active={comment.dragging || comment.hover}
                 {...comment.handleProps} />                                               (D12·D15)
  :3765       stale 주석 "200ms dwell 후 활성" 삭제(위 교체에 흡수)                          (E9)

components/version/VersionDrawer.tsx
  :25-26      VERSION_DRAWER_WIDTH 주석을 "기본값"으로 개정 (export 유지)
  :28-34      구조분해에 width, resizeHandle 추가                                          (C-9·J3)
  :35-43      타입 리터럴에 width?: number; resizeHandle?: React.ReactNode; 추가            (C-9·J3)
  :279-285    width: width ?? VERSION_DRAWER_WIDTH · 루트의 첫 자식으로 {resizeHandle}
              — 드로어가 닫히면 display:none이라 핸들도 함께 사라진다(추가 게이트 불필요)   (D14)

components/problem/ProblemView.tsx  ── 위→아래 순서
  :156-158    → const comment  = useDrawerResize({ defaultWidth: 420, min: 360,
                                    max: () => window.innerWidth * 0.9, anchor: 'right' })
                const rightCol = useDrawerResize({ defaultWidth: 220, min: 150,
                                    max: 360, anchor: 'right' })                           (D13)
  :496-519    PANEL_MIN · handleResizeStart · resizeActive 삭제 (훅으로)
  :549        paddingRight: panelMode ? `calc(${comment.width}px + 8px)` : 0               (I4)
  :550        transition: dragging ? 'none' : 'padding-right 0.18s ease'                   (F4)
              (dragging = comment.dragging || rightCol.dragging — 이하 4곳 동일)
  :677·:678   같은 처리                                                                     (I4·F4)
  :732        right: 16 + (panelMode ? comment.width + 8 : (rightOpen ? rightCol.width : 0)) (D16·I4)
  :734        transition: dragging ? 'none' : 'right 0.18s ease'                           (F4)
  :777-790    토글 버튼 렌더 조건에 && !panelMode 추가                                       (D16·F5)
  :782·:786   :732·:734와 동일 처리                                                          (D16·I4·F4)
  :793-801    렌더 조건 rightOpen → rightOpen && !panelMode,
              flex:1/minWidth/maxWidth → width: rightCol.width, flexShrink: 0              (D16·D17)
  :1002       <CommentPanel width={comment.width}>                                          (I4)
  :1006-1025  → panelMode && <DrawerResizeHandle side="right" offset={comment.width + 3}
                 active={comment.dragging || comment.hover} {...comment.handleProps} />
              + 우측 단 핸들 추가(루트 직속, 바로 뒤):
                rightOpen && !panelMode && <DrawerResizeHandle side="right"
                  offset={rightCol.width - 5} active={rightCol.dragging || rightCol.hover}
                  {...rightCol.handleProps} />                                              (D17)
  ⚠ 컨텐츠 행(:672)에 position:relative를 주지 말 것 — :730·:777이 98px 내려간다 (H3·함정 3)

components/layout/Sidebar.tsx
  상단        export const SIDEBAR_WIDTH_DEFAULT = 260;
              export const SIDEBAR_COLLAPSED_WIDTH = 56;                                    (D20)
  :629 근처   SidebarProps에 width: number; dragging: boolean; 추가                          (C-9·J3)
  :668 근처   구조분해에 width, dragging 추가                                                (C-9·J3)
  :809        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width                            (D19)
  :814        transition: dragging ? 'none' : 'width var(--transition-normal)'               (D19·P5)
  ⚠ <aside>의 position/overflow는 건드리지 않는다 (E1·C-4)

components/layout/AppShell.tsx
  :87 근처    const sidebar = useDrawerResize({ defaultWidth: SIDEBAR_WIDTH_DEFAULT,
                min: 200, max: () => Math.min(480, Math.round(window.innerWidth * 0.33)),
                anchor: 'left' })                                                           (D13)
  :635        루트 div에 position: 'relative' 추가 (AppShell 안 절대배치 0건이라 파급 없음)   (D18·C-3)
  :636        <Sidebar width={sidebar.width} dragging={sidebar.dragging} …>                 (D19)
  :674↔:676   <Sidebar/> 닫힘과 <main 사이에 삽입:                                            (D18·J3)
              {!collapsed && <DrawerResizeHandle side="left" offset={sidebar.width - 5}
                active={sidebar.dragging || sidebar.hover} {...sidebar.handleProps} />}
```

---

## 9. 작업 순서

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **1** | **B축 훅·핸들 추출 → 댓글·agent 2곳 치환 먼저.** 폭 수치·마운트 위치 그대로 | T6 통과 + **`npm run build` 성공**(H7·F6). ⚠ "픽셀 단위 동일"이 **아니다** — ① **드래그 시작 스냅(EditorView 4px · ProblemView 16px) 제거** ② **드래그 중 본문이 0.2s 뒤처지지 않음**(F4) 두 건이 의도된 변화다. 그 외(최소 360·최대 90vw·활성선·커서·pointer capture)는 동일 |
| **2** | 버전 드로어(D14·D15) · ProblemView 우측 단(D16·D17) · 좌측 사이드바(D18~D20) | T7~T10 + `npm run build` |
| **3** | **A축**: D1 → D2 → D3·D4 카드 → D5~D9 리스트 | T1~T5. **실물 판정 2건**: ① 테두리가 흐리면 `--block-hairline #C2B7A2`로 한 단(§4-D) ② 제목행 톤이 무거우면 `--block-bg` → 클레이 동일(D7 차선) |
| **4** | 마무리: CLAUDE.md 규칙 개정 2건 + 신규 규약 1건(§10) · roadmap Phase 62 절 · stale 주석 4건(E9) | §11 체크리스트 전항 |

**B축을 먼저 하는 이유**: 단계 1은 동작 불변 리팩터링이라 회귀 판정이 명확하다. A축의 색·톤 변경과 섞이면 어느 쪽 변화인지 구분이 흐려진다.

---

## 10. 하지 말 것 · 규칙 개정

**CLAUDE.md 개정 1 — U자 프레임 (Phase 45a 항목 교체)**
> U자 프레임(상·좌·우 0.5px, 상단 직각)은 **문항 단위 화면 2곳**(`EditorView` · `ProblemView`)이 공유한다. **한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 둘을 항상 함께** 손댈 것. **`FolderView`는 Phase 62부터 의도적으로 프레임이 없다** — 클레이 = "문항 하나를 보는 중", 아이보리 = "문항 밖". 클레이는 카드·리스트 행이 담당한다. **FolderView에 프레임을 되살리지 말 것.**

**CLAUDE.md 개정 2 — 명암비 구속 조건 (Phase 58 D3 항목 보정)**
> 실배경 중 가장 어두운 값은 여전히 **`#E8DFCE`**지만, Phase 62 이후 그것은 **FolderView 카드의 hover 배경**이다(정지 상태 카드는 `#F4EFE7`). `--case-dot` 3.28 / `--tone-dim` 4.76은 그대로 유효하다. **hover를 `#E8DFCE`보다 어둡게 내리면 이 계산이 전부 무너진다.**

**신규 규약 — ProblemView 우측 패널 배타 (결정 2)**
> ProblemView에서 **댓글·agent 패널이 열려 있는 동안 우측 단(탭·메뉴·메타)은 존재하지 않는다** — 열·리사이즈 핸들·토글 버튼이 함께 사라진다. 패널이 우측 단을 완전히 덮는 구조(패널 min 360 ≥ 단 max 360(현행 220), zIndex 50 vs flex 형제)라 남겨 두면 보이지 않는 열과 그 위에 뜨는 핸들·무의미한 토글이 생긴다. **둘을 공존시키려면 `CommentPanel`에 `rightOffset`을 넣어 패널을 우측 단 왼쪽에 붙이는 별도 작업이 필요하다 — 그것 없이 한쪽만 되살리지 말 것.**

**그 외**
- 페이드·카드 배경을 다시 하드코딩하지 말 것 — `--card-surface` 하나가 카드·hover·페이드를 함께 움직인다(D4).
- 카드·행 배경에 `!important`를 다시 넣지 말 것 — 인라인이 `var(--card-surface, …)`를 참조하는 구조가 이유다(F3). 인라인을 리터럴 색으로 되돌리는 순간 hover가 죽는다.
- **`--card-surface`(클레이)와 `--bg-card`(#FEFDFB, 아이보리)는 이름이 뒤집힌 쌍이다.** 같은 파일 `FolderView:469·476`이 `--bg-card`를 쓰니 자동완성으로 집어 들지 말 것(H1).
- 제목행에 `--bg-hover`를 쓰지 말 것 — 클레이보다 어둡고 hover 전용 토큰이다(F1).
- 리스트 행에 `problem-card` 클래스를 붙이지 말 것 — Phase 59a Q5 예외(`content:none`)가 딸려온다(A-15). 반드시 `folder-row`.
- 핸들을 `overflow`가 걸린 상자 안에 넣지 말 것(§5 함정 2). 특히 `overflow-y: auto`는 **가로도 함께 잘린다**.
- **ProblemView 컨텐츠 행(`:672`)에 `position:relative`를 주지 말 것**(§5 함정 3) — 글자크기·토글이 98px 내려간다.
- **ProblemView U-프레임의 `overflowX:'hidden'`(`:684`)을 이번 Phase에서 건드리지 말 것**(K1·B-12) — 별건이다.
- 버전 드로어 핸들을 루트에 zIndex>110으로 두지 말 것 — `RestoreConfirm`(1400) 위에 strip이 뜬다(B-7).
- `useDrawerResize`의 `max` 함수를 렌더 본문에서 부르지 말 것 — SSR에서 `window`가 없다(F6).
- `onUp`의 hover 판정을 무조건 `setHover(false)`로 바꾸지 말 것 — 커서가 핸들 위에 남았을 때 활성선이 꺼진다(J4).
- 사이드바·밀어내기 transition을 드래그 중 끄는 것을 빠뜨리지 말 것(P5·F4).
- 폭 영속(localStorage) 코드를 넣지 말 것 — 매번 기본값이 확정 사양이다(D11).
- 다크 토큰 금지(C-7) · `[data-noscroll]` 세로 스크롤 금지 · CM `scrollIntoView` 금지 — 현행 규칙 유지.
- 커밋까지만(push는 덕수) · 수정 전 파일 읽기 · 완료 시 roadmap 갱신.

---

## 11. 검증 체크리스트

**A축**
- **T1** 카드 보기: 바탕 아이보리 · 카드 클레이(`#F4EFE7`) + 0.5px 테두리가 **보인다** · hover 시 `#E8DFCE` + 그림자 · **하단 페이드에 회색 띠가 끼지 않는다**(D4 `transparent`) · hover 상태에서도 페이드 끝색이 카드색과 일치.
- **T2** 리스트 보기: 행이 카드로 보인다 · 행 사이로 아이보리 바닥이 드러난다 · hover 그림자가 그 간격 안에서 보인다 · 제목행이 스크롤에 고정되고 **행이 어디로도 비치지 않는다 — 제목행 위 8px 띠와 라운드 모서리 바깥까지**(F2 래퍼) · 제목행 톤이 행보다 한 단 진하고 hover보다 연하다(F1).
- **T3** 가로 구분선 0: 하위 폴더가 **있는** 폴더와 **없는** 폴더 각각에서 카드·리스트 두 보기 모두 확인(선 후보가 둘이었다 — E6).
- **T4** 행 좌단이 폴더 제목·하위폴더 칩과 세로 정렬(1136px) · ⋮ 메뉴가 sticky 제목행 위로 뜬다(z 1000) · 빈 폴더에서 "문항이 없습니다"가 카드 없이 아이보리 위에 표시(D10′).
- **T5** FolderView → ProblemView/EditorView 전환 시 **그 두 화면의 U자 프레임에 변화 0** · Phase 59a Q5 예외 유지(카드 안 경우 블록에 rail·dot 미표시) · dnd-kit 카드 드래그·폴더 드롭 정상.

**B축**
- **T6** 댓글·agent 리사이즈: 최소 360 · 최대 90vw · 활성선 1.5px · 커서 col-resize — EditorView·ProblemView 둘 다. **드래그 시작에 패널이 튀지 않고, 드래그 중 본문이 지연 없이 따라온다**(의도된 변화 2건) · 드래그 중 텍스트 선택 안 됨 · 놓으면 body 커서 복원 · **핸들 밖에서 놓으면 활성선이 꺼지고, 핸들 위에서 놓으면 남는다**(J4 rect 판정).
- **T7** 버전 드로어: 좌변 핸들로 리사이즈 · 열린 상태에서 `RestoreConfirm`이 **핸들 위를 덮는다** · 댓글과 동시에 열면 **더 넓은 쪽 핸들 하나만** 보인다(D15) · 드로어를 좁혔다 넓혀도 Row1~3 밀어내기가 따라온다 · 드로어를 닫으면 핸들도 사라진다.
- **T8** ProblemView 우측 단: 150~360 조절 · 글자크기 컨트롤이 폭을 따라간다 · **댓글 패널을 열면 우측 단·핸들·토글 버튼이 함께 사라지고 본문이 넓어진다**(死공간 0) · 패널을 닫으면 이전 폭 그대로 복귀 · 패널 위에 떠 있는 세로선이 **없다**(E2) · 좁은 창에서 우측 단이 아니라 본문이 줄어든다(I5 — 의도된 변화).
- **T8′** ⚠ **글자크기 컨트롤이 화면 우상단(top 16)·토글이 그 아래(top 52) 원위치를 지킨다** — 컨텐츠 행에 `position:relative`가 들어가면 98px 내려간다(H3). 우측 단 열림/닫힘 · 패널 열림/닫힘 **4조합 전부** 확인.
- **T8″** (관측) 사이드바 최대 + 우측 단 최대 조합에서 ProblemView 본문 좌측이 잘리는지 — 필요 폭 722px@fs15(B-12·K1). **잘려도 이번 Phase에서 고치지 않는다**(기존 한계). 얼마나 거슬리는지만 기록.
- **T9** 좌측 사이드바: 200~min(480, 창의 33%) 조절 · **드래그 지연 0** · 접힘/펼침 애니메이션 유지 · 접힘 상태에서 핸들 미표시 · 긴 폴더명·깊은 하위 폴더가 폭을 늘리면 드러난다 · **핸들이 잘리지 않는다**(E1) · 사이드바를 최대로 넓혀도 페이지 전체가 가로로 밀리지 않는다(편집창 내부 가로 스크롤은 정상 — E8).
- **T10** 새로고침 후 모든 폭이 기본값(420 · 460 · 220 · 260)으로 복귀 · **`npm run build` 성공 + 첫 SSR 렌더에서 `window` 참조 오류 0**(F6) · 드래그 중 다른 화면으로 이동해도 커서가 `col-resize`로 굳지 않는다 · 창을 좁혔다 넓혀도 패널이 화면 밖으로 나가지 않는다.

**공유 화면**
- **T11** 사이드바 '받은 문항 / 보낸 문항' 화면(FolderView 재사용, `AppShell:758`)에서 A축 변경이 동일하게 적용되고 소유자·권한 열이 깨지지 않는다.

---

## 12. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · 인쇄 · 공개 뷰어(`PublicViewerShell`·`/p`·`/shared`) · `BazaarView` · **EditorView·ProblemView의 U자 프레임 자체** · **ProblemView U-프레임의 `overflowX`**(K1) · **CommentPanel 내부**(결정 2로 `rightOffset` prop 신설을 기각) · 블록 렌더 5사이트 · `.problem-card`의 Phase 59a Q5 예외. **전부 0건.**

신규 2 (`hooks/useDrawerResize.ts` · `components/ui/DrawerResizeHandle.tsx`) + 수정 7 (FolderView · ListView · EditorView · ProblemView · VersionDrawer · AppShell · Sidebar) + `globals.css` + CLAUDE.md · roadmap.
**신규 색 토큰 0** · **신규 CSS 변수 1**(`--card-surface` — 색이 아니라 컴포넌트 지역 변수, `:root` 미등록) · **삭제 토큰 2**(`--sidebar-expanded`·`--sidebar-collapsed`).

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 적합성 판정 P1~P5 · 사실표 A·B·C · D1~D12 · 검증 요청 Q1~Q9 |
| v2 | CLI | 실측 교차검토: 구현 불가 2건(E1·E1′) · 새 버그 유발 1건(E2) · 사실 오류 3건(E3~E5) · Q5~Q9 전건 답변 · 결정 7건 → 새 모듈 계약 · offset 표 |
| v3 | web | v2 전건 재검증 · 정정 2건(F1·F3) · 보완 4건(F2·F4·F5·F6) |
| v4 | CLI | F1~F6 실측 승인 · v3 문서 오류 4건(G1~G4) · 신규 보완 8건(H1~H8) · 결정 3건 확정 · 훅·핸들 전체 코드 · T8′ |
| v5 | web | v4 전건 재검증 · 코드 결함 0 · 정정 2건(I1·I2) · 보완 3건(I3·I4·I5) |
| **v6** | **CLI** | **I1~I5 실측 승인 · 라인 오기 2건 정정(J1 컨텐츠 행 `:672~:976` · J2 글자크기 `:730/:731`) · prop 삽입 지점 확정(J3) · hover 잔류를 rect 판정으로 코드 확정(J4) · 신규 구조적 한계 1건 편입(K1·B-12·T8″) · §8을 파일 위→아래 순서로 재정렬. 미결 0 → 최종판** |

*v6 = 최종판. 미결 0. 실물 판정 2건(테두리 단계 · 제목행 톤)과 관측 1건(T8″)만 Stage 3에 남는다. 인용은 전부 origin/main `431c6f6` 기준.*

---

## 부록 — 후속: 리스트 보기 정렬 개선 (2026-09-04 · 배포 대기)

덕수 메모(`docs/phaseSketch/정렬기능 개선.md`) 구현. 이 문서가 세운 리스트 행(D6~D8) 위에서의 변경이라 여기 기록한다.

- **`ListView` 기본 정렬: 수정일 내림차순 → 제목 오름차순.** "수정하면 맨 위로 튀는" 자동
  정렬이 불편하다는 판정 — **순서와 신호를 분리**했다. 헤더 클릭 수동 정렬은 유지(없앤 것은
  '자동'뿐이다).
- **최근 저장 신호는 수정일 칸(`UpdatedCell`)이 자리 이동 없이 낸다**: 24시간 이내 수정이면
  날짜 대신 `IconSave`(구름+체크) + 상대 시각(1분 미만 '방금 전' / 60분 미만 'N분 전' /
  'N시간 전'). 아이콘 색은 `--mathory-red-dark` — 상태 표시기 3:1 규약(Phase 59 G1),
  최악 배경 `#E8DFCE`에서 3.28:1.
- ⚠ **수정일 칸 폭 72 → 86은 헤더·행 두 곳이다** — 한쪽만 바꾸면 열이 밀린다(D8의 폭 정렬
  기준선 위에서).
- **카드 보기는 현행 유지**(수정일 내림차순 기본 + `SortControls`). 제목 비교에는
  `'ko' + { numeric: true, sensitivity: 'base' }`를 넣어 "문제2" < "문제10" —
  `FolderView.compareBySort`(카드 이름 정렬)와 `ListView` 두 곳이 같은 옵션이다.

