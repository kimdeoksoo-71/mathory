'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { rehypeTwemoji } from '@yuna0x0/rehype-twemoji';
import { TWEMOJI_BASE, TWEMOJI_IGNORE } from '../../lib/twemoji-url';
import {
  MARKER_LINE_RE, CIRCLED_NUM_LINE_RE, GANA_LITERAL_RE, GIYEOK_LITERAL_RE,
} from '../../lib/locale';
import GgbGraphView, { GraphExportHandle } from '../viewer/GgbGraphView';
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
  /** Phase 42: true면 본문의 첫 mathory-graph 펜스를 자동 활성화 (방금 도착한 AI 응답 전용) */
  graphAutoActivate?: boolean;
  /** Phase 42: 첫 그래프의 내보내기 핸들 등록 — 댓글 액션 행(블록 저장·다운로드)이 사용 */
  onRegisterGraphExport?: (handle: GraphExportHandle | null) => void;
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

    // Phase 57 D11: "대시 1개뿐인 줄"이 리스트 항목 바로 뒤에 오면 setext underline이 아니라
    // 빈 리스트 항목이다('목록' 블록 프리셋의 `- ` 3줄). 빈 줄을 넣으면 loose list로 승격돼
    // 항목 간격이 깨진다. 단일 대시 한정 → `---`·`=` 계열은 기존 동작 불변.
    // ⚠ lib/preprocess.ts의 동일 함수와 반드시 일치시킬 것.
    const isLoneDash = /^\s{0,3}-\s*$/.test(line);
    const prevIsListItem = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/.test(prevLine);

    if (isSetextUnderline && prevLine.trim() !== '' && !(isLoneDash && prevIsListItem)) {
      result.push(''); // 빈 줄 삽입 → setext heading 방지
    }

    result.push(line);
  }

  return result.join('\n');
}

/* ═══ 코드펜스 보호 (Phase 42) ═══
 * preprocessLocale/preprocessMath/preventSetextHeadings는 코드펜스를 인지하지 못하고
 * raw 문자열 전체에 regex를 적용한다. mathory-graph JSON과 검산 python 부록이
 * 변형되지 않도록, 파이프라인 맨 앞에서 ``` 펜스 영역을 placeholder로 치환하고
 * 맨 뒤에서 복원한다 (수식 보호 ⟦MATH_n⟧과 동일 기법).
 * 닫는 펜스는 CommonMark 규칙대로 info string 없는 ``` 줄만 인정. */
function protectFences(text: string): { text: string; fences: string[] } {
  if (!text.includes('```')) return { text, fences: [] };
  const fences: string[] = [];
  const out = text.replace(/^```[^\n]*\n[\s\S]*?\n```[ \t]*$/gm, (m) => {
    fences.push(m);
    return `⟦FENCE_${fences.length - 1}⟧`;
  });
  return { text: out, fences };
}

function restoreFences(text: string, fences: string[]): string {
  if (fences.length === 0) return text;
  return text.replace(/⟦FENCE_(\d+)⟧/g, (_, idx) => fences[parseInt(idx)] ?? '');
}

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
    const isMarkerLine = MARKER_LINE_RE.test(line);
    const prevLine = forced.length > 0 ? forced[forced.length - 1] : '';
    if (isMarkerLine && prevLine.trim() !== '') {
      forced.push('');
    }
    forced.push(line);
  }
  t = forced.join('\n');

  // 2.5. 하위 케이스 경계 정규화(D7) — 최상위 `**Case …**` 라벨 행 앞 빈 줄 강제
  //      (lib/locale.ts normalizeCaseBoundaries와 로직·정규식 동일 — 두 곳 반드시 일치)
  {
    const bl = t.split('\n');
    const acc: string[] = [];
    for (const ln of bl) {
      const isTopCase = /^\*\*Case\s+\d+[a-z]?\.\*\*/.test(ln);
      const pv = acc.length > 0 ? acc[acc.length - 1] : '';
      if (isTopCase && pv.trim() !== '') acc.push('');
      acc.push(ln);
    }
    t = acc.join('\n');
  }

  // 2.6. 하위 케이스 라벨 → marker span (수식 보호 구간 내에서 실행)
  //      (lib/locale.ts convertSubcaseMarkers와 정규식 동일 — 두 곳 반드시 일치)
  t = t.replace(
    /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
  );

  // 3. (가)~(차) · ㄱ.~ㅊ. → marker span (Phase 60 P1)
  //    ⚠ (a)/(i) 레거시 변환은 없다 — Phase 60 후속에서 삭제했다.
  //    (lib/locale.ts convertGanaLiteral/convertGiyeokLiteral과 동일 — 정규식은 공유 상수)
  t = t.replace(new RegExp(GANA_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-gana">(${ch})</span>`);
  t = t.replace(new RegExp(GIYEOK_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-giyeok">${ch}.</span>`);

  // 4-1. ①②③ … 행 시작: marker span(내어쓰기용)
  //      마커 뒤 공백은 [ \t]*로만 — \s*는 개행까지 삼켜서 내용 없는 원문자 줄들이 뭉친다
  //      (lib/locale.ts convertCircledList와 동일)
  t = t.replace(new RegExp(CIRCLED_NUM_LINE_RE.source, 'gm'),
    (_, ch) => `<span class="marker-circled">${ch}</span>`);

  // 5. Fig.N → [그림N]
  t = t.replace(/\bFig\.(\d+)/g, '[그림$1]');

  // 6. Table N → [표N]
  t = t.replace(/\bTable\s+(\d+)/g, '[표$1]');

  // 7. \ref{n} → (n) (참조 번호 인용)
  t = t.replace(/\\ref\{(\d+)\}/g, (_, num) => `(${num})`);

  // 8. 텍스트 행 \tag{n} → inline span (block div 사용 금지 — 후속 수식 렌더링 보호)
  t = t.replace(/\\tag\{(\d+)\}\s*$/gm, (_, num) =>
    `<span class="tag-marker">(${num})</span>`);

  // 9. 수식 영역 복원
  t = t.replace(/⟦MATH_(\d+)⟧/g, (_, idx) => mathRegions[parseInt(idx)]);

  return t;
}

/* ═══ 수식 전처리 ═══ */

function preprocessMath(text: string): string {
  // \tag{n} → \tag*{(n)} (수식 내 참조 번호)
  let result = text.replace(/\\tag\{(\d+)\}/g, (_, num) => `\\tag*{(${num})}`);
  // \ref{n} → \text{(n)} (수식 내 참조 번호 인용)
  result = result.replace(/\\ref\{(\d+)\}/g, (_, num) => `\\text{(${num})}`);
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

  // cases 환경 내 \sum, \int 등에 \displaystyle 자동 추가
  result = result.replace(
    /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g,
    (match, inner) => {
      const patched = inner.replace(
        /(?<!\\displaystyle\s*)(\\(?:sum|int|prod|iint|iiint|oint|bigcup|bigcap)(?![a-zA-Z]))/g,
        '\\displaystyle $1'
      );
      return `\\begin{cases}${patched}\\end{cases}`;
    }
  );

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
  graphAutoActivate = false, onRegisterGraphExport,
}: EditorPreviewProps) {
  const processed = useMemo(() => {
    // 코드펜스를 placeholder로 보호 → 전처리 → 복원 (Phase 42)
    const { text: shielded, fences } = protectFences(content);
    const out = preprocessMath(preprocessLocale(preventSetextHeadings(shielded)));
    return restoreFences(out, fences);
  }, [content]);

  // 첫 번째 mathory-graph 펜스의 내용 — autoActivate 대상 식별용 (Phase 42)
  // 렌더러 내 카운터 대신 내용 비교를 쓰는 이유: StrictMode 이중 렌더에도 결정적
  const firstGraphSpec = useMemo(() => {
    const m = processed.match(/^```mathory-graph[ \t]*\n([\s\S]*?)\n```[ \t]*$/m);
    return m ? m[1].trim() : null;
  }, [processed]);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);

  const markdownElement = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeKatex, { strict: false, trust: true, macros: { "\\arraystretch": "1.8" } }],
        [rehypeTwemoji, {
          format: 'svg',
          source: TWEMOJI_BASE,
          className: 'twemoji',
          draggable: false,
          ignore: TWEMOJI_IGNORE,
        }],
      ]}
      components={{
        // Phase 42: mathory-graph 펜스 → GgbGraphView (pre 레벨에서 가로채야
        // <pre> 안에 div가 렌더되는 invalid HTML과 pre 스타일 누수를 피함)
        pre: ({ children, ...props }) => {
          const child = Array.isArray(children) ? children[0] : children;
          if (
            child && typeof child === 'object' && 'props' in child &&
            typeof (child as { props?: { className?: unknown } }).props?.className === 'string' &&
            ((child as { props: { className: string } }).props.className).includes('language-mathory-graph')
          ) {
            const raw = (child as { props: { children?: unknown } }).props.children;
            const spec = (Array.isArray(raw) ? raw.join('') : String(raw ?? '')).trim();
            const isFirst = firstGraphSpec !== null && spec === firstGraphSpec;
            return (
              <GgbGraphView
                spec={spec}
                autoActivate={graphAutoActivate && isFirst}
                onRegisterExport={isFirst ? onRegisterGraphExport : undefined}
              />
            );
          }
          return <pre {...props}>{children}</pre>;
        },
        /* ═══ 제목 (Phase 58 P1/D1·D1') ═══
           ⚠ 여기 인라인 style이 제목 스타일의 유일한 진실이다. globals.css의 heading 절은
             규칙 없는 주석이고, 인라인 style은 !important 없는 모든 시트 규칙을 이긴다
             → CSS로는 못 바꾼다. 크기·굵기를 손대려면 반드시 이 세 줄을 고칠 것.
           - 1.5 / 1.3 / 1.15em → 1.18 / 1.08 / 1.0em. h2만 내리면 h3와 위계가 역전하므로
             셋을 함께 조정한다.
           - 언더라인(h2 border-bottom) 제거 — 제목은 크기·굵기로만 구분한다.
           - weight 700은 globals.css --weight-* "3단계만(700 금지)"의 제목 한정 예외(D1'').
           - marginTop/Bottom의 em은 "본문 em"이 아니라 "이 제목 자신의 font-size" 기준이다.
             제목 위 여백은 [앞 블록 이월 마진] + [블록 래퍼 paddingTop] + [이 marginTop]의
             3항 합이므로, 여기만 봐서는 체감 여백을 알 수 없다 (Phase 58 F1). */
        h1: ({ children, ...props }) => (
          <h1 style={{ fontSize: '1.18em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 style={{ fontSize: '1.08em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 style={{ fontSize: '1em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h3>
        ),
        table: ({ children, ...props }) => (
          <table style={{
            borderCollapse: 'collapse',
            margin: '1em auto',     // 가로 중앙 정렬
            width: 'auto',           // 콘텐츠 폭으로 축소 (전체 폭 차지 X)
            maxWidth: '100%',        // 컨테이너 넘어가지 않도록
            lineHeight: 1.4,
          }} {...props}>{children}</table>
        ),
        thead: ({ children, ...props }) => (
          <thead style={{ background: 'var(--bg-active)' }} {...props}>{children}</thead>
        ),
        th: ({ children, style, ...props }) => (
          <th style={{
            border: '1px solid #999',
            padding: '6px 10px',
            fontWeight: 600,
            ...(style || {}),
          }} {...props}>{children}</th>
        ),
        td: ({ children, style, ...props }) => (
          <td style={{
            border: '1px solid #999',
            padding: '6px 10px',
            ...(style || {}),
          }} {...props}>{children}</td>
        ),
      }}
    >
      {processed}
    </ReactMarkdown>
  ), [processed, firstGraphSpec, graphAutoActivate, onRegisterGraphExport]);

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
      overflow: borderless ? 'visible' : 'auto',
      // CSS 변수 기반 → 상자/선택지 내부 중첩 EditorPreview까지 동일 스케일 (없으면 15px)
      fontSize: 'var(--content-font-size, 15px)', lineHeight: '1.8',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* 독립행 수식 상하 여백 — Phase 57 K1: 문단 간격(0.6em) + 각 0.5em = 1.1em 대칭.
          (Phase 56까지는 1em/1.8em 비대칭) !important는 KaTeX 자체 .katex-display 마진을 이기기 위함 */}
      <style>{`
        .preview-content .katex-display { margin-top: 1.1em !important; margin-bottom: 1.1em !important; }
      `}</style>
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