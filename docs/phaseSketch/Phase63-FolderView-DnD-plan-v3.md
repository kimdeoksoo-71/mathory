# Phase 63 FolderView 디자인 개선 · 앱 전역 DnD — 구현 계획서 v3 (web 재검증)

*계보: 구상 → 타당성 검토 v1(web) → 계획서 v1(web) → v2(CLI 실측·Q13~Q16·§5-5 들여쓰기) → **이 문서 = v3(web 재검증 + 덕수 추가 요청 2건)**. v2의 E1~E14·D1~D40·§5-5 좌표표를 전건 다시 대조했다 — 코드는 `655ba23` 클론, dnd-kit은 `@dnd-kit/core@6.3.1` 실물(`dist/core.esm.js`)을 읽었다. **정정 4건(F1~F4) · 보강 6건(F5~F10) · 승인 7건(G1~G7) · 추가 요청 반영 4건(D42~D45, 미지정·휴지통 리스트는 D2로 기계획) · 신규 판정 2건(Q17·Q18)**. 다음은 CLI v4 착수판(v2+v3 통합본).*

---

## 0. 한 줄 판정

v2는 **정확하다**. E1(데이터 계약 불일치)·E2(id 충돌)·E7(folder 드래그의 closestCenter 모집단)은 v1이 놓친 실결함이고 셋 다 코드로 재확인됐다. 뒤집는 것은 **D29 하나**(`MeasuringStrategy.Always` — dnd-kit이 이미 해결하는 문제였다)뿐이고, 나머지는 v2 자신의 두 결정이 어긋난 자리(D17↔D20)와 좌표 1px, 실물 판정이 필요한 시각 항목이다.

덕수 추가 요청(v3 시점) — **리스트의 칼럼 헤더("메뉴바")를 더 위로, 그리고 스크롤과 함께 움직이지 않게** — 는 헤더를 스크롤 상자 **밖**(제목바 크롬의 행 2, 사라지는 칩 행 자리)으로 옮기면 두 요청이 한 번에 풀리고, v2의 결정 몇 개(D3′·D17′·E10)가 **더 단순한 형태로** 대체된다(§2-1).

---

## 1. 정정 (F1~F4)

| # | 대상 | 정정 | 근거 |
|---|---|---|---|
| **F1** | **D29 철회** — `MeasuringStrategy.Always` 불필요 | dnd-kit의 droppable 사각형은 정적 스냅숏이 아니다. `Rect` 클래스가 측정 시점에 그 노드의 스크롤 조상들과 오프셋을 잡아 두고, `top/left/…` **getter에서 현재 오프셋과의 차를 매번 뺀다**. 사이드바 목록을 휠로 내려도 폴더 행 사각형은 자동으로 따라온다 — 재측정이 아니라 읽을 때마다 보정이다. v2 §11-4가 걱정한 "휠 스크롤 후 드롭 낡음"은 **애초에 생기지 않는다.** 기본값(`WhileDragging`)으로 둔다. 드래그 중 DOM이 바뀌는 경우(폴더 펼침·행 추가)만 재측정 대상인데 이번 범위엔 없다 | `core.esm.js:970-1004`(Rect getter) · `:2484-2485`(기본값) |
| **F2** | **A-16 정정** — 사이드바 자동 스크롤은 "닿지 않는다"가 아니라 **"타깃 위에 있으면 닿는다"** | 자동 스크롤의 스크롤 조상은 active 노드가 아니라 **`over` 노드 우선**이다(`overNode ?? activeNode`). 포인터가 사이드바 폴더 행 위에 있는 동안은 그 행의 스크롤 조상(= 폴더 목록 `Sidebar:882`)이 밀린다. 행 사이 틈(over null)에서만 본문 컨테이너로 돌아간다. 폴더 행은 빈틈없이 붙어 있어(미지정·휴지통 `marginTop 4`만 예외) 실사용에서 자동 스크롤이 **된다**. "사이드바는 휠로 내려야 한다"는 서술을 전부 지운다. T4 실물이 확정 | `core.esm.js:2956` |
| **F3** | **D17 보완 ↔ D20 모순** — "선택 중 정렬 불가" vs "정렬 변경에 선택 유지" | 선택 바가 제목행을 **대체**하면 D20이 성립할 수 없다. 처방은 §2-1 D44로 흡수됐다(선택 바를 제목 행 1의 우측 컨트롤 자리에 두어 칼럼 헤더가 상시 남는다) | D17·D20 대조 |
| **F4** | **D39 그립 좌표 −13 → −12** | 폴더 목록 상자(`Sidebar:882`)는 `overflow:auto`라 **패딩 박스 밖을 자른다.** 행 콘텐츠 x 0 = 섹션 패딩 12px 안쪽이므로 거터는 −12~0. 그립(폭 12)을 −13에 두면 −13~−1 = **왼쪽 1px이 잘린다.** −12(−12~0)가 거터에 정확히 들어차며 chevron 슬롯(0~14)과는 경계만 접한다(글리프 12는 슬롯 14 안에서 1px 인셋이라 시각 겹침 없음) | `Sidebar:265, 882` · 그립 `IconGrip size 12 · padding '2px 0'` |

---

## 2. 보강 (F5~F10)

| # | 대상 | 보강 |
|---|---|---|
| **F5** | D22″ 충돌 판정 | `pointerWithin`은 `pointerCoordinates`가 없으면(키보드 드래그) **빈 배열**을 돌려준다. 사이드바 최근 문항의 키보드 드래그가 현행 동작이라(v2 §11-5) 갑자기 "어디에도 못 놓는" 상태가 된다. → problem 계열: `pointerWithin`이 비면 `rectIntersection`으로 폴백(dnd-kit 문서의 권장 조합). 포인터 드래그에서는 폴백이 발동하지 않으므로 "빈 곳 드롭 무동작"(D22)은 그대로다 |
| **F6** | D27′ 하이라이트 문법 | 사이드바 폴더 행은 `border: isDropTarget ? '2px solid …' : 'none'`(`Sidebar:284`)이라 **over 순간 행이 2px 자란다**(레이아웃 점프 — CLAUDE.md "네 변을 항상 전부 적을 것"의 사촌). 통일 문법은 **상자 밖 링** `boxShadow: 0 0 0 2px rgba(91,106,191,.25)` + 배경 틴트 `rgba(91,106,191,.12)`(칩 `FolderView:470-471`이 이미 이 형태) · `border` 불변. 미지정·휴지통·브레드크럼·리스트 폴더 행 전부 같은 두 줄 |
| **F7** | E6·D21″ "각 타깃이 `useDndContext().active`로 판정" | `useDndContext()`는 공개 컨텍스트 **전체**를 구독한다 — 그 값에 `over`·`collisions`·`activeNodeRect`가 들어 있어 **매 move마다** 부른 컴포넌트가 재렌더된다. 타깃 수십 개가 전부 그러면 E6이 막으려던 것과 같은 부류다. → 드래그 종류(`problem` \| `problems` \| `folder` \| null)는 **AppShell이 dragStart에서 1회 세팅**하는 상태(`activeDragItem` — 이미 오버레이용으로 든다)를 작은 React Context `DragKindContext`로 내려 읽는다(변화 = start·end 2회뿐). `isOver`는 `useDroppable`/`useSortable`이 준다. 결과: 타깃은 over 변화와 드래그 시작·끝에만 렌더된다 |
| **F8** | D37·D38 시각 | `paddingLeft 0`이면 active/hover **알약(borderRadius 8 배경)의 왼쪽 변과 아이콘·chevron이 밀착**한다(미지정·휴지통 아이콘 x 0, 자식 있는 폴더의 chevron x 1). 헤더와 좌단을 맞추는 목적은 콘텐츠 x 0이지 알약 x 0이 아니다. → 옵션 B: 버튼 `marginLeft: -8; paddingLeft: 8 + depth×16`(ShareTree ParentRow·미지정·휴지통은 `-8`/`8`) — 콘텐츠는 x 0 그대로, 알약만 거터로 8px 확장(거터 12 안이라 `overflow:auto`에 안 잘림). 그립(−12~0, hover 전용, zIndex 1)이 알약 확장부 위에 얹히는 것은 무해. 옵션 A = v2 그대로(밀착 수용). **실물 판정 Q17** — 값 두 개 차이라 CLI가 둘 다 넣어 본다 |
| **F9** | Q14·D20″ 휴지통 스탬프의 근거 | 근거가 "휴지통 **카드** 기본 정렬(수정일 내림차순)"인데, D1·D2로 휴지통 기본 보기가 **리스트(제목 오름차순)** 가 된다 — 기본 화면에서 "버린 순" 신호가 사라진다. 스탬프 유지(Q14)는 그대로 옳고(버린 시각은 그 자체로 정보다), 보완은 `listPrefs`의 **`__trash__` scope 기본 정렬을 `updated desc`** 로 두는 한 줄 예외. 정렬 개선의 근거("수정하면 튄다")는 휴지통에서 편집이 없어 해당 없다. **판정 Q18** |
| **F10** | D3″·E10 `scrollPaddingTop` = sticky 래퍼 ref 실측 | §2-1로 **무효** — 헤더가 스크롤 상자 밖으로 나가므로 sticky 래퍼 자체가 사라진다. `scrollPaddingTop`은 스크롤 상자 상단 내부 여백(상수, 8px)이다 |

---

## 2-1. 덕수 추가 요청 — 칼럼 헤더 위치·고정 (D42~D44)

**요청**: ① 리스트 보기에서 메뉴바(= 칼럼 헤더 행)를 지금보다 위로 — 폴더 칩 행이 사라지니 그 자리로. ② 메뉴바가 스크롤을 따라 움직이거나 상하로 튕기지 않게 — 항상 페이지 상단에 고정.

**현행 진단**: 헤더는 스크롤 상자 **안**의 sticky 래퍼다(`ListView:145-149`, Phase 62 D7). macOS 트랙패드의 고무줄 오버스크롤은 스크롤 상자의 **내용 전체**를 밀므로 sticky도 함께 내려갔다 올라온다 — 덕수가 본 "튕김"이 이것이다. `overscroll-behavior`는 스크롤 **연쇄**만 막고 Safari의 고무줄 자체는 못 막으니 CSS 한 줄로는 안 풀린다. 구조를 바꿔야 한다: **헤더를 스크롤 상자 밖으로.**

| # | 결정 | 근거·효과 |
|---|---|---|
| **D42** | **칼럼 헤더 = 제목바 크롬의 행 2.** 리스트 모드에서 칩 행(`FolderView:449-490`)이 빠진 자리(`minHeight 41`, `alignItems:center`)에 헤더 카드(`--block-bg` · radius 8 · padding `6px 14px` — 시각은 Phase 62 D7 그대로)를 그린다. 제목바 래퍼는 카드·리스트 **둘 다 98**(행 1 57 + 행 2 41) | 요청 ①②를 한 번에 — 헤더가 스크롤 상자 밖이라 스크롤·고무줄과 무관하고, 칩 행이 있던 y 57~98에 선다. **D3′(리스트 57) 폐기** — 카드↔리스트 전환 때 본문 상단이 안 움직이고, CLAUDE.md의 "중앙 컨텐츠의 두 가로선 y=57·98" 정합이 리스트 모드에서 되살아난다(드로어 2행 41이 맞추는 그 선). ListView의 sticky 래퍼(Phase 62 D7·F2)는 **철거** — 행이 헤더 위로 비칠 통로가 없다(스크롤 상자 상단이 곧 클립선) |
| **D43** | **헤더↔행의 열 정렬은 트랙 동기화로.** 헤더가 subgrid 루트 밖이므로 같은 트랙을 물리적으로 공유할 수 없다 → 본문 grid 루트의 **사용된 트랙 폭**을 `getComputedStyle(root).gridTemplateColumns`(px 목록으로 돌아온다)로 읽어 헤더 grid의 `gridTemplateColumns`에 그대로 넣는다. 갱신 시점 = 본문 루트 **`ResizeObserver` 1개**(문항·prefs·창 폭 변화가 전부 루트 크기나 자식 크기로 드러난다) + prefs 변경 effect. `max-content`·`1fr`의 해석은 본문이 하고 헤더는 결과만 받는다 — 진실은 한 곳 | 헤더의 폭 조절 핸들(D7)은 prefs에 px를 쓰고 본문이 그 px로 트랙을 잡으면 다음 프레임에 헤더가 따라온다. ⚠ 세로 스크롤바가 폭을 차지하는 환경(시스템 설정 "항상 표시")에서는 본문 컨테이너가 스크롤바만큼 좁다 → 헤더 컨테이너 `paddingRight = scroll.offsetWidth − scroll.clientWidth`(같은 ResizeObserver에서 계산). Mac 기본(오버레이 스크롤바)은 0 |
| **D44** | **선택 바 = 행 1의 우측 컨트롤 자리.** 선택 ≥1이면 행 1의 `카드/리스트 토글 · 정렬 · 일괄 검증`(`FolderView:423-437`) 자리를 "n개 선택 · 폴더 변경… · 휴지통 · 해제"가 대체한다. 행 2 헤더는 상시 | F3의 모순을 구조로 푼다 — 정렬·칼럼 헤더가 선택 중에도 살아 D20이 성립. 높이 변화 0이라 snap 기준선도 불변. 폴더 이름·개수는 그대로 보인다 |

- **snap(D3‴)**: `scrollPaddingTop` = 스크롤 상자 상단 내부 여백 **상수 8px**(헤더 카드와 첫 행 사이 간격을 스크롤 상자 쪽에 둔다). ResizeObserver·ref 실측 불요. 나머지(리스트 모드만 `y proximity` · 카드·드래그 중 `'none'` 명시 · 행 `snap-align:start`) 유지.
- **빈 상태·로딩 문구**: 헤더 아래 스크롤 상자 안에 그대로.
- **공유 뷰**(received·sent): 같은 구조 — 행 2에 헤더, 칩은 원래 없다.
- **Phase 62 D7과의 관계**: D7의 목적(제목행이 행과 같은 기하의 카드)은 유지되고 수단(sticky 래퍼)만 대체된다. CLAUDE.md의 "제목행은 sticky 래퍼 안의 카드다 — 래퍼 없이 … 틈을 통과해 보인다" 항목은 착수 시 **개정**(래퍼도 틈도 사라진다).

## 2-2. 덕수 추가 요청 — 일괄 검증 버튼 · 미지정/휴지통 리스트 (D45 · D2 재확인)

| # | 결정 | 근거 |
|---|---|---|
| **D45** | **카드 보기에서 [일괄 검증] 버튼을 숨긴다** — 노출 조건 `batchAllowed && effectiveViewMode === 'list'`. `batchAllowed` 자체(`FolderView:206-207`)는 불변이고 다이얼로그·게이트 로직 무변경 | 덕수: 카드 보기는 편집·수정용이라 일괄 검증과 짝이 아니다. 61d 관례 유지 — 숨김 이유를 dev 콘솔에 남기는 effect(`FolderView:210-216`)에 `'카드 보기(리스트에서만 노출)'` 분기 1줄 추가 |
| **D2 재확인** | 미지정·휴지통의 리스트 보기는 **이미 D2**(v1 S1 — `listAllowed` 폐지 · `ListView mode:'trash'` · 빈 상태 문구 mode별)로 계획돼 있다. 추가 작업 없음 | 요청 = D2와 동일. 리스트가 기본이 되면서(D1) 두 폴더도 리스트로 열린다 |

- 카드 보기에서 검증이 필요하면 [리스트]로 바꾸면 된다 — 보기 전환은 버튼 한 번이고 비영속(D1)이라 상태가 남지 않는다.
- 공유 뷰·휴지통은 `batchAllowed`가 이미 false라 무관(`:206`).

---

## 3. 승인 (G1~G7) — v2 주장의 코드 재확인

| # | 승인 | 확인 |
|---|---|---|
| G1 | E1 데이터 계약 불일치 | `FolderView:553` `data={{ problem }}` · `:461` `data={{ folder: cf }}` — `type` 없음. `Sidebar:543, 242`엔 있음. D23′ 필수 |
| G2 | E2 id 충돌 · D34 네임스페이스 | 칩 `id={cf.id}`(`:461`) = 사이드바 `useSortable({ id: folder.id })`(`:241`). dnd-kit 레지스트리는 id 키(Map). D34대로 사이드바 sortable만 맨 id, 나머지 프리픽스. **핸들러는 id를 파싱하지 않는다** — 승인 |
| G3 | E7·D22″ sortable 필터 | `@dnd-kit/sortable`의 `useSortable`은 `data`에 `{ sortable: { containerId, index, items }, …사용자 data }`를 병합한다 → `container.data.current?.sortable` 유무로 사이드바 폴더만 거를 수 있다. `closestCenter`에 필터된 `droppableContainers`를 넘기면 된다(인자가 객체라 스프레드 한 줄) |
| G4 | E8 이동 경로 넷 · D20″ | `moveProblemToFolder`(`firestore:203-208`) · 복원(`AppShell:554`, 같은 함수 null) · `deleteFolder`(`firestore:469`) · `moveToTrash`(`firestore:559-564`) 전부 스탬프 확인. 픽커 경로(`AppShell:906`)도 `moveProblemToFolder`라 함께 무스탬프 — 일관. "휴지통행만 스탬프"의 구현은 **함수 셋의 규칙**: `moveProblemToFolder`·`deleteFolder` 스탬프 제거 / `moveToTrash` 유지 / `moveProblemsToFolder` 내부 `folderId === TRASH_FOLDER_ID` 분기 |
| G5 | E11 중첩 컨텍스트 | `EditorView:3564` · `UserGroupEditor:175` 실측 일치. dnd-kit 센서는 draggable 노드의 `listeners`로 붙으므로 안쪽 컨텍스트의 드래그가 바깥으로 새지 않는다. T1+ 유지 |
| G6 | §5-5 좌표표 | `Sidebar:283`(`12 + depth*16`) · `:298-319`(슬롯 14 + gap 6 → 아이콘 32) · `:976`(미지정 padding 12) · `:1011`(휴지통 padL 34) · `:265`(그립 −2) · `ShareTree:168`(ParentRow padL 12) · `:172`(chevron 16) · `:185`(버튼 padL 4 → 아이콘 32) · `:208`(SubRow 46) · `:231`(PersonRow 34/58) · `:145`(빈 문구 58) · `:51`(헤더 padding '4px 0') — **전항 일치.** D37·D38·D40 수치 승인(D39만 F4) |
| G7 | E13 stale 주석 · E12 scopeKey 병합 · A-25·A-26 | 일치. `ListView:143-144`의 "아이보리 0.9829"는 `--bg-card` 값 — 그 주석은 sticky 래퍼와 함께 사라진다(D42) |

---

## 4. 개정된 결정 (v2 → v3 변경분만)

| # | v3 확정 |
|---|---|
| **D3‴** | 리스트 모드 `scrollSnapType:'y proximity'` / 카드·드래그 중 `'none'` 명시 · `scrollPaddingTop` **상수 8**(D42) · 문항·폴더 행 `scrollSnapAlign:'start'` |
| ~~D3′~~ | **폐기** — 제목바 래퍼는 두 모드 다 98(D42) |
| **D17′** | 선택 바 = 행 1 우측 컨트롤 자리(D44). 칼럼 헤더 상시. D20 성립 |
| **D21‴** | AppShell 상태는 `activeDragItem`(start 1회)뿐. 드래그 종류는 `DragKindContext`로 하향(F7). `onDragOver` 없음 |
| **D22‴** | `folder` → sortable 필터 + `closestCenter` / 그 외 → `pointerWithin` → 비면 `rectIntersection`(F5) |
| **D27″** | 하이라이트 = `boxShadow` 링 + 배경 틴트, `border` 불변(F6). problem 계열일 때만 |
| ~~D29~~ | **철회**(F1). 기본 `WhileDragging` |
| **D39′** | 그립 `left: -12`(F4) |
| **D41(신규)** | `__trash__` scope의 `listPrefs` 기본 정렬 `updated desc`(F9 · Q18) |
| **D42~D44(신규)** | 칼럼 헤더 = 크롬 행 2 · 트랙 동기화 · 선택 바 = 행 1(§2-1) |
| **D45(신규)** | [일괄 검증] 버튼은 리스트 모드에서만(§2-2) |
| D37·D38 | 수치 유지 + 알약 인셋 방식은 Q17(F8) |

나머지 D1~D40은 v2 그대로.

---

## 5. 판정

Q1~Q16 확정(변동 없음). **신규 2건 — 둘 다 권고 쪽으로 판정 요청**:

| # | 질문 | 권고 |
|---|---|---|
| **Q17** | D37·D38에서 active/hover 알약과 콘텐츠의 관계 — A 밀착 수용 / **B 알약만 거터로 8px 확장**(`marginLeft -8; paddingLeft 8`) | B. CLI가 둘 다 넣고 실물 |
| **Q18** | 휴지통 리스트 기본 정렬을 `updated desc`로(D41) | 예 |

---

## 6. 파일 (v2 §8 위에 변경분)

| 파일 | 변경(추가/수정) |
|---|---|
| `components/ui/dnd.tsx` | 충돌 판정에 `rectIntersection` 폴백(F5) · **`DragKindContext` 신설**(F7) · 하이라이트 상수 = 링+틴트 두 줄(F6) |
| `components/layout/AppShell.tsx` | `measuring` prop **없음**(F1) · `DragKindContext.Provider`(F7) |
| `components/layout/Sidebar.tsx` | 폴더 행 `border` 조건부 삭제 → 링(F6) · 그립 `-12`(F4) · Q17 채택 시 `marginLeft -8 / paddingLeft 8 + depth*16`(`:283`), 미지정·휴지통 `-8/8`(`:976, :1011`) |
| `components/layout/ShareTree.tsx` | Q17 채택 시 ParentRow 래퍼 `-8/8`(`:168`) — 하위 단(D40)은 그대로 |
| `components/problem/FolderView.tsx` | 제목바 래퍼 두 모드 98 유지(D3′ 폐기) · 행 2 = 리스트 모드 **칼럼 헤더**(`ListHeader` 컴포넌트, D42) / 카드 모드 칩 · 행 1 우측에 **선택 바**(D44) · `scrollPaddingTop 8` · [일괄 검증] 리스트 모드 조건 + 콘솔 사유(D45) |
| `components/problem/ListView.tsx` | **sticky 래퍼 철거**(D42) · 헤더는 별도 export `ListHeader`(정렬·폭 핸들·칼럼 설정 팝오버를 갖고 FolderView 행 2에서 렌더) · 본문 grid 루트에 `ResizeObserver` → 트랙 px 문자열 + 스크롤바 폭을 상향 콜백(D43) · 헤더와 본문이 같은 `listColumns` 레지스트리·prefs를 본다 |
| `lib/listColumns.ts` | scope별 기본 prefs에 `__trash__` 예외(D41) |

헤더와 본문이 **다른 부모**에 놓이는 것이 이번 개정의 유일한 구조 변화다 — 상태(prefs·정렬·선택)는 FolderView가 들고 둘에 내린다(ListView 지역 `useState` 정렬은 어차피 D9로 prefs로 올라간다).

---

## 7. 착수 순서 · 검수 (v2 §9·§10 위에 변경분)

- **S1**: D45 포함(한 줄). T2 추가: 카드 보기에서 [일괄 검증]이 없고 리스트로 바꾸면 나타난다 · dev 콘솔에 `[Phase61d] 일괄 검증 버튼 숨김: 카드 보기` · 미지정·휴지통이 리스트로 열리고 메뉴가 맞다(D2).
- **S0**: `MeasuringStrategy` 항목 삭제 · `DragKindContext` 포함 · 하이라이트 링 문법.
  T1 추가: **over 순간 사이드바 폴더 행 높이가 변하지 않는다**(F6) · 키보드로 최근 문항을 집어 폴더에 놓을 수 있다(F5) · 드래그 중 React DevTools 하이라이트로 타깃 재렌더가 over 변화 때만 일어난다(F7 — 개발 중 1회 확인).
- **S2**(snap · 헤더 위치): D3′ 대신 **D42** — 헤더를 행 2로 옮기고 sticky 래퍼 철거. 칼럼 체계(S4) 전이라 헤더는 현행 2열(제목·수정일)+모드 열 그대로, 트랙 동기화(D43)는 S4에서.
  T3 추가: **트랙패드 오버스크롤(고무줄)에서 헤더가 미동도 없다** · 카드↔리스트 전환 시 본문 상단 y 불변 · 리스트 모드 헤더 카드 하단이 y=98 근처(드로어 2행 선과 같은 높이대) · 첫 행 위 8px에서 snap이 멈춘다.
- **S3**: T4 추가: **문항을 사이드바 폴더 행 위에 둔 채 목록 아래 가장자리로 가져가면 목록이 자동 스크롤된다**(F2) · 휠로 목록을 내린 뒤 드롭해도 정확한 폴더에 들어간다(F1 — 재측정 없이) · 휴지통 리스트가 최근 버린 순으로 뜬다(D41).
- **S4**: 트랙 동기화(D43). T5 추가: 창 폭을 바꿔도 헤더 열과 행 열이 어긋나지 않는다 · 폭 핸들 드래그 중 헤더·행이 같은 프레임에 움직인다(한 프레임 지연은 수용) · 시스템 스크롤바 "항상 표시"에서도 어긋나지 않는다(`paddingRight` 보정).
- **S5**: T6 추가: 선택 중 헤더 클릭으로 정렬을 바꿔도 선택이 유지된다(D20·D44) · 선택 바가 뜨고 사라질 때 헤더·본문이 움직이지 않는다.
- **S6**: T9 추가: 그립이 사이드바 왼쪽 가장자리에서 잘리지 않는다(F4) · Q17 채택 시 active 알약이 텍스트보다 8px 왼쪽에서 시작하고 그립이 그 위에 뜬다.

---

## 8. 결정 색인 (v4 통합본 작성용)

D1 D2 D3‴ ~~D3′~~ · D4 D5 D6 D7 D8 D9 D10 · D11 D12 D13 D14 D15 D15′ · D16 D17′ D18 D19 D20 D20″ · D21‴ D22‴ D23′ D24′ D25 D26′ D27″ D28 ~~D29~~ D30′ D31 · D32 D33 · D34 D35 D36 · D37 D38 D39′ D40 · D41 · **D42 D43 D44 D45** — 미결 0, 실물 판정 3(Q13 톤 · Q17 알약 · T3 snap 감촉).

---

*v3 = web 재검증 + 추가 요청 반영. dnd-kit 인용은 `@dnd-kit/core@6.3.1 dist/core.esm.js` 라인(`:970-1004` Rect · `:2484` 기본 measuring · `:2956` 스크롤 조상 선택). CLI v4는 v2+v3을 한 문서로 통합한 착수판을 만들고, Q17·Q18 판정을 반영해 S0부터 나간다. v4에서 특히 볼 것: ① D43의 `getComputedStyle().gridTemplateColumns`가 subgrid 루트에서 px 목록으로 돌아오는지 실측 ② 행 2에 헤더 카드를 놓았을 때 첫 행과의 간격(행 2의 41 − 카드 26 = 15의 배분 + 스크롤 상자 8) ③ 선택 바가 행 1의 폭 안에 드는지(폴더 이름이 길 때 ellipsis).*
