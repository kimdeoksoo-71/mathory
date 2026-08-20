# Phase 59a — Case 블록 레이아웃 체계 수정 · 강조 체계 정비 (구현 계획서 v3)

작성일: 2026-08-20 · 기준 커밋 **`fdeac85`** (main = origin) · 작성: web(레포 클론 재검증)
문서 계보: v1(web, 방향·구조) → v2(CLI, 실측 정정 C1~C17) → **v3(web, v2 전수 재검증)**

> **v3의 성격**: v2의 정정 C1~C17·결정 Q5~Q7을 레포에 대고 **전건 재검증**했다. 결과:
> **15건 승인 · 2건 정정**(F1·F2) · 산술 보정 1건(F5) · 미세 보완 2건(F3·F6).
>
> **가장 중요한 것은 F1이다 — v2 C6의 특이도 처방(`.solution-tone.solution-tone .katex`)을
> 그대로 구현하면 `**` 안의 수식과 제목 안의 수식이 dim으로 죽고, 인쇄 복원이 파일 순서
> 의존이 된다.** C6의 특이도 표가 "승격을 적용하기 전" 기준으로 계산돼, 자기 처방이 다른
> 규칙에 미치는 파급을 놓쳤다. v3는 승격 방향을 반대로 바꾼다(§3-3) — 기준선 쪽을 `:where()`로
> 한 단 낮추면 나머지 전 규칙이 **손대지 않고, 순서 무관하게** 이긴다.
>
> **미결 항목 0 유지** — Q1~Q4(v1) · Q5~Q7(v2, 덕수 확정) 전부 유효. **이 문서는 v2를 대체하는
> 착수본이다.** v2와 어긋나는 곳은 §0의 F 번호가 근거다.

---

## 0. v2 검증 결과

### 0-1. 판정 총괄

| v2 항목 | 판정 | 비고 |
|---|---|---|
| C1 (구속 배경 `#E8DFCE`) | **승인** | `--block-bg-active: #E8DFCE`(globals.css:75) · FolderView 카드 소비(:505) 실측. 명암비 표 **전 수치 재검산 일치**(3.28 / 4.76 / 5.50 / 3.81 / 4.05 / 5.55 / 5.95) |
| C2 (`--tone-dim` 기정의 · 낙차 표) | **승인** | :138 실측. `--text-secondary #5D5647`(:91) 확인 |
| C3 (FolderView 잘림 주체 = 내부 div) | **승인** | :581-583 `overflow:'hidden'`+패딩 0 실측 |
| C4 (채널 56px = 의도된 값) | **승인, 산술은 F5로 보정** | `83c8f47` 커밋·주석(:3337-3344) 실측 |
| C5 (v1 좌표쌍 11px 겹침) | **승인** | 산술 독립 재계산 — 11px에서 -0.1px 겹침 재현. 정정 좌표(-1.8/-0.7)도 재계산 일치 |
| C6 (특이도 전수표) | **⚠ 정정 — F1** | "위험은 한 줄뿐" 진단은 맞지만 **처방이 새 결함 3군을 만든다** |
| C7 (`toneClass` 호출부 4곳) | **승인** | grep 전수: 정확히 4곳 + `isToneScoped` 단독 2곳. **keyTone의 다른 소비처 없음**(MarkdownEditor의 강조 토글은 keyTone 미사용 — 삭제 안전) |
| C8 (테스트 필수 개정) | **승인** | :11 import · :144·:150 전용 테스트 · :182·:191·:213·:239 keys 단언 전부 실측 일치 |
| C9 (삭제 파급 확대) | **승인** | |
| C10 (게이트 축소 + disabled 툴팁) | **승인** | OutlineToggle:34-38 실측 |
| C11 (이어짓기 요약 손실 수용 + 우회로) | **승인** | |
| C12 (v1 파일 좌표 정정 5건) | **4건 승인 · 1건 철회 — F2** | |
| C13 (공유 2단 무작업) | **승인** | 양 분기 모두 `ContentCard`(:77-84) · `fontSize: 15` 고정(:133) · overflow 없음 실측. 현행 36px 패딩에 dot 좌단 30.9px — "잘리진 않으나 여유 3px" 재계산 일치 |
| C14 (코칭 바 = 글상자 규약) | **승인** | |
| C15 (코칭 배선 실측 표) | **승인** | EmptyBlockChips 3칩 고정(:179-185) · exportMd `<!-- block: ${type} -->`(:75) · BORDERED 사본 4개 실측 |
| C16 (인쇄 침범 5.01mm) | **승인** | 인쇄 dot 0.44em(PrintStyles:195) 실측 — dot 반경 포함 재계산 일치 |
| C17 (히트 영역 토큰화 금지 · hover 전폭화) | **승인** | :707-708 실측 |
| Q5·Q6·Q7 (덕수 확정) | **유지** | Q5의 전제(`className="problem-card"` 실존)를 FolderView:503에서 실측 — **CSS 3줄만으로 성립, FolderView.tsx 무변경 확정** |
| 부록 C (별건 4건) | **승인** | C-1 페이드 하드코딩 `rgba(237,230,218,0)`(:590) + stale 주석 실측 |

### 0-2. F1 ★ — C6의 처방은 그대로 구현하면 안 된다 (v2 유일의 실결함)

C6은 `.has-key` 삭제 후 `.solution-tone .katex`(0,2,0)가 `.tone-baseline .katex`(0,2,0)와
동률이 되는 문제를 `.solution-tone.solution-tone .katex`(0,3,0) 승격으로 풀었다. 그러나
**dim 규칙을 (0,3,0)으로 올리는 순간, 그 규칙을 이겨야 하는 katex 복귀 규칙들이 진다**:

| 이겨야 하는 규칙 | 특이도 | vs dim (0,3,0) | 증상 |
|---|---|---|---|
| `.solution-tone strong .katex` | (0,2,1) | **패배** | **`**` 안 수식이 dim** — 강조 기능의 핵심이 죽는다 |
| `.solution-tone h1/h2/h3 .katex` | (0,2,1) | **패배** | **제목 안 수식이 dim** — Phase 58 D9′ 가드 붕괴 |
| 인쇄 복원 `.print-body .solution-tone .katex` | (0,3,0) | **동률** | globals ↔ PrintStyles **파일 간 순서 의존** — Next CSS 주입 순서에 목숨을 건다 |
| 케이스 제목행 가드 `… p:has(…) .katex` | (0,5,1) | 승리 | 유일하게 무사 |

(비교 규칙: 특이도는 (a,b,c)에서 b(클래스 수)를 먼저 비교한다 — (0,2,1)의 c=1은 b 열세를
만회하지 못한다. C6의 표는 이 비교를 "승격 전" dim (0,2,0) 기준으로만 수행했다.)

**v3 채택 — 승격 방향을 뒤집는다: 기준선을 한 단 낮춘다.**

```css
/* Phase 58 기준선(globals.css:262) — 한 곳만 수정 */
.tone-baseline :where(.katex) { color: var(--text-primary); }   /* (0,2,0) → (0,1,0) */
```

`:where()`는 특이도 0이라 이 규칙이 (0,1,0)로 내려간다. 그러면:

- dim `.solution-tone .katex`(0,2,0)가 **순서 무관하게** 기준선을 이긴다 — doubling 불필요.
- 복귀 규칙 전부(strong (0,2,1) · h1~h3 (0,2,1) · 케이스 가드 (0,5,1) · 인쇄 (0,3,0))가
  dim (0,2,0)을 **현행 코드 그대로, 순서 무관하게** 이긴다. **`.has-key` 삭제 외에 아무것도 안 바꾼다.**
- 문제 탭(공유 포함): `.tone-baseline :where(.katex)` (0,1,0)와 경합하는 katex 색 규칙이 없어
  (katex.min.css는 color를 선언하지 않는다) 동작 불변.
- :262의 주석("수식 색을 바꾸려면 특이도로 이겨야 한다")을 ":where로 낮춰 두었다 —
  .katex를 직접 겨냥한 (0,2,0) 이상이면 이긴다"로 갱신.

**잔여 순서 의존 1건(승인)**: 글자 색 `.solution-tone`(0,1,0) vs `.tone-baseline`(0,1,0)은
TabBody·ProblemTabContent에서 같은 요소에 붙어 동률이다 — **같은 파일 안** 소스 순서(톤 절이
기준선 절 뒤)로 해소되며, 어긋나도 secondary(#5D5647)↔dim(#675F52)의 미차라 치명적이지 않다.
두 절에 "순서를 바꾸지 말 것" ⚠ 주석을 상호 참조로 단다. (katex처럼 primary↔dim의 큰 낙차만
순서 의존에서 완전히 빼는 것이 이 설계의 요점이다.)

### 0-3. F2 — C12의 5번째 "정정"은 사실이 아니다

v1 §5는 처음부터 `사용 가이드 — 강조와 톤.md`(올바른 파일명)로 썼다. v2가 v1을 잘못 인용해
있지도 않은 오류를 정정했다. 실해 없음 — C12의 나머지 4건(ContentCard 위치 · ScrollColumn ·
OutlineToggle 34-38 · case 절 561-759)은 재확인 결과 전부 타당.

### 0-4. F3 — PrintStyles 삭제 좌표 미세 정정 (실측)

`padding-left: 2em`은 **:163**, `.case-sub`는 **:167**, `.case-gap`은 :168,
`.case-gap-body` 3규칙은 **:170-173**, `> ul/ol`·① `!important`는 **:207-211**
(v2 기재 169·170·172-174와 ±2행). 실행 지장 없는 수준이나 §5에 실측값으로 반영.
아울러 확인: **인쇄 case 절에 `.katex-display.fleqn` override가 없다**(§11-2에서 이미
"override를 두지 않는다"로 구현됨, :203-205 주석 실측) — 들여쓰기 철거 후에도 경우 안
display 수식은 `@media print`의 fleqn 2em(:24)을 그대로 받아 **최상위와 동일**해진다. 추가 조치 0.

### 0-5. F5 — Q3/C4의 산술 자기모순 보정

C4는 "같은 체감 = 56px + 거터 폭"이라 해놓고 Q3에서 `paddingLeft: 3.5em`을 채택했는데,
3.5em@15px로는 띠→본문 = 24 + 52.5 = **76.5px = 56 + 20.5**이지 56 + 거터(33px) = 89px가 아니다.
실제 의미 있는 수치는:

- 띠 → **rail(dot 좌단)** 빈 공간 = 24px + 3.5em − 2.06em = **45.6px@15** — Phase 45a 이전
  채널(48px)과 근사. rail은 1px 헤어라인·dot 0.52em이라 시각 질량이 작아, "띠→첫 잉크"
  기준으로는 이 값이 체감 채널이다.
- 띠 → 본문 첫 글자 = 76.5px@15 (현행 56px보다 20.5px 넓어짐).

→ **착수값 3.5em은 유지한다**(Q3 확정 불변). 다만 근거를 위 실측 산술로 교체하고,
Stage 1 판정 폭을 3.5~**4.5**em으로 넓힌다("56+거터"를 문자 그대로 원하면 4.3em이다).

### 0-6. F6 — chevron 정렬이 성립하려면 base 클래스에 1줄이 더 필요하다

C5의 "제목 줄 무변경으로 두 chevron이 같은 x" 주장은 **컨테이너 중심** 기준으로만 참이다.
`.outline-chevron`은 `inline-flex`에 `justify-content` 미지정(기본 start)이라, 폭 1em 컨테이너
안에서 0.8em glyph가 **왼쪽으로 붙는다** — 제목 줄 glyph 중심은 -0.7em이 아니라 -0.8em이 된다.

→ `.outline-chevron`(base, :752-758)에 **`justify-content: center` 1줄 추가**. 이러면 제목 줄
glyph 중심 = -1.2em + 0.5em = **-0.7em**, 경우 줄과 픽셀 정렬. (부수 효과: svg 0.8em화로
11px 글꼴에서 chevron이 12px→8.8px로 줄어든다 — C5의 겹침 원인 제거와 같은 방향이라 수용.)

### 0-7. Phase 59 잔여 부채 진단(v1 R1~R8, v2 §0-B)

이중 확인 종료 — **전건 사실, 본 계획에 반영 완료.** 이하 본문에서 개별 재인용하지 않는다.

---

## 1. Case 블록 레이아웃 체계 수정 (구상 1)

### 1-1. 기조 (v1·v2 유지)

rail·dot·chevron을 **본문 영역 왼쪽 바깥(거터)** 으로 내보내고, rail 때문에 신설한 2단
들여쓰기 체계를 전면 철거한다. 경우·하위 경우 본문의 좌단 = **일반 텍스트와 동일한 0**.
경우 안의 display 수식·리스트·① 밭은 **최상위 규칙을 그대로 승계**하므로 override가 전부
사라진다(화면·인쇄 공통 — §0-4).

### 1-2. 좌표 (확정 — C5 + F6)

x = 0 이 본문 좌단.

```css
:root {
  --case-rail-x:    -1.8em;   /* rail·dot 중심선 */
  --case-chevron-x: -0.7em;   /* 요약 보기 chevron 중심 — 제목 줄 현행 glyph 중심과 동일 (F6 적용 후) */
}
```

| 대상 | 좌표 | 산출 근거 |
|---|---|---|
| rail · dot (경우·하위 공통) | **-1.8em** | dot 우단 -1.54em ↔ chevron 좌단 -1.2em, 여유 0.34em이 전 글꼴에서 비례 유지 |
| 경우 줄 chevron | 중심 **-0.7em** (폭 1em → 좌단 -1.2em) | 제목 줄과 픽셀 정렬 (F6) |
| 제목 줄 chevron | **마진 3값 무변경** + base 1줄(F6) | 현행 컨테이너 중심이 이미 -0.7em |
| 경우·하위 경우 본문/제목행 | **0** | `padding-left` 삭제 |
| 개재 블록(case-gap) | **0** | `.case-gap-body` 철거 |
| 경우 안 수식·리스트·① 밭 | 최상위 규칙 승계 | override 전량 삭제 (인쇄 포함 — §0-4) |
| 인쇄 rail | **-1.2em** (=12pt ≈ 4.23mm) | 단 간격 10mm, dot 반경 포함 침범 5.01mm → 잔여 4.99mm (C16) |

**필요 거터 폭 = 2.06em(dot 좌단), 실사용 2.2em** → 33px@15 · 24px@11 · 53px@24.

**chevron em화 (필수 — C5·F6)**:

```css
.outline-chevron { justify-content: center; }             /* base(:752-758)에 1줄 — F6 */
.outline-chevron svg { width: 0.8em; height: 0.8em; }     /* size={12} 고정 px 무력화 */
.case-head .outline-chevron {
  width: 1em;                                             /* left를 '중심' 기준으로 다루기 위해 */
  left: calc(var(--case-chevron-x) - 0.5em);
  /* top: 0.9em · translateY(-50%) · aria-expanded 회전 규칙은 현행 유지 */
}
```

하위 경우의 시각 구분은 **dot 크기(0.52/0.3em) + 라벨(C1/C1a)** — Q1 확정, Stage 1 판정.

### 1-3. CSS 변경 (globals.css 561-759 · PrintStyles.css 153-211)

**유지**: rail 조각·위 브리징·종단 기하(1.5em 규칙 3종 / 인쇄 14pt), 불투명 `--case-rail`,
dot 상태 문법(D19 채움/테두리 + `--case-dot-fill`), `--case-ring`, `case-cont`, 라벨·제목행 굵기,
케이스 톤 가드(§3-3 — `.has-key`만 제거), `.case-gap` rail 관통, `margin-left:-0.5px` 헤어라인
보정, **G7(상하 padding 금지)**.

**치환**: 모든 `left: 1em` → `left: var(--case-rail-x)` (인쇄는 `0.7em` → `-1.2em` 리터럴).

**삭제** (부록 B 총목록, 좌표는 실측 — F3):

```
globals.css   .case-block{padding-left:3em}(570) · .case-sub{6em}(573)
              .case-gap-body 3규칙 (579-583)
              .case-block .preview-content > ul/ol{margin-left:3em} (664-665)
              .case-block .preview-content p:has(.marker-circled){…!important} (666)
              .outline-keys 절 전체 (681-690)          ← §3-2로 소비처 소멸
PrintStyles   .case-block{padding-left:2em}(163) · .case-sub{4em}(167)
              .case-gap-body 3규칙 (170-173)
              .case-block > ul/ol · > p:has(.marker-circled){…!important} (207-211)
lib/caseBlock caseGapClassName → 상수 'case-gap' 반환 (GAP_MEDIA_TYPES 소멸)
```

### 1-4. 여백 확보 (사이트별 — C3·C4·C13·F5)

| 사이트 | 현행 | 조치 |
|---|---|---|
| **ProblemView** (TabBody) | 라벨 열 `7 * contentFontSize` + `LABEL_GAP = 28`(px 고정) | **`LABEL_GAP = 2.8 * contentFontSize`로 비례화 — Q6 확정.** dot 좌단(-2.06em)과 라벨 열 사이 0.74em이 전 글꼴에서 유지. ⚠ 문제 탭 카드의 `marginLeft: -24`(px)는 11px 글꼴에서도 gap(30.8px) 안에 든다 — 실측만 |
| **EditorView 미리보기** | `marginLeft: 24` + `padding:'20px 32px'` + `width: calc(35em + 64px)` | `marginLeft: 24` **유지** · `padding: '20px 32px 20px 3.5em'` · `width: calc(38.5em + 32px)`. **산술(F5)**: 띠→rail 빈 공간 45.6px@15(≈ Phase 45a 이전 채널 48px) · 띠→본문 76.5px(= 56 + 20.5). 우측 패딩 32px·측정폭 35em 보존. Stage 1 판정 폭 3.5~4.5em |
| **공유 (1단·2단 공용)** | ContentCard `padding:'32px 36px'` · `maxWidth: calc(35em + 72px)` | 좌측 **40px** · `maxWidth: calc(35em + 76px)`. **2단 별도 조치 없음(C13)** — 양 분기가 같은 ContentCard, fontSize 15 고정이라 em/px 혼합 위험도 없음 |
| **FolderView 카드** | 카드 `18px 22px`+hidden, 내부 div hidden·패딩 0 | **rail·dot 미표시 — Q5 확정.** globals case 절 말미에 `.problem-card .case-block::before, .problem-card .case-gap::before, .problem-card .case-block::after { content: none; }` 3줄. `className="problem-card"` 실존(:503) → **FolderView.tsx 무변경**. 라벨(`C1.`)은 텍스트라 남는다 |
| **인쇄** | `padding-left: 2em` | §1-2 · C16. 좌측 단 rail은 페이지 여백(20mm) 쪽 |

⚠ **TabBody 문제 탭**(클레이 카드 `padding:'20px 24px'`+`marginLeft:-24`, :215-222): 경우 블록이
문제 탭에 놓이면 rail이 카드 배경 밖에 그려진다. 요약 보기는 풀이 전용이라 접힘 dot·
`--case-dot-fill` 불일치는 없다 — 미관만 Stage 1 판정.

### 1-5. 회귀 확인

- **F1(Phase 59) 형제 인접성**: 래퍼 규약(D15′) 무변경. 5사이트 `.case-block + .case-block` 매칭 재확인.
- **margin-left 금지**(§11-6): 새 좌표는 전부 `left`(절대배치)·`padding`으로만.
- **브리지 1.5em / 14pt 유효** — 블록 마진 무변경. padding 제거가 부모-자식 마진 collapse에
  영향을 주지 않는지(G7 역방향) 이음매 0.0px 재확인.
- `.outline-keys` 소멸에 따라 OutlineSections의 `firstCase`/`lastCase` gap 부착 로직 삭제.
- `.case-head` hover가 본문 전폭을 덮게 되는 변화(C17) — Stage 1 판정.

---

## 2. 명칭 변경 (구상 2 — v2 승인 그대로)

| 항목 | 현행 | 변경 | 범위 |
|---|---|---|---|
| callout 블록 | '강조문' | **'들여쓰기'** | UI 라벨만. 타입 id `callout` · `.callout-block` · DB 불변 |
| box 블록 | '빈 글상자' | **'글상자'** | 동일 |

코드 좌표: `BLOCK_TYPE_LABELS`(EditorView:86·:93) 한 곳이 드롭다운·상단바·전체접기 바에 공급.
CSS 주석(globals:546-548 · PrintStyles:143 근처)과 keyTone·solutionOutline 주석의 "강조문"을
"들여쓰기(구 강조문)"로 — **'강조'를 레이아웃 장치에서 퇴출**(R2). `'(가), (나) 상자'` 등은 유지.

---

## 3. 강조와 '요약에 넣기'의 구조적·개념적 구별 (구상 3)

| 장치 | 역할 | 요약 보기와의 관계 |
|---|---|---|
| 들여쓰기 블록 (구 강조문) | **위치** | 무관 (스위치로만) |
| 강조 `**…**` (구 핵심문장) | **색·굵기** | **무관** (발췌 삭제) |
| 코칭 블록 (§4) | **신호** | 무관 (스위치로만) |
| '요약에 넣기' 스위치 + 자동 항목 | **요약 구성** | 블록 단위로만 |

### 3-1. 버튼 이름 (v2 승인 그대로)

UnifiedToolbar:798 `'핵심문장 (**로 강조)'` → **`'강조 (**…**)'`**. 거부 툴팁 유지.
내부 식별자(`KeySentenceIcon`·`keyToggle*`) 유지 + 주석 병기.

### 3-2. 요약 보기에서 `**` 발췌 삭제 (v2 승인 그대로)

- `lib/solutionOutline.ts`: C9 목록 전량 삭제(`KEY_STRONG_RE_GLOBAL` import · `OutlineItem.keys` ·
  `kind:'keys'` · `joinKeys` · `extractKeySentences` · `pending`/`group`/`flush`). 행 단위 스캔은
  **레거시 `**Case n.**` 승격 전용**으로 축소(D2′ 유효, `forEach` 한 줄 수준).
- `lib/keyTone.ts`: `KEY_STRONG_RE`·`KEY_STRONG_RE_GLOBAL`·`solutionHasKey` 삭제 — **다른 소비처
  없음 확인(C7 재검증)**. `toneClass`는 §3-3, `isToneScoped` 유지.
- `OutlineSections.tsx`: keys 폴백(97-99)·keys 분기(126-131)·`firstCase`/`lastCase`(114-115) 삭제.
  `item.kind`가 `'case' | 'block'` 이항으로.
- globals `.outline-keys` 절(681-690) 삭제.
- **테스트(C8 — 필수 산출물)**: tests/caseBlock.test.mjs :11 import 정리, :144·:150 전용 테스트 2개
  삭제, :182·:191·:213·:239 단언 개정 (27 → 약 23~24개).
- **문구(R7 + C10)**: OutlineToggle 툴팁 3종(34-38, disabled 포함)과 EditorView 스위치 툴팁(:750)을
  **'제목 · 경우 · 선택한 블록'** 기준으로.
- 사용 가이드의 "문장 전체 단위로 감쌀 것" 규칙 폐기(R4) — `**`는 조각이어도 자유.

### 3-3. 톤 다운을 기본 설정으로 (**F1 반영 — v2 §3-3을 대체**)

**has-key 조건 자체를 제거**한다. 풀이·추가 탭(`isToneScoped` 유지)은 마커 유무와 무관하게
항상 dim, `**` 구간만 primary + 600.

```css
/* ① Phase 58 기준선(globals:262) — 특이도만 낮춘다. 값·대상 불변 */
.tone-baseline :where(.katex) { color: var(--text-primary); }      /* (0,2,0) → (0,1,0) */

/* ② 톤 절(284-316) — .has-key 소멸. doubling 없음, 전 규칙 현행 셀렉터에서 클래스 하나만 제거 */
.solution-tone        { color: var(--tone-dim); }   /* ⚠ .tone-baseline(0,1,0)과 동률 — 같은 파일에서
                                                       이 절이 뒤라 이긴다. 절 순서를 바꾸지 말 것(상호 ⚠ 주석) */
.solution-tone .katex { color: var(--tone-dim); }   /* (0,2,0) > 기준선 :where (0,1,0) — 순서 무관 */
.solution-tone strong,
.solution-tone strong .katex { color: var(--text-primary); }   /* (0,1,1)/(0,2,1) > dim — 순서 무관 */
.solution-tone strong { font-weight: var(--weight-semibold); }
/* h1~h3 가드 · h1~h3 .katex 복귀 · .case-label 가드 · 케이스 제목행 가드(668-673)
   = .has-key만 제거. (0,1,1)·(0,2,1)·(0,2,0)·(0,4,1)·(0,5,1) — 전부 dim을 순서 무관 승리 */
```

- **최종 특이도 표 (F1의 산출물 — C6 표를 대체한다)**:

| 규칙 | 특이도 | 이겨야 할 상대 | 판정 |
|---|---|---|---|
| dim 글자 `.solution-tone` | (0,1,0) | `.tone-baseline` (0,1,0) | 동률 — **같은 파일 순서**로 해소(⚠ 주석). 어긋나도 미차 |
| dim 수식 `.solution-tone .katex` | (0,2,0) | 기준선 `:where` **(0,1,0)** | **순서 무관 승리** |
| strong 글자/수식 복귀 | (0,1,1)/(0,2,1) | dim (0,1,0)/(0,2,0) | 순서 무관 승리 |
| h1~h3 가드/수식 복귀 | (0,1,1)/(0,2,1) | 동상 | 순서 무관 승리 |
| 케이스 라벨/제목행/수식 가드 | (0,2,0)/(0,4,1)/(0,5,1) | 동상 | 순서 무관 승리 |
| 인쇄 복원 (0,2,0)/(0,3,0)/strong (0,2,1) | | globals (0,1,0)/(0,2,0)/(0,1,1) | **파일 간 순서 무관 승리** |

- `PrintStyles.css:44-50`: `.has-key`만 제거. 인쇄는 100% 톤 복원 + `**` 700 (Phase 58 D6 불변).
- **주석 갱신**: globals 259-262(기준선 :where 사유) · 286-288 · 312 · 670, PrintStyles 45 —
  특이도 수치 전량 재기입.
- `toneClass` → `isToneScoped(tabId) ? 'solution-tone' : ''` 축소 + **호출부 4곳** 개정(C7):
  TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69.
- **회귀(의도된 외관 변화 — Q7 확정)**: C2의 낙차 표 — `**` 없던 풀이는 본문 소폭
  (#5D5647→#675F52)·**수식 대폭**(#2D2A23→#675F52) 물러난다. Phase 58 opt-in 원칙의 의도적
  폐기를 문서에 명기. 과하면 `--tone-dim`을 `#5D5647`로 — 토큰 1줄, 되돌리기 비용 0.
- ⚠ **FolderView 카드는 원래부터 톤 스코프 밖이다**(toneClass 미사용 — C7 재검증에서 확인).
  카드 미리보기는 지금도, 앞으로도 기준선 톤 — 변화 없음. Q5(rail 미표시)와 방향이 일치한다.
- R3(레거시 `**Case n.**` 톤 오발동)은 조건 소멸과 함께 사라진다.

### 3-4. '요약에 넣기' → 블록 단위 (v2 승인 그대로)

- 자동 포함: 제목 · 경우 제목행 · 하위 경우 제목행 (`buildOutline` 무변경).
- 추가 포함: `showInSummary` 스위치 (현행 유지).
- **R5 해소**: EditorView:737 노출 조건 `isHeading` → `isHeading || isCaseBlock(block.type)`.
  경우 블록에 남은 `showInSummary: true`는 읽히지 않는 값 — 그대로 둔다(마이그레이션 0).
- **이어짓기 손실 수용 + 우회로 문서화**(C11): 요약에 남길 내용은 경우 **사이 블록**에 두고
  그 블록의 스위치를 켠다 — 사용 가이드에 명시.

---

## 4. 코칭 블록 도입 (구상 4 — v2 승인 그대로)

### 4-1. 데이터 모델

**additive 타입 2종**: `coach_important` · `coach_caution`. `types/problem.ts:160` union에 추가.
**Firestore 규칙 0 · 마이그레이션 0 · 서버 0.** 라벨 `'코칭 (Important)'` · `'코칭 (Caution)'`(Q2).
프리셋 `''`. TEXT_BASED·SPLITTABLE 포함, **BORDERED 제외**, SCANNED_TYPES 추가(일관성).
배선 실측(C15): EditorView 상수 4곳 + 렌더 5사이트 + CSS 2곳 + 아이콘 2개가 전부다.
`exportMd`는 타입 문자열을 그대로 흘린다(:75) — 아카이브에 `coach_important`가 남는다는 사실만 기록.

### 4-2. 렌더 · CSS

5사이트 공통, **callout 분기 바로 앞** 삽입(실측 좌표 §5). `.coach-block` + `.coach-important`/`.coach-caution`.

```
구조     [바 0.25em][안쪽 패딩 1em][제목 줄 = 아이콘 + 라벨] / [본문]
좌단     상자 바깥 좌단 = 본문 0. 안쪽 패딩은 들여쓰기가 아니다 — 글상자 3종의 확립 규약 (C14)
상하     K1 (1.1em / 인쇄 11pt)
아이콘   Icons.tsx 신설 2종 — viewBox 24 · strokeWidth 1.8 · currentColor · size prop.
         Important = 말풍선+느낌표 · Caution = 팔각+느낌표. 의존성 추가 없음(경로 직접 작성)
색 토큰  --coach-important: #6639ba;   --coach-caution: #a40e26;
```

**색 근거** (부록 A — 구속 배경 **`#E8DFCE`**, C1 재검산 완료): GitHub light 기본값(3.81 / 4.05)은
텍스트 4.5:1 미달 → 같은 팔레트 700 계열(**5.55** / **5.95**)로 치환. 바·아이콘(비텍스트 3:1)도
같은 토큰. ⚠ 코칭 색 vs dim 본문(#675F52) 대비 **1.17/1.25:1** — 라벨은 색이 아니라
**아이콘 + 600 굵기**로 식별시킨다.

- **톤**: 본문은 `.solution-tone` dim 상속, `**` 정상 동작. 라벨·바·아이콘은 톤 불변("구조 신호는
  톤 불변" — dot·rail과 동일 원칙).
- **인쇄**: 바 `#000` 0.3mm + 라벨 700. 컬러 전환은 토큰 1줄. `break-inside` 없음, 제목 줄만
  `break-after: avoid`.
- **경우 사이 개재**: `.case-gap` rail 관통. 바(0em)와 rail(-1.8em)은 겹치지 않는다.
- **요약 보기**: 자동 포함 없음, `showInSummary`로만 — 코드 추가 0.

---

## 5. 파일 좌표 일람 (`fdeac85` 기준 · v3 실측판)

```
# §1 레이아웃
app/globals.css:561-759          case + 요약 보기 절 재작성 (토큰화 · 철거 · outline-keys 삭제)
app/globals.css::root(≈166)      --case-rail-x · --case-chevron-x 신설
app/globals.css:707-708          ⚠ .section-head 1.6em = 히트 영역 — 토큰화 금지 (C17)
app/globals.css:728-733          .case-head .outline-chevron → width 1em + left calc(…)
app/globals.css:752-758          .outline-chevron base — justify-content: center (F6) + svg 0.8em (C5)
app/globals.css (case 절 말미)    .problem-card 스코프 3줄 — 카드 rail·dot 미표시 (Q5. FolderView.tsx 무변경)
components/print/PrintStyles.css:153-211   인쇄 case 절 재작성 (rail -1.2em · 삭제 좌표는 §1-3 실측값)
lib/caseBlock.ts:155-165         caseGapClassName 단순화 (GAP_MEDIA_TYPES 삭제)
components/problem/TabBody.tsx:29,165      LABEL_GAP → 2.8 * contentFontSize (Q6)
components/editor/EditorView.tsx:3345-3350 미리보기 padding '20px 32px 20px 3.5em' · width calc(38.5em+32px)
components/share/PublicViewerShell.tsx:128-136  ContentCard 좌측 40px · maxWidth calc(35em+76px)
components/problem/OutlineSections.tsx:114-131  firstCase/lastCase · keys 분기 삭제

# §2 명칭
components/editor/EditorView.tsx:86,93     BLOCK_TYPE_LABELS

# §3 강조·요약·톤
components/editor/UnifiedToolbar.tsx:798   버튼 title
lib/solutionOutline.ts:13,23,35,68-85,142-165   keys 계열 삭제 · 스캔 축소 (C9)
lib/keyTone.ts:21,30,40-42,59-62           RE 2종·solutionHasKey 삭제 · toneClass 축소 (C7)
  └ 호출부 4곳: TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69
app/globals.css:262                        기준선 → .tone-baseline :where(.katex)  ★ F1
app/globals.css:284-316, 668-673           .has-key 소멸 (doubling 없음 — F1) + 주석 특이도 재기입
components/print/PrintStyles.css:44-50     .has-key 제거 + 주석 갱신
components/editor/EditorView.tsx:737,750   스위치 노출 조건(+ isCaseBlock) + 툴팁
components/ui/OutlineToggle.tsx:34-38      툴팁 3종 (disabled 포함 — C10)
tests/caseBlock.test.mjs:11,144-154,182,191,213,239   필수 개정 (C8)

# §4 코칭
types/problem.ts:160                       union에 coach_important · coach_caution
components/editor/EditorView.tsx:82-136    LABELS·TYPES·PRESETS·TEXT_BASED·SPLITTABLE (BORDERED 제외)
components/ui/Icons.tsx                    아이콘 2종
app/globals.css                            .coach-block 절 + --coach-* 토큰 2개
components/print/PrintStyles.css           .print-body .coach-block
렌더 5사이트 (callout 분기 바로 앞)         EditorView:3438 · TabBody:141 · FolderView:310 ·
                                           ProblemTabContent:84 · PrintableContent:103   ← 전부 실측 확인
lib/solutionOutline.ts:55-57               SCANNED_TYPES에 2종

# 문서 (Stage 5)
docs/phasedocs/Phase59 요약 보기·경우 블록.md   R6 정정(§11-10·11-11 참조) + "레이아웃은 59a로 대체" 표기
docs/phasedocs/사용 가이드 — 강조와 톤.md       전면 개정 (4분법 + 이어짓기 우회로 C11)
CLAUDE.md · docs/roadmap.md                     타입 2종 · 명칭 · 톤 기본값 · 좌표 토큰 · #E8DFCE 정정(C1)
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0.**

---

## 6. Stage 계획과 검증

### Stage 1 · 레이아웃 철거·거터 이주 (§1)

- 5사이트 × {경우 3+하위 2, 이어짓기, 개재 이미지·목록·글상자} 스케치 대조
- **좌표 실측 — 글꼴 11/15/24px 전부**: rail·dot·chevron x / dot↔chevron 여유 0.34em 비례 유지 /
  **두 chevron 열(-0.7em) 픽셀 정렬(F6)**
- 4경계 레일 연속성 / 브리지 이음매 0.0px (G7 역방향 포함)
- **클리핑**: 공유 ContentCard · 인쇄 multicol(Q4). FolderView 카드는 rail·dot이 **아예 없어야**
  한다(Q5 스코프 누수·잔존 양쪽 확인)
- 여백 판정: ProblemView 라벨→rail→본문(Q6 비례값) / EditorView 채널(F5 산술 — 3.5~4.5em) / 공유 카드
- Q1 판정 카드 / `.case-head` hover 전폭화(C17) / 문제 탭 카드 rail 미관(§1-4 ⚠)
- 회귀: 최상위 수식 3em·리스트·① 무변화 / F1(Phase 59) 형제 인접성 / Phase 56 스크롤

### Stage 2 · 명칭 (§2) — 드롭다운·상단바·전체접기 바 3곳. 문서 갱신과 묶는다.

### Stage 3 · 톤 기본화 + 요약 단순화 (§3)

- `**` 없는 풀이: 본문 소폭·수식 대폭 dim(C2 표) / 문제 탭 불변 / 인쇄 100% 복원
- `**` 있는 풀이: has-key 시절과 **픽셀 완전 동일**
- **F1 회귀 3종 (신규 — v2가 놓친 바로 그 지점)**: ① `**` 안 인라인 수식이 **primary**인가
  ② 제목(h1~h3) 안 수식이 primary인가 ③ 인쇄에서 수식이 #000 계열로 복원되는가.
  DevTools computed로 katex color의 출처가 `.solution-tone .katex`(dim) ↔ 복귀 규칙인지 확인
- 요약 보기: 발췌 소멸 / 접힌 경우 = 제목행만 / 게이트 축소를 툴팁이 설명하는가(C10)
- 레거시 `**Case n.**` 문항: 톤·요약 현행과 동일
- `npm run test:case` **개정 후** 전량 통과 (C8 — 개정이 산출물)

### Stage 4 · 코칭 블록 (§4)

- 추가·저장·재로드·undo·⌘B 분할(뒤 블록 text) / 5사이트 렌더 / 흑백 인쇄
- dim 본문 위에서 라벨이 **아이콘+굵기**로 읽히는가(색 대비 1.2:1뿐 — 부록 A)
- 경우 사이 개재 rail 관통 / `exportMd`에 `<!-- block: coach_important -->` 기록

### Stage 5 · 통합·문서

- roadmap · CLAUDE.md(타입 2종 · 명칭 · 톤 기본값 · 좌표 토큰 · **#E8DFCE 정정 — 부록 C-3**)
- 사용 가이드 전면 개정: **"위치(들여쓰기) · 색(강조) · 신호(코칭) · 요약(스위치)" 4분법** + 이어짓기 우회로
- R6 문서 정정 · Phase 59 확정본에 "레이아웃 §4·§11-1~11-7은 59a로 대체" 표기
- 별건(부록 C) 중 C-1 페이드 색은 **1줄이라 이번에 함께** 고친다(rgba(232,223,206,0)) — 나머지는 기록만

---

## 7. 결정 사항 (미결 0 — v2 §7 승계, F5만 갱신)

| # | 확정 | 폴백 (Stage에서 문제 발견 시) |
|---|---|---|
| Q1 | 하위 경우 = dot 크기 + 라벨 (들여쓰기 없음) | (a) 하위 dot 별도 열 (b) 라벨 차등 |
| Q2 | 코칭 라벨 영문 `Important`/`Caution` | 한글 전환 = 상수 1곳 |
| Q3 | EditorView `paddingLeft: 3.5em` · `width: calc(38.5em+32px)` · `marginLeft: 24` — **근거는 F5 산술**(띠→rail 45.6px · 띠→본문 76.5px@15) | Stage 1 육안으로 3.5~4.5em 조정 |
| Q4 | 인쇄 rail -1.2em (침범 5.01mm · 잔여 4.99mm) | multicol에서 잘리면 인쇄만 "본문 1.2em 들임 + rail 0" |
| Q5 | FolderView 카드 rail·dot 미표시 (CSS 3줄 · FolderView.tsx 무변경) | 필요 시 내부 div paddingLeft 2.2em + 카드 패딩 조정 |
| Q6 | `LABEL_GAP = 2.8 * contentFontSize` 비례화 | 고정 48px (11~20px 구간 한정 안전) |
| Q7 | 톤 기본화 낙차 수용 (`**` 없던 풀이 수식 하강) | `--tone-dim: #5D5647` — 토큰 1줄 |

⚠ Q5는 5사이트 중 FolderView 하나만의 예외 — 확대 적용 금지.

---

## 부록 A. 명암비 (배경 `#E8DFCE` — v2 표 재검산 완료, 전 수치 일치)

| 전경 | 클레이 `#F4EFE7` | **카드 `#E8DFCE`** | 공유 `#FEFDFB` | 백지 |
|---|---|---|---|---|
| GitHub Important `#8250df` | 4.41 | **3.81 ✗** | 4.96 | 5.05 |
| **채택 `#6639ba`** | 6.42 | **5.55 ✓** | 7.22 | 7.34 |
| GitHub Caution `#cf222e` | 4.68 | **4.05 ✗** | 5.27 | 5.36 |
| **채택 `#a40e26`** | 6.87 | **5.95 ✓** | 7.74 | 7.87 |
| `--tone-dim #675F52` (참고) | 5.50 | **4.76 ✓** | 6.19 | 6.30 |
| `--case-dot #BC5F3F` (참고) | 3.79 | **3.28 ✓** (여유 0.28) | 4.26 | 4.33 |

코칭 색 vs dim 본문(#675F52): **1.17 / 1.25** — 라벨 식별은 아이콘 + 600 굵기 필수(§4-2).

## 부록 B. 삭제 총목록 (v2 승계)

케이스 들여쓰기 3/6/9em 전부 · `.case-gap-body` · 케이스 내부 ul/① override(`!important` 2건) ·
`.outline-keys` · `extractKeySentences`·`joinKeys`·`kind:'keys'`·`OutlineItem.keys` ·
`solutionHasKey`·`KEY_STRONG_RE`·`KEY_STRONG_RE_GLOBAL` · `.has-key` 클래스 ·
`pending`/`group`/`flush` · case 계열 '요약에 넣기' 스위치 · `caseGapClassName` 타입 분기 ·
OutlineSections `firstCase`/`lastCase` · 테스트의 keys 계열 단언.

**삭제가 곧 이 Phase의 산출물이다.**

## 부록 C. 별건 (v2 승계 · 전건 실측 확인)

1. FolderView 페이드 `rgba(237,230,218,0)` 하드코딩(:590) — **Stage 5에서 1줄 수정** → `rgba(232,223,206,0)`
2. globals:282 주석 stale (`--tone-dim` 기정의) — §3-3 주석 갱신에 포함
3. CLAUDE.md·Phase 58·59 문서의 `#EDE6DA` 전량 stale — Stage 5 일괄 정정
4. `BORDERED_TYPES` 사본 4개 vs CLAUDE.md 규약 문구 — 이번 Phase 무변경, 규약 문구만 사실화

## 부록 D. 문서 계보

| 버전 | 작성 | 방법 | 산출 |
|---|---|---|---|
| v1 | web | 레포 클론 대조 | 방향·구조·R1~R8 진단, Q1~Q4 기본안 |
| v2 | CLI | 레포 전수 실측 | 정정 C1~C17 — 구속 배경색(C1) · 좌표 겹침(C5) · 테스트 파급(C8), Q5~Q7 확정 |
| **v3** | web | v2 전건 재검증 | **C 15건 승인 · F1(특이도 연쇄 — 결론 역전) · F2(정정의 정정) · F3·F5·F6 보정** |

이번 회차의 교훈: **특이도 조정은 "그 규칙이 이기는가"만이 아니라 "그 규칙을 이겨야 하는
규칙들이 여전히 이기는가"까지 전수로 봐야 한다** — 올리는 쪽(doubling)은 파급이 번지고,
내리는 쪽(`:where`)은 나머지 세계를 그대로 둔다.
