/**
 * Phase 70a — 내보내기 실행(브라우저): 파서 준비 → IR → 그림 수집 → 직렬화 → 파일·Overleaf.
 *
 * ⚠ ExportDialog가 **동적 import**한다(D18). 여기서 unified·remark·fflate·직렬화기를 끌어오므로
 *   이 파일을 정적 import하면 그것들이 진입 번들로 들어간다.
 * ⚠ PDF는 70a 동안 기존 CSS 인쇄(`printProblemPdf`)이고 70b에서 Typst 컴파일로 바뀐다 — 이 파일은 .tex·.typ·Overleaf만.
 * ⚠ 다루는 탭은 다이얼로그가 넘긴 것(멤버 가시성 필터 뒤의 선택 탭)뿐이다(Q15).
 */

import type { ExportInput, ExportInputBlock, ParseFn } from './ir';

export type FileFormat = 'tex' | 'typ' | 'overleaf';

export interface ExportSource {
  title: string;
  tabs: { id: string; label: string; blocks: ExportInputBlock[] }[];
}

export interface ExportResult {
  /** 사용자에게 보일 안내(그림 실패 등) */
  notices: string[];
}

let parserPromise: Promise<ParseFn> | null = null;

/** 렌더와 같은 파서(D7′) — 한 번만 만든다 */
function getParser(): Promise<ParseFn> {
  if (!parserPromise) {
    parserPromise = (async () => {
      const [{ unified }, remarkParse, remarkMath, remarkGfm] = await Promise.all([
        import('unified'),
        import('remark-parse').then((m) => m.default),
        import('remark-math').then((m) => m.default),
        import('remark-gfm').then((m) => m.default),
      ]);
      const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);
      return (md: string) => processor.parse(md) as unknown as ReturnType<ParseFn>;
    })();
  }
  return parserPromise;
}

export async function runFileExport(format: FileFormat, src: ExportSource, opts: { overleafTarget?: string } = {}): Promise<ExportResult> {
  const [parse, ir, assets] = await Promise.all([getParser(), import('./ir'), import('./assets')]);
  const warnings: string[] = [];
  const input: ExportInput = { title: src.title, locale: 'ko', tabs: src.tabs };
  const doc = ir.buildExportDoc(input, { parse, warn: (m) => warnings.push(m) });
  if (warnings.length) console.warn('[Phase70 내보내기]', warnings);

  const target = format === 'typ' ? 'typst' : 'latex';
  const figs = await assets.collectFigures(doc, target);
  const notices: string[] = [];
  if (figs.failed.length) {
    notices.push(`그림 ${figs.failed.length}개를 불러오지 못해 빈 상자로 넣었습니다.`);
    console.warn('[Phase70 내보내기] 그림 실패', figs.failed);
  }

  const base = assets.safeFileName(src.title);
  if (format === 'typ') {
    const { serializeTypst } = await import('./typst');
    const { source } = serializeTypst(doc, { figurePath: figs.pathOf });
    if (Object.keys(figs.files).length === 0) assets.downloadFile(source, `${base}.typ`, 'text/plain;charset=utf-8');
    else assets.downloadFile(assets.zipFiles({ 'main.typ': source, ...figs.files }), `${base}.zip`, 'application/zip');
    return { notices };
  }

  const { serializeLatex } = await import('./latex');
  const tex = serializeLatex(doc, { figurePath: figs.pathOf });
  if (format === 'tex') {
    if (Object.keys(figs.files).length === 0) assets.downloadFile(tex, `${base}.tex`, 'application/x-tex;charset=utf-8');
    else assets.downloadFile(assets.zipFiles({ 'main.tex': tex, ...figs.files }), `${base}.zip`, 'application/zip');
    return { notices };
  }

  const { openInOverleaf } = await import('./overleaf');
  openInOverleaf(assets.zipFiles({ 'main.tex': tex, ...figs.files }), opts.overleafTarget);
  return { notices };
}
