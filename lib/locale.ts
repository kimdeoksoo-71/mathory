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

/** 하위 케이스 리스트 뒤 새 `**Case …**` 라벨이 lazy continuation으로
 *  직전 리스트 항목에 흡수되는 것을 방지 (D7, Phase 54).
 *  - 대상: 행 시작이 `**Case <숫자>…**` 인 "최상위" 라벨 행
 *    (리스트 마커 `- ` 로 시작하는 하위 케이스 행은 `^\*\*` 에 걸리지 않으므로 자동 제외)
 *  - 이전 행이 비어있지 않을 때만 빈 줄 삽입 (insertMarkerLineBreaks와 동일 패턴)
 *  - 최상위 Case 문단 앞 빈 줄 삽입은 항상 무해 → 진입 케이스에도 부작용 없음
 *  - 수식이 placeholder로 보호된 뒤 호출되어야 안전 (preprocess() 배치 참조)
 *  - ⚠️ 렌더 파이프라인 전용 — raw_text 저장 경로 호출 금지 (D8)
 *
 *  한계: `**Case …**` 형태가 아닌 자유 문단이 하위 케이스 뒤에 빈 줄 없이
 *  이어지면 여전히 CommonMark 표준대로 흡수됨(일반 리스트와 동일 동작).
 *  지배 사례인 "연속된 Case 라벨"만 이 함수로 보증. */
export function normalizeCaseBoundaries(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    // 최상위 Case 라벨: 행 시작 `**Case 1.**` / `**Case 1a.**` (리스트 `- ` 없음)
    const isTopCaseLabel = /^\*\*Case\s+\d+[a-z]?\.\*\*/.test(line);
    const prev = out.length > 0 ? out[out.length - 1] : '';
    if (isTopCaseLabel && prev.trim() !== '') {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}

/** 하위 케이스 라벨 → marker span (불릿 숨김 + 들여쓰기 타게팅용)
 *  `- **Case 1a.** …` 형태의 최상위 리스트 항목만 매칭.
 *  상위 케이스(`**Case 1.**`, 리스트 밖)는 변환하지 않음.
 *  로케일 무관 → preprocessLocale 밖에서 무조건 호출됨 (D4).
 *  ⚠️ 렌더 파이프라인 전용 — raw_text 저장 경로 호출 금지 (D8) */
export function convertSubcaseMarkers(text: string): string {
  return text.replace(
    /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
  );
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

/** \ref{n} → (n) (텍스트 영역, 참조 번호) */
function convertRefReferences(text: string): string {
  return text.replace(/\\ref\{(\d+)\}/g, (_, num) => `(${num})`);
}

/** \tag{n} (텍스트 행 끝) → tag-marker span, 참조 번호 (n) */
function convertTextTags(text: string): string {
  return text.replace(/\\tag\{(\d+)\}\s*$/gm, (_, num) =>
    `<span class="tag-marker">(${num})</span>`);
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