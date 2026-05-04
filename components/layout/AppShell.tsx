'use client';

import { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import useAuth from '../../hooks/useAuth';
import { Problem, Folder } from '../../types/problem';
import { DIFFICULTIES } from '../../lib/constants';
import {
  listProblems, listRecentProblems, listFolders,
  createFolder, updateFolder, deleteFolder, updateFolderOrders,
  moveProblemToFolder,
  getFolderProblemCount, createProblem, saveQuestionBlock, saveSolutionBlock,
  getProblemWithBlocks,
  duplicateProblem, moveToTrash, emptyTrash,
  TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID,
} from '../../lib/firestore';

import Sidebar from '../layout/Sidebar';
import SearchOverlay from '../layout/SearchOverlay';
import FolderView from '../problem/FolderView';
import ProblemView from '../problem/ProblemView';
import EditorView from '../editor/EditorView';

type ViewState =
  | { type: 'home' }
  | { type: 'folder'; folder: Folder }
  | { type: 'problem'; problemId: string }
  | { type: 'editor'; problemId: string }
  | { type: 'new' };

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
  const [showSearch, setShowSearch] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [recentProblems, setRecentProblems] = useState<Problem[]>([]);

  const [view, setView] = useState<ViewState>({ type: 'home' });
  const [problemViewNonce, setProblemViewNonce] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [problems, recent] = await Promise.all([
        listProblems(),
        listRecentProblems(10),
      ]);
      setAllProblems(problems);
      // 최근 문항에서 휴지통 문항 제외
      setRecentProblems(recent.filter((p) => p.folder_id !== TRASH_FOLDER_ID));

      if (user) {
        const userFolders = await listFolders(user.uid);
        setFolders(userFolders);
        const counts: Record<string, number> = {};
        for (const f of userFolders) {
          counts[f.id] = problems.filter((p) => p.folder_id === f.id).length;
        }
        // 휴지통 카운트
        counts[TRASH_FOLDER_ID] = problems.filter((p) => p.folder_id === TRASH_FOLDER_ID).length;
        counts[UNASSIGNED_FOLDER_ID] = problems.filter((p) => !p.folder_id || p.folder_id === '').length;
        setFolderCounts(counts);
      }
    } catch (error) {
      console.error('데이터 로드 에러:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) { console.error('로그인 에러:', error); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setView({ type: 'home' }); }
    catch (error) { console.error('로그아웃 에러:', error); }
  };

  const handleNewProblem = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return; }
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
      });
      await saveQuestionBlock(newProblemId, { order: 0, type: 'text', raw_text: '' });
      await saveSolutionBlock(newProblemId, { order: 0, type: 'text', raw_text: '' });
      await loadData();
      setView({ type: 'editor', problemId: newProblemId });
      setCollapsed(true);
    } catch (error) {
      console.error('새 문제 생성 에러:', error);
      alert('문제 생성에 실패했습니다.');
    }
  };

  const handleSelectFolder = (folder: Folder) => { setView({ type: 'folder', folder }); };
  const handleSelectUnassigned = () => {
    setView({ type: 'folder', folder: { id: UNASSIGNED_FOLDER_ID, name: '미지정', user_id: '', order: 99998 } });
  };
  const handleSelectTrash = () => {
    setView({ type: 'folder', folder: { id: TRASH_FOLDER_ID, name: '휴지통', user_id: '', order: 99999 } });
  };
  const handleViewProblem = (problem: Problem) => { setView({ type: 'problem', problemId: problem.id }); setCollapsed(true); };
  const handleEditProblem = (problem: Problem) => { setView({ type: 'editor', problemId: problem.id }); setCollapsed(true); };
  const handleNavigateFolder = (folderId: string) => {
    if (folderId === TRASH_FOLDER_ID) { handleSelectTrash(); return; }
    if (folderId === UNASSIGNED_FOLDER_ID || !folderId) { handleSelectUnassigned(); return; }
    const folder = folders.find((f) => f.id === folderId);
    if (folder) { setView({ type: 'folder', folder }); setCollapsed(false); }
  };

  const handleNewFolder = async () => {
    if (!user) return;
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    try {
      await createFolder({ name: name.trim(), user_id: user.uid, order: folders.length });
      await loadData();
    } catch (error) { console.error('폴더 생성 에러:', error); }
  };

  // Phase 10: 폴더 이름 변경 / 삭제
  const handleFolderAction = async (action: 'rename' | 'delete', folder: Folder) => {
    switch (action) {
      case 'rename': {
        const newName = prompt('새 폴더 이름:', folder.name);
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
        const count = folderCounts[folder.id] ?? 0;
        const msg = count > 0
          ? `"${folder.name}" 폴더를 삭제하시겠습니까?\n(폴더 안의 ${count}개 문항은 미분류로 이동됩니다)`
          : `"${folder.name}" 폴더를 삭제하시겠습니까?`;
        if (confirm(msg)) {
          try {
            await deleteFolder(folder.id);
            if (view.type === 'folder' && view.folder.id === folder.id) {
              setView({ type: 'home' });
            }
            await loadData();
          } catch (error) { console.error('폴더 삭제 에러:', error); }
        }
        break;
      }
    }
  };

  // Phase 10: 폴더 순서 변경 (드래그)
  const handleFolderReorder = async (reorderedFolders: Folder[]) => {
    setFolders(reorderedFolders);
    try {
      const orders = reorderedFolders.map((f, i) => ({ id: f.id, order: i }));
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

  const handleProblemAction = async (action: string, problem: Problem) => {
    switch (action) {
      case 'rename': {
        const newName = prompt('새 이름:', problem.title);
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
          alert('사본 생성에 실패했습니다.');
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
        if (confirm(`"${problem.title}"을(를) 영구 삭제하시겠습니까?`)) {
          const { deleteProblem } = await import('../../lib/firestore');
          await deleteProblem(problem.id);
          setView({ type: 'home' });
          await loadData();
        }
        break;
      }
      case 'restore': {
        try {
          await moveProblemToFolder(problem.id, null);
          await loadData();
        } catch (error) {
          console.error('복원 에러:', error);
        }
        break;
      }
      case 'move': {
        const folderOptions = folders.map((f) => `${f.name}`).join(', ');
        const target = prompt(`이동할 폴더 이름 (${folderOptions}):`);
        if (target) {
          const folder = folders.find((f) => f.name === target.trim());
          if (folder) {
            await moveProblemToFolder(problem.id, folder.id);
            await loadData();
          }
        }
        break;
      }
      case 'download_md': {
        try {
          const full = await getProblemWithBlocks(problem.id);
          if (full) {
            downloadMarkdown(full);
          } else {
            alert('문제 데이터를 불러올 수 없습니다.');
          }
        } catch (error) {
          console.error('MD 다운로드 에러:', error);
          alert('다운로드에 실패했습니다.');
        }
        break;
      }
    }
  };

  const handleEmptyTrash = async () => {
    const trashCount = allProblems.filter((p) => p.folder_id === TRASH_FOLDER_ID).length;
    if (trashCount === 0) {
      alert('휴지통이 비어 있습니다.');
      return;
    }
    if (confirm(`휴지통의 ${trashCount}개 문항을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      try {
        await emptyTrash();
        setView({ type: 'home' });
        await loadData();
      } catch (error) {
        console.error('휴지통 비우기 에러:', error);
        alert('휴지통 비우기에 실패했습니다.');
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
    setCollapsed(false);
    loadData();
  };

  // ProblemView / EditorView 진입 시 사이드바 자동 접기
  useEffect(() => {
    if (view.type === 'problem' || view.type === 'editor') {
      setCollapsed(true);
    }
  }, [view]);

  const activeFolderId = view.type === 'folder' ? view.folder.id : null;
  const isEditorMode = view.type === 'editor';
  const isProblemMode = view.type === 'problem';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        folders={folders}
        folderCounts={folderCounts}
        recentProblems={recentProblems}
        activeFolderId={activeFolderId}
        user={user}
        onNewProblem={handleNewProblem}
        onSearch={() => setShowSearch(true)}
        onSelectFolder={handleSelectFolder}
        onNewFolder={handleNewFolder}
        onFolderAction={handleFolderAction}
        onFolderReorder={handleFolderReorder}
        onMoveProblemToFolder={handleMoveProblemToFolder}
        onViewProblem={handleViewProblem}
        onEditProblem={handleEditProblem}
        onProblemAction={handleProblemAction}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSelectTrash={handleSelectTrash}
        trashCount={folderCounts[TRASH_FOLDER_ID] ?? 0}
        onSelectUnassigned={handleSelectUnassigned}
        unassignedCount={folderCounts[UNASSIGNED_FOLDER_ID] ?? 0}
      />

      <main style={{
        flex: 1,
        position: 'relative',
        overflow: isEditorMode || isProblemMode || view.type === 'folder' ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}>
        {view.type === 'home' && <HomeView />}
        {view.type === 'folder' && (
          <FolderView folder={view.folder} problems={allProblems} folders={folders}
            onEdit={handleEditProblem} onView={handleViewProblem} onProblemAction={handleProblemAction}
            onEmptyTrash={handleEmptyTrash} onUpdated={() => loadData()} />
        )}
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
          />
        )}
        {view.type === 'editor' && (
          <EditorView problemId={view.problemId} folders={folders} onBack={handleEditorBack} />
        )}
        {view.type === 'new' && (
          <NewProblemCreating onBack={() => { setView({ type: 'home' }); setCollapsed(false); }} />
        )}
      </main>

      {showSearch && (
        <SearchOverlay problems={allProblems} onClose={() => setShowSearch(false)} onSelect={handleViewProblem} />
      )}
    </div>
  );
}

function HomeView() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8,
          fontFamily: 'var(--font-logo)', letterSpacing: -1,
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