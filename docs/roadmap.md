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

### 22-J: 편집창 레이아웃 보정 (26-05-29)

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| 블록 상단바 자동 숨김/표시 | ✅ | 2026-05-29 | 활성(focused) 블록만 헤더 노출, 비활성은 헤더 자체를 숨겨 주의 분산 방지 |
| 접기/펴기 토글 버튼 제거 | ✅ | 2026-05-29 | 쓰임 없음 → 버튼 + handleToggleCollapse + IconChevron 임포트 정리 |
| 편집창 최대폭 35em 고정 | ✅ | 2026-05-29 | 큰 화면에서 폭 과잉 방지, 미리보기 콘텐츠 폭과 정합. `maxWidth: 35em` + `margin: 0 auto` 중앙 정렬 |
| 미리보기 좌우 패딩 64 → 32 축소 | ✅ | 2026-05-29 | 외곽 폭 `calc(35em + 128px)` → `calc(35em + 64px)` 동기화. 편집창과 시각적 균형 개선 |

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

## Phase 29: 블록체인 저작권 등록 기능 신설 ✅
> 목표: 문제/풀이 콘텐츠를 블록체인 해시로 등록하여 작성 시각과 작성자를 위변조 불가능하게 증명

### 29-A: 정책 / 결정사항

| 항목 | 결정 |
|------|------|
| 두 레이어 구조 | Layer 1(자동, 무료, Firestore serverTimestamp + SHA-256) + Layer 2(선택, 버튼 클릭, 블록체인 트랜잭션) |
| 해시 입력 범위 | 모든 탭의 모든 블록 (question + solution + extra_N) |
| 해시 입력 정규화 | `{v, authorUid, createdAt, tabs:[{id, blocks:[{order,type,raw_text,title,imageWidth}]}]}` JSON 직렬화 |
| authorUid 마이그레이션 | 신규 저장부터만 기록 (기존 문제는 첫 등록 시점에 현재 사용자로 자동 채움) |
| API 인증 수준 | C2 (무인증) — 단일 사용자 운영. 오픈소스 공개 전 C1(Firebase ID 토큰)로 업그레이드 필요 |
| 수정 후 UX | 자동 재등록 안 함, "수정됨" 배지 표시 (재등록은 사용자 선택) |
| 배지 위치 | ProblemView/FolderView 제목 옆 (자체 SVG 아이콘) |
| 비등록자 UI | 본인 문제만 등록 버튼 표시 |
| 라이브러리 | viem ^2.48.8 |

### 29-B: 구현

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| `types/problem.ts` 필드 확장 | ✅ | 2026-05-04 | authorUid, copyright, blockchain |
| `lib/copyright.ts` 신규 | ✅ | 2026-05-04 | computeContentHash, formatRegisteredAt |
| `app/api/copyright/register/route.ts` 신규 | ✅ | 2026-05-04 | 트랜잭션 전송 API |
| EditorView 저장 시 contentHash 자동 갱신 | ✅ | 2026-05-04 | |
| CopyrightPanel (ProblemView/FolderView 우측 패널) | ✅ | 2026-05-04 | 등록 버튼·상태 표시 |
| BlockchainBadge (제목 옆 배지) | ✅ | 2026-05-04 | 수정 시 흐림 처리 |
| IconBlockchain SVG | ✅ | 2026-05-04 | 4-블록 연결 아이콘 |
| createProblem authorUid 전달 | ✅ | 2026-05-04 | AppShell, /problems/new |
| 기존 문제 authorUid 자동 채움 | ✅ | 2026-05-04 | 첫 등록 시 현재 사용자 UID로 |

### Key Learnings

- **단일 사용자 단계에서는 인증 생략 가능**: API Route 인증은 정석적으로 firebase-admin + ID 토큰 검증이지만, 단일 사용자 운영 중에는 무인증 + 서버 지갑 키만으로 충분. 오픈소스 시점에 업그레이드.
- **블록 ID는 해시 입력에서 제외**: 저장 시 delete-all → re-add 방식이라 ID가 매번 갱신됨. 해시는 `raw_text` + 메타로만 계산해야 결정적.
- **`serverTimestamp()`는 클라이언트 SDK로도 충분**: firebase-admin 없이도 Google 서버가 직접 타임스탬프를 찍어주므로 클라이언트 조작 불가.
- **viem `sendTransaction` 타입 우회**: `kzg` 필드 undefined 처리 + `as any` 캐스팅 필요.
- **Vercel 환경변수는 프로젝트 레벨 등록**: 팀 레벨이 아닌 프로젝트 레벨에 등록해야 API Route에서 인식됨.

## Phase 30: 블록체인 원본인증 (Polygon 복귀) ✅
> 목표: 인증 시간 1시간+ 걸리는 OpenTimestamps의 실효성 한계를 해결하기 위해 Polygon mainnet으로 복귀. "저작권 등록" → "블록체인 원본인증"으로 용어 순화하여 법적 위험 회피.

### 30-A: 정책 / 결정사항

| 항목 | 결정 |
|------|------|
| 네트워크 | Polygon mainnet (POL 가스 토큰) |
| 트랜잭션 형태 | 자기 주소로 0 POL 송금 + `data` 필드에 64-char hex hash |
| Confirmation | 1 block (~2초) |
| RPC | 기본 `polygon-rpc.com` (POLYGON_RPC_URL 환경변수로 override 가능) |
| 서버 지갑 주소 | `0x04197058E88FE89ED12E8e4C5eD86B330Bc87328` (Mathory 01) |
| Private key 관리 | Vercel 환경변수 `MATHORY_WALLET_PRIVATE_KEY` |
| 초기 자본 | 50 POL (Upbit 구매 → MetaMask → Mathory 서버 지갑) |
| 건당 비용 | 약 0.01~0.05 POL (~$0.001) |
| 용어 | "저작권 등록" → "블록체인 원본인증" (법적 위험 회피) |
| 검증 경로 | Polygonscan tx 상세 페이지 (data 필드 해시 직접 조회) |
| 기존 OTS 레코드 처리 | `txHash` 없음 = 미인증 취급 → 재등록 유도 (마이그레이션 스크립트 불필요) |

### 30-B: 구현

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| API Route를 viem + Polygon으로 복원 | ✅ | 2026-05-13 | `app/api/copyright/register/route.ts` |
| `BlockchainRecord` 타입 Polygon화 | ✅ | 2026-05-13 | txHash, explorerUrl 기반 |
| CopyrightPanel: pending 분기 제거, Polygonscan 링크 | ✅ | 2026-05-13 | |
| BlockchainBadge: pending 분기 제거 | ✅ | 2026-05-13 | `txHash` 없는 레코드 무시 |
| `opentimestamps` 의존성 제거 | ✅ | 2026-05-13 | `npm uninstall` |
| Vercel 환경변수 갱신 | ⬜ | | 새 지갑 private key로 교체 (덕수 직접) |

### Key Learnings

- **Confirmation 시간이 UX를 결정**: OpenTimestamps는 비용 0 + 지갑 불필요라는 장점에도 불구하고 비트코인 블록 확정까지 1시간+ 걸려 실제 인증 UX 불가. 2~5초 내 확정되는 Polygon이 1인 사용자 입장에서는 훨씬 합리적.
- **법적 용어 회피**: "저작권 등록"은 한국저작권위원회 절차를 연상시켜 오해 소지 → "블록체인 원본인증"이 정확함. 법적 안전 마진 확보.
- **데이터 마이그레이션은 코드 가드로 대체 가능**: 기존 OTS 레코드를 Firestore에서 정리하지 않고, 표시 단계에서 `txHash` 유무로 분기 → 마이그레이션 스크립트 작성 비용 절감.
- **지갑 private key 노출 사고**: 이전 지갑(`0x55c8...`) private key를 채팅창에 실수 입력 → 즉시 폐기하고 새 지갑(`0x0419...`) 생성. 비밀값은 절대 채팅창에 다루지 말 것.
- **`npm uninstall`만으로 충분**: 코드에서 import 제거 후 npm uninstall하면 package-lock도 정리됨. 별도 vendoring/clean 단계 불필요.

## Phase 31: 공유 기능 (웹 공개 / 멤버 공유 / 댓글) ✅
> 목표: 단일 사용자 도구에서 다중 사용자 협업 도구로 확장하는 첫 단계. 외부 비로그인 사용자에겐 링크 기반 읽기 공유, 지인에겐 멤버 기반 권한 공유, 멤버 간 토론을 위해 탭 단위 댓글까지 한 흐름으로 구축.

### 31-A: 정책 / 결정사항

| 항목 | 결정 |
|------|------|
| 공유 모델 분리 | (1) **웹에 공개** — 링크 + 비로그인 접근, 스냅샷 / (2) **멤버에 공유** — 로그인 + 역할 기반, 라이브 |
| 멤버 역할 | viewer / commenter 2종 (편집은 오너 전용. 공동편집은 향후 워크스페이스에서) |
| 멤버 검색 | 이메일 prefix 자동완성 → 정확 매칭으로 추가 |
| 탭별 가시성 | `problem.memberTabVisibility` 단일 소스로 통합. 웹 공개 생성 시점에 스냅샷에 복사, 멤버 공유는 라이브 반영 |
| 공개기간 | 1일 / 3일(기본) / 7일 / 30일 / 무기한 (`expiresAt: Date \| null`) |
| 단일 공유 정책 | 한 문항당 활성 링크 1건 + 멤버 목록 1개 |
| 본인 공유 해제 | 멤버가 자기 자신을 멤버 목록에서 제거 가능 (Rules `diff().affectedKeys().hasOnly()` 보호) |
| 댓글 단위 | 탭 단위 (블록 단위는 차후 "편집 제안"에서) |
| 댓글 권한 | 읽기: 오너 + 모든 멤버 / 작성: 오너 + commenter / 수정·삭제: 작성 본인만 / 해결됨 토글: 작성자 또는 오너 |
| 댓글 콘텐츠 | KaTeX 수식 지원 (간소 미니 툴바: 인라인 $·분수·제곱·아래첨자·루트·적분·시그마) |
| 알림 | (이번 Phase에서는 미구현) 향후 본인 문항 새 댓글, 내 댓글에 답글, 멤버 초대 시 인앱 알림 |
| 인가 모델 | 웹 공개는 `shares/{shareId}` 스냅샷 단일 읽기로 단순화. 멤버 공유는 problem 문서의 `members`/`memberUids`/`memberTabVisibility` |
| 검색 인덱스 | 사이드바 검색에 본문 lazy 인덱스 추가 (`getProblemSearchText`) — 첫 검색 시 1회 빌드 후 메모리 캐시 |

### 31-B: 구현

| 항목 | 상태 | 완료일 | 비고 |
|------|------|--------|------|
| `types/problem.ts`: Share, MemberRole, TabComment, memberTabVisibility 등 | ✅ | 2026-05-23 | |
| `lib/shares.ts` — 스냅샷 모델 (nanoid shareId, 무기한 지원) | ✅ | 2026-05-23 | |
| `lib/membership.ts` — 멤버 CRUD, 이메일 prefix 검색, listSharedWithMe | ✅ | 2026-05-23 | |
| `lib/comments.ts` — 탭 댓글 CRUD, 스레드 빌더, resolved 토글 | ✅ | 2026-05-23 | |
| `firestore.rules` — 멤버 기반 읽기, 탭 가시성 분기, tab_comments 전용 매치 | ✅ | 2026-05-23 | catch-all에서 tab_comments 제외 |
| `app/shared/[shareId]/page.tsx` — 비로그인 뷰어 페이지 (탭 전환·작성자 표시·만료 처리) | ✅ | 2026-05-23 | |
| SharePanel (인라인) — 웹 공개 / 멤버 공유 / 탭 가시성 통합 | ✅ | 2026-05-23 | ProblemView 우측 사이드바 펼침형 |
| 사이드바 "공유 받은 문항" 특수 폴더 | ✅ | 2026-05-23 | `SHARED_WITH_ME_FOLDER_ID` |
| FolderView 카드 그리드 + 우측 패널 제거 | ✅ | 2026-05-23 | `repeat(auto-fill, 35em)` + center |
| ProblemView 우측 사이드바 정리: 문제정보 통합, 저자/생성/수정/원본인증 하단 묶음 | ✅ | 2026-05-23 | |
| CommentPanel — 우측 슬라이드 + MiniMathToolbar + CommentEditor | ✅ | 2026-05-23 | 본문보다 2pt 작게, 톤다운, KaTeX `--text-primary` |
| 사이드바 검색을 탭 본문까지 확장 | ✅ | 2026-05-23 | lazy 인덱스, 자동 무효화 |
| 알림 (`notifications`) — 본인 문항 댓글 / 답글 / 멤버 초대 | ⬜ | | Phase 32에서 진행 |

### Key Learnings

- **스냅샷 vs 라이브 인가의 분리**: 웹 공개는 share 문서에 problem + tabBlocks 전체를 denormalize → 비로그인 단일 읽기로 완결. 멤버 공유는 라이브 problem 문서 직접 참조. 두 모델을 분리하니 Rules가 단순해지고 비용도 낮아짐.
- **Firestore `list` 쿼리는 per-doc 조건이 있으면 사전 검증 불가**: 댓글 read 규칙에 `tabAllowedForMemberCmt(resource.data.tabId)` 같은 per-doc 조건을 걸자 `listAllComments` 쿼리가 전체 거부됨. 멤버 댓글 표시는 일부러 read 규칙을 단순화하고(`isMemberCmt()`만), create에서 탭 가시성 검증.
- **`where(array-contains) + orderBy`는 복합 인덱스 필요**: `listSharedWithMe`에서 orderBy를 빼고 클라이언트 사이드 정렬로 전환 (인덱스 생성 회피).
- **권한 거부된 탭은 폴백으로 처리**: 멤버가 숨겨진 탭의 블록 서브컬렉션을 읽으려 하면 전체 `getProblemWithBlocks` 실패 → 탭별 try/catch로 격리하고 빈 배열로 진행.
- **카드 그리드 폭 고정 + auto-fill + center**: `repeat(auto-fill, minmax(35em, 1fr))`는 카드가 늘어남. `repeat(auto-fill, 35em)` + `justifyContent: center`로 카드 폭 고정·열 수만 반응형 조절.
- **CSS 변수가 컴포넌트 경계를 넘는 유일한 통일성 도구**: 상단 바 높이 52px·본문 텍스트 톤 #6a6a6a·수식 색 `--text-primary` 등 세 영역에 동일 값을 강제하려면 매번 직접 하드코딩 또는 CSS 변수 활용 필수.
- **친근한 UX 디테일이 패널 인지의 핵심**: "변경완료" 토스트 위치, 댓글 패널 X 버튼과 토글 분리, 본문이 패널 폭만큼 자동 시프트 등의 소소한 정렬이 "툴이 제대로 만들어졌다"는 인상을 결정.

---

## Phase 32: SVG 블록 시스템 + 줌/팬 뷰어 ✅

**완료일**: 2026-05-27 **커밋**: `3080057`

### 32-A: 목표

- HWP 대체 워크플로우에서 이미지 종류를 명확히 구분 (일반 비트맵 vs SVG)
- SVG: 벡터 보존, 인쇄 시 무손실, 줌/팬으로 부분 확대 가능
- 편집자가 "보여주고 싶은 초기 뷰"를 저장하여 열람자에게 강조점 전달
- 향후 GeoGebra 등 동적 그림 도구 확장 경로 확보 (UI 자리만 마련)

### 32-B: 결정사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 그림 종류 진입 경로 | 툴바 X, 블록 내부 "파일 선택" → 종류 모달 | 툴바를 "블록 추가/분할"만 담는 invariant 유지. 발견성은 placeholder 칩(빈 텍스트 블록 헤더)으로 보강 |
| 인쇄 시 SVG 뷰 | 저장된 초기뷰로 transform 적용 | 저자 의도 존중. 단, positionX/Y는 편집 당시 컨테이너 폭 기준이라 인쇄 컬럼 폭이 다르면 오차 — 후속 개선 |
| 초기뷰 저장 버튼 위치 | 우상단 floating, 편집모드에만 노출 | 빈도 낮은 액션이라 눈에 띄지 않게 |
| SVG sanitize 시점 | 업로드 직전 1회 → Storage엔 정제본만 | 런타임 부담 0 |
| 활성화 UX | 클릭 시에만 줌/팬 활성, 외부 클릭 시 해제, FolderView 동일 그림자 | 의도치 않은 줌/팬 방지 |
| GGB | 모달에 비활성 노출만 | 자리만 확보 |

### 32-C: 구현

| 항목 | 상태 | 비고 |
|------|------|------|
| `types/problem.ts`: `svg` 타입, `svg_initial_view`, `svg_height` | ✅ | |
| `lib/svg-sanitizer.ts` — DOMPurify + viewBox 자동생성 | ✅ | width/height 픽셀값에서 viewBox 추론 |
| `lib/storage.ts` `uploadSvg` — sanitize 후 업로드 | ✅ | |
| `components/viewer/SvgViewer.tsx` — react-zoom-pan-pinch 래퍼 | ✅ | 클릭 활성화, 초기뷰 저장, 전체화면 |
| `components/editor/ImageTypeSelectModal.tsx` — 일반/SVG/GGB 모달 | ✅ | |
| `EditorView`: MediaBlockContent 통합, 헤더 placeholder 칩(제목/그림/(가)(나)(다)), 미리보기 분기 | ✅ | |
| `ProblemView` / `FolderView` / `PrintableContent` 분기 | ✅ | |
| Firebase Storage CORS 설정 + 문서 | ✅ | `cors.json`, `docs/Firebase Storage CORS 설정.md` |

### Key Learnings

- **`react-zoom-pan-pinch`의 `disabled: true`는 `setTransform`도 차단**: 라이브러리 소스(`setTransform` line 1027)에서 `setup.disabled`면 early return. 미리보기 화면이 편집창 초기뷰 저장에 반응 안 하는 원인이었음. 전체 `disabled` 대신 `wheel/panning/pinch/doubleClick` 각각 `disabled` 처리로 해결.
- **viewBox 없는 SVG는 `width:100%`로 바꿔도 잘림**: SVG가 `<svg width="800" height="600">`만 있고 viewBox 없으면 내부 좌표가 픽셀 절대값이라 컨테이너에 안 맞춤. 정규화 시 width/height 픽셀값에서 `viewBox="0 0 W H"` 자동 생성 필수.
- **라이브러리 CSS 모듈은 inline style을 이길 수 있다**: `react-zoom-pan-pinch`가 wrapper/content를 `width: fit-content`로 강제. 인라인 style이 같은 specificity로 충돌 → 호스트 클래스에서 `!important`로 override 필요.
- **클릭 vs 드래그 구분**: 4px 미만 이동을 클릭으로 판정. mousedown 위치 저장 → mouseup에서 delta 비교. 라이브러리의 `onPanning*` 콜백에 의존하지 않는 단순한 방식이 디버깅 쉬움.
- **빈 블록 placeholder 칩의 가치**: 툴바를 단순하게 유지하면서 발견성을 보강하는 패턴. 헤더 행 안에 16px 높이로 들어가서 시각적 부하 최소.

---

## Phase 34: GGB(GeoGebra) 블록 ✅

**완료일**: 2026-05-29

### 34-A: 목표

- `.ggb` 파일 업로드 → 인터랙티브 GeoGebra 임베드 (점·도형 끌기, 슬라이더 조작)
- SVG가 못 다루는 동적 변화 영역을 채움
- Phase 32 인프라(그림 종류 모달, 활성화 UX, 초기뷰 저장)를 최대한 재사용

### 34-B: 결정사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 렌더링 방식 | `deployggb.js` 인라인 임베드 | 통제력·UI 통일성 |
| 라이브러리 로딩 | 클릭 활성화 시점 lazy load | 5MB 부담 최소화 |
| 비활성 표시 | 단순 빈 박스 + "▶ GGB 활성화" | poster는 후속 |
| UI 옵션 | 고정값 (툴바·메뉴 false, shift-drag-zoom true) | 단순화 |
| 초기 뷰 저장 | `getViewProperties(1)` 파싱 → `setCoordSystem` 적용 (반복) | getXmin류 API 미노출 .ggb에서 폴백 |
| 활성화 UX | placeholder 클릭만 활성화. 내부 클릭은 토글 X (GGB 내부 버튼 보존) | SVG와 미세하게 다름 |
| Fullscreen | 자체 오버레이 (position:fixed) | Browser Fullscreen API는 Mac OS 메뉴바까지 가려 부적절 |
| 잔존 nav bar 빈 공간 | iframe을 컨테이너보다 50px 크게 + overflow:hidden | GGB가 nav 제거 후 공간 재분배 안 함 |
| 미리보기·썸네일 | 인스턴스 X, 정적 박스 | 5MB 메모리 보호 |
| 인쇄 | "GGB 인쇄 미지원" 안내 박스 | PNG export 자동화는 후속 |

### 34-C: 구현

| 항목 | 상태 | 비고 |
|------|------|------|
| `types/problem.ts`: `ggb` 타입, `ggb_initial_coords`, `ggb_height` | ✅ | |
| `lib/ggb-loader.ts` — deployggb.js 모듈 캐시 lazy loader | ✅ | |
| `lib/storage.ts` `uploadGgb` — .ggb 검증 + Storage 업로드 | ✅ | |
| `components/viewer/GgbViewer.tsx` — applet inject + cleanup + 활성화 | ✅ | |
| `ImageTypeSelectModal` — GGB 옵션 활성화 | ✅ | |
| `EditorView` MediaBlockContent ggb 분기 + 핸들러 + 저장 | ✅ | |
| `EditorView` 미리보기 정적 박스 (interactive=false) | ✅ | |
| `ProblemView` ggb 분기 (interactive) | ✅ | |
| `FolderView` 정적 박스 | ✅ | |
| `PrintableContent` "인쇄 미지원" 박스 | ✅ | |
| BLOCK_TYPES에서 ggb 제외, 기존 ggb 블록 옵션 보존 | ✅ | |
| `firestore.ts` duplicate ggb 필드 | ✅ | |

### Key Learnings

- **외부 5MB 자산은 활성화 시점 lazy load + 모듈 캐시 promise가 정답**: 페이지에 GGB 블록이 여러 개 있어도 deployggb.js는 한 번만 다운로드. 활성화하지 않으면 다운로드 자체가 없음.
- **applet inject DOM ID는 인스턴스마다 유일해야 함**: counter 기반 ID 패턴으로 충돌 회피. SSR 영향 안 받도록 ref에 보존.
- **`applet.remove()` 실패 대비 컨테이너 DOM 직접 비우기**: GGB 버전·iframe 상태에 따라 remove가 실패할 수 있어 `container.innerHTML = ''` 폴백.
- **GGB API 노출 메서드는 `.ggb` 파일/버전마다 다름**: `getXmin/getXmax/getYmin/getYmax`가 없는 경우가 흔함. `getViewProperties(viewId)`가 더 일관적 — JSON으로 `{xMin, yMin, width, height, invXscale, invYscale}` 반환. `xMax = xMin + width * invXscale`로 계산.
- **`Corner()` 명령은 .ggb 파일 컨텍스트가 안 맞으면 GGB 자체 에러 다이얼로그를 띄움** — 사용자 화면에 떠서 매우 거슬림. evalCommand 폴백은 신중히.
- **`setup.disabled === true`는 setCoordSystem까지 차단** (Phase 32와 동일 함정): 프로그래밍 transform 유지하려면 wheel/panning/pinch 각각 disabled로.
- **활성화 UX는 GGB 같은 무거운 임베드에서 필수**: 메모리·CPU 보호에 결정적. 단, GGB는 SVG와 달리 내부에 버튼(home/zoom 등)이 있어 "내부 클릭으로 비활성화" 패턴이 부적절 — placeholder 클릭만 활성화, 외부/ESC만 비활성화.
- **Browser Fullscreen API는 Mac OS에서 메뉴바까지 가려서 부적절**: 자체 `position:fixed inset:0` 오버레이가 깔끔 + 리사이즈 제어도 쉬움.
- **`display:none`으로 GGB nav bar를 숨겨도 graphics view가 공간을 회수 못함**: GGB가 내부 레이아웃을 재계산 안 함. `api.setSize` 호출해도 안 됨. **iframe을 컨테이너보다 EXTRA_BOTTOM(50px) 크게 만들고 overflow:hidden으로 잘라내는 트릭**이 가장 안정적.
- **광범위 selector(`[class*="navbar"]`)는 위험**: GGB의 home/zoom 버튼 panel도 클래스에 "navbar"를 포함할 수 있어 같이 가려짐. 정확한 클래스(`.consProtNav` 같은)를 DevTools로 찾아 좁게 타깃해야 안전.
- **인쇄 한계의 정직한 표시**: GGB가 인쇄에 안 찍히는 건 알려진 한계 — 박스에 명시적으로 "인쇄 미지원" 표시가 침묵의 빈 박스보다 사용자에게 친절.


## Phase 35: 단일 활성 세션 ✅

동일 계정으로 다른 탭/브라우저/기기에서 새로 로그인하면 기존 세션을 자동 로그아웃.

### 구현

| 항목 | 상태 |
|------|------|
| `lib/session.ts` — sessionStorage 탭 ID + claim/watch/release | ✅ |
| `AppShell` 통합: user 변경 시 claim → watch, 명시적 로그아웃 시 release | ✅ |
| 강제 로그아웃 배너 (홈 메인 영역 상단) | ✅ |
| `firestore.rules`에 `sessions/{uid}` 본인 R/W 규칙 추가 | ✅ |

### 정책

- 범위: **탭 단위**. 같은 브라우저의 다른 탭도 기존 탭을 밀어냄 (sessionStorage 격리)
- F5 시 자기 자신을 밀어내지 않음 (sessionStorage가 새로고침에 보존)
- 저장 안 된 변경 보호: 하지 않음. 블록 단위 자동저장이 대부분 이미 반영하므로 마지막 입력 정도만 손실
- 강제 로그아웃 UX: A안 — 즉시 로그인 화면 + 상단 배너 안내
- 명시적 로그아웃 시 `sessions/{uid}` 삭제 (정합성)
- `claimSession` 3회 재시도 후 실패하면 강제 로그아웃 (미등록 상태 작업 차단)
- `sessions/{uid}` 문서 부재는 무시 (외부 삭제로 멀쩡한 세션 끊지 않음)

### 제외

- 문서 단위 편집 잠금: 단일 세션이 보장되므로 동일 사용자 충돌 자체 발생 안 함
- 다른 탭에서 실시간 반영: 별개 기능


## Phase 36: 도메인 등록 ✅

- **메인 도메인**: `mathory.app`
- **보조 도메인**: `mathory.net` → `mathory.app` 301 리다이렉트
- **등록처**: Vercel Domains
- **결제**: 연간 자동 연장
- **DNS/SSL**: Vercel 자동 관리 (Let's Encrypt)
- **Firebase Auth 승인 도메인(Authorized domains)**: `mathory.app`, `mathory.net` 모두 등록 — Google OAuth 팝업이 양쪽 도메인 모두에서 정상 작동

### 메모

- 도메인 만료 알림은 Vercel 계정 이메일로 전송
- Vercel 결제 수단(카드) 만료 시 자동 갱신 실패 가능 — 카드 갱신 시 결제 정보 업데이트 필요
- 향후 이메일/서브도메인 추가 시 Vercel DNS 패널에서 처리


## Phase 37: AI 토론 기능 ✅

기존 댓글 패널을 '토론' 패널로 확장. 사용자와 복수 AI 모델(민/섬/식/쳇/락)이 수학 풀이에 대해 비판적으로 토론. 계획서: `docs/phasedocs/Phase37 AI토론기능 신설.md` (v3 확정).

### 구현 (Phase 37-A ~ 37-I)

| 항목 | 상태 |
|------|------|
| 데이터 모델: TabComment에 authorType/modelId/discussionSessionId/invokedModelIds/aiUsage 추가, AIModelConfig/DiscussionSession/UserProfile.nickname 신규 | ✅ |
| `lib/ai-models.ts` — Firestore `ai_models` 컬렉션 로더 + 메모리 캐시 + 예약 닉네임 헬퍼 | ✅ |
| `lib/ai-provider.ts` — OpenAICompatProvider 추가 (OpenAI/DeepSeek/xAI 공통), getProviderForModel 디스패치. GPT-5 계열 `max_completion_tokens`, DeepSeek reasoning_content 폴백 | ✅ |
| `app/api/discuss/route.ts` — 단일 메시지를 지정 AI에 전달, 토큰 사용량 + 비용 반환. 60초 타임아웃, 시스템 프롬프트에 LaTeX 강제 + 닉네임 호명 규칙 | ✅ |
| `lib/comments.ts` 확장 — AI 메시지 저장·조회. firestore.rules에 AI 댓글 create/update/delete 분기 (오너만 생성, resolved 토글만 update, 삭제 불가) | ✅ |
| `lib/discussion-sessions.ts` (신규) — 세션 CRUD. `ensurePublicSession` 시그니처만 정의 (Phase 38에서 구현) | ✅ |
| `lib/users.ts` 닉네임 — `updateNickname()` + AI 예약어 검증, 기본값 'KDS' 백필 | ✅ |
| `app/settings/page.tsx` (신규) — 개인설정 페이지 (닉네임 편집) | ✅ |
| `components/layout/Sidebar.tsx` — 푸터 아바타·이름 클릭 → /settings 진입 | ✅ |
| `components/comment/CommentPanel.tsx` 대폭 재작성 (416줄 → 870줄) — 세션 탭 바, 메시지 단위 AI 칩, 병렬 호출, 도착순 렌더, "생각 중…" 인디케이터, 재시도/닫기, 세션 누적 비용 표시 | ✅ |

### AI 모델 라인업

| # | 표시명 | 닉네임 | provider | 입력/출력 ($/1M) |
|---|--------|--------|----------|------------------|
| 1 | Gemini 3.1 Pro | 민 | google | $2 / $12 |
| 2 | Gemini 3.5 Flash | 섬 | google | ~$1.5 / $9 |
| 3 | DeepSeek V4 Pro | 식 | deepseek | $0.435 / $0.87 |
| 4 | GPT-5.4 | 쳇 | openai | $2.50 / $15 |
| 5 | Grok 4.3 | 락 | xai | $1.25 / $2.50 |

모델 등록은 Firestore `ai_models` 컬렉션에 콘솔로 직접 관리. 관리자 UI는 추후.

### 핵심 설계 결정

- **세션**: 별도 컬렉션 `problems/{pid}/discussion_sessions`. `public`(자동 생성, Phase 38) + `normal`(사용자 생성). 기존 댓글은 "💬 댓글" 가상 세션으로 노출 (백워드 호환).
- **AI 호출**: 메시지 단위 칩 토글. 한 메시지에 0~5명 자유 선택. 0명이면 메모로만 저장.
- **닉네임**: 한 음절 (민/섬/식/쳇/락). 사람이 동일 닉네임 사용 불가 (`ai_models.nickname` 전체가 예약어).
- **컨텍스트**: 활성 탭에 따라 차등 — `question`만 / `question`+`solution` / `question`+`extra_N`. 최근 5메시지 히스토리.
- **보안**: AI 댓글은 클라이언트가 `authorUid: 'ai:{modelId}'`로 직접 쓰기. 위조 가능성 있으나 1인 사용 환경에선 무해. 오픈소스 공개 전 Admin SDK 전환 TODO ([[project_phase29_auth_followup]] 트랙과 합류).
- **공유/공개 시스템**: Phase 38로 분리. Phase 37은 비공개 문제 단독으로 동작 가능하도록 설계, Phase 38 합류 시 공개토론 자동 생성 + AI 활성 게이트 통합.

### 메모

- Gemini 3.1 Pro / DeepSeek V4 Pro는 reasoning 모델이라 `maxTokens` 4096 권장 (1024는 추론에 다 소진됨)
- Grok 4.3은 LaTeX 사용을 자주 빠뜨려 시스템 프롬프트 상단에 LaTeX 강제 규칙(3중 강조 + 예시) 배치
- DeepSeek은 `reasoning_content` 필드 폴백 — content가 비어있을 때 reasoning이라도 표시
- GPT-5 계열은 `max_tokens` 미지원, `max_completion_tokens` 필수
- 응답 1턴 5모델 비용 추정 ≈ $0.066. 컨텍스트 한도(1M 토큰)는 우리 사용량(0.3%)에 비해 실질적 제약 아님

## Phase 39: 이모지(Twemoji) 입력 & 렌더 ✅

에디터에서 이모지를 입력하고, 미리보기·PDF에서 **OS 무관 컬러 SVG(Twemoji)** 로 렌더. 저장은 순수 유니코드만(데이터 불변), 렌더 시점에만 변환 — `preprocessLocale`/`\tag`와 동일 철학.

| 항목 | 구현 | 비고 |
|------|------|------|
| 저장 | 순수 유니코드만 Firestore raw_text에 (이미지 태그 X) | ✅ |
| 렌더 | `@yuna0x0/rehype-twemoji` v0.1.4 (rehypeKatex 뒤 배치) | ✅ |
| 에셋 | jsDelivr CDN `jdecked/twemoji@17.0.2`(최신 안정판), 번들 0 | ✅ |
| 입력 UI | 커스텀 `EmojiPickerDropdown` (UnifiedToolbar 내장, SpecialChar 패턴) | ✅ |
| 데이터 | `emojibase-data` (ko) 동적 import — 한글 검색 | ✅ |
| 출처 표기 | 설정 페이지 "정보/라이선스" CC BY 4.0 | ✅ |

### 신규/수정 파일

- `lib/twemoji-url.ts` (신규) — 버전·URL·ignore 단일 소스. 렌더 플러그인(`source`)과 피커 미리보기(`twemojiSvgUrl`)가 동일 CDN 파일 가리킴
- `lib/emoji-data.ts` (신규) — emojibase ko 로드 + 한글 검색 + 최근(localStorage)
- `UnifiedToolbar.tsx` — `EmojiIcon` + `EmojiPickerDropdown`(검색/카테고리/최근/그리드) 내장, 툴바 등록
- `EditorPreview.tsx` / `PrintableContent.tsx` — `rehypeTwemoji` 추가(동일 옵션)
- `lib/pdfPrint.tsx` — `window.print()` 직전 `img.twemoji` decode 대기(최대 2초) → PDF 빈칸 방지
- `app/globals.css` — `img.twemoji` 인라인 정렬 규칙
- `app/settings/page.tsx` — CC BY 4.0 출처 표기

### 검증 메모 (구현 전 코드 대조)

- **URL 일치**: rehype-twemoji는 `${source}/assets/svg/{cp}.svg` 생성 → `twemojiSvgUrl`과 바이트 일치 확인
- **코드포인트 규칙**: 라이브러리 = `ZWJ 없으면 FE0F 제거 후 변환`, `toTwemojiCodepoint`와 동일
- **emojibase ko/data.json**: `label`(한글)·`tags`(한글)·`group`(0~9, 2=Component 제외)·`emoji`. messages.groups는 `order`→`message`
- **충돌 방지**: `TWEMOJI_IGNORE`로 ©®™‼⁉ 등 타이포·수학 기호 텍스트 유지. 대부분 수식 기호는 VS16 없어 애초에 변환 대상 아님
- **성능**: emojibase 동적 import(첫 오픈 시 1회) + `loading="lazy"` + 활성 그룹/검색 결과만 마운트 → 초기 번들 영향 0

### 39-B: 폴더 아이콘 이모지

사이드바 폴더 아이콘을 이모지로 교체 가능. `Folder.icon?`(순수 유니코드) 저장, 표시할 때만 Twemoji SVG로 변환.

- `EmojiPickerPanel`(신규, `components/editor/EmojiPickerPanel.tsx`) — Phase 39 피커를 트리거/위치 무관 재사용 패널로 추출. `onSelect(emoji)` 콜백. 입력 툴바(`EmojiPickerDropdown`)와 폴더 아이콘 피커가 공유
- `types/problem.ts` `Folder.icon?` 추가, `lib/firestore.ts` `updateFolder`에 `icon` 필드
- `Sidebar.tsx` — 폴더 `⋯` 메뉴에 "아이콘 변경"/"기본 아이콘으로"(아이콘 있을 때만), 선택 시 `FolderIconPicker` 팝오버. 아이콘 있으면 `IconFolder` 대신 Twemoji SVG 렌더
- `AppShell.tsx` `handleSetFolderIcon` → `updateFolder({icon})`. 아이콘 제거는 `''` 저장
- 진입점 UX: ⋯ 메뉴 + 팝오버 (직접 클릭 아님)

## Phase 40: 하위 폴더 (1단계) ✅

폴더 중첩 구조. 결정: **1단계만**(트리 렌더+생성+⋯메뉴 이동+탐색), 드래그 중첩은 보류 / 삭제 시 **하위 함께 삭제** / 개수는 **직접 포함만**.

| 항목 | 구현 |
|------|------|
| 데이터 | `Folder.parent_id?`(null/''=루트). 기존 폴더 마이그레이션 불필요 |
| 트리 | `lib/folder-tree.ts` — buildFolderTree/flattenVisible/getDescendantIds/getChildren/getFolderPath |
| 생성 | ⋯메뉴 "하위 폴더 만들기" → `createFolder({parent_id})` |
| 이동 | ⋯메뉴 "폴더 이동" → `FolderMovePicker`(자손 제외+루트) → `updateFolder({parent_id})`, 순환 차단 |
| 삭제 | `deleteFolder` 하위 트리까지 cascade, 문항은 미분류로 |
| 탐색 | FolderView에 하위 폴더 카드 + 브레드크럼(상위 경로 클릭 이동) |
| 펼침 | 폴더별 펼침/접힘(localStorage 영속) |
| 드래그 | 폴더 재정렬은 **같은 부모(형제) 안에서만** 허용. 재부모화는 ⋯메뉴로 |

### 보류 (별도 단계)

- **드래그로 폴더 중첩/재부모화** — dnd-kit 트리 DnD(투영 깊이·드롭 인디케이터·충돌 계산)는 평면 DnD 전면 재작성 필요, 위험·시간 커서 분리
- 하위 포함 개수 합산, 중첩 깊이 제한

### 핵심 변경

- `types/problem.ts` `Folder.parent_id` / `lib/firestore.ts` createFolder·updateFolder parent_id, deleteFolder cascade
- `lib/folder-tree.ts` (신규) — 트리 유틸 (순수 함수, 단위 검증 완료)
- `Sidebar.tsx` — 트리 렌더(들여쓰기+chevron), `FolderMovePicker`, 형제 한정 재정렬, order를 폴더 자체 값으로 영속화
- `AppShell.tsx` — handleNewSubfolder/handleMoveFolder(순환 가드)/삭제 메시지에 하위 개수
- `FolderView.tsx` — 하위 폴더 카드 + 브레드크럼

### 40-B: FolderView 문항 → 하위 폴더 드래그앤드롭

FolderView에서 문항 카드를 끌어 하위 폴더 카드에 떨어뜨려 이동. 결정: **시나리오 A**(FolderView 자체 완결, 사이드바로의 크로스 영역 드래그는 보류).

- FolderView 내부에 **독립 DndContext**(사이드바 DndContext와 무관, 공존 OK)
- 렌더프롭 `Draggable`/`Droppable` 래퍼 — 문항 카드 draggable, 하위 폴더 카드 droppable
- 드롭 시 기존 `handleMoveProblemToFolder(problem, folder)` 재사용
- **하위 폴더 영역 sticky 고정**: 헤더+하위폴더를 한 sticky 컨테이너로 묶어 스크롤해도 제자리 → 목록 스크롤 중에도 드롭 가능 (maxHeight 120 + overflow)
- 클릭(열기)·⋮메뉴 충돌 방지: PointerSensor `distance:8` + ⋮버튼 `onPointerDown` stopPropagation
- 드래그 활성 조건(`dndEnabled`): 일반 폴더 + 하위 폴더 존재 시에만(없으면 `useDraggable disabled`)
- DragOverlay로 드래그 중 문항 제목 라벨 표시

보류(B): FolderView → 사이드바 폴더 트리 드래그(= DndContext를 AppShell로 hoist하는 리팩터)

### 40-C: 상위 폴더 경로 표시 (ProblemView hover / EditorView 인터랙티브 이동)

- **ProblemView**: 폴더 라벨 hover 시 라벨 컬럼이 늘어나며 상위 폴더 전체 경로 노출(제목이 오른쪽으로 밀림). 각 폴더 클릭 → 해당 폴더로 이동(`onNavigateFolder` 재사용, 읽기 전용). 상위 폴더가 있을 때만 펼침
- **EditorView**: 평면 폴더 select → `FolderPathBar`(신규) 경로 바로 교체
  - 선두 홈 칩: 드롭다운 = 미분류 + 최상위 폴더 (최상위 이동/미분류 처리)
  - 중간 세그먼트(비-마지막): 형제 폴더 드롭다운 (2-1)
  - 마지막 세그먼트: 자식 폴더 드롭다운 (2-2), 없으면 "하위 폴더 없음"
  - 선택 시 `setEditFolderId` → editFolderId는 dirty 추적 포함이라 기존 저장 흐름으로 이동 반영
- `components/editor/FolderPathBar.tsx` (신규) — getFolderPath/getChildren 재사용, 칩별 드롭다운 + 외부클릭 닫기

---

## Phase 41: AI 토론자 SymPy 검산 도구 ✅ (Step A~E)

토론창에서 민(Gemini)·쳇(GPT)에게 코드 실행으로 수치·기호 검산 요청. 상세: `docs/phasedocs/Phase41 SymPy 검산도구.md`

| Step | 구현 |
|------|------|
| A | `GeminiProvider` code execution(`tools:[{codeExecution:{}}]`) + parts 순회 직렬화. `appendCodeExecDetails`로 `<details>` 부록 생성 |
| B | `OpenAIResponsesProvider` 신규 — Responses API + `code_interpreter`. output 순회 직렬화 |
| C | `getProviderForModel`: openai→Responses, deepseek/xai→OpenAICompat 유지 |
| D | discuss 시스템 프롬프트 #12(검산 도구 지침) — google·openai 모델에만 부착 |
| E | 비용: Gemini 토큰 산입, OpenAI 컨테이너 시간은 별도(미추적) |

- 검산 결과는 본문 결론 + 접힌 `<details>🔍 검산 코드` 부록. EditorPreview의 rehype-raw가 렌더
- 제외: 식(DeepSeek)·락(Grok)·섬(Gemini Flash)은 도구 미적용
- **남은 것**: Step F 라이브 검증(dev 서버 실 API 호출)

---

## Phase 42: AI 토론자 그래프 도구 ✅ (Step A~I)

토론창에서 민(Gemini)·쳇(GPT)에게 함수·좌표 그래프를 그리게 하고, 대화창의 GeoGebra applet으로 인터랙티브 표시. AI가 그린 그래프를 💾 클릭으로 에디터 블록(GGB/SVG/PNG)으로 저장. 상세: `docs/phasedocs/Phase42 AI 그래프 도구.md`

**핵심 설계 (C 방식: 클라이언트 렌더)**: AI는 ```mathory-graph 펜스(GGB 명령 JSON 명세)만 emit → 코드 실행 없음, 토큰 비용 거의 0 → 브라우저의 GgbGraphView가 GeoGebra applet에 `evalCommand`로 주입해 벡터 렌더.

| Step | 구현 |
|------|------|
| A | route.ts: `isGraphModel`(민·쳇) + `GRAPH_TRIGGER_RE`(그리기 동사 결합형) + `USER_MESSAGE_GRAPH_SUFFIX` + 시스템 프롬프트 #13 + #12 carve-out |
| B | route.ts: `sanitizeGraphFences` — 줄 단위 파서(미종결 펜스 제거·JSON 1차 검증·명령 30개 상한). graphEnabled 모델만 적용 |
| C | `GgbGraphView.tsx` 신규 — 빈 applet + evalCommand 주입, 개별 명령 실패 수집(부분 렌더+경고 배지), placeholder/전체화면/외부클릭 비활성화 (GgbViewer 패턴) |
| D | EditorPreview: `protectFences`(전처리에서 코드펜스 보호) + `pre` 렌더러 가로채기 + `graphAutoActivate`(첫 펜스 내용 비교 방식) |
| E | CommentPanel: `stripForHistory`(그래프 펜스·검산 details 역류 차단) + `freshAiCommentId`(방금 도착한 응답만 자동 활성화) + prop 체인 |
| F | (운영) 민·쳇 maxTokens 8192 — 완료 |
| H | GgbGraphView 💾 저장 버튼 + GGB/SVG/PNG 드롭다운 — `getBase64`/`exportSVG`(가드)/`getPNGBase64(2,true,72)` → File 생성 |
| I | EditorView `handleInsertGraphBlock` — 업로드 후 현재 탭 블록 맨 끝 append (GGB는 저장 시점 시야를 초기뷰로 이관) |

- 자동 활성화 정책: **방금 도착한 응답의 첫 그래프만** (패널 재오픈·페이지 재진입 시엔 placeholder — GGB CDN 자동 로딩 방지)
- 💾 버튼은 편집 화면(EditorView 경유)에서만 노출 — ProblemView·공유 페이지는 콜백 미전달로 숨김
- 좌표 캡처 로직을 `lib/ggb-utils.ts`로 추출, GgbViewer 초기뷰 저장과 공유
- **남은 것**: 검증 시나리오 16개 실사용 확인 (dev 서버 실 API 호출)
