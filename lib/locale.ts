/**
 * Mathory Locale Preprocessing
 * 
 * 저장: 작성 로케일의 표기를 그대로 (한국 문항 → (가)(나), ㄱ.ㄴ. 리터럴)
 *       — 국제 표준으로의 역변환은 하지 않는다
 *       (Phase 60 D1: "글로벌 통일을 버리고 로케일 블록으로")
 * 표시: 로케일 변환은 \tag{1}, \ref{1}, Fig. 1, Table 1, [그림1], [표1] 등.
 *       ⚠ (a)→(가), (i)→ㄱ. 변환은 **없다** (Phase 60 후속에서 삭제). 두 표기가
 *         공존하면 "무엇을 쓰면 무엇이 나오는지"가 흐려져 오히려 혼란스럽다.
 *         옛 문항의 (a)는 그대로 보이며, 손볼 때 리터럴로 고친다.
 * 
 * 원본 데이터는 절대 수정하지 않음 — 표시 단계에서만 변환
 */

import { LEGACY_CASE_RE, convertCaseRefs } from './caseBlock';

// ===== 매핑 테이블 =====

export const CIRCLED_CONSONANTS = [
  '㉠','㉡','㉢','㉣','㉤','㉥','㉦','㉧','㉨','㉩','㉪','㉫','㉬','㉭'
];

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

/** 행 시작이 마커인가 — 마커 행 앞에 빈 줄을 넣어 독립 <p>를 보장할 때 쓴다.
 *
 *  ⚠ 레거시 `(a)~(e)`·`(i)~(v)`는 **변환하지 않지만 여기에는 남긴다**(Phase 60 후속).
 *    변환을 걷어내면서 이것까지 빼면, 옛 문항의 `(a) …`↵`(b) …`가 remark-breaks 부재
 *    때문에 한 문단으로 뭉쳐 읽을 수 없게 된다. 행 분리는 마크다운 렌더 보조일 뿐
 *    로케일 변환이 아니므로 남기는 것이 맞다 — 옛 문항은 `(a)`가 그대로 보이되
 *    줄은 유지되어, 고칠 자리가 눈에 띈다. */
export const MARKER_LINE_RE = new RegExp(
  `^${IND}(?:\\((?:iii|ii|iv|v|i|[a-e])\\)` +
  `|\\((?:가|나|다|라|마|바|사|아|자|차)\\)` +
  `|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\\.` +
  `|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])`
);

/** 행 시작 (가)~(차) → marker span. 뒤 공백은 정규식이 흡수한다 — 띄어쓰기를 하건
 *  안 하건 마커·본문 간격이 같아야 한다(Phase 60 P2). 간격은 CSS 고정폭이 공급한다.
 *  ⚠ \s*는 개행까지 삼켜 다음 줄을 빨아들인다 (Phase 57).
 *  ⚠ 범위 10개 — 매핑 테이블이 없으므로 상한을 둘 이유가 없다. 상한을 남기면 (바)를
 *    쓴 사용자가 "그 줄만 내어쓰기가 빠지는" 조용한 결함을 겪는다 (D9). */
export const GANA_LITERAL_RE = /^\((가|나|다|라|마|바|사|아|자|차)\)[ \t]*/;

/** 행 시작 ㄱ.~ㅊ. 리터럴 → marker span */
export const GIYEOK_LITERAL_RE = /^([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.[ \t]*/;

/** 행 시작 ①~⑮ → marker span.
 *  뒤 공백은 [ \t]*로만 먹는다 — \s*를 쓰면 개행까지 삼켜서, 내용이 아직 없는
 *  원문자 줄들(`① `↵`② `)이 한 문단으로 뭉친다('목록' 블록 프리셋, Phase 57). */
export const CIRCLED_NUM_LINE_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])[ \t]*/;

/** 수식 하나만 있는 행 (뒤에 `\tag{n}` 꼬리표는 허용).
 *
 *  ⚠ **수식 보호가 끝난 뒤의 모양**을 본다 — 이 시점에 수식은 이미 `⟦MATH_n⟧`이다.
 *    `$…$`로 적으면 영영 매칭되지 않는다.
 *  ⚠ EditorPreview의 사본도 이 상수를 가져다 쓴다 — 사본을 만들지 말 것.
 */
export const MATH_ONLY_LINE_RE = /^⟦MATH_\d+⟧(?:[ \t]*\\tag\{\d+\})?[ \t]*$/;

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
 * 마커 행(MARKER_LINE_RE) 앞에 빈 줄 강제 삽입 → 독립 <p> 보장.
 * 이전 줄이 내용이 있고 빈 줄이 아닌 경우에만 삽입.
 *
 * ★ 반드시 marker span 변환 이전에 호출해야 한다 — 변환 뒤에는 행이 `<span …>`으로
 *   시작해 MARKER_LINE_RE에 걸리지 않는다.
 */
function insertMarkerLineBreaks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMarkerLine = MARKER_LINE_RE.test(line);
    const prevLine = result.length > 0 ? result[result.length - 1] : '';
    // 개선묶음 M1 A — 수식만 있는 행이 연달아 오면 사이에 빈 줄을 넣는다.
    //   ⚠ 소스에는 빈 줄을 두지 않는다(덕수 요청)는 규약의 대가다. remark-breaks가 없어
    //     빈 줄이 없으면 세 행이 **한 문단**으로 합쳐지고 `\tag` 꼬리표들이 같은 문단
    //     오른쪽에 겹쳐 뜬다(실측). 행 분리는 예나 지금이나 여기가 담당한다.
    //   ⚠ "앞 행도 수식만"일 때로 좁힌다 — 산문 뒤에 오는 수식 행은 지금까지처럼 이어 붙는다.
    const splitMathRun = MATH_ONLY_LINE_RE.test(line) && MATH_ONLY_LINE_RE.test(prevLine);
    if ((isMarkerLine && prevLine.trim() !== '') || splitMathRun) {
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

/* ═══ 개선묶음 M2 C — 참조 인용(hover 말풍선)용 마크업 ═══
   정의부(원본)는 이미 전부 span으로 감싸져 있다(marker-gana·marker-giyeok·
   marker-circled·tag-marker·case-label + KaTeX .tag). 없던 것은 **재인용부**뿐이라
   여기서 그것만 만든다. 시각 표시는 주지 않는다 — cursor:help만(D18′).

   ⚠ 이 마크업은 5개 렌더 사이트 전부에 생긴다(preprocessLocale이 공용이므로).
     말풍선 리스너는 `[data-ref-tooltip]` 조상이 있는 곳에서만 붙는다(D16′) —
     그래서 편집 미리보기·인쇄·폴더뷰에서는 마크업이 있어도 아무 일도 없다.
   ⚠ 수식 안은 애초에 대상이 아니다: 이 시점에 수식은 이미 `⟦MATH_n⟧`다(protectMath). */

/** 행 중간 `(가)~(차)` 재인용 */
export const REF_GANA_RE = /\((가|나|다|라|마|바|사|아|자|차)\)/;

/** 행 중간 `①~⑮` 재인용 */
export const REF_CIRCLED_RE = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/;

/** 행 중간 낱자 `ㄱ~ㅊ` 재인용 (뒤따르는 `.` 포함).
 *
 *  ⚠ **범위 표기 `[ㄱ-ㅊ]`를 쓰지 말 것** — 호환 자모 순서상 ㄲ·ㄸ·ㅃ·ㅆ·ㅉ이 그 안에
 *    들어온다. `GIYEOK_LITERAL_RE`가 명시 10자 클래스를 쓰는 이유와 같다.
 *  ⚠ **뒤쪽 lookahead에서 한글 음절을 배제하지 말 것** — 자모 참조 뒤에는 조사가
 *    붙는 것이 정상 표기라(`ㄱ이`·`ㄱ은`·`ㄷ에서`·`ㄴ의`) 배제하면 실사용 표본
 *    7개 중 4개를 놓친다(v2 C-16 실측). 앞쪽만 막으면 오탐 0으로 충분하다.
 *    잔여 오탐 후보는 `ㄱ자 모양` 정도인데, 정의부가 없으면 말풍선이 뜨지 않고
 *    시각 표시도 없어 사용자에게 드러나지 않는다. */
export const REF_GIYEOK_RE =
  /(?<![가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9])([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])(\.?)(?![ㄱ-ㅎㅏ-ㅣA-Za-z0-9])/;

/** 행 선두의 "정의부 자리" — 여기 있는 마커는 참조가 아니다.
 *  (변환된 정의부는 이미 span이라 보호되지만, 들여쓴 `  (가)`처럼 변환을 못 받은
 *   것이 남을 수 있어 한 겹 더 막는다.) */
const REF_LEAD_RE = /^(?:\([가나다라마바사아자차]\)|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/;

/**
 * 정의부·참조부 텍스트 비교용 정규화 (D15″).
 *
 * ⚠ 꼬리 `.`을 떼는 것이 핵심이다 — 정의부는 `ㄱ.`·`C1.`인데 참조는 `ㄱ`·`C1`이라
 *   그대로 비교하면 두 유형이 **영원히 매칭되지 않는다**. 나머지(`(3)`·`①`·`(가)`)는
 *   원래 일치한다.
 * ⚠ `$`도 함께 지운다 — 모델·사용자가 인용을 옮기며 구분자를 떨어뜨리는 일이 있다
 *   (Phase 61b에서 같은 처방을 썼다).
 */
export function normalizeRefText(s: string): string {
  return s.trim().replace(/[\s$]/g, '').replace(/\.$/, '');
}

/** 마크업 보호 후 fn을 돌리고 되돌린다 (D12″).
 *
 *  순서가 규약이다: 코드펜스 → **요소 통째** → 남은 낱개 태그 → 인라인 코드.
 *  ⚠ 요소 통째 목록에 `ref-marker` **자신**이 들어 있어야 한다 — 없으면 2회째
 *    실행에서 여닫는 태그만 낱개로 빠지고 내부 `①`이 노출돼 재감쌈된다(멱등성 파괴).
 *  ⚠ 목록에서 marker 계열을 빠뜨리면 `<span class="marker-gana">(가)</span>` 안의
 *    `(가)`가 다시 감싸져 **정의부가 참조로 둔갑한다**(프로토타입 실측 5건).
 *  ⚠ `convertCaseRefs`도 같은 일을 자체 수행하지만 목록이 다르다(그쪽은 `case-label`
 *    하나뿐이고 M1에서 고정됐다). 합치지 말 것 — 보호 범위가 서로 다른 이유가 있다. */
const PROTECTED_ELEMENT_RE =
  /<span class="(?:ref-marker|marker-gana|marker-giyeok|marker-circled|marker-case-sub|tag-marker|case-label)"[^>]*>[\s\S]*?<\/span>/g;

function protectMarkup(text: string, fn: (t: string) => string): string {
  const holds: string[] = [];
  const keep = (m: string) => {
    holds.push(m);
    return `\u0000M2R${holds.length - 1}\u0000`;       // 본문에 나타날 수 없는 표지
  };
  let out = text
    .replace(/```[\s\S]*?```/g, keep)
    .replace(/~~~[\s\S]*?~~~/g, keep)
    .replace(PROTECTED_ELEMENT_RE, keep)                // ← 요소 통째 (반드시 낱개 태그보다 먼저)
    .replace(/<[^>\n]+>/g, keep)
    .replace(/(`+)[^`\n]*\1/g, keep);
  out = fn(out);
  return out.replace(/\u0000M2R(\d+)\u0000/g, (_, i) => holds[parseInt(i, 10)]);
}

const refSpan = (type: string, ref: string, inner: string) =>
  `<span class="ref-marker" data-reftype="${type}" data-ref="${ref}">${inner}</span>`;

/** 본문 중간의 `(가)`·`①`·`ㄱ` 재인용을 ref-marker로 감싼다 (D11′②③④).
 *  `\ref{n}`(①)은 convertRefReferences가, `C1`(⑤)은 convertCaseRefs가 담당한다. */
export function convertRefMarkers(text: string): string {
  return protectMarkup(text, (t) =>
    t.split('\n').map((line) => {
      const ind = line.match(/^[ \t]*/)![0];
      const body = line.slice(ind.length);
      const lead = body.match(REF_LEAD_RE)?.[0] ?? '';   // 행 선두 정의부 자리는 건너뛴다
      /* ⚠ 상수는 이 파일 규약대로 /g 없이 정의하고 여기서 인스턴스를 만든다
           — lastIndex 오염과, 나중에 누가 `.test()`로 쓰다 당하는 것을 함께 막는다. */
      const rest = body.slice(lead.length)
        .replace(new RegExp(REF_GANA_RE.source, 'g'), (m, ch) => refSpan('gana', ch, m))
        .replace(new RegExp(REF_CIRCLED_RE.source, 'g'), (m) => refSpan('circled', m, m))
        .replace(new RegExp(REF_GIYEOK_RE.source, 'g'), (m, ch) => refSpan('giyeok', ch, m));
      return ind + lead + rest;
    }).join('\n'));
}

/** \ref{n} → 참조 번호 (n). 개선묶음 M2 C에서 평문이 아니라 ref-marker span이 됐다. */
function convertRefReferences(text: string): string {
  return text.replace(/\\ref\{(\d+)\}/g, (_, num) => refSpan('tag', num, `(${num})`));
}

/** \tag{n} (텍스트 행 끝) → tag-marker span, 참조 번호 (n) */
function convertTextTags(text: string): string {
  // ⚠ `\s*$`를 쓰면 안 된다 — `\s`는 개행을 삼켜 뒤따르는 **빈 줄을 먹는다**.
  //   그러면 `\tag`로 끝난 문단이 다음 문단과 한 덩어리가 된다(M1에서 실측·정정).
  //   행 단위 전처리는 `[ \t]*`만 쓴다(Phase 57 규약).
  return text.replace(/\\tag\{(\d+)\}[ \t]*$/gm, (_, num) =>
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
  //   ⚠ 레거시 (a)/(i) → (가)/ㄱ. 변환은 없다 (Phase 60 후속에서 삭제). 옛 문항의
  //     `(a)`는 이제 그대로 렌더된다 — 손볼 문항은 그때그때 리터럴로 고친다.
  processed = convertGanaLiteral(processed);
  processed = convertGiyeokLiteral(processed);
  processed = convertCircledList(processed);
  processed = convertRefReferences(processed);
  processed = convertTextTags(processed);
  processed = convertFigureLabels(processed);
  processed = convertTableLabels(processed);
  // 개선묶음 M2 C — 본문 중간의 (가)·①·ㄱ 재인용을 ref-marker로. 마커 변환이 전부
  //   끝난 뒤여야 한다: 정의부가 이미 span이어야 protectMarkup이 그것을 보호한다.
  processed = convertRefMarkers(processed);
  // 개선묶음 M1 G — 본문의 C1·C2a 참조를 굵게. 마지막 텍스트 단계다(수식은 아직 placeholder).
  //   ⚠ 보호는 convertCaseRefs가 스스로 한다 — 이 사본에는 코드펜스 보호가 없다.
  processed = convertCaseRefs(processed);

  // 4단계: 수식 복원
  return restoreMath(processed, placeholders);
}

export {
  insertMarkerLineBreaks,
  convertGanaLiteral,
  convertGiyeokLiteral,
  convertCircledList,
  convertRefReferences,
  convertTextTags,
  convertFigureLabels,
  convertTableLabels,
  protectMath,
  restoreMath,
};