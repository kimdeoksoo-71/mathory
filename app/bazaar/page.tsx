'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';
import BazaarView from '../../components/share/BazaarView';
import MiniShell, { miniShellSubRowStyle } from '../../components/layout/MiniShell';

/**
 * Phase 52(D1~D5): 공개 Bazaar 랜딩 (`/bazaar`).
 * - 비로그인: MiniShell(공유 > Bazaar > 전체) + 전역 피드. bazaar_posts read=public(D1).
 * - 로그인: 풀 앱(`/?view=bazaar`)으로 리다이렉트 — 모든 메뉴 + Bazaar 피드(D2).
 * - Phase 53(C): 미니 사이드바를 MiniShell로 추출해 /p·/shared와 공용.
 */
export default function BazaarLandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  // 로그인 사용자는 풀 앱으로
  useEffect(() => {
    if (!loading && user) router.replace('/?view=bazaar');
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'var(--font-ui, sans-serif)', fontSize: 14 }}>
        이동 중…
      </div>
    );
  }

  return (
    <MiniShell
      active="bazaar"
      sidebarExtra={
        // 비로그인 랜딩이라 '내 게시물'(로그인 필요)은 노출되지 않음
        <button onClick={() => setFilter('all')} style={miniShellSubRowStyle(filter === 'all')}>전체</button>
      }
    >
      <BazaarView uid={user?.uid ?? ''} filter={filter} />
    </MiniShell>
  );
}
