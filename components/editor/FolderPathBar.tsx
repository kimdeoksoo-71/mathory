'use client';

/**
 * Phase 40-C — EditorView 폴더 경로 바 (인터랙티브)
 *
 * 평면 select를 대체. 현재 문항의 폴더 경로를 칩으로 표시하고, 각 칩을 클릭하면 드롭다운:
 *  - 선두 홈 칩: "미분류" + 최상위 폴더들 (최상위 이동/미분류 처리)
 *  - 중간 세그먼트(비-마지막): 형제 폴더들 (2-1)
 *  - 마지막 세그먼트: 자식 폴더들 (2-2)
 * 항목 선택 시 onMove(folderId|null) → 호출측이 editFolderId를 갱신(이동).
 */

import { useEffect, useRef, useState } from 'react';
import { Folder } from '../../types/problem';
import { getChildren, getFolderPath } from '../../lib/folder-tree';
import { IconFolder, IconChevron } from '../ui/Icons';
import { TwemojiImg } from './EmojiPickerPanel';

function FolderGlyph({ folder, size = 14 }: { folder: Folder; size?: number }) {
  return folder.icon
    ? <TwemojiImg emoji={folder.icon} label={folder.name} size={size} />
    : <IconFolder size={size} />;
}

export default function FolderPathBar({
  folders,
  currentFolderId,
  onMove,
}: {
  folders: Folder[];
  currentFolderId: string;            // '' = 미분류
  onMove: (folderId: string | null) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openKey]);

  const path = currentFolderId ? getFolderPath(folders, currentFolderId) : [];
  const topLevel = getChildren(folders, null);

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 6, border: 'none',
    background: 'var(--bg-hover)', cursor: 'pointer',
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
    maxWidth: 160, whiteSpace: 'nowrap',
  };
  const sep = <span style={{ color: 'var(--text-faint)', fontSize: 12, margin: '0 1px' }}>/</span>;

  const renderDropdown = (items: Folder[], emptyText: string) => (
    <div
      style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 1000,
        background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #ddd)',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0',
        minWidth: 160, maxHeight: 280, overflowY: 'auto',
      }}
    >
      {items.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{emptyText}</div>
      ) : items.map((f) => (
        <button
          key={f.id}
          onClick={() => { onMove(f.id); setOpenKey(null); }}
          disabled={f.id === currentFolderId}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '7px 12px', border: 'none', background: 'none',
            cursor: f.id === currentFolderId ? 'default' : 'pointer',
            fontSize: 13, fontFamily: 'var(--font-ui)',
            color: f.id === currentFolderId ? 'var(--accent-primary)' : 'var(--text-primary)',
            fontWeight: f.id === currentFolderId ? 700 : 500, textAlign: 'left',
          }}
          onMouseEnter={(e) => { if (f.id !== currentFolderId) e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          <FolderGlyph folder={f} size={15} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
        </button>
      ))}
    </div>
  );

  const toggle = (key: string) => setOpenKey((k) => (k === key ? null : key));

  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {/* 선두 홈 칩: 미분류 + 최상위 폴더 */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          onClick={() => toggle('root')}
          title="My (최상위 카테고리) — 바로 아래 폴더로 이동"
          style={{
            ...chipStyle,
            fontWeight: 600, color: 'var(--text-secondary)',
            background: path.length === 0 ? 'var(--bg-active, #e8eaf6)' : 'var(--bg-hover)',
          }}
        >
          <span>My</span>
          <IconChevron size={10} />
        </button>
        {openKey === 'root' && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 1000,
              background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #ddd)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0',
              minWidth: 160, maxHeight: 280, overflowY: 'auto',
            }}
          >
            <button
              onClick={() => { onMove(null); setOpenKey(null); }}
              disabled={currentFolderId === ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '7px 12px', border: 'none', background: 'none',
                cursor: currentFolderId === '' ? 'default' : 'pointer',
                fontSize: 13, fontFamily: 'var(--font-ui)',
                color: currentFolderId === '' ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: currentFolderId === '' ? 700 : 500, textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (currentFolderId !== '') e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              미분류
            </button>
            <div style={{ height: 1, background: 'var(--border-light, #eee)', margin: '4px 0' }} />
            {topLevel.map((f) => (
              <button
                key={f.id}
                onClick={() => { onMove(f.id); setOpenKey(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
                  fontWeight: 500, textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                <FolderGlyph folder={f} size={15} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 경로 세그먼트 */}
      {path.map((seg, i) => {
        const isLast = i === path.length - 1;
        const dropdownItems = isLast
          ? getChildren(folders, seg.id)                 // 2-2: 자식
          : getChildren(folders, seg.parent_id || null); // 2-1: 형제
        return (
          <div key={seg.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {sep}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => toggle(seg.id)}
                title={isLast ? '하위 폴더로 이동' : '형제 폴더로 이동'}
                style={{ ...chipStyle, background: isLast ? 'var(--bg-active, #e8eaf6)' : 'var(--bg-hover)', color: isLast ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              >
                <FolderGlyph folder={seg} size={13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.name}</span>
                <IconChevron size={10} />
              </button>
              {openKey === seg.id && renderDropdown(dropdownItems, isLast ? '하위 폴더 없음' : '형제 폴더 없음')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
