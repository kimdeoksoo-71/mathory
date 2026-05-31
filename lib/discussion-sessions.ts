/**
 * Phase 37-D: 토론 세션 CRUD
 *
 * 세션 구조 (계획서 §1.3):
 *   - 'public' 세션: 공유 문제(Team/Public)에 자동 생성. AI 비활성. 이름변경/삭제 불가.
 *     Phase 37 단독 단계에선 생성하지 않음 — ensurePublicSession()은 시그니처만 정의해두고
 *     실제 호출은 Phase 38에서 공유 문제 생성 훅에 연결.
 *   - 'normal' 세션: 사용자가 + 버튼으로 생성. 이름 필수. AI 활성.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
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
    type: data.type === 'public' ? 'public' : 'normal',
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
 * 공개토론 세션 자동 생성 (Phase 38에서 호출 예정).
 *
 * Phase 37 단독 단계에선 호출하지 않음. 시그니처만 정의.
 * Phase 38에서 폴더 카테고리가 team/public_*로 바뀌는 시점, 또는 그 카테고리에서
 * 문제 생성 시 훅으로 호출하여 멱등하게 생성한다 (이미 있으면 no-op).
 *
 * 보안 규칙상 'public' 타입은 클라이언트에서 직접 쓸 수 없으므로 Phase 38 구현 시
 * Firebase Admin SDK 기반 서버 라우트로 옮긴다.
 *
 * @throws Phase 37 단계에선 의도된 미구현 에러 (실수로 호출되지 않도록)
 */
export async function ensurePublicSession(_problemId: string): Promise<void> {
  throw new Error('ensurePublicSession: Phase 38에서 구현 예정');
}
