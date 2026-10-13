// Phase 70a CDP 하니스 — headless Chrome으로 app/dev70(임시 라우트)을 열어 내보내기 다이얼로그를 실제로 돌린다.
// 준비: cp docs/phaseSketch/phase70-dev70-page.tsx.txt app/dev70/page.tsx · npm run dev(3000) · node docs/phaseSketch/phase70-cdp-harness.mjs
// 확인: 형식 기억·추가 형식 접기 · .typ zip(그림·회색·svg) · 받은 main.typ 실제 컴파일 · .tex zip(svg → png) ·
//       Overleaf 폼 필드(외부 POST 없이 기록) · 탭 선택이 MD·PDF 콜백에 그대로 · 그림 실패 안내
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { unzipSync, strFromU8 } = require('fflate');
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9370;
const PAGE_URL = 'http://localhost:3000/dev70';
const ROOT = new URL('../../', import.meta.url).pathname;
const profile = mkdtempSync(join(tmpdir(), 'cdp70-'));
const dl = mkdtempSync(join(tmpdir(), 'cdp70-dl-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = list.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('chrome not up');
}
const ws = new WebSocket(await getWs());
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description)); return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: true });
await send('Page.navigate', { url: PAGE_URL });
for (let i = 0; i < 200; i++) { if (await ev('!!(window.__h70 && window.__h70.ready && document.querySelector("[role=dialog]"))').catch(() => false)) break; await sleep(300); }

const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? '  — ' + note : ''}`); };
const clickText = (sel, text) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const pickFormat = (label) => clickText('[role=dialog] label', label);
const confirm = () => ev(`(() => { const b = [...document.querySelectorAll('[role=dialog] button')].pop(); b.click(); return b.textContent; })()`);
const dialogText = () => ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
async function waitFile(pred, ms = 60000) {
  for (let t = 0; t < ms; t += 200) { const f = readdirSync(dl).filter((n) => !n.endsWith('.crdownload')).find(pred); if (f) { await sleep(200); return join(dl, f); } await sleep(200); }
  return null;
}
const clearDl = () => readdirSync(dl).forEach((f) => rmSync(join(dl, f)));

// ① 기본 형식 PDF · 추가 형식 접힘
check('① 기본 형식 PDF 선택 · 추가 형식 접힘', await ev(`(() => { const r = [...document.querySelectorAll('[role=dialog] input[type=radio]')]; return r.length === 2 && r[0].checked; })()`));

// ⑬~⑯ PDF — Typst 컴파일(70b). 첫 실행 = wasm·글꼴 받기(P0-2) · 두 번째 = 캐시
async function pdfRun(label) {
  clearDl();
  await ev(`document.getElementById('reopen').click(); 1`); await sleep(200);
  await pickFormat('PDF');
  const t0 = Date.now();
  await confirm();
  const f = await waitFile((n) => n.endsWith('.pdf'), 120000);
  const ms = Date.now() - t0;
  const bytes = f ? readFileSync(f) : null;
  check(`${label} PDF 다운로드(${(ms / 1000).toFixed(1)}초)`, !!bytes && bytes.subarray(0, 5).toString() === '%PDF-' && bytes.length > 10000, f ?? 'no file');
  return { ms, f };
}
const cold = await pdfRun('⑬ 첫');
check('⑭ D28 — 미지원 수식 안내가 다이얼로그에', (await dialogText()).includes('변환하지 못한 수식 1개'));
await clickText('[role=dialog] button', '닫기');
const warm = await pdfRun('⑮ 두 번째');
check('⑯ P0-2 — 첫 ≤ 15초 · 두 번째 ≤ 3초', cold.ms <= 15000 && warm.ms <= 3000, `첫 ${cold.ms}ms · 두 번째 ${warm.ms}ms`);
if (warm.f) require('node:fs').copyFileSync(warm.f, join(ROOT, '.test-build/export-dev70b.pdf'));
await clickText('[role=dialog] button', '닫기'); await ev(`document.getElementById('reopen').click(); 1`); await sleep(200);
clearDl();

// ② Typst .typ — zip(그림 있음)
await clickText('[role=dialog] button', '추가 형식');
await pickFormat('Typst (.typ)');
await confirm();
const typZip = await waitFile((n) => n.endsWith('.zip'));
check('② .typ 다운로드 = zip(그림이 있으므로) · 파일명 위생(: → _)', !!typZip && typZip.endsWith('표본_ 미적분 #21.zip'), typZip ?? 'no file');
if (typZip) {
  const z = unzipSync(readFileSync(typZip));
  const names = Object.keys(z).sort();
  check('③ zip 구성 — main.typ + 회색 png + svg 그대로(Typst)', JSON.stringify(names) === JSON.stringify(['figures/fig-1-gray.png', 'figures/fig-2.svg', 'main.typ']), JSON.stringify(names));
  const main = strFromU8(z['main.typ']);
  check('④ main.typ — 실패한 본문 그림은 인라인 ⚠ 표시 · @preview/mitex 임포트', main.includes('#box[⚠그림];') && main.includes('#import "@preview/mitex:0.2.7"'));
  // 받은 main.typ를 실제로 컴파일(mitex는 벤더링 경로로 바꿔서 — 네트워크 레지스트리 접근 없이)
  const work = mkdtempSync(join(tmpdir(), 'cdp70-typ-'));
  for (const [n, d] of Object.entries(z)) { const p = join(work, n); require('node:fs').mkdirSync(join(p, '..'), { recursive: true }); require('node:fs').writeFileSync(p, d); }
  const src = main.replace('"@preview/mitex:0.2.7"', '"/mitex/lib.typ"');
  require('node:fs').cpSync(join(ROOT, 'public/typst/packages/preview/mitex/0.2.7'), join(work, 'mitex'), { recursive: true });
  const c = NodeCompiler.create({ workspace: work, fontArgs: [{ fontPaths: [join(ROOT, '.test-build/fonts')] }] });
  const r = c.compile({ mainFileContent: src });
  const errs = (r.takeDiagnostics()?.shortDiagnostics ?? []).filter((d) => d.severity === 1 || d.severity === 'error').map((d) => d.message);
  check('⑤ 받은 main.typ 실제 컴파일 오류 0(그림 포함)', !!r.result && errs.length === 0, errs.join(' | '));
  if (r.result) require('node:fs').writeFileSync(join(ROOT, '.test-build/export-dev70.pdf'), c.pdf(r.result));
}
check('⑥ 그림 실패 안내가 다이얼로그에 남는다', (await dialogText()).includes('그림 1개를 불러오지 못해'));

// ⑦ 형식 기억 — 닫았다 다시 열면 typ + 추가 형식 펼침
await clickText('[role=dialog] button', '닫기');
await sleep(100);
await ev(`document.getElementById('reopen').click(); 1`);
await sleep(200);
check('⑦ 마지막 형식 기억(typ) · 추가 형식 펼친 채로', await ev(`(() => { const r = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('Typst')); return !!r && r.querySelector('input').checked; })()`));

// ⑧ LaTeX .tex — svg는 png로
clearDl();
await pickFormat('LaTeX (.tex)');
await confirm();
const texZip = await waitFile((n) => n.endsWith('.zip'));
if (texZip) {
  const z = unzipSync(readFileSync(texZip));
  const names = Object.keys(z).sort();
  check('⑧ .tex zip — svg를 png로 래스터(LaTeX)', JSON.stringify(names) === JSON.stringify(['figures/fig-1-gray.png', 'figures/fig-2.png', 'main.tex']), JSON.stringify(names));
  const png = z['figures/fig-2.png'];
  check('⑨ 래스터 결과가 PNG 바이트', png && png[0] === 0x89 && png[1] === 0x50);
} else check('⑧ .tex zip', false, 'no file');

// ⑩ Overleaf — 폼 필드
await clickText('[role=dialog] button', '닫기'); await ev(`document.getElementById('reopen').click(); 1`); await sleep(200);
await pickFormat('Overleaf에서 열기');
check('⑩ Overleaf 버튼 라벨 = 열기', (await confirm()).trim() === '열기');
for (let t = 0; t < 10000 && !(await ev('window.__h70.ov.length')); t += 200) await sleep(200);
const ov = await ev('window.__h70.ov[0] ?? null');
if (ov) {
  const ok = ov.action === 'https://www.overleaf.com/docs' && ov.engine === 'xelatex' && ov.main_document === 'main.tex' && ov.snip_uri.startsWith('data:application/zip;base64,');
  const z = unzipSync(Buffer.from(ov.snip_uri.split(',')[1], 'base64'));
  check('⑪ Overleaf 폼 — data URL zip · xelatex · main.tex · 예약 창 이름', ok && !!z['main.tex'] && ov.target === 'mathory-overleaf', `${ov.target} ${Object.keys(z).join(',')}`);
} else check('⑪ Overleaf 폼', false, '제출 기록 없음');

// ⑫ MD — 탭 선택이 그대로
await ev(`document.getElementById('reopen').click(); 1`); await sleep(200);
await clickText('[role=dialog] label', 'Markdown');
await ev(`(() => { const l = [...document.querySelectorAll('[role=dialog] label')].find((x) => x.textContent.trim() === '풀이'); l.querySelector('input').click(); return 1; })()`);
await confirm(); await sleep(200);
check('⑫ Markdown — 선택 탭만 콜백으로(Q15)', JSON.stringify(await ev('window.__h70.md')) === JSON.stringify([['question']]));



const fail = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} 통과`);
chrome.kill();
process.exit(fail ? 1 : 0);
