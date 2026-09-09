'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import useAuth from '../../hooks/useAuth';
import { auth, googleProvider } from '../../lib/firebase';
import BottomSheet from '../ui/BottomSheet';
import { FORCE_DESKTOP_KEY } from '../../hooks/useIsPhone';
import { FONT_SIZE_MIN, FONT_SIZE_MAX } from '../../lib/constants';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 §6-4 — ⋯ 시트: 글자 크기 · 링크 복사 · Bazaar · PC 화면으로 보기 · 로그인.
   ⚠ 글자 크기 스테퍼는 SizeStepper(14×11 — 터치 미달, v2 B-8)를 쓰지 않고
     44×36 버튼을 여기 그린다(D12). 값·키는 lib/constants FONT_SIZE_*가 단일 출처.
   ⚠ "PC 화면으로 보기" = sessionStorage(탭 수명, Q2) + reload — 서버 첫 렌더가 폰이라
     한 번 깜빡일 수 있는 것은 수용(D4).
   ═══════════════════════════════════════════════════════════════ */

export default function PhoneMoreSheet({ open, onClose, shareUrl, fontSize, onFontStep }: {
  open: boolean;
  onClose: () => void;
  /** 있으면 [링크 복사] 행 노출 */
  shareUrl?: string;
  /** 둘 다 있으면 [글자 크기] 행 노출 */
  fontSize?: number;
  onFontStep?: (delta: 1 | -1) => void;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); } catch { /* 무시 */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const forceDesktop = () => {
    try { sessionStorage.setItem(FORCE_DESKTOP_KEY, '1'); } catch { /* 무시 */ }
    window.location.reload();
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch { /* 취소 무시 */ }
    onClose();
  };

  return (
    <BottomSheet open={open} height="auto" onClose={onClose}>
      <div style={{ padding: '0 8px 12px', fontFamily: 'var(--font-ui)' }}>
        {fontSize !== undefined && onFontStep && (
          <div style={{ ...rowStyle, cursor: 'default' }}>
            <span style={labelStyle}>글자 크기</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => onFontStep(-1)}
                disabled={fontSize <= FONT_SIZE_MIN}
                aria-label="글자 작게"
                style={{ ...stepBtnStyle, opacity: fontSize <= FONT_SIZE_MIN ? 0.3 : 1 }}
              >−</button>
              <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {fontSize}
              </span>
              <button
                onClick={() => onFontStep(1)}
                disabled={fontSize >= FONT_SIZE_MAX}
                aria-label="글자 크게"
                style={{ ...stepBtnStyle, opacity: fontSize >= FONT_SIZE_MAX ? 0.3 : 1 }}
              >+</button>
            </span>
          </div>
        )}
        {shareUrl && (
          <button onClick={copyLink} style={rowStyle}>
            <span style={labelStyle}>{copied ? '복사됨 ✓' : '링크 복사'}</span>
          </button>
        )}
        <a href="/bazaar" style={{ ...rowStyle, textDecoration: 'none' }}>
          <span style={labelStyle}>Bazaar 광장</span>
        </a>
        <button onClick={forceDesktop} style={rowStyle}>
          <span style={labelStyle}>PC 화면으로 보기</span>
        </button>
        {!user && (
          <button onClick={handleLogin} style={rowStyle}>
            <span style={{ ...labelStyle, fontWeight: 700 }}>Google 로그인</span>
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', minHeight: 48, padding: '0 12px', boxSizing: 'border-box',
  border: 'none', borderBottom: '1px solid var(--border-light, #eee)',
  background: 'none', cursor: 'pointer', textAlign: 'left',
};
const labelStyle: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
const stepBtnStyle: React.CSSProperties = {
  width: 44, height: 36, border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
  background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
  fontSize: 18, fontWeight: 600, cursor: 'pointer', lineHeight: 1,
};
