/**
 * Phase 70a — 내보내기 실행(브라우저): 파서 준비 → IR → 그림 수집 → 직렬화 → 파일·Overleaf.
 *
 * ⚠ ExportDialog가 **동적 import**한다(D18). 여기서 unified·remark·fflate·직렬화기를 끌어오므로
 *   이 파일을 정적 import하면 그것들이 진입 번들로 들어간다.
 * PDF(70b)는 Typst 컴파일(compile.ts — wasm·글꼴은 첫 PDF 때 한 번 받는다). 옛 CSS 인쇄(printProblemPdf)는 철거됐다.
 * ⚠ 다루는 탭은 다이얼로그가 넘긴 것(멤버 가시성 필터 뒤의 선택 탭)뿐이다(Q15).
 */

import type { ExportInput, ExportInputBlock, ParseFn } from './ir';

export type FileFormat = 'pdf' | 'tex' | 'typ' | 'overleaf';
export type { CompileStage } from './compile';

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

export async function runFileExport(
  format: FileFormat,
  src: ExportSource,
  opts: { overleafTarget?: string; onStage?: (s: import('./compile').CompileStage) => void } = {},
): Promise<ExportResult> {
  const [parse, ir, assets] = await Promise.all([getParser(), import('./ir'), import('./assets')]);
  const warnings: string[] = [];
  const input: ExportInput = { title: src.title, locale: 'ko', tabs: src.tabs };
  const doc = ir.buildExportDoc(input, { parse, warn: (m) => warnings.push(m) });
  if (warnings.length) console.warn('[Phase70 내보내기]', warnings);

  const target = format === 'typ' || format === 'pdf' ? 'typst' : 'latex';
  const figs = await assets.collectFigures(doc, target);
  const notices: string[] = [];
  if (figs.failed.length) {
    notices.push(`그림 ${figs.failed.length}개를 불러오지 못해 빈 상자로 넣었습니다.`);
    console.warn('[Phase70 내보내기] 그림 실패', figs.failed);
  }

  const base = assets.safeFileName(src.title);
  if (format === 'pdf') {
    const { compilePdf } = await import('./compile');
    const { pdf, failed } = await compilePdf(doc, figs, opts.onStage);
    if (failed.length) {
      const list = failed.slice(0, 3).map((f) => `· ${f.latex.replace(/^\\displaystyle\s*/, '').slice(0, 40)}`).join('\n');
      notices.push(`변환하지 못한 수식 ${failed.length}개를 원문(LaTeX)으로 넣었습니다.\n${list}${failed.length > 3 ? '\n…' : ''}`);
      console.warn('[Phase70 내보내기] 변환 실패 수식', failed);
    }
    assets.downloadFile(pdf, `${base}.pdf`, 'application/pdf');
    return { notices };
  }
  if (format === 'typ') {
    // D28 — 70b부터 .typ도 같은 점검을 거친다(한 번 조판해 실패 수식을 찾고, 그것만 원문 상자로)
    const [{ serializeTypst }, { compilePdf }] = await Promise.all([import('./typst'), import('./compile')]);
    const { failed } = await compilePdf(doc, figs, opts.onStage);
    if (failed.length) notices.push(`변환하지 못한 수식 ${failed.length}개를 원문(LaTeX) 상자로 넣었습니다.`);
    const { source } = serializeTypst(doc, { figurePath: figs.pathOf, failedMath: new Set(failed.map((f) => f.id)) });
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

/* ═══ Phase 71 — HWPX(단일·일괄 공용) ═══ */

export interface HwpxRunOptions {
  numbering: 'title' | 'sequential';
  placement: 'column' | 'endnote';
  /** 파일 이름(확장자 없이) — 단일은 문항 제목, 일괄은 폴더 이름 */
  fileName: string;
  onProgress?: (done: number, total: number) => void;
}

/**
 * 문항 N개 → `.hwpx` 하나. 탭은 **문제·풀이 둘만**(D18 — 다른 탭은 넘겨받아도 버린다).
 * ⚠ FileFormat·runFileExport에 넣지 않는다 — 그쪽은 pdf·typ 아니면 전부 latex 경로로 보낸다(run.ts 위).
 * 그림은 latex 집합으로 받는다(svg·gif·webp → png — 한글 그림 개체의 svg 지원은 미확인) · 이름은 전역 image{n}, 같은 URL·변형은 한 번.
 */
export async function runHwpxExport(sources: ExportSource[], opts: HwpxRunOptions): Promise<ExportResult> {
  const [parse, ir, assets, hw, { imageSize }] = await Promise.all([
    getParser(), import('./ir'), import('./assets'), import('./hwpx/hwpx'), import('./hwpx/imageSize'),
  ]);
  const warnings: string[] = [];
  const bins: import('./hwpx/package').BinItem[] = [];
  const binByKey = new Map<string, { bin: string; pxW: number; pxH: number } | null>();
  const hwpxSources: import('./hwpx/hwpx').HwpxSource[] = [];
  let failed = 0;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const tabs = src.tabs.filter((t) => t.id === 'question' || t.id === 'solution');
    const doc = ir.buildExportDoc({ title: src.title, locale: 'ko', tabs }, { parse, warn: (m) => warnings.push(m) });
    const figs = await assets.collectFigures(doc, 'latex');
    failed += figs.failed.length;
    const urlOf = new Map(doc.figures.map((f) => [f.id, f.url]));
    hwpxSources.push({
      doc,
      figure: (figId, gray) => {
        const key = `${urlOf.get(figId) ?? figId}|${gray ? 1 : 0}`;
        if (binByKey.has(key)) return binByKey.get(key) ?? null;
        const path = figs.pathOf(figId, { gray }) ?? (gray ? figs.pathOf(figId, { gray: false }) : null);
        const data = path ? figs.files[path] : undefined;
        const size = data ? imageSize(data) : null;
        if (!path || !data || !size) { binByKey.set(key, null); return null; }
        const bin = `image${bins.length + 1}`;
        bins.push({ id: bin, ext: /\.jpe?g$/i.test(path) ? 'jpg' : 'png', data });
        const hit = { bin, pxW: size.w, pxH: size.h };
        binByKey.set(key, hit);
        return hit;
      },
    });
    opts.onProgress?.(i + 1, sources.length);
  }
  if (warnings.length) console.warn('[Phase71 HWPX]', warnings);

  const { bytes, notices, warnings: hw2 } = hw.serializeHwpx({
    title: opts.fileName,
    sources: hwpxSources,
    bins,
    options: { numbering: opts.numbering, placement: opts.placement },
  });
  if (hw2.length) console.warn('[Phase71 HWPX]', hw2);
  if (failed) console.warn('[Phase71 HWPX] 그림 실패', failed);
  assets.downloadFile(bytes, `${assets.safeFileName(opts.fileName)}.hwpx`, 'application/hwp+zip');
  return { notices };
}
