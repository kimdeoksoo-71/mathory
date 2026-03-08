'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete';
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';
import { LATEX_COMPLETIONS, isInsideMath } from '../../lib/latex-completions';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  autoHeight?: boolean;
}

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset: number) => void;
  getCursorPosition: () => number;
  getContent: () => string;
}

// ── 수식 모드 감지 헬퍼 ──────────────────────────────────
function findMathExit(doc: string, cursor: number): number {
  // ── 1) $$ 블록 수식 검사
  let searchStart = 0;
  while (searchStart < doc.length) {
    const openIdx = doc.indexOf('$$', searchStart);
    if (openIdx === -1) break;
    const innerStart = openIdx + 2;
    const closeIdx = doc.indexOf('$$', innerStart);
    if (closeIdx === -1) break;
    const innerEnd = closeIdx;
    const closeEnd = closeIdx + 2;

    if (cursor >= innerStart && cursor <= innerEnd) {
      return closeEnd;
    }
    searchStart = closeEnd;
  }

  // ── 2) $ 인라인 수식 검사
  let i = 0;
  while (i < doc.length) {
    if (doc[i] === '$' && doc[i + 1] === '$') {
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
        return closeIdx + 1;
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

  return -1;
}

// ── LaTeX 자동완성 소스 ──────────────────────────────────
function latexCompletionSource(context: CompletionContext) {
  // \ 로 시작하는 입력 매칭
  const word = context.matchBefore(/\\[a-zA-Z{]*/);
  if (!word || word.from === word.to) return null;

  // 최소 2글자 (\와 알파벳 1자) 이상이어야 드롭다운 표시
  if (word.text.length < 2) return null;

  // 수식 모드 내부인지 확인
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

        // 템플릿 삽입
        view.dispatch({
          changes: { from, to, insert: template },
        });

        // {} 가 있으면 첫 번째 {} 안으로 커서 이동
        const firstBrace = template.indexOf('{}');
        if (firstBrace !== -1) {
          view.dispatch({
            selection: { anchor: from + firstBrace + 1 },
          });
          // Tab stop 모드 활성화 (2개 이상의 {} 가 있을 때)
          if (item.braceCount >= 2) {
            // tabStopsRef에 직접 접근할 수 없으므로 커스텀 이벤트로 전달
            (view as any).__tabStopsActive = true;
          }
        } else {
          // {} 가 없으면 템플릿 끝으로 커서 이동
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

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange, autoHeight = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const tabStopsRef = useRef<boolean>(false);
    const chordPendingRef = useRef<boolean>(false);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      // ── Tab stop 핸들러 ──
      const tabHandler = keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            // 자동완성에서 삽입된 경우도 처리
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

      // ── Chord 단축키 (Ctrl+N → M/N) + Shift+Esc ──
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
            const exitPos = findMathExit(doc, cursor);

            if (exitPos !== -1) {
              view.dispatch({
                selection: { anchor: exitPos },
              });
              return true;
            }
            return false;
          },
        },
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
          markdown(),
          latexAutocompletion,
          EditorView.lineWrapping,
          latexHighlightPlugin,
          latexHighlightTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString());
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
            // ── 자동완성 드롭다운 스타일 ──
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