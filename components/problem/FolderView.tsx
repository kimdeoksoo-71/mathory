'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
/* Phase 63 S0 — DndContext·센서·오버레이·드롭 핸들러는 AppShell로 이관(D21).
   여기 남는 것은 Draggable(카드)·Droppable(칩) 등록뿐이고, id는 dndId 프리픽스(D34),
   data에는 type이 필수다(D23 — 전역 핸들러가 type으로 분기한다). */
import { Draggable, Droppable, dndId, useDragKind, DROP_RING, DROP_TINT } from '../ui/dnd';
import type { User } from 'firebase/auth';
import { Problem, Block, Folder, UserProfile } from '../../types/problem';
import {
  getPreviewBlocks, moveProblemsToFolder, deleteProblem,
  TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID,
} from '../../lib/firestore';
import FolderPickerDialog from '../ui/FolderPickerDialog';
import { alertDialog, confirmDialog } from '../../lib/dialogs';
import { useCommentCounts } from '../../hooks/useCommentCounts';
import ListView, { ListMode, ListHeader, type FolderRowData } from './ListView';
import { toggledListSort } from '../../lib/listColumns';
import { useListPrefs } from '../../hooks/useListPrefs';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { blockKeyOf, buildCaseGapKeys, buildCaseLabels, caseClassName, caseGapClassName, injectCaseLabel, isCaseBlock } from '../../lib/caseBlock';
import SvgViewer from '../viewer/SvgViewer';
import BlockchainBadge from '../ui/BlockchainBadge';
import VerifyBadge from '../ui/VerifyBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import {
  IconTrash, IconCopy, IconFolder, IconInbox, IconDotsVertical, IconShare, IconComment, IconFolderMove,
} from '../ui/Icons';
import { TwemojiImg } from '../editor/EmojiPickerPanel';
import { getChildren, getFolderPath } from '../../lib/folder-tree';
import CoachBlock from '../ui/CoachBlock';
import { isCoachBlock } from '../../lib/coachBlock';
import BatchVerifyDialog from './BatchVerifyDialog';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
/** Phase 63 D3 — 정렬 목표선의 상단 간격. ListView 루트 paddingTop 8과 짝이다(어긋나면
 *  맨 위에서 첫 행이 밀리거나 당겨진다). */
const SNAP_TOP_GAP = 8;
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
    v = (a.title || '').localeCompare(b.title || '', 'ko', { numeric: true, sensitivity: 'base' });   // "문제2" < "문제10"
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
  // Phase 49: problems prop을 folder_id 필터 없이 그대로 사용(공유 보낸 뷰 등)
  passthrough?: boolean;
  // Phase 49: 공유 뷰 리스트 컨텍스트 (받은=소유자 컬럼, 보낸=권한/공유중단)
  listContext?: { mode: ListMode; recipientUid?: string; profiles?: Record<string, UserProfile> };
}

/* Phase 63 D1 — 폐기된 폴더별 보기 모드 키 소거(1회). 모듈 플래그라 폴더를 오가도 한 번만 돈다. */
let viewModeKeysSwept = false;
function sweepLegacyViewModeKeys() {
  if (viewModeKeysSwept || typeof window === 'undefined') return;
  viewModeKeysSwept = true;
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mathory.viewMode.')) stale.push(key);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {}
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
  folder, problems, folders, onEdit, onView, onProblemAction, onEmptyTrash, onUpdated, onSelectFolder,
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

  // Phase 63 D1 — 보기 모드는 비영속·기본 리스트. 카드는 버튼으로만, 폴더를 바꾸면 리스트로 리셋.
  // (Phase 49의 폴더별 localStorage 영속을 폐기 — 두 폴더만 다른 모드로 열리면 보기 모드가
  //  저절로 바뀌는 듯 보였다. 옛 mathory.viewMode.* 키는 첫 마운트에서 한 번 소거한다.)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  useEffect(() => { setViewMode('list'); }, [folder.id]);
  useEffect(() => { sweepLegacyViewModeKeys(); }, []);
  const changeViewMode = (m: 'card' | 'list') => {
    setViewMode(m);
    setSelectedIds(new Set()); // D20 — 보기 전환은 선택 해제
  };

  useEffect(() => { setSort(loadSort()); }, []);

  const updateSort = (next: SortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_KEY, JSON.stringify(next)); } catch {}
  };

  const isTrash = folder.id === TRASH_FOLDER_ID;
  const isUnassigned = folder.id === UNASSIGNED_FOLDER_ID;
  const isSharedWithMe = folder.id === SHARED_WITH_ME_FOLDER_ID;
  const isSpecial = isTrash || isUnassigned || isSharedWithMe;
  // Phase 63 D2 — listAllowed 폐지: 휴지통·미지정도 리스트가 기본이다. "전용 메뉴" 사유는
  // ListView mode:'trash'가 흡수했다(미지정 메뉴는 원래 기본 메뉴와 같았다 — A-2).
  const listMode: ListMode = isTrash ? 'trash' : listContext?.mode ?? 'my';

  // Phase 63 S4(D9) — 칼럼·정렬 prefs. 폴더별 localStorage 영속(useListPrefs), 헤더가
  // 제목바 행 2에 살아 FolderView가 소유한다. 휴지통 기본 정렬만 수정일 내림차순(D41).
  const { prefs, updatePrefs } = useListPrefs(folder.id, isTrash);
  const toggleListSort = (key: string) => updatePrefs((p) => ({ ...p, sort: toggledListSort(p.sort, key) }));

  /* Phase 63 D43 — 헤더↔행 트랙 동기화: 본문 grid 루트의 사용된 트랙 폭을
     getComputedStyle로 읽어(px 목록 — H3 실측, ⚠ subgrid 행이 아니라 루트에서만) 헤더
     템플릿으로 내린다. 갱신 = 본문 ResizeObserver + prefs 변경 effect. 스크롤바 "항상
     표시" 환경은 헤더 래퍼 paddingRight로 보정(중앙정렬 어긋남 방지). */
  const bodyGridRef = useRef<HTMLDivElement | null>(null);
  const [headerTemplate, setHeaderTemplate] = useState<string | null>(null);
  const [headerPadRight, setHeaderPadRight] = useState(0);
  useEffect(() => {
    if (viewMode !== 'list') return;
    const body = bodyGridRef.current;
    const scrollEl = scrollRef.current;
    if (!body || !scrollEl) return;
    const measure = () => {
      const t = getComputedStyle(body).gridTemplateColumns;
      setHeaderTemplate((prev) => (prev === t ? prev : t));
      const pad = scrollEl.offsetWidth - scrollEl.clientWidth;
      setHeaderPadRight((prev) => (prev === pad ? prev : pad));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
    // prefs(숨김·순서·폭)·행 수 변화는 루트 폭을 안 바꿔 ResizeObserver가 못 본다 — deps로 재측정
  }, [viewMode, prefs, problems.length]);

  // Phase 63 D3 — 드래그 중에는 행 정렬을 꺼야 dnd-kit 자동 스크롤과 싸우지 않는다.
  // DragKindContext는 드래그 시작·끝에만 바뀐다(F7) — 매 move 리렌더가 아니다.
  const dragKind = useDragKind();

  /* ═══ Phase 63 D3(재개정) — 행 단위 정렬은 CSS 스냅이 아니라 JS다 ═══
     CSS scroll-snap은 proximity·mandatory 둘 다 실기기(macOS 트랙패드)에서 무동작이었다
     (T3 검수 2회 — CDP 합성 휠 프로브에서는 둘 다 스냅했으므로 구조 문제가 아니라
     실기기 스크롤 경로의 브라우저 동작). → 스크롤이 완전히 멈춘 순간(scrollend, 미지원이면
     scroll 디바운스 140ms)에만 가까운 행 상단으로 부드럽게 정렬한다. 스크롤 중 저항 0.
     대상 행은 [data-snap-row] 마크(ListView 문항 행 — S3의 폴더 행도 이 마크를 단다). */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const alignGateRef = useRef<{ list: boolean; dragging: boolean }>({ list: true, dragging: false });
  alignGateRef.current = { list: viewMode === 'list', dragging: dragKind !== null };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const align = () => {
      const gate = alignGateRef.current;
      if (!gate.list || gate.dragging) return;
      const rows = el.querySelectorAll<HTMLElement>('[data-snap-row]');
      if (rows.length === 0) return;
      // 목표선 = 컨테이너 상단 + 8(ListView 마스크 띠 높이와 짝 — 첫 행이 무이동으로 정렬)
      const target = el.getBoundingClientRect().top + SNAP_TOP_GAP;
      // 목표선 바로 위 행(dPrev ≤ 0)과 바로 아래 행(dNext > 0) 두 후보를 잡는다(문서 순서)
      let dPrev = -Infinity;
      let dNext = Infinity;
      for (const row of rows) {
        const d = row.getBoundingClientRect().top - target;
        if (d <= 0) dPrev = d;
        else { dNext = d; break; }
      }
      // 도달 가능한 후보 중 가까운 쪽. ⚠ 맨 아래에서는 아래(dNext)로 못 가므로 위(dPrev)로
      // 당겨 정렬한다(T3 4회차 — 바닥 클램프로 포기하면 역방향 끝에서 윗행이 걸친다).
      // 그때 마지막 행이 바닥에 잘리지 않는 것은 ListView paddingBottom(한 행 피치 이상)이 보장.
      const maxDown = el.scrollHeight - el.clientHeight - el.scrollTop;
      const canDown = dNext <= maxDown + 0.5;
      const canUp = dPrev >= -el.scrollTop - 0.5;
      let delta: number;
      if (canDown && (!canUp || dNext < -dPrev)) delta = dNext;
      else if (canUp) delta = dPrev;
      else return;
      if (Math.abs(delta) < 1) return; // 이미 정렬(자기 정렬 스크롤의 재발화 포함 — 루프 없음)
      el.scrollBy({ top: delta, behavior: 'smooth' });
    };
    // ⚠ 'onscrollend' in el 가드는 lib.dom에 선언이 없어 el을 never로 좁힌다(별칭 내로잉 포함)
    //   → 검사는 window에(의미 동일 — scrollend 지원은 브라우저 전역), el은 좁히지 않는다
    if ('onscrollend' in window) {
      el.addEventListener('scrollend', align);
      return () => el.removeEventListener('scrollend', align);
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => { if (timer) clearTimeout(timer); timer = setTimeout(align, 140); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (timer) clearTimeout(timer); };
  }, []);

  // Phase 40: 하위 폴더 + 브레드크럼 (일반 폴더에서만)
  const childFolders = isSpecial ? [] : getChildren(folders, folder.id);
  const breadcrumb = isSpecial ? [] : getFolderPath(folders, folder.id);

  // Phase 63 D24 — 드래그 소스 조건 재정의: 내 소유 문항·비공유 뷰. 휴지통·미지정 포함
  // (휴지통 문항 → 폴더 드롭 = 그 폴더로 복원, Q10). "하위 폴더 있을 때" 조건은 삭제 —
  // 타깃이 사이드바 트리·미지정·휴지통에 항상 있다. 드롭 처리는 AppShell 전역 핸들러(S0).
  const dragUid = user && !passthrough && !listContext && !isSharedWithMe ? user.uid : null;

  /* Phase 63 D15 — 폴더 행 데이터: 직속 문항 수 + 수정일(하위 트리 문항 max(updated_at) →
     비면 폴더 문서 updated_at → created_at). 계산은 한 패스 O(P×depth) — 각 문항의 폴더에서
     조상으로 걸어 올라가며 max 갱신(하위 폴더마다 getDescendantIds를 도는 O(F·P) 금지). */
  const folderRowsData = useMemo<FolderRowData[]>(() => {
    if (childFolders.length === 0) return [];
    const parentOf = new Map(folders.map((f) => [f.id, f.parent_id || null]));
    const maxByFolder = new Map<string, number>();
    for (const p of problems) {
      if (!p.folder_id || p.folder_id === TRASH_FOLDER_ID) continue;
      const t = p.updated_at?.getTime() ?? 0;
      let cur: string | null = p.folder_id;
      const guard = new Set<string>(); // 순환 방어(getFolderPath와 같은 규약)
      while (cur && !guard.has(cur)) {
        guard.add(cur);
        if ((maxByFolder.get(cur) ?? 0) < t) maxByFolder.set(cur, t);
        cur = parentOf.get(cur) ?? null;
      }
    }
    return childFolders.map((cf) => ({
      folder: cf,
      count: problems.filter((p) => p.folder_id === cf.id).length,
      updated: maxByFolder.has(cf.id) ? new Date(maxByFolder.get(cf.id)!) : cf.updated_at ?? cf.created_at,
    }));
  }, [childFolders, folders, problems]);

  const folderProblems = problems
    .filter((p) => {
      if (isSharedWithMe || passthrough) return true; // problems prop을 그대로 사용 (공유 받은/보낸 뷰)
      if (isTrash) return p.folder_id === TRASH_FOLDER_ID;
      if (isUnassigned) return !p.folder_id || p.folder_id === '';
      return p.folder_id === folder.id;
    })
    .sort((a, b) => compareBySort(a, b, sort));

  /* ═══ Phase 63 S5(D16~D20·D35) — 다중 선택 ═══
     상태는 FolderView 소유(선택 바가 행 1에 산다). 해제 = 폴더 변경·보기 전환·이동 완료·
     Escape — 정렬 변경엔 유지(헤더가 행 2에 남아 성립, D20). 선택 = 이동 목적이라
     드래그 소스 조건(dragUid — 내 소유·비공유 뷰)과 같은 게이트다. */
  const selectable = !!dragUid;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  useEffect(() => { setSelectedIds(new Set()); setBatchMoveOpen(false); }, [folder.id]);
  // 목록 갱신 시 사라진 문항을 선택에서 정리 — 이동·삭제 완료 해제가 여기서 성립한다
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(folderProblems.map((p) => p.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems]);
  // Escape 해제(D20)
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedIds(new Set()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds.size]);

  const clearSelection = () => setSelectedIds(new Set());
  const runBatchMove = async (folderId: string | null) => {
    const ids = [...selectedIds];
    setBatchMoveOpen(false);
    if (ids.length === 0) return;
    try {
      await moveProblemsToFolder(ids, folderId); // D19 — writeBatch 청크, TRASH만 스탬프
      onUpdated?.();
    } catch (e) {
      console.error('일괄 이동 에러:', e);
      await alertDialog('문항 이동에 실패했습니다.');
    }
    clearSelection();
  };
  const runBatchTrash = async () => {
    // D35 — 다중 → 휴지통만 확인(단건 드래그·⋮는 무확인)
    if (!await confirmDialog({
      title: '휴지통으로 이동', message: `${selectedIds.size}개 문항을 휴지통으로 이동하시겠습니까?`,
      danger: true, confirmLabel: '이동',
    })) return;
    await runBatchMove(TRASH_FOLDER_ID);
  };
  const runBatchRestore = () => runBatchMove(null); // 복원처는 미지정(A-18)
  const runBatchDelete = async () => {
    if (!await confirmDialog({
      title: '영구 삭제',
      message: [`${selectedIds.size}개 문항을 영구 삭제하시겠습니까?`, '이 작업은 되돌릴 수 없습니다.'],
      danger: true, confirmLabel: '영구 삭제',
    })) return;
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => deleteProblem(id)));
      onUpdated?.();
    } catch (e) {
      console.error('영구 삭제 에러:', e);
      await alertDialog('영구 삭제에 실패했습니다.');
    }
    clearSelection();
  };

  /* ═══ Phase 61d: 일괄 검증 게이트 ═══
     대상은 **폴더 직속 + 내 소유** 문항뿐이다. 휴지통·공유받음·공유보낸(passthrough·listContext)은
     제외하고 미지정은 포함한다(그 문항도 내 소유고 folderProblems 필터가 이미 걸러 준다).
     ⚠ 개별 항목 게이트는 다이얼로그가 다시 건다 — AI 댓글 create는 규칙상 오너만이다. */
  const batchOwnedCount = user
    ? folderProblems.filter((p) => !!p.authorUid && p.authorUid === user.uid).length
    : 0;
  const batchAllowed = !!user && !isTrash && !isSharedWithMe && !passthrough && !listContext
    && batchOwnedCount > 0;

  // Phase 63 D45 — 일괄 검증 버튼은 리스트 모드에서만(카드는 편집·열람용이라 짝이 아니다).
  // batchAllowed 자체·다이얼로그·게이트는 61d 그대로다.
  const batchButtonVisible = batchAllowed && viewMode === 'list';

  // 조용히 사라진 컨트롤은 "구현이 안 됐다"와 구별되지 않는다 — 개발 중에만 이유를 남긴다(61b 관례)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || batchButtonVisible) return;
    if (!user) console.info('[Phase61d] 일괄 검증 버튼 숨김: 로그인 정보 없음');
    else if (isTrash || isSharedWithMe || passthrough || listContext) {
      console.info('[Phase61d] 일괄 검증 버튼 숨김: 대상 아닌 폴더(휴지통·공유 계열)');
    } else if (batchAllowed) {
      console.info('[Phase61d] 일괄 검증 버튼 숨김: 카드 보기(리스트에서만 노출)');
    } else console.info('[Phase61d] 일괄 검증 버튼 숨김: 내 소유 직속 문항 0건');
  }, [batchButtonVisible, batchAllowed, user, isTrash, isSharedWithMe, passthrough, listContext]);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'card') { setBlocksLoading(false); return; } // 리스트 모드는 카드 프리뷰 불필요
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
  }, [folder.id, problems.length, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Phase 63 D17(A-21) — 기본 메뉴엔 있던 '폴더 변경'이 이 자체 메뉴에서 빠져 있었다
      { label: '폴더 변경', icon: <IconFolderMove size={14} />, action: 'move' },
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
        /* Phase 59a: 코칭 — 라벨은 raw_text가 아니라 렌더가 붙인다.
           개선묶음 M2 G(Q13): 카드는 **항상 펼침**이다 — 320px 축약 미리보기에서
           아이콘 하나만 남으면 무엇이 들었는지 알 수 없다. */
        return (
          <CoachBlock key={block.id || `q-${i}`} type={block.type}>
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </CoachBlock>
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
              {/* Phase 63 D25(Q6) — 브레드크럼 상위 폴더 = 드롭 타깃. 현재 폴더는 slice(0,-1)로
                  이미 제외돼 있다(같은 폴더 드롭은 어차피 무시). 하이라이트는 링+틴트 한 문법(D27). */}
              {breadcrumb.slice(0, -1).map((f) => (
                <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Droppable id={dndId.crumb(f.id)} data={{ type: 'folder', folder: f }}>
                    {({ setNodeRef, isOver }) => (
                      <button
                        ref={setNodeRef}
                        onClick={() => onSelectFolder(f)}
                        style={{
                          border: 'none', cursor: 'pointer', padding: '0 2px', borderRadius: 4,
                          background: isOver ? DROP_TINT : 'none',
                          boxShadow: isOver ? DROP_RING : 'none',
                          fontSize: 14, fontWeight: 500, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)', maxWidth: 160,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.textDecoration = 'none'; }}
                      >
                        {f.name}
                      </button>
                    )}
                  </Droppable>
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
          {/* Phase 63 D17·D44 — 선택 ≥1이면 행 1 우측 컨트롤 자리를 선택 바가 대체한다.
              행 2 칼럼 헤더는 그대로라 선택 중 정렬 변경이 가능하고 선택도 유지된다(D20).
              높이 변화 0 — 행 1은 minHeight 57 고정. */}
          {viewMode === 'list' && selectedIds.size > 0 ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
                {selectedIds.size}개 선택
              </span>
              {isTrash ? (
                <>
                  <button onClick={runBatchRestore} style={selectionBarBtn}>복원</button>
                  <button onClick={runBatchDelete} style={{ ...selectionBarBtn, color: 'var(--accent-danger)' }}>영구 삭제</button>
                </>
              ) : (
                <>
                  <button onClick={() => setBatchMoveOpen(true)} style={selectionBarBtn}>폴더 변경…</button>
                  <button onClick={runBatchTrash} style={{ ...selectionBarBtn, color: 'var(--accent-danger)' }}>휴지통</button>
                </>
              )}
              <button onClick={clearSelection} style={{ ...selectionBarBtn, color: 'var(--text-muted)' }}>해제</button>
            </div>
          ) : (
          <>
          <ViewModeToggle mode={viewMode} onChange={changeViewMode} />
          {viewMode === 'card' && <SortControls sort={sort} onChange={updateSort} />}
          {batchButtonVisible && (
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
          </>
          )}
        </div>
        {/* 행 2 (Phase 63 D42): 리스트 모드 = 칼럼 헤더 — 스크롤 밖이라 트랙패드 고무줄
            오버스크롤에도 밀리지 않는다. 하위 폴더 칩은 카드 모드 전용이 됐고,
            리스트의 하위 폴더 접근은 S3(D11)의 폴더 행이 잇는다. */}
        {viewMode === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', minHeight: 41, boxSizing: 'border-box', paddingRight: headerPadRight }}>
            <ListHeader
              mode={listMode}
              prefs={prefs}
              template={headerTemplate}
              checkbox={selectable}
              onToggleSort={toggleListSort}
              onPrefsChange={updatePrefs}
            />
          </div>
        )}
        {/* 행 2: 하위 폴더 칩 (카드 모드) — 가로 스크롤, 드롭 타깃 */}
        {viewMode === 'card' && childFolders.length > 0 && (
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
                <Droppable key={cf.id} id={dndId.chip(cf.id)} data={{ type: 'folder', folder: cf }}>
                  {({ setNodeRef, isOver }) => (
                    <button
                      ref={setNodeRef}
                      onClick={() => onSelectFolder?.(cf)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '4px 10px', borderRadius: 6,
                        // D27 — 링+틴트, border 불변(하이라이트 한 문법)
                        border: '1px solid var(--border-light)',
                        background: isOver ? DROP_TINT : 'var(--bg-card, #fff)',
                        boxShadow: isOver ? DROP_RING : 'none',
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
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, width: '100%',
        fontSize: contentFontSize,
        overflow: 'auto', position: 'relative',
        // Phase 63 D3(재개정) — 행 정렬은 위의 scrollend JS가 담당한다. CSS scroll-snap은
        // 실기기에서 무동작이라 철거했다(두 기계장치를 겹치지 않는다).
      }}>
        {/* 개선묶음 M2 E — 카드보기의 열수 제한을 푼다.
            2열 제한의 진범은 grid가 아니라 이 래퍼의 maxWidth:1200이었다
            (가용 1136 < 3열 필요폭 1600). 카드보기일 때만 열어 준다 —
            리스트보기는 Phase 62 D8의 "행 폭 = 제목바 폭(1136)" 정렬 기준선이 걸려 있다.
            ⚠ longhand는 키를 빼지 말고 항상 값을 줄 것(조건부 style 함정). */}
        <div style={{
          maxWidth: viewMode === 'card' ? 'none' : 1200,
          margin: '0 auto', padding: '0 32px', boxSizing: 'border-box',
        }}>

        {blocksLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>로딩 중...</div>
        )}
        {viewMode === 'card' && !blocksLoading && folderProblems.length === 0 && childFolders.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {isTrash ? '휴지통이 비어 있습니다.' : isSharedWithMe ? '공유 받은 문항이 없습니다.' : '이 폴더에 문항이 없습니다.'}
          </div>
        )}

        {/* ═══ 리스트 보기 (Phase 49) ═══ */}
        {viewMode === 'list' && (
          <ListView
            problems={folderProblems}
            scopeKey={folder.id}
            mode={listMode}
            prefs={prefs}
            bodyGridRef={bodyGridRef}
            folderRows={folderRowsData}
            onSelectFolder={onSelectFolder}
            dragUid={dragUid}
            selectedIds={selectable ? selectedIds : undefined}
            onSelectionChange={selectable ? setSelectedIds : undefined}
            recipientUid={listContext?.recipientUid}
            profiles={listContext?.profiles}
            onView={onView}
            onProblemAction={onProblemAction}
            onChanged={() => onUpdated?.()}
          />
        )}

        {/* ═══ 카드 그리드 — 카드 폭 고정(35em), 브라우저 폭에 따라 1~2열 자동 ═══ */}
        {viewMode === 'card' && !blocksLoading && folderProblems.length > 0 && (
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
                <Draggable key={problem.id} id={dndId.card(problem.id)} data={{ type: 'problem', problem }} disabled={!dragUid || problem.authorUid !== dragUid}>
                  {({ setNodeRef, attributes, listeners, isDragging }) => {
                  const canDrag = !!dragUid && problem.authorUid === dragUid;
                  /* D30 — 전역 KeyboardSensor의 onKeyDown 활성자는 스프레드에서 제외한다:
                     카드는 attributes로 tabIndex를 받으므로, 빼지 않으면 포커스된 카드에서
                     Space/Enter가 드래그를 시작한다(포인터 전용 소스). */
                  const { onKeyDown: _kbdActivator, ...pointerListeners } = (listeners ?? {}) as Record<string, unknown>;
                  return (
                <div
                  ref={setNodeRef}
                  {...attributes}
                  {...pointerListeners}
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
                    cursor: canDrag ? 'grab' : 'pointer',
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
                        <IconComment size={12} /><span style={{ marginLeft: 1 }}>{commentCountsMap[problem.id]}</span>
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
                        <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>Agent</span>
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
                  );
                  }}
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

      {/* Phase 63 S5(D17) — 다중 선택 폴더 변경 픽커(M2 A-4의 FolderPickerDialog 재사용) */}
      {batchMoveOpen && (
        <FolderPickerDialog
          folders={folders}
          currentFolderId={isSpecial ? null : folder.id}
          title={`${selectedIds.size}개 문항 이동`}
          onCancel={() => setBatchMoveOpen(false)}
          onPick={runBatchMove}
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
  );
}

/* Phase 63 D17 — 선택 바 버튼 문법(행 1의 기존 텍스트 버튼들과 동일) */
const selectionBarBtn: React.CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
  fontFamily: 'var(--font-ui)', padding: 0,
};

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
