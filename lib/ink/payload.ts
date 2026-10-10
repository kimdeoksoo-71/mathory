/**
 * Phase 69 — 필기 OCR 결과 → 확인 카드 초깃값 → 편집창 삽입 문자열. 순수 모듈(**import 0** · `npm run test:ink`).
 *
 * ① `composeInkText` — Mathpix `latex_styled`는 "이미지 전체가 식 하나로 환원될 때만" 온다(공식 문서) → 단일 식 여부를
 *    텍스트 모양으로 추측하지 않고 Mathpix 판정을 쓴다. 데스크톱은 이 결과를 `normalizeAndFix`(lib/ocr)에 넣어 카드 초깃값으로.
 * ② `shapeInkPayload` — 카드 편집본을 커서 자리에 넣을 모양. 인접 `$` 공백 규약(M7 D1·D4 — micromark는 `$a$$b$`를 수식
 *    하나로 읽는다)과 "커서가 수식 안이면 구분자를 벗긴다"(계획서 P20).
 */

/** Mathpix 결과 → 카드 초깃값 원재료. 행 바꿈(`\\`)·환경(`\begin{`)이 있으면 펜스형 블록, 아니면 인라인 */
export function composeInkText(o: { ocrLatex?: string | null; ocrText?: string | null }): string {
  const latex = (o.ocrLatex ?? '').trim();
  if (latex) {
    return /\\\\|\\begin\{/.test(latex) ? `$$\n${latex}\n$$` : '$' + latex + '$';
  }
  return (o.ocrText ?? '').trim();
}

const INLINE_RE = /^\$[^$\n]+\$$/;
const FENCED_RE = /^\$\$\n([\s\S]*)\n\$\$$/;

/** 문자열 전체가 수식 하나(인라인 `$…$` 또는 펜스형 `$$\n…\n$$`)면 그 안쪽, 아니면 null */
export function singleMathInner(text: string): string | null {
  const t = text.trim();
  if (INLINE_RE.test(t)) return t.slice(1, -1);
  const m = FENCED_RE.exec(t);
  return m ? m[1].trim() : null;
}

export interface ShapeCtx {
  /** 삽입 지점 바로 앞 글자(선택이 비었을 때만 — 선택 대체는 사용자가 범위를 골랐으므로 보정하지 않는다) */
  prev?: string;
  /** 삽입 지점 바로 뒤 글자(같은 조건) */
  next?: string;
  /** 삽입 지점이 수식 안인가(`probeInsertionRegion`) */
  inMath: boolean;
}

/**
 * 삽입 모양:
 *  1. 빈 문자열 → ''
 *  2. 수식 안 + 수식 하나뿐 → 구분자를 벗긴 안쪽(그 밖은 그대로 — 카드가 경고)
 *  3. 밖 + 한 줄 인라인 하나 → 그대로 + 앞 글자가 글자·숫자·`$`면 앞 공백 1 · 뒤 글자가 `$`면 뒤 공백 1
 *     (뒤는 `$`일 때만 — 조사가 바로 붙는 `$x$는`을 깨지 않는다)
 *  4. 그 밖(블록·여러 줄·문장 섞임) → OCR 삽입과 같은 `\n…\n`
 */
export function shapeInkPayload(text: string, ctx: ShapeCtx): string {
  const t = text.trim();
  if (!t) return '';
  if (ctx.inMath) {
    const inner = singleMathInner(t);
    return inner ?? t;
  }
  if (INLINE_RE.test(t)) {
    const lead = ctx.prev !== undefined && /[\p{L}\p{N}$]/u.test(ctx.prev) ? ' ' : '';
    const trail = ctx.next === '$' ? ' ' : '';
    return lead + t + trail;
  }
  return `\n${t}\n`;
}
