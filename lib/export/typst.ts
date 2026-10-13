/**
 * Phase 70 §3-4 — IR → Typst(.typ). PDF(70b)의 소스이자 '추가 형식' 다운로드(D6).
 *
 * 규격은 현행 인쇄 그대로(D10 — A3 세로 · 상하 30 · 좌우 20mm · 2단 10mm · 10pt). Typst **0.14.2**
 * (= typst.ts 0.7.0)와 mitex **0.2.7 배포판**으로 검증한다(`test:exporttypst`가 실제로 컴파일한다).
 *
 * ⚠ import는 layout(상수) · phosphorPaths(코칭 아이콘 path, 생성 파일 · import 0)뿐 — 입력은 IR이다.
 * ⚠ 수식은 mitex에 **문자열 리터럴**로 넘긴다(D22 — raw 백틱은 3개부터 첫 낱말이 언어 태그로 먹힌다).
 * ⚠ mitex 미지원 명령 하나는 **문서 전체** 컴파일을 죽인다(v4 J3) — 실패한 수식 id를 `failedMath`로 받으면
 *   그 수식만 `math-fail`(원문 LaTeX 상자)로 낸다(D28). 어느 수식이 실패하는지는 compile.ts(70b)가 이분 탐색으로 찾는다.
 * ⚠ display 정렬은 set 규칙(D30) — `block(pad(align(left, it)))`는 가운데에 선다(v4 J1, 모양까지 확인).
 * ⚠ cases 안 깊이 0 `&` 앞에 `\quad`(D32) — Typst cases는 조건 열 앞 간격이 0이다.
 * ⚠ 결정적 — 같은 IR이면 같은 바이트.
 */

import {
  BODY_PT, TYPST_LEADING_EM, CSS_GAP_PT, typstGap, HEADING_PT, HEADING_WEIGHT, TAB_TITLE, tabTitle, INDENT_EM,
  STROKE_MM, FRAMED_INSET_MM, WEIGHT, CHOICES, TABLE, CIRCLED_SCALE, CASES_GAP_EM,
  SUNEUNG_PAGE, TRACKING_EM, WORD_SPACING_PCT, TYPST_TOP_EDGE, TYPST_BOTTOM_EDGE, imageWidthPt, PX_TO_PT, HEADING_ABOVE_EM,
} from './layout';
import type { ExportDoc, ExportBlock, Flow, Inline } from './ir';
import { PH } from '../../components/ui/phosphorPaths';

export interface TypstOptions {
  /** 그림 id → zip 안 경로. 못 받은 그림은 null → 빈 상자 */
  figurePath: (id: string, variant: { gray: boolean }) => string | null;
  /** D28 — 변환 실패로 판정된 수식 id(`m1`, `m2` … 직렬화 순서). 그 수식만 원문 상자로 낸다 */
  failedMath?: ReadonlySet<string>;
  /** mitex import 경로 — 다운로드용은 `@preview/mitex:0.2.7`, 테스트는 벤더링 경로를 넘긴다 */
  mitexImport?: string;
}

export interface MathFormula { id: string; latex: string; display: boolean }

const pt = (n: number) => `${Math.round(n * 100) / 100}pt`;
const gap = (cssPt: number) => pt(typstGap(cssPt));

/** Typst 문자열 리터럴 */
export function typStr(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, '\\t') + '"';
}

/** Typst 마크업 텍스트 이스케이프 — 마크업 기호·단축 표기(`--` `...` `-?`)·주석(`//` `/*`)·행머리 목록/제목을 전부 끊는다 */
export function escTyp(s: string): string {
  return s.replace(/[\\#$*_`<>@\[\]~/=\-+'"{}.:]/g, (c) => '\\' + c);
}

/** D9 — 인라인 `\displaystyle` 주입(덕수 원칙). 한 줄 `$$x$$`(textStyle)·이미 붙은 것은 그대로 */
function inlineLatex(latex: string, textStyle?: boolean): string {
  const body = latex.trim();
  if (textStyle || body.startsWith('\\displaystyle')) return body;
  return `\\displaystyle ${body}`;
}

/**
 * D32 — `cases`·`dcases`·`rcases`·`drcases` 안 **깊이 0** `&` 앞에 `\quad ` (LaTeX cases 열 간격 `@{}l@{\quad}l@{}`).
 * 중괄호 깊이와 중첩 환경(`\begin{aligned}` 등) 안의 `&`는 건드리지 않는다.
 */
export function quadCases(latex: string): string {
  const CASES = /^\\begin\{(d?r?cases)\}/;
  let out = '';
  // 스택: 'cases' 프레임은 { kind: 'cases', depth } / 다른 환경은 { kind: 'env' }
  const stack: { kind: 'cases' | 'env'; brace: number }[] = [];
  let brace = 0;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === '\\') {
      const rest = latex.slice(i);
      const begin = /^\\begin\{([^}]*)\}/.exec(rest);
      if (begin) {
        stack.push({ kind: CASES.test(rest) ? 'cases' : 'env', brace });
        out += begin[0]; i += begin[0].length - 1; continue;
      }
      const end = /^\\end\{[^}]*\}/.exec(rest);
      if (end) {
        stack.pop();
        out += end[0]; i += end[0].length - 1; continue;
      }
      out += ch + (latex[i + 1] ?? ''); i += 1; continue;   // `\&` · `\{` 등 이스케이프 통과
    }
    if (ch === '{') brace += 1;
    else if (ch === '}') brace -= 1;
    else if (ch === '&') {
      const top = stack[stack.length - 1];
      if (top && top.kind === 'cases' && top.brace === brace) { out += '\\quad &'; continue; }
    }
    out += ch;
  }
  return out;
}

/**
 * mitex 0.2.7이 모르는 환경 → 동치 환경 (Stage 0 실측: Mathory `ROW_ENVS` 29종 중 13종이 "unknown environment").
 * `test:exporttypst`가 ROW_ENVS 전부를 실제로 컴파일해 고정한다. ⚠ latex.ts는 무변경 — LaTeX(amsmath·mathtools)는 원래 안다.
 * 알고 두는 손실: dcases·drcases의 "칸마다 display 꼴"은 cases·rcases로 내려간다 · `*matrix*[r]`의 열 정렬 인수는 버린다.
 */
export function normalizeEnvsForMitex(latex: string): string {
  return latex
    .replace(/\\begin\{([pbvVB]?matrix)\*\}(\[[^\]]*\])?/g, '\\begin{$1}')
    .replace(/\\end\{([pbvVB]?matrix)\*\}/g, '\\end{$1}')
    // Vmatrix — mitex 0.2.7 구분자 처리 오류("expected exactly one character")
    .replace(/\\begin\{Vmatrix\}/g, '\\left\\| \\begin{matrix}')
    .replace(/\\end\{Vmatrix\}/g, '\\end{matrix} \\right\\|')
    .replace(/\\(begin|end)\{alignat\*?\}/g, '\\$1{alignedat}')
    .replace(/\\(begin|end)\{gather\*\}/g, '\\$1{gathered}')
    .replace(/\\(begin|end)\{darray\}/g, '\\$1{array}')
    .replace(/\\(begin|end)\{dcases\}/g, '\\$1{cases}')
    .replace(/\\(begin|end)\{drcases\}/g, '\\$1{rcases}');
}

/** 코칭 아이콘(D31) — Phosphor chat-centered-text(regular, viewBox 256) */
const COACH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="black" d="${PH.chatCenteredText}"/></svg>`;

function header(mitexImport: string): string {
  const p = SUNEUNG_PAGE;
  const b = p.pageBox;
  const paraGap = pt(typstGap(CSS_GAP_PT.paragraph));
  return [
    '// Mathory 내보내기 — Typst 0.14.2에서 검증 · 글꼴: Noto Serif KR(또는 Noto Serif CJK KR) · New Computer Modern Math',
    '// 쪽: 수능 시험지 양식(머리말·글상자·확인 사항·저작권 문구 제외 · 모든 쪽 같은 규격) — Phase 70c',
    `#import ${typStr(mitexImport)}: mitex, mi`,
    `#set page(paper: ${typStr(p.paper)}, columns: ${p.columns},`,
    `  margin: (left: ${p.sideMm}mm, right: ${p.sideMm}mm, top: ${p.bodyTopMm}mm, bottom: ${p.heightMm - p.bodyBottomMm}mm),`,
    `  header: place(bottom, line(length: 100%, stroke: ${p.ruleWMm}mm + black)),`,
    `  header-ascent: ${p.bodyTopMm - p.ruleYMm}mm,`,
    `  footer: context {`,
    `    let n = counter(page).get().first(); let t = counter(page).final().first()`,
    `    place(center + top, dy: ${b.dyMm}mm, box(width: ${b.wMm}mm, height: ${b.hMm}mm, stroke: ${b.strokeMm}mm + black, {`,
    `      place(line(start: (0mm, ${b.hMm}mm), end: (${b.wMm}mm, 0mm), stroke: ${b.strokeMm}mm + black))`,
    `      place(top + left, dx: ${b.padXMm}mm, dy: ${b.padYMm}mm, text(size: ${b.pt}pt, tracking: 0em, str(n)))`,
    `      place(bottom + right, dx: -${b.padXMm}mm, dy: -${b.padYMm}mm, text(size: ${b.pt}pt, tracking: 0em, str(t)))`,
    `    }))`,
    `  },`,
    `  footer-descent: 0mm,`,
    `  background: place(top + left, dx: 50%, dy: ${p.ruleYMm}mm, line(angle: 90deg, length: ${p.bodyBottomMm - p.ruleYMm}mm, stroke: ${p.colRuleWMm}mm + black)),`,
    `)`,
    `#set columns(gutter: ${p.gutterMm}mm)`,
    `#set text(font: ("Noto Serif KR", "Noto Serif CJK KR"), size: ${BODY_PT}pt, lang: "ko", region: "KR", tracking: ${TRACKING_EM}em, spacing: ${WORD_SPACING_PCT}%, top-edge: ${typStr(TYPST_TOP_EDGE)}, bottom-edge: ${typStr(TYPST_BOTTOM_EDGE)})`,
    `#set par(leading: ${TYPST_LEADING_EM}em, spacing: ${paraGap}, justify: false)`,
    `#set block(spacing: ${paraGap})`,
    '#set smartquote(enabled: false)',
    // D21 — 한글이 든 **어절 전체**(붙은 숫자·괄호·조사 포함)를 묶는다 = CSS keep-all. `[\p{Hangul}]+`만 묶으면 `[4점]`이 `[4`/`점]`으로 끊겼다(실측)
    '#show regex("[^\\s]*\\p{Hangul}[^\\s]*"): it => box(it)',
    `#show regex("[①-⑳]"): set text(size: ${CIRCLED_SCALE}em)`,
    '#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif KR"))',
    '#show math.equation.where(block: false): box',
    `#set math.cases(gap: ${CASES_GAP_EM}em)`,
    `#set math.mat(row-gap: ${CASES_GAP_EM}em)`,
    '#show math.equation.where(block: true): set align(left)',
    `#show math.equation.where(block: true): set block(above: ${gap(CSS_GAP_PT.display)}, below: ${gap(CSS_GAP_PT.display)})`,
    `#show math.equation.where(block: true): it => pad(left: ${INDENT_EM.display}em, it)`,
    `#show heading: set text(weight: ${HEADING_WEIGHT})`,
    `#show heading.where(level: 1): set text(size: ${HEADING_PT[1]}pt)`,
    `#show heading.where(level: 2): set text(size: ${HEADING_PT[2]}pt)`,
    `#show heading.where(level: 3): set text(size: ${HEADING_PT[3]}pt)`,
    `#let coach-icon = box(image(bytes(${typStr(COACH_SVG)}), format: "svg", height: 1.1em), baseline: 0.15em)`,
    `#let math-fail(src, block: false) = { let b = box(stroke: ${STROKE_MM.framed}mm, inset: (x: 2pt, y: 1pt), text(size: 0.85em, raw(src))); if block { pad(left: ${INDENT_EM.display}em, [⚠ #b]) } else { [⚠#b] } }`,
    `#let ph-box(label) = block(width: 100%, height: 3em, stroke: (paint: luma(150), thickness: 0.5pt, dash: "dashed"), align(center + horizon, text(fill: luma(90), label)))`,
    // 70c F — 1~3개 3열 · 4~5개 5열, 단 한 항목이라도 5열 칸을 넘으면 3열(3+2). 라벨·내용 2칸 grid 세로 가운데(D29)
    `#let choice-cell(l, c) = grid(columns: (auto, 1fr), column-gutter: ${CHOICES.labelGapEm}em, align: horizon, l, c)`,
    `#let choices(..ps) = layout(size => {`,
    `  let items = ps.pos()`,
    `  let g = ${CHOICES.columnGapPt}pt`,
    `  let w5 = (size.width - 4 * g) / 5`,
    `  let fits = items.all(p => measure(box[#p.at(0)#h(${CHOICES.labelGapEm}em)#p.at(1)]).width <= w5)`,
    `  let cols = if items.len() <= 3 { 3 } else if fits { 5 } else { 3 }`,
    `  grid(columns: (1fr,) * cols, column-gutter: g, row-gutter: ${CHOICES.rowGapEm}em, ..items.map(p => choice-cell(p.at(0), p.at(1))))`,
    `})`,
    '',
  ].join('\n');
}

class TypstWriter {
  private mathSeq = 0;
  readonly formulas: MathFormula[] = [];
  private tone: 'question' | 'solution' = 'question';
  constructor(private doc: ExportDoc, private opts: TypstOptions) {}

  document(): string {
    const parts: string[] = [header(this.opts.mitexImport ?? '@preview/mitex:0.2.7')];
    this.doc.tabs.forEach((tab, i) => {
      this.tone = tab.tone;
      if (i > 0) parts.push('#colbreak()');
      parts.push(
        `#block(below: ${TAB_TITLE.belowPt}pt)[#text(size: ${TAB_TITLE.pt}pt, weight: ${TAB_TITLE.weight})[${escTyp(tabTitle(tab.id, tab.label))}]]`,
        '',
      );
      for (const b of tab.blocks) {
        const s = this.block(b);
        if (s) parts.push(s, '');
      }
    });
    return parts.join('\n');
  }

  private nextMath(latex: string, display: boolean): { id: string; failed: boolean } {
    this.mathSeq += 1;
    const id = `m${this.mathSeq}`;
    this.formulas.push({ id, latex, display });
    return { id, failed: !!this.opts.failedMath?.has(id) };
  }

  /** 수식 하나 → mitex 호출(또는 실패 상자). 내용이 비면 null — mitex는 `\\displaystyle`뿐인 수식에서
   *  "cannot calculate sum of empty array"로 문서 전체를 죽인다(Stage 0 덤프 실측). 화면 KaTeX도 아무것도 안 그린다 */
  private mathCall(latex: string, display: boolean): string | null {
    if (!latex.replace(/\\displaystyle/g, '').trim()) return null;
    const src = quadCases(normalizeEnvsForMitex(latex));
    const { failed } = this.nextMath(src, display);
    // 상자에는 사용자가 쓴 원문만 — 우리가 주입한 앞머리 `\\displaystyle`(D9)은 뗀다
    const shown = latex.replace(/^\\displaystyle\s*/, '');
    if (failed) return display ? `math-fail(${typStr(shown)}, block: true)` : `math-fail(${typStr(shown)})`;
    return display ? `mitex(${typStr(src)})` : `mi(${typStr(src)})`;
  }

  block(b: ExportBlock): string {
    switch (b.kind) {
      case 'para':
        return this.flows(b.body);
      case 'heading':
        return (b.first ? '' : `#v(${HEADING_ABOVE_EM}em)\n`) + this.flows(b.body);
      case 'indent':
        return `#block(above: ${gap(CSS_GAP_PT.callout)}, below: ${gap(CSS_GAP_PT.callout)}, pad(left: ${INDENT_EM.callout}em)[\n${this.flows(b.body)}\n])`;
      case 'admonition':
        return `#block(width: 100%, stroke: (left: ${STROKE_MM.coachBar}mm), inset: (left: ${INDENT_EM.coach}em, y: 4pt), above: ${gap(CSS_GAP_PT.coach)}, below: ${gap(CSS_GAP_PT.coach)}, breakable: true)[\n#coach-icon #text(weight: ${WEIGHT.coachLabel})[${escTyp(b.label)}]\n\n${this.flows(b.body)}\n]`;
      case 'case': {
        const parts: string[] = [];
        if (b.title) {
          // 70c — 거터 dot 없음(가운데 괘선과 붙어 보였다 · layout.ts 주석). 번호 + 굵기만
          const label = b.label ? `${escTyp(b.label)}. ` : '';
          parts.push(`#text(weight: ${WEIGHT.caseTitle})[${label}${this.inline(b.title)}]`);
        }
        const body = this.flows(b.body);
        if (body) parts.push(body);
        return `#block(width: 100%, above: ${gap(CSS_GAP_PT.case)}, below: ${gap(CSS_GAP_PT.case)}, breakable: true)[\n${parts.join('\n\n')}\n]`;
      }
      case 'framed':
        return this.framed(this.flows(b.body), CSS_GAP_PT.framed);
      case 'choices': {
        const pairs = b.items.map((it) => `([${escTyp(it.label)}], [${this.inline(it.inline)}])`);
        return `#block(width: 100%, above: ${gap(CSS_GAP_PT.choices)}, below: ${gap(CSS_GAP_PT.choices)}, choices(${pairs.join(', ')}${pairs.length === 1 ? ',' : ''}))`;
      }
      case 'figure':
        return this.figure(b);
    }
  }

  private framed(body: string, cssGap: number): string {
    return `#block(width: 100%, stroke: ${STROKE_MM.framed}mm, inset: (x: ${FRAMED_INSET_MM.x}mm, y: ${FRAMED_INSET_MM.y}mm), above: ${gap(cssGap)}, below: ${gap(cssGap)}, breakable: true)[\n${body}\n]`;
  }

  private figure(b: Extract<ExportBlock, { kind: 'figure' }>): string {
    if (b.variant === 'ggb') return '#ph-box[GeoGebra — 화면에서 확인]';
    const path = b.ref ? this.opts.figurePath(b.ref, { gray: b.variant === 'image' && b.gray }) : null;
    if (!path) return '#ph-box[그림을 불러오지 못했습니다]';
    if (b.variant === 'svg') {
      return `#align(center, image(${typStr(path)}, width: 100%, height: ${pt(b.heightPx * PX_TO_PT)}, fit: "contain"))`;
    }
    const img = `image(${typStr(path)}, width: ${pt(imageWidthPt(b.widthPx, 'typst'))})`;
    return `#align(center, ${b.frame ? `box(stroke: 0.5pt, ${img})` : img})`;
  }

  flows(fs: Flow[]): string {
    return fs.map((f) => this.flow(f)).filter(Boolean).join('\n\n');
  }

  private tagged(content: string, tag?: string): string {
    if (!tag) return content;
    return `#grid(columns: (1fr, auto), align: (left + horizon, right + horizon), [${content}], [${escTyp(tag)}])`;
  }

  flow(f: Flow): string {
    switch (f.t) {
      case 'p': {
        const text = this.inline(f.inline);
        if (f.marker) {
          const circled = f.marker.kind === 'circled';
          const w = circled ? INDENT_EM.circled : INDENT_EM.gana;
          const g = `grid(columns: (${w}em, 1fr), [#text(weight: ${WEIGHT.marker})[${escTyp(f.marker.text)}]], [${f.tag ? this.tagged(text, f.tag) : text}])`;
          return circled ? `#pad(left: ${INDENT_EM.circledRunLeft}em, ${g})` : `#${g}`;
        }
        return this.tagged(text, f.tag);
      }
      case 'h': {
        const lv = Math.min(Math.max(f.level, 1), 3);
        const body = this.inline(f.inline) + (f.tag ? ` #h(1fr) ${escTyp(f.tag)}` : '');
        return `#heading(level: ${lv}, outlined: false)[${body}]`;
      }
      case 'display': {
        // 빈 행(`\\\\ \\\\`)은 `{}`로 — 행은 화면처럼 남기되 mitex의 빈 행 오류를 피한다(Stage 0 덤프 실측)
        const latex = f.rows ? `\\begin{array}{l}${f.rows.map((r) => `\\displaystyle ${r.trim() || '{}'}`).join(' \\\\ ')}\\end{array}` : f.latex;
        const m = this.mathCall(latex, true);
        if (!m) return f.tag ? this.tagged('', f.tag) : '';
        const call = `#${m}`;
        return f.tag ? this.tagged(call, f.tag) : call;
      }
      case 'ul':
      case 'ol': {
        const items = f.items.map((it) => `[${this.flows(it)}]`).join(', ');
        if (f.t === 'ul') return `#list(marker: ([•], [◦]), indent: 1em, body-indent: 0.4em, ${items})`;
        return `#enum(${f.start ? `start: ${f.start}, ` : ''}indent: 0.6em, ${items})`;
      }
      case 'quote':
        return this.framed(this.flows(f.body), CSS_GAP_PT.paragraph);
      case 'table': {
        const n = Math.max(f.head.length, ...f.rows.map((r) => r.length), 1);
        const align = Array.from({ length: n }, (_, i) => f.align[i] ?? 'center').join(', ');
        const cell = (c: Inline[] | undefined) => `[${c ? this.inline(c) : ''}]`;
        const head = Array.from({ length: n }, (_, i) => `table.cell(fill: rgb(${typStr(TABLE.headFill)}))[#text(weight: ${TABLE.headWeight})${cell(f.head[i])}]`).join(', ');
        const body = f.rows.map((r) => Array.from({ length: n }, (_, i) => cell(r[i])).join(', ')).join(',\n  ');
        return `#block(width: 100%, above: ${gap(CSS_GAP_PT.table)}, below: ${gap(CSS_GAP_PT.table)}, align(center, text(size: ${TABLE.pt}pt, table(columns: ${n}, align: (${align}${n === 1 ? ',' : ''}), stroke: ${STROKE_MM.tableCell}mm, inset: (x: ${TABLE.padXPt}pt, y: ${TABLE.padYPt}pt),\n  table.header(${head}),\n  ${body}${body ? ',' : ''}\n))))`;
      }
      case 'hr':
        return `#line(length: 100%, stroke: ${STROKE_MM.hr}mm + rgb("#999999"))`;
      case 'code':
        return `#raw(block: true, ${typStr(f.text)}${f.lang ? `, lang: ${typStr(f.lang)}` : ''})`;
      case 'placeholder':
        return '#ph-box[그래프 — 화면에서 확인]';
    }
  }

  inline(xs: Inline[]): string {
    return xs.map((x) => {
      switch (x.t) {
        case 'text': return escTyp(x.text);
        // ⚠ 인라인 `#식` 끝의 `;`는 식을 닫는다 — 없으면 뒤 글자 `(가)`·`[`·`.`을 Typst가 호출·인자·필드로 이어 읽는다
        case 'math': { const m = this.mathCall(inlineLatex(x.latex, x.textStyle), false); return m ? `#${m};` : ''; }
        case 'strong': return `#strong[${this.inline(x.inline)}];`;
        case 'em': return `#emph[${this.inline(x.inline)}];`;
        case 'code': return `#raw(${typStr(x.text)});`;
        case 'br': return '#linebreak();';
        case 'caseRef': return `#text(weight: ${WEIGHT.caseRef})[${escTyp(x.text)}];`;
        case 'img': {
          const path = this.opts.figurePath(x.ref, { gray: false });
          return path ? `#box(image(${typStr(path)}, width: ${pt(imageWidthPt(x.widthPx ?? null, 'typst'))}));` : '#box[⚠그림];';
        }
      }
    }).join('');
  }
}

export function serializeTypst(doc: ExportDoc, opts: TypstOptions): { source: string; formulas: MathFormula[] } {
  const w = new TypstWriter(doc, opts);
  const source = w.document();
  return { source, formulas: w.formulas };
}
