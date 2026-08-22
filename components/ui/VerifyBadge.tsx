'use client';

/**
 * Phase 61b — 목록·카드용 검증 배지.
 *
 * `Problem.verification`의 요약(verdict·stale)만 읽는다 — **블록 로드 0**.
 * 그래서 stale 판정을 저장 시점에 계산해 불리언으로 적어 두는 것이다(D5′).
 */

import type { Problem, VerifyVerdict } from '../../types/problem';

const META: Record<VerifyVerdict, { icon: string; color: string; label: string }> = {
  ok:    { icon: '✓', color: 'var(--accent-success)',    label: '이상 없음' },
  check: { icon: '⚠', color: 'var(--mathory-red-dark)',  label: '확인 필요' },
  fail:  { icon: '✕', color: 'var(--accent-danger)',     label: '결함 확인' },
  skip:  { icon: '−', color: 'var(--text-muted)',        label: '검증 안 함' },
};

const KIND_LABEL: Record<string, string> = { problem: '문제', solution: '풀이' };

export default function VerifyBadge({ problem, size = 11 }: { problem: Problem; size?: number }) {
  const v = problem.verification;
  if (!v) return null;

  const entries = (['problem', 'solution'] as const)
    .map((kind) => ({ kind, state: v[kind] }))
    .filter((e): e is { kind: 'problem' | 'solution'; state: NonNullable<typeof e.state> } => !!e.state);
  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(({ kind, state }) => {
        const m = META[state.verdict] ?? META.check;
        return (
          <span
            key={kind}
            title={`${KIND_LABEL[kind]} 검증: ${m.label}${state.stale ? ' (편집 후 재검증 필요)' : ''}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              fontSize: size, lineHeight: 1, flexShrink: 0,
              fontFamily: 'var(--font-ui)',
              color: state.stale ? 'var(--text-faint)' : m.color,
              // 낡은 판정은 색을 빼고 물음표를 붙인다 — 지운 것이 아니라 "지금 상태가 아니다"
              textDecoration: state.stale ? 'none' : undefined,
            }}
          >
            <span style={{ fontSize: size - 1, opacity: 0.75 }}>{KIND_LABEL[kind]}</span>
            <span style={{ fontWeight: 700 }}>{m.icon}</span>
            {state.stale && <span style={{ fontSize: size - 1 }}>?</span>}
          </span>
        );
      })}
    </>
  );
}
