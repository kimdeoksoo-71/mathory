# Phase 58 — 제목 블록 재조정 · key sentence 톤 시스템 · 수식/원문자 크기 완화 **(구현 완료)**

작성일: 2026-08-16 · 착수 기준 커밋: `21e1e73` · **구현 완료: 2026-08-16**
이력: v1(web 목업) → v2(CLI 실측) → v3(web 재검증) → v4(CLI T0 + 재정정 + 통합) → **구현**

> ## 구현 결과 — 착수본 대비 변경분
>
> 아래 본문은 **착수 시점의 계획**이다. 구현하며 확정·수정된 것은 다음과 같다.
>
> | 항목 | 계획 | **실제** |
> |---|---|---|
> | **D2 제목 여백** | 체감 3.4~3.9em을 `paddingTop 0.5em`으로 2.4em에 맞춤 | **그대로.** headless Chrome 하니스로 실측해 2.18em(text 뒤) / 2.68em(수식·리스트 뒤) / 2.148em(연속 heading) / 아래 0.648em 확인 — 3항 구성 예측이 소수점까지 맞았다 |
> | **인쇄 제목 여백** | 5개 사이트 일괄 `0.5em` | **인쇄만 `1em`.** 인쇄는 산식이 달라(앞 문단 6pt + padding + `.print-body h2` 8pt) 0.5em이면 1.9em으로 과소해진다. 1em(10pt)이 정확히 24pt = 2.4em |
> | **D5 강조 수단** | 화면은 **색으로만** (굵기 배제) | **색 + 굵기 600.** 색만으로는 강조/비강조가 거의 구별되지 않았다(D5' 리스크 현실화). 제목이 700이므로 한 단계 아래를 써서 제목 > key > 본문 위계를 유지 |
> | **D3 톤 값** | A안(dim = `--text-secondary`) 채택, B안은 예비 | **B안 승격.** A안은 비key 텍스트가 픽셀 무변화라 "풀이가 물러나는" 느낌이 없었다 → `--tone-dim: #675F52`(간격 1.97 → 2.27:1) |
> | **D9' 제목 가드** | 제목 글자를 `--text-secondary`에 고정 | **제목 안 수식도 고정.** 글자만 고정하면 `.solution-tone.has-key .katex`(0,3,1)가 제목 속 수식을 dim으로 끌어내린다 — 계획에 없던 누락 |
> | **D7 단축키** | 기본 미배정, T10 통과 시 ⌘⇧B | **미배정 확정.** 3사 전부 점유라 배정하지 않았다. 필요하면 ⌘⇧K |
> | **P3 수식 가드** | `buildMathIndex` 재사용 | `lib/mathIndex.ts`로 추출. `lib/latex-completions.ts`에 같은 이름의 `isInsideMath(doc, pos)`가 이미 있어(자동완성용, `\[…\]` 미지원) `isInsideMathRange`로 구분 |
> | **prelaunch 6번** | "제목 블록 개편 때 처리" | **미처리로 남김.** Phase 58은 렌더 크기만 정했고 마크다운 레벨은 안 건드렸다. 해법은 확인됨(`exportMd.ts:64`의 탭 제목 `##`→`#` 한 글자) — export 포맷 변경이라 별건 |
>
> **커밋**: `8a1dc4e`(Stage 1·2) · `ddfceb4`(P5 튜닝 88%) · `a365ff1`(Stage 3) · `46166a9`(Stage 4) · `197ef09`(D5 개정) · `0b4ccd9`(D3 B안) · `f6a8186`(Stage 5) · `837c310`(아이콘 정렬)
>
> **미실행 검증**: T17(공유뷰 줄바꿈 보존 스크린샷 대조) · T12(기존 문항 `**` 실태 조사) · T16(P6 판단용 `aligned` 사용 비율).

> **이 문서는 자립형이다.** v1·v2·v3를 대체하며, 착수 시 **이 문서 하나만** 보면 된다. 이전 판들은 이력 보존용으로만 남긴다(§8에 판별 요약).
> **미결 없음** — 구 Q1~Q12, v3 Q1~Q2, v4 Q3까지 전부 확정됐다.

**배포 범위 = P1 · P2 · P3 · P4 · P5.** P6(긴 display 수식 접기)는 사양만 확정하고 **별도 Phase로 분리**한다(§6).

---

## 0. 확정 전제 — 코드 실측 사실 (착수 전 반드시 읽을 것)

v1이 추정으로 쓴 것들이 대부분 틀렸다. 아래는 `21e1e73`에서 직접 확인한 사실이며, 여기서 벗어난 설계는 동작하지 않는다.

| # | 사실 | 좌표 | 함정 |
|---|---|---|---|
| **C1** | `--katex-scale: **1.15em**` — **단위 포함** | globals.css:108 | 무단위 `1.08`은 `font-size`에 **무효 선언** → declaration 폐기 → katex.min.css `font: normal 1.21em`로 복귀해 **오히려 커진다** |
| **C2** | heading 스타일은 **EditorPreview.tsx 인라인 style**이 유일한 진실 | EditorPreview.tsx:335-343 | globals.css 427-428은 규칙 없는 주석. 인라인 style은 `!important` 없는 모든 시트 규칙을 이긴다 → **CSS로 못 바꾼다** |
| **C3** | heading 블록 래퍼에 `paddingTop: '1.5em'`(i≠0)이 **5개 사이트 전부 하드코딩** | §1-2 좌표표 | "문서 첫 제목 예외"는 이미 구현돼 있다 |
| **C4** | `.problem-content-toned .katex { color: var(--text-primary) }` — 수식에 **명시 color** | globals.css:197 | 조상에 `color`를 줘도 **수식에 안 닿는다**. `.katex`를 직접 겨냥해야 한다 |
| **C5** | 실배경은 흰색이 아니라 클레이 3종 | §2-3 | 명암비는 이 배경들 기준. 구속 조건은 FolderView 카드 `#EDE6DA` 하나 |
| **C6** | katex.min.css `.katex { font: normal 1.21em … }` — `font` shorthand가 **weight를 normal로 리셋** | node_modules/katex/dist | **KaTeX 가짜 볼드는 존재하지 않는다.** weight 가드 CSS는 불필요 |
| **C7** | **`.num-circle`이 없다.** Phase 57 P5는 합성을 폐기하고 `@font-face 'MathoryCircled' + unicode-range`로 재구현 | globals.css:26-34, 95, 99 | **CSS 훅 자체가 없다.** 크기 레버는 `size-adjust` 디스크립터 하나뿐 |
| **C8** | `buildMathIndex`는 **EditorView.tsx 로컬 함수**(export 없음). MathToolbar는 "이 파일 제거" 예정 레거시 | EditorView.tsx:147 / MathToolbar.tsx:1-8 | 재사용하려면 lib 추출. 툴바는 **UnifiedToolbar** |
| **C9** | 최상위 `\\`는 `span.mspace.newline`을 방출하지만 **`aligned`·`gathered`·`array`는 0개** | katex 0.16.28 실측 | P6가 house style 전용인 이유 |
| **F1** | 제목 상단 여백은 **3항 구성**이고 앞 블록 타입에 따라 변동한다 | §3-1 | v1·v2·v3가 모두 틀렸던 지점 |
| **F2** | 제목은 **이미 `--text-secondary`를 상속한다**(인라인 style에 `color` 없음) | EditorPreview.tsx:336·338·342 | "제목은 항상 풀 톤"이라는 v1 전제가 현행과 다르다 |

### 0-1. 좌표 유효성

`f7c4a37` 이후 Phase 55c 2건(`ae908d7`·`21e1e73`)이 `EditorView.tsx`를 61줄 고쳐 **미리보기 좌표 4건이 +7 이동**했다. 아래는 `21e1e73` 기준 확정값이다.

착수 시 `git log 21e1e73..HEAD --stat -- components/ app/ lib/`로 추가 드리프트만 확인할 것. **EditorView는 변경이 잦으므로 미리보기 좌표를 특히 재확인.**

---

## 1. 범위·의미 모델·좌표

### 1-1. 강조의 두 축 (D13 — v1의 "블록 key" 폐기)

> 덕수 확정: *"강조문은 들여쓰기를 통해 강조하고 싶은 거지, 문단 전체를 진한 톤으로 강조할 목적으로 만든 것이 아니다."*

| 축 | 수단 | 단위 | 하는 일 |
|---|---|---|---|
| **위치 강조**(레이아웃) | callout(강조문) 블록 | 블록 | 들여쓰기로 도드라지게 한다. **톤과 무관** — 톤 시스템에서 일반 텍스트 블록과 완전히 동일하게 취급 |
| **톤 강조**(key) | `**...**` (markdown strong) | 문장/구 | 그 구간만 100% 톤으로 올린다 |

**key 마커는 인라인 `**` 하나뿐이다.** callout 안에서도 기본은 dim이고 `**` 구간만 100%가 된다. 두 축은 자유 조합(들여쓰기만 / 톤만 / 둘 다).

**display 수식 행의 강조 (D8)** — `$$...$$`는 블록 문법이라 `**`로 감쌀 수 없다:

```
$$x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$        ← 톤 강조 불가
**$x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}$**      ← 톤 강조 가능 (strong > inlineMath)
```

- 인라인 수식에 `\displaystyle`이 자동 주입(preprocessMath)되므로 `$...$`로도 display급 조판이 나온다.
- **들여쓰기까지 원하면** 그 행을 callout에 둔다. `.callout-block { padding-left: 3em }`(globals 407) = `.katex-display { padding-left: 3em }`(globals 206) **동일 값**, 인쇄도 2em ↔ 2em 일치(PrintStyles 24·142). `.tag-marker`는 float:right이고 callout이 `padding-right: 0`이라 참조번호 기준선도 유지된다.
- 표기는 공백 없이 `**$x=…$**`로 통일(`**` 바로 안쪽이 비공백이어야 하는 CommonMark 규칙 — 툴바가 자동 강제).
- 한계: `$$ A \\ B $$`처럼 최상위 `\\`로 나뉜 복합 display는 인라인 하나로 못 옮긴다 → 한 줄에 하나씩 `$...$`로 분할. `\begin{cases}` 등 환경 내부 다행은 인라인에서도 렌더되므로 문제없다.

### 1-2. 렌더 사이트 좌표 (`21e1e73` 확정)

| 사이트 | 톤 클래스 부착점 | heading paddingTop | 비고 |
|---|---|---|---|
| **EditorView 미리보기** | `EditorView.tsx:3190`(`.scaled-preview … problem-content-toned`) / `:3191`(activeTab 조건부 래퍼) | `:3197` · `:3199` | 탭 하나만 렌더 → `activeTab`으로 판정 |
| **ProblemView** | `ProblemView.tsx:742` | `:326` · `:399` | 탭 루프 안. `isQuestion = tab.id === 'question'`(`:694`) 기존재 — **가장 깔끔** |
| **FolderView** | `FolderView.tsx:557` | `:246` · `:300` | 카드 본문 |
| **ProblemTabContent**(공유) | `ProblemTabContent.tsx:14` | `:19` · `:67` | **`tabId` prop 추가 필수.** 호출부 `PublicViewerShell.tsx:78·81·96`이 id 보유 |
| **PrintableContent**(인쇄) | `PrintableContent.tsx:52` | `:58` | **`PrintTab`에 `id` 추가 필수** — 현재 `{label, blocks}`뿐. printTabs 생성 호출부도 함께 |

기타: `EditorView.tsx` 116(`TEXT_BASED_TYPES`) · 147(`buildMathIndex`) · 2231/2244/2248/2252/2256(단축키) · `EditorPreview.tsx` 338(h2) · `globals.css` 27/101/108 · `UnifiedToolbar.tsx` 22/23/35 · `PublicViewerShell.tsx` 130(카드 배경).

---

## 2. 결정표 (전 항목 확정)

| # | 결정 | 내용 |
|---|---|---|
| **D1** | 제목 타이포 | h2 = 본문×1.08, 두께 **700**, **언더라인 제거** |
| **D1'** | 제목 3단계 | 현행 1.5/1.3/1.15em → **h1 1.18em / h2 1.08em / h3 1.0em**. h2만 내리면 h3와 역전하므로 동시 조정 필수 |
| **D1''** | 700 예외 | globals.css `--weight-*`의 "3단계만(700 금지)"(101-104)에 대한 **제목 한정 예외**. 토큰 주석에 명기 |
| **D2** | 제목 여백 | 현행 체감 상단 = **3.4~3.9em**(3항 구성, §3-1)으로 목표 2.4em의 1.4~1.6배 → **조정 필요.** 처방 = 래퍼 `paddingTop` **1.5em → 0.5em**(5개 사이트). marginBottom 0.5→0.6em. **값은 T1 실측 후 확정** |
| **D2'** | 여백 구조 | `paddingTop → marginTop` 전환(정확히 2.4em 고정)은 `[data-block-id]`가 Phase 56 스크롤 앵커라 회귀 위험 → **채택하지 않는다.** 여백 체계 재정비 시 별건으로 |
| **D3** | 톤 값 | **A안**: dim = `--text-secondary` #5D5647, full = `--text-primary` #2D2A23. 신규 색 0, 명도 간격 1.97:1. B안(`--tone-dim: #675F52`, 간격 2.27:1)은 **즉시 승격 가능한 대안** |
| **D3'** | 수식 dim | `.problem-content-toned .katex`의 명시 color를 이겨야 하므로 **`.katex`용 규칙을 반드시 따로 쓴다**(C4) |
| **D4** | 폴백 | 풀이에 **`**`가 하나도 없으면** 톤 낮추기 미적용. callout은 판정에 넣지 않는다 |
| **D4'** | 자동 승격 | 기존 `**`는 사전 정리 없이 그대로 key로 승격. 원치 않으면 `**`를 지우면 꺼진다 |
| **D5** | 화면은 색만 | key는 색으로만 구분, `strong`의 weight를 스코프 내 상속. 근거는 "굵기+색 이중 신호 회피"(가짜 볼드는 원래 없다, C6) |
| **D5'** | 강도 리스크 | 색 차 1단계 + 굵기 소실이라 현행 볼드보다 약해질 수 있다 → T8에서 부족하면 D3-B로 승격 |
| **D6** | 인쇄 예외 | 인쇄는 전부 100% 톤 + key만 굵게. **weight 가드 CSS 불필요**(C6) |
| **D6'** | 인쇄 key 수식 | 인쇄에서 key 안 수식은 굵기 강조를 받지 않는다 — **수용**(텍스트 굵기로 문장 식별 가능) |
| **D7** | 툴바 버튼 | **UnifiedToolbar**에 "핵심문장" 버튼 + 브라켓 계열 `KeySentenceIcon`. **단축키는 기본 미배정**(⌘⇧B를 Chrome·Edge·Safari가 전부 점유) — T10 통과 시에만 배정, 대체 후보 ⌘⇧K |
| **D8** | display 수식 강조 | §1-1 — 톤은 `**$...$**`, 들여쓰기는 callout. 두 축 독립 |
| **D9** | 스코프 | 톤 시스템은 **`tabId !== 'question'`**(동적 `extra_N` 포함, question만 제외) |
| **D9'** | 제목 처리 | 제목은 has-key 여부·dim 값과 무관하게 **`--text-secondary`에 고정**. A안에서 no-op, B안에서 가드 |
| **D9''** | 이미지 예외 | dim 상태에서 이미지·SVG·그래프는 원 대비 유지(필터 미적용) |
| **D10** | 수식 크기 | `--katex-scale` **1.15em → 1.08em**(범위 1.06~1.10em). **반드시 `em` 단위**(C1) |
| **D10'** | 인쇄 수식 | `.print-body .katex { font-size: 1em }`으로 변수 미사용 → **무변경** |
| **D10''** | 인쇄 제목 | 현행 13/12/11pt **유지**. 굵기 600이 이미 위계를 만들고 언더라인도 원래 없다. 화면과의 비율 불일치는 **parity 의도적 예외** |
| **D11** | 원문자 크기 | `@font-face 'MathoryCircled'`에 **`size-adjust: 92%`**(출발값, 85~96% 튜닝) |
| **D11'** | 화면·인쇄 동시 | `--font-print`도 같은 family → 하나로 둘 다 축소. **분리하지 않는다** |
| **D12** | P6 사양 | DOM 레벨 접기, **최상위 `\\` display 수식 한정**(C9). aligned·gathered·array·cases는 대상 외 |
| **D12'** | P6 분리 | **본 Phase 범위 밖.** T16 조사 후 별도 Phase |
| **D13** | callout | **톤과 무관 — 들여쓰기 전용 레이아웃 블록**(§1-1) |
| **D14** | 공유뷰 기준선 | 5개 사이트의 톤 기준선을 **`.tone-baseline`(색 2줄)**으로 통일. `.problem-content-toned` 통째 부착은 **금지**(`letter-spacing`이 딸려와 공개 페이지 줄바꿈이 바뀐다) |

---

## 3. 구현 상세

### 3-1. P1 — 제목 블록

**현행** (`EditorPreview.tsx:335-343`, 전부 인라인 style):

```
h1: 1.5em  / 600 / marginTop 1em / marginBottom 0.5em / lineHeight 1.4
h2: 1.3em  / 600 / …             / paddingBottom 0.3em / borderBottom 1px solid #999
h3: 1.15em / 600 / …
```

#### 여백의 실제 구성 (F1 — 착수 전 필독)

제목 상단 여백은 **3항**이다. 앞 블록의 마진이 이월되는 경로를 실코드로 확인했다:

| 통과 상자 | 상태 | 상쇄 차단 |
|---|---|---|
| `.preview-content` div | padding·border·overflow 없음 | 통과 |
| EditorPreview root(`borderless`) | `padding:'0'` · `border:'none'` · `overflow:'visible'` · `height:'100%'` | 통과 — `height:100%`는 부모가 auto라 **계산값이 `auto`**(CSS 2.1 §10.5)여서 하단 마진 상쇄를 막지 못한다 |
| `<style>` 자식 | UA 기본 `display:none` → 박스 미생성 | 무관 |
| 앞 블록 래퍼 | heading이 아니면 padding 없음 | 통과 → **래퍼의 하단 마진이 된다** |

```
[앞 블록 이월 마진]  +  [래퍼 paddingTop]  +  [h2 marginTop × h2 font-size]
  0.6em (text 뒤)          1.5em                 1em × 1.3 = 1.3em      = 3.4em
  1.1em (수식·리스트 뒤)    1.5em                                        = 3.9em
```

- **em 마진은 자기 요소의 font-size 기준**이다 — h2의 `margin: 1em`은 본문 1em이 아니라 1.3em이다.
- 목표 2.4em의 **1.4~1.6배**이고, 앞 블록 타입에 따라 0.5em 변동한다 → "체감 위 2.4em"은 현재 구조에서 단일 값으로 성립하지 않는다.
- 위는 **박스 모델** 기준이다. 앞 `<p>`의 `line-height:1.8`과 h2의 `lineHeight:1.4`가 만드는 half-leading이 잉크 대 잉크 간격을 더 벌린다.

> ⚠ **CLAUDE.md 규칙: "여백을 논하기 전에 기준선을 실측할 것."** 아래 값은 출발점이며, **DevTools 실측(T1) 전에 확정하지 말 것.**

#### 수정 내용

**① `EditorPreview.tsx:335-343`**

```tsx
h1: ({ children, ...props }) => (
  <h1 style={{ fontSize: '1.18em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em',
               lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h1>
),
h2: ({ children, ...props }) => (
  <h2 style={{ fontSize: '1.08em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em',
               lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h2>
),
h3: ({ children, ...props }) => (
  <h3 style={{ fontSize: '1em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em',
               lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h3>
),
```

h2의 `paddingBottom`·`borderBottom` **삭제**(D1 언더라인 제거).

**② 5개 사이트의 `headingTopPad`: `'1.5em'` → `'0.5em'`** (좌표 §1-2)

예상 결과: text 뒤 `0.6+0.5+1.08 = 2.18em` / 수식 뒤 `1.1+0.5+1.08 = 2.68em` (평균 ≈ 목표 2.4em, 변동 ±0.25em). **T1 실측 후 확정.**

**③ `globals.css:101` 주석 갱신** — `/* Weights — 3단계만 (700 금지. 예외: 본문 heading — Phase 58 D1'') */`

**④ 인쇄는 손대지 않는다**(D10''). `PrintStyles.css:50-52` 무수정.

### 3-2. P2 — key sentence 톤 시스템

#### 기존 톤 체계 (C4)

`globals.css:188-197`이 이미 Phase 43의 톤 체계를 갖고 있다 — 본문 `--text-secondary`, **수식 `--text-primary`**. 즉 **현재 화면에서 가장 진한 것은 수식**이고, Phase 58의 목표(routine은 물러나고 key가 앞으로)와 정확히 반대다. 이것이 P2 설계의 출발점이다.

적용 사이트는 EditorView·ProblemView·FolderView 3곳뿐이고 **공유뷰·인쇄에는 없다** → D14로 통일한다.

#### 명암비 (C5)

WCAG 상대휘도 계산 — `((c+0.055)/1.055)^2.4`. **`/1.055`를 빠뜨리면 후보색 판정이 뒤집힌다.**

| 색 | `#F4EFE7`<br>편집·ProblemView | `#EDE6DA`<br>FolderView 카드 | `#FEFDFB`<br>공유뷰 카드 | 판정 |
|---|---|---|---|---|
| `--text-primary` `#2D2A23` | 12.51:1 | 11.54:1 | 14.08:1 | ✔ full |
| `--text-secondary` `#5D5647` | 6.35:1 | 5.86:1 | 7.15:1 | ✔ **A안 dim** |
| `#675F52` (B안) | 5.50:1 | 5.08:1 | 6.19:1 | ✔ 전 배경 통과 |
| `#6b6a65` (v1안) | 4.73:1 | **4.37:1** | 5.33:1 | ✘ FolderView 미달 → 폐기 |

- **구속 조건은 FolderView 카드 `#EDE6DA`** 하나. 공유뷰는 가장 관대해 판정에 영향 없다.
- dim↔full 명도 간격: **A안 1.97:1** / B안 2.27:1(15% 더 벌어짐).
- B안 승격 시 확인: `#675F52`↔`#5D5647` = 1.16:1 → 앱 크롬의 `--text-secondary`와 "두 종류 회색"으로 보이지 않는지.

#### CSS 최종형

```css
/* ═══ globals.css ═══ */

/* D14 — 톤 기준선. 5개 사이트 공통. 색만 담는다(letter-spacing 등은 넣지 않는다) */
.tone-baseline        { color: var(--text-secondary); }
.tone-baseline .katex { color: var(--text-primary); }

/* D4 — has-key일 때만 발동 */
.solution-tone.has-key        { color: var(--tone-dim, var(--text-secondary)); }
/* D3' — .problem-content-toned .katex(0,2,0)의 명시 color를 이겨야 한다.
   이 줄이 없으면 수식은 전혀 흐려지지 않는다 */
.solution-tone.has-key .katex { color: var(--tone-dim, var(--text-secondary)); }

/* key 복귀 — 인라인 `**` 하나뿐 (D13: callout 규칙 없음) */
.solution-tone.has-key strong,
.solution-tone.has-key strong .katex { color: var(--text-primary); }

/* D5 — 화면에서는 색으로만 구분 */
.solution-tone.has-key strong { font-weight: inherit; }

/* D9' — 제목은 has-key 여부·dim 값과 무관하게 현행 색에 고정.
   A안에서는 상속과 동일한 no-op, B안 승격 시 제목만 dim을 따라가지 않게 하는 가드 */
.solution-tone.has-key h1,
.solution-tone.has-key h2,
.solution-tone.has-key h3 { color: var(--text-secondary); }
```

```css
/* ═══ PrintStyles.css ═══ */
.print-body .solution-tone.has-key,
.print-body .solution-tone.has-key .katex { color: inherit; }      /* 100% 복원 */
.print-body .solution-tone.has-key strong { font-weight: 700; }    /* key만 굵게 */
```

**특이도 검산**: `.solution-tone.has-key strong .katex`(0,3,1) > `.solution-tone.has-key .katex`(0,3,0) > `.problem-content-toned .katex`·`.tone-baseline .katex`(0,2,0) ✔. 제목 규칙(0,3,0) > `.solution-tone.has-key`(0,2,0) ✔. 인쇄 `.print-body .solution-tone.has-key`(0,3,0) > 화면 규칙(0,2,0) ✔.

> globals.css는 `.print-root` 서브트리에도 적용되고 `@media print { * { print-color-adjust: exact } }`(PrintStyles 18-21)가 있으므로, **인쇄 복원 규칙이 없으면 회색 인쇄가 나간다.**

#### callout의 톤 (D13)

**callout에 대한 톤 규칙은 만들지 않는다.** 구조가 `.callout-block > EditorPreview > .preview-content > p`이므로 조상의 dim이 자동 상속되고, 안의 `**`만 key 규칙에 걸린다. **아무것도 안 쓰는 것이 정답이다.**

귀결: callout만 있고 `**`가 없는 풀이는 톤이 켜지지 않는다 → **callout을 들여쓰기 용도로만 쓰던 기존 문항은 시각 변화 0.** (v1 설계의 가장 큰 회귀 위험이 D13으로 사라졌다.)

#### 판정 로직

```ts
// lib/keyTone.ts (신규, 5개 렌더 사이트 공유)
import { Block } from '../types/problem';

/** CommonMark 유효 강조 근사. lookbehind 회피(구형 Safari 대비). */
const KEY_STRONG_RE = /\*\*(?=\S)[\s\S]*?\S\*\*/;

/** D13 — callout은 판정에 넣지 않는다. key 마커는 `**` 하나뿐. */
export function solutionHasKey(blocks: Pick<Block, 'raw_text'>[]): boolean {
  return blocks.some((b) => KEY_STRONG_RE.test(b.raw_text));
}

/** D9 — 톤 스코프. question 탭만 제외(동적 extra_N 포함). */
export const isToneScoped = (tabId: string) => tabId !== 'question';
```

- **타입 게이트를 두지 않는다.** `TEXT_BASED_TYPES`는 `EditorView.tsx:116`의 모듈 로컬 상수이고 export되지 않는다 — 사본을 두면 CLAUDE.md의 "상수 6종은 전부 EditorView 상단" 규칙을 깬다. raw_text만 검사해도 실질 오탐이 없다(image/svg/ggb의 raw_text는 URL·`<img src>`).
- 오탐의 최악 결과가 "톤이 켜짐"이라 파괴적이지 않다.
- `blocks` 참조 동일성 기준 `useMemo` — 편집 미리보기에서 타이핑마다 전수 regex 방지.

#### 부착 작업

- 5개 사이트 컨테이너에 `tone-baseline` + (스코프면) `solution-tone` + (has-key면) `has-key`.
- **`ProblemTabContent`에 `tabId` prop 추가** — 호출부 `PublicViewerShell.tsx:78·81·96`이 이미 id 보유.
- **`PrintTab`에 `id` 필드 추가** — 현재 `{label, blocks}`뿐이라 인쇄에서 question/solution 구분 불가. printTabs 생성 호출부(ProblemView·EditorView PDF 경로)도 함께 수정. **이걸 빠뜨리면 인쇄에서 조용히 미적용된다.**
- `.problem-content-toned`에서 색 2줄을 `.tone-baseline`으로 옮기고 마크업에서 두 클래스를 병기(또는 기존 클래스가 새 규칙을 물려받게). **`letter-spacing`·`line-height`는 옮기지 않는다**(D14).

#### 주의

- `--tone-full` 변수는 만들지 않는다 — A안에서 `--text-primary`가 곧 full이다.
- **T2의 "픽셀 동등" 범위**: `**`가 없는 문항은 완전 동등. `**`가 있는 문항은 비key *텍스트*만 동등하고 비key *수식*은 색이 바뀐다(의도).
- BORDERED 블록 테두리는 `border: 1.5px solid var(--text-muted)` **고정색**이라 dim의 영향을 받지 않는다 → dim 상태에서 테두리만 상대적으로 진해 보일 수 있다(실렌더 확인).
- key 문장 끝의 `\tag{n}` 참조번호는 툴바가 `\tag`를 자동 제외하므로 **dim으로 남는다** — 참조번호는 routine 메타데이터이므로 의도된 동작.
- 콘텐츠 내 `\textcolor`는 상속을 이기므로 유지된다.

### 3-3. P3 — 툴바 "핵심문장" 버튼

#### 핸들 확장

`MarkdownEditorHandle`(MarkdownEditor.tsx:47-73)에 추가:

```ts
toggleKeyWrap(): 'wrapped' | 'unwrapped' | 'rejected';
```

1. **선택 없음 → rejected**. tooltip 안내.
2. **경계 정돈**: 선택 양끝 공백 제외(`** text**` 불발 방지). 행 끝 `\tag{n}`이 포함되면 자동 제외 — 텍스트 행 tag 변환 정규식이 `/\\tag\{(\d+)\}\s*$/gm`(EditorPreview.tsx:170)로 **행 끝 앵커**라, `… \tag{1}**`가 되면 매칭이 깨져 원문이 노출된다.
3. **문단 제약**: 정돈된 선택 안에 빈 줄이 있으면 rejected. 블록 경계는 블록당 CM 1개라 자동 충족.
4. **수식 경계 가드**: `buildMathIndex`를 **`lib/mathIndex.ts`로 추출**하고 EditorView 호출부 4곳(2059·2089·2123·2145)을 import로 교체. 선택 양끝이 수식 내부면 rejected, `$...$` 통째 포함은 허용, `$$` 구간을 걸치면 rejected(→ D8 관행으로 유도).
5. **토글**: 이미 `**...**`면 제거, 아니면 삽입. 단일 트랜잭션 dispatch → CM 히스토리·Phase 55a 블록 undo에 자연 편입.
6. rejected 피드백은 재량.

#### 아이콘 — 브라켓 계열과 통일 (덕수 지시)

**기존 규격** (`UnifiedToolbar.tsx:22-42`) — 툴바 아이콘 11종이 공유:

```tsx
const ICON_SIZE = 22;
const SVG_PROPS = { width: 22, height: 22, viewBox: '0 0 64 64', fill: 'none',
  stroke: 'currentColor', strokeWidth: 3.5, strokeLinecap: 'round',
  strokeLinejoin: 'round', 'aria-hidden': true };
const CORNER_BRACKETS = (<>   /* 네 모서리 — 계열 정체성 */
  <path d="M8 20 L8 8 L20 8" />   <path d="M44 8 L56 8 L56 20" />
  <path d="M56 44 L56 56 L44 56" /><path d="M20 56 L8 56 L8 44" />
</>);
```

계열 규칙: ① `viewBox 0 0 64 64`, 작화 영역 x·y 16~48 ② 모든 선 `currentColor` + `strokeWidth 3.5` ③ 면은 `fill="currentColor" stroke="none"`(`SnippetIcon` 점, `AiMathGenIcon` 반짝임이 선례) ④ `CORNER_BRACKETS`를 맨 앞에.

```tsx
function KeySentenceIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M18 22 L46 22" />                                       {/* 보통 행 */}
      <rect x="18" y="27.5" width="26" height="9" rx="2"
            fill="currentColor" stroke="none" />                       {/* key 행 — 면 */}
      <path d="M18 42 L38 42" />                                       {/* 보통 행 */}
    </svg>
  );
}
```

22px 렌더 시 선 ≈1.2px vs 바 ≈3.1px로 대비 충분. 브라켓(x·y 8~20, 44~56)과 겹치지 않는다. `ProofreadIcon`(4행+체크)과 구분되도록 3행 + 가운데 면.

> **`.svg` 파일로 분리하지 않는다.** 툴바 아이콘 11종은 `stroke="currentColor"`로 `IconButton`의 hover·active·disabled 색 변화를 상속받는다(`ICON_BTN_BASE.color: var(--text-muted)`). `<img>`로 불러오면 `currentColor`가 끊겨 **상태별 색 변화가 전부 죽는다.** `public/icons/ai/*.svg`가 파일인 건 색 고정 브랜드 마크라서다. **`UnifiedToolbar.tsx`의 아이콘 블록(44-200행)에 12번째 컴포넌트로 추가**하는 것이 "기존과 통일"의 실질이다.

#### 배선

```
UnifiedToolbarProps에 추가:  onToggleKey: () => void;  keyToggleDisabled: boolean;
rightItems에 항목 추가:      { key: 'keysent', node: <IconButton title="핵심문장" …/> }
```

⚠ `rightItems`는 폭이 좁아지면 **끝부터 hide**되는 반응형(717-760 부근 `leftWidth` 측정) → 핵심문장 버튼은 배열 **앞쪽**에.

#### 단축키 — 기본 미배정 (D7)

점유 실태: ⌘B **블록 분할**(EditorView:2248) · ⌘F 찾기(2244) · ⌘J AI완성(2252) · ⌘Z/⌘⇧Z 블록 undo(2231) · ⌘⇧L 수식행 분할(2256) · Ctrl+N 코드 리더(MarkdownEditor:560,576).

**⌘⇧B는 Chrome·Edge·Safari가 전부 점유한다**(북마크바/즐겨찾기 바 토글). 브라우저 메뉴 액셀러레이터를 `preventDefault`로 이길 수 있는지는 브라우저·OS·버전마다 다르고, 실패 모드가 "강조 대신 북마크바가 열린다"라 조용하지 않다. **기능은 툴바 버튼만으로 완결되므로 단축키는 요건이 아니다.**

→ **Stage 5는 버튼까지만 구현한다.** T10에서 ⌘⇧B 가로채기가 Chrome·Safari 양쪽에서 성공하면 그때 배정, 실패 시 **⌘⇧K**(Chrome·Safari 무충돌). 어느 쪽이든 등록은 `e.code === 'KeyB'` / `'KeyK'`.

> **부수 발견(범위 밖)**: 기존 ⌘B·⌘F·⌘J가 `e.key === 'b'|'f'|'j'`를 쓴다(2244-2254). CLAUDE.md는 "Korean IME + CodeMirror 단축키는 `event.code`(물리키), `event.key` 금지"를 규칙으로 못박고 있다 → `docs/prelaunch-bug-cleanup.md`에 등록.

### 3-4. P4 — 수식 크기 비율 완화

```css
/* globals.css:108 */
:root { --katex-scale: 1.08em; }   /* 1.15em → 출발값 1.08em, 튜닝 범위 1.06~1.10em */
```

**⚠ `em` 단위 필수**(C1). 소비처는 `font-size: var(--katex-scale)`(globals 211-214) 하나뿐이라 무단위 값은 declaration이 폐기되고 KaTeX 기본 1.21em으로 되돌아간다.

**파급 전수** — 이 변수를 읽는 곳은 globals.css:211-214 **한 곳뿐**이다:

| 대상 | 좌표 | 영향 |
|---|---|---|
| `.preview-content .katex` / `.problem-content-toned .katex` | 211-214 | **유일한 소비처** |
| `.tag-marker`(수식 밖 참조번호) | 293-299 | `inherit`, `.katex` 바깥 → **무영향**. 주석의 "1.15" 문구만 갱신 |
| `.katex-html > .tag`(수식 안 참조번호) | 321-325 | 절대값 `var(--content-font-size, 15px) !important` → 값 불변, **상대 체감만 커진다**(본문과 맞추는 것이 Phase 57 P4 의도이므로 방향은 옳다) |
| `.katex .text`(수식 안 한글) | 217-220 | 절대 15px → 불변. 수식 글리프가 줄어 **한글:수식 크기차가 좁혀져 조화 개선**(부수 이득) |
| `.base:has(.mfrac, .sqrt, .op-symbol.large-op)` 0.4em 패딩 | 349-353 | `.katex` font-size 기준 em → **자동 비례 축소**, 조정 불필요 |
| `.tag { bottom: 0.79em }` | 305-311 | `.tag`가 절대 15px라 기준도 15px → **불변** |
| Phase 56 세로 중앙 정렬 | lib/editorScroll.ts 등 | 런타임 rect 측정 기반 → 자동 추종. **회귀 테스트 대상** |
| 인쇄 | PrintStyles:76 `1em` | **변수 미사용 → 무변경 확정**(D10' 근거) |

주석의 "1.15" 문구 3곳 갱신: globals.css 107·292·319.

**튜닝**: 한글(Pretendard)과 KaTeX 세리프는 같은 font-size에서 x-height가 달라 숫자로 결정 불가. 실문항(HAJI.26FS01.15처럼 인라인 수식이 본문에 섞인 문단)에서 1.06/1.08/1.10em을 나란히 비교해 확정.

### 3-5. P5 — 원문자 크기 완화

**`.num-circle`은 존재하지 않는다**(C7). Phase 57 P5는 합성을 폐기하고(globals.css 417-425의 실패 기록 참조) 글꼴 교체로 재구현했다 — 원문의 ① 문자를 그대로 두는 것이 요점이라 **CSS 훅이 없다.** 유일한 레버는 `@font-face`의 `size-adjust` 디스크립터다.

```css
/* globals.css:26-34 */
@font-face {
  font-family: 'MathoryCircled';
  src: local('AppleGothic'), local('Apple SD Gothic Neo'), local('Malgun Gothic'),
       url('…notosanskr…woff2') format('woff2');
  unicode-range: U+2460-2473;
  size-adjust: 92%;          /* Phase 58 P5 — 출발값, 실측 튜닝 (85~96%) */
  font-display: swap;
}
```

`size-adjust`는 글리프 아웃라인과 폰트 메트릭을 함께 스케일하므로 **글자 크기와 라인박스 기여분이 동시에 줄어든다** — 합성 방식에서 필요했던 `vertical-align`·`line-height` 수동 보정이 불필요하다. 세로 위치가 어긋나면 `ascent-override`/`descent-override` 추가.

**주의 3건**

1. **화면·인쇄 동시 적용**(D11') — `--font-print`도 같은 family(globals 99). 분리하지 않는다.
2. **브라우저 지원** — Chrome 92+ / Firefox 92+ / **Safari 17+**. 미지원 시 디스크립터를 무시해 현행 크기 유지(graceful degradation). 배포 리스크 없음.
3. **기기별 편차** — `local('AppleGothic')`(macOS) / `Malgun Gothic`(Windows) / Noto 폴백은 글리프 크기가 서로 다르다. **macOS/AppleGothic 기준**으로 맞추고 나머지는 감수(현재도 같은 상황).

**적용 지점**: 클래스가 없으므로 자동으로 전 지점 — 본문 원문자 · `.marker-circled` 내부 · 선택지 라벨(`ChoicesBlock`/`PrintChoicesBlock`) · 편집창 · 툴바 · 인쇄. 이것이 이 방식의 이점이자 인쇄만 따로 못 만드는 이유다.

**⚠ 진짜 리스크**: `p:has(.marker-circled)`의 `padding-left: 2em` / `text-indent: -2em`(globals 284-288, 인쇄 PrintStyles 128-129)은 **고정값**이다. 원문자가 줄면 마커와 본문 사이가 벌어진다 → 축소율에 따라 2em을 함께 조정해야 할 수 있다. **화면·인쇄 두 곳 1:1 대응 유지.**

Phase 57 검증 기준 재실행: 행간(1.8) 불침범 / 선택지 3·5등분 baseline / 내어쓰기 폭.

---

## 4. Stage 계획

| Stage | 작업 | 파일 | 비고 |
|---|---|---|---|
| **0** | 좌표 드리프트 재확인 — `git log 21e1e73..HEAD --stat -- components/ app/ lib/` | — | EditorView 미리보기 좌표 특히 |
| **1** | **P4** `--katex-scale: 1.15em → 1.08em` + 주석 "1.15" 3곳(107·292·319) | globals.css | 값 1개. 독립 커밋 |
| **2** | **P5** `@font-face`에 `size-adjust: 92%` + 내어쓰기 2em 재검(화면·인쇄 1:1) | globals.css · PrintStyles.css | Safari 17 미만 무변화 |
| **3** | **P1** h1/h2/h3 인라인 style 개정 + 언더라인 제거 + 5개 사이트 `paddingTop` + `--weight-*` 주석 | EditorPreview.tsx:335-343 · 5개 사이트 · globals.css:101 | **T1 실측 선행.** 인쇄 제목 무수정 |
| **4** | **P2** `lib/keyTone.ts` + `.tone-baseline` 분리 + `PrintTab.id` + `ProblemTabContent` tabId prop + 5개 사이트 클래스 + globals/PrintStyles CSS | 8~10개 파일 | 가장 큰 작업 |
| **5** | **P3** `lib/mathIndex.ts` 추출 → `toggleKeyWrap` → `KeySentenceIcon` → UnifiedToolbar 배선 (**단축키 제외**) | MarkdownEditor · EditorView · UnifiedToolbar | |
| **6** | 문서 갱신(§7) + **T16** aligned 실태 조사(P6 분리 Phase 판단 자료) | CLAUDE.md · roadmap · prelaunch-bug-cleanup.md | |

각 Stage 독립 커밋. Stage 3이 Stage 1 뒤인 이유: 제목 1.08em의 체감이 수식 스케일에 상대적이다.

---

## 5. 검증 체크리스트

| # | 항목 |
|---|---|
| **T1** | **P1 — 값 확정보다 실측이 먼저.** DevTools로 ① 앞 블록 타입별(text / display 수식 / 리스트 / ① 밭) 제목 상단 실간격 측정 ② 3항 구성이 예측과 맞는지 ③ 그 위에서 `paddingTop` 역산. **측정 없이 0.5em을 확정하지 말 것.** 이후 언더라인 없음, h1>h2>h3 역전 없음, 연속 heading·문서 첫 heading·문제/풀이 두 영역 |
| T2 | **마커 없는 문항 무변화**: `**`가 없는 문항의 화면·인쇄가 Phase 58 전과 픽셀 동등(제목·수식크기·원문자 변화 제외). **callout만 있고 `**`가 없는 문항도 포함**(D13) |
| T2' | 마커 있는 문항: 비key **텍스트**는 픽셀 동등, 비key **수식**만 색 변화 |
| T3 | `**` 1개 삽입 순간 풀이 전체가 dim 전환, 해당 구간만 풀 톤 — 편집 미리보기 실시간 |
| T4 | `**문장 $인라인수식$ 문장**`: **수식 색까지 함께 복귀**(D3' 검증 — 빠지면 수식이 안 흐려진다). 굵기 변화 없음 |
| T5 | **D13 핵심**: ① `**` 없는 callout은 주변과 똑같이 dim(홀로 튀지 않음) ② callout 안 `**` 구간만 100% ③ callout만 있는 풀이는 톤 미발동 ④ 들여쓰기가 인접 katex-display와 x좌표 일치, 행 끝 `\tag{n}` 정상 ⑤ key 문장 끝 `\tag{n}`이 dim으로 남음(의도) |
| T6 | D8: `**$…$**`가 원 `$$…$$`와 조판 동등 수준이고 **수식 색이 100%로 올라오는지**. 다행 수식 줄당 분할 결과 |
| T7 | question 영역: `**`가 있어도 톤 미발동(스코프 격리) |
| T7' | **`extra_N` 탭**에서도 스코프 발동(D9) |
| **T8** | 명암비 도구 측정: dim이 `#F4EFE7`·`#EDE6DA`·`#FEFDFB` **세 배경 전부** 4.5:1 이상. dim↔full이 한눈에 지각되는지 — **부족하면 D3-B(`--tone-dim: #675F52`) 승격.** 승격 시 `#5D5647`과 두 종류 회색으로 보이지 않는지(1.16:1) |
| T8' | **D9' 검증**: has-key 문항과 비has-key 문항의 **제목 색이 동일**(양쪽 secondary). B안 승격 시에도 유지 |
| T9 | 인쇄: 전체 100% 톤 복원, key 텍스트만 굵게, 흑백 인쇄 |
| **T10** | 툴바 **버튼만으로** 전 기능 동작(단축키 없이): 감싸기/해제 토글, 공백·`\tag` 자동 제외, 문단 넘는 선택 거부, 수식 내부 경계 거부, undo 1회 복원, 좁은 화면 미소실. **그 다음 별건으로** Chrome·Safari에서 ⌘⇧B 가로채기 성공 여부 → 실패 시 미배정 또는 ⌘⇧K |
| T10' | 아이콘: `KeySentenceIcon`이 브라켓 11종과 나란히 이질감 없음(22px), hover·active·disabled에서 **색이 함께 변하는지**(currentColor), `ProofreadIcon`과 혼동 없음 |
| T11 | 5개 사이트 전부 T2~T5 동일 — 특히 **`PrintTab.id` 누락 시 인쇄에서 조용히 미적용**되므로 인쇄 필수 포함 |
| T12 | 기존 콘텐츠 실태: 전 문항 raw_text에서 **볼드 용도 `**`** 목록화. **게이트가 아니라 사전 고지용**(D4') — 배포 즉시 톤이 켜질 문항을 덕수에게 미리 전달 |
| T13 | P4: 인라인 수식 섞인 문단에서 1.06/1.08/1.10em 비교 → 육안 승인. **파급표 8행 전수 확인.** display 수식·`\tag` 위치·Phase 56 세로정렬 무붕괴. 인쇄 무변화 |
| T13' | P1: **인쇄 제목이 바뀌지 않았는지**(D10'' — PrintStyles 50-52 무수정) |
| T14 | P5: 원문자가 행간(1.8) 불침범, 두 자리(⑩~⑳) 가독, 선택지 3·5등분 baseline, **2em 내어쓰기와 축소된 글리프가 맞는지**, 본문·선택지·편집창·인쇄 4곳 일관, **Safari 17 미만 무변화(깨짐 아님)** |
| **T17** | D14: 같은 문항의 앱 열람뷰 ↔ 공유뷰 톤 렌더 동일. **`letter-spacing`이 바뀌지 않아 줄바꿈 위치가 보존**되는지(부착 전후 스크린샷 대조). 기존 공개 문항 본문색 일괄 변화 육안 승인 후 배포 |
| **T16** | *(P6 분리 Phase 판단 자료 — 본 Phase에서 조사만)* 전 문항 raw_text grep: `\begin{aligned\|gathered\|array}` 사용 문항 수 vs 최상위 `\\` 사용 문항 수 |

---

## 6. P6 사양 (별도 Phase 승계분)

**결론: DOM 레벨 접기로 구현 가능. 단 house style `$$ … \\ … $$` 전용이다.**

**타당성 실측** (katex 0.16.28):

| 입력 | `span.mspace.newline` | 판정 |
|---|---|---|
| 최상위 `\\` 2행 / 4행 | 1 / 3 | ✔ 행 수 = n−1 |
| `\begin{cases}` | 0 | ✔ 의도대로 미산입 |
| `\begin{aligned}` | **0** | ⚠ **접기 불가** |
| 최상위 `\\` + `\tag*{(1)}` | 1 | ✔ `.tag`는 형제 |

`aligned`/`gathered`/`array`는 `.base > .mord > .mtable > .col-align-r|l > .vlist`에서 **각 행이 절대 위치(`top:-4.66em` 등)로, 열마다 따로** 배치된다. `display:none`을 걸어도 `.vlist`의 고정 height가 남아 행 단위 접기가 원리적으로 불가능하다.

**동작 사양**: ① `.katex-html > .mspace.newline` 개수로 행 수 산출, **≥4행**이면 접기 대상 마킹 ② 첫 행·마지막 행 사이의 모든 자식(인접 `.newline` 포함, **`.tag`는 제외**)을 `display:none` + "⋯ N행 접힘" 합성 행 삽입 ③ **기본 펼침**, 상태 비영속 ④ 적용 = 열람 계열 전부(EditorView 미리보기·ProblemView·FolderView·공유뷰), **인쇄만 제외**.

**주의**: 한 행 = `.base` 1개가 아니다(`a=1`이 2개로 쪼개짐) → 그룹핑 단위는 "`.newline` 경계 사이의 **모든** 자식". `package.json`의 `"katex": "^0.16.28"`은 **캐럿 범위**라 마이너 업그레이드가 자동 유입 → 정확 버전 핀 고정 또는 구조 부재 시 조용히 기능을 끄는 방어 코드. react-markdown 재렌더에 소실되므로 `useEffect` 후처리로 매 렌더 재적용. Phase 56 `activeMathId` 하이라이트·클릭 중앙 정렬이 접힌 영역을 목표로 하면 **자동 펼침 후 스크롤**. 터치 기기는 hover가 없어 상시 소형 버튼. 토글 시 스크롤 점프 방지(`lib/editorScroll.ts` 재사용).

**착수 판단**: T16 결과에서 `aligned` 비율이 높으면 효용 재평가.

---

## 7. 문서 갱신 (Stage 6)

**CLAUDE.md**

- "key sentence 톤 시스템 — key 마커는 인라인 `**` **하나뿐**이다. 강조문(callout)은 들여쓰기로 위치를 강조하는 레이아웃 블록이고 톤과 무관하다(D13). `**`가 없는 풀이는 톤 미발동(D4). 스코프는 `tabId !== 'question'`(D9). 인쇄는 parity 의도적 예외(전체 100% + key만 굵게, D6)."
- "`--katex-scale`은 **`em` 단위 포함 값**이다. 무단위로 바꾸면 선언이 무효가 되어 KaTeX 기본 1.21em으로 되돌아간다(= 커진다)."
- "heading 스타일은 `EditorPreview.tsx` 인라인 style이 유일한 진실 — globals.css의 heading 절은 규칙 없는 주석이다. **CSS로 못 바꾼다.**"
- "`.problem-content-toned`가 수식에 **명시 color**를 준다 — 수식 색을 바꾸려면 `.katex`를 직접 겨냥해야 한다(상속으로는 안 닿는다)."
- "원문자 크기 레버는 `@font-face 'MathoryCircled'`의 **`size-adjust` 하나뿐**이다(클래스 없음). 화면·인쇄가 같은 family를 공유한다."
- "**제목 블록 위 여백은 3항 구성**이다 — 앞 블록에서 이월된 마진 + 래퍼 `paddingTop` + h2 자신의 `marginTop`. **em 마진은 자기 요소의 font-size 기준**이라 h2의 `1em`은 본문 1em이 아니다. 여백을 논하기 전에 반드시 DevTools로 실측할 것."
- "**명암비 계산은 `((c+0.055)/1.055)^2.4`** — `/1.055`를 빠뜨리면 판정이 뒤집힌다. 실배경은 흰색이 아니라 클레이(`#F4EFE7`/`#EDE6DA`/`#FEFDFB`)이고 구속 조건은 FolderView 카드 `#EDE6DA`다."
- "툴바 아이콘은 `UnifiedToolbar.tsx` 안의 인라인 SVG 컴포넌트 계열이다 — `SVG_PROPS` + `CORNER_BRACKETS` 공유, `stroke="currentColor"`. **별도 `.svg` 파일로 빼면 상태별 색 변화가 죽는다.**"
- "제목 블록은 `--weight-*`의 '700 금지'에 대한 유일한 예외다(D1'')."

**사용 가이드**(에디터 도움말 또는 phasedocs)

- **강조의 두 축** — "강조문 블록은 **들여쓰기**로 강조합니다. **색(톤)**으로 강조하려면 `**`로 감싸세요. 둘은 별개라 따로 써도 되고 같이 써도 됩니다."
- **D8** — "독립행 수식 `$$…$$`은 색으로 강조할 수 없습니다(블록 문법). 강조하려면 인라인으로 바꿔 `**$…$**`로 쓰세요 — 크기·조판은 그대로입니다. 여러 행짜리 수식은 줄당 `$…$`로 나눠 쓰세요."
- **D4'** — "풀이에 `**`가 하나라도 있으면 **수식이 본문과 같은 톤으로 정리되고 `**` 구간만 진하게** 표시됩니다. 원치 않으면 `**`를 지우세요."

**roadmap** Phase 58 절 신설 — 디자인 목표와의 대응(핵심 아이디어 전달 = 톤 시스템 / 일목요연 = 제목 블록 · Phase 57 여백 체계). P6는 별도 Phase(59 후보)로 예고.

**prelaunch-bug-cleanup.md** — ⌘B/⌘F/⌘J의 `e.key` 사용 등록.

---

## 8. 판별 이력 (교차검증 기록)

| 판 | 작성 | 기여 |
|---|---|---|
| v1 | web | 목업·디자인 방향 확정(D1·D2·D4~D9), P6 A안 착상 |
| v2 | CLI | 실측 9건(C1~C9)으로 사실관계 정정, D13 반영, P6 분리 판정, Stage 표 |
| v3 | web | v2 재검증 — **명암비 계산 오류 적발**(`/1.055` 누락), em 마진 기준 지적, **제목 톤 숨은 회귀 적발**, D14·T0 보강 |
| **v4** | **CLI** | T0 수행(커밋·좌표 드리프트·공유뷰 배경 확정), **여백 3항 구성**(v1~v3 공통 오류), 제목 처방을 삭제→고정으로, ⌘⇧B Safari 점유, D14를 색만 분리로. **전 판 통합** |

**각 판이 앞 판의 오류를 하나씩 남긴 채 넘어갔다.** 값·산술·좌표는 반드시 실측 주체가 검증할 것 — 이 문서에서 아직 실측되지 않은 유일한 수치는 **T1의 제목 여백**이며, 그래서 Stage 3은 실측을 선행 조건으로 둔다.
