# Phase 56 — 편집창·미리보기 수식 세로 중앙 정렬 통일 + 상단 밀림 근본 대책 **v2**

작성일: 2026-08-10 · 작성: CLI Claude (Opus 5) · 검토 대상: web Claude(Fable) v1
기준 커밋: **`ea14751`** (v1 기준 `c622b7d`에서 3커밋 진행 — §0-1 참조)

> **본 문서의 위상** — v1을 실코드와 대조 검증한 결과물. v1의 **구조·목표·D4/D5의 정렬 통일 방향은 타당**하나, **§2-1 근본원인 진단은 틀렸다**. 아래 §1에 치명 항목 4건을 먼저 싣고, 이후 v1 순서를 따라 정정한다. web Claude는 §1 → §2 순으로 재검토할 것.
>
> **⚡ v2.1 갱신 (동일 세션 내)** — D0 계측을 **실제로 실행하여 버그1의 범인을 확정했다**(§1-0). 범인은 CM의 overflow 처리도, 가로 스크롤바도 아니었다. **`paddingBottom:'100vh'` + `box-sizing:border-box`** 조합이 편집 패널의 최소 높이를 강제해 부모(`overflow:hidden`)에 상시 세로 overflow를 만드는 것이 원인이며, 수정안까지 실측 검증했다. §1-1/§1-2와 D1/D2는 이에 맞춰 전면 개정되었다.

---

## 0. 기준선 정정

### 0-1. v1 이후 커밋 3건 — 줄번호 시프트 발생

v1 작성 시점 이후 다음이 커밋됨(미푸시 상태였다가 정리):

| 커밋 | 내용 | 영향 |
|---|---|---|
| `dad2588` | 한글 IME 조합 중 LaTeX 린터 진단 갱신 스킵 (`view.composing` 가드, delay 500→1200) | **MarkdownEditor.tsx 이후 줄 +14** |
| `c7d6edc` | 구 `/problems` 라우트·`BlockEditor`·`SortableBlock` 제거 | 없음 |
| `ea14751` | 문서 | 없음 |

`dad2588`은 EditorView.tsx:1618(블록 분리 시 불필요한 `setContent` 스킵)도 포함 → **EditorView.tsx 1618 이후 줄 +1**.

**⚠️ `dad2588`은 본 Phase와 직접 충돌 영역이다.** 편집창 IME 조합 중 데코레이션 변동이 조합을 깨뜨린다는 사실이 이미 확인·수정되었으므로, D8(typewriter 스크롤)은 반드시 `composing` 가드를 상속해야 한다(§1-3, §3 D8').

### 0-2. 앵커 테이블 (HEAD `ea14751` 기준, 전수 확인 완료)

| 확인 항목 | v1 표기 | **실제(HEAD)** | 판정 |
|---|---|---|---|
| `buildMathIndex` | EV:140-190 | **EV:135-190** | 시작줄 오기 |
| `findMathIdAtCursor` | EV:192-197 | EV:192-197 | ✅ |
| `fastScrollTo` | EV:200-214 | EV:200-214 | ✅ (`Math.max(0, top)` 클램프 202 확인) |
| `computeBlockAwareScrollTop` | EV:226-244 | EV:226-244 | ✅ |
| 블록 래퍼 `overflow:'hidden'` | EV:773 | EV:773 | ✅ |
| 블록 콘텐츠 `onClick={onFocus}` | EV:890 | EV:890 | ✅ |
| **`<MarkdownEditor>` 렌더 / blockId 주입 래퍼** | *(누락)* | **EV:905, 910-911** | ➕ 추가 |
| `activeMathId` state | EV:1033 | EV:1033 | ✅ |
| `previewRef`/`editorPanelRef` | EV:1040-1041 | EV:1040-1041 | ✅ |
| `BLOCK_SCROLL_MS`/`skipNextBlockScrollRef` | EV:1768,1770 | **EV:1769,1771** | +1 |
| 스크롤 헬퍼 4종 | EV:1773-1833 | **EV:1774-1834** | +1 |
| `handleCursorActivity` | EV:1955-1966 | **EV:1956-1967** | +1 |
| `handleBlockFocus` | EV:1969-1981 | **EV:1970-1982** | +1 |
| `handlePreviewMathClick` | EV:1984-2021 | **EV:1985-2022** | +1 |
| 기본 자동 스크롤 effect | EV:2025-2043 | **EV:2026-2044** | +1 |
| `clearSelection()` 루프 effect | EV:2049-2053 | **EV:2050-2054** | +1 |
| content-frame | EV:2863-2870 | **EV:2864-2871** | +1 |
| 편집창 좌측 칼럼 | EV:2873-2876 | **EV:2874-2877** | +1 |
| 편집 패널 | EV:2885 | **EV:2886** | +1 |
| 미리보기 칼럼/패널 | EV:2945-2950 | **EV:2946-2951** | +1 |
| `EditorPreview` activeMathId 전달 | EV:3012,3023 | **EV:3013,3024** | +1 |
| `onCursorActivity` prop 타입 | ME:32 / EV:747 | ME:32 / EV:747 | ✅ (불일치 내용은 §3 D-타입) |
| `MarkdownEditorHandle` | ME:35-56 | ME:35-56 | ✅ |
| `updateListener` | ME:654-665 | **ME:668-679** | +14 |
| `.cm-scroller overflow:visible` | ME:673-679 | **ME:687-693** | +14 |
| **CM 래퍼 div `overflow:'hidden'`** | *(누락)* | **ME:834-843 (841)** | ➕ 누락 — 조상 목록 완전성용 (D0 결과 범인 아님) |
| **CM 테마 `'&': {height:'100%'}`** | *(누락)* | **ME:680-686 (682)** | ➕ 추가 |
| 미리보기 `data-math-id` 부여 | EP:370-376 | **EP:369-376** | 시작줄 오기 |
| 미리보기 하이라이트 effect | EP:409-418 | EP:409-418 | ✅ |
| 미리보기 수식 클릭 핸들러 | EP:421-427 | EP:421-427 | ✅ |

(EV=EditorView.tsx, ME=MarkdownEditor.tsx, EP=EditorPreview.tsx)

---

## 1. D0 실측 결과 + 치명 지적 4건

---

### 1-0. **D0 실측 완료 — 버그1 범인 확정** ✅🔴

**실행 방법**: 실제 앱은 Firebase 인증 게이트 뒤에 있어 자동 구동이 불가하므로, `EditorView.tsx`의 조상 체인(content-frame → 좌측칼럼 → 편집패널 → 블록래퍼 → 블록콘텐츠 → `MarkdownEditor` 래퍼)을 **바이트 단위로 복제한 격리 하니스**(`app/d0-probe/page.tsx`, 실제 `MarkdownEditor` 컴포넌트 사용)를 임시 생성하고 Playwright + 시스템 Chrome으로 구동. 측정 후 하니스는 삭제(커밋되지 않음).

#### 결과 — 범인은 **단 하나, 좌측 칼럼(EV:2874-2877)**

4개 시나리오(넓은 창/좁은 창 × 오버레이 스크롤바/클래식 스크롤바) **전부에서 동일**:

```
E_culprits: [ { el: "left-column", scrollTop: 53, vOver: 53, oy: "hidden" } ]
```

- 타이핑 전: `left-column`은 `scrollTop 0`, 그러나 **`scrollHeight - clientHeight = 53`** (상시 세로 overflow 보유)
- 타이핑 후: CM `scrollRectIntoView`가 **`scrollTop`을 53으로 밀어붙임 → 복구 불가**
- 그 결과 편집 패널 자체가 통째로 53px 위로 밀림 (`panelTopViewport: 45 → -8`)
- 다른 어떤 요소도 밀리지 않음 — 블록 래퍼·content-frame·CM 래퍼 모두 `scrollTop 0`, `vOver 0` 유지

#### 진짜 원인 — `paddingBottom: '100vh'` + `box-sizing: border-box`

```
left-column   clientHeight 855   (flex 1 1 0%, minHeight 0, overflow hidden)
editor-panel  offsetHeight 908   ← 부모보다 53px 크다
              paddingTop 8px / paddingBottom 900px(=100vh) / boxSizing border-box
```

`box-sizing: border-box`에서 요소의 **사용 높이는 패딩 합보다 작아질 수 없다.** 편집 패널(EV:2886)은 `paddingBottom:'100vh'`를 갖고 있으므로 최소 높이가 **`8px + 100vh = 908px`**로 고정된다. flex가 855px를 배정해도 박스는 908px로 버티고, **`overflow:hidden`인 부모 좌측 칼럼에 53px의 스크롤 가능 영역이 상시 존재**하게 된다. CM은 이 틈을 정확히 파고든다.

**공식**: `overflow = paddingTop + 100vh − 좌측칼럼높이` = **`paddingTop + (편집 패널 위쪽 크롬 높이) + 테두리`**

하니스는 상단바 44px만 두어 53px이 나왔다. **실제 앱은 Row 1(헤더) + Row 2(탭바)가 얹혀 있어 크롬이 훨씬 두껍다 → 실제 밀림 폭은 100~150px대로 예상되며, 이는 `lineHeight 1.8 × 15px ≒ 27px/줄` 기준 정확히 "상단 3~5줄"에 해당한다.** 창 높이에 무관하게 일정하고(600px/900px 창 모두 53px), 창 높이를 바꾸면 100vh가 따라 변해 밀림 폭이 유지되는 것도 증상과 부합한다.

#### 미리보기 패널에도 **동일한 잠복 버그**

`preview-column`의 `vOver = 65` — 미리보기 패널(EV:2951)의 `padding: '20px 32px 100vh 32px'`가 같은 원리로 65px(`20 + 100vh − 855`) overflow를 만든다. 이번 측정에서는 CM이 미리보기 안에서 스크롤할 일이 없어 발현하지 않았을 뿐, **이미지 리사이즈 오버레이·앵커 이동 등 미리보기 내부의 어떤 `scrollIntoView`/`focus()`도 동일하게 65px 영구 밀림을 일으킨다.** 같이 고쳐야 한다.

#### 수정안 실측 검증 — **완치 확인**

편집/미리보기 패널의 `paddingBottom:'100vh'`를 **내부 콘텐츠 div로 이관**:

| | leftCol vOver | previewCol vOver | 타이핑 후 leftCol scrollTop | 범인 | scroll-past-end 여백 |
|---|---|---|---|---|---|
| **현행** (창 900) | 53 | 65 | **53** | left-column | 5966 |
| **수정안** (창 900) | **0** | **0** | **0** | **없음** | 6027 ✅ |
| **현행** (창 600) | 53 | 65 | **53** | left-column | 5966 |
| **수정안** (창 600) | **0** | **0** | **0** | **없음** | 6027 ✅ |

세로 overflow가 0이 되면 CM이 스킵 조건(`dist/index.js:536`)에 걸려 **애초에 진입조차 못 한다.** 근본 차단이다. 그리고 "문서 끝에서도 계속 스크롤되는" 여백 효과는 그대로 보존된다(오히려 소폭 증가).

#### 그러므로 v1의 D1·D2는 **불필요하다**

- **가로 스크롤바 가설은 기각.** 오버레이 스크롤바(창 1440) / 클래식 스크롤바(창 900, 가로 overflow 251px 발생) 두 조건에서 결과가 **완전히 동일한 53px**이었다. 가로 overflow는 무관하다.
- **`hidden` → `clip` 전환 불필요.** 증상(스크롤 가능함)이 아니라 원인(세로 overflow가 생김)을 없애는 것이 맞다. 브라우저 호환·렌더링 회귀 리스크를 질 이유가 없다.
- **content-frame scroll 가드 불필요.** content-frame은 4개 시나리오 전부에서 `vOver 0`·`scrollTop 0`이었다. 범인이 아니다.

---

### 1-1. §2-1 근본원인 진단은 **틀렸다** (D0로 확정) 🔴

> *아래는 D0 실행 전에 작성된 코드 리뷰 근거다. §1-0의 실측이 이를 확증했으므로 논거로서 유지한다.*

v1 §2-1의 코드 인용 자체는 정확하다. `@codemirror/view@6.39.14` `dist/index.js:536`:

```js
if (cur.scrollHeight <= cur.clientHeight && cur.scrollWidth <= cur.clientWidth) {
  cur = cur.assignedSlot || cur.parentNode;  // 스킵
  continue;
}
...
cur.scrollTop += moveY / scaleY;   // line 592, overflow 스타일 검사 없음
```

"overflow 값과 무관하게 scrollTop을 건드린다"는 것도 사실이다. **그러나 다음이 틀렸다.**

**(a) "가로 overflow만으로 세로가 밀린다"는 성립하지 않는다.**
v1은 스킵 조건이 AND이므로 `scrollWidth > clientWidth`만 충족해도 진입한다는 점에서 "좁은 창에서 가로 overflow가 생기면 CM이 이 숨겨진 조상을 세로로 스크롤시킨다"고 결론냈다. 진입은 맞지만, **`scrollHeight <= clientHeight`인 요소의 `scrollTop`은 브라우저가 0으로 클램프**하므로 592행 대입은 no-op이다. 세로 변위에는 **실제 세로 overflow가 반드시 필요**하다. 이 논거는 폐기해야 한다.

**(b) 지목한 3개 조상 중 실제 범인은 좌측 칼럼 하나뿐이며, v1이 든 이유와는 무관하다.** (D0 실측 결과)

| 요소 | overflow | 실측 vOver | 실측 scrollTop | 판정 |
|---|---|---|---|---|
| 블록 래퍼 (EV:773) | `hidden` | **0** | 0 | 무관 (height auto로 성장) |
| **좌측 칼럼 (EV:2874-2877)** | `hidden` | **53** | **53** | 🔴 **범인** — 단 원인은 §1-0의 패딩 |
| content-frame (EV:2864) | `Y:hidden / X:auto` | **0** | 0 | 무관 |
| CM 래퍼 (ME:841, v1 누락) | `hidden` | **0** | 0 | 무관 |

v1이 제시한 메커니즘("가로 스크롤바가 `clientHeight`를 줄여 세로 overflow 유발")은 **실측으로 기각**되었다. 가로 overflow가 251px 발생한 조건과 0px인 조건에서 밀림 폭이 **동일하게 53px**이었다. 좌측 칼럼이 범인인 것은 우연히 맞았지만, 이유는 완전히 다르다(§1-0).

**(c) v1이 놓친 4번째 hidden 조상이 있다 — CM 바로 바깥 래퍼.** *(D0 결과: 이 요소는 범인이 아니었으나, 조상 목록의 완전성을 위해 유지)*

`MarkdownEditor.tsx:834-843`:
```tsx
<div ref={editorRef} style={{
  height: autoHeight ? 'auto' : '100%',
  minHeight: autoHeight ? '60px' : undefined,
  border: 'none',
  overflow: 'hidden',          // ← 4번째. v1 D1 미포함
}} />
```
게다가 **`autoHeight`는 EditorView에서 한 번도 전달되지 않는다**(EV:905 렌더 지점 확인; `autoHeight`를 쓰는 곳은 `EditorPreview`/`CommentEditor`뿐). 즉 이 래퍼는 `height:'100%'`이고, CM 테마 `'&': {height:'100%'}`(ME:682)와 함께 **`.cm-scroller`가 `overflow:visible`(ME:690)로 열려 있는 바로 그 지점을 감싸는 유일한 클리핑 경계**다. 세로 overflow가 발생한다면 여기가 1순위다.
(퍼센트 높이의 컨테이닝 블록이 auto이면 CSS상 `auto`로 해석되므로 실측이 필요하다 — 그래서 §1-2의 계측 게이트가 필요하다.)

> **참고 — CLAUDE.md 정정 대상**: "CodeMirror autoHeight 모드: `EditorView.scrollIntoView` 사용 금지"라는 주의사항이 있으나, 편집창 CM은 `autoHeight`를 쓰지 않는다. 이 주의사항은 현재 코드 기준으로 문구를 바로잡아야 한다(§7).

**(d) 용의자 1건은 제거 가능 — CM의 `focus()`는 스크롤 안전하다.**
v1은 "브라우저 네이티브 `focus()`의 조상 reveal 스크롤도 동일 계열 경로"라 했으나, CM은 `focusPreventScroll()`(`dist/index.js:675-702`)로 `focus({preventScroll:true})`를 쓰고, 미지원 환경에선 **조상 `scrollTop`/`scrollLeft`를 전부 스택에 저장했다가 복원**한다. Safari 26+에서만 복원 kludge 경로를 타는데(669-672행), 이는 순간 깜빡임은 있어도 **영구 변위를 남기지 않는다**. `focus()` 경로는 용의선상에서 제외하고 디버깅 시간을 아낄 것.

**(e) 진짜 트리거는 "타이핑"이다.** CM6는 DOM 입력에서 생성한 트랜잭션에 `scrollIntoView`를 붙이고, 측정 단계에서 `dist/index.js:3417`이 `scrollRectIntoView`를 호출한다. 여기에 더해 `MarkdownEditorHandle.scrollToPos`(ME:391-397)가 `EditorView.scrollIntoView(pos, {y:'center'})`를 **명시적으로** 디스패치한다(찾기/바꾸기 경로). 재현 시나리오는 "타이핑"과 "찾기/바꾸기 이동" 둘 다 돌려야 한다.

**결론**: §2-1의 "CM이 hidden 조상을 스크롤한다"는 큰 틀은 맞았으나, **왜 그 조상에 세로 overflow가 생기는지**를 틀리게 짚었다. 그 결과 처방(D1/D2)도 빗나갔다. 정답은 §1-0.

### 1-2. 계측 게이트 (D0) — **실행 완료** ✅

*아래 스니펫은 D0 실행에 실제로 사용된 것이며, 덕수가 실제 앱에서 재확인할 때 그대로 쓸 수 있다.*

구현 전, 재현 상태에서 조상 체인을 **실측**한다. 임시 코드(커밋 금지):

```tsx
// 재현 직후 콘솔에서 실행 — 어느 조상이 실제로 밀렸는지 단정
(() => {
  let el = document.querySelector('.cm-content');
  const rows = [];
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (el.scrollTop !== 0 || el.scrollHeight > el.clientHeight) {
      rows.push({
        tag: el.className || el.tagName,
        scrollTop: el.scrollTop,
        over: el.scrollHeight - el.clientHeight,
        overflowY: cs.overflowY, overflowX: cs.overflowX,
      });
    }
    el = el.parentElement;
  }
  console.table(rows);
})();
```

**하니스 실행 결과 = `left-column` 단일 범인**(§1-0). 덕수가 실제 앱(로그인 상태·실제 문항)에서 한 번 더 돌려 **밀림 폭이 하니스의 53px보다 큰지**(예상: 100~150px)만 확인하면 §1-0의 공식이 실앱에서도 검증된다.

> 참고 — 세로 overflow가 있는데 `overflowY`가 `auto`인 요소(`.scaled-editor`)는 정상이다. 사용자가 스크롤로 되돌릴 수 있기 때문. 문제는 `hidden`/`clip`이면서 `scrollTop != 0`인 요소뿐이다.

### 1-3. D5의 "블록 상단 클램프 없음"은 **명문화된 불변식 위반** 🔴

v1 D5: `scrollEditorToMathCenter`는 "블록 상단 클램프 없음, `fastScrollTo`의 ≥0 클램프만".

그런데 `EditorView.tsx:225`에 명시적으로:
```
⚠️ 편집창 자동 스크롤은 반드시 이 함수를 거칠 것 — 중앙 정렬 버그 재발 방지의 단일 지점.
```
이 불변식은 **2026-07-16에 "첫 블록 상단 가려짐" 버그를 실제로 잡으면서 세운 것**이고, 당시 원인이 바로 **중앙 정렬 스크롤**이었다. v1은 D9에서 "예외임을 주석으로 명기"라고만 처리했는데, **주석은 불변식을 지키지 못한다.**

**D0 이후 이 지적은 오히려 강화된다.** D1″가 없애는 것은 **CM이 `overflow:hidden` 조상을 미는 경로**(버그1)뿐이고, `computeBlockAwareScrollTop`이 방어하는 것은 **앱 자신의 `fastScrollTo`가 `.scaled-editor`를 과다 스크롤하는 경로**(2026-07-16 버그)다. 둘은 **완전히 다른 경로**이므로 D1″는 클램프의 대체재가 되지 못한다. 클램프를 제거하면 2026-07-16 버그는 그대로 되살아난다.

**정정안(D5')**: 클램프를 제거하지 말고 **완화**한다.

```tsx
/** 수식 클릭 전용: 중앙 정렬을 우선하되 블록 상단 가시성 하한은 유지.
 *  블록이 패널보다 크면(깊은 수식) 상단 클램프를 포기하고 중앙을 택한다. */
function computeMathCenterScrollTop(container, blockEl, cursorViewportTop) {
  const cRect = container.getBoundingClientRect();
  const bRect = blockEl.getBoundingClientRect();
  const blockTop = bRect.top - cRect.top + container.scrollTop;
  const cursorRel = cursorViewportTop - cRect.top + container.scrollTop;
  const center = cursorRel - cRect.height / 2;
  // 블록이 패널 안에 들어오면 상단 가시성 우선(기존 불변식 유지),
  // 넘치면 중앙 정렬 우선(대칭성이 목적인 수식 클릭의 요구)
  if (bRect.height <= cRect.height) return Math.min(center, blockTop - 8);
  return center;   // fastScrollTo가 ≥0 클램프
}
```
`computeBlockAwareScrollTop`(EV:226)은 **그대로 두고**, 이 함수를 그 바로 아래에 형제로 추가한다. 주석에 "일반 자동 스크롤은 `computeBlockAwareScrollTop`, 수식 클릭 대칭 정렬만 이 함수"라고 못박는다.

### 1-4. D8 typewriter 스크롤이 **긴 블록에서 작동하지 않고 매 키입력 재발화** 🔴

v1 §4-7은 `computeBlockAwareScrollTop`으로 재정렬한다. 이 함수는(EV:237-243):
```
center          = cursorRel - h/2
topVisibleMax   = blockTop - 8
caretVisibleMin = cursorRel - (h - 60)
target = max( min(center, topVisibleMax), caretVisibleMin )
```

**블록이 패널보다 긴 경우**(장문 풀이 블록 — typewriter가 가장 필요한 상황) `blockTop`이 커서보다 훨씬 위 → `topVisibleMax < center` → `target = topVisibleMax` → 이어서 `caretVisibleMin`이 끌어올려 **최종적으로 `target = caretVisibleMin`**. 결과:

- 커서가 **패널 하단에서 정확히 60px 위**에 놓인다. **중앙 정렬이 전혀 아니다.**
- v1 §4-7의 발화 조건은 `coords.top >= rect.bottom - 60`. 재정렬 결과가 정확히 그 경계값이므로 **부동소수 오차에 따라 다음 키입력에서 즉시 재발화** → 매 키입력 `fastScrollTo(450ms)` 재시작 → 끊김·멀미.

또한 v1이 "한 번 중앙 정렬되면 커서가 하단 임계 밖이므로 다시 도달 전까지 no-op"이라고 쓴 것은 **짧은 블록에서만 참**이다.

**정정안(D8')**: 전용 계산 + **히스테리시스**(발화선 ≠ 착지선)로 재발화를 원천 차단한다.

```tsx
const TYPING_TRIGGER_MARGIN = 80;   // 하단 80px 안으로 들어오면 발화
const TYPING_LANDING_RATIO  = 0.45; // 패널 높이의 45% 지점에 착지 (≠ 발화선)

const maybeRecenterOnBottomTyping = useCallback((blockId: string) => {
  const ref = editorRefs.current[blockId];
  const container = editorPanelRef.current;
  if (!ref || !container) return;
  if (ref.isComposing()) return;                 // ★ dad2588 IME 가드 상속 (§1-3 주의)
  const coords = ref.getCursorCoords();
  if (!coords) return;
  const rect = container.getBoundingClientRect();
  if (coords.top < rect.bottom - TYPING_TRIGGER_MARGIN) return;
  const cursorRel = coords.top - rect.top + container.scrollTop;
  const target = cursorRel - rect.height * TYPING_LANDING_RATIO;
  fastScrollTo(container, target, 260);          // 450ms는 타자 흐름에 너무 길다
}, []);
```
착지 후 커서는 패널 상단 45% 지점 → 하단까지 55% 여유 → **다음 발화까지 수십 줄**. 블록 상단 클램프는 쓰지 않는다(타자 중에는 블록 상단 가시성이 요구사항이 아니며, §1-3의 불변식은 "클릭 유발 정렬"에 대한 것이다 — 이 예외를 EV:225 주석에 명시).

`isComposing()`은 `MarkdownEditorHandle`에 신규 추가(`viewRef.current?.composing ?? false`). **`dad2588`이 확인한 바와 같이 조합 중 DOM/스크롤 변동은 조합을 깨뜨린다** — 이 가드는 선택이 아니라 필수다.

---

## 2. 정확했던 진단 (v1 유지)

- **§2-2 (버그2-2 원인)** — ✅ **완전히 정확**. 실코드로 확인:
  `clearSelection()`(ME:344-350)은 `view.dispatch({selection:{anchor:pos}})`를 하고, `updateListener`(ME:672)는 `update.selectionSet || update.docChanged`에서 무조건 콜백을 쏜다. 따라서 EV:2050-2054 effect가 이전 블록 A에 `clearSelection()`을 걸면 A의 `cursorActivity`가 동기 발화해 `setActiveMathId(-1)`로 덮어쓴다. 인과 사슬 4단계 전부 코드로 재현 가능.
- **§2-3 (경로별 정책 불일치 표)** — ✅ 정확. EV:1970-1982(다른 블록: 커서 중앙+블록 중앙), EV:1985-2022(미리보기 클릭: 편집창만 스크롤, 미리보기 스크롤 없음), 같은 블록: 아무 동작 없음 — 3행 모두 코드와 일치.
- **D2의 "한 축 auto면 clip이 hidden으로 계산됨"** — ✅ 규칙 자체는 정확. CSS Overflow 3: 한쪽이 `clip`이고 다른 쪽이 `scroll`/`auto`면 `clip`은 `hidden`으로 계산된다. (*단 D0로 content-frame이 범인이 아님이 밝혀져 D2는 폐기 — 규칙만 참고 지식으로 남긴다.*)
- **D7 (`select.pointer`)** — ✅ CM6 표준 userEvent. `update.transactions.some(tr => tr.isUserEvent('select.pointer'))` 형태도 올바르다.
- **D3의 `hasFocus`** — ✅ `EditorView.hasFocus` 게터 존재. 다만 부작용은 §3 참조.
- **R4 (mathId ↔ `.katex` 매핑 어긋남)** — ✅ 기존 과제로 분리한 판단 옳음. 확인 결과 `EditorPreview.tsx:373`이 `el.querySelectorAll('.katex')`로 **블록별 0부터** 부여하고, `scrollPreviewToMathCenter`도 `[data-block-id]` 하위에서 찾으므로 **번호 체계는 일관**한다. 본 Phase에서 악화 요인 없음.

---

## 3. 결정 사항 정정표 (v1 D1~D10 → v2)

| # | v1 | **v2 판정 및 정정** |
|---|---|---|
| **D0** | — | ✅ **실행 완료**(§1-0). 범인 = `left-column` 단일. 원인 = 편집 패널의 `paddingBottom:'100vh'` |
| D1 | 3개 요소 `hidden`→`clip` | ❌ **폐기**. 증상 대증요법이고, 범인 아닌 요소까지 건드려 렌더링 회귀 리스크만 진다. D0가 원인을 특정했으므로 불필요 |
| **D1'** | — | ❌ **폐기**(scroll 가드 대안). 같은 이유 |
| D2 | content-frame scroll 가드 | ❌ **폐기**. content-frame은 4개 시나리오 전부 `vOver 0`·`scrollTop 0` — 범인이 아니다 |
| **D1″** | — | ➕ **신규·버그1 확정 처방**. 스크롤 패널의 `paddingBottom:'100vh'`를 **내부 콘텐츠 div로 이관**해 세로 overflow를 0으로 만든다. 실측 검증 완료(§1-0). **2곳 모두 고칠 것**:<br>· **EV:2886** 편집 패널 → `paddingBottom` 제거, EV:2887 `maxWidth:'35em'` div에 `paddingBottom:'100vh'` 부여<br>· **EV:2951** 미리보기 패널 → `padding:'20px 32px 100vh 32px'` → `'20px 32px 20px 32px'`, EV:2952 내부 div에 `paddingBottom:'100vh'` 부여(미리보기는 조건부 스타일이므로 래퍼 신설 필요할 수 있음)<br>회귀 방지 주석: `/* paddingBottom을 패널 자신에 두면 border-box 최소높이가 100vh로 고정돼 overflow:hidden 부모에 스크롤 틈이 생기고, CM scrollRectIntoView가 이를 밀어 복구 불가가 된다 (Phase 56) */` |
| D3 | `hasFocus()` 가드 | ⚠️ **부작용 명시 필요**. 이 가드는 `clearSelection`뿐 아니라 **모든 프로그램적 dispatch**를 막는다 → `replaceRange`(찾기/바꾸기), 스니펫 삽입, 교정 자동수정, `setContent`(블록 분할) 경로에서 `activeMathId`·`cursorInMath`가 **stale**해진다. → **D3'** 참조 |
| **D3'** | — | ➕ 가드를 `hasFocus()` 단독이 아니라 **`hasFocus() \|\| info.docChanged`** 로 완화. 문서를 바꾼 프로그램적 변경은 통과시키고, **선택만 바꾸는** dispatch(=`clearSelection`, 버그2-2의 정확한 원인)만 차단한다. 원인에 정확히 대응하는 최소 가드 |
| D4 | 명시적 `setActiveMathId` | ✅ 타당. 이중 안전장치로 유지 |
| D5 | 수식 중앙 정렬 헬퍼 2종 | ⚠️ **편집창 쪽 클램프 제거는 불가** → §1-3 **D5'**(`computeMathCenterScrollTop`)로 대체. 미리보기 쪽(`scrollPreviewToMathCenter`)은 v1 코드 그대로 타당 |
| D6 | 비수식 클릭 기존 동작 유지 | ✅ |
| D7 | `pointerSelect` 구분 | ✅ |
| D8 | typewriter | ⚠️ **긴 블록에서 무효 + 매 키입력 재발화** → §1-4 **D8'**(히스테리시스 + IME 가드 + 260ms)로 대체 |
| D9 | 단일 지점 주석 | 🔁 **의미 변경**. D5'/D8'이 별도 함수가 되므로 EV:225 주석을 "**일반 자동 스크롤**은 반드시 이 함수" + "예외 2종은 `computeMathCenterScrollTop`·typewriter, 각각 사유 명기"로 개정 |
| D10 | 저장 경로 불가침 | ✅ 유지 |
| **D11** | — | ➕ **신규**. `handleCursorActivity`의 `setActiveMathId`를 **`info.blockId === activeBlockId`일 때만** 수행. 현재는 mousedown 시점(activeBlockId가 아직 이전 블록 A)에 B의 mathId가 설정되어 **EV:3013의 `isActivePreview ? activeMathId : undefined`** 때문에 **A의 미리보기에서 엉뚱한 수식이 순간 하이라이트**된다. cross-block은 D4가 `handleBlockFocus`에서 책임지므로 역할 분리가 깔끔해진다 |
| **D12** | — | ➕ **타입 불일치 해소**. ME:32 `{line, offset, docChanged}` / EV:747 `{line, offset, blockId}` / EV:910-911 래퍼가 `{...info, blockId}` 스프레드 / EV:1956 핸들러는 4개 전부 기대 — **런타임은 맞고 타입만 3중으로 어긋나 있다.** `tsconfig.json:11 "strict": false`라 `strictFunctionTypes`가 꺼져 있어 **빌드가 조용히 통과**한다. `{line, offset, docChanged, pointerSelect, blockId}` 단일 타입을 export해 3곳에서 공유할 것 |

---

## 4. 구현 순서 (정정)

1. ~~D0 계측~~ → ✅ 완료(§1-0).
2. **D1″** → 버그1. **2~5줄짜리 CSS 변경이고 실측 검증까지 끝났으므로 가장 먼저**. 독립 커밋.
3. **D12 타입 통일** + `MarkdownEditorHandle`에 `hasFocus()`·`isComposing()` 추가, `updateListener`에 `pointerSelect` 계산 추가.
4. **D3' + D4 + D11** → 버그2-2 해소. 렌더링 리스크 0. 독립 커밋.
5. **D5' + 미리보기 헬퍼 + D6/D7** → 버그2-1(정책 통일). 독립 커밋.
6. **D8'** → typewriter. 독립 커밋.

> v1은 6개 관심사를 한 덩어리로 제시했고 버그1을 "회귀 위험이 크니 마지막"으로 두려 했으나, **D0가 원인을 특정한 지금 버그1은 오히려 가장 작고 가장 안전한 수정**이 되었다. 먼저 넣어 고질 버그를 즉시 걷어내고, 이후 작업을 깨끗한 바닥 위에서 진행하는 편이 낫다. 나머지 3~6은 서로 독립적이므로 커밋을 분리해 되돌릴 단위를 확보한다.

---

## 5. 리스크 재평가

| # | v1 | v2 |
|---|---|---|
| R1 | `clip` 브라우저 지원 확인 | ✅ **소멸** — D1 폐기로 `clip`을 쓰지 않는다 |
| R2 | flex 회귀 | ✅ **소멸** — 같은 이유 |
| R3 | mousedown 시 focus 선행 여부 | **완화** — D3'는 `docChanged`도 통과시키므로 실패 모드가 좁아짐. 그래도 T3에서 확인 |
| R4 | mathId ↔ `.katex` 매핑 | 유지 (기존 과제, 본 Phase 악화 없음) |
| R5 | IME + typewriter | 🔴 **격상**. `dad2588`이 조합 중 데코레이션 변동이 조합을 깨뜨림을 이미 실증 → **가정이 아니라 기지의 사실**. D8'의 `isComposing()` 가드는 필수 |
| R6 | `clearSelection` 루프 존치 | 존치 권장 유지 |
| R7 | 최상단 수식 중앙 정렬 불가 | 유지 (한계로 문서화) |
| **R8** | — | ➕ **성능**. `handleCursorActivity`는 매 키입력마다 `buildMathIndex`(문서 전체 O(n) 스캔, EV:135-190)를 돌리고, D8'는 여기에 `coordsAtPos`(강제 레이아웃 읽기)를 더한다. **`docs/prelaunch-bug-cleanup.md` 4번(키입력마다 전체 리렌더)과 같은 뿌리** → 최소한 `maybeRecenterOnBottomTyping`은 rAF 스로틀 적용. `buildMathIndex` 메모이제이션은 별건으로 분리 |
| **R9** | — | ➕ `EditorPreview.tsx:369-376`의 `data-math-id` 부여는 렌더 후 effect다. `scrollPreviewToMathCenter`의 `setTimeout(50)+rAF`가 이 effect보다 늦다는 보장이 없다 → **미발견 시 블록 중앙 폴백**이 v1에 이미 있으나, 폴백이 상시 발동하면 기능이 조용히 죽는다. **폴백 시 `console.warn` 1회**를 넣어 개발 중 감지 가능하게 할 것 |

---

## 6. 검증 체크리스트 (추가분)

v1 T1~T11 유지 + 다음 추가:

| # | 항목 |
|---|---|
| **T12** | **D0 계측 재실행**: 버그1 재현 후 조상 체인 `console.table`에 `scrollTop !== 0 && overflowY:hidden`인 행이 **0건** |
| **T12-a** | **D1″ 직전 기준선**: 수정 전 실제 앱에서 `left-column`의 `scrollHeight - clientHeight` 값을 기록 (§1-0 공식 검증 — 하니스 53px보다 커야 함) |
| **T12-b** | **D1″ 후**: 편집 패널·미리보기 패널 **양쪽** 부모의 `vOver`가 0이고, 문서 끝에서 "한 화면 더" 스크롤되는 여백이 그대로 유지 |
| **T13** | **긴 블록 typewriter**: 패널 높이의 3배 이상 되는 블록 중간에서 연속 타이핑 → 커서가 하단 60px에 눌어붙지 않고, 착지 후 **최소 10줄 이상** 추가 입력까지 재발화 없음 |
| **T14** | **IME 조합 중 typewriter**: 하단 임계에서 한글 조합 중 스크롤 발화 → **끝글자 중복 없음**(`dad2588` 회귀 확인) |
| **T15** | **D3' 부작용**: 찾기/바꾸기 치환·스니펫 삽입·교정 자동수정 직후 수식 툴바의 "수식 안/밖" 상태(`cursorInMath`)가 정상 갱신 |
| **T16** | **D11 순간 오하이라이트**: 블록 A 활성 상태에서 블록 B의 수식 클릭 → A의 미리보기에 **한 프레임도** 엉뚱한 하이라이트가 보이지 않음 (화면 녹화 후 프레임 확인) |
| **T17** | **미리보기 폴백 감지**: 개발 콘솔에 `scrollPreviewToMathCenter` 폴백 경고가 **반복 출력되지 않음** |
| **T18** | **좁은 창 가로 스크롤**: 창을 최소폭(편집창 `minWidth:420` + 미리보기 `35em+64px`) 이하로 줄여 content-frame 가로 스크롤 발생 → 가로 스크롤 정상 + `scrollTop` 0 유지 |

---

## 7. 문서 갱신 (정정)

v1의 1~5에 더해:

6. **`CLAUDE.md` 주의사항 정정** — "CodeMirror autoHeight 모드: `EditorView.scrollIntoView` 사용 금지"는 편집창 CM에 `autoHeight`가 전달되지 않는 현 구조와 어긋난다. "편집창 CM은 `.cm-scroller: overflow:visible` + 외곽 `.scaled-editor`가 스크롤 담당 → CM 내부 `scrollIntoView` 사용 금지, 세로 스크롤은 `computeBlockAwareScrollTop` 경유"로 문구 교체.
7. **`docs/prelaunch-bug-cleanup.md`에 R8 교차 참조** 추가 (4번 항목과 동일 뿌리).
8. `EditorView.tsx:225` 주석을 D9 정정안대로 개정 (예외 2종 명기).
9. **`CLAUDE.md`에 `paddingBottom:100vh` 금지 규칙 1줄 추가** — 부록 A 문안 그대로.
10. **roadmap Phase 56 절의 "교훈"을 D0 결과로 교체** — v1이 적으려던 "CM scrollRectIntoView는 overflow:hidden 조상도 스크롤한다"는 절반만 맞다. 실제 교훈은 **"스크롤 패널 자신에 `paddingBottom:100vh`를 주면 border-box 최소높이가 고정되어 `overflow:hidden` 부모에 복구 불가한 스크롤 틈이 생긴다"**이다.
11. **본 v2 문서를 `docs/phasedocs/`로 이관** (구현 완료 후). ✅ v1은 `docs/phasedocs/` → `docs/phaseSketch/`로 이동 완료(2026-08-10) — 확정 전 계획서이므로 sketch가 맞다. 파일명도 v2와 동일 규칙으로 정규화.

---

## 8. 요약

| 구분 | 건수 | 내용 |
|---|---|---|
| ✅ 정확 | 5 | §2-2 인과 사슬, §2-3 정책표, D2 CSS 계산 규칙, D7 userEvent, R4 분리 판단 |
| 🔴 치명 | 4 | §2-1 오진(§1-0·§1-1), 계측 게이트 부재(§1-2), D5 불변식 위반(§1-3), D8 긴 블록 무효+재발화(§1-4) |
| ❌ 폐기 | 3 | D1(`clip` 전환), D1'(scroll 가드 대안), D2(content-frame 가드) — 범인이 아니거나 대증요법 |
| ⚠️ 정정 | 3 | D3 → D3'(부작용 완화), D5 → D5'(클램프 유지), D8 → D8'(히스테리시스) |
| ➕ 신규 | 6 | **D1″ 패딩 이관(버그1 확정 처방)**, D3' 완화 가드, D11 순간 오하이라이트, D12 타입 통일, R8·R9 |
| 📏 기준선 | 1 | 커밋 3건 진행에 따른 줄번호 시프트(EV +1, ME +14) — §0-2 전수 정정표 |
| 🔬 실측 | 1 | **D0 계측 실행 완료** — 범인 `left-column` 확정, 원인 `paddingBottom:100vh` 확정, 수정안 검증 완료 |

**핵심 메시지**: 버그1의 원인은 **`paddingBottom:'100vh'` + `box-sizing:border-box`**였다. 스크롤 패널 자신에 100vh 패딩을 주면 border-box 규칙상 그 박스의 최소 높이가 100vh로 고정되어, `overflow:hidden`인 부모에 상시 스크롤 틈이 생기고 CodeMirror가 매 키입력마다 그 틈을 밀어붙인다. **패딩을 내부 콘텐츠 div로 한 칸 내리는 것만으로 완치**되며 실측 검증까지 마쳤다. CodeMirror의 overflow 처리도, 가로 스크롤바도, `clip` 전환도 이 버그와 무관하다.

버그2-1·2-2는 v1 진단이 정확하므로 그대로 구현해도 좋다. 다만 D5·D8은 현재안 그대로 구현하면 **2026-07-16에 이미 해결한 버그를 되살리거나(D5), 기능이 정작 필요한 긴 블록에서 작동하지 않는다(D8).**

---

## 부록 A. 이 교훈을 어디에 남길 것인가

`CLAUDE.md`의 "핵심 패턴 & 주의사항"에 다음 1줄을 추가할 것 (§7-4 대체):

> **스크롤 패널의 `paddingBottom: 100vh` 금지**: `box-sizing:border-box`에서 요소 높이는 패딩 합보다 작아질 수 없어 패널이 부모보다 커지고, `overflow:hidden` 부모에 복구 불가한 스크롤 틈이 생긴다(CM `scrollRectIntoView`가 밀어붙임). "문서 끝 여백"은 반드시 **내부 콘텐츠 div**에 줄 것. (Phase 56)

이 패턴은 편집창·미리보기 외에도 향후 추가될 모든 스크롤 패널(토론 패널, 버전 드로어 등)에 동일하게 적용된다.
