'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProblemVersion, VersionContent } from '../../types/version';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { loadContent, resolveLivingParent } from '../../lib/version/read';
import { diffContent } from '../../lib/version/diff';
import VersionTimeline from './VersionTimeline';
import VersionDiff from './VersionDiff';
import RestoreConfirm from './RestoreConfirm';

/**
 * Phase 55 Stage 5 — 우측 버전 기록 드로어.
 * 타임라인 + 선택 버전 diff(기본: 부모와 비교 / 토글: 현재 작업본과 비교) + 비파괴 복원.
 */
export default function VersionDrawer({
  problemId,
  open,
  onClose,
  getCurrentContent,
  onRestore,
}: {
  problemId: string;
  open: boolean;
  onClose: () => void;
  getCurrentContent: () => VersionContent | null;
  onRestore: (target: ProblemVersion, content: VersionContent) => Promise<void>;
}) {
  const { versions, loading, hasMore, loadFirst, loadMore } = useVersionHistory(problemId);
  const [selected, setSelected] = useState<ProblemVersion | null>(null);
  const [vContent, setVContent] = useState<VersionContent | null>(null);
  const [parentContent, setParentContent] = useState<VersionContent | null>(null);
  const [compareMode, setCompareMode] = useState<'parent' | 'current'>('parent');
  const [currentSnap, setCurrentSnap] = useState<VersionContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  useEffect(() => {
    if (open) {
      loadFirst();
      setSelected(null); setVContent(null); setParentContent(null); setCompareMode('parent');
    }
  }, [open, loadFirst]);

  const handleSelect = async (v: ProblemVersion) => {
    setSelected(v);
    setVContent(null); setParentContent(null); setCompareMode('parent'); setCurrentSnap(null);
    setContentLoading(true);
    try {
      const vc = await loadContent(problemId, v.id);
      setVContent(vc);
      const parent = await resolveLivingParent(problemId, v, versions);
      setParentContent(parent ? await loadContent(problemId, parent.id) : null);
    } catch (e) {
      console.error('[Phase55] 버전 본문 로드 실패:', e);
    } finally {
      setContentLoading(false);
    }
  };

  const toggleCompare = () => {
    if (compareMode === 'parent') {
      setCurrentSnap(getCurrentContent());
      setCompareMode('current');
    } else {
      setCompareMode('parent');
    }
  };

  const shownDiff = useMemo(() => {
    if (!vContent) return null;
    if (compareMode === 'current') return currentSnap ? diffContent(vContent, currentSnap) : null;
    return diffContent(parentContent, vContent);
  }, [compareMode, vContent, parentContent, currentSnap]);

  const restoreDiff = useMemo(() => {
    if (!restoreOpen || !vContent) return null;
    return diffContent(getCurrentContent(), vContent);
  }, [restoreOpen, vContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRestore = async () => {
    if (!selected || !vContent) return;
    setRestoreBusy(true);
    try {
      await onRestore(selected, vContent);
      setRestoreOpen(false);
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '92vw',
      transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.22s ease',
      background: 'var(--bg-panel, #fff)', borderLeft: '1px solid var(--border-light)',
      boxShadow: open ? '-6px 0 24px rgba(0,0,0,0.08)' : 'none',
      display: 'flex', flexDirection: 'column', zIndex: 1200,
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', minHeight: 57, padding: '0 14px',
        borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-functional)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>버전 기록</span>
        <button onClick={onClose} title="닫기" style={{
          marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--text-muted)', padding: 4, lineHeight: 1,
        }}>×</button>
      </div>

      {/* 타임라인 */}
      <div style={{ flex: selected ? '0 0 42%' : 1, overflowY: 'auto', minHeight: 0 }}>
        <VersionTimeline
          versions={versions} selectedId={selected?.id ?? null} onSelect={handleSelect}
          hasMore={hasMore} loading={loading} onLoadMore={loadMore}
        />
      </div>

      {/* 선택 버전 diff + 복원 */}
      {selected && (
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          borderTop: '2px solid var(--border-light)', background: 'var(--bg-functional, #fafafa)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
            borderBottom: '1px solid var(--border-light)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>v{selected.seq}</span>
            <button onClick={toggleCompare} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
              border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)',
            }}>
              {compareMode === 'parent' ? '이전 버전과 비교' : '현재 작업본과 비교'}
            </button>
            <button onClick={() => setRestoreOpen(true)} style={{
              marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 5, cursor: 'pointer',
              border: 'none', background: '#e53935', color: '#fff', fontWeight: 600,
            }}>이 버전으로 복원</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 12px' }}>
            {contentLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>본문 불러오는 중…</div>}
            {!contentLoading && shownDiff && <VersionDiff diff={shownDiff} />}
          </div>
        </div>
      )}

      {restoreOpen && selected && (
        <RestoreConfirm
          seq={selected.seq} diff={restoreDiff} busy={restoreBusy}
          onConfirm={doRestore} onCancel={() => setRestoreOpen(false)}
        />
      )}
    </div>
  );
}
