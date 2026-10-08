/**
 * Phase 68a — 수식 영역 자동 영문 입력(한/영 전환 없는 수식 타이핑)의 **판정·짝짓기·큐 관리** 단일 원천.
 *
 * ⚠ import는 `./mathRegions`·`./latexScan`뿐(둘 다 import 0) — `npm run test:mathascii`가 이 파일을 tsc로 단독 컴파일한다.
 *   CM 배선(keydown capture · reconcile · typeText · blur 끊기)은 `components/editor/MarkdownEditor.tsx`에 있다.
 *
 * ── 원리 (v5 D1) ─────────────────────────────────────────────────────────────
 * 한글 IME를 켠 채로 둔다. 수식 영역 안에서 IME가 넣은 글자를 **눌린 물리 키의 US QWERTY 글자**로 사후 치환한다.
 * "IME 글자를 보지 말고 물리 키(`event.code`)를 보라" — Korean IME + CodeMirror 규약의 확장.
 *
 * ── 짝짓기는 글자 수가 아니라 시간 순이다 (v5 D5′ · E2) ───────────────────────
 * reconcile(setTimeout 0)이 다음 keydown보다 늦으면 `ㅁ`→`마`처럼 **음절이 만들어진 채** 한 삽입으로 온다.
 * 2벌식 `마`=2키 · `뫄`=3키 · `닭`=4키, 390은 또 다르다 — 자판별 분해표 없이는 "한글 1자 = 키 n개"를 셀 수 없다.
 * 그래서 삽입 시각 **이전**에 기록된 키 전부를 그 삽입의 치환값으로 쓴다(`pairInsertion`).
 *
 * ── 큐 관리는 안쪽 결합이다 (v5 I1~I4) ──────────────────────────────────────
 * 보류 삽입의 좌표는 삽입이 `from`에 닿으면 **뒤로 밀리고**, `to`에 닿아도 **늘어나지 않는다**(from +1 · to −1).
 * ⚠ `lib/mathSlots`의 자리는 반대(바깥 결합 −1·+1)이며 둘 다 의도다 — 자리는 "친 글자를 품어야" 하고,
 *   보류 삽입은 "옆에 온 글자를 품으면 안 된다"(품으면 `still` 검사가 깨져 `fㅁ{` 두 벌이 된다). 통일하지 말 것.
 * 키 폐기는 **순수 삭제·비자격 치환**에서만 — `ㅁ`→`마` 조합 갱신(CM은 `[5,6)→'마'` 치환으로 보고)은 키를 보존한다.
 */
import type { MathRegion } from './mathRegions';
import { scanMathRegions, mathRegionAt } from './mathRegions';
import { readGroup } from './latexScan';

/** 한글 — 첫가끝·호환 자모 · 음절 · 확장 자모 A/B · 반각 (D5′ · P17) */
export const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏가-힯ꥠ-꥿ힰ-퟿ﾠ-ￜ]/;
const HANGUL_G = /[ᄀ-ᇿ㄰-㆏가-힯ꥠ-꥿ힰ-퟿ﾠ-ￜ]/g;
const ASCII_PRINTABLE_RE = /^[\x20-\x7E]$/;

/** Safari: insertText가 keydown보다 먼저 온다 — 키가 없는 한글 삽입은 이만큼 기다린다 */
export const INS_WAIT_MS = 60;
/** 메아리(IME 버퍼 재확정) 판정 창 — 직전 치환으로 지운 **같은** 글자열이 이 안에 다시 오면 삭제 */
export const ECHO_WINDOW_MS = 120;
/** 기록 키가 어떤 삽입에도 쓰이지 못하면 버린다 */
export const KEY_TTL_MS = 250;
/** 이상 상태(짝 없는 키·메아리·범위 소실·합성 compositionend) 누적 경고 문턱(dev 콘솔 1회) */
export const ANOMALY_WARN_AT = 10;

/* ── US QWERTY — code → [기본, Shift]. Space는 **없다**(IME 확정 키 — P11). 영문자는 caps XOR shift ── */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGIT_SHIFT = [')', '!', '@', '#', '$', '%', '^', '&', '*', '('];
const PUNCT: Record<string, readonly [string, string]> = {
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Semicolon: [';', ':'], Quote: ["'", '"'], Backquote: ['`', '~'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
  IntlBackslash: ['\\', '|'],    // ISO 자판의 `<>` 자리 — 한국어 Mac에선 없음, 해 될 것 없다
  NumpadAdd: ['+', '+'], NumpadSubtract: ['-', '-'], NumpadMultiply: ['*', '*'], NumpadDivide: ['/', '/'],
  NumpadDecimal: ['.', '.'], NumpadEqual: ['=', '='],
};
function buildUsKeys(): Record<string, readonly [string, string]> {
  const m: Record<string, readonly [string, string]> = { ...PUNCT };
  for (const c of LETTERS) m[`Key${c.toUpperCase()}`] = [c, c.toUpperCase()];
  for (let d = 0; d <= 9; d++) { m[`Digit${d}`] = [String(d), DIGIT_SHIFT[d]]; m[`Numpad${d}`] = [String(d), String(d)]; }
  return m;
}
export const US_KEYS: Readonly<Record<string, readonly [string, string]>> = buildUsKeys();

/** 물리 키 → US 글자. 표에 없으면 null. 영문자만 CapsLock의 영향을 받는다(shift XOR caps). */
export function usCharFor(code: string, shift: boolean, caps: boolean): string | null {
  const pair = US_KEYS[code];
  if (!pair) return null;
  if (code.startsWith('Key')) return shift !== caps ? pair[1] : pair[0];
  return shift ? pair[1] : pair[0];
}

export type KeyClass = 'pass' | 'latin' | 'direct' | 'record';
export interface KeyLike {
  key: string; code: string; keyCode: number; isComposing: boolean;
  ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; caps: boolean;
}

/**
 * 키 분류 (D3 — 순서대로 첫 일치):
 * ⓐ ctrl·meta·alt → pass ⓑ code가 US 표에 없다(Tab·Enter·Space·Lang1…) → pass
 * ⓑ′ key가 두 글자 이상이고 'Process'가 아니다(Dead·HangulMode·Unidentified…) → pass
 *     (이 갈래가 없으면 국제 자판의 사자 키 `Dead`(code Digit6)가 ⓓ로 떨어져 `^`를 넣고 사자 키를 삼킨다 — E6)
 * ⓒ key가 ASCII 한 글자 · 조합 아님 · keyCode≠229 → latin(어떤 자판이든 손대지 않는다)
 * ⓓ keyCode≠229 · 조합 아님(비ASCII 한 글자 key — Mac 390 종성 `ᆼ`·`₩`) → direct(preventDefault + 즉시 삽입)
 * ⓔ 그 밖(229 · 'Process' · isComposing) → record(기록 뒤 시간 순 짝짓기)
 */
export function classifyKey(e: KeyLike): { cls: KeyClass; ch: string | null } {
  if (e.ctrlKey || e.metaKey || e.altKey) return { cls: 'pass', ch: null };
  const ch = usCharFor(e.code, e.shiftKey, e.caps);
  if (ch === null) return { cls: 'pass', ch: null };
  if (e.key.length > 1 && e.key !== 'Process') return { cls: 'pass', ch: null };
  const plain = !e.isComposing && e.keyCode !== 229;
  if (plain && ASCII_PRINTABLE_RE.test(e.key)) return { cls: 'latin', ch: null };
  if (plain && e.key !== 'Process') return { cls: 'direct', ch };
  return { cls: 'record', ch };
}

export interface RecordedKey { ch: string; t: number }
export interface PairInput {
  text: string; t: number; keys: readonly RecordedKey[]; now: number;
  lastReplaced: { text: string; t: number } | null;
}
export interface PairResult {
  /** 치환 결과(`text`와 같으면 무변경) */
  rep: string;
  /** 큐 앞에서부터 소비한 키 수 */
  consumed: number;
  /** Safari 순서(keydown이 뒤에 온다) — 잠시 뒤 재시도 */
  wait: boolean;
  /** 메아리 → `rep`가 ''(삭제) */
  echo: boolean;
  /** 키 없이 남긴 한글 글자 수(이상 카운터용) */
  kept: number;
  /** 삭제·재생을 실제로 할 것인가 — `rep !== text`이거나, **키와 짝지어진 ASCII 조합**(Windows `^`·`(`·`/`)이라 글자는 같아도
   *  inputHandler 체인(후위 변환·closeBrackets)을 태워야 영문 IME와 결과가 같아지는 경우(D6 ⓑ) */
  replay: boolean;
}

/**
 * 삽입 하나의 치환값을 정한다 (D5′).
 * ① 큐 머리부터 `t ≤ 삽입 시각`인 키를 전부 꺼낸다(시간 순 — 글자 수와 대응시키지 않는다)
 * ② 꼬리의 ASCII 글자는 같은 글자를 낸 키와 짝짓고(Windows의 `,`·Mac 조합 중 `{`), 나머지 키 전부가 한글 자리를 대신한다.
 *    키가 짝지어지지 않은 비한글 글자(Mac의 Space 확정 등)는 그대로 남는다 — 한글만 사라진다
 * ③ 한글이 있는데 키가 0개면: `INS_WAIT` 안 → wait / 지난 뒤 늦게 온 키가 있으면 **하나만**(Safari는 삽입 1 = 키 1) /
 *    없으면 메아리 판정(직전 치환으로 지운 **같은** 글자열 + `ECHO_WINDOW` 안)에서만 삭제, 아니면 그대로 둔다(kept)
 * ④ 한글도 ASCII도 아닌 글자(한자 변환·전각)는 무접촉 · 키 소비 0
 */
export function pairInsertion(p: PairInput): PairResult {
  const { text, keys } = p;
  const hasHangul = HANGUL_RE.test(text);
  let n = 0;
  while (n < keys.length && keys[n].t <= p.t) n++;

  if (n === 0) {
    if (!hasHangul) return { rep: text, consumed: 0, wait: false, echo: false, kept: 0, replay: false };
    if (p.now - p.t < INS_WAIT_MS) return { rep: text, consumed: 0, wait: true, echo: false, kept: 0, replay: false };
    if (keys.length > 0) n = 1;                                                          // Safari — 늦게 온 키 하나
    else if (p.lastReplaced && text === p.lastReplaced.text && p.now - p.lastReplaced.t < ECHO_WINDOW_MS) {
      return { rep: '', consumed: 0, wait: false, echo: true, kept: 0, replay: true };
    } else {
      return { rep: text, consumed: 0, wait: false, echo: false, kept: countHangul(text), replay: false };
    }
  }

  const eligible = keys.slice(0, n).map((k) => k.ch);
  // ② 꼬리 ASCII ↔ 같은 글자를 낸 키 (뒤에서부터)
  let ptr = eligible.length;
  let tail = text.length;
  while (tail > 0 && ptr > 0) {
    const c = text[tail - 1];
    if (!ASCII_PRINTABLE_RE.test(c)) break;
    if (eligible[ptr - 1] !== c) break;
    ptr--; tail--;
  }
  const forHangul = eligible.slice(0, ptr).join('');
  const firstHangul = text.search(HANGUL_RE);
  if (firstHangul === -1) {
    // 한글 없음 — 글자는 그대로. 꼬리 ASCII가 키와 짝지어졌으면(Windows `,`) 거기까지의 키를 소비(정렬 유지 — 앞의 고아 키도 함께),
    // 하나도 안 맞으면(한자 변환·전각 기호 — D5′ ⑤) 키 소비 0
    const matched = ptr < eligible.length;
    return { rep: text, consumed: matched ? n : 0, wait: false, echo: false, kept: 0, replay: matched };
  }
  if (forHangul === '') {
    // 꼬리 ASCII가 키를 다 가져갔다 — 한글은 둘 수밖에 없다(글자는 같지만 ASCII 쪽은 체인을 태운다)
    return { rep: text, consumed: n, wait: false, echo: false, kept: countHangul(text), replay: true };
  }
  const stripped = text.replace(HANGUL_G, '');
  const rep = stripped.slice(0, firstHangul) + forHangul + stripped.slice(firstHangul);
  return { rep, consumed: n, wait: false, echo: false, kept: 0, replay: true };
}

function countHangul(text: string): number {
  return (text.match(HANGUL_G) || []).length;
}

/** D5′ ⑦ — 보류 삽입이 삭제로 사라졌을 때 그보다 오래된 키를 버린다 */
export function dropKeysBefore(keys: readonly RecordedKey[], t: number): RecordedKey[] {
  return keys.filter((k) => k.t > t);
}

/** D5′ ⑥ — TTL */
export function expireKeys(keys: readonly RecordedKey[], now: number): RecordedKey[] {
  return keys.filter((k) => now - k.t <= KEY_TTL_MS);
}

/**
 * D6 — 재생 대상: 한글을 품었거나, IME 조합 삽입(`input.type.compose`·`.compose.start`)이면서 **flush 시점에 조합이 살아 있던** 것.
 * ⚠ `compositionLive`(= 그 업데이트 때의 `view.compositionStarted`)가 거짓이면 ASCII 조합은 재생하지 않는다 — compositionend가
 *   CM flush보다 먼저 온 **동기 조합**(Windows식 `^`·`(`, Mac의 조합 중 `{`)에서는 CM이 그 글자에 대해 inputHandler 체인을
 *   **이미 태웠다**(`composing=-1`). 그 위에 재생하면 이중 적용이다(실측: `^{}`가 두 번 돌아 커서가 `^|{}`에 남았다).
 *   조합이 살아 있던 flush(`composing>0`)에서는 Mathory 가드·closeBrackets가 전부 건너뛰므로 재생이 체인을 대신한다.
 */
export function needsReplay(text: string, userEvent: string | undefined, compositionLive: boolean): boolean {
  if (!text) return false;
  if (HANGUL_RE.test(text)) return true;
  return compositionLive && !!userEvent && userEvent.startsWith('input.type.compose');
}

/**
 * 재생하지 않은 삽입이 큐 머리 키와 **같은 글자로 시작**하면 그 키는 브라우저·체인이 이미 넣은 것이다 — 소비한다.
 * (동기 조합의 `(` → closeBrackets `()`, Mac 조합 중 `{` → `{}`, D20 `^`.) 안 버리면 TTL 250ms 안의 다음 한글 삽입에 **앞에 붙는다**(실측 `(a`).
 */
export function consumeTypedKeys(keys: readonly RecordedKey[], ins: string): RecordedKey[] {
  if (!keys.length || !ins || keys[0].ch !== ins[0]) return keys.slice();
  return keys.slice(1);
}

/* ── 큐 관리 (I4) ───────────────────────────────────────────────────────────── */
export interface PendingIns { from: number; to: number; text: string; t: number }
/** updateListener가 `iterChanges`로 모은 변경 하나 — 옛 좌표(fa·ta) 오름차순 · 서로 겹치지 않음 */
export interface ChangeDesc {
  fa: number; ta: number; fb: number; tb: number; ins: string;
  /** needsReplay ∧ 수식 안 ∧ `\text` 밖 ∧ 토글 켬 ∧ 우리 트랜잭션 아님 */
  qualifies: boolean;
}
export interface AdvanceResult {
  entries: PendingIns[];
  /** 순수 삭제·비자격 치환으로 사라진 보류 삽입 중 가장 늦은 t — 이보다 오래된 키를 버린다. 없으면 null */
  dropKeysBeforeT: number | null;
  added: PendingIns[];
}

/**
 * ① 옛 좌표로 겹침 판정 → ② 겹친 항목 제거(변경이 순수 삭제·비자격 삽입이면 키 폐기 신호, 자격 삽입(ㅁ→마)은 키 보존)
 * → ③ 생존 항목을 **안쪽 결합**으로 매핑 → ④ 자격 삽입을 새 좌표로 추가.
 * 매핑 산술: 변경이 비중첩·오름차순이라 "자기보다 앞선 변경의 길이 차 누적"으로 충분하다. 경계 —
 * 순수 삽입이 `from`에 닿으면(`ta === from`) 앞선 것으로 보아 뒤로 민다(+1), `to`에 닿으면(`fa === to`) 뒤의 것으로 보아 늘리지 않는다(−1).
 * CM `ChangeSet.mapPos`의 치환 경계(`[5,6)→'마'`는 assoc 무관 `[5,6)`)와 결과가 같다.
 */
export function advanceQueue(entries: readonly PendingIns[], changes: readonly ChangeDesc[], now: number): AdvanceResult {
  let dropT: number | null = null;
  const survivors: PendingIns[] = [];
  for (const h of entries) {
    let dropped = false;
    let delta = 0;
    for (const c of changes) {
      const overlaps = c.fa === c.ta
        ? (c.fa > h.from && c.fa < h.to)                 // 순수 삽입: 범위 **안**에 떨어질 때만(경계는 겹침 아님)
        : (c.fa < h.to && c.ta > h.from);                // 삭제·치환
      if (overlaps) {
        if (!(c.qualifies && c.ins)) dropT = dropT === null ? h.t : Math.max(dropT, h.t);
        dropped = true;
        break;
      }
      if (c.ta <= h.from) delta += (c.tb - c.fb) - (c.ta - c.fa);   // 앞선 변경(= `from`에 닿는 삽입 포함)
    }
    if (!dropped) survivors.push(delta ? { ...h, from: h.from + delta, to: h.to + delta } : h);
  }
  const added: PendingIns[] = [];
  for (const c of changes) {
    if (c.qualifies && c.ins) added.push({ from: c.fb, to: c.tb, text: c.ins, t: now });
  }
  const merged = survivors.concat(added).sort((a, b) => a.from - b.from);
  return { entries: merged, dropKeysBeforeT: dropT, added };
}

/* ── keydown 시점의 영역 판정은 "삽입 뒤의 문서"로 한다 (2026-10-08 덕수 실물 검수 K8) ──────────────
   `$` 버튼이 넣는 `$|$`가 **행 끝**이면 스캐너(R-$$ (a))가 `$$`를 display 펜스로 읽어 커서를 "밖"으로 판정한다 →
   첫 키가 기록되지 않아 한글로 남고, 글자가 들어간 뒤 `$ㅏ$`는 인라인이라 둘째 키부터 치환됐다(실측 `$ㅏ(x)$`).
   글자 하나를 넣어 본 문서로 판정하면 updateListener(삽입 시작 `fb`에서 판정)와 기준이 같아진다. */
export interface ProbeResult { region: MathRegion | null; probe: string }
export function probeInsertionRegion(doc: string, pos: number): ProbeResult {
  const probe = doc.slice(0, pos) + 'x' + doc.slice(pos);
  return { region: mathRegionAt(scanMathRegions(probe), pos), probe };
}

/* ── `\text` 계열 인자 안 판정 (D13) ───────────────────────────────────────── */
export const TEXT_CMDS: readonly string[] = [
  'textnormal', 'textbf', 'textit', 'textrm', 'textsf', 'texttt', 'textup', 'text', 'mbox', 'hbox',
];
// 긴 이름이 앞 — `\text{`가 `\textbf{`에 걸리지 않는 것은 `{`가 바로 따라와야 해서이고, 순서는 보기 좋으라고
const TEXT_CMD_RE = new RegExp(`\\\\(${TEXT_CMDS.join('|')})\\{`, 'g');

/** 커서가 수식 영역 안의 `\text{…}` 계열 인자 **안**인가(미닫힘이면 영역 끝까지 안으로 본다). `\left\{`는 명령이 아니다. */
export function isInTextArg(doc: string, pos: number, region: MathRegion): boolean {
  const start = region.innerFrom;
  const end = Math.min(pos, region.innerTo);
  const head = doc.slice(start, end);
  TEXT_CMD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEXT_CMD_RE.exec(head)) !== null) {
    const open = start + m.index + m[0].length - 1;        // `{`의 절대 인덱스
    if (open >= pos) break;
    const close = readGroup(doc, open);
    if (close === -1 || pos <= close) return true;          // 미닫힘이면 끝까지 안 · 닫힘이면 `}` 위치까지 안
  }
  return false;
}
