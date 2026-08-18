# Phase 45a — 블록편집 기능 개선 (삭제 스크롤 버그 · 전체접기 모드 보강 · 블록 외형 E형 개편) **v4 실행판**

작성일: 2026-08-18 · 작성: web Claude (Fable) · 기준 커밋: `2d5647f` (레거시 (a)→(가) 변환 삭제)
선행: v1 (web) → v2 (CLI/Opus 5) → v3 (web, P5 추가) → **목업 세션 (2026-08-18, 덕수·web 실시간 확정)** → v4

> **v4가 하는 일** — v2의 기능 설계(D1~D5)와 검증 체계는 그대로 실행 기준이다. v3의 P5(여백·거터)는 목업 세션을 거쳐 **E형 블록 외형 시스템**으로 발전·확정되었고, 이것이 구 D6(선택 표시)·D7(여백 통일)·D8(거터 연구)을 **흡수·대체**한다(§3 D6′·D7′, §0 C13~C16). **미결 질의 없음 — 본 문서는 실행판이다.**
> **동봉 파일** — 본 문서와 함께 목업 `P5 E형 최종 확정판.html`을 전달한다. E형 외형의 시각 기준(수치·색·정렬)은 그 목업이 정본이며, 본문 §3 D6′과 불일치 시 목업을 우선하고 보고할 것.
> **모든 file:line은 `2d5647f` 기준.**

---

## 0. 변경 요약 (v2 C1~C10 계승 + v3~v4 신규)

| # | 종류 | 내용 |
|---|---|---|
| C1 | **정정** | v1이 "선택 바 / 펼침 바"라 부른 두 분기의 조건은 `collapseMode`가 아니라 **`block.collapsed`**다(780). 명칭은 **접힘 바 / 펼침 바** |
| C2 | **정정** | `handleSelectBlockBar`는 이미 `skipNextBlockScrollRef = true`를 세팅한다(1936). 우회하는 것은 effect가 아니라 **직접 호출된 스크롤 2건**(1940–1941) |
| C3 | **정정** | 삭제 버튼 823–**835**. 스타일 좌표 background **692** / boxShadow **694** / outline **696** |
| C4 | **승격** | dblclick은 click의 stopPropagation으로 막히지 않는다 → **`onDoubleClick` stopPropagation 규정**(D3-c) |
| C5 | **보강** | 접힘 바에 flex 스페이서 없음 — `previewText`가 비면 버튼이 라벨에 달라붙는다(D3-b) |
| C6 | **보강** | undo는 `setCollapseMode(false)`(2669) + 새 세대 id로 activeBlockId 교체(2668) → **undo는 항상 스크롤하고 전체접기를 푼다** — 기대값(T4) |
| C7 | **보강** | `skipNextBlockScrollRef`가 collapseMode에서 소비되지 않고 남는다(effect 2180–2184 가드 순서) → D2·D4에서 정리 |
| C8 | **보강** | 일반 모드에서도 Shift+클릭이 선택집합을 만든다(745) → 선택 조작을 collapseMode로 게이트(D5-c) |
| C9 | **측정 → v4 완화** | `--block-bg`↔`--block-bg-active` 명암비 1.10:1 (Phase 59 G1의 3:1 미달). ~~D6-b 폴백 준비~~ → **E형에서 활성/선택 블록에 1px 테두리가 상시 동반되므로 상태 신호가 배경+그림자+테두리 3중이 된다. D6-b 폴백은 폐기, 테두리 색을 G1 기준으로 실측 조정(D6′-d)** |
| C10 | **재배치** | Stage 순서 P1 → P2 → P3 → 외형. 외형은 기능 확정 뒤 한 번에 검수 |
| C11 | **측정** | 편집 패널 패딩 `'8px 16px'`(3139) — 좌 16px vs 상 8px로 비대칭. Q5(8px 통일)로 확정되었으나 **E형 확정으로 좌·우는 0(전폭)으로 발전적 대체**(C13) |
| C12 | **제약** | § 돌출 `marginLeft:-14`(687)가 좌측 패딩 공간을 소비 — E형에서 거터 자체가 소멸하므로 **§는 바 내부 표시로 이동**(D7′-c) |
| C13 | **확정 (v4 신규)** | **E형 블록 외형 시스템** (목업 세션 전건 확정): ⓐ 클레이 프레임 좌·우·상 테두리 **완전 제거** ⓑ 편집 패널 패딩 **상·하 8 / 좌·우 0** ⓒ 비활성 블록 = **전폭 · 직각 · 상하 헤어라인만 · `--block-bg`** ⓓ 활성 블록 = **동일 전폭 · radius 8 · 1px `#AC9C7E`(시안값) 테두리 · `--block-bg-active` + 그림자** ⓔ 편집↔미리보기 구분선 **신설하지 않음**(현행에도 없음 — 색 단차 구별) ⓕ 3톤 명도 위계(활성<비활성<클레이) **유지** |
| C14 | **확정 (v4 신규)** | 활성·비활성 **폭 동일**(활성 들임 없음) → 활성 전환 시 폭 변화 0, 레이아웃 시프트 이슈 원천 소멸. "떠오름"은 배경·테두리·radius·그림자만으로 |
| C15 | **대체 (v4 신규)** | 구 D6(선택=바탕색+그림자)·D7(8px 전면 통일)·D8(거터 연구)은 D6′·D7′로 흡수. 전체접기 모드의 **선택/활성 블록 = 활성 카드 문법 동일 적용**(울타리/공통영역 역할 분담 통일) |
| C16 | **경위 기록 (v4 신규)** | 검토 경로: C형(행 스택, 블록 선 소거) ↔ E형(프레임 선 소거 + 활성만 카드) 목업 비교 → **E형 채택**. C형·구분선 논의는 §7-4 이력으로만 남긴다. 별도 Phase 45b 분리는 **불요**(E형은 45a Stage 4에 흡수 가능한 규모) |

---

## 1. 좌표 확인 — 실측 대조표 (`2d5647f`, 모두 `components/editor/EditorView.tsx`)

구현 직전 재확인. 불일치 시 중단·보고.

| 항목 | 실측 | 비고 |
|---|---|---|
| `SortableEditorBlock` 래퍼 style | **682–698** | border **691** · background **692** · overflow hidden **693** · boxShadow **694** · outline **696–697** — D6′의 주 대상 |
| `showBar = isActive \|\| collapseMode` | **701** | |
| `showSummaryOnlyBar` / `summaryToggle` | **703 / 706–723** | toggle에 `onDoubleClick` 없음(C4) |
| `previewText` useMemo | **726–729** | |
| 바 div (onClick **745** · onDoubleClick **746** · paddingLeft `8+headingJut` **751** · background 하드코딩 **752**) | **744–759** | |
| § 돌출 (`headingJut` **680** · `marginLeft:-headingJut` **687** · § 절대배치 **762–768**) | | D7′-c에서 제거·이동 |
| 접힘 바 분기 / 펼침 바 분기 | **780–790 / 790–837** | 삭제 버튼 **823–835** · flex 스페이서 **819** |
| 하단 툴바 조건 | **872** | `isActive && !block.collapsed` |
| `handleDeleteBlock` | **1543–1554** | 문제 라인 **1550** |
| `handleToggleCollapseAll` | **1782–1789** | 켤 때 선택 미초기화(C8) |
| `BLOCK_SCROLL_MS` / `skipNextBlockScrollRef` | **1799 / 1801** | |
| `scrollPreviewToBlockTop` / `scrollEditorToBlockTop` | **1803–1818 / 1820–1832** | |
| `handleSelectBlockBar` / `handleToggleSelectBlock` / `handleDragEnd` | **1934–1942 / 1944–1951 / 1954–1995** | |
| 기본 자동 스크롤 effect | **2179–2197** | 가드 순서(C7) |
| 탭 전환 보정 effect | **2233–2241** | |
| `applyVersionContent` | **2645–2673** | 세대 id 2654 · activeBlockId 2668 · collapseMode 해제 2669 |
| 렌더 사이트 | **3143–3184** | |
| **U자 컨텐츠 프레임** | **3113–3120** | borderTop/Left/Right + radius 10 — D7′-a에서 제거 |
| **편집 패널** | **3139** | `padding: '8px 16px'` → D7′-b |
| **미리보기 패널** | **3210** | `padding: '20px 32px'` — **불변** |
| 색 토큰 | globals.css **68 · 74–76 · 78–80** | 클레이 `#F4EFE7` / 블록 `#F0EAE0` / 활성 `#E8DFCE` / `--border-content #D2C8B8` / `--border-block`=`--border-primary #E0DCD6` |

`setCurrentBlocks` 래퍼 **1137–1142**, `currentBlocks` 파생 **1131** — D1 재작성 근거.

---

## 2. 타당성 판정 (요지 — 상세 논증은 v2·v3 §2)

- **P1 (삭제 스크롤 버그)**: 원인 2단 확정 — 1550의 첫 블록 활성 승계 + effect 2179 발동. 일반 모드 전용(2181 가드), stale 선택 id 부수 문제 포함. → D1+D2.
- **P2 (접힘 바 버튼)**: 접힘 분기(780–790)에 버튼 부재 확인. 스페이서(C5)·dblclick(C4) 보강 포함. → D3.
- **P3 (다중선택)**: Shift+클릭 토글·묶음 이동은 **기구현**(Phase 45). 실문제는 ① 일반 클릭의 선택 파괴+스크롤(C2) ② 범위 선택 부재 ③ 발견성 0 ④ 일반 모드 유령 선택(C8). → D4+D5.
- **P4·P5 → E형**: 이중 윤곽(클레이 세로선 ∥ 블록 세로선, 16px 완충대)이 문제의 정체. 해소 방향으로 C형(블록 선 소거·행 스택)과 E형(프레임 선 소거·활성만 카드)을 목업 비교, **E형 확정**(C13). E형은 닫힌 윤곽을 활성 카드 하나로 줄여 시선을 편집 지점에 모으고, 활성=울타리 / 비활성=공통영역(면+가로선)의 역할 분담이 명확하다. 선택 표시(구 D6)도 같은 문법으로 통합(C15). → D6′+D7′.

---

## 3. 설계

### D1. 삭제 시 활성 승계 = 자리를 이어받는 블록 + 선택집합 정리 (P1a)

부수효과를 전부 updater 밖으로 (StrictMode 논점 소멸):

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

- `skipNextBlockScrollRef`는 1801 선언 — 콜백 본문 실행 시점엔 안전하나 **deps에 넣지 말 것**(렌더 시점 TDZ).
- updater 내부 이중 가드(1546 상당)는 동시성 방어로 존치 권장.

### D2. 삭제로 인한 활성 전환은 자동 스크롤 no-op (P1b)

D1의 플래그 세팅으로 완결. 단 **effect 가드 순서 교정**(C7) — 플래그를 항상 맨 앞에서 소비:

```ts
useEffect(() => {
  if (skipNextBlockScrollRef.current) { skipNextBlockScrollRef.current = false; return; }
  if (!activeBlockId) return;
  if (collapseMode) return;
  …
}, [activeBlockId, collapseMode]);
```

### D3. 접힘 바에 '요약에 넣기' 스위치 + 삭제 버튼 (P2)

`[grip] [타입라벨] [첫 줄 미리보기 …(flex:1)] [스페이서] [요약에 넣기 ⏻] [🗑]`

- **D3-a** `summaryToggle`(706)·삭제 버튼(823–835) 재사용 — 삭제 버튼은 `const deleteButton = canDelete && (…)`로 추출해 두 분기 공유.
- **D3-b (C5)** `previewText` 뒤 `<div style={{flex:1}}/>` 무조건 삽입.
- **D3-c (C4)** summaryToggle 래퍼 span·삭제 버튼에 `onDoubleClick={(e)=>e.stopPropagation()}` 추가 — 펼침 바의 기존 결함도 함께 수정.
- **D3-d** 비활성 블록 삭제 시 activeBlockId 불변 → D1 분기 미진입, 스크롤 없음. `canDelete`(3151) 공통.

### D4. 전체접기 모드에서는 바 클릭이 스크롤하지 않는다 (P3 전제)

```ts
const handleSelectBlockBar = useCallback((blockId: string) => {
  setActiveBlockId(blockId);
  setActiveMathId(-1);
  setSelectedBlockIds(new Set());
  selectionAnchorRef.current = blockId;      // D5
  if (collapseModeRef.current) return;       // 전체접기: 시야 고정
  skipNextBlockScrollRef.current = true;
  scrollEditorToBlockTop(blockId);
  scrollPreviewToBlockTop(blockId);
}, [scrollEditorToBlockTop, scrollPreviewToBlockTop]);
```

- `collapseModeRef` 신설(useRef + 렌더마다 갱신) — deps 오염으로 인한 전 블록 리렌더 방지.
- 펼침 모드 스크롤(Phase 56)은 완전 불변.

### D5. 범위 선택 (P3, Q2 확정)

- **D5-a** `selectionAnchorRef: MutableRefObject<string|null>` — 일반 클릭에서 갱신.
- **D5-b** Shift+클릭 = 앵커~대상 연속 구간으로 선택집합 **교체**:

```ts
const handleRangeSelectBlock = useCallback((blockId: string) => {
  const ids = currentBlocks.map((b) => b.id);
  const to = ids.indexOf(blockId);
  const from = selectionAnchorRef.current ? ids.indexOf(selectionAnchorRef.current) : -1;
  if (to === -1) return;
  if (from === -1) {
    setSelectedBlockIds(new Set([blockId]));
    selectionAnchorRef.current = blockId;
    return;
  }
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  setSelectedBlockIds(new Set(ids.slice(lo, hi + 1)));
}, [currentBlocks]);
```

  activeBlockId는 건드리지 않는다. 앵커 유효성은 매번 indexOf 재검증(undo 세대 교체 자동 대응).

- **D5-c (C8)** 클릭 분기 게이트: `collapseMode && shiftKey → range / collapseMode && altKey → toggle / else → select`. 우선순위 Shift > Alt. `handleToggleCollapseAll`은 **켤 때도** 선택 초기화(1786의 `if (!next)` 제거).
- **D5-d** prop은 `onBarClick({shift, alt})` 통합안 권장(재량으로 `onRangeSelect` 1개 추가도 허용).
- **D5-e** collapseMode일 때만 바 title 힌트: `"클릭: 선택 · Shift+클릭: 범위 · Alt+클릭: 개별 토글"`.

### D6′. 블록 외형 시스템 — E형 (구 D6·P4·P5 통합. **시각 정본 = 동봉 목업**)

**원리** — 이중 윤곽을 양쪽에서 푼다: 프레임 선을 지우고(D7′-a), 비활성 블록의 세로선도 지운다. 화면에 남는 닫힌 윤곽은 **활성(또는 전체접기 선택) 카드뿐** — 활성=울타리(둥근 진한 선), 비활성=공통영역(면+가로선).

**D6′-a 래퍼 스타일 전면 교체** (682–698). `const emphasized = isActive || selected;`

| 속성 | emphasized (활성 카드) | 비활성 (플랫 행) |
|---|---|---|
| background | `var(--block-bg-active)` | `var(--block-bg)` |
| border | `1px solid #AC9C7E` (신규 토큰 `--block-border-active`, **시안값** — D6′-d) | **없음** (상·하는 D6′-b의 헤어라인) |
| borderRadius | **8** | **0** |
| boxShadow | `var(--block-shadow-active)` | none |
| outline/outlineOffset (696–697) | **삭제** | **삭제** |
| marginBottom (685) | 현행 6 유지 여부는 D6′-c | 동일 |
| 폭 | **비활성과 동일 전폭** (C14 — 들임 없음) | 전폭 |

**D6′-b 비활성 상·하 헤어라인** — `borderTop/borderBottom: 1px solid var(--border-block)` 계열. 인접 중복(연속 비활성 행 사이 2줄) 방지: 마진이 0이 되는 경우 `borderTop`은 첫 행 또는 "앞 블록이 emphasized인 행"에만. **blockGap(D6′-c)이 0이 아니면 상·하 각각 그대로 두어도 자연스럽다** — 실물 비교로 결정(재량).

**D6′-c 블록 간 마진** — 목업은 마진 0(행 밀착)으로 그렸으나 현행은 6px. **0 / 6px 두 값을 실물 토글해 덕수 육안 판정** — 6px 유지 시 헤어라인은 상·하 각각, 0이면 중복 방지 규칙 적용. (이것이 유일한 잔여 미세 판정이며, 커밋 전 스크린샷 2장 비교로 충분)

**D6′-d 색 실측 (C9 계승)** — `#AC9C7E`는 목업 시안값. 클레이/블록 배경 위 명암비를 실측해 **Phase 59 G1(상태 표시 3:1)을 통과하는 근처 색**으로 확정(후보 `#B8AB92`~`#A08F70`, 0.5px/1px 굵기 비교 포함). 신규 토큰 `--block-border-active`로 등록, 다크 모드 짝 정의 필수.

**D6′-e 바(헤더) 배경** — 752 하드코딩 제거: 펼침 바 = `var(--block-bg-active)` 유지(카드 내부 헤더 틴트), 접힘 바 = `transparent`(래퍼 색 표출). 활성 펼침 바 하단 구분선(756)은 카드 테두리 색과 톤 맞춤(재량).

**D6′-f 전체접기 모드와의 통일 (C15)** — 접힘 블록도 같은 규칙: 비활성 접힘 = 전폭 플랫 행(바만 보임), **선택/활성 접힘 = 활성 카드 문법 전체**(radius+테두리+배경+그림자). 구 D6의 "선택=바탕색+그림자"는 이 문법에 포함되어 소멸. D6-b(테두리 색 폴백)는 **폐기** — 테두리가 이미 상시 신호다.

**D6′-g 내부 여백 이전** — 좌·우 패딩이 0이 되므로(D7′-b) 본문 텍스트가 화면 끝에 붙지 않도록 **블록 내부** 좌우 여백을 확보한다: 바 padding(751)·본문(CodeMirror `.cm-content` 또는 블록 콘텐츠 래퍼)·BlockBottomToolbar·EmptyBlockChips·MediaBlockContent·ProofreadResultBox 등 **블록 내부 전 요소의 좌우 패딩을 실측 후 12~16px 기준으로 정렬**. 기존 체감 본문 폭(패널 16px + 내부 기존값)과 크게 달라지지 않게 맞추는 것이 기준.

### D7′. 프레임·패딩 개편 (구 D7 대체)

- **D7′-a 프레임 무선화** — content-frame(3113–3120)의 `borderTop`·`borderLeft`·`borderRight` **제거**, `borderTopLeftRadius`/`borderTopRightRadius: 10` **제거**(선이 없어도 배경 모서리 라운딩은 남으므로 명시 제거 — 직각 확정의 잔존 논점 해소). 클레이↔아이보리 경계는 **색 단차만**. `--border-content` 토큰 자체는 타 사이트가 쓸 수 있으므로 **토큰 삭제 금지**, 이 사이트에서만 제거. hover 토큰 `--border-content-active`(globals.css:79)의 이 프레임 관련 용례가 있는지 grep 확인.
- **D7′-b 편집 패널 패딩** — 3139 `padding: '8px 16px'` → **`padding: '8px 0'`**. 상·하 8px(Q5의 "작은쪽 통일"이 상·하에 적용된 형태), 좌·우 0(전폭).
- **D7′-c § 돌출 폐지** — `headingJut`(680)·`marginLeft:-headingJut`(687)·바 paddingLeft 보정(751)·§ 절대배치(762–768) 제거. §는 **접힘 바 내부** grip 다음 요소로 이동(`color: var(--accent-primary)` 유지). 거터가 없으므로 돌출 문법 자체가 소멸.
- **D7′-d 불변 항목** — 미리보기 패널(3210) 무변경. 편집↔미리보기 사이 구분선 **신설하지 않음**(현행에도 없음 — C13ⓔ). 미리보기 쪽 클레이가 3톤 위계의 "가장 밝은 면" 역할을 계속 담당.

### D8. 연구 종결 기록 (구 D8 대체)

C형(행 스택)·구분선 유무·무테 문서형 검토는 목업 비교로 종결, **E형 채택**(C16). 관련 논증·선례 조사는 v3 §3 D8과 목업 세션 산출물에 보존. **Phase 45b 분리 불요.**

---

## 4. 구현 순서

| Stage | 내용 | 커밋 | 앵커 |
|---|---|---|---|
| **0** | §1 좌표 재확인 + D6′-g 대상(블록 내부 좌우 패딩 전 요소) 실측 목록화 | — | — |
| **1** | **P1 버그** — D1 + D2 | 독립 · **선배포 가능** | 1543–1554, 2179–2197 |
| **2** | **P2 접힘 바 버튼** — D3 | 독립 | 706–723, 780–790, 823–835 |
| **3** | **P3 선택·이동** — D4 + D5 | 독립 | 745, 1782–1789, 1934–1951 |
| **4** | **E형 외형 전면** — D6′ + D7′ (목업 대조) | 독립 · 시각 검수 1회 | 682–698, 744–768, 3113–3120, 3139, globals.css |

- Stage 4를 마지막에 두는 이유: 버튼·범위선택이 다 들어간 최종 상태를 1회만 검수. 외형이 반려되어도 Stage 4 커밋 하나만 revert.
- Stage 4 내부 판정 2건은 구현 중 처리: **D6′-c 블록 간 마진(0/6px)** · **D6′-d 테두리 색·굵기** — 각각 스크린샷 비교로 덕수 육안 확정(질의 재왕복 불요, 세션 내 판정).

---

## 5. 리스크 / 잔여 실측

| # | 항목 | 대응 |
|---|---|---|
| R1 | E형은 편집창 전면 인상 변화 — 목업과 실물(실제 폰트·수식·긴 문서)의 괴리 가능 | Stage 4 커밋 전 실물 스크린샷 ↔ 목업 대조. 괴리 시 중단·보고 |
| R2 | **활성 카드 그림자의 좌우 클리핑** — 전폭 카드의 그림자가 편집 패널(overflowY:auto → x도 클립)·프레임 경계에서 잘릴 수 있다 | 실측. 잘림이 눈에 띄면 그림자를 세로 성분 위주로 조정(`0 4px 12px`)하거나 패널에 `overflow: clip visible` 계열 검토(Phase 56 noscroll 불변식과 충돌 없는 방법 우선) |
| R3 | D6′-g 내부 패딩 이전 누락 — 어느 한 내부 요소(찾기패널 팝업, Proofread 박스, 미디어 블록 등)가 화면 끝에 붙는 회귀 | Stage 0에서 대상 전수 목록화 → T18에서 전 블록 타입 순회 확인 |
| R4 | Alt+클릭 브라우저 기본 동작 | div 대상이라 무해 예상, 3사 실측 권장 |
| R5 | 좁은 창(minWidth 420)에서 접힘 바 버튼·전폭 행 레이아웃 | 좌측 패널 최소폭 실측 |
| R6 | 범위 선택 도입 후 기존 Shift 습관 혼선 | D5-e title 힌트 |
| R7 | `handlePreviewMathClick`(2140–2155) 이중 스크롤 가능성 | **범위 밖** — 기록만 |
| R8 | 접힘 바 삭제 버튼으로 연타 삭제 용이 | pushUndo 매 삭제 적층(CAP 100) — T3 |
| R9 | 프레임 무선화로 클레이↔아이보리 구분이 색 단차만 — 상단 탭바 주변에서 흐릴 수 있음 | 실물 확인. 흐리면 상변 1선만 미세 복원하는 축소 폴백(덕수 판정) |
| R10 | 다크 모드 — 신규 토큰 `--block-border-active` 다크 짝, 헤어라인·3톤 재검 | 다크 토큰 정의 필수 + T17 다크 동시 검수 |
| R11 | 인쇄·공유뷰·열람뷰 파급 — E형은 **편집창 전용**이어야 한다 | 변경을 EditorView(+globals의 편집 스코프)로 한정. ProblemView·공유뷰·PrintStyles에 diff가 새지 않는지 T19에서 봉인 |

---

## 6. 검증 체크리스트

| # | 항목 |
|---|---|
| T1 | `npm run build` 통과 (+ `test:case`·`test:locale` 무관 확인) |
| T2 | **P1**: 펼침 모드, 블록 5개 중 3번째(활성) 삭제 → 스크롤 0px, 4번째 활성 |
| T3 | **P1**: 마지막 삭제→직전 활성 / 첫 삭제→새 첫 활성 / 3연속 삭제 제자리 / Cmd+Z 복구 |
| T4 | **P1/undo 기대값(C6)**: undo는 복원 블록 스크롤 + 전체접기 해제 — 정상 사양 |
| T5 | **P1**: 비활성 블록 삭제 시 activeBlockId 불변·스크롤 0 |
| T6 | **P2**: 접힘 바 스위치·삭제 버튼 노출·동작 |
| T7 | **P2**: 버튼 더블클릭에 블록 안 펼쳐짐(D3-c) — 펼침 바 동일 |
| T8 | **P2**: previewText 빈 블록에서 버튼 우측 정렬 유지(D3-b) |
| T9 | **P2**: 블록 1개면 삭제 버튼 비노출 |
| T10 | **P3**: 전체접기 바 일반 클릭 → 목록 스크롤 0(D4). 펼침 모드 스크롤 불변 |
| T11 | **P3**: 앵커 후 Shift+클릭 범위 선택 양방향·재조정 |
| T12 | **P3**: Alt+클릭 비연속 + 묶음 드래그 — Phase 45 동작 회귀 없음 |
| T13 | **P3**: 일반 모드 Shift/Alt 클릭에 선택집합 미생성(C8) · 전체접기 진입 시 선택 초기화 |
| T14 | **P3**: 범위 선택 중 1개 삭제 → 집합 정리·묶음 이동 정상(D1) |
| T15 | **E형**: 프레임 3면 무선·직각. 편집 패널 상·하 8px / 좌·우 0. 비활성 = 전폭·직각·상하 헤어라인·`--block-bg`. 활성 = **동일 전폭**·radius 8·1px 테두리·`--block-bg-active`+그림자 — **동봉 목업과 육안 대조** |
| T16 | **E형**: 활성↔비활성 전환 시 폭·좌우 정렬 변화 0(DevTools로 좌변 x좌표 확인). 그림자 클리핑 없음(R2) |
| T17 | **E형**: 전체접기 모드 — 비활성 접힘=플랫 행, 선택/활성 접힘=활성 카드 문법(C15). 3톤 위계 유지. **라이트·다크 동시 검수** |
| T18 | **E형**: 전 블록 타입(text·choices·image·svg·ggb·heading·callout·case) + 하단 툴바·EmptyBlockChips·Proofread 박스·찾기/바꾸기 팝업에서 내부 좌우 여백 정상(D6′-g) — 화면 끝에 붙는 요소 없음 |
| T19 | **파급 봉인**: `git diff`가 EditorView·globals(편집 스코프)·신규 토큰 외를 건드리지 않고, ProblemView·공유뷰·인쇄 렌더가 픽셀 불변 |
| T20 | § 표시: 접힘 제목 블록의 §가 바 내부에 표시, 돌출·클리핑·가로 스크롤 없음(D7′-c) |
| T21 | 회귀: 개별 펼침(더블클릭)·전체접기 토글·탭 전환 초기화·찾기/바꾸기·수식 클릭 중앙 정렬(Phase 56)·미리보기 수식 클릭 매핑 |
| T22 | 회귀: 전체접기 켰다 끄면 활성 블록 정상 스크롤(C7 가드 순서 효과) |
| T23 | 좁은 창(420px)·토론 패널 열림·글꼴 크기 변경 상태에서 E형 레이아웃 정상 |

---

## 7. 문서 갱신 (구현 완료 후)

1. `docs/roadmap.md` Phase 45 절 말미에 **Phase 45a** 항목 추가(신규 번호 아님): 버그픽스 + 접힘 바 버튼 + 범위 선택 + **블록 외형 E형 개편** 요약.
2. `docs/phasedocs/Phase45 블록 전체 접기.md`에 45a 상호참조. 확정본을 `docs/phasedocs/Phase45a 블록편집 기능 개선.md`로 등록. 본 v4와 목업 html을 `docs/phaseSketch/`에 보존(목업이 E형 시각 정본임을 명기).
3. `CLAUDE.md` 핵심 패턴 3줄:
   - "활성 블록을 바꾸는 모든 경로는 `skipNextBlockScrollRef` 계약을 맺을 것 — 플래그는 effect **맨 앞**에서 소비(collapseMode 가드 뒤에 두면 stale)."
   - "click의 stopPropagation은 dblclick을 막지 않는다 — 더블클릭 컨테이너 안 버튼엔 onDoubleClick 차단을 따로."
   - "편집창 블록 외형은 E형(활성=카드 울타리 / 비활성=플랫 행) — 열람·공유·인쇄에는 적용하지 않는다."
4. **경위 이력(C16)**: C형·구분선·무테안 검토와 E형 확정 과정은 v3 §3 D8 + 본 문서 §0 C13~C16으로 갈음.

---

## 8. 확정 사항 — **전건 확정, 미결 질의 없음**

| # | 확정 |
|---|---|
| Q1 | 접힘 바에 '요약에 넣기' 스위치(Phase 59) 노출 |
| Q2 | 일반 클릭=앵커 · Shift+클릭=연속 범위 · Alt+클릭=개별 토글 |
| Q3 | 전체접기 모드 활성/선택 블록 동일 표시 → **E형 활성 카드 문법으로 통일**(C15) |
| Q4 | 비선택 블록 = `--block-bg` (E형에 승계) |
| Q5 | 여백 "작은쪽 통일" → 상·하 8px로 적용, 좌·우는 E형 전폭(0)으로 발전적 대체(C13ⓑ) |
| Q6 | 거터 구조 제거 — 목업 판정 완료, **E형 채택**(45b 분리 불요) |
| 목업 세션 | 3톤 위계 유지 · 프레임 3면 테두리 완전 제거(직각) · 편집↔미리보기 무선(색 단차) · 비활성=전폭·직각·상하선만 · 활성=**동일 전폭**·둥근 모서리·얇고 다소 진한 테두리+그림자 |

**구현 중 세션 내 판정 2건**(질의 왕복 불요, 스크린샷 비교로 덕수 육안 확정): ① 블록 간 마진 0/6px(D6′-c) ② 활성 테두리 색·굵기(D6′-d, G1 3:1 실측 포함).
