/**
 * math-highlight.ts
 *
 * CodeMirror 6 확장: 미리보기에서 수식을 클릭했을 때 편집창에서 강조.
 * - 수식 텍스트: 연한 노란색 mark decoration (미리보기와 동일 톤)
 * - 행 강조는 커서 위치 기반 활성 행 배경으로 충분 → 별도 거터 음영 없음
 * - StateEffect로 외부(MarkdownEditor 핸들)에서 범위 주입. 문서 편집 시 자동 해제.
 */

import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration } from '@codemirror/view';

export interface MathHighlightRange {
  from: number;
  to: number;
}

export const setMathHighlightEffect = StateEffect.define<MathHighlightRange | null>();

const markDeco = Decoration.mark({ class: 'cm-math-hl' });

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
    // 수식 텍스트: 노란 mark
    return EditorView.decorations.compute([field], (state) => {
      const r = clampRange(state.field(field), state.doc.length);
      if (!r) return Decoration.none;
      const builder = new RangeSetBuilder<Decoration>();
      builder.add(r[0], r[1], markDeco);
      return builder.finish();
    });
  },
});

export const mathHighlightTheme = EditorView.baseTheme({
  '.cm-math-hl': {
    backgroundColor: 'rgba(255, 224, 51, 0.30)', // 연한 노랑 (수식, 미리보기와 동일)
    borderRadius: '2px',
  },
});
