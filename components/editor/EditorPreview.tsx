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
  /** 편집창 커서가 위치한 행번호 (1-indexed) */
  activeSourceLine?: number;
  /** 미리보기 클릭 시 → { sourceLine, text, isMath } */
  onClickSource?: (info: { sourceLine: number; text: string; isMath: boolean }) => void;
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

/* ═══ 원본 소스 → 세그먼트 행번호 맵 ═══ */
interface SegmentRange {
  startLine: number; // 1-indexed
  endLine: number;   // 1-indexed, inclusive
}

function buildSourceLineMap(content: string): SegmentRange[] {
  const lines = content.split('\n');
  const segments: SegmentRange[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // 빈 줄 건너뛰기
    if (trimmed === '') {
      i++;
      continue;
    }

    const startLine = i + 1; // 1-indexed

    // $$...$$ 블록 수식
    if (trimmed.startsWith('$$')) {
      if (trimmed.length > 2 && trimmed.endsWith('$$') && trimmed !== '$$') {
        // 한 줄 블록 수식: $$...$$ 
        segments.push({ startLine, endLine: startLine });
        i++;
        continue;
      }
      // 여러 줄 블록 수식
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('$$')) {
        i++;
      }
      if (i < lines.length) i++; // closing $$
      segments.push({ startLine, endLine: i });
      continue;
    }

    // \[...\] 블록 수식
    if (trimmed.startsWith('\\[')) {
      i++;
      while (i < lines.length && !lines[i].trim().includes('\\]')) {
        i++;
      }
      if (i < lines.length) i++;
      segments.push({ startLine, endLine: i });
      continue;
    }

    // # 제목
    if (trimmed.startsWith('#')) {
      segments.push({ startLine, endLine: startLine });
      i++;
      continue;
    }

    // --- 구분선
    if (/^[-*_]{3,}$/.test(trimmed)) {
      segments.push({ startLine, endLine: startLine });
      i++;
      continue;
    }

    // <img /> 등 HTML 태그 (한 줄)
    if (trimmed.startsWith('<img') || trimmed.startsWith('<br')) {
      segments.push({ startLine, endLine: startLine });
      i++;
      continue;
    }

    // 일반 단락: 빈 줄이나 특수 요소 만날 때까지
    i++;
    while (i < lines.length) {
      const nextTrimmed = lines[i].trim();
      if (nextTrimmed === '' || nextTrimmed.startsWith('#') ||
          nextTrimmed.startsWith('$$') || nextTrimmed.startsWith('\\[') ||
          /^[-*_]{3,}$/.test(nextTrimmed)) {
        break;
      }
      i++;
    }
    segments.push({ startLine, endLine: i });
  }

  return segments;
}

// ─── 이미지 크기조절 오버레이 ───
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
    const src = img.getAttribute('src') || '';
    onResize(src, val);
  };

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
      if (!inImg && !inOverlay) onClose();
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
      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 36 }}>
        {widthPx}px
      </span>
      <input type="range" min={50} max={800} step={10} value={widthPx}
        onChange={(e) => handleChange(Number(e.target.value))}
        style={{ width: 120, accentColor: 'var(--accent-primary, #B8845C)', cursor: 'pointer' }}
      />
    </div>
  );
}

/* ═══ 메인 컴포넌트 ═══ */

export default function EditorPreview({
  content, borderless = false, autoHeight = false,
  onImageResize, activeSourceLine, onClickSource,
}: EditorPreviewProps) {
  const processed = useMemo(() => preprocessMath(content), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);

  // 소스 행번호 맵
  const sourceLineMap = useMemo(() => buildSourceLineMap(content), [content]);

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
          <h2 style={{ fontSize: '1.3em', fontWeight: 700, marginTop: '1em', marginBottom: '0.5em', lineHeight: 1.4, paddingBottom: '0.3em', borderBottom: '1px solid var(--border-light, #E8E4DF)' }} {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 style={{ fontSize: '1.15em', fontWeight: 600, marginTop: '1em', marginBottom: '0.5em', lineHeight: 1.4 }} {...props}>{children}</h3>
        ),
      }}
    >
      {processed}
    </ReactMarkdown>
  ), [processed]);

  // ─── 렌더 후: DOM 자식에 data-source-line 부여 ───
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const children = Array.from(el.children);
    children.forEach((child, idx) => {
      if (idx < sourceLineMap.length) {
        const seg = sourceLineMap[idx];
        (child as HTMLElement).setAttribute('data-source-line-start', String(seg.startLine));
        (child as HTMLElement).setAttribute('data-source-line-end', String(seg.endLine));
      }
    });
  }, [content, sourceLineMap]);

  // ─── img 호버 ───
  useEffect(() => {
    if (!onImageResize) return;
    const container = containerRef.current;
    if (!container) return;
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') setHoveredImg(target as HTMLImageElement);
    };
    container.addEventListener('mouseover', handleMouseOver);
    return () => container.removeEventListener('mouseover', handleMouseOver);
  }, [onImageResize]);

  const handleOverlayClose = useCallback(() => setHoveredImg(null), []);

  // ─── 이미지 가운데 정렬 ───
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
      img.style.display = 'block';
      img.style.margin = '8px auto';
      img.style.borderRadius = '4px';
    });
  });

  // ─── 활성 행번호 하이라이트 ───
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // 이전 하이라이트 제거 — 모든 스타일을 원래대로 복원
    el.querySelectorAll('.preview-line-active').forEach((child) => {
      (child as HTMLElement).style.borderLeft = '';
      (child as HTMLElement).style.backgroundColor = '';
      (child as HTMLElement).style.paddingLeft = '';
      (child as HTMLElement).style.borderRadius = '';
      (child as HTMLElement).style.transition = '';
      child.classList.remove('preview-line-active');
    });

    if (activeSourceLine === undefined || activeSourceLine < 1) return;

    // 범위에 activeSourceLine이 포함되는 요소 찾기
    const children = Array.from(el.children);
    for (const child of children) {
      const start = parseInt((child as HTMLElement).getAttribute('data-source-line-start') || '0', 10);
      const end = parseInt((child as HTMLElement).getAttribute('data-source-line-end') || '0', 10);
      if (start > 0 && activeSourceLine >= start && activeSourceLine <= end) {
        const target = child as HTMLElement;
        target.classList.add('preview-line-active');
        target.style.borderLeft = '3px solid #e53935';
        target.style.backgroundColor = 'rgba(229, 57, 53, 0.04)';
        target.style.paddingLeft = '8px';
        target.style.borderRadius = '4px';
        target.style.transition = 'all 0.15s ease';

        // 미리보기 창 세로 중앙으로 스크롤
        const container = containerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const offset = targetRect.top - containerRect.top + container.scrollTop;
          const center = offset - containerRect.height / 2 + targetRect.height / 2;
          container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
        }
        break;
      }
    }
  }, [activeSourceLine]);

  // ─── 미리보기 클릭 → 소스 행번호 + 텍스트 추출 ───
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    if (!onClickSource) return;

    const target = e.target as HTMLElement;

    // 가장 가까운 data-source-line-start를 가진 요소 찾기
    let sourceEl: HTMLElement | null = target;
    let sourceLine = 0;
    while (sourceEl && sourceEl !== contentRef.current) {
      const lineAttr = sourceEl.getAttribute('data-source-line-start');
      if (lineAttr) {
        sourceLine = parseInt(lineAttr, 10);
        break;
      }
      sourceEl = sourceEl.parentElement;
    }
    if (sourceLine < 1) return;

    // 1) KaTeX 수식 클릭
    const katexEl = target.closest('.katex');
    if (katexEl) {
      const annotation = katexEl.querySelector('annotation');
      if (annotation) {
        let latex = annotation.textContent || '';
        latex = latex.replace(/\\displaystyle\s*/g, '').trim();
        latex = latex.replace(/\\begin\{array\}\{[^}]*\}\s*/g, '');
        latex = latex.replace(/\s*\\end\{array\}/g, '');
        latex = latex.trim();
        onClickSource({ sourceLine, text: latex, isMath: true });
        return;
      }
    }

    // 2) 일반 텍스트 클릭
    const blockEl = target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    if (blockEl) {
      const text = blockEl.textContent || '';
      onClickSource({ sourceLine, text: text.trim(), isMath: false });
    }
  }, [onClickSource]);

  return (
    <div ref={containerRef} style={{
      height: autoHeight ? 'auto' : '100%',
      padding: borderless ? '0' : '16px',
      backgroundColor: borderless ? 'transparent' : '#ffffff',
      border: borderless ? 'none' : '1px solid #ddd',
      borderRadius: borderless ? '0' : '8px',
      overflow: 'auto', fontSize: '15px', lineHeight: '2.5',
    }}>
      <div ref={contentRef} onClick={handleContentClick}
        style={{ cursor: onClickSource ? 'pointer' : undefined }}>
        {markdownElement}
      </div>

      {onImageResize && hoveredImg && (
        <ImageResizeOverlay img={hoveredImg} onResize={onImageResize} onClose={handleOverlayClose} />
      )}
    </div>
  );
}