'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ═══ Phase 62 — 드로어·패널 폭 조절 공용 훅 ═══
   EditorView·ProblemView에 두 벌로 복제돼 있던 리사이즈 로직의 단일 구현이다.
   소비처 5곳: EditorView(댓글·agent / 버전 드로어) · ProblemView(댓글·agent / 우측 단) · AppShell(좌측 사이드바).

   ⚠ `anchor`(이 훅)와 DrawerResizeHandle의 `side`는 다른 개념이다.
      anchor = 패널이 뷰포트의 어느 변에 고정돼 있는가(드래그 방향 계산)
      side   = strip을 positioned 부모의 어느 변에서 offset할지(렌더 위치)
      버전 드로어가 둘이 갈리는 유일한 사례다(anchor 'right' + side 'left').

   ⚠ 폭은 세션 내 상태로만 유지한다 — 새로고침·재진입은 매번 기본값(덕수 확정).
      localStorage 코드를 넣지 말 것. */

export interface DrawerResizeOptions {
  defaultWidth: number;
  min: number;
  /** 창 비례 상한은 함수로. ⚠ 렌더 중에 부르지 않는다 — SSR에는 window가 없다 */
  max: number | (() => number);
  /** 패널이 뷰포트의 어느 변에 고정되어 있는가 */
  anchor: 'left' | 'right';
}

export interface DrawerResize {
  width: number;
  dragging: boolean;
  hover: boolean;
  setWidth: (w: number) => void;
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
}

export function useDrawerResize({ defaultWidth, min, max, anchor }: DrawerResizeOptions): DrawerResize {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);

  // 최신 값을 이벤트 시점에 읽는다 — 인라인 화살표로 넘어오는 max가 매 렌더 identity를 바꿔도
  // clamp/onPointerDown이 재생성되지 않게 ref로 받는다.
  const widthRef = useRef(width);  widthRef.current = width;
  const maxRef = useRef(max);      maxRef.current = max;

  const clamp = useCallback((w: number) => {
    const m = maxRef.current;
    const hi = typeof m === 'function' ? m() : m;   // ⚠ 여기서만 호출된다 (SSR)
    return Math.max(min, Math.min(hi, w));
  }, [min]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();                    // dnd-kit 블록 드래그와 충돌 방지
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    const w0 = widthRef.current;
    // 커서와 패널 변 사이 간격을 한 번만 재고 드래그 내내 유지 → 시작 스냅 0.
    // (구 코드는 고정 갭 12·24를 썼는데 실제 경계선(panelWidth+8)과 어긋나 드래그 시작에 4px·16px 튀었다)
    const delta = anchor === 'right'
      ? e.clientX - window.innerWidth + w0
      : e.clientX - w0;

    try { el.setPointerCapture(pid); } catch {}   // 오버레이·iframe 위에서도 이벤트를 붙잡는다
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const next = anchor === 'right'
        ? window.innerWidth - ev.clientX + delta
        : ev.clientX - delta;
      setWidth(clamp(next));
    };
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      try { el.releasePointerCapture(pid); } catch {}
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
      // ⚠ capture 중에는 boundary 이벤트가 핸들로만 가므로 hover가 남을 수 있다.
      //   무조건 false로 끄면 커서가 아직 핸들 위인데 활성선이 꺼지는 역회귀가 생긴다
      //   → 릴리즈 지점을 rect로 판정해 확정한다.
      const r = el.getBoundingClientRect();
      setHover(ev.clientX >= r.left && ev.clientX <= r.right
            && ev.clientY >= r.top  && ev.clientY <= r.bottom);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [anchor, clamp]);

  // 창이 줄면 상한이 내려간다 → 패널이 화면 밖으로 나가지 않게 재클램프
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  // 드래그 도중 언마운트되면 body 커서가 col-resize로 굳는다
  useEffect(() => () => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return {
    width, dragging, hover, setWidth,
    handleProps: {
      onPointerDown,
      onPointerEnter: () => setHover(true),
      onPointerLeave: () => setHover(false),
    },
  };
}
