'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete';
import { linter, lintGutter } from '@codemirror/lint';
// search는 커스텀 FindReplacePanel에서 처리
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';
import { LATEX_COMPLETIONS, isInsideMath } from '../../lib/latex-completions';
import { lintLaTeX } from '../../lib/latex-linter';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  autoHeight?: boolean;
  onSnippetShortcut?: (index: number) => void;
  onCursorActivity?: (info: { line: number; offset: number }) => void;
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

        const firstBrace = template.indexOf('{}');
        if (firstBrace !== -1) {
          view.dispatch({
            selection: { anchor: from + firstBrace + 1 },
          });
          if (item.braceCount >= 2) {
            (view as any).__tabStopsActive = true;
          }
        } else {
          view.dispatch({
            selection: { anchor: from + template.length },
          });
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
const latexLinter = linter((view) => {
  const doc = view.state.doc.toString();
  return lintLaTeX(doc);
}, {
  delay: 500,
});

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange, autoHeight = false, onSnippetShortcut, onCursorActivity }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const tabStopsRef = useRef<boolean>(false);
    const chordPendingRef = useRef<boolean>(false);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // ── Chord 단축키 (Ctrl+N → M/N) + Shift+Esc + Ctrl+Alt+1~9 ──
      const mathShortcuts = Prec.highest(keymap.of([
        {
          key: 'Ctrl-n',
          run: (view) => {
            if (chordPendingRef.current) {
              chordPendingRef.current = false;
              if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

              const { from, to } = view.state.selection.main;
              const insertText = '\n$$\n\n$$\n';
              view.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: from + 4 },
              });
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
        // ── Alt+Tab: 수식 내 중괄호 순회 ──
        {
          key: 'Alt-Tab',
          run: (view) => {
            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;
            const region = findMathRegion(doc, cursor);
            if (!region) return false;

            // 수식 영역 내 모든 { 위치 수집 (커서를 { 바로 안쪽에 놓기 위해 +1)
            const bracePositions: number[] = [];
            for (let k = region.start; k < region.end; k++) {
              if (doc[k] === '{') {
                bracePositions.push(k + 1);
              }
            }
            if (bracePositions.length === 0) return false;

            // 현재 커서 다음 중괄호로 이동, 끝이면 처음으로 순회
            let nextPos = bracePositions.find((p) => p > cursor);
            if (nextPos === undefined) {
              nextPos = bracePositions[0];
            }

            view.dispatch({ selection: { anchor: nextPos } });
            return true;
          },
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

            const { from, to } = view.state.selection.main;
            const insertText = '\n$$\n\n$$\n';
            view.dispatch({
              changes: { from, to, insert: insertText },
              selection: { anchor: from + 4 },
            });
            return true;
          }

          chordPendingRef.current = false;
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
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
          mathShortcuts,
          chordListener,
          tabHandler,
          basicSetup,
          latexAutocompletion,
          // ── 괄호 자동닫기 제어 ──
          Prec.highest(EditorView.inputHandler.of((view, from, to, text) => {
            const doc = view.state.doc.toString();
            const inMath = isInsideMath(doc, from);

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
          // ── 검색은 커스텀 FindReplacePanel에서 처리 ──
          // ── 검색은 커스텀 FindReplacePanel에서 처리 ──
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
                cursorCallbackRef.current({ line: line.number, offset: head });
              }
            }
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '15px',
            },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
            },
            '.cm-content': {
              padding: '16px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              lineHeight: '2.5',
            },
            '.cm-gutters': {
              backgroundColor: '#f8f9fa',
              borderRight: '1px solid #e0e0e0',
            },
            // 코드 접힘(fold) 화살표 숨김
            '.cm-foldGutter': {
              display: 'none !important',
            },
            // 선택된 텍스트와 동일한 텍스트 하이라이트 비활성화
            '.cm-selectionMatch': {
              backgroundColor: 'transparent !important',
            },

            // ═══ 자동완성 드롭다운 스타일 ═══
            '.cm-tooltip.cm-tooltip-autocomplete': {
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              backgroundColor: '#fff',
              overflow: 'hidden',
              fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
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
          border: '1px solid #ddd',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;