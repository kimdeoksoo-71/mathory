'use client';

import { useState, useCallback } from 'react';
import PrintableContent, { PrintTab } from './PrintableContent';
import { Locale } from '../../lib/preprocess';
import './PrintStyles.css';

interface PdfDownloadButtonProps {
  title: string;
  tabs: PrintTab[];
  locale?: Locale;
  label?: string;
}

export default function PdfDownloadButton({
  title, tabs, locale = 'ko', label = 'PDF 다운로드',
}: PdfDownloadButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      // 1. 인쇄용 콘텐츠를 임시 div에 렌더링
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(tempDiv);
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      await new Promise<void>((resolve) => {
        root.render(<PrintableContent title={title} tabs={tabs} locale={locale} />);
        setTimeout(resolve, 500);
      });

      // 2. 렌더링된 print-root를 메인 DOM body에 직접 추가
      const printRoot = tempDiv.querySelector('.print-root');
      if (!printRoot) {
        root.unmount();
        document.body.removeChild(tempDiv);
        setIsPrinting(false);
        return;
      }
      const printNode = printRoot.cloneNode(true) as HTMLElement;
      printNode.classList.add('print-root');
      document.body.appendChild(printNode);

      // 임시 div 제거
      root.unmount();
      document.body.removeChild(tempDiv);

      // 3. 메인 페이지에서 인쇄 (폰트 이미 로드됨, @media print CSS 적용)
      await new Promise(resolve => setTimeout(resolve, 200));
      window.print();

      // 4. 인쇄 후 정리
      setTimeout(() => {
        try { document.body.removeChild(printNode); } catch {}
        setIsPrinting(false);
      }, 1000);
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
      setIsPrinting(false);
    }
  }, [title, tabs, locale]);

  return (
    <button onClick={handlePrint} disabled={isPrinting} style={{
      padding: '8px 20px', backgroundColor: isPrinting ? '#ccc' : '#34a853',
      color: '#fff', border: 'none', borderRadius: '6px',
      cursor: isPrinting ? 'not-allowed' : 'pointer',
      fontSize: '14px', fontWeight: 'bold',
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      {isPrinting ? <>⏳ 준비 중...</> : <>📄 {label}</>}
    </button>
  );
}
