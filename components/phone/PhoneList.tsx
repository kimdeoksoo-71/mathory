'use client';

import type React from 'react';
import { Folder, Problem } from '../../types/problem';
import VerifyBadge from '../ui/VerifyBadge';
import FolderGlyph from '../ui/FolderGlyph';
import { IconChevron, IconDots } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 §6-6 — 폰 리스트 행. Phase 62·63의 문법을 따른다:
   폴더 행 = 아이보리 무테두리("클레이 = 문항"의 귀결) / 문항 행 = 클레이 카드.
   검증 배지는 VerifyBadge 공용(사본 금지 — verdict 어휘는 VERIFY_VERDICT_META 소유).
   ═══════════════════════════════════════════════════════════════ */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 12px 6px', fontSize: 12, fontWeight: 600,
      color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: 0.3,
    }}>
      {children}
    </div>
  );
}

export function FolderRow({ folder, count, onClick }: {
  folder: Folder; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 52,
        padding: '0 12px', boxSizing: 'border-box', textAlign: 'left',
        border: 'none', borderBottom: '1px solid var(--border-light, #eee)',
        background: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
      }}
    >
      <span style={{ display: 'flex', color: 'var(--text-secondary)', flexShrink: 0 }}>
        <FolderGlyph folder={folder} size={18} />
      </span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {folder.name}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{count}</span>
      <span style={{ display: 'flex', color: 'var(--text-faint, #bbb)', flexShrink: 0 }}><IconChevron size={12} /></span>
    </button>
  );
}

export function ProblemRow({ problem, sub, onClick, onMore }: {
  problem: Problem;
  /** 보조줄 앞부분(폴더명 · 수정일 등) — 검증 배지는 이 컴포넌트가 뒤에 붙인다 */
  sub?: string;
  onClick: () => void;
  onMore?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="link"
      style={{
        display: 'flex', alignItems: 'center', gap: 4, margin: '0 10px 8px',
        background: 'var(--bg-content)', border: '0.5px solid var(--border-content)',
        borderRadius: 8, padding: '10px 4px 10px 12px', cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {problem.title || '(제목 없음)'}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
          fontSize: 11.5, color: 'var(--text-muted)',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {sub && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
          <VerifyBadge problem={problem} size={10} />
        </div>
      </div>
      {onMore && (
        <button
          onClick={(e) => { e.stopPropagation(); onMore(); }}
          aria-label="문항 메뉴"
          style={{
            flexShrink: 0, width: 40, height: 40, border: 'none', background: 'none',
            cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <IconDots size={18} />
        </button>
      )}
    </div>
  );
}

/** yy.mm.dd — BazaarView·리스트와 같은 표기 */
export function fmtDateShort(d: Date | undefined | null): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}
