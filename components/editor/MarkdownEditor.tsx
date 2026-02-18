'use client';

import { useRef, useEffect } from 'react';
import { EditorView } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export default function MarkdownEditor({ initialValue = '', onChange }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        basicSetup,
        markdown(),
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
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}