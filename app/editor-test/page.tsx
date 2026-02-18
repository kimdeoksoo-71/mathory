'use client';

import { useState } from 'react';
import MarkdownEditor from '../../components/editor/MarkdownEditor';

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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        Mathory Editor Test
      </h1>

      <div style={{ display: 'flex', gap: '16px', height: '600px' }}>
        {/* 에디터 */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Editor (CodeMirror 6)
          </h2>
          <MarkdownEditor initialValue={SAMPLE_TEXT} onChange={setContent} />
        </div>

        {/* raw text 확인용 */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Raw Text (DB에 저장될 내용)
          </h2>
          <pre
            style={{
              height: '100%',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '13px',
              fontFamily: "'Menlo', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}