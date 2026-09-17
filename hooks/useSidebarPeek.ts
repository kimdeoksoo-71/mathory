'use client';
/* ═══════════════════════════════════════════════════════════════
   Phase 67 S4 — 사이드바 hover peek 타이머·포인터 배선. 판단은 전부 lib/sidebarPeek.ts(순수)에 있다.
   사양: docs/phaseSketch/Phase67-sidebar-hover-peek-plan-v4.md D4·D5·D6·D10·D15 · §5-2

   함정 — 하나라도 어기면 조용히 틀어진다:
   ① 타이머 effect deps는 phase가 아니라 **seq**다(W1). My→공유 레일 이동의 leave·enter가 React 18 배칭으로 한 렌더에
      합쳐지면 phase는 pending→pending이라 phase deps로는 open 타이머가 재시작되지 않는다.
   ② document 리스너는 **capture 단계**다(W4). 버블이면 onPointerDown stopPropagation 30곳(편집창 블록·카드·행)에서
      끊겨 바깥 탭으로 안 닫힌다. ⚠ 핸들러는 dispatch 하나만 — preventDefault·stopPropagation 금지(CodeMirror 포커스·
      dnd-kit 활성화가 깨진다).
   ③ pointermove 기록은 **pending부터**(W2) — open 진입 순간 armedAt에 쓸 좌표가 있어야 착지 직후 헤더 전환 가드가 선다.
   ④ transitionend는 target===currentTarget · propertyName==='width' 두 가드(G1 — 자식 transition 11곳이 버블링)이고,
      패널·바깥 aside가 **서로 다른 이벤트**를 보낸다(V8). transitioncancel은 듣지 않는다(Y9 — 폴백 타이머가 받는다).
   ⑤ hold는 안정 식별자다(Y2) — 소비처 effect가 렌더마다 release→hold를 돌면 holds가 0을 스쳐 리렌더 루프가 된다.
   ⑥ 레일 click의 e.detail === 0(키보드 합성)은 무시한다(X6) — 키보드 peek은 범위 밖이고 via가 낡은 값이 된다.
   ═══════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  INITIAL_PEEK_STATE, reducePeek, needsCloseTimer, peekView, isHoverPointerType,
  PEEK_OPEN_DELAY, PEEK_CLOSE_GRACE, PEEK_SWITCH_INTENT, PEEK_MOVE_ARM_PX,
  PEEK_CLOSE_FALLBACK, PEEK_PIN_FALLBACK,
  type PeekSection, type PeekDragKind,
} from '../lib/sidebarPeek';

type Pt = { x: number; y: number };

export function useSidebarPeek({ collapsed, dragKind }: { collapsed: boolean; dragKind: PeekDragKind }) {
  const [state, dispatch] = useReducer(reducePeek, INITIAL_PEEK_STATE);
  const view = peekView(state, collapsed);

  const panelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dragKindRef = useRef(dragKind);
  dragKindRef.current = dragKind;
  /** 마지막 포인터 좌표 — railEnter가 먼저 채우고, pending부터 document pointermove가 갱신(W2) */
  const lastPointer = useRef<Pt | null>(null);
  /** 전환 가드 기준점 — open 진입·섹션 전환 직후 세우고, 포인터가 PEEK_MOVE_ARM_PX 이상 움직이면 해제(null) */
  const armedAt = useRef<Pt | null>(null);
  /** 포인터가 올라가 있는 섹션 헤더 */
  const hoveredHeader = useRef<PeekSection | null>(null);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 레일 click 직전 pointerdown의 pointerType(D15) — click의 MouseEvent엔 없다. 읽는 즉시 비운다 */
  const railPointerType = useRef<string | null>(null);

  // ── collapsed 반영(Y4 페이로드) ──
  useEffect(() => { dispatch({ type: 'collapsedChanged', collapsed }); }, [collapsed]);

  // ── 타이머(①) ──
  useEffect(() => {
    if (state.phase !== 'pending') return;
    const t = setTimeout(() => dispatch({ type: 'openTimer' }), PEEK_OPEN_DELAY);
    return () => clearTimeout(t);
  }, [state.phase, state.pendingSeq]);

  const closeNeeded = needsCloseTimer(state);
  useEffect(() => {
    if (!closeNeeded) return;
    const t = setTimeout(() => dispatch({ type: 'closeTimer' }), PEEK_CLOSE_GRACE);
    return () => clearTimeout(t);
  }, [closeNeeded, state.leaveSeq]);

  useEffect(() => {
    if (state.phase !== 'closing') return;
    const t = setTimeout(() => dispatch({ type: 'panelTransitionEnd' }), PEEK_CLOSE_FALLBACK);
    return () => clearTimeout(t);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'pinning') return;
    const t = setTimeout(() => dispatch({ type: 'asideTransitionEnd' }), PEEK_PIN_FALLBACK);
    return () => clearTimeout(t);
  }, [state.phase]);

  // ── 섹션 전환 intent ──
  const clearSwitch = useCallback(() => {
    if (switchTimer.current) { clearTimeout(switchTimer.current); switchTimer.current = null; }
  }, []);
  /** 가드를 통과했으면 intent 타이머를 건다 — 헤더 진입 시와 헤더 위에서 움직일 때 부른다 */
  const maybeStartSwitch = useCallback(() => {
    const s = stateRef.current;
    const sec = hoveredHeader.current;
    if (s.phase !== 'open' || !sec || sec === s.section || switchTimer.current) return;
    const a = armedAt.current, p = lastPointer.current;
    if (a && p && Math.hypot(p.x - a.x, p.y - a.y) < PEEK_MOVE_ARM_PX) return;   // 헤더가 정지 포인터 밑으로 미끄러져 든 것
    armedAt.current = null;
    switchTimer.current = setTimeout(() => {
      switchTimer.current = null;
      const target = hoveredHeader.current;
      if (!target) return;
      dispatch({ type: 'switchSection', section: target });
      armedAt.current = lastPointer.current;
    }, PEEK_SWITCH_INTENT);
  }, []);

  // open 진입(되감기 포함) — 가드 기준점을 세운다(G3). open을 벗어나면 intent 타이머를 버린다
  useEffect(() => {
    if (state.phase === 'open') armedAt.current = lastPointer.current;
    else clearSwitch();
  }, [state.phase, clearSwitch]);

  // ── document 리스너(②③) ──
  const listening = state.phase !== 'idle';
  useEffect(() => {
    if (!listening) return;
    const onMove = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (hoveredHeader.current && !switchTimer.current) maybeStartSwitch();
    };
    document.addEventListener('pointermove', onMove, { capture: true, passive: true });
    return () => document.removeEventListener('pointermove', onMove, { capture: true });
  }, [listening, maybeStartSwitch]);

  const catchingOutside = state.phase === 'open' || state.phase === 'closing';
  useEffect(() => {
    if (!catchingOutside) return;
    const onDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) dispatch({ type: 'outsidePointerDown' });
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [catchingOutside]);

  useEffect(() => clearSwitch, [clearSwitch]);

  // ── 소비처 props ──
  const railProps = useCallback((section: PeekSection) => ({
    title: false as const,
    onPointerEnter: (e: React.PointerEvent) => {
      if (!isHoverPointerType(e.pointerType)) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      dispatch({ type: 'railEnter', section, dragKind: dragKindRef.current });
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (!isHoverPointerType(e.pointerType)) return;
      dispatch({ type: 'railLeave' });
    },
    onPointerDown: (e: React.PointerEvent) => { railPointerType.current = e.pointerType; },
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) return;   // ⑥ 키보드 합성 click
      const pointerType = railPointerType.current ?? '';
      railPointerType.current = null;
      dispatch({ type: 'railClick', section, pointerType });
    },
  }), []);

  const headerProps = useCallback((section: PeekSection) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (!isHoverPointerType(e.pointerType)) return;   // Y10
      hoveredHeader.current = section;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      maybeStartSwitch();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (!isHoverPointerType(e.pointerType)) return;
      if (hoveredHeader.current === section) hoveredHeader.current = null;
      clearSwitch();
    },
  }), [maybeStartSwitch, clearSwitch]);

  const panelProps = useMemo(() => ({
    ref: panelRef,
    onPointerEnter: (e: React.PointerEvent) => { if (isHoverPointerType(e.pointerType)) dispatch({ type: 'panelEnter' }); },
    onPointerLeave: (e: React.PointerEvent) => { if (isHoverPointerType(e.pointerType)) dispatch({ type: 'panelLeave' }); },
    onTransitionEnd: (e: React.TransitionEvent) => {
      if (e.target === e.currentTarget && e.propertyName === 'width') dispatch({ type: 'panelTransitionEnd' });
    },
  }), []);

  const asideProps = useMemo(() => ({
    onTransitionEnd: (e: React.TransitionEvent) => {
      if (e.target === e.currentTarget && e.propertyName === 'width') dispatch({ type: 'asideTransitionEnd' });
    },
  }), []);

  /** 헤더 클릭 — peek 중에는 토글이 아니라 섹션 전환(가드 없이 즉시) */
  const switchTo = useCallback((section: PeekSection) => {
    clearSwitch();
    dispatch({ type: 'switchSection', section });
    armedAt.current = lastPointer.current;
  }, [clearSwitch]);

  /** 헤더 사이드바 버튼 — open·closing이면 pin(호출부가 이어서 onToggle) */
  const pin = useCallback(() => dispatch({ type: 'pin' }), []);
  /** 선택 콜백 9종이 부른다 — 리듀서가 터치 peek일 때만 닫는다(W6·Y5) */
  const itemSelected = useCallback(() => dispatch({ type: 'itemSelected' }), []);
  /** 닫힘 보류 — 반환한 함수로 해제. 소비처는 useEffect cleanup으로만 쓴다(Y2 · S5 배선) */
  const hold = useCallback(() => {
    dispatch({ type: 'hold' });
    return () => dispatch({ type: 'release' });
  }, []);

  return { state, view, railProps, headerProps, panelProps, asideProps, switchTo, pin, itemSelected, hold };
}
