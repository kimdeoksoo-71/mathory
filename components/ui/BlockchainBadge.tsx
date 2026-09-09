import React from 'react';
import { IconBlockchain } from './Icons';

interface BadgeSource {
  blockchain?: { latest?: { contentHash: string; txHash?: string } } | null;
  copyright?: { contentHash: string };
}

interface Props {
  problem: BadgeSource;
  size?: number;
}

/**
 * 블록체인 원본인증된 문제에 표시되는 배지.
 * 수정됨 상태일 때는 흐리게.
 */
export default function BlockchainBadge({ problem, size = 14 }: Props) {
  const latest = problem.blockchain?.latest;
  // Polygon 레코드만 유효 (과거 OpenTimestamps 레코드는 표시 안 함)
  if (!latest || !latest.txHash) return null;

  const current = problem.copyright?.contentHash;
  const isModified = !!current && current !== latest.contentHash;

  const title = isModified
    ? '블록체인 원본인증됨 — 인증 후 수정됨 (재인증 권장)'
    : '블록체인 원본인증됨';

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 6,
        opacity: isModified ? 0.55 : 1,
        verticalAlign: 'middle',
        // M6 D25 — 자리 글자색(제목 --text-primary)을 상속받아 옆 댓글·agent 배지(--text-muted)보다
        // 검게 튀던 것을 고정색으로. isModified 흐림(opacity)은 그 위에 얹힌다.
        color: 'var(--text-muted)',
      }}
    >
      <IconBlockchain size={size} />
    </span>
  );
}