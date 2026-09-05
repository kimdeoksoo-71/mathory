# Phase 63 FolderView 디자인 개선 · 앱 전역 DnD — Final_V4 착수판 (CLI 통합)

*계보: 덕수 구상 `Phase63.md`(2026-09-05) → 타당성 검토 v1(web) → 계획서 v1(web) → v2(CLI 실측 · Q13~Q16 · §5-5 들여쓰기) → v3(web 재검증 + 덕수 추가 요청 — 칼럼 헤더 위치·고정, 일괄 검증 버튼) → **이 문서 = Final_V4 착수판(CLI 통합 · v3 실측 의뢰 3건 회신 · 정정 1건)**. 이 문서 하나가 자족적이다 — v1~v3은 중간 판본. 코드 인용은 `655ba23` 기준, dnd-kit 인용은 설치본 `@dnd-kit/core@6.3.1 dist/core.esm.js` 실측(§7). Q1~Q18 전항 판정 완료(Q17=B·Q18=예 — 권고대로, 실물 확인 잔여 3건은 §6).*

---

## 0. 한 장 요약

FolderView 기본 보기를 리스트로 바꾸고(비영속, 카드는 버튼), 리스트에 칼럼 체계(고정 2 + 선택 4 · 자동/조절 폭 · 폴더별 저장)와 하위 폴더 행을 넣고, **칼럼 헤더를 제목바 행 2로 올려 스크롤 밖에 고정**하고, **앱 전체 DnD 컨텍스트를 1개로 합쳐** 문항을 끄는 곳(카드·리스트 행·사이드바 최근 문항)과 놓는 곳(리스트 폴더 행·카드 칩·브레드크럼·사이드바 트리·미지정·휴지통)이 한 드래그로 이어지게 한다. 다중 선택 일괄 이동, 사이드바 좌측 들여쓰기 정리 포함.

**서버 0 · Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 전처리 0 · 렌더 5사이트 0.**
lib 변경 = `moveProblemsToFolder` 신설(writeBatch) + 이동 계열 `updated_at` 정리(Q14). 타입 1줄(`Folder.updated_at?`).

기존 결함 2건을 고친다: ① 빈 곳 드롭이 가장 가까운 폴더로 이동(두 컨텍스트 모두 `closestCenter`) ② 사이드바 폴더 행이 드롭 hover 시 2px 자란다(조건부 border — Phase 45a 함정의 실물).

---

## 0-1. 판본 통합 기록

- **v2(CLI)가 v1에서 고친 것**: 데이터 계약 불일치(FolderView DnD data에 `type` 없음) · droppable id 충돌(칩 id = 사이드바 sortable id) · `dragOverFolderId` 전역 상태의 리렌더 폭주 · folder 드래그의 closestCenter 모집단 · 이동 4경로의 `updated_at` · scopeKey 병합 · 그 외 라인 정정 다수.
- **v3(web)가 v2에서 고친 것**: `MeasuringStrategy.Always` 철회(F1 — dnd-kit `Rect` getter가 스크롤 델타를 이미 보정) · 사이드바 자동 스크롤은 over 노드 우선이라 **된다**(F2) · 그립 −13 → **−12**(F4 — `overflow:auto`가 패딩 박스 밖을 1px 자른다) · 하이라이트를 링+틴트로(F6 — border 불변) · `useDndContext` 대신 `DragKindContext`(F7) · 선택 바 위치를 행 1로(F3·D44) · 휴지통 기본 정렬 보완(F9·D41) · **칼럼 헤더 = 제목바 행 2**(D42~D43, 덕수 추가 요청) · 일괄 검증 버튼 리스트 전용(D45, 덕수 추가 요청).
- **v4(CLI)가 v3에서 고치고 확정한 것**:

| # | 내용 |
|---|---|
| **H1** | **정정 — D22의 폴백 분기 기준**: v3 F5의 "`pointerWithin` 결과가 비면 `rectIntersection` 폴백"은 **포인터가 빈 곳에 있을 때도 폴백이 돌아** 오버레이 사각형이 스치기만 해도 드롭된다 — "빈 곳 드롭 무동작"이 도로 무너진다. 분기 기준은 결과가 아니라 **입력**: `pointerCoordinates`가 있으면(포인터 드래그) `pointerWithin`만, 없으면(키보드) `rectIntersection`. 키보드 구제라는 F5의 목적은 그대로 달성된다 |
| **H2** | dnd-kit 인용 4건 설치본 대조 **전항 일치**: `Rect` getter 스크롤 보정 `core.esm.js:969-1002` · 기본 measuring `WhileDragging` `:2480-2486` · 자동 스크롤 `overNode ?? activeNode` `:2942, 2956` · `pointerWithin`의 `!pointerCoordinates → []` `:479-481` · `useSortable` data 병합 `sortable.esm.js:464-469` |
| **H3** | **D43 전제 headless Chrome 실측 확정**: 루트 grid의 `getComputedStyle().gridTemplateColumns` = `"24px 915.703px 92.3125px 75.9844px 28px"` — **px 목록**으로 온다(max-content·1fr 전부 해소). ⚠ **subgrid 행에서 읽으면 `"subgrid [] [] …"`가 온다** — 반드시 본문 grid **루트**에서 읽을 것. `CSS.supports('grid-template-columns','subgrid')` = true |

v3의 나머지 실측 의뢰 2건(행 2 안 헤더 카드 배분 · 선택 바가 행 1에 드는지)은 앱 실행이 필요한 실물 판정이라 §6 검수로 넘긴다.

---

## 1. 현행 실측 (v1 A표 + v2 정정 통합 · 확정본)

| # | 실측 | 근거 |
|---|---|---|
| A-1 | 보기 모드 `mathory.viewMode.<folderId>` localStorage 폴더별 영속. 공유 뷰 기본 `list`, 그 외 `card` | `FolderView:136-150` |
| A-2 | 휴지통·미지정은 `listAllowed=false` → 카드 고정. 미지정 카드 메뉴는 기본 메뉴(share·duplicate·trash)와 같다 | `:167-169, 253-266` |
| A-3 | 하위 폴더 칩 행 = `childFolders.length>0`일 때 제목바 행 2, `Droppable` 버튼. 카드·리스트 공통 렌더 | `:449-490` |
| A-4 | 제목바 래퍼 `minHeight: 98`(행 1 57 + 행 2 41). "가로 경계선 Y 통일" 주석의 그 선은 Phase 62 D5가 지웠다 | `:379, 383, 453` |
| A-5 | 카드 프리뷰 블록 로드는 카드 모드만. 리스트는 `useCommentCounts`(문항당 `listAllComments`+`listSessions` 2읽기)만 | `:226-241, 244` · `useCommentCounts:24-53` |
| A-6 | 카드 정렬 전역 키 `mathory-folder-sort` · 리스트 정렬은 `ListView` 지역 상태(언마운트마다 초기화) | `FolderView:39-52, 156-161` · `ListView:77` |
| A-7 | 리스트 기본 정렬 제목 오름차순 · 카드 수정일 내림차순 | `ListView:74-77` · `FolderView:40` |
| A-8 | 리스트 행·제목행이 독립 flex, 열 폭 고정 px(수정일 86 · ⋮ 28 · 소유자 120 · 권한 64) **두 곳 사본** | `ListView:150-160, 181-264` |
| A-9 | 배지 4종(댓글·Agent·검증·블록체인)은 제목 셀 안 인라인 | `ListView:192-210` |
| A-10 | 제목행 sticky 래퍼(`top:0; zIndex:2; padding '8px 0 4px'`) — **D42로 철거 대상** | `ListView:145-161` |
| A-11 | `ListView`는 FolderView `DndContext` 안. 카드만 `Draggable`, 칩만 `Droppable`, 단일 문항 | `FolderView:370-376, 553, 461, 181-188, 694-707` |
| A-12 | `dndEnabled = !isSpecial && childFolders.length > 0 && !!onMoveProblemToFolder` | `:176` |
| A-13 | 사이드바는 별도 `DndContext` — 폴더 `useSortable`(그립 활성) + 최근 문항 `useDraggable`. **data 계약: 사이드바만 `{type:…}` 보유** — FolderView는 카드 `{{ problem }}`·칩 `{{ folder }}`로 `type` 없음 | `Sidebar:872-878, 240-244, 539-544, 802-809` · `FolderView:553, 461` |
| A-14 | 사이드바 센서 `PointerSensor distance 8`+`KeyboardSensor` · FolderView `PointerSensor distance 8` | `Sidebar:740-743` · `FolderView:154` |
| A-15 | 두 컨텍스트 모두 `closestCenter` → 빈 곳 드롭 = 가장 가까운 타깃으로 이동(결함) | `Sidebar:874` · `FolderView:372` |
| A-16 | 사이드바 자동 스크롤: over 노드의 스크롤 조상 우선이라 **폴더 행 위에 있으면 닿는다**(행 사이 틈에서만 본문으로) — v1의 "안 닿는다"는 정정됨 | `core.esm.js:2942, 2956` · `Sidebar:882, 1066` |
| A-17 | 폴더 정렬은 같은 부모 안에서만, 다른 그룹 무시(재부모화는 ⋯ 메뉴) | `Sidebar:780-801` |
| A-18 | `moveProblemToFolder`가 `updated_at`을 찍는다. 복원 = 같은 함수(null). 픽커 경로도 같은 함수 | `firestore.ts:203-208` · `AppShell:552-560, 896-914` |
| A-19 | `folders.updated_at`은 저장되고 **`listFolders`가 이미 Date로 파싱해 싣는다** — TS `Folder` 타입에만 없다. 문항 출입엔 무반응(이름·아이콘·순서 변경일) | `firestore.ts:401-435, 426` · `types/problem.ts:274-282` |
| A-20 | 전체 문항 배열이 FolderView에 있다(칩 `(n)` 계산). `getDescendantIds`·`getChildren`·`getFolderPath` 존재 | `FolderView:459` · `AppShell:760` · `folder-tree.ts:62, 81, 89` |
| A-21 | '폴더 변경'(`move`→`FolderPickerDialog`)은 ContextMenu **기본 메뉴에 있다**(`:36`) — 사이드바 최근 문항 ⋮ 경유로 동작 중. FolderView·ListView가 자체 items로 덮어써 빠진 것 | `ContextMenu:32-40` · `AppShell:581-587, 896-914` |
| A-22 | 미지정·휴지통은 인라인 `<button>`(드롭 타깃 아님). 휴지통만 `paddingLeft: 34`. ShareTree는 `useState(true)` 기본 펼침·비영속 | `Sidebar:971-999, 1002-1048, 1011` · `ShareTree:30` |
| A-23 | `scroll-snap` 사용처 0. `.folder-row`/`.problem-card` hover는 globals.css 한 곳 | `globals.css:862-865` |
| A-24 | 공유 뷰 folder id `__shared_with_me__`/`__sent__`에는 `getChildren`이 빈 배열 → 폴더 행·DnD 자연 소등. **하위 스코프(상대별)가 같은 id를 공유한다** | `AppShell:800-816` |
| A-25 | 중첩 DndContext 2곳 더: `EditorView:3564`(블록 정렬) · `UserGroupEditor:175`(수식 그룹) — 센서가 draggable 노드에 바인딩되므로 전역 컨텍스트와 간섭 없음 | 실측 |
| A-26 | 사이드바 좌표(섹션 좌패딩 12px 안쪽 x0 기준): 헤더 텍스트 0 · 폴더 행 `paddingLeft 12+depth×16`(depth-0 아이콘 32) · 공유 직속 아이콘 32(래퍼 12+chevron 16+padL 4) · SubRow 46 · PersonRow 34/58 · 빈 문구 58 · **미지정 아이콘 12 vs 휴지통 34(어긋남)** · 그립 `left:-2` | `Sidebar:283, 298-319, 976, 1011, 265` · `ShareTree:168, 172, 185, 208, 231, 145, 51` |

---

## 2. 결정 (최종형 · D1~D45)

### 2-1. 보기 모드 · 스크롤 · 헤더 위치

| # | 결정 |
|---|---|
| **D1** | 보기 모드 **비영속 · 기본 리스트**. `VIEWMODE_KEY`·localStorage 삭제, `folder.id` 변화 시 `'list'` 리셋. 카드는 버튼으로만. 첫 로드에서 옛 `mathory.viewMode.*` 키 소거 |
| **D2** | `listAllowed` 폐지 — 휴지통·미지정도 리스트(기본). `ListView`에 `mode:'trash'`(⋮ = 복원·영구 삭제 — 카드 메뉴 `FolderView:254-257`과 동일). 리스트 빈 상태 문구도 mode별("휴지통이 비어 있습니다" 등 — `FolderView:517-521`과 동일 문구) |
| **D42** | **칼럼 헤더 = 제목바 행 2**(덕수 요청: 헤더를 위로 + 스크롤 고정, 한 수로 해결). 리스트 모드에서 칩 행이 빠진 자리(minHeight 41)에 헤더 카드(`--block-bg` · radius 8 · padding '6px 14px' — Phase 62 D7 시각 그대로)를 그린다. 제목바 래퍼는 카드·리스트 **둘 다 98**(D3′ 폐기 — 전환 시 본문 상단 부동). 헤더가 스크롤 밖이라 트랙패드 고무줄 오버스크롤에도 밀리지 않는다(`overscroll-behavior`로는 Safari 고무줄을 못 막는다 — 구조 이동이 정답). ListView sticky 래퍼(`:145-161`)는 **철거**(행이 헤더 위로 비칠 통로 자체가 없다 — stale 주석 "아이보리 0.9829"도 함께 사라진다) |
| **D43** | **헤더↔행 트랙 동기화**: 본문 grid 루트의 `getComputedStyle(root).gridTemplateColumns`(px 목록 — **H3 실측 확정, 반드시 루트에서**)를 헤더 grid의 template에 그대로 넣는다. 갱신 = 본문 루트 `ResizeObserver` 1개 + prefs 변경 effect. `max-content`·`1fr` 해석은 본문이 하고 헤더는 결과만 받는다(진실 한 곳). 시스템 스크롤바 "항상 표시" 환경은 헤더 컨테이너 `paddingRight = scroll.offsetWidth − scroll.clientWidth` 보정 |
| **D3(최종)** | 스크롤 컨테이너(`FolderView:499-503`): 리스트 모드 `scrollSnapType:'y proximity'` / 카드 모드·드래그 중 `'none'` **명시**(조건부 longhand 함정 — Phase 45a). `scrollPaddingTop: 8`(상수 — 헤더가 스크롤 밖이므로 ref 실측 불요, 첫 행 위 여백만). 문항·폴더 행 `scrollSnapAlign:'start'`. `mandatory` 금지(트랙패드 관성 붙잡힘 — 피로 기준 2026-08-29) |

### 2-2. 칼럼 체계

| # | 결정 |
|---|---|
| **D4** | 레지스트리 `lib/listColumns.ts`(import 0): `title`(고정 1열 `minmax(0,1fr)` · `localeCompare('ko',{numeric,base})` — 두 곳 사본 통합) · `blockchain`(없음0<수정됨1<인증2 — 판정식은 `BlockchainBadge:20-24`와 동일, 렌더는 배지 재사용이라 사본 없음) · `verify_problem`/`verify_solution`(없음<skip<ok<check<fail, stale 한 단 아래 — 값 구조 `{verdict, stale}`, 어휘는 `VERIFY_VERDICT_META`가 소유하되 import 0 규약상 순서 배열만 적고 검수에서 대조) · `agent`·`comments`(수) · `updated`(고정 마지막 열 · `UpdatedCell`의 24h 상대시각 유지) · `owner`/`perm`(received/sent 전용). 열 밖: 체크박스 24px · ⋮ 28px. 해시태그·배점·대단원은 미포함 — 스키마는 "모르는 id 무시, 새 id 뒤에 붙임" |
| **D5** | grid + subgrid: 루트 `24px minmax(0,1fr) [선택: max-content 또는 px] max-content 28px`, 각 행 `grid-column:1/-1; grid-template-columns:subgrid`. 행 padding 9/14는 첫·끝 트랙 인셋으로 흡수(헤더와 좌우 14 일치). 지원 Chrome 117·Safari 16·FF 71(Baseline 2023) — 폴백 없음, dev 콘솔 경고 1줄 |
| **D6** | prefs 스키마 v1: `{ v:1, hidden[], order[], widths{}, sort{key,dir} }` — 로드 시 레지스트리 검증(모르는 id 버림) |
| **D7** | 폭 조절: 헤더 셀 사이 1px 세로선(시각) + **히트 ±4px** · `cursor:col-resize` · `touchAction:'none'` · pointerdown에서 `setPointerCapture`(P7) + 시작 폭·커서 offset 캡처(Phase 62 D11 문법·스냅 0). 결과 = 그 트랙 `px`, 최소 40. 제목 열(1fr) 직접 조절 없음. **더블클릭 = 자동폭 복귀**(Q3). `onPointerDown` 전파 차단 |
| **D8** | 헤더 우측 끝(⋮ 자리) 칼럼 설정 버튼 → 팝오버: 선택 4개 체크박스 + ▲▼. 헤더 드래그 재배열 없음(정렬 클릭·폭 드래그와 제스처 겹침). 고정 열 미노출 |
| **D9** | localStorage `mathory.listPrefs.<scopeKey>`, scopeKey = `folder.id`(가상 폴더 포함). 기본 = 전부 보이기·레지스트리 순·자동폭·제목 오름차순. 공유 뷰는 `__shared_with_me__`/`__sent__` 단위로 병합 수용(Q16). 카드 정렬(전역 키) 현행 유지(Q1). ⚠ Phase 62 D11("폭 영속 없음")은 드로어·사이드바 결정 — 다른 대상 |
| **D10** | 헤더 클릭 = `toggleSort` 확장(레지스트리 비교자). 모든 비교자는 동률 시 **제목 tie-break**(count 정렬 안정화). `agent`·`comments`는 비동기 로드 후 1회 재정렬(수동 정렬이라 예측 가능 — 알고 두는 손실) |
| **D41** | `__trash__` scope의 prefs **기본 정렬만 `updated desc`**(Q18) — D1·D2로 휴지통 기본이 리스트(제목순)가 되면서 "최근 버린 순" 신호가 사라지는 것을 되살린다(Q14의 휴지통 스탬프 유지와 짝) |

### 2-3. 하위 폴더 행

| # | 결정 |
|---|---|
| **D11** | 리스트 모드: 칩 행 대신 `childFolders`를 `ListView`에 내려 **문항 행 위에 폴더 행**. 카드 모드 칩 현행 유지 |
| **D12** | 폴더 행 = 테두리·클레이 없음, 아이보리 바탕. 제목 열(`IconFolder`/`TwemojiImg`+이름+`(n)` — 직속 산식 `FolderView:459` 재사용, Q4)·수정일 열, 나머지 빈 칸. "클레이 = 문항"의 귀결이지 예외가 아니다 |
| **D13** | 클릭 = `onSelectFolder`, 펼치기 없음. hover = 배경 없이 이름 밑줄(브레드크럼 `:408-409` 문법) |
| **D14** | 폴더 정렬은 폴더끼리만 — `title`·`updated`에 반응, 그 외 키면 `order` |
| **D15** | 폴더 수정일 = 하위 트리 문항 `max(updated_at)`(Q8), 비면 `created_at`. 계산은 **한 패스** — 부모 맵 후 각 문항의 폴더에서 조상으로 올라가며 max 갱신, O(P×depth), `useMemo([problems, folders])`. `Folder.updated_at?: Date`는 타입 노출뿐(값은 이미 실려 온다 — A-19) |
| **D15′** | 폴더 행 높이 = 문항 행과 동일(padding 9·간격 4) — snap 균일 |

### 2-4. 앱 전역 DnD

| # | 결정 |
|---|---|
| **D21** | `DndContext` 1개, AppShell 루트(`:667`) 소유. 사이드바 `SortableContext` 제자리. 센서 `PointerSensor distance 8`+`KeyboardSensor`. AppShell 상태는 `activeDragItem`(dragStart 1회, 오버레이 라벨 겸용)뿐 — **`onDragOver` 핸들러 없음**. 드래그 종류는 `DragKindContext`(React Context, start·end 2회 변화)로 하향 — `useDndContext()`는 매 move마다 리렌더라 금지(61c "리렌더 자체가 버그") |
| **D22** | 충돌 판정(`components/ui/dnd.tsx` 함수 1개): `active.data.current.type==='folder'` → `droppableContainers`를 `data.current.sortable` 보유로 **필터한** `closestCenter`(사이드바 트리만 후보) / 그 외 → **`pointerCoordinates`가 있으면 `pointerWithin`만, 없으면(키보드) `rectIntersection`**(H1 — "결과가 비면 폴백"이 아니다). 빈 곳 드롭 = 무동작 |
| **D23** | 데이터 계약 통일: 소스 `{type:'problem', problem}`·`{type:'problems', problems}` / 타깃 `{type:'folder', folder}`·`{type:'unassigned'}`·`{type:'trash'}`. FolderView 칩·카드에 type **추가**(현행 누락 — A-13). 핸들러 분기: folder→정렬(`Sidebar:780-801` 이관, 재부모화 없음) / problem·problems→이동 |
| **D34** | id 네임스페이스: 사이드바 폴더 sortable만 맨 `folder.id`(SortableContext items 앵커). 그 외 프리픽스 — 칩 `chip:{fid}` · 리스트 폴더 행 `frow:{fid}` · 브레드크럼 `crumb:{fid}` · `drop:unassigned` · `drop:trash` · 카드 `card:{pid}` · 리스트 행 `prow:{pid}` · 사이드바 최근 `problem-{pid}`(현행). **핸들러는 id를 파싱하지 않는다** — 대상은 data로만(id는 유일성 전담) |
| **D24** | 드래그 소스 = 카드·리스트 행·사이드바 최근 문항. 조건 = `user && p.authorUid===user.uid && !공유 뷰(passthrough·listContext)`. **휴지통·미지정 문항 포함**(Q10 전제 — 현행 `isSpecial` 제외를 푼다). "하위 폴더 있을 때" 조건 삭제 |
| **D25** | 드롭 타깃 = 리스트 폴더 행 · 카드 칩 · 브레드크럼(현재 폴더 제외 — `slice(0,-1)`이 보장) · 사이드바 폴더 트리(펼쳐진 것만 — `flattenVisible` 자연 성립) · 미지정(`folder_id:null`) · 휴지통(=trash 액션, Q9). 접힘 사이드바 타깃 없음(목록 미렌더 — 자연 성립, Q12). spring-loading 후속(Q11). 폴더→폴더 재부모화 DnD 없음 |
| **D26** | 유효성은 AppShell 핸들러 한 곳. 같은 폴더 무시 = **null 정규화** `(problem.folder_id || null) === (targetId || null)`(미지정은 null·'' 공존 — `FolderView:194`). 휴지통 문항→폴더 = 그 폴더로 복원(Q10). 실패 `alertDialog`(M2 A) |
| **D27** | `isOver` 하이라이트 한 문법 = **`boxShadow: 0 0 0 2px rgba(91,106,191,.25)` 링 + 배경 틴트 `rgba(91,106,191,.12)`, border 불변**(칩 `FolderView:470-471` 형태) — 사이드바 현행 조건부 2px border(`Sidebar:284`)는 over 시 행이 자라는 결함이라 철거. **problem 계열 드래그일 때만** 켠다(`DragKindContext` 판독 — folder 정렬 중 무반응) |
| **D28** | `DragOverlay` 한 벌(AppShell 루트): problem = 액센트 알약(`FolderView:696-705`) · problems = "문항 n개" · folder = **null**(sortable 제자리 변형). 사이드바 흰 카드 `📄` 제거 |
| **~~D29~~** | **철회**(v3 F1) — `measuring` prop 없음, 기본 `WhileDragging`. dnd-kit `Rect` getter가 읽는 시점마다 스크롤 델타를 보정하므로(§7) 휠로 내려도 드롭 사각형이 낡지 않는다 |
| **D30** | FolderView 스프레드에서 `onKeyDown` 제외(전역 KeyboardSensor가 카드 Space 드래그를 못 열게). ⋮ 버튼들은 이미 `onPointerDown` 차단 보유(`ListView:250` 등) — 신설 체크박스·폭 핸들·`<select>`에만 추가 |
| **D31** | 오버레이는 AppShell 루트 — 리사이즈 핸들(z 100) 위, `aside overflow:hidden` 무관 |

### 2-5. 다중 선택 · 일괄 이동

| # | 결정 |
|---|---|
| **D16** | 선택 UI = 체크박스 열(맨 왼쪽 24px, **my·미지정·휴지통 리스트 전용** — 공유 뷰는 이동 권한이 없어 미노출). 행 클릭은 `onView` 유지, Shift-클릭 범위는 체크박스 위에서만 |
| **D17** | 선택 ≥1이면 **행 1 우측 컨트롤 자리**(`FolderView:423-437` — 토글·정렬·일괄검증)를 선택 바("n개 선택 · 폴더 변경… · 휴지통 · 해제")가 대체(v3 D44 — 행 2 헤더가 남으므로 D20과 모순 없음, 높이 변화 0). trash 모드 액션 = "복원 · 영구 삭제(확인) · 해제". 폴더 변경… = `FolderPickerDialog` 재사용. ⋮ 메뉴에 '폴더 변경' 추가(A-21) |
| **D18** | Finder 의미론: 끌기 시작한 행이 선택에 있으면 선택 전체(`{type:'problems'}`), 아니면 그 한 건 |
| **D19** | `moveProblemsToFolder(ids, folderId|null)` — `writeBatch`, **500개 청크 루프**. `loadData()` 끝에 1회. 내부 규칙: `folderId===TRASH_FOLDER_ID`일 때만 `updated_at` 스탬프(호출부 분기 금지 — 갈래 방지) |
| **D20** | 선택 해제 = 폴더 변경·보기 전환·이동 완료·Escape. **정렬 변경엔 유지**(헤더가 행 2에 남아 성립) |
| **D20′** | `updated_at` 경계(Q14): `moveProblemToFolder`·`deleteFolder`의 미분류 이동(`firestore:469`)은 스탬프 **제거** / `moveToTrash`(`firestore:559-564`)는 **유지**(휴지통에서 "버린 시각" 신호 — D41과 짝). 복원·픽커 이동도 무스탬프가 된다(수용) |
| **D35** | 다중 선택 → 휴지통(드래그·버튼)만 `confirmDialog`(Q15). 단건 드래그·⋮는 현행대로 무확인(`AppShell:527-533`) |

### 2-6. 교대 색상 · 사소 항목

| # | 결정 |
|---|---|
| **D32** | ShareTree 기본 접힘 — `:30` `useState(true)→false`. 세션 내 상태 |
| **D33** | 리스트 zebra — 문항 행만, 렌더 인덱스 `i%2`로 `.is-alt` 부여(`:nth-child` 금지 — 헤더·폴더 행·선택 바가 형제로 섞여 패리티가 어긋난다). 폴더 행은 세지 않는다 |
| **D33′** | 기계장치 = `--card-surface` 변수 갈아끼우기(Phase 62 문법·`!important` 0). globals.css 순서 = `alt → hover → selected`(셋 다 (0,2,0) — 뒤가 이긴다, Phase 59a F1). **톤 = 후보 C `#F8F4EE`(Q13, 신규 토큰 `--row-alt`, `:root`)** — 다섯 단(바탕 0.9572 / alt 0.9083 / 클레이 0.8674 / 헤더 0.8275 / hover 0.7439, ΔL\* 2.0·1.7·1.7·3.8)이 전부 산다. 명암비 최악값(hover) 불변 — Phase 58·59a 계산 유효. S4 실물 확인(뒤집히면 A는 값 한 줄) |
| **D36** | selected가 hover를 이기는 것은 의도(선택 표시 우선). selected 행의 hover 피드백 상실 수용 |
| **D45** | [일괄 검증] 버튼은 **리스트 모드에서만** — 노출 조건에 `effectiveViewMode==='list'` 추가(`batchAllowed` 자체·다이얼로그·게이트 불변). dev 콘솔 사유 effect(`FolderView:210-216`)에 '카드 보기' 분기 1줄 |

### 2-7. 사이드바 들여쓰기 정리 (§좌측 공간 절약)

| # | 결정 |
|---|---|
| **D37** | depth-0 들여쓰기 12px 제거 — My 폴더 `paddingLeft: depth×16`(`Sidebar:283`) · ShareTree ParentRow 래퍼 12→0(`ShareTree:168`). 두 트리 직속 **아이콘 x 20 일치** 유지. 위계는 글꼴 두께 + chevron 슬롯 자체 들여쓰기로 충분(덕수 판정) |
| **D38** | 미지정·휴지통 `paddingLeft 0` 통일(휴지통 34 삭제) — 아이콘 x 0. chevron 없는 특수 폴더가 일반 폴더(x 20)보다 왼쪽 = **의도된 구별**, 슬롯을 채워 맞추지 말 것 |
| **D39** | 그립 `left: -2 → **-12**`(v3 F4) — 섹션 컨테이너가 `overflow:auto`라 패딩 박스 밖은 잘린다. −12(폭 12)가 거터 12px에 정확히 들어차고 chevron 슬롯(0~14)과 경계만 접한다. −13은 왼쪽 1px 잘림 |
| **D40** | ShareTree 하위 단 12px씩 당김 — SubRow 46→34 · PersonRow 34→22 / 58→46 · 빈 문구 58→46. My 트리는 D37 식이 자동 처리(depth-1 chevron 16, 아이콘 36) |
| **D40′** | active/hover 알약 좌변(Q17=**B**): 항목 버튼 `marginLeft:-8; paddingLeft:8+depth×16`(ShareTree ParentRow·미지정·휴지통은 `-8`/`8`) — 콘텐츠 x 0 유지, 알약만 거터로 8px 확장(거터 12 안이라 잘림 없음). 그립(−12~0, hover 전용, zIndex 1)이 알약 확장부 위에 얹히는 것 무해. S6 실물 확인(밀착이 나으면 A = margin/padding 두 값 삭제) |

접힘(collapsed) 사이드바는 폴더 목록·ShareTree 미렌더(`Sidebar:943, 1052`) — 무영향.

---

## 3. 판정 기록 (Q1~Q18 전항 확정)

Q1 정렬 저장 리스트만 · Q2 검증 칼럼 둘 · Q3 더블클릭 자동폭 · Q4 폴더 행 `(n)` · Q5 (D42로 대체 — 제목바 둘 다 98) · Q6 브레드크럼 드롭 · Q7 이동 `updated_at` 미갱신 · Q8 폴더 수정일 = 하위 최대 · Q9 휴지통 드롭 · Q10 휴지통→폴더 = 복원 · Q11 spring-loading 후속 · Q12 접힘 타깃 없음 · **Q13 zebra = C**(S4 실물) · **Q14 스탬프 = 휴지통행만**(D20′) · **Q15 다중만 확인**(D35) · **Q16 공유 키 병합 수용**(D9) · **Q17 알약 = B**(D40′, S6 실물) · **Q18 휴지통 기본 정렬 updated desc**(D41).

실물 판정 잔여 3: Q13 톤 · Q17 알약 · 행 2 헤더 카드 배분(§6 T3).

---

## 4. 범위 · 파일

| 파일 | 변경 |
|---|---|
| `lib/listColumns.ts` | **신설** import 0 — 레지스트리·비교자(tie-break)·prefs 검증/직렬화·`__trash__` 기본 정렬 예외(D41). `npm run test:list`(`test:batch` 문법 복제) |
| `hooks/useListPrefs.ts` | **신설** — scopeKey 읽기/쓰기, SSR 가드 |
| `components/ui/dnd.tsx` | **신설** — `Draggable`/`Droppable` 렌더프롭 이주(`FolderView:87-105`) · 충돌 판정(D22 — sortable 필터·pointerCoordinates 분기) · `DragKindContext` · 하이라이트 상수(링+틴트) · id 네임스페이스 헬퍼 |
| `components/layout/AppShell.tsx` | `DndContext` 소유(start/end/cancel·`measuring` 없음) · `DragKindContext.Provider` · `DragOverlay` · `handleMoveProblemsToFolder` · 드롭 유효성(D26) |
| `components/layout/Sidebar.tsx` | 컨텍스트·센서·핸들러·오버레이 제거(`:740-743, 745-815, 872-879, 1101-1121`) · 폴더 행 하이라이트 = 자체 `isOver` + 링/틴트(border 조건부 삭제, `:284`) · 미지정·휴지통 Droppable화(`:971-999, 1002-1048`) · 들여쓰기(D37~D40′: `:283` 식 · `:976`·`:1011` · 그립 `:265` −12) |
| `components/layout/ShareTree.tsx` | `:30` 기본 접힘 · 들여쓰기(D37·D40·D40′: `:168, 185, 208, 231, 145`) |
| `components/problem/FolderView.tsx` | 컨텍스트 제거 · viewMode 비영속 · `listAllowed` 폐지 · 행 2 = 리스트 모드 `ListHeader` / 카드 모드 칩(D42) · 행 1 우측 = 선택 바 대체(D17) · snap(D3) · 브레드크럼 Droppable · 칩·카드 data type 추가 · [일괄 검증] 리스트 조건(D45) · ListView에 folders·onSelectFolder·선택 전달 |
| `components/problem/ListView.tsx` | **대부분 교체** — sticky 래퍼 철거(D42) · `ListHeader` 별도 export(정렬·폭 핸들·칼럼 설정 팝오버 — FolderView 행 2에서 렌더) · 본문 grid 루트 + subgrid 행 · `ResizeObserver` 트랙 동기화(D43) · 폴더 행 · 체크박스 · `mode:'trash'`+빈 문구 · ⋮ '폴더 변경' · 행 Draggable(type 명시) |
| `components/ui/VerifyBadge.tsx` | `kinds?` prop |
| `lib/firestore.ts` | `moveProblemsToFolder` 신설(청크·TRASH만 스탬프) · `moveProblemToFolder`·`deleteFolder` 스탬프 제거 · `moveToTrash` 불변(Q14) |
| `types/problem.ts` | `Folder.updated_at?: Date` |
| `app/globals.css` | `--row-alt` 토큰 + `.folder-row.is-alt` · 폴더 행 hover 밑줄 · 폭 핸들 · 체크박스 열 · isOver 링/틴트 공용 클래스 |

상태(prefs·정렬·선택)는 FolderView가 들고 `ListHeader`·`ListView`에 내린다(헤더와 본문이 다른 부모 — 이번 개정의 유일한 구조 변화).

---

## 5. 착수 순서 (독립 커밋 · 검수 후 다음)

| 단계 | 내용 | 검수 핵심 |
|---|---|---|
| **S0** | 컨텍스트 1개화(D21) + 계약 통일(D23) + 네임스페이스(D34) + 충돌 판정(D22·H1) + `DragKindContext` + 오버레이·하이라이트(D27·D28) + 공유 접힘(D32) | 폴더 정렬 무회귀 · 빈 곳 드롭 무동작 · **에디터 블록·수식 그룹 DnD 무회귀** · over 시 사이드바 행 높이 불변 |
| S1 | 보기 모드(D1) · `listAllowed` 폐지(D2) · [일괄 검증] 리스트 조건(D45) | 진입마다 리스트 · 휴지통 메뉴·문구 · 카드에서 버튼 숨김+콘솔 사유 |
| S2 | 헤더 행 2 이동(D42) · sticky 철거 · snap(D3) | 고무줄 오버스크롤에 헤더 부동 · 전환 시 본문 상단 부동 · 배분 실물(행 2 안 15px + 위 8px) |
| S3 | 폴더 행(D11~D15′) · 행 Draggable · 브레드크럼·미지정·휴지통 Droppable(D24~D26) · 스탬프 경계(D20′) · 휴지통 정렬(D41) | 폴더 행 정렬 분리 · 수정일 = 하위 최신 · 트리 이동 · 복원 경로 둘 · 휴지통 "버린 순" 유지 |
| S4 | 칼럼 체계(D4~D10) + 트랙 동기화(D43) + zebra(D33·Q13 실물) | 자동폭 · 조절·더블클릭 · 폴더별 저장 · 공유 뷰 무회귀 · 헤더↔열 정렬 · zebra 실물 |
| S5 | 다중 선택·일괄 이동(D16~D20·D35) | n건 1회 이동 · 선택 바(행 1) · Escape · 다중 휴지통 확인 · 정렬 중 선택 유지 |
| S6 | 사이드바 들여쓰기(D37~D40′, Q17 실물) — 다른 단계와 독립(S0 이후 권장 — 그립 좌표 중복 수정 방지) | 두 트리 아이콘 x 20 일치 · 미지정=휴지통 x 0 · 그립 무잘림·무겹침 · 알약 실물 |

S0가 기초이자 회귀 위험(폴더 정렬) 최대라 맨 앞. S4가 전체의 절반 이상.

---

## 6. 검수 항목

- **T1 (S0)** 폴더 그립 드래그 형제 순서 변경 정상 · 다른 부모 드롭 무시 · 최근 문항→폴더 이동, **빈 곳 무동작** · 카드→칩 이동, 빈 곳 무동작 · 같은 폴더가 칩과 트리에 동시에 보일 때 양쪽 드롭 정상(id 충돌 부재) · 폴더 드래그 중 칩·행·미지정·휴지통 무반응(D27) · **over 시 사이드바 폴더 행 높이가 변하지 않음**(F6) · 키보드로 최근 문항을 폴더에 놓을 수 있음(H1) — 포인터 빈 곳 드롭은 여전히 무동작 · 오버레이 한 디자인 · 공유 섹션 접힘 · **에디터 블록 드래그·설정 수식 그룹 드래그 무회귀** · React DevTools로 드래그 중 over 변화가 타깃 외 리렌더를 만들지 않음(개발 중 1회, F7)
- **T2 (S1)** 폴더 진입마다 리스트 · 카드로 바꾸고 재진입하면 리스트 · 옛 viewMode 키 소거 · 휴지통·미지정 리스트 + 메뉴(복원·영구 삭제)·빈 문구 · 카드 보기에서 [일괄 검증] 숨고 리스트에서 복귀 + dev 콘솔 사유
- **T3 (S2)** **트랙패드 고무줄 오버스크롤에서 헤더 부동** · 카드↔리스트 전환 시 본문 상단 y 부동 · 헤더 카드가 행 2(41px) 안에 자연 배치(실물) · 첫 행 snap이 헤더 아래 8px에 멈춤 · 관성 걸림 없음 · 드래그 중 떨림 없음 · 카드 모드 무영향
- **T4 (S3)** 폴더 행 아이보리·무테두리·아이콘+이름+(n)+수정일 · 클릭 진입 · 폴더끼리만 정렬 · 수정일 = 하위 트리 최신 · 리스트 행→폴더 행/브레드크럼/트리/미지정/휴지통 각각 정상 · **문항을 사이드바 폴더 행 위에서 목록 가장자리로 가져가면 자동 스크롤**(F2) · 휠로 내린 뒤 드롭 정확(F1 — 재측정 없이) · 접힌 폴더 불가 · 접힘 사이드바 타깃 없음 · 휴지통 문항→폴더 복원 · 이동 후 수정일 불변 · 미지정→미지정 무동작(null 정규화) · 휴지통 리스트가 최근 버린 순(D41)
- **T5 (S4)** 기본 전부 보임 · 자동폭 = 가장 넓은 셀 · 구분선 드래그(±4px 히트)·더블클릭 · 숨김/순서/폭/정렬 폴더별 저장·타 폴더 무누출 · 검증 칼럼 둘·stale 한 단 아래 · count 동률 제목순 안정 · 공유 뷰 owner·perm 무회귀·prefs 분리 · 창 폭 변경에도 헤더↔열 정렬(D43) · 폭 핸들 드래그에 헤더·행 동시 이동 · 시스템 스크롤바 "항상 표시"에서 무어긋남 · zebra: 문항 행만·폴더 행 미포함·정렬 변경 시 첫 행부터·hover가 alt 위에서 이김·헤더 아래 alt 행 구분(Q13 실물)
- **T6 (S5)** 체크 n건 → 사이드바 폴더 드롭 = n건 1회 이동·1회 리로드 · 선택 바가 행 1에 들어감(긴 폴더명 ellipsis 실물) · 선택 중 헤더 정렬 클릭에 선택 유지 · Escape 해제 · 미선택 행 끌면 그 한 건 · 다중→휴지통 확인, 취소 무변경 · trash 모드 선택 바(복원·영구 삭제)
- **T7** 카드 보기 무회귀(칩·정렬·프리뷰·hover·DnD). **T8** `npm run test:list` + 기존 341건 무회귀
- **T9 (S6)** My depth-0·공유 직속 아이콘 x 20 일치 · 미지정=휴지통 x 0(폴더 아이콘보다 왼쪽) · 헤더와 직속 행 좌단 일치 · 그립이 왼끝에서 안 잘리고 chevron 무겹침 · depth-1 이하 상대 단차 보존 · ShareTree 하위 12px 당김 · 알약 좌변 실물(Q17=B, 아니면 A 롤백) · 접힘 무영향

---

## 7. 실측 부록

**dnd-kit `@dnd-kit/core@6.3.1 dist/core.esm.js` (설치본 대조 완료)**
- `Rect` 클래스: 생성 시 스크롤 조상·오프셋 스냅샷, `top/left/right/bottom` **getter에서 현재 오프셋과의 델타를 매번 가산**(`:969-1002`) → 드래그 중 스크롤에도 드롭 사각형 유효(D29 철회 근거)
- 기본 measuring: `droppable.strategy = MeasuringStrategy.WhileDragging`, `frequency = Optimized`(`:2480-2486`)
- 자동 스크롤 대상: `overNode ?? activeNode`의 스크롤 조상(`:2942, 2956`) → 사이드바 목록 자동 스크롤 성립(A-16 정정 근거)
- `pointerWithin`: `!pointerCoordinates → []`(`:479-481`) → H1의 키보드 분기 근거
- `useSortable` data: `{ sortable: {containerId, index, items}, ...customData }` 병합(`sortable.esm.js:464-469`) → D22 필터 근거

**subgrid probe (headless Chrome, H3)**
- 루트: `getComputedStyle(root).gridTemplateColumns` = `"24px 915.703px 92.3125px 75.9844px 28px"`(max-content·1fr 전부 px 해소)
- subgrid 행: `"subgrid [] [] [] [] [] []"` — **읽기 금지, 루트에서만**
- `CSS.supports('grid-template-columns','subgrid')` = `true`

**휘도 사다리 (전 값 재계산 검증, sRGB → Y → L\*)**

| 자리 | 색 | Y | L\* |
|---|---|---|---|
| 바탕 `--bg-functional` | `#FCFAF6` | 0.9572 | 98.3 |
| alt `--row-alt`(Q13=C) | `#F8F4EE` | 0.9083 | 96.3 |
| 행 클레이 `--bg-content` | `#F4EFE7` | 0.8674 | 94.6 |
| 헤더 `--block-bg` | `#F0EAE0` | 0.8275 | 92.9 |
| hover `--block-bg-active` | `#E8DFCE` | 0.7439 | 89.1 |

(참고: `ListView:144` 주석의 "아이보리 0.9829"는 `--bg-card #FEFDFB`의 값 — sticky 래퍼와 함께 사라진다.)

---

## 8. 구현·검수 기록 (2026-09-05~06 · 전 단계 완료)

**커밋 13개**: S0 `adeb734` · S1 `f354832`+검수 `47dc0fb` · S2 `417ac26`+D3 개정 3연 `a2208fe`/`ab5f184`/`e8e72ca`+`a201a22` · S3 `af30a8b` · S4 `c157196` · S5 `24d8a6f`+`5676618` · S6 `5db7068`.
**검수**: T1~T9 전항 통과(덕수, 단계별 즉시 검수 — 지적 6건 전부 당회 반영). **테스트 356건**(기존 341 무회귀 + `test:list` 15 신설). 배포 대기.

### 8-1. 구현 중 계획 개정 (v4 → 실물)

| # | 개정 | 내용 |
|---|---|---|
| **G1** | **D3 재재개정 — 행 정렬은 CSS 스냅이 아니라 scrollend JS다** | proximity·mandatory 둘 다 **실기기(macOS 트랙패드)에서 완전 무동작**(T3 검수 2회). CDP 합성 휠 프로브에서는 둘 다 스냅했으므로(235→270 = 행 피치 54 배수) 소스·구조 문제가 아니라 실기기 스크롤 경로의 브라우저 동작 → 스크롤이 멈춘 순간(`scrollend`, 미지원은 scroll 140ms 디바운스)에만 가까운 행으로 smooth 정렬. 스크롤 중 저항 0. 대상은 `[data-snap-row]` 마크. **CSS scroll-snap을 이 앱에서 다시 시도하지 말 것** |
| **G2** | **상단 8px sticky 마스크 부활** | 정렬 후에도 이전 행 꼬리 4px+라운드가 상단 여백 틈(정렬선 +8 vs 행 간격 4)에 비쳤다 — **Phase 62 D7이 경고한 바로 그 함정**("상단 패딩 띠를 행이 통과하며 보인다"). 선례 처방(아이보리 sticky 띠 8px)이 paddingTop 8을 대체 — 헤더 없는 띠라 D42(sticky 헤더 철거)와 모순 없다 |
| **G3** | **바닥에서는 위로 당겨 정렬 + paddingBottom 32→72** | 바닥 클램프로 정렬을 포기하면 역방향 끝에서 윗행이 걸친다(T3 4회차). 후보를 목표선 위/아래 두 행으로 잡고 도달 가능한 쪽 중 가까운 행으로 — 바닥에선 위로 당긴다. 72 = 당김(최대 한 행 피치 ≈44) 후에도 마지막 행이 잘리지 않을 슬랙 |
| **G4** | **유령 라벨 행(D5 보완)** | 자동폭 실측은 본문만 보므로 헤더 라벨("검증(문제)")이 셀보다 넓으면 헤더가 잘린다 — 본문 grid에 높이 0·불가시 라벨 행을 넣어 max-content 트랙이 라벨 폭을 포함(D5 "제목행 라벨 포함"의 구현). 지정 px 트랙에는 무영향 |
| **G5** | 좌우 인셋 = 스페이서 트랙 2px + columnGap 12 | subgrid에 컨테이너 패딩을 주면 첫·끝 트랙이 부모와 어긋난다 — 셀 단위 패딩 대신 가장자리 트랙으로 |
| **G6** | `onMoveProblemToFolder` prop 소멸 | 드롭이 AppShell 전역 핸들러로 가면서 게이트 역할까지 `dragUid`가 대체 — FolderView·Sidebar에서 prop 제거 |
| **G7** | 폴더 행 그 외 키 정렬 = 이름순 | D14의 "그 외 키면 order"를 이름순으로 — 정렬 키가 서열 칼럼일 때 폴더가 무의미한 order로 섞이는 것보다 이름이 안정 기준 |

### 8-2. 검수 반영 (지적 → 당회 수정)

- **T2**: 영구 삭제 후 홈 강제 이동 제거(휴지통에 머묾 — 그 문항을 열람 중일 때만 홈) · ⋮ 복원 후 **미지정으로 자동 이동**(`47dc0fb`)
- **T3**: G1~G3(스냅 4연 왕복 — proximity → mandatory → scrollend JS → 마스크+바닥 당김)
- **T5**: 칼럼 설정 체크박스 **로고 레드**(`--mathory-red`) · **Agent 칼럼 셀은 숫자만**(라벨은 헤더 몫)
- **T6**: **헤더 전체선택 체크박스**(체크박스 트랙, 일부 선택 = indeterminate, `5676618`)
- Q13(zebra=C)·Q17(알약=B) 실물 판정 **채택 확정**(T5·T9)

### 8-3. 새 규약 (CLAUDE.md 이관 대상)

- DnD 컨텍스트는 AppShell 하나 — 소스·타깃 data에 `type` 필수, id는 `dndId` 네임스페이스, 충돌 판정은 `pointerCoordinates` 유무 분기(H1), 드래그 종류는 `DragKindContext`(`useDndContext()` 금지 — 매 move 리렌더), 하이라이트는 링+틴트 border 불변, 소스 스프레드에서 `onKeyDown` 제외
- 이동은 `updated_at`을 찍지 않는다 — `moveToTrash`·`moveProblemsToFolder(TRASH)`만 예외("버린 시각", 휴지통 기본 정렬 updated desc가 읽는다)
- 리스트 칼럼의 진실은 본문 grid 루트 하나 — 헤더는 실측 템플릿 소비(`getComputedStyle`는 **루트에서만** — subgrid 행은 `"subgrid …"`를 돌려준다)
- prefs 검증·서열은 `lib/listColumns.ts`(import 0 · `npm run test:list`) — verdict 어휘는 `VERIFY_VERDICT_META`와 이중이라 어휘 추가 시 양쪽 함께

---

*Final_V4 = 착수판 + §8 구현 기록 = 실행판. 확정본은 `docs/phasedocs/`에 있다(작업 규칙 7). v1~v3·구상은 phaseSketch의 중간 판본.*
