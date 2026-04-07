/**
 * LaTeX 문법 오류 검사기 — Phase 17 강화판
 *
 * CodeMirror 6의 @codemirror/lint과 연동하여
 * 수식 영역 내 LaTeX 문법 오류를 빨간색 물결 밑줄로 표시합니다.
 *
 * ── 1단계: 구조적 검사 ──────────────────────────────
 * 1. 수식 구분자 ($, $$, \[, \], \(, \)) 닫힘 누락
 * 2. 중괄호 {} 짝 불일치
 * 3. \begin{} / \end{} 짝 불일치 + 환경 이름 오타
 * 4. \left / \right 짝 불일치
 * 5. 필수 인수 개수 검사 (\frac → 2개, \sqrt → 1개 등)
 * 6. & 정렬 기호가 환경 밖에서 사용된 경우
 * 7. 미등록(알 수 없는) LaTeX 명령어 + 오타 교정 제안
 *
 * ── 2단계: 명령어 검증 고도화 ──────────────────────────
 * 8. \hline, \cline 환경 밖 사용 감지
 * 9. \\ 줄바꿈이 인라인 수식에서 사용된 경우 경고
 * 10. \color, \textcolor 색상 이름 유효성 검사
 */

import { Diagnostic } from '@codemirror/lint';

// ── 알려진 LaTeX 명령어 목록 ──────────────────────────────────
// latex-completions.ts의 항목 + KaTeX에서 지원하는 추가 명령어
const KNOWN_COMMANDS = new Set([
  // 기본
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'overline', 'underline',
  'overbrace', 'underbrace', 'overrightarrow', 'overleftarrow',
  'widehat', 'widetilde', 'hat', 'tilde', 'bar', 'vec', 'dot', 'ddot',
  'acute', 'grave', 'check', 'breve',

  // 미적분
  'int', 'iint', 'iiint', 'oint', 'sum', 'prod', 'coprod',
  'lim', 'limsup', 'liminf', 'sup', 'inf',
  'partial', 'nabla',

  // 삼각/로그/함수
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'min', 'max', 'det', 'gcd', 'arg', 'deg', 'dim',
  'hom', 'ker', 'Pr',

  // 그리스 문자
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon',
  'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'varpi',
  'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon',
  'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi',
  'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',

  // 관계/연산자
  'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'simeq', 'cong',
  'propto', 'prec', 'succ', 'preceq', 'succeq',
  'in', 'notin', 'ni', 'subset', 'supset', 'subseteq', 'supseteq',
  'cap', 'cup', 'setminus', 'emptyset', 'varnothing',
  'forall', 'exists', 'nexists', 'neg', 'land', 'lor', 'implies', 'iff',
  'pm', 'mp', 'times', 'div', 'cdot', 'circ', 'star', 'ast', 'bullet',
  'oplus', 'otimes', 'odot',

  // 화살표
  'leftarrow', 'rightarrow', 'leftrightarrow',
  'Leftarrow', 'Rightarrow', 'Leftrightarrow',
  'uparrow', 'downarrow', 'updownarrow',
  'Uparrow', 'Downarrow',
  'longleftarrow', 'longrightarrow', 'longleftrightarrow',
  'Longleftarrow', 'Longrightarrow', 'Longleftrightarrow',
  'mapsto', 'longmapsto', 'hookrightarrow', 'hookleftarrow',
  'to', 'gets',

  // 점/공백
  'ldots', 'cdots', 'vdots', 'ddots', 'dots',
  'quad', 'qquad', 'enspace', 'thinspace',

  // 괄호/구분자
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
  'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil',
  'lvert', 'rvert', 'lVert', 'rVert',
  'lbrace', 'rbrace',

  // 서체/스타일
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal',
  'mathbb', 'mathfrak', 'mathscr',
  'boldsymbol', 'bold', 'bm',
  'text', 'textbf', 'textit', 'textrm', 'textsf',
  'operatorname',
  'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',

  // 환경
  'begin', 'end',

  // 기타
  'tag', 'label', 'ref', 'eqref',
  'color', 'textcolor', 'colorbox',
  'boxed', 'fbox', 'cancel', 'bcancel', 'xcancel', 'sout',
  'hline', 'cline',
  'phantom', 'hphantom', 'vphantom',
  'space', 'nobreakspace',
  'rule', 'kern', 'mkern', 'mskip', 'hskip',
  'not', 'stackrel', 'overset', 'underset', 'atop',
  'choose', 'binom', 'dbinom', 'tbinom',
  'prime', 'infty', 'angle', 'measuredangle',
  'triangle', 'square', 'diamond', 'clubsuit', 'diamondsuit',
  'heartsuit', 'spadesuit',
  'parallel', 'perp', 'because', 'therefore',
  'mid', 'nmid', 'backslash',
  'arraystretch',

  // 행렬/정렬
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'aligned', 'gathered', 'split', 'multline',
  'cases', 'rcases', 'array', 'subarray',
  'smallmatrix',

  // 수능/교육과정 특화
  'nPr', 'nCr',
  'xleftarrow', 'xrightarrow',
  'overparen', 'wideparen',

  // TeX 기본 명령어
  'def', 'let', 'newcommand', 'renewcommand',
  'DeclareMathOperator',
]);

// * 변형도 허용하는 명령어
const STAR_ALLOWED = new Set([
  'operatorname', 'tag', 'align', 'gather', 'equation', 'multline',
]);

// ── 알려진 환경 이름 ──────────────────────────────────
const KNOWN_ENVIRONMENTS = new Set([
  'aligned', 'align', 'align*', 'gathered', 'gather', 'gather*',
  'split', 'multline', 'multline*',
  'cases', 'rcases', 'array', 'subarray',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'smallmatrix', 'equation', 'equation*',
]);

// ── & 정렬 기호를 허용하는 환경 ──────────────────────────────
const ALIGNMENT_ENVIRONMENTS = new Set([
  'aligned', 'align', 'align*',
  'cases', 'rcases',
  'array', 'subarray',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'smallmatrix',
  'split',
]);

// ── \hline, \cline 을 허용하는 환경 ──────────────────────────
const TABULAR_ENVIRONMENTS = new Set([
  'array', 'subarray',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'smallmatrix',
]);

// ── KaTeX에서 지원하는 색상 이름 ──────────────────────────────
const KATEX_COLORS = new Set([
  // 표준 CSS/HTML 색상 이름 (KaTeX 지원)
  'black', 'blue', 'brown', 'cyan', 'darkgray', 'gray', 'green',
  'lightgray', 'lime', 'magenta', 'olive', 'orange', 'pink',
  'purple', 'red', 'teal', 'violet', 'white', 'yellow',
  // dvipsnames (KaTeX 지원)
  'Apricot', 'Aquamarine', 'Bittersweet', 'Black', 'Blue',
  'BlueGreen', 'BlueViolet', 'BrickRed', 'Brown', 'BurntOrange',
  'CadetBlue', 'CarnationPink', 'Cerulean', 'CornflowerBlue', 'Cyan',
  'Dandelion', 'DarkOrchid', 'Emerald', 'ForestGreen', 'Fuchsia',
  'Goldenrod', 'Gray', 'Green', 'GreenYellow', 'JungleGreen',
  'Lavender', 'LimeGreen', 'Magenta', 'Mahogany', 'Maroon',
  'Melon', 'MidnightBlue', 'Mulberry', 'NavyBlue', 'OliveGreen',
  'Orange', 'OrangeRed', 'Orchid', 'Peach', 'Periwinkle',
  'PineGreen', 'Plum', 'ProcessBlue', 'Purple', 'RawSienna',
  'Red', 'RedOrange', 'RedViolet', 'Rhodamine', 'RoyalBlue',
  'RoyalPurple', 'RubineRed', 'Salmon', 'SeaGreen', 'Sepia',
  'SkyBlue', 'SpringGreen', 'Tan', 'TealBlue', 'Thistle',
  'Turquoise', 'Violet', 'VioletRed', 'White', 'WildStrawberry',
  'Yellow', 'YellowGreen', 'YellowOrange',
]);

// ── 레벤슈타인 거리 (오타 교정용) ──────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // 짧은 배열만 사용하는 최적화
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // 삭제
        curr[j - 1] + 1,  // 삽입
        prev[j - 1] + cost // 교체
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/** 알려진 명령어 중 오타에 가장 가까운 후보를 반환 (거리 2 이내) */
function suggestCommand(unknown: string): string | null {
  let bestCmd = '';
  let bestDist = 3; // 거리 3 이상이면 추천 안 함

  for (const cmd of KNOWN_COMMANDS) {
    // 길이 차이가 너무 크면 스킵
    if (Math.abs(cmd.length - unknown.length) >= bestDist) continue;
    const d = levenshtein(unknown, cmd);
    if (d < bestDist) {
      bestDist = d;
      bestCmd = cmd;
    }
  }

  return bestDist <= 2 ? bestCmd : null;
}

/** 알려진 환경 중 오타에 가장 가까운 후보를 반환 (거리 2 이내) */
function suggestEnvironment(unknown: string): string | null {
  let bestEnv = '';
  let bestDist = 3;

  for (const env of KNOWN_ENVIRONMENTS) {
    if (Math.abs(env.length - unknown.length) >= bestDist) continue;
    const d = levenshtein(unknown, env);
    if (d < bestDist) {
      bestDist = d;
      bestEnv = env;
    }
  }

  return bestDist <= 2 ? bestEnv : null;
}

// ── 필수 인수 개수 ──────────────────────────────────
// 명령어 → 반드시 뒤따라야 하는 {} 인수의 최소 개수
const REQUIRED_ARGS: Record<string, number> = {
  frac: 2,
  dfrac: 2,
  tfrac: 2,
  cfrac: 2,
  binom: 2,
  dbinom: 2,
  tbinom: 2,
  overset: 2,
  underset: 2,
  stackrel: 2,
  textcolor: 2,
  colorbox: 2,
  sqrt: 1,
  text: 1,
  textbf: 1,
  textit: 1,
  textrm: 1,
  textsf: 1,
  mathrm: 1,
  mathbf: 1,
  mathit: 1,
  mathsf: 1,
  mathtt: 1,
  mathcal: 1,
  mathbb: 1,
  mathfrak: 1,
  mathscr: 1,
  boldsymbol: 1,
  overline: 1,
  underline: 1,
  overbrace: 1,
  underbrace: 1,
  overrightarrow: 1,
  overleftarrow: 1,
  widehat: 1,
  widetilde: 1,
  hat: 1,
  tilde: 1,
  bar: 1,
  vec: 1,
  dot: 1,
  ddot: 1,
  boxed: 1,
  cancel: 1,
  bcancel: 1,
  xcancel: 1,
  color: 1,
  operatorname: 1,
  phantom: 1,
  hphantom: 1,
  vphantom: 1,
};

// ── 수식 영역 파싱 ──────────────────────────────────
export interface MathRegion {
  from: number;       // 구분자 포함 시작
  to: number;         // 구분자 포함 끝 (-1이면 닫히지 않음)
  innerFrom: number;  // 내부 시작
  innerTo: number;    // 내부 끝
  type: 'inline' | 'display';
  delimiter: '$' | '$$' | '\\(' | '\\[';
}

export function findMathRegions(doc: string): MathRegion[] {
  const regions: MathRegion[] = [];
  let i = 0;

  while (i < doc.length) {
    // ── \[...\] 블록 수식 ──
    if (doc[i] === '\\' && doc[i + 1] === '[') {
      const start = i;
      const innerStart = i + 2;
      const closeIdx = doc.indexOf('\\]', innerStart);

      if (closeIdx === -1) {
        regions.push({
          from: start, to: -1,
          innerFrom: innerStart, innerTo: doc.length,
          type: 'display', delimiter: '\\[',
        });
        break;
      }

      regions.push({
        from: start, to: closeIdx + 2,
        innerFrom: innerStart, innerTo: closeIdx,
        type: 'display', delimiter: '\\[',
      });
      i = closeIdx + 2;
      continue;
    }

    // ── \(...\) 인라인 수식 ──
    if (doc[i] === '\\' && doc[i + 1] === '(') {
      const start = i;
      const innerStart = i + 2;
      const closeIdx = doc.indexOf('\\)', innerStart);

      if (closeIdx === -1) {
        regions.push({
          from: start, to: -1,
          innerFrom: innerStart, innerTo: doc.length,
          type: 'inline', delimiter: '\\(',
        });
        break;
      }

      regions.push({
        from: start, to: closeIdx + 2,
        innerFrom: innerStart, innerTo: closeIdx,
        type: 'inline', delimiter: '\\(',
      });
      i = closeIdx + 2;
      continue;
    }

    // ── $$ 블록 수식 ──
    if (doc[i] === '$' && doc[i + 1] === '$') {
      const start = i;
      const innerStart = i + 2;
      const closeIdx = doc.indexOf('$$', innerStart);

      if (closeIdx === -1) {
        regions.push({
          from: start, to: -1,
          innerFrom: innerStart, innerTo: doc.length,
          type: 'display', delimiter: '$$',
        });
        break;
      }

      regions.push({
        from: start, to: closeIdx + 2,
        innerFrom: innerStart, innerTo: closeIdx,
        type: 'display', delimiter: '$$',
      });
      i = closeIdx + 2;
      continue;
    }

    // ── $ 인라인 수식 ──
    if (doc[i] === '$' && (i === 0 || doc[i - 1] !== '\\')) {
      const start = i;
      const innerStart = i + 1;
      let closeIdx = -1;

      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        // 빈 줄을 만나면 인라인 수식 종료
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }

      if (closeIdx === -1) {
        const lineEnd = doc.indexOf('\n', innerStart);
        regions.push({
          from: start, to: -1,
          innerFrom: innerStart, innerTo: lineEnd === -1 ? doc.length : lineEnd,
          type: 'inline', delimiter: '$',
        });
        i = (lineEnd === -1 ? doc.length : lineEnd);
        continue;
      }

      regions.push({
        from: start, to: closeIdx + 1,
        innerFrom: innerStart, innerTo: closeIdx,
        type: 'inline', delimiter: '$',
      });
      i = closeIdx + 1;
      continue;
    }

    i++;
  }

  return regions;
}

// ══════════════════════════════════════════════════
//  검사 1: 닫히지 않은 수식 구분자
// ══════════════════════════════════════════════════
function checkUnclosedDelimiters(regions: MathRegion[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const region of regions) {
    if (region.to === -1) {
      const delimLen = region.delimiter.length;
      const delimDisplay = region.delimiter === '\\[' ? '\\[...\\]'
        : region.delimiter === '\\(' ? '\\(...\\)'
        : region.delimiter;
      diagnostics.push({
        from: region.from,
        to: region.from + delimLen,
        severity: 'error',
        source: 'latex',
        message: `닫히지 않은 수식 구분자 ${delimDisplay}`,
      });
    }
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 2: 중괄호 짝 불일치
// ══════════════════════════════════════════════════
function checkBraceMismatch(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);
  const stack: number[] = [];

  for (let i = 0; i < content.length; i++) {
    // 이스케이프된 중괄호: \{ \}
    if (content[i] === '\\' && (content[i + 1] === '{' || content[i + 1] === '}')) {
      i++;
      continue;
    }
    // \\ (줄바꿈) 건너뛰기
    if (content[i] === '\\' && content[i + 1] === '\\') {
      i++;
      continue;
    }
    // \command 건너뛰기 (이스케이프 뒤 알파벳)
    if (content[i] === '\\' && i + 1 < content.length && /[a-zA-Z]/.test(content[i + 1])) {
      i++;
      while (i < content.length && /[a-zA-Z]/.test(content[i])) i++;
      i--; // for 루프의 i++ 보정
      continue;
    }

    if (content[i] === '{') {
      stack.push(region.innerFrom + i);
    } else if (content[i] === '}') {
      if (stack.length === 0) {
        diagnostics.push({
          from: region.innerFrom + i,
          to: region.innerFrom + i + 1,
          severity: 'error',
          source: 'latex',
          message: '대응하는 여는 중괄호 { 없음',
        });
      } else {
        stack.pop();
      }
    }
  }

  for (const pos of stack) {
    diagnostics.push({
      from: pos,
      to: pos + 1,
      severity: 'error',
      source: 'latex',
      message: '대응하는 닫는 중괄호 } 없음',
    });
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 3: \begin{} / \end{} 짝 불일치 + 환경 이름 오타
// ══════════════════════════════════════════════════
interface EnvEntry {
  name: string;
  from: number;
  to: number;
  kind: 'begin' | 'end';
}

function parseEnvironments(doc: string, region: MathRegion): EnvEntry[] {
  const content = doc.substring(region.innerFrom, region.innerTo);
  const entries: EnvEntry[] = [];

  const beginRegex = /\\begin\{([^}]*)\}/g;
  const endRegex = /\\end\{([^}]*)\}/g;

  let match: RegExpExecArray | null;

  while ((match = beginRegex.exec(content)) !== null) {
    entries.push({
      name: match[1],
      from: region.innerFrom + match.index,
      to: region.innerFrom + match.index + match[0].length,
      kind: 'begin',
    });
  }

  while ((match = endRegex.exec(content)) !== null) {
    entries.push({
      name: match[1],
      from: region.innerFrom + match.index,
      to: region.innerFrom + match.index + match[0].length,
      kind: 'end',
    });
  }

  entries.sort((a, b) => a.from - b.from);
  return entries;
}

function checkBeginEndMismatch(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const entries = parseEnvironments(doc, region);
  const stack: EnvEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'begin') {
      // 환경 이름 오타 검사 + 교정 제안
      if (entry.name && !KNOWN_ENVIRONMENTS.has(entry.name)) {
        const suggestion = suggestEnvironment(entry.name);
        const hint = suggestion ? ` → 혹시 ${suggestion}?` : '';
        diagnostics.push({
          from: entry.from,
          to: entry.to,
          severity: 'warning',
          source: 'latex',
          message: `알 수 없는 환경: ${entry.name}${hint}`,
        });
      }
      stack.push(entry);
    } else {
      if (stack.length === 0) {
        diagnostics.push({
          from: entry.from,
          to: entry.to,
          severity: 'error',
          source: 'latex',
          message: `대응하는 \\begin{${entry.name}} 없음`,
        });
      } else {
        const top = stack[stack.length - 1];
        if (top.name !== entry.name) {
          diagnostics.push({
            from: entry.from,
            to: entry.to,
            severity: 'error',
            source: 'latex',
            message: `환경 불일치: \\begin{${top.name}} ↔ \\end{${entry.name}}`,
          });
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }
  }

  for (const entry of stack) {
    diagnostics.push({
      from: entry.from,
      to: entry.to,
      severity: 'error',
      source: 'latex',
      message: `대응하는 \\end{${entry.name}} 없음`,
    });
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 4: \left / \right 짝 불일치
// ══════════════════════════════════════════════════
function checkLeftRightMismatch(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  // \left 와 \right 위치 수집
  // \left( \left[ \left\{ \left| \left. \left\langle 등
  // (?![a-zA-Z]) 로 \rightarrow / \leftarrow / \Rightarrow 등 다른 명령어와 충돌 방지
  const leftRightRegex = /\\(left|right)(?![a-zA-Z])\s*([(\[|.]|\\[a-zA-Z{}]+)?/g;

  interface LREntry {
    kind: 'left' | 'right';
    from: number;
    to: number;
  }

  const entries: LREntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = leftRightRegex.exec(content)) !== null) {
    entries.push({
      kind: match[1] as 'left' | 'right',
      from: region.innerFrom + match.index,
      to: region.innerFrom + match.index + match[0].length,
    });
  }

  // 스택 기반 매칭
  const stack: LREntry[] = [];

  for (const entry of entries) {
    if (entry.kind === 'left') {
      stack.push(entry);
    } else {
      if (stack.length === 0) {
        diagnostics.push({
          from: entry.from,
          to: entry.to,
          severity: 'error',
          source: 'latex',
          message: '대응하는 \\left 없음',
        });
      } else {
        stack.pop();
      }
    }
  }

  for (const entry of stack) {
    diagnostics.push({
      from: entry.from,
      to: entry.to,
      severity: 'error',
      source: 'latex',
      message: '대응하는 \\right 없음',
    });
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 5: 필수 인수 개수 검사
// ══════════════════════════════════════════════════
function checkRequiredArgs(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  const cmdRegex = /\\([a-zA-Z]+)\s*/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(content)) !== null) {
    const cmdName = match[1];
    const required = REQUIRED_ARGS[cmdName];
    if (required === undefined) continue;

    // \begin, \end 는 별도 검사
    if (cmdName === 'begin' || cmdName === 'end') continue;

    // 명령어 끝 위치에서 {} 인수 개수 세기
    let pos = match.index + match[0].length;
    let argCount = 0;

    // [] 옵션 인수 건너뛰기 (예: \sqrt[3]{})
    if (pos < content.length && content[pos] === '[') {
      let depth = 1;
      pos++;
      while (pos < content.length && depth > 0) {
        if (content[pos] === '[') depth++;
        else if (content[pos] === ']') depth--;
        pos++;
      }
      // [] 뒤 공백 건너뛰기
      while (pos < content.length && content[pos] === ' ') pos++;
    }

    // {} 인수 세기
    while (pos < content.length && content[pos] === '{') {
      let depth = 1;
      pos++;
      while (pos < content.length && depth > 0) {
        if (content[pos] === '\\' && (content[pos + 1] === '{' || content[pos + 1] === '}')) {
          pos += 2;
          continue;
        }
        if (content[pos] === '{') depth++;
        else if (content[pos] === '}') depth--;
        pos++;
      }
      argCount++;
      // 다음 {} 까지 공백 건너뛰기
      while (pos < content.length && content[pos] === ' ') pos++;
    }

    if (argCount < required) {
      const absFrom = region.innerFrom + match.index;
      diagnostics.push({
        from: absFrom,
        to: absFrom + match[0].trimEnd().length,
        severity: 'error',
        source: 'latex',
        message: `\\${cmdName}은(는) 인수 ${required}개 필요 (현재 ${argCount}개)`,
      });
    }
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 6: & 정렬 기호 환경 밖 사용
// ══════════════════════════════════════════════════
function checkAmpersandOutsideEnv(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  // & 가 하나도 없으면 즉시 반환
  if (!content.includes('&')) return diagnostics;

  // 환경 범위 파악
  const envEntries = parseEnvironments(doc, region);

  // 환경 내부 범위를 수집 (중첩 포함)
  interface EnvRange { from: number; to: number; name: string }
  const envRanges: EnvRange[] = [];
  const stack: { name: string; from: number }[] = [];

  for (const entry of envEntries) {
    if (entry.kind === 'begin') {
      stack.push({ name: entry.name, from: entry.to });
    } else if (stack.length > 0) {
      const top = stack.pop()!;
      if (ALIGNMENT_ENVIRONMENTS.has(top.name)) {
        envRanges.push({ from: top.from, to: entry.from, name: top.name });
      }
    }
  }

  // & 위치 검사
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '&') continue;

    // \& 이스케이프 건너뛰기
    if (i > 0 && content[i - 1] === '\\') continue;

    const absPos = region.innerFrom + i;

    // 환경 범위 안에 있는지 확인
    const inEnv = envRanges.some(r => absPos >= r.from && absPos < r.to);

    if (!inEnv) {
      diagnostics.push({
        from: absPos,
        to: absPos + 1,
        severity: 'warning',
        source: 'latex',
        message: '& 정렬 기호가 정렬 환경 밖에서 사용됨',
      });
    }
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 7: 미등록 LaTeX 명령어
// ══════════════════════════════════════════════════
function checkUnknownCommands(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  const cmdRegex = /\\([a-zA-Z]+\*?)/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(content)) !== null) {
    const cmdName = match[1];

    // 알려진 명령어
    if (KNOWN_COMMANDS.has(cmdName)) continue;

    // * 변형 허용 확인
    const baseName = cmdName.replace(/\*$/, '');
    if (KNOWN_COMMANDS.has(baseName)) continue;
    if (STAR_ALLOWED.has(baseName)) continue;

    // 환경 이름으로도 확인
    if (KNOWN_ENVIRONMENTS.has(cmdName)) continue;

    const absFrom = region.innerFrom + match.index;
    const suggestion = suggestCommand(cmdName.replace(/\*$/, ''));
    const hint = suggestion ? ` → 혹시 \\${suggestion}?` : '';
    diagnostics.push({
      from: absFrom,
      to: absFrom + match[0].length,
      severity: 'warning',
      source: 'latex',
      message: `알 수 없는 명령어: \\${cmdName}${hint}`,
    });
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 8: \hline, \cline 환경 밖 사용 감지
// ══════════════════════════════════════════════════
function checkHlineOutsideEnv(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  // \hline 또는 \cline{} 패턴 매칭
  const hlineRegex = /\\(hline|cline)\b/g;
  let match: RegExpExecArray | null;

  // 탈출: 해당 영역에 \hline/\cline이 없으면 즉시 반환
  if (!content.includes('\\hline') && !content.includes('\\cline')) return diagnostics;

  // 환경 범위 파악
  const envEntries = parseEnvironments(doc, region);
  interface EnvRange { from: number; to: number; name: string }
  const envRanges: EnvRange[] = [];
  const stack: { name: string; from: number }[] = [];

  for (const entry of envEntries) {
    if (entry.kind === 'begin') {
      stack.push({ name: entry.name, from: entry.to });
    } else if (stack.length > 0) {
      const top = stack.pop()!;
      if (TABULAR_ENVIRONMENTS.has(top.name)) {
        envRanges.push({ from: top.from, to: entry.from, name: top.name });
      }
    }
  }

  while ((match = hlineRegex.exec(content)) !== null) {
    const absPos = region.innerFrom + match.index;
    const inEnv = envRanges.some(r => absPos >= r.from && absPos < r.to);

    if (!inEnv) {
      diagnostics.push({
        from: absPos,
        to: absPos + match[0].length,
        severity: 'warning',
        source: 'latex',
        message: `\\${match[1]}은(는) array/matrix 환경 안에서만 사용 가능`,
      });
    }
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 9: \\ 줄바꿈이 인라인 수식에서 사용된 경우
// ══════════════════════════════════════════════════
function checkLineBreakInInline(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 인라인 수식만 검사
  if (region.type !== 'inline') return diagnostics;

  const content = doc.substring(region.innerFrom, region.innerTo);

  // \\ 패턴 찾기 (단, \\\와 같은 경우는 제외)
  let i = 0;
  while (i < content.length - 1) {
    if (content[i] === '\\' && content[i + 1] === '\\') {
      // \\\ 패턴인지 확인 (3번째 \가 있으면 건너뛰기)
      if (i + 2 < content.length && content[i + 2] === '\\') {
        i += 3;
        continue;
      }

      // 환경(aligned, cases 등) 내부의 \\는 허용
      const envEntries = parseEnvironments(doc, region);
      const absPos = region.innerFrom + i;

      interface EnvRange { from: number; to: number }
      const envRanges: EnvRange[] = [];
      const envStack: { from: number }[] = [];

      for (const entry of envEntries) {
        if (entry.kind === 'begin') {
          envStack.push({ from: entry.to });
        } else if (envStack.length > 0) {
          const top = envStack.pop()!;
          envRanges.push({ from: top.from, to: entry.from });
        }
      }

      const inEnv = envRanges.some(r => absPos >= r.from && absPos < r.to);

      if (!inEnv) {
        diagnostics.push({
          from: absPos,
          to: absPos + 2,
          severity: 'warning',
          source: 'latex',
          message: '인라인 수식($...$)에서 \\\\ 줄바꿈은 동작하지 않음 — $$...$$로 변경 필요',
        });
      }

      i += 2;
      continue;
    }
    i++;
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  검사 10: \color, \textcolor 색상 이름 유효성 검사
// ══════════════════════════════════════════════════
function checkColorNames(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  // \color{name} 또는 \textcolor{name}{...} 패턴
  // #hex 형식도 허용
  const colorRegex = /\\(color|textcolor)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = colorRegex.exec(content)) !== null) {
    const colorName = match[2].trim();

    // 빈 값 — 인수 부족으로 이미 검사 5에서 처리
    if (!colorName) continue;

    // #hex 형식 허용 (#RGB, #RRGGBB, #RRGGBBAA)
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(colorName)) continue;

    // 알려진 색상 이름 확인
    if (KATEX_COLORS.has(colorName)) continue;

    const absFrom = region.innerFrom + match.index;
    // 색상 이름 부분만 밑줄
    const colorStart = absFrom + match[0].indexOf(colorName);
    diagnostics.push({
      from: colorStart,
      to: colorStart + colorName.length,
      severity: 'warning',
      source: 'latex',
      message: `알 수 없는 색상: "${colorName}" — 예: red, blue, #FF0000`,
    });
  }

  return diagnostics;
}

// ══════════════════════════════════════════════════
//  메인 lint 함수
// ══════════════════════════════════════════════════
export function lintLaTeX(doc: string): Diagnostic[] {
  const regions = findMathRegions(doc);
  const diagnostics: Diagnostic[] = [];

  // 1. 닫히지 않은 구분자
  diagnostics.push(...checkUnclosedDelimiters(regions));

  // 2~10. 각 수식 영역 내부 검사
  for (const region of regions) {
    diagnostics.push(...checkBraceMismatch(doc, region));
    diagnostics.push(...checkBeginEndMismatch(doc, region));
    diagnostics.push(...checkLeftRightMismatch(doc, region));
    diagnostics.push(...checkRequiredArgs(doc, region));
    diagnostics.push(...checkAmpersandOutsideEnv(doc, region));
    diagnostics.push(...checkUnknownCommands(doc, region));
    // 2단계 추가
    diagnostics.push(...checkHlineOutsideEnv(doc, region));
    diagnostics.push(...checkLineBreakInInline(doc, region));
    diagnostics.push(...checkColorNames(doc, region));
  }

  return diagnostics;
}