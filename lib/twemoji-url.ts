// Twemoji 에셋 버전/베이스를 한 곳에서 관리.
// 렌더 플러그인(source)과 피커 미리보기(twemojiSvgUrl)가 동일 파일을 가리키도록 함.
//
// 검증(2026-06-01): 아래 베이스 + 코드포인트 규칙은 @yuna0x0/rehype-twemoji v0.1.4가
//   생성하는 URL(`${source}/assets/svg/{cp}.svg`)과 바이트 단위로 일치함.
// CDN 태그: jdecked/twemoji 최신 안정판. jsDelivr에서 resolve 확인 완료.
export const TWEMOJI_VERSION = '17.0.2';
export const TWEMOJI_BASE =
  `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}`;
export const TWEMOJI_SVG_BASE = `${TWEMOJI_BASE}/assets/svg`;

const VS16 = 0xfe0f; // variation selector-16
const ZWJ = 0x200d;  // zero-width joiner

/** twemoji 파일명 규칙: ZWJ 없으면 FE0F 제거, 소문자, '-' 결합 */
export function toTwemojiCodepoint(emoji: string): string {
  const cps = Array.from(emoji).map((c) => c.codePointAt(0)!);
  const hasZwj = cps.includes(ZWJ);
  const filtered = hasZwj ? cps : cps.filter((cp) => cp !== VS16);
  return filtered.map((cp) => cp.toString(16)).join('-');
}

export function twemojiSvgUrl(emoji: string): string {
  return `${TWEMOJI_SVG_BASE}/${toTwemojiCodepoint(emoji)}.svg`;
}

// 렌더 시 이미지로 치환하지 않을 문자(수학/타이포 기호 보호).
// 수학 편집기 특성상 저작권·정보·강조 기호가 컬러 이미지로 변하면 보기 흉하므로 텍스트 유지.
// (대부분의 수식 기호는 VS16 없는 코드포인트라 애초에 twemoji 대상이 아님 — 여기선 실제 충돌만 차단)
export const TWEMOJI_IGNORE = [
  '©', '®', '™', '‼', '⁉', 'ℹ️', '〽️', '＊', '＃',
  '↔️', '↕️', '↩️', '↪️', '⤴️', '⤵️', '◀️', '▶️',
];
