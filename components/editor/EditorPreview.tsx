'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  /** 현재 활성 수식 인덱스 (블록 내 출현 순서, -1이면 없음) */
  activeMathId?: number;
  /** 미리보기 수식 클릭 시 콜백 (수식 인덱스 전달) */
  onClickMath?: (mathId: number) => void;
}

/* ═══ ol giyeok/gana 래퍼 변환 ═══ */
function preprocessOlTypes(text: string): string {
  return text.replace(
    /<ol\s+class="(giyeok|gana)">\s*\n([\s\S]*?)\n\s*<\/ol>/g,
    (_, cls, inner) => `<div class="ol-${cls}">\n\n${inner.trim()}\n\n</div>`
  );
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

/* ═══ 이미지 크기조절 오버레이 ═══ */
function ImageResizeOverlay({
  img, onResize, onClose,
}: {
  img: HTMLImageElement;
  onResize: (src: string, newWidth: number) => void;
  onClose: () => void;
}) {
  const currentWidth = img.width;
  const [widthPx, setWidthPx] = useState(currentWidth);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rect = img.getBoundingClientRect();
  const handleChange = (val: number) => {
    setWidthPx(val);
    img.style.width = `${val}px`;
    onResize(img.getAttribute('src') || '', val);
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const imgRect = img.getBoundingClientRect();
      const oEl = overlayRef.current;
      const oRect = oEl?.getBoundingClientRect();
      const inImg = e.clientX >= imgRect.left - 4 && e.clientX <= imgRect.right + 4 &&
                    e.clientY >= imgRect.top - 4 && e.clientY <= imgRect.bottom + 4;
      const inO = oRect && e.clientX >= oRect.left - 4 && e.clientX <= oRect.right + 4 &&
                  e.clientY >= oRect.top - 4 && e.clientY <= oRect.bottom + 4;
      if (!inImg && !inO) onClose();
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [img, onClose]);
  return (
    <div ref={overlayRef} style={{
      position: 'fixed', left: rect.left + rect.width / 2 - 90, top: rect.bottom + 6,
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-primary, #ddd)', borderRadius: 8,
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 36 }}>{widthPx}px</span>
      <input type="range" min={50} max={800} step={10} value={widthPx}
        onChange={(e) => handleChange(Number(e.target.value))}
        style={{ width: 120, accentColor: 'var(--accent-primary, #B8845C)', cursor: 'pointer' }} />
    </div>
  );
}

/* ═══ 메인 컴포넌트 ═══ */

export default function EditorPreview({
  content, borderless = false, autoHeight = false,
  onImageResize, activeMathId, onClickMath,
}: EditorPreviewProps) {
  const processed = useMemo(() => preprocessMath(preprocessOlTypes(content)), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);

  const markdownElement = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeKatex, { strict: false, trust: true, macros: { "\\arraystretch": "1.8" } }],
      ]}
      components={{
        h1: ({ children, ...props }) => (
          <h1 style={{ fontSize: '1.5em', fontWeight: 700, marginTop: '1em', marginBottom: '0.5em', lineHeight: 1.4 }} {...props}>{children}</h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 style={{ fontSize: '1.3em', fontWeight: 700, marginTop: '1em', marginBottom: '0.5em', lineHeight: 1.4,
            paddingBottom: '0.3em', borderBottom: '1px solid var(--border-light, #E8E4DF)' }} {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 style={{ fontSize: '1.15em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em', lineHeight: 1.4 }} {...props}>{children}</h3>
        ),
      }}
    >
      {processed}
    </ReactMarkdown>
  ), [processed]);

  /* ─── 렌더 후: 모든 .katex 요소에 data-math-id 부여 (출현 순서) ─── */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.querySelectorAll('.katex').forEach((k, i) => {
      (k as HTMLElement).setAttribute('data-math-id', String(i));
    });
  }, [processed]);

  /* ─── img 호버 ─── */
  useEffect(() => {
    if (!onImageResize) return;
    const container = containerRef.current;
    if (!container) return;
    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'IMG')
        setHoveredImg(e.target as HTMLImageElement);
    };
    container.addEventListener('mouseover', handleMouseOver);
    return () => container.removeEventListener('mouseover', handleMouseOver);
  }, [onImageResize]);
  const handleOverlayClose = useCallback(() => setHoveredImg(null), []);

  /* ─── 이미지 가운데 정렬 ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll('img').forEach((img) => {
      const parent = img.parentElement;
      if (parent && parent !== container) {
        parent.style.display = 'flex';
        parent.style.justifyContent = 'center';
      }
      img.style.display = 'block';
      img.style.margin = '8px auto';
      img.style.borderRadius = '4px';
    });
  });

  /* ─── 활성 수식 하이라이트 ─── */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.querySelectorAll('.math-highlight-active').forEach((c) =>
      c.classList.remove('math-highlight-active')
    );
    if (activeMathId === undefined || activeMathId < 0) return;
    const target = el.querySelector(`[data-math-id="${activeMathId}"]`) as HTMLElement;
    if (target) target.classList.add('math-highlight-active');
  }, [activeMathId]);

  /* ─── 미리보기 수식 클릭 → mathId 전달 ─── */
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (!onClickMath) return;
    const katexEl = (e.target as HTMLElement).closest('.katex');
    if (!katexEl) return;
    const mathIdAttr = katexEl.getAttribute('data-math-id');
    if (mathIdAttr !== null) onClickMath(parseInt(mathIdAttr, 10));
  }, [onClickMath]);

  return (
    <div ref={containerRef} style={{
      height: autoHeight ? 'auto' : '100%',
      padding: borderless ? '0' : '16px',
      backgroundColor: borderless ? 'transparent' : '#ffffff',
      border: borderless ? 'none' : '1px solid #ddd',
      borderRadius: borderless ? '0' : '8px',
      overflow: 'auto', fontSize: '15px', lineHeight: '2.5',
    }}>
      <div ref={contentRef} className="preview-content"
        onClick={handleContentClick}
        style={{ cursor: onClickMath ? 'pointer' : undefined }}>
        {markdownElement}
      </div>
      {onImageResize && hoveredImg && (
        <ImageResizeOverlay img={hoveredImg} onResize={onImageResize} onClose={handleOverlayClose} />
      )}
    </div>
  );
}