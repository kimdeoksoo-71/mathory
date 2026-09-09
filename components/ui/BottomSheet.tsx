'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Z_SHEET } from './dialogStyles';
import { IconClose } from './Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 D9 — 폰 바텀 시트 1종. 우측 드로어 3종(데스크톱 한정 규약)의 폰 번역.

   ⚠ position:absolute — 기준 상자는 PhoneShell 루트(position:relative)다.
     PhoneShell 밖에서 쓰지 말 것(기준 상자가 없으면 뷰포트가 아니라 엉뚱한 조상에 붙는다).
   ⚠ zIndex = Z_SHEET(9500) — 다이얼로그(10500)·말풍선(10400) **아래**: 시트 안에서 띄운
     confirm·참조 말풍선이 시트를 덮어야 한다.
   ⚠ 스크롤 잠금은 딤이 담당한다 — 딤(touchAction:none)이 본문 스크롤러를 덮고,
     딤은 스크롤러의 형제(PhoneShell 루트의 자식)라 휠·터치가 본문으로 새지 않는다.
     시트 내용은 자체 overflow:auto + overscrollBehavior:contain.
   ⚠ 닫기 3경로: 딤 탭 · 그립 아래로 드래그(60px, setPointerCapture — P7 전례) · X.
     애니메이션은 열림/닫힘 0.2s 하나(phone-sheet-in/out, globals.css).
   ═══════════════════════════════════════════════════════════════ */

const DRAG_CLOSE_PX = 60;
const CLOSE_MS = 180;

export default function BottomSheet({ open, height, onClose, title, children }: {
  open: boolean;
  /** px 숫자 또는 '78%' 같은 문자열. 내용이 이보다 짧아도 시트는 이 높이다. */
  height: number | string;
  onClose: () => void;
  /** 그립 줄 아래 헤더 텍스트(옵션 — 예: "댓글 3") */
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pid: number; startY: number } | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  // 부모가 open을 직접 내리면(외부 닫기) closing 잔여 상태를 청소한다
  useEffect(() => { if (!open) setClosing(false); }, [open]);

  if (!open) return null;

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => { setClosing(false); onClose(); }, CLOSE_MS);
  };

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // P7 전례 — capture 없이 만들면 그립 밖에서 뗀 pointerup을 놓쳐 시트가 안 닫힌다
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { pid: e.pointerId, startY: e.clientY };
  };
  const onGripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - d.startY);
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const dy = e.clientY - d.startY;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (!cancelled && dy >= DRAG_CLOSE_PX) requestClose();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: Z_SHEET }}>
      {/* 딤 — 탭으로 닫기 + 배경 스크롤 차단 */}
      <div
        onClick={requestClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(45,42,35,0.32)',
          touchAction: 'none',
          animation: closing ? 'phone-dim-out 0.18s ease-in forwards' : 'phone-dim-in 0.2s ease-out',
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-drawer)', boxShadow: 'var(--drawer-shadow)',
          borderRadius: '12px 12px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom)',
          animation: closing ? 'phone-sheet-out 0.18s ease-in forwards' : 'phone-sheet-in 0.2s ease-out',
        }}
      >
        {/* 그립 줄: 드래그 닫기 핸들 + X */}
        <div
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          style={{
            flexShrink: 0, position: 'relative', height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'none', cursor: 'grab',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-content)' }} />
          <button
            onClick={requestClose}
            aria-label="닫기"
            style={{
              position: 'absolute', right: 4, top: 0, width: 40, height: 32,
              border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <IconClose size={16} />
          </button>
        </div>
        {title && (
          <div style={{
            flexShrink: 0, padding: '0 16px 8px', fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
          }}>
            {title}
          </div>
        )}
        {/* 내용 — 시트의 유일한 스크롤러 */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', position: 'relative' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
