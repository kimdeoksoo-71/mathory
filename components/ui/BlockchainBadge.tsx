import React from 'react';
import { IconBlockchain } from './Icons';

interface BadgeSource {
  blockchain?: { latest?: { contentHash: string; status?: string } } | null;
  copyright?: { contentHash: string };
}

interface Props {
  problem: BadgeSource;
  size?: number;
}

/**
 * 비트코인(OpenTimestamps) 등록된 문제에 표시되는 배지.
 * - pending: 흐리게 (블록 확정 대기 중)
 * - confirmed: 정상
 * - 수정됨: 흐리게
 */
export default function BlockchainBadge({ problem, size = 14 }: Props) {
  const latest = problem.blockchain?.latest;
  if (!latest) return null;

  const current = problem.copyright?.contentHash;
  const isModified = !!current && current !== latest.contentHash;
  const isPending = latest.status === 'pending';

  const title = isModified
    ? '비트코인 등록됨 — 등록 후 수정됨 (재등록 권장)'
    : isPending
    ? '비트코인 블록체인 등록 중 (확정 대기)'
    : '비트코인 블록체인 등록됨';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 6,
        opacity: isModified || isPending ? 0.55 : 1,
        verticalAlign: 'middle',
        color: 'currentColor',
      }}
    >
      <IconBlockchain size={size} />
    </span>
  );
}