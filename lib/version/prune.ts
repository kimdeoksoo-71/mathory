import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Phase 55 Stage 6 — 보존(pruning).
 * 자동 시간 스냅샷이 없어 prune 후보는 editor_exit뿐이고 양이 적다(공격적 thinning 불요).
 * 보호: manual_save·named·restore·pinned. 하드 상한 VERSION_CAP.
 * ⚠️ Phase 55b: trigger가 editor_exit이어도 name이 붙었으면 보호한다. 이름 저장이 무변경
 *    상태에서 일어나면 기존 editor_exit 버전에 name만 부착되므로(snapshot.ts named_existing),
 *    trigger만 보면 "이름 붙인 버전"이 상한 초과 시 삭제된다.
 * cascade: 메타 삭제 시 payload/data 반드시 동반 삭제(Firestore 자동 cascade 없음).
 */
export const VERSION_CAP = 50;

/** 순수 선택 로직(테스트 용이): 오래된 editor_exit(비핀)부터 상한 초과분만. */
export function selectPruneVictims(
  versions: { id: string; trigger?: string; pinned?: boolean; name?: string | null }[],  // seq 오름차순(오래된 것 먼저)
  cap = VERSION_CAP,
): string[] {
  if (versions.length <= cap) return [];
  let over = versions.length - cap;
  const victims: string[] = [];
  for (const v of versions) {
    if (over <= 0) break;
    if (v.trigger === 'editor_exit' && !v.pinned && !v.name) {
      victims.push(v.id);
      over--;
    }
  }
  return victims;
}

async function cascadeDelete(problemId: string, versionId: string): Promise<void> {
  // payload 먼저, 메타 나중. 이미 없으면 무시.
  await deleteDoc(doc(db, 'problems', problemId, 'versions', versionId, 'payload', 'data')).catch(() => {});
  await deleteDoc(doc(db, 'problems', problemId, 'versions', versionId)).catch(() => {});
}

/** createSnapshot 성공 직후 인라인 호출(fire-and-forget). */
export async function pruneProblemVersions(problemId: string): Promise<void> {
  const snap = await getDocs(query(
    collection(db, 'problems', problemId, 'versions'), orderBy('seq', 'asc'),
  ));
  const victims = selectPruneVictims(
    snap.docs.map((d) => ({
      id: d.id, trigger: d.data().trigger, pinned: d.data().pinned, name: d.data().name,
    })),
  );
  for (const vid of victims) await cascadeDelete(problemId, vid);
}

/** 문항 삭제 시 versions 전체(메타 + payload) 정리. */
export async function deleteAllVersions(problemId: string): Promise<void> {
  const snap = await getDocs(collection(db, 'problems', problemId, 'versions'));
  for (const d of snap.docs) await cascadeDelete(problemId, d.id);
}
