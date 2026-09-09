'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { signInWithPopup } from 'firebase/auth';
import useAuth from '../../hooks/useAuth';
import { auth, googleProvider } from '../../lib/firebase';
import {
  Problem, Folder, ProblemWithBlocks, BazaarPost, DEFAULT_TABS,
} from '../../types/problem';
import {
  listProblems, listRecentProblems, listFolders, getProblemWithBlocks,
  TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID,
} from '../../lib/firestore';
import { listSharedWithMe, canComment as canCommentOnProblem } from '../../lib/membership';
import { parseDeepLink } from '../../lib/deepLink';
import PhoneShell from '../layout/PhoneShell';
import PhoneBazaar from './PhoneBazaar';
import PhoneReader from './PhoneReader';
import PhoneItemMenu from './PhoneItemMenu';
import { SectionLabel, FolderRow, ProblemRow, fmtDateShort } from './PhoneList';
import PublicProblemView from '../share/PublicProblemView';
import SnapshotView from '../share/SnapshotView';
import CommentPanel from '../comment/CommentPanel';
import Wordmark from '../ui/Wordmark';
import { IconFolder, IconInbox, IconBazaar, IconGoogle } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 D8 — 로그인 앱의 폰 루트. AppShell과 상태를 공유하지 않는다(P2) —
   뷰 상태·데이터 로드 전부 자체 소유(lib/firestore·membership 직접 호출).
   - 하단 탭 3: 내 문항 · 받은 문항 · Bazaar. 비로그인은 로그인 화면 + Bazaar만 활성(Q11).
   - 딥링크는 lib/deepLink 공용, 로그인 후 1회 소비(AppShell과 같은 규약, S-10).
   - 문항 열람(자기·받은)은 getProblemWithBlocks 1회 + 멤버 mtv 필터(C-3 —
     ProblemView.tsx:555-559와 같은 규칙). 편집 진입점 0(E4).
   - agent 아이콘 게이트 = 오너 OR (멤버 && commentsVisible !== false)(Q1+S-1) —
     데스크톱(오너 전용)보다 넓은 비대칭은 의도(Q9).
   ═══════════════════════════════════════════════════════════════ */

type PhoneView =
  | { type: 'home' }
  | { type: 'received' }
  | { type: 'bazaar' }
  | { type: 'folder'; folder: Folder }
  | { type: 'problem'; problemId: string; back: PhoneView }
  | { type: 'public-problem'; problemId: string; back: PhoneView }
  | { type: 'public-shared'; shareId: string; back: PhoneView };

export default function PhoneApp() {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<PhoneView>({ type: 'home' });
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [recentProblems, setRecentProblems] = useState<Problem[]>([]);
  const [sharedProblems, setSharedProblems] = useState<Problem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [menuProblem, setMenuProblem] = useState<Problem | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setAllProblems([]); setRecentProblems([]); setSharedProblems([]); setFolders([]);
      return;
    }
    try {
      const [problems, recent, shared, userFolders] = await Promise.all([
        listProblems(user.uid),
        listRecentProblems(user.uid, 10),
        listSharedWithMe(user.uid).catch(() => [] as Problem[]),
        listFolders(user.uid),
      ]);
      setAllProblems(problems);
      setRecentProblems(recent.filter((p) => p.folder_id !== TRASH_FOLDER_ID));
      setSharedProblems(shared);
      setFolders(userFolders);
    } catch (e) {
      console.error('[Phase64] 폰 데이터 로드 실패:', e);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) loadData(); }, [authLoading, loadData]);

  /* 딥링크 — AppShell과 같은 규약(로그인 후 1회, replaceState 소거) */
  const deepLinkRef = useRef(false);
  useEffect(() => {
    if (!user || deepLinkRef.current) return;
    const link = parseDeepLink(window.location.search);
    if (!link) return;
    deepLinkRef.current = true;
    if (link.view === 'bazaar') setView({ type: 'bazaar' });
    else if (link.view === 'p') setView({ type: 'public-problem', problemId: link.id, back: { type: 'home' } });
    else setView({ type: 'public-shared', shareId: link.id, back: { type: 'home' } });
    window.history.replaceState({}, '', '/');
  }, [user]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) counts[f.id] = 0;
    counts[UNASSIGNED_FOLDER_ID] = 0;
    for (const p of allProblems) {
      if (p.folder_id === TRASH_FOLDER_ID) continue;
      const key = p.folder_id && p.folder_id !== '' ? p.folder_id : UNASSIGNED_FOLDER_ID;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [folders, allProblems]);

  const folderNameOf = useCallback((folderId?: string) => {
    if (!folderId || folderId === '') return '미분류';
    if (folderId === TRASH_FOLDER_ID) return '휴지통';
    return folders.find((f) => f.id === folderId)?.name ?? '';
  }, [folders]);

  const openProblem = (p: Problem, back: PhoneView) =>
    setView({ type: 'problem', problemId: p.id, back });

  /* ─── 전체 화면 뷰(탭 바 없음) ─── */
  if (view.type === 'problem') {
    return (
      <>
        <PhoneProblemScreen
          problemId={view.problemId}
          uid={user?.uid ?? ''}
          onBack={() => setView(view.back)}
        />
        {itemMenu()}
      </>
    );
  }
  if (view.type === 'public-problem') {
    return <PublicProblemView problemId={view.problemId} reader="phone" onBack={() => setView(view.back)} />;
  }
  if (view.type === 'public-shared') {
    return <SnapshotView shareId={view.shareId} reader="phone" onBack={() => setView(view.back)} />;
  }

  /* ─── 탭 바가 있는 3+1 뷰 ─── */
  const activeTab: 'home' | 'received' | 'bazaar' =
    view.type === 'bazaar' ? 'bazaar' : view.type === 'received' ? 'received' : 'home';

  const footer = (
    <div style={{ display: 'flex' }}>
      {([
        { key: 'home' as const, label: '내 문항', Icon: IconFolder, needsUser: true },
        { key: 'received' as const, label: '받은 문항', Icon: IconInbox, needsUser: true },
        { key: 'bazaar' as const, label: 'Bazaar', Icon: IconBazaar, needsUser: false },
      ]).map(({ key, label, Icon, needsUser }) => {
        const active = activeTab === key;
        const disabled = needsUser && !user;
        return (
          <button
            key={key}
            onClick={() => setView({ type: key })}
            disabled={disabled}
            style={{
              flex: 1, height: 56, border: 'none', background: 'none',
              cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--font-ui)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              color: disabled ? 'var(--text-faint, #bbb)'
                : active ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <Icon size={22} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );

  function itemMenu() {
    return (
      <PhoneItemMenu
        problem={menuProblem}
        folders={folders}
        open={!!menuProblem}
        onClose={() => setMenuProblem(null)}
        onMoved={loadData}
      />
    );
  }

  const avatar = user?.photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : undefined;

  /* ── Bazaar 탭 ── */
  if (view.type === 'bazaar') {
    return (
      <PhoneShell left="wordmark" right={avatar} footer={footer}>
        <h2 style={h2Style}>Bazaar</h2>
        <PhoneBazaar
          uid={user?.uid ?? ''}
          onOpenPost={(post: BazaarPost) => {
            if (post.mode === 'live') setView({ type: 'public-problem', problemId: post.problemId, back: view });
            else if (post.shareId) setView({ type: 'public-shared', shareId: post.shareId, back: view });
          }}
        />
      </PhoneShell>
    );
  }

  /* ── 로딩·비로그인(내 문항·받은 문항 탭) ── */
  if (authLoading) {
    return <PhoneShell footer={footer}><Centered>불러오는 중…</Centered></PhoneShell>;
  }
  if (!user) {
    /* Q11 — 비로그인 폰 '/' = 로그인 화면. 하단 탭은 Bazaar만 활성 */
    return (
      <PhoneShell footer={footer}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 24px' }}>
          <Wordmark as="h1" size={48} color="var(--mathory-red-dark)" shadow style={{ lineHeight: 1, marginBottom: 4 }} />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontStyle: 'italic', margin: 0 }}>
            Write the logic. Preserve the insight.
          </p>
          <button
            onClick={async () => { try { await signInWithPopup(auth, googleProvider); } catch { /* 취소 무시 */ } }}
            style={{
              marginTop: 20, display: 'flex', alignItems: 'center', gap: 8,
              height: 48, padding: '0 22px', border: '1px solid var(--border-light, #ddd)',
              borderRadius: 10, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            <IconGoogle size={18} /> Google로 로그인
          </button>
          <button
            onClick={() => setView({ type: 'bazaar' })}
            style={{
              marginTop: 4, border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'underline', fontFamily: 'var(--font-ui)',
            }}
          >
            Bazaar 둘러보기
          </button>
        </div>
      </PhoneShell>
    );
  }

  /* ── 받은 문항 탭 ── */
  if (view.type === 'received') {
    return (
      <PhoneShell left="wordmark" right={avatar} footer={footer}>
        <SectionLabel>받은 문항</SectionLabel>
        <div style={{ paddingTop: 2 }}>
          {sharedProblems.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              sub={fmtDateShort(p.updated_at)}
              onClick={() => openProblem(p, view)}
            />
          ))}
          {sharedProblems.length === 0 && <Empty>공유받은 문항이 없습니다.</Empty>}
        </div>
      </PhoneShell>
    );
  }

  /* ── 폴더 뷰 ── */
  if (view.type === 'folder') {
    const folder = view.folder;
    const isUnassigned = folder.id === UNASSIGNED_FOLDER_ID;
    const childFolders = isUnassigned ? [] : folders.filter((f) => f.parent_id === folder.id);
    const problems = allProblems
      .filter((p) => p.folder_id !== TRASH_FOLDER_ID)
      .filter((p) => (isUnassigned ? !p.folder_id || p.folder_id === '' : p.folder_id === folder.id))
      .sort((a, b) => (b.updated_at?.getTime?.() ?? 0) - (a.updated_at?.getTime?.() ?? 0));
    const parent = folder.parent_id ? folders.find((f) => f.id === folder.parent_id) : undefined;
    return (
      <PhoneShell
        left="back"
        onBack={() => setView(parent ? { type: 'folder', folder: parent } : { type: 'home' })}
        title={folder.name}
        footer={footer}
        overlay={itemMenu()}
      >
        {childFolders.map((f) => (
          <FolderRow key={f.id} folder={f} count={folderCounts[f.id] ?? 0}
            onClick={() => setView({ type: 'folder', folder: f })} />
        ))}
        <div style={{ paddingTop: 10 }}>
          {problems.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              sub={fmtDateShort(p.updated_at)}
              onClick={() => openProblem(p, view)}
              onMore={() => setMenuProblem(p)}
            />
          ))}
          {problems.length === 0 && childFolders.length === 0 && <Empty>문항이 없습니다.</Empty>}
        </div>
      </PhoneShell>
    );
  }

  /* ── 홈(내 문항) ── */
  const rootFolders = folders.filter((f) => !f.parent_id || f.parent_id === '');
  const unassignedFolder: Folder = { id: UNASSIGNED_FOLDER_ID, name: '미분류', user_id: user.uid, order: 999999 };
  return (
    <PhoneShell left="wordmark" right={avatar} footer={footer} overlay={itemMenu()}>
      <SectionLabel>폴더</SectionLabel>
      {rootFolders.map((f) => (
        <FolderRow key={f.id} folder={f} count={folderCounts[f.id] ?? 0}
          onClick={() => setView({ type: 'folder', folder: f })} />
      ))}
      {(folderCounts[UNASSIGNED_FOLDER_ID] ?? 0) > 0 && (
        <FolderRow folder={unassignedFolder} count={folderCounts[UNASSIGNED_FOLDER_ID] ?? 0}
          onClick={() => setView({ type: 'folder', folder: unassignedFolder })} />
      )}
      <SectionLabel>최근 수정</SectionLabel>
      {recentProblems.map((p) => (
        <ProblemRow
          key={p.id}
          problem={p}
          sub={`${folderNameOf(p.folder_id)} · ${fmtDateShort(p.updated_at)}`}
          onClick={() => openProblem(p, view)}
          onMore={() => setMenuProblem(p)}
        />
      ))}
      {recentProblems.length === 0 && <Empty>아직 문항이 없습니다. PC에서 만들어 보세요.</Empty>}
      <div style={{ height: 24 }} />
    </PhoneShell>
  );
}

/* ─── 문항 열람 화면: 1회 로드 + PhoneReader + 댓글/agent 시트 ─── */
function PhoneProblemScreen({ problemId, uid, onBack }: {
  problemId: string; uid: string; onBack: () => void;
}) {
  const [data, setData] = useState<ProblemWithBlocks | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    getProblemWithBlocks(problemId)
      .then((d) => { if (!cancelled) { if (d) setData(d); else setFailed(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [problemId]);

  if (failed) {
    return <PhoneShell left="back" onBack={onBack}><Centered>문항을 불러오지 못했습니다.</Centered></PhoneShell>;
  }
  if (!data) {
    return <PhoneShell left="back" onBack={onBack}><Centered>불러오는 중…</Centered></PhoneShell>;
  }

  /* ProblemView:552와 같은 판정 — authorUid 없는 레거시 문항은 오너로 친다 */
  const isOwner = !data.authorUid || data.authorUid === uid;
  const isMember = !!data.memberUids?.includes(uid);
  const allTabs = (data.tabs && data.tabs.length > 0) ? data.tabs : DEFAULT_TABS;
  /* C-3 — 멤버는 memberTabVisibility 필터(ProblemView.tsx:555-559와 같은 규칙) */
  const tabs = isOwner ? allTabs : allTabs.filter((t) => data.memberTabVisibility?.[t.id] !== false);
  const canWriteComment = canCommentOnProblem(data, uid);
  /* Q1+S-1 — agent: 오너 OR (멤버 && commentsVisible). 데스크톱(오너 전용)과의 비대칭은 의도(Q9) */
  const agentAllowed = isOwner || (isMember && data.commentsVisible !== false);
  const shareUrl = data.visibility === 'public'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${data.id}`
    : undefined;

  /* 함정 3 — CommentPanel 루트가 top/right/bottom:8을 스스로 갖는다 →
     우·상하 8은 시트 여백으로 흡수, 좌측만 paddingLeft:8로 대칭 */
  const panelSlot = (mode: 'comments' | 'agent', canComment: boolean) =>
    (close: () => void) => (
      <div style={{ position: 'relative', height: '100%', paddingLeft: 8, boxSizing: 'border-box' }}>
        <CommentPanel
          problemId={data.id}
          ownerUid={data.authorUid || ''}
          tabs={tabs}
          activeTabId={tabs[0]?.id || 'question'}
          currentUid={uid}
          canComment={canComment}
          mode={mode}
          onClose={close}
          width="100%"
          selectionPopup={false}
        />
      </div>
    );

  return (
    <PhoneReader
      title={data.title || '(제목 없음)'}
      tabs={tabs}
      tabBlocks={data.tabBlocks}
      shareUrl={shareUrl}
      onBack={onBack}
      commentsSlot={panelSlot('comments', canWriteComment)}
      agentSlot={agentAllowed ? panelSlot('agent', false) : undefined}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-secondary, #666)', fontFamily: 'var(--font-ui)', fontSize: 14,
    }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
      {children}
    </div>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, margin: 0, padding: '14px 12px 0',
  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
