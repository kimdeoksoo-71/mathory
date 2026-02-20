'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface EditorPreviewProps {
  content: string;
}

export default function EditorPreview({ content }: EditorPreviewProps) {
  return (
    <div
      style={{
        height: '100%',
        padding: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'auto',
        fontSize: '15px',
        lineHeight: '1.8',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          img: ({ src, alt, ...props }) => (
            <img
              src={src}
              alt={alt || ''}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}