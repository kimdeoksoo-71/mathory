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

      // === 2.2. $$$$ + Space 자동 확장 ===
      // $$$$를 타이핑한 후 Space를 누르면:
      //   (빈줄)
      //   $$
      //   (커서)
      //   $$
      //   (빈줄)
      // 로 자동 변환
      const dollarAutoExpand = EditorView.inputHandler.of(
        (view, from, to, text) => {
          // Space가 입력될 때만 처리
          if (text !== ' ') return false;

          const doc = view.state.doc.toString();
          const cursor = from; // Space 입력 직전 커서 위치

          // 커서 앞 4글자가 $$$$인지 확인
          if (cursor < 4) return false;
          const before = doc.slice(cursor - 4, cursor);
          if (before !== '$$$$') return false;

          // 현재 줄의 시작 위치를 찾아서, $$$$ 앞에 다른 내용이 없는지 확인
          // (줄 중간에 있는 $$$$도 처리하되, 더 안전한 동작을 위해)
          const lineStart = doc.lastIndexOf('\n', cursor - 5) + 1;
          const beforeDollars = doc.slice(lineStart, cursor - 4).trim();

          // $$$$ 앞에 내용이 있으면 무시 (의도하지 않은 변환 방지)
          if (beforeDollars.length > 0) return false;

          // 현재 줄의 앞부분 공백(들여쓰기) 보존
          const linePrefix = doc.slice(lineStart, cursor - 4);

          // $$$$ 를 삭제하고 포맷된 블록으로 교체
          // 결과: \n$$\n커서\n$$\n
          const replacement = '\n$$\n\n$$\n';
          const replaceFrom = cursor - 4; // $$$$ 시작 위치
          // linePrefix도 함께 교체 (줄 시작부터)
          const actualFrom = lineStart;
          const actualReplacement = linePrefix.length > 0
            ? linePrefix + replacement
            : replacement;

          // 앞에 이미 빈 줄이 있는지 확인
          const textBeforeLine = doc.slice(0, lineStart);
          const needLeadingNewline = textBeforeLine.length > 0 && !textBeforeLine.endsWith('\n\n');
          
          let finalReplacement = '';
          let cursorInReplacement = 0;

          if (needLeadingNewline) {
            finalReplacement = '\n$$\n\n$$\n';
            cursorInReplacement = actualFrom + 4; // '\n$$\n' = 4글자 뒤가 커서 위치
          } else {
            finalReplacement = '$$\n\n$$\n';
            cursorInReplacement = actualFrom + 3; // '$$\n' = 3글자 뒤가 커서 위치
          }

          view.dispatch({
            changes: { from: actualFrom, to: cursor, insert: finalReplacement },
            selection: { anchor: cursorInReplacement },
          });

          return true; // 이벤트 소비 (Space 문자는 삽입하지 않음)
        }
      );

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          tabHandler,
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          dollarAutoExpand, // $$$$ + Space 자동 확장
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
              minHeight: autoHeight ? '60px' : undefined,
              fontSize: '15px',
            },
            '.cm-scroller': {
              overflow: autoHeight ? 'visible' : 'auto',
              fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
            },
            '.cm-content': {
              padding: '16px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            },
            // === 2.1. 편집창 행간을 한 행의 세로폭 100%로 늘림 ===
            '.cm-line': {
              lineHeight: '2.0',
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