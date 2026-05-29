import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, browserSessionPersistence, setPersistence } from 'firebase/auth';

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
// Phase 35: 탭 단위 인증 격리 (단일 활성 세션의 전제)
// — IndexedDB 공유 대신 sessionStorage 사용 → 한 탭의 signOut이 다른 탭에 영향 X
// — F5 시에는 유지, 탭 종료/브라우저 재시작 시 재로그인 필요
if (typeof window !== 'undefined') {
  setPersistence(auth, browserSessionPersistence).catch((e) => {
    console.error('Auth persistence 설정 실패:', e);
  });
}
export const googleProvider = new GoogleAuthProvider();