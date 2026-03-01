'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset: number) => void;
  getCursorPosition: () => number;
  getView: () => EditorView | null;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const tabStopsRef = useRef<boolean>(false);

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
      getView() {
        return viewRef.current;
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      // ===== Tab/Shift-Tab 핸들러 — Prec.highest로 최우선 =====
      const customKeymap = Prec.highest(keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            // 1순위: tabStop 모드 (수식 템플릿 {} 사이 이동)
            if (tabStopsRef.current) {
              const doc = view.state.doc.toString();
              const cursor = view.state.selection.main.head;

              const closeBrace = doc.indexOf('}', cursor);
              if (closeBrace === -1) {
                tabStopsRef.current = false;
              } else {
                const afterClose = doc.indexOf('{', closeBrace + 1);
                const nextClose = doc.indexOf('}', closeBrace + 1);

                if (afterClose !== -1 && (nextClose === -1 || afterClose < nextClose)) {
                  const gap = doc.substring(closeBrace + 1, afterClose);
                  if (gap.length <= 3) {
                    view.dispatch({ selection: { anchor: afterClose + 1 } });
                    return true;
                  }
                }

                tabStopsRef.current = false;
                view.dispatch({ selection: { anchor: closeBrace + 1 } });
                return true;
              }
            }

            // 2순위: 줄 시작에 공백 4칸 삽입 (들여쓰기)
            const line = view.state.doc.lineAt(view.state.selection.main.head);
            view.dispatch({
              changes: { from: line.from, to: line.from, insert: '    ' },
            });
            return true;
          },
        },
        {
          key: 'Shift-Tab',
          run: (view) => {
            // 줄 시작에서 공백 최대 4칸 제거 (내어쓰기)
            const line = view.state.doc.lineAt(view.state.selection.main.head);
            const match = line.text.match(/^( {1,4})/);
            if (match) {
              view.dispatch({
                changes: { from: line.from, to: line.from + match[1].length },
              });
              return true;
            }
            return true; // Shift-Tab이 포커스 이동하지 않도록
          },
        },
      ]));

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          customKeymap,  // 최우선 키맵
          basicSetup,
          markdown(),
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
            },
            '.cm-gutters': {
              backgroundColor: '#f8f9fa',
              borderRight: '1px solid #e0e0e0',
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
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        ref={editorRef}
        style={{
          height: '100%',
          overflow: 'hidden',
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;
