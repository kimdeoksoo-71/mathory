'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Problem, Block, Folder } from '../../types/problem';
import { getPreviewBlocks, TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID } from '../../lib/firestore';
import { listAllComments } from '../../lib/comments';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import SvgViewer from '../viewer/SvgViewer';
import BlockchainBadge from '../ui/BlockchainBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import {
  IconTrash, IconCopy, IconFolder, IconInbox, IconDotsVertical, IconShare,
} from '../ui/Icons';
import { TwemojiImg } from '../editor/EmojiPickerPanel';
import { getChildren, getFolderPath } from '../../lib/folder-tree';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

/* ═══ 정렬 ═══ */
type SortKey = 'name' | 'updated';
type SortDir = 'asc' | 'desc';
interface SortState { key: SortKey; dir: SortDir; }
const SORT_KEY = 'mathory-folder-sort';
const DEFAULT_SORT: SortState = { key: 'updated', dir: 'desc' };
const SORT_KEY_LABELS: Record<SortKey, string> = { name: '이름', updated: '수정일' };

function loadSort(): SortState {
  if (typeof window === 'undefined') return DEFAULT_SORT;
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as SortState;
    if (parsed?.key && parsed?.dir) return parsed;
  } catch {}
  return DEFAULT_SORT;
}

function compareBySort(a: Problem, b: Problem, s: SortState): number {
  let v: number;
  if (s.key === 'name') {
    v = (a.title || '').localeCompare(b.title || '', 'ko');
  } else {
    const ta = a.updated_at ? a.updated_at.getTime() : 0;
    const tb = b.updated_at ? b.updated_at.getTime() : 0;
    v = ta - tb;
  }
  return s.dir === 'asc' ? v : -v;
}

interface FolderViewProps {
  folder: Folder;
  problems: Problem[];
  folders: Folder[];
  onEdit: (problem: Problem) => void;
  onView: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onEmptyTrash?: () => void;
  onUpdated?: () => void;
  onSelectFolder?: (folder: Folder) => void;
  onMoveProblemToFolder?: (problem: Problem, folder: Folder) => void;
}

// ─── DnD 렌더프롭 래퍼 (문항 카드 드래그 / 하위 폴더 드롭) ───
function Draggable({ id, data, disabled, children }: {
  id: string;
  data: Record<string, unknown>;
  disabled?: boolean;
  // attributes/listeners는 dnd-kit 내부 타입 → 스프레드용으로 느슨하게 받음
  children: (p: { setNodeRef: (el: HTMLElement | null) => void; attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, data, disabled });
  return <>{children({ setNodeRef, attributes, listeners, isDragging })}</>;
}

function Droppable({ id, data, children }: {
  id: string;
  data: Record<string, unknown>;
  children: (p: { setNodeRef: (el: HTMLElement | null) => void; isOver: boolean }) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return <>{children({ setNodeRef, isOver })}</>;
}

function formatDate(d?: Date): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDateTime(d?: Date): string {
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} : ${hh}-${mi}`;
}

export default function FolderView({
  folder, problems, folders, onEdit, onView, onProblemAction, onEmptyTrash, onUpdated, onSelectFolder, onMoveProblemToFolder,
}: FolderViewProps) {
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [questionBlocksMap, setQuestionBlocksMap] = useState<Record<string, Block[]>>({});
  // 문항별 미해결 댓글 수
  const [commentCountsMap, setCommentCountsMap] = useState<Record<string, number>>({});
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  // ⋮ 카드 메뉴
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);

  // Phase 40: 문항 → 하위 폴더 드래그
  const [draggingProblem, setDraggingProblem] = useState<Problem | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => { setSort(loadSort()); }, []);

  const updateSort = (next: SortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_KEY, JSON.stringify(next)); } catch {}
  };

  const isTrash = folder.id === TRASH_FOLDER_ID;
  const isUnassigned = folder.id === UNASSIGNED_FOLDER_ID;
  const isSharedWithMe = folder.id === SHARED_WITH_ME_FOLDER_ID;
  const isSpecial = isTrash || isUnassigned || isSharedWithMe;

  // Phase 40: 하위 폴더 + 브레드크럼 (일반 폴더에서만)
  const childFolders = isSpecial ? [] : getChildren(folders, folder.id);
  const breadcrumb = isSpecial ? [] : getFolderPath(folders, folder.id);

  // 문항을 하위 폴더로 끌어 넣기: 하위 폴더가 있고, 이동 핸들러가 있을 때만 활성
  const dndEnabled = !isSpecial && childFolders.length > 0 && !!onMoveProblemToFolder;

  const handleDndStart = (e: DragStartEvent) => {
    setDraggingProblem((e.active.data.current?.problem as Problem) ?? null);
  };
  const handleDndEnd = (e: DragEndEvent) => {
    setDraggingProblem(null);
    const problem = e.active.data.current?.problem as Problem | undefined;
    const target = e.over?.data.current?.folder as Folder | undefined;
    if (problem && target && problem.folder_id !== target.id) {
      onMoveProblemToFolder?.(problem, target);
    }
  };

  const folderProblems = problems
    .filter((p) => {
      if (isSharedWithMe) return true; // problems prop이 이미 공유받은 문항만 들어옴
      if (isTrash) return p.folder_id === TRASH_FOLDER_ID;
      if (isUnassigned) return !p.folder_id || p.folder_id === '';
      return p.folder_id === folder.id;
    })
    .sort((a, b) => compareBySort(a, b, sort));

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
  }, []);

  useEffect(() => {
    if (folderProblems.length === 0) { setBlocksLoading(false); return; }
    setBlocksLoading(true);
    const loadBlocks = async () => {
      const map: Record<string, Block[]> = {};
      await Promise.all(
        folderProblems.map(async (p) => {
          try { map[p.id] = await getPreviewBlocks(p.id, p.tabs || []); } catch { map[p.id] = []; }
        })
      );
      setQuestionBlocksMap(map);
      setBlocksLoading(false);
    };
    loadBlocks();
  }, [folder.id, problems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 문항별 미해결 댓글 수 로드 (병렬, 실패는 0으로)
  useEffect(() => {
    if (folderProblems.length === 0) { setCommentCountsMap({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        folderProblems.map(async (p) => {
          try {
            const comments = await listAllComments(p.id);
            const n = comments.filter((c) => !c.resolved).length;
            return [p.id, n] as const;
          } catch {
            return [p.id, 0] as const;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, number> = {};
      for (const [id, n] of entries) map[id] = n;
      setCommentCountsMap(map);
    })();
    return () => { cancelled = true; };
  }, [folder.id, problems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 카드 ⋮ 메뉴 열기 — 버튼 위치 기준 */
  const openCardMenu = (e: React.MouseEvent<HTMLButtonElement>, problem: Problem) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCardMenu({ x: rect.right, y: rect.bottom + 4, problem });
  };

  const cardMenuItems: ContextMenuAction[] = (() => {
    if (isTrash) return [
      { label: '복원', icon: <IconCopy size={14} />, action: 'restore' },
      { label: '영구 삭제', icon: <IconTrash size={14} />, action: 'delete', danger: true },
    ];
    if (isSharedWithMe) return [
      { label: '공유 받기 해제', icon: <IconShare size={14} />, action: 'leave_shared', danger: true },
    ];
    return [
      { label: '사본 만들기', icon: <IconCopy size={14} />, action: 'duplicate' },
      { label: '휴지통', icon: <IconTrash size={14} />, action: 'trash', danger: true },
    ];
  })();

  const handleCardMenuAction = (action: string) => {
    if (!cardMenu) return;
    onProblemAction(action, cardMenu.problem);
    setCardMenu(null);
  };

  const renderBlocks = (blocks: Block[]) => {
    return blocks.map((block, i) => {
      const isBordered = BORDERED_TYPES.has(block.type);
      const headingTopPad = block.type === 'heading' && i !== 0 ? '1.5em' : undefined;
      if (block.type === 'image') {
        const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
        return (
          <div key={block.id || `img-${i}`} style={{ textAlign: 'center', margin: '0.8em 0' }}>
            {src ? <img src={src} alt="" style={{ width: block.imageWidth || 400, maxWidth: '90%', height: 'auto' }} /> : null}
          </div>
        );
      }
      if (block.type === 'svg') {
        return (
          <div key={block.id || `svg-${i}`} style={{ margin: '0.8em 0' }}>
            {block.raw_text ? (
              <SvgViewer url={block.raw_text} initialView={block.svg_initial_view} height={200} interactive={false} />
            ) : null}
          </div>
        );
      }
      if (block.type === 'ggb') {
        return (
          <div key={block.id || `ggb-${i}`} style={{
            margin: '0.8em 0', height: 200,
            background: '#fafafa',
            border: '1px solid var(--border-light, #e0e0e0)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted, #888)', fontSize: 12, fontFamily: 'var(--font-ui)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>📐</span>
              <span>GeoGebra</span>
            </div>
          </div>
        );
      }
      if (isBordered) {
        return (
          <div key={block.id || `b-${i}`} style={{ border: '0.7px solid var(--text-primary)', borderRadius: 0, padding: '12px 16px', margin: '1.2em 0' }}>
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </div>
        );
      }
      if (block.type === 'choices') {
        return <div key={block.id || `c-${i}`}><ChoicesBlock rawText={block.raw_text} locale="ko" /></div>;
      }
      return (
        <div key={block.id || `t-${i}`} style={{ paddingTop: headingTopPad }}>
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
      );
    });
  };

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={closestCenter}
      onDragStart={handleDndStart}
      onDragEnd={handleDndEnd}
      onDragCancel={() => setDraggingProblem(null)}
    >
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: 'var(--bg-functional)' }}>
      {/* ─── 제목바: 전체폭 아이보리 chrome (U자 밖) — 하위폴더 유무와 무관하게 높이 일정(가로 경계선 Y 통일) ─── */}
      <div style={{ flexShrink: 0, background: 'var(--bg-functional)', minHeight: 98, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', boxSizing: 'border-box' }}>
        {/* 행 1: 제목 행 — 57px */}
        <div style={{
          minHeight: 57, boxSizing: 'border-box',
          padding: '0',
          fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            {isUnassigned ? <IconInbox size={18} />
              : isTrash ? <IconTrash size={18} />
              : isSharedWithMe ? <IconShare size={18} />
              : folder.icon ? <TwemojiImg emoji={folder.icon} label={folder.name} size={18} />
              : <IconFolder size={18} />}
          </span>
          {breadcrumb.length > 1 && onSelectFolder && (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
              {breadcrumb.slice(0, -1).map((f) => (
                <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <button
                    onClick={() => onSelectFolder(f)}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 14, fontWeight: 500, color: 'var(--text-muted)',
                      fontFamily: 'var(--font-ui)', maxWidth: 160,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    {f.name}
                  </button>
                  <span style={{ margin: '0 4px' }}>/</span>
                </span>
              ))}
            </span>
          )}
          <span>{folder.name}</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>
            ({folderProblems.length})
          </span>
          <div style={{ flex: 1 }} />
          <SortControls sort={sort} onChange={updateSort} />
          {isTrash && folderProblems.length > 0 && onEmptyTrash && (
            <button onClick={onEmptyTrash} style={{
              border: 'none', background: 'none',
              color: 'var(--accent-danger)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontWeight: 500,
            }}>
              휴지통 비우기
            </button>
          )}
        </div>
        {/* 행 2: 하위 폴더 — 제목행과 함께 U자 밖 아이보리 영역에 위치 (가로 스크롤, 드롭 타깃) */}
        {childFolders.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'nowrap', gap: 8,
            padding: '0',
            minHeight: 41, boxSizing: 'border-box',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-light)',
            overflowX: 'auto', overflowY: 'hidden',
          }}>
            {childFolders.map((cf) => {
              const cfCount = problems.filter((p) => p.folder_id === cf.id).length;
              return (
                <Droppable key={cf.id} id={cf.id} data={{ folder: cf }}>
                  {({ setNodeRef, isOver }) => (
                    <button
                      ref={setNodeRef}
                      onClick={() => onSelectFolder?.(cf)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '4px 10px', borderRadius: 6,
                        border: isOver ? '1px solid var(--accent-primary, #5b6abf)' : '1px solid var(--border-light)',
                        background: isOver ? 'rgba(91, 106, 191, 0.12)' : 'var(--bg-card, #fff)',
                        boxShadow: isOver ? '0 0 0 2px rgba(91,106,191,0.25)' : 'none',
                        cursor: 'pointer', fontSize: 12.5, color: 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)', maxWidth: 220,
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!isOver) e.currentTarget.style.background = 'var(--bg-hover, #f5f5f5)'; }}
                      onMouseLeave={(e) => { if (!isOver) e.currentTarget.style.background = 'var(--bg-card, #fff)'; }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                        {cf.icon ? <TwemojiImg emoji={cf.icon} label={cf.name} size={14} /> : <IconFolder size={14} />}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cf.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({cfCount})</span>
                    </button>
                  )}
                </Droppable>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* ─── U-프레임: 클레이 + 3면 경계 + 상단 14px 라운드 (스크롤). 폴더 리스트 아래에서 시작 ─── */}
      <div style={{
        flex: 1, minHeight: 0, width: '100%',
        background: 'var(--bg-content)',
        fontSize: contentFontSize,
        overflow: 'auto', position: 'relative',
        borderTop: '0.5px solid var(--border-content)',
        borderLeft: '0.5px solid var(--border-content)',
        borderRight: '0.5px solid var(--border-content)',
        borderTopLeftRadius: 14, borderTopRightRadius: 14,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', boxSizing: 'border-box' }}>

        {blocksLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>로딩 중...</div>
        )}
        {!blocksLoading && folderProblems.length === 0 && childFolders.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {isTrash ? '휴지통이 비어 있습니다.' : isSharedWithMe ? '공유 받은 문항이 없습니다.' : '이 폴더에 문항이 없습니다.'}
          </div>
        )}

        {/* ═══ 카드 그리드 — 카드 폭 고정(35em), 브라우저 폭에 따라 1~2열 자동 ═══ */}
        {!blocksLoading && folderProblems.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 35em)',
            justifyContent: 'center',
            gap: 20,
            paddingTop: 28, // 경계선↔카드 상단 여백 (스크롤 영역 안이라 스크롤 시 사라짐)
            paddingBottom: '20vh',
          }}>
            {/* 카드 hover 강조: 배경 한 톤 진하게(#E4DBCB) + 그림자 강화. 페이드도 같은 색으로 동조 */}
            <style>{`
              .problem-card:hover { background: #E4DBCB !important; box-shadow: 0 4px 14px rgba(0,0,0,0.08) !important; }
              .problem-card:hover .problem-card-fade { background: linear-gradient(180deg, rgba(228,219,203,0) 0%, #E4DBCB 100%) !important; }
            `}</style>
            {folderProblems.map((problem) => {
              const blocks = questionBlocksMap[problem.id] || [];
              return (
                <Draggable key={problem.id} id={problem.id} data={{ problem }} disabled={!dndEnabled}>
                  {({ setNodeRef, attributes, listeners, isDragging }) => (
                <div
                  ref={setNodeRef}
                  {...attributes}
                  {...listeners}
                  onClick={() => onView(problem)}
                  className="problem-card"
                  style={{
                    background: 'var(--block-bg-active)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 12,
                    padding: '18px 22px',
                    height: 320,
                    overflow: 'hidden',
                    cursor: dndEnabled ? 'grab' : 'pointer',
                    opacity: isDragging ? 0.4 : 1,
                    position: 'relative',
                    transition: 'box-shadow 0.15s, transform 0.15s, background 0.15s',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* 카드 제목 + ⋮ 메뉴 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 10, paddingRight: 4,
                  }}>
                    <h2 style={{
                      flex: 1, minWidth: 0,
                      fontSize: 16, fontWeight: 600, margin: 0,
                      fontFamily: 'var(--font-ui)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {problem.title}
                    </h2>
                    {(commentCountsMap[problem.id] ?? 0) > 0 && (
                      <span
                        title="미해결 댓글"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 2,
                          fontSize: 11, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)', lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        💬<span style={{ marginLeft: 1 }}>{commentCountsMap[problem.id]}</span>
                      </span>
                    )}
                    <BlockchainBadge problem={problem} size={13} />
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => openCardMenu(e, problem)}
                      title="더보기"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        padding: 4, borderRadius: 4,
                        color: 'var(--text-faint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <IconDotsVertical size={16} />
                    </button>
                  </div>

                  {/* 카드 본문 — 잘림 */}
                  <div className="problem-content-scaled problem-content-toned" style={{
                    flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative',
                  }}>
                    <style>{`.problem-content-scaled > div { font-size: ${contentFontSize}px !important; }`}</style>
                    {renderBlocks(blocks)}
                    {/* 하단 fade out 그라데이션으로 잘린 부분 자연스럽게 */}
                    <div className="problem-card-fade" style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                      // 카드 배경(--block-bg-active #EDE6DA)으로 페이드 — 시작색도 같은 RGB의 투명값(회색 끼임 방지)
                      background: 'linear-gradient(180deg, rgba(237,230,218,0) 0%, var(--block-bg-active) 100%)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                </div>
                  )}
                </Draggable>
              );
            })}
          </div>
        )}
      </div>

      {/* ⋮ 카드 메뉴 */}
      {cardMenu && (
        <ContextMenu
          x={cardMenu.x}
          y={cardMenu.y}
          items={cardMenuItems}
          onClose={() => setCardMenu(null)}
          onAction={handleCardMenuAction}
        />
      )}
    </div>
    </div>

    <DragOverlay dropAnimation={null}>
      {draggingProblem ? (
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'var(--accent-primary, #5b6abf)', color: '#fff',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)', maxWidth: 280,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: 'grabbing',
        }}>
          {draggingProblem.title || '제목 없음'}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}

/* ═══ 정렬 컨트롤 ═══ */
function SortControls({ sort, onChange }: { sort: SortState; onChange: (s: SortState) => void }) {
  const selectStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
    outline: 'none', padding: '2px 4px', borderRadius: 4, fontWeight: 400,
  };
  const arrowBtnStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
    padding: '2px 4px', borderRadius: 4, minWidth: 16, lineHeight: 1, fontWeight: 400,
  };
  const toggleDir = () => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 4 }}>
      <select value={sort.key} onChange={(e) => onChange({ ...sort, key: e.target.value as SortKey })} style={selectStyle}>
        <option value="updated">{SORT_KEY_LABELS.updated}</option>
        <option value="name">{SORT_KEY_LABELS.name}</option>
      </select>
      <button onClick={toggleDir} style={arrowBtnStyle} title={sort.dir === 'asc' ? '오름차순' : '내림차순'}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}
