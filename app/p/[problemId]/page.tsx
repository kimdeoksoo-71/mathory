import type { Metadata } from 'next';
import PublicProblemView from '../../../components/share/PublicProblemView';
import MiniShell from '../../../components/layout/MiniShell';

const SITE = 'https://mathory.app';
const OG_IMAGE = '/og-default.png'; // Phase 51 L1: 정적 기본 1장(로고+슬로건). 동적 썸네일은 v2.

/**
 * 공개 문항 제목을 Firestore REST로 읽는다(서버, firebase-admin 미설치).
 * 공개 문항은 world-readable이라 비인증 REST가 isPublic() 규칙을 통과.
 * 비공개/삭제/실패 시 null → 기본 메타 fallback.
 */
async function fetchPublicTitle(problemId: string): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/problems/${problemId}`;
  try {
    // no-store: Next14 서버 fetch 기본 캐시 → 비공개 전환 후 stale 방지
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    // 비공개 문항이면 메타 노출하지 않음
    if (data?.fields?.visibility?.stringValue !== 'public') return null;
    return data?.fields?.title?.stringValue ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: { problemId: string } },
): Promise<Metadata> {
  const base: Metadata = {
    metadataBase: new URL(SITE),
    title: 'Mathory',
    description: '수학 문제 편집·관리 웹 플랫폼',
    openGraph: { title: 'Mathory', images: [OG_IMAGE], type: 'website' },
  };
  try {
    const title = await fetchPublicTitle(params.problemId);
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

export default function PublicProblemPage({ params }: { params: { problemId: string } }) {
  return (
    <MiniShell>
      <PublicProblemView problemId={params.problemId} />
    </MiniShell>
  );
}
