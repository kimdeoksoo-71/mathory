# Phase 45a — 블록편집 기능 개선 (삭제 스크롤 버그 · 전체접기 보강 · 블록 인셋 E형) **v5 최종**

작성일: 2026-08-18 · 작성: CLI Claude (Opus 5) · 기준 커밋: `2d5647f`
계보: v1(web) → v2(CLI) → v3(web, P5) → 목업 인수 → v4(web, E형) → **v5(CLI, 실코드 검증)**

> **v5가 하는 일** — v4의 기능 설계(D1~D5)와 E형 인테그레이션 방향(D6′·D7′)을 **그대로 계승**한다. 이 문서는 v4가 새로 도입한 E형 관련 주장을 전부 실코드로 대조해 **정정 6건·보강 6건**을 반영하고, 그 과정에서 발견한 **결정 사안 1건(Q7)** 은 B안으로 확정받아 반영했다.
> **미결 지점 없음** — v5 작성 중 발견한 Q7(프레임 범위)은 **B안(프레임 3곳 다 유지, 블록만 전폭)으로 덕수 확정**(2026-08-18). 본 문서는 실행판이다.
> **시각 기준** — E형의 위치·색·정렬은 `P5 E형 최종 확정판.html` 목업이 정본. 단 아래 E8·E9는 목업 값의 **실측 결과**이므로 목업보다 이 문서를 우선한다.
> **모든 file:line은 `2d5647f` 기준.**

---

## 0. v4 대비 변경 (E1~E12)

### 정정 — v4의 사실 오류

| # | 내용 |
|---|---|
| **E1** | **다크 모드는 이 프로젝트에 존재하지 않는다.** `globals.css`에 `prefers-color-scheme`·`[data-theme]`·`.dark` 셀렉터가 **하나도 없다**(전 파일 grep 0건). v4의 C13·R10·T17이 요구한 "신규 토큰 `--block-border-active` 다크 정의 / 다크 모드 검수"는 **소비처가 없는 허수**다. v1이 "다크 토큰 재사용"이라 적은 것을 v2(필자)가 검증 없이 승계했고 v3·v4가 확대한 오류다 → **다크 관련 항목 전부 삭제** |
| **E2** | **U자 프레임은 편집창 전용이 아니다.** 동일한 3면 프레임이 `ProblemView.tsx:584–586`·`FolderView.tsx:447–449`에도 있다. D7′-a로 EditorView(3116–3119)만 걷어내면 **폴더뷰·열람뷰는 프레임 있음 / 편집창만 없음**이 되어 화면 전환 시 상단 라운드가 점멸한다. v4 R11("편집창 전용이어야 한다")과 정면 충돌 → **Q7로 올려 B안 확정: 프레임 3곳 다 유지, 블록만 전폭·직각**(§3 D7″-a) |
| **E3** | **`.flat + .flat { border-top: none }`(목업 CSS)은 앱에서 죽는다.** 블록은 `<div key={block.id}>` 래퍼(3146)로 한 겹 싸여 있어 블록 루트끼리 **형제가 아니다**. CLAUDE.md에 이미 박힌 Phase 59 D15′ 함정 그대로 → 헤어라인 중복 제거는 **JS로 산출**(D6″-b) |
| **E4** | **C14 "폭 변화 0"이 성립하지 않는다.** 활성은 `border:1px`, 비활성은 테두리 없음 → 내용물 x좌표가 활성화 순간 **1px 밀린다**. 목업은 `.flat`에 상하 테두리만 줘 좌우 1px이 빈다 → 비활성에 **`border:1px solid transparent`** 를 깔고 상·하만 색을 넣어야 진짜 0이 된다(D6″-a) |
| **E5** | **D6′-g의 기준이 자기모순이다.** "본문이 화면 끝에 붙지 않게" + "기존 체감 본문 폭과 크게 달라지지 않게"는 전폭과 양립 불가. 실측: 현재 본문 좌측 = 패널 16 + 테두리 0.5 + `.cm-content` 16(`MarkdownEditor.tsx:811`) = **32.5px**. 개편 후 = 0 + 1(투명) + 16 = **17px**. **본문이 15.5px 왼쪽으로 가고 행폭이 31px 넓어진다** — 이것이 E형의 의도된 결과다. "기존 유지"를 목표로 두면 `.cm-content`를 32로 키워야 하고 그러면 전폭의 의미가 없다 |
| **E6** | **바와 본문의 좌측이 지금도 8px 어긋나 있다.** 바 `padding:'4px 8px'`(751) vs `.cm-content` 16. 목업은 `.bar`·`.body`를 **둘 다 14px**로 맞춰 그렸다 → 바·하단툴바 좌우 패딩을 **16으로 올려** 본문과 한 선에 세워야 목업과 일치한다(D6″-g) |

### 보강 — v4가 다루지 않은 부수효과

| # | 내용 |
|---|---|
| **E7** | 전폭화로 좌측 기준이 사라지는 **블록 내부 요소 실측 목록**을 확정(D6″-g 표). v4는 "실측 후 정렬"이라고만 했다 |
| **E8** | **목업 `#AC9C7E`의 명암비 실측** — 활성 배경 대비 **2.03:1**, 비활성 대비 2.25:1, 클레이 대비 2.35:1. v4 D6′-d가 제시한 후보 범위(`#B8AB92`~`#A08F70`)는 **전부 미달**(`#A08F70` = 2.38:1). 3:1 하한은 대략 `#8A7A5C`(3.16:1). **다만 여기선 배경·라운드·그림자가 중복 신호이므로 G1 엄격 적용 대상이 아니다** → 목업 색 유지가 정당(D6″-d) |
| **E9** | **목업의 헤어라인 색은 `--border-block`이 아니다.** 목업 `#DCD3C2`(비활성 배경 대비 1.24:1) vs `--border-block`=`--border-primary`=`#E0DCD6`(1.14:1). v4 D6′-b대로 기존 토큰을 쓰면 목업보다 **9% 흐린 선**이 된다(D6″-b) |
| **E10** | **D6′-c(블록 간 0/6px) 미결을 6px 유지로 해소 권고.** 0으로 두면 ⓐ Stage 3의 연속 범위 선택이 **1.10:1 배경차만으로** 표현돼 안 보이고 ⓑ 드래그 재배치의 "빈자리" 피드백이 사라진다. **Stage 3와 Stage 4가 상충**한다(D6″-c) |
| **E11** | **편집↔미리보기 경계는 마지막 블록 아래에서 소멸한다.** 두 패널 배경이 같은 `var(--bg-content)`(3115·3210)라 "절단차"를 만드는 것은 **블록 띠의 우측 절단면뿐**이다. 목업은 프레임을 블록으로 가득 채워 이 상태가 드러나지 않는다. 짧은 문항에서는 하단 절반이 경계 없는 클레이 한 판이 된다(R9) |
| **E12** | **그림자 좌우 클리핑은 "가능성"이 아니라 확정이다.** 편집 패널이 `overflowY:'auto'`(3139)이므로 CSS 규칙상 `overflow-x`가 `visible`→`auto`로 계산돼 **좌우가 잘린다**. 전폭이면 반드시 발생. 단 box-shadow는 스크롤 가능 영역에 기여하지 않으므로 **가로 스크롤바는 생기지 않는다**(R2) |

---

## 1. 좌표 확인 (`2d5647f` 실측 · 구현 직전 재확인, 불일치 시 중단·보고)

`components/editor/EditorView.tsx`

| 항목 | 좌표 | 비고 |
|---|---|---|
| 래퍼 style | **682–698** | marginBottom 6 **685** · marginLeft `-headingJut` **687** · border **691** · background **692** · overflow hidden **693** · boxShadow **694** · outline **696–697** |
| `headingJut` | **680** | `block.collapsed && isHeading ? 14 : 0` |
| `showBar` / `showSummaryOnlyBar` / `summaryToggle` | **701 / 703 / 706–723** | toggle에 `onDoubleClick` 없음(C4) |
| `previewText` | **726–729** | |
| 바 div | **744–759** | onClick **745** · onDoubleClick **746** · `padding:'4px 8px'` + paddingLeft `8+headingJut` **751** · background 하드코딩 **752** · borderBottom **756** |
| § 절대배치 | **762–768** | |
| grip(드래그 존) | **770–777** | |
| 접힘 바 분기 / 펼침 바 분기 | **780–790 / 790–837** | flex 스페이서 **819** · 삭제 버튼 **823–835** |
| 블록 콘텐츠 래퍼 `padding: 0` | **843** | |
| 하단 툴바 조건 | **872** | |
| `handleDeleteBlock` | **1543–1554** | 문제 라인 **1550** |
| `handleToggleCollapseAll` | **1782–1789** | 켤 때 선택 미초기화(C8) |
| `skipNextBlockScrollRef` | **1801** | 선언이 `handleDeleteBlock`보다 뒤 |
| `handleSelectBlockBar` / `ToggleSelect` / `DragEnd` | **1934–1942 / 1944–1951 / 1954–1995** | 1936 skipNext · 1940–41 무조건 스크롤 |
| 자동 스크롤 effect | **2179–2197** | 가드 순서 2180→2181→2182 |
| `applyVersionContent` | **2645–2673** | 세대 id 2654 · activeBlockId 2668 · collapseMode 해제 2669 |
| **U자 컨텐츠 프레임** | **3113–3120** | `overflowX:'auto'` · `data-noscroll` · borderTop/Left/Right **3116–3118** · radius **3119** |
| 좌측 칼럼 | **3121–3127** | `minWidth: 420` · `overflow:hidden` |
| **편집 패널** | **3139** | `overflowY:'auto', padding:'8px 16px'` |
| 블록 래퍼 `<div key>` | **3146** | **E3의 원인** |
| 렌더 사이트 props | **3143–3184** | canDelete **3151** |
| 문서 끝 스페이서 | **3204** | `height:'100vh'` |
| **미리보기 패널** | **3210** | `padding:'20px 32px'`, `background: var(--bg-content)` — **불변** |

기타 파일

| 항목 | 좌표 | 값 |
|---|---|---|
| `.cm-content` 패딩 | `MarkdownEditor.tsx:811` | **16px** (전방향) |
| 하단 툴바 패딩 | `BlockBottomToolbar.tsx:144` | `'4px 8px'` |
| 미디어 블록 패딩 | `EditorView.tsx:283 · 338 · 395` | `8` |
| 교정 결과 박스 | `ProofreadResultBox.tsx:48 · 62 · 79` | `margin:'4px 0 10px', padding:'8px 12px'` — **블록 밖**(3146 래퍼의 형제) |
| 찾기 패널 | `FindReplacePanel.tsx:301` | `position:absolute, top:8, right:12` — 좌측 칼럼 기준, 패널 패딩과 무관 |
| **동일 U자 프레임 (E2)** | `ProblemView.tsx:584–586` · `FolderView.tsx:447–449` | 같은 3면 0.5px + radius |
| 토큰 | `globals.css:68 · 74–76 · 78–80 · 59` | 클레이 `#F4EFE7` / 블록 `#F0EAE0` / 활성 `#E8DFCE` / 그림자 `0 4px 16px rgba(0,0,0,.14)` / `--border-content #D2C8B8` / `--border-block`=`--border-primary`=**`#E0DCD6`** |
| **다크 모드 (E1)** | — | **없음** |

---

## 2. 타당성 (요지 — 상세 논증은 v2 §2)

- **P1** 원인 2단(1550 첫 블록 승계 + effect 2179 발동) 확정. 일반 모드 전용(2181 가드), stale 선택 id 부작용 포함 → D1+D2.
- **P2** 접힘 분기(780–790)에 버튼 부재 확인. 스페이서(C5)·dblclick(C4) 보강 → D3.
- **P3** Shift 토글·묶음 이동은 **기구현**(Phase 45). 실제 결함은 ⓐ 일반 클릭의 선택 파괴+스크롤(C2) ⓑ 범위 선택 부재 ⓒ 발견성 0 ⓓ 일반 모드 유령 선택(C8) → D4+D5.
- **E형** 문제의 실체는 "클레이 세로선(프레임) ≥ 블록 세로선"의 **이중 외곽**과 그 사이 16px 완충대다. **이 둘은 블록의 좌·우 선을 없애고 패널 좌우 패딩을 0으로 두는 것만으로 해소된다** — 프레임 3면 제거는 그 위에 얹힌 **별개의 추가 변경**이다(E2·Q7의 근거).

---

## 3. 설계

### D1~D5 — v2 확정안 그대로 (변경 없음)

**D1 삭제 시 활성 승계 + 선택집합 정리.** 부수효과를 전부 updater 밖으로 → StrictMode 논점 소멸.

```ts
const handleDeleteBlock = useCallback((blockId: string) => {
  if (currentBlocks.length <= 1) return;
  pushUndo();
  const idx = currentBlocks.findIndex((b) => b.id === blockId);
  if (idx !== -1 && activeBlockId === blockId) {
    const nextId = currentBlocks[idx + 1]?.id ?? currentBlocks[idx - 1]?.id ?? null;
    skipNextBlockScrollRef.current = true;   // D2
    setActiveBlockId(nextId);
  }
  setSelectedBlockIds((prev) => {
    if (!prev.has(blockId)) return prev;
    const next = new Set(prev); next.delete(blockId); return next;
  });
  setCurrentBlocks((prev) => prev.filter((b) => b.id !== blockId));
}, [currentBlocks, activeBlockId, setCurrentBlocks, pushUndo]);
```
`skipNextBlockScrollRef`(1801)는 콜백 본문 실행 시점엔 안전하나 **deps에 넣지 말 것**(렌더 시점 TDZ).

**D2 effect 가드 순서 교정** — 플래그를 항상 맨 앞에서 소비(C7):
```ts
if (skipNextBlockScrollRef.current) { skipNextBlockScrollRef.current = false; return; }
if (!activeBlockId) return;
if (collapseMode) return;
```

**D3 접힘 바 버튼** — `[grip][타입라벨][미리보기…][스페이서][요약 스위치][🗑]`
(a) 삭제 버튼을 `const deleteButton = canDelete && (…)`로 뽑아 두 분기 공유 · (b) `<div style={{flex:1}}/>` 무조건 삽입 · (c) 스위치·삭제 버튼에 **`onDoubleClick` stopPropagation**(펼침 바의 기존 결함도 동시 수정) · (d) 비활성 블록 삭제는 activeBlockId 불변·스크롤 0.

**D4 전체접기에서 바 클릭 무스크롤** — `collapseModeRef`(신설) 게이트를 `skipNext` 세팅까지 감싼다.
```ts
setActiveBlockId(blockId); setActiveMathId(-1); setSelectedBlockIds(new Set());
selectionAnchorRef.current = blockId;
if (collapseModeRef.current) return;
skipNextBlockScrollRef.current = true;
scrollEditorToBlockTop(blockId); scrollPreviewToBlockTop(blockId);
```

**D5 범위 선택** — `selectionAnchorRef` + `ids.indexOf`로 매번 재검증(undo 세대 교체 자동 대응), `activeBlockId` 불변, 클릭 분기는 `collapseMode && shift → range / collapseMode && alt → toggle / else → select`(Shift > Alt), `handleToggleCollapseAll`은 **켤 때도** 선택 초기화, collapseMode일 때만 title 힌트.

---

### D6″. 블록 인셋 시스템 — E형 (v4 D6′ 정정판)

**원리** — 이중 외곽을 **안쪽에서** 푼다. 비활성 블록의 세로선을 지우면 화면에 남는 닫힌 윤곽은 활성 카드뿐. 활성=인테리어(둥근 진한 면), 비활성=공통영역(면 + 가로선).

**D6″-a 래퍼 style 전면 교체 (682–698)** — `const emphasized = isActive || selected;`

| 속성 | emphasized | 비활성 |
|---|---|---|
| `background` | `var(--block-bg-active)` | `var(--block-bg)` |
| `border` | `1px solid var(--block-border-active)` | **`1px solid transparent`** ← E4 |
| `borderTopColor`/`borderBottomColor` | (위 색 유지) | `var(--block-hairline)` · **D6″-b 규칙에 따라 조건부** |
| `borderRadius` | **8** | **0** |
| `boxShadow` | `var(--block-shadow-active)` | `none` |
| `outline`/`outlineOffset` (696–697) | **삭제** | **삭제** |
| 폭 | **완전 동일**(양쪽 다 좌우 1px 소비) | 동일 |

비활성에 `transparent` 1px을 깔아야 활성 전환 시 내용물이 1px도 움직이지 않는다(C14의 취지를 실제로 성립시키는 유일한 방법). `overflow:hidden`(693)은 그대로 두어 radius 8이 자식을 자르게 한다.

**D6″-b 헤어라인 (E3·E9)** — 목업의 `.flat + .flat{border-top:none}`은 **CSS로 옮길 수 없다**(3146 래퍼가 형제 관계를 끊는다). 인라인 style이므로 `currentBlocks.map`에서 산출해 prop으로 내린다:

```tsx
// 렌더 사이트(3143~)에서
const prevEmph = i > 0 && (activeBlockId === arr[i-1].id || selectedBlockIds.has(arr[i-1].id));
<SortableEditorBlock … hideTopHairline={blockGap === 0 && i > 0 && !prevEmph} />
```
- 색은 **신규 토큰 `--block-hairline: #DCD3C2`**(목업 값). 기존 `--border-block`(#E0DCD6)을 쓰면 목업보다 9% 흐리다(E9). 새 토큰 1개 추가가 정답 — `--border-block`은 다른 소비처가 있어 값을 바꿔선 안 된다.
- **blockGap을 6px로 두면(D6″-c 권고) 중복 제거 규칙 자체가 불필요**하다 — 두 헤어라인 사이에 6px 클레이가 있어 겹치지 않는다. 즉 E3는 gap 0을 택할 때만 발생하는 비용이다.

**D6″-c 블록 간 마진 — 6px 유지 권고 (E10, v4 미결 해소)**

| | gap 0 (목업) | **gap 6 (권고)** |
|---|---|---|
| 편집↔미리보기 절단면 | 연속한 띠 → 선명 | 6px마다 끊긴 띠 |
| **범위 선택 가시성** | 배경 **1.10:1** 차이만 → 사실상 안 보임 | 진한 띠가 6px 간격으로 반복 → 구간이 읽힌다 |
| **드래그 재배치 피드백** | 빈자리가 안 생김 | 종전 그대로 |
| 헤어라인 중복 제거 | 필요(E3) | 불필요 |

Stage 3에서 범위 선택을 새로 넣는데 Stage 4에서 그 표시를 지우는 것은 **자기 상충**이다. 목업이 gap 0으로 보인 것은 프레임이 블록으로 가득 찬 상태만 그렸기 때문이고, 절단면 이점은 어차피 마지막 블록 아래에서 사라진다(E11). **6px 유지**를 택하고, 실물에서 "표 밀착"이 더 좋으면 그때 0으로 내린다(그 경우 E3 처리를 함께 넣는다).

**D6″-d 활성 테두리 색 (E8)** — 목업 `#AC9C7E`를 **그대로 채택**하고 신규 토큰 `--block-border-active: #AC9C7E`로 등록한다.
실측: 활성 배경 대비 **2.03:1** / 비활성 대비 2.25:1 / 클레이 대비 2.35:1 — Phase 59 G1의 3:1에 미달한다. **그러나 G1은 "그 색이 상태를 나타내는 유일한 신호"일 때의 기준**(경우 dot이 그랬다)이고, 여기서는 배경·라운드·그림자·헤어라인 유무가 같은 정보를 중복 전달하므로 적용 대상이 아니다. 참고로 v4가 제시한 후보 범위는 전부 미달이며(`#A08F70` 2.38:1), 3:1을 강제하려면 `#8A7A5C`(3.16:1)까지 내려가 목업보다 확연히 진해진다 — **선택하지 않는다.**
**다크 모드 정의는 불필요**(E1).

**D6″-e 바(헤더) 배경** — 752 하드코딩 제거: 펼침 바 = `var(--block-bg-active)` 유지(카드 내부 헤더 틴트), 접힘 바 = `transparent`(래퍼 색 노출). 펼침 바 하단 구분선(756)은 `--block-border-active`로 키를 맞춘다.

**D6″-f 전체접기 모드 통일 (C15)** — 비활성 접힘 = 플랫 행, **선택/활성 접힘 = 활성 카드 문법 전체**. 구 D6("선택=밑배경+그림자")·D6-b(테두리 색 폴백)는 여기에 흡수되어 소멸.

**D6″-g 내부 좌우 재정렬 — 기준 16px (E5·E6·E7)**

전폭화 후 좌측 기준은 **본문 17px**(패널 0 + 테두리 1 + `.cm-content` 16)이다. 현재 32.5px에서 **15.5px 왼쪽으로 이동하고 행폭이 31px 넓어진다** — 의도된 결과로 확정한다. 나머지 요소를 이 선에 맞춘다:

| 요소 | 파일:라인 | 현재 | → |
|---|---|---|---|
| `.cm-content` (본문 기준선) | `MarkdownEditor.tsx:811` | `16px` | **유지** |
| 블록 바 | `EditorView.tsx:751` | `'4px 8px'` | **`'4px 16px'`** (E6 — 목업은 바·본문 동일선) |
| 하단 툴바 | `BlockBottomToolbar.tsx:144` | `'4px 8px'` | **`'4px 16px'`** |
| 미디어 블록 | `EditorView.tsx:283·338·395` | `8` | **`'8px 16px'`** |
| 교정 결과 박스 | `ProofreadResultBox.tsx:48·62·79` | `margin:'4px 0 10px'` | **`'4px 16px 10px'`** (블록 밖 형제라 별도 필요) |
| EmptyBlockChips | 바 내부 | — | 바 패딩 상속, 조치 불요 |
| 찾기 패널 | `FindReplacePanel.tsx:301` | `right:12` | 조치 불요. 단 **활성 카드 우측 테두리와 겹치므로** 실물 확인 |

---

### D7″. 프레임·패널 간소화 (v4 D7′ 정정판)

- **D7″-a 프레임 — 3곳 모두 유지 (Q7 = B안 확정).** `EditorView:3116–3119`·`ProblemView:584–586`·`FolderView:447–449`를 **전부 손대지 않는다.** v4 D7′-a(편집창 프레임 3면 제거 + 라운드 제거)는 **폐기**한다.
  - 근거: E형이 풀려던 것은 "클레이 세로선 ≥ 블록 세로선"의 이중 외곽과 그 사이 16px 완충대다. **블록의 좌·우 선을 없애고 패널 좌우 패딩을 0으로 두는 것만으로 완결**되며(§2 마지막 줄), 그 뒤 프레임 선은 **유일한 외곽**이라 더 이상 이중이 아니다. 프레임 제거는 그 위에 얹힌 별개의 미감 변경이고, 편집창에서만 하면 화면 간 문법이 갈린다(E2).
  - 부수 효과: R9(짧은 문항에서 편집↔미리보기 경계 소멸)가 자동 완화된다 — 프레임 좌·우 선이 남아 블록 띠가 끝난 아래에서도 컨텐츠 영역의 외곽은 유지된다. 다만 **편집·미리보기 두 칼럼 사이에는 여전히 선이 없다**(둘 다 `--bg-content`) → T22는 그대로 수행.
  - 결과적으로 전폭의 기준선은 "좌측 칼럼 안쪽 끝" = 프레임 좌측 0.5px 선 바로 오른쪽이다. 블록이 이 선에 밀착한다.
  - **`--border-content` 토큰은 그대로 유지**(원래도 삭제 금지 — ProblemView·FolderView 소비처 존재).
- **D7″-b 편집 패널 패딩** — 3139 `'8px 16px'` → **`'8px 0'`**. Q5(위아래 통일)를 상·하 8px로 적용하고 좌·우는 0(전폭). **미리보기 패널(3210)은 무변경.**
- **D7″-c § 돌출 폐지** — `headingJut`(680)·`marginLeft:-headingJut`(687)·바 paddingLeft 보정(751)·§ 절대배치(762–768) 제거. §는 **바 내부** grip 뒤 인라인 요소로 이동(`color: var(--accent-primary)` 유지). 거터가 없으므로 돌출 문법 자체가 소멸.
- **D7″-d 불변** — 미리보기 패널·`data-noscroll` 트립와이어·문서 끝 스페이서(3204)·`content-frame`의 `overflowX:'auto'`.

---

## 4. 구현 순서

| Stage | 내용 | 커밋 | 앵커 |
|---|---|---|---|
| **0** | §1 좌표 재확인 + D6″-g 대상 실측 재확인 | — | — |
| **1** | **P1 버그** — D1 + D2 | 독립 · **선배포 가능** | 1543–1554, 2179–2197 |
| **2** | **P2 접힘 바 버튼** — D3 | 독립 | 706–723, 780–790, 823–835 |
| **3** | **P3 선택·이동** — D4 + D5 | 독립 | 745, 1782–1789, 1934–1951 |
| **4** | **E형 인셋** — D6″ + D7″ | 독립 · 시각 검수 1회 | 680–698, 744–768, 3113–3120, 3139, globals.css, MarkdownEditor·BlockBottomToolbar·ProofreadResultBox |

Stage 4를 마지막에 두는 이유: 버튼·범위 선택이 다 들어간 최종 상태를 1회만 검수. 인셋이 마음에 안 들면 Stage 4 커밋 하나만 revert.
**v4가 남긴 Stage 4 미결 2건은 v5에서 전부 해소**(D6″-c = 6px 유지, D6″-d = 목업 `#AC9C7E` 그대로). v5가 새로 올린 Q7도 **B안 확정**. **착수 전 결정 대기 항목 없음.**

---

## 5. 리스크

| # | 항목 | 대응 |
|---|---|---|
| R1 | 목업↔실물 괴리(실 폰트·긴 문서·수식) | Stage 4 커밋 전 스크린샷 대조. 괴리 시 중단·보고 |
| **R2** | **활성 카드 그림자 좌우 클리핑 — 확정(E12)** | 전폭이면 반드시 잘린다. 가로 스크롤바는 안 생긴다. 잘린 티가 나면 그림자를 세로 성분 위주(`0 4px 12px -2px`)로 조정. **패널에 `overflow` 변경 금지**(Phase 56 noscroll 불변식) |
| R3 | D6″-g 내부 요소 누락 → 본문이 화면 끝에 붙음 | Stage 0에서 목록 고정, T18에서 전 블록 타입 순회 |
| R4 | Alt+클릭 브라우저 기본 동작 | div 대상이라 무해. 3사 실측 권장 |
| R5 | 좁은 창(minWidth 420)에서 접힘 바 버튼·전폭 행 | 최소폭 실측 |
| R6 | Shift 습관 혼선 | D5-e title 힌트 |
| R7 | `handlePreviewMathClick`(2143~) 이중 스크롤 가능성 | **범위 밖** — 기록만 |
| R8 | 접힘 바 삭제 버튼으로 연타 삭제 | pushUndo 매회 적층(CAP 100) → T3 |
| **R9** | **짧은 문항에서 편집↔미리보기 경계 소멸(E11)** | 두 패널 배경이 동일 토큰이라 마지막 블록 아래는 경계가 없다. 실물 확인 후 견디기 어려우면 ⓐ 미리보기 칼럼 배경을 반 톤 조정 또는 ⓑ 미리보기 칼럼에만 좌측 헤어라인 1줄 신설. **Q7=B로 프레임 좌·우 선이 남아 컨텐츠 영역 외곽은 유지되므로 체감은 완화된다** |
| ~~R10~~ | ~~다크 모드~~ | **삭제 — 다크 모드 없음(E1)** |
| R11 | 편집창 전용 변경이어야 함 | **Q7=B 확정으로 해소** — 프레임을 안 건드리므로 ProblemView·FolderView diff 0. T19로 봉인 |
| **R12** | gap 0을 택할 경우 헤어라인 중복 제거가 **CSS로 불가**(E3) | JS 산출(D6″-b). gap 6이면 발생하지 않음 |

---

## 6. 검증 체크리스트

| # | 항목 |
|---|---|
| T1 | `npm run build` 통과 (+ `test:case`·`test:locale` 무관 확인) |
| T2 | **P1**: 블록 5개 중 3번째(활성) 삭제 → 스크롤 0px, 4번째 활성 |
| T3 | **P1**: 마지막 삭제→직전 활성 / 첫 삭제→새 첫 활성 / 3연속 삭제 제자리 / Cmd+Z 복구 |
| T4 | **P1/undo 기대값(C6)**: undo는 복원 블록으로 스크롤하고 전체접기를 푼다 — 정상 |
| T5 | **P1**: 비활성 블록 삭제 시 activeBlockId 불변·스크롤 0 |
| T6 | **P2**: 접힘 바 스위치·삭제 버튼 노출·동작 |
| T7 | **P2**: 버튼 더블클릭에 블록이 안 펼쳐짐(D3-c) — 펼침 바도 동일 |
| T8 | **P2**: previewText 빈 블록에서 버튼 우측 정렬(D3-b) |
| T9 | **P2**: 블록 1개면 삭제 버튼 비노출 |
| T10 | **P3**: 전체접기 바 클릭 → 스크롤 0(D4). 펼침 모드 스크롤 불변 |
| T11 | **P3**: 앵커→Shift+클릭 범위, 양방향·재조정 |
| T12 | **P3**: Alt+클릭 비연속 + 묶음 드래그 — Phase 45 회귀 없음 |
| T13 | **P3**: 일반 모드 Shift/Alt는 선택집합 미생성(C8) · 전체접기 진입 시 선택 비어 있음 |
| T14 | **P3**: 범위 선택 중 1개 삭제 → 집합 정리·묶음 이동 정상 |
| T15 | **E형**: 편집 패널 상·하 8 / 좌·우 0. 비활성 = 전폭·직각·상하 헤어라인·`--block-bg`. 활성 = 동일 전폭·radius 8·1px `#AC9C7E`·`--block-bg-active`+그림자 → **목업과 대조** |
| **T16** | **E형/E4**: 활성↔비활성 전환 시 **본문 x좌표 변화 0px** — DevTools로 `.cm-content` 좌변 실측(비활성 투명 1px이 실제로 자리를 잡는지) |
| **T17** | **E형/E5**: 본문 좌측 = **17px**(패널 0 + 테두리 1 + cm 16). 바·하단툴바·미디어·교정박스가 **같은 선**(D6″-g 표) |
| T18 | **E형**: 전 블록 타입(text·heading·callout·case·choices·image·svg·ggb) + 하단툴바·EmptyBlockChips·Proofread 박스·찾기 패널 표시 상태에서 좌우 여백 정상, 화면 끝 부딪힘 없음 |
| **T19** | **회귀 봉인**: `git diff --stat`이 **EditorView · globals.css(신규 토큰 2개) · MarkdownEditor · BlockBottomToolbar · ProofreadResultBox** 5개 파일 외를 건드리지 않고(**ProblemView·FolderView diff 0** — Q7=B), **열람뷰·공유뷰·인쇄 렌더가 픽셀 불변** |
| T20 | § 표시: 접힘 제목 블록의 §가 바 내부에 표시, 돌출·클리핑·가로 스크롤 없음(D7″-c) |
| **T21** | **R2 실측**: 활성 카드 그림자 좌우 클리핑 정도 확인, 가로 스크롤바 미발생 확인 |
| **T22** | **R9 실측**: 블록 2개짜리 짧은 문항에서 편집↔미리보기 경계가 어떻게 보이는지 확인 |
| T23 | 회귀: 개별 펼침·전체접기 토글·탭 전환 초기화·찾기/바꾸기·수식 클릭 중앙 정렬(Phase 56)·미리보기 수식 클릭 매핑 |
| T24 | 회귀: 전체접기 껐다 켜면 활성 블록으로 정상 스크롤(C7 효과) |
| T25 | 좁은 창(420px)·토론 패널 열림·글꼴 크기 변경 상태에서 레이아웃 정상 |

---

## 7. 문서 갱신 (구현 완료 후)

1. `docs/roadmap.md` Phase 45 절 말미에 **Phase 45a** 항목(신규 번호 아님).
2. `docs/phasedocs/Phase45 블록 전체 접기.md`에 상호참조, 확정본을 `docs/phasedocs/Phase45a 블록편집 기능 개선.md`로 등록. 목업 html은 `docs/phaseSketch/`에 보존(E형 시각 정본, 단 색·명암은 v5 §3 우선).
3. `CLAUDE.md` 핵심 패턴 4줄:
   - "활성 블록을 바꾸는 모든 경로는 `skipNextBlockScrollRef` 계약을 맺을 것 — 플래그는 effect **맨 앞**에서 소비(collapseMode 가드 뒤면 stale)."
   - "click의 stopPropagation은 dblclick을 막지 않는다 — 더블클릭 컨테이너 안 버튼엔 `onDoubleClick` 차단을 따로."
   - "**이 프로젝트에 다크 모드는 없다**(globals.css에 `prefers-color-scheme`/`[data-theme]` 0건). '다크 토큰도 함께'는 계획서에 반복 등장하는 허수 요구다."
   - "편집창 블록 인셋은 E형(활성=카드 인테리어 / 비활성=전폭 플랫 행) — 열람·공유·인쇄에는 적용하지 않는다. **U자 프레임(상·좌·우 0.5px + 상단 라운드 10)은 EditorView 3116·ProblemView 584·FolderView 447 3곳 공유**이므로 한 곳만 바꾸면 화면 간 문법이 갈린다 — Phase 45a는 프레임을 건드리지 않고 블록만 전폭화해 이중 외곽을 풀었다."
4. 경위 이력(C16): C형·구분선·무한 검토 → E형 확정 과정은 v3 §3 D8 + v4 §0 C13~C16 + 본 문서 §0에 보존.

---

## 8. 확정 사항 및 미결 1건

| # | 확정 |
|---|---|
| Q1 | 접힘 바에 '요약에 넣기' 스위치 노출 |
| Q2 | 일반 클릭=앵커 · Shift+클릭=연속 범위 · Alt+클릭=개별 토글 |
| Q3 | 전체접기 모드 활성/선택 동일 표시 → **E형 활성 카드 문법으로 통일** |
| Q4 | 비선택 블록 = `--block-bg` 전폭 플랫 행 |
| Q5 | 편집 패널 여백 = 상·하 8px / 좌·우 0 |
| Q6 | 거터 구조 제거 · E형 채택 (45b 분리 불요) |
| **신규 확정 (v5)** | **블록 간 간격 = 6px 유지**(D6″-c) · **활성 테두리 = 목업 `#AC9C7E` 그대로**(D6″-d) · **다크 모드 항목 전부 삭제**(E1) · **비활성에 투명 1px 테두리**(E4) · **본문 좌측 기준 17px, 바·툴바·미디어·교정박스를 같은 선에**(D6″-g) |

### Q7 — U자 프레임 범위 → **B안 확정 (2026-08-18, 덕수)**

같은 3면 프레임이 **편집창·열람뷰·폴더뷰 3곳**에 있다(E2). v4는 편집창 것만 제거하도록 썼다.

| 안 | 내용 | 판정 |
|---|---|---|
| A | 편집창만 제거 (v4안) | 목업과 일치하나 폴더뷰·열람뷰는 프레임이 남아 화면 전환 시 상단 라운드 점멸 — **기각** |
| **B** | **프레임 3곳 다 유지, 블록만 전폭·직각** | **확정.** 이중 외곽·16px 완충대는 블록 쪽 변경만으로 완결된다. 변경 범위 최소, 화면 간 일관성 유지, R9 자동 완화 |
| C | 3곳 모두 제거 | Phase 44 U자 체계의 앱 전체 폐기 = 45a 범위 초과 — **기각** |

**목업과의 유일한 차이**: 목업 `.frame{border:none}`은 미채택. 나머지(전폭 플랫 행·활성 카드·§ 인라인·패널 패딩 `8px 0`)는 전부 목업대로다. Stage 4 시각 검수 시 **프레임 3면이 살아 있는 상태**를 기준으로 대조할 것.
