import {
  collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy,
  Timestamp, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Problem, MemberRole, UserProfile } from '../types/problem';

/** 한 번에 보여줄 자동완성 후보 수 상한 */
const SEARCH_LIMIT = 8;

// ═══════════════════════════════════════════════════════
// 사용자 검색 (이메일 prefix 자동완성)
// ═══════════════════════════════════════════════════════

/**
 * 이메일 prefix로 사용자 검색.
 * Firestore의 범위 쿼리: [prefix, prefix + ) — 동일 prefix로 시작하는 모든 문자열
 */
export async function searchUsersByEmailPrefix(prefix: string): Promise<UserProfile[]> {
  const trimmed = prefix.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const q = query(
    collection(db, 'users'),
    where('email', '>=', trimmed),
    where('email', '<', trimmed + ''),
    orderBy('email'),
    limit(SEARCH_LIMIT),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      displayName: data.displayName || '',
      email: data.email || '',
      photoURL: data.photoURL || '',
      createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
    };
  });
}

/** 정확한 이메일 1건 조회 */
export async function lookupUserByEmail(email: string): Promise<UserProfile | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const q = query(collection(db, 'users'), where('email', '==', target), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    uid: d.id,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL || '',
    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
  };
}

// ═══════════════════════════════════════════════════════
// 멤버 관리 (problems 문서의 members 맵 + memberUids 배열 동기 유지)
// ═══════════════════════════════════════════════════════

async function readProblemMembership(problemId: string) {
  const snap = await getDoc(doc(db, 'problems', problemId));
  if (!snap.exists()) throw new Error('문제를 찾을 수 없습니다.');
  const data = snap.data();
  const members: Record<string, MemberRole> = data.members || {};
  const memberUids: string[] = data.memberUids || [];
  return { members, memberUids, ownerUid: data.authorUid as string };
}

export async function addMember(
  problemId: string, targetUid: string, role: MemberRole,
): Promise<void> {
  const { members, memberUids, ownerUid } = await readProblemMembership(problemId);
  if (targetUid === ownerUid) throw new Error('소유자는 멤버로 추가할 수 없습니다.');

  const nextMembers = { ...members, [targetUid]: role };
  const nextUids = memberUids.includes(targetUid) ? memberUids : [...memberUids, targetUid];

  await updateDoc(doc(db, 'problems', problemId), {
    members: nextMembers,
    memberUids: nextUids,
    updated_at: serverTimestamp(),
  });
}

export async function removeMember(problemId: string, targetUid: string): Promise<void> {
  const { members, memberUids } = await readProblemMembership(problemId);

  const nextMembers = { ...members };
  delete nextMembers[targetUid];
  const nextUids = memberUids.filter((u) => u !== targetUid);

  await updateDoc(doc(db, 'problems', problemId), {
    members: nextMembers,
    memberUids: nextUids,
    updated_at: serverTimestamp(),
  });
}

export async function updateMemberRole(
  problemId: string, targetUid: string, role: MemberRole,
): Promise<void> {
  const { members } = await readProblemMembership(problemId);
  if (!(targetUid in members)) throw new Error('멤버가 아닙니다.');
  await updateDoc(doc(db, 'problems', problemId), {
    members: { ...members, [targetUid]: role },
    updated_at: serverTimestamp(),
  });
}

/** 본인이 본인을 멤버에서 빼는 "공유 해제" — removeMember와 동일 동작 (Rules에서 본인 허용) */
export async function leaveAsMember(problemId: string, myUid: string): Promise<void> {
  return removeMember(problemId, myUid);
}

/** 탭 가시성 설정 (오너만, Rules에서 검증) */
export async function setMemberTabVisibility(
  problemId: string, tabVisibility: Record<string, boolean>,
): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    memberTabVisibility: tabVisibility,
    updated_at: serverTimestamp(),
  });
}

// ═══════════════════════════════════════════════════════
// 멤버용 listing
// ═══════════════════════════════════════════════════════

/** 나에게 공유된 문항 — 받은 시각 최신순 정렬은 클라이언트 사이드 (E6) */
export async function listSharedWithMe(uid: string): Promise<Problem[]> {
  const q = query(
    collection(db, 'problems'),
    where('memberUids', 'array-contains', uid),
    orderBy('updated_at', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as Problem;
  });
}

// ═══════════════════════════════════════════════════════
// 권한 헬퍼 (UI에서 분기용)
// ═══════════════════════════════════════════════════════

export function getMemberRole(problem: Problem, uid: string): MemberRole | 'owner' | null {
  if (problem.authorUid === uid) return 'owner';
  const role = problem.members?.[uid];
  return role || null;
}

export function canComment(problem: Problem, uid: string): boolean {
  const role = getMemberRole(problem, uid);
  return role === 'owner' || role === 'commenter';
}

export function canEdit(problem: Problem, uid: string): boolean {
  return getMemberRole(problem, uid) === 'owner';
}

export function isTabVisibleToMembers(problem: Problem, tabId: string): boolean {
  const mtv = problem.memberTabVisibility;
  if (!mtv) return true; // 기본: 모든 탭 공개
  return mtv[tabId] !== false;
}

/** UI에서 현재 사용자에게 보여야 할 탭만 필터링 */
export function visibleTabsForUser(problem: Problem, uid: string) {
  const tabs = problem.tabs || [];
  const role = getMemberRole(problem, uid);
  if (role === 'owner') return tabs; // 오너는 항상 모두
  return tabs.filter((t) => isTabVisibleToMembers(problem, t.id));
}
