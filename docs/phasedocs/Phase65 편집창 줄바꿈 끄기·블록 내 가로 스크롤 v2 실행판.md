# Phase 65(가칭) — 편집창 줄바꿈 끄기(VS Code식) · 블록 내 가로 스크롤 · 토글 구현 계획서 v2

작성일: 2026-09-08 · 작성: CLI 실측 교차검토판
기준 커밋: **mathory `1c171ad`** (main, 2026-09-07)
입력: v1(web, 2026-09-07) + 덕수 결정 Q1~Q9(2026-09-08)

> **v2의 성격**: v1의 방향(§0 "세 가지를 걷어내면 VS Code식이 된다")은 **유지**하되,
> 안전성을 떠받치던 논거 하나가 실측으로 뒤집혔다(§2-2). 결정 Q1~Q9가 닫혔고
> **Q5가 Row 1 → Row 2로 바뀌면서** 버튼 규격·아이콘·게이트가 통째로 달라졌다(§3 D9).
> v1 대비 정정 10건·보완 8건은 **부록 C**에 표로 모아 두었다 — v1을 인용하기 전에 그것부터 볼 것.

---

## 0. 요약

편집창의 블록은 각각 CodeMirror 6 인스턴스다(`MarkdownEditor`). 지금은
`EditorView.lineWrapping` + 테마 `.cm-content { white-space: pre-wrap; word-break: break-all }` +
`.cm-scroller { overflow: visible }`로 **항상 줄바꿈**이고 블록 안에는 어느 방향으로도 스크롤이 없다
(세로는 전부 바깥 `.scaled-editor`가 맡는다 — Phase 56 규약).

요청 ①②는 CodeMirror의 **기본 상태**다 — base theme이 `.cm-content { white-space: pre }` ·
`.cm-scroller { overflow-x: auto }`이고 줄 번호 거터는 기본으로 `position: sticky`다(§2-1 실측).
우리가 얹은 세 줄을 **걷어내면** 그대로 VS Code식이 된다. 요청 ③은 그 세 줄을 **Compartment 하나**에
묶어 켜고 끄는 일이다.

변경은 **파일 6개 + 아이콘 2종**으로 끝난다:
`MarkdownEditor`(Compartment · `lineWrap` prop · `revealCursorX` 핸들 · 거터 배경) ·
`EditorView`(상태 · localStorage · ⌥Z · 수식 클릭 뒤 가로 노출 · 블록 래퍼 변수) ·
`UnifiedToolbar`(Row 2 토글 버튼 — 접힘 버튼 오른쪽) ·
`FindReplacePanel`(매치 이동 뒤 가로 노출) · `lib/editorScroll.ts`(가로 목표 계산 순수 함수) ·
`scripts/gen-phosphor-paths.mjs`(ICONS 1종 → 55→56종).
**Firestore 0 · 규칙 0 · 스키마 0 · 전처리 0 · 렌더 5사이트 0 · 미리보기·인쇄·열람·공유 0 · 댓글 에디터 0.**

기본값은 **현행(줄바꿈 켬)** 이라 토글에 손대지 않는 사용자에게는 바이트 단위로 같은 화면이다(D2).

이 계획서가 새로 지는 짐 넷:
(a) **세로 안전은 "높이가 auto로 풀린다"는 조건부다** — `overflow-y: hidden`은 프로그램적 스크롤을
막지 못하므로, 블록 CM 체인에 고정 높이가 들어오는 순간 `MarkdownEditor.tsx:822` 주석이 경고한
버그가 재현된다(§2-2 · D14가 규약으로 못 박는다)
(b) sticky 거터가 **투명**이라 가로 스크롤 시 글자가 거터 뒤로 지나간다 → 블록 표면색을 준다(D5)
(c) Mac 트랙패드 가로 스와이프가 블록 끝에서 **브라우저 뒤로가기**로 새어 나간다 → `overscroll-behavior-x: contain`(D7)
(d) 찾기/바꾸기·수식 클릭처럼 **프로그램이 커서를 옮기는 경로**는 CM이 가로로 따라가지 않는다
(우리가 `scrollIntoView`를 안 쓰므로) → 가로 노출 1줄을 두 경로에 붙인다(D8)

---

## 1. 현행 — 실측 (`1c171ad`)

| 항목 | 자리 | 현행 |
|---|---|---|
| 줄바꿈 | `MarkdownEditor.tsx:790` | `EditorView.lineWrapping` 상수 (⚠ `basicSetup`에는 **없다** — 실측) |
| 본문 white-space | `:827-832` 테마 `.cm-content` | `padding 16px · wordBreak break-all · whiteSpace pre-wrap · lineHeight 1.8` |
| 스크롤러 | `:820-826` 테마 `.cm-scroller` | `overflow: visible` · `fontFamily var(--font-ui)`. 주석: "auto로 두면 CM viewport가 상단 라인을 숨긴 채 멈춰 외곽 스크롤로 복구 안 되는 버그" |
| 거터 | `:833-838` | `backgroundColor: transparent` · `borderRight 1px var(--border-subtle)` → **투명** |
| 래퍼 높이 | `:996-1006` · 테마 `&{height:100%}` | `autoHeight`는 **어디서도 true가 아니다**(실측 — 소비처는 EditorPreview·CommentEditor의 동명 prop) → `height:100%` → 부모 체인이 auto라 **auto로 풀린다** |
| 블록 래퍼 | `EditorView.tsx:751-773` `SortableEditorBlock` `style` · 루트 `:829` | 네 변 0.5px · `background: emphasized ? --block-bg-active : --block-bg` · `overflow: hidden` · 활성 radius 8 |
| 블록 콘텐츠 | `:944-968` | `image·svg·ggb` → `MediaBlockContent` / **그 밖 전부** → `MarkdownEditor`(choices·heading 포함) |
| 세로 스크롤 규약 | CLAUDE.md · `lib/editorScroll.ts` | 외곽 `.scaled-editor`(`:3562`, `overflowY:'auto'` + `.no-scrollbar`)만. `fastScrollTo`는 **scrollTop만** 다룬다 |
| 프로그램적 커서 이동 | `FindReplacePanel.tsx:149-171` `navigateToMatch` · `EditorView.tsx:2447-2466` 수식 클릭 | `setSelection` → rAF/`setTimeout` → `getCursorCoords` → `fastScrollTo`(세로만). `scrollIntoView` 옵션은 **어디에도 없다** |
| 전역 가로 스크롤바 | `globals.css:249-262` | `::-webkit-scrollbar { width:0; height:5px }` thumb `--text-placeholder` — **"세로는 숨김, 가로는 유지"가 명시된 규약** |
| `.no-scrollbar` | `globals.css:265-273` | 그 요소 **자신**에게만 적용된다 → `.scaled-editor` 안의 `.cm-scroller`에는 전역 5px 규칙이 그대로 걸린다 |
| 보기 설정 저장 | `:194` `FONT_SIZE_KEY`(지역 상수) · `lib/constants.ts:36` `WIDTH_EM_KEY` | ⚠ **선례가 갈린다**: 가로폭 키만 constants에 있고 그 이유는 **ProblemView와 공유**하기 때문. 공유하지 않는 글꼴 키는 EditorView 지역 |
| Row 2 툴바 | `EditorView.tsx:3371-3417` → `UnifiedToolbar` | 좌: undo/redo(20px) + 구분선 / `UnifiedToolbar`(`flex:1`) / 우: 탭들 |
| 툴바 우측 항목 | `UnifiedToolbar.tsx:~640-737` `rightItems` | `… key → snippet → special → table → d1 → proofread → ai → search → d2 → **collapseAll**`(마지막) → `<OverflowItems>`(:793)가 폭 부족 시 넘김 |
| 툴바 버튼 규격 | `:185-203` `ICON_BTN_BASE` · `:204+` `IconButton` | 32×32 박스 · radius 6 · **active = `1px solid --accent-primary` + `ACTIVE_BG`(accent 8% 틴트) + accent color**. 아이콘은 `ICON_SIZE`(20, `toolbarIcons.tsx` 소유) |
| 툴바 아이콘 관행 | `:69-95` | `<PhIcon d={PH.xxx} size={ICON_SIZE} />` 직접 사용(‼ `Icons.tsx`의 `IconXxx` 팩토리를 거치지 않는다). **`CollapseAllIcon`(:94-96)이 이미 상태별 쌍**: `PH.collapseOut : PH.collapseIn` |
| 툴바 게이트 | `EditorView.tsx:3040` `showToolbar = activeBlock && TEXT_BASED_TYPES.has(activeBlock.type)` | false면 툴바 루트가 `opacity .35 · pointerEvents none` → **그림·SVG·GGB 블록이 활성이면 접힘 버튼조차 눌리지 않는다**(기존 성질) |
| 전역 단축키 | `:2538-2573` window keydown | ⌘Z(`e.code`) · ⌘F/B/J(`e.key`) · ⌘⇧L(`e.code`). CM 안: `Alt-Tab`(`:640`) · `Ctrl-Alt-1~9`(`:645`). **Alt+Z 미사용** |
| 툴바 커스터마이즈 | `hooks/useToolbarConfig.ts` | 소비처는 `MathSymbolPalette` **하나**뿐 → `rightItems`는 사용자 배치 대상이 **아니다**(고정) |
| 다른 CM | `components/comment/LatexInputEditor.tsx:85` | 댓글 입력 — 이번 범위 밖 |

---

## 2. CodeMirror 6.39.14 실측 — 왜 "걷어내면 된다"인가

### 2-1. base theme · 거터 (`@codemirror/view/dist/index.js`)

- `.cm-scroller`(6685): `display:flex !important · alignItems:flex-start !important · height:100% · **overflowX: auto** · position:relative · zIndex:0 · overflowAnchor:none`
  → **기본이 가로 스크롤 컨테이너**다.
- `.cm-content`(6696): `**whiteSpace: pre** · wordWrap: normal · flexGrow:2 · **flexShrink:0** · minHeight:100% · boxSizing:border-box`
  → 기본이 안 접힘. 넘치면 `flex-shrink:0`이라 그대로 넘친다.
- `.cm-lineWrapping`(6711): `whiteSpace:break-spaces · wordBreak:break-word · overflowWrap:anywhere · **flexShrink:1**`
  → `EditorView.lineWrapping`(8795)은 이 **클래스를 `contentAttributes`로 붙이는 것뿐**이다.
- **선택 판정은 클래스가 아니라 computed white-space다**: `measure()`(6195-6200)가 매 measure마다
  `getComputedStyle(contentDOM).whiteSpace`를 읽어 `heightOracle.mustRefreshForWrapping(whiteSpace)`으로
  판정한다. 클래스를 보는 곳(6118 `guessWrapping`)은 **ViewState 생성자 1회**(초기 추측)뿐이다.
  → 우리 테마의 `whiteSpace: pre-wrap`이 사실상 선택을 결정하고 있었다. **facet과 테마를 함께** 빼야
  높이 오라클이 정확히 감시한다(D3).
- 거터(11137-11152): `GutterView`가 `.cm-gutters` **단일 div**를 만들고 `unfixGutters` facet이 없으면
  `this.dom.style.position = "sticky"`. `basicSetup`의 `lineNumbers()`와 `lintGutter()`는 그 **하나의**
  div 안에 들어간다(‼ "둘 다 sticky"가 아니다). base theme `.cm-gutters`(6787)는 `zIndex: 200`이라
  가로 스크롤 시 본문 위에 뜬다.
- ⚠ 지금 거터 sticky가 "무효"인 것이 아니다 — `.cm-scroller`가 `overflow: visible`이면 sticky의 기준은
  가장 가까운 스크롤 조상 `.scaled-editor`가 되고, **거기에 가로 넘침이 없어 발동하지 않을 뿐**이다
  (`.scaled-editor`는 인라인 `overflowY:'auto'`만 있어 computed `overflow-x`가 **auto**다 — §2-2 프로브 3·4행).
  off 모드에서는 기준이 `.cm-scroller`로 옮겨 온다.

### 2-2. 세로 규약과 충돌하지 않는 근거 — **v1에서 논거가 바뀐 자리**

CM은 타이핑·화살표 이동 트랜잭션에 `scrollIntoView: true`를 붙이고 `scrollRectIntoView(scrollDOM, …)`로
**조상을 거슬러 오르며** 스크롤한다(520-600). 스킵 조건은 다음과 같다(536):

```js
if (cur.scrollHeight <= cur.clientHeight && cur.scrollWidth <= cur.clientWidth) { cur = parent; continue; }
```

**AND다.** 가로 여지가 생기는 순간 `.cm-scroller`는 **더 이상 스킵되지 않고** `moveY`도 계산해
`cur.scrollTop += moveY`를 실제로 실행한다(588-593). 즉 v1의 "루프가 `scrollLeft`만 조정한다"는
성립하지 않는다 — **세로 여지가 0이라 브라우저가 클램프해 무해할 뿐**이다.

그리고 그 "세로 여지 0"의 이유도 v1과 다르다. 헤드리스 Chrome 프로브(구조 재현: 블록 래퍼
`overflow:hidden` > `height:100%` 래퍼 > `.cm-editor` > `.cm-scroller`, 전역 `::-webkit-scrollbar{height:5px}`):

| 조건 | computed overflow-y | clientH | scrollH | offsetH | **세로 여지** | `scrollTop=50` 시도 결과 |
|---|---|---|---|---|---|---|
| auto 높이 + `overflow-y:hidden` | hidden | 329 | 329 | **334** | **0** | **0** (못 밀림) |
| auto 높이 + `overflow-y` 미지정 | **auto** | 329 | 329 | 334 | 0 | 0 |
| **고정 높이 120** + `overflow-y:hidden` | hidden | 115 | 147 | 122 | **32** | **32 (밀림)** |
| 고정 높이 120 + `overflow-y` 미지정 | **auto** | 115 | 147 | 122 | 32 | 32 |

읽어 낸 것 넷:

1. **`height`가 auto로 풀리는 박스에서 가로 스크롤바는 콘텐츠를 잠식하지 않고 박스를 5px 키운다**
   (`clientH 329` 유지 · `offsetH 334`). 그래서 세로 여지가 0이다 — v1의 "높이가 콘텐츠 높이라서"가
   아니라 **"높이가 auto라서"** 다.
2. **`overflow-y: hidden`은 프로그램적 스크롤을 막지 못한다**(고정 높이 행: hidden인데 32px 밀림).
   막는 것은 오직 "여지가 0"이라는 사실 하나다.
3. **한 축만 지정하면 다른 축은 `visible`로 남지 못하고 `auto`가 된다**(2·4행). 그래도
   `overflow-y: hidden`을 **명시**한다 — 의도를 코드에 남기고, 훗날 여지가 생겼을 때 사용자가
   실수로 세로 스크롤하는 것까지는 막기 위해서다.
4. 따라서 **세로 안전 전체가 "블록 CM 체인에 고정 높이가 없다"는 조건 위에 서 있다.** 이것이 D14다.

부수 사실: 프로브에서 `sticky` 거터는 가로 스크롤 200px 뒤에도 좌단(1px = border)에 그대로 남았고,
`transparent`일 때 배경이 `rgba(0,0,0,0)`으로 확인됐다 → D5의 근거.

### 2-3. CM이 가로를 스스로 처리해 주는 것 / 우리가 챙겨야 하는 것

**CM이 해 준다**(코드 0줄):
- 타이핑·화살표·Home/End: 위 `scrollRectIntoView`가 `scrollLeft`를 민다.
- **드래그 선택의 가장자리 자동 스크롤**: `scrollParents.x.scrollLeft += x`(4707) — off 모드에서
  텍스트를 드래그해 오른쪽 끝에 닿으면 따라간다(의도된 이득, §6-3에서 확인).
- DOM 변경 후 가로 스크롤 유지: `observers.scroll`이 `lastScrollLeft`를 기록(4831)한다.

**우리가 챙긴다**:
- 프로그램적 `setSelection`(찾기/바꾸기 · 수식 클릭)은 `scrollIntoView`가 없어 가로로 안 따라간다 → D8.
- ⚠ **`observers.focus`(5124-5129)는 `scrollTop`이 0이면 `lastScrollLeft`를 복원한다.** 우리는
  `scrollTop`이 **항상** 0이라 이 조건이 늘 참이다 → **`revealCursorX()`는 반드시 `focus()` 뒤**여야
  한다(수식 클릭 경로는 `ref.focus()`가 먼저라 순서가 이미 맞다 — 순서를 바꾸지 말 것).

### 2-4. 대안 검토 — CSS 클래스만으로 (`[data-wrap=off] .cm-content{white-space:pre!important}`)

글자 크기가 이미 이 방식이고(`EditorView.tsx:3137`), §2-1에서 확인했듯 CM은 computed white-space를
매 measure마다 읽으므로 **동작은 한다**. 그래도 Compartment를 택한다:
① state 변경이 있어야 CM이 measure를 **확실히 예약**한다(CSS만 바꾸면 다음 measure 계기까지 한 프레임
높이가 틀어질 수 있다) ② `!important`로 CM 주입 테마를 이기는 규칙이 앱 전역에 하나 더 는다
③ `.cm-lineWrapping`의 `flex-shrink:1`은 클래스가 붙어 있어야 꺼진다 — CSS만으로는 `.cm-content`가
계속 줄어들려 한다. Compartment는 셋을 한 번에 처리하고 코드도 짧다.

---

## 3. 결정 사항 (D1~D14 · 덕수 확정 2026-09-08)

**D1 — 범위: 편집창 블록 CM(`MarkdownEditor`)만**
미리보기·인쇄·열람·공유 라우트는 렌더된 문서라 무관. 댓글 `LatexInputEditor`는 좁은 패널이라 줄바꿈이
맞으므로 제외. `MediaBlockContent`(image·svg·ggb)는 CM이 아니다. **choices·heading 블록은 `MarkdownEditor`를
쓰므로 포함**된다(§1 `:944-968`).

**D2 — 기본값 = 줄바꿈 **켬**(현행) · 전역 localStorage `mathory-editor-wrap`(`'on'|'off'`)** [Q1·Q2 확정]
글자 크기·가로폭과 같은 계층(문항·탭·블록 무관, 기기별). 문항별로 두면 "같은 문항인데 조판이 바뀐 것처럼"
보이는 혼란이 생긴다(가로폭 키를 ProblemView와 공유한 이유의 역).
⚠ **키는 `EditorView.tsx` 지역 상수다** — `lib/constants.ts`가 아니다(부록 C-3).

**D3 — Compartment 하나에 "선택 3종"을 묶는다**
```ts
// 모듈 최상위 상수 2개 — 매 토글마다 EditorView.theme()를 새로 만들면 StyleModule이 다시 마운트된다.
// (CM theme은 KaTeX macros와 달리 in-place 수정이 없어 상수로 안전하다)
const WRAP_ON: Extension = [
  EditorView.lineWrapping,
  EditorView.theme({
    '.cm-content': { whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
    '.cm-scroller': { overflow: 'visible' },
  }),
];
const WRAP_OFF: Extension = EditorView.theme({
  '.cm-content': { whiteSpace: 'pre' },
  '.cm-scroller': { overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain' },
});
const wrapExtensions = (on: boolean) => (on ? WRAP_ON : WRAP_OFF);
```
기존 테마(`:820-832`)에서 `overflow` · `wordBreak` · `whiteSpace` **세 줄을 지우고** 이 함수로 옮긴다.
나머지(`padding` · `lineHeight` · `fontFamily`)는 그대로 둔다 → **켬 모드의 결과 CSS가 현행과 동일**해야
한다(§6-1 회귀).
prop `lineWrap?: boolean`(기본 `true`) · 초기 state에 `wrapCompartment.of(wrapExtensions(lineWrapRef.current))` ·
별도 `useEffect([lineWrap])`에서 `view.dispatch({ effects: wrapCompartment.reconfigure(...) })`.
텍스트→텍스트 블록 타입 변경은 CM을 재마운트하지 않으므로(`EditorView.tsx:1750` 주석) Compartment가
그대로 이어지고, 접혔다 펼친 블록은 새 CM이라 prop으로 현재 값을 받는다.

**D4 — 스크롤 계층: 세로는 여전히 `.scaled-editor` 단독, 가로만 블록 스크롤러**
`.cm-scroller`가 스크롤 컨테이너가 되지만 **가로 전용**이다(§2-2). `lib/editorScroll.ts`의 "편집 패널의
모든 자동 스크롤은 이 모듈을 거친다"는 그대로 두고, 가로 목표 계산 함수 하나를 **같은 파일에** 둔다(D8) —
편집창 스크롤 코드가 두 파일로 갈라지지 않게. `EditorView.scrollIntoView` 금지도 유지한다(세로를 같이 민다).

**D5 — 거터를 블록 표면색으로 불투명하게**
sticky 거터가 투명이면 스크롤된 글자가 줄 번호 뒤로 지나간다(§2-2 프로브 확인). `SortableEditorBlock`의
`style`(`:751-773`)에 CSS 변수를 하나 얹고
```ts
['--block-surface' as any]: emphasized ? 'var(--block-bg-active)' : 'var(--block-bg)',
```
테마의 `.cm-gutters` 배경을 `'var(--block-surface, var(--block-bg))'`로 바꾼다.
⚠ **폴백 필수** — 변수가 없으면 `unset`이 되어 base theme의 `&light .cm-gutters { backgroundColor:#f5f5f5 }`
(회색 띠)가 살아난다(부록 C-5). ⚠ `inherit`은 안 된다 — `.cm-editor`가 `backgroundColor:'transparent'`를
명시하고 있어 그것이 상속된다.
**켬·끔 공통**으로 둔다: 지금도 투명 거터 뒤로 래퍼 배경이 비쳐 보이므로 합성 결과가 같고, 활성 행의
반투명 거터 강조(`rgba(184,155,120,.20)`)는 어느 쪽이든 그 위에 얹힌다.
거터의 `borderRight 1px --border-subtle`은 그대로 — 가로 스크롤 시 "본문이 이 선 밑으로 들어간다"는
경계 신호가 된다(VS Code 거터 경계와 같은 역할).

**D6 — 가로 스크롤바: 전역 5px 규약 그대로 노출** [Q3 확정 · 실물 판정 항목]
`globals.css:248`이 "세로는 숨김, **가로는 유지**"를 명시한 규약이라 아무것도 안 하면 5px thumb이 나온다.
`::-webkit-scrollbar`가 정의돼 있으면 macOS 오버레이 설정과 무관하게 **항상 표시**된다.
대가는 **블록 높이 5px 점프**(실측 `clientH 329` → `offsetH 334`): 줄이 넘치기 시작하거나 짧아져 안 넘치게
되는 순간 그 블록이 5px 자라고 아래가 밀린다. 세로 스크롤 오염은 **없다**(§2-2).
대안(숨기고 트랙패드·⇧휠로만)은 마우스 사용자가 방법을 모른다 → 노출. Firefox 등 webkit 규칙 미적용
브라우저는 `scrollbarWidth: 'thin'`을 `WRAP_OFF` 테마에 덧붙여 보정한다.

**D7 — `overscroll-behavior-x: contain`**
Mac Safari·Chrome은 스크롤 컨테이너 끝에서 이어지는 가로 스와이프를 **뒤로가기 제스처**로 넘긴다.
편집 중 뒤로가기는 곧 편집 화면 이탈이다(라우팅이 AppShell 상태라도 브라우저 history가 움직인다).
`WRAP_OFF` 테마의 `.cm-scroller`에 넣는다.

**D8 — 프로그램적 커서 이동 두 경로에 가로 노출 1줄**
`MarkdownEditorHandle`에 `revealCursorX(): void` 추가:
```ts
revealCursorX() {
  const view = viewRef.current; if (!view) return;
  const s = view.scrollDOM;
  if (s.scrollWidth <= s.clientWidth) return;          // 켬 모드·짧은 줄 → 무동작
  const c = view.coordsAtPos(view.state.selection.main.head); if (!c) return;
  const r = s.getBoundingClientRect();
  const g = s.querySelector('.cm-gutters') as HTMLElement | null;
  const left = g ? g.getBoundingClientRect().right : r.left;   // sticky 거터가 가리는 폭을 뺀다
  s.scrollLeft = computeRevealScrollLeft({ left, right: r.right }, c.left, s.scrollLeft);
}
```
애니메이션 없음(가로는 `fastScrollTo`의 세대 카운터와 무관). 호출부 둘:
`FindReplacePanel.navigateToMatch`의 rAF 안 — **`getCursorCoords()` 앞**(가로를 먼저 맞춘 뒤 좌표를 읽어야
세로 계산에 쓰는 `coords.top`이 같은 줄을 가리킨다) · `EditorView` 수식 클릭(`:2462` `highlightMath` 뒤,
**`ref.focus()` 뒤**여야 한다 — §2-3).
게이트 없이 **항상 부른다**(켬 모드에서는 첫 줄에서 무동작으로 빠진다) — 분기가 없어야 회귀가 없다.
⚠ **붙이지 않는 경로**: typewriter(`maybeRecenterOnBottomTyping`) · 블록 활성 자동 스크롤 ·
`handleSelectBlockBar` — 사용자 입력이거나 세로 전용이라 CM이 이미 가로를 처리한다(§2-3).

**D9 — 토글 UI: Row 2 툴바 `rightItems` **맨 끝**(접힘 버튼 오른쪽)** [Q5 = 덕수 지정]
⚠ v1의 Row 1(가로폭·글꼴 스테퍼 옆) 안은 **폐기**. 자리가 바뀌면서 규격이 통째로 달라진다:
- 컴포넌트는 `UnifiedToolbar`의 지역 `IconButton`(`:204`) — 32×32 · radius 6 ·
  **active = `1px solid --accent-primary` + `ACTIVE_BG`(accent 8%) + accent color**. 댓글·agent 버튼의
  "색만 바꾸는" pressed 규약이 아니다.
- 아이콘 크기는 **`ICON_SIZE`(20)** — v1의 24 정방(IconTextWidth와 짝)은 Row 1 기준이라 폐기.
- 렌더는 `<PhIcon d={PH.xxx} size={ICON_SIZE} />` **직접**. `Icons.tsx`에 `IconTextWrap`을 export하지
  않는다(Row 2의 확립된 관행 — `:69-95`).
- **`active={!lineWrap}`** — `collapseMode`·`searchOpen`과 같은 문법으로 "기본이 아닌 상태에 들어가 있다"는
  신호다. 켬이 기본이므로 켬을 active로 칠하면 버튼이 늘 켜져 보인다.
- **아이콘은 `arrow-elbow-down-left`(↵) 하나 · 상태는 박스가 나른다** [D9′ — 덕수 판정 2026-09-08].
  ⚠ 계획 초안의 상태별 쌍(`CollapseAllIcon` 방식)은 **폐기**됐다: 끔 도안 후보였던
  `arrows-out-line-horizontal`(↔)이 **Row 1의 가로폭 아이콘 `IconTextWidth`와 겹쳐 보인다**.
  도안이 기능(줄바꿈)을 가리키고 켜짐만 박스로 표시하는 편이 헷갈리지 않는다.
  Phosphor에 "text-wrap"은 **없다**(카탈로그 실측).
- `title`: 켬 `'줄바꿈 끄기 — 좌우 스크롤 (⌥Z)'` / 끔 `'줄바꿈 켜기 (⌥Z)'`.
- `OverflowItems`(`:793`)가 폭 부족 시 자동으로 오버플로 메뉴에 넣는다 — 추가 작업 없음.
- ⚠ **`showToolbar` 게이트 아래다**(`EditorView.tsx:3040`) — 그림·SVG·GGB 블록이 활성이면 눌리지 않는다.
  **접힘 버튼이 이미 똑같으므로 선례를 따른다**(전체 접기도 전역 동작인데 같은 게이트 아래다).
  실질 손실은 ⌥Z가 메운다(D10 — window 리스너라 게이트와 무관).
- ⚠ `useToolbarConfig`는 `MathSymbolPalette` 전용이라 이 버튼은 **사용자 배치 대상이 아니다**(고정).
  v1 D10의 "Row 2 툴바 설정에 넣는 대안" 논의는 전제가 틀렸다.

**D10 — 단축키 ⌥Z (Windows Alt+Z) — VS Code와 동일** [Q6 확정]
`EditorView.tsx:2539` window keydown 핸들러 **맨 앞**에:
```ts
if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.code === 'KeyZ') {
  e.preventDefault();            // macOS ⌥Z는 'Ω'를 입력한다 — 막지 않으면 글자가 들어간다
  toggleLineWrap();
  return;
}
```
`e.code`를 쓰는 이유는 ⌘Z 분기(C5, 한글 IME)와 같다. `!e.shiftKey`로 ⌥⇧Z(`¸`)를 흘려보낸다.
`!e.ctrlKey`가 Windows AltGr(= Ctrl+Alt)을 배제한다. CM 안 충돌 없음(`Alt-Tab`·`Ctrl-Alt-1~9`만 존재).
deps에 `toggleLineWrap` 추가. 텍스트 편집 중이든 아니든 **항상 동작**한다(⌘Z와 달리 텍스트 undo와
겹칠 일이 없다).

**D11 — 토글 직후 스크롤 위치** [Q8 확정]
끔→켬: `overflow: visible`이 되며 `scrollLeft`가 0으로 풀린다(추가 코드 없음).
켬→끔: 활성 블록의 커서가 오른쪽 밖으로 사라지지 않도록 `revealCursorX()` 1회.
```ts
useEffect(() => {
  if (lineWrap || !activeBlockId) return;         // 켬으로 갈 때는 할 일이 없다
  const ref = editorRefs.current[activeBlockId];
  requestAnimationFrame(() => ref?.revealCursorX());   // reconfigure 뒤 CM measure를 기다린다
}, [lineWrap, activeBlockId]);
```
`activeBlockId`가 deps에 있어 끔 모드에서 블록을 바꿀 때도 도는데, 그것은 바람직한 동작이라 그대로 둔다.
세로: 블록 높이가 일제히 바뀌므로 `.scaled-editor`의 `scrollTop`이 가리키는 내용이 달라진다.
`activeBlockId`는 불변이라 블록 활성 effect는 돌지 않고(`skipNextBlockScrollRef` 계약 무관),
**세로 보정은 넣지 않은 채 실물을 보고 판단한다** — 필요하면 `computeBlockAwareScrollTop` 1회(공용 함수
경유, CLAUDE.md 규약).

**D12 — IME 조합 중 토글은 무시한다** [Q7 확정 · v1에 없던 항목]
이 프로젝트는 CM DOM 갱신이 한글 조합을 깨뜨린 전례가 둘이다(`lib/latex-highlight.ts`의 composing 가드,
`latexLinter`의 `view.composing` 가드 — `MarkdownEditor.tsx:286`). wrap reconfigure는 `.cm-content`의
white-space를 바꿔 전면 재측정을 유발하므로 같은 위험이 있다. 핸들에 **`isComposing()`이 이미 있다**(`:438`):
```ts
const toggleLineWrap = useCallback(() => {
  const active = activeBlockId ? editorRefs.current[activeBlockId] : null;
  if (active?.isComposing()) return;      // 조합 중이면 무동작 (지연 재시도 없음)
  setLineWrap((prev) => { const next = !prev; setStoredLineWrap(next); return next; });
}, [activeBlockId]);
```
대안(`compositionend`까지 지연)은 "눌렀는데 반응이 늦는" 느낌이라 택하지 않는다.

**D13 — 보류(이번 범위 밖): "수식 줄만 안 접기" 혼합 모드**
`Decoration.line`으로 `$$…$$` 줄에만 `white-space: pre`를 주는 안은, CM 높이 오라클이 **문서 단위** 선택을
전제하므로(§2-1 — `heightOracle`의 단일 wrapping 플래그) 뷰포트 밖 줄 높이 추정이 틀어져 세로 점프가 된다.
Mathory 세로 스크롤은 이미 민감한 자리다(Phase 56). 이번엔 토글 두 상태로 가고, 요구가 생기면 별도 타당성 검토.

**D14 — 새 규약: 블록 CM 체인에 고정 높이를 주지 말 것** [§2-2에서 도출 · v1에 없던 항목]
`.cm-scroller`의 세로 스크롤 여지가 0인 것은 **높이가 `auto`로 풀린다**는 조건에 전적으로 의존한다
(실측: auto = 여지 0 / 고정 120px = 여지 32px). `overflow-y: hidden`은 **프로그램적 스크롤을 막지 못하므로**,
여지가 생기는 순간 `scrollRectIntoView`가 밀어붙이고 사용자는 되돌릴 수 없다 —
`MarkdownEditor.tsx:822` 주석이 경고한 바로 그 버그다. 체인은
`.scaled-editor` → 블록 래퍼(`:829`) → `<div padding:0>`(`:945`) → 래퍼 div(`:996`, `height:100%`) →
`.cm-editor`(`height:100%`) → `.cm-scroller`(`height:100%`)이고, **어느 마디에도 px 높이·`maxHeight`·
`aspect-ratio`를 넣지 말 것**. (같은 계열의 기존 함정: CLAUDE.md "스크롤 패널에 `paddingBottom:100vh` 금지".)

---

## 4. 현행 규약과의 충돌 점검

| 규약 | 이번 계획 | 판정 |
|---|---|---|
| CLAUDE.md "`.cm-scroller`가 `overflow:visible`이라 내부 스크롤 없음 → `EditorView.scrollIntoView` 금지" | 가로만 `auto`. `scrollIntoView` 금지 **유지** | **문구 개정 필요**(§5-7) — 빠뜨리면 다음 사람이 `overflow-x:auto`를 규약 위반으로 되돌린다 |
| "모든 세로 스크롤은 `lib/editorScroll.ts` 경유" | 가로 함수도 같은 파일 | 준수 · 파일 헤더 주석에 "가로 목표 계산도 여기" 추가 |
| "`[data-noscroll]` 컨테이너는 세로 스크롤 금지" | `.cm-scroller`는 대상 아님 · 세로 여지 0 | 무관 — 그래도 §6-5에서 콘솔 경고 0 확인 |
| Phase 45a "조건부 style에 longhand 병합 주의 / 네 변 전부" | 추가는 CSS 변수 1개(`--block-surface`)뿐, border 무접촉 | 무관 |
| Phase 45a "편집창 블록 인셋 E형 — 좌측 기준선 16px" | `.cm-content` padding 불변 | 준수 — 가로 스크롤 시 왼쪽 16px 여백이 콘텐츠와 함께 흐른다(첫 화면은 동일) |
| "다크 모드 없다" | 새 색 토큰 0(`--block-surface`는 기존 토큰의 별칭) | 준수 |
| M4 "Row 2는 전 버튼 20px · 브라켓 폐기 · 아이콘은 Phosphor regular 단일" | `ICON_SIZE`(20) · `PhIcon` 직접 · 브라켓 없음 | 준수 |
| M4 "생성 파일 수동 편집 금지 · `icons:check`가 빌드 실패" | ICONS 표 1행 → `icons:gen` → 커밋 | 준수(55 → **56종**) |
| M5 "UI 상시 아이콘에 mask 금지(인라인 path)" | `PhIcon` = 인라인 path | 준수 |
| M2 R6 "Row 1·Row 2는 우측 패널에 덮인다" | Row 2 오른쪽 끝이라 패널이 열리면 가려질 수 있다 | **알고 둔다** — 접힘 버튼도 같고, ⌥Z가 대체 경로 |
| 설계 기준 "보수적으로 하라" | 기본값 현행 유지 · 토글은 사용자 명시 | 준수 |

---

## 5. 구현 항목

### 5-1. `lib/editorScroll.ts` (신규 함수 1개)
```ts
/** 가로 노출 목표(scrollLeft). 커서가 이미 스크롤러 안이면 현재값 그대로 → 켬 모드·짧은 줄에서 무해.
 *  ⚠ 세로 규약과 별개다: 가로는 `.cm-scroller`(줄바꿈 끔) 소유, 세로는 여전히 `.scaled-editor` 단독. */
export function computeRevealScrollLeft(
  scroller: { left: number; right: number },
  cursorLeft: number,
  scrollLeft: number,
  margin = 24,
): number {
  if (cursorLeft < scroller.left + margin) {
    return Math.max(0, scrollLeft - (scroller.left + margin - cursorLeft));
  }
  if (cursorLeft > scroller.right - margin) {
    return scrollLeft + (cursorLeft - (scroller.right - margin));
  }
  return scrollLeft;
}
```
파일 헤더 주석의 역할 목록에 "가로 목표 계산: computeRevealScrollLeft" 한 줄 추가.
⚠ `scroller.left`에는 **sticky 거터의 오른쪽 변**을 넘긴다(호출부가 계산 — D8). 거터가 본문 앞을 가리기
때문이고, `offsetWidth`가 아니라 rect를 쓰는 이유는 거터가 `.cm-scroller`의 자식이라 rect가 sticky 위치를
이미 반영하기 때문이다.

### 5-2. `components/editor/MarkdownEditor.tsx`
1. `import { EditorState, Prec, Compartment } from '@codemirror/state'`.
2. 모듈 최상위에 `WRAP_ON` · `WRAP_OFF` · `wrapExtensions`(D3).
3. props에 `lineWrap?: boolean`(기본 `true`) · `lineWrapRef` · `wrapCompartment = useRef(new Compartment())`.
4. extensions 배열의 `EditorView.lineWrapping`(`:790`) → `wrapCompartment.current.of(wrapExtensions(lineWrapRef.current))`.
5. 기존 테마에서 **삭제**: `.cm-scroller`의 `overflow: 'visible'` · `.cm-content`의 `wordBreak` · `whiteSpace`.
   (`fontFamily` · `padding` · `lineHeight`는 남긴다.)
6. `.cm-gutters`의 `backgroundColor: 'transparent'` → `'var(--block-surface, var(--block-bg))'`(D5).
7. `useEffect(() => { viewRef.current?.dispatch({ effects: wrapCompartment.current.reconfigure(wrapExtensions(lineWrap)) }); }, [lineWrap])`.
8. 핸들에 `revealCursorX()`(D8) — 인터페이스 선언 + `useImperativeHandle` 구현.
9. `:821-822` 스크롤 주석 갱신: "세로는 없음(`overflow-y:hidden`, 높이 auto — **고정 높이를 주면 D14가 깨진다**),
   가로는 줄바꿈 끔에서 이 스크롤러가 담당".

### 5-3. `components/editor/EditorView.tsx`
1. 지역 상수·헬퍼(`FONT_SIZE_KEY` 선례, `:194` 옆):
   ```ts
   const LINE_WRAP_KEY = 'mathory-editor-wrap';
   function getStoredLineWrap(): boolean {
     if (typeof window === 'undefined') return true;
     try { return localStorage.getItem(LINE_WRAP_KEY) !== 'off'; } catch { return true; }
   }
   function setStoredLineWrap(on: boolean) {
     try { localStorage.setItem(LINE_WRAP_KEY, on ? 'on' : 'off'); } catch {}
   }
   ```
2. `const [lineWrap, setLineWrap] = useState(true);` + 마운트 effect에서 `setLineWrap(getStoredLineWrap())`
   (가로폭 선례 — hydration mismatch 회피).
3. `toggleLineWrap`(D12) · 토글 직후 가로 노출 effect(D11).
4. `SortableEditorBlock`에 `lineWrap` prop 추가 → `<MarkdownEditor lineWrap={lineWrap} …/>`(`:960`).
5. `style`(`:751-773`)에 `['--block-surface' as any]`(D5).
6. window keydown(`:2539`) 맨 앞에 ⌥Z 분기(D10) · deps에 `toggleLineWrap`.
7. 수식 클릭(`:2462` `ref.highlightMath(...)` 뒤)에 `ref.revealCursorX();`.
8. `<UnifiedToolbar>`(`:3396~`)에 `lineWrap={lineWrap}` · `onToggleLineWrap={toggleLineWrap}`.

### 5-4. `components/editor/UnifiedToolbar.tsx`
1. props 인터페이스(블록 영역, `:171-176`)에 `lineWrap: boolean; onToggleLineWrap: () => void;` · 구조분해(`:603-604`).
2. `CollapseAllIcon`(`:94-96`) 옆에:
   ```tsx
   /** 줄바꿈 토글 — wrapped=true면 접힘(↵), false면 좌우로 뻗음(↔) */
   function LineWrapIcon({ wrapped }: { wrapped: boolean }) {
     return <PhIcon d={wrapped ? PH.arrowElbowDownLeft : PH.arrowsOutLineHorizontal} size={ICON_SIZE} />;
   }
   ```
3. `rightItems` **맨 끝**(`collapseAll` 뒤)에:
   ```tsx
   {
     key: 'lineWrap',
     node: (
       <IconButton
         title={lineWrap ? '줄바꿈 끄기 — 좌우 스크롤 (⌥Z)' : '줄바꿈 켜기 (⌥Z)'}
         onClick={onToggleLineWrap}
         active={!lineWrap}
       >
         <LineWrapIcon wrapped={lineWrap} />
       </IconButton>
     ),
   },
   ```

### 5-5. `components/editor/FindReplacePanel.tsx`
`navigateToMatch`의 rAF 안(`:161~`), `handle.getCursorCoords()` **앞**에 `handle.revealCursorX();`
(가로를 먼저 맞춘 뒤 좌표를 읽어야 세로 계산의 `coords.top`이 같은 줄을 가리킨다).

### 5-6. 아이콘
`scripts/gen-phosphor-paths.mjs`의 ICONS 표에 2행:
```js
arrowElbowDownLeft: ['arrow-elbow-down-left', 'regular'],  // LineWrapIcon (D9′ — 상태는 박스가 나른다)
```
→ `npm run icons:gen` → `components/ui/phosphorPaths.ts` 재생성(수동 편집 금지) → `npm run icons:sheet`로
**실물 판정** → 커밋. `prebuild`의 `icons:check`가 55 → **56종**을 확인한다.
두 파일명 모두 `@phosphor-icons/core` regular에 **존재 확인 완료**.

### 5-7. 문서
- **CLAUDE.md** "편집창 CodeMirror 스크롤" 항목 개정:
  > `.cm-scroller`는 **세로** 스크롤이 없다(`overflow-y:hidden`이고 높이가 auto라 여지 자체가 0) →
  > `EditorView.scrollIntoView` 금지는 그대로. **가로**는 줄바꿈을 끄면(⌥Z, `mathory-editor-wrap`)
  > 이 스크롤러가 담당하며, 타자·화살표·드래그는 CM이, 프로그램적 커서 이동(찾기·수식 클릭)은
  > `revealCursorX`가 따라간다. ⚠ **블록 CM 체인에 고정 높이를 주지 말 것**(D14) — 세로 여지가
  > 생기는 순간 `overflow-y:hidden`이 프로그램적 스크롤을 못 막아 복구 불가 상태가 된다.
  거터 배경 `--block-surface` 한 줄, Row 2 버튼 1개 추가도 함께.
- `docs/roadmap.md` Phase 65 절 · 확정본을 `docs/phasedocs/`로(작업 규칙 7).

### 5-8. 건드리지 않는 것 (확인)
`EditorPreview` · `PrintableContent` · `PrintStyles.css` · 공개 라우트 · `LatexInputEditor` · `CommentEditor` ·
`lib/editorScroll.ts`의 기존 3함수 · typewriter · 블록 활성 스크롤 · `handleSelectBlockBar` ·
`ChoicesBlock` · `MediaBlockContent` · `useToolbarConfig`(Row 2 팔레트) · `Icons.tsx` ·
`.cm-content`의 padding·lineHeight · 글자 크기 `<style>` 주입(`:3137`) · Firestore·타입·API.

---

## 6. 검증 계획

**6-1. 회귀 — 켬 모드가 현행과 동일한가** (가장 중요)
토글에 손대지 않은 상태에서 DevTools로 `.cm-content` · `.cm-scroller` · `.cm-gutters`의 computed style을
착수 전과 대조: `white-space`(`break-spaces`) · `word-break` · `overflow` · 거터 `background-color`의
**시각 결과**. 활성/비활성 블록 각 1장 스크린샷 대조. 거터 배경이 투명→클레이로 바뀌었으나 합성 결과가
같은지 `getComputedStyle` + 스크린샷 픽셀로 확인(활성 카드의 radius 8 모서리 안쪽 포함 — 래퍼가
`overflow:hidden`이라 클리핑이 같아야 한다).

**6-2. 끔 모드 기본 동작**
`$$`가 든 200자 한 줄 블록에서: 접히지 않음 · 5px 가로 스크롤바 · **거터 고정, 본문만 흐름** ·
**거터 뒤로 글자가 비치지 않음**(D5) · 왼쪽 16px 기준선(첫 화면) 유지 · 활성 카드 radius 안쪽 클리핑 정상.

**6-3. 커서 따라가기**
줄 끝까지 타자(자동 가로 스크롤, CM) · Home/End · ←→로 경계 넘기 · **한글 IME 조합 중 경계 넘기**
(조합이 깨지지 않는가 — 가로 `scrollLeft` 변경은 DOM을 안 건드리므로 이론상 무해, 실측으로 확인) ·
**드래그 선택으로 오른쪽 끝에 닿기**(CM `scrollParents.x` 자동 스크롤, §2-3) ·
⌘F 매치가 오른쪽 밖일 때 이동(D8) · 미리보기 수식 클릭으로 오른쪽 밖 수식 이동(D8) —
각각 세로 정렬(Phase 56 대칭)이 그대로인지 함께.

**6-4. 토글**
⌥Z(macOS: **Ω 미입력** 확인 · 한글 입력 상태) · Alt+Z(Windows) · ⌥⇧Z는 토글되지 않고 문자 입력 ·
버튼 클릭 · **켬일 때 박스가 켜지고 끔일 때 사라지는가**(D9′) · 새로고침 후 유지 ·
새 블록 추가 시 현재 모드로 마운트 · 접었다 편 블록 · 텍스트→제목 타입 변경(재마운트 없음) 후 유지 ·
**IME 조합 중 ⌥Z가 무시되는가**(D12) · 토글 직후 스크롤 위치(D11 — 세로 보정 필요 여부 실물 판정) ·
**그림 블록이 활성일 때**: 버튼은 회색(눌리지 않음)이지만 ⌥Z는 동작(D9).

**6-5. 세로 규약 불변**
끔 모드에서 모든 블록 `scroller.scrollHeight === scroller.clientHeight`(콘솔 스니펫 — **D14의 감시 지점**) ·
`.scaled-editor.scrollWidth === clientWidth`(가로 넘침이 바깥으로 새지 않는가) ·
`[data-noscroll]` 경고 0 · typewriter·블록 활성 정렬·수식 클릭 대칭이 켬과 동일 ·
Mac 트랙패드 가로 스와이프를 끝까지 밀어도 뒤로가기 없음(D7) ·
끔→켬→끔 왕복 후 잔여 `scrollLeft`로 인한 예기치 않은 점프 없음(§2-3 `observers.focus`).

**6-6. 빌드**
dev 종료 → `npm run build`(`icons:check` **56종** 통과) → dev 재시작(CLAUDE.md 규칙 5 — 순서 엄수).
Firefox 1회(`scrollbar-width: thin` 보정 확인).

---

## 7. 위험·트레이드오프

- **블록 높이 5px 점프**(D6, 실측 329→334): 줄이 넘치기 시작/끝나는 순간 그 블록이 자라고 아래가 밀린다.
  "튈 일을 안 만든다"(ProblemView 개선 원칙)와 마찰하지만, 스크롤바를 숨기면 마우스 사용자가 방법을
  모른다. **실물 판정 항목**이고, 거슬리면 `.cm-scroller`에 `.no-scrollbar` 계열 규칙을 얹는 것으로 되돌릴 수 있다.
- **D14가 깨질 때의 파괴력**: 세로 여지가 1px이라도 생기면 `scrollRectIntoView`가 밀고 `overflow-y:hidden`이
  복구를 막는다. 증상은 "블록 상단이 잘린 채 고정"인데 원인이 멀어 추적이 어렵다 — §6-5의 콘솔 스니펫이
  유일한 조기 경보다.
- **거터 불투명화가 켬 모드에도 적용된다**(D5): 합성 결과는 같아야 하지만, 활성 카드의 0.5px 테두리와
  radius 8 모서리에서 거터 배경이 테두리 안쪽 코너를 채우는 방식이 미세하게 달라질 수 있다(래퍼가
  `overflow:hidden` + radius라 클리핑은 같다). §6-1 스크린샷으로 확인.
- **테마 두 벌의 겹침**: 옮기는 세 속성을 기존 테마에서 **지우는 것**이 전제다. 남으면 같은 셀렉터·같은
  속성이 두 테마에 있어 우선순위 싸움이 된다. ⚠ 참고로 **겹칠 다른 후보는 없다** —
  `latexHighlightTheme` · `searchHighlightTheme` · `mathHighlightTheme` · `globals.css` 어디에도
  `.cm-content`/`.cm-scroller`/`.cm-gutters` 규칙이 **0건**이다(grep 실측, 부록 C-8).
- **CLAUDE.md 규약 개정을 빠뜨리면** 다음 사람이 `overflow-x:auto`를 "규약 위반"으로 되돌린다 →
  착수 체크리스트에 포함(§5-7).
- **Mac ⌥Z 가로채기**: 일부 입력기·앱이 ⌥Z를 가져갈 수 있다. 버튼이 항상 있으니 치명적이지 않다.
- **긴 줄 성능**: 수천 자 한 줄이면 브라우저 레이아웃이 느려질 수 있으나 Mathory 블록은 문항 단위라
  현실적으로 수백 자 → 무시.

---

## 8. 이 Phase가 건드리지 않는 것

세로 스크롤 체계(Phase 56·45a) · 미리보기·인쇄·열람·공유 페이지 · 댓글·agent 에디터 · 블록 구조·DnD·undo ·
글자 크기·가로폭 스테퍼(Row 1) · Row 2 수식 팔레트 구성 · 모바일(Phase 64 — 휴대폰은 편집 차단이라 무관) ·
Firestore·타입·API.

---

## 9. 구현 기록 (2026-09-08)

계획대로 구현했고 **계획을 뒤집은 것은 없다**. 실측 검증까지 마쳤으며 덕수 실물 검수 3건이 남았다.

### 9-1. 커밋 · 변경 규모

| 커밋 | 내용 | 파일 |
|---|---|---|
| S1 | 코어 — Compartment · 가로 스크롤 · sticky 거터 배경 · `revealCursorX` | `lib/editorScroll.ts` · `MarkdownEditor.tsx` |
| S2 | 배선 — 상태·localStorage·⌥Z·토글 버튼·두 경로 가로 노출 | `EditorView.tsx` · `UnifiedToolbar.tsx` · `FindReplacePanel.tsx` · 아이콘 2종 |
| S3 | 문서 — CLAUDE.md 규약 2건 · roadmap · 실행판 이관 | `CLAUDE.md` · `docs/roadmap.md` · 이 문서 |

수정 6파일 · 신규 0. 아이콘 55 → **56종**(`icons:check OK — 56종` 빌드 로그 실측).
로직 검증 **365건 무회귀**(12개 하니스 전부 `fail 0`). `npx tsc --noEmit` 무경고 · 프로덕션 빌드 통과.

### 9-2. 실측 검증 결과

Phase 61c의 방법을 그대로 썼다 — 임시 라우트(`app/dev65`)에 `SortableEditorBlock`의 래퍼 구조를
재현하고 headless Chrome `--dump-dom`으로 계측한 뒤, **dev를 먼저 끄고 라우트를 삭제**했다
(Phase 58 메모: dev 중 라우트 삭제 금지).

| 항목 | 켬(기본) | 끔 | 판정 |
|---|---|---|---|
| `white-space` | `pre-wrap` | `pre` | ✅ |
| `word-break` | `break-all` | `normal` | ✅ |
| `overflow-x` / `-y` | `visible` / `visible` | `auto` / `hidden` | ✅ |
| `overscroll-behavior-x` | `auto` | **`contain`** | ✅ D7 |
| `.cm-lineWrapping` 클래스 | 있음 | 없음 | ✅ facet도 함께 갈렸다 |
| **`vertRoom`** | **0** | **0** | ✅ **D14 감시 지점** |
| **`scrollTop` 강제 이동** | **0** | **0** | ✅ 밀리지 않는다 |
| `horizRoom` | 0 | 682 | ✅ |
| 거터 배경 | 활성 `#E8DFCE` / 비활성 `#F0EAE0` | 동일 | ✅ D5 불투명 |
| 패널 가로 넘침 | 0 | **0** | ✅ 바깥으로 새지 않는다(C-17) |
| sticky 거터 | — | `scrollLeft 300`에도 좌단 유지 | ✅ |

**§6-1 회귀의 결론**: 켬 모드의 computed style이 착수 전과 **완전히 같다** — Compartment로 옮긴 것이
결과 CSS를 바꾸지 않았다. 거터 배경만 투명 → 블록 표면색으로 바뀌었는데 **래퍼 배경과 같은 값**이라
합성 결과가 동일하다.

⚠ **headless에서는 스크롤바가 공간을 차지하지 않았다**(`offsetH === clientH`). §2-2 프로브에서
확인한 "블록 높이 5px 점프"(D6의 유일한 대가)는 **실물에서만 판정 가능**하다 → 아래 검수 항목 ①.

### 9-3. 덕수 실물 검수 (아이콘 1건 닫힘 · 2건 대기)

1. **가로 스크롤바 5px 노출과 블록 높이 점프**(D6) — 줄이 넘치기 시작/끝날 때 그 블록이 5px 자라고
   아래가 밀린다. 거슬리면 `.cm-scroller`에 스크롤바 숨김 규칙을 얹어 되돌린다(코드 3줄).
2. ~~아이콘 쌍~~ → **닫힘(2026-09-08 덕수 판정, D9′)**: ↔가 Row 1 가로폭 아이콘과 겹쳐 보여
   **↵ 단일 + 켬일 때 박스**로 확정. 아래 §9-4 참조.
3. **토글 직후 세로 보정 필요 여부**(D11) — 지금은 가로만 보정한다. 켬↔끔에서 블록 높이가 일제히
   바뀌므로 보던 자리가 어긋나면 `computeBlockAwareScrollTop` 1회를 추가한다.

그 밖에 실물에서만 볼 수 있는 것: 한글 IME 조합 중 경계 넘기 · ⌥Z가 `Ω`를 넣지 않는지 ·
드래그 선택의 가장자리 자동 가로 스크롤(§2-3, CM이 공짜로 준다) · 활성 카드 radius 8 모서리의
스크롤바 클리핑.

### 9-4. 검수 반영 1건 — D9′ 아이콘 단일화 (2026-09-08, 덕수)

> *"아이콘이 1행의 가로폭 아이콘과 겹치므로 이렇게 하자. Enter 아이콘으로 통일하고,
> 활성화될때 박스, 아닐때 박스 제거로 하자."*

계획(D9)의 **상태별 쌍을 폐기**하고 리턴 글리프(↵) 하나로 통일했다.

- **왜**: 끔 도안 `arrows-out-line-horizontal`(↔)이 **Row 1의 가로폭 스테퍼 아이콘
  `IconTextWidth`와 겹쳐 보인다**. 같은 화면에 좌우 화살표가 둘이면 "본문 폭"과 "줄바꿈"이
  구별되지 않는다. (계획서가 §6-3에서 걱정한 것은 *접기/펼치기 세로쌍과의* 혼동이었는데,
  실제로 부딪힌 것은 Row 1의 가로 아이콘이었다 — 검수가 아니면 못 볼 자리였다.)
- **`active`의 방향이 뒤집혔다**: `!lineWrap` → **`lineWrap`**. 도안이 하나뿐이면 박스가
  **유일한 상태 신호**이므로 도안의 뜻과 일치해야 한다 — ↵가 켜졌는데 줄바꿈은 꺼진 상태는
  읽히지 않는다. ⚠ 이 때문에 `collapseMode`·`searchOpen`의 "기본이 아닌 상태를 켠다"는 문법과
  **반대 방향**이 됐고, 기본값(켬)에서 버튼이 늘 켜져 보이는 것은 **수용한 대가**다.
- 미사용이 된 `arrowsOutLineHorizontal`은 ICONS 표에서 뺐다(M4 "미사용 아이콘 삭제") →
  57 → **56종**. 컨택트시트 항목도 '줄바꿈 켬/끔' 둘에서 '줄바꿈' 하나로.

수정 2파일(`UnifiedToolbar.tsx` · `gen-phosphor-paths.mjs`) + 생성물 2 + 문서 3.

### 9-5. 구현 중 확인된 사실 (계획서 보강)

- `React.CSSProperties`에 CSS 변수를 넣을 때 이 저장소의 관행은 **`['--x' as any]`** 다
  (`EditorView.tsx:3688`의 `--content-font-size` 선례). `as string`은 쓰지 않는다.
- `EditorView.theme()`을 모듈 최상위 상수로 두는 것은 SSR에서도 안전하다 — StyleModule 생성자는
  document를 만지지 않고 mount 시점에만 쓴다(`lib/latex-highlight.ts`가 이미 같은 형태).
- `icons:sheet`의 Row 2 목록에도 새 아이콘을 넣어야 실물 판정 대상이 된다(ICONS 표 추가만으로는
  컨택트시트에 나오지 않는다).

---

## 부록 A. 미확인 입력

원 요청의 "1. **처럼**"이 가리키는 참고 이미지(VS Code 캡처로 추정)는 이 세션에 도착하지 않았다.
VS Code 기본 동작(`editor.wordWrap: off` · Alt+Z 토글 · 고정 거터 · 하단 가로 스크롤바)을 기준으로 잡았다.
캡처에 다른 의도(예: 미니맵·줄 끝 표시·wrap 가이드)가 있었다면 v3 전에 알려 주기 바란다.

## 부록 B. 문서 계보

| 판본 | 작성 | 산출 |
|---|---|---|
| v1 | web | 현행 측정 · CM dist 독해 · D1~D12 · 규약 충돌 점검 · 구현·검증 초안 |
| **v2 = 실행판** | **CLI 실측** | **§2-2 논거 교체**(헤드리스 Chrome 프로브 4조건) · Q1~Q9 확정 반영 · **Q5 = Row 2**로 D9 전면 개정 · D12·D14 신설 · 정정 10건(부록 C) · **§9가 구현·검증 기록** |

중간 판본 v1은 `docs/phaseSketch/phase65-editor-nowrap-v1.md`에 남아 있다(작업물).
다음: 덕수 실물 검수 3건(§9-3) → 반영 → push·배포.

## 부록 C. v1 정정·보완 요약 — **v1을 인용하기 전에 이 표를 볼 것**

| # | v1 서술 | 실측 | 영향 |
|---|---|---|---|
| **C-1** | "블록 스크롤러는 높이가 콘텐츠 높이라 `scrollHeight === clientHeight`" | 결론은 맞지만 이유가 틀렸다 — **auto 높이 박스에서 가로 스크롤바는 콘텐츠를 잠식하지 않고 박스를 5px 키운다**(clientH 329 유지 · offsetH 334). 고정 높이면 즉시 여지 발생(32px) | **D14 신설**. 세로 안전이 조건부임이 드러났다 |
| **C-2** | "`.cm-scroller`에 가로 여지가 생기면 루프가 `scrollLeft`만 조정한다(moveY는 0)" | 스킵 조건이 **AND**(dist 536) — 가로 여지가 생기면 스크롤러가 **루프에 참여해 `scrollTop += moveY`도 실행**한다. 세로 여지 0이라 브라우저가 클램프할 뿐 | 안전 마진이 v1 서술보다 훨씬 얇다 |
| **C-3** | `EDITOR_WRAP_KEY`를 `lib/constants.ts`에 | `WIDTH_EM_KEY`가 거기 있는 이유는 **ProblemView와 공유**하기 때문. 공유 안 하는 `FONT_SIZE_KEY`는 `EditorView.tsx:194` 지역 | 키는 `EditorView.tsx` 지역 상수(D2) |
| **C-4** | "`overflow-y: hidden`을 명시한다(어차피 auto로 계산되므로 의도를 코드에 남기려고)" | 명시 이유가 더 강하다 — **hidden은 프로그램적 스크롤을 못 막는다**(실측). 명시는 의도 표시일 뿐 안전장치가 아니다 | §2-2·D14 문구 |
| **C-5** | `.cm-gutters` 배경 `var(--block-surface)` | 폴백이 없으면 `unset` → base theme의 `#f5f5f5` 회색 띠가 살아난다 | `var(--block-surface, var(--block-bg))`(D5) |
| **C-6** | 거터 폭 보정에 `gutters.offsetWidth` | `.cm-gutters`는 `.cm-scroller`의 자식이라 `getBoundingClientRect().right`가 sticky 위치를 이미 반영 · 거터 부재 시 처리도 자연스럽다 | D8 코드 |
| **C-7** | "거터 sticky는 지금 무효화일 뿐" | 무효가 아니라 **기준 조상이 `.scaled-editor`** 이고 거기 가로 넘침이 없어 발동하지 않을 뿐. (한 축만 지정하면 다른 축이 `auto`가 되는 규칙 — 실측) | §2-1 |
| **C-8** | "테마 두 벌의 우선순위는 v2 실측 항목(겹침 0 grep)" | **이미 닫혔다** — 다른 세 테마·globals.css에 해당 셀렉터 **0건**. 우선순위 규칙 자체가 무의미 | §7. 단 기존 테마에서 세 속성을 **지우는 것**은 여전히 필수 |
| **C-9** | "`basicSetup`의 `lineNumbers()`·`lintGutter()`가 이미 sticky" | 거터 DOM은 **하나**다(`GutterView`가 단일 `.cm-gutters`를 만들고 그 안에 넣는다, dist 11137) | 배경 대상도 하나(D5) |
| **C-10** | 행 번호 3건 | `FindReplacePanel` 149-171 · 수식 클릭 2447-2466 · 댓글/agent 버튼 3295-3335 | 사소. §1 표의 나머지 인용은 전부 정확 |
| **C-11** | Row 1 배치(가로폭·글꼴 옆 세 번째 묶음) · 아이콘 24 정방 · 댓글 버튼 pressed 규약 · "Row 2 툴바 설정 대안" | **Q5로 Row 2 확정**. `IconButton`(32×32·active 테두리+틴트) · `ICON_SIZE` 20 · `PhIcon` 직접 · `useToolbarConfig`는 팔레트 전용이라 대안 자체가 성립 안 함 | **D9 전면 개정** |
| **C-12** | 아이콘 단일(↵) | 초안은 쌍으로 바꿨으나 **덕수 판정으로 v1의 단일안이 되살아났다**(↔가 Row 1 가로폭 아이콘과 겹친다) | ↵ 단일 + `active={lineWrap}`(D9′ · §9-4′) |
| **C-13** | (없음) IME 조합 중 토글 | 프로젝트에 CM DOM 갱신이 조합을 깬 전례 2건. 핸들에 `isComposing()`이 이미 있다 | **D12 신설** |
| **C-14** | (없음) 포커스가 `scrollLeft`를 되돌린다 | `observers.focus`(dist 5124-5129)는 `scrollTop === 0`이면 `lastScrollLeft` 복원 — 우리는 **늘 참** | `revealCursorX`는 `focus()` 뒤(D8·§2-3) |
| **C-15** | (없음) 드래그 자동 가로 스크롤 | CM이 `scrollParents.x`로 처리(dist 4707) — 공짜로 얻는다 | §6-3 확인 항목 |
| **C-16** | (없음) `showToolbar` 게이트 | 그림 블록 활성 시 툴바 전체가 `pointerEvents:none` — 접힘 버튼도 동일 | D9(선례 준수 + ⌥Z가 메운다) |
| **C-17** | (없음) `.scaled-editor`로 가로 넘침이 새는지 | 미검증 | §6-5에 추가 |
| **C-18** | "`autoHeight` 미지정" | `MarkdownEditor`의 `autoHeight`는 **앱 어디서도 true가 아니다**(동명 prop은 EditorPreview·CommentEditor 것) | §1 |
