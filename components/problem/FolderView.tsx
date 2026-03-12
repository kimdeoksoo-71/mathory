'use client';

import { useState, useEffect, useRef } from 'react';
import { Problem, Folder } from '../../types/problem';
import { DIFFICULTIES } from '../../lib/constants';
import { IconFolder, IconDots, IconTrash, IconTrashEmpty } from '../ui/Icons';
import ContextMenu from '../ui/ContextMenu';
import { formatTimeAgo } from '../../lib/utils';
import { TRASH_FOLDER_ID } from '../../lib/firestore';

function getDifficultyLabel(value: number): string {
  const found = DIFFICULTIES.find((d) => d.value === value);
  return found ? found.label : `${value}`;
}

interface FolderViewProps {
  folder: Folder;
  problems: Problem[];
  onEdit: (problem: Problem) => void;
  onView: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onEmptyTrash?: () => void;
}

function ProblemCard({
  problem,
  onEdit,
  onView,
  onAction,
  isTrash,
}: {
  problem: Problem;
  onEdit: (p: Problem) => void;
  onView: (p: Problem) => void;
  onAction: (action: string, p: Problem) => void;
  isTrash?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // 휴지통 전용 메뉴 항목
  const trashMenuItems = [
    { label: '복원', icon: undefined, action: 'restore' },
    { label: 'divider', action: 'divider' },
    { label: '영구 삭제', icon: <IconTrash />, action: 'delete', danger: true },
  ];

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onView(problem)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
          background: hovered ? 'var(--bg-secondary)' : 'transparent',
          transition: 'background var(--transition-fast)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)',
            marginBottom: 4, fontFamily: 'var(--font-ui)',
          }}>
            {problem.title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {problem.source || problem.exam_type}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-placeholder)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {problem.subject || problem.category}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-placeholder)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {getDifficultyLabel(problem.difficulty)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {formatTimeAgo(problem.updated_at)}
          </span>
          {hovered && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuPos({ x: e.clientX, y: e.clientY });
              }}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                padding: 4, borderRadius: 4, color: 'var(--text-muted)', display: 'flex',
              }}
            >
              <IconDots />
            </button>
          )}
        </div>
      </div>
      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          items={isTrash ? trashMenuItems : undefined}
          onAction={(action) => {
            if (action === 'edit') onEdit(problem);
            else if (action === 'restore') {
              onAction('restore', problem);
            } else {
              onAction(action, problem);
            }
          }}
        />
      )}
    </>
  );
}

export default function FolderView({ folder, problems, onEdit, onView, onProblemAction, onEmptyTrash }: FolderViewProps) {
  const isTrash = folder.id === TRASH_FOLDER_ID;
  const folderProblems = problems.filter((p) => p.folder_id === folder.id);

  // 휴지통 전용 메뉴
  const [trashMenuOpen, setTrashMenuOpen] = useState(false);
  const trashMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (trashMenuRef.current && !trashMenuRef.current.contains(e.target as Node)) {
        setTrashMenuOpen(false);
      }
    };
    if (trashMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [trashMenuOpen]);

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {isTrash ? <IconTrash size={18} /> : <IconFolder />}
        </span>
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
          fontFamily: 'var(--font-ui)',
        }}>
          {folder.name}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {folderProblems.length}개 문항
        </span>

        {/* 휴지통 전용: ⋮ 메뉴 */}
        {isTrash && folderProblems.length > 0 && (
          <div ref={trashMenuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button
              onClick={() => setTrashMenuOpen(!trashMenuOpen)}
              style={{
                border: 'none', background: trashMenuOpen ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                color: 'var(--text-muted)', display: 'flex',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (!trashMenuOpen) e.currentTarget.style.background = 'transparent'; }}
              title="메뉴"
            >
              <IconDots size={16} />
            </button>

            {trashMenuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)',
                minWidth: 160, zIndex: 1000,
                padding: '4px 0',
                animation: 'fadeIn 0.1s ease',
              }}>
                <button
                  onClick={() => {
                    setTrashMenuOpen(false);
                    onEmptyTrash?.();
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 14px',
                    border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'var(--font-ui)',
                    color: 'var(--accent-danger)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-danger-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ opacity: 0.7, display: 'flex' }}><IconTrashEmpty /></span>
                  휴지통 비우기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {folderProblems.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14,
        }}>
          {isTrash ? '휴지통이 비어 있습니다.' : '이 폴더에 문항이 없습니다.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {folderProblems.map((p) => (
            <ProblemCard
              key={p.id}
              problem={p}
              onEdit={onEdit}
              onView={onView}
              onAction={onProblemAction}
              isTrash={isTrash}
            />
          ))}
        </div>
      )}
    </div>
  );
}
