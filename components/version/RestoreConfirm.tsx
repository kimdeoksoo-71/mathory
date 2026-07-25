'use client';

import React from 'react';
import type { ContentDiff } from '../../lib/version/diff';
import VersionDiff from './VersionDiff';

/**
 * Phase 55 Stage 5 — 복원 확인 모달. "현재 → 대상" diff를 보여주고 확정.
 * 대상이 현재와 같으면 dedup 안내(복원 버튼 숨김).
 */
export default function RestoreConfirm({
  seq,
  diff,
  busy,
  onConfirm,
  onCancel,
}: {
  seq: number;
  diff: ContentDiff | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const same = diff !== null && !diff.anyChange;
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          background: 'var(--bg-panel, #fff)', borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-light)',
          fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
        }}>
          v{seq}(으)로 복원
        </div>

        <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            복원하면 현재 작업본이 아래처럼 바뀝니다 (현재 → v{seq}). 복원 직전 상태는 자동으로 버전에 보존됩니다.
          </div>
          {diff === null
            ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>비교 준비 중…</div>
            : <VersionDiff diff={diff} />}
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-light)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: '6px 14px', border: '1px solid var(--border-light)', borderRadius: 6,
            background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
          }}>취소</button>
          {!same && (
            <button onClick={onConfirm} disabled={busy} style={{
              padding: '6px 14px', border: 'none', borderRadius: 6,
              background: '#e53935', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
            }}>{busy ? '복원 중…' : '복원'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
