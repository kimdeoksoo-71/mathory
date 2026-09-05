# KaTeX 분수 가로바 길이·번분수 세로 여백 조정 v1

작성일: 2026-09-05 · 상태: 렌더링 검증 완료(KaTeX 0.16 로컬 테스트), Mathory 미적용

## 배경
- 편집창 미리보기에서 번분수(분수 속 분수)의 바깥 가로바가 안쪽 가로바와 길이 차이가 거의 없어 구조 인식이 어려움.
- 단독 분수도 가로바가 글자폭과 거의 같은 분수로 제약되는 경우가 있음.
- 번분수의 바깥 가로바 위아래로 글자가 딱 붙음(KaTeX 최소 clearance = 3×rule = 0.12em).

## 확정안 (B안 V1 + 세로 여백 매크로)

### 1. CSS — katex.min.css 다음에 추가
```css
.katex { --frac-ext: .25em;   /* 가로바를 분자·분모 내용보다 좌우 각각 이만큼 연장 */
         --frac-nest: .3em; } /* 번분수: 바깥 가로바를 한 단계 더 길게 */

/* ① 모든 분수: 분자·분모 좌우 여백 → 가로바 연장 */
.katex .mfrac > .vlist-t > .vlist-r > .vlist > span > .mord {
  padding-left: var(--frac-ext); padding-right: var(--frac-ext);
}
/* ② 분자 또는 분모 전체가 하나의 분수일 때만 추가 여백 (다른 항이 있으면 적용 안 함) */
.katex .mfrac > .vlist-t > .vlist-r > .vlist > span > .mord > .mord:first-child:nth-last-child(2):has(+ .rlap) > .mfrac,
.katex .mfrac > .vlist-t > .vlist-r > .vlist > span > .mord > .mord:only-child > .mfrac {
  padding-left: var(--frac-nest); padding-right: var(--frac-nest);
}
```

### 2. 매크로 — renderMathInElement / katex.render 옵션의 `macros` 추가
```js
const FRAC_GAP_MACROS = {
  "\\frac":  "\\genfrac{}{}{}{}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}",
  "\\dfrac": "\\genfrac{}{}{}{0}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}",
  "\\tfrac": "\\genfrac{}{}{}{1}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}",
};
// KATEX_OPTS.macros = FRAC_GAP_MACROS;
```

## 원리
- 가로바(`.frac-line`)는 분자·분모 중 넓은 쪽 항에 맞춰 `width:100%`로 그려지므로, 분자·분모 `.mord`에 좌우 padding을 주면 가로바가 따라 넓어짐. 안쪽 분수의 연장분이 바깥 분수의 내용 폭에 포함되어 단계별 길이 차이가 자연히 남.
- 세로 여백: `\vphantom{\underline{#1}}`은 분자 아래에 `\underline`만큼(5×rule = 0.2em)의 보이지 않는 깊이를 추가 → KaTeX가 분자 박스 하단과 가로바 사이 clearance(0.12em)를 지키므로 실제 글자와 가로바 사이 최소 간격이 0.32em이 됨. 분모는 `\overline` 팬텀으로 대칭 처리. 자연 간격이 이미 큰 경우(단순 분수 분수 등)는 변화 없음 = "최소 간격" 의미.
- 선택자는 KaTeX 0.16/0.17 DOM(`mfrac > vlist-t > vlist-r > vlist > span > mord`) 기준. 직계 자식 체인을 써서 분수 안의 위첨자·근호 vlist는 건드리지 않음. ②의 `:has()`는 팬텀 삽입 후 분자가 [분수, .rlap] 두 요소가 되는 구조 대응.

## 알려진 영향·한계
- 단순 분수도 분모 쪽 간격이 약간 넓어지고(최소 간격 규칙), 본문 인라인 `\frac`가 세로로 조금 커짐. 인라인을 제외하려면 매크로에서 `\frac` 항목을 빼고 `\dfrac`만 적용.
- 세로 여백 크기는 0.2em 고정(`\underline` 구조). 더 크게는 `\underline{\underline{#1}}`(0.4em).
- `\binom`도 `.mfrac`을 쓰므로 괄호 안 좌우 여백이 살짝 생김.
- 팬텀이 분자·분모를 한 번 더(보이지 않게) 렌더링 → 중첩 깊이 n에서 2^n 배. 수능 범위(≤3단)에서는 무시 가능.
- `\cfrac`는 KaTeX 자체 strut가 있어 매크로 미적용.
- KaTeX 버전 크게 올릴 때 선택자 재확인 필요.
