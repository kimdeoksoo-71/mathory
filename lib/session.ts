'use client';

/**
 * 단일 활성 세션 (Single Active Session)
 *
 * - sessionStorage에 탭별 고유 sessionId 저장 (탭 격리 + F5 보존)
 * - 로그인 시 sessions/{uid} 문서에 자기 sessionId 기록
 * - onSnapshot으로 자기 문서 감시 → 다른 탭이 덮어쓰면 자기 자신을 로그아웃
 */

import {
  doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, Unsubscribe,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';

const SESSION_KEY = 'mathory_session_id';

export function getTabSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function setWithRetry(uid: string, sessionId: string, attempts = 3): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      await setDoc(doc(db, 'sessions', uid), {
        sessionId,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

/** 자기 sessionId로 sessions/{uid} 덮어쓰기. 실패하면 false 반환 */
export async function claimSession(uid: string): Promise<boolean> {
  try {
    const sessionId = getTabSessionId();
    await setWithRetry(uid, sessionId);
    return true;
  } catch (e) {
    console.error('claimSession 실패:', e);
    return false;
  }
}

/** 명시적 로그아웃 시 sessions/{uid} 삭제 */
export async function releaseSession(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'sessions', uid));
  } catch (e) {
    console.error('releaseSession 실패:', e);
  }
}

/** sessions/{uid} 문서 감시. 다른 sessionId가 덮어쓰면 onKicked 호출 후 signOut */
export function watchSession(uid: string, onKicked: () => void): Unsubscribe {
  const mySessionId = getTabSessionId();
  return onSnapshot(
    doc(db, 'sessions', uid),
    (snap) => {
      const data = snap.data();
      // 문서 부재는 무시 (외부 삭제 등 — 다음 로그인이 덮어씀)
      if (!data) return;
      if (data.sessionId !== mySessionId) {
        onKicked();
        signOut(auth).catch((e) => console.error('강제 signOut 실패:', e));
      }
    },
    (err) => console.error('watchSession 오류:', err)
  );
}
