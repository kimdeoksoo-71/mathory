'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { rehypeTwemoji } from '@yuna0x0/rehype-twemoji';
import { TWEMOJI_BASE, TWEMOJI_IGNORE } from '../../lib/twemoji-url';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import './PrintStyles.css';
import { preprocess, Locale } from '../../lib/preprocess';
import { toneClass } from '../../lib/keyTone';

export interface PrintBlock {
  id: string;
  type: string;
  raw_text: string;
  imageWidth?: number;
  imageTreatment?: 'frame';
  imageGray?: boolean;
  svg_initial_view?: { scale: number; positionX: number; positionY: number } | null;
  svg_height?: number;
  ggb_initial_coords?: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
  ggb_height?: number;
}

export interface PrintTab {
  /** 탭 id (question / solution / extra_N) — Phase 58 P2 톤 스코프 판정용.
   *  label은 사용자가 바꿀 수 있어 문제/풀이 구분에 쓸 수 없다. */
  id: string;
  label: string;
  blocks: PrintBlock[];
}

interface PrintableContentProps {
  title: string;
  tabs: PrintTab[];
  locale?: Locale;
}

const BORDERED_TYPES_PRINT = new Set(['gana', 'roman', 'box']);

/**
 * A3 2단 인쇄용 콘텐츠 렌더러 (간소화)
 *
 * 규격: A3 세로 297×420mm, 상하 30mm 좌우 20mm 여백, 2단 10mm 간격
 * 부가 요소 없음: 구분선, 머리말, 꼬리말, 페이지 번호 전부 제거
 * 본문만 2단으로 흐름
 */
export default function PrintableContent({
  title, tabs, locale = 'international',
}: PrintableContentProps) {
  return (
    <div className="print-root">
      <div className="print-body">
        {tabs.map((tab, tabIdx) => (
          /* Phase 58 P2 — 톤 스코프 클래스. 인쇄는 색을 100%로 되돌리고 key만 굵게 하는
             의도적 예외라(D6), 클래스는 붙이되 PrintStyles가 색을 복원한다.
             .tone-baseline은 붙이지 않는다 — 인쇄 본문색은 #000으로 별도 체계다. */
          <div
            key={tab.label + tabIdx}
            className={[tabIdx > 0 ? 'print-tab-section' : '', toneClass(tab.id, tab.blocks)]
              .filter(Boolean).join(' ')}
          >
            <div className="print-tab-label">{tab.label}</div>
            {tab.blocks.map((block, blockIdx) => (
              /* Phase 58 D2 — 제목 위 여백. 인쇄는 화면과 산식이 달라 값도 다르다:
                 [앞 문단 margin-bottom 6pt] + [이 paddingTop] + [.print-body h2 margin-top 8pt].
                 1.5em(15pt)이면 합 29pt(=2.9em)로 목표 2.4em 초과 → 1em(10pt)이면 정확히 24pt.
                 PrintStyles의 h1/h2/h3 자체는 손대지 않는다(D10''). */
              <div key={block.id} className="print-block" style={block.type === 'heading' && blockIdx > 0 ? { paddingTop: '1em' } : undefined}>
                {block.type === 'choices' ? (
                  <PrintChoicesBlock content={block.raw_text} locale={locale} />
                ) : block.type === 'image' ? (
                  <PrintImageBlock content={block.raw_text} imageWidth={block.imageWidth} imageTreatment={block.imageTreatment} imageGray={block.imageGray} />
                ) : block.type === 'svg' ? (
                  <PrintSvgBlock url={block.raw_text} initialView={block.svg_initial_view} height={block.svg_height} />
                ) : block.type === 'ggb' ? (
                  <PrintGgbBlock height={block.ggb_height} />
                ) : BORDERED_TYPES_PRINT.has(block.type) ? (
                  <div className="print-bordered-block">
                    <PrintBlockRenderer content={block.raw_text} locale={locale} />
                  </div>
                ) : block.type === 'callout' ? (
                  /* Phase 57: 강조문 — 테두리 없이 display 수식과 같은 들여쓰기·상하 여백 */
                  <div className="callout-block">
                    <PrintBlockRenderer content={block.raw_text} locale={locale} />
                  </div>
                ) : (
                  <PrintBlockRenderer content={block.raw_text} locale={locale} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintBlockRenderer({ content, locale }: { content: string; locale: Locale }) {
  const processed = preprocess(content, locale);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeKatex, { strict: false, trust: true, fleqn: true, macros: { '\\arraystretch': '1.8' } }],
        [rehypeTwemoji, {
          format: 'svg',
          source: TWEMOJI_BASE,
          className: 'twemoji',
          draggable: false,
          ignore: TWEMOJI_IGNORE,
        }],
      ]}
      components={{
        img: ({ src, alt, ...props }) => (
          <img src={src} alt={alt || ''} style={{ maxWidth: '100%', height: 'auto' }} {...props} />
        ),
        blockquote: ({ children }) => <div className="text-box">{children}</div>,
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

/** 선택지 인쇄 블록: 선택지 수에 따라 3/5등분, 라벨은 기록된 그대로 */
function PrintChoicesBlock({ content, locale }: { content: string; locale: Locale }) {
  const choices: { label: string; content: string }[] = [];
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^([①②③④⑤])\s*(.*)$/);
    if (!m) continue;
    const c = m[2].trim();
    if (!c) continue;
    choices.push({ label: m[1], content: c });
    if (choices.length >= 5) break;
  }

  // 1~3개 → 3등분, 4~5개 → 5등분
  const cols = choices.length <= 3 ? 3 : 5;

  return (
    <div className="print-choices-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {choices.map((c, i) => (
        <div key={i} className="print-choice-item">
          <span className="print-choice-label">{c.label}</span>
          <span className="print-choice-content">
            <PrintBlockRenderer content={c.content} locale={locale} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * SVG 인쇄 블록: 저장된 초기뷰가 있으면 transform 으로 적용.
 * 인쇄 컨테이너는 100% width × 300px 고정 (편집기 뷰어와 동일).
 * positionX/Y 는 편집 당시 컨테이너 크기 기준이라 print 컬럼 폭이 다르면 오차 발생.
 */
function PrintSvgBlock({
  url, initialView, height = 300,
}: {
  url: string;
  initialView?: { scale: number; positionX: number; positionY: number } | null;
  height?: number;
}) {
  if (!url) return null;
  const wrapperStyle: React.CSSProperties = {
    width: '100%', height, overflow: 'hidden', position: 'relative',
    background: '#fff', border: '1px solid #ddd',
  };
  if (initialView) {
    const innerStyle: React.CSSProperties = {
      width: '100%', height: '100%',
      transform: `translate(${initialView.positionX}px, ${initialView.positionY}px) scale(${initialView.scale})`,
      transformOrigin: '0 0',
    };
    return (
      <div style={wrapperStyle}>
        <div style={innerStyle}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      </div>
    );
  }
  return (
    <div style={wrapperStyle}>
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

/**
 * GeoGebra 인쇄 블록: 이번 Phase는 인쇄 미지원.
 * "GeoGebra 블록은 인쇄에서 미지원" 안내 박스만 출력.
 */
function PrintGgbBlock({ height = 350 }: { height?: number }) {
  return (
    <div style={{
      width: '100%', height,
      background: '#fafafa', border: '1px dashed #ccc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#666', fontSize: 12,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16 }}>📐 GeoGebra</div>
        <div style={{ marginTop: 4 }}>인쇄 미지원 — 화면에서 확인하세요</div>
      </div>
    </div>
  );
}

/** 이미지 인쇄 블록: imageWidth + treatment 적용 */
function PrintImageBlock({ content, imageWidth, imageTreatment, imageGray }: {
  content: string; imageWidth?: number; imageTreatment?: 'frame'; imageGray?: boolean;
}) {
  const srcMatch = content.match(/src="([^"]+)"/);
  const src = srcMatch?.[1] || '';
  if (!src) return null;
  const w = imageWidth || 400;
  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={src}
        alt=""
        style={{
          width: `${Math.min(w, 600)}px`, maxWidth: '90%', height: 'auto',
          ...imageTreatmentStyle({ imageTreatment, imageGray }, { print: true }),
        }}
      />
    </div>
  );
}
