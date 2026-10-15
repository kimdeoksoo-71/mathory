#!/usr/bin/env node
/**
 * Phase 71 — 수식 크기 탐침(한글 2022는 hwpx를 열 때 수식 sz를 다시 재지 않는다 — eqSize.ts).
 *
 *   node scripts/hwpxEqProbe.mjs     → docs/phaseSketch/phase71-stage0/수식탐침/ (로컬 — 커밋하지 않는다)
 *   node scripts/hwpxEqProbe.mjs --read <한글이 저장한 C-보정.hwpx>   → 실측 sz·baseLine을 JSON으로(보정 입력)
 *
 * ① P-*.hwpx — "한글이 열 때 다시 재게 만드는" 가설 하나씩(파일을 나눠 하나가 안 열려도 나머지는 연다):
 *    A 현재(추정 크기) · B sz 0×0 · C sz 요소 없음 · D 옛 수식 판(Equation Version 50) · E version 속성 없음 · F sz 0×0 + baseLine 없음
 * ② C-보정.hwpx — 대표 수식 N개. 덕수가 한글에서 수식마다 편집기에 들어갔다 나와(다시 재게 해) 저장하면
 *    그 sz·baseLine이 한글의 정답이다 → KaTeX 측정값과 맞춰 보정한다. LaTeX 목록은 C-보정.json.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv[2] === '--read') {
  const s = strFromU8(unzipSync(new Uint8Array(readFileSync(process.argv[3])))['Contents/section0.xml']);
  const out = [...s.matchAll(/<hp:equation [^>]*?baseLine="(\d+)"[^>]*?baseUnit="(\d+)"[^>]*>[\s\S]*?<hp:sz width="(\d+)"[^>]*height="(\d+)"[\s\S]*?<hp:script[^>]*>([\s\S]*?)<\/hp:script>/g)]
    .map((m) => ({ base: +m[1], baseUnit: +m[2], w: +m[3], h: +m[4], script: m[5] }));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}

execFileSync('npx', ['tsc', 'lib/export/hwpx/package.ts', 'lib/export/hwpx/xml.ts', 'lib/export/hwpx/hwpEq.ts', 'lib/export/hwpx/eqSize.ts', 'lib/export/hwpx/zip.ts',
  'lib/export/hwpx/skeleton/parts.ts', 'lib/export/hwpx/skeleton/ids.ts', '--outDir', '.test-build', '--rootDir', '.', '--module', 'commonjs', '--target', 'es2022',
  '--moduleResolution', 'node', '--skipLibCheck'], { cwd: ROOT, stdio: 'inherit' });
const B = (p) => import(join(ROOT, '.test-build/lib/export/hwpx', p));
const { buildPackage } = await B('package.js');
const { latexToHwp } = await B('hwpEq.js');
const { estimateSize } = await B('eqSize.js');
const P = await B('skeleton/parts.js');
const { STYLE_IDS: S } = await B('skeleton/ids.js');

const OUT = join(ROOT, 'docs/phaseSketch/phase71-stage0/수식탐침');
mkdirSync(OUT, { recursive: true });

const T = (s) => ({ k: 'text', s });
const run = (key, ...items) => ({ charPr: S[key].charPr, items });
const para = (key, runs, extra = {}) => ({ style: S[key].id, paraPr: S[key].paraPr, runs, ...extra });
const eq = (latex, display = false) => {
  const src = display ? `\\displaystyle ${latex}` : `\\displaystyle ${latex}`;
  return { k: 'eq', script: latexToHwp(latex).script, size: estimateSize(src) };
};
const first = (p) => ({ ...p, secPr: P.SEC_PR, secPrCharPr: S.MTQBody.charPr });
function write(dir, name, paras, mutate = (x) => x) {
  let bytes = buildPackage({ title: name, header: P.HEADER_XML, paras, bins: [], prvText: name });
  if (mutate !== null) {
    // 수식 XML만 바꾼 판 — section0을 다시 써서 묶는다
    const entries = unzipSync(bytes);
    const sec = mutate(strFromU8(entries['Contents/section0.xml']));
    bytes = buildPackage({ title: name, header: P.HEADER_XML, paras, bins: [], prvText: name, sectionOverride: sec });
  }
  writeFileSync(join(dir, `${name}.hwpx`), bytes);
  console.log(`  ${name}.hwpx`);
}

/* ═══ ① 가설 파일 ═══ */
const probeParas = (label) => [
  first(para('MTSBody', [run('MTSBody', T(`[${label}] 아래 세 줄의 수식이 앞뒤 글자와 빈칸·겹침 없이, '='가 줄 가운데에 오면 성공`))])),
  para('MTSBody', [run('MTSBody', T('(2)에 의하여 '), eq(String.raw`a_{5} = \frac{4a_{4}}{2} = 2a_{4}`), T(' (짝수)이므로'))]),
  para('MTSBody', [run('MTSBody', T('만약 '), eq(String.raw`a_{3} = 1`), T(' 이면 '), eq(String.raw`a_{6} = 5a_{4} = 20`), T(' 이고,'))]),
  para('MTSBody', [run('MTSBody', T('지수 분수 '), eq(String.raw`\sqrt[3]{5} \times 25^{\frac{1}{3}}`), T(' 의 값은?'))]),
  para('MTSEq', [run('MTSEq', eq(String.raw`a_{4} = \frac{3a_{3}}{2} = 6`, true))]),
];
const VARIANTS = {
  'P-A 현재(추정 크기)': (s) => s,
  'P-B sz 0x0': (s) => s.replace(/(<hp:equation [\s\S]*?)<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"/g, '$1<hp:sz width="0" widthRelTo="ABSOLUTE" height="0"'),
  'P-C sz 없음': (s) => s.replace(/(<hp:equation [^>]*>)<hp:sz [^>]*\/>/g, '$1'),
  'P-D 옛 수식 판(Version 50)': (s) => s.replace(/version="Equation Version 60"/g, 'version="Equation Version 50"'),
  'P-E version 없음': (s) => s.replace(/ version="Equation Version 60"/g, ''),
  'P-F sz 0x0 + baseLine 없음': (s) => s.replace(/ baseLine="\d+"/g, '').replace(/(<hp:equation [\s\S]*?)<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="\d+"/g, '$1<hp:sz width="0" widthRelTo="ABSOLUTE" height="0"'),
};
console.log('[hwpxEqProbe] →', OUT);
for (const [name, fn] of Object.entries(VARIANTS)) write(OUT, name, probeParas(name.slice(0, 3)), fn);

/* ═══ ② 보정 파일 ═══ */
const R = String.raw;
const CAL = [
  // 글자·첨자
  'a', '3', 'x+1', 'A, B', 'a_{n}', 'a_{n+1}', 'x^{2}', '2^{x}', 'x_{1}^{2}', R`a_{3} = 1`, R`f'(x)`, R`f''(x)`,
  // 분수(인라인 displaystyle)
  R`\frac{1}{2}`, R`\frac{3}{4}`, R`\frac{4a_{4}}{2}`, R`a_{5} = \frac{4a_{4}}{2} = 2a_{4}`, R`\frac{x^{2}+1}{x}`, R`\frac{\sqrt{10}}{4}\pi`, R`-\frac{3}{4}`,
  // 첨자 안 분수 · 근호
  R`25^{\frac{1}{3}}`, R`e^{\frac{x}{2}}`, R`\sqrt{3}`, R`\sqrt[3]{5}`, R`\sqrt{x^{2}+1}`, R`2\sqrt{3}`,
  // 괄호·함수·기호
  R`\left( ax + \frac{2}{x} \right)^{6}`, R`\mathrm{P}(A \cup B)`, R`{}_{6}\mathrm{C}_{r}`, R`\left| x - 1 \right|`, R`\log_{2} 3`, R`\ln (e+1)`, R`\overline{AB}`, R`\sin x`,
  // 큰 연산자
  R`\sum_{k=1}^{n} k^{2}`, R`\int_{0}^{1} f(x)\,dx`, R`\lim_{x \to 0} \frac{\sin x}{x}`,
  // 여러 줄
  R`\begin{cases} x+1 & (x<0) \\ x^{2} & (x \ge 0) \end{cases}`, R`\begin{aligned} X &= 7Y - 2n \\ &= 6 \end{aligned}`,
  // 글자
  R`x \text{ 또는 } y`, R`k \neq 0`,
];
const calParas = [first(para('MTSBody', [run('MTSBody', T('[보정] 수식마다 두 번 눌러 수식 편집기를 열고 그대로 닫은 뒤(Shift+Esc 또는 "넣기") 다른 이름으로 저장 → hwpx로 보내 주세요'))]))];
CAL.forEach((l, i) => calParas.push(para('MTSBody', [run('MTSBody', T(`[${i + 1}] `), eq(l), T(' 끝'))])));
write(OUT, 'C-보정(수식 ' + CAL.length + '개)', calParas, null);
writeFileSync(join(OUT, 'C-보정.json'), JSON.stringify(CAL, null, 1));
console.log(`  C-보정.json (${CAL.length})`);
