'use client';

/**
 * M6 D5′ — hover 말풍선 한 벌. 툴바 `IconButton`(UnifiedToolbar)에 있던 툴팁 상태·타이머를
 * 그대로 뽑아낸 것이라 시각(600ms · fixed · 11px · rgba(33,33,33,.92))은 M4 검수본과 같다.
 * 소비처: 툴바 IconButton · 리스트 헤더 아이콘 칼럼(ListView).
 *
 * 훅인 이유: IconButton은 `<>{button}{tip}</>` 구조라 훅이면 JSX가 한 줄도 안 바뀌고
 * 상태·타이머만 빠진다 — "시각 불변" 검증이 diff만으로 끝난다.
 *
 * ⚠ 네이티브 `title`과 병기하지 말 것 — 600ms 커스텀과 ~1s 네이티브가 둘 다 떠 이중 툴팁이 된다.
 *   접근성은 `aria-label`로 준다(IconButton 선례).
 * ⚠ 말풍선은 `position: fixed` — transform이 걸린 조상 밑에서는 좌표를 잃는다(Phase 65 S11에서
 *   CM 툴팁이 그랬다). 소비처(툴바·리스트 헤더)에 transform 조상이 없음을 확인하고 쓴다.
 * ⚠ 앵커 `ref`는 소비처가 자기 ref와 **병합**해 넣는다(IconButton의 buttonRef 선례) —
 *   bind.ref를 그대로 쓰면 소비처의 기존 ref를 덮어쓴다.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Z_TOOLTIP } from './dialogStyles';

export const HOVER_TIP_DELAY_MS = 600;

export function useHoverTip(label: string, opts?: { disabled?: boolean; delay?: number }): {
  /** 앵커 요소 ref — 소비처가 자기 ref와 병합해 할당한다 */
  anchorRef: React.MutableRefObject<HTMLElement | null>;
  show: () => void;
  hide: () => void;
  /** 앵커의 **형제**로 렌더할 말풍선 노드(없으면 null) */
  tip: ReactNode;
  /** 단순 소비처용 — ref를 따로 안 쓰는 버튼에 그대로 스프레드 */
  bind: {
    ref: (el: HTMLElement | null) => void;
    onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void;
  };
} {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const delay = opts?.delay ?? HOVER_TIP_DELAY_MS;
  const disabled = !!opts?.disabled;

  const show = () => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    }, delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPos(null);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const tip = pos && !disabled ? (
    <span
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        padding: '4px 8px',
        background: 'rgba(33, 33, 33, 0.92)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--font-ui, sans-serif)',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: Z_TOOLTIP,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {label}
    </span>
  ) : null;

  return {
    anchorRef, show, hide, tip,
    bind: {
      ref: (el) => { anchorRef.current = el; },
      onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide,
    },
  };
}
