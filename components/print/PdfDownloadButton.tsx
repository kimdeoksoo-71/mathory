'use client';

import { useState, useCallback } from 'react';
import PrintableContent, { PrintTab } from './PrintableContent';
import { Locale } from '../../lib/preprocess';

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
      const katexCssUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css';

      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(tempDiv);
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      await new Promise<void>((resolve) => {
        root.render(<PrintableContent title={title} tabs={tabs} locale={locale} />);
        setTimeout(resolve, 500);
      });
      const contentHtml = tempDiv.querySelector('.print-root')?.innerHTML || '';
      root.unmount();
      document.body.removeChild(tempDiv);

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc || !iframe.contentWindow) {
        document.body.removeChild(iframe);
        setIsPrinting(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<title>${title} - PDF</title>
<link rel="stylesheet" href="${katexCssUrl}" />
<style>
@page { size: 297mm 420mm; margin: 30mm 20mm; }
* { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; box-sizing:border-box; }
body { margin:0;padding:0;font-family:'Pretendard','Noto Sans KR','Apple SD Gothic Neo',sans-serif;font-size:12pt;line-height:1.75;color:#000; }
.print-body { column-count:2;column-gap:10mm;column-fill:auto; }
.print-tab-section { break-before:column; }
.print-tab-label { font-size:14pt;font-weight:700;margin:0 0 6pt;padding-bottom:3pt;border-bottom:0.15mm solid #999;margin-bottom:8pt;break-after:avoid; }
h1{font-size:16pt;font-weight:700;margin:0 0 6pt}h2{font-size:14pt;font-weight:700;margin:8pt 0 4pt}h3{font-size:12pt;font-weight:700;margin:6pt 0 3pt}
p{margin:0 0 6pt;text-align:justify;word-break:keep-all}
blockquote,.text-box{border:0.3mm solid #000;padding:6pt 8pt;margin:6pt 0;break-inside:avoid}
ol{margin:4pt 0;padding-left:24pt}ol li{margin-bottom:3pt;list-style-position:outside}
ul{margin:4pt 0;padding-left:14pt}ul li{margin-bottom:3pt}
img{max-width:100%;height:auto;break-inside:avoid}
hr{border:none;border-top:0.1mm solid #999;margin:8pt 0}
.katex-display{margin:8pt 0;break-inside:avoid}.katex-display.fleqn>.katex{padding-left:3em}.katex{font-size:1em}
table{border-collapse:collapse;width:100%;margin:6pt 0;font-size:10pt;break-inside:avoid}
th,td{border:0.2mm solid #000;padding:3pt 6pt;text-align:center}th{font-weight:700;background-color:#f5f5f5}
.tag-marker{float:right;font-size:0.95em}
.marker-gana,.marker-giyeok{display:inline-block;min-width:2.5em;font-weight:600;text-indent:0}
p:has(>.marker-gana:first-child),p:has(>.marker-giyeok:first-child){padding-left:2.5em;text-indent:-2.5em}
</style></head><body><div class="print-root">${contentHtml}</div></body></html>`);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 1500));
      iframe.contentWindow.print();
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
        setIsPrinting(false);
      }, 3000);
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