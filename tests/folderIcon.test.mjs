// M5 S2 — lib/folderIcon.ts 로직 검증 (npm run test:foldericon)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPhosphorIconName, resolveFolderGlyph, searchIndex,
  SEARCH_LIMIT, CATEGORY_LABELS_KO,
} from '../.test-build/lib/folderIcon.js';

/* ─── 이름 판별 (D7) ─── */
test('isPhosphorIconName: Phosphor 이름 통과, 이모지·빈 값·null 거부', () => {
  assert.equal(isPhosphorIconName('folder-star'), true);
  assert.equal(isPhosphorIconName('lego-smiley'), true);
  assert.equal(isPhosphorIconName('number-circle-1'), true);
  assert.equal(isPhosphorIconName('📁'), false);
  assert.equal(isPhosphorIconName('🗂️'), false);
  assert.equal(isPhosphorIconName(''), false);
  assert.equal(isPhosphorIconName(null), false);
  assert.equal(isPhosphorIconName(undefined), false);
  assert.equal(isPhosphorIconName('Folder'), false);  // 대문자는 이름이 아니다
  assert.equal(isPhosphorIconName('folder star'), false);
});

/* ─── 기본 아이콘 8조합 (D3·D4·N3·N4) ─── */
test('기본: 최상위 folder / 하위 folder-simple / 펼침은 depth 무관 folder-open', () => {
  assert.deepEqual(resolveFolderGlyph({ isRoot: true }), { kind: 'inline', key: 'folder', bold: false });
  assert.deepEqual(resolveFolderGlyph({ isRoot: false }), { kind: 'inline', key: 'folderSimple', bold: false });
  assert.deepEqual(resolveFolderGlyph({ isRoot: true, expanded: true }), { kind: 'inline', key: 'folderOpen', bold: false });
  assert.deepEqual(resolveFolderGlyph({ isRoot: false, expanded: true }), { kind: 'inline', key: 'folderOpen', bold: false });
});

test('활성이면 inline은 bold 플래그, asset은 bold weight (D3)', () => {
  assert.deepEqual(resolveFolderGlyph({ isRoot: true, active: true }), { kind: 'inline', key: 'folder', bold: true });
  assert.deepEqual(resolveFolderGlyph({ isRoot: false, expanded: true, active: true }), { kind: 'inline', key: 'folderOpen', bold: true });
  assert.deepEqual(resolveFolderGlyph({ icon: 'folder-star', isRoot: false }), { kind: 'asset', name: 'folder-star', weight: 'regular' });
  assert.deepEqual(resolveFolderGlyph({ icon: 'folder-star', isRoot: false, active: true }), { kind: 'asset', name: 'folder-star', weight: 'bold' });
});

test('옛 유니코드 값은 기본 아이콘으로 (N4 — 데이터 무접촉·표시만 폴백)', () => {
  assert.deepEqual(resolveFolderGlyph({ icon: '📁', isRoot: true }), { kind: 'inline', key: 'folder', bold: false });
  assert.deepEqual(resolveFolderGlyph({ icon: '🍎', isRoot: false, expanded: true, active: true }), { kind: 'inline', key: 'folderOpen', bold: true });
});

/* ─── 검색 (D6) ─── */
const IDX = [
  { n: 'folder-star', c: ['office'], t: ['directory', 'favorite'] },
  { n: 'star', c: ['design'], t: ['favorite'] },
  { n: 'apple-logo', c: ['brands'], t: ['apple'] },
  { n: 'planet', c: ['nature'], t: ['space', 'saturn'] },
];

test('searchIndex: name 부분일치가 태그 일치보다 앞선다', () => {
  const r = searchIndex(IDX, 'star', { excludeBrands: true });
  assert.deepEqual(r.map((i) => i.n), ['folder-star', 'star']);
  const r2 = searchIndex(IDX, 'favorite', { excludeBrands: true });
  assert.deepEqual(r2.map((i) => i.n), ['folder-star', 'star']); // 둘 다 태그 매치
});

test('searchIndex: brands 제외(N1) · 포함 옵션', () => {
  assert.deepEqual(searchIndex(IDX, 'apple', { excludeBrands: true }), []);
  assert.equal(searchIndex(IDX, 'apple', { excludeBrands: false })[0].n, 'apple-logo');
  // 빈 질의도 brands는 걸러진다
  assert.equal(searchIndex(IDX, '', { excludeBrands: true }).some((i) => i.n === 'apple-logo'), false);
});

test('searchIndex: 한글 표 매치는 name 뒤·tags 앞 (N2 — 표 없으면 영문만으로 동작)', () => {
  const ko = { planet: ['행성', '우주'], star: ['별'] };
  const r = searchIndex(IDX, '행성', { excludeBrands: true, ko });
  assert.deepEqual(r.map((i) => i.n), ['planet']);
  assert.deepEqual(searchIndex(IDX, '행성', { excludeBrands: true }), []); // 표 없음 → 미검출(오류 아님)
  // name 매치와 ko 매치가 공존하면 name 먼저
  const r2 = searchIndex(IDX, 'star', { excludeBrands: true, ko: { planet: ['star아님'] } });
  assert.equal(r2[0].n, 'folder-star');
});

test('searchIndex: 상한 80', () => {
  const big = Array.from({ length: 200 }, (_, i) => ({ n: `icon-${i}`, c: ['system'], t: [] }));
  assert.equal(searchIndex(big, 'icon', { excludeBrands: true }).length, SEARCH_LIMIT);
  assert.equal(searchIndex(big, '', { excludeBrands: true }).length, SEARCH_LIMIT);
});

/* ─── 카테고리 표 (N1·N5) ─── */
test('CATEGORY_LABELS_KO: 17종 · brands 없음', () => {
  assert.equal(CATEGORY_LABELS_KO.length, 17);
  assert.equal(CATEGORY_LABELS_KO.some(([c]) => c === 'brands'), false);
});
