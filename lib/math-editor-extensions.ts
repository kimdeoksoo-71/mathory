/**
 * 수식 편집창에서 공통으로 쓰는 CodeMirror 확장 — **블록 편집기(`MarkdownEditor`)와 댓글 편집기(`LatexInputEditor`)의 단일 원천**.
 *
 * 제공:
 *  - insertInlineMathIn        인라인 수식 스마트 삽입(M7 D1·D4 — 선택 감싸기 · 인접 `$` 공백). `$` 버튼·Ctrl+M·Alt+= 공용
 *  - insertDisplayMathBlock    독립행 `$$` 블록 삽입(상하 빈 줄 1개 · 선택이 있으면 블록 안에 — 68b D2′). `$$` 버튼·Ctrl+Shift+M 공용
 *  - exitRegionOfSelection / exitMath / dispatchExit
 *                              Phase 68b 수식 "나오기"(D5′·D5): 판정은 `mathRegions.exitRegionAt`(삽입 뒤 문서 기준), 위치는 `mathInput.mathExitPos`
 *  - jumpToNextBrace           Alt+Tab(수식 내 `{` 순회 — 채운 칸까지, Mac 전용: Windows는 OS가 가져간다)
 *  - latexCompletionSource     `\`로 시작하는 LaTeX 명령 자동완성 소스
 *  - createMathShortcuts()     Ctrl+M · Ctrl+Shift+M · Alt+=(mac Ctrl+=) · Shift+Esc · Alt+Tab 묶음 (Phase 68b)
 *                              + IME 조합 중 단축키 구제(조합 확정 뒤 실행 — 검수 17)
 *  - mathTabCommand / rowEnterCommand / createMathKeys  Tab 엔진 ⓪~⑦(Phase 68 · 68b ⑥′) · 행 환경 Enter — 두 편집기 공용
 *  - createMathInput()         입력 처리기(후위 변환 · 선택 \\left 감싸기 · \\left 쌍 · 괄호 규칙) + closeBrackets — 두 편집기 공용
 *  - createMathAscii(enabled)  수식 영역 자동 영문 입력(Phase 68a) 배선 — 판정은 lib/mathAscii. 설정 키 MATH_ASCII_PREF_KEY
 *
 * ⚠ **원칙(덕수 2026-10-09): 편집창과 댓글·agent 입력창의 수식 입력 방식은 같아야 한다.** 수식 입력 동작은 컴포넌트에
 *   두지 말고 이 파일(또는 lib 순수 모듈)에 두어 두 편집기가 같은 것을 쓰게 할 것. 한쪽에만 넣는 것은 이유를 적은 의도적 예외뿐이다.
 *  - createLatexAutocompletion() autocompletion 확장 (`\` 트리거)
 *
 * ── Phase 68b 키 체계 ─────────────────────────────────────────────────────────
 *  수식 **밖**: Ctrl+M → `$|$`(선택은 `$sel$`) · Ctrl+Shift+M → `$$\n|\n$$`(선택은 블록 안). Mac도 Control(⌘M은 창 최소화).
 *  수식 **안**: 네 키 모두 "한 번에 나오기" — 인라인·`\(`·`\[`·미닫힘은 닫는 구분자 뒤, 닫힌 `$$`는 닫는 행의 **다음 행**(없거나
 *  비공백이면 `\n`을 넣어 빈 행). 빈 쌍 `$|$`·빈 블록 `$$\n|\n$$`는 **지운다**(한 번 더 누르면 되돌리는 체감 — Q8·Q11).
 *  ⚠ 안/밖 판정은 반드시 `exitRegionAt`(글자 하나를 넣어 본 문서) — `mathRegionAt`을 직접 쓰면 행 끝 `$|$`를 밖으로 읽어
 *    두 번째 Ctrl+M이 `$ $|$ $`를 만든다(68a K8과 같은 함정).
 *  `Ctrl+N` 연타는 폐지(Windows 브라우저 예약 키라 시작조차 안 됐다). `Shift+Esc`는 HWP 호환 별칭 — 수식 밖에서도 **항상 소비**
 *  (Windows 작업 관리자 차단; "소비"는 preventDefault뿐, 전파는 막지 않는다). 괄호 탈출은 편집창 Tab ⑤가 맡는다.
 *  키 매칭: 한글 IME 상태라도 CM이 `base[keyCode]`로 물리 키를 되찾는다(수정자 조합 한정 — view dist runHandlers).
 *  keymap `run`은 IME 조합 중엔 도달하지 않는다(`ignoreDuringComposition`) — `view.composing` 가드를 두지 않는 이유.
 */

import { keymap, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { Prec, Annotation, Transaction, type Extension } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';
import {
  autocompletion,
  completionStatus,
  acceptCompletion,
  closeBrackets,
  closeBracketsKeymap,
  CompletionContext,
  Completion,
} from '@codemirror/autocomplete';
import { LATEX_COMPLETIONS, isInsideMath } from './latex-completions';
import { scanMathRegions, mathRegionAt, exitRegionAt, type ExitRegion } from './mathRegions';
import {
  mathExitPos, isEmptyDisplay, emptyDisplayDeleteRange, type ExitPlan,
  matchAbbrev, findEnclosingEnv, groupDepth, nextSlot, displayTabExit, AMP_ENVS, autoFracAt, rowEnterPlan,
} from './mathInput';
import { slotsField, insertWithSlots, nextSlotCmd, prevSlotCmd, hasActiveSlots } from './mathSlots';
import {
  classifyKey, pairInsertion, dropKeysBefore, expireKeys, needsReplay, consumeTypedKeys, isInTextArg, advanceQueue,
  probeInsertionRegion, INS_WAIT_MS, ANOMALY_WARN_AT,
} from './mathAscii';
import type { RecordedKey, PendingIns, ChangeDesc } from './mathAscii';
import { serializeNodes, type SNode } from './chatExtract';
import { htmlToSNodes, type BareConverter } from './snodeDom';
import { smartPasteText } from './mathPaste';

/** 68a 자기 트랜잭션 표시(삭제·재생) — update가 자기 삽입을 큐에 넣지 않게 · 진단 기록이 구분하게 */
const mathAsciiTx = Annotation.define<boolean>();

// ─────────────────────────────────────────────
// 0) 입력 진단 기록 (2026-10-09 윈도우 검수 — 실기기 IME 이벤트 순서를 보려고)
// ─────────────────────────────────────────────
/* 켜기: 브라우저 콘솔에서 `localStorage.setItem('mathory-input-diag', 'on')` → 새로고침. 끄기: 'off' 또는 removeItem.
   재현 뒤 콘솔에서 `copy(__mathoryInputDiag.dump())` → 클립보드에 최근 400줄. **꺼져 있으면 아무것도 하지 않는다**(리스너 0).
   서버로 보내지 않는다 — 브라우저 메모리에만 있다. 기록: keydown/keyup(키·코드·keyCode·조합 표시·수정자) · CM preventDefault 여부 ·
   composition 3종 · beforeinput · 편집기 트랜잭션(userEvent·삽입/삭제 요약 · 68a 자기 트랜잭션 표시) · 수식 명령 결정(rescue·flush). */
const DIAG_KEY = 'mathory-input-diag';
const diagBuf: string[] = [];
let diagOn: boolean | null = null;
let diagT0 = 0;
function diagEnabled(): boolean {
  if (diagOn !== null) return diagOn;
  try { diagOn = typeof window !== 'undefined' && localStorage.getItem(DIAG_KEY) === 'on'; } catch { diagOn = false; }
  if (diagOn) installDiag();
  return diagOn;
}
function diag(line: string): void {
  if (!diagEnabled()) return;
  diagBuf.push(`${(performance.now() - diagT0).toFixed(0).padStart(7)}ms ${line}`);
  if (diagBuf.length > 400) diagBuf.shift();
}
function installDiag(): void {
  diagT0 = performance.now();
  const mods = (e: KeyboardEvent) => ['ctrl', 'alt', 'shift', 'meta'].filter((m) => (e as unknown as Record<string, boolean>)[`${m}Key`]).join('+');
  const keyLine = (e: KeyboardEvent) => `${e.type} key=${JSON.stringify(e.key)} code=${e.code} keyCode=${e.keyCode} isComposing=${e.isComposing}${mods(e) ? ' ' + mods(e) : ''}`;
  window.addEventListener('keydown', (e) => diag(keyLine(e)), true);
  window.addEventListener('keydown', (e) => diag(`  └ keydown ${e.code} defaultPrevented=${e.defaultPrevented}`));
  window.addEventListener('keyup', (e) => diag(keyLine(e)), true);
  for (const t of ['compositionstart', 'compositionupdate', 'compositionend'] as const) {
    window.addEventListener(t, (e) => diag(`${t} data=${JSON.stringify((e as CompositionEvent).data)}`), true);
  }
  window.addEventListener('beforeinput', (e) => diag(`beforeinput ${(e as InputEvent).inputType} data=${JSON.stringify((e as InputEvent).data)}`), true);
  (window as unknown as Record<string, unknown>).__mathoryInputDiag = {
    dump: () => [`mathory input diag · ${navigator.userAgent} · platform=${navigator.platform}`, ...diagBuf].join('\n'),
    clear: () => { diagBuf.length = 0; diagT0 = performance.now(); },
  };
  console.info("[mathory] 입력 진단 기록 켜짐 — 재현 뒤 콘솔에서 copy(__mathoryInputDiag.dump())");
}
/** 편집기 트랜잭션 기록(진단이 켜졌을 때만 내용을 남긴다) */
const diagUpdates = EditorView.updateListener.of((u) => {
  if (!u.docChanged || !diagEnabled()) return;
  for (const tr of u.transactions) {
    if (!tr.docChanged) continue;
    const parts: string[] = [];
    tr.changes.iterChanges((fa, ta, _fb, _tb, ins) => { parts.push(`[${fa},${ta})→${JSON.stringify(ins.toString())}`); });
    diag(`  tx ${tr.annotation(Transaction.userEvent) ?? '-'}${tr.annotation(mathAsciiTx) ? ' (68a)' : ''} ${parts.join(' ')} composing=${u.view.composing}`);
  }
});

// ─────────────────────────────────────────────
// 1) 삽입 (M7 D1·D4 · 68b D2·D2′)
// ─────────────────────────────────────────────

/* M7 D1·D4 — 인라인 수식 스마트 삽입. `$` 버튼·Ctrl+M·Alt+=가 같은 함수를 쓴다.
   ⚠ `$ $`(안쪽 공백)로 바꾸지 말 것 — 소스에 공백이 영구히 남고 인접 `$` 문제는 그대로다(M7 P1 기각).
   공백은 **인접 `$`일 때만**: `$x$` 바로 앞에서 누르면 `$|$ $x$`, 바로 뒤면 `$x$ $|$`. */
export function insertInlineMathIn(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const pre = from > 0 && doc.sliceString(from - 1, from) === '$' ? ' ' : '';
  const post = to < doc.length && doc.sliceString(to, to + 1) === '$' ? ' ' : '';
  const sel = doc.sliceString(from, to);
  const insert = `${pre}$${sel}$${post}`;
  const anchor = sel ? from + pre.length + sel.length + 2 : from + pre.length + 1;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor }, userEvent: 'input' });
  view.focus();
}

/* `$$ … $$` 블록 삽입 시 상하에 정확히 빈 줄 1개씩 보장(저장 정규화 `normalizeDisplayMathSpacing`과 같은 모양).
   - 커서(선택이 있으면 선택 **바깥쪽**) 좌·우의 공백(개행 포함)을 흡수해 그 자리에 정규화 삽입 — 68b D2′
   - 문서 시작/끝이면 그쪽 패딩은 생략
   - 선택이 있으면 trim한 본문을 블록 안에 넣고 커서는 본문 끝(없으면 빈 줄 가운데) */
export function insertDisplayMathBlock(view: EditorView): void {
  const doc = view.state.doc.toString();
  const sel = view.state.selection.main;
  const body = sel.empty ? '' : doc.slice(sel.from, sel.to).trim();
  let left = sel.from;
  while (left > 0 && /\s/.test(doc[left - 1])) left--;
  let right = sel.to;
  while (right < doc.length && /\s/.test(doc[right])) right++;
  const padBefore = left === 0 ? '' : '\n\n';
  const padAfter = right === doc.length ? '' : '\n\n';
  const insert = padBefore + '$$\n' + body + '\n$$' + padAfter;
  const cursor = left + padBefore.length + 3 + body.length;   // "$$\n" 다음 + 본문
  view.dispatch({ changes: { from: left, to: right, insert }, selection: { anchor: cursor }, userEvent: 'input' });
  view.focus();
}

// ─────────────────────────────────────────────
// 2) 나오기 (Phase 68b D5′·D5)
// ─────────────────────────────────────────────

/** 선택의 head → 없으면 anchor 순으로 `exitRegionAt`. 양끝 중 하나라도 수식 안이면 "나오기"(걸친 선택을 감싸 수식을 깨지 않게) */
export function exitRegionOfSelection(view: EditorView): ExitRegion | null {
  const doc = view.state.doc.toString();
  const sel = view.state.selection.main;
  return exitRegionAt(doc, sel.head) ?? (sel.empty ? null : exitRegionAt(doc, sel.anchor));
}

/** `mathExitPos`·`displayTabExit` 결과를 한 dispatch로(insert가 있으면 변경 + 선택 — undo 1스텝). 68 자리 StateField는 변경을 매핑하고 선택이 자리 밖이면 해제한다.
 *  ⚠ 문서를 바꾸는 나오기(`\n` 삽입 · 빈 쌍·빈 블록 삭제)는 `isolateHistory.of('full')` — CM history가 500ms 안의 인접 변경을 한 그룹으로 합쳐
 *  "Ctrl+Shift+M 두 번(삽입+삭제)"이 ⌘Z 한 번에 통째로 풀렸다(CDP ⑭ 실측). 커서 이동 키의 문서 변경은 항상 자기 undo 스텝이어야 한다 */
const OWN_STEP = { annotations: isolateHistory.of('full') } as const;
export function dispatchExit(view: EditorView, plan: ExitPlan): true {
  view.dispatch({
    ...(plan.insert !== undefined ? { changes: { from: plan.at as number, insert: plan.insert }, ...OWN_STEP } : {}),
    selection: { anchor: plan.pos },
    scrollIntoView: true,
  });
  return true;
}

/** D5 — ① 빈 쌍 → 삭제 ①′ 빈 블록 → 블록 삭제(`emptyDisplayDeleteRange`) ②③ 그 밖 → `mathExitPos`로 이동 */
export function exitMath(view: EditorView, r: ExitRegion): true {
  if (r.kind === 'empty') {
    view.dispatch({ changes: { from: r.from, to: r.to, insert: '' }, selection: { anchor: r.from }, scrollIntoView: true, ...OWN_STEP });
    return true;
  }
  const doc = view.state.doc.toString();
  if (isEmptyDisplay(doc, r.region)) {
    const d = emptyDisplayDeleteRange(doc, r.region);
    view.dispatch({ changes: { from: d.from, to: d.to, insert: d.insert }, selection: { anchor: d.cursor }, scrollIntoView: true, ...OWN_STEP });
    return true;
  }
  return dispatchExit(view, mathExitPos(doc, r.region));
}

// ─────────────────────────────────────────────
// 3) Alt+Tab — 수식 내 다음 `{` 안으로 (끝이면 처음으로 순회). 채운 칸까지 돈다(빈 칸만 보는 Tab ⑤와 용도가 다르다, Phase 68 P3)
// ─────────────────────────────────────────────
export function jumpToNextBrace(view: EditorView): boolean {
  const doc = view.state.doc.toString();
  const cursor = view.state.selection.main.head;
  const region = mathRegionAt(scanMathRegions(doc), cursor);
  if (!region || region.empty) return false;
  const bracePositions: number[] = [];
  for (let k = region.innerFrom; k < region.innerTo; k++) {
    if (doc[k] === '{') bracePositions.push(k + 1);
  }
  if (bracePositions.length === 0) return false;
  let nextPos = bracePositions.find((p) => p > cursor);
  if (nextPos === undefined) nextPos = bracePositions[0];
  view.dispatch({ selection: { anchor: nextPos } });
  return true;
}

// ─────────────────────────────────────────────
// 3′) Tab 엔진 (Phase 68 D9~D14 · 68b ⑥′) — 편집창·댓글·agent 입력창 **한 벌** (2026-10-09 덕수 검수 21)
// ─────────────────────────────────────────────
/* Tab은 편집기에 포커스가 있으면 **항상** 편집기 것이다(return true — 포커스 이탈 없음). 밖으로 나가는 길은 CM 내장
   Escape 뒤 2초 안 Tab · mac Shift-Alt-m. 순서(첫 성공에서 멈춤): ⓪ IME 조합 중 → 제자리 ① 자동완성 열림 → 수락
   ② 수식 안 + 커서 앞 약어 → 확장(활성 자리 안에서도 — 새 자리 목록이 옛 것을 대체) ③ 활성 자리 → 다음 자리
   ④ 수식 안 + 행 환경 본문 + 그룹 깊이 0 + AMP_ENVS → `&` ⑤ 수식 안 → 자리 이동(그룹 탈출 우선 → 커서 뒤 빈 괄호)
   ⑥ 인라인 `$…$` 안 → 닫는 `$` 뒤(P22) ⑥′ 닫힌 display 식 끝 → 밖(68b D7 — `$$`는 다음 행, `\[`는 `\]` 뒤) ⑦ 제자리.
   ⚠ 약어 맵은 **누를 때마다** `getAbbrevs()`로 읽는다 — 편집창은 abbrevsRef, 댓글 쪽은 `lib/abbrevStore`. 판정은 전부 lib/mathInput,
   자리 상태는 lib/mathSlots(`slotsField`가 그 편집기 extensions에 있어야 한다 — `createMathTab`이 함께 넣는다). */
export function mathTabCommand(getAbbrevs: () => Record<string, string>) {
  return (view: EditorView): boolean => {
    if (view.composing) return true;
    flushMathAscii(view);   // 윈도우 경합 — 확정 직후 Tab이 68a 치환 전 문서(`liㅡ`)를 보지 않게
    if (completionStatus(view.state) === 'active') { acceptCompletion(view); return true; }
    const doc = view.state.doc.toString();
    const sel = view.state.selection.main;
    const pos = sel.head;
    const region = mathRegionAt(scanMathRegions(doc), pos);
    if (region && sel.empty) {
      const m = matchAbbrev(doc, pos, getAbbrevs(), region);
      if (m) { insertWithSlots(view, m.from, pos, m.content); return true; }
    }
    if (hasActiveSlots(view.state) && nextSlotCmd(view)) return true;
    if (region) {
      const env = findEnclosingEnv(doc, pos, region);
      if (env && AMP_ENVS.has(env.name) && pos >= env.bodyFrom && pos <= env.bodyTo
          && groupDepth(doc, env.bodyFrom, pos) === 0) {
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: '&' },
          selection: { anchor: sel.from + 1 }, scrollIntoView: true, userEvent: 'input.type',
        });
        return true;
      }
      const slot = nextSlot(doc, pos, region);
      if (slot !== null) { view.dispatch({ selection: { anchor: slot }, scrollIntoView: true }); return true; }
      if (region.kind === 'inline' && region.closed && !region.empty) {
        view.dispatch({ selection: { anchor: region.to }, scrollIntoView: true });
        return true;
      }
      const dx = displayTabExit(doc, pos, region);
      if (dx) return dispatchExit(view, dx);
    }
    return true;
  };
}

export function mathShiftTabCommand(view: EditorView): boolean {
  if (view.composing) return true;
  if (hasActiveSlots(view.state)) prevSlotCmd(view);
  return true;
}

/** 두 편집기 공용 키 묶음: 자리 StateField + Tab/Shift+Tab + 행 환경 Enter(`Prec.high` — 완성 Enter는 `Prec.highest`라 먼저 간다).
 *  ⚠ 댓글 입력창에선 `markdown()`보다 **앞**에 둘 것 — 그 언어의 Enter(목록 이어 쓰기)도 `Prec.high`라 배열 순서가 승부를 가른다 */
export function createMathKeys(getAbbrevs: () => Record<string, string>): Extension {
  return [
    slotsField,
    Prec.high(keymap.of([
      { key: 'Tab', run: mathTabCommand(getAbbrevs), shift: mathShiftTabCommand },
      { key: 'Enter', run: rowEnterCommand },
    ])),
  ];
}

// ─────────────────────────────────────────────
// 3″) IME 조합 중 단축키 구제 (2026-10-09 덕수 검수 17 · 계획서 R2)
// ─────────────────────────────────────────────
/* 맥 한글 IME에서 `한`을 치자마자 Ctrl+M을 누르면 IME가 그 키를 **조합 확정**에 쓰고 keydown은 조합 중(`isComposing`·keyCode 229)으로
   온다. CM은 `composing > 0`이면 키 이벤트를 통째로 버리므로(view dist `ignoreDuringComposition`) keymap이 돌지 않고 `한` 확정만 남았다.
   → 편집기 루트 **capture** keydown에서 조합 중 Ctrl+M 계열을 기억해 두고, compositionend(조합 확정) 뒤 CM이 확정 글자를 문서에
   반영한 다음 같은 명령을 실행한다. preventDefault는 하지 않는다(확정 동작을 IME에 그대로 맡긴다).
   조합 밖인데 keyCode 229로 오는 경우(계획서 F3 — `base[229]`가 없어 keymap이 못 맞춘다)는 짧게 기다렸다 실행한다.
   ⚠ CM이 이미 처리한 키(`defaultPrevented`)는 건너뛴다 — 두 번 돌지 않게. 68a 래퍼 capture는 수정자 조합을 `pass`해 겹치지 않는다. */
const RESCUE_POLL_MS = 20;
const RESCUE_GIVE_UP_MS = 800;
/* 윈도우 검수(2026-10-09) 7 — 윈도우 IME는 Ctrl을 누르는 순간 조합을 **먼저** 확정하고(compositionend) 그 뒤에 조합 중 표시가 남은
   keydown을 보낼 수 있다. 그러면 기다릴 compositionend가 이미 지나갔다 → 조합이 살아 있지 않으면 이 시간 뒤 확정 신호 없이 실행.
   맥 순서(keydown → compositionend)는 그동안 `compositionStarted`가 참이라 이 갈래에 들어오지 않는다 */
const RESCUE_END_GRACE_MS = 60;

type MathKeyKind = 'inline' | 'display';
function matchMathKey(e: KeyboardEvent, mac: boolean): MathKeyKind | null {
  if (e.metaKey) return null;
  if (e.code === 'KeyM' && e.ctrlKey && !e.altKey) return e.shiftKey ? 'display' : 'inline';
  if (e.code === 'Equal' && !e.shiftKey && (mac ? e.ctrlKey && !e.altKey : e.altKey && !e.ctrlKey)) return 'inline';
  return null;
}

/* ── Phase 68c G2 · Q11 — "조합이 끝난 뒤 실행"의 공용 헬퍼. composingRescue(68b)의 tick 로직을 일반화했다 ──
   소비처: ① composingRescue(편집기 capture keydown — 조합 중 Ctrl+M 계열) ② EditorView window 단축키(⌘B·⌘J·⌘⇧L — 핸들 `whenSettled`).
   · 조합 중이 아니고 키도 조합 키가 아니면 **즉시**(동기) — 그 전에 flushMathAscii(68a 보류 치환을 끝낸 문서를 보게)
   · 아니면 20ms 폴링으로 `!composing && !compositionStarted`를 기다린다. 맥 순서(keydown → compositionend)는 그동안 `compositionStarted`가 참.
     윈도우 순서(compositionend가 keydown보다 먼저 — 키는 229로만 남는다)는 RESCUE_END_GRACE_MS 뒤 확정 신호 없이 실행.
   · 800ms 안에 조합이 안 끝나면 버린다 · 지연 실행은 편집기에 포커스가 있을 때만(composingRescue 그대로)
   ⚠ [v3 F7] 건너뜀 조건(`skipIf`)은 **호출부가 준다** — composingRescue는 `ev.defaultPrevented`(CM keymap이 이미 처리했나)를 주고,
     window 단축키는 주지 않는다(그 핸들러는 자기 keydown을 스스로 preventDefault하므로 같은 검사를 하면 늘 건너뛴다).
   반환값 = 취소 함수(composingRescue는 새 키가 오면 옛 대기를 취소한다 — "가장 최근 키만 산다"). */
export interface AfterCompositionOpts {
  /** 키 자체가 조합 키였나(`isComposing` ‖ keyCode 229 — lib/imeKey `isImeKey`). 참이면 즉시 갈래를 타지 않고,
   *  compositionend를 못 봤으면 RESCUE_END_GRACE_MS까지 기다린다 */
  composingAtKey?: boolean;
  /** 조합이 아니어도 즉시 실행하지 않고 첫 폴링까지 미룬다(composingRescue의 조합 밖 229 — CM keymap이 처리할 기회를 준 뒤 skipIf로 거른다) */
  defer?: boolean;
  /** 참이면 실행하지 않고 끝낸다(폴링마다 본다) */
  skipIf?: () => boolean;
  /** 진단 기록 라벨 */
  label?: string;
}
export function runAfterComposition(view: EditorView, fn: () => void, opts: AfterCompositionOpts = {}): () => void {
  const label = opts.label ?? 'after-composition';
  const live = () => view.composing || view.compositionStarted;
  if (!opts.composingAtKey && !opts.defer && !live()) {
    flushMathAscii(view);
    fn();
    return () => {};
  }
  const t0 = Date.now();
  let ended = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  const onEnd = () => {
    ended = true;
    if (!done) arm();                                  // 확정 직후 곧바로 한 번 더 본다
  };
  const finish = () => {
    done = true;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    view.contentDOM.removeEventListener('compositionend', onEnd);
  };
  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(tick, RESCUE_POLL_MS);
  };
  const tick = () => {
    timer = null;
    if (done) return;
    if (Date.now() - t0 > RESCUE_GIVE_UP_MS) { finish(); diag(`  ${label} gave up`); return; }
    if (opts.skipIf?.()) { finish(); diag(`  ${label} skip`); return; }
    if (live()) { arm(); return; }
    if (opts.composingAtKey && !ended && Date.now() - t0 < RESCUE_END_GRACE_MS) { arm(); return; }
    finish();
    diag(`  ${label} fire (ended=${ended} hasFocus=${view.hasFocus})`);
    if (!view.hasFocus) return;
    flushMathAscii(view);
    fn();
  };
  view.contentDOM.addEventListener('compositionend', onEnd);
  arm();
  return finish;
}

function composingRescue(enter: (kind: MathKeyKind) => (view: EditorView) => boolean): Extension {
  return ViewPlugin.fromClass(class {
    cancel: (() => void) | null = null;
    readonly mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    constructor(readonly view: EditorView) {
      view.dom.addEventListener('keydown', this.onKeyDown, true);
    }
    onKeyDown = (e: KeyboardEvent) => {
      const composing = e.isComposing || this.view.composing;
      if (!composing && e.keyCode !== 229) return;   // 평소 키는 CM keymap 몫
      const kind = matchMathKey(e, this.mac);
      if (!kind) return;
      this.cancel?.();                               // 가장 최근 키만 산다
      diag(`  rescue armed ${kind} (composing=${composing})`);
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[68b] 조합 중 수식 단축키(${kind}) — keyCode ${e.keyCode} · isComposing ${e.isComposing} · 조합 확정 뒤 실행`);
      }
      /* defer — 즉시 갈래를 타면 CM keymap과 같은 키를 두 번 돈다(조합 밖 229도 "짧게 기다렸다 실행" — CM이 처리했으면 skipIf가 거른다).
         composingAtKey = 키 시점 조합 여부(68b 그대로 — 조합 밖 229는 grace 없이 첫 폴링에 실행) */
      this.cancel = runAfterComposition(this.view, () => { enter(kind)(this.view); }, {
        composingAtKey: composing,
        defer: true,
        skipIf: () => e.defaultPrevented,            // CM keymap이 이미 처리했다
        label: `rescue ${kind}`,
      });
    };
    destroy() {
      this.view.dom.removeEventListener('keydown', this.onKeyDown, true);
      this.cancel?.();
    }
  });
}

// ─────────────────────────────────────────────
// 3‴) 수식 영역 자동 영문 입력 (Phase 68a) — 편집창·댓글·agent 입력창 **한 벌** (2026-10-09 덕수 검수 후속)
// ─────────────────────────────────────────────
/* 원리: 한글 IME를 켠 채로 두고, 수식 영역 안에서 IME가 넣은 글자를 **물리 키(event.code)의 US 글자**로 사후 치환한다.
   판정·짝짓기·큐 관리는 lib/mathAscii(순수 · test:mathascii), 여기는 CM 배선뿐. 상태는 플러그인 인스턴스(= 편집기 하나)마다 따로 산다.
   절차(reconcile — 68a 계획서 D7, 순서가 불변식이다):
     ① 끊기: `view.compositionStarted`면 contentDOM.blur() → contentDOM.focus({preventScroll}) — 브라우저가 진짜 compositionend를
        낸다. 치환을 **먼저** 하면 Blink가 "끝낼 조합이 없다"고 보아 compositionend를 안 내고 `view.composing`이 영구 고착된다.
     ② 지우기: 보류 삽입 범위가 아직 같은 글자열이면 삭제(별도 트랜잭션).
     ③ 재생: 글자 단위로 inputHandler 체인을 태운다(typeText) — 그 편집기의 후위 변환·괄호 자동닫기가 영문 IME와 같게 발화한다.
     ⚠ ②와 ③을 한 트랜잭션으로 합치지 말 것 — 첫 글자를 "범위 대체"로 넣으면 inputHandler가 선택 있음으로 읽어 지우려던 한글을 감싼다(E16).
   끊기의 blur·focus는 **view.dom capture** 리스너가 `breaking` 동안 stopImmediatePropagation으로 삼킨다(D10′) — CM이 보면 자동완성이
     10ms 뒤 닫히고 `observers.focus`가 옛 scrollLeft를 복원한다. 브라우저의 compositionend는 별개 이벤트라 그대로 CM에 닿는다.
     (68a 때는 MarkdownEditor 래퍼 div에 걸었다 — view.dom도 contentDOM의 조상이라 capture 순서가 같다)
   keydown은 view.dom **네이티브 capture** — CM은 조합 중(composing>0) 키 이벤트를 handlers에 넘기지 않는다.
   ⚠ keydown의 영역 판정은 "삽입 뒤의 문서"(probeInsertionRegion — 68a K8). ⚠ 보류 삽입 좌표는 **안쪽 결합**(advanceQueue) —
     mathSlots의 바깥 결합과 반대이며 의도다. ⚠ 켜고 끄기는 `enabled()`를 **매번** 읽는다(Compartment가 없다 — 조합 가드 불필요). */
export const MATH_ASCII_PREF_KEY = 'mathory-editor-mathascii';
/** 편집창 Row 2 토글의 저장값. 댓글·agent 입력창도 이것을 그대로 따른다(툴바가 없다). 기본 켬 */
export function readMathAsciiPref(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(MATH_ASCII_PREF_KEY) !== 'off'; } catch { return true; }
}
export function writeMathAsciiPref(on: boolean): void {
  try { localStorage.setItem(MATH_ASCII_PREF_KEY, on ? 'on' : 'off'); } catch { /* 사파리 사생활 모드 등 — 세션 값만 산다 */ }
}


/** 재생 한 글자 — CM 기본 타자와 같은 체인(inputHandler facet 루프 → 기본 삽입).
 *  ⚠ `insert`는 **Transaction**을 돌려줘야 한다 — Phase 68 핸들러가 `view.dispatch(insert())`한다. 재생은 `input.type` +
 *  `scrollIntoView`(M7 D5 가로 중앙 추적이 그대로 발화) + 우리 annotation(update가 자기 삽입을 큐에 넣지 않게). */
function typeText(view: EditorView, ch: string) {
  const { from, to } = view.state.selection.main;
  let tr: Transaction | null = null;
  const insert = () => tr || (tr = view.state.update(view.state.replaceSelection(ch), {
    userEvent: 'input.type', scrollIntoView: true, annotations: mathAsciiTx.of(true),
  }));
  if (!view.state.facet(EditorView.inputHandler).some((h) => h(view, from, to, ch, insert))) view.dispatch(insert());
}

/* ⚠ 윈도우 검수(2026-10-09)에서 드러난 경합 — 한글 IME를 켠 채 수식 안에서 `lim`을 치고 곧바로 Tab을 누르면, 윈도우 IME는
   마지막 자모(`ㅡ`)를 확정하면서 Tab을 **같은 순간** 보낸다. reconcile은 setTimeout 뒤라 Tab 처리 때 문서가 아직 `liㅡ`이고,
   단축어가 확장되지 않은 채 Tab이 자리 이동으로 넘어갔다("됐다 안 됐다" — 손 속도에 따른 경합. 맥은 Tab이 한 박자 늦게 와서 안 보였다).
   → 수식 명령(Tab·행 Enter·Ctrl+M 계열)은 실행 **직전** `flushMathAscii(view)`로 대기 중인 치환을 끝낸 문서를 본다.
   레지스트리는 편집기(view)마다 플러그인 인스턴스 하나 — WeakMap이라 파기된 편집기를 붙잡지 않는다. */
const mathAsciiInstances = new WeakMap<EditorView, { flush(): void }>();
/** 대기 중인 68a 치환을 지금 끝낸다(없으면 아무 일 없음). 키맵 명령 안에서 불러도 된다 — 업데이트 사이클 밖이다 */
export function flushMathAscii(view: EditorView): void {
  mathAsciiInstances.get(view)?.flush();
}

/* ── Phase 68c D3 — 프로그램 호출 삽입(AI 완성·OCR·61c 삽입·툴바) 직전의 조합 **확정** ──
   조합 중이면 68a 끊기와 같은 경로(contentDOM.blur → focus{preventScroll})로 브라우저가 조합을 확정하게 하고, 이어서 flushMathAscii
   (확정 직후 삽입이 68a 치환 전 문서를 보지 않게 — 68b 윈도우 검수의 `liㅡ` 경합과 같은 자리).
   ⚠ 68a 억제(breaking) 밖이라 CM이 blur를 본다 → 자동완성이 닫히고 끔 모드에선 옛 scrollLeft가 복원될 수 있다 — 삽입 직전이라 무해(P3).
   ⚠ **키 경로(window 단축키)에는 쓰지 않는다** — 그쪽은 IME가 그 키로 확정 중인 순간이라 `runAfterComposition`(지연)이다(v2 E7).
   반환값 = 끊었는가(진단용). */
export function commitComposition(view: EditorView): boolean {
  let broke = false;
  if (view.compositionStarted && view.hasFocus) {
    view.contentDOM.blur();
    view.contentDOM.focus({ preventScroll: true });
    broke = true;
    diag('  68c commitComposition');
    // 안전망(68a와 같다) — 블러가 compositionend를 못 냈으면 CM이 '조합 중'에 고착되지 않게 합성한다
    if (view.compositionStarted) view.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { data: '', bubbles: true }));
  }
  flushMathAscii(view);
  return broke;
}

export function createMathAscii(enabled: () => boolean): Extension {
  return ViewPlugin.fromClass(class {
    keys: RecordedKey[] = [];                       // 기록 키 FIFO (record 경로)
    ins: PendingIns[] = [];                          // 보류 삽입(IME가 넣은 글자) — 좌표는 advanceQueue가 따라간다
    timer: ReturnType<typeof setTimeout> | null = null;
    lastReplaced: { text: string; t: number } | null = null;
    breaking = false;                                // 끊기(blur→focus) 동기 구간
    anomaly = 0;
    destroyed = false;

    constructor(readonly view: EditorView) {
      mathAsciiInstances.set(view, this);
      view.dom.addEventListener('keydown', this.onKeyDown, true);
      view.dom.addEventListener('blur', this.swallowOwnFocusEvents, true);
      view.dom.addEventListener('focus', this.swallowOwnFocusEvents, true);
    }

    onKeyDown = (e: KeyboardEvent) => {
      const view = this.view;
      if (!enabled() || !view.contentDOM.contains(e.target as Node)) return;
      const { cls, ch } = classifyKey({
        key: e.key, code: e.code, keyCode: e.keyCode, isComposing: e.isComposing,
        ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey,
        caps: e.getModifierState('CapsLock'),
      });
      if (cls === 'pass' || cls === 'latin' || ch === null) return;
      const head = view.state.selection.main.head;
      /* 영역은 **삽입 뒤의 문서**로 판정한다 — `$|$`가 행 끝이면 스캐너가 display 펜스로 읽어 "밖"이지만 글자가 들어가면 인라인이다
         (68a K8 실측: $ 버튼 뒤 첫 글자만 한글로 남았다). update가 삽입 시작 `fb`에서 판정하는 것과 같은 기준 */
      const { region, probe } = probeInsertionRegion(view.state.doc.toString(), head);
      if (!region || isInTextArg(probe, head, region)) return;
      const now = performance.now();
      // 직접 경로(Mac 390 종성·₩) — 단 Safari처럼 삽입이 먼저 와 큐에 있으면 기록 경로로(D8)
      if (cls === 'direct' && !this.ins.some((h) => now - h.t < INS_WAIT_MS)) {
        e.preventDefault();
        typeText(view, ch);
        return;
      }
      this.keys.push({ ch, t: now });
    };

    swallowOwnFocusEvents = (e: FocusEvent) => {
      if (this.breaking) e.stopImmediatePropagation();
    };

    /* 보류 삽입 큐. 변경을 모아 advanceQueue(순수)에 넘길 뿐이다 — 겹침·키 폐기·좌표 매핑은 거기서(I1~I4).
       자격(qualifies) = 우리 트랜잭션 아님 · paste 아님 · 켬 · needsReplay(한글 또는 compose) · 수식 안 · \text 밖.
       ⚠ 우리 삭제·재생(mathAsciiTx)·후위 변환 2차 dispatch·closeBrackets도 **좌표 매핑에는 참여**해야 한다 — 비자격으로 넘긴다. */
    update(u: ViewUpdate) {
      if (!u.docChanged) return;
      if (u.transactions.some((t) => t.isUserEvent('undo') || t.isUserEvent('redo'))) {
        this.ins = []; this.keys = [];
        return;
      }
      const own = u.transactions.some((t) => t.annotation(mathAsciiTx));
      const paste = u.transactions.some((t) => t.isUserEvent('input.paste'));
      const ue = u.transactions.map((t) => t.annotation(Transaction.userEvent)).find(Boolean);
      const docStr = u.state.doc.toString();
      const regions = own || paste || !enabled() ? null : scanMathRegions(docStr);
      /* 이 flush 때 조합이 살아 있었나 — 살아 있었으면 CM이 inputHandler 체인을 건너뛰었으므로 ASCII 조합도 재생한다.
         compositionend가 먼저 온 동기 조합(Windows식)은 체인이 이미 돌았다 → 재생하면 이중 적용(lib/mathAscii.needsReplay 주석) */
      const live = u.view.compositionStarted;
      const changes: ChangeDesc[] = [];
      u.changes.iterChanges((fa, ta, fb, tb, insText) => {
        const s = insText.toString();
        let qualifies = false;
        if (regions && s && needsReplay(s, ue, live)) {
          const r = mathRegionAt(regions, fb);
          qualifies = !!r && !isInTextArg(docStr, fb, r);
        }
        // 재생하지 않는 삽입이 큐 머리 키와 같은 글자로 시작하면 그 키는 이미 소비된 것(동기 조합의 `(`→`()` · 조합 중 `{`→`{}`)
        if (!own && !qualifies && s) this.keys = consumeTypedKeys(this.keys, s);
        changes.push({ fa, ta, fb, tb, ins: s, qualifies });
      });
      if (!changes.length) return;
      const res = advanceQueue(this.ins, changes, performance.now());
      this.ins = res.entries;
      if (res.dropKeysBeforeT !== null) this.keys = dropKeysBefore(this.keys, res.dropKeysBeforeT);
      if (res.added.length) this.scheduleReconcile(0);
    }

    /* reconcile(끊기 → 지우기 → 재생). setTimeout이다 — 트랜잭션 안에서 dispatch 금지 */
    scheduleReconcile(ms: number) {
      if (this.timer !== null) return;               // 이미 예약됨(가장 이른 것만 산다)
      this.timer = setTimeout(() => { this.timer = null; this.reconcile(); }, ms);
    }
    noteAnomaly() {
      this.anomaly++;
      if (this.anomaly === ANOMALY_WARN_AT && process.env.NODE_ENV !== 'production') {
        console.warn('[Phase68a] 수식 자동 영문 입력 이상 상태 10건 — 짝 없는 키·메아리·범위 소실·합성 compositionend');
      }
    }
    reconcile() {
      if (this.destroyed) return;                    // 편집기 파기 뒤 타이머(H4)
      const view = this.view;
      const now = performance.now();
      this.keys = expireKeys(this.keys, now);
      while (this.ins.length) {
        const h = this.ins[0];
        const r = pairInsertion({ text: h.text, t: h.t, keys: this.keys, now, lastReplaced: this.lastReplaced });
        if (r.wait) { this.scheduleReconcile(20); return; }     // Safari — keydown이 뒤에 온다
        this.keys = this.keys.slice(r.consumed);
        this.ins.shift();
        if (r.kept) { this.anomaly += r.kept - 1; this.noteAnomaly(); }
        if (!r.replay) continue;                     // 글자도 같고 체인을 태울 ASCII 조합도 아니다
        // ① 끊기 — 포커스가 있을 때만(없으면 되빼앗는다, F2). breaking은 try 안에서만 참(I5 — 누수가 다음 진짜 blur를 삼킨다)
        if (view.compositionStarted && view.hasFocus) {
          try {
            this.breaking = true;
            view.contentDOM.blur();
            view.contentDOM.focus({ preventScroll: true });
          } finally {
            this.breaking = false;
          }
        }
        if (view.compositionStarted) {               // 안전망(실험 3에서 0회) — 데스크톱은 비-EditContext라 관찰자가 받는다
          view.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { data: '', bubbles: true }));
          this.noteAnomaly();
        }
        // ② 지우기 — 범위가 아직 그 글자열일 때만. 아니면(블러가 조합 글자를 지운 경우) 선택만 두고 재생
        const still = h.to <= view.state.doc.length && view.state.doc.sliceString(h.from, h.to) === h.text;
        if (still) {
          view.dispatch({
            changes: { from: h.from, to: h.to, insert: '' }, selection: { anchor: h.from },
            userEvent: 'input.type', annotations: mathAsciiTx.of(true),
          });
        } else {
          view.dispatch({ selection: { anchor: Math.min(h.from, view.state.doc.length) }, annotations: mathAsciiTx.of(true) });
          this.noteAnomaly();
        }
        // ③ 재생 — 글자 단위로 inputHandler 체인
        for (const c of r.rep) typeText(view, c);
        this.lastReplaced = { text: h.text, t: performance.now() };
        if (r.echo) this.noteAnomaly();
      }
      if (this.keys.length) this.scheduleReconcile(40);        // 고아 키 TTL 정리
    }

    /** flushMathAscii — 예약된 reconcile을 취소하고 지금 돌린다. 보류 삽입이 없으면 아무 일 없음 */
    flush() {
      if (this.destroyed || !this.ins.length) return;
      if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
      diag(`  68a flush (pending ${this.ins.length})`);
      this.reconcile();
    }

    destroy() {
      this.destroyed = true;
      mathAsciiInstances.delete(this.view);
      this.view.dom.removeEventListener('keydown', this.onKeyDown, true);
      this.view.dom.removeEventListener('blur', this.swallowOwnFocusEvents, true);
      this.view.dom.removeEventListener('focus', this.swallowOwnFocusEvents, true);
      if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    }
  });
}

// ─────────────────────────────────────────────
// 3⁗) 입력 처리기 · 행 환경 Enter · 괄호 자동닫기 (Phase 68 D16·D19~D22 + 괄호 규칙) — 두 편집기 **한 벌** (2026-10-09 작업 규칙 9)
// ─────────────────────────────────────────────
/* 편집창(MarkdownEditor)에서 옮겼다. 댓글 입력창은 그때까지 "수식 안 ( [ { 무조건 짝"만 있어 건너뛰기·짝 지우기·\left 쌍·후위 변환이
   없었다. 기준은 검수를 거친 편집창 규칙이다:
   - 선택 + `(`·`[`·`{` → `\left…\right` 감싸기(양끝이 **같은** 수식 영역일 때만 — 밖은 선택 대체) (D22)
   - 수식 안 `^`·`_` → `^{}`·`_{}`(다음 `{`·앞 `\`면 그냥) (D20) · `(A)/` → `\frac{A}{}`(`autoFracAt`) (D19)
     → "친 글자 그대로"(`insert()`) 다음 **별도 트랜잭션**(isolateHistory 'before') — ⌘Z 1회면 변환만 풀린다
   - `\left`·`\bigl`… 뒤 `(`·`[`·`{`·`|` → 짝 `\right…` 자동
   - 수식 밖 `(`·`[` → 짝을 넣지 않는다 · 수식 안 `(`·`[` → CM closeBrackets(뒤가 비었을 때만 짝 · 닫는 괄호 건너뛰기 · Backspace 짝 지우기)
   - 수식 안 `{` → 항상 `{}` · 수식 밖 `{`·따옴표 → closeBrackets 기본
   ⚠ inputHandler는 **IME 조합 중에도 불린다**(view dist 4257) — 변환은 `view.composing` 가드 안에서만.
   ⚠ closeBrackets는 편집창에선 basicSetup에도 있다 — `closeBrackets()`는 모듈 상수라 중복 등록이 하나로 합쳐진다.
   ⚠ 댓글 입력창의 `markdown()` 언어는 closeBrackets 설정을 바꾸지 않는다(languageData는 commentTokens뿐 — 확인함). */
const mathInputHandler = Prec.highest(EditorView.inputHandler.of((view, from, to, text, insert) => {
    const doc = view.state.doc.toString();
    const inMath = isInsideMath(doc, from);

    /* ═══ Phase 68 — 선택 감싸기·후위 변환 (D19~D22) ═══════════════════════════════
       IME 조합 중에는 관여하지 않는다(inputHandler는 조합 중에도 불린다 — view dist 4257-4260).
       변환은 "친 글자 그대로"(`insert()` — CM 기본 타자와 같은 userEvent·scrollIntoView라 M7 D5 가로 중앙 추적이 그대로
       발화) 다음 **별도 트랜잭션**(isolateHistory 'before') → ⌘Z 1회면 변환만 풀리고 친 글자는 남는다. */
    if (!view.composing) {
      // D22 선택 감싸기 — 양끝이 **같은** 수식 영역 안일 때만. 밖은 현행(선택 대체)
      if (from !== to && (text === '(' || text === '[' || text === '{')) {
        const regions = scanMathRegions(doc);
        const a = mathRegionAt(regions, from);
        if (a && a === mathRegionAt(regions, to)) {
          const [open, close] = text === '(' ? ['\\left(', '\\right)']
            : text === '[' ? ['\\left[', '\\right]'] : ['\\left\\{', '\\right\\}'];
          const wrapped = open + doc.slice(from, to) + close;
          view.dispatch({
            changes: { from, to, insert: wrapped },
            selection: { anchor: from, head: from + wrapped.length }, userEvent: 'input.type',
          });
          return true;
        }
      }
      if (inMath && from === to) {
        // D20 `^`·`_` → `^{}`·`_{}` — 다음 글자가 `{`이거나 앞 글자가 `\`(`\^`)면 그냥 입력
        if ((text === '^' || text === '_') && doc[from] !== '{' && doc[from - 1] !== '\\') {
          view.dispatch(insert());
          view.dispatch({
            changes: { from: from + 1, insert: '{}' }, selection: { anchor: from + 2 },
            annotations: isolateHistory.of('before'),
          });
          return true;
        }
        // D19 자동 분수 `(A)/` → `\frac{A}{}` — `(`가 항의 시작일 때만(f(x)/ · \left(x\right)/ 제외)
        if (text === '/') {
          const region = mathRegionAt(scanMathRegions(doc), from);
          const f = region ? autoFracAt(doc, from, region) : null;
          if (f) {
            view.dispatch(insert());
            const repl = `\\frac{${f.numerator}}{}`;
            view.dispatch({
              changes: { from: f.from, to: from + 1, insert: repl }, selection: { anchor: f.from + repl.length - 1 },
              annotations: isolateHistory.of('before'),
            });
            return true;
          }
        }
      }
    }

    // ── \left( / \bigl[ / \Bigl| 등: 좌측 구분자 입력 시 \right 쌍 자동 완성 ──
    const PAIR: Record<string, [string, string]> = {
      '(': ['(', ')'], '[': ['[', ']'], '{': ['\\{', '\\}'], '|': ['|', '|'],
    };
    if (inMath && PAIR[text]) {
      const before = doc.slice(Math.max(0, from - 6), from);
      const lm = before.match(/\\(left|bigl|Bigl|biggl|Biggl)$/);
      if (lm) {
        const RIGHT: Record<string, string> = {
          left: 'right', bigl: 'bigr', Bigl: 'Bigr', biggl: 'biggr', Biggl: 'Biggr',
        };
        const [open, close] = PAIR[text];
        const insert = `${open}\\${RIGHT[lm[1]]}${close}`;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + open.length }, // 여는 구분자 바로 뒤
        });
        return true;
      }
    }

    // 소괄호·대괄호: 수식 밖에서 자동닫기 차단
    if (text === '(' || text === '[') {
      if (inMath) return false; // 수식 안 → closeBrackets가 처리
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + 1 },
      });
      return true;
    }

    // 중괄호: 수식 안에서 항상 자동닫기 (뒤 문자 무관)
    if (text === '{') {
      if (!inMath) return false; // 수식 밖 → 기본 동작
      view.dispatch({
        changes: { from, to, insert: '{}' },
        selection: { anchor: from + 1 },
      });
      return true;
    }

    return false;
}));
const bracketKeys = keymap.of(closeBracketsKeymap);

/** 두 편집기 공용: 입력 처리기 + closeBrackets + 짝 지우기 Backspace */
export function createMathInput(): Extension {
  return [mathInputHandler, closeBrackets(), bracketKeys];
}

/** D16 — 행 환경 본문 안 Enter: ` \\`+줄바꿈+들여쓰기(lib/mathInput.rowEnterPlan ⓐ~ⓔ). `shift`를 묶지 않는다 —
 *  Shift+Enter는 standardKeymap의 insertNewlineAndIndent(들여쓰기 유지 줄바꿈, `\\` 없음)가 탈출구다(편집창 basicSetup ·
 *  댓글 입력창 defaultKeymap 둘 다 같은 바인딩을 갖고 있다). */
export function rowEnterCommand(view: EditorView): boolean {
  if (view.composing || completionStatus(view.state) === 'active') return false;
  flushMathAscii(view);
  const sel = view.state.selection.main;
  if (!sel.empty) return false;
  const doc = view.state.doc.toString();
  const region = mathRegionAt(scanMathRegions(doc), sel.head);
  if (!region) return false;
  const plan = rowEnterPlan(doc, sel.head, region);
  if (!plan) return false;
  view.dispatch({
    changes: { from: plan.from, to: plan.to, insert: plan.insert },
    selection: { anchor: plan.cursor }, scrollIntoView: true, userEvent: 'input.type',
  });
  return true;
}

// ─────────────────────────────────────────────
// 4) LaTeX 자동완성 소스 (`\` 트리거)
// ─────────────────────────────────────────────
export function latexCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/\\[a-zA-Z{]*/);
  if (!word || word.from === word.to) return null;
  if (word.text.length < 2) return null;

  const doc = context.state.doc.toString();
  if (!isInsideMath(doc, context.pos)) return null;

  const options: Completion[] = LATEX_COMPLETIONS
    .filter((item) => item.label.startsWith(word.text))
    .map((item) => ({
      label: item.label,
      detail: item.detail,
      type: 'keyword',
      boost: item.boost,
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        const template = item.template;
        view.dispatch({ changes: { from, to, insert: template } });
        const firstBrace = template.indexOf('{}');
        const offset = item.cursorOffset ?? (firstBrace !== -1 ? firstBrace + 1 : template.length);
        view.dispatch({ selection: { anchor: from + offset } });
      },
    }));

  if (options.length === 0) return null;
  return { from: word.from, options, validFor: /^\\[a-zA-Z{]*$/ };
}

export function createLatexAutocompletion(): Extension {
  return autocompletion({
    override: [latexCompletionSource],
    activateOnTyping: true,
    maxRenderedOptions: 12,
    defaultKeymap: true,
    icons: false,
  });
}

// ─────────────────────────────────────────────
// 5) 수식 단축키 (Phase 68b — Ctrl+M · Ctrl+Shift+M · Alt+= · Shift+Esc · Alt+Tab)
// ─────────────────────────────────────────────
export interface MathShortcutsResult {
  shortcuts: Extension;
}

export function createMathShortcuts(): MathShortcutsResult {
  diagEnabled();   // 진단 기록이 켜져 있으면 편집기를 만들 때 바로 리스너를 단다(첫 키부터 남도록)
  const enter = (kind: 'inline' | 'display') => (view: EditorView): boolean => {
    flushMathAscii(view);
    const r = exitRegionOfSelection(view);
    if (r) return exitMath(view, r);                                          // 수식 안 → 한 번에 나오기(D5)
    if (kind === 'inline') insertInlineMathIn(view); else insertDisplayMathBlock(view);
    return true;
  };

  /* `Prec.highest` — basicSetup/defaultKeymap의 Windows `Ctrl-m`(toggleTabFocusMode)을 덮는다. 편집창 밖으로 나가는 길은
     Escape → Tab(Mac은 Shift-Alt-m도). Word 별칭은 Mac에서 `Alt+=`가 `≠`를 넣고 CM base 폴백도 꺼져 `Ctrl+=`로. */
  const shortcuts = Prec.highest(keymap.of([
    { key: 'Ctrl-m', run: enter('inline') },
    { key: 'Ctrl-Shift-m', run: enter('display') },
    { key: 'Alt-=', mac: 'Ctrl-=', run: enter('inline') },
    {
      // HWP 호환 별칭 — 수식 밖이면 아무것도 안 하고 소비(Windows Shift+Esc = 브라우저 작업 관리자)
      key: 'Shift-Escape',
      run: (view) => {
        flushMathAscii(view);
        const r = exitRegionOfSelection(view);
        return r ? exitMath(view, r) : true;
      },
    },
    { key: 'Alt-Tab', run: jumpToNextBrace },
  ]));

  return { shortcuts: [shortcuts, composingRescue(enter), diagUpdates] };
}


// ─────────────────────────────────────────────
// 6) 스마트 붙여넣기 (Phase 68c D5~D11) — 블록·댓글 편집기 **한 벌**(작업 규칙 9 · 미통일 ① 해소)
// ─────────────────────────────────────────────
/* 경로 둘:
   ① 평문 — CM 내장 paste(text/plain)·drop이 `clipboardInputFilter`를 탄다 → `smartPasteText`(stripInvisibles → 구분자 정규화 → 수식 안 유니코드)
   ② HTML — `text/html`에 `<math`가 **있을 때만** 여기 paste 핸들러가 가로챈다(플러그인 핸들러가 내장보다 먼저 — view dist computeHandlers).
      DOMParser → `htmlToSNodes`(수식 호스트 정규화) → 61c `serializeNodes`(굵게·목록·표·링크까지 Mathory 마크다운) → `smartPasteText`.
      annotation 없는 `<math>`가 있으면 `mathml-to-latex`를 **동적 import**(P9(b) — 첫 사용 1회 로드). 그 사이 문서가 바뀌었으면 현재 주 선택에(Q14).
   ⚠ dispatch는 반드시 `userEvent: 'input.paste'` — 68a 리스너는 한글이 들면 userEvent 무관하게 큐에 올리고 `input.paste`만 뺀다(v2 B7).
   ⚠ `<math` 없는 HTML은 보지 않는다(P10) — 일반 웹 페이지 복사가 마크다운으로 바뀌지 않는다. drop엔 HTML 경로가 없다(D10).
   ⚠ `⌘⇧V`(서식 없이)는 평문 경로 — Mathory 미리보기 복사의 text/plain은 KaTeX 글자 나열이라 두 벌로 들어간다(알고 두는 손실, D11). */
let mathmlConverter: Promise<BareConverter | null> | null = null;
function loadMathmlConverter(): Promise<BareConverter | null> {
  if (!mathmlConverter) {
    mathmlConverter = import('mathml-to-latex')
      .then((mod) => ((el: Element) => {
        try { return mod.MathMLToLaTeX.convert(el.outerHTML) || null; } catch { return null; }
      }) as BareConverter)
      .catch(() => { mathmlConverter = null; return null; });   // 실패면 다음 붙여넣기에 다시 시도
  }
  return mathmlConverter;
}

export function createMathPaste(): Extension {
  return [
    EditorView.domEventHandlers({
      paste(event, view) {
        const html = event.clipboardData?.getData('text/html');
        if (!html || !/<math[\s>]/i.test(html) || typeof DOMParser === 'undefined') return false;   // 평문 경로
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const { from, to } = view.state.selection.main;
        const docAtPaste = view.state.doc;
        const finish = (nodes: SNode[]) => {
          const text = serializeNodes(nodes);
          if (!text) return;
          const at = view.state.doc === docAtPaste ? { from, to } : view.state.selection.main;   // Q14
          const out = smartPasteText(text, view.state.doc.toString(), at.from, at.to);
          diag(`  68c paste html → ${out.length}자`);
          view.dispatch({
            changes: { from: at.from, to: at.to, insert: out },
            selection: { anchor: at.from + out.length }, userEvent: 'input.paste', scrollIntoView: true,
          });
        };
        const first = htmlToSNodes(doc);
        if (!first.bare.length) { finish(first.nodes); return true; }
        loadMathmlConverter().then((conv) => {
          if (view.dom.isConnected) finish(conv ? htmlToSNodes(doc, conv).nodes : first.nodes);   // 실패 = textContent 폴백
        });
        return true;
      },
    }),
    EditorView.clipboardInputFilter.of((text, state) => {
      const { from, to } = state.selection.main;
      return smartPasteText(text, state.doc.toString(), from, to);
    }),
  ];
}
