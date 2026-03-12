'use client';

import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Problem, Folder } from '../../types/problem';
import ContextMenu from '../ui/ContextMenu';
import {
  IconSidebar, IconPlus, IconSearch, IconFolder, IconRecent,
  IconUser, IconDots, IconChevron, IconGoogle, IconGrip, IconTrash,
} from '../ui/Icons';
import { TRASH_FOLDER_ID } from '../../lib/firestore';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragOverEvent, DragStartEvent,
  DragOverlay, useDraggable,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Sidebar Item (일반용) ───
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

// ─── Folder Menu (rename / delete) ───
function FolderMenu({
  x, y, onClose, onAction,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: 'rename' | 'delete') => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
    background: 'var(--bg-card, #fff)',
    border: '1px solid var(--border-primary, #ddd)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: '4px 0',
    minWidth: 140,
  };

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'var(--font-ui)',
    color: 'var(--text-primary)',
    textAlign: 'left',
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      <button
        style={itemStyle}
        onClick={() => { onAction('rename'); onClose(); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        이름 변경
      </button>
      <button
        style={{ ...itemStyle, color: 'var(--accent-danger, #ea4335)' }}
        onClick={() => { onAction('delete'); onClose(); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        폴더 삭제
      </button>
    </div>
  );
}

// ─── Sortable Folder Item (also droppable for problems) ───
function SortableFolderItem({
  folder,
  count,
  active,
  isDropTarget,
  onSelect,
  onAction,
}: {
  folder: Folder;
  count: number;
  active: boolean;
  isDropTarget: boolean;
  onSelect: () => void;
  onAction: (action: 'rename' | 'delete', folder: Folder) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id: folder.id,
    data: { type: 'folder', folder },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={onSelect}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 12px',
            border: isDropTarget ? '2px solid var(--accent-primary, #5b6abf)' : 'none',
            borderRadius: 8,
            cursor: 'pointer',
            background: isDropTarget
              ? 'rgba(91, 106, 191, 0.1)'
              : active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13.5,
            fontWeight: active ? 600 : 400,
            fontFamily: 'var(--font-ui)',
            transition: 'all 0.15s',
          }}
        >
          {/* 드래그 핸들 */}
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{
              cursor: 'grab',
              display: 'flex',
              padding: '2px 0',
              flexShrink: 0,
              opacity: hovered ? 0.6 : 0,
              transition: 'opacity 0.15s',
            }}
            title="드래그하여 순서 변경"
          >
            <IconGrip size={12} />
          </span>

          <span style={{ flexShrink: 0, display: 'flex', opacity: active ? 1 : 0.75 }}>
            <IconFolder />
          </span>
          <span style={{
            flex: 1, textAlign: 'left', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {folder.name}
          </span>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', background: 'var(--badge-bg)',
            borderRadius: 10, padding: '1px 7px',
          }}>
            {count}
          </span>

          {/* 3-dot 메뉴 버튼 */}
          {hovered && !isDropTarget && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setMenuPos({ x: e.clientX, y: e.clientY });
              }}
              style={{
                cursor: 'pointer',
                display: 'flex',
                padding: '2px 4px',
                borderRadius: 4,
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
            >
              <IconDots />
            </span>
          )}
        </button>
      </div>

      {menuPos && (
        <FolderMenu
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
          onAction={(action) => onAction(action, folder)}
        />
      )}
    </>
  );
}

// ─── Draggable Problem Item (can be dragged to folder) ───
function DraggableProblemItem({
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

  const {
    attributes, listeners, setNodeRef, transform, isDragging,
  } = useDraggable({
    id: `problem-${problem.id}`,
    data: { type: 'problem', problem },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : undefined,
    position: isDragging ? 'relative' as const : undefined,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (!isDragging) onView(problem); }}
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '8px 0' : '7px 12px',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderRadius: 8,
            cursor: isDragging ? 'grabbing' : 'pointer',
            transition: 'background var(--transition-fast)',
            background: hovered && !isDragging ? 'var(--bg-hover)' : 'transparent',
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
              {hovered && !isDragging && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
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
  onFolderAction: (action: 'rename' | 'delete', folder: Folder) => void;
  onFolderReorder: (reorderedFolders: Folder[]) => void;
  onMoveProblemToFolder: (problem: Problem, folder: Folder) => void;
  onViewProblem: (problem: Problem) => void;
  onEditProblem: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onLogin: () => void;
  onLogout: () => void;
  onSelectTrash: () => void;
  trashCount: number;
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
  onFolderAction,
  onFolderReorder,
  onMoveProblemToFolder,
  onViewProblem,
  onEditProblem,
  onProblemAction,
  onLogin,
  onLogout,
  onSelectTrash,
  trashCount,
}: SidebarProps) {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);

  // DnD 상태
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{ type: string; label: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'problem') {
      const problem = active.data.current?.problem as Problem;
      setActiveDragItem({ type: 'problem', label: problem.title });
    } else if (type === 'folder') {
      setActiveDragItem({ type: 'folder', label: '' });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDragOverFolderId(null);
      return;
    }
    // 문항을 폴더 위에 드래그 중일 때 하이라이트
    if (active.data.current?.type === 'problem' && over.data.current?.type === 'folder') {
      setDragOverFolderId(over.id as string);
    } else {
      setDragOverFolderId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOverFolderId(null);
    setActiveDragItem(null);

    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'folder' && overType === 'folder' && active.id !== over.id) {
      // 폴더 순서 변경
      const oldIdx = folders.findIndex((f) => f.id === active.id);
      const newIdx = folders.findIndex((f) => f.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(folders, oldIdx, newIdx);
        onFolderReorder(reordered);
      }
    } else if (activeType === 'problem' && overType === 'folder') {
      // 문항을 폴더로 이동
      const problem = active.data.current?.problem as Problem;
      const folder = over.data.current?.folder as Folder;
      if (problem && folder) {
        onMoveProblemToFolder(problem, folder);
      }
    }
  };

  const handleDragCancel = () => {
    setDragOverFolderId(null);
    setActiveDragItem(null);
  };

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
      {/* ═══ Header ═══ */}
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

      {/* ═══ Single DndContext: Folders + Recent Problems ═══ */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
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

          {!collapsed && foldersOpen && (
            <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {folders.map((f) => (
                <SortableFolderItem
                  key={f.id}
                  folder={f}
                  count={folderCounts[f.id] ?? 0}
                  active={activeFolderId === f.id}
                  isDropTarget={dragOverFolderId === f.id}
                  onSelect={() => onSelectFolder(f)}
                  onAction={onFolderAction}
                />
              ))}
            </SortableContext>
          )}

          {/* 휴지통 (항상 맨 아래, 드래그 불가) */}
          {!collapsed && foldersOpen && (
            <button
              onClick={onSelectTrash}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                paddingLeft: 34,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: activeFolderId === TRASH_FOLDER_ID ? 'var(--bg-active)' : 'transparent',
                color: activeFolderId === TRASH_FOLDER_ID ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13.5,
                fontWeight: activeFolderId === TRASH_FOLDER_ID ? 600 : 400,
                fontFamily: 'var(--font-ui)',
                transition: 'all 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                if (activeFolderId !== TRASH_FOLDER_ID) e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (activeFolderId !== TRASH_FOLDER_ID) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', opacity: activeFolderId === TRASH_FOLDER_ID ? 1 : 0.75 }}>
                <IconTrash size={16} />
              </span>
              <span style={{
                flex: 1, textAlign: 'left', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                휴지통
              </span>
              {trashCount > 0 && (
                <span style={{
                  fontSize: 11, color: 'var(--text-muted)', background: 'var(--badge-bg)',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {trashCount}
                </span>
              )}
            </button>
          )}
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
            <DraggableProblemItem
              key={p.id}
              problem={p}
              collapsed={collapsed}
              onEdit={onEditProblem}
              onView={onViewProblem}
              onAction={onProblemAction}
            />
          ))}
        </div>

        {/* DragOverlay: 드래그 중 플로팅 라벨 */}
        <DragOverlay>
          {activeDragItem?.type === 'problem' && (
            <div style={{
              padding: '6px 14px',
              background: 'var(--bg-card, #fff)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              📄 {activeDragItem.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

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