# Phase 56 — 편집창·미리보기 수식 세로 중앙 정렬 통일 + 상단 밀림 근본 대책 **v4 (구현 기준 최종본)**

작성일: 2026-08-10 · 작성: CLI Claude (Opus 5) — v3 검토 후 확정 · 기준 커밋: **`bd5ae25`**

> **이 문서 하나만 보고 구현한다.** v1(web 초안) → v2(CLI 검토·D0 실측) → v3(web 재검토) → **v4(확정)**. §3 결정표와 §4 구현 코드가 유일한 구현 근거이며, v1~v3의 상충하는 서술은 모두 무효다.
>
> **v4에서 바뀐 것** — v3의 판정은 **E1·E2·D13·D14·D2‴·D5‴ 전부 수용**한다. 그 위에:
> - 🔴 **C1 (치명)**: v3의 D1‴ **미리보기 쪽 구현 코드가 CSS shorthand 순서 때문에 무효화**된다 → 적용해도 미리보기의 65px 잠복 버그가 그대로 남고 "문서 끝 여백"까지 잃는다. **스페이서 div 방식**으로 교체(§2-1).
> - ➕ **D15 (신규)**: `FindReplacePanel`이 **4번째 독립 스크롤 정책**을 갖고 있으며 EV:225 불변식 밖에 있고, **네이티브 smooth 스크롤이라 D14의 취소 범위 밖**이다(§2-4).
> - ➕ **D16 (신규)**: D11 채택 시 **탭 전환·상단바 클릭 경로에서 `activeMathId`가 stale**해진다(§2-5).
> - 🔧 **D2‴ 구현 간소화**: ref 3개 신설 대신 `data-noscroll` 속성 + 단일 effect(§2-3).

---

## 1. v3 판정 수용 (재검증 완료)

| v3 주장 | v4 재검증 | 판정 |
|---|---|---|
| **E1** — `scrollToPos`는 호출부 0곳인 죽은 코드. v2 §1-1(e)의 "찾기/바꾸기가 이를 디스패치한다"는 오류 | `grep -rn scrollToPos components app` → **ME:55(인터페이스), ME:391(구현) 단 2건, 호출부 0**. 실제 찾기/바꾸기는 `FindReplacePanel.tsx:149-162`에서 `.scaled-editor`를 **수동** 스크롤 | ✅ **v3 정확, v2 오류 인정** |
| **E2** — D8' 스니펫에 `hasFocus()` 가드 누락. D3'가 `docChanged`를 통과시키므로 비포커스 블록의 프로그램적 변경이 typewriter를 오발화 | 인과 성립 확인. `handleAutoFixProofreadIssue`·`handleSplitBlock`(`setContent`)이 비포커스 블록에 `docChanged`를 발생시킨다 | ✅ **수용** |
| **D13** — `scrollToPos` 제거 | 죽은 코드 + `EditorView.scrollIntoView` 사용은 ME:688-689 주석("내부 자체 스크롤 없음")과 정면 모순 | ✅ **수용** |
| **D14** — `fastScrollTo` 경합 취소 (세대 카운터) | EV:200-214에 취소 장치 없음 확인. 세대 카운터 설계 타당 — 단 **적용 범위에 구멍**(§2-4) | ✅ **수용 + 보완** |
| **D2‴** — 칼럼 스크롤 트립와이어 | 논거 수용. "원인 제거 ≠ 불변식 강제"라는 지적이 옳고, 정상 상태에서 이벤트가 0건이므로 비용도 0 | ✅ **수용 + 구현 간소화** |
| **D5‴** — 클램프 정책 미리보기 대칭화 | v2 D5'가 편집창 한쪽만 다뤄 "제각각" 감각이 그 지점에서 재현된다는 지적이 맞다 | ✅ **수용** |
| §2-3 — D3' 채택 시 찾기/바꾸기 내비게이션 중 미리보기 수식 하이라이트가 따라오지 않음 | 인과 성립. 단 **D15로 해소 가능**(§2-4) → Q1 답변 갱신 | ✅ 수용, 처방 변경 |
| §1 — 전역 `* { box-sizing: border-box }`, EV:2886/2951 패딩, 좌측 칼럼 hidden | `app/globals.css:101` 확인. EV:2886·2951 확인 | ✅ |

**v2 자기 정정**: §1-1(e)의 "`scrollToPos`가 찾기/바꾸기 경로"는 근거 없는 추정이었다. 버그1의 재현 트리거는 **타이핑 단일 경로**가 맞다(D0 하니스도 타이핑으로만 재현했다).

---

## 2. v4 정정·보강

### 2-1. 🔴 C1 — v3의 D1‴ 미리보기 구현 코드는 **적용해도 동작하지 않는다**

v3 §4 D1‴은 미리보기 내부 div(EV:2952)에 대해 이렇게 지시한다:

```tsx
{ paddingBottom:'100vh', ...(activeTab==='question' ? {...} : {}) }   // ← v3 원안
```

EV:2952-2954의 실제 조건부 스타일은 다음과 같다:

```tsx
<div style={activeTab === 'question' ? {
  background: 'var(--bg-content)', padding: '20px 24px', borderRadius: 8,
} : undefined}>
```

여기엔 **`padding` shorthand가 들어 있다.** JS 객체에서 나중에 오는 키가 이긴다 → 스프레드가 뒤에 있으므로 `padding:'20px 24px'`가 **앞서 지정한 `paddingBottom:'100vh'`를 20px로 되돌린다.** 결과:

- 문제 탭(`activeTab === 'question'`)에서 **미리보기의 "문서 끝 여백"이 통째로 사라진다** (100vh → 20px). 기능 회귀.
- 미리보기 패널의 65px 잠복 overflow는 제거되지만, 정작 의도한 여백 이관은 실패한다.
- 다른 탭에서는 스프레드가 `{}`라 우연히 동작한다 → **탭에 따라 갈리는 조용한 버그**라 발견이 늦다.

또한 v3는 "래퍼 불필요"라 했으나, 설령 순서를 고쳐도(`{...(cond?{...}:{}) , paddingBottom:'100vh'}`) **100vh 패딩이 `background`·`borderRadius`를 가진 박스 안에 들어간다.** 현재는 `--bg-content`(#F4EFE7)가 패널 배경과 동일 토큰이라 눈에 띄지 않지만, 이 박스의 배경을 조금이라도 바꾸는 순간 **한 화면 높이의 색 블록**이 드러난다. 구조적으로 취약하다.

#### 정정 — **스페이서 div** 방식 (편집창·미리보기 공통)

패딩을 어느 박스에도 넣지 않고, 스크롤 콘텐츠 끝에 높이만 있는 형제를 둔다. `scrollHeight` 기여는 패딩과 **완전히 동일**하고(D0 하니스에서 검증된 것과 같은 효과), 어떤 스타일 박스도 부풀리지 않으며, shorthand 충돌이 원천적으로 불가능하다.

```tsx
/* 문서 끝 여백 — 패널 자신에 paddingBottom을 주면 border-box 최소높이가
   100vh로 고정돼 overflow:hidden 부모에 복구 불가한 스크롤 틈이 생긴다 (Phase 56) */
<div aria-hidden style={{ height: '100vh', flexShrink: 0 }} />
```

편집창도 `maxWidth:'35em'` div에 `paddingBottom`을 붙이는 대신 같은 스페이서를 쓴다 — **두 곳이 같은 형태여야 다음 사람이 한쪽만 고치는 사고가 안 난다.**

### 2-2. E2 수용 — D8‴ 가드는 3중

`hasFocus()`(사용자 타이핑 한정) + `isComposing()`(IME 보호) + 발화 임계. 셋 다 필요하다.

### 2-3. D2‴ 구현 간소화 — ref 3개 대신 `data-noscroll`

v3 원안대로면 좌측 칼럼·미리보기 칼럼에 각각 새 ref를 만들고(현재 둘 다 ref 없음) content-frame에도 ref를 신설해 effect 3개를 붙여야 한다. 세 요소에 **`data-noscroll` 속성 하나씩만 추가**하고 단일 effect로 일괄 배선하면 ref 신설이 사라진다. 트립와이어라는 성격상 이쪽이 맞다.

> 대상은 **좌측 칼럼·미리보기 칼럼·content-frame 3개로 한정**한다. 블록 래퍼(EV:773)·CM 래퍼(ME:841)도 `overflow:hidden`이지만 블록 수만큼 늘어나는 동적 요소라 트립와이어 비용이 커진다. D0에서 둘 다 `vOver 0`으로 나왔으므로 감시 대상에서 제외한다.

### 2-4. ➕ D15 — `FindReplacePanel`이 **4번째 스크롤 정책**이며 D14 밖에 있다

`FindReplacePanel.tsx:149-162`:

```tsx
const scroller = document.querySelector('.scaled-editor') as HTMLElement | null;
...
const center = cursorRelTop - scrollRect.height / 2;
scroller.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
```

세 가지 문제가 겹쳐 있다:

1. **EV:225 불변식 밖.** "편집창 자동 스크롤은 반드시 `computeBlockAwareScrollTop`을 거칠 것"인데 이 경로는 생짜 중앙 정렬이다. `Math.max(0, center)`가 있어 첫 블록 케이스는 막히지만, **블록 상단 가시성 보장은 전혀 없다.** v1·v2·v3 누구도 이 경로를 세지 않았다 — 결과적으로 v3 D9의 "예외 2종" 주석은 **실제로는 3종**을 대상으로 해야 한다.
2. **D14가 취소하지 못한다.** `behavior:'smooth'`는 브라우저 네이티브 애니메이션이라 `fastScrollTo`의 세대 카운터로는 중단되지 않는다. 검색 이동 직후 수식을 클릭하면 두 애니메이션이 같은 컨테이너를 두고 경합한다. (`fastScrollTo`가 매 프레임 `scrollTop`을 쓰면 Chrome에서는 네이티브 애니메이션이 사실상 무력화되지만, 이는 **명세가 보장하지 않는 브라우저 구현 의존**이다.)
3. **`document.querySelector('.scaled-editor')`** — 전역 조회다. 현재 인스턴스가 하나뿐이라 동작하지만, 편집창이 둘 이상 렌더되는 순간(비교 뷰·분할 편집 등) 조용히 엉뚱한 패널을 스크롤한다.

**D15**: 이 블록을 `computeBlockAwareScrollTop` + `fastScrollTo`로 교체한다. 그러면 편집창 스크롤 경로가 **3종(일반/수식 클릭/typewriter)으로 정리**되고 전부 `fastScrollTo`를 거쳐 D14의 취소 대상에 들어온다. `scroller`는 `editorPanelRef`를 prop으로 받아 전역 조회도 제거한다.

**부수 효과 — Q1이 해소된다.** v3 §2-3은 "D3' 이후 찾기/바꾸기 중 미리보기 수식 하이라이트가 안 따라오는 것을 감수하자"고 했는데, D15에서 `navigateToMatch`가 이미 `match.blockId`와 커서 위치를 알고 있으므로 **`onNavigate(blockId, offset)` 콜백 하나를 추가해 `EditorView`가 `setActiveBlockId` + `setActiveMathId`를 직접 수행**하면 된다. 감수할 필요가 없다.

### 2-5. ➕ D16 — D11 채택 시 `activeMathId`가 stale해지는 경로 2개

D11은 `setActiveMathId`를 `info.blockId === activeBlockId`일 때로 제한하고, cross-block은 D4(`handleBlockFocus`)가 책임진다. 그런데 **`activeBlockId`를 바꾸면서 `handleBlockFocus`를 거치지 않는 경로**가 두 개 있다:

| 경로 | 위치 | 결과 |
|---|---|---|
| 탭 전환 | EV:2057-2064 — `setActiveBlockId(blocks[0].id)` | 이전 탭의 mathId가 남아 새 블록의 **엉뚱한 수식**이 하이라이트됨 |
| 상단바 클릭 | EV:1837-1844 `handleSelectBlockBar` | 동일 |

EV:3013의 `activeMathId={isActivePreview ? activeMathId : undefined}` 때문에 새 활성 블록의 미리보기가 그 stale 번호를 그대로 칠한다.

**D16**: 두 경로에 `setActiveMathId(-1)`을 추가한다. `[activeBlockId]` effect에서 일괄 처리하면 안 된다 — `handleBlockFocus`가 같은 배치에서 설정한 값을 effect가 뒤늦게 지워버린다.

---

## 3. 최종 결정표 (구현 기준 — 이 표가 유일한 근거)

| # | 결정 | 내용 | 출처 |
|---|---|---|---|
| **D1‴** | 버그1 확정 처방 | 편집 패널(EV:2886) `paddingBottom:'100vh'` **제거**, 미리보기 패널(EV:2951) `padding:'20px 32px 100vh 32px'` → `'20px 32px 20px 32px'`. **양쪽 스크롤 콘텐츠 끝에 `height:'100vh'` 스페이서 div 삽입**(§2-1 — v3 원안의 shorthand 순서 버그 회피). 회귀 방지 주석 필수 | v2 실측 + **v4 C1 정정** |
| **D2‴** | 재발 방지 트립와이어 | 좌측 칼럼·미리보기 칼럼·content-frame에 `data-noscroll` 속성 → 단일 effect가 scroll 리스너 배선, `scrollTop→0` 복원 + dev `console.warn` | v3 + **v4 간소화** |
| **D3'** | cursorActivity 게이트 | `if (!ref.hasFocus() && !info.docChanged) return;` — 선택만 바꾸는 비포커스 dispatch(=`clearSelection`, 버그2-2 원인)만 차단 | v2 |
| **D4** | activeMathId 명시 설정 | `handleBlockFocus`·`handlePreviewMathClick`에서 직접 `setActiveMathId`. 후자는 `ref.focus()`를 `setSelection`보다 앞으로 | v1 |
| **D5‴** | 수식 중앙 정렬 (대칭 클램프) | `computeMathCenterScrollTop` 신설(편집창) + **동일 규칙을 미리보기에 미러링**. 세 클릭 경로 모두 사용. `computeBlockAwareScrollTop`은 존치 | v2+v3 |
| **D6** | 비수식 클릭 기존 동작 | 같은 블록: 무동작 / 다른 블록: `scrollEditorToCursorCenter`+`scrollPreviewToBlockCenter` | v1 |
| **D7** | 클릭/키보드 구분 | `pointerSelect = update.transactions.some(tr => tr.isUserEvent('select.pointer'))` | v1 |
| **D8‴** | typewriter | 발화 하단 80px / 착지 45% / 260ms / **`hasFocus()` + `isComposing()` 이중 가드** / rAF 내 실행 | v2+v3(E2) |
| **D9** | 불변식 주석 개정 | EV:225: 일반 자동 스크롤은 `computeBlockAwareScrollTop`, **예외 3종**(수식 클릭 `computeMathCenterScrollTop` / typewriter / **찾기·바꾸기 — D15로 통합되어 예외 아님**) 명기 → 최종적으로 **예외 2종** | v2 + **v4(D15로 축소)** |
| **D10** | 저장 경로 불가침 | raw_text 저장 체인·Firestore 변경 없음 | v1 |
| **D11** | 순간 오하이라이트 방지 | `setActiveMathId`는 `info.blockId === activeBlockId`일 때만 | v2 |
| **D12** | 타입 통일 | `{line, offset, docChanged, pointerSelect, blockId}` 단일 타입 export → ME:32 / EV:747 / EV:910-911 공유. `MarkdownEditorHandle`에 `hasFocus()`·`isComposing()` 추가 | v2 |
| **D13** | `scrollToPos` 제거 | ME:55, ME:391-397 삭제 (호출부 0) | v3 |
| **D14** | `fastScrollTo` 경합 취소 | 컨테이너별 세대 카운터(WeakMap)로 이전 rAF 루프 무효화 | v3 |
| **D15** | **찾기/바꾸기 스크롤 통합** | `FindReplacePanel.tsx:149-162`를 `computeBlockAwareScrollTop`+`fastScrollTo`로 교체, `editorPanelRef`를 prop으로 받아 전역 `querySelector` 제거, `onNavigate(blockId, offset)` 콜백으로 활성 블록·mathId 동기화(Q1 해소) | **v4 신규** |
| **D16** | activeMathId stale 정리 | 탭 전환 effect(EV:2057-2064)와 `handleSelectBlockBar`(EV:1837-1844)에 `setActiveMathId(-1)` 추가 | **v4 신규** |

**폐기 확정**: v1 D1(`clip` 전환) · D1'(대안 가드로서) · D2(content-frame 원인 취급). D1'의 *기법*은 D2‴로 성격을 바꿔(원인 처방 → 불변식 감시) 부활.

---

## 4. 구현 코드

### 4-1. D1‴ — 버그1 처방

**편집창** — EV:2886 및 EV:2887 블록 끝:
```tsx
// 변경 전: style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', paddingBottom: '100vh', minHeight: 0 }}
// 변경 후:
<div ref={editorPanelRef} className="scaled-editor no-scrollbar"
     style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', minHeight: 0 }}>
  <div style={{ maxWidth: '35em', margin: '0 auto' }}>
    {/* …기존 DndContext… */}
  </div>
  {/* 문서 끝 여백 — 패널 자신에 paddingBottom을 주면 border-box 최소높이가 100vh로
      고정돼 overflow:hidden 부모(좌측 칼럼)에 복구 불가한 스크롤 틈이 생기고,
      CodeMirror scrollRectIntoView가 매 키입력마다 이를 밀어붙인다 (Phase 56) */}
  <div aria-hidden style={{ height: '100vh', flexShrink: 0 }} />
</div>
```

**미리보기** — EV:2951, 그리고 EV:3031(`</div>`, 내부 div 닫음)과 EV:3032 사이:
```tsx
// 변경 전: padding: '20px 32px 100vh 32px'
// 변경 후: padding: '20px 32px 20px 32px'
      {/* …blocks.map() 을 감싸는 조건부 스타일 div… */}
      </div>
      {/* 문서 끝 여백 — 위 주석과 동일 사유 (Phase 56) */}
      <div aria-hidden style={{ height: '100vh', flexShrink: 0 }} />
    </div>
```
⚠️ **조건부 스타일 div(EV:2952) 안에 `paddingBottom`을 넣지 말 것** — `padding` shorthand가 덮어써 무효가 된다(§2-1).

### 4-2. D2‴ — 트립와이어

세 요소에 속성 추가: `data-noscroll="left-column"` (EV:2874) / `data-noscroll="preview-column"` (EV:2946) / `data-noscroll="content-frame"` (EV:2864).

```tsx
/* 불변식 감시: 이 컨테이너들은 세로로 스크롤되면 안 된다.
   사용자가 되돌릴 수 없으므로(overflow:hidden) 즉시 복원하고 개발 중엔 경고한다.
   경고가 뜨면 어떤 요소가 세로 overflow를 만든 것 → 그 원인을 제거할 것 (Phase 56) */
useEffect(() => {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-noscroll]'));
  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop === 0) return;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Phase56] noscroll 컨테이너가 세로 스크롤됨:', el.dataset.noscroll,
        { scrollTop: el.scrollTop, vOver: el.scrollHeight - el.clientHeight });
    }
    el.scrollTop = 0;
  };
  els.forEach((el) => el.addEventListener('scroll', onScroll));
  return () => els.forEach((el) => el.removeEventListener('scroll', onScroll));
}, []);
```

### 4-3. D14 — `fastScrollTo` 경합 취소 (EV:200-214 교체)

```tsx
const scrollGen = new WeakMap<HTMLElement, number>();

function fastScrollTo(container: HTMLElement, top: number, duration = 220) {
  // 새 호출은 같은 컨테이너의 이전 애니메이션을 무효화한다 (지터 방지)
  const gen = (scrollGen.get(container) ?? 0) + 1;
  scrollGen.set(container, gen);

  const start = container.scrollTop;
  const delta = Math.max(0, top) - start;
  if (Math.abs(delta) < 1) return;          // 이전 루프는 위에서 이미 무효화됨
  const startTime = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    if (scrollGen.get(container) !== gen) return;   // 새 호출이 왔으면 중단
    const t = Math.min(1, (now - startTime) / duration);
    container.scrollTop = start + delta * ease(t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

### 4-4. D5‴ — 대칭 클램프

```tsx
/** 수식 클릭 전용: 중앙 정렬을 우선하되, 대상이 뷰포트에 들어오면 상단 가시성을 지킨다.
 *  일반 자동 스크롤은 computeBlockAwareScrollTop을 쓸 것 (EV:225 불변식). */
function computeMathCenterScrollTop(
  containerRect: DOMRect, containerScrollTop: number,
  blockRect: DOMRect, targetViewportTop: number,
): number {
  const blockTop = blockRect.top - containerRect.top + containerScrollTop;
  const targetRel = targetViewportTop - containerRect.top + containerScrollTop;
  const center = targetRel - containerRect.height / 2;
  // 블록이 패널 안에 들어오면 상단 가시성 우선, 넘치면 중앙 정렬 우선
  return blockRect.height <= containerRect.height ? Math.min(center, blockTop - 8) : center;
}
```
편집창은 `blockEl` + 커서 좌표로, 미리보기는 `[data-block-id]` + `.katex[data-math-id]`의 세로 중심으로 **같은 함수**를 호출한다. 미리보기에서 수식 요소를 못 찾으면 블록 중앙으로 폴백하되 **`console.warn` 1회**를 남긴다(v2 R9 — 폴백이 상시 발동하면 기능이 조용히 죽는다).

### 4-5. D8‴ — typewriter

```tsx
const TYPING_TRIGGER_MARGIN = 80;   // 하단 80px 안으로 들어오면 발화
const TYPING_LANDING_RATIO  = 0.45; // 패널 높이의 45% 지점에 착지 (≠ 발화선 → 재발화 방지)

const maybeRecenterOnBottomTyping = useCallback((blockId: string) => {
  requestAnimationFrame(() => {                    // D14 연계: CM 자체 스크롤 이후에 측정
    const ref = editorRefs.current[blockId];
    const container = editorPanelRef.current;
    if (!ref || !container) return;
    if (!ref.hasFocus()) return;                   // E2: 사용자 타이핑에만 적용
    if (ref.isComposing()) return;                 // dad2588: IME 조합 중 스크롤 금지
    const coords = ref.getCursorCoords();
    if (!coords) return;
    const rect = container.getBoundingClientRect();
    if (coords.top < rect.bottom - TYPING_TRIGGER_MARGIN) return;
    const cursorRel = coords.top - rect.top + container.scrollTop;
    fastScrollTo(container, cursorRel - rect.height * TYPING_LANDING_RATIO, 260);
  });
}, []);
```

### 4-6. `handleCursorActivity` 최종형

```tsx
const handleCursorActivity = useCallback((info: CursorActivityInfo) => {
  const ref = editorRefs.current[info.blockId];
  if (!ref) return;
  if (!ref.hasFocus() && !info.docChanged) return;              // D3'
  const content = ref.getContent();
  const mathId = findMathIdAtCursor(buildMathIndex(content), info.offset);
  if (info.blockId === activeBlockId) {                         // D11
    setActiveMathId(mathId);
    setCursorInMath(isInsideMath(content, info.offset));
    if (info.pointerSelect && mathId >= 0) {                    // D5‴·D7
      scrollEditorToMathCenter(info.blockId);
      scrollPreviewToMathCenter(info.blockId, mathId);
    }
  }
  if (info.docChanged) maybeRecenterOnBottomTyping(info.blockId);  // D8‴
}, [activeBlockId, /* 헬퍼들 */]);
```

### 4-7. D15 — 찾기/바꾸기 통합 (`FindReplacePanel.tsx:149-162`)

```tsx
// props에 editorPanelRef, onNavigate 추가
function navigateToMatch(match: Match, idx: number, allMatches: Match[]) {
  const handle = editorRefs.current[match.blockId];
  if (!handle) return;
  applyHighlights(allMatches, idx);
  try { handle.setSelection(match.from, match.to); } catch {}
  onNavigate?.(match.blockId, match.from);          // 활성 블록 + activeMathId 동기화 (Q1)

  requestAnimationFrame(() => {
    const coords = handle.getCursorCoords();
    const container = editorPanelRef.current;        // 전역 querySelector 제거
    if (!coords || !container) return;
    const blockEl = container.querySelector(
      `[data-editor-block-id="${match.blockId}"]`) as HTMLElement | null;
    if (!blockEl) return;
    // EV:225 불변식 준수 + D14 취소 대상에 편입
    fastScrollTo(container, computeBlockAwareScrollTop(container, blockEl, coords.top));
  });
}
```
`computeBlockAwareScrollTop`·`fastScrollTo`는 현재 `EditorView.tsx` 모듈 스코프 함수이므로 **`lib/editorScroll.ts`로 추출해 두 파일이 공유**한다(순환 import 방지).

---

## 5. 구현 순서 및 커밋 계획

| # | 커밋 | 내용 | 위험도 |
|---|---|---|---|
| 1 | `fix: 편집창 상단 밀림 근본 수정 (Phase 56 D1‴·D2‴)` | 패딩 → 스페이서 이관 2곳 + 트립와이어 | 낮음 (검증 완료) |
| 2 | `refactor: 스크롤 헬퍼 추출 + 에디터 핸들 확장 (D12·D13·D14)` | `lib/editorScroll.ts` 추출, 타입 통일, `hasFocus`/`isComposing` 추가, `pointerSelect` 계산, `scrollToPos` 제거, 세대 카운터 | 낮음 |
| 3 | `fix: 다른 블록 수식 클릭 시 미리보기 강조 누락 (D3'·D4·D11·D16)` | 버그2-2 | 중간 |
| 4 | `feat: 수식 클릭 세로 중앙 정렬 통일 (D5‴·D6·D7)` | 버그2-1 | 중간 |
| 5 | `refactor: 찾기/바꾸기 스크롤을 공용 경로로 통합 (D15)` | 불변식 준수 + Q1 해소 | 중간 |
| 6 | `feat: 편집창 타자 시 세로 위치 자동 조정 (D8‴)` | typewriter | 중간 |
| 7 | `docs: Phase 56 완료 기록` | §7 | — |

1번은 단독으로도 완결적이므로 **먼저 넣고 배포해 고질 버그를 즉시 걷어낸다.**

---

## 6. 검증 체크리스트

v1 T1~T11 · v2 T12~T18 · v3 T12-c/T13'/T15'/T19~T21 전부 유지. 추가·개정:

| # | 항목 |
|---|---|
| **T12-a** | (덕수, 수정 전 1분) 실앱 편집창에서 `$0.closest('[style*="minWidth"]')` 대신 좌측 칼럼을 잡아 `scrollHeight - clientHeight` 기록 → §1-0 공식대로 **8px + 상단 크롬 높이**여야 함 |
| **T12-d** *(신규)* | **C1 회귀 확인**: `activeTab === 'question'`(문제 탭)과 다른 탭 **양쪽 모두**에서 미리보기가 문서 끝 이후로 한 화면 더 스크롤됨 — v3 원안 버그가 이 탭 조건에서만 드러나므로 반드시 둘 다 확인 |
| **T15'** | v2 T15 + 찾기/바꾸기 내비게이션 중 **미리보기 수식 하이라이트가 따라옴**(D15의 `onNavigate`로 Q1이 해소되었으므로, v3가 감수하려던 퇴행이 없어야 정상) |
| **T22** *(신규)* | **D16**: 탭 전환·상단바 클릭으로 활성 블록을 바꾼 직후 미리보기에 **이전 탭/블록의 수식 하이라이트가 남지 않음** |
| **T23** *(신규)* | **D15 경합**: 찾기/바꾸기로 이동하는 도중 미리보기 수식을 클릭 → 두 스크롤이 싸우지 않고 마지막 목표로 수렴 (네이티브 smooth 제거 확인) |
| **T24** *(신규)* | **D13**: `grep -rn "scrollToPos" components app` 결과 0건 + `npm run build` 통과 |

---

## 7. 문서 갱신

v2 §7(6~11) · v3 §7(12~14) 전부 유지. 추가:

15. **`CLAUDE.md`에 스크롤 규칙 2줄** — ① `paddingBottom:100vh` 금지(v2 부록 A 문안), ② D2‴ 불변식(v3 §7-13 문안).
16. **roadmap Phase 56 절의 교훈에 C1 추가** — "조건부 `style` 객체에 longhand를 병합할 때 shorthand(`padding`)가 뒤에 오면 조용히 덮어쓴다. 스프레드 순서를 신뢰하지 말고 **스페이서 요소처럼 충돌 불가능한 구조**를 택할 것."
17. **v4를 `docs/phasedocs/`로 이관**(구현 완료 후). v1~v3는 `docs/phaseSketch/`에 이력으로 존치.

---

## 8. 미결 확인 사항 — 답변

| # | v3 질문 | **v4 답변** |
|---|---|---|
| **Q1** | 찾기/바꾸기 중 미리보기 수식 하이라이트 미동기화를 수용? | **수용하지 않는다.** D15의 `onNavigate(blockId, offset)` 콜백으로 해소된다. `navigateToMatch`가 이미 `match.blockId`와 오프셋을 갖고 있어 추가 비용이 사실상 없다 |
| **Q2** | D2‴ 트립와이어 채택? | **채택.** 단 ref 3개 신설 대신 `data-noscroll` 속성 + 단일 effect로 간소화(§2-3). 감시 대상은 3개 컨테이너로 한정 |
| **Q3** | T12-a(실앱 실측)를 수행? | **수행 권장 — 단 D1‴을 막지 않는다.** 하니스에서 이미 A/B 검증이 끝났으므로 실앱 실측은 §1-0 공식의 확증용이다. 덕수가 1분이면 되고, 결과가 예상과 다르면 그때 재검토하면 된다 |

---

## 9. 요약

| 구분 | 건수 | 내용 |
|---|---|---|
| ✅ v3 수용 | 7 | E1·E2·D13·D14·D2‴·D5‴·§2-3 인과 |
| 🔴 v4 치명 정정 | 1 | **C1** — D1‴ 미리보기 코드가 shorthand 순서로 무효화 → 스페이서 방식 |
| ➕ v4 신규 | 2 | **D15**(찾기/바꾸기 4번째 스크롤 정책·D14 사각지대·Q1 해소), **D16**(D11의 stale 경로 2개) |
| 🔧 v4 간소화 | 1 | D2‴ → `data-noscroll` 속성 방식 |
| 📋 최종 결정 | 16 | D1‴~D16 (§3) |
| 🗑 폐기 확정 | 3 | v1 D1(`clip`)·D1'(대안)·D2(원인 취급) |

**3자 교차 검증의 성과** — v1이 놓친 것을 v2가 실측으로 잡았고(원인 오진), v2가 놓친 것을 v3가 잡았으며(`scrollToPos` 오인·D8' 가드 누락), v3가 놓친 것을 v4가 잡았다(shorthand 순서 무효화·찾기/바꾸기 경로·stale mathId). **세 라운드 모두에서 새 결함이 나왔다는 사실 자체가, 이 규모의 변경에는 교차 검토가 필요하다는 근거다.**

**구현 착수 가능.** 1번 커밋(D1‴·D2‴)은 실측 검증이 끝났으므로 즉시 진행 가능하다.
