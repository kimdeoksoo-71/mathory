/**
 * Phase 68 — `lib/mathInput.ts` 회귀. 자리 해석·Tab 자리 이동·약어·자동 분수·행 환경 Enter·정돈 R5 레이아웃을 고정한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  ROW_ENVS, AMP_ENVS, ROW_ENV_RE, DEFAULT_ABBREVS, SLOT_CHAR,
  parseSlots, findEnclosingEnv, groupDepth, nextSlot, matchAbbrev, autoFracAt, rowEnterPlan, layoutRowEnvs,
} = await import('../.test-build/lib/mathInput.js');
const { scanMathRegions, mathRegionAt } = await import('../.test-build/lib/mathRegions.js');

/** `|`가 커서인 수식 문자열을 (doc, pos, region)으로 */
function at(src) {
  const pos = src.indexOf('|');
  const doc = src.slice(0, pos) + src.slice(pos + 1);
  const region = mathRegionAt(scanMathRegions(doc), pos);
  return { doc, pos, region };
}

/* ── 상수 ── */
test('ROW_ENVS: 기존 MULTILINE_ENV_RE 14종 + alignedat·align*·drcases·matrix* 포함, AMP_ENVS는 gathered류 제외', () => {
  for (const n of ['aligned', 'cases', 'dcases', 'rcases', 'array', 'gathered', 'split', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'Bmatrix', 'smallmatrix'])
    assert.ok(ROW_ENVS.includes(n), n);
  for (const n of ['alignedat', 'align*', 'drcases', 'pmatrix*']) assert.ok(ROW_ENVS.includes(n), n);
  assert.ok(!AMP_ENVS.has('gathered') && !AMP_ENVS.has('gather*') && AMP_ENVS.has('aligned') && AMP_ENVS.has('split'));
  assert.ok(ROW_ENV_RE.test('\\begin{align*}') && ROW_ENV_RE.test('\\begin{pmatrix*}') && !ROW_ENV_RE.test('\\begin{tabular}'));
});

/* ── parseSlots ── */
test('parseSlots: 기본 8종 자리 오프셋 + 끝 탈출 자리', () => {
  const expect = {
    b1: ['\\overline{\\mathrm{}}', [18, 20]],
    b2: ['{\\overline{\\mathrm{}}}^{2}', [19, 26]],
    log: ['\\log_{}{}', [6, 8, 9]],
    sq: ['\\sqrt{}', [6, 7]],
    root: ['\\sqrt[]{}', [6, 8, 9]],
    lim: ['\\lim_{ \\to }{}', [6, 11, 13, 14]],
    int: ['\\int_{}^{}{ dx}', [6, 9, 11, 15]],
    sum: ['\\sum_{k=}^{}{}', [8, 11, 13, 14]],
  };
  for (const [k, [text, slots]] of Object.entries(expect)) {
    const r = parseSlots(DEFAULT_ABBREVS[k]);
    assert.equal(r.text, text, k);
    assert.deepEqual(r.slots, slots, k);
    for (const p of r.slots.slice(0, -1)) assert.ok(p < text.length);
  }
});
test('parseSlots: ▢ 없음 → 빈 괄호 안쪽 + 끝 · 빈 괄호도 없음 → 끝 하나 · 이스케이프 0', () => {
  assert.deepEqual(parseSlots('\\frac{}{}'), { text: '\\frac{}{}', slots: [6, 8, 9] });
  assert.deepEqual(parseSlots('\\sqrt[]{}'), { text: '\\sqrt[]{}', slots: [6, 8, 9] });
  assert.deepEqual(parseSlots('\\alpha'), { text: '\\alpha', slots: [6] });
  assert.deepEqual(parseSlots('\\left\\{▢\\right\\}'), { text: '\\left\\{\\right\\}', slots: [7, 15] });
  assert.deepEqual(parseSlots('a\\\\{b}'), { text: 'a\\\\{b}', slots: [6] });
  assert.deepEqual(parseSlots('\\{\\}'), { text: '\\{\\}', slots: [4] });          // `\{\}`는 빈 그룹이 아니다
  assert.equal(parseSlots('x▢').slots.length, 1);                                    // 마지막 자리가 곧 끝 → 중복 없음
  assert.equal(SLOT_CHAR, '▢');
});

/* ── nextSlot (D11) ── */
test('nextSlot: 그룹 탈출 · 형제 인수 진입 · `(` 비진입 · 빈 괄호 · 구간 표기 · 경계', () => {
  const run = (src) => { const { doc, pos, region } = at(src); return nextSlot(doc, pos, region); };
  assert.equal(run('$x^{2|}+1$'), 6);                    // `}` 뒤로 탈출
  assert.equal(run('$\\frac{a|}{}$'), 10);               // `}{` → 분모 안
  assert.equal(run('$x^{a|}_{b}$'), 8);                  // `}_{` → 아래 첨자 안(채워져 있어도 진입 — 현행 감각)
  assert.equal(run('$\\sqrt[|]{}$'), 9);                 // `]{` 진입
  assert.equal(run('$\\sqrt{2|}(x)$'), 9);               // `(`는 형제 진입 대상이 아니다 → `}` 뒤
  assert.equal(run('$a+|\\frac{}{}$'), 9);               // 그룹 밖 → 다음 빈 `{}`
  assert.equal(run('$a|+f()$'), 5);                      // 빈 `()`
  assert.equal(run('$[0, 1|)$'), null);                  // 짝이 안 맞는 괄호는 그룹이 아니다 → 빈 칸도 없음
  assert.equal(run('$x^{2}|$'), null);                   // 할 일 없음 → null(P22는 호출부)
  assert.equal(run('$\\left\\{a|\\right\\}$'), null);     // `\{`는 그룹이 아니다
  assert.equal(run('$a|$ $\\frac{}{}$'), null);          // 수식 경계를 넘지 않는다
});

/* ── matchAbbrev ── */
test('matchAbbrev: 가장 긴 접미사 · 앞 글자 영문자/백슬래시면 불일치 · 2sq 허용', () => {
  const ab = { ...DEFAULT_ABBREVS, ab1: 'X' };
  const run = (src, a = ab) => { const { doc, pos, region } = at(src); return matchAbbrev(doc, pos, a, region); };
  assert.deepEqual(run('$lim|$'), { from: 1, content: DEFAULT_ABBREVS.lim });
  assert.equal(run('$\\log|$'), null);
  assert.equal(run('$alog|$'), null);
  assert.deepEqual(run('$2sq|$'), { from: 2, content: DEFAULT_ABBREVS.sq });
  assert.deepEqual(run('$ab1|$'), { from: 1, content: 'X' });          // b1보다 긴 ab1
  assert.deepEqual(run('$\\mathrm{int|}$'), { from: 9, content: DEFAULT_ABBREVS.int }); // R7: `{` 뒤는 확장된다
  assert.equal(run('$x+|$'), null);
});

/* ── autoFracAt (D19) ── */
test('autoFracAt: 항의 시작 `(`만 변환 · f(x)·\\left(·\\frac{}{}( 는 제외', () => {
  const run = (src) => { const { doc, pos, region } = at(src); return autoFracAt(doc, pos, region); };
  assert.deepEqual(run('$(x+1)|$'), { from: 1, numerator: 'x+1' });
  assert.deepEqual(run('$a+(x+1)|$'), { from: 3, numerator: 'x+1' });
  assert.equal(run('$=(a)(b)|$'), null);                 // `)` 뒤 `(`는 항의 시작이 아니다(D19)
  assert.deepEqual(run('$((a)+b)|$'), { from: 1, numerator: '(a)+b' });
  assert.equal(run('$f(x)|$'), null);
  assert.equal(run('$\\left(x\\right)|$'), null);
  assert.equal(run('$\\frac{1}{2}(x)|$'), null);
  assert.equal(run('$2(x)|$'), null);
  assert.equal(run('$x|$'), null);
  const nl = at('$$\na \\\\\n(b)|\n$$');
  assert.deepEqual(autoFracAt(nl.doc, nl.pos, nl.region), { from: nl.pos - 3, numerator: 'b' });  // 행머리(줄바꿈 뒤)
  const bs = at('$$\na \\\\(b)|\n$$');
  assert.deepEqual(autoFracAt(bs.doc, bs.pos, bs.region), { from: bs.pos - 3, numerator: 'b' });  // `\\(` = 줄바꿈 + 괄호
});

/* ── findEnclosingEnv · groupDepth ── */
test('findEnclosingEnv: 가장 안쪽 · 인수 통과(W2) · 헤더 · 미닫힘', () => {
  const s = at('$$\n\\begin{aligned}\n  a &= \\begin{cases} 1 & x|>0 \\\\ 2 \\end{cases}\n\\end{aligned}\n$$');
  const e = findEnclosingEnv(s.doc, s.pos, s.region);
  assert.equal(e.name, 'cases');
  assert.equal(e.beginIndent, '  ');
  const arr = at('$$\n\\begin{array}{|p{2cm}|l|}\n  a| & b\n\\end{array}\n$$');
  const ea = findEnclosingEnv(arr.doc, arr.pos, arr.region);
  assert.equal(ea.name, 'array');
  assert.equal(arr.doc.slice(ea.bodyFrom, ea.bodyFrom + 1), '\n');                // 인수 `{|p{2cm}|l|}` 뒤가 본문
  assert.equal(groupDepth(arr.doc, ea.bodyFrom, arr.pos), 0);
  const hdr = at('$$\n\\begin{aligned}|\n\\end{aligned}\n$$');
  assert.equal(findEnclosingEnv(hdr.doc, hdr.pos, hdr.region).name, 'aligned');
  const open = at('$$\n\\begin{cases}\n  a|\n$$');
  const eo = findEnclosingEnv(open.doc, open.pos, open.region);
  assert.equal(eo.name, 'cases');
  assert.equal(eo.bodyTo, open.region.innerTo);
  const none = at('$$\nx|=1\n$$');
  assert.equal(findEnclosingEnv(none.doc, none.pos, none.region), null);
  const txt = at('$$\n\\begin{aligned}\n  \\text{a|}\n\\end{aligned}\n$$');
  const et = findEnclosingEnv(txt.doc, txt.pos, txt.region);
  assert.equal(groupDepth(txt.doc, et.bodyFrom, txt.pos), 1);                      // `\text{` 안 = 깊이 1 → `&` 아님
});

/* ── rowEnterPlan (D16) ── */
test('rowEnterPlan: ⓐ~ⓔ · \\\\[4pt] · 환경 밖 null · 인라인 영역도 동작', () => {
  const run = (src) => { const { doc, pos, region } = at(src); const p = rowEnterPlan(doc, pos, region); if (!p) return null;
    const out = doc.slice(0, p.from) + p.insert + doc.slice(p.to); return { out, cursor: p.cursor }; };
  // ⓔ 일반 행
  let r = run('$$\n\\begin{aligned}\n  a &= 1|\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  a &= 1 \\\\\n  \n\\end{aligned}\n$$');
  assert.equal(r.out.slice(0, r.cursor).endsWith('\\\\\n  '), true);
  // ⓔ 뒤 공백 흡수
  r = run('$$\n\\begin{aligned}\n  a &= 1  |\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  a &= 1 \\\\\n  \n\\end{aligned}\n$$');
  // ⓑ 빈 행
  r = run('$$\n\\begin{aligned}\n  |\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  \n  \n\\end{aligned}\n$$');
  // ⓓ 이미 \\ · \\[4pt]
  r = run('$$\n\\begin{aligned}\n  a \\\\|\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  a \\\\\n  \n\\end{aligned}\n$$');
  r = run('$$\n\\begin{aligned}\n  a \\\\[4pt]|\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  a \\\\[4pt]\n  \n\\end{aligned}\n$$');
  // ⓐ 헤더 행 끝
  r = run('$$\n\\begin{aligned}|\n\\end{aligned}\n$$');
  assert.equal(r.out, '$$\n\\begin{aligned}\n  \n\\end{aligned}\n$$');
  r = run('$$\n\\begin{array}{cl}|\n\\end{array}\n$$');
  assert.equal(r.out, '$$\n\\begin{array}{cl}\n  \n\\end{array}\n$$');
  assert.equal(run('$$\n\\begin{alig|ned}\n\\end{aligned}\n$$'), null);           // 헤더 중간은 비관여
  // ⓒ `\end` 앞 — 한 줄 환경
  r = run('$$\n\\begin{cases}a \\\\ b|\\end{cases}\n$$');
  assert.equal(r.out, '$$\n\\begin{cases}a \\\\ b \\\\\n  \n\\end{cases}\n$$');
  assert.equal(r.out.slice(r.cursor), '\n\\end{cases}\n$$');
  // ⓒ 들여쓴 환경, 뒤 공백 포함
  r = run('$$\n  \\begin{cases}\n    a|  \\end{cases}\n$$');
  assert.equal(r.out, '$$\n  \\begin{cases}\n    a \\\\\n    \n  \\end{cases}\n$$');
  // 환경 밖 · `\end` 위 → null
  assert.equal(run('$$\nx=1|\n$$'), null);
  assert.equal(run('$$\n\\begin{aligned}\n  a\n\\end{alig|ned}\n$$'), null);
  // 인라인 영역 안 환경
  r = run('$\\begin{cases} a|\\end{cases}$');
  assert.equal(r.out, '$\\begin{cases} a \\\\\n  \n\\end{cases}$');
});

/* ── layoutRowEnvs (R5) ── */
test('layoutRowEnvs: 한 줄 aligned → 4행 · 멱등', () => {
  const src = '앞\n\n$$\n\\begin{aligned}a&=1\\\\b&=2\\end{aligned}\n$$\n\n뒤';
  const r = layoutRowEnvs(src);
  assert.equal(r.changed, true);
  assert.equal(r.text, '앞\n\n$$\n\\begin{aligned}\n  a&=1 \\\\\n  b&=2\n\\end{aligned}\n$$\n\n뒤');
  const again = layoutRowEnvs(r.text);
  assert.equal(again.changed, false);
  assert.equal(again.text, r.text);
});
test('layoutRowEnvs: 중첩 예시(착수판 §4-1) 바이트 일치 · 멱등', () => {
  const src = '$$\nx=\\begin{cases} a & x>0 \\\\ \\begin{aligned}b&=1\\\\c&=2\\end{aligned} & x\\le0 \\end{cases}\n$$';
  const want = [
    '$$', 'x=', '\\begin{cases}', '  a & x>0 \\\\', '  \\begin{aligned}', '    b&=1 \\\\', '    c&=2', '  \\end{aligned}', '  & x\\le0', '\\end{cases}', '$$',
  ].join('\n');
  const r = layoutRowEnvs(src);
  assert.equal(r.text, want);
  assert.equal(layoutRowEnvs(want).changed, false);
});
test('layoutRowEnvs: \\\\[4pt] 보존 · [b,c] 행머리는 떼어 낸다 · 빈 행 · 마지막 \\\\ 보존 · array 인수', () => {
  let r = layoutRowEnvs('$$\n\\begin{aligned}a\\\\[4pt]b\\end{aligned}\n$$');
  assert.equal(r.text, '$$\n\\begin{aligned}\n  a \\\\[4pt]\n  b\n\\end{aligned}\n$$');
  r = layoutRowEnvs('$$\n\\begin{aligned}a&=1\\\\[b,c]&=2\\end{aligned}\n$$');
  assert.equal(r.text, '$$\n\\begin{aligned}\n  a&=1 \\\\\n  [b,c]&=2\n\\end{aligned}\n$$');
  r = layoutRowEnvs('$$\n\\begin{aligned}a\\\\ \\\\b\\\\\\end{aligned}\n$$');
  assert.equal(r.text, '$$\n\\begin{aligned}\n  a \\\\\n  \\\\\n  b \\\\\n\\end{aligned}\n$$');
  assert.equal(layoutRowEnvs(r.text).changed, false);
  r = layoutRowEnvs('$$\n\\begin{array}{|p{2cm}|l|}a&b\\\\c&d\\end{array}\n$$');
  assert.equal(r.text, '$$\n\\begin{array}{|p{2cm}|l|}\n  a&b \\\\\n  c&d\n\\end{array}\n$$');
});
test('layoutRowEnvs: \\text{a\\\\b}·tabular 무분할 · 미닫힘 무접촉', () => {
  let r = layoutRowEnvs('$$\n\\begin{aligned}\\text{a\\\\b}&=1\\\\c&=2\\end{aligned}\n$$');
  assert.equal(r.text, '$$\n\\begin{aligned}\n  \\text{a\\\\b}&=1 \\\\\n  c&=2\n\\end{aligned}\n$$');
  r = layoutRowEnvs('$$\n\\begin{tabular}{cc}a\\\\b\\end{tabular}\n$$');
  assert.equal(r.changed, false);
  r = layoutRowEnvs('$$\n\\begin{aligned}a\\\\b\n$$');
  assert.equal(r.changed, false);
});
test('layoutRowEnvs: 한 줄 $$…$$ · (c) 형태 · 인라인 · \\[…\\] · 펜스 밖 텍스트 무접촉', () => {
  for (const s of [
    '$$\\begin{aligned}a\\\\b\\end{aligned}$$',
    '$$\\begin{aligned}\na\\\\b\n\\end{aligned}$$',
    '$$\\begin{aligned}a\\\\b\\end{aligned}\n$$',
    '본문 $\\begin{cases}a\\\\b\\end{cases}$ 본문',
    '\\[\\begin{aligned}a\\\\b\\end{aligned}\\]',
    '$$\n\\begin{aligned}a\\\\b\\end{aligned} $$',
  ]) {
    const r = layoutRowEnvs(s);
    assert.equal(r.changed, false, s);
    assert.equal(r.text, s);
  }
  const two = '$$\n\\begin{cases}a\\\\b\\end{cases}\n$$\n\n글  \n\n$$\nx=1\n$$\n\n$$\n\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\n$$';
  const r = layoutRowEnvs(two);
  assert.equal(r.text, '$$\n\\begin{cases}\n  a \\\\\n  b\n\\end{cases}\n$$\n\n글  \n\n$$\nx=1\n$$\n\n$$\n\\begin{pmatrix}\n  1&2 \\\\\n  3&4\n\\end{pmatrix}\n$$');
});

/* ── Phase 68b — isFencedDisplay · isEmptyDisplay · mathExitPos · displayTabExit · emptyDisplayDeleteRange ── */
const { isFencedDisplay, isEmptyDisplay, mathExitPos, displayTabExit, emptyDisplayDeleteRange } = await import('../.test-build/lib/mathInput.js');
const regionOf = (doc, pos) => mathRegionAt(scanMathRegions(doc), pos);
/** 나오기 결과를 "적용된 문서 + 커서"로 */
const applyExit = (doc, plan) => {
  const d = plan.insert ? doc.slice(0, plan.at) + plan.insert + doc.slice(plan.at) : doc;
  return d.slice(0, plan.pos) + '|' + d.slice(plan.pos);
};

test('isFencedDisplay: 펜스 ✓ · 한 줄 $$…$$ ✗ · $$\\begin (c) ✗ · 닫는 $$ 앞 글자 ✗ · 인라인 ✗', () => {
  const ok = (doc, pos) => isFencedDisplay(doc, regionOf(doc, pos));
  assert.equal(ok('$$\nx\n$$', 3), true);
  assert.equal(ok('$$x$$', 2), false);
  assert.equal(ok('$$\\begin{aligned}a\\end{aligned}\n$$', 1), false);   // (c) 빈 쌍 안
  assert.equal(ok('$$\nx=1 $$', 3), false);
  assert.equal(ok('$x$', 1), false);
});

test('isEmptyDisplay: $$\\n\\n$$ ✓ · 공백 행 ✓ · 내용 ✗ · 한 줄 $$$$ ✓ · (c) 빈 쌍 ✗ · 미닫힘 ✗', () => {
  const ok = (doc, pos) => isEmptyDisplay(doc, regionOf(doc, pos));
  assert.equal(ok('$$\n\n$$', 3), true);
  assert.equal(ok('$$\n  \n$$', 3), true);
  assert.equal(ok('$$\nx\n$$', 3), false);
  assert.equal(ok('$$$$', 2), true);
  assert.equal(ok('a $$ b', 3), false);
  assert.equal(ok('abc $$', 6), false);
});

test('mathExitPos: 인라인 → $ 뒤 · \\( → \\) 뒤 · \\[ → \\] 뒤 · 미닫힘 인라인 → 행 끝', () => {
  const go = (src) => { const pos = src.indexOf('|'); const doc = src.slice(0, pos) + src.slice(pos + 1); return applyExit(doc, mathExitPos(doc, regionOf(doc, pos))); };
  assert.equal(go('a $x|$ b'), 'a $x$| b');
  assert.equal(go('a \\(x|\\) b'), 'a \\(x\\)| b');
  assert.equal(go('a \\[x|\\] b'), 'a \\[x\\]| b');
  assert.equal(go('a $x| b\nc'), 'a $x b|\nc');
});

test('mathExitPos: 닫힌 $$ — 펜스 → 다음 행 · 한 줄 $$x$$ → 다음 행 · 닫는 $$ 앞 글자 → 다음 행 · 뒤 글자 → region.to · 문서 끝/다음 행 비공백 → \\n 삽입', () => {
  const go = (src) => { const pos = src.indexOf('|'); const doc = src.slice(0, pos) + src.slice(pos + 1); return applyExit(doc, mathExitPos(doc, regionOf(doc, pos))); };
  assert.equal(go('a\n\n$$\nx|\n$$\n\nb'), 'a\n\n$$\nx\n$$\n|\nb');
  assert.equal(go('a\n\n$$x|$$\n\nb'), 'a\n\n$$x$$\n|\nb');
  assert.equal(go('a\n\n$$\nx|=1 $$\n\nb'), 'a\n\n$$\nx=1 $$\n|\nb');
  assert.equal(go('foo $$x|$$ bar'), 'foo $$x$$| bar');
  assert.equal(go('a\n\n$$\nx|\n$$'), 'a\n\n$$\nx\n$$\n|');
  assert.equal(go('a\n\n$$\nx|\n$$\nb'), 'a\n\n$$\nx\n$$\n|\nb');
  assert.equal(go('a\n\n$$\nx|\n$$  \n\nb'), 'a\n\n$$\nx\n$$  \n|\nb');
});

test('displayTabExit: 식 끝 ✓ · 식 중간 null · 인라인 null · 한 줄 $$x|$$ ✓ · \\[x|\\] → \\] 뒤 · \\end{aligned}| ✓ · 빈 블록 ✓(나가기만)', () => {
  const go = (src) => { const pos = src.indexOf('|'); const doc = src.slice(0, pos) + src.slice(pos + 1); const p = displayTabExit(doc, pos, regionOf(doc, pos)); return p ? applyExit(doc, p) : null; };
  assert.equal(go('$$\nx|\n$$\n\nb'), '$$\nx\n$$\n|\nb');
  assert.equal(go('$$\nx| \n\n$$\n\nb'), '$$\nx \n\n$$\n|\nb');
  assert.equal(go('$$\nx|+1\n$$\n\nb'), null);
  assert.equal(go('a $x|$ b'), null);
  assert.equal(go('$$x|$$\n\nb'), '$$x$$\n|\nb');
  assert.equal(go('\\[x|\\] b'), '\\[x\\]| b');
  assert.equal(go('$$\n\\begin{aligned}\n  a &= 1\n\\end{aligned}|\n$$\n\nb'), '$$\n\\begin{aligned}\n  a &= 1\n\\end{aligned}\n$$\n|\nb');
  assert.equal(go('$$\n|\n$$\n\nb'), '$$\n\n$$\n|\nb');
});

test('emptyDisplayDeleteRange: 가운데 → 문단 경계 하나 · 문서 시작/끝 → 패딩 없음 · 단독 → 빈 문서 · 한 줄 $$$$ → region만 (전부 저장 정규형)', () => {
  const go = (doc, pos) => { const r = emptyDisplayDeleteRange(doc, regionOf(doc, pos)); const d = doc.slice(0, r.from) + r.insert + doc.slice(r.to); return { d, c: r.cursor }; };
  assert.deepEqual(go('foo\n\n$$\n\n$$\n\nbar', 7), { d: 'foo\n\nbar', c: 3 });
  assert.deepEqual(go('foo \n\n$$\n \n$$\n\n\nbar', 8), { d: 'foo\n\nbar', c: 3 });
  assert.deepEqual(go('$$\n\n$$\n\nbar', 3), { d: 'bar', c: 0 });
  assert.deepEqual(go('foo\n\n$$\n\n$$', 7), { d: 'foo', c: 3 });
  assert.deepEqual(go('$$\n\n$$', 3), { d: '', c: 0 });
  assert.deepEqual(go('foo $$$$ bar', 6), { d: 'foo  bar', c: 4 });
});
