# Phase 61h — 정밀 검증 군더더기(garbage) 검출 구현 계획서 v2 착수판 (덕수 확정 · Mathory 선착수)

작성일: 2026-09-10 · 작성: web
기준 커밋: **mathory `be03c40`** (main — Phase 61g 구현 완료·검수 대기, Phase 64 검수 진행 중)
계보: v1(2026-09-09) → **v2 = 덕수 결정 반영** — ① 결정 D1~D11 전부 권장안대로 확정 ② **착수 순서 역전: Mathory 먼저, gas-project-audition은 후속**
(2026-09-10) ③ CLI 착수 점검 항목(§9) 추가
짝 문서: `audition STEP4 해설 군더더기 검출 구현 계획서 v2 (논리 분리·운영 통합)` — 정의·판정 잣대·프롬프트 골격 공유. 순서가 바뀌어 **이번엔 이 파일
(`lib/verify/prompts.ts`)이 군더더기 두 프롬프트의 원본**이고 시트가 나중에 이식한다(61g의 예외에서 61b 기본 규칙으로 복귀).

> **v2의 성격**: v1의 설계(별도 축 · 1차 3패스 · 2차 판정자 2개 병렬 · `report.garbage` · 종합 판정 무영향)는 그대로다. 바뀐 것은 ① 순서 역전이 프롬프트
> 계보·프로브 대조군·문서 규약에 미치는 영향(§1) ② 구현 항목을 **CLI가 그대로 옮길 수 있는 시그니처 수준**으로 내린 것(§5) ③ 61g v4→v5의 "착수 점검"
> 관례대로 CLI가 먼저 확인할 사실 목록(§9). 다음 판은 관례대로 **CLI 실측 교차검토(v3)** → 착수. 프롬프트 문안은 프로브에서 확정(61b 방침).

---

## 0. 요약

덕수의 정의: **결론에 영향을 주지 않아도** ① 결론과 관련 없는 불필요한 서술 ② 앞선 결론에 새 내용을 보태지 않는 중복 서술(중언부언) ③ 필요충분조건으로
명료하게 이을 수 있는데도 필요조건만으로(또는 충분조건만으로) 이어 간 게으르고 느슨한 서술 — 은 군더더기다.

> **군더더기는 결함 파이프라인에 태그 3개를 얹는 것이 아니라, 같은 뼈대(1차 후보 → 2차 판정 → 코드 합성)를 쓰는 별도 축이다.**
> 종합 판정(`ok/check/fail`)에 영향을 주지 않고, 1차는 별도 패스(병렬), 2차는 별도 판정자(병렬), 리포트는 별도 절(`report.garbage`)에 실린다.

구현: **프롬프트 2개 신설 + 1차 패스 1개 + 2차 호출 1개 + `VerifyReport.garbage`(additive) + 카드 절 1개 + 테스트 8건 + 프로브.**
**Firestore 규칙 0 · `VerificationState` 0 · 목록 배지 0 · 일괄 검증(61d) 0 · 그림 경로(61f) 0 · 클라 흐름(`verifyFlow.ts`) 0 ·
61b/61g 결함 프롬프트 2개(`PROMPT_SOLUTION_FIRST_LOGIC`·`PROMPT_JUDGE`) 무변경.** 수정 6파일 · 신규 0 · 커밋 S1~S5.

---

## 1. v1 → v2 변경 요지

| 항목 | v1 | v2 | 이유 |
|---|---|---|---|
| 결정 D1~D11 | D1·D2·D4·D5·D6·D7 확정 대기 | **전부 권장안대로 확정**(§4 표) | 2026-09-10 덕수 |
| 착수 순서(D10) | 시트 STEP4 먼저 → Stack Z/AA가 프로브 대조군 | **Mathory 먼저** → 대조군 없이 착수, 시트가 뒤따라 이식 | 덕수 결정 |
| 프롬프트 원본 | 시트 pmt(61g 계보) | **`prompts.ts`** — 헤더 계보 주석에 "군더더기 두 프롬프트는 이 파일이 원본, 시트 STEP4가 이식(61b 기본 규칙)" | 순서 역전 |
| 프로브 `--glabel` | 이번 범위 | **보류** — 시트 STEP4 착수 시 추가(Stack Z/AA가 생긴 뒤에야 의미) | 대조군 없음 |
| 프로브 측정 | 대조군 일치율 | 후보 수·확정/확인/기각·escalate·태그 분포·**시간**만 기록 + **눈으로 읽기** | Stage 3 |
| 태그 정규화 힌트 | 시트 키 3종 수용 | 동일 — 시트가 나중에 같은 키(`irrelevant`·`redundant`·`loose_equivalence`)를 쓰도록 **이 문서가 키를 확정**한다 | 양방향 호환 |
| 구현 항목 | 방향 서술 | **시그니처·분기 수준**(§5) + CLI 착수 점검(§9) | 착수판 |
| 나머지 | — | 동일(정의·잣대·설계·프롬프트 본문·카드·테스트 항목·위험) | |

---

## 2. 군더더기의 운영 정의 (v1 §1 — 확정)

| # | 태그 | 시트 키(후속) | 덕수 정의 | 판정 검사 | valid 조건 |
|---|---|---|---|---|---|
| ① | `무관서술` | `irrelevant` | 결론과 관련 없는 불필요한 서술 | **삭제 검사** — 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지 논증이 완결되는가 | 완결되고, 지운 정보가 뒤 어디에서도 쓰이지 않는다 |
| ② | `중복서술` | `redundant` | 앞선 결론에 새 내용을 보태지 않는 되풀이 | 삭제 검사 + **새 정보 검사** | 앞 서술과 정보가 같고(말만 다름), 지워도 완결된다 |
| ③ | `느슨한서술` | `loose_equivalence` | ⟺로 이을 수 있는데 한쪽 조건만으로 이어 간 서술 | **동치 검사** — ⟺ 한 줄로 쓸 수 있고 고교 과정에서 자명하게 참인가 | 동치가 참·자명, 원문은 한쪽 방향만, **결론은 옳다** |

**경계는 하나 — 결론이 안전한가.** 위태로우면 결함(`논리오류`·`충분성미확인`, 논리 패스 몫), 안전하면 군더더기. 같은 자리에 결함 후보와 군더더기 후보가
둘 다 올라올 수 있다(두 패스는 독립, 병합에서 합치지 않는다). 군더더기 판정자가 "이건 결함이다"를 보면 escalate → `check` 결함(D5).

**군더더기가 아닌 것**(프롬프트 [4] — D7 확정): 조건 기호화·정리(이후 쓰이면) · 정의·표기 선언 · 경우 나눔 표지와 경우별 종합 · 답 확정 문장 ·
**필요조건 축소 뒤의 충분성 확인(검산)** — 동치 변형 뒤의 검산만 `중복서술` 후보 · 문체·길이 자체 · **`(heading)`·`### 제목`·`(coach_important)`·
`(coach_caution)`·`(callout)` 블록**(Phase 58/59의 구조 표지 — 안의 문장도 대상 아님; `(case)`/`(subcase)`는 표지만 제외) · 그림 참조·`[그림 k]`.

---

## 3. 설계 — 한눈에 (v1 §3, 불변)

```
[1차 · Gemini · 병렬 3]     [병합]                       [2차 · Claude · 병렬 2]            [합성 · 코드]
 CALC  (cap 8)  ─┐                                     ┌─ PROMPT_JUDGE (무변경) ────┐
 LOGIC (cap 12) ─┼─ defect ≤20 ─┐                       │   valid/invalid/uncertain   │→ findings → synthesizeVerdict → verdict
 GARBAGE (cap 6)─┘  garbage ≤6 ─┴─ 이어 붙여 id 재부여 ─┤                             │
                                                       └─ PROMPT_GARBAGE_JUDGE ──────┘→ report.garbage[]  (verdict 무영향)
                                                           escalate → findings에 check 결함
```
요청은 여전히 두 번(`first` → `judge`), 클라이언트 무변경. 판정자 둘 중 하나라도 실패하면 리포트 전체 실패(61b D13′ — 반쪽 리포트를 만들지 않는다).

---

## 4. 결정 사항 — 확정표 (2026-09-10)

| # | 결정 | 상태 |
|---|---|---|
| D1 | 태그 `무관서술`·`중복서술`·`느슨한서술`, 별도 `GARBAGE_TAGS`(`SOLUTION_TAGS`에 섞지 않음), 폴백 `무관서술` | **확정** |
| D2 | 종합 판정 무영향 — `synthesizeVerdict`에 결함 `findings`만. `✓ 이상 없음 · 군더더기 3건` 가능 | **확정** |
| D3 | 1차 3번째 패스, `Promise.all` | 확정(기본안) |
| D4 | 2차 별도 판정자 `PROMPT_GARBAGE_JUDGE`, `PROMPT_JUDGE`와 병렬. `PROMPT_JUDGE`·`CONSERVATIVE_RULES` 한 글자도 안 바꾼다 | **확정** |
| D5 | escalate → `findings`에 `{verdict:'check', tag: normalizeTag(escalate_tag,'solution')}` — `fail`은 절대 아니다 | **확정** |
| D6 | 군더더기 uncertain은 남긴다(`check`, "확인 필요"), 종합 판정 무영향. 프로브에서 절반 넘으면 v3에서 버림 | **확정** |
| D7 | 제외: ① 동치 뒤 검산만 후보 ② 조건 정리 제외 ③ 구조 블록 제외(프롬프트 문장으로; 오탐 실측 시 텍스트 치환으로) | **확정** |
| D8 | `CAP_GARBAGE = 6` · `MERGE_CANDIDATE_CAP = 8+12+6 = 26` | 확정(기본안) |
| D9 | `VerifyReport.garbage?: VerifyFinding[]`(additive) · 카드에만 · `VerificationState`·배지 무변경 | 확정(기본안) |
| D10 | ~~시트 먼저~~ → **Mathory 먼저**. 프롬프트 원본 = `prompts.ts`. 프로브는 대조군 없이 기록 | **변경·확정** |
| D11 | 정렬 느슨한서술 → 중복서술 → 무관서술, 같은 태그 안은 절약 분량 큰 것부터 | 확정(기본안) |

---

## 5. 구현 항목 (착수판 — 시그니처 수준)

### 5-1. `lib/verify/prompts.ts` (import 0 유지)

```ts
// 상한 — ⚠ 프롬프트 객체보다 앞줄 (61g S12)
const CAP_GARBAGE = 6;   // 61h D8. 군더더기는 모든 해설에 조금씩 있어 상한을 먼저 채운다 — 정렬 지시(D11)와 짝
export const MERGE_CANDIDATE_CAP = CAP_CALC + CAP_LOGIC + CAP_GARBAGE;   // 병합은 자르지 않는다(61g E1)

/** 군더더기 1차 전용. ⚠ recallRules와 다르다 — "놓치는 쪽이 훨씬 나쁘다"·"오탐은 의도된 것"이 **일부러 없다**.
 *  군더더기의 비용 계산은 결함과 반대다(놓쳐도 틀리지 않는다). 이 함수에 그 문장을 옮겨 오지 말 것. */
const garbageRecallRules = (cap: number) => `### 후보 생성 원칙 (당신의 역할)
- 당신은 **후보를 올리는 사람**이고, 확정은 다음 단계의 판정자가 합니다. 위 [3]의 검사를 스스로 해 보고 통과할 것 같으면 올리십시오.
  확실한 것만 올리지는 마십시오 — 걸러 내는 일은 다음 단계가 합니다.
- 다만 문체 취향은 올리지 않습니다. [4]에 해당하는 것은 올리지 않습니다.
- 각 후보는 "이 대목은 없어도 된다(또는 한 줄로 이을 수 있다)"는 주장입니다. quote에 그 대목을, reason에 삭제 검사·동치 검사의
  결과를 한두 문장으로 적습니다.
- 후보는 **최대 ${cap}개**. 확신이 큰 것부터 적습니다.`;   // ⚠ "최대 N개" 문자열은 T6가 cap과 대조한다

export const PROMPT_SOLUTION_FIRST_GARBAGE = {
  cap: CAP_GARBAGE,
  severity: 'garbage' as const,     // 라우트·프로브가 sanitizeFindings 4번째 인자로 넘긴다. CALC·LOGIC에는 두지 않는다(없음 = defect)
  system: `…§6-1…`,
  user: `…`,
};
export const SOLUTION_FIRST_PASSES = [PROMPT_SOLUTION_FIRST_CALC, PROMPT_SOLUTION_FIRST_LOGIC, PROMPT_SOLUTION_FIRST_GARBAGE];

export const PROMPT_GARBAGE_JUDGE = { system: `…§6-2…`, user: `…` };   // cap 없음 — T6 대상 아님(S13과 동일)
```
- 배열 원소 타입이 합집합이 되므로 `SOLUTION_FIRST_PASSES`의 소비처는 `pass.severity`를 옵셔널로 읽는다(`(pr as {severity?: 'garbage'}).severity` 대신
  세 객체에 공통 인터페이스 `FirstPass { cap: number; severity?: 'garbage'; system: string; user: string }`를 선언해 `as const` 없이 타입을 맞춘다 — §9-①).
- 헤더 주석 계보: "**Phase 61h**: 군더더기 두 프롬프트(`PROMPT_SOLUTION_FIRST_GARBAGE`·`PROMPT_GARBAGE_JUDGE`)는 **이 파일이 원본**이고 시트 STEP4
  (`pmt` `gemini_garbage_verify_*`·`claude_garbage_judge_*`)가 이식한다 — 61g 예외(시트가 앞섬)와 달리 기본 규칙이다. 시트 type 키는
  `irrelevant`·`redundant`·`loose_equivalence`로 정했고 `normalizeGarbageTag`가 그 키를 받는다."
- `recallRules`·`CONSERVATIVE_RULES`·`PROMPT_JUDGE`·`formatCandidatesForJudge` 무변경.

### 5-2. `lib/verify/parse.ts` (import 0 유지)

```ts
export const GARBAGE_TAGS = ['무관서술', '중복서술', '느슨한서술'] as const;   // 61h D1 — SOLUTION_TAGS(결함 어휘)와 섞지 않는다

/** ⚠ normalizeTag와 별도다 — 그쪽 폴백은 `논리오류`라 군더더기가 결함으로 샌다. 시트 키·한글 변형을 받는다. */
export function normalizeGarbageTag(raw: string): string {
  const t = String(raw ?? '').trim();
  if ((GARBAGE_TAGS as readonly string[]).includes(t)) return t;
  const low = t.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => t.includes(k) || low.includes(k));
  if (has('느슨', 'loose', 'equiv', '필요', '충분', 'necess', 'suffic')) return '느슨한서술';
  if (has('중복', '중언', 'redund', 'repet', 'duplic')) return '중복서술';
  if (has('무관', '불필요', 'irrelev', 'unrelat', 'unnecess')) return '무관서술';
  return '무관서술';
}

export interface RawFinding { …기존…; severity?: 'garbage'; }   // 없음 = defect. 클라를 불투명하게 왕복한다

export function sanitizeFindings(arr: unknown, kind: VerifyKind, cap = 8, severity?: 'garbage'): RawFinding[]
  // tag: severity === 'garbage' ? normalizeGarbageTag(raw) : normalizeTag(raw, kind)
  // out.push({ …, ...(severity ? { severity } : {}) })

export function mergeCandidates(lists: RawFinding[][], cap: number): RawFinding[]
  // key = `${c.severity ?? 'defect'}|${normalizeForQuoteCheck(c.quote) || `\u0000${c.reason}`}`   (구분자 '|'로 severity와 인용을 가른다)
  // → 같은 인용의 defect·garbage 후보가 둘 다 남는다. 순서는 이어 붙이기 그대로(결함 앞, 군더더기 뒤). 그 외 무변경.

export function splitBySeverity(cands: RawFinding[]): { defect: RawFinding[]; garbage: RawFinding[] }
  // 순수 함수. 라우트·프로브 공용(사본 금지). id는 건드리지 않는다 — 2차는 병합 후 id로 맞물린다.

export interface Judgment { ruling: Ruling; note: string; suggestion: string; escalate: boolean; escalateTag: string }
export function indexJudgments(arr: unknown): Record<string, Judgment>
  // suggestion: repair+trim · escalate: === true 만 true · escalateTag: String(j.escalate_tag ?? '').trim()
  // ⚠ 기존 호출부(route.ts)는 {ruling, note}만 읽으므로 필드 추가는 호환. route의 pickSuggestion은 그대로 둔다(회귀 0).
```
`synthesizeVerdict`·`normalizeTag`·`allowedTags`·`anchorByQuote`·`findQuoteRange` 무변경.

### 5-3. `app/api/verify/route.ts`

- import에 `PROMPT_GARBAGE_JUDGE`·`splitBySeverity`·`normalizeTag` 추가.
- `phase='first'`: `sanitizeFindings(p.json.candidates, kind, p.pass.cap, p.pass.severity)` — 인자 하나. `passes.map`·짝짓기·skip·"후보 0 → ok" 무변경
  (군더더기 후보만 있어도 `candidates.length > 0`이라 2차로 간다 — 의도).
- `runJudge`:
  ```ts
  const { defect, garbage } = splitBySeverity(candidates);
  const anchors = new Map(candidates.map((c) => [c.id, anchorByQuote(c.quote, targetBlocks)]));   // id 키 — 두 배열에서 공용
  // 예산 검사 1회 그대로
  const [dRes, gRes] = await Promise.all([
    defect.length  ? judge.complete(PROMPT_JUDGE.system,         fill(PROMPT_JUDGE.user,         defect),  JUDGE_MAX_TOKENS, judgeOpts) : null,
    garbage.length ? judge.complete(PROMPT_GARBAGE_JUDGE.system, fill(PROMPT_GARBAGE_JUDGE.user, garbage), JUDGE_MAX_TOKENS, judgeOpts) : null,
  ]);
  // 각각: truncated → 502 · judgments 배열 아님 → 502 (61b D13′ — 하나라도 실패하면 리포트 없음)
  ```
  `judgeOpts`는 현행 객체 그대로(`thinking:'adaptive'`·`effort:'high'`·`enableCodeExecution`·`images`). 토큰·비용은 둘의 합.
- 합성:
  ```ts
  const findings: VerifyFinding[] = [];  const garbageOut: VerifyFinding[] = [];
  defect.forEach((c) => { …현행 루프 그대로 (rulings = indexJudgments(dRes.judgments))… });
  garbage.forEach((c) => {
    const j = gRul[c.id]; const ruling = j?.ruling ?? 'uncertain'; const a = anchors.get(c.id)!;
    if (j?.escalate) {                       // D5 — 결함 의심은 사람이 본다. fail은 절대 아니다.
      findings.push({ tag: normalizeTag(j.escalateTag, 'solution'), verdict: 'check', blockKey: a.blockKey,
                      quote: c.quote, reason: j.note || c.reason, quoteFound: a.found });
      return;
    }
    if (ruling === 'invalid') return;
    garbageOut.push({ tag: c.tag, verdict: ruling === 'valid' && a.found ? 'fail' : 'check', blockKey: a.blockKey,
                      quote: c.quote, reason: j?.note || c.reason, ...(j?.suggestion || c.suggestion ? { suggestion: j?.suggestion || c.suggestion } : {}),
                      quoteFound: a.found });
  });
  report(kind, synthesizeVerdict(findings), findings, { …, garbage: garbageOut })
  ```
- 라우트 로컬 `VerifyReport`에 `garbage?: VerifyFinding[]`, `report()`는 `garbage.length`일 때만 싣는다(옛 형태와 바이트 호환).
- `models.judge`는 어느 판정자든 불렸으면 `env.claudeModel`(둘 다 같은 모델). `FIRST_MAX_TOKENS` 8k **불변**(61b 규약) — 군더더기 패스도 8k.

### 5-4. `types/problem.ts`

`VerifyReport`에 `garbage?: VerifyFinding[];` + 주석 "Phase 61h — 군더더기. 종합 판정에 들어가지 않는다. `verdict`는 fail=확정/check=확인 필요로 읽는다.
옛 리포트에는 없다." `VerifyFinding`·`VerifyVerdict`·`VerificationState` 무변경.

### 5-5. `components/comment/VerifyReportCard.tsx`

- `buildReportMarkdown`: `const g = report.garbage?.length ?? 0;` → 머리에 `(g > 0 ? ` · 군더더기 ${g}건` : '')`. quote·derivedAnswer는 여전히 넣지 않는다.
- 카드: 결함 `findings.map(FindingRow)` 아래, `g > 0`이면
  ```
  wrapper(marginTop 8 · paddingTop 8 · borderTop 1px var(--border-light))
    머리줄(fontSize 11 · var(--text-muted)): "군더더기 {g}건" + (var(--text-faint)) "· 종합 판정에 영향 없음"
    report.garbage.map((f, i) => FindingRow{ finding: f, index: i+1, severity: 'garbage', onJumpToBlock })
  ```
- `FindingRow`에 `severity?: 'garbage'` prop. 칩 색: garbage면 `fail`(확정)은 `background: var(--bg-warn)` · `color: var(--text-secondary)`, `check`는 기존
  `--bg-secondary`·`--text-secondary` + "확인 필요" 꼬리표. **`--accent-danger` 계열은 쓰지 않는다.** 카드 좌측 띠·머리 아이콘은 결함 verdict만 따른다.
  ⚠ 팔레트 밖 색 금지(M6 3차 검수 규약) — 신규 토큰 0. `MathText` memo·모듈 상수 style·드래그 보호 규약은 `FindingRow` 재사용으로 자동.

### 5-6. `tests/verify.test.mjs` (+8, 46 → 54)

| # | 단언 |
|---|---|
| T1 | `GARBAGE_TAGS` 3종 · `normalizeGarbageTag`: `irrelevant`→무관서술 · `redundant`→중복서술 · `loose_equivalence`→느슨한서술 · `중언부언`→중복서술 · `불필요`→무관서술 |
| T2 | 격리: `normalizeGarbageTag('')`·`('logic_gap')` → `무관서술`(폴백) · `normalizeTag('느슨한서술','solution')`은 `SOLUTION_TAGS` 안의 값(=폴백 `논리오류`)이지 군더더기 태그가 아니다 |
| T3 | `sanitizeFindings(arr,'solution',6,'garbage')` — `severity:'garbage'` 실림 · 7건 → 6건 · `severity` 미지정이면 필드 없음 |
| T4 | `mergeCandidates([[d(q)], [g(q)]], 26)` → 2건(같은 인용, 다른 severity) · `[[d(q)],[d(q)]]` → 1건 · id 재부여 `c1,c2` |
| T5 | `splitBySeverity` — 순서·id 보존, 합집합 = 입력 |
| T6′ | `SOLUTION_FIRST_PASSES` 3객체 `최대 ${cap}개` 일치 · `[calc, logic, garbage]` = 8·12·6 · `MERGE_CANDIDATE_CAP === 26` · `PROMPT_SOLUTION_FIRST_GARBAGE.severity === 'garbage'` · CALC·LOGIC에 `severity` 없음 |
| T7 | 문구: 군더더기 1차 system에 태그 3종·`삭제 검사`·`동치 검사`·`(heading)`·`(coach_important)`; **없어야 할 것** `놓치는 쪽이 훨씬 나쁩니다`. 2차 system에 `escalate`·`확신할 때만`. `PROMPT_JUDGE.system`은 61g T5 단언 그대로 통과 |
| T8 | `indexJudgments([{id:'c1',ruling:'valid',note:'n',suggestion:'s',escalate:true,escalate_tag:'충분성미확인'}])` → 전 필드 · `escalate:'true'`(문자열)는 false · 누락은 `''`/false |

⚠ 기존 T6가 `const [calc, logic] = P.SOLUTION_FIRST_PASSES; assert.equal(MERGE, calc.cap + logic.cap)`이라 **그대로 두면 실패한다** — T6′로 교체.

### 5-7. `scripts/verifyProbe.mjs`

- `sanitizeFindings(…, x.pass.cap, x.pass.severity)` · `splitBySeverity` · 판정 2회 `Promise.all`(둘 다 `V.buildClaudeParams`) · 합성을 라우트와 같은 모양으로.
- 결과 객체에 `garbage: []`·`escalated: n`. `printResult`에 `군더더기 m건` 절(태그·ruling·`제안`). 요약 표 열 추가: 군더더기 후보 평균 · 확정/확인/기각 ·
  escalate · **군더더기 판정 ms**(두 판정 중 최장이 벽시계).
- `--glabel`은 **넣지 않는다**(D10 — 시트 STEP4 뒤). 61g E3 교훈: 상한 리터럴 금지 — `pass.cap`·`MERGE_CANDIDATE_CAP`만.

### 5-8. 문서

- `CLAUDE.md`: Phase 61h 절 + 규약 4건 — ① 군더더기는 종합 판정에 안 들어간다(`synthesizeVerdict`에 `garbage`를 넘기지 말 것) ② 판정자는 둘,
  `PROMPT_JUDGE`·`CONSERVATIVE_RULES` 무변경, 성향이 반대라 합치지 말 것 ③ 구조 블록(`heading`·coach·callout)은 대상이 아니다 ④ escalate는 `check`까지만.
  61b 절 "풀이 1차는 계산·표기 / 논리 두 패스" → "세 패스(+군더더기)". 프롬프트 계보 규약에 "군더더기 두 프롬프트의 원본은 `prompts.ts`".
- `docs/roadmap.md` 61h 절 · 확정본을 `docs/phasedocs/`로(규칙 7).

### 5-9. 커밋 분할

| # | 범위 | 내용 |
|---|---|---|
| S1 | `prompts.ts` · `parse.ts` · `verify.test.mjs` | 상한·`garbageRecallRules`·프롬프트 2·`FirstPass` 타입 · `GARBAGE_TAGS`·`normalizeGarbageTag`·`severity`·병합 키·`splitBySeverity`·`Judgment` · 테스트 8(T6 교체) |
| S2 | `route.ts` · `types/problem.ts` | 패스 3 · 판정 2 병렬 · 합성 분리 · escalate · `garbage` |
| S3 | `VerifyReportCard.tsx` | 군더더기 절 · 요약 폴백 · 칩 색 |
| S4 | `verifyProbe.mjs` | 상한·severity·판정 2·출력 |
| S5 | `CLAUDE.md` · `roadmap.md` · phasedocs | 규약 4 · 61h 절 · 실행판 §11 |

S2가 S1의 export를 쓰므로 순서 고정. S1 단독으로 `npm run test:verify` 54건이 돌아야 한다.

### 5-10. 건드리지 않는 것 (확인)

`PROMPT_SOLUTION_FIRST_CALC`·`_LOGIC`·`PROMPT_JUDGE`·`CONSERVATIVE_RULES`·`recallRules`(문자열 무변경 — 61g T5 그대로 통과) · `synthesizeVerdict` ·
`anchorByQuote`·`findQuoteRange` · `lib/verifyFlow.ts`(`first.candidates`를 불투명하게 되돌린다 — `severity`가 그대로 왕복) · `lib/batchVerify.ts`·
`lib/verify/batchPlan.ts` · `VerifyBadge`·`listColumns.verifyRank`·`BatchVerifyDialog`·`PhoneList` · `VerificationState` · `lib/verify/figures.ts`·
`figureFetch`(4번째 호출도 `passes.map`이 같은 첨부를 실어 간다) · `providerParams.ts`(바디 조립 무변경 — 스냅샷 13건 그대로) · Firestore 규칙.

---

## 6. 프롬프트 (착수판 — 프로브에서 확정)

### 6-1. `PROMPT_SOLUTION_FIRST_GARBAGE.system`

```
${SOLUTION_PREAMBLE}

### [1] 이번 검토의 범위 — **군더더기만**
이 검토는 풀이가 *틀렸는지*를 보지 않습니다. 계산·표기·논리 결함은 다른 검토자가 따로 봅니다.
여기서는 **결론에 영향을 주지 않더라도 없어야 할 서술** — 군더더기 — 를 찾습니다.
군더더기는 해설을 틀리게 만들지 않지만, 읽는 사람의 시간을 빼앗고 논증의 뼈대를 흐립니다.

### [2] 태그 (아래 셋 중 하나)
- "무관서술": 결론(최종 답)에 이르는 논증에 기여하지 않는 서술.
  · 답을 구하는 데 쓰이지 않는 양을 구하거나 성질을 밝힘
  · 문제가 묻지 않은 것에 대한 부연·일반론·배경 설명
  · 이후 어디에서도 쓰이지 않는 보조 결과
- "중복서술": 앞서 나온 결론에 새 내용을 보태지 않는 되풀이(중언부언).
  · 같은 사실을 말만 바꿔 다시 서술 · 이미 확정한 값을 다시 유도 · 앞 문장의 결론을 그대로 요약
  · 동치 변형만으로 확정된 답을 다시 대입해 확인하는 검산
    (⚠ 앞 단계가 필요조건으로의 축소였다면 검산은 **필요한 단계**이므로 여기 해당 없음 — 대신 그 앞 단계가 "느슨한서술"인지 봅니다)
- "느슨한서술": 필요충분조건(⟺)으로 한 줄에 명료하게 이을 수 있는데도 필요조건만으로(또는 충분조건만으로) 이어 간 뒤,
  빠진 방향을 나중에 따로 메우거나 자명하다고 넘긴 서술. **결론은 옳습니다.**
  · 예: "근이 존재하려면 $D \ge 0$이어야 한다"(필요)로 후보를 좁힌 뒤 "실제로 대입하면 성립한다"(충분)를 뒤에 붙임 —
    "$\iff D \ge 0$"으로 한 번에 갈 수 있는 자리
  · 예: "$a>0$이면 조건을 만족한다"(충분)로 답을 내고 $a \le 0$의 배제는 자명하다고 넘김 — 실제로는 "조건 $\iff a>0$"이 한 줄
  ⚠ 빠진 방향이 실제로 성립하지 않거나 확인되지 않아 **결론이 위태로우면** 그것은 군더더기가 아니라 결함입니다. 결함은 다른
    검토자의 몫이지만, 군더더기인지 결함인지 갈리지 않으면 **올리고** reason에 그 사실을 적으십시오 — 판정자가 가릅니다.
군더더기가 없으면 빈 배열을 반환합니다. 대부분의 잘 쓴 해설에는 군더더기가 없거나 한두 곳입니다.

### [3] 판정의 잣대 — 후보로 올리기 전에 스스로 적용합니다
- **삭제 검사**(무관서술·중복서술): 이 대목을 통째로 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지 논증이 완결되고,
  독자가 잃는 정보가 없는가? → 그렇다면 후보.
- **동치 검사**(느슨한서술): 이 단계를 $\iff$ 한 줄로 바꿔 쓸 수 있고 그 동치가 고교 과정 안에서 자명하게 참인가?
  그리고 지금 서술은 한쪽 방향만 말하고 있는가? → 그렇다면 후보.

### [4] 군더더기가 아닌 것 (지적하지 않습니다)
- 풀이 첫머리에서 문제 조건을 기호로 정리하는 것(이후에 쓰이면). 변수·기호·함수의 정의와 표기 선언.
- 경우 나눔의 표지("(i) $a>0$인 경우")와 경우별 결론의 종합. 최종 답을 확정하는 문장. 답의 형식을 맞추는 마지막 줄.
- 논증에 필요한 중간 결과의 **첫** 도출 — 길더라도 필요하면 군더더기가 아닙니다.
- 필요조건으로 좁힌 뒤의 충분성 확인(검산) — 논리적으로 필요한 단계입니다.
- 문체·어투·길이 자체. "짧게 쓸 수 있다"는 것만으로는 군더더기가 아닙니다 — 잣대는 "새 내용이 있는가 / 뒤에서 쓰이는가"입니다.
- `(heading)` 블록과 `### `로 시작하는 제목 줄, `(coach_important)`·`(coach_caution)`·`(callout)` 블록 — 구조와 지도를 위한
  표지이므로 대상이 아닙니다. 그 안의 문장도 지적하지 않습니다. `(case)`·`(subcase)` 블록은 표지("경우 1")만 제외하고 본문은 봅니다.
- 그림을 가리키는 문장, `[그림 k]` 자리표시자.

### [5] 인용(quote)과 제안(suggestion)
- 지워야 할 대목의 **첫 문장(또는 첫 절)**을 최소 길이로 인용합니다. 범위가 여러 문장이면 reason에 "…부터 …까지"로 범위를
  말로 적고 quote는 첫 대목만 — 인용은 원문에 실제로 있는 문자열이어야 위치를 찾을 수 있습니다.
- suggestion: 무관서술·중복서술은 "삭제" 또는 "앞 문장 '…'에 합치기"처럼 구체적으로. 느슨한서술은 $\iff$로 고쳐 쓴 한 줄 문안.

### [6] 후보 순서
느슨한서술 → 중복서술 → 무관서술. 같은 태그 안에서는 지웠을 때 절약되는 분량이 큰 것부터. 상한을 넘으면 앞의 것만 판정됩니다.

${garbageRecallRules(CAP_GARBAGE)}

${COMMON_RULES}

${SOLUTION_SCHEMA('중복서술')}
```

`user`:
```
[문제]
{problem}

[풀이]
{solution}

위 [문제]를 참으로 가정하고, [풀이]에서 **군더더기** 후보를 찾아라. 태그는 무관서술 · 중복서술 · 느슨한서술 셋 중 하나다.
풀이의 정오·계산·표기·논리 결함은 이번 검토 대상이 아니다. 각 후보에 삭제 검사 또는 동치 검사를 먼저 적용하라.
```

### 6-2. `PROMPT_GARBAGE_JUDGE`

`system`:
```
당신은 수능 수학 해설의 **군더더기 판정자**입니다. 앞 검토자가 "없어도 되는 서술" 후보를 올렸습니다. 후보를 하나씩 원문과 대조해
셋으로 가릅니다: 군더더기 확정(valid) · 아님(invalid) · 가리지 못함(uncertain).

### [0] 전제
- [문제]는 옳습니다. 풀이가 맞는지 틀린지는 판정 대상이 아닙니다 — 다만 후보가 실은 **결함**(빠진 방향이 성립하지 않아 결론이
  위태로움)이면 [2]의 escalate로 넘깁니다.
- 새 후보를 추가하지 않습니다. 주어진 id만 판정합니다.
- 군더더기의 비용은 작습니다. 놓쳐도 해설이 틀리지 않습니다. 그래서 **확신할 때만 valid**입니다. 확신이 없으면 uncertain으로 두고
  note에 무엇이 미결인지 적습니다. "짧게 쓸 수 있다"는 valid의 근거가 아닙니다 — 잣대는 새 내용과 쓰임입니다.

### [1] 판정 잣대 — 실제로 수행합니다
- **삭제 검사**(무관서술·중복서술): quote가 가리키는 대목을 머릿속에서 지우고, (문제 조건 + 남은 풀이)만으로 최종 답까지 논증이
  이어지는지 처음부터 다시 따라갑니다. 이어지고, 지운 대목의 정보가 뒤 어디에서도 쓰이지 않으면 valid. 뒤에서 한 번이라도 쓰이면
  invalid(note에 어디서 쓰이는지). 중복서술은 추가로 "앞 서술과 정보가 정말 같은가"를 확인합니다 — 값·범위·조건이 하나라도 새로
  확정되면 invalid.
- **동치 검사**(느슨한서술): 그 단계를 $\iff$ 한 줄로 스스로 써 봅니다. ① 그 동치가 참이고 고교 과정에서 한 줄로 정당화되며
  ② 원문은 한쪽 방향만 말하고 ③ 결론은 옳다(빠진 방향이 뒤에서 확인되거나 자명하다) → valid. ①이 거짓이거나 자명하지 않으면
  invalid(한 방향씩 가는 것이 정당한 서술). ③이 무너지면 → escalate.
- 다음은 invalid입니다: 조건 정리·정의·표기 선언 · 경우 나눔 표지 · 답 확정 문장 · 필요조건 축소 뒤의 검산 ·
  `(heading)`·`(coach_important)`·`(coach_caution)`·`(callout)` 블록의 내용.
- 후보의 reason을 그대로 믿지 마십시오. 원문을 직접 보고 검사를 직접 수행하십시오. 인용을 원문에서 찾지 못하면 uncertain.

### [2] escalate — 군더더기가 아니라 결함일 때
- 후보가 가리키는 자리가 실은 결함이면(빠진 방향이 성립하지 않음 · 확인되지 않은 채 결론이 확정됨 · 배제되지 않은 경우가 있음)
  ruling과 무관하게 "escalate": true, "escalate_tag"에 논리오류 · 충분성미확인 · 경우누락 · 근거없는가정 · 논리비약 중 하나,
  note에 왜 결론이 위태로운지를 적습니다. 이 후보는 사람에게 **'확인 필요' 결함**으로 보고됩니다(확정은 아닙니다).
- escalate가 아니면 "escalate": false, "escalate_tag": "".

### [3] note · suggestion
- note는 한두 문장. valid면 삭제 검사/동치 검사의 결과를, invalid면 왜 필요한 서술인지, uncertain이면 무엇이 미결인지.
- suggestion은 valid일 때만: 삭제할 범위("'…' 문장부터 '…' 까지 삭제") 또는 $\iff$로 고쳐 쓴 한 줄 문안. 그 외에는 빈 문자열.
- 수식은 $...$ LaTeX.

${COMMON_RULES}

### [4] 출력 스키마
받은 후보 **전부**에 대해, 받은 id를 그대로 써서 판정을 냅니다.
{"judgments": [{"id": "c1", "ruling": "valid", "note": "판정 근거 한두 문장", "suggestion": "수정 문안(없으면 빈 문자열)",
                "escalate": false, "escalate_tag": ""}]}
```

`user`:
```
[문제]
{problem}

[검토 대상]
{solution}

[제기된 후보]
{candidates}

각 후보에 삭제 검사 또는 동치 검사를 직접 수행해 valid / invalid / uncertain을 판정하라. 확신할 때만 valid다.
후보가 군더더기가 아니라 결함이면 escalate로 표시하라. 새 후보를 추가하지 마라.
```

⚠ 시트 STEP3 V2의 "'애매해 보인다'는 uncertain의 근거가 아니다"는 넣지 않는다(61g D5와 같은 이유 — uncertain은 사람에게 넘기는 정상 출구).

---

## 7. 검증 계획

**Stage 1 · 로직** — `npm run test:verify` 54건 · 프로젝트 `tsc --noEmit` · `aiProviderParams` 스냅샷 13건 무변경 · 프로덕션 빌드(`/api/verify` `ƒ` 유지).

**Stage 2 · 프로브(결함 쪽 회귀)** — `--flagged --kind solution --sample 10`. 결함 후보 수·기각률·태그 분포가 61g 기록 범위인가(두 결함 패스는 독립이라 같아야
한다 — 다르면 병합·id 회귀). **1차 최장 시간**(Gemini 동시 3호출) · **2차 최장 시간**(Claude 동시 2호출, 200초 문턱). n=10은 회귀·시간만.

**Stage 3 · 프로브(군더더기)** — `--flagged` 없이 10건. 대조군 없음(D10) → 기록만: 군더더기 후보 평균 · 확정/확인/기각 · escalate 건수 · **태그 분포**(중복서술만
나오고 느슨한서술 0이면 동치 검사 문구가 안 먹는 신호) · 후보 6 도달 비율. 리포트를 **눈으로** 읽어 D7 준수 — 특히 `### 제목`·coach 블록이 후보로 오르면
[4] 문장 강화, 그래도 오르면 v3의 텍스트 치환(`(heading — 검토 제외)`, 블록 번호 보존)으로. `check` 비율이 절반을 넘으면 D6 폴백 검토.

**Stage 4 · UI 1회** — 편집창 풀이 검증: 군더더기 절이 결함 아래 결함색 없이 뜨는지 · 확정/확인 필요 구별 · 클릭 점프(`quoteFound`) · 제안 문안 수식 렌더 ·
`이상 없음 · 군더더기 n건` 문항 1건 · escalate가 나오면 `check`·태그 확인 · 폰 기기 모드 카드 1회 · 그림 문항 1건(61f 무회귀).

**Stage 5 · 문서** — CLAUDE.md·roadmap·phasedocs. **Stage 6(후속)** — 시트 STEP4가 Stack Z/AA를 30행 이상 채우면 프로브 `--glabel` 추가·대조.

---

## 8. 위험·트레이드오프 (v1 §8 요지)

- **비용**: 풀이 검증 1회당 Gemini 3회(+1) · Claude ≤2회(+1). 시간은 병렬이라 불변, 토큰 약 1.5~1.8배. 일괄 검증에서 곱해진다. 군더더기 후보 0이면 Claude 1회.
- **Gemini 동시 3호출**: 429로 한 패스만 죽으면 "전부 실패일 때만 오류"에 걸리지 않고 진행된다(짝짓기 덕분에 상한도 안 어긋난다). 다만 죽은 군더더기 패스는
  "군더더기 없음"과 구별되지 않는다 — 계산·논리도 같은 침묵이라 61h 범위 밖, Stage 2에서 발생 빈도만 본다.
- **소음**: 2차 "확신할 때만 valid"가 방어선. D6 폴백은 코드 한 줄.
- **구조 블록 오탐**(D7-③): v1은 프롬프트 문장, 실측 후 필요하면 텍스트 치환.
- **느슨한서술 판정 난도**: uncertain이 많은 것이 정상 — 사람이 본다.
- **프롬프트 원본이 이쪽**(D10): 시트 STEP4가 이식할 때 이 파일의 커밋 해시를 pmt 행 비고에 적는다. 이후 문구 조정은 이 파일에서 하고 시트에 알린다.

---

## 9. CLI 착수 점검 (v3 교차검토에서 먼저 확인할 것 — 61g v4 §3-1 관례)

① **`SOLUTION_FIRST_PASSES` 원소 타입** — 세 객체 리터럴에 `severity`가 있고 없고가 갈리면 배열 타입이 합집합이 되어 `pr.severity` 접근이 `--strict`에서 막힐 수
있다. 공통 인터페이스 `FirstPass`를 선언해 세 객체에 붙일 것(`PROMPT_PROBLEM_FIRST`도 같은 타입). `route.ts`의 `passes` 변수(`kind==='problem' ? [PROBLEM] : SOLUTION_FIRST_PASSES`)가
그 타입으로 좁혀지는지 확인.
② **T6 교체** — 현행 T6의 `const [calc, logic] = …; assert.equal(MERGE, calc.cap + logic.cap)`은 그대로 두면 실패한다. T6′로 바꾼다(§5-6).
③ **`indexJudgments` 반환 타입 확장이 route의 기존 사용(`j?.ruling`·`j?.note`)과 프로브의 사용을 깨지 않는지** — 필드 추가라 호환이어야 한다.
④ **`mergeCandidates` 키 변경이 61g T4(인용 중복 한 건)를 통과하는지** — 같은 severity 안에서는 종전과 같아야 한다.
⑤ **`anchors`를 배열 인덱스에서 id 키 Map으로** 바꾸는 것이 현행 결함 루프의 `anchors[i]`와 같은 결과인지(병합 후 id는 유일하다).
⑥ **`report()` 헬퍼의 옵셔널 전개** — `garbage`가 비면 필드 자체가 없어야 옛 리포트와 JSON이 같다(카드 `extractVerifyReport`는 `findings` 배열만 검사하므로 어느 쪽이든 통과).
⑦ **프로브의 `buildClaudeParams` 2회 호출**이 `providerParams.ts`를 건드리지 않고 되는지(호출만 는다 — 스냅샷 13건 무변경이 조건).
⑧ **`.test-build`가 `prompts.ts`의 새 export를 무변경 하니스로 받는지**(61g에서 확인된 성질 — import 0 유지가 조건).
⑨ **카드 토큰 `--bg-warn`의 존재** — M6 3차 검수에서 신설된 토큰이다. 없으면 `--bg-secondary`로.
⑩ **Phase 64 폰 카드** — `PhoneApp` 댓글 시트가 같은 `VerifyReportCard`를 그린다. 절 추가로 시트 높이만 는다. 별도 코드 0인지 확인.

---

## 10. 이 Phase가 건드리지 않는 것

문제 검증(문제 본문의 군더더기는 별개 주제) · 계산·논리 패스와 `PROMPT_JUDGE` · 합성 규칙·어휘 · 앵커·인용 대조 · 그림 첨부(61f) · 일괄 검증(61d) ·
라우트 인증·예산·2요청 구조 · Firestore 규칙·스키마 · 목록 칼럼·배지 · `VerificationState` · 대화→편집창 삽입(61c) · GAS 쪽(후속 — 짝 문서 v2).

---

## 부록 A. Mathory 61h ↔ 시트 STEP4 (후속 이식 시 참조)

| Mathory 61h (원본) | 시트 STEP4 (이식) |
|---|---|
| `GARBAGE_TAGS` `무관서술`·`중복서술`·`느슨한서술` | `G_TYPES` 키 `irrelevant`·`redundant`·`loose_equivalence` (label 무관·중복·느슨) — 두 정규화가 서로의 키를 받는다 |
| `PROMPT_SOLUTION_FIRST_GARBAGE` (`[블록 n]`·`(heading)` 제외·suggestion은 Mathory 고유) | `gemini_garbage_verify_*` — 블록 조항 대신 "해설 첫 줄 정답 표기 제외" |
| `PROMPT_GARBAGE_JUDGE` | `claude_garbage_judge_*` |
| `report.garbage`, 종합 판정 독립 | Z verdict `clean/garbage/check`, U 독립 |
| escalate → `findings` `check` | escalate → Z `check` + AA `[결함의심n]` |
| `CAP_GARBAGE` 6 | `QCONFIG.G.MAX_CANDIDATES` 6 |

## 부록 B. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 운영 정의·잣대 · 대응 지점 실측 · 설계(별도 축·패스 3·판정자 2) · D1~D11 · 프롬프트 초안 · 검증 계획 |
| **v2** | **web** | 덕수 확정(D1~D11) · **Mathory 선착수**(D10 역전 — 프롬프트 원본 `prompts.ts`, `--glabel` 보류) · 시그니처 수준 구현 항목 · T6 교체 · CLI 착수 점검 ①~⑩ |

다음: CLI 실측 교차검토(v3) → 착수(S1~S5) → 프로브 Stage 2·3 → 덕수 검수 → 시트 STEP4(짝 문서 v2)로 이식.
