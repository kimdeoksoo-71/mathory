/**
 * lib/toolbar-defaults.ts — Phase 40 프리셋 기본 그룹 (계획서 §3)
 *
 * 4개 프리셋(중·고/대학기초/대학전공/전체)의 기본 ToolbarConfig를 ALL_SYMBOLS에서
 * tier·field 기준으로 자동 생성한다. (552 큐레이션 자산 재사용 — 손수 구성 대신)
 */
import type { PresetId, ToolbarConfig, ToolbarGroup, Tier, MathField } from '../types/toolbar-config';
import { ALL_SYMBOLS } from './math-symbols';

export interface PresetMeta {
  id: PresetId;
  label: string;        // ko
  maxTier: Tier;
  desc: string;
}

export const PRESETS: PresetMeta[] = [
  { id: 'high-school', label: '중·고등학교', maxTier: 1, desc: '중·고교 교육과정 상용 기호' },
  { id: 'university-basic', label: '대학 기초', maxTier: 2, desc: '미적분·선형대수 등 대학 기초' },
  { id: 'university-major', label: '대학 전공', maxTier: 3, desc: '전공 수학 전반' },
  { id: 'all', label: '전체', maxTier: 4, desc: '연구·특수 기호까지 전부' },
];

/** field → 그룹 이름(ko). 그룹 생성 순서이기도 함. */
const FIELD_GROUPS: { field: MathField; name: string }[] = [
  { field: 'arithmetic', name: '기본 연산' },
  { field: 'algebra', name: '관계·연산' },
  { field: 'calculus', name: '미적분' },
  { field: 'analysis', name: '해석' },
  { field: 'set', name: '집합' },
  { field: 'logic', name: '논리' },
  { field: 'geometry', name: '기하' },
  { field: 'vector', name: '벡터' },
  { field: 'linear-algebra', name: '선형대수' },
  { field: 'discrete', name: '순열·조합' },
  { field: 'probability', name: '확률' },
  { field: 'statistics', name: '통계' },
  { field: 'greek', name: '그리스 문자' },
  { field: 'bracket', name: '괄호' },
];

export function presetMaxTier(presetId: PresetId): Tier {
  return PRESETS.find((p) => p.id === presetId)?.maxTier ?? 4;
}

/** 프리셋 ID로 기본 ToolbarConfig 생성 (field별 그룹, tier 필터). */
export function buildPresetConfig(presetId: PresetId): ToolbarConfig {
  const maxTier = presetMaxTier(presetId);
  const pool = ALL_SYMBOLS.filter((s) => s.tier <= maxTier && s.katexSupported);

  const groups: ToolbarGroup[] = [];
  FIELD_GROUPS.forEach(({ field, name }) => {
    const ids = pool.filter((s) => s.field === field).map((s) => s.id);
    if (ids.length === 0) return;
    groups.push({ id: `g_${field}`, name, order: groups.length, symbolIds: ids });
  });

  return {
    schemaVersion: 1,
    preset: presetId,
    maxTier,
    groups,
    recentSymbolIds: [],
  };
}

/** 프리셋 미리보기용 대표 기호 id 몇 개 (KaTeX 렌더용). */
export function presetPreviewIds(presetId: PresetId, n = 8): number[] {
  const maxTier = presetMaxTier(presetId);
  return ALL_SYMBOLS
    .filter((s) => s.tier <= maxTier && s.katexSupported && !s.needsReview)
    .slice(0, n)
    .map((s) => s.id);
}
