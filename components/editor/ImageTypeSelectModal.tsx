'use client';

import { useEffect } from 'react';

export type ImageMediaKind = 'raster' | 'svg' | 'ggb';

interface Props {
  onSelect: (kind: ImageMediaKind) => void;
  onCancel: () => void;
}

const OPTIONS: { kind: ImageMediaKind; label: string; desc: string; disabled?: boolean }[] = [
  { kind: 'raster', label: '일반 이미지', desc: 'PNG · JPG · GIF · WebP' },
  { kind: 'svg', label: 'SVG', desc: '벡터 그림 (확대·축소·패닝 지원)' },
  { kind: 'ggb', label: 'GeoGebra', desc: '동적 기하·그래프 (.ggb)' },
];

export default function ImageTypeSelectModal({ onSelect, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8, padding: 20,
          width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #222)' }}>
          그림 종류 선택
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.kind}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onSelect(opt.kind)}
              title={opt.disabled ? '추후 지원 예정' : undefined}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                background: opt.disabled ? '#f5f5f5' : '#fff',
                border: '1px solid var(--border-light, #ddd)',
                borderRadius: 6,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                color: opt.disabled ? '#aaa' : 'var(--text-primary, #222)',
              }}
              onMouseEnter={(e) => {
                if (!opt.disabled) e.currentTarget.style.background = '#f5f7fa';
              }}
              onMouseLeave={(e) => {
                if (!opt.disabled) e.currentTarget.style.background = '#fff';
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: opt.disabled ? '#bbb' : 'var(--text-muted, #888)', marginTop: 2 }}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14, textAlign: 'right' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px', fontSize: 12,
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted, #888)',
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
