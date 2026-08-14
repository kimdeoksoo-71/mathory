# Phase 57 — 리스트 여백 · '목록' 블록 · '강조문' 블록 · \tag 표준화 · 원문자 개선 · **v4 (확정본 · 착수용)**

> v1(웹 Claude 초안) → v2(CLI Claude, 실코드 대조) → v3(웹 Claude, K1 기준 도입) → **v4(CLI Claude, 실코드 재대조 + K1 산식 정정 + 덕수 결정 반영).**
> **모든 결정 확정 — 이 문서가 구현 기준.** 라인 번호는 `8da5c42` 기준.

---

## 0. v3 → v4 변경

### 0.1 🔴 F-B — K1의 전제가 실코드와 다르다 (산식 전면 재계산)

v3의 K1 표는 **"화면 문단 간격 = `<p>` UA 기본 1em"** 을 전제로 `1.5em`을 역산했다. **실제로는 0이다.**

- `app/globals.css:100-104`에 전역 리셋 **`* { margin: 0; padding: 0 }`** 이 있다. 작성자 스타일은 UA 기본을 이기므로 `<p>`의 margin은 0이다.
- EditorPreview의 ReactMarkdown `components`(EditorPreview.tsx:303-363)에는 **`p` 오버라이드가 없다**(h1/h2/h3/table/th/td/pre만 있음).
- `.preview-content p`(globals:308-314)는 `text-align`/`word-break`만 지정 — margin 없음.
- **방증**: 요구사항 1.1("리스트 문단이 다른 문단과 별도의 간격을 두고 있지 않아 가시성이 떨어진다")이 나온 이유가 정확히 이것이다. 현행 `ul`의 `0.4em`이 **0인 문단 간격 위에** 얹혀 있어 거의 보이지 않는다. 요구사항 1.2("항목 사이는 일반적인 행간 유지")도 ① 항목 문단들이 지금 간격 0으로 붙어 있기 때문에 나온 표현이다.
- 인쇄는 다르다: `.print-body p { margin: 0 0 6pt }`(PrintStyles.css:50)가 리셋을 덮으므로 **문단 간격 6pt(= 본문 10pt 기준 0.6em)** 가 실재한다. **v3의 인쇄값 11pt는 옳다.**

즉 화면과 인쇄는 **문단 간격 자체가 다르다(0 vs 0.6em)**. 이 상태에서 "+0.5em"을 얹으면 어느 값을 써도 화면·인쇄가 어긋난다.

### 0.2 K1 확정 (덕수 결정 — 2026-08-14)

> **화면에도 인쇄와 동일한 문단 간격 `0.6em`을 신설하고, 그 위에 상하 각 `+0.5em`을 얹는다.**
> **→ 화면 `1.1em` / 인쇄 `11pt`. 화면·인쇄 체감이 처음으로 완전히 일치한다.**

| | 문단 간격 | 목표(+0.5em) | **적용 마진** | 실질 추가 |
|---|---|---|---|---|
| 화면 | **0 → `0.6em` 신설** | 1.1em | **`margin: 1.1em 0`** | +0.5em ✓ |
| 인쇄 | `6pt`(= 0.6em, 기존) | 11pt | **`margin: 11pt 0`** | +0.5em ✓ |

- 화면 1.1em(본문 15px → 16.5px) vs 인쇄 11pt(본문 10pt → 1.1em). **동일 배율** ✓
- 적용 대상(전부 같은 값): **display 수식 · ul/ol · ① 원문자 밭(D1) · 강조문(.callout-block)**.
- 마진끼리 인접하면 collapse로 `max(1.1, 1.1) = 1.1em` → 리듬 유지.
- **부수 효과(의도됨)**: 기존 모든 문서의 화면 문단 사이에 없던 간격 0.6em이 생긴다(문단 구분이 살아나는 방향). display 수식은 위 1em→1.1em(+0.1), 아래 1.8em→1.1em(−0.7)로 **아래쪽이 눈에 띄게 조여진다** — 의도된 대칭화. Stage 1에서 실제 문항으로 육안 확인 후 진행.

### 0.3 🟠 F-C — D11 가드 범위 축소 (회귀 위험 제거)

v3의 가드는 "직전 줄이 리스트 항목이면 `-`/`=` 줄 앞 빈 줄 삽입을 건너뛴다"였다. 이 범위는 **`---`(thematic break, hr 의도)까지 포함**한다. v3의 V2 메모는 "동작 불변"이라 단정했지만, CommonMark의 lazy continuation·setext·thematic break 우선순위에 기대는 판단이라 **검증 없이 넓힐 이유가 없다**.

**v4: 현재 줄이 "단일 대시"일 때로만 좁힌다.** 프리셋(`- ` 3줄)은 정확히 통과하고, `--`/`---`/`=` 계열은 **오늘과 100% 동일하게 동작**한다 — 회귀 가능성 0.

### 0.4 v3에서 그대로 승계한 것

- v2의 지적 **E1~E4 · M1~M7** 전량 수용 상태 유지.
- 신규 결정 **D8~D12** 전부 확정.
- v3의 신규 관찰 **V1**(`.tag *` 전칭이 KaTeX vlist 높이 계산과 충돌하지 않는지 확인) 유지 — Stage 4 검증 항목.

### 0.5 v4 추가 관찰 (2건)

- **W1 — Phase 56과의 접점**: display 수식 여백 변경은 미리보기 수식의 문서 좌표를 바꾼다. `computeBlockAwareScrollTop`/`computeMathCenterScrollTop`(lib/editorScroll.ts:50·73)은 런타임 DOM 측정 기반이라 자동 흡수되지만, Phase 56에서 맞춘 **"편집창↔미리보기 수식 세로 중앙 정렬" 체감**이 달라질 수 있다 → Stage 1 검증에 포함. 아울러 **`[data-noscroll]` 컨테이너에 세로 overflow 경고가 뜨지 않는지** dev 콘솔 확인(CLAUDE.md 불변식).
- **W2 — 제목(heading) 여백은 범위 밖**: h1/h2/h3는 인라인 `marginTop: 1em / marginBottom: 0.5em`(EditorPreview.tsx:327-334)로 별도 체계다. 문단 0.6em 신설 후 제목 위는 `max(0.6, 1) = 1em`, 아래는 `0.5em`로 유지된다(무해). 이번 Phase에서 건드리지 않는다.

---

## 1. 결정표 — 전부 확정

| # | 결정 | 확정 |
|---|---|---|
| **K1** | 상하 여백 통일 기준 | **문단 간격 0.6em 신설 + 상하 각 +0.5em → 화면 `1.1em` / 인쇄 `11pt`.** 수식·ul/ol·① 밭·강조문 공통 |
| D1 | ① 원문자 밭 여백 정규화 | **포함** (K1 값으로, §2.5) |
| D2 | 강조문 구현 | **A안(블록 신설)** |
| D2′ | B안(`>> ` 행 마커) | **Phase 57 범위 밖** — 후속 Phase 후보 |
| D3 | 강조문 타입 키 | **`callout`** |
| D4 | '목록' 프리셋 | **불릿 3 + 빈 줄 + ① 3 (빈 항목)** — D11 선행 |
| D5 | 여백 CSS 스코프 | **`.preview-content` / `.print-body` 한정** (전역 금지) |
| D6 | 수식 내 \tag도 본문 글꼴 | **통일** — `.tag` 서브트리 전칭 |
| D7 | 원문자 개선 | **O3 합성 원문자** (전역 1패스 + CSS) |
| D8 | 인쇄 리스트 항목 간 3pt | **제거** |
| D9 | 빈 블록 타입 전환 시 프리셋 | **적용** (`raw_text.trim()===''`일 때만) |
| D10 | EmptyBlockChips 라벨 | 칩은 **`(가)(나)`** 축약 |
| D11 | preventSetextHeadings 가드 | **추가하되 "단일 대시" 한정**(F-C) — 2곳 동시 |
| D12 | 두 자리 원문자(⑩~⑮) | **min-width + border-radius:999px** |

---

## 2. P1 — 상하 여백 통일 (K1)

### 2.1 현행 실측 (교체 대상)

| | 현행 | → K1 |
|---|---|---|
| 화면 문단 간격 | **0** (전역 리셋 globals:102) | **0.6em 신설** |
| 화면 display 수식 | `1em / 1.8em` (EditorPreview.tsx:443, `!important`) | `1.1em / 1.1em` |
| 화면 ul | `0.4em 0 0.4em 1em` (globals:209) | 상하 `1.1em`, 좌 1em 보존 |
| 화면 ol | `0.4em 0` (globals:243) | 상하 `1.1em` |
| 화면 ① 문단 | 정규화 없음 | D1 (§2.5) |
| 인쇄 문단 간격 | `0 0 6pt` (PrintStyles:50) | **불변** |
| 인쇄 display 수식 | `8pt 0 14.4pt 0` (65) | `11pt 0` |
| 인쇄 ul | `4pt 0 4pt 1em` (55) | `11pt 0 11pt 1em` |
| 인쇄 ol | `4pt 0` (53) | `11pt 0` |
| 인쇄 li 간 | `3pt` (54·56) | **0** (D8) |

**em 기준 확인**: `.katex-display`(바깥 div)는 `--katex-scale`(1.15)이 걸리는 `.preview-content .katex`(191-194) 선택자에 매치되지 않는다 → 마진이 **본문 font-size 기준**이라 ul/ol/callout과 동일 픽셀. ✓

### 2.2 화면 — 문단 간격 신설

```css
/* globals.css 신규 — K1: 화면에도 인쇄와 동일한 문단 간격(0.6em = 6pt/10pt).
   bottom-only (인쇄 .print-body p와 동일 패턴) → 인접 문단 collapse로 정확히 0.6em. */
.preview-content p { margin-bottom: 0.6em; }
```

특이도 검토 (전부 확인 완료):

| 기존 규칙 | 특이도 | 신규 `.preview-content p` (0,1,1) | 결과 |
|---|---|---|---|
| `.choices-grid .preview-content p { margin: 0 }` (335) | (0,2,1) | 짐 | 선택지 셀 **0 유지** ✓ |
| `ul li > p:first-child { display:inline; margin:0 }` (234-237) | (0,1,3) | 짐 | loose list 항목 첫 문단 **0 유지** ✓ |
| `p:has(.marker-circled) { … !important }` (264-268) | (0,1,1) + !important | 세로 마진은 미지정 | 충돌 없음 ✓ (D1이 별도로 덮음) |

### 2.3 화면 — 수식·리스트

```css
/* EditorPreview.tsx:441-444 inline <style> 교체 (KaTeX 자체 .katex-display 마진을 이기려면 !important 유지) */
.preview-content .katex-display { margin-top: 1.1em !important; margin-bottom: 1.1em !important; }
```

```css
/* globals.css 신규 — D5 콘텐츠 스코프 한정.
   ⚠ shorthand 금지: 전역 ul(209)의 margin-left:1em을 지워버린다. */
.preview-content ul,
.preview-content ol {
  margin-top: 1.1em;
  margin-bottom: 1.1em;
}
/* 중첩 리스트는 현행(0.4em) 유지 — 특이도 (0,1,2) > (0,1,1) */
.preview-content li ul,
.preview-content li ol {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}
```

### 2.4 인쇄 (E1·M1·D8)

```css
/* PrintStyles.css — .print-body p(50)는 그대로 6pt 유지 */
.print-body .katex-display { margin: 11pt 0; }           /* 65행 마진만 교체, break-inside/padding-left는 유지 */
.print-body ul { margin: 11pt 0 11pt 1em; }              /* ul 좌측 1em 반드시 보존 */
.print-body ol { margin: 11pt 0; }
.print-body li ul { margin: 4pt 0 4pt 1em; }
.print-body li ol { margin: 4pt 0; }
/* D8 — 항목 사이는 행간만 (요구사항 1.2). 화면과 동일하게 0 */
.print-body ul li,
.print-body ol li { margin-bottom: 0; }
```

> `.print-body ol`의 `padding-left: 24pt`, `ul`의 `padding-left: 1.4em`, `ol li`의 `padding-left: 2pt`는 그대로(가로 체계는 범위 밖).

### 2.5 D1 — ① 원문자 밭

```css
/* 화면 (globals.css) — ⚠ longhand만 (기존 264-268의 margin-left:1em !important와 충돌 방지) */
.preview-content p:has(.marker-circled) { margin-top: 1.1em; margin-bottom: 0; }
.preview-content p:has(.marker-circled) + p:has(.marker-circled) { margin-top: 0; }
.preview-content p:has(.marker-circled):not(:has(+ p .marker-circled)) { margin-bottom: 1.1em; }

/* 인쇄 (PrintStyles.css, 104행 아래) */
.print-body p:has(.marker-circled) { margin-top: 11pt; margin-bottom: 0; }
.print-body p:has(.marker-circled) + p:has(.marker-circled) { margin-top: 0; }
.print-body p:has(.marker-circled):not(:has(+ p .marker-circled)) { margin-bottom: 11pt; }
```

- 항목 사이 = `max(0, 0) = 0` → **행간만** ✓ (markdown ul의 tight list 항목 간격도 0이라 일관).
- 밭 위 = `max(앞 p bottom 0.6em, 1.1em) = 1.1em` ✓ / 앞이 수식·리스트면 `max(1.1, 1.1) = 1.1em` ✓.
- 특이도: R1 (0,2,1) < R2 (0,3,2), R3 (0,3,2). R2·R3는 서로 다른 프로퍼티라 동점 무해. `.preview-content p`(0,1,1)·`.print-body p`(0,1,1)를 전부 이긴다 ✓.
- `:has()` 리스크: 현행 코드가 이미 `li:has(> p:first-child > .marker-case-sub)`(globals:227)를 쓰므로 신규 리스크 없음. **불발 시 폴백**: 전처리에서 밭 마지막 span에 `marker-circled-last` 클래스 부여 → 단순 클래스 타게팅.
- (가)/ㄱ. 마커(`marker-gana`/`marker-giyeok`)는 gana/roman **상자 블록** 전용 → 이번 정규화에서 제외(현행 유지).

### 2.6 검증

1. **네 조합 간격 실측이 전부 1.1em(인쇄 11pt)**: 문단↔수식 / 문단↔리스트 / 수식↔리스트 / 문단↔① 밭.
2. 문단↔문단 = 0.6em(화면), 6pt(인쇄).
3. 중첩 리스트 0.4em 유지 / 선택지 셀 내부 0 유지 / loose list 첫 문단 0 유지.
4. **앱 UI 리스트(사이드바·드롭다운) 무영향** — D5 스코프 실증.
5. **W1**: 편집창↔미리보기 수식 세로 정렬(수식 클릭·⌘F 이동)이 여전히 자연스러운지, `[data-noscroll]` 경고 없는지.
6. 기존 문항 3~4개로 before/after 육안 대조(특히 수식 아래 1.8em→1.1em 축소 체감).

---

## 3. P2 — '목록' 블록 + 명칭 재조정

### 3.1 타입·상수 (EditorView.tsx)

```
types/problem.ts:157          → union에 'list' | 'callout' 추가
BLOCK_TYPE_LABELS(76-86)      → list: '목록', callout: '강조문' (+ §3.2 재조정)
BLOCK_TYPES(89-91)            → ['text','heading','list','callout','gana','roman','box','choices','image']
BLOCK_PRESETS(94-104)         → list: (§3.3), callout: ''
TEXT_BASED_TYPES(107-109)     → +list +callout
SPLITTABLE_TYPES(112-114)     → +list +callout
```

**'list'는 렌더 수정 불필요** — BORDERED도 특수 타입도 아니므로 5개 사이트(EditorView 3142-3208 / ProblemView 327-393 / FolderView 247-293 / ProblemTabContent 21-59 / PrintableContent 59-73)가 전부 `image → svg → ggb → BORDERED → choices → 기본` 순서라 기본 markdown 경로로 자동 낙하. (5곳 분기 구조 직접 확인 완료.)

### 3.2 명칭 재조정 (라벨만 — 타입 키 불변 → 저장 데이터·VCS diff·공유 스냅샷 영향 0)

| 타입 키 | 현행 | 변경 |
|---|---|---|
| `gana` | `(가) (나) (다)` | **`(가), (나) 상자`** |
| `roman` | `ㄱ. ㄴ. ㄷ.` | **`ㄱ, ㄴ 상자`** |
| `box` | `글상자` | **`빈 글상자`** |

수정 지점은 `BLOCK_TYPE_LABELS` **한 곳** + `EmptyBlockChips`(225)의 하드코딩 `'(가)(나)(다)'` → D10에 따라 **`(가)(나)`**. 드롭다운(813·817·820)·헤더(791)·추가 메뉴(3098)는 전부 상수 경유 → 자동.

### 3.3 프리셋 + D11 (E4 대응, F-C 반영)

프리셋:
```
- 
- 
- 

① 
② 
③ 
```

`preventSetextHeadings`의 `/^\s{0,3}-+\s*$/`가 `- `(대시+공백)에 매치되어 2·3번째 줄 앞에 빈 줄을 밀어넣는다 → loose list 승격 → 항목 간격 붕괴.

**D11 — "단일 대시" 한정 가드**. `lib/preprocess.ts:88-107`과 `components/editor/EditorPreview.tsx:40-60` **양쪽 동일 수정**:

```js
const isSetextUnderline =
  /^\s{0,3}-+\s*$/.test(line) || /^\s{0,3}=+\s*$/.test(line);
// Phase 57 D11: "대시 1개뿐인 줄"이 리스트 항목 바로 뒤에 오면 그것은 setext underline이
// 아니라 빈 리스트 항목이다. 빈 줄을 넣으면 loose list로 승격돼 항목 간격이 깨진다.
// 단일 대시로 한정 → '---'(thematic break) 등 나머지는 기존 동작 100% 불변.
const isLoneDash = /^\s{0,3}-\s*$/.test(line);
const prevIsListItem = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/.test(prevLine);

if (isSetextUnderline && prevLine.trim() !== '' && !(isLoneDash && prevIsListItem)) {
  result.push('');
}
```

- `문단 → - ` 는 prevIsListItem이 false → 기존대로 빈 줄 삽입(setext 방어 유지) ✓
- `- a → ---` 는 isLoneDash가 false → 기존 동작 유지 ✓
- CLAUDE.md의 "locale.ts ↔ EditorPreview.tsx 동기화" 계열 — **한쪽만 고치면 화면/인쇄가 갈린다.**
- EditorPreview에서는 `protectFences`(68-81) 안쪽에서 실행되므로 코드펜스 오염 없음.

**ordered 파트에 markdown `1.`이 아닌 ① 리터럴을 쓰는 근거**: marker-circled 내어쓰기 파이프라인 + P5 합성 원문자 혜택을 동시에 받는다. `ol` decimal은 P5 대상 밖이라 요구사항 5(조화)에서 이탈.

### 3.4 D9 — 빈 블록 타입 전환 시 프리셋 (M2)

현행 1518 분기는 `!TEXT_BASED_TYPES.has(b.type)` 탓에 텍스트→텍스트 전환에서 프리셋을 적용하지 않는다(빈 텍스트 → '목록' 전환 시 빈 블록). 1518 **앞**에 추가:

```js
} else if (type !== b.type && !raw_text.trim() && BLOCK_PRESETS[type]) {
  raw_text = BLOCK_PRESETS[type];
  const finalText = raw_text;
  queueMicrotask(() => { editorRefs.current[blockId]?.setContent(finalText); });
}
```

- 내용이 빌 때만 → **데이터 손실 불가**.
- CM 직접 갱신은 heading 전환(1502-1517)에서 검증된 패턴 재사용(텍스트→텍스트는 MarkdownEditor가 재마운트되지 않음).
- 기존 (가)/ㄱ. 칩의 "빈 텍스트 전환 시 빈 블록" 불편도 함께 해소.
- `pushUndo`는 `handleBlockTypeChange`에 이미 배선(1469: 실제 타입 변경일 때만) → 추가 작업 0.

### 3.5 저장·호환

additive 타입 → Firestore 규칙·마이그레이션 0. `toPersistedBlock` 트림이 프리셋 내부 빈 줄(불릿↔① 구분)을 갉지 않는지 Stage 2 실측.

---

## 4. P3 — '강조문' 블록 (K1 값)

### 4.1 렌더 (5곳)

BORDERED와 같은 자리에 `<div className="callout-block">`(테두리 없음). BORDERED 래퍼가 인라인 style인 사이트(EditorView 3186·ProblemView 375·FolderView 281)에서도 **클래스로 통일** — 화면·인쇄 값을 한 곳에서 관리해야 parity가 유지된다.

### 4.2 CSS (M3 반영)

```css
/* 화면 (globals.css) */
.callout-block {
  margin: 1.1em 0;        /* K1 */
  padding-left: 3em;      /* .katex-display 화면 들여쓰기(globals:186)와 동일 값·동일 em 기준 */
  padding-right: 0;       /* \tag float:right 기준선 = 컨테이너 우단 */
}
.callout-block p { margin: 0; }                       /* 블록 안 여러 행은 행간만 */
.callout-block .katex-display { padding-left: 0; }    /* 이중 들여쓰기 방지 */

/* 인쇄 (PrintStyles.css) */
.print-body .callout-block {
  margin: 11pt 0;         /* K1 */
  padding-left: 2em;      /* fleqn 들여쓰기(PrintStyles:24)와 동일 */
  padding-right: 0;
  break-inside: avoid;    /* 강조문 1~3행 전제 — 길어지면 제거 검토 */
}
.print-body .callout-block p { margin: 0; }           /* M3 — .print-body p의 0 0 6pt 상쇄 */
.print-body .callout-block .katex-display.fleqn > .katex { padding-left: 0 !important; }
```

**들여쓰기 기준 일치 확인**: 화면 `.katex-display { padding-left: 3em }`(globals:185-187)의 em은 본문 기준, 인쇄는 `@media print` 안의 `.katex-display.fleqn > .katex { padding-left: 2em }`(24)이고 `.print-body .katex { font-size: 1em }`(68)이라 본문 10pt 기준 2em. 양쪽 다 callout과 동일 기준 ✓

**주의**: `.callout-block p { margin: 0 }`은 `.preview-content p`(0,1,1)와 특이도 동점 (0,1,1)이다. **globals.css에서 `.preview-content p` 규칙보다 뒤에 배치**할 것(§8 배치 순서 준수). 안전하게 `.preview-content .callout-block p { margin: 0 }`으로 (0,2,1)을 확보해도 된다 — **후자를 채택**한다.

### 4.3 `\tag{n}` — 추가 작업 없음

텍스트 행 끝 `\tag{n}` → tag-marker 파이프라인(locale.ts:151-154 / EditorPreview.tsx:160-162)이 이미 동작. 요구사항 3.2.2(수식 밖 문장에 `\text{}` 없이 참조번호)는 이것으로 충족. P4 적용 후에는 본문 글꼴로 나온다.

### 4.4 A안의 한계 (기재 유지)

"여러 줄 수식 중 가운데 한 행만 참조번호"는 블록 3분할 필요. 완화: `callout`이 SPLITTABLE이라 ⌘B 분할(1601) 즉시 가능. 그래도 아프면 **D2′(B안 `>> ` 행 마커)** 를 후속 Phase로 — 전처리 2곳+CSS만으로 가능. **blockquote(`>`) 재사용은 금지**(인쇄에서 이미 text-box, PrintableContent:103 / PrintStyles:52).

---

## 5. P4 — \tag 참조번호 = 본문 글꼴·크기

### 5.1 현행 (E2·M6)

`\tag{n}`은 `preprocessMath`에서 **`\tag*{(n)}`** 로 변환된다(preprocess.ts:120, EditorPreview.tsx:174). `(n)`은 **수학 모드**라 `.mopen/.mord/.mclose`로 렌더되고 **`.text`는 생기지 않는다** → v1이 지목한 `.tag .text`만 고치면 글꼴이 전혀 안 바뀐다.

인쇄는 `.tag .text`만 0.95em로 덮는데(96-99) 실제 렌더는 `.mord`라 globals의 `14px !important`(300-303)가 관통한다 — **잠복 버그(M6)**, P4가 함께 닫는다.

### 5.2 구현

```css
/* 화면 (globals.css) — 수식 밖 */
.tag-marker {
  float: right; white-space: nowrap; margin-left: 2em;
  font-family: inherit;   /* 본문 Pretendard */
  font-size: inherit;     /* .katex 밖이라 1.15 스케일 무관 */
}
/* 화면 — D6: 수식 안도 동일 모양. 기존 295-303 교체.
   절대값 필수: 1em/inherit이면 .katex의 --katex-scale(1.15)을 재차 물어 커진다. */
.katex-display > .katex > .katex-html > .tag,
.katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-content) !important;
  font-size: var(--content-font-size, 15px) !important;
}

/* 인쇄 (PrintStyles.css) — 77-83·96-99 교체.
   .print-body 접두로 특이도 확보 (CSS 로드 순서에 의존하지 않음, A-13) */
.print-body .tag-marker { font-family: inherit; font-size: inherit; }
.print-body .katex-display > .katex > .katex-html > .tag,
.print-body .katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-print) !important;
  font-size: 1em !important;    /* .print-body .katex = 1em = 10pt */
}
```

- **`.strut { display: none }`(288-290)은 유지 — 건드리지 말 것.** 무력화하면 번호가 수식 중앙축으로 복귀한다.
- **V1 검증**: `.tag *` 전칭이 KaTeX 내부 vlist의 em 기반 높이 계산과 충돌하지 않는지 1·2·5행 수식에서 tag 박스 위치·높이 확인(기존 14px 고정도 같은 방식이라 리스크는 낮다).

### 5.3 `bottom` 재보정 (E3 — 필수)

`.tag { top:auto; bottom: 0.85em; line-height: 1 }`(globals:283-287)은 **14px 기준 눈맞춤 값**. 글꼴(세리프→Pretendard)과 크기(14→15px)가 동시에 바뀌면 baseline이 어긋난다.

- 출발값: `0.85 × 14/15 ≈ **0.79em**` → **1·2·5행 수식에서 마지막 행 baseline과 번호 baseline을 나란히 놓고 실측 보정**(폰트 메트릭 차이로 이론값만으론 부족).
- 인쇄도 동일 절차(변경 후 `.tag`는 1em = 10pt 기준).
- em이라 글꼴 크기 슬라이더에는 자동 대응.

### 5.4 부수 효과 (의도됨)

전 문항 참조번호 일괄 변경(세리프 14px → 본문 글꼴) / `\ref` 인용(`(n)` 리터럴·`\text{(n)}` → 이미 본문 글꼴)과 **처음으로 일치** / float 라인박스: 14×1.8=25.2px < 27px → 15px에서 정확히 27px, 높이 불변(Stage 4 확인만).

---

## 6. P5 — 원문자 합성 (O3)

### 6.1 원리

①~⑮는 폰트 스택 글리프(고정 아님). 작은 이유는 글리프 구조("원+숫자"를 1em 박스에). O3 = 글리프를 버리고 **본문 글꼴 숫자 + CSS 원**으로 합성 → 요구사항 5("크기가 글자 크기에 일치") 정확 충족.

### 6.2 변환 — 전역 1패스

```js
// lib/locale.ts preprocessLocale 3단계 — convertCircledList 직후 (순서 고정)
processed = convertCircledGlyphs(processed);

/** ①~⑮ 글리프 → 합성 원문자. 행 시작분은 이미 marker-circled로 감싸여 있어
 *  자동으로 <span class="marker-circled"><span class="num-circle">1</span></span> 중첩이 된다.
 *  글리프가 숫자로 소모되므로 이중 변환이 원천적으로 불가능. */
function convertCircledGlyphs(text: string): string {
  return text.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/g,
    (ch) => `<span class="num-circle">${ch.charCodeAt(0) - 0x245F}</span>`);
}
```

- `protectMath` 보호 구간 안(3단계) → 수식 무오염. `insertMarkerLineBreaks`·`convertCircledList`보다 **뒤**여야 한다.
- **EditorPreview.tsx(149 직후)에 동일 패스** — 2곳 동기화 규칙.
- 커버: 행 시작 마커 + **행 중간 인용**("①과 ②에서") 전부. 편집창 CM·툴바 입력은 원문 `①` 유지.
- **선택지 라벨은 별도**(React 텍스트 노드): ChoicesBlock.tsx:38 `<span>{label}</span>` · PrintableContent.tsx:130 `print-choice-label`을 num-circle 마크업으로 교체. 파싱(raw_text의 ① 리터럴 기준, ChoicesBlock:11-22 / PrintableContent:113-121)은 표시 단계와 무관 → 무영향.

### 6.3 CSS (M4·M5·D12)

```css
.num-circle {
  display: inline-block;              /* inline-flex 금지 — 선택지 baseline 정렬 편차(M5) */
  box-sizing: border-box;
  min-width: 1.35em; height: 1.35em;  /* D12: 두 자리는 가로 확장 */
  line-height: 1.28em;                /* height − border×2 → 세로 중앙 */
  padding: 0 0.12em; text-align: center;
  border: 0.08em solid currentColor;
  border-radius: 999px;               /* 1자리=원, 2자리=스타디움 */
  font-size: 0.86em;                  /* ← 실측 튜닝 */
  font-weight: var(--weight-regular); /* marker-circled의 600 차단 */
  font-variant-numeric: tabular-nums;
  vertical-align: -0.22em;            /* ← 실측 튜닝 */
}
/* 인쇄: 동일 선언 (.print-body .num-circle) — 10pt에서 테두리 ≈0.28mm */
```

검증 기준: 행간(1.8)을 밀어내지 않을 것 / 선택지 3·5등분 baseline / 인쇄 2단 / `marker-circled`의 내어쓰기 폭(min-width 2em) 무변경.

### 6.4 합류 효과

P4 + O3 → 참조번호·원문자·선택지 라벨이 **본문 글꼴 하나로 통일**(요구사항 5 완결).

---

## 7. 엣지 케이스

- **Undo/Redo**: 신규 타입·D9 전부 기존 pushUndo 배선(1469·1536·1548·1601·1645·1709·1932…) 위 → 추가 작업 0.
- **toPersistedBlock**: 프리셋 내부 빈 줄 보존 Stage 2 확인.
- **선택지 셀 내부**: 리스트 여백 규칙이 셀 안까지 내려간다 → 셀 안 리스트가 1.1em을 먹으면 `.choices-grid .preview-content ul, .choices-grid .preview-content ol { margin: 0.4em 0 }` 예외 추가.
- **글꼴 크기 슬라이더**: 전부 em / `var(--content-font-size)` 기반 → 자동 대응.
- **인쇄 특이도**: 화면 규칙이 CSS 변수를 쓰므로 인쇄 규칙에는 반드시 `.print-body` 접두(A-13: CSS 로드 순서 비보장).
- **D11**: 문단 아래 `-`/`---` 방어 불변(단일 대시 + 직전 리스트 항목일 때만 완화).
- **W2**: 제목 블록 여백 체계는 이번 범위 밖.

---

## 8. 파일/모듈 + globals.css 배치 순서

```
# P1 (K1)
components/editor/EditorPreview.tsx:441-444  → katex-display 1.1em/1.1em
app/globals.css                              → ① .preview-content p(0.6em) → ② ul/ol(1.1em) → ③ D1 3규칙 → ④ .callout-block
components/print/PrintStyles.css             → katex-display(65) 11pt + ul/ol(53·55, 좌 1em 보존) + D8(54·56) + D1 3규칙

# P2
types/problem.ts:157                         → 'list' | 'callout'
components/editor/EditorView.tsx             → 상수 5곳(76·89·94·107·112) + EmptyBlockChips(225) + D9(1518 앞)
lib/preprocess.ts:88-107                     → D11 가드
components/editor/EditorPreview.tsx:40-60    → D11 동일 (2곳 동기화)

# P3
components/editor/EditorView.tsx:3185 부근   → callout 분기
components/problem/ProblemView.tsx:373 부근  → 분기
components/problem/FolderView.tsx:281 부근   → 분기
components/share/ProblemTabContent.tsx:38 부근 → 분기
components/print/PrintableContent.tsx:67 부근  → 분기
app/globals.css / PrintStyles.css            → .callout-block

# P4
app/globals.css                              → .tag-marker(271-277) + .tag 서브트리(295-303 교체) + bottom 재보정(285)
components/print/PrintStyles.css             → .tag-marker(77-83) + .tag 서브트리(96-99 교체) + bottom(88)

# P5
lib/locale.ts                                → convertCircledGlyphs (convertCircledList 직후)
components/editor/EditorPreview.tsx:149 직후 → 동일 패스
components/editor/ChoicesBlock.tsx:38        → 라벨 num-circle
components/print/PrintableContent.tsx:130    → 동일
app/globals.css / PrintStyles.css            → .num-circle
```

**배치 순서 주의**: globals.css에서 `.preview-content p`(0.6em)보다 뒤에 D1·callout 규칙을 두거나, callout은 `.preview-content .callout-block p`로 특이도를 확보(§4.2 채택안).

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0** — 순수 클라이언트.

---

## 9. 구현 순서

**Stage 1 · P1 (K1)** — 문단 0.6em 신설 → 수식 1.1em/11pt → ul/ol → D8 → D1.
검증: §2.6 여섯 항목.

**Stage 2 · P2** — D11(2곳) → 프리셋 → D9 → 라벨.
검증: 6줄 tight list 렌더(빈 줄 승격 없음) / 리스트 직후 `---` hr 불변 / 문단 뒤 `- ` setext 방어 불변 / 빈 텍스트→목록 전환 프리셋(D9) / 라벨 3종 / 저장→재로드→인쇄 / toPersistedBlock 빈 줄 보존 / undo 왕복.

**Stage 3 · P3** — 타입 + 5곳 분기 + CSS.
검증: 행간·상하 여백(1.1em)·들여쓰기를 수식과 나란히 / `\tag` x좌표 일치 / 내부 `$$` 이중 들여쓰기 해소 / ⌘B 분할 / 인쇄·공유뷰.

**Stage 4 · P4 (+bottom 실측 루프)** — §5.2 → 1·2·5행 baseline 실측 → bottom 확정 → 인쇄 동일.
검증: 텍스트 tag/수식 tag/`\ref` 일치 / V1 / 라인박스 불변 / `problem-content-toned` 뷰.

**Stage 5 · P5** — 전처리 2곳 + 선택지 2곳 + CSS → 치수 실측.
검증: 본문 숫자와 크기 일치 / 행간 침범 없음 / ⑩~⑮ 스타디움 / 선택지 baseline / 행 중간 인용 / 인쇄 / 편집창 원문 유지.

**Stage 6 · 통합** — 다섯 기능 공존 문항으로 화면·인쇄 대조. roadmap.md 갱신 + CLAUDE.md 정정(`\tag*{…… ㉠}` → `\tag*{(n)}`, 전처리 파이프라인 설명).

---

## 부록 A. 실코드 사실관계 (`8da5c42` — CLI 전수 확인)

- **A-0 [v4 신규]** 전역 리셋 `* { margin: 0; padding: 0 }`(globals:100-104). EditorPreview ReactMarkdown `components`에 `p` 없음(303-363). → **화면 문단 간격 0**. 인쇄만 `.print-body p { margin: 0 0 6pt }`(50).
- **A-1** 타입 union(types/problem.ts:157) · 상수 6종(EditorView 76-123, BORDERED=gana/roman/box) · 레거시 정규화(117-120).
- **A-2** 렌더 5곳: EditorView 3138·3142-3208 / ProblemView 325·327-393 / FolderView 245·247-293 / ProblemTabContent 38·21-59 / PrintableContent 67·59-73. 공통 순서 `image→svg→ggb→BORDERED→choices→기본`. **SnapshotView에 타입 분기 없음**(공유는 PublicViewerShell→ProblemTabContent 단일 경로).
- **A-3** 앞 4곳은 `<EditorPreview borderless>` 경유(3190·3201 / 379·392 / 284·293 / 44·59) → `.preview-content` 자동 커버. 인쇄만 자체 ReactMarkdown(PrintableContent:86).
- **A-4** 리스트 CSS 전역 스코프: ul 206-210(`margin: 0.4em 0 0.4em 1em`) / ol 240-244 / `ul li > p:first-child`(234-237). 인쇄 ol 53·ol li 54·ul 55·ul li 56.
- **A-5** 수식: 화면 1em/1.8em(EditorPreview:443, `!important`)·`padding-left:3em`(185-187), 인쇄 `8pt 0 14.4pt 0`(65)·fleqn 2em(24). `.katex-display`는 `--katex-scale` 비적용 → 본문 em 기준.
- **A-6** ① 파이프라인: 강제 빈 줄(EditorPreview:105 / locale:64) + marker-circled(147-149 / 140-143). CSS 내어쓰기 globals 257-268(`!important` 3종)·PrintStyles 103-104. p 마진 정규화 없음.
- **A-7** \tag: 텍스트 행 → tag-marker(151-154 / 160-162), 수식 내 → `\tag*{(n)}`(preprocess:120) = 수학 모드(`.text` 부재). 스타일 globals 271-277·283-303(14px·bottom 0.85em·strut none), 인쇄 77-83·86-99(`.mord` 누락 = M6).
- **A-8** preventSetextHeadings 2곳 사본(preprocess:88-107 / EditorPreview:40-60), `/^\s{0,3}-+\s*$/`가 `- `에 매치. EditorPreview는 `protectFences`(68-81) 안쪽 실행(275행).
- **A-9** blockquote → 인쇄 text-box(PrintableContent:103 / PrintStyles:52) — 강조문 재사용 금지.
- **A-10** 프리셋: 추가 시 적용(1554), 타입 변경은 `!TEXT_BASED_TYPES.has(b.type)`일 때만(1518) → D9 대상. heading 전환 CM 직접 갱신 패턴(1502-1517).
- **A-11** 선택지: 파싱 ①~⑤ 리터럴(ChoicesBlock 11-22 / PrintableContent 113-121), 라벨 span ChoicesBlock:38 · PrintableContent:130, 셀 p 마진 0(globals:335 / PrintStyles 130·133).
- **A-12** 글꼴 변수: `--font-ui`(75)·`--font-content`(77)·`--font-print`(79)·`--katex-scale: 1.15em`(88)·`--content-font-size` 주입(EditorView:214-217, 기본 15px).
- **A-13** CSS import: globals는 app/layout.tsx:1, PrintStyles는 컴포넌트 3곳(PrintableContent:12 / PdfDownloadButton:6 / EditorView:45) → 순서 비보장, `.print-body` 접두로 특이도 확보.
- **A-14** pushUndo 배선 12곳(1469·1536·1548·1601·1645·1653·1662·1709·1932·2247·2293·2320) → 신규 타입 자동 커버.

## 부록 B. 로드맵 메모

- 의존: **P1 → P2**, **D11 → 프리셋**. P3·P4·P5 상호 독립(분리 배포 가능).
- P4·P5는 "CSS만"이 아니다 — **실측 루프** 포함해 견적(Stage 4·5).
- D2′(강조문 B안 `>> ` 행 마커)는 후속 Phase 후보.
- 검증 워크플로우: v1(웹 초안) → v2(CLI 실코드 대조, 오류 4·누락 7) → v3(웹, K1 도입) → **v4(CLI, K1 전제 오류 1 + 가드 범위 1 정정)**. Phase 56과 동일하게 **네 라운드 모두에서 새 결함이 나왔다.**
