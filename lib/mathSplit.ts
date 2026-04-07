/**
 * 독립행 수식 분할 유틸리티
 *
 * 커서가 위치한 $$...$$ 영역을 찾아 \\로 구분된 행을 각각의 독립행 수식으로 분리.
 *
 * 차단 패턴: cases / dcases / rcases / matrix / pmatrix / bmatrix / vmatrix / Vmatrix
 *           / array / gathered / split — 이 환경 내부의 \\는 표/행렬 행 구분이므로 분할하면 의미가 깨짐.
 * 제거 대상: \begin{aligned} \end{aligned} \begin{align} \end{align} \begin{align*} \end{align*} 및 정렬용 &
 *           (단, 이스케이프된 \&는 보존)
 * \tag{...} 는 해당 행에 자연스럽게 붙어 보존됨.
 */

export interface DisplayMathRange {
  /** $$ 시작 인덱스 (포함) */
  from: number;
  /** $$ 종료 인덱스 (포함, 즉 두 번째 $$의 다음 위치) */
  to: number;
  /** $$ 사이의 본문 (양쪽 $$ 제외) */
  body: string;
}

/** 커서 위치를 감싸는 가장 가까운 $$...$$ 영역을 찾는다. 없으면 null. */
export function findEnclosingDisplayMath(content: string, cursor: number): DisplayMathRange | null {
  let i = 0;
  while (i < content.length) {
    if (content[i] === '$' && content[i + 1] === '$') {
      const start = i;
      const closeIdx = content.indexOf('$$', i + 2);
      if (closeIdx === -1) return null;
      const end = closeIdx + 2;
      if (cursor >= start && cursor <= end) {
        return { from: start, to: end, body: content.slice(start + 2, closeIdx) };
      }
      i = end;
      continue;
    }
    i++;
  }
  return null;
}

const BLOCKED_ENVS = /\\begin\{(cases|dcases|rcases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array|gathered|split)\*?\}/;

/** 본문에 분할 차단 환경이 포함되어 있는가? */
export function hasBlockedEnvironment(body: string): boolean {
  return BLOCKED_ENVS.test(body);
}

/**
 * $$..$$ 본문을 \\ 기준으로 분할하여 각 행의 LaTeX 문자열 배열을 반환.
 * - aligned/align/align* 환경 태그 제거
 * - 정렬용 & 제거 (이스케이프된 \&는 보존)
 * - \\[5pt] 같은 spacing 인자 허용
 * - 빈 행 제외
 * 결과 행이 2개 미만이면 빈 배열 반환 (분할 불필요).
 */
export function splitDisplayMathBody(body: string): string[] {
  // 환경 태그 제거
  let cleaned = body.replace(/\\begin\{(?:aligned|align\*?)\}/g, '');
  cleaned = cleaned.replace(/\\end\{(?:aligned|align\*?)\}/g, '');

  // \\ (옵션 [..] 포함) 으로 분할 — 단 \\\\는 \\로 escape된 케이스 거의 없음, 그대로 처리
  const parts = cleaned.split(/\\\\(?:\[[^\]]*\])?/);

  // 각 행에서 정렬용 & 제거 (이스케이프된 \&는 placeholder로 보존)
  const rows = parts.map((p) => {
    const ESC = '\u0000ESC_AMP\u0000';
    return p
      .replace(/\\&/g, ESC)
      .replace(/&/g, '')
      .replace(new RegExp(ESC, 'g'), '\\&')
      .trim();
  }).filter((s) => s.length > 0);

  if (rows.length < 2) return [];
  return rows;
}

/**
 * 분할 결과로부터 원본 $$..$$ 영역을 대체할 새 텍스트를 만든다.
 * 각 행을 `$$\n행\n$$` 형식의 독립행 수식으로, 빈 줄로 구분.
 */
export function buildSplitReplacement(rows: string[]): string {
  return rows.map((r) => `$$\n${r}\n$$`).join('\n\n');
}

/**
 * 통합 진입점.
 * @returns 새 content와 새 커서 위치, 또는 분할 불가 사유
 */
export function splitDisplayMathAtCursor(
  content: string,
  cursor: number
): { ok: true; newContent: string; newCursor: number } | { ok: false; reason: string } {
  const range = findEnclosingDisplayMath(content, cursor);
  if (!range) return { ok: false, reason: '커서가 독립행 수식($$...$$) 내부에 있지 않습니다.' };
  if (hasBlockedEnvironment(range.body)) {
    return { ok: false, reason: 'cases / matrix / array 환경이 포함된 수식은 분할할 수 없습니다.' };
  }
  const rows = splitDisplayMathBody(range.body);
  if (rows.length < 2) {
    return { ok: false, reason: '분할할 행이 2개 이상이어야 합니다.' };
  }
  const replacement = buildSplitReplacement(rows);
  const newContent = content.slice(0, range.from) + replacement + content.slice(range.to);
  const newCursor = range.from + replacement.length;
  return { ok: true, newContent, newCursor };
}
