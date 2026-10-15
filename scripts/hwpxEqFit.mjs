#!/usr/bin/env node
/**
 * Phase 71 — hwpLayout.PARAMS를 한글 실측(tests/fixtures/export/hwpEqCalibration.json)에 맞춘다.
 *
 *   node scripts/hwpxEqFit.mjs           → 현재 PARAMS의 수식별 오차 표
 *   node scripts/hwpxEqFit.mjs --fit     → 좌표 하강으로 맞춘 PARAMS(붙여 넣을 객체)와 오차 표
 *
 * 손실 = 폭의 상대 오차² + (위·아래 em 오차)² × 4 — 위·아래(기준선)가 '=' 세로 위치를 정하므로 무겁게.
 * 실측을 더 모으면(덕수가 한글에서 다시 재게 해 저장한 hwpx → scripts/hwpxEqProbe.mjs --read) fixture에 더하고 다시 돌린다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npx', ['tsc', 'lib/export/hwpx/hwpLayout.ts', '--outDir', '.test-build', '--rootDir', '.', '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck'], { cwd: ROOT, stdio: 'inherit' });
const require = createRequire(import.meta.url);
const { layoutHwp, PARAMS } = require(join(ROOT, '.test-build/lib/export/hwpx/hwpLayout.js'));
const cal = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/export/hwpEqCalibration.json'), 'utf8')).items;
const truth = cal.map((c) => { const A = (c.h * c.base) / 100 / 1100; return { ...c, W: c.w / 1100, A, D: c.h / 1100 - A }; });

function loss(P) {
  let L = 0;
  for (const c of truth) {
    const b = layoutHwp(c.script, P);
    L += ((b.w - c.W) / c.W) ** 2 + 4 * ((b.a - c.A) ** 2 + (b.d - c.D) ** 2);
  }
  return L / truth.length;
}

let P = { ...PARAMS };
if (process.argv.includes('--fit')) {
  const keys = Object.keys(P).filter((k) => k !== 'A0' && k !== 'D0');
  let best = loss(P);
  for (let round = 0; round < 60; round++) {
    let improved = false;
    for (const k of keys) {
      for (const step of [0.2, 0.05, 0.01]) {
        for (const dir of [1, -1]) {
          const trial = { ...P, [k]: Math.round((P[k] * (1 + dir * step) + (P[k] === 0 ? dir * step * 0.1 : 0)) * 1000) / 1000 };
          const l = loss(trial);
          if (l < best - 1e-9) { best = l; P = trial; improved = true; }
        }
      }
    }
    if (!improved) break;
  }
  console.log('export const PARAMS =', JSON.stringify(P).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', '), ';');
}

let ew = 0, ea = 0, ed = 0, worst = [];
for (const [i, c] of truth.entries()) {
  const b = layoutHwp(c.script, P);
  const rw = (b.w - c.W) / c.W, da = b.a - c.A, dd = b.d - c.D;
  ew += rw * rw; ea += da * da; ed += dd * dd;
  worst.push([Math.abs(rw) + Math.abs(da) + Math.abs(dd), i]);
  console.log(String(i + 1).padStart(2), `${(rw * 100).toFixed(0)}%`.padStart(5), da.toFixed(2).padStart(6), dd.toFixed(2).padStart(6), c.script.slice(0, 60));
}
const n = truth.length;
console.log(`loss ${loss(P).toFixed(4)} · 폭 RMS ${(100 * Math.sqrt(ew / n)).toFixed(1)}% · 위 RMS ${Math.sqrt(ea / n).toFixed(3)}em · 아래 RMS ${Math.sqrt(ed / n).toFixed(3)}em`);
