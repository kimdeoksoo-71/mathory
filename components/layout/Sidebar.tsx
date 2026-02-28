'use client';

import { useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Problem, Folder } from '../../types/problem';
import ContextMenu from '../ui/ContextMenu';
import {
  IconSidebar, IconPlus, IconSearch, IconFolder, IconRecent,
  IconUser, IconDots, IconChevron, IconGoogle,
} from '../ui/Icons';

// ─── Sidebar Item ───
function SidebarItem({
  icon,
  label,
  collapsed,
  active,
  onClick,
  badge,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  onClick: () => void;
  badge?: string | number;
  trailing?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%',
        padding: collapsed ? '10px 0' : '8px 12px',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font-ui)',
        transition: 'all var(--transition-fast)',
        position: 'relative',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', opacity: active ? 1 : 0.75 }}>{icon}</span>
      {!collapsed && (
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      {!collapsed && badge !== undefined && (
        <span style={{
          fontSize: 11, color: 'var(--text-muted)', background: 'var(--badge-bg)',
          borderRadius: 10, padding: '1px 7px',
        }}>
          {badge}
        </span>
      )}
      {!collapsed && trailing}
    </button>
  );
}

// ─── Problem List Item ───
function ProblemItem({
  problem,
  collapsed,
  onEdit,
  onView,
  onAction,
}: {
  problem: Problem;
  collapsed: boolean;
  onEdit: (p: Problem) => void;
  onView: (p: Problem) => void;
  onAction: (action: string, problem: Problem) => void;
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
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '8px 0' : '7px 12px',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
          background: hovered ? 'var(--bg-hover)' : 'transparent',
        }}
      >
        {collapsed ? (
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--text-faint)',
          }} />
        ) : (
          <>
            <span style={{
              fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              fontFamily: 'var(--font-ui)',
            }}>
              {problem.title}
            </span>
            {hovered && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuPos({ x: e.clientX, y: e.clientY });
                }}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  padding: '2px 4px', borderRadius: 4, color: 'var(--text-muted)',
                  display: 'flex', flexShrink: 0,
                }}
              >
                <IconDots />
              </button>
            )}
          </>
        )}
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

// ─── Main Sidebar ───
export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  folders: Folder[];
  folderCounts: Record<string, number>;
  recentProblems: Problem[];
  activeFolderId?: string | null;
  user: User | null;
  onNewProblem: () => void;
  onSearch: () => void;
  onSelectFolder: (folder: Folder) => void;
  onNewFolder: () => void;
  onViewProblem: (problem: Problem) => void;
  onEditProblem: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  folders,
  folderCounts,
  recentProblems,
  activeFolderId,
  user,
  onNewProblem,
  onSearch,
  onSelectFolder,
  onNewFolder,
  onViewProblem,
  onEditProblem,
  onProblemAction,
  onLogin,
  onLogout,
}: SidebarProps) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
        flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        overflow: 'hidden',
      }}
    >
      {/* ═══ Header: Mathory + Toggle ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '14px 0' : '14px 16px',
          borderBottom: '1px solid var(--border-primary)',
          minHeight: 52,
        }}
      >
        {!collapsed && (
          <span style={{
            fontSize: 19, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: -0.5, fontFamily: 'var(--font-logo)',
          }}>
            Mathory
          </span>
        )}
        <button
          onClick={onToggle}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 4,
            borderRadius: 6, transition: 'color var(--transition-fast)',
          }}
          title={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        >
          <IconSidebar />
        </button>
      </div>

      {/* ═══ Section 1: New + Search ═══ */}
      <div style={{ padding: collapsed ? '8px 8px' : '8px 12px', borderBottom: '1px solid var(--border-primary)' }}>
        <SidebarItem icon={<IconPlus />} label="새 문제" collapsed={collapsed} onClick={onNewProblem} />
        <SidebarItem icon={<IconSearch />} label="검색" collapsed={collapsed} onClick={onSearch} />
      </div>

      {/* ═══ Section 2: Folders ═══ */}
      <div style={{ padding: collapsed ? '8px 8px' : '8px 12px', borderBottom: '1px solid var(--border-primary)', overflow: 'auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: 4,
        }}>
          {!collapsed ? (
            <button
              onClick={() => setFoldersOpen(!foldersOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
                letterSpacing: 0.3, textTransform: 'uppercase' as const,
                fontFamily: 'var(--font-ui)', padding: '4px 0',
              }}
            >
              <span style={{
                transform: foldersOpen ? 'rotate(90deg)' : 'rotate(0)',
                transition: 'transform var(--transition-fast)', display: 'flex',
              }}>
                <IconChevron />
              </span>
              폴더
            </button>
          ) : (
            <SidebarItem icon={<IconFolder />} label="폴더" collapsed={collapsed} onClick={() => {}} />
          )}
          {!collapsed && (
            <button
              onClick={onNewFolder}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4,
              }}
              title="새 폴더"
            >
              <IconPlus size={16} />
            </button>
          )}
        </div>
        {!collapsed && foldersOpen && folders.map((f) => (
          <SidebarItem
            key={f.id}
            icon={<IconFolder />}
            label={f.name}
            badge={folderCounts[f.id] ?? 0}
            collapsed={collapsed}
            active={activeFolderId === f.id}
            onClick={() => onSelectFolder(f)}
          />
        ))}
      </div>

      {/* ═══ Section 3: Recent Problems ═══ */}
      <div style={{ flex: 1, padding: collapsed ? '8px 8px' : '8px 12px', overflow: 'auto' }}>
        {!collapsed ? (
          <button
            onClick={() => setRecentOpen(!recentOpen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
              letterSpacing: 0.3, textTransform: 'uppercase' as const,
              fontFamily: 'var(--font-ui)', padding: '4px 0', marginBottom: 4,
            }}
          >
            <span style={{
              transform: recentOpen ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform var(--transition-fast)', display: 'flex',
            }}>
              <IconChevron />
            </span>
            최근 문항
          </button>
        ) : (
          <SidebarItem icon={<IconRecent />} label="최근 문항" collapsed={collapsed} onClick={() => {}} />
        )}
        {(collapsed ? recentProblems.slice(0, 4) : recentOpen ? recentProblems : []).map((p) => (
          <ProblemItem
            key={p.id}
            problem={p}
            collapsed={collapsed}
            onEdit={onEditProblem}
            onView={onViewProblem}
            onAction={onProblemAction}
          />
        ))}
      </div>

      {/* ═══ Footer: Auth ═══ */}
      <div style={{ borderTop: '1px solid var(--border-primary)', padding: collapsed ? '8px 8px' : '8px 12px' }}>
        {user ? (
          <SidebarItem icon={<IconUser />} label="로그아웃" collapsed={collapsed} onClick={onLogout} />
        ) : (
          <SidebarItem icon={<IconGoogle />} label="Google 로그인" collapsed={collapsed} onClick={onLogin} />
        )}
      </div>
    </aside>
  );
}
