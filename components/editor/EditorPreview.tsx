'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
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
        padding: '16px',
        backgroundColor: 'transparent',   // ← '#ffffff' → 'transparent'
        border: borderless ? 'none' : '1px solid #ddd',
        borderRadius: borderless ? '0' : '8px',
        overflow: 'auto',
        fontSize: '15px',
        lineHeight: '2.5',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeKatex, { strict: false, trust: true }],
        ]}
        components={{
          img: ({ src, alt, ...props }) => (
            <img
              src={src}
              alt={alt || ''}
              style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
              {...props}
            />
          ),
          table: ({ children, ...props }) => (
            <div style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table
                style={{
                  width: 'auto',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                  lineHeight: '1.6',
                }}
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead
              style={{ backgroundColor: '#f8f9fa' }}
              {...props}
            >
              {children}
            </thead>
          ),
          th: ({ children, style, ...props }) => (
            <th
              style={{
                padding: '10px 14px',
                borderBottom: '2px solid #dee2e6',
                borderRight: '1px solid #e9ecef',
                textAlign: 'left',
                fontWeight: 600,
                fontSize: '13px',
                color: '#495057',
                whiteSpace: 'nowrap',
                ...style,                 // ← GFM 정렬 정보 병합 (textAlign 덮어씌움)
              }}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              style={{
                padding: '9px 14px',
                borderBottom: '1px solid #e9ecef',
                borderRight: '1px solid #f1f3f5',
                color: '#212529',
              }}
              {...props}
            >
              {children}
            </td>
          ),
          tr: ({ children, ...props }) => (
            <tr
              style={{ transition: 'background-color 0.15s' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                if (el.parentElement?.tagName !== 'THEAD') {
                  el.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                if (el.parentElement?.tagName !== 'THEAD') {
                  el.style.backgroundColor = '';
                }
              }}
              {...props}
            >
              {children}
            </tr>
          ),
          // GFM 취소선 스타일
          del: ({ children, ...props }) => (
            <del style={{ color: '#868e96' }} {...props}>
              {children}
            </del>
          ),
          // GFM 체크리스트 스타일
          input: ({ ...props }) => (
            <input
              {...props}
              disabled
              style={{
                marginRight: '6px',
                verticalAlign: 'middle',
                accentColor: '#4285f4',
              }}
            />
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}