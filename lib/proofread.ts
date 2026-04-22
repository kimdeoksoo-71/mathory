/**
 * Phase 27 — 교정(맞춤법) 유틸리티
 *
 * - 수식 영역(`$..$`, `$$..$$`, `\(..\)`, `\[..\]`) 마스킹: Claude에 전달할 때 토큰으로 치환
 * - 마커 마스킹: gana/roman 블록의 (a)/(i) 류 라인 선두 마커
 * - 인라인 수식과 한글 조사 사이의 잘못된 공백 로컬 검출 (결정적, 토큰 절약)
 */

export type ProofreadIssueKind = 'spelling' | 'spacing' | 'josa-space' | 'latex-brace' | 'other';

export interface ProofreadIssue {
  kind: ProofreadIssueKind;
  /** 원문에서 문제가 된 짧은 스니펫 */
  original: string;
  /** 수정 제안 */
  suggestion: string;
  /** 1줄 이유 */
  reason: string;
}

export interface ProofreadBlockResult {
  blockId: string;
  status: 'ok' | 'failed';
  issues: ProofreadIssue[];
  timestamp: number;
  /** 실패 시 오류 메시지 */
  error?: string;
}

/* ─── 수식 마스킹 ─── */

interface MaskedRange {
  token: string;
  original: string;
}

const MASK_PREFIX = '⟦M';
const MASK_SUFFIX = '⟧';

/** 수식, \tag/\ref, gana/roman 마커를 placeholder 토큰으로 치환 */
export function maskForProofread(text: string): { masked: string; placeholders: MaskedRange[] } {
  const placeholders: MaskedRange[] = [];
  let out = '';
  let i = 0;

  const push = (original: string) => {
    const token = `${MASK_PREFIX}${placeholders.length}${MASK_SUFFIX}`;
    placeholders.push({ token, original });
    return token;
  };

  // 라인 선두 마커 (가)/(i) 처리: 라인 시작에서만 매칭
  // 라인 단위로 처리하기 위해 우선 한 번 walk
  while (i < text.length) {
    // 라인 시작인지 확인
    const atLineStart = i === 0 || text[i - 1] === '\n';
    if (atLineStart) {
      // (a)~(z) 또는 (i)~(v) 마커
      const markerMatch = text.slice(i).match(/^\(([a-z]+|[ivx]+)\)\s*/);
      if (markerMatch) {
        out += push(markerMatch[0]);
        i += markerMatch[0].length;
        continue;
      }
    }

    // $$ 블록
    if (text[i] === '$' && text[i + 1] === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        out += push(text.slice(i, close + 2));
        i = close + 2;
        continue;
      }
    }
    // $ 인라인
    if (text[i] === '$') {
      let j = i + 1;
      let found = -1;
      while (j < text.length) {
        if (text[j] === '$' && text[j - 1] !== '\\') { found = j; break; }
        if (text[j] === '\n' && text[j + 1] === '\n') break;
        j++;
      }
      if (found !== -1) {
        out += push(text.slice(i, found + 1));
        i = found + 1;
        continue;
      }
    }
    // \[ ... \]
    if (text[i] === '\\' && text[i + 1] === '[') {
      const close = text.indexOf('\\]', i + 2);
      if (close !== -1) {
        out += push(text.slice(i, close + 2));
        i = close + 2;
        continue;
      }
    }
    // \( ... \)
    if (text[i] === '\\' && text[i + 1] === '(') {
      const close = text.indexOf('\\)', i + 2);
      if (close !== -1) {
        out += push(text.slice(i, close + 2));
        i = close + 2;
        continue;
      }
    }
    // \tag{..} / \ref{..} (수식 밖에 있을 수 있음)
    const tagRefMatch = text.slice(i).match(/^\\(?:tag|ref)\{[^}]*\}/);
    if (tagRefMatch) {
      out += push(tagRefMatch[0]);
      i += tagRefMatch[0].length;
      continue;
    }

    out += text[i];
    i++;
  }
  return { masked: out, placeholders };
}

/* ─── 인라인 수식 ↔ 조사 사이 잘못된 공백 ─── */

const KOREAN_PARTICLES = [
  '으로써', '으로서', '으로부터', '에서부터', '에게서', '한테서',
  '으로', '에서', '에게', '한테', '부터', '까지', '마저', '조차',
  '이라고', '라고', '이라는', '라는', '이라며', '라며',
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과',
  '도', '만', '나', '든', '며', '랑', '이며', '이라', '라',
];

const PARTICLES_ALT = KOREAN_PARTICLES
  .sort((a, b) => b.length - a.length) // 긴 것부터 매칭
  .join('|');

/**
 * 인라인 수식($...$ 또는 \(...\)) 다음에 공백이 있고 그 뒤에 조사가 오는 경우 검출.
 * 인라인 수식은 단어로 취급 → 조사 사이 공백은 오류.
 *
 * 마스킹된 토큰(⟦M..⟧) 앞도 동일하게 처리.
 */
export function detectJosaSpacing(text: string): ProofreadIssue[] {
  const issues: ProofreadIssue[] = [];
  // 인라인 수식 끝( $ 한 글자 ) 또는 \) 또는 마스킹 토큰 끝 ⟧
  const re = new RegExp(
    `((?:[^\\$\\n]\\$|\\\\\\)|⟧))[ \\t]+(${PARTICLES_ALT})(?=[\\s.,!?)\\]\\u3000-\\u303f가-힣]|$)`,
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const original = m[0];
    const suggestion = m[1] + m[2];
    issues.push({
      kind: 'josa-space',
      original,
      suggestion,
      reason: '인라인 수식과 조사 사이의 공백을 제거하세요.',
    });
  }
  return issues;
}

/* ─── LaTeX 윗첨자/아랫첨자 중괄호 누락 검출 ─── */

/** 수식 영역을 [start, end) 쌍으로 추출. $$...$$, $...$, \[..\], \(..\) */
function extractMathRegions(text: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < text.length) {
    // $$ 블록
    if (text[i] === '$' && text[i + 1] === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        regions.push({ start: i + 2, end: close });
        i = close + 2;
        continue;
      }
      break;
    }
    // $ 인라인
    if (text[i] === '$') {
      let j = i + 1;
      let found = -1;
      while (j < text.length) {
        if (text[j] === '$' && text[j - 1] !== '\\') { found = j; break; }
        if (text[j] === '\n' && text[j + 1] === '\n') break;
        j++;
      }
      if (found !== -1) {
        regions.push({ start: i + 1, end: found });
        i = found + 1;
        continue;
      }
    }
    // \[..\]
    if (text[i] === '\\' && text[i + 1] === '[') {
      const close = text.indexOf('\\]', i + 2);
      if (close !== -1) {
        regions.push({ start: i + 2, end: close });
        i = close + 2;
        continue;
      }
    }
    // \(..\)
    if (text[i] === '\\' && text[i + 1] === '(') {
      const close = text.indexOf('\\)', i + 2);
      if (close !== -1) {
        regions.push({ start: i + 2, end: close });
        i = close + 2;
        continue;
      }
    }
    i++;
  }
  return regions;
}

/**
 * 수식 내에서 `^` 또는 `_` 뒤에 `{`가 아닌 한 글자([0-9A-Za-z가-힣])가 올 때,
 * `^{x}` / `_{x}` 로 감싸도록 제안.
 *
 * original/suggestion은 수식 경계를 포함한 짧은 스니펫으로 만들어
 * 자동 정정 시 raw_text 에서 명확히 치환될 수 있게 한다.
 */
export function detectSuperSubBraces(text: string): ProofreadIssue[] {
  const issues: ProofreadIssue[] = [];
  const regions = extractMathRegions(text);
  const CHAR_RE = /[0-9A-Za-z가-힣]/;

  for (const { start, end } of regions) {
    for (let k = start; k < end; k++) {
      const ch = text[k];
      if (ch !== '^' && ch !== '_') continue;
      const next = text[k + 1];
      if (!next || next === '{') continue;
      if (!CHAR_RE.test(next)) continue;
      // 앞이 \ 로 시작하는 escape 회피 (\^, \_ 자체가 독립 기호)
      if (text[k - 1] === '\\') continue;

      // 스니펫: 직전 1~3자 + op + char + 직후 1자 (경계 식별용)
      const snipStart = Math.max(start, k - 3);
      const snipEnd = Math.min(end, k + 3);
      const original = text.slice(snipStart, snipEnd);
      const opOffset = k - snipStart;
      const suggestion =
        original.slice(0, opOffset + 1) + '{' + next + '}' + original.slice(opOffset + 2);

      issues.push({
        kind: 'latex-brace',
        original,
        suggestion,
        reason: `수식 ${ch} 뒤 한 글자는 중괄호로 감싸야 합니다.`,
      });
    }
  }
  return issues;
}

/* ─── 자동 수정: josa-space + latex-brace 결정적 규칙 일괄 적용 ─── */

/**
 * 결정적 규칙(josa-space, latex-brace)만 한 번에 적용하여 수정된 raw_text를 반환.
 * - 오프셋 기반 치환으로 수식 밖 우연 일치 방지 (수식 영역 내에서만 ^/_ 처리)
 * - 길이가 변하므로 수정 위치는 뒤에서 앞으로 처리
 *
 * 반환값의 count는 실제 수정된 건수 (UI 알림용)
 */
export function autoFixDeterministicIssues(text: string): { fixed: string; count: number } {
  let count = 0;

  // Step 1: 수식 내 ^/_ 뒤 단일 문자 → 중괄호 감싸기
  const regions = extractMathRegions(text);
  const braceEdits: Array<{ pos: number; ch: string }> = [];
  const CHAR_RE = /[0-9A-Za-z가-힣]/;
  for (const { start, end } of regions) {
    for (let k = start; k < end; k++) {
      const ch = text[k];
      if (ch !== '^' && ch !== '_') continue;
      const next = text[k + 1];
      if (!next || next === '{') continue;
      if (!CHAR_RE.test(next)) continue;
      if (text[k - 1] === '\\') continue;
      braceEdits.push({ pos: k + 1, ch: next });
    }
  }
  // 뒤에서 앞으로 적용 (인덱스 보존)
  braceEdits.sort((a, b) => b.pos - a.pos);
  let fixed = text;
  for (const e of braceEdits) {
    fixed = fixed.slice(0, e.pos) + `{${e.ch}}` + fixed.slice(e.pos + 1);
    count++;
  }

  // Step 2: 인라인 수식 끝 + 공백 + 조사 → 공백 제거
  const re = new RegExp(
    `((?:[^\\$\\n]\\$|\\\\\\)))[ \\t]+(${PARTICLES_ALT})(?=[\\s.,!?)\\]\\u3000-\\u303f가-힣]|$)`,
    'g'
  );
  fixed = fixed.replace(re, (_m, pre, p) => {
    count++;
    return pre + p;
  });

  return { fixed, count };
}

/* ─── 블록 raw_text 정제: choices의 ① 라벨 등 제거 (필요 시) ─── */

/** choices, image는 호출 측에서 이미 제외하므로 별도 처리 없음 */
export function normalizeForProofread(rawText: string): string {
  return rawText;
}
