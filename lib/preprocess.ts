/**
 * Mathory Unified Preprocessing Pipeline
 * 
 * 렌더링 전처리 순서:
 * 1. preventSetextHeadings() — setext heading 방지
 * 2. preprocessLocale() — 로케일 변환 (수식 태그, 열거, 그림/표 라벨, \ref{})
 * 3. preprocessMath() — 수식 문법 변환 (\tag{} → \tag*{}, \ref{} → \text{}, bare \\ → array)
 * 
 * 이 파이프라인은 PrintableContent에서 사용됩니다.
 * (EditorPreview는 자체 인라인 전처리를 사용)
 */

import { preprocessLocale, Locale, CIRCLED_CONSONANTS } from './locale';

/**
 * Setext heading 방지
 * 
 * Markdown에서 텍스트 바로 아래에 "-" 또는 "=" 만 있는 줄이 오면
 * setext heading(h1/h2)으로 해석됨. 이를 방지하기 위해
 * 해당 줄 앞에 빈 줄을 삽입.
 */
/**
 * `$$ ... $$` 독립수식 앞·뒤 공백을 정확히 빈 줄 1개(= 줄바꿈 2개)로 정규화.
 * - 수식 앞/뒤에 텍스트가 있으면 사이를 `\n\n`로 통일
 * - 수식이 블록 시작/끝에 있으면 앞/뒤에 빈 줄을 굳이 추가하지 않음
 * - 빈 줄이 2개 이상이거나 없는 경우 모두 1개로 보정
 */
export function normalizeDisplayMathSpacing(text: string): string {
  // 토큰화: [text, math, text, math, ...]
  type Tok = { type: 'text' | 'math'; content: string };
  const tokens: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('$$', i);
    if (open === -1) {
      tokens.push({ type: 'text', content: text.slice(i) });
      break;
    }
    const close = text.indexOf('$$', open + 2);
    if (close === -1) {
      tokens.push({ type: 'text', content: text.slice(i) });
      break;
    }
    if (open > i) {
      tokens.push({ type: 'text', content: text.slice(i, open) });
    }
    tokens.push({ type: 'math', content: text.slice(open, close + 2) });
    i = close + 2;
  }

  const out: string[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (tok.type === 'math') {
      out.push(tok.content);
      continue;
    }
    let content = tok.content;
    const prev = idx > 0 ? tokens[idx - 1] : null;
    const next = idx < tokens.length - 1 ? tokens[idx + 1] : null;
    if (prev?.type === 'math') {
      content = content.replace(/^\s+/, '');
      if (content.length > 0) content = '\n\n' + content;
    }
    if (next?.type === 'math') {
      content = content.replace(/\s+$/, '');
      if (content.length > 0) content = content + '\n\n';
    }
    out.push(content);
  }
  return out.join('');
}

export function preventSetextHeadings(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = result.length > 0 ? result[result.length - 1] : '';

    const isSetextUnderline =
      /^\s{0,3}-+\s*$/.test(line) || /^\s{0,3}=+\s*$/.test(line);

    if (isSetextUnderline && prevLine.trim() !== '') {
      result.push('');
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * 수식 문법 전처리
 * - \tag{n} → \tag*{…… ㉠} (수식 내 꼬리표)
 * - \ref{n} → \text{㉠} (수식 내 꼬리표 인용)
 * - \[...\] → $$...$$
 * - \(...\) → $...$
 * - $$...$$ 블록에서 bare \\ → array{l}로 감싸기
 * - 인라인 수식에 \displaystyle 추가
 */
export function preprocessMath(text: string): string {
  // \tag{n} → \tag*{…… ㉠} (수식 내 꼬리표)
  let result = text.replace(/\\tag\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return `\\tag*{…… ${CIRCLED_CONSONANTS[idx]}}`;
    }
    return match;
  });

  // \ref{n} → \text{㉠} (수식 내 꼬리표 인용)
  result = result.replace(/\\ref\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return `\\text{${CIRCLED_CONSONANTS[idx]}}`;
    }
    return match;
  });

  // \[...\] → $$...$$
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);

  // \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);

  // $$...$$ 블록에서 bare \\ (환경 없이) → array{l}로 감싸기
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const trimmed = inner.trim();
    const hasLineBreak = /\\\\(?![a-zA-Z])/.test(trimmed);
    const hasEnvironment = /\\begin\s*\{/.test(trimmed);
    if (hasLineBreak && !hasEnvironment) {
      let wrapped = `\\displaystyle ${trimmed}`;
      wrapped = wrapped.replace(
        /\\\\(\s*\[[^\]]*\])?\s*/g,
        (m, spacing) => `\\\\${spacing || ''}\n\\displaystyle `
      );
      return `$$\n\\begin{array}{l}\n${wrapped}\n\\end{array}\n$$`;
    }
    return match;
  });

  // cases 환경 내 \sum, \int 등에 \displaystyle 자동 추가
  result = result.replace(
    /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g,
    (match, inner) => {
      const patched = inner.replace(
        /(?<!\\displaystyle\s*)(\\(?:sum|int|prod|iint|iiint|oint|bigcup|bigcap)(?![a-zA-Z]))/g,
        '\\displaystyle $1'
      );
      return `\\begin{cases}${patched}\\end{cases}`;
    }
  );

  // $...$ 인라인 수식에 \displaystyle 추가 ($$...$$는 제외)
  result = result.replace(
    /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g,
    (match, inner) => {
      if (inner.trim().startsWith('\\displaystyle')) return match;
      return `$\\displaystyle ${inner}$`;
    }
  );

  return result;
}

/**
 * 통합 전처리 파이프라인
 * 
 * @param text - raw_text
 * @param locale - 로케일 설정 (기본: 'international')
 * @returns 렌더링 준비된 텍스트
 */
export function preprocess(text: string, locale: Locale = 'international'): string {
  // 1단계: setext heading 방지
  const safe = preventSetextHeadings(text);

  // 2단계: 로케일 변환 (수식 보호 → 텍스트 치환 → 복원)
  const localized = preprocessLocale(safe, locale);

  // 3단계: 수식 문법 변환 (\tag{}, \ref{}, 표기법, displaystyle)
  const processed = preprocessMath(localized);

  return processed;
}

export type { Locale };