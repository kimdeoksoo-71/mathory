/**
 * Phase 66a — 문답 검증 질문 씨앗·순수 규칙 (import 0)
 *
 * `npm run test:ask`가 이 파일 하나를 tsc로 단독 컴파일한다 — import 문을 두지 말 것.
 * (lib/verify/*, lib/listColumns.ts 등과 같은 관례)
 *
 * 씨앗(`SEED_QUESTIONS`)은 **최초 1회 복사본**이다. 컬렉션이 비어 있을 때 한 번 Firestore에 쓰이고,
 * 이후 진실은 `users/{uid}/ask_questions`다. 여기 문안을 고쳐도 이미 만들어진 문서는 바뀌지 않는다(의도).
 * 꼬리(출력 형식 지시)는 본문의 일부다 — 코드가 붙이지 않는다. 그것도 실험 변수라서다.
 *
 * ⚠ D20 — 질문 본문은 /api/discuss의 트리거 낱말을 피한다(`DISCUSS_TRIGGER_RES`). 걸리면 사용자 메시지에
 *   "반드시 SymPy를 실행하라, 아니면 무효"가 부착되고 `tool_choice:{type:'any'}`로 도구가 강제된다 —
 *   *묻는* 질문이 *요청*으로 도착해 측정 대상이 바뀐다. 실측: 씨앗 G2 원문의 "검산"이 걸렸다(v5 X2).
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
  created_at: Date;
  updated_at: Date;
}

/** 새 문서를 만들 때 넘기는 필드 (id·타임스탬프 제외) */
export type AskQuestionInput = Pick<AskQuestion, 'label' | 'target' | 'text' | 'order' | 'enabled' | 'rev'>;

/** 전송 메시지 첫 줄 라벨 — D1′: 새 기능 이름은 '문답 검증'(61b는 UI에서 '교차 검증') */
export const ASK_LABEL_PREFIX = '문답 검증';

/** 본문 상한 — CommentEditor의 1000자는 textarea 전용이라 문답엔 안 걸린다(v3 V8). 이것이 유일한 상한 */
export const ASK_TEXT_MAX = 8000;

const SEED_G1 = `이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.
그런 전제에서, 풀이에 군더더기가 있으면 사소한 거라도 빠짐없이 찾아서 알려줘.

각 지적마다 원문을 짧게 인용하고, 왜 군더더기인지와 수정 방향을 적어줘.
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.`;

// ⚠ 넷째 항목의 "…확인하는 검산"은 CODE_EXEC_TRIGGER_RE에 걸려 "맞는지 확인하는 절차"로 바꿨다(덕수 승인 2026-09-15, Q2)
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
지적이 많으면 답변 길이 제한보다 빠짐없이 적는 쪽을 우선해. 수식은 $...$로 감싸.`;

const SEED_G3 = `이 문제는 오류가 없고 정답이 하나로 정해지는 정상 문항이야. 풀이의 결론도 옳아.

이 풀이를 논리적 완결성은 그대로 둔 채 가장 짧게 다시 써 줘.
그리고 줄어든 부분이 각각 왜 없어도 되는지 항목으로 정리해 줘 — 안 쓰이는 계산이었는지,
알려진 정리로 한 줄에 갈 수 있었는지, 단순 이항·통분을 여러 줄로 늘린 것이었는지,
나누지 않아도 되는 경우를 나눈 것이었는지.

수식은 $...$로 감싸.`;

/** 씨앗 3개 — G1 기준선(덕수 실사용 문장) · G2 "지워도 되는 것"(61h 정의) · G3 "더 짧게 쓸 수 있는 것"(61h 제외 영역) */
export const SEED_QUESTIONS: readonly AskQuestionInput[] = [
  { label: '군더더기(원문)',        target: 'solution', text: SEED_G1, order: 10, enabled: true, rev: 1 },
  { label: '군더더기(삭제 검사)',   target: 'solution', text: SEED_G2, order: 20, enabled: true, rev: 1 },
  { label: '군더더기(압축 재작성)', target: 'solution', text: SEED_G3, order: 30, enabled: true, rev: 1 },
];

/**
 * ⚠ app/api/discuss/route.ts의 `CODE_EXEC_TRIGGER_RE`(:256)·`GRAPH_TRIGGER_RE`(:266-267)와 **의도적 이중**이다.
 * 이 파일은 import 0이라 라우트를 못 읽는다 — 라우트를 고치면 여기도 함께 고칠 것.
 * (전례: lib/listColumns.ts verifyRank ↔ VERIFY_VERDICT_META — CLAUDE.md Phase 63 절)
 * 차단이 아니라 경고다(Q4) — "진짜 검산을 시켜 보는" 질문을 만들 수도 있다. 모르고 걸리는 것만 막는다.
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
 * 전송문 조립 (D7) — 첫 줄 `[문답 검증 · {label} r{rev}]`, 빈 줄, 본문 **무변경**.
 * ⚠ 치환은 없다(D11). String.replace에 문자열 인자를 넘기면 `$$`·`$&`가 패턴으로 해석돼 LaTeX가 깨진다(61b 규약) —
 *   그래서 연결(+)만 쓴다.
 */
export function buildAskMessage(q: Pick<AskQuestion, 'label' | 'rev' | 'text'>): string {
  return '[' + ASK_LABEL_PREFIX + ' · ' + q.label + ' r' + q.rev + ']\n\n' + q.text;
}

/** 저장할 때마다 +1. 옛 문서에 rev가 없으면 1 */
export function nextRev(rev: number | undefined | null): number {
  return typeof rev === 'number' && Number.isFinite(rev) && rev >= 1 ? Math.floor(rev) + 1 : 1;
}

/** 새 문서의 order — 현재 최대 + 10 (D18). 비면 10 */
export function nextOrder(list: readonly { order: number }[]): number {
  let max = 0;
  for (const q of list) if (typeof q.order === 'number' && q.order > max) max = q.order;
  return max + 10;
}

/** 저장 전 검증 — 실패 사유 문자열, 통과면 null */
export function validateQuestion(q: { label: string; text: string }): string | null {
  if (!q.label || !q.label.trim()) return '라벨을 입력하세요';
  if (!q.text || !q.text.trim()) return '질문 본문을 입력하세요';
  if (q.text.length > ASK_TEXT_MAX) return `질문 본문이 너무 깁니다 (${q.text.length.toLocaleString()} / ${ASK_TEXT_MAX.toLocaleString()}자)`;
  return null;
}
