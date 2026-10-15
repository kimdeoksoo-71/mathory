/**
 * Phase 71 — 한글 수식 편집기의 조판을 흉내 내는 크기 모델. import 0 — Node·브라우저 같은 값.
 *
 * 왜: 한글 2022는 hwpx를 열 때 수식 sz를 다시 재지 않는다(hwpLayout.ts). KaTeX로 재면 한글과 구조가 달라(연산자 간격 ·
 *   첨자 안 분수 · eqalign 기준선이 첫 행) 폭 0.81~1.23배 · 위아래가 크게 어긋났다(덕수 실물 2차).
 * 그래서 **우리가 만든 한글 수식 스크립트**(hwpEq.ts 출력)를 한글 규칙으로 조판해 폭·위·아래(em)를 낸다.
 * 상수(PARAMS)는 덕수가 한글에서 수식 40개를 다시 재게 해 저장한 실측(2026-10-15 `C-보정(수식 40개) 모두클릭.hwpx`)에 맞췄다 —
 *   맞추는 도구는 scripts/hwpxEqFit.mjs, 실측 표는 tests/fixtures/export/hwpEqCalibration.json(test:exporthwpx가 오차를 고정).
 *
 * 단위: em = baseUnit(1100 HWPUNIT). 모든 글자 상자는 위 0.869 · 아래 0.154(한글 본문 글꼴 상자 — `a`·`3` 실측 956·169).
 */

export interface Box { w: number; a: number; d: number }

export const PARAMS = {
  // 2026-10-15 덕수 실측 40개에 맞춘 값(scripts/hwpxEqFit.mjs --fit — 손으로 고치지 말고 실측을 더해 다시 맞출 것)
  A0: 0.869, D0: 0.154, lower: 0.497, upper: 0.602, digit: 0.478, greek: 0.538, roman: 0.439, korean: 0.758,
  space: 0.336, paren: 0.397, comma: 0.569, unary: 0.908, period: 0.25, bar: 0.25, prime: 0.232, other: 0.5,
  bin: 1.098, rel: 1.166, relWide: 1.211, quarter: 0.23, tilde: 0.4, func: 0.002, scale: 0.684, scriptGap: 0.041,
  supRaise: 0.449, supMinBottom: 0.329, subLower: 0.253, subMaxTop: 0.62, fracPad: 0.505, fracAbove: 0.507,
  fracBelow: -0.207, radW: 1.125, radAbove: 0.145, delimW: 0.33, delimBarW: 0.465, delimGrowA: 0.181,
  delimGrowD: 0.002, accentW: 0.324, accentA: 0.198, opW: 1.15, opA: 0.917, opD: 0.214, limGap: 0.082,
  intW: 1.313, intA: 1.582, intD: 0.969, rowGap: 0.108, colGap: 0.325, braceW: 0.545, axis: 0.356, boxPad: 0.25,
};
export type Params = typeof PARAMS;

/* ═══ 토큰 ═══ */

type Tok =
  | { t: '{' } | { t: '}' } | { t: '^' } | { t: '_' } | { t: '#' } | { t: '&' } | { t: '`' } | { t: '~' }
  | { t: 'str'; s: string } | { t: 'word'; s: string } | { t: 'ch'; s: string };

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (/\s/.test(c)) continue;
    if (c === '"') {
      const j = src.indexOf('"', i + 1);
      const end = j < 0 ? src.length : j;
      out.push({ t: 'str', s: src.slice(i + 1, end) });
      i = end;
      continue;
    }
    if ('{}^_#&`~'.includes(c)) { out.push({ t: c } as Tok); continue; }
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      out.push({ t: 'word', s: src.slice(i, j) });
      i = j - 1;
      continue;
    }
    if (c === '-' && src[i + 1] === '>') { out.push({ t: 'word', s: 'rightarrow' }); i++; continue; }   // `->` 한 글자(lim 아래)
    out.push({ t: 'ch', s: c });
  }
  return out;
}

/* ═══ 분류 ═══ */

const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
  'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
  'Upsilon', 'Phi', 'Psi', 'Omega', 'varepsilon', 'vartheta', 'varphi', 'varrho', 'varsigma']);
const FUNCS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp',
  'det', 'dim', 'ker', 'deg', 'max', 'min', 'sup', 'gcd', 'arg', 'mod']);
const BIN = new Set(['times', 'cdot', 'pm', 'mp', 'div', 'cup', 'cap', 'circ', 'bullet', 'star', 'land', 'lor']);
const REL = new Set(['leq', 'geq', 'approx', 'equiv', 'sim', 'simeq', 'cong', 'propto', 'subset', 'supset', 'subseteq', 'supseteq', 'in',
  'notin', 'owns', 'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'vert']);
const REL_WIDE = new Set(['neq']);
const BIGOP = new Set(['SUM', 'PROD', 'COPROD', 'UNION', 'INTER']);
const INTOP = new Set(['INT', 'IINT', 'IIINT', 'OINT']);
const ORD_SYM: Record<string, number> = { inf: 0.75, cdots: 1.0, ldots: 1.0, vdots: 0.3, ddots: 1.0, partial: 0.55, nabla: 0.75, angle: 0.75,
  therefore: 0.75, because: 0.75, TRIANGLE: 0.8, perp: 0.75, parallel: 0.4, emptyset: 0.55, forall: 0.6, exists: 0.6, neg: 0.65,
  ell: 0.45, hbar: 0.55, aleph: 0.65, langle: 0.35, rangle: 0.35, lbrace: 0.5, rbrace: 0.5, lfloor: 0.4, rfloor: 0.4, lceil: 0.4, rceil: 0.4 };
const ENVS = new Set(['cases', 'eqalign', 'pile', 'lpile', 'rpile', 'matrix']);
const ACCENTS = new Set(['overline', 'underline', 'bar', 'vec', 'hat', 'dot', 'ddot', 'tilde']);

/* ═══ 조판 ═══ */

const hbox = (bs: Box[]): Box => bs.reduce((acc, b) => ({ w: acc.w + b.w, a: Math.max(acc.a, b.a), d: Math.max(acc.d, b.d) }), { w: 0, a: 0, d: 0 });

class Layout {
  private i = 0;
  constructor(private toks: Tok[], private P: Params) {}

  glyph(w: number, s: number): Box { return { w: w * s, a: this.P.A0 * s, d: this.P.D0 * s }; }

  /** 단어 하나(한글 수식 키워드·식별자) */
  word(wd: string, s: number, roman: boolean): Box {
    const P = this.P;
    if (GREEK.has(wd)) return this.glyph(P.greek, s);
    if (FUNCS.has(wd)) return this.glyph(wd.length * P.roman + P.func, s);
    if (BIN.has(wd)) return this.glyph(P.bin, s);
    if (REL_WIDE.has(wd)) return this.glyph(P.relWide, s);
    if (REL.has(wd)) return this.glyph(P.rel, s);
    if (wd in ORD_SYM) return this.glyph(ORD_SYM[wd], s);
    if (wd === 'prime') return this.glyph(P.prime, s);
    if (wd === 'not' || wd === 'none' || wd === 'it' || wd === 'rm' || wd === 'bold') return { w: 0, a: 0, d: 0 };
    let w = 0;
    for (const ch of wd) w += roman ? (ch === ch.toUpperCase() ? P.upper : P.roman) : ch === ch.toUpperCase() ? P.upper : P.lower;
    return this.glyph(w, s);
  }

  ch(c: string, s: number): Box {
    const P = this.P;
    if (/\d/.test(c)) return this.glyph(P.digit, s);
    if ('+-'.includes(c)) return this.glyph(P.bin, s);
    if ('=<>'.includes(c)) return this.glyph(P.rel, s);
    if ('()[]'.includes(c)) return this.glyph(P.paren, s);
    if (c === ',') return this.glyph(P.comma, s);
    if (c === '.' || c === ':' || c === ';') return this.glyph(P.period, s);
    if (c === '|' || c === '/') return this.glyph(P.bar, s);
    if (c === "'") return this.glyph(P.prime, s);
    if (/[ᄀ-ᇿ㄰-㆏가-힣㈀-㋿]/.test(c)) return this.glyph(P.korean, s);
    return this.glyph(P.other, s);
  }

  text(str: string, s: number): Box {
    let w = 0;
    for (const c of str) w += c === ' ' ? this.P.space : /[ᄀ-ᇿ㄰-㆏가-힣㈀-㋿]/.test(c) ? this.P.korean : this.P.roman;
    return this.glyph(w, s);
  }

  peek(): Tok | undefined { return this.toks[this.i]; }

  /** 구분자까지의 가로 나열 */
  seq(s: number, stop: (t: Tok) => boolean, roman = false): Box {
    const items: Box[] = [];
    let rm = roman;
    while (this.i < this.toks.length) {
      const t = this.toks[this.i];
      if (stop(t)) break;
      if (t.t === 'word' && t.s === 'rm') { this.i++; rm = true; continue; }
      if (t.t === 'word' && t.s === 'it') { this.i++; rm = false; continue; }
      if (t.t === 'word' && t.s === 'over' && items.length) {
        this.i++;
        const num = items.pop()!;
        const den = this.atom(s, rm) ?? { w: 0, a: 0, d: 0 };
        items.push(this.frac(num, den, s));
        continue;
      }
      if (t.t === 'word' && t.s === 'right') break;
      if (t.t === 'ch' && (t.s === '-' || t.s === '+') && items.length === 0) { this.i++; items.push(this.glyph(this.P.unary, s)); continue; }   // 맨 앞 부호
      const b = this.atom(s, rm);
      if (b) items.push(b);
    }
    return items.length ? hbox(items) : { w: 0, a: this.P.A0 * s, d: this.P.D0 * s };
  }

  frac(num: Box, den: Box, s: number): Box {
    const P = this.P;
    return { w: Math.max(num.w, den.w) + P.fracPad * s, a: num.a + num.d + P.fracAbove * s, d: den.a + den.d + P.fracBelow * s };
  }

  group(s: number, roman: boolean): Box {
    // 현재 토큰이 `{` — 짝 `}`까지
    this.i++;
    const b = this.seq(s, (t) => t.t === '}', roman);
    if (this.peek()?.t === '}') this.i++;
    return b;
  }

  /** 원자 하나 + 뒤따르는 첨자 */
  atom(s: number, roman: boolean, noScripts = false): Box | null {
    const P = this.P;
    const t = this.toks[this.i];
    if (!t) return null;
    let base: Box;
    let op: 'big' | 'int' | 'lim' | null = null;
    switch (t.t) {
      case '{': base = this.group(s, roman); break;
      case 'str': this.i++; base = this.text(t.s, s); break;
      case '`': this.i++; return { w: P.quarter * s, a: 0, d: 0 };
      case '~': this.i++; return { w: P.tilde * s, a: 0, d: 0 };
      case 'ch': this.i++; base = this.ch(t.s, s); break;
      case '#': case '&': case '}': this.i++; return null;
      case '^': case '_': base = { w: 0, a: P.A0 * s, d: P.D0 * s }; break;   // `{}_{6}` 같은 빈 밑
      case 'word': {
        const wd = t.s;
        this.i++;
        if (wd === 'sqrt') { const x = this.atom(s, roman) ?? this.glyph(0, s); base = { w: x.w + P.radW * s, a: x.a + P.radAbove * s, d: Math.max(x.d, P.D0 * s) }; break; }
        if (wd === 'root') {
          this.atom(s * P.scale, roman);                                  // 지수(폭에 더하지 않는다 — 실측 `root 3 of 5` = `sqrt 3`)
          if (this.peek()?.t === 'word' && (this.peek() as { s: string }).s === 'of') this.i++;
          const x = this.atom(s, roman) ?? this.glyph(0, s);
          base = { w: x.w + P.radW * s, a: x.a + P.radAbove * s, d: Math.max(x.d, P.D0 * s) };
          break;
        }
        if (wd === 'left') {
          const ld = this.delim();
          const inner = this.seq(s, (x) => x.t === 'word' && x.s === 'right', roman);
          if (this.peek()?.t === 'word') this.i++;                        // right
          const rd = this.delim();
          const tall = inner.a > P.A0 * s + 0.05 || inner.d > P.D0 * s + 0.05;
          const dw = (d: string | null) => (d === null ? 0 : d === '|' || d === '||' ? P.delimBarW : P.delimW);
          base = {
            w: inner.w + (dw(ld) + dw(rd)) * s,
            a: tall ? inner.a + P.delimGrowA * s : Math.max(inner.a, P.A0 * s),
            d: tall ? inner.d + P.delimGrowD * s : Math.max(inner.d, P.D0 * s),
          };
          break;
        }
        if (ACCENTS.has(wd)) { const x = this.atom(s, roman, true) ?? this.glyph(0, s); base = { w: x.w + P.accentW * s, a: x.a + P.accentA * s, d: x.d }; break; }
        if (wd === 'box') { const x = this.atom(s, roman) ?? this.glyph(0, s); base = { w: x.w + 2 * P.boxPad * s, a: x.a + P.boxPad * s * 0.5, d: x.d + P.boxPad * s * 0.5 }; break; }
        if (ENVS.has(wd)) { base = this.env(wd, s); break; }
        if (BIGOP.has(wd)) { op = 'big'; base = { w: P.opW * s, a: P.opA * s, d: P.opD * s }; break; }
        if (INTOP.has(wd)) { op = 'int'; base = { w: P.intW * s, a: P.intA * s, d: P.intD * s }; break; }
        if (wd === 'lim') { op = 'lim'; base = this.glyph(3 * P.roman, s); break; }
        base = this.word(wd, s, roman);
        break;
      }
      default: this.i++; return null;
    }
    if (noScripts) return base;
    // 첨자
    let sup: Box | null = null;
    let sub: Box | null = null;
    for (let k = 0; k < 2; k++) {
      const n = this.peek();
      // ⚠ 첨자 인자는 제 첨자를 먹지 않는다(`x_{1}^{2}`의 `^{2}`는 x의 것)
      if (n?.t === '^' && !sup) { this.i++; sup = this.atom(s * P.scale, roman, true) ?? null; continue; }
      if (n?.t === '_' && !sub) { this.i++; sub = this.atom(s * P.scale, roman, true) ?? null; continue; }
      break;
    }
    if (!sup && !sub) return base;
    if (op === 'big' || op === 'lim') {
      // 위아래 첨자
      const w = Math.max(base.w, sup?.w ?? 0, sub?.w ?? 0);
      return {
        w: w + (op === 'lim' ? P.func * s : 0),
        a: base.a + (sup ? sup.a + sup.d + P.limGap * s : 0),
        d: base.d + (sub ? sub.a + sub.d + P.limGap * s : 0),
      };
    }
    let w = base.w;
    let a = base.a;
    let d = base.d;
    const side = Math.max(sup?.w ?? 0, sub?.w ?? 0);
    if (sup) {
      const raise = Math.max(P.supRaise * s, P.supMinBottom * s + sup.d);
      a = Math.max(a, raise + sup.a);
    }
    if (sub) {
      const lower = Math.max(P.subLower * s, sub.a - P.subMaxTop * s);
      d = Math.max(d, lower + sub.d);
    }
    w += P.scriptGap * s + side;
    return { w, a, d };
  }

  delim(): string | null {
    const t = this.peek();
    if (!t) return null;
    this.i++;
    if (t.t === 'word' && t.s === 'none') return null;
    if (t.t === 'ch' && t.s === '|' && this.peek()?.t === 'ch' && (this.peek() as { s: string }).s === '|') { this.i++; return '||'; }
    return t.t === 'ch' || t.t === 'word' ? t.s : '?';
  }

  /** cases·eqalign·pile·matrix — 인자 `{행 # 행}` · 칸 `&` */
  env(kind: string, s: number): Box {
    const P = this.P;
    if (this.peek()?.t !== '{') return this.glyph(0, s);
    this.i++;
    const rows: Box[][] = [[]];
    while (this.i < this.toks.length && this.peek()?.t !== '}') {
      const cell = this.seq(s, (t) => t.t === '#' || t.t === '&' || t.t === '}');
      rows[rows.length - 1].push(cell);
      const t = this.peek();
      if (t?.t === '&') this.i++;
      else if (t?.t === '#') { this.i++; rows.push([]); }
    }
    if (this.peek()?.t === '}') this.i++;
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...rows.map((r) => r[c]?.w ?? 0)));
    const rowA = rows.map((r) => Math.max(P.A0 * s, ...r.map((b) => b.a)));
    const rowD = rows.map((r) => Math.max(P.D0 * s, ...r.map((b) => b.d)));
    const H = rowA.reduce((x, y) => x + y, 0) + rowD.reduce((x, y) => x + y, 0) + (rows.length - 1) * P.rowGap * s;
    const gaps = kind === 'eqalign' ? 0 : (cols - 1) * P.colGap * s;
    const w = colW.reduce((x, y) => x + y, 0) + gaps + (kind === 'cases' ? P.braceW * s : 0);
    if (kind === 'eqalign' || kind.endsWith('pile')) return { w, a: rowA[0], d: H - rowA[0] };   // 한글: 기준선 = 첫 행(실측 baseLine 41)
    const a = H / 2 + P.axis * s;
    return { w, a, d: H - a };
  }
}

/** 한글 수식 스크립트 → 폭·위·아래(em) */
export function layoutHwp(script: string, P: Params = PARAMS): Box {
  const L = new Layout(tokenize(script), P);
  const b = L.seq(1, () => false);
  return { w: b.w, a: Math.max(P.A0, b.a), d: Math.max(P.D0, b.d) };
}

/** 한글 수식 상자(sz 폭·높이 · baseLine %) */
export function hwpEqSize(script: string, baseUnit = 1100, P: Params = PARAMS): { w: number; h: number; base: number } {
  const b = layoutHwp(script, P);
  const h = Math.round((b.a + b.d) * baseUnit);
  return { w: Math.max(1, Math.round(b.w * baseUnit)), h, base: Math.round((b.a / (b.a + b.d)) * 100) };
}

/**
 * 한글 수식 공백으로 폭 `w`(HWPUNIT)를 채우는 스크립트 — `~`(PARAMS.tilde) 위주, 나머지는 `` ` ``(PARAMS.quarter)로 반올림.
 * 여러 줄 수식을 행마다 나눌 때 `&` 자리를 맞추는 데 쓴다(근사 — 오차는 `` ` `` 반 칸 이하).
 */
export function hwpPad(w: number, baseUnit = 1100, P: Params = PARAMS): string {
  if (!(w > 0)) return '';
  const tw = P.tilde * baseUnit;
  const qw = P.quarter * baseUnit;
  const n = Math.floor(w / tw);
  const q = Math.round((w - n * tw) / qw);
  return '~'.repeat(n) + '`'.repeat(q);
}
