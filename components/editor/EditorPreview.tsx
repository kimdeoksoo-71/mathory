'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface EditorPreviewProps {
  content: string;
  borderless?: boolean;
}

// \[...\] → $$...$$ 변환, \(...\) → $...$ 변환, 인라인 수식에 \displaystyle 적용
function preprocessMath(text: string): string {
  // \[...\] → $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);

  // \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);

  // $...$ 인라인 수식에 \displaystyle 추가 ($$...$$는 제외)
  result = result.replace(
    /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g,
    (match, inner) => {
      if (inner.trim().startsWith('\\displaystyle')) return match;
      return `$\\displaystyle ${inner}$`;
    }
  );

  return result;
}

export default function EditorPreview({ content, borderless = false }: EditorPreviewProps) {
  const processed = preprocessMath(content);

  return (
    <div
      style={{
        height: '100%',
        padding: borderless ? '0' : '16px',
        backgroundColor: borderless ? 'transparent' : '#ffffff',
        border: borderless ? 'none' : '1px solid #ddd',
        borderRadius: borderless ? '0' : '8px',
        overflow: 'auto',
        fontSize: '15px',
        lineHeight: '2.5',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeKatex, { strict: false, trust: true }],
        ]}
        components={{
          img: ({ src, alt, ...props }) => (
            <div style={{ textAlign: 'center' }}>
              <img
                src={src}
                alt={alt || ''}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                {...props}
              />
            </div>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
