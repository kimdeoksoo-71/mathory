# Phase 45 — 블록 전체 접기 + 블록 하단 툴바

> 커밋: `f6dd18b` · 4개 파일 변경 (+446 / −207)
> 설계: Claude.ai (스케치 `docs/phaseSketch/블록편집기능 개선.md`) · 구현: Claude Code CLI · 검수: 덕수 (시각 확인 다회차)
>
> **후속: [Phase 45a — 블록편집 기능 개선](Phase45a%20%EB%B8%94%EB%A1%9D%ED%8E%B8%EC%A7%91%20%EA%B8%B0%EB%8A%A5%20%EA%B0%9C%EC%84%A0.md)** — 삭제 스크롤 버그픽스 · 접힘 바 버튼 · 범위 선택 · 블록 인셋 E형. 아래 '다중선택'·'제목 블록' 절은 45a에서 개정됐다(Shift=범위/Alt=개별 토글, § 돌출 폐지).

---

## 0. 목표

블록 순서를 재조정할 때 세로 이동폭이 너무 커서 불편한 문제를 해결한다. 블록 본문을 숨기고
**상단바만 남겨 접는 "전체 접기" 모드**를 신설해, 접힌 상태에서 드래그·다중선택으로 순서를
빠르게 바꾼다. 함께 통합툴바의 블록 편집 버튼들을 **각 블록 하단 툴바**로 내려 동작 위치와
대상 블록을 일치시킨다.

---

## 1. 통합툴바 재배치 (`UnifiedToolbar.tsx`)

통합툴바 블록 영역의 4개 버튼을 재배치한다.

| 버튼 | 변경 후 위치 |
|------|------|
| 블록 추가 / 블록 분할 / 수식행 분할 (3개) | → 각 블록 **하단 툴바**(신설, `BlockBottomToolbar`) |
| AI 완성 (1개) | → 통합툴바 **맞춤법 검사 우측** |
| **전체 접기 토글** (신규) | → 통합툴바 **찾기 버튼 우측**(구분선 다음) |

- 토글 아이콘 `CollapseAllIcon(collapsed)`: 접힘 시 바깥쪽 화살표(펼치기), 펼침 시 안쪽 화살표(접기). 다른 툴바 아이콘과 동일하게 사각 귀퉁이 브라켓 프레임 유지.
- 제거: `BlockAddDropdown` 컴포넌트 + `BlockAddIcon`/`BlockSplitIcon`/`FormulaSplitIcon`(하단 툴바로 이전) + `BlockTypeOption` 타입 + 관련 props(`blockTypes`/`onAddBlock`/`onSplitBlock`/`canSplitBlock`/`onSplitMathLines`).
- 신규 props: `collapseMode`, `onToggleCollapseAll`.
- 전체 접기 버튼은 `rightItems`(OverflowItems) 안에 배치 → 통합툴바 게이팅(`showToolbar`)을 따름. 즉 비텍스트 블록(그림/SVG/GGB)이 활성이거나 활성 블록이 없으면 함께 흐려지며 비활성. (실사용 대부분 텍스트 블록 기준이라 무방 — 필요 시 별도 항상-활성으로 분리 가능)

## 2. 블록 하단 툴바 (`BlockBottomToolbar.tsx` 신규)

- **활성 + 펼친 블록**의 본문 아래에만 표시(`isActive && !block.collapsed`).
- 상단바와 동일 모양(세로폭·색 `--block-bg-active`, 상단 0.5px 구분선).
- 버튼: 블록 추가(드롭다운, 외부 클릭 닫힘) · 블록 분할 · 수식행 분할.
- 아이콘은 통합툴바 글리프에서 **사각 귀퉁이 브라켓을 제외**한 형태(`+`, `↔`, `…`).
- `split`/`add`는 활성 블록 기준 핸들러(`handleSplitBlock`/`handleAddBlock`)를 그대로 호출 → 항상 "이 블록" 대상.

## 3. 전체 접기 모드 (`EditorView.tsx`)

세션 한정 상태(새로고침·탭 전환 시 초기화). 데이터 구조의 기존 `LocalBlock.collapsed`(Firestore 비저장)를 활용.

| 항목 | 동작 |
|------|------|
| 상태 | `collapseMode: boolean`, `selectedBlockIds: Set<string>` |
| 토글 | `handleToggleCollapseAll`: off→on이면 현재 탭 전 블록 `collapsed=true`, on→off이면 전부 `false` + 선택 해제 |
| 상단바 표시 | `isActive \|\| collapseMode` → 접기 모드에선 **모든 블록**이 바를 노출해 드래그 가능 |
| 드래그 존 | 상단바 **앞쪽 grip 존**에서만 `{...listeners}` → 나머지 바는 클릭/더블클릭 자유(드래그·더블클릭 충돌 해소) |
| 접힌 바 내용 | 블록 타입 라벨 + **첫 줄 미리보기**(마크다운 기호 제거·말줄임) |
| 개별 펼침/접힘 | 접기 모드에서 상단바 **더블클릭**으로 해당 블록만 토글(`handleToggleBlockCollapse`) |
| 본문 표시 | `!block.collapsed`일 때만 렌더(접힌 블록은 에디터 미마운트) |

- **더블클릭 보호**: 접기 모드에선 활성화 자동 스크롤(useEffect on `activeBlockId`)을 비활성. 첫 클릭이 블록을 스크롤로 움직여 더블클릭 판정을 깨뜨리던 문제 방지.
- 접힌 블록엔 본문 에디터가 없어 포커스가 생기지 않으므로, "접기 모드 자동 펼침 방지"는 별도 코드 없이 구조적으로 충족.

## 4. 다중선택 + 묶음 이동

| 항목 | 동작 |
|------|------|
| 선택 | 상단바 **Shift+클릭**(Ctrl/Cmd는 브라우저 단축키 충돌로 폐기)으로 토글. 바는 `userSelect:none`이라 텍스트 선택 부작용 없음 |
| 일반 클릭 | 단일 선택(활성화) + 다중선택 해제 |
| 시각 표시 | 선택 블록에 `outline` 강조 |
| 묶음 이동 | 드래그한 블록이 선택집합(2개 이상)에 포함되면, **연속·비연속 무관**하게 선택 블록 전체를 문서 순서대로 모아 드롭 위치에 **하나의 연속 묶음**으로 삽입(`handleDragEnd`) |

- 드래그 중 화면엔 잡은 블록 하나만 따라오고, 드롭 순간 전체 재배치(단일 고스트 + 드롭 시 그룹 relocate 방식 — dnd-kit 다중 드래그 미지원 우회).

## 5. 제목 블록 섹션마크

- 접힘 상태의 **제목 블록**은 좌측으로 14px 돌출(`marginLeft: -14`) + 상단바 `paddingLeft`를 14px 더해 **내용물(grip·라벨) 절대위치 고정**.
- 돌출 패딩 안쪽에 섹션마크 `§`(절대배치). 접힘/펼침에 따라 내용물이 좌우로 흔들리지 않음.

---

## 결정 사항 요약

| # | 결정 |
|---|------|
| 접힘 지속성 | 세션 한정(새로고침 초기화) — `collapsed`가 이미 Firestore 비저장 로컬 상태 |
| 접기 모드 바 | 모든 블록 표시(드래그 가능) |
| 다중선택 키 | Shift+클릭 (Ctrl는 브라우저 충돌) |
| 다중 드래그 | 단일 고스트 + 드롭 시 묶음 재배치(비연속 허용) |
| 트리거 위치 | 통합툴바 찾기 우측 |

## 변경 파일

- `components/editor/BlockBottomToolbar.tsx` (신규)
- `components/editor/UnifiedToolbar.tsx`
- `components/editor/EditorView.tsx`
- `docs/phaseSketch/블록편집기능 개선.md` (스케치)
