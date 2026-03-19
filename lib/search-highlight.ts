/**
 * search-highlight.ts
 *
 * CodeMirror 6 확장: 찾기/바꾸기 매치를 Decoration으로 하이라이트
 *
 * - StateEffect로 매치 목록과 활성 인덱스를 외부에서 주입
 * - 활성 매치: 주황색 배경, 나머지 매치: 연한 노란색 배경
 * - MarkdownEditor의 useImperativeHandle에서 호출
 */

import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

/* ── 매치 데이터 ── */

export interface SearchMatch {
  from: number;
  to: number;
}

interface SearchHighlightState {
  matches: SearchMatch[];
  activeIndex: number; // -1 = 없음
}

/* ── StateEffect: 외부에서 매치를 주입 ── */

export const setSearchHighlightsEffect = StateEffect.define<SearchHighlightState>();
export const clearSearchHighlightsEffect = StateEffect.define<null>();

/* ── Decoration 마크 ── */

const activeMatchDeco = Decoration.mark({ class: 'cm-search-match-active' });
const inactiveMatchDeco = Decoration.mark({ class: 'cm-search-match' });

/* ── StateField: 매치 목록을 보관하고 Decoration 생성 ── */

export const searchHighlightField = StateField.define<SearchHighlightState>({
  create() {
    return { matches: [], activeIndex: -1 };
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchHighlightsEffect)) {
        return effect.value;
      }
      if (effect.is(clearSearchHighlightsEffect)) {
        return { matches: [], activeIndex: -1 };
      }
    }

    // 문서가 변경되면 매치를 초기화 (편집 중에는 FindReplacePanel이 재검색)
    if (tr.docChanged && value.matches.length > 0) {
      return { matches: [], activeIndex: -1 };
    }

    return value;
  },

  provide(field) {
    return EditorView.decorations.from(field, (state) => {
      if (state.matches.length === 0) return Decoration.none;

      const builder = new RangeSetBuilder<Decoration>();

      // 정렬 보장 (from 오름차순)
      const sorted = [...state.matches].sort((a, b) => a.from - b.from);

      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i];
        if (m.from >= m.to) continue;

        // 원래 matches 배열에서의 인덱스를 찾아서 activeIndex와 비교
        const originalIdx = state.matches.indexOf(m);
        const isActive = originalIdx === state.activeIndex;

        builder.add(m.from, m.to, isActive ? activeMatchDeco : inactiveMatchDeco);
      }

      return builder.finish();
    });
  },
});

/* ── 테마: 매치 배경색 ── */

export const searchHighlightTheme = EditorView.baseTheme({
  '.cm-search-match': {
    backgroundColor: 'rgba(255, 235, 59, 0.45)', // 연한 노란색
    borderRadius: '2px',
  },
  '.cm-search-match-active': {
    backgroundColor: 'rgba(255, 152, 0, 0.55)', // 주황색
    borderRadius: '2px',
    outline: '1px solid rgba(255, 152, 0, 0.7)',
  },
});