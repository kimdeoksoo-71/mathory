'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import useAuth from '../../hooks/useAuth';
import { auth, googleProvider } from '../../lib/firebase';
import BazaarView from '../../components/share/BazaarView';
import { IconBazaar, IconChevron } from '../../components/ui/Icons';

/**
 * Phase 52(D1~D5): 공개 Bazaar 랜딩 (`/bazaar`).
 * - 비로그인: 미니 사이드바(공유 > Bazaar > 전체[+ 내 게시물]) + 전역 피드. bazaar_posts read=public(D1).
 * - 로그인: 풀 앱(`/?view=bazaar`)으로 리다이렉트 — 모든 메뉴 + Bazaar 피드(D2).
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

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch { /* 취소 무시 */ }
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg-primary, #fff)', fontFamily: 'var(--font-ui, sans-serif)' }}>
      {/* ── 미니 사이드바 ── */}
      <aside style={sidebarStyle}>
        <a href="/" title="Mathory 메인으로" style={{ textDecoration: 'none' }}>
          <div style={logoStyle}>Mathory</div>
        </a>

        <div style={catLabelStyle}>공유</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
          <span style={{ display: 'flex', opacity: 0.8 }}><IconBazaar size={15} /></span>
          Bazaar
          <span style={{ marginLeft: 'auto', display: 'flex', color: 'var(--text-muted)' }}><IconChevron size={11} /></span>
        </div>

        <button onClick={() => setFilter('all')} style={subRowStyle(filter === 'all')}>전체</button>
        {user && (
          <button onClick={() => setFilter('mine')} style={subRowStyle(filter === 'mine')}>내 게시물</button>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={handleLogin} style={loginBtnStyle}>로그인</button>
        <div style={{ fontSize: 10.5, color: 'var(--text-faint, #bbb)', textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
          로그인하면 댓글 작성·문항 게시·<br />내 게시물 관리가 가능합니다.
        </div>
      </aside>

      {/* ── 피드 ── */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <BazaarView uid={user?.uid ?? ''} filter={filter} />
      </main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  width: 232, flexShrink: 0, borderRight: '1px solid var(--border-light, #eee)',
  background: 'var(--bg-functional, #fafafa)', padding: '16px 12px',
  display: 'flex', flexDirection: 'column',
};
const logoStyle: React.CSSProperties = {
  fontSize: 19, fontWeight: 500, color: 'var(--text-primary, #222)',
  letterSpacing: -0.5, fontFamily: 'var(--font-logo)', marginBottom: 18,
};
const catLabelStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3,
  padding: '4px 4px 6px',
};
function subRowStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', textAlign: 'left', padding: '6px 12px 6px 30px', border: 'none',
    borderRadius: 8, cursor: 'pointer', background: active ? 'var(--bg-active, #ececec)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
  };
}
const loginBtnStyle: React.CSSProperties = {
  padding: '8px 0', border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
  background: '#fff', color: '#333', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
