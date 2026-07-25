import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  VersionContent, VersionTrigger, Participant, ProblemVersion, SnapshotResult,
} from '../../types/version';
import { canonicalize, diffTabKeys } from './canonicalize';
import { sha256, hashPerTab } from './hash';

/**
 * Phase 55 — 스냅샷 생성.
 * 해시 계산은 트랜잭션 밖(순수), dedup 판정·쓰기는 트랜잭션 안(원자적).
 * 직전 해시 메모리 캐시로 무변경 저장 시 네트워크 I/O 0.
 */

const lastHashCache = new Map<string, string>();
export function getCachedLastHash(problemId: string): string | undefined {
  return lastHashCache.get(problemId);
}
export function setCachedLastHash(problemId: string, hash: string): void {
  lastHashCache.set(problemId, hash);
}

export async function createSnapshot(
  problemId: string,
  content: VersionContent,      // collectCurrentContent() 결과 = toPersistedBlock 통과본
  trigger: VersionTrigger,
  actor: Participant,
  opts?: { name?: string; pinned?: boolean; restoredFrom?: string },
): Promise<SnapshotResult> {
  // 1) 정규화·해시 (트랜잭션 밖)
  const canonical = canonicalize(content);
  const contentHash = await sha256(canonical);

  // 1-a) 조기 반환: 캐시 직전 해시와 동일 + 이름/핀 의도 없음 → I/O 0
  if (contentHash === getCachedLastHash(problemId) && !opts?.name && !opts?.pinned) {
    return { status: 'unchanged' };
  }

  const tabHashes = await hashPerTab(content);
  const byteSize = new TextEncoder().encode(canonical).length;
  const metaRef = doc(collection(db, 'problems', problemId, 'versions'));
  const contentRef = doc(metaRef, 'payload', 'data');

  try {
    const result = await runTransaction(db, async (tx) => {
      const liveRef = doc(db, 'problems', problemId);
      const live = (await tx.get(liveRef)).data();
      if (!live) return { status: 'error', error: new Error('문항 없음') } as SnapshotResult;
      // F5: 진입 가드 (백필 대신). authorUid 없는 레거시는 관리자 마이그레이션 필요.
      if (!live.authorUid) {
        return { status: 'error', error: new Error('authorUid 없음 — 관리자 마이그레이션 필요') } as SnapshotResult;
      }

      const lastHash = live.last_version_hash ?? null;
      const lastSeq = live.version_seq ?? 0;
      const lastId = live.last_version_id ?? null;
      const lastTabHashes = live.last_version_tab_hashes ?? {};

      // 2) dedup
      if (contentHash === lastHash) {
        if ((opts?.name || opts?.pinned) && lastId) {          // 무변경 + 이름/핀 → 최신본 메타만
          tx.update(doc(db, 'problems', problemId, 'versions', lastId), {
            ...(opts.name ? { name: opts.name } : {}),
            ...(opts.pinned ? { pinned: true } : {}),
          });
          return { status: 'named_existing', versionId: lastId } as SnapshotResult;
        }
        return { status: 'unchanged' } as SnapshotResult;
      }

      // 3) 불변 메타 작성
      const meta: ProblemVersion = {
        id: metaRef.id, seq: lastSeq + 1, problem_id: problemId, author_uid: live.authorUid,
        created_at: serverTimestamp() as unknown as Timestamp,
        created_by: actor, contributors: [actor],
        trigger, name: opts?.name ?? null, pinned: opts?.pinned ?? false,
        content_hash: contentHash, tab_hashes: tabHashes,
        parent_id: lastId, restored_from: opts?.restoredFrom ?? null,
        changed_tabs: diffTabKeys(tabHashes, lastTabHashes),
        byte_size: byteSize,
      };

      // 4) 메타/본문 2-write
      tx.set(metaRef, meta);
      tx.set(contentRef, { content, content_hash: contentHash });

      // 5) 라이브 포인터·순번 원자적 갱신
      tx.update(liveRef, {
        version_seq: meta.seq, last_version_id: meta.id,
        last_version_hash: contentHash, last_version_tab_hashes: tabHashes,
      });

      return { status: 'created', version: meta } as SnapshotResult;
    });

    // 트랜잭션 재시도 가능 → 캐시 갱신은 성공 후 한 번만.
    if (result.status === 'created' || result.status === 'named_existing') {
      setCachedLastHash(problemId, contentHash);
    }
    return result;
  } catch (error) {
    return { status: 'error', error };   // 계층1 localStorage/블록 저장이 이미 내용 방어
  }
}
