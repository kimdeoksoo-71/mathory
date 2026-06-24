'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProblemTabContent from '../../../components/share/ProblemTabContent';
import { getShare, isShareExpired, ShareWithSnapshot } from '../../../lib/shares';

export default function SharedPage() {
  const params = useParams<{ shareId: string }>();
  const shareId = params?.shareId;

  const [share, setShare] = useState<ShareWithSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      try {
        const s = await getShare(shareId);
        if (!s) {
          setError('존재하지 않거나 해제된 공유 링크입니다.');
        } else if (isShareExpired(s)) {
          setError('공개가 종료되었습니다.');
        } else {
          setShare(s);
          // 첫 공개 탭 선택
          const firstVisible = (s.snapshot.tabs || []).find((t) => s.tabVisibility[t.id]);
          setActiveTab(firstVisible?.id || '');
        }
      } catch (e: any) {
        setError(e.message || '공유 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  if (loading) {
    return <Centered>불러오는 중…</Centered>;
  }
  if (error || !share) {
    return <Centered>{error || '오류'}</Centered>;
  }

  const tabs = share.snapshot.tabs || [];
  const visibleTabs = tabs.filter((t) => share.tabVisibility[t.id]);

  return (
    <div style={{
      minHeight: '100vh', background: '#f4f4f4',
      fontFamily: 'var(--font-ui, sans-serif)',
    }}>
      {/* 헤더 */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <a
          href="https://mathory.app"
          target="_blank"
          rel="noopener noreferrer"
          title="Mathory로 가기"
          style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
            textDecoration: 'none',
          }}
        >
          <span style={{
            fontSize: 19, fontWeight: 500, color: 'var(--text-primary, #222)',
            letterSpacing: -0.5, fontFamily: 'var(--font-logo)', lineHeight: 1.1,
          }}>
            Mathory
          </span>
          <span style={{
            fontSize: 10.5, color: 'var(--text-muted, #888)', fontStyle: 'italic',
            fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
          }}>
            Write the logic. Preserve the insight.
          </span>
        </a>
        <div style={{ width: 1, height: 22, background: '#e0e0e0', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#222',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {share.snapshot.title || '제목 없음'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            {share.expiresAt === null
              ? '공개 기간: 무기한 · 공유 스냅샷'
              : `만료: ${share.expiresAt.toLocaleString('ko-KR')} · 공유 스냅샷`}
          </div>
        </div>
        <OwnerBadge
          displayName={share.ownerDisplayName}
          photoURL={share.ownerPhotoURL}
        />
      </div>

      {/* 본문 — ProblemView 본문 칼럼과 동일 (35em / 폰트 15px 기준) */}
      <div style={{
        fontSize: 15,
        margin: '24px auto',
        padding: '0 32px',
        width: 'fit-content',
        boxSizing: 'border-box',
      }}>
        {visibleTabs.length === 0 ? (
          <div style={{
            width: '35em', background: '#fff', borderRadius: 8, padding: 40,
            textAlign: 'center', color: '#888',
          }}>
            공개된 탭이 없습니다.
          </div>
        ) : (
          <>
            {/* 탭 바 */}
            {visibleTabs.length > 1 && (
              <div style={{
                width: 'calc(35em + 72px)',
                display: 'flex', gap: 4, marginBottom: 12,
                borderBottom: '1px solid #ddd',
              }}>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '8px 16px', border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      color: activeTab === tab.id ? 'var(--accent-primary, #B8845C)' : '#888',
                      borderBottom: activeTab === tab.id
                        ? '2px solid var(--accent-primary, #B8845C)'
                        : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* 활성 탭 본문 */}
            <div style={{
              width: 'calc(35em + 72px)',
              background: '#fff', borderRadius: 8, padding: '32px 36px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              boxSizing: 'border-box',
            }}>
              <ProblemTabContent
                blocks={share.snapshot.tabBlocks[activeTab] || []}
              />
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function OwnerBadge({ displayName, photoURL }: { displayName: string; photoURL: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoURL} alt={displayName}
          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#666', fontWeight: 600,
        }}>
          {(displayName || '?').charAt(0).toUpperCase()}
        </div>
      )}
      <span style={{ fontSize: 13, color: '#444' }}>{displayName || '익명'}</span>
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
