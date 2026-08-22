/**
 * Phase 61a — audition 스프레드시트 행 → Mathory 문항 초안 변환.
 *
 * ⚠️ 이 파일에 **import 문을 두지 말 것.**
 *    `npm run test:sheet`가 이 파일 하나만 tsc로 단독 컴파일한다(package.json).
 *    타입이 필요하면 여기에 로컬로 정의한다 — types/problem.ts를 import하면 하니스가 깨진다.
 *
 * ⚠️ `$$` 앞뒤 빈 줄 정규화는 여기서 하지 않는다 — `lib/blocks/normalize.ts`의
 *    `toPersistedBlock`이 소유한다(계획서 Y1). 두 곳에서 하면 규칙이 갈린다.
 */

/* ═══ 열 매핑 ═══
 * 진실 원천은 **열 위치**다(계획서 D2). GAS(gas-project-audition)가 전부 위치
 * 하드코딩이라 시트의 열은 움직일 수 없다 — 중간에 열을 끼우면 GAS가 먼저 깨진다.
 * 헤더 이름은 "시트가 바뀌었다"는 조기 경보로만 쓴다(checkHeaders).
 * 0-based, `A1:P`(16열) 기준. */
export const SHEET_COL = {
  id: 0,             // A  문항 제목 + source + 중복검사 키
  given_solution: 2, // C  풀이
  given_answer: 3,   // D  공식 정답
  problem_stem: 4,   // E  문제 본문
  choice1: 5,        // F
  choice2: 6,        // G
  choice3: 7,        // H
  choice4: 8,        // I
  choice5: 9,        // J
  get: 12,           // M  사전 선별 체크박스 (내용으로 가져오지 않는다)
  derived_answer: 14,// O  AI가 구한 답
  solution_note: 15, // P  AI가 쓴 풀이
} as const;

/** `A1:P` = 16열. Sheets는 행 끝의 빈 셀을 잘라 보내므로 항상 이 길이로 패딩해야 한다. */
export const SHEET_COL_COUNT = 16;

/** 1행 헤더의 기대 라벨. 2026-08-22 실측으로 확정 — Data_DS·Stack이 **동일**했다.
 *  ⚠️ `sloution_note`는 시트 원문의 오타를 그대로 옮긴 것이다(고치지 말 것). */
export const EXPECTED_HEADERS: Partial<Record<keyof typeof SHEET_COL, string>> = {
  id: 'id',
  given_solution: 'given_solution',
  given_answer: 'given_answer',
  problem_stem: 'problem_stem',
  choice1: 'choice1',
  choice2: 'choice2',
  choice3: 'choice3',
  choice4: 'choice4',
  choice5: 'choice5',
  get: 'get',
  derived_answer: 'derived_answer',
  solution_note: 'sloution_note',
};

/** 선택지 라벨. `ChoicesBlock.parseChoices`가 이 5개만 인식한다. */
const CHOICE_LABELS = ['①', '②', '③', '④', '⑤'];
const CHOICE_KEYS = ['choice1', 'choice2', 'choice3', 'choice4', 'choice5'] as const;

/* ═══ 타입 ═══ */

export interface ImportRow {
  /** 시트의 실제 행 번호(헤더가 1행이므로 데이터는 2부터) */
  rowIndex: number;
  /** 길이 16 보장 */
  cells: string[];
}

/** 순서는 배열 인덱스가 소유한다 — `order` 필드를 두지 않는다(계획서 Y3). */
export interface DraftBlock {
  type: 'text' | 'choices';
  raw_text: string;
}

export interface DraftTab {
  id: string;
  label: string;
}

export interface ProblemDraft {
  rowIndex: number;
  /** A열. 제목·source를 겸한다 */
  sourceId: string;
  /** 정규화된 E열(문제 본문)의 해시. **중복 판정은 `sourceId`와 이 값을 함께 본다.**
   *  실측(2026-08-22): Stack에 id가 같은데 본문이 다른 그룹이 67개 있었다 —
   *  id만으로 판정하면 서로 다른 문항을 "이미 가져옴"으로 조용히 건너뛴다. */
  stemHash: string;
  title: string;
  source: string;
  answer: string;
  tabs: DraftTab[];
  blocksByTab: Record<string, DraftBlock[]>;
  warnings: string[];
}

export interface DraftError {
  rowIndex: number;
  error: string;
}

export function isDraftError(x: ProblemDraft | DraftError): x is DraftError {
  return typeof (x as DraftError).error === 'string';
}

/* ═══ 행 범위 파서 ═══ */

/**
 * GAS `normalizeProblem.gs:36-52`의 `parseRowInput_`과 **동일 의미론**.
 * `,` 분리 → `a-b`는 min..max(역순도 흡수) → 정수만 → 중복 제거 → 오름차순.
 * 시트 실제 행 번호를 반환한다(데이터는 2행부터).
 */
export function parseRowInput(text: string): number[] {
  const set = new Set<number>();
  for (const part of String(text ?? '').split(',')) {
    const s = part.trim();
    if (!s) continue;
    if (s.includes('-')) {
      const [a, b] = s.split('-').map((v) => Number(String(v).trim()));
      if (Number.isInteger(a) && Number.isInteger(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
      }
    } else {
      const n = Number(s);
      if (Number.isInteger(n)) set.add(n);
    }
  }
  return Array.from(set).sort((x, y) => x - y);
}

/* ═══ 헤더 대조 (D2 — 경고만, 가져오기는 막지 않는다) ═══ */

export function checkHeaders(headerRow: string[]): string[] {
  const warnings: string[] = [];
  for (const key of Object.keys(EXPECTED_HEADERS) as (keyof typeof SHEET_COL)[]) {
    const expected = EXPECTED_HEADERS[key];
    if (!expected) continue;                       // 기대값 미확정 키는 통과 (계획서 Y5)
    const actual = (headerRow[SHEET_COL[key]] ?? '').trim();
    if (actual !== expected) {
      const letter = String.fromCharCode(65 + SHEET_COL[key]);
      warnings.push(`${letter}열 헤더가 "${expected}"가 아니라 "${actual}"입니다 — 시트 구조가 바뀌었을 수 있습니다`);
    }
  }
  return warnings;
}

/* ═══ 텍스트 정규화 (최소주의) ═══ */

/**
 * 시트 텍스트 → Mathory 표기. **고치는 것은 수식 구분자뿐이다.**
 * (가)·ㄱ.·① 같은 마커는 리터럴 보존이 규약이므로 건드리지 않는다(CLAUDE.md).
 */
export function normalizeText(raw: string): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let t = String(raw ?? '').replace(/\r\n?/g, '\n');

  // ⚠️ 뒤돌아보기 `(?<!\\)`가 없으면 `\\[6pt]`(행렬 행간 관용구)가 `\\$$6pt]`로 깨진다.
  t = t
    .replace(/(?<!\\)\\\[/g, '$$$$')   // \[ → $$   ($$ 는 replace 치환문에서 $$$$)
    .replace(/(?<!\\)\\\]/g, '$$$$')   // \] → $$
    .replace(/(?<!\\)\\\(/g, '$')      // \( → $
    .replace(/(?<!\\)\\\)/g, '$');     // \) → $

  t = t.replace(/\n{3,}/g, '\n\n').trim();

  // 이상 징후는 고치지 말고 알리기만 한다
  const dollars = (t.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 === 1) warnings.push('수식 구분자 `$` 개수가 홀수입니다 — 수식이 깨져 보일 수 있습니다');

  return { text: t, warnings };
}

/* ═══ 본문 해시 ═══ */

/**
 * 중복 판정 보조 키. **암호학적 해시가 아니다** — 내용이 바뀌었는지만 가린다.
 * `node:crypto`를 쓸 수 없어(이 파일은 import 0) cyrb53 계열을 직접 둔다.
 * 53비트라 수만 건 규모에서 충돌 확률이 무시할 수준이다.
 */
export function stemHash(text: string): string {
  const str = String(text ?? '');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/* ═══ 행 → 초안 ═══ */

const cell = (row: ImportRow, key: keyof typeof SHEET_COL): string =>
  (row.cells[SHEET_COL[key]] ?? '').trim();

export function rowToDraft(row: ImportRow): ProblemDraft | DraftError {
  const sourceId = cell(row, 'id');
  if (!sourceId) {
    return { rowIndex: row.rowIndex, error: 'A열(id)이 비어 있어 제목도 중복검사 키도 만들 수 없습니다' };
  }

  const warnings: string[] = [];
  const take = (key: keyof typeof SHEET_COL) => {
    const { text, warnings: w } = normalizeText(cell(row, key));
    const letter = String.fromCharCode(65 + SHEET_COL[key]);
    for (const m of w) warnings.push(`${letter}열: ${m}`);
    return text;
  };

  /* ── 문제 탭 ── */
  const stem = take('problem_stem');
  if (!stem) warnings.push('E열(문제 본문)이 비어 있습니다');
  const questionBlocks: DraftBlock[] = [{ type: 'text', raw_text: stem }];

  const choices = CHOICE_KEYS.map((k) => take(k));
  const filled = choices.map((c, i) => ({ label: CHOICE_LABELS[i], content: c, index: i }))
                        .filter((c) => c.content !== '');
  if (filled.length > 0) {
    // 빈 선택지는 줄 자체를 생략한다 — parseChoices가 내용 없는 줄을 건너뛰는 규격과 일치.
    questionBlocks.push({
      type: 'choices',
      raw_text: filled.map((c) => `${c.label} ${c.content}`).join('\n'),
    });
    // ⚠️ 중간이 비어 라벨이 건너뛰면(①③④) ChoicesBlock은 **개수** 기준으로 배치하므로
    //    화면에서 ①과 ③이 이웃한다. 데이터 이상 신호이므로 알린다.
    const lastIndex = filled[filled.length - 1].index;
    if (filled.length !== lastIndex + 1) {
      warnings.push(`선택지 중간이 비어 라벨이 건너뜁니다(${filled.map((c) => c.label).join('')}) — 시트를 확인하세요`);
    }
  }

  /* ── 풀이 탭 ── (비어도 빈 text 블록 1개 — AppShell 신규 문항 관례) */
  const solution = take('given_solution');
  if (!solution) warnings.push('C열(풀이)이 비어 있습니다');
  const solutionBlocks: DraftBlock[] = [{ type: 'text', raw_text: solution }];

  /* ── AI풀이 탭 ── (O·P 중 하나라도 있을 때만) */
  const derived = take('derived_answer');
  const note = take('solution_note');
  const aiBlocks: DraftBlock[] = [];
  // D10: O열 앞에만 고정 접두를 붙인다. §"친절한 가공 금지"의 유일한 예외.
  if (derived) aiBlocks.push({ type: 'text', raw_text: `**AI 정답:** ${derived}` });
  if (note) aiBlocks.push({ type: 'text', raw_text: note });

  const tabs: DraftTab[] = [
    { id: 'question', label: '문제' },
    { id: 'solution', label: '풀이' },
  ];
  const blocksByTab: Record<string, DraftBlock[]> = {
    question: questionBlocks,
    solution: solutionBlocks,
  };
  if (aiBlocks.length > 0) {
    tabs.push({ id: 'extra_0', label: 'AI풀이' });
    blocksByTab.extra_0 = aiBlocks;
  }

  const answer = cell(row, 'given_answer');

  return {
    rowIndex: row.rowIndex,
    sourceId,
    stemHash: stemHash(stem),      // 정규화된 본문 기준 — 공백·CRLF 차이로 갈리지 않는다
    title: sourceId,
    source: sourceId,      // D4 — A열은 문자 그대로 "문제 출처"다
    answer,
    tabs,
    blocksByTab,
    warnings,
  };
}
