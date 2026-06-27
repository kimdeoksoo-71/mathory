'use client';

import { useEffect, useMemo, useState } from 'react';
import { watchProblem, watchTabBlocks } from '../../lib/firestore';
import PublicViewerShell from './PublicViewerShell';
import PublicComments from './PublicComments';
import ShareButton from './ShareButton';
import { Block, Problem, TabMeta, DEFAULT_TABS } from '../../types/problem';

/**
 * Phase 51: 실시간 공개 문항 뷰어 (`/p/{id}`). 완전 읽기 전용.
 * - problems/{id} + visible 탭 블록을 onSnapshot 구독 → 편집 즉시 반영
 * - 비공개 전환/삭제 시 permission-denied → 안내
 * - 댓글(읽기 전용)은 5단계에서 추가
 */
export default function PublicProblemView({ problemId }: { problemId: string }) {
  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading');
  const [tabBlocks, setTabBlocks] = useState<Record<string, Block[]>>({});

  // 문항 문서 구독
  useEffect(() => {
    if (!problemId) return;
    const unsub = watchProblem(
      problemId,
      (p) => {
        if (!p || p.visibility !== 'public') { setProblem(null); setStatus('unavailable'); return; }
        setProblem(p); setStatus('ok');
      },
      () => { setProblem(null); setStatus('unavailable'); },
    );
    return () => unsub();
  }, [problemId]);

  const visibleTabs = useMemo<TabMeta[]>(() => {
    if (!problem) return [];
    const tabs = (problem.tabs && problem.tabs.length > 0) ? problem.tabs : DEFAULT_TABS;
    const mtv = problem.memberTabVisibility;
    return tabs.filter((t) => !mtv || mtv[t.id] !== false);
  }, [problem]);

  const visibleKey = visibleTabs.map((t) => t.id).join(',');

  // 블록 구독 (visible 탭별). 비공개 탭은 규칙(4-1)으로 permission-denied → 빈 상태.
  useEffect(() => {
    if (!problemId || visibleTabs.length === 0) { setTabBlocks({}); return; }
    const unsubs = visibleTabs.map((t) =>
      watchTabBlocks(problemId, t.id, (blocks) =>
        setTabBlocks((prev) => ({ ...prev, [t.id]: blocks })),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, visibleKey]);

  if (status === 'loading') return <Centered>불러오는 중…</Centered>;
  if (status === 'unavailable' || !problem) {
    return <Centered>비공개로 전환되었거나 존재하지 않는 문항입니다.</Centered>;
  }

  const url = typeof window !== 'undefined' ? `${window.location.origin}/p/${problemId}` : `/p/${problemId}`;

  return (
    <PublicViewerShell
      title={problem.title || '제목 없음'}
      meta="실시간 공개 · 편집 즉시 반영"
      tabs={visibleTabs}
      tabBlocks={tabBlocks}
      rightSlot={
        <ShareButton url={url} title={problem.title || 'Mathory 문항'} tags={problem.tags || []} compact />
      }
      commentsSlot={problem.commentsVisible !== false ? (
        <PublicComments
          problemId={problemId}
          commentSessionId={problem.commentSessionId ?? null}
          writeEnabled={problem.publicCommentsEnabled === true}
        />
      ) : undefined}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#666', fontFamily: 'var(--font-ui, sans-serif)', fontSize: 14,
    }}>
      {children}
    </div>
  );
}
