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

- `\tag{n}`: 수식 내 → `\tag*{…… ㉠}`, 텍스트 행 끝 → `<span class="tag-marker">`
- `\ref{n}`: 수식 내 → `\text{㉠}`, 텍스트 → ㉠ 직접 치환
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

- **CodeMirror autoHeight 모드**: `EditorView.scrollIntoView` 사용 금지 → 상위 컨테이너 수동 스크롤
- **dnd-kit + `<input type="file">`**: pointerdown 전파 차단 필수
- **Korean IME + CodeMirror 단축키**: `event.code` (물리키) 사용, `event.key` 사용 금지
- **CSS @page + position:fixed**: mm 단위 정밀 배치 불안정 → Puppeteer/jsPDF 필요
- **column-fill: auto**: 왼쪽 단 먼저 채움 (balance가 기본값)
- **setext heading 방지**: `-` 줄 앞에 빈 줄 삽입 (`preventSetextHeadings`)
- **locale.ts와 EditorPreview.tsx 범위 동기화**: (a)~(e) = `[a-e]`, (i)~(v) 반드시 일치

## 현재 PDF 규격

- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 부가 요소 없음 (구분선, 머리말, 꼬리말, 페이지 번호 미구현 — CSS 인쇄 한계)
- iframe 방식 인쇄 (시스템 다이얼로그 직접 호출, 미리보기 창 없음)

## 현재 Phase: 21 완료

다음 작업 후보:
- PDF 정밀 레이아웃 (Puppeteer 또는 jsPDF)
- UI 디자인 (docs/ui-design-reference.md 참조)
- Mathpix OCR API 통합
