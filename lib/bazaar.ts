// Phase 52: Bazaar 공용 광장 — 게시물 CRUD + 태그 정규화 + cascade.
//   "광장 게시"는 공개(visibility)와 별개의 명시적 등록(C1). bazaar_posts 컬렉션.
//   규칙(firestore.rules §4-1)은 본인 소유·형태·F1(live=public)만 강제 — 개수 제한·닉네임
//   게이트는 클라에서 보장(R3·B3). 비정규화 필드(닉네임·제목)는 게시 시점 스냅샷(R4·R8).

import {
  collection, doc, addDoc, getDocs, deleteDoc, updateDoc,
  query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { BazaarPost, BazaarMode } from '../types/problem';
import { getProblem } from './firestore';
import { getUserProfile, needsNicknameSetup } from './users';
import { ensureCommentSession } from './discussion-sessions';

// ── 태그 정규화 (단일 출처) ──
const TAG_MAX_LEN = 20;
const TAG_MAX_COUNT = 10;

/** '#' 제거·trim·소문자. 길이 제한. 빈 문자열이면 null. */
export function normalizeTag(raw: string): string | null {
  const t = raw.replace(/^#+/, '').trim().toLowerCase().slice(0, TAG_MAX_LEN);
  return t.length > 0 ? t : null;
}

/** "#a #b, c" → ['a','b','c'] (공백·쉼표 분리, 빈값·중복 제거, 최대 10개) */
export function parseTagInput(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    const t = normalizeTag(piece);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= TAG_MAX_COUNT) break;
  }
  return out;
}

function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}

function mapBazaarDoc(id: string, data: any): BazaarPost {
  return {
    id,
    mode: data.mode,
    problemId: data.problemId,
    shareId: data.shareId,
    ownerUid: data.ownerUid,
    authorNickname: data.authorNickname || '',
    authorNickname_lower: data.authorNickname_lower || '',
    title: data.title || '',
    title_lower: data.title_lower || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: toDateOrNull(data.createdAt) || new Date(),
    expiresAt: toDateOrNull(data.expiresAt),
  };
}

/** 한 문항의 모든 게시물(라우팅·중복검사·등록 상태 표시용). createdAt 내림차순 클라 정렬. */
export async function listBazaarPostsByProblem(problemId: string): Promise<BazaarPost[]> {
  const snap = await getDocs(
    query(collection(db, 'bazaar_posts'), where('problemId', '==', problemId)),
  );
  return snap.docs
    .map((d) => mapBazaarDoc(d.id, d.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** 개수 제한 검사용(R3). 규칙 강제 불가라 클라에서 셈. */
export async function countOwnerPosts(problemId: string, mode: BazaarMode): Promise<number> {
  const posts = await listBazaarPostsByProblem(problemId);
  return posts.filter((p) => p.mode === mode).length;
}

export interface CreateBazaarPostInput {
  mode: BazaarMode;
  problemId: string;
  ownerUid: string;
  tags: string[];
  shareId?: string;            // snapshot 전용
  expiresAt?: Date | null;     // snapshot 전용(share.expiresAt 동기화)
}

/**
 * 광장 게시. 본인 소유·닉네임 보유·개수 제한을 클라에서 선검사.
 * live는 게시 전 ensureCommentSession 호출(§6-2 load-bearing: 공개 댓글 작성이 commentSessionId 요구).
 */
export async function createBazaarPost(input: CreateBazaarPostInput): Promise<BazaarPost> {
  const { mode, problemId, ownerUid, shareId } = input;

  // B3: 닉네임 게이트 — 미설정/기본값이면 게시 차단.
  const profile = await getUserProfile(ownerUid);
  if (needsNicknameSetup(profile)) {
    throw new Error('Bazaar 게시에는 닉네임이 필요합니다. 설정에서 닉네임을 먼저 지정해주세요.');
  }
  const problem = await getProblem(problemId);
  if (!problem) throw new Error('문항을 찾을 수 없습니다.');
  if (problem.authorUid !== ownerUid) throw new Error('본인 소유 문항만 게시할 수 있습니다.');

  // 개수 제한(R3): live 1 / snapshot 2.
  const existing = await listBazaarPostsByProblem(problemId);
  if (mode === 'live') {
    if (existing.some((p) => p.mode === 'live')) {
      throw new Error('이미 실시간으로 게시된 문항입니다.');
    }
    // §6-2: 공개 댓글 작성 규칙이 commentSessionId를 요구 → 게시 전 세션 보장(멱등).
    await ensureCommentSession(problemId, ownerUid).catch(() => {});
  } else {
    if (!shareId) throw new Error('스냅샷 게시에는 shareId가 필요합니다.');
    if (existing.filter((p) => p.mode === 'snapshot').length >= 2) {
      throw new Error('스냅샷은 문항당 2개까지 게시할 수 있습니다.');
    }
  }

  const nickname = profile?.nickname || '';
  const nickname_lower = profile?.nickname_lower || nickname.toLowerCase();
  const title = problem.title || '';
  const title_lower = title.trim().toLowerCase();
  const tags = input.tags.slice(0, TAG_MAX_COUNT);
  const expiresAt = mode === 'snapshot' && input.expiresAt ? input.expiresAt : null;

  const payload: Record<string, any> = {
    mode, problemId, ownerUid,
    authorNickname: nickname,
    authorNickname_lower: nickname_lower,
    title, title_lower, tags,
    createdAt: serverTimestamp(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
  };
  if (mode === 'snapshot') payload.shareId = shareId;

  const ref = await addDoc(collection(db, 'bazaar_posts'), payload);
  return {
    id: ref.id, mode, problemId, ownerUid,
    authorNickname: nickname, authorNickname_lower: nickname_lower,
    title, title_lower, tags, createdAt: new Date(),
    ...(mode === 'snapshot' ? { shareId, expiresAt } : { expiresAt: null }),
  };
}

export async function deleteBazaarPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'bazaar_posts', postId));
}

/** 사후 태그 편집(규칙: tags/title/title_lower만 허용). */
export async function updateBazaarTags(postId: string, tags: string[]): Promise<void> {
  await updateDoc(doc(db, 'bazaar_posts', postId), { tags: tags.slice(0, TAG_MAX_COUNT) });
}

/**
 * D2: 공개 해제·share revoke·문항 삭제 시 관련 게시물 best-effort 삭제(고아 방지).
 *   opts 없으면 해당 문항 전체. mode/shareId로 좁힘.
 *   (피드 join-check 폴백은 4단계 BazaarView에서.)
 */
export async function cascadeOnUnpublish(
  problemId: string,
  opts?: { mode?: BazaarMode; shareId?: string },
): Promise<void> {
  const posts = await listBazaarPostsByProblem(problemId).catch(() => [] as BazaarPost[]);
  const targets = posts.filter((p) => {
    if (opts?.mode && p.mode !== opts.mode) return false;
    if (opts?.shareId && p.shareId !== opts.shareId) return false;
    return true;
  });
  await Promise.all(targets.map((p) => deleteBazaarPost(p.id).catch(() => {})));
}
