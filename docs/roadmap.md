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

## Phase 9: UI 개선 3 ✅
> 목표: 독립행 수식 행간 보정, 편집창 가독성 및 편의성 개선

### 1. 수식 렌더링 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 독립행 수식 내부 행간 보정 | ✅ | 2026-03-03 | \\\\[1.2em] 전처리로 멀티라인 수식 행간 통일 |

### 2. EditorView 편집창 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 편집창 행간 확대 | ✅ | 2026-03-03 | .cm-line lineHeight 2.0 |
| $$$$ + Space 자동 확장 | ✅ | 2026-03-03 | EditorView.inputHandler로 블록 수식 템플릿 생성 |
| ol/ul 내 독립행 수식 들여쓰기 | ❌ | | remark-math 파서 한계로 보류. 인라인 $~$ 우회 사용 |


# Phase 10: GFM 테이블 및 확장 문법 지원

> 목표: Markdown 표(table), 취소선, 체크리스트 등 GFM 확장 문법 렌더링 지원

## 변경 사항

### 1. remark-gfm 패키지 추가
```bash
npm install remark-gfm
```

### 2. EditorPreview.tsx 수정

**변경 내용:**
- `remark-gfm` 플러그인 추가 → GFM 확장 문법 파싱 활성화
- `components` props에 table/thead/th/td/tr 커스텀 렌더러 추가 → 테이블 스타일링
- `del`, `input` 커스텀 렌더러 추가 → 취소선, 체크리스트 스타일링

**지원되는 GFM 문법:**

| 문법 | 예시 | 설명 |
|------|------|------|
| 표 (table) | `\| a \| b \|` | 완전한 테이블 렌더링 + 스타일링 |
| 취소선 | `~~text~~` | 흐린 색상의 취소선 |
| 체크리스트 | `- [x] done` | 체크박스 UI |
| 자동 링크 | `https://...` | URL 자동 링크 변환 |

### 3. 테이블 스타일링 상세

- 헤더: 밝은 회색 배경(`#f8f9fa`), 굵은 하단 보더(`2px solid #dee2e6`)
- 셀: 적절한 패딩(`10px 14px`), 은은한 구분선
- 행 호버: 마우스 오버 시 배경색 변경 (인터랙티브)
- 반응형: `overflowX: auto` 래퍼로 가로 스크롤 지원
- 테이블 내 line-height를 1.6으로 별도 설정 (본문 2.5와 분리)
- 테이블 내 수식: KaTeX 인라인 수식 정상 렌더링

## 적용 범위

EditorPreview 컴포넌트를 공유하므로 아래 페이지 모두 자동 적용:
- 문제 작성 페이지 (`/problems/new`)
- 문제 편집 페이지 (`/problems/[id]/edit`)
- 문제 보기 페이지 (`/problems/[id]`)
- 에디터 테스트 페이지 (`/editor-test`)

## 적용 절차

```bash
# 1. 패키지 설치
npm install remark-gfm

# 2. 파일 교체
# EditorPreview.tsx → components/editor/EditorPreview.tsx

# 3. 로컬 테스트
npm run dev
# /editor-test 에서 표 문법 테스트:
# | 제목 | 내용 |
# |------|------|
# | $x^2$ | 수식 테스트 |

# 4. 커밋 & 배포
git add -A
git commit -m "Phase 10: GFM 테이블 및 확장 문법 지원 (remark-gfm)"
git push
```

## roadmap.md 추가 내용

```markdown
## Phase 10: GFM 테이블 및 확장 문법 지원
> 목표: Markdown 표(table), 취소선, 체크리스트 등 GFM 확장 문법 렌더링 지원

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| remark-gfm 패키지 추가 | ⬜ | | GFM 파싱 플러그인 |
| EditorPreview 테이블 렌더링 | ⬜ | | 커스텀 table/th/td 컴포넌트 |
| 테이블 스타일링 (호버, 보더) | ⬜ | | 인라인 스타일 적용 |
| 취소선/체크리스트 지원 | ⬜ | | del, input 컴포넌트 |
| 테이블 + KaTeX 수식 조합 확인 | ⬜ | | |
| Vercel 배포 확인 | ⬜ | | |
```
---

상태: ⬜ 대기 / 🔄 진행중 / ✅ 완료 / ❌ 보류