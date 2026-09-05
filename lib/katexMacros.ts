/**
 * M3 B2 — KaTeX 매크로 한 벌 (화면 EditorPreview · 인쇄 PrintableContent 공유).
 *
 * 정의 원천: `docs/phaseSketch/katex-frac-bar-and-vgap-v1.md` (KaTeX 0.16 로컬 검증,
 * 0.16.28 DOM 재검증 — M3 계획서 v3 §5). 분자·분모에 `\underline`/`\overline` 팬텀을
 * 심어 글자↔가로바 최소 간격 0.32em을 확보한다. 가로바 **길이**는 CSS가 담당한다
 * (globals.css의 `--frac-ext`/`--frac-nest` 절 — 짝으로 움직인다).
 *
 * ⚠ **팩토리인 이유(D13)**: KaTeX는 `macros` 객체를 **in-place 수정**한다 — 콘텐츠 속
 *   `\gdef`가 공유 상수를 오염시켜 문항 간에 정의가 새는 경로가 된다. 호출마다 새 객체를
 *   돌려주면 오염이 그 렌더 안에서 끝난다. **모듈 상수로 바꾸지 말 것.**
 * ⚠ `\cfrac`는 KaTeX 자체 strut가 있어 의도적으로 제외 · `\dbinom`은 `.mfrac`을 쓰므로
 *   괄호 안 좌우 여백이 살짝 생긴다(알고 두는 손실).
 * ⚠ 인라인 `$…$`에도 그대로 걸린다 — Mathory는 인라인에 `\displaystyle`을 자동 주입하는
 *   불변 원칙(CLAUDE.md 전처리 절, 덕수 2026-09-05) 위라 "인라인 제외" 갈래는 봉인이다.
 */
export function katexMacros(): Record<string, string> {
  return {
    '\\arraystretch': '1.8',   // 기존 값 — EditorPreview·PrintableContent 사본 2곳을 여기로 합쳤다
    '\\frac': '\\genfrac{}{}{}{}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}',
    '\\dfrac': '\\genfrac{}{}{}{0}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}',
    '\\tfrac': '\\genfrac{}{}{}{1}{#1\\vphantom{\\underline{#1}}}{#2\\vphantom{\\overline{#2}}}',
  };
}
