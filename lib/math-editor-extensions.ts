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
 *  - mathTabCommand / createMathTab  편집창 Tab 엔진 ⓪~⑦(Phase 68 · 68b ⑥′) — 댓글·agent 입력창과 공용(검수 21)
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

import { keymap, EditorView, ViewPlugin } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';
import {
  autocompletion,
  completionStatus,
  acceptCompletion,
  CompletionContext,
  Completion,
} from '@codemirror/autocomplete';
import { LATEX_COMPLETIONS, isInsideMath } from './latex-completions';
import { scanMathRegions, mathRegionAt, exitRegionAt, type ExitRegion } from './mathRegions';
import {
  mathExitPos, isEmptyDisplay, emptyDisplayDeleteRange, type ExitPlan,
  matchAbbrev, findEnclosingEnv, groupDepth, nextSlot, displayTabExit, AMP_ENVS,
} from './mathInput';
import { slotsField, insertWithSlots, nextSlotCmd, prevSlotCmd, hasActiveSlots } from './mathSlots';

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

/** 댓글·agent 입력창용 묶음: 자리 StateField + Tab/Shift+Tab(`Prec.high` — 편집창 mathKeys와 같은 우선순위) */
export function createMathTab(getAbbrevs: () => Record<string, string>): Extension {
  return [
    slotsField,
    Prec.high(keymap.of([{ key: 'Tab', run: mathTabCommand(getAbbrevs), shift: mathShiftTabCommand }])),
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

type MathKeyKind = 'inline' | 'display';
function matchMathKey(e: KeyboardEvent, mac: boolean): MathKeyKind | null {
  if (e.metaKey) return null;
  if (e.code === 'KeyM' && e.ctrlKey && !e.altKey) return e.shiftKey ? 'display' : 'inline';
  if (e.code === 'Equal' && !e.shiftKey && (mac ? e.ctrlKey && !e.altKey : e.altKey && !e.ctrlKey)) return 'inline';
  return null;
}

function composingRescue(enter: (kind: MathKeyKind) => (view: EditorView) => boolean): Extension {
  return ViewPlugin.fromClass(class {
    pending: { kind: MathKeyKind; ev: KeyboardEvent; composing: boolean; ended: boolean; t: number } | null = null;
    timer: ReturnType<typeof setTimeout> | null = null;
    readonly mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    constructor(readonly view: EditorView) {
      view.dom.addEventListener('keydown', this.onKeyDown, true);
      view.contentDOM.addEventListener('compositionend', this.onCompositionEnd);
    }
    onKeyDown = (e: KeyboardEvent) => {
      const composing = e.isComposing || this.view.composing;
      if (!composing && e.keyCode !== 229) return;   // 평소 키는 CM keymap 몫
      const kind = matchMathKey(e, this.mac);
      if (!kind) return;
      this.pending = { kind, ev: e, composing, ended: false, t: Date.now() };
      this.arm();
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[68b] 조합 중 수식 단축키(${kind}) — keyCode ${e.keyCode} · isComposing ${e.isComposing} · 조합 확정 뒤 실행`);
      }
    };
    onCompositionEnd = () => {
      if (this.pending) { this.pending.ended = true; this.arm(); }
    };
    arm() {
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = setTimeout(this.tick, RESCUE_POLL_MS);
    }
    tick = () => {
      this.timer = null;
      const p = this.pending;
      if (!p) return;
      if (Date.now() - p.t > RESCUE_GIVE_UP_MS) { this.pending = null; return; }
      if (p.ev.defaultPrevented) { this.pending = null; return; }        // CM keymap이 이미 처리했다
      if ((p.composing && !p.ended) || this.view.composing) { this.arm(); return; }
      this.pending = null;
      if (this.view.hasFocus) enter(p.kind)(this.view);
    };
    destroy() {
      this.view.dom.removeEventListener('keydown', this.onKeyDown, true);
      this.view.contentDOM.removeEventListener('compositionend', this.onCompositionEnd);
      if (this.timer !== null) clearTimeout(this.timer);
    }
  });
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
  const enter = (kind: 'inline' | 'display') => (view: EditorView): boolean => {
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
        const r = exitRegionOfSelection(view);
        return r ? exitMath(view, r) : true;
      },
    },
    { key: 'Alt-Tab', run: jumpToNextBrace },
  ]));

  return { shortcuts: [shortcuts, composingRescue(enter)] };
}
