'use client';

import { useEffect, useState } from 'react';
import { TabMeta } from '../../types/problem';
import { IconDownload } from '../ui/Icons';

interface PdfDialogProps {
  open: boolean;
  onClose: () => void;
  tabs: TabMeta[];
  onConfirm: (selectedTabIds: string[]) => void;
  isPrinting?: boolean;
}

/** PDF 탭 선택 다이얼로그 — ProblemView 오른쪽 단에서 사용 */
export default function PdfDialog({ open, onClose, tabs, onConfirm, isPrinting }: PdfDialogProps) {
  const [selection, setSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      const next: Record<string, boolean> = {};
      tabs.forEach((t) => { next[t.id] = true; });
      setSelection(next);
    }
  }, [open, tabs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedIds = tabs.filter((t) => selection[t.id]).map((t) => t.id);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 12,
          padding: '20px 24px', minWidth: 260, maxWidth: 340,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
          marginBottom: 12,
        }}>
          <IconDownload size={16} /> PDF 다운로드
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          포함할 탭 선택:
        </div>

        {tabs.map((tab) => (
          <label key={tab.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-secondary)',
          }}>
            <input
              type="checkbox"
              checked={selection[tab.id] !== false}
              onChange={(e) => setSelection((prev) => ({ ...prev, [tab.id]: e.target.checked }))}
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            {tab.label}
          </label>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={isPrinting}
            style={{
              flex: 1, padding: '8px 0',
              background: 'var(--bg-hover)', color: 'var(--text-secondary)',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-ui)',
            }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(selectedIds)}
            disabled={isPrinting || selectedIds.length === 0}
            style={{
              flex: 1, padding: '8px 0',
              background: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: 6,
              cursor: isPrinting ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-ui)',
              opacity: selectedIds.length === 0 ? 0.5 : 1,
            }}
          >
            {isPrinting ? '준비 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
