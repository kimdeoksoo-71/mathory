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
  /** B  정규화 **전** 문제 원문. 본문으로 쓰지 않고 **그림 파일명 복구에만** 쓴다(Phase 61e D13).
   *  GAS `normalizeProblem`이 선택지 뒤 `\includegraphics`를 trailer로 잘라내면 E에서 사라지는데
   *  B에는 남아 있다(실측: Data_DS 1공통13). */
  problem: 1,
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
  problem: 'problem',        // Phase 61e Z4 — 실측 확정(2026-08-30)
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
  type: 'text' | 'choices' | 'image';
  /** image 블록은 **저장 직전까지 빈 문자열**이다 — Storage URL이 그때 정해진다.
   *  미리보기는 blob URL을, 저장본은 Storage URL을 넣는다(Y1의 유일한 예외). */
  raw_text: string;
  /** image 전용. Drive `IMAGE_FIG` 폴더의 파일명(`<stem>_figN.<ext>`). */
  figName?: string;
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

/* ═══ 그림 분할 (Phase 61e · 61e-2차) ═══ */

/**
 * Drive `IMAGE_FIG`의 허용 파일명. **클라 게이트와 서버 게이트가 이 하나를 공유한다**(61e-2차 D32).
 * `app/api/sheet-import/figure/route.ts`가 이 상수를 import한다 —
 * ⚠️ "import 0" 규약은 **이 파일이 남을 import하지 않는다**는 뜻이라 저촉되지 않는다.
 *
 * ⚠️ `'`를 문자 집합에서 **배제**한다 → Drive 검색 `q`의 작은따옴표 이스케이프가 아예 불필요해진다.
 *    NFC 정규화로는 `'`가 새로 생기지 않으므로 그 방어는 정규화 뒤에도 유지된다.
 */
export const FIG_NAME_RE =
  /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ()._\-]{1,200}_fig\d+\.(jpe?g|png|gif|webp)$/;

/**
 * 그림 경계 **두 형식**을 한 벌로 훑는다.
 *
 *   구형: `\includegraphics[opt]{파일명}`          (61e까지의 유일한 형식)
 *   신형: `![파일명](https://drive.google.com/…)`  (GAS 패치 11, 2026-09-01)
 *
 * m[1] = 구형 이름 / m[2] = alt / m[3] = Drive 링크.
 *
 * ⚠ **교대(alternation) 한 벌**이어야 한다 — 두 정규식을 따로 돌려 병합하면 등장 순서를
 *   손으로 맞춰야 하고, 한 셀에 두 형식이 섞인 행(패치 11이 링크를 못 찾아 태그를 남긴 행)에서
 *   블록 순서가 어긋난다.
 * ⚠ 호스트를 `drive.google.com`으로 좁힌 것은 의도다(D33) — GAS `iv_collectFigRefs_`의
 *   `reLink`와 문자 그대로 같다. 모르는 형식은 **오늘 동작**(텍스트 유지 + 경고)으로 떨어진다.
 * ⚠ `[ \t]*`다 — `\s*`는 개행을 삼킨다(CLAUDE.md). `](` 뒤 공백을 허용하지 않으면
 *   `]( https://… )` 같은 링크가 **분할도 경고도 없이 침묵**한다.
 * ⚠ 중괄호를 정규식으로 자르는 것은 개선묶음 M1 W2의 예외가 아니라 **적용 대상이 아니다** —
 *   GAS가 만드는 이름은 `<stem>_figN.<ext>`뿐이라 중괄호가 들어갈 수 없다.
 */
const FIG_SCAN_RE =
  /\\includegraphics[ \t]*(?:\[[^\]\n]*\])?\{([^}\n]+)\}|!\[([^\]\n]*)\]\([ \t]*(https:\/\/drive\.google\.com\/[^)\s]+)[ \t]*\)/;

/** Drive가 **아닌** 이미지 링크. 패치 3이 안 돈 Mathpix 잔재다 — 경계로 삼지 않고 경고만 낸다(61e D21).
 *  ⚠ Drive 링크를 lookahead로 빼지 않으면 정상적인 신형식마다 이 경고가 덧난다. */
const FOREIGN_IMG_RE =
  /!\[[^\]\n]*\]\(\s*(?!https:\/\/drive\.google\.com\/)https?:\/\/[^)\s]+\s*\)/;

interface FigMatch {
  index: number;
  length: number;
  /** 시트 원문 그대로의 파일명. **정규형을 바꾸지 않는다** — 정규형 시도는 프록시 몫이다(D29). */
  name: string;
}

/**
 * 본문에서 그림 참조를 등장 순서대로 뽑는다. `splitFigures`·`scanFigureNames`·경고 판정이 공유한다.
 *
 * - 구형 태그는 **게이트하지 않는다**(61e 동작 보존).
 * - 신형 링크는 alt가 `FIG_NAME_RE` 규격일 때만 경계로 삼고, 아니면 경고만 낸다(D24·D34).
 *   ⚠ **게이트 판정에만 NFC를 쓴다.** 원문 그대로 검사하면 NFD 한글 alt가 규격 외로 떨어져
 *     분할 자체가 안 된다(NFD 한글은 U+1100 계열 자모라 `[가-힣]`에 안 걸린다).
 */
function scanFigMatches(text: string): { figs: FigMatch[]; warnings: string[] } {
  const re = new RegExp(FIG_SCAN_RE.source, 'g');
  const figs: FigMatch[] = [];
  const warnings: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    if (m[1] !== undefined) {
      figs.push({ index: m.index, length: m[0].length, name: m[1].trim() });
      continue;
    }
    const alt = (m[2] ?? '').trim();
    if (!FIG_NAME_RE.test(alt.normalize('NFC'))) {
      warnings.push(`그림 링크의 파일명이 규격과 다릅니다(${alt || '이름 없음'}) — 본문에 그대로 둡니다`);
      continue;
    }
    figs.push({ index: m.index, length: m[0].length, name: alt });
  }
  return { figs, warnings };
}

/**
 * 본문을 그림 경계로 조각내 text/image 블록 배열을 만든다.
 *
 * - **그림이 하나도 없으면 원문 그대로 text 블록 1개**를 돌려준다(빈 문자열이어도).
 *   61a의 기존 동작과 비트 단위로 같아야 하므로 이 갈래를 없애지 말 것.
 * - 빈/공백뿐인 텍스트 조각은 버린다 — 순서는 배열 인덱스가 소유한다(Y3).
 */
export function splitFigures(text: string): {
  blocks: DraftBlock[]; figNames: string[]; warnings: string[];
} {
  const { figs, warnings } = scanFigMatches(text);
  if (FOREIGN_IMG_RE.test(text)) {
    warnings.push('변환되지 않은 Mathpix 이미지 링크가 있습니다 — 외부 링크로 표시됩니다');
  }

  const blocks: DraftBlock[] = [];
  const figNames: string[] = [];
  let last = 0;
  for (const f of figs) {
    const before = text.slice(last, f.index).trim();
    if (before) blocks.push({ type: 'text', raw_text: before });
    blocks.push({ type: 'image', raw_text: '', figName: f.name });
    figNames.push(f.name);
    last = f.index + f.length;
  }

  if (figNames.length === 0) return { blocks: [{ type: 'text', raw_text: text }], figNames, warnings };

  const tail = text.slice(last).trim();
  if (tail) blocks.push({ type: 'text', raw_text: tail });
  return { blocks, figNames, warnings };
}

/** 텍스트에 든 그림 파일명만 뽑는다(블록으로 쪼개지 않는다). B열 복구용.
 *  ⚠ B는 **정규화 전 원문**이라 패치 11 형식이 반드시 온다 — 통합 스캔을 쓰는 이유다. */
export function scanFigureNames(text: string): string[] {
  return scanFigMatches(String(text ?? '')).figs.map((f) => f.name);
}

/** 텍스트에 그림 참조가 있나 — 분할하지 않는 자리(선택지·O열)의 경고 판정용.
 *  ⚠ `rowToDraft` 안에 동명의 지역 상수가 있어 이름을 달리한다. */
function containsFigure(text: string): boolean {
  return scanFigMatches(text).figs.length > 0;
}

/* ═══ 선택지 라벨 ═══ */

/**
 * 셀 앞머리의 원문자 라벨을 떼어낸다.
 *
 * 시트의 F~J는 **원문자를 포함한 셀과 포함하지 않은 셀이 섞여 있다**
 * (실측 2026-08-22 Stack: 라벨 있음 502행 / 없음 2,238행 / 섞인 행 0).
 * `ChoicesBlock`은 `raw_text` 맨 앞의 원문자를 라벨로 읽어 별도 span으로 그리므로,
 * 라벨이 든 셀에 위치 라벨을 덧붙이면 화면에 **라벨이 두 번** 나온다(`① ① 39`).
 *
 * 실측에서 셀의 라벨이 열 위치와 어긋난 행은 **0건**이라 떼어내도 정보 손실이 없다.
 * 라벨만 있고 내용이 없는 셀은 건드리지 않는다(빈 선택지로 떨어져 줄이 사라지는 것을 막는다).
 *
 * ⚠️ `[ \t]*`를 쓴다 — `\s*`는 개행을 포함해 여러 줄짜리 선택지의 다음 줄을 빨아들인다.
 */
export function stripChoiceLabel(text: string): string {
  const m = /^[①②③④⑤][ \t]*([\s\S]*)$/.exec(text);
  return m && m[1].trim() !== '' ? m[1] : text;
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
  // ⚠ `stemHash`는 **분할 전** 값이다(아래 반환문). 분할·자동 수정이 앞서면 가져오기 옵션에 따라
  //   중복 키가 바뀌어 같은 문항이 두 벌 저장된다(Phase 61e N-4).
  const stemSplit = splitFigures(stem);
  warnings.push(...stemSplit.warnings.map((w) => `E열: ${w}`));
  const questionBlocks: DraftBlock[] = [...stemSplit.blocks];

  const choices = CHOICE_KEYS.map((k) => stripChoiceLabel(take(k)));
  const filled = choices.map((c, i) => ({ label: CHOICE_LABELS[i], content: c, index: i }))
                        .filter((c) => c.content !== '');
  if (filled.length > 0) {
    // 빈 선택지는 줄 자체를 생략한다 — parseChoices가 내용 없는 줄을 건너뛰는 규격과 일치.
    const choicesText = filled.map((c) => `${c.label} ${c.content}`).join('\n');
    questionBlocks.push({ type: 'choices', raw_text: choicesText });
    // ⚠️ 중간이 비어 라벨이 건너뛰면(①③④) ChoicesBlock은 **개수** 기준으로 배치하므로
    //    화면에서 ①과 ③이 이웃한다. 데이터 이상 신호이므로 알린다.
    const lastIndex = filled[filled.length - 1].index;
    if (filled.length !== lastIndex + 1) {
      warnings.push(`선택지 중간이 비어 라벨이 건너뜁니다(${filled.map((c) => c.label).join('')}) — 시트를 확인하세요`);
    }
    // Phase 61e D3′ — 선택지 **셀 안** 그림은 실측 0건이라 인라인 처리를 만들지 않았다.
    //   나타나면 문자열 그대로 남으므로(자동 수정도 호출부가 끈다) 알리고 사람에게 넘긴다.
    if (containsFigure(choicesText)) {
      warnings.push('선택지 안에 그림이 있습니다 — 편집창에서 손봐야 합니다');
    }
  }

  /* ── B열 그림 복구 (D13) ──
     GAS `normalizeProblem`이 선택지 뒤 `\includegraphics`를 trailer로 잘라내면 E에서 사라진다.
     정규화 전 원문인 B에는 남아 있으므로, E에 없는 이름만 문제 탭 **맨 끝**에 붙인다.
     ⚠ B를 본문으로 쓰지는 않는다 — 정규화 이전 텍스트라 표기가 E와 다르다. */
  //  ⚠ 대조 키는 **NFC**다 — B는 원문, E는 정규화본이라 정규형이 갈릴 수 있다(61e-2차 C10).
  //    블록에 담는 `figName`은 원문 그대로 둔다.
  const inQuestion = new Set(stemSplit.figNames.map((n) => n.normalize('NFC')));
  const recovered: string[] = [];
  for (const name of scanFigureNames(cell(row, 'problem'))) {
    const key = name.normalize('NFC');
    if (inQuestion.has(key)) continue;
    inQuestion.add(key);                        // B 안의 중복도 한 번만
    recovered.push(name);
    questionBlocks.push({ type: 'image', raw_text: '', figName: name });
  }
  if (recovered.length > 0) {
    warnings.push(`E열에서 사라진 그림 ${recovered.length}개를 B열에서 복구했습니다`);
  }

  // N-8 — 문제 탭에 텍스트 블록이 하나도 없으면 정밀 검증이 `empty_question`으로 사전 차단된다.
  // ⚠ **그림이 있을 때만** 울린다 — E가 통째로 비었을 때는 위의 'E열이 비어 있습니다'가 이미 말했고,
  //   둘 다 내면 같은 사실을 두 번 알리면서 원인을 흐린다.
  const hasFigure = questionBlocks.some((b) => b.type === 'image');
  const hasBody = questionBlocks.some((b) => b.type !== 'image' && b.raw_text.trim());
  if (hasFigure && !hasBody) {
    warnings.push('문제 본문이 그림뿐입니다 — 정밀 검증이 차단됩니다');
  }

  /* ── 풀이 탭 ── (비어도 빈 text 블록 1개 — AppShell 신규 문항 관례) */
  const solution = take('given_solution');
  if (!solution) warnings.push('C열(풀이)이 비어 있습니다');
  const solSplit = splitFigures(solution);
  warnings.push(...solSplit.warnings.map((w) => `C열: ${w}`));
  const solutionBlocks: DraftBlock[] = [...solSplit.blocks];

  /* ── AI풀이 탭 ── (O·P 중 하나라도 있을 때만) */
  const derived = take('derived_answer');
  const note = take('solution_note');
  const aiBlocks: DraftBlock[] = [];
  // D10: O열 앞에만 고정 접두를 붙인다. §"친절한 가공 금지"의 유일한 예외.
  // ⚠ O는 **분할하지 않는다** — 정답 값 한 줄이고 고정 접두가 붙어 조각내면 접두가 떨어져 나간다.
  //   그림이 들어 있으면(사실상 없다) 알리기만 한다.
  if (derived) {
    if (containsFigure(derived)) warnings.push('O열(AI 정답)에 그림이 있습니다 — 문자열 그대로 들어갑니다');
    aiBlocks.push({ type: 'text', raw_text: `**AI 정답:** ${derived}` });
  }
  if (note) {
    const noteSplit = splitFigures(note);
    warnings.push(...noteSplit.warnings.map((w) => `P열: ${w}`));
    aiBlocks.push(...noteSplit.blocks);
  }

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
