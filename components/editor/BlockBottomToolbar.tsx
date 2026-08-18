'use client';

/**
 * BlockBottomToolbar — 활성 블록 하단에 붙는 편집 툴바.
 *
 * 통합툴바에서 옮겨온 3개 버튼(블록 추가 / 블록 분할 / 수식행 분할)을
 * 블록 본문 아래에 배치한다. 상단바와 동일한 모양(세로폭·색·구분선).
 * 아이콘은 통합툴바 아이콘에서 사각 귀퉁이 브라켓을 제외한 글리프만 사용.
 */

import { useEffect, useRef, useState } from 'react';

export interface BottomToolbarBlockType {
  type: string;
  label: string;
}

// ── 브라켓 없는 글리프 아이콘 (viewBox 64×64) ──
const ICON_PROPS = {
  width: 15,
  height: 15,
  viewBox: '0 0 64 64',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function PlusGlyph() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M32 16 L32 48" />
      <path d="M16 32 L48 32" />
    </svg>
  );
}

function SplitGlyph() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 32 L52 32" />
      <path d="M22 22 L12 32 L22 42" />
      <path d="M42 22 L52 32 L42 42" />
    </svg>
  );
}

function MathSplitGlyph() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14 25 L36 25" />
      <path d="M14 39 L36 39" />
      <circle cx="46" cy="25" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="46" cy="39" r="3.2" fill="currentColor" stroke="none" />
    </svg>
  );
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
