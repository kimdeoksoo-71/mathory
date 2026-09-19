#!/usr/bin/env node
/**
 * M9 D25-1 — Mathpix 옵션 연구 프로브. `/v3/text`에 같은 이미지를 옵션 조합별로 보내 결과를 파일로 남긴다.
 *
 *   node scripts/ocrProbe.mjs [이미지…] [--out <dir>] [--only <조합,…>]
 *   (기본 이미지: docs/phaseSketch/m9-ocr/ocr-line-1.png · ocr-line-2.png · ocr-page.png)
 *
 * 판정 기준(실행판 §9에 표로 남긴다): 원문자 자음 ㉠·㉡가 (a) `text`에 나오나 (b) `line_data`에라도 나오나
 * (c) 엉뚱한 글자로 나오나(`\neg`·`7`·`①`·`ⓐ` 등). 리더(`⋯⋯`)가 어떤 토큰으로 오는지도 본다.
 * 앱 라우트(app/api/ocr/route.ts)와 같은 raw fetch — 인증 키는 .env.local에서 읽고 **출력하지 않는다**.
 * ⚠ 결과 파일은 `.probe/`(gitignore)에. 호출마다 Mathpix 과금이 생긴다(조합 × 이미지 수).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

/* ═══ .env.local 로드 (값은 절대 출력하지 않는다 — verifyProbe.mjs와 같은 로더) ═══ */
function loadEnv() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) die('.env.local 이 없습니다');
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

const BASE = { formats: ['text'], math_inline_delimiters: ['$', '$'], math_display_delimiters: ['$$', '$$'] };
/** 조합. `current`가 app/api/ocr/route.ts의 현행 요청과 같다 */
const COMBOS = {
  current: { ...BASE, rm_spaces: true },
  keepSpaces: { ...BASE, rm_spaces: false },
  lineData: { ...BASE, rm_spaces: true, include_line_data: true },
  eqnArrays: { ...BASE, rm_spaces: true, idiomatic_eqn_arrays: true },
  // 식 번호를 수식 안 \tag{…}로 싣는다(켜면 idiomatic_eqn_arrays도 켜진다) — line_data의 equation_number 줄이 text에서 빠지는 것의 대안
  eqnTags: { ...BASE, rm_spaces: true, include_equation_tags: true },
  // 대조군: `{ko:true}`만으로는 무동작일 공산(기본값이 전부 true) → 다른 문자계를 끈다(레포 기록상 인식률 급락 — 대조로만)
  koEnOnly: {
    ...BASE, rm_spaces: true,
    alphabets_allowed: { hi: false, zh: false, ja: false, ru: false, th: false, ta: false, te: false, gu: false, bn: false, vi: false },
  },
};

const CIRCLED_JAMO = /[㉠-㉭]/g;
const SUSPECT = /\\neg|[①-⑳ⓐ-ⓩ⒜-⒵]|\\text\s*\{[^}]*\}/g;
const LEADER = /\\cdots|\\ldots|\\dots|⋯|…|·{2,}|\.{3,}/g;

function summarize(text) {
  return {
    circled: (text.match(CIRCLED_JAMO) || []).join(''),
    suspects: [...new Set(text.match(SUSPECT) || [])].slice(0, 8),
    leaders: [...new Set(text.match(LEADER) || [])],
  };
}

async function main() {
  loadEnv();
  const appId = process.env.MATHPIX_APP_ID, appKey = process.env.MATHPIX_APP_KEY;
  if (!appId || !appKey) die('MATHPIX_APP_ID / MATHPIX_APP_KEY가 .env.local에 없습니다');

  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const out = path.resolve(ROOT, outIdx !== -1 ? argv[outIdx + 1] : '.probe/ocr');
  const onlyIdx = argv.indexOf('--only');
  const only = onlyIdx !== -1 ? argv[onlyIdx + 1].split(',') : Object.keys(COMBOS);
  const images = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--only');
  const imgs = images.length ? images : ['ocr-line-1.png', 'ocr-line-2.png', 'ocr-page.png']
    .map((f) => path.join('docs/phaseSketch/m9-ocr', f));
  fs.mkdirSync(out, { recursive: true });

  const rows = [];
  for (const img of imgs) {
    const abs = path.resolve(ROOT, img);
    if (!fs.existsSync(abs)) die(`이미지가 없습니다: ${img}`);
    const src = `data:image/png;base64,${fs.readFileSync(abs).toString('base64')}`;
    for (const name of only) {
      const opts = COMBOS[name];
      if (!opts) die(`모르는 조합: ${name}`);
      const t0 = Date.now();
      const resp = await fetch('https://api.mathpix.com/v3/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', app_id: appId, app_key: appKey },
        body: JSON.stringify({ src, ...opts }),
      });
      const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      const ms = Date.now() - t0;
      const base = path.basename(img, path.extname(img));
      fs.writeFileSync(path.join(out, `${base}__${name}.json`), JSON.stringify(data, null, 2));
      const text = String(data.text || '');
      const lineText = Array.isArray(data.line_data) ? data.line_data.map((l) => l.text || '').join('\n') : '';
      const s = summarize(text);
      const sl = lineText ? summarize(lineText) : null;
      rows.push({ img: base, combo: name, ms, error: data.error || '', confidence: data.confidence, ...s,
        lineCircled: sl ? sl.circled : '—', tail: text.split('\n').slice(-2).join(' ⏎ ').slice(-120) });
    }
  }
  console.log('\n이미지 · 조합 · ㉠ in text · ㉠ in line_data · 리더 토큰 · 의심 치환 · 끝 부분');
  for (const r of rows) {
    console.log(`${r.img} · ${r.combo} · ${r.circled || '없음'} · ${r.lineCircled} · ${r.leaders.join(' ') || '없음'} · ${r.suspects.join(' ') || '—'}${r.error ? ` · ✖ ${r.error}` : ''}\n    ${r.tail}`);
  }
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(rows, null, 2));
  console.log(`\n결과: ${path.relative(ROOT, out)}/`);
}

main().catch((e) => die(e?.message || String(e)));
