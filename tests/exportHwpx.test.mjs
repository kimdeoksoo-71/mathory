/**
 * Phase 71 — IR → .hwpx(hwpx.ts) 검증.
 *
 * 실행: npm run test:exporthwpx
 * 스냅샷 갱신: EXPORT_SNAPSHOT_UPDATE=1 npm run test:exporthwpx (갱신 뒤 diff를 읽을 것)
 *
 * 표본은 Phase 70과 같은 sampleProblem. 실물(한글 2022) 검증은 덕수 몫 — 여기서는 구조 계약을 고정한다:
 * well-formed(@xmldom) · zip(mimetype stored 첫 항목 · mtime 1980) · itemCnt = 실제 개수 · 결정성 ·
 * `<hp:t>` 안 날것 탭 금지 · 한글 산출물 모양(G2 — 착수판 §1-2 본문 계약: 번호 런 · 글상자·그림 자식 순서) ·
 * 매핑(§3-3) · 옵션 A/B · 번호 2종 + 실패 · 선택지 판정 · 로마자 라벨 · ⋯⋯⋯ ㉠
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc } from '../.test-build/lib/export/ir.js';
import { serializeHwpx, problemNumber, endnoteAnchor } from '../.test-build/lib/export/hwpx/hwpx.js';
import { isLongChoices } from '../.test-build/lib/export/hwpx/choices.js';
import { imageSize } from '../.test-build/lib/export/hwpx/imageSize.js';
import { hwpEqSize, layoutHwp, hwpPad } from '../.test-build/lib/export/hwpx/hwpLayout.js';
const CAL = JSON.parse(readFileSync('tests/fixtures/export/hwpEqCalibration.json', 'utf8')).items;
import { STYLE_IDS } from '../.test-build/lib/export/hwpx/skeleton/ids.js';
import { sampleProblem } from './fixtures/export/sampleProblem.mjs';

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);
const R = String.raw;
const SNAP = 'tests/fixtures/export/sampleProblem.expected.hwpx-section0.xml';

/** 그림은 실물 없이 — 400×200 px 가짜 */
function sourceOf(input) {
  const doc = buildExportDoc(input, { parse });
  return { doc, figure: (id) => ({ bin: `image${id.replace(/\D/g, '')}`, pxW: 400, pxH: 200 }) };
}
function hwpx(inputs, options = {}, bins = []) {
  const r = serializeHwpx({ title: 't', sources: inputs.map(sourceOf), bins, options: { numbering: 'title', placement: 'column', ...options } });
  const entries = unzipSync(r.bytes);
  return { ...r, entries, section: strFromU8(entries['Contents/section0.xml']), header: strFromU8(entries['Contents/header.xml']) };
}
const single = (blocks, tab = 'question', title = '문항 7') => ({ title, tabs: [{ id: tab, label: tab, blocks }] });
const two = (q, s, title = '문항 7') => ({ title, tabs: [{ id: 'question', label: '문제', blocks: q }, { id: 'solution', label: '풀이', blocks: s }] });
const blk = (type, raw_text, extra = {}) => ({ id: `${type}-${raw_text.length}`, type, raw_text, ...extra });

/* ═══ 패키지 ═══ */

test('X1 zip — mimetype stored 첫 항목 · 항목 순서 · mtime 1980 · PrvImage 없음', () => {
  const { bytes, entries } = hwpx([sampleProblem]);
  assert.deepEqual(Object.keys(entries), [
    'mimetype', 'version.xml', 'Contents/header.xml', 'Contents/masterpage0.xml', 'Contents/section0.xml',
    'Preview/PrvText.txt', 'settings.xml', 'META-INF/container.rdf', 'Contents/content.hpf', 'META-INF/container.xml', 'META-INF/manifest.xml',
  ]);
  assert.equal(strFromU8(entries.mimetype), 'application/hwp+zip');
  // 로컬 헤더: 압축 방식(오프셋 8) = 0(stored) · DOS 날짜(오프셋 12) = 1980-01-01 → 0x0021
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint16(8, true), 0);
  assert.equal(dv.getUint16(12, true), 0x0021);
  assert.match(strFromU8(entries['Preview/PrvText.txt']), /\r\n/);
});

test('X2 well-formed(@xmldom) — XML 항목 전부', () => {
  const { entries } = hwpx([sampleProblem], { placement: 'endnote' });
  for (const [name, data] of Object.entries(entries)) {
    if (!/\.(xml|hpf|rdf)$/.test(name)) continue;
    const errors = [];
    new DOMParser({ onError: (level, msg) => { if (level !== 'warning') errors.push(msg); } }).parseFromString(strFromU8(data), 'text/xml');
    assert.deepEqual(errors, [], name);
  }
});

test('X3 header — itemCnt = 실제 개수(덧붙인 charPr·borderFill 포함) · secCnt 1', () => {
  const { header } = hwpx([sampleProblem]);
  for (const [tag, item] of [['charProperties', 'charPr'], ['borderFills', 'borderFill'], ['paraProperties', 'paraPr'], ['styles', 'style'], ['tabProperties', 'tabPr']]) {
    const m = new RegExp(`<hh:${tag} itemCnt="(\\d+)">([\\s\\S]*?)</hh:${tag}>`).exec(header);
    assert.ok(m, tag);
    assert.equal(+m[1], (m[2].match(new RegExp(`<hh:${item} `, 'g')) ?? []).length, tag);
  }
  assert.match(header, /secCnt="1"/);
  assert.match(header, /<hh:bold\/>/);                          // 굵게 변형이 덧붙었다(코칭 Tip)
});

test('X4 결정성 · `<hp:t>` 안 날것 탭·제어 문자 없음', () => {
  const a = hwpx([sampleProblem]).bytes;
  const b = hwpx([sampleProblem]).bytes;
  assert.deepEqual(a, b);
  const { section } = hwpx([sampleProblem]);
  for (const m of section.matchAll(/<hp:t(?: [^>]*)?>([\s\S]*?)<\/hp:t>/g)) assert.doesNotMatch(m[1], /[\t\r\n]/);
});

/* ═══ 한글 산출물 모양(G2) ═══ */

test('G1 첫 문단 = secPr+colPr 런 · 문제-본문 · 번호 런(글자 스타일 · 한 자리 탭 1)', () => {
  const { section } = hwpx([single([blk('text', '함수 $f(x)$의 값은? [3점]')])]);
  const p = /<hp:p [^>]*>[\s\S]*?<\/hp:p>/.exec(section.slice(section.indexOf('<hp:p ')))[0];
  assert.match(p, new RegExp(`^<hp:p id="0" paraPrIDRef="${STYLE_IDS.MTQBody.paraPr}" styleIDRef="${STYLE_IDS.MTQBody.id}" pageBreak="0" columnBreak="0" merged="0">`));
  assert.match(p, /<hp:run charPrIDRef="\d+"><hp:secPr [\s\S]*?<\/hp:secPr><hp:ctrl><hp:colPr [^>]*\/><\/hp:ctrl><\/hp:run>/);
  assert.ok(p.includes(`<hp:run charPrIDRef="${STYLE_IDS.MTQNum.charPr}"><hp:t charStyleIDRef="${STYLE_IDS.MTQNum.id}">7.<hp:tab/></hp:t></hp:run>`));
  assert.match(p, /<hp:equation [^>]*version="Equation Version 60"[^>]*baseUnit="1100"[^>]*font="HYhwpEQ">[\s\S]*?<hp:script>f\(x\)<\/hp:script><\/hp:equation><hp:t>의 값은\? \[3점\]<\/hp:t>/);
});

test('G2 두 자리 번호 탭 2 · 번호 없으면 탭만(N15) · 순차 번호', () => {
  assert.ok(hwpx([single([blk('text', '본문')], 'question', '모의 22번')]).section.includes('>22.<hp:tab/><hp:tab/></hp:t>'));
  const none = hwpx([single([blk('text', '본문')], 'question', '번호 없는 제목')]);
  assert.ok(!none.section.includes('charStyleIDRef'));
  assert.match(none.section, /<hp:t><hp:tab\/>본문<\/hp:t>/);
  assert.ok(none.notices.some((n) => n.includes('번호를 찾지 못한')));
  assert.ok(hwpx([single([blk('text', '가')], 'question', 'x'), single([blk('text', '나')], 'question', 'y')], { numbering: 'sequential' }).section.includes('>2.<hp:tab/></hp:t>'));
});

test('G3 글상자 — 자식 순서(템플릿 rect) · 폭 PARA 99% · 높이 3984 · 안 = 상자-항목(마커 + 탭)', () => {
  const { section } = hwpx([single([blk('text', '조건'), blk('gana', R`(가) $a>0$
(나) 짧다`)])]);
  const rect = /<hp:rect [\s\S]*?<\/hp:rect>/.exec(section)[0];
  const order = [...rect.replace(/<hp:drawText[\s\S]*<\/hp:drawText>/, '<hp:drawText/>').matchAll(/<(h[pc]:\w+)[ />]/g)].map((m) => m[1]).slice(1);
  assert.deepEqual(order, ['hp:offset', 'hp:orgSz', 'hp:curSz', 'hp:flip', 'hp:rotationInfo', 'hp:renderingInfo', 'hc:transMatrix', 'hc:scaMatrix', 'hc:rotMatrix',
    'hp:lineShape', 'hp:shadow', 'hp:drawText', 'hc:pt0', 'hc:pt1', 'hc:pt2', 'hc:pt3', 'hp:sz', 'hp:pos', 'hp:outMargin', 'hp:shapeComment']);
  assert.match(rect, /<hp:sz width="9900" widthRelTo="PARA" height="3984"/);
  assert.match(rect, /<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1"/);
  assert.ok(rect.includes(`styleIDRef="${STYLE_IDS.MTBoxItem.id}"`));
  assert.match(rect, /<hp:t>\(가\)<hp:tab\/><\/hp:t>/);
  assert.match(section, /<\/hp:rect><hp:t\/><\/hp:run>/);              // 객체로 끝나는 런엔 빈 <hp:t/>
});

test('G4 그림 — 자식 순서(템플릿 pic) · 원본 px × 75 · 표시 폭 = imageWidthPt', () => {
  const { section } = hwpx([single([blk('text', 'a'), blk('image', '<img src="https://e/x.png">', { imageWidth: 200 })])]);
  const pic = /<hp:pic [\s\S]*?<\/hp:pic>/.exec(section)[0];
  const order = [...pic.matchAll(/<(h[pc]:\w+)[ />]/g)].map((m) => m[1]).slice(1).filter((t) => !/Matrix|pt\d/.test(t));
  assert.deepEqual(order, ['hp:offset', 'hp:orgSz', 'hp:curSz', 'hp:flip', 'hp:rotationInfo', 'hp:renderingInfo', 'hc:img', 'hp:imgRect', 'hp:imgClip', 'hp:inMargin', 'hp:imgDim', 'hp:effects', 'hp:sz', 'hp:pos', 'hp:outMargin']);
  assert.match(pic, /reverse="0"/);
  assert.match(pic, /<hp:orgSz width="30000" height="15000"\/>/);     // 400×200 px
  assert.match(pic, /<hp:sz width="15000" widthRelTo="ABSOLUTE" height="7500"/); // 200px → 150pt → 15000
});

/* ═══ 매핑(§3-3) ═══ */

test('M1 선택지 — 4~5개 한 줄 선지-5 · 긴 항목 3+2 선지-3 두 문단 · 1~3개 선지-3', () => {
  const short = hwpx([single([blk('text', 'a'), blk('choices', '① $1$\n② $2$\n③ $3$\n④ $4$\n⑤ $5$')])]).section;
  assert.equal((short.match(new RegExp(`styleIDRef="${STYLE_IDS.MTQCh5.id}"`, 'g')) ?? []).length, 1);
  assert.match(short, /<hp:t>① <\/hp:t><hp:equation[\s\S]*?<\/hp:equation><hp:t><hp:tab\/>② <\/hp:t>/);
  const long = hwpx([single([blk('text', 'a'), blk('choices', R`① $18+15\sqrt{3}$
② $24+20\sqrt{3}$
③ $30+25\sqrt{3}$
④ $36+30\sqrt{3}$
⑤ $42+35\sqrt{3}$`)])]).section;
  assert.equal((long.match(new RegExp(`styleIDRef="${STYLE_IDS.MTQCh3.id}"`, 'g')) ?? []).length, 2);
  assert.equal(isLongChoices([[{ t: 'text', s: 'ㄱ, ㄴ, ㄷ' }]]), false);
});

test('M2 경우 — 해설-단계1/2 · ( i ) + 탭 · 이어짓기는 선행 탭 · 본문 C1 → ( i ) · 굵게 없음', () => {
  const { section } = hwpx([two([blk('text', '문제')], [
    blk('case', '$x>0$인 경우\n본문'),
    blk('case', '\n이어서 C1을 쓴다.'),
    blk('subcase', '$x=1$일 때\n값'),
  ])]);
  assert.ok(section.includes(`styleIDRef="${STYLE_IDS.MTSStep1.id}"`));
  assert.match(section, /<hp:t>\( i \)<hp:tab\/><\/hp:t>/);
  assert.match(section, /<hp:t>\( i - 1 \)<hp:tab\/><\/hp:t>/);
  assert.match(section, /<hp:t><hp:tab\/>이어서 \( i \)을 쓴다\.<\/hp:t>/);
});

test('M3 행 끝 \\tag·\\ref → ⋯⋯⋯ ㉠ · display는 cdots ×3 + 수식 밖 ㉠ · 수식 안 \\ref → "㉡"', () => {
  const { section } = hwpx([two([blk('text', '문제')], [
    blk('text', '$$\nf(x) = 1 \\tag{1}\n$$\n\n따라서 성립한다. \\tag{2}'),
    blk('text', '식 \\ref{1}과 $\\ref{2}$'),
  ])]);
  assert.match(section, /<hp:script>f\(x\) = 1 cdots cdots cdots<\/hp:script><\/hp:equation><hp:t> ㉠<\/hp:t>/);
  assert.ok(section.includes('따라서 성립한다. ⋯⋯⋯ ㉡'));
  assert.ok(section.includes('식 ㉠과 '));
  assert.ok(section.includes('<hp:script>"㉡"</hp:script>'));
});

test('M4 코칭 = 해설-Tip(두 탭) + Tip 굵은 런 · 들여쓰기(풀이) = 해설-단계2 + 선행 탭 · heading = 해설-제목', () => {
  const { section, header } = hwpx([two([blk('coach_important', '문제 탭 코칭')], [blk('heading', '## STEP 1'), blk('callout', '들여쓴 문단')])]);
  assert.equal((section.match(new RegExp(`styleIDRef="${STYLE_IDS.MTSTip.id}"`, 'g')) ?? []).length, 1);
  assert.match(section, /<hp:t>Tip<\/hp:t><\/hp:run><hp:run charPrIDRef="\d+"><hp:t> 문제 탭 코칭<\/hp:t>/);
  assert.ok(section.includes(`styleIDRef="${STYLE_IDS.MTSH1.id}" pageBreak="0" columnBreak="1"`));
  assert.match(section, new RegExp(`styleIDRef="${STYLE_IDS.MTSStep2.id}"[^>]*><hp:run charPrIDRef="\\d+"><hp:t><hp:tab/>들여쓴 문단</hp:t>`));
  assert.ok(header.length > 0);
});

test('M5 빈칸 \\boxed{\\text{(가)}} → box{"(가)"} · 표 · ggb 자리표시', () => {
  const { section } = hwpx([two([blk('text', '빈칸 $\\boxed{~\\text{(가)}~}$')], [blk('text', '| a | b |\n|---|---|\n| 1 | 2 |'), blk('ggb', 'x')])]);
  assert.ok(section.includes('<hp:script>box{~"(가)"~}</hp:script>'));
  assert.match(section, /<hp:tbl [^>]*rowCnt="2" colCnt="2"/);
  assert.ok(section.includes('[GeoGebra 그래프 — 화면에서 확인]'));
});


test('M6 표 열 폭 = 내용 폭(덕수 2026-10-15 — 단 폭에 꽉 채우지 않는다) · 넘치면 단 폭 90%로 줄인다', () => {
  const { section } = hwpx([single([blk('text', 'a'), blk('text', '| $z$ | $\\mathrm{P}(0 \\le Z \\le z)$ |\n|---|---|\n| $0.5$ | $0.191$ |')])]);
  const widths = [...section.matchAll(/<hp:tc [^>]*>[\s\S]*?<hp:cellSz width="(\d+)"/g)].slice(0, 2).map((m) => +m[1]);
  assert.ok(widths[0] < widths[1], JSON.stringify(widths));
  assert.ok(widths[0] + widths[1] < 31649 * 0.6, `합 ${widths[0] + widths[1]}`);
  const wide = hwpx([single([blk('text', 'a'), blk('text', `| ${'아주 긴 머리 칸 '.repeat(6)} | ${'또 다른 긴 칸 '.repeat(6)} |\n|---|---|\n| 1 | 2 |`)])]).section;
  const ws = [...wide.matchAll(/<hp:cellSz width="(\d+)"/g)].slice(0, 2).map((m) => +m[1]);
  assert.ok(ws[0] + ws[1] <= Math.round(31649 * 0.9), `상한 ${ws}`);
});

test('M7 여러 줄 수식 → 행마다 문단(덕수 2026-10-15) — aligned는 빈칸으로 & 자리 맞춤 · 번호는 마지막 행 · 맨 \\ 행은 왼쪽 맞춤', () => {
  const md = '$$\n\\begin{aligned}\nf(x) &= (x+1)^2 \\\\\n&= x^2+2x+1 \\tag{1}\n\\end{aligned}\n$$';
  const { section } = hwpx([two([blk('text', '문제')], [blk('text', md)])]);
  const eqParas = [...section.matchAll(new RegExp(`<hp:p [^>]*styleIDRef="${STYLE_IDS.MTSEq.id}"[^>]*>[\\s\\S]*?</hp:p>`, 'g'))].map((m) => m[0]);
  assert.equal(eqParas.length, 2);
  const scripts = eqParas.map((l) => /<hp:script>([^<]*)/.exec(l)[1]);
  assert.equal(scripts[0], 'f(x) = (x+1)^2');
  // 둘째 행 앞 공백 폭 ≈ `f(x)` 폭(반 칸 오차)
  const pad = /^([~`]+) = x\^2\+2x\+1 cdots cdots cdots$/.exec(scripts[1]);
  assert.ok(pad, scripts[1]);
  assert.equal(pad[1], hwpPad(hwpEqSize('f(x)').w));
  assert.ok(Math.abs(hwpEqSize(pad[1]).w - hwpEqSize('f(x)').w) <= 0.23 * 1100 / 2 + 1, pad[1]);
  assert.ok(!eqParas[0].includes('㉠') && eqParas[1].includes('㉠'));
  assert.ok(!section.includes('eqalign'));
  // 맨 \\ 행 — 정렬 없이 행마다
  const rows = hwpx([two([blk('text', '$$\na = 1 \\\\\nbb = 22\n$$')], [])]).section;
  assert.deepEqual([...rows.matchAll(/<hp:script>([^<]*)/g)].map((m) => m[1]), ['a = 1', 'bb = 22']);
  // 환경 앞 조각 — 첫 행 앞에 붙고 다음 행은 그 폭만큼 들인다
  const pre = hwpx([two([blk('text', '$$\ny = \\begin{aligned} a \\\\ b \\end{aligned}\n$$')], [])]).section;
  const ps = [...pre.matchAll(/<hp:script>([^<]*)/g)].map((m) => m[1]);
  assert.equal(ps[0], 'y = a');
  assert.equal(ps[1], `${hwpPad(hwpEqSize('y =').w + hwpEqSize('a').w - hwpEqSize('b').w)} b`);
  // 행을 가로지르는 \left\{는 한 수식 그대로(eqalign)
  const whole = hwpx([two([blk('text', '$$\n\\left\\{ \\begin{aligned} a \\\\ b \\end{aligned} \\right.\n$$')], [])]).section;
  assert.match(whole, /<hp:script>left lbrace eqalign\{a # b\} right none<\/hp:script>/);
});

/* ═══ 배치 ═══ */

test('B1 옵션 A — 둘째 문항 쪽 나눔 · 풀이 첫 문단 단 나눔 · 풀이가 비면 단 나눔 없음(G11)', () => {
  const { section } = hwpx([two([blk('text', '문제1')], [blk('text', '풀이1')], '1번'), two([blk('text', '문제2')], [], '2번')]);
  const ps = [...section.matchAll(/<hp:p id="0" [^>]*>/g)].map((m) => m[0]);
  assert.equal(ps.filter((p) => p.includes('pageBreak="1"')).length, 1);
  assert.equal(ps.filter((p) => p.includes('columnBreak="1"')).length, 1);
});

test('B2 옵션 B — 문항마다 단 나눔 · 미주는 [N점] 문단 끝 · 미주 첫 문단 "N번" + autoNum · 끝 쪽 나눔', () => {
  const { section } = hwpx([
    two([blk('text', '문제1 [3점]'), blk('choices', '① 1\n② 2\n③ 3\n④ 4\n⑤ 5')], [blk('text', '풀이1')], '1번'),
    two([blk('text', '문제2')], [blk('text', '풀이2')], '2번'),
  ], { placement: 'endnote' });
  assert.match(section, /\[3점\]<\/hp:t><hp:ctrl><hp:endNote number="1" suffixChar="41"/);
  assert.match(section, /<hp:endNote number="1"[\s\S]*?<hp:ctrl><hp:autoNum num="1" numType="ENDNOTE">[\s\S]*?<hp:t>1번<\/hp:t>/);
  assert.match(section, /<hp:endNote number="2"/);
  const top = section.replace(/<hp:endNote[\s\S]*?<\/hp:endNote>/g, '');
  const ps = [...top.matchAll(/<hp:p id="0" [^>]*>/g)].map((m) => m[0]);
  assert.equal(ps.filter((p) => p.includes('columnBreak="1"')).length, 1);
  assert.ok(ps[ps.length - 1].includes('pageBreak="1"'));
});

test('B3 endnoteAnchor — [N점] 없으면 선택지 아닌 마지막 문단', () => {
  const p = (style, s) => ({ style, paraPr: 0, runs: [{ charPr: 0, items: [{ k: 'text', s }] }] });
  assert.equal(endnoteAnchor([p(1, '본문'), p(2, '이어서'), p(STYLE_IDS.MTQCh5.id, '① 1')]), 1);
  assert.equal(endnoteAnchor([p(1, '본문 [4점]'), p(2, '그림 아래')]), 0);
});

/* ═══ 순수 함수 ═══ */

test('U1 problemNumber — 끝 번호 1~30 · 끝의 "번" 허용(N14)', () => {
  assert.equal(problemNumber('X16(260918)_1공통13'), 13);
  assert.equal(problemNumber('MOBI.26FS01.22번'), 22);
  assert.equal(problemNumber('26K32_1공통03'), 3);
  assert.equal(problemNumber('2026'), null);
  assert.equal(problemNumber('문항 31'), null);
  assert.equal(problemNumber('강대모의X14(260903)'), null);
});

test('U2 imageSize — PNG IHDR · JPEG SOF', () => {
  const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47], 0); png.set([0, 0, 2, 0x12], 16); png.set([0, 0, 0, 0x64], 20);
  assert.deepEqual(imageSize(png), { w: 530, h: 100 });
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 0x32, 0, 0x64, 3, 0, 0, 0]);
  assert.deepEqual(imageSize(jpg), { w: 100, h: 50 });
});


test('E1 수식 크기 = 한글 규칙 모델 — 한글 실측 40개(덕수 2026-10-15)를 폭 RMS 3% · 위아래 0.06em 안에서 재현', () => {
  let sw = 0;
  for (const c of CAL) {
    const A = (c.h * c.base) / 100 / 1100;
    const b = layoutHwp(c.script);
    const rw = (b.w - c.w / 1100) / (c.w / 1100);
    sw += rw * rw;
    assert.ok(Math.abs(rw) < 0.08, `폭 ${c.script} ${(rw * 100).toFixed(1)}%`);
    assert.ok(Math.abs(b.a - A) < 0.06, `위 ${c.script} ${(b.a - A).toFixed(3)}`);
    assert.ok(Math.abs(b.d - (c.h / 1100 - A)) < 0.06, `아래 ${c.script}`);
  }
  assert.ok(Math.sqrt(sw / CAL.length) < 0.03, `폭 RMS ${Math.sqrt(sw / CAL.length)}`);
});

test('E2 sz·baseLine이 모델 값으로 들어간다 · 옛 자리값(2.5em) 없음', () => {
  const { section } = hwpx([single([blk('text', '값 $1$ 과 $\\frac{1}{2}$')])]);
  const sz = [...section.matchAll(/<hp:equation [^>]*baseLine="(\d+)"[^>]*><hp:sz width="(\d+)" widthRelTo="ABSOLUTE" height="(\d+)"/g)].map((m) => m.slice(1).map(Number));
  assert.deepEqual(sz.map(([base, w, h]) => ({ w, h, base })), [hwpEqSize('1'), hwpEqSize('{1} over {2}')]);
  const half = hwpEqSize('{1} over {2}');                                         // 한글 실측 1100 × 2580 · 65
  assert.ok(Math.abs(half.w - 1100) / 1100 < 0.03 && Math.abs(half.h - 2580) < 30 && half.base === 65, JSON.stringify(half));
  assert.ok(!section.includes('height="2750"'));
});

/* ═══ 스냅샷 ═══ */

test('S1 표본 스냅샷(section0 · 옵션 A · 제목 번호)', () => {
  const { section } = hwpx([sampleProblem]);
  const pretty = section.replace(/(<hp:p )/g, '\n$1');
  if (process.env.EXPORT_SNAPSHOT_UPDATE === '1' || !existsSync(SNAP)) writeFileSync(SNAP, pretty);
  assert.equal(pretty, readFileSync(SNAP, 'utf8'));
});
