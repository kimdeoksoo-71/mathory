/**
 * Phase 71 — 일괄 내보내기 로더 [브라우저]: 문항 id[](리스트 화면 순서 — N16) → ExportSource[].
 * 문항마다 문제·풀이 탭만 읽는다(getProblemExportBlocks — G12). ExportDialog가 동적 import한다.
 * ⚠ 일괄은 FolderView 선택 바(`selectable` = 내 소유·비공유 뷰) 뒤라 늘 오너다 — 멤버 숨김 탭은 단일 내보내기만의 문제.
 */
import { getProblemExportBlocks } from '../../firestore';
import type { ExportSource } from '../run';

export interface BatchLoadResult {
  sources: ExportSource[];
  /** 사용자 안내 — 사라진 문항 · 탭 읽기 실패 */
  notices: string[];
  aborted: boolean;
}

export async function loadExportSources(
  problemIds: string[],
  onProgress: (done: number, total: number) => void,
  isAborted: () => boolean,
): Promise<BatchLoadResult> {
  const sources: ExportSource[] = [];
  const missing: string[] = [];
  const tabErrors: string[] = [];
  for (let i = 0; i < problemIds.length; i++) {
    if (isAborted()) return { sources, notices: [], aborted: true };
    const p = await getProblemExportBlocks(problemIds[i]);
    if (!p) missing.push(problemIds[i]);
    else {
      sources.push({ title: p.title, tabs: p.tabs });
      if (Object.keys(p.tabLoadErrors).length) tabErrors.push(p.title || problemIds[i]);
    }
    onProgress(i + 1, problemIds.length);
  }
  const notices: string[] = [];
  if (missing.length) notices.push(`찾을 수 없는 문항 ${missing.length}개는 건너뛰었습니다.`);
  if (tabErrors.length) notices.push(`탭을 읽지 못한 문항 ${tabErrors.length}개는 빈 탭으로 넣었습니다: ${tabErrors.slice(0, 3).join(', ')}`);
  return { sources, notices, aborted: false };
}
