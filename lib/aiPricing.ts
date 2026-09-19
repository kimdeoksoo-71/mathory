/**
 * M9 D15′ — AI 단가의 코드 쪽 단일 원천. 순수 모듈(import 0).
 *
 * 우선순위(CLAUDE.md M9 절):
 *   - 토론 계열(ai_models 문서가 있는 모델) = Firestore `ai_models` 문서(1순위) → 이 표(fallback + warn)
 *   - 정밀 검증(env 고정 모델) = env `VERIFY_*_COST_IN/OUT`(override) → 이 표 → warn + 0
 *   - 교정·AI 자동완성 = 이 표 → warn + 0
 * ⚠ 라우트에 단가 리터럴을 다시 적지 말 것 — 모델을 바꾸면 옛 단가가 남는다(옛 verify 5/25 리터럴).
 * ⚠ 사본: `scripts/verifyProbe.mjs`(raw fetch 프로브라 이 모듈을 못 읽는다)의 5/25 — 바꿀 때 함께.
 *
 * 단위: USD / 1M tokens. 출력 토큰은 **사고(reasoning) 포함**이다(ai-provider의 usage 정규화, M9 D15′ ①).
 */

export interface Price { in: number; out: number }

export const PRICES: Record<string, Price> = {
  // Anthropic 공시(2026-06-24 기준)
  'claude-opus-5':      { in: 5, out: 25 },
  'claude-opus-4-8':    { in: 5, out: 25 },
  'claude-haiku-4-5':   { in: 1, out: 5 },
  // Firestore ai_models 운영값(M9 §1-C11, 2026-09-19 실측) — 표는 fallback이고 1순위는 문서다
  'gemini-3.1-pro-preview': { in: 2, out: 12 },     // ≤200K 구간(>200K 구간 단가는 미반영)
  'gemini-3.5-flash':       { in: 1.5, out: 9 },
  'gpt-5.4-2026-03-05':     { in: 2.5, out: 15 },
  'grok-4.3':               { in: 1.25, out: 2.5 },
  // Google 공시: AI 자동완성 기본값·운영 AI_MODEL
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  'gemini-2.5-pro':   { in: 1.25, out: 10 },        // ≤200K
};

/** 날짜 접미사가 붙은 Anthropic 모델명(`claude-haiku-4-5-20251001`)도 받는다 */
export function priceFor(model: string | undefined | null): Price | null {
  if (!model) return null;
  if (PRICES[model]) return PRICES[model];
  const undated = model.replace(/-\d{8}$/, '');
  return PRICES[undated] ?? null;
}

export function calcCostUsd(inTok: number, outTok: number, p: Price | null | undefined): number {
  if (!p) return 0;
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

/** env 문자열 → 양수 숫자 또는 null(빈 값·0·숫자 아님은 "설정 안 됨") */
export function envPrice(v: string | undefined): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
