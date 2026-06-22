import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { ProblemComment, AIUsage, DiscussionSession } from '../types/problem';

function toDateSafe(v: any, fallback?: Date): Date {
  if (!v) return fallback || new Date();
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6));
  }
  return fallback || new Date();
}

function commentsCol(problemId: string) {
  return collection(db, 'problems', problemId, 'tab_comments');
}

function commentDoc(problemId: string, commentId: string) {
  return doc(db, 'problems', problemId, 'tab_comments', commentId);
}

function mapDoc(d: any): ProblemComment {
  const data = d.data();
  const aiUsage: AIUsage | undefined = data.aiUsage
    ? {
        inputTokens: Number(data.aiUsage.inputTokens ?? 0),
        outputTokens: Number(data.aiUsage.outputTokens ?? 0),
        costUsd: Number(data.aiUsage.costUsd ?? 0),
      }
    : undefined;
  return {
    id: d.id,
    tabId: data.tabId,
    authorUid: data.authorUid,
    content: data.content || '',
    parentCommentId: data.parentCommentId ?? null,
    resolved: !!data.resolved,
    createdAt: toDateSafe(data.createdAt),
    updatedAt: toDateSafe(data.updatedAt),
    // Phase 37: AI 토론
    authorType: data.authorType === 'ai' ? 'ai' : 'human',
    modelId: typeof data.modelId === 'string' ? data.modelId : undefined,
    discussionSessionId:
      typeof data.discussionSessionId === 'string' ? data.discussionSessionId : undefined,
    invokedModelIds: Array.isArray(data.invokedModelIds) ? data.invokedModelIds : undefined,
    aiUsage,
  };
}

export interface AddCommentInput {
  problemId: string;
  tabId: string;
  authorUid: string;
  content: string;
  parentCommentId?: string | null;
  // Phase 37: AI 토론
  authorType?: 'human' | 'ai';
  modelId?: string;
  discussionSessionId?: string;
  invokedModelIds?: string[];
  aiUsage?: AIUsage;
}

export async function addComment(input: AddCommentInput): Promise<string> {
  const payload: Record<string, unknown> = {
    tabId: input.tabId,
    authorUid: input.authorUid,
    authorType: input.authorType ?? 'human',
    content: input.content,
    parentCommentId: input.parentCommentId ?? null,
    resolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.modelId) payload.modelId = input.modelId;
  if (input.discussionSessionId) payload.discussionSessionId = input.discussionSessionId;
  if (input.invokedModelIds && input.invokedModelIds.length > 0) {
    payload.invokedModelIds = input.invokedModelIds;
  }
  if (input.aiUsage) payload.aiUsage = input.aiUsage;
  const ref = await addDoc(commentsCol(input.problemId), payload);
  return ref.id;
}

/** 한 문항의 모든 댓글 (탭 무관). 클라이언트에서 tabId·parentCommentId로 필터 */
export async function listAllComments(problemId: string): Promise<ProblemComment[]> {
  const snap = await getDocs(query(commentsCol(problemId), orderBy('createdAt', 'asc')));
  return snap.docs.map(mapDoc);
}

/**
 * 한 문항의 모든 댓글에 대한 실시간 구독.
 * 백그라운드에서 도착하는 AI 응답·다른 클라이언트의 새 메시지가
 * 자동으로 callback에 흘러들어옴.
 * @returns 구독 해제 함수
 */
export function watchAllComments(
  problemId: string,
  callback: (comments: ProblemComment[]) => void,
): () => void {
  const q = query(commentsCol(problemId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapDoc)),
    (err) => console.error('[comments] 실시간 구독 오류:', err),
  );
}

export async function editCommentContent(
  problemId: string, commentId: string, content: string,
): Promise<void> {
  await updateDoc(commentDoc(problemId, commentId), {
    content,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleResolved(
  problemId: string, commentId: string, resolved: boolean,
): Promise<void> {
  await updateDoc(commentDoc(problemId, commentId), {
    resolved,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteComment(problemId: string, commentId: string): Promise<void> {
  await deleteDoc(commentDoc(problemId, commentId));
}

/**
 * Phase 47: 댓글 스트림에 속하는지 — 댓글 세션(sid==commentSessionId) 또는 legacy(sid==null).
 * 그 외(agent/normal 세션 id)는 agent 스트림.
 */
export function isCommentStream(c: ProblemComment, commentSessionId: string | null): boolean {
  const sid = c.discussionSessionId ?? null;
  return sid === null || sid === commentSessionId;
}

/** 문항 전체 댓글 수(댓글 스트림: 댓글 세션 + legacy). 최상위+답글 포함, 미해결만 옵션 */
export function countComments(
  comments: ProblemComment[],
  commentSessionId: string | null,
  options?: { unresolvedOnly?: boolean },
): number {
  let n = 0;
  for (const c of comments) {
    if (!isCommentStream(c, commentSessionId)) continue;
    if (options?.unresolvedOnly && c.resolved) continue;
    n++;
  }
  return n;
}

/** agent 세션(대화) 개수 = type 'normal' 세션 수 */
export function countAgentSessions(sessions: DiscussionSession[]): number {
  return sessions.filter((s) => s.type === 'normal').length;
}

/**
 * @deprecated Phase 47: 탭별 댓글 개수. 문항 단위 전환으로 폐기 예정.
 * UI(per-tab 💬 버튼) 제거 시 countComments로 대체하고 삭제한다.
 */
export function countByTab(comments: ProblemComment[], options?: { unresolvedOnly?: boolean }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of comments) {
    if (options?.unresolvedOnly && c.resolved) continue;
    out[c.tabId] = (out[c.tabId] || 0) + 1;
  }
  return out;
}

/** 스레드 빌드: parentCommentId=null인 댓글을 부모로, 나머지를 답글로 묶음 */
export interface CommentThread {
  parent: ProblemComment;
  replies: ProblemComment[];
}

export function buildThreads(comments: ProblemComment[]): CommentThread[] {
  const parents = comments.filter((c) => !c.parentCommentId);
  const replies = comments.filter((c) => c.parentCommentId);
  return parents.map((p) => ({
    parent: p,
    replies: replies
      .filter((r) => r.parentCommentId === p.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  }));
}
