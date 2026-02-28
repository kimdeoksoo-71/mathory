'use client';

import { getDifficultyInfo } from '../../lib/utils';

interface DifficultyBadgeProps {
  level: number;
}

export default function DifficultyBadge({ level }: DifficultyBadgeProps) {
  const { label, color } = getDifficultyInfo(level);
  return (
    <span
      style={{
        fontSize: 11.5,
        padding: '2px 8px',
        borderRadius: 10,
        background: color + '22',
        color: color,
        fontWeight: 600,
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'nowrap',
      }}
    >
      {'★'.repeat(level)} {label}
    </span>
  );
}
