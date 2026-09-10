# Phase 61h — 정밀 검증 군더더기(garbage) 검출 구현 계획서 v4 실행판

작성일: 2026-09-10 · 작성: CLI (Claude Code)
기준 커밋: **mathory `be03c40`** (main — Phase 61g 구현 완료·검수 대기, Phase 64 검수 진행 중). 작업 트리의 코드 파일 무변경 확인.
계보: v1(web, 2026-09-09) → v2(web, 덕수 결정 반영·착수판) → v3(CLI 실측 교차검토 — 정정 E1~E9 · 보완 G1~G10 · 결정 N1~N5) → **v4 = 실행판** (N1~N5 전부 권장안으로 덕수 확정 2026-09-10 · §11이 구현·프로브 기록). 중간 판본 v1~v3는 `docs/phaseSketch/`.
짝 문서: `audition STEP4 해설 군더더기 검출 구현 계획서 v2 (논리 분리·운영 통합)` — 정의·판정 잣대·프롬프트 골격 공유. **이 파일(`lib/verify/prompts.ts`)이 군더더기 두 프롬프트의 원본**이고 시트가 후속 이식한다(D10).

> **v4의 성격**: v3 본문을 그대로 두고 §11(구현 기록·프로브 결과·검수 항목)을 붙였다. 아래 v3 서술의 "권장"은 전부 확정이다.
>
> **v3의 성격**: v2의 설계(별도 축 · 1차 3패스 · 2차 판정자 2개 병렬 · `report.garbage` · 종합 판정 무영향)와 결정 D1~D11은 그대로다.
> 바뀐 것은 실측으로 드러난 것뿐이다 — **v2 §5-2의 태그 정규화가 자기 테스트 T1을 통과하지 못한다(E3)**, **1차 게이트 두 개(전부 실패·skip)가
> 결함 패스 기준으로 옮겨져야 61b·61f 계약이 유지된다(E4)**, 수정 파일·테스트 수 정정(E1·E2), §9 점검 ⑩건의 실측 결과(§9). 프롬프트 본문은
> v2 §6을 그대로 잇고 문안은 프로브에서 확정한다(61b 방침). **N1~N5 전부 권장안으로 확정(2026-09-10) → 착수(S1~S5)** → 프로브 Stage 2·3 → 검수.

---

## 0. 요약

덕수의 정의: **결론에 영향을 주지 않아도** ① 결론과 관련 없는 불필요한 서술 ② 앞선 결론에 새 내용을 보태지 않는 중복 서술(중언부언) ③ 필요충분조건으로
명료하게 이을 수 있는데도 필요조건만으로(또는 충분조건만으로) 이어 간 게으르고 느슨한 서술 — 은 군더더기다.

> **군더더기는 결함 파이프라인에 태그 3개를 얹는 것이 아니라, 같은 뼈대(1차 후보 → 2차 판정 → 코드 합성)를 쓰는 별도 축이다.**
> 종합 판정(`ok/check/fail`)에 영향을 주지 않고(escalate 예외 — E5), 1차는 별도 패스(병렬), 2차는 별도 판정자(병렬), 리포트는 별도 절(`report.garbage`)에 실린다.

구현: **프롬프트 2개 신설 + 1차 패스 1개 + 2차 호출 1개 + `VerifyReport.garbage`(additive) + 카드 절 1개 + 테스트 7건 순증(T6 교체 포함 8건 손질) + 프로브.**
**Firestore 규칙 0 · `VerificationState` 0 · 목록 배지 0 · 일괄 검증(61d) 0 · 그림 경로(61f) 0 · 클라 흐름(`verifyFlow.ts`) 0 ·
61b/61g 결함 프롬프트 2개(`PROMPT_SOLUTION_FIRST_LOGIC`·`PROMPT_JUDGE`) 무변경.** 수정 **7파일**(코드) + 문서 3 · 신규 0 · 커밋 S1~S5.
로직 검증 80 → **87건**(`test:verify` 46 → 53).

---

## 1. v2 → v3 변경 요지

### 1-1. 정정 (E — v2가 틀렸거나 실측과 어긋난 것)

| # | v2 | 실측 | v3 |
|---|---|---|---|
| E1 | "수정 6파일" | 코드 7파일: `prompts.ts` · `parse.ts` · `route.ts` · `types/problem.ts` · `VerifyReportCard.tsx` · `verify.test.mjs` · `verifyProbe.mjs` (+ `CLAUDE.md` · `roadmap.md` · phasedocs) | **7파일 + 문서 3** |
| E2 | "테스트 +8, 46 → 54" | T6′는 기존 T6의 **교체**라 순증은 7. 하니스 전체는 `aiProviderParams` 13 + `verify` 46 + `figures` 21 = **80**(실행 확인 `pass 80`) | **46 → 53 · 전체 80 → 87**. CLAUDE.md 61b 절의 "46개 · 하니스 전체 80개"도 함께 고친다 |
| E3 | `normalizeGarbageTag`의 힌트 순서: 느슨(`'필요'`·`'충분'` 포함) → 중복 → 무관 | **`'불필요'.includes('필요')`가 참**이라 `불필요` → 느슨한서술, `unnecessary` → 느슨한서술(`necess` 매치). **v2 T1 자체가 실패한다**(실행 프로브 §9-E3) | 순서를 **무관 → 중복 → 느슨**으로, `'필요'`·`'충분'` 단독 힌트 **삭제**(`necess`·`suffic`·`loose`·`equiv`·`느슨`·`동치`·`iff`만). §5-2 |
| E4 | 1차 게이트(`firstParsed.every(json===null)` → 502 · `alive.every(skip)` → skip 리포트)를 "무변경" | 패스가 셋이 되면 두 게이트의 **의미가 바뀐다**: ① 결함 패스 둘 다 파싱 실패 + 군더더기 생존 → 502 대신 **"ok + 군더더기"** ② 결함 패스 둘 다 그림 의존 skip + 군더더기 미skip → `skip` 대신 **`ok`**. 둘 다 61b D13′·61f B-8 계약 위반이고 코드를 안 고치면 조용히 생긴다 | 두 게이트를 **결함 패스만**으로 판정(`p.pass.severity`가 없는 것). 군더더기 패스의 skip·실패는 "군더더기 없음"으로 흘린다. §5-3 · 결정 N1 |
| E5 | D2 "종합 판정 무영향" | escalate된 후보는 **`findings`에 `check`로 들어가 verdict를 `check`로 올린다**(D5의 귀결). 군더더기 *항목*은 무영향이 맞지만 문장이 과하다 | "군더더기 절(`report.garbage`)은 무영향. escalate는 결함이라 `check`까지 영향" — 카드 머리줄 문구는 군더더기 절에만 붙으므로 그대로 참 |
| E6 | §9-④ "`mergeCandidates` 키 변경이 61g T4(인용 중복 한 건)를 통과하는지" | 61g T4는 `sanitizeFindings`의 cap 테스트다. **`mergeCandidates` 중복 제거를 고정하는 기존 테스트는 0건** | 새 T4가 첫 테스트다 → **같은 severity의 중복 제거(1건)와 다른 severity의 병존(2건)을 한 테스트에** 넣는다 |
| E7 | §5-3 "`judgeOpts`는 현행 객체 그대로" | 현행은 `judge.complete(...)` 호출 안의 **인라인 리터럴**이지 변수가 아니다. `usdJudge`도 단일 호출값 | 리터럴을 `judgeOpts` 상수로 뽑아 두 호출이 공유 · `usdJudge`는 두 호출의 합 · `pickSuggestion(judgments, c)`는 결함 배열(`dRes.judgments`)로만 |
| E8 | Stage 3 "`--flagged` 없이 10건" | 프로브 기본 표본은 `--sample 3`이고 풀이 없는 행 제외는 `--kind solution`일 때만 | 명령을 고정: `node scripts/verifyProbe.mjs --sample 10 --kind solution` (Stage 2는 `--flagged --sample 10 --kind solution`) |
| E9 | §5-7 프로브 2차 "라우트와 같은 모양" | 프로브 `callClaude`는 `maxTokens: 16000` **리터럴**(라우트 `JUDGE_MAX_TOKENS` 32k)이고 `truncated`가 없다 — 61g가 못 본 **사본 하나 더**(1차 8000 주석과 같은 성질) | 이번엔 손대지 않는다(61g 측정과 연속성) — 주석으로 사본임을 명시. 결정 N3 |

### 1-2. 보완 (G — v2에 없던 것)

| # | 내용 |
|---|---|
| G1 | **61f D8 테스트 확장**: `verify.test.mjs`의 "이미지를 보지 못합니다 단정 없음" 테스트가 `[PROBLEM, ...SOLUTION_FIRST_PASSES, JUDGE]`를 훑는다 → 군더더기 1차는 자동 포함, **`PROMPT_GARBAGE_JUDGE`는 배열에 추가**(`COMMON_RULES` 포함이라 통과). 안 넣으면 그 판정자만 감시 밖 |
| G2 | `FirstPass` 인터페이스는 **`PROMPT_PROBLEM_FIRST`에도** 붙인다 — `route.ts`의 `passes`가 `kind==='problem' ? [PROBLEM] : SOLUTION_FIRST_PASSES`라 두 갈래 타입이 같아야 `p.pass.severity`가 좁혀진다(§9-① tsc 실증) |
| G3 | `phase='judge'`로 되돌아온 후보에 `severity`가 없는 옛 클라 → `splitBySeverity`가 전부 defect로 본다(호환). `정답불일치` c0 unshift·id 재부여는 문제 검증 전용이라 군더더기와 만나지 않는다 |
| G4 | escalate 태그 폴백: `normalizeTag('', 'solution')` = `논리오류`. escalate_tag가 비어 와도 `check` 결함으로는 남는다(D5 유지) — 카드에 `논리오류`로 찍히므로 note에 이유가 있어야 한다(2차 프롬프트 [2]가 이미 요구) |
| G5 | `buildReportMarkdown`의 `· 군더더기 n건`은 `BatchVerifyDialog`·`ProblemView`·`EditorView`가 같은 함수를 쓰므로 **일괄 검증 리포트에도 자동**으로 붙는다(코드 0). `BatchVerifyDialog` 요약은 `verdict`만 읽어 무변경 |
| G6 | 카드 `extractVerifyReport`는 `findings` 배열만 검사 → `garbage` 유무와 무관하게 통과(§9-⑥ 확인) |
| G7 | 프로브 출력: 군더더기 판정 파싱 실패를 결함 판정 실패와 **구분해 기록**(`error: '2차(군더더기) 응답 파싱 실패'`) — Stage 3의 "실패 빈도"를 세려면 갈라야 한다 |
| G8 | CLAUDE.md 규약 5건째: **"1차 게이트(전부 실패·skip)는 결함 패스 기준이다 — 군더더기 패스는 게이트에 참여하지 않는다"**(E4) |
| G9 | 시간: 1차 벽시계 = Gemini 3호출 중 최장, 2차 = Claude 2호출 중 최장. 군더더기 판정 입력은 후보 ≤6이라 결함 판정보다 짧을 것으로 예상 — Stage 2에서 **둘을 따로** 잰다 |
| G10 | `labelBlocks`는 `text`가 아닌 타입에만 `(type)`을 붙인다(`[블록 n] (heading)`) → 프롬프트 [4]의 "`(heading)` 블록" 표현은 모델이 실제로 보는 문자열과 일치. 단 heading 블록의 본문이 `### `로 시작하는지는 문항마다 다르므로 두 표현을 병기한 v2 문장은 유지 |

### 1-3. 결정 (N — **2026-09-10 덕수 확정: 전부 권장안**)

| # | 사안 | 권장 | 대안 |
|---|---|---|---|
| **N1** | 1차 게이트 기준(E4) | **결함 패스만**으로 전부실패·skip 판정. 군더더기 패스의 파싱 실패·skip은 "군더더기 없음"으로 흘리고 리포트 `note`에 남기지 않는다(계산·논리 한쪽 실패도 침묵이라 대칭) | 군더더기 패스 실패를 `note`에 "군더더기 검토 실패"로 고지 — 정보는 늘지만 "한쪽 결함 패스 실패는 침묵"과 비대칭 |
| **N2** | 군더더기 **판정자**(2차) 실패 시 | **결함 리포트를 살리고 군더더기 절만 뺀다** + `note: '군더더기 판정 실패 — 이번 리포트에 군더더기 절 없음'`. 근거: 별도 축이고 종합 판정 무영향이라 D13′("2차 미완 = 검증 아님")의 보호 대상(결함 판정)이 훼손되지 않는다. 1차 후보는 노출하지 않으므로 D13′의 이유도 지켜진다. 전체 실패로 두면 재시도가 1차 3호출 + 2차 2호출을 **통째로** 다시 쓴다 | v2 원안: 하나라도 실패하면 502(리포트 없음). 규약이 단순하고 CLAUDE.md 문장을 그대로 유지 |
| **N3** | 프로브 2차 `maxTokens 16000` 사본(E9) | **그대로**(61g 측정 연속성) + 사본임을 주석. 통일은 별건 | 이번에 `32000`으로 맞춘다 — 그러면 Stage 2의 결함 회귀 비교가 61g 기록과 조건이 다르다 |
| **N4** | escalate 결함의 출처 표시 | **`reason` 앞에 `[군더더기 검토에서 격상] `를 붙인다**(문자열 접두 — 스키마 0). 카드에서 결함 절에 섞이므로 왜 갑자기 결함이 됐는지 독자가 알아야 한다 | 무표시(note만) |
| **N5** | 군더더기 패스가 `skip`을 낼 수 있게 둘지 | **둔다**(`COMMON_RULES` 공유 — 문구를 갈라 두면 사본이 는다). N1로 게이트에서 빠지므로 무해 | 군더더기 1차 [4]에 "skip을 쓰지 않는다"를 추가 |

---

## 2. 군더더기의 운영 정의 (확정 · v2 §2 그대로)

| # | 태그 | 시트 키(후속) | 덕수 정의 | 판정 검사 | valid 조건 |
|---|---|---|---|---|---|
| ① | `무관서술` | `irrelevant` | 결론과 관련 없는 불필요한 서술 | **삭제 검사** — 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지 논증이 완결되는가 | 완결되고, 지운 정보가 뒤 어디에서도 쓰이지 않는다 |
| ② | `중복서술` | `redundant` | 앞선 결론에 새 내용을 보태지 않는 되풀이 | 삭제 검사 + **새 정보 검사** | 앞 서술과 정보가 같고(말만 다름), 지워도 완결된다 |
| ③ | `느슨한서술` | `loose_equivalence` | ⟺로 이을 수 있는데 한쪽 조건만으로 이어 간 서술 | **동치 검사** — ⟺ 한 줄로 쓸 수 있고 고교 과정에서 자명하게 참인가 | 동치가 참·자명, 원문은 한쪽 방향만, **결론은 옳다** |

**경계는 하나 — 결론이 안전한가.** 위태로우면 결함(`논리오류`·`충분성미확인`, 논리 패스 몫), 안전하면 군더더기. 같은 자리에 결함 후보와 군더더기 후보가
둘 다 올라올 수 있다(두 패스는 독립, 병합에서 합치지 않는다 — 병합 키에 severity가 들어간다). 군더더기 판정자가 "이건 결함이다"를 보면 escalate → `check` 결함(D5).

**군더더기가 아닌 것**(프롬프트 [4] — D7): 조건 기호화·정리(이후 쓰이면) · 정의·표기 선언 · 경우 나눔 표지와 경우별 종합 · 답 확정 문장 ·
**필요조건 축소 뒤의 충분성 확인(검산)** — 동치 변형 뒤의 검산만 `중복서술` 후보 · 문체·길이 자체 · **`(heading)`·`### 제목`·`(coach_important)`·
`(coach_caution)`·`(callout)` 블록**(안의 문장도 대상 아님; `(case)`/`(subcase)`는 표지만 제외) · 그림 참조·`[그림 k]`.

---

## 3. 설계 — 한눈에 (v2 §3 + E4 게이트)

```
[1차 · Gemini · 병렬 3]         [게이트 · 결함 패스만 — E4/N1]   [병합]              [2차 · Claude · 병렬 2]         [합성 · 코드]
 CALC   (cap 8)  ─┐ defect ─┬─ 전부 null → 502                 defect ≤20 ─┐        ┌─ PROMPT_JUDGE (무변경) ───┐
 LOGIC  (cap 12) ─┘         └─ 전부 skip → skip 리포트                       ├ id 재부여 ┤   valid/invalid/uncertain   │→ findings → synthesizeVerdict → verdict
 GARBAGE(cap 6)  ─── garbage (게이트 불참 · null/skip = 없음)  garbage ≤6 ─┘        └─ PROMPT_GARBAGE_JUDGE ─────┘→ report.garbage[] (verdict 무영향)
                                                                                         escalate → findings에 check 결함 (verdict에 영향 — E5)
```
요청은 여전히 두 번(`first` → `judge`), 클라이언트 무변경. 판정자 실패 처리는 N2.

---

## 4. 결정 사항 — 확정표 (v2 §4 그대로 · E5 주석)

| # | 결정 | 상태 |
|---|---|---|
| D1 | 태그 `무관서술`·`중복서술`·`느슨한서술`, 별도 `GARBAGE_TAGS`, 폴백 `무관서술` | 확정 |
| D2 | 종합 판정 무영향 — `synthesizeVerdict`에 결함 `findings`만. `✓ 이상 없음 · 군더더기 3건` 가능. **단 escalate 항목은 결함이라 `check`까지 영향(E5)** | 확정 |
| D3 | 1차 3번째 패스, `Promise.all` | 확정 |
| D4 | 2차 별도 판정자 `PROMPT_GARBAGE_JUDGE`, `PROMPT_JUDGE`와 병렬. `PROMPT_JUDGE`·`CONSERVATIVE_RULES` 한 글자도 안 바꾼다 | 확정 |
| D5 | escalate → `findings`에 `{verdict:'check', tag: normalizeTag(escalate_tag,'solution')}` — `fail`은 절대 아니다 | 확정 |
| D6 | 군더더기 uncertain은 남긴다(`check`, "확인 필요"). 프로브에서 절반 넘으면 실행판에서 버림 | 확정 |
| D7 | 제외: ① 동치 뒤 검산만 후보 ② 조건 정리 제외 ③ 구조 블록 제외(프롬프트 문장; 오탐 실측 시 텍스트 치환) | 확정 |
| D8 | `CAP_GARBAGE = 6` · `MERGE_CANDIDATE_CAP = 8+12+6 = 26` | 확정 |
| D9 | `VerifyReport.garbage?: VerifyFinding[]`(additive) · 카드에만 · `VerificationState`·배지 무변경 | 확정 |
| D10 | **Mathory 먼저**. 프롬프트 원본 = `prompts.ts`. 프로브는 대조군 없이 기록 | 확정 |
| D11 | 정렬 느슨한서술 → 중복서술 → 무관서술, 같은 태그 안은 절약 분량 큰 것부터 | 확정 |

---

## 5. 구현 항목 (v3 — 실측 반영 시그니처)

### 5-1. `lib/verify/prompts.ts` (import 0 유지)

```ts
/** 1차 패스 공통 타입 (61h G2). ⚠ 세 풀이 패스 + 문제 패스 전부에 붙인다 — 하나라도 빠지면 배열 원소 타입이
 *  합집합이 되어 `p.pass.severity`가 TS2339로 막힌다(v3 §9-① tsc 실증). */
export interface FirstPass { cap: number; severity?: 'garbage'; system: string; user: string }

// 상한 — ⚠ 프롬프트 객체보다 앞줄 (61g S12)
const CAP_GARBAGE = 6;   // 61h D8
export const MERGE_CANDIDATE_CAP = CAP_CALC + CAP_LOGIC + CAP_GARBAGE;   // 병합은 자르지 않는다(61g E1)

/** 군더더기 1차 전용. ⚠ recallRules와 다르다 — "놓치는 쪽이 훨씬 나쁩니다"·"오탐은 의도된 것"이 **일부러 없다**.
 *  군더더기의 비용 계산은 결함과 반대다(놓쳐도 틀리지 않는다). 그 문장을 옮겨 오지 말 것. T7이 부재를 고정한다. */
const garbageRecallRules = (cap: number) => `…v2 §5-1 본문 그대로… 후보는 **최대 ${cap}개**. …`;

export const PROMPT_PROBLEM_FIRST: FirstPass = { cap: CAP_PROBLEM, … };            // 타입만 붙는다 — 값 무변경
export const PROMPT_SOLUTION_FIRST_CALC: FirstPass = { … };                          // 〃
export const PROMPT_SOLUTION_FIRST_LOGIC: FirstPass = { … };                         // 〃
export const PROMPT_SOLUTION_FIRST_GARBAGE: FirstPass = {
  cap: CAP_GARBAGE, severity: 'garbage', system: `…§6-1…`, user: `…`,
};
export const SOLUTION_FIRST_PASSES: FirstPass[] = [PROMPT_SOLUTION_FIRST_CALC, PROMPT_SOLUTION_FIRST_LOGIC, PROMPT_SOLUTION_FIRST_GARBAGE];

export const PROMPT_GARBAGE_JUDGE = { system: `…§6-2…`, user: `…` };   // cap 없음 — T6 대상 아님
```
- 헤더 주석 계보에 "**Phase 61h**: 군더더기 두 프롬프트는 **이 파일이 원본**, 시트 STEP4(`gemini_garbage_verify_*`·`claude_garbage_judge_*`)가 이식(61g 예외와 달리 기본 규칙). 시트 type 키 `irrelevant`·`redundant`·`loose_equivalence`."
- `recallRules`·`CONSERVATIVE_RULES`·`PROMPT_JUDGE`·`formatCandidatesForJudge`·`COMMON_RULES`·`SOLUTION_PREAMBLE`·`SOLUTION_SCHEMA` 무변경.

### 5-2. `lib/verify/parse.ts` (import 0 유지)

```ts
export const GARBAGE_TAGS = ['무관서술', '중복서술', '느슨한서술'] as const;

/** ⚠ normalizeTag와 별도 — 그쪽 폴백은 `논리오류`라 군더더기가 결함으로 샌다.
 *  ⚠ 힌트 순서는 **무관 → 중복 → 느슨**이고 `'필요'`·`'충분'` 단독 힌트는 두지 않는다 —
 *    `'불필요'`가 `'필요'`를 품어 무관서술이 느슨한서술로 샌다(61h E3, 실측). T1이 고정한다. */
export function normalizeGarbageTag(raw: string): string {
  const t = String(raw ?? '').trim();
  if ((GARBAGE_TAGS as readonly string[]).includes(t)) return t;
  const low = t.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => t.includes(k) || low.includes(k));
  if (has('무관', '불필요', 'irrelev', 'unrelat', 'unnecess')) return '무관서술';
  if (has('중복', '중언', 'redund', 'repet', 'duplic')) return '중복서술';
  if (has('느슨', '동치', 'loose', 'equiv', 'necess', 'suffic', 'iff')) return '느슨한서술';
  return '무관서술';
}

export interface RawFinding { …기존…; severity?: 'garbage'; }   // 없음 = defect. 클라를 불투명하게 왕복한다

export function sanitizeFindings(arr: unknown, kind: VerifyKind, cap = 8, severity?: 'garbage'): RawFinding[]
  // tag: severity === 'garbage' ? normalizeGarbageTag(raw) : normalizeTag(raw, kind)
  // out.push({ …, ...(severity ? { severity } : {}) })

export function mergeCandidates(lists: RawFinding[][], cap: number): RawFinding[]
  // key = `${c.severity ?? 'defect'}|${normalizeForQuoteCheck(c.quote) || `\u0000${c.reason}`}`
  // → 같은 인용의 defect·garbage 후보가 둘 다 남는다. 순서는 이어 붙이기 그대로. 그 외 무변경.

export function splitBySeverity(cands: RawFinding[]): { defect: RawFinding[]; garbage: RawFinding[] }
  // 순수 함수. 라우트·프로브 공용. id 무접촉 — 2차는 병합 후 id로 맞물린다. severity 없음 = defect(G3)

export interface Judgment { ruling: Ruling; note: string; suggestion: string; escalate: boolean; escalateTag: string }
export function indexJudgments(arr: unknown): Record<string, Judgment>
  // suggestion: repair+trim · escalate: `=== true`만 · escalateTag: String(j.escalate_tag ?? '').trim()
  // 기존 호출부(route·probe)는 ruling·note만 읽는다 → 필드 추가는 호환(§9-③ 확인)
```
`synthesizeVerdict`·`normalizeTag`·`allowedTags`·`anchorByQuote`·`findQuoteRange` 무변경.

### 5-3. `app/api/verify/route.ts`

- import에 `PROMPT_GARBAGE_JUDGE`·`splitBySeverity`·`normalizeTag`·`type FirstPass` 추가.
- **`phase='first'` — 게이트를 결함 패스 기준으로(E4/N1)**:
  ```ts
  const firstParsed = firstResults.map((r, i) => ({ pass: passes[i], json: parseAndRepair(r.content) as … }));
  const defectParsed = firstParsed.filter((p) => !p.pass.severity);          // 61h — 게이트는 결함 패스만 본다
  if (defectParsed.every((p) => p.json === null)) throw new ApiError(502, '1차 검토 응답을 해석하지 못했습니다 …');
  const alive = firstParsed.filter(isParsed);                                 // 병합 재료는 셋 다
  const defectAlive = alive.filter((p) => !p.pass.severity);
  if (defectAlive.length > 0 && defectAlive.every((p) => p.json.skip === true)) { …skip 리포트 그대로… }
  ```
  `sanitizeFindings(p.json.candidates, kind, p.pass.cap, p.pass.severity)` — 인자 하나. 군더더기 패스의 `skip:true`는 `candidates`가 비어 있으면
  후보 0으로 자연히 흡수된다(N5). "후보 0 → ok" 무변경(군더더기 후보만 있어도 2차로 간다 — 의도).
- `runJudge`:
  ```ts
  const { defect, garbage } = splitBySeverity(candidates);
  const anchors = new Map(candidates.map((c) => [c.id, anchorByQuote(c.quote, targetBlocks)]));
  // 예산 검사 1회 그대로
  const judgeOpts = { thinking: 'adaptive', effort: 'high', enableCodeExecution: env.judgeCodeExec,
                      ...(a.figs.parts.length ? { images: a.figs.parts } : {}) } as const;   // E7 — 인라인에서 상수로
  const [dRes, gRes] = await Promise.all([
    defect.length  ? judge.complete(PROMPT_JUDGE.system,         fill(PROMPT_JUDGE.user,         defect)  + a.imageNote, JUDGE_MAX_TOKENS, judgeOpts) : null,
    garbage.length ? judge.complete(PROMPT_GARBAGE_JUDGE.system, fill(PROMPT_GARBAGE_JUDGE.user, garbage) + a.imageNote, JUDGE_MAX_TOKENS, judgeOpts) : null,
  ]);
  // dRes: truncated → 502 · judgments 배열 아님 → 502 (D13′ 그대로)
  // gRes: N2 — 권장안이면 truncated/파싱 실패 → garbageJudgeFailed = true, 군더더기 절 생략 + note
  ```
  토큰·`usdJudge`는 두 호출의 합.
- 합성:
  ```ts
  const findings: VerifyFinding[] = [];  const garbageOut: VerifyFinding[] = [];
  const dRul = indexJudgments(dRes?.judgments ?? []);   const gRul = indexJudgments(gRes?.judgments ?? []);
  defect.forEach((c) => { …현행 루프 그대로 — anchors.get(c.id)! · pickSuggestion(dRes.judgments, c)… });
  garbage.forEach((c) => {
    const j = gRul[c.id]; const ruling = j?.ruling ?? 'uncertain'; const a = anchors.get(c.id)!;
    if (j?.escalate) {                                                 // D5 — fail은 절대 아니다
      findings.push({ tag: normalizeTag(j.escalateTag, 'solution'), verdict: 'check', blockKey: a.blockKey,
                      quote: c.quote, reason: `[군더더기 검토에서 격상] ${j.note || c.reason}`,   // N4 권장
                      quoteFound: a.found });
      return;
    }
    if (ruling === 'invalid') return;
    const sug = j?.suggestion || c.suggestion;
    garbageOut.push({ tag: c.tag, verdict: ruling === 'valid' && a.found ? 'fail' : 'check', blockKey: a.blockKey,
                      quote: c.quote, reason: j?.note || c.reason, ...(sug ? { suggestion: sug } : {}), quoteFound: a.found });
  });
  report(kind, synthesizeVerdict(findings), findings, { …, garbage: garbageOut, note: … })
  ```
- 라우트 로컬 `VerifyReport`에 `garbage?: VerifyFinding[]`. `report()`는 `garbage.length > 0`일 때만 싣는다(옵셔널 전개 — 기존 `derivedAnswer` 패턴, §9-⑥).
- `models.judge`: 어느 판정자든 불렸으면 `env.claudeModel`. `FIRST_MAX_TOKENS` 8k **불변** — 군더더기 패스도 8k.
- **문제 검증(`kind='problem'`)은 바이트 단위로 무변경**: `passes=[PROBLEM]`이라 `garbage`가 비고 `PROMPT_JUDGE`만 돈다.

### 5-4. `types/problem.ts`

`VerifyReport`에 `garbage?: VerifyFinding[];` + 주석 "Phase 61h — 군더더기. 종합 판정에 들어가지 않는다(escalate는 findings 쪽). `verdict`는 fail=확정/check=확인 필요. 옛 리포트에는 없다." 나머지 무변경.

### 5-5. `components/comment/VerifyReportCard.tsx`

- `buildReportMarkdown`: `const g = report.garbage?.length ?? 0;` → 머리에 `(g > 0 ? ` · 군더더기 ${g}건` : '')`. quote·derivedAnswer는 넣지 않는다.
- 카드: 결함 `findings.map(FindingRow)` 아래, `g > 0`이면
  ```
  wrapper(marginTop 8 · paddingTop 8 · borderTop 1px var(--border-light))
    머리줄(fontSize 11 · var(--text-muted)): "군더더기 {g}건" + (var(--text-faint)) "· 종합 판정에 영향 없음"
    report.garbage.map((f, i) => FindingRow{ finding: f, index: i+1, severity: 'garbage', onJumpToBlock })
  ```
- `FindingRow`에 `severity?: 'garbage'` prop. 칩: garbage `fail`(확정) = `background: var(--bg-warn)`(= `--accent-soft` #f5e6df, `globals.css:146` 실재) ·
  `color: var(--text-secondary)`; `check`는 기존 `--bg-secondary`·`--text-secondary` + "확인 필요". **`--accent-danger` 계열 금지**. 카드 좌측 띠·머리 아이콘은 결함 verdict만.
  신규 토큰 0. `MathText` memo·모듈 상수 style·드래그 보호는 `FindingRow` 재사용으로 자동. `index`는 절마다 1부터라 첫 행 상단선 규칙(`index === 1`)도 자동.
- **Phase 64 폰**: `PhoneApp`이 `CommentPanel`을 그대로 마운트(`PhoneApp.tsx:24·368`) → 같은 카드. 별도 코드 0(§9-⑩).

### 5-6. `tests/verify.test.mjs` (T6 교체 + 7 순증 → 46 → 53 · 하니스 87)

| # | 단언 |
|---|---|
| T1 | `GARBAGE_TAGS` 3종 · `normalizeGarbageTag`: `irrelevant`→무관 · `redundant`→중복 · `loose_equivalence`→느슨 · `중언부언`→중복 · **`불필요`→무관 · `unnecessary`→무관**(E3 회귀 고정) · `동치`→느슨 |
| T2 | 격리: `normalizeGarbageTag('')`·`('logic_gap')` → `무관서술` · `normalizeTag(g,'solution')`(g ∈ GARBAGE_TAGS 3종)은 전부 `SOLUTION_TAGS` 안의 값(=폴백 `논리오류`)이지 군더더기 태그가 아니다 · `allowedTags('solution')`에 군더더기 태그 없음 |
| T3 | `sanitizeFindings(arr,'solution',6,'garbage')` — `severity:'garbage'` · 7건 → 6건 · 미지정이면 필드 없음(`'severity' in f === false`) |
| T4 | `mergeCandidates` **첫 테스트(E6)**: `[[d(q)],[d(q)]]` → 1건 · `[[d(q)],[g(q)]]` → 2건 · `[[d1,d2],[g1]]` id `c1,c2,c3` 순서 보존 · cap 26 |
| T5 | `splitBySeverity` — 순서·id 보존, 합집합 = 입력, severity 없음 = defect |
| T6′ | `[PROBLEM, ...SOLUTION_FIRST_PASSES]` 전부 `최대 ${cap}개` 일치 · `[calc, logic, garbage].cap` = 8·12·6 · `MERGE_CANDIDATE_CAP === 26` · `garbage.severity === 'garbage'` · calc·logic·problem에 `severity` 없음 |
| T7 | 문구: 군더더기 1차 system에 태그 3종·`삭제 검사`·`동치 검사`·`(heading)`·`(coach_important)`; **없어야 할 것** `놓치는 쪽이 훨씬 나쁩니다`(현행 `recallRules` 문자열 실재 확인). 2차 system에 `escalate`·`확신할 때만`. `PROMPT_JUDGE.system`은 61g T5 그대로 |
| T8 | `indexJudgments([{id:'c1',ruling:'valid',note:'n',suggestion:'s',escalate:true,escalate_tag:'충분성미확인'}])` → 전 필드 · `escalate:'true'`(문자열)는 false · 누락은 `''`/false · **suggestion `\frac` 복구** |
| (61f D8 확장 — G1) | 기존 테스트의 배열에 `P.PROMPT_GARBAGE_JUDGE` 추가 — 테스트 수 불변 |

### 5-7. `scripts/verifyProbe.mjs`

- `sanitizeFindings(…, x.pass.cap, x.pass.severity)` · 게이트 두 개를 라우트와 같이 결함 패스 기준으로(E4) · `splitBySeverity` · 판정 2회 `Promise.all`(둘 다 `V.buildClaudeParams`) · 합성 라우트와 같은 모양(N2·N4 반영).
- 결과 객체에 `garbage: []`·`escalated: n`·`garbageJudgeMs`. 판정 파싱 실패는 결함/군더더기를 **갈라** 기록(G7). `printResult`에 `군더더기 m건` 절(태그·verdict·`제안`) + 기각된 군더더기 후보.
- 요약에 열 추가: 군더더기 후보 평균 · 확정/확인/기각 · escalate · 태그 분포 · **군더더기 판정 ms**(결함 판정 ms와 별도).
- `--glabel` 없음(D10). 상한 리터럴 금지(`pass.cap`·`MERGE_CANDIDATE_CAP`). 2차 `maxTokens 16000`은 N3.

### 5-8. 문서

- `CLAUDE.md`: Phase 61h 절 + 규약 5건 — ① 군더더기는 종합 판정에 안 들어간다(`synthesizeVerdict`에 `garbage`를 넘기지 말 것; escalate만 `check`) ② 판정자는 둘,
  `PROMPT_JUDGE`·`CONSERVATIVE_RULES` 무변경, 성향이 반대라 합치지 말 것 ③ 구조 블록은 대상이 아니다 ④ escalate는 `check`까지만 ⑤ **1차 게이트는 결함 패스 기준**(G8).
  61b 절 "두 패스" → "세 패스(+군더더기, 게이트 불참)" · 테스트 수 53/87 · 프롬프트 계보에 "군더더기 두 프롬프트의 원본은 `prompts.ts`".
- `docs/roadmap.md` 61h 절 · 확정본 `docs/phasedocs/`(규칙 7).

### 5-9. 커밋 분할 (v2와 동일 · S1이 T6′ 포함)

| # | 범위 | 내용 |
|---|---|---|
| S1 | `prompts.ts` · `parse.ts` · `verify.test.mjs` | `FirstPass`·상한·`garbageRecallRules`·프롬프트 2 · `GARBAGE_TAGS`·`normalizeGarbageTag`(E3 순서)·`severity`·병합 키·`splitBySeverity`·`Judgment` · T1~T8(T6 교체)·61f D8 확장 |
| S2 | `route.ts` · `types/problem.ts` | 패스 3 · 게이트 결함 기준(E4) · 판정 2 병렬 · 합성 분리 · escalate(N4) · `garbage` · N2 |
| S3 | `VerifyReportCard.tsx` | 군더더기 절 · 요약 폴백 · 칩 색 |
| S4 | `verifyProbe.mjs` | 상한·severity·게이트·판정 2·출력 |
| S5 | `CLAUDE.md` · `roadmap.md` · phasedocs | 규약 5 · 61h 절 · 실행판 |

S1 단독으로 `npm run test:verify` **87건**이 돌아야 한다. S2가 S1의 export를 쓰므로 순서 고정.

### 5-10. 건드리지 않는 것 (실측 확인)

`PROMPT_SOLUTION_FIRST_CALC`·`_LOGIC`·`PROMPT_JUDGE`·`CONSERVATIVE_RULES`·`recallRules`(문자열 무변경 — 61g T5 그대로) · `synthesizeVerdict` · `anchorByQuote`·`findQuoteRange` ·
`lib/verifyFlow.ts`(`first.candidates`를 untyped로 되돌린다 — `severity` 왕복, `verifyBlocksOf` 무접촉) · `lib/batchVerify.ts`·`batchPlan.ts` · `VerifyBadge`·`listColumns.verifyRank`·
`BatchVerifyDialog`(`verdict`만 읽는다)·`PhoneList` · `VerificationState` · `lib/verify/figures.ts`·`figureFetch`(4번째 호출도 `passes.map`이 같은 첨부를 실어 간다) ·
`providerParams.ts`(순수 함수 — 호출만 는다, 스냅샷 13건 무변경) · Firestore 규칙.

---

## 6. 프롬프트 (v2 §6 그대로 — 프로브에서 확정)

v2 §6-1(`PROMPT_SOLUTION_FIRST_GARBAGE`)·§6-2(`PROMPT_GARBAGE_JUDGE`) 본문을 **한 글자도 바꾸지 않고** 잇는다. 실측으로 확인한 정합성만 적는다:

- `${COMMON_RULES}` 포함 → `[블록 n]` `block` 필드 · `$` 보존 · `[그림 k]`·`첨부되지 않음`·skip 규칙이 자동으로 실린다(61f D8 테스트가 이를 본다 — G1).
- `${SOLUTION_SCHEMA('중복서술')}` → 출력 스키마에 `skip`·`skip_reason`이 있다(N5).
- [4]의 "`(heading)` 블록" — `labelBlocks`가 `[블록 n] (heading)`으로 찍는다(G10).
- 2차 `[2] escalate`의 태그 다섯(논리오류·충분성미확인·경우누락·근거없는가정·논리비약)은 전부 `SOLUTION_TAGS` 안 → `normalizeTag`가 그대로 통과. 빈 값은 `논리오류` 폴백(G4).
- 시트 V2의 "'애매해 보인다'는 uncertain의 근거가 아니다"는 넣지 않는다(61g D5와 같은 이유).

---

## 7. 검증 계획 (v2 §7 + 명령 고정)

**Stage 1 · 로직** — `npm run test:verify` **87건** · `npx tsc --noEmit`(프로젝트) · `aiProviderParams` 13건 무변경 · `npm run build`(⚠ dev 끄고) — `/api/verify` `ƒ` 유지.

**Stage 2 · 프로브(결함 회귀)** — `node scripts/verifyProbe.mjs --flagged --sample 10 --kind solution`. 결함 후보 수·기각률·태그 분포가 61g 기록 범위인가(두 결함 패스는 독립이라
같아야 한다 — 다르면 병합·id 회귀). **1차 최장**(Gemini 3) · **결함 판정 ms · 군더더기 판정 ms** 각각(200초 문턱). Gemini 429로 죽는 패스 빈도.

**Stage 3 · 프로브(군더더기)** — `node scripts/verifyProbe.mjs --sample 10 --kind solution`(E8). 대조군 없음 → 기록: 군더더기 후보 평균 · 확정/확인/기각 · escalate 건수 ·
**태그 분포**(중복서술만 나오고 느슨한서술 0이면 동치 검사 문구가 안 먹는 신호) · 후보 6 도달 비율. **눈으로** D7 준수 — `### 제목`·coach 블록이 후보로 오르면 [4] 강화, 그래도
오르면 텍스트 치환(`(heading — 검토 제외)`, 블록 번호 보존). `check` 비율 > 50%면 D6 폴백.

**Stage 4 · UI 1회** — 편집창 풀이 검증: 군더더기 절이 결함 아래 결함색 없이 뜨는지 · 확정/확인 구별 · 클릭 점프 · 제안 수식 렌더 · `이상 없음 · 군더더기 n건` 1건 ·
escalate 1건(`check`·태그·N4 접두) · **문제 검증 1건(무변경 확인)** · 폰 카드 1회 · 그림 문항 1건(61f 무회귀: 결함 패스 둘 다 skip → `skip` 리포트가 여전히 나오는지 — E4).

**Stage 5 · 문서**. **Stage 6(후속)** — 시트 STEP4가 Stack Z/AA를 30행 이상 채우면 `--glabel`.

---

## 8. 위험·트레이드오프 (v2 §8 + E4·N2)

- **비용**: 풀이 검증 1회당 Gemini 3회(+1) · Claude ≤2회(+1). 시간은 병렬이라 불변, 토큰 약 1.5~1.8배. 일괄 검증에서 곱해진다. 군더더기 후보 0이면 Claude 1회.
- **게이트 회귀(E4)**: 코드를 안 고치면 "그림 의존 skip"과 "결함 패스 전부 실패 502"가 조용히 `ok`로 바뀐다 — 프롬프트가 아니라 **분기 한 줄**의 문제라 프로브로는 안 보이고 Stage 4의 그림 문항 1건이 유일한 실물 확인이다.
- **Gemini 동시 3호출**: 429로 한 패스만 죽으면 진행된다. 죽은 군더더기 패스는 "군더더기 없음"과 구별되지 않는다(N1 권장안의 수용 손실).
- **판정자 2회**: N2 권장안이면 군더더기 판정 실패가 결함 리포트를 죽이지 않는다. 대신 "군더더기 절 없음"이 `note`로만 남는다.
- **소음**: 2차 "확신할 때만 valid". D6 폴백은 코드 한 줄. **느슨한서술**은 uncertain이 많은 것이 정상.
- **프롬프트 원본이 이쪽**(D10): 시트 STEP4 이식 시 이 파일의 커밋 해시를 pmt 비고에.

---

## 9. CLI 착수 점검 — 실측 결과 (v2 §9 ⓪~⑩ 전항)

| # | 항목 | 결과 |
|---|---|---|
| ① | `SOLUTION_FIRST_PASSES` 원소 타입 | **실증**: 두 리터럴 중 하나에만 `severity`를 두고 `PASSES.map(p => p.severity)`를 `tsc --strict`로 컴파일 → `TS2339 Property 'severity' does not exist on type '{ cap; system; user }'`. `FirstPass` 인터페이스를 넷에 붙이면 exit 0. **G2대로 `PROMPT_PROBLEM_FIRST`까지** |
| ② | T6 교체 | 현행 T6(`verify.test.mjs:366-378`)이 `const [calc, logic] = …; assert.equal(MERGE, calc.cap + logic.cap)` — 그대로 두면 26 ≠ 20으로 실패. T6′로 교체 |
| ③ | `indexJudgments` 반환형 확장 | route(`rulings[c.id]` → `j?.ruling`·`j?.note`)·probe(동일) 둘 다 두 필드만 읽는다 → 호환. `pickSuggestion`은 raw 배열을 따로 읽어 무접촉 |
| ④ | `mergeCandidates` 기존 테스트 | **0건**(E6). 61g T4는 `sanitizeFindings` cap 테스트다. 새 T4가 첫 고정 |
| ⑤ | `anchors` Map(id 키) | 병합 후 id는 `c1..cN` 유일(문제 검증의 c0 unshift도 재부여). 현행 `anchors[i]`와 결과 동일 |
| ⑥ | `report()` 옵셔널 전개 | 현행이 `derivedAnswer`·`answerCheck`·`note`를 같은 패턴으로 전개 → `garbage`도 같은 꼴. `extractVerifyReport`는 `Array.isArray(report.findings)`만 검사 |
| ⑦ | 프로브 `buildClaudeParams` 2회 | 순수 함수(`providerParams.ts:45`) — 호출 횟수는 스냅샷과 무관. 13건 무변경 |
| ⑧ | `.test-build` 새 export | `test:verify`가 네 파일을 tsc로 함께 컴파일 — export 추가는 자동 반영. import 0 유지가 조건 |
| ⑨ | `--bg-warn` | **실재** `globals.css:146` = `var(--accent-soft)`(#f5e6df). `--accent-danger-bg`(#FEF2F2)와 구별됨 |
| ⑩ | Phase 64 폰 카드 | `PhoneApp.tsx:24` `import CommentPanel`, `:368` 마운트 → 같은 카드. 코드 0 |
| E3 | `normalizeGarbageTag` 순서 | **실증**(node): v2 판은 `불필요`→느슨한서술 · `unnecessary`→느슨한서술 · `동치`→무관서술. v3 판은 셋 다 의도대로. v2 T1은 v2 코드로 **실패**했을 것 |
| E4 | 1차 게이트 | `route.ts:253`·`:261` — `firstParsed.every(json===null)`·`alive.every(skip)` 둘 다 **패스 전체**를 본다. 프로브 `runOne`(`verifyProbe.mjs:210`·`:215`)도 같은 두 줄 |
| — | 기준 하니스 | `npm run test:verify` → `tests 80 · pass 80 · fail 0` (13 + 46 + 21) |

---

## 10. 이 Phase가 건드리지 않는 것

문제 검증(바이트 무변경) · 계산·논리 패스와 `PROMPT_JUDGE` · 합성 규칙·어휘 · 앵커·인용 대조 · 그림 첨부(61f) · 일괄 검증(61d) · 라우트 인증·예산·2요청 구조 ·
Firestore 규칙·스키마 · 목록 칼럼·배지 · `VerificationState` · 대화→편집창 삽입(61c) · 프로브 2차 `maxTokens` 사본(N3) · GAS 쪽(후속 — 짝 문서 v2).

---

## 부록 A. Mathory 61h ↔ 시트 STEP4 (v2 부록 A 그대로)

| Mathory 61h (원본) | 시트 STEP4 (이식) |
|---|---|
| `GARBAGE_TAGS` `무관서술`·`중복서술`·`느슨한서술` | `G_TYPES` 키 `irrelevant`·`redundant`·`loose_equivalence` — 두 정규화가 서로의 키를 받는다 |
| `PROMPT_SOLUTION_FIRST_GARBAGE` (`[블록 n]`·`(heading)` 제외·suggestion은 Mathory 고유) | `gemini_garbage_verify_*` — 블록 조항 대신 "해설 첫 줄 정답 표기 제외" |
| `PROMPT_GARBAGE_JUDGE` | `claude_garbage_judge_*` |
| `report.garbage`, 종합 판정 독립 | Z verdict `clean/garbage/check`, U 독립 |
| escalate → `findings` `check` | escalate → Z `check` + AA `[결함의심n]` |
| `CAP_GARBAGE` 6 | `QCONFIG.G.MAX_CANDIDATES` 6 |

## 부록 B. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 정의·잣대 · 설계 · D1~D11 · 프롬프트 초안 · 검증 계획 |
| v2 | web | 덕수 확정(D1~D11) · Mathory 선착수(D10) · 시그니처 수준 구현 항목 · CLI 착수 점검 ⓪~⑩ |
| **v3** | **CLI** | §9 전항 실측(tsc·node 실증 2건) · 정정 E1~E9 · 보완 G1~G10 · 결정 N1~N5 · 명령·수치 고정 |

다음: 덕수가 N1~N5 판정 → 착수(S1~S5) → 프로브 Stage 2·3 → 덕수 검수 → 실행판(v4)을 `docs/phasedocs/`에 → 시트 STEP4 이식.

---

## 11. 구현 기록 (v4 · 2026-09-10)

### 11-1. 커밋

| # | 해시 | 범위 | 내용 |
|---|---|---|---|
| S1 | `fe8693e` | `prompts.ts` · `parse.ts` · `verify.test.mjs` | `FirstPass`·`CAP_GARBAGE 6`·`MERGE 26`·`garbageRecallRules`·프롬프트 2 · `GARBAGE_TAGS`·`normalizeGarbageTag`(E3 순서)·`severity`·병합 키·`splitBySeverity`·`Judgment` · 테스트 46 → 53(T6′ 교체·T1~T5·T7·T8·61f D8 확장) |
| S2 | `151da12` | `route.ts` · `types/problem.ts` | 게이트 결함 기준(E4·N1) · severity 정제·병합 · 판정 2병렬 · 군더더기 판정 실패 절 생략+note(N2) · escalate `check`+접두(D5·N4) · `report.garbage` |
| S3 | `0d27162` | `VerifyReportCard.tsx` | 군더더기 절 · 요약 폴백 · `FindingRow severity`(확정 칩 `--bg-warn`) |
| S4 | `17174f1` | `verifyProbe.mjs` | 패스 3·게이트·severity·판정 2병렬·합성·출력·요약 |
| S5 | (이 커밋) | `CLAUDE.md` · `roadmap.md` · 이 문서 · `route.ts` · `verifyProbe.mjs` | 규약 · 61h 절 · 실행판 · **suggestion은 valid일 때만(코드 강제 — §11-3 실측)** |

Stage 1: `npm run test:verify` **87건 통과**(13 + 53 + 21) · `npx tsc --noEmit -p .` exit 0 · 프로덕션 빌드는 dev를 끈 뒤 덕수가 확인(규칙 5).

### 11-2. 스모크 (자작 문항 1건 — 세 유형을 일부러 심음)

`--file` 1건: 군더더기 후보 4(느슨 1·중복 2·무관 1) → **확정 2**(중복서술 @s8 · 무관서술 @s3, 둘 다 삭제 범위 제안) · 기각 2 · 격상 0 ·
결함 후보 0 → verdict **`ok`** 유지(D2 실증). 군더더기 판정 **184.2초**(후보 4건) — 200초 문턱에 가깝다.
기각된 둘은 "합·곱 조건이 필요충분이므로 검산 불필요"(느슨)·"검산 불필요"(중복)로 **판정자가 [4]의 "필요조건 축소 뒤 검산 = 필요"를 적용해 기각**했다 —
실제로 심은 느슨한서술(필요조건으로 좁힌 뒤 충분성 확인을 붙임)은 정의상 검산이 *필요한* 단계라 기각이 맞다. 시료가 잘못 심긴 것이지 판정 결함이 아니다.

### 11-3. 프로브 Stage 2 · 3

**Stage 2 — 결함 회귀** (`--flagged --sample 10 --kind solution`, Stack 시트가 결함으로 표시한 행 10건)

| 항목 | 값 | 61g 기록 대비 |
|---|---|---|
| 결함 후보(1차, 두 결함 패스 합) | 14건 / 8문항(후보 0이 2문항) · 평균 1.4 | 61b/61g 범위 안 |
| 2차 기각 | 8/14 = **57%** | 61g 베이스라인 56% — 일치 |
| 검출(시트 결함 → fail·check) | fail 1 · check 1 · **누락 8** | 61g "검출 3~4/10"보다 낮다 — ⚠ n=10 노이즈 범위(61b 규약: 판본 판정 금지). 결함 프롬프트·병합·상한이 바이트 무변경이라 61h 회귀는 아니다. 표본 행이 같은지는 다음 프로브에서 `--rows`로 고정해 볼 것 |
| 1차 실패·군더더기 패스 실패 | 0 · 0 | Gemini 동시 3호출에서 429 없음 |
| 결함 판정 최장 / 군더더기 판정 최장 | 51.0s / 29.0s | 200초 문턱 여유 |
| 군더더기(부수) | 후보 평균 0.25 · 확정 1(중복 — `정답\| 96` 셀 중복) · 확인 1 | 결함 행에서도 군더더기가 드물다 |

**Stage 3 — 군더더기** (`--sample 10 --kind solution`, 무작위 10건 · 대조군 없음 — D10)

| 항목 | 값 | 판정 |
|---|---|---|
| 1차 군더더기 후보 | 8건 / 7문항(2차까지 간 것) · 평균 **1.14** · 상한 6 도달 0 | "대부분 없거나 한두 곳" 문구와 부합 |
| 태그 분포(1차) | 무관 4 · 중복 2 · **느슨 2** | 느슨한서술이 올라온다 — 동치 검사 문구가 먹는다. 단 느슨 2건은 둘 다 2차에서 기각 |
| 2차 판정 | 확정(fail) 2 · 확인(check) 2 · 기각 4 · escalate 0 · 판정 실패 0 | check 비율 2/4 = 50% — D6 문턱("절반 넘으면")에 걸리지 않음. 표본이 작아 v4 후속에서 다시 본다 |
| 확정 2건(행 3907, 같은 블록) | 별해에서 구한 $b$가 최종 답에 안 쓰임 — 삭제 검사 통과, 범위 제안까지 구체적 | 정의 ①(무관서술)의 전형 — **눈으로 읽어 타당** |
| 확인 2건(행 2001) | note는 "삭제 불가·중복 아님"(=invalid 논거)인데 ruling이 uncertain, suggestion에 "삭제" | ⚠ **판정자가 [3]"suggestion은 valid일 때만"을 안 지킨다** → S5에서 코드로 강제(valid일 때만 제안을 싣는다 — 라우트·프로브). ruling/note 불일치는 "가리지 못하면 uncertain" 성향의 대가로 수용(사람이 본다) |
| 기각 4건 | 행 2512 3건은 1차 reason이 필러("Final calculation logic holds…", 61b 기록의 그 현상) · 행 4372 1건은 접속사 되풀이 | 판정자가 필러를 걸렀다 — 비대칭 설계대로 |
| 판정 시간 | 결함 최장 96.9s · **군더더기 최장 52.5s** | 스모크의 184s는 이상치. 200초 문턱 여유. 병렬이라 벽시계는 max |
| D7 구조 블록 오탐 | **측정 불가** — 프로브 말뭉치는 시트 텍스트라 `toBlocks`가 전부 `text` 타입이다(`(heading)`·coach 라벨이 생기지 않는다) | Stage 4 UI(§11-4 ①)가 전담 |
| 비용 | Stage 2 in 117k/out 17k · Stage 3 in 138k/out 21k (Opus 단가 상한 ≈ $1.0 / $1.2) | 문항당 ≈ $0.1 상한 |

**결론**: 배선·게이트·합성은 실측대로 동작하고(escalate 경로만 아직 실물 0건), 군더더기 축은 결함 축의 수치를 흔들지 않았다(기각률 57% = 베이스라인).
검출 8/10 누락은 61h 밖의 신호라 다음 결함 프롬프트 손질 때 표본을 고정해 다시 잰다.

### 11-4. 덕수 검수 항목 (Stage 4 · UI 1회) — **2026-09-10 덕수 검수 완료: "모두 잘 작동"** · 프로덕션 빌드 통과(`/api/verify` ƒ · icons 61종 · 자산 1,512) · push 대기

편집창에서 풀이 검증을 눌러:
1. 군더더기가 있는 문항 — 결함 아래 "군더더기 n건 · 종합 판정에 영향 없음" 절이 뜨고, 확정 칩이 **결함색(빨강)이 아닌 틴트**인지 · 좌측 띠 색은 결함 verdict만 따르는지
2. 군더더기 행 클릭 → 인용 자리로 점프(`quoteFound`) · 제안 문안의 수식이 렌더되는지
3. 결함 0 · 군더더기 ≥1 문항 — 머리가 `✓ 이상 없음 · 군더더기 n건`인지(목록 배지는 ✓ 그대로)
4. escalate가 나오면 — 결함 절에 `check`로, reason 앞 `[군더더기 검토에서 격상]`
5. **문제 검증 1건** — 61h 이전과 같은 카드(무변경 확인)
6. **그림 문항 1건**(결함 패스 둘 다 그림 의존 skip이 나는 문항) — `skip` 리포트가 여전히 나오는지(E4 게이트 실물 확인)
7. 폰 기기 모드 댓글 시트에서 같은 카드 1회
