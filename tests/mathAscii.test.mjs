/**
 * Phase 68a — `lib/mathAscii.ts` 회귀. 키 분류(실험 로그의 실제 값) · 시간 순 짝짓기 · 큐 관리(안쪽 결합·키 폐기) · `\text` 인자 판정을 고정한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  US_KEYS, usCharFor, classifyKey, pairInsertion, dropKeysBefore, expireKeys, needsReplay, advanceQueue, isInTextArg,
  TEXT_CMDS, INS_WAIT_MS, ECHO_WINDOW_MS, KEY_TTL_MS, HANGUL_RE,
} = await import('../.test-build/lib/mathAscii.js');
const { scanMathRegions, mathRegionAt } = await import('../.test-build/lib/mathRegions.js');

const K = (over) => ({ key: 'a', code: 'KeyA', keyCode: 65, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, caps: false, ...over });
const keys = (...arr) => arr.map((s) => { const [ch, t] = s.split('@'); return { ch, t: Number(t) }; });
const pair = (text, t, ks, now, lastReplaced = null) => pairInsertion({ text, t, keys: ks, now, lastReplaced });

/* ── US 표 ── */
test('usCharFor: 영문자 caps XOR shift · 기호 shift · Space 없음 · 숫자패드', () => {
  assert.equal(usCharFor('KeyA', false, false), 'a');
  assert.equal(usCharFor('KeyA', true, false), 'A');
  assert.equal(usCharFor('KeyA', false, true), 'A');
  assert.equal(usCharFor('KeyA', true, true), 'a');
  assert.equal(usCharFor('Digit2', true, false), '@');
  assert.equal(usCharFor('Digit2', false, true), '2');     // caps는 영문자에만
  assert.equal(usCharFor('Backslash', false, false), '\\');
  assert.equal(usCharFor('BracketLeft', true, false), '{');
  assert.equal(usCharFor('Space', false, false), null);
  assert.equal(usCharFor('Numpad7', false, false), '7');
  assert.equal(usCharFor('NumpadAdd', true, false), '+');
  assert.equal(Object.keys(US_KEYS).length, 26 + 10 + 10 + 18);   // 영문자·숫자열·숫자패드 숫자·기호 12 + 숫자패드 기호 6
});

/* ── 키 분류 — 실험 1~3 로그의 실제 값 ── */
test('classifyKey: Mac 조합 자모(229) → record', () => {
  assert.deepEqual(classifyKey(K({ key: 'ᅡ', code: 'KeyF', keyCode: 229 })), { cls: 'record', ch: 'f' });
});
test('classifyKey: Mac 390 단독 종성(keyCode 실값) → direct', () => {
  assert.deepEqual(classifyKey(K({ key: 'ᆼ', code: 'KeyA', keyCode: 65 })), { cls: 'direct', ch: 'a' });
  assert.deepEqual(classifyKey(K({ key: 'ᆻ', code: 'Digit2', keyCode: 50 })), { cls: 'direct', ch: '2' });
});
test('classifyKey: Windows Process → record / Space는 pass', () => {
  assert.deepEqual(classifyKey(K({ key: 'Process', code: 'Comma', keyCode: 229 })), { cls: 'record', ch: ',' });
  assert.deepEqual(classifyKey(K({ key: 'Process', code: 'KeyA', keyCode: 229, isComposing: false })), { cls: 'record', ch: 'a' });
  assert.equal(classifyKey(K({ key: 'Process', code: 'Space', keyCode: 229 })).cls, 'pass');
});
test('classifyKey: Mac 조합 중 `{` → record `{`', () => {
  assert.deepEqual(classifyKey(K({ key: '{', code: 'BracketLeft', keyCode: 229, isComposing: true, shiftKey: true })), { cls: 'record', ch: '{' });
});
test('classifyKey: 라틴 자판은 어떤 배열이든 무접촉(latin)', () => {
  assert.equal(classifyKey(K({ key: 'x', code: 'KeyX', keyCode: 88 })).cls, 'latin');
  assert.equal(classifyKey(K({ key: 'z', code: 'KeyY', keyCode: 90 })).cls, 'latin');   // QWERTZ
  assert.equal(classifyKey(K({ key: '{', code: 'BracketLeft', keyCode: 219, shiftKey: true })).cls, 'latin');
});
test('classifyKey: `₩`(Korean Mac Backslash) → direct `\\`', () => {
  assert.deepEqual(classifyKey(K({ key: '₩', code: 'Backslash', keyCode: 220 })), { cls: 'direct', ch: '\\' });
});
test('classifyKey: 수식 키·Dead·HangulMode·표 밖 code → pass (E6)', () => {
  assert.equal(classifyKey(K({ ctrlKey: true })).cls, 'pass');
  assert.equal(classifyKey(K({ metaKey: true, key: 'ᆼ' })).cls, 'pass');
  assert.equal(classifyKey(K({ key: 'Dead', code: 'Digit6', keyCode: 229 })).cls, 'pass');
  assert.equal(classifyKey(K({ key: 'Dead', code: 'Digit6', keyCode: 54, shiftKey: true })).cls, 'pass');   // v2에선 direct `^`
  assert.equal(classifyKey(K({ key: 'HangulMode', code: 'Lang1', keyCode: 21 })).cls, 'pass');
  assert.equal(classifyKey(K({ key: 'Tab', code: 'Tab', keyCode: 9 })).cls, 'pass');
  assert.equal(classifyKey(K({ key: 'ㄱ', code: '', keyCode: 229 })).cls, 'pass');      // iPad 가상 키보드
});

/* ── 짝짓기 — 시간 순 (D5′) ── */
test('pairInsertion: 자모 하나 ↔ 그 앞의 키 하나', () => {
  assert.deepEqual(pair('ㅁ', 10, keys('i@5'), 11), { rep: 'i', consumed: 1, wait: false, echo: false, kept: 0 });
});
test('pairInsertion: 음절 하나가 앞선 키 전부를 받는다 (E2 — 2벌식 마=2키 · 닭=4키)', () => {
  assert.equal(pair('마', 10, keys('f@5', 'k@8'), 11).rep, 'fk');
  const r = pair('닭', 10, keys('e@2', 'k@4', 'f@6', 'r@8'), 11);
  assert.equal(r.rep, 'ekfr'); assert.equal(r.consumed, 4);
});
test('pairInsertion: 뒤에 온 키는 먹지 않는다', () => {
  assert.deepEqual(pair('ㅁ', 10, keys('i@5', 'k@12'), 13), { rep: 'i', consumed: 1, wait: false, echo: false, kept: 0 });
});
test('pairInsertion: 커밋+ASCII 한 삽입(`ㅔ{`) — 꼬리 ASCII는 같은 키와 짝', () => {
  assert.deepEqual(pair('ㅔ{', 10, keys('c@5', '{@8'), 11), { rep: 'c{', consumed: 2, wait: false, echo: false, kept: 0 });
});
test('pairInsertion: Windows ASCII 조합(`,`) — 글자 그대로 · 키만 소비', () => {
  assert.deepEqual(pair(',', 10, keys(',@5'), 11), { rep: ',', consumed: 1, wait: false, echo: false, kept: 0 });
});
test('pairInsertion: 키 없이 남은 비한글 글자는 보존(Mac Space 확정 `ㅁ `, `ㅁa`)', () => {
  assert.equal(pair('ㅁ ', 10, keys('f@5'), 11).rep, 'f ');
  assert.equal(pair('ㅁa', 10, keys('i@5'), 11).rep, 'ia');
  assert.equal(pair(' ', 10, [], 11).rep, ' ');
});
test('pairInsertion: Safari 순서 — 키 없으면 INS_WAIT 안 대기, 지난 뒤 늦은 키 하나만', () => {
  assert.equal(pair('ㅏ', 10, [], 10 + INS_WAIT_MS - 1).wait, true);
  assert.deepEqual(pair('ㅏ', 10, keys('k@15', 'x@30'), 10 + INS_WAIT_MS + 20), { rep: 'k', consumed: 1, wait: false, echo: false, kept: 0 });
});
test('pairInsertion: 메아리는 "직전에 지운 같은 글자열 + ECHO_WINDOW 안"에서만 (E15)', () => {
  const now = 100;
  assert.deepEqual(pair('ㅏ', 10, [], now, { text: 'ㅏ', t: now - ECHO_WINDOW_MS + 10 }), { rep: '', consumed: 0, wait: false, echo: true, kept: 0 });
  assert.deepEqual(pair('ㅏ', 10, [], now, { text: 'ㅁ', t: now - 10 }), { rep: 'ㅏ', consumed: 0, wait: false, echo: false, kept: 1 });
  assert.equal(pair('ㅏ', 10, [], now, { text: 'ㅏ', t: now - ECHO_WINDOW_MS - 1 }).kept, 1);
  assert.equal(pair('ㅏ', 10, [], now, null).kept, 1);
});
test('pairInsertion: 한글도 ASCII도 아닌 글자(한자)는 무접촉 · 키 소비 0 (D5′ ⑤)', () => {
  assert.deepEqual(pair('漢', 10, keys('a@5'), 11), { rep: '漢', consumed: 0, wait: false, echo: false, kept: 0 });
  assert.equal(pair('，', 10, keys(',@5'), 11).consumed, 0);                 // 전각 쉼표 — 같은 글자가 아니다
  assert.equal(pair(',', 10, keys('f@3', ',@5'), 11).consumed, 2);           // 고아 f는 `,`와 함께 소비(정렬 유지)
});
test('HANGUL_RE: 첫가끝·호환·음절·확장 자모·반각', () => {
  for (const c of ['ᄀ', 'ᆼ', 'ㄱ', 'ㅏ', '가', '힣', 'ꥠ', 'ힰ', 'ﾡ']) assert.ok(HANGUL_RE.test(c), c);
  for (const c of ['a', '{', '漢', ' ']) assert.ok(!HANGUL_RE.test(c), c);
});

/* ── 키 큐 ── */
test('dropKeysBefore · expireKeys', () => {
  assert.deepEqual(dropKeysBefore(keys('a@1', 'b@5', 'c@9'), 5), keys('c@9'));
  assert.deepEqual(expireKeys(keys('a@0', 'b@100'), KEY_TTL_MS + 50), keys('b@100'));
  assert.deepEqual(expireKeys(keys('a@0'), KEY_TTL_MS), keys('a@0'));
});

/* ── 재생 대상 ── */
test('needsReplay: 한글 또는 compose(.start 포함) · paste·프로그램적 제외', () => {
  assert.ok(needsReplay('ㅁ', 'input.type.compose'));
  assert.ok(needsReplay(',', 'input.type.compose'));
  assert.ok(needsReplay(',', 'input.type.compose.start'));
  assert.ok(!needsReplay('x', 'input.type'));
  assert.ok(!needsReplay('ㅁ', 'input.paste') === false);   // 한글이면 userEvent 무관 — paste 제외는 호출부(own·paste 플래그)가 한다
  assert.ok(needsReplay('ㅏ', 'input.type'));              // Safari
  assert.ok(!needsReplay('x', undefined));
  assert.ok(!needsReplay('', 'input.type.compose'));
});

/* ── 큐 관리 (I1~I4) ── */
const ent = (from, to, text, t = 10) => ({ from, to, text, t });
const ch = (fa, ta, fb, tb, ins, qualifies) => ({ fa, ta, fb, tb, ins, qualifies });

test('advanceQueue ⓐ: 보류 뒤에 닿는 삽입은 범위를 늘리지 않는다 (I1 — 안쪽 결합)', () => {
  const r = advanceQueue([ent(5, 6, 'ㅁ')], [ch(6, 6, 6, 7, '{', true)], 20);
  assert.deepEqual(r.entries, [ent(5, 6, 'ㅁ'), ent(6, 7, '{', 20)]);
  assert.equal(r.dropKeysBeforeT, null);
  assert.deepEqual(r.added, [ent(6, 7, '{', 20)]);
});
test('advanceQueue ⓑ: 조합 갱신(ㅁ→마 치환)은 항목 대체 · 키 보존 (I2)', () => {
  const r = advanceQueue([ent(5, 6, 'ㅁ')], [ch(5, 6, 5, 6, '마', true)], 20);
  assert.deepEqual(r.entries, [ent(5, 6, '마', 20)]);
  assert.equal(r.dropKeysBeforeT, null);
});
test('advanceQueue ⓒ: Backspace(순수 삭제)는 항목 제거 + 키 폐기 신호', () => {
  const r = advanceQueue([ent(5, 6, 'ㅁ')], [ch(5, 6, 5, 5, '', false)], 20);
  assert.deepEqual(r.entries, []);
  assert.equal(r.dropKeysBeforeT, 10);
});
test('advanceQueue ⓓ: 앞쪽 삽입만큼 밀린다', () => {
  assert.deepEqual(advanceQueue([ent(5, 6, 'ㅁ')], [ch(2, 2, 2, 4, 'ab', false)], 20).entries, [ent(7, 8, 'ㅁ')]);
});
test('advanceQueue ⓔ: 정확히 from에 닿는 삽입은 뒤로 민다 (assoc +1)', () => {
  assert.deepEqual(advanceQueue([ent(5, 6, 'ㅁ')], [ch(5, 5, 5, 6, 'x', false)], 20).entries, [ent(6, 7, 'ㅁ')]);
});
test('advanceQueue ⓕ: 둘 중 첫째 삭제 → 둘째가 당겨진다', () => {
  const r = advanceQueue([ent(5, 6, 'ㅁ', 10), ent(6, 7, 'ㅏ', 12)], [ch(5, 6, 5, 5, '', false)], 20);
  assert.deepEqual(r.entries, [ent(5, 6, 'ㅏ', 12)]);
  assert.equal(r.dropKeysBeforeT, 10);
});
test('advanceQueue ⓖ: 비자격 치환으로 덮이면 제거 + 키 폐기', () => {
  const r = advanceQueue([ent(5, 6, 'ㅁ')], [ch(5, 6, 5, 6, 'y', false)], 20);
  assert.deepEqual(r.entries, []);
  assert.equal(r.dropKeysBeforeT, 10);
});
test('advanceQueue ⓗ: 우리 재생 삽입(비자격)이 인접 다음 항목을 민다', () => {
  assert.deepEqual(advanceQueue([ent(5, 6, 'ㅏ')], [ch(5, 5, 5, 6, 'f', false)], 20).entries, [ent(6, 7, 'ㅏ')]);
});
test('advanceQueue: 범위 안에 떨어진 삽입은 겹침(제거) · 여러 변경의 길이 차 누적 · 치환 경계는 CM mapPos와 같다', () => {
  assert.deepEqual(advanceQueue([ent(5, 7, '마ㅏ')], [ch(6, 6, 6, 7, 'x', false)], 20).entries, []);
  assert.deepEqual(advanceQueue([ent(10, 11, 'ㅁ')], [ch(0, 2, 0, 0, '', false), ch(4, 4, 2, 5, 'abc', false)], 20).entries, [ent(11, 12, 'ㅁ')]);
  // 치환 [5,6)→'마'가 보류 [6,7)에 닿아도 늘리지 않는다 / 보류 [3,4) 앞의 치환은 길이 차만큼
  assert.deepEqual(advanceQueue([ent(6, 7, 'ㅏ')], [ch(5, 6, 5, 7, '마a', false)], 20).entries, [ent(7, 8, 'ㅏ')]);
});

/* ── \text 인자 ── */
function at(src) {
  const pos = src.indexOf('|');
  const doc = src.slice(0, pos) + src.slice(pos + 1);
  return { doc, pos, region: mathRegionAt(scanMathRegions(doc), pos) };
}
test('isInTextArg: 10종 인자 안 ✔ · 밖 ✘ · 미닫힘 ✔ · \\mathrm ✘ · \\left\\{ ✘', () => {
  assert.equal(TEXT_CMDS.length, 10);
  const yes = ['$\\text{한|글}$', '$\\textbf{|}$', '$\\text{한|', '$x+\\mbox{a |b}$', '$\\text{(가|)}$', '$\\text{a{b|c}}$', '$\\text{|}$'];
  const no = ['$\\text{a}|$', '$\\mathrm{|}$', '$\\left\\{|$', '$|\\text{a}$', '$\\text{a}+|b$', '$\\operatorname{s|}$'];
  for (const s of yes) { const { doc, pos, region } = at(s); assert.ok(region, s); assert.ok(isInTextArg(doc, pos, region), s); }
  for (const s of no) { const { doc, pos, region } = at(s); assert.ok(region, s); assert.ok(!isInTextArg(doc, pos, region), s); }
});
