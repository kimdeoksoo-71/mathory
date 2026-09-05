# Phase 63 FolderView 디자인 개선 · 앱 전역 DnD — 구현 계획서 v2 (CLI 실측 교차검토)

*계보: 덕수 구상 `Phase63.md`(2026-09-05) → 타당성 검토 v1(web) → 계획서 v1(web) → **이 문서 = v2(CLI 실측)**. v1의 A-1~A-24·D1~D33을 전량 코드 대조했고, 휘도 표는 전 값 재계산으로 검증했다(오차 0). 인용은 로컬 working tree(= `655ba23` + 미커밋 phaseSketch 2건뿐) 기준. **Q13~Q16 덕수 판정 완료(2026-09-05, 전항 권고대로) + 사이드바 들여쓰기 정리(§5-5) 추가 지시 반영.** 다음은 web v3 재검증.*

---

## 0. 한 장 요약 (v1과 같음 · 밑줄이 v2 변경)

FolderView 기본 보기를 리스트로, 리스트에 칼럼 체계 + 하위 폴더 행, **앱 전체 DnD 컨텍스트 1개화**로 문항을 끄는 곳과 놓는 곳이 한 드래그로 이어지게 한다. 다중 선택 일괄 이동 포함. <u>+ 사이드바 좌측 들여쓰기 정리(§5-5, 덕수 추가) — depth-0 들여쓰기 제거·미지정/휴지통 좌측 정렬 통일.</u>

**서버 0 · Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 전처리 0 · 렌더 5사이트 0.** lib 변경은 `moveProblemsToFolder`(writeBatch) + <u>이동 계열 함수의 `updated_at` 정리(경계는 Q14)</u>. 타입 1줄(`Folder.updated_at`).

기존 결함 1건(D22 — 빈 곳 드롭이 가장 가까운 폴더로 이동) 수정 유지. <u>v2가 추가로 확정한 통합 전제 2건: **데이터 계약 통일(E1)** · **id 네임스페이스(E2)** — 이 둘 없이 컨텍스트만 합치면 조용히 오동작한다.</u>

---

## 0-1. v2 정정·확정 요약 (E1~E14)

v1 실측표는 **대부분 정확**하다(A-1~A-12·A-14~A-16·A-18~A-20·A-23~A-24 라인 인용 전항 일치, §5-4 휘도 표 전 값 재계산 일치). 아래만 고친다.

| # | 정정/확정 | 내용 |
|---|---|---|
| **E1** | **A-13 정정 — "데이터 계약 동일"은 틀렸다** | 사이드바만 `{type:'problem', problem}` / `{type:'folder', folder}`(`Sidebar:543, 242`)이고, **FolderView는 `type` 필드가 없다** — 카드 `data={{ problem }}`(`FolderView:553`) · 칩 `data={{ folder: cf }}`(`:461`). 통합 핸들러는 type으로 분기하므로 그대로 합치면 카드 드래그가 **어느 분기에도 안 걸려 무음 실패**한다. → FolderView 소스·타깃 전부에 type 명시(D23′) |
| **E2** | **신규 위험 — droppable id 충돌** | 칩 id = `cf.id`(`FolderView:461`), 사이드바 폴더 `useSortable` id = `folder.id`(`Sidebar:241`). 지금은 컨텍스트가 둘이라 무사하지만 **합치는 순간 같은 폴더가 두 번 등록**된다(dnd-kit 레지스트리는 id 키 — 나중 등록이 덮어써 한쪽 타깃이 조용히 죽는다). → id 네임스페이스 규약 D34 |
| **E3** | A-21 정정 | '폴더 변경'은 `ContextMenu` **기본 메뉴에 있다**(`ContextMenu:36`, `action:'move'`) — 사이드바 최근 문항 ⋮가 이걸 써서 이미 노출된다. 빠진 것은 FolderView·ListView가 **자체 items로 기본 메뉴를 덮어쓴** 자리다. 실무 결론(⋮에 '폴더 변경' 추가)은 불변 |
| **E4** | A-22 정정 | 미지정·휴지통은 `SidebarItem`이 아니라 **인라인 `<button>`**(`Sidebar:971-999` · `:1002-1048`)이고, `Sidebar:1051-1063`은 ShareTree 렌더부다. 실무 영향: Droppable화는 SidebarItem 확장이 아니라 그 버튼 두 개를 감싸는 작업 |
| **E5** | A-17 라인 정정 | 폴더 정렬 로직은 `Sidebar:780-801`(768은 `handleDragOver`). A-16도 `:882`·`:1066` |
| **E6** | **D21 정정 — `dragOverFolderId` 전역 상태 금지** | v1은 "AppShell `dragOverFolderId` 상태 → 각 항목 isOver"였는데, `onDragOver`는 드래그 내내 발화하므로 AppShell setState = **드래그 중 매 over 변화마다 앱 전체(사이드바+FolderView 전 행) 리렌더**다. 61c의 교훈("선택 위에 얹힌 UI에서 리렌더 자체가 버그")의 드래그판. → 하이라이트는 각 타깃이 **자기 `isOver`**(useDroppable/useSortable이 둘 다 노출)와 `useDndContext().active.data.current.type`으로 자체 판정. AppShell은 start/end/cancel + 오버레이 라벨만 |
| **E7** | **D22 보강 — folder 드래그의 closestCenter도 전 타깃 대상이면 안 된다** | 통합 후 droppable 모집단에 칩·리스트 폴더 행·브레드크럼·미지정·휴지통이 들어온다. folder 드래그에 맨 closestCenter를 주면 **본문 타깃이 over가 되어** 정렬 미리보기가 흔들리고 드롭이 무시로 끝난다. → folder 드래그는 `droppableContainers`를 `data.current.sortable` 보유(= 사이드바 SortableContext 소속)로 **필터한 뒤** closestCenter 위임(커스텀 함수 몇 줄, `components/ui/dnd.tsx`) |
| **E8** | D20′ 보강 — 이동 경로는 둘이 아니라 **넷** | ① `moveProblemToFolder`(`firestore.ts:203-208`) ② 복원 = 같은 함수(null)(`AppShell:552-560`) ③ **`deleteFolder`가 문항을 미분류로 옮기며 `updated_at`을 찍는다**(`firestore.ts:469`) ④ `moveToTrash`(`firestore.ts:559-564`)도 찍는다. 경계 판정 필요 → **Q14** |
| **E9** | D15 확정 | `listFolders`가 **이미** `updated_at`을 Date로 파싱해 싣고 있다(`firestore.ts:426`, `as unknown as Folder` 캐스트) — 타입 1줄 추가는 런타임 변화 0, 폴백 데이터도 공짜로 확보 |
| **E10** | D3 확정 — H는 상수가 아니라 ref 실측 | 계산상 sticky 래퍼(패딩 8+4) + 제목행(패딩 6×2 + 11.5px 텍스트 ≈ 14) ≈ **38** — v1 추정이 맞다. 그러나 S4가 제목행을 다시 짜므로 상수는 이중 진실이 된다 → **sticky 래퍼 `offsetHeight`를 ref로 재서 `scrollPaddingTop`에 공급**(1회 + ResizeObserver 불요, 폰트 고정). 카드 모드는 `scrollSnapType: 'none'` **명시**(조건부 longhand 함정 — Phase 45a) |
| **E11** | D21 확인 — 중첩 컨텍스트 무해 | 자체 DndContext가 두 곳 더 있다: `EditorView:3564`(블록 정렬) · `UserGroupEditor:175`(수식 그룹). dnd-kit 센서는 draggable 노드에 바인딩되므로 바깥 컨텍스트와 간섭하지 않는다(중첩 지원). 검수에 무회귀 항목 추가(T1) |
| **E12** | D9 확정 — 공유 뷰 scopeKey는 합쳐진다 | `AppShell:800` — received 계열은 전부 `__shared_with_me__`, sent 계열은 전부 `__sent__` 하나의 folder id를 쓴다. 상대별 칼럼 설정이 갈리지 않는 것 **수용**(Q16 — 사람별로 가를 이유가 없다). prefs 검증은 mode 전용 칼럼(owner·perm)을 모르는 id처럼 관대하게 |
| **E13** | 문서 stale 발견 | `ListView:144` 주석의 "아이보리 0.9829"는 `--bg-card #FEFDFB`의 값이다(재계산 0.9829). FolderView 바탕은 `--bg-functional #FCFAF6` = **0.9572**(v1 §5-4 표가 옳다). S4에서 주석 정리 |
| **E14** | v1 말미 실측 의뢰 5건 회신 | §11 참조 |

---

## 1. 실측 — 현행 구조 (v1 표 유지 · E1~E5 정정 반영)

v1 §1의 A-1~A-24는 위 정정 5건 외 전항 유효하다. 재록하지 않는다.
추가 실측 2건:

| # | 실측 | 근거 |
|---|---|---|
| A-25 | ContextMenu 기본 메뉴에 `move`('폴더 변경') 존재 — 사이드바 최근 문항 ⋮ 경유로 이미 동작. `FolderPickerDialog`는 `components/ui/FolderPickerDialog.tsx` | `ContextMenu:32-40` · `AppShell:581-587, 896-914` |
| A-26 | `useCommentCounts` = 문항당 `listAllComments`+`listSessions` 병렬 2읽기, `[key, problems.length]` 의존 재로드 | `hooks/useCommentCounts.ts:24-53` |

---

## 2. 결정 — 보기 모드 · 스크롤

v1 D1·D2·D3′ 유지. D3만 개정:

| # | 결정 |
|---|---|
| D1 | (유지) 비영속 · 기본 리스트 · 옛 `mathory.viewMode.*` 키 첫 로드 소거 |
| D2 | (유지) `listAllowed` 폐지. `ListView`에 `mode:'trash'`(메뉴 = 복원·영구 삭제 — 카드 메뉴 `FolderView:254-257`과 동일). **보완**: 리스트 빈 상태 문구도 카드 브랜치(`FolderView:517-521`)처럼 mode별로("휴지통이 비어 있습니다" 등) — 현행 리스트는 '문항이 없습니다.' 하나뿐 |
| **D3″** | 스크롤 컨테이너(`FolderView:499-503`)에 리스트 모드 `scrollSnapType:'y proximity'` / 카드 모드·드래그 중 `'none'` **명시**. `scrollPaddingTop`은 상수가 아니라 **sticky 래퍼 ref의 `offsetHeight`**(E10). 각 문항·폴더 행 `scrollSnapAlign:'start'`. 선택 바·sticky 래퍼에는 주지 않는다 |
| D3′ | (유지) 제목바 래퍼 리스트 57 / 카드 98 |

---

## 3. 결정 — 칼럼 체계

v1 §3 전체 유지(D4~D10). 보완 4건:

- **D4 보완**: `verification` 값 구조는 `{ verdict: ok|check|fail|skip, stale: boolean }`(`VerifyBadge:14-19`, `VERIFY_VERDICT_META`가 어휘 단독 소유) — 칼럼 비교자도 이 메타를 import하지 말고(**import 0 규약**) 레지스트리에 순서 배열만 적되, **검수에서 두 어휘의 일치를 눈으로 대조**한다. 블록체인 3상은 `latest.txHash` 유무 → `copyright.contentHash !== latest.contentHash`(수정됨) 순 판정(`BlockchainBadge:20-24` 로직과 동일 — 배지 컴포넌트 재사용이라 사본 없음).
- **D7 보완**: 1px 세로선은 **시각**이고 히트 영역은 좌우 ±4px(총 ~9px) — 1px에 커서를 올리는 조작은 트랙패드에서 못 쓴다. ⋮ 버튼 선례대로 `onPointerDown` 전파 차단.
- **D9 보완**: scopeKey 합쳐짐 수용(E12). `sort` 저장은 리스트만(Q1) — 카드 전역 키 `mathory-folder-sort` 불변.
- **D10 보완**: 모든 비교자는 동률 시 **제목 비교자로 tie-break**(안 하면 count 칼럼 정렬이 사실상 무순서가 되고, 비동기 재정렬 때 행이 이유 없이 자리바꿈한다).

---

## 4. 결정 — 하위 폴더 행

v1 D11~D15′ 유지. 보완 2건:

- **D15 보완(계산법)**: 폴더별 `max(updated_at)`은 하위 폴더마다 `getDescendantIds`를 도는 O(F·P)가 아니라 **한 패스**로 — 부모 맵을 만들고 각 문항의 폴더에서 조상으로 걸어 올라가며 max 갱신, O(P×depth). `useMemo([problems, folders])`. 수백 문항 규모에서 밀리초 미만(§11-3).
- **D15 보완(타입)**: `Folder.updated_at?: Date` 추가만으로 폴백 값이 이미 실려 온다(E9).

---

## 5. 결정 — 앱 전역 DnD

### 5-1. 구조 (v1 개정판)

| # | 결정 |
|---|---|
| **D21″** | `DndContext` 1개, AppShell 루트(`AppShell:667`의 flex 루트 안쪽) 소유. 사이드바 `SortableContext`는 제자리. 센서 = `PointerSensor distance 8` + `KeyboardSensor`. **AppShell이 드는 상태는 `activeDragItem`(오버레이 라벨, dragStart 1회)뿐** — `dragOverFolderId`는 두지 않고 각 타깃이 자기 `isOver` + `useDndContext().active`로 판정한다(E6). `onDragOver` 핸들러 자체가 없다 |
| **D22″** | 충돌 판정(`components/ui/dnd.tsx`의 함수 하나): `active.data.current.type === 'folder'` → **`data.current.sortable` 보유 droppable로 필터한** closestCenter(E7) / 그 외(problem·problems) → `pointerWithin`. 첫 커밋(S0) |
| **D23′** | 데이터 계약 통일(E1): 소스 `{type:'problem', problem}` · 다중 `{type:'problems', problems}` · 타깃 `{type:'folder', folder}` / 미지정 `{type:'unassigned'}` / 휴지통 `{type:'trash'}`. FolderView 칩·카드에 type **추가**. 핸들러 분기: folder→정렬(`Sidebar:780-801` 이관, 재부모화 없음) / problem·problems→이동 |
| **D34** | **id 네임스페이스(E2)**: 사이드바 폴더 sortable만 맨 `folder.id`(SortableContext items 앵커라 프리픽스 불가). 그 외 전부 프리픽스 — 칩 `chip:{fid}` · 리스트 폴더 행 `frow:{fid}` · 브레드크럼 `crumb:{fid}` · 미지정 `drop:unassigned` · 휴지통 `drop:trash` · 카드 `card:{pid}` · 리스트 행 `prow:{pid}` · 사이드바 최근 `problem-{pid}`(현행). **핸들러는 id를 파싱하지 않고 data로만 대상을 읽는다**(id는 유일성 전담) |
| D24′ | 드래그 소스 조건 재정의: `user && p.authorUid === user.uid && !공유 뷰(passthrough·listContext)`. **휴지통·미지정 문항 포함**(Q10의 전제 — 현행 `isSpecial` 제외를 푼다). "하위 폴더 있을 때" 조건 제거(타깃이 사이드바에 항상 있다) |
| D25 | (유지) 타깃 = 리스트 폴더 행 · 카드 칩 · 브레드크럼(현재 폴더 제외 — `slice(0,-1)`이 이미 보장, `FolderView:398`) · 사이드바 폴더 트리(펼쳐진 것만 — `flattenVisible`이 접힌 자식을 렌더 안 하므로 자연 성립) · 미지정 · 휴지통. 접힘 사이드바 타깃 없음(폴더 목록 자체가 미렌더 — `Sidebar:943` `!collapsed` 게이트로 자연 성립) |
| D26′ | 유효성은 AppShell 핸들러 한 곳. 같은 폴더 무시는 **null 정규화 비교** — `(problem.folder_id || null) === (targetFolderId || null)`(미지정의 folder_id는 null·''가 공존한다, `FolderView:194`). 휴지통 문항→폴더 = 그 폴더로 복원(Q10). 실패 `alertDialog` |
| D27′ | (유지) `isOver` 하이라이트 한 문법 — 단, **problem 계열 드래그일 때만** 켠다(각 타깃이 `active.data.current.type` 확인 — folder 정렬 중 칩·행이 반응하면 안 된다) |
| D28 | (유지) `DragOverlay` 한 벌 — problem = 액센트 알약(`FolderView:696-705`), problems = "문항 n개", **folder = null**(sortable 변형이 제자리에서 움직이므로 오버레이 불요 — 현행 사이드바와 동일) |
| D29 | (유지) `MeasuringStrategy.Always`. 비용 §11-4 |
| D30′ | (유지) FolderView 스프레드에서 `onKeyDown` 제외. **보완**: ⋮ 버튼들은 이미 `onPointerDown` 차단이 있다(`ListView:250` · `FolderView:621` · `Sidebar:597`) — 새로 만드는 체크박스·폭 핸들·`<select>`에만 추가하면 된다 |
| D31 | (유지) 오버레이는 AppShell 루트 |

### 5-2. 다중 선택 · 일괄 이동

v1 D16~D20 유지. 보완 3건:

- **D17 보완**: 선택 바 높이 = sticky 제목행 래퍼와 동일(스냅 기준·세로 점프 방지). 선택 중 정렬 변경은 불가(제목행이 없으므로) — 정렬하려면 해제. 선택 바도 sticky.
- **D19 보완**: `writeBatch` 500 한도는 **청크 루프**로(500개씩 순차 커밋 — 문항 수천 폴더 방어. 실데이터 규모에선 1회).
- **D35(신규)**: 다중 선택을 **휴지통에 드래그/버튼**으로 넣을 때만 `confirmDialog`("n개 문항을 휴지통으로 이동합니까?"). 단건 드래그·⋮는 현행대로 무확인(`AppShell:527-533` trash 케이스에 확인 없음).
- **D20″**: `updated_at` 경계(E8, **Q14**) — 권고: **폴더 간 이동·복원·`deleteFolder`의 미분류 이동은 제거, 휴지통으로의 이동만 유지**. 근거: 휴지통 카드 기본 정렬(수정일 내림차순)에서 `updated_at`이 사실상 "버린 시각"이라 최근 버린 문항이 위에 오는 유일한 신호다 — 빼면 휴지통이 뒤섞인다. `moveProblemsToFolder`는 `folderId === TRASH_FOLDER_ID`일 때만 스탬프(호출부 분기가 아니라 함수 내부 규칙으로 — 갈래 방지).

### 5-3. 사소 항목 · 교대 색상

v1 D32·D33·§5-4 전체 유지(휘도 표 전 값 재계산 일치 — §11-1). 보완 1건:

- **D36(신규)**: CSS 순서 `alt → hover → selected`에서 selected가 hover를 이기는 것은 **의도**다(선택 표시가 우선). selected 행에서 hover 피드백이 죽는 대가 수용. `--row-alt`는 `:root` 등록(소비처 globals.css 한 곳 — 컴포넌트 지역으로 둘 인라인 소비처가 없다).

### 5-5. 사이드바 공간 절약 — 들여쓰기 정리 (덕수 추가 2026-09-05)

**현행 좌표 실측** (섹션 좌패딩 12px 안쪽 = x 0 기준):

| 항목 | 현행 x | 근거 |
|---|---|---|
| My · 공유 · 최근 문항 헤더 텍스트 | 0 | `Sidebar:902`(`padding '4px 0'`) · `ShareTree:51` |
| My 폴더 행 chevron 슬롯 시작 | `12 + depth×16` | `Sidebar:283`(`paddingLeft: 12 + depth * 16`) |
| My depth-0 폴더 **아이콘** | 32 (= 12 + 슬롯 14 + gap 6) | `Sidebar:298-319` |
| 공유 직속(Bazaar·받은·보낸) **아이콘** | 32 (= 래퍼 12 + chevron 16 + 버튼 padL 4) | `ShareTree:168, 172, 185` |
| SubRow(전체·내 게시물) 텍스트 | 46 / PersonRow 아바타 34·58 / 빈 문구 58 | `ShareTree:208, 231, 145` |
| **미지정 아이콘** | **12** | `Sidebar:976`(`padding '8px 12px'`) |
| **휴지통 아이콘** | **34** — 미지정과 22px 어긋남(일관성 없음) | `Sidebar:1011`(`paddingLeft: 34`) |
| 폴더 그립(hover) | 행 기준 `left: -2` (절대배치) | `Sidebar:265` |

| # | 결정 |
|---|---|
| **D37** | **depth-0 들여쓰기 12px 제거** — 최상위 메뉴(My·공유)의 직속 항목은 헤더와 같은 좌단에서 시작한다. 글꼴 두께(헤더 600/12.5 vs 항목 500/13.5)와 chevron 슬롯 자체의 들여쓰기 효과로 위계 구분은 충분(덕수 판정). 구현: My 폴더 `paddingLeft: depth * 16`(12 삭제 — depth-0 chevron이 x 0, 아이콘 x 20) · ShareTree `ParentRow` 래퍼 `paddingLeft 12 → 0`(아이콘 x 20 — **두 트리의 직속 아이콘이 20으로 계속 일치**한다) |
| **D38** | **미지정·휴지통 좌측 정렬 통일** — 둘 다 My의 직속이므로 `paddingLeft 0`(아이콘 x **0**). 휴지통의 `paddingLeft: 34`는 삭제. chevron 슬롯이 없어 일반 depth-0 폴더 아이콘(x 20)보다 왼쪽에 서는 것은 **의도된 구별**이다(덕수: "구별이 선명해져 좋다") — 슬롯을 채워 20에 맞추지 말 것 |
| **D39** | **그립 이사 `left: -2 → -13`** — D37로 행 콘텐츠가 x 0에서 시작하면 그립(현행 −2~10)이 chevron 슬롯(0~14)과 겹친다. 섹션 좌패딩 12px이 빈 거터이므로 그립을 그 안(−13~−1)으로 옮긴다. hover에만 보이는 요소라 사이드바 왼끝 밀착은 무해. ⚠ Phase 62 활성선 규약("자기 변이 경계선인가")과 같은 정신 — 좌표만 옮기고 동작 불변 |
| **D40** | ShareTree 하위 단도 12px씩 당겨 상대 단차 보존 — SubRow 46→**34** · PersonRow 34→**22** / 58→**46** · 빈 문구 58→**46**. My 트리는 D37의 식이 자동으로 처리(depth-1 chevron x 16, 아이콘 x 36) |

- 접힘(collapsed) 사이드바는 폴더 목록·ShareTree 자체가 미렌더라(`Sidebar:943, 1052` `!collapsed` 게이트) 무영향.
- DnD와 독립 — isOver 하이라이트(테두리 2px)는 버튼 상자 기준이라 좌표 이동과 무관.

---

## 6. 판정 기록

Q1~Q12 (v1과 같음) + **Q13~Q16 덕수 판정 완료(2026-09-05, 전항 권고대로)**:

| # | 판정 | 확정 |
|---|---|---|
| **Q13** | 교대 색상 톤 | **후보 C**(밝은 쪽 `#F8F4EE`, 신규 토큰 `--row-alt`). S4에서 실물 확인만 남김(뒤집히면 A는 변수 값 한 줄) |
| **Q14** | `updated_at` 스탬프 경계 | **휴지통행만 유지, 나머지 3경로(폴더 간 이동·복원·`deleteFolder` 미분류 이동) 제거**(D20″) |
| **Q15** | 다중 선택 → 휴지통 확인 | **다중만 `confirmDialog`, 단건 드래그·⋮는 무확인**(D35) |
| **Q16** | 공유 뷰 칼럼 설정 키 | **합쳐진 채 수용**(`__shared_with_me__`/`__sent__` 단위, E12) |

---

## 7. 기존 결정과의 관계

v1 §7 유지. 추가 1행:

| 대상 | 관계 |
|---|---|
| 61c "리렌더 자체가 버그" | 드래그 중 전역 setState 금지(E6·D21″)의 근거 |
| M1 W2·61e "정규식 대신 구조 스캔" | id를 파싱하지 않고 data로 대상 식별(D34)의 같은 정신 |

---

## 8. 범위 · 파일 (v1 개정)

| 파일 | 변경 |
|---|---|
| `lib/listColumns.ts` | **신설** import 0 — 레지스트리·비교자(tie-break 포함)·prefs 검증/직렬화. `npm run test:list`(`test:batch` 문법 복제) |
| `hooks/useListPrefs.ts` | **신설** — localStorage scopeKey 읽기/쓰기, SSR 가드 |
| `components/ui/dnd.tsx` | **신설** — `Draggable`/`Droppable` 렌더프롭 이주(`FolderView:87-105`) · **충돌 판정 함수(D22″: sortable 필터 + closestCenter / pointerWithin)** · 하이라이트 스타일 상수 · id 네임스페이스 헬퍼(D34) |
| `components/layout/AppShell.tsx` | `DndContext` 소유(핸들러 start/end/cancel — **onDragOver 없음**) · `DragOverlay` · `handleMoveProblemsToFolder` · 드롭 유효성(D26′) |
| `components/layout/Sidebar.tsx` | 컨텍스트·센서·핸들러·오버레이 제거(`:740-743, 745-815, 872-879, 1101-1121`) · 폴더 항목 자체 `isOver`(useSortable 노출값) · 미지정·휴지통 버튼(`:971-999, 1002-1048`) Droppable화 · **들여쓰기 정리(D37~D39: `:283` 식 변경 · `:976`·`:1011` padL 0 · `:265` 그립 −13)** |
| `components/layout/ShareTree.tsx` | `:30` 기본 접힘 · **들여쓰기 12px 당김(D37·D40: `:168, 208, 231, 145`)** |
| `components/problem/ListView.tsx` | **대부분 교체** — subgrid · 칼럼 · 폴더 행 · 체크박스·선택 바 · 폭 핸들 · `mode:'trash'`(+빈 상태 문구) · ⋮ '폴더 변경' · 행 Draggable(type 명시) |
| `components/problem/FolderView.tsx` | 컨텍스트 제거 · viewMode 비영속 · `listAllowed` 폐지 · 리스트 모드 칩 제거·제목바 57 · snap(ref 실측 H) · 브레드크럼 Droppable · 칩·카드 data에 type 추가(E1) · ListView에 `folders`·`onSelectFolder`·선택 전달 |
| `components/ui/VerifyBadge.tsx` | `kinds?` prop |
| `lib/firestore.ts` | `moveProblemsToFolder`(writeBatch, ≤500 청크, TRASH만 스탬프) · `moveProblemToFolder`·`deleteFolder` 내 이동의 `updated_at` 제거(Q14 채택 시) |
| `types/problem.ts` | `Folder.updated_at?: Date` |
| `app/globals.css` | 폴더 행 hover(밑줄) · 폭 핸들 · 체크박스 열 · `isOver` 공용 클래스 · `.folder-row.is-alt` + `--row-alt`(후보 C 채택 시) · `:144` 부근 stale 주석 정리(E13) |

---

## 9. 착수 순서 (v1 유지 · S0 내용 갱신)

| 단계 | 내용 | 검수 핵심 |
|---|---|---|
| **S0** | 컨텍스트 1개화(D21″) + **데이터 계약 통일(D23′)** + **id 네임스페이스(D34)** + 충돌 판정(D22″) + 오버레이·하이라이트 통일(D27′·D28) + `Always`(D29) + 공유 접힘(D32) | **폴더 정렬 무회귀** · 빈 곳 드롭 무동작 · 최근 문항→폴더 정상 · 카드→칩 정상 · **에디터 블록 DnD·수식 그룹 DnD 무회귀(E11)** |
| S1 | 보기 모드 기본·비영속 · `listAllowed` 폐지 · 휴지통 리스트 메뉴(D1·D2) | 폴더 진입마다 리스트 · 휴지통 메뉴·빈 문구 |
| S2 | snap(D3″) · 리스트 제목바 57(D3′) | 멈춤 위치 · 드래그 중 떨림 없음 · H가 ref 실측값 |
| S3 | 폴더 행 + 폴더 수정일(D11~D15′, 한 패스 계산) · 리스트 행 Draggable · 브레드크럼·미지정·휴지통 Droppable(D24′~D26′) · `updated_at` 경계(D20″/Q14) | 폴더 행 정렬 분리 · 수정일 = 하위 최신 문항 · 사이드바 트리 이동 · 휴지통 복원 경로 둘 · **휴지통 정렬(버린 순) 유지** |
| S4 | 칼럼 체계(D4~D10) + 교대 색상(D33·D36, Q13 실물) | 자동폭 · 조절(±4px 히트) · 폴더별 저장 · 공유 뷰 무회귀 · 교대 색상 실물 |
| S5 | 다중 선택·일괄 이동(D16~D20″·D35) | n건 1회 이동 · 선택 바 · Escape · 다중 휴지통 확인 |
| **S6** | 사이드바 들여쓰기 정리(D37~D40) — **다른 단계와 독립**, 아무 때나 사이 커밋 가능(단 S0 이후 권장 — 같은 파일의 그립 좌표를 두 번 손대지 않게) | 두 트리 직속 아이콘 x 20 일치 · 미지정=휴지통 x 0 · 그립·chevron 무겹침 · 하위 단차 보존 |

---

## 10. 검수 항목 (v1 + 추가분)

v1 T1~T8 유지. 추가:

- T1+ (S0) **EditorView 블록 드래그 정렬 정상 · 설정 수식 그룹 드래그 정상**(중첩 컨텍스트 무회귀). 폴더 드래그 중 칩·리스트 폴더 행·미지정·휴지통이 **하이라이트되지 않음**(D27′). 같은 폴더가 칩과 사이드바 트리에 동시에 보이는 화면에서 양쪽 드롭 모두 정상(id 충돌 부재 증명).
- T4+ (S3) 미지정 문항을 미지정에 드롭 → 무동작(null 정규화). 휴지통 카드 보기 정렬이 "최근 버린 순" 유지(Q14).
- T5+ (S4) count 칼럼 정렬에서 동률 행이 제목순으로 안정(tie-break). 공유 뷰에서 owner·perm 포함 prefs 저장·복원 정상, my 뷰 prefs와 섞이지 않음.
- T6+ (S5) 다중 → 휴지통 드래그 시 확인 다이얼로그, 취소하면 무변경.
- T9 (S6) My depth-0 폴더·공유 직속(Bazaar·받은·보낸)의 아이콘이 같은 x(20) · 미지정·휴지통 아이콘이 같은 x(0, 폴더 아이콘보다 왼쪽) · 헤더(My·공유)와 직속 행이 같은 좌단에서 시작 · 폴더 hover 그립이 chevron을 가리지 않음 · depth-1 이하 단차 현행과 동일(상대값) · ShareTree SubRow·PersonRow·빈 문구가 12px씩 당겨짐 · 접힘 사이드바 무영향.

---

## 11. v1 실측 의뢰 5건 회신 (E14)

1. **subgrid 지원**: Chrome 117(2023-09) · Safari 16(2022-09) · Firefox 71(2019-12) — Baseline 2023. 런타임 `CSS.supports` 게이트는 불필요하고(지원 밖 브라우저는 이 앱의 다른 부분도 이미 깨진다), dev 콘솔 경고 한 줄이면 충분. 실물 확인은 S4 검수에서.
2. **제목행 높이 H**: 계산상 ≈38(래퍼 12 + 행 12 + 텍스트 ≈14) — v1 추정 일치. 단 상수로 굳히지 않고 ref 실측으로 공급(E10).
3. **폴더 수정일 계산 비용**: 한 패스 O(P×depth)로 수백 문항·깊이 ≤3에서 <1ms — `useMemo`면 충분, 캐시·지연 불요.
4. **`MeasuringStrategy.Always`**: 재측정 대상은 droppable 수십 개(폴더 수 + 칩 + 특수 2)의 `getBoundingClientRect` — 프레임 비용 무시 가능. 사이드바 휠 스크롤 후 드롭 정확성은 T4가 실물로 고정.
5. **`KeyboardSensor` 전역화**: `listeners` 스프레드에 `onKeyDown`이 포함되는 것이 유일한 부작용 경로 — D30′(FolderView에서 제외)로 차단. 카드의 `tabIndex`·`role`은 `attributes` 소관이라 현행과 동일. 사이드바 최근 문항의 키보드 드래그 가능성은 **현행에도 있던 동작**이라 불변.

---

*v2 = CLI 실측판(+덕수 판정 Q13~Q16·§5-5 반영). 다음: web v3 재검증 — 특히 ① D22″의 sortable 필터 판정 ② D34 네임스페이스 ③ D20″의 "TRASH만 스탬프" 함수 내부 규칙 ④ §5-4 톤 사다리 ⑤ §5-5 그립 이사(−13)와 좌표 표의 재검토를 의뢰한다.*
