/**
 * Phase 70 — 블록 kind 매핑표(D2)와 레이아웃 상수(D19·D20·D26) 검증.
 *
 * 실행: npm run test:exportkinds
 *
 * ⚠ 타입 목록은 `types/problem.ts`의 union **원문을 파싱**한다 — 테스트에 사본 목록을 두면
 *   새 타입이 생겨도 테스트가 모른다(`tests/exportMd.test.mjs` ALL_TYPES가 13종에서 멈춘 전례).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BLOCK_KIND, kindOf, FALLBACK_KIND } from '../.test-build/lib/export/blockKinds.js';
import {
  imageWidthPt, typstGap, typstColumnWidthMm, latexTextWidthMm, choiceColumns,
  TYPST_LEADING_PT, CSS_GAP_PT, GAP_SCALE, tabTitle, BODY_PT,
} from '../.test-build/lib/export/layout.js';

function unionTypes() {
  const src = readFileSync(new URL('../types/problem.ts', import.meta.url), 'utf8');
  // ⚠ 파일에 `type:` union이 여럿이다(세션 'comment'|'normal'|'public' 등) — 레거시 'math_block'을 품은 것이 Block의 union
  const m = [...src.matchAll(/^\s*type:\s*((?:'[a-z_]+'\s*\|\s*)+'[a-z_]+');/gm)].find((x) => x[1].includes("'math_block'"));
  assert.ok(m, 'types/problem.ts에서 Block type union을 찾지 못했다 — 선언 모양이 바뀌었으면 이 정규식을 고칠 것');
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

test('K1 union 17종 전부가 매핑표에 있다(빠짐 0)', () => {
  const types = unionTypes();
  assert.equal(types.length, 17, `union이 ${types.length}종 — 타입이 늘었으면 BLOCK_KIND에 한 줄 더하고 이 수를 고칠 것`);
  const missing = types.filter((t) => !(t in BLOCK_KIND));
  assert.deepEqual(missing, []);
});

test('K2 매핑표에 union 밖 키가 없다(오타·폐기 타입 방지)', () => {
  const types = new Set(unionTypes());
  const extra = Object.keys(BLOCK_KIND).filter((k) => !types.has(k));
  assert.deepEqual(extra, []);
});

test('K3 레거시 3종은 현행 짝과 같은 kind', () => {
  assert.deepEqual(BLOCK_KIND.math_block, BLOCK_KIND.text);
  assert.deepEqual(BLOCK_KIND.bullet, BLOCK_KIND.text);
  assert.deepEqual(BLOCK_KIND.coach_caution, BLOCK_KIND.coach_important);
});

test('K4 kind·variant 대표값', () => {
  assert.deepEqual(BLOCK_KIND.case, { kind: 'case', variant: 'top' });
  assert.deepEqual(BLOCK_KIND.subcase, { kind: 'case', variant: 'sub' });
  assert.deepEqual(BLOCK_KIND.box, { kind: 'framed', variant: 'plain' });
  assert.deepEqual(BLOCK_KIND.ggb, { kind: 'figure', variant: 'ggb' });
  assert.equal(BLOCK_KIND.callout.kind, 'indent');
  assert.equal(BLOCK_KIND.list.kind, 'para');
});

test('K5 미지의 type → para 폴백 + known=false', () => {
  const r = kindOf('future_type');
  assert.equal(r.known, false);
  assert.deepEqual(r.entry, FALLBACK_KIND);
  assert.equal(kindOf('toString').known, false, '프로토타입 키를 타입으로 오인하지 않는다');
  assert.equal(kindOf('choices').known, true);
});

test('L1 열 폭 — 수능 양식 A3 2단 112mm(70c) · LaTeX A4 1단 170mm', () => {
  assert.equal(typstColumnWidthMm(), 112);
  assert.equal(latexTextWidthMm(), 170);
});

test('L2 그림 폭(D20) = min(px × 0.75, 열 폭 × 0.9)', () => {
  assert.equal(imageWidthPt(300, 'typst'), 225);
  assert.equal(imageWidthPt(400, 'typst'), 285.73, '열 폭 112mm × 0.9 = 100.8mm 상한');
  assert.equal(imageWidthPt(undefined, 'typst'), 285.73, '기본 400px');
  assert.equal(imageWidthPt(0, 'typst'), 285.73, '0·음수는 기본값');
  assert.equal(imageWidthPt(900, 'typst'), 285.73, '600px 상한이 먼저');
  assert.equal(imageWidthPt(600, 'latex'), 433.7, 'LaTeX 상한 153mm');
  assert.equal(imageWidthPt(200, 'latex'), 150);
});

test('L3 세로 간격 변환(D26·70c D) — CSS × 1.15 + leading(0.69em × 11.5pt)', () => {
  assert.equal(BODY_PT, 11.5);
  assert.ok(Math.abs(GAP_SCALE - 1.15) < 1e-9);
  assert.ok(Math.abs(TYPST_LEADING_PT - 7.935) < 1e-9);
  assert.ok(Math.abs(typstGap(CSS_GAP_PT.paragraph) - 14.84) < 0.011);
  assert.ok(Math.abs(typstGap(CSS_GAP_PT.display) - 20.59) < 0.011);
});

test('L5 탭 제목(70c C) — 문제 · 해설 · 그 밖은 이름 그대로', () => {
  assert.equal(tabTitle('question', '문제'), '문제');
  assert.equal(tabTitle('solution', '풀이'), '해설');
  assert.equal(tabTitle('extra_1', 'AI 풀이'), 'AI 풀이');
});

test('L4 선택지 열 수 — 1~3개 3열 · 4~5개 5열', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(choiceColumns), [3, 3, 3, 5, 5]);
});
