/**
 * Phase 66a·66b — 문답 검증 질문 씨앗·순수 규칙 (import 0)
 *
 * `npm run test:ask`가 이 파일 하나를 tsc로 단독 컴파일한다 — import 문을 두지 말 것.
 * (lib/verify/*, lib/listColumns.ts 등과 같은 관례)
 *
 * 씨앗(`SEED_QUESTIONS`)은 **최초 1회 복사본**이다. 이후 진실은 `users/{uid}/ask_questions`이고
 * 여기 문안을 고쳐도 이미 만들어진 문서는 바뀌지 않는다(의도). 새 씨앗이 기존 사용자에게 들어가는
 * 경로는 `planSeedTopUp` 하나다(66b D4 — 사용자 문서 `askSeedKeys`가 "이미 제안한 키"를 기록한다).
 *
 * ⚠ D20 — 질문 본문은 /api/discuss의 트리거 낱말을 피한다(`DISCUSS_TRIGGER_RES`). 걸리면 사용자 메시지에
 *   "반드시 SymPy를 실행하라, 아니면 무효"가 부착되고 `tool_choice:{type:'any'}`로 도구가 강제된다 —
 *   *묻는* 질문이 *요청*으로 도착해 측정 대상이 바뀐다. 실측: 씨앗 G2 원문의 "검산"이 걸렸다(66a v5 X2).
 * ⚠ 66b D5′ — 씨앗 본문에 `$`를 쓰지 않는다. 대화 말풍선의 `EditorPreview`가 인라인 `\displaystyle`을
 *   원문 전체에 주입하고 코드펜스만 보호해, `$...$`는 `…`로, 백틱으로 감싼 `$...$`는 `$\displaystyle ...$`로
 *   보인다(66a E3). 수식 표기 지시는 discuss 시스템 프롬프트가 이미 "최우선 출력 규칙"으로 강제한다
 *   (`route.ts:62-68`) — 질문 꼬리의 같은 지시는 중복이라 지웠다. T9가 "`$` 0개"를 고정한다.
 */

export type AskTarget = 'problem' | 'solution';

export interface AskQuestion {
  id: string;
  label: string;
  target: AskTarget;
  text: string;
  order: number;
  enabled: boolean;
  rev: number;
  /** 66b D3 — false면 문제 탭만 보낸다. **문제 질문에서만 의미가 있다** — 판단은 `effectiveWithTabs` 하나로 */
  withTabs: boolean;
  created_at: Date;
  updated_at: Date;
}

/** 새 문서를 만들 때 넘기는 필드 (id·타임스탬프 제외) */
export type AskQuestionInput = Pick<AskQuestion, 'label' | 'target' | 'text' | 'order' | 'enabled' | 'rev' | 'withTabs'>;

/** 씨앗 항목 — `seedKey`는 **코드 전용 키**다. Firestore 문서에는 쓰지 않는다(66b D13 — 보충 판정은
 *  사용자 문서 `askSeedKeys`만 보므로 문서 필드는 읽는 곳이 없다) */
export type SeedQuestion = AskQuestionInput & { seedKey: string };

/** 전송 메시지 첫 줄 라벨 — 66a D1′: 새 기능 이름은 '문답 검증'(61b는 UI에서 '교차 검증') */
export const ASK_LABEL_PREFIX = '문답 검증';

/** 본문 상한 — CommentEditor의 1000자는 textarea 전용이라 문답엔 안 걸린다(66a V8). 이것이 유일한 상한 */
export const ASK_TEXT_MAX = 8000;

/* ── 문제 검증 (66b) — 문제 자체를 의심하는 질문이라 "정상 문항" 전제를 깔지 않는다(T2′) ── */

// D3 — P1은 풀이를 **실제로 보내지 않는다**(withTabs false). "풀이는 보지 말고"라는 부탁은 이미 읽은
//   모델에게 지켜질 수 없다(66b F3). D6 — 1~999 기준은 수능형 단답에만.
const SEED_P1 = `문제만 보고 직접 풀어서 답을 구해줘. 첫 줄에 네가 구한 답을 적어줘.
그다음 이 문제가 성립하는지 봐줘:
- 조건을 만족하는 답이 없거나 둘 이상이면, 어느 조건이 부족하거나 서로 충돌하는지 짚어줘.
- 객관식이면 네 답이 선지에 있는지, 옳은 선지가 둘 이상은 아닌지, 선지끼리 형식(기약분수·유리화·단위)이 맞는지 봐줘.
- 수능형 단답이면 네 답이 1 이상 999 이하의 자연수인지 봐줘 — 아니면 문제나 조건이 잘못된 거야.
답을 확정하지 못했으면 어디서 막혔는지 적어줘. 문제에 없는 조건을 네가 보태서 넘기지 마 — 그 자리가 곧 지적이야.`;

const SEED_P2 = `문제 본문의 표기와 표현만 봐줘. 답이 맞는지는 보지 마. 사소한 것이라도 빠짐없이:
- 같은 문자가 서로 다른 뜻으로, 또는 다른 문자가 같은 뜻으로 쓰인 곳
- 수학 용어나 기호를 잘못 쓰거나 어색하게 쓴 곳 — 구간·집합·함수 표기, 첨자·괄호·로그 밑, 발문의 어투처럼 수능 문항의 관습과 어긋나는 것
- 두 가지로 읽힐 수 있는 문장, 무엇을 가리키는지 분명하지 않은 지시어, 오해를 부를 만한 표현
각 지적마다 원문을 짧게 인용하고, 어떻게 잘못 읽힐 수 있는지와 고친 문안을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해.`;

const SEED_P3 = `문제의 조건 하나하나가 답을 구하는 데 실제로 쓰이는지 봐줘. 풀이가 있으면 각 조건이 풀이의
어느 지점에서 쓰였는지 짚고, 없으면 네가 풀면서 어디서 쓰는지 봐.
- 그 조건을 지워도 답이 그대로 하나로 정해지면 과조건이야.
- 다른 조건에 이미 담긴 내용을 되풀이하거나 의미가 일부 겹치는 조건, 같은 말을 두 번 하는 서술은 군더더기야.
사소한 것이라도 빠짐없이 찾고, 각각 지워도 되는 근거(지운 뒤에도 답이 유일한 이유)와 삭제 문안을 적어줘.
단, 답의 존재나 유일성을 보장하는 데 필요한 조건(자연수·양수·정의역·서로 다른 점 등)은 과조건이 아니야.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해.`;

// D7 — 수치를 바꾼 새 문제가 여전히 성립하는지까지 보게 한다(재작성이 새 오류를 만들 수 있다)
const SEED_P4 = `이 문제를 더 나은 문제로 다시 써 줘. 묻는 것과 풀이의 핵심 아이디어는 그대로 두고, 세 가지를 목표로:
① 계산 부담을 줄일 것 — 풀이 과정에서 다루는 수가 1~3자리 정수, 인수분해가 필요하면 2자리 이하 정수가 되도록
   계수·조건의 수치를 조정하고, 기계적으로 반복되는 계산이 있으면 그 반복이 사라지게.
② 의미가 겹치는 조건을 하나로 합치거나 지워서 논리적으로 군더더기 없게.
③ 길고 장황한 수식·서술을 짧고 명료하게 — 읽는 시간과 부담을 줄여 수학적 본질에 집중하게.
오류나 모호한 표현이 보이면 그것도 함께 고쳐.
먼저 고쳐 쓴 문제 전문을 적고, 그 아래 바꾼 곳마다 "원문 → 수정안 → 이유"를 항목으로 정리해줘.
수치를 바꿨으면 고친 문제도 답이 하나로 정해지는지 봐 주고, 바뀐 답을 함께 적어줘.`;

/* ── 풀이 검증 (66a) — 정상 문항 전제 ── */

const SEED_G1 = `이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.
그런 전제에서, 풀이에 군더더기가 있으면 사소한 거라도 빠짐없이 찾아서 알려줘.

각 지적마다 원문을 짧게 인용하고, 왜 군더더기인지와 수정 방향을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해.`;

// ⚠ 넷째 항목의 "…확인하는 검산"은 CODE_EXEC_TRIGGER_RE에 걸려 "맞는지 확인하는 절차"로 바꿨다(덕수 승인 2026-09-15, 66a Q2)
const SEED_G2 = `이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

풀이의 각 대목을 지워 보면서, 그 대목을 지워도 (문제 조건 + 남은 풀이)만으로 최종 답까지
논증이 완결되는 곳을 사소한 것이라도 빠짐없이 찾아줘. 이런 것들이 여기 해당해:
- 최종 답에 쓰이지 않는 양을 구하거나 성질을 밝힌 곳
- 뒤에서 한 번도 참조되지 않는 중간 결과
- 앞 결론에 새 내용을 보태지 않고 말만 바꾼 되풀이
- 동치 변형만으로 확정된 답을 다시 대입해 맞는지 확인하는 절차

다만 문제 조건을 기호로 정리하는 첫머리, 정의·표기 선언, 경우 나눔의 표지, 답을 확정하는 문장,
필요조건으로 좁힌 뒤의 충분성 확인은 제외해.

각 지적마다 삭제 범위를 "'…'부터 '…'까지"로 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해.`;

const SEED_G3 = `이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

이 풀이를 논리적 완결성은 그대로 둔 채 가장 짧게 다시 써 줘.
그리고 줄어든 부분이 각각 왜 없어도 되는지 항목으로 정리해 줘 — 안 쓰이는 계산이었는지,
알려진 정리로 한 줄에 갈 수 있었는지, 단순 이항·통분을 여러 줄로 늘린 것이었는지,
나누지 않아도 되는 경우를 나눈 것이었는지.`;

/**
 * 씨앗 7개 — 문제 4(P1 성립 · P2 표기·표현 · P3 과조건·군더더기 · P4 개선 재작성) +
 * 풀이 3(G1 기준선 · G2 "지워도 되는 것" · G3 "더 짧게 쓸 수 있는 것").
 * P3↔G2(삭제 축) · P4↔G3(재작성 축)가 대칭이다. order는 신규 사용자 기준(D9).
 */
export const SEED_QUESTIONS: readonly SeedQuestion[] = [
  { seedKey: 'P1', label: '문제(성립)',            target: 'problem',  text: SEED_P1, order: 10, enabled: true, rev: 1, withTabs: false },
  { seedKey: 'P2', label: '문제(표기·표현)',       target: 'problem',  text: SEED_P2, order: 20, enabled: true, rev: 1, withTabs: true },
  { seedKey: 'P3', label: '문제(과조건·군더더기)', target: 'problem',  text: SEED_P3, order: 30, enabled: true, rev: 1, withTabs: true },
  { seedKey: 'P4', label: '문제(개선 재작성)',     target: 'problem',  text: SEED_P4, order: 40, enabled: true, rev: 1, withTabs: true },
  { seedKey: 'G1', label: '군더더기(원문)',        target: 'solution', text: SEED_G1, order: 50, enabled: true, rev: 1, withTabs: true },
  { seedKey: 'G2', label: '군더더기(삭제 검사)',   target: 'solution', text: SEED_G2, order: 60, enabled: true, rev: 1, withTabs: true },
  { seedKey: 'G3', label: '군더더기(압축 재작성)', target: 'solution', text: SEED_G3, order: 70, enabled: true, rev: 1, withTabs: true },
];

/** 66a가 씨앗으로 만든 키 — `askSeedKeys` 필드가 없던 시절의 사용자에게 이미 제안된 것으로 본다 */
const LEGACY_66A_SEED_KEYS: readonly string[] = ['G1', 'G2', 'G3'];

/**
 * 66b D4 — 씨앗 보충 계획. **지운 질문이 되살아나지 않게** "이미 제안한 키"를 기준으로 판정한다.
 *
 * - `offered === undefined`(사용자 문서에 필드가 없음): 목록이 비어 있으면 처음 쓰는 사용자로 보고
 *   아무것도 제안하지 않은 것으로, 비어 있지 않으면 66a 씨앗(G1~G3)을 받은 사용자로 본다.
 * - `offered`가 배열이면 그 키만 제외한다 — 목록이 비었어도(전부 지웠어도) 되살리지 않는다.
 *
 * ⚠ `undefined`와 `[]`는 다르다. 전자는 "기록이 없다", 후자는 "기록은 있고 제안한 것이 없다".
 * ⚠ 라벨로 대조하지 않는다 — 덕수가 라벨을 고치면 중복이 생긴다.
 * `record`는 사용자 문서에 `nextOffered`를 써야 하는지다(필드가 없었거나 새 키가 생겼을 때).
 */
export function planSeedTopUp(args: { offered: readonly string[] | undefined; collectionEmpty: boolean }): {
  toCreate: SeedQuestion[];
  nextOffered: string[];
  record: boolean;
} {
  const base: readonly string[] = args.offered ?? (args.collectionEmpty ? [] : LEGACY_66A_SEED_KEYS);
  const toCreate = SEED_QUESTIONS.filter((s) => !base.includes(s.seedKey));
  const nextOffered = Array.from(new Set([...base, ...SEED_QUESTIONS.map((s) => s.seedKey)]));
  const record = args.offered === undefined || nextOffered.length !== args.offered.length;
  return { toCreate, nextOffered, record };
}

/**
 * 66b D3·Z2 — 이 질문이 탭(풀이·참고)을 함께 보내는가. **판단은 이 함수 하나로** — 전송·안내·모달이 공유한다.
 * 풀이 질문은 저장값과 무관하게 항상 true다: 탭을 빼면 "풀이를 검증하라"는 질문이 풀이 없이 간다.
 * 저장값은 건드리지 않는다(대상을 다시 문제로 바꾸면 되살아난다).
 */
export function effectiveWithTabs(q: { target: AskTarget; withTabs?: boolean }): boolean {
  return q.target === 'problem' ? q.withTabs !== false : true;
}

/**
 * ⚠ app/api/discuss/route.ts의 `CODE_EXEC_TRIGGER_RE`(:256)·`GRAPH_TRIGGER_RE`(:266-267)와 **의도적 이중**이다.
 * 이 파일은 import 0이라 라우트를 못 읽는다 — 라우트를 고치면 여기도 함께 고칠 것.
 * (전례: lib/listColumns.ts verifyRank ↔ VERIFY_VERDICT_META — CLAUDE.md Phase 63 절)
 * 차단이 아니라 경고다(66a Q4) — "진짜 검산을 시켜 보는" 질문을 만들 수도 있다. 모르고 걸리는 것만 막는다.
 */
export const DISCUSS_TRIGGER_RES: readonly { re: RegExp; why: string }[] = [
  { re: /검산|sympy|코드로\s*(확인|검증|계산)|파이썬으로|계산해\s*확인/i,
    why: '코드 실행이 강제됩니다 — 메시지 끝에 "반드시 SymPy를 실행하라" 문구가 붙고 도구 호출이 강제됩니다' },
  { re: /(그래프|좌표\s*평면|개형)\s*(을|를|으로|로)?\s*(좀\s*)?(그려|그리|보여|시각화)|도시해|plot\b/i,
    why: '그래프 펜스 출력이 강제됩니다 (google·openai 모델)' },
];

/** 걸린 트리거의 사유 목록. 빈 배열 = 안전 */
export function triggerWarnings(text: string): string[] {
  const out: string[] = [];
  for (const t of DISCUSS_TRIGGER_RES) {
    // `g` 플래그가 없어 lastIndex 상태가 없다 — test()를 반복해도 안전
    if (t.re.test(text)) out.push(t.why);
  }
  return out;
}

/**
 * 전송문 조립 (66a D7) — 첫 줄 `[문답 검증 · {label} r{rev}]`, 빈 줄, 본문 **무변경**.
 * ⚠ 치환은 없다(66a D11). String.replace에 문자열 인자를 넘기면 `$$`·`$&`가 패턴으로 해석돼 LaTeX가 깨진다(61b 규약) —
 *   그래서 연결(+)만 쓴다.
 */
export function buildAskMessage(q: Pick<AskQuestion, 'label' | 'rev' | 'text'>): string {
  return '[' + ASK_LABEL_PREFIX + ' · ' + q.label + ' r' + q.rev + ']\n\n' + q.text;
}

/** 저장할 때마다 +1. 옛 문서에 rev가 없으면 1 */
export function nextRev(rev: number | undefined | null): number {
  return typeof rev === 'number' && Number.isFinite(rev) && rev >= 1 ? Math.floor(rev) + 1 : 1;
}

/**
 * 새 문서의 order — **그 target 안에서** 최대 + 10. 비면 10 (66b D11).
 * 카테고리가 나뉘어 표시 순서는 탭 안에서만 정해진다. 전체 최대를 쓰면 덕수 계정(G 10~30 · P 10~40)에서
 * 새 풀이 질문이 50을 받아 엉뚱하게 멀어진다.
 */
export function nextOrder(list: readonly { order: number; target: AskTarget }[], target: AskTarget): number {
  let max = 0;
  for (const q of list) {
    if (q.target === target && typeof q.order === 'number' && q.order > max) max = q.order;
  }
  return max + 10;
}

/** 저장 전 검증 — 실패 사유 문자열, 통과면 null */
export function validateQuestion(q: { label: string; text: string }): string | null {
  if (!q.label || !q.label.trim()) return '라벨을 입력하세요';
  if (!q.text || !q.text.trim()) return '질문 본문을 입력하세요';
  if (q.text.length > ASK_TEXT_MAX) return `질문 본문이 너무 깁니다 (${q.text.length.toLocaleString()} / ${ASK_TEXT_MAX.toLocaleString()}자)`;
  return null;
}
