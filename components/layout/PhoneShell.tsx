'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type React from 'react';
import Wordmark from '../ui/Wordmark';
import { IconChevronLeft } from '../ui/Icons';
import {
  ChromeState, INITIAL_CHROME_STATE, nextChromeState, markProgrammaticScroll, resetChromeState, type RevealMode,
} from '../../lib/chromeAutoHide';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 D6 — 폰 셸 프레임. MiniShell(데스크톱 공개 셸)의 폰 대응물.

   구조: 상단 바 52(고정) → [탭 행](고정) → 본문(유일한 스크롤러) → [footer 탭 바](고정).
   ⚠ 루트의 `data-phone`이 폰 CSS 스코프의 전부다 — CSS는 판별하지 않는다(함정 2).
   ⚠ 루트는 position:relative — BottomSheet(D9)의 absolute 기준 상자.
   ⚠ 본문이 유일한 스크롤러라 시트의 스크롤 잠금이 딤 하나로 끝난다(D9 ②).
   ⚠ footer만 safe-area 하단을 편다(D5 viewportFit:'cover'의 소비처). footer가 없는 화면은
     본문이 바닥까지 내려가도 되는 화면뿐이다(리더 — 하단 여백은 콘텐츠가 공급).
     좌우 인셋은 루트가 편다(M8 D9 — 가로에서 노치 쪽, 세로는 0이라 픽셀 무변경).

   M8 D4′ — 스크롤러 핸들(`PhoneShellHandle`). 프로그램적 스크롤은 반드시 `scrollTo`로:
     무시 창을 먼저 세우고(markProgrammaticScroll) scrollTop을 쓴다 — 아래 크롬 자동 숨김이
     그 이동을 "사용자가 아래로 밀었다"로 읽어 탭을 누른 순간 크롬을 접는 오동작을 막는다.

   M8 D5 — 크롬(상단 바 + 탭 행) 자동 숨김. `chromeAutoHide`가 참이고 **가로 보기일 때만**.
     판정은 lib/chromeAutoHide(순수)가, 이 파일은 표본 공급·상태 반영만.
     ⚠ 크롬은 transform이 아니라 **margin-top 음수**로 접는다 — transform은 자리를 남긴다(구멍).
       루트 overflow:hidden이 위로 나간 부분을 자른다.
     ⚠ 높이는 상수 96이 아니라 ResizeObserver 실측 — 탭 행 없는 문항·제목 두 줄에서 어긋난다.
     ⚠ orientation은 CSS @media가 아니라 여기 JS matchMedia로만 읽는다(Phase 64 함정 2).
   ═══════════════════════════════════════════════════════════════ */

export const PHONE_TOPBAR_H = 52;
const CHROME_TRANSITION = 'margin-top 0.2s ease';
const LANDSCAPE_MQ = '(orientation: landscape)';

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
  /** M8 D5 — 가로 보기에서 스크롤에 따라 상단 바·탭 행을 접는다(리더만 true) */
  chromeAutoHide?: boolean;
  /** M9 D19′ — 크롬 복귀 조건. 기본값은 리더 기본(`reveal-at-top`)을 그대로 따른다 — 여기서 기본값을 두지 말 것(두 곳에 갈린다) */
  chromeReveal?: RevealMode;
  children: React.ReactNode;
}>(function PhoneShell({
  title, left = 'wordmark', onBack, right, tabs, footer, overlay, chromeAutoHide = false, chromeReveal, children,
}, ref) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ChromeState>(INITIAL_CHROME_STATE);
  const [hidden, setHidden] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [chromeH, setChromeH] = useState(0);
  const active = chromeAutoHide && landscape;

  useImperativeHandle(ref, () => ({
    getScrollTop: () => Math.max(0, scrollerRef.current?.scrollTop ?? 0),
    scrollTo: (y: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      stateRef.current = markProgrammaticScroll(stateRef.current, y, Date.now());
      el.scrollTop = Math.max(0, y);
    },
  }), []);

  /* 가로 판별 — 기능이 켜진 셸만 구독 */
  useEffect(() => {
    if (!chromeAutoHide) return;
    const mql = window.matchMedia(LANDSCAPE_MQ);
    const apply = () => setLandscape(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [chromeAutoHide]);

  /* 크롬 높이 실측 */
  useEffect(() => {
    if (!chromeAutoHide || !chromeRef.current) return;
    const el = chromeRef.current;
    const ro = new ResizeObserver(() => setChromeH(el.offsetHeight));
    ro.observe(el);
    setChromeH(el.offsetHeight);
    return () => ro.disconnect();
  }, [chromeAutoHide]);

  /* 활성/비활성 전환 — 표시 상태로 리셋. 켜질 때는 현재 위치를 기준점으로(첫 샘플이 큰 하향으로 읽히지 않게) */
  useEffect(() => {
    setHidden(false);
    stateRef.current = active
      ? markProgrammaticScroll(resetChromeState(), scrollerRef.current?.scrollTop ?? 0, Date.now())
      : resetChromeState();
  }, [active]);

  const onScroll = () => {
    if (!active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const r = nextChromeState(stateRef.current, {
      y: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      chromeH, now: Date.now(),
    }, chromeReveal);
    stateRef.current = r.state;
    if (r.action) setHidden(r.action === 'hide');
  };

  return (
    <div
      data-phone=""
      style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-functional)', fontFamily: 'var(--font-ui)',
        position: 'relative', overflow: 'hidden',
        paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 크롬: 상단 바 + 탭 행 (한 래퍼 — D5가 통째로 접는다) ── */}
      <div
        ref={chromeRef}
        style={{
          flexShrink: 0,
          marginTop: hidden ? -chromeH : 0,
          transition: active ? CHROME_TRANSITION : 'none',
        }}
      >
        <header style={{
          height: PHONE_TOPBAR_H, display: 'flex', alignItems: 'center',
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
        {tabs && <div>{tabs}</div>}
      </div>

      {/* ── 본문: 유일한 세로 스크롤러 ── */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
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
