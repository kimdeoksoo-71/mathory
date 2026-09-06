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
components/import/
  SheetImportModal.tsx     — 시트 가져오기 마법사 (Phase 61a)
lib/sheetImport.ts         — 시트 행 → 문항 초안 변환 (import 0, 순수 함수)
app/api/sheet-import/      — 스프레드시트 읽기 프록시 (읽기 전용 스코프)
app/api/sheet-import/figure/ — Drive 그림 읽기 프록시 (Phase 61e, drive.readonly 단독 JWT)
lib/verify/               — 정밀 검증 (Phase 61b, 전부 import 0 순수 모듈)
  prompts.ts               — 프롬프트 3세트 · 함수형 치환 · 블록 라벨링
  parse.ts                 — JSON 4단계 폴백 · LaTeX 복구 · 앵커 · 합성
  providerParams.ts        — AI 요청 바디 조립 (회귀 스냅샷 대상)
app/api/verify/            — 2단 교차검증 라우트 (Firestore 미접촉)
lib/apiAuth.ts             — ID 토큰 검증 공용 (sheet-import · verify)
lib/chatExtract.ts        — 대화 선택 → 마크다운 직렬화 (Phase 61c, import 0 순수 모듈)
components/comment/
  SelectionInsertPopup.tsx — 선택 감지·DOM 어댑터·팝업 (Phase 61c)
lib/latexScan.ts          — LaTeX 중괄호 균형 스캔 (M1, import 0 · mathSplit·proofread 공용)
lib/verify/batchPlan.ts   — 일괄 검증 판정 (Phase 61d, import 0 순수 모듈)
lib/batchVerify.ts        — 일괄 검증 오케스트레이터 (Phase 61d, firestore 접촉)
components/problem/
  BatchVerifyDialog.tsx    — 일괄 검증 선택→진행→요약 (Phase 61d)
  ListView.tsx             — 리스트 본문(grid+subgrid) · ListHeader(칼럼 헤더, FolderView 행 2에서 렌더) (Phase 63)
lib/listColumns.ts        — 칼럼 레지스트리·prefs 검증·정렬 서열 (Phase 63, import 0)
hooks/useListPrefs.ts     — 칼럼 prefs 폴더별 localStorage 영속 (Phase 63)
components/ui/dnd.tsx     — 전역 DnD 공용: 계약·id 네임스페이스·충돌 판정·DragKindContext (Phase 63)
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
- **인라인 수식에는 `\displaystyle`이 자동 주입된다 — 덕수 확정 원칙(2026-09-05), 흔들지 말 것**:
  주입은 **사본 2벌**이다 — 인쇄 `lib/preprocess.ts:168-175` · 화면 `EditorPreview.tsx:230-235`
  (preprocess.ts 헤더가 명시하듯 그 파일은 PrintableContent 전용이다). 한쪽만 고치면 화면·인쇄
  조판이 갈린다. 이미 있으면 중복 주입하지 않는다.
  이 원칙 위에 서 있는 것들 — ① **강조 규약의 전제**: display `$$…$$`는 `**`로 못 감싸므로
  "인라인으로 바꿔 `**$…$**`"가 성립하는 근거가 곧 이 주입(조판 불변)이다 ② **M3 B2의 전제**:
  KaTeX `\frac` 매크로를 "인라인 제외" 갈래 없이 3종 전부에 적용하는 근거 ③ 조판 품질:
  인라인 분수·시그마가 textstyle로 쪼그라들지 않는다(한국 수학 문항 표기 기준).
  대가(수용됨): 큰 수식이 든 줄의 줄간이 벌어진다 — "인라인만 작게" 류의 성능·미관 제안이
  오면 이 원칙으로 기각할 것

## 작업 규칙

1. **파일 수정 전 현재 파일을 반드시 읽을 것** — 이전 대화의 기억으로 추정하지 말 것
2. **완전한 파일 교체 선호** — diff/patch보다 전체 파일 교체가 안전
3. **git push는 덕수가 직접 수행** — Claude Code는 커밋까지만
4. **Vercel 배포 후 Cmd+Shift+R로 하드 리프레시** — CDN 캐시 제거
5. **`.next` 캐시 삭제**: 빌드 문제 시 `rm -rf .next` 후 재빌드.
   ⚠ **dev 서버가 도는 동안 `npm run build` 금지** — 같은 `.next`를 공유해 dev의 라우트
   매니페스트를 덮어쓰고, **다음 핫 리로드 때** `/`가 404가 된다(즉시가 아니라서 원인 연결이
   어렵다 — 2026-09-05 M3에서 실증). 빌드 검증은 dev를 끄고 → build → dev 재시작 순서로
6. **roadmap.md 업데이트**: 각 Phase 완료 시
7. **Phase 완료 시 최종 계획서를 `docs/phasedocs/`에 등록할 것** — 폴더 둘의 역할이 다르다.
   `docs/phaseSketch/`는 **작업물**(구상 · 계획 v1~vN)이라 정리 대상이고,
   `docs/phasedocs/`는 **확정본 보관소**이며 CLAUDE.md·roadmap이 가리키는 유일한 경로다.
   ⚠ 옮기지 않으면 phaseSketch 정리 때 **그 Phase의 유일한 사양이 사라진다** —
   2026-08-27에 Phase 60·61a~61d가 실제로 그랬고(포인터 5개가 끊겼다) 복구했다.
   중간 판본(v1~vN-1)은 phaseSketch에 두거나 지운다. **확정본만 phasedocs로.**

## 핵심 패턴 & 주의사항

- **편집창 CodeMirror 스크롤**: `.cm-scroller`가 `overflow:visible`이라 내부 스크롤이 없음 → CM의 `EditorView.scrollIntoView` 사용 금지. 모든 세로 스크롤은 외곽 `.scaled-editor`가 담당하며 `lib/editorScroll.ts`를 거칠 것
- **스크롤 패널에 `paddingBottom:100vh` 금지**: `box-sizing:border-box`에서 요소 높이는 패딩 합보다 작아질 수 없어 패널이 부모보다 커지고, `overflow:hidden` 부모에 복구 불가한 스크롤 틈이 생긴다(CM `scrollRectIntoView`가 밀어붙임). "문서 끝 여백"은 **스페이서 div**로 줄 것 (Phase 56)
- **`[data-noscroll]` 컨테이너는 세로 스크롤 금지**: 좌·우 칼럼과 content-frame. 스크롤되면 dev 콘솔에 경고가 뜬다 → 어떤 요소가 세로 overflow를 만든 것이니 그 원인을 제거할 것 (Phase 56)
- **조건부 `style` 객체에 longhand 병합 주의**: shorthand(`padding`)가 뒤에 오면 앞의 longhand(`paddingBottom`)를 조용히 덮어쓴다 → 스프레드 순서에 의존하지 말고 충돌 불가능한 구조를 택할 것
- **shorthand 위에 조건부 longhand를 스프레드하지 말 것 — 사라질 때 구멍이 남는다 (Phase 45a)**: 위 항목의 *제거* 변종이자 훨씬 찾기 어렵다. `border` shorthand + `...(cond ? null : { borderTopColor })` 구조에서 `cond`가 바뀌어 longhand 키가 **없어지면**, React는 그 longhand만 `''`로 지우고 shorthand는 값이 그대로라 다시 쓰지 않는다 → 인라인 스타일에 `border-top-color`가 **빈 구멍**으로 남아 초기값 **`currentColor`(본문 검정)** 로 떨어진다. **첫 렌더는 멀쩡하고 조건이 한 번 바뀐 뒤부터** 나타나므로 코드를 아무리 읽어도 안 보인다. → **네 변을 항상 전부 적을 것**(`borderTop`/`Right`/`Bottom`/`Left`를 무조건 지정). 원인 규명은 `getComputedStyle`로 전폭 가로선을 훑는 콘솔 스니펫이 결정적이었다
- **둥근 모서리에서 인접 두 변의 색이 다르면 코너가 흐려진다 (Phase 45a)**: 브라우저가 곡선 구간에서 두 색을 대각선으로 전환시킨다. 카드 한 변만 색을 낮추는 식의 보정을 하지 말 것 — 네 변을 함께 옮길 것
- **인쇄 전 웹폰트 대기 필수 (Phase 60 후속)**: `--font-print`의 Noto Serif KR은 `display=swap`이라, 폰트가 오기 전에 `window.print()`가 스냅샷을 뜨면 **굵기 요청(600/700)이 폴백에 흡수돼 제목·경우 라벨이 본문 굵기로 인쇄된다**(글자 폭은 그대로고 획만 얇아진다 → 원인 짚기가 어렵다). `lib/pdfPrint.tsx`의 `waitForPrintFonts()`가 `document.fonts.load` + `fonts.ready`로 막는다. **타임아웃 필수** — CDN이 죽으면 폴백으로라도 인쇄돼야 한다. unicode-range 폰트(`MathoryCircled`)는 `load(font, '①')`처럼 **그 범위의 문자를 함께 넘겨야** 매칭된다
- **`PrintStyles.css`는 화면에도 로드된다 (Phase 60)**: `EditorView.tsx:56`이 직접 import하고 AppShell이 EditorView를 정적 import한다 → **앱 전 페이지**. 따라서 **인쇄 전용 규칙에는 `.print-body` 접두가 필수**다(파일 118행 주석이 이미 못 박은 규약). 접두를 빠뜨리면 인쇄 값이 화면으로 새고, 동시에 이 파일을 안 부르는 곳만 규칙이 빠진다. 반대로 화면 규칙은 `globals.css`가 `.preview-content` 스코프로 소유한다 — 인쇄가 iframe이 아니라 같은 document라 **양방향 스코프**가 필요하다
- **공개 뷰어는 두 CSS 환경에서 렌더된다 (Phase 60)**: 앱 셸 임베드(`AppShell` 783·791, BazaarView '앱에서 열기')와 독립 라우트(`/p/[problemId]`·`/shared/[shareId]`, 새 탭). 전이적 import closure 실측 — AppShell(123파일)은 PrintStyles에 도달하고 `/p`(36)·`/shared`(29)는 도달하지 않는다. **공개 페이지 스타일은 라우트 2개 + 임베드를 다 확인할 것**
- **행이 분리되는 이유는 `insertMarkerLineBreaks`뿐이다**: 렌더 파이프라인에 `remark-breaks`가 **없다**(`EditorPreview` 300 · `PrintableContent` 126 = `[remarkMath, remarkGfm]`) → CommonMark soft break가 공백이 되어 연속 행이 한 문단으로 합쳐진다. 마커 계열을 추가하면 반드시 `MARKER_LINE_RE`(lib/locale.ts)에도 넣을 것
- **이 프로젝트에 다크 모드는 없다 (Phase 45a)**: `globals.css`에 `prefers-color-scheme`·`[data-theme]`·`.dark` 셀렉터가 **0건**이다. 계획서에 반복 등장하는 "다크 토큰도 함께 정의" 요구는 소비처 없는 허수다 — 새 색 토큰에 다크 정의를 붙이지 말 것
- **활성 블록을 바꾸는 모든 경로는 `skipNextBlockScrollRef` 계약을 맺을 것 (Phase 45a)**: 플래그는 자동 스크롤 effect **맨 앞**에서 소비한다. `collapseMode` 가드 뒤에 두면 전체접기 중엔 소비되지 않고 남아 나중 전환 하나를 삼킨다. 반대로 **직접 스크롤을 호출하는 핸들러**(`handleSelectBlockBar`)는 effect의 게이트를 우회하므로 같은 조건을 자기 안에 다시 적어야 한다 — Phase 56이 이걸 빠뜨려 Phase 45의 접기 모드 가드가 무력화됐다
- **click의 `stopPropagation`은 `dblclick`을 막지 않는다 (Phase 45a)**: 별개 이벤트 타입이다. 더블클릭 핸들러가 달린 컨테이너 안의 버튼·스위치에는 `onDoubleClick` 차단을 **따로** 달 것
- **편집창 블록 인셋은 E형 (Phase 45a)**: 비활성 = 전폭·직각·간격 0 / 활성·선택 = radius 8 + `--block-border-active`. 선은 전부 **0.5px**(레티나 1물리픽셀)이고 **그림자는 쓰지 않는다**. **블록 사이 구분선은 하나뿐** — 그래서 가로선은 **위쪽만** 그린다(아래까지 그리면 인접 두 블록이 각자 내어 2줄). 덕분에 첫 블록은 상단 선이 없고 마지막 블록 아래는 열린다. 직전이 활성 카드면 그 카드의 아래 테두리가 선을 담당하므로 생략(`hideTopLine` — **CSS 형제 선택자로는 불가**, `<div key>` 래퍼가 형제 관계를 끊는다). **비활성의 네 변 0.5px은 `transparent`로 자리를 잡아 둔다** — 아예 빼면 활성 전환 순간 내용물이 밀린다. 편집 패널이 좌우 패딩 0이라 **좌측 기준선 16px**(`.cm-content` 패딩)에 바·하단툴바·미디어 블록·교정 박스를 모두 맞춘다. 열람·공유·인쇄에는 적용하지 않는다
- **U자 프레임은 이제 `EditorView` 한 곳뿐이다 (개선묶음 M2 D20′)**: ⚠ **`ProblemView`는 M2에서 프레임을 걷어냈다** — 바탕이 아이보리가 되고 클레이는 **탭별 카드**가 담당한다(FolderView가 Phase 62에서 한 것과 같은 이동). 아래 "2곳 공유" 서술은 M2 이전 기록이다. 화면 전환 시 배경이 달라지는 것은 **수용된 결과**다(E-M2-2). 옛 규약 전문:
- ~~**U자 프레임(상·좌·우 0.5px, 상단 직각)은 문항 단위 화면 2곳이 공유한다**~~: `EditorView` · `ProblemView`. 한 곳만 바꾸면 화면 전환 시 프레임이 점멸하므로 **둘을 항상 함께** 손댈 것. Phase 45a는 테두리 선은 **그대로 두고**(블록 좌우 선을 없애는 것만으로 이중 외곽이 풀린다) 상단 라운드 10만 직각으로 바꿨다. ⚠ **`FolderView`는 Phase 62부터 의도적으로 프레임이 없다** — 클레이 = "문항 하나를 보는 중", 아이보리 = "문항 밖"이고 클레이는 카드·리스트 행이 담당한다. **FolderView에 프레임을 되살리지 말 것**(그 점멸이 곧 의도된 상황 변화 신호다)
- **네이티브 `alert`/`confirm`/`prompt` 직접 호출 금지 (개선묶음 M2 A)**: `lib/dialogs.ts` 경유.
  그 파일은 **import 0**이라 `npm run test:dialogs`가 단독 컴파일한다. 훅이 아니라 **모듈 싱글턴**인
  이유는 호출부가 React 밖에도 있기 때문이다(`lib/pdfPrint.tsx`). **큐 필수**(겹치면 Escape가 어느 것을
  닫는지 알 수 없다) · **Host 부재 시 기본값으로 흘려보낼 것**(안 하면 호출부가 영원히 `await`한다).
  스타일은 `components/ui/dialogStyles.ts` 하나가 소유하고 SheetImportModal 값을 복제했다 —
  ⚠ 새 규격을 만들지 말 것(목적은 갈래를 없애는 것이지 아홉 번째 모달 디자인이 아니다).
  `Z_DIALOG = 10500`(현행 최고 10000 위). ⚠ **문항 이동 픽커 ≠ 폴더 재부모화** — 문항엔 자손이 없어
  순환 방지가 필요 없다(v1 계획서가 둘을 섞어 적었다)
- **참조 인용 말풍선의 정의부를 언마운트하지 말 것 (개선묶음 M2 C)**: 보기의 정의부(`ㄱ.`·`(가)`·`①`·`\tag`)는
  **문제 탭에 살고** 참조는 풀이에 있다. 접힘·요약이 문제 탭 내용을 DOM에서 지우면 풀이의 참조가
  **한꺼번에 무음**이 된다(실제로 그랬다). 숨겨야 하면 `visibility:hidden`(+`position:absolute`)으로
  **노드를 남길 것**. 그 밖의 규약: 보호 목록에 `ref-marker` **자신**이 들어가야 멱등하고(빠지면 2회째에
  재감쌈), marker 계열을 **요소 통째로** 보호해야 정의부가 참조로 둔갑하지 않으며, 자모 경계는
  **뒤쪽 lookahead에서 한글 음절을 배제하지 않는다**(배제하면 `ㄱ이`·`ㄱ은`을 놓친다).
  게이트(`data-ref-tooltip`)는 **탭 전체를 감싸는 컨테이너**에 — 탭 하나에 붙이면 탭을 가로지르는 인용이 죽는다
- **ProblemView 본문 컨테이너는 block이어야 한다 (개선묶음 M2 D23′·D45′·D46′)**: flex는 두 가지를 동시에 깬다 —
  ① `justify-content:center`의 좌측 넘침은 **스크롤 영역에 포함되지 않아** `overflow-x:auto`로도 닿을 수 없다
  (실측: 자식 780인데 `scrollWidth` 690) ② 기본 `align-items:stretch`가 자식 높이를 눌러 **sticky가 죽는다**
  (실측: 300px 스크롤 후 −220px). 자식 폭은 `fit-content`가 아니라 **`max-content`**(전자는 유동 폭에서
  조용히 클램프한다). ⚠ ②의 sticky는 이제 **풀이 라벨 열 전용**이다 — 문제 카드 sticky는 철거됐다.
  ⚠ 옛 "하단 스페이서 70vh는 자동접힘의 전제" 조항은 **폐기**됐다(자동접힘 자체가 없다). 스페이서는
  남겨 두지만 이유가 달라졌다 — 마지막 카드 아래 읽기 여백일 뿐이다
- **ProblemView는 스크롤로 레이아웃이 변하지 않는다 (ProblemView 디자인 개선 P1·P2)**: 제목행 접힘·
  문제 카드 sticky·숨김을 **다시 넣지 말 것**. 덕수 판정("카드가 사라지고 나타나는 순간 화면이 튄다")으로
  방향을 *보정*에서 **튈 일을 안 만든다**로 뒤집었고, 그 결과 최종 코드에 **`scrollTop`을 읽고 쓰는 곳이
  하나도 없다**(판정은 rect 비교뿐). 남은 상태 `problemOffscreen`·`peeking`은 **둘 다 레이아웃에 영향이
  없어** 진동이 구조적으로 불가능하다. ⚠ 부수 효과가 본체보다 크다 — **M2에서 가장 값비쌌던 참조 말풍선
  회귀 위험이 원천 소멸**했다(카드가 늘 정상 상태로 DOM에 있어 `visibility:hidden` 우회조차 불필요)
- **hold-to-peek은 `setPointerCapture` 없이 만들지 말 것 (P7)**: 누른 채 알약 밖으로 나가서 떼면
  `pointerup`이 안 와 **카드가 안 닫힌다**. `pointercancel`·`blur`도 닫을 것이고, `keydown`은 길게
  누르면 **반복 발화**하므로 이미 열려 있으면 무시한다. ⚠ 중앙에 띄우는 카드는 **`[data-ref-tooltip]` 밖**
  (안이면 보기의 정의부가 두 벌이 되어 "참조보다 앞선 것 중 가장 가까운 것" 탐색이 흔들린다).
  ⚠ 오버레이는 **컨테이너 `pointerEvents:none` + 카드만 `auto`** — 둘 다 none이면 긴 문제를 hold 중에
  휠로 못 넘기고, 둘 다 auto면 뒤를 막는다. ⚠ 알약은 탭(TabBody) 안이 아니라 **탭 전체의 첫 형제**여야
  아래 탭으로 스크롤해도 남는다. 흐름 높이 0(sticky 상자 안 `absolute`)이라 등장·소멸이 아무것도 안 민다
- **제목행 높이 57은 앱 전역 1행 높이다 (P1 · R6)**: `dialogHead`·`dialogFoot`·`BatchVerifyDialog`·
  EditorView Row1(`minHeight 57` + `borderBottom 1px --border-light`)·`DRAWER_ROW1_H`(= 57 − inset 8 −
  테두리 1)이 전부 이 값이다 → **모든 드로어의 첫 가로선이 y=57**. ProblemView 우측 단도 드로어라
  이제 중앙 제목행 선과 우측 단 1행 선이 **같은 Y**에 선다. ⚠ 옛 98은 EditorView Row1+**Row2** 두 행치라,
  중앙에 하나뿐인 선이 드로어의 *둘째* 선과 짝지어지는 어긋난 대응이었다(빈 띠 ~50px은 "추후 메타데이터"
  예약이었는데 끝내 오지 않았다). ⚠ `minHeight`가 아니라 `height` — 제목 span이 nowrap+ellipsis라 안전하다
- **자동 수정은 텍스트 영역의 LaTeX 제어열을 보호한다 (Phase 61e)**: `autoWrapBareNumbers`·
  `autoWrapBareLetters`의 보호 목록에 수식·HTML·URL·코드·`\tag`/`\ref`는 있었지만 **일반 제어열이
  없어** `\includegraphics{a_fig1.jpg}`가 `\$includegraphics${$a$_fig1.$jpg$}`로 파괴됐다(실측 count 6).
  `\begin{itemize}`·`\item`·`\hline`도 같다. 공용 헬퍼 `collectControlSeqRanges` 하나를 두 함수가
  부르고, 중괄호는 **`readGroup`의 균형 스캔**으로 흡수한다(정규식 금지 — M1 W2). `[opt]` 인자도 함께
  흡수한다(안 하면 `\includegraphics[width=5cm]{name}`에서 `{` 흡수가 시작되지 않아 **파일명이 통째로
  무방비**가 된다). ⚠ **인자를 통째로 보호하므로 `\textbf{2개}`의 `2`는 수식화되지 않는다 — 의도한
  트레이드오프다.** ⚠ **`convertJamoRefs`에는 넣지 말 것** — 그쪽은 `\text{(ㄱ)}`처럼 제어열 인자 안의
  참조까지 변환하는 것이 **명시된 사양**이다(덕수 2026-08-26). 세 함수가 `collectMathRanges`를 공유해
  "통일"하고 싶어지는 자리인데, 통일하면 그 결정이 조용히 뒤집힌다
- **`lib/proofread.ts`는 `grep -a`로 볼 것 (Phase 61e)**: 내부에 `⟦M0⟧` 등 비ASCII 제어 문자열이 있어
  `file(1)`이 **`data`로 판정**한다 → 맨 `grep`이 매치를 **조용히 감춘다**(0건으로 보인다).
  이 저장소에서 "분명히 있는데 grep이 0건"이면 이 함정을 먼저 의심할 것
- **Storage 규칙의 `write`를 한 덩어리로 되돌리지 말 것 (Phase 61e)**: `delete` 요청에는
  **`request.resource`가 없다**(쓰이는 객체가 없으므로 null) → `request.resource.size`를 읽는 조건이
  **오류로 평가되어 거부**된다. `lib/storage.ts`의 `deleteUploadedFile`이 best-effort 호출이라
  **조용히 100% 실패한다**. 그래서 `allow create, update` / `allow delete`로 갈라 두었다.
  ⚠ `delete` 조건이 `request.auth != null`뿐인 것은 완화가 아니다 — `create,update`가 이미 같은 조건이라
  로그인 사용자는 남의 객체를 덮어쓸 수 있었다. 경로에 uid가 없어(`problems/{problemId}/…`) 소유자 단위로
  좁히려면 경로 설계부터 바꿔야 한다. ⚠ `deleteProblem`(lib/firestore.ts)은 **Firestore만** 캐스케이드하고
  Storage를 건드리지 않는다 — 고아 파일은 호출부가 지운다
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
- **명암비 계산은 `((c+0.055)/1.055)^2.4`** — `/1.055`를 빠뜨리면 판정이 뒤집힌다. 실배경은 흰색이 아니라 클레이 3종(`--bg-content #F4EFE7` / FolderView 카드 `--block-bg-active` / 공유뷰 `--bg-card #FEFDFB`)이고, **구속 조건은 가장 어두운 카드 배경** 하나다 (Phase 58 D3). ⚠ **Phase 62부터 `#E8DFCE`는 FolderView 카드의 *hover* 배경이다**(정지 상태 카드는 `#F4EFE7`로 밝아졌다) — 최악값이 그대로라 아래 재계산값은 전부 유효하지만, **hover를 `#E8DFCE`보다 어둡게 내리면 계산이 통째로 무너진다.** ⚠ **그 값은 `#E8DFCE`다 — `#EDE6DA`가 아니다**(커밋 `78a780f`이 토큰만 옮기고 문서를 안 고쳐 Phase 58·59 문서가 한동안 stale했다. Phase 59a C1에서 전량 정정). 재계산값: `--case-dot` 3.28 / `--tone-dim` 4.76 — 둘 다 통과하지만 dot의 여유는 0.28뿐이다
- **수식 색은 `.tone-baseline :where(.katex)`가 소유한다**: 조상에 `color`를 줘도 수식엔 닿지 않으므로 `.katex`를 **직접 겨냥**해야 한다 (Phase 58 D3'). ⚠ `.problem-content-toned .katex`는 `font-size`만 준다 — 색은 Phase 58에서 `.tone-baseline`으로 분리됐다(오래 stale했던 기술, Phase 59a G9에서 정정)
- **특이도는 "그 규칙이 이기는가"가 아니라 "그 규칙을 이겨야 하는 규칙들이 여전히 이기는가"까지 봐야 한다 (Phase 59a F1)**: 톤 dim이 기준선과 동률이 되자 dim을 `.solution-tone.solution-tone`으로 **올리는** 처방이 나왔는데, 그 순간 dim을 되이겨야 하는 복귀 규칙들(`strong .katex`·`h1~h3 .katex` = 둘 다 (0,2,1))이 (0,3,0)에 져서 **강조 안 수식과 제목 안 수식이 dim으로 죽는다**(클래스 수가 자릿수보다 먼저다). 답은 반대 방향 — 기준선을 `:where()`로 (0,1,0)까지 **내리는** 것이다. 올리는 쪽은 파급이 번지고 내리는 쪽은 나머지를 그대로 둔다. `:where()`는 이미 무방비로 쓰는 `:has()`보다 지원이 넓어 추가 가드가 필요 없다
- **강조 톤 시스템 (Phase 58 P2 · Phase 59a 기본화)**: 강조 마커는 인라인 `**` **하나뿐**이다. 들여쓰기 블록(callout)은 위치만 담당하고 톤과 무관하므로 `.callout-block`에 톤 규칙을 두지 않는다(D13). ⚠ **Phase 58의 D4("`**`가 없는 풀이는 미발동" = opt-in)는 Phase 59a에서 폐기됐다** — 마커 유무가 문항 인상을 좌우해 들쭉날쭉했고 레거시 `**Case n.**`의 `**`가 강조로 오인돼 톤이 제멋대로 켜졌다. 이제 풀이 탭이면 **항상** dim이고 `.has-key` 클래스·`solutionHasKey`·`KEY_STRONG_RE`가 전부 사라졌다. 스코프는 `tabId !== 'question'`(D9) — 판정은 `lib/keyTone.ts`가 5개 사이트에 공급한다. 톤 기준선 색은 `.tone-baseline`에 있고 `.problem-content-toned`는 타이포만 담는다(D14 — 공유뷰에 후자를 통째로 붙이면 `letter-spacing`이 딸려와 공개 페이지 줄바꿈이 바뀐다). **인쇄는 의도적 예외**: 전체 100% 톤 복원 + key만 굵게(D6)
- **KaTeX 글리프는 조상의 굵기를 상속하지 않는다**: katex.min.css `.katex { font: normal 1.21em … }`의 `font` shorthand가 `font-weight`를 normal로 리셋한다. 그래서 "가짜 볼드"는 애초에 생기지 않고, 반대로 **key 안 수식은 굵게 만들 수 없다**(색으로만 구분된다)
- **아이콘 체계는 Phosphor regular 단일이다 (M4)**: 도안은 생성 파일 `components/ui/phosphorPaths.ts`(49종 · viewBox 256 · fill `currentColor`)가 공급하고, 진실은 `scripts/gen-phosphor-paths.mjs`의 ICONS 표 하나다 — 생성 파일 **수동 편집 금지**(`icons:gen` 재생성), `prebuild`의 `icons:check`가 드리프트를 빌드 실패로 만든다(**바이트 diff라 헤더에 생성 시각을 넣지 않는다**). 획은 weight 파일이 정하고(CSS·strokeWidth로 못 바꿈) **켜짐은 fill weight**(IconPin). **최소 렌더 14px** — † 예외 8곳(FolderPathBar 10×2 · MiniShell·ShareTree·ProofreadResultBox·탭 hover×2 11 · AIBrandIcon 12)은 검수 통과로 regular 유지, **유지 예외 4종**(`IconSave` 자체 도안·`checked` prop / `IconGoogle` / `IconGithub` / AI 로고 `<img>`)과 별칭 2개(`IconDots`=`IconDotsVertical` — 옛 도안도 세로 점이었다 / `IconSearchPlain`=`IconSearch`). Row 2는 전 버튼 20px(획 1.25px)·**코너 브라켓 폐기** — 브랜드 모티프는 로고·favicon·빈 화면에만. **별도 `.svg` 파일로 빼면 `currentColor`가 끊긴다.** `IconButton`의 hover는 배경만 바꾸고 색은 `active`일 때만 액센트로 간다(Phase 58 P3 — active 배경은 M4에서 accent 틴트). ⚠ **아이콘·컴포넌트 미사용 판별은 `grep -rnw`(단어 경계)로 — JSX 태그 검색 금지**: 트리거 맵·`ComponentType` 값 참조를 놓친다(`VersionTimeline.TRIGGER_ICON`의 `IconExit`가 실제로 두 판본 연속 오판돼 삭제 직전까지 갔다, M4 N8)
- **폴더 아이콘은 Phosphor 카탈로그다 (M5)**: `Folder.icon` = Phosphor 이름(`^[a-z0-9-]+$` — 옛 유니코드 값은 기본 아이콘으로 표시, 데이터 무접촉 N4). 규칙은 `lib/folderIcon.ts`(import 0 · `test:foldericon`)가, 렌더는 `components/ui/FolderGlyph.tsx` 한 벌이 소유한다(소비처 8곳 — **삼항식 사본 금지**). 기본 3종: 최상위 `folder` · 하위 `folder-simple` · 펼침은 depth 무관 `folder-open`(`folder-simple-open`은 core에 **없다**). **활성 행만 bold** — 글자 700과 같은 조건. 카탈로그 자산은 `icons:assets`가 `public/icons/phosphor/<ver>/`에 3,024개 복사(gitignore · `predev`·`build`가 생성 — **Vercel Build Command가 `next build` 직접 지정이면 전부 빈칸**). 렌더는 `PhAsset`(CSS **mask** + `background-color: currentColor`) — "별도 `.svg`는 currentColor가 끊긴다"는 `<img>` 얘기이고 mask는 유지된다. 단 **UI 상시 아이콘에는 mask 금지**(그쪽은 인라인 path — 첫 페인트 fetch 0). mask 404는 무이벤트 빈칸 — 방어는 쓰기(피커가 인덱스 이름만)·읽기(정규식 불일치 → 기본)에서, core 버전업 시 `--assets`가 사라진 이름 diff를 경고한다. 피커(`PhosphorIconPicker`)는 regular만·brands 78종 제외(상표)·한글 검색은 `lib/phosphor-ko.json`(없어도 영문 동작). **본문(raw_text)에는 아이콘·이모지 렌더 계층이 없다** — M5가 Twemoji를 전면 철거해 이모지 문자는 OS 글꼴로 보인다(N8). Phosphor 코드포인트는 PUA라 본문 문법을 만들지 말 것
- **제3자 시각 자산 고지 준칙 (M5 D11)**: ① 들일 때 `THIRD_PARTY_LICENSES.md`에 라이선스 전문 ② 배포 산출물에 고지 동봉(생성 파일 헤더 · 정적 디렉터리 `LICENSE`) ③ 설정 "정보/라이선스"에 한 줄 ④ 크레딧 의무형(CC BY 등)은 ③ 필수, MIT형은 ①②로 충족 ⑤ **상표(브랜드 로고)는 사용자 선택 목록에서 제외** ⑥ 버전은 lock 고정 + 경로에 버전 ⑦ **자산을 그만 쓰면 고지도 같이 거둔다**(Twemoji CC BY 문단을 M5에서 삭제한 근거)
- **마커 굵기 규약은 "화면 inherit · 인쇄 600"이다 (M1 E)**: `(가)`·`ㄱ.`은 Phase 60이, `①`은 M1이
  같은 처방을 받았다 — `globals.css`의 `.preview-content .marker-*  { font-weight: inherit }`가
  PrintStyles에서 새어 드는 600을 화면에서만 되돌린다. **인쇄가 굵은 것은 의도된 예외다.**
  ⚠ `PrintStyles.css`는 인쇄 전용이 **아니다** — `EditorView.tsx:56`이 import해 앱 전 화면에 로드된다.
  접두 없는 규칙은 곧 화면 규칙이므로, 이 파일에 규칙을 더할 때는 `.print-body` 접두가 필수다
- **`\tag` 세로 앵커는 단일행/다행이 다르다 (M1 D16)**: `bottom: 0.79em`은 다행(array·aligned)에
  맞춘 값이고 단일행에서는 번호가 9.8px 떠 있었다(CDP 실측). 단일행은 `0.13em`으로 따로 잡는다.
  ⚠ 판별자는 **`.mtable`**이다 — `.vlist`로 가르면 `\frac` 하나만 있어도 단일행이 오판된다
- **GFM 표 셀의 파이프는 실측으로만 규칙을 세울 것 (M1 W1)**: bare `|`는 셀을 쪼개 표·수식을 파괴하고,
  `\|`는 셀을 살리면서 **수식 노드에 `\|` 그대로** 전달되며(‖), `\\|`는 다시 셀을 쪼갠다.
  → 수식 **안** bare `|`는 `\vert`, **밖**은 `\|`, 기존 `\|`는 그대로. **`\\|`를 만들지 말 것**
- **`array`·`tabular`의 열 지정은 정규식으로 자르지 말 것 (M1 W2)**: `\{[^}]*\}`는 `{|p{2cm}|l|}`에서
  `{|p{2cm}`까지만 먹고 `|l|}`를 본문에 남긴다 — `\begin{array`가 이미 사라져 잔재 검사도 발동하지
  않는다. `lib/latexScan.ts`의 `readGroup`·`skipEnvArgs`(중괄호 균형 스캔)를 쓰고, 실패하면 변환하지 말 것
- **본문의 `C1`·`C2a`는 `convertCaseRefs`(`lib/caseBlock.ts`)가 `.case-ref`로 감싼다 (M1 G)**:
  굵기만 올린다(색·크기 불변). ⚠ **보호는 그 함수가 자체 수행**한다 — `preprocessLocale`은 사본이
  둘인데 코드펜스 보호(`protectFences`)는 `EditorPreview` 쪽에만 있어 인쇄 경로가 무방비다.
  ⚠ `chatExtract.MARKER_LITERAL`에 `case-ref`를 넣지 말 것 — 그 목록은 "뒤 공백 한 칸 복원"이라
  `C1에서`가 `C1 에서`로 샌다
- **수식행 분할(⌘⇧L)의 결과는 들여쓰기(callout) 블록이다 (M1 A)**: 행마다 `$…$` 한 줄이고
  **소스에는 빈 줄이 없다**. 행 분리는 `insertMarkerLineBreaks`가 공급한다 — **연속된 수식 전용 행**
  (`MATH_ONLY_LINE_RE`, 보호 후 `⟦MATH_n⟧` 모양을 본다) 사이에 렌더 시 빈 줄을 넣는다.
  그 장치가 없으면 `remark-breaks` 부재로 세 행이 한 문단이 되고 `\tag` 꼬리표가 겹친다.
  ⚠ `convertTextTags`가 `\s*$`를 쓰던 동안 그 빈 줄을 도로 먹었다 — **`\tag`로 끝난 문단이 다음
  문단과 합쳐지던 잠복 버그**였고 M1에서 `[ \t]*$`로 고쳤다(Phase 57 규약의 재확인).
  `\tag{n}`은 `$…$` **밖**으로 뺀다 —
  KaTeX는 인라인 모드 `\tag`를 거부한다. ⚠ **자기 타입 변경은 `text`·`callout`에만** — `case` 계열의
  타입이 사라지면 rail·자동 번호가 바뀐다

## 현재 PDF 규격

- 용지: A3 세로 (297 × 420mm)
- 여백: 상하 30mm, 좌우 20mm
- 본문: 2단, 단 간격 10mm, column-fill: auto
- 부가 요소 없음 (구분선, 머리말, 꼬리말, 페이지 번호 미구현 — CSS 인쇄 한계)
- **iframe이 아니다** — `lib/pdfPrint.tsx`가 숨은 div에 렌더 → `.print-root`를 `document.body`에 직접 붙여 `window.print()` (시스템 다이얼로그 직접 호출, 미리보기 창 없음). ⇒ **globals.css가 인쇄 노드에도 전부 적용된다**

## 블록 타입

`text · heading · list(목록) · callout(들여쓰기) · coach_important · coach_caution(코칭) · case(경우) · subcase(하위 경우) · gana · roman · box · choices · image · svg · ggb`
(+ 레거시 `math_block`·`bullet` → text로 정규화)

- **강조의 네 축은 독립이다 (Phase 58 D13 → Phase 59a 확장)**: `callout`(UI 이름 **'들여쓰기'**)은 **위치**, 인라인 `**`는 **색·굵기**, `coach_*`는 **신호**, '요약에 넣기' 스위치는 **요약 구성**. 넷은 서로 무관하고 겹쳐 써도 된다. ⚠ **'강조'라는 낱말은 이제 `**` 하나만 가리킨다** — Phase 58까지 블록 이름('강조문')과 마커('핵심문장')가 서로의 영역을 침범해 무엇을 쓰면 무엇이 나오는지가 흐려졌다. 레이아웃 장치에 '강조'를 다시 붙이지 말 것. display 수식 `$$…$$`은 블록 문법이라 `**`로 감쌀 수 없으므로, 톤 강조가 필요하면 인라인으로 바꿔 `**$…$**`로 쓴다(인라인 수식에도 `\displaystyle`이 자동 주입되므로 조판은 그대로다). 들여쓰기까지 원하면 그 행을 callout에 둔다

- **코칭 블록 (Phase 59a)**: `coach_important` · `coach_caution`. GitHub alert의 시각 문법(왼쪽 색 바 + 아이콘 + 라벨)을 **블록 타입**으로 가져왔다 — `> [!IMPORTANT]` 인라인 문법은 지원하지 않는다(블록이 편집 단위이므로 **타입이 의미를 나른다**). 라벨은 raw_text가 아니라 렌더가 붙인다(경우 번호와 같은 방침) → `lib/coachBlock.ts` + `components/ui/CoachLabel.tsx`를 5사이트가 공유한다. 색 `--coach-important #6639ba` / `--coach-caution #a40e26`은 GitHub light 기본값이 카드 배경에서 3.81·4.05로 **텍스트 4.5:1에 미달**해 한 단 진한 700 계열로 올린 값이다. ⚠ 코칭 색과 dim 본문(`#675F52`)의 대비는 **1.2:1뿐** — 라벨 식별은 색이 아니라 **아이콘 + 600 굵기**가 담당한다. ⚠ 상자 안쪽 패딩(1em)은 **들여쓰기가 아니라 상자의 내부 여백**이다(글상자 3종의 전례). 바깥 좌단은 본문 0이라 경우 사이에 끼어도 rail(-1.8em)과 겹치지 않는다
- **타입 추가는 배선이 거의 없다 (Phase 59a C15 실측)**: 블록 기계장치가 전부 타입 키라, 코칭 2종을 넣는 데 든 것은 **타입 union 1줄 + `EditorView` 상수 4곳 + 렌더 5사이트 + CSS 2곳 + 아이콘 2개**가 전부였다. `normalizeBlockType`·`EmptyBlockChips`·사이트별 `BORDERED_TYPES` 사본 4개·`exportMd`(타입을 `<!-- block: {type} -->`로 흘린다)는 **무변경**. Firestore 규칙 0 · 마이그레이션 0 · 서버 0
- 상수 6종은 전부 `EditorView.tsx` 상단(BLOCK_TYPE_LABELS · BLOCK_TYPES · BLOCK_PRESETS · TEXT_BASED_TYPES · SPLITTABLE_TYPES · BORDERED_TYPES). ⚠ **`BORDERED_TYPES`만은 사본이 4개 더 있다**(TabBody · FolderView · ProblemTabContent · PrintableContent) — "6종은 전부 상단"이라는 문장의 유일한 예외다
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
- **구조 신호는 거터, 본문은 본문 (Phase 59a §1 → ProblemView 디자인 개선 R1~R3에서 개정)**: rail·dot은 본문 **왼쪽 바깥**에 있고 경우 본문의 좌단은 **일반 텍스트와 같은 0**이다. ⚠ **chevron은 사라졌다** — 요약 보기의 여닫이 노브를 제목 줄·경우 줄 **둘 다** 없애면서 `--case-chevron-x`도 삭제했다(소비처 0 토큰 금지). 이제 거터에 사는 것은 rail·dot 둘뿐이라 **서로 간섭하지 않는다**. 좌표는 `--case-rail-x(-1.3em)` 하나이고 인쇄만 `-1.2em` 리터럴이다(화면이 인쇄에 가까워진 방향). dot 좌단 = `rail_x - 0.26em` = **1.56em**. ⚠ **거터는 이제 카드 *안*에 있다** — `CARD_PAD_L_EM 2.6`이 1.56em을 품고 1.04em이 남는다. 그래서 `LABEL_GAP_EM`은 rail 통로가 아니라 **순수한 시각 간격**이고(2.8 → 1.4로 절반), 각 렌더 사이트가 `overflow:hidden` 밖에 거터를 확보할 필요도 없어졌다. Phase 59가 세웠던 2단 들여쓰기(본문 3em/하위 6em/그 안 6·9em, `.case-gap-body`, 경우 안 ul·① override)는 **전량 철거**됐다 — 전례를 찾아 되살리지 말 것
- **경우 블록 안은 최상위와 **완전히** 같다 (Phase 59a)**: 본문 0, display 수식 3em, 리스트·① 밭은 각자의 기본값. override가 하나도 없다. 어긋나 보이면 최상위 규칙을 봐야 한다. **좌표는 `padding-left`로 줄 것** — `margin-left`를 쓰면 rail을 그리는 박스가 통째로 밀려 세로선이 엉뚱한 자리에 하나 더 생긴다
- **em/px를 섞으면 글꼴 크기에서 무너진다 (Phase 59a C5 → ProblemView 디자인 개선 F1에서 재발)**: 같은 함정을 **두 번** 밟았다. ① Phase 59a: chevron 아이콘만 고정 px이라 11px에서 dot과 겹쳤다(노브가 사라져 지금은 무효한 기록). ② **카드 좌측 패딩만 px(40) 고정이고 rail 좌표는 em이라, 글꼴을 *키울수록* rail이 카드 밖으로 걸어 나갔다** — 실측 rail 11/15/24px = 20.2 / 13.0 / **−3.2**(카드 밖), dot 좌단은 24px에서 **−9.4**. `CARD_PAD_L/R`을 `_EM`(2.6/2.4)으로 바꿔 고쳤고 지금은 15.3/20.5/32.2px(1.34~1.39em)로 수렴한다. **좌표를 손대면 반드시 11 / 15 / 24px 세 조건 전부 실측할 것** — 15px 하나만 보면 두 번 다 통과한다. 같은 이유로 `LABEL_GAP`도 `× contentFontSize`다
- **FolderView 카드는 rail·dot을 그리지 않는다 (Phase 59a Q5)**: 카드 본문 `.problem-content-scaled`가 `overflow:hidden` + 좌측 패딩 0이라 거터에 그린 것이 통째로 잘린다. 그 overflow는 잘림 연출·페이드의 기준이라 못 없애고, 패딩을 주면 경우 블록이 없는 절대다수 카드까지 밀린다 → `.problem-card` 스코프 3줄로 `content: none`. **5개 렌더 사이트 중 여기 하나만의 예외다 — 확대 적용 금지**
- **상태를 나타내는 색은 3:1을 넘겨야 한다 (Phase 59 G1)**: 경우 dot은 `--case-dot`(= `--mathory-red-dark #BC5F3F`, 카드 배경 `#E8DFCE`에서 **3.28:1** — 여유 0.28). 로고 레드 `#D97757`은 미달이라 못 쓴다. 텍스트가 아니어도 상태 표시기면 이 기준이 걸린다

## 현재 Phase: **개선묶음 M5 — 이모지(Twemoji) 폐기 · 폴더 아이콘 Phosphor 카탈로그** — 구현·**검수 완료(2026-09-06, Q1~Q7 전항 정상)** · 배포 대기(push는 덕수)

문서: `docs/phasedocs/개선묶음 M5 이모지 폐기·폴더 아이콘 Phosphor 카탈로그 Final_V3 실행판.md`
(계보: 덕수 메모 → v1 web → 덕수 확정 N1~N8 → **v2 CLI 실측**(정정 E1~E4 · 보완 G1~G6 · 덕수 확정 N9~N11) → **Final_V3 = 실행판**(§11이 구현·검수 기록). 중간 판본 v1·v2는 phaseSketch)

Twemoji 전면 철거(파일 3 삭제 · EditorPreview·PrintableContent 플러그인 · pdfPrint 대기 ·
globals.css · CC BY 고지 · 의존성 2) + 폴더 아이콘 Phosphor 카탈로그 피커 + Agent 라벨
3곳 → `lego-smiley` + AIBrandIcon 폴백 `robot`(+ ai-models 기본 avatarEmoji `''` = D15).
**서버 0 · 규칙 0 · 스키마 0 · 전처리 0 · raw_text 0.** 신규 4(`lib/folderIcon.ts` ·
`FolderGlyph.tsx` · `PhosphorIconPicker.tsx` · `lib/phosphor-ko.json` 1,414종) · 커밋 7(S1~S7) ·
로직 검증 356 → **365건**(`test:foldericon` 신설). **규약은 위 "폴더 아이콘은 Phosphor
카탈로그다" · "제3자 시각 자산 고지 준칙" 절이 소유한다.**

- 덕수 검수 완료(2026-09-06): Q1~Q7 전항 정상. 반영 1건 = agent 드로어 1행 제목에
  `IconAgent 16`(댓글 모드 `IconComment 16`과 대칭, S8). 남은 것: git push(덕수) 후
  Vercel 로그 `[icons:assets] OK — 3024개` 확인 · phasedocs 이관
- ⚠ v2 최대 수확: **D9가 죽은 코드였다(E1)** — `ai-models.ts`가 avatarEmoji를 `'🤖'`로
  기본 채움해 "없으면 IconRobot" 갈래가 절대 발화하지 않았다. 기본값 `''`(D15)이 전제
- ⚠ v1이 놓친 세 번째 폴더 트리 `FolderPickerDialog`(아이콘 0) → N10으로 FolderGlyph 편입

### 이전: **개선묶음 M4 — 아이콘 체계 Phosphor 전환** — 구현·검수·**배포 완료(2026-09-06)**

문서: `docs/phasedocs/개선묶음 M4 아이콘 체계 Phosphor 전환 Final_V4 실행판.md`
(계보: 덕수 결정 메모 → v1 web → v2 CLI 실측 → v3 web 재검증·덕수 확정 → **Final_V4 = 실행판**(§10이 구현·검수 기록, §9가 판본 정정 요약). 결정 D1~D23·N1~N8 전항 닫힘)

`Icons.tsx` 38종 Phosphor regular 전환(미사용 10종 삭제) · Row 2 브라켓 폐기·전 버튼 20px ·
라이브러리 밖 사본 정리(ContextMenu·ShareButton·CommentEditor OCR/그림·BlockBottomToolbar) ·
12~13px 22곳 → 14 상향. **서버 0 · 규칙 0 · 스키마 0 · 전처리 0 · 로직 테스트 356건 무접촉.**
신규 2(`scripts/gen-phosphor-paths.mjs` · `components/ui/phosphorPaths.ts` 생성물) · 커밋 6(S1~S6) ·
전체 707+/812−. **규약은 위 "아이콘 체계는 Phosphor regular 단일이다" 절이 소유한다.**

- ⚠ 판본 왕복 최대 수확: **JSX grep 미사용 판정이 두 판본 연속 틀렸다**(`IconExit` —
  `VersionTimeline.TRIGGER_ICON` 맵이 컴포넌트 **값**으로 참조). 단어 경계 grep 규약(N8)의 출처이고,
  실행했으면 컴파일이 깨졌다. `IconExit`는 삭제 대신 `sign-out`으로 전환(D23)
- ⚠ **`IconDots`는 이름과 달리 도안이 세로 점이었다**(D22) — `dots-three`(가로)로 잘못 대응할 뻔한
  자리. `dots-three-vertical`로 통합하고 별칭만 남겼다
- 덕수 실물 검수(2026-09-06) 전항 통과: † 잔존 8곳 regular 유지(bold 예외 0) · Σ=`sigma` 채택
  (M3 자체 Σ 폐기) · 블록 수식 = 비등방 x0.62 채택 · `split-vertical`(블록 분할)·`rows`(수식행 분할) ·
  Row 2 20px · IconTextWidth 24 정방
- Q7 확인 완료(2026-09-06): 배포 빌드 로그에 `[icons:check] OK — 49종` 실측 — `prebuild` 배선이 Vercel에서 실제로 돈다(드리프트는 이제 빌드 실패다)

### 이전: **Phase 63 — FolderView 리스트·칼럼 체계 · 앱 전역 DnD** — 구현·검수 완료 · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/Phase63 FolderView 리스트·칼럼·앱 전역 DnD Final_V4 실행판.md`
(계보: 덕수 구상 → v1 web → v2 CLI 실측 → v3 web 재검증 → **Final_V4 = 실행판**(§8이 구현·검수 기록, 계획 개정 G1~G7). Q1~Q18 전항 판정 완료)

기본 보기 리스트(비영속) · 칼럼 체계(고정 2+선택 5, 폴더별 저장) · 하위 폴더 행 · 헤더를
제목바 행 2로 · 앱 전역 DnD 1컨텍스트 · 다중 선택 일괄 이동 · 사이드바 들여쓰기 정리.
**서버 0 · 규칙 0 · 스키마 0 · 전처리 0 · 렌더 5사이트 0.** 신규 3(`lib/listColumns.ts` ·
`hooks/useListPrefs.ts` · `components/ui/dnd.tsx`) · 커밋 13. 로직 검증 341 → **356건**(`test:list` 신설).

- **⚠ DnD 컨텍스트는 AppShell 하나뿐이다** — Sidebar·FolderView에 DndContext를 되살리지 말 것
  (EditorView 블록·UserGroupEditor는 별개 중첩 컨텍스트로 무해). 규약 4종: ① 소스·타깃 data에
  **`type` 필수**(problem/problems/folder/unassigned/trash — 핸들러가 type으로만 분기, id 파싱 금지)
  ② id는 `dndId` 네임스페이스(사이드바 폴더 sortable만 맨 folder.id — SortableContext items 앵커)
  ③ 충돌 판정 분기 기준은 "결과가 비었나"가 아니라 **`pointerCoordinates` 유무**(포인터=pointerWithin만
  → 빈 곳 드롭 무동작 / 키보드=rectIntersection). folder 드래그는 `data.sortable` 필터 closestCenter
  ④ 드래그 종류는 `DragKindContext`로 읽을 것 — **`useDndContext()` 금지**(매 move 리렌더 = 61c
  "리렌더 자체가 버그"의 드래그판). `onDragOver`·전역 over 상태도 같은 이유로 금지
- **⚠ 드롭 하이라이트는 링+틴트, border 불변**(`DROP_RING`/`DROP_TINT`) — 조건부 border는 over
  순간 행이 자란다(실제 결함이었다). 드래그 소스 스프레드에서 **`onKeyDown` 활성자 제외**(전역
  KeyboardSensor가 포커스된 카드에서 Space 드래그를 시작한다)
- **⚠ 이동은 `updated_at`을 찍지 않는다(Q14)** — `moveProblemToFolder`·`moveProblemsToFolder`·
  `deleteFolder`의 미분류 이동 전부. **예외는 휴지통행뿐**(`moveToTrash` · `moveProblemsToFolder`의
  TRASH 타깃 — 함수 내부 규칙, 호출부 분기 금지): 휴지통에서 updated_at은 "버린 시각"이고
  휴지통 기본 정렬(updated desc, D41)이 그 값을 읽는다
- **⚠ 리스트 행 정렬은 CSS scroll-snap이 아니라 scrollend JS다(G1)** — proximity·mandatory 둘 다
  실기기 macOS 트랙패드에서 **완전 무동작**이었다(CDP 합성 휠 프로브에서는 정상 — 실기기 스크롤
  경로의 브라우저 동작). FolderView의 scrollend 핸들러가 `[data-snap-row]`의 가까운 행으로 smooth
  정렬(바닥에서는 위로 당김 — ListView paddingBottom 72가 그 슬랙). **CSS 스냅 재시도 금지.**
  상단 8px sticky 마스크가 이전 행 꼬리를 가린다(Phase 62 D7 함정의 재확인 — 패딩 띠로 되돌리지 말 것)
- **⚠ 칼럼 폭의 진실은 본문 grid 루트 하나다(D43)** — 헤더(제목바 행 2의 `ListHeader`)는
  `getComputedStyle(루트).gridTemplateColumns` 실측값(px 목록)을 소비한다. **subgrid 행에서 읽으면
  `"subgrid …"`가 온다 — 루트에서만.** 자동폭이 헤더 라벨 폭을 포함하는 것은 본문의 **유령 라벨
  행**(높이 0·불가시) 덕이다 — 지우면 헤더가 잘린다. 좌우 인셋 14 = 가장자리 2px 스페이서 트랙 +
  columnGap 12(subgrid에 컨테이너 패딩 금지 — 첫·끝 트랙이 부모와 어긋난다)
- **⚠ 칼럼 규칙은 `lib/listColumns.ts`(import 0 · `npm run test:list`)가 소유** — prefs 스키마는
  "모르는 id 무시, 새 id 뒤에 붙임"(후속 칼럼이 저장값을 깨지 않는다). verifyRank의 verdict 순서는
  `VERIFY_VERDICT_META`와 의도적 이중(import 0) — **어휘 추가 시 양쪽 함께**. prefs 저장 키
  `mathory.listPrefs.<folder.id>`(공유 뷰는 `__shared_with_me__`/`__sent__` 단위 병합 — Q16)
- **⚠ 제목행 sticky 래퍼는 철거됐다(D42)** — 헤더가 스크롤 밖(제목바 행 2)이라 "행이 헤더 위로
  비칠 통로" 자체가 없다. 아래 Phase 62 A축의 sticky 래퍼 서술은 옛 기록. 하위 폴더 칩은 카드 모드
  전용이 됐고, 리스트의 하위 폴더는 폴더 행(아이보리 무테두리 — "클레이 = 문항"의 귀결)이 담당
- **체크박스류 accentColor는 로고 레드**(`--mathory-red`, 덕수 지정 — 칼럼 설정·선택·전체선택).
  Agent 칼럼 셀은 숫자만(라벨은 헤더 몫). zebra는 `--row-alt`(#F8F4EE, Q13=C) — 렌더 인덱스로
  `.is-alt` 부여(`:nth-child` 금지 — 마스크·폴더 행이 형제로 섞여 패리티가 어긋난다)

### 이전: **개선묶음 M3 — 아이콘 정비 · 버그 수정 · 기능 개선** — 구현·검수 완료(2026-09-05) · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/개선묶음 M3 아이콘 정비·버그 수정 Final_V4 실행판.md`
(계보: 덕수 메모 → v1 CLI 실측 → v2 CLI 확정 → v3 web 검증 → **Final_V4 = 실행판**(§4가 구현·검수 기록). §4-2의 시각 최종값이 계획서 수치를 이긴다)

버그 2(요약보기 여닫이 떨림·'앞부분 펼치기' 헛표시) + 아이콘·컨트롤 5 + KaTeX 분수 조판 1.
**서버 0 · 규칙 0 · 스키마 0 · 전처리 파이프라인 0.** 신규 3(`lib/katexMacros.ts` ·
`components/editor/toolbarIcons.tsx` · `components/ui/SizeStepper.tsx`) · 커밋 12(구현 7 + 검수 5).
로직 검증 336 → **341건**. `\[..\]→$$` 통일 항목은 **이미 구현돼 있어 작업 0**(정규화·[교정]·렌더 세 겹).

- **⚠ `.outline-section`의 상하 패딩·섹션 간 마진은 상시다(D7′)** — is-open 조건부로 되돌리지
  말 것. 조건부면 여는 순간 섹션이 자라는데, 상하 패딩이 마지막 자식의 bottom margin을 안에
  가둬(**마진 붕괴 반전**) 성장량이 일정하지도 않고, 그 밀림을 `useOutlineState`의 스크롤 앵커가
  보정하며 "위쪽 내용이 밀리는" 떨림이 된다. 음수 마진 상쇄로는 붕괴 반전이 안 돌아온다(web v3 검증)
- **⚠ 전문(前文) 여닫이 판정은 `needsPrefaceToggle`(lib/solutionOutline)이 소유한다** —
  JSX 안 조건은 어떤 테스트도 못 본다. 명세(D9=(b), 덕수): 요약 항목이 있고 **항목으로 닿을 수
  없는 블록**이 있을 때만. items 없는 전문은 숨은 블록이 있어도 조용("요약은 요약일 뿐").
  경우 구역·경우 body는 경우 클릭 담당이라 숨은 것으로 치지 않는다
- **⚠ KaTeX `macros`는 팩토리(`katexMacros()`)로만 넘길 것** — KaTeX는 macros 객체를
  **in-place 수정**한다. `\gdef` 렌더 후 객체에 정의가 실제로 잔류하는 것을 프로브로 증명했다.
  모듈 상수로 바꾸면 콘텐츠의 `\gdef`가 문항 사이로 샌다
- **분수 조판은 CSS·매크로가 짝이다**: 가로바 연장은 `globals.css`(`--frac-ext`/`--frac-nest`,
  의도적으로 `.preview-content`로 안 좁힘 — 검증 카드·폴더뷰 분수도 받아야 조판이 안 갈린다) ·
  세로 여백은 `lib/katexMacros.ts` 팬텀. `\cfrac`는 자체 strut라 매크로 의도적 제외,
  검증 카드(`katex-render`)도 제외(\displaystyle 주입이 없어 이미 조판이 다른 자리).
  KaTeX 버전을 크게 올리면 선택자(`.mfrac > .vlist-t …`·`:has()`) 재확인
- ~~**툴바 아이콘 규격(`SVG_PROPS`·`CORNER_BRACKETS`)은 `toolbarIcons.tsx`가 소유한다**~~
  ⚠ **M4에서 규격이 Phosphor(256·fill)로 바뀌고 `CORNER_BRACKETS`·자체 Σ(획 5)는 삭제됐다** —
  파일 분리 이유(UnifiedToolbar→MathSymbolPalette 방향 import라 역방향은 순환)와 SigmaIcon
  소유는 그대로다. 현행 규약은 위 "아이콘 체계는 Phosphor regular 단일이다" 절
- ~~**`IconTextWidth`는 Icons.tsx 정사각 규격의 유일한 예외**(27×15)~~ ⚠ **M4에서 폐기 — 정방 24**.
  "꺾쇠와 물리 획 맞추기"는 stroke 전제라 fill 기반 Phosphor에서 성립하지 않는다
- **아이콘 시각 수치의 진실은 실행판 §4-2 표다** — 검수 5차 왕복 확정값. ⚠ 단 **아이콘 도안
  수치(시그마 획 5 · 세로바 0.9 · 27×15)는 M4가 대체**했고, 텍스트 라벨 수치(AA 19.5/500 ·
  Agent 13/500 등)만 유효하다

### 이전: **Phase 61f — 정밀 검증·agent 토론 그림 첨부** — 구현·검수 완료(2026-09-04) · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/Phase61f 정밀 검증·토론 그림 첨부 v3 실행판.md`
(계보: v1 web → v2 CLI 실측 교차검토 → **v3 착수판 = 실행판**(§9가 구현 기록·검수). web v3 재검증은 생략 — 덕수 판정)

Mathory의 AI 경로 두 개(정밀 검증·토론) 어느 쪽도 그림 바이트를 모델에 보내지 않던 것을
GAS 패치 12·13 이식으로 고쳤다 — 서버가 Storage 그림을 받아 Gemini `inlineData` ·
Claude `image` · OpenAI `input_image`로 첨부하고, 본문엔 `[그림 k]`, 꼬리말에 첨부·누락 목록.
**신규 2(`lib/verify/figures.ts` 순수 · `lib/figureFetch.ts` 서버) · 수정 8 · GAS/규칙/스키마/렌더 0.**
로직 검증 305 → **336건**. 덕수 검수 5항 전항 통과(그림 검증 실판정 · 3사 그림 기반 답 ·
메시지 그림 · 무회귀 · 61d empty_question 해소). 61e·61e-2차와 함께 **배포 완료(2026-09-06)**.

- **⚠ 핵심 불변식(D10): `images`가 비면 provider 요청 바디는 바이트 단위로 기존과 같다** —
  proofread·ai-complete·그림 없는 토론/검증이 전부 이 뒤에 있고 `aiProviderParams` 스냅샷이
  `===`로 고정한다. ⚠ `ParamOptions`(providerParams)와 `CompleteOptions`(ai-provider)는
  **별개 선언의 사본**이라 옵션을 더할 때 양쪽을 함께 고칠 것
- **⚠ 슬롯 모델은 `lib/verify/figures.ts`가 단독 소유한다**: 전송 자리표시자는 `[그림]`이 아니라
  **`⟦그림⟧`**(본문에 `[그림]`·`[그림N]`이 자연 발생한다 — Fig.N 변환 산물), 모델이 보는 최종형만
  `[그림 k]`. **번호 매기기는 프롬프트 문자열이 확정된 뒤**(자르기 포함) 한 번에(D19) —
  토론 클라(`buildContext`)가 15,000자 자르기 **뒤** 남은 자리표시자 수만큼 슬롯을 자르는 이유다
- **⚠ 등장 순서 ≠ 첨부 우선순위(R-3)**: 등장(=번호 k·첨부 순서)은 문항→히스토리→메시지,
  장수 상한(6장)에서 살아남는 우선순위는 문항→**메시지**→히스토리(최근 먼저)다. `planSlots`의
  priority 축이 이걸 나른다 — **두 축을 합치면 사용자가 방금 붙인 그림이 먼저 잘린다**
- **⚠ `isOwnStorageUrl`이 discuss 무인증 라우트의 유일한 SSRF 방어다**: 자기 버킷
  `problems/` 접두만 통과. 넓히지 말 것. GAS처럼 Drive 전역 이름 검색으로 폴백하지도 말 것
- **⚠ 어떤 그림 실패도 요청을 죽이지 않는다(D6)**: 항목별 누락 처리 + 꼬리말 고지 + 텍스트로
  계속. 검증 리포트 `note`에 누락 목록이 남는다(시트 Y열 fig_info의 등가물)
- **`hasImages`·`hasMedia`는 삭제됐다(D9)** — 3개 Phase 동안 "보내고 있다"고 믿긴 채 아무도 안
  읽던 필드. 되살리지 말 것. 그림뿐인 문항이 61d `empty_question`에 안 걸리는 것은 **의도된
  해소**다(`verifyBlocksOf`가 자리표시자를 세므로 — batchPlan 코드 변경 0)
- **알고 두는 손실(D20)**: 그림 지적 클릭은 블록 점프만 되고 글자 하이라이트가 없다
  (`findQuoteRange`가 raw_text(`<img …>`)에서 `[그림 k]`를 못 찾는다 — 버그 아님)
- **svg·ggb는 첨부하지 않는다(D5)** — `[그림 k — 첨부되지 않음: SVG/GeoGebra]` 자리표시자만.
  래스터화는 후속. `FIG_MIME_OK`에 gif가 없는 것은 Gemini 최소공통분모(Claude·GPT는 받는다)

### 이전: **Phase 61e-2차 — 그림 링크 이관(GAS 패치 11) 대응** — 구현·검수 완료(2026-09-04) · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/Phase61e-2차 그림 링크 이관 대응 v5 실행판.md`
(계보: v1 web → v2 web·GAS 재검토 → v3 CLI 원본 대조 → v4 web 검증 턴 → **v5 CLI 최종**. §10이 구현 기록)

Data_DS 본문의 그림 표기가 **`\includegraphics{파일명}` → `![파일명](Drive링크)`** 로 바뀐 것
(GAS 패치 11)에 따라간다. **두 형식 모두**를 그림 경계로 인식하고, 프록시는 **NFC/NFD 두 정규형**으로
Drive를 찾는다. **수정 3파일 · 신규 0 · 서버 신규 0 · Storage 규칙 0 · 나머지 전부 0.**
로직 검증 289 → **305건**. 61e 본체와 함께 **배포 완료(2026-09-06)**.
덕수 검수 완료(2026-09-04): 미리보기=저장본 · 구형 세트 무회귀 · 자동 수정 토글↔중복 배지 무관 **전항 통과**.
두 형식이 한 셀에 섞인 행은 **실데이터에 없었다**(논리는 테스트 F10이 고정한다 — 아래 ⚠ 참조).

- **⚠ 그림 표기 계약이 바뀌면 다섯 자리가 함께 움직인다**: `splitFigures` · `scanFigureNames` ·
  `applyAutoFix` 가드 · D3′/O열 경고 · 폴백 리터럴. 한 곳만 고치면 나머지가 조용히 어긋난다
- **⚠ Drive의 실제 파일명은 NFD가 절반이다** (실측: 고유 36개 중 **18개**). GAS는 **비교만 NFC로 하고
  기록은 원본명**이라(`링크&파일명 추출(키워드).gs:55` 주석) stem이 NFD면 fig 파일명도 NFD다.
  프록시가 NFC·NFD를 순차로 찾는다 — **NFD 폴백을 제거하지 말 것**(수정 전이라면 그 18개가 전부 400이었다)
- **⚠ `![](url)`을 경계에서 제외하던 61e D21은 뒤집혔다** — 그때는 옳았고(외부 핫링크 보존) 지금은
  그것이 곧 Drive 그림이다. `FOREIGN_IMG_RE`가 **Drive 링크가 아닌** 마크다운 이미지만 걸러 낸다
- **⚠ 두 형식이 한 셀에 섞일 수 있다 — 표본은 아직 못 봤다**: 패치 11은 M/N열에서 링크를 못 찾은
  태그를 `\includegraphics` 그대로 남긴다(`dlds_embedFigLinks_`). 2026-09-04 검수 시점 실데이터에는
  그런 행이 **0건**이었다(= 링크 짝이 온전했다). 통합 스캔을 **교대 정규식 한 벌**로 만든 이유가
  이 경우의 등장 순서라, 두 정규식을 따로 돌리는 형태로 되돌리지 말 것 — 테스트 F10만이 이 계약을
  지키고 있다

### 이전: **Phase 61e — 시트 가져오기 × 그림 블록 · 교정 연동** — 구현·검수 완료(2026-08-30) · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/Phase61e 시트 그림 블록·교정 연동 v5 실행판.md`
(계보: v1 web 타당성 → v2 CLI 실측 → v3 web 재검증 → v4 CLI 착수판 → **v5 실행판**. v5만 볼 것)

**Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 블록 타입 union 0 · 전처리 0 · 렌더 5곳 0.**
⚠ **Storage 규칙은 1건 변경**했다(아래). 신규 2 · 수정 5 · 커밋 6개. 로직 검증 262 → **289개**.

Data_DS 본문에 **파일명 문자열로만** 있던 `\includegraphics{<stem>_figN.jpg}`를 Drive
`PBMAI/IMAGE_FIG`에서 실물로 받아 image 블록으로 분할하고, 가져오는 김에 편집창의 결정적
자동 수정을 한 번 태운다.

- **⚠ 가장 값비싼 발견: 자동 수정이 LaTeX 제어열을 파괴하고 있었다** — 아래 규약 절 참조.
  이것을 고치는 것이 **커밋 1**이고, 그것이 그림 실패 폴백(리터럴 보존)이 성립하는 전제다
- ~~**⚠ `hasImages`는 죽은 필드다** — 정밀 검증 모델이 그림의 존재조차 모른다(알고 두는 손실)~~
  → **Phase 61f가 해결했다(2026-09-04)**: 필드 자체를 삭제하고 그림을 실물로 첨부한다. 위 현재 Phase 절 참조
- **D13 B열 복구**: GAS 정규화가 선택지 뒤 `\includegraphics`를 trailer로 잘라내 E에서 사라지지만
  원문인 B(`SHEET_COL.problem = 1`)에는 남는다. B에만 있는 이름을 문제 탭 맨 끝에 붙인다
  (실측: Data_DS 38행 중 그림 문항 10행, 복구 1행 = 1공통13)
- **배점 `[4점]`은 수식화하지 않는다 (2026-08-30 덕수 판정)**: `autoWrapBareNumbers`의 보호 목록에
  `/\[\d+점\]/`이 있다(`(n)` 참조 번호 보호 바로 옆). **편집창 [교정]의 동작도 함께 바뀐 것이며
  의도한 것이다** — 배점은 어떤 경우에도 수식이 아니고, 거의 모든 문항에 있어 일괄 가져오기에서
  전 문항에 박혔다. ⚠ 대괄호 안 공백은 허용하지 않는다(실데이터가 전부 `[4점]` 붙여쓰기) —
  넓히면 구간 표기 `[3, 5]`까지 먹는다(테스트 P-12가 그 경계를 고정한다)

### 이전: **ProblemView 디자인 개선(5건)** — 구현·검수 완료(2026-08-30) · **배포 완료(2026-09-06)**

문서: `docs/phasedocs/ProblemView 디자인 개선 v4 실행판.md`
(계보: 덕수 메모 → v1 CLI → v2 **두 판**(web 계획서 · CLI 교차검토판) → v3 착수판 **3회 개정**
 → **v4 실행판 = 구현 기록**. v4만 볼 것)

**서버 0 · Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 블록 타입 union 0 · 전처리 0.**
수정 5파일 · 신규 0 · 커밋 5개. 로직 검증 262개 무회귀.

M2 D가 만든 ProblemView를 실사용한 덕수 판정에서 출발했다 —
*"시각적 안정감이 줄어들어 보인다. 카드가 사라지고 나타나는 순간 화면이 튄다."*
그래서 방향이 **"튐을 보정한다" → "튈 일을 만들지 않는다"** 로 뒤집혔다.

- **P** 제목행 자동접힘·문제 카드 sticky/접힘 **통째로 철거**. 제목행 `height 57` 고정,
  문제 카드는 흐름대로 밀려 올라간다. ⚠ **최종 코드에 `scrollTop`을 읽고 쓰는 곳이 0이다**
- **P** **hold-to-peek** — 좌측 라벨 거터의 '문제' 알약을 **누르고 있는 동안만** 문제 카드가
  화면 중앙에(딤 없음·별도 팝업 크롬 없음·`--drawer-shadow`만)
- **Q** 풀이 카드 위 선·페이드 **폐기**(sticky 전용 처방이었다) → 제목행 상시 `borderBottom` 1줄
- **R** `--case-rail-x` −1.8 → **−1.3em** · `CARD_PAD_L/R` px → **em** · `LABEL_GAP_EM` 절반
- **S** 요약 보기 **여닫이 노브 전량 제거**(제목 줄 포함) + 톤 사다리(카드 → 펼침 1단 → hover 2단, 카드 전폭)

⚠ **계획을 뒤집은 것이 7건(R1~R7)** 있고 **그중 둘(R5·R6)은 계획서가 원본 메모를 좁힌 것**이다 —
v1~v3을 인용하기 전에 v4 §3을 볼 것.

### 이전: **개선묶음 M2(기능 개편 7건)** — 구현·검수·**배포 완료(2026-08-28)**

문서: `docs/phasedocs/개선묶음 M2 기능 개편 v4 실행판.md`
(계보: v1 web → v2 CLI 실측(v2.1·v2.2) → v3 web 재검증 → **v4 CLI 실행판 = 구현 기록**. v4만 볼 것)

**서버 0 · Firestore 규칙 0 · 스키마 0 · 배치 마이그레이션 0 · 블록 타입 union 0.** 커밋 20개 · 45파일.

- **A** 네이티브 팝업 56곳/14파일 제거 → `lib/dialogs.ts` 3종 + 폴더 픽커
- **B** 선택지 세로 정렬 `baseline → center`(실측 편차 9.33/12.81/20.91px → **0.00px**)
- **C** 참조 인용 hover 말풍선(`(가)`·`ㄱ`·`①`·`(3)`·`C1`) — 500ms 후 원문 문단
- **D** ProblemView 탭별 카드 · 가로폭 조절(35~45em) · ~~sticky 문제 카드 · 스크롤 자동접힘~~
  (⚠ 뒤 둘은 **ProblemView 디자인 개선에서 철거**됐다 — 위 절 참조. 되살리지 말 것)
- **E** 폴더뷰 카드보기 열수 제한 해제 · **F** 사이드바 자동접힘 제거
- **G** 코칭블록 'Tip' 단일화 + 기본 접힘
- **+** 좌·중·우 3단을 밝기 서열로 가름(계획에 없던 후속)

⚠ **계획을 뒤집은 것이 7건(R1~R7)** 있다 — v1~v3을 인용하기 전에 v4 §3을 볼 것.
로직 검증: 10종 **262개**(`test:dialogs` 6 신설 · `test:locale` 20→30).

### 이전: Phase 62(폴더뷰 구조 변경 · 좌우 사이드바 UI 통일) — 구현·검수·**배포 완료(2026-08-27)**

> ⚠ Vercel 배포 후 **Cmd+Shift+R로 하드 리프레시**할 것 — CDN 캐시 때문에 옛 CSS가 남는다.

- **Phase 61d(폴더 일괄 검증)** — 구현·검수 완료(2026-08-24). **배포 완료**

- **Phase 59a** — 구현·검수 완료(인쇄 실물 포함). **배포 완료(2026-08-22)**
- **Phase 60** — 구현·검증 완료(2026-08-20). 아래 절 참조
- **Phase 45a** — 구현·검수 완료(2026-08-20)
- **Phase 28(Mathpix OCR)** — 2026-04-22 구현 완료, 2026-08-20 API 키 등록·실동작 확인으로 **완전 종료**
- **Phase 61a(시트 가져오기)** — 2026-08-22 구현·검수·**배포·프로덕션 실동작 확인 완료**. 아래 절 참조
- **Phase 61b(정밀 검증)** — 구현·검수 완료. **배포 완료**. 아래 절 참조
- **Phase 61c(대화 → 편집창 삽입)** — 구현·검수 완료(2026-08-23). **배포 완료**. 아래 절 참조

### Phase 62 — 폴더뷰 구조 변경 · 좌우 사이드바 UI 통일 (구현·검수·배포 완료)

문서: `docs/phasedocs/Phase62 폴더뷰 구조 변경·좌우 사이드바 UI 통일 v6 최종판.md`
(계보: v1 web → v2 CLI → v3 web → v4 CLI → v5 web → **v6 CLI 최종**. 판본마다 정정이 나왔으니 v6만 볼 것)

**서버 0 · Firestore 0 · 전처리 파이프라인 0.** 전부 클라이언트 UI.
신규 2(`hooks/useDrawerResize.ts` · `components/ui/DrawerResizeHandle.tsx`) + 수정 7 + globals.css.
**신규 색 토큰 0**, 신규 CSS 변수 1(`--card-surface` — `:root` 미등록, 컴포넌트 지역), **삭제 토큰 2**(`--sidebar-expanded`·`--sidebar-collapsed`).

- **A축**: FolderView U자 프레임 철거 → 바탕 아이보리 / 카드·리스트 행이 클레이 카드(§위 U자 프레임 항목·명암비 항목 개정 참조).
  리스트 행은 `folder-row`(⚠ `problem-card`를 붙이면 Phase 59a Q5 예외가 딸려온다), ~~제목행은 **sticky 래퍼 안의 카드**다
  — 래퍼 없이 루트 상단 패딩을 제목행 밖에 두면 스크롤된 행이 그 틈을 통과해 보인다~~
  ⚠ **sticky 래퍼는 Phase 63 D42가 철거했다**(헤더가 제목바 행 2 = 스크롤 밖으로) — 단 "패딩 띠를
  행이 통과해 보인다"는 함정 자체는 실재해서, 행 위 8px은 sticky 마스크 띠가 덮는다(위 현재 Phase 절)
- **`--card-surface` 하나가 카드 배경·hover·페이드를 함께 움직인다**: 인라인 `background`가 `var(--card-surface, var(--bg-content))`를
  참조하므로 CSS `:hover`는 **변수만** 갈아끼우면 되고 `!important`가 **0건**이다(인라인을 리터럴 색으로 되돌리는 순간 hover가 죽는다).
  페이드도 같은 변수를 읽어 **hover용 페이드 규칙 자체가 사라졌다** — 하드코딩 rgba가 토큰과 어긋났던 `78a780f` 사고의 구조적 차단.
  ⚠ **`--card-surface`(클레이)와 기존 `--bg-card`(#FEFDFB, 아이보리)는 이름이 뒤집힌 쌍**이고 같은 파일 `FolderView:469·476`이 후자를 쓴다
- **제목행 배경은 `--bg-hover`가 아니라 `--block-bg`다**: 휘도 실측 아이보리 0.9829 > 클레이 0.8674 > **`--bg-hover` 0.8349** > `--block-bg` 0.8276 > `--block-bg-active` 0.7439
  — `--bg-hover`는 **클레이보다 어둡고** hover 전용 토큰이라 의미가 꼬인다. 단조 순서(아이보리 < 행 < 제목행 < hover)가 성립하는 유일한 기존 토큰이 `--block-bg`다
- **B축**: 리사이즈는 `useDrawerResize` + `DrawerResizeHandle` 한 벌(위 우측 패널 절 참조). 구 코드의 고정 갭 12·24는
  실제 경계선(`panelWidth+8`)과 어긋나 **드래그 시작에 4px·16px 튀었다** → pointerdown에서 커서↔패널변 offset을 캡처해 유지한다(스냅 0)
- **덕수 검수 완료(2026-08-27)**: T1~T11 전항 통과. 지적 1건 = **버전 드로어 활성선 위치**(offset `-5` → `-13`, 위 규약 참조) — 즉시 반영. 실물 판정 2건은 현행 값 채택(테두리 `--border-content` · 제목행 `--block-bg`). T8″는 **정상 동작 판정**(창 폭을 줄이면 본문 좌·우가 같은 비율로 잘린다 = `justifyContent:center`의 의도된 결과).
- 검증 문서의 T1~T11이 검수 항목이다. **실물 판정 2건**(테두리를 `--block-hairline`으로 한 단 올릴지 · 제목행 톤이 무거운지)과
  **관측 1건**(T8″ — 사이드바 최대 + 우측 단 최대에서 ProblemView 본문 좌측이 잘리는지. **기존 한계라 이번엔 안 고친다**)이 남아 있다

### Phase 59a — Case 레이아웃 거터 이주 · 강조 체계 정비 (구현·검수·배포 완료)

문서: `docs/phasedocs/Phase59a Case 레이아웃·강조 체계 정비.md`
(계보: v1 web 방향 → v2 CLI 실측 → v3 web 재검증 → **v4 CLI 착수판** → 구현)

Phase 59가 옳은 의도로 쌓은 **표현 계층**을 데이터 계약은 그대로 둔 채 걷어낸 Phase다.
산출물의 절반이 삭제다 — 2단 들여쓰기 체계 · `.case-gap-body` · `.outline-keys` ·
`extractKeySentences` 계열 · `.has-key` · `solutionHasKey`·`KEY_STRONG_RE`.
**Firestore 규칙 0 · 마이그레이션 0 · 서버 0.** 위 각 절의 ⚠ 항목이 실제 규약이다.

Phase 59 = 풀이 **요약 보기(outline)** + **'경우(case)' 블록**.
문서: `docs/phasedocs/Phase59 요약 보기·경우 블록.md` — **§0-0이 최종 사양**, §11이 실사용 개정 기록

- **경우 블록**: 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호(`C1.` · `C2a.`)는 **raw_text에 넣지 않고 렌더 시 산출**한다(`lib/caseBlock.ts`) → 삽입·삭제·이동에 강하다. 대신 MD 복사·다운로드에는 번호가 없다(GitHub 아카이브 주석에만 동봉)
- **이어짓기**: 첫 줄이 빈 case/subcase = 직전 경우의 연속(번호·dot 없음, rail만 이어짐). 한 경우 안에 이미지·선택지 블록을 넣는 유일한 방법
- **요약에 남는 것은 정확히 셋 (Phase 59 §11-9 → Phase 59a 개정)**: ① 제목 블록 ② 경우·하위 경우 제목행 ③ `Block.showInSummary`를 켠 블록. 스위치는 활성 블록 상단바(휴지통 왼쪽)의 **"요약에 넣기"**(`components/ui/ToggleSwitch` — 댓글 패널 '보이기'와 공용)이고 블록 종류를 가리지 않는다. ⚠ **제목 블록과 경우 계열에는 스위치를 두지 않는다** — 둘 다 자동으로 들어가고 `buildOutline`이 `showInSummary`를 아예 읽지 않으므로(heading은 즉시 `continue`, case는 `!isCaseBlock` 조건으로 제외) 스위치가 아무 일도 하지 않으면서 오해만 준다. ⚠ **Phase 59의 `**` 발췌(kind:'keys'·`.outline-keys`·`extractKeySentences`)는 Phase 59a에서 폐기됐다** — 하나의 마커가 강조·발췌·톤 트리거 3역을 겸해 "강조할 범위"와 "요약에 남길 범위"가 묶여 있었다. 되살리지 말 것
- **경우 제목행을 누르면 '구역'이 열린다 (Phase 59a 후속)**: 펼침 단위는 경우 블록 하나가 아니라 **그 경우 + 다음 '제목행 있는' 경우 직전까지의 모든 블록**이다. 경계는 제목 블록에서도 끊기고, **이어짓기는 경계가 아니다**(직전 경우의 연속이므로 딸려 들어간다 — 덕분에 이어짓기 내용이 요약에서 다시 닿는다). 이유: 경우 본문의 일부를 들여쓰기 블록으로 떼어내면 예전 방식에서는 뒷부분이 요약에서 영영 사라져 **"분리하면 요약이 망가지니 분리를 못 하는"** 상태였다. `OutlineItem.segment`(구역 전체)와 `.pinned`(그중 스위치 켠 것)를 `buildOutline`이 만들고, 렌더는 **접힘 = pinned / 펼침 = segment 배타**다(동시에 그리면 같은 블록이 두 번 나온다)
- **스켈레톤에서 블록을 div로 감싸지 말 것 (Phase 59 D15′ · 59a에서 재확인)**: 렌더는 사이트별 `renderBlock`을 그대로 재사용하는데, 결과를 한 번 더 감싸면 `.case-gap` 형제 인접이 깨져 rail이 그 블록 앞뒤로 끊긴다. 구역 블록을 `CaseItem` **안에** 넣지 않고 `React.Fragment`로 형제로 흘리는 이유가 이것이다(Fragment는 DOM 노드를 만들지 않는다). 실측: 펼친 구역에서 rail 조각 7개가 끊김 0으로 이어졌다
- **on/off 컨트롤은 공용 `components/ui/ToggleSwitch` 하나**(Phase 59 §11-10): 블록 상단바 '요약에 넣기' · 열람뷰 '요약' · 댓글 패널 '보이기/쓰기 허용'. 사본을 만들지 말 것 — 치수·색이 두 벌로 갈린다
- **우측 패널은 4종이고 '떠 있는 카드'다 (개선묶음 M2)**: 우측 단(ProblemView 메뉴·메타) · 댓글 · agent · 버전 드로어. 넷 다 `DRAWER_INSET 8`(사면) · `DRAWER_RADIUS 10` · `DRAWER_BORDER 1px --border-content` · 2겹 그림자 · 폭 `PANEL_WIDTH_DEFAULT 420`. 값은 전부 `components/ui/dialogStyles.ts`가 소유한다. ⚠ **한 변이라도 여백이 0이면** "붙어 있는 패널"로 읽혀 3단 구분이 무너진다. ⚠ **`DRAWER_ROW1_H = 57 − DRAWER_INSET − DRAWER_BORDER_W`(=48)** — 중앙 컨텐츠의 두 가로선(y=57·98)과 정렬하기 위한 값이다. 48을 숫자로 굳히지 말 것이고, 2행(41)은 두 선의 간격이므로 건드리지 말 것. ⚠ **컨텐츠 예약 폭의 정의는 "드로어 카드의 좌측 경계선까지"** 다 — 그보다 크면 그 차이만큼 빈 띠가 생겨 컨텐츠가 잘려 나간 것처럼 보인다. 두 경우의 식이 다르다: 댓글·agent `width + 8`, 우측 단 `width − 8`(우측 단만 바깥 자리를 width로 잡고 카드를 그 안에 넣기 때문)
- **⚠ EditorView Row1·Row2는 '덮는다' (개선묶음 M2 R6)**: 아래 "덮지 않고 밀어낸다" 규약을 그 두 행에 한해 의도적으로 깼다 — 패널을 여닫을 때마다 제목·탭이 줄었다 늘었다 하며 "편집 대상이 바뀐 것처럼" 보였다. **Row3(content-frame)의 밀어내기는 그대로**다(본문까지 덮으면 편집이 막힌다). 대가로 Row1 우측 끝의 버전 기록·글꼴 조절이 패널 뒤로 숨는다
- **좌·중·우 3단은 밝기 서열로 가른다 (개선묶음 M2 R7)**: 상대휘도 실측 — 사이드바 `--bg-sidebar #FAF7F2` 0.9326 < 중앙 `--bg-functional #FCFAF6` 0.9572 < 드로어 `--bg-drawer #FFFFFF` 1.0000. 여기에 사이드바 우변 `--rail-hairline`(0.25pt)이 더해진다. ⚠ **서열이 뒤집히면 3단 구분이 통째로 무너진다** — 셋을 함께 볼 것. ⚠ 중앙을 더 낮추지 말 것(`#FBF8F3` 0.9412면 사이드바와의 차가 0.009로 줄어 사실상 사라진다). ⚠ 셋 다 아이보리 계열이라 **명암비 최악값(FolderView 카드 hover `#E8DFCE`)은 불변** — Phase 58·59a 계산은 그대로 유효하다
- ~~**우측 패널 3종은 한 규약이다 (2026-08-18)**~~: 댓글·agent(`CommentPanel`)와 버전 기록(`VersionDrawer`)은 **덮지 않고 밀어낸다** — EditorView 루트 기준 `absolute`이고, 미는 쪽은 `rightPanelWidth`/`rightPanelOpen` 하나가 Row1·Row2·Row3의 `paddingRight`를 공급한다(둘 다 열리면 넓은 쪽). 드로어 폭은 `VERSION_DRAWER_WIDTH`를 export해 공유한다. 바탕은 셋 다 `--bg-panel-agent`(아이보리 — 클레이 컨텐츠와 역할로 구분). **행 규격도 공유**: 1행 = 제목+닫기(`minHeight 57` · `padding '0 16px'` · `gap 12`), 2행 = 부가 컨트롤(`minHeight 41` · `padding '0 12px'` · `gap 6` · `--bg-primary`) — 한 곳만 바꾸면 패널을 오갈 때 헤더가 흔들린다
- **패널 폭 조절은 `useDrawerResize` + `DrawerResizeHandle` 한 벌이 전부다 (Phase 62)**: 소비처 5곳(EditorView 댓글·버전 드로어 / ProblemView 댓글·우측 단 / AppShell 사이드바). **폭 수치만 패널별**이고 문법은 공유한다. ⚠ **훅의 `anchor`(패널이 뷰포트의 어느 변에 고정됐나)와 핸들의 `side`(strip을 부모의 어느 변에서 offset하나)는 다른 개념**이다 — 버전 드로어가 유일하게 갈린다(`anchor:'right'` + `side:'left'`). ⚠ **핸들을 `overflow`가 걸린 상자 안에 두지 말 것** — `overflow-y: auto`는 **가로도 함께 잘린다**(Sidebar `<aside>`는 `overflow:hidden`, ProblemView 우측 단은 `overflowY:auto`라 둘 다 화면 루트에 마운트한다). ⚠ 폭은 **세션 내 상태**이고 새로고침하면 기본값으로 돌아간다(localStorage 금지, 덕수 확정). ⚠ 드래그 중에는 **밀어내기 transition도 함께 꺼야** 본문이 0.2s 뒤처지지 않는다. ⚠ **활성선은 패널 변이 아니라 클레이 우측 경계선(`rightPanelWidth + 8`)에 맞춘다** — 사이드바·ProblemView 우측 단은 자기 변이 곧 경계선이라 `offset: width - 5`지만 **버전 드로어만 자기 변이 경계선이 아니라 `offset: -13`이다**(`-5`로 두면 활성선이 댓글·agent보다 8px 오른쪽에 뜬다 — Phase 62 T7 검수에서 잡힌 유일한 결함)
- **ProblemView는 댓글·agent 패널이 열리면 우측 단이 존재하지 않는다 (Phase 62)**: 열·리사이즈 핸들·토글 버튼이 함께 사라진다. 패널(min 360)이 우측 단(max 360)을 **완전히 덮는** 구조라(zIndex 50 vs flex 형제) 남겨 두면 보이지 않는 열과 그 위에 뜨는 핸들(zIndex 100 > 50)·무의미한 토글이 생기고, 본문이 `paddingRight`와 우측 단에 **이중으로** 밀려 228~368px 死공간이 남는다. **둘을 공존시키려면 `CommentPanel`에 `rightOffset`을 넣어 패널을 우측 단 왼쪽에 붙이는 별도 작업이 필요하다 — 그것 없이 한쪽만 되살리지 말 것**
- **ProblemView 컨텐츠 행(`:672`)에 `position:relative`를 주지 말 것 (Phase 62)**: 글자크기 컨트롤(`:730`)과 우측 단 토글(`:777`)이 그 행 **안**에 있으면서 **루트 기준** `top:16`/`top:52`로 배치돼 있다 → 행이 positioned가 되는 순간 둘이 제목바 높이(98px)만큼 내려간다. 우측 단 핸들을 "제목바를 안 가리게" 두려는 우회가 정확히 이 함정이다
- **`position: absolute`로 바꾸면 그 안의 `fixed` 모달이 갇힌다 (2026-08-18)**: 포지션+zIndex를 가진 요소는 **스태킹 컨텍스트**를 만든다 → `VersionDrawer`(absolute·110) 안의 `RestoreConfirm`(fixed·1400)에서 1400은 드로어 내부에서만 유효하다. 모달이 바깥을 덮으려면 **드로어 자신이** 그 화면의 최대 zIndex(EditorView는 리사이즈 핸들 100)보다 위여야 한다
- **요약 보기**: 열람 2뷰 전용, 비영속. **기본값은 앱 열람뷰 outline / 공개 뷰어 full**이며, 요약할 뼈대가 없으면(제목·경우 전무) 훅이 full로 강제 해제한다 — 안 그러면 빈 화면이 된다. ⚠ Phase 59a로 발췌가 사라지면서 **이 게이트가 닫히는 문항이 늘었다**(제목도 경우도 없이 `**`만 있던 풀이가 전부 해당) → `OutlineToggle`의 disabled 툴팁도 함께 고쳤다. Phase 54 레거시 `**Case n.**`은 **행 단위 스캔**으로 항목 승격(이것만 남았다)
- **`caseGapClassName`은 타입을 가리지 않는다 (Phase 59a)**: rail이 거터로 나가 개재 블록이 걸릴 것이 없어졌다 → 항상 `'case-gap'`. 인자는 호출 5곳을 건드리지 않으려고 남겨 둔 것이다
- 로직 검증: `npm run test:case` (35개)

### Phase 61b — 정밀 검증 (구현·검수·배포 완료)

문서: `docs/phasedocs/Phase61b 정밀 검증 구현 계획서 v4 실행판.md` · roadmap의 Phase 61b 절

시트 STEP3의 **비대칭 교차검증**(1차 Gemini 후보 생성 → 2차 Claude 엄격 판정)을 이식.
**Firestore 규칙 0 · 마이그레이션 0.** agent 대화창의 칩 2개로 실행하고, 리포트는 일반
AI 메시지로 저장돼 후속 대화가 기존 discuss 파이프라인 **무변경**으로 이어진다.

- **`"\frac"`은 JSON 파싱이 *성공하면서* 망가진다** — `\f`가 유효 이스케이프라 결과가
  `␌`+`"rac"`이 된다. 오류가 없으니 파싱 폴백으로는 못 잡고, 복구는 **파싱 후 · `trim()` 전**에만
  가능하다. `parseAndRepair()` 하나로 묶어 순서 실수를 차단했다. **tool_use·structured output을
  써도 면제되지 않는다** — 어느 경로든 결국 `JSON.parse`를 지난다
- **프롬프트 치환은 함수형 콜백 필수** — `String.replace`에 값을 문자열로 넘기면 `$$`·`$&`가
  치환 패턴으로 해석돼 LaTeX가 손상된다. (시트 STEP1이 아직 안 고쳐진 자리이니 베끼지 말 것)
- **앵커는 모델의 `[블록 n]` 신고가 아니라 인용 실재성으로 서버가 확정한다** — 공백 제거 전문
  매칭 → **최장 일치 접두(≥12자)** → 실패 시 `check` 강등. ⚠ **고정 길이 접두는 안 된다** —
  인용이 블록보다 길면(모델이 문장을 이어 쓴 흔한 실패) 명백한 일치를 놓친다
- **Opus 4.8은 `thinking`을 생략하면 사고가 꺼진 채 돈다** — 오류·경고 없이 품질만 조용히
  떨어진다. `budget_tokens`(400) · assistant prefill(400) · `tool_choice:{type:'any'}`
  (최종 JSON 턴 불가)는 전부 금지
- **2차 판정이 완료되지 않은 검증은 검증이 아니다** — 1차·2차 실패, 예산 부족, 도구 상한 초과는
  전부 리포트를 만들지 않고 오류로 끝낸다. **1차 후보를 지적으로 노출하지 말 것** — recall 편향
  후보가 그대로 보이면 2차가 존재하는 이유(보수 판정)가 무너진다
- **2차 `code_execution`은 시트에 전례가 없다** — `QualityVerification.gs`의 Claude payload에
  `tools`가 아예 없다(파일 전체 0건). 이식이 아니라 신규 요소라 `VERIFY_JUDGE_CODE_EXEC` env로
  게이트하고 **기본 off**다. `pause_turn` 루프의 유일한 발동 원인이 이것이다
- **stale은 "저장 경로 훅"으로 만들 수 없다** — `handleSave`가 탭 구분 없이 매 저장마다 전 탭을
  delete-all → re-add 하므로 "질문 탭이면" 분기가 없다 → **탭 정규화 해시 비교**
  (`collectCurrentContent`+`hashPerTab`). problem 해시엔 **answer를 함께** 넣는다
  (`canonicalizeTab`은 제목·정답을 포함하지 않는데 `answerCheck`가 answer에 의존한다).
  ⚠ `last_version_tab_hashes`는 `!silent`일 때만 갱신되므로 신호로 쓰지 말 것
- **`verification` 쓰기는 `setVerification` 전용** — `updateProblem`은 `updated_at`을 갱신하는데
  목록이 `updated_at desc` 정렬이라 검증만으로 문항이 맨 위로 올라온다
- **`verification`에 findings·derivedAnswer를 넣지 말 것** — 그 문서는 public·member가 읽는다
- **`<details>`를 리포트에 쓰지 말 것** — `stripForHistory`가 `[검산 코드 첨부됨]`으로 치환해
  히스토리에 거짓 문구가 들어간다. 접기는 카드 자체 상태로
- **검증 칩이 오너 전용인 것은 정책이 아니라 규칙 강제다** — AI 댓글 create는 오너만 허용이라
  비오너는 비용만 쓰고 저장에서 실패한다. 게이트는 `onRunVerify` prop 주입 + `currentUid ===
  ownerUid` + `isAISession`(세션 없으면 전송 자체가 막힌다). ⚠ **칩은 편집창·열람뷰 둘 다에 있다** —
  처음엔 `onInsertGraphBlock` 선례를 따라 편집창 전용으로 뒀는데, 검증은 **문항을 보면서 하는 일**
  이라 실사용에서 곧바로 어긋났다. 실행 흐름은 `lib/verifyFlow.ts`가 공유하고, 편집창만 "dirty면
  저장 먼저"를 앞에 붙인다(열람뷰는 애초에 저장본만 보인다)
- **⚠️ `lib/verifyFlow.ts`를 `lib/verify/`에 두지 말 것** — 그 폴더는 전부 import 0 순수 모듈이고
  `npm run test:verify`가 tsc로 단독 컴파일한다. verifyFlow는 firestore·comments를 import한다
- **⚠️ 공용 컴포넌트가 붙이는 클래스는 스타일도 공용이어야 한다**: `.math-highlight-active`는
  `EditorPreview`(공용)가 붙이는데 규칙이 `EditorView`의 인라인 `<style>` 안에만 있었다 →
  다른 화면에서는 클래스가 붙어도 **아무 일도 일어나지 않았다**. `globals.css`로 옮겼다
  (`.verify-jump-flash`도 같은 자리). 붙이는 쪽과 그리는 쪽의 스코프를 맞출 것
- **인용 앵커는 두 층이고 정규화 기준이 같아야 한다**: `anchorByQuote`(어느 블록 → `blockKey`,
  즉 **클릭 가능 여부**)와 `findQuoteRange`(그 블록의 어디). 둘 다 **공백과 `$`를 함께 무시**한다
  — 모델이 인용을 옮기며 `$`를 떨어뜨리는 일이 실제로 있고, 한쪽만 고치면 "블록은 못 찾는데
  글자는 찾는" 상태가 되어 지적이 조용히 클릭 불가가 된다(실제로 그랬다). 테스트가 고정한다
- **리포트 카드의 수식은 `renderInlineMathHtml`(lib/katex-render.ts)로 그린다**: 프롬프트가
  수식을 `$...$`로 쓰게 하므로 평문으로 두면 카드가 통째로 LaTeX 소스로 보인다. `EditorPreview`를
  쓰지 않는 이유는 그쪽이 마크다운 **문서** 렌더러라 `.preview-content`의 글자 크기·문단 여백을
  들여오기 때문이다(카드 안 11~12px 한두 줄에 과하고 지적당 3개씩 인스턴스가 생긴다).
  ⚠ **모델이 인용에서 `$` 구분자를 떨어뜨린다** — 원문에는 있는데 옮겨 적으며 빠진다. 그래서
  `autoMath` 옵션이 "`$`가 하나도 없고 TeX 제어열이 있으면 전체를 수식으로" 구제한다.
  **인용·도출답에만 켤 것** — 산문(reason)에 켜면 통째로 수식화된다
- **`AIChipBar`는 전폭 `<div>`다** — 그 옆에 무언가를 fragment로 나란히 두면 아랫줄로 밀린다.
  `headerLeft`에 두 개 이상을 놓으려면 flex 컨테이너로 감쌀 것
- **게이트로 숨기는 UI는 이유를 남길 것**: 조용히 사라진 컨트롤은 "구현이 안 됐다"와 구별되지
  않는다. 검증 칩은 게이트 3개 중 무엇이 막았는지 dev 콘솔에 `[Phase61b] 검증 칩 숨김: …`으로 남긴다
- **클라이언트가 `lib/verify/prompts`를 import하면 프롬프트 전문이 클라 번들에 실린다** —
  답안 형식 산출은 서버가 하고 클라는 재료만 넘긴다
- ⚠ 리포트 댓글은 **멤버가 전부 읽는다**(`firestore.rules:234-236`, 세션 구분 없음).
  `memberTabVisibility`로 탭을 가린 멤버에게 `quote`·`derivedAnswer`는 새 정보다 — 알고 둔 것
- **비대칭이 이 시스템의 전부다 — 1차 프롬프트에 보수 판정 문구를 넣지 말 것**: 1차는 recall
  (`RECALL_RULES`), 2차는 precision(`CONSERVATIVE_RULES`). 양쪽에 다 넣으면 1차가 빈 배열을
  뱉고(실측 후보 0건 50%) 2차는 할 일이 없어진다. 그리고 **1차만 넓히면 2차가 더 기각해
  상쇄된다** — 2차의 `invalid`(아님을 확인)와 `uncertain`(가리지 못함)을 뭉뚱그리면 확신 없는
  후보가 조용히 사라져 사람이 볼 기회가 없어진다. 두 짝을 **함께** 조정할 것
- **⚠️ 검증 요청은 두 번이다** (`phase:'first'` → `phase:'judge'`): 한 요청에 다 넣으면 어려운
  문항에서 `maxDuration`(Vercel Pro 상한 300초)을 넘긴다 — 실측 2026-08-22 한 문항 **228초**이고
  최악이라는 보장도 없다. 쪼개면 각 단계가 300초를 온전히 받으므로 **thinking을 낮춰 품질을
  깎지 않아도 된다**. 중간 상태(후보 배열)는 **클라이언트가 들고 다시 보낸다** — 서버는 무상태
  유지. 1차가 결론을 낸 경우(그림 의존 skip · 후보 0)는 `report`를 바로 돌려주고 2차를 안 부른다
- **풀이 1차는 계산·표기 / 논리 두 패스다 (병렬 필수)**: 한 프롬프트에 태그 7개를 넣으면 눈에
  띄는 표기·계산이 먼저 소모되고 논리가 묻힌다(실측: 논리 6건 중 1건만 검출). 시트도 STEP2·STEP3로
  나눠 돈다. ⚠ **직렬로 보내면 300초 예산이 무너진다** — `Promise.all`
- **⚠️ `FIRST_MAX_TOKENS`(8k)를 올리지 말 것 — 실측으로 반증된 가설이다**: "thinking이 예산을 먹어
  `reason`이 필러로 퇴화한다"는 가설로 32k를 두 번 시도했고 **두 번 다 나빠졌다**(후보 2.50→1.70→1.40,
  기각률 72%→86%, 검출 4→1). 되돌리자 곧바로 회복됐다(검출 3, 기각률 56%, 최장 85초).
  가설의 근거였던 "출력 10,713토큰"은 **1차 두 패스 + 2차 판정의 합계**를 개별 호출값으로 잘못 읽은
  것이었다 — 예산에 닿았다는 증거가 애초에 없었다. 예산을 올리면 비용이 아니라 **시간**이 늘고
  (118초→228초) 후보는 오히려 줄어든다
- **`reason`이 필러로 퇴화하는 현상은 실재한다**(같은 문장 반복·영문 진행 메모 "Final logic flow is
  complete"). **그런데 그때도 `quote`는 정확했다** — 시트가 지적한 바로 그 줄을 짚고 있었다. 지점은
  맞히고 설명만 무너지므로 "1차가 헛것을 본다"로 오진하기 쉽다. 그래서 심판에게 **"reason이 부실하다는
  이유로 기각하지 말 것"** 을 명시했다
- **⚠️ n=10 표본으로 프롬프트 판본을 가리지 말 것**: 검출 3과 4의 차이는 한 건이고 표본을 바꾸면
  뒤집힌다. 그 노이즈를 신호로 읽고 조정을 반복하면 후퇴한다(실제로 그랬다). 판본 비교가 의미를
  가지려면 30~50건이 필요하고, 그보다 **실사용에서 놓친 사례를 모으는 편**이 훨씬 정확한 신호다
- **1차에 개수 할당량을 주지 말 것**: "결함 수의 두 배를 올려라"는 없는 결함을 찾게 만들지 않고
  **배열을 필러로 메우게** 만든다("검증 완료", "결과 일치 확인됨" 같은 *이상 없다*는 서술이 후보로
  올라온다). 원하는 것은 할당량이 아니라 **문턱 낮추기**다 — "확실히 결함"이 아니라 "결함일 수도"
- **심판에게 `reason` 부실을 기각 사유로 주지 말 것**: 지점(`quote`)은 맞고 설명만 무너지는
  사례가 실재한다. 판단 대상은 설명이 아니라 quote가 가리키는 원문 자리다
- **2차 프롬프트의 페르소나 선언이 세부 규칙을 이긴다**: 첫 문장이 "기각하는 쪽으로 기운 심판"인
  채로 본문에 "남기는 쪽으로 기울여라"를 넣으면 모델은 첫 문장을 따른다(기각률 85%). 역할 규정
  자체를 바꿔야 움직인다 — 현재는 "사람이 검토할 목록을 **추려 주는** 심판. 문지기가 아니다"
- **프롬프트 조정은 `scripts/verifyProbe.mjs`로 한다** — UI 왕복은 1회 1~2분이라 못 쓴다.
  라우트와 프롬프트·파서·바디 조립을 **공유**하고 HTTP·인증만 다르다. 대조군은 **Stack 시트**의
  판정열(Data_DS는 처리 후 비워져 빈칸이다)
- 로직 검증: `npm run test:verify` (37개)

### Phase 61d — 폴더 일괄 검증 (구현·검수·배포 완료)

문서: `docs/phasedocs/Phase61d 폴더 일괄 검증 구현 계획서 v4 실행판.md` · roadmap의 Phase 61d 절

FolderView의 [일괄 검증] → 폴더 **직속** 문항을 체크박스로 고르면 61b의 `runVerifyFlow`를
**문항×종류 단위로 순차 호출**하는 클라 루프가 돈다. **서버 0 · 규칙 0 · 스키마 0.**
단건 검증과 결과물이 **비트 단위로 같은 것**이 적합성의 기준이다.

- **⚠️ 검증 대상은 실행 시점 재로드본이다 — 프리플라이트 스냅샷으로 검증하지 말 것**: 배치는
  수십 분~시간 단위인데 모달은 **같은 탭의 이동만** 막는다. 다른 탭에서 저장된 편집이 검증 쓰기보다
  앞서면 `stale` 계산(`handleSave` 경로 전용)이 다시 돌 계기가 없어 **배지는 "최신 ✓"인데 내용은
  다른** 상태가 남는다 → 문항 차례마다 `getProblemWithBlocks`를 다시 읽고 스킵을 재판정한다
- **사전 차단 6종은 AI 호출 전에 판정**: `missing`·`not_owner`·`tab_load_error`·`empty_question`·
  `no_solution`·`too_long`. ⚠ **`tab_load_error`가 가장 위험하다** — 그 예외(`VersionLoadError`)는
  `runVerifyFlow` 안에서 **`addComment` 뒤**에 터져 "AI 비용은 다 쓰고 리포트는 저장됐는데
  `verification`만 미갱신"인 반쪽 상태를 만든다. ⚠ **`empty_question`은 풀이 검증도 막는다**
  (풀이 요청에도 `problemBlocks`가 실려 가고 서버가 검사한다)
- **사전 차단·실패를 `skip` verdict로 기록하지 말 것**(61b D14′) — `skip`은 **AI가 판단한** 검증
  불가 전용 어휘다. 사전 차단은 요약 화면에만 산다(Firestore 신규 스키마 0)
- **기본 체크 = `!verification[kind] ∨ stale`** — `check`·`fail`은 기본 해제(수동 체크는 가능).
  내용 불변 재검증은 같은 리포트를 한 번 더 쌓을 뿐이고 그 상태는 *사람이 볼 차례*다
- **리포트 세션은 `type:'normal'`("일괄 검증")** — 댓글 세션에 넣으면 `commentStream=true`가 되어
  **공개 문항에서 비로그인까지 읽는다**. ⚠ 세션은 **실제로 돌 종류가 1개 이상일 때만** 확보
- **401/403은 즉시 전체 중단**(허용목록 미등록·토큰 만료 → 이후 전건 실패), **연속 3건 실패도 중단**.
  카운터는 **AI 호출을 실제로 시도한 종류 단위**로 세고 건너뜀은 세지 않는다
- **중단은 종류 경계에서만** — in-flight abort는 1차 비용을 쓰고 2차를 끊는 것이라 D13′에 의해
  그 비용이 통째로 버려진다
- **완전 직렬**(1문항×1종류). 동시 4건은 **프리플라이트 읽기에만**(`SheetImportModal.SAVE_CONCURRENCY` 전례)
- **`idToken`은 문항마다 새로** — 토큰 수명 1시간 < 배치 시간
- **전체 뷰포트 모달이 앱 내 이동을 막는다** — FolderView는 `view.type === 'folder'`일 때만 렌더돼
  홈·편집·문항으로 나가면 언마운트되고 배치가 끊긴다. `fixed; inset:0; zIndex:9000`이면 사이드바까지
  덮인다(`main`은 z-index 없는 `position:relative`라 스태킹 컨텍스트가 아니고 조상에 transform이 없다).
  `beforeunload`는 **실행 중에만** 등록
- **`onUpdated`는 종료 시 1회, 성공 1건 이상일 때만** — `setVerification`이 `updated_at`을 안 건드리므로
  배치를 n건 돌려도 목록 순서는 그대로다
- **⚠️ 글자 수를 `lib/verify/batchPlan.ts`에서 세지 말 것** — import 0이라 `verifyBlocksOf`를 못 쓰고,
  직접 세면 서버 셈법의 **세 번째 사본**이 된다. 유일 구현은 `verifyCharCountOf`(verifyFlow)이고
  판정 함수는 수치를 주입받는다. 같은 이유로 **`lib/batchVerify.ts`를 `lib/verify/`에 두지 말 것**
- **verdict 어휘 = `VERIFY_VERDICT_META`, 스킵 문구 = `skipLabel`이 단독 소유** — `Record<SkipReason, string>`
  이라 사유를 추가하면 라벨 누락이 **컴파일 오류**가 된다
- 로직 검증: `npm run test:batch` (17개)

### Phase 61c — 대화 → 편집창 삽입 (구현·검수·배포 완료)

문서: `docs/phasedocs/Phase61c 대화 삽입 구현 계획서 v4 실행판.md` · roadmap의 Phase 61c 절

agent 대화창에서 드래그 → 미니 팝업([편집창에 삽입] · [복사]) → 선택 영역을 **Mathory 표기 규약의
마크다운으로 직렬화**해 활성 블록 커서 위치에 꽂는다. **서버 0 · Firestore 0 · 전처리 파이프라인 무변경.**

- **수식은 원본 슬라이스로 복원한다 — annotation은 폴백이다**: `.katex`의 annotation에 든 것은 원본이
  아니라 **전처리된 TeX**다(`$x$` → `\displaystyle x`, 다행 display → `\begin{array}{l}` 래핑). 1순위는
  "렌더된 수식 호스트 i번 ↔ 소스 수식 i번" 슬라이스이고, 개수가 어긋나면 그 댓글 전체를 annotation
  역변환으로 내린다(**조용한 오염 금지**)
- **`.katex-error`도 수식 호스트다** — KaTeX 파싱이 깨지면 rehype-katex는 `.katex` 클래스가 **없는**
  `<span class="katex-error">`를 낸다. 그래도 **소스 인덱스는 한 칸 소비한다** → `.katex`만 세면 에러
  하나에 순번이 통째로 밀린다. ⚠ 그래서 `data-math-id`를 **쓰지 않는다**(`EditorPreview`의 부여
  effect는 `.katex`만 훑는다). **그 속성을 지우지는 말 것 — Phase 56 하이라이트가 쓴다**
- **⚠️ 개수 게이트는 필요조건이지 충분조건이 아니다**: `lib/mathIndex.ts`와 remark-math는 `\$`를
  **정반대로** 본다 — 수식 **밖**의 `\$`를 mathIndex는 여는 구분자로 보지만 remark는 마크다운
  이스케이프로 보고, 수식 **안**의 `\$`를 mathIndex는 건너뛰지만 remark는 **닫는다**(math-text는
  코드 스팬 규칙이라 백슬래시를 안 본다). 그래서 개수만 맞고 짝이 뒤바뀌는 일이 실제로 있었다.
  `lib/chatExtract.ts`의 `scanRenderedMath`는 **사본이 아니라** remark 규칙을 모사한 별도 판본이다.
  ⚠ `lib/mathIndex.ts`에 같은 어긋남이 남아 있다(편집창 하이라이트가 `\$` 든 수식에서 밀린다 — 별건)
- **순서 스큐는 상수다** — 코드펜스(검산 python·`mathory-graph`)·인라인 코드가 있으면 무보정 인덱스는
  **100% 어긋난다**. ``` · `~~~` · 인라인 코드(**백틱 런 매칭**. `` `[^`\n]*` `` 근사는 다중 백틱에서 깨진다)를
  **길이·개행을 보존하며** 마스킹한 뒤 인덱싱한다
- **⚠️ `insertText`를 채팅 삽입에 쓰지 말 것** — 텍스트에 `{}`가 있으면 커서를 첫 `{}` 안으로 점프시키고
  2개 이상이면 **탭스톱을 무장**한다(툴바 템플릿 전용 규약). AI 대화문에는 `x^{}`가 실제로 섞인다 →
  `insertPlainText`(선택 대체 + 커서 + 포커스, 한 dispatch = undo 1스텝)가 이 경로를 담당한다
- **⚠️ `FindingRow`는 행 전체가 클릭 영역이다** — 가드가 없으면 검증 카드 안 드래그가 곧 점프(탭 전환·
  블록 펼침·`ref.focus()`)여서 **인용을 뽑는 것 자체가 막힌다**. `onClick` 진입부에서 살아 있는 선택을 보고 물러난다
- **`Range.containsNode`는 존재하지 않는다** — 그건 `Selection`의 메서드다. 표 전체 포함 판정은
  `range.comparePoint(node, 0) >= 0 && range.comparePoint(node, node.childNodes.length) <= 0`
- **`selection.toString()` 금지** — 우리는 평문이 아니라 마크다운이 필요하다(마커·강조·수식 복원이 전부 죽는다)
- **`<br>`은 hard break 두 칸만 낸다** — mdast→hast의 `break` 핸들러가 `<br>` **뒤에** `"\n"` 텍스트
  노드를 함께 넣으므로 `\n`을 또 내면 빈 줄이 생긴다
- **마커 뒤 공백은 한 칸 복원한다** — `GANA/GIYEOK/CIRCLED` 정규식의 `[ \t]*`가 흡수해 DOM에는 없다.
  그대로 두면 `(가)첫 항목`이 되어 덕수가 쓰는 표기와 달라진다(렌더 결과는 같다)
- **블록 경계는 `p`만이 아니다** — 검증 리포트 카드는 `<p>`가 **0건**이고 전부 `div`다.
  `p`·`h1~h6`·`blockquote`·`ul`·`ol`·`table` → 빈 줄 / `div`·`tr`·`summary` → 줄바꿈
- **텍스트 노드에 남은 `$`는 리터럴이라 `\$`로 이스케이프**한다(수식은 전부 math 호스트로 빠진다).
  다른 활성 문자(`*`·`_`·`[`)는 건드리지 않는다 — 과잉 이스케이프가 평범한 문장을 더 망친다
- **팝업은 패널 루트의 직계 자식**이어야 한다 — `messagesScrollRef`(`overflowY:auto`) 안에 두면 잘린다.
  게이트는 **`onInsertToEditor` prop 유무**이고 **팝업 자체는 열람뷰에도 마운트**된다(`[복사]`가 산다).
  ⚠ `onRunVerify`의 "편집 화면에서만 전달" 주석은 **낡았다**(ProblemView도 넘긴다) — 편집창 전용
  선례로 인용할 것은 `onInsertGraphBlock`·`onInsertToEditor`다
- **⚠️ 카드 안 `dangerouslySetInnerHTML`은 리렌더마다 innerHTML을 다시 쓴다 → 사용자 선택이 죽는다
  (Phase 61c 실측)**: `VerifyReportCard`의 `MathText`가 그랬다. `hover`를 state로 들고 있어
  마우스가 들어올 때마다 리렌더 → span 안 텍스트 노드가 통째로 교체 → **거기 걸린 드래그 선택이
  즉시 해제**되고 스냅샷 Range까지 고아가 된다(인용을 뽑는 것 자체가 불가능했다).
  처방은 셋을 함께: ① `MathText`를 `memo` + `useMemo(html)` ② 넘기는 `style`을 **모듈 상수**로
  (인라인 리터럴은 매 렌더 새 identity라 memo를 뚫는다) ③ hover를 state가 아니라 CSS
  `.verify-finding-row:hover`(globals.css)로. **선택 위에 얹힌 UI가 있는 곳에서는 리렌더 자체가 버그다**
- **⚠️ rAF로 지연 실행되는 핸들러는 click **뒤에** 돈다 (Phase 61c 실측)**: 팝업의 `evaluate()`가
  `selectionchange`/`pointerup`을 rAF 디바운스하는데, 거기서 `setNotice(null)`을 하니 버튼 click이
  방금 띄운 안내("텍스트 블록을 먼저 선택하세요")를 **자기가 지웠다**. 안내·플래시를 접는 것은
  click보다 확실히 먼저 도는 `pointerdown`에서만 할 것
- **점프 가드는 "선택이 살아 있는가"만으로 부족하다**: 선택이 이미 죽어 버린 뒤에는 그 조건이
  통과한다. `onMouseDown` 좌표를 기록해 **4px 이상 움직였으면 드래그**로 보는 조건을 함께 걸 것
- **계측 방법(재사용 가치 있음)**: 임시 라우트(`app/dev61c`) + **CDP로 몬 headless Chrome**
  (`Input.dispatchMouseEvent`로 실제 드래그 재현 + `MutationObserver`로 DOM 교체 계측).
  Node 22+의 내장 `WebSocket`이면 playwright 없이 된다. 조사 후 라우트·스크립트는 삭제했다
- **⚠️ 왕복 테스트는 DOM 어댑터를 커버하지 못한다** — 테스트는 hast→미니트리로, 프로덕션은 DOM→미니트리로
  들어간다. 두 변환기는 **같은 규칙 한 벌**을 채워야 하고, 어댑터(Range 절단·`closest` 판정·스킵)의
  검증은 **실물 대화 검수**가 전담한다
- 로직 검증: `npm run test:extract` (42개, 실제 remark/rehype 파이프라인 왕복)

### Phase 61a — 스프레드시트 문항 가져오기 (완료 · 배포 · 프로덕션 확인)

문서: `docs/phasedocs/Phase61a 시트 가져오기 구현 계획서 v6 확정판.md` (§10이 구현 기록)

gas-project-audition 시트(`Data_DS`/`Stack`) → Mathory 문항. **Firestore 규칙 0 · 마이그레이션 0.**
사이드바 '시트 가져오기' → 모달(시트 → 행 → 폴더 → 미리보기 → 저장).

- **서버는 얇은 읽기 프록시, 저장은 클라이언트**: `app/api/sheet-import/route.ts`는 시트를 읽어
  행 JSON만 준다(Firestore 미접촉). 저장은 기존 `createProblem`/`saveTabBlock`을 그대로 탄다 →
  수동 생성과 경로가 같아 규칙·VCS와 자연히 정합
- **자격증명은 `spreadsheets.readonly` 스코프**로 잠근다 — 쓰기 API를 "안 부르는" 게 아니라 **못 부른다**
- **인증이 필수다**: 기존 AI 라우트(`proofread`·`ocr`·`discuss`·`ai-complete`)는 무인증이지만 그건 *비용*만
  새는 것이고, 이 라우트는 무인증이면 **시트 전문이 공개**된다. ID 토큰 릴레이 + `identitytoolkit
  accounts:lookup` 검증 + `AUDITION_ALLOWED_UIDS` 허용목록(비면 전원 거부). ⚠️ `github/export`처럼
  "토큰을 Firestore REST에 넘겨 규칙이 대행"하는 트릭은 **Firestore를 안 거치는 라우트엔 못 쓴다**
- **미리보기와 저장은 같은 배열을 본다**: `toPersistedBlock`이 `raw_text`를 정규화하므로, 미리보기가
  정규화 **전** 텍스트를 그리면 검수가 무의미해진다. 미리보기 진입 시 persisted 배열을 확정해 공유한다
- **블록 렌더는 타입 분기 필수**: `EditorPreview`는 마크다운 문자열 렌더러라 **choices를 모른다**.
  `text`→`EditorPreview` / `choices`→`ChoicesBlock` (렌더 사이트들과 같은 규약)
- **중복 키는 `source_id` + `stem_hash`**: 시트에 id가 같고 본문이 다른 그룹이 67개 있다.
  id만 쓰면 서로 다른 문항을 조용히 건너뛴다. ⚠️ **휴지통 문항은 중복이 아니다** — Mathory의 '삭제'는
  휴지통 이동이라 문서가 남는다. 중복이어도 **체크를 막지 않고** 기본만 해제한다
- **`lib/sheetImport.ts`에 import 문을 두지 말 것**: `npm run test:sheet`가 이 파일 하나를 tsc로
  단독 컴파일한다. 타입도 로컬 정의. `--rootDir .`이 있어야 산출물이 `.test-build/lib/`로 떨어진다
- **`$$` 앞뒤 빈 줄 정규화를 여기서 하지 말 것** — `toPersistedBlock`이 소유한다. 두 곳에서 하면 규칙이 갈린다
- **그림·자동 수정의 순서가 규칙이다 (Phase 61e)**: `rowToDraft → splitFigures → autoFix →
  toPersistedBlock`. autoFix가 `\[..\]`·tabular를 새 `$$`로 바꾸고 `toPersistedBlock`이 그 `$$` 앞뒤
  빈 줄을 소유한다 — 뒤집으면 새로 생긴 `$$`가 정규화를 못 받는다. ⚠ **`stemHash`는 `normalizeText(E)`
  직후 값으로 고정**이다. 분할·자동 수정이 앞서면 자동 수정 토글 상태에 따라 중복 키가 바뀌어 같은 문항이
  **두 벌** 저장된다. ⚠ **자동 수정 호출부는 `SheetImportModal`이다** — `lib/sheetImport.ts`는 import 0
  규약이라 `proofread`를 부를 수 없다. ⚠ **image 블록의 `raw_text`는 저장 직전까지 빈 문자열**이다
  (미리보기 blob URL ↔ 저장 Storage URL — Y1 "미리보기=저장"의 유일한 예외). 파일명은
  `draft.blocksByTab[tab][i].figName`에 있고 `persisted[tab][i]`와 **인덱스가 정렬**된다 — 그 정렬을 깨지 말 것
- **`splitFigures`가 그림 없는 본문에 text 블록 1개를 돌려주는 갈래를 없애지 말 것 (Phase 61e)**:
  빈 문자열이어도 그렇다. 61a의 기존 동작과 비트 단위로 같아야 한다
- **Sheets 응답 함정**: ① 행 끝의 빈 셀이 잘려 온다 → 16칸 패딩 필수 ② `UNFORMATTED_VALUE`의
  체크박스 해제는 boolean `false`인데, 먼저 `String()`을 걸면 `"false"`라는 **비어 있지 않은 문자열**이
  되어 truthy 검사가 전부 참이 된다 → **원시값으로 판정할 것**
- **GAS 코드 인용은 GitHub origin/main만을 원천으로 하고 커밋 해시를 남길 것** — `~/Documents`의
  로컬 사본이 stale해 같은 파일을 두고 숫자가 갈린 왕복이 있었다(2026-08-22 clone으로 교체 완료)
- **환경변수 4종**(`GOOGLE_SA_EMAIL`·`GOOGLE_SA_PRIVATE_KEY`·`AUDITION_SPREADSHEET_ID`·`AUDITION_ALLOWED_UIDS`)은
  `.env.local`과 **Vercel(Production·Preview)에 등록 완료**. ⚠️ Vercel에는 private key의 **바깥 따옴표를 빼고**
  넣어야 한다 — 따옴표를 값의 일부로 저장하므로 PEM 파싱이 실패한다. 라우트는 `readEnv()`를 핸들러 안에서만
  호출하므로 변수가 없어도 **빌드는 깨지지 않고** 호출 시 500으로 어떤 변수가 없는지 이름만 알린다
- 로직 검증: `npm run test:sheet` (35개). 프로덕션 빌드 통과 확인(`/api/sheet-import`는 `ƒ` Dynamic)

### Phase 60 — list 로케일 블록 개편 (완료 · 검증 통과)

문서: `docs/phasedocs/Phase60 list 로케일 블록 개편 v4 실행판.md` (v1 web → v2 CLI → v3 web → v4 CLI)

- **저장 철학이 바뀌었다**: "저장은 국제 표준, 표시만 로케일"을 버리고 **로케일 블록** — 한국 문항은 `(가)`·`ㄱ.`을 그대로 입력·저장한다. 레거시 `(a)`/`(i)` 변환은 옛 문항 호환용으로 유지
- 로직 검증: `npm run test:locale` (15개)
- **덕수 검증 완료(2026-08-20)**: ① 인쇄 PDF 전후 동일(`phase60 before.pdf` 대조) ② 앱 마커 굵기·`ㄱ.` 여백 ③ `/shared`·`/p` 하드 로드 정렬 — 전항 통과

다음 작업 후보:
- PDF 정밀 레이아웃 (Puppeteer 또는 jsPDF)
- UI 디자인 (docs/ui-design-reference.md 참조)
- 공개 전 버그 청소 (`docs/prelaunch-bug-cleanup.md`)
