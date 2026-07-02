'use client';

import { useEffect, useState } from 'react';
import PublicViewerShell from '../../../components/share/PublicViewerShell';
import ShareButton from '../../../components/share/ShareButton';
import { getShare, isShareExpired, ShareWithSnapshot } from '../../../lib/shares';

/**
 * Phase 53 B단계: /shared SSR 메타(server page.tsx) + client 뷰어 분리.
 * 기존 page.tsx의 'use client' 로직을 그대로 이관하되 shareId를 prop으로 받는다.
 * (server page가 generateMetadata를 담당하므로 useParams 대신 prop 사용)
 */
export default function SharedClient({ shareId }: { shareId: string }) {
  const [share, setShare] = useState<ShareWithSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const url = typeof window !== 'undefined' ? `${window.location.origin}/shared/${shareId}` : `/shared/${shareId}`;
  const meta = share.expiresAt === null
    ? '공개 기간: 무기한 · 공유 스냅샷'
    : `만료: ${share.expiresAt.toLocaleString('ko-KR')} · 공유 스냅샷`;

  return (
    <PublicViewerShell
      title={share.snapshot.title || '제목 없음'}
      meta={meta}
      tabs={visibleTabs}
      tabBlocks={share.snapshot.tabBlocks}
      rightSlot={
        <>
          <ShareButton url={url} title={share.snapshot.title || 'Mathory 문항'} tags={share.snapshot.tags || []} compact />
          <OwnerBadge displayName={share.ownerDisplayName} photoURL={share.ownerPhotoURL} />
        </>
      }
    />
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
