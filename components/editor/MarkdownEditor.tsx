'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { EditorView } from 'codemirror';
import { keymap, tooltips } from '@codemirror/view';
import { EditorState, Prec, Compartment, Extension } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { autocompletion, CompletionContext, Completion } from '@codemirror/autocomplete';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
// search 하이라이트는 커스텀 FindReplacePanel + StateField로 처리
import { latexHighlightPlugin, latexHighlightTheme } from '../../lib/latex-highlight';
import { buildMathIndex, isInsideMathRange, crossesDisplayMath, containsDisplayMath } from '../../lib/mathIndex';
import {
  SearchMatch,
  searchHighlightField,
  searchHighlightTheme,
  setSearchHighlightsEffect,
  clearSearchHighlightsEffect,
} from '../../lib/search-highlight';
import {
  mathHighlightField,
  mathHighlightTheme,
  setMathHighlightEffect,
} from '../../lib/math-highlight';
import { LATEX_COMPLETIONS, isInsideMath } from '../../lib/latex-completions';
import { lintLaTeX } from '../../lib/latex-linter';
import { computeRevealScrollLeft } from '../../lib/editorScroll';

/* ═══ Phase 65 — 줄바꿈 켬/끔 (⌥Z) ═══════════════════════════════════
   CodeMirror의 "줄을 접는가"는 **클래스가 아니라 computed white-space**로 정해진다
   (dist 6195-6200: measure마다 getComputedStyle(contentDOM).whiteSpace를 읽어
   heightOracle.mustRefreshForWrapping에 넘긴다. 클래스를 보는 6118은 초기 추측 1회뿐).
   그래서 facet(EditorView.lineWrapping)과 테마를 **함께** 갈아야 높이 오라클이
   정확히 따라온다 — 셋을 Compartment 하나에 묶는 이유다.

   ⚠ 두 상수를 모듈 최상위에 둔 것은 의도다. 토글마다 EditorView.theme()를 새로
     만들면 StyleModule이 매번 다시 마운트된다. CM theme은 KaTeX macros와 달리
     in-place 수정이 없어 상수 공유가 안전하다.
   ⚠ 끔 모드의 `overflow-y: hidden`은 **안전장치가 아니라 의도 표시**다. hidden은
     프로그램적 스크롤을 막지 못한다(실측: 고정 높이 박스에서 scrollTop이 32px 밀린다).
     세로가 안전한 진짜 이유는 이 스크롤러의 높이가 auto로 풀려 여지가 0이기 때문이고,
     그래서 **블록 CM 체인에 고정 높이를 주면 안 된다**(계획서 D14).
   ⚠ overscroll-behavior-x: Mac 트랙패드 가로 스와이프가 끝에서 브라우저 뒤로가기로
     새어 나가는 것을 막는다. 편집 중 뒤로가기는 곧 편집 화면 이탈이다. */
const WRAP_ON: Extension = [
  EditorView.lineWrapping,
  EditorView.theme({
    '.cm-content': { whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
    // 내부 자체 스크롤 없음 — 모든 스크롤은 외곽 컨테이너(.scaled-editor)가 담당
    '.cm-scroller': { overflow: 'visible' },
  }),
];

/* ═══ 끔 모드의 거터는 sticky 가 아니라 **fixed** 다 (2026-09-09 덕수 검수 반영) ═══════
   증상: 좌우 스크롤이 끝에 닿아 **튕길 때(러버밴드)** 행번호 거터가 본문과 함께 튕겼다.
   원인: `position: sticky` 요소는 스크롤러의 *스크롤 콘텐츠 레이어* 안에 있다. 튕김은 컴포지터가
   그 레이어를 통째로 탄성 이동시키는 효과라 sticky 도 같이 움직인다. 이때 `scrollLeft` 는 변하지
   않으므로 scroll 이벤트도 없고 프로그램적 스크롤로는 **절대 재현되지 않는다** — 어제 프로브 3회가
   전부 빗나간 이유다(영상 프레임 실측: 왼쪽 끝 튕김에 "1" 이 본문과 함께 오른쪽으로 밀렸다 복귀).
   처방: 스크롤러에 `transform` 을 주어 `position: fixed` 자손의 containing block 으로 만들고,
   거터를 fixed 로 뺀다. fixed 요소는 스크롤 오프셋(튕김 포함)의 영향권 밖이면서 containing block
   (= 이 블록의 스크롤러)에 붙어 있으므로 블록을 따라 움직이고 튕김에는 반응하지 않는다.
   커서·선택 레이어(`.cm-layer`)는 스크롤러 안에 그대로라 **본문과 함께 튕긴다**(의도).
   ⚠ `!important` 는 CM 이 인라인으로 박는 `position: sticky`(dist 11152)를 이기기 위해 필수.
   ⚠ fixed 는 흐름에서 빠지므로 거터 자리를 `padding-left: var(--gutter-w)` 로 되살린다 —
     값은 ResizeObserver 가 실제 거터 폭(3자리 확장 포함)을 공급한다(아래 마운트 코드).
   ⚠ CM 의 `scrollMargins` 제공자(dist 11282)는 `fixed` 플래그(=unfixGutters 미설정)만 보고
     `dom.offsetWidth` 를 왼쪽 마진으로 내보내므로, 타자·화살표의 캐럿 노출도 거터 폭을 그대로 뺀다.
   ⚠ `.cm-editor` 에 transform 이 생기면 거기 마운트되는 CM 툴팁(자동완성·lint, 기본 `view.dom`)이
     `position: fixed` 좌표를 잃고 래퍼 `overflow:hidden` 에 갇힌다 → `tooltips({ parent })` 로 툴팁을
     에디터 밖으로 뺀다(CM 공식 옵션). z-index 는 테마의 `.cm-tooltip` 이 준다.
   ⚠ 그 parent 는 **body 가 아니라 아래 `tooltipHost()`(0×0 fixed)** 다 (M7 D25′, 2026-09-12 사고):
     CM 은 parent 안에 컨테이너 div 를 만들고 `className = view.themeClasses` 를 통째로 붙인다(dist 10143-10146).
     그래서 `EditorView.theme({ '&': … })` 의 **모든 `&` 규칙이 그 컨테이너에도 적용**된다 — body 직속이던
     때 아래 테마의 `'&': { height: '100%' }` 가 뷰포트 높이 div 를 블록 수만큼 body 끝에 쌓아
     문서가 넘쳤다(실측: 블록 3개 → 713px × 3 = 2139px 넘침, 켬·끔 동일 — 편집창 휠 끝에서 화면
     전체가 밀려 올라가던 버그). 호스트가 0×0 이면 `height:100%` 는 0 의 100% 이고 transform 이 새도
     문서 높이에 닿을 수 없다. ⚠ 호스트에 `overflow`·`transform` 을 주지 말 것 — 툴팁이 잘리거나
     좌표를 잃는다.
   ⚠ 켬 모드는 손대지 않는다 — 튕길 스크롤이 없고, 기본값은 현행과 바이트 단위로 같아야 한다(D2). */
/* M7 D25′ — CM 툴팁 전용 호스트. 위 주석 참조. 마운트 effect 안에서만 부른다(SSR 에 document 가 없다).
   top/left 0 이라 CM 의 두 갈래(켬: fixed 그대로 / 끔: 컨테이너 transform → makeAbsolute, 컨테이너 rect 기준)가
   같은 좌표로 수렴한다. z-index 는 `.cm-tooltip` 테마와 같은 10200 — 드로어(50) 위·다이얼로그(10500) 아래. */
const TOOLTIP_HOST_ID = 'cm-tooltip-host';
function tooltipHost(): HTMLElement {
  let el = document.getElementById(TOOLTIP_HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOOLTIP_HOST_ID;
    Object.assign(el.style, { position: 'fixed', top: '0', left: '0', width: '0', height: '0', zIndex: '10200' });
    document.body.appendChild(el);
  }
  return el;
}

const WRAP_OFF: Extension = EditorView.theme({
  '.cm-content': { whiteSpace: 'pre' },
  /* ⚠ transform 은 스크롤러가 아니라 **.cm-editor(&)** 에 둔다. 스크롤러에 두면 fixed 거터의
       containing block 이 스크롤러 자신이 되어 *스크롤 콘텐츠의 일부*로 취급된다 — 실측:
       scrollLeft 400 에서 거터가 −400 으로 본문과 함께 밀렸다. containing block 이 스크롤러
       바깥이어야 스크롤 오프셋(튕김 포함)의 영향권 밖이 된다. */
  '&': { transform: 'translate(0)' },          // fixed 거터의 containing block (identity — 좌표 불변)
  '.cm-scroller': {
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'thin',   // Firefox 등 ::-webkit-scrollbar 미적용 브라우저 보정
    paddingLeft: 'var(--gutter-w, 0px)',       // 흐름에서 빠진 거터 자리
  },
  '.cm-gutters': {
    position: 'fixed !important',
    top: '0',
    bottom: '0',
    left: '0',
    height: 'auto',                            // base theme 의 100% 대신 top/bottom 으로 늘린다
  },
});

const wrapExtensions = (on: boolean): Extension => (on ? WRAP_ON : WRAP_OFF);

/* 행번호 색 (2026-09-08 덕수) — 본문보다 **덜 눈에 띄게**: Mathory 레드 계열을 옅게 깐다.
   ⚠ 하드코딩 rgba를 토큰과 따로 두면 토큰을 바꿀 때 조용히 어긋난다(Phase 62 `78a780f` 사고).
     그래서 color-mix로 토큰을 직접 섞고, 미지원 브라우저에만 같은 값의 rgba를 쓴다.
   ⚠ 상태 표시가 아니라 **보조 정보**라 3:1 대비 규약(Phase 59 G1)의 대상이 아니다 — 오히려
     본문보다 약해야 한다는 것이 요구사항이다. */
const mixOK = typeof CSS !== 'undefined'
  && CSS.supports?.('color', 'color-mix(in srgb, red 50%, transparent)');
const GUTTER_NUM = mixOK
  ? 'color-mix(in srgb, var(--mathory-red) 55%, transparent)'
  : 'rgba(217, 119, 87, 0.55)';                    // = --mathory-red #D97757 55%
const GUTTER_NUM_ACTIVE = mixOK
  ? 'color-mix(in srgb, var(--mathory-red-dark) 85%, transparent)'
  : 'rgba(188, 95, 63, 0.85)';                     // = --mathory-red-dark #BC5F3F 85%

/** 커서 활동 정보 (Phase 56 D12 — MarkdownEditor / SortableEditorBlock / EditorView 3곳 공유).
 *  blockId 는 MarkdownEditor 자신은 모르므로 상위 래퍼가 주입한다. */
export interface CursorActivityInfo {
  line: number;
  offset: number;
  /** 이 트랜잭션이 문서를 바꿨는가 (선택만 바뀐 경우와 구분) */
  docChanged: boolean;
  /** 마우스 클릭으로 인한 선택인가 (화살표 키 이동과 구분) */
  pointerSelect: boolean;
  blockId: string;
}

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  autoHeight?: boolean;
  onSnippetShortcut?: (index: number) => void;
  onCursorActivity?: (info: Omit<CursorActivityInfo, 'blockId'>) => void;
  /** Phase 65: 줄바꿈 켬(기본) / 끔이면 긴 줄이 접히지 않고 블록 안에서 좌우 스크롤된다. */
  lineWrap?: boolean;
}

export interface MarkdownEditorHandle {
  insertText: (text: string, cursorOffset: number) => void;
  /** M7 D1·D4 — 인라인 수식 스마트 삽입(`$` 버튼 · Ctrl+N,M 공용). 선택이 있으면 `$sel$`로 감싸고
   *  커서는 닫는 `$` 뒤, 없으면 `$|$`. 삽입 지점 바로 앞/뒤 글자가 `$`이면 그쪽에 공백 1을 함께 넣는다
   *  (마크다운은 `$a$$b$`를 수식 하나 `a$$b`로 읽는다 — micromark 실측). 단일 dispatch = undo 1스텝. */
  insertInlineMath: () => void;
  /** Phase 61c: 채팅→편집창 삽입 전용. `insertText`와 달리 `{}` 탭스톱·커서 점프가 없다 */
  insertPlainText: (text: string) => void;
  getCursorPosition: () => number;
  getContent: () => string;
  setContent: (text: string) => void;
  setSelection: (from: number, to: number) => void;
  clearSelection: () => void;
  replaceRange: (from: number, to: number, text: string) => void;
  focus: () => void;
  /** 커서 위치의 화면 좌표 반환 */
  getCursorCoords: () => { top: number; left: number } | null;
  /** Phase 65: 커서가 가로로 보이도록 블록 스크롤러를 민다 (줄바꿈 끔 전용, 켬이면 무동작).
   *  ⚠ 반드시 focus() **뒤**에 부를 것 — CM의 focus 관찰자가 scrollTop이 0이면
   *  저장해 둔 scrollLeft를 복원하는데(dist 5124-5129), 우리는 scrollTop이 늘 0이다. */
  revealCursorX: () => void;
  /** 검색 매치 하이라이트 (Decoration) 설정 */
  setSearchHighlights: (matches: SearchMatch[], activeIndex: number) => void;
  /** 검색 매치 하이라이트 해제 */
  clearSearchHighlights: () => void;
  /** 수식 클릭 하이라이트 (행 회색 + 수식 노랑) */
  highlightMath: (from: number, to: number) => void;
  /** 수식 클릭 하이라이트 해제 */
  clearMathHighlight: () => void;
  /** 이 에디터가 실제로 포커스를 갖고 있는가.
   *  프로그램적 dispatch(clearSelection 등)가 유발한 cursorActivity를 걸러내는 데 쓴다. */
  hasFocus: () => boolean;
  /** 한글 IME 조합 중인가. 조합 중 스크롤/데코레이션 변동은 조합을 깨뜨린다. */
  isComposing: () => boolean;
  /** 선택 영역이 비어 있는가(= 커서만 있음). 드래그로 범위를 잡은 상태와 구분한다. */
  isSelectionEmpty: () => boolean;
  /** Phase 58 P3 — 선택 영역을 key sentence(`**…**`)로 감싸거나 해제한다.
   *  반환값: 'wrapped' 감쌈 / 'unwrapped' 해제 / 'rejected' 규칙 위반으로 거부. */
  toggleKeyWrap: () => KeyWrapResult;
}

export type KeyWrapResult = 'wrapped' | 'unwrapped' | 'rejected';

/* M7 D1·D4 — 인라인 수식 스마트 삽입. 핸들(`$` 버튼)과 chord(Ctrl+N,M)가 같은 함수를 쓴다.
   ⚠ `$ $`(안쪽 공백)로 바꾸지 말 것 — 소스에 공백이 영구히 남고 인접 `$` 문제는 그대로다(M7 P1 기각).
   공백은 **인접 `$`일 때만**: `$x$` 바로 앞에서 누르면 `$|$ $x$`, 바로 뒤면 `$x$ $|$`. */
function insertInlineMathIn(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const pre = from > 0 && doc.sliceString(from - 1, from) === '$' ? ' ' : '';
  const post = to < doc.length && doc.sliceString(to, to + 1) === '$' ? ' ' : '';
  const sel = doc.sliceString(from, to);
  const insert = `${pre}$${sel}$${post}`;
  const anchor = sel ? from + pre.length + sel.length + 2 : from + pre.length + 1;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor }, userEvent: 'input' });
  view.focus();
}

// ── 보편적 괄호/수식 탈출 헬퍼 (Shift+Esc용) ──────────────
// 커서를 감싸는 가장 안쪽 괄호 또는 수식 기호의 닫는 위치+1 반환
function findInnermostExit(doc: string, cursor: number): number {
  const candidates: number[] = [];

  // 1) 괄호 쌍 검사: (), {}, []
  const pairs: [string, string][] = [['(', ')'], ['{', '}'], ['[', ']']];
  for (const [open, close] of pairs) {
    // 커서 왼쪽으로 스캔하며 매칭 안 된 여는 괄호 찾기
    let depth = 0;
    let foundOpen = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (doc[i] === close) depth++;
      else if (doc[i] === open) {
        if (depth === 0) { foundOpen = i; break; }
        depth--;
      }
    }
    if (foundOpen === -1) continue;

    // 커서 오른쪽으로 매칭되는 닫는 괄호 찾기
    depth = 0;
    for (let i = cursor; i < doc.length; i++) {
      if (doc[i] === open) depth++;
      else if (doc[i] === close) {
        if (depth === 0) { candidates.push(i + 1); break; }
        depth--;
      }
    }
  }

  // 2) $$ 블록 수식 검사
  let searchStart = 0;
  while (searchStart < doc.length) {
    const openIdx = doc.indexOf('$$', searchStart);
    if (openIdx === -1) break;
    const innerStart = openIdx + 2;
    const closeIdx = doc.indexOf('$$', innerStart);
    if (closeIdx === -1) break;
    if (cursor >= innerStart && cursor <= closeIdx) {
      candidates.push(closeIdx + 2);
    }
    searchStart = closeIdx + 2;
  }

  // 3) $ 인라인 수식 검사
  let i = 0;
  while (i < doc.length) {
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 2;
      continue;
    }
    if (doc[i] === '$') {
      const innerStart = i + 1;
      let closeIdx = -1;
      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }
      if (closeIdx !== -1 && cursor >= innerStart && cursor <= closeIdx) {
        candidates.push(closeIdx + 1);
      }
      if (closeIdx !== -1) {
        i = closeIdx + 1;
      } else {
        i++;
      }
      continue;
    }
    i++;
  }

  if (candidates.length === 0) return -1;
  // 가장 안쪽(닫는 위치가 가장 가까운) 후보 반환
  return Math.min(...candidates);
}

// ── 수식 영역 범위 반환 (Alt+Tab 중괄호 순회용) ──────────────
function findMathRegion(doc: string, cursor: number): { start: number; end: number } | null {
  // 1) $$ 블록 수식
  let searchStart = 0;
  while (searchStart < doc.length) {
    const openIdx = doc.indexOf('$$', searchStart);
    if (openIdx === -1) break;
    const innerStart = openIdx + 2;
    const closeIdx = doc.indexOf('$$', innerStart);
    if (closeIdx === -1) break;
    if (cursor >= innerStart && cursor <= closeIdx) {
      return { start: innerStart, end: closeIdx };
    }
    searchStart = closeIdx + 2;
  }

  // 2) $ 인라인 수식
  let i = 0;
  while (i < doc.length) {
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 2;
      continue;
    }
    if (doc[i] === '$') {
      const innerStart = i + 1;
      let closeIdx = -1;
      for (let j = innerStart; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }
      if (closeIdx !== -1 && cursor >= innerStart && cursor <= closeIdx) {
        return { start: innerStart, end: closeIdx };
      }
      if (closeIdx !== -1) {
        i = closeIdx + 1;
      } else {
        i++;
      }
      continue;
    }
    i++;
  }
  return null;
}

// 수식 영역 내 다음 { 안으로 커서 이동 (끝이면 처음으로 순회). Alt-Tab / Command 더블탭 공용.
function jumpToNextBrace(view: EditorView): boolean {
  const doc = view.state.doc.toString();
  const cursor = view.state.selection.main.head;
  const region = findMathRegion(doc, cursor);
  if (!region) return false;
  const bracePositions: number[] = [];
  for (let k = region.start; k < region.end; k++) {
    if (doc[k] === '{') bracePositions.push(k + 1);
  }
  if (bracePositions.length === 0) return false;
  let nextPos = bracePositions.find((p) => p > cursor);
  if (nextPos === undefined) nextPos = bracePositions[0];
  view.dispatch({ selection: { anchor: nextPos } });
  return true;
}

// ── LaTeX 자동완성 소스 ──────────────────────────────────
function latexCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/\\[a-zA-Z{]*/);
  if (!word || word.from === word.to) return null;
  if (word.text.length < 2) return null;

  const doc = context.state.doc.toString();
  if (!isInsideMath(doc, context.pos)) return null;

  const options: Completion[] = LATEX_COMPLETIONS
    .filter((item) => item.label.startsWith(word.text))
    .map((item) => ({
      label: item.label,
      detail: item.detail,
      type: 'keyword',
      boost: item.boost,
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        const template = item.template;

        view.dispatch({
          changes: { from, to, insert: template },
        });

        // 커서: cursorOffset(큐레이션) 우선, 없으면 첫 {} 또는 끝
        const firstBrace = template.indexOf('{}');
        const offset = item.cursorOffset ?? (firstBrace !== -1 ? firstBrace + 1 : template.length);
        view.dispatch({
          selection: { anchor: from + offset },
        });
        if (item.braceCount >= 2) {
          (view as any).__tabStopsActive = true;
        }
      },
    }));

  if (options.length === 0) return null;

  return {
    from: word.from,
    options,
    validFor: /^\\[a-zA-Z{]*$/,
  };
}

// ── LaTeX 린터 (동기) ──────────────────────────────────
// 뷰별 직전 진단 캐시 — 한글 IME 조합 중 진단 갱신을 건너뛸 때 사용.
const lastDiagnostics = new WeakMap<EditorView, Diagnostic[]>();

const latexLinter = linter((view) => {
  // 한글 IME 조합 중에는 진단을 갱신하지 않음.
  // 조합 텍스트 위에 물결 밑줄 데코레이션이 붙거나 사라지면 조합이 깨져
  // 끝글자가 중복 입력된다 (lib/latex-highlight.ts의 composing 가드와 같은 이유).
  // 직전 진단을 그대로 반환 → 데코레이션 무변경 → DOM 재렌더 없음.
  // 조합 중 자소 삭제로 문서가 짧아졌을 수 있으므로 문서 길이로 clamp.
  if (view.composing) {
    const len = view.state.doc.length;
    return (lastDiagnostics.get(view) || []).filter((d) => d.to <= len);
  }
  const result = lintLaTeX(view.state.doc.toString());
  lastDiagnostics.set(view, result);
  return result;
}, {
  // 한글 한 음절 조합이 delay를 넘기면 조합 중 진단이 발화하므로 넉넉하게.
  delay: 1200,
});

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ initialValue = '', onChange, autoHeight = false, onSnippetShortcut, onCursorActivity, lineWrap = true }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    /* Phase 65 — 줄바꿈 Compartment. 뷰마다 하나이고, 초기 state는 마운트 시점의
       lineWrap을 읽어야 하므로 ref로 최신값을 들고 있는다(effect deps는 []이다). */
    const wrapCompartment = useRef(new Compartment());
    const lineWrapRef = useRef(lineWrap);
    lineWrapRef.current = lineWrap;
    const tabStopsRef = useRef<boolean>(false);
    const chordPendingRef = useRef<boolean>(false);
    const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMetaDownRef = useRef<number>(0); // Command 더블탭 감지용
    /* 마우스 버튼이 눌려 있는 동안(=드래그 선택 진행 중)인가.
       CM은 드래그 중 mousemove마다 userEvent 'select.pointer' 트랜잭션을 만들므로,
       이것만으로 "클릭"을 판정하면 드래그 내내 정렬이 실시간 발화한다. (Phase 56 D17) */
    const pointerDownRef = useRef<boolean>(false);

    // 최신 콜백을 ref로 유지 (CodeMirror 초기화 이후에도 최신값 참조)
    const snippetCallbackRef = useRef(onSnippetShortcut);
    useEffect(() => {
      snippetCallbackRef.current = onSnippetShortcut;
    }, [onSnippetShortcut]);

    const cursorCallbackRef = useRef(onCursorActivity);
    useEffect(() => {
      cursorCallbackRef.current = onCursorActivity;
    }, [onCursorActivity]);

    useImperativeHandle(ref, () => ({
      insertText(text: string, cursorOffset: number) {
        const view = viewRef.current;
        if (!view) return;

        const { from, to } = view.state.selection.main;

        const braceCount = (text.match(/\{\}/g) || []).length;
        tabStopsRef.current = braceCount >= 2;

        view.dispatch({
          changes: { from, to, insert: text },
        });

        const firstBrace = text.indexOf('{}');
        if (firstBrace !== -1) {
          view.dispatch({
            selection: { anchor: from + firstBrace + 1 },
          });
        } else {
          view.dispatch({
            selection: { anchor: from + cursorOffset },
          });
        }

        view.focus();
      },
      /* ⚠️ Phase 61c: 위 `insertText`는 **툴바 템플릿 전용 규약**이다 —
            텍스트에 `{}`가 있으면 커서를 그 안으로 점프시키고, 2개 이상이면 탭스톱을 무장해
            이후 Tab 키 동작이 바뀐다. AI 대화문에는 `x^{}`·`\left\{\right\}`가 실제로 섞이므로
            채팅 삽입에는 쓰면 안 된다. 이쪽은 선택 대체 + 커서 이동 + 포커스만 한다. */
      insertInlineMath() {
        const view = viewRef.current;
        if (!view) return;
        insertInlineMathIn(view);
      },
      insertPlainText(text: string) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        // CM6은 selection을 changes 적용 **후** 문서 기준으로 해석한다 → 한 dispatch = undo 1스텝
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      getCursorPosition() {
        const view = viewRef.current;
        if (!view) return 0;
        return view.state.selection.main.head;
      },
      getContent() {
        const view = viewRef.current;
        if (!view) return '';
        return view.state.doc.toString();
      },
      setContent(text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
      },
      setSelection(from: number, to: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          selection: { anchor: from, head: to },
        });
      },
      clearSelection() {
        const view = viewRef.current;
        if (!view) return;
        // 커서를 현재 위치에 놓되, 선택 영역은 해제
        const pos = view.state.selection.main.head;
        view.dispatch({ selection: { anchor: pos } });
      },
      replaceRange(from: number, to: number, text: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ changes: { from, to, insert: text } });
      },
      focus() {
        viewRef.current?.focus();
      },
      getCursorCoords() {
        const view = viewRef.current;
        if (!view) return null;
        const pos = view.state.selection.main.head;
        const coords = view.coordsAtPos(pos);
        if (!coords) return null;
        return { top: coords.top, left: coords.left };
      },
      /* Phase 65 D8 — 프로그램적 커서 이동(찾기/바꾸기 · 미리보기 수식 클릭)은
         scrollIntoView를 쓰지 않으므로 CM이 가로로 따라가지 않는다. 그 두 경로만 이걸 부른다.
         게이트 없이 항상 불러도 되도록, 가로 여지가 없으면 첫 줄에서 빠진다. */
      revealCursorX() {
        const view = viewRef.current;
        if (!view) return;
        const s = view.scrollDOM;
        if (s.scrollWidth <= s.clientWidth) return;   // 줄바꿈 켬 · 짧은 줄 → 할 일 없음
        const coords = view.coordsAtPos(view.state.selection.main.head);
        if (!coords) return;                          // 세로 뷰포트 밖 → 기존 경로와 같이 건너뜀
        const rect = s.getBoundingClientRect();
        /* sticky 거터가 본문 앞을 가리므로 그 오른쪽 변을 좌측 경계로 삼는다.
           offsetWidth가 아니라 rect를 쓰는 이유: 거터는 스크롤러의 자식이라
           getBoundingClientRect가 sticky 위치를 이미 반영한다. */
        const gutters = s.querySelector('.cm-gutters') as HTMLElement | null;
        const left = gutters ? gutters.getBoundingClientRect().right : rect.left;
        s.scrollLeft = computeRevealScrollLeft(
          { left, right: rect.right }, coords.left, s.scrollLeft,
        );
      },
      setSearchHighlights(matches: SearchMatch[], activeIndex: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: setSearchHighlightsEffect.of({ matches, activeIndex }),
        });
      },
      clearSearchHighlights() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          effects: clearSearchHighlightsEffect.of(null),
        });
      },
      highlightMath(from: number, to: number) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setMathHighlightEffect.of({ from, to }) });
      },
      clearMathHighlight() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setMathHighlightEffect.of(null) });
      },
      hasFocus() {
        return viewRef.current?.hasFocus ?? false;
      },
      isComposing() {
        return viewRef.current?.composing ?? false;
      },
      isSelectionEmpty() {
        return viewRef.current?.state.selection.main.empty ?? true;
      },

      /* ═══ Phase 58 P3 — 핵심문장(`**…**`) 토글 ═══
         key 마커는 인라인 `**` 하나뿐이다(D13). 손으로 치면 경계 규칙을 어기기 쉬워
         (앞뒤 공백·`\tag` 포함·수식 내부 절단) 여기서 정돈해 준다. */
      toggleKeyWrap(): KeyWrapResult {
        const view = viewRef.current;
        if (!view) return 'rejected';

        const doc = view.state.doc.toString();
        const sel = view.state.selection.main;
        if (sel.empty) return 'rejected';                     // ① 선택 없음

        // ② 경계 정돈 — 양끝 공백 제외. `** text**`는 CommonMark 강조가 되지 않는다.
        let from = sel.from;
        let to = sel.to;
        while (from < to && /\s/.test(doc[from])) from++;
        while (to > from && /\s/.test(doc[to - 1])) to--;
        if (from >= to) return 'rejected';

        // 행 끝 `\tag{n}`은 선택에서 뺀다. 텍스트 행의 tag 변환 정규식이 행 끝 앵커
        // (/\\tag\{(\d+)\}\s*$/gm)라, `… \tag{1}**`가 되면 매칭이 깨져 원문이 노출된다.
        // key와 참조번호는 의미상으로도 분리가 옳다.
        const tagAtEnd = doc.slice(from, to).match(/\s*\\tag\{\d+\}\s*$/);
        if (tagAtEnd) {
          to -= tagAtEnd[0].length;
          while (to > from && /\s/.test(doc[to - 1])) to--;
          if (from >= to) return 'rejected';
        }

        // ③ 문단 제약 — 정돈된 선택 안에 빈 줄이 있으면 거부(한 문단 내로 강제).
        if (/\n[ \t]*\n/.test(doc.slice(from, to))) return 'rejected';

        // ④ 수식 경계 가드 — 양끝이 수식 *내부*면 거부. `$…$`를 통째로 품는 것은 허용.
        //    display 수식(`$$…$$`·`\[…\]`)에 걸치거나 통째로 품는 선택도 거부한다:
        //    블록 문법은 `**`로 감쌀 수 없고, D8 관행(인라인 `$…$`로 바꿔 쓰기)으로 유도한다.
        const ranges = buildMathIndex(doc);
        if (isInsideMathRange(ranges, from) || isInsideMathRange(ranges, to)) return 'rejected';
        if (crossesDisplayMath(doc, ranges, from, to)) return 'rejected';
        if (containsDisplayMath(doc, ranges, from, to)) return 'rejected';

        // ⑤ 토글 — 이미 `**…**`로 감싸져 있으면 벗긴다.
        const inner = doc.slice(from, to);
        const wrappedInside = inner.startsWith('**') && inner.endsWith('**') && inner.length > 4;
        const wrappedOutside = doc.slice(Math.max(0, from - 2), from) === '**'
          && doc.slice(to, to + 2) === '**';

        // 단일 트랜잭션으로 dispatch → CM 히스토리·Phase 55a 블록 undo에 자연 편입.
        if (wrappedOutside) {
          view.dispatch({
            changes: [
              { from: from - 2, to: from, insert: '' },
              { from: to, to: to + 2, insert: '' },
            ],
            selection: { anchor: from - 2, head: to - 2 },
          });
          view.focus();
          return 'unwrapped';
        }
        if (wrappedInside) {
          view.dispatch({
            changes: [
              { from, to: from + 2, insert: '' },
              { from: to - 2, to, insert: '' },
            ],
            selection: { anchor: from, head: to - 4 },
          });
          view.focus();
          return 'unwrapped';
        }
        view.dispatch({
          changes: [
            { from, to: from, insert: '**' },
            { from: to, to, insert: '**' },
          ],
          selection: { anchor: from + 2, head: to + 2 },
        });
        view.focus();
        return 'wrapped';
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      // ── Tab stop 핸들러 ──
      const tabHandler = keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            if ((view as any).__tabStopsActive) {
              tabStopsRef.current = true;
              (view as any).__tabStopsActive = false;
            }

            if (!tabStopsRef.current) return false;

            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;

            const closeBrace = doc.indexOf('}', cursor);
            if (closeBrace === -1) {
              tabStopsRef.current = false;
              return false;
            }

            const afterClose = doc.indexOf('{', closeBrace + 1);
            const nextClose = doc.indexOf('}', closeBrace + 1);

            if (afterClose !== -1 && (nextClose === -1 || afterClose < nextClose)) {
              const gap = doc.substring(closeBrace + 1, afterClose);
              if (gap.length <= 3) {
                view.dispatch({
                  selection: { anchor: afterClose + 1 },
                });
                return true;
              }
            }

            tabStopsRef.current = false;
            view.dispatch({
              selection: { anchor: closeBrace + 1 },
            });
            return true;
          },
        },
      ]);

      // ── Cmd+F / Ctrl+F 내장 검색 패널 차단 (커스텀 FindReplacePanel만 사용) ──
      const disableBuiltinSearch = Prec.highest(keymap.of([
        { key: 'Mod-f', run: () => true, preventDefault: true },
        { key: 'Mod-h', run: () => true, preventDefault: true },
        { key: 'F3', run: () => true, preventDefault: true },
        { key: 'Mod-g', run: () => true, preventDefault: true },
      ]));

      // $$ ... $$ 블록 삽입 시 상하에 정확히 빈 줄 1개씩 보장
      // - 커서 좌·우의 공백(개행 포함)을 흡수해 그 자리에 정규화 삽입
      // - 문서 시작/끝이면 그쪽 패딩은 생략
      const insertDisplayMathBlock = (view: EditorView) => {
        const doc = view.state.doc.toString();
        const { from } = view.state.selection.main;
        let left = from;
        while (left > 0 && /\s/.test(doc[left - 1])) left--;
        let right = from;
        while (right < doc.length && /\s/.test(doc[right])) right++;
        const atStart = left === 0;
        const atEnd = right === doc.length;
        const padBefore = atStart ? '' : '\n\n';
        const padAfter = atEnd ? '' : '\n\n';
        const insert = padBefore + '$$\n\n$$' + padAfter;
        // cursor: 두 번째 '\n' 뒤(빈 줄 가운데) = padBefore + "$$\n" 다음
        const cursor = left + padBefore.length + 3;
        view.dispatch({
          changes: { from: left, to: right, insert },
          selection: { anchor: cursor },
        });
      };

      // ── Chord 단축키 (Ctrl+N → M/N) + Shift+Esc + Ctrl+Alt+1~9 ──
      const mathShortcuts = Prec.highest(keymap.of([
        {
          key: 'Ctrl-n',
          run: (view) => {
            if (chordPendingRef.current) {
              chordPendingRef.current = false;
              if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
              insertDisplayMathBlock(view);
              return true;
            }

            chordPendingRef.current = true;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            chordTimerRef.current = setTimeout(() => {
              chordPendingRef.current = false;
            }, 1000);
            return true;
          },
        },
        {
          key: 'Shift-Escape',
          run: (view) => {
            const doc = view.state.doc.toString();
            const cursor = view.state.selection.main.head;
            const exitPos = findInnermostExit(doc, cursor);

            if (exitPos !== -1) {
              view.dispatch({
                selection: { anchor: exitPos },
              });
              return true;
            }
            return false;
          },
        },
        // ── Alt+Tab: 수식 내 중괄호 순회 (Command 더블탭과 동일 동작) ──
        {
          key: 'Alt-Tab',
          run: (view) => jumpToNextBrace(view),
        },
        // ── Ctrl+Alt+1 ~ Ctrl+Alt+9 (수식 상용구 단축키) ──
        ...Array.from({ length: 9 }, (_, i) => ({
          key: `Ctrl-Alt-${i + 1}`,
          mac: `Ctrl-Alt-${i + 1}`,
          run: () => {
            if (snippetCallbackRef.current) {
              snippetCallbackRef.current(i + 1);
              return true;
            }
            return false;
          },
        })),
      ]));

      // ── Chord DOM 이벤트 핸들러 ──
      const chordListener = EditorView.domEventHandlers({
        keydown(event, view) {
          if (!chordPendingRef.current) return false;

          if (event.code === 'KeyM') {
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);

            insertInlineMathIn(view);   // M7 D4 — `$` 버튼과 같은 스마트 삽입(선택 감싸기 · 인접 `$` 공백)
            return true;
          }

          if (event.code === 'KeyN') {
            event.preventDefault();
            chordPendingRef.current = false;
            if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
            insertDisplayMathBlock(view);
            return true;
          }

          chordPendingRef.current = false;
          if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
          return false;
        },
      });

      // ── Command(Meta) 더블탭: 수식 내 다음 중괄호로 이동 ──
      const metaListener = EditorView.domEventHandlers({
        keydown(event, view) {
          if (event.key === 'Meta') {
            const now = Date.now();
            if (now - lastMetaDownRef.current < 400) {
              lastMetaDownRef.current = 0;
              if (jumpToNextBrace(view)) {
                event.preventDefault();
                return true;
              }
              return false;
            }
            lastMetaDownRef.current = now;
            return false;
          }
          // Meta 외 다른 키 → 더블탭 추적 리셋 (Cmd+C 등 오발 방지)
          lastMetaDownRef.current = 0;
          return false;
        },
      });

      // ── LaTeX 자동완성 설정 ──
      const latexAutocompletion = autocompletion({
        override: [latexCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 12,
        defaultKeymap: true,
        icons: false,
      });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          disableBuiltinSearch,
          mathShortcuts,
          chordListener,
          metaListener,
          tabHandler,
          basicSetup,
          /* 툴팁을 에디터 밖 전용 호스트로(M7 D25′) — 끔 모드에서 .cm-editor 에 transform 이 걸리므로
             (fixed 거터의 containing block) 에디터 안의 fixed 툴팁은 좌표를 잃는다. 컨테이너는
             view.themeClasses 를 그대로 받아 아래 .cm-tooltip 테마가 계속 적용된다.
             ⚠ parent 를 document.body 로 되돌리지 말 것 — 파일 상단 tooltipHost() 주석(문서 높이 누수). */
          tooltips({ parent: tooltipHost(), position: 'fixed' }),
          latexAutocompletion,
          // ── 괄호 자동닫기 제어 ──
          Prec.highest(EditorView.inputHandler.of((view, from, to, text) => {
            const doc = view.state.doc.toString();
            const inMath = isInsideMath(doc, from);

            // ── \left( / \bigl[ / \Bigl| 등: 좌측 구분자 입력 시 \right 쌍 자동 완성 ──
            const PAIR: Record<string, [string, string]> = {
              '(': ['(', ')'], '[': ['[', ']'], '{': ['\\{', '\\}'], '|': ['|', '|'],
            };
            if (inMath && PAIR[text]) {
              const before = doc.slice(Math.max(0, from - 6), from);
              const lm = before.match(/\\(left|bigl|Bigl|biggl|Biggl)$/);
              if (lm) {
                const RIGHT: Record<string, string> = {
                  left: 'right', bigl: 'bigr', Bigl: 'Bigr', biggl: 'biggr', Biggl: 'Biggr',
                };
                const [open, close] = PAIR[text];
                const insert = `${open}\\${RIGHT[lm[1]]}${close}`;
                view.dispatch({
                  changes: { from, to, insert },
                  selection: { anchor: from + open.length }, // 여는 구분자 바로 뒤
                });
                return true;
              }
            }

            // 소괄호·대괄호: 수식 밖에서 자동닫기 차단
            if (text === '(' || text === '[') {
              if (inMath) return false; // 수식 안 → closeBrackets가 처리
              view.dispatch({
                changes: { from, to, insert: text },
                selection: { anchor: from + 1 },
              });
              return true;
            }

            // 중괄호: 수식 안에서 항상 자동닫기 (뒤 문자 무관)
            if (text === '{') {
              if (!inMath) return false; // 수식 밖 → 기본 동작
              view.dispatch({
                changes: { from, to, insert: '{}' },
                selection: { anchor: from + 1 },
              });
              return true;
            }

            return false;
          })),
          // ── 린트 (LaTeX 오류) ──
          latexLinter,
          lintGutter(),
          // ── 검색 하이라이트 (커스텀 FindReplacePanel용) ──
          searchHighlightField,
          searchHighlightTheme,
          // ── 수식 클릭 하이라이트 (미리보기→편집창) ──
          mathHighlightField,
          mathHighlightTheme,
          // Phase 65: lineWrapping + white-space/overflow 테마를 한 칸에 묶었다 (파일 상단 참조)
          wrapCompartment.current.of(wrapExtensions(lineWrapRef.current)),
          latexHighlightPlugin,
          latexHighlightTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              if (cursorCallbackRef.current) {
                const head = update.state.selection.main.head;
                const line = update.state.doc.lineAt(head);
                /* 마우스로 "클릭을 완료"했을 때만 수식 중앙 정렬을 유발한다.
                   드래그 중(pointerDown)에는 false로 내리고, 실제 발화는 mouseup에서
                   선택이 비어 있을 때 한 번만 한다 — 드래그로 범위를 잡는 동안 화면이
                   실시간으로 움직이면 세밀한 선택이 불가능하다. (Phase 56 D17) */
                const pointerSelect = !pointerDownRef.current
                  && update.transactions.some((tr) => tr.isUserEvent('select.pointer'));
                cursorCallbackRef.current({
                  line: line.number, offset: head, docChanged: update.docChanged, pointerSelect,
                });
              }
            }
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '15px',
              // 블록 클레이가 비치도록 CodeMirror 기본 흰 배경 차단
              backgroundColor: 'transparent',
            },
            '.cm-scroller': {
              /* ⚠ overflow는 여기 없다 — Phase 65에서 wrapCompartment(파일 상단)로 옮겼다.
                 세로 스크롤은 어느 모드에서도 없고(외곽 .scaled-editor가 담당), 가로만
                 줄바꿈을 끈 동안 이 스크롤러가 맡는다. 여기에 overflow를 다시 적으면
                 같은 셀렉터·같은 속성이 두 테마에 생겨 토글이 조용히 죽는다. */
              // 기본 = Pretendard (일반 텍스트). 수식 영역은 cm-math-region이 D2Coding으로 오버라이드
              fontFamily: 'var(--font-ui)',
            },
            '.cm-content': {
              // ⚠ whiteSpace·wordBreak도 wrapCompartment 소유다 (위 주석과 같은 이유)
              padding: '16px',
              lineHeight: '1.8',
            },
            /* ═══ 거터 ═══════════════════════════════════════════════════
               ⚠ **폭·구분선을 손대지 말 것 (2026-09-08 덕수 판정으로 원복됨)**.
                 한 번 "폭 2/3(49→33px) + 구분선 강화"를 넣었다가 셋이 함께 무너져 되돌렸다:
                 ① 폭을 줄이며 minWidth를 2자리 글자 폭 아래로 내리자 **블록마다 번호 열 폭이
                    갈렸다**(1자리 블록은 minWidth가, 2자리 블록은 글자 폭이 이겨서) — 아래
                    "2자리까지 폭 통일"이 바로 그 정렬을 지키는 장치다
                 ② 선을 진하게 하니 '요약에 넣기' 블록의 얇은 바에서 **선이 끊겨 보였다**
                    (거터 선은 CM 높이만큼만 그려지는데 바가 그 위를 차지한다)
                 원래 값이 옳았다. 되살리려면 ①②를 먼저 풀 것. */
            '.cm-gutters': {
              /* Phase 65 D5 — 줄바꿈을 끄면 거터가 sticky로 살아나 본문이 그 뒤로 흐른다.
                 투명이면 글자가 줄 번호 위로 비쳐 지나가므로 블록 표면색을 깐다.
                 ⚠ 폴백 필수: 변수가 없으면 unset이 되어 CM base theme의 #f5f5f5 회색 띠가 살아난다.
                 ⚠ inherit은 안 된다 — .cm-editor가 backgroundColor:transparent를 명시한다. */
              backgroundColor: 'var(--block-surface, var(--block-bg))',
              borderRight: '1px solid var(--border-subtle)',
              /* 본문보다 한 단계 작게(글꼴 조절 스텝 1px과 같은 감각) + 옅은 레드.
                 ⚠ em이라 사용자의 글자 크기 설정을 따라 함께 움직인다 — px로 굳히지 말 것
                   (Phase 59a C5 "em/px를 섞으면 글꼴 크기에서 무너진다"). */
              fontSize: '0.92em',
              color: GUTTER_NUM,
              /* 가로 고정. CM이 `position:sticky`를 인라인으로 박고(dist 11152) 좌표는 base theme의
                 `.cm-gutters-before { inset-inline-start: 0 }`가 준다 — 여기 `left`는 그 논리 속성에
                 기대지 않으려는 명시일 뿐이다.
                 ⚠ **거터가 움직이는 진짜 원인은 여기가 아니라 바깥 패널이었다** — `.scaled-editor`가
                   `overflowY`만 지정해 가로축이 auto로 열려 있었고, `.no-scrollbar`라 가로 스크롤바가
                   보이지도 않아 트랙패드 스와이프에 **블록 통째로** 소리 없이 밀렸다. 그쪽을
                   `overflow-x: hidden`으로 닫았다(EditorView `.scaled-editor`). 이 규칙만 보고
                   "sticky가 안 먹는다"고 진단하지 말 것. */
              left: '0',
              // 블록이 실제 border를 쓰므로 거터가 좌측 테두리를 덮지 않음
              // → 거터 자체의 좌측선/모서리 보정 불필요 (이중선 제거)
            },
            /* 줄 번호 영역: 2자리까지 폭 통일, 3자리 이상부터 자연 확장.
               CodeMirror가 셀 폭을 인라인으로 강제하므로 !important 필요.
               ⚠ 1.8em(15px에서 27px)은 여유가 아니라 **2자리 번호가 꽉 채우는 값**이다
                 (숫자 한 자 ≈ 9.2px → 2자리 18.4 + base padding 8 = 26.4px). 이보다 낮추면
                 1자리 블록과 2자리 블록의 열 폭이 갈려 블록마다 어긋난다 — 위 ① 참조.
               ⚠ tabular-nums: 본문 글꼴(var(--font-ui))의 숫자는 폭이 제각각이라 오른쪽만 맞고
                 왼쪽이 들쭉날쭉했다. 고정폭 숫자로 두 변을 함께 맞춘다(가운데 정렬이 아니라
                 오른쪽 정렬을 유지하는 이유: 자릿수가 달라도 **1의 자리가 같은 세로선**에 선다). */
            '.cm-lineNumbers .cm-gutterElement': {
              /* ⚠ 2em인 이유: 글꼴을 0.92em로 줄이면 2자리 실측폭(≈24.9px)이 옛 1.8em(24.8px)을
                   **넘어서** 1자리 블록과 2자리 블록의 열 폭이 갈린다. minWidth는 2자리가 확실히
                   들어가는 값이어야 "2자리까지 폭 통일"이 성립한다. 글꼴을 더 줄이면 여기도 볼 것. */
              minWidth: '2em !important',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            },
            // 코드 접힘(fold) 화살표 숨김
            '.cm-foldGutter': {
              display: 'none !important',
            },
            // 선택된 텍스트와 동일한 텍스트 하이라이트 비활성화
            '.cm-selectionMatch': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 행 배경색 제거
            '&:not(.cm-focused) .cm-activeLine': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 선택 영역 배경색 제거
            '&:not(.cm-focused) .cm-selectionBackground': {
              backgroundColor: 'transparent !important',
            },
            // 비활성 에디터의 행번호 거터 배경색 제거
            '&:not(.cm-focused) .cm-activeLineGutter': {
              backgroundColor: 'transparent !important',
            },
            // ═══ 활성 행/행번호 강조 — 웜 클레이 톤 (기본 차가운 강조색 대체) ═══
            // 활성 블록(#EDE6DA)과 같은 색 가족에서 톤만 살짝 깊게 깔아 부드럽게 강조.
            // 반투명 웜 브라운(--border-content-active 계열)이 클레이 위에 합성됨.
            '&.cm-focused .cm-activeLine': {
              backgroundColor: 'rgba(184, 155, 120, 0.13)',
            },
            '&.cm-focused .cm-activeLineGutter': {
              backgroundColor: 'rgba(184, 155, 120, 0.20)',
              // 다른 번호가 레드 계열이라 활성 행만 회색이면 혼자 튄다 — 같은 계열에서 톤만 올린다
              color: GUTTER_NUM_ACTIVE,
            },

            // ═══ 툴팁 공통 — body 에 마운트되므로 앱 패널(≤10000) 위, 다이얼로그(10500) 아래 ═══
            '.cm-tooltip': { zIndex: '10200' },
            // ═══ 자동완성 드롭다운 스타일 ═══
            '.cm-tooltip.cm-tooltip-autocomplete': {
              border: '1px solid var(--border-primary, #ddd)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              backgroundColor: '#fff',
              overflow: 'hidden',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
            },
            '.cm-tooltip-autocomplete ul': {
              maxHeight: '280px',
            },
            '.cm-tooltip-autocomplete ul li': {
              padding: '4px 12px',
              lineHeight: '1.6',
            },
            '.cm-tooltip-autocomplete ul li[aria-selected]': {
              backgroundColor: 'var(--accent-primary, #5b6abf)',
              color: '#fff',
            },
            '.cm-completionLabel': {
              fontSize: '13px',
              fontWeight: '500',
            },
            '.cm-completionDetail': {
              fontSize: '11px',
              marginLeft: '8px',
              opacity: '0.7',
              fontStyle: 'normal',
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
            },

            // ═══ Lint 밑줄 스타일 ═══
            // LaTeX 오류 (중괄호/begin-end 불일치, 닫힘 누락): --accent-danger 물결 밑줄 (M6 색 정리 — 옛 #e53935)
            '.cm-lintRange-error': {
              backgroundImage: 'none !important',
              textDecoration: 'wavy underline var(--accent-danger, #C0392B)',
              textDecorationSkipInk: 'none',
              textUnderlineOffset: '3px',
            },
            // LaTeX 경고 (미등록 명령어): --mathory-red 물결 밑줄 (옛 주황 #f57c00 — 오류보다 한 단 연한 빨강으로 가른다)
            '.cm-lintRange-warning': {
              backgroundImage: 'none !important',
              textDecoration: 'wavy underline var(--mathory-red, #D97757)',
              textDecorationSkipInk: 'none',
              textUnderlineOffset: '3px',
            },

            // ═══ Lint 거터 마커 ═══
            '.cm-lint-marker-error::after': {
              content: '"●"',
              color: 'var(--accent-danger, #C0392B)',
              fontSize: '10px',
            },
            '.cm-lint-marker-warning::after': {
              content: '"●"',
              color: 'var(--mathory-red, #D97757)',
              fontSize: '10px',
            },

            // ═══ Lint 툴팁 ═══
            '.cm-tooltip.cm-tooltip-lint': {
              borderRadius: '6px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              fontSize: '13px',
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
              maxWidth: '400px',
            },
            '.cm-diagnosticText': {
              fontFamily: "var(--font-ui, '맑은 고딕', sans-serif)",
            },

          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      /* 끔 모드 fixed 거터의 자리(padding-left) 공급. 거터 폭은 줄 수(2→3자리)로 바뀌므로
         ResizeObserver 로 따라간다. syncGutters 는 같은 DOM 노드를 떼었다 붙이므로 관찰이 유지된다.
         켬 모드에서는 변수만 세팅되고 소비처가 없다(테마에 paddingLeft 가 없다). */
      const gutterEl = view.scrollDOM.querySelector('.cm-gutters') as HTMLElement | null;
      const syncGutterWidth = () => {
        if (gutterEl) view.scrollDOM.style.setProperty('--gutter-w', gutterEl.offsetWidth + 'px');
      };
      syncGutterWidth();
      const gutterRO = (typeof ResizeObserver !== 'undefined' && gutterEl)
        ? new ResizeObserver(syncGutterWidth) : null;
      if (gutterRO && gutterEl) gutterRO.observe(gutterEl);

      /* ── 드래그 선택 판별 (Phase 56 D17) ──────────────────────────
         mousedown ~ mouseup 구간은 "드래그 진행 중"으로 보고 정렬을 억제하다가,
         mouseup 시점에 선택이 비어 있으면(=단순 클릭) 그때 한 번만 통지한다.
         mouseup은 에디터 밖에서 끝날 수 있으므로 document에 건다.
         CM의 MouseSelection.up()은 선택이 바뀌지 않으면 트랜잭션을 만들지 않아
         (dist/index.js:4679-4685) 마지막 트랜잭션에 기댈 수 없다. */
      /* ⚠️ 캡처 단계로 등록해야 한다. 버블로 걸면 CM이 먼저 등록한 mousedown 핸들러가
         앞서 실행되어, CM이 선택 트랜잭션을 만드는 시점에 pointerDown이 아직 false다
         → 드래그 시작 순간의 정렬 1회가 그대로 새어나간다. (하니스로 확인) */
      const onPointerDown = (e: Event) => {
        if (!view.contentDOM.contains(e.target as Node)) return;
        pointerDownRef.current = true;
      };
      const onPointerUp = () => {
        if (!pointerDownRef.current) return;
        pointerDownRef.current = false;
        const v = viewRef.current;
        if (!v || !v.hasFocus) return;
        const sel = v.state.selection.main;
        if (!sel.empty) return;              // 범위를 잡은 드래그 → 정렬하지 않음
        const line = v.state.doc.lineAt(sel.head);
        cursorCallbackRef.current?.({
          line: line.number, offset: sel.head, docChanged: false, pointerSelect: true,
        });
      };
      document.addEventListener('mousedown', onPointerDown, true);
      document.addEventListener('mouseup', onPointerUp);

      return () => {
        document.removeEventListener('mousedown', onPointerDown, true);
        document.removeEventListener('mouseup', onPointerUp);
        gutterRO?.disconnect();
        view.destroy();
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* Phase 65 — 줄바꿈 토글. Compartment 재구성은 state 변경이라 CM이 measure를
       확실히 예약한다(CSS만 바꾸면 다음 measure 계기까지 한 프레임 높이가 틀어진다). */
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: wrapCompartment.current.reconfigure(wrapExtensions(lineWrap)),
      });
    }, [lineWrap]);

    return (
      <div
        ref={editorRef}
        style={{
          height: autoHeight ? 'auto' : '100%',
          minHeight: autoHeight ? '60px' : undefined,
          // 외곽 블록이 테두리를 제공 → 래퍼 자체 테두리 제거(텍스트 블록 이중·두꺼움 해소)
          border: 'none',
          overflow: 'hidden',
        }}
      />
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
export default MarkdownEditor;