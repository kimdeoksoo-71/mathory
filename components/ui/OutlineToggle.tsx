'use client';

import { IconChevronsUp, IconChevronsDown } from './Icons';
import type { OutlineMode } from '../../hooks/useOutlineState';

/* Phase 59 — 구조 보기 / 전체 보기 토글 (D6)

   ⚠ 명칭 주의: 편집창의 "전체 접기/펼치기"(Phase 45 collapseMode)는 완전히
     다른 기능이다. 열람 화면의 이 토글은 "구조 보기 / 전체 보기"로만 부른다.

   앱 열람뷰(라벨 열)와 공개 뷰어(탭 콘텐츠 상단)가 함께 쓴다. 공유하는 것은
   이 버튼과 outline 로직뿐이고 블록 렌더러는 통합하지 않는다 (D16). */

interface Props {
  mode: OutlineMode;
  onToggle: () => void;
  /** 보여줄 스켈레톤이 없을 때 (D14) */
  disabled?: boolean;
  /** true = 아이콘만 (앱 라벨 열). false = 아이콘 + 텍스트 (공개 뷰어) */
  compact?: boolean;
}

export default function OutlineToggle({ mode, onToggle, disabled, compact }: Props) {
  const outline = mode === 'outline';
  const label = outline ? '전체 보기' : '구조 보기';
  const title = disabled
    ? '제목·핵심문장·경우 블록이 없습니다'
    : outline ? '전체 보기 — 풀이 전체를 펼칩니다' : '구조 보기 — 제목·핵심문장·경우만 남깁니다';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={title}
      aria-pressed={outline}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: compact ? 0 : 5,
        border: 'none', background: outline && !disabled ? 'var(--accent-soft)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: compact ? 0 : '4px 8px',
        width: compact ? 22 : undefined, height: compact ? 22 : undefined,
        justifyContent: 'center',
        borderRadius: 6,
        fontSize: 12, fontFamily: 'var(--font-ui)',
        color: disabled
          ? 'var(--text-placeholder)'
          : outline ? 'var(--accent-primary)' : 'var(--text-faint)',
        transition: 'color 0.15s, background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = outline ? 'var(--accent-primary)' : 'var(--text-faint)';
      }}
    >
      {outline ? <IconChevronsDown size={13} /> : <IconChevronsUp size={13} />}
      {!compact && <span>{label}</span>}
    </button>
  );
}
