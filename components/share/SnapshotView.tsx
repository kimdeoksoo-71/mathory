'use client';

import { useEffect, useState } from 'react';
import PublicViewerShell from './PublicViewerShell';
import ShareButton from './ShareButton';
import { getShare, isShareExpired, ShareWithSnapshot } from '../../lib/shares';

/**
 * Phase 53: 공유 스냅샷(`/shared/{id}`) 뷰어. 완전 읽기 전용(동결본).
 * - `/shared` 라우트(MiniShell 안)와 앱 셸 임베드(E단계) 양쪽에서 공용.
 * - getShare로 스냅샷 로드 → 만료/부재 안내. 댓글 없음(C2).
 */
export default function SnapshotView({ shareId }: { shareId: string }) {
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
      <span style={{ fontSize: 13, color: 'var(--text-secondary, #444)' }}>{displayName || '익명'}</span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100%', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#666', fontFamily: 'var(--font-ui, sans-serif)', fontSize: 14,
    }}>
      {children}
    </div>
  );
}
