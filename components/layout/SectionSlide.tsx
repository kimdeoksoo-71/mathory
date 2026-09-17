'use client';
/* ═══════════════════════════════════════════════════════════════
   Phase 67b — 사이드바 섹션(My·공유·최근 문항) 내용의 상하 슬라이드.
   덕수 실사용 요청: peek에서 포인터가 헤더 사이를 옮겨 다닐 때 섹션이 순간적으로 접히고 펼쳐져 피로하다 →
   좌우 peek과 같은 속도·감속(--transition-peek-open 200ms)으로 **펼침과 접힘을 동시에** 슬라이드한다.
   (접힘만 즉시면 위 섹션이 접힐 때 아래 헤더가 한 번에 수백 px 튄다 · 접힘만 짧으면 사이 헤더가 출렁인다)

   방식: grid 한 줄의 행 높이를 0fr ↔ 1fr로 전환(Safari 16+ · Chrome 107+ · Firefox 66+). height:auto 애니메이션
   (interpolate-size)은 Chrome 전용이라 쓰지 않는다.
   ⚠ 함정 셋 —
   ① 접힐 때 내용을 바로 빼면 슬라이드할 것이 없다 → 끝날 때까지 남겼다가 뺀다. **끝까지 남겨 두면 안 된다** —
      숨은 폴더 행이 드롭 타깃으로 살아 다른 섹션 위 드롭을 가로챈다(0 높이여도 자식 rect는 살아 있다).
   ② 넘침 자르기는 **슬라이드 중·닫힘에만**. 멈춘 열림에서 자르면 폴더 행의 드래그 손잡이(left -12)와 드롭 링(2px)이 잘린다.
   ③ grid 칸은 독립 서식 문맥이라 **첫 자식의 marginTop이 바깥 마진과 겹치지 않는다** — 감싸기만 해도 첫 자식 마진만큼
      밀린다. 소비처가 첫 자식 marginTop을 0으로 두어야 한다(Sidebar의 "미지정" 행 — 폴더가 없을 때만 첫 자식).
   animate=false(고정 펼침·peek이 처음 열리는 순간)는 현행처럼 즉시 붙이고 뗀다.
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';

/** transitionend 누락 폴백(ms) = 200 + 60 */
const SLIDE_FALLBACK = 260;

export default function SectionSlide({ open, animate, children }: {
  open: boolean;
  /** 슬라이드 여부 — Sidebar는 peek 중(open·closing)에만 참 */
  animate: boolean;
  children: React.ReactNode;
}) {
  const [prevOpen, setPrevOpen] = useState(open);
  /** 슬라이드 중인가 — 넘침 자르기(②)·내용 유지(①)의 근거 */
  const [moving, setMoving] = useState(false);
  /** 접힌 뒤에도 슬라이드가 끝날 때까지 내용을 남겨 둔다(①) */
  const [present, setPresent] = useState(open);

  // 렌더 중 prop 변화 반영(React 권장 패턴) — effect로 하면 한 프레임 동안 넘침이 안 잘린 채 0fr에서 출발한다
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (animate) { setMoving(true); if (open) setPresent(true); }
    else { setMoving(false); setPresent(open); }
  }

  const settle = () => { setMoving(false); if (!open) setPresent(false); };

  useEffect(() => {
    if (!moving) return;
    const t = setTimeout(settle, SLIDE_FALLBACK);
    return () => clearTimeout(t);
    // open이 바뀌면(슬라이드 도중 되돌림) 폴백을 다시 센다 — settle은 매 렌더 새 함수지만 최신 open을 읽어야 해서 deps에 넣지 않는다
  }, [moving, open]);

  return (
    <div
      style={{
        display: 'grid',
        /* ④ 열은 minmax(0, 1fr) — 기본(auto)이면 칸이 내용의 최소 폭 아래로 안 줄어 긴 폴더 이름(nowrap·말줄임)이 섹션을
           244 → 371px로 넓힌다(말줄임이 사라지고 행 높이까지 바뀐다). 짧은 이름뿐인 화면에서는 안 보인다. */
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: animate ? 'grid-template-rows var(--transition-peek-open)' : 'none',
      }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows') settle();
      }}
    >
      <div style={{ minHeight: 0, minWidth: 0, overflow: !open || moving ? 'hidden' : 'visible' }}>
        {(open || present) && children}
      </div>
    </div>
  );
}
