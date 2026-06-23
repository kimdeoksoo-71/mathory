import {
  doc, getDoc, setDoc, runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserProfile } from '../types/problem';
import { getReservedNicknames } from './ai-models';

const DEFAULT_NICKNAME = 'KDS';
const NICKNAME_MAX_LENGTH = 20;

// 닉네임/문서 ID에 쓸 수 없는 문자: / \ . # $ [ ] 및 제어문자
const NICK_BAD = /[\/\\.#$\[\]\u0000-\u001f]/;

/** 검색·유일성 정규화 키 */
function normalizeNickname(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Firebase Auth User → Firestore users/{uid} 문서로 upsert.
 * - 최초 로그인 시 createdAt 자동 기록 + nickname 기본값 'KDS' + nickname_lower 'kds'
 * - 이후 로그인에는 displayName/email/photoURL만 갱신 (nickname 보존),
 *   단 nickname_lower가 없으면 백필 (Phase 48 자연 마이그레이션)
 * - 'KDS'는 공유 기본값이므로 nicknames/{lower} 예약 문서를 만들지 않는다.
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
      nickname_lower: normalizeNickname(DEFAULT_NICKNAME),
      createdAt: serverTimestamp(),
    });
  } else {
    // 기존 사용자 — nickname 보존, 없을 경우 백필
    const existing = snap.data();
    const patch: Record<string, unknown> = { ...base };
    const nickname: string = existing.nickname || DEFAULT_NICKNAME;
    if (!existing.nickname) patch.nickname = nickname;
    if (!existing.nickname_lower) patch.nickname_lower = normalizeNickname(nickname);
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
    nickname_lower: typeof data.nickname_lower === 'string' ? data.nickname_lower : undefined,
  };
}

/**
 * 닉네임 설정 진입 가드가 필요한지 — 기본값('KDS')이거나 정규화 키가 없을 때.
 * (소프트 넛지: Phase 48 §4)
 */
export function needsNicknameSetup(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (!profile.nickname_lower) return true;
  return profile.nickname === DEFAULT_NICKNAME;
}

/**
 * 사용자 닉네임 변경 — 전역 유일 강제 (Phase 48).
 *
 * 검증:
 * - 빈 값/공백만 불가
 * - 길이 20자 이하
 * - 사용 불가 문자(/ \ . # $ [ ] 제어문자) 불가
 * - AI 예약 닉네임(ai_models.nickname 전체)과 정확히 일치 시 거부
 * - 트랜잭션으로 nicknames/{lower} 예약 문서를 교체해 전역 유일성을 원자적으로 보장
 *
 * @throws Error 검증/충돌 실패 시 사용자에게 보여줄 메시지
 */
export async function updateNickname(uid: string, raw: string): Promise<void> {
  const nickname = raw.trim();
  if (!nickname) throw new Error('닉네임을 입력해주세요.');
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    throw new Error(`닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`);
  }
  if (NICK_BAD.test(nickname)) {
    throw new Error('닉네임에 사용할 수 없는 문자가 포함되어 있습니다.');
  }

  const reserved = await getReservedNicknames();
  if (reserved.includes(nickname)) {
    throw new Error(`'${nickname}'은 AI 토론자 이름이라 사용할 수 없습니다.`);
  }

  const lower = normalizeNickname(nickname);

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid);
    const newResRef = doc(db, 'nicknames', lower);

    // 트랜잭션: 모든 read를 write보다 먼저 수행
    const newResSnap = await tx.get(newResRef);
    if (newResSnap.exists() && newResSnap.data().uid !== uid) {
      throw new Error('이미 사용 중인 닉네임입니다.');
    }

    const userSnap = await tx.get(userRef);
    const oldLower: string | undefined = userSnap.data()?.nickname_lower;

    if (oldLower && oldLower !== lower) {
      tx.delete(doc(db, 'nicknames', oldLower)); // 옛 예약 해제
    }
    tx.set(newResRef, { uid });
    tx.update(userRef, { nickname, nickname_lower: lower });
  });
}
