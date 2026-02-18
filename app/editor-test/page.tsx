'use client';

import { useRef, useState } from 'react';
import MarkdownEditor, { MarkdownEditorHandle } from '../../components/editor/MarkdownEditor';
import EditorPreview from '../../components/editor/EditorPreview';
import MathToolbar from '../../components/editor/MathToolbar';

const SAMPLE_TEXT = `# 2025 수능 수학 21번

함수 $f(x) = x^3 - 3x^2 + 2$에 대하여

$$\\int_0^2 f(x)\\,dx$$

의 값을 구하시오.

## 보기
① $12$
② $14$
③ $16$
④ $18$
⑤ $20$
`;

export default function EditorTestPage() {
  const [content, setContent] = useState(SAMPLE_TEXT);
  const editorRef = useRef<MarkdownEditorHandle>(null);

  const handleInsert = (template: string, cursorOffset: number) => {
    editorRef.current?.insertText(template, cursorOffset);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        Mathory Editor — Split View
      </h1>

      <div style={{ display: 'flex', gap: '16px', height: '650px', minWidth: 0 }}>
        {/* 왼쪽: 툴바 + 에디터 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Editor (Markdown + LaTeX)
          </h2>
          <MathToolbar onInsert={handleInsert} />
          <div style={{ flex: 1 }}>
            <MarkdownEditor ref={editorRef} initialValue={SAMPLE_TEXT} onChange={setContent} />
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Preview (KaTeX 렌더링)
          </h2>
          <div style={{ flex: 1 }}>
            <EditorPreview content={content} />
          </div>
        </div>
      </div>
    </div>
  );
}