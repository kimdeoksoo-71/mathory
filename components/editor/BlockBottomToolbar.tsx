'use client';

/**
 * BlockBottomToolbar — 활성 블록 하단에 붙는 편집 툴바.
 *
 * 통합툴바에서 옮겨온 3개 버튼(블록 추가 / 블록 분할 / 수식행 분할)을
 * 블록 본문 아래에 배치한다. 상단바와 동일한 모양(세로폭·색·구분선).
 * M4: 글리프를 Phosphor로 — plus · split-vertical(블록을 위아래로 가른다, D16·N1)
 * · rows(수식행 분할). 15px 유지.
 */

import { useEffect, useRef, useState } from 'react';
import { PhIcon } from '../ui/Icons';
import { PH } from '../ui/phosphorPaths';

export interface BottomToolbarBlockType {
  type: string;
  label: string;
}

const GLYPH_SIZE = 15;

function PlusGlyph() {
  return <PhIcon d={PH.plus} size={GLYPH_SIZE} />;
}

function SplitGlyph() {
  return <PhIcon d={PH.splitBlock} size={GLYPH_SIZE} />;
}

function MathSplitGlyph() {
  return <PhIcon d={PH.rows} size={GLYPH_SIZE} />;
}

const BAR_BTN: React.CSSProperties = {
  width: 22,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  borderRadius: 4,
  padding: 0,
  transition: 'background 0.12s, color 0.12s',
};

function BarButton({
  title, onClick, disabled, children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={disabled}
      style={{
        ...BAR_BTN,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

export default function BlockBottomToolbar({
  blockTypes,
  onAddBlock,
  onSplitBlock,
  canSplitBlock,
  onSplitMathLines,
}: {
  blockTypes: BottomToolbarBlockType[];
  onAddBlock: (type: string) => void;
  onSplitBlock: () => void;
  canSplitBlock: boolean;
  onSplitMathLines: () => void;
}) {
  const [addPos, setAddPos] = useState<{ top: number; left: number } | null>(null);
  const addBtnRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const openAddMenu = () => {
    if (addPos) { setAddPos(null); return; }
    const el = addBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 블록 컨테이너가 overflow:hidden이라 fixed로 띄워 클리핑 우회
    setAddPos({ top: r.bottom + 4, left: r.left });
  };

  useEffect(() => {
    if (!addPos) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (addBtnRef.current?.contains(t) || addMenuRef.current?.contains(t)) return;
      setAddPos(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addPos]);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 16px', background: 'var(--block-bg-active)',   // Phase 45a D6″-g: 본문선(16px) 정렬
        // 본문↔하단툴바 구분 상단선 (상단바의 하단선과 대칭). 0.5px 헤어라인
        borderTop: '0.5px solid var(--block-border-active)',   // Phase 45a: 상단바 구분선과 대칭
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* 블록 추가 (드롭다운 — fixed 좌표로 띄움) */}
      <div ref={addBtnRef} style={{ display: 'flex' }}>
        <BarButton title="블록 추가" onClick={openAddMenu}>
          <PlusGlyph />
        </BarButton>
      </div>
      {addPos && (
        <div
          ref={addMenuRef}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: addPos.top, left: addPos.left,
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 3000, minWidth: 140, overflow: 'hidden',
          }}
        >
          {blockTypes.map((bt) => (
            <div
              key={bt.type}
              onClick={(e) => { e.stopPropagation(); onAddBlock(bt.type); setAddPos(null); }}
              style={{
                padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {bt.label}
            </div>
          ))}
        </div>
      )}

      {/* 블록 분할 */}
      <BarButton title="블록 분할 (⌘B)" onClick={onSplitBlock} disabled={!canSplitBlock}>
        <SplitGlyph />
      </BarButton>

      {/* 수식행 분할 */}
      <BarButton title="수식행 분할 (⌘⇧L)" onClick={onSplitMathLines}>
        <MathSplitGlyph />
      </BarButton>
    </div>
  );
}
