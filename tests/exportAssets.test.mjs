/**
 * Phase 70 — 자산·zip·Overleaf 순수 함수 검증(브라우저 API를 쓰는 collectFigures·toPng·downloadFile·openInOverleaf는
 * 실물 검수 ①③이 맡는다).
 *
 * 실행: npm run test:exportassets
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc } from '../.test-build/lib/export/ir.js';
import { sniffImage, safeFileName, figureVariants, zipFiles } from '../.test-build/lib/export/assets.js';
import { toBase64 } from '../.test-build/lib/export/overleaf.js';
import { sampleProblem } from './fixtures/export/sampleProblem.mjs';

const require = createRequire(import.meta.url);
const { unzipSync, strFromU8 } = require('fflate');
const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);
const u8 = (...xs) => new Uint8Array(xs);
const enc = (s) => new TextEncoder().encode(s);

test('A1 매직 바이트 판별 — 확장자·URL이 아니라 바이트로', () => {
  assert.equal(sniffImage(u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
  assert.equal(sniffImage(u8(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  assert.equal(sniffImage(enc('GIF89a....')), 'gif');
  assert.equal(sniffImage(u8(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)), 'webp');
  assert.equal(sniffImage(enc('  <svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
  assert.equal(sniffImage(enc('<?xml version="1.0"?>\n<svg></svg>')), 'svg');
  assert.equal(sniffImage(enc(String.fromCharCode(0xfeff) + '<svg/>')), 'svg', 'BOM');
  assert.equal(sniffImage(enc('<html>')), 'unknown');
});

test('A2 파일 이름 위생 — ProblemView MD 다운로드와 같은 치환', () => {
  assert.equal(safeFileName('2026 수능: 미적분 #21/학생?'), '2026 수능_ 미적분 #21_학생_');
  assert.equal(safeFileName('   '), '수학 문제');
});

test('A3 그림 변형 — 회색 이미지·본문 img·svg를 빠짐없이', () => {
  const doc = buildExportDoc(sampleProblem, { parse });
  const v = figureVariants(doc);
  assert.deepEqual(v.get('fig-1'), { plain: true, gray: true }, '같은 그림이 회색(image 블록)과 원본(본문 img)으로 쓰인다');
  assert.deepEqual(v.get('fig-2'), { plain: true, gray: false });
});

test('A4 zip 왕복 — 문자열·바이트', () => {
  const z = zipFiles({ 'main.typ': '= 제목\n', 'figures/fig-1.png': u8(1, 2, 3) });
  const back = unzipSync(z);
  assert.equal(strFromU8(back['main.typ']), '= 제목\n');
  assert.deepEqual([...back['figures/fig-1.png']], [1, 2, 3]);
});

test('A5 base64 — 큰 배열도 조각 단위로(Buffer와 같은 결과)', () => {
  const big = new Uint8Array(200000).map((_, i) => (i * 31) & 0xff);
  assert.equal(toBase64(big), Buffer.from(big).toString('base64'));
});
