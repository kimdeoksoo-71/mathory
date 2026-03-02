# 개발 로드맵

## Phase 1~6: ✅ 완료 (생략)

## Phase 7: UI 개선 2 ✅
> 목표: 오류 수정, 블록 편집기 기능 확장, Markdown 기능 활성화

### 1. 오류 수정과 기능 완성

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| a. LaTeX 수식 편집기 구분선 오류 수정 | ✅ | 2026-03-01 | MathToolbar 상하 구분선 + 간격 |
| b. 편집창 스크롤 오류 수정 | ✅ | 2026-03-01 | position:absolute + 블록 고정 높이 |
| c. 새 문제 추가 기능 완성 | ✅ | 2026-03-01 | Firestore 즉시 생성 → 편집 진입 |
| d. 문항 보기 화면 제목에 ⋯ 메뉴 추가 | ✅ | 2026-03-01 | ProblemView + ContextMenu 스타일 통일 |

### 2. 블록 편집기 기능 확장

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| a. 블록 추가 하단 고정 + 블록 분할 버튼 | ✅ | 2026-03-01 | 활성 블록 아래 삽입, 커서 기준 분할 |
| b. 블록 타입 4종 (텍스트/그림/선택지/글상자) | ✅ | 2026-03-01 | Block.type 확장, 타입별 UI 분기 |
| c. 블록 드래그 이동 활성화 | ✅ | 2026-03-01 | @dnd-kit + IconGrip 드래그 핸들 |
| d. 블록 제목 입력 기능 | ✅ | 2026-03-01 | Block.title 필드, 인라인 input |
| e. 블록 접기/펼치기 | ✅ | 2026-03-01 | collapsed 토글, 헤더만 표시 |
| f. 활성 블록 배경색 + 미리보기 스크롤 동기화 | ✅ | 2026-03-01 | data-block-id + container.scrollTo |

### 3. Markdown 기능 활성화

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| a. ordered/unordered + Tab/Shift-Tab | ✅ | 2026-03-01 | 커스텀 리스트 번호 + Prec.highest |
| b. blockquote(인용문) 활성화 | ✅ | 2026-03-01 | > 구분자 스타일 적용 |

### 추가 개선사항 (Phase 7 중 반영)

| 항목 | 비고 |
|------|------|
| EditorPreview borderless prop | ProblemView 블록 상자 제거 |
| 이미지 가운데 정렬 | EditorPreview img 컴포넌트 |
| 편집→보기 네비게이션 | AppShell < 버튼 → ProblemView |
| ProblemView ►문제/►풀이 라벨 통일 | fontSize, color 동일 |
| 블록 에디터 autoHeight | 내용에 맞춰 세로 크기 변동 |

## Phase 8: 수식 렌더링 및 레이아웃 개선 ✅
> 목표: 수식 표시 품질 향상, 리스트 기능, 레이아웃 통일

### 1. 수식 렌더링 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 블록 수식($$) 왼쪽 정렬 + 들여쓰기 | ✅ | 2026-03-02 | globals.css .katex-display 오버라이드 |
| array 환경 displaystyle 자동 적용 | ✅ | 2026-03-02 | preprocessMath에서 각 셀에 \displaystyle 삽입 |
| array 환경 행간 확대 | ✅ | 2026-03-02 | \\\\[1em] 간격 옵션 자동 추가 |
| \text{} 폰트 본문과 통일 | ✅ | 2026-03-02 | .katex .text font-family + font-size |

### 2. 리스트 스타일

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| ul (순서 없는 리스트) 내어쓰기 스타일 | ✅ | 2026-03-02 | globals.css disc + padding-left |
| ol 레벨1: (i), (ii), (iii)... | ✅ | 2026-03-02 | CSS counter + lower-roman |
| ol 레벨2: (i-1), (i-2)... | ✅ | 2026-03-02 | 중첩 counter로 부모 번호 연동 |

### 3. 레이아웃 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| ProblemView 블록 간 간격 | ✅ | 2026-03-02 | renderBlocks 개별 렌더링 + marginBottom |
| ProblemView/EditorPreview 가로폭 고정 | ✅ | 2026-03-02 | maxWidth: 600px |

### 미해결 (다음 Phase에서 처리)

| 항목 | 비고 |
|------|------|
| 블록 활성화 시 스크롤 맨 위로 이동 | activateBlock + scrollTop 미작동, 원인 추적 필요 |
| Tab/Shift-Tab 리스트 들여쓰기 | dnd-kit 포커스 관리와 CodeMirror Tab 충돌, 해결 필요 |

---

상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 보류