'use client';

import React from 'react';
import type { ContentDiff, BlockDiff, BlockDiffKind } from '../../lib/version/diff';

const KIND_BADGE: Record<BlockDiffKind, { label: string; color: string; bg: string } | null> = {
  unchanged: null,
  added: { label: '추가', color: '#137333', bg: '#e6f4ea' },
  removed: { label: '삭제', color: '#c5221f', bg: '#fce8e6' },
  modified: { label: '수정', color: '#8a6d0b', bg: '#fef7e0' },
  moved: { label: '이동', color: '#1a56c4', bg: '#e8f0fe' },
  moved_modified: { label: '이동+수정', color: '#1a56c4', bg: '#e8f0fe' },
};

function WordDiff({ parts }: { parts: NonNullable<BlockDiff['textParts']> }) {
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((p, i) => (
        <span
          key={i}
          style={
            p.added
              ? { background: '#c9f2d4', color: '#0b6b2e' }
              : p.removed
              ? { background: '#ffd0d4', color: '#a01722', textDecoration: 'line-through' }
              : undefined
          }
        >
          {p.value}
        </span>
      ))}
    </span>
  );
}

function BlockRow({ bd }: { bd: BlockDiff }) {
  const badge = KIND_BADGE[bd.kind];
  const raw = (bd.after || bd.before)?.raw_text ?? '';
  const bg =
    bd.kind === 'added' ? '#f2fbf5'
    : bd.kind === 'removed' ? '#fff5f5'
    : bd.kind === 'unchanged' ? 'transparent'
    : '#fffdf5';

  return (
    <div style={{
      padding: '5px 8px', borderRadius: 5, background: bg, marginBottom: 4,
      opacity: bd.kind === 'unchanged' ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(bd.after || bd.before)?.type}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 3,
            color: badge.color, background: badge.bg,
          }}>{badge.label}</span>
        )}
      </div>
      <pre style={{
        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 11, lineHeight: 1.5,
        color: bd.kind === 'removed' ? '#a01722' : 'var(--text-secondary, #444)',
        textDecoration: bd.kind === 'removed' ? 'line-through' : undefined,
      }}>
        {bd.textParts ? <WordDiff parts={bd.textParts} /> : raw}
      </pre>
    </div>
  );
}

export default function VersionDiff({ diff }: { diff: ContentDiff }) {
  if (!diff.anyChange) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        두 버전의 내용이 같습니다.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
      {/* 메타 변경 */}
      {(diff.meta.titleChanged || diff.meta.answerChanged) && (
        <div style={{ padding: '6px 8px', borderRadius: 5, background: '#fffdf5' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>문항 메타</div>
          {diff.meta.titleChanged && (
            <div style={{ fontSize: 11 }}>
              제목: <span style={{ color: '#a01722', textDecoration: 'line-through' }}>{diff.meta.before.title || '—'}</span>
              {' → '}<span style={{ color: '#0b6b2e' }}>{diff.meta.after.title || '—'}</span>
            </div>
          )}
          {diff.meta.answerChanged && (
            <div style={{ fontSize: 11 }}>
              정답: <span style={{ color: '#a01722', textDecoration: 'line-through' }}>{diff.meta.before.answer || '—'}</span>
              {' → '}<span style={{ color: '#0b6b2e' }}>{diff.meta.after.answer || '—'}</span>
            </div>
          )}
        </div>
      )}

      {/* 탭별 블록 diff */}
      {diff.tabs.map((tab) => (
        <div key={tab.key}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {tab.title}{!tab.changed && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · 변경 없음</span>}
          </div>
          {tab.changed && tab.blocks.map((bd) => <BlockRow key={bd.block_key} bd={bd} />)}
        </div>
      ))}
    </div>
  );
}
