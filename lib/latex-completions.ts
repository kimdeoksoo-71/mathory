/**
 * LaTeX 수식 자동완성 사전
 *
 * CodeMirror 6의 @codemirror/autocomplete와 연동하여
 * $ 또는 $$ 내부에서 \ 입력 시 자동완성 드롭다운을 표시합니다.
 */

import { ALL_SYMBOLS } from './math-symbols';

export interface LatexCompletionItem {
  /** 매칭 라벨 (예: '\\frac') */
  label: string;
  /** 설명 (예: '분수') */
  detail: string;
  /** 삽입될 텍스트 (예: '\\frac{}{}') */
  template: string;
  /** {} 개수 (Tab stop 활성화 판단용) */
  braceCount: number;
  /** 카테고리 (정렬/필터용) */
  category: string;
  /** 정렬 우선순위 (높을수록 위에 표시) */
  boost: number;
  /** 삽입 후 커서 위치(템플릿 시작 기준). 없으면 첫 {} 또는 끝. */
  cursorOffset?: number;
}

export const LATEX_COMPLETIONS: LatexCompletionItem[] = buildCompletions();

/**
 * 큐레이션 기호 데이터(lib/math-symbols.ts, ALL_SYMBOLS)에서 자동완성 항목 생성.
 * - latex가 \명령으로 시작하는 것만(유니코드/^{}/{}_.. 제외)
 * - 폰트 명령에 내용이 든 것(\mathrm{P}() 등) 제외
 * - label=선두 \명령, template=전체 latex, cursorOffset=커서 위치
 */
function buildCompletions(): LatexCompletionItem[] {
  const out: LatexCompletionItem[] = [];
  const FONT_CMD = /^\\(math[a-z]+|boldsymbol|pmb)$/;
  for (const sym of ALL_SYMBOLS) {
    if (!sym.katexSupported) continue;
    const latex = sym.latex;
    const m = latex.match(/^\\[a-zA-Z]+/);
    if (!m) continue;
    const cmd = m[0];
    const rest = latex.slice(cmd.length);
    if (FONT_CMD.test(cmd) && /[A-Za-z0-9]/.test(rest)) continue;
    out.push({
      label: cmd,
      detail: sym.name.ko,
      template: latex,
      braceCount: (latex.match(/\{\}/g) || []).length,
      category: sym.field,
      boost: (5 - sym.tier) * 20 + (sym.needsReview ? 0 : 4),
      cursorOffset: sym.cursorOffset,
    });
  }
  return out;
}


/**
 * 커서가 수식 모드 ($...$ 또는 $$...$$) 내부에 있는지 판별합니다.
 */
export function isInsideMath(doc: string, pos: number): boolean {
  let inDisplay = false;
  let inInline = false;
  let i = 0;

  while (i < pos) {
    // 이스케이프 처리 (\$)
    if (doc[i] === '\\' && i + 1 < doc.length && doc[i + 1] === '$') {
      i += 2;
      continue;
    }

    // $$ (display math)
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      if (inDisplay) {
        inDisplay = false;
      } else if (!inInline) {
        inDisplay = true;
      }
      i += 2;
      continue;
    }

    // $ (inline math)
    if (doc[i] === '$') {
      if (!inDisplay) {
        inInline = !inInline;
      }
      i += 1;
      continue;
    }

    i++;
  }

  return inInline || inDisplay;
}