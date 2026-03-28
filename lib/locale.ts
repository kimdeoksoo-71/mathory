/**
 * Mathory Locale Preprocessing
 * 
 * 저장: 국제 표준 (a)(b)(c), (i)(ii)(iii), \tag{1}, Fig. 1, Table 1
 * 표시: 한국 로케일 → (가)(나)(다), ㄱ.ㄴ.ㄷ., ⋯⋯㉠, [그림1], [표1]
 * 
 * 원본 데이터는 절대 수정하지 않음 — 표시 단계에서만 변환
 */

// ===== 매핑 테이블 =====

// \tag{1} → ㉠ (원문자 한글 자음, U+3260~)
const TAG_TO_KOREAN = [
  '㉠','㉡','㉢','㉣','㉤','㉥','㉦','㉧','㉨','㉩','㉪','㉫','㉬','㉭'
];

// (a) → (가)
const ALPHA_TO_GANA = [
  '가','나','다','라','마','바','사','아','자','차','카','타','파','하'
];

// (i) → ㄱ.
const ROMAN_TO_GIYEOK = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 로마 숫자 → 인덱스
function romanToIndex(roman: string): number {
  const map: Record<string, number> = {
    'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4,
    'vi': 5, 'vii': 6, 'viii': 7, 'ix': 8, 'x': 9,
    'xi': 10, 'xii': 11, 'xiii': 12, 'xiv': 13,
  };
  return map[roman.toLowerCase()] ?? -1;
}

// ===== 수식 영역 보호 =====

interface MathProtection {
  cleaned: string;
  placeholders: string[];
}

function protectMath(text: string): MathProtection {
  const placeholders: string[] = [];
  let idx = 0;

  // $$...$$ 블록 수식 보호 (먼저 처리)
  let cleaned = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    const placeholder = `__MATH_BLOCK_${idx}__`;
    placeholders.push(match);
    idx++;
    return placeholder;
  });

  // $...$ 인라인 수식 보호
  cleaned = cleaned.replace(/(?<!\$)\$(?!\$)(?:[^$\\]|\\.)+\$(?!\$)/g, (match) => {
    const placeholder = `__MATH_INLINE_${idx}__`;
    placeholders.push(match);
    idx++;
    return placeholder;
  });

  return { cleaned, placeholders };
}

function restoreMath(text: string, placeholders: string[]): string {
  let result = text;
  // 역순으로 복원 (인덱스 충돌 방지)
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const blockPlaceholder = `__MATH_BLOCK_${i}__`;
    const inlinePlaceholder = `__MATH_INLINE_${i}__`;
    result = result.replace(blockPlaceholder, placeholders[i]);
    result = result.replace(inlinePlaceholder, placeholders[i]);
  }
  return result;
}

// ===== 변환 함수들 =====

/** 수식 태그 변환: \tag{1} → \tag{\cdots\cdots\,㉠} */
function convertTags(text: string): string {
  return text.replace(
    /\\tag\{(\d+)\}/g,
    (_, num) => {
      const idx = parseInt(num) - 1;
      return idx >= 0 && idx < TAG_TO_KOREAN.length
        ? `\\tag{\\cdots\\cdots\\,${TAG_TO_KOREAN[idx]}}`
        : `\\tag{${num}}`;
    }
  );
}

/** 열거 항목 변환: (a) → (가), 줄 시작에서만 매칭 */
function convertAlphaList(text: string): string {
  return text.replace(
    /^([\s]*)\(([a-z])\)/gm,
    (_, space, ch) => {
      const idx = ch.charCodeAt(0) - 97;
      return idx >= 0 && idx < ALPHA_TO_GANA.length
        ? `${space}(${ALPHA_TO_GANA[idx]})`
        : `${space}(${ch})`;
    }
  );
}

/** 열거 항목 변환: (i) → ㄱ., 줄 시작에서만 매칭 */
function convertRomanList(text: string): string {
  return text.replace(
    /^([\s]*)\((i{1,4}v?i{0,3})\)/gm,
    (_, space, roman) => {
      const idx = romanToIndex(roman);
      return idx >= 0 && idx < ROMAN_TO_GIYEOK.length
        ? `${space}${ROMAN_TO_GIYEOK[idx]}.`
        : `${space}(${roman})`;
    }
  );
}

/** 본문 수식 참조 변환: (1) → ㉠ (수식 밖에서만) */
function convertTagReferences(text: string): string {
  return text.replace(
    /\((\d{1,2})\)/g,
    (original, num) => {
      const idx = parseInt(num) - 1;
      return idx >= 0 && idx < TAG_TO_KOREAN.length
        ? TAG_TO_KOREAN[idx]
        : original;
    }
  );
}

/** 그림 라벨 변환: Fig. 1 / Figure 1 → [그림1] */
function convertFigureLabels(text: string): string {
  return text.replace(
    /\b(?:Fig\.|Figure)\s*(\d+)/gi,
    (_, num) => `[그림${num}]`
  );
}

/** 표 라벨 변환: Table 1 / Tbl. 1 → [표1] */
function convertTableLabels(text: string): string {
  return text.replace(
    /\b(?:Table|Tbl\.)\s*(\d+)/gi,
    (_, num) => `[표${num}]`
  );
}

// ===== 메인 함수 =====

export type Locale = 'international' | 'ko';

/**
 * 로케일에 따라 텍스트를 변환합니다.
 * 
 * 반드시 preprocessMath() 이전에 호출해야 합니다.
 * 수식 내부는 보호되므로 오변환이 발생하지 않습니다.
 * 
 * @param text - raw_text (Firestore 저장값)
 * @param locale - 'international' | 'ko'
 * @returns 로케일 변환된 텍스트
 */
export function preprocessLocale(text: string, locale: Locale): string {
  if (locale !== 'ko') return text;

  // 1단계: 수식 태그 변환 (수식 내부이므로 보호 전에 처리)
  let result = convertTags(text);

  // 2단계: 수식 영역 보호
  const { cleaned, placeholders } = protectMath(result);

  // 3단계: 수식 밖에서 변환
  let processed = convertAlphaList(cleaned);
  processed = convertRomanList(processed);
  processed = convertTagReferences(processed);
  processed = convertFigureLabels(processed);
  processed = convertTableLabels(processed);

  // 4단계: 수식 복원
  result = restoreMath(processed, placeholders);

  return result;
}

// 개별 함수도 export (테스트용)
export {
  convertTags,
  convertAlphaList,
  convertRomanList,
  convertTagReferences,
  convertFigureLabels,
  convertTableLabels,
  protectMath,
  restoreMath,
  TAG_TO_KOREAN,
  ALPHA_TO_GANA,
  ROMAN_TO_GIYEOK,
};