// Phase 68c CDP 하니스 — headless Chrome으로 app/dev68c를 열어 §9-1 ①~⑭를 실측한다.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const URL = 'http://localhost:3000/dev68c';
const profile = mkdtempSync(join(tmpdir(), 'cdp68c-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome not up');
}

const ws = new WebSocket(await getWs());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description)); return r.result.value; };

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: URL });
for (let i = 0; i < 150; i++) { if (await ev('!!(window.__h68c && window.__h68c.view("ed") && window.__h68c.view("cm") && document.querySelector("#chat .katex"))')) break; await sleep(300); }
const H = 'window.__h68c';
const J = JSON.stringify;

const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
async function key(k, code, vk, mods = 0) {
  const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(30);
}
const cmdZ = () => key('z', 'KeyZ', 90, MOD.meta);
const state = (w = 'ed') => ev(`JSON.stringify(${H}.state(${J(w)}))`).then(JSON.parse);
const set = (w, src) => { const from = src.indexOf('|'); let doc = src.slice(0, from) + src.slice(from + 1); let to = doc.indexOf('|'); if (to >= 0) doc = doc.slice(0, to) + doc.slice(to + 1); else to = from; return ev(`${H}.set(${J(w)}, ${J(doc)}, ${from}, ${to}); 1`); };
const show = (s) => s.doc.slice(0, s.from) + (s.from === s.to ? '|' : '[') + s.doc.slice(s.from, s.to) + (s.from === s.to ? '' : ']') + s.doc.slice(s.to);

const results = [];
async function check(name, w, src, actions, expect, extra) {
  await set(w, src);
  await ev(`${H}.fired.length = 0; 1`);
  const before = await state(w);
  for (const a of actions) await a();
  const s = await state(w);
  const got = show(s);
  let ok = got === expect;
  let note = '';
  if (ok && extra) { const r = await extra(s, before); if (r !== true) { ok = false; note = String(r); } }
  results.push({ name, ok, got, expect, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}  →  ${J(got)}${ok ? '' : `   (expected ${J(expect)}) ${note}`}`);
}
const undoIs = (n) => async (s, b) => (s.undo === b.undo + n) || `undo ${b.undo}→${s.undo}, expected +${n}`;
/** html: 문자열 또는 `${K('tex', display)}` 자리표시자가 든 템플릿(페이지 안 katex.renderToString) */
const paste = (w, html, plain, expectPrevented) => () => ev(`(() => {
  const K = (t, d) => ${H}.katex(t, !!d);
  const html = ${html === null ? 'null' : '`' + html.replace(/`/g, '\\`') + '`'};
  return ${H}.paste(${J(w)}, html, ${J(plain)});
})()`).then(async (prevented) => { await sleep(80); if (expectPrevented !== undefined && prevented !== expectPrevented) throw new Error(`prevented ${prevented}`); });
const firedIs = (n, pred) => async () => { const f = await ev(`JSON.stringify(${H}.fired)`).then(JSON.parse); if (f.length !== n) return `fired ${f.length} ≠ ${n}`; return pred ? pred(f) : true; };

// ── 평문 경로(CM 내장 paste → clipboardInputFilter) ──
await check('평문 \\(a\\) → $a$', 'ed', 'abc |', [paste('ed', null, '\\(a\\)', true)], 'abc $a$|', undoIs(1));
await check('평문 \\[a\\] → 펜스형', 'ed', '|', [paste('ed', null, '\\[a\\]')], '$$\na\n$$|');
await check('평문 수식 안 커서 + α≤β → 변환', 'ed', 'a $|$ b', [paste('ed', null, 'α≤β')], 'a $\\alpha\\le\\beta|$ b');
await check('평문 본문 커서 + α≤β → 무변환', 'ed', 'body |', [paste('ed', null, 'α≤β')], 'body α≤β|');
await check('평문 수식 안 한글 → 68a 재생 없음(200ms 뒤 동일)', 'ed', 'a $|$ b', [paste('ed', null, '한'), () => sleep(200)], 'a $한|$ b');
await check('댓글 평문 \\(a\\) → $a$', 'cm', 'abc |', [paste('cm', null, '\\(a\\)')], 'abc $a$|');
await check('댓글 평문 수식 안 √2', 'cm', 'a $x+|$ b', [paste('cm', null, '√2')], 'a $x+\\sqrt{2}|$ b');

// ── HTML 경로(<math 있을 때 — 61c serializeNodes) ──
await check('HTML KaTeX 인라인 → annotation(평문 글자 나열 안 들어감)', 'ed', '|', [paste('ed', '<span>식 ${K("x^2")} 끝</span>', '식 x2 끝', true)], '식 $x^2$ 끝|', undoIs(1));
await check('HTML Mathory 미리보기 흔적(\\displaystyle) 제거', 'ed', '|', [paste('ed', '<p>${K("\\\\displaystyle x^{2}")}</p>', 'x2')], '$x^{2}$|');
await check('HTML display + \\tag*{(1)} → 펜스형 \\tag{1}', 'ed', '|', [paste('ed', '<div>${K("a=1 \\\\tag*{(1)}", true)}</div>', 'a=1 (1)')], '$$\na=1 \\tag{1}\n$$|');
await check('HTML MathJax 3(mjx-assistive-mml annotation)', 'ed', '|', [paste('ed', '<p>값 <mjx-container class="MathJax" jax="CHTML"><mjx-math aria-hidden="true"><mjx-mi>x</mjx-mi></mjx-math><mjx-assistive-mml><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></mjx-assistive-mml></mjx-container> 끝</p>', '값 x 끝')], '값 $x^2$ 끝|');
await check('HTML 위키(.mwe-math-element · {\\displaystyle} 껍질 · 수식 한 번)', 'ed', '|', [paste('ed', '<p>식 <span class="mwe-math-element"><span class="mwe-math-mathml-inline" style="display:none"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">{\\\\displaystyle x^{2}}</annotation></semantics></math></span><img class="mwe-math-fallback-image-inline" alt="{\\\\displaystyle x^{2}}" src="a.svg"></span> 끝</p>', '식 x2 끝')], '식 $x^{2}$ 끝|');
await check('HTML 굵게·목록·표·수식 혼합 → 61c 마크다운', 'ed', '|', [paste('ed', '<p><b>굵게</b> ${K("a")}</p>\n<ul>\n  <li>하나</li>\n  <li>둘</li>\n</ul>\n<table><tbody><tr><th>열</th><th>값</th></tr><tr><td>${K("x")}</td><td>3</td></tr></tbody></table>', '…')], '**굵게** $a$\n\n- 하나\n- 둘\n\n| 열 | 값 |\n| --- | --- |\n| $x$ | 3 ||');
await check('HTML pre 내용 보존 · 텍스트 $ → \\$', 'ed', '|', [paste('ed', '<p>${K("x")} 가격 $5</p><pre>line1\nline2</pre>', '…')], '$x$ 가격 \\$5\n\nline1\nline2|');
await check('HTML 수식 안 유니코드도 ③ 변환(annotation이 유니코드)', 'ed', '|', [paste('ed', '<p>${K("α≤β")}</p>', '…')], '$\\alpha\\le\\beta$|');
await check('HTML <math 없음 → 평문 경로', 'ed', '|', [paste('ed', '<b>bold</b>', 'bold \\(y\\)', true)], 'bold $y$|');
await check('HTML 한글 + 수식 → 68a 재생 없음', 'ed', 'a |', [paste('ed', '<p>한글 ${K("x")}</p>', '…'), () => sleep(200)], 'a 한글 $x$|');
await check('댓글 HTML KaTeX', 'cm', '|', [paste('cm', '<span>식 ${K("x^2")} 끝</span>', '식 x2 끝')], '식 $x^2$ 끝|');
await check('댓글 maxLength 초과 HTML → 차단', 'cm2', '|', [paste('cm2', '<p>${K("\\\\frac{a}{b}+\\\\frac{c}{d}")} 아주 길게 길게</p>', '…')], '|');

// ── annotation 없는 <math> → mathml-to-latex 동적 import(P9(b)) ──
await check('bare <math> · 로드 중 문서 수정 → 현재 커서에(Q14)', 'ed', 'ab|', [() => ev(`(() => {
  const v = ${H}.view('ed');
  ${H}.paste('ed', '<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>', 'ab');
  v.dispatch({ changes: { from: 0, insert: 'Z' } });
  return 1;
})()`), () => sleep(3000)], 'Zab$\\frac{a}{b}$|');
await check('bare <math display=block> → 펜스형', 'ed', '|', [paste('ed', '<math display="block"><msqrt><mi>x</mi></msqrt></math>', 'x'), () => sleep(500)], '$$\n\\sqrt{x}\n$$|');

// ── window 단축키 지연 실행(dev 페이지 ⌘B 리스너 = EditorView D2″와 같은 꼴) ──
const composeKeyB = ({ start = true, end = true, endFirst = false, key = 'Process', keyCode = 229, isComposing = true, insert = '한' } = {}) => () => ev(`(() => {
  const v = ${H}.view('ed'); const c = v.contentDOM;
  if (${start}) c.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  if (${J(insert)}) v.dispatch(v.state.update(v.state.replaceSelection(${J(insert)}), { userEvent: 'input.type.compose' }));
  if (${endFirst}) c.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }));
  const k = new KeyboardEvent('keydown', { key: ${J(key)}, code: 'KeyB', metaKey: true, isComposing: ${isComposing}, bubbles: true, cancelable: true });
  Object.defineProperty(k, 'keyCode', { get: () => ${keyCode} });
  c.dispatchEvent(k);
  window.__firedAtKey = ${H}.fired.length;
  if (${end} && !${endFirst}) setTimeout(() => { window.__endT = performance.now(); c.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })); }, 40);
  return 1;
})()`).then(() => sleep(250));
await check('⌘B 평소 → 즉시(동기)', 'ed', 'abc|', [() => key('b', 'KeyB', 66, MOD.meta)], 'abc|', firedIs(1, (f) => f[0].doc === 'abc' || J(f)));
await check('⌘B code만 맞는 key ㅠ → 발화', 'ed', 'abc|', [composeKeyB({ start: false, end: false, key: 'ㅠ', keyCode: 66, isComposing: false, insert: '' })], 'abc|', firedIs(1));
await check('⌘⇧B → 미발화(Q10)', 'ed', 'abc|', [() => key('B', 'KeyB', 66, MOD.meta | MOD.shift)], 'abc|', firedIs(0));
await check('⌘⌥B → 미발화(Q10)', 'ed', 'abc|', [() => key('∫', 'KeyB', 66, MOD.meta | MOD.alt)], 'abc|', firedIs(0));
await check('조합 중 ⌘B → compositionend 뒤 확정 글자 포함', 'ed', 'abc |', [composeKeyB()], 'abc 한|', async () => {
  const r = await ev(`JSON.stringify({ f: ${H}.fired, atKey: window.__firedAtKey, endT: window.__endT })`).then(JSON.parse);
  if (r.atKey !== 0) return 'fired synchronously at key';
  if (r.f.length !== 1) return `fired ${r.f.length}`;
  return (r.f[0].doc === 'abc 한' && !r.f[0].composing && r.f[0].t >= r.endT) || J(r);
});
await check('조합 중 ⌘B · compositionend 미도착 → 미실행(800ms 포기)', 'ed', 'abc |', [composeKeyB({ end: false }), () => sleep(900),
  () => ev(`${H}.view('ed').contentDOM.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' })); 1`).then(() => sleep(100))], 'abc 한|', firedIs(0));
await check('윈도우 순서(확정 → keydown 229) → grace 뒤 실행', 'ed', 'abc |', [composeKeyB({ endFirst: true })], 'abc 한|', firedIs(1, (f) => f[0].doc === 'abc 한' || J(f)));
await check('즉시 갈래도 68a 보류 치환을 끝낸 문서를 본다(flush)', 'ed', 'a $|$ b', [() => ev(`(() => {
  const v = ${H}.view('ed'); const c = v.contentDOM;
  const k = new KeyboardEvent('keydown', { key: 'Process', code: 'KeyX', isComposing: true, bubbles: true, cancelable: true });
  Object.defineProperty(k, 'keyCode', { get: () => 229 }); c.dispatchEvent(k);
  v.dispatch(v.state.update(v.state.replaceSelection('ㅌ'), { userEvent: 'input.type.compose' }));
  const b = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', metaKey: true, bubbles: true, cancelable: true });
  Object.defineProperty(b, 'keyCode', { get: () => 66 }); c.dispatchEvent(b);
  return 1;
})()`).then(() => sleep(200))], 'a $x|$ b', firedIs(1, (f) => f[0].doc === 'a $x$ b' || J(f)));

// ── 핸들 commitComposition(프로그램 호출 삽입 — D3) ──
const composing = (w, txt = '한') => () => ev(`(() => {
  const v = ${H}.view(${J(w)});
  v.contentDOM.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  v.dispatch(v.state.update(v.state.replaceSelection(${J(txt)}), { userEvent: 'input.type.compose' }));
  return v.compositionStarted;
})()`);
const notComposing = (w) => async (s) => (!s.composing) || `${w} still composing`;
await check('조합 중 insertPlainText → 확정 뒤 삽입 · 고착 없음', 'ed', 'abc |', [composing('ed'), () => ev(`${H}.ed.insertPlainText('X'); 1`).then(() => sleep(50))], 'abc 한X|', notComposing('ed'));
await check('조합 중 insertMathSnippet', 'ed', 'a $|$', [composing('ed', 'x'), () => ev(`${H}.ed.insertMathSnippet('\\\\sqrt{▢}'); 1`).then(() => sleep(50))], 'a $x\\sqrt{|}$', notComposing('ed'));
await check('조합 중 insertInlineMath', 'ed', 'abc |', [composing('ed'), () => ev(`${H}.ed.insertInlineMath(); 1`).then(() => sleep(50))], 'abc 한$|$', notComposing('ed'));
await check('댓글 조합 중 insertAtCursor', 'cm', 'abc |', [composing('cm'), () => ev(`${H}.cm.insertAtCursor('X'); 1`).then(() => sleep(50))], 'abc 한X|', notComposing('cm'));
await check('조합 아님 insertPlainText → 그대로(undo 1)', 'ed', 'abc |', [() => ev(`${H}.ed.insertPlainText('X'); 1`)], 'abc X|', undoIs(1));

// ── 61c 선택 삽입 회귀 — 이관 전(5690a77) serializeSelection과 바이트 동일 ──
{
  const r = await ev(`JSON.stringify(${H}.serialize())`).then(JSON.parse);
  const ok = !!r.now && r.old === r.now;
  results.push({ name: '61c serializeSelection 이관 전후 동일', ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} 61c serializeSelection 이관 전후 동일  →  ${J(r.now)}${ok ? '' : `   (old ${J(r.old)})`}`);
}

const fails = results.filter((r) => !r.ok).length;
console.log(`\n== ${results.length - fails}/${results.length} pass`);
ws.close();
chrome.kill();
process.exit(fails ? 1 : 0);
