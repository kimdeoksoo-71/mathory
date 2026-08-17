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
preventSetextHeadings → insertMarkerLineBreaks → preprocessLocale
  → normalizeCaseBoundaries → convertSubcaseMarkers → preprocessMath
```
(뒤 두 단계는 Phase 54 레거시 `**Case n.**` / `- **Case na.**` 표기 전용. `lib/preprocess.ts:196-197`)

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
- **제목 위 여백은 3항 합이다 (Phase 58 F1)**: `[앞 블록에서 이월된 마진]` + `[블록 래퍼 paddingTop]` + `[h2 자신의 marginTop]`. 앞 블록 타입에 따라 이월분이 달라져(text 뒤 `0.6em` / display 수식·리스트·① 밭 뒤 `1.1em`) 체감 여백이 ±0.25em 흔들린다. **em 마진은 본문 em이 아니라 그 요소 자신의 font-size 기준**이라 h2의 `margin: 1em`은 `1.08em`이다. 세 항 중 하나만 보고 계산하면 어긋난다 — 반드시 DevTools로 실측할 것
- **제목 스타일은 `EditorPreview.tsx` 인라인 style이 유일한 진실**: globals.css의 heading 절은 규칙 없는 주석이고, 인라인 style은 `!important` 없는 모든 시트 규칙을 이긴다 → **CSS로는 못 바꾼다.** h1/h2/h3는 한 벌이므로 하나만 고치면 위계가 역전한다 (Phase 58 D1')
- **`--katex-scale`은 `em` 단위 포함 값**(현재 `1.08em`): 무단위로 바꾸면 `font-size`에 invalid라 declaration이 통째로 폐기되고 `.katex`가 katex.min.css의 `font: normal 1.21em`으로 되돌아가 **오히려 커진다**. 소비처는 `.preview-content .katex` 한 곳뿐 (Phase 58 P4)
- **원문자(①~⑳) 크기 레버는 `@font-face`의 `size-adjust` 하나뿐**(현재 88%): 합성을 안 쓰므로 전용 CSS 클래스가 없다. `--font-print`도 같은 family를 공유해 화면·인쇄가 함께 줄어든다. Safari 17 미만은 디스크립터를 무시할 뿐이라 안전 (Phase 58 P5)
- **명암비 계산은 `((c+0.055)/1.055)^2.4`** — `/1.055`를 빠뜨리면 판정이 뒤집힌다. 실배경은 흰색이 아니라 클레이 3종(`--bg-content #F4EFE7` / FolderView 카드 `--block-bg-active #EDE6DA` / 공유뷰 `--bg-card #FEFDFB`)이고, **구속 조건은 가장 어두운 `#EDE6DA`** 하나다 (Phase 58 D3)
- **`.problem-content-toned .katex`가 수식에 명시 color를 준다**: 조상에 `color`를 줘도 수식엔 닿지 않는다. 수식 색을 바꾸려면 `.katex`를 직접 겨냥해 특이도로 이겨야 한다 (Phase 58 D3')
- **key sentence 톤 시스템 (Phase 58 P2)**: key 마커는 인라인 `**` **하나뿐**이다. 강조문(callout)은 들여쓰기로 위치를 강조하는 레이아웃 블록이고 톤과 무관하므로 `.callout-block`에 톤 규칙을 두지 않는다(D13). `**`가 없는 풀이는 톤 낮추기 미발동(D4). 스코프는 `tabId !== 'question'`(D9) — 판정은 `lib/keyTone.ts`가 5개 사이트에 공급한다. 톤 기준선 색은 `.tone-baseline`에 있고 `.problem-content-toned`는 타이포만 담는다(D14 — 공유뷰에 후자를 통째로 붙이면 `letter-spacing`이 딸려와 공개 페이지 줄바꿈이 바뀐다). **인쇄는 의도적 예외**: 전체 100% 톤 복원 + key만 굵게(D6)
- **KaTeX 글리프는 조상의 굵기를 상속하지 않는다**: katex.min.css `.katex { font: normal 1.21em … }`의 `font` shorthand가 `font-weight`를 normal로 리셋한다. 그래서 "가짜 볼드"는 애초에 생기지 않고, 반대로 **key 안 수식은 굵게 만들 수 없다**(색으로만 구분된다)
- **툴바 아이콘은 `UnifiedToolbar.tsx` 안의 인라인 SVG 컴포넌트 계열**: `SVG_PROPS`(viewBox 64, stroke 3.5) + `CORNER_BRACKETS` 공유, `stroke="currentColor"`. **별도 `.svg` 파일로 빼면 `currentColor`가 끊긴다.** `IconButton`의 hover는 배경만 바꾸고 색은 `active`일 때만 액센트로 간다 (Phase 58 P3)

## 현재 PDF 규격

- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 부가 요소 없음 (구분선, 머리말, 꼬리말, 페이지 번호 미구현 — CSS 인쇄 한계)
- iframe 방식 인쇄 (시스템 다이얼로그 직접 호출, 미리보기 창 없음)

## 블록 타입

`text · heading · list(목록) · callout(강조문) · case(경우) · subcase(하위 경우) · gana · roman · box · choices · image · svg · ggb`
(+ 레거시 `math_block`·`bullet` → text로 정규화)

- **강조의 두 축은 독립이다 (Phase 58 D13)**: `callout`은 **들여쓰기(위치)** 강조, 인라인 `**`는 **톤(색·굵기)** 강조. 따로 써도 되고 같이 써도 된다. display 수식 `$$…$$`은 블록 문법이라 `**`로 감쌀 수 없으므로, 톤 강조가 필요하면 인라인으로 바꿔 `**$…$**`로 쓴다(인라인 수식에도 `\displaystyle`이 자동 주입되므로 조판은 그대로다). 들여쓰기까지 원하면 그 행을 callout에 둔다

- 상수 6종은 전부 `EditorView.tsx` 상단(BLOCK_TYPE_LABELS · BLOCK_TYPES · BLOCK_PRESETS · TEXT_BASED_TYPES · SPLITTABLE_TYPES · BORDERED_TYPES)
- **렌더 사이트 5곳** — 특수 타입 분기를 추가하려면 전부 손봐야 한다:
  `EditorView`(미리보기) · `ProblemView` · `FolderView` · `ProblemTabContent`(공유) · `PrintableContent`(인쇄)
  앞 4곳은 `<EditorPreview borderless>` 경유 → `.preview-content` CSS가 자동 적용. 인쇄만 자체 ReactMarkdown(`.print-body`)
- **분기 순서는 5곳이 서로 다르다 (Phase 59 F1 실측)** — 공통 앵커는 **callout 바로 앞** 하나뿐이다:
  `EditorView`·`ProblemView`(→TabBody)·`FolderView` = `image → svg → ggb → BORDERED → case → callout → choices → 기본` /
  **`ProblemTabContent`은 svg·ggb 분기가 없다**(공개 뷰어 미지원) / **`PrintableContent`는 choices가 맨 앞**이다
- **블록마다 래퍼가 있는 사이트가 둘이다 (Phase 59 D15′)**: `EditorView`(`<div data-block-id>`)와 `PrintableContent`(`<div class="print-block">`).
  형제 인접 셀렉터(`.case-block + .case-block`)를 쓰는 스타일은 **래퍼에 클래스를 병기**해야 한다 — 래퍼 안에 새 div를 만들면 형제 관계가 끊겨 조용히 죽는다
- **블록을 두 `<EditorPreview>`로 쪼개지 말 것 (Phase 59 E7)**: `data-math-id`가 인스턴스별로 0부터 매겨져 편집창의 "미리보기 수식 클릭 → 편집 위치" 매핑이 깨진다. 블록 앞머리에 무언가 붙여야 하면 **마크다운 문자열에 `<span>`을 주입**할 것(`marker-gana`·`case-label` 방식)
- **`.case-block`에 상하 padding 금지 (Phase 59 G7)**: 지금은 자식 `<p>` 마진이 블록 밖으로 빠져나와(부모-자식 collapse) 형제 간격이 정확히 K1(1.1em)이다. 상하 padding이 1px라도 생기면 마진이 갇혀 간격이 1.7em이 되고 rail 브리징(`bottom: -1.1em`)이 짧아진다
- **`$$x=1$$`를 한 줄로 쓰면 인라인 수식이 된다 (Phase 59 실측)**: `.katex-display`가 생기지 않아 들여쓰기·상하 여백(K1) 규칙이 전부 비껴간다. 독립행 수식은 반드시 `$$` / 내용 / `$$` 세 줄로. 경우 블록은 제목행 뒤 빈 줄까지 `injectCaseLabel`이 렌더 시 보장한다(안 그러면 본문이 제목행 문단에 흡수된다)
- **연결선(rail)은 조각을 이어 붙인 것이다 (Phase 59 §11-1)**: `.case-block`/`.case-gap`이 각자 조각을 그리고 **위쪽으로** 브리지해 잇는다. ① 브리지가 위쪽이어야 종단(마지막 dot)이 정확하고 ② 색이 불투명해야 겹친 구간이 진해지지 않으며 ③ 브리지 1.5em(인쇄 14pt)은 "최대 간격보다 크고 최소 간격+0.9em보다 작아야" 한다는 양쪽 제약의 값이다. 블록 마진을 바꾸면 이 값을 다시 볼 것
- **경우 구역의 좌측 기준은 세 자리다 (Phase 59 §11-6)**: `rail·dot 1em` / `경우 본문·제목행 3em` / `한 단 더(수식·리스트·발췌) 6em` — 인쇄는 0.7/2/4em. 경우 사이에 낀 블록도 이 기준을 따라야 목록 불릿·글상자 테두리가 rail 위에 겹치지 않는다(이미지·SVG·GGB만 예외 — 중앙 정렬이라 밀린다). **들여쓰기는 `padding-left`로 줄 것** — `margin-left`를 쓰면 rail을 그리는 박스가 통째로 밀려 세로선이 엉뚱한 자리에 하나 더 생긴다
- **경우 블록 안은 최상위와 같은 들여쓰기 규칙 (Phase 59 §11-2)**: display 수식이 본문보다 한 단(3em/인쇄 2em) 더 들어간다 → `.katex-display`에 override를 두지 **않는다**. 반대로 `.callout-block`은 `padding-left: 0`으로 죽인다(한 줄 강조 장치라 이중 들여쓰기가 군더더기) — **전례를 복사해 되돌리지 말 것**. 리스트·① 밭은 기본 1em이 약해 같은 한 단으로 올리며, 인쇄 ① 규칙은 globals의 `!important`를 이기려면 `!important`가 필요하다
- **상태를 나타내는 색은 3:1을 넘겨야 한다 (Phase 59 G1)**: 경우 dot은 `--case-dot`(= `--mathory-red-dark #BC5F3F`, 카드 배경에서 3.49:1). 로고 레드 `#D97757`은 2.52:1로 **미달**이라 못 쓴다. 텍스트가 아니어도 상태 표시기면 이 기준이 걸린다

## 현재 Phase: 59 구현 완료 (검증 대기)

Phase 59 = 풀이 **구조 보기(outline)** + **'경우(case)' 블록**.
착수 문서: `docs/phasedocs/Phase59 구조 보기·경우 블록.md`

- **경우 블록**: 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호(`C1.` · `C2a.`)는 **raw_text에 넣지 않고 렌더 시 산출**한다(`lib/caseBlock.ts`) → 삽입·삭제·이동에 강하다. 대신 MD 복사·다운로드에는 번호가 없다(GitHub 아카이브 주석에만 동봉)
- **이어짓기**: 첫 줄이 빈 case/subcase = 직전 경우의 연속(번호·dot 없음, rail만 이어짐). 한 경우 안에 이미지·선택지 블록을 넣는 유일한 방법
- **구조 보기**: 열람 2뷰(ProblemView·ProblemTabContent) 전용, 기본 full, 비영속. 접으면 제목·`**` 발췌·경우 제목행만 남는다. Phase 54 레거시 `**Case n.**`도 **행 단위 스캔**으로 항목 승격
- 로직 검증: `npm run test:case` (18개)

다음 작업 후보:
- **P6 긴 display 수식 접기** (Phase 58에서 분리) — 최상위 `\\` display 수식 전용. `aligned`·`gathered`·`array`는 `.mspace.newline`을 방출하지 않아 행 단위 접기가 불가능하다. 착수 전 전 문항에서 두 문법의 사용 비율부터 조사할 것
- PDF 정밀 레이아웃 (Puppeteer 또는 jsPDF)
- UI 디자인 (docs/ui-design-reference.md 참조)
- Mathpix OCR API 통합
