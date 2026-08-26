/**
 * 독립행 수식 분할 유틸리티 (순수 함수)
 *
 * 커서가 위치한 `$$...$$` 영역을 찾아 `\\`로 구분된 행을 각각 **인라인 수식 한 줄**로 분리한다.
 * 결과 블록 조립(들여쓰기 블록 생성·앞뒤 블록 분리)은 `EditorView`가 한다 — 여기는 문자열만 만든다.
 *
 * ⚠️ import는 `lib/latexScan.ts`(역시 import 0) 하나뿐이다. `test:mathsplit`이 tsc로 단독
 *    컴파일하며 `--rootDir .`이 의존을 함께 잡는다(`locale.ts → caseBlock.ts` 선례).
 *
 * ── 출력 형태 (개선묶음 M1 · D1·D2) ──
 *   각 행은 `$…$` **인라인 수식**이다. 소스에서는 행을 붙여 쓰고(빈 줄 없음),
 *   행 분리는 렌더의 `insertMarkerLineBreaks`가 공급한다(연속된 수식 전용 행 사이에 빈 줄).
 *   ① 그 장치가 없으면 `remark-breaks` 부재로 세 행이 한 문단으로 합쳐진다(실측).
 *   ② 인라인 수식에도 `\displaystyle`이 자동 주입되므로 조판은 display와 같다.
 *   ③ 들여쓰기(callout) 블록의 `p { margin: 0 }`이 그 문단들을 "행간만"으로 그려 준다.
 *   ④ **`\tag{n}`은 `$…$` 밖으로 뺀다** — KaTeX는 인라인 모드에서 `\tag`를 거부하고,
 *      텍스트 행 꼬리의 `\tag{n}`은 `convertTextTags`가 `.tag-marker`로 그려 준다.
 *
 * 차단 환경: cases / dcases / rcases / matrix 계열 / gathered / split — 이 안의 `\\`는
 *   행렬·조건 구분이라 쪼개면 의미가 깨진다. **`array`는 차단하지 않는다**(M1 D4″) —
 *   다만 `\hline`이 있으면 표이므로 차단한다.
 */

import { readGroup, skipEnvArgs } from './latexScan';

export interface DisplayMathRange {
  /** $$ 시작 인덱스 (포함) */
  from: number;
  /** $$ 종료 인덱스 (포함, 즉 두 번째 $$의 다음 위치) */
  to: number;
  /** $$ 사이의 본문 (양쪽 $$ 제외) */
  body: string;
}

/**
 * 커서 위치를 감싸는 가장 가까운 $$...$$ 영역을 찾는다. 없으면 null.
 *
 * ⚠ 인라인 `$`·`\$`·코드펜스를 인지하지 못한다 — 알고 두는 한계다(M1 D22).
 *   고치려면 코어 재작성이라 이번 묶음에서는 **현 동작을 테스트로 고정만** 한다.
 */
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

const BLOCKED_ENVS = /\\begin\{(cases|dcases|rcases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|gathered|split)\*?\}/;

/** 본문에 분할 차단 환경이 포함되어 있는가? (array는 제외 — D4″) */
export function hasBlockedEnvironment(body: string): boolean {
  return BLOCKED_ENVS.test(body);
}

const BEGIN_ARRAY = '\\begin{array}';
const END_ARRAY = '\\end{array}';

/**
 * `\begin{array}{…}` / `\end{array}` 태그만 제거한다(내용은 그대로).
 *
 * ⚠️ 열 지정을 정규식으로 자르지 말 것 — `{|p{2cm}|l|}`에서 `\{[^}]*\}`는 `{|p{2cm}`까지만 먹고
 *    `|l|}`를 본문에 남긴다. 게다가 `\begin{array`가 이미 사라져 사후 검사도 발동하지 않는다(W2).
 *    `readGroup` 균형 스캔으로만 떼고, 해석에 실패하면 **분할하지 않는다**.
 */
function stripArrayEnvs(body: string): { body: string; reason?: string } {
  if (!body.includes(BEGIN_ARRAY)) return { body };
  let out = '';
  let i = 0;
  while (i < body.length) {
    if (body.startsWith(BEGIN_ARRAY, i)) {
      const after = skipEnvArgs(body, i + BEGIN_ARRAY.length);
      if (after === -1) {
        return { body, reason: 'array 열 지정을 해석하지 못해 분할하지 않았습니다.' };
      }
      i = after;
      continue;
    }
    if (body.startsWith(END_ARRAY, i)) { i += END_ARRAY.length; continue; }
    out += body[i];
    i++;
  }
  return { body: out };
}

/**
 * $$..$$ 본문을 `\\` 기준으로 분할하여 각 행의 LaTeX 문자열 배열을 반환.
 * - aligned/align/align* 환경 태그 제거
 * - 정렬용 & 제거 (이스케이프된 \& 는 보존)
 * - `\\[5pt]` 같은 spacing 인자 허용
 * - 빈 행 제외
 * 결과 행이 2개 미만이면 빈 배열 반환 (분할 불필요).
 */
export function splitDisplayMathBody(body: string): string[] {
  let cleaned = body.replace(/\\begin\{(?:aligned|align\*?)\}/g, '');
  cleaned = cleaned.replace(/\\end\{(?:aligned|align\*?)\}/g, '');

  const parts = cleaned.split(/\\\\(?:\[[^\]]*\])?/);

  const rows = parts.map((p) => {
    // 본문에 나타날 수 없는 NUL 센티널 — 평문 표지는 그 문자열이 본문에 있을 때 오염된다
    const ESC = '\u0000ESC_AMP\u0000';
    return p
      .replace(/\\&/g, ESC)
      .replace(/&/g, '')
      .split(ESC).join('\\&')
      .trim();
  }).filter((s) => s.length > 0);

  if (rows.length < 2) return [];
  return rows;
}

/** 한 행에서 `\tag{n}`을 떼어내 `$…$ \tag{n}` 형태로 만든다 (D2). */
function toRowMarkdown(row: string): { text: string; reason?: string } {
  const tags = row.match(/\\tag\{(\d+)\}/g) || [];
  if (tags.length > 1) {
    return { text: '', reason: '한 행에 \\tag가 둘 이상이라 분할하지 않았습니다.' };
  }
  if (tags.length === 0) return { text: `$${row}$` };
  const num = /\\tag\{(\d+)\}/.exec(tags[0])![1];
  const rest = row.replace(/\\tag\{\d+\}/, '').trim();
  if (!rest) return { text: '', reason: '\\tag만 있는 행은 분할할 수 없습니다.' };
  // 인라인 모드 \tag는 KaTeX 오류다 → 수식 밖 꼬리표로 뺀다(.tag-marker가 그린다)
  return { text: `$${rest}$ \\tag{${num}}` };
}

export interface RowSplit {
  /** $$ 앞의 원문 */
  before: string;
  /** `$…$` 또는 `$…$ \tag{n}` (D2) */
  rows: string[];
  /** $$ 뒤의 원문 */
  after: string;
}

/**
 * 통합 진입점 — 커서가 든 `$$…$$`를 행 단위 인라인 수식 배열로 쪼갠다.
 * 블록 조립은 호출부(`EditorView.handleSplitMathLines`)가 한다.
 */
export function splitDisplayMathToRows(
  content: string,
  cursor: number,
): ({ ok: true } & RowSplit) | { ok: false; reason: string } {
  const range = findEnclosingDisplayMath(content, cursor);
  if (!range) return { ok: false, reason: '커서가 독립행 수식($$...$$) 내부에 있지 않습니다.' };

  if (hasBlockedEnvironment(range.body)) {
    return { ok: false, reason: 'cases / matrix 환경이 포함된 수식은 분할할 수 없습니다.' };
  }
  // 표 형태의 array는 행이 표의 행이므로 쪼개면 의미가 깨진다
  if (range.body.includes(BEGIN_ARRAY) && /\\hline/.test(range.body)) {
    return { ok: false, reason: '표 형태의 array(\\hline)는 분할할 수 없습니다.' };
  }

  const stripped = stripArrayEnvs(range.body);
  if (stripped.reason) return { ok: false, reason: stripped.reason };

  const rawRows = splitDisplayMathBody(stripped.body);
  if (rawRows.length < 2) return { ok: false, reason: '분할할 행이 2개 이상이어야 합니다.' };

  const rows: string[] = [];
  for (const r of rawRows) {
    const md = toRowMarkdown(r);
    if (md.reason) return { ok: false, reason: md.reason };
    rows.push(md.text);
  }

  return {
    ok: true,
    before: content.slice(0, range.from),
    rows,
    after: content.slice(range.to),
  };
}
