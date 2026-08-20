'use client';

import { useEffect, useState } from 'react';
import { Block, TabMeta } from '../../types/problem';
import ProblemTabContent from './ProblemTabContent';

/**
 * Phase 52 5b: 공개 뷰어 공통 셸 (`/p`·`/shared`).
 * - 고정 헤더(로고만, 슬로건 제거) + 제목 바 + rightSlot(공유·오너).
 * - 2단(4.2): 넓고 visibleTabs 정확히 2개면 좌(문제)·우(풀이) 분리 스크롤. 그 외 1단+탭버튼 폴백(R7).
 * - 분리 스크롤(4.4): 100dvh flex 열, 각 단·패널 독립 overflow.
 * - 슬로건 이동(4.5): 헤더에서 제거 → 마지막 단 하단 재배치.
 * - 댓글 슬라이딩 패널(4.1): commentsSlot 있을 때만(실시간) 우측 토글 → 3단.
 */
export interface PublicViewerShellProps {
  title: string;
  meta?: React.ReactNode;       // 제목 아래 보조 줄(공개 상태·만료 등)
  rightSlot?: React.ReactNode;  // 공유 버튼 + 오너 배지
  tabs: TabMeta[];              // visible 탭
  tabBlocks: Record<string, Block[]>;
  commentsSlot?: React.ReactNode; // 실시간 전용. 없으면 댓글 패널 미노출
}

const WIDE_BREAKPOINT = 880;

export default function PublicViewerShell({
  title, meta, rightSlot, tabs, tabBlocks, commentsSlot,
}: PublicViewerShellProps) {
  const [wide, setWide] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id ?? '');
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE_BREAKPOINT);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 활성 탭 보정(탭 변동 시)
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTab)) setActiveTab(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.id).join(',')]);

  const twoColumn = wide && tabs.length === 2;

  return (
    // U6(Phase 53): 100dvh → 100% — MiniShell/앱 셸의 콘텐츠 영역에 임베드 가능한 형태
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-content)', fontFamily: 'var(--font-ui, sans-serif)' }}>
      {/* ── 제목 바 (브랜딩·네비는 MiniShell 좌측 사이드바가 담당) ── */}
      <header style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>{title || '제목 없음'}</div>
          {meta && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{meta}</div>}
        </div>
        {rightSlot}
        {commentsSlot && (
          <button
            onClick={() => setCommentsOpen((v) => !v)}
            title={commentsOpen ? '댓글 닫기' : '댓글 열기'}
            style={commentToggleStyle(commentsOpen)}
          >
            <BubbleIcon />
          </button>
        )}
      </header>

      {/* ── 본문(분리 스크롤) ── */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {tabs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #888)', fontSize: 14 }}>
            공개된 탭이 없습니다.
          </div>
        ) : twoColumn ? (
          <>
            <ScrollColumn>
              <ContentCard><ProblemTabContent blocks={tabBlocks[tabs[0].id] || []} tabId={tabs[0].id} /></ContentCard>
            </ScrollColumn>
            <ScrollColumn divider>
              <ContentCard><ProblemTabContent blocks={tabBlocks[tabs[1].id] || []} tabId={tabs[1].id} /></ContentCard>
              <Slogan />
            </ScrollColumn>
          </>
        ) : (
          <ScrollColumn>
            {tabs.length > 1 && (
              <div style={tabBarStyle}>
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabBtnStyle(activeTab === tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <ContentCard><ProblemTabContent blocks={tabBlocks[activeTab] || []} tabId={activeTab} /></ContentCard>
            <Slogan />
          </ScrollColumn>
        )}

        {/* 댓글 슬라이딩 패널(실시간만) */}
        {commentsSlot && commentsOpen && (
          <aside style={commentPanelStyle}>
            <div style={{ padding: '14px 16px', overflow: 'auto', height: '100%' }}>
              {commentsSlot}
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

function ScrollColumn({ children, divider }: { children: React.ReactNode; divider?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, overflow: 'auto',
      borderLeft: divider ? '1px solid var(--border-light, #e6e6e6)' : undefined,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 24px 0',
    }}>
      {children}
    </div>
  );
}

function ContentCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      /* Phase 59a: 경우 rail이 본문 좌측 바깥(거터 2.06em = 31px@15)에 그려진다.
         카드 fontSize가 15 고정이라 필요 폭도 고정이다 — 좌측만 40px로 벌리고
         그만큼 maxWidth를 키워 본문 폭 35em을 보존한다.
         ⚠ 1단·2단 분기가 같은 ContentCard를 쓰므로 여기 한 곳이 둘 다 해결한다.
           카드에도 ScrollColumn에도 overflow:hidden이 없어 잘림 위험은 없다. */
      width: '100%', maxWidth: 'calc(35em + 76px)', background: 'var(--bg-card, #fff)', borderRadius: 8,
      padding: '32px 36px 32px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', boxSizing: 'border-box',
      fontSize: 15,
    }}>
      {children}
    </div>
  );
}

function Slogan() {
  return (
    <div style={{ padding: '16px 0 28px', textAlign: 'center', fontSize: 11, color: 'var(--text-faint, #bbb)', fontStyle: 'italic' }}>
      Write the logic. Preserve the insight.
    </div>
  );
}

function BubbleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

const headerStyle: React.CSSProperties = {
  flexShrink: 0, background: 'var(--bg-functional)', borderBottom: '1px solid var(--border-light, #e0e0e0)',
  padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14,
};
const titleStyle: React.CSSProperties = {
  fontSize: 17, fontWeight: 600, color: 'var(--text-primary)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const tabBarStyle: React.CSSProperties = {
  width: '100%', maxWidth: 'calc(35em + 72px)', display: 'flex', gap: 4,
  marginBottom: 12, borderBottom: '1px solid var(--border-light, #ddd)',
};
const commentPanelStyle: React.CSSProperties = {
  flexShrink: 0, width: 380, maxWidth: '90vw', background: 'var(--bg-panel-comment, #f7f7f7)',
  borderLeft: '1px solid var(--border-light, #e0e0e0)', height: '100%',
};
function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    color: active ? 'var(--accent-primary, #c96442)' : 'var(--text-muted, #888)',
    borderBottom: active ? '2px solid var(--accent-primary, #c96442)' : '2px solid transparent',
    marginBottom: -1,
  };
}
function commentToggleStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
    border: '1px solid var(--border-light, #ddd)',
    background: active ? 'var(--accent-primary, #c96442)' : 'var(--bg-card, #fff)',
    color: active ? '#fff' : 'var(--text-secondary, #555)',
  };
}
