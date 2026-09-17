'use client';

import { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { Problem, Folder, UserProfile } from '../../types/problem';
import ContextMenu from '../ui/ContextMenu';
import ShareTree, { ShareGroup, ShareSubKey, ShareSubOpen, SHARE_SUB_OPEN_DEFAULT } from './ShareTree';
import SidebarSectionHeader from './SidebarSectionHeader';
import Wordmark from '../ui/Wordmark';
import { ShareScope } from '../../lib/share-scope';
import { useSidebarPeek } from '../../hooks/useSidebarPeek';
import { DRAWER_RADIUS } from '../ui/dialogStyles';
import {
  IconSidebar, IconPlus, IconSearch, IconFolder, IconRecent, IconUserCircle,
  IconDots, IconChevron, IconGoogle, IconGrip, IconTrash, IconInbox, IconShare, IconDownload,
} from '../ui/Icons';
import { TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID } from '../../lib/firestore';
import { PhosphorIconPicker, PICKER_WIDTH } from '../ui/PhosphorIconPicker';
import FolderGlyph from '../ui/FolderGlyph';
import { buildFolderTree, flattenVisible, getDescendantIds } from '../../lib/folder-tree';
import { useDraggable } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
/* Phase 63 S0 — DndContext·센서·핸들러·오버레이는 AppShell로 이관(D21).
   여기 남는 것은 useSortable(폴더)·useDraggable(최근 문항)·SortableContext뿐이다. */
import { Droppable, useDragKind, isProblemDrag, dndId, DROP_RING, DROP_TINT } from '../ui/dnd';

// ─── Sidebar Item (일반용) ───
function SidebarItem({
  icon,
  label,
  collapsed,
  active,
  onClick,
  badge,
  trailing,
  title,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  active?: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  badge?: string | number;
  trailing?: React.ReactNode;
  /** Phase 67 D5 — undefined = 현행(접힘이면 label) · false = 네이티브 title 미부착(peek 레일 3버튼: 펼침이 곧 라벨이고
   *  네이티브 툴팁이 펼친 패널 위에 떠 가린다) · 문자열 = 그 값 */
  title?: string | false;
  /** Phase 67 D5 — peek hover(레일 My·공유·최근). 필터(pointerType)는 호출부 훅 */
  onPointerEnter?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
  /** Phase 67 D15 — click 직전 pointerType 기록(터치 peek 판별) */
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      title={title === false ? undefined : (title ?? (collapsed ? label : undefined))}
      /* Phase 67 Y6 — 접힘에서는 라벨 텍스트가 없고 peek 레일 3버튼은 title까지 빠지므로 이름을 aria-label로 */
      aria-label={collapsed ? label : undefined}
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
        fontWeight: active ? 700 : 500,
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

/* Phase 67 D8 — peek 닫힘 보류. 메뉴·피커가 열린 동안 hold하고 effect cleanup이 해제한다(수동 쌍 금지 — 누수 차단).
   기본값은 Provider 밖 방어(G9): 아무것도 안 하고 no-op 해제를 돌려준다.
   ⚠ 소비처 effect deps는 **열림 불리언**이지 좌표 객체나 hold가 아니다(Y2) — 좌표가 바뀔 때마다 release→hold가 돌면
     holds가 0을 스쳐 재판정·유예가 흔들린다. */
const SidebarPeekContext = createContext<{ hold: () => () => void }>({ hold: () => () => {} });

/** 열려 있는 동안 peek을 붙잡는다 */
function usePeekHold(open: boolean) {
  const { hold } = useContext(SidebarPeekContext);
  useEffect(() => (open ? hold() : undefined), [open, hold]);
}

type FolderMenuAction = 'rename' | 'delete' | 'icon' | 'clearIcon' | 'newSub' | 'move';

// ─── Folder Menu (subfolder / move / icon / rename / delete) ───
function FolderMenu({
  x, y, hasIcon, onClose, onAction,
}: {
  x: number;
  y: number;
  hasIcon: boolean;
  onClose: () => void;
  onAction: (action: FolderMenuAction) => void;
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

  const divider = <div style={{ height: 1, background: 'var(--border-light, #eee)', margin: '4px 0' }} />;

  return (
    <div ref={menuRef} style={menuStyle}>
      <button
        style={itemStyle}
        onClick={() => { onAction('newSub'); onClose(); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        하위 폴더 만들기
      </button>
      <button
        style={itemStyle}
        onClick={() => { onAction('move'); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        폴더 이동
      </button>
      {divider}
      <button
        style={itemStyle}
        onClick={() => { onAction('icon'); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        아이콘 변경
      </button>
      {hasIcon && (
        <button
          style={itemStyle}
          onClick={() => { onAction('clearIcon'); onClose(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        >
          기본 아이콘으로
        </button>
      )}
      <button
        style={itemStyle}
        onClick={() => { onAction('rename'); onClose(); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        이름 변경
      </button>
      {divider}
      <button
        style={{ ...itemStyle, color: 'var(--accent-danger)' }}
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
  depth,
  hasChildren,
  expanded,
  onToggleExpand,
  allFolders,
  onSelect,
  onAction,
  onSetIcon,
  onNewSubfolder,
  onMoveFolder,
}: {
  folder: Folder;
  count: number;
  active: boolean;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  allFolders: Folder[];
  onSelect: () => void;
  onAction: (action: 'rename' | 'delete', folder: Folder) => void;
  onSetIcon: (folder: Folder, emoji: string | null) => void;
  onNewSubfolder: (parent: Folder) => void;
  onMoveFolder: (folder: Folder, newParentId: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [iconPickerPos, setIconPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [movePos, setMovePos] = useState<{ x: number; y: number } | null>(null);
  /* Phase 67 D8-1 — ⋯ 메뉴·아이콘 피커·이동 픽커가 열린 동안 peek 닫힘 보류(메뉴는 패널 밖으로 삐져나온다) */
  usePeekHold(!!(menuPos || iconPickerPos || movePos));

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging, isOver,
  } = useSortable({
    /* ⚠ D34 — 사이드바 폴더 sortable만 맨 folder.id를 쓴다(SortableContext items의 앵커).
       다른 모든 드래그·드롭 id는 dndId 프리픽스 필수 — 전역 컨텍스트에서 id가 겹치면
       dnd-kit 레지스트리(Map)가 조용히 덮어쓴다. */
    id: folder.id,
    data: { type: 'folder', folder },
  });
  /* Phase 63 S0 (F7·D27) — 드롭 하이라이트는 자체 isOver + 드래그 종류로 판정.
     AppShell의 dragOverFolderId 같은 전역 상태는 매 move마다 앱 전체를 리렌더시키므로 금지. */
  const isDropTarget = isOver && isProblemDrag(useDragKind());

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, position: 'relative' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 드래그 핸들 — position:absolute로 흐름에서 빼서 들여쓰기 영향 제거.
            Phase 63 D39 — left -12: 행 콘텐츠가 x0에서 시작하므로(D37) 그립은 섹션 좌패딩
            12px 거터로 이사(폭 12가 정확히 들어찬다). ⚠ -13이면 overflow:auto가 패딩 박스
            밖 1px을 자른다(v3 F4 실측) */}
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', left: -12, top: '50%', transform: 'translateY(-50%)',
            cursor: 'grab', display: 'flex', padding: '2px 0',
            opacity: hovered ? 0.6 : 0,
            transition: 'opacity 0.15s',
            zIndex: 1,
          }}
          title="드래그하여 순서 변경"
        >
          <IconGrip size={14} />
        </span>
        <button
          onClick={onSelect}
          style={{
            /* Phase 63 D37(Q17=B) — depth-0 들여쓰기 12 제거: My 헤더와 같은 좌단에서 시작.
               marginLeft -8 / paddingLeft +8 = 콘텐츠 x는 depth×16 그대로, active/hover
               알약만 거터로 8px 확장(왼쪽 벽 밀착 방지). 위계는 굵기 + chevron 슬롯이 담당 */
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: 'calc(100% + 8px)',
            marginLeft: -8,
            padding: '8px 12px',
            paddingLeft: 8 + depth * 16,
            /* D27·F6 — 하이라이트는 링+틴트, border 불변. 조건부 2px border는 over 순간
               행이 자라던 결함이었다(레이아웃을 흔드는 조건부 스타일 — Phase 45a 함정). */
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: isDropTarget ? DROP_RING : 'none',
            background: isDropTarget
              ? DROP_TINT
              : active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13.5,
            fontWeight: active ? 700 : 500,
            fontFamily: 'var(--font-ui)',
            transition: 'all 0.15s',
          }}
        >
          {/* 펼침/접힘 토글 (자식 있을 때만, 없으면 자리만 확보) */}
          <span
            onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(); }}
            style={{
              flexShrink: 0, width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              color: 'var(--text-muted)',
              visibility: hasChildren ? 'visible' : 'hidden',
            }}
          >
            <span style={{
              display: 'flex',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform var(--transition-fast)',
            }}>
              <IconChevron size={14} />
            </span>
          </span>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: active ? 1 : 0.75 }}>
            {/* M5 D3·D4 — 활성 행만 bold(글자 700과 동일 조건) · 펼침이면 folder-open */}
            <FolderGlyph folder={folder} size={18} expanded={hasChildren && expanded} />
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

          {/* 3-dot 메뉴 버튼 — 항상 자리 확보, hover 시만 보임 → 레이아웃 흔들림 방지 */}
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
              visibility: hovered && !isDropTarget ? 'visible' : 'hidden',
            }}
          >
            <IconDots />
          </span>
        </button>
      </div>

      {menuPos && (
        <FolderMenu
          x={menuPos.x}
          y={menuPos.y}
          hasIcon={!!folder.icon}
          onClose={() => setMenuPos(null)}
          onAction={(action) => {
            if (action === 'icon') {
              setIconPickerPos(menuPos);
              setMenuPos(null);
            } else if (action === 'move') {
              setMovePos(menuPos);
              setMenuPos(null);
            } else if (action === 'clearIcon') {
              onSetIcon(folder, null);
            } else if (action === 'newSub') {
              onNewSubfolder(folder);
            } else {
              onAction(action as 'rename' | 'delete', folder);
            }
          }}
        />
      )}

      {iconPickerPos && (
        <FolderIconPicker
          x={iconPickerPos.x}
          y={iconPickerPos.y}
          onClose={() => setIconPickerPos(null)}
          onSelect={(emoji) => { onSetIcon(folder, emoji); setIconPickerPos(null); }}
        />
      )}

      {movePos && (
        <FolderMovePicker
          x={movePos.x}
          y={movePos.y}
          folder={folder}
          allFolders={allFolders}
          onClose={() => setMovePos(null)}
          onMove={(targetId) => { onMoveFolder(folder, targetId); setMovePos(null); }}
        />
      )}
    </>
  );
}

// ─── Folder Move Picker (이동 대상 선택: 루트 + 자손 제외 폴더) ───
function FolderMovePicker({
  x, y, folder, allFolders, onClose, onMove,
}: {
  x: number;
  y: number;
  folder: Folder;
  allFolders: Folder[];
  onClose: () => void;
  onMove: (targetId: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 자기 자신 + 자손은 이동 대상에서 제외(순환 방지)
  const blocked = getDescendantIds(allFolders, folder.id);
  const tree = flattenVisible(buildFolderTree(allFolders), new Set());
  const targets = tree.filter((n) => !blocked.has(n.folder.id));
  const currentParent = folder.parent_id || null;

  const WIDTH = 220;
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - WIDTH - 8) : x;

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '7px 10px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)', textAlign: 'left',
  };
  const hover = (e: React.MouseEvent, on: boolean) => {
    (e.currentTarget as HTMLElement).style.background = on ? 'var(--bg-hover, #f5f5f5)' : 'none';
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: Math.max(8, left), top: y, zIndex: 10000,
        background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #ddd)',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '4px 0',
        width: WIDTH, maxHeight: 320, overflowY: 'auto',
      }}
    >
      <div style={{ padding: '4px 10px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
        "{folder.name}" 이동 위치
      </div>
      <button
        style={{ ...itemStyle, fontWeight: currentParent === null ? 700 : 500 }}
        disabled={currentParent === null}
        onClick={() => onMove(null)}
        onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}
      >
        <IconFolder size={15} /> 최상위
      </button>
      {targets.map((n) => (
        <button
          key={n.folder.id}
          style={{ ...itemStyle, paddingLeft: 10 + (n.depth + 1) * 14, fontWeight: currentParent === n.folder.id ? 700 : 500 }}
          disabled={currentParent === n.folder.id}
          onClick={() => onMove(n.folder.id)}
          onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}
        >
          <FolderGlyph folder={n.folder} size={15} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.folder.name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Folder Icon Picker (fixed-position popover wrapping reusable panel) ───
function FolderIconPicker({
  x, y, onClose, onSelect,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 화면 밖으로 넘치지 않게 우측/하단 보정
  const PANEL = PICKER_WIDTH + 16;
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - PANEL - 8) : x;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: y,
        zIndex: 10000,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-primary, #ddd)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: 8,
      }}
    >
      <PhosphorIconPicker onSelect={onSelect} />
    </div>
  );
}

// ─── Draggable Problem Item (can be dragged to folder) ───
function DraggableProblemItem({
  problem,
  onEdit,
  onView,
  onAction,
}: {
  problem: Problem;
  onEdit: (p: Problem) => void;
  onView: (p: Problem) => void;
  onAction: (action: string, problem: Problem) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  usePeekHold(!!menuPos);   // Phase 67 D8-1 — ⋮ 컨텍스트 메뉴

  const {
    attributes, listeners, setNodeRef, transform, isDragging,
  } = useDraggable({
    id: dndId.recentProblem(problem.id),
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
            padding: '7px 12px',
            justifyContent: 'space-between',
            borderRadius: 8,
            cursor: isDragging ? 'grabbing' : 'pointer',
            transition: 'background var(--transition-fast)',
            background: hovered && !isDragging ? 'var(--bg-hover)' : 'transparent',
          }}
        >
          {/* Phase 67 D13 — 접힘 레일의 점 4개(slice(0,4))는 삭제했다. 최근 문항은 레일 아이콘 hover peek으로 본다 */}
          <span style={{
            fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            fontFamily: 'var(--font-ui)',
          }}>
            {problem.title}
          </span>
          {/* ⋮ 버튼 — 항상 자리 확보, hover 시만 보임 → 레이아웃 흔들림 방지 */}
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
              visibility: hovered && !isDragging ? 'visible' : 'hidden',
            }}
          >
            <IconDots />
          </button>
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
/* Phase 62 D20 — 폭 토큰(--sidebar-expanded/--sidebar-collapsed)을 삭제하고 상수로 옮겼다.
   펼침 폭이 AppShell의 상태가 된 이상 토큰을 남기면 진실이 두 곳이 된다. */
export const SIDEBAR_WIDTH_DEFAULT = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Phase 62 D19 — 펼침 폭. AppShell의 useDrawerResize가 소유한다. */
  width: number;
  /** Phase 62 D19 — 드래그 중에는 width transition을 꺼야 핸들이 커서를 따라온다(0.2s 지연 제거). */
  dragging: boolean;
  folders: Folder[];
  folderCounts: Record<string, number>;
  recentProblems: Problem[];
  activeFolderId?: string | null;
  user: User | null;
  onNewProblem: () => void;
  onSearch: () => void;
  /** Phase 61a: 시트에서 문항 가져오기 */
  onSheetImport: () => void;
  onSelectFolder: (folder: Folder) => void;
  onNewFolder: () => void;
  onFolderAction: (action: 'rename' | 'delete', folder: Folder) => void;
  onSetFolderIcon: (folder: Folder, emoji: string | null) => void;
  onNewSubfolder: (parent: Folder) => void;
  onMoveFolder: (folder: Folder, newParentId: string | null) => void;
  onViewProblem: (problem: Problem) => void;
  onEditProblem: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onLogin: () => void;
  onLogout: () => void;
  onSelectTrash: () => void;
  trashCount: number;
  onSelectUnassigned: () => void;
  unassignedCount: number;
  onSelectSharedWithMe: () => void;
  sharedCount: number;
  // Phase 49: 공유 트리
  receivedGroups: ShareGroup[];
  sentGroups: ShareGroup[];
  shareProfiles: Record<string, UserProfile>;
  activeShareScopeKey: string | null;
  onSelectShareScope: (scope: ShareScope) => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  width,
  dragging,
  folders,
  folderCounts,
  recentProblems,
  activeFolderId,
  user,
  onNewProblem,
  onSearch,
  onSheetImport,
  onSelectFolder,
  onNewFolder,
  onFolderAction,
  onSetFolderIcon,
  onNewSubfolder,
  onMoveFolder,
  onViewProblem,
  onEditProblem,
  onProblemAction,
  onLogin,
  onLogout,
  onSelectTrash,
  trashCount,
  onSelectUnassigned,
  unassignedCount,
  onSelectSharedWithMe,
  sharedCount,
  receivedGroups,
  sentGroups,
  shareProfiles,
  activeShareScopeKey,
  onSelectShareScope,
}: SidebarProps) {
  const router = useRouter();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [myHeaderHovered, setMyHeaderHovered] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  /* Phase 67 D7 — 공유 열림·하위 펼침을 ShareTree 밖으로 끌어올렸다. ShareTree는 접힘마다 언마운트되어
     내부 상태가 리셋됐다(접었다 펴면 공유가 닫히고 하위가 전부 펼쳐졌다) — peek의 "직전 상태 그대로"(R8)가 불가능.
     Sidebar는 접혀도 마운트가 유지되므로 세션 내내 산다. 영속 없음(Phase 63 D32). 기본값은 옛 초깃값 그대로. */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSub, setShareSub] = useState<ShareSubOpen>(SHARE_SUB_OPEN_DEFAULT);
  const toggleShareSub = (key: ShareSubKey) => setShareSub((prev) => ({ ...prev, [key]: !prev[key] }));

  // Phase 40: 폴더 트리 펼침/접힘 (collapsed 집합, localStorage 영속)
  const COLLAPSE_KEY = 'mathory:folder:collapsed';
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsedFolders(new Set(JSON.parse(raw)));
    } catch {}
  }, []);
  const toggleFolderExpand = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  /* ═══ Phase 67 S3 — 사이드바 두 겹화(D1·D2) ═══
     바깥 <aside> = 흐름 안 **자리**(폭 56 | width), 안쪽 패널 = 보이는 사이드바(absolute), 콘텐츠 래퍼 = 옛 aside의
     flex column. hover peek(S4)은 자리를 56으로 둔 채 패널만 본문 위로 넓힌다 — 본문 리플로 0.
     S3는 상태를 idle로 고정해 화면 불변을 확인했고, S4부터 useSidebarPeek(hooks/)가 상태를 공급한다.
     ⚠ 패널 애니메이션은 width다 — transform·clip-path 금지: 폴더 ⋯ 메뉴·아이콘 피커·이동 픽커·최근 문항 메뉴가
       전부 비포털 position:fixed라 조상 transform이 좌표 기준을 바꾸고, clip-path는 패널 밖 픽커를 자른다.
     ⚠ 조건부 스타일은 키를 늘 두고 값만 바꾼다(Phase 45a longhand 구멍). */
  const dragKind = useDragKind();
  const peekCtl = useSidebarPeek({ collapsed, dragKind });
  const peek = peekCtl.state;
  const view = peekCtl.view;
  const renderCollapsed = view.renderCollapsed;
  /* D6 — peek 중(open·closing)에는 포인터가 올라간 섹션 **하나만** 연다. 고정 상태값은 읽지도 쓰지도 않는다
     (pinning은 collapsed=false라 고정값으로 돌아간다 — D10 의도). 트리·미지정·휴지통 게이트가 myOpen을 본다. */
  const myOpen = view.peeking ? peek.section === 'my' : foldersOpen;
  const shareOpenNow = view.peeking ? peek.section === 'share' : shareOpen;
  const recentOpenNow = view.peeking ? peek.section === 'recent' : recentOpen;
  /* W6·Y5 — 선택 콜백 9종은 peek에 "골랐다"를 알린다. 리듀서가 터치로 연 peek일 때만 닫는다(마우스는 포인터가 안이라 머문다) */
  const picked = <A extends unknown[]>(fn: (...a: A) => unknown) => (...a: A) => { peekCtl.itemSelected(); fn(...a); };
  const selNewProblem = picked(onNewProblem);
  const selSearch = picked(onSearch);
  const selSheetImport = picked(onSheetImport);
  const selFolder = picked(onSelectFolder);
  const selUnassigned = picked(onSelectUnassigned);
  const selTrash = picked(onSelectTrash);
  const selShareScope = picked(onSelectShareScope);
  const selView = picked(onViewProblem);
  const selEdit = picked(onEditProblem);
  const peekHoldValue = useMemo(() => ({ hold: peekCtl.hold }), [peekCtl.hold]);
  /* Y7 — idle에서 자리와 패널은 **같은 transition 식**이어야 고정 토글에서 본문 밀림(자리)과 사이드바 모양(패널)이
     같은 곡선으로 움직인다. 하나라도 다르면 둘 사이에 본문 배경이 비친다. 리사이즈 드래그 중에는 둘 다 none. */
  const idleTransition = dragging ? 'none' : 'width var(--transition-normal)';
  const panelTransition = dragging ? 'none'
    : peek.phase === 'open' ? 'width var(--transition-peek-open)'
    : peek.phase === 'closing' ? 'width var(--transition-peek-close)'
    : idleTransition;

  return (
    <SidebarPeekContext.Provider value={peekHoldValue}>
    <aside
      style={{
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width,
        flexShrink: 0,
        /* 자리 표시자 — 패널(absolute)의 기준 상자. 루트 flex의 stretch로 높이 100dvh.
           z 80은 idle 외 전부(S4) — 상시 80이면 고정 모드에서 스태킹 컨텍스트가 되어 ShareButton 바깥클릭 배경(40)
           위로 올라간다. pinning이 pin 직후 200ms의 80을 지킨다(E1). */
        position: 'relative',
        zIndex: view.raised ? 80 : 'auto',
        transition: idleTransition,
      }}
      {...peekCtl.asideProps}
    >
      <div
        {...peekCtl.panelProps}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: view.panelWide ? width : SIDEBAR_COLLAPSED_WIDTH,
          /* 개선묶음 M2(덕수 보완 4) — 중앙보다 **미세하게 어둡게** + 가는 세로 구분선.
             ProblemView의 클레이 프레임이 사라져 좌·중 경계가 안 보이던 것을 되살린다.
             ⚠ 밝기 서열(사이드바 < 중앙 < 드로어)이 3단 구분의 전부다. 뒤집지 말 것. */
          background: 'var(--bg-sidebar)',
          borderRight: 'var(--rail-hairline)',
          /* D17 — peek 중(open·closing)만 떠 있는 카드: 우측 위·아래 radius + 드로어 그림자. transition에 넣지 않는다 */
          borderRadius: view.peekCard ? `0 ${DRAWER_RADIUS}px ${DRAWER_RADIUS}px 0` : 0,
          boxShadow: view.peekCard ? 'var(--drawer-shadow)' : 'none',
          display: 'flex',
          transition: panelTransition,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            /* Y1 — 옛 aside의 flex column을 **그대로 이어받는다**. 최근 섹션 flex:1이 남는 높이를 먹고 푸터가 바닥에
               붙으며 My 섹션 overflow:auto가 줄어드는 것이 전부 이 flex 부모에 기댄다. block이면 셋이 함께 깨지는데
               폴더가 적은 계정에서는 우연히 맞아 보인다.
               폭: peek 중(open·closing·pinning)에만 사이드바 폭으로 고정해 패널이 넓어지는 동안 줄바꿈이 안 흔들리게 한다.
               idle은 100% — 고정 토글에서 아이콘이 줄어드는 폭을 따라 미끄러지는 현행 동작 보존(V16·W7). */
            width: view.lockContentWidth ? width : '100%',
            flexShrink: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            animation: view.playPeekIn ? 'peekIn 90ms' : 'none',
          }}
        >
          {/* ═══ Header ═══
              Phase 67b — peek 중(open·closing)에는 사이드바 버튼을 **레일과 같은 왼쪽 자리**(중심 x 28 = 패딩 14 + 버튼 28의 절반)에
              두고 워드마크를 그 오른쪽에. 레일 전체가 트리거라 "열기" 버튼 위에서 80ms면 peek이 열리는데, 고정 펼침 배치(버튼 오른쪽
              x≈238)를 그대로 쓰면 클릭이 워드마크에 떨어져 아무 일도 안 일어난다. 고정한 순간(pinning·고정 펼침)은 원래 배치. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: renderCollapsed ? 'center' : view.peeking ? 'flex-start' : 'space-between',
              gap: view.peeking ? 10 : 0,
              padding: renderCollapsed ? '14px 0' : view.peeking ? '14px 16px 14px 14px' : '14px 16px',
              minHeight: 52,
            }}
          >
            {!renderCollapsed && !view.peeking && (
              <Wordmark size={19} color="var(--wordmark-small, #944728)" shadow />
            )}
            <button
              onClick={() => {
                /* D10 — peek 중이면 pin(→ pinning: 바깥 자리가 폭까지 자라는 200ms 동안 z 80 유지, E1) 후 고정 펼침 */
                if (peek.phase === 'open' || peek.phase === 'closing') peekCtl.pin();
                onToggle();
              }}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: 4,
                borderRadius: 6, transition: 'color var(--transition-fast)',
              }}
              title={collapsed ? (view.peeking ? '사이드바 고정' : '사이드바 열기') : '사이드바 닫기'}
            >
              <IconSidebar />
            </button>
            {view.peeking && (
              <Wordmark size={19} color="var(--wordmark-small, #944728)" shadow />
            )}
          </div>

          {/* ═══ Section 1: New + Search ═══
              Phase 67b — 네이티브 title 제거(aria-label은 SidebarItem이 접힘에서 단다). 레일 전체가 peek 트리거라 80ms 뒤
              펼친 패널이 라벨을 보여 주고, ~1초 뒤 뜨는 툴팁은 그 패널을 가린다. */}
          <div style={{ padding: renderCollapsed ? '8px 8px' : '8px 12px' }}>
            <SidebarItem icon={<IconPlus />} label="새 문제" collapsed={renderCollapsed} title={false} onClick={selNewProblem} />
            <SidebarItem icon={<IconSearch />} label="검색" collapsed={renderCollapsed} title={false} onClick={selSearch} />
            <SidebarItem icon={<IconDownload size={18} />} label="시트 가져오기" collapsed={renderCollapsed} title={false} onClick={selSheetImport} />
          </div>

          {/* Phase 63 S0 — 이 아래 폴더·공유·최근 섹션의 DnD는 AppShell의 전역 DndContext가 받는다 */}
            {/* ═══ Section 2: Folders ═══ */}
            <div
              style={{ padding: renderCollapsed ? '8px 8px' : '8px 12px', overflow: 'auto' }}
              onMouseEnter={() => setMyHeaderHovered(true)}
              onMouseLeave={() => setMyHeaderHovered(false)}
            >
              {/* M6 D22 — 세 섹션 헤더(My·공유·최근 문항)는 SidebarSectionHeader 한 벌 */}
              {!renderCollapsed ? (
                <SidebarSectionHeader
                  icon={<IconUserCircle size={16} />}
                  label="My"
                  open={myOpen}
                  onToggle={() => (view.peeking ? peekCtl.switchTo('my') : setFoldersOpen(!foldersOpen))}
                  {...peekCtl.headerProps('my')}
                  chevronTitle={view.peeking ? null : undefined}
                  trailing={
                    /* + 버튼: My 헤더 hover 시에만 노출 */
                    <button
                      onClick={onNewFolder}
                      style={{
                        border: 'none', background: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4,
                        visibility: myHeaderHovered ? 'visible' : 'hidden',
                      }}
                      title="새 폴더"
                    >
                      <IconPlus size={16} />
                    </button>
                  }
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <SidebarItem icon={<IconUserCircle />} label="My" collapsed={renderCollapsed} {...peekCtl.railProps('my')} />
                </div>
              )}

              {!renderCollapsed && myOpen && (() => {
                const visible = flattenVisible(buildFolderTree(folders), collapsedFolders);
                return (
                  <SortableContext items={visible.map((n) => n.folder.id)} strategy={verticalListSortingStrategy}>
                    {visible.map((n) => (
                      <SortableFolderItem
                        key={n.folder.id}
                        folder={n.folder}
                        count={folderCounts[n.folder.id] ?? 0}
                        active={activeFolderId === n.folder.id}
                        depth={n.depth}
                        hasChildren={n.children.length > 0}
                        expanded={!collapsedFolders.has(n.folder.id)}
                        onToggleExpand={() => toggleFolderExpand(n.folder.id)}
                        allFolders={folders}
                        onSelect={() => selFolder(n.folder)}
                        onAction={onFolderAction}
                        onSetIcon={onSetFolderIcon}
                        onNewSubfolder={onNewSubfolder}
                        onMoveFolder={onMoveFolder}
                      />
                    ))}
                  </SortableContext>
                );
              })()}

              {/* 미지정 폴더 (폴더 목록 하단, 휴지통 위)
                  Phase 63 D25 — 드롭 타깃(folder_id: null). 하이라이트는 링+틴트 한 문법(D27). */}
              {!renderCollapsed && myOpen && (
                <Droppable id={dndId.unassigned} data={{ type: 'unassigned' }}>
                  {({ setNodeRef, isOver }) => (
                <button
                  ref={setNodeRef}
                  onClick={selUnassigned}
                  style={{
                    /* Phase 63 D38(Q17=B) — 좌측 붙임: 아이콘 x0. chevron 슬롯이 없어 일반
                       폴더(아이콘 x20)보다 왼쪽 = 의도된 구별(슬롯을 채워 맞추지 말 것) */
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: 'calc(100% + 8px)', marginLeft: -8,
                    padding: '8px 12px', paddingLeft: 8,
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    boxShadow: isOver ? DROP_RING : 'none',
                    background: isOver ? DROP_TINT
                      : activeFolderId === UNASSIGNED_FOLDER_ID ? 'var(--bg-active)' : 'transparent',
                    color: activeFolderId === UNASSIGNED_FOLDER_ID ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 13.5,
                    fontWeight: activeFolderId === UNASSIGNED_FOLDER_ID ? 700 : 500,
                    fontFamily: 'var(--font-ui)', transition: 'all 0.15s', marginTop: 4,
                  }}
                  onMouseEnter={(e) => { if (activeFolderId !== UNASSIGNED_FOLDER_ID && !isOver) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { if (activeFolderId !== UNASSIGNED_FOLDER_ID && !isOver) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flexShrink: 0, display: 'flex', opacity: activeFolderId === UNASSIGNED_FOLDER_ID ? 1 : 0.75 }}>
                    <IconInbox size={16} />
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    미지정
                  </span>
                  {unassignedCount > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--badge-bg)', borderRadius: 10, padding: '1px 7px' }}>
                      {unassignedCount}
                    </span>
                  )}
                </button>
                  )}
                </Droppable>
              )}

              {/* 휴지통 (항상 맨 아래, 드래그 소스는 아님)
                  Phase 63 D25(Q9) — 드롭 타깃 = trash 액션(moveToTrash — 이 경로만 updated_at을
                  찍어 "버린 시각"이 된다, Q14). */}
              {!renderCollapsed && myOpen && (
                <Droppable id={dndId.trash} data={{ type: 'trash' }}>
                  {({ setNodeRef, isOver }) => (
                <button
                  ref={setNodeRef}
                  onClick={selTrash}
                  style={{
                    /* Phase 63 D38 — 미지정과 아이콘 위치 통일(옛 paddingLeft 34는 일관성 없는
                       여백이라 삭제 — 덕수 지시) */
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: 'calc(100% + 8px)',
                    marginLeft: -8,
                    padding: '8px 12px',
                    paddingLeft: 8,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    boxShadow: isOver ? DROP_RING : 'none',
                    background: isOver ? DROP_TINT
                      : activeFolderId === TRASH_FOLDER_ID ? 'var(--bg-active)' : 'transparent',
                    color: activeFolderId === TRASH_FOLDER_ID ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 13.5,
                    fontWeight: activeFolderId === TRASH_FOLDER_ID ? 700 : 500,
                    fontFamily: 'var(--font-ui)',
                    transition: 'all 0.15s',
                    marginTop: 4,
                  }}
                  onMouseEnter={(e) => {
                    if (activeFolderId !== TRASH_FOLDER_ID && !isOver) e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFolderId !== TRASH_FOLDER_ID && !isOver) e.currentTarget.style.background = 'transparent';
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
                </Droppable>
              )}
            </div>

            {/* ═══ Section 2.5: 공유 (My와 동렬 최상위 카테고리, Phase 49) ═══ */}
            {renderCollapsed ? (
              /* Phase 67 D13·X3 — 접힘 레일의 공유. 래퍼는 My 레일과 **같은 두 겹**(섹션 8px 8px + 안쪽 marginBottom 4) —
                 한 겹이면 슬롯이 54px이 되어 최근 레일 중심이 329 → 325로 올라가 착지 좌표(§1-1)가 틀어진다.
                 IconShare 기본은 14라 레일 이웃(18)에 맞춘다(E4). */
              <div style={{ padding: '8px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                  <SidebarItem icon={<IconShare size={18} />} label="공유" collapsed={renderCollapsed} {...peekCtl.railProps('share')} />
                </div>
              </div>
            ) : (
              <div style={{ padding: '8px 12px' }}>   {/* M6 D22 — 세 섹션 래퍼 여백 통일('8px 12px') */}
                <ShareTree
                  receivedTotal={sharedCount}
                  receivedGroups={receivedGroups}
                  sentGroups={sentGroups}
                  profiles={shareProfiles}
                  activeScopeKey={activeShareScopeKey}
                  onSelectScope={selShareScope}
                  open={shareOpenNow}
                  onToggleOpen={() => (view.peeking ? peekCtl.switchTo('share') : setShareOpen((v) => !v))}
                  subOpen={shareSub}
                  onToggleSub={toggleShareSub}
                  headerProps={{ ...peekCtl.headerProps('share'), chevronTitle: view.peeking ? null : undefined }}
                />
              </div>
            )}

            {/* ═══ Section 3: Recent Problems ═══ */}
            {/* D11 — peek 중에는 overflow hidden: 넘친 최근 문항은 푸터 경계선 밑으로 잘린다(스크롤 없음, R9). 고정 펼침은 현행 스크롤 */}
            <div style={{ flex: 1, padding: renderCollapsed ? '8px 8px' : '8px 12px', overflow: view.peeking ? 'hidden' : 'auto' }}>
              {!renderCollapsed ? (
                <SidebarSectionHeader
                  icon={<IconRecent size={16} />}
                  label="최근 문항"
                  open={recentOpenNow}
                  onToggle={() => (view.peeking ? peekCtl.switchTo('recent') : setRecentOpen(!recentOpen))}
                  {...peekCtl.headerProps('recent')}
                  chevronTitle={view.peeking ? null : undefined}
                />
              ) : (
                <SidebarItem icon={<IconRecent />} label="최근 문항" collapsed={renderCollapsed} {...peekCtl.railProps('recent')} />
              )}
              {!renderCollapsed && recentOpenNow && recentProblems.map((p) => (
                <DraggableProblemItem
                  key={p.id}
                  problem={p}
                  onEdit={selEdit}
                  onView={selView}
                  onAction={onProblemAction}
                />
              ))}
            </div>

          {/* ═══ Footer: Auth ═══ */}
          <div style={{
            borderTop: '1px solid var(--border-primary)',
            padding: renderCollapsed ? '10px 4px' : '10px 12px',
            display: 'flex', alignItems: 'center',
            justifyContent: renderCollapsed ? 'center' : 'flex-start',
            gap: 8,
          }}>
            {user ? (() => {
              const idOnly = (user.email || '').split('@')[0] || user.displayName || '';
              const photo = user.photoURL;
              const avatar = photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={idOnly} referrerPolicy="no-referrer"
                  style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--bg-active, #ddd)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #666)',
                }}>{(idOnly || '?').charAt(0).toUpperCase()}</div>
              );
              const openSettings = () => router.push('/settings');
              return renderCollapsed ? (
                <button onClick={openSettings} title={`${idOnly || ''} — 개인 설정`}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                  }}>
                  {avatar}
                </button>
              ) : (
                <>
                  <button onClick={openSettings} title="개인 설정"
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                    }}>
                    {avatar}
                  </button>
                  <button onClick={openSettings} title="개인 설정"
                    style={{
                      flex: 1, minWidth: 0,
                      fontSize: 12, color: 'var(--text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-ui)',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      textAlign: 'left', padding: 0,
                    }}
                  >
                    {idOnly || '로그인됨'}
                  </button>
                  <button onClick={onLogout}
                    style={{
                      flexShrink: 0,
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 11, color: 'var(--text-muted)', padding: '2px 0',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    로그아웃
                  </button>
                </>
              );
            })() : (
              <button onClick={onLogin}
                title={renderCollapsed ? 'Google 로그인' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: renderCollapsed ? 8 : '8px 14px', border: '1px solid var(--border-light)',
                  borderRadius: 8, background: 'transparent', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <IconGoogle size={14} />
                {!renderCollapsed && <span>Google 로그인</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
    </SidebarPeekContext.Provider>
  );
}