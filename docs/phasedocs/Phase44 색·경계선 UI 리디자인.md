# Phase 44 — 색·경계선 UI 리디자인 (컨텐츠 구분 체계)

> 커밋: `386810f` · 10개 파일 변경 (+427 / −193)
> 설계: Claude.ai · 구현: Claude Code CLI · 검수: 덕수 (시각 확인 다회차)

---

## 0. 목표

기능 영역(좌측 사이드바·우측 토론 패널·상단 제목/탭바)을 **밝은 아이보리**로 물러나게 하고,
가운데 본질 영역을 **따뜻한 클레이**로 띄워 올린 뒤, 두 영역을 **U자(반병 위) 컨텐츠 구분선**으로
가른다. 편집 블록의 흰색을 버리고 컨텐츠와 같은 클레이로 통일하여 "경계선 만으로 구분되는"
종이 위 블록으로 만든다. 편집(EditorView)·보기(ProblemView)·목록(FolderView) 세 화면을
동일 체계로 통일하여 시각적 안정감을 준다.

핵심 불일치(구버전): 사이드바(#F0EDE8)가 컨텐츠(#FAF9F7)보다 진했고, 편집 블록이 흰색(#FEFDFB),
활성 강조가 무거운 그림자(0.25), 단일 컨텐츠 구분선 부재.

---

## 1. 색 토큰 체계 (`app/globals.css`)

기존 Clay Theme 팔레트 위에 **역할 기반 토큰**을 신설. 기존 `--bg-*`는 유지하되 영역 배경이
역할 토큰을 참조하도록 전환. 다크 모드 대비 역할 기반 명명 유지(현재는 라이트만).

```css
/* 영역 배경 */
--bg-functional: #FEFDFB;   /* 아이보리: 기능 영역(사이드바·토론·제목/탭바) — 밝게 후퇴 */
--bg-content:    #F4EFE7;   /* 클레이: 가운데 컨텐츠 영역 — 한 단계 진하게(따뜻·강조) */
/* 블록 */
--block-bg:        var(--bg-content);  /* 비활성 블록 = 컨텐츠와 동일 클레이 */
--block-bg-active: #EDE6DA;            /* 활성: 클레이 한 단계 더 진하게 */
--block-shadow-active: 0 4px 16px rgba(0,0,0,0.14); /* 활성 떠오름 그림자 */
/* 경계선 위계 (주목도: content > block > subtle) */
--border-content:        #D2C8B8;   /* U자 컨텐츠 구분선 (가장 뚜렷) */
--border-content-active: #B89B78;   /* 구분선/리사이즈 hover 활성, 강조계 공통 웜 브라운 */
--border-block:          var(--border-primary); /* #E0DCD6 — 블록 경계 (중간) */
--border-subtle:         var(--border-light);    /* #E8E4DF — chrome 최소 사용 (가장 약) */
```

> 주목도 사다리: `--border-content`(#D2C8B8) > `--border-block`(#E0DCD6) > `--border-subtle`(#E8E4DF).

**참고**: `--bg-functional`은 처음 #FBFAF8로 시작했으나 "기능 영역을 더 밝게" 요청으로 #FEFDFB로 상향.
`--block-shadow-active`는 0.06(거의 안 보임) → 0.14로 조정(키+그림자 병행 강조).

---

## 2. 강조색 통일 (웜 브라운 #B89B78 계열)

차가운 기본색이 따뜻한 클레이 위에서 튀던 문제를 해결. 모든 강조를 한 색 가족에서 톤만 다르게.

| 위치 | 값 | 파일 |
|------|-----|------|
| 활성 블록 키 | `--block-bg-active` #EDE6DA + 그림자 | `EditorView.tsx` SortableEditorBlock |
| CodeMirror 활성 행 | `rgba(184,155,120,0.13)` | `MarkdownEditor.tsx` `&.cm-focused .cm-activeLine` |
| 활성 행번호 거터 | `rgba(184,155,120,0.20)` + `--text-secondary` | `MarkdownEditor.tsx` `&.cm-focused .cm-activeLineGutter` |
| 미리보기 수식 강조 | bg `rgba(184,155,120,0.18)` / 링 `0.42` | `EditorView.tsx` `.math-highlight-active` |
| 거터 배경 | `#f8f9fa`(차가움) → `transparent` | `MarkdownEditor.tsx` `.cm-gutters` |

- CodeMirror 기본 흰 배경 차단: `.cm-editor`/`&`에 `background: transparent` 명시.
- 미리보기 강조는 편집창 활성 행보다 **약하게**(0.18 vs 0.13은 배경이 더 밝아 같은 강도가 더 도드라지므로).

---

## 3. U자 컨텐츠 프레임

가운데 컨텐츠를 클레이 프레임으로 감싼다. **상·좌·우 0.5px `--border-content`(레티나 1물리픽셀
헤어라인) + 상단 모서리 14px 라운드 + 하단 열림(open bottom)** — 컨텐츠가 화면 하단으로
자연스럽게 흘러내리는 인상.

### 3.1 EditorView (편집)
- 최외곽 컨테이너 → `--bg-functional`(아이보리). 클레이는 프레임 안에만.
- Row3(편집+프리뷰)를 **외부 래퍼(아이보리, 패널 자리 확보) + 내부 `.content-frame`(클레이 U-프레임)**로 분리.
- 제목바(Row1)·탭바(Row2) → `--bg-functional`, 탭바 하단선 제거(U 상단변이 경계 담당).

### 3.2 ProblemView (보기)
- 컨테이너를 **flex column**으로 재구성: `[제목바(아이보리)] [컨텐츠 행]`.
- 컨텐츠 행 = `[외부 래퍼(paddingRight로 패널 자리) → 내부 U-프레임(클레이)] [메타 컬럼] [패널]`.
- 제목행 `[폴더경로 | 제목]`을 U자 밖 **전체폭 아이보리 chrome**으로 추출(§5 참고).

### 3.3 FolderView (목록)
- 전체 스크롤 영역을 클레이 U-프레임으로. 폴더명 제목행 + 하위폴더 chips를 U자 밖
  아이보리 제목바로 추출. 카드 `#ffffff` → `--bg-functional`(클레이 위 떠오르는 아이보리 타일).
- 그리드 상단 `paddingTop: 28`(경계선↔카드 여백, 스크롤 시 사라짐).

### 3.4 사이드바 경계 일치 (결정 ⑤)
- 사이드바 `borderRight` **제거** → 컨텐츠 영역에선 U 좌측변(`--border-content`)이 단일 경계선.
- 제목/탭바 영역은 사이드바와 같은 아이보리라 경계선 없이 자연 연결.
- 좌측 사이드바 내부 가로 구분선 3개 제거(하단 로그인 영역 구분선만 유지).

### 3.5 가로 경계선 Y 통일 (98px)
세 화면 모두 U 상단 경계선이 화면 상단에서 **98px**(EditorView 제목 57 + 탭 41 기준)에 위치하도록 통일:
- EditorView: 제목바 57 + 탭바 41 = 98.
- ProblemView: 제목바 `minHeight: 98`(제목을 위에서 22px 내리고 아래 빈 공간은 추후 메타데이터).
- FolderView: 제목바 `minHeight: 98`(하위폴더 없어도 동일 — 아이보리 빈 여백).

---

## 4. 리사이즈 시스템

### 4.1 토론 패널 가로 폭 (EditorView·ProblemView)
- 폭은 `panelWidth` state(기본 560px ≈ 35em@16px), 세션 내 useState만(Firestore 저장 안 함).
- **핸들 = U자 컨텐츠 우측 경계선** 위(보이는 선을 잡고 끄는 직관). 8~10px strip, hover 시
  `--border-content-active` 라인, `col-resize` 커서, pointer capture로 드래그 고정.
- 드래그 계산: `panelWidth = window.innerWidth - clientX - gap` (EditorView gap 12, ProblemView gap 24).
- `CommentPanel`에 `width` prop 추가(미전달 시 기본 35em — 답글 등 호환).
- 외부 래퍼/내부 프레임 분리로 패널과 컨텐츠가 **절대 겹치지 않음**(경계선이 패널 뒤로 사라지지 않음).
  패널 열림 시 컨텐츠는 `unsafe flex-end`로 우측 정렬되어 우측 끝이 경계선 따라 함께 왼쪽 이동.

### 4.2 댓글 입력창 세로 높이 (CommentPanel 메인 작성 영역)
- 높이는 `inputHeight` state(기본 120). 핸들은 **메인 작성 영역에만**(답글 제외) → CommentPanel에 둠.
- **입력창 상단 경계선 = 세로 리사이즈 핸들**: 전체 패널 폭(패널 헤더 경계선과 정렬), 평소 1px
  `--border-light`, hover 시 2px `--border-content-active`, `row-resize`. 위로 끌면 입력창이 커짐.
- 드래그 계산: `inputHeight = startH + (startY - clientY)`, clamp [80, innerHeight*0.6].
- `CommentEditor`에 `inputHeight` prop 전달(답글은 기본 120 고정).

### 4.3 댓글 입력창 정돈
- 둥근 테두리·흰 배경 제거(불필요 여백 제거 → 입력 영역 확대). 상단 경계선만으로 구분.
- 입력 영역 배경 = 세션 행(2행)과 동일(`--bg-primary`). 입력창 자체는 투명이라 컨테이너 배경이 비침.

---

## 5. ProblemView 제목행 추출 (가장 큰 리팩터)

제목행 `[폴더경로 | 제목]`이 본문 table 레이아웃(7em/35em 컬럼 정렬) + 폴더경로 hover 슬라이드 +
sticky 로직과 IIFE 내부에 얽혀 있어 추출이 까다로웠음. 안전하게 처리한 방법:

1. **IIFE 계산값 호이스팅**: `fid·folderLabel·folderPath·hasAncestors·expanded·labelColStyle·mainColStyle·LABEL_GAP`를
   컴포넌트 스코프로 올림(조기 return 이후, problem 보장). IIFE는 tabs.map만 반환.
2. **컨테이너 row→column 재구성**: `[제목바][컨텐츠 행]`. 제목바는 전체폭 아이보리, 본문 컬럼 폭을
   재사용해 정렬 유지.
3. **폴더경로 슬라이드 보존**: `labelBoxRef`/`folderPathRef` 측정은 DOM 위치 무관이라 그대로 동작.
   sticky→고정 바로 바뀌며 오히려 단순화.
4. h1의 인-프레임 밑줄(`borderBottom`/`alignSelf stretch`/`paddingBottom`) 제거 — U 경계선이 분리 담당.

---

## 6. 구현 중 발견·해결한 이슈

| 증상 | 원인 | 해결 |
|------|------|------|
| "Rendered more hooks than during the previous render" | 리사이즈 `useState`/`useRef`를 조기 return(`if (loading)`/`if (!problem)`) **아래**에 선언 | 훅 선언을 컴포넌트 상단으로 이동 |
| `/`만 404 (`/problems`는 정상) | HMR 누적으로 `.next` 루트 청크 캐시 손상 | `.next` 삭제 후 dev 재시작 |
| EditorView 리사이즈 "동작 안 함" | 핸들이 (경계선 없는) 패널 가장자리에 위치 → 사용자가 U 경계선 위에서 잡으니 안 잡힘 | 핸들을 U자 컨텐츠 경계선 위로 이동 |
| 입력창 세로 리사이즈 미동작(두께만 변함) | LatexInputEditor의 CodeMirror가 `useEffect([])`로 1회만 생성 → `minHeight` 변경 무시 | **CodeMirror Compartment**로 높이 테마를 반응형 재구성(`useEffect([minHeight])`) |
| 입력창 경계선 폭 불일치 | 핸들이 CommentEditor 내부(컨테이너 패딩에 inset) | 핸들을 CommentPanel 작성 컨테이너로 이동 → 전체폭 + 답글엔 미적용 |
| ProblemView 본문이 우측 경계선에 붙음 | 패널 열림 시 table 우측 패딩 제거(`0 0 0 32px`) | 항상 `0 32px` 유지 |

---

## 7. 핵심 파일 변경

| 파일 | 변경 |
|------|------|
| `app/globals.css` | 역할 토큰 신설(§1), 활성 그림자 |
| `components/editor/EditorView.tsx` | 컨테이너/제목·탭바 배경, 블록 클레이·활성 키, U-프레임 래퍼, 미리보기 강조색, 패널 폭 리사이즈(핸들=경계선) |
| `components/editor/MarkdownEditor.tsx` | 거터 투명, 활성 행/거터 웸 브라운, cm-editor 투명 |
| `components/problem/ProblemView.tsx` | 컨테이너 column 재구성, 제목행 아이보리 추출, U-프레임 inner/outer 분리, 패널 폭 리사이즈, 우측 여백 |
| `components/problem/FolderView.tsx` | 제목행+chips 아이보리 추출, U-프레임, 카드 아이보리, 그리드 상단 여백, 제목바 98px |
| `components/comment/CommentPanel.tsx` | 패널 배경 아이보리·borderLeft 제거, `width` prop, 작성 영역 입력 높이 리사이즈(상단 경계선=핸들) |
| `components/comment/CommentEditor.tsx` | 입력창 테두리·흰 배경 제거, `inputHeight` prop |
| `components/comment/LatexInputEditor.tsx` | `minHeight` Compartment 반응형 |
| `components/layout/Sidebar.tsx` | 배경 아이보리, borderRight 제거, 가로 구분선 제거(로그인 제외) |
| `docs/roadmap.md` | Phase 44 항목 추가 |

---

## 8. 주의사항 · 남은 것

- **인쇄/PDF 분리 확인됨**: `components/print/PrintableContent.tsx`·`PrintStyles.css`는 자체 흰 배경(`#fff !important`)
  사용 → 화면 클레이 변경이 인쇄에 영향 없음. 화면용 흰 박스 제거는 인쇄와 무관.
- **라이트 모드만**: 토큰은 역할 기반 명명이라 다크 대비 추후 확장 가능.
- **ProblemView 제목바 아래 빈 공간**: 추후 문제 메타데이터(연도·유형·난이도·출처 등) 배치 예정.
- `ProblemView`·`EditorView` 이중 적용: 두 모드 모두 동일 토큰·체계 — 한쪽만 바꾸면 불일치.
- 레거시 문서(`docs/architecture.md`·`editor-spec.md`·`ui-design-reference.md §4`)는 이전 팔레트 기준이라
  신뢰 금지. 단일 진실원은 `globals.css` + 인라인 스타일.
