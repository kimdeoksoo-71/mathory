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
const katex = require('katex');

const ROOT = path.join(__dirname, '..');
const full = require(path.join(ROOT, 'lib', 'data', 'curated-full.json'));
const supplement = require(path.join(ROOT, 'lib', 'data', 'curated-supplement.json'));
const { CATALOG_CATEGORIES, classify } = require('./catalog-classify.cjs');

// 0) 비-기호 제외:
//    - 키보드로 직접 입력하는 문장부호
//    - 보이지 않는 공백/줄바꿈 명령
//    - \@ 내부 매크로(KaTeX 비공개)
const EXCLUDE_LATEX = new Set([
  ';', ',', '!', '?', '\\$', '`', ':', '.', '"', "'",
  '\\allowbreak', '\\nobreak', '\\nobreakspace', '\\space', '\\ ',
  '\\Pr',
]);
const isExcluded = (s) => EXCLUDE_LATEX.has(s.latex) || /^\\@/.test(s.latex);

// 1) 보강 연산자에 id 부여 (기존 최대 id 다음 — 계획서 §1 'ID는 영원히')
let nextId = Math.max(...full.items.map((s) => s.id)) + 1;
const supItems = supplement.items.map((s) => ({ ...s, id: nextId++ }));
const ALL = [...full.items, ...supItems].filter((s) => !isExcluded(s));

// 1.5) 인자가 필요한 명령(악센트 \hat 등)인데 displayLatex 없는 것 → 템플릿화
//      단독 렌더는 파싱 실패하므로 latex='\hat{}', displayLatex='\hat{x}', 커서는 {} 안.
const rok = (l) => { try { katex.renderToString(l, { throwOnError: true }); return true; } catch { return false; } };
let argFixed = 0;
ALL.forEach((s) => {
  if (s.displayLatex || rok(s.latex)) return;
  if (!rok(s.latex + '{x}')) return;
  s.displayLatex = s.latex + '{x}';
  s.cursorOffset = s.latex.length + 1;
  s.latex = s.latex + '{}';
  argFixed++;
});

// 1.6) latex 중복 제거 (악센트 템플릿화로 구조형과 겹칠 수 있음 — 첫 항목 유지)
{
  const seen = new Set();
  const deduped = ALL.filter((s) => (seen.has(s.latex) ? false : seen.add(s.latex)));
  ALL.length = 0;
  ALL.push(...deduped);
}

// 2) 그리스 문자 알파벳순 정렬 (자기들 위치 내에서만 재배열)
const GREEK_ORDER = [
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon', '\\zeta', '\\eta',
  '\\theta', '\\vartheta', '\\iota', '\\kappa', '\\varkappa', '\\lambda', '\\mu', '\\nu', '\\xi',
  '\\omicron', '\\pi', '\\varpi', '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau',
  '\\upsilon', '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
  '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi', '\\Sigma', '\\Upsilon',
  '\\Phi', '\\Psi', '\\Omega',
];
const greekRank = (latex) => {
  const i = GREEK_ORDER.indexOf(latex);
  return i === -1 ? 999 : i;
};
const greekPositions = [];
ALL.forEach((s, i) => { if (s.field === 'greek') greekPositions.push(i); });
const greekSorted = greekPositions.map((i) => ALL[i]).sort((a, b) => greekRank(a.latex) - greekRank(b.latex));
greekPositions.forEach((pos, k) => { ALL[pos] = greekSorted[k]; });

// 3) 20개 카탈로그 카테고리 분류
ALL.forEach((s) => { s.catalogCategory = classify(s); });

// 7탭 — 분야를 모두 흡수 (설계 §12-3: 기본 4개 + 확장). 함수는 미적분 탭.
const DEFAULT_CATEGORIES = [
  { id: 'basic', label: '기본', fields: ['arithmetic', 'vector'] },
  { id: 'calculus', label: '미적분', fields: ['calculus', 'analysis', 'function'] },
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

/** 카탈로그 20개 카테고리 (첨부 문서 기준, 표시 순서) */
export const CATALOG_CATEGORIES: { id: number; ko: string; en: string }[] = ${JSON.stringify(CATALOG_CATEGORIES, null, 2)};

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
