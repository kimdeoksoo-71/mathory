'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';

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

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange, autoHeight = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const tabStopsRef = useRef<boolean>(false);

    useImperativeHandle(ref, () => ({
      insertText(text: string, cursorOffset: number) {
        const view = viewRef.current;
        if (!view) return;

        const { from, to } = view.state.selection.main;

        // {} 가 2개 이상이면 tab stop 모드 활성화
        const braceCount = (text.match(/\{\}/g) || []).length;
        tabStopsRef.current = braceCount >= 2;

        view.dispatch({
          changes: { from, to, insert: text },
        });

        // 첫 번째 {} 안으로 커서 이동
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

      getCursorPosition(): number {
        const view = viewRef.current;
        if (!view) return 0;
        return view.state.selection.main.head;
      },

      getContent(): string {
        const view = viewRef.current;
        if (!view) return '';
        return view.state.doc.toString();
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      const tabHandler = keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            if (!tabStopsRef.current) return false;

            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;

            // 현재 커서 위치에서 가장 가까운 } 를 찾아 넘어감
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

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          tabHandler,
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
              height: autoHeight ? 'auto' : '100%',
              minHeight: autoHeight ? '120px' : undefined,
              fontSize: '15px',
            },
            '.cm-scroller': {
              overflow: autoHeight ? 'hidden' : 'auto',
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
          height: autoHeight ? 'auto' : '100%',
          minHeight: autoHeight ? '120px' : undefined,
          border: autoHeight ? 'none' : '1px solid #ddd',
          borderRadius: autoHeight ? '0' : '0 0 8px 8px',
          overflow: 'hidden',
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;