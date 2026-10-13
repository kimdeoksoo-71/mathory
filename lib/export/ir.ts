/**
 * Phase 70 §3-3 — 문항 → ExportDoc(IR).
 *
 * 블록마다 `prepareMarkdown`(구조 전처리) → **주입된 파서**(렌더와 같은 remark-parse + remark-math +
 * remark-gfm) → mdast → IR. 직렬화기(latex.ts·typst.ts·장래 HWPX)는 IR만 본다.
 *
 * ⚠ 파서를 정적 import하지 않는다(D7′) — 브라우저는 ExportDialog의 동적 import 안에서, 테스트는 .mjs에서
 *   `unified().use(remarkParse).use(remarkMath).use(remarkGfm)`을 만들어 `{ parse }`로 넘긴다.
 *   그래서 이 파일은 mdast 타입도 최소 모양만 스스로 정의한다.
 * ⚠ IR의 수식은 LaTeX 문자열 그대로다(D8′). `\displaystyle` 주입(D9)·`\quad`(D32)는 직렬화기 몫.
 * ⚠ `\tag`는 반드시 여기서 뗀다 — mitex는 `\tag`를 조용히 버린다(v2 부록 C t3).
 */

import { kindOf } from './blockKinds';
import { prepareMarkdown, TAG_MARK_RE, type ExportLocale } from './prepare';
import { IMAGE_DEFAULT_PX, SVG_DEFAULT_HEIGHT_PX } from './layout';
import { GANA_LITERAL_RE, GIYEOK_LITERAL_RE, CIRCLED_NUM_LINE_RE } from '../locale';
import { buildCaseLabels, blockKeyOf, splitCaseTitle, CASE_REF_RE } from '../caseBlock';
import { COACH_LABELS } from '../coachBlock';
import { isToneScoped } from '../keyTone';

/* ═══ mdast 최소 모양 (unified/mdast 타입을 import하지 않는다) ═══ */

export interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  depth?: number;
  ordered?: boolean | null;
  start?: number | null;
  lang?: string | null;
  align?: (string | null)[] | null;
  url?: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
}
export type ParseFn = (markdown: string) => MdNode;

/* ═══ IR ═══ */

export interface ExportDoc {
  title: string;
  locale: ExportLocale;
  tabs: ExportTab[];
  /** 그림 자산 — 같은 URL은 한 번. 확장자·경로는 수집 단계(assets.ts)가 매직 바이트로 정한다 */
  figures: FigureRef[];
}
export interface ExportTab {
  id: string;
  label: string;
  /** 풀이 계열 탭이면 strong 700(인쇄 `.solution-tone strong`) — isToneScoped(id) */
  tone: 'question' | 'solution';
  blocks: ExportBlock[];
}
export interface FigureRef { id: string; url: string }

export type ExportBlock =
  | { kind: 'para' | 'indent'; body: Flow[] }
  | { kind: 'heading'; first: boolean; body: Flow[] }
  | { kind: 'admonition'; variant: 'tip'; label: string; body: Flow[] }
  | { kind: 'case'; variant: 'top' | 'sub'; label: string | null; title: Inline[] | null; body: Flow[] }
  | { kind: 'framed'; variant: 'gana' | 'roman' | 'plain'; body: Flow[] }
  | { kind: 'choices'; items: { label: string; inline: Inline[] }[] }
  | { kind: 'figure'; variant: 'image'; ref: string | null; widthPx: number; frame: boolean; gray: boolean }
  | { kind: 'figure'; variant: 'svg'; ref: string | null; heightPx: number }
  | { kind: 'figure'; variant: 'ggb' };

export type Marker = { kind: 'gana' | 'giyeok' | 'circled'; text: string };

export type Flow =
  | { t: 'p'; marker?: Marker; inline: Inline[]; tag?: string }
  | { t: 'h'; level: number; inline: Inline[]; tag?: string }
  | { t: 'display'; latex: string; tag?: string; rows?: string[] }
  | { t: 'ul' | 'ol'; start?: number; items: Flow[][] }
  | { t: 'quote'; body: Flow[] }
  | { t: 'table'; align: ('left' | 'center' | 'right' | null)[]; head: Inline[][]; rows: Inline[][][] }
  | { t: 'hr' }
  | { t: 'code'; text: string; lang?: string }
  | { t: 'placeholder'; what: 'graph' };

export type Inline =
  | { t: 'text'; text: string }
  /** textStyle = 한 줄 `$$x$$`(화면에서 인라인이고 `\displaystyle` 주입도 받지 않는다 — preprocessMath의 인라인 정규식이 `$$`를 제외) */
  | { t: 'math'; latex: string; textStyle?: true }
  | { t: 'strong' | 'em'; inline: Inline[] }
  | { t: 'code'; text: string }
  | { t: 'br' }
  | { t: 'caseRef'; text: string }
  | { t: 'img'; ref: string; widthPx?: number };   // widthPx = <img width="N"> 속성(없으면 직렬화기 기본값)

export interface ExportInputBlock {
  id: string;
  type: string;
  raw_text: string;
  block_key?: string;
  imageWidth?: number;
  imageTreatment?: 'frame';
  imageGray?: boolean;
  svg_height?: number;
}
export interface ExportInput {
  title: string;
  locale?: ExportLocale;
  tabs: { id: string; label: string; blocks: ExportInputBlock[] }[];
}
export interface BuildOptions {
  parse: ParseFn;
  /** 같은 문구는 한 번만 부른다 */
  warn?: (message: string) => void;
}

/* ═══ 빌더 ═══ */

const ROW_BREAK_RE = /\\\\(?:\s*\[[^\]]*\])?/;
const HAS_LINE_BREAK_RE = /\\\\(?![a-zA-Z])/;          // preprocessMath와 같은 판정
const HAS_ENV_RE = /\\begin\s*\{/;
const DISPLAY_TAG_RE = /\\tag(\*?)\s*\{([^{}]*)\}/g;     // replace 전용(/g) — .test()에는 HAS_TAG_RE
const HAS_TAG_RE = /\\tag\*?\s*\{[^{}]*\}/;
const MATH_REF_RE = /\\ref\{(\d+)\}/g;
const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*"([^"]+)"[^>]*>/gi;
const BR_RE = /^<br\s*\/?>$/i;

class Builder {
  private figures = new Map<string, FigureRef>();
  private warned = new Set<string>();
  constructor(private opts: BuildOptions, private locale: ExportLocale) {}

  warn(msg: string): void {
    if (this.warned.has(msg)) return;
    this.warned.add(msg);
    this.opts.warn?.(msg);
  }

  figureList(): FigureRef[] {
    return [...this.figures.values()];
  }

  registerFigure(url: string): string {
    const hit = this.figures.get(url);
    if (hit) return hit.id;
    const ref: FigureRef = { id: `fig-${this.figures.size + 1}`, url };
    this.figures.set(url, ref);
    return ref.id;
  }

  /** raw 마크다운 → mdast 루트 자식 + 원문(textStyle 판정용) */
  parse(raw: string): { nodes: MdNode[]; src: string } {
    const src = prepareMarkdown(raw, this.locale);
    const root = this.opts.parse(src);
    return { nodes: root.children ?? [], src };
  }

  flows(raw: string): Flow[] {
    const { nodes, src } = this.parse(raw);
    return this.flowOf(nodes, src);
  }

  /** 짧은 조각(경우 제목행·선택지 내용) → 인라인. 문단이 여럿이면 줄바꿈으로 잇는다 */
  inlineOf(raw: string): Inline[] {
    const { nodes, src } = this.parse(raw);
    const out: Inline[] = [];
    for (const f of this.flowOf(nodes, src)) {
      const part: Inline[] =
        f.t === 'p' ? [...(f.marker ? [{ t: 'text', text: f.marker.text + ' ' } as Inline] : []), ...f.inline]
          : f.t === 'h' ? f.inline
          : f.t === 'display' ? [{ t: 'math', latex: f.rows ? f.rows.join(' \\\\ ') : f.latex }]
            : [];
      if (part.length === 0) continue;
      if (out.length) out.push({ t: 'br' });
      out.push(...part);
    }
    return out;
  }

  flowOf(nodes: MdNode[], src: string): Flow[] {
    const out: Flow[] = [];
    for (const n of nodes) {
      const f = this.flowNode(n, src);
      if (f) out.push(f);
    }
    return out;
  }

  private flowNode(n: MdNode, src: string): Flow | null {
    switch (n.type) {
      case 'paragraph':
        return this.paragraph(this.inlinesOf(n.children ?? [], src));
      case 'heading': {
        const { inline, tag } = this.takeTag(this.inlinesOf(n.children ?? [], src));
        return { t: 'h', level: Math.min(Math.max(n.depth ?? 2, 1), 3), inline, ...(tag ? { tag } : {}) };
      }
      case 'math':
        return this.display(n.value ?? '');
      case 'list':
        return {
          t: n.ordered ? 'ol' : 'ul',
          ...(n.ordered && typeof n.start === 'number' && n.start !== 1 ? { start: n.start } : {}),
          items: (n.children ?? []).map((li) => this.flowOf(li.children ?? [], src)),
        };
      case 'blockquote':
        return { t: 'quote', body: this.flowOf(n.children ?? [], src) };
      case 'table': {
        const rows = (n.children ?? []).map((tr) => (tr.children ?? []).map((td) => this.untag(this.inlinesOf(td.children ?? [], src))));
        const align = (n.align ?? []).map((a) => (a === 'left' || a === 'center' || a === 'right' ? a : null));
        return { t: 'table', align, head: rows[0] ?? [], rows: rows.slice(1) };
      }
      case 'thematicBreak':
        return { t: 'hr' };
      case 'code':
        if (n.lang === 'mathory-graph') return { t: 'placeholder', what: 'graph' };
        return { t: 'code', text: n.value ?? '', ...(n.lang ? { lang: n.lang } : {}) };
      case 'html':
        return this.blockHtml(n.value ?? '');
      default:
        this.warn(`내보내기에서 처리하지 않는 마크다운 요소: ${n.type}`);
        return null;
    }
  }

  private paragraph(raw: Inline[]): Flow | null {
    const { inline: tagged, tag } = this.takeTag(raw);
    const { inline, marker } = this.takeMarker(tagged);
    if (inline.length === 0 && !marker && !tag) return null;
    return { t: 'p', inline, ...(marker ? { marker } : {}), ...(tag ? { tag } : {}) };
  }

  /** 문단의 ⟦TAG:(n)⟧ 표지 → tag 속성(여럿이면 마지막 — 화면은 같은 자리에 겹쳐 그린다) */
  private takeTag(inline: Inline[]): { inline: Inline[]; tag?: string } {
    let tag: string | undefined;
    let count = 0;
    const out: Inline[] = [];
    for (const it of inline) {
      if (it.t !== 'text') { out.push(it); continue; }
      const text = it.text.replace(TAG_MARK_RE, (_, x: string) => { tag = x; count += 1; return ''; });
      if (text) out.push({ t: 'text', text });
    }
    if (count > 1) this.warn('한 문단에 행 끝 \\tag가 둘 이상 — 마지막 번호만 내보낸다');
    trimEnd(out);
    return tag ? { inline: out, tag } : { inline: out };
  }

  /** 표 칸 등 문단 속성이 없는 자리: 표지를 글자 "(n)"으로 되돌린다 */
  private untag(inline: Inline[]): Inline[] {
    return inline.map((it) => (it.t === 'text' ? { t: 'text', text: it.text.replace(TAG_MARK_RE, (_, x: string) => x) } : it));
  }

  /** 문단 첫머리 `(가)`·`ㄱ.`·`①` 리터럴 → marker (비ASCII 공백 소비 규칙은 공유 정규식 그대로) */
  private takeMarker(inline: Inline[]): { inline: Inline[]; marker?: Marker } {
    const first = inline[0];
    if (!first || first.t !== 'text') return { inline };
    const tries: [RegExp, Marker['kind'], (m: RegExpExecArray) => string][] = [
      [GANA_LITERAL_RE, 'gana', (m) => `(${m[2]})`],
      [GIYEOK_LITERAL_RE, 'giyeok', (m) => `${m[2]}.`],
      [CIRCLED_NUM_LINE_RE, 'circled', (m) => m[2]],
    ];
    for (const [re, kind, label] of tries) {
      const m = new RegExp(re.source).exec(first.text);
      if (!m) continue;
      const rest = first.text.slice(m[0].length);
      const tail = inline.slice(1);
      return { inline: rest ? [{ t: 'text', text: rest }, ...tail] : tail, marker: { kind, text: label(m) } };
    }
    return { inline };
  }

  private display(value: string): Flow {
    let tag: string | undefined;
    let tags = 0;
    let latex = value.replace(DISPLAY_TAG_RE, (_, star: string, x: string) => {
      tags += 1;
      if (tag === undefined) tag = star ? x : `(${x})`;
      return '';
    });
    if (tags > 1) this.warn('한 수식에 \\tag가 둘 이상 — 첫 번호만 내보낸다');
    latex = latex.replace(MATH_REF_RE, (_, n: string) => `\\text{(${n})}`).trim();
    const out: Flow = { t: 'display', latex, ...(tag !== undefined ? { tag } : {}) };
    if (HAS_LINE_BREAK_RE.test(latex) && !HAS_ENV_RE.test(latex)) {
      const rows = latex.split(ROW_BREAK_RE).map((r) => r.trim());
      while (rows.length > 1 && rows[rows.length - 1] === '') rows.pop();   // 꼬리 `\\` — 렌더도 뗀다
      if (rows.length > 1) return { ...out, rows };
    }
    return out;
  }

  private blockHtml(html: string): Flow | null {
    const inline = this.htmlInline(html, true);
    if (inline.length === 0) return null;
    return { t: 'p', inline };
  }

  /** html 조각: `<img src>` → 그림 · `<br>` → 줄바꿈 · 그 밖의 태그는 벗기고 글자만(조용한 소실 금지 — warn 1회) */
  private htmlInline(html: string, block: boolean): Inline[] {
    const trimmed = html.trim();
    if (BR_RE.test(trimmed)) return [{ t: 'br' }];
    const out: Inline[] = [];
    let last = 0;
    for (const m of trimmed.matchAll(IMG_SRC_RE)) {
      const before = stripTags(trimmed.slice(last, m.index));
      if (before.trim()) out.push({ t: 'text', text: before });
      const w = /\bwidth\s*=\s*"(\d+)"/i.exec(m[0]);
      out.push(w ? { t: 'img', ref: this.registerFigure(m[1]), widthPx: parseInt(w[1], 10) } : { t: 'img', ref: this.registerFigure(m[1]) });
      last = (m.index ?? 0) + m[0].length;
    }
    const rest = stripTags(trimmed.slice(last));
    if (/<[a-z/][^>]*>/i.test(trimmed.replace(IMG_SRC_RE, ''))) {
      this.warn('본문의 HTML 태그는 내보내기에서 벗기고 글자만 남긴다');
    }
    if (block ? rest.trim() : rest) out.push({ t: 'text', text: rest });
    return out;
  }

  inlinesOf(nodes: MdNode[], src: string): Inline[] {
    const out: Inline[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case 'text':
          out.push(...splitCaseRefs(n.value ?? ''));
          break;
        case 'inlineMath': {
          const at = n.position?.start.offset;
          const dbl = typeof at === 'number' && src.startsWith('$$', at);
          let latex = (n.value ?? '').replace(MATH_REF_RE, (_, k: string) => `\\text{(${k})}`);
          if (HAS_TAG_RE.test(latex)) {
            this.warn('인라인 수식 안의 \\tag는 내보내기에서 뺀다(화면 KaTeX도 거부한다)');
            latex = latex.replace(DISPLAY_TAG_RE, '');
          }
          out.push(dbl ? { t: 'math', latex, textStyle: true } : { t: 'math', latex });
          break;
        }
        case 'strong':
        case 'emphasis': {
          const inner = this.inlinesOf(n.children ?? [], src);
          if (inner.length) out.push({ t: n.type === 'strong' ? 'strong' : 'em', inline: inner });
          break;
        }
        case 'delete':
        case 'link':
          out.push(...this.inlinesOf(n.children ?? [], src));
          break;
        case 'inlineCode':
          out.push({ t: 'code', text: n.value ?? '' });
          break;
        case 'break':
          out.push({ t: 'br' });
          break;
        case 'image':
          if (n.url) out.push({ t: 'img', ref: this.registerFigure(n.url) });
          break;
        case 'html':
          out.push(...this.htmlInline(n.value ?? '', false));
          break;
        default:
          this.warn(`내보내기에서 처리하지 않는 인라인 요소: ${n.type}`);
      }
    }
    return mergeText(out);
  }

  block(b: ExportInputBlock, first: boolean, caseLabels: Map<string, string>): ExportBlock | null {
    const { entry, known } = kindOf(b.type);
    if (!known) this.warn(`알 수 없는 블록 종류 "${b.type}" — 본문으로 내보낸다`);
    const raw = b.raw_text ?? '';
    switch (entry.kind) {
      case 'para':
      case 'indent': {
        const body = this.flows(raw);
        return body.length ? { kind: entry.kind, body } : null;
      }
      case 'heading': {
        const body = this.flows(raw);
        return body.length ? { kind: 'heading', first, body } : null;
      }
      case 'admonition':
        return { kind: 'admonition', variant: 'tip', label: COACH_LABELS[b.type] ?? 'Tip', body: this.flows(raw) };
      case 'case': {
        const { title, body } = splitCaseTitle(raw);
        const label = title ? caseLabels.get(blockKeyOf(b)) ?? null : null;
        const t = title ? this.inlineOf(title) : null;
        const f = this.flows(body);
        if (!t && f.length === 0) return null;
        return { kind: 'case', variant: entry.variant === 'sub' ? 'sub' : 'top', label, title: t && t.length ? t : null, body: f };
      }
      case 'framed': {
        const body = this.flows(raw);
        const v = entry.variant === 'gana' || entry.variant === 'roman' ? entry.variant : 'plain';
        return body.length ? { kind: 'framed', variant: v, body } : null;
      }
      case 'choices': {
        const items = parseChoices(raw).map((c) => ({ label: c.label, inline: this.inlineOf(c.content) }));
        return items.length ? { kind: 'choices', items } : null;
      }
      case 'figure': {
        if (entry.variant === 'ggb') return { kind: 'figure', variant: 'ggb' };
        if (entry.variant === 'svg') {
          const url = raw.trim();
          return { kind: 'figure', variant: 'svg', ref: url ? this.registerFigure(url) : null, heightPx: b.svg_height && b.svg_height > 0 ? b.svg_height : SVG_DEFAULT_HEIGHT_PX };
        }
        const m = /src="([^"]+)"/.exec(raw);
        return {
          kind: 'figure', variant: 'image',
          ref: m ? this.registerFigure(m[1]) : null,
          widthPx: b.imageWidth && b.imageWidth > 0 ? b.imageWidth : IMAGE_DEFAULT_PX,
          frame: b.imageTreatment === 'frame',
          gray: !!b.imageGray,
        };
      }
    }
  }
}

/** 선택지 파싱 — `PrintChoicesBlock`과 같은 규칙(trim · `①~⑤` + 내용 · 빈 항목 건너뜀 · 최대 5) */
export function parseChoices(raw: string): { label: string; content: string }[] {
  const out: { label: string; content: string }[] = [];
  for (const line of String(raw ?? '').split('\n')) {
    const m = line.trim().match(/^([①②③④⑤])\s*(.*)$/);
    if (!m) continue;
    const c = m[2].trim();
    if (!c) continue;
    out.push({ label: m[1], content: c });
    if (out.length >= 5) break;
  }
  return out;
}

/** 본문 `C1`·`C2a` → caseRef(인쇄 600 — Q20). ⚠ CASE_REF_RE는 /g 상수 — source로 새 인스턴스를 만든다(v3 H7) */
function splitCaseRefs(text: string): Inline[] {
  const re = new RegExp(CASE_REF_RE.source, 'g');
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: 'text', text: text.slice(last, at) });
    out.push({ t: 'caseRef', text: m[0] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) });
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

function mergeText(inline: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const it of inline) {
    const prev = out[out.length - 1];
    if (it.t === 'text' && prev && prev.t === 'text') prev.text += it.text;
    else out.push(it.t === 'text' ? { t: 'text', text: it.text } : it);
  }
  return out.filter((it) => !(it.t === 'text' && it.text === ''));
}

function trimEnd(inline: Inline[]): void {
  const last = inline[inline.length - 1];
  if (last && last.t === 'text') {
    last.text = last.text.replace(/[ \t]+$/, '');
    if (!last.text) inline.pop();
  }
}

export function buildExportDoc(input: ExportInput, opts: BuildOptions): ExportDoc {
  const locale: ExportLocale = input.locale ?? 'ko';
  const b = new Builder(opts, locale);
  const tabs: ExportTab[] = input.tabs.map((tab) => {
    const caseLabels = buildCaseLabels(tab.blocks);
    const blocks: ExportBlock[] = [];
    tab.blocks.forEach((blk, i) => {
      const out = b.block(blk, i === 0, caseLabels);
      if (out) blocks.push(out);
    });
    return { id: tab.id, label: tab.label, tone: isToneScoped(tab.id) ? 'solution' : 'question', blocks };
  });
  return { title: input.title, locale, tabs, figures: b.figureList() };
}
