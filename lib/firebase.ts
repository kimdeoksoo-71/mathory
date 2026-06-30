import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
// Phase 52: 지속 로그인 — localStorage 사용. 새 탭/공개 페이지(/p·/shared·/bazaar)에서도
//   로그인 유지(이전 sessionStorage는 새 탭마다 로그아웃). 단일 활성 세션(sessions/{uid})은
//   claim/watch로 유지 — watch 충돌 시 kick(view 리셋)만 하고 signOut은 안 하므로 연쇄 로그아웃 없음.
//   명시적 로그아웃 시에만 전 탭 로그아웃.
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.error('Auth persistence 설정 실패:', e);
  });
}
export const googleProvider = new GoogleAuthProvider();