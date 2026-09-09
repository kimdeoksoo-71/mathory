'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { Block, TabMeta } from '../../types/problem';
import PhoneShell from '../layout/PhoneShell';
import BottomSheet from '../ui/BottomSheet';
import PhoneMoreSheet from './PhoneMoreSheet';
import ProblemTabContent from '../share/ProblemTabContent';
import { isToneScoped } from '../../lib/keyTone';
import {
  CARD_RADIUS, CARD_RADIUS_QUESTION,
  FONT_SIZE_KEY, FONT_SIZE_DEFAULT, FONT_SIZE_MIN, FONT_SIZE_MAX,
} from '../../lib/constants';
import { IconComment, IconAgent, IconDots } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 D10·D11 — 폰 문항 리더. 표시만 맡는다 — 데이터는 호출자가 준다
   (공개 = watchProblem 실시간 / 앱 = getProblemWithBlocks 1회 + mtv 필터, §5-2).

   구조: 상단 바(←|워드마크 · 제목 · 💬 · agent · ⋯) + 탭(2등분 44px) + 탭당 카드.
   - 카드 위계는 M6 그대로(G-2): 문제 = radius CARD_RADIUS_QUESTION(12) +
     --card-shadow-problem / 풀이 계열 = CARD_RADIUS(0)·그림자 없음. 판별 !isToneScoped.
     상수는 lib/constants — 리터럴 사본 금지(함정 7).
   - 좌 패딩 2.2em = 경우 rail·dot 거터 보존(Q5). 좌표는 전부 fontSize 기준 px로
     계산한다(em/px 혼합 금지 — Phase 59a C5 재발 방지).
   - 요약 보기 기본 full(Q8) — ProblemTabContent의 useOutlineState 기본값 그대로.
   - 참조 말풍선(M2 C): 정의부는 문제 탭에 산다 — 풀이 탭을 볼 때 문제 카드를
     visibility:hidden + position:absolute로 **DOM에 남긴다**(언마운트 금지 함정).
     [data-ref-tooltip] 게이트는 본문 래퍼 하나에만 — 시트(overlay)는 게이트 밖(P13).
   ═══════════════════════════════════════════════════════════════ */

export default function PhoneReader({
  title, meta, tabs, tabBlocks, shareUrl, commentsSlot, commentCount, agentSlot, onBack,
}: {
  title: string;
  /** 카드 아래 작은 안내줄 (예: "실시간 공개 · 편집 즉시 반영") */
  meta?: string;
  tabs: TabMeta[];
  tabBlocks: Record<string, Block[]>;
  /** ⋯ 시트의 [링크 복사] */
  shareUrl?: string;
  /** 있으면 💬 버튼 + 댓글 시트. 함수형이면 close 콜백을 받아 그린다(CommentPanel의 X 배선) */
  commentsSlot?: React.ReactNode | ((close: () => void) => React.ReactNode);
  commentCount?: number;
  /** 있으면 agent 버튼 + 시트 (오너·멤버 게이트는 호출자 소유). 함수형 = commentsSlot과 동일 */
  agentSlot?: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** 앱 경로의 뒤로가기. 미전달(공개 독립 라우트)이면 좌측이 워드마크 */
  onBack?: () => void;
}) {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? 'question');
  const [sheet, setSheet] = useState<null | 'comments' | 'agent' | 'more' | 'question'>(null);
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);

  /* 글자 크기 — ProblemView와 같은 키·클램프(D12·Q7). 폰이 쓰면 PC도 같은 값을 본다 */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FONT_SIZE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!isNaN(n)) setFontSize(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n)));
      }
    } catch { /* 접근 불가 — 기본값 유지 */ }
  }, []);
  const stepFont = (delta: 1 | -1) => {
    setFontSize((prev) => {
      const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, prev + delta));
      try { localStorage.setItem(FONT_SIZE_KEY, String(next)); } catch { /* 무시 */ }
      return next;
    });
  };

  /* 활성 탭 보정(탭 변동 시 — PublicViewerShell 전례) */
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) setActiveTabId(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map((t) => t.id).join(',')]);

  const questionTab = tabs.find((t) => t.id === 'question') ?? tabs[0];
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  if (!activeTab) return null;
  const isQuestionActive = !!questionTab && activeTab.id === questionTab.id;
  const activeIdx = tabs.findIndex((t) => t.id === activeTab.id);
  const nextTab = tabs[activeIdx + 1];

  /* D11 — 탭 카드. 좌표는 전부 fontSize 기준 px */
  const renderCard = (tab: TabMeta) => {
    const scoped = isToneScoped(tab.id);
    const padL = 2.2 * fontSize;
    const padR = 1 * fontSize;
    return (
      <div style={{
        margin: '10px 10px 0',
        background: 'var(--bg-content)',
        border: '0.5px solid var(--border-content)',
        borderRadius: scoped ? CARD_RADIUS : CARD_RADIUS_QUESTION,
        boxShadow: scoped ? 'none' : 'var(--card-shadow-problem)',
        padding: `${1.1 * fontSize}px ${padR}px ${1.2 * fontSize}px ${padL}px`,
        fontSize,
        boxSizing: 'border-box',
        /* .outline-section 전폭 톤이 읽는 값(TabBody:298-305 문법) */
        ['--card-pad-l' as any]: `${padL}px`,
        ['--card-pad-r' as any]: `${padR}px`,
        /* 접힘 dot 속 = 이 카드의 배경색 */
        ['--case-dot-fill' as any]: 'var(--bg-content)',
      }}>
        <ProblemTabContent blocks={tabBlocks[tab.id] || []} tabId={tab.id} viewers />
      </div>
    );
  };

  return (
    <PhoneShell
      left={onBack ? 'back' : 'wordmark'}
      onBack={onBack}
      title={title}
      right={
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {commentsSlot && (
            <TopBarButton label="댓글" onClick={() => setSheet('comments')}>
              <IconComment size={20} />
              {commentCount ? <span style={countStyle}>{commentCount}</span> : null}
            </TopBarButton>
          )}
          {agentSlot && (
            <TopBarButton label="agent" onClick={() => setSheet('agent')}>
              <IconAgent size={20} />
            </TopBarButton>
          )}
          <TopBarButton label="더 보기" onClick={() => setSheet('more')}>
            <IconDots size={20} />
          </TopBarButton>
        </div>
      }
      tabs={tabs.length > 1 ? (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-functional)' }}>
          {tabs.map((t) => {
            const active = t.id === activeTab.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTabId(t.id)}
                style={{
                  flex: 1, height: 44, border: 'none', cursor: 'pointer', background: 'none',
                  fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  boxSizing: 'border-box',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      ) : undefined}
      overlay={
        <>
          {commentsSlot && (
            <BottomSheet open={sheet === 'comments'} height="78%" onClose={() => setSheet(null)}>
              <div style={{ padding: '0 12px 12px', height: '100%', boxSizing: 'border-box' }}>
                {typeof commentsSlot === 'function' ? commentsSlot(() => setSheet(null)) : commentsSlot}
              </div>
            </BottomSheet>
          )}
          {agentSlot && (
            <BottomSheet open={sheet === 'agent'} height="78%" onClose={() => setSheet(null)}>
              {typeof agentSlot === 'function' ? agentSlot(() => setSheet(null)) : agentSlot}
            </BottomSheet>
          )}
          {questionTab && (
            /* [문제 보기] — 풀이를 읽다 문제를 잠깐 본다(hold-to-peek의 폰 번역, D10).
               ⚠ 이 카드는 [data-ref-tooltip] 밖이다(P13 — 정의부 두 벌 금지) */
            <BottomSheet open={sheet === 'question'} height="80%" onClose={() => setSheet(null)}>
              <div style={{ paddingBottom: 12 }}>{renderCard(questionTab)}</div>
            </BottomSheet>
          )}
          <PhoneMoreSheet
            open={sheet === 'more'}
            onClose={() => setSheet(null)}
            shareUrl={shareUrl}
            fontSize={fontSize}
            onFontStep={stepFont}
          />
        </>
      }
    >
      {/* 참조 말풍선 게이트 — 탭 전체를 감싸는 래퍼 하나(M2 C) */}
      <div data-ref-tooltip="">
        {/* 정의부 보존: 풀이 계열을 볼 때 문제 카드를 숨긴 채 DOM에 남긴다(M2 C — 언마운트 금지) */}
        {!isQuestionActive && questionTab && (
          <div aria-hidden style={{ visibility: 'hidden', position: 'absolute', pointerEvents: 'none' }}>
            {renderCard(questionTab)}
          </div>
        )}

        {/* 풀이 계열 상단: [문제 보기] 알약(32px) */}
        {!isQuestionActive && questionTab && (
          <div style={{ padding: '10px 10px 0' }}>
            <button
              onClick={() => setSheet('question')}
              style={{
                height: 32, padding: '0 14px', borderRadius: 999, border: 'none',
                background: 'var(--accent-primary)', color: '#fff',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              문제 보기
            </button>
          </div>
        )}

        {renderCard(activeTab)}

        {/* 문제 탭 하단: [다음 탭 보기](48px) */}
        {isQuestionActive && nextTab && (
          <div style={{ padding: '12px 10px 0' }}>
            <button
              onClick={() => setActiveTabId(nextTab.id)}
              style={{
                width: '100%', height: 48, border: '1px solid var(--border-light, #ddd)',
                borderRadius: 10, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >
              {nextTab.label} 보기
            </button>
          </div>
        )}
      </div>

      {meta && (
        <div style={{ padding: '14px 12px 0', fontSize: 11.5, color: 'var(--text-faint, #bbb)', fontFamily: 'var(--font-ui)' }}>
          {meta}
        </div>
      )}
      <div style={{ padding: '16px 0 28px', textAlign: 'center', fontSize: 11, color: 'var(--text-faint, #bbb)', fontStyle: 'italic', fontFamily: 'var(--font-ui)' }}>
        Write the logic. Preserve the insight.
      </div>
    </PhoneShell>
  );
}

function TopBarButton({ label, onClick, children }: {
  label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative', width: 40, height: 40, border: 'none', background: 'none',
        cursor: 'pointer', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
    >
      {children}
    </button>
  );
}

const countStyle: React.CSSProperties = {
  position: 'absolute', top: 2, right: 0, fontSize: 10, fontWeight: 700,
  color: 'var(--accent-primary)', fontFamily: 'var(--font-ui)',
};
