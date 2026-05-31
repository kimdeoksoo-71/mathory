import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserProfile } from '../types/problem';
import { getReservedNicknames } from './ai-models';

const DEFAULT_NICKNAME = 'KDS';
const NICKNAME_MAX_LENGTH = 20;

/**
 * Firebase Auth User → Firestore users/{uid} 문서로 upsert.
 * - 최초 로그인 시 createdAt 자동 기록 + nickname 기본값 'KDS' 부여
 * - 이후 로그인에는 displayName/email/photoURL만 갱신 (nickname 보존)
 */
export async function upsertUserProfile(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  const base = {
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...base,
      nickname: DEFAULT_NICKNAME,
      createdAt: serverTimestamp(),
    });
  } else {
    // 기존 사용자 — nickname 보존, 없을 경우 백필
    const existing = snap.data();
    const patch: Record<string, unknown> = { ...base };
    if (!existing.nickname) patch.nickname = DEFAULT_NICKNAME;
    await setDoc(userRef, patch, { merge: true });
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL || '',
    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
    nickname: typeof data.nickname === 'string' ? data.nickname : undefined,
  };
}

/**
 * 사용자 닉네임 변경.
 *
 * 검증:
 * - 빈 값/공백만 불가
 * - 길이 20자 이하
 * - AI 예약 닉네임(ai_models.nickname 전체)과 정확히 일치 시 거부
 *
 * @throws Error 검증 실패 시 사용자에게 보여줄 메시지
 */
export async function updateNickname(uid: string, raw: string): Promise<void> {
  const nickname = raw.trim();
  if (!nickname) throw new Error('닉네임을 입력해주세요.');
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    throw new Error(`닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`);
  }

  const reserved = await getReservedNicknames();
  if (reserved.includes(nickname)) {
    throw new Error(`'${nickname}'은 AI 토론자 이름이라 사용할 수 없습니다.`);
  }

  await updateDoc(doc(db, 'users', uid), { nickname });
}
