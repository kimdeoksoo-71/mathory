/**
 * math-highlight.ts
 *
 * CodeMirror 6 확장: 미리보기에서 수식을 클릭했을 때 편집창에서 강조.
 * - 수식이 속한 행의 "행번호 거터" 영역: 연한 회색 (gutterLineClass)
 * - 수식 텍스트: 연한 노란색 mark decoration (미리보기와 동일 톤)
 * - StateEffect로 외부(MarkdownEditor 핸들)에서 범위 주입. 문서 편집 시 자동 해제.
 */

import { StateField, StateEffect, RangeSetBuilder, RangeSet } from '@codemirror/state';
import { EditorView, Decoration, gutterLineClass, GutterMarker } from '@codemirror/view';

export interface MathHighlightRange {
  from: number;
  to: number;
}

export const setMathHighlightEffect = StateEffect.define<MathHighlightRange | null>();

const markDeco = Decoration.mark({ class: 'cm-math-hl' });

class MathGutterMarker extends GutterMarker {
  elementClass = 'cm-math-gutter-hl';
}
const gutterMarker = new MathGutterMarker();

function clampRange(range: MathHighlightRange | null, docLen: number): [number, number] | null {
  if (!range) return null;
  const from = Math.max(0, Math.min(range.from, docLen));
  const to = Math.max(0, Math.min(range.to, docLen));
  return from < to ? [from, to] : null;
}

export const mathHighlightField = StateField.define<MathHighlightRange | null>({
  create() {
    return null;
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMathHighlightEffect)) return effect.value;
    }
    if (tr.docChanged && value) return null; // 편집하면 해제
    return value;
  },

  provide(field) {
    return [
      // 수식 텍스트: 노란 mark
      EditorView.decorations.compute([field], (state) => {
        const r = clampRange(state.field(field), state.doc.length);
        if (!r) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        builder.add(r[0], r[1], markDeco);
        return builder.finish();
      }),
      // 행번호 거터: 회색
      gutterLineClass.compute([field], (state) => {
        const r = clampRange(state.field(field), state.doc.length);
        if (!r) return RangeSet.empty;
        const doc = state.doc;
        const startLine = doc.lineAt(r[0]).number;
        const endLine = doc.lineAt(r[1]).number;
        const builder = new RangeSetBuilder<GutterMarker>();
        for (let ln = startLine; ln <= endLine; ln++) {
          const line = doc.line(ln);
          builder.add(line.from, line.from, gutterMarker);
        }
        return builder.finish();
      }),
    ];
  },
});

export const mathHighlightTheme = EditorView.baseTheme({
  '.cm-math-gutter-hl': {
    backgroundColor: 'rgba(0, 0, 0, 0.07)', // 행번호 거터 회색
  },
  '.cm-math-hl': {
    backgroundColor: 'rgba(255, 224, 51, 0.30)', // 연한 노랑 (수식, 미리보기와 동일)
    borderRadius: '2px',
  },
});
