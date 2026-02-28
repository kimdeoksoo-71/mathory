'use client';

import { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import useAuth from '../../hooks/useAuth';
import { Problem, Folder } from '../../types/problem';
import { listProblems, listRecentProblems, listFolders, createFolder, getFolderProblemCount } from '../../lib/firestore';

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

export default function AppShell() {
  const { user, loading: authLoading } = useAuth();

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Data
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [recentProblems, setRecentProblems] = useState<Problem[]>([]);

  // Navigation
  const [view, setView] = useState<ViewState>({ type: 'home' });

  // ─── Data Loading ───
  const loadData = useCallback(async () => {
    try {
      const [problems, recent] = await Promise.all([
        listProblems(),
        listRecentProblems(10),
      ]);
      setAllProblems(problems);
      setRecentProblems(recent);

      if (user) {
        const userFolders = await listFolders(user.uid);
        setFolders(userFolders);

        // 폴더별 문항 수
        const counts: Record<string, number> = {};
        for (const f of userFolders) {
          counts[f.id] = problems.filter((p) => p.folder_id === f.id).length;
        }
        setFolderCounts(counts);
      }
    } catch (error) {
      console.error('데이터 로드 에러:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, loadData]);

  // ─── Auth Handlers ───
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('로그인 에러:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView({ type: 'home' });
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  // ─── Navigation Handlers ───
  const handleNewProblem = () => {
    setView({ type: 'new' });
    setCollapsed(true);
  };

  const handleSelectFolder = (folder: Folder) => {
    setView({ type: 'folder', folder });
  };

  const handleViewProblem = (problem: Problem) => {
    setView({ type: 'problem', problemId: problem.id });
  };

  const handleEditProblem = (problem: Problem) => {
    setView({ type: 'editor', problemId: problem.id });
    setCollapsed(true);
  };

  const handleNewFolder = async () => {
    if (!user) return;
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    try {
      await createFolder({ name: name.trim(), user_id: user.uid, order: folders.length });
      await loadData();
    } catch (error) {
      console.error('폴더 생성 에러:', error);
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
      case 'delete': {
        if (confirm(`"${problem.title}"을(를) 삭제하시겠습니까?`)) {
          const { deleteProblem } = await import('../../lib/firestore');
          await deleteProblem(problem.id);
          setView({ type: 'home' });
          await loadData();
        }
        break;
      }
      case 'move': {
        const folderOptions = folders.map((f) => `${f.name}`).join(', ');
        const target = prompt(`이동할 폴더 이름 (${folderOptions}):`);
        if (target) {
          const folder = folders.find((f) => f.name === target.trim());
          if (folder) {
            const { moveProblemToFolder } = await import('../../lib/firestore');
            await moveProblemToFolder(problem.id, folder.id);
            await loadData();
          }
        }
        break;
      }
    }
  };

  const handleEditorBack = () => {
    setView({ type: 'home' });
    setCollapsed(false);
    loadData(); // Refresh data after editing
  };

  // ─── Active folder ID ───
  const activeFolderId = view.type === 'folder' ? view.folder.id : null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ═══ Sidebar ═══ */}
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
        onViewProblem={handleViewProblem}
        onEditProblem={handleEditProblem}
        onProblemAction={handleProblemAction}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* ═══ Main Content ═══ */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view.type === 'home' && <HomeView />}
        {view.type === 'folder' && (
          <FolderView
            folder={view.folder}
            problems={allProblems}
            onEdit={handleEditProblem}
            onView={handleViewProblem}
            onProblemAction={handleProblemAction}
          />
        )}
        {view.type === 'problem' && (
          <ProblemView problemId={view.problemId} />
        )}
        {view.type === 'editor' && (
          <EditorView
            problemId={view.problemId}
            folders={folders}
            onBack={handleEditorBack}
          />
        )}
        {view.type === 'new' && (
          <EditorNewRedirect onBack={() => { setView({ type: 'home' }); setCollapsed(false); }} />
        )}
      </main>

      {/* ═══ Search Overlay ═══ */}
      {showSearch && (
        <SearchOverlay
          problems={allProblems}
          onClose={() => setShowSearch(false)}
          onSelect={handleViewProblem}
        />
      )}
    </div>
  );
}

// ─── Home View ───
function HomeView() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8,
          fontFamily: 'var(--font-logo)', letterSpacing: -1,
        }}>
          Mathory
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
          fontStyle: 'italic',
        }}>
          Write the logic. Preserve the insight.
        </p>
        <p style={{
          fontSize: 13, color: 'var(--text-faint)', marginTop: 16,
          fontFamily: 'var(--font-ui)',
        }}>
          좌측 사이드바에서 문항을 선택하거나, 새 문제를 만들어보세요.
        </p>
      </div>
    </div>
  );
}

// ─── New Problem Redirect (임시) ───
function EditorNewRedirect({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 16 }}>
          새 문제 작성 화면은 기존 /problems/new 페이지를 리디자인하여 통합 예정입니다.
        </p>
        <button
          onClick={onBack}
          style={{
            padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            fontFamily: 'var(--font-ui)',
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
