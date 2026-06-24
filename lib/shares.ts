import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { customAlphabet } from 'nanoid';
import { db } from './firebase';
import {
  Share, ShareTabVisibility, ProblemWithBlocks, Block, TabMeta, UserProfile,
} from '../types/problem';
import { getProblemWithBlocks } from './firestore';
import { getUserProfile } from './users';

const SHARE_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const generateShareId = customAlphabet(SHARE_ID_ALPHABET, 12);

export const DEFAULT_EXPIRY_HOURS = 72;
export const MAX_EXPIRY_DAYS = 30;

// Phase 50: 웹에 공개 만료 프리셋 (일 단위, null = 무기한), 기본 무기한
export const EXPIRY_PRESET_DAYS: (number | null)[] = [3, 7, 30, null];
export const DEFAULT_EXPIRY_DAYS: number | null = null;

/** Firestore Timestamp / 플레인 {seconds,nanoseconds} / Date / null 모두 안전하게 Date로 변환 */
function toDateSafe(v: any, fallback?: Date): Date {
  if (!v) return fallback || new Date();
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6));
  }
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return fallback || new Date();
}

/** 만료 시각이 null이거나 undefined이면 null 반환, 아니면 Date로 변환 */
function toDateOrNull(v: any): Date | null {
  if (v === null || v === undefined) return null;
  return toDateSafe(v);
}

/** Firestore share 문서 → ShareWithSnapshot (getShare/getShareByProblem/listSharesByOwner 공용) */
function mapShareDoc(id: string, data: any): ShareWithSnapshot {
  return {
    id,
    problemId: data.problemId,
    ownerUid: data.ownerUid,
    createdAt: toDateSafe(data.createdAt),
    expiresAt: toDateOrNull(data.expiresAt),
    tabVisibility: data.tabVisibility || {},
    snapshot: data.snapshot || { title: '', tabs: [], tabBlocks: {} },
    ownerDisplayName: data.ownerDisplayName || '',
    ownerPhotoURL: data.ownerPhotoURL || '',
  };
}

// 공유 문서에 저장하는 스냅샷 — 뷰어가 읽는 데이터 원천 (P7: 비로그인도 접근 가능)
export interface ShareSnapshot {
  title: string;
  subject?: string;
  category?: string;
  year?: number;
  exam_type?: string;
  difficulty?: number;
  tags?: string[];
  source?: string;
  answer?: string;
  tabs: TabMeta[];
  // 탭별 블록 (Firestore의 nested 객체 형태로 저장)
  tabBlocks: Record<string, Block[]>;
}

export interface ShareWithSnapshot extends Share {
  snapshot: ShareSnapshot;
  ownerDisplayName: string;
  ownerPhotoURL: string;
}

export interface CreateShareInput {
  problemId: string;
  ownerUid: string;
  expiryHours: number | null;   // null = 무기한
  tabVisibility: ShareTabVisibility;
}

function pickSnapshot(problem: ProblemWithBlocks): ShareSnapshot {
  const snap: ShareSnapshot = {
    title: problem.title,
    tabs: problem.tabs || [],
    tabBlocks: problem.tabBlocks || {},
  };
  if (problem.subject !== undefined) snap.subject = problem.subject;
  if (problem.category !== undefined) snap.category = problem.category;
  if (problem.year !== undefined) snap.year = problem.year;
  if (problem.exam_type !== undefined) snap.exam_type = problem.exam_type;
  if (problem.difficulty !== undefined) snap.difficulty = problem.difficulty;
  if (problem.tags !== undefined) snap.tags = problem.tags;
  if (problem.source !== undefined) snap.source = problem.source;
  if (problem.answer !== undefined) snap.answer = problem.answer;
  return snap;
}

/** Firestore는 undefined를 거부 + nested map 내부도 마찬가지 → 재귀 제거 */
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefinedDeep(v)) as any;
  }
  if (typeof value === 'object') {
    const out: any = {};
    for (const k in value as any) {
      const v = (value as any)[k];
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

export async function createShare(input: CreateShareInput): Promise<ShareWithSnapshot> {
  const problem = await getProblemWithBlocks(input.problemId);
  if (!problem) throw new Error('문제를 찾을 수 없습니다.');
  if (problem.authorUid !== input.ownerUid) {
    throw new Error('본인 소유 문제만 공유할 수 있습니다.');
  }

  const ownerProfile = await getUserProfile(input.ownerUid);

  const shareId = generateShareId();
  const now = new Date();
  const expiresAt: Date | null = input.expiryHours == null
    ? null
    : new Date(now.getTime() + input.expiryHours * 60 * 60 * 1000);
  const snapshot = stripUndefinedDeep(pickSnapshot(problem));

  const ref = doc(db, 'shares', shareId);
  await setDoc(ref, stripUndefinedDeep({
    problemId: input.problemId,
    ownerUid: input.ownerUid,
    tabVisibility: input.tabVisibility,
    createdAt: serverTimestamp(),
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    snapshot,
    ownerDisplayName: ownerProfile?.displayName || '',
    ownerPhotoURL: ownerProfile?.photoURL || '',
  }));

  return {
    id: shareId,
    problemId: input.problemId,
    ownerUid: input.ownerUid,
    createdAt: now,
    expiresAt,
    tabVisibility: input.tabVisibility,
    snapshot,
    ownerDisplayName: ownerProfile?.displayName || '',
    ownerPhotoURL: ownerProfile?.photoURL || '',
  };
}

export async function getShare(shareId: string): Promise<ShareWithSnapshot | null> {
  const snap = await getDoc(doc(db, 'shares', shareId));
  if (!snap.exists()) return null;
  return mapShareDoc(snap.id, snap.data());
}

/** Phase 50: 내가 웹 공개한 share 목록 (createdAt 내림차순, 클라 정렬 — 인덱스 회피) */
export async function listSharesByOwner(uid: string): Promise<ShareWithSnapshot[]> {
  const snap = await getDocs(query(collection(db, 'shares'), where('ownerUid', '==', uid)));
  return snap.docs
    .map((d) => mapShareDoc(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
}

export async function revokeShare(shareId: string): Promise<void> {
  await deleteDoc(doc(db, 'shares', shareId));
}

export function isShareExpired(share: Share, now: Date = new Date()): boolean {
  if (share.expiresAt === null) return false; // 무기한
  return share.expiresAt.getTime() <= now.getTime();
}

/** 단일 공유 정책(P1-a): 해당 problem의 기존 공유 1건 조회 */
export async function getShareByProblem(
  problemId: string, ownerUid: string,
): Promise<ShareWithSnapshot | null> {
  const q = query(
    collection(db, 'shares'),
    where('problemId', '==', problemId),
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapShareDoc(d.id, d.data());
}
