/**
 * gen-curation-workflow.cjs — 552개 큐레이션용 워크플로 스크립트 생성기
 *
 * 시드(katex-symbols.seed.json)에서 대상 552개(math 렌더가능 524 + 구조형 28)를 추려
 * 데이터가 내장된 deep-curation 워크플로 스크립트를 scripts/_curation.gen.js로 출력한다.
 * (워크플로 샌드박스는 fs 접근이 없으므로 데이터를 스크립트에 직접 박아 넣음)
 *
 * 산출 워크플로: 552개를 ~37개씩 15배치로 나눠 병렬 에이전트가 field/ko/en/tier/needsReview
 * 부여 → 병합 배열 반환. 구조적 필드(unicode/mathClass/displayLatex)는 빌드 단계에서 시드와 조인.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const seed = require(path.join(ROOT, 'lib', 'data', 'katex-symbols.seed.json'));

// ── 대상 552개 추출 (에이전트엔 최소 정보만: latex/unicode/mathClass/hint) ──
function cleanHint(s) {
  if (!s) return '';
  // 코드 주석성 힌트는 잡음이 많아 60자로 컷, 따옴표 제거
  return String(s).replace(/["'`]/g, '').slice(0, 60);
}
const mathSyms = seed.symbols
  .filter((s) => s.mode === 'math' && s.katexSupported)
  .map((s) => ({ latex: s.latex, unicode: s.unicode || '', mathClass: s.mathClass, hint: cleanHint(s.katexSection) }));
const structSyms = seed.structured
  .map((s) => ({ latex: s.latex, unicode: s.displayLatex || '', mathClass: 'structured', hint: s.en || '' }));

const SYMBOLS = [...mathSyms, ...structSyms];
console.log('대상 기호:', SYMBOLS.length, `(math ${mathSyms.length} + 구조형 ${structSyms.length})`);

const FIELDS = [
  'arithmetic', 'algebra', 'analysis', 'calculus', 'geometry', 'set', 'logic',
  'probability', 'statistics', 'discrete', 'vector', 'linear-algebra', 'greek', 'bracket',
];

// ── 워크플로 스크립트 텍스트 생성 ──
const BATCH = 37;
const script = `export const meta = {
  name: 'phase40-symbol-curation',
  description: 'Mathory 수식 기호 552개에 분야/한국어·영어 이름/교육과정 등급 부여',
  phases: [{ title: 'Curate', detail: '15배치 병렬 큐레이션' }],
};

const SYMBOLS = ${JSON.stringify(SYMBOLS)};
const FIELDS = ${JSON.stringify(FIELDS)};
const BATCH = ${BATCH};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          latex: { type: 'string', description: '입력 latex 그대로(절대 변형 금지)' },
          field: { type: 'string', enum: FIELDS },
          ko: { type: 'string', description: '한국 수학 통용 표준 용어. 없으면 음역/설명.' },
          en: { type: 'string', description: '영어 이름(소문자 일반 명칭)' },
          tier: { type: 'integer', enum: [1, 2, 3, 4], description: '1=중고, 2=대학기초, 3=대학전공, 4=연구/특수' },
          needsReview: { type: 'boolean', description: '한국어명이 불확실하거나 비표준이면 true' },
          note: { type: 'string', description: '선택: 표기 변형/주의(예: 한국 교과서 표기 차이). 없으면 빈 문자열' },
        },
        required: ['latex', 'field', 'ko', 'en', 'tier', 'needsReview', 'note'],
      },
    },
  },
  required: ['items'],
};

function promptFor(batch, idx) {
  const lines = batch.map((s, i) =>
    \`\${i + 1}. latex=\${JSON.stringify(s.latex)} | 기호=\${s.unicode || '(없음)'} | KaTeX클래스=\${s.mathClass} | 힌트=\${s.hint || '(없음)'}\`
  ).join('\\n');
  return [
    '너는 한국 수학교육·수학 전문가다. 아래 수학 기호들에 대해 메타데이터를 부여하라.',
    '각 기호마다 다음을 정하라:',
    '- field: ' + FIELDS.join(', ') + ' 중 하나 (그 기호가 가장 많이 쓰이는 분야)',
    '- ko: 한국 수학 통용 표준 용어(예: \\\\leq→이하, \\\\int→적분, \\\\alpha→알파). 확립된 한국어명이 없으면 음역 또는 간단한 설명을 쓰고 needsReview=true.',
    '- en: 영어 일반 명칭(소문자, 예: less than or equal, integral).',
    '- tier: 1=중·고등학교, 2=대학 기초(미적분/선형대수 등), 3=대학 전공, 4=연구/특수(거의 안 쓰임).',
    '- needsReview: 한국어명이 불확실/비표준이거나 한국 교과서에서 거의 안 쓰는 기호면 true.',
    '- note: 한국식 표기 차이 등 특이사항(예: ⊂를 부분집합 포함으로 쓰는 관행). 없으면 빈 문자열 "".',
    '규칙: latex는 입력 그대로 한 글자도 바꾸지 말 것. 입력 개수와 출력 items 개수를 정확히 일치시킬 것. 추측이 어려운 obscure 기호도 빠짐없이 best-effort로 채우되 needsReview=true.',
    '',
    '기호 목록(배치 ' + idx + '):',
    lines,
  ].join('\\n');
}

phase('Curate');
const batches = [];
for (let i = 0; i < SYMBOLS.length; i += BATCH) batches.push(SYMBOLS.slice(i, i + BATCH));
log(\`\${SYMBOLS.length}개 → \${batches.length}배치 병렬 큐레이션 시작\`);

const results = await parallel(batches.map((b, idx) => () =>
  agent(promptFor(b, idx), { label: \`curate \${idx} (\${b.length})\`, phase: 'Curate', schema: SCHEMA })
));

const merged = [];
results.forEach((r, idx) => {
  if (r && Array.isArray(r.items)) merged.push(...r.items);
  else log(\`⚠ 배치 \${idx} 결과 없음/형식오류\`);
});
log(\`병합 완료: \${merged.length} / \${SYMBOLS.length}\`);
return { count: merged.length, expected: SYMBOLS.length, items: merged };
`;

const outPath = path.join(ROOT, 'scripts', '_curation.gen.js');
fs.writeFileSync(outPath, script, 'utf8');
console.log('→ 워크플로 스크립트 생성:', path.relative(ROOT, outPath), `(${(script.length / 1024).toFixed(0)}KB)`);
console.log('배치 수:', Math.ceil(SYMBOLS.length / BATCH));
