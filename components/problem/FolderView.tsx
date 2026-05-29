'use client';

import { useState, useEffect, useCallback } from 'react';
import { Problem, Block, Folder } from '../../types/problem';
import { getPreviewBlocks, TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID } from '../../lib/firestore';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import SvgViewer from '../viewer/SvgViewer';
import BlockchainBadge from '../ui/BlockchainBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import {
  IconTrash, IconCopy, IconFolder, IconInbox, IconDotsVertical, IconShare,
} from '../ui/Icons';

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
  folder, problems, folders, onEdit, onView, onProblemAction, onEmptyTrash, onUpdated,
}: FolderViewProps) {
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [questionBlocksMap, setQuestionBlocksMap] = useState<Record<string, Block[]>>({});
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  // ⋮ 카드 메뉴
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);

  useEffect(() => { setSort(loadSort()); }, []);

  const updateSort = (next: SortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_KEY, JSON.stringify(next)); } catch {}
  };

  const isTrash = folder.id === TRASH_FOLDER_ID;
  const isUnassigned = folder.id === UNASSIGNED_FOLDER_ID;
  const isSharedWithMe = folder.id === SHARED_WITH_ME_FOLDER_ID;

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
          <div key={block.id || `b-${i}`} style={{ border: '1.5px solid var(--text-muted, #888)', borderRadius: 0, padding: '12px 16px', margin: '1.2em 0' }}>
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
    <div style={{
      flex: 1, minHeight: 0, width: '100%',
      background: 'var(--bg-primary, #FAF9F7)',
      fontSize: contentFontSize,
      overflow: 'auto', position: 'relative',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', boxSizing: 'border-box' }}>
        {/* 폴더명 헤더 (sticky) */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: 'var(--bg-primary, #FAF9F7)', padding: '24px 0 12px 0',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: 20,
          fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
            {isUnassigned ? <IconInbox size={18} /> : isTrash ? <IconTrash size={18} /> : isSharedWithMe ? <IconShare size={18} /> : <IconFolder size={18} />}
          </span>
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

        {blocksLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>로딩 중...</div>
        )}
        {!blocksLoading && folderProblems.length === 0 && (
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
            paddingBottom: '20vh',
          }}>
            {folderProblems.map((problem) => {
              const blocks = questionBlocksMap[problem.id] || [];
              return (
                <div
                  key={problem.id}
                  onClick={() => onView(problem)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-light)',
                    borderRadius: 12,
                    padding: '18px 22px',
                    height: 320,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  {/* 카드 제목 + ⋮ 메뉴 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 10, paddingRight: 4,
                  }}>
                    <h2 style={{
                      flex: 1, minWidth: 0,
                      fontSize: 16, fontWeight: 700, margin: 0,
                      fontFamily: 'var(--font-ui)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {problem.title}
                    </h2>
                    <BlockchainBadge problem={problem} size={13} />
                    <button
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
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 100%)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                </div>
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
