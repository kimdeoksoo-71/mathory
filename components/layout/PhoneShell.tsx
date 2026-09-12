'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
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

   M8 D4′ — 스크롤러 핸들(`PhoneShellHandle`). 프로그램적 스크롤은 반드시 `scrollTo`로:
     무시 창(`ignoreUntilRef`)을 먼저 세우고 scrollTop을 쓴다 — S4의 크롬 자동 숨김이
     그 이동을 "사용자가 아래로 밀었다"로 읽어 탭을 누른 순간 크롬을 접는 오동작을 막는다.
   ═══════════════════════════════════════════════════════════════ */

export const PHONE_TOPBAR_H = 52;

/** 프로그램적 스크롤 뒤 scroll 이벤트를 무시하는 창(ms). 크롬 transition(200ms)보다 길어야 한다 */
export const SCROLL_IGNORE_MS = 300;

export interface PhoneShellHandle {
  /** 본문 스크롤러의 scrollTop(러버밴드 음수는 0으로 클램프) */
  getScrollTop: () => number;
  /** 무시 창을 세운 뒤 scrollTop을 쓴다 — 직접 `el.scrollTop = y`를 쓰지 말 것 */
  scrollTo: (y: number) => void;
}

const PhoneShell = forwardRef<PhoneShellHandle, {
  title?: string;
  /** 'back' = ← 버튼(onBack 필수) / 'wordmark' = 로고(→ /) */
  left?: 'back' | 'wordmark';
  onBack?: () => void;
  right?: React.ReactNode;
  tabs?: React.ReactNode;
  footer?: React.ReactNode;
  /** BottomSheet들 — 루트 직계 자식으로 마운트(absolute 기준·본문 스크롤러 밖).
   *  ⚠ 본문(children) 안에 시트를 두지 말 것 — [data-ref-tooltip] 게이트 안에 들어가
   *    문제 카드 정의부가 두 벌이 되는 P13 함정을 부른다. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}>(function PhoneShell({
  title, left = 'wordmark', onBack, right, tabs, footer, overlay, children,
}, ref) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreUntilRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getScrollTop: () => Math.max(0, scrollerRef.current?.scrollTop ?? 0),
    scrollTo: (y: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      ignoreUntilRef.current = Date.now() + SCROLL_IGNORE_MS;
      el.scrollTop = Math.max(0, y);
    },
  }), []);

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
            {/* M8 D1 — 작은 워드마크 사양(Sidebar와 동일: 19/400/--wordmark-small/그림자) */}
            <Wordmark as="div" size={19} color="var(--wordmark-small, #944728)" shadow />
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
      <div ref={scrollerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {children}
      </div>

      {/* ── 오버레이(바텀 시트) — 루트 직계 ── */}
      {overlay}

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
});

export default PhoneShell;
