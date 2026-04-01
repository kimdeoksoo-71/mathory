# 개발 로드맵

## Phase 1: 에디터 MVP ✅
> 목표: Markdown + LaTeX 에디터가 동작하는 최소 프로토타입

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| CodeMirror 6 에디터 세팅 | ✅ | 2026-02-18 | |
| Markdown + LaTeX 구문 하이라이팅 | ✅ | 2026-02-18 | |
| Split View 레이아웃 | ✅ | 2026-02-18 | |
| KaTeX 실시간 미리보기 | ✅ | 2026-02-18 | |
| 수식 편집기 툴바 | ✅ | 2026-02-18 | 16개 버튼으로 확장 |
| Tab placeholder 이동 | ✅ | 2026-02-18 | |

## Phase 2: 데이터 연동 ✅
> 목표: Firebase 연결, 문제 저장/불러오기

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Firebase 프로젝트 세팅 | ✅ | 2026-02-19 | |
| Firebase Auth (Google 로그인) | ✅ | 2026-02-19 | |
| Firestore 스키마 구현 | ✅ | 2026-02-19 | |
| 문제 CRUD API (lib/firestore.ts) | ✅ | 2026-02-19 | |
| 블록 저장/불러오기 | ✅ | 2026-02-19 | |
| 환경변수 관리 (.env.local) | ✅ | 2026-02-19 | |

## Phase 3: 문제 관리 ✅
> 목표: 문제 목록, 검색, 보기 페이지

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 문제 목록 페이지 | ✅ | 2026-02-19 | |
| 검색 (제목, 태그) | ✅ | 2026-02-19 | |
| 필터 (연도, 유형, 카테고리, 난이도) | ✅ | 2026-02-19 | |
| 문제 보기 페이지 (렌더링) | ✅ | 2026-02-19 | |
| 풀이 보기 (접기/펼치기) | ✅ | 2026-02-19 | |

## Phase 4: 고도화
> 목표: UX 개선 및 부가 기능

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 드래그앤드롭 블록 순서 변경 | ✅ | 2026-02-20 | @dnd-kit 사용 |
| 이미지 업로드 (Firebase Storage) | ✅ | 2026-02-20 | HTML img 태그, 크기 조절 가능 |
| 문제 복제 기능 | ⬜ | | 보류 |
| 문제 공유 (URL) | ⬜ | | |
| 인쇄용 레이아웃 | ⬜ | | |
| 모바일 반응형 | ⬜ | | |

## Phase 5: 에디터 고도화 ✅
> 목표: 에디터 편의성 및 가독성 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 미리보기 행간 조정 | ✅ | | CSS line-height 변경 |
| 큰 수식 displaystyle 기본 적용 | ✅ | | KaTeX 옵션 설정 |
| \[, \] 수식 구분자 인식 | ✅ | | remark-math 설정 + 전처리 |
| 에디터 창 크기 조절 (리사이즈) | ✅ | | 드래그 리사이즈 |
| LaTeX 구문 색상 하이라이팅 | ✅ | | CodeMirror 커스텀 확장 |

## Phase 12: Markdown → 아래한글 변환 ✅
> 목표: Mathory 문항을 아래한글(HWP) 문서로 내보내기

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Problem View ⋮ 메뉴에 MD 다운로드 추가 | ✅ | 2026-03-07 | |
| ContextMenu 메뉴 순서 통일 (편집/이름변경/폴더변경/MD다운로드/삭제) | ✅ | 2026-03-07 | |
| AppShell download_md 액션 핸들러 | ✅ | 2026-03-07 | |
| Problem View 제목 클릭 → EditorView | ✅ | 2026-03-07 | |
| FolderView 난이도 표시 수정 (2점/3점/4점) | ✅ | 2026-03-07 | |
| Python LaTeX→아래한글 수식 변환 엔진 (170+ 매핑) | ✅ | 2026-03-07 | |
| tkinter GUI 앱 | ✅ | 2026-03-07 | |
| 아래한글 COM 자동화 (HWPFrame.HwpObject) | ✅ | 2026-03-07 | 32비트 Python 필수 |
| 행 나눔 반영, 수식 앞뒤 띄어쓰기 보존 | ✅ | 2026-03-08 | |
| 여러행 수식 행별 분리 | ✅ | 2026-03-08 | |
| \mathrm → rm{}it 변환 | ✅ | 2026-03-08 | |
| HWP 파일 자동 저장 (다운로드 폴더) | ✅ | 2026-03-08 | |
| \tag*, \tag 제거 | ✅ | 2026-03-08 | |
| \rightarrow / \leftarrow 변환 수정 | ✅ | 2026-03-08 | \left, \right 구분자와 충돌 해결 |

> 상세 설정 기록: `docs/phase12-roadmap.md` 참조

## Phase 13: 수식 입력 편의 기능 ✅
> 목표: LaTeX 수식 입력을 빠르고 편하게

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Step 1: 수식 자동완성 | ✅ | 2026-03-08 | @codemirror/autocomplete, 130+ 항목 |
| Step 2: 수식 툴바 풀다운 개선 | ✅ | 2026-03-08 | 7개 카테고리 (기본/미적분/괄호/기호/원문자/순열조합) |
| Step 3: 수식 상용구 기능 | ✅ | 2026-03-10 | Firestore users/{uid}/math_snippets, 툴바 상용구 버튼, Ctrl+Alt+1~9 단축키, 등록/수정/삭제 UI |
| Step 4: LaTeX 문법 오류 검사 | ✅ | 2026-03-13 | @codemirror/lint, 중괄호/begin-end/구분자/미등록 명령어 4가지 검사, 빨간·주황 물결 밑줄 |
| Step 5: 찾기 및 바꾸기 | ✅ | 2026-03-13 | 커스텀 FindReplacePanel, 전체 블록 통합 검색, 한글 UI, Ctrl+F 단축키, 대소문자/전체일치/정규식 옵션 |
| 맞춤법 검사 | ❌ | — | 부산대 API 차단, 브라우저 내장은 오탐 과다 → 보류 |

## Phase 15: 에디터 기능 안정화 ✅
> 목표: 편집창–미리보기 연동 강화 및 에디터 UX 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 미리보기 클릭 → 편집창 이동 | ✅ | 2026-03-14 | 수식 클릭 시 $...$ 전체 선택, 행번호 기반 2단계 검색 |
| 편집창 → 미리보기 연동 | ✅ | 2026-03-14 | 커서 행번호 → sourceLineMap → 해당 단락/수식에 빨간 보더 하이라이트 |
| 코드 접힘(fold) 기능 제거 | ✅ | 2026-03-14 | .cm-foldGutter display:none |
| 블록 분할 즉시 반영 | ✅ | 2026-03-14 | setContent() 메서드 추가, 분할 후 원본 블록 CodeMirror 즉시 갱신 |

## Phase 16: 편집기 불편요소 제거 ✅
> 목표: 수식 입력 시 방해되는 자동 서식/괄호 기능 제거 및 단축키 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Step 1: 불필요한 자동 서식 제거 | ✅ | 2026-03-14 | markdown() 확장 제거 → 이탤릭(_), 제목(#) 밑줄, 괄호 밑줄 해소 |
| Step 1: 소괄호·대괄호 자동닫기 수식 밖 비활성화 | ✅ | 2026-03-14 | Prec.highest inputHandler로 수식 밖 (, [ 자동닫기 차단 |
| Step 2: 중괄호 자동닫기 보완 | ✅ | 2026-03-14 | 수식 안 { 입력 시 뒤 문자 유무 무관하게 {} 자동삽입 |
| Step 2: Alt+Tab 중괄호 순회 | ✅ | 2026-03-14 | findMathRegion 헬퍼, 수식 영역 내 {} 사이를 순환 이동 |
| Step 3: Shift+Esc 범용 괄호 탈출 | ✅ | 2026-03-14 | findInnermostExit — (), {}, [], $, $$ 중첩 단계별 탈출 |
| 순열조합 툴바 불필요 공백 제거 | ✅ | 2026-03-14 | `\\ \\mathrm` → `\\mathrm` |

## Phase 17: LaTeX Lint 강화 ✅
> 목표: 수식 문법 오류 감지 정확도 및 범위 대폭 확대

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Step 1: 구조적 검사 강화 | ✅ | 2026-03-19 | \left/\right 짝 검사, 필수 인수 개수 검사(\frac→2개 등), & 환경 밖 사용 경고, \[/\] \(/\) 구분자 지원, 환경 이름 오타 검사 |
| Step 2: 명령어 검증 고도화 | ✅ | 2026-03-19 | 오타 교정 제안(레벤슈타인 거리), \hline/\cline 환경 밖 감지, \\\\ 인라인 수식 경고, \color 색상 이름 검증(CSS+dvipsnames+#hex) |
| Step 3: KaTeX 렌더링 검증 | ❌ | — | 미리보기 패널에서 이미 실시간 렌더링 오류 표시 → 중복이므로 보류 |

# Phase 18: 커스텀 찾기/바꾸기 패널

> **목표**: CodeMirror 내장 검색을 제거하고, VSCode + 구글스프레드시트 스타일의 커스텀 찾기/바꾸기 UI 구현
> **시작일**: 2025-03-19
> **완료일**: 2025-03-19
> **상태**: ✅ 완료

---

## 배경

@codemirror/search 내장 검색의 한계:
- UI가 영어 기반이고 커스텀이 거의 안 됨
- LaTeX 구문 안에서의 검색이 부자연스러움
- 패널이 에디터 상단에 고정되면서 레이아웃을 밀어냄
- 매치 하이라이트가 Mathory 디자인과 일관성 없음

→ React 컴포넌트로 UI를 직접 만들고, CodeMirror Decoration API로 하이라이트/치환 로직을 제어

---

## UI 디자인 참고

- **VSCode**: 컴팩트 인라인 패널, 입력창 안에 Aa/ab/.* 토글 버튼
- **구글 스프레드시트**: 한국어 UI, 찾기 및 바꾸기 옵션 레이아웃

---

## 구현 작업

| # | 작업 | 파일 | 상태 |
|---|------|------|------|
| 1 | CodeMirror Decoration 기반 검색 하이라이트 엔진 | `lib/search-highlight.ts` (신규) | ✅ |
| 2 | MarkdownEditor에 search highlight 확장 등록 | `components/editor/MarkdownEditor.tsx` | ✅ |
| 3 | MarkdownEditorHandle에 메서드 추가 | `components/editor/MarkdownEditor.tsx` | ✅ |
| 4 | FindReplacePanel 완전 재작성 (VSCode 스타일) | `components/editor/FindReplacePanel.tsx` | ✅ |
| 5 | 이동 시 페이지 스크롤 버그 수정 | `components/editor/FindReplacePanel.tsx` | ✅ |
| 6 | 닫기 시 입력 초기화 | `components/editor/FindReplacePanel.tsx` | ✅ |
| 7 | 이전/다음 버튼 크기 조정 + 입력창 너비 통일 | `components/editor/FindReplacePanel.tsx` | ✅ |

---

## 신규 파일

### `lib/search-highlight.ts`

CodeMirror StateField + Decoration 기반 검색 매치 하이라이트:
- `setSearchHighlightsEffect`: 매치 목록 + 활성 인덱스를 외부에서 주입
- `clearSearchHighlightsEffect`: 하이라이트 전체 해제
- `searchHighlightField`: StateField — 매치를 보관하고 Decoration 생성
- `searchHighlightTheme`: 활성 매치(주황), 비활성 매치(노란) 배경색

### `components/editor/MarkdownEditor.tsx` 변경

Handle에 추가된 메서드:
- `setSearchHighlights(matches, activeIndex)`: 블록 내 매치에 Decoration 적용
- `clearSearchHighlights()`: 하이라이트 해제
- `scrollToPos(pos)`: 특정 위치로 스크롤 (참고용, 실제로는 수동 스크롤 사용)

Extensions에 추가:
- `searchHighlightField`, `searchHighlightTheme`

### `components/editor/FindReplacePanel.tsx` 재작성

**찾기 모드:**
- 입력창 안에 `Aa`(대소문자), `ab`(전체단어), `.*`(정규식) 토글 버튼
- 매치 카운터: `N / M` 또는 `결과 없음`
- `‹` `›` 이동 버튼 (22px 크기)
- `✕` 닫기 버튼

**바꾸기 모드:**
- `›` 펼침 토글로 활성화
- 바꾸기 입력란 + 바꾸기/모두 바꾸기 버튼
- 찾기/바꾸기 행의 입력창 너비 통일 (minWidth 컨테이너)

**단축키:**
- `Ctrl+F`: 패널 열기
- `Esc`: 패널 닫기 (입력 초기화)
- `Enter`: 다음 매치로 이동
- `Shift+Enter`: 이전 매치로 이동

---

## 해결한 기술 이슈

### autoHeight 모드에서 페이지 전체 스크롤 버그

- **원인**: `EditorView.scrollIntoView`는 CodeMirror 자체 스크롤러를 대상으로 하는데, `autoHeight` 모드에서는 스크롤러가 없어서 브라우저가 페이지 전체를 스크롤
- **해결**: `scrollToPos()` 대신 `getCursorCoords()`로 커서 화면 좌표를 얻고, `.scaled-editor` 컨테이너만 수동 스크롤
- **교훈**: CodeMirror autoHeight 환경에서는 `scrollIntoView` 사용 금지 → 항상 상위 컨테이너 수동 스크롤

### Decoration 갱신 전략

- 블록별로 매치를 그룹핑하여 각 에디터에 독립적으로 Decoration 적용
- 전역 activeIndex → 블록별 activeLocalIndex 변환 필요
- 문서 변경 시 StateField가 자동으로 매치를 초기화 (FindReplacePanel이 재검색)

## Phase 19: 탭 MD copy, 그림 삽입 복원, HWP 변환 개선 ✅
> 목표: 편집기 안정화 및 HWP 변환기 기능 보강

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 탭 헤더 Markdown copy 버튼 | ✅ | 2026-03-21 | 클립보드 복사 |
| 그림 삽입 버그 수정 | ✅ | 2026-03-21 | dnd-kit pointerdown 전파 차단 + Storage Rules 만료일 제거 |
| Canvas API 600px 자동 리사이즈 | ✅ | 2026-03-21 | |
| HWP 변환기 ordered list 변환 추가 | ✅ | 2026-03-21 | |

## Phase 20: ol, uol, 수식 꼬리표 표준화 ✅
> 목표: 국제 표준 입력 → 한국어 출력 변환 체계 확립, \tag 통일

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 기존 ol 스타일 전면 정리 | ✅ | 2026-03-28 | lower-roman counter, .ol-giyeok, .ol-gana CSS 99줄 삭제, preprocessOlTypes 제거 |
| preprocessLocale 신규 구현 | ✅ | 2026-03-28 | 수식 보호(placeholder) → 텍스트 치환 → 복원 파이프라인 |
| (a)~(e) → (가)~(마) 변환 | ✅ | 2026-03-28 | 5개 제한 — (i) 로마숫자 중복 회피, 행 시작 시 marker span + 내어쓰기 |
| (i)~(v) → ㄱ.~ㅁ. 변환 | ✅ | 2026-03-28 | 5개 제한, 행 시작 시 marker span + 내어쓰기 |
| Fig.N → [그림N] 변환 | ✅ | 2026-03-28 | word boundary 정규식 |
| Table N → [표N] 변환 | ✅ | 2026-03-28 | word boundary 정규식 |
| \tag{n} 독립행 수식 꼬리표 | ✅ | 2026-03-28 | KaTeX \tag*{…… ㉠} — Unicode 점 사용 |
| \tag{n} 텍스트 행 꼬리표 | ✅ | 2026-03-28 | inline span + float right — 수식/텍스트 행 입력 방식 통일 |
| (a)/(i) 행 빈 줄 자동 삽입 | ✅ | 2026-03-28 | soft line break에서도 독립 문단(내어쓰기) 보장 |

**전처리 파이프라인**: `preventSetextHeadings → preprocessLocale → preprocessMath`

## Phase 21: PDF 출력 기능 + 편집창 탭 추가 ✅
> 목표: A3 2단 PDF 출력 완성, 동적 탭 시스템 구현
> 완료일: 2026-03-28

### 21-A: 편집창 탭 추가 기능

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| TabMeta 인터페이스 설계 | ✅ | 2026-03-28 | `{id, label}`, Problem 문서에 `tabs` 배열 필드 |
| 기존 데이터 100% 하위 호환 | ✅ | 2026-03-28 | `tabs` 없으면 DEFAULT_TABS fallback |
| 동적 하위 컬렉션 | ✅ | 2026-03-28 | `extra_0_blocks`, `extra_1_blocks` 등 자동 생성 |
| 탭 추가 | ✅ | 2026-03-28 | 자동 라벨: 풀이2, 풀이3, ... |
| 탭 이름 변경 | ✅ | 2026-03-28 | 3번째 탭부터 연필 아이콘 클릭 → 인라인 입력 |
| 탭 삭제 | ✅ | 2026-03-28 | 3번째 탭부터, confirm 후 블록 포함 삭제 |
| Firestore Rules 업데이트 | ✅ | 2026-03-28 | 와일드카드 `/{subcollection}/{blockId}` 허용 |
| allBlocks 통합 관리 | ✅ | 2026-03-28 | `Record<string, LocalBlock[]>` 구조 |
| getProblemWithBlocks 동적 탭 로드 | ✅ | 2026-03-28 | tabBlocks 맵으로 모든 탭 블록 로드 |
| 복제/삭제 동적 탭 지원 | ✅ | 2026-03-28 | duplicateProblem, deleteProblem에서 tabs 순회 |

**DB 구조 변경:**
```
problems/{id}
  ├── tabs: [{id:"question",label:"문제"}, {id:"solution",label:"풀이"}, {id:"extra_0",label:"풀이2"}, ...]
  ├── question_blocks/{blockId}  ← 기존 그대로
  ├── solution_blocks/{blockId}  ← 기존 그대로
  ├── extra_0_blocks/{blockId}   ← 동적 생성
  └── extra_1_blocks/{blockId}   ← 동적 생성
```

### 21-B: PDF 다운로드 기능

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 3점 메뉴 UI | ✅ | 2026-03-28 | 저장 버튼 옆 ⋮ → 드롭다운 |
| 탭 선택 체크박스 | ✅ | 2026-03-28 | 디폴트 전체 선택, 탭별 포함/제외 |
| iframe 방식 인쇄 | ✅ | 2026-03-28 | 미리보기 창 없이 시스템 인쇄 다이얼로그 직접 호출 |
| A3 세로 2단 레이아웃 | ✅ | 2026-03-28 | @page 297×420mm, margin 30mm/20mm |
| column-fill: auto | ✅ | 2026-03-28 | 왼쪽 단 먼저 채운 뒤 오른쪽 단 |
| 탭별 단 바꿈 | ✅ | 2026-03-28 | break-before: column |
| 탭 제목 표시 | ✅ | 2026-03-28 | 14pt 굵게 + 하단 구분선 |

**현재 PDF 규격 (간소화 버전):**
- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 부가 요소 없음 (구분선, 머리말, 꼬리말, 페이지 번호 제거 — 추후 안정적 방법으로 재추가 예정)

### 21-C: \tag{} / \ref{} 통합

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| EditorPreview 전면 교체 | ✅ | 2026-03-28 | 자체 인라인 전처리 (preventSetextHeadings → preprocessLocale → preprocessMath) |
| \tag{n} 수식 내 | ✅ | 2026-03-28 | → \tag*{…… ㉠} |
| \tag{n} 텍스트 행 끝 | ✅ | 2026-03-28 | → <span class="tag-marker">…… ㉠</span> |
| \ref{n} 수식 내 | ✅ | 2026-03-28 | → \text{㉠} |
| \ref{n} 텍스트 | ✅ | 2026-03-28 | → ㉠ (직접 치환) |
| (a)~(e) / (i)~(v) 5개 제한 통일 | ✅ | 2026-03-28 | locale.ts에서 a~n → a~e, i~xiv → i~v로 수정 |
| 빈 줄 삽입 로직 분리 | ✅ | 2026-03-28 | insertMarkerLineBreaks() → 변환 전 1단계로 독립 |
| marker 내어쓰기 CSS | ✅ | 2026-03-28 | p:has(>.marker-gana:first-child) text-indent hanging |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | problem.ts | types/problem.ts |
| 2 | firestore.ts | lib/firestore.ts |
| 3 | locale.ts | lib/locale.ts |
| 4 | preprocess.ts | lib/preprocess.ts |
| 5 | EditorView.tsx | components/editor/EditorView.tsx |
| 6 | EditorPreview.tsx | components/editor/EditorPreview.tsx |
| 7 | BlockEditor.tsx | components/editor/BlockEditor.tsx |
| 8 | PrintableContent.tsx | components/print/PrintableContent.tsx |
| 9 | PrintStyles.css | components/print/PrintStyles.css |
| 10 | PdfDownloadButton.tsx | components/print/PdfDownloadButton.tsx |
| 11 | Icons.tsx | components/ui/Icons.tsx |
| 12 | page.tsx | app/problems/[id]/edit/page.tsx |

### Key Learnings

- **CSS @page + position:fixed로 mm 단위 정밀 배치는 불안정**: 브라우저 인쇄 엔진마다 position:fixed 기준점이 다르고, @page margin의 실제 적용 위치도 예측 불가. 구분선/머리말/꼬리말 같은 정밀 요소는 @page margin + column만으로는 한계가 있음. Puppeteer 또는 jsPDF 같은 도구가 필요.
- **column-fill: auto**: CSS columns의 기본값은 balance(양쪽 균등)이며, auto로 바꾸면 왼쪽 단을 먼저 채움.
- **iframe 인쇄**: window.open 팝업 대신 숨겨진 iframe.contentWindow.print()를 사용하면 미리보기 창 없이 시스템 인쇄 다이얼로그 직접 호출 가능.
- **locale.ts에서 (a)~(e) 범위를 a~n으로 확장하면 (i)와 충돌**: EditorPreview는 a~e로 제한되어 있었으나 locale.ts만 a~n이라 PDF에서 (i)가 알파벳 9번째(자)로 잡힘. 두 파일의 범위를 반드시 동기화해야 함.
## Phase 22: 블록 기능 강화 ✅
> 목표: 블록 종류 9종 확장, 블록 추가/분할 UI 개선, 선택지 자동분류, 이미지 크기 조절, 자동 분할 기능

### 22-A: 블록 타입 9종 확장

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Block.type 9종 정의 | ✅ | 2026-04-01 | text, heading, math_block, bullet, gana, roman, box, choices, image |
| 블록 프리셋 (BLOCK_PRESETS) | ✅ | 2026-04-01 | 타입별 기본 content 자동 입력 |
| imageWidth 필드 추가 | ✅ | 2026-04-01 | Block 인터페이스에 optional 필드 |
| BlockEditor.tsx 타입 동기화 | ✅ | 2026-04-01 | BlockData 타입 9종으로 업데이트 |

### 22-B: 블록 추가/분할 UI 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 추가/분할 버튼 상단 이동 | ✅ | 2026-04-01 | 편집창 하단 → "편집" 행 오른쪽 끝 |
| 블록 추가 드롭다운 | ✅ | 2026-04-01 | 9종 타입 선택 → 프리셋 content로 즉시 생성 |
| 블록 분할 text 전용 | ✅ | 2026-04-01 | text 타입만 커서 위치에서 분할 |
| 블록 분할 단축키 | ✅ | 2026-04-01 | Cmd+B (Mac) / Ctrl+B (Win) |
| 블록 분할 아이콘 | ✅ | 2026-04-01 | IconSplit 원래 아이콘 복원 |

### 22-C: 모두 분할 기능

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| handleSplitAll 구현 | ✅ | 2026-04-01 | 현재 탭의 모든 text 블록 자동 분리 |
| ## / ### 제목행 분리 | ✅ | 2026-04-01 | heading 블록으로 분리 |
| $$ … $$ 수식행 분리 | ✅ | 2026-04-01 | math_block 블록으로 분리 |
| IconSplitAll 아이콘 | ✅ | 2026-04-01 | 이중 화살표 아이콘 |
| 닫히지 않은 $$ 안전 처리 | ✅ | 2026-04-01 | 텍스트로 복원 |

### 22-D: bordered 블록 (gana, roman, box)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 미리보기 각진 테두리 | ✅ | 2026-04-01 | borderRadius: 0, 1.5px solid |
| ProblemView 동일 스타일 | ✅ | 2026-04-01 | 미리보기와 동일 |
| 인쇄 CSS 반영 | ✅ | 2026-04-01 | .print-bordered-block |
| 테두리 바깥 여백 | ✅ | 2026-04-01 | margin: 1.2em 0 (1행 높이) |

### 22-E: 이미지 블록 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 크기 조절 슬라이더 복원 | ✅ | 2026-04-01 | range input, 80~800px, 10px step |
| imageWidth Firestore 저장 | ✅ | 2026-04-01 | handleSave에서 imageWidth 포함 |
| 미리보기/인쇄 imageWidth 반영 | ✅ | 2026-04-01 | maxWidth: 90% 제한 |

### 22-F: 선택지 블록

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 선택지 자동 분류 | ✅ | 2026-04-01 | (1)~(5) 패턴 감지 → ①~⑤ 자동 매핑 |
| 선택지 5행 세로 출력 | ✅ | 2026-04-01 | 가로 배치는 향후 과제로 연기 |

### 22-G: 미리보기/ProblemView 개선

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 미리보기 블록 테두리 제거 | ✅ | 2026-04-01 | borderless prop 전체 적용 |
| 미리보기 블록 간 점선 제거 | ✅ | 2026-04-01 | 내용만 연속 표시 |
| 미리보기 바탕색 흰색 | ✅ | 2026-04-01 | background: #ffffff |
| ProblemView 전체 탭 표시 | ✅ | 2026-04-01 | problem.tabs 순회, 탭 라벨 + 구분선 |
| ProblemView 탭 간 간격 | ✅ | 2026-04-01 | height: 2.5em |
| 제목행 밑줄 색 진하게 | ✅ | 2026-04-01 | #E8E4DF → #999 |

### 22-H: 기타

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 저장 시 빈줄 trim | ✅ | 2026-04-01 | 블록 위아래 빈 행 제거 |
| 툴바 항상 표시 | ✅ | 2026-04-01 | 이미지 블록 시 opacity: 0.35 + pointerEvents: none |
| TEXT_BASED_TYPES 상수 | ✅ | 2026-04-01 | 8종 텍스트 기반 블록 Set |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | problem.ts | types/problem.ts |
| 2 | EditorView.tsx | components/editor/EditorView.tsx |
| 3 | EditorPreview.tsx | components/editor/EditorPreview.tsx |
| 4 | BlockEditor.tsx | components/editor/BlockEditor.tsx |
| 5 | PrintableContent.tsx | components/print/PrintableContent.tsx |
| 6 | PrintStyles.css | components/print/PrintStyles.css |
| 7 | Icons.tsx | components/ui/Icons.tsx |
| 8 | page.tsx | app/problems/[id]/page.tsx |

### Key Learnings

- **EditorPreview의 borderless prop**: borderless를 넘기지 않으면 내부에서 자체적으로 border + borderRadius를 그림. 미리보기 패널에서 블록 테두리를 없애려면 모든 EditorPreview 호출에 borderless를 명시해야 함.
- **showToolbar 조건부 렌더링 vs opacity**: `{condition && <Component/>}`는 DOM에서 완전히 제거/재생성되므로 레이아웃 점프 유발. `opacity + pointerEvents`로 항상 렌더하되 비활성화하는 방식이 더 안정적.
- **선택지 가로 배치의 어려움**: CSS grid 5등분은 가능하나, 내용 길이에 따른 1열/2열 자동 전환은 KaTeX 비동기 렌더와 충돌하여 안정적 구현이 어려움. 향후 과제로 연기.
- **모두 분할 알고리즘**: 텍스트 블록의 줄 단위 파싱으로 ##/### 제목행과 $$...$$ 수식행을 감지. 닫히지 않은 $$는 텍스트로 복원하여 데이터 손실 방지.
