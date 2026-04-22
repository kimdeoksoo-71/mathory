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
| 독립행 수식 왼쪽 정렬 | ✅ | 2026-04-02 | rehype-katex fleqn:true 옵션, 미리보기와 동일하게 좌정렬 + padding-left 3em |

**현재 PDF 규격 (간소화 버전):**
- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 수식: 독립행 수식 왼쪽 정렬 + padding-left 3em (미리보기와 동일)
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
- **PDF 독립행 수식 정렬**: CSS `!important` 오버라이드나 DOM 조작으로는 KaTeX의 centering을 제어할 수 없음. `rehype-katex`의 `fleqn: true` 렌더링 옵션으로 KaTeX 출력 자체를 왼쪽 정렬로 만드는 것이 유일한 확실한 방법.
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

### 22-I: 수식행 분할 기능 (보완)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| lib/mathSplit.ts 신규 모듈 | ✅ | 2026-04-07 | findEnclosingDisplayMath / splitDisplayMathBody / hasBlockedEnvironment / splitDisplayMathAtCursor |
| 차단 환경 처리 | ✅ | 2026-04-07 | cases / dcases / rcases / matrix / pmatrix / bmatrix / vmatrix / Vmatrix / array / gathered / split |
| aligned/align/align* 태그 제거 | ✅ | 2026-04-07 | 메모는 aligned만 언급했으나 align/align*도 함께 처리 |
| 정렬용 & 제거 (\& 보존) | ✅ | 2026-04-07 | placeholder 치환으로 이스케이프 보존 |
| \\\\[5pt] 옵션 spacing 인자 허용 | ✅ | 2026-04-07 | 정규식 `\\\\(?:\[[^\]]*\])?` |
| 블록 헤더 ≡ 버튼 (IconLineSplit) | ✅ | 2026-04-07 | AI 버튼 왼쪽, 텍스트 계열 블록만 노출 |
| 단축키 ⌘⇧L | ✅ | 2026-04-07 | `e.code === 'KeyL'` (한글 IME 대응) |
| handleSplitMathLines 콜백 | ✅ | 2026-04-07 | in-place 치환, 실패 사유 status에 표시 |
| '모두 분할'에 math_block 포함 | ✅ | 2026-04-07 | 다행 수식행 블록도 자동 분리 (pushMathBlocks 헬퍼) |
| \rightarrow / \leftarrow 린터 오탐 수정 | ✅ | 2026-04-07 | leftRightRegex에 `(?![a-zA-Z])` 추가 |

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

## Phase 23-A: AI 풀이 자동완성 ✅
> 목표: 풀이 블록에서 문장 서두를 쓰면 AI가 수식 부분을 완성

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| AI Provider 추상화 (lib/ai-provider.ts) | ✅ | 2026-04-04 | Gemini/Claude 교체 가능 구조 |
| API Route (app/api/ai-complete/route.ts) | ✅ | 2026-04-04 | POST, 시스템 프롬프트 + 후처리 |
| 프롬프트 튜닝 | ✅ | 2026-04-04 | 문자식 우선, 숫자 대입 후 2단계 제한, \times, \dfrac |
| EditorView AI 완성 로직 | ✅ | 2026-04-04 | collectAIContext + handleAIComplete |
| 단축키 Cmd+J | ✅ | 2026-04-04 | 기존 Cmd+B/F 패턴과 동일 |
| 블록 헤더 AI 버튼 (✨) | ✅ | 2026-04-04 | 삭제 버튼 왼쪽, 로딩 시 스피너 |
| IconSparkle + IconLoader | ✅ | 2026-04-04 | SVG 아이콘 |
| 중복 접두사 제거 | ✅ | 2026-04-04 | 서버 후처리 |
| AI 모델: Gemini 2.5 Pro | ✅ | 2026-04-04 | 환경변수 AI_MODEL로 교체 가능 |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | ai-provider.ts | lib/ai-provider.ts (신규) |
| 2 | route.ts | app/api/ai-complete/route.ts (신규) |
| 3 | EditorView.tsx | components/editor/EditorView.tsx |
| 4 | Icons.tsx | components/ui/Icons.tsx |
| 5 | package.json | package.json |

### Key Learnings

- **프롬프트 반복 강조 필요**: Gemini는 "문자식 생략 금지"를 한 번만 쓰면 무시하는 경향. 규칙 + 절대 규칙 + 예시에서 3중으로 강조해야 효과적.
- **후처리 필수**: AI가 기존 텍스트를 반복하거나 "생각:" 메타 텍스트를 붙이는 현상 → 서버에서 접두사 제거 로직 필요.
- **Flash vs Pro**: Gemini 2.5 Flash는 수학 계산 실수 빈번. 풀이 정확성이 중요하므로 Pro 모델 사용.

## Phase 101: 미리보기 / PDF 부분 개선 ✅
> 목표: PDF 파일명, 텍스트·수식 줄바꿈, 미리보기 고정폭, 강조 테두리 클리핑 해결

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| PDF 파일명 = 문항 제목 | ✅ | 2026-04-15 | `window.print()` 직전 `document.title` 교체, 후 복원. 부적합 문자(`/ \ : * ? " < > \|`) 공백 치환 + trim, 빈 값 fallback `'수학 문제'` |
| 텍스트 좌측정렬 + 한글 어절 단위 줄바꿈 | ✅ | 2026-04-15 | `.preview-content p/li/blockquote` 에 `text-align: left; word-break: keep-all; overflow-wrap: break-word` |
| 인라인 수식 원자화 | ✅ | 2026-04-15 | `.preview-content .katex { display: inline-block }` — 기본 `inline`이라 수식 중간에서 줄바꿈되던 문제 해결 |
| 미리보기 고정폭 35em | ✅ | 2026-04-15 | `width: calc(35em + 64px)`, `fontSize: contentFontSize` 로 A+/A- 시 폭 비례 확대 |
| 좁은 창에서 가로 스크롤 | ✅ | 2026-04-15 | Row 3에 `overflowX: auto`, 편집창 `minWidth: 420` |
| 좌우 패딩 확대 | ✅ | 2026-04-15 | 미리보기 좌우 20 → 32px |
| ProblemView 35em 적용 | ✅ | 2026-04-15 | `components/problem/ProblemView.tsx` maxWidth 600 → `calc(35em + 64px)` |
| 레거시 라우트 삭제 | ✅ | 2026-04-15 | `app/problems/[id]/page.tsx` 제거 (AppShell이 주 경로) |
| 강조 테두리 클리핑 해결 | ✅ | 2026-04-15 | `outline` → `box-shadow` 교체, EditorPreview 외곽 div `overflow: auto → visible (borderless)` |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | EditorView.tsx | components/editor/EditorView.tsx |
| 2 | EditorPreview.tsx | components/editor/EditorPreview.tsx |
| 3 | ProblemView.tsx | components/problem/ProblemView.tsx |
| 4 | globals.css | app/globals.css |
| 5 | page.tsx (삭제) | app/problems/[id]/page.tsx |

### Key Learnings

- **KaTeX `.katex` 기본 display는 `inline`**: 긴 인라인 수식이 줄 끝에 걸리면 토큰 경계에서 자유롭게 줄바꿈됨. `display: inline-block` 으로 원자화해야 수식 중간 분리 방지.
- **중간 래퍼의 `overflow: auto`가 box-shadow/outline 클리핑의 진짜 원인**: 상위 컨테이너 패딩을 아무리 줘도, 중간 래퍼가 `overflow: auto`로 padding-box에서 잘라내면 무의미. borderless 모드에서는 자식의 시각 장식(outline/shadow)이 상위로 확장될 수 있도록 `overflow: visible` 로 전환해야 함.
- **PDF 파일명 = document.title**: 브라우저 인쇄 다이얼로그가 `document.title`을 기본 파일명으로 사용. 인쇄 전 교체 + 후 복원 패턴이 가장 단순.
- **`word-break: keep-all`**: 한글 어절 경계에서만 줄바꿈. `overflow-wrap: break-word`와 함께 쓰면 긴 영단어/URL만 예외적으로 분리되어 가독성 유지.

## Phase 25: ProblemView 개편 ✅
> 목표: ProblemView를 2단 구조(본문 + 우측 패널)로 재설계, EditorView의 PDF·MD 복사 기능 통합

### 25-A: 레이아웃 (2단)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 본문 단 가운데 정렬 | ✅ | 2026-04-15 | `calc(35em + 64px)` 고정폭, `justifyContent: center` |
| 우측 단 독립 스크롤 | ✅ | 2026-04-15 | 본문은 `overflowY: auto`, 우측은 별도 overflow 컨테이너 |
| 탭 사이 간격 | ✅ | 2026-04-15 | `marginBottom: 5em` |
| 블록 타입별 렌더링 | ✅ | 2026-04-15 | bordered(gana/roman/box) + image 블록 추가 — EditorView 미리보기와 동등 |
| 동적 탭 지원 | ✅ | 2026-04-15 | `problem.tabBlocks` 순회 (기존엔 question/solution만) |

### 25-B: 우측 패널 (탭 목록 / 메뉴 / 메타)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| "보기" 섹션 — 탭 목록 + 복사 버튼 | ✅ | 2026-04-15 | 각 탭 제목 클릭 시 본문 토글, 복사 버튼은 체크아이콘 2초 후 복원 |
| 기본 펼침: 첫 탭(문제)만 | ✅ | 2026-04-15 | 나머지 탭은 접힘 |
| 메뉴: 편집 / 사본 만들기 / 이름 변경 / PDF 다운로드 / 휴지통 | ✅ | 2026-04-15 | MD 다운로드·폴더 변경·divider 제거 |
| 인라인 메타 편집 | ✅ | 2026-04-15 | 폴더(select) · 대단원(select) · 배점(select, difficulty 라벨만 교체) · 정답(input) — onBlur 시 즉시 Firestore 저장 |
| 입력 배경 투명 / 포커스 시 강조 | ✅ | 2026-04-15 | 클릭 시에만 배경색·테두리 표시 |
| 생성·최종수정 일자 표시 | ✅ | 2026-04-15 | YY-MM-DD / YY-MM-DD : hh-mm |

### 25-C: EditorView 정리

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| Row 1 3점 PDF 메뉴 제거 | ✅ | 2026-04-15 | 저장 · 글꼴 크기만 남김 |
| Row 2 탭 헤더 MD 복사 버튼 제거 | ✅ | 2026-04-15 | ProblemView 보기 섹션으로 이동 |
| 관련 state/import 정리 | ✅ | 2026-04-15 | menuOpen/pdfTabSelection/isPrinting 등 삭제, PrintableContent import 제거 |

### 25-D: 공용 모듈

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| lib/pdfPrint.ts 신규 | ✅ | 2026-04-15 | EditorView의 handlePdfPrint 로직을 공용 함수로 추출 |
| PdfDialog.tsx 신규 | ✅ | 2026-04-15 | 탭 선택 모달 — ProblemView 우측 메뉴의 PDF 다운로드에서 사용 |

### 25-E: 사본 만들기 버그 수정

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| undefined 필드 Firestore 거부 해결 | ✅ | 2026-04-15 | `stripUndefined` 헬퍼 — duplicateProblem 에서 undefined 필드 제거 후 전달 |
| ProblemView 메타 업데이트 undefined 처리 | ✅ | 2026-04-15 | 폴더 해제 시 `undefined` → `''` 로 변환 |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | ProblemView.tsx | components/problem/ProblemView.tsx (전면 재작성) |
| 2 | PdfDialog.tsx | components/problem/PdfDialog.tsx (신규) |
| 3 | pdfPrint.ts | lib/pdfPrint.ts (신규) |
| 4 | EditorView.tsx | components/editor/EditorView.tsx |
| 5 | AppShell.tsx | components/layout/AppShell.tsx |
| 6 | firestore.ts | lib/firestore.ts |

### Key Learnings

- **Firestore는 undefined 거부**: `addDoc`/`updateDoc`에 `{ field: undefined }` 를 넘기면 "Unsupported field value" 에러. optional 필드는 객체에서 완전히 제거하거나 `null`/`''` 로 변환 필요. `stripUndefined` 헬퍼 패턴 재사용 가능.
- **PDF 인쇄 로직 공용화**: EditorView와 ProblemView에서 동일한 `printProblemPdf(title, tabs)` 호출. 한 곳에 있는 DOM 조작·파일명 설정·cleanup 로직을 두 번 유지할 필요 없음.
- **우측 독립 스크롤 구조**: `flex row` 외곽 + 좌측 그룹 `overflowY: auto` + 우측 형제 `overflowY: auto` → `position: sticky` 의 복잡한 제약 없이 독립 스크롤 구현.
- **난이도 = 배점**: `DIFFICULTIES`의 값(2/3/4)과 라벨(2점/3점/4점)이 이미 배점과 일치. 새 필드 추가 없이 UI 라벨만 "배점"으로 표기 변경.

## Phase 27: 교정 기능 신설 ✅
> 목표: EditorView에서 한글 맞춤법·띄어쓰기·인라인수식 조사 공백 오류를 검출하는 검토 기능

### 27-A: 정책 / 결정사항

| 항목 | 결정 |
|------|------|
| 검증 엔진 | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| 호출 단위 | 활성화된 탭의 모든 블록을 한 번의 API 호출로 일괄 처리 (rate limit·비용 대비) |
| 제외 블록 | image, choices (그 외 text·heading·gana·roman·box 검사) |
| 자동 적용 | 없음 — "사람이 생각하고 Mathory는 거든다" 이념 유지, 사용자가 수동으로 수정 |
| 결과 영속성 | 세션 메모리만 (Firestore 저장 안 함) |
| 결과 박스 위치 | 블록 카드 아래, 테두리 바깥 |

### 27-B: 수식 보호 / 마커 마스킹

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 수식 마스킹 (`$..$`, `$$..$$`, `\[..\]`, `\(..\)`) | ✅ | 2026-04-18 | `⟦M0⟧`, `⟦M1⟧`… 토큰으로 치환 후 Claude 전달, 원형 보존 |
| `\tag{}` / `\ref{}` 마스킹 | ✅ | 2026-04-18 | 동일 토큰으로 치환 |
| (a)/(i) 라인 선두 마커 마스킹 | ✅ | 2026-04-18 | gana/roman 마커가 오타로 오인되는 것 방지 |

### 27-C: 인라인수식 ↔ 조사 공백 검출 (로컬)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 한국어 조사 25종 사전 | ✅ | 2026-04-18 | 은/는/이/가/을/를/의/에/와/과/도/만/부터/까지/마저/조차/으로/에서/에게/한테/이라고/이라는/이며/… (긴 조사 우선 매칭) |
| 정규식 검출기 `detectJosaSpacing()` | ✅ | 2026-04-18 | 토큰 절약·결정적·키 없이도 항상 작동 |

### 27-D: API / 백엔드

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| `@anthropic-ai/sdk` 의존성 추가 | ✅ | 2026-04-18 | `^0.32.1` |
| `app/api/proofread/route.ts` 신규 | ✅ | 2026-04-18 | tool_use(`report_issues`) 강제로 strict JSON 보장 |
| `ANTHROPIC_API_KEY` 환경변수 | ✅ | 2026-04-18 | Vercel + `.env.local` 등록, `ANTHROPIC_MODEL`로 모델 오버라이드 가능 |
| 환경변수 등록 절차 문서화 | ✅ | 2026-04-18 | `docs/claude-api-setup.md` |

### 27-E: UI / 프론트엔드

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 툴바 ✓ 버튼 (찾기 🔍 옆) | ✅ | 2026-04-18 | 활성 탭 전체 검사 트리거, 진행 중 IconLoader 표시 |
| `ProofreadResultBox` 컴포넌트 | ✅ | 2026-04-18 | 노란 박스, 종류 태그(맞춤법/띄어쓰기/수식·조사 공백) 색상 구분, 검토 시각 기록 |
| 결과 박스 표시 위치 | ✅ | 2026-04-18 | SortableEditorBlock 카드 아래, 테두리 바깥 |
| 검토 실패 시 재시도 버튼 | ✅ | 2026-04-18 | 결과 상자 안에 배치, 해당 블록만 재호출 |
| 전체 닫기 ✕ (박스 우상단) | ✅ | 2026-04-18 | |
| 항목별 닫기 ✕ | ✅ | 2026-04-18 | 개별 항목 무시 가능 |
| 인쇄/PDF에서 박스 숨김 | ✅ | 2026-04-18 | `@media print` `.proofread-box { display: none }` |

### 27-F: 동기화 정책

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 블록 편집 시 stale 항목만 자동 제거 | ✅ | 2026-04-18 | `original` 스니펫이 본문에 더 이상 존재하지 않는 항목만 사라짐 (전체 박스를 닫지 않음) |
| 저장 시 결과 전체 초기화 | ✅ | 2026-04-18 | Firestore 저장 후 블록 ID가 갱신되어 매칭이 깨지므로 |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | proofread.ts (신규) | lib/proofread.ts |
| 2 | route.ts (신규) | app/api/proofread/route.ts |
| 3 | ProofreadResultBox.tsx (신규) | components/editor/ProofreadResultBox.tsx |
| 4 | claude-api-setup.md (신규) | docs/claude-api-setup.md |
| 5 | EditorView.tsx | components/editor/EditorView.tsx |
| 6 | PrintStyles.css | components/print/PrintStyles.css |
| 7 | package.json | package.json |

### Key Learnings

- **tool_use로 strict JSON 강제**: Claude API에 `tool_choice: { type: 'tool', name: '...' }`로 지정하면 자유 텍스트가 아닌 정의된 schema의 input으로 응답이 보장됨. 자유 응답 파싱·재시도 로직 불필요.
- **수식 보호 = 마스킹**: 검사 대상 영역만 분리해서 모델에 보내는 게 아니라, 보호 영역을 placeholder 토큰(`⟦M0⟧`)으로 치환해 통째로 보내고 결과를 그대로 표시. 위치 매핑·재조립 부담이 사라짐.
- **로컬 규칙 + AI 분리**: 결정적인 검사(인라인수식↔조사 공백)는 정규식으로 로컬 처리, 모호한 한국어 맞춤법만 AI에게 위임 → 토큰 비용·키 의존도 양쪽 모두 절감.
- **stale 자동 제거 정책**: 편집 시 박스 전체를 닫지 않고 `value.includes(issue.original)` 검사로 사라진 항목만 제거. 다중 오류 블록의 사용성 결정적 차이.
- **dnd-kit + 외부 결과 박스**: SortableEditorBlock을 fragment로 감싸서 결과 박스를 형제로 추가해도 정렬/드래그가 정상 동작. 결과 박스는 sortable item이 아니어서 드래그 대상에서 자연스럽게 제외됨.

## Phase 28: OCR 기능 신설 ✅
> 목표: Mathpix API로 수식 이미지를 LaTeX로 변환하여 에디터에 삽입

### 28-A: 정책 / 결정사항

| 항목 | 결정 |
|------|------|
| OCR 엔진 | Mathpix `/v3/text` (formats: `text`) |
| 입력 방식 | 이미지 파일 업로드만 (스크린 영역 캡처는 추후) |
| 대상 이미지 | 수식 + 일반 텍스트 혼합 허용 |
| 허용 포맷 | PNG / JPG / WEBP, 최대 5MB, 2000px 초과 시 다운스케일 |
| 삽입 위치 | 현재 블록 커서 위치에 `\n + 결과 + \n` |
| 수식 구분자 | Mathpix 요청 시 `math_inline_delimiters: $`, `math_display_delimiters: $$`로 고정 |
| `\[..\]` / `\(..\)` | 잔여분은 `$$`/`$`로 강제 치환 (안전장치) |
| 후처리 | `autoFixDeterministicIssues` 재사용 (^/_ 중괄호, 조사 공백) |
| 에러 UX | `alert()` |
| API 키 보안 | 서버 라우트 프록시, `.env.local`에 `MATHPIX_APP_ID` / `MATHPIX_APP_KEY` |

### 28-B: 구현

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| `lib/ocr.ts` 신규 | ✅ | 2026-04-22 | 파일 검증 / 다운스케일 / data URL / 정규화+교정 |
| `app/api/ocr/route.ts` 신규 | ✅ | 2026-04-22 | Mathpix 프록시, `text` 포맷(수식+텍스트) 반환 |
| EditorView 툴바에 OCR 버튼 | ✅ | 2026-04-22 | 맞춤법 ✓ 버튼 뒤, 블록 미선택 시 비활성 |
| 파일 업로드 → 커서 위치 삽입 | ✅ | 2026-04-22 | `editorRefs.insertText(payload, payload.length)` |
| 로딩 상태 | ✅ | 2026-04-22 | 버튼 스피너 + disabled |
| `.env.local` 키 등록 | ⬜ |  | 덕수 직접 등록 (MATHPIX_APP_ID, MATHPIX_APP_KEY) |

### 변경 파일 목록

| # | 파일 | 경로 |
|---|------|------|
| 1 | ocr.ts (신규) | lib/ocr.ts |
| 2 | route.ts (신규) | app/api/ocr/route.ts |
| 3 | EditorView.tsx | components/editor/EditorView.tsx |

### Key Learnings

- **기존 교정 규칙 재사용**: OCR 후처리 스펙 두 항목(^/_ 중괄호, 조사 공백)은 Phase 27의 `autoFixDeterministicIssues`와 완전 동일 → 새 로직 작성 없이 그대로 호출.
- **`text` 포맷 + 구분자 지정**: Mathpix `text`는 기본적으로 `\( \)`/`\[ \]` 구분자를 쓰지만 `math_inline_delimiters`/`math_display_delimiters` 파라미터로 mathory 규칙(`$`/`$$`)을 강제할 수 있음 → 클라이언트 후처리 부담 최소화.
- **커서 이동 API의 `{}` 래핑**: `MarkdownEditor.insertText`는 `text.match(/\{\}/g)`로 **빈** 중괄호만 커서 이동 대상으로 삼음 → OCR 결과(`\frac{a}{b}` 등)는 영향 없음.
