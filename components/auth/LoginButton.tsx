'use client';

import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';

interface LoginButtonProps {
  user: User | null;
}

export default function LoginButton({ user }: LoginButtonProps) {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('로그인 에러:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: '#333' }}>
          {user.displayName || user.email}
        </span>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 14px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      style={{
        padding: '8px 20px',
        backgroundColor: '#4285f4',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
      }}
    >
      Google로 로그인
    </button>
  );
}