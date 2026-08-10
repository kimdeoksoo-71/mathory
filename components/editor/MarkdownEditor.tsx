'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
// search 하이라이트는 커스텀 FindReplacePanel + StateField로 처리
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';
import {
  SearchMatch,
  searchHighlightField,
  searchHighlightTheme,
  setSearchHighlightsEffect,
  clearSearchHighlightsEffect,
} from '../../lib/search-highlight';
import {
  mathHighlightField,
  mathHighlightTheme,
  setMathHighlightEffect,
} from '../../lib/math-highlight';
import { LATEX_COMPLETIONS, isInsideMath } from '../../lib/latex-completions';
import { lintLaTeX } from '../../lib/latex-linter';

/** 커서 활동 정보 (Phase 56 D12 — MarkdownEditor / SortableEditorBlock / EditorView 3곳 공유).
 *  blockId 는 MarkdownEditor 자신은 모르므로 상위 래퍼가 주입한다. */
export interface CursorActivityInfo {
  line: number;
  offset: number;
  /** 이 트랜잭션이 문서를 바꿨는가 (선택만 바뀐 경우와 구분) */
  docChanged: boolean;
  /** 마우스 클릭으로 인한 선택인가 (화살표 키 이동과 구분) */
  pointerSelect: boolean;
  blockId: string;
}

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  autoHeight?: boolean;
  onSnippetShortcut?: (index: number) => void;
  onCursorActivity?: (info: Omit<CursorActivityInfo, 'blockId'>) => void;
}

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset: number) => void;
  getCursorPosition: () => number;
  getContent: () => string;
  setContent: (text: string) => void;
  setSelection: (from: number, to: number) => void;
  clearSelection: () => void;
  replaceRange: (from: number, to: number, text: string) => void;
  focus: () => void;
  /** 커서 위치의 화면 좌표 반환 */
  getCursorCoords: () => { top: number; left: number } | null;
  /** 검색 매치 하이라이트 (Decoration) 설정 */
  setSearchHighlights: (matches: SearchMatch[], activeIndex: number) => void;
  /** 검색 매치 하이라이트 해제 */
  clearSearchHighlights: () => void;
  /** 수식 클릭 하이라이트 (행 회색 + 수식 노랑) */
  highlightMath: (from: number, to: number) => void;
  /** 수식 클릭 하이라이트 해제 */
  clearMathHighlight: () => void;
  /** 이 에디터가 실제로 포커스를 갖고 있는가.
   *  프로그램적 dispatch(clearSelection 등)가 유발한 cursorActivity를 걸러내는 데 쓴다. */
  hasFocus: () => boolean;
  /** 한글 IME 조합 중인가. 조합 중 스크롤/데코레이션 변동은 조합을 깨뜨린다. */
  isComposing: () => boolean;
}

// ── 보편적 괄호/수식 탈출 헬퍼 (Shift+Esc용) ──────────────
// 커서를 감싸는 가장 안쪽 괄호 또는 수식 기호의 닫는 위치+1 반환
function findInnermostExit(doc: string, cursor: number): number {
  const candidates: number[] = [];

  // 1) 괄호 쌍 검사: (), {}, []
  const pairs: [string, string][] = [['(', ')'], ['{', '}'], ['[', ']']];
  for (const [open, close] of pairs) {
    // 커서 왼쪽으로 스캔하며 매칭 안 된 여는 괄호 찾기
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

    // 커서 오른쪽으로 매칭되는 닫는 괄호 찾기
    depth = 0;
    for (let i = cursor; i < doc.length; i++) {
      if (doc[i] === open) depth++;
      else if (doc[i] === close) {
        if (depth === 0) { candidates.push(i + 1); break; }
        depth--;
      }
    }
  }

  // 2) $$ 블록 수식 검사
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

  // 3) $ 인라인 수식 검사
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
      if (closeIdx !== -1) {
        i = closeIdx + 1;
      } else {
        i++;
      }
      continue;
    }
    i++;
  }

  if (candidates.length === 0) return -1;
  // 가장 안쪽(닫는 위치가 가장 가까운) 후보 반환
  return Math.min(...candidates);
}

// ── 수식 영역 범위 반환 (Alt+Tab 중괄호 순회용) ──────────────
function findMathRegion(doc: string, cursor: number): { start: number; end: number } | null {
  // 1) $$ 블록 수식
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

  // 2) $ 인라인 수식
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
      if (closeIdx !== -1) {
        i = closeIdx + 1;
      } else {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

// 수식 영역 내 다음 { 안으로 커서 이동 (끝이면 처음으로 순회). Alt-Tab / Command 더블탭 공용.
function jumpToNextBrace(view: EditorView): boolean {
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
}

// ── LaTeX 자동완성 소스 ──────────────────────────────────
function latexCompletionSource(context: CompletionContext) {
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
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        const template = item.template;

        view.dispatch({
          changes: { from, to, insert: template },
        });

        // 커서: cursorOffset(큐레이션) 우선, 없으면 첫 {} 또는 끝
        const firstBrace = template.indexOf('{}');
        const offset = item.cursorOffset ?? (firstBrace !== -1 ? firstBrace + 1 : template.length);
        view.dispatch({
          selection: { anchor: from + offset },
        });
        if (item.braceCount >= 2) {
          (view as any).__tabStopsActive = true;
        }
      },
    }));

  if (options.length === 0) return null;

  return {
    from: word.from,
    options,
    validFor: /^\\[a-zA-Z{]*$/,
  };
}

// ── LaTeX 린터 (동기) ──────────────────────────────────
// 뷰별 직전 진단 캐시 — 한글 IME 조합 중 진단 갱신을 건너뛸 때 사용.
const lastDiagnostics = new WeakMap<EditorView, Diagnostic[]>();

const latexLinter = linter((view) => {
  // 한글 IME 조합 중에는 진단을 갱신하지 않음.
  // 조합 텍스트 위에 물결 밑줄 데코레이션이 붙거나 사라지면 조합이 깨져
  // 끝글자가 중복 입력된다 (lib/latex-highlight.ts의 composing 가드와 같은 이유).
  // 직전 진단을 그대로 반환 → 데코레이션 무변경 → DOM 재렌더 없음.
  // 조합 중 자소 삭제로 문서가 짧아졌을 수 있으므로 문서 길이로 clamp.
  if (view.composing) {
    const len = view.state.doc.length;
    return (lastDiagnostics.get(view) || []).filter((d) => d.to <= len);
  }
  const result = lintLaTeX(view.state.doc.toString());
  lastDiagnostics.set(view, result);
  return result;
}, {
  // 한글 한 음절 조합이 delay를 넘기면 조합 중 진단이 발화하므로 넉넉하게.
  delay: 1200,
});

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange, autoHeight = false, onSnippetShortcut, onCursorActivity }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const tabStopsRef = useRef<boolean>(false);
    const chordPendingRef = useRef<boolean>(false);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMetaDownRef = useRef<number>(0); // Command 더블탭 감지용

    // 최신 콜백을 ref로 유지 (CodeMirror 초기화 이후에도 최신값 참조)
    const snippetCallbackRef = useRef(onSnippetShortcut);
    useEffect(() => {
      snippetCallbackRef.current = onSnippetShortcut;
    }, [onSnippetShortcut]);

    const cursorCallbackRef = useRef(onCursorActivity);
    useEffect(() => {
      cursorCallbackRef.current = onCursorActivity;
    }, [onCursorActivity]);

    useImperativeHandle(ref, () => ({
      insertText(text: string, cursorOffset: number) {
        const view = viewRef.current;
        if (!view) return;

        const { from, to } = view.state.selection.main;

        const braceCount = (text.match(/\{\}/g) || []).length;
        tabStopsRef.current = braceCount >= 2;

        view.dispatch({
          changes: { from, to, insert: text },
        });

        const firstBrace = text.indexOf('{}');
        if (firstBrace !== -1) {
          view.dispatch({
            selection: { anchor: from + firstBrace + 1 },
          });
        } else {
          view.dispatch({
            selection: { anchor: from + cursorOffset },
          });
        }

        view.focus();
      },
      getCursorPosition() {
        const view = viewRef.current;
        if (!view) return 0;
        return view.state.selection.main.head;
      },
      getContent() {
        const view = viewRef.current;
        if (!view) return '';
        return view.state.doc.toString();
      },
      setContent(text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
      },
      setSelection(from: number, to: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          selection: { anchor: from, head: to },
        });
      },
      clearSelection() {
        const view = viewRef.current;
        if (!view) return;
        // 커서를 현재 위치에 놓되, 선택 영역은 해제
        const pos = view.state.selection.main.head;
        view.dispatch({ selection: { anchor: pos } });
      },
      replaceRange(from: number, to: number, text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ changes: { from, to, insert: text } });
      },
      focus() {
        viewRef.current?.focus();
      },
      getCursorCoords() {
        const view = viewRef.current;
        if (!view) return null;
        const pos = view.state.selection.main.head;
        const coords = view.coordsAtPos(pos);
        if (!coords) return null;
        return { top: coords.top, left: coords.left };
      },
      setSearchHighlights(matches: SearchMatch[], activeIndex: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: setSearchHighlightsEffect.of({ matches, activeIndex }),
        });
      },
      clearSearchHighlights() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: clearSearchHighlightsEffect.of(null),
        });
      },
      highlightMath(from: number, to: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setMathHighlightEffect.of({ from, to }) });
      },
      clearMathHighlight() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setMathHighlightEffect.of(null) });
      },
      hasFocus() {
        return viewRef.current?.hasFocus ?? false;
      },
      isComposing() {
        return viewRef.current?.composing ?? false;
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      // ── Tab stop 핸들러 ──
      const tabHandler = keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            if ((view as any).__tabStopsActive) {
              tabStopsRef.current = true;
              (view as any).__tabStopsActive = false;
            }

            if (!tabStopsRef.current) return false;

            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;

            const closeBrace = doc.indexOf('}', cursor);
            if (closeBrace === -1) {
              tabStopsRef.current = false;
              return false;
            }

            const afterClose = doc.indexOf('{', closeBrace + 1);
            const nextClose = doc.indexOf('}', closeBrace + 1);

            if (afterClose !== -1 && (nextClose === -1 || afterClose < nextClose)) {
              const gap = doc.substring(closeBrace + 1, afterClose);
              if (gap.length <= 3) {
                view.dispatch({
                  selection: { anchor: afterClose + 1 },
                });
                return true;
              }
            }

            tabStopsRef.current = false;
            view.dispatch({
              selection: { anchor: closeBrace + 1 },
            });
            return true;
          },
        },
      ]);

      // ── Cmd+F / Ctrl+F 내장 검색 패널 차단 (커스텀 FindReplacePanel만 사용) ──
      const disableBuiltinSearch = Prec.highest(keymap.of([
        { key: 'Mod-f', run: () => true, preventDefault: true },
        { key: 'Mod-h', run: () => true, preventDefault: true },
        { key: 'F3', run: () => true, preventDefault: true },
        { key: 'Mod-g', run: () => true, preventDefault: true },
      ]));

      // $$ ... $$ 블록 삽입 시 상하에 정확히 빈 줄 1개씩 보장
      // - 커서 좌·우의 공백(개행 포함)을 흡수해 그 자리에 정규화 삽입
      // - 문서 시작/끝이면 그쪽 패딩은 생략
      const insertDisplayMathBlock = (view: EditorView) => {
        const doc = view.state.doc.toString();
        const { from } = view.state.selection.main;
        let left = from;
        while (left > 0 && /\s/.test(doc[left - 1])) left--;
        let right = from;
        while (right < doc.length && /\s/.test(doc[right])) right++;
        const atStart = left === 0;
        const atEnd = right === doc.length;
        const padBefore = atStart ? '' : '\n\n';
        const padAfter = atEnd ? '' : '\n\n';
        const insert = padBefore + '$$\n\n$$' + padAfter;
        // cursor: 두 번째 '\n' 뒤(빈 줄 가운데) = padBefore + "$$\n" 다음
        const cursor = left + padBefore.length + 3;
        view.dispatch({
          changes: { from: left, to: right, insert },
          selection: { anchor: cursor },
        });
      };

      // ── Chord 단축키 (Ctrl+N → M/N) + Shift+Esc + Ctrl+Alt+1~9 ──
      const mathShortcuts = Prec.highest(keymap.of([
        {
          key: 'Ctrl-n',
          run: (view) => {
            if (chordPendingRef.current) {
              chordPendingRef.current = false;
              if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
              insertDisplayMathBlock(view);
              return true;
            }

            chordPendingRef.current = true;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            chordTimerRef.current = setTimeout(() => {
              chordPendingRef.current = false;
            }, 1000);
            return true;
          },
        },
        {
          key: 'Shift-Escape',
          run: (view) => {
            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;
            const exitPos = findInnermostExit(doc, cursor);

            if (exitPos !== -1) {
              view.dispatch({
                selection: { anchor: exitPos },
              });
              return true;
            }
            return false;
          },
        },
        // ── Alt+Tab: 수식 내 중괄호 순회 (Command 더블탭과 동일 동작) ──
        {
          key: 'Alt-Tab',
          run: (view) => jumpToNextBrace(view),
        },
        // ── Ctrl+Alt+1 ~ Ctrl+Alt+9 (수식 상용구 단축키) ──
        ...Array.from({ length: 9 }, (_, i) => ({
          key: `Ctrl-Alt-${i + 1}`,
          mac: `Ctrl-Alt-${i + 1}`,
          run: () => {
            if (snippetCallbackRef.current) {
              snippetCallbackRef.current(i + 1);
              return true;
            }
            return false;
          },
        })),
      ]));

      // ── Chord DOM 이벤트 핸들러 ──
      const chordListener = EditorView.domEventHandlers({
        keydown(event, view) {
          if (!chordPendingRef.current) return false;

          if (event.code === 'KeyM') {
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

            const { from, to } = view.state.selection.main;
            const insertText = '$$';
            view.dispatch({
              changes: { from, to, insert: insertText },
            });
            view.dispatch({
              selection: { anchor: from + 1 },
            });
            return true;
          }

          if (event.code === 'KeyN') {
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            insertDisplayMathBlock(view);
            return true;
          }

          chordPendingRef.current = false;
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
          return false;
        },
      });

      // ── Command(Meta) 더블탭: 수식 내 다음 중괄호로 이동 ──
      const metaListener = EditorView.domEventHandlers({
        keydown(event, view) {
          if (event.key === 'Meta') {
            const now = Date.now();
            if (now - lastMetaDownRef.current < 400) {
              lastMetaDownRef.current = 0;
              if (jumpToNextBrace(view)) {
                event.preventDefault();
                return true;
              }
              return false;
            }
            lastMetaDownRef.current = now;
            return false;
          }
          // Meta 외 다른 키 → 더블탭 추적 리셋 (Cmd+C 등 오발 방지)
          lastMetaDownRef.current = 0;
          return false;
        },
      });

      // ── LaTeX 자동완성 설정 ──
      const latexAutocompletion = autocompletion({
        override: [latexCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 12,
        defaultKeymap: true,
        icons: false,
      });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          disableBuiltinSearch,
          mathShortcuts,
          chordListener,
          metaListener,
          tabHandler,
          basicSetup,
          latexAutocompletion,
          // ── 괄호 자동닫기 제어 ──
          Prec.highest(EditorView.inputHandler.of((view, from, to, text) => {
            const doc = view.state.doc.toString();
            const inMath = isInsideMath(doc, from);

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
          })),
          // ── 린트 (LaTeX 오류) ──
          latexLinter,
          lintGutter(),
          // ── 검색 하이라이트 (커스텀 FindReplacePanel용) ──
          searchHighlightField,
          searchHighlightTheme,
          // ── 수식 클릭 하이라이트 (미리보기→편집창) ──
          mathHighlightField,
          mathHighlightTheme,
          EditorView.lineWrapping,
          latexHighlightPlugin,
          latexHighlightTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              if (cursorCallbackRef.current) {
                const head = update.state.selection.main.head;
                const line = update.state.doc.lineAt(head);
                // 마우스 클릭 선택만 수식 중앙 정렬을 유발한다 (화살표 키 이동은 제외)
                const pointerSelect = update.transactions.some((tr) => tr.isUserEvent('select.pointer'));
                cursorCallbackRef.current({
                  line: line.number, offset: head, docChanged: update.docChanged, pointerSelect,
                });
              }
            }
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '15px',
              // 블록 클레이가 비치도록 CodeMirror 기본 흰 배경 차단
              backgroundColor: 'transparent',
            },
            '.cm-scroller': {
              // 내부 자체 스크롤 없음 — 모든 세로 스크롤은 외곽 컨테이너(.scaled-editor)가 담당.
              // (auto로 두면 CM viewport가 상단 라인을 숨긴 채 멈춰 외곽 스크롤로 복구 안 되는 버그 발생)
              overflow: 'visible',
              // 기본 = Pretendard (일반 텍스트). 수식 영역은 cm-math-region이 D2Coding으로 오버라이드
              fontFamily: 'var(--font-ui)',
            },
            '.cm-content': {
              padding: '16px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.8',
            },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              borderRight: '1px solid var(--border-subtle)',
              // 블록이 실제 border를 쓰므로 거터가 좌측 테두리를 덮지 않음
              // → 거터 자체의 좌측선/모서리 보정 불필요 (이중선 제거)
            },
            // 줄 번호 영역: 2자리까지 폭 통일, 3자리 이상부터 자연 확장
            // CodeMirror가 셀 폭을 인라인으로 강제하므로 !important 필요
            '.cm-lineNumbers .cm-gutterElement': {
              minWidth: '1.8em !important',
              textAlign: 'right',
            },
            // 코드 접힘(fold) 화살표 숨김
            '.cm-foldGutter': {
              display: 'none !important',
            },
            // 선택된 텍스트와 동일한 텍스트 하이라이트 비활성화
            '.cm-selectionMatch': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 행 배경색 제거
            '&:not(.cm-focused) .cm-activeLine': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 선택 영역 배경색 제거
            '&:not(.cm-focused) .cm-selectionBackground': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 행번호 거터 배경색 제거
            '&:not(.cm-focused) .cm-activeLineGutter': {
              backgroundColor: 'transparent !important',
            },
            // ═══ 활성 행/행번호 강조 — 웜 클레이 톤 (기본 차가운 강조색 대체) ═══
            // 활성 블록(#EDE6DA)과 같은 색 가족에서 톤만 살짝 깊게 깔아 부드럽게 강조.
            // 반투명 웜 브라운(--border-content-active 계열)이 클레이 위에 합성됨.
            '&.cm-focused .cm-activeLine': {
              backgroundColor: 'rgba(184, 155, 120, 0.13)',
            },
            '&.cm-focused .cm-activeLineGutter': {
              backgroundColor: 'rgba(184, 155, 120, 0.20)',
              color: 'var(--text-secondary)',
            },

            // ═══ 자동완성 드롭다운 스타일 ═══
            '.cm-tooltip.cm-tooltip-autocomplete': {
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              backgroundColor: '#fff',
              overflow: 'hidden',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            },
            '.cm-tooltip-autocomplete ul': {
              maxHeight: '280px',
            },
            '.cm-tooltip-autocomplete ul li': {
              padding: '4px 12px',
              lineHeight: '1.6',
            },
            '.cm-tooltip-autocomplete ul li[aria-selected]': {
              backgroundColor: 'var(--accent-primary, #5b6abf)',
              color: '#fff',
            },
            '.cm-completionLabel': {
              fontSize: '13px',
              fontWeight: '500',
            },
            '.cm-completionDetail': {
              fontSize: '11px',
              marginLeft: '8px',
              opacity: '0.7',
              fontStyle: 'normal',
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
            },

            // ═══ Lint 밑줄 스타일 ═══
            // LaTeX 오류 (중괄호/begin-end 불일치, 닫힘 누락): 빨간색 물결 밑줄
            '.cm-lintRange-error': {
              backgroundImage: 'none !important',
              textDecoration: 'wavy underline #e53935',
              textDecorationSkipInk: 'none',
              textUnderlineOffset: '3px',
            },
            // LaTeX 경고 (미등록 명령어): 주황색 물결 밑줄
            '.cm-lintRange-warning': {
              backgroundImage: 'none !important',
              textDecoration: 'wavy underline #f57c00',
              textDecorationSkipInk: 'none',
              textUnderlineOffset: '3px',
            },

            // ═══ Lint 거터 마커 ═══
            '.cm-lint-marker-error::after': {
              content: '"●"',
              color: '#e53935',
              fontSize: '10px',
            },
            '.cm-lint-marker-warning::after': {
              content: '"●"',
              color: '#f57c00',
              fontSize: '10px',
            },

            // ═══ Lint 툴팁 ═══
            '.cm-tooltip.cm-tooltip-lint': {
              borderRadius: '6px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              fontSize: '13px',
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
              maxWidth: '400px',
            },
            '.cm-diagnosticText': {
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
            },

          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={editorRef}
        style={{
          height: autoHeight ? 'auto' : '100%',
          minHeight: autoHeight ? '60px' : undefined,
          // 외곽 블록이 테두리를 제공 → 래퍼 자체 테두리 제거(텍스트 블록 이중·두꺼움 해소)
          border: 'none',
          overflow: 'hidden',
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;