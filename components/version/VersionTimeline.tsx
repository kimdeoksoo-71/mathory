'use client';

import React from 'react';
import type { ProblemVersion, VersionTrigger } from '../../types/version';
import { IconSave, IconExit, IconTag, IconRestore, IconPin, IconExport } from '../ui/Icons';

// Phase 55b: 트리거 4종 전부 아이콘 시스템 규격 SVG (이모지 잔존 0)
const TRIGGER_ICON: Record<VersionTrigger, React.ComponentType<{ size?: number }>> = {
  manual_save: IconSave,
  editor_exit: IconExit,
  named: IconTag,
  restore: IconRestore,
};
const TRIGGER_LABEL: Record<VersionTrigger, string> = {
  manual_save: '저장',
  editor_exit: '이탈 저장',
  named: '이름 저장',
  restore: '복원',
};

function relTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return '방금 전';
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}달 전`;
}

function toMs(v: ProblemVersion): number | null {
  const ca = v.created_at as unknown as { toDate?: () => Date } | null;
  try {
    return ca?.toDate ? ca.toDate().getTime() : null;
  } catch {
    return null;
  }
}

export default function VersionTimeline({
  versions,
  selectedId,
  onSelect,
  hasMore,
  loading,
  onLoadMore,
}: {
  versions: ProblemVersion[];
  selectedId: string | null;
  onSelect: (v: ProblemVersion) => void;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  if (!loading && versions.length === 0) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
        아직 저장된 버전이 없습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {versions.map((v) => {
        const selected = v.id === selectedId;
        const trigger = v.trigger || 'manual_save';
        const TriggerIcon = TRIGGER_ICON[trigger] || IconSave;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'stretch',
              textAlign: 'left', padding: '9px 12px', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid var(--border-light)',
              background: selected ? 'var(--bg-input, #eef2ff)' : 'transparent',
              borderLeft: selected ? '3px solid var(--accent-primary, #e53935)' : '3px solid transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                v{v.seq}
              </span>
              <span title={TRIGGER_LABEL[trigger]} style={{
                fontSize: 12, display: 'inline-flex', alignItems: 'center',
                color: 'var(--text-secondary)',
              }}>
                <TriggerIcon size={14} />
              </span>
              {v.name && (
                <span style={{ fontSize: 12, color: 'var(--accent-primary, #e53935)', fontWeight: 600 }}>
                  {v.name}
                </span>
              )}
              {v.pinned && (
                <span title="고정" style={{
                  display: 'inline-flex', alignItems: 'center', color: 'var(--accent-primary, #e53935)',
                }}><IconPin size={12} filled /></span>
              )}
              {/* Phase 55b: 내보냄 표시(표시 전용 — 조작은 선택 버전 툴바에서) */}
              {v.github_export && (
                <span title={`GitHub에 내보냄 (${v.github_export.path})`} style={{
                  display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)',
                }}><IconExport size={12} /></span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                {relTime(toMs(v))}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {v.created_by?.display_name || '—'}
              </span>
              {(v.changed_tabs || []).map((t) => (
                <span key={t} style={{
                  fontSize: 10, padding: '1px 5px', borderRadius: 3,
                  background: 'var(--bg-functional, #f0f0f0)', color: 'var(--text-muted)',
                }}>{t}</span>
              ))}
            </div>
          </button>
        );
      })}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          style={{
            padding: '8px', border: 'none', borderTop: '1px solid var(--border-light)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
          }}
        >
          {loading ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
