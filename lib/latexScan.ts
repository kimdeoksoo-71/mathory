/**
 * LaTeX 문자열 스캔 보조 (순수 함수, import 0)
 *
 * ⚠️ 이 파일에 import를 두지 말 것 — `test:mathsplit`·`test:proofread`가 tsc로 단독 컴파일한다
 *    (의존은 `--rootDir .`로 함께 잡힌다, `locale.ts → caseBlock.ts` 선례).
 *
 * ── 이 파일이 존재하는 이유 (개선묶음 M1 · W2) ──
 * `\begin{array}{|p{2cm}|l|}`의 열 지정은 **중첩 중괄호**를 갖는다. `\{[^}]*\}` 같은 정규식은
 * `\begin{array}{|p{2cm}` 까지만 먹고 `|l|}` 를 본문에 남긴다(실측) — 게다가 `\begin{array`가
 * 이미 사라져서 "잔재가 있으면 실패" 같은 사후 검사도 발동하지 않는다.
 * 그래서 열 지정은 **균형 스캔**으로만 떼어낸다. `tabular`의 `{spec}`도 같은 문제라 공용이다.
 */

/**
 * `text[openIdx]`가 `{`라고 가정하고 짝이 맞는 `}`의 인덱스를 돌려준다. 못 찾으면 -1.
 * 이스케이프된 `\{` `\}`는 세지 않는다.
 */
export function readGroup(text: string, openIdx: number): number {
  if (text[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }        // \{ · \} · 그 밖의 제어열 한 글자 건너뛰기
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * `\begin{<env>}` 뒤에 붙는 **선택 인자 `[...]`와 필수 인자 `{...}`** 를 지나 그 끝 인덱스를 돌려준다.
 * (인자가 없으면 `afterBegin` 그대로. 균형이 깨지면 -1.)
 *
 * @param afterBegin `\begin{env}` 바로 다음 인덱스
 */
export function skipEnvArgs(text: string, afterBegin: number): number {
  let i = afterBegin;
  if (text[i] === '[') {
    const close = text.indexOf(']', i + 1);
    if (close === -1) return -1;
    i = close + 1;
  }
  if (text[i] === '{') {
    const close = readGroup(text, i);
    if (close === -1) return -1;
    i = close + 1;
  }
  return i;
}
