import React from 'react';
import { IconBlockchain } from './Icons';

interface BadgeSource {
  blockchain?: { latest?: { contentHash: string } } | null;
  copyright?: { contentHash: string };
}

interface Props {
  problem: BadgeSource;
  size?: number;
}

/**
 * 블록체인 등록된 문제에 표시되는 배지.
 * 등록된 해시와 현재 contentHash 가 다르면 "수정됨" 상태(흐림).
 */
export default function BlockchainBadge({ problem, size = 14 }: Props) {
  const latest = problem.blockchain?.latest;
  if (!latest) return null;

  const current = problem.copyright?.contentHash;
  const isModified = !!current && current !== latest.contentHash;

  const title = isModified
    ? '블록체인 등록됨 — 등록 후 수정됨 (재등록 권장)'
    : '블록체인 등록됨';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 6,
        opacity: isModified ? 0.55 : 1,
        verticalAlign: 'middle',
        color: 'currentColor',
      }}
    >
      <IconBlockchain size={size} />
    </span>
  );
}
