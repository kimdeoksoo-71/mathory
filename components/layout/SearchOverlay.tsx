'use client';

import { useState, useEffect } from 'react';
import { Problem } from '../../types/problem';
import { IconSearch, IconClose } from '../ui/Icons';
import { formatTimeAgo } from '../../lib/utils';

interface SearchOverlayProps {
  problems: Problem[];
  onClose: () => void;
  onSelect: (problem: Problem) => void;
}

export default function SearchOverlay({ problems, onClose, onSelect }: SearchOverlayProps) {
  const [query, setQuery] = useState('');

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = problems.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    (p.source || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.subject || p.category || '').toLowerCase().includes(query.toLowerCase()) ||
    p.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 900,
        display: 'flex', justifyContent: 'center', paddingTop: 120,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxHeight: 420, background: '#fff', borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,.15)', overflow: 'hidden',
          animation: 'fadeInScale 0.15s ease',
        }}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderBottom: '1px solid var(--border-light)',
        }}>
          <span style={{ color: 'var(--text-muted)' }}><IconSearch /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문항 검색..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
              background: 'transparent',
            }}
          />
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <IconClose />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflow: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
            }}>
              {query ? '검색 결과가 없습니다' : '검색어를 입력하세요'}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 18px', border: 'none', background: 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background var(--transition-fast)',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.source || p.exam_type} · {p.subject || p.category}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                  {formatTimeAgo(p.updated_at)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
