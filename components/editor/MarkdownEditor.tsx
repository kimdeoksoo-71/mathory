'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset: number) => void;
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

            // } 다음에 바로 { 가 오면 → 다음 {} 안으로 이동
            // } 다음에 { 가 없으면 → 템플릿 끝, 모드 종료
            const afterClose = doc.indexOf('{', closeBrace + 1);
            const nextClose = doc.indexOf('}', closeBrace + 1);

            // 바로 인접한 {} 쌍인지 확인 (사이에 다른 } 가 없어야 함)
            if (afterClose !== -1 && (nextClose === -1 || afterClose < nextClose)) {
              // 다음 { 와 현재 } 사이에 줄바꿈 없는 가까운 거리인지 확인
              const gap = doc.substring(closeBrace + 1, afterClose);
              if (gap.length <= 3) {
                // 다음 {} 안으로 커서 이동
                view.dispatch({
                  selection: { anchor: afterClose + 1 },
                });
                return true;
              }
            }

            // 더 이상 다음 {} 없음 → } 바로 뒤로 이동, 모드 종료
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