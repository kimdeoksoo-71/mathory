/**
 * Phase 61b — 검증 응답 파싱·복구·정규화 (순수 함수, import 0)
 *
 * ⚠️ 이 파일에 import를 두지 말 것 — `npm run test:verify`가 tsc로 단독 컴파일한다.
 *
 * ── 이 파일이 존재하는 이유 ──
 * 수식이 본문인 도메인에서 **LaTeX와 JSON 이스케이프가 충돌**한다.
 * `"\frac"`은 JSON 파싱이 *성공하면서* `\f`(form feed) + `"rac"`이 된다 — 오류가 나지 않고
 * 조용히 망가진다. 그래서 방어가 두 겹이다:
 *   ① 파싱 실패 대응  → `safeParseJson` 4단계 폴백
 *   ② 파싱 성공 후 복구 → `repairLatexControlChars` (⚠ **trim보다 먼저** 호출)
 * ②는 JSON mime을 켜도, tool_use·structured output을 써도 면제되지 않는다 — 어느 경로든
 * 결국 `JSON.parse`를 지나기 때문이다.
 * (원본: gas-project-audition origin/main b6b91f6 —
 *  `Itemverification.gs:690-728`(파싱) · `QualityVerification.gs:341-366`(복구·정제))
 */

/* ═══════════════════════════════════════════════════════ */
/* 타입 (로컬 정의 — import 0 규약)                          */
/* ═══════════════════════════════════════════════════════ */

export type VerifyKind = 'problem' | 'solution';
export type VerifyVerdict = 'ok' | 'check' | 'fail' | 'skip';

/** 1차가 낸 후보 (정제 후) */
export interface RawFinding {
  id: string;                 // 'c1', 'c2' … 2차 판정과 맞물리는 키
  tag: string;
  quote: string;
  reason: string;
  suggestion?: string;
  /** 모델이 준 [블록 n] 힌트 (1-based). 앵커 확정은 anchorByQuote가 한다 */
  blockHint?: number;
}

export interface AnchorResult {
  blockKey: string | null;
  found: boolean;
}

/* ═══════════════════════════════════════════════════════ */
/* 1. 파싱 — 4단계 폴백                                      */
/* ═══════════════════════════════════════════════════════ */

/** 코드펜스 제거 + 앞뒤 잡음 제거 */
function stripFences(raw: string): string {
  return String(raw ?? '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
}

/** 첫 `{`부터 짝이 맞는 `}`까지 — 문자열 리터럴 안의 중괄호는 세지 않는다.
 *  응답 뒤에 산문이 붙어 오는 경우를 살린다(정규식 `\{[\s\S]*\}`는 뒤쪽 잡음의 `}`까지 먹는다). */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * JSON 문자열 내부의 잘못된 이스케이프를 문자 단위로 교정.
 * `\frac` → `\f`(form feed)+`rac`으로 파싱되는 경로를 **파싱 전에** 막는다.
 * (`Itemverification.gs:740-`의 `fixJsonStringEscapes_` 이식)
 */
function fixJsonStringEscapes(text: string): string {
  let out = '';
  let inStr = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      // 앞의 연속 백슬래시가 짝수면 이스케이프가 아니다 → 문자열 경계
      let back = 0;
      let j = i - 1;
      while (j >= 0 && text[j] === '\\') { back++; j--; }
      if (back % 2 === 0) inStr = !inStr;
      out += ch; i++; continue;
    }
    if (!inStr) { out += ch; i++; continue; }

    if (ch === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === '\\') { out += '\\\\'; i += 2; continue; }   // 이미 이스케이프된 백슬래시
      if (next === '"') { out += '\\"'; i += 2; continue; }
      if (next === 'u') { out += '\\u'; i += 2; continue; }     // 유니코드는 그대로
      // \b \f \n \r \t 는 JSON에서 유효하지만 LaTeX 명령의 앞머리일 수 있다.
      // 뒤에 영문자가 이어지면 LaTeX로 보고 백슬래시를 살린다 (\frac, \beta, \right, \neq, \theta …)
      if ('bfnrt'.indexOf(next) >= 0) {
        const after = text[i + 2];
        if (after && /[a-zA-Z]/.test(after)) { out += '\\\\' + next; i += 2; continue; }
        out += '\\' + next; i += 2; continue;
      }
      if (next === '/') { out += '\\/'; i += 2; continue; }
      // 그 외(\ + 무효 문자)는 리터럴 백슬래시로 승격
      out += '\\\\' + next; i += 2; continue;
    }
    out += ch; i++;
  }
  return out;
}

/**
 * 4단계 폴백 파싱. 실패하면 `null`.
 *
 * ⚠️ 시트의 4단계(`extractFieldsByRegex_`)는 **스칼라 필드 전용**이라 배열 스키마에는 쓸 수 없다
 *    (GAS 주석도 "4단계 폴백은 candidates를 모름"이라 못 박는다). 여기서는 그 자리를
 *    **균형 잡힌 객체 재추출**로 대체한다 — 배열을 보존하면서 뒤에 붙은 산문을 떼어낸다.
 *    반쪽 복구로 리포트를 만드느니 실패가 낫다 (D13′).
 */
export function safeParseJson(raw: string): unknown | null {
  const text = stripFences(raw);
  const balanced = extractBalancedObject(text);

  const candidates = [
    balanced ?? text,
    // 2단계: 명백히 무효한 이스케이프만 승격 (\X 에서 X가 JSON 유효 이스케이프가 아닌 경우)
    (balanced ?? text).replace(/\\([^"\\/bfnrtu])/g, '\\\\$1'),
    // 3단계: 문자열 내부 문자 단위 교정 (\frac 계열)
    fixJsonStringEscapes(balanced ?? text),
    // 4단계: 원문에서 균형 객체를 다시 뜬 뒤 3단계 (앞 단계가 잡음에 걸린 경우)
    fixJsonStringEscapes(extractBalancedObject(raw) ?? text),
  ];

  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* 다음 단계 */ }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════ */
/* 2. 파싱 후 복구 — 여기가 진짜 함정이다                     */
/* ═══════════════════════════════════════════════════════ */

/**
 * ⚠️ **모델 응답을 읽는 경로는 반드시 이 함수를 쓸 것.**
 *
 * `safeParseJson`만 부르면 조용히 망가진 값을 받는다. `"\frac"`은 **1단계에서 파싱이
 * 성공**하므로(폴백이 아예 발동하지 않는다) 복구는 오직 파싱 *후*에만 일어날 수 있다.
 * 두 단계를 한 함수로 묶어 호출부가 순서를 틀릴 여지를 없앤다.
 */
export function parseAndRepair(raw: string): unknown | null {
  const parsed = safeParseJson(raw);
  return parsed === null ? null : repairLatexControlChars(parsed);
}


/**
 * JSON 파싱이 "성공"하며 조용히 손상된 LaTeX 명령을 되살린다.
 * 제어문자 바로 뒤에 영문자가 이어지면 LaTeX 명령으로 보고 백슬래시를 복원한다.
 *
 * ⚠️ **`trim()`보다 먼저 호출할 것** — 선두의 `\f` 등이 trim에 공백으로 소실되면 복원이 불가능하다
 *    (`QualityVerification.gs:355`의 `★` 주석이 같은 이유를 남겼다).
 * ⚠️ 한국어 산문(reason) 안의 진짜 개행이 영문자 앞에 오면 `\n` 리터럴이 된다 —
 *    시트가 감수한 트레이드오프를 그대로 승계한다(개행+영문자는 희소).
 */
export function repairLatexControlCharsInString(s: string): string {
  return String(s ?? '')
    .replace(/\f(?=[a-zA-Z])/g, '\\f')     // \frac, \forall …
    .replace(/\x08(?=[a-zA-Z])/g, '\\b')   // \begin, \beta …
    .replace(/\r(?=[a-zA-Z])/g, '\\r')     // \right, \rho …
    .replace(/\n(?=[a-zA-Z])/g, '\\n')     // \neq, \nabla …
    .replace(/\t(?=[a-zA-Z])/g, '\\t');    // \theta, \tan, \text …
}

/** 파싱본 전체(객체·배열·문자열)를 재귀적으로 복구한다. */
export function repairLatexControlChars<T>(v: T): T {
  if (typeof v === 'string') return repairLatexControlCharsInString(v) as unknown as T;
  if (Array.isArray(v)) return v.map((x) => repairLatexControlChars(x)) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = repairLatexControlChars(val);
    }
    return out as unknown as T;
  }
  return v;
}

/* ═══════════════════════════════════════════════════════ */
/* 3. 태그 화이트리스트 · 후보 정제                           */
/* ═══════════════════════════════════════════════════════ */

/** 기획서 B-3 원문. ⚠️ 임의로 개명하지 말 것 — E-4로 확정된 체계다. */
export const PROBLEM_TAGS = ['조건결함', '답없음', '선택지오류', '표기'] as const;
export const SOLUTION_TAGS = [
  '계산오류', '표기오류', '논리비약', '논리오류', '수식비일관', '경우누락', '문제풀이불일치',
] as const;
export const COMMON_TAGS = ['정답불일치'] as const;

export function allowedTags(kind: VerifyKind): string[] {
  return kind === 'problem'
    ? [...PROBLEM_TAGS, ...COMMON_TAGS]
    : [...SOLUTION_TAGS, ...COMMON_TAGS];
}

/** 미지 태그를 화이트리스트로 끌어온다. 못 알아보면 그 kind의 가장 일반적인 태그. */
export function normalizeTag(raw: string, kind: VerifyKind): string {
  const t = String(raw ?? '').trim();
  const allow = allowedTags(kind);
  if (allow.includes(t)) return t;

  const low = t.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => t.includes(k) || low.includes(k));

  if (has('정답', 'answer_mismatch')) return '정답불일치';
  if (kind === 'problem') {
    if (has('조건', 'condition')) return '조건결함';
    if (has('답없', '해없', 'no_answer', 'no solution')) return '답없음';
    if (has('선택지', '보기', 'choice', 'option')) return '선택지오류';
    if (has('표기', 'notation')) return '표기';
    return '조건결함';
  }
  if (has('계산', 'calc', 'arith')) return '계산오류';
  if (has('비약', 'gap', 'logic_gap')) return '논리비약';
  if (has('일관', 'incons')) return '수식비일관';
  if (has('경우', 'case')) return '경우누락';
  if (has('불일치', 'mismatch')) return '문제풀이불일치';
  if (has('표기', 'notation')) return '표기오류';
  return '논리오류';
}

/**
 * 1차 후보 정제. 시트 `sanitizeCandidates_` 등가.
 * ⚠️ 복구를 trim보다 **먼저** 한다.
 */
export function sanitizeFindings(arr: unknown, kind: VerifyKind, cap = 8): RawFinding[] {
  if (!Array.isArray(arr)) return [];
  const out: RawFinding[] = [];
  for (const item of arr) {
    const c = (item ?? {}) as Record<string, unknown>;
    const quote = repairLatexControlCharsInString(String(c.quote ?? '')).trim();
    const reason = repairLatexControlCharsInString(String(c.reason ?? '')).trim();
    const suggestion = repairLatexControlCharsInString(String(c.suggestion ?? '')).trim();
    if (quote === '' && reason === '') continue;

    const hintRaw = c.block ?? c.blockHint ?? c.block_index;
    const hint = typeof hintRaw === 'number' && Number.isFinite(hintRaw)
      ? hintRaw
      : (typeof hintRaw === 'string' && /^\d+$/.test(hintRaw.trim()) ? Number(hintRaw) : undefined);

    out.push({
      id: `c${out.length + 1}`,
      tag: normalizeTag(String(c.tag ?? c.type ?? ''), kind),
      quote, reason,
      ...(suggestion ? { suggestion } : {}),
      ...(hint !== undefined ? { blockHint: hint } : {}),
    });
    if (out.length >= cap) break;   // 후보 상한 8 (시트 MAX_CANDIDATES)
  }
  return out;
}

/* ═══════════════════════════════════════════════════════ */
/* 4. 인용 실재성 → 블록 앵커 확정                            */
/* ═══════════════════════════════════════════════════════ */

/** 인용 대조용 정규화: 공백 전량 제거 (시트 `normalizeForQuoteCheck_`) */
export function normalizeForQuoteCheck(s: string): string {
  return String(s ?? '').replace(/\s+/g, '');
}

/** 접두 폴백이 인정되는 **최소** 길이 (공백 제거 후 문자 수).
 *  이보다 짧은 일치는 우연히 걸릴 수 있어 앵커 근거로 삼지 않는다. */
export const QUOTE_MIN_PREFIX = 12;

/** `text` 안에 존재하는 `q`의 최장 접두 길이. 접두 일치는 단조라 이분 탐색이 가능하다
 *  (길이 L이 걸리면 L보다 짧은 접두는 전부 걸린다). */
function longestPrefixMatch(q: string, text: string): number {
  if (!q || !text) return 0;
  let lo = 0;
  let hi = Math.min(q.length, text.length);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (text.indexOf(q.slice(0, mid)) !== -1) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * 인용이 실제로 어느 블록에 있는지 찾아 **서버가 blockKey를 확정**한다.
 * 모델이 준 `[블록 n]` 라벨은 힌트일 뿐 신뢰하지 않는다.
 *
 * ① 공백 제거 전문 매칭 → ② **최장 일치 접두**(≥12자) → ③ 실패(환각 신호)
 * 여러 블록에 걸리면 **첫 블록**을 쓴다 — 배열 순서가 곧 문서 순서다.
 *
 * ⚠️ ②를 *고정* 길이 접두로 두면 안 된다. 인용이 블록보다 길고 뒤에 군더더기가 붙은 경우
 *    (모델이 문장을 이어 쓴 흔한 실패), 고정 20자가 블록 전체(예: 19자)를 넘어서면
 *    명백히 그 블록인데도 미매칭이 된다. 최장 접두를 찾으면 양쪽 길이에 무관하게 걸린다.
 */
export function anchorByQuote(
  quote: string,
  blocks: { blockKey: string; text: string }[],
): AnchorResult {
  const q = normalizeForQuoteCheck(quote);
  if (!q) return { blockKey: null, found: false };

  const norm = blocks.map((b) => ({ blockKey: b.blockKey, n: normalizeForQuoteCheck(b.text) }));

  for (const b of norm) {
    if (b.n && b.n.indexOf(q) !== -1) return { blockKey: b.blockKey, found: true };
  }

  let best: { blockKey: string; len: number } | null = null;
  for (const b of norm) {
    const len = longestPrefixMatch(q, b.n);
    if (len >= QUOTE_MIN_PREFIX && (!best || len > best.len)) {
      best = { blockKey: b.blockKey, len };   // 동률은 먼저 만난 블록이 이긴다(문서 순서)
    }
  }
  return best ? { blockKey: best.blockKey, found: true } : { blockKey: null, found: false };
}

/* ═══════════════════════════════════════════════════════ */
/* 5. 2차 판정 매핑 · 합성                                    */
/* ═══════════════════════════════════════════════════════ */

export type Ruling = 'valid' | 'invalid' | 'uncertain';

/** 판정 누락·미지 값은 `uncertain`으로 (시트 `synthesizeQuality_`와 동일) */
export function normalizeRuling(raw: unknown): Ruling {
  const r = String(raw ?? '').trim().toLowerCase();
  return (r === 'valid' || r === 'invalid' || r === 'uncertain') ? r : 'uncertain';
}

/** 2차 judgments 배열을 id → {ruling, note} 맵으로 */
export function indexJudgments(arr: unknown): Record<string, { ruling: Ruling; note: string }> {
  const map: Record<string, { ruling: Ruling; note: string }> = {};
  if (!Array.isArray(arr)) return map;
  for (const item of arr) {
    const j = (item ?? {}) as Record<string, unknown>;
    const id = String(j.id ?? '').trim();
    if (!id) continue;
    map[id] = {
      ruling: normalizeRuling(j.ruling),
      note: repairLatexControlCharsInString(String(j.note ?? '')).trim(),
    };
  }
  return map;
}

/**
 * 종합 판정. 시트 STEP3 규칙 그대로: `fail≥1 → fail` / `check≥1 → check` / else `ok`.
 * (시트 어휘 valid→fail, uncertain→check로 이미 매핑된 findings를 받는다)
 */
export function synthesizeVerdict(findings: { verdict: 'fail' | 'check' }[]): 'ok' | 'check' | 'fail' {
  if (findings.some((f) => f.verdict === 'fail')) return 'fail';
  if (findings.some((f) => f.verdict === 'check')) return 'check';
  return 'ok';
}

/* ═══════════════════════════════════════════════════════ */
/* 6. 정답 대조                                              */
/* ═══════════════════════════════════════════════════════ */

/** 정답 비교용 정규화: 공백·`$`·`\left`/`\right`·후행 마침표 제거 */
export function normalizeAnswer(s: string): string {
  return String(s ?? '')
    .replace(/\\left|\\right/g, '')
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/[.。]+$/, '')
    .trim();
}

/**
 * 등록 정답과 AI 도출답 대조.
 * ⚠️ 이것은 **신호**이지 결론이 아니다 — mismatch는 2차 판정으로 넘겨 원인을 가린다
 *    (문제 결함 / 풀이 오류 / 정답 입력 실수 중 무엇인지는 판정자가 정한다).
 */
export function compareAnswer(
  registered: string,
  derived: string | undefined,
): 'match' | 'mismatch' | 'no_answer' {
  const reg = normalizeAnswer(registered);
  if (!reg) return 'no_answer';
  const der = normalizeAnswer(derived ?? '');
  if (!der) return 'no_answer';
  return reg === der ? 'match' : 'mismatch';
}
