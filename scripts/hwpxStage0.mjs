#!/usr/bin/env node
/**
 * Phase 71 G10 — Stage 0 시험 파일(덕수가 한글 2022에서 연다). 변환기 없이 뼈대 + 손짠 문단으로 만든다.
 *
 *   node scripts/hwpxStage0.mjs        → docs/phaseSketch/phase71-stage0/*.hwpx (로컬 작업물 — 커밋하지 않는다)
 *
 * S1-A/B/C : 덮어쓰기 매칭 키(S-1) · 굵은 글씨의 추종(S-12)
 * S-구조   : 글상자 높이(S-3) · 마커·라벨 뒤 탭(S-5′) · 선지 탭(S-6) · 표 · 그림 · ⋯⋯⋯ ㉠ · 미주 미리보기
 * S-최소   : S-구조에서 rect·pic의 renderingInfo·curSz, 수식 shapeComment를 뺀 판(S-10′ 이분)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npx', ['tsc', 'lib/export/hwpx/package.ts', 'lib/export/hwpx/xml.ts', 'lib/export/hwpx/zip.ts', 'lib/export/hwpx/skeleton/parts.ts', 'lib/export/hwpx/skeleton/ids.ts',
  '--outDir', '.test-build', '--rootDir', '.', '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck'], { cwd: ROOT, stdio: 'inherit' });
const B = (p) => import(join(ROOT, '.test-build/lib/export/hwpx', p));
const { buildPackage } = await B('package.js');
const { HeaderBuilder, Ids } = await B('xml.js');
const P = await B('skeleton/parts.js');
const { STYLE_IDS: S, PAGE } = await B('skeleton/ids.js');

const OUT = join(ROOT, 'docs/phaseSketch/phase71-stage0');
mkdirSync(OUT, { recursive: true });

/* ═══ 공통 조각 ═══ */
const T = (s) => ({ k: 'text', s });
const TAB = { k: 'tab' };
const EQ = (script) => ({ k: 'eq', script });
const run = (charPr, ...items) => ({ charPr, items });
const para = (key, runs, extra = {}) => ({ style: S[key].id, paraPr: S[key].paraPr, runs, ...extra });
const first = (p) => ({ ...p, secPr: P.SEC_PR });

function write(name, header, paras, bins = [], prv = '') {
  const bytes = buildPackage({ title: name, header, paras, bins, prvText: prv || name });
  writeFileSync(join(OUT, `${name}.hwpx`), bytes);
  console.log(`  ${name}.hwpx  ${bytes.length} B`);
}

/* ═══ S-1 · S-12 — 문제-본문 스타일에 전용 글자 모양을 준다 ═══ */
function withBodyStyle({ name, engName, color, height }) {
  let h = P.HEADER_XML;
  const base = S.MTQBody.charPr;
  const m = new RegExp(`<hh:charPr id="${base}"([^>]*)>([\\s\\S]*?)</hh:charPr>`).exec(h);
  const nid = Math.max(...[...h.matchAll(/<hh:charPr id="(\d+)"/g)].map((x) => +x[1])) + 1;
  const attrs = m[1].replace(/textColor="[^"]*"/, `textColor="${color}"`).replace(/height="\d+"/, `height="${height}"`);
  h = h.replace(/<hh:charProperties itemCnt="(\d+)">([\s\S]*?)<\/hh:charProperties>/, (_, n, inner) =>
    `<hh:charProperties itemCnt="${+n + 1}">${inner}<hh:charPr id="${nid}"${attrs}>${m[2]}</hh:charPr></hh:charProperties>`);
  h = h.replace(/<hh:style id="(\d+)" type="PARA" name="문제-본문" engName="[^"]*" paraPrIDRef="(\d+)" charPrIDRef="\d+"/,
    (_, id, pp) => `<hh:style id="${id}" type="PARA" name="${name}" engName="${engName}" paraPrIDRef="${pp}" charPrIDRef="${nid}"`);
  return { header: h, charPr: nid };
}

console.log('[hwpxStage0] →', OUT);
{
  const a = withBodyStyle({ name: '문제-본문', engName: 'MTQBody', color: '#FF0000', height: 1150 });
  const hb = new HeaderBuilder(a.header);
  const bold = hb.charPr(a.charPr, { bold: true });
  write('S1-A-기준(빨강)', hb.xml(), [
    first(para('MTQBody', [run(a.charPr, T('S-1·S-12 기준 문서 A — 이 문단은 "문제-본문" 스타일이고 글자가 빨강 11.5pt입니다. '), ), run(bold, T('이 부분은 굵은 글씨(변환기가 덧붙인 굵게 변형)')), run(a.charPr, T(' — 그 뒤 보통 글씨.'))])),
    para('MTQBody', [run(a.charPr, T('둘째 문단 — 같은 스타일. 수식 '), EQ('{1} over {2}'), T(' 도 하나 있습니다.'))]),
  ]);
  const b = withBodyStyle({ name: '문제-본문', engName: 'XOther', color: '#0000FF', height: 1400 });
  write('S1-B-같은한글이름(파랑14pt)', b.header, [first(para('MTQBody', [run(b.charPr, T('문서 B — 한글 이름 "문제-본문"은 A와 같고 영문 이름은 XOther(다름). 파랑 14pt.'))]))]);
  const c = withBodyStyle({ name: '다른이름', engName: 'MTQBody', color: '#008000', height: 1150 });
  write('S1-C-같은영문이름(초록)', c.header, [first(para('MTQBody', [run(c.charPr, T('문서 C — 한글 이름은 "다른이름", 영문 이름은 MTQBody(A와 같음). 초록.'))]))]);
}

/* ═══ S-구조 ═══ */
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3;
    const v = (x + y) % 20 < 10 ? 60 : 200;
    raw[o] = v; raw[o + 1] = v; raw[o + 2] = v;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

function structure() {
  const hb = new HeaderBuilder(P.HEADER_XML);
  const c = (k) => S[k].charPr;
  const boldQ = hb.charPr(c('MTQCont'), { bold: true });
  const num = (n) => ({ charPr: S.MTQNum.charPr, charStyle: S.MTQNum.id, items: [T(`${n}.`), TAB, ...(n >= 10 ? [TAB] : [])] });
  const colW = PAGE.colWidth;
  const boxW = Math.round((colW - 1150) * 0.99);
  const cell = (s) => [para('Normal', [run(c('Normal'), T(s))])];
  const paras = [
    first(para('MTQBody', [num(1), run(c('MTQBody'), T('한 자리 번호 — "1." 뒤 탭 하나(본문 1700). 문장이 길어 둘째 줄로 넘어가면 내어쓰기 위치에서 시작해야 합니다. 함수 '), EQ('f LEFT ( x RIGHT ) = x ^{2} - 2x'), T(' 에 대하여 값은? [2점]'))])),
    para('MTQCh5', [run(c('MTQCh5'), T('① '), EQ('1'), TAB, T('② '), EQ('2'), TAB, T('③ '), EQ('3'), TAB, T('④ '), EQ('4'), TAB, T('⑤ '), EQ('5'))]),
    para('MTQBody', [num(12), run(c('MTQBody'), T('두 자리 번호 — "12." 뒤 탭 둘(본문 2551). 다음 식이 성립한다.'))], { columnBreak: true }),
    para('MTQEq', [run(c('MTQEq'), EQ('a _{n+1} = {cases{a _{n} -3 & ( a _{n} > 0 ) # {1} over {2} a _{n} & ( a _{n} <= 0 )}}'))]),
    para('MTQCont', [run(c('MTQCont'), T('글상자(S-3) — 아래 상자는 높이 3984로 넣었습니다. 내용에 맞게 늘어나야 합니다.')), ]),
    para('MTQCont', [run(c('MTQCont'), { k: 'rect', width: boxW, paras: [
      para('MTBoxItem', [run(c('MTBoxItem'), T('(가)'), TAB, T('함수 '), EQ('g LEFT ( x RIGHT )'), T('는 실수 전체의 집합에서 미분가능하고, 이 문장은 일부러 길게 써서 둘째 줄이 내어쓰기 위치에 서는지 봅니다.'))]),
      para('MTBoxItem', [run(c('MTBoxItem'), T('(나)'), TAB, T('짧은 항목'))]),
      para('MTBoxText', [run(c('MTBoxText'), T('상자-글 — 마커 없는 일반 문단.'))]),
    ] })]),
    para('MTQCont', [run(c('MTQCont'), T('의 값은? [4점]'))]),
    para('MTQCh3', [run(c('MTQCh3'), T('① '), EQ('18+15 sqrt {3}'), TAB, T('② '), EQ('24+20 sqrt {3}'), TAB, T('③ '), EQ('30+25 sqrt {3}'))]),
    para('MTQCh3', [run(c('MTQCh3'), T('④ '), EQ('36+30 sqrt {3}'), TAB, T('⑤ '), EQ('42+35 sqrt {3}'))]),
    para('MTSH1', [run(c('MTSH1'), T('해설-제목 — STEP 1'))], { columnBreak: true }),
    para('MTSBody', [run(c('MTSBody'), T('해설-본문 문단. 인용은 ㉠처럼, 행 끝 번호는 ⋯⋯⋯ ㉠ 으로 냅니다. ⋯⋯⋯ ㉠'))]),
    para('MTSEq', [run(c('MTSEq'), EQ('f LEFT ( 1 RIGHT ) = 3 cdots cdots cdots'), T(' ㉠'))]),
    para('MTSStep1', [run(c('MTSStep1'), T('( i )'), TAB, T('해설-단계1 제목행 — 라벨 뒤 탭이 내어쓰기 위치(왼쪽 1200 + 2340)에 서야 하고, 줄이 넘어가면 같은 세로선에서 이어져야 합니다.'))]),
    para('MTSStep1', [run(c('MTSStep1'), TAB, T('라벨 없는 본문 문단 — 선행 탭 하나로 위 제목행 본문과 같은 세로선에 서야 합니다. 길게 써서 둘째 줄도 봅니다.'))]),
    para('MTSStep1', [run(c('MTSStep1'), T('ㄱ.'), TAB, T('마커 문단 — ㄱ. 뒤 탭.'))]),
    para('MTSStep2', [run(c('MTSStep2'), T('( i - 1 )'), TAB, T('해설-단계2 하위 경우 — 라벨이 넓어도 본문이 같은 세로선(2400 + 3800)에 서야 합니다.'))]),
    para('MTSStep2', [run(c('MTSStep2'), TAB, T('해설-단계2 라벨 없는 본문.'))]),
    para('MTSTip', [run(hb.charPr(c('MTSTip'), { bold: true }), T('Tip')), run(c('MTSTip'), T(' 해설-Tip 코칭 문단.'))]),
    para('MTSBody', [run(c('MTSBody'), T('표:'))]),
    para('MTSBody', [run(c('MTSBody'), { k: 'tbl', headRows: 1, outerFill: hb.borderFill('outer'), cellFill: hb.borderFill('cell'), colWidths: [9000, 9000, 9000],
      rows: [[cell('x'), cell('0'), cell('1')], [cell('f(x)'), cell('3'), cell('5')]] })]),
    para('MTFig', [run(c('MTFig'), { k: 'pic', bin: 'image1', pxW: 200, pxH: 100, width: 200 * 75, height: 100 * 75 })]),
    para('MTSBody', [run(boldQ, T('굵은 런(문제-이음 굵게 변형)')), run(c('MTSBody'), T(' 미주 시험 — 이 문단 끝에 미주가 붙습니다. [4점]'),
      { k: 'endnote', num: 1, paras: [para('MTSH1', [run(c('MTSH1'), T('1번'))]), para('MTSBody', [run(c('MTSBody'), T('미주 본문 — 해설-본문. 수식 '), EQ('x=1'))])] })]),
  ];
  return { header: hb.xml(), paras };
}

{
  const { header, paras } = structure();
  const bins = [{ id: 'image1', ext: 'png', data: png(200, 100) }];
  write('S-구조', header, paras, bins, '1. 한 자리 번호');
  // S-10′ — rect·pic의 renderingInfo·curSz와 수식 shapeComment를 뺀 판
  const { buildPackage: bp } = await B('package.js');
  const { sectionXml } = await B('package.js');
  const ids = new Ids();
  let sec = sectionXml(paras, ids)
    .replace(/<hp:renderingInfo>[\s\S]*?<\/hp:renderingInfo>/g, '')
    .replace(/<hp:curSz [^>]*\/>/g, '')
    .replace(/<hp:shapeComment>수식입니다\.<\/hp:shapeComment>/g, '');
  const { zipHwpx } = await B('zip.js');
  const { contentHpf, previewText } = await B('package.js');
  writeFileSync(join(OUT, 'S-최소.hwpx'), zipHwpx([
    ['mimetype', 'application/hwp+zip'], ['version.xml', P.VERSION_XML], ['Contents/header.xml', header], ['Contents/masterpage0.xml', P.MASTERPAGE_XML],
    ['BinData/image1.png', bins[0].data], ['Contents/section0.xml', sec], ['Preview/PrvText.txt', previewText('S-최소')], ['settings.xml', P.SETTINGS_XML],
    ['META-INF/container.rdf', P.CONTAINER_RDF], ['Contents/content.hpf', contentHpf('S-최소', bins)], ['META-INF/container.xml', P.CONTAINER_XML], ['META-INF/manifest.xml', P.MANIFEST_XML],
  ]));
  console.log('  S-최소.hwpx');
  void bp;
}
