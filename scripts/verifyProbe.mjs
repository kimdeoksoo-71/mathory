/**
 * Phase 61b 스텝 2 관문 — 프롬프트 실물 확정용 프로브
 *
 * 목적은 하나다: **프롬프트 문안을 고치고 → 돌려보고 → 오탐/누락을 보고 다시 고치는 루프**를
 * UI 왕복 없이 빠르게 도는 것. 라우트를 부르지 않으므로 인증·dev 서버·클릭이 필요 없다.
 *
 * ⚠️ 라우트와 **같은 것**: 프롬프트 문안(lib/verify/prompts.ts), 파싱·복구·정제·앵커·합성
 *    (lib/verify/parse.ts), 요청 바디 조립(lib/verify/providerParams.ts).
 * ⚠️ 라우트와 **다른 것**: HTTP 호출부(여기는 raw fetch, 라우트는 SDK)와 인증.
 *    따라서 문안이 확정되면 **UI에서 1회는 반드시 실제로 눌러 봐야 한다**.
 *
 * 실행 전: `npm run test:verify` (프롬프트·파서를 .test-build로 컴파일한다)
 *
 * 사용법
 *   node scripts/verifyProbe.mjs --rows 15,20-22            # 시트 Data_DS 행 지정
 *   node scripts/verifyProbe.mjs --sample 5 --flagged       # 시트가 결함으로 표시한 행에서 5개
 *   node scripts/verifyProbe.mjs --vlabel 가정,충분성 --kind solution   # 시트 V열이 그 유형으로 잡은 행
 *   node scripts/verifyProbe.mjs --sample 5                 # 아무 행에서 5개 (과검출 확인용)
 *   node scripts/verifyProbe.mjs --file fixtures/a.md       # 로컬 파일 (--- 로 문제/풀이 구분)
 *   ... --kind problem|solution|both   (기본 both)
 *   ... --judge-code-exec              (2차에 code_execution 켜기 — F1 대조용)
 *   ... --json out.json                (결과 저장)
 *
 * 시트 대조군: N열(문제검증) · Q열(해설검증) · U열(STEP3 종합) · V열(확정 결함 리포트).
 * "시트는 error인데 우리는 ok" = 누락, "시트는 ok인데 우리는 fail" = 과검출 후보.
 * ⚠️ 시트 판정도 완벽하지 않다 — 대조군이지 정답이 아니다. 최종 판단은 눈으로 한다.
 *
 * ⚠️ Phase 61f 한계: 이 프로브의 말뭉치는 **시트 텍스트**라 image 블록이 생기지 않는다 →
 *    그림 첨부(images)는 항상 비고, 요청 바디는 61f 이전과 바이트 동일하다(D10).
 *    D8 문구의 "그림이 첨부되어 있으면" 갈래는 여기서 잴 수 없다 — 실사용 검수가 전담한다.
 *    (프롬프트 문안 자체는 .test-build를 거쳐 라우트와 같은 판이 실린다.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JWT } from 'google-auth-library';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ═══ .env.local 로드 (값은 절대 출력하지 않는다) ═══ */
function loadEnv() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) die('.env.local 이 없습니다');
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

/* ═══ 인자 ═══ */
function parseArgs(argv) {
  const a = { kind: 'both', judgeCodeExec: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--rows') a.rows = argv[++i];
    else if (k === '--sample') a.sample = Number(argv[++i]);
    else if (k === '--flagged') a.flagged = true;
    else if (k === '--vlabel') a.vlabel = argv[++i];
    else if (k === '--with-answer') a.withAnswer = true;
    else if (k === '--file') a.file = argv[++i];
    else if (k === '--kind') a.kind = argv[++i];
    else if (k === '--judge-code-exec') a.judgeCodeExec = true;
    else if (k === '--json') a.json = argv[++i];
    else if (k === '--sheet') a.sheet = argv[++i];
  }
  return a;
}

/** "15,20-22" → [15,20,21,22] */
function parseRows(s) {
  const out = [];
  for (const part of String(s).split(',')) {
    const m = part.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) out.push(i); }
    else if (/^\d+$/.test(part.trim())) out.push(+part.trim());
  }
  return out;
}

/* ═══ 시트 읽기 (61a 라우트와 같은 자격증명·스코프) ═══ */
/** 0-based 열 인덱스 (실측 헤더 기준) */
const COL = { GIVEN_SOLUTION: 2, GIVEN_ANSWER: 3, STEM: 4, ANSWER_TYPE: 10,
              P_VERDICT: 13, P_DERIVED: 14, S_VERDICT: 16, S_ERROR: 17,
              Q_VERDICT: 20, Q_REPORT: 21 };

/**
 * ⚠️ 판정 결과는 **Stack 시트에 있다.** Data_DS는 처리가 끝나면 비워지고 Stack으로 옮겨진다
 *    (실측 2026-08-22: Data_DS 2,187행의 판정열은 전부 빈칸, Stack 3,983행에
 *     문제검증 error 89 · 해설검증 error 490 · STEP3 fail 17). 대조군은 Stack이다.
 */
async function readSheet(sheetName) {
  const jwt = new JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const { token } = await jwt.getAccessToken();
  const id = (process.env.AUDITION_SPREADSHEET_ID || '').trim().replace(/^\/+|\/+$/g, '');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/`
            + `${encodeURIComponent(`${sheetName}!A1:X`)}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) die(`시트를 읽지 못했습니다 (HTTP ${res.status})`);
  return (await res.json())?.values ?? [];
}

/** 텍스트 덩어리 → 유사 블록 (Mathory 블록 구조 흉내: 빈 줄 = 블록 경계) */
function toBlocks(text, prefix) {
  return String(text || '')
    .split(/\n\s*\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({ blockKey: `${prefix}${i + 1}`, type: 'text', text: t }));
}

/* ═══ 모델 호출 (바디 조립은 라우트와 같은 순수 함수를 쓴다) ═══ */

async function callGemini(system, user, model, cfg) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
            + `?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: cfg,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  return {
    content: parts.map((p) => p.text || '').join(''),
    inputTokens: j?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: j?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function callClaude(params) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(params),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return {
    content: (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''),
    inputTokens: j.usage?.input_tokens ?? 0,
    outputTokens: j.usage?.output_tokens ?? 0,
    stopReason: j.stop_reason,
  };
}

/* ═══ 파이프라인 (라우트 §5-2와 같은 순서) ═══ */

/** 시트 answer_type(K열) → 형식 안내. Mathory의 deriveAnswerFormat과 같은 4갈래다
 *  (시트 `getFormatGuide`, Itemverification.gs:522-528). 프로브는 라벨이 있으니 그걸 쓴다. */
/**
 * 시트 answer_type(K열) → 제품의 `deriveAnswerFormat` 입력.
 *
 * ⚠️ **`mcq`를 먼저 본다.** 실측 유형은 `mcq_math`·`mcq_combo`처럼 접두가 붙는데,
 *    `includes('math')`를 먼저 검사하면 선다형이 "값을 내라"로 새어 나간다.
 *    그러면 D열(선택지 번호)과 AI 도출값(답의 값)을 비교하게 되어 **정상 문항이
 *    전부 mismatch로 잡힌다**(실측 2026-08-23: 8건 전부 이 경로였다).
 *    제품 코드는 K열이 아니라 `choices` 블록 유무로 판단하므로 이 함정이 없다 —
 *    프로브만 시트 라벨을 읽기 때문에 생기는 문제다.
 */
function formatGuideFromType(t, answer, P) {
  const s = String(t || '').toLowerCase();
  const combo = s.includes('combo');
  const mcq = s.includes('mcq') || s.includes('choice');
  if (mcq) return P.deriveAnswerFormat({ hasChoices: true, hasGanaOrRoman: combo, answer });
  if (combo) return P.deriveAnswerFormat({ hasChoices: true, hasGanaOrRoman: true, answer });
  if (s.includes('int')) return P.deriveAnswerFormat({ hasChoices: false, hasGanaOrRoman: false, answer: '1' });
  return P.deriveAnswerFormat({ hasChoices: false, hasGanaOrRoman: false, answer });
}

async function runOne({ kind, problemBlocks, solutionBlocks, answer, P, V, opts }) {
  const t0 = Date.now();
  const targetBlocks = kind === 'problem' ? problemBlocks : solutionBlocks;
  // 문제 = 한 패스 / 풀이 = 계산·표기 + 논리 + 군더더기(61h) 세 패스. ⚠ 병렬 (라우트와 동일)
  const passes = kind === 'problem' ? [P.PROMPT_PROBLEM_FIRST] : P.SOLUTION_FIRST_PASSES;
  const vars = {
    problem: P.labelBlocks(problemBlocks),
    solution: P.labelBlocks(solutionBlocks),
    format: opts.formatGuide,
  };

  const gs = await Promise.all(passes.map((pr) =>
    callGemini(pr.system, P.fillTemplate(pr.user, vars), opts.geminiModel,
      // ⚠ 8000은 라우트 FIRST_MAX_TOKENS의 **사본**이다(61g에서 미통일). 한쪽만 바꾸면 측정이 갈린다.
    V.buildGeminiConfig(8000, { geminiThinkingLevel: 'HIGH', geminiJsonMime: true }))));
  const gIn = gs.reduce((n, g) => n + g.inputTokens, 0);
  const gOut = gs.reduce((n, g) => n + g.outputTokens, 0);

  // ⚠ 파싱 결과를 그 패스와 짝지어 든다 — 라우트와 같은 이유(한 패스가 죽으면 상한이 어긋난다).
  const parsed = gs.map((g, i) => ({ pass: passes[i], json: V.parseAndRepair(g.content) }));
  // ⚠ 두 게이트(전부 실패·전부 skip)는 **결함 패스만** 본다 — 라우트와 동일(61h E4·N1).
  //   군더더기 패스의 실패·skip은 "군더더기 없음"으로 흘린다.
  const defectParsed = parsed.filter((x) => !x.pass.severity);
  if (defectParsed.every((x) => !x.json)) {
    return { error: '1차 응답 파싱 실패', raw: gs[0].content.slice(0, 600), ms: Date.now() - t0 };
  }
  const alive = parsed.filter((x) => x.json);
  const defectAlive = alive.filter((x) => !x.pass.severity);
  const garbagePassDead = parsed.some((x) => x.pass.severity && !x.json);   // Stage 2·3 빈도 관찰용

  if (defectAlive.every((x) => x.json.skip === true)) {
    return { verdict: 'skip', findings: [], note: defectAlive[0].json.skip_reason,
             tokens: [gIn, gOut], ms: Date.now() - t0, judged: false };
  }

  const derivedAnswer = kind === 'problem' ? String(defectAlive[0].json.derived_answer || '').trim() : undefined;
  const answerCheck = kind === 'problem' ? V.compareAnswer(answer, derivedAnswer) : undefined;
  // ⚠ 상한은 프롬프트가 소유한다 — 여기에 8·12·6을 리터럴로 박지 말 것(61g E3: 실제로 갈렸었다).
  const candidates = V.mergeCandidates(
    alive.map((x) => V.sanitizeFindings(x.json.candidates, kind, x.pass.cap, x.pass.severity)),
    P.MERGE_CANDIDATE_CAP);

  if (answerCheck === 'mismatch' && !candidates.some((c) => c.tag === '정답불일치')) {
    candidates.unshift({ id: 'c0', tag: '정답불일치', quote: '',
      reason: `등록 정답 "${answer}"과 도출답 "${derivedAnswer}"이 다릅니다.` });
    candidates.forEach((c, i) => { c.id = `c${i + 1}`; });
  }

  const rawCandidates = candidates.map((c) => ({ ...c }));   // 2차 전 상태 보존 (과검출 관찰용)

  if (candidates.length === 0) {
    return { verdict: 'ok', findings: [], garbage: [], note: '(후보 없음)', derivedAnswer, answerCheck,
             rawCandidates, garbagePassDead, tokens: [gIn, gOut], ms: Date.now() - t0, judged: false };
  }

  const anchors = new Map(candidates.map((c) => [c.id, V.anchorByQuote(c.quote, targetBlocks)]));
  const { defect, garbage } = V.splitBySeverity(candidates);   // 61h — 판정자가 다르다

  const judgeVars = {
    problem: P.labelBlocks(problemBlocks),
    solution: P.labelBlocks(kind === 'problem' ? problemBlocks : solutionBlocks),
  };
  // ⚠ 16000은 라우트 JUDGE_MAX_TOKENS(32k)의 **사본이 아니라 옛 값**이다(61h E9·N3 — 측정 연속성 때문에
  //   이번엔 그대로 둔다). 라우트와 갈린 자리임을 알고 볼 것. `truncated`도 여기엔 없다.
  const judgeOne = (prompt, cands) => callClaude(V.buildClaudeParams({
    model: opts.claudeModel, system: prompt.system,
    messages: [{ role: 'user', content: P.fillTemplate(prompt.user, { ...judgeVars, candidates: P.formatCandidatesForJudge(cands) }) }],
    maxTokens: 16000, enableCodeExecution: false,
    opts: { thinking: 'adaptive', effort: 'high', enableCodeExecution: opts.judgeCodeExec },
  })).then((r) => ({ ...r, ms: Date.now() - t0 }));

  // ⚠ 두 판정은 병렬 (라우트와 동일). 결함 후보가 없으면 결함 판정자는 부르지 않는다.
  const tJ = Date.now();
  const [dc, gc] = await Promise.all([
    defect.length ? judgeOne(P.PROMPT_JUDGE, defect) : null,
    garbage.length ? judgeOne(P.PROMPT_GARBAGE_JUDGE, garbage) : null,
  ]);
  const jIn = (dc?.inputTokens ?? 0) + (gc?.inputTokens ?? 0);
  const jOut = (dc?.outputTokens ?? 0) + (gc?.outputTokens ?? 0);
  const tokens = [gIn + jIn, gOut + jOut];

  let judgments = [];
  if (dc) {
    judgments = V.parseAndRepair(dc.content)?.judgments;
    if (!Array.isArray(judgments)) {
      return { error: '2차(결함) 응답 파싱 실패', raw: dc.content.slice(0, 600), rawCandidates, tokens, ms: Date.now() - t0 };
    }
  }
  // 군더더기 판정 실패는 결함/군더더기를 갈라 기록한다(61h G7) — 라우트(N2)처럼 결함 리포트는 살린다
  let garbageJudgments = null;
  if (gc) {
    const gj = V.parseAndRepair(gc.content)?.judgments;
    garbageJudgments = Array.isArray(gj) ? gj : null;
  }
  const garbageJudgeFailed = garbage.length > 0 && garbageJudgments === null;

  const rulings = V.indexJudgments(judgments);
  const findings = [];
  defect.forEach((cand) => {
    const j = rulings[cand.id];
    const ruling = j?.ruling ?? 'uncertain';
    if (ruling === 'invalid') return;
    const a = anchors.get(cand.id);
    findings.push({
      tag: cand.tag,
      verdict: ruling === 'valid' && a.found ? 'fail' : 'check',
      blockKey: a.blockKey, quoteFound: a.found,
      quote: cand.quote, reason: j?.note || cand.reason,
    });
  });

  // 61h — 군더더기 합성 (라우트와 같은 모양). escalate → findings에 check 결함(D5·N4)
  const gRul = V.indexJudgments(garbageJudgments ?? []);
  const garbageOut = [];
  let escalated = 0;
  if (!garbageJudgeFailed) {
    garbage.forEach((cand) => {
      const j = gRul[cand.id];
      const ruling = j?.ruling ?? 'uncertain';
      const a = anchors.get(cand.id);
      if (j?.escalate) {
        escalated++;
        findings.push({
          tag: V.normalizeTag(j.escalateTag, 'solution'), verdict: 'check',
          blockKey: a.blockKey, quoteFound: a.found,
          quote: cand.quote, reason: `[군더더기 검토에서 격상] ${j.note || cand.reason}`,
        });
        return;
      }
      if (ruling === 'invalid') return;
      garbageOut.push({
        tag: cand.tag, ruling,
        verdict: ruling === 'valid' && a.found ? 'fail' : 'check',
        blockKey: a.blockKey, quoteFound: a.found,
        quote: cand.quote, reason: j?.note || cand.reason,
        suggestion: ruling === 'valid' ? (j?.suggestion || cand.suggestion || '') : '',   // 라우트와 동일 — valid일 때만
      });
    });
  }

  const defectRaw = rawCandidates.filter((c) => c.severity !== 'garbage');
  const garbageRaw = rawCandidates.filter((c) => c.severity === 'garbage');
  return {
    verdict: V.synthesizeVerdict(findings), findings, garbage: garbageOut, derivedAnswer, answerCheck,
    rawCandidates, defectRaw, garbageRaw,
    rejected: defectRaw.length - (findings.length - escalated),
    garbageRejected: garbageJudgeFailed ? null : garbageRaw.length - garbageOut.length - escalated,
    escalated, garbageJudgeFailed, garbagePassDead,
    stopReason: dc?.stopReason, garbageStopReason: gc?.stopReason,
    judgeMs: dc ? dc.ms - (tJ - t0) : null, garbageJudgeMs: gc ? gc.ms - (tJ - t0) : null,
    tokens, ms: Date.now() - t0, judged: true,
  };
}

/* ═══ 출력 ═══ */
const ICON = { ok: '✓', check: '⚠', fail: '✕', skip: '−' };

function printResult(label, r, sheetRef) {
  console.log(`\n  ── ${label} ─────────────────────────────`);
  if (r.error) { console.log(`  ✖ ${r.error}`); if (r.raw) console.log(`     ${r.raw.replace(/\n/g, '\n     ')}`); return; }
  const cost = r.tokens ? ` · in ${r.tokens[0]} / out ${r.tokens[1]}` : '';
  console.log(`  ${ICON[r.verdict] || '?'} ${r.verdict}${r.note ? ` ${r.note}` : ''}`
            + `  (${(r.ms / 1000).toFixed(1)}s${cost})`);
  if (sheetRef !== undefined) console.log(`  시트 대조: ${sheetRef || '(빈칸)'}`);
  if (r.answerCheck) {
    const mark = { match: '✓ 일치', mismatch: '✕ 불일치', no_answer: '− 등록 정답 없음' }[r.answerCheck];
    console.log(`  정답대조: ${mark}${r.derivedAnswer ? `  (AI 도출: ${r.derivedAnswer})` : ''}`);
  }
  if (r.judged) {
    const dr = r.defectRaw ?? r.rawCandidates;
    console.log(`  결함 후보 ${dr.length}건 → 남김 ${r.findings.length - (r.escalated || 0)}건 (기각 ${r.rejected})`
              + (r.judgeMs != null ? `  · 결함 판정 ${(r.judgeMs / 1000).toFixed(1)}s` : ''));
  }
  for (const [i, f] of (r.findings || []).entries()) {
    console.log(`   ${i + 1}. [${f.tag}] ${f.verdict}`
              + `${f.quoteFound ? ` @${f.blockKey}` : ' @원문미확인'}`);
    if (f.quote) console.log(`      인용: ${f.quote.replace(/\n/g, ' ').slice(0, 90)}`);
    console.log(`      사유: ${String(f.reason).replace(/\n/g, ' ').slice(0, 160)}`);
  }
  if (r.judged && r.rejected > 0) {
    const kept = new Set((r.findings || []).map((f) => f.quote));
    const dropped = (r.defectRaw ?? r.rawCandidates).filter((c) => !kept.has(c.quote));
    console.log(`  기각된 후보(2차가 걸러낸 것 — 여기가 많으면 1차가 과하다):`);
    for (const d of dropped) console.log(`      · [${d.tag}] ${String(d.reason).replace(/\n/g, ' ').slice(0, 110)}`);
  }
  /* 61h — 군더더기 절 (대조군 없음 — 기록과 눈으로 읽기가 전부다, D10) */
  if (r.judged && (r.garbageRaw?.length || r.garbagePassDead)) {
    const gr = r.garbageRaw ?? [];
    console.log(`  군더더기 후보 ${gr.length}건 → 남김 ${r.garbage.length}건 (기각 ${r.garbageRejected ?? '?'} · 격상 ${r.escalated})`
              + (r.garbageJudgeMs != null ? `  · 군더더기 판정 ${(r.garbageJudgeMs / 1000).toFixed(1)}s` : '')
              + (r.garbageJudgeFailed ? '  ✖ 군더더기 판정 파싱 실패(절 생략)' : '')
              + (r.garbagePassDead ? '  ✖ 1차 군더더기 패스 파싱 실패' : ''));
    for (const [i, f] of r.garbage.entries()) {
      console.log(`   g${i + 1}. [${f.tag}] ${f.verdict}(${f.ruling})${f.quoteFound ? ` @${f.blockKey}` : ' @원문미확인'}`);
      if (f.quote) console.log(`      인용: ${f.quote.replace(/\n/g, ' ').slice(0, 90)}`);
      console.log(`      사유: ${String(f.reason).replace(/\n/g, ' ').slice(0, 160)}`);
      if (f.suggestion) console.log(`      제안: ${String(f.suggestion).replace(/\n/g, ' ').slice(0, 120)}`);
    }
    const kept = new Set(r.garbage.map((f) => f.quote));
    const escQ = new Set((r.findings || []).filter((f) => String(f.reason).startsWith('[군더더기')).map((f) => f.quote));
    const dropped = gr.filter((c) => !kept.has(c.quote) && !escQ.has(c.quote));
    if (dropped.length && !r.garbageJudgeFailed) {
      console.log(`  기각된 군더더기 후보:`);
      for (const d of dropped) console.log(`      · [${d.tag}] ${String(d.reason).replace(/\n/g, ' ').slice(0, 110)}`);
    }
  }
}

/* ═══ main ═══ */
(async () => {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const buildDir = path.join(ROOT, '.test-build/lib/verify');
  if (!fs.existsSync(path.join(buildDir, 'prompts.js'))) {
    die('먼저 `npm run test:verify` 를 실행하세요 (프롬프트·파서를 .test-build로 컴파일합니다)');
  }
  const P = await import(path.join(buildDir, 'prompts.js'));
  const V = { ...(await import(path.join(buildDir, 'parse.js'))),
              ...(await import(path.join(buildDir, 'providerParams.js'))) };

  const opts = {
    geminiModel: process.env.VERIFY_GEMINI_MODEL || 'gemini-3.1-pro-preview',
    claudeModel: process.env.VERIFY_CLAUDE_MODEL || 'claude-opus-5',   // 2026-09-10 라우트와 동일하게 Opus 5
    judgeCodeExec: args.judgeCodeExec,
  };

  /* 대상 수집 */
  let targets = [];
  if (args.file) {
    const raw = fs.readFileSync(path.resolve(ROOT, args.file), 'utf8');
    const [stem, solution = ''] = raw.split(/^---$/m);
    targets = [{ label: args.file, stem, solution, answer: '', answerType: '', sheet: {} }];
  } else {
    const sheetName = args.sheet || 'Stack';   // 판정 대조군이 있는 쪽
    const values = await readSheet(sheetName);
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const r = values[i] || [];
      const stem = String(r[COL.STEM] ?? '').trim();
      if (!stem) continue;
      rows.push({
        rowIndex: i + 1, stem,
        solution: String(r[COL.GIVEN_SOLUTION] ?? '').trim(),
        // 등록 정답(D열)은 3.9%만 채워져 있다 → 대부분 no_answer로 간다. 그게 실제 상황이다.
        answer: String(r[COL.GIVEN_ANSWER] ?? '').trim(),
        answerType: String(r[COL.ANSWER_TYPE] ?? '').trim(),
        sheet: {
          p: String(r[COL.P_VERDICT] ?? ''), s: String(r[COL.S_VERDICT] ?? ''),
          q: String(r[COL.Q_VERDICT] ?? ''),
          derived: String(r[COL.P_DERIVED] ?? ''),
          error: String(r[COL.S_ERROR] ?? ''), report: String(r[COL.Q_REPORT] ?? ''),
        },
      });
    }
    if (args.rows) {
      const want = new Set(parseRows(args.rows));
      targets = rows.filter((r) => want.has(r.rowIndex));
    } else {
      let pool = rows;
      if (args.flagged) {
        /* ⚠ --kind를 무시하면 안 된다. 풀이 검증을 돌리면서 *문제* 결함 행을 섞으면
           그 행의 해설 판정은 빈칸이라 우리 ok가 전부 "판정 없음"으로 빠지고,
           누락 집계가 조용히 오염된다(실측에서 실제로 그랬다). */
        const bad = (v) => ['error', 'fail'].includes(String(v).toLowerCase());
        const want = args.kind === 'problem'
          ? (r) => bad(r.sheet.p)
          : args.kind === 'solution'
            ? (r) => bad(r.sheet.s) || bad(r.sheet.q)
            : (r) => bad(r.sheet.p) || bad(r.sheet.s) || bad(r.sheet.q);
        pool = rows.filter(want);
        console.log(`시트가 결함으로 표시한 행(${args.kind}): ${pool.length}개`);
      }
      /* 61g — 시트 STEP3 V2가 새 유형으로 잡은 행만 고른다 (확장 유형 대조군).
         V열(Q_REPORT) 리포트의 블록 제목이 `[<라벨>n]` 형식이다(`QualityVerification.gs:468`).
         시트 v4 Q_TYPES 라벨: 비약 · 오추론 · 가정 · 경우누락 · 충분성 · 불일치.
         ⚠ **V2 프롬프트로 처리된 행만 새 라벨을 가진다** — 그 전 행은 비약·불일치뿐이다.
            표본이 0이면 61b 베이스라인을 사람이 재라벨해 대조군으로 쓴다(61g D11). */
      if (args.vlabel) {
        const labels = args.vlabel.split(',').map((x) => x.trim()).filter(Boolean);
        pool = pool.filter((r) => labels.some((L) => r.sheet.report.includes(`[${L}`)));
        console.log(`시트 V열이 [${labels.join('·')}]로 잡은 행: ${pool.length}개`);
      }
      // 풀이 검증인데 풀이가 없는 행은 표본에서 뺀다 (그냥 건너뛰면 표본 수가 줄어든다)
      if (args.kind === 'solution') pool = pool.filter((r) => r.solution);
      /* D열(등록 정답)은 3.9%만 채워져 있다 → 그냥 표본을 뽑으면 answerCheck가 전부
         no_answer로 빠져 **정답 대조 경로를 한 번도 밟지 못한다.** 문제 검증을 볼 때 켤 것. */
      if (args.withAnswer) {
        pool = pool.filter((r) => r.answer);
        console.log(`등록 정답이 있는 행: ${pool.length}개`);
      }
      const n = args.sample || 3;
      // 균등 간격 표본 — 앞쪽만 쏠리지 않게
      const step = Math.max(1, Math.floor(pool.length / n));
      targets = Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[i * step]);
    }
    targets = targets.map((t) => ({ ...t, label: `${sheetName} 행 ${t.rowIndex}` }));
  }
  if (targets.length === 0) die('대상 행이 없습니다');

  console.log(`\n모델: ${opts.geminiModel} → ${opts.claudeModel}`
            + `${opts.judgeCodeExec ? ' (2차 code_execution ON)' : ''}`);
  console.log(`대상: ${targets.length}건\n${'═'.repeat(60)}`);

  const kinds = args.kind === 'both' ? ['problem', 'solution'] : [args.kind];
  const out = [];

  for (const t of targets) {
    console.log(`\n▸ ${t.label}`);
    console.log(`  문제: ${t.stem.replace(/\n/g, ' ').slice(0, 100)}…`);
    const problemBlocks = toBlocks(t.stem, 'p');
    const solutionBlocks = toBlocks(t.solution, 's');

    for (const kind of kinds) {
      if (kind === 'solution' && solutionBlocks.length === 0) {
        console.log('\n  ── 풀이 검증 ── (풀이 없음, 건너뜀)'); continue;
      }
      let r;
      try {
        r = await runOne({ kind, problemBlocks, solutionBlocks, answer: t.answer, P, V,
                           opts: { ...opts, formatGuide: formatGuideFromType(t.answerType, t.answer, P) } });
      } catch (e) { r = { error: e.message }; }
      const ref = kind === 'problem'
        ? `${t.sheet.p || '(빈칸)'}${t.sheet.derived ? ` · 시트 도출답 "${t.sheet.derived}"` : ''}`
        : `${t.sheet.s || '(빈칸)'} / STEP3 ${t.sheet.q || '(빈칸)'}`
          + (t.sheet.error ? `\n            시트 지적: ${t.sheet.error.replace(/\n/g, ' ').slice(0, 200)}` : '');
      printResult(kind === 'problem' ? '문제 검증' : '풀이 검증', r, ref);
      out.push({ label: t.label, kind, result: r, sheet: t.sheet });
    }
  }

  /* ═══ 대조 요약 — 이 표가 관문의 실제 산출물이다 ═══
     시트 판정을 정답으로 삼지는 않는다(대조군이지 정답이 아니다). 다만
     **누락과 과검출이 어느 쪽으로 치우쳤는지**는 이 표가 아니면 눈으로 못 센다. */
  const SHEET_BAD = ['error', 'fail'];
  const table = {};
  for (const o of out) {
    if (o.result.error) continue;
    /* ⚠ 풀이 검증의 대조군은 해설검증(Q열) **또는** STEP3(U열)다. Q열만 보면
       "해설검증 ok · STEP3 error"인 행이 정상으로 잡혀 누락이 과소 집계된다. */
    const refs = (o.kind === 'problem' ? [o.sheet.p] : [o.sheet.s, o.sheet.q])
      .map((x) => String(x || '').toLowerCase()).filter(Boolean);
    const ref = refs.join('/');
    const sheetBad = refs.some((x) => SHEET_BAD.includes(x));
    const ourBad = o.result.verdict === 'fail';
    const ourSoft = o.result.verdict === 'check';
    const k = o.kind;
    table[k] = table[k] || { 일치_결함: 0, 누락: 0, 약하게잡음: 0, 과검출후보: 0, 일치_정상: 0, 애매: 0, 기타: 0 };
    if (!ref) { table[k].기타++; continue; }
    if (sheetBad) {
      if (ourBad) table[k].일치_결함++;
      else if (ourSoft) table[k].약하게잡음++;
      else table[k].누락++;
    } else if (refs.every((x) => x === 'ok')) {
      if (ourBad) table[k].과검출후보++;
      else if (ourSoft) table[k].애매++;
      else table[k].일치_정상++;
    } else table[k].기타++;
  }

  console.log(`\n${'═'.repeat(60)}`);
  for (const [kind, t] of Object.entries(table)) {
    const label = kind === 'problem' ? '문제 검증' : '풀이 검증';
    console.log(`\n대조 요약 — ${label}  (시트 판정 대비)`);
    console.log(`  시트 결함 → 우리 fail   : ${t.일치_결함}건   ✓ 일치`);
    console.log(`  시트 결함 → 우리 check  : ${t.약하게잡음}건   △ 잡았으나 확정 못 함`);
    console.log(`  시트 결함 → 우리 ok     : ${t.누락}건   ✖ **누락** ← 1차 프롬프트가 후보를 못 냈거나 2차가 과하게 기각`);
    console.log(`  시트 정상 → 우리 fail   : ${t.과검출후보}건   ✖ **과검출 후보** ← 2차 판정 기준을 더 엄격히`);
    console.log(`  시트 정상 → 우리 check  : ${t.애매}건   △ 소음이면 보수 문구 강화`);
    console.log(`  시트 정상 → 우리 ok     : ${t.일치_정상}건   ✓ 일치`);
    if (t.기타) console.log(`  판정 없음/기타          : ${t.기타}건`);
  }

  /* 61h — 군더더기 요약 (풀이 검증만 · 대조군 없음) */
  const gRows = out.filter((o) => o.kind === 'solution' && o.result.judged);
  if (gRows.length) {
    const sum = (f) => gRows.reduce((n, o) => n + (f(o.result) || 0), 0);
    const tagDist = {};
    for (const o of gRows) for (const c of (o.result.garbageRaw || [])) tagDist[c.tag] = (tagDist[c.tag] || 0) + 1;
    const gms = gRows.map((o) => o.result.garbageJudgeMs).filter((x) => x != null);
    const dms = gRows.map((o) => o.result.judgeMs).filter((x) => x != null);
    console.log(`\n군더더기 요약 — 풀이 검증 ${gRows.length}건 (2차까지 간 것만)`);
    console.log(`  1차 후보 평균: ${(sum((r) => r.garbageRaw?.length) / gRows.length).toFixed(2)}건`
              + ` · 상한 6 도달: ${gRows.filter((o) => (o.result.garbageRaw?.length || 0) >= 6).length}건`
              + ` · 1차 패스 실패: ${gRows.filter((o) => o.result.garbagePassDead).length}건`);
    console.log(`  태그 분포(1차): ${Object.entries(tagDist).map(([k, v]) => `${k} ${v}`).join(' · ') || '(없음)'}`
              + `   ← 느슨한서술 0이면 동치 검사 문구가 안 먹는 신호`);
    console.log(`  판정: 확정(fail) ${sum((r) => r.garbage?.filter((f) => f.verdict === 'fail').length)}`
              + ` · 확인(check) ${sum((r) => r.garbage?.filter((f) => f.verdict === 'check').length)}`
              + ` · 기각 ${sum((r) => r.garbageRejected)} · 격상(escalate) ${sum((r) => r.escalated)}`
              + ` · 판정 실패 ${gRows.filter((o) => o.result.garbageJudgeFailed).length}건`);
    console.log(`  판정 시간: 결함 최장 ${dms.length ? (Math.max(...dms) / 1000).toFixed(1) : '-'}s`
              + ` · 군더더기 최장 ${gms.length ? (Math.max(...gms) / 1000).toFixed(1) : '-'}s   (200s 문턱)`);
  }

  const totalIn = out.reduce((n, o) => n + (o.result.tokens?.[0] || 0), 0);
  const totalOut = out.reduce((n, o) => n + (o.result.tokens?.[1] || 0), 0);
  const judged = out.filter((o) => o.result.judged).length;
  console.log(`\n토큰 합계: in ${totalIn.toLocaleString()} / out ${totalOut.toLocaleString()}`
            + `  (2차까지 간 건 ${judged}/${out.length})`);
  // ⚠ 5/25는 lib/aiPricing.ts의 claude-opus-5 단가 사본이다(raw fetch 프로브라 TS 모듈을 못 읽는다) — 표를 바꾸면 함께(M9 D15′ ⑤)
  console.log(`대략 비용: 최대 $${((totalIn / 1e6) * 5 + (totalOut / 1e6) * 25).toFixed(3)}`
            + ` — 전량을 Opus 단가로 계산한 상한이다(1차 Gemini분은 더 싸다)`);

  if (args.json) {
    fs.writeFileSync(path.resolve(ROOT, args.json), JSON.stringify(out, null, 2));
    console.log(`저장: ${args.json}`);
  }
})();
