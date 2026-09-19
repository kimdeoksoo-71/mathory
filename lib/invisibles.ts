/**
 * M9 D24-1′ — 비가시·동형 문자 정규화. 순수 모듈(**import 0** · `npm run test:invisibles`가 단독 컴파일).
 *
 * 취지: ㄱ,ㄴ 상자 첫 행 `ㄱ.`이 호환 자모 U+3131이 아니라 **초성 자모 U+1100**(모양 동일)으로 들어와
 * 마커 정규식을 비껴가고 재인용(ref-marker)으로 오분류됐다(M9 M1 실측 `1100 2e 20 24`).
 * `'ㄱ'.normalize('NFKC')`가 곧 U+1100이라 유입원의 NFKC/NFKD 처리가 의심된다(§1-G7).
 * 폭 0 문자·행머리 NBSP도 같은 부류 — 편집창에서 보이지 않아 추적이 안 된다.
 *
 * ⚠ 순서가 규칙이다:
 *   ① 결합 자모 연쇄(초성+중성[+종성])를 **먼저** NFC 음절로 조합 — NFD 한글(Drive 파일명의 절반,
 *      61e-2차)을 보존한다. 초성을 먼저 매핑하면 `가`(U+1100 U+1161)가 `ㄱ`+`ᅡ`로 쪼개지고
 *      NFC로도 복원되지 않는다(실측).
 *   ② 폭 0·채움 문자 제거(한글 채움 U+3164·U+115F·U+1160 포함 — 조합 재료를 먼저 소진한 뒤, 부록 C-4)
 *   ③ 행머리 비ASCII 공백만 제거(ASCII 들여쓰기는 목록·코드블록 의미가 있어 보존)
 *   ④ **단독** 초성(뒤에 중성이 없는 것)만 호환 자모로
 *   ⑤ 자모 뒤 전각·리더 마침표 → `.`
 * ⚠ 전역 `normalize('NFC')` 금지 — U+2126→U+03A9, 호환 한자 U+F900→U+8C48 같은 부수 변경이 있다.
 * ⚠ ZWJ(U+200D)는 지우지 않는다 — 이모지 합자(M5 이후 본문 이모지는 OS 글꼴로 그린다).
 * ⚠ raw_text의 **표기**는 바꾸지 않는다 — 보이지 않거나 모양이 같은 글자만 다룬다.
 */

const NFD_SYL_RE = /[\u1100-\u115F][\u1160-\u11A7][\u11A8-\u11FF]?/g;
const ZW_RE = /[\u200B\u200C\u2060\uFEFF\u00AD\u034F\u3164\u115F\u1160]/g;
const LEAD_WS_RE = /^([ \t]*)[\u00A0\u3000\u2000-\u200A\u202F]+/gm;
const LONE_CHOSEONG_RE = /[\u1100-\u1112](?![\u1160-\u11A7])/g;
/** U+1100 + i → 호환 자모 (현대 초성 19종, 순서가 비선형이라 표로) */
const CHOSEONG_TO_COMPAT = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JAMO_DOT_RE = /([\u3131-\u314E])[\uFF0E\u2024]/g;

export function stripInvisibles(s: string): string {
  if (!s) return s;
  return s
    .replace(NFD_SYL_RE, (m) => m.normalize('NFC'))
    .replace(ZW_RE, '')
    .replace(LEAD_WS_RE, '$1')
    .replace(LONE_CHOSEONG_RE, (c) => CHOSEONG_TO_COMPAT[c.charCodeAt(0) - 0x1100] ?? c)
    .replace(JAMO_DOT_RE, '$1.');
}

/** 정규화 대상 블록 타입 — 그림·SVG·GeoGebra의 raw_text는 텍스트가 아니다 */
export function isInvisibleTarget(type: string): boolean {
  return type !== 'image' && type !== 'svg' && type !== 'ggb';
}

/** 편집기 가시화(M9 D24-3′)용 — 정규화가 다루는 글자 중 CM 기본 Specials에 없는 것.
 *  ⚠ 초성은 **단독**만 — 범위 전체를 넣으면 붙여넣은 NFD 한글의 초성이 전부 점으로 보인다.
 *  NBSP·U+3000은 행머리 외에는 정규화하지 않으므로 넣으면 영구 점이 된다 → 제외. */
export const INVISIBLE_SPECIAL_CHARS = /[\u200C\u2060\u3164\uFF0E\u2024]|[\u1100-\u1112](?![\u1160-\u11A7])/;
