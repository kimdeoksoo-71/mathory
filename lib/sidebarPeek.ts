/* ═══════════════════════════════════════════════════════════════
   Phase 67 S1 — 좌측 사이드바 hover peek 상태기계. import 0 · npm run test:peek
   사양: docs/phaseSketch/Phase67-sidebar-hover-peek-plan-v4.md §3 D4 (착수판)

   peek은 AppShell의 `collapsed`를 **읽기만** 하는 Sidebar 내부 일시 상태다 — 개선묶음 M2 F
   (자동접힘·강제 펼침 금지)의 예외가 아니라 별개 층이다. 판단은 전부 여기, 타이머·DOM 이벤트
   배선은 hooks/useSidebarPeek.ts(S4)가 맡는다(M8 chromeAutoHide와 같은 분리).

   함정 — 하나라도 어기면 조용히 틀어진다:
   ① **no-op은 입력 state를 그대로 돌려준다**(Y2). React는 같은 참조면 리렌더를 건너뛴다. 새 객체를
      만들면 매번 리렌더 → hold·재판정 effect 재실행 → 루프. 테스트가 strictEqual로 고정한다.
   ② ctx(dragKind·collapsed)는 리듀서 인자가 아니라 **이벤트 페이로드**다(Y4) — 디스패치 순간의 값으로
      판정한다. React 18 useReducer는 리듀서를 렌더 시점에 돌려, 같은 배치의 드래그 시작이 끼면 뒤집힌다.
   ③ 타이머 effect의 deps는 phase가 아니라 **seq**다(W1). My→공유 레일 이동의 railLeave·railEnter가
      한 렌더로 배칭되면 phase는 pending→pending이라 effect가 안 돌고 My의 80ms 타이머가 공유를 이르게 연다.
   ④ transitionend 출처는 둘(패널/바깥 aside)이고 **서로 다른 이벤트**다(V8). 합치면 pinning 중 패널 폭
      종료가 pinning을 조기에 끝내 main이 패널 우측을 덮는다. transitioncancel은 듣지 않는다(Y9 — 폴백이 받는다).
   ⑤ `dragKind`는 DnD(useDragKind)다 — Sidebar의 `dragging` prop(리사이즈)이 아니다(V10).
   ⑥ Phase 67b — 트리거는 **레일 전체**다(빈 곳·새 문제·검색·시트·열기 버튼·푸터 포함). 기준은 "레일에 PEEK_OPEN_DELAY
      머물렀는가"이고, 열릴 때의 섹션은 그 순간 포인터가 올라간 섹션 아이콘(없으면 null = 세 헤더 모두 접힘).
      그래서 pending 중 섹션이 바뀌어도 pendingSeq를 올리지 않는다(레일 안 이동이 타이머를 다시 시작하지 않는다).
      트리거가 패널 수준이라 고정 펼침에서도 진입 이벤트가 오므로 railEnter는 collapsed를 페이로드로 싣는다.
   ═══════════════════════════════════════════════════════════════ */

export type PeekSection = 'my' | 'share' | 'recent';
export type PeekPhase = 'idle' | 'pending' | 'open' | 'closing' | 'pinning';
/** components/ui/dnd.tsx `DragKind`의 사본 — import 0 규약이라 의도적 이중(listColumns verifyRank 전례) */
export type PeekDragKind = null | 'problem' | 'problems' | 'folder';

export interface PeekState {
  phase: PeekPhase;
  /** 펼친 섹션. null = 세 헤더 모두 접힘(섹션 아이콘이 아닌 곳으로 연 peek — 67b). pending은 열 예정인 섹션 */
  section: PeekSection | null;
  /** 닫힘 보류 카운터(메뉴·피커·DnD) — phase와 독립으로 산다(G5) */
  holds: number;
  /** 포인터가 패널 안인가 — railEnter·railClick·panelEnter가 true, panelLeave가 false, 훅의 재판정이 덮어쓴다 */
  inside: boolean;
  /** open이 idle·pending에서 왔는가 — peekIn 1회 재생용(V13). closing→open 되감기는 false, idle 진입 시 false(W3) */
  fresh: boolean;
  /** idle→pending마다 +1 — open 타이머 effect deps(W1). 레일 안 섹션 이동(pending→pending)은 올리지 않는다(67b) */
  pendingSeq: number;
  /** inside 참→거짓 · holds→0 마다 +1 — close 타이머 effect deps(W1 · Y2) */
  leaveSeq: number;
  /** 어떻게 열렸나(W6) — 터치 peek은 항목 선택 시 닫힌다. idle에서는 null */
  via: 'hover' | 'touch' | null;
}

export type PeekEvent =
  /** 레일 진입·레일 안 이동 — section은 포인터 밑 섹션 아이콘(없으면 null) */
  | { type: 'railEnter'; section: PeekSection | null; dragKind: PeekDragKind; collapsed: boolean }
  | { type: 'railLeave' }
  | { type: 'openTimer' }
  | { type: 'railClick'; section: PeekSection; pointerType: string }
  | { type: 'panelEnter' }
  | { type: 'panelLeave' }
  | { type: 'setInside'; inside: boolean }
  | { type: 'closeTimer' }
  | { type: 'panelTransitionEnd' }
  | { type: 'asideTransitionEnd' }
  | { type: 'switchSection'; section: PeekSection }
  | { type: 'hold' }
  | { type: 'release' }
  | { type: 'pin' }
  | { type: 'outsidePointerDown' }
  | { type: 'itemSelected' }
  | { type: 'dragStart' }
  | { type: 'collapsedChanged'; collapsed: boolean };

/** 레일에 포인터가 머문 뒤 펼칠 때까지(ms) — 레일을 스치기만 해서는 안 펼친다 */
export const PEEK_OPEN_DELAY = 80;
/** 패널을 벗어난 뒤 접기 시작할 때까지(ms) — 가장자리 1~2px 이탈·메뉴로 건너가는 틈 흡수 */
export const PEEK_CLOSE_GRACE = 180;
/** 패널 안에서 다른 섹션 헤더에 머문 뒤 전환할 때까지(ms) */
export const PEEK_SWITCH_INTENT = 150;
/** 섹션 전환·open 직후, 포인터가 이만큼 움직여야 헤더 hover intent를 건다(px) — 헤더가 정지 포인터 밑으로 미끄러져 드는 연쇄 차단 */
export const PEEK_MOVE_ARM_PX = 4;
/** closing의 transitionend 누락 폴백(ms) = 접힘 160 + 60 */
export const PEEK_CLOSE_FALLBACK = 220;
/** pinning의 transitionend 누락 폴백(ms) = --transition-normal 200 + 60 */
export const PEEK_PIN_FALLBACK = 260;

export const INITIAL_PEEK_STATE: PeekState = {
  phase: 'idle', section: null, holds: 0, inside: false,
  fresh: false, pendingSeq: 0, leaveSeq: 0, via: null,
};

/** hover peek에 참여하는 포인터인가 — 터치는 enter/leave가 탭에 묶여 hover로 읽으면 안 된다(D5) */
export function isHoverPointerType(pointerType: string): boolean {
  return pointerType === 'mouse' || pointerType === 'pen';
}

/** 훅은 이 값이 참인 동안만 closeTimer(PEEK_CLOSE_GRACE)를 건다 — deps [needsCloseTimer, leaveSeq] */
export function needsCloseTimer(s: PeekState): boolean {
  return s.phase === 'open' && s.holds === 0 && !s.inside;
}

/** idle로 — 불변식 idle ⇒ section·fresh·via 초기화. holds·inside·seq는 phase와 독립이라 보존 */
function toIdle(s: PeekState): PeekState {
  return { ...s, phase: 'idle', section: null, fresh: false, via: null };
}

/** inside 갱신 — 값이 같으면 같은 객체(Y2), 참→거짓이면 leaveSeq+1 */
function withInside(s: PeekState, inside: boolean): PeekState {
  if (s.inside === inside) return s;
  return { ...s, inside, leaveSeq: inside ? s.leaveSeq : s.leaveSeq + 1 };
}

export function reducePeek(s: PeekState, e: PeekEvent): PeekState {
  switch (e.type) {
    case 'railEnter': {
      // 고정 펼침에서는 레일이 없다(패널 수준 트리거라 이벤트는 온다 — 67b). DnD 중에는 열지 않는다(D9).
      if (!e.collapsed || e.dragKind !== null) return s;
      if (s.phase === 'idle') {
        return { ...s, phase: 'pending', section: e.section, inside: true, pendingSeq: s.pendingSeq + 1 };
      }
      if (s.phase === 'pending') {
        // 레일 안 이동 — 열릴 섹션만 바꾸고 타이머는 그대로(⑥)
        return s.section === e.section && s.inside ? s : { ...s, section: e.section, inside: true };
      }
      return s;
    }
    case 'railLeave':
      return s.phase === 'pending' ? toIdle(s) : s;

    case 'openTimer':
      return s.phase === 'pending' ? { ...s, phase: 'open', fresh: true, via: 'hover' } : s;

    case 'railClick': {
      // 터치는 railEnter가 안 온다 → inside를 여기서 세워야 열자마자 닫히지 않는다(V9)
      if (s.phase !== 'idle' && s.phase !== 'pending') return s;
      return {
        ...s, phase: 'open', section: e.section, inside: true, fresh: true,
        via: isHoverPointerType(e.pointerType) ? 'hover' : 'touch',
      };
    }

    case 'panelEnter': {
      const t = withInside(s, true);
      // 닫히는 중 재진입 = 되감기. peekIn은 재생하지 않는다(V13)
      if (s.phase === 'closing') return { ...t, phase: 'open', fresh: false };
      return t;
    }
    case 'panelLeave':
      return withInside(s, false);
    case 'setInside':
      // 훅의 elementFromPoint 재판정(V12) — 위치만 바꾼다. 되감기는 panelEnter의 몫
      return withInside(s, e.inside);

    case 'closeTimer':
      return needsCloseTimer(s) ? { ...s, phase: 'closing' } : s;

    case 'panelTransitionEnd':
      // ⚠ pinning에서도 무시 — 패널 폭 종료가 pinning을 끝내면 main이 패널을 덮는다(V8)
      return s.phase === 'closing' ? toIdle(s) : s;
    case 'asideTransitionEnd':
      return s.phase === 'pinning' ? toIdle(s) : s;

    case 'switchSection':
      // hold 중 보류(N3) — 메뉴를 연 채 전환하면 트리가 언마운트되어 메뉴가 저절로 사라진다
      if (s.phase !== 'open' || s.holds > 0 || s.section === e.section) return s;
      return { ...s, section: e.section };

    case 'hold':
      return { ...s, holds: s.holds + 1 };
    case 'release':
      if (s.holds === 0) return s;
      return s.holds === 1
        ? { ...s, holds: 0, leaveSeq: s.leaveSeq + 1 }   // 풀린 시점부터 유예를 새로 센다
        : { ...s, holds: s.holds - 1 };

    case 'pin':
      return s.phase === 'open' || s.phase === 'closing' ? { ...s, phase: 'pinning', fresh: false } : s;

    case 'outsidePointerDown':
      // 포인터 종류 무관 · holds 무시 — 포인터가 이미 밖이다(W5)
      return s.phase === 'open' ? { ...s, phase: 'closing' } : s;

    case 'itemSelected':
      // 마우스 peek은 포인터가 안에 있으니 머문다. 터치는 떠나는 사건이 없어 여기서 닫는다(W6)
      return s.phase === 'open' && s.via === 'touch' ? { ...s, phase: 'closing' } : s;

    case 'dragStart':
      return s.phase === 'pending' ? toIdle(s) : s;

    case 'collapsedChanged':
      if (e.collapsed) return s.phase === 'pinning' ? toIdle(s) : s;
      // 펼침: pin 경로(pinning)만 살아남는다. idle은 이미 idle(레일 열기 버튼 — W8)
      return s.phase === 'pinning' || s.phase === 'idle' ? s : toIdle(s);
  }
}

/** 렌더 파생값 — JSX 안 조건은 테스트가 못 보므로 여기서 낸다(M3 전례). 사양 D1·D2·D6·D17 */
export interface PeekView {
  /** 섹션 열림을 peek 단일 활성으로 읽는가(D6) — 아니면 고정 상태값 */
  peeking: boolean;
  /** 펼침 레이아웃으로 그리는가(D2) */
  expandedLook: boolean;
  /** 레일 레이아웃(D2) = !expandedLook */
  renderCollapsed: boolean;
  /** 콘텐츠 래퍼 폭을 사이드바 폭으로 고정하는가(D2 · V16 · W7) — 아니면 100% */
  lockContentWidth: boolean;
  /** 콘텐츠 래퍼 peekIn 재생(D2 · V13 · W3) */
  playPeekIn: boolean;
  /** 떠 있는 카드 모양 — 우측 radius + --drawer-shadow(D17) */
  peekCard: boolean;
  /** 바깥 aside z 80(D1) — idle 외 전부. 상시 80은 ShareButton 배경(40)과 충돌 */
  raised: boolean;
  /** 패널 폭이 사이드바 폭인가(아니면 56) */
  panelWide: boolean;
}

export function peekView(s: PeekState, collapsed: boolean): PeekView {
  const p = s.phase;
  const peeking = collapsed && (p === 'open' || p === 'closing');
  const expandedLook = !collapsed || p === 'open' || p === 'closing' || p === 'pinning';
  return {
    peeking,
    expandedLook,
    renderCollapsed: !expandedLook,
    lockContentWidth: p === 'open' || p === 'closing' || p === 'pinning',
    playPeekIn: p === 'open' && s.fresh,
    peekCard: peeking,
    raised: p !== 'idle',
    panelWide: !collapsed || p === 'open' || p === 'pinning',
  };
}
