# Phase 63 FolderView 디자인 개선 · 앱 전역 DnD — 구현 계획서 v1 (web)

*계보: 덕수 구상 `Phase63.md`(2026-09-05) → 타당성 검토 v1(web, 같은 날) → 브리핑에서 사이드바 DnD로 확장 → **이 문서 = 계획서 v1**. Q1~Q12 전부 덕수 판정 완료(2026-09-05, 전항 권고대로). 인용은 origin/main `655ba23` 기준. 다음은 CLI 실측 교차검토 v2.*

---

## 0. 한 장 요약

FolderView의 기본 보기를 리스트로 바꾸고, 리스트에 칼럼 체계(고정 2 + 선택 4 · 폭 자동/조절 · 보이기·순서·정렬 폴더별 저장)와 하위 폴더 행을 넣고, **앱 전체의 DnD 컨텍스트를 하나로 합쳐** 문항을 끄는 곳(카드·리스트 행·사이드바 최근 문항)과 놓는 곳(리스트 폴더 행·카드 칩·브레드크럼·사이드바 트리·미지정·휴지통)이 같은 드래그 한 번으로 이어지게 한다. 다중 선택 일괄 이동 포함.

**서버 0 · Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 전처리 0 · 렌더 5사이트 0.** lib 변경은 `moveProblemsToFolder`(writeBatch) 하나와 `moveProblemToFolder`의 `updated_at` 제거(Q7). 타입 1줄(`Folder.updated_at`).

**이번에 고치는 기존 결함 1건(D22)**: 두 `DndContext`가 모두 `closestCenter`라 **빈 곳에 놓아도 가장 가까운 폴더로 이동**한다(dnd-kit 6.3.1 실측 — 타깃에서 500px 떨어져도 `over`가 생긴다). 사이드바 DnD와 무관하게 필요한 수정이고, 타깃이 늘어나는 이번 확장에서는 전제 조건이다.

---

## 1. 실측 — 현행 구조

| # | 실측 | 근거 |
|---|---|---|
| A-1 | 보기 모드 `mathory.viewMode.<folderId>` localStorage 폴더별 영속. 기본 공유 뷰 `list`, 그 외 `card` | `FolderView:136-150` |
| A-2 | 휴지통·미지정 리스트 비허용 → 카드 고정. 주석 사유 "전용 메뉴" — 미지정의 카드 메뉴는 기본 메뉴와 같다(`:253-266`이 `isTrash`·`isSharedWithMe`만 가른다) | `:167-169` |
| A-3 | 하위 폴더 칩 행(행 2)은 `childFolders.length > 0`일 때만, `Droppable` 버튼. 카드·리스트 공통 | `:449-490` |
| A-4 | 제목바 래퍼 `minHeight: 98` — 주석 "가로 경계선 Y 통일". **그 선은 Phase 62 D5가 지웠다** → 근거 소멸 | `:379` · Phase 62 v6 D5 |
| A-5 | 카드 프리뷰 블록 로드는 카드 모드에서만. 리스트는 `useCommentCounts`(문항당 2회 읽기)만 | `:226-241, 244` |
| A-6 | 카드 정렬 전역 키 `mathory-folder-sort` · 리스트 정렬은 `ListView` 지역 상태라 언마운트마다 초기화 | `FolderView:39-52, 156-161` · `ListView:77` |
| A-7 | 리스트 기본 정렬 = 제목 오름차순(정렬 개선 2026-09-04) · 카드 = 수정일 내림차순 | `ListView:74-77` · Phase 62 v6 부록 |
| A-8 | 리스트 행·제목행이 독립 flex, 열 폭 고정 px(수정일 86 · ⋮ 28 · 소유자 120 · 권한 64)를 **두 곳 사본**으로 보유 | `ListView:150-160, 181-190` |
| A-9 | 배지 4종(댓글·Agent·검증·블록체인)은 제목 셀 안 인라인 | `ListView:192-210` |
| A-10 | 제목행 sticky 래퍼(`top:0; zIndex:2; padding 8/4`) — 부분 가림은 이 구조의 정상 동작 | `ListView:145-161` |
| A-11 | `ListView`는 FolderView `DndContext` 안. 카드만 `Draggable`, 칩만 `Droppable`. `handleDndEnd`·`DragOverlay` 단일 문항 | `FolderView:370-376, 524-535, 553, 461, 181-188, 694-707` |
| A-12 | `dndEnabled = !isSpecial && childFolders.length > 0 && !!onMoveProblemToFolder` | `:176` |
| A-13 | 사이드바는 **별도** `DndContext` — 폴더 `useSortable`(그립 핸들로만 활성) + 최근 문항 `useDraggable`. 문항 → 폴더 드롭을 **이미 자기 안에서 처리**. 데이터 계약 `{type:'problem', problem}` / `{type:'folder', folder}`가 FolderView와 **동일** | `Sidebar:872-878, 240-244, 541-543, 802-807` |
| A-14 | 사이드바 센서 `PointerSensor distance 8` + `KeyboardSensor`. FolderView는 `PointerSensor distance 8`만 | `Sidebar:741-744` · `FolderView:154` |
| A-15 | 두 컨텍스트 모두 `collisionDetection={closestCenter}` → **빈 곳 드롭 = 가장 가까운 타깃으로 이동**(실측) | `Sidebar:874` · `FolderView:372` |
| A-16 | 사이드바 폴더 목록·최근 목록은 각각 `overflow:auto` 상자 — 본문에서 끌어온 노드의 조상이 아니라 dnd-kit 자동 스크롤이 닿지 않는다 | `Sidebar:881, 1065` |
| A-17 | 폴더 정렬은 같은 부모 안에서만, 다른 그룹 드롭은 무시(재부모화는 ⋯ 메뉴) | `Sidebar:768-785` |
| A-18 | `moveProblemToFolder`가 `updated_at`을 찍는다. `restore`는 `folder_id: null`(미지정) | `firestore.ts:203-208` · `AppShell:552-560` |
| A-19 | `folders.updated_at`은 저장되지만(create·update·reorder) TS `Folder`에 없고, 문항 출입·편집에 반응하지 않는다 | `firestore.ts:401-435` · `types/problem.ts:274-282` |
| A-20 | 전체 문항 배열이 FolderView에 있다(칩 `(n)` 계산). `getDescendantIds`·`getChildren`·`getFolderPath` 존재 | `FolderView:459` · `lib/folder-tree.ts:62, 81, 89` |
| A-21 | '폴더 변경'(`move`) → `FolderPickerDialog`가 있으나 카드·리스트 ⋮ 메뉴엔 빠져 있다 | `AppShell:581-586, 896-913` · `ContextMenu:33-41` |
| A-22 | 사이드바 미지정·휴지통은 `SidebarItem`(드롭 타깃 아님). 공유 섹션 `ShareTree`는 `useState(true)` 기본 펼침, 비영속 | `Sidebar:1051-1063` · `ShareTree.tsx:30` |
| A-23 | `scroll-snap` 사용처 0. `.folder-row`/`.problem-card` hover는 globals.css 한 곳 | `globals.css:862-865` |
| A-24 | 공유 뷰 FolderView의 `folder.id`(`__shared_with_me__`·`__sent__`)에는 `getChildren`이 빈 배열 → 폴더 행·DnD 자연 소등 | `AppShell:800-816` |

---

## 2. 결정 — 보기 모드 · 스크롤 (구상 §리스트 보기 기능 개선)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 보기 모드 **비영속 · 기본 리스트**. `VIEWMODE_KEY`·localStorage 삭제, `folder.id` 변화 시 `'list'`로 리셋. 카드는 버튼으로만. 첫 로드에서 옛 `mathory.viewMode.*` 키 제거 | 구상 · A-1 |
| D2 | `listAllowed` 폐지 — 휴지통·미지정도 리스트. `ListView`에 `mode:'trash'`(메뉴 = 복원·영구 삭제, 카드 메뉴 `:254-257` 그대로). 미지정은 기본 메뉴 | A-2 · 리스트가 기본인데 두 폴더만 카드면 보기 모드가 저절로 바뀌는 듯 보인다 |
| D3 | 스크롤 컨테이너(`FolderView:499-503`)에 리스트 모드일 때만 `scrollSnapType: 'y proximity'` + `scrollPaddingTop: H`(H = sticky 래퍼 총높이 ≈ 38, **CLI 실측 확정**), 각 행 `scrollSnapAlign: 'start'`. 드래그 중 `'none'`. 카드 모드엔 없음 | 구상 "줄 단위로 사라지도록" = 멈춤 위치를 행 경계에 맞추는 것. `mandatory`는 트랙패드 관성에서 붙잡히는 느낌 — 피로 기준(2026-08-29)에 반한다 |
| D3′ | 제목바 래퍼는 **리스트 모드 57**(전역 1행 높이, P1·R6), 카드 모드 현행 98(칩 행). 카드↔리스트 전환 시 본문 상단 41px 이동은 버튼 응답이라 "튐"이 아니다 | A-4 · Q5 |

---

## 3. 결정 — 칼럼 체계

### 3-1. 레지스트리 (D4) — `lib/listColumns.ts`, import 0

| id | 라벨 | 종류 | 값 | 정렬 |
|---|---|---|---|---|
| `title` | 제목 | 고정 1열 `minmax(0,1fr)` | `p.title` | `localeCompare('ko', {numeric, base})` — 두 곳 사본을 여기로 통합 |
| `blockchain` | 원본인증 | 선택 | `blockchain.latest.txHash` · `copyright.contentHash` | 없음 0 < 수정됨 1 < 인증 2 |
| `verify_problem` | 검증(문제) | 선택 | `verification.problem` | 없음 < skip < ok < check < fail · stale은 한 단 아래 |
| `verify_solution` | 검증(풀이) | 선택 | `verification.solution` | 같음 |
| `agent` | Agent | 선택 | `useCommentCounts.agentCounts` | 수 |
| `comments` | 댓글 | 선택 | `useCommentCounts.commentCounts`(미해결) | 수 |
| `updated` | 수정일 | 고정 마지막 열 | `p.updated_at` | 시각 |
| `owner`·`perm` | 소유자·권한 | received/sent 전용 고정 | 현행 | 없음 |
| (열 밖) 체크박스 24px · ⋮ 28px | — | 레지스트리 밖 | — | — |

- 검증 칼럼은 **둘**(Q2). `VerifyBadge`에 `kinds?` prop — 카드는 둘 다, 칼럼은 하나씩.
- 해시태그·배점·대단원은 넣지 않는다. 레지스트리·저장 스키마는 "모르는 id 무시, 새 id는 뒤에 붙임"으로 만들어 후속 칼럼이 저장값을 깨지 않게(D6).

### 3-2. 레이아웃 (D5) — grid + subgrid

```
ListView 루트   display:grid; grid-template-columns:
                  24px minmax(0,1fr) [선택 열들: max-content 또는 <px>] max-content(수정일) 28px
제목행 래퍼      grid-column: 1 / -1; display:grid; grid-template-columns: subgrid; position:sticky
각 행            grid-column: 1 / -1; display:grid; grid-template-columns: subgrid
```

- `max-content` 트랙 = 그 열에서 가장 넓은 셀(제목행 라벨 포함) — 구상의 "가장 긴 행 폭" 그대로. 행이 클레이 카드 상자를 유지하면서 부모 트랙에 맞으려면 **subgrid가 필요조건**(`display:contents`는 상자를 잃는다). A-8의 두 곳 사본이 구조적으로 사라진다.
- 지원: Safari 16 · Chrome 117 · Firefox 71. **폴백 없음** — 폴백은 사본 레이아웃이다. CLI v2가 `CSS.supports('grid-template-columns','subgrid')` 실측.
- 행 `padding 9px 14px`은 subgrid 규칙상 첫·끝 트랙 안쪽 인셋으로 흡수. 제목행·행의 좌우 패딩이 같아(14) 셀이 세로로 맞는다.

### 3-3. 폭 · 보이기 · 순서 · 저장 · 정렬

| # | 결정 |
|---|---|
| D7 | 제목행 셀 사이 1px 세로선(`cursor: col-resize` · `touchAction: none`). pointerdown에서 **`setPointerCapture`**(P7) + 시작 폭 = 셀 `getBoundingClientRect().width` + 커서 offset 캡처(D11 문법). 결과는 그 트랙 `${px}px`, 최소 40. 제목 열(1fr)은 직접 조절 안 함. **구분선 더블클릭 = 자동폭 복귀**(Q3) |
| D8 | 제목행 우측 끝(⋮ 자리)에 칼럼 설정 버튼 → 팝오버: 선택 칼럼 4개 체크박스 + ▲▼. **헤더 셀 드래그 재배열 없음**(정렬 클릭·폭 드래그와 제스처 겹침). 고정 열은 팝오버에 안 나온다 |
| D9 | localStorage `mathory.listPrefs.<scopeKey>` = `{ v:1, hidden[], order[], widths{}, sort{key,dir} }`. scopeKey = `folder.id`(가상 폴더 포함 — Firestore 문서가 없는 폴더도 저장돼야 하므로 `folders/{id}` 안은 탈락). 로드 시 레지스트리로 검증. 기본 = 전부 보이기 · 레지스트리 순 · 자동폭 · 제목 오름차순. ⚠ Phase 62 D11("폭 영속 없음")은 **드로어·사이드바 폭** 결정이라 대상이 다르다 — 예외가 아니라 다른 대상. 카드 정렬(전역 키)은 현행 유지(Q1) |
| D10 | 제목행 클릭 = 현행 `toggleSort` 확장(레지스트리 비교자). `agent`·`comments`는 비동기 로드 후 1회 재정렬 — 사용자가 고른 정렬이라 예측 가능, 알고 두는 손실 |

---

## 4. 결정 — 하위 폴더 행 (구상 §타당성 검토 의뢰 A)

| # | 결정 |
|---|---|
| D11 | 리스트 모드에서 칩 행을 렌더하지 않고 `childFolders`를 `ListView`에 내려 **문항 행 위에 폴더 행**. 카드 모드 칩 현행 유지 |
| D12 | 폴더 행 = 테두리·클레이 없음, 아이보리 바탕. 셀은 제목 열(`IconFolder`/`TwemojiImg` + 이름 + **`(n)`**, Q4) · 수정일 열. 나머지 빈 칸. Phase 62 "클레이 = 문항, 아이보리 = 문항 밖"의 귀결 |
| D13 | 클릭 = `onSelectFolder`. 펼치기 없음. hover는 배경 채움 없이 이름 밑줄(브레드크럼 `:408-409` 문법) — `--bg-hover`(0.8349)는 클레이보다 어두워 아이보리 위에서 문항 행보다 무겁다(Phase 62 F1) |
| D14 | 폴더 정렬은 폴더끼리만 — `title`·`updated`에 반응, 그 외 키면 `order` |
| D15 | **폴더 수정일 = 하위 트리 문항의 `max(updated_at)`**(Q8). `getDescendantIds` → `problems` 필터. 비면 폴더 `created_at`. `Folder` 타입에 `updated_at?: Date` 추가는 폴백용. 저장된 `folders.updated_at`은 이름·아이콘·순서 변경일이라 뜻이 다르고(A-19), 문항 쓰기마다 폴더를 갱신하는 안은 61b가 피한 `updated_at` 오염원이라 탈락 |
| D15′ | 폴더 행 높이 = 문항 행과 동일(padding 9 · 간격 4) — snap 균일성 |

---

## 5. 결정 — 앱 전역 DnD (확장)

### 5-1. 구조

| # | 결정 | 근거 |
|---|---|---|
| **D21** | **`DndContext` 1개, AppShell 소유**(사이드바·본문 바깥). `Sidebar:872`·`FolderView:370`의 컨텍스트 삭제. 핸들러 3개 + `DragOverlay`가 AppShell로. 사이드바 `SortableContext`는 제자리(컨텍스트 자손이면 된다). `dragOverFolderId` 상태 → 각 항목 `isOver`. 센서 = `PointerSensor distance 8` + `KeyboardSensor`(폴더 정렬 접근성 유지) | A-13 데이터 계약 동일 · A-14 |
| **D22** | 충돌 판정 `active.data.current.type === 'folder' ? closestCenter : pointerWithin`. 첫 커밋(S0). | A-15 실측 |
| D23 | 핸들러 분기: `folder` → 정렬(현행 `Sidebar:768-785` 로직 이관, 재부모화 여전히 없음 A-17) / `problem` → 단일 이동 / `problems` → 다중 이동 |
| D24 | 드래그 소스 = FolderView 카드 · 리스트 행 · 사이드바 최근 문항. 조건 = 내 소유 · 가상 폴더/공유 뷰 제외(현행 `dndEnabled`에서 "하위 폴더 있을 때" 조건 **제거** — 타깃이 사이드바에 항상 있다) |
| D25 | 드롭 타깃 = 리스트 폴더 행 · 카드 칩 · 브레드크럼 상위 폴더 · 사이드바 폴더 트리(펼쳐진 것만, Q11 spring-loading 후속) · 사이드바 **미지정**(`folder_id: null`) · 사이드바 **휴지통**(= `trash` 액션, Q9). 사이드바 접힘(아이콘) 상태에서는 타깃 없음(Q12). 폴더 → 폴더 재부모화 DnD 없음 |
| D26 | 타깃 유효성은 AppShell 핸들러 한 곳: 같은 폴더 → 무시 · 휴지통 문항 → 폴더 드롭 = **그 폴더로 복원**(Q10, `moveProblemToFolder(id, folder.id)` — 현행 복원의 미지정 경로와 병존) · 실패는 `alertDialog`(M2 A) |
| D27 | `isOver` 하이라이트 한 문법 — 칩의 액센트 테두리 + `rgba(91,106,191,0.12)`(`FolderView:469-471`)를 사이드바 폴더·미지정·휴지통·브레드크럼·리스트 폴더 행이 공유. 사이드바 자체 하이라이트 제거 |
| D28 | `DragOverlay` 한 벌 — FolderView 액센트 알약(`:696-705`), 다중이면 "문항 n개". 사이드바 흰 카드 `📄` 오버레이 제거 |
| D29 | `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` — 사이드바 목록은 자동 스크롤이 닿지 않아(A-16) 휠로 내리는 동안 드롭 사각형이 낡지 않게 |
| D30 | FolderView 쪽 `listeners`에서 `onKeyDown` 제외 — 전역 `KeyboardSensor`가 포커스된 카드에서 Space로 드래그를 시작하지 않게. 리스트 폭 핸들·체크박스·⋮·`<select>`는 `onPointerDown` 전파 차단 |
| D31 | `DragOverlay`는 AppShell 루트 — 사이드바 리사이즈 핸들(zIndex 100) 위, `aside overflow:hidden`과 무관(fixed) |

### 5-2. 다중 선택 · 일괄 이동 (구상 §의뢰 B-2)

| # | 결정 |
|---|---|
| D16 | 선택 UI = 체크박스 열(맨 왼쪽 24px, 리스트 전용). 행 클릭은 `onView`라 Cmd-클릭 선택은 보이지 않는 조작. Shift-클릭 범위는 체크박스 위에서만. 61d 다이얼로그 선례 |
| D17 | 선택 ≥1이면 제목행 자리에 선택 바("n개 선택 · 폴더 변경… · 휴지통 · 해제"). 폴더 변경… = `FolderPickerDialog` 재사용. ⋮ 메뉴에 '폴더 변경' 추가(A-21) |
| D18 | Finder 의미론: 끌기 시작한 행이 선택에 있으면 선택 전체, 아니면 그 한 건. 사이드바 타깃 포함 |
| D19 | `lib/firestore.ts` `moveProblemsToFolder(ids, folderId | null)` — `writeBatch` 1회(≤500). `loadData()` 끝에 1회 |
| D20 | 선택 해제 = 폴더 변경·보기 전환·이동 완료·Escape. 정렬 변경엔 유지 |
| **D20′** | **이동은 `updated_at`을 찍지 않는다**(Q7) — `moveProblemToFolder`·`moveProblemsToFolder` 모두. 이동은 편집이 아니다(61b가 검증에 내린 것과 같은 판단). 카드 정렬(수정일 내림차순)·최근 목록에서 옮긴 문항이 맨 위로 올라오지 않게 되는 체감 변화 **수용됨** |

### 5-3. 사소 항목 · 교대 색상

| # | 결정 |
|---|---|
| D32 | 사이드바 공유 섹션 기본 접힘 — `ShareTree.tsx:30` `useState(true)` → `false`. 세션 내 상태(영속 없음). 폴더·최근 문항 섹션은 현행 펼침 |
| **D33** | **리스트 교대 색상(zebra)** — 문항 행만 홀짝으로 톤을 바꾼다. 칼럼이 7열 이상으로 늘어나는 이번 리스트에서 한 행을 가로로 따라가는 눈의 보조가 목적. 구현·톤은 §5-4 |

### 5-4. 교대 색상 구현

**기계장치 — Phase 62의 `--card-surface` 한 변수를 그대로 탄다.** 행 배경이 `var(--card-surface, …)`를 읽으므로(`ListView:183` · `globals.css:862-865`) 변수만 갈아끼우면 hover·선택과 충돌 없이 겹친다. `!important` 0.

```
/* globals.css — 순서가 규칙이다: alt → hover → selected. 셋 다 (0,2,0)이라 뒤가 이긴다(Phase 59a F1) */
.folder-row.is-alt      { --card-surface: var(--row-alt); }
.folder-row:hover       { --card-surface: var(--block-bg-active); box-shadow: … }   /* 현행 :865 */
.folder-row.is-selected { --card-surface: <S5에서 확정>; }
```

- **홀짝은 렌더에서 인덱스로 붙인다** — 정렬된 문항 배열의 `i % 2`. `:nth-child`는 쓰지 않는다: subgrid 루트 안에 제목행 래퍼·폴더 행·선택 바가 **형제**로 섞여 있어 패리티가 어긋나고, 폴더 행은 세지 않아야 한다(폴더 행은 아이보리 무테두리라 zebra 밖). 정렬·숨김이 바뀌면 인덱스가 다시 매겨지므로 항상 위에서부터 홀짝이다.
- **톤은 휘도 사다리로 정한다** — Phase 62 F1이 세운 단조 순서(아이보리 > 행 > 제목행 > hover)에 새 단을 끼우는 문제다. 실측(상대휘도 Y · L\*):

| 자리 | 색 | Y | L\* | 인접 단과 ΔL\* |
|---|---|---|---|---|
| 아이보리 바탕 `--bg-functional` | `#FCFAF6` | 0.9572 | 98.3 | — |
| **후보 C: alt(밝은 쪽)** | `#F8F4EE` | 0.9083 | 96.3 | 바탕과 2.0 / 클레이와 1.7 |
| 행 클레이 `--bg-content` | `#F4EFE7` | 0.8674 | 94.6 | — |
| **후보 A: alt(어두운 쪽) = 제목행 토큰 재사용** | `#F0EAE0` | 0.8275 | 92.9 | 클레이와 1.7 / **제목행과 0** |
| 제목행 `--block-bg` | `#F0EAE0` | 0.8275 | 92.9 | — |
| hover `--block-bg-active` | `#E8DFCE` | 0.7439 | 89.1 | 제목행과 3.8 |

  - 클레이↔제목행의 1.7이 덕수가 "한 단 진하다"로 승인한 최소 가시 단이다. 어두운 쪽 창(0.8275~0.8674)은 그 1.7 하나뿐이라 **어두운 alt는 제목행 톤과 겹칠 수밖에 없다**(그 사이 값 `#F1EBE2` Y 0.8361은 제목행과 ΔL\* 0.4 — 토큰 하나 값 없이 사실상 같은 색).
  - **권고 = 후보 C(밝은 쪽 `#F8F4EE`, 신규 토큰 `--row-alt`)**: 다섯 단(바탕·alt·클레이·제목행·hover)이 전부 살아 있고 단 간격이 2.0 / 1.7 / 1.7 / 3.8로 고르다. 구상의 문장은 "진하게"였지만 교대의 기능(가로 추적)은 방향과 무관하고, 밝은 쪽은 제목행과 안 겹치며 폴더 행(아이보리·무테두리, ΔL\* 2.0 + 테두리 유무)과도 갈린다. 명암비는 hover가 여전히 최악값이라 Phase 58·59a 계산 불변.
  - **후보 A**(어두운 쪽)로 가면 신규 토큰 0이지만 alt 행과 제목행이 같은 색이 된다 — 스크롤 중 sticky 제목행 바로 아래 alt 행이 오면 4px 아이보리 틈과 0.5px 테두리만이 둘을 가른다. 실물로 견딜 만하면 A도 된다. **둘 다 변수 값 한 줄 차이라 CLI가 두 값을 넣고 덕수가 실물 판정(Q13)**.
- 토글은 두지 않는다(설정 항목을 늘리지 않는다 — 실물 판정으로 값을 정하고 끝). 필요해지면 `listPrefs` 전역 키에 불리언 하나로 추가할 수 있게 레지스트리 밖에 둔다.
- 공유 뷰(received/sent)도 같은 `ListView`라 자동 적용. 인쇄·카드 보기 무관.

---

## 6. 판정 기록 (Q1~Q12, 2026-09-05 덕수 전항 권고대로)

Q1 정렬 저장은 리스트만 · Q2 검증 칼럼 둘 · Q3 더블클릭 자동폭 복귀 · Q4 폴더 행 `(n)` 유지 · Q5 리스트 제목바 57 · Q6 브레드크럼 드롭 포함 · Q7 이동 시 `updated_at` 미갱신 · Q8 폴더 수정일 = 하위 트리 최대값 · Q9 휴지통 드롭 허용 · Q10 휴지통 문항 → 폴더 드롭 = 그 폴더로 복원 · Q11 spring-loading 후속 · Q12 사이드바 접힘 상태 타깃 없음.

**남은 판정 1건 — Q13 교대 색상 톤 방향**: 후보 C(밝은 쪽 `#F8F4EE`, 권고) / 후보 A(어두운 쪽 = 제목행 토큰). CLI v2가 두 값을 코드에 넣어 실물로 판정한다(§5-4).

---

## 7. 기존 결정과의 관계

| 대상 | 관계 |
|---|---|
| Phase 62 D6 행 = 클레이 카드 | 폴더 행 무테두리는 예외가 아니라 클레이 정의("문항")의 귀결 |
| Phase 62 D7·D8 sticky 제목행·행 폭 1136 | 유지. subgrid 루트가 같은 컨테이너 안 |
| Phase 62 D11 폭 영속 없음 | 드로어·사이드바 폭 결정. 칼럼 폭은 다른 대상 |
| 정렬 개선(부록) 기본 제목 오름차순·자동 정렬 없음 | 유지. 저장되는 것은 사용자가 고른 정렬 |
| 61b `setVerification` — 검증은 `updated_at`을 안 찍는다 | 같은 판단을 이동에 적용(D20′) |
| Phase 40 사이드바 폴더 정렬(같은 부모 안) | 로직 이관만, 동작 불변(A-17). S0 검수 대상 |
| M2 A 다이얼로그 규약 | 이동 실패·다중 휴지통 확인에 `alertDialog`·`confirmDialog` |
| P1·R6 전역 1행 높이 57 | 리스트 제목바(D3′) |
| P7 `setPointerCapture` | 폭 핸들(D7) |

---

## 8. 범위 · 파일

| 파일 | 변경 |
|---|---|
| `lib/listColumns.ts` | **신설** import 0 — 레지스트리 · 비교자 · prefs 검증/직렬화. `npm run test:list` |
| `hooks/useListPrefs.ts` | **신설** — localStorage scopeKey 읽기/쓰기 |
| `components/ui/dnd.tsx` | **신설** — `Draggable`/`Droppable` 렌더프롭 이주(`FolderView:87-105`) · 충돌 판정 함수 · 하이라이트 스타일 상수 |
| `components/layout/AppShell.tsx` | `DndContext` 소유 · 핸들러 3 · `DragOverlay` · `handleMoveProblemsToFolder` · 드롭 유효성 |
| `components/layout/Sidebar.tsx` | 컨텍스트·센서·핸들러·오버레이 제거(`:741-878, 1103-1121`) · 폴더 항목 `isOver` · 미지정·휴지통 `Droppable` |
| `components/layout/ShareTree.tsx` | `:30` 기본 접힘 |
| `components/problem/ListView.tsx` | **대부분 교체** — subgrid · 칼럼 · 폴더 행 · 체크박스·선택 바 · 폭 핸들 · `mode:'trash'` · ⋮ '폴더 변경' |
| `components/problem/FolderView.tsx` | 컨텍스트 제거 · viewMode 비영속 · `listAllowed` 폐지 · 리스트 모드 칩 제거·제목바 57 · snap · 브레드크럼 `Droppable` · ListView에 `folders`·`onSelectFolder`·선택 전달 |
| `components/ui/VerifyBadge.tsx` | `kinds?` prop |
| `lib/firestore.ts` | `moveProblemsToFolder`(writeBatch) · 두 이동 함수 `updated_at` 제거 |
| `types/problem.ts` | `Folder.updated_at?: Date` |
| `app/globals.css` | 폴더 행 hover · 폭 핸들 · 체크박스 열 · `isOver` 공용 클래스 · `.folder-row.is-alt`(D33) + `--row-alt` 토큰(후보 C 채택 시) |

---

## 9. 착수 순서 (각각 독립 커밋 · 검수 후 다음)

| 단계 | 내용 | 검수 핵심 |
|---|---|---|
| **S0** | 컨텍스트 1개화(D21) + 충돌 판정(D22) + 오버레이·하이라이트 통일(D27·D28) + `Always` 측정(D29) + 공유 접힘(D32) | **폴더 정렬 무회귀** · 빈 곳 드롭 시 아무 일도 없음 · 최근 문항 → 폴더 드롭 정상 · 카드 → 칩 정상 |
| S1 | 보기 모드 기본·비영속 · `listAllowed` 폐지 · 휴지통 리스트 메뉴(D1·D2) | 폴더 진입마다 리스트 · 휴지통 메뉴 |
| S2 | snap · 리스트 제목바 57(D3·D3′) | 멈춤 위치 · 드래그 중 떨림 없음 |
| S3 | 폴더 행 + 폴더 수정일(D11~D15′) · 리스트 행 Draggable · 브레드크럼·사이드바 미지정·휴지통 Droppable(D24~D26) · 이동 `updated_at` 제거(D20′) | 폴더 행 정렬 분리 · 수정일 = 안의 최신 문항 · 사이드바 트리로 이동 · 휴지통 복원 경로 둘 |
| S4 | 칼럼 체계(D4~D10): 레지스트리 → subgrid → 보이기·순서 → 폭 → 저장 → 정렬 → 교대 색상(D33) | 자동폭 · 조절 · 폴더별 저장 · 공유 뷰 소유자·권한 무회귀 · 교대 색상 실물 판정 |
| S5 | 다중 선택·일괄 이동(D16~D20) | n건 1회 이동 · 선택 바 · Escape |

S0가 기초이고 회귀 위험(폴더 정렬)이 가장 커서 맨 앞이다. S3까지 나가면 구상의 문의 A·B-1과 사이드바 DnD가 닫힌다. S4가 전체의 절반 이상.

---

## 10. 검수 항목 (초안 — v2에서 확정)

- T1 (S0) 폴더 그립 드래그로 형제 순서 변경 정상 · 다른 부모로 드롭 무시 · 최근 문항을 폴더에 드롭 → 이동, **빈 곳에 놓으면 이동 없음** · 카드를 칩에 드롭 → 이동, 빈 곳 → 없음 · 오버레이가 한 디자인 · 공유 섹션이 접혀서 뜬다.
- T2 (S1) 폴더 진입마다 리스트. 카드로 바꾸고 나갔다 오면 리스트. 휴지통·미지정 리스트 + 메뉴(복원·영구 삭제) 정상. 옛 viewMode 키 소거.
- T3 (S2) 멈추면 제목행 바로 아래에 행 상단. 트랙패드 관성에서 걸림 없음. 드래그 자동 스크롤 중 떨림 없음. 카드 모드 무영향. 리스트 제목바 57.
- T4 (S3) 폴더 행 아이보리·무테두리·아이콘+이름+(n)+수정일 · 클릭 진입 · 폴더끼리만 정렬 · 수정일 = 하위 트리 최신 문항 · 리스트 행 → 폴더 행/브레드크럼/사이드바 폴더/미지정/휴지통 드롭 각각 정상 · 사이드바 휠 스크롤 후 드롭 정확 · 접힌 폴더에는 못 넣음 · 사이드바 접힘 상태에서 타깃 없음 · 휴지통 문항을 폴더에 드롭 → 그 폴더로 · 이동 후 수정일 불변.
- T5 (S4) 기본 전부 보임 · 자동폭 = 가장 긴 셀 · 구분선 드래그·더블클릭 · 숨김/순서/폭/정렬 폴더별 저장, 다른 폴더에 안 샘 · 검증 칼럼 둘 · 공유 뷰 소유자·권한 무회귀 · `CSS.supports` subgrid true · **교대 색상**: 문항 행만 홀짝, 폴더 행은 세지 않음, 정렬을 바꿔도 첫 행부터 홀짝, hover가 alt 위에서 이김, sticky 제목행 아래 alt 행이 와도 둘이 구분됨(Q13 실물).
- T6 (S5) 체크 n건 끌어 사이드바 폴더에 놓기 → n건 이동 1회 리로드 · 선택 바 폴더 변경…/휴지통 · Escape 해제 · 선택 안 된 행 끌면 그 한 건만.
- T7 카드 보기 무회귀(칩·정렬·프리뷰·hover). T8 `npm run test:list` + 기존 341건 무회귀.

---

*v1 = web 계획. CLI v2가 subgrid `CSS.supports` · 제목행 높이 H · 폴더 수정일 계산 비용 · `MeasuringStrategy.Always`의 드래그 중 프레임 비용 · `KeyboardSensor` 전역화 부작용을 실측한다.*
