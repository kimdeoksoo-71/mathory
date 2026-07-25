import type { Block, TabMeta } from '../../types/problem';
import type { VersionContent, VersionTab, VersionBlock } from '../../types/version';
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

/**
 * 버전 콘텐츠 → 에디터 적용용 조각 (드래프트 복구·Stage 5 복원 공용).
 * 블록은 order 정렬. 호출부가 LocalBlock으로 감싼다(collapsed·id 부여).
 */
export function versionContentToLocal(content: VersionContent): {
  tabs: TabMeta[];
  blocksByTab: Record<string, VersionBlock[]>;
  title: string;
  answer: string;
} {
  const tabs: TabMeta[] = content.tabs.map((t) => ({ id: t.key, label: t.title }));
  const blocksByTab: Record<string, VersionBlock[]> = {};
  for (const t of content.tabs) {
    blocksByTab[t.key] = [...t.blocks].sort((a, b) => a.order - b.order);
  }
  return { tabs, blocksByTab, title: content.meta.title, answer: content.meta.answer };
}
