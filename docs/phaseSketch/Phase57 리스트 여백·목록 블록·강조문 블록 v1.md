# Phase 57(잠정) — 리스트 여백 · '목록' 블록 · '강조문' 블록 · \tag 표준화 · 원문자 개선 · v1 (초안)

> **웹 Claude가 덕수의 요구 문서("리스트블록.md") + 추가 요구 2건(\tag 텍스트 표준화 · 원문자 시인성)을 라이브 레포(`8da5c42`, 2026-08-14 15:42)와 대조해 작성한 교차검토용 초안.**
> 절차(Phase 55a와 동일): 이 초안 → CLI Claude(Claude Code)가 레포에서 재검증·v2 → 덕수 승인 → 착수 → 확정본을 `docs/phasedocs/`로.
> 부록 A의 라인 번호는 `8da5c42` 실측. Phase 번호는 착수 시 확정(잠정 57).

---

## ✅ 세 가지 요구에 대한 타당성 판정 (요약)

| # | 요구 | 판정 | 비용 |
|---|------|------|------|
| **P1** | (un)ordered list 상하 여백 — display 수식 기준과 일치 | **타당·가능** — CSS만으로 해결. 단 ①원문자 리스트는 markdown ul이 아니라 별도 처리 필요(D1), 여백 스코프 주의(D5) | 소 (CSS) |
| **P2** | '목록' 블록 신설 + 기존 블록 명칭 재조정 | **타당·가능** — gana/roman/box 선례(타입+프리셋)와 정확히 같은 패턴. 명칭 재조정은 라벨만 변경(타입 키 불변 → 데이터 영향 0) | 소~중 |
| **P3** | '강조문' 블록 신설 | **타당·가능** — BORDERED_TYPES와 같은 래퍼 패턴으로 5개 렌더 사이트에 추가. 텍스트 행 `\tag{n}` 은 기존 tag-marker 파이프라인이 이미 처리. 단, **필요성 1(여러 줄 수식 중 한 행만 tag)에는 블록보다 행 마커 문법이 더 잘 맞는 지점이 있어 대안 B를 병기**(D2) | 중 |
| **P4** | \tag 참조번호 = 본문 글꼴·크기 (수식 밖 표준화) | **타당·가능** — CSS만. 현행 tag-marker는 KaTeX_Main 세리프 + 화면 14px 고정 → 본문 글꼴·크기 상속으로 전환. 수식 안 \tag(레거시)도 같이 통일할지 결정(D6) | 소 (CSS) |
| **P5** | 원문자 ①~⑮ 시인성 개선 | **타당·가능** — 원문자는 기본폰트에 "고정"된 것이 아니라 폰트 스택이 그리는 글리프 → CSS로 교체 가능. 3가지 방안 비교 후 **합성 원문자(본문 숫자 + CSS 원)** 권장(D7) | 소~중 |

다섯 항목 모두 **순수 클라이언트**(Firestore 규칙·서버 변경 없음, P2·P3의 신규 type 문자열은 additive라 마이그레이션 불필요). Phase 55a(Undo/Redo)와의 충돌 없음 — 블록 추가·타입 변경 경로에 push가 이미 배선되어 있어 신규 타입도 자동으로 undo 대상이 된다.

### 열린 결정 (교차검토 대상)

| # | 결정 | 기본안(이 문서) | 대안 |
|---|------|------------------|------|
| **D1** | ①②③ 원문자 리스트의 항목 간 간격 정규화를 P1에 포함? | **포함** — 연속 marker-circled 문단을 "리스트 런"으로 취급: 항목 사이 마진 0(행간만), 런의 첫/끝에만 상하 여백. 미포함 시 '목록' 블록의 ordered 파트만 항목 사이가 벌어져 ul 파트와 어긋남 | 제외(ul/ol만) — 단순하나 P2 완성도 저하 |
| **D2** | 강조문 구현 방식 | **A안 — 블록 신설**(요구안 그대로) | B안 — 행 마커 문법(§4.4). A+B 병행도 가능(후속) |
| **D3** | 강조문 타입 키(영문) | **`callout`** — 'display'는 display math와 혼동 위험 | `emphasis` |
| **D4** | '목록' 프리셋 구성 | **불릿 3줄 + 빈 줄 + ①②③ 3줄이 한 블록에**(요구안 그대로) | 불릿만 / 추가 메뉴에서 2종 분리 |
| **D5** | 신규 리스트 여백의 CSS 스코프 | **`.preview-content` + `.print-body` 한정** (전역 ul/ol 규칙에 얹지 않음) | 전역 — 앱 UI 리스트 오염 위험, 비권장 |
| **D6** | 수식 안 \tag(레거시)도 본문 글꼴로 통일? | **통일** — 신·구 문서 혼재 시 참조번호 모양이 두 가지가 되는 것 방지. 기존에도 "크기 통일" 정책 선례 있음(globals.css 291-304 주석) | 수식 안은 KaTeX_Main 유지 — 표준이 수식 밖이므로 방치. 혼재 감수 |
| **D7** | 원문자 개선 방식 | **O3 — 합성 원문자**(전처리 ①→`<span class="num-circle">1</span>` + CSS 원). 숫자가 본문 글꼴 숫자 그대로라 "크기·조화" 요구에 정확히 부합 | O2 — 글리프 확대(font-size 보정, 1줄이지만 근본 해결 아님) / O1 — unicode-range 전용 폰트 매핑 |

### CLI Claude 검증 요청

1. 부록 A의 라인 실측이 `8da5c42` 기준으로 맞는지 (특히 5개 렌더 사이트의 분기 구조).
2. §2.3 마진 상쇄(collapsing) 판단 — p↔ul 인접 시 실제 렌더 결과가 display 수식 간격과 체감 일치하는지 브라우저 실측.
3. §3.2 신규 타입 'list'가 5개 렌더 사이트의 **기본 경로로 자동 낙하**하는지 (특수 분기 누락 없는지).
4. §4.3 강조문 안 tag-marker(float:right)의 우측 정렬이 display 수식 `\tag` 위치와 시각적으로 일치하는지.
5. `:has()` 인접 형제 셀렉터(D1 구현) 브라우저 호환 — 프로젝트 지원 브라우저 기준.
6. P4에서 tag-marker를 본문 크기(1em 상속)로 바꿀 때 float:right 행의 세로 정렬·행 높이가 흔들리지 않는지 (현행 14px 고정을 15px+ 상속으로 올리는 변화).
7. P5 합성 원문자(O3)의 원 지름·수직 정렬 실측 — 본문 15px 기준 원이 행간(1.8)을 밀어내지 않는지, 선택지 그리드·인쇄 2단에서 정상인지. ①이 **수식 보호 밖 전역 치환**이어도 안전한지(현행은 행 시작만 span 변환 — O3는 행 중간 ①도 대상, §6.3).

---

## 0. 현재 동작 (레포 실측 — 부록 A 근거)

- **markdown 리스트**: 화면 `ul { margin: 0.4em 0 0.4em 1em }`, `ol { margin: 0.4em 0 }` (globals.css 206-244, **전역 스코프**). 인접 문단 p의 UA 기본 마진(1em)과 상쇄되어 리스트 상하 간격 ≈ 일반 문단 간격 — **추가 여백 없음** (요구 문서의 진단과 일치).
- **display 수식 상하 간격 (일치 목표 기준값)**: 화면 `.preview-content .katex-display { margin-top: 1em; margin-bottom: 1.8em }` (EditorPreview.tsx:443, **위아래 비대칭**), 인쇄 `.print-body .katex-display { margin: 8pt 0 14.4pt }` (PrintStyles.css:65).
- **①원문자 리스트**: markdown ol이 아니라 **행 시작 ① 리터럴 → `<span class="marker-circled">` 변환 + 강제 빈 줄로 문단 분리** (EditorPreview.tsx:105·148, lib/locale.ts:64·140-143). 각 항목이 독립 `<p>`라서 항목 사이에 문단 마진이 들어감.
- **블록 타입 체계**: `text·heading·gana·roman·box·choices·image·svg·ggb` (types/problem.ts:157). gana/roman/box는 `BORDERED_TYPES`로 테두리 상자 렌더. 프리셋: gana `(a)\n(b)\n(c)`, roman `(i)\n(ii)\n(iii)` (EditorView.tsx:94-104).
- **렌더 사이트 5곳**: EditorView 미리보기(3138), ProblemView(325), FolderView(245), ProblemTabContent 공유뷰(38), PrintableContent(67). 전부 "특수 타입 분기 → BORDERED 래퍼 → 기본 markdown" 구조.
- **텍스트 행 `\tag{n}`**: 이미 지원 — 행 끝 `\tag{n}` → `<span class="tag-marker">(n)</span>` float:right (locale.ts:151-154, globals.css:271-277, PrintStyles.css:77-83).
- **blockquote(`>`)**: 인쇄에서 이미 `text-box`(테두리 상자)로 매핑됨 (PrintableContent.tsx:103, PrintStyles.css:52). 화면은 무스타일 — **기존 불일치 존재, 강조문 문법으로 재사용 불가**.

---

## 1. 공통 원칙

- 저장 원문(raw_text)은 절대 변경하지 않는다 — 전부 **표시 단계**(CSS·전처리·렌더 래퍼)에서 해결 (기존 locale 정책과 동일).
- 화면·인쇄 **양쪽 parity**: 화면 값(em)과 인쇄 값(pt)을 각각의 display 수식 기준에 맞춘다.
- 타입 키는 영문 소문자(기존 관례), 사용자 노출 명칭은 `BLOCK_TYPE_LABELS`로만.

---

## 2. P1 — 리스트 상하 여백

### 2.1 스펙

- **기준값 = display 수식과 동일**: 화면 **위 1em / 아래 1.8em** (현행 katex-display가 비대칭임을 그대로 따름), 인쇄 **위 8pt / 아래 14.4pt**.
- 항목 사이는 현행 유지(tight list는 행간만, 변경 없음).

### 2.2 구현 (CSS만)

```css
/* globals.css — 화면. D5: 콘텐츠 스코프 한정 (전역 ul/ol 규칙은 건드리지 않음) */
.preview-content ul, .preview-content ol {
  margin-top: 1em;
  margin-bottom: 1.8em;
}
/* 중첩 리스트는 제외 — 현행(0.4em) 유지 */
.preview-content li ul, .preview-content li ol {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}
```

```css
/* PrintStyles.css — 인쇄 parity */
.print-body ul, .print-body ol { margin: 8pt 0 14.4pt; }
.print-body li ul, .print-body li ol { margin: 4pt 0; }
```

- 좌측 마진/패딩(불릿 내어쓰기 체계)은 **현행 유지** — 이번 Phase는 상하 여백만.
- `.preview-content`는 EditorPreview 공용 클래스(EditorPreview.tsx:445)라 편집 미리보기·열람뷰·공유뷰가 EditorPreview를 경유하는 한 자동 커버 — 각 사이트 실제 경유 여부는 Stage 검증 항목.

### 2.3 마진 상쇄 판단 (검증 요청 2)

인접 `p`(UA 기본 margin 1em)와 리스트의 새 마진은 CSS 상쇄로 `max()` 적용 → 문단 뒤 리스트 위 간격 1em, 리스트 아래 다음 문단까지 1.8em. **display 수식의 현행 체감과 동일 방향**이므로 상쇄는 원하는 동작. 단 실렌더 확인 필요.

### 2.4 D1 — ①원문자 리스트 런 정규화 (기본안: 포함)

①리스트는 `<p>` 나열이라 위 CSS가 닿지 않는다. 연속 marker-circled 문단을 리스트 런으로 취급:

```css
/* 연속 ① 문단: 사이 간격은 행간만 (마진 제거) */
.preview-content p:has(.marker-circled) { margin-top: 0; margin-bottom: 0; }
/* 런의 시작: 앞 형제가 ①문단이 아닌 경우 */
.preview-content :not(p:has(.marker-circled)) + p:has(.marker-circled) { margin-top: 1em; }
.preview-content p:has(.marker-circled):first-child { margin-top: 1em; }
/* 런의 끝: 뒤 형제가 ①문단이 아닌 경우 — :has(+ …)로 판정 */
.preview-content p:has(.marker-circled):not(:has(+ p .marker-circled)) { margin-bottom: 1.8em; }
```

- 마지막 셀렉터의 `:has(+ p .marker-circled)` 정합(형제 결합자 + 자손)은 브라우저 실측 필요(검증 요청 5). 셀렉터가 불안하면 대안: 전처리에서 런의 첫/끝 span에 `marker-circled-first/-last` 클래스를 붙여 단순 클래스 타게팅 (전처리는 이미 행 단위 순회 구조라 추가 용이 — locale.ts convertCircledList).
- 인쇄에도 동일 규칙 필요(PrintStyles.css:104의 `p:has(.marker-circled)` 옆에 추가).
- (가)/(ㄱ.) marker 문단은 상자(gana/roman) 안에서 쓰이므로 **이번 정규화에서 제외** (현행 유지).

---

## 3. P2 — '목록' 블록 신설 + 명칭 재조정

### 3.1 왜 신규 타입인가 (대안 검토)

"텍스트 블록 + 내용 프리셋 삽입"만으로도 기능은 되지만, 블록 칩·타입 드롭다운에 '목록' 명칭이 남지 않아 요구(블록 명칭: 목록)에 미달. **gana/roman/box·heading 모두 "타입 + 프리셋" 패턴의 선례** → 같은 방식이 일관적.

### 3.2 구현

```
types/problem.ts:157        — type union에 'list' 추가
components/editor/EditorView.tsx
  BLOCK_TYPE_LABELS (76)    — list: '목록'  (+ 명칭 재조정 §3.4)
  BLOCK_TYPES (89)          — 드롭다운 노출 (위치: 'text' 다음 권장)
  BLOCK_PRESETS (94)        — list: "- \n- \n- \n\n① \n② \n③ "
  TEXT_BASED_TYPES (107)    — 추가 (CM 에디터 사용)
  SPLITTABLE_TYPES (112)    — 추가
```

- **렌더 수정 불필요**: 'list'는 BORDERED도 특수 타입도 아니므로 5개 렌더 사이트 전부 **기본 markdown 경로로 자동 낙하** (검증 요청 3). 테두리 없음 = 요구안과 일치.
- **프리셋 구성 근거**: unordered는 markdown `- `(기존 불릿 파이프라인), ordered는 **① 리터럴**(기존 marker-circled 파이프라인 + 선택지·수능 관례와 동일 문자). markdown `1.`(decimal ol)을 쓰지 않는 이유: 기존 정책이 원문자 리스트를 ① 리터럴로 확립(locale.ts:140-143, choices도 ①~⑤).
- 프리셋 안의 `- ` 빈 항목이 정상 렌더되는지(빈 li + 불릿) Stage 검증.
- 타입 변경 경로: text계열→list는 raw_text 유지(현행 text→gana와 동일 규칙, EditorView.tsx:1518 분기), 신규 추가 시에만 프리셋 적용 — 일관.
- Firestore: 신규 type 문자열 저장 — additive. 규칙·마이그레이션 불필요. 구버전 클라이언트가 'list'를 만나도 기본 경로 렌더로 안전.

### 3.3 P1과의 결합

'목록' 블록의 시인성은 P1 여백이 만든다 — P1 없이 P2만 하면 요구 1의 문제가 그대로 남으므로 **P1 → P2 순서 필수**.

### 3.4 명칭 재조정 (라벨만, 타입 키 불변)

| 타입 키 | 현행 라벨 | 변경 라벨 |
|---|---|---|
| `gana` | (가) (나) (다) | **(가), (나) 상자** |
| `roman` | ㄱ. ㄴ. ㄷ. | **ㄱ, ㄴ 상자** |
| `box` | 글상자 | **빈 글상자** |

- 수정 지점: `BLOCK_TYPE_LABELS`(76-86) + `EmptyBlockChips`의 하드코딩 라벨 `(가)(나)(다)`(EditorView.tsx:225) + 그 외 라벨 하드코딩 전수 grep (BlockBottomToolbar 추가 메뉴 등 — CLI 확인).
- 타입 키는 그대로 → **저장 데이터·VCS diff·공유 스냅샷 영향 0.**

---

## 4. P3 — '강조문' 블록

### 4.1 A안 (기본안) — 블록 신설

- 타입 키 `callout`(D3), 라벨 '강조문'. TEXT_BASED + SPLITTABLE + 프리셋 `''`. BLOCK_TYPES 드롭다운 노출.
- **렌더**: 5개 사이트에서 BORDERED와 같은 자리의 새 분기 — 래퍼 `<div class="callout-block">`(테두리 없음):

```css
/* 화면 (globals.css) */
.callout-block {
  margin: 1em 0 1.8em;      /* display 수식과 동일 상하 여백 */
  padding-left: 3em;         /* display 수식 들여쓰기(globals.css:186 .katex-display)와 동일 */
  /* 행간: 상속(1.8) = 기존 텍스트 블록 규칙 그대로 */
}
.callout-block p { margin: 0; }          /* 블록 안 여러 행은 행간만 */
/* 인쇄 (PrintStyles.css) */
.print-body .callout-block {
  margin: 8pt 0 14.4pt;
  padding-left: 2em;         /* 인쇄 display 수식 fleqn 들여쓰기(PrintStyles.css:24)와 동일 */
  break-inside: avoid;
}
```

- **`\tag{n}`**: 텍스트 행 끝 `\tag{n}` → tag-marker(float:right)가 **이미 동작** — 강조문 안에서도 추가 작업 없음. 요구 필요성 2(문장에 `\text{}` 없이 tag 달기)가 이것으로 충족. 우측 정렬 위치가 수식 `\tag`와 일치하는지 실측(검증 요청 4).
- 블록 상하 여백과 이웃 블록 간 기존 간격의 **중첩** 여부(블록 래퍼끼리는 마진 상쇄가 안 되는 구조일 수 있음 — 각 사이트의 블록 wrapper div 구조 확인) — CLI 검증 항목.

### 4.2 주의 — 강조문 안의 display 수식

강조문 안에 `$$…$$`를 쓰면 katex-display 자체 들여쓰기(3em)와 래퍼 padding이 **이중 적용**된다. 대응(택1, v2에서 확정):
- `.callout-block .katex-display { padding-left: 0 }` override (권장 — 어떤 내용이 와도 안전), 또는
- "강조문 안에는 인라인 수식 `$…$` 사용" 사용 규칙으로 명시.

### 4.3 A안의 한계 (정직한 기재)

요구 필요성 1의 시나리오 — "여러 줄 display 수식 중 가운데 한 행만 tag" — 에서 A안은 **텍스트 블록을 3개로 쪼개야 한다**(수식前 블록 / 강조문 블록 / 수식後 블록). 현행 불편("$$를 끊어야 한다")에 블록 분할이 더해지는 셈. 상하 여백이 display 수식과 동일하게 튜닝되므로 **보기에는** 자연스러워지지만, **쓰기의** 불편은 남는다.

### 4.4 B안 (대안) — 행 마커 문법

같은 텍스트 블록 안에서 행 시작 마커(예: `>> `)를 강조문으로 변환:

```
$$ a+b \\ c+d $$
>> $e+f=g$ \tag{1}
$$ h+i $$
```

- 전처리에서 `^>>\s` → `<span class="emph-line">…</span>` (marker-gana/circled/case-sub와 **동일한 기존 선례** — locale.ts·EditorPreview 양쪽 1곳씩).
- CSS는 A안과 동일 값 적용(`p:has(.emph-line)` 타게팅).
- 장점: **블록을 쪼개지 않는다** — 필요성 1을 쓰기 단계에서 해결. 전처리+CSS만으로 끝(렌더 사이트 5곳 수정 불필요).
- 단점: 새 문법 학습 필요, 블록 명칭·추가 메뉴 노출 없음(발견성↓ — 툴바 버튼으로 보완 가능), 저장 원문에 `>>` 마커가 남음(단 locale 정책상 원문 보존 원칙과는 부합 — ①·(a)도 원문에 리터럴로 남는 방식).
- **blockquote(`>`) 재사용은 불가**: 인쇄에서 이미 text-box(테두리)로 매핑됨(§0) — 충돌.

**권고**: A와 B는 배타가 아니다. v1은 **A안(블록)** 으로 요구를 그대로 충족하되(발견성·블록 인프라 활용), 필요성 1의 "수식 흐름 중간 한 줄 tag"가 실사용에서 잦으면 B안을 후속 Phase로 얹는다. D2에서 덕수 확정.

---

## 5. P4 — \tag 참조번호의 본문 글꼴·크기 표준화

### 5.1 배경·현행

- **덕수 결정**: `\tag{N}`은 앞으로 **수식 바깥(텍스트 행 끝)에서 쓰는 것을 표준**으로 한다.
- 현행 tag-marker(수식 밖 참조번호)는 오히려 **수식 쪽에 맞춰져** 있다: 화면 `font-family: KaTeX_Main serif; font-size: 14px 고정`(globals.css:271-277), 인쇄 `KaTeX_Main, 0.95em`(PrintStyles.css:77-83). 수식 안 \tag도 같은 값으로 고정(globals.css:283-304 — 당시 "수식 안·밖 크기 통일" 정책의 산물).

### 5.2 구현 (CSS만)

```css
/* 화면 (globals.css) — 참조번호 = 본문 글꼴·크기 */
.tag-marker {
  float: right;
  white-space: nowrap;
  margin-left: 2em;
  font-family: inherit;   /* 본문(--font-content = Pretendard) 상속 */
  font-size: inherit;     /* 본문 크기(--content-font-size) 상속 */
}
/* 인쇄 (PrintStyles.css) — 동일 원칙: 인쇄 본문(명조) 상속 */
.print-body .tag-marker { font-family: inherit; font-size: inherit; }
```

- **D6 = 통일(기본안)일 때**: 수식 안 \tag 번호(globals.css:295-304의 `.tag .text/.mord`)도 `font-family: var(--font-content)` + `font-size: var(--content-font-size)`로 교체(현행 14px 고정 자리를 CSS 변수로). 인쇄 쪽(PrintStyles.css:96-99)은 `var(--font-print)` + 1em. → 신·구 문서에서 참조번호 모양 단일화.
- P3 강조문과의 결합: 강조문의 행 끝 \tag는 tag-marker이므로 **자동으로 새 표준 적용** — 별도 작업 없음.
- `\ref{n}` 텍스트 치환(`(n)` 리터럴)은 이미 본문 글꼴 — 무변경. 이제 참조를 다는 쪽(tag)과 인용하는 쪽(ref)의 글꼴이 일치하게 됨(현행은 세리프 vs 산스로 불일치 — 이번 변경의 부수 개선).

### 5.3 주의

- 화면 본문 15px 기준으로 번호가 현행 14px 세리프 → 15px Pretendard로 커지고 글꼴이 바뀜 — 기존 문서의 시각 변화가 전 문항에 일괄 적용됨(의도된 변화이나 인지 필요).
- float:right 행의 라인 박스 높이 변화 실측(검증 요청 6).

---

## 6. P5 — 원문자 ①~⑮ 시인성 개선

### 6.1 질문에 대한 답 — "기본폰트에 고정된 것인가?"

**아니다.** ①~⑮는 유니코드 문자(U+2460~)이고, 폰트 스택 `--font-ui`(Pretendard Variable → 시스템 폰트, globals.css:75)에서 **해당 글리프를 가진 첫 폰트가 그린다**. 작아 보이는 이유는 폰트 문제라기보다 원문자 글리프의 구조 — "원 + 숫자"를 한 글자 박스에 넣느라 **숫자가 본문 숫자보다 훨씬 작게 디자인**되기 때문. 따라서 (a) 해당 코드포인트만 다른 폰트로 매핑하거나, (b) 크기를 보정하거나, (c) 글리프를 쓰지 않고 합성하는 방법 전부 가능하다.

### 6.2 방안 비교

| 방안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **O1** | `@font-face` + `unicode-range: U+2460-2473`로 원문자 코드포인트만 별도 폰트에 매핑, `--font-ui`/`--font-print` 스택 맨 앞에 추가 | 마크업 무변경 — 행 중간·선택지·편집창까지 전부 자동 적용 | "더 큰 원문자를 가진 폰트"를 찾아야 하는데 대부분의 폰트가 같은 구조적 한계를 공유 → 개선 폭 불확실. 웹폰트 1종 추가 |
| **O2** | `.marker-circled`·선택지 라벨에 `font-size: 1.15~1.25em` 보정 | 1~2줄, 즉시 | 원과 숫자가 같이 커져 **원이 행간을 침범**할 수 있음. span 밖(행 중간 ①)은 미적용. 근본 해결 아님 |
| **O3 (권장)** | **합성 원문자**: 전처리에서 ①→`<span class="num-circle">1</span>`, CSS로 원(테두리)+숫자 렌더 | **숫자가 본문 글꼴 숫자 그대로** → "크기가 글자 크기와 일치·조화" 요구에 정확히 부합. 크기·굵기·원 두께 전부 제어 가능. 화면·인쇄 동일 원리 | 전처리 1곳×2(화면·인쇄)+CSS. 원 지름·수직정렬 튜닝 필요. 편집창(CM)은 원문 ① 유지(기존 locale 정책과 동일 — 편집창은 원문, 미리보기는 변환) |

### 6.3 O3 상세 (기본안)

```css
/* 화면 (globals.css) */
.num-circle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.3em; height: 1.3em;                  /* 원 지름 — 실측 튜닝 (행간 1.8 내 수용) */
  border: 0.075em solid currentColor; border-radius: 50%;
  font-size: 0.85em;                             /* 숫자 크기 — 본문 대비 비율, 실측 튜닝 */
  line-height: 1; vertical-align: -0.2em;        /* baseline 보정 — 실측 튜닝 */
  font-variant-numeric: tabular-nums;
}
```

- **변환 지점**: 화면 EditorPreview.tsx(147-149 convertCircled 자리)·인쇄 lib/locale.ts(140-143 convertCircledList) — 기존 marker-circled span **안쪽**에 num-circle을 중첩(`<span class="marker-circled"><span class="num-circle">1</span></span>`)하면 내어쓰기 체계(globals 257-268, PrintStyles 103-104)는 무변경으로 유지된다.
- **적용 범위 결정 필요(검증 요청 7)**: ① **행 시작**(marker)과 **선택지 라벨**(ChoicesBlock.tsx:35 부근·PrintChoicesBlock의 `print-choice-label` — 라벨 문자열을 num-circle 마크업으로 교체)은 확실 대상. ② **행 중간 ①**(본문 인용 "①과 ②에서…")까지 포함하려면 수식 보호 후 전역 치환 필요 — 포함 권장(모양 통일), 단 리스크 실측.
- 원문자 ⑯~⑮ 범위: 현행 파이프라인이 ①~⑮(EditorPreview.tsx:105 문자 클래스)이므로 동일 범위. 선택지는 ①~⑤.
- **`\ref`·`\tag`와 무관** — 참조번호는 ㉠계열(㉠㉡㉢)이 아니라 `(n)` 숫자 표기라 충돌 없음.

### 6.4 O3와 P4의 조화

P4(참조번호=본문 글꼴)와 O3(원문자 숫자=본문 글꼴)를 함께 적용하면, 본문에 등장하는 모든 번호 체계(참조번호·원문자·선택지 라벨)가 **본문 글꼴 하나로 통일**된다 — "다른 글자들과의 조화" 요구의 완결.

---

## 7. 엣지 케이스 / 기존 기능과의 상호작용

- **Undo/Redo (Phase 55a)**: 신규 타입의 추가·타입 변경·삭제는 기존 push 배선(handleAddBlock·handleBlockTypeChange 등)을 그대로 타므로 자동으로 undo 대상. 추가 작업 없음.
- **정형화(toPersistedBlock)**: 신규 타입도 text 계열이라 기존 정형화(빈 줄 트림 등) 그대로 통과 — 특례 불필요. 단 '목록' 프리셋의 앞뒤 구조가 트림에 깎이지 않는지 확인(내부 빈 줄은 유지됨).
- **VCS diff**: type 필드 변경으로 기록 — 기존 체계 그대로.
- **공유/비로그인 열람(SnapshotView·ProblemTabContent)**: 'list'는 기본 경로라 무수정, 'callout'(A안)은 래퍼 분기 추가 필요 — 5개 사이트 목록에 포함됨.
- **선택지 내부 중첩 EditorPreview**(choices-grid): `.choices-grid .preview-content p { margin: 0 }` 규칙(globals.css:335)이 이미 있어 P1의 p 마진 변경과 충돌 없음 — 리스트 여백 규칙이 선택지 셀 안에서 오작동하지 않는지 확인.
- **`.cm-editor` 편집창**: 이번 Phase는 미리보기·인쇄 전용 — 편집창(CodeMirror) 표시는 무변경.
- **글꼴 크기 스케일**: 여백이 em 단위라 `--content-font-size` 스케일에 자동 동행. P4·P5도 상속/em 기반이라 동일.
- **P5 ↔ 선택지 편집**: 선택지 파싱(EditorView.tsx:574·PrintableContent.tsx:115)은 **raw_text의 ① 리터럴 기준** — O3는 표시 단계 변환이라 파싱 무영향. 단 ChoicesBlock 셀 안 중첩 EditorPreview를 다시 거치는 경우 이중 변환이 없는지 확인.
- **P5 ↔ 편집창**: CM 편집창은 원문 ① 그대로 표시(변환은 미리보기·인쇄만) — 기존 locale 정책과 동일하므로 혼란 없음.
- **P4 ↔ VCS diff·저장**: 표시 전용 CSS 변경이라 raw_text·해시 무영향.

---

## 8. 파일/모듈 (제안)

```
# P1 (CSS만)
app/globals.css                     — .preview-content ul/ol 상하 여백 + D1(①런 정규화)
components/print/PrintStyles.css    — .print-body ul/ol 인쇄 parity + D1

# P2
types/problem.ts                    — 'list' 추가 (157)
components/editor/EditorView.tsx    — 상수 5곳(76-114) + EmptyBlockChips 라벨(225) + 라벨 재조정

# P3 (A안 기준)
types/problem.ts                    — 'callout' 추가
components/editor/EditorView.tsx    — 상수 5곳 + 미리보기 분기(3138 부근)
components/problem/ProblemView.tsx  — 분기 (325 부근)
components/problem/FolderView.tsx   — 분기 (245 부근)
components/share/ProblemTabContent.tsx — 분기 (38 부근)
components/print/PrintableContent.tsx  — 분기 (67 부근)
app/globals.css / PrintStyles.css   — .callout-block 스타일

# P4 (CSS만)
app/globals.css                     — .tag-marker 본문 상속(271-277) + D6 시 수식 안 .tag(295-304)
components/print/PrintStyles.css    — .tag-marker(77-83) + D6 시 .tag .text(96-99)

# P5 (O3 기준)
components/editor/EditorPreview.tsx — convertCircled 자리(147-149)에 num-circle 중첩
lib/locale.ts                       — convertCircledList(140-143) 동일 변경 (화면·인쇄 반드시 일치)
components/editor/ChoicesBlock.tsx  — 선택지 라벨 num-circle 교체
components/print/PrintableContent.tsx — PrintChoicesBlock 라벨 동일
app/globals.css / PrintStyles.css   — .num-circle 스타일
```

- **규칙 변경 없음, Firestore 변경 없음** — 순수 클라이언트. 배포 순서 제약 없음.

---

## 9. 구현 순서 (제안)

**Stage 1 · P1 리스트 여백 (CSS)**
- 화면 + 인쇄 + D1(①런). 검증: 문단→ul→문단, 문단→①①①→문단, 중첩 리스트, display 수식과 나란히 놓고 간격 육안 비교, 선택지 셀 내부 무영향, 앱 UI(사이드바 등) 리스트 무영향(D5 스코프 확인).

**Stage 2 · P2 목록 블록 + 명칭 재조정**
- 타입·프리셋·라벨. 검증: 추가 → 프리셋 6줄 렌더(불릿 3 + ① 3, 각각 P1 여백 적용), 줄 삭제/추가 편집, 타입 드롭다운 라벨 3종 변경 확인, 저장→재로드→인쇄, undo로 블록 추가 되돌리기.

**Stage 3 · P3 강조문 (D2=A안 가정)**
- 타입 + 5개 사이트 분기 + CSS. 검증: 행간(텍스트와 동일)·상하 여백·들여쓰기(display 수식과 나란히 비교), `\tag{n}` 우측 정렬이 수식 \tag와 일치, 강조문 안 display 수식 이중 들여쓰기 대응(§4.2), 인쇄 parity, 공유뷰.

**Stage 4 · P4 \tag 표준화 + P5 원문자 (D6·D7 확정 후)**
- P4: tag-marker 상속 전환(+D6 시 수식 안 통일). 검증: 텍스트 행 tag·수식 안 tag·\ref 인용을 한 화면에 놓고 글꼴·크기 일치, float 행 높이 무변화, 인쇄 명조 상속.
- P5(O3): num-circle 변환+CSS. 검증: 본문 숫자와 크기 일치 육안 비교, 행간 침범 없음, 선택지 그리드(3/5등분)·행 중간 ①·인쇄 2단, 편집창은 원문 유지.

**Stage 5 · 통합 검증**
- 다섯 기능이 한 문서에 공존하는 실전 문항으로 화면·인쇄 비교(특히 §6.4 번호 체계 통일 확인). roadmap.md 갱신.

---

## 부록 A. 현재 코드 사실관계 (`8da5c42` 실측 — CLI 재검증 요청)

**A-1. 블록 타입.** union: `'text'|'heading'|'math_block'|'bullet'|'gana'|'roman'|'box'|'choices'|'image'|'svg'|'ggb'` (types/problem.ts:157). `math_block`·`bullet`은 레거시 → text 정규화(EditorView.tsx:117-120). 상수: BLOCK_TYPE_LABELS(76-86)·BLOCK_TYPES(89-91, 드롭다운 노출은 7종)·BLOCK_PRESETS(94-104)·TEXT_BASED_TYPES(107-109)·SPLITTABLE_TYPES(112-114)·BORDERED_TYPES(123, gana/roman/box).

**A-2. 렌더 사이트 5곳 + 분기 구조.** EditorView 미리보기(3138 `isBordered`), ProblemView(325), FolderView(245), ProblemTabContent(38), PrintableContent(67 `BORDERED_TYPES_PRINT`). 공통 패턴: choices/image/svg/ggb 특수 분기 → BORDERED 래퍼 → **기본 markdown 렌더 낙하**.

**A-3. 리스트 CSS (전역 스코프 주의).** globals.css: ul(206-210, margin 0.4em 0 0.4em 1em, 커스텀 불릿 211-220), ol(240-244, margin 0.4em 0). **스코프 없는 전역 규칙** — 신규 여백은 콘텐츠 스코프 한정 필요(D5). 인쇄: PrintStyles.css ul/ol(53-58, margin 4pt).

**A-4. display 수식 간격·들여쓰기.** 화면: `.preview-content .katex-display { margin-top:1em; margin-bottom:1.8em }` (EditorPreview.tsx:441-444 inline style), `.katex-display { padding-left: 3em }` (globals.css:185-187). 인쇄: `margin: 8pt 0 14.4pt` (PrintStyles.css:65), fleqn `padding-left: 2em` (PrintStyles.css:24).

**A-5. ①원문자 파이프라인.** 행 시작 ①~⑮ → 강제 빈 줄(독립 p 보장) + `<span class="marker-circled">` — 화면(EditorPreview.tsx:105·147-149)·인쇄(lib/locale.ts:64·140-143) 양쪽 존재. CSS: 내어쓰기 globals.css:257-268, 인쇄 PrintStyles.css:103-104. **p 마진 정규화는 없음** → D1 대상.

**A-6. 텍스트 행 \tag.** `\tag{n}$` 행 끝 → `<span class="tag-marker">(n)</span>` (EditorPreview.tsx:160-162, locale.ts:151-154). 스타일 float:right (globals.css:271-277, PrintStyles.css:77-83). 수식 내 \tag는 `\tag*{(n)}` (preprocessMath).

**A-7. blockquote 선점.** 인쇄에서 `blockquote → <div class="text-box">`(PrintableContent.tsx:103) + 테두리(PrintStyles.css:52). 화면은 text-align만(globals.css:308-314) — 화면·인쇄 불일치 상태로 존재. **강조문 문법으로 재사용 금지.**

**A-8. 프리셋 적용 규칙.** 신규 블록 추가 시 BLOCK_PRESETS 적용(handleAddBlock 1554). 타입 변경 시엔 비텍스트→텍스트 계열 전환에만 프리셋 적용(1518 분기) — text↔gana 등 텍스트 계열 간 전환은 raw_text 유지.

**A-9. 선택지.** choices는 ①~⑤ 리터럴 파싱(PrintableContent.tsx:115) — '목록' ordered 파트가 ① 리터럴을 쓰는 것과 문자 체계 일치.

**A-10. Phase 55a 공존.** 블록 추가·타입 변경·삭제 핸들러에 pushUndo 배선 완료(오늘 병합) — 신규 타입 자동 커버.

**A-11. [P4] 참조번호 글꼴 현행.** 수식 밖 tag-marker: 화면 `KaTeX_Main serif, 14px 고정`(globals.css:271-277), 인쇄 `KaTeX_Main, 0.95em`(PrintStyles.css:77-83). 수식 안 \tag 번호: `KaTeX_Main !important` + `14px !important`(globals.css:283-304 — .text/.mord까지 못박아 katex 1.15배 스케일 차단), 인쇄(PrintStyles.css:86-99). 본문 글꼴: 화면 `--font-content = --font-ui = Pretendard`(globals.css:75-77), 인쇄 `--font-print = Noto Serif KR`(globals.css:79).

**A-12. [P5] 원문자 파이프라인 전체 지점.** 원문자는 폰트 스택 글리프로 렌더(전용 스타일 없음 — marker-circled는 내어쓰기·bold만). 등장 지점: ① 행 시작 marker(EditorPreview.tsx:147-149, locale.ts:140-143), ② 선택지 라벨(화면 ChoicesBlock.tsx:14·35, 인쇄 PrintableContent.tsx:115-131 `print-choice-label`), ③ 행 중간 리터럴(변환 없음 — 폰트 글리프 그대로), ④ 편집창 CM(원문 그대로), ⑤ 툴바 특수문자 입력(UnifiedToolbar.tsx:210). 파싱 의존: 선택지 파싱이 raw_text의 ① 리터럴 기준(EditorView.tsx:125·574) — 표시 단계 변환은 무영향.

## 부록 B. 로드맵 메모

P1↔P2는 순서 의존(P1 선행). P3·P4·P5는 상호 독립 — 결정(D2·D6·D7)에 따라 분리 배포 가능. 다섯 항목 모두 순수 클라이언트(규칙·Firestore 변경 없음).
