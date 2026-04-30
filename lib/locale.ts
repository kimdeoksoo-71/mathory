/**
 * Mathory Locale Preprocessing
 * 
 * 저장: 국제 표준 (a)(b)(c), (i)(ii)(iii), \tag{1}, \ref{1}, Fig. 1, Table 1
 * 표시: 한국 로케일 → (가)(나)(다), ㄱ.ㄴ.ㄷ., ㉠㉡㉢, [그림1], [표1]
 * 
 * 원본 데이터는 절대 수정하지 않음 — 표시 단계에서만 변환
 */

// ===== 매핑 테이블 =====

export const CIRCLED_CONSONANTS = [
  '㉠','㉡','㉢','㉣','㉤','㉥','㉦','㉧','㉨','㉩','㉪','㉫','㉬','㉭'
];

const GANA: Record<string, string> = {
  a: '가', b: '나', c: '다', d: '라', e: '마',
};

const GIYEOK: Record<string, string> = {
  i: 'ㄱ', ii: 'ㄴ', iii: 'ㄷ', iv: 'ㄹ', v: 'ㅁ',
};

// ===== 수식 영역 보호 =====

interface MathProtection {
  cleaned: string;
  placeholders: string[];
}

function protectMath(text: string): MathProtection {
  const placeholders: string[] = [];
  const protect = (m: string) => {
    placeholders.push(m);
    return `⟦MATH_${placeholders.length - 1}⟧`;
  };
  let cleaned = text
    .replace(/\$\$[\s\S]*?\$\$/g, protect)
    .replace(/\\\[[\s\S]*?\\\]/g, protect)
    .replace(/\$(?:[^$\\]|\\.)+\$/g, protect)
    .replace(/\\\([\s\S]*?\\\)/g, protect);
  return { cleaned, placeholders };
}

function restoreMath(text: string, placeholders: string[]): string {
  return text.replace(/⟦MATH_(\d+)⟧/g, (_, idx) => placeholders[parseInt(idx)]);
}

// ===== 변환 함수들 =====

/**
 * (a)~(e), (i)~(v) 시작 행 앞에 빈 줄 강제 삽입 → 독립 <p> 보장
 * 이전 줄이 내용이 있고 빈 줄이 아닌 경우에만 삽입
 * 
 * ★ 반드시 convertAlphaList, convertRomanList 이전에 호출해야 함
 */
function insertMarkerLineBreaks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMarkerLine =
      /^\s*\((iii|ii|iv|v|i|[a-e])\)/.test(line) ||
      /^\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/.test(line);
    const prevLine = result.length > 0 ? result[result.length - 1] : '';
    if (isMarkerLine && prevLine.trim() !== '') {
      result.push('');
    }
    result.push(line);
  }
  return result.join('\n');
}

/** (a) → (가) — 행 시작: marker span(내어쓰기용), 행 중간: 텍스트만 */
function convertAlphaList(text: string): string {
  let result = text.replace(/^\(([a-e])\)/gm, (_, ch) => {
    const korean = GANA[ch];
    return korean ? `<span class="marker-gana">(${korean})</span>` : `(${ch})`;
  });
  result = result.replace(/([^a-zA-Z0-9\n])\(([a-e])\)/g, (_, pre, ch) => {
    const korean = GANA[ch];
    return korean ? `${pre}(${korean})` : `${pre}(${ch})`;
  });
  return result;
}

/** (i) → ㄱ. — 행 시작: marker span(내어쓰기용), 행 중간: 텍스트만 */
function convertRomanList(text: string): string {
  let result = text.replace(/^\((iii|ii|iv|v|i)\)/gm, (_, r) => {
    const korean = GIYEOK[r];
    return korean ? `<span class="marker-giyeok">${korean}.</span>` : `(${r})`;
  });
  result = result.replace(/([^a-zA-Z0-9\n])\((iii|ii|iv|v|i)\)/g, (_, pre, r) => {
    const korean = GIYEOK[r];
    return korean ? `${pre}${korean}.` : `${pre}(${r})`;
  });
  return result;
}

/** ①②③ … 행 시작 → marker span (수식 표시와 같은 들여쓰기) */
function convertCircledList(text: string): string {
  return text.replace(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])\s*/gm,
    (_, ch) => `<span class="marker-circled">${ch}</span>`);
}

/** \ref{n} → ㉠ (텍스트 영역) */
function convertRefReferences(text: string): string {
  return text.replace(/\\ref\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    return idx >= 0 && idx < CIRCLED_CONSONANTS.length
      ? CIRCLED_CONSONANTS[idx] : match;
  });
}

/** \tag{n} (텍스트 행 끝) → tag-marker span */
function convertTextTags(text: string): string {
  return text.replace(/\\tag\{(\d+)\}\s*$/gm, (match, num) => {
    const idx = parseInt(num) - 1;
    return idx >= 0 && idx < CIRCLED_CONSONANTS.length
      ? `<span class="tag-marker">…… ${CIRCLED_CONSONANTS[idx]}</span>` : match;
  });
}

/** Fig. 1 → [그림1] */
function convertFigureLabels(text: string): string {
  return text.replace(/\b(?:Fig\.|Figure)\s*(\d+)/gi, (_, num) => `[그림${num}]`);
}

/** Table 1 → [표1] */
function convertTableLabels(text: string): string {
  return text.replace(/\b(?:Table|Tbl\.)\s*(\d+)/gi, (_, num) => `[표${num}]`);
}

// ===== 메인 함수 =====

export type Locale = 'international' | 'ko';

export function preprocessLocale(text: string, locale: Locale): string {
  if (locale !== 'ko') return text;

  // 1단계: 수식 영역 보호
  const { cleaned, placeholders } = protectMath(text);

  // 2단계: 마커 행 앞에 빈 줄 삽입 (★ 변환 전에 실행)
  let processed = insertMarkerLineBreaks(cleaned);

  // 3단계: 텍스트 변환
  processed = convertAlphaList(processed);
  processed = convertRomanList(processed);
  processed = convertCircledList(processed);
  processed = convertRefReferences(processed);
  processed = convertTextTags(processed);
  processed = convertFigureLabels(processed);
  processed = convertTableLabels(processed);

  // 4단계: 수식 복원
  return restoreMath(processed, placeholders);
}

export {
  insertMarkerLineBreaks,
  convertAlphaList,
  convertRomanList,
  convertCircledList,
  convertRefReferences,
  convertTextTags,
  convertFigureLabels,
  convertTableLabels,
  protectMath,
  restoreMath,
  GANA,
  GIYEOK,
};