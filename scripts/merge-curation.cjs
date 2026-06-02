/**
 * merge-curation.cjs — 워크플로 큐레이션 결과 + 시드 구조필드 병합
 *
 * 입력: 워크플로 출력 JSON 경로(argv[2]) — result.items 552개(field/ko/en/tier/needsReview/note)
 * 동작: 각 항목 latex를 시드(katex-symbols.seed.json)와 조인해 unicode/mathClass/displayLatex/
 *       cursorOffset/katexSupported 부착 → lib/data/curated-full.json 생성 + 통계 리포트.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const outPath = process.argv[2];
if (!outPath) { console.error('사용법: node scripts/merge-curation.cjs <워크플로출력.output>'); process.exit(1); }

const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const items = (raw.result && raw.result.items) || raw.items;
if (!Array.isArray(items)) { console.error('items 배열을 찾을 수 없음'); process.exit(1); }

// 시드 인덱스 (단일 + 구조형)
const seed = require(path.join(ROOT, 'lib', 'data', 'katex-symbols.seed.json'));
const seedSingle = new Map();
for (const s of seed.symbols) if (!seedSingle.has(s.latex)) seedSingle.set(s.latex, s);
const seedStruct = new Map();
for (const s of seed.structured) seedStruct.set(s.latex, s);

const merged = [];
const unmatched = [];
const seenLatex = new Set();
let id = 1;
for (const it of items) {
  if (seenLatex.has(it.latex)) continue;       // 중복 latex 방지
  seenLatex.add(it.latex);

  const st = seedStruct.get(it.latex);
  const sg = seedSingle.get(it.latex);
  let structural;
  if (st) {
    structural = { symbol: '', displayLatex: st.displayLatex, cursorOffset: st.cursorOffset, mathClass: 'structured', katexSupported: st.katexSupported };
  } else if (sg) {
    structural = { symbol: sg.unicode || '', mathClass: sg.mathClass, katexSupported: sg.katexSupported };
  } else {
    unmatched.push(it.latex);
    structural = { symbol: '', mathClass: 'mathord', katexSupported: false };
  }

  const rec = {
    id: id++,
    latex: it.latex,
    symbol: structural.symbol,
    mathClass: structural.mathClass,
    field: it.field,
    tier: it.tier,
    name: { ko: it.ko, en: it.en },
    katexSupported: structural.katexSupported,
    needsReview: !!it.needsReview,
  };
  if (structural.displayLatex) rec.displayLatex = structural.displayLatex;
  if (structural.cursorOffset !== undefined) rec.cursorOffset = structural.cursorOffset;
  if (it.note && it.note.trim()) rec.note = it.note.trim();
  merged.push(rec);
}

// 저장
const outFile = path.join(ROOT, 'lib', 'data', 'curated-full.json');
fs.writeFileSync(outFile, JSON.stringify({
  _meta: {
    generatedBy: 'workflow phase40-symbol-curation + scripts/merge-curation.cjs',
    structuralSource: 'lib/data/katex-symbols.seed.json (KaTeX MIT)',
    note: 'field/ko/en/tier/needsReview = 멀티에이전트 큐레이션. KMS 대조 전(needsReview=true 우선).',
  },
  count: merged.length,
  items: merged,
}, null, 2) + '\n', 'utf8');

// 통계
const byField = {}, byTier = {};
let review = 0;
for (const r of merged) {
  byField[r.field] = (byField[r.field] || 0) + 1;
  byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  if (r.needsReview) review++;
}
console.log('병합 완료 :', merged.length, '개');
console.log('미매칭    :', unmatched.length, unmatched.length ? unmatched.slice(0, 20) : '');
console.log('needsReview:', review, `(${(review / merged.length * 100).toFixed(0)}%)`);
console.log('tier 분포 :', byTier);
console.log('field 분포:', Object.fromEntries(Object.entries(byField).sort((a, b) => b[1] - a[1])));
const common = merged.filter(r => r.tier <= 2 && !r.needsReview).length;
console.log(`팔레트 후보(tier<=2 && !needsReview): ${common}개`);
console.log('→ 저장: lib/data/curated-full.json');
