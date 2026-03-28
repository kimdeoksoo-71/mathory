/**
 * Mathory Unified Preprocessing Pipeline
 * 
 * 렌더링 전처리 순서:
 * 1. preprocessLocale() — 로케일 변환 (수식 태그, 열거, 그림/표 라벨)
 * 2. preprocessMath() — 수식 문법 변환 (\[→$$, \(→$, displaystyle)
 * 
 * 이 파이프라인은 EditorPreview, PrintableContent 모두에서 사용됩니다.
 */

import { preprocessLocale, Locale } from './locale';

/**
 * 수식 문법 전처리
 * - \[...\] → $$...$$
 * - \(...\) → $...$
 * - 인라인 수식에 \displaystyle 추가
 */
export function preprocessMath(text: string): string {
  // \[...\] → $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);

  // \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);

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
  // 1단계: 로케일 변환 (수식 태그 포함)
  const localized = preprocessLocale(text, locale);

  // 2단계: 수식 문법 변환
  const processed = preprocessMath(localized);

  return processed;
}

export type { Locale };