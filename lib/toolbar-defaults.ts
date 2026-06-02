/**
 * lib/toolbar-defaults.ts — Phase 40 프리셋 기본 그룹 (계획서 §3)
 *
 * 4개 프리셋(중·고/대학기초/대학전공/전체)의 기본 ToolbarConfig를 ALL_SYMBOLS에서
 * tier·field 기준으로 자동 생성한다. (552 큐레이션 자산 재사용 — 손수 구성 대신)
 */
import type { PresetId, ToolbarConfig, ToolbarGroup, Tier, MathField } from '../types/toolbar-config';
import { ALL_SYMBOLS } from './math-symbols';

/**
 * 프리셋 그룹(6개) — 카탈로그 20+1 카테고리를 빠른 팔레트용으로 묶음.
 * cats = 포함할 catalogCategory id 목록(이 순서로 기호 배열).
 */
const PRESET_GROUPS: { name: string; cats: number[] }[] = [
  { name: '기본', cats: [2, 14, 12, 11, 13] },        // 기본연산·분수근호첨자·악센트·괄호·생략점
  { name: '연산·미적분', cats: [3, 4, 15, 16] },       // 이항연산·큰연산·미적분·함수
  { name: '관계·논리', cats: [5, 6, 9, 10] },          // 관계·부등호·논리·화살표
  { name: '집합·수', cats: [7, 8] },                   // 집합·수체계
  { name: '기하·확통', cats: [17, 21] },               // 기하·확률통계
  { name: '그리스·기타', cats: [1, 18, 19, 20] },      // 그리스·문자형·글꼴·기타
];

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
  { field: 'function', name: '함수' },
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

/** 카탈로그 섹션 순서(분야) */
export const FIELD_ORDER: MathField[] = FIELD_GROUPS.map((g) => g.field);
/** 분야 → 한국어 라벨 */
export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_GROUPS.map((g) => [g.field, g.name]),
);

export function presetMaxTier(presetId: PresetId): Tier {
  return PRESETS.find((p) => p.id === presetId)?.maxTier ?? 4;
}

/** 프리셋 ID로 기본 ToolbarConfig 생성 (6개 묶음 그룹, tier 필터). */
export function buildPresetConfig(presetId: PresetId): ToolbarConfig {
  const maxTier = presetMaxTier(presetId);
  const pool = ALL_SYMBOLS.filter((s) => s.tier <= maxTier && s.katexSupported);

  const groups: ToolbarGroup[] = [];
  PRESET_GROUPS.forEach((pg, i) => {
    const ids: number[] = [];
    pg.cats.forEach((catId) => {
      pool.filter((s) => s.catalogCategory === catId).forEach((s) => ids.push(s.id));
    });
    if (ids.length === 0) return;
    groups.push({ id: `g_pg${i}`, name: pg.name, order: groups.length, symbolIds: ids });
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
