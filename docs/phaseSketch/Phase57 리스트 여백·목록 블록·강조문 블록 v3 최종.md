# Phase 57 — 리스트 여백 · '목록' 블록 · '강조문' 블록 · \tag 표준화 · 원문자 개선 · **v3 최종 (확정본)**

> v1(웹 Claude 초안) → v2(CLI Claude 실코드 전수 대조) → **v3(웹 Claude 최종 검토 — v2의 오류·누락 지적 전부 수용 + v2가 놓친 덕수 확정 기준 재적용).**
> **모든 결정 확정 — 착수 가능.** 확정본을 `docs/phasedocs/`에 배치. 부록 A 라인 번호는 `8da5c42` 기준(웹·CLI 양측 확인).

---

## 0. v2 → v3 변경 (먼저 읽을 것)

### 0.1 🔴 F-A — v2의 여백 값은 구버전 기준이다 (전면 재적용)

v2는 **덕수 확정(2026-08-14) 이전의 v1**을 기준으로 작성되어, 여백 값이 전부 구 기준(화면 1em/1.8em 비대칭, 인쇄 8pt/14.4pt)이다. **확정 기준은 다음과 같다:**

> **display 수식의 "실질 추가 간격"을 위아래 각 +0.5em으로 동일하게 재조정하고, 같은 기준을 목록 블록(리스트·①원문자 런)과 강조문 블록에 그대로 적용한다.**

마진 값이 아니라 **체감 간격**으로 정의한 뒤 마진 상쇄를 역산한다:

| | 일반 문단 간격 | 목표 간격(+0.5em) | **요소 마진(상쇄 역산)** |
|---|---|---|---|
| 화면 | p UA 기본 1em (상쇄 후) | 1.5em | **`margin: 1.5em 0`** (max(1.5, 1) = 1.5 ✓, 위아래 대칭) |
| 인쇄 | `.print-body p` margin-bottom 6pt (본문 10pt = 0.6em) | 6pt + 5pt = 11pt | **`margin: 11pt 0`** (위: max(11, 6) = 11 ✓ / 아래: 다음 p top 0 → 11 ✓) |

적용 대상(전부 동일 값): **display 수식(현행 1em/1.8em·8pt/14.4pt 교체) · ul/ol · ①원문자 런(D1) · 강조문(.callout-block)**. 요소끼리 인접해도(수식↔리스트 등) max(1.5, 1.5) = 1.5em으로 리듬 유지. 기존 문서 전체의 수식 간격이 바뀐다(위 +0.5em, 아래 -0.3em) — **의도된 전면 변화**.

이에 따라 v2의 §2.2·2.3·2.4·4.2 값 전부와 D1 셀렉터 구성이 v3에서 갱신되었다(아래 본문이 최종).

### 0.2 v2 지적의 수용 (전부 검증 후 확정)

- **E1**(인쇄 ul 좌측 1em shorthand 소실) · **E2**(수식 내 \tag는 `\tag*{(n)}` 수학 모드 → `.text` 부재) · **E3**(`.tag bottom:0.85em` 재보정 필수) · **E4**(`- ` 프리셋 줄이 setext 판정에 걸려 loose list 승격) — **웹 Claude가 레포에서 재확인, 전부 사실. 수용.**
- **M1~M7**(인쇄 li 3pt·빈 블록 전환 프리셋·강조문 인쇄 p 마진·두 자리 원문자·inline-flex baseline·인쇄 \tag 14px 관통·D1 셀렉터 단순화) — **전부 수용.** 단 M7의 "margin-top 무규칙" 단순화는 구 기준에서만 성립 → 신 기준에 맞게 재구성(§2.4).
- **신규 결정 D8~D12** — 전부 기본안대로 **확정**(§1).
- 스팟 재검증 완료: preprocess.ts:120(`\tag*{(n)}`), EditorView.tsx:45(PrintStyles import — A-13 로드 순서 주장 사실), pushUndo 배선(1469·1536·1548·1601·1645…), ChoicesBlock.tsx:38(라벨 span).

### 0.3 v3 추가 보완 (2건)

- **V1**: P4의 `.tag *` 전칭 셀렉터 — `.tag` 서브트리에 KaTeX vlist 래퍼가 있으면 내부 em 기반 높이 계산이 font-size 강제에 영향받을 수 있음 → Stage 4 검증에 "1·2·5행 수식에서 tag 박스 높이/위치 깨짐 없음" 명시(기존 14px 강제도 같은 방식이라 리스크는 낮음).
- **V2**: D11 가드의 곁가지 — 리스트 항목 직후 `---`(3자 이상, hr 의도) 행은 가드로 빈 줄이 안 들어가도 CommonMark상 thematic break가 리스트를 끊으므로 동작 불변 → Stage 2 검증 케이스에 포함만.

---

## 1. 결정표 — 전부 확정

| # | 결정 | **확정** |
|---|---|---|
| **K1** | 상하 여백 통일 기준 (덕수 확정) | **실질 추가 간격 위아래 각 +0.5em → 화면 마진 1.5em / 인쇄 11pt.** 수식·목록·①런·강조문 공통 |
| D1 | ① 원문자 런 여백 정규화 | **포함** (K1 값으로, §2.4) |
| D2 | 강조문 구현 | **A안(블록 신설)** |
| D2′ | B안(`>> ` 행 마커) 병행 | **Phase 57 범위 밖** — 블록 3분할 비용이 실사용에서 아프면 후속 Phase |
| D3 | 강조문 타입 키 | **`callout`** |
| D4 | '목록' 프리셋 | **불릿 3 + 빈 줄 + ① 3 (빈 항목)** — D11 선행 필수 |
| D5 | 여백 CSS 스코프 | **`.preview-content` / `.print-body` 한정** (전역 금지) |
| D6 | 수식 내 \tag도 본문 글꼴 통일 | **통일** (E2 방식으로 — `.tag` 서브트리 전칭) |
| D7 | 원문자 개선 방식 | **O3 합성 원문자** (전역 1패스 + CSS) |
| D8 | 인쇄 리스트 항목 간 3pt | **제거** (화면 parity — 항목 사이는 행간만) |
| D9 | 빈 블록 타입 전환 시 프리셋 주입 | **적용** (`raw_text.trim()===''`일 때만 — 데이터 손실 불가) |
| D10 | EmptyBlockChips 라벨 | 칩은 **`(가)(나)`** 축약, 드롭다운·헤더는 정식 명칭 |
| D11 | preventSetextHeadings 리스트 가드 | **추가** (preprocess.ts·EditorPreview.tsx 2곳 동시) |
| D12 | 두 자리 원문자(⑩~⑮) | **min-width + border-radius:999px** (스타디움 허용) |

---

## 2. P1 — 상하 여백 통일 (K1)

### 2.1 기준값

**신규 기준(K1): 화면 `1.5em / 1.5em`, 인쇄 `11pt / 11pt`** — §0.1의 상쇄 역산. 현행 실측(교체 대상): 화면 수식 1em/1.8em(EditorPreview.tsx:443), 인쇄 수식 8pt/14.4pt(PrintStyles.css:65), 화면 리스트 0.4em(globals.css:209·243), 인쇄 리스트 4pt(PrintStyles.css:53·55).

**em 기준(v2 확인 유지)**: `.katex-display`(바깥 div)는 `--katex-scale`(1.15) 셀렉터에 걸리지 않아 마진이 **본문 font-size 기준** — ul/ol·callout과 같은 픽셀값. ✓

### 2.2 화면

```css
/* EditorPreview.tsx:441-444 inline <style> 교체 — display 수식 신규 기준 (K1) */
.preview-content .katex-display { margin-top: 1.5em !important; margin-bottom: 1.5em !important; }
```

```css
/* globals.css 신규 — D5: 콘텐츠 스코프 한정. ⚠ shorthand 금지(전역 ul의 margin-left:1em 보존) */
.preview-content ul,
.preview-content ol {
  margin-top: 1.5em;
  margin-bottom: 1.5em;
}
/* 중첩 리스트는 현행(0.4em) 유지 */
.preview-content li ul,
.preview-content li ol {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}
```

### 2.3 인쇄 (E1·M1·D8 반영)

```css
/* PrintStyles.css — ul 좌측 1em 반드시 보존(현행 55행 longhand 분리) */
.print-body ul { margin: 11pt 0 11pt 1em; }
.print-body ol { margin: 11pt 0; }
.print-body li ul { margin: 4pt 0 4pt 1em; }
.print-body li ol { margin: 4pt 0; }
/* D8 — 항목 사이는 행간만 (요구 1.2). 화면은 이미 0 */
.print-body ul li,
.print-body ol li { margin-bottom: 0; }
```

> `.print-body ol`의 `padding-left: 24pt`, `ul`의 `padding-left: 1.4em`은 그대로(가로 체계는 범위 밖).

### 2.4 D1 — ① 원문자 런 (K1 기준으로 재구성)

v2의 "margin-top 무규칙" 단순화는 구 기준(위 = 문단 간격과 동일)에서만 성립했다. 신 기준은 **위쪽도 +0.5em**이 필요하므로 다음 3규칙:

```css
/* 화면 (globals.css) — ⚠ longhand만 사용 (기존 264-268의 margin-left:1em !important와 충돌 방지) */
.preview-content p:has(.marker-circled) { margin-top: 1.5em; margin-bottom: 0; }   /* 런 시작 후보 + 항목 사이 0 */
.preview-content p:has(.marker-circled) + p:has(.marker-circled) { margin-top: 0; } /* 연속 항목이면 위 여백 제거 */
.preview-content p:has(.marker-circled):not(:has(+ p .marker-circled)) { margin-bottom: 1.5em; } /* 런의 마지막 */
```

- 취약했던 `:not(p:has(…)) + p:has(…)` 복합은 여전히 불필요(v2 단순화 정신 유지) — "모든 ①문단에 top 1.5em, 연속이면 0"이 같은 효과를 더 단순한 인접결합자로 낸다.
- 첫 항목 위: max(앞 p bottom 1em, 1.5em) = 1.5em ✓. 앞이 수식·리스트여도 max(1.5, 1.5) = 1.5 ✓.
- 인쇄 동일 3규칙(`.print-body` 접두, 1.5em → 11pt). 현행 PrintStyles.css:104 아래에 추가.
- `:has()` 리스크·폴백은 v2 판단 유지: 현행 코드가 이미 `:has()` 사용 중(globals:227)이라 신규 리스크 아님. 불발 시 전처리에서 `marker-circled-last` 클래스 폴백.
- (가)/ㄱ. 마커는 상자 블록 안 — 제외(현행 유지).

### 2.5 검증

문단↔수식·문단↔리스트·수식↔리스트·문단↔①런 **네 조합의 간격이 전부 1.5em(인쇄 11pt)으로 측정**되는지 실측(수식 요소가 p 안에 중첩 렌더되어 상쇄가 깨지는 조합이 있으면 그 조합만 보정) / 중첩 리스트 / 선택지 셀 내부(globals:335 상호작용 — 필요 시 `.choices-grid` 예외) / 앱 UI 리스트 무영향(D5) / 기존 문항으로 수식 간격 변화 육안 확인.

---

## 3. P2 — '목록' 블록 + 명칭 재조정 (v2 유지, K1 무관)

### 3.1 타입·상수

```
types/problem.ts:157          → union에 'list' 추가
EditorView.tsx  BLOCK_TYPE_LABELS(76-86)  → list: '목록'
                BLOCK_TYPES(89-91)        → ['text','heading','list','callout','gana','roman','box','choices','image']
                BLOCK_PRESETS(94-104)     → list: (§3.3)
                TEXT_BASED_TYPES(107-109) → +list +callout
                SPLITTABLE_TYPES(112-114) → +list +callout
```

**렌더 수정 불필요** — 5개 사이트(EditorView 3142-3208 / ProblemView 327-393 / FolderView 247-293 / ProblemTabContent 21-59 / PrintableContent 59-73) 전부 `image → svg → ggb → BORDERED → choices → 기본` 순서로 기본 낙하(CLI 전수 확인).

### 3.2 명칭 재조정 (라벨만 — 데이터 영향 0)

`gana` → **(가), (나) 상자** / `roman` → **ㄱ, ㄴ 상자** / `box` → **빈 글상자**. 수정 지점은 `BLOCK_TYPE_LABELS` 한 곳 + EmptyBlockChips(225, D10: 칩은 `(가)(나)` 축약). 드롭다운(813·817·820)·헤더(791)·추가 메뉴(3098)는 상수 경유 — 자동.

### 3.3 프리셋 + D11 (E4 대응)

프리셋: `- \n- \n- \n\n① \n② \n③ `

이대로면 `preventSetextHeadings`의 `/^\s{0,3}-+\s*$/`가 2·3번째 `- `를 setext underline으로 오판해 빈 줄을 삽입 → loose list 승격 → 항목 간격 붕괴(E4). **D11 가드를 2곳 동시에**(lib/preprocess.ts:88-107, EditorPreview.tsx:40-60):

```js
const prevIsListItem = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/.test(prevLine);
if (isSetextUnderline && prevLine.trim() !== '' && !prevIsListItem) {
  result.push('');
}
```

- 가드가 좁아 원래 방어 대상(문단 아래 `-` 줄)은 그대로 방어. 리스트 직후 `---`(hr 의도)는 가드 유무와 무관하게 thematic break로 동작(V2 — 검증 케이스만).
- ordered 파트에 markdown `1.`이 아닌 **① 리터럴**을 쓰는 근거 유지: marker-circled 내어쓰기 + P5 합성 원문자 혜택을 동시에 받는다.

### 3.4 D9 — 빈 블록 타입 전환 시 프리셋 (M2 대응)

1518 분기 앞에 추가(빈 내용일 때만 — 데이터 손실 불가):

```js
} else if (type !== b.type && !raw_text.trim() && BLOCK_PRESETS[type]) {
  raw_text = BLOCK_PRESETS[type];
  const finalText = raw_text;
  queueMicrotask(() => { editorRefs.current[blockId]?.setContent(finalText); });  // heading 전환(1502-1517) 검증 패턴 재사용
}
```

기존 (가)/ㄱ. 칩의 "빈 텍스트 전환 시 빈 블록" 불편도 함께 해소. pushUndo는 handleBlockTypeChange에 이미 배선(1469) — 추가 작업 없음.

### 3.5 저장·호환

additive 타입 — 규칙·마이그레이션 0. `toPersistedBlock` 트림이 프리셋 내부 빈 줄(불릿↔① 구분)을 갉지 않는지 Stage 2 실측.

---

## 4. P3 — '강조문' 블록 (K1 값 적용)

### 4.1 타입·상수

`callout` / '강조문' / 프리셋 `''` / TEXT_BASED + SPLITTABLE + BLOCK_TYPES 노출.

### 4.2 렌더(5곳) + CSS — M3 반영, K1 값

BORDERED와 같은 자리에 `<div className="callout-block">` (테두리 없음, **클래스로 통일** — 인라인 style 사이트에서도).

```css
/* 화면 (globals.css) */
.callout-block {
  margin: 1.5em 0;        /* K1 통일 기준 */
  padding-left: 3em;      /* .katex-display 화면 들여쓰기(globals:186)와 동일 값·동일 em 기준 */
  padding-right: 0;       /* \tag float:right 기준선 = 컨테이너 우단 */
}
.callout-block p { margin: 0; }
.callout-block .katex-display { padding-left: 0; }   /* 이중 들여쓰기 방지 — override로 확정 */

/* 인쇄 (PrintStyles.css) */
.print-body .callout-block {
  margin: 11pt 0;         /* K1 인쇄값 */
  padding-left: 2em;      /* fleqn 들여쓰기(PrintStyles:24)와 동일 */
  padding-right: 0;
  break-inside: avoid;    /* 강조문 1~3행 전제 — 길어지면 제거 검토 */
}
.print-body .callout-block p { margin: 0; }          /* M3 — 인쇄 p 기본 0 0 6pt 상쇄 */
.print-body .callout-block .katex-display.fleqn > .katex { padding-left: 0 !important; }
```

들여쓰기 기준 일치(화면 3em/인쇄 2em 모두 본문 em 기준)는 v2가 실측 확인 ✓.

### 4.3 `\tag{n}` — 추가 작업 없음

텍스트 행 끝 `\tag{n}` → tag-marker 파이프라인(locale.ts:151-154 / EditorPreview.tsx:160-162)이 이미 동작. P4 적용 후에는 본문 글꼴로 나온다. Stage 3에서 수식 `\tag`와 x좌표 나란히 실측.

### 4.4 A안의 한계 (기재 유지)

"여러 줄 수식 중 가운데 한 행만 참조번호" 시나리오는 블록 3분할 필요. 완화: `callout`이 SPLITTABLE이라 ⌘B 분할(1601) 즉시 가능. 그래도 아프면 **D2′(B안 `>> ` 행 마커) 후속 Phase** — 전처리 2곳+CSS만으로 가능, blockquote(`>`) 재사용은 인쇄 text-box 선점(PrintableContent:103)으로 금지.

---

## 5. P4 — \tag 참조번호 = 본문 글꼴·크기 (E2·E3·M6 반영)

### 5.1 현행 (v2 실측 확정)

화면 tag-marker `KaTeX_Main 14px 고정`(globals:271-277) / 수식 내 `.tag`·`.text`·`.mord` 14px !important(globals:283-303) — 단 실제 렌더는 `\tag*{(n)}` 수학 모드(preprocess.ts:120)라 `.text` 규칙은 허공, `.mopen/.mclose`는 상속으로 14px. 인쇄는 `.tag .text`만 0.95em(PrintStyles:96-99) → **`.mord`에 globals 14px가 관통(M6, 잠복 버그)** — P4가 함께 닫는다.

### 5.2 구현

```css
/* 화면 (globals.css) — 수식 밖 */
.tag-marker {
  float: right; white-space: nowrap; margin-left: 2em;
  font-family: inherit;   /* 본문 Pretendard */
  font-size: inherit;     /* .katex 밖 → 1.15 스케일 무관 */
}
/* 화면 — D6: 수식 안도 동일 모양. 기존 295-303 교체. 절대값 필수(1em이면 --katex-scale 재승수) */
.katex-display > .katex > .katex-html > .tag,
.katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-content) !important;
  font-size: var(--content-font-size, 15px) !important;
}
/* 인쇄 (PrintStyles.css) — 77-83·96-99 교체. .print-body 접두로 특이도 확보(A-13 로드 순서 비의존) */
.print-body .tag-marker { font-family: inherit; font-size: inherit; }
.print-body .katex-display > .katex > .katex-html > .tag,
.print-body .katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-print) !important;
  font-size: 1em !important;    /* .print-body .katex 1em = 10pt */
}
```

- `.strut { display:none }`(288-290)은 **유지 — 건드리지 말 것**(무력화 시 번호가 수식 중앙축으로 복귀).
- **V1(신규 검증)**: `.tag *` 전칭이 KaTeX 내부 vlist em 높이 계산과 충돌하지 않는지 1·2·5행 수식에서 tag 박스 위치·높이 확인(기존 14px 강제도 같은 방식이라 리스크 낮음).

### 5.3 `bottom` 재보정 (E3 — 필수 하위 작업)

`.tag { bottom: 0.85em; line-height: 1 }`(globals:283-287)은 14px 기준 눈맞춤 값. 글꼴·크기 변경으로 재보정 필수: 출발값 `0.85 × 14/15 ≈ 0.79em` → **1·2·5행 수식에서 마지막 행 baseline과 실측 보정**(폰트 메트릭이 달라 이론값 불충분). 인쇄도 동일 절차(1em = 10pt 기준). em이라 글꼴 크기 슬라이더에는 자동 동행.

### 5.4 부수 효과 (의도됨)

전 문항 참조번호 일괄 변경(세리프 14px → 본문 글꼴) / `\ref` 인용(`(n)` 리터럴·`\text{(n)}` — 이미 본문 글꼴)과 **처음으로 일치** / float 라인박스: 14×1.8=25.2px < 27px → 15px에서 정확히 27px, 높이 불변(v2 계산 ✓, Stage 4 확인만).

---

## 6. P5 — 원문자 합성 (O3, v2 방식 유지)

### 6.1 원리

①~⑮는 폰트 스택 글리프(고정 아님). 작은 이유는 글리프 구조("원+숫자"를 1em 박스에). O3 = 글리프를 버리고 **본문 글꼴 숫자 + CSS 원**으로 합성 → 요구("크기가 글자 크기와 일치") 정확 충족.

### 6.2 변환 — 전역 1패스 (v2 개선안 채택)

```js
// locale.ts preprocessLocale 3단계 — convertCircledList 직후 (순서 고정: 빈줄 삽입·marker 변환 뒤)
processed = convertCircledGlyphs(processed);

function convertCircledGlyphs(text: string): string {
  return text.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/g,
    (ch) => `<span class="num-circle">${ch.charCodeAt(0) - 0x245F}</span>`);
}
```

- protectMath 보호 구간 안 → 수식 무오염. 글리프가 소모되므로 이중 변환 원천 불가.
- **EditorPreview.tsx(149 직후)에 동일 패스** — 2곳 동기화 규칙.
- 커버: 행 시작 마커(marker-circled 중첩 자동) + **행 중간 인용**("①과 ②에서") 전부. 편집창 CM·툴바 입력은 원문 유지.
- **선택지 라벨은 별도**(React 텍스트 노드): ChoicesBlock.tsx:38 `<span>{label}</span>` · PrintableContent.tsx:130 `print-choice-label`을 num-circle 마크업으로 교체. 파싱(raw_text ① 리터럴 기준)은 무영향.

### 6.3 CSS (M4·M5·D12 반영)

```css
.num-circle {
  display: inline-block;              /* inline-flex 금지 — 선택지 baseline 정렬 편차(M5) */
  box-sizing: border-box;
  min-width: 1.35em; height: 1.35em;  /* D12: 두 자리는 가로 확장 */
  line-height: 1.28em;                /* height - border×2 → 세로 중앙 */
  padding: 0 0.12em; text-align: center;
  border: 0.08em solid currentColor;
  border-radius: 999px;               /* 1자리=원, 2자리=스타디움 */
  font-size: 0.86em;                  /* ← 실측 튜닝 */
  font-weight: var(--weight-regular); /* marker-circled의 600 차단 */
  font-variant-numeric: tabular-nums;
  vertical-align: -0.22em;            /* ← 실측 튜닝 */
}
.print-body .num-circle { /* 동일 선언 — 인쇄 10pt에서 테두리 ≈0.28mm */ }
```

검증 기준: 행간(1.8)을 밀어내지 않을 것 / 선택지 3·5등분 baseline / 인쇄 2단 / `marker-circled`의 내어쓰기 폭(min-width 2em)은 무변경 유지.

### 6.4 합류 효과

P4 + O3 → 참조번호·원문자·선택지 라벨이 **본문 글꼴 하나로 통일**(요구 5 완결).

---

## 7. 엣지 케이스 (v2 유지 + K1 반영)

- **Undo/Redo**: 신규 타입·D9 전부 기존 pushUndo 배선 안 — 추가 작업 0.
- **toPersistedBlock**: 프리셋 내부 빈 줄 보존 Stage 2 확인.
- **선택지 셀 내부**: 리스트 여백 규칙이 셀 안까지 내려감 → 셀 안 리스트가 1.5em을 먹으면 `.choices-grid .preview-content ul/ol { margin: 0.4em 0 }` 예외.
- **글꼴 크기 슬라이더**: 전부 em / `var(--content-font-size)` 기반 — 자동 동행.
- **인쇄 특이도**: 화면 규칙이 var를 쓰므로 인쇄 규칙은 반드시 `.print-body` 접두(A-13 로드 순서 비의존).
- **D11**: 문단 아래 `-` 방어 불변, 리스트 직후 `---` hr 동작 불변(V2).

---

## 8. 파일/모듈 (확정)

```
# P1 (CSS만, K1 값)
components/editor/EditorPreview.tsx   → inline <style>(441-444) katex-display 1.5em/1.5em
app/globals.css                       → .preview-content ul/ol + D1 3규칙
components/print/PrintStyles.css      → .katex-display 11pt(65) + ul/ol(좌 1em 보존!) + D8 + D1

# P2
types/problem.ts:157                  → 'list'
components/editor/EditorView.tsx      → 상수 5곳 + EmptyBlockChips(225) + D9(1518 앞)
lib/preprocess.ts:88-107              → D11 가드
components/editor/EditorPreview.tsx:40-60 → D11 동일 (2곳 동기화)

# P3 (K1 값)
types/problem.ts                      → 'callout'
components/editor/EditorView.tsx      → 상수 + 분기(3185 부근)
components/problem/ProblemView.tsx    → 분기(373 부근)
components/problem/FolderView.tsx     → 분기(281 부근)
components/share/ProblemTabContent.tsx→ 분기(38 부근)
components/print/PrintableContent.tsx → 분기(67 부근)
app/globals.css / PrintStyles.css     → .callout-block (+ 내부 katex-display override)

# P4 (CSS + bottom 실측)
app/globals.css                       → .tag-marker(271-277) + .tag 서브트리(295-303 교체) + bottom 재보정(285)
components/print/PrintStyles.css      → .tag-marker(77-83) + .tag 서브트리(96-99 교체) + bottom(88)

# P5 (O3)
lib/locale.ts                         → convertCircledGlyphs (convertCircledList 직후)
components/editor/EditorPreview.tsx   → 동일 패스(149 직후)
components/editor/ChoicesBlock.tsx:38 → 라벨 num-circle
components/print/PrintableContent.tsx:130 → 동일
app/globals.css / PrintStyles.css     → .num-circle
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0** — 순수 클라이언트, 배포 순서 제약 없음.

---

## 9. 구현 순서

**Stage 1 · P1 (K1 여백 통일)** — 수식 1.5em/11pt 교체 + ul/ol + D8 + D1.
검증: §2.5 네 조합 간격 실측 전부 1.5em(11pt) / 중첩 리스트 / 선택지 셀 / 앱 UI 무영향 / 기존 문항 수식 간격 변화 육안.

**Stage 2 · P2 (D11 → 프리셋 → D9 → 라벨)** — D11 2곳 먼저.
검증: 6줄 tight list 렌더(빈 줄 승격 없음) / 리스트 직후 `---` hr(V2) / 빈 텍스트→목록 전환 프리셋(D9) / 라벨 3종 / 저장→재로드→인쇄 / toPersistedBlock 빈 줄 보존 / undo 왕복.

**Stage 3 · P3 강조문** — 타입 + 5곳 분기 + CSS.
검증: 행간·상하 여백(1.5em)·들여쓰기를 수식과 나란히 / `\tag` x좌표 일치 / 내부 `$$` 이중 들여쓰기 해소 / ⌘B 분할 / 인쇄·공유뷰.

**Stage 4 · P4 (+bottom 실측 루프)** — §5.2 → 1·2·5행 수식 baseline 실측 → bottom 확정 → 인쇄 동일.
검증: 텍스트 tag/수식 tag/\ref 삼자 일치 / V1(tag 박스 위치·높이) / 라인박스 불변 / problem-content-toned에서도 동일.

**Stage 5 · P5 원문자** — 전처리 2곳 + 선택지 2곳 + CSS → 치수 실측.
검증: 본문 숫자와 크기 일치 / 행간 침범 없음 / ⑩~⑮ 스타디움 / 선택지 baseline / 행 중간 인용 / 인쇄 / 편집창 원문 유지.

**Stage 6 · 통합** — 다섯 기능 공존 실전 문항 화면·인쇄 대조(번호 체계 통일 §6.4). roadmap.md 갱신 + CLAUDE.md `\tag*{…… ㉠}` 서술 정정.

---

## 부록 A. 실코드 사실관계 (`8da5c42` — 웹·CLI 양측 확인 완료)

v2 부록 A-1~A-14를 그대로 승계한다(전 항목 유효 — 웹 Claude 스팟 재검증: preprocess.ts:120, EditorView.tsx:45 import, pushUndo 1469/1536/1548/1601/1645, ChoicesBlock.tsx:38). 요점만 재수록:

- **A-1** 타입 union(types/problem.ts:157)·상수 5종(EditorView 76-123) / **A-2** 렌더 5곳 분기 순서 `image→svg→ggb→BORDERED→choices→기본`, SnapshotView에 타입 분기 없음 / **A-3** 앞 4곳은 `<EditorPreview borderless>` 경유 → `.preview-content` 자동 커버, 인쇄만 자체 렌더러.
- **A-4** 리스트 CSS 전역 스코프(globals 206-244), 인쇄 ul `margin: 4pt 0 4pt 1em`(55 — E1의 근거), li 3pt(54·56 — D8 대상).
- **A-5** 수식: 화면 1em/1.8em(EditorPreview:443)·padding-left 3em(globals:185-187), 인쇄 8pt/14.4pt(65)·fleqn 2em(24). `.katex-display` 마진은 본문 em 기준(--katex-scale 비적용) — **전부 K1로 교체됨**.
- **A-6** ① 파이프라인: 강제 빈 줄(EditorPreview:105/locale:64) + marker-circled(147-149/140-143), p 마진 정규화 없음(D1 대상).
- **A-7** \tag: 텍스트 행 → tag-marker(151-154/160-162), 수식 내 → `\tag*{(n)}`(preprocess:120) = 수학 모드(.text 부재 — E2), 스타일 globals 271-303(14px·bottom 0.85em·strut none), 인쇄 96-99의 .mord 누락(M6).
- **A-8** preventSetextHeadings 2곳 사본(preprocess:88-107/EditorPreview:40-60), `- ` 매치(E4), protectFences 안쪽 실행.
- **A-9** blockquote 인쇄 text-box 선점 — 강조문 재사용 금지 / **A-10** 프리셋: 추가 시 적용(1554), 텍스트→텍스트 전환 미적용(1518 — D9 대상), heading CM 직접 갱신 패턴(1502-1517) / **A-11** 선택지 파싱 ① 리터럴·라벨 span(ChoicesBlock:38, PrintableContent:130) / **A-12** 글꼴 변수(--font-ui 75·--font-content 77·--font-print 79·--content-font-size 주입 EditorView:214-217) / **A-13** CSS 로드 순서 비보장 → `.print-body` 접두 필수 / **A-14** pushUndo 배선 완료 — 신규 타입 자동 커버.

## 부록 B. 로드맵 메모

- 의존: **P1 → P2**, **D11 → 프리셋**. P3·P4·P5 상호 독립(분리 배포 가능).
- P4·P5는 "CSS만"이 아니다 — bottom·치수 **실측 루프** 포함해 견적(Stage 4·5).
- D2′(강조문 B안 `>> ` 행 마커)는 후속 Phase 후보.
- Phase 번호 **57** 확정(phasedocs에 55·55a·56 존재).
