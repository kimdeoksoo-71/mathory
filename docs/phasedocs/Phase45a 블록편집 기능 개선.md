# Phase 45a — 블록편집 기능 개선 (45 보강)

> 커밋: `1cd9a18` ~ `c586c7b` (10개) · 6개 파일 변경 (+192 / −76)
> 설계: web Claude v1·v3·v4 → CLI Claude v2·v5(실코드 검증) · 구현: Claude Code CLI · 검수: 덕수 (시각 확인 4회차)
> 스케치: `docs/phaseSketch/Phase45a 블록편집 기능 개선 v5 최종.md` — **§0 E1~E12가 v4 대비 정정 목록**
> 목업: `docs/phaseSketch/P5 E형 최종 확정판.html` — E형 시각 정본. **단 아래 §5의 검수 반영분이 목업보다 우선**

신규 Phase 번호를 쓰지 않는다. Phase 45(블록 전체 접기 + 하단 툴바)의 **버그픽스·보강**이기 때문이다.

---

## 0. 목표

1. **P1(버그)** — 블록 삭제 후 편집창이 첫 블록으로 튀어 오르는 것을 없앤다.
2. **P2** — 전체접기 모드의 접힘 바에 '요약에 넣기' 스위치·삭제 버튼을 노출한다.
3. **P3** — 연속 범위 선택을 추가하고, 전체접기 모드에서 바를 눌러도 목록이 뛰지 않게 한다.
4. **E형** — 편집창 블록 인셋을 개편해 이중 외곽(클레이 프레임 세로선 ≥ 블록 세로선 + 그 사이 16px 완충대)을 없앤다.

---

## 1. Stage 1 — 삭제 스크롤 버그 (`1cd9a18`)

### 원인 (2단 중첩)

1. `handleDeleteBlock`이 `setActiveBlockId(filtered[0]?.id)` — 삭제 위치와 무관하게 **무조건 첫 블록**을 활성화.
2. `activeBlockId` 변경 → 자동 스크롤 effect가 발동해 첫 블록 상단 −80px로 `fastScrollTo`.

둘 다 고쳐야 한다. (1)만 고치면 이전 블록으로의 미세 스크롤이 남고, (2)만 고치면 이후 다른 경로가 엉뚱한 '첫 블록' 기준으로 동작한다.

### 조치

| 항목 | 내용 |
|------|------|
| 활성 승계 | `filtered[0]` → **삭제 자리를 이어받는 블록**(다음 → 없으면 이전) |
| 부수효과 위치 | `setCurrentBlocks` updater **밖으로** 이동. `currentBlocks`가 이미 스코프에 있고(가드가 그것을 읽는다) updater 안에서 setState·ref를 건드릴 이유가 없다 → StrictMode 이중 실행 논점 소멸 |
| 선택집합 정리 | 삭제된 id를 `selectedBlockIds`에서 제거. 남으면 `handleDragEnd`의 `size > 1` 묶음 판정이 실재하지 않는 블록을 세어 어긋난다 |
| 스크롤 억제 | `skipNextBlockScrollRef.current = true`를 승계 분기 안에서만 세팅 |

### effect 가드 순서 교정

```
(before) !activeBlockId → collapseMode → skipNext
(after)  skipNext → !activeBlockId → collapseMode
```

플래그를 **맨 앞에서** 소비해야 한다. `collapseMode` 가드 뒤에 있으면 전체접기 중엔 소비되지 않고 남았다가, 접기를 푸는 순간(deps에 `collapseMode`가 있다) 엉뚱한 전환 하나를 삼킨다. `activeBlockId`가 null이 되는 삭제 경로에서도 정리되도록 `!activeBlockId`보다도 앞이다.

> `skipNextBlockScrollRef`는 선언(1801)이 `handleDeleteBlock`(1543)보다 뒤다. 콜백 본문은 렌더 완료 후 실행되므로 런타임 TDZ가 아니지만 **deps 배열에는 넣지 말 것**(렌더 시점에 평가된다).

---

## 2. Stage 2 — 접힘 바 버튼 (`3b5f536`)

`[grip] [타입라벨] [첫 줄 미리보기 …] [스페이서] [요약에 넣기 ⏻] [🗑]`

- 삭제 버튼을 `const deleteButton = canDelete ? (…) : null`로 뽑아 **접힘 바·펼침 바가 공유**.
- **스페이서를 무조건 삽입** — 접힘 바는 `previewText` span의 `flex:1`에 의존했는데, 빈 블록·기호뿐인 블록에서는 `previewText`가 `''`이라 span 자체가 렌더되지 않아 버튼이 타입 라벨에 달라붙었다.
- **`onDoubleClick` stopPropagation** — `click`의 stopPropagation은 `dblclick`을 막지 못한다(별개 이벤트 타입). 없으면 스위치를 더블클릭할 때 바의 개별 펼침이 걸린다. **펼침 바에도 있던 기존 결함**이라 양쪽 다 수정.
- 분기 조건은 `collapseMode`가 아니라 **`block.collapsed`**다(v1~v4가 오독한 지점). 실사용상 `collapsed === true`는 전체접기에서만 성립하지만, 코드를 읽을 땐 이쪽을 봐야 한다.

---

## 3. Stage 3 — 범위 선택 · 무스크롤 (`487f25d`)

### 전체접기 모드에서 바 클릭이 목록을 밀던 문제

자동 스크롤 effect는 `collapseMode`를 보고 멈추지만, `handleSelectBlockBar`가 `scrollEditorToBlockTop`/`scrollPreviewToBlockTop`을 **직접 호출**해 그 게이트를 우회하고 있었다. Phase 45가 설계한 "접기 모드에선 자동 스크롤 비활성"을 **Phase 56이 직접 스크롤 경로를 넣으면서 무력화**한 회귀다.

→ `collapseModeRef` 게이트를 추가하고 **`skipNext` 세팅도 같은 게이트 안에** 둔다(밖에 두면 소비되지 않은 플래그가 남는다). `collapseMode`를 deps에 넣으면 토글마다 콜백이 재생성돼 전 블록이 리렌더되므로 ref로 읽는다(`useBlockHistory`의 `captureRef` 관용).

### 선택 규칙

| 입력 | 동작 |
|------|------|
| 일반 클릭 | 활성화 + 선택 해제 + **앵커 지정** |
| **Shift+클릭** | 앵커~대상 연속 구간으로 선택집합 **교체**. `activeBlockId`는 건드리지 않는다 |
| **Alt+클릭** | 개별 토글(비연속) |

- 우선순위 **Shift > Alt**. 셋 다 **`collapseMode`일 때만** 선택을 만든다 — 일반 모드에서 만든 선택은 전체접기를 켜도 지워지지 않아 유령 선택이 됐다(`handleToggleCollapseAll`이 끌 때만 초기화했다) → **켤 때도 초기화**로 함께 수정.
- 앵커 유효성은 쓸 때마다 `ids.indexOf`로 재검증한다 → 삭제·탭 전환·undo(세대 id 교체)에 별도 무효화 로직 없이 대응.
- `activeBlockId`를 옮기지 않는 이유: `handleDragEnd`의 묶음 판정은 *드래그한 블록*이 선택집합에 있는지만 보므로 활성 블록과 무관하고, 옮기면 불필요한 스크롤·리렌더가 따라온다.
- prop은 `onSelect`/`onToggleSelect` → **`onBarClick({shift, alt})` 하나로 통합**. `collapseMode`일 때만 title 힌트를 건다.

---

## 4. Stage 4 — 블록 인셋 E형 (`abb45fc`)

### 원리

이중 외곽을 **안쪽에서** 푼다. 비활성 블록의 세로선을 지우면 화면에 남는 닫힌 윤곽은 활성 카드뿐이다 — **활성 = 인테리어**(둥근 진한 면), **비활성 = 공통영역**(면 + 가로선).

경로 선택 이력: C형(한 줄 스타일, 블록 선 전면 제거) vs E형(프레임 선 제거 + 활성만 카드) 목업 비교 → **E형 채택**. 프레임 제거 여부는 §6 Q7에서 다시 갈렸다.

### 조치

| 대상 | 변경 |
|------|------|
| 래퍼 | `outline`(2px accent) 삭제. 활성·선택 = radius 8 + `--block-border-active` / 비활성 = 직각 + 투명 |
| 편집 패널 | `padding: '8px 16px'` → `'0 0 8px'`(전폭 + 상단 밀착) |
| 좌측 기준선 | **16px 통일** — 바·하단툴바·미디어 블록·요약전용 바·교정 결과 박스. 본문(`.cm-content` 16px)과 좌변이 맞는다 |
| § 돌출 | `headingJut`(음수 marginLeft + 절대배치) **폐지** → 바 내부 인라인. 거터가 사라져 돌출 문법 자체가 소멸 |
| 신규 토큰 | `--block-border-active` · `--block-hairline` |

**본문 좌측 기준이 32.5px → 17px로 이동하고 행폭이 넓어진다.** 이것이 E형의 의도된 결과다. "기존 폭 유지"를 목표로 두면 `.cm-content`를 32로 키워야 하고 그러면 전폭의 의미가 없다.

---

## 5. 검수 반영 (`6fcef0d` ~ `c586c7b`) — **최종 사양은 여기다**

덕수 시각 검수 4회차. 목업과 다른 부분은 전부 이 절이 우선한다.

| # | 지적 | 조치 |
|---|------|------|
| 1 | 활성 전환 시 본문 x좌표 이동 없음 | ✅ 확인. 비활성의 네 변 `transparent`가 자리를 잡아 주는 구조가 유효 |
| 2 | 블록 사이 구분선이 **2개** | 가로선을 **위쪽만** 그린다. 아래까지 그리면 인접 두 블록이 각자 내어 2줄이 된다 |
| 2-1 | 첫 블록 상단 선 불필요, 클레이 경계에 밀착 | 위쪽만 그리는 방식의 **자동 귀결** — 첫 블록은 선이 없고 마지막 블록 아래는 열려 클레이로 이어진다. 패널 `paddingTop` 0 |
| 2 | 활성 카드 그림자 제거 | `boxShadow` 삭제. 활성 신호는 배경·라운드·테두리 3중 |
| 3 | 선이 두꺼워 부담 | 1px → **0.5px**(레티나 1물리픽셀) |
| 4 | 클레이 영역 상단 모서리 | radius 10 → **직각**. `EditorView`·`ProblemView`·`FolderView` **3곳 동시**(Q7=B로 테두리 선은 유지) |
| — | 활성 카드 아래 진한 선 | §5-1 |
| — | 제목행 아래 선 | §5-2 |
| — | 비활성 구분선이 흐려 식별 안 됨 | `--block-hairline` `#DCD3C2` → **`#C2B7A2`**(1.24:1 → 1.66:1). 상한은 활성 카드 테두리 `#AC9C7E`(2.25:1) — 그보다 약해야 위계가 선다 |

### 5-1. 활성 블록 아래의 진한 선 — `border` shorthand 구멍 ⚠

**증상**: 활성 카드 바로 아래 블록의 윗선만 유독 진하고, 카드의 둥근 모서리 밖으로 삐져나온다.

**추적**: 인라인 style·`globals.css`·`PrintStyles.css`·CodeMirror 테마 어디에도 그 자리에 가로선을 그리는 규칙이 없었다. `hideTopLine` 로직도 정상이고 렌더 사이트도 하나뿐이라 **정적 분석으로는 설명이 안 됐다.** DevTools 콘솔에서 `getComputedStyle`로 편집창의 전폭 가로선을 전부 훑어 확정:

```
3: Bottom y=517  rgb(172,156,126)   ← 활성 카드 (--block-border-active)
4: Top    y=517  rgb(45,42,35)      ← 그 아래 블록 (= --text-primary = currentColor) ★
5+: Top          rgb(220,211,194)   ← 정상 (--block-hairline)
```

**원인**: `border` shorthand 위에 `borderTopColor`를 **조건부 스프레드**로 얹은 구조였다.

```ts
border: emphasized ? '…active' : '0.5px solid transparent',
...(emphasized || hideTopLine ? null : { borderTopColor: 'var(--block-hairline)' }),
```

`hideTopLine`이 false→true로 바뀌면 React는 사라진 longhand를 `style.borderTopColor = ''`로 **지우기만** 하고, `border` shorthand는 값이 그대로라 **다시 쓰지 않는다**. 결과적으로 인라인 스타일에 `border-top-color`가 **빈 구멍**으로 남아 초기값 `currentColor`(본문 검정 `#2D2A23`)로 떨어진다.

**첫 렌더는 멀쩡하고 활성 블록을 한 번 옮긴 뒤부터** 나타나므로 코드를 아무리 읽어도 보이지 않는다.

**조치**: 네 변을 **항상 전부** 적는다. 조건은 색 문자열 안에서만 갈린다.

```ts
borderTop: `0.5px solid ${emphasized ? '…active' : hideTopLine ? 'transparent' : '…hairline'}`,
borderRight:  `0.5px solid ${emphasized ? '…active' : 'transparent'}`,
borderBottom: `0.5px solid ${emphasized ? '…active' : 'transparent'}`,
borderLeft:   `0.5px solid ${emphasized ? '…active' : 'transparent'}`,
```

> CLAUDE.md에 이미 있던 "shorthand가 뒤에 오면 앞의 longhand를 덮어쓴다"의 **제거 변종**이고, 훨씬 찾기 어렵다.

### 5-2. 제목행 아래 구분선 — 두 번 헛짚음

| 시도 | 결과 |
|------|------|
| `1px solid --block-border-active` (카드 테두리와 키 맞춤) | **두껍고 진하다**(검수 1차) |
| `0.5px solid --border-primary` (원래 값 복귀) | 활성 배경 `#E8DFCE`에서 **1.06:1 — 일반 배율에서 안 보인다**(검수 2차) |
| **`0.5px solid --block-border-active`** | 확정. 두께만 절반으로, 색은 카드 선 계열 유지 |

하단 툴바 `borderTop`도 같은 값으로 맞춰 블록 위아래를 대칭으로 둔다.

### 5-3. 둥근 모서리에서 두 색 테두리 금지 ⚠

5-1을 오진해 활성 카드의 **아래 변만** `--block-hairline`으로 낮췄더니, **하단 코너의 곡선이 흐려졌다.** 브라우저가 둥근 모서리에서 인접한 두 변의 색을 **대각선으로 전환**시키기 때문이다. 되돌렸다 — **카드의 네 변은 같은 색일 것.** 색 대비가 필요하면 네 변을 함께 옮긴다.

---

## 6. 계획 단계에서 정정된 것 (v5 §0)

v1~v4에 누적된 사실 오류를 v5가 실코드로 대조해 정정했다. 그중 재발 방지가 필요한 둘:

- **이 프로젝트에 다크 모드는 없다** — `globals.css`에 `prefers-color-scheme`·`[data-theme]`·`.dark` **0건**. "다크 토큰도 함께 정의" 요구가 v1~v4에 계속 실렸으나 소비처가 없다.
- **U자 프레임은 편집창 전용이 아니다** — `EditorView`·`ProblemView`·`FolderView` 3곳 공유. v4는 편집창 것만 걷어내도록 썼는데, 그러면 화면 전환 시 프레임이 점멸한다.

**Q7 = B 확정(덕수)**: 프레임 테두리 선은 **3곳 다 유지**하고 블록만 전폭·직각으로. 이중 외곽은 블록 좌우 선 제거만으로 이미 풀리며, 프레임 제거는 그 위에 얹힌 별개의 미감 변경이다. 이후 검수 4번으로 **상단 라운드만 3곳 동시에 직각**이 됐다.

---

## 6-1. 후속 — 편집창↔미리보기 채널 확장 (`83c8f47`)

전폭화로 편집 패널의 우측 패딩 16px이 사라지면서 **블록 띠 우측 끝 → 미리보기 첫 글자가 48px → 32px**로 좁아졌다(텍스트 기준 64.5 → 48.5). 미리보기 칼럼에 `marginLeft: 24`를 줘 **56px**로 벌린다 — 전폭 띠는 하드 엣지라 개편 전보다 조금 더 띄운다.

여백을 미리보기 칼럼에 두는 이유(다른 두 자리는 각각 부작용이 있다):

| 자리 | 부작용 |
|------|--------|
| 편집 패널 `paddingRight` | 블록이 **좌측만 붙고 우측은 들어가** 비대칭. E형의 전폭이 깨진다 |
| 미리보기 `padding` 확대 | 칼럼 폭이 `calc(35em + 64px)` 고정이라 **본문 측정폭 35em이 깎인다**. 조판 기준선이므로 불가 |

조절 손잡이는 `marginLeft: 24` 하나뿐이며, 블록 폭과 미리보기 본문 폭은 그대로 유지된다. 좁은 창에서는 이 24px만큼 가로 스크롤이 일찍 생긴다(좌측 칼럼 minWidth 420 + 미리보기 고정폭 + 24).

---

## 7. 남은 것 / 알려진 성질

- **활성 신호가 배경 1.10:1 + radius 8 + 0.5px 테두리(2.03:1)** 뿐이다(그림자 제거). 약하다고 느껴지면 레버는 `--block-border-active`를 진하게 하는 것 하나다.
- **첫 블록이 활성일 때** 프레임 상단선(0.5px)과 카드 상단 테두리(0.5px)가 맞닿아 1px 2색 선이 된다. 거슬리면 첫 블록 활성 시 상단 테두리를 투명으로 돌릴 수 있으나 radius 상단 모서리가 열린 모양이 된다.
- **활성 카드의 위쪽 테두리**도 직전 블록과의 구분선 자리를 겸하며 진한 색이다. 아래와 달리 배경 단차가 함께 작동해 덜 튄다.
- **짧은 문항에서 편집↔미리보기 경계**는 마지막 블록 아래로 사라진다 — 두 패널 배경이 같은 `--bg-content`이고 절단면을 만드는 것이 블록 띠뿐이기 때문이다. 프레임 좌·우 선이 남아 컨텐츠 영역 외곽은 유지된다.
- 그림자 토큰 `--block-shadow-active`와 `--border-block`은 **소비처가 없어졌다.** 역할 토큰이라 정의는 남겨 두고 주석으로 표시했다.
