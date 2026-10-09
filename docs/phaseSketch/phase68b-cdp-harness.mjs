// Phase 68b CDP 하니스 — headless Chrome으로 app/dev68b를 열어 §9-1 ①~⑭를 실측한다.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL = 'http://localhost:3000/dev68b';
const profile = mkdtempSync(join(tmpdir(), 'cdp68b-'));
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
for (let i = 0; i < 100; i++) { if (await ev('!!(window.__h && window.__h.view("ed") && window.__h.view("cm"))')) break; await sleep(300); }

// ── 키 ──
const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
async function key(k, code, vk, mods = 0, text) {
  const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(text ? { text } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(30);
}
const ctrlM = () => key('m', 'KeyM', 77, MOD.ctrl);
const ctrlShiftM = () => key('M', 'KeyM', 77, MOD.ctrl | MOD.shift);
const ctrlEq = () => key('=', 'Equal', 187, MOD.ctrl);
const shiftEsc = () => key('Escape', 'Escape', 27, MOD.shift);
const tab = () => key('Tab', 'Tab', 9);
const altTab = () => key('Tab', 'Tab', 9, MOD.alt);
const ctrlN = () => key('n', 'KeyN', 78, MOD.ctrl);
const cmdZ = () => key('z', 'KeyZ', 90, MOD.meta);
const typeX = () => send('Input.insertText', { text: 'x' });

const state = (w = 'ed') => ev(`JSON.stringify(window.__h.state(${JSON.stringify(w)}))`).then(JSON.parse);
const set = (w, src) => { const from = src.indexOf('|'); let doc = src.slice(0, from) + src.slice(from + 1); let to = doc.indexOf('|'); if (to >= 0) doc = doc.slice(0, to) + doc.slice(to + 1); else to = from; return ev(`window.__h.set(${JSON.stringify(w)}, ${JSON.stringify(doc)}, ${from}, ${to}); 1`); };
const show = (s) => s.doc.slice(0, s.from) + (s.from === s.to ? '|' : '[') + s.doc.slice(s.from, s.to) + (s.from === s.to ? '' : ']') + s.doc.slice(s.to);

const results = [];
async function check(name, w, src, actions, expect, extra) {
  await set(w, src);
  const before = await state(w);
  for (const a of actions) await a();
  const s = await state(w);
  const got = show(s);
  let ok = got === expect;
  let note = '';
  if (ok && extra) { const r = await extra(s, before); if (r !== true) { ok = false; note = String(r); } }
  results.push({ name, ok, got, expect, note });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}  →  ${JSON.stringify(got)}${ok ? '' : `   (expected ${JSON.stringify(expect)}) ${note}`}`);
}
const undoIs = (n) => async (s, b) => (s.undo === b.undo + n) || `undo ${b.undo}→${s.undo}, expected +${n}`;

// ① 본문 Ctrl+M → $|$
await check('① 본문 Ctrl+M', 'ed', 'abc |def', [ctrlM], 'abc $|$def', undoIs(1));
// ② 선택 + Ctrl+M → $sel$|
await check('② 선택 Ctrl+M', 'ed', 'abc [x+1] def'.replace('[', '|').replace(']', '|'), [ctrlM], 'abc $x+1$| def');
// ③ $x|$ Ctrl+M → $x$|
await check('③ $x|$ Ctrl+M', 'ed', 'a $x|$ b', [ctrlM], 'a $x$| b', undoIs(0));
// ④ Ctrl+Shift+M → 블록 · 선택 → 블록 안
await check('④ Ctrl+Shift+M', 'ed', 'foo|bar', [ctrlShiftM], 'foo\n\n$$\n|\n$$\n\nbar', undoIs(1));
await check('④ 선택 Ctrl+Shift+M', 'ed', 'foo |x=1| bar', [ctrlShiftM], 'foo\n\n$$\nx=1|\n$$\n\nbar');
await check('④ 문서 시작/끝 패딩 없음', 'ed', '|', [ctrlShiftM], '$$\n|\n$$');
// ⑤ 펜스 안 세 키 → 다음 행 · 문서 끝 → \n 삽입
await check('⑤ 펜스 안 Ctrl+M', 'ed', 'a\n\n$$\nx=|1\n$$\n\nb', [ctrlM], 'a\n\n$$\nx=1\n$$\n|\nb', undoIs(0));
await check('⑤ 펜스 안 Ctrl+Shift+M', 'ed', 'a\n\n$$\nx=|1\n$$\n\nb', [ctrlShiftM], 'a\n\n$$\nx=1\n$$\n|\nb');
await check('⑤ 펜스 안 Shift+Esc', 'ed', 'a\n\n$$\nx=|1\n$$\n\nb', [shiftEsc], 'a\n\n$$\nx=1\n$$\n|\nb');
await check('⑤ 문서 끝 펜스 → \\n 삽입', 'ed', 'a\n\n$$\nx=|1\n$$', [ctrlM], 'a\n\n$$\nx=1\n$$\n|', undoIs(1));
// ⑥ Tab ⑥′
await check('⑥ \\end{aligned}| Tab → 밖', 'ed', 'a\n\n$$\n\\begin{aligned}\n  a &= 1\n\\end{aligned}|\n$$\n\nb', [tab], 'a\n\n$$\n\\begin{aligned}\n  a &= 1\n\\end{aligned}\n$$\n|\nb');
await check('⑥ aligned 마지막 행 끝 Tab → &', 'ed', 'a\n\n$$\n\\begin{aligned}\n  a &= 1|\n\\end{aligned}\n$$\n\nb', [tab], 'a\n\n$$\n\\begin{aligned}\n  a &= 1&|\n\\end{aligned}\n$$\n\nb');
await check('⑥ 식 중간 Tab → 제자리(현행)', 'ed', 'a\n\n$$\nx=|1+2\n$$\n\nb', [tab], 'a\n\n$$\nx=|1+2\n$$\n\nb');
await check('⑥ 펜스 식 끝 Tab → 밖', 'ed', 'a\n\n$$\nx=1|\n$$\n\nb', [tab], 'a\n\n$$\nx=1\n$$\n|\nb');
await check('⑥ 인라인 $x|$ Tab → ⑥(기존)', 'ed', 'a $x|$ b', [tab], 'a $x$| b');
// ⑦ 수식 밖 Shift+Esc → preventDefault, 문서 불변
await check('⑦ 수식 밖 Shift+Esc 소비', 'ed', 'ab|c', [shiftEsc], 'ab|c', async () => { const k = await ev('JSON.stringify(window.__h.lastKey)').then(JSON.parse); return (k && k.key === 'Escape' && k.shift && k.prevented) || `lastKey ${JSON.stringify(k)}`; });
// ⑧ Ctrl+N → 무반응
await check('⑧ Ctrl+N 문서 불변(Mac은 CM Emacs cursorLineDown으로 커서만 끝)', 'ed', 'ab|c', [ctrlN], 'abc|');
await check('⑧ Ctrl+N 2행 문서 — 아래 행으로(CM 기본)', 'ed', 'ab|c\nxyz', [ctrlN], 'abc\nxy|z');
await check('⑬ 행 끝 $|$ Ctrl+M 2회 → ⌘Z 1회로 $|$ 복귀', 'ed', 'abc |', [ctrlM, ctrlM, cmdZ], 'abc $|$');
await check('⑤ 문서 끝 펜스 \\n 삽입 → ⌘Z 1회로 \\n만', 'ed', 'a\n\n$$\nx=|1\n$$', [ctrlM, cmdZ], 'a\n\n$$\nx=|1\n$$');
// ⑨ Mac Ctrl+= → ①과 동일
await check('⑨ Mac Ctrl+= (Word 별칭)', 'ed', 'abc |def', [ctrlEq], 'abc $|$def');
await check('⑨ Mac Ctrl+= 수식 안 → 나오기', 'ed', 'a $x|$ b', [ctrlEq], 'a $x$| b');
// ⑩ Alt+Tab 순회 — 옛 표본 + (c) 빈 쌍
await check('⑩ Alt+Tab 다음 {', 'ed', 'a $\\frac{|1}{2}$ b', [altTab], 'a $\\frac{1}{|2}$ b');
await check('⑩ Alt+Tab 끝이면 처음', 'ed', 'a $\\frac{1}{2|}$ b', [altTab], 'a $\\frac{|1}{2}$ b');
await check('⑩ Alt+Tab 빈 쌍 → 무동작', 'ed', 'a $|$ b', [altTab], 'a $|$ b');
// ⑪ 댓글 편집기
await check('⑪ 댓글 Ctrl+M', 'cm', 'abc |def', [ctrlM], 'abc $|$def');
await check('⑪ 댓글 Ctrl+Shift+M', 'cm', 'foo|bar', [ctrlShiftM], 'foo\n\n$$\n|\n$$\n\nbar');
await check('⑪ 댓글 펜스 안 Shift+Esc → 다음 행', 'cm', 'a\n\n$$\nx=|1\n$$\n\nb', [shiftEsc], 'a\n\n$$\nx=1\n$$\n|\nb');
await check('⑪ 댓글 행 끝 $|$ Ctrl+M 2회 → 원복', 'cm', 'abc |', [ctrlM, ctrlM], 'abc |');
// ⑫ 툴바 $$ 버튼(핸들 insertBlockMath) = ④ 결과 · undo 1스텝
await check('⑫ 핸들 insertBlockMath = ④', 'ed', 'foo|bar', [() => ev('window.__h.ed.insertBlockMath(); 1')], 'foo\n\n$$\n|\n$$\n\nbar', undoIs(1));
await check('⑫ 핸들 insertInlineMath', 'ed', 'abc |def', [() => ev('window.__h.ed.insertInlineMath(); 1')], 'abc $|$def');
// ⑬ 빈 쌍
await check('⑬ 행 끝 $|$ Ctrl+M 2회 → 원복', 'ed', 'abc |', [ctrlM, ctrlM], 'abc |');
await check('⑬ 행 끝 $|$ 다음 줄 있음 Ctrl+M 2회', 'ed', 'abc |\nnext', [ctrlM, ctrlM], 'abc |\nnext');
await check('⑬ 행 중간 $|$x Ctrl+M → 삭제', 'ed', 'a $|$x', [ctrlM], 'a |x');
await check('⑬ 행 끝 $|$ Shift+Esc → 삭제', 'ed', 'abc $|$', [shiftEsc], 'abc |');
await check('⑬ 한 줄 $$x|$$ 행 끝 Ctrl+M → 다음 행', 'ed', 'a\n\n$$x|$$\n\nb', [ctrlM], 'a\n\n$$x$$\n|\nb');
await check('⑬ $|$ 뒤 x 치고 Ctrl+M → $x$|', 'ed', 'abc |', [ctrlM, typeX, ctrlM], 'abc $x$|');
// ⑭ 빈 블록
await check('⑭ Ctrl+Shift+M 2회 → 원복', 'ed', 'foo|bar', [ctrlShiftM, ctrlShiftM], 'foo|\n\nbar');
await check('⑭ Ctrl+Shift+M 2회 → 원복 · ⌘Z 1회로 블록 복귀', 'ed', 'foo\n\n|bar', [ctrlShiftM, ctrlShiftM, cmdZ], 'foo\n\n$$\n|\n$$\n\nbar');
await check('⑭ 빈 블록 Ctrl+M → 블록 삭제', 'ed', 'foo\n\n$$\n|\n$$\n\nbar', [ctrlM], 'foo|\n\nbar');
await check('⑭ 빈 블록 Tab → 밖(블록 잔존)', 'ed', 'foo\n\n$$\n|\n$$\n\nbar', [tab], 'foo\n\n$$\n\n$$\n|\nbar');
await check('⑭ 한글 선택 감싸기 → 68a 재생 없음(100ms 뒤 동일)', 'ed', 'foo |한글| bar', [ctrlShiftM, () => sleep(150)], 'foo\n\n$$\n한글|\n$$\n\nbar');
await check('⑭ 한글 선택 인라인 감싸기', 'ed', 'foo |한글| bar', [ctrlM, () => sleep(150)], 'foo $한글$| bar');
// 걸친 선택 → 나오기(R5)
await check('R5 걸친 선택 Ctrl+M → 나오기', 'ed', 'a |$x|y$ b', [ctrlM], 'a $xy$| b');


// ── 검수 17 — IME 조합 중 수식 단축키(페이지 안 합성: compositionstart → 조합 중 keydown 229 → compositionend) ──
const composeKey = (w, { code = 'KeyM', key = 'Process', ctrl = true, shift = false, alt = false, isComposing = true, keyCode = 229, end = true } = {}) => ev(`(() => {
  const c = window.__h.view(${JSON.stringify(w)}).contentDOM;
  if (${isComposing}) c.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  const k = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, ctrlKey: ${ctrl}, shiftKey: ${shift}, altKey: ${alt}, isComposing: ${isComposing}, bubbles: true, cancelable: true });
  Object.defineProperty(k, 'keyCode', { get: () => ${keyCode} });
  c.dispatchEvent(k);
  if (${isComposing} && ${end}) setTimeout(() => c.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' })), 30);
  return 1;
})()`).then(() => sleep(200));
await check('⑰ 조합 중 Ctrl+M → 확정 뒤 $|$', 'ed', 'abc 한|', [() => composeKey('ed')], 'abc 한$|$');
await check('⑰ 조합 중 Ctrl+Shift+M → 확정 뒤 블록', 'ed', 'abc 한|', [() => composeKey('ed', { shift: true })], 'abc 한\n\n$$\n|\n$$');
await check('⑰ 조합 중 Ctrl+= (Mac 별칭)', 'ed', 'abc 한|', [() => composeKey('ed', { code: 'Equal' })], 'abc 한$|$');
await check('⑰ 수식 안 조합 중 Ctrl+M → 나오기', 'ed', 'a $x|$ b', [() => composeKey('ed')], 'a $x$| b');
await check('⑰ 댓글 입력창 조합 중 Ctrl+M', 'cm', 'abc 한|', [() => composeKey('cm')], 'abc 한$|$');
await check('⑰ compositionend가 안 오면 아무것도 안 함', 'ed', 'abc 한|', [() => composeKey('ed', { end: false }), () => sleep(900),
  // 정리 — 끝나지 않은 조합을 닫아 다음 표본이 '조합 중' 편집기를 물려받지 않게(포기 시점 800ms 뒤라 실행되지 않는다)
  () => ev(`window.__h.view('ed').contentDOM.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' })); 1`).then(() => sleep(100))], 'abc 한|');
await check('⑰ 조합 밖 keyCode 229(F3) → 실행', 'ed', 'abc |', [() => composeKey('ed', { isComposing: false })], 'abc $|$');
await check('⑰ CM이 이미 처리한 키는 두 번 안 돈다(key m · 229)', 'ed', 'abc |', [() => composeKey('ed', { isComposing: false, key: 'm' })], 'abc $|$');
await check('⑰ 조합 중 Ctrl 없는 m은 무시', 'ed', 'abc 한|', [() => composeKey('ed', { ctrl: false })], 'abc 한|');

// ── 검수 21 — 댓글·agent 입력창 Tab = 편집창 Tab 엔진 ──
const shiftTab = () => key('Tab', 'Tab', 9, MOD.shift);
const focusIn = (w) => ev(`!!window.__h.view(${JSON.stringify(w)}).hasFocus`);
await check('㉑ 댓글 약어 sq Tab → \\sqrt{|}', 'cm', 'a $sq|$ b', [tab], 'a $\\sqrt{|}$ b');
await check('㉑ 댓글 약어 → Tab → Tab → $ 밖', 'cm', 'a $sq|$ b', [tab, tab, tab], 'a $\\sqrt{}$| b');
await check('㉑ 댓글 int 자리 순회 + Shift+Tab', 'cm', '$int|$', [tab, tab, shiftTab], '$\\int_{|}^{}{ dx}$');
await check('㉑ 댓글 aligned 본문 Tab → &', 'cm', '$$\n\\begin{aligned}\n  a |= 1\n\\end{aligned}\n$$', [tab], '$$\n\\begin{aligned}\n  a &|= 1\n\\end{aligned}\n$$');
await check('㉑ 댓글 그룹 탈출 \\frac{1|}{2} → 형제 진입', 'cm', '$\\frac{1|}{2}$', [tab], '$\\frac{1}{|2}$');
await check('㉑ 댓글 display 식 끝 Tab → 밖(⑥′)', 'cm', '$$\nx=1|\n$$\n\nb', [tab], '$$\nx=1\n$$\n|\nb');
await check('㉑ 댓글 수식 밖 Tab → 포커스 유지·제자리', 'cm', 'ab|c', [tab], 'ab|c', async () => (await focusIn('cm')) || 'focus left the comment editor');
await check('㉑ 편집창 Tab 회귀(약어)', 'ed', 'a $sq|$ b', [tab], 'a $\\sqrt{|}$ b');


// ── 68a 공용화 — 수식 안 자동 영문 입력(두 편집기). 조합 중 keydown(229) 기록 → IME 한글 삽입 트랜잭션 재현 ──
const imeKeys = (w, codes) => ev(`(() => {
  const c = window.__h.view(${JSON.stringify(w)}).contentDOM;
  for (const code of ${JSON.stringify(codes)}) {
    const k = new KeyboardEvent('keydown', { key: 'Process', code, isComposing: true, bubbles: true, cancelable: true });
    Object.defineProperty(k, 'keyCode', { get: () => 229 });
    c.dispatchEvent(k);
  }
  return 1;
})()`);
const imeInsert = (w, text) => ev(`(() => {
  const v = window.__h.view(${JSON.stringify(w)});
  v.dispatch(v.state.update(v.state.replaceSelection(${JSON.stringify(text)}), { userEvent: 'input.type.compose' }));
  return 1;
})()`).then(() => sleep(150));
const directKey = (w, key, code, keyCode) => ev(`(() => {
  const c = window.__h.view(${JSON.stringify(w)}).contentDOM;
  const k = new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, code: ${JSON.stringify(code)}, bubbles: true, cancelable: true });
  Object.defineProperty(k, 'keyCode', { get: () => ${keyCode} });
  c.dispatchEvent(k);
  return 1;
})()`).then(() => sleep(100));
const setPref = (v) => ev(`localStorage.setItem('mathory-editor-mathascii', ${JSON.stringify(v)}); 1`);
for (const w of ['ed', 'cm']) {
  const tag = w === 'ed' ? '편집창' : '댓글';
  await check(`68a ${tag} 수식 안 ㅌ → x`, w, 'a $|$ b', [() => imeKeys(w, ['KeyX']), () => imeInsert(w, 'ㅌ')], 'a $x|$ b');
  await check(`68a ${tag} 음절 퍼(키 v·j) → vj`, w, 'a $|$ b', [() => imeKeys(w, ['KeyV', 'KeyJ']), () => imeInsert(w, '퍼')], 'a $vj|$ b');
  await check(`68a ${tag} 행 끝 $|$ 첫 글자(K8)`, w, 'abc $|$', [() => imeKeys(w, ['KeyX']), () => imeInsert(w, 'ㅌ')], 'abc $x|$');
  await check(`68a ${tag} 수식 밖 한글 보존`, w, 'ab|', [() => imeKeys(w, ['KeyX']), () => imeInsert(w, 'ㅌ')], 'abㅌ|');
  await check(`68a ${tag} \\text{} 안 한글 보존`, w, '$\\text{|}$', [() => imeKeys(w, ['KeyX']), () => imeInsert(w, 'ㅌ')], '$\\text{ㅌ|}$');
  await check(`68a ${tag} 직접 경로(390 종성 ᆼ → a)`, w, 'a $|$ b', [() => directKey(w, 'ᆼ', 'KeyA', 65)], 'a $a|$ b');
}
await check('68a 댓글 토글 끔(편집창 저장값) → 한글 그대로', 'cm', 'a $|$ b', [() => setPref('off'), () => imeKeys('cm', ['KeyX']), () => imeInsert('cm', 'ㅌ')], 'a $ㅌ|$ b');
await setPref('on');
await check('68a 댓글 토글 다시 켬', 'cm', 'a $|$ b', [() => imeKeys('cm', ['KeyX']), () => imeInsert('cm', 'ㅌ')], 'a $x|$ b');
await check('68a 댓글 재생이 그 편집기 괄호 자동닫기를 탄다(ㅊ→c 뒤 { )', 'cm', '$|$', [() => imeKeys('cm', ['KeyC']), () => imeInsert('cm', 'ㅊ'), () => send('Input.insertText', { text: '{' }), () => sleep(50)], '$c{|}$');


// ── 미통일 1~3 통일(작업 규칙 9) — 행 환경 Enter · 후위 변환 · 괄호 자동닫기: 두 편집기 같은 표본·같은 기대값 ──
const typeStr = (str) => async () => { for (const ch of str) { await send('Input.insertText', { text: ch }); await sleep(25); } await sleep(60); };
const enterKey = () => key('Enter', 'Enter', 13, 0, '\r');
const shiftEnter = () => key('Enter', 'Enter', 13, MOD.shift, '\r');
const backspace = () => key('Backspace', 'Backspace', 8);
const ALN = (body) => `$$\n\\begin{aligned}\n${body}\n\\end{aligned}\n$$`;
for (const w of ['ed', 'cm']) {
  const tag = w === 'ed' ? '편집창' : '댓글';
  await check(`통일 ${tag} 행 환경 Enter → \\\\+줄바꿈+들여쓰기`, w, ALN('  a &= 1|'), [enterKey], ALN('  a &= 1 \\\\\n  |'));
  await check(`통일 ${tag} 행 환경 Shift+Enter → \\\\ 없이 줄바꿈`, w, ALN('  a &= 1|'), [shiftEnter], ALN('  a &= 1\n  |'));
  await check(`통일 ${tag} 수식 밖 Enter → 그냥 줄바꿈`, w, 'ab|', [enterKey], 'ab\n|');
  await check(`통일 ${tag} ^ → ^{}`, w, 'a $x|$ b', [typeStr('^')], 'a $x^{|}$ b');
  await check(`통일 ${tag} ^ 뒤 ⌘Z → 변환만 풀림`, w, 'a $x|$ b', [typeStr('^'), cmdZ], 'a $x^|$ b');
  await check(`통일 ${tag} _ → _{}`, w, 'a $x|$ b', [typeStr('_')], 'a $x_{|}$ b');
  await check(`통일 ${tag} (a+b)/ → \\frac{a+b}{}`, w, 'a $ |$ b', [typeStr('(a+b)/')], 'a $ \\frac{a+b}{|}$ b');
  await check(`통일 ${tag} f(x)/ → 무변환`, w, 'a $f|$ b', [typeStr('(x)/')], 'a $f(x)/|$ b');
  await check(`통일 ${tag} 선택 + ( → \\left(…\\right)`, w, 'a $|x+1|$ b', [typeStr('(')], 'a $[\\left(x+1\\right)]$ b');
  await check(`통일 ${tag} \\left 뒤 ( → \\right) 짝`, w, 'a $\\left|$ b', [typeStr('(')], 'a $\\left(|\\right)$ b');
  await check(`통일 ${tag} 수식 밖 ( → 짝 없음`, w, 'ab|', [typeStr('(')], 'ab(|');
  await check(`통일 ${tag} 수식 안 공백 앞 ( → 짝`, w, 'a $x | y$ b', [typeStr('(')], 'a $x (|) y$ b');
  await check(`통일 ${tag} 수식 안 글자 앞 ( → 짝 없음(closeBrackets)`, w, 'a $|x$ b', [typeStr('(')], 'a $(|x$ b');
  await check(`통일 ${tag} 수식 안 { → 항상 {}`, w, 'a $|x$ b', [typeStr('{')], 'a ${|}x$ b');
  await check(`통일 ${tag} 짝 괄호 사이 Backspace → 짝째 삭제`, w, 'a $x (|) y$ b', [backspace], 'a $x | y$ b');
  await check(`통일 ${tag} 짝으로 넣은 ) 건너뛰기`, w, 'a $x | y$ b', [typeStr('(1)')], 'a $x (1)| y$ b');
}


// ── 윈도우 검수 후속 — (A) 자모 확정 직후 같은 순간의 Tab·Ctrl+M (68a 치환 전 문서를 보던 경합) (B) 조합 확정이 keydown보다 먼저 오는 순서 ──
const winRace = (w, codes, jamo, then) => ev(`(async () => {
  const H = window.__h; const v = H.view(${JSON.stringify(w)}); const c = v.contentDOM;
  const key = (code) => { const k = new KeyboardEvent('keydown', { key: 'Process', code, isComposing: true, bubbles: true, cancelable: true }); Object.defineProperty(k, 'keyCode', { get: () => 229 }); c.dispatchEvent(k); };
  const ins = (t) => v.dispatch(v.state.update(v.state.replaceSelection(t), { userEvent: 'input.type.compose' }));
  const codes = ${JSON.stringify(codes)}; const jm = ${JSON.stringify(jamo)};
  for (let i = 0; i < codes.length - 1; i++) { key(codes[i]); ins(jm[i]); await new Promise((r) => setTimeout(r, 60)); }
  key(codes.at(-1)); ins(jm.at(-1));
  ${'${then}'}
  return 1;
})()`.replace('${then}', then)).then(() => sleep(250));
const TAB_NOW = "c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));";
const CTRLM_NOW = "c.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', ctrlKey: true, bubbles: true, cancelable: true }));";
const ENTER_NOW = "c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));";
const SUMDOC = '$$\n|\n\\sum_{k=}^{}{}\n$$';
for (const w of ['ed', 'cm']) {
  const tag = w === 'ed' ? '편집창' : '댓글';
  await check(`윈도우 ${tag} lim 확정 직후 Tab → 확장`, w, SUMDOC, [() => winRace(w, ['KeyL', 'KeyI', 'KeyM'], ['ㅣ', 'ㅑ', 'ㅡ'], TAB_NOW)], '$$\n\\lim_{| \\to }{}\n\\sum_{k=}^{}{}\n$$');
  await check(`윈도우 ${tag} sq 확정 직후 Tab → 확장`, w, SUMDOC, [() => winRace(w, ['KeyS', 'KeyQ'], ['ㄴ', 'ㅂ'], TAB_NOW)], '$$\n\\sqrt{|}\n\\sum_{k=}^{}{}\n$$');
  await check(`윈도우 ${tag} 인라인 x 확정 직후 Ctrl+M → x 뒤로 나오기`, w, 'a $|$ b', [() => winRace(w, ['KeyX'], ['ㅌ'], CTRLM_NOW)], 'a $x$| b');
  await check(`윈도우 ${tag} aligned 행 끝 확정 직후 Enter → \\\\`, w, ALN('  a &= |'), [() => winRace(w, ['KeyX'], ['ㅌ'], ENTER_NOW)], ALN('  a &= x \\\\\n  |'));
  await check(`윈도우 ${tag} 확정이 keydown보다 먼저(7) → Ctrl+M 실행`, w, 'abc 한|', [() => ev(`(() => {
    const c = window.__h.view(${JSON.stringify(w)}).contentDOM;
    c.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    c.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }));
    const k = new KeyboardEvent('keydown', { key: 'Process', code: 'KeyM', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true });
    Object.defineProperty(k, 'keyCode', { get: () => 229 }); c.dispatchEvent(k); return 1;
  })()`).then(() => sleep(200))], 'abc 한$|$');
}

// ── 2026-10-10 토글 단축키 키 반복 가드 — 길게 눌러 반복 keydown(e.repeat)이 와도 한 번만(덕수 보고 "Ctrl+Shift+M이 됐다 안 됐다") ──
async function holdChord(k, code, vk, mods, repeats) {
  const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods };
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  for (let i = 0; i < repeats; i++) { await sleep(40); await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base, autoRepeat: true }); }
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(60);
}
for (const w of ['ed', 'cm']) {
  const tag = w === 'ed' ? '편집창' : '댓글';
  for (const n of [1, 2, 3]) {
    await check(`반복 ${tag} Ctrl+Shift+M 누른 채 반복 ${n}회 → 블록 하나`, w, 'foo|bar', [() => holdChord('M', 'KeyM', 77, MOD.ctrl | MOD.shift, n)], 'foo\n\n$$\n|\n$$\n\nbar', undoIs(1));
  }
  await check(`반복 ${tag} Ctrl+M 반복 2회 → $|$ 하나`, w, 'abc |def', [() => holdChord('m', 'KeyM', 77, MOD.ctrl, 2)], 'abc $|$def');
  await check(`반복 ${tag} Mac Ctrl+= 반복 1회`, w, 'abc |def', [() => holdChord('=', 'Equal', 187, MOD.ctrl, 1)], 'abc $|$def');
  await check(`반복 ${tag} Shift+Esc 빈 쌍 반복 2회 → 삭제 한 번`, w, 'abc $|$x', [() => holdChord('Escape', 'Escape', 27, MOD.shift, 2)], 'abc |x');
}
await check('반복 따로 두 번 누름(의도) → 여전히 되돌린다', 'ed', 'foo|bar', [ctrlShiftM, ctrlShiftM], 'foo|\n\nbar');
await check('반복 Tab은 그대로 반복(대상 아님) — 확장 뒤 다음 자리까지 두 번', 'ed', '$int|$', [() => holdChord('Tab', 'Tab', 9, 0, 1)], '$\\int_{}^{|}{ dx}$');
const composeThenRepeat = (reps, repKeyCode) => () => ev(`(async () => {
  const v = window.__h.view('ed'); const c = v.contentDOM;
  const kd = (o) => { const k = new KeyboardEvent('keydown', { key: o.key, code: 'KeyM', ctrlKey: true, shiftKey: true, isComposing: o.comp, repeat: o.rep, bubbles: true, cancelable: true }); Object.defineProperty(k, 'keyCode', { get: () => o.kc }); c.dispatchEvent(k); };
  c.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  kd({ key: 'Process', comp: true, rep: false, kc: 229 });
  for (let i = 0; i < ${reps}; i++) { await new Promise(r => setTimeout(r, 5)); kd({ key: 'Process', comp: true, rep: true, kc: 229 }); }
  await new Promise(r => setTimeout(r, 30));
  c.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }));
  for (let i = 0; i < ${reps}; i++) { await new Promise(r => setTimeout(r, 5)); kd({ key: 'M', comp: false, rep: true, kc: ${repKeyCode} }); }
  await new Promise(r => setTimeout(r, 250));
  return 1;
})()`);
for (const n of [1, 2]) {
  await check(`반복 조합 중 Ctrl+Shift+M + 조합 중·확정 뒤 반복 ${n}회 → 블록 하나`, 'ed', 'abc 한|', [composeThenRepeat(n, 77)], 'abc 한\n\n$$\n|\n$$');
}

const fails = results.filter((r) => !r.ok).length;
console.log(`\n== ${results.length - fails}/${results.length} pass`);
ws.close();
chrome.kill();
process.exit(fails ? 1 : 0);
