'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';
import { createMathShortcuts, createLatexAutocompletion } from '../../lib/math-editor-extensions';

export interface LatexInputEditorHandle {
  insertAtCursor(text: string, cursorOffset?: number): void;
  setValue(text: string): void;
  focus(): void;
}

interface LatexInputEditorProps {
  initialValue?: string;
  fontSize?: number;
  minHeight?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onChange?: (v: string) => void;
  /** Ctrl/Cmd + Enter 콜백 — true 반환해 기본동작 막음 */
  onSubmit?: () => void;
  /** 입력 글자수 상한 (초과하는 변경은 차단). 미지정 시 무제한 */
  maxLength?: number;
}

const LatexInputEditor = forwardRef<LatexInputEditorHandle, LatexInputEditorProps>(
  ({
    initialValue = '',
    fontSize = 13,
    minHeight = 120,
    placeholder = '',
    autoFocus = false,
    onChange,
    onSubmit,
    maxLength,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // 최신 콜백 ref
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    const onSubmitRef = useRef(onSubmit);
    useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

    useEffect(() => {
      if (!containerRef.current) return;
      // 수식 단축키 (Ctrl+N chord, Shift+Esc, Opt+Tab) — 인스턴스별 chord 상태
      const { shortcuts: mathShortcuts, chordListener } = createMathShortcuts();
      const latexAutocompletion = createLatexAutocompletion();
      const view = new EditorView({
        parent: containerRef.current,
        state: EditorState.create({
          doc: initialValue,
          extensions: [
            history(),
            markdown(),
            mathShortcuts,
            chordListener,
            latexAutocompletion,
            latexHighlightPlugin,
            latexHighlightTheme,
            EditorView.lineWrapping,
            // 글자수 상한 — 결과 문서가 maxLength를 넘기는 변경(타이핑·붙여넣기)은 통째로 차단
            ...(maxLength
              ? [
                  EditorState.changeFilter.of((tr) =>
                    !tr.docChanged || tr.newDoc.length <= maxLength,
                  ),
                ]
              : []),
            cmPlaceholder(placeholder),
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => { onSubmitRef.current?.(); return true; },
              },
              ...historyKeymap,
              ...defaultKeymap,
            ]),
            EditorView.theme({
              '&': { fontSize: `${fontSize}px`, background: 'transparent' },
              '&.cm-editor': { background: 'transparent' },
              '&.cm-focused': { outline: 'none' },
              '.cm-content': {
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                minHeight: `${minHeight}px`,
                padding: '4px 4px',
                caretColor: 'var(--text-primary)',
              },
              '.cm-scroller': { lineHeight: '1.5' },
              '.cm-line': { padding: '0' },
            }),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
            }),
          ],
        }),
      });
      viewRef.current = view;
      if (autoFocus) {
        // 마운트 직후 포커스 (필요시)
        requestAnimationFrame(() => view.focus());
      }
      return () => { view.destroy(); viewRef.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      insertAtCursor(text: string, cursorOffset?: number) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + (cursorOffset ?? text.length) },
        });
        view.focus();
      },
      setValue(text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
      },
      focus() { viewRef.current?.focus(); },
    }));

    return <div ref={containerRef} style={{ width: '100%' }} />;
  },
);

LatexInputEditor.displayName = 'LatexInputEditor';
export default LatexInputEditor;
