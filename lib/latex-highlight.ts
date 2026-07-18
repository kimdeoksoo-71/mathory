import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

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

  let i = 0;
  let lastMathEnd = 0;

  while (i < doc.length) {
    // \[...\] 블록 수식
    if (doc[i] === '\\' && doc[i + 1] === '[') {
      const start = i;
      const innerStart = i + 2;
      const endIdx = doc.indexOf('\\]', innerStart);
      if (endIdx === -1) { i++; continue; }

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      decorations.push({ from: start, to: endIdx + 2, deco: mathRegionStyle });
      decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
      decorations.push({ from: endIdx, to: endIdx + 2, deco: delimiterStyle });

      highlightMathContent(doc, innerStart, endIdx, decorations);

      lastMathEnd = endIdx + 2;
      i = endIdx + 2;
      continue;
    }

    // \(...\) 인라인 수식
    if (doc[i] === '\\' && doc[i + 1] === '(') {
      const start = i;
      const innerStart = i + 2;
      const endIdx = doc.indexOf('\\)', innerStart);
      if (endIdx === -1) { i++; continue; }

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      decorations.push({ from: start, to: endIdx + 2, deco: mathRegionStyle });
      decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
      decorations.push({ from: endIdx, to: endIdx + 2, deco: delimiterStyle });

      highlightMathContent(doc, innerStart, endIdx, decorations);

      lastMathEnd = endIdx + 2;
      i = endIdx + 2;
      continue;
    }

    // $$ 블록 수식 — $$ 도 예외 없이 항상 수식 구분자로 취급
    if (doc[i] === '$' && doc[i + 1] === '$') {
      const start = i;
      const innerStart = i + 2;
      const end = doc.indexOf('$$', innerStart);

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      if (end !== -1) {
        // 닫는 $$ 있음 → 정상 블록 수식
        decorations.push({ from: start, to: end + 2, deco: mathRegionStyle });
        decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
        decorations.push({ from: end, to: end + 2, deco: delimiterStyle });
        highlightMathContent(doc, innerStart, end, decorations);
        lastMathEnd = end + 2;
        i = end + 2;
      } else {
        // 닫는 $$ 없음 → 여는 $$ 로 보고 줄 끝까지 수식 영역으로 일관 처리.
        // (인라인 $ 와 동일한 경계 규칙 — 아래 줄까지 번지는 요동 방지)
        let lineEnd = innerStart;
        while (lineEnd < doc.length && doc[lineEnd] !== '\n') lineEnd++;
        decorations.push({ from: start, to: lineEnd, deco: mathRegionStyle });
        decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
        highlightMathContent(doc, innerStart, lineEnd, decorations);
        lastMathEnd = lineEnd;
        i = lineEnd;
      }
      continue;
    }

    // $ 인라인 수식 — $ 는 예외 없이 항상 수식 구분자로 취급 (통화 기호로 쓰지 않음).
    // ($$ 는 위에서 이미 처리되므로 여기서는 단일 $ 만 남음)
    if (doc[i] === '$' && doc[i - 1] !== '$' && doc[i + 1] !== '$') {
      const start = i;
      const innerStart = i + 1;
      let end = -1;

      for (let j = innerStart; j < doc.length; j++) {
        // 인라인 수식($...$)은 한 줄 안으로 제한 — 줄을 넘으면 닫힘으로 보지 않음.
        // (줄 넘김 허용 시, 타이핑 중 $ 짝이 잠깐 어긋나면 아래 줄의 $를 닫힘으로 오인해
        //  활성 행 이하가 통째로 수식으로 칠해져 색·글꼴이 매 타이핑마다 요동침)
        if (doc[j] === '\n') break;
        if (doc[j] === '$' && doc[j - 1] !== '\\' && doc[j + 1] !== '$') {
          end = j;
          break;
        }
      }

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      if (end !== -1) {
        // 닫는 $ 있음 → 정상 인라인 수식
        decorations.push({ from: start, to: end + 1, deco: mathRegionStyle });
        decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
        decorations.push({ from: end, to: end + 1, deco: delimiterStyle });
        highlightMathContent(doc, innerStart, end, decorations);
        lastMathEnd = end + 1;
        i = end + 1;
      } else {
        // 닫는 $ 없음 → 열린 $ 로 보고 줄 끝까지 수식 영역으로 일관 처리.
        // (타이핑 중이라도 여는 $ 직후부터 즉시 수식 색·글꼴 → 닫을 때 요동 없음)
        let lineEnd = innerStart;
        while (lineEnd < doc.length && doc[lineEnd] !== '\n') lineEnd++;
        decorations.push({ from: start, to: lineEnd, deco: mathRegionStyle });
        decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
        highlightMathContent(doc, innerStart, lineEnd, decorations);
        lastMathEnd = lineEnd;
        i = lineEnd;
      }
      continue;
    }

    i++;
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