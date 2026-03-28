'use client';

import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PrintableContent, { PrintTab } from './PrintableContent';
import { Locale } from '../../lib/preprocess';

interface PdfDownloadButtonProps {
  /** 시험 제목 */
  title: string;
  /** 머리말 오른쪽 정보 */
  headerInfo?: string;
  /** 탭 데이터 배열 */
  tabs: PrintTab[];
  /** 로케일 */
  locale?: Locale;
  /** 버튼 라벨 */
  label?: string;
  /** 탭 레이아웃 */
  tabLayout?: 'continuous' | 'pagebreak';
}

/**
 * PDF 다운로드 버튼
 * 
 * 동작 방식:
 * 1. 클릭 시 새 창(또는 iframe)에 PrintableContent를 렌더링
 * 2. KaTeX 폰트 로딩 대기
 * 3. window.print() 호출 → 브라우저 PDF 저장 다이얼로그
 * 4. 완료 후 창 닫기
 */
export default function PdfDownloadButton({
  title,
  headerInfo,
  tabs,
  locale = 'ko',
  label = 'PDF 다운로드',
  tabLayout = 'continuous',
}: PdfDownloadButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);

    try {
      // 새 창 열기
      const printWindow = window.open('', '_blank', 
        'width=800,height=1100,scrollbars=yes'
      );
      if (!printWindow) {
        alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
        setIsPrinting(false);
        return;
      }

      // HTML 문서 구성
      const katexCssUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css';
      
      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - PDF</title>
  <link rel="stylesheet" href="${katexCssUrl}" />
  <style>
    @page {
      size: 297mm 420mm;
      margin: 20mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
      font-size: 12pt;
      line-height: 1.75;
      color: #000;
    }
    .print-header {
      height: 10mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10pt;
      color: #333;
      padding-bottom: 5mm;
    }
    .print-header-title {
      font-weight: 700;
      font-size: 12pt;
    }
    .print-header-info {
      font-size: 10pt;
      color: #555;
    }
    .print-header-divider {
      border: none;
      border-top: 0.15mm solid #000;
      margin: 0 0 5mm 0;
    }
    .print-body {
      column-count: 2;
      column-gap: 10mm;
      column-rule: 0.15mm solid #000;
    }
    .print-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .print-problem {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 12pt;
    }
    .print-footer {
      height: 10mm;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      color: #555;
      margin-top: 5mm;
    }
    .print-tab-divider {
      border: none;
      border-top: 0.3mm double #000;
      margin: 12pt 0;
    }
    .print-tab-label {
      font-size: 14pt;
      font-weight: 700;
      margin: 8pt 0 6pt;
      break-after: avoid;
    }
    h1 { font-size: 16pt; font-weight: 700; margin: 0 0 6pt; break-after: avoid; }
    h2 { font-size: 14pt; font-weight: 700; margin: 8pt 0 4pt; break-after: avoid; }
    h3 { font-size: 12pt; font-weight: 700; margin: 6pt 0 3pt; break-after: avoid; }
    p { margin: 0 0 6pt; text-align: justify; word-break: keep-all; }
    blockquote, .text-box {
      border: 0.3mm solid #000;
      padding: 6pt 8pt;
      margin: 6pt 0;
      break-inside: avoid;
    }
    ol { margin: 4pt 0; padding-left: 16pt; }
    ol li { margin-bottom: 3pt; }
    ul { margin: 4pt 0; padding-left: 14pt; }
    ul li { margin-bottom: 3pt; }
    img { max-width: 100%; height: auto; break-inside: avoid; }
    hr { border: none; border-top: 0.1mm solid #999; margin: 8pt 0; }
    .katex-display { margin: 8pt 0; break-inside: avoid; }
    .katex { font-size: 1em; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 10pt; break-inside: avoid; }
    th, td { border: 0.2mm solid #000; padding: 3pt 6pt; text-align: center; }
    th { font-weight: 700; background-color: #f5f5f5; }
  </style>
</head>
<body>
  <div id="print-content"></div>
</body>
</html>
      `);
      printWindow.document.close();

      // React 렌더링을 위한 컨테이너 가져오기
      const container = printWindow.document.getElementById('print-content');
      if (!container) {
        setIsPrinting(false);
        return;
      }

      // 컨텐츠를 직접 HTML로 생성 (새 창에는 React 컨텍스트가 없으므로)
      // 대신 현재 페이지에서 미리 렌더링한 HTML을 복사
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.id = 'temp-print-render';
      document.body.appendChild(tempDiv);

      // React 18의 createRoot를 사용하여 임시 렌더링
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      
      await new Promise<void>((resolve) => {
        root.render(
          <PrintableContent
            title={title}
            headerInfo={headerInfo}
            tabs={tabs}
            locale={locale}
            pageNumber={1}
            tabLayout={tabLayout}
          />
        );
        // 렌더링 완료 대기
        setTimeout(resolve, 500);
      });

      // 렌더링된 HTML을 새 창으로 복사
      const printRoot = tempDiv.querySelector('.print-root');
      if (printRoot) {
        container.innerHTML = printRoot.innerHTML;
      }

      // 임시 컨테이너 정리
      root.unmount();
      document.body.removeChild(tempDiv);

      // KaTeX 폰트 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 인쇄 다이얼로그 열기
      printWindow.print();

      // 인쇄 완료/취소 후 창 닫기
      printWindow.onafterprint = () => {
        printWindow.close();
      };

      // fallback: 일정 시간 후 상태 복원
      setTimeout(() => {
        setIsPrinting(false);
      }, 3000);

    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
      setIsPrinting(false);
    }
  }, [title, headerInfo, tabs, locale, tabLayout]);

  return (
    <button
      onClick={handlePrint}
      disabled={isPrinting}
      style={{
        padding: '8px 20px',
        backgroundColor: isPrinting ? '#ccc' : '#34a853',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: isPrinting ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {isPrinting ? (
        <>⏳ 준비 중...</>
      ) : (
        <>📄 {label}</>
      )}
    </button>
  );
}