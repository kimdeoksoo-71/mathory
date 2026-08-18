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
- **`(가)~(차)` · `ㄱ.~ㅊ.`을 그대로 입력·저장하고 렌더에서만 span을 씌운다 (각 10개, Phase 60)**
- **`(a)→(가)`, `(i)→ㄱ.` 변환은 없다 (Phase 60 후속에서 삭제)** — 두 표기가 공존하면 "무엇을 쓰면 무엇이 나오는지"가 흐려져 혼란스럽다. 옛 문항의 `(a)`는 그대로 보이며 손볼 때 리터럴로 고친다. 단 **`MARKER_LINE_RE`에는 `(a)`/`(i)`를 남겨 뒀다** — 행 분리까지 빼면 옛 문항이 한 문단으로 뭉쳐 읽을 수 없게 된다(변환이 아니라 마크다운 렌더 보조라 별개다)
- **마커 뒤 공백은 정규식이 흡수한다** — 간격은 입력 공백이 아니라 CSS 고정폭이 공급
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
- **shorthand 위에 조건부 longhand를 스프레드하지 말 것 — 사라질 때 구멍이 남는다 (Phase 45a)**: 위 항목의 *제거* 변종이자 훨씬 찾기 어렵다. `border` shorthand + `...(cond ? null : { borderTopColor })` 구조에서 `cond`가 바뀌어 longhand 키가 **없어지면**, React는 그 longhand만 `''`로 지우고 shorthand는 값이 그대로라 다시 쓰지 않는다 → 인라인 스타일에 `border-top-color`가 **빈 구멍**으로 남아 초기값 **`currentColor`(본문 검정)** 로 떨어진다. **첫 렌더는 멀쩡하고 조건이 한 번 바뀐 뒤부터** 나타나므로 코드를 아무리 읽어도 안 보인다. → **네 변을 항상 전부 적을 것**(`borderTop`/`Right`/`Bottom`/`Left`를 무조건 지정). 원인 규명은 `getComputedStyle`로 전폭 가로선을 훑는 콘솔 스니펫이 결정적이었다
- **둥근 모서리에서 인접 두 변의 색이 다르면 코너가 흐려진다 (Phase 45a)**: 브라우저가 곡선 구간에서 두 색을 대각선으로 전환시킨다. 카드 한 변만 색을 낮추는 식의 보정을 하지 말 것 — 네 변을 함께 옮길 것
- **인쇄 전 웹폰트 대기 필수 (Phase 60 후속)**: `--font-print`의 Noto Serif KR은 `display=swap`이라, 폰트가 오기 전에 `window.print()`가 스냅샷을 뜨면 **굵기 요청(600/700)이 폴백에 흡수돼 제목·경우 라벨이 본문 굵기로 인쇄된다**(글자 폭은 그대로고 획만 얇아진다 → 원인 짚기가 어렵다). `lib/pdfPrint.tsx`의 `waitForPrintFonts()`가 `document.fonts.load` + `fonts.ready`로 막는다. **타임아웃 필수** — CDN이 죽으면 폴백으로라도 인쇄돼야 한다. unicode-range 폰트(`MathoryCircled`)는 `load(font, '①')`처럼 **그 범위의 문자를 함께 넘겨야** 매칭된다
- **`PrintStyles.css`는 화면에도 로드된다 (Phase 60)**: `EditorView.tsx:51`이 직접 import하고 AppShell이 EditorView를 정적 import한다 → **앱 전 페이지**. 따라서 **인쇄 전용 규칙에는 `.print-body` 접두가 필수**다(파일 118행 주석이 이미 못 박은 규약). 접두를 빠뜨리면 인쇄 값이 화면으로 새고, 동시에 이 파일을 안 부르는 곳만 규칙이 빠진다. 반대로 화면 규칙은 `globals.css`가 `.preview-content` 스코프로 소유한다 — 인쇄가 iframe이 아니라 같은 document라 **양방향 스코프**가 필요하다
- **공개 뷰어는 두 CSS 환경에서 렌더된다 (Phase 60)**: 앱 셸 임베드(`AppShell` 783·791, BazaarView '앱에서 열기')와 독립 라우트(`/p/[problemId]`·`/shared/[shareId]`, 새 탭). 전이적 import closure 실측 — AppShell(123파일)은 PrintStyles에 도달하고 `/p`(36)·`/shared`(29)는 도달하지 않는다. **공개 페이지 스타일은 라우트 2개 + 임베드를 다 확인할 것**
- **행이 분리되는 이유는 `insertMarkerLineBreaks`뿐이다**: 렌더 파이프라인에 `remark-breaks`가 **없다**(`EditorPreview` 300 · `PrintableContent` 126 = `[remarkMath, remarkGfm]`) → CommonMark soft break가 공백이 되어 연속 행이 한 문단으로 합쳐진다. 마커 계열을 추가하면 반드시 `MARKER_LINE_RE`(lib/locale.ts)에도 넣을 것
- **이 프로젝트에 다크 모드는 없다 (Phase 45a)**: `globals.css`에 `prefers-color-scheme`·`[data-theme]`·`.dark` 셀렉터가 **0건**이다. 계획서에 반복 등장하는 "다크 토큰도 함께 정의" 요구는 소비처 없는 허수다 — 새 색 토큰에 다크 정의를 붙이지 말 것
- **활성 블록을 바꾸는 모든 경로는 `skipNextBlockScrollRef` 계약을 맺을 것 (Phase 45a)**: 플래그는 자동 스크롤 effect **맨 앞**에서 소비한다. `collapseMode` 가드 뒤에 두면 전체접기 중엔 소비되지 않고 남아 나중 전환 하나를 삼킨다. 반대로 **직접 스크롤을 호출하는 핸들러**(`handleSelectBlockBar`)는 effect의 게이트를 우회하므로 같은 조건을 자기 안에 다시 적어야 한다 — Phase 56이 이걸 빠뜨려 Phase 45의 접기 모드 가드가 무력화됐다
- **click의 `stopPropagation`은 `dblclick`을 막지 않는다 (Phase 45a)**: 별개 이벤트 타입이다. 더블클릭 핸들러가 달린 컨테이너 안의 버튼·스위치에는 `onDoubleClick` 차단을 **따로** 달 것
- **편집창 블록 인셋은 E형 (Phase 45a)**: 비활성 = 전폭·직각·간격 0 / 활성·선택 = radius 8 + `--block-border-active`. 선은 전부 **0.5px**(레티나 1물리픽셀)이고 **그림자는 쓰지 않는다**. **블록 사이 구분선은 하나뿐** — 그래서 가로선은 **위쪽만** 그린다(아래까지 그리면 인접 두 블록이 각자 내어 2줄). 덕분에 첫 블록은 상단 선이 없고 마지막 블록 아래는 열린다. 직전이 활성 카드면 그 카드의 아래 테두리가 선을 담당하므로 생략(`hideTopLine` — **CSS 형제 선택자로는 불가**, `<div key>` 래퍼가 형제 관계를 끊는다). **비활성의 네 변 0.5px은 `transparent`로 자리를 잡아 둔다** — 아예 빼면 활성 전환 순간 내용물이 밀린다. 편집 패널이 좌우 패딩 0이라 **좌측 기준선 16px**(`.cm-content` 패딩)에 바·하단툴바·미디어 블록·교정 박스를 모두 맞춘다. 열람·공유·인쇄에는 적용하지 않는다
- **U자 프레임(상·좌·우 0.5px, 상단 직각)은 3곳 공유**: `EditorView` · `ProblemView` · `FolderView`. 한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 **셋을 항상 함께** 손댈 것. Phase 45a는 테두리 선은 **그대로 두고**(블록 좌우 선을 없애는 것만으로 이중 외곽이 풀린다) 상단 라운드 10만 3곳 동시에 직각으로 바꿨다
- **dnd-kit + `<input type="file">`**: pointerdown 전파 차단 필수
- **Korean IME + CodeMirror 단축키**: `event.code` (물리키) 사용, `event.key` 사용 금지
- **CSS @page + position:fixed**: mm 단위 정밀 배치 불안정 → Puppeteer/jsPDF 필요
- **column-fill: auto**: 왼쪽 단 먼저 채움 (balance가 기본값)
- **setext heading 방지**: `-` 줄 앞에 빈 줄 삽입 (`preventSetextHeadings`)
- **locale.ts와 EditorPreview.tsx 범위 동기화**: **마커 정규식은 `lib/locale.ts`의 export 상수 하나를 양쪽이 공유한다**(`MARKER_LINE_RE`·`ALPHA_LINE_RE`·`ROMAN_LINE_RE`·`GANA_LITERAL_RE`·`GIYEOK_LITERAL_RE`·`CIRCLED_NUM_LINE_RE`, Phase 60 P4) — 사본에 정규식을 다시 적지 말 것. **단계 순서·`locale` 게이트 유무는 아직 사본**이라 그쪽은 여전히 손으로 맞춰야 한다. `preventSetextHeadings`(preprocess.ts ↔ EditorPreview.tsx)도 사본 2개
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
- **iframe이 아니다** — `lib/pdfPrint.tsx`가 숨은 div에 렌더 → `.print-root`를 `document.body`에 직접 붙여 `window.print()` (시스템 다이얼로그 직접 호출, 미리보기 창 없음). ⇒ **globals.css가 인쇄 노드에도 전부 적용된다**

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

## 현재 Phase: 60 진행 중 · 45a 완료(검수 대기)

Phase 59 = 풀이 **요약 보기(outline)** + **'경우(case)' 블록**.
문서: `docs/phasedocs/Phase59 요약 보기·경우 블록.md` — **§0-0이 최종 사양**, §11이 실사용 개정 기록

- **경우 블록**: 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호(`C1.` · `C2a.`)는 **raw_text에 넣지 않고 렌더 시 산출**한다(`lib/caseBlock.ts`) → 삽입·삭제·이동에 강하다. 대신 MD 복사·다운로드에는 번호가 없다(GitHub 아카이브 주석에만 동봉)
- **이어짓기**: 첫 줄이 빈 case/subcase = 직전 경우의 연속(번호·dot 없음, rail만 이어짐). 한 경우 안에 이미지·선택지 블록을 넣는 유일한 방법
- **요약 보기에 그림 남기기 (Phase 59 §11-9)**: 요약은 제목·핵심문장·경우 제목행만 남기는 것이 원칙이고, `Block.showInSummary`가 **유일한 예외**다 — 활성 블록 상단바(휴지통 왼쪽)의 **"요약에 넣기" 스위치**(`components/ui/ToggleSwitch` — 댓글 패널 '보이기'와 공용)로 켠다. 블록 종류를 가리지 않으므로 표를 담은 텍스트 블록·글상자도 같은 방식이다. 렌더는 사이트별 `renderBlock`을 그대로 재사용한다 — ⚠ 스켈레톤에서 그 결과를 div로 한 번 더 감싸면 `.case-gap` 형제 인접이 깨져 rail이 그림 앞뒤로 끊긴다
- **on/off 컨트롤은 공용 `components/ui/ToggleSwitch` 하나**(Phase 59 §11-10): 블록 상단바 '요약에 넣기' · 열람뷰 '요약' · 댓글 패널 '보이기/쓰기 허용'. 사본을 만들지 말 것 — 치수·색이 두 벌로 갈린다
- **요약 보기**: 열람 2뷰 전용, 비영속. **기본값은 앱 열람뷰 outline / 공개 뷰어 full**이며, 요약할 뼈대가 없으면(제목·`**`·경우 전무) 훅이 full로 강제 해제한다 — 안 그러면 빈 화면이 된다. 접으면 제목·`**` 발췌·경우 제목행만 남는다. Phase 54 레거시 `**Case n.**`도 **행 단위 스캔**으로 항목 승격
- 로직 검증: `npm run test:case` (27개)

### Phase 60 — list 로케일 블록 개편 (구현 완료 · 검증 대기)

문서: `docs/phaseSketch/Phase60 list 로케일 블록 개편 v4 실행판.md` (v1 web → v2 CLI → v3 web → v4 CLI)

- **저장 철학이 바뀌었다**: "저장은 국제 표준, 표시만 로케일"을 버리고 **로케일 블록** — 한국 문항은 `(가)`·`ㄱ.`을 그대로 입력·저장한다. 레거시 `(a)`/`(i)` 변환은 옛 문항 호환용으로 유지
- 로직 검증: `npm run test:locale` (15개)
- **남은 검증(덕수)**: ① 인쇄 PDF 전후 동일 — `docs/phaseSketch/phase60 before.pdf`가 기준선, 판정 기준은 `phase60 before 관측.md`, 비교는 픽셀 diff ② 앱 마커 굵기·`ㄱ.` 여백 변화 확인 ③ `/shared`·`/p` 하드 로드 정렬 수정 확인

다음 작업 후보:
- PDF 정밀 레이아웃 (Puppeteer 또는 jsPDF)
- UI 디자인 (docs/ui-design-reference.md 참조)
- Mathpix OCR API 통합
