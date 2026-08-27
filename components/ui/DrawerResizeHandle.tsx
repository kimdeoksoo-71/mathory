'use client';
import React from 'react';

/** Phase 62 — 드로어·패널 폭 조절 strip. 10px 투명 히트영역 + 가운데 1.5px 활성선.
 *  EditorView·ProblemView에 두 벌로 복제돼 있던 JSX의 단일 구현이다.
 *
 *  ⚠ `side`는 "positioned 부모의 어느 변에서 offset할지"이고, useDrawerResize의 `anchor`와 다른 개념이다.
 *  ⚠ overflow가 걸린 상자 안에 두면 잘린다 — `overflow-y: auto`는 가로도 함께 잘린다.
 *     (Sidebar의 <aside>는 overflow:hidden, ProblemView 우측 단은 overflowY:auto → 둘 다 루트에 마운트한다)
 *  ⚠ 버전 드로어 핸들은 드로어 안쪽(스태킹 컨텍스트 110)에 두고 zIndex를 올리지 말 것 —
 *     루트에 zIndex>110으로 두면 RestoreConfirm(1400) 위에 strip이 뜬다. */
export default function DrawerResizeHandle({
  side, offset, active, zIndex = 100, onPointerDown, onPointerEnter, onPointerLeave,
}: {
  side: 'left' | 'right';
  offset: number;
  active: boolean;
  zIndex?: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <div
      data-resize-handle
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute', top: 0, bottom: 0,
        [side]: offset,
        width: 10, zIndex,
        cursor: 'col-resize',
        touchAction: 'none',          // 터치에서 스크롤 제스처에 뺏기지 않게
        display: 'flex', justifyContent: 'center',
      } as React.CSSProperties}
    >
      <div style={{
        width: active ? 1.5 : 0, height: '100%',
        background: 'var(--border-content-active)',
        transition: 'width 0.1s',
      }} />
    </div>
  );
}
