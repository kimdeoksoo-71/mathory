'use client';

import { useState } from 'react';
import { Problem, Folder } from '../../types/problem';
import { IconFolder, IconDots } from '../ui/Icons';
import DifficultyBadge from '../ui/DifficultyBadge';
import ContextMenu from '../ui/ContextMenu';
import { formatTimeAgo } from '../../lib/utils';

interface FolderViewProps {
  folder: Folder;
  problems: Problem[];
  onEdit: (problem: Problem) => void;
  onView: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
}

function ProblemCard({
  problem,
  onEdit,
  onView,
  onAction,
}: {
  problem: Problem;
  onEdit: (p: Problem) => void;
  onView: (p: Problem) => void;
  onAction: (action: string, p: Problem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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
            <DifficultyBadge level={problem.difficulty} />
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
          onAction={(action) => {
            if (action === 'edit') onEdit(problem);
            else onAction(action, problem);
          }}
        />
      )}
    </>
  );
}

export default function FolderView({ folder, problems, onEdit, onView, onProblemAction }: FolderViewProps) {
  const folderProblems = problems.filter((p) => p.folder_id === folder.id);

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ color: 'var(--text-muted)' }}><IconFolder /></span>
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
          fontFamily: 'var(--font-ui)',
        }}>
          {folder.name}
        </h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {folderProblems.length}개 문항
        </span>
      </div>

      {folderProblems.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 14,
        }}>
          이 폴더에 문항이 없습니다.
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
