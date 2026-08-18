/**
 * Mathory Locale Preprocessing
 * 
 * 저장: 작성 로케일의 표기를 그대로 (한국 문항 → (가)(나), ㄱ.ㄴ. 리터럴)
 *       — 국제 표준으로의 역변환은 하지 않는다
 *       (Phase 60 D1: "글로벌 통일을 버리고 로케일 블록으로")
 * 표시: 레거시 국제 표기((a)/(i))는 여전히 (가)/ㄱ.로 변환해 옛 문항 호환을 유지.
 *       그 밖에 \tag{1}, \ref{1}, Fig. 1, Table 1, ㉠㉡㉢, [그림1], [표1]
 * 
 * 원본 데이터는 절대 수정하지 않음 — 표시 단계에서만 변환
 */

import { LEGACY_CASE_RE } from './caseBlock';

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

// ===== 마커 정규식 (사본 공유 — Phase 60 P4) =====
// ⚠ components/editor/EditorPreview.tsx의 인라인 preprocessLocale이 이 상수들을 import한다.
//    정규식을 두 파일에 따로 적어 두면 조용히 이격된다 (실제로 그런 상태였다).
// ⚠ 전부 /g 없이 정의한다 — 소비처가 new RegExp(RE.source, 'gm')로 인스턴스를 만들어
//    lastIndex 오염을 피한다 (lib/solutionOutline.ts:72와 같은 처방).

/** 행 선두 들여쓰기 = "개행 아닌 공백".
 *  행 단위로 자른 뒤 .test()하는 자리에만 쓴다 → 개행이 애초에 들어올 수 없다.
 *  \s와 문자 집합이 같아 기존 동작을 그대로 보존하면서, 개행 배제가 클래스 자체에
 *  박혀 있어 혹시 /gm으로 재사용해도 안전하다.
 *  ⚠ [ \t]나 [ \t\u00A0\u3000]으로 좁히면 NBSP·전각 공백·en space 등이 빠져
 *    HWP·웹에서 붙여넣은 문항의 문단 분리가 조용히 회귀한다. */
const IND = '[^\\S\\n\\r]*';

/** 행 시작이 마커인가 — 마커 행 앞에 빈 줄을 넣어 독립 <p>를 보장할 때 쓴다. */
export const MARKER_LINE_RE = new RegExp(
  `^${IND}(?:\\((?:iii|ii|iv|v|i|[a-e])\\)` +
  `|\\((?:가|나|다|라|마|바|사|아|자|차)\\)` +
  `|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\\.` +
  `|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])`
);

/** 행 시작 (a)~(e) → marker span.
 *  뒤 공백은 [ \t]*로 흡수한다 — 입력에 띄어쓰기를 하건 안 하건 마커·본문
 *  간격이 같아야 한다(Phase 60 P2). 간격은 CSS의 마커 고정폭이 공급한다.
 *  ⚠ \s*는 개행까지 삼켜 다음 줄을 빨아들인다 (Phase 57). */
export const ALPHA_LINE_RE = /^\(([a-e])\)[ \t]*/;

/** 행 시작 (i)~(v) → marker span. 뒤 공백 흡수는 위와 같다. */
export const ROMAN_LINE_RE = /^\((iii|ii|iv|v|i)\)[ \t]*/;

/** 행 시작 (가)~(차) 리터럴 → marker span. 뒤 공백은 정규식이 흡수한다(Phase 60 P2).
 *  ⚠ 레거시와 달리 매핑 테이블이 없으므로 5개 상한을 둘 이유가 없다. 상한을 남기면
 *    (바)를 쓴 사용자가 "그 줄만 내어쓰기가 빠지는" 조용한 결함을 겪는다 (D9). */
export const GANA_LITERAL_RE = /^\((가|나|다|라|마|바|사|아|자|차)\)[ \t]*/;

/** 행 시작 ㄱ.~ㅊ. 리터럴 → marker span */
export const GIYEOK_LITERAL_RE = /^([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.[ \t]*/;

/** 행 시작 ①~⑮ → marker span.
 *  뒤 공백은 [ \t]*로만 먹는다 — \s*를 쓰면 개행까지 삼켜서, 내용이 아직 없는
 *  원문자 줄들(`① `↵`② `)이 한 문단으로 뭉친다('목록' 블록 프리셋, Phase 57). */
export const CIRCLED_NUM_LINE_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])[ \t]*/;

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
    const isMarkerLine = MARKER_LINE_RE.test(line);
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
    // Phase 59: 같은 문법을 요약 보기(lib/solutionOutline.ts)도 스캔한다 →
    //           패턴은 lib/caseBlock.ts의 상수 하나로 공유한다(사본 이격 방지).
    const isTopCaseLabel = LEGACY_CASE_RE.test(line);
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
 *  ⚠️ 렌더 파이프라인 전용 — raw_text 저장 경로 호출 금지 (D8)
 *  ⚠️ Phase 59: 판정만 하는 곳(요약 보기)은 caseBlock.LEGACY_SUBCASE_RE를 쓴다.
 *     여기만 캡처 그룹 + /gm이 필요해 별도 리터럴을 유지한다 — 문법은 동일하다. */
export function convertSubcaseMarkers(text: string): string {
  return text.replace(
    /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
  );
}

/** (a) → (가) — 행 시작: marker span(내어쓰기용), 행 중간: 텍스트만 */
function convertAlphaList(text: string): string {
  let result = text.replace(new RegExp(ALPHA_LINE_RE.source, 'gm'), (_, ch) => {
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
  let result = text.replace(new RegExp(ROMAN_LINE_RE.source, 'gm'), (_, r) => {
    const korean = GIYEOK[r];
    return korean ? `<span class="marker-giyeok">${korean}.</span>` : `(${r})`;
  });
  result = result.replace(/([^a-zA-Z0-9\n])\((iii|ii|iv|v|i)\)/g, (_, pre, r) => {
    const korean = GIYEOK[r];
    return korean ? `${pre}${korean}.` : `${pre}(${r})`;
  });
  return result;
}

/** (가)~(차) 리터럴 → 행 시작 marker span (Phase 60 P1).
 *  행 중간은 이미 리터럴이라 변환할 것이 없다.
 *  레거시 변환 뒤에 두어도 안전하다 — 그쪽이 만든 행은 `<span …>`으로 시작해
 *  `^\(`에 걸리지 않는다(멱등). */
function convertGanaLiteral(text: string): string {
  return text.replace(new RegExp(GANA_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-gana">(${ch})</span>`);
}

/** ㄱ.~ㅊ. 리터럴 → 행 시작 marker span (Phase 60 P1) */
function convertGiyeokLiteral(text: string): string {
  return text.replace(new RegExp(GIYEOK_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-giyeok">${ch}.</span>`);
}

/** ①②③ … 행 시작 → marker span (수식 표시와 같은 들여쓰기)
 *  마커 뒤 공백은 [ \t]*로만 먹는다 — \s*를 쓰면 개행까지 삼켜서, 내용이 아직 없는
 *  원문자 줄들(`① `↵`② `)이 한 문단으로 뭉친다('목록' 블록 프리셋, Phase 57). */
function convertCircledList(text: string): string {
  return text.replace(new RegExp(CIRCLED_NUM_LINE_RE.source, 'gm'),
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
  processed = convertGanaLiteral(processed);      // Phase 60 P1 — 직접 입력한 (가)~(차)
  processed = convertGiyeokLiteral(processed);    // Phase 60 P1 — 직접 입력한 ㄱ.~ㅊ.
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
  convertGanaLiteral,
  convertGiyeokLiteral,
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