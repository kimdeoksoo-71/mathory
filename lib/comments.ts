import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { TabComment } from '../types/problem';

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

function mapDoc(d: any): TabComment {
  const data = d.data();
  return {
    id: d.id,
    tabId: data.tabId,
    authorUid: data.authorUid,
    content: data.content || '',
    parentCommentId: data.parentCommentId ?? null,
    resolved: !!data.resolved,
    createdAt: toDateSafe(data.createdAt),
    updatedAt: toDateSafe(data.updatedAt),
  };
}

export interface AddCommentInput {
  problemId: string;
  tabId: string;
  authorUid: string;
  content: string;
  parentCommentId?: string | null;
}

export async function addComment(input: AddCommentInput): Promise<string> {
  const ref = await addDoc(commentsCol(input.problemId), {
    tabId: input.tabId,
    authorUid: input.authorUid,
    content: input.content,
    parentCommentId: input.parentCommentId ?? null,
    resolved: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** 한 문항의 모든 댓글 (탭 무관). 클라이언트에서 tabId·parentCommentId로 필터 */
export async function listAllComments(problemId: string): Promise<TabComment[]> {
  const snap = await getDocs(query(commentsCol(problemId), orderBy('createdAt', 'asc')));
  return snap.docs.map(mapDoc);
}

/** 특정 탭의 모든 댓글 */
export async function listByTab(problemId: string, tabId: string): Promise<TabComment[]> {
  const snap = await getDocs(
    query(commentsCol(problemId), where('tabId', '==', tabId), orderBy('createdAt', 'asc')),
  );
  return snap.docs.map(mapDoc);
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

/** 탭별 댓글 개수(최상위 + 답글 모두 포함). 미해결만 카운트 옵션 */
export function countByTab(comments: TabComment[], options?: { unresolvedOnly?: boolean }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of comments) {
    if (options?.unresolvedOnly && c.resolved) continue;
    out[c.tabId] = (out[c.tabId] || 0) + 1;
  }
  return out;
}

/** 스레드 빌드: parentCommentId=null인 댓글을 부모로, 나머지를 답글로 묶음 */
export interface CommentThread {
  parent: TabComment;
  replies: TabComment[];
}

export function buildThreads(comments: TabComment[]): CommentThread[] {
  const parents = comments.filter((c) => !c.parentCommentId);
  const replies = comments.filter((c) => c.parentCommentId);
  return parents.map((p) => ({
    parent: p,
    replies: replies
      .filter((r) => r.parentCommentId === p.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  }));
}
