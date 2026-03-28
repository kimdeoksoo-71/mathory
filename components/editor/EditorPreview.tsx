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

// \[...\] → $$...$$ 변환, \(...\) → $...$ 변환, 인라인 수식에 \displaystyle 적용,
// bare \\ 줄바꿈이 있는 display math → array{l} 환경으로 감싸기 (왼쪽 정렬)
function preprocessMath(text: string): string {
  // \[...\] → $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);

  // \(...\) → $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);

  // $$...$$ 블록에서 bare \\ (환경 없이) → array{l}로 감싸기
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const trimmed = inner.trim();
    // \\ 줄바꿈이 있고 (\\begin 같은 명령어 제외), \begin{ 환경이 없는 경우
    const hasLineBreak = /\\\\(?![a-zA-Z])/.test(trimmed);
    const hasEnvironment = /\\begin\s*\{/.test(trimmed);
    if (hasLineBreak && !hasEnvironment) {
      // 각 행 앞에 \displaystyle 주입 (array 셀은 textstyle 기본이므로)
      // 첫 행 앞에 추가 + 각 \\ (및 선택적 [spacing]) 뒤에 추가
      let wrapped = `\\displaystyle ${trimmed}`;
      wrapped = wrapped.replace(
        /\\\\(\s*\[[^\]]*\])?\s*/g,
        (match, spacing) => `\\\\${spacing || ''}\n\\displaystyle `
      );
      return `$$\n\\begin{array}{l}\n${wrapped}\n\\end{array}\n$$`;
    }
    return match;
  });

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
          [rehypeKatex, {
            strict: false,
            trust: true,
            macros: {
              "\\arraystretch": "1.8",
            },
          }],
        ]}
        components={{
          h1: ({ children }) => (
            <h1 className="mathory-h1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mathory-h2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mathory-h3">{children}</h3>
          ),
          img: ({ src, alt, width }) => (
            <span className="mathory-img-wrap">
              <img
                src={src || ''}
                alt={alt || ''}
                style={{
                  maxWidth: '100%',
                  width: width ? `${width}px` : undefined,
                  height: 'auto',
                  borderRadius: '4px',
                }}
              />
            </span>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
