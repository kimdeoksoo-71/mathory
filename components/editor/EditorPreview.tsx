'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface EditorPreviewProps {
  content: string;
  borderless?: boolean;
  autoHeight?: boolean;
  onImageResize?: (src: string, newWidth: number) => void;
}

function preprocessMath(text: string): string {
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const trimmed = inner.trim();
    const hasLineBreak = /\\\\(?![a-zA-Z])/.test(trimmed);
    const hasEnvironment = /\\begin\s*\{/.test(trimmed);
    if (hasLineBreak && !hasEnvironment) {
      let wrapped = `\\displaystyle ${trimmed}`;
      wrapped = wrapped.replace(
        /\\\\(\s*\[[^\]]*\])?\s*/g,
        (m, spacing) => `\\\\${spacing || ''}\n\\displaystyle `
      );
      return `$$\n\\begin{array}{l}\n${wrapped}\n\\end{array}\n$$`;
    }
    return match;
  });

  result = result.replace(
    /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g,
    (match, inner) => {
      if (inner.trim().startsWith('\\displaystyle')) return match;
      return `$\\displaystyle ${inner}$`;
    }
  );

  return result;
}

// ─── 이미지 크기조절 오버레이 ───
function ImageResizeOverlay({
  img,
  onResize,
  onClose,
}: {
  img: HTMLImageElement;
  onResize: (src: string, newWidth: number) => void;
  onClose: () => void;
}) {
  const currentWidth = img.width;
  const [widthPx, setWidthPx] = useState(currentWidth);
  const overlayRef = useRef<HTMLDivElement>(null);

  // img 위치에 맞춰 오버레이 배치
  const rect = img.getBoundingClientRect();

  const handleChange = (val: number) => {
    setWidthPx(val);
    img.style.width = `${val}px`;
    const src = img.getAttribute('src') || '';
    onResize(src, val);
  };

  // 마우스가 이미지+오버레이 영역 밖으로 나가면 닫기
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const imgRect = img.getBoundingClientRect();
      const overlayEl = overlayRef.current;
      const overlayRect = overlayEl?.getBoundingClientRect();

      const inImg =
        e.clientX >= imgRect.left - 4 && e.clientX <= imgRect.right + 4 &&
        e.clientY >= imgRect.top - 4 && e.clientY <= imgRect.bottom + 4;

      const inOverlay = overlayRect &&
        e.clientX >= overlayRect.left - 4 && e.clientX <= overlayRect.right + 4 &&
        e.clientY >= overlayRect.top - 4 && e.clientY <= overlayRect.bottom + 4;

      if (!inImg && !inOverlay) {
        onClose();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [img, onClose]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        left: rect.left + rect.width / 2 - 90,
        top: rect.bottom + 6,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-primary, #ddd)',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 36 }}>
        {widthPx}px
      </span>
      <input
        type="range"
        min={50}
        max={800}
        step={10}
        value={widthPx}
        onChange={(e) => handleChange(Number(e.target.value))}
        style={{
          width: 120,
          accentColor: 'var(--accent-primary, #B8845C)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

export default function EditorPreview({ content, borderless = false, autoHeight = false, onImageResize }: EditorPreviewProps) {
  const processed = preprocessMath(content);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);

  // DOM 이벤트 위임: img 호버 감지 (편집 모드에서만)
  useEffect(() => {
    if (!onImageResize) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        setHoveredImg(target as HTMLImageElement);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    return () => container.removeEventListener('mouseover', handleMouseOver);
  }, [onImageResize]);

  const handleOverlayClose = useCallback(() => {
    setHoveredImg(null);
  }, []);

  // 이미지 가운데 정렬: 렌더 후 img 부모에 스타일 적용
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => {
      const parent = img.parentElement;
      if (parent && parent !== container) {
        parent.style.display = 'flex';
        parent.style.justifyContent = 'center';
      }
      // img 자체를 block + 가운데
      img.style.display = 'block';
      img.style.margin = '8px auto';
      img.style.borderRadius = '4px';
    });
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: autoHeight ? 'auto' : '100%',
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
          h1: ({ children, ...props }) => (
            <h1 style={{
              fontSize: '1.5em', fontWeight: 700,
              marginTop: '1em', marginBottom: '0.5em',
              lineHeight: 1.4,
            }} {...props}>{children}</h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 style={{
              fontSize: '1.3em', fontWeight: 700,
              marginTop: '1em', marginBottom: '0.5em',
              lineHeight: 1.4,
              paddingBottom: '0.3em',
              borderBottom: '1px solid var(--border-light, #E8E4DF)',
            }} {...props}>{children}</h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 style={{
              fontSize: '1.15em', fontWeight: 600,
              marginTop: '1em', marginBottom: '0.5em',
              lineHeight: 1.4,
            }} {...props}>{children}</h3>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>

      {/* 편집 모드: 이미지 호버 시 크기조절 오버레이 */}
      {onImageResize && hoveredImg && (
        <ImageResizeOverlay
          img={hoveredImg}
          onResize={onImageResize}
          onClose={handleOverlayClose}
        />
      )}
    </div>
  );
}