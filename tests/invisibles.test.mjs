/* M9 D24-1′ — lib/invisibles.ts (import 0). npm run test:invisibles */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripInvisibles, isInvisibleTarget, INVISIBLE_SPECIAL_CHARS } from '../.test-build/lib/invisibles.js';

const cps = (s) => [...s].map((c) => c.codePointAt(0).toString(16));

test('M1 원인: 단독 초성 U+1100 + 마침표 → 호환 자모 ㄱ.', () => {
  assert.deepEqual(cps(stripInvisibles('\u1100. $a=0$')).slice(0, 2), ['3131', '2e']);
  assert.equal(stripInvisibles('\u1100. a\n\u1102. b\n\u1103. c'), 'ㄱ. a\nㄴ. b\nㄷ. c');
  assert.equal(stripInvisibles('(\u1100)에서'), '(ㄱ)에서');
});

test('NFD 한글 음절은 보존된다(NFC로 조합될 뿐 쪼개지지 않는다)', () => {
  const nfd = '해설_fig1.jpg'.normalize('NFD');
  assert.equal(stripInvisibles(nfd), '해설_fig1.jpg');
  const inc = `\\includegraphics{${'가나_fig2.png'.normalize('NFD')}}`;
  assert.equal(stripInvisibles(inc), '\\includegraphics{가나_fig2.png}');
});

test('폭 0 문자 제거 · ZWJ 보존', () => {
  assert.equal(stripInvisibles('\u2060ㄱ. a'), 'ㄱ. a');
  assert.equal(stripInvisibles('a\u200Bb\uFEFFc\u00ADd'), 'abcd');
  const family = '👨\u200D👩\u200D👧';
  assert.equal(stripInvisibles(family), family);
});

test('한글 채움 문자(U+3164·U+115F·U+1160) 제거', () => {
  assert.equal(stripInvisibles('\u3164ㄱ. a'), 'ㄱ. a');
  assert.equal(stripInvisibles('x\u115Fy\u1160z'), 'xyz');
});

test('행머리 비ASCII 공백만 제거, ASCII 들여쓰기·본문 중간 NBSP는 보존', () => {
  assert.equal(stripInvisibles('\u00A0ㄱ. a'), 'ㄱ. a');
  assert.equal(stripInvisibles('\u3000\u2003ㄴ. b'), 'ㄴ. b');
  assert.equal(stripInvisibles('  \u00A0ㄷ. c'), '  ㄷ. c');
  assert.equal(stripInvisibles('- 항목\n  ㄱ. 내용'), '- 항목\n  ㄱ. 내용');
  assert.equal(stripInvisibles('a\u00A0b'), 'a\u00A0b');
});

test('자모 뒤 전각·리더 마침표 → .', () => {
  assert.equal(stripInvisibles('ㄱ\uFF0E a'), 'ㄱ. a');
  assert.equal(stripInvisibles('ㄴ\u2024 b'), 'ㄴ. b');
  assert.equal(stripInvisibles('끝\uFF0E'), '끝\uFF0E');   // 자모 뒤가 아니면 무접촉
});

test('멱등 · 일반 텍스트 무변경', () => {
  const s = 'ㄱ. $t=1$이면, 점 $\\mathrm{Q}$의 좌표는 $1$이다.\n① ㄱ, ㄴ';
  assert.equal(stripInvisibles(s), s);
  const once = stripInvisibles('\u00A0\u1100. x\u200B');
  assert.equal(stripInvisibles(once), once);
});

test('대상 타입 · 가시화 정규식', () => {
  assert.equal(isInvisibleTarget('text'), true);
  assert.equal(isInvisibleTarget('roman'), true);
  assert.equal(isInvisibleTarget('image'), false);
  assert.equal(isInvisibleTarget('svg'), false);
  assert.equal(isInvisibleTarget('ggb'), false);
  assert.ok(INVISIBLE_SPECIAL_CHARS.test('\u1100.'));
  assert.ok(!INVISIBLE_SPECIAL_CHARS.test('가'.normalize('NFD')));   // NFD 초성은 점으로 안 보인다
  assert.ok(INVISIBLE_SPECIAL_CHARS.test('\u2060'));
});
