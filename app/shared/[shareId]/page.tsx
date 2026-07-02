import type { Metadata } from 'next';
import SnapshotView from '../../../components/share/SnapshotView';
import MiniShell from '../../../components/layout/MiniShell';

const SITE = 'https://mathory.app';
const OG_IMAGE = '/og-default.png'; // Phase 53 B단계: 정적 브랜드 카드(1200×630). 동적 썸네일은 후속.

/**
 * Phase 53 B단계: 공유 스냅샷 제목을 Firestore REST로 읽는다(서버, firebase-admin 미설치).
 * shares/{id}는 규칙상 world-readable(allow read: if true)이라 비인증 REST 통과.
 * snapshot은 share 문서 내부 map이므로 단일 GET으로 title 파싱(lib/shares.ts mapShareDoc 구조).
 * 만료(expiresAt ≤ now)·부재·실패 시 null → 기본 메타 fallback.
 */
async function fetchShareTitle(shareId: string): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/shares/${shareId}`;
  try {
    // no-store: 만료 전환 후 stale 방지 (/p와 동일 근거)
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const fields = data?.fields;
    if (!fields) return null;
    // 만료 확인: expiresAt이 timestampValue면 파싱, nullValue/부재는 무기한(유효)
    const expiresAt = fields.expiresAt?.timestampValue;
    if (expiresAt) {
      const expMs = Date.parse(expiresAt);
      if (!Number.isNaN(expMs) && expMs <= Date.now()) return null; // 만료 → 메타 노출 안 함
    }
    // snapshot(map) → title
    const title = fields.snapshot?.mapValue?.fields?.title?.stringValue;
    return title || null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { shareId: string } },
): Promise<Metadata> {
  const base: Metadata = {
    metadataBase: new URL(SITE),
    title: 'Mathory',
    description: '수학 문제 편집·관리 웹 플랫폼',
    openGraph: { title: 'Mathory', images: [OG_IMAGE], type: 'website' },
  };
  try {
    const title = await fetchShareTitle(params.shareId);
    if (!title) return base;
    const ogTitle = `${title} · Mathory`;
    const desc = `${title} — Mathory에서 공유된 수학 문항`;
    return {
      metadataBase: new URL(SITE),
      title: ogTitle,
      description: desc,
      openGraph: { title: ogTitle, description: desc, images: [OG_IMAGE], type: 'article' },
      twitter: { card: 'summary_large_image', title: ogTitle, description: desc, images: [OG_IMAGE] },
    };
  } catch {
    return base;
  }
}

export default function SharedPage({ params }: { params: { shareId: string } }) {
  return (
    <MiniShell>
      <SnapshotView shareId={params.shareId} />
    </MiniShell>
  );
}
