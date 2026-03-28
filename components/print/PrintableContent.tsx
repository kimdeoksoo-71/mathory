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
}

export interface PrintTab {
  label: string;       // "문제", "풀이" 등
  blocks: PrintBlock[];
}

interface PrintableContentProps {
  /** 시험 제목 (머리말에 표시) */
  title: string;
  /** 머리말 오른쪽 정보 (학년/반/이름 등) */
  headerInfo?: string;
  /** 탭별 콘텐츠 배열 */
  tabs: PrintTab[];
  /** 로케일 설정 */
  locale?: Locale;
  /** 현재 페이지 번호 */
  pageNumber?: number;
  /** 탭 구분 방식: 'continuous' = 한 페이지에 이어서, 'pagebreak' = 탭마다 새 페이지 */
  tabLayout?: 'continuous' | 'pagebreak';
}

/**
 * A3 2단 인쇄용 콘텐츠 렌더러
 * 
 * 이 컴포넌트는 @media print CSS와 함께 동작하며,
 * window.print() 호출 시 확정된 A3 세로 2단 규격으로 출력됩니다.
 */
export default function PrintableContent({
  title,
  headerInfo = '학년 (    ) 반 (    ) 번 이름 (            )',
  tabs,
  locale = 'international',
  pageNumber = 1,
  tabLayout = 'continuous',
}: PrintableContentProps) {
  return (
    <div className="print-root">
      <div className="print-page">
        {/* 머리말 */}
        <div className="print-header">
          <span className="print-header-title">{title}</span>
          <span className="print-header-info">{headerInfo}</span>
        </div>

        {/* 머리말-본문 구분선 */}
        <hr className="print-header-divider" />

        {/* 2단 본문 */}
        <div className="print-body">
          {tabs.map((tab, tabIdx) => (
            <div key={tab.label + tabIdx}>
              {/* 탭 라벨 (첫 번째 탭은 라벨 생략 가능) */}
              {tabIdx > 0 && (
                <>
                  {tabLayout === 'pagebreak' ? (
                    <div style={{ breakBefore: 'column' }} />
                  ) : (
                    <hr className="print-tab-divider" />
                  )}
                  <div className="print-tab-label">{tab.label}</div>
                </>
              )}

              {/* 블록들 렌더링 */}
              {tab.blocks.map((block) => (
                <div key={block.id} className="print-block">
                  <PrintBlockRenderer
                    content={block.raw_text}
                    locale={locale}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 꼬리말 — 페이지 번호 중앙 */}
        <div className="print-footer">
          — {pageNumber} —
        </div>
      </div>
    </div>
  );
}

/**
 * 개별 블록 렌더러
 * preprocess 파이프라인을 거쳐 ReactMarkdown + KaTeX로 렌더링
 */
function PrintBlockRenderer({
  content,
  locale,
}: {
  content: string;
  locale: Locale;
}) {
  const processed = preprocess(content, locale);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeKatex, {
          strict: false,
          trust: true,
          macros: { '\\arraystretch': '1.8' },
        }],
      ]}
      components={{
        img: ({ src, alt, ...props }) => (
          <img
            src={src}
            alt={alt || ''}
            style={{ maxWidth: '100%', height: 'auto' }}
            {...props}
          />
        ),
        blockquote: ({ children }) => (
          <div className="text-box">
            {children}
          </div>
        ),
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}