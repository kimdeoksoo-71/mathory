/**
 * Phase 70 Stage 0 · P0-1 — mitex 대응률 프로브.
 *
 * 표본(Q19′): (가) 시트 Data_DS·Stack(61a 서비스 계정, 읽기 전용) + (나) Mathory 덤프(mathory-dump.json —
 * 임시 덤프 페이지에서 덕수가 내려받음) · 대표 13문항은 덤프 안에서 제목으로 찾는다(v4 §4-1).
 *
 * ⚠ 수식은 **실제 직렬화기가 mitex에 넘기는 문자열**(serializeTypst의 formulas — `\displaystyle` 주입·cases `\quad`
 *   반영본)을 **하나씩** 컴파일한다. 묶어서 컴파일하면 미지원 명령 하나가 묶음 전체를 실패시켜 집계가 무너진다(v4 J3).
 * ⚠ 엔진은 브라우저와 같은 Typst 0.14.2(@myriaddreamin/typst-ts-node-compiler 0.7.0) + 벤더링 mitex 0.2.7.
 *
 * 실행: npm run probe:export -- [--dump <경로>] [--sheets Stack(기본) | Data_DS,Stack | --no-sheets] [--limit N]
 *   (dump 기본값: ~/Downloads/mathory-dump.json — 없으면 시트만)
 * 출력: 요약(표준 출력) + .probe/export-stage0.json(상세 — gitignore). 환경변수 값은 출력하지 않는다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc } from '../.test-build/lib/export/ir.js';
import { serializeTypst } from '../.test-build/lib/export/typst.js';
import { ensureExportFonts } from '../tests/helpers/exportFonts.mjs';

const require = createRequire(import.meta.url);
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');
const { JWT } = require('google-auth-library');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MITEX = '/public/typst/packages/preview/mitex/0.2.7/lib.typ';
const REPS = [
  '26K32_1공통01', '26K32_1공통04', '26K32_1공통13', '26K32_1공통15', '26K32_1공통20', '26K32_1공통22',
  '26K32_3확통27', '26K32_3확통28', '26K32_3확통29', '26K32_3확통30', '26K32_4미적26', '26K32_4미적29', '26K32_5기하30',
];

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

function loadEnv() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function parseArgs(argv) {
  const a = { dump: path.join(os.homedir(), 'Downloads', 'mathory-dump.json'), sheets: ['Stack'], limit: 0 };   // Data_DS는 처리 후 비워지는 시트(2026-10-13 실측 0행) — 필요하면 --sheets로
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dump') a.dump = argv[++i];
    else if (argv[i] === '--sheets') a.sheets = argv[++i].split(',').filter(Boolean);
    else if (argv[i] === '--no-sheets') a.sheets = [];
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10) || 0;
  }
  return a;
}

async function readSheet(sheetName) {
  const jwt = new JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const { token } = await jwt.getAccessToken();
  const id = (process.env.AUDITION_SPREADSHEET_ID || '').trim().replace(/^\/+|\/+$/g, '');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`${sheetName}!A1:P`)}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) die(`시트 ${sheetName}을 읽지 못했습니다 (HTTP ${res.status})`);
  return (await res.json())?.values ?? [];
}

/** 시트 행 → ExportInput(문제 = E + 선택지 F~J · 풀이 = C) — 열 의미는 lib/sheetImport.SHEET_COL */
function rowToInput(row, sheet, i) {
  const s = (k) => (typeof row[k] === 'string' ? row[k] : row[k] == null ? '' : String(row[k]));
  const choices = [5, 6, 7, 8, 9].map((k, j) => s(k).trim() ? `${'①②③④⑤'[j]} ${s(k).trim()}` : '').filter(Boolean).join('\n');
  const q = [{ id: 'e', type: 'text', raw_text: s(4) }];
  if (choices) q.push({ id: 'ch', type: 'choices', raw_text: choices });
  return {
    key: `${sheet}#${i + 1} ${s(0).slice(0, 40)}`,
    input: { title: s(0), tabs: [{ id: 'question', label: '문제', blocks: q }, { id: 'solution', label: '풀이', blocks: [{ id: 'c', type: 'text', raw_text: s(2) }] }] },
  };
}

function dumpToInputs(dumpPath) {
  if (!dumpPath || !fs.existsSync(dumpPath)) return null;
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  return dump.problems.map((p) => ({
    key: `dump ${p.folder ? p.folder + '\\' : ''}${p.title}`,
    title: p.title,
    input: { title: p.title, tabs: (p.tabs.length ? p.tabs : [{ id: 'question', label: '문제' }, { id: 'solution', label: '풀이' }]).map((t) => ({ id: t.id, label: t.label, blocks: p.tabBlocks[t.id] || [] })) },
  }));
}

/* ═══ 본문 ═══ */
loadEnv();
const args = parseArgs(process.argv.slice(2));
const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);

const items = [];
for (const sheet of args.sheets) {
  if (!process.env.GOOGLE_SA_EMAIL) die('GOOGLE_SA_* 환경변수가 없어 시트를 못 읽습니다(--no-sheets로 덤프만 가능)');
  const rows = await readSheet(sheet);
  const body = rows.slice(1).filter((r) => r && (r[4] || r[2]));
  const take = args.limit ? body.slice(0, args.limit) : body;
  take.forEach((r, i) => items.push({ source: sheet, ...rowToInput(r, sheet, i) }));
  console.log(`· ${sheet}: ${take.length}행`);
}
const dumped = dumpToInputs(args.dump);
if (dumped) { dumped.forEach((d) => items.push({ source: 'dump', ...d })); console.log(`· 덤프: ${dumped.length}문항 (${args.dump})`); }
else console.log(`· 덤프 없음(${args.dump}) — 시트만`);
if (!items.length) die('표본이 없습니다');

const fonts = await ensureExportFonts();
if (!fonts.dir) die(`글꼴을 받지 못했습니다 — ${fonts.reason}`);
const compiler = NodeCompiler.create({ workspace: ROOT, fontArgs: [{ fontPaths: [fonts.dir] }] });

// 수식 수집(직렬화기가 실제로 넘기는 문자열)
const formulaMap = new Map();   // key → { latex, display, occurrences, items:Set }
const itemFormulas = new Map(); // item.key → formula keys
for (const it of items) {
  let doc;
  try { doc = buildExportDoc(it.input, { parse }); } catch (e) { console.warn(`IR 실패: ${it.key} — ${e.message}`); continue; }
  const { formulas } = serializeTypst(doc, { figurePath: () => null, mitexImport: MITEX });
  const keys = [];
  for (const f of formulas) {
    const k = (f.display ? 'D|' : 'I|') + f.latex;
    const rec = formulaMap.get(k) ?? { latex: f.latex, display: f.display, occurrences: 0, items: new Set() };
    rec.occurrences += 1; rec.items.add(it.key);
    formulaMap.set(k, rec); keys.push(k);
  }
  itemFormulas.set(it.key, keys);
}

const typStr = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, '\\t') + '"';
const head = `#import ${typStr(MITEX)}: mitex, mi\n#set text(font: ("Noto Serif KR",), size: 10pt)\n#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif KR"))\n`;
function compileOne(latex, display) {
  const r = compiler.compile({ mainFileContent: head + (display ? `#mitex(${typStr(latex)})` : `#mi(${typStr(latex)})`) });
  const errs = (r.takeDiagnostics()?.shortDiagnostics ?? []).filter((d) => d.severity === 1 || d.severity === 'error').map((d) => d.message);
  return { ok: !!r.result && errs.length === 0, errs };
}
// 자가 점검 — 프로브가 실패를 실패로 잡는지(결과가 '전부 성공'이면 먼저 프로브를 의심할 것)
if (compileOne('\\textcircled{1}', false).ok || !compileOne('\\displaystyle x^2', false).ok || compileOne('\\foo', true).ok) die('자가 점검 실패 — 프로브가 mitex 오류를 잡지 못한다');
console.log('· 자가 점검 통과(\\textcircled·\\foo = 실패, x^2 = 성공)');
let n = 0;
const t0 = Date.now();
for (const [k, rec] of formulaMap) {
  if (++n % 200 === 0) { compiler.evictCache(30); process.stdout.write(`\r  컴파일 ${n}/${formulaMap.size}`); }
  const { ok, errs } = compileOne(rec.latex, rec.display);
  rec.ok = ok;
  if (!rec.ok) {
    const m = errs.join(' | ');
    const cmd = /unknown command: (\\[A-Za-z]+|\\.)/.exec(m)?.[1] ?? /error unexpected: "?([^"|]+)"?/.exec(m)?.[1];
    rec.reason = cmd ? cmd : m.slice(0, 90);
  }
}
process.stdout.write(`\r  컴파일 ${formulaMap.size}/${formulaMap.size} (${((Date.now() - t0) / 1000).toFixed(1)}초)\n`);

/* ═══ 집계 ═══ */
function summarize(filter) {
  const its = items.filter(filter);
  let occ = 0, occFail = 0;
  const uniq = new Set(), uniqFail = new Set();
  let itemsWithFail = 0;
  const reasons = new Map();
  for (const it of its) {
    let failed = false;
    for (const k of itemFormulas.get(it.key) ?? []) {
      const rec = formulaMap.get(k);
      occ += 1; uniq.add(k);
      if (!rec.ok) { occFail += 1; uniqFail.add(k); failed = true; reasons.set(rec.reason, (reasons.get(rec.reason) ?? 0) + 1); }
    }
    if (failed) itemsWithFail += 1;
  }
  return {
    items: its.length, formulas: occ, unique: uniq.size, failedOccurrences: occFail, failedUnique: uniqFail.size,
    successRate: occ ? +(100 * (1 - occFail / occ)).toFixed(2) : 100,
    itemsWithFailure: itemsWithFail, itemFailureRate: its.length ? +(100 * itemsWithFail / its.length).toFixed(1) : 0,
    topReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
  };
}
const report = {
  at: new Date().toISOString(), engine: 'Typst 0.14.2 (typst-ts-node-compiler 0.7.0) + mitex 0.2.7',
  all: summarize(() => true),
  bySource: Object.fromEntries([...new Set(items.map((i) => i.source))].map((s) => [s, summarize((i) => i.source === s)])),
  reps: REPS.map((t) => {
    const it = items.find((i) => i.source === 'dump' && i.title === t);
    if (!it) return { title: t, found: false };
    const fails = (itemFormulas.get(it.key) ?? []).map((k) => formulaMap.get(k)).filter((r) => !r.ok);
    return { title: t, found: true, formulas: (itemFormulas.get(it.key) ?? []).length, failed: fails.map((r) => ({ reason: r.reason, latex: r.latex.slice(0, 120) })) };
  }),
  failures: [...formulaMap.values()].filter((r) => !r.ok).map((r) => ({ reason: r.reason, display: r.display, occurrences: r.occurrences, latex: r.latex.slice(0, 200), example: [...r.items][0] })),
};

fs.mkdirSync(path.join(ROOT, '.probe'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.probe', 'export-stage0.json'), JSON.stringify(report, null, 1));

const line = (name, s) => console.log(`${name.padEnd(8)} 문항 ${s.items} · 수식 ${s.formulas}(고유 ${s.unique}) · 성공률 ${s.successRate}% · 실패 고유 ${s.failedUnique} · 실패 문항 ${s.itemsWithFailure}(${s.itemFailureRate}%)`);
console.log('\n═══ P0-1 mitex 대응률 ═══');
line('전체', report.all);
for (const [k, v] of Object.entries(report.bySource)) line(k, v);
console.log('\n실패 원인 상위(발생 수):');
for (const [r, c] of report.all.topReasons) console.log(`  ${String(c).padStart(5)}  ${r}`);
if (report.reps.some((r) => r.found)) {
  console.log('\n대표 13문항:');
  for (const r of report.reps) console.log(`  ${r.title.padEnd(16)} ${r.found ? `수식 ${r.formulas} · 실패 ${r.failed.length}${r.failed.length ? ' — ' + r.failed.map((f) => f.reason).join(', ') : ''}` : '덤프에 없음'}`);
}
console.log(`\n상세: .probe/export-stage0.json`);
