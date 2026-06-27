'use client';

import { useState } from 'react';

/**
 * Phase 52 5단계(O1): SNS 공유 버튼 v1. 셋업 0(키·도메인 등록 불필요).
 * - navigator.share(모바일 OS 시트, 인스타·카톡 등 설치앱) — HTTPS + 사용자 클릭 필요.
 * - 데스크톱 등 미지원 시 폴백 메뉴: X intent / 링크 복사.
 * - 카드 미리보기는 URL의 OG(/p는 Phase 51 정적 OG, /shared는 Phase 53 예정).
 */
export default function ShareButton({
  url, title, tags = [], compact = false,
}: {
  url: string;
  title: string;
  tags?: string[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `${title} · Mathory`;

  const onShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }); } catch { /* 취소·실패 무시 */ }
      return;
    }
    setOpen((v) => !v);
  };

  const shareX = () => {
    const hashtags = tags.length ? `&hashtags=${encodeURIComponent(tags.join(','))}` : '';
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}${hashtags}`;
    window.open(u, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={onShare} style={triggerStyle(compact)} title="공유">
        <ShareIcon />
        {!compact && <span>공유</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={menuStyle}>
            <button onClick={shareX} style={menuItemStyle}>X에 공유</button>
            <button onClick={copy} style={menuItemStyle}>{copied ? '복사됨' : '링크 복사'}</button>
          </div>
        </>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

function triggerStyle(compact: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: compact ? '4px 8px' : '6px 12px',
    border: '1px solid var(--border-light, #ddd)', borderRadius: 7,
    background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary, #555)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap',
  };
}

const menuStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 41,
  background: '#fff', border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
  boxShadow: '0 4px 14px rgba(0,0,0,0.12)', padding: 4, minWidth: 120,
  display: 'flex', flexDirection: 'column', gap: 2,
};
const menuItemStyle: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent',
  borderRadius: 6, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-primary, #222)',
  fontFamily: 'var(--font-ui)',
};
