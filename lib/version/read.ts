import {
  collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProblemVersion, VersionContent, VersionPayload } from '../../types/version';

/**
 * Phase 55 — 버전 읽기. 목록은 메타만(가벼움), 본문은 payload/data에서 지연 로딩.
 */

export interface VersionsPage {
  versions: ProblemVersion[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function versionsPage(
  problemId: string,
  after?: QueryDocumentSnapshot | null,
  n = 30,
): Promise<VersionsPage> {
  let q = query(
    collection(db, 'problems', problemId, 'versions'),
    orderBy('seq', 'desc'),
    limit(n),
  );
  if (after) q = query(q, startAfter(after));
  const snap = await getDocs(q);
  const versions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProblemVersion));
  return {
    versions,
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === n,
  };
}

export async function loadContent(problemId: string, versionId: string): Promise<VersionContent> {
  const snap = await getDoc(
    doc(db, 'problems', problemId, 'versions', versionId, 'payload', 'data'),
  );
  const data = snap.data() as VersionPayload | undefined;
  if (!data) throw new Error('버전 본문을 찾을 수 없습니다');
  return data.content;
}

/**
 * pruned parent 폴백: parent_id 문서가 없으면(솎임) 가장 가까운 살아있는 상위 버전.
 * known(현재 로드된 목록) 우선, 없으면 직접 조회, 그래도 없으면 seq 더 작은 것 중 최대.
 */
export async function resolveLivingParent(
  problemId: string,
  version: ProblemVersion,
  known: ProblemVersion[],
): Promise<ProblemVersion | null> {
  if (!version.parent_id) return null;
  const direct = known.find((v) => v.id === version.parent_id);
  if (direct) return direct;
  const snap = await getDoc(doc(db, 'problems', problemId, 'versions', version.parent_id));
  if (snap.exists()) return { id: snap.id, ...snap.data() } as ProblemVersion;
  const older = known.filter((v) => v.seq < version.seq).sort((a, b) => b.seq - a.seq);
  return older[0] || null;
}
