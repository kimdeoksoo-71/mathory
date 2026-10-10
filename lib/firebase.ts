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
//   로그인 유지(이전 sessionStorage는 새 탭마다 로그아웃).
// 단일 활성 세션(lib/session — sessions/{uid})은 **AppShell만** claim/watch한다. 다른 탭·기기가 claim하면
//   watch가 kick(홈으로) 뒤 **signOut한다**(session.ts watchSession — Phase 69에서 옛 "signOut 안 함" 서술 정정).
//   공개 라우트(/p·/shared·/bazaar)·폰 셸·iPad 필기 패드(/ink)는 claim하지 않으므로 데스크톱과 공존한다.
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((e) => {
    console.error('Auth persistence 설정 실패:', e);
  });
}
export const googleProvider = new GoogleAuthProvider();