/**
 * Phase 37-D: 토론 세션 CRUD
 *
 * 세션 구조 (Phase 47):
 *   - 'comment' 세션: 댓글 스레드. 문항당 1개(ensureCommentSession 멱등). AI 비활성. 오너 생성.
 *   - 'normal' 세션: agent. 사용자가 + 버튼으로 생성. 이름 필수. AI 활성.
 *   - 'public' 세션: Phase 37/38 미구현 잔존. 신규 생성하지 않음.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DiscussionSession } from '../types/problem';

function toDateSafe(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  const obj = v as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
  if (typeof obj.toDate === 'function') return obj.toDate();
  if (typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000 + Math.floor((obj.nanoseconds || 0) / 1e6));
  }
  return new Date();
}

function sessionsCol(problemId: string) {
  return collection(db, 'problems', problemId, 'discussion_sessions');
}

function sessionDoc(problemId: string, sessionId: string) {
  return doc(db, 'problems', problemId, 'discussion_sessions', sessionId);
}

function mapDoc(problemId: string, d: { id: string; data: () => Record<string, unknown> }): DiscussionSession {
  const data = d.data();
  return {
    id: d.id,
    problemId,
    // Phase 51(P3): 'comment' 타입 보존. 과거 버그는 'comment'를 'normal'로 뭉개
    // CommentPanel의 댓글 세션 탐색을 영구 null로 만들고 agent 패널에 유령 카드를 노출시켰다.
    type: data.type === 'comment' ? 'comment'
        : data.type === 'public' ? 'public'
        : 'normal',
    name: String(data.name ?? ''),
    aiEnabled: data.aiEnabled === true,
    createdBy: String(data.createdBy ?? ''),
    createdAt: toDateSafe(data.createdAt),
    updatedAt: toDateSafe(data.updatedAt),
  };
}

/**
 * 일반 토론 세션 생성.
 * @returns 생성된 sessionId
 */
export async function createNormalSession(
  problemId: string,
  name: string,
  createdByUid: string,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('세션 이름이 비어있습니다');
  const ref = await addDoc(sessionsCol(problemId), {
    type: 'normal',
    name: trimmed,
    aiEnabled: true,
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** 일반 세션 이름 변경 (public 세션은 불가 — 보안 규칙이 차단) */
export async function renameSession(
  problemId: string,
  sessionId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('세션 이름이 비어있습니다');
  await updateDoc(sessionDoc(problemId, sessionId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

/** 일반 세션 삭제 (public 세션은 불가) */
export async function deleteSession(problemId: string, sessionId: string): Promise<void> {
  await deleteDoc(sessionDoc(problemId, sessionId));
}

/** 한 문제의 모든 세션 (오래된 순) */
export async function listSessions(problemId: string): Promise<DiscussionSession[]> {
  const snap = await getDocs(query(sessionsCol(problemId), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => mapDoc(problemId, d));
}

/**
 * Phase 47: 댓글 세션(type:'comment') 멱등 생성.
 *
 * 문항당 댓글 스레드는 1개만 존재한다. 이미 있으면 그 id를 반환, 없으면 생성 후 id 반환.
 * 오너만 호출(보안 규칙: type 'comment' create는 isOwnerSess()).
 *
 * @returns 댓글 세션 id
 */
export async function ensureCommentSession(
  problemId: string,
  ownerUid: string,
): Promise<string> {
  const existing = await getDocs(
    query(sessionsCol(problemId), where('type', '==', 'comment'), limit(1)),
  );
  const sid = !existing.empty
    ? existing.docs[0].id
    : (await addDoc(sessionsCol(problemId), {
        type: 'comment',
        name: '댓글',
        aiEnabled: false,
        createdBy: ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })).id;
  // Phase 51(P1): 공개 뷰어가 problem 문서에서 읽도록 commentSessionId 포인터 비정규화(멱등 보정).
  // 순환참조 회피로 firestore.ts의 updateProblem 대신 updateDoc 직접 사용. 실패해도 세션 자체는 유효.
  await updateDoc(doc(db, 'problems', problemId), { commentSessionId: sid }).catch(() => {});
  return sid;
}
