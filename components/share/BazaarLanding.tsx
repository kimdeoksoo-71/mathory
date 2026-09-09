'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import useAuth from '../../hooks/useAuth';
import { auth, googleProvider } from '../../lib/firebase';
import BazaarView from './BazaarView';
import MiniShell, { miniShellSubRowStyle } from '../layout/MiniShell';
import ResponsiveShell from '../layout/ResponsiveShell';
import PhoneShell from '../layout/PhoneShell';
import PhoneBazaar from '../phone/PhoneBazaar';

/**
 * Phase 52(D1~D5): 공개 Bazaar 랜딩 (`/bazaar`) — Phase 64 F-1에서 page.tsx의
 * 클라이언트 본문을 이 파일로 추출했다(page.tsx는 headers()를 읽는 서버 컴포넌트).
 * - 비로그인 데스크톱: MiniShell(공유 > Bazaar > 전체) + 전역 피드. 현행 그대로.
 * - 비로그인 폰: PhoneShell(워드마크·로그인) + PhoneBazaar (Phase 64 §6-5).
 * - 로그인: 풀 앱(`/?view=bazaar`)으로 리다이렉트 — 셸 무관 공통.
 */
export default function BazaarLanding({ initialPhone }: { initialPhone: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  // 로그인 사용자는 풀 앱으로
  useEffect(() => {
    if (!loading && user) router.replace('/?view=bazaar');
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #888)', fontFamily: 'var(--font-ui, sans-serif)', fontSize: 14 }}>
        이동 중…
      </div>
    );
  }

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch { /* 취소 무시 */ }
  };

  return (
    <ResponsiveShell
      initialPhone={initialPhone}
      desktop={
        <MiniShell
          active="bazaar"
          sidebarExtra={
            // 비로그인 랜딩이라 '내 게시물'(로그인 필요)은 노출되지 않음
            <button onClick={() => setFilter('all')} style={miniShellSubRowStyle(filter === 'all')}>전체</button>
          }
        >
          <BazaarView uid={user?.uid ?? ''} filter={filter} />
        </MiniShell>
      }
      phone={
        <PhoneShell
          left="wordmark"
          right={
            <button
              onClick={handleLogin}
              style={{
                height: 34, padding: '0 14px', border: '1px solid var(--border-light, #ddd)',
                borderRadius: 8, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)', flexShrink: 0,
              }}
            >
              로그인
            </button>
          }
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, padding: '14px 12px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Bazaar
          </h2>
          <PhoneBazaar uid="" />
        </PhoneShell>
      }
    />
  );
}
