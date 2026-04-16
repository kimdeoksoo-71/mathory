import { Block } from '../types/problem';
import PrintableContent, { PrintTab } from '../components/print/PrintableContent';
import '../components/print/PrintStyles.css';

export interface PdfPrintTab {
  label: string;
  blocks: Array<{
    id: string;
    type: Block['type'];
    raw_text: string;
    imageWidth?: number;
  }>;
}

/**
 * 탭 배열을 받아 A3 2단 PDF로 인쇄. 파일명은 title로 지정 (부적합 문자 치환).
 * PrintableContent 컴포넌트를 숨겨진 컨테이너에 렌더 → DOM 이동 → window.print().
 */
export async function printProblemPdf(params: {
  title: string;
  tabs: PdfPrintTab[];
}): Promise<void> {
  const { title, tabs } = params;

  if (tabs.length === 0) {
    alert('출력할 탭을 하나 이상 선택해주세요.');
    return;
  }

  const { createRoot } = await import('react-dom/client');

  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(tempDiv);

  const root = createRoot(tempDiv);
  await new Promise<void>((resolve) => {
    root.render(
      <PrintableContent
        title={title || '수학 문제'}
        tabs={tabs as PrintTab[]}
        locale="ko"
      />
    );
    setTimeout(resolve, 500);
  });

  const printRoot = tempDiv.querySelector('.print-root');
  if (!printRoot) {
    root.unmount();
    document.body.removeChild(tempDiv);
    return;
  }
  const printNode = printRoot.cloneNode(true) as HTMLElement;
  printNode.classList.add('print-root');
  root.unmount();
  document.body.removeChild(tempDiv);
  document.body.appendChild(printNode);

  const origTitle = document.title;
  const rawName = (title || '').replace(/[\/\\:*?"<>|]/g, ' ').trim();
  document.title = rawName || '수학 문제';

  await new Promise((resolve) => setTimeout(resolve, 200));
  window.print();

  setTimeout(() => {
    try { document.body.removeChild(printNode); } catch {}
    document.title = origTitle;
  }, 1000);
}
