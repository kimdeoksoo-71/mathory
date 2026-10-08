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

import { keymap, EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import {
  autocompletion,
  CompletionContext,
  Completion,
} from '@codemirror/autocomplete';
import { LATEX_COMPLETIONS, isInsideMath } from './latex-completions';
import { scanMathRegions, mathRegionAt, exitRegionAt, type ExitRegion } from './mathRegions';
import { mathExitPos, isEmptyDisplay, emptyDisplayDeleteRange, type ExitPlan } from './mathInput';

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

/** `mathExitPos`·`displayTabExit` 결과를 한 dispatch로(insert가 있으면 변경 + 선택 — undo 1스텝). 68 자리 StateField는 변경을 매핑하고 선택이 자리 밖이면 해제한다 */
export function dispatchExit(view: EditorView, plan: ExitPlan): true {
  view.dispatch({
    ...(plan.insert !== undefined ? { changes: { from: plan.at as number, insert: plan.insert } } : {}),
    selection: { anchor: plan.pos },
    scrollIntoView: true,
  });
  return true;
}

/** D5 — ① 빈 쌍 → 삭제 ①′ 빈 블록 → 블록 삭제(`emptyDisplayDeleteRange`) ②③ 그 밖 → `mathExitPos`로 이동 */
export function exitMath(view: EditorView, r: ExitRegion): true {
  if (r.kind === 'empty') {
    view.dispatch({ changes: { from: r.from, to: r.to, insert: '' }, selection: { anchor: r.from }, scrollIntoView: true });
    return true;
  }
  const doc = view.state.doc.toString();
  if (isEmptyDisplay(doc, r.region)) {
    const d = emptyDisplayDeleteRange(doc, r.region);
    view.dispatch({ changes: { from: d.from, to: d.to, insert: d.insert }, selection: { anchor: d.cursor }, scrollIntoView: true });
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

  return { shortcuts };
}
