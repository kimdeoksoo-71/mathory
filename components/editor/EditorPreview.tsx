'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface EditorPreviewProps {
  content: string;
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

export default function EditorPreview({ content }: EditorPreviewProps) {
  const processed = preprocessMath(content);

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
        lineHeight: '2.5',
      }}
    >
      <style>{`
        /* ===== Blockquote ===== */
        .mathory-preview blockquote {
          margin: 12px 0;
          padding: 8px 16px;
          border-left: 4px solid #c9a96e;
          background-color: #fdf8f0;
          color: #5a4a3a;
          font-style: italic;
        }
        .mathory-preview blockquote p {
          margin: 4px 0;
        }

        /* ===== Unordered List (기존 disc/circle) ===== */
        .mathory-preview ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 8px 0;
        }
        .mathory-preview ul ul {
          list-style-type: circle;
        }
        .mathory-preview ul ul ul {
          list-style-type: square;
        }

        /* ===== Ordered List: (i), (ii), (iii) 스타일 ===== */
        .mathory-preview ol {
          list-style-type: none;
          padding-left: 2.5em;
          margin: 8px 0;
          counter-reset: roman-counter;
        }
        .mathory-preview ol > li {
          counter-increment: roman-counter;
          position: relative;
        }
        .mathory-preview ol > li::before {
          content: "(" counter(roman-counter, lower-roman) ")";
          position: absolute;
          left: -2.5em;
          width: 2.2em;
          text-align: right;
          color: #555;
          font-weight: 500;
        }

        /* ===== 2층위 Ordered List: (i-1), (i-2), ... 스타일 ===== */
        .mathory-preview ol ol {
          counter-reset: sub-counter;
          padding-left: 3em;
        }
        .mathory-preview ol ol > li {
          counter-increment: sub-counter;
        }
        .mathory-preview ol ol > li::before {
          content: "(" counter(roman-counter, lower-roman) "-" counter(sub-counter) ")";
          left: -3em;
          width: 2.8em;
        }

        /* ===== 3층위: (i-1-a), (i-1-b), ... ===== */
        .mathory-preview ol ol ol {
          counter-reset: subsub-counter;
          padding-left: 3.5em;
        }
        .mathory-preview ol ol ol > li {
          counter-increment: subsub-counter;
        }
        .mathory-preview ol ol ol > li::before {
          content: "(" counter(roman-counter, lower-roman) "-" counter(sub-counter) "-" counter(subsub-counter, lower-alpha) ")";
          left: -3.5em;
          width: 3.2em;
        }

        /* ===== 공통 li 스타일 ===== */
        .mathory-preview li {
          margin: 4px 0;
          line-height: 2.0;
        }
        .mathory-preview li > p {
          margin: 0;
        }
      `}</style>

      <div className="mathory-preview">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
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
          }}
        >
          {processed}
        </ReactMarkdown>
      </div>
    </div>
  );
}
