'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import type { User } from 'firebase/auth';
import { Problem, Block, Folder, UserProfile } from '../../types/problem';
import { getPreviewBlocks, TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID } from '../../lib/firestore';
import { useCommentCounts } from '../../hooks/useCommentCounts';
import ListView, { ListMode } from './ListView';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { blockKeyOf, buildCaseGapKeys, buildCaseLabels, caseClassName, caseGapClassName, injectCaseLabel, isCaseBlock } from '../../lib/caseBlock';
import SvgViewer from '../viewer/SvgViewer';
import BlockchainBadge from '../ui/BlockchainBadge';
import VerifyBadge from '../ui/VerifyBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import {
  IconTrash, IconCopy, IconFolder, IconInbox, IconDotsVertical, IconShare,
} from '../ui/Icons';
import { TwemojiImg } from '../editor/EmojiPickerPanel';
import { getChildren, getFolderPath } from '../../lib/folder-tree';
import CoachLabel from '../ui/CoachLabel';
import { coachClassName, isCoachBlock } from '../../lib/coachBlock';
import BatchVerifyDialog from './BatchVerifyDialog';

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
  /** Phase 61d: 일괄 검증 게이트·실행 주체. AppShell이 내린다(다이얼로그가 useAuth를 또 부르면
   *  onAuthStateChanged 구독과 users 프로필 upsert가 한 번 더 돈다) */
  user?: User | null;
  onSelectFolder?: (folder: Folder) => void;
  onMoveProblemToFolder?: (problem: Problem, folder: Folder) => void;
  // Phase 49: problems prop을 folder_id 필터 없이 그대로 사용(공유 보낸 뷰 등)
  passthrough?: boolean;
  // Phase 49: 공유 뷰 리스트 컨텍스트 (받은=소유자 컬럼, 보낸=권한/공유중단)
  listContext?: { mode: ListMode; recipientUid?: string; profiles?: Record<string, UserProfile> };
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
  user,
  passthrough = false, listContext,
}: FolderViewProps) {
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [questionBlocksMap, setQuestionBlocksMap] = useState<Record<string, Block[]>>({});
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  // ⋮ 카드 메뉴
  const [cardMenu, setCardMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);
  // Phase 61d: 일괄 검증 다이얼로그
  const [batchOpen, setBatchOpen] = useState(false);

  // Phase 49: 카드/리스트 보기 — 공유 뷰는 리스트 기본, 그 외 카드 기본. localStorage 영속.
  const VIEWMODE_KEY = `mathory.viewMode.${folder.id}`;
  const [viewMode, setViewMode] = useState<'card' | 'list'>(listContext ? 'list' : 'card');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEWMODE_KEY);
      if (stored === 'card' || stored === 'list') setViewMode(stored);
      else setViewMode(listContext ? 'list' : 'card');
    } catch { setViewMode(listContext ? 'list' : 'card'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.id]);
  const changeViewMode = (m: 'card' | 'list') => {
    setViewMode(m);
    try { localStorage.setItem(VIEWMODE_KEY, m); } catch {}
  };

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
  // 휴지통/미지정은 리스트 보기 비허용(전용 메뉴가 달라서) → 카드 고정
  const listAllowed = !isTrash && !isUnassigned;
  const effectiveViewMode: 'card' | 'list' = listAllowed ? viewMode : 'card';

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
      if (isSharedWithMe || passthrough) return true; // problems prop을 그대로 사용 (공유 받은/보낸 뷰)
      if (isTrash) return p.folder_id === TRASH_FOLDER_ID;
      if (isUnassigned) return !p.folder_id || p.folder_id === '';
      return p.folder_id === folder.id;
    })
    .sort((a, b) => compareBySort(a, b, sort));

  /* ═══ Phase 61d: 일괄 검증 게이트 ═══
     대상은 **폴더 직속 + 내 소유** 문항뿐이다. 휴지통·공유받음·공유보낸(passthrough·listContext)은
     제외하고 미지정은 포함한다(그 문항도 내 소유고 folderProblems 필터가 이미 걸러 준다).
     ⚠ 개별 항목 게이트는 다이얼로그가 다시 건다 — AI 댓글 create는 규칙상 오너만이다. */
  const batchOwnedCount = user
    ? folderProblems.filter((p) => !!p.authorUid && p.authorUid === user.uid).length
    : 0;
  const batchAllowed = !!user && !isTrash && !isSharedWithMe && !passthrough && !listContext
    && batchOwnedCount > 0;

  // 조용히 사라진 컨트롤은 "구현이 안 됐다"와 구별되지 않는다 — 개발 중에만 이유를 남긴다(61b 관례)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || batchAllowed) return;
    if (!user) console.info('[Phase61d] 일괄 검증 버튼 숨김: 로그인 정보 없음');
    else if (isTrash || isSharedWithMe || passthrough || listContext) {
      console.info('[Phase61d] 일괄 검증 버튼 숨김: 대상 아닌 폴더(휴지통·공유 계열)');
    } else console.info('[Phase61d] 일괄 검증 버튼 숨김: 내 소유 직속 문항 0건');
  }, [batchAllowed, user, isTrash, isSharedWithMe, passthrough, listContext]);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
  }, []);

  useEffect(() => {
    if (effectiveViewMode !== 'card') { setBlocksLoading(false); return; } // 리스트 모드는 카드 프리뷰 불필요
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
  }, [folder.id, problems.length, effectiveViewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 49: 미해결 댓글 수 + agent 세션 수 (ListView와 공유하는 훅)
  const { commentCounts: commentCountsMap, agentCounts: agentCountsMap } = useCommentCounts(folderProblems, folder.id);

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
      { label: '공유', icon: <IconShare size={14} />, action: 'share' },
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
    // Phase 59 — 경우 자동 번호. 카드는 접기가 없으므로 항상 전체 렌더다.
    const caseLabels = buildCaseLabels(blocks);
    const caseGaps = buildCaseGapKeys(blocks);
    return blocks.map((block, i) => {
      const node = renderOne(block, i, caseLabels);
      // 경우 사이에 낀 블록은 rail이 관통하도록 한 겹 두른다(형제 관계 유지)
      if (!caseGaps.has(blockKeyOf(block))) return node;
      return <div key={block.id || `gap-${i}`} className={caseGapClassName(block.type)}>{node}</div>;
    });
  };

  const renderOne = (block: Block, i: number, caseLabels: Map<string, string>) => {
    {
      const isBordered = BORDERED_TYPES.has(block.type);
      const headingTopPad = block.type === 'heading' && i !== 0 ? '0.5em' : undefined;   // Phase 58 D2
      if (block.type === 'image') {
        const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
        return (
          <div key={block.id || `img-${i}`} style={{ textAlign: 'center', margin: '0.8em 0' }}>
            {src ? <img src={src} alt="" style={{ width: block.imageWidth || 400, maxWidth: '90%', height: 'auto', ...imageTreatmentStyle(block) }} /> : null}
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
      if (isCaseBlock(block.type)) {
        /* Phase 59: 경우 — rail·dot·자동 번호. 카드에는 접기가 없다 */
        const label = caseLabels.get(blockKeyOf(block)) ?? null;
        return (
          <div key={block.id || `case-${i}`} className={caseClassName(block.type, !!label)}>
            <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko" />
          </div>
        );
      }
      if (isCoachBlock(block.type)) {
        /* Phase 59a: 코칭 — 라벨(Important/Caution)은 raw_text가 아니라 렌더가 붙인다 */
        return (
          <div key={block.id || `q-${i}`} className={coachClassName(block.type)}>
            <CoachLabel type={block.type} />
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </div>
        );
      }
      if (block.type === 'callout') {
        /* Phase 57: 들여쓰기 블록(구 '강조문') — 테두리 없이 display 수식과 같은 좌단·상하 여백 */
        return (
          <div key={block.id || `q-${i}`} className="callout-block">
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
    }
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
          {listAllowed && <ViewModeToggle mode={effectiveViewMode} onChange={changeViewMode} />}
          {effectiveViewMode === 'card' && <SortControls sort={sort} onChange={updateSort} />}
          {batchAllowed && (
            <button
              onClick={() => setBatchOpen(true)}
              title="이 폴더의 문항을 골라 AI 교차검증합니다 (API 비용 발생)"
              style={{
                border: 'none', background: 'none',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontWeight: 500,
              }}
            >
              일괄 검증
            </button>
          )}
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
            // Phase 62 D5 — 클레이 상단 가로 구분선 제거(덕수). 리스트 행 폭(1136px)의 기준선이었다.
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

      {/* ─── 스크롤 컨테이너 (Phase 62: 프레임 없음. 바탕은 루트의 아이보리) ───
          Phase 62 P1 — U자 클레이 프레임을 걷어냈다. 클레이 = "문항 하나를 보는 중",
          아이보리 = "문항 밖". 이제 클레이는 카드·리스트 행이 담당한다.
          ⚠ U자 프레임은 EditorView·ProblemView 2곳이 공유한다 — FolderView에 되살리지 말 것.
          overflow/position/fontSize는 유지한다(스크롤·sticky·DnD의 기준). */}
      <div style={{
        flex: 1, minHeight: 0, width: '100%',
        fontSize: contentFontSize,
        overflow: 'auto', position: 'relative',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', boxSizing: 'border-box' }}>

        {blocksLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>로딩 중...</div>
        )}
        {effectiveViewMode === 'card' && !blocksLoading && folderProblems.length === 0 && childFolders.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {isTrash ? '휴지통이 비어 있습니다.' : isSharedWithMe ? '공유 받은 문항이 없습니다.' : '이 폴더에 문항이 없습니다.'}
          </div>
        )}

        {/* ═══ 리스트 보기 (Phase 49) ═══ */}
        {effectiveViewMode === 'list' && (
          <ListView
            problems={folderProblems}
            scopeKey={folder.id}
            mode={listContext?.mode ?? 'my'}
            recipientUid={listContext?.recipientUid}
            profiles={listContext?.profiles}
            onView={onView}
            onProblemAction={onProblemAction}
            onChanged={() => onUpdated?.()}
          />
        )}

        {/* ═══ 카드 그리드 — 카드 폭 고정(35em), 브라우저 폭에 따라 1~2열 자동 ═══ */}
        {effectiveViewMode === 'card' && !blocksLoading && folderProblems.length > 0 && (
          <div style={{
            display: 'grid',
            // 카드 폭 고정 px → 컬럼 수가 글꼴 크기와 무관하게 '폭'에만 의존 (35em@15 ≈ 525 기준 520)
            gridTemplateColumns: 'repeat(auto-fill, 520px)',
            justifyContent: 'center',
            gap: 20,
            paddingTop: 28, // 경계선↔카드 상단 여백 (스크롤 영역 안이라 스크롤 시 사라짐)
            paddingBottom: '20vh',
          }}>
            {/* Phase 62 D9 — hover 규칙은 globals.css `.problem-card:hover` 한 곳이 소유한다.
                (--card-surface 하나가 배경과 페이드를 함께 움직이므로 !important도 필요 없다) */}
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
                    // Phase 62 D2 — 클레이 카드. 인라인이 --card-surface를 참조하므로
                    // globals.css의 :hover가 변수만 갈아끼우면 배경·페이드가 함께 따라온다.
                    background: 'var(--card-surface, var(--bg-content))',
                    border: '0.5px solid var(--border-content)',
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
                    {(agentCountsMap[problem.id] ?? 0) > 0 && (
                      <span
                        title="AI agent 대화"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 2,
                          fontSize: 11, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)', lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>AI</span>
                        <span style={{ marginLeft: 1 }}>{agentCountsMap[problem.id]}</span>
                      </span>
                    )}
                    <VerifyBadge problem={problem} size={11} />
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
                  {/* Phase 58 P2 — 카드는 question 블록만 렌더하므로 톤 스코프 밖이다(D9).
                      색 기준선(.tone-baseline)만 유지하고 solution-tone은 붙이지 않는다. */}
                  <div className="problem-content-scaled problem-content-toned tone-baseline" style={{
                    flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative',
                  }}>
                    <style>{`.problem-content-scaled > div { font-size: ${contentFontSize}px !important; }`}</style>
                    {renderBlocks(blocks)}
                    {/* 하단 fade out 그라데이션으로 잘린 부분 자연스럽게 */}
                    <div className="problem-card-fade" style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                      // Phase 62 D4 — 카드 배경(--card-surface)으로 페이드. 변수 하나가 카드·hover·페이드를
                      // 함께 움직이므로 hover용 페이드 규칙이 따로 없고, 하드코딩 rgba도 사라졌다
                      // (토큰만 옮겨 여기가 어긋났던 78a780f 사고의 구조적 차단).
                      // `transparent`는 현대 브라우저가 premultiplied alpha로 보간해 회색이 끼지 않는다.
                      background: 'linear-gradient(180deg, transparent 0%, var(--card-surface, var(--bg-content)) 100%)',
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

      {/* Phase 61d: 일괄 검증. ⚠ 전체 뷰포트 모달이라 이 위치에 두어도 사이드바까지 덮는다
          (main은 z-index 없는 position:relative라 스태킹 컨텍스트를 만들지 않는다) */}
      {batchOpen && user && (
        <BatchVerifyDialog
          folderName={folder.name}
          problems={folderProblems}
          user={user}
          onClose={(didChange) => {
            setBatchOpen(false);
            // 배지 갱신은 종료 시 1회만 — 문항별 리프레시는 목록 전체 리로드를 n번 유발한다
            if (didChange) onUpdated?.();
          }}
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

/* ═══ 카드/리스트 토글 (Phase 49) ═══ */
function ViewModeToggle({ mode, onChange }: { mode: 'card' | 'list'; onChange: (m: 'card' | 'list') => void }) {
  const btn = (active: boolean): React.CSSProperties => ({
    border: 'none', cursor: 'pointer', fontSize: 12, padding: '3px 8px', borderRadius: 6,
    fontFamily: 'var(--font-ui)', fontWeight: active ? 600 : 400,
    background: active ? 'var(--bg-active)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
      <button onClick={() => onChange('card')} style={btn(mode === 'card')} title="카드 보기">카드</button>
      <button onClick={() => onChange('list')} style={btn(mode === 'list')} title="리스트 보기">리스트</button>
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
