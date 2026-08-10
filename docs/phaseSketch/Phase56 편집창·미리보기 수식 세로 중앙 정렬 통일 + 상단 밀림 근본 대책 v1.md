# Phase 56 — 편집창↔미리보기 수식 세로 중앙 정렬 통일 + 상단 밀림 근본 대책 **v1**

작성일: 2026-08-10 · 작성: web Claude (Fable) · 기준 커밋: `c622b7d` (docs: Phase 54·55 기재)

> **본 문서의 위상** — v1 초안. CLI Claude가 실코드 기준으로 검토·검증 후 v2를 작성하고, v2를 web Claude가 재검토하는 워크플로우. 본 문서의 file:line은 모두 커밋 `c622b7d` 기준이며, 검토 시 최신 HEAD와의 불일치 여부를 §0에서 먼저 확인할 것.

> **관련 Phase 이력** — 원 기능은 **Phase 15 (에디터 기능 안정화, 2026-03-14)**: "미리보기 클릭 → 편집창 이동", "편집창 → 미리보기 연동" (roadmap.md:95-103). 보완 커밋: `11bac0d`(Phase 15 보완: 세로 중앙 스크롤), `2432bfe`(첫 클릭 중앙 이동), `7b7b920`(Phase 15 완료: mathId 동기화), `6b98d08`(상단바/콘텐츠 클릭 스크롤), `3e56a2d`(스크롤 속도), **`f353e5c`**(2026-07-18, 블록 상단 가시성 보장 — 버그1의 2차 수정, **roadmap 미기록**). 완료 시 roadmap에 Phase 56 신설 + Phase 15 비고 갱신 + f353e5c 소급 기재.

---

## 0. 선행 확인 (CLI 필수)

구현 전 아래 위치가 본 문서와 일치하는지 확인. 불일치 시 구현을 멈추고 보고.

| 확인 항목 | 위치 |
|---|---|
| `buildMathIndex` / `findMathIdAtCursor` | `components/editor/EditorView.tsx:140-190, 192-197` |
| `fastScrollTo` (0 이상 클램프 포함) | `EditorView.tsx:200-214` |
| `computeBlockAwareScrollTop` (블록 상단 우선 클램프) | `EditorView.tsx:226-244` |
| 블록 래퍼 `overflow: 'hidden'` | `EditorView.tsx:762-778` (style 객체, line 773) |
| 블록 콘텐츠 `onClick={onFocus}` | `EditorView.tsx:890` |
| `activeMathId` state | `EditorView.tsx:1033` |
| `previewRef` / `editorPanelRef` | `EditorView.tsx:1040-1041` |
| `BLOCK_SCROLL_MS` / `skipNextBlockScrollRef` | `EditorView.tsx:1768, 1770` |
| 스크롤 헬퍼 4종 (`scrollPreviewToBlockTop` 등) | `EditorView.tsx:1773-1833` |
| `handleCursorActivity` | `EditorView.tsx:1955-1966` |
| `handleBlockFocus` | `EditorView.tsx:1969-1981` |
| `handlePreviewMathClick` | `EditorView.tsx:1984-2021` |
| 블록 활성화 기본 자동 스크롤 effect | `EditorView.tsx:2025-2043` |
| **블록 전환 시 `clearSelection()` 루프 effect (버그2-2 원인)** | `EditorView.tsx:2049-2053` |
| content-frame (`overflowX:auto, overflowY:hidden`) | `EditorView.tsx:2863-2870` |
| 편집창 좌측 칼럼 (`overflow:'hidden'`) | `EditorView.tsx:2873-2876` |
| 편집 패널 (`overflowY:'auto'`, `paddingBottom:'100vh'`) | `EditorView.tsx:2885` |
| 미리보기 칼럼 (`overflow:'hidden'`) / 패널 | `EditorView.tsx:2945-2950` |
| `EditorPreview`에 `activeMathId` 전달 | `EditorView.tsx:3012, 3023` |
| `onCursorActivity` prop 타입 | `components/editor/MarkdownEditor.tsx:32`, `EditorView.tsx:747` (docChanged 유무 불일치 — §4-2에서 통일) |
| `MarkdownEditorHandle` 인터페이스 | `MarkdownEditor.tsx:35-56` |
| CodeMirror `updateListener` | `MarkdownEditor.tsx:654-665` |
| `.cm-scroller` `overflow: visible` (f353e5c 수정분) | `MarkdownEditor.tsx:673-679` |
| 미리보기 `data-math-id` 부여 / 하이라이트 effect | `components/editor/EditorPreview.tsx:370-376, 409-418` |
| 미리보기 수식 클릭 핸들러 | `EditorPreview.tsx:421-427` |
| ⚠️ raw_text 저장 경로 (수정 금지 — Phase 54 D8 승계) | `EditorView.tsx` 저장 체인 일체 |

---

## 1. 목표

1. **버그1 근본 해결**: 편집창 맨 위 블록 상단 2~3줄이 상단 경계선 안쪽으로 밀려 올라가 스크롤로 복구 불가능해지는 고질적 버그의 재발 원천 차단.
2. **버그2-(2) 해결**: 편집창에서 비활성 블록의 수식을 클릭해도 미리보기 강조색이 예외 없이 작동.
3. **버그2-(1) 해결**: 수식 클릭 시(편집창·미리보기 어느 쪽이든) 양쪽 창 모두 해당 수식(LaTeX 태그 / 렌더된 수식)을 **세로 중앙**으로 — 세 클릭 경로의 스크롤 정책 통일.
4. **기능개선**: 입력 중 커서가 편집창 마지막 행 부근에 도달하면 활성 행을 세로 중앙으로 자동 스크롤 (typewriter scrolling).

## 2. 원인 규명 (증거 포함)

### 2-1. 버그1 — 스크롤 불가능한 조상의 프로그램적 세로 변위

`@codemirror/view`의 `scrollRectIntoView`(dist/index.js:540, v6 기준) 실측 코드:

```js
if (cur.scrollHeight <= cur.clientHeight && cur.scrollWidth <= cur.clientWidth) {
  cur = cur.assignedSlot || cur.parentNode;  // 스킵
  continue;
}
// ... overflow 스타일 검사 없이 ...
cur.scrollTop += moveY / scaleY;
```

즉 CM은 커서 가시화 시 **overflow 값과 무관하게** `scrollHeight > clientHeight`(또는 `scrollWidth > clientWidth` — **OR 조건**)인 모든 조상의 `scrollTop`을 변경한다. `overflow: hidden` 요소는 프로그램적으로는 스크롤 가능하지만 사용자는 되돌릴 수 없다.

EditorView의 편집창 조상 사슬에는 이런 요소가 3겹 존재한다: **블록 래퍼**(`overflow:'hidden'`, line 773) → **좌측 칼럼**(`overflow:'hidden'`, line 2873) → **content-frame**(`overflowY:'hidden'`, line 2864). 자동완성 팝업·린트 패널 등이 순간적으로 칼럼 밖으로 삐져나오거나(세로 overflow 발생), 좁은 창에서 가로 overflow가 생기면(OR 조건 충족) CM이 이 숨겨진 조상을 수 줄만큼 스크롤시킨다. 사용자가 스크롤할 수 있는 것은 편집 패널(`overflowY:'auto'`, line 2885)뿐이므로 **복구 불가** — "스크롤을 해도 내려오지 않음"과 정확히 일치. 브라우저 네이티브 `focus()`의 조상 reveal 스크롤도 동일 계열 경로다.

기존 수정 2회(`.cm-scroller overflow:visible`, `computeBlockAwareScrollTop` 클램프)는 **앱 코드가 스스로 하는 스크롤**만 교정했고 CM 내부/브라우저가 hidden 조상을 밀어올리는 경로는 막지 않았다 → 재발.

### 2-2. 버그2-(2) — `clearSelection()` dispatch가 `activeMathId`를 덮어씀

이벤트 순서 (편집창에서 비활성 블록 B의 수식 클릭 시):

1. mousedown → CM(B) selection dispatch → `handleCursorActivity(B)` → `setActiveMathId(정상값)`
2. click → `handleBlockFocus(B)` → `setActiveBlockId(B)`
3. **effect `[activeBlockId]`(line 2049-2053)** → 이전 블록 A에 `ref.clearSelection()` dispatch → CM(A) `updateListener`가 **동기 발화**(`selectionSet: true`) → `handleCursorActivity(A)` → A의 (변하지 않은) 커서 위치 기준으로 **`setActiveMathId` 덮어쓰기** — 대개 수식 밖이므로 `-1` → 미리보기 강조 해제.

같은 블록 재클릭은 `activeBlockId` 불변 → effect 미실행 → 정상 작동. 미리보기→편집창 방향(`handlePreviewMathClick`)은 clear 루프(line 1992-1994)가 setTimeout(100ms) **이전**에 실행되고 그 뒤 `setSelection`이 다시 올바른 cursorActivity를 발화시키므로 살아남는다. 관찰된 증상 전부와 부합.

### 2-3. 버그2-(1) — 클릭 경로별 스크롤 정책 불일치

| 클릭 경로 | 편집창 스크롤 | 미리보기 스크롤 |
|---|---|---|
| 편집창, 같은 블록 내 수식 | **없음** | **없음** |
| 편집창, 다른 블록 수식 | 커서 중앙 (블록 상단 우선 클램프) | **블록** 중앙 (수식 아님) |
| 미리보기 수식 클릭 | 커서 중앙 (클램프) | **없음** |

"수식 자체를 양쪽 모두 중앙"으로 두는 경로가 하나도 없음 → 제각각으로 보이는 것이 당연한 구조.

## 3. 확정 결정 사항 (v1 제안 — CLI 검증 대상)

| # | 결정 | 내용 |
|---|---|---|
| D1 | hidden 조상 원천 차단 | 블록 래퍼·좌측 칼럼·미리보기 칼럼의 `overflow:'hidden'` → **`overflow:'clip'`**. clip은 스크롤 컨테이너가 아니므로 CM·브라우저의 프로그램적 `scrollTop` 변경이 **no-op**. 세 요소 모두 명시적 `minHeight:0`(칼럼) 보유로 flex 최소 크기 회귀 없음 |
| D2 | content-frame 가드 | content-frame은 가로 스크롤(`overflowX:'auto'`)이 필요해 clip 불가(한 축 auto면 clip이 hidden으로 계산됨). → **scroll 이벤트 가드**: `scrollTop !== 0`이면 즉시 0 복원 (`scrollLeft`는 보존) |
| D3 | 비포커스 이벤트 무시 | `MarkdownEditorHandle`에 `hasFocus()` 추가(`view.hasFocus`). `handleCursorActivity` 첫머리에서 `!ref.hasFocus()`면 return → clearSelection 등 프로그램적 dispatch가 `activeMathId`를 오염시키는 경로 차단 |
| D4 | activeMathId 명시 설정 | cursorActivity에만 의존하지 않고, `handleBlockFocus`(클릭 지점 mathId 계산)와 `handlePreviewMathClick`(전달받은 mathId)에서 **`setActiveMathId`를 직접 호출** — D3 가드로 인한 공백 보완, 이중 안전장치 |
| D5 | 수식 중앙 정렬 통일 | 신규 헬퍼 2종. `scrollEditorToMathCenter(blockId)`: 커서 좌표 기준 **진짜 중앙**(블록 상단 클램프 없음, `fastScrollTo`의 ≥0 클램프만). `scrollPreviewToMathCenter(blockId, mathId)`: `[data-block-id]` 내 `.katex[data-math-id]` 요소 중앙, 미발견 시 블록 중앙 폴백. §2-3의 세 경로 전부에 이 쌍을 적용 |
| D6 | 비수식 클릭 동작 유지 | 수식 밖 클릭은 기존 동작 그대로 (같은 블록: 스크롤 없음 / 다른 블록: `scrollEditorToCursorCenter` + `scrollPreviewToBlockCenter`) |
| D7 | 클릭/키보드 구별 | `updateListener`에서 `update.transactions.some(tr => tr.isUserEvent('select.pointer'))`로 `pointerSelect` 플래그 전달. 수식 중앙 정렬은 **pointerSelect일 때만** — 화살표 키 이동·타이핑으로는 발동하지 않음 |
| D8 | typewriter 스크롤 | `docChanged && hasFocus`이고 커서 화면 y가 편집 패널 하단 **60px 이내**면 `computeBlockAwareScrollTop`로 중앙 재정렬. 패널의 기존 `paddingBottom:'100vh'` 덕에 문서 끝에서도 중앙 정렬 항상 가능. 임계값 60은 기존 `caretVisibleMin` 여백과 동일 |
| D9 | 단일 진입점 원칙 갱신 | `computeBlockAwareScrollTop`의 "모든 편집창 자동 스크롤은 이 함수를 거칠 것" 주석은 유지하되, **수식 클릭 중앙 정렬만 의도된 예외**임을 주석에 명기 (미리보기와의 대칭이 목적이므로 블록 상단 클램프 부적용) |
| D10 | 저장 경로 불가침 | raw_text 저장 체인·Firestore 스키마·보안 규칙 변경 **없음**. 본 Phase는 EditorView/MarkdownEditor/(필요시 EditorPreview) 렌더·이벤트 계층만 수정 |

## 4. 구현 상세

### 4-1. 버그1 (D1·D2)

- `EditorView.tsx:773` `overflow: 'hidden'` → `'clip'` (블록 래퍼 — border-radius 클리핑은 clip도 동일 수행).
- `EditorView.tsx:2873-2876`(좌측 칼럼)·`2945-2947`(미리보기 칼럼) `overflow: 'hidden'` → `'clip'`.
- content-frame에 `ref` 신설 + effect:

```tsx
/* 버그1 근본 대책: CM scrollRectIntoView는 overflow:hidden 조상도 scrollTop을 변경
   (scrollHeight>clientHeight OR scrollWidth>clientWidth면 무조건) → 사용자는 복구 불가.
   clip 불가한 content-frame(가로 auto)은 세로 변위를 이벤트로 즉시 되돌린다. */
useEffect(() => {
  const el = contentFrameRef.current;
  if (!el) return;
  const guard = () => { if (el.scrollTop !== 0) el.scrollTop = 0; };
  el.addEventListener('scroll', guard);
  return () => el.removeEventListener('scroll', guard);
}, []);
```

### 4-2. MarkdownEditor (D3·D7)

- prop 타입(line 32)과 `EditorView.tsx:747`의 `onCursorActivity` 타입을 `{ line, offset, docChanged, pointerSelect, blockId }`로 **통일** (현재 747은 docChanged 누락 상태).
- Handle에 `hasFocus(): boolean` 추가 (line 43 근처 + 구현 `viewRef.current?.hasFocus ?? false`).
- `updateListener`(line 654-665)에서 `pointerSelect` 계산해 콜백에 포함.

### 4-3. handleCursorActivity 재작성 (D3·D5·D7·D8)

```tsx
const handleCursorActivity = useCallback((info) => {
  const ref = editorRefs.current[info.blockId];
  if (!ref) return;
  if (!ref.hasFocus()) return;                       // D3: 프로그램적 dispatch 무시
  const content = ref.getContent();
  const mathId = findMathIdAtCursor(buildMathIndex(content), info.offset);
  setActiveMathId(mathId);
  if (info.blockId === activeBlockId) {
    setCursorInMath(isInsideMath(content, info.offset));
    if (info.pointerSelect && mathId >= 0) {          // D5·D7: 같은 블록 수식 클릭
      scrollEditorToMathCenter(info.blockId);
      scrollPreviewToMathCenter(info.blockId, mathId);
    }
  }
  if (info.docChanged) maybeRecenterOnBottomTyping(info.blockId);  // D8
}, [activeBlockId, /* 신규 헬퍼들 */]);
```

주의: 다른 블록 클릭 시(`info.blockId !== activeBlockId` 시점) 중앙 정렬은 여기서 하지 않는다 — `handleBlockFocus`가 담당 (이중 스크롤 방지).

### 4-4. handleBlockFocus 재작성 (D4·D5·D6)

click 시점(mouseup 이후)이므로 커서는 이미 클릭 위치로 이동해 있음 → `ref.getCursorPosition()` 기준 mathId 계산이 유효.

```tsx
const handleBlockFocus = useCallback((blockId) => {
  const ref = editorRefs.current[blockId];
  if (blockId !== activeBlockId) {
    skipNextBlockScrollRef.current = true;
    setActiveBlockId(blockId);
    let mathId = -1;
    if (ref) mathId = findMathIdAtCursor(buildMathIndex(ref.getContent()), ref.getCursorPosition());
    setActiveMathId(mathId);                          // D4: 명시 설정 (버그2-2)
    if (mathId >= 0) {                                // D5: 수식이면 수식 중앙
      scrollEditorToMathCenter(blockId);
      scrollPreviewToMathCenter(blockId, mathId);
    } else {                                          // D6: 기존 동작
      scrollEditorToCursorCenter(blockId);
      scrollPreviewToBlockCenter(blockId);
    }
  }
  if (ref) setCursorInMath(isInsideMath(ref.getContent(), ref.getCursorPosition()));
}, [/* ... */]);
```

### 4-5. handlePreviewMathClick 수정 (D4·D5)

- `setActiveBlockId` 직후 **`setActiveMathId(mathId)` 추가** (D4).
- setTimeout 내부: `ref.focus()`를 `setSelection` **앞으로** 이동 (D3 가드 통과 보장).
- 기존 rAF 인라인 스크롤 블록(line 2011-2019, 클램프 적용) → `scrollEditorToMathCenter(blockId)`로 교체 + **`scrollPreviewToMathCenter(blockId, mathId)` 추가** (현재 미리보기는 스크롤 안 함).

### 4-6. 신규 스크롤 헬퍼 (D5)

```tsx
const scrollEditorToMathCenter = useCallback((blockId: string) => {
  setTimeout(() => {
    const ref = editorRefs.current[blockId];
    const container = editorPanelRef.current;
    if (!ref || !container) return;
    const coords = ref.getCursorCoords();
    if (!coords) return;
    const rect = container.getBoundingClientRect();
    fastScrollTo(container, coords.top - rect.top + container.scrollTop - rect.height / 2, BLOCK_SCROLL_MS);
  }, 50);
}, []);

const scrollPreviewToMathCenter = useCallback((blockId: string, mathId: number) => {
  setTimeout(() => {
    requestAnimationFrame(() => {
      const container = previewRef.current;
      if (!container) return;
      const blockPreview = container.querySelector(`[data-block-id="${blockId}"]`);
      const mathEl = blockPreview?.querySelector(`.katex[data-math-id="${mathId}"]`) as HTMLElement | null;
      const targetEl = mathEl ?? (blockPreview as HTMLElement | null);   // 폴백: 블록 중앙
      if (!targetEl) return;
      const cRect = container.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const center = tRect.top - cRect.top + container.scrollTop + tRect.height / 2;
      fastScrollTo(container, center - cRect.height / 2, BLOCK_SCROLL_MS);
    });
  }, 50);
}, []);
```

### 4-7. typewriter 스크롤 (D8)

```tsx
const TYPING_BOTTOM_MARGIN = 60;
const maybeRecenterOnBottomTyping = useCallback((blockId: string) => {
  const ref = editorRefs.current[blockId];
  const container = editorPanelRef.current;
  if (!ref || !container) return;
  const coords = ref.getCursorCoords();
  if (!coords) return;
  const rect = container.getBoundingClientRect();
  if (coords.top < rect.bottom - TYPING_BOTTOM_MARGIN) return;
  const blockEl = container.querySelector(`[data-editor-block-id="${blockId}"]`) as HTMLElement | null;
  if (!blockEl) return;
  fastScrollTo(container, computeBlockAwareScrollTop(container, blockEl, coords.top), BLOCK_SCROLL_MS);
}, []);
```

CM 자체의 최소 가시화 스크롤이 dispatch 중 동기 실행된 뒤, 본 헬퍼의 rAF 애니메이션이 이후 프레임에서 실행되므로 충돌 없음. 한 번 중앙 정렬되면 커서가 하단 임계 밖이므로 다음 도달 시까지 no-op (연속 타이핑 시 과도 발동 없음).

## 5. 알려진 리스크 / CLI 검증 요청 사항

| # | 항목 | 검증 방법 |
|---|---|---|
| R1 | `overflow:'clip'` 브라우저 지원 및 border-radius 클리핑 동작 (Chrome/Safari/Firefox 현행판) | 실행 확인 + 시각 확인. 문제 시 해당 요소는 hidden 유지 + D2식 scroll 가드로 대체 |
| R2 | clip 전환 후 flex 레이아웃 회귀 (칼럼 `minHeight:0` 명시돼 있어 이론상 무영향) | 좁은 창·전체화면·토론 패널 열림 상태 레이아웃 확인 |
| R3 | CM이 mousedown 시점에 focus를 selection dispatch보다 먼저 잡는지 (D3 가드가 첫 클릭 cursorActivity를 삼키는지) | 실측. 삼키더라도 D4의 명시 설정이 커버하지만, 같은 블록 첫 클릭 경로(§4-3)는 hasFocus 통과가 전제이므로 확인 필요 |
| R4 | 편집창 mathId(원문 `$…$`/`$$…$$`/`\[..\]`/`\(..\)` 순서) ↔ 미리보기 `.katex` DOM 순서 매핑이 어긋나는 케이스 (`\tag`, array 분해, ChoicesBlock 등) — **기존 가정 승계**, 본 Phase에서 새로 도입하는 위험 아님 | 대표 문서로 스팟 체크. 어긋나는 유형 발견 시 문서화만 (수정은 별도) |
| R5 | 한글 IME 조합 중 typewriter 스크롤 발동 시 조합 안정성 (컨테이너 스크롤은 조합에 영향 없어야 정상) | 조합 중 하단 도달 시나리오 실측 |
| R6 | `clearSelection` 루프(line 2049-2053) 자체의 존치 여부 — D3 가드로 무해화되지만 제거가 더 깔끔한지 | 존치 권장(선택 해제 UX 목적). 제거 시 회귀 확인 |
| R7 | 문서 최상단 수식은 위 여백 부족으로 완전 중앙 불가 (양쪽 모두 ≥0 클램프로 "가능한 최상단") — 한계로 문서화 | 동작 확인만 |

## 6. 검증 체크리스트 (구현 후)

| # | 항목 |
|---|---|
| T1 | `npm run build` 통과 (타입 포함) |
| T2 | **버그1 재현 시도**: 긴 문서 하단에서 자동완성 팝업 띄운 채 타이핑 반복 + 좁은 창(가로 overflow) 상태 반복 → 맨 위 블록 상단이 경계선 안으로 밀리지 않고, content-frame·칼럼·블록 래퍼의 `scrollTop`이 항상 0 (DevTools로 확인) |
| T3 | 편집창에서 **다른 블록** 수식 클릭 → 미리보기 강조색 예외 없이 적용 + 양쪽 수식 중앙 |
| T4 | 편집창에서 **같은 블록** 수식 클릭 → 양쪽 수식 중앙 (기존: 아무 동작 없음) |
| T5 | 미리보기 수식 클릭 → 편집창 노랑 하이라이트 + 양쪽 수식 중앙 (기존: 미리보기 스크롤 없음) |
| T6 | 수식 밖 클릭: 같은 블록=스크롤 없음, 다른 블록=기존 커서 중앙+블록 중앙 유지 |
| T7 | 화살표 키로 수식 안 진입 → 하이라이트만 갱신, **스크롤 발동 없음** (D7) |
| T8 | 타이핑으로 커서가 편집창 하단 도달 → 부드럽게 중앙 재정렬, 이후 하단 재도달까지 재발동 없음. IME 조합 중 깨짐 없음 |
| T9 | 찾기/바꾸기 패널 이동·DnD·블록 접기/전체접기·탭 전환·상단바 클릭(블록 상단 정렬) 회귀 없음 |
| T10 | 좁은 창 가로 스크롤(content-frame overflowX) 정상 동작 |
| T11 | 저장/버전 스냅샷(Phase 55) 경로 diff 없음 — `git diff`가 EditorView/MarkdownEditor(/EditorPreview) 외 파일을 건드리지 않음 |

## 7. 문서 갱신 (구현 완료 후)

1. `docs/roadmap.md`에 **Phase 56** 섹션 신설 (본 문서 요약 + 교훈: "CM scrollRectIntoView는 overflow:hidden 조상도 스크롤한다 — 세로 스크롤 소유자가 아닌 래퍼는 `overflow:clip` 또는 scroll 가드 필수").
2. **Phase 15** 표(roadmap.md:95-103) 비고에 "→ Phase 56에서 수식 클릭 세로 중앙 정렬 통일·cross-block 하이라이트 수정" 상호참조 추가.
3. 미기록 커밋 `f353e5c`(2026-07-18)를 Phase 56 배경(버그1 2차 수정 이력)으로 소급 기재.
4. `CLAUDE.md` "핵심 패턴 & 주의사항"에 clip/scroll-가드 규칙 1줄 추가.
5. 본 계획서(v2 확정본)를 `docs/phasedocs/`에 등록.
