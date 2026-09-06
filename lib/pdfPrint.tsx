import { Block } from '../types/problem';
import PrintableContent, { PrintTab } from '../components/print/PrintableContent';
import '../components/print/PrintStyles.css';
import { alertDialog } from './dialogs';

export interface PdfPrintTab {
  /** 탭 id (question / solution / extra_N). Phase 58 P2 — 인쇄에서도 톤 스코프를
   *  판정해야 하는데 label만으로는 문제/풀이를 구분할 수 없어 신설했다. */
  id: string;
  label: string;
  blocks: Array<{
    id: string;
    type: Block['type'];
    raw_text: string;
    imageWidth?: number;
    imageTreatment?: 'frame';
    imageGray?: boolean;
    svg_initial_view?: { scale: number; positionX: number; positionY: number } | null;
    svg_height?: number;
    ggb_initial_coords?: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
    ggb_height?: number;
  }>;
}

/**
 * 인쇄 직전 웹폰트 대기.
 *
 * layout.tsx가 Noto Serif KR을 `display=swap`으로 받고 @font-face 'MathoryCircled'도
 * swap이라, 폰트가 도착하기 전에 window.print()가 스냅샷을 뜨면 굵기 요청(600/700)이
 * 폴백에 흡수돼 **제목·경우 라벨이 본문과 같은 굵기로 인쇄된다**. 새로고침 직후 인쇄하면
 * 재현되고, 같은 문항을 두 번 뽑아도 결과가 달라진다(Phase 60 T4 대조에서 제목 잉크가
 * 20% 넘게 차이났다 — 글자 폭은 픽셀 단위로 같은데 획 굵기만 달랐다).
 *
 * ⚠ 반드시 타임아웃을 건다 — 폰트 CDN이 죽었을 때 인쇄 자체가 막히면 안 된다.
 *   시간이 지나면 폴백 글꼴로라도 인쇄되는 편이 낫다.
 * ⚠ unicode-range 폰트('MathoryCircled' = ①~⑳)는 그 범위의 문자를 함께 넘겨야
 *   매칭된다 — 두 번째 인자 없이 부르면 아무것도 로드하지 않는다.
 */
async function waitForPrintFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  // --font-print 스택에서 실제로 쓰는 조합. 본문 400 · 제목/라벨/마커 600 · key 700.
  const faces = [
    document.fonts.load('400 10pt "Noto Serif KR"'),
    document.fonts.load('600 10pt "Noto Serif KR"'),
    document.fonts.load('700 10pt "Noto Serif KR"'),
    document.fonts.load('10pt "MathoryCircled"', '\u2460'),
  ].map((p) => p.catch(() => undefined));
  await Promise.race([
    Promise.all(faces).then(() => document.fonts.ready),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
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
    await alertDialog('출력할 탭을 하나 이상 선택해주세요.');
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

  // 폰트가 도착한 뒤에 스냅샷을 떠야 굵기가 제대로 인쇄된다 (위 주석 참조)
  await waitForPrintFonts();

  window.print();

  setTimeout(() => {
    try { document.body.removeChild(printNode); } catch {}
    document.title = origTitle;
  }, 1000);
}
