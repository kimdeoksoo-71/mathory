/**
 * Phase 71 — HWPX 스타일 표 · 뼈대 · 템플릿 위생.
 *
 * 실행: npm run test:exporthwpxstyles
 *
 * ① styles.ts 16종(키 유일 · 영문 이름은 영숫자만 — D14) ② ids.ts가 같은 16종을 이름으로 찾았는가
 * ③ 커밋된 뼈대 = 커밋된 템플릿의 추출 결과(scripts/hwpxSkeleton.mjs --check) ④ 커밋된 템플릿에 개인 정보 없음(N7′)
 * ⑤ 쪽 규격(A3 · 열 폭 31649 — v5 §1-2) ⑥ 경우 라벨 로마자 표기(R10)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';

import { STYLES, STYLE_BY_KEY } from '../.test-build/lib/export/hwpx/styles.js';
import { STYLE_IDS, PAGE } from '../.test-build/lib/export/hwpx/skeleton/ids.js';
import { caseLabelHwp, toRoman } from '../.test-build/lib/export/hwpx/roman.js';

test('H1 스타일 16종 — 키 유일 · 영문 이름 영숫자만 · 이름 유일 · 문제-번호만 글자 스타일', () => {
  assert.equal(STYLES.length, 16);
  assert.equal(new Set(STYLES.map((s) => s.key)).size, 16);
  assert.equal(new Set(STYLES.map((s) => s.name)).size, 16);
  for (const s of STYLES) assert.match(s.key, /^[A-Za-z0-9]+$/, s.key);
  assert.deepEqual(STYLES.filter((s) => s.kind === 'CHAR').map((s) => s.key), ['MTQNum']);
  assert.equal(STYLE_BY_KEY.MTSH1.name, '해설-제목');
});

test('H2 ids.ts — 16종을 이름으로 찾았다(id 유일)', () => {
  for (const s of STYLES) {
    assert.ok(STYLE_IDS[s.key], s.key);
    assert.equal(STYLE_IDS[s.key].name, s.name);
  }
  assert.equal(new Set(Object.values(STYLE_IDS).map((x) => x.id)).size, 16);
});

test('H3 뼈대 = 템플릿 추출 결과(손 수정·재생성 누락 없음)', () => {
  const out = execFileSync('node', ['scripts/hwpxSkeleton.mjs', '--check'], { encoding: 'utf8' });
  assert.match(out, /--check OK/);
});

test('H4 커밋된 템플릿 — 개인 정보 없음 · 구역 하나 · 첫 항목 mimetype', () => {
  const entries = unzipSync(new Uint8Array(readFileSync('docs/phasedocs/Mathory_tmp.hwpx')));
  assert.equal(Object.keys(entries)[0], 'mimetype');
  for (const [name, data] of Object.entries(entries)) {
    if (!/\.(xml|hpf|rdf|txt)$/.test(name)) continue;
    assert.doesNotMatch(strFromU8(data), /kimdeoksoo|deoksoo|@gmail|백승우/i, name);
  }
  assert.match(strFromU8(entries['Contents/header.xml']), /secCnt="1"/);
  assert.ok(!entries['Contents/section1.xml']);
});

test('H5 쪽 규격 — A3 297×420 · 2단 · 열 폭 31649(템플릿 lineseg 31648)', () => {
  assert.equal(PAGE.width, 84188);
  assert.equal(PAGE.height, 119052);
  assert.equal(PAGE.colCount, 2);
  assert.equal(PAGE.colWidth, 31649);
});

test('H6 경우 라벨 — C1 ( i ) · C3 ( iii ) · C1a ( i - 1 ) · C2b ( ii - 2 ) · 모양 아니면 null', () => {
  assert.equal(caseLabelHwp('C1'), '( i )');
  assert.equal(caseLabelHwp('C3'), '( iii )');
  assert.equal(caseLabelHwp('C4'), '( iv )');
  assert.equal(caseLabelHwp('C1a'), '( i - 1 )');
  assert.equal(caseLabelHwp('C2b'), '( ii - 2 )');
  assert.equal(caseLabelHwp('C1.'), '( i )');
  assert.equal(caseLabelHwp('가'), null);
  assert.equal(toRoman(14), 'xiv');
});
