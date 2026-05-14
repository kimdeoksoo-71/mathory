'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { upsertUserProfile } from '../lib/users';

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // Stage 0: users/{uid} 프로필 자동 upsert (실패는 조용히 무시 — 로그인 자체는 계속)
        upsertUserProfile(u).catch((err) => {
          console.error('users 프로필 upsert 실패:', err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}