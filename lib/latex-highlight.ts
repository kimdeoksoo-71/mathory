import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// 스타일 정의
const baseTextStyle = Decoration.mark({ class: 'cm-base-text' });
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

      decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
      decorations.push({ from: endIdx, to: endIdx + 2, deco: delimiterStyle });

      highlightMathContent(doc, innerStart, endIdx, decorations);

      lastMathEnd = endIdx + 2;
      i = endIdx + 2;
      continue;
    }
    
    // $$ 블록 수식
    if (doc[i] === '$' && doc[i + 1] === '$') {
      const start = i;
      const innerStart = i + 2;
      const end = doc.indexOf('$$', innerStart);
      if (end === -1) { i++; continue; }

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
      decorations.push({ from: end, to: end + 2, deco: delimiterStyle });

      highlightMathContent(doc, innerStart, end, decorations);

      lastMathEnd = end + 2;
      i = end + 2;
      continue;
    }

    // $ 인라인 수식
    if (doc[i] === '$' && (i === 0 || doc[i - 1] !== '$') && (i + 1 < doc.length && doc[i + 1] !== '$')) {
      const start = i;
      const innerStart = i + 1;
      let end = -1;

      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          end = j;
          break;
        }
        if (doc[j] === '\n' && doc[j + 1] === '\n') break;
      }

      if (end === -1) { i++; continue; }

      if (start > lastMathEnd) {
        decorations.push({ from: lastMathEnd, to: start, deco: baseTextStyle });
      }

      decorations.push({ from: start, to: innerStart, deco: delimiterStyle });
      decorations.push({ from: end, to: end + 1, deco: delimiterStyle });

      highlightMathContent(doc, innerStart, end, decorations);

      lastMathEnd = end + 1;
      i = end + 1;
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

    if (doc[i] === '{' || doc[i] === '}') {
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
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const latexHighlightTheme = EditorView.baseTheme({
  '.cm-base-text': { color: '#4d4d4d' },
  '.cm-math-delimiter': { color: '#e53935', fontWeight: 'bold' },
  '.cm-latex-command': { color: '#1565c0' },
  '.cm-latex-brace': { color: '#2e7d32', fontWeight: 'bold' },
});