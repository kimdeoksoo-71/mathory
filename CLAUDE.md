# Mathory — Project Context for Claude Code

## 프로젝트 개요

Mathory는 한국 수학 문제 편집/관리 웹 플랫폼. 아래한글(HWP)을 대체하는 것이 목표.
1인 개발 (덕수). 개인 사용 후 추후 오픈소스 예정.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router), TypeScript
- **DB/Auth**: Firebase Firestore, Firebase Auth (Google), Firebase Storage
- **에디터**: CodeMirror 6
- **렌더링**: ReactMarkdown + KaTeX (rehype-katex, remark-math, remark-gfm, rehype-raw)
- **드래그앤드롭**: dnd-kit
- **배포**: Vercel (main 브랜치 push 시 자동 배포)
- **도메인**: `mathory.app` (메인), `mathory.net` → `mathory.app` 리다이렉트. Vercel 등록, 연간 자동 연장
- **GitHub**: kimdeoksoo-71/mathory (public)

## 핵심 파일 구조

```
types/problem.ts          — Problem, Block, TabMeta, ProblemWithBlocks 타입
lib/firestore.ts          — Firestore CRUD (동적 탭 지원)
lib/locale.ts             — 로케일 변환 (a→가, i→ㄱ, \tag, \ref)
lib/preprocess.ts         — 통합 전처리 (preventSetextHeadings → preprocessLocale → preprocessMath)
components/editor/
  EditorView.tsx           — 메인 편집 화면 (동적 탭, 3점 메뉴 PDF, 저장)
  EditorPreview.tsx        — 미리보기 (자체 인라인 전처리, tag/ref, ImageResizeOverlay)
  MarkdownEditor.tsx       — CodeMirror 에디터 래퍼
  MathToolbar.tsx          — 수식 입력 툴바
  FindReplacePanel.tsx     — 찾기/바꾸기
components/print/
  PrintableContent.tsx     — A3 2단 인쇄용 렌더러
  PrintStyles.css          — 인쇄 CSS
  PdfDownloadButton.tsx    — 레거시 PDF 버튼
components/layout/
  AppShell.tsx             — 메인 앱 레이아웃
  Sidebar.tsx              — 사이드바
docs/roadmap.md            — 개발 로드맵 (Phase 1~21)
```

## DB 구조

```
Firestore:
├── problems/{id}
│   ├── title, year, exam_type, category, difficulty, tags, answer, source, folder_id
│   ├── tabs: [{id:"question",label:"문제"}, {id:"solution",label:"풀이"}, ...]
│   ├── question_blocks/{blockId}: {order, type, raw_text, title}
│   ├── solution_blocks/{blockId}
│   └── extra_N_blocks/{blockId}    (동적 탭)
├── folders/{id}: {name, user_id, order}
└── users/{uid}/math_snippets/{id}: {name, shortcutIndex, content}
```

## 전처리 파이프라인

EditorPreview (미리보기)와 PrintableContent (PDF)에서 동일한 변환:

```
preventSetextHeadings → insertMarkerLineBreaks → preprocessLocale → preprocessMath
```

- `\tag{n}`: 수식 내 → `\tag*{(n)}` (**수학 모드**라 `.mopen/.mord/.mclose`로 렌더 — `.text`가 아니다), 텍스트 행 끝 → `<span class="tag-marker">(n)</span>`
- `\ref{n}`: 수식 내 → `\text{(n)}`, 텍스트 → `(n)` 직접 치환
- `①~⑮`: 문자 그대로 보존 (행 시작분만 `<span class="marker-circled">`로 감싸 내어쓰기). 글리프는 `@font-face 'MathoryCircled'` + `unicode-range: U+2460-2473`이 AppleGothic으로 대체 — **마크업 없음**
- `(a)~(e)` → `(가)~(마)`, `(i)~(v)` → `ㄱ.~ㅁ.` (각 5개 제한, 중복 방지)
- `Fig.N` → `[그림N]`, `Table N` → `[표N]`

## 작업 규칙

1. **파일 수정 전 현재 파일을 반드시 읽을 것** — 이전 대화의 기억으로 추정하지 말 것
2. **완전한 파일 교체 선호** — diff/patch보다 전체 파일 교체가 안전
3. **git push는 덕수가 직접 수행** — Claude Code는 커밋까지만
4. **Vercel 배포 후 Cmd+Shift+R로 하드 리프레시** — CDN 캐시 제거
5. **`.next` 캐시 삭제**: 빌드 문제 시 `rm -rf .next` 후 재빌드
6. **roadmap.md 업데이트**: 각 Phase 완료 시

## 핵심 패턴 & 주의사항

- **편집창 CodeMirror 스크롤**: `.cm-scroller`가 `overflow:visible`이라 내부 스크롤이 없음 → CM의 `EditorView.scrollIntoView` 사용 금지. 모든 세로 스크롤은 외곽 `.scaled-editor`가 담당하며 `lib/editorScroll.ts`를 거칠 것
- **스크롤 패널에 `paddingBottom:100vh` 금지**: `box-sizing:border-box`에서 요소 높이는 패딩 합보다 작아질 수 없어 패널이 부모보다 커지고, `overflow:hidden` 부모에 복구 불가한 스크롤 틈이 생긴다(CM `scrollRectIntoView`가 밀어붙임). "문서 끝 여백"은 **스페이서 div**로 줄 것 (Phase 56)
- **`[data-noscroll]` 컨테이너는 세로 스크롤 금지**: 좌·우 칼럼과 content-frame. 스크롤되면 dev 콘솔에 경고가 뜬다 → 어떤 요소가 세로 overflow를 만든 것이니 그 원인을 제거할 것 (Phase 56)
- **조건부 `style` 객체에 longhand 병합 주의**: shorthand(`padding`)가 뒤에 오면 앞의 longhand(`paddingBottom`)를 조용히 덮어쓴다 → 스프레드 순서에 의존하지 말고 충돌 불가능한 구조를 택할 것
- **dnd-kit + `<input type="file">`**: pointerdown 전파 차단 필수
- **Korean IME + CodeMirror 단축키**: `event.code` (물리키) 사용, `event.key` 사용 금지
- **CSS @page + position:fixed**: mm 단위 정밀 배치 불안정 → Puppeteer/jsPDF 필요
- **column-fill: auto**: 왼쪽 단 먼저 채움 (balance가 기본값)
- **setext heading 방지**: `-` 줄 앞에 빈 줄 삽입 (`preventSetextHeadings`)
- **locale.ts와 EditorPreview.tsx 범위 동기화**: (a)~(e) = `[a-e]`, (i)~(v) 반드시 일치. `preventSetextHeadings`(preprocess.ts ↔ EditorPreview.tsx)도 사본 2개
- **글자 주위에 상자를 두르지 말 것 (`inline-block` 래핑)**: `text-indent` 같은 상속 인라인 속성이 래퍼 안쪽 첫 줄에 **다시** 적용된다. `p:has(.marker-circled){text-indent:-2em}` 때문에 합성 원문자의 숫자가 원 밖으로 튀어나갔다. 글리프 모양을 바꿔야 하면 **`@font-face` + `unicode-range`로 폰트를 갈아끼울 것** — 마크업이 없으면 깨질 것도 없다 (Phase 57 P5)
- **행 단위 전처리에서 `\s*` 금지, `[ \t]*`를 쓸 것**: `\s`는 개행을 포함해 다음 줄을 빨아들인다. `^①\s*`가 내용 없는 원문자 줄들을 한 문단으로 뭉치던 버그가 이것 (Phase 57)
- **여백을 논하기 전에 기준선을 실측할 것**: 전역 리셋 `* { margin: 0 }`(globals.css:100-104) 때문에 화면 `<p>`의 문단 간격은 오랫동안 **0**이었다(인쇄만 `.print-body p` 6pt). "UA 기본 1em"을 가정하면 산식이 3배로 어긋난다 (Phase 57)
- **본문 상하 여백 기준 (Phase 57 K1)**: 문단 간격(화면 `0.6em` / 인쇄 `6pt`) 위에 **상하 각 +0.5em** → 화면 `1.1em` / 인쇄 `11pt`. display 수식·ul/ol·① 원문자 밭·강조문(`.callout-block`)이 전부 이 값을 공유한다. 새 블록 타입을 추가하면 같은 값을 쓸 것

## 현재 PDF 규격

- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 부가 요소 없음 (구분선, 머리말, 꼬리말, 페이지 번호 미구현 — CSS 인쇄 한계)
- iframe 방식 인쇄 (시스템 다이얼로그 직접 호출, 미리보기 창 없음)

## 블록 타입

`text · heading · list(목록) · callout(강조문) · gana · roman · box · choices · image · svg · ggb`
(+ 레거시 `math_block`·`bullet` → text로 정규화)

- 상수 6종은 전부 `EditorView.tsx` 상단(BLOCK_TYPE_LABELS · BLOCK_TYPES · BLOCK_PRESETS · TEXT_BASED_TYPES · SPLITTABLE_TYPES · BORDERED_TYPES)
- **렌더 사이트 5곳** — 특수 타입 분기를 추가하려면 전부 손봐야 한다:
  `EditorView`(미리보기) · `ProblemView` · `FolderView` · `ProblemTabContent`(공유) · `PrintableContent`(인쇄)
  앞 4곳은 `<EditorPreview borderless>` 경유 → `.preview-content` CSS가 자동 적용. 인쇄만 자체 ReactMarkdown(`.print-body`)
- 분기 순서는 5곳 모두 `image → svg → ggb → BORDERED → callout → choices → 기본 markdown`

## 현재 Phase: 21 완료

다음 작업 후보:
- PDF 정밀 레이아웃 (Puppeteer 또는 jsPDF)
- UI 디자인 (docs/ui-design-reference.md 참조)
- Mathpix OCR API 통합
