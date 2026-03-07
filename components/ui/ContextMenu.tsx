'use client';

import { useRef, useEffect } from 'react';
import { IconRename, IconEdit, IconFolderMove, IconTrash } from '../ui/Icons';

// 다운로드 아이콘
function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  action: string;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  items?: ContextMenuAction[];
}

const DEFAULT_ITEMS: ContextMenuAction[] = [
  { label: '편집', icon: <IconEdit />, action: 'edit' },
  { label: '이름 변경', icon: <IconRename />, action: 'rename' },
  { label: '폴더 변경', icon: <IconFolderMove />, action: 'move' },
  { label: 'MD 다운로드', icon: <IconDownload />, action: 'download_md' },
  { label: 'divider', action: 'divider' },
  { label: '삭제', icon: <IconTrash />, action: 'delete', danger: true },
];

export default function ContextMenu({ x, y, onClose, onAction, items = DEFAULT_ITEMS }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      ref.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      ref.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)',
        padding: '4px 0',
        minWidth: 180,
        animation: 'fadeIn 0.1s ease',
      }}
    >
      {items.map((item, i) =>
        item.action === 'divider' ? (
          <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 8px' }} />
        ) : (
          <button
            key={i}
            onClick={() => {
              onAction(item.action);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: item.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = item.danger
                ? 'var(--accent-danger-bg)'
                : 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
          >
            {item.icon && <span style={{ opacity: 0.7, display: 'flex' }}>{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}