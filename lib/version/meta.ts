import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { GithubExport } from '../../types/version';

/**
 * Phase 55b — 버전 메타 사후 수정.
 * createSnapshot 경로로는 불가능한 조작들:
 *   - 핀 해제: snapshot.ts는 `opts.pinned ? { pinned: true } : {}`라 false를 절대 쓰지 않는다
 *   - 이름 해제: 같은 이유로 name 삭제 불가
 *   - github_export 기록: 스냅샷과 무관한 사후 정보
 * 규칙(firestore.rules) update는 name·pinned·github_export만 허용하므로 이 3개가 전부다.
 */

function versionRef(problemId: string, versionId: string) {
  return doc(db, 'problems', problemId, 'versions', versionId);
}

/** 이름 부여·변경·해제(null). */
export function setVersionName(problemId: string, versionId: string, name: string | null) {
  return updateDoc(versionRef(problemId, versionId), { name });
}

/** 핀 켜기·끄기. */
export function setVersionPinned(problemId: string, versionId: string, pinned: boolean) {
  return updateDoc(versionRef(problemId, versionId), { pinned });
}

/** GitHub 내보내기 기록. Stage 2 규칙 확장(hasOnly에 github_export 추가) 후 동작한다. */
export function setVersionExport(problemId: string, versionId: string, ge: GithubExport) {
  return updateDoc(versionRef(problemId, versionId), { github_export: ge });
}
