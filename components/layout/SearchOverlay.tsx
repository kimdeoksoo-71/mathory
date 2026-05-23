'use client';

import { useState, useEffect } from 'react';
import { Problem } from '../../types/problem';
import { IconSearch, IconClose } from '../ui/Icons';
import { formatTimeAgo } from '../../lib/utils';

interface SearchOverlayProps {
  problems: Problem[];
  /** problemId → 모든 탭 본문(소문자). 비어있으면 본문 검색은 아직 인덱스 미빌드 상태 */
  textIndex?: Record<string, string>;
  indexLoading?: boolean;
  /** 오버레이가 열릴 때 인덱스 빌드 요청 (AppShell이 한 번만 빌드) */
  onRequestIndex?: () => void;
  onClose: () => void;
  onSelect: (problem: Problem) => void;
}

export default function SearchOverlay({
  problems, textIndex = {}, indexLoading = false, onRequestIndex,
  onClose, onSelect,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 마운트 시 인덱스 빌드 요청 (이미 빌드되어 있으면 AppShell이 무시)
  useEffect(() => { onRequestIndex?.(); }, [onRequestIndex]);

  const q = query.trim().toLowerCase();
  const filtered = !q ? problems : problems.filter((p) => {
    const meta = `${p.title} ${p.source || ''} ${p.exam_type || ''} ${p.subject || ''} ${p.category || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    if (meta.includes(q)) return true;
    const body = textIndex[p.id];
    if (body && body.includes(q)) return true;
    return false;
  });

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
            placeholder="제목·본문 검색..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
              background: 'transparent',
            }}
          />
          {indexLoading && (
            <span style={{ fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
              본문 색인 중…
            </span>
          )}
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
