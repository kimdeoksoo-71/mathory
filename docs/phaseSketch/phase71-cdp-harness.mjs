// Phase 71 CDP 하니스 — headless Chrome으로 app/dev71(임시 라우트)의 내보내기 다이얼로그에서 HWPX를 실제로 받는다.
// 준비: cp docs/phaseSketch/phase71-dev71-page.tsx.txt app/dev71/page.tsx · npm run dev(3000) · node docs/phaseSketch/phase71-cdp-harness.mjs
// 확인: HWPX 항목 · 탭 체크박스 숨김 · 옵션 2줄·기억 · 다운로드(.hwpx) · zip 계약 · well-formed · 문제·풀이 탭만 ·
//       그림(회색 png · svg → png) · 그림 실패 안내 · 미대응 명령 안내 · 옵션 B(미주) · 순차 번호
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('@xmldom/xmldom');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9371;
const PAGE_URL = 'http://localhost:3000/dev71';
const profile = mkdtempSync(join(tmpdir(), 'cdp71-'));
const dl = mkdtempSync(join(tmpdir(), 'cdp71-dl-'));
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
for (let i = 0; i < 300; i++) { if (await ev('!!(window.__h71 && window.__h71.ready && document.querySelector("[role=dialog]"))').catch(() => false)) break; await sleep(300); }

const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? '  — ' + note : ''}`); };
const clickText = (sel, text) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const confirm = () => ev(`(() => { const b = [...document.querySelectorAll('[role=dialog] button')].pop(); b.click(); return b.textContent; })()`);
const dialogText = () => ev(`document.querySelector('[role=dialog]')?.innerText ?? ''`);
async function waitFile(pred, ms = 60000) {
  for (let t = 0; t < ms; t += 200) { const f = readdirSync(dl).filter((n) => !n.endsWith('.crdownload')).find(pred); if (f) { await sleep(300); return join(dl, f); } await sleep(200); }
  return null;
}
const clearDl = () => readdirSync(dl).forEach((f) => rmSync(join(dl, f)));
const reopen = async () => { await ev(`document.getElementById('reopen').click()`); await sleep(400); };

function inspect(path) {
  const entries = unzipSync(new Uint8Array(readFileSync(path)));
  const bad = [];
  for (const [n, d] of Object.entries(entries)) {
    if (!/\.(xml|hpf|rdf)$/.test(n)) continue;
    new DOMParser({ onError: (lv, msg) => { if (lv !== 'warning') bad.push(`${n}: ${msg}`); } }).parseFromString(strFromU8(d), 'text/xml');
  }
  return { entries, bad, section: strFromU8(entries['Contents/section0.xml']), hpf: strFromU8(entries['Contents/content.hpf']) };
}

// ① HWPX 항목 · 선택하면 탭 체크박스 대신 안내 + 옵션 2줄
check('① 형식에 HWPX (한글)', (await dialogText()).includes('HWPX (한글)'));
await clickText('[role=dialog] label', 'HWPX (한글)');
await sleep(200);
const t1 = await dialogText();
check('② HWPX 선택 → 탭 체크박스 숨김 · "문제·풀이 탭" 안내 · 옵션 2줄', !t1.includes('포함할 탭') && t1.includes('문제·풀이 탭을 내보냅니다') && t1.includes('문항 번호') && t1.includes('풀이 위치'));

// ③ 다운로드(옵션 A · 제목 번호)
clearDl();
await confirm();
const f1 = await waitFile((n) => n.endsWith('.hwpx'));
check('③ .hwpx 다운로드', !!f1, f1 ? f1.split('/').pop() : '없음');
if (f1) {
  const { entries, bad, section, hpf } = inspect(f1);
  check('④ zip 첫 항목 mimetype · XML 전부 well-formed', Object.keys(entries)[0] === 'mimetype' && bad.length === 0, bad.slice(0, 2).join(' | '));
  check('⑤ 문제·풀이 탭만(AI 풀이 없음) · 제목 번호 21(두 자리 탭 2)', !section.includes('AI 풀이') && section.includes('>21.<hp:tab/><hp:tab/></hp:t>'));
  const bins = Object.keys(entries).filter((n) => n.startsWith('BinData/'));
  check('⑥ 그림 2개(회색 png · svg → png) BinData + content.hpf 등록', bins.length === 2 && bins.every((b) => hpf.includes(`href="${b}"`)), bins.join(', '));
  check('⑦ 긴 선택지 3+2 · 빈칸 box · ⋯⋯⋯ ㉠ · ( i )', section.includes('box{~"(가)"~}') && section.includes('cdots cdots cdots</hp:script></hp:equation><hp:t> ㉠') && section.includes('( i )<hp:tab/>') && (section.match(/styleIDRef="6"/g) ?? []).length === 2);
  check('⑧ 본문 \\ref → ㉠', section.includes('㉠에서'));
}
await sleep(300);
const t2 = await dialogText();
check('⑨ 안내 — 그림 실패 · 미대응 수식 명령', t2.includes('그림 1개') && t2.includes('\\overset'), t2.replace(/\n/g, ' / ').slice(-160));

// ⑩ 옵션 B · 순차 번호 — 다시 열어 바꾸고 받는다(옵션 기억 확인 포함)
await clickText('[role=dialog] button', '닫기');
await reopen();
const remembered = await ev(`[...document.querySelectorAll('[role=dialog] input[type=radio]')].find((r) => r.closest('label').textContent.includes('HWPX'))?.checked`);
check('⑩ 형식 기억(HWPX)', remembered === true);
await clickText('[role=dialog] label', '풀이는 미주로');
await ev(`[...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.trim() === '1').click()`);
clearDl();
await confirm();
const f2 = await waitFile((n) => n.endsWith('.hwpx'));
if (f2) {
  const { bad, section } = inspect(f2);
  check('⑪ 옵션 B — 미주 · 순차 번호 1 · well-formed', bad.length === 0 && /<hp:endNote number="1"/.test(section) && section.includes('>1.<hp:tab/></hp:t>'), bad.slice(0, 1).join(''));
  check('⑫ 옵션 기억 저장', (await ev(`localStorage.getItem('mathory-export-hwpx')`)) === '{"numbering":"sequential","placement":"endnote"}');
} else check('⑪ 옵션 B 다운로드', false);

console.log(`\n${results.filter((r) => r.ok).length}/${results.length}`);
ws.close(); chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch { /* 크롬이 아직 쓰는 중 */ }
process.exit(results.every((r) => r.ok) ? 0 : 1);
