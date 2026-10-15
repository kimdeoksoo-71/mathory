#!/usr/bin/env node
/**
 * Phase 71 T2″·G1 — 템플릿 hwpx → 변환기 뼈대(lib/export/hwpx/skeleton/).
 *
 *   node scripts/hwpxSkeleton.mjs [템플릿.hwpx]                   (기본 docs/phasedocs/Mathory_tmp.hwpx)
 *   node scripts/hwpxSkeleton.mjs --scrub <원본.hwpx> <출력.hwpx>  (N7′ — 커밋 전 개인 정보 제거)
 *   node scripts/hwpxSkeleton.mjs --check [템플릿.hwpx]          (커밋된 뼈대 = 템플릿 추출 결과인지 — test:exporthwpxstyles)
 *
 * 뼈대 = header · masterpage0 · settings · version · META-INF 3종 · content.hpf 머리 · section0의 secPr+colPr.
 * 스타일 id·paraPr·charPr는 **한글 이름으로 찾아** ids.ts에 낸다(id 하드코딩 금지 — 템플릿을 고치면 재배열된다).
 * 필수 이름 목록은 lib/export/hwpx/styles.ts의 `name: '…'` 줄에서 읽는다(사본을 두지 않는다).
 *
 * ⚠ 템플릿을 한글에서 다시 저장하면 lastsaveby가 되살아난다 → 커밋 전 반드시 --scrub.
 * ⚠ 생성 파일(skeleton/*.ts)을 손으로 고치지 말 것 — 이 스크립트를 다시 돌린다.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'lib/export/hwpx/skeleton');
const DEFAULT_TEMPLATE = join(ROOT, 'docs/phasedocs/Mathory_tmp.hwpx');
/** 한글이 저장하는 값과 같게(1980-01-01 로컬 — fflate는 로컬 시각 getter를 쓴다) */
export const ZIP_MTIME = new Date(1980, 0, 1);
const STORED = (name) => name === 'mimetype' || name === 'version.xml' || /\.(png|jpe?g|gif|bmp)$/i.test(name);

function fail(msg) {
  console.error(`[hwpxSkeleton] ✖ ${msg}`);
  process.exit(1);
}

function readZip(path) {
  const entries = unzipSync(new Uint8Array(readFileSync(path)));
  const names = Object.keys(entries);
  if (names[0] !== 'mimetype') fail(`첫 항목이 mimetype이 아니다: ${names[0]}`);
  return entries;
}

function writeZip(entries, path) {
  const input = {};
  for (const [name, data] of Object.entries(entries)) input[name] = [data, { level: STORED(name) ? 0 : 6, mtime: ZIP_MTIME }];
  writeFileSync(path, zipSync(input, { mtime: ZIP_MTIME }));
}

/** content.hpf 메타데이터의 개인 정보·날짜를 비운다 */
export function scrubHpf(xml) {
  return xml
    .replace(/<opf:title>[^<]*<\/opf:title>/, '<opf:title/>')
    .replace(/(<opf:meta name="(?:creator|lastsaveby|CreatedDate|ModifiedDate|date)" content="text")>[^<]*<\/opf:meta>/g, '$1/>');
}

const PERSONAL_RE = /kimdeoksoo|deoksoo|@gmail|백승우/i;

if (process.argv[2] === '--scrub') {
  const [, , , src, dst] = process.argv;
  if (!src || !dst) fail('사용법: --scrub <원본.hwpx> <출력.hwpx>');
  const entries = readZip(src);
  entries['Contents/content.hpf'] = strToU8(scrubHpf(strFromU8(entries['Contents/content.hpf'])));
  for (const [name, data] of Object.entries(entries)) {
    if (/\.(xml|hpf|rdf|txt)$/.test(name) && PERSONAL_RE.test(strFromU8(data))) fail(`스크럽 뒤에도 개인 정보 패턴이 남았다: ${name}`);
  }
  writeZip(entries, dst);
  console.log(`[hwpxSkeleton] 스크럽 → ${dst}`);
  process.exit(0);
}

const CHECK = process.argv[2] === '--check';
const templatePath = resolve((CHECK ? process.argv[3] : process.argv[2]) ?? DEFAULT_TEMPLATE);
const entries = readZip(templatePath);
const text = (name) => {
  const d = entries[name];
  if (!d) fail(`템플릿에 ${name}이 없다`);
  return strFromU8(d);
};

/* ═══ 스타일 — 이름으로 찾는다 ═══ */
const stylesTs = readFileSync(join(ROOT, 'lib/export/hwpx/styles.ts'), 'utf8');
const wanted = [...stylesTs.matchAll(/\{ key: '([A-Za-z0-9]+)', name: '([^']+)', kind: '(PARA|CHAR)'/g)].map((m) => ({ key: m[1], name: m[2], kind: m[3] }));
if (wanted.length !== 16) fail(`styles.ts에서 스타일 16개를 읽지 못했다(${wanted.length})`);

let header = text('Contents/header.xml');
const styleTags = [...header.matchAll(/<hh:style ([^>]*?)\/>/g)].map((m) => {
  const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
  return { raw: m[0], a };
});
const styleIds = {};
for (const w of wanted) {
  const hit = styleTags.find((s) => s.a.name === w.name);
  if (!hit) fail(`템플릿에 스타일 "${w.name}"이 없다(styles.ts ${w.key})`);
  if (hit.a.type !== w.kind) fail(`"${w.name}" 종류가 다르다: 템플릿 ${hit.a.type} · styles.ts ${w.kind}`);
  if (hit.a.engName === '') {
    header = header.replace(hit.raw, hit.raw.replace('engName=""', `engName="${w.key}"`));
    console.log(`[hwpxSkeleton] engName 채움: ${w.name} → ${w.key}`);
  } else if (hit.a.engName !== w.key) {
    fail(`"${w.name}"의 영문 이름이 다르다: 템플릿 ${hit.a.engName} · styles.ts ${w.key}`);
  }
  styleIds[w.key] = { id: +hit.a.id, name: w.name, paraPr: +hit.a.paraPrIDRef, charPr: +hit.a.charPrIDRef };
}

const secCnt = /<hh:head [^>]*secCnt="(\d+)"/.exec(header)?.[1];
if (secCnt !== '1') fail(`secCnt가 1이 아니다(${secCnt}) — 템플릿은 구역 하나여야 한다`);
const itemCnt = Object.fromEntries([...header.matchAll(/<hh:(\w+) itemCnt="(\d+)"/g)].map((m) => [m[1], +m[2]]));
const maxId = (tag) => Math.max(...[...header.matchAll(new RegExp(`<hh:${tag} id="(\\d+)"`, 'g'))].map((m) => +m[1]));

/* ═══ section0 — secPr + colPr 런 ═══ */
const section = text('Contents/section0.xml');
const secOpen = /^[\s\S]*?<hs:sec [^>]*>/.exec(section)?.[0];
const secPr = /<hp:secPr [\s\S]*?<\/hp:secPr>/.exec(section)?.[0];
const colPr = /<hp:ctrl><hp:colPr [^>]*\/><\/hp:ctrl>/.exec(section)?.[0];
if (!secOpen || !secPr || !colPr) fail('section0에서 secPr·colPr를 찾지 못했다');
const num = (re, src = secPr) => { const m = re.exec(src); if (!m) fail(`쪽 설정 값 없음: ${re}`); return +m[1]; };
const page = {
  width: num(/<hp:pagePr [^>]*width="(\d+)"/),
  height: num(/<hp:pagePr [^>]*height="(\d+)"/),
  left: num(/<hp:margin [^>]*left="(\d+)"/),
  right: num(/<hp:margin [^>]*right="(\d+)"/),
  colCount: num(/colCount="(\d+)"/, colPr),
  colGap: num(/sameGap="(\d+)"/, colPr),
};
page.colWidth = Math.round((page.width - page.left - page.right - page.colGap * (page.colCount - 1)) / page.colCount);

/* ═══ content.hpf 머리 · settings ═══ */
const hpf = text('Contents/content.hpf');
const hpfOpen = /^[\s\S]*?<opf:package [^>]*>/.exec(hpf)?.[0];
if (!hpfOpen) fail('content.hpf의 opf:package를 찾지 못했다');
const settings = text('settings.xml').replace(/<ha:CaretPosition [^>]*\/>/, '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>');

const parts = {
  VERSION_XML: text('version.xml'),
  CONTAINER_XML: text('META-INF/container.xml'),
  CONTAINER_RDF: text('META-INF/container.rdf'),
  MANIFEST_XML: text('META-INF/manifest.xml'),
  HEADER_XML: header,
  MASTERPAGE_XML: text('Contents/masterpage0.xml'),
  SETTINGS_XML: settings,
  HPF_OPEN: hpfOpen,
  SECTION_OPEN: secOpen,
  SEC_PR: secPr + colPr,
};
for (const [k, v] of Object.entries(parts)) if (PERSONAL_RE.test(v)) fail(`뼈대 ${k}에 개인 정보 패턴이 있다 — 템플릿을 --scrub할 것`);

const banner = `/* 생성 파일 — scripts/hwpxSkeleton.mjs가 템플릿 hwpx에서 뽑았다. 손으로 고치지 말 것(스크립트를 다시 돌린다). */\n`;
const files = {};
files['parts.ts'] = banner + Object.entries(parts).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};\n`).join('');
const ids = {
  STYLE_IDS: styleIds,
  PAGE: page,
  ITEM_CNT: itemCnt,
  MAX_ID: { charPr: maxId('charPr'), borderFill: maxId('borderFill'), paraPr: maxId('paraPr'), tabPr: maxId('tabPr') },
};
files['ids.ts'] =
  banner +
    `import type { StyleKey } from '../styles';\n\n` +
    `export interface StyleIds { id: number; name: string; paraPr: number; charPr: number }\n` +
    `export const STYLE_IDS: Record<StyleKey, StyleIds> = ${JSON.stringify(ids.STYLE_IDS, null, 2)};\n` +
    `/** HWPUNIT — colWidth = (width − left − right − colGap·(colCount−1)) / colCount */\n` +
    `export const PAGE = ${JSON.stringify(ids.PAGE, null, 2)} as const;\n` +
    `/** 템플릿 header의 목록별 itemCnt(덧붙일 때 갱신 기준) */\n` +
    `export const ITEM_CNT: Record<string, number> = ${JSON.stringify(ids.ITEM_CNT, null, 2)};\n` +
    `/** 템플릿 header의 목록별 최대 id(덧붙이는 항목은 +1부터) */\n` +
    `export const MAX_ID = ${JSON.stringify(ids.MAX_ID, null, 2)} as const;\n`;

if (CHECK) {
  // 커밋된 뼈대가 커밋된 템플릿에서 나온 것인지(손으로 고친 흔적·템플릿만 바꾸고 재생성을 빠뜨림)
  for (const [name, want] of Object.entries(files)) {
    let have = '';
    try { have = readFileSync(join(OUT_DIR, name), 'utf8'); } catch { /* 없음 */ }
    if (have !== want) fail(`skeleton/${name}이 템플릿과 어긋난다 — node scripts/hwpxSkeleton.mjs 로 다시 만들 것`);
  }
  console.log('[hwpxSkeleton] --check OK');
  process.exit(0);
}
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(OUT_DIR, name), body);
console.log(`[hwpxSkeleton] OK — 스타일 ${wanted.length} · 쪽 ${page.width}×${page.height} · 열 폭 ${page.colWidth} → ${OUT_DIR}`);
