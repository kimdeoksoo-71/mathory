'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  TabComment, TabMeta, UserProfile, DiscussionSession, AIModelConfig, Block,
  tabSubcollection,
} from '../../types/problem';
import { db } from '../../lib/firebase';
import {
  listAllComments, watchAllComments, addComment, editCommentContent, deleteComment,
  toggleResolved, buildThreads,
} from '../../lib/comments';
import { getUserProfile } from '../../lib/users';
import { getEnabledModels } from '../../lib/ai-models';
import {
  listSessions, createNormalSession, renameSession, deleteSession,
} from '../../lib/discussion-sessions';
import EditorPreview from '../editor/EditorPreview';
import CommentEditor from './CommentEditor';

const LEGACY_SESSION_ID = '__legacy__';
const HISTORY_LIMIT = 5;

interface CommentPanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  activeTabId: string;
  currentUid: string;
  canComment: boolean;
  bodyFontSize?: number;
  onClose: () => void;
  onCommentsChange?: (comments: TabComment[]) => void;
  initialTabId?: string;
  onTabChange?: (tabId: string) => void;
}

interface DisplayInfo {
  name: string;
  emoji?: string;
  photoURL?: string;
  isAI: boolean;
  modelDisplayName?: string;
}

interface PendingAI {
  modelId: string;
  nickname: string;
  emoji: string;
  /** 이 호출이 시작된 세션 ID — 다른 세션으로 전환해도 알림은 원래 세션에서만 보여야 함 */
  sessionId: string;
  error?: string;
  /** 재시도 시 사용할 원본 호출 컨텍스트 */
  retryContext?: DiscussRequestContext;
}

interface DiscussRequestContext {
  problemContent: string;
  currentTabContent?: string;
  currentTabLabel?: string;
  discussionHistory: Array<{ role: 'human' | 'ai'; nickname: string; content: string }>;
  participantNicknames: string[];
  currentMessage: string;
}

export default function CommentPanel({
  problemId, ownerUid, tabs, activeTabId, currentUid, canComment,
  bodyFontSize = 15,
  onClose, onCommentsChange,
}: CommentPanelProps) {
  const commentFontSize = Math.max(9, bodyFontSize - 2);
  const isOwner = currentUid === ownerUid;

  // ─── 데이터 ───
  const [comments, setComments] = useState<TabComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const [aiModels, setAiModels] = useState<AIModelConfig[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  // ─── UI 상태 ───
  const [activeSessionId, setActiveSessionId] = useState<string>(LEGACY_SESSION_ID);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]); // AI 칩 토글
  const [pendingAI, setPendingAI] = useState<PendingAI[]>([]); // 응답 대기 중
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const sessionSubmittingRef = useRef(false); // 한글 IME / blur 이중 호출 방지
  const messagesScrollRef = useRef<HTMLDivElement>(null); // 메시지 리스트 자동 스크롤
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hideResolved, setHideResolved] = useState(false);

  // ─── 로드 ───
  const refreshComments = useCallback(async () => {
    const all = await listAllComments(problemId);
    setComments(all);
    // 부모(EditorView/ProblemView)로의 emit은 별도 effect에서
    // "고아 메시지 제외" 필터를 거쳐 처리한다 (세션 삭제 후 카운트 동기화).
    // 인간 작성자 프로필 백필
    const unknownUids = Array.from(
      new Set(all.filter((c) => c.authorType !== 'ai').map((c) => c.authorUid)),
    ).filter((u) => !profiles[u]);
    if (unknownUids.length > 0) {
      const fetched = await Promise.all(unknownUids.map((u) => getUserProfile(u).catch(() => null)));
      const map: Record<string, UserProfile> = { ...profiles };
      unknownUids.forEach((u, i) => { if (fetched[i]) map[u] = fetched[i]!; });
      setProfiles(map);
    }
  }, [problemId, profiles]);

  const refreshSessions = useCallback(async () => {
    const list = await listSessions(problemId);
    setSessions(list);
  }, [problemId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      refreshComments(),
      refreshSessions(),
      getEnabledModels().then(setAiModels).catch(() => setAiModels([])),
      getUserProfile(currentUid).then(setMyProfile).catch(() => null),
    ])
      .catch((e) => console.error('토론 패널 초기 로드 실패:', e))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, currentUid]);

  // ─── 실시간 구독 ───
  // 백그라운드에서 도착하는 AI 응답·다른 클라이언트 메시지를 자동 반영.
  // 사용자가 패널을 닫아도 fetch 자체는 브라우저에서 계속 진행되며 응답이
  // addComment로 저장되는데, 그 신호를 이 리스너가 즉시 받아 UI에 반영한다.
  const profilesRef = useRef(profiles);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => {
    const unsub = watchAllComments(problemId, (all) => {
      setComments(all);
      // 인간 작성자 프로필 백필 (캐시되지 않은 uid만)
      const unknownUids = Array.from(
        new Set(all.filter((c) => c.authorType !== 'ai').map((c) => c.authorUid)),
      ).filter((u) => !profilesRef.current[u]);
      if (unknownUids.length > 0) {
        Promise.all(unknownUids.map((u) => getUserProfile(u).catch(() => null))).then((fetched) => {
          setProfiles((prev) => {
            const next = { ...prev };
            unknownUids.forEach((u, i) => { if (fetched[i]) next[u] = fetched[i]!; });
            return next;
          });
        });
      }
    });
    return () => unsub();
  }, [problemId]);

  // 부모(EditorView/ProblemView)에 노출되는 메시지 목록은
  // "사용자에게 보이는 것"만 — 삭제된 세션의 고아 메시지는 제외 (카운트 동기화)
  useEffect(() => {
    if (!onCommentsChange) return;
    const sessionIdSet = new Set(sessions.map((s) => s.id));
    const visible = comments.filter((c) => {
      if (!c.discussionSessionId) return true; // legacy 댓글 — 항상 표시
      return sessionIdSet.has(c.discussionSessionId);
    });
    onCommentsChange(visible);
  }, [comments, sessions, onCommentsChange]);

  // 초기 1회만 자동 선택: 세션이 있으면 첫 normal 세션, 없으면 legacy 유지
  const initialSelectionDoneRef = useRef(false);
  useEffect(() => {
    if (initialSelectionDoneRef.current) return;
    if (loading) return;
    if (sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
    initialSelectionDoneRef.current = true;
  }, [loading, sessions]);

  // ─── 필터 ───
  const visibleComments = useMemo(() => {
    return comments.filter((c) => {
      if (c.tabId !== activeTabId) return false;
      if (activeSessionId === LEGACY_SESSION_ID) {
        return !c.discussionSessionId; // 세션 미할당 (legacy 댓글)
      }
      return c.discussionSessionId === activeSessionId;
    });
  }, [comments, activeTabId, activeSessionId]);

  const threads = useMemo(() => buildThreads(visibleComments), [visibleComments]);
  const visibleThreads = hideResolved ? threads.filter((t) => !t.parent.resolved) : threads;

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );
  const isAISession = !!activeSession && activeSession.aiEnabled;

  /** 현재 세션의 누적 비용 (USD) */
  const sessionCostUsd = useMemo(() => {
    return visibleComments.reduce((sum, c) => sum + (c.aiUsage?.costUsd || 0), 0);
  }, [visibleComments]);

  /** 현재 세션에서 진행 중/실패한 AI 알림만 표시 */
  const visiblePendingAI = useMemo(
    () => pendingAI.filter((p) => p.sessionId === activeSessionId),
    [pendingAI, activeSessionId],
  );

  // ─── 마지막 메시지로 자동 스크롤 ───
  // 메시지 수가 늘어나거나 세션이 바뀌거나 AI 응답이 진행되면 하단으로 이동
  const messageCountSignal = useMemo(() => {
    // 답글까지 포함한 총 길이 + 마지막 메시지의 updatedAt을 시그널로
    const total = visibleThreads.reduce((n, t) => n + 1 + t.replies.length, 0);
    const lastUpdated = visibleThreads.length > 0
      ? Math.max(
          ...visibleThreads.map((t) => {
            const replyMax = t.replies.length > 0
              ? Math.max(...t.replies.map((r) => r.updatedAt?.getTime?.() || 0))
              : 0;
            return Math.max(t.parent.updatedAt?.getTime?.() || 0, replyMax);
          }),
        )
      : 0;
    return `${total}:${lastUpdated}:${visiblePendingAI.length}`;
  }, [visibleThreads, visiblePendingAI]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    // 레이아웃이 안정된 후 스크롤
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messageCountSignal, activeSessionId, loading]);

  // ─── displayInfo 헬퍼 ───
  const getDisplayInfo = useCallback(
    (c: TabComment): DisplayInfo => {
      if (c.authorType === 'ai' && c.modelId) {
        const model = aiModels.find((m) => m.modelId === c.modelId);
        return {
          name: model?.nickname || '?',
          emoji: model?.avatarEmoji,
          isAI: true,
          modelDisplayName: model?.displayName,
        };
      }
      const p = profiles[c.authorUid];
      const name = p?.nickname || (p?.email || '').split('@')[0] || p?.displayName || '익명';
      return { name, photoURL: p?.photoURL, isAI: false };
    },
    [aiModels, profiles],
  );

  // ─── 액션 ───
  const handleEdit = async (commentId: string, content: string) => {
    await editCommentContent(problemId, commentId, content);
    setEditingId(null);
    await refreshComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;
    await deleteComment(problemId, commentId);
    await refreshComments();
  };

  const handleResolve = async (comment: TabComment) => {
    await toggleResolved(problemId, comment.id, !comment.resolved);
    await refreshComments();
  };

  const handleReplySubmit = async (parentCommentId: string, content: string) => {
    await addComment({
      problemId,
      tabId: activeTabId,
      authorUid: currentUid,
      content,
      parentCommentId,
      authorType: 'human',
      discussionSessionId:
        activeSessionId === LEGACY_SESSION_ID ? undefined : activeSessionId,
    });
    setReplyingTo(null);
    await refreshComments();
  };

  // ─── 세션 CRUD ───
  const handleCreateSession = async () => {
    if (sessionSubmittingRef.current) return;
    const trimmed = newSessionName.trim();
    if (!trimmed) {
      setCreatingSession(false);
      setNewSessionName('');
      return;
    }
    sessionSubmittingRef.current = true;
    try {
      const id = await createNormalSession(problemId, trimmed, currentUid);
      setNewSessionName('');
      setCreatingSession(false);
      await refreshSessions();
      setActiveSessionId(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '세션 생성 실패');
    } finally {
      sessionSubmittingRef.current = false;
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (sessionSubmittingRef.current) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      setRenamingSessionId(null);
      return;
    }
    sessionSubmittingRef.current = true;
    try {
      await renameSession(problemId, sessionId, trimmed);
      setRenamingSessionId(null);
      await refreshSessions();
    } catch (e) {
      alert(e instanceof Error ? e.message : '이름 변경 실패');
    } finally {
      sessionSubmittingRef.current = false;
    }
  };

  const handleDeleteSession = async (s: DiscussionSession) => {
    if (s.type === 'public') return;
    if (!confirm(`세션 "${s.name}"을(를) 삭제하시겠습니까?\n(메시지는 그대로 남되, 어느 세션에서도 보이지 않게 됩니다.)`)) return;
    try {
      await deleteSession(problemId, s.id);
      await refreshSessions();
      if (activeSessionId === s.id) {
        setActiveSessionId(LEGACY_SESSION_ID);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '세션 삭제 실패');
    }
  };

  // ─── 컨텍스트 조립 (Phase 37-G와 함께 구현) ───
  const fetchTabBlocksText = useCallback(async (tabId: string): Promise<string> => {
    try {
      const snap = await getDocs(
        query(collection(db, 'problems', problemId, tabSubcollection(tabId)), orderBy('order')),
      );
      const blocks = snap.docs.map((d) => d.data() as Block);
      return blocks
        .map((b) => {
          const title = b.title ? `### ${b.title}\n` : '';
          return title + (b.raw_text || '');
        })
        .filter(Boolean)
        .join('\n\n');
    } catch (e) {
      console.warn('블록 로드 실패:', tabId, e);
      return '';
    }
  }, [problemId]);

  const buildContext = useCallback(async () => {
    const problemContent = await fetchTabBlocksText('question');
    if (activeTabId === 'question') {
      return { problemContent, currentTabContent: undefined, currentTabLabel: undefined };
    }
    const currentTabContent = await fetchTabBlocksText(activeTabId);
    const currentTabLabel = tabs.find((t) => t.id === activeTabId)?.label || activeTabId;
    return { problemContent, currentTabContent, currentTabLabel };
  }, [fetchTabBlocksText, activeTabId, tabs]);

  const buildHistory = useCallback(() => {
    // 최근 5개 메시지 (현재 visible 기준), 답글 제외
    const tops = visibleComments.filter((c) => !c.parentCommentId);
    const recent = tops.slice(-HISTORY_LIMIT);
    return recent.map((c) => {
      const info = getDisplayInfo(c);
      return {
        role: info.isAI ? ('ai' as const) : ('human' as const),
        nickname: info.name,
        content: c.content,
      };
    });
  }, [visibleComments, getDisplayInfo]);

  // ─── 단일 AI 호출 (전송 + 재시도에서 공유) ───
  const invokeOneAI = useCallback(
    async (model: AIModelConfig, context: DiscussRequestContext, sessionId: string) => {
      try {
        const res = await fetch('/api/discuss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: model.modelId,
            problemContent: context.problemContent,
            currentTabContent: context.currentTabContent,
            currentTabLabel: context.currentTabLabel,
            discussionHistory: context.discussionHistory,
            participantNicknames: context.participantNicknames,
            myNickname: model.nickname,
            currentMessage: context.currentMessage,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        await addComment({
          problemId, tabId: activeTabId,
          authorUid: `ai:${model.modelId}`,
          content: data.content || '(빈 응답)',
          parentCommentId: null,
          authorType: 'ai',
          modelId: model.modelId,
          discussionSessionId: sessionId,
          aiUsage: {
            inputTokens: data.inputTokens || 0,
            outputTokens: data.outputTokens || 0,
            costUsd: data.costUsd || 0,
          },
        });
        await refreshComments();
        setPendingAI((prev) =>
          prev.filter((p) => !(p.modelId === model.modelId && p.sessionId === sessionId)),
        );
      } catch (err) {
        console.error(`[discuss] ${model.modelId} 실패:`, err);
        setPendingAI((prev) =>
          prev.map((p) =>
            p.modelId === model.modelId && p.sessionId === sessionId
              ? {
                  ...p,
                  error: err instanceof Error ? err.message : '응답 실패',
                  retryContext: context,
                }
              : p,
          ),
        );
      }
    },
    [problemId, activeTabId, refreshComments],
  );

  // ─── 메시지 전송 (Phase 37-F 핵심) ───
  const handleSendMessage = async (content: string) => {
    const myNickname = myProfile?.nickname || 'KDS';

    // 1. 레거시 세션: AI 호출 없이 단순 댓글 추가
    if (activeSessionId === LEGACY_SESSION_ID) {
      await addComment({
        problemId, tabId: activeTabId, authorUid: currentUid,
        content, parentCommentId: null,
        authorType: 'human',
      });
      await refreshComments();
      return;
    }

    // 2. 일반 세션 — AI 호출 가능
    const invokedIds = isAISession ? [...selectedModelIds] : [];
    const invokedModels = invokedIds
      .map((id) => aiModels.find((m) => m.modelId === id))
      .filter((m): m is AIModelConfig => !!m);

    await addComment({
      problemId, tabId: activeTabId, authorUid: currentUid,
      content, parentCommentId: null,
      authorType: 'human',
      discussionSessionId: activeSessionId,
      invokedModelIds: invokedIds.length > 0 ? invokedIds : undefined,
    });
    await refreshComments();

    if (invokedIds.length === 0) return;

    // 3. 컨텍스트 조립
    const ctx = await buildContext();
    const history = buildHistory();
    const participantNicknames = [myNickname, ...invokedModels.map((m) => m.nickname)];

    const baseContext: Omit<DiscussRequestContext, 'currentMessage'> & { currentMessage: string } = {
      problemContent: ctx.problemContent,
      currentTabContent: ctx.currentTabContent,
      currentTabLabel: ctx.currentTabLabel,
      discussionHistory: history,
      participantNicknames,
      currentMessage: content,
    };

    // 4. pending 상태 — 동일 (sessionId, modelId) 중복 제거 후 신규 추가
    //    다른 세션의 pending은 그대로 보존 (세션별 격리)
    const sessionAtSend = activeSessionId;
    setPendingAI((prev) => [
      ...prev.filter(
        (p) => !(p.sessionId === sessionAtSend
          && invokedModels.some((m) => m.modelId === p.modelId)),
      ),
      ...invokedModels.map((m) => ({
        modelId: m.modelId,
        nickname: m.nickname,
        emoji: m.avatarEmoji,
        sessionId: sessionAtSend,
      })),
    ]);

    // 5. 각 AI 호출 — 도착순으로 Firestore 저장
    await Promise.allSettled(
      invokedModels.map((model) => invokeOneAI(model, baseContext, sessionAtSend)),
    );
  };

  // ─── 에러 재시도 ───
  const handleRetryAI = async (modelId: string, sessionId: string) => {
    const pending = pendingAI.find((p) => p.modelId === modelId && p.sessionId === sessionId);
    if (!pending || !pending.retryContext) return;
    const model = aiModels.find((m) => m.modelId === modelId);
    if (!model) return;
    // error 표시 제거, pending 상태로 되돌림
    setPendingAI((prev) =>
      prev.map((p) =>
        p.modelId === modelId && p.sessionId === sessionId
          ? { modelId: p.modelId, nickname: p.nickname, emoji: p.emoji, sessionId: p.sessionId }
          : p,
      ),
    );
    await invokeOneAI(model, pending.retryContext, sessionId);
  };

  const handleDismissError = (modelId: string, sessionId: string) => {
    setPendingAI((prev) => prev.filter((p) => !(p.modelId === modelId && p.sessionId === sessionId)));
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: '35em', maxWidth: '90vw',
      background: 'var(--bg-card, #fff)',
      borderLeft: '1px solid var(--border-light, #ddd)',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50,
      fontFamily: 'var(--font-ui)',
    }}>
      <style>{`
        .comment-body > div {
          font-family: var(--font-ui, 'Pretendard', sans-serif) !important;
          font-size: ${commentFontSize}px !important;
          line-height: 1.8 !important;
        }
        .comment-body { color: #6a6a6a; }
        .comment-body.ai-body { color: #4a4a4a; }
        .comment-body .katex,
        .comment-body .katex * { color: var(--text-primary); }
        @keyframes pulse-pending {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
        .pending-ai { animation: pulse-pending 1.4s ease-in-out infinite; }
      `}</style>

      {/* ═══ 헤더 ═══ 높이 57px (사이드바 헤더와 정렬) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        minHeight: 57, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border-light, #eee)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          토론 — {tabs.find((t) => t.id === activeTabId)?.label || activeTabId}
        </div>
        <button
          onClick={() => setHideResolved((v) => !v)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', padding: '2px 4px',
          }}
        >
          {hideResolved ? '해결된 메시지 보이기' : '해결된 메시지 숨기기'}
        </button>
        <div style={{ flex: 1 }} />
        {isAISession && sessionCostUsd > 0 && (
          <span
            title="이 세션의 AI 응답 누적 비용"
            style={{
              fontSize: 11, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              padding: '2px 6px',
              border: '1px solid var(--border-light)',
              borderRadius: 4,
              cursor: 'help',
            }}
          >
            이 세션: ${sessionCostUsd.toFixed(4)}
          </span>
        )}
        <button
          onClick={onClose}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, padding: 0, lineHeight: 1,
          }}
          title="토론 사이드바 닫기"
        >×</button>
      </div>

      {/* ═══ 세션 바 ═══ */}
      <SessionTabBar
        sessions={sessions}
        activeSessionId={activeSessionId}
        currentUid={currentUid}
        isOwner={isOwner}
        creatingSession={creatingSession}
        newSessionName={newSessionName}
        renamingSessionId={renamingSessionId}
        renameDraft={renameDraft}
        onSelect={setActiveSessionId}
        onStartCreate={() => { setCreatingSession(true); setNewSessionName(''); }}
        onCancelCreate={() => { setCreatingSession(false); setNewSessionName(''); }}
        onChangeNewName={setNewSessionName}
        onSubmitCreate={handleCreateSession}
        onStartRename={(s) => { setRenamingSessionId(s.id); setRenameDraft(s.name); }}
        onCancelRename={() => setRenamingSessionId(null)}
        onChangeRenameDraft={setRenameDraft}
        onSubmitRename={handleRenameSession}
        onDelete={handleDeleteSession}
      />

      {/* ═══ 메시지 리스트 ═══ */}
      <div ref={messagesScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            불러오는 중…
          </div>
        ) : visibleThreads.length === 0 && visiblePendingAI.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {activeSessionId === LEGACY_SESSION_ID
              ? '댓글이 없습니다.'
              : isAISession
                ? 'AI를 선택하고 첫 메시지를 입력하세요.'
                : '메시지가 없습니다.'}
          </div>
        ) : (
          <>
            {visibleThreads.map((thread) => (
              <CommentThreadView
                key={thread.parent.id}
                thread={thread}
                getDisplayInfo={getDisplayInfo}
                currentUid={currentUid}
                isOwner={isOwner}
                canComment={canComment}
                replyingToId={replyingTo}
                editingId={editingId}
                onSetReplying={setReplyingTo}
                onSetEditing={setEditingId}
                onReplySubmit={(content) => handleReplySubmit(thread.parent.id, content)}
                onEditSubmit={(commentId, content) => handleEdit(commentId, content)}
                onDelete={handleDelete}
                onResolve={handleResolve}
              />
            ))}
            {visiblePendingAI.map((p) => (
              <PendingAIBubble
                key={`${p.sessionId}:${p.modelId}`}
                pending={p}
                onRetry={p.error && p.retryContext ? () => handleRetryAI(p.modelId, p.sessionId) : undefined}
                onDismiss={p.error ? () => handleDismissError(p.modelId, p.sessionId) : undefined}
              />
            ))}
          </>
        )}
      </div>

      {/* ═══ AI 칩 + 입력창 ═══ */}
      {canComment ? (
        <div style={{
          padding: '10px 16px 12px',
          borderTop: '1px solid var(--border-light, #eee)',
          background: 'var(--bg-primary, #FAF9F7)',
        }}>
          <CommentEditor
            problemId={problemId}
            placeholder=""
            onSubmit={handleSendMessage}
            headerLeft={isAISession ? (
              <AIChipBar
                models={aiModels}
                selectedIds={selectedModelIds}
                onToggle={(modelId) =>
                  setSelectedModelIds((prev) =>
                    prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
                  )
                }
              />
            ) : undefined}
          />
        </div>
      ) : (
        <div style={{
          padding: 12, borderTop: '1px solid var(--border-light, #eee)',
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          작성 권한이 없습니다.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* SessionTabBar                                            */
/* ═══════════════════════════════════════════════════════ */
function SessionTabBar({
  sessions, activeSessionId, currentUid, isOwner,
  creatingSession, newSessionName, renamingSessionId, renameDraft,
  onSelect, onStartCreate, onCancelCreate, onChangeNewName, onSubmitCreate,
  onStartRename, onCancelRename, onChangeRenameDraft, onSubmitRename, onDelete,
}: {
  sessions: DiscussionSession[];
  activeSessionId: string;
  currentUid: string;
  isOwner: boolean;
  creatingSession: boolean;
  newSessionName: string;
  renamingSessionId: string | null;
  renameDraft: string;
  onSelect: (id: string) => void;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onChangeNewName: (s: string) => void;
  onSubmitCreate: () => void;
  onStartRename: (s: DiscussionSession) => void;
  onCancelRename: () => void;
  onChangeRenameDraft: (s: string) => void;
  onSubmitRename: (sessionId: string) => void;
  onDelete: (s: DiscussionSession) => void;
}) {
  // public 세션이 있으면 항상 최상단 (Phase 37에선 없음, Phase 38에서 자동 생성)
  const publicSession = sessions.find((s) => s.type === 'public');
  const normalSessions = sessions.filter((s) => s.type === 'normal');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 12px',
      minHeight: 41, boxSizing: 'border-box',
      borderBottom: '1px solid var(--border-light, #eee)',
      background: 'var(--bg-primary, #FAF9F7)',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {/* legacy "댓글" pseudo-session */}
      <SessionPill
        label="💬 댓글"
        active={activeSessionId === LEGACY_SESSION_ID}
        onClick={() => onSelect(LEGACY_SESSION_ID)}
      />

      {publicSession && (
        <SessionPill
          label={`📢 ${publicSession.name}`}
          active={activeSessionId === publicSession.id}
          onClick={() => onSelect(publicSession.id)}
        />
      )}

      {normalSessions.map((s) => {
        const canManage = isOwner || s.createdBy === currentUid;
        const isRenaming = renamingSessionId === s.id;
        const isActive = activeSessionId === s.id;
        if (isRenaming) {
          return (
            <input
              key={s.id}
              autoFocus
              value={renameDraft}
              onChange={(e) => onChangeRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return; // 한글 IME 조합 중 무시
                if (e.key === 'Enter') onSubmitRename(s.id);
                else if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={() => onSubmitRename(s.id)}
              style={{
                padding: '4px 10px', fontSize: 12,
                border: '1px solid var(--accent-primary, #B8845C)',
                borderRadius: 14,
                outline: 'none',
                fontFamily: 'var(--font-ui)',
                minWidth: 80,
              }}
            />
          );
        }
        return (
          <SessionPill
            key={s.id}
            label={s.name}
            active={isActive}
            onClick={() => onSelect(s.id)}
            onDoubleClick={canManage ? () => onStartRename(s) : undefined}
            onDelete={canManage ? () => onDelete(s) : undefined}
          />
        );
      })}

      {creatingSession ? (
        <input
          autoFocus
          value={newSessionName}
          onChange={(e) => onChangeNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // 한글 IME 조합 중 무시
            if (e.key === 'Enter') onSubmitCreate();
            else if (e.key === 'Escape') onCancelCreate();
          }}
          onBlur={onSubmitCreate}
          placeholder="새 세션 이름"
          style={{
            padding: '4px 10px', fontSize: 12,
            border: '1px solid var(--accent-primary, #B8845C)',
            borderRadius: 14,
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            minWidth: 110,
          }}
        />
      ) : (
        <button
          onClick={onStartCreate}
          title="새 토론 세션 만들기"
          style={{
            border: '1px dashed var(--border-light)',
            background: 'transparent',
            borderRadius: 14,
            padding: '4px 10px',
            fontSize: 12,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
            flexShrink: 0,
          }}
        >
          + 새 토론
        </button>
      )}
    </div>
  );
}

function SessionPill({
  label, active, onClick, onDoubleClick, onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title={onDoubleClick ? `${label} (더블클릭: 이름 변경)` : label}
        style={{
          border: 'none',
          background: active ? 'var(--text-primary)' : 'transparent',
          color: active ? 'var(--bg-card, #fff)' : 'var(--text-secondary)',
          padding: '4px 10px',
          paddingRight: onDelete && hovered ? 24 : 10,
          borderRadius: 14,
          fontSize: 12,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          whiteSpace: 'nowrap',
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'padding-right 0.12s',
        }}
      >
        {label}
      </button>
      {onDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="세션 삭제"
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: active ? 'var(--bg-card, #fff)' : 'var(--text-muted)',
            fontSize: 13, lineHeight: 1, padding: 0,
            width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* AIChipBar                                                */
/* ═══════════════════════════════════════════════════════ */
function AIChipBar({
  models, selectedIds, onToggle,
}: {
  models: AIModelConfig[];
  selectedIds: string[];
  onToggle: (modelId: string) => void;
}) {
  if (models.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        AI 모델을 불러올 수 없습니다.
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
    }}>
      {models.map((m) => {
        const on = selectedIds.includes(m.modelId);
        return (
          <button
            key={m.modelId}
            onClick={() => onToggle(m.modelId)}
            title={`${m.displayName} (${m.nickname})`}
            style={{
              border: on ? '1px solid var(--accent-primary, #B8845C)' : '1px solid var(--border-light)',
              background: on ? 'var(--accent-primary, #B8845C)' : 'var(--bg-card, #fff)',
              color: on ? '#fff' : 'var(--text-secondary)',
              borderRadius: 14,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: on ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              transition: 'all 0.12s',
            }}
          >
            <span style={{ fontSize: 13 }}>{m.avatarEmoji}</span>
            <span>{m.nickname}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* PendingAIBubble                                          */
/* ═══════════════════════════════════════════════════════ */
function PendingAIBubble({
  pending, onRetry, onDismiss,
}: {
  pending: PendingAI;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={pending.error ? '' : 'pending-ai'}
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 8,
        border: pending.error ? '1px solid #e0a0a0' : '1px dashed var(--border-light)',
        background: pending.error ? '#fff5f5' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: pending.error ? '#c44' : 'var(--text-muted)',
      }}
    >
      <span style={{ fontSize: 16 }}>{pending.emoji}</span>
      <span style={{ fontWeight: 600 }}>{pending.nickname}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pending.error ? `응답 실패: ${pending.error}` : '생각 중…'}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            border: '1px solid #c44', background: 'transparent', color: '#c44',
            borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            fontFamily: 'var(--font-ui)', flexShrink: 0,
          }}
        >
          재시도
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          title="닫기"
          style={{
            border: 'none', background: 'transparent', color: '#c44',
            fontSize: 14, lineHeight: 1, padding: 0, cursor: 'pointer',
            width: 18, height: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* CommentThreadView                                        */
/* ═══════════════════════════════════════════════════════ */
function CommentThreadView({
  thread, getDisplayInfo, currentUid, isOwner, canComment,
  replyingToId, editingId,
  onSetReplying, onSetEditing,
  onReplySubmit, onEditSubmit, onDelete, onResolve,
}: {
  thread: { parent: TabComment; replies: TabComment[] };
  getDisplayInfo: (c: TabComment) => DisplayInfo;
  currentUid: string;
  isOwner: boolean;
  canComment: boolean;
  replyingToId: string | null;
  editingId: string | null;
  onSetReplying: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
  onReplySubmit: (content: string) => Promise<void>;
  onEditSubmit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onResolve: (c: TabComment) => void;
}) {
  const { parent, replies } = thread;
  const parentIsAI = parent.authorType === 'ai';
  return (
    <div style={{
      marginBottom: 16,
      padding: 10,
      borderRadius: 8,
      background: parent.resolved
        ? 'var(--bg-hover, #f5f5f5)'
        : parentIsAI ? 'rgba(184,132,92,0.04)' : 'transparent',
      opacity: parent.resolved ? 0.65 : 1,
      border: parent.resolved
        ? '1px solid var(--border-light)'
        : parentIsAI ? '1px solid rgba(184,132,92,0.18)' : '1px solid transparent',
    }}>
      <CommentItem
        comment={parent}
        info={getDisplayInfo(parent)}
        currentUid={currentUid}
        isOwner={isOwner}
        canComment={canComment}
        isEditing={editingId === parent.id}
        isReplying={replyingToId === parent.id}
        onSetEditing={(v) => onSetEditing(v ? parent.id : null)}
        onSetReplying={(v) => onSetReplying(v ? parent.id : null)}
        onEditSubmit={(c) => onEditSubmit(parent.id, c)}
        onDelete={() => onDelete(parent.id)}
        onResolve={() => onResolve(parent)}
      />

      {replies.length > 0 && (
        <div style={{ marginLeft: 20, marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--border-light)' }}>
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              info={getDisplayInfo(r)}
              currentUid={currentUid}
              isOwner={isOwner}
              canComment={canComment}
              isReply
              isEditing={editingId === r.id}
              isReplying={false}
              onSetEditing={(v) => onSetEditing(v ? r.id : null)}
              onSetReplying={() => {}}
              onEditSubmit={(c) => onEditSubmit(r.id, c)}
              onDelete={() => onDelete(r.id)}
              onResolve={() => {}}
            />
          ))}
        </div>
      )}

      {replyingToId === parent.id && canComment && (
        <div style={{ marginLeft: 20, marginTop: 8 }}>
          <CommentEditor
            placeholder="답글…"
            submitLabel="답글"
            autoFocus
            onSubmit={onReplySubmit}
            onCancel={() => onSetReplying(null)}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* CommentItem                                              */
/* ═══════════════════════════════════════════════════════ */
function CommentItem({
  comment, info, currentUid, isOwner, canComment, isReply,
  isEditing, isReplying,
  onSetEditing, onSetReplying,
  onEditSubmit, onDelete, onResolve,
}: {
  comment: TabComment;
  info: DisplayInfo;
  currentUid: string;
  isOwner: boolean;
  canComment: boolean;
  isReply?: boolean;
  isEditing: boolean;
  isReplying: boolean;
  onSetEditing: (v: boolean) => void;
  onSetReplying: (v: boolean) => void;
  onEditSubmit: (content: string) => Promise<void>;
  onDelete: () => void;
  onResolve: () => void;
}) {
  const isMine = !info.isAI && comment.authorUid === currentUid;

  return (
    <div style={{ marginBottom: isReply ? 8 : 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {info.isAI ? (
          <div
            title={info.modelDisplayName}
            style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(184,132,92,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11,
            }}
          >
            {info.emoji || '🤖'}
          </div>
        ) : info.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.photoURL} alt={info.name} referrerPolicy="no-referrer"
            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
            background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: '#666',
          }}>{info.name.charAt(0).toUpperCase()}</div>
        )}
        <span
          title={info.isAI ? info.modelDisplayName : undefined}
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {info.name}
        </span>
        {info.isAI && (
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 8,
            background: 'rgba(184,132,92,0.14)', color: 'var(--accent-primary, #B8845C)',
            fontWeight: 600,
          }}>AI</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
          {formatRelative(comment.createdAt)}
          {!info.isAI && comment.updatedAt.getTime() - comment.createdAt.getTime() > 60_000 && ' (수정됨)'}
        </span>
      </div>

      {/* 본문 */}
      <div style={{ paddingLeft: 24 }}>
        {isEditing ? (
          <CommentEditor
            initialValue={comment.content}
            submitLabel="저장"
            clearOnSubmit={false}
            autoFocus
            onSubmit={onEditSubmit}
            onCancel={() => onSetEditing(false)}
          />
        ) : (
          <div className={`comment-body ${info.isAI ? 'ai-body' : ''}`}>
            <EditorPreview content={comment.content} borderless autoHeight locale="ko" />
          </div>
        )}
      </div>

      {/* 액션 */}
      {!isEditing && (
        <div style={{
          paddingLeft: 24, marginTop: 4,
          display: 'flex', gap: 12,
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          {!isReply && !info.isAI && canComment && (
            <button onClick={() => onSetReplying(!isReplying)} style={miniLinkStyle}>
              {isReplying ? '답글 취소' : '답글'}
            </button>
          )}
          {!isReply && (isOwner || isMine) && (
            <button
              onClick={onResolve}
              style={{ ...miniLinkStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={comment.resolved ? '해결 취소' : '해결됨으로 표시'}
            >
              <input
                type="checkbox"
                checked={comment.resolved}
                readOnly
                tabIndex={-1}
                style={{
                  margin: 0, width: 11, height: 11,
                  accentColor: 'var(--text-muted)',
                  cursor: 'pointer', pointerEvents: 'none',
                }}
              />
              해결됨
            </button>
          )}
          {isMine && (
            <>
              <button onClick={() => onSetEditing(true)} style={miniLinkStyle}>수정</button>
              <button onClick={onDelete} style={{ ...miniLinkStyle, color: 'var(--accent-danger)' }}>삭제</button>
            </>
          )}
          {/* AI 메시지엔 수정/삭제 버튼 없음 (보안 규칙도 차단) */}
          {info.isAI && comment.aiUsage && (
            <span
              style={{
                fontSize: 10, color: 'var(--text-faint)',
                cursor: 'help',
                borderBottom: '1px dotted var(--text-faint)',
              }}
              title={`입력 ${comment.aiUsage.inputTokens.toLocaleString()} 토큰 · 출력 ${comment.aiUsage.outputTokens.toLocaleString()} 토큰`}
            >
              ${comment.aiUsage.costUsd.toFixed(5)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const miniLinkStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer',
  padding: 0, fontSize: 11, color: 'var(--text-muted)',
  fontFamily: 'var(--font-ui)',
};

function formatRelative(d: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
