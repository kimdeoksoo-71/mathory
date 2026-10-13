/**
 * Phase 70 §3-4 — IR → LaTeX(.tex, XeLaTeX · A4 1단).
 *
 * 범용 원고용이다(D10 — PDF·.typ는 현행 인쇄 규격, .tex는 A4 1단). Overleaf(xelatex)·로컬 TeX Live
 * 어디서든 컴파일되게 프리앰블은 표준 패키지만 쓴다.
 *
 * ⚠ import 0~1(layout) — 입력은 IR뿐이다. 그림 경로는 호출부(assets.ts)가 정한다(`figurePath`).
 * ⚠ 결정적 — 같은 IR이면 같은 바이트(`test:exportlatex`가 고정).
 * ⚠ 글꼴 이름: Overleaf에 깔린 이름은 "Noto Serif CJK KR"이다(Google Fonts판 "Noto Serif KR"이 아니다, v2 E10).
 *   둘 다 없으면 TeX Live 기본 UnBatang으로 떨어진다.
 * ⚠ amsmath는 `[fleqn]`으로 **한 번만** 부른다 — 옵션 없이 한 번 더 부르면 Option clash(v2 E11).
 * 알고 두는 것: 코칭 아이콘(D31)·경우 dot(Q14)은 .tex에 없다 — PDF(Typst) 전용 장식이다.
 */

import { imageWidthPt, choiceColumns, PX_TO_PT, INDENT_EM } from './layout';
import type { ExportDoc, ExportBlock, Flow, Inline } from './ir';

export interface LatexOptions {
  /** 그림 id → zip 안 경로(`figures/fig-1.png`). 못 받은 그림은 null → 빈 상자 */
  figurePath: (id: string, variant: { gray: boolean }) => string | null;
}

/** 텍스트 이스케이프 — 수식 문자열에는 쓰지 않는다 */
export function escTex(s: string): string {
  return s.replace(/[\\{}#$%&_~^]/g, (c) => {
    switch (c) {
      case '\\': return '\\textbackslash{}';
      case '~': return '\\textasciitilde{}';
      case '^': return '\\textasciicircum{}';
      default: return '\\' + c;
    }
  });
}

/** D9 — 인라인 수식 `\displaystyle` 주입(덕수 원칙). 한 줄 `$$x$$`(textStyle)와 이미 붙은 것은 그대로 */
export function inlineMathTex(latex: string, textStyle?: boolean): string {
  const body = latex.trim();
  if (textStyle || body.startsWith('\\displaystyle')) return `$${body}$`;
  return `$\\displaystyle ${body}$`;
}

export const LATEX_PREAMBLE = [
  '% Mathory 내보내기 — XeLaTeX(Overleaf: Compiler = XeLaTeX)',
  '\\documentclass[10pt,a4paper]{article}',
  '\\usepackage[margin=20mm]{geometry}',
  '\\usepackage{kotex}',
  '\\usepackage[fleqn]{amsmath}',
  '\\usepackage{amssymb,graphicx,framed,tabularx,changepage,array}',
  '\\setlength{\\mathindent}{2em}',
  '\\IfFontExistsTF{Noto Serif CJK KR}{\\setmainfont{Noto Serif CJK KR}\\setmainhangulfont{Noto Serif CJK KR}}',
  '  {\\IfFontExistsTF{Noto Serif KR}{\\setmainfont{Noto Serif KR}\\setmainhangulfont{Noto Serif KR}}',
  '  {\\setmainhangulfont{UnBatang}}}',
  '\\renewcommand{\\arraystretch}{1.3}',
  '\\setlength{\\parindent}{0pt}',
  '\\setlength{\\parskip}{6pt}',
  '\\setlength{\\FrameRule}{0.3mm}',
  '\\setlength{\\FrameSep}{6pt}',
  '\\renewenvironment{leftbar}{\\def\\FrameCommand{\\vrule width 0.3mm \\hspace{1em}}\\MakeFramed{\\advance\\hsize-\\width \\FrameRestore}}{\\endMakeFramed}',
].join('\n');

const PT = (n: number) => `${Math.round(n * 100) / 100}pt`;

class LatexWriter {
  constructor(private doc: ExportDoc, private opts: LatexOptions) {}

  document(): string {
    const parts: string[] = [LATEX_PREAMBLE, '', '\\begin{document}', '', `\\section*{${escTex(this.doc.title)}}`, ''];
    for (const tab of this.doc.tabs) {
      parts.push(`\\subsection*{${escTex(tab.label)}}`, '');
      for (const b of tab.blocks) {
        const s = this.block(b);
        if (s) parts.push(s, '');
      }
    }
    parts.push('\\end{document}', '');
    return parts.join('\n');
  }

  block(b: ExportBlock): string {
    switch (b.kind) {
      case 'para':
      case 'heading':
        return this.flows(b.body);
      case 'indent':
        return `\\begin{adjustwidth}{${INDENT_EM.callout}em}{0pt}\n${this.flows(b.body)}\n\\end{adjustwidth}`;
      case 'admonition':
        return `\\begin{leftbar}\n\\textbf{${escTex(b.label)}}\\par\n${this.flows(b.body)}\n\\end{leftbar}`;
      case 'case': {
        const head = b.title
          ? `\\noindent\\textbf{${b.label ? escTex(b.label) + '.\\ ' : ''}${this.inline(b.title)}}\\par`
          : '';
        return [head, this.flows(b.body)].filter(Boolean).join('\n\n');
      }
      case 'framed':
        return `\\begin{framed}\n${this.flows(b.body)}\n\\end{framed}`;
      case 'choices': {
        const cols = choiceColumns(b.items.length);
        const cells = b.items.map((it) => `${it.label}\\ ${this.inline(it.inline)}`);
        while (cells.length < cols) cells.push('');
        const rows: string[] = [];
        for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols).join(' & '));
        return `\\noindent\\begin{tabularx}{\\linewidth}{@{}*{${cols}}{X}@{}}\n${rows.join(' \\\\\n')}\n\\end{tabularx}`;
      }
      case 'figure':
        return this.figure(b);
    }
  }

  private figure(b: Extract<ExportBlock, { kind: 'figure' }>): string {
    if (b.variant === 'ggb') return this.placeholderBox('GeoGebra — 화면에서 확인');
    const path = b.ref ? this.opts.figurePath(b.ref, { gray: b.variant === 'image' && b.gray }) : null;
    if (!path) return this.placeholderBox('그림을 불러오지 못했습니다');
    if (b.variant === 'svg') {
      return `\\begin{center}\n\\includegraphics[height=${PT(b.heightPx * PX_TO_PT)},width=\\linewidth,keepaspectratio]{${path}}\n\\end{center}`;
    }
    const g = `\\includegraphics[width=${PT(imageWidthPt(b.widthPx, 'latex'))}]{${path}}`;
    return `\\begin{center}\n${b.frame ? `\\fbox{${g}}` : g}\n\\end{center}`;
  }

  private placeholderBox(text: string): string {
    return `\\begin{center}\n\\fbox{${escTex(text)}}\n\\end{center}`;
  }

  flows(fs: Flow[]): string {
    return fs.map((f) => this.flow(f)).filter(Boolean).join('\n\n');
  }

  flow(f: Flow): string {
    switch (f.t) {
      case 'p': {
        const text = this.inline(f.inline) + (f.tag ? `\\hfill\\mbox{${escTex(f.tag)}}` : '');
        if (!f.marker) return text;
        const m = `\\textbf{${escTex(f.marker.text)}}`;
        if (f.marker.kind === 'circled') {
          const w = INDENT_EM.circled; const left = INDENT_EM.circledRunLeft;
          return `\\noindent\\hangindent=${w + left}em\\hangafter=1\\hspace*{${left}em}\\makebox[${w}em][l]{${m}}${text}`;
        }
        const w = INDENT_EM.gana;
        return `\\noindent\\hangindent=${w}em\\hangafter=1\\makebox[${w}em][l]{${m}}${text}`;
      }
      case 'h': {
        const cmd = f.level >= 3 ? 'paragraph*' : 'subsubsection*';
        return `\\${cmd}{${this.inline(f.inline)}${f.tag ? `\\hfill\\mbox{${escTex(f.tag)}}` : ''}}`;
      }
      case 'display': {
        const body = f.rows
          ? `\\begin{array}{l}\n${f.rows.map((r) => `\\displaystyle ${r}`).join(' \\\\\n')}\n\\end{array}`
          : f.latex;
        return `\\begin{equation*}\n${body}${f.tag ? `\n\\tag*{${escTex(f.tag)}}` : ''}\n\\end{equation*}`;
      }
      case 'ul':
      case 'ol': {
        const env = f.t === 'ul' ? 'itemize' : 'enumerate';
        const start = f.t === 'ol' && f.start ? `\\setcounter{enumi}{${f.start - 1}}\n` : '';
        const items = f.items.map((it) => `\\item ${this.flows(it)}`).join('\n');
        return `\\begin{${env}}\n${start}${items}\n\\end{${env}}`;
      }
      case 'quote':
        return `\\begin{framed}\n${this.flows(f.body)}\n\\end{framed}`;
      case 'table': {
        const n = Math.max(f.head.length, ...f.rows.map((r) => r.length), 1);
        const spec = Array.from({ length: n }, (_, i) => ({ left: 'l', right: 'r' } as Record<string, string>)[f.align[i] ?? ''] ?? 'c');
        const row = (cells: Inline[][], bold: boolean) =>
          Array.from({ length: n }, (_, i) => {
            const c = cells[i] ? this.inline(cells[i]) : '';
            return bold && c ? `\\textbf{${c}}` : c;
          }).join(' & ') + ' \\\\ \\hline';
        return [
          '\\begin{center}',
          `\\begin{tabular}{|${spec.join('|')}|}`,
          '\\hline',
          row(f.head, true),
          ...f.rows.map((r) => row(r, false)),
          '\\end{tabular}',
          '\\end{center}',
        ].join('\n');
      }
      case 'hr':
        return '\\noindent\\rule{\\linewidth}{0.1mm}';
      case 'code':
        return `\\begin{verbatim}\n${f.text}\n\\end{verbatim}`;
      case 'placeholder':
        return this.placeholderBox('GeoGebra — 화면에서 확인');
    }
  }

  inline(xs: Inline[]): string {
    return xs.map((x) => {
      switch (x.t) {
        case 'text': return escTex(x.text);
        case 'math': return inlineMathTex(x.latex, x.textStyle);
        case 'strong': return `\\textbf{${this.inline(x.inline)}}`;
        case 'em': return `\\emph{${this.inline(x.inline)}}`;
        case 'code': return `\\texttt{${escTex(x.text)}}`;
        case 'br': return '\\newline ';
        case 'caseRef': return `\\textbf{${escTex(x.text)}}`;
        case 'img': {
          const path = this.opts.figurePath(x.ref, { gray: false });
          return path ? `\\par\\begin{center}\\includegraphics[width=${PT(imageWidthPt(x.widthPx, 'latex'))}]{${path}}\\end{center}\\par ` : '\\fbox{그림}';
        }
      }
    }).join('');
  }
}

export function serializeLatex(doc: ExportDoc, opts: LatexOptions): string {
  return new LatexWriter(doc, opts).document();
}
