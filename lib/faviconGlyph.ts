/**
 * M10 B(D8) — 탭 아이콘 도안 상수(import 0). **정본은 `app/icon.svg`** — canvas가 CSS 토큰을 읽지 못하므로 리터럴이고,
 * `tests/favicon.test.mjs`가 두 파일의 path `d`·바탕색 일치를 고정한다(아이콘을 바꾸면 여기도 함께).
 * 좌표계 64×64 · 바탕 rx 15 · 'M'은 Pretendard Bold, 대문자 높이 30(y 17~47 · 가로 중앙 — M6 D15 + 검수 4차).
 */

export const ICON_SIZE = 64;
export const ICON_RADIUS = 15;
export const BG = '#D97757';
export const GLYPH = '#FFFFFF';
export const M_PATH = 'M15.8 17.0V47.0H21.85V27.28H22.1L29.92 46.87H34.08L41.9 27.36H42.15V47.0H48.2V17.0H40.49L32.16 37.34H31.84L23.51 17.0Z';

/** 완료 점(M10 D9′ — 덕수 판정 P6 "빨간 점, 바탕 빨강과 톤을 달리"). 바탕 대비 3.31:1 · 흰 테가 바탕에서 떼어 낸다.
 *  M의 오른쪽 다리와 겹친다(64px 안에서는 피할 수 없다 — 흰 테가 가른다) */
export const DONE_DOT = '#7A1F14';
export const DOT_CX = 50;
export const DOT_CY = 50;
export const DOT_R = 9;
export const DOT_RING = 1.5;

/** 맥박: 1.6초 주기 · 진폭 ±12% · 60ms 프레임. 타이머는 Worker(M10 M3 실측 — 숨긴 탭에서 메인 스레드 setInterval은 1초로
 *  묶이지만 Worker 타이머와 그 메시지 수신은 100ms 그대로였다) → 다른 탭에 가 있어도 부드럽게 뛴다 */
export const PULSE_PERIOD_MS = 1600;
export const PULSE_AMP = 0.12;
export const FRAME_MS = 60;

export function pulseScale(tMs: number): number {
  return 1 + PULSE_AMP * Math.sin((2 * Math.PI * tMs) / PULSE_PERIOD_MS);
}
