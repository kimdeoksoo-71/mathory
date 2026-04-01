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
  /** 로케일 (호환용 — 항상 ko 적용) */
  locale?: string;
  /** 현재 활성 수식 인덱스 (블록 내 출현 순서, -1이면 없음) */
  activeMathId?: number;
  /** 미리보기 수식 클릭 시 콜백 (수식 인덱스 전달) */
  onClickMath?: (mathId: number) => void;
}

/* ═══ setext heading 방지 ═══
 * Markdown에서 텍스트 바로 아래에 "-" 또는 "=" 만 있는 줄이 오면
 * setext heading(h1/h2)으로 해석됨. 예:
 *   어떤 텍스트
 *   -            ← <h2>어떤 텍스트</h2> 로 변환됨
 *
 * 이를 방지하기 위해 해당 줄 앞에 빈 줄을 삽입하여
 * 리스트 아이템 또는 수평선(thematic break)으로 올바르게 처리.
 */
function preventSetextHeadings(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = result.length > 0 ? result[result.length - 1] : '';

    // setext underline: 줄 전체가 - 또는 = 만으로 구성 (선행 공백 0~3, 후행 공백 허용)
    const isSetextUnderline =
      /^\s{0,3}-+\s*$/.test(line) || /^\s{0,3}=+\s*$/.test(line);

    if (isSetextUnderline && prevLine.trim() !== '') {
      result.push(''); // 빈 줄 삽입 → setext heading 방지
    }

    result.push(line);
  }

  return result.join('\n');
}

/* ═══ 원문자 상수 (locale/math 공용) ═══ */
const CIRCLED_CONSONANTS = [
  '㉠','㉡','㉢','㉣','㉤','㉥','㉦','㉧','㉨','㉩','㉪','㉫','㉬','㉭',
];

/* ═══ locale 변환 (ko): 수식 보호 → 텍스트 치환 → 복원 ═══ */
function preprocessLocale(text: string): string {
  // 1. 수식 영역을 placeholder로 보호 (display → inline 순서)
  const mathRegions: string[] = [];
  const protect = (m: string) => {
    mathRegions.push(m);
    return `⟦MATH_${mathRegions.length - 1}⟧`;
  };
  let t = text
    .replace(/\$\$[\s\S]*?\$\$/g, protect)
    .replace(/\\\[[\s\S]*?\\\]/g, protect)
    .replace(/\$(?:[^$\\]|\\.)+\$/g, protect)
    .replace(/\\\([\s\S]*?\\\)/g, protect);

  // 2. (a)~(e), (i)~(v) 시작 행 앞에 빈 줄 강제 삽입 → 독립 <p> 보장
  //    (이전 줄이 내용이 있고 빈 줄이 아닌 경우에만)
  const lines = t.split('\n');
  const forced: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isMarkerLine = /^\((iii|ii|iv|v|i|[a-e])\)/.test(line.trimStart());
    const prevLine = forced.length > 0 ? forced[forced.length - 1] : '';
    if (isMarkerLine && prevLine.trim() !== '') {
      forced.push('');
    }
    forced.push(line);
  }
  t = forced.join('\n');

  // 3. (a)~(e) → (가)~(마) — 행 시작: marker span(내어쓰기용), 행 중간: 텍스트만
  const gana: Record<string, string> = { a: '가', b: '나', c: '다', d: '라', e: '마' };
  t = t.replace(/^\(([a-e])\)/gm, (_, ch) =>
    `<span class="marker-gana">(${gana[ch]})</span>`);
  t = t.replace(/([^a-zA-Z0-9\n])\(([a-e])\)/g, (_, pre, ch) => `${pre}(${gana[ch]})`);

  // 4. (i)~(v) → ㄱ.~ㅁ. — 행 시작: marker span(내어쓰기용), 행 중간: 텍스트만
  const giyeok: Record<string, string> = { i: 'ㄱ', ii: 'ㄴ', iii: 'ㄷ', iv: 'ㄹ', v: 'ㅁ' };
  t = t.replace(/^\((iii|ii|iv|v|i)\)/gm, (_, r) =>
    `<span class="marker-giyeok">${giyeok[r]}.</span>`);
  t = t.replace(/([^a-zA-Z0-9\n])\((iii|ii|iv|v|i)\)/g, (_, pre, r) => `${pre}${giyeok[r]}.`);

  // 5. Fig.N → [그림N]
  t = t.replace(/\bFig\.(\d+)/g, '[그림$1]');

  // 6. Table N → [표N]
  t = t.replace(/\bTable\s+(\d+)/g, '[표$1]');

  // 7. \ref{n} → ㉠ (꼬리표 인용)
  t = t.replace(/\\ref\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return CIRCLED_CONSONANTS[idx];
    }
    return match;
  });

  // 8. 텍스트 행 \tag{n} → inline span (block div 사용 금지 — 후속 수식 렌더링 보호)
  t = t.replace(/\\tag\{(\d+)\}\s*$/gm, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return `<span class="tag-marker">…… ${CIRCLED_CONSONANTS[idx]}</span>`;
    }
    return match;
  });

  // 9. 수식 영역 복원
  t = t.replace(/⟦MATH_(\d+)⟧/g, (_, idx) => mathRegions[parseInt(idx)]);

  return t;
}

/* ═══ 수식 전처리 ═══ */

function preprocessMath(text: string): string {
  // \tag{n} → \tag*{⋯⋯ ㉠} (가운뎃점 6개 + 간격 + 원문자)
  let result = text.replace(/\\tag\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return `\\tag*{…… ${CIRCLED_CONSONANTS[idx]}}`;
    }
    return match;
  });
  // \ref{n} → \text{㉠} (수식 내 꼬리표 인용)
  result = result.replace(/\\ref\{(\d+)\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    if (idx >= 0 && idx < CIRCLED_CONSONANTS.length) {
      return `\\text{${CIRCLED_CONSONANTS[idx]}}`;
    }
    return match;
  });
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
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
  onImageResize, locale, activeMathId, onClickMath,
}: EditorPreviewProps) {
  const processed = useMemo(
    () => preprocessMath(preprocessLocale(preventSetextHeadings(content))),
    [content],
  );
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
            paddingBottom: '0.3em', borderBottom: '1px solid #999' }} {...props}>{children}</h2>
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