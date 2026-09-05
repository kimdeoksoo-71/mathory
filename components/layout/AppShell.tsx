'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import useAuth from '../../hooks/useAuth';
import { Problem, Folder, UserProfile } from '../../types/problem';
import { DIFFICULTIES } from '../../lib/constants';
import {
  listProblems, listRecentProblems, listFolders,
  createFolder, updateFolder, deleteFolder, updateFolderOrders,
  moveProblemToFolder,
  getFolderProblemCount, createProblem, saveQuestionBlock, saveSolutionBlock,
  getProblemWithBlocks,
  duplicateProblem, moveToTrash, emptyTrash,
  TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID, SHARED_WITH_ME_FOLDER_ID,
  getProblemSearchText,
} from '../../lib/firestore';
import { listSharedWithMe, listSharedByMe } from '../../lib/membership';
import { getUserProfile, needsNicknameSetup } from '../../lib/users';
import { ShareScope, shareScopeKey } from '../../lib/share-scope';
import NicknameSetupModal from '../user/NicknameSetupModal';
import BazaarView from '../share/BazaarView';
import PublicProblemView from '../share/PublicProblemView';
import SnapshotView from '../share/SnapshotView';
import ShareTargetModal from '../share/ShareTargetModal';
import SheetImportModal from '../import/SheetImportModal';
import { getDescendantIds, getChildren } from '../../lib/folder-tree';
import { claimSession, watchSession, releaseSession } from '../../lib/session';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DragKindContext, appCollisionDetection, type DragKind } from '../ui/dnd';

import Sidebar, { SIDEBAR_WIDTH_DEFAULT } from '../layout/Sidebar';
import { useDrawerResize } from '../../hooks/useDrawerResize';
import DrawerResizeHandle from '../ui/DrawerResizeHandle';
import SearchOverlay from '../layout/SearchOverlay';
import FolderView from '../problem/FolderView';
import ProblemView from '../problem/ProblemView';
import EditorView from '../editor/EditorView';
import FolderPickerDialog from '../ui/FolderPickerDialog';
import { alertDialog, confirmDialog, promptDialog } from '../../lib/dialogs';

type ViewState =
  | { type: 'home' }
  | { type: 'folder'; folder: Folder }
  | { type: 'share'; scope: ShareScope }
  | { type: 'problem'; problemId: string }
  | { type: 'editor'; problemId: string }
  | { type: 'new' }
  // Phase 53 E: 앱 셸 내 공개 뷰어 임베드 (비오너·비멤버 열람 / 스냅샷)
  | { type: 'public-problem'; problemId: string }
  | { type: 'public-shared'; shareId: string };

function getDifficultyLabel(value: number): string {
  const found = DIFFICULTIES.find((d) => d.value === value);
  return found ? found.label : `${value}`;
}

function downloadMarkdown(problem: { title: string; source?: string; exam_type: string; subject?: string; category: string; difficulty: number; answer?: string; question_blocks: { raw_text: string }[]; solution_blocks: { raw_text: string }[] }) {
  const questionContent = problem.question_blocks
    .map((b) => b.raw_text)
    .join('\n\n');
  const solutionContent = problem.solution_blocks
    .map((b) => b.raw_text)
    .join('\n\n');

  let md = `# ${problem.title}\n\n`;
  md += `> ${problem.source || problem.exam_type} | ${problem.subject || problem.category} | ${getDifficultyLabel(problem.difficulty)}`;
  if (problem.answer) md += ` | 정답: ${problem.answer}`;
  md += '\n\n';
  md += `## 문제\n\n${questionContent}\n\n`;
  if (solutionContent.trim()) {
    md += `## 풀이\n\n${solutionContent}\n`;
  }

  const safeTitle = problem.title.replace(/[/\\:*?"<>|]/g, '_');
  const filename = `${safeTitle}.md`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AppShell() {
  const { user, loading: authLoading } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  /* 개선묶음 M2 A-4 — 폴더 이동 픽커 대상 문항(null이면 닫힘) */
  const [moveTarget, setMoveTarget] = useState<Problem | null>(null);
  /* Phase 62 D13·D18 — 좌측 사이드바 폭. 상한을 창 비례로 묶는 것은 편집창 최소 폭(≈1054px@15px)
     때문이다: 사이드바를 무한정 넓히면 content-frame이 가로 스크롤로 떨어진다. */
  const sidebar = useDrawerResize({
    defaultWidth: SIDEBAR_WIDTH_DEFAULT,
    min: 200,
    max: () => Math.min(480, Math.round(window.innerWidth * 0.33)),
    anchor: 'left',
  });
  const [showSearch, setShowSearch] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [recentProblems, setRecentProblems] = useState<Problem[]>([]);
  const [sharedProblems, setSharedProblems] = useState<Problem[]>([]);
  // Phase 49: 내가 멤버 공유한 문항(보낸) + 공유 관련 사용자 프로필 캐시
  const [sentProblems, setSentProblems] = useState<Problem[]>([]);
  const [shareProfiles, setShareProfiles] = useState<Record<string, UserProfile>>({});
  // Phase 50: 내가 웹 공개한 share 목록
  // Phase 48: 닉네임 설정 진입 가드 (소프트 넛지 — 세션당 1회 자동, 닫기 가능)
  const [nicknameModal, setNicknameModal] = useState<{ uid: string; current?: string } | null>(null);
  const nicknameNudgedRef = useRef(false);
  // Phase 49: 공유 대상 관리 모달
  const [shareModalProblem, setShareModalProblem] = useState<Problem | null>(null);
  // Phase 61a: 시트 가져오기 마법사
  const [sheetImportOpen, setSheetImportOpen] = useState(false);
  // 검색 인덱스: problemId → 본문 텍스트(소문자). 첫 검색 시 lazy 로드.
  const [searchTextIndex, setSearchTextIndex] = useState<Record<string, string>>({});
  const [searchIndexLoading, setSearchIndexLoading] = useState(false);
  const searchIndexBuiltRef = useRef(false);

  const buildSearchIndex = useCallback(async () => {
    if (searchIndexBuiltRef.current || searchIndexLoading) return;
    searchIndexBuiltRef.current = true;
    setSearchIndexLoading(true);
    try {
      const all = [...allProblems, ...sharedProblems];
      const entries = await Promise.all(
        all.map(async (p) => [p.id, await getProblemSearchText(p.id, p.tabs || []).catch(() => '')] as const),
      );
      setSearchTextIndex(Object.fromEntries(entries));
    } finally {
      setSearchIndexLoading(false);
    }
  }, [allProblems, sharedProblems, searchIndexLoading]);

  // 문항 목록이 바뀌면(추가/삭제) 인덱스 무효화
  useEffect(() => {
    searchIndexBuiltRef.current = false;
    setSearchTextIndex({});
  }, [allProblems.length, sharedProblems.length]);

  const [view, setView] = useState<ViewState>({ type: 'home' });
  const [problemViewNonce, setProblemViewNonce] = useState(0);

  // ─── 단일 활성 세션 (다른 곳에서 로그인 시 자동 로그아웃) ───
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const ok = await claimSession(user.uid);
      if (cancelled) return;
      if (!ok) {
        // 재시도 실패 → 미등록 상태 작업 차단 위해 강제 로그아웃
        await signOut(auth).catch(() => {});
        return;
      }
      setKicked(false);
      unsub = watchSession(user.uid, () => {
        setKicked(true);
        setView({ type: 'home' });
      });
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) {
      setAllProblems([]);
      setRecentProblems([]);
      setSharedProblems([]);
      setSentProblems([]);
      setShareProfiles({});
      setFolders([]);
      setFolderCounts({});
      return;
    }
    try {
      const [problems, recent, shared, sent] = await Promise.all([
        listProblems(user.uid),
        listRecentProblems(user.uid, 10),
        listSharedWithMe(user.uid).catch((err) => {
          console.error('공유받은 문항 로드 실패:', err);
          return [] as Problem[];
        }),
        listSharedByMe(user.uid).catch((err) => {
          console.error('공유보낸 문항 로드 실패:', err);
          return [] as Problem[];
        }),
      ]);
      setAllProblems(problems);
      setSharedProblems(shared);
      setSentProblems(sent);
      // 최근 문항에서 휴지통 문항 제외
      setRecentProblems(recent.filter((p) => p.folder_id !== TRASH_FOLDER_ID));

      {
        const userFolders = await listFolders(user.uid);
        setFolders(userFolders);
        const counts: Record<string, number> = {};
        for (const f of userFolders) {
          counts[f.id] = problems.filter((p) => p.folder_id === f.id).length;
        }
        counts[TRASH_FOLDER_ID] = problems.filter((p) => p.folder_id === TRASH_FOLDER_ID).length;
        counts[UNASSIGNED_FOLDER_ID] = problems.filter((p) => !p.folder_id || p.folder_id === '').length;
        counts[SHARED_WITH_ME_FOLDER_ID] = shared.length;
        setFolderCounts(counts);
      }
    } catch (error) {
      console.error('데이터 로드 에러:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  // Phase 48: 로그인 후 닉네임 설정 가드 — 세션당 1회만 자동 노출
  useEffect(() => {
    if (authLoading || !user || nicknameNudgedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (cancelled || nicknameNudgedRef.current) return;
        if (needsNicknameSetup(profile)) {
          nicknameNudgedRef.current = true;
          setNicknameModal({ uid: user.uid, current: profile?.nickname });
        }
      } catch (err) {
        console.error('닉네임 프로필 확인 실패:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  // Phase 52(D5)/53(E): 로그인 후 딥링크 진입
  //  ?view=bazaar → Bazaar 전체 / ?view=p&id= → 공개 문항 임베드 / ?view=shared&id= → 스냅샷 임베드
  const bazaarDeepLinkRef = useRef(false);
  useEffect(() => {
    if (!user || bazaarDeepLinkRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const id = params.get('id');
    if (v === 'bazaar') {
      bazaarDeepLinkRef.current = true;
      setView({ type: 'share', scope: { kind: 'bazaar', filter: 'all' } });
      window.history.replaceState({}, '', '/');
    } else if (v === 'p' && id) {
      bazaarDeepLinkRef.current = true;
      setView({ type: 'public-problem', problemId: id });
      window.history.replaceState({}, '', '/');
    } else if (v === 'shared' && id) {
      bazaarDeepLinkRef.current = true;
      setView({ type: 'public-shared', shareId: id });
      window.history.replaceState({}, '', '/');
    }
  }, [user]);

  // Phase 49: 공유 트리에 필요한 사용자 프로필 해석 (보낸 대상 + 받은 출처) — 캐시 재사용
  useEffect(() => {
    const uids = new Set<string>();
    sharedProblems.forEach((p) => { if (p.authorUid) uids.add(p.authorUid); });
    sentProblems.forEach((p) => (p.memberUids || []).forEach((u) => uids.add(u)));
    const missing = [...uids].filter((u) => !shareProfiles[u]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        missing.map((u) => getUserProfile(u).then((p) => [u, p] as const).catch(() => [u, null] as const)),
      );
      if (cancelled) return;
      setShareProfiles((cur) => {
        const next = { ...cur };
        for (const [u, p] of pairs) if (p) next[u] = p;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [sharedProblems, sentProblems, shareProfiles]);

  // Phase 49: 사람별 그룹화 (받은 = authorUid 기준, 보낸 = recipient uid 기준)
  const receivedByAuthor = useMemo(() => {
    const m = new Map<string, Problem[]>();
    for (const p of sharedProblems) {
      const a = p.authorUid || '';
      if (!a) continue;
      (m.get(a) ?? m.set(a, []).get(a)!).push(p);
    }
    return m;
  }, [sharedProblems]);

  const sentByRecipient = useMemo(() => {
    const m = new Map<string, Problem[]>();
    for (const p of sentProblems) {
      for (const u of p.memberUids || []) {
        (m.get(u) ?? m.set(u, []).get(u)!).push(p);
      }
    }
    return m;
  }, [sentProblems]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) { console.error('로그인 에러:', error); }
  };

  const handleLogout = async () => {
    try {
      if (user) await releaseSession(user.uid);
      await signOut(auth);
      setView({ type: 'home' });
    } catch (error) { console.error('로그아웃 에러:', error); }
  };

  const handleNewProblem = async () => {
    if (!user) { await alertDialog('로그인이 필요합니다.'); return; }
    // FolderView에서 호출 시: 현재 폴더 아래 생성 (가상 폴더 — 휴지통/미지정/공유받음 — 제외)
    // ProblemView/EditorView/Home에서 호출 시: 미지정(folder_id 없음)
    let targetFolderId: string | undefined;
    if (view.type === 'folder') {
      const fid = view.folder.id;
      if (fid && fid !== TRASH_FOLDER_ID && fid !== UNASSIGNED_FOLDER_ID && fid !== SHARED_WITH_ME_FOLDER_ID) {
        targetFolderId = fid;
      }
    }
    try {
      const newProblemId = await createProblem({
        title: '새 문제',
        year: new Date().getFullYear(),
        exam_type: '',
        category: '',
        difficulty: 3,
        tags: [],
        answer: '',
        authorUid: user.uid,
        visibility: 'private',
        ...(targetFolderId ? { folder_id: targetFolderId } : {}),
      });
      await saveQuestionBlock(newProblemId, { order: 0, type: 'text', raw_text: '' });
      await saveSolutionBlock(newProblemId, { order: 0, type: 'text', raw_text: '' });
      await loadData();
      setView({ type: 'editor', problemId: newProblemId });
    } catch (error) {
      console.error('새 문제 생성 에러:', error);
      await alertDialog('문제 생성에 실패했습니다.');
    }
  };

  const handleSelectFolder = (folder: Folder) => { setView({ type: 'folder', folder }); };
  const handleSelectUnassigned = () => {
    setView({ type: 'folder', folder: { id: UNASSIGNED_FOLDER_ID, name: '미지정', user_id: '', order: 99998 } });
  };
  const handleSelectTrash = () => {
    setView({ type: 'folder', folder: { id: TRASH_FOLDER_ID, name: '휴지통', user_id: '', order: 99999 } });
  };
  const handleSelectSharedWithMe = () => {
    setView({ type: 'share', scope: { kind: 'received-all' } });
  };
  const handleSelectShareScope = (scope: ShareScope) => {
    setView({ type: 'share', scope });
  };
  const handleViewProblem = (problem: Problem) => { setView({ type: 'problem', problemId: problem.id }); };
  const handleEditProblem = (problem: Problem) => { setView({ type: 'editor', problemId: problem.id }); };
  const handleNavigateFolder = (folderId: string) => {
    if (folderId === TRASH_FOLDER_ID) { handleSelectTrash(); return; }
    if (folderId === UNASSIGNED_FOLDER_ID || !folderId) { handleSelectUnassigned(); return; }
    const folder = folders.find((f) => f.id === folderId);
    if (folder) { setView({ type: 'folder', folder }); }
  };

  const handleNewFolder = async () => {
    if (!user) return;
    const name = await promptDialog({ title: '새 폴더', placeholder: '폴더 이름' });
    if (!name?.trim()) return;
    try {
      const rootCount = getChildren(folders, null).length;
      await createFolder({ name: name.trim(), user_id: user.uid, order: rootCount, parent_id: null });
      await loadData();
    } catch (error) { console.error('폴더 생성 에러:', error); }
  };

  // Phase 40: 하위 폴더 생성
  const handleNewSubfolder = async (parent: Folder) => {
    if (!user) return;
    const name = await promptDialog({
      title: '하위 폴더 만들기',
      message: `"${parent.name}" 안에 만듭니다.`,
      placeholder: '폴더 이름',
    });
    if (!name?.trim()) return;
    try {
      const siblingCount = getChildren(folders, parent.id).length;
      await createFolder({ name: name.trim(), user_id: user.uid, order: siblingCount, parent_id: parent.id });
      await loadData();
    } catch (error) { console.error('하위 폴더 생성 에러:', error); }
  };

  // Phase 40: 폴더 이동(재부모화). 순환(자기 자손으로 이동) 방지.
  const handleMoveFolder = async (folder: Folder, newParentId: string | null) => {
    if ((folder.parent_id || null) === (newParentId || null)) return;
    if (newParentId && getDescendantIds(folders, folder.id).has(newParentId)) {
      await alertDialog('폴더를 자기 자신의 하위 폴더로는 이동할 수 없습니다.');
      return;
    }
    try {
      const siblingCount = getChildren(folders, newParentId).length;
      await updateFolder(folder.id, { parent_id: newParentId, order: siblingCount });
      await loadData();
    } catch (error) { console.error('폴더 이동 에러:', error); }
  };

  // Phase 10: 폴더 이름 변경 / 삭제
  const handleFolderAction = async (action: 'rename' | 'delete', folder: Folder) => {
    switch (action) {
      case 'rename': {
        const newName = await promptDialog({
          title: '폴더 이름 변경', defaultValue: folder.name, placeholder: '폴더 이름',
          confirmLabel: '변경',
        });
        if (newName?.trim() && newName.trim() !== folder.name) {
          try {
            await updateFolder(folder.id, { name: newName.trim() });
            await loadData();
            if (view.type === 'folder' && view.folder.id === folder.id) {
              setView({ type: 'folder', folder: { ...folder, name: newName.trim() } });
            }
          } catch (error) { console.error('폴더 이름 변경 에러:', error); }
        }
        break;
      }
      case 'delete': {
        const subtree = getDescendantIds(folders, folder.id);
        const subCount = subtree.size - 1; // 자기 제외
        const problemCount = folders
          .filter((f) => subtree.has(f.id))
          .reduce((sum, f) => sum + (folderCounts[f.id] ?? 0), 0);
        const lines = [`"${folder.name}" 폴더를 삭제하시겠습니까?`];
        if (subCount > 0) lines.push(`하위 폴더 ${subCount}개도 함께 삭제됩니다.`);
        if (problemCount > 0) lines.push(`포함된 ${problemCount}개 문항은 미분류로 이동됩니다.`);
        if (await confirmDialog({
          title: '폴더 삭제', message: lines, danger: true, confirmLabel: '삭제',
        })) {
          try {
            if (!user) return;
            await deleteFolder(folder.id, user.uid);
            // 삭제된 폴더(또는 그 하위)를 보고 있었다면 홈으로
            if (view.type === 'folder' && subtree.has(view.folder.id)) {
              setView({ type: 'home' });
            }
            await loadData();
          } catch (error) { console.error('폴더 삭제 에러:', error); }
        }
        break;
      }
    }
  };

  // Phase 39: 폴더 아이콘(이모지) 설정 / 해제
  const handleSetFolderIcon = async (folder: Folder, emoji: string | null) => {
    try {
      await updateFolder(folder.id, { icon: emoji ?? '' });
      await loadData();
      if (view.type === 'folder' && view.folder.id === folder.id) {
        setView({ type: 'folder', folder: { ...folder, icon: emoji ?? '' } });
      }
    } catch (error) { console.error('폴더 아이콘 변경 에러:', error); }
  };

  // Phase 10: 폴더 순서 변경 (드래그)
  const handleFolderReorder = async (reorderedFolders: Folder[]) => {
    setFolders(reorderedFolders);
    try {
      // Phase 40: order는 폴더 자체 값(형제 그룹 내 인덱스)을 영속화 — 배열 위치가 아님
      const orders = reorderedFolders.map((f) => ({ id: f.id, order: f.order ?? 0 }));
      await updateFolderOrders(orders);
    } catch (error) {
      console.error('폴더 순서 변경 에러:', error);
      await loadData();
    }
  };

  // Phase 10: 문항을 폴더로 드래그 이동
  const handleMoveProblemToFolder = async (problem: Problem, folder: Folder) => {
    try {
      await moveProblemToFolder(problem.id, folder.id);
      await loadData();
    } catch (error) {
      console.error('문항 이동 에러:', error);
    }
  };

  /* ═══ Phase 63 S0 — 앱 전역 DnD 컨텍스트 (D21) ═══
     사이드바·FolderView의 두 컨텍스트를 여기 하나로 합쳤다. AppShell이 드는 상태는
     activeDragItem(오버레이 라벨 + DragKindContext 값, start/end 2회 변화)뿐이다 —
     onDragOver 핸들러·dragOverFolderId를 두지 말 것: over는 드래그 내내 바뀌므로
     여기서 setState하면 매 move마다 앱 전체가 리렌더된다(F7). 타깃 하이라이트는
     각 타깃이 자기 isOver + DragKindContext로 판정한다. */
  const [activeDragItem, setActiveDragItem] = useState<{ kind: DragKind; label: string } | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleAppDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current;
    if (d?.type === 'problem') {
      setActiveDragItem({ kind: 'problem', label: (d.problem as Problem).title || '제목 없음' });
    } else if (d?.type === 'problems') {
      setActiveDragItem({ kind: 'problems', label: `문항 ${(d.problems as Problem[]).length}개` });
    } else if (d?.type === 'folder') {
      // folder는 오버레이 없음(D28) — sortable 변형이 제자리에서 움직인다
      setActiveDragItem({ kind: 'folder', label: '' });
    }
  };

  const handleAppDragEnd = (e: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = e;
    if (!over) return;
    const activeType = active.data.current?.type;
    const overData = over.data.current;

    if (activeType === 'folder') {
      // 폴더 순서 변경 — 같은 부모(형제) 안에서만 (재부모화는 ⋯ 메뉴. Sidebar에서 이관)
      if (overData?.type !== 'folder' || active.id === over.id) return;
      const activeFolder = folders.find((f) => f.id === active.id);
      const overFolder = folders.find((f) => f.id === over.id);
      if (!activeFolder || !overFolder) return;
      const ap = activeFolder.parent_id || null;
      const op = overFolder.parent_id || null;
      if (ap !== op) return; // 다른 그룹으로 드래그 → 무시

      const siblings = folders
        .filter((f) => (f.parent_id || null) === ap)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const oldIdx = siblings.findIndex((f) => f.id === active.id);
      const newIdx = siblings.findIndex((f) => f.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      const reorderedSiblings = arrayMove(siblings, oldIdx, newIdx);
      // 형제 그룹 안에서만 order 재부여, 나머지 폴더는 그대로
      const orderById = new Map(reorderedSiblings.map((f, i) => [f.id, i]));
      const next = folders.map((f) =>
        orderById.has(f.id) ? { ...f, order: orderById.get(f.id)! } : f
      );
      handleFolderReorder(next);
    } else if (activeType === 'problem') {
      const problem = active.data.current?.problem as Problem | undefined;
      if (!problem || overData?.type !== 'folder') return;
      const folder = overData.folder as Folder;
      // 같은 폴더 무시 — null 정규화 비교(미지정은 null·'' 공존, D26)
      if ((problem.folder_id || null) === folder.id) return;
      handleMoveProblemToFolder(problem, folder);
    }
    // 'problems'(다중)·unassigned/trash 타깃은 S3·S5에서
  };

  const handleAppDragCancel = () => setActiveDragItem(null);

  const handleProblemAction = async (action: string, problem: Problem) => {
    switch (action) {
      case 'rename': {
        const newName = await promptDialog({
          title: '문항 이름 변경', defaultValue: problem.title, placeholder: '문항 이름',
          confirmLabel: '변경',
        });
        if (newName?.trim()) {
          const { updateProblem } = await import('../../lib/firestore');
          await updateProblem(problem.id, { title: newName.trim() });
          await loadData();
        }
        break;
      }
      case 'duplicate': {
        try {
          const newId = await duplicateProblem(problem.id, user?.uid);
          await loadData();
          setView({ type: 'problem', problemId: newId });
        } catch (error) {
          console.error('사본 생성 에러:', error);
          await alertDialog('사본 생성에 실패했습니다.');
        }
        break;
      }
      case 'trash': {
        try {
          await moveToTrash(problem.id);
          if (view.type === 'problem' && view.problemId === problem.id) {
            setView({ type: 'home' });
          }
          await loadData();
        } catch (error) {
          console.error('휴지통 이동 에러:', error);
        }
        break;
      }
      case 'delete': {
        // 휴지통에서 영구 삭제 (하위 호환)
        if (await confirmDialog({
          title: '영구 삭제', message: `"${problem.title}"을(를) 영구 삭제하시겠습니까?`,
          danger: true, confirmLabel: '영구 삭제',
        })) {
          const { deleteProblem } = await import('../../lib/firestore');
          await deleteProblem(problem.id);
          // Phase 63 T2 검수 반영 — 휴지통 목록에서 지웠으면 휴지통에 머문다.
          // 홈 강제 이동은 그 문항을 열어 보고 있던 경우에만(휴지통 이동 케이스와 같은 규약).
          if (view.type === 'problem' && view.problemId === problem.id) {
            setView({ type: 'home' });
          }
          await loadData();
        }
        break;
      }
      case 'restore': {
        try {
          await moveProblemToFolder(problem.id, null);
          await loadData();
          // Phase 63 T2 검수 반영 — 복원 후 문항이 돌아간 곳(미지정)으로 이동해 결과를 보여 준다.
          // (복원 대상 폴더를 따로 저장하지 않으므로 복원처는 항상 미지정이다 — A-18)
          setView({ type: 'folder', folder: { id: UNASSIGNED_FOLDER_ID, name: '미지정', user_id: '', order: 99998 } });
        } catch (error) {
          console.error('복원 에러:', error);
        }
        break;
      }
      case 'leave_shared': {
        if (!user) break;
        if (!await confirmDialog({
          title: '공유 받기 해제', message: `"${problem.title}" 공유 받기를 해제하시겠습니까?`,
          danger: true, confirmLabel: '해제',
        })) break;
        try {
          const { leaveAsMember } = await import('../../lib/membership');
          await leaveAsMember(problem.id, user.uid);
          await loadData();
        } catch (error) {
          console.error('공유 해제 에러:', error);
          await alertDialog('공유 해제에 실패했습니다.');
        }
        break;
      }
      case 'share': {
        setShareModalProblem(problem);
        break;
      }
      case 'move': {
        /* 개선묶음 M2 A-4 (D6′) — 이름 타이핑 prompt를 폴더 픽커로 교체.
           옛 방식은 이름 문자열 매칭이라 ① 동명 폴더가 있으면 엉뚱한 곳으로 가고
           ② 오타를 내면 아무 일도 안 일어났다(무음 실패) ③ '미지정'으로 되돌릴
           방법이 없었다. 셋 다 픽커에서는 구조적으로 생기지 않는다. */
        setMoveTarget(problem);
        break;
      }
      case 'download_md': {
        try {
          const full = await getProblemWithBlocks(problem.id);
          if (full) {
            downloadMarkdown(full);
          } else {
            await alertDialog('문제 데이터를 불러올 수 없습니다.');
          }
        } catch (error) {
          console.error('MD 다운로드 에러:', error);
          await alertDialog('다운로드에 실패했습니다.');
        }
        break;
      }
    }
  };

  const handleEmptyTrash = async () => {
    const trashCount = allProblems.filter((p) => p.folder_id === TRASH_FOLDER_ID).length;
    if (trashCount === 0) {
      await alertDialog('휴지통이 비어 있습니다.');
      return;
    }
    if (await confirmDialog({
      title: '휴지통 비우기',
      message: [`휴지통의 ${trashCount}개 문항을 영구 삭제하시겠습니까?`,
                '이 작업은 되돌릴 수 없습니다.'],
      danger: true, confirmLabel: '영구 삭제',
    })) {
      try {
        if (!user) return;
        await emptyTrash(user.uid);
        setView({ type: 'home' });
        await loadData();
      } catch (error) {
        console.error('휴지통 비우기 에러:', error);
        await alertDialog('휴지통 비우기에 실패했습니다.');
      }
    }
  };

  const handleEditorBack = () => {
    if (view.type === 'editor') {
      setProblemViewNonce((n) => n + 1);
      setView({ type: 'problem', problemId: view.problemId });
    } else {
      setView({ type: 'home' });
    }
    loadData();
  };

  /* 개선묶음 M2 F(D32′) — ProblemView/EditorView 진입 시 자동 접기를 **제거**했다.
     의지와 무관하게 접혀서 실사용에 불편했다(덕수). 접힘 상태는 이제 사용자 토글만이 바꾼다.
     ⚠ 강제 펼침(setCollapsed(false))도 함께 걷어냈다 — 한쪽만 남기면 "내가 접어 둔 것이
       이동할 때마다 풀리는" 반대 방향의 같은 불편이 된다.
     ⚠ 좁은 창에서 본문 좌측이 잘리던 문제(Phase 62 K1)는 D의 컨테이너 개편이 담당한다.
       그래서 F는 D와 같은 스텝이다 — F만 먼저 나가면 K1 잘림이 실결함으로 승격된다(D33′). */

  const activeFolderId = view.type === 'folder' ? view.folder.id : null;
  const activeShareScopeKey = view.type === 'share' ? shareScopeKey(view.scope) : null;
  const receivedGroups = useMemo(() => {
    const arr = [...receivedByAuthor.entries()].map(([uid, ps]) => ({ uid, count: ps.length }));
    arr.sort((a, b) => (shareProfiles[a.uid]?.nickname || shareProfiles[a.uid]?.displayName || '')
      .localeCompare(shareProfiles[b.uid]?.nickname || shareProfiles[b.uid]?.displayName || ''));
    return arr;
  }, [receivedByAuthor, shareProfiles]);
  const sentGroups = useMemo(() => {
    const arr = [...sentByRecipient.entries()].map(([uid, ps]) => ({ uid, count: ps.length }));
    arr.sort((a, b) => (shareProfiles[a.uid]?.nickname || shareProfiles[a.uid]?.displayName || '')
      .localeCompare(shareProfiles[b.uid]?.nickname || shareProfiles[b.uid]?.displayName || ''));
    return arr;
  }, [sentByRecipient, shareProfiles]);
  const isEditorMode = view.type === 'editor';
  const isProblemMode = view.type === 'problem';

  return (
    /* Phase 63 S0 — DndContext는 앱 루트 하나(D21). 사이드바(소스·타깃)와 main(FolderView의
       카드·칩)이 형제라 둘을 모두 품는 자리는 여기뿐이다. EditorView·UserGroupEditor의
       자체 DndContext는 중첩이어도 무해하다 — 센서가 각자의 draggable 노드에 바인딩된다(A-25). */
    <DndContext
      sensors={dndSensors}
      collisionDetection={appCollisionDetection}
      onDragStart={handleAppDragStart}
      onDragEnd={handleAppDragEnd}
      onDragCancel={handleAppDragCancel}
    >
    <DragKindContext.Provider value={activeDragItem?.kind ?? null}>
    {/* Phase 62 D18 — 사이드바 리사이즈 핸들의 기준 상자. AppShell 안에는 절대배치 요소가 없어
        position:relative를 줘도 파급이 없다. ⚠ 핸들을 <aside> 안에 두면 overflow:hidden에 잘린다. */}
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <Sidebar
        collapsed={collapsed}
        width={sidebar.width}
        dragging={sidebar.dragging}
        onToggle={() => setCollapsed(!collapsed)}
        folders={folders}
        folderCounts={folderCounts}
        recentProblems={recentProblems}
        activeFolderId={activeFolderId}
        user={user}
        onNewProblem={handleNewProblem}
        onSearch={() => setShowSearch(true)}
        onSheetImport={async () => {
          // ⚠ 개선묶음 M2 A — 57곳 중 sync였던 두 번째 자리(A-7′).
          //   prop 타입은 `() => void`지만 `() => Promise<void>`가 할당 가능하다.
          if (!user) { await alertDialog('로그인이 필요합니다.'); return; }
          setSheetImportOpen(true);
        }}
        onSelectFolder={handleSelectFolder}
        onNewFolder={handleNewFolder}
        onFolderAction={handleFolderAction}
        onSetFolderIcon={handleSetFolderIcon}
        onNewSubfolder={handleNewSubfolder}
        onMoveFolder={handleMoveFolder}
        onViewProblem={handleViewProblem}
        onEditProblem={handleEditProblem}
        onProblemAction={handleProblemAction}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSelectTrash={handleSelectTrash}
        trashCount={folderCounts[TRASH_FOLDER_ID] ?? 0}
        onSelectUnassigned={handleSelectUnassigned}
        unassignedCount={folderCounts[UNASSIGNED_FOLDER_ID] ?? 0}
        onSelectSharedWithMe={handleSelectSharedWithMe}
        sharedCount={folderCounts[SHARED_WITH_ME_FOLDER_ID] ?? 0}
        receivedGroups={receivedGroups}
        sentGroups={sentGroups}
        shareProfiles={shareProfiles}
        activeShareScopeKey={activeShareScopeKey}
        onSelectShareScope={handleSelectShareScope}
      />

      {/* Phase 62 D18 — 사이드바 우변 리사이즈 핸들. aside·main의 형제로 루트에 둔다
          (aside 안은 overflow:hidden이라 잘린다). 접힘 상태에서는 폭이 고정이라 미렌더. */}
      {!collapsed && (
        <DrawerResizeHandle
          side="left"
          offset={sidebar.width - 5}
          active={sidebar.dragging || sidebar.hover}
          {...sidebar.handleProps}
        />
      )}

      <main style={{
        flex: 1,
        position: 'relative',
        overflow: isEditorMode || isProblemMode || view.type === 'folder' || view.type === 'share'
          || view.type === 'public-problem' || view.type === 'public-shared' ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {kicked && !user && (
          <div style={{
            padding: '10px 16px',
            background: '#fdecea',
            borderBottom: '1px solid #f5c6cb',
            color: '#721c24',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ flex: 1 }}>
              다른 곳에서 로그인되어 이 탭의 세션이 종료되었습니다. 다시 로그인하세요.
            </span>
            <button
              onClick={() => setKicked(false)}
              style={{
                border: 'none', background: 'transparent', color: '#721c24',
                cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
              }}
              title="닫기"
            >✕</button>
          </div>
        )}
        {view.type === 'home' && <HomeView />}
        {view.type === 'folder' && (
          <FolderView
            folder={view.folder}
            problems={view.folder.id === SHARED_WITH_ME_FOLDER_ID ? sharedProblems : allProblems}
            folders={folders}
            onEdit={handleEditProblem} onView={handleViewProblem} onProblemAction={handleProblemAction}
            onEmptyTrash={handleEmptyTrash} onUpdated={() => loadData()}
            onSelectFolder={handleSelectFolder}
            user={user}
            onMoveProblemToFolder={handleMoveProblemToFolder} />
        )}
        {view.type === 'share' && (() => {
          const scope = view.scope;
          const labelFor = (uid: string) => {
            const p = shareProfiles[uid];
            return p?.nickname || p?.displayName || '사용자';
          };
          if (scope.kind === 'bazaar') {
            // Phase 52(4단계): 전역 피드 + 검색/필터. 내 게시물(filter='mine')은 bazaar_posts 직접 조회.
            // Phase 53(E): 게시물 클릭 → 인앱 전환(오너·live=ProblemView, 그 외=공개 뷰어 임베드).
            return user ? (
              <BazaarView
                uid={user.uid}
                filter={scope.filter}
                onOpenPost={(post) => {
                  if (post.mode === 'snapshot' && post.shareId) {
                    setView({ type: 'public-shared', shareId: post.shareId });
                  } else if (post.ownerUid === user.uid) {
                    setView({ type: 'problem', problemId: post.problemId });
                  } else {
                    setView({ type: 'public-problem', problemId: post.problemId });
                  }
                }}
              />
            ) : null;
          }
          const isReceived = scope.kind === 'received-all' || scope.kind === 'received-by';
          const scopedProblems = scope.kind === 'received-all' ? sharedProblems
            : scope.kind === 'received-by' ? (receivedByAuthor.get(scope.uid) ?? [])
            : (sentByRecipient.get(scope.uid) ?? []);
          const name = scope.kind === 'received-all' ? '공유 받은 문항'
            : scope.kind === 'received-by' ? `${labelFor(scope.uid)}님이 공유한 문항`
            : `${labelFor(scope.uid)}님에게 공유한 문항`;
          const folderId = isReceived ? SHARED_WITH_ME_FOLDER_ID : '__sent__';
          const listContext = scope.kind === 'sent-by'
            ? { mode: 'sent' as const, recipientUid: scope.uid, profiles: shareProfiles }
            : { mode: 'received' as const, profiles: shareProfiles };
          return (
            <FolderView
              key={shareScopeKey(scope)}
              folder={{ id: folderId, name, user_id: '', order: 99996 }}
              problems={scopedProblems}
              folders={folders}
              passthrough={!isReceived}
              listContext={listContext}
              onEdit={handleEditProblem} onView={handleViewProblem} onProblemAction={handleProblemAction}
              onEmptyTrash={handleEmptyTrash} onUpdated={() => loadData()}
              onSelectFolder={handleSelectFolder}
              user={user}
              onMoveProblemToFolder={handleMoveProblemToFolder} />
          );
        })()}
        {view.type === 'problem' && (
          <ProblemView
            key={`${view.problemId}:${problemViewNonce}`}
            problemId={view.problemId}
            folders={folders}
            onRename={(p) => handleProblemAction('rename', p)}
            onEdit={(p) => handleEditProblem(p)}
            onDuplicate={(p) => handleProblemAction('duplicate', p)}
            onMoveFolder={(p) => handleProblemAction('move', p)}
            onTrash={(p) => handleProblemAction('trash', p)}
            onUpdated={() => loadData()}
            onNavigateFolder={handleNavigateFolder}
            onManageShare={(p) => setShareModalProblem(p)}
          />
        )}
        {view.type === 'editor' && (
          <EditorView problemId={view.problemId} folders={folders} onBack={handleEditorBack} />
        )}
        {view.type === 'public-problem' && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <PublicProblemView
              problemId={view.problemId}
              onOwnerEdit={() => setView({ type: 'problem', problemId: view.problemId })}
            />
          </div>
        )}
        {view.type === 'public-shared' && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <SnapshotView shareId={view.shareId} />
          </div>
        )}
        {view.type === 'new' && (
          <NewProblemCreating onBack={() => { setView({ type: 'home' }); }} />
        )}
      </main>

      {showSearch && (
        <SearchOverlay
          problems={allProblems}
          textIndex={searchTextIndex}
          indexLoading={searchIndexLoading}
          onRequestIndex={buildSearchIndex}
          onClose={() => setShowSearch(false)}
          onSelect={handleViewProblem}
        />
      )}

      {nicknameModal && (
        <NicknameSetupModal
          uid={nicknameModal.uid}
          currentNickname={nicknameModal.current}
          onClose={() => setNicknameModal(null)}
          onSaved={() => setNicknameModal(null)}
        />
      )}

      {/* Phase 61a: 시트 가져오기. user 없이는 열리지 않는다(라우트가 ID 토큰을 요구한다) */}
      {sheetImportOpen && user && (
        <SheetImportModal
          user={user}
          folders={folders}
          onClose={() => setSheetImportOpen(false)}
          onImported={() => { loadData(); }}
        />
      )}

      {shareModalProblem && (
        <ShareTargetModal
          problem={shareModalProblem}
          onClose={() => setShareModalProblem(null)}
          onChanged={() => loadData()}
        />
      )}

      {/* 개선묶음 M2 A-4 — 문항의 폴더 이동 픽커.
          ⚠ 폴더 재부모화(handleMoveFolder)와는 다른 흐름이다 — 문항에는 자손이 없으므로
            순환 방지 검사가 필요 없다. */}
      {moveTarget && (
        <FolderPickerDialog
          folders={folders}
          currentFolderId={moveTarget.folder_id ?? null}
          title={`"${moveTarget.title}" 이동`}
          onCancel={() => setMoveTarget(null)}
          onPick={async (folderId) => {
            const target = moveTarget;
            setMoveTarget(null);
            try {
              await moveProblemToFolder(target.id, folderId);
              await loadData();
            } catch (error) {
              console.error('문항 이동 에러:', error);
              await alertDialog('문항 이동에 실패했습니다.');
            }
          }}
        />
      )}
    </div>

    {/* Phase 63 S0 — 오버레이 한 벌(D28): problem 계열 = 액센트 알약(구 FolderView 디자인),
        folder = null(sortable이 제자리에서 움직인다). 사이드바 흰 카드 📄 오버레이는 제거됐다. */}
    <DragOverlay dropAnimation={null}>
      {activeDragItem && activeDragItem.kind !== 'folder' ? (
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'var(--accent-primary, #5b6abf)', color: '#fff',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)', maxWidth: 280,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: 'grabbing',
        }}>
          {activeDragItem.label}
        </div>
      ) : null}
    </DragOverlay>
    </DragKindContext.Provider>
    </DndContext>
  );
}

function HomeView() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: 48, fontWeight: 600, color: 'var(--mathory-red)', marginBottom: 8,
          fontFamily: 'var(--font-logo)', letterSpacing: '-0.03em', lineHeight: 1,
        }}>Mathory</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
          Write the logic. Preserve the insight.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 16, fontFamily: 'var(--font-ui)' }}>
          좌측 사이드바에서 문항을 선택하거나, 새 문제를 만들어보세요.
        </p>
      </div>
    </div>
  );
}

function NewProblemCreating({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 16 }}>
          새 문제를 생성하고 있습니다...
        </p>
        <button onClick={onBack} style={{
          padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-ui)',
        }}>돌아가기</button>
      </div>
    </div>
  );
}