/**
 * Phase 27 — 교정(맞춤법) 유틸리티
 *
 * - 수식 영역(`$..$`, `$$..$$`, `\(..\)`, `\[..\]`) 마스킹: Claude에 전달할 때 토큰으로 치환
 * - 마커 마스킹: gana/roman 블록의 (a)/(i) 류 라인 선두 마커
 * - 인라인 수식과 한글 조사 사이의 잘못된 공백 로컬 검출 (결정적, 토큰 절약)
 */

import { skipEnvArgs } from './latexScan';

export type ProofreadIssueKind = 'spelling' | 'spacing' | 'josa-space' | 'latex-brace' | 'latex-comma' | 'other';

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
      // 마커: 한국 리터럴 (가)~(차)·ㄱ.~ㅊ. + 레거시 (a)~(z)·(i)~(v) (Phase 60 P3)
      // ⚠ 레거시는 이제 (가)/ㄱ.로 변환되지 않지만(Phase 60 후속) 마스킹은 **유지**한다.
      //   마스킹은 변환이 아니라 "AI가 건드리지 못하게 막는" 보호 장치라, 옛 문항에
      //   남아 있는 (a) 표기가 교정 대상이 되어 임의로 바뀌는 것을 막아야 한다.
      // ⚠ 뒤 공백은 [ \t]*로만 — \s*는 개행을 placeholder 안으로 빨아들여, 내용이 아직
      //   없는 연속 마커 행(`(가) `↵`(나) ` = 블록 프리셋의 모습)이 Claude에게
      //   `⟦M0⟧⟦M1⟧⟦M2⟧` 한 줄로 전달된다. 항목이 몇 개인지 알 수 없는 형태라
      //   교정 품질이 떨어진다(복원은 정상이므로 원문 손상은 없다). 실측 확인.
      const markerMatch = text.slice(i).match(
        /^(?:\(([a-z]+|[ivx]+)\)|\((?:가|나|다|라|마|바|사|아|자|차)\)|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.)[ \t]*/
      );
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

/* ─── 수식 내 쉼표 뒤 ~ 간격 누락 검출 ─── */

/**
 * 수식 내에서 `,` 뒤에 토큰이 곧바로 이어질 때(공백이 있어도 LaTeX는 거의 무시),
 * 가독성을 위해 `, ~ X` 형태로 정규화하도록 제안.
 *
 * 매칭 조건:
 *   - 수식 영역 내부의 `,`
 *   - `,` 직전이 `\`(즉 `\,`)이면 제외 (LaTeX small space 명령)
 *   - `,` 다음 0개 이상의 공백 후, 다음 문자가 `~`/`,`/닫는 괄호이면 제외
 *   - 다음 문자가 단어/식별자/`\`(매크로 시작) 일 때만 적용
 */
export function detectCommaSpacing(text: string): ProofreadIssue[] {
  const issues: ProofreadIssue[] = [];
  const regions = extractMathRegions(text);
  const TOKEN_RE = /[0-9A-Za-z가-힣\\(\[]/;

  for (const { start, end } of regions) {
    for (let k = start; k < end; k++) {
      if (text[k] !== ',') continue;
      if (text[k - 1] === '\\') continue; // \, 제외
      // 다음 non-space 위치
      let j = k + 1;
      while (j < end && (text[j] === ' ' || text[j] === '\t')) j++;
      if (j >= end) continue;
      const next = text[j];
      if (next === '~' || next === ',' || next === ')' || next === ']' || next === '}') continue;
      if (!TOKEN_RE.test(next)) continue;

      // 스니펫: 직전 2자 ~ 다음 토큰 직후 1자
      const snipStart = Math.max(start, k - 2);
      const snipEnd = Math.min(end, j + 2);
      const original = text.slice(snipStart, snipEnd);
      const before = text.slice(snipStart, k + 1); // ',' 까지
      const after = text.slice(j, snipEnd);        // 다음 토큰부터
      const suggestion = before + ' ~ ' + after;

      issues.push({
        kind: 'latex-comma',
        original,
        suggestion,
        reason: '수식 내 쉼표 뒤에 ~ 를 삽입해 가독성을 높이세요.',
      });
    }
  }
  return issues;
}

/* ─── 텍스트 영역의 맨숫자(bare number) 자동 수식화 ─── */

/**
 * 수식/HTML/링크/코드/순서리스트 마커 등을 제외한 "일반 텍스트" 영역에서
 * 숫자 시퀀스를 찾아 `$...$`로 감싸 반환.
 *
 * 사용자에게 이슈로 보고하지 않고 즉시 적용되는 규칙.
 */
export function autoWrapBareNumbers(text: string): { fixed: string; count: number } {
  // 보호 영역(이 안의 인덱스는 건드리지 않음) 수집
  const protectedRanges: Array<[number, number]> = [];
  // 수식 영역 (구분자 포함) — 공용 스캐너(사본 금지)
  protectedRanges.push(...collectMathRanges(text));

  const addAll = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      protectedRanges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  };
  addAll(/<[^>\n]+>/g);                          // HTML 태그
  addAll(/https?:\/\/\S+/g);                     // URL
  addAll(/!?\[[^\]\n]*\]\([^)\n]*\)/g);          // 마크다운 링크/이미지
  addAll(/`[^`\n]*`/g);                          // 인라인 코드
  addAll(/\\(?:tag|ref)\{[^}]*\}/g);             // \tag, \ref (안의 숫자 보호)
  addAll(/\(\d+\)/g);                             // 참조 번호 (1), (2), (3) … 은 수식화 제외
  // 순서 리스트 마커: 라인 선두 "  3. " 등의 숫자
  {
    const re = /^[ \t]*(\d+)\.(?=\s)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const numStart = m.index + m[0].lastIndexOf(m[1]);
      protectedRanges.push([numStart, numStart + m[1].length]);
    }
  }

  const inProtected = (pos: number) =>
    protectedRanges.some(([s, e]) => pos >= s && pos < e);

  // 숫자 시퀀스 (소수점 포함). 영문/숫자/마침표와 결합된 식별자(iPhone15, 1.0.0 등)는 제외.
  // 한글이 인접한 경우는 정상적인 한국어 문장 패턴이므로 허용.
  const numRe = /(?<![A-Za-z0-9.])\d+(?:\.\d+)?(?![A-Za-z0-9.])/g;
  const matches: Array<{ start: number; end: number }> = [];
  let nm: RegExpExecArray | null;
  while ((nm = numRe.exec(text)) !== null) {
    const start = nm.index;
    const end = start + nm[0].length;
    if (inProtected(start)) continue;
    matches.push({ start, end });
  }

  matches.sort((a, b) => b.start - a.start);
  let fixed = text;
  for (const m of matches) {
    fixed = fixed.slice(0, m.start) + '$' + fixed.slice(m.start, m.end) + '$' + fixed.slice(m.end);
  }
  return { fixed, count: matches.length };
}

/**
 * 텍스트 영역의 영문 글자 시퀀스(앞·뒤가 영숫자가 아닌 경우)를 인라인 수식으로 감싼다.
 * - 모두 소문자: `$abc$` (수학 변수, 이탤릭)
 * - 대문자 포함(전부 대문자 또는 혼합): `$\mathrm{ABC}$` (로만체)
 * - 길이 무관 (단일 글자도 다중 글자도 동일 규칙)
 * - 보호 영역(수식·HTML·URL·코드·tag/ref)은 건드리지 않음
 */
export function autoWrapBareLetters(text: string): { fixed: string; count: number } {
  const protectedRanges: Array<[number, number]> = [];
  // 수식 영역 (구분자 포함) — 공용 스캐너(사본 금지)
  protectedRanges.push(...collectMathRanges(text));

  const addAll = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      protectedRanges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  };
  addAll(/<[^>\n]+>/g);
  addAll(/https?:\/\/\S+/g);
  addAll(/!?\[[^\]\n]*\]\([^)\n]*\)/g);
  addAll(/`[^`\n]*`/g);
  addAll(/\\(?:tag|ref)\{[^}]*\}/g);
  // ol 라벨 예외:
  //   - 단일 영문 글자 in parens: (a), (b), ..., (z), (A), ...
  //   - 로마 숫자 in parens: (i), (ii), (iii), (iv), (v), (vi)... 대소문자 모두
  addAll(/\([a-zA-Z]\)/g);
  addAll(/\([ivxlcdmIVXLCDM]{1,5}\)/g);
  // 본문에 그대로 쓰인 로마 숫자 (괄호 없이): i, ii, iii, iv, v, vi, vii, viii, ix, x, xi…xx
  // — 양옆이 영숫자가 아닐 때만. 긴 패턴부터 매칭(alternation 우선순위)
  addAll(/(?<![A-Za-z0-9])(?:xviii|xvii|xvi|xv|xiv|xiii|xii|xi|viii|vii|vi|iv|iii|ii|ix|xx|x|v|i)(?![A-Za-z0-9])/g);

  const inProtected = (pos: number) =>
    protectedRanges.some(([s, e]) => pos >= s && pos < e);

  // 영문 글자 시퀀스 (1자 이상): 양옆이 영숫자가 아닐 때만
  const letterRe = /(?<![A-Za-z0-9])([A-Za-z]+)(?![A-Za-z0-9])/g;
  const matches: Array<{ start: number; end: number; seq: string }> = [];
  let nm: RegExpExecArray | null;
  while ((nm = letterRe.exec(text)) !== null) {
    const start = nm.index;
    const end = start + nm[0].length;
    if (inProtected(start)) continue;
    matches.push({ start, end, seq: nm[1] });
  }

  matches.sort((a, b) => b.start - a.start);
  let fixed = text;
  for (const m of matches) {
    // 대문자가 하나라도 포함되면 \mathrm{}, 전부 소문자면 이탤릭
    const wrap = /[A-Z]/.test(m.seq) ? `$\\mathrm{${m.seq}}$` : `$${m.seq}$`;
    fixed = fixed.slice(0, m.start) + wrap + fixed.slice(m.end);
  }
  return { fixed, count: matches.length };
}

/* ─── display 수식 구분자 통일: \[..\] → $$..$$ ─── */

/**
 * 텍스트 영역의 `\[ ... \]` display 수식을 `$$ ... $$` 로 통일.
 *
 * - `$..$` / `$$..$$` 내부는 건드리지 않음 (이미 수식이므로 그 안의 `\[`는 LaTeX 괄호)
 * - 인라인 코드(`` ` ``)와 코드 펜스(``` ```)는 원문 보존
 * - 여는 `\[`에 짝이 없으면 그대로 둔다
 */
export function normalizeDisplayMathDelimiters(text: string): { fixed: string; count: number } {
  let out = '';
  let count = 0;
  let i = 0;

  while (i < text.length) {
    // 코드 펜스 ```...``` 통째로 보존
    if (text.startsWith('```', i)) {
      const close = text.indexOf('```', i + 3);
      const end = close === -1 ? text.length : close + 3;
      out += text.slice(i, end);
      i = end;
      continue;
    }
    // 인라인 코드 `...` 보존
    if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);
      if (close !== -1 && !text.slice(i + 1, close).includes('\n')) {
        out += text.slice(i, close + 1);
        i = close + 1;
        continue;
      }
    }
    // $$ 블록 보존
    if (text[i] === '$' && text[i + 1] === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) {
        out += text.slice(i, close + 2);
        i = close + 2;
        continue;
      }
    }
    // $ 인라인 보존
    if (text[i] === '$') {
      let j = i + 1;
      let found = -1;
      while (j < text.length) {
        if (text[j] === '$' && text[j - 1] !== '\\') { found = j; break; }
        if (text[j] === '\n' && text[j + 1] === '\n') break;
        j++;
      }
      if (found !== -1) {
        out += text.slice(i, found + 1);
        i = found + 1;
        continue;
      }
    }
    // \[ ... \] → $$ ... $$
    if (text[i] === '\\' && text[i + 1] === '[') {
      const close = text.indexOf('\\]', i + 2);
      if (close !== -1) {
        out += '$$' + text.slice(i + 2, close) + '$$';
        i = close + 2;
        count++;
        continue;
      }
    }

    out += text[i];
    i++;
  }

  return { fixed: out, count };
}

/* ─── 자동 수정: josa-space + latex-brace + latex-comma 결정적 규칙 일괄 적용 ─── */

/**
 * 결정적 규칙(josa-space, latex-brace)만 한 번에 적용하여 수정된 raw_text를 반환.
 * - 오프셋 기반 치환으로 수식 밖 우연 일치 방지 (수식 영역 내에서만 ^/_ 처리)
 * - 길이가 변하므로 수정 위치는 뒤에서 앞으로 처리
 *
 * 반환값의 count는 실제 수정된 건수 (UI 알림용)
 */
/* ─── 개선묶음 M1: 수식/코드 보호 구간 (공용) ─── */

/**
 * 수식 영역(구분자 포함) 범위 수집.
 *
 * ⚠ 사본을 만들지 말 것 — `autoWrapBareNumbers`·`autoWrapBareLetters`·`convertJamoRefs`가
 *   같은 판정을 써야 한다. 갈리면 "숫자는 보호되는데 자모는 아닌" 식으로 조용히 어긋난다.
 */
function collectMathRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$' && text[i + 1] === '$') {
      const close = text.indexOf('$$', i + 2);
      if (close !== -1) { ranges.push([i, close + 2]); i = close + 2; continue; }
      break;
    }
    if (text[i] === '$') {
      let j = i + 1, found = -1;
      while (j < text.length) {
        if (text[j] === '$' && text[j - 1] !== '\\') { found = j; break; }
        if (text[j] === '\n' && text[j + 1] === '\n') break;
        j++;
      }
      if (found !== -1) { ranges.push([i, found + 1]); i = found + 1; continue; }
    }
    if (text[i] === '\\' && text[i + 1] === '[') {
      const close = text.indexOf('\\]', i + 2);
      if (close !== -1) { ranges.push([i, close + 2]); i = close + 2; continue; }
    }
    if (text[i] === '\\' && text[i + 1] === '(') {
      const close = text.indexOf('\\)', i + 2);
      if (close !== -1) { ranges.push([i, close + 2]); i = close + 2; continue; }
    }
    i++;
  }
  return ranges;
}

/* ─── 개선묶음 M1 D12′: (ㄱ) → (1) ─── */

const JAMO_ORDER = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ';
/** 반각·전각 괄호 모두. 출력은 항상 반각 `(1)` */
const JAMO_REF_RE = /[(（]([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])[)）]/g;

/**
 * 참조용 괄호 자모를 숫자로: `(ㄱ)` → `(1)` … `(ㅊ)` → `(10)`.
 *
 * 행머리·행중을 가리지 않는다 — 참조는 "(ㄱ)에서"처럼 문장 중간에 온다.
 * 합답형 보기 라벨인 `ㄱ.`(마침표·행머리)와는 문법이 달라 충돌하지 않는다.
 *
 * ⚠ 변환 결과 `(1)`은 `autoWrapBareNumbers`의 보호 대상이라 `$1$`로 오염되지 않는다.
 * ⚠ 보기 라벨을 `(ㄱ)`으로 적는 블록(`roman`·`choices`)에서는 호출부가 `skipJamoRefs`로 끈다.
 *    (OCR 경로는 블록 타입을 모르므로 기본 변환으로 돈다 — 알고 두는 한계다.)
 */
export function convertJamoRefs(text: string): { fixed: string; count: number } {
  const ranges = collectMathRanges(text);
  const addAll = (re: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) re.lastIndex++;
    }
  };
  addAll(/```[\s\S]*?```/g);                     // 코드펜스
  addAll(/`[^`\n]*`/g);                          // 인라인 코드
  addAll(/<[^>\n]+>/g);                          // HTML 태그

  const inProtected = (pos: number) => ranges.some(([s, e]) => pos >= s && pos < e);

  const matches: Array<{ start: number; end: number; num: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = JAMO_REF_RE.exec(text)) !== null) {
    if (inProtected(m.index)) continue;
    matches.push({ start: m.index, end: m.index + m[0].length, num: JAMO_ORDER.indexOf(m[1]) + 1 });
  }

  let fixed = text;
  for (const mt of matches.slice().reverse()) {
    fixed = fixed.slice(0, mt.start) + `(${mt.num})` + fixed.slice(mt.end);
  }
  return { fixed, count: matches.length };
}

/* ─── 개선묶음 M1 D14⁗: \begin{tabular} → GFM 표 ─── */

const BEGIN_TABULAR = '\\begin{tabular}';
const END_TABULAR = '\\end{tabular}';
/** 이 중 하나라도 있으면 우리가 모르는 형태다 → 손대지 않는다(조용한 오변환 금지) */
const TABULAR_UNSUPPORTED = /\\multicolumn|\\multirow|\\cline|\\begin\{tabular\}/;

/**
 * 셀 안 파이프 처리 (실측 근거).
 *
 * 프로젝트 파이프라인(remark-gfm)으로 잰 결과:
 *   `| $|x|$ |`   → 셀 4개로 쪼개짐 (표·수식 모두 파괴)
 *   `| $\|x\|$ |` → 셀 2개 ✔ 그리고 **수식 노드가 `\|`를 그대로 받는다**(‖ 정상)
 *   `| $\\|x\\|$ |` → 셀 4개로 쪼개짐 (이중 이스케이프는 표를 깬다)
 *
 * 그래서 규칙은 셋이다:
 *   ① 이미 `\|`인 것은 그대로 둔다 ② 수식 **안**의 bare `|`는 `\vert`(글리프 동일, 짝 판별 불필요)
 *   ③ 수식 **밖**의 bare `|`는 `\|`로 이스케이프 ④ `\\|`는 절대 만들지 않는다
 */
function guardCellPipes(cell: string): string {
  let out = '';
  let inMath = false;
  for (let i = 0; i < cell.length; i++) {
    const c = cell[i];
    if (c === '\\') { out += c + (cell[i + 1] ?? ''); i++; continue; }   // \| \& \\ 는 그대로
    if (c === '$') { inMath = !inMath; out += c; continue; }
    if (c === '|') { out += inMath ? '\\vert ' : '\\|'; continue; }
    out += c;
  }
  return out;
}

/** `\begin{tabular}` 블록 하나를 GFM 표 문자열로. 변환 불가면 null */
function tabularBodyToMarkdown(body: string): string | null {
  if (TABULAR_UNSUPPORTED.test(body)) return null;

  const rows = body
    .replace(/\\hline/g, '')
    .split(/\\\\(?:\[[^\]]*\])?/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => {
      const ESC = ' ESC_AMP ';
      return r
        .replace(/\\&/g, ESC)
        .split('&')
        .map((cell) => guardCellPipes(cell.split(ESC).join('\\&').trim()));
    });

  if (rows.length < 2) return null;                       // 헤더 + 본문 최소 1행
  const cols = rows[0].length;
  if (cols < 2) return null;
  if (rows.some((r) => r.length !== cols)) return null;   // 열 수 불일치 → 손대지 않는다

  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const align = `| ${rows[0].map(() => ':---:').join(' | ')} |`;
  // GFM 표는 앞뒤 빈 줄이 필요하다(툴바 buildMarkdownTable과 같은 관례)
  return `\n\n${line(rows[0])}\n${align}\n${rows.slice(1).map(line).join('\n')}\n\n`;
}

/**
 * `\begin{tabular}…\end{tabular}`(및 바로 감싼 `$$`)를 GFM 표로 바꾼다.
 *
 * ⚠ 열 지정 `{spec}`은 **중괄호 균형 스캔**으로만 떼어낸다 — `{|p{2cm}|l|}`에서 정규식은
 *   `{|p{2cm}`까지만 먹고 `|l|}`를 본문에 남긴다(W2).
 * ⚠ `autoWrapBareNumbers`보다 **먼저** 돌아야 셀의 맨 숫자가 `$0$`이 된다.
 */
export function convertTabularToMarkdown(text: string): { fixed: string; count: number } {
  if (!text.includes(BEGIN_TABULAR)) return { fixed: text, count: 0 };

  let out = '';
  let i = 0;
  let count = 0;
  while (i < text.length) {
    const idx = text.indexOf(BEGIN_TABULAR, i);
    if (idx === -1) { out += text.slice(i); break; }

    const argEnd = skipEnvArgs(text, idx + BEGIN_TABULAR.length);
    const endIdx = argEnd === -1 ? -1 : text.indexOf(END_TABULAR, argEnd);
    if (argEnd === -1 || endIdx === -1) {
      // 해석 실패 — 그대로 흘린다
      out += text.slice(i, idx + BEGIN_TABULAR.length);
      i = idx + BEGIN_TABULAR.length;
      continue;
    }

    const md = tabularBodyToMarkdown(text.slice(argEnd, endIdx));
    if (md === null) {
      out += text.slice(i, endIdx + END_TABULAR.length);
      i = endIdx + END_TABULAR.length;
      continue;
    }

    // 바로 감싼 $$ 가 있으면 함께 걷어낸다 (Mathpix가 표를 수식 구분자 안에 넣는 경우)
    let from = idx;
    let to = endIdx + END_TABULAR.length;
    const head = text.slice(0, from).match(/\$\$[ \t]*\n?[ \t]*$/);
    const tail = text.slice(to).match(/^[ \t]*\n?[ \t]*\$\$/);
    if (head && tail) {
      from -= head[0].length;
      to += tail[0].length;
    }

    out += text.slice(i, from) + md;
    i = to;
    count += 1;
  }
  return { fixed: out, count };
}

export function autoFixDeterministicIssues(
  text: string,
  opts?: { skipJamoRefs?: boolean },
): { fixed: string; count: number } {
  let count = 0;

  // Step 0: display 수식 구분자 통일 (\[..\] → $$..$$)
  // 이후 단계의 수식 영역 인식($ 기반)이 새 $$ 블록에도 동일하게 작용하도록 가장 먼저 처리.
  {
    const r = normalizeDisplayMathDelimiters(text);
    text = r.fixed;
    count += r.count;
  }

  // Step 0-1 (개선묶음 M1): \begin{tabular} → GFM 표.
  // ⚠ 순서가 규칙이다 — step 0 뒤라 `\[..\]` 래퍼는 이미 `$$`이고(분기 하나가 준다),
  //   step 0a 앞이라 셀의 맨 숫자·영문자가 그 다음에 수식화된다(메모의 목표 형태).
  {
    const r = convertTabularToMarkdown(text);
    text = r.fixed;
    count += r.count;
  }

  // Step 0-2 (개선묶음 M1): (ㄱ) → (1). 보기 라벨을 (ㄱ)로 쓰는 블록에서는 호출부가 끈다.
  if (!opts?.skipJamoRefs) {
    const r = convertJamoRefs(text);
    text = r.fixed;
    count += r.count;
  }

  // Step 0a: 텍스트 영역의 맨숫자를 $...$ 로 감싸 새로운 수식 영역 생성
  // (이후 단계의 수식 내 규칙이 새 영역에도 작용)
  {
    const r = autoWrapBareNumbers(text);
    text = r.fixed;
    count += r.count;
  }
  // Step 0b: 텍스트 영역의 단일 영문 글자 → $x$ / $\mathrm{X}$
  // 숫자 감싼 다음에 처리해야 새로 생긴 $..$ 영역도 보호 대상에 들어감.
  {
    const r = autoWrapBareLetters(text);
    text = r.fixed;
    count += r.count;
  }

  // Step 1: 수식 내 위치 기반 편집 수집 (브레이스 + 쉼표).
  // 모든 편집을 (pos, replaceLen, insert) 형태로 모아 뒤에서 앞으로 적용.
  type Edit = { pos: number; replaceLen: number; insert: string };
  const edits: Edit[] = [];
  const regions = extractMathRegions(text);
  const CHAR_RE = /[0-9A-Za-z가-힣]/;
  const TOKEN_RE = /[0-9A-Za-z가-힣\\(\[]/;

  for (const { start, end } of regions) {
    for (let k = start; k < end; k++) {
      const ch = text[k];
      // ^/_ 뒤 단일 문자 → 중괄호 감싸기
      if (ch === '^' || ch === '_') {
        const next = text[k + 1];
        if (next && next !== '{' && CHAR_RE.test(next) && text[k - 1] !== '\\') {
          // pos=k+1 의 1글자(next) → "{next}"
          edits.push({ pos: k + 1, replaceLen: 1, insert: `{${next}}` });
        }
        continue;
      }
      // 쉼표 뒤 ~ 간격 누락
      if (ch === ',' && text[k - 1] !== '\\') {
        let j = k + 1;
        while (j < end && (text[j] === ' ' || text[j] === '\t')) j++;
        if (j >= end) continue;
        const nx = text[j];
        if (nx === '~' || nx === ',' || nx === ')' || nx === ']' || nx === '}') continue;
        if (!TOKEN_RE.test(nx)) continue;
        // [k+1, j) 의 공백을 " ~ " 로 치환 (공백 0개여도 정확히 한 칸+~+한 칸 삽입)
        edits.push({ pos: k + 1, replaceLen: j - (k + 1), insert: ' ~ ' });
      }
    }
  }
  edits.sort((a, b) => b.pos - a.pos);
  let fixed = text;
  for (const e of edits) {
    fixed = fixed.slice(0, e.pos) + e.insert + fixed.slice(e.pos + e.replaceLen);
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
