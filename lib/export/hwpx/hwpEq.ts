/**
 * Phase 71 — LaTeX → 한글 수식 스크립트(EqEdit). import 0 — `test:exporthwpeq`가 단독 컴파일한다.
 *
 * 출발점은 md2hwp `LaTeXToHwpEquation`(`~/Documents/md2hwp/md_preprocessor.py:135-500`)이고, 다음은 **의도한 차이**다
 * (착수판 §11 구현 기록 I-항목):
 *   ① 기호·그리스·함수 치환을 "긴 이름부터 부분 문자열 replace"가 아니라 **명령 이름 단위**로 한다 —
 *      md2hwp는 `\left\langle`의 `\le`를 leq로 먹는 식의 접두 충돌이 있었다
 *   ② `\text{…}` 계열은 **먼저 보호**했다가 끝에 `"…"`로 되돌린다(내용의 `'`·공백·기호가 변환을 타지 않게)
 *   ③ `aligned`·`align*`·`split` → `eqalign{… # …}`(md2hwp는 환경을 벗기고 `\\`·`&`를 지워 한 줄로 뭉쳤다) ·
 *      `gathered` → `pile` · 한 열 `array{l|c|r}` → `lpile`/`pile`/`rpile`
 *   ④ 행렬은 칸 `&` · 행 `#`(cases·eqalign과 같은 규약 — md2hwp의 `#`/`##`는 S-7에서 확인)
 *   ⑤ `\boxed`·`\fbox` → `box{…}`(P4·D16) · 수식 안 인용 표지 `\mathoryref{n}` → `"㉠"`(R1·R2)
 *   ⑥ 크기 명령(`\displaystyle` 등)은 지운다 — 한글 수식에 없는 낱말은 이탤릭 글자 나열로 그려진다(G9)
 * 모르는 명령은 낱말로 남기고 `unknown`에 올린다(문서는 열린다). 키워드 충돌(G8)은 `reserved`로 경고만.
 */

export interface HwpEqResult {
  script: string;
  /** 변환표에 없는 LaTeX 명령(이름만, 중복 없음) */
  unknown: string[];
  /** 명령 없이 쓴 영문 낱말 중 한글 수식 예약어와 겹치는 것(G8 — 경고) */
  reserved: string[];
}

/* ═══ 인용 번호 ═══ */

const CIRCLED = ['㉠', '㉡', '㉢', '㉣', '㉤', '㉥', '㉦', '㉧', '㉨', '㉩', '㉪', '㉫', '㉬', '㉭'];

/** R2 — 인용·행 끝 번호: 1~14 → ㉠~㉭, 그 밖(비숫자 `(가)` 등)은 그대로 */
export function refMark(n: string): string {
  const s = n.trim().replace(/^\((.*)\)$/, '$1');
  if (/^\d+$/.test(s)) {
    const k = parseInt(s, 10);
    if (k >= 1 && k <= CIRCLED.length) return CIRCLED[k - 1];
  }
  return n;
}

/* ═══ 표 ═══ */

const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
  'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'varepsilon', 'vartheta', 'varphi', 'varrho', 'varsigma',
];
const FUNCS = [
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'det', 'dim', 'ker', 'deg', 'max', 'min', 'sup', 'gcd', 'arg', 'lim', 'mod',
];

/** 명령 이름 → 한글 수식(앞뒤 공백은 변환기가 붙인다) */
const MAP: Record<string, string> = {
  ...Object.fromEntries(GREEK.map((g) => [g, g])),
  ...Object.fromEntries(FUNCS.map((f) => [f, f])),
  inf: 'inf',  // \inf(하한) — md2hwp의 \infty → inf와 글자가 같다(알고 둔다)
  cdot: 'cdot', times: 'times', div: 'div', pm: 'pm', mp: 'mp', ast: '*', star: 'star', circ: 'circ', bullet: 'bullet',
  leq: 'leq', le: 'leq', leqslant: 'leq', geq: 'geq', ge: 'geq', geqslant: 'geq', neq: 'neq', ne: 'neq', lt: '<', gt: '>',
  approx: 'approx', equiv: 'equiv', sim: 'sim', simeq: 'simeq', cong: 'cong', propto: 'propto', ll: '<<', gg: '>>',
  subset: 'subset', supset: 'supset', subseteq: 'subseteq', supseteq: 'supseteq', in: 'in', notin: 'notin', ni: 'owns',
  cup: 'cup', cap: 'cap', emptyset: 'emptyset', varnothing: 'emptyset', setminus: '-',
  forall: 'forall', exists: 'exists', neg: 'neg', lnot: 'neg', land: 'land', wedge: 'land', lor: 'lor', vee: 'lor',
  to: '`rightarrow`', rightarrow: '`rightarrow`', leftarrow: '`leftarrow`', leftrightarrow: '`leftrightarrow`',
  Rightarrow: '`Rightarrow`', Leftarrow: '`Leftarrow`', Leftrightarrow: '`Leftrightarrow`',
  implies: '`Rightarrow`', iff: '`Leftrightarrow`', longrightarrow: '`rightarrow`', Longrightarrow: '`Rightarrow`',
  cdots: 'cdots', ldots: 'ldots', dots: 'cdots', vdots: 'vdots', ddots: 'ddots',
  infty: 'inf', partial: 'partial', nabla: 'nabla', angle: 'angle', perp: 'perp', parallel: 'parallel',
  triangle: 'TRIANGLE', therefore: 'therefore', because: 'because', mid: '~ vert ~', vert: '|', Vert: '||',
  langle: 'langle', rangle: 'rangle', lbrace: 'lbrace', rbrace: 'rbrace', lfloor: 'lfloor', rfloor: 'rfloor', lceil: 'lceil', rceil: 'rceil',
  quad: '~~', qquad: '~~~~', prime: "'", not: 'not', ell: 'ell', hbar: 'hbar', aleph: 'aleph', degree: '°',
  int: 'INT', iint: 'IINT', iiint: 'IIINT', oint: 'OINT', sum: 'SUM', prod: 'PROD', coprod: 'COPROD', bigcup: 'UNION', bigcap: 'INTER',
  overline: 'overline', underline: 'underline', hat: 'hat', widehat: 'hat', bar: 'bar', vec: 'vec', overrightarrow: 'vec',
  dot: 'dot', ddot: 'ddot', tilde: 'tilde', widetilde: 'tilde',
};

/** 지우는 명령(인자 없음) */
const DROP = new Set(['displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle', 'limits', 'nolimits', 'big', 'Big', 'bigg', 'Bigg',
  'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr', 'middle', 'nonumber', 'notag', 'allowbreak']);
/** 지우는 명령(인자 하나째 통째로) */
const DROP_ARG = new Set(['hspace', 'vspace', 'phantom', 'hphantom', 'vphantom', 'label', 'color', 'tag']);
/** 글자 그대로(따옴표 문자열) */
const TEXT_CMDS = new Set(['text', 'textrm', 'textnormal', 'textup', 'textsf', 'texttt', 'textit', 'textbf', 'mbox', 'hbox', 'textmd']);

/** 명령 없이 쓴 영문 낱말이 이것이면 한글이 기호·명령으로 읽는다(G8) */
const RESERVED = new Set([
  ...GREEK.map((g) => g.toLowerCase()),
  'it', 'rm', 'in', 'or', 'over', 'box', 'sum', 'inf', 'lim', 'bar', 'dot', 'vec', 'times', 'prime', 'sqrt', 'root', 'of',
  'int', 'not', 'and', 'le', 'ge', 'ne', 'to', 'cases', 'pile', 'matrix', 'left', 'right', 'bold', 'hat', 'tilde', 'atop',
  'from', 'under', 'cdot', 'leq', 'geq', 'neq', 'deg', 'mod',
]);

/* ═══ 그룹 읽기 ═══ */

/** s[i]가 `{`면 균형 맞는 그룹(내용, 다음 위치), 아니면 공백 뒤 한 글자(명령이면 명령 전체) */
function readArg(s: string, i: number): { body: string; end: number } | null {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (j >= s.length) return null;
  if (s[j] === '{') {
    let depth = 0;
    for (let k = j; k < s.length; k++) {
      if (s[k] === '\\') { k++; continue; }
      if (s[k] === '{') depth++;
      else if (s[k] === '}') { depth--; if (depth === 0) return { body: s.slice(j + 1, k), end: k + 1 }; }
    }
    return null;
  }
  if (s[j] === '\\') {
    const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(j));
    return m ? { body: m[0], end: j + m[0].length } : null;
  }
  return { body: s[j], end: j + 1 };
}

function readOpt(s: string, i: number): { body: string; end: number } | null {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  if (s[j] !== '[') return null;
  const k = s.indexOf(']', j);
  return k < 0 ? null : { body: s.slice(j + 1, k), end: k + 1 };
}

/** `\name` 매크로를 인자 n개와 함께 바꾼다(바깥부터 · 안쪽은 다음 회차에) */
function replaceMacro(s: string, names: string[], argc: number, fn: (args: string[], opt: string | null) => string): string {
  const re = new RegExp(`\\\\(${names.join('|')})(?![a-zA-Z])`);
  for (let guard = 0; guard < 500; guard++) {
    const m = re.exec(s);
    if (!m) break;
    let at = m.index + m[0].length;
    const opt = readOpt(s, at);
    if (opt) at = opt.end;
    const args: string[] = [];
    for (let a = 0; a < argc; a++) {
      const r = readArg(s, at);
      if (!r) break;
      args.push(r.body);
      at = r.end;
    }
    if (args.length < argc) { s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); continue; }
    s = s.slice(0, m.index) + fn(args, opt ? opt.body : null) + s.slice(at);
  }
  return s;
}

/* ═══ 환경 ═══ */

/** 깊이 0의 `\\`(뒤의 `[4pt]` 포함)로 행을 나눈다. 꼬리 빈 행은 버린다 */
export function splitRows(body: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '\\' && depth === 0) {
      rows.push(cur);
      cur = '';
      i += 1;
      const opt = /^\s*\[[^\]]*\]/.exec(body.slice(i + 1));
      if (opt) i += opt[0].length;
      continue;
    }
    if (ch === '\\') { cur += ch + (body[i + 1] ?? ''); i += 1; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    cur += ch;
  }
  rows.push(cur);
  const out = rows.map((r) => r.trim());
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

const MATRIX_FENCE: Record<string, [string, string]> = {
  pmatrix: [' left ( ', ' right ) '], bmatrix: [' left [ ', ' right ] '], Bmatrix: [' left lbrace ', ' right rbrace '],
  vmatrix: [' left | ', ' right | '], Vmatrix: [' left || ', ' right || '], matrix: ['', ''], smallmatrix: ['', ''],
};

function envToHwp(env: string, arg: string | null, body: string): string {
  const base = env.replace(/\*$/, '');
  const rows = splitRows(body);
  if (base in MATRIX_FENCE) {
    const [l, r] = MATRIX_FENCE[base];
    return `${l}matrix{${rows.map((row) => row.split('&').map((c) => c.trim()).join(' & ')).join(' # ')}}${r}`;
  }
  if (base === 'cases' || base === 'dcases' || base === 'rcases' || base === 'drcases') {
    // md2hwp 규칙 — 빈 칸이 있어도 행마다 칸 수를 맞춘다
    const amps = Math.max(0, ...rows.map((row) => (row.match(/&/g) ?? []).length));
    const padded = rows.map((row) => {
      const n = (row.match(/&/g) ?? []).length;
      return n < amps ? `${row}${' &'.repeat(amps - n)}` : row;
    });
    const inner = padded.join(' # ');
    return base.startsWith('r') || base.startsWith('dr') ? ` left none matrix{${inner}} right rbrace ` : ` cases{${inner}} `;
  }
  if (['aligned', 'align', 'alignat', 'alignedat', 'split', 'eqnarray', 'flalign'].includes(base)) {
    return ` eqalign{${rows.join(' # ')}} `;
  }
  if (['gathered', 'gather', 'multline'].includes(base)) {
    return ` pile{${rows.map((r) => r.replace(/&/g, ' ')).join(' # ')}} `;
  }
  if (base === 'array' || base === 'darray') {
    const cols = (arg ?? 'l').replace(/[^lcr]/g, '');
    if (cols.length <= 1) {
      const kind = cols === 'c' ? 'pile' : cols === 'r' ? 'rpile' : 'lpile';
      return ` ${kind}{${rows.join(' # ')}} `;
    }
    return ` matrix{${rows.map((row) => row.split('&').map((c) => c.trim()).join(' & ')).join(' # ')}} `;
  }
  // equation 등 — 벗긴다
  return ` ${rows.join(' ')} `;
}

function convertEnvs(s: string): string {
  // 안쪽 환경부터(본문에 다른 \begin이 없는 것)
  const re = /\\begin\s*\{([a-zA-Z]+\*?)\}((?:(?!\\begin\s*\{)[\s\S])*?)\\end\s*\{\1\}/;
  for (let guard = 0; guard < 200; guard++) {
    const m = re.exec(s);
    if (!m) break;
    let body = m[2];
    let arg: string | null = null;
    const env = m[1];
    if (/^(array|darray|alignat|alignedat)\*?$/.test(env) || /matrix\*$/.test(env)) {
      const opt = /^\s*\[[^\]]*\]/.exec(body);
      if (opt) body = body.slice(opt[0].length);
      const r = readArg(body, 0);
      if (r && /^\s*\{/.test(body)) { arg = r.body; body = body.slice(r.end); }
    }
    s = s.slice(0, m.index) + envToHwp(env, arg, body) + s.slice(m.index + m[0].length);
  }
  return s;
}

/* ═══ 본체 ═══ */

const DELIM: Record<string, string> = {
  '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': 'none', '/': '/', '<': 'langle', '>': 'rangle',
  '\\{': 'lbrace', '\\}': 'rbrace', '\\lbrace': 'lbrace', '\\rbrace': 'rbrace', '\\langle': 'langle', '\\rangle': 'rangle',
  '\\lvert': '|', '\\rvert': '|', '\\vert': '|', '\\|': '||', '\\lVert': '||', '\\rVert': '||', '\\Vert': '||',
  '\\lfloor': 'lfloor', '\\rfloor': 'rfloor', '\\lceil': 'lceil', '\\rceil': 'rceil',
};

export function latexToHwp(latex: string): HwpEqResult {
  const unknown = new Set<string>();
  const texts: string[] = [];
  const keep = (s: string) => { texts.push(s); return `\u0001${texts.length - 1}\u0002`; };
  let s = latex;

  // G8 — 명령·\text 밖의 영문 낱말 중 예약어(원문 기준)
  const bare = s.replace(/\\(?:text|textrm|mbox|mathrm|operatorname|begin|end)\s*\{[^{}]*\}/g, ' ').replace(/\\[a-zA-Z]+/g, ' ');
  const reserved = [...new Set([...bare.matchAll(/[A-Za-z]+/g)].map((m) => m[0]).filter((w) => w.length > 1 && RESERVED.has(w.toLowerCase())))];

  // ⑤ 인용 표지 · ② 글자 보호
  s = s.replace(/\\mathoryref\{(\d+)\}/g, (_, n: string) => keep(`"${refMark(n)}"`));
  s = replaceMacro(s, [...TEXT_CMDS], 1, ([t]) => keep(`"${t.replace(/"/g, "''").replace(/\$/g, '')}"`));
  // ⑥ 크기·장식 명령
  s = s.replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (m, name: string) => (DROP.has(name) ? ' ' : m));
  s = replaceMacro(s, [...DROP_ARG], 1, () => ' ');

  // 미분 기호 — md2hwp 규칙: 백틱 1 + ' N개
  s = s.replace(/\\prime/g, "'");
  s = s.replace(/\^\s*\{\s*('+)\s*\}/g, (_, p: string) => '`' + p);
  s = s.replace(/\^\s*('+)/g, (_, p: string) => '`' + p);
  s = s.replace(/(?<![`'])('+)/g, (_, p: string) => '`' + p);

  // 환경(행렬·cases·eqalign·pile)
  s = convertEnvs(s);

  // 분수·근호·상자·이항
  s = replaceMacro(s, ['frac', 'dfrac', 'tfrac', 'cfrac'], 2, ([a, b]) => ` {${a}} over {${b}} `);
  s = replaceMacro(s, ['binom', 'dbinom', 'tbinom'], 2, ([a, b]) => ` left ( pile{${a} # ${b}} right ) `);
  s = replaceMacro(s, ['sqrt'], 1, ([x], n) => (n ? ` root {${n}} of {${x}} ` : ` sqrt {${x}} `));
  s = replaceMacro(s, ['boxed', 'fbox'], 1, ([x]) => ` box{${x}} `);
  s = replaceMacro(s, ['mathrm', 'operatorname'], 1, ([x]) => ` rm{${x}}it `);
  s = replaceMacro(s, ['mathbf', 'boldsymbol', 'bm'], 1, ([x]) => ` bold{${x}} `);
  s = replaceMacro(s, ['mathbb', 'mathcal', 'mathit', 'mathsf', 'mathfrak'], 1, ([x]) => ` ${x} `);

  // 극한 아래 화살표 — md2hwp `lim _{x `->` a}`
  s = s.replace(/\\to(?![a-zA-Z])/g, (m, off: number) => {
    const before = s.slice(0, off);
    return /\\lim\s*_\s*\{[^{}]*$/.test(before) ? ' `->` ' : m;
  });

  // 괄호
  s = s.replace(/\\(left|right)\s*(\\[a-zA-Z]+|\\[{}|]|[()[\]|./<>])/g, (_, side: string, d: string) => {
    const hwp = DELIM[d] ?? d.replace(/^\\/, '');
    return ` ${side} ${hwp} `;
  });

  // 글자 아닌 이스케이프
  s = s
    .replace(/\\\{/g, ' lbrace ').replace(/\\\}/g, ' rbrace ').replace(/\\\|/g, ' || ')
    .replace(/\\,/g, ' ` ').replace(/\\:/g, ' ` ').replace(/\\;/g, ' ~ ').replace(/\\!/g, ' ').replace(/\\ /g, ' ~ ')
    .replace(/\\%/g, '%').replace(/\\#/g, keep('"#"')).replace(/\\&/g, keep('"&"')).replace(/\\_/g, keep('"_"')).replace(/\\\$/g, '$');

  // 남은 `\\`(환경 밖 행바꿈) → 공백
  s = s.replace(/\\\\(\s*\[[^\]]*\])?/g, ' ');

  // ① 명령 이름 단위 치환
  s = s.replace(/\\([a-zA-Z]+)/g, (_, name: string) => {
    const hit = MAP[name];
    if (hit !== undefined) return ` ${hit} `;
    unknown.add(name);
    return ` ${name} `;
  });

  // 정리 — 그룹 안쪽 공백 · 연속 공백
  s = s.replace(/\{\s+/g, '{').replace(/\s+\}/g, '}').replace(/\s+/g, ' ').trim();
  s = s.replace(/\u0001(\d+)\u0002/g, (_, i: string) => texts[parseInt(i, 10)]);
  return { script: s, unknown: [...unknown], reserved };
}

/** IR `display.rows`(맨 `\\` 행) → 왼쪽 정렬 쌓기(앱은 `array{l}`로 그린다 — v3 E18) */
export function rowsToHwp(rows: string[]): HwpEqResult {
  const parts = rows.map((r) => latexToHwp(r.trim() || '{}'));
  return {
    script: `lpile{${parts.map((p) => p.script).join(' # ')}}`,
    unknown: [...new Set(parts.flatMap((p) => p.unknown))],
    reserved: [...new Set(parts.flatMap((p) => p.reserved))],
  };
}
