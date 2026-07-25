import type { Block, TabMeta } from '../../types/problem';
import type { VersionContent, VersionTab } from '../../types/version';
import { toPersistedBlock } from '../blocks/normalize';

/**
 * Phase 55 — 라이브 편집 상태(in-memory) ↔ 버전 콘텐츠 어댑터.
 * 해시·스냅샷 입력은 항상 "저장될 형태"(toPersistedBlock 통과본) — 저장 경로와 단일 소스(F4).
 */

/** 일부 탭 로드 실패 상태에서 스냅샷을 막기 위한 가드 에러 (F7). */
export class VersionLoadError extends Error {
  failedTabs: string[];
  constructor(failedTabs: string[]) {
    super(`일부 탭 로드 실패: ${failedTabs.join(', ')}`);
    this.name = 'VersionLoadError';
    this.failedTabs = failedTabs;
  }
}

export function collectCurrentContent(args: {
  tabs: TabMeta[];
  blocksByTab: Record<string, Block[]>;   // LocalBlock[]도 Block[]로 수용
  title: string;
  answer: string;
  tabLoadErrors?: Record<string, string>; // getProblemWithBlocks가 노출 (F7)
}): VersionContent {
  // F7: 로드 실패 탭이 있으면 부분 상태 스냅샷을 막는다.
  const errs = args.tabLoadErrors;
  if (errs && Object.keys(errs).length > 0) {
    throw new VersionLoadError(Object.keys(errs));
  }
  const tabs: VersionTab[] = args.tabs.map((t) => ({
    key: t.id,
    title: t.label,
    blocks: (args.blocksByTab[t.id] || []).map((b, i) => toPersistedBlock(b, i)),
  }));
  return {
    meta: { title: args.title, answer: args.answer || '' },
    tabs,
  };
}
