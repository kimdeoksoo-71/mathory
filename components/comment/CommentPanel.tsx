'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ToggleSwitch from '../ui/ToggleSwitch';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  ProblemComment, TabMeta, UserProfile, DiscussionSession, AIModelConfig, Block,
  VerifyKind, tabSubcollection,
} from '../../types/problem';
import { db } from '../../lib/firebase';
import {
  listAllComments, watchAllComments, addComment, editCommentContent, deleteComment,
  buildThreads, isCommentStream,
} from '../../lib/comments';
import { getUserProfile } from '../../lib/users';
import { getEnabledModels } from '../../lib/ai-models';
import {
  listSessions, createNormalSession, renameSession, deleteSession, ensureCommentSession,
} from '../../lib/discussion-sessions';
import { getProblem, setCommentsVisible, setCommentsWritable } from '../../lib/firestore';
import { FIG_PLACEHOLDER, imageSrcOf, scanImgTags, countPlaceholders } from '../../lib/verify/figures';
import EditorPreview from '../editor/EditorPreview';
import CommentEditor, { type CommentEditorHandle } from './CommentEditor';
import { AIBrandIcon, providerFromModelName } from './AIBrandIcon';
import VerifyReportCard, { extractVerifyReport } from './VerifyReportCard';
import SelectionInsertPopup from './SelectionInsertPopup';
import type { GraphBlockSave, GraphBlockFormat, GraphExportHandle } from '../viewer/GgbGraphView';
import { IconDownload, IconComment } from '../ui/Icons';
import { alertDialog, confirmDialog } from '../../lib/dialogs';
import { DRAWER_INSET, DRAWER_RADIUS, DRAWER_BORDER, DRAWER_ROW1_H } from '../ui/dialogStyles';

const HISTORY_LIMIT = 5;

/** Phase 42: 다음 라운드 AI 입력으로 보내는 히스토리에서 대용량 첨부 제거.
 *  그래프 펜스·검산 <details> 부록이 그대로 역류하면 토큰 낭비 + 펜스 모방을 유발.
 *  ⚠️ Firestore 저장본(표시용 content)은 건드리지 않음 — 히스토리 조립 시에만 적용. */
function stripForHistory(content: string): string {
  return content
    .replace(/```mathory-graph[\s\S]*?```/g, '[그래프 첨부됨]')
    .replace(/```mathory-verify[\s\S]*?```/g, '[검증 리포트 첨부됨]')
    .replace(/<details>[\s\S]*?<\/details>/g, '[검산 코드 첨부됨]')
    // Phase 61f D16 — 옛 라운드의 그림 번호는 이번 요청과 어긋난다. 번호만 지운 중립 표기로.
    //   (⟦그림⟧ 자리표시자로 바꾸지 않는다 — 슬롯 없는 자리표시자를 만들면 번호가 밀린다.)
    .replace(/\[그림 \d+[^\]]*\]/g, '[그림]')
    .trim();
}

/** Phase 61f — 전송용 사본에서 `<img>`를 자리표시자로 바꾸고 src를 슬롯으로 뽑는다.
 *  ⚠ Firestore 저장본은 건드리지 않는다 — 호출부가 반드시 사본에만 쓸 것. */
function replaceImgTags(text: string): { text: string; slots: (string | null)[] } {
  const tags = scanImgTags(text);
  if (tags.length === 0) return { text, slots: [] };
  let out = '';
  let last = 0;
  const slots: (string | null)[] = [];
  for (const t of tags) {
    out += text.slice(last, t.index) + FIG_PLACEHOLDER;
    slots.push(t.src || null);
    last = t.index + t.length;
  }
  return { text: out + text.slice(last), slots };
}

interface CommentPanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  activeTabId: string;
  currentUid: string;
  canComment: boolean;
  /** Phase 47: 'comments' = 사람 댓글(문항 단일 스레드, AI 없음) / 'agent' = AI 토론(세션 다수). 기본 'agent' */
  mode?: 'comments' | 'agent';
  bodyFontSize?: number;
  onClose: () => void;
  onCommentsChange?: (comments: ProblemComment[]) => void;
  initialTabId?: string;
  onTabChange?: (tabId: string) => void;
  /** Phase 42: AI 그래프 → 에디터 블록 저장 (편집 화면에서만 전달). 반환값은 토스트용 탭 이름 */
  onInsertGraphBlock?: (save: GraphBlockSave) => Promise<string | void>;
  /** Phase 44: 드래그 리사이즈된 패널 폭 (px 숫자). 미전달 시 기본 35em */
  width?: number | string;
  /** Phase 61b: 정밀 검증 실행.
   *  ⚠️ 착수 당시엔 "편집 화면 전용"이었으나 **후속에서 열람뷰(ProblemView)에도 넘긴다** —
   *  검증은 문항을 보면서 하는 일이라 실사용에서 곧바로 어긋났다.
   *  편집창 전용 게이트의 살아 있는 선례는 `onInsertGraphBlock`·`onInsertToEditor`다. */
  onRunVerify?: (kind: VerifyKind, sessionId: string) => Promise<void>;
  /** Phase 61b: 리포트 지적 → 그 인용이 있는 자리로 이동. 〃 (열람뷰는 오너일 때만 넘긴다) */
  onJumpToBlock?: (blockKey: string, quote: string) => void;
  /** Phase 61c: 대화 선택 영역 → 활성 블록에 삽입. **편집 화면에서만 전달** —
   *  prop 유무가 곧 [편집창에 삽입] 버튼의 게이트다(`onInsertGraphBlock` 선례).
   *  팝업 자체는 열람뷰에도 마운트돼 [복사]는 어디서나 쓸 수 있다. */
  onInsertToEditor?: (text: string) => 'inserted' | 'no-target';
  /** Phase 61b: 검증 대상 총 글자 수(사전 차단용). 편집 화면에서만 전달.
   *  kind별로 다르다 — 문제 검증은 문제 탭만, 풀이 검증은 문제+풀이를 함께 보낸다. */
  verifyCharCount?: (kind: VerifyKind) => number;
}

interface DisplayInfo {
  name: string;
  emoji?: string;
  provider?: string;
  photoURL?: string;
  isAI: boolean;
  modelDisplayName?: string;
}

interface PendingAI {
  modelId: string;
  nickname: string;
  emoji: string;
  provider?: string;
  /** 이 호출이 시작된 세션 ID — 다른 세션으로 전환해도 알림은 원래 세션에서만 보여야 함 */
  sessionId: string;
  error?: string;
  /** 재시도 시 사용할 원본 호출 컨텍스트 */
  retryContext?: DiscussRequestContext;
  /** Phase 61b: 'verify'면 aiModels에 없는 합성 항목이다 — 재시도 경로가 다르다 */
  kind?: 'discuss' | 'verify';
  /** Phase 61b: 검증 재시도용 */
  verifyKind?: VerifyKind;
  /** Phase 61b: 여러 모델이 함께 도는 작업의 아이콘들(검증 = 1차 Gemini → 2차 Claude) */
  providers?: string[];
}

interface DiscussRequestContext {
  problemContent: string;
  currentTabContent?: string;
  currentTabLabel?: string;
  discussionHistory: Array<{ role: 'human' | 'ai'; nickname: string; content: string }>;
  participantNicknames: string[];
  currentMessage: string;
  /** Phase 61f — 필드별 자리표시자(⟦그림⟧)와 정렬된 그림 URL (서버 DiscussImages와 동일 계약) */
  images?: {
    problem: (string | null)[];
    tab: (string | null)[];
    history: (string | null)[][];
    message: (string | null)[];
  };
}

export default function CommentPanel({
  problemId, ownerUid, tabs, activeTabId, currentUid, canComment,
  mode = 'agent',
  bodyFontSize = 15,
  onClose, onCommentsChange, onInsertGraphBlock,
  onRunVerify, onJumpToBlock, verifyCharCount, onInsertToEditor,
  width = '35em',
}: CommentPanelProps) {
  const commentFontSize = Math.max(9, bodyFontSize - 2);
  const isOwner = currentUid === ownerUid;
  const isCommentsMode = mode === 'comments';

  // ─── 데이터 ───
  const [comments, setComments] = useState<ProblemComment[]>([]);

  /* Phase 61c: 댓글 id → **렌더에 쓰인 마크다운 소스**.
     검증 리포트는 `CommentItem`이 펜스를 뺀 `verify.body`를 EditorPreview에 넘기므로
     여기서도 같은 식을 써야 수식 순번이 맞는다(아래 CommentItem:content와 동일식). */
  const commentSource = useCallback((commentId: string): string | null => {
    const c = comments.find((x) => x.id === commentId);
    if (!c) return null;
    const v = extractVerifyReport(c.content);
    return v ? v.body : c.content;
  }, [comments]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const [aiModels, setAiModels] = useState<AIModelConfig[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  // ─── UI 상태 ───
  // Phase 44: 메인 작성 입력창 세로 높이 드래그 리사이즈 (상단 경계선 = 핸들)
  const [inputHeight, setInputHeight] = useState(120);
  const [inputResizeHover, setInputResizeHover] = useState(false);
  const [inputResizeDragging, setInputResizeDragging] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]); // AI 칩 토글
  const [pendingAI, setPendingAI] = useState<PendingAI[]>([]); // 응답 대기 중
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const sessionSubmittingRef = useRef(false); // 한글 IME / blur 이중 호출 방지
  const messagesScrollRef = useRef<HTMLDivElement>(null); // 메시지 리스트 자동 스크롤
  const mainEditorRef = useRef<CommentEditorHandle>(null); // 답글 버튼 클릭 시 메인 입력창 포커스용
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Phase 42: 이 세션(브라우저 세션) 중 "방금 도착한" 최신 AI 응답 id —
  // 해당 댓글의 첫 그래프만 자동 활성화. 패널 재오픈/페이지 재진입 시엔 비어 있어
  // 모든 그래프가 placeholder로 시작 (GGB CDN 자동 로딩 방지).
  const [freshAiCommentId, setFreshAiCommentId] = useState<string | null>(null);
  // Phase 47: 오너 댓글 제어 토글 (댓글 모드 헤더). 미설정 = true
  const [commentsVisibleFlag, setCommentsVisibleFlag] = useState(true);
  const [commentsWritableFlag, setCommentsWritableFlag] = useState(true);

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

  // ─── Phase 47: 세션 분류 ───
  // 댓글 세션(문항당 1개) / agent(normal) 세션들
  const commentSession = useMemo(
    () => sessions.find((s) => s.type === 'comment') ?? null,
    [sessions],
  );
  const commentSessionId = commentSession?.id ?? null;
  const normalSessions = useMemo(
    () => sessions.filter((s) => s.type === 'normal'),
    [sessions],
  );

  // 댓글 모드: 오너가 패널을 열면 댓글 세션을 멱등 생성 (없을 때 1회)
  const ensureDoneRef = useRef(false);
  useEffect(() => {
    if (ensureDoneRef.current) return;
    if (loading) return;
    if (isCommentsMode && isOwner && !commentSession) {
      ensureDoneRef.current = true;
      ensureCommentSession(problemId, ownerUid)
        .then(() => refreshSessions())
        .catch((e) => console.warn('댓글 세션 생성 실패:', e));
    }
  }, [loading, isCommentsMode, isOwner, commentSession, problemId, ownerUid, refreshSessions]);

  // 댓글 모드 오너: 현재 댓글 제어 플래그 로드 (1회)
  const flagsLoadedRef = useRef(false);
  useEffect(() => {
    if (flagsLoadedRef.current) return;
    if (!isCommentsMode || !isOwner) return;
    flagsLoadedRef.current = true;
    getProblem(problemId).then((p) => {
      setCommentsVisibleFlag(p?.commentsVisible !== false);
      setCommentsWritableFlag(p?.commentsWritable !== false);
    }).catch(() => {});
  }, [isCommentsMode, isOwner, problemId]);

  const toggleCommentsVisible = async () => {
    const next = !commentsVisibleFlag;
    setCommentsVisibleFlag(next);
    try { await setCommentsVisible(problemId, next); }
    catch (e) { setCommentsVisibleFlag(!next); console.error('댓글 보이기 토글 실패:', e); }
  };
  const toggleCommentsWritable = async () => {
    const next = !commentsWritableFlag;
    setCommentsWritableFlag(next);
    try { await setCommentsWritable(problemId, next); }
    catch (e) { setCommentsWritableFlag(!next); console.error('댓글 쓰기 토글 실패:', e); }
  };

  // 초기 1회 자동 선택 — agent 모드만. 첫 normal 세션, 없으면 미선택('')
  const initialSelectionDoneRef = useRef(false);
  useEffect(() => {
    if (initialSelectionDoneRef.current) return;
    if (loading) return;
    if (!isCommentsMode) {
      setActiveSessionId(normalSessions.length > 0 ? normalSessions[0].id : '');
    }
    initialSelectionDoneRef.current = true;
  }, [loading, isCommentsMode, normalSessions]);

  // ─── 필터 (탭 필터 없음 — 문항 전체) ───
  const visibleComments = useMemo(() => {
    if (isCommentsMode) {
      // 댓글 스트림: 댓글 세션 + legacy(null)
      return comments.filter((c) => isCommentStream(c, commentSessionId));
    }
    // agent: 선택된 normal 세션의 메시지만
    return comments.filter((c) => c.discussionSessionId === activeSessionId);
  }, [comments, isCommentsMode, commentSessionId, activeSessionId]);

  const threads = useMemo(() => buildThreads(visibleComments), [visibleComments]);
  const visibleThreads = threads;

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId],
  );
  // 댓글 모드는 AI 비활성. agent 모드에서 선택된 세션이 aiEnabled일 때만.
  const isAISession = !isCommentsMode && !!activeSession && activeSession.aiEnabled;

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
    (c: ProblemComment): DisplayInfo => {
      if (c.authorType === 'ai' && c.modelId) {
        // Phase 61b: 검증 리포트는 env 고정 모델이라 ai_models 문서가 없다 → 이름이 '?'가 된다
        if (c.modelId === 'verify') {
          return { name: '검증', provider: 'verify', isAI: true, modelDisplayName: '정밀 검증' };
        }
        const model = aiModels.find((m) => m.modelId === c.modelId);
        return {
          name: model?.nickname || '?',
          emoji: model?.avatarEmoji,
          provider: model?.provider,
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
    if (!await confirmDialog({
      title: '메시지 삭제', message: '이 메시지를 삭제하시겠습니까?',
      danger: true, confirmLabel: '삭제',
    })) return;
    // Optimistic local update — listener 도착 전이라도 즉시 AI 컨텍스트에서 제외되도록
    // (삭제 직후 새 메시지 전송 시 race condition 차단)
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await deleteComment(problemId, commentId);
      // 성공 — listener가 곧 동일 결과로 동기화
    } catch (err) {
      // 실패 시 롤백
      console.error('메시지 삭제 실패:', err);
      await refreshComments();
      await alertDialog('삭제 실패: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // (구) handleReplySubmit는 인라인 답글 에디터가 제거되어 삭제됨.
  // 답글은 메인 입력창의 handleSendMessage가 replyingTo를 보고 처리한다.

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
      await alertDialog(e instanceof Error ? e.message : '세션 생성 실패');
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
      await alertDialog(e instanceof Error ? e.message : '이름 변경 실패');
    } finally {
      sessionSubmittingRef.current = false;
    }
  };

  const handleDeleteSession = async (s: DiscussionSession) => {
    if (s.type !== 'normal') return;  // 댓글/public 세션은 삭제 불가
    if (!await confirmDialog({
      title: '세션 삭제',
      message: [`세션 "${s.name}"을(를) 삭제하시겠습니까?`,
                '메시지는 그대로 남되, 어느 세션에서도 보이지 않게 됩니다.'],
      danger: true, confirmLabel: '삭제',
    })) return;
    try {
      await deleteSession(problemId, s.id);
      await refreshSessions();
      if (activeSessionId === s.id) {
        const remaining = normalSessions.filter((n) => n.id !== s.id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : '');
      }
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : '세션 삭제 실패');
    }
  };

  // ─── 컨텍스트 조립 (Phase 37-G와 함께 구현 · Phase 61f에서 그림 슬롯 추가) ───
  //  미디어 블록은 URL 문자열 대신 자리표시자(⟦그림⟧)로 —
  //  image는 src를 슬롯에, svg·ggb는 null(서버가 "첨부되지 않음: SVG/GeoGebra"로 렌더, D5).
  //  자리표시자는 늘 비어 있지 않으므로 아래 .filter(Boolean)이 슬롯 정렬을 깨지 못한다.
  const fetchTabBlocksForModel = useCallback(async (
    tabId: string,
  ): Promise<{ text: string; slots: (string | null)[] }> => {
    try {
      const snap = await getDocs(
        query(collection(db, 'problems', problemId, tabSubcollection(tabId)), orderBy('order')),
      );
      const blocks = snap.docs.map((d) => d.data() as Block);
      const slots: (string | null)[] = [];
      const text = blocks
        .map((b) => {
          if (b.type === 'image' || b.type === 'svg' || b.type === 'ggb') {
            const src = b.type === 'image' ? imageSrcOf(b.raw_text || '') : '';
            slots.push(src || null);
            return FIG_PLACEHOLDER;
          }
          const title = b.title ? `### ${b.title}\n` : '';
          return title + (b.raw_text || '');
        })
        .filter(Boolean)
        .join('\n\n');
      return { text, slots };
    } catch (e) {
      console.warn('블록 로드 실패:', tabId, e);
      return { text: '', slots: [] };
    }
  }, [problemId]);

  // Phase 47: agent 컨텍스트 = 문제 탭 + 풀이/extra 탭(들) 전체. 합산 15,000자 상한.
  // question은 보존하고, 초과 시 나머지(풀이/참고)를 뒤에서 자른다.
  const CONTEXT_CHAR_CAP = 15000;
  const buildContext = useCallback(async () => {
    const q = await fetchTabBlocksForModel('question');
    const otherTabs = tabs.filter((t) => t.id !== 'question');
    const parts: string[] = [];
    const tabSlots: (string | null)[] = [];
    for (const t of otherTabs) {
      const r = await fetchTabBlocksForModel(t.id);
      if (r.text) {
        parts.push(`### [${t.label}]\n${r.text}`);
        tabSlots.push(...r.slots);
      }
    }
    let otherContent = parts.join('\n\n');
    const room = Math.max(0, CONTEXT_CHAR_CAP - q.text.length);
    if (otherContent.length > room) {
      otherContent = otherContent.slice(0, room)
        // 반토막 난 자리표시자 잔재 제거 — ⟦는 이 표식 말고는 안 쓰는 글자다
        .replace(/⟦[^⟧]*$/, '');
      console.warn(`[discuss] 컨텍스트 ${CONTEXT_CHAR_CAP}자 상한 초과 — 풀이/참고 탭 일부 잘림`);
    }
    return {
      problemContent: q.text,
      currentTabContent: otherContent || undefined,
      currentTabLabel: otherContent ? '풀이·참고 전체' : undefined,
      problemSlots: q.slots,
      // ⚠ Phase 61f D19 — 번호·첨부는 **자르고 남은** 자리표시자 기준이다. 여기서 슬롯을
      //   함께 자르지 않으면 잘려 나간 그림이 그대로 첨부돼 k 번호가 밀린다(v2 C2).
      tabSlots: tabSlots.slice(0, countPlaceholders(otherContent)),
    };
  }, [fetchTabBlocksForModel, tabs]);

  const buildHistory = useCallback(() => {
    // 최근 5개 메시지 (현재 visible 기준), 답글 제외
    // 추가 방어:
    //  (1) discussionSessionId가 실존 세션(또는 legacy)을 가리키는지 재확인.
    //      visibleComments에서 이미 활성 세션으로 필터되었지만, 명시적 가드를 둬서
    //      삭제된 세션의 orphan 메시지가 미래 코드 변경에서 leak되지 않도록.
    //  (2) handleDelete의 optimistic state update와 함께 race condition을 차단.
    const sessionIdSet = new Set(sessions.map((s) => s.id));
    const tops = visibleComments.filter((c) => {
      if (c.parentCommentId) return false;
      // legacy(세션 미할당) 메시지는 항상 허용
      if (!c.discussionSessionId) return true;
      // 실존 세션만 통과 (삭제된 세션의 orphan 차단)
      return sessionIdSet.has(c.discussionSessionId);
    });
    const recent = tops.slice(-HISTORY_LIMIT);
    // Phase 61f — 히스토리 그림도 자리표시자 + 슬롯으로 (D12-③). stripForHistory가 옛
    // `[그림 k]` 번호를 먼저 지우고, replaceImgTags가 <img>를 ⟦그림⟧으로 바꾼다.
    const slots: (string | null)[][] = [];
    const history = recent.map((c) => {
      const info = getDisplayInfo(c);
      const r = replaceImgTags(stripForHistory(c.content));
      slots.push(r.slots);
      return {
        role: info.isAI ? ('ai' as const) : ('human' as const),
        nickname: info.name,
        content: r.text,
      };
    });
    return { history, slots };
  }, [visibleComments, sessions, getDisplayInfo]);

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
            // Phase 61f — 없으면 필드 자체가 빠져 요청이 기존과 동일하다
            ...(context.images ? { images: context.images } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const newCommentId = await addComment({
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
        // Phase 42: 방금 도착한 응답의 그래프만 자동 활성화 (가장 최근 도착 1개)
        setFreshAiCommentId(newCommentId);
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

    // 쓰기 대상 세션: 댓글 모드 = 댓글 세션(없으면 legacy null), agent = 선택된 세션
    const writeSessionId = isCommentsMode
      ? (commentSessionId ?? undefined)
      : (activeSessionId || undefined);

    // 답글 모드 — parentCommentId 설정 + AI 호출 안 함 (인라인 답글과 동일 의미)
    if (replyingTo) {
      const replyParentId = replyingTo;
      setReplyingTo(null);
      await addComment({
        problemId, tabId: activeTabId, authorUid: currentUid,
        content, parentCommentId: replyParentId,
        authorType: 'human',
        discussionSessionId: writeSessionId,
      });
      await refreshComments();
      return;
    }

    // 1. 댓글 모드: AI 호출 없이 단순 댓글 추가
    if (isCommentsMode) {
      await addComment({
        problemId, tabId: activeTabId, authorUid: currentUid,
        content, parentCommentId: null,
        authorType: 'human',
        discussionSessionId: writeSessionId,
      });
      await refreshComments();
      return;
    }

    // 2. agent 모드 — 세션이 있어야 함
    if (!activeSessionId) {
      await alertDialog('먼저 세션을 만들어 주세요.');
      return;
    }

    // 일반 세션 — AI 호출 가능
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
    const { history, slots: historySlots } = buildHistory();
    const participantNicknames = [myNickname, ...invokedModels.map((m) => m.nickname)];

    // Phase 61f — 방금 쓴 메시지의 <img>도 자리표시자로 (D12-②).
    //   Firestore에는 위에서 원문(content)이 이미 저장됐다 — 여기는 전송용 사본이다.
    const msg = replaceImgTags(content);

    const hasAnyFig = ctx.problemSlots.length > 0 || ctx.tabSlots.length > 0
      || msg.slots.length > 0 || historySlots.some((a) => a.length > 0);

    const baseContext: Omit<DiscussRequestContext, 'currentMessage'> & { currentMessage: string } = {
      problemContent: ctx.problemContent,
      currentTabContent: ctx.currentTabContent,
      currentTabLabel: ctx.currentTabLabel,
      discussionHistory: history,
      participantNicknames,
      currentMessage: msg.text,
      ...(hasAnyFig ? {
        images: {
          problem: ctx.problemSlots,
          tab: ctx.tabSlots,
          history: historySlots,
          message: msg.slots,
        },
      } : {}),
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
        provider: m.provider,
        sessionId: sessionAtSend,
      })),
    ]);

    // 5. 각 AI 호출 — 도착순으로 Firestore 저장
    await Promise.allSettled(
      invokedModels.map((model) => invokeOneAI(model, baseContext, sessionAtSend)),
    );
  };

  // ─── 에러 재시도 ───
  /* ─── Phase 61b: 정밀 검증 실행 ───
     칩·팝오버는 여기, 실제 호출·저장은 EditorView(onRunVerify)가 한다.
     진행/오류 표시는 discuss의 PendingAIBubble을 그대로 재사용한다(합성 항목). */
  /* 칩이 안 보일 때 원인을 알 수 있게 — 게이트 3개 중 무엇이 막았는지 개발 중에만 알린다.
     (조용히 사라지는 UI는 "구현이 안 됐다"와 구별되지 않는다) */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || isCommentsMode) return;
    if (!onRunVerify) {
      console.info('[Phase61b] 검증 칩 숨김: onRunVerify 미전달 (편집 화면 전용)');
    } else if (currentUid !== ownerUid) {
      console.info('[Phase61b] 검증 칩 숨김: 오너가 아님', { currentUid, ownerUid });
    } else if (!isAISession) {
      console.info('[Phase61b] 검증 칩 숨김: AI 세션이 아님 — agent 세션을 만들거나 선택하세요',
        { activeSessionId, aiEnabled: activeSession?.aiEnabled });
    }
  }, [onRunVerify, currentUid, ownerUid, isAISession, isCommentsMode, activeSessionId, activeSession]);

  const runVerify = useCallback(async (kind: VerifyKind, sessionId: string) => {
    if (!onRunVerify) return;
    const modelId = `verify:${kind}`;
    setPendingAI((prev) => [
      ...prev.filter((p) => !(p.modelId === modelId && p.sessionId === sessionId)),
      {
        modelId, sessionId, kind: 'verify', verifyKind: kind,
        nickname: kind === 'problem' ? '문제 검증' : '풀이 검증',
        emoji: '🔍',
        // 1차 Gemini → 2차 Claude. 선택한 AI와 무관하게 env로 고정된 조합이다.
        providers: ['google', 'anthropic'],
      },
    ]);
    /* 검증은 선택한 AI와 **무관하다**(env 고정 모델로 돈다). 칩이 켜진 채로 두면
       "고른 AI로 검증한다"는 오해를 주므로 실행과 함께 선택을 해제한다. */
    setSelectedModelIds([]);
    try {
      await onRunVerify(kind, sessionId);
      await refreshComments();
      setPendingAI((prev) => prev.filter((p) => !(p.modelId === modelId && p.sessionId === sessionId)));
    } catch (err) {
      setPendingAI((prev) =>
        prev.map((p) =>
          p.modelId === modelId && p.sessionId === sessionId
            ? { ...p, error: err instanceof Error ? err.message : '검증 실패' }
            : p,
        ),
      );
    }
  }, [onRunVerify, refreshComments]);

  const handleRetryAI = async (modelId: string, sessionId: string) => {
    const pending = pendingAI.find((p) => p.modelId === modelId && p.sessionId === sessionId);
    if (!pending) return;
    // Phase 61b: 검증 항목은 aiModels에 없다 — 그쪽 경로로 보낸다
    if (pending.kind === 'verify') {
      if (pending.verifyKind) await runVerify(pending.verifyKind, sessionId);
      return;
    }
    if (!pending.retryContext) return;
    const model = aiModels.find((m) => m.modelId === modelId);
    if (!model) return;
    // error 표시 제거, pending 상태로 되돌림
    setPendingAI((prev) =>
      prev.map((p) =>
        p.modelId === modelId && p.sessionId === sessionId
          ? { modelId: p.modelId, nickname: p.nickname, emoji: p.emoji, provider: p.provider, sessionId: p.sessionId }
          : p,
      ),
    );
    await invokeOneAI(model, pending.retryContext, sessionId);
  };

  const handleDismissError = (modelId: string, sessionId: string) => {
    setPendingAI((prev) => prev.filter((p) => !(p.modelId === modelId && p.sessionId === sessionId)));
  };

  // 메인 작성 입력창 상단 경계선 드래그 → 세로 높이 조정 (위로 끌면 커짐). 패널 가로 리사이즈와 동일 방식.
  const handleInputResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    const startY = e.clientY;
    const startH = inputHeight;
    try { el.setPointerCapture(pid); } catch {}
    setInputResizeDragging(true);
    const onMove = (ev: PointerEvent) => {
      const next = startH + (startY - ev.clientY);
      setInputHeight(Math.max(80, Math.min(window.innerHeight * 0.6, next)));
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      try { el.releasePointerCapture(pid); } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setInputResizeDragging(false);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div style={{
      /* 개선묶음 M2(덕수 보완 4) — 드로어는 **떠 있는 카드**다.
         상하좌우 네 변에 여백을 두고 둥근 모서리 + 가장 밝은 바탕 + 그림자.
         (밝기 서열: 사이드바 < 중앙 < 드로어 — 이 서열이 3단 구분의 전부다)
         ⚠ 리사이즈 활성선은 이제 이 카드의 **좌측 경계선**이다 — 여백 때문에 카드 변과
           패널 폭이 어긋나므로, 핸들 offset은 카드 변에 맞춰야 한다. */
      position: 'absolute', top: DRAWER_INSET, right: DRAWER_INSET, bottom: DRAWER_INSET,
      width: width, maxWidth: '90vw',
      background: 'var(--bg-drawer)',
      borderRadius: DRAWER_RADIUS,
      border: DRAWER_BORDER,
      boxShadow: 'var(--drawer-shadow)',
      overflow: 'hidden',
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
        /* 검산 코드(<details>) 등 넓은 블록이 토론창 밖으로 새지 않도록 — 테두리 안에서 가로 스크롤 */
        .comment-body, .comment-body > div { min-width: 0; max-width: 100%; }
        .comment-body details { max-width: 100%; }
        .comment-body pre {
          overflow-x: auto;
          max-width: 100%;
          box-sizing: border-box;
        }
        @keyframes pulse-pending {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
        .pending-ai { animation: pulse-pending 1.4s ease-in-out infinite; }
      `}</style>

      {/* ═══ Phase 61c: 선택 → 삽입/복사 팝업 ═══
           ⚠ 패널 루트의 **직계 자식**이어야 한다 — 메시지 리스트(overflowY:auto) 안에 두면 잘린다.
           팝업 자체는 열람뷰에도 마운트된다([복사]). [편집창에 삽입]만 prop 게이트다. */}
      <SelectionInsertPopup
        scrollRef={messagesScrollRef}
        getSource={commentSource}
        onInsertToEditor={onInsertToEditor}
      />

      {/* ═══ 헤더 ═══ 높이 57px (사이드바 헤더와 정렬) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        minHeight: DRAWER_ROW1_H, boxSizing: 'border-box',   // 중앙 컨텐츠의 첫 가로선(y=57)과 정렬
        borderBottom: '1px solid var(--border-light, #eee)',
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isCommentsMode && <IconComment size={16} />}
          {isCommentsMode ? '댓글' : 'Agent'}
        </div>
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

      {/* ═══ 오너 제어 바 (댓글 모드 전용) — agent 모드의 세션 바와 같은 자리·같은 규격 ═══
            1행은 제목+닫기만 두고 토글은 2행으로 내린다(덕수). 컨테이너 값은
            SessionTabBar와 동일하게 유지할 것 — 두 모드의 행 높이·선·바탕이 갈리면
            패널을 오갈 때 헤더가 흔들린다. */}
      {isCommentsMode && isOwner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px',
          minHeight: 41, boxSizing: 'border-box',
          borderBottom: '1px solid var(--border-light, #eee)',
          background: 'var(--bg-primary, #FAF9F7)',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          <ToggleSwitch label="보이기" on={commentsVisibleFlag} onToggle={toggleCommentsVisible}
            title="멤버에게 댓글 보이기/숨김 (오너는 항상 보임)" />
          <ToggleSwitch label="쓰기 허용" on={commentsWritableFlag} onToggle={toggleCommentsWritable}
            title="멤버 댓글 쓰기 허용/잠금 (오너는 항상 가능)" />
        </div>
      )}

      {/* ═══ 세션 바 (agent 모드 전용) ═══ */}
      {!isCommentsMode && (
      <SessionTabBar
        sessions={normalSessions}
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
      )}

      {/* ═══ 메시지 리스트 ═══ */}
      <div ref={messagesScrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            불러오는 중…
          </div>
        ) : visibleThreads.length === 0 && visiblePendingAI.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {isCommentsMode
              ? '댓글이 없습니다.'
              : !activeSessionId
                ? '세션을 만들어 토론을 시작하세요.'
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
                graphAutoActivate={thread.parent.id === freshAiCommentId}
                onSaveGraphAsBlock={onInsertGraphBlock}
                onJumpToBlock={onJumpToBlock}
                onSetReplying={(id) => {
                  setReplyingTo(id);
                  if (id) {
                    // 메인 입력창에 포커스 이동 (다음 tick에서 안전하게)
                    setTimeout(() => mainEditorRef.current?.focus(), 0);
                  }
                }}
                onSetEditing={setEditingId}
                onEditSubmit={(commentId, content) => handleEdit(commentId, content)}
                onDelete={handleDelete}
              />
            ))}
            {visiblePendingAI.map((p) => (
              <PendingAIBubble
                key={`${p.sessionId}:${p.modelId}`}
                pending={p}
                onRetry={p.error && (p.retryContext || p.kind === 'verify')
                  ? () => handleRetryAI(p.modelId, p.sessionId) : undefined}
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
          background: 'var(--bg-primary, #FAF9F7)',
          position: 'relative',
        }}>
          {/* 입력창 상단 경계선 = 세로 리사이즈 핸들 (전체폭, 패널 헤더 경계선과 길이·위치 정렬) */}
          <div
            onPointerDown={handleInputResizeStart}
            onPointerEnter={() => setInputResizeHover(true)}
            onPointerLeave={() => setInputResizeHover(false)}
            style={{
              position: 'absolute', top: -5, left: 0, right: 0, height: 11,
              cursor: 'row-resize', zIndex: 5,
              display: 'flex', alignItems: 'center',
            }}
          >
            <div style={{
              width: '100%',
              height: (inputResizeHover || inputResizeDragging) ? 2 : 1,
              background: (inputResizeHover || inputResizeDragging) ? 'var(--border-content-active)' : 'var(--border-light, #eee)',
              transition: 'height 0.1s, background 0.1s',
            }} />
          </div>
          {/* 답글 모드 인디케이터 — 메인 입력창 바로 위 */}
          {replyingTo && (() => {
            const target = comments.find((c) => c.id === replyingTo);
            const targetName = target ? getDisplayInfo(target).name : '메시지';
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', marginBottom: 4,
                background: 'var(--bg-hover, #f5f5f5)',
                borderRadius: 4,
                fontSize: 11, color: 'var(--text-muted)',
              }}>
                <span>↳ <b>{targetName}</b>의 메시지에 답글</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setReplyingTo(null)}
                  title="답글 취소"
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            );
          })()}
          <CommentEditor
            ref={mainEditorRef}
            problemId={problemId}
            placeholder=""
            inputHeight={inputHeight}
            onSubmit={handleSendMessage}
            headerLeft={isAISession ? (
              /* ⚠️ AIChipBar는 전폭 <div>다 — fragment로 나란히 두면 검증 칩이 아랫줄로 밀린다.
                    한 줄에 흐르도록 flex 컨테이너로 감싼다. */
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <AIChipBar
                  models={aiModels}
                  selectedIds={selectedModelIds}
                  onToggle={(modelId) =>
                    setSelectedModelIds((prev) =>
                      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
                    )
                  }
                />
                {/* Phase 61b: 검증 칩 — onRunVerify가 있고(편집 화면) 오너일 때만.
                    오너 제한은 정책이 아니라 규칙이 강제한다: AI 댓글 create는 오너만
                    허용되므로(firestore.rules) 비오너는 비용만 쓰고 저장에서 실패한다. */}
                {onRunVerify && currentUid === ownerUid && (
                  <VerifyChips
                    busy={pendingAI.some((p) => p.kind === 'verify' && !p.error)}
                    charCount={verifyCharCount}
                    onRun={(kind) => runVerify(kind, activeSessionId)}
                  />
                )}
              </div>
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
  // Phase 47: agent(normal) 세션만 표시 (댓글/public 세션은 여기 오지 않음)
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
            <AIBrandIcon provider={m.provider} size={14} fallbackEmoji={m.avatarEmoji} />
            <span>{m.nickname}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* VerifyChips (Phase 61b)                                  */
/* ═══════════════════════════════════════════════════════ */

/** agent 컨텍스트와 같은 상한. 초과분을 잘라 검증하면 "검증했다"는 거짓 신호가 남는다 */
const VERIFY_CHAR_CAP = 15_000;

function VerifyChips({
  busy, charCount, onRun,
}: {
  busy: boolean;
  charCount?: (kind: VerifyKind) => number;
  onRun: (kind: VerifyKind) => void;
}) {
  const [confirm, setConfirm] = useState<VerifyKind | null>(null);
  const [tooLong, setTooLong] = useState<number | null>(null);

  const ask = (kind: VerifyKind) => {
    // ⚠ 팝오버를 열기 **전에** 길이를 본다 — 비용 0으로 막을 수 있는 것을 호출 뒤에 알리지 않는다
    const n = charCount ? charCount(kind) : 0;
    if (n > VERIFY_CHAR_CAP) { setTooLong(n); setConfirm(null); return; }
    setTooLong(null);
    setConfirm((prev) => (prev === kind ? null : kind));
  };

  return (
    /* ⚠ 여기에 position:relative를 두면 팝오버의 기준이 "칩 묶음"이 되어, 모델 칩 개수만큼
          오른쪽에서 시작해 250px가 패널 밖으로 넘친다(M1 H). 기준을 컴포저 래퍼(패널 정폭)로
          넘기려고 일부러 비워 둔다 — 그 사이에는 positioned 조상이 없다. */
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {(['problem', 'solution'] as VerifyKind[]).map((kind) => (
        <button
          key={kind}
          onClick={() => ask(kind)}
          disabled={busy}
          title={busy ? '검증이 진행 중입니다' : 'AI 교차검증을 실행합니다 (API 비용 발생)'}
          style={{
            display: 'inline-flex', alignItems: 'center',
            border: `1px solid ${confirm === kind ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
            background: confirm === kind ? 'var(--accent-soft)' : 'transparent',
            color: busy ? 'var(--text-faint)' : 'var(--text-secondary)',
            borderRadius: 12, padding: '2px 8px', fontSize: 11,
            cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-ui)',
            whiteSpace: 'nowrap',
          }}
        >
          {kind === 'problem' ? '문제 검증' : '풀이 검증'}
        </button>
      ))}

      {tooLong !== null && (
        <span style={{ fontSize: 10.5, color: 'var(--accent-danger)' }}>
          문항이 너무 깁니다 — {tooLong.toLocaleString()}자 / {VERIFY_CHAR_CAP.toLocaleString()}자
        </span>
      )}

      {confirm && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          width: 250, padding: 10, borderRadius: 6,
          border: '1px solid var(--border-primary)', background: 'var(--bg-card)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: 8 }}>
            <b style={{ color: 'var(--text-primary)' }}>
              {confirm === 'problem' ? '문제' : '풀이'}
            </b>
            를 두 모델로 교차검증합니다.<br />
            <span style={{ color: 'var(--text-muted)' }}>API 비용이 발생하고 1~2분 걸립니다.</span>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirm(null)}
              style={{
                border: '1px solid var(--border-primary)', background: 'transparent',
                borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
              }}
            >
              취소
            </button>
            <button
              onClick={() => { const k = confirm; setConfirm(null); onRun(k); }}
              style={{
                border: 'none', background: 'var(--accent-primary)', color: '#fff',
                borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
              }}
            >
              실행
            </button>
          </div>
        </div>
      )}
    </span>
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
      {pending.providers && pending.providers.length > 0 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {pending.providers.map((pv, i) => (
            <span key={pv} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>→</span>}
              <AIBrandIcon provider={pv} size={14} fallbackEmoji={pending.emoji} />
            </span>
          ))}
        </span>
      ) : (
        <AIBrandIcon provider={pending.provider} size={16} fallbackEmoji={pending.emoji} />
      )}
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
  onEditSubmit, onDelete,
  graphAutoActivate, onSaveGraphAsBlock, onJumpToBlock,
}: {
  thread: { parent: ProblemComment; replies: ProblemComment[] };
  getDisplayInfo: (c: ProblemComment) => DisplayInfo;
  currentUid: string;
  isOwner: boolean;
  canComment: boolean;
  replyingToId: string | null;
  editingId: string | null;
  onSetReplying: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
  onEditSubmit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  graphAutoActivate?: boolean;
  onSaveGraphAsBlock?: (save: GraphBlockSave) => Promise<string | void>;
  /** Phase 61b: 리포트 지적 → 인용 자리로 이동 */
  onJumpToBlock?: (blockKey: string, quote: string) => void;
}) {
  const { parent, replies } = thread;
  const parentIsAI = parent.authorType === 'ai';
  return (
    <div style={{
      marginBottom: 16,
      padding: 10,
      borderRadius: 8,
      background: parentIsAI ? 'rgba(184,132,92,0.04)' : 'transparent',
      border: parentIsAI ? '1px solid rgba(184,132,92,0.18)' : '1px solid transparent',
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
        graphAutoActivate={graphAutoActivate}
        onSaveGraphAsBlock={onSaveGraphAsBlock}
        onJumpToBlock={onJumpToBlock}
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
            />
          ))}
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
  onEditSubmit, onDelete,
  graphAutoActivate, onSaveGraphAsBlock, onJumpToBlock,
}: {
  comment: ProblemComment;
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
  graphAutoActivate?: boolean;
  onSaveGraphAsBlock?: (save: GraphBlockSave) => Promise<string | void>;
  /** Phase 61b: 리포트 지적 → 인용 자리로 이동 */
  onJumpToBlock?: (blockKey: string, quote: string) => void;
}) {
  const isMine = !info.isAI && comment.authorUid === currentUid;

  /* ─── Phase 61b: 검증 리포트 — 펜스를 카드로 바꿔 그린다.
        `mathory-graph`와 달리 EditorPreview를 거치지 않는다(마크다운이 아니라 구조화 데이터라
        본문 렌더러가 알 이유가 없다). 펜스를 뺀 요약만 EditorPreview로 넘긴다. ─── */
  const verify = info.isAI ? extractVerifyReport(comment.content) : null;

  /* ─── Phase 42: 그래프 내보내기 (블록 저장·GGB 다운로드 — 액션 행 버튼) ─── */
  const hasGraph = info.isAI && comment.content.includes('```mathory-graph');
  const [graphExport, setGraphExport] = useState<GraphExportHandle | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [graphBusy, setGraphBusy] = useState<'save' | 'download' | null>(null);
  const [graphStatus, setGraphStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const saveMenuRef = useRef<HTMLSpanElement>(null);
  const handleRegisterExport = useCallback(
    (h: GraphExportHandle | null) => setGraphExport(h),
    [],
  );

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!saveMenuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setSaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [saveMenuOpen]);

  const flashStatus = (ok: boolean, msg: string) => {
    setGraphStatus({ ok, msg });
    setTimeout(() => setGraphStatus(null), 4000);
  };

  const handleSaveBlock = async (format: GraphBlockFormat) => {
    if (!graphExport || !onSaveGraphAsBlock || graphBusy) return;
    setSaveMenuOpen(false);
    setGraphBusy('save');
    try {
      const save = await graphExport.exportFile(format);
      const tabLabel = await onSaveGraphAsBlock(save);
      flashStatus(true, tabLabel
        ? `"${tabLabel}" 탭에 추가됨 (문제 저장 시 확정)`
        : '블록 추가됨 (문제 저장 시 확정)');
    } catch (err) {
      flashStatus(false, err instanceof Error ? err.message : '저장 실패');
    } finally {
      setGraphBusy(null);
    }
  };

  const handleDownloadGgb = async () => {
    if (!graphExport || graphBusy) return;
    setGraphBusy('download');
    try {
      const { file } = await graphExport.exportFile('ggb');
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      flashStatus(false, err instanceof Error ? err.message : '다운로드 실패');
    } finally {
      setGraphBusy(null);
    }
  };

  return (
    <div style={{ marginBottom: isReply ? 8 : 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {info.isAI ? (
          <div
            title={info.modelDisplayName}
            style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <AIBrandIcon provider={info.provider} size={16} fallbackEmoji={info.emoji} />
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
          <div className={`comment-body ${info.isAI ? 'ai-body' : ''}`} data-comment-id={comment.id}>
            <EditorPreview
              content={verify ? verify.body : comment.content}
              borderless autoHeight locale="ko"
              graphAutoActivate={graphAutoActivate}
              onRegisterGraphExport={hasGraph ? handleRegisterExport : undefined}
            />
            {verify && (
              <VerifyReportCard report={verify.report} onJumpToBlock={onJumpToBlock} />
            )}
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
          {/* Phase 42: 그래프 → 블록 저장 + GGB 다운로드 */}
          {hasGraph && graphExport && onSaveGraphAsBlock && (
            <span ref={saveMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSaveMenuOpen((v) => !v)}
                disabled={graphBusy !== null}
                style={miniLinkStyle}
              >
                {graphBusy === 'save' ? '저장 중…' : '블록으로 저장'}
              </button>
              {saveMenuOpen && (
                <div style={{
                  position: 'absolute', bottom: '140%', left: 0, zIndex: 100,
                  minWidth: 160,
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border-light, #ccc)',
                  borderRadius: 6,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                }}>
                  {([
                    ['ggb', 'GGB 블록 (인터랙티브)'],
                    ['svg', 'SVG 블록 (벡터)'],
                    ['png', 'PNG 블록 (이미지)'],
                  ] as const).map(([format, label]) => (
                    <button
                      key={format}
                      onClick={() => handleSaveBlock(format)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 12px', fontSize: 11,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary, #444)',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </span>
          )}
          {hasGraph && graphExport && (
            <button
              onClick={handleDownloadGgb}
              disabled={graphBusy !== null}
              title="GGB 파일 다운로드"
              style={{ ...miniLinkStyle, display: 'inline-flex', alignItems: 'center' }}
            >
              {graphBusy === 'download' ? '…' : <IconDownload size={14} />}
            </button>
          )}
          {graphStatus && (
            <span style={{
              fontSize: 10,
              color: graphStatus.ok ? '#2a8a3c' : 'var(--accent-danger, #c33)',
            }}>
              {graphStatus.msg}
            </span>
          )}
          {isMine && (
            <>
              <button onClick={() => onSetEditing(true)} style={miniLinkStyle}>수정</button>
              <button onClick={onDelete} style={{ ...miniLinkStyle, color: 'var(--accent-danger)' }}>삭제</button>
            </>
          )}
          {/* AI 메시지: 수정 불가. 삭제는 문제 오너만 (길거나 잘린 답변 정리용, Phase 41) */}
          {info.isAI && isOwner && (
            <button onClick={onDelete} style={{ ...miniLinkStyle, color: 'var(--accent-danger)' }}>삭제</button>
          )}
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
