/**
 * build-symbols.cjs — lib/math-symbols.ts 생성 (전체 552 큐레이션 기반)
 *
 * 입력: lib/data/curated-full.json (워크플로 큐레이션 + 시드 병합, 552개)
 * 출력: lib/math-symbols.ts
 *   - ALL_SYMBOLS        : 552개 전체 레지스트리 (카탈로그/설정용)
 *   - CURATED_SYMBOLS    : 팔레트 표시 subset (tier<=2 && !needsReview, 신뢰도 높은 상용)
 *   - DEFAULT_CATEGORIES : 기본 4탭(기본/미적분/기호/괄호)
 *   - FIELD_TO_CATEGORY  : 14개 분야 → 4탭 매핑
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const full = require(path.join(ROOT, 'lib', 'data', 'curated-full.json'));
const ALL = full.items;

// 7탭 — 14개 분야를 모두 흡수 (설계 §12-3: 기본 4개 + 확장)
const DEFAULT_CATEGORIES = [
  { id: 'basic', label: '기본', fields: ['arithmetic', 'vector'] },
  { id: 'calculus', label: '미적분', fields: ['calculus', 'analysis'] },
  { id: 'relation', label: '관계', fields: ['algebra'] },
  { id: 'set-logic', label: '집합·논리', fields: ['set', 'logic'] },
  { id: 'greek', label: '그리스', fields: ['greek'] },
  { id: 'geometry', label: '기하·기타', fields: ['geometry', 'probability', 'statistics', 'discrete', 'linear-algebra'] },
  { id: 'brackets', label: '괄호', fields: ['bracket'] },
];

// 팔레트 표시 subset: 신뢰도 높은 상용 기호
const PALETTE = ALL.filter((s) => s.tier <= 2 && !s.needsReview && s.katexSupported);

const header = `/**
 * lib/math-symbols.ts — Phase 40 수식 기호 데이터 (전체 큐레이션 v2)
 *
 * ⚠️ 자동 생성 파일. 직접 수정 금지.
 *    재생성: node scripts/build-symbols.cjs  (입력: lib/data/curated-full.json)
 *    구조필드(latex/symbol/mathClass/displayLatex) = KaTeX(MIT) 시드
 *    분야/이름(ko·en)/등급/needsReview = 멀티에이전트 큐레이션 (KMS 대조 전)
 *    출처/파이프라인: docs/phasedocs/Phase40_기호설정화면_설계_최신.md §18
 *
 * ALL_SYMBOLS=${ALL.length}개(전체 레지스트리) · CURATED_SYMBOLS=${PALETTE.length}개(팔레트 표시 subset).
 */
import type { MathSymbol, PaletteCategory } from '../types/toolbar-config';

export const DEFAULT_CATEGORIES: PaletteCategory[] = ${JSON.stringify(DEFAULT_CATEGORIES, null, 2)};

/** 전체 레지스트리 (552). 카탈로그/설정 화면용. */
export const ALL_SYMBOLS: MathSymbol[] = ${JSON.stringify(ALL, null, 2)};

/** 사용 팔레트 표시 subset (tier<=2 && !needsReview). */
export const CURATED_SYMBOLS: MathSymbol[] = ALL_SYMBOLS.filter(
  (s) => s.tier <= 2 && !s.needsReview && s.katexSupported,
);

/** field → 기본 카테고리 id 역매핑 */
export const FIELD_TO_CATEGORY: Record<string, string> = ${JSON.stringify(
  Object.fromEntries(DEFAULT_CATEGORIES.flatMap((c) => c.fields.map((f) => [f, c.id]))), null, 2)};
`;

fs.writeFileSync(path.join(ROOT, 'lib', 'math-symbols.ts'), header, 'utf8');

// 리포트
console.log('ALL_SYMBOLS     :', ALL.length);
console.log('CURATED(팔레트) :', PALETTE.length);
const perCat = {};
for (const s of PALETTE) {
  const cat = DEFAULT_CATEGORIES.find((c) => c.fields.includes(s.field));
  const label = cat ? cat.label : '(미매핑:' + s.field + ')';
  perCat[label] = (perCat[label] || 0) + 1;
}
console.log('팔레트 탭별 분포:', perCat);
const orphan = PALETTE.filter((s) => !DEFAULT_CATEGORIES.some((c) => c.fields.includes(s.field)));
console.log('탭 미매핑 기호  :', orphan.length, orphan.map((s) => s.field).filter((v, i, a) => a.indexOf(v) === i));
console.log('→ 생성: lib/math-symbols.ts');
