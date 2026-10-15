/**
 * Phase 71 — IR(ExportDoc[]) → .hwpx 바이트. 직렬화기 셋째 벌(typst·latex와 같은 IR을 본다).
 *
 * 매핑은 착수판 §3-3 표가 정본이다(문제 탭 / 풀이 탭 × kind × Flow × Inline). 요지:
 *   문제 탭 첫 문단 = 문제-본문(번호 런 + 탭 — 한 자리 탭 1 · 두 자리 탭 2 · 번호 없으면 탭만) · 나머지 문제-이음
 *   경우 = 해설-단계1/2(두 탭 공통 · `( i )` + 탭 · 굵게 없음) · 코칭 = 해설-Tip · 상자 = 글상자(상자-항목/상자-글)
 *   독립행 수식 = 문제-수식/해설-수식(어디서나) · 행 끝 `\tag`·`\ref` = `⋯⋯⋯ ㉠`(N8 — PDF는 `(n)` 그대로)
 *   옵션 A(column): 문항마다 쪽 나눔 → 문제 → 단 나눔 → 풀이 · 옵션 B(endnote): 문항마다 단 나눔 · 풀이는 미주
 * 문단 모양은 **스타일의 paraPr 그대로**, 런 글자 모양은 **스타일의 charPr(굵게·기울임은 그 변형)** — 덮어쓰기가 따라가게.
 * ⚠ 결정적 — 같은 입력이면 같은 바이트(id는 카운터 · zip mtime 고정).
 */
import type { ExportDoc, ExportBlock, Flow, Inline } from '../ir';
import { imageWidthPtForColumn } from '../layout';
import { STYLE_IDS, PAGE } from './skeleton/ids';
import * as SK from './skeleton/parts';
import type { StyleKey } from './styles';
import { HeaderBuilder, Ids, type Para, type Run, type Item } from './xml';
import { latexToHwp, splitDisplayRows, refMark, type HwpEqResult, type DisplaySplit } from './hwpEq';
import { caseLabelHwp } from './roman';
import { isLongChoices, type ChoicePiece } from './choices';
import { buildPackage, type BinItem } from './package';
import { hwpEqSize, hwpPad } from './hwpLayout';

export interface HwpxOptions {
  /** N14 — 제목 끝 번호(1~30) / 앞에서부터 1, 2, … */
  numbering: 'title' | 'sequential';
  /** T14 좌단·우단 / T15″ 미주 */
  placement: 'column' | 'endnote';
}

export interface HwpxFigure { bin: string; pxW: number; pxH: number }

export interface HwpxSource {
  doc: ExportDoc;
  /** 그림 id(문서 안) → BinData 항목. 못 받은 그림은 null */
  figure: (figId: string, gray: boolean) => HwpxFigure | null;
}

export interface HwpxInput {
  title: string;
  sources: HwpxSource[];
  bins: BinItem[];
  options: HwpxOptions;
}

export interface HwpxResult {
  bytes: Uint8Array;
  /** 사용자 안내(번호 인식 실패 · 미대응 수식 명령 · 그림 실패) */
  notices: string[];
  /** 개발자 경고(예약어 충돌 등) */
  warnings: string[];
}

/** HWPUNIT/mm */
const MM = 7200 / 25.4;
const DOTS = '⋯⋯⋯';
const PH_GGB = '[GeoGebra 그래프 — 화면에서 확인]';
const PH_FIG = '[그림을 불러오지 못했습니다]';

/** N14 — 제목 끝의 1~2자리 번호(끝의 '번' 허용) · 1~30만 */
export function problemNumber(title: string): number | null {
  const m = /(?:^|\D)(\d{1,2})\s*번?\s*$/.exec(title.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 30 ? n : null;
}

interface Ctx {
  tone: 'question' | 'solution';
  src: HwpxSource;
  /** 마커 없는 문단의 스타일 */
  place: StyleKey;
  /** 마커 문단의 스타일 · 구분자 */
  marker: StyleKey;
  markerSep: 'tab' | 'space';
  /** 라벨 없는 본문 문단 앞 탭(경우·들여쓰기 — N10) */
  lead: boolean;
  inBox: boolean;
  /** 열 안 사용 가능 폭(HWPUNIT) — 그림·표·글상자 */
  width: number;
}

const T = (s: string): Item => ({ k: 'text', s });
const TAB: Item = { k: 'tab' };

class Writer {
  readonly hb = new HeaderBuilder(SK.HEADER_XML);
  readonly ids = new Ids();
  readonly unknown = new Set<string>();
  readonly reserved = new Set<string>();
  missingFigures = 0;

  constructor(private opts: HwpxOptions) {}

  /**
   * 한글 수식 개체 — 크기는 **한글 규칙 모델**(hwpLayout.ts — 한글 실측 40개에 맞춘 상수)로 스크립트를 조판한 값.
   * ⚠ 한글 2022는 열 때 sz를 다시 재지 않는다. 남는 오차는 한글 스크립트 매크로(docs/hwp-macro)가 바로잡는다.
   */
  eqItem(script: string): Item {
    return { k: 'eq', script, size: hwpEqSize(script) };
  }

  /* ═══ 공통 ═══ */

  sid(key: StyleKey) { return STYLE_IDS[key]; }

  para(key: StyleKey, runs: Run[], extra: Partial<Para> = {}): Para {
    const s = this.sid(key);
    return { style: s.id, paraPr: s.paraPr, runs: runs.length ? runs : [{ charPr: s.charPr, items: [] }], ...extra };
  }

  /**
   * 여러 줄 수식 → 행마다 문단(문제-수식·해설-수식) 하나. 두 스타일은 왼쪽 맞춤이라 행 **앞**에 한글 수식 공백을 채워
   * `&` 자리(align)·행 가운데(center)를 맞춘다 — 폭은 hwpLayout 모델 값이라 근사다. 행 끝 번호는 마지막 행에.
   */
  displayRows(split: DisplaySplit, tag: string | undefined, key: StyleKey): Para[] {
    const conv = split.rows.map((r) => ({
      left: r.left.trim() ? this.eq(latexToHwp(r.left)) : '',
      right: r.right.trim() ? this.eq(latexToHwp(r.right)) : '',
    }));
    const width = (s: string) => (s.replace(/[{}\s]/g, '') ? hwpEqSize(s).w : 0);
    const lw = conv.map((c) => width(c.left));
    const rw = conv.map((c) => width(c.right));
    const maxL = Math.max(...lw);
    const maxR = Math.max(...rw);
    // 환경 앞 조각은 첫 행 앞에 · 나머지 행은 그 폭만큼 더 들인다 / 뒤 조각은 마지막 행 끝에
    const prefix = split.prefix ? this.eq(latexToHwp(split.prefix)) : '';
    const suffix = split.suffix ? this.eq(latexToHwp(split.suffix)) : '';
    const wP = width(prefix);
    const out: Para[] = [];
    conv.forEach((c, i) => {
      const inner = split.mode === 'align' ? maxL - lw[i] : split.mode === 'center' ? (maxR - rw[i]) / 2 : 0;
      const last = i === conv.length - 1;
      const body = [c.left, c.right, last ? suffix : ''].filter((x) => x.replace(/[{}\s]/g, '')).join(' ');
      if (!body) return;
      const lead = i === 0 ? [prefix, hwpPad(inner)] : [hwpPad(wP + inner)];
      let script = [...lead, body].filter(Boolean).join(' ');
      if (last && tag) script += ' cdots cdots cdots';
      const items: Item[] = [this.eqItem(script)];
      if (last && tag) items.push(T(` ${refMark(tag)}`));
      out.push(this.para(key, [{ charPr: this.sid(key).charPr, items }]));
    });
    if (tag && out.length && !conv[conv.length - 1].left && !conv[conv.length - 1].right) {
      out.push(this.para(key, this.tagRuns([], tag, key)));
    }
    return out;
  }

  eq(r: HwpEqResult): string {
    r.unknown.forEach((u) => this.unknown.add(u));
    r.reserved.forEach((u) => this.reserved.add(u));
    return r.script;
  }

  /** Inline → 런(같은 글자 모양끼리 합친다) */
  runs(xs: Inline[], key: StyleKey, ctx: Ctx, flags: { bold?: boolean; italic?: boolean } = {}): Run[] {
    const base = this.sid(key).charPr;
    const out: Run[] = [];
    const push = (charPr: number, it: Item) => {
      const last = out[out.length - 1];
      if (last && last.charPr === charPr && last.charStyle === undefined) last.items.push(it);
      else out.push({ charPr, items: [it] });
    };
    const walk = (list: Inline[], f: { bold?: boolean; italic?: boolean }) => {
      const cp = this.hb.charPr(base, f);
      for (const x of list) {
        switch (x.t) {
          case 'text': push(cp, T(x.text)); break;
          case 'code': push(cp, T(x.text)); break;
          case 'br': push(cp, { k: 'br' }); break;
          case 'caseRef': push(cp, T(caseLabelHwp(x.text) ?? x.text)); break;   // R10 — 굵게 없음
          case 'ref': push(cp, T(refMark(x.n))); break;                           // R2
          case 'math': {
            const s = this.eq(latexToHwp(x.latex));
            if (s) push(cp, this.eqItem(s));
            break;
          }
          case 'strong': walk(x.inline, { ...f, bold: true }); break;
          case 'em': walk(x.inline, { ...f, italic: true }); break;
          case 'img': {
            const pic = this.pic(ctx, x.ref, false, x.widthPx ?? null, null);
            push(cp, pic ?? T(PH_FIG));
            break;
          }
        }
      }
    };
    walk(xs, flags);
    return out;
  }

  /** 문단 끝에 `⋯⋯⋯ ㉠`(N8) */
  tagRuns(runs: Run[], tag: string | undefined, key: StyleKey): Run[] {
    if (!tag) return runs;
    const cp = this.sid(key).charPr;
    return [...runs, { charPr: cp, items: [T(` ${DOTS} ${refMark(tag)}`)] }];
  }

  /* ═══ 그림 ═══ */

  pic(ctx: Ctx, ref: string | null, gray: boolean, widthPx: number | null, heightPx: number | null): Item | null {
    if (!ref) { this.missingFigures++; return null; }
    const f = ctx.src.figure(ref, gray);
    if (!f || f.pxW <= 0 || f.pxH <= 0) { this.missingFigures++; return null; }
    const cap = Math.round(ctx.width * 0.9);
    let width: number;
    if (heightPx !== null) {
      // svg — 상자 높이(px) 기준
      width = Math.round((heightPx * 75 * f.pxW) / f.pxH);
    } else {
      width = Math.round(imageWidthPtForColumn(widthPx, ctx.width / MM) * 100);
    }
    width = Math.min(width, cap);
    const height = Math.round((width * f.pxH) / f.pxW);
    return { k: 'pic', bin: f.bin, pxW: f.pxW, pxH: f.pxH, width, height };
  }

  /* ═══ Flow ═══ */

  flows(fs: Flow[], ctx: Ctx): Para[] {
    return fs.flatMap((f) => this.flow(f, ctx));
  }

  eqKey(ctx: Ctx): StyleKey { return ctx.tone === 'question' ? 'MTQEq' : 'MTSEq'; }

  flow(f: Flow, ctx: Ctx, listDepth = 0): Para[] {
    switch (f.t) {
      case 'p': {
        if (f.marker) {
          const key = ctx.marker;
          const sep = ctx.markerSep === 'tab' ? TAB : T(' ');
          const runs = [{ charPr: this.sid(key).charPr, items: [T(f.marker.text), sep] }, ...this.runs(f.inline, key, ctx)];
          return [this.para(key, this.tagRuns(runs, f.tag, key))];
        }
        const key = ctx.place;
        const lead = ctx.lead ? [{ charPr: this.sid(key).charPr, items: [TAB] }] : [];
        return [this.para(key, this.tagRuns([...lead, ...this.runs(f.inline, key, ctx)], f.tag, key))];
      }
      case 'h': {
        if (ctx.tone === 'solution' && !ctx.inBox) return [this.para('MTSH1', this.tagRuns(this.runs(f.inline, 'MTSH1', ctx), f.tag, 'MTSH1'))];
        const key = ctx.place;
        return [this.para(key, this.tagRuns(this.runs(f.inline, key, ctx, { bold: true }), f.tag, key))];
      }
      case 'display': {
        const key = this.eqKey(ctx);
        // 여러 줄(맨 `\\` 행 · aligned·gathered 계열 환경 하나) → 행마다 수식 문단 하나(덕수 2026-10-15)
        const split: DisplaySplit | null = f.rows
          ? { mode: 'left', rows: f.rows.map((r) => ({ left: '', right: r })) }
          : splitDisplayRows(f.latex);
        if (split && split.rows.length > 1) return this.displayRows(split, f.tag, key);
        let script = this.eq(latexToHwp(f.latex));
        if (!script.replace(/[{}\s]/g, '')) return f.tag ? [this.para(key, this.tagRuns([], f.tag, key))] : [];
        if (f.tag) script += ` cdots cdots cdots`;
        const items: Item[] = [this.eqItem(script)];
        if (f.tag) items.push(T(` ${refMark(f.tag)}`));
        return [this.para(key, [{ charPr: this.sid(key).charPr, items }])];
      }
      case 'ul':
      case 'ol': {
        const out: Para[] = [];
        f.items.forEach((item, i) => {
          const bullet = f.t === 'ol' ? `${(f.start ?? 1) + i}.` : listDepth === 0 ? '•' : '◦';
          let key: StyleKey;
          let sep: Item;
          if (ctx.inBox) { key = 'MTBoxText'; sep = T(' '); }
          else if (ctx.tone === 'question') { key = 'MTQCont'; sep = T(' '); }
          else { key = listDepth === 0 && ctx.place !== 'MTSStep2' ? 'MTSStep1' : 'MTSStep2'; sep = TAB; }
          const inner: Ctx = { ...ctx, place: key, marker: key, lead: ctx.tone === 'solution' && !ctx.inBox };
          item.forEach((g, j) => {
            if (j === 0 && g.t === 'p') {
              const runs = [{ charPr: this.sid(key).charPr, items: [T(bullet), sep] }, ...this.runs(g.inline, key, inner)];
              out.push(this.para(key, this.tagRuns(runs, g.tag, key)));
            } else if (g.t === 'ul' || g.t === 'ol') {
              out.push(...this.flow(g, inner, listDepth + 1));
            } else {
              out.push(...this.flow(g, inner, listDepth));
            }
          });
        });
        return out;
      }
      case 'quote': {
        if (ctx.inBox) return this.flows(f.body, ctx);
        return [this.boxPara(f.body, ctx)];
      }
      case 'table': {
        const cols = Math.max(f.head.length, ...f.rows.map((r) => r.length), 1);
        const cap = Math.round(ctx.width * (ctx.inBox ? 0.85 : 0.9));
        const cellCtx: Ctx = { ...ctx, place: 'Normal', marker: 'Normal', lead: false, width: Math.floor(cap / cols) };
        const cell = (c: Inline[] | undefined, head: boolean) => [this.para('Normal', this.runs(c ?? [], 'Normal', cellCtx, head ? { bold: true } : {}))];
        const rows = [f.head.map((c) => cell(c, true)), ...f.rows.map((r) => Array.from({ length: cols }, (_, i) => cell(r[i], false)))];
        if (rows[0].length < cols) rows[0].push(...Array.from({ length: cols - rows[0].length }, () => cell([], true)));
        // 열 폭 = 그 열에서 가장 넓은 칸의 내용 + 셀 안쪽 여백(510 × 2) + 여유 — 단 폭 90%를 넘을 때만 비율대로 줄인다(덕수 2026-10-15)
        const need = Array.from({ length: cols }, (_, c) => Math.max(...rows.map((r) => paraWidth(r[c]?.[0])), 600) + 1020 + 400);
        const sum = need.reduce((x, y) => x + y, 0);
        const colWidths = sum > cap ? need.map((n) => Math.floor((n * cap) / sum)) : need;
        const tbl: Item = { k: 'tbl', rows, colWidths, outerFill: this.hb.borderFill('outer'), cellFill: this.hb.borderFill('cell'), headRows: 1 };
        const key = ctx.place;
        return [this.para(key, [{ charPr: this.sid(key).charPr, items: [tbl] }])];
      }
      case 'hr':
        return [this.para(ctx.tone === 'question' || ctx.inBox ? ctx.place : 'MTSBody', [])];
      case 'code': {
        const key = ctx.place;
        const items: Item[] = [];
        f.text.split('\n').forEach((line, i) => { if (i) items.push({ k: 'br' }); items.push(T(line)); });
        return [this.para(key, [{ charPr: this.sid(key).charPr, items }])];
      }
      case 'placeholder':
        return [this.para('MTFig', [{ charPr: this.sid('MTFig').charPr, items: [T(PH_GGB)] }])];
    }
  }

  /** 글상자 하나를 담은 문단(D3·D19) */
  boxPara(body: Flow[], ctx: Ctx): Para {
    const holder: StyleKey = ctx.tone === 'question' ? 'MTQCont' : 'MTSBody';
    const width = Math.round(ctx.width * 0.99);
    const inner: Ctx = { ...ctx, place: 'MTBoxText', marker: 'MTBoxItem', markerSep: 'tab', lead: false, inBox: true, width: width - 2 * 1133 };
    const paras = this.flows(body, inner);
    return this.para(holder, [{ charPr: this.sid(holder).charPr, items: [{ k: 'rect', width, paras: paras.length ? paras : [this.para('MTBoxText', [])] }] }]);
  }

  /* ═══ 블록 ═══ */

  block(b: ExportBlock, ctx: Ctx): Para[] {
    switch (b.kind) {
      case 'para':
        return this.flows(b.body, ctx);
      case 'heading':
        if (ctx.tone === 'solution') return b.body.flatMap((f) => (f.t === 'p' ? [this.para('MTSH1', this.tagRuns(this.runs(f.inline, 'MTSH1', ctx), f.tag, 'MTSH1'))] : this.flow(f, ctx)));
        return b.body.flatMap((f) => (f.t === 'p' ? [this.para('MTQCont', this.tagRuns(this.runs(f.inline, 'MTQCont', ctx, { bold: true }), f.tag, 'MTQCont'))] : this.flow(f, ctx)));
      case 'indent':
        if (ctx.tone === 'question') return this.flows(b.body, ctx);                       // P13
        return this.flows(b.body, { ...ctx, place: 'MTSStep2', marker: 'MTSStep2', markerSep: 'tab', lead: true });
      case 'admonition': {
        const tip: Ctx = { ...ctx, place: 'MTSTip', marker: 'MTSTip', markerSep: 'tab', lead: false };
        const paras = this.flows(b.body, tip);
        const cp = this.hb.charPr(this.sid('MTSTip').charPr, { bold: true });
        const label: Run[] = [{ charPr: cp, items: [T(b.label || 'Tip')] }, { charPr: this.sid('MTSTip').charPr, items: [T(' ')] }];
        const firstTip = paras.findIndex((p) => p.style === this.sid('MTSTip').id);
        if (firstTip >= 0) paras[firstTip] = { ...paras[firstTip], runs: [...label, ...paras[firstTip].runs] };
        else paras.unshift(this.para('MTSTip', label));
        return paras;
      }
      case 'case': {
        const key: StyleKey = b.variant === 'sub' ? 'MTSStep2' : 'MTSStep1';
        const out: Para[] = [];
        if (b.title) {
          const lab = b.label ? caseLabelHwp(b.label) : null;
          const head: Run = { charPr: this.sid(key).charPr, items: lab ? [T(lab), TAB] : [TAB] };
          out.push(this.para(key, [head, ...this.runs(b.title, key, ctx)]));
        }
        out.push(...this.flows(b.body, { ...ctx, place: key, marker: key, markerSep: 'tab', lead: true }));
        return out;
      }
      case 'framed':
        return [this.boxPara(b.body, ctx)];
      case 'choices': {
        const items = b.items.map((it) => ({ label: it.label, inline: it.inline }));
        const pieces: ChoicePiece[][] = items.map((it) => it.inline.flatMap((x): ChoicePiece[] => (x.t === 'math' ? [{ t: 'math', latex: x.latex }] : x.t === 'text' ? [{ t: 'text', s: x.text }] : [])));
        const line = (key: StyleKey, list: typeof items): Para => {
          const runs: Run[] = [];
          list.forEach((it, i) => {
            if (i) runs.push({ charPr: this.sid(key).charPr, items: [TAB] });
            runs.push({ charPr: this.sid(key).charPr, items: [T(`${it.label} `)] }, ...this.runs(it.inline, key, ctx));
          });
          return this.para(key, runs);
        };
        if (items.length <= 3) return [line('MTQCh3', items)];
        if (isLongChoices(pieces)) return [line('MTQCh3', items.slice(0, 3)), line('MTQCh3', items.slice(3))];
        return [line('MTQCh5', items)];
      }
      case 'figure': {
        if (b.variant === 'ggb') return [this.para('MTFig', [{ charPr: this.sid('MTFig').charPr, items: [T(PH_GGB)] }])];
        const pic = b.variant === 'svg'
          ? this.pic(ctx, b.ref, false, null, b.heightPx)
          : this.pic(ctx, b.ref, b.gray, b.widthPx, null);
        const item: Item = pic ? (b.variant === 'image' && b.frame ? { ...pic, frame: true } as Item : pic) : T(PH_FIG);
        return [this.para('MTFig', [{ charPr: this.sid('MTFig').charPr, items: [item] }])];
      }
    }
  }

  /* ═══ 탭 ═══ */

  numberRuns(n: number | null): Run[] {
    if (n === null) return [{ charPr: this.sid('MTQBody').charPr, items: [TAB] }];                 // N15 — 탭만
    return [{ charPr: this.sid('MTQNum').charPr, charStyle: this.sid('MTQNum').id, items: [T(`${n}.`), TAB, ...(n >= 10 ? [TAB] : [])] }];
  }

  question(src: HwpxSource, n: number | null): Para[] {
    const tab = src.doc.tabs.find((t) => t.id === 'question');
    const ctx: Ctx = { tone: 'question', src, place: 'MTQCont', marker: 'MTQCont', markerSep: 'space', lead: false, inBox: false, width: PAGE.colWidth };
    const blocks = tab?.blocks ?? [];
    const out: Para[] = [];
    const first = blocks[0];
    const f0 = first && first.kind === 'para' ? first.body[0] : undefined;
    if (f0 && f0.t === 'p' && !f0.marker) {
      out.push(this.para('MTQBody', this.tagRuns([...this.numberRuns(n), ...this.runs(f0.inline, 'MTQBody', ctx)], f0.tag, 'MTQBody')));
      out.push(...this.flows((first as { body: Flow[] }).body.slice(1), ctx));
      blocks.slice(1).forEach((b) => out.push(...this.block(b, ctx)));
    } else {
      out.push(this.para('MTQBody', this.numberRuns(n)));
      blocks.forEach((b) => out.push(...this.block(b, ctx)));
    }
    return out;
  }

  solution(src: HwpxSource): Para[] {
    const tab = src.doc.tabs.find((t) => t.id === 'solution');
    const ctx: Ctx = { tone: 'solution', src, place: 'MTSBody', marker: 'MTSStep1', markerSep: 'tab', lead: false, inBox: false, width: PAGE.colWidth };
    return (tab?.blocks ?? []).flatMap((b) => this.block(b, ctx));
  }
}

const isChoicePara = (p: Para) => p.style === STYLE_IDS.MTQCh5.id || p.style === STYLE_IDS.MTQCh3.id;

/**
 * 문단 내용 폭 어림(HWPUNIT) — 표 열 폭 맞춤용. 본문 글꼴 11.5pt(1150) · 장평 95%를 따른다:
 * 한글 ≈ 1.0em · 영숫자·기호 ≈ 0.5em · 공백 ≈ 0.25em · 수식 = 상자 폭(hwpLayout) · 탭 ≈ 1em
 */
export function paraWidth(p: Para | undefined): number {
  if (!p) return 0;
  const EM = 1150 * 0.95;
  let w = 0;
  for (const it of p.runs.flatMap((r) => r.items)) {
    if (it.k === 'text') for (const ch of it.s) w += ch === ' ' ? 0.25 * EM : /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3\u2460-\u24ff\u3200-\u32ff\u4e00-\u9fff]/.test(ch) ? EM : 0.5 * EM;
    else if (it.k === 'eq') w += it.size?.w ?? 0;
    else if (it.k === 'tab') w += EM;
    else if (it.k === 'pic') w += it.width;
  }
  return Math.round(w);
}

/** 문단의 글자(수식 제외) — 미리보기·미주 자리 찾기 */
export function paraText(p: Para): string {
  return p.runs.flatMap((r) => r.items).map((it) => (it.k === 'text' ? it.s : it.k === 'tab' ? ' ' : '')).join('');
}

/** T15″ — 미주 기호 자리: `[N점]`이 든 마지막 문단, 없으면 선택지 아닌 마지막 문단 */
export function endnoteAnchor(paras: Para[]): number {
  for (let i = paras.length - 1; i >= 0; i--) if (/\[\s*\d+\s*점\s*\]/.test(paraText(paras[i]))) return i;
  for (let i = paras.length - 1; i >= 0; i--) if (!isChoicePara(paras[i])) return i;
  return paras.length - 1;
}

export function serializeHwpx(input: HwpxInput): HwpxResult {
  const w = new Writer(input.options);
  const notices: string[] = [];
  const unnumbered: string[] = [];
  const body: Para[] = [];
  let noteNum = 0;

  input.sources.forEach((src, i) => {
    const n = input.options.numbering === 'sequential' ? i + 1 : problemNumber(src.doc.title);
    if (n === null) unnumbered.push(src.doc.title || '(제목 없음)');
    const q = w.question(src, n);
    const s = w.solution(src);
    if (input.options.placement === 'column') {
      if (i > 0) q[0] = { ...q[0], pageBreak: true };
      body.push(...q);
      if (s.length) { s[0] = { ...s[0], columnBreak: true }; body.push(...s); }
    } else {
      if (i > 0) q[0] = { ...q[0], columnBreak: true };
      if (s.length) {
        noteNum += 1;
        const head = n !== null ? [w.para('MTSH1', [{ charPr: STYLE_IDS.MTSH1.charPr, items: [T(`${n}번`)] }])] : [];
        const at = endnoteAnchor(q);
        const anchor = q[at];
        const runs = [...anchor.runs];
        const last = runs[runs.length - 1];
        runs[runs.length - 1] = { ...last, items: [...last.items, { k: 'endnote', num: noteNum, paras: [...head, ...s] }] };
        q[at] = { ...anchor, runs };
      }
      body.push(...q);
    }
  });
  // 옵션 B — 본문 끝 쪽 나눔 빈 문단: 미주가 새 쪽 왼쪽 단에서 시작(S-4)
  if (input.options.placement === 'endnote' && noteNum > 0) body.push(w.para('MTQCont', [], { pageBreak: true }));
  if (!body.length) body.push(w.para('MTQBody', []));
  body[0] = { ...body[0], secPr: SK.SEC_PR, secPrCharPr: STYLE_IDS.MTQBody.charPr };

  if (unnumbered.length && input.options.numbering === 'title') {
    notices.push(`제목에서 문항 번호를 찾지 못한 ${unnumbered.length}개는 번호 없이 넣었습니다: ${unnumbered.slice(0, 3).join(', ')}${unnumbered.length > 3 ? ' …' : ''}`);
  }
  if (w.unknown.size) notices.push(`한글 수식으로 바꾸지 못한 명령 ${w.unknown.size}종을 낱말로 넣었습니다: ${[...w.unknown].slice(0, 6).map((u) => `\\${u}`).join(' ')}`);
  if (w.missingFigures) notices.push(`그림 ${w.missingFigures}개를 불러오지 못해 안내 문구로 넣었습니다.`);
  const warnings = w.reserved.size ? [`한글 수식 예약어와 겹치는 낱말: ${[...w.reserved].join(', ')}`] : [];

  const prv = body.map(paraText).filter((t) => t.trim()).join('\n');
  const bytes = buildPackage({ title: input.title, header: w.hb.xml(), paras: body, bins: input.bins, prvText: prv, ids: w.ids });
  return { bytes, notices, warnings };
}
