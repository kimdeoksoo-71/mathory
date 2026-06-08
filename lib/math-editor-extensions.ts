/**
 * 수식 편집창에서 공통으로 쓰는 CodeMirror 확장.
 * MarkdownEditor와 LatexInputEditor에서 동일하게 활용.
 *
 * 제공:
 *  - findInnermostExit       — Shift+Esc(가장 안쪽 괄호·수식 탈출) 헬퍼
 *  - findMathRegion          — Opt+Tab(수식 내 중괄호 순회) 헬퍼
 *  - latexCompletionSource   — `\`로 시작하는 LaTeX 명령 자동완성 소스
 *  - createMathShortcuts()   — Ctrl+N (chord N/M) / Shift+Esc / Opt+Tab 확장 묶음
 *  - createLatexAutocompletion() — autocompletion 확장 (`\` 트리거)
 */

import { keymap, EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import {
  autocompletion,
  CompletionContext,
  Completion,
} from '@codemirror/autocomplete';
import { LATEX_COMPLETIONS, isInsideMath } from './latex-completions';

// ─────────────────────────────────────────────
// 1) 가장 안쪽 괄호·수식 탈출 위치 (Shift+Esc)
// ─────────────────────────────────────────────
export function findInnermostExit(doc: string, cursor: number): number {
  const candidates: number[] = [];

  // 괄호 쌍 검사: (), {}, []
  const pairs: [string, string][] = [['(', ')'], ['{', '}'], ['[', ']']];
  for (const [open, close] of pairs) {
    let depth = 0;
    let foundOpen = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (doc[i] === close) depth++;
      else if (doc[i] === open) {
        if (depth === 0) { foundOpen = i; break; }
        depth--;
      }
    }
    if (foundOpen === -1) continue;
    depth = 0;
    for (let i = cursor; i < doc.length; i++) {
      if (doc[i] === open) depth++;
      else if (doc[i] === close) {
        if (depth === 0) { candidates.push(i + 1); break; }
        depth--;
      }
    }
  }

  // $$ 블록 수식
  let searchStart = 0;
  while (searchStart < doc.length) {
    const openIdx = doc.indexOf('$$', searchStart);
    if (openIdx === -1) break;
    const innerStart = openIdx + 2;
    const closeIdx = doc.indexOf('$$', innerStart);
    if (closeIdx === -1) break;
    if (cursor >= innerStart && cursor <= closeIdx) {
      candidates.push(closeIdx + 2);
    }
    searchStart = closeIdx + 2;
  }

  // $ 인라인 수식
  let i = 0;
  while (i < doc.length) {
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 2;
      continue;
    }
    if (doc[i] === '$') {
      const innerStart = i + 1;
      let closeIdx = -1;
      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }
      if (closeIdx !== -1 && cursor >= innerStart && cursor <= closeIdx) {
        candidates.push(closeIdx + 1);
      }
      if (closeIdx !== -1) i = closeIdx + 1;
      else i++;
      continue;
    }
    i++;
  }

  if (candidates.length === 0) return -1;
  return Math.min(...candidates);
}

// ─────────────────────────────────────────────
// 2) 커서가 속한 수식 영역의 [start, end] (Opt+Tab)
// ─────────────────────────────────────────────
export function findMathRegion(doc: string, cursor: number): { start: number; end: number } | null {
  // $$ 블록
  let searchStart = 0;
  while (searchStart < doc.length) {
    const openIdx = doc.indexOf('$$', searchStart);
    if (openIdx === -1) break;
    const innerStart = openIdx + 2;
    const closeIdx = doc.indexOf('$$', innerStart);
    if (closeIdx === -1) break;
    if (cursor >= innerStart && cursor <= closeIdx) {
      return { start: innerStart, end: closeIdx };
    }
    searchStart = closeIdx + 2;
  }

  // $ 인라인
  let i = 0;
  while (i < doc.length) {
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 2;
      continue;
    }
    if (doc[i] === '$') {
      const innerStart = i + 1;
      let closeIdx = -1;
      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }
      if (closeIdx !== -1 && cursor >= innerStart && cursor <= closeIdx) {
        return { start: innerStart, end: closeIdx };
      }
      if (closeIdx !== -1) i = closeIdx + 1;
      else i++;
      continue;
    }
    i++;
  }
  return null;
}

// ─────────────────────────────────────────────
// 3) LaTeX 자동완성 소스 (`\` 트리거)
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
// 4) 수식 단축키 (Ctrl+N→N/M chord, Shift+Esc, Opt+Tab)
// ─────────────────────────────────────────────
export interface MathShortcutsResult {
  shortcuts: Extension;
  chordListener: Extension;
}

export function createMathShortcuts(): MathShortcutsResult {
  // 각 에디터 인스턴스마다 독립적인 chord 상태
  const chordState = {
    pending: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  };

  const shortcuts = Prec.highest(keymap.of([
    {
      // Ctrl+N → 1차: chord 대기 시작, 2차(연속): 블록 수식 즉시 삽입
      key: 'Ctrl-n',
      run: (view) => {
        if (chordState.pending) {
          chordState.pending = false;
          if (chordState.timer) clearTimeout(chordState.timer);
          const { from, to } = view.state.selection.main;
          const insertText = '\n$$\n\n$$\n';
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + 4 },
          });
          return true;
        }
        chordState.pending = true;
        if (chordState.timer) clearTimeout(chordState.timer);
        chordState.timer = setTimeout(() => { chordState.pending = false; }, 1000);
        return true;
      },
    },
    {
      // Shift+Esc: 가장 안쪽 괄호·수식 탈출
      key: 'Shift-Escape',
      run: (view) => {
        const doc = view.state.doc.toString();
        const cursor = view.state.selection.main.head;
        const exitPos = findInnermostExit(doc, cursor);
        if (exitPos !== -1) {
          view.dispatch({ selection: { anchor: exitPos } });
          return true;
        }
        return false;
      },
    },
    {
      // Opt(Alt)+Tab: 수식 내 다음 중괄호 안쪽으로 커서 이동
      key: 'Alt-Tab',
      run: (view) => {
        const doc = view.state.doc.toString();
        const cursor = view.state.selection.main.head;
        const region = findMathRegion(doc, cursor);
        if (!region) return false;
        const bracePositions: number[] = [];
        for (let k = region.start; k < region.end; k++) {
          if (doc[k] === '{') bracePositions.push(k + 1);
        }
        if (bracePositions.length === 0) return false;
        let nextPos = bracePositions.find((p) => p > cursor);
        if (nextPos === undefined) nextPos = bracePositions[0];
        view.dispatch({ selection: { anchor: nextPos } });
        return true;
      },
    },
  ]));

  const chordListener = EditorView.domEventHandlers({
    keydown(event, view) {
      if (!chordState.pending) return false;

      // Ctrl+N → M: 인라인 수식 $$ 삽입, 커서 중앙
      if (event.code === 'KeyM') {
        event.preventDefault();
        chordState.pending = false;
        if (chordState.timer) clearTimeout(chordState.timer);
        const { from, to } = view.state.selection.main;
        view.dispatch({ changes: { from, to, insert: '$$' } });
        view.dispatch({ selection: { anchor: from + 1 } });
        return true;
      }

      // Ctrl+N → N: 블록 수식 삽입
      if (event.code === 'KeyN') {
        event.preventDefault();
        chordState.pending = false;
        if (chordState.timer) clearTimeout(chordState.timer);
        const { from, to } = view.state.selection.main;
        const insertText = '\n$$\n\n$$\n';
        view.dispatch({
          changes: { from, to, insert: insertText },
          selection: { anchor: from + 4 },
        });
        return true;
      }

      // 다른 키: chord 해제
      chordState.pending = false;
      if (chordState.timer) clearTimeout(chordState.timer);
      return false;
    },
  });

  return { shortcuts, chordListener };
}
