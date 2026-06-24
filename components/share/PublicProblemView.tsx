'use client';

import { useEffect, useMemo, useState } from 'react';
import { watchProblem, watchTabBlocks } from '../../lib/firestore';
import ProblemTabContent from './ProblemTabContent';
import PublicComments from './PublicComments';
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
  const [activeTab, setActiveTab] = useState<string>('');

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

  // 활성 탭 보정
  useEffect(() => {
    if (visibleTabs.length === 0) { setActiveTab(''); return; }
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab(visibleTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  if (status === 'loading') return <Centered>불러오는 중…</Centered>;
  if (status === 'unavailable' || !problem) {
    return <Centered>비공개로 전환되었거나 존재하지 않는 문항입니다.</Centered>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', fontFamily: 'var(--font-ui, sans-serif)' }}>
      {/* 헤더 (/shared 동일 로고·슬로건) */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <a
          href="https://mathory.app" target="_blank" rel="noopener noreferrer" title="Mathory로 가기"
          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textDecoration: 'none' }}
        >
          <span style={{ fontSize: 19, fontWeight: 500, color: 'var(--text-primary, #222)', letterSpacing: -0.5, fontFamily: 'var(--font-logo)', lineHeight: 1.1 }}>
            Mathory
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted, #888)', fontStyle: 'italic', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
            Write the logic. Preserve the insight.
          </span>
        </a>
        <div style={{ width: 1, height: 22, background: '#e0e0e0', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {problem.title || '제목 없음'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>실시간 공개 · 편집 즉시 반영</div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ fontSize: 15, margin: '24px auto', padding: '0 32px', width: 'fit-content', boxSizing: 'border-box' }}>
        {visibleTabs.length === 0 ? (
          <div style={{ width: '35em', background: '#fff', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888' }}>
            공개된 탭이 없습니다.
          </div>
        ) : (
          <>
            {visibleTabs.length > 1 && (
              <div style={{ width: 'calc(35em + 72px)', display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #ddd' }}>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: activeTab === tab.id ? 'var(--accent-primary, #B8845C)' : '#888',
                      borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary, #B8845C)' : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{
              width: 'calc(35em + 72px)', background: '#fff', borderRadius: 8, padding: '32px 36px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', boxSizing: 'border-box',
            }}>
              <ProblemTabContent blocks={tabBlocks[activeTab] || []} />
            </div>

            {/* 읽기 전용 댓글 (commentsVisible=false면 공개에 숨김 — 규칙도 차단) */}
            {problem.commentsVisible !== false && (
              <PublicComments problemId={problemId} commentSessionId={problem.commentSessionId ?? null} />
            )}
          </>
        )}
      </div>
    </div>
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
