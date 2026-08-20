# Phase 59a — Case 블록 레이아웃 체계 수정 · 강조 체계 정비 (**v4 착수판**)

작성일: 2026-08-20 · 기준 커밋 **`fdeac85`** (main = origin) · 작성: CLI(v3 전건 재검증)
문서 계보: v1(web, 방향) → v2(CLI, 실측 정정 C1~C17) → v3(web, v2 재검증 F1~F6) → **v4(CLI, v3 재검증 + 착수판)**

> **판정: 착수 가능.** 미결 항목 0 · 데이터 계약 무변경(Firestore 규칙 0 · 마이그레이션 0 · 서버 0) ·
> 모든 좌표와 특이도를 기계 검산으로 확정했다. 이 문서 하나로 구현이 가능하다.
>
> **v3 검증 결과: F1·F3·F5·F6 승인 · F2 기각 · 신규 확인 G1~G9.**
>
> - **F1은 v2의 실질 오류를 잡았다.** v2 C6의 처방(`.solution-tone.solution-tone .katex`, 특이도
>   (0,3,0))은 `**` 강조 안 수식(0,2,1)과 제목 안 수식(0,2,1)을 **dim으로 죽인다** — 기계 검산으로
>   재확인했다. v3의 대안(기준선을 `:where()`로 (0,1,0)까지 낮춤)은 전항 통과.
> - **F2는 사실과 반대다.** 가이드 파일은 실물이 `사용 가이드 — 강조와 **톤**.md`이고
>   `강조와 키`는 존재하지 않는다. v2 C12의 정정이 옳았다 → v4에서 되돌린다(G1).

---

## 0. 검증 결과

### 0-1. v3 판정 이관

| v3 항목 | v4 판정 | 근거 |
|---|---|---|
| **F1** (C6 처방이 복귀 규칙 3군을 죽인다) | **승인 — 채택** | 특이도 기계 검산: (0,3,0) vs (0,2,1)은 클래스 수 우선이라 dim이 이긴다. `:where()` 대안은 복귀·인쇄·케이스 가드 전항 통과(§0-2) |
| **F2** (C12의 가이드 파일명 정정이 헛것) | **기각 — G1** | 실물 파일명 `사용 가이드 — 강조와 톤.md`(od 확인). `강조와 키`는 부재 |
| **F3** (PrintStyles 삭제 좌표 ±2행) | **승인** | 실측: `padding-left:2em` **163** · `.case-sub` **167** · `.case-gap` **168** · `.case-gap-body` **170-173** · `> ul/ol` **207-208** · `> p:has` **211** |
| **F3 부수** (인쇄 case 절에 fleqn override 없음) | **승인** | `.katex-display.fleqn`는 `@media print`:24와 callout:151뿐. case 절에는 없다 → 들여쓰기 철거 후 자동으로 최상위와 동일 |
| **F5** (C4/Q3 산술 자기모순) | **승인** | 24 + 3.5em@15 = 76.5px ≠ 80px. v2가 v1 좌표(-1.6em)의 거터 24px를 그대로 인용한 잔재. 착지값 3.5em은 유지, 근거만 교체 |
| **F6** (`.outline-chevron`에 `justify-content` 부재) | **승인** | 실측: base(:752-758)에 `display:inline-flex; align-items:center`뿐. 1em 상자 안 glyph가 좌측에 붙어 중심이 -0.8em이 된다 |
| C1~C5 · C7~C17 · Q1~Q7 | **v3의 승인 유지** | v2에서 이미 실측, v3가 독립 재계산으로 일치 확인 |

### 0-2. F1 확정 — 특이도 기계 검산

`.has-key` 삭제 후 각 규칙:

| 규칙 | 특이도 | v2 처방(dim=(0,3,0)) | **v4 채택(dim=(0,2,0), 기준선 (0,1,0))** |
|---|---|---|---|
| `.solution-tone strong .katex` (강조 안 수식) | (0,2,1) | **패배 → dim으로 죽음** | **승리** |
| `.solution-tone h1~h3 .katex` (제목 안 수식) | (0,2,1) | **패배 → D9′ 붕괴** | **승리** |
| `.solution-tone .case-block p:has(…) .katex` | (0,5,1) | 승리 | 승리 |
| `.print-body .solution-tone .katex` | (0,3,0) | **동률 → 파일 간 순서 의존** | **승리 (순서 무관)** |
| 기준선 `.tone-baseline …(.katex)` | (0,2,0)→**(0,1,0)** | 패배 | 패배(의도) |

**채택 처방 — 올리지 말고 기준선을 내린다:**

```css
/* globals.css:262 — 이 한 줄만 바꾼다. 값·대상 불변, 특이도만 (0,2,0) → (0,1,0) */
.tone-baseline :where(.katex) { color: var(--text-primary); }
```

**안전성 최종 확인 (G2 — `.katex` color 규칙 전수 조사)**: 프로젝트 CSS 전체에서 `.katex`에
color를 주는 규칙은 7개뿐이고(globals 262·288·292·314-316·673 · PrintStyles 49 ·
CommentPanel 인라인 `<style>` `.comment-body .katex *`), **(0,1,0)~(0,2,0) 구간에서 기준선과
경합하는 규칙은 0건**이다. katex.min.css의 `.katex{font:normal 1.21em …}`에는 color 선언이 없다(실측).
CommentPanel 규칙은 `.comment-body` 스코프라 톤 컨테이너와 만나지 않는다.

**`:where()` 지원 안전성 (G8)**: 이 프로젝트는 `:has()`를 이미 무방비로 쓴다(globals 366·583·666,
PrintStyles 140·173·201·211 등). `:where()`는 `:has()`보다 **먼저 보편화된** 선택자라,
`:has()`가 도는 환경이면 반드시 돈다. 추가 가드 불필요.

**폴백**: `:where()`가 어떤 이유로든 문제가 되면 **아무것도 하지 않는 것**도 성립한다 —
dim (0,2,0)과 기준선 (0,2,0)이 동률이고 dim이 같은 파일 뒤(285-288 > 261-262)라 소스 순서로 이긴다.
v4가 `:where()`를 택하는 이유는 그 순서 의존을 없애기 위해서지, 순서 의존이 지금 깨져서가 아니다.

**잔여 소스 의존 1건(승인)**: 글자색 `.solution-tone`(0,1,0) vs `.tone-baseline`(0,1,0)은 동률이며
**같은 파일 안 순서**로 dim이 이긴다. 이기는 차이가 `#5D5647 → #675F52`의 미차라 치명적이지 않다.
"§3-3 절의 순서를 기준선 절 뒤로 유지할 것"을 주석으로 못 박는다.

### 0-3. 신규 확인 (G1~G9)

| # | 내용 |
|---|---|
| **G1** | **F2 기각.** 가이드 실물은 `docs/phasedocs/사용 가이드 — 강조와 톤.md`(문서 내부 H1도 "강조와 톤"). v1·v3의 `강조와 키`는 오기 |
| **G2** | `.katex` color 규칙 전수 7건 인벤토리 → F1 처방과 경합 0건 (§0-2) |
| **G3** | **인쇄에서 경우 제목행 안 수식은 `#2D2A23`으로 나온다 — 현행과 동일한 기존 동작이다.** 케이스 가드(0,5,1)가 인쇄 복원(0,3,0)을 이기기 때문이며, 변경 전에도 (0,6,1) vs (0,4,0)으로 같았다. **Stage 3 인쇄 검증에서 회귀로 오인하지 말 것** (실제로 `#000`과 육안 구별 불가) |
| **G4** | **CLAUDE.md에서 무효가 되는 규약 목록**을 확정했다 → Stage 5 (§6) |
| **G5** | `caseGapClassName`은 **시그니처를 유지**한다(`type` 인자 남김) → 호출 5곳 무변경. `tsconfig`에 `strict:false`, `noUnusedParameters` 미설정이라 미사용 인자 경고 없음(실측) |
| **G6** | `.case-block`·`.case-gap-body`의 `padding-right: 0`도 **함께 삭제**한다. `\tag` float:right 기준선을 컨테이너 우단에 맞추려던 선언인데, `padding-left`가 사라지면 div 기본값과 같아져 무의미해진다(전역 리셋과 무관하게 padding 초기값이 0) |
| **G7** | EditorView 미리보기의 **em 기준이 일치**함을 확인했다: 외곽 열(:3345)이 `fontSize: contentFontSize`를 세우고 `width`의 `em`과 내부 `paddingLeft`의 `em`이 **같은 base**를 쓴다. 이 Phase가 반복해 밟은 em/px 혼합(G8 계열) 함정이 여기서는 발생하지 않는다 |
| **G8** | `:where()` 지원 안전성 근거 (§0-2) |
| **G9** | **CLAUDE.md의 "`.problem-content-toned .katex`가 수식에 명시 color를 준다"가 stale.** 실측상 그 선택자는 `font-size`만 준다(globals 331-336). 색은 Phase 58에서 `.tone-baseline`으로 분리됐다 → 별건 C-5 |

### 0-4. Phase 59 잔여 부채 진단 (v1 R1~R8)

v2·v3 이중 확인 완료 — **전건 사실, 본 계획에 반영 완료.** 이하 재인용하지 않는다.

---

## 1. Case 블록 레이아웃 체계 수정 (구상 1)

### 1-1. 기조

rail·dot·chevron을 **본문 영역 왼쪽 바깥(거터)** 으로 내보내고, rail 때문에 신설한 2단 들여쓰기
체계를 전면 철거한다. 경우·하위 경우 본문의 좌단 = **일반 텍스트와 동일한 0**. 경우 안의 display
수식·리스트·① 밭은 **최상위 규칙을 그대로 승계**하므로 override가 전부 사라진다(화면·인쇄 공통).

### 1-2. 좌표

x = 0 이 본문 좌단.

```css
:root {
  --case-rail-x:    -1.8em;   /* rail·dot 중심선 */
  --case-chevron-x: -0.7em;   /* 요약 보기 chevron glyph 중심 (F6 적용 후 제목 줄과 동일) */
}
```

| 대상 | 좌표 | 산출 근거 |
|---|---|---|
| rail · dot (경우·하위 공통) | **-1.8em** | dot 우단 -1.54em → chevron 좌단 -1.2em, 여유 0.34em이 전 글꼴에서 비례 유지 |
| 경우 줄 chevron | glyph 중심 **-0.7em** (상자 폭 1em → 좌단 -1.2em) | 제목 줄과 픽셀 정렬 |
| 요약 보기 **제목 줄** chevron | **마진 3개 무변경** + base 1줄(F6) | 상자 중심이 이미 -0.7em (`-1.2em + 1em/2`) |
| 경우·하위 경우 본문/제목행 | **0** | `padding-left` 삭제 |
| 개재 블록(case-gap) | **0** | `.case-gap-body` 철거 |
| 경우 안 수식·리스트·① 밭 | 최상위 규칙 승계 | override 전량 삭제 (인쇄 포함 — F3 부수) |
| 인쇄 rail | **-1.2em** (= 12pt ≈ 4.23mm) | 단 간격 10mm, dot 반경 포함 침범 5.01mm → 잔여 4.99mm |

**필요 거터 폭 = 2.06em(dot 좌단), 실사용 2.2em** → 33px@15 · 24px@11 · 53px@24.

**chevron em화 (F1과 함께 이 Phase의 두 필수 CSS 처방)**:

```css
.outline-chevron { justify-content: center; }          /* base(:752-758)에 1줄 — F6 */
.outline-chevron svg { width: 0.8em; height: 0.8em; }  /* size={12} 고정 px 무력화 — C5 */
.case-head .outline-chevron {
  width: 1em;                                          /* left를 '중심' 기준으로 다루기 위해 */
  left: calc(var(--case-chevron-x) - 0.5em);
  /* top: 0.9em · translateY(-50%) · aria-expanded 회전 규칙은 현행 유지 */
}
```

⚠ `justify-content: center`가 없으면 1em 상자 안 0.8em glyph가 좌측에 붙어 제목 줄 중심이
**-0.8em**이 된다(F6). 이 한 줄이 빠지면 두 chevron 열이 0.1em 어긋난다.

하위 경우의 시각 구분은 **dot 크기(0.52/0.3em) + 라벨(C1/C1a)** 뿐이다 → Q1, Stage 1 판정.

### 1-3. CSS 변경 (globals.css 561-759 · PrintStyles.css 153-211)

**유지**: rail 조각·위 브리징·종단 기하(1.5em 3종 / 인쇄 14pt), 불투명 `--case-rail`, dot 상태
문법(D19 채움/테두리 + `--case-dot-fill`), `--case-ring`, `case-cont`, 라벨·제목행 굵기,
케이스 톤 가드(§3-3에 따라 `.has-key`만 제거), `.case-gap` rail 관통, `margin-left:-0.5px`
헤어라인 보정, **G7 원칙(`.case-block`에 상하 padding 금지)**.

**치환**: 모든 `left: 1em` → `left: var(--case-rail-x)` (인쇄는 `0.7em` → `-1.2em` 리터럴).

**삭제** (좌표 실측 완료 — F3·G6):

```
globals.css   .case-block { padding-left:3em; padding-right:0 }  (570-571)   ← G6: 둘 다
              .case-block.case-sub { padding-left:6em }          (573)
              .case-gap-body 3규칙                                (579-583)
              .case-block .preview-content > ul/ol{margin-left:3em}          (664-665)
              .case-block .preview-content p:has(.marker-circled){…!important}(666)
              .outline-keys 절 전체                               (681-690)  ← §3-2로 소비처 소멸
PrintStyles   .print-body .case-block { padding-left:2em; padding-right:0 }  (163-164)  ← G6
              .print-body .case-block.case-sub { padding-left:4em }          (167)
              .print-body .case-gap-body 3규칙                    (170-173)
              .print-body .case-block > ul/ol                     (207-208)
              .print-body .case-block > p:has(.marker-circled){…!important}  (211)
lib/caseBlock caseGapClassName → 상수 'case-gap' 반환 (GAP_MEDIA_TYPES 소멸).
              **시그니처는 유지** — 호출 5곳 무변경 (G5)
```

### 1-4. 여백 확보 (사이트별)

| 사이트 | 현행 | 조치 |
|---|---|---|
| **ProblemView** (TabBody) | 라벨 열 `7 * contentFontSize` + `LABEL_GAP = 28`(px 고정) | **`LABEL_GAP = 2.8 * contentFontSize`로 비례화 — Q6.** dot 좌단(-2.06em)과 라벨 열 사이 0.74em이 전 글꼴에서 유지. 라벨 열 폭이 이미 비례식이라 정합적 |
| **EditorView 미리보기** | `marginLeft:24` + `padding:'20px 32px'` + `width: calc(35em + 64px)` | `marginLeft: 24` **유지** · `padding: '20px 32px 20px 3.5em'` · `width: calc(38.5em + 32px)`. **근거(F5 실측)**: 띠→rail 빈 공간 **45.6px@15**(≈ Phase 45a 이전 채널 48px) · 띠→본문 76.5px. 우측 패딩 32px·측정폭 35em 보존. em 기준 일치 확인 완료(G7). Stage 1 조정 폭 3.5~4.5em |
| **공유 (1단·2단 공용)** | ContentCard `padding:'32px 36px'` · `maxWidth: calc(35em + 72px)` | 좌측 **40px** · `maxWidth: calc(35em + 76px)`. **2단 별도 조치 없음** — 양 분기가 같은 ContentCard를 쓰고, `fontSize: 15` 고정이라 em/px 혼합 위험 자체가 없다 |
| **FolderView 카드** | 카드 `18px 22px`+hidden, 내부 div hidden·패딩 0 | **rail·dot 미표시 — Q5.** globals case 절 말미에 3줄:<br>`.problem-card .case-block::before,`<br>`.problem-card .case-gap::before,`<br>`.problem-card .case-block::after { content: none; }`<br>`className="problem-card"` 실존(:503) → **FolderView.tsx 무변경**. 라벨(`C1.`)은 텍스트라 남는다 |
| **인쇄** | `padding-left: 2em` | §1-2. 좌측 단 rail은 페이지 여백(20mm) 쪽이라 무관 |

⚠ **TabBody 문제 탭**(클레이 카드 `padding:'20px 24px'`+`marginLeft:-24`, :215-222): 경우 블록이
문제 탭에 오면 rail이 카드 배경 밖에 그려진다. 요약 보기는 풀이 탭 전용이라 접힘 dot·
`--case-dot-fill` 불일치는 없다 → 미관만 Stage 1 판정.

### 1-5. 회귀 확인

- **Phase 59 F1 형제 인접성**: 래퍼 규약(D15′) 무변경. 5사이트 `.case-block + .case-block` 매칭 재확인.
- **`margin-left` 금지**(§11-6): 새 좌표는 전부 `left`(절대배치)·`padding`으로만.
- **브리지 1.5em / 14pt 유효** — 블록 마진(1.1em/11pt) 무변경. `padding` 제거가 부모-자식 마진
  collapse에 영향을 주지 않는지(G7 역방향) 이음매 0.0px 재확인.
- `.outline-keys` 소멸에 따라 OutlineSections의 `firstCase`/`lastCase` gap 부착 로직 삭제.
- `.case-head` hover가 본문 전폭을 덮게 되는 변화(C17) → Stage 1 판정.

---

## 2. 명칭 변경 (구상 2)

| 항목 | 현행 | 변경 | 범위 |
|---|---|---|---|
| callout 블록 | '강조문' | **'들여쓰기'** | UI 라벨만. 타입 id `callout` · `.callout-block` · DB 불변 |
| box 블록 | '빈 글상자' | **'글상자'** | 동일 |

`BLOCK_TYPE_LABELS`(EditorView:86·:93) 한 곳이 드롭다운·상단바·전체접기 바에 공급한다.
CSS 주석(globals:546-548 · PrintStyles:143)과 keyTone·solutionOutline 주석의 "강조문"을
"들여쓰기(구 강조문)"로 → **'강조'를 레이아웃 장치에서 퇴출**하는 것이 이 항목의 실익(R2).
`'(가), (나) 상자'`·`'ㄱ, ㄴ 상자'`는 '글상자'와 계열감이 유지되므로 그대로.

---

## 3. 강조와 '요약에 넣기'의 구조적·개념적 구별 (구상 3)

| 장치 | 역할 | 요약 보기와의 관계 |
|---|---|---|
| 들여쓰기 블록 (구 강조문) | **위치** | 무관 (스위치로만) |
| 강조 `**…**` (구 핵심문장) | **색·굵기** | **무관** (발췌 삭제) |
| 코칭 블록 (§4) | **신호** | 무관 (스위치로만) |
| '요약에 넣기' 스위치 + 자동 항목 | **요약 구성** | 블록 단위로만 |

### 3-1. 버튼 이름

UnifiedToolbar:798 `'핵심문장 (**로 강조)'` → **`'강조 (**…**)'`**. 거부 툴팁 유지.
내부 식별자(`KeySentenceIcon`·`keyToggle*`)는 유지하고 주석만 병기.

### 3-2. 요약 보기에서 `**` 발췌 삭제

- `lib/solutionOutline.ts`: `KEY_STRONG_RE_GLOBAL` import(13) · `OutlineItem.keys`(35) ·
  `kind:'keys'`(23) · `joinKeys`(83-85) · `extractKeySentences`(68-81) ·
  `pending`/`group`/`flush`(142-147, 163, 165) 삭제. 텍스트 계열 스캔은
  **레거시 `**Case n.**` 승격 전용**으로 축소(D2′ 유효, `forEach` 한 줄 수준).
- `lib/keyTone.ts`: `KEY_STRONG_RE`·`KEY_STRONG_RE_GLOBAL`·`solutionHasKey` 삭제
  (**다른 소비처 없음** — grep 전수 확인). `toneClass`는 §3-3, `isToneScoped` 유지.
- `OutlineSections.tsx`: keys 폴백(97-99) · keys 분기(126-131) · `firstCase`/`lastCase`(114-115) 삭제.
  `item.kind`가 `'case' | 'block'` 이항이 되므로 삼항 사슬을 이항으로.
- globals `.outline-keys` 절(681-690) 삭제.
- **테스트 개정은 선택이 아니라 산출물이다**: `tests/caseBlock.test.mjs` :11 import 정리 ·
  :144·:150 전용 테스트 2개 삭제 · :182·:191·:213·:239 단언 개정 (27 → 약 23~24개).
- **문구**: OutlineToggle 툴팁 3종(34-38, **disabled 포함**)과 EditorView 스위치 툴팁(:750)을
  **'제목 · 경우 · 선택한 블록'** 기준으로 개정. disabled 문구를 안 고치면 "핵심문장을 넣었는데
  왜 요약이 안 켜지나"가 된다.
- 사용 가이드의 "문장 전체 단위로 감쌀 것" 규칙 폐기(R4) → `**`는 조각이어도 자유.

### 3-3. 톤 다운을 기본 설정으로 (**F1 반영**)

has-key 조건 자체를 제거한다. 풀이·추가 탭(`isToneScoped` 유지)은 마커 유무와 무관하게 항상 dim,
`**` 구간만 primary + 600.

```css
/* ① 기준선(globals:262) — 이 한 줄만. 값·대상 불변, 특이도만 (0,2,0)→(0,1,0) */
.tone-baseline :where(.katex) { color: var(--text-primary); }

/* ② 키 절(284-316) — .has-key 소멸. doubling 금지(F1). 전 규칙에서 클래스 하나씩만 제거 */
.solution-tone        { color: var(--tone-dim); }   /* (0,1,0) — .tone-baseline과 동률.
                                                       ⚠ 이 절이 기준선 절 뒤에 오는 순서에 의존한다.
                                                          절 순서를 바꾸지 말 것 */
.solution-tone .katex { color: var(--tone-dim); }   /* (0,2,0) > 기준선 :where (0,1,0) — 순서 무관 */
.solution-tone strong,
.solution-tone strong .katex { color: var(--text-primary); }   /* (0,1,1)/(0,2,1) > dim — 순서 무관 */
.solution-tone strong { font-weight: var(--weight-semibold); }
/* h1~h3 가드 · h1~h3 .katex 복귀 · .case-label 가드 · 케이스 제목행 가드(668-673)
   = .has-key만 제거. (0,1,1)·(0,2,1)·(0,2,0)·(0,4,1)·(0,5,1) — 전부 dim에 순서 무관 승리 */
```

- `PrintStyles.css:44-50`: `.has-key`만 제거. `.print-body .solution-tone …`가
  (0,2,0)/(0,3,0)/(0,2,1)로 globals를 **파일 간 순서와 무관하게** 이긴다 → 인쇄는 100% 톤 복원 +
  `**`만 700 (Phase 58 D6 불변).
- **주석 특이도 수치 갱신 필수**: globals 259-262(기준선 `:where` 사유) · 286-288 · 312 · 670,
  PrintStyles 45.
- `toneClass` → `isToneScoped(tabId) ? 'solution-tone' : ''`로 축소 + **호출부 4곳** 개정(C7):
  TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69.
  (`isToneScoped` 단독 호출 2곳 — TabBody:50 · ProblemTabContent:34 — 은 무변경.)
- **회귀(의도된 외관 변화 — Q7 확정)**: `**` 없던 풀이에서 본문 소폭(`#5D5647`→`#675F52`) ·
  **수식 대폭**(`#2D2A23`→`#675F52`) 물러난다. Phase 58의 opt-in 원칙을 의도적으로 폐기하는
  것이므로 문서에 명기. 과하면 `--tone-dim: #5D5647` — 토큰 1줄, 되돌리기 비용 0.
- ⚠ **FolderView 카드는 원래부터 톤 스코프 밖**이다(`toneClass` 미사용, question 전용) → 변화 없음.
  Q5(카드 rail 미표시)와 방향이 일치한다.
- R3(레거시 `**Case n.**`이 톤을 오발동시키던 문제)은 조건 소멸과 함께 사라진다.

### 3-4. '요약에 넣기' → 블록 단위

- **자동 포함**: 제목 · 경우 제목행 · 하위 경우 제목행 (`buildOutline` 무변경).
- **추가 포함**: `showInSummary` 스위치(현행 유지).
- **R5 해소**: EditorView:737 노출 조건 `isHeading` → `isHeading || isCaseBlock(block.type)`.
  경우 블록에 남은 `showInSummary: true`는 읽히지 않는 값이라 그대로 둔다(마이그레이션 0).
- **이어짓기 손실 수용 + 우회로 문서화**(C11): 요약에 남길 내용은 경우 **사이 블록**에 두고
  그 블록의 스위치를 켠다 — 이어짓기의 존재 이유가 바로 그 끼워넣기다.

---

## 4. 코칭 블록 도입 (구상 4)

### 4-1. 데이터 모델

**additive 타입 2종**: `coach_important` · `coach_caution` (`types/problem.ts:160` union).
**Firestore 규칙 0 · 마이그레이션 0 · 서버 0.**
라벨 `'코칭 (Important)'`·`'코칭 (Caution)'`(Q2) · 프리셋 `''` · TEXT_BASED·SPLITTABLE 포함 ·
**BORDERED 제외** · `SCANNED_TYPES` 추가(일관성).

배선 실측(C15): EditorView 상수 **4곳** + 렌더 5사이트 + CSS 2곳 + 아이콘 2개가 전부다.
`normalizeBlockType`·`EmptyBlockChips`(3칩 고정)·사이트별 `BORDERED_TYPES` 사본 4개는 **무변경**.
`exportMd`는 타입을 `<!-- block: ${type} -->`로 흘리므로(:75) 코드 변경 0 — 아카이브에
`coach_important` 문자열이 남는다는 사실만 기록.

### 4-2. 렌더 · CSS

5사이트 공통, **callout 분기 바로 앞**(5사이트 유일 공통 앵커)에 삽입.

```
구조     [바 0.25em][안쪽 패딩 1em][제목 줄 = 아이콘 + 라벨] / [본문]
좌단     상자 바깥 좌단 = 본문 0. 안쪽 패딩은 들여쓰기가 아니다 — 글상자 3종의 확립 규약 (C14)
상하     K1 (1.1em / 인쇄 11pt)
아이콘   Icons.tsx 신설 2종 — viewBox "0 0 24 24" · strokeWidth 1.8 · fill="none" ·
         stroke={color}(기본 currentColor) · size prop  ← 그 파일의 확립 규격
         Important = 말풍선+느낌표 · Caution = 팔각+느낌표. 의존성 추가 없음(경로 직접 작성)
색 토큰  --coach-important: #6639ba;   --coach-caution: #a40e26;
```

**색 근거**(부록 A, 구속 배경 **`#E8DFCE`**): GitHub light 기본값(3.81 / 4.05)은 텍스트 4.5:1
미달 → 같은 팔레트 700 계열(**5.55** / **5.95**)로 치환. 바·아이콘(비텍스트 3:1)도 같은 토큰.
⚠ 코칭 색 vs dim 본문(`#675F52`) 대비는 **1.17 / 1.25:1** — 라벨을 색으로 구분시키려 하지 말고
**아이콘 + 600 굵기**로 식별시킬 것.

- **톤**: 본문은 `.solution-tone` dim 그대로, 본문 안 `**`는 평소처럼 앞으로.
  라벨·바·아이콘은 **톤 불변**("구조 신호는 톤 불변" — dot·rail과 같은 원칙).
- **인쇄**: 바 `#000` 0.3mm + 라벨 700. 컬러 인쇄는 `--coach-*` 교체 1줄(`--case-dot: #000` 전례).
  `break-inside` 없음(코칭은 길 수 있다 — 경우 블록과 같은 판단), 제목 줄만 `break-after: avoid`.
- **경우 사이 개재**: `.case-gap` rail 관통. 바(0em)와 rail(-1.8em)은 겹치지 않는다.
- **요약 보기**: 자동 포함 없음, `showInSummary`로만 → 코드 추가 0.
- **인쇄에는 chevron이 없다** — 요약 보기는 열람 2뷰 전용이므로 `--case-chevron-x`의 인쇄 대응은 불필요.

---

## 5. 파일 좌표 일람 (`fdeac85` 기준 · v4 실측 확정)

```
# §1 레이아웃
app/globals.css:561-759          case + 요약 보기 절 재작성 (토큰화 · 철거 · outline-keys 삭제)
app/globals.css::root(≈166)      --case-rail-x · --case-chevron-x 신설
app/globals.css:570-571,573      .case-block padding-left/right · case-sub 삭제 (G6)
app/globals.css:707-708          ⚠ .section-head 1.6em = 히트 영역 → 토큰화 금지 (C17)
app/globals.css:728-733          .case-head .outline-chevron → width 1em + left calc(…)
app/globals.css:752-758          .outline-chevron base → justify-content:center (F6) + svg 0.8em (C5)
app/globals.css (case 절 말미)    .problem-card 스코프 3줄 — 카드 rail·dot 미표시 (Q5)
components/print/PrintStyles.css:163-164,167,170-173,207-208,211   인쇄 case 절 (좌표 실측 F3)
lib/caseBlock.ts:155-165         caseGapClassName 단순화 · **시그니처 유지** (G5)
components/problem/TabBody.tsx:29,165      LABEL_GAP → 2.8 * contentFontSize (Q6)
components/editor/EditorView.tsx:3345-3350 padding '20px 32px 20px 3.5em' · width calc(38.5em+32px)
components/share/PublicViewerShell.tsx:128-136  ContentCard 좌측 40px · maxWidth calc(35em+76px)
components/problem/OutlineSections.tsx:97-99,114-115,126-131  keys 폴백·gap 계산·keys 분기 삭제

# §2 명칭
components/editor/EditorView.tsx:86,93     BLOCK_TYPE_LABELS

# §3 강조·요약·톤
components/editor/UnifiedToolbar.tsx:798   버튼 title
lib/solutionOutline.ts:13,23,35,68-85,142-165   keys 계열 삭제 · 스캔 축소 (C9)
lib/keyTone.ts:21,30,40-42,59-62           RE 2종·solutionHasKey 삭제 · toneClass 축소 (C7)
  └ 호출부 4곳: TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69
app/globals.css:262                        기준선 → .tone-baseline :where(.katex)   ← F1 핵심
app/globals.css:284-316, 668-673           .has-key 소멸 (**doubling 금지**) + 주석 특이도 재기술
components/print/PrintStyles.css:44-50     .has-key 제거 + 주석 갱신
components/editor/EditorView.tsx:737,750   스위치 노출 조건(+ isCaseBlock) + 툴팁
components/ui/OutlineToggle.tsx:34-38      툴팁 3종 (disabled 포함 — C10)
tests/caseBlock.test.mjs:11,144-154,182,191,213,239   **필수** 개정 (C8)

# §4 코칭
types/problem.ts:160                       union에 coach_important · coach_caution
components/editor/EditorView.tsx:82-136    LABELS·TYPES·PRESETS·TEXT_BASED·SPLITTABLE (BORDERED 제외)
components/ui/Icons.tsx                    아이콘 2종
app/globals.css                            .coach-block 절 + --coach-* 토큰 2개
components/print/PrintStyles.css           .print-body .coach-block
렌더 5사이트 (callout 분기 바로 앞)         EditorView:3438 · TabBody:141 · FolderView:310 ·
                                           ProblemTabContent:84 · PrintableContent:103
lib/solutionOutline.ts:55-57               SCANNED_TYPES에 2종

# 문서 (Stage 5)
docs/phasedocs/Phase59 요약 보기·경우 블록.md   R6 정정 + "레이아웃은 59a로 대체" 표기
docs/phasedocs/사용 가이드 — 강조와 톤.md       전면 개정 (4분법 + 이어짓기 우회로)   ← G1: 파일명 확정
CLAUDE.md · docs/roadmap.md                     §6의 무효 규약 목록대로 개정
```

---

## 6. Stage 계획과 검증

### Stage 1 · 레이아웃 철거·거터 이주 (§1)

- 5사이트 × {경우 3+하위 2, 이어짓기, 개재 이미지·목록·글상자} 스케치 대조
- **좌표 실측 — 글꼴 11 / 15 / 24px 전부**: rail·dot·chevron x / dot↔chevron 여유 0.34em 비례 /
  **두 chevron 열(-0.7em) 픽셀 정렬(F6)** / 11px에서 chevron 8.8px 가독성
- 4경계 레일 연속성 / 브리지 이음매 0.0px (G7 역방향 포함)
- **클리핑**: 공유 ContentCard · 인쇄 multicol(Q4). FolderView 카드는 rail·dot이 **아예 없어야**
  한다 — 잘린 조각이 남지 않는지 + 예외가 다른 4사이트로 새지 않는지
- 여백 판정: ProblemView 라벨→rail→본문(Q6 비례값) / EditorView 채널(F5, 3.5~4.5em) / 공유 카드
- Q1 판정 카드 / `.case-head` hover 전폭화(C17) / 문제 탭 카드 rail 미관
- 회귀: 최상위 수식 3em·리스트·① 무변화 / Phase 59 F1 형제 인접성 / Phase 56 스크롤

### Stage 2 · 명칭 (§2)

드롭다운·상단바·전체접기 바 3곳 라벨 확인. 문서 갱신과 묶는다.

### Stage 3 · 톤 기본화 + 요약 단순화 (§3)

- `**` 없는 풀이: 본문 소폭·**수식 대폭** dim / 문제 탭 불변 / 인쇄 100% 복원
- `**` 있는 풀이: has-key 시절과 **픽셀 완전 동일**
- **F1 회귀 3종 (v2가 놓쳤던 바로 그 지점 — 최우선)**:
  ① `**` 안 인라인 수식이 **primary**인가 ② 제목(h1~h3) 안 수식이 primary인가
  ③ 인쇄에서 수식이 `inherit`(검정)로 복원되는가.
  DevTools computed로 `.katex` color의 **출처 규칙**이 dim이 아니라 복귀 규칙인지 확인
- **G3 — 오인 금지**: 인쇄에서 **경우 제목행 안 수식만 `#2D2A23`** 으로 나온다. 케이스 가드(0,5,1)가
  인쇄 복원(0,3,0)을 이기기 때문이며 **변경 전에도 동일**했다. 회귀가 아니다
- 요약 보기: 발췌 소멸 / 접힌 경우 = 제목행만 / 게이트 축소를 툴팁이 설명하는가(C10)
- 레거시 `**Case n.**` 문항: 톤·요약 모두 현행과 동일
- `npm run test:case` **개정 후** 전량 통과 (C8)

### Stage 4 · 코칭 블록 (§4)

- 추가·저장·재로드·undo·⌘B 분할(뒤 블록 text) / 5사이트 렌더 / 흑백 인쇄
- dim 본문 위에서 라벨이 **아이콘+굵기**로 읽히는가(색 대비 1.2:1뿐)
- 경우 사이 개재 시 rail 관통 / `exportMd`에 `<!-- block: coach_important -->` 기록

### Stage 5 · 통합·문서

**CLAUDE.md에서 무효가 되는 규약 (G4 — 정확 목록)**:

| 항목 | 처리 |
|---|---|
| "경우 구역의 좌측 기준은 세 자리다 (§11-6)" — rail 1em / 본문 3em / 한 단 더 6em | **전면 폐기** → "구조 신호는 거터(-1.8em), 본문은 0" 규약으로 교체 |
| "경우 블록 안은 최상위와 같은 들여쓰기 규칙 (§11-2)" | **유지하되 근거 교체** — override 삭제로 자동 달성된다 |
| "연결선(rail)은 조각을 이어 붙인 것 (§11-1)" | 유지 (기하 불변) |
| "상태를 나타내는 색은 3:1 (G1)" — 카드 3.49:1 | **수치 정정 3.28:1** (배경 `#E8DFCE`) |
| "명암비 계산은 …" — 배경 3종에 `#EDE6DA` | **`#E8DFCE`로 정정** |
| "key sentence 톤 시스템 (Phase 58 P2)" — D4 "`**` 없는 풀이는 톤 낮추기 미발동" | **폐기** (톤 기본화) |
| "`.problem-content-toned .katex`가 수식에 명시 color를 준다" | **stale — 삭제**(font-size만 준다). 색은 `.tone-baseline` (G9) |
| "요약 보기에 그림 남기기 (§11-9)" — 제목 블록에 스위치 없음 | **case 계열도 없음**을 추가 |
| "블록 타입" 목록 | `coach_important`·`coach_caution` 2종 추가 |
| 블록 이름 '강조문'·'빈 글상자' | '들여쓰기'·'글상자'로 |

그 외: roadmap 갱신 · 사용 가이드 전면 개정(**"위치(들여쓰기) · 색(강조) · 신호(코칭) ·
요약(스위치)" 4분법** + 이어짓기 우회로) · R6 문서 정정 · Phase 59 확정본에 대체 표기 ·
**별건 C-1(FolderView 페이드 색)은 1줄이라 이번에 함께 고친다.**

---

## 7. 결정 사항 (미결 0)

| # | 확정 | 폴백 (Stage에서 문제 발견 시) |
|---|---|---|
| Q1 | 하위 경우 = dot 크기 + 라벨 (들여쓰기 없음) | (a) 하위 dot 별도 열 (b) 라벨 차등 |
| Q2 | 코칭 라벨 영문 `Important`/`Caution` | 한글 전환 = 상수 1곳 |
| Q3 | EditorView `paddingLeft: 3.5em` · `width: calc(38.5em+32px)` · `marginLeft: 24` (근거 = F5 실측) | Stage 1 육안으로 3.5~4.5em |
| Q4 | 인쇄 rail -1.2em (침범 5.01mm · 잔여 4.99mm) | 잘리면 인쇄만 "본문 1.2em + rail 0" |
| Q5 | FolderView 카드 rail·dot 미표시 (CSS 3줄 · tsx 무변경) | 내부 div `paddingLeft: 2.2em` + 카드 패딩 조정 |
| Q6 | `LABEL_GAP = 2.8 * contentFontSize` | 고정 48px (11~20px 구간만 안전) |
| Q7 | 톤 기본화 낙차 수용 | `--tone-dim: #5D5647` — 토큰 1줄 |
| **Q8**(신설) | **기준선을 `:where()`로 낮춘다** (F1) | **아무것도 안 해도 성립** — dim(0,2,0)이 같은 파일 뒤라 순서로 이긴다. `:where()`는 순서 의존을 없애려는 것 |

⚠ Q5는 5사이트 중 FolderView 하나만의 예외 — 확대 적용 금지.

---

## 부록 A. 명암비 (배경 `#E8DFCE` · v2 산출 → v3·v4 재계산 일치)

| 전경 | 클레이 `#F4EFE7` | **카드 `#E8DFCE`** | 공유 `#FEFDFB` | 백지 |
|---|---|---|---|---|
| GitHub Important `#8250df` | 4.41 | **3.81 ✗** | 4.96 | 5.05 |
| **채택 `#6639ba`** | 6.42 | **5.55 ✓** | 7.22 | 7.34 |
| GitHub Caution `#cf222e` | 4.68 | **4.05 ✗** | 5.27 | 5.36 |
| **채택 `#a40e26`** | 6.87 | **5.95 ✓** | 7.74 | 7.87 |
| `--tone-dim #675F52` (참고) | 5.50 | **4.76 ✓** | 6.19 | 6.30 |
| `--case-dot #BC5F3F` (참고) | 3.79 | **3.28 ✓** (여유 0.28) | 4.26 | 4.33 |

코칭 색 vs dim 본문(`#675F52`): **1.17 / 1.25** → 라벨 식별은 아이콘 + 600 굵기(§4-2).

## 부록 B. 삭제 총목록

케이스 들여쓰기 3/6/9em 전부(+`padding-right:0` 짝, G6) · `.case-gap-body` ·
케이스 내부 ul/① override(`!important` 2건) · `.outline-keys` ·
`extractKeySentences`·`joinKeys`·`kind:'keys'`·`OutlineItem.keys` ·
`solutionHasKey`·`KEY_STRONG_RE`·`KEY_STRONG_RE_GLOBAL` · `.has-key` 클래스 ·
`pending`/`group`/`flush` · case 계열 '요약에 넣기' 스위치 ·
`caseGapClassName` 타입 분기(`GAP_MEDIA_TYPES`) · OutlineSections `firstCase`/`lastCase` ·
테스트의 keys 계열 단언.

**삭제가 곧 이 Phase의 산출물이다** — Phase 59가 옳은 의도로 쌓은 표현 계층을,
데이터 계약을 건드리지 않고 걷어낸다.

## 부록 C. 별건 (전건 실측 확인)

1. FolderView 페이드 `rgba(237,230,218,0)` 하드코딩(:590)이 카드 배경 `#E8DFCE`와 불일치 →
   **Stage 5에서 1줄 수정** → `rgba(232,223,206,0)`
2. globals:282 주석 stale (`--tone-dim`은 :138에 기정의) → §3-3 주석 갱신에 포함
3. CLAUDE.md·Phase 58·59 문서의 `#EDE6DA` 전량 stale → Stage 5 일괄 정정
4. `BORDERED_TYPES` 사본 4개 vs CLAUDE.md "상수 6종은 전부 EditorView 상단" → 이번 Phase 무변경,
   규약 문구만 사실화
5. **(G9 신규)** CLAUDE.md의 "`.problem-content-toned .katex`가 수식에 명시 color를 준다"가 stale —
   실측상 `font-size`만 준다(globals 331-336). 색은 Phase 58에서 `.tone-baseline`으로 분리됐다

## 부록 D. 문서 계보

| 버전 | 작성 | 방법 | 산출 |
|---|---|---|---|
| v1 | web | 레포 클론 대조 | 방향·구조·R1~R8 진단, Q1~Q4 |
| v2 | CLI | 레포 전수 실측 | C1~C17 — 구속 배경색(C1) · 좌표 겹침(C5) · 테스트 파급(C8), Q5~Q7 확정 |
| v3 | web | v2 재검증 | **F1(C6 처방이 복귀 규칙을 죽인다)** · F3·F5·F6 보정 |
| **v4** | CLI | v3 재검증 + 착수판 | **F1 기계 검산 확정 · F2 기각(G1) · G2~G9 · CLAUDE.md 무효 규약 확정 · 착수 판정** |

이번 회차의 교훈: **특이도 조정은 "그 규칙이 이기는가"만이 아니라 "그 규칙을 이겨야 하는 규칙들이
여전히 이기는가"까지 전수로 봐야 한다.** 올리는 쪽(doubling)은 파급이 번지고, 내리는 쪽(`:where`)은
나머지 세계를 그대로 둔다.
