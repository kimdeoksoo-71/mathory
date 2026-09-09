/* ═══════════════════════════════════════════════════════════════
   Phase 64 D1·D2 — 휴대폰 판별 순수 함수 (import 0 · npm run test:device)

   판별식: 폰 = 폭 ≤ 599 ∨ (높이 ≤ 599 ∧ 터치(coarse)).
   ⚠ 세로(높이) 조건에서 coarse를 빼면 PC의 낮고 넓은 창(1200×500)이 폰이 된다 —
     coarse 결합이 "폰 가로는 폰, PC 낮은 창은 데스크톱"을 가른다(v2 E-1).
   ⚠ 서버 UA 추정은 태블릿(iPad · Tablet · `Mobile` 없는 Android)을 명시적으로
     제외한다(v3 F-2) — Android 태블릿 Chrome은 UA에서 Mobile 토큰만 빠진다.
   소비처: 서버 = 라우트 page.tsx의 headers() → initialPhone /
   클라이언트 = hooks/useIsPhone(matchMedia 보정). CSS는 판별하지 않는다 —
   [data-phone] 속성 스코프만 읽는다(판별용 @media 금지, CLAUDE.md 규약).
   ═══════════════════════════════════════════════════════════════ */

/** 폰 판별 임계(CSS px). 짧은 변이 아니라 "폭, 또는 터치 기기의 높이"에 걸린다. */
export const PHONE_MAX_SHORT_SIDE = 599;

/** 클라이언트 보정용 미디어 쿼리 — isPhoneViewport와 같은 식의 CSS 표현.
 *  ⚠ 이 문자열을 CSS 파일에 옮겨 적지 말 것(함정 2 — 판별은 훅 하나가 소유). */
export const PHONE_MEDIA_QUERY =
  `(max-width: ${PHONE_MAX_SHORT_SIDE}px), ((max-height: ${PHONE_MAX_SHORT_SIDE}px) and (pointer: coarse))`;

/** 뷰포트 기준 폰 판별. coarse = 주 포인터가 터치인가(matchMedia '(pointer: coarse)'). */
export function isPhoneViewport(w: number, h: number, coarse: boolean): boolean {
  return w <= PHONE_MAX_SHORT_SIDE || (h <= PHONE_MAX_SHORT_SIDE && coarse);
}

/**
 * 서버(headers) UA 추정 — 첫 렌더 선택용. 클라이언트가 matchMedia로 보정하므로
 * 여기서는 "태블릿을 폰으로 찍지 않는 것"이 정확도보다 중요하다(오탐 = 태블릿 깜빡임).
 * @param ua User-Agent 헤더
 * @param chUaMobile Sec-CH-UA-Mobile 헤더 — 있으면(Chromium) 그것만 믿는다('?1'=폰).
 *   Android 태블릿은 '?0'을 보낸다. Safari는 이 헤더가 없다 → UA 정규식 폴백.
 */
export function guessPhoneFromHeaders(
  ua: string | null | undefined,
  chUaMobile: string | null | undefined,
): boolean {
  if (chUaMobile) return chUaMobile.trim() === '?1';
  const s = ua || '';
  // 태블릿 우선 제외: iPad("모바일 웹사이트 요청" UA 포함) · 명시적 Tablet(Firefox) ·
  // Mobile 토큰 없는 Android(Chrome 태블릿). iPadOS 기본(데스크톱 모드)은 Macintosh UA라
  // 아래 폰 정규식에도 안 걸려 자연히 데스크톱이다.
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(s)) return false;
  return /iPhone|iPod|Android.*Mobile|Mobi/i.test(s);
}
