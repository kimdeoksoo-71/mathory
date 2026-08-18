# Phase 45a — 블록편집 기능 개선 (삭제 스크롤 버그 · 전체접기 모드 보강) **v2**

작성일: 2026-08-18 · 작성: CLI Claude (Opus 5) · 기준 커밋: `2d5647f` (레거시 (a)→(가) 변환 삭제)
선행: v1 (web Claude / Fable, 기준 커밋 `2ea3542`)

> **v2가 하는 일** — v1의 설계 골자(P1~P4, §8 Q1~Q4 확정)는 그대로 채택한다. 이 문서는 ① v1의 좌표·조건 서술을 실코드로 대조해 정정하고 ② v1이 "실측 확인 항목"으로 미룬 것 중 코드만 봐도 결론이 나는 것을 **규정으로 승격**하며 ③ v1이 놓친 부수효과 5건을 보강한다.
> **모든 file:line은 `2d5647f` 기준.** v1의 좌표는 `2ea3542` 기준이었으나 두 커밋 사이에 `EditorView.tsx` 변경이 없어 좌표는 유효하다 — 아래 표의 차이는 커밋 차이가 아니라 v1의 오독이다.

---

## 0. v1 대비 변경 요약 (먼저 읽을 것)

| # | 종류 | 내용 |
|---|---|---|
| C1 | **정정** | v1이 "선택 바 / 펼침 바"라 부른 두 분기의 조건은 `collapseMode`가 아니라 **`block.collapsed`**다(780). 명칭을 **접힘 바 / 펼침 바**로 바꾼다 |
| C2 | **정정** | `handleSelectBlockBar`는 **이미 `skipNextBlockScrollRef = true`를 세팅한다**(1936). v1 §2-3-1의 "가드 우회" 진단은 맞지만, 우회하는 것은 effect가 아니라 **직접 호출된 `scrollEditorToBlockTop`/`scrollPreviewToBlockTop`**이다 |
| C3 | **정정** | 삭제 버튼 블록은 823–**835**(v1: 823–838). 스타일 좌표는 background **692** / boxShadow **694** / outline **696**(v1: 692/695/696) |
| C4 | **승격** | dblclick은 click의 `stopPropagation`으로 막히지 않는다(별개 이벤트 타입) → **`onDoubleClick` stopPropagation을 규정**. v1은 R2 실측 항목으로 미뤘다 |
| C5 | **보강** | 접힘 바에는 **flex 스페이서가 없다** — `previewText`가 비면 버튼이 라벨에 달라붙는다(D3-b) |
| C6 | **보강** | undo는 `setCollapseMode(false)`(2669) + **새 세대 id로 activeBlockId 교체**(2668) → **undo는 항상 스크롤하고 전체접기를 푼다**. 버그가 아니라 기대값이므로 체크리스트에 명시(T3·T5) |
| C7 | **보강** | `skipNextBlockScrollRef`가 **collapseMode에서 소비되지 않고 남는다**(effect 2180–2184의 가드 순서) → 신규 stale 경로. D2·D4에서 함께 정리 |
| C8 | **보강** | 현재 **일반 모드에서도 Shift+클릭이 선택집합을 만든다**(745). D6 이후엔 활성 블록과 시각적으로 구분되지 않고, 전체접기 진입 시 지워지지 않아 유령 선택이 된다 → 선택 조작을 collapseMode로 게이트(D5-c) |
| C9 | **측정** | `--block-bg` `#F0EAE0` ↔ `--block-bg-active` `#E8DFCE` 명암비 = **1.10:1**. Phase 59 G1의 "상태 표시기는 3:1" 기준에 미달 → 승인(Q4)대로 진행하되 **폴백 B안**을 준비(D6-b) |
| C10 | **재배치** | Stage 순서를 **P1 → P2 → P3 → P4**로. P2·P4가 같은 줄(752·780–790)을 건드리므로 외형은 기능 확정 뒤 한 번에 검수한다 |

---

## 1. 좌표 확인 — 실측 대조표 (`2d5647f`, 모두 `components/editor/EditorView.tsx`)

| 항목 | v1 좌표 | **실측** | 비고 |
|---|---|---|---|
| `SortableEditorBlock` 래퍼 style | 683–699 | **682–698** | `background: isActive ? …` **692**, `boxShadow: isActive ? …` **694**, `outline: selected ? …` **696**, `outlineOffset` **697** |
| `showBar = isActive \|\| collapseMode` | 701 | **701** | ✓ |
| `showSummaryOnlyBar` | — | **703** | 비활성인데 요약에 넣은 블록용 얇은 바(704–712) |
| `summaryToggle` | 706–724 | **706–723** | `onPointerDown`·`onClick` stopPropagation 있음 / **`onDoubleClick` 없음** |
| `previewText` useMemo | — | **726–729** | 첫 비어있지 않은 줄, 마크다운 기호 제거, 50자 |
| 바 div 시작 / onClick / onDoubleClick / 바 background | 744–759 (745·746·752) | **744–759** (**745·746·752**) | ✓ |
| 접힘 바 분기 (`block.collapsed ? …`) | 780–790 "선택 바" | **780–790** | **조건은 `block.collapsed`** (C1). 라벨 span 782 + previewText span 783–788 |
| 펼침 바 분기 | 791–840 | **790(`) : (`)–837** | 타입 select 792–814 · EmptyBlockChips 816–818 · **flex 스페이서 819** · summaryToggle 821 · **삭제 버튼 823–835** |
| 하단 툴바 `isActive && !block.collapsed` | — | **872** | 접힘 바에 버튼을 넣어도 여기와 충돌 없음 |
| `handleDeleteBlock` | 1543–1554 | **1543–1554** | 문제 라인 **1550** ✓ |
| `handleToggleCollapseAll` | — | **1782–1789** | 끌 때만 선택 초기화(1786) → **켤 때는 안 지운다**(C8) |
| `BLOCK_SCROLL_MS` / `skipNextBlockScrollRef` | 1799 / 1801 | **1799 / 1801** | ✓ |
| `scrollPreviewToBlockTop` / `scrollEditorToBlockTop` | 1804–1819 / 1821–1832 | **1803–1818 / 1820–1832** | ≈✓ |
| `handleSelectBlockBar` | 1934–1942 | **1934–1942** | **1936에서 이미 skipNext 세팅**(C2), 1940–1941이 무조건 스크롤 |
| `handleToggleSelectBlock` | 1944–1951 | **1944–1951** | ✓ |
| `handleDragEnd` | 1954–1995 | **1954–1995** | ✓ |
| 기본 자동 스크롤 effect | 2179–2197 | **2179–2197** | 가드 순서 **2180 `!activeBlockId` → 2181 `collapseMode` → 2182 `skipNext`** (C7) |
| 탭 전환 보정 effect | 2233–2241 | **2233–2241** | ✓ `setCollapseMode(false)` + 선택 초기화 |
| `applyVersionContent` (undo/redo/복원 공용) | — | **2645–2673** | 세대 id 2654 · **activeBlockId 재설정 2668** · **`setCollapseMode(false)` 2669** · 선택 초기화 2670 |
| 렌더 사이트 (props 전달) | — | **3143–3184** | `onDelete` 3159 · `onSelect` 3161 · `onToggleSelect` 3162 |

`setCurrentBlocks`는 **1137–1142**의 래퍼(= `setAllBlocks`의 `[activeTab]` 슬롯만 갈아끼움)이고, `currentBlocks`는 **1131**에서 파생된 평범한 배열이다 — D1 재작성의 근거(§3 D1).

---

## 2. 타당성 판정 (v1 §2 재검)

### 2-1. P1 — 원인 진단은 정확. 다만 경로가 하나 더 있다

v1의 2단 원인((a) 첫 블록으로 활성 승계 (b) 그 결과 자동 스크롤 발동)은 코드와 정확히 일치한다:

- 1550 `setActiveBlockId(filtered[0]?.id || null)` — 삭제 위치와 무관하게 **무조건 첫 블록**
- effect 2179가 `skipNext`를 안 받으므로 그대로 발동 → 첫 블록 상단−80px로 `fastScrollTo`

**보강 1 — 이 버그는 일반 모드 전용이다.** effect는 2181에서 `collapseMode`면 즉시 return하므로, 전체접기 모드에서 삭제하면 스크롤은 원래 안 난다(활성 승계가 첫 블록으로 튀는 것은 여전히 문제). Stage 4에서 접힘 바에 삭제 버튼이 생기면 이 경로가 실사용에 들어오므로, D1(활성 승계)은 두 모드 모두에 필요하고 D2(스크롤 억제)는 일반 모드에서만 유효하다.

**보강 2 — 선택집합에 stale id가 남는다.** 삭제된 블록 id가 `selectedBlockIds`에 남으면 `handleDragEnd`의 `selectedBlockIds.size > 1` 판정(1962·1972)이 **실재하지 않는 블록을 세어** 1개만 선택한 상태에서 묶음 이동 분기로 빠진다. `prev.filter(...)`가 걸러 주므로 결과는 정상이지만, `movingSet.has(overId)` no-op 판정이 어긋날 수 있다. v1은 D3(P2)에 이 정리를 넣었지만 **삭제 경로 전체의 문제**이므로 D1으로 올린다.

**타당성: 예.** `pushUndo`는 1545에서 이미 호출된다(중복 없음).

### 2-2. P2 — 타당. 단 붙일 자리가 v1 서술과 다르다

v1은 "선택 바 분기(780–790)"라 했지만 실제 조건은 `block.collapsed`(C1). 실사용상 `collapsed === true`는 전체접기 모드에서만 성립하므로(1785가 모드와 함께 세팅, 개별 토글 746도 `if (collapseMode)` 게이트, `applyVersionContent` 2654와 `handlePreviewMathClick` 2145가 항상 false로 되돌림) **결과는 v1 의도와 같다.** 다만 코드에 조건을 적을 때는 `block.collapsed`를 봐야 한다.

**보강 — 스페이서 부재(C5).** 펼침 바는 819에 `<div style={{flex:1}}/>`가 있어 버튼이 우측에 붙지만, 접힘 바는 `previewText` span의 `flex:1`에 의존한다. `previewText`는 빈 블록·기호만 있는 블록에서 `''`이 되고 그러면 span 자체가 렌더되지 않아(783 `{previewText && …}`) **버튼이 타입 라벨 바로 옆에 붙는다.** 명시 스페이서를 넣어야 한다.

**타당성: 예.**

### 2-3. P3 — v1의 실측 보고가 옳다. 여기에 유령 선택 1건 추가

Shift+클릭 다중선택·묶음 드래그는 이미 동작한다(745 / 1944 / 1954–1995). 체감 문제 3가지도 v1 서술대로 확인된다:

1. **일반 클릭이 선택을 파괴 + 스크롤 유발** — 1939 `setSelectedBlockIds(new Set())`, 1940–1941 무조건 스크롤. 1936이 skipNext를 세우므로 effect는 안 돌지만, **직접 호출한 두 스크롤이 그대로 실행**된다(C2). 전체접기 모드에서 바를 누를 때마다 목록이 뛰는 원인.
2. **범위 선택 부재** — 연속 N개에 Shift+클릭 N번.
3. **발견성 없음** — 바에 title 힌트조차 없다.

**보강(C8) — 유령 선택.** 745의 Shift 분기는 `collapseMode` 게이트가 없다. 일반 모드에서 활성 블록 바를 Shift+클릭하면 선택집합에 들어가고, 그 상태로 전체접기를 **켜도** 초기화되지 않는다(1786은 끌 때만). 지금은 outline(696)이 보여 알아채지만 D6로 outline을 없애면 **활성 블록과 구분이 안 되는 유령 선택**이 된다.

**타당성: 예(보강).**

### 2-4. P4 — 타당. 다만 대비가 1.10:1이다 (C9)

현재 문법:

| 상태 | 표현 | 좌표 |
|---|---|---|
| 펼침 활성 블록 | 래퍼 `--block-bg-active` + `--block-shadow-active` | 692·694 |
| 선택 블록 | 래퍼 `outline: 2px solid --accent-primary` | 696 |
| **전체접기 모드의 모든 바** | 바 배경 `--block-bg-active` **하드코딩** | 752 |

접힘 블록은 본문이 없어 **바가 곧 블록 전체**이므로, 752의 하드코딩 때문에 전체접기 모드에서는 모든 블록이 "활성색"으로 보인다 — v1 서술 그대로다.

**실측(C9).** `--block-bg #F0EAE0`(L≈0.827) ↔ `--block-bg-active #E8DFCE`(L≈0.744) → **명암비 1.10:1**. CLAUDE.md에 박아둔 Phase 59 G1 규약("상태를 나타내는 색은 3:1을 넘겨야 한다")에 크게 미달한다. 즉 D6 이후 선택 여부의 실질 신호는 **그림자**가 거의 전부다(`0 4px 16px rgba(0,0,0,.14)`, 블록 간격이 6px이라 이웃 위로 드리워 실제로는 잘 보이는 편). Q4에서 이미 승인된 방향이므로 그대로 진행하되, **시각 검수에서 구분이 약하면 즉시 B안**으로 간다(D6-b) — 새 문법을 만들지 않고 기존 테두리(691)의 **색만** 규격 통과 색으로 바꾸는 방식이라 레이아웃이 흔들리지 않는다.

**타당성: 예.**

---

## 3. 설계 (v1 §3 대체)

### D1. 삭제 시 활성 승계 = 자리를 이어받는 블록 + 선택집합 정리 (P1a)

v1의 초안은 `setCurrentBlocks` updater **안에서** idx를 구하고 `setActiveBlockId`·ref를 건드려 R4(StrictMode 이중 실행) 우려를 남겼다. 그런데 **`currentBlocks`(1131)가 이미 스코프에 있고 1544의 가드가 그것을 읽고 있다** — updater 안으로 들어갈 이유가 없다. 부수효과를 전부 updater 밖으로 빼면 R4는 논점 자체가 사라진다.

```ts
const handleDeleteBlock = useCallback((blockId: string) => {
  if (currentBlocks.length <= 1) return;   // C3: 마지막 블록은 삭제 안 함(no-op)
  pushUndo();

  const idx = currentBlocks.findIndex((b) => b.id === blockId);
  // 삭제 자리를 이어받는 블록(다음 → 없으면 이전). 첫 블록으로 튀지 않는다.
  if (idx !== -1 && activeBlockId === blockId) {
    const nextId = currentBlocks[idx + 1]?.id ?? currentBlocks[idx - 1]?.id ?? null;
    skipNextBlockScrollRef.current = true;   // D2 — 삭제는 시야를 움직이지 않는다
    setActiveBlockId(nextId);
  }
  // stale id가 남으면 handleDragEnd의 size>1 판정이 어긋난다
  setSelectedBlockIds((prev) => {
    if (!prev.has(blockId)) return prev;
    const next = new Set(prev); next.delete(blockId); return next;
  });

  setCurrentBlocks((prev) => prev.filter((b) => b.id !== blockId));
}, [currentBlocks, activeBlockId, setCurrentBlocks, pushUndo]);
```

- `skipNextBlockScrollRef`는 **1801에서 선언**되어 이 콜백(1543)보다 뒤에 있다. 콜백 **본문**은 렌더 완료 후에만 실행되므로 런타임 TDZ가 아니다. 단 **deps 배열에는 넣지 말 것**(렌더 시점에 평가되어 TDZ 참조오류가 난다 — ref는 원래 deps 대상이 아니다).
- 기존 1546의 `if (prev.length <= 1) return prev;` 이중 가드는 1544와 중복이라 제거해도 되지만, 동시성 방어로 남겨도 무해하다(취향 — 남기는 쪽 권장).

### D2. 삭제로 인한 활성 전환은 자동 스크롤 no-op (P1b)

D1이 `skipNextBlockScrollRef`를 세우는 것으로 끝난다. 이어받은 블록은 이미 삭제된 블록 자리(=화면 안)에 있으므로 시각 이동이 0이다.

**단, collapseMode에서는 플래그가 소비되지 않는다(C7).** effect 2180–2184는 `collapseMode`를 **먼저** 보고 return하므로 플래그가 true로 남고, 나중에 전체접기를 끄는 순간(deps에 `collapseMode`가 있다) 그 return 경로에서 **엉뚱하게 1회 소비**된다. 결과는 "전체접기를 풀어도 활성 블록으로 안 옮겨감"이라 치명적이지 않지만 비결정적이다. **effect의 가드 순서를 바꿔 플래그를 항상 먼저 소비**한다:

```ts
useEffect(() => {
  if (skipNextBlockScrollRef.current) { skipNextBlockScrollRef.current = false; return; }
  if (!activeBlockId) return;
  if (collapseMode) return;
  …
}, [activeBlockId, collapseMode]);
```

`!activeBlockId`보다 앞에 두는 것이 핵심이다(활성이 null이 되는 삭제 경로에서도 플래그가 정리된다).

### D3. 접힘 바에 '요약에 넣기' 스위치 + 삭제 버튼 (P2)

접힘 분기(780–790)를 다음 구성으로:

```
[grip] [타입라벨] [첫 줄 미리보기 …(flex:1)] [스페이서] [요약에 넣기 ⏻] [🗑]
```

- **D3-a** — `summaryToggle`(706)과 삭제 버튼(823–835)을 **그대로 재사용**한다. 삭제 버튼은 JSX가 두 번 나오게 되므로, 컴포넌트 상단에 `const deleteButton = canDelete && (…)`로 뽑아 두 분기가 공유한다(`summaryToggle`과 같은 관용).
- **D3-b (C5)** — `previewText` 뒤에 `<div style={{ flex: 1 }} />`를 **무조건** 넣는다. previewText span의 `flex:1`은 그대로 두어도 무해하다(둘 다 늘어나며 ellipsis는 `minWidth:0`이 보장).
- **D3-c (C4)** — `summaryToggle` 래퍼 span(706–710)과 삭제 버튼(824–825)에 **`onDoubleClick={(e) => e.stopPropagation()}`을 추가**한다. `click`의 stopPropagation은 `dblclick`을 막지 못하므로(별개 이벤트 타입), 지금 코드로는 스위치를 더블클릭하면 바의 `onDoubleClick`(746)이 걸려 블록이 펼쳐진다. 이는 **펼침 바에도 이미 있는 기존 결함**이라 양쪽 다 고친다.
- **D3-d** — 비활성 블록 삭제 시 `activeBlockId`는 불변이므로 D1의 승계 분기를 타지 않고 스크롤도 없다. `canDelete`(= `currentBlocks.length > 1`, 3151)는 두 분기 공통.
- 접힘 바의 grip은 이미 `{...listeners}` + click stopPropagation(771–777)이라 드래그와 충돌 없음.

### D4. 전체접기 모드에서는 바 클릭이 스크롤하지 않는다 (P3 전제)

`handleSelectBlockBar`(1934)의 직접 스크롤 두 줄에 게이트를 건다. **skipNext 세팅도 같은 게이트 안에 넣어야** C7의 stale이 재발하지 않는다:

```ts
const handleSelectBlockBar = useCallback((blockId: string) => {
  setActiveBlockId(blockId);
  setActiveMathId(-1);                       // D16: 이 경로는 handleBlockFocus를 안 거친다
  setSelectedBlockIds(new Set());
  selectionAnchorRef.current = blockId;      // D5
  if (collapseModeRef.current) return;       // 전체접기: 목록이 뛰지 않게 시야 고정
  skipNextBlockScrollRef.current = true;     // 아래 두 줄이 직접 처리하므로 effect는 스킵
  scrollEditorToBlockTop(blockId);
  scrollPreviewToBlockTop(blockId);
}, [scrollEditorToBlockTop, scrollPreviewToBlockTop]);
```

- `collapseMode`를 deps에 넣으면 콜백이 매 토글마다 새로 만들어져 `SortableEditorBlock` 전체가 리렌더된다. **`collapseModeRef`(신설, `useRef` + 렌더마다 `.current = collapseMode` 갱신)** 를 쓴다 — `useBlockHistory`의 `captureRef` 관용과 동일하다.
- 펼침 모드의 스크롤 동작(Phase 56)은 **완전 불변**이다.

### D5. 범위 선택 (P3, Q2 확정안)

- **D5-a 앵커** — `selectionAnchorRef: React.MutableRefObject<string | null>`. 일반 클릭(= `handleSelectBlockBar`)에서 갱신한다.
- **D5-b Shift+클릭** — 앵커~대상 사이 **문서 순서 연속 구간으로 선택집합을 교체**(토글 아님):

```ts
const handleRangeSelectBlock = useCallback((blockId: string) => {
  const ids = currentBlocks.map((b) => b.id);
  const to = ids.indexOf(blockId);
  const from = selectionAnchorRef.current ? ids.indexOf(selectionAnchorRef.current) : -1;
  if (to === -1) return;
  if (from === -1) {                       // 앵커 소실(삭제·탭전환·undo) → 대상 1개만
    setSelectedBlockIds(new Set([blockId]));
    selectionAnchorRef.current = blockId;
    return;
  }
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  setSelectedBlockIds(new Set(ids.slice(lo, hi + 1)));
  // 앵커는 유지 — 같은 앵커로 범위를 넓혔다 좁혔다 할 수 있어야 한다
}, [currentBlocks]);
```

  **`activeBlockId`는 건드리지 않는다.** `handleDragEnd`의 묶음 판정(1962)은 *드래그한 블록 id*가 선택집합에 있는지만 보므로 활성 블록과 무관하고, 활성을 옮기면 불필요한 스크롤·리렌더가 따라온다.
  앵커 id 유효성은 **매번 `indexOf`로 재검증**하므로 별도 무효화 로직이 필요 없다(세대 id가 바뀌는 undo에도 자동 대응).

- **D5-c 게이트 (C8)** — 745의 클릭 분기에 `collapseMode`를 건다. 선택 조작은 **전체접기 모드에서만** 의미가 있다:

```tsx
onClick={(e) => {
  if (collapseMode && e.shiftKey) onRangeSelect();
  else if (collapseMode && e.altKey) onToggleSelect();
  else onSelect();
}}
```
  우선순위는 **Shift > Alt**(둘 다 누르면 범위). 일반 모드에서는 어떤 조합이든 단순 선택이므로 유령 선택이 생기지 않는다.
  추가로 `handleToggleCollapseAll`(1782)에서 **켤 때도** `setSelectedBlockIds(new Set())`를 호출해 진입 시 상태를 깨끗이 한다(1786의 `if (!next)` 조건 제거).

- **D5-d prop 정리** — `onSelect`/`onToggleSelect`에 `onRangeSelect`를 더하면 클릭 하나에 prop이 3개가 된다. **`onBarClick: (mods: { shift: boolean; alt: boolean }) => void` 하나로 통합**하고 부모에서 분기하는 편이 낫다. 다만 diff를 최소화하려면 `onRangeSelect` 1개 추가도 허용 — 어느 쪽이든 **바 div의 조건식은 위와 동일하게 collapseMode 게이트를 포함**해야 한다. (구현자 재량, 통합안 권장)

- **D5-e 발견성** — 바 div에 `title="클릭: 선택 · Shift+클릭: 범위 · Alt+클릭: 개별 토글"`을 **collapseMode일 때만** 붙인다. 일반 모드에서는 툴팁이 거짓말이 된다. `userSelect:'none'`(757)이 이미 있어 Shift+클릭의 텍스트 선택 확장은 발생하지 않는다.

### D6. 선택 표시 = 밑배경 + 그림자 통일 (P4, Q3·Q4 확정안)

**D6-a (승인안)**

| 요소 | 변경 |
|---|---|
| 래퍼 692·694 | `const emphasized = isActive \|\| selected;` → `background: emphasized ? 'var(--block-bg-active)' : 'var(--block-bg)'`, `boxShadow: emphasized ? 'var(--block-shadow-active)' : 'none'` |
| 래퍼 696–697 | `outline` / `outlineOffset` **삭제** |
| 바 752 | `background: block.collapsed ? 'transparent' : 'var(--block-bg-active)'` |

- 752를 접힘일 때만 투명으로 두는 이유: 펼침 바는 래퍼가 이미 `--block-bg-active`(활성일 때만 바가 보이므로)라 투명이든 아니든 결과가 같지만, **명시 색이 헤더 틴트를 보장**한다(개별 펼침·향후 변경 대비). 접힘 바는 래퍼 색이 비쳐야 선택 구분이 성립하므로 반드시 투명.
- `overflow:'hidden'`(693)은 자식만 자르고 요소 자신의 box-shadow는 자르지 않으므로 그림자는 정상 렌더된다.
- 신규 CSS 토큰 없음. 다크 모드는 세 토큰의 다크 정의를 그대로 탄다.
- `showSummaryOnlyBar`(703–712)와 헤딩 돌출 `§`(762–768)는 배경을 안 쓰므로 간섭 없음.

**D6-b (폴백 B안 — C9 대비, 시각 검수에서 구분이 약할 때만)**
래퍼 691의 `border: '0.5px solid var(--border-block)'`를 `borderColor: emphasized ? 'var(--case-dot)' : 'var(--border-block)'`로. `--case-dot`(`#BC5F3F`)은 Phase 59 G1에서 이미 3:1을 통과시킨 색이고, **폭이 0.5px 그대로**라 레이아웃이 밀리지 않는다(2px outline과 달리). 새 토큰·새 문법을 만들지 않는다.

---

## 4. 구현 순서 (C10 — v1과 순서 변경)

| Stage | 내용 | 커밋 | 앵커 |
|---|---|---|---|
| **0** | 본 문서 §1 좌표 재확인 (구현 직전 1회) | — | — |
| **1** | **P1 버그** — D1 + D2 | 독립 | 1543–1554, 2179–2197 |
| **2** | **P2 접힘 바 버튼** — D3 (a~d) | 독립 | 706–723, 780–790, 823–835 |
| **3** | **P3 선택·이동** — D4 + D5 | 독립 | 745, 1782–1789, 1934–1951 |
| **4** | **P4 외형 통일** — D6-a | 독립 (시각 검수) | 691–697, 752 |

**순서 근거**: P2와 P4는 같은 구역(752·780–790)을 만지고, P3는 745를 만진다. 외형(P4)을 **맨 뒤**에 두면 버튼·범위선택이 다 들어간 최종 상태를 **1회만** 검수하면 된다(v1은 P4를 2번째에 두어 검수를 2회로 만들었다). P4가 마음에 안 들면 마지막 커밋 하나만 revert하면 되므로 독립 되돌리기도 그대로 유지된다.

Stage 1은 나머지와 완전 독립 — **먼저 배포 가능**.

---

## 5. 리스크 / 잔여 실측 항목

| # | 항목 | 대응 |
|---|---|---|
| R1 | D6로 전체접기 모드 전체 인상이 바뀐다(현재는 전 블록이 활성색) | Stage 4 독립 커밋 후 시각 검수. 구분 약하면 D6-b |
| R2 | **[해소]** ~~버튼 vs 더블클릭 충돌 실측~~ | D3-c로 규정화(dblclick stopPropagation). 실측 불요 |
| R3 | **[해소]** ~~StrictMode updater 이중 실행~~ | D1을 updater 밖으로 재작성 → 논점 소멸 |
| R4 | Alt+클릭의 브라우저 기본 동작 충돌 | 대상이 `<div>`라 macOS/Chrome·Safari·Firefox 모두 무해. div 위 Option+클릭은 다운로드/컨텍스트 트리거가 아니다. 3사 실측은 여전히 권장 |
| R5 | 좁은 창에서 접힘 바 버튼이 미리보기를 잠식 | previewText가 `ellipsis`+`minWidth:0`이라 잘림만 발생. 좌측 패널 최소폭에서 1회 확인 |
| R6 | 범위 선택 도입 후 기존 Shift 습관(개별 토글) 혼선 | Q2 확정. D5-e title 힌트로 완화 |
| R7 | `handlePreviewMathClick`(2140–2155)은 skipNext를 세우지 않고 자체 setTimeout 스크롤을 돈다 → effect 스크롤과 **이중 발동** 가능 | **본 Phase 범위 밖**(기존 결함). 발견 사항으로 기록만, 손대지 않는다 |
| R8 | 접힘 바 삭제 버튼 도입으로 **연타 삭제**가 쉬워진다 | `pushUndo`가 매 삭제마다 쌓이므로 Cmd+Z로 1개씩 복구된다(CAP 100). 확인 항목 T3 |

---

## 6. 검증 체크리스트

| # | 항목 |
|---|---|
| T1 | `npm run build` 통과 (기존 테스트 `test:case`·`test:locale`은 이 Phase와 무관하지만 함께 통과 확인) |
| T2 | **P1**: 펼침 모드, 블록 5개 중 3번째(활성) 삭제 → 편집창·미리보기 **스크롤 이동 0px**, **4번째** 블록 활성 |
| T3 | **P1**: 마지막 블록 삭제 → **직전 블록** 활성 / 첫 블록 삭제 → 새 첫 블록 활성 / 블록 3개 연속 삭제 → 매번 제자리 |
| T4 | **P1/undo**: Cmd+Z 3회 복구 정상. **기대값 명시(C6)** — undo는 `applyVersionContent`를 타므로 ⓐ 새 세대 id로 리마운트되어 **복원 블록으로 스크롤이 일어나고** ⓑ 전체접기 모드가 **꺼진다**(2669). 이는 Phase 55a의 기존 사양이며 버그가 아니다 |
| T5 | **P1**: 비활성 블록 삭제 시 `activeBlockId` 불변·스크롤 0 |
| T6 | **P2**: 전체접기 모드에서 모든 접힘 바에 '요약에 넣기' 스위치·삭제 버튼 노출, 각각 동작 |
| T7 | **P2**: 스위치/삭제 버튼 **더블클릭**해도 블록이 펼쳐지지 않는다(D3-c). 펼침 바에서도 동일 |
| T8 | **P2**: `raw_text`가 비었거나 기호뿐이라 미리보기가 없는 블록에서 버튼이 **우측 정렬**을 유지한다(D3-b) |
| T9 | **P2**: 블록 1개만 남으면 삭제 버튼 비노출(`canDelete`) |
| T10 | **P3**: 전체접기 모드에서 바 일반 클릭 → **목록 스크롤 0**(D4). 펼침 모드 상단바 클릭 스크롤은 종전 그대로 |
| T11 | **P3**: 클릭(앵커) 후 Shift+클릭 → 연속 구간 선택. 위→아래·아래→위 양방향. 같은 앵커로 범위를 넓혔다 좁히기 |
| T12 | **P3**: Alt+클릭으로 비연속 선택 → grip 드래그 묶음 이동. Phase 45의 문서 순서 유지 동작 회귀 없음 |
| T13 | **P3**: 일반 모드에서 Shift/Alt+클릭 → **선택집합이 만들어지지 않는다**(C8·D5-c). 전체접기 켜기 → 선택 비어 있음 |
| T14 | **P3**: 범위 선택 상태에서 그중 하나 삭제 → 선택집합에서 제거되고 나머지 묶음 이동이 정상(D1) |
| T15 | **P4**: 전체접기 모드에서 선택/활성 = 밑배경+그림자, 비선택 = `--block-bg`. 펼침 모드 활성/비활성과 같은 문법. **다크 모드 동시 확인** |
| T16 | **P4**: 제목 블록 `§` 돌출(headingJut)·`showSummaryOnlyBar` 얇은 바 레이아웃 무붕괴 |
| T17 | 회귀: 개별 펼침(더블클릭), 전체 접기/펼치기 토글, 탭 전환 초기화(2233–2241), 찾기/바꾸기 이동 스크롤, 수식 클릭 스크롤, 미리보기 수식 클릭 → 편집 위치 매핑 |
| T18 | 회귀: **전체접기를 켰다 끄면** 활성 블록으로 정상 스크롤(C7·D2의 가드 순서 변경 효과) |
| T19 | `git diff --stat`이 `EditorView.tsx` 외 파일을 건드리지 않는다(문서 제외) |

---

## 7. 문서 갱신 (구현 완료 후)

1. `docs/roadmap.md` **Phase 45** 절 말미에 **Phase 45a** 항목 추가(신규 번호 아님).
2. `docs/phasedocs/Phase45 블록 전체 접기.md`에 45a 상호참조, 확정본을 `docs/phasedocs/Phase45a 블록편집 기능 개선.md`로 등록.
3. `CLAUDE.md` 핵심 패턴에 **2줄** 추가:
   - "**활성 블록을 바꾸는 모든 경로는 자동 스크롤 effect와 계약을 맺어야 한다**(`skipNextBlockScrollRef`). 이 플래그는 effect의 **맨 앞에서** 소비할 것 — `collapseMode` 가드 뒤에 두면 소비되지 않고 남아 다음 전환을 엉뚱하게 삼킨다."
   - "**click의 `stopPropagation`은 `dblclick`을 막지 않는다**(별개 이벤트 타입). 더블클릭 핸들러가 있는 컨테이너 안의 버튼·스위치에는 `onDoubleClick` stopPropagation을 따로 달 것."

---

## 8. 확정 사항 (v1 §8 계승 — 재질의 없음)

| # | 확정 |
|---|---|
| Q1 | 접힘 바에 **'요약에 넣기' 스위치**(Phase 59) 노출 |
| Q2 | 일반 클릭=앵커 · **Shift+클릭=연속 범위** · **Alt+클릭=개별 토글** |
| Q3 | 전체접기 모드에서 활성 블록과 선택 블록은 **동일 표시** |
| Q4 | 비선택 블록은 일반 배경(`--block-bg`) — 인지·승인 |

**v2 신규 결정(구현자 재량으로 처리, 승인 불요):** C4·C5·C7·C8의 보강은 모두 기존 사양의 결함 수정이거나 Q1~Q4를 성립시키기 위한 필요조건이므로 별도 질의 없이 반영한다. **단 C9(대비 1.10:1)만은 시각 검수 결과에 따라 D6-b 폴백 여부를 덕수가 판단한다.**
