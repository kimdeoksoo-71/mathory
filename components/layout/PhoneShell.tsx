'use client';

import type React from 'react';
import Wordmark from '../ui/Wordmark';
import { IconChevronLeft } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 D6 — 폰 셸 프레임. MiniShell(데스크톱 공개 셸)의 폰 대응물.

   구조: 상단 바 52(고정) → [탭 행](고정) → 본문(유일한 스크롤러) → [footer 탭 바](고정).
   ⚠ 루트의 `data-phone`이 폰 CSS 스코프의 전부다 — CSS는 판별하지 않는다(함정 2).
   ⚠ 루트는 position:relative — BottomSheet(D9)의 absolute 기준 상자.
   ⚠ 본문이 유일한 스크롤러라 시트의 스크롤 잠금이 딤 하나로 끝난다(D9 ②).
   ⚠ footer만 safe-area를 편다(D5 viewportFit:'cover'의 소비처). footer가 없는 화면은
     본문이 바닥까지 내려가도 되는 화면뿐이다(리더 — 하단 여백은 콘텐츠가 공급).
   ═══════════════════════════════════════════════════════════════ */

export const PHONE_TOPBAR_H = 52;

export default function PhoneShell({
  title, left = 'wordmark', onBack, right, tabs, footer, children,
}: {
  title?: string;
  /** 'back' = ← 버튼(onBack 필수) / 'wordmark' = 로고(→ /) */
  left?: 'back' | 'wordmark';
  onBack?: () => void;
  right?: React.ReactNode;
  tabs?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-phone=""
      style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-functional)', fontFamily: 'var(--font-ui)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* ── 상단 바 ── */}
      <header style={{
        flexShrink: 0, height: PHONE_TOPBAR_H, display: 'flex', alignItems: 'center',
        gap: 8, padding: '0 12px', borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-functional)',
      }}>
        {left === 'back' ? (
          <button
            onClick={onBack}
            aria-label="뒤로"
            style={{
              border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, marginLeft: -8, padding: 0, borderRadius: 8, flexShrink: 0,
            }}
          >
            <IconChevronLeft size={22} />
          </button>
        ) : (
          <a href="/" title="Mathory 메인으로" style={{ textDecoration: 'none', display: 'flex', flexShrink: 0 }}>
            {/* MiniShell 사양(19/600/red) — 4번째 워드마크 사양을 만들지 않는다(§7-4) */}
            <Wordmark as="div" size={19} weight={600} color="var(--mathory-red, #D97757)" />
          </a>
        )}
        {title ? (
          <div style={{
            flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        {right}
      </header>

      {/* ── 탭 행(옵션 — 리더의 문제/풀이) ── */}
      {tabs && <div style={{ flexShrink: 0 }}>{tabs}</div>}

      {/* ── 본문: 유일한 세로 스크롤러 ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {children}
      </div>

      {/* ── 하단 탭 바(옵션 — PhoneApp) ── */}
      {footer && (
        <footer style={{
          flexShrink: 0, background: 'var(--bg-sidebar)',
          borderTop: '1px solid var(--border-light)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {footer}
        </footer>
      )}
    </div>
  );
}
