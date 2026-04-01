'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import './PrintStyles.css';
import { preprocess, Locale } from '../../lib/preprocess';

export interface PrintBlock {
  id: string;
  type: string;
  raw_text: string;
  imageWidth?: number;
}

export interface PrintTab {
  label: string;
  blocks: PrintBlock[];
}

interface PrintableContentProps {
  title: string;
  tabs: PrintTab[];
  locale?: Locale;
}

const CHOICES_LABELS_PRINT = ['①', '②', '③', '④', '⑤'];
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
          <div key={tab.label + tabIdx} className={tabIdx > 0 ? 'print-tab-section' : ''}>
            <div className="print-tab-label">{tab.label}</div>
            {tab.blocks.map((block) => (
              <div key={block.id} className="print-block">
                {block.type === 'choices' ? (
                  <PrintChoicesBlock content={block.raw_text} locale={locale} />
                ) : block.type === 'image' ? (
                  <PrintImageBlock content={block.raw_text} imageWidth={block.imageWidth} />
                ) : BORDERED_TYPES_PRINT.has(block.type) ? (
                  <div className="print-bordered-block">
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
        [rehypeKatex, { strict: false, trust: true, macros: { '\\arraystretch': '1.8' } }],
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

/** 선택지 인쇄 블록: CSS flexbox wrap으로 1열/2열 자동 전환 */
function PrintChoicesBlock({ content, locale }: { content: string; locale: Locale }) {
  const lines = content.split('\n');
  const choices = CHOICES_LABELS_PRINT.map((label, idx) => {
    const line = lines[idx] || '';
    const choiceContent = line.replace(/^[①②③④⑤]\s*/, '').trim();
    return { label, content: choiceContent };
  });

  return (
    <div className="print-choices-row">
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

/** 이미지 인쇄 블록: imageWidth 적용 */
function PrintImageBlock({ content, imageWidth }: { content: string; imageWidth?: number }) {
  const srcMatch = content.match(/src="([^"]+)"/);
  const src = srcMatch?.[1] || '';
  if (!src) return null;
  const w = imageWidth || 400;
  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={src}
        alt=""
        style={{ width: `${Math.min(w, 600)}px`, maxWidth: '90%', height: 'auto' }}
      />
    </div>
  );
}
