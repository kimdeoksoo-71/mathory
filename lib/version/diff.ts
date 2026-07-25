import { diffWordsWithSpace } from 'diff';
import type { Change } from 'diff';
import type { VersionContent, VersionBlock, VersionTab } from '../../types/version';
import { canonBlock } from './canonicalize';

/**
 * Phase 55 Stage 5 — block_key 매칭 diff.
 * 이동/추가/삭제/수정 구분(F1 조기결속의 목적). 수정 블록 내부는 jsdiff 워드 비교.
 */

export type BlockDiffKind =
  | 'unchanged' | 'added' | 'removed' | 'modified' | 'moved' | 'moved_modified';

export interface BlockDiff {
  block_key: string;
  kind: BlockDiffKind;
  before: VersionBlock | null;
  after: VersionBlock | null;
  textParts: Change[] | null;   // modified/moved_modified: raw_text 워드 diff
}

export interface TabDiff {
  key: string;
  title: string;
  changed: boolean;
  blocks: BlockDiff[];          // after 순 + 삭제 블록 말미
}

export interface MetaDiff {
  titleChanged: boolean;
  answerChanged: boolean;
  before: { title: string; answer: string };
  after: { title: string; answer: string };
}

export interface ContentDiff {
  meta: MetaDiff;
  tabs: TabDiff[];
  anyChange: boolean;
}

function blockEqual(a: VersionBlock, b: VersionBlock): boolean {
  return JSON.stringify(canonBlock(a)) === JSON.stringify(canonBlock(b));
}

/** 두 키 배열의 LCS에 남는 키 = "제자리". 나머지 공통 키 = 이동. */
function lcsSet(a: string[], b: string[]): Set<string> {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keep = new Set<string>();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { keep.add(a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return keep;
}

function diffTab(before: VersionTab | undefined, after: VersionTab | undefined): TabDiff {
  const ref = (after || before)!;
  const beforeBlocks = before ? [...before.blocks].sort((a, b) => a.order - b.order) : [];
  const afterBlocks = after ? [...after.blocks].sort((a, b) => a.order - b.order) : [];
  const beforeMap = new Map(beforeBlocks.map((b) => [b.block_key, b]));
  const afterMap = new Map(afterBlocks.map((b) => [b.block_key, b]));

  const beforeCommon = beforeBlocks.filter((b) => afterMap.has(b.block_key)).map((b) => b.block_key);
  const afterCommon = afterBlocks.filter((b) => beforeMap.has(b.block_key)).map((b) => b.block_key);
  const inPlace = lcsSet(beforeCommon, afterCommon);

  const blocks: BlockDiff[] = [];
  for (const ab of afterBlocks) {
    const bb = beforeMap.get(ab.block_key) || null;
    if (!bb) {
      blocks.push({ block_key: ab.block_key, kind: 'added', before: null, after: ab, textParts: null });
      continue;
    }
    const same = blockEqual(bb, ab);
    const moved = !inPlace.has(ab.block_key);
    let kind: BlockDiffKind;
    if (same && !moved) kind = 'unchanged';
    else if (same && moved) kind = 'moved';
    else if (!same && moved) kind = 'moved_modified';
    else kind = 'modified';
    blocks.push({
      block_key: ab.block_key, kind, before: bb, after: ab,
      textParts: same ? null : diffWordsWithSpace(bb.raw_text, ab.raw_text),
    });
  }
  for (const bb of beforeBlocks) {
    if (!afterMap.has(bb.block_key)) {
      blocks.push({ block_key: bb.block_key, kind: 'removed', before: bb, after: null, textParts: null });
    }
  }

  return { key: ref.key, title: ref.title, changed: blocks.some((b) => b.kind !== 'unchanged'), blocks };
}

export function diffContent(before: VersionContent | null, after: VersionContent): ContentDiff {
  const b = before || { meta: { title: '', answer: '' }, tabs: [] };
  const meta: MetaDiff = {
    titleChanged: (b.meta.title || '') !== (after.meta.title || ''),
    answerChanged: (b.meta.answer || '') !== (after.meta.answer || ''),
    before: { title: b.meta.title || '', answer: b.meta.answer || '' },
    after: { title: after.meta.title || '', answer: after.meta.answer || '' },
  };
  const keys = Array.from(new Set([...b.tabs.map((t) => t.key), ...after.tabs.map((t) => t.key)]));
  const bMap = new Map(b.tabs.map((t) => [t.key, t]));
  const aMap = new Map(after.tabs.map((t) => [t.key, t]));
  const tabs = keys.map((k) => diffTab(bMap.get(k), aMap.get(k)));
  const anyChange = meta.titleChanged || meta.answerChanged || tabs.some((t) => t.changed);
  return { meta, tabs, anyChange };
}
