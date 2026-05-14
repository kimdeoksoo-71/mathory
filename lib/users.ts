import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserProfile } from '../types/problem';

/**
 * Firebase Auth User → Firestore users/{uid} 문서로 upsert.
 * 최초 로그인 시 createdAt 자동 기록. 이후 로그인에는 displayName/email/photoURL만 갱신.
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
    await setDoc(userRef, { ...base, createdAt: serverTimestamp() });
  } else {
    await setDoc(userRef, base, { merge: true });
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
  };
}
