/* ═══════════════════════════════════════════════════════════════
   원본 raw_text에서 수식 구간을 인덱싱한다 (출현 순서).

   Phase 56에서 EditorView 로컬 함수로 만들었으나, Phase 58 P3의 "핵심문장" 토글이
   수식 경계 가드에 같은 인덱스를 필요로 해 lib으로 추출했다.
   두 벌로 나뉘면 미리보기 하이라이트와 토글 가드가 서로 다른 수식 경계를 보게 된다.
   ═══════════════════════════════════════════════════════════════ */

export interface MathRange { from: number; to: number; }

/**
 * `$$…$$` · `$…$` · `\[…\]` · `\(…\)` 네 형태를 훑어 {from, to} 배열을 만든다.
 * to는 닫는 구분자 다음 위치(배타적)다.
 *
 * 인라인 `$…$`는 빈 줄을 만나면 미종료로 보고 포기한다 — 문단을 넘어가는 `$`는
 * 대부분 수식이 아니라 통화 기호 등이기 때문이다.
 */
export function buildMathIndex(content: string): MathRange[] {
  const ranges: MathRange[] = [];
  let i = 0;
  while (i < content.length) {
    // $$ 블록 수식
    if (content[i] === '$' && content[i + 1] === '$') {
      const start = i;
      const closeIdx = content.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    // $ 인라인 수식
    if (content[i] === '$' && content[i + 1] !== '$') {
      const start = i;
      let j = i + 1;
      let found = false;
      while (j < content.length) {
        if (content[j] === '$' && content[j - 1] !== '\\') {
          ranges.push({ from: start, to: j + 1 });
          i = j + 1;
          found = true;
          break;
        }
        if (content[j] === '\n' && j + 1 < content.length && content[j + 1] === '\n') break;
        j++;
      }
      if (!found) i = start + 1;
      continue;
    }
    // \[...\]
    if (content[i] === '\\' && content[i + 1] === '[') {
      const start = i;
      const closeIdx = content.indexOf('\\]', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    // \(...\)
    if (content[i] === '\\' && content[i + 1] === '(') {
      const start = i;
      const closeIdx = content.indexOf('\\)', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

/** 커서가 놓인 수식의 인덱스. 없으면 -1. 경계(from·to)도 포함으로 본다. */
export function findMathIdAtCursor(ranges: MathRange[], cursor: number): number {
  for (let idx = 0; idx < ranges.length; idx++) {
    if (cursor >= ranges[idx].from && cursor <= ranges[idx].to) return idx;
  }
  return -1;
}

/**
 * 위치 pos가 어느 수식의 **내부**(구분자 안쪽)에 있는가.
 * 경계에 딱 붙은 위치(from 또는 to)는 "바깥"으로 본다 — `$…$`를 통째로 감싸는
 * 선택은 허용해야 하기 때문이다 (Phase 58 P3 수식 경계 가드).
 *
 * ⚠ lib/latex-completions.ts에도 같은 이름의 isInsideMath(doc, pos)가 있다.
 *   그쪽은 `$`/`$$`만 토글 추적하는 자동완성용이고 `\[…\]`·`\(…\)`를 모른다.
 *   이 함수는 buildMathIndex 결과를 쓰므로 미리보기 하이라이트와 정확히 같은
 *   수식 경계를 본다 — 이름으로 구분해 둔다.
 */
export function isInsideMathRange(ranges: MathRange[], pos: number): boolean {
  return ranges.some((r) => pos > r.from && pos < r.to);
}

/** [from, to) 선택이 블록 수식(`$$…$$` / `\[…\]`) 구간을 걸치는가. */
export function crossesDisplayMath(content: string, ranges: MathRange[], from: number, to: number): boolean {
  return ranges.some((r) => {
    const isDisplay = content.startsWith('$$', r.from) || content.startsWith('\\[', r.from);
    if (!isDisplay) return false;
    const overlaps = from < r.to && to > r.from;
    const contains = from <= r.from && to >= r.to;
    return overlaps && !contains;   // 완전히 포함하는 것도 아래 규칙에서 따로 막는다
  });
}

/** [from, to) 선택이 블록 수식을 통째로 품고 있는가. */
export function containsDisplayMath(content: string, ranges: MathRange[], from: number, to: number): boolean {
  return ranges.some((r) => {
    const isDisplay = content.startsWith('$$', r.from) || content.startsWith('\\[', r.from);
    return isDisplay && from <= r.from && to >= r.to;
  });
}
