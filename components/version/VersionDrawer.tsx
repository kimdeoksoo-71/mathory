'use client';

import React, { useEffect, useState } from 'react';
import type { ProblemVersion, VersionContent } from '../../types/version';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { loadContent } from '../../lib/version/read';
import VersionTimeline from './VersionTimeline';

/**
 * Phase 55 Stage 4 — 우측 버전 기록 드로어.
 * 타임라인(메타만) + 행 선택 시 본문 지연 로딩 → 읽기 전용 미리보기.
 * diff·복원은 Stage 5에서 이 드로어에 얹는다.
 */
export default function VersionDrawer({
  problemId,
  open,
  onClose,
}: {
  problemId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { versions, loading, hasMore, loadFirst, loadMore } = useVersionHistory(problemId);
  const [selected, setSelected] = useState<ProblemVersion | null>(null);
  const [content, setContent] = useState<VersionContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // 열릴 때마다 목록 갱신 (저장으로 새 버전이 생겼을 수 있음)
  useEffect(() => {
    if (open) {
      loadFirst();
      setSelected(null);
      setContent(null);
    }
  }, [open, loadFirst]);

  const handleSelect = async (v: ProblemVersion) => {
    setSelected(v);
    setContent(null);
    setContentLoading(true);
    try {
      setContent(await loadContent(problemId, v.id));
    } catch (e) {
      console.error('[Phase55] 버전 본문 로드 실패:', e);
    } finally {
      setContentLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '90vw',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s ease',
        background: 'var(--bg-panel, #fff)', borderLeft: '1px solid var(--border-light)',
        boxShadow: open ? '-6px 0 24px rgba(0,0,0,0.08)' : 'none',
        display: 'flex', flexDirection: 'column', zIndex: 1200,
      }}
    >
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', minHeight: 57, padding: '0 14px',
        borderBottom: '1px solid var(--border-light)', flexShrink: 0,
        background: 'var(--bg-functional)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>버전 기록</span>
        <button onClick={onClose} title="닫기" style={{
          marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--text-muted)', padding: 4, lineHeight: 1,
        }}>×</button>
      </div>

      {/* 타임라인 */}
      <div style={{ flex: selected ? '0 0 50%' : 1, overflowY: 'auto', minHeight: 0 }}>
        <VersionTimeline
          versions={versions}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
        />
      </div>

      {/* 선택 버전 본문 미리보기 (읽기 전용) */}
      {selected && (
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '2px solid var(--border-light)',
          padding: '10px 12px', fontSize: 12, background: 'var(--bg-functional, #fafafa)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            v{selected.seq} 미리보기 (읽기 전용) · diff/복원은 다음 단계
          </div>
          {contentLoading && <div style={{ color: 'var(--text-muted)' }}>본문 불러오는 중…</div>}
          {content && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(content.meta?.title || content.meta?.answer) && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <div><b>제목:</b> {content.meta.title || '—'}</div>
                  <div><b>정답:</b> {content.meta.answer || '—'}</div>
                </div>
              )}
              {content.tabs.map((tab) => (
                <div key={tab.key}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {tab.title}
                  </div>
                  {[...tab.blocks].sort((a, b) => a.order - b.order).map((b) => (
                    <pre key={b.block_key} style={{
                      margin: '0 0 6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
                      color: 'var(--text-secondary, #444)', lineHeight: 1.5,
                    }}>{b.raw_text}</pre>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
