/**
 * LaTeX 문법 오류 검사기
 *
 * CodeMirror 6의 @codemirror/lint과 연동하여
 * 수식 영역 내 LaTeX 문법 오류를 빨간색 물결 밑줄로 표시합니다.
 *
 * 검사 항목:
 * 1. 중괄호 {} 짝 불일치
 * 2. \begin{} / \end{} 짝 불일치
 * 3. 수식 구분자 ($, $$) 닫힘 누락
 * 4. 미등록(알 수 없는) LaTeX 명령어
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
  'operatorname', 'operatorname*',
  'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',

  // 환경
  'begin', 'end',

  // 기타
  'tag', 'tag*', 'label', 'ref', 'eqref',
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

  // 행렬/정렬
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'aligned', 'gathered', 'split', 'multline',
  'cases', 'rcases', 'array', 'subarray',
  'smallmatrix',

  // 수능/교육과정 특화
  'nPr', 'nCr',
  'xleftarrow', 'xrightarrow',
  'overparen', 'wideparen',
]);

// ── 알려진 환경 이름 ──────────────────────────────────
const KNOWN_ENVIRONMENTS = new Set([
  'aligned', 'align', 'align*', 'gathered', 'gather', 'gather*',
  'split', 'multline', 'multline*',
  'cases', 'rcases', 'array', 'subarray',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
  'smallmatrix', 'equation', 'equation*',
]);

// ── 수식 영역 파싱 ──────────────────────────────────
interface MathRegion {
  from: number;     // 구분자 포함 시작
  to: number;       // 구분자 포함 끝 (-1이면 닫히지 않음)
  innerFrom: number; // 내부 시작
  innerTo: number;   // 내부 끝
  type: 'inline' | 'display';
  delimiter: '$' | '$$';
}

function findMathRegions(doc: string): MathRegion[] {
  const regions: MathRegion[] = [];
  let i = 0;

  while (i < doc.length) {
    // $$ 블록 수식
    if (doc[i] === '$' && doc[i + 1] === '$') {
      const start = i;
      const innerStart = i + 2;
      const closeIdx = doc.indexOf('$$', innerStart);

      if (closeIdx === -1) {
        // 닫히지 않은 $$ — 문서 끝까지를 내부로 간주
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

    // $ 인라인 수식
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
        // 닫히지 않은 $ — 해당 줄 끝까지
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

// ── 검사 1: 닫히지 않은 수식 구분자 ──────────────────────────
function checkUnclosedDelimiters(doc: string, regions: MathRegion[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const region of regions) {
    if (region.to === -1) {
      const delimLen = region.delimiter.length;
      diagnostics.push({
        from: region.from,
        to: region.from + delimLen,
        severity: 'error',
        source: 'latex',
        message: `닫히지 않은 수식 구분자 ${region.delimiter}`,
      });
    }
  }

  return diagnostics;
}

// ── 검사 2: 중괄호 짝 불일치 ──────────────────────────────
function checkBraceMismatch(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);
  const stack: number[] = []; // 열린 중괄호의 절대 위치

  for (let i = 0; i < content.length; i++) {
    // 이스케이프된 중괄호 건너뛰기: \{ \}
    if (content[i] === '\\' && (content[i + 1] === '{' || content[i + 1] === '}')) {
      i++;
      continue;
    }
    // \text{} 등의 내부 중괄호도 정상 카운트
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

  // 닫히지 않은 여는 중괄호
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

// ── 검사 3: \begin{} / \end{} 짝 불일치 ──────────────────────
function checkBeginEndMismatch(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  const beginRegex = /\\begin\{([^}]*)\}/g;
  const endRegex = /\\end\{([^}]*)\}/g;

  interface EnvEntry {
    name: string;
    from: number; // 절대 위치
    to: number;
  }

  const begins: EnvEntry[] = [];
  const ends: EnvEntry[] = [];

  let match: RegExpExecArray | null;

  while ((match = beginRegex.exec(content)) !== null) {
    begins.push({
      name: match[1],
      from: region.innerFrom + match.index,
      to: region.innerFrom + match.index + match[0].length,
    });
  }

  while ((match = endRegex.exec(content)) !== null) {
    ends.push({
      name: match[1],
      from: region.innerFrom + match.index,
      to: region.innerFrom + match.index + match[0].length,
    });
  }

  // 스택 기반 매칭
  const stack: EnvEntry[] = [];
  const allEntries = [
    ...begins.map(b => ({ ...b, kind: 'begin' as const })),
    ...ends.map(e => ({ ...e, kind: 'end' as const })),
  ].sort((a, b) => a.from - b.from);

  for (const entry of allEntries) {
    if (entry.kind === 'begin') {
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
          // 가장 가까운 매칭을 시도
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }
  }

  // 닫히지 않은 \begin
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

// ── 검사 4: 미등록 LaTeX 명령어 ──────────────────────────────
function checkUnknownCommands(doc: string, region: MathRegion): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = doc.substring(region.innerFrom, region.innerTo);

  // \commandname 패턴 매칭 (알파벳으로 구성된 명령어만)
  const cmdRegex = /\\([a-zA-Z]+\*?)/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(content)) !== null) {
    const cmdName = match[1];

    // 알려진 명령어면 건너뛰기
    if (KNOWN_COMMANDS.has(cmdName)) continue;

    // * 없는 버전도 확인 (예: operatorname*)
    const baseName = cmdName.replace(/\*$/, '');
    if (KNOWN_COMMANDS.has(baseName)) continue;

    // 환경 이름으로도 확인
    if (KNOWN_ENVIRONMENTS.has(cmdName)) continue;

    const absFrom = region.innerFrom + match.index;
    diagnostics.push({
      from: absFrom,
      to: absFrom + match[0].length,
      severity: 'warning',
      source: 'latex',
      message: `알 수 없는 명령어: \\${cmdName}`,
    });
  }

  return diagnostics;
}

// ── 메인 lint 함수 ──────────────────────────────────
export function lintLaTeX(doc: string): Diagnostic[] {
  const regions = findMathRegions(doc);
  const diagnostics: Diagnostic[] = [];

  // 1. 닫히지 않은 구분자
  diagnostics.push(...checkUnclosedDelimiters(doc, regions));

  // 2~4. 각 수식 영역 내부 검사
  for (const region of regions) {
    diagnostics.push(...checkBraceMismatch(doc, region));
    diagnostics.push(...checkBeginEndMismatch(doc, region));
    diagnostics.push(...checkUnknownCommands(doc, region));
  }

  return diagnostics;
}
