'use client';

import { signInWithPopup } from 'firebase/auth';
import useAuth from '../../hooks/useAuth';
import { auth, googleProvider } from '../../lib/firebase';
import { IconBazaar, IconChevron } from '../ui/Icons';

/**
 * Phase 53 C단계: 공개 열람용 미니 셸.
 * - 비로그인·로그인-비멤버가 `/bazaar`·`/p`·`/shared`를 열 때 공용으로 감싸는 좌측 사이드바.
 * - 로고(→앱) · 공유 라벨 · Bazaar 행(→/bazaar) · sidebarExtra(옵션) · 로그인/작업실 진입.
 * - 콘텐츠는 children으로 우측 main 영역에 렌더.
 * - 모바일(소형 화면) 대응은 후속 과제(U8) — 현재 데스크톱·태블릿 기준 고정 232px.
 */
export default function MiniShell({
  children, active, sidebarExtra,
}: {
  children: React.ReactNode;
  active?: 'bazaar';
  sidebarExtra?: React.ReactNode;
}) {
  const { user } = useAuth();

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
        <a href="/bazaar" title="Bazaar 광장으로" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            color: active === 'bazaar' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ display: 'flex', opacity: 0.8 }}><IconBazaar size={15} /></span>
            Bazaar
            <span style={{ marginLeft: 'auto', display: 'flex', color: 'var(--text-muted)' }}><IconChevron size={11} /></span>
          </div>
        </a>

        {sidebarExtra}

        <div style={{ flex: 1 }} />
        {!user ? (
          <>
            <button onClick={handleLogin} style={loginBtnStyle}>로그인</button>
            <div style={hintStyle}>
              로그인하면 댓글 작성·문항 게시·<br />내 게시물 관리가 가능합니다.
            </div>
          </>
        ) : (
          <a href="/" style={{ ...loginBtnStyle, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
            내 작업실로
          </a>
        )}
      </aside>

      {/* ── 콘텐츠 ── */}
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  // 하드 세로선 없음 — 앱 본체와 동일하게 배경색(아이보리)·U-프레임으로 구분
  width: 232, flexShrink: 0,
  background: 'var(--bg-functional, #fafafa)', padding: '16px 12px',
  display: 'flex', flexDirection: 'column',
};
const logoStyle: React.CSSProperties = {
  fontSize: 19, fontWeight: 600, color: 'var(--mathory-red, #D97757)',
  letterSpacing: '-0.03em', fontFamily: 'var(--font-logo)', marginBottom: 18,
};
const catLabelStyle: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3,
  padding: '4px 4px 6px',
};
const loginBtnStyle: React.CSSProperties = {
  padding: '8px 0', border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
  background: '#fff', color: '#333', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'var(--font-ui)', width: '100%',
};
const hintStyle: React.CSSProperties = {
  fontSize: 10.5, color: 'var(--text-faint, #bbb)', textAlign: 'center', marginTop: 6, lineHeight: 1.5,
};

/** Bazaar 랜딩의 필터 서브행(전체·내 게시물)에서 재사용하는 스타일 */
export function miniShellSubRowStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', textAlign: 'left', padding: '6px 12px 6px 30px', border: 'none',
    borderRadius: 8, cursor: 'pointer', background: active ? 'var(--bg-active, #ececec)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
  };
}
