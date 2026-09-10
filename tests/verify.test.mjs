/**
 * Phase 61b 스텝 1 — 프롬프트·파서 회귀.
 *
 * 이 파일이 지키는 것은 하나다: **수식이 본문인 도메인에서 문자열이 조용히 망가지지 않는 것.**
 * `$$` 치환 손상과 `\frac` 이스케이프 충돌은 둘 다 오류를 내지 않고 결과만 바꾼다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const P = await import('../.test-build/lib/verify/prompts.js');
const V = await import('../.test-build/lib/verify/parse.js');

/* ═══ 치환 ═══ */

test('fillTemplate — 치환값의 $$ · $& · $` 가 패턴으로 해석되지 않는다', () => {
  const tpl = '[문제]\n{problem}';
  const body = '$$\\frac{1}{2}$$ 와 $& 그리고 $` 와 $1';
  assert.equal(P.fillTemplate(tpl, { problem: body }), `[문제]\n${body}`);
});

test('fillTemplate — 미지 키는 그대로 남는다 (조용한 공백 치환 금지)', () => {
  assert.equal(P.fillTemplate('a{unknown}b', { x: '1' }), 'a{unknown}b');
});

test('fillTemplate — 여러 자리, 반복 자리 모두 치환', () => {
  assert.equal(
    P.fillTemplate('{a}-{b}-{a}', { a: '$x$', b: '$$y$$' }),
    '$x$-$$y$$-$x$',
  );
});

/* ═══ 파싱 후 복구 — 진짜 함정 ═══ */

test('repairLatexControlChars — JSON.parse가 성공하며 망가진 \\frac 이 복원된다', () => {
  // "\frac" 은 JSON에서 유효 파싱된다: \f(form feed) + "rac"
  const parsed = JSON.parse('{"quote":"\\frac{1}{2}"}');
  assert.equal(parsed.quote, '\f' + 'rac{1}{2}');        // 조용한 손상을 먼저 확인
  assert.equal(V.repairLatexControlChars(parsed).quote, '\\frac{1}{2}');
});

test('repairLatexControlChars — \\beta \\right \\theta \\neq 계열도 복원', () => {
  // JSON.parse가 실제로 만드는 잔여 형태를 시료로 쓴다:
  //   "\beta"  → \b(BS) + 'eta'   /  "\right" → \r(CR) + 'ight'
  //   "\theta" → \t(TAB) + 'heta' /  "\neq"   → \n(LF) + 'eq'
  const src = JSON.parse('{"a":"\\beta","b":"\\right","c":"\\theta","d":"\\neq"}');
  assert.equal(src.a, '\x08eta');   // 조용한 손상을 먼저 확인
  const got = V.repairLatexControlChars(src);
  assert.deepEqual(got, { a: '\\beta', b: '\\right', c: '\\theta', d: '\\neq' });
});

test('repairLatexControlChars — 중첩 객체·배열을 재귀 복구', () => {
  const got = V.repairLatexControlChars({ candidates: [{ quote: '\frac{a}{b}' }] });
  assert.equal(got.candidates[0].quote, '\\frac{a}{b}');
});

test('sanitizeFindings — 복구가 trim보다 먼저 일어난다 (선두 제어문자 보존)', () => {
  // 선두가 \f 면 trim이 공백으로 보고 지워 복원이 불가능해진다
  const out = V.sanitizeFindings([{ tag: '계산오류', quote: '\frac{1}{2}=1', reason: 'r' }], 'solution');
  assert.equal(out[0].quote, '\\frac{1}{2}=1');
});

/* ═══ 4단계 파싱 폴백 ═══ */

test('safeParseJson — ① 코드펜스 + 앞뒤 산문', () => {
  const raw = '판정 결과입니다.\n```json\n{"candidates":[]}\n```\n이상입니다.';
  assert.deepEqual(V.safeParseJson(raw), { candidates: [] });
});

test('safeParseJson — ② 무효 이스케이프(\\q)를 승격해 복구', () => {
  assert.deepEqual(V.safeParseJson('{"a":"\\qquad x"}'), { a: '\\qquad x' });
});

test('safeParseJson — ③ 이스케이프 파손으로 파싱이 실패하면 문자 단위 교정으로 살린다', () => {
  // 닫는 따옴표 앞의 홑 백슬래시 때문에 1·2단계가 실패한다 → 3단계가 잡는다
  const got = V.safeParseJson('{"quote":"x \\ y","n":1}');
  assert.equal(got.n, 1);
});

test('parseAndRepair — 1단계에서 파싱이 "성공"해도 \\frac 손상을 되살린다', () => {
  // ⚠ 이것이 핵심 계약이다: safeParseJson만 부르면 조용히 망가진 값을 받는다.
  const raw = '{"quote":"\\frac{1}{2}"}';
  assert.equal(V.safeParseJson(raw).quote, '\u000Crac{1}{2}');                        // 손상본(FF + 'rac')
  assert.equal(V.parseAndRepair(raw).quote, '\\frac{1}{2}');                          // 복구본
});

test('safeParseJson — ④ 뒤에 붙은 산문의 중괄호에 걸리지 않는다 (균형 추출)', () => {
  const raw = '{"candidates":[{"tag":"계산오류","quote":"a"}]}\n\n참고: {이건 JSON이 아님}';
  const got = V.safeParseJson(raw);
  assert.equal(got.candidates.length, 1);
});

test('safeParseJson — 문자열 안의 중괄호를 깊이로 세지 않는다', () => {
  const got = V.safeParseJson('{"quote":"f(x)={1}","n":1}');
  assert.equal(got.n, 1);
});

test('safeParseJson — 복구 불가면 null (반쪽 리포트를 만들지 않는다)', () => {
  assert.equal(V.safeParseJson('완전히 JSON이 아닌 응답'), null);
});

/* ═══ 후보 정제 ═══ */

test('sanitizeFindings — 미지 태그 근사 매핑 · 빈 항목 제거 · id 재부여 · 상한 8', () => {
  const out = V.sanitizeFindings([
    { tag: 'logic_gap', quote: 'q1', reason: 'r1' },
    { tag: '', quote: '', reason: '' },                       // 제거
    { type: 'inconsistency', quote: 'q2', reason: 'r2' },      // type 필드도 수용
    ...Array.from({ length: 10 }, (_, i) => ({ tag: '계산오류', quote: `x${i}`, reason: 'r' })),
  ], 'solution');
  assert.equal(out.length, 8);
  assert.deepEqual(out.map((f) => f.id).slice(0, 3), ['c1', 'c2', 'c3']);
  assert.equal(out[0].tag, '논리비약');
  assert.equal(out[1].tag, '수식비일관');
});

test('normalizeTag — kind별 화이트리스트 밖으로 나가지 않는다', () => {
  for (const t of ['헛소리', '', 'weird_tag']) {
    assert.ok(V.allowedTags('problem').includes(V.normalizeTag(t, 'problem')));
    assert.ok(V.allowedTags('solution').includes(V.normalizeTag(t, 'solution')));
  }
  assert.equal(V.normalizeTag('정답불일치', 'problem'), '정답불일치');
});

test('sanitizeFindings — block 힌트를 숫자로 흡수(문자열도)', () => {
  const out = V.sanitizeFindings([
    { tag: '계산오류', quote: 'a', reason: 'r', block: 3 },
    { tag: '계산오류', quote: 'b', reason: 'r', block: '4' },
    { tag: '계산오류', quote: 'c', reason: 'r' },
  ], 'solution');
  assert.equal(out[0].blockHint, 3);
  assert.equal(out[1].blockHint, 4);
  assert.equal(out[2].blockHint, undefined);
});

/* ═══ 인용 매칭 → 앵커 ═══ */

const BLOCKS = [
  { blockKey: 'k1', text: '조건에서 $f(1) = 0$ 이다.' },
  { blockKey: 'k2', text: '따라서 $x = 2$ 또는 $x = -3$ 이다.' },
];

test('anchorByQuote — 공백 차이를 무시하고 전문 매칭', () => {
  assert.deepEqual(V.anchorByQuote('$f(1)=0$', BLOCKS), { blockKey: 'k1', found: true });
  assert.deepEqual(V.anchorByQuote('$x = 2$', BLOCKS), { blockKey: 'k2', found: true });
});

test('anchorByQuote — 인용이 블록보다 길어도 최장 접두로 걸린다', () => {
  const long = '따라서 $x = 2$ 또는 $x = -3$ 이다. 그리고 여기부터는 원문에 없는 말이다.';
  assert.deepEqual(V.anchorByQuote(long, BLOCKS), { blockKey: 'k2', found: true });
});

test('anchorByQuote — 짧은 우연 일치는 앵커로 인정하지 않는다 (12자 미만)', () => {
  assert.deepEqual(V.anchorByQuote('조건에서 XYZ', BLOCKS), { blockKey: null, found: false });
});

test('anchorByQuote — 모델이 $ 를 떨어뜨려도 블록을 찾는다', () => {
  // 못 찾으면 blockKey가 null이 되어 리포트 지적이 클릭조차 안 된다
  assert.deepEqual(V.anchorByQuote('f(1)=0', BLOCKS), { blockKey: 'k1', found: true });
});

test('anchorByQuote와 findQuoteRange는 같은 기준으로 정규화한다', () => {
  // 한쪽만 찾는 어긋난 상태가 실제로 있었다 (블록은 못 찾는데 글자는 찾음)
  const q = 'f(1)=0';
  assert.ok(V.anchorByQuote(q, BLOCKS).found);
  assert.ok(V.findQuoteRange(BLOCKS[0].text, q));
});

test('anchorByQuote — 원문에 없으면 미매칭 (환각 신호)', () => {
  assert.deepEqual(V.anchorByQuote('$y = 99$ 라고 했다', BLOCKS), { blockKey: null, found: false });
  assert.deepEqual(V.anchorByQuote('', BLOCKS), { blockKey: null, found: false });
});

test('anchorByQuote — 여러 블록에 걸리면 첫 블록 (문서 순서)', () => {
  const dup = [{ blockKey: 'a', text: '같은 문장' }, { blockKey: 'b', text: '같은 문장' }];
  assert.equal(V.anchorByQuote('같은 문장', dup).blockKey, 'a');
});

/* ═══ 인용 → 원문 글자 범위 (편집창 점프용) ═══ */

const DOC = '조건에서 $f(1) = 0$ 이다.\n따라서 $x = 2$ 또는 $x = -3$ 이다.';

test('findQuoteRange — 공백 차이를 넘어 정확한 범위', () => {
  const r = V.findQuoteRange(DOC, '$x = 2$');
  assert.ok(r);
  assert.equal(DOC.slice(r.from, r.to), 'x = 2');
});

test('findQuoteRange — 모델이 $ 를 떨어뜨려도 찾는다', () => {
  const r = V.findQuoteRange(DOC, 'f(1)=0');
  assert.ok(r);
  assert.equal(DOC.slice(r.from, r.to), 'f(1) = 0');
});

test('findQuoteRange — 뒤에 군더더기가 붙으면 최장 접두로', () => {
  const r = V.findQuoteRange(DOC, '따라서 $x = 2$ 또는 $x = -3$ 이다. 원문에 없는 말');
  assert.ok(r);
  assert.ok(DOC.slice(r.from, r.to).startsWith('따라서'));
});

test('findQuoteRange — 정확히 있으면 짧아도 찾는다 (하한은 접두 추측에만)', () => {
  // `$x = 2$`처럼 정규화하면 3자인 정당한 인용이 있다 → 전문 일치에 길이 하한을 걸면 안 된다
  const r = V.findQuoteRange(DOC, '조건');
  assert.equal(DOC.slice(r.from, r.to), '조건');
});

test('findQuoteRange — 없으면 null', () => {
  assert.equal(V.findQuoteRange(DOC, '$y = 99$ 라고 했다'), null);
  assert.equal(V.findQuoteRange('', 'x'), null);
  assert.equal(V.findQuoteRange(DOC, ''), null);
});

test('findQuoteRange — 접두 폴백은 12자 미만이면 포기한다', () => {
  // 앞 몇 글자만 겹치는 인용 → 우연 일치로 엉뚱한 데로 보내지 않는다
  assert.equal(V.findQuoteRange(DOC, '조건XYZ 전혀 다른 문장이 길게 이어진다'), null);
});

/* ═══ 판정 매핑 · 합성 ═══ */

test('synthesizeVerdict — fail≥1 → fail / check≥1 → check / 빈 배열 → ok', () => {
  assert.equal(V.synthesizeVerdict([]), 'ok');
  assert.equal(V.synthesizeVerdict([{ verdict: 'check' }]), 'check');
  assert.equal(V.synthesizeVerdict([{ verdict: 'check' }, { verdict: 'fail' }]), 'fail');
});

test('normalizeRuling — 판정 누락·미지 값은 uncertain', () => {
  assert.equal(V.normalizeRuling('valid'), 'valid');
  assert.equal(V.normalizeRuling('INVALID'), 'invalid');
  assert.equal(V.normalizeRuling(undefined), 'uncertain');
  assert.equal(V.normalizeRuling('헛소리'), 'uncertain');
});

test('indexJudgments — id 없는 항목은 버린다', () => {
  const m = V.indexJudgments([{ id: 'c1', ruling: 'valid' }, { ruling: 'valid' }]);
  assert.deepEqual(Object.keys(m), ['c1']);
  assert.equal(m.c1.ruling, 'valid');
});

/* ═══ 정답 대조 ═══ */

test('compareAnswer — 공백·$·\\left\\right·후행 마침표를 무시', () => {
  assert.equal(V.compareAnswer('12', ' 12 '), 'match');
  assert.equal(V.compareAnswer('$\\frac{1}{2}$', '\\frac{1}{2}'), 'match');
  assert.equal(V.compareAnswer('ㄱ, ㄷ', 'ㄱ,ㄷ'), 'match');
  assert.equal(V.compareAnswer('12', '13'), 'mismatch');
});

test('compareAnswer — 등록 정답 또는 도출답이 없으면 no_answer', () => {
  assert.equal(V.compareAnswer('', '12'), 'no_answer');
  assert.equal(V.compareAnswer('12', ''), 'no_answer');
  assert.equal(V.compareAnswer('12', undefined), 'no_answer');
});

/* ═══ 답안 형식 ═══ */

test('deriveAnswerFormat — 4갈래 (시트 getFormatGuide 등가)', () => {
  assert.match(P.deriveAnswerFormat({ hasChoices: true, hasGanaOrRoman: true, answer: '' }), /조합/);
  assert.match(P.deriveAnswerFormat({ hasChoices: true, hasGanaOrRoman: false, answer: '' }), /①/);
  assert.match(P.deriveAnswerFormat({ hasChoices: false, hasGanaOrRoman: false, answer: '48' }), /자연수/);
  assert.match(P.deriveAnswerFormat({ hasChoices: false, hasGanaOrRoman: false, answer: '' }), /표준/);
  // 1000 이상은 자연수형이 아니다 (시트 int 규정 = 1~999)
  assert.match(P.deriveAnswerFormat({ hasChoices: false, hasGanaOrRoman: false, answer: '1024' }), /표준/);
});

/* ═══ 블록 라벨링 ═══ */

test('labelBlocks — [블록 n] 라벨과 총 글자 수', () => {
  const bs = [
    { blockKey: 'k1', type: 'text', text: '첫째' },
    { blockKey: 'k2', type: 'choices', text: '① 1 ② 2' },
  ];
  const s = P.labelBlocks(bs);
  assert.match(s, /\[블록 1\]\n첫째/);
  assert.match(s, /\[블록 2\] \(choices\)/);
  assert.equal(P.totalChars(bs), '첫째'.length + '① 1 ② 2'.length);
});

/* ═══ Phase 61f — 그림 첨부 후의 프롬프트·라벨 ═══ */

test('61f labelBlocks — image 블록이 (image) 라벨과 자리표시자로 나온다', async () => {
  const P = await import('../.test-build/lib/verify/prompts.js');
  const F = await import('../.test-build/lib/verify/figures.js');
  // 서버는 번호 확정 후의 텍스트로 labelBlocks를 부른다 — [그림 1]이 그대로 실린다
  const out = P.labelBlocks([
    { blockKey: 'b1', type: 'text', text: '그래프가 그림과 같다.' },
    { blockKey: 'b2', type: 'image', text: F.numberFigures(F.FIG_PLACEHOLDER, [{ k: 1, ok: true }]) },
  ]);
  assert.ok(out.includes('[블록 2] (image)\n[그림 1]'), out);
});

test('61f D8 — 프롬프트가 "이미지를 보지 못합니다"를 더는 단정하지 않는다', async () => {
  const P = await import('../.test-build/lib/verify/prompts.js');
  // 61h G1 — 군더더기 판정자도 감시 대상에 넣는다(1차 군더더기 패스는 SOLUTION_FIRST_PASSES로 자동 포함)
  const all = [P.PROMPT_PROBLEM_FIRST, ...P.SOLUTION_FIRST_PASSES, P.PROMPT_JUDGE, P.PROMPT_GARBAGE_JUDGE]
    .map((pr) => pr.system + pr.user).join('\n');
  assert.ok(!all.includes('이미지를 보지 못합니다'), '첨부 후에는 거짓이 되는 단정 문구');
  assert.ok(all.includes('첨부되지 않음'), '첨부되지 않은 그림에 한해 skip/uncertain');
  assert.ok(all.includes('[그림 k]'), '자리표시자 의미 설명');
});

test('61f LabeledBlock.imageUrl — totalChars는 text만 센다 (자리표시자 4자)', async () => {
  const P = await import('../.test-build/lib/verify/prompts.js');
  const F = await import('../.test-build/lib/verify/figures.js');
  const n = P.totalChars([{ blockKey: 'b', type: 'image', text: F.FIG_PLACEHOLDER, imageUrl: 'https://x' }]);
  assert.equal(n, F.FIG_PLACEHOLDER.length);
  assert.equal(n, 4);
});

/* ═══ Phase 61g — 논리 결함 유형 확장 (시트 STEP3 V2 이식) ═══ */

test('61g T1 — 시트 6종 type 문자열이 의도한 태그로 정규화된다', () => {
  const m = {
    logic_gap: '논리비약',
    invalid_inference: '논리오류',          // 어느 힌트에도 안 걸려 폴백 — 의도한 결과(E4)
    unwarranted_assumption: '근거없는가정',
    case_omission: '경우누락',
    sufficiency_unchecked: '충분성미확인',
    inconsistency: '수식비일관',
  };
  for (const [type, tag] of Object.entries(m)) {
    assert.equal(V.normalizeTag(type, 'solution'), tag, type);
  }
});

test('61g T2 — 하위 호환 · 신규 힌트가 문제 검증으로 새지 않는다', () => {
  // 옛 2종은 종전 태그 그대로 (시트 V1 시절 저장분·재전송 대비)
  assert.equal(V.normalizeTag('비약', 'solution'), '논리비약');
  assert.equal(V.normalizeTag('일관성 없음', 'solution'), '수식비일관');
  // ⚠ 신규 힌트는 problem 분기 **아래**에 있어야 한다 — 위로 옮기면 여기서 깨진다(S3)
  const allowP = V.allowedTags('problem');
  for (const t of ['unwarranted_assumption', 'sufficiency_unchecked', '가정', '충분']) {
    assert.ok(allowP.includes(V.normalizeTag(t, 'problem')), t);
  }
});

test('61g T3 — 신규 2종은 풀이 화이트리스트에만 있다', () => {
  const sol = V.allowedTags('solution');
  const prob = V.allowedTags('problem');
  for (const t of ['근거없는가정', '충분성미확인']) {
    assert.ok(sol.includes(t), t);
    assert.ok(!prob.includes(t), t);
    assert.equal(V.normalizeTag(t, 'solution'), t);   // 이미 화이트리스트면 그대로 통과
  }
});

test('61g T4 — sanitizeFindings는 호출부가 넘긴 cap을 그대로 쓴다 (논리 패스 12)', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ tag: '논리비약', quote: `q${i}`, reason: 'r' }));
  assert.equal(V.sanitizeFindings(mk(20), 'solution', 12).length, 12);
  assert.equal(V.sanitizeFindings(mk(20), 'solution').length, 8);      // 기본값 불변
  assert.equal(V.sanitizeFindings(mk(5), 'solution', 12).length, 5);
});

test('61g T5 — 프롬프트에 신규 유형·전역 검토·"답이 맞아도 결함" 문구가 있다', () => {
  const logic = P.PROMPT_SOLUTION_FIRST_LOGIC.system;
  for (const s of ['근거없는가정', '충분성미확인', '전역 검토', '결론을 확정하는 줄']) {
    assert.ok(logic.includes(s), `논리 1차: ${s}`);
  }
  assert.ok(logic.includes('답이 맞더라도'), '논리 1차: 답 정오로 후보를 제외하지 않는다');

  const judge = P.PROMPT_JUDGE.system;
  assert.ok(judge.includes("[2']"), '2차: 유형별 기준 절');
  assert.ok(judge.includes('invalid"의 근거가 아닙니다'), '2차: 답이 맞다 ≠ invalid');
  // ⚠ D5 — uncertain을 조이는 시트 문구는 이식하지 않았고, 반대 방향 한 줄이 [2'] 머리에 있다
  assert.ok(judge.includes('가리지 못하면 "uncertain"입니다'), '2차: uncertain 우선');
  assert.ok(!judge.includes('애매해 보인다'), '시트 V2의 uncertain 조임 문구는 이식하지 않는다');
});

test("61g T6′ — 후보 상한의 단일 출처: 프롬프트 문자열과 cap이 일치한다 (61h: 패스 3)", () => {
  // ⚠ PROMPT_JUDGE·PROMPT_GARBAGE_JUDGE는 1차가 아니라 cap이 없다 — 대상에서 제외(S13)
  const passes = [P.PROMPT_PROBLEM_FIRST, ...P.SOLUTION_FIRST_PASSES];
  for (const pr of passes) {
    assert.equal(typeof pr.cap, 'number', 'cap 필드');
    assert.ok(pr.system.includes(`최대 ${pr.cap}개`), `system이 알리는 수 = ${pr.cap}`);
  }
  const [calc, logic, garbage] = P.SOLUTION_FIRST_PASSES;
  assert.equal(P.SOLUTION_FIRST_PASSES.length, 3);
  assert.equal(calc.cap, 8);
  assert.equal(logic.cap, 12);
  assert.equal(garbage.cap, 6);
  // 병합 상한 = 패스 상한의 합 → 병합 단계는 자르지 않는다
  assert.equal(P.MERGE_CANDIDATE_CAP, calc.cap + logic.cap + garbage.cap);
  assert.equal(P.MERGE_CANDIDATE_CAP, 26);
  // severity는 군더더기 패스에만 — 결함 패스에 생기면 게이트(N1)가 그 패스를 놓친다
  assert.equal(garbage.severity, 'garbage');
  for (const pr of [P.PROMPT_PROBLEM_FIRST, calc, logic]) assert.equal('severity' in pr, false);
});

/* ═══ Phase 61h — 군더더기 검출 (별도 축) ═══ */

test('61h T1 — 군더더기 태그 정규화: 시트 키·한글 변형 · 힌트 순서(E3)', () => {
  assert.deepEqual([...V.GARBAGE_TAGS], ['무관서술', '중복서술', '느슨한서술']);
  const m = {
    irrelevant: '무관서술', redundant: '중복서술', loose_equivalence: '느슨한서술',
    중언부언: '중복서술', 동치: '느슨한서술',
    // ⚠ E3 — '불필요'는 '필요'를 품는다. 느슨 힌트가 먼저 오거나 '필요' 단독 힌트가 있으면 여기서 깨진다
    불필요: '무관서술', unnecessary: '무관서술',
  };
  for (const [raw, tag] of Object.entries(m)) assert.equal(V.normalizeGarbageTag(raw), tag, raw);
});

test('61h T2 — 격리: 군더더기 어휘는 결함 화이트리스트 밖이고 폴백은 무관서술', () => {
  assert.equal(V.normalizeGarbageTag(''), '무관서술');
  assert.equal(V.normalizeGarbageTag('logic_gap'), '무관서술');
  const sol = V.allowedTags('solution');
  for (const g of V.GARBAGE_TAGS) {
    assert.ok(!sol.includes(g), `${g}는 SOLUTION_TAGS 밖`);
    const t = V.normalizeTag(g, 'solution');
    assert.ok(sol.includes(t) && !V.GARBAGE_TAGS.includes(t), `normalizeTag(${g}) → 결함 어휘(${t})`);
  }
});

test('61h T3 — sanitizeFindings severity: 군더더기 태그 정규화 · cap 6 · 미지정이면 필드 없음', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ tag: 'redundant', quote: `q${i}`, reason: 'r' }));
  const g = V.sanitizeFindings(mk(7), 'solution', 6, 'garbage');
  assert.equal(g.length, 6);
  for (const f of g) { assert.equal(f.severity, 'garbage'); assert.equal(f.tag, '중복서술'); }
  const d = V.sanitizeFindings(mk(2), 'solution', 8);
  for (const f of d) { assert.equal('severity' in f, false); assert.equal(f.tag, '논리오류'); }   // 결함 경로는 폴백
});

test('61h T4 — mergeCandidates: 같은 인용은 같은 severity 안에서만 합쳐진다 · id 재부여', () => {
  const d = (q) => ({ id: 'x', tag: '계산오류', quote: q, reason: 'r' });
  const g = (q) => ({ id: 'y', tag: '중복서술', quote: q, reason: 'r', severity: 'garbage' });
  assert.equal(V.mergeCandidates([[d('같은 인용')], [d('같은  인용')]], 26).length, 1);      // 종전 동작(첫 고정)
  const both = V.mergeCandidates([[d('같은 인용')], [g('같은 인용')]], 26);
  assert.equal(both.length, 2);                                                             // 축이 다르면 둘 다
  assert.deepEqual(both.map((c) => c.id), ['c1', 'c2']);
  assert.deepEqual(both.map((c) => c.severity), [undefined, 'garbage']);
  const three = V.mergeCandidates([[d('a'), d('b')], [g('c')]], 26);
  assert.deepEqual(three.map((c) => [c.id, c.quote]), [['c1', 'a'], ['c2', 'b'], ['c3', 'c']]);   // 결함 앞, 군더더기 뒤
});

test('61h T5 — splitBySeverity: 순서·id 보존, 합집합 = 입력, severity 없음 = 결함', () => {
  const cands = [
    { id: 'c1', tag: '계산오류', quote: 'a', reason: 'r' },
    { id: 'c2', tag: '중복서술', quote: 'b', reason: 'r', severity: 'garbage' },
    { id: 'c3', tag: '논리비약', quote: 'c', reason: 'r' },
  ];
  const { defect, garbage } = V.splitBySeverity(cands);
  assert.deepEqual(defect.map((c) => c.id), ['c1', 'c3']);
  assert.deepEqual(garbage.map((c) => c.id), ['c2']);
  assert.equal(defect.length + garbage.length, cands.length);
  assert.deepEqual(V.splitBySeverity([]), { defect: [], garbage: [] });
});

test('61h T7 — 프롬프트 문구: 1차는 재현율 문구가 없고, 2차는 escalate·확신할 때만', () => {
  const g1 = P.PROMPT_SOLUTION_FIRST_GARBAGE.system;
  for (const s of ['무관서술', '중복서술', '느슨한서술', '삭제 검사', '동치 검사', '(heading)', '(coach_important)', '최대 6개']) {
    assert.ok(g1.includes(s), `군더더기 1차: ${s}`);
  }
  // ⚠ recallRules의 문장이 실제로 이 문자열인지 먼저 확인한다 — 문구가 바뀌면 부재 단언이 공허해진다
  assert.ok(P.PROMPT_SOLUTION_FIRST_LOGIC.system.includes('놓치는 쪽이 훨씬 나쁩니다'), '기준 문장 실재');
  assert.ok(!g1.includes('놓치는 쪽이 훨씬 나쁩니다'), '군더더기 1차에 결함 재현율 문구를 넣지 않는다');
  assert.ok(!g1.includes('의심되면 올리십시오'), '군더더기 1차에 결함 재현율 문구를 넣지 않는다');

  const g2 = P.PROMPT_GARBAGE_JUDGE.system;
  for (const s of ['escalate', 'escalate_tag', '확신할 때만 valid', '삭제 검사', '동치 검사']) {
    assert.ok(g2.includes(s), `군더더기 2차: ${s}`);
  }
  assert.ok(!g2.includes('애매해 보인다'), '시트 V2의 uncertain 조임 문구는 이식하지 않는다');
  // D4 — 결함 판정자는 한 글자도 안 바뀐다: 61g T5의 단언이 그대로 통과한다
  assert.ok(P.PROMPT_JUDGE.system.includes('가리지 못하면 "uncertain"입니다'));
  assert.ok(!P.PROMPT_JUDGE.system.includes('escalate'), 'PROMPT_JUDGE에 escalate를 넣지 않는다');
});

test('61h T8 — indexJudgments: suggestion·escalate·escalateTag (escalate는 === true만)', () => {
  const m = V.indexJudgments([
    { id: 'c1', ruling: 'valid', note: 'n', suggestion: '\\frac{1}{2}로', escalate: true, escalate_tag: '충분성미확인' },
    { id: 'c2', ruling: 'invalid', note: 'n', escalate: 'true' },
    { id: 'c3', ruling: 'uncertain' },
  ]);
  assert.deepEqual(m.c1, { ruling: 'valid', note: 'n', suggestion: '\\frac{1}{2}로', escalate: true, escalateTag: '충분성미확인' });
  assert.equal(m.c2.escalate, false);            // 문자열 'true'는 거짓
  assert.equal(m.c2.escalateTag, '');
  assert.deepEqual(m.c3, { ruling: 'uncertain', note: '', suggestion: '', escalate: false, escalateTag: '' });
  // 기존 호출부 호환 — ruling·note는 그대로
  assert.equal(m.c1.ruling, 'valid');
});
