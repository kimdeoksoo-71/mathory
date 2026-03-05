'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap, ViewPlugin } from '@codemirror/view';
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
}

// ── 수식 모드 감지 헬퍼 ──────────────────────────────────
// 커서가 $...$ 또는 $$...$$ 안에 있으면 닫는 구분자의 끝 위치를 반환
// 아니면 -1 반환
function findMathExit(doc: string, cursor: number): number {
  // ── 1) $$ 블록 수식 검사 (먼저 검사해야 $ 인라인과 혼동 방지) ──
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
      return closeEnd; // $$ 닫는 구분자 뒤
    }
    searchStart = closeEnd;
  }

  // ── 2) $ 인라인 수식 검사 ──
  let i = 0;
  while (i < doc.length) {
    // $$ 는 건너뛰기
    if (doc[i] === '$' && doc[i + 1] === '$') {
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 2;
      continue;
    }

    if (doc[i] === '$') {
      const openIdx = i;
      const innerStart = i + 1;
      // 닫는 $ 찾기 (같은 줄에서)
      let closeIdx = -1;
      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }

      if (closeIdx !== -1 && cursor >= innerStart && cursor <= closeIdx) {
        return closeIdx + 1; // $ 닫는 구분자 뒤
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

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange }, ref) => {
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

      // ── Tab stop 핸들러 ──
      const tabHandler = keymap.of([
        {
          key: 'Tab',
          run: (view) => {
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
          // Ctrl+N: chord 대기 모드 진입 (이미 대기 중이면 Ctrl+N,N 실행)
          key: 'Ctrl-n',
          run: (view) => {
            if (chordPendingRef.current) {
              // 이미 chord 대기 중 → Ctrl+N, N (블록 수식)
              chordPendingRef.current = false;
              if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

              const { from, to } = view.state.selection.main;
              const insertText = '\n$$\n\n$$\n';
              view.dispatch({
                changes: { from, to, insert: insertText },
                selection: { anchor: from + 4 }, // 두 $$ 사이 빈 줄
              });
              return true;
            }

            chordPendingRef.current = true;
            // 1초 안에 두 번째 키 안 누르면 자동 해제
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            chordTimerRef.current = setTimeout(() => {
              chordPendingRef.current = false;
            }, 1000);
            return true; // 기본 동작(새 파일 등) 차단
          },
        },
        {
          // Shift+Escape: 수식 밖으로 탈출
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

      // ── Chord 두 번째 키를 DOM 이벤트로 처리 ──
      const chordListener = EditorView.domEventHandlers({
        keydown(event, view) {
          if (!chordPendingRef.current) return false;

          // chord 대기 중 → 두 번째 키 확인
          if (event.code === 'KeyM') {
            // Ctrl+N, M → 인라인 수식 $  $ 삽입
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

            const { from, to } = view.state.selection.main;
            const insertText = '$  $';
            view.dispatch({
              changes: { from, to, insert: insertText },
              selection: { anchor: from + 2 }, // 두 $ 사이 중앙
            });
            return true;
          }

          if (event.code === 'KeyN') {
            // Ctrl+N, N → 블록 수식 $$\n\n$$ 삽입 (위아래 빈 줄 포함)
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

            const { from, to } = view.state.selection.main;
            const insertText = '\n$$\n\n$$\n';
            view.dispatch({
              changes: { from, to, insert: insertText },
              selection: { anchor: from + 4 }, // 두 $$ 사이 빈 줄
            });
            return true;
          }

          // 다른 키가 눌리면 chord 취소
          chordPendingRef.current = false;
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
          return false;
        },
      });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          mathShortcuts,
          chordListener,
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
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
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