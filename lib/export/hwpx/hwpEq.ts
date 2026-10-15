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

/**
 * 해설의 `(1)`·`(2)`… → `㉠`·`㉡`…(덕수 2026-10-16 — 해설의 `\tag{n}`이 `⋯⋯⋯ ㉠`이 되므로 인용하는 `(n)`도 같은 글자로.
 * 해설에서 `(n)`이 다른 뜻으로 쓰일 일은 없다). 1~14만 — 그 밖은 그대로. 글자 문단과 수식 안 `\text{…}`가 쓴다
 */
export function circleRefs(text: string): string {
  return text.replace(/\((\d{1,2})\)/g, (m, n: string) => {
    const r = refMark(n);
    return r === n ? m : r;
  });
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

/* ═══ 여러 줄 display → 행마다 수식 하나(덕수 2026-10-15) ═══ */

/**
 * 정렬은 하지 않는다(덕수 2026-10-15 — `&` 자리를 공백으로 맞추는 근사는 폐기). 행마다 문제-수식·해설-수식 문단이고
 * 모두 그 스타일의 왼쪽 여백에서 시작한다.
 */
export interface DisplaySplit {
  /** 행 LaTeX(`&`는 지웠다 — 칸 쌍 사이만 `\quad`) */
  rows: string[];
  /** 환경 앞 조각(`\text{ - }` 글머리 등) — 첫 행 앞에 붙는다 */
  prefix?: string;
  /** 환경 뒤 조각(마침표 등) — 마지막 행 끝에 붙는다 */
  suffix?: string;
}

const ALIGN_ENVS = ['aligned', 'align', 'alignat', 'alignedat', 'split', 'eqnarray', 'flalign'];
const GATHER_ENVS = ['gathered', 'gather', 'multline'];

/**
 * 깊이 0(중괄호 밖 · 다른 환경 밖)에서 `\\` → 행, `&` → 칸. `\\[4pt]`의 크기 인수는 버린다.
 * splitRows와 달리 **환경 깊이도 센다** — 행 안의 `\begin{cases} a \\ b \end{cases}`를 쪼개지 않는다.
 */
function scanCells(body: string): string[][] {
  const rows: string[][] = [[]];
  let cur = '';
  let depth = 0;
  let envDepth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') {
      const rest = body.slice(i);
      const env = /^\\(begin|end)\s*\{[a-zA-Z]+\*?\}/.exec(rest);
      if (env) { envDepth += env[1] === 'begin' ? 1 : -1; cur += env[0]; i += env[0].length - 1; continue; }
      if (body[i + 1] === '\\' && depth === 0 && envDepth === 0) {
        rows[rows.length - 1].push(cur);
        rows.push([]);
        cur = '';
        i += 1;
        const opt = /^\s*\[[^\]]*\]/.exec(body.slice(i + 1));
        if (opt) i += opt[0].length;
        continue;
      }
      cur += ch + (body[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === '&' && depth === 0 && envDepth === 0) { rows[rows.length - 1].push(cur); cur = ''; continue; }
    cur += ch;
  }
  rows[rows.length - 1].push(cur);
  return rows;
}

/** 환경 앞뒤 조각으로 받아도 되는가 — 행을 가로지르는 것(`\left\{`·다른 환경·`&`·`\\`)이 없고 중괄호가 맞을 때만 */
function isFlatPiece(x: string): boolean {
  if (/\\(left|right|begin|end)(?![a-zA-Z])|&|\\\\/.test(x.replace(/\\&/g, ''))) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === '\\') { i++; continue; }
    if (x[i] === '{') d++;
    if (x[i] === '}' && --d < 0) return false;
  }
  return d === 0;
}

/**
 * display 수식이 `aligned`·`gathered` 계열 환경 **하나**(+ 앞뒤 평평한 조각)면 행으로 나눈다 — 아니면 null(한 수식 그대로).
 * `&`는 지운다 — 칸 쌍 사이(`a &= b & c &= d`의 b·c 사이)만 `\quad`(eqnarray `&=&`는 붙여 쓴다). 정렬은 하지 않는다.
 */
export function splitDisplayRows(latex: string): DisplaySplit | null {
  const t = latex.trim();
  const first = /\\begin\s*\{([a-zA-Z]+)(\*?)\}/.exec(t);
  if (!first) return null;
  const prefix = t.slice(0, first.index).trim();
  if (prefix && !isFlatPiece(prefix)) return null;
  const s = t.slice(first.index);
  const base = first[1];
  const align = ALIGN_ENVS.includes(base);
  const single = base === 'array' || base === 'darray';            // 한 열 array{l}(덕수 2026-10-16 — `$$\begin{array}{l} … \\ \Rightarrow … \end{array}$$`)
  if (!align && !GATHER_ENVS.includes(base) && !single) return null;
  // 여는 환경의 짝 \end — 그 뒤는 suffix
  const tokRe = /\\(begin|end)\s*\{[a-zA-Z]+\*?\}/g;
  let depth = 0;
  let closeAt = -1;
  let suffix = '';
  for (let m = tokRe.exec(s); m; m = tokRe.exec(s)) {
    depth += m[1] === 'begin' ? 1 : -1;
    if (depth === 0) { closeAt = m.index; suffix = s.slice(tokRe.lastIndex).trim(); break; }
  }
  if (closeAt < 0 || (suffix && !isFlatPiece(suffix))) return null;
  const extra = { ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) };
  let body = s.slice(first[0].length, closeAt);
  const opt = /^\s*\[[^\]]*\]/.exec(body);                       // aligned[t]
  if (opt) body = body.slice(opt[0].length);
  if (base === 'alignat' || base === 'alignedat') {               // {열 수}
    const n = /^\s*\{[^{}]*\}/.exec(body);
    if (n) body = body.slice(n[0].length);
  }
  if (single) {                                                     // 열 지정이 한 열(l·c·r 하나)일 때만 — 여러 열이면 표다
    const n = /^\s*\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(body);
    if (!n || n[1].replace(/[^lcr]/g, '').length !== 1) return null;
    body = body.slice(n[0].length);
  }
  const cells = scanCells(body)
    .map((cs) => cs.map((c) => c.trim()))
    .filter((cs) => cs.some((c) => c !== ''));
  if (cells.length === 0) return null;
  const rows = cells.map((cs) => {
    if (!align) return cs.join(' ');
    return cs.reduce((acc, c, k) => {
      if (k === 0) return c;
      // 첫 `&`(정렬점)는 그냥 붙이고, 칸 쌍(r&l) 사이(`a &= b & c &= d`의 b·c 사이)만 띄운다 · eqnarray `&=&`는 붙여 쓴다
      const sep = base !== 'eqnarray' && k % 2 === 0 ? ' \\quad ' : ' ';
      return acc + sep + c;
    }, '').trim();
  });
  return { rows, ...extra };
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
    // 칸 사이 1em(`~~`) — LaTeX cases의 `@{\quad}`와 같다(PDF는 typst quadCases). 없으면 식과 조건이 붙는다(덕수 실물 2026-10-15)
    const inner = padded.map((row) => row.replace(/&/g, '& ~~')).join(' # ');
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

/**
 * `\left\{ \begin{array|aligned|…} … \end{…} \right.` → `\begin{cases} … \end{cases}`(덕수 실물 2026-10-16 — S-7).
 * 옛 판은 `left lbrace matrix{…} right none`을 냈고 한글이 `right none`을 못 읽어 수식이 깨졌다(`‖ one`).
 * 덤프에서 이 꼴이 107개(array 105 · aligned 2) — 한글 `cases{}`가 같은 모양을 그린다.
 */
const BRACE_CASE_ENVS = ['array', 'darray', 'aligned', 'alignedat', 'matrix', 'smallmatrix', 'gathered', 'split'];
function leftBraceToCases(s: string): string {
  const openRe = /\\left\s*(?:\\\{|\\lbrace)\s*\\begin\s*\{([a-zA-Z]+)\*?\}/g;
  let out = '';
  let from = 0;
  for (let m = openRe.exec(s); m; m = openRe.exec(s)) {
    if (!BRACE_CASE_ENVS.includes(m[1])) continue;
    // 여는 환경의 짝 \end
    const tokRe = /\\(begin|end)\s*\{[a-zA-Z]+\*?\}/g;
    tokRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let endAt = -1;
    let endLen = 0;
    for (let t = tokRe.exec(s); t; t = tokRe.exec(s)) {
      depth += t[1] === 'begin' ? 1 : -1;
      if (depth === 0) { endAt = t.index; endLen = t[0].length; break; }
    }
    if (endAt < 0) continue;
    const close = /^\s*\\right\s*\./.exec(s.slice(endAt + endLen));
    if (!close) continue;
    let body = s.slice(m.index + m[0].length, endAt);
    const opt = /^\s*\[[^\]]*\]/.exec(body);                       // aligned[t]
    if (opt) body = body.slice(opt[0].length);
    if (/^(array|darray|alignedat)$/.test(m[1])) {                  // 열 지정 {ll}·{2}
      const r = readArg(body, 0);
      if (r && /^\s*\{/.test(body)) body = body.slice(r.end);
    }
    out += s.slice(from, m.index) + `\\begin{cases}${body}\\end{cases}`;
    from = endAt + endLen + close[0].length;
    openRe.lastIndex = from;
  }
  return out + s.slice(from);
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

/** `refs` = 해설 수식 — `\text{…(n)…}`·`\because (n)`의 `(n)`을 `㉠`으로(맨 `(n)`은 `f(2)` 같은 인자와 섞여 건드리지 않는다) */
export function latexToHwp(latex: string, opts: { refs?: boolean } = {}): HwpEqResult {
  const unknown = new Set<string>();
  const texts: string[] = [];
  const keep = (s: string) => { texts.push(s); return `\u0001${texts.length - 1}\u0002`; };
  let s = latex;

  // G8 — 명령·\text 밖의 영문 낱말 중 예약어(원문 기준)
  const bare = s.replace(/\\(?:text|textrm|mbox|mathrm|operatorname|begin|end)\s*\{[^{}]*\}/g, ' ').replace(/\\[a-zA-Z]+/g, ' ');
  const reserved = [...new Set([...bare.matchAll(/[A-Za-z]+/g)].map((m) => m[0]).filter((w) => w.length > 1 && RESERVED.has(w.toLowerCase())))];

  // ⑤ 인용 표지 · ② 글자 보호
  if (opts.refs) s = s.replace(/\\because\s*\((\d{1,2})\)/g, (m, n: string) => (refMark(n) === n ? m : `\\because \\mathoryref{${n}}`));
  s = s.replace(/\\mathoryref\{(\d+)\}/g, (_, n: string) => keep(`"${refMark(n)}"`));
  // `~`(LaTeX 붙은 공백)는 한글 따옴표 안에서 글자 그대로 찍힌다 → 공백으로(따옴표 안 공백은 한글이 보존한다)
  s = replaceMacro(s, [...TEXT_CMDS], 1, ([t]) => keep(`"${(opts.refs ? circleRefs(t) : t).replace(/"/g, "''").replace(/\$/g, '').replace(/~|\\[ ,;:]/g, ' ')}"`));
  // ⑥ 크기·장식 명령
  s = s.replace(/\\([a-zA-Z]+)(?![a-zA-Z])/g, (m, name: string) => (DROP.has(name) ? ' ' : m));
  s = replaceMacro(s, [...DROP_ARG], 1, () => ' ');

  // 미분 기호 — md2hwp 규칙: 백틱 1 + ' N개
  s = s.replace(/\\prime/g, "'");
  s = s.replace(/\^\s*\{\s*('+)\s*\}/g, (_, p: string) => '`' + p);
  s = s.replace(/\^\s*('+)/g, (_, p: string) => '`' + p);
  s = s.replace(/(?<![`'])('+)/g, (_, p: string) => '`' + p);

  // 환경(행렬·cases·eqalign·pile) — `\left\{ 환경 \right.`은 먼저 cases로
  s = leftBraceToCases(s);
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
    // `\right.` → 아무것도 내지 않는다(덕수 2026-10-16 — 한글은 `right none`을 못 읽어 `‖ one`으로 그렸고,
    // `left [ …`만 두면 왼쪽 괄호 하나로 여러 행을 묶는 모양을 그린다). `\left.`은 탐침(D-보이지않는괄호) 결과 대기
    if (side === 'right' && d === '.') return ' ';
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
