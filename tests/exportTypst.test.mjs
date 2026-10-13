/**
 * Phase 70 — Typst 직렬화기(typst.ts) 검증. **실제로 컴파일한다**(Q19 — `@myriaddreamin/typst-ts-node-compiler`
 * 0.7.0 = 브라우저 typst.ts와 같은 Typst 0.14.2 · mitex는 벤더링한 0.2.7 배포판).
 *
 * 실행: npm run test:exporttypst
 * 스냅샷 갱신: EXPORT_SNAPSHOT_UPDATE=1 npm run test:exporttypst  (갱신 뒤 diff를 사람이 읽을 것)
 *
 * ⚠ "컴파일 OK"는 모양을 보증하지 않는다(v4 J1 — 가운데로 선 display). 정렬·간격은 P0-8′·실물 ⑧~⑩이 본다.
 *   여기서는 ① 진단 0 ② 이스케이프가 원문 글자 그대로 나오는지(query) ③ 실패 수식 격리(D28)를 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

import { buildExportDoc } from '../.test-build/lib/export/ir.js';
import { serializeTypst, escTyp, typStr, quadCases, normalizeEnvsForMitex } from '../.test-build/lib/export/typst.js';
import { ROW_ENVS } from '../.test-build/lib/mathInput.js';
import { sampleProblem } from './fixtures/export/sampleProblem.mjs';
import { ensureExportFonts } from './helpers/exportFonts.mjs';

const require = createRequire(import.meta.url);
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
const parse = (md) => processor.parse(md);
const R = String.raw;
const ROOT = new URL('../', import.meta.url).pathname;
const MITEX = '/public/typst/packages/preview/mitex/0.2.7/lib.typ';

// 1×1 PNG(테스트 그림)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
mkdirSync(ROOT + '.test-build/export-fig', { recursive: true });
writeFileSync(ROOT + '.test-build/export-fig/fig.png', PNG);
const figurePath = () => '/.test-build/export-fig/fig.png';

const fonts = await ensureExportFonts();
const compiler = NodeCompiler.create({ workspace: ROOT, fontArgs: fonts.dir ? [{ fontPaths: [fonts.dir] }] : [] });

function typ(input, opts = {}) {
  return serializeTypst(buildExportDoc(input, { parse }), { figurePath, mitexImport: MITEX, ...opts });
}
function compile(source) {
  compiler.evictCache(10);
  const r = compiler.compile({ mainFileContent: source });
  const diags = (r.takeDiagnostics()?.shortDiagnostics ?? []).filter((d) => d.severity === 1 || d.severity === 'error');
  return { doc: r.result, errors: diags.map((d) => d.message) };
}
function plain(nodes) {
  let s = '';
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.func === 'text' || n.func === 'symbol') s += n.text;
    else if (n.func === 'space') s += ' ';
    for (const k of ['children', 'body', 'child']) if (n[k]) walk(n[k]);
  })(nodes);
  return s;
}
const skipNoFonts = fonts.dir ? false : `글꼴을 받지 못해 컴파일 검사를 건너뛴다 — ${fonts.reason}`;

test('Y1 이스케이프 — ASCII 문장부호·단축 표기·주석·행머리 목록이 원문 글자 그대로 나온다', () => {
  const samples = [
    R`a\b #c $d *e* _f_ `+'`g`'+R` <h> @i [j] ~k /l =m -n +o 'p' "q" {r} s.t u:v`,
    'http://a.b/c -- d --- e ... f -? g // h /* i */',
    '1. 번호처럼 보이는 줄',
    '- 목록처럼',
    '= 제목처럼',
    '/ 용어: 정의',
  ];
  const src = samples.map((s, i) => `#[${escTyp(s)}] <s${i}>`).join('\n\n');
  const { doc, errors } = compile(src);
  assert.deepEqual(errors, []);
  samples.forEach((s, i) => {
    assert.equal(plain(compiler.query(doc, { selector: `<s${i}>` })), s.replace(/\s+/g, ' '), `표본 ${i}`);
  });
});

test('Y2 문자열 리터럴 — 백슬래시·따옴표·줄바꿈', () => {
  assert.equal(typStr('a\\b"c\nd'), '"a\\\\b\\"c\\nd"');
});

test('Y3 D32 cases 깊이 0 & 앞 \\quad · 중첩 aligned·중괄호·\\&는 그대로', () => {
  assert.equal(quadCases(R`\begin{cases} a & b \\ c & d \end{cases}`), R`\begin{cases} a \quad & b \\ c \quad & d \end{cases}`);
  assert.equal(quadCases(R`\begin{dcases} x & y \end{dcases}`), R`\begin{dcases} x \quad & y \end{dcases}`);
  assert.equal(quadCases(R`\begin{aligned} a &= b \end{aligned}`), R`\begin{aligned} a &= b \end{aligned}`);
  assert.equal(quadCases(R`\begin{cases} \begin{aligned} p &= q \end{aligned} & r \end{cases}`),
    R`\begin{cases} \begin{aligned} p &= q \end{aligned} \quad & r \end{cases}`);
  assert.equal(quadCases(R`\begin{cases} \text{a\&b} & {c & d} \end{cases}`), R`\begin{cases} \text{a\&b} \quad & {c & d} \end{cases}`);
});

test('Y4 인라인 \\displaystyle 주입(D9) · 한 줄 $$x$$는 그대로 · 인라인 식 끝 ;(뒤 괄호를 호출로 읽지 않는다)', { skip: skipNoFonts }, () => {
  const { source } = typ({ title: 't', tabs: [{ id: 'question', label: '문제', blocks: [{ id: 'b', type: 'text', raw_text: '값 $x$(가)와 $$y$$.' }] }] });
  assert.ok(source.includes(R`#mi("\\displaystyle x");(가)와 #mi("y");\.`));
  assert.deepEqual(compile(source).errors, [], '`;`가 없으면 (가)가 mi(...)(가) 호출로 읽혀 실패한다');
});

test('Y5 결정성 + 표본 스냅샷', () => {
  const a = typ(sampleProblem).source;
  assert.equal(a, typ(sampleProblem).source);
  const snap = new URL('./fixtures/export/sampleProblem.expected.typ', import.meta.url);
  if (process.env.EXPORT_SNAPSHOT_UPDATE === '1' || !existsSync(snap)) { writeFileSync(snap, a); return; }
  assert.equal(a, readFileSync(snap, 'utf8'), '스냅샷과 다르다 — 의도한 변경이면 EXPORT_SNAPSHOT_UPDATE=1로 갱신 후 diff를 읽을 것');
});

test('Y6 표본 문항 실제 컴파일 — 진단 오류 0', { skip: skipNoFonts }, () => {
  const { errors, doc } = compile(typ(sampleProblem).source);
  assert.deepEqual(errors, []);
  assert.ok(doc);
  const pdf = compiler.pdf(doc);
  assert.ok(pdf.length > 1000);
  writeFileSync(ROOT + '.test-build/export-sample.pdf', pdf);   // 사람이 열어 보는 용(gitignore)
});

test('Y7 D28 실패 수식 격리 — 미지원 명령 하나가 문서 전체를 죽이고, failedMath면 그 수식만 상자로', { skip: skipNoFonts }, () => {
  const input = { title: 't', tabs: [{ id: 'question', label: '문제', blocks: [
    { id: 'a', type: 'text', raw_text: R`정상 $x^2$ 그리고 $\textcircled{1}$ 끝` },
  ] }] };
  const first = typ(input);
  const broken = compile(first.source);
  assert.ok(broken.errors.some((m) => /textcircled/.test(m)), '미지원 명령은 문서 전체 실패');
  assert.deepEqual(first.formulas.map((f) => f.id), ['m1', 'm2']);
  const bad = first.formulas.find((f) => f.latex.includes('textcircled'));
  const fixed = typ(input, { failedMath: new Set([bad.id]) });
  assert.ok(fixed.source.includes('#math-fail('));
  assert.ok(fixed.source.includes(R`#mi("\\displaystyle x^2");`), '정상 수식은 그대로');
  assert.deepEqual(compile(fixed.source).errors, []);
});

test('Y8 그림 경로가 없으면 자리 상자 · ggb·graph 자리 상자', () => {
  const { source } = serializeTypst(buildExportDoc(sampleProblem, { parse }), { figurePath: () => null, mitexImport: MITEX });
  assert.ok(source.includes('#ph-box[그림을 불러오지 못했습니다]'));
  assert.ok(source.includes('#ph-box[GeoGebra — 화면에서 확인]'));
  assert.ok(source.includes('#ph-box[그래프 — 화면에서 확인]'));
});

test('Y9 Mathory 행 환경(ROW_ENVS) 전부가 mitex를 통과한다 — 모르는 13종은 동치 환경으로(Stage 0)', { skip: skipNoFonts }, () => {
  const arg = (e) => (/^(alignedat|alignat\*?)$/.test(e) ? '{2}' : /^d?array$/.test(e) ? '{ll}' : /matrix\*$/.test(e) ? '[r]' : '');
  const blocks = ROW_ENVS.map((e, i) => ({ id: `e${i}`, type: 'text', raw_text: `$$\n\\begin{${e}}${arg(e)} a & b \\\\ c & d \\end{${e}}\n$$` }));
  const out = typ({ title: 't', tabs: [{ id: 'question', label: '문제', blocks }] });
  assert.equal(out.formulas.length, ROW_ENVS.length);
  const { errors } = compile(out.source);
  assert.deepEqual(errors, []);
  assert.equal(normalizeEnvsForMitex(R`\begin{Vmatrix} a \end{Vmatrix}`), R`\left\| \begin{matrix} a \end{matrix} \right\|`);
  assert.equal(normalizeEnvsForMitex(R`\begin{pmatrix*}[r] 1 \end{pmatrix*}`), R`\begin{pmatrix} 1 \end{pmatrix}`);
});

test('Y10 빈 수식·빈 행 — 문서 전체를 죽이지 않는다(Stage 0 덤프 실측)', { skip: skipNoFonts }, () => {
  const out = typ({ title: 't', tabs: [{ id: 'question', label: '문제', blocks: [
    { id: 'a', type: 'text', raw_text: '빈 인라인 $ $ 와 정상 $x$' },
    { id: 'b', type: 'text', raw_text: '$$\na = 1 \\\\\\\\\nb = 2\n$$' },
    { id: 'c', type: 'text', raw_text: '$$\n\\tag{3}\n$$' },
  ] }] });
  assert.ok(!out.source.includes('#mi("\\\\displaystyle ");'), '빈 인라인은 내지 않는다');
  assert.ok(out.source.includes(R`\\displaystyle {}`), '빈 행은 {}');
  assert.deepEqual(compile(out.source).errors, []);
});
