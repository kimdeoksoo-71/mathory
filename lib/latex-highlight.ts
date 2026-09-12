import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { scanMathRegions } from './mathRegions';

// 스타일 정의
const baseTextStyle = Decoration.mark({ class: 'cm-base-text' });
// 수식 범위 전체(구분자~내부 변수·숫자 포함)를 고정폭(D2Coding)으로. command/brace 마크와
// 중첩되며, 이 마크는 font만, command/brace는 color만 바꾸므로 색·폰트가 함께 적용됨.
const mathRegionStyle = Decoration.mark({ class: 'cm-math-region' });
const delimiterStyle = Decoration.mark({ class: 'cm-math-delimiter' });
const latexCommandStyle = Decoration.mark({ class: 'cm-latex-command' });
const latexBraceStyle = Decoration.mark({ class: 'cm-latex-brace' });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const decorations: { from: number; to: number; deco: Decoration }[] = [];

  let lastMathEnd = 0;

  /* M7 D3 — 영역 판정은 `lib/mathRegions.ts` 하나다(R-$$: 같은 행에 닫는 `$$`가 없는 `$$`는 빈 인라인 쌍).
     `inlineSingleLine`: 단일 `$`의 닫는 짝을 같은 행에서만 — 아래 줄의 `$`를 닫힘으로 오인해
     활성 행 이하가 통째로 수식 색이 되어 타이핑마다 요동치는 것을 막는다(하이라이터 전용 옵션).
     미닫힘은 종전대로 **행 끝까지만** 수식 색(여는 구분자 직후부터 즉시 → 닫을 때 요동 없음). */
  for (const r of scanMathRegions(doc, { inlineSingleLine: true })) {
    if (r.from > lastMathEnd) {
      decorations.push({ from: lastMathEnd, to: r.from, deco: baseTextStyle });
    }
    if (r.empty) {
      // 빈 `$|$` — 두 `$`만 구분자 색
      decorations.push({ from: r.from, to: r.to, deco: mathRegionStyle });
      decorations.push({ from: r.from, to: r.to, deco: delimiterStyle });
      lastMathEnd = r.to;
      continue;
    }
    const delimLen = r.delimiter.length;
    if (r.closed) {
      decorations.push({ from: r.from, to: r.to, deco: mathRegionStyle });
      decorations.push({ from: r.from, to: r.innerFrom, deco: delimiterStyle });
      decorations.push({ from: r.innerTo, to: r.innerTo + delimLen, deco: delimiterStyle });
      highlightMathContent(doc, r.innerFrom, r.innerTo, decorations);
      lastMathEnd = r.to;
      continue;
    }
    let lineEnd = r.innerFrom;
    while (lineEnd < doc.length && doc[lineEnd] !== '\n') lineEnd++;
    decorations.push({ from: r.from, to: lineEnd, deco: mathRegionStyle });
    decorations.push({ from: r.from, to: r.innerFrom, deco: delimiterStyle });
    highlightMathContent(doc, r.innerFrom, lineEnd, decorations);
    lastMathEnd = lineEnd;
  }

  if (lastMathEnd < doc.length) {
    decorations.push({ from: lastMathEnd, to: doc.length, deco: baseTextStyle });
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const d of decorations) {
    if (d.from < d.to) {
      builder.add(d.from, d.to, d.deco);
    }
  }

  return builder.finish();
}

function highlightMathContent(
  doc: string,
  from: number,
  to: number,
  decorations: { from: number; to: number; deco: Decoration }[]
) {
  let i = from;

  while (i < to) {
    if (doc[i] === '\\' && i + 1 < to && /[a-zA-Z]/.test(doc[i + 1])) {
      const start = i;
      i += 1;
      while (i < to && /[a-zA-Z]/.test(doc[i])) i++;
      decorations.push({ from: start, to: i, deco: latexCommandStyle });
      continue;
    }

    if (doc[i] === '{' || doc[i] === '}' || doc[i] === '(' || doc[i] === ')' || doc[i] === '[' || doc[i] === ']') {
      decorations.push({ from: i, to: i + 1, deco: latexBraceStyle });
      i++;
      continue;
    }

    i++;
  }
}

export const latexHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // 한글 IME 조합 중에는 decoration 재빌드 스킵 (재빌드 시 IME DOM이 흔들려 자소 분리됨).
      // 단, 그냥 두면 데코레이션이 옛 위치에 멈춰 삽입 길이만큼 어긋나 커서 이하 색·글꼴이 요동침.
      // → 재빌드 대신 변경에 맞춰 매핑만 하여 위치를 따라가게 함.
      if (update.view.composing) {
        if (update.docChanged) {
          this.decorations = this.decorations.map(update.changes);
        }
        return;
      }
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// 편집창 모든 글자 굵기 400 통일 — 구분은 색으로만.
// 텍스트=진한 회색 / 수식 본문(영문·연산자·숫자·\·명령어)=차분한 네이비 / 괄호류($ ( ) [ ] { })=벽돌빛 딥레드.
const SYNTAX_NAVY = '#3a5275';  // 차분한 네이비 (수식 본문)
const SYNTAX_RED = '#a23f2e';   // 벽돌빛 딥레드 (괄호·구분자)
export const latexHighlightTheme = EditorView.baseTheme({
  // 일반 텍스트(한글 등): Pretendard + 톤다운 회색
  '.cm-base-text': { color: 'var(--text-secondary, #5D5647)', fontWeight: '400' },
  // 수식 영역: 고정폭 D2Coding(0.95em) + 네이비 기본색. 괄호류만 아래에서 레드로 덮음.
  '.cm-math-region': {
    fontFamily: 'var(--font-mono)', fontSize: '0.95em',
    color: SYNTAX_NAVY, fontWeight: '400',
  },
  // 구분자($ \[ \]) · 괄호류({ } ( ) [ ]): 벽돌빛 딥레드 — 텍스트와 명확히 구별
  '.cm-math-delimiter': { color: SYNTAX_RED, fontWeight: '400' },
  '.cm-latex-brace': { color: SYNTAX_RED, fontWeight: '400' },
  // 명령어(\neq 등): 수식 본문과 동일 네이비
  '.cm-latex-command': { color: SYNTAX_NAVY, fontWeight: '400' },
});