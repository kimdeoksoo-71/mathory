# Phase 68a 수식 영역 자동 영문 입력(한/영 전환 없는 수식 타이핑) 구현 계획서 v5 (CLI 착수판)

- 작성: CLI Claude · 2026-10-08 — web v4를 **레포 HEAD `42dc261`**과 CM dist(`view 6.39.14` · `autocomplete 6.20.0` · `state 6.5.4` · `commands`)에 다시 대조했다. v4의 F2~F4 · H1~H8 · C22(자동완성 disabled 경로 — `:1004-1011`·`:842-847`·`:565` 실측 일치) 수용. **F1은 근거가 틀렸다**(결정은 유지) — `view.update()`가 모든 dispatch에서 `observer.clear()`를 부르므로(`:7834`) 끊기 직후 D7 ③이 같은 레코드를 어차피 버린다. 그리고 v3·v4 §4-2 ② 의사코드에 **좌표계·assoc·키 폐기 버그 셋**(I1~I3)과 reconcile의 `breakingRef` 누수(I5)가 있어 큐 관리를 **순수 함수 `advanceQueue`로 lib에 내리고 테스트로 고정**했다(I4). 정정 **I1~I6** · 보완 **J1~J5** · 판정 **P25**(부록 D). 바뀐 곳은 `[v5]`, v3·v4 표시는 유지
- 원 구상: 덕수 2026-10-08 — *"커서가 `$…$` 안이면 영문, 밖이면 한글. 2벌식·390 어느 자판이든."*
- ⚠ **이 문서는 자립한다** `[v3 E1]` — v2가 "v1 §1 A~E · §4-1 표 · D2·D5~D10 · §4-3 그대로"라고 가리킨 v1은 레포에 **없다**(`docs/phaseSketch/`에는 `phase68a-ime-probe.html`과 v2뿐 — 프로브 2·3도 없다). v3는 US 표·`\text` 10종·토글 사양을 본문에 다시 적었다. 프로브 2·3 HTML은 덕수가 `docs/phaseSketch/`에 넣어 주면 S4에서 함께 보관한다(P21)
- 다음 단계: 덕수 판정(§7 P1~P25 — 권장안 전부 ★) → **CLI 착수(S1~S4)** → 덕수 실물 검수(S5)

---

## 0. 실험 기록 — 설계를 결정한 실측 (2026-10-08, 덕수 · 390 IME) — v2 그대로

### 0-1. 실험 3 = 최종 설계의 성립 증거 (Mac Chrome 154)

`phase68a-ime-probe3.html`(CodeMirror 6.39.14 번들 내장) B칸에 한글 IME로 `\frac{a}{b}, x^2+1` → Tab → ` sin` → ←← → `co` → Tab. 두 회차(합성 compositionend 켬/끔) **모두**:

- 본문 `\frac{a}{b}, x^2+1 scoin` — 글자·순서·중간 삽입 정확. 치환 8 · 메아리 0 · 짝 없는 한글 0 · 짝 없는 키 0
- 덕수: *"입력 도중 깜빡임이나 자모가 잠깐 보이는 현상 없었음"*
- `TAB-CHECK` 두 번 모두 `cm.composing=false started=false → 정상` — **Phase 68 Tab 가드(`if (view.composing) return true`)가 막히지 않는다**
- 조합이 살아 있을 때 `blur()`하니 브라우저가 `compositionend`를 냈고(39·66·73·82·89행, 모두 `break` 행보다 앞) CM 내부 플래그가 되돌아왔다. 합성 compositionend는 **한 번도 발화하지 않았다**(안전망으로만 남긴다 — D7)
- `[v3]` ⚠ 실험 3은 **독립 CM**이었다 — Mathory 편집창의 바깥 배선(블록 onFocus·updateListener·자동완성·M7 D5 가로 추적·EditorView onChange)은 §1 C16~C20에서 따로 실측했다

### 0-2. 실험 1 = A안(keydown preventDefault)의 사망 — 네 환경 전부

| 환경 | 결과 | 결정적 행 |
|---|---|---|
| Mac Chrome 154 | 초·중성 키는 keydown(229) 뒤 조합이 시작되고 **preventDefault를 무시** | `ᅡ KeyF 229 prevented` → `compositionstart` → `ㅏ` |
| Mac Safari 26.6 | `beforeinput:insertText ㅏ`가 **keydown보다 먼저** 온다 — 막을 keydown이 뒤에 있다 | 3행 insertText → 4행 keydown |
| Win11 Edge 154 · Chrome 156 | **모든 키**가 `key:'Process'` + 조합(`,`·Space·`^`·종성 ㅇ까지) | 73~79행 `,` 조합 |
| 공통 | 잔류 자모 없음(B칸 `ㅏ` 단독) · `key`는 Mac에서 **첫가끝 자모**(ᅡ·ᆼ — U+1100 계열), Windows에서 `Process` | — |

### 0-3. 실험 2 = B안 성립 조건과 C안 폐기

| 환경 | 끊기(blur/focus) 켬 | 끊기 끔 | 뜻 |
|---|---|---|---|
| Mac Chrome | `scoin` ✔ | `siㅁcㅔonㅅ` ✘ | 끊지 않으면 **다음 키에서 IME가 자기 버퍼(ㅁ)를 한 번 더 확정해 넣고** 그때부터 짝이 밀린다(113행 `"ㅁ" @2`) |
| Win Chrome(한글) | `scoin` ✔ | `sㄴiㅁcㅔonㅅ` ✘ | 동일 양상 |

- 실험 2 방식(치환 **뒤** blur)은 두 플랫폼 모두 `compositionend`가 **안 나왔다**(치환이 Blink의 조합 범위를 먼저 지워 "끝낼 조합이 없다") → `cm.composing=true`가 영구 고착 → Mathory에선 Tab·Enter·후위 변환·closeBrackets가 전부 "조합 중"으로 멈춘다. **그래서 순서를 "끊기 → 지우기 → 재생"으로 바꾼 것이 실험 3이고, 그것이 성립했다**(0-1)
- **C안(비밀번호 칸 = OS가 IME를 끔)**: 끄는 데는 성립. 그러나 Mac은 칸을 떠난 뒤 **ABC에 머물렀다**(1회차 D=`mfsa`) → **폐기**(§6)
- D칸: 390의 **단독 종성 키는 조합 없이 첫가끝 자모(U+11BC ᆼ)를 바로 넣는다**(Mac Chrome 155행) → 실험 1에서 종성 키가 막혔을 때 아무것도 안 들어간 것은 **preventDefault가 그 키들엔 먹힌 것** → 직접 경로(D4 ①) 성립. 부수 발견: **M9 G의 `ㄱ`(U+1100 ᄀ) 출처가 이것일 가능성이 크다**
- `[v3]` 실험 2의 "메아리"는 **IME 버퍼의 재확정**이다 — 113행의 메아리 글자 `ㅁ`은 직전에 치환해 지운 글자와 **같다**. 이것이 D5′의 메아리 판정 조건(E15)의 근거다

### 0-4. 남은 실측 (착수 전이 아니라 §9-3 실물 검수로)

- Safari에서 실험 3 B칸(자모가 조합 없이 `insertText`로 먼저 오고 keydown이 뒤에 온다 — 엔진의 `INS_WAIT`가 이 순서를 받는다. D5′ ④)
- Windows Chrome에서 실험 3(실험 2로 "끊기 필요"까지는 같았고, 끊는 순서만 바뀌었다)

---

## 1. 현행 — 실측 (HEAD `42dc261`) `[v3]` 전면 재작성(v1 §1을 흡수)

### 1-A. 편집창 (`components/editor/MarkdownEditor.tsx`, 1332행)

| # | 사실 | 위치 | 68a에 주는 것 |
|---|---|---|---|
| A1 | 리스너 등록 자리: `new EditorView` `:1252` → `document.addEventListener('mousedown', …, true)` `:1296` → cleanup `:1299-1305`(view.destroy · chord 타이머) | — | keydown capture 리스너·reconcile 타이머를 같은 자리에 등록·해제 |
| A2 | `updateListener` `:1021-1071` — `onChange(doc)`은 **dispatch마다** 호출 · M7 D5 가로 중앙 추적은 `input.type`·`delete`에 `requestMeasure` · cursorActivity 콜백 | — | 재생이 `input.type`이라 가로 추적이 그대로 발화(의도). onChange가 글자마다 불린다(G3) |
| A3 | inputHandler `Prec.highest` `:914-1007` — 5번째 인자 `insert()`로 "친 글자 + 별도 트랜잭션"(D19~D22) · `view.composing` 가드 `:922` · `\left`·`\bigl` 짝 `:965-984` · 수식 밖 `(`·`[` 자동닫기 차단 · 수식 안 `{` → `{}` `:997-1004` | — | 재생이 이 체인을 **그대로** 탄다. ⚠ D22 선택 감싸기(`:924-937`)는 **선택이 비어 있지 않으면** `(`·`[`·`{`를 `\left…\right`로 감싼다 → 삭제와 재생을 한 트랜잭션으로 합칠 수 없는 이유(E16) |
| A4 | `mathTab` `:713-743` 첫 줄 `if (view.composing) return true` · `mathShiftTab` `:745` · `rowEnter` `:750` 동일 가드 | — | 0-1의 TAB-CHECK가 이 가드를 모사했다 |
| A5 | 자동완성 `autocompletion({ override, activateOnTyping: true, maxRenderedOptions: 12, defaultKeymap: true, icons: false })` `:884-890` — `closeOnBlur` 미지정 = 기본 true | — | C11·D10′ |
| A6 | `lineWrap` prop `:161` → `lineWrapRef` `:445-446` → Compartment reconfigure effect `:1310-1314` | — | `mathAscii` prop을 같은 꼴로(ref, effect 불필요 — reconfigure할 것이 없다) |
| A7 | `latexLinter` `:420-436` · `latex-highlight.ts:107` · EditorView `toggleLineWrap` `:1296` · `maybeRecenterOnBottomTyping` `:2328` — 전부 `view.composing`/`isComposing()` 가드 | — | 끊기 뒤 `composing=false`라 이 넷이 **수식 안 한글 IME 타자 중에도 정상 동작**한다(부수 이득 G11) |
| A8 | 툴팁 호스트 `tooltipHost()` `:91-101`(0×0 fixed, id `cm-tooltip-host`) — 자동완성 팝업 DOM이 **여기** 산다 | — | "relatedTarget이 툴팁 안인가"는 `tooltipHost().contains(...)`로 판정 가능(D10′ (b)) |
| A9 | 핸들 `hasFocus()`는 `view.hasFocus`(getter) 래퍼 `:610` · `isComposing()`은 `view.composing` `:613` | — | — |

### 1-B. 편집 화면 (`EditorView.tsx` · `UnifiedToolbar.tsx`)

| # | 사실 | 위치 | 68a에 주는 것 |
|---|---|---|---|
| B1 | 줄바꿈 토글 — `LINE_WRAP_KEY = 'mathory-editor-wrap'` `:244` · `getStoredLineWrap/setStoredLineWrap` `:246-253` · `useState(true)` + 마운트 후 localStorage 반영 `:1108-1109`(hydration) · `toggleLineWrap` `:1294-1301`(IME 조합 중 무시) · MarkdownEditor 두 자리(`:1012`·`:3994`)에 prop · 툴바 `onToggleLineWrap={toggleLineWrap}` `:3771` | — | 토글 D11은 이 다섯을 그대로 복제한다(§4-3) |
| B2 | 툴바 prop `lineWrap`·`onToggleLineWrap` `:214-215` · 버튼 항목 `key:'lineWrap'` `:796-806`(`IconButton active={lineWrap}` · `LineWrapIcon`) · 항목 배열은 **끝에서부터 숨는다**(`:772` 주석) | — | `key:'mathAscii'` 항목을 `lineWrap` **앞**에(= 줄바꿈 왼쪽) |
| B3 | `IconButton` props `title·onClick·active·disabled·inactive` `:245-254` — `disabled`는 작업 중(`wait`) 전용, "해당 없음"은 `inactive` | — | 2상태(`active`)만 쓴다(D12) |
| B4 | ⌥Z window 리스너 `:2812`(`e.code === 'KeyZ'`) | — | 68a는 단축키 없음(P5) — 손대지 않는다 |
| B5 `[v3]` | **블록 `onFocus`는 포커스 이벤트가 아니라 `onClick`이다** — `<div style={{padding:0}} onClick={onFocus}>` `:993` → `handleBlockFocus` `:2600-2632` | — | **끊기(blur→focus)가 `handleBlockFocus`를 다시 부르지 않는다** → 블록 중앙 스크롤(`scrollEditorToCursorCenter`)이 키마다 돌 위험 0. v2 C14가 빠뜨린 확인 |
| B6 | React `onBlur`는 제목 입력 `:3572`·탭 라벨 `:3799`에만 — 블록·편집창 래퍼엔 없다 | — | React 레벨 blur 부수 효과 0 |

### 1-C. CodeMirror dist — v2 C9~C15를 **전부 재확인**(줄 번호 일치) + 추가

| # | 사실 | 위치 | 68a에 주는 것 |
|---|---|---|---|
| C9 | `view.composing` = `inputState.composing > 0` · `compositionStarted` = `>= 0` · `observers.compositionend`가 `-1` | view `:7701` · `:7708` · `:5145-5148` | ✔ v2 그대로 |
| C10 | `updateForFocusChange`는 **10ms 뒤** `hasFocus != notifiedFocused`일 때만 dispatch/update | view `:5110-5119` | 같은 태스크 blur→focus = 클래스 토글·리렌더 0 ✔ |
| C11 | 자동완성 blur 처리는 **두 곳** — ① 플러그인 `eventHandlers.blur`(`closeOnBlur` + relatedTarget이 툴팁 밖 → 10ms 뒤 close) `:1262-1268` ② 툴팁 DOM 자체의 `focusout`(relatedTarget ≠ contentDOM → 즉시 close) `:534-538` | autocomplete | ②는 툴팁이 포커스를 가진 경우라 우리 blur와 무관. ①만 막으면 된다 → D10′ |
| C12 | closeBrackets 게이트 `(android ? view.composing : view.compositionStarted)` · Mathory 후위 변환 `!view.composing` | autocomplete `:1828-1830` · ME `:922` | 재생은 조합이 끝난 뒤에만(D7 순서) ✔ |
| C13 | 자동완성 `activateOnTyping`은 `tr.isUserEvent('input.type')` | autocomplete `:944-945` · `:1175` | 재생이 `input.type` → 팝업 갱신 ✔ |
| C14 | `hasFocus` 소비처: `onPointerUp` ME`:1288` · `maybeRecenterOnBottomTyping` EV`:2327`(rAF) · cursorActivity EV`:2576` | — | 같은 태스크라 무영향 ✔ + B5·B6 |
| C15 | `ignoreDuringComposition`: `/^key/` 이벤트이고 `composing > 0`이면 CM이 **버린다**(keymap·domEventHandlers 모두) | view `:4544-4548` | 래퍼 div **네이티브 capture**가 필수(D13). ⚠ 조합의 **첫** keydown(composing −1/0)은 CM keymap에 닿는다 — `key:'ᆼ'`에 맞는 바인딩이 없고 `runHandlers`의 `shift[keyCode]` 대체 이름도 Mathory 바인딩과 겹치지 않는다(`:8985-9020`) |
| C16 `[v3]` | **EditContext는 Android에서만 켜진다** — `window.EditContext && browser.android && …` | view `:6992-6997` | Mac·Windows·iPad는 **옛 composition 관찰자 경로**(`:5135-5150`)다. D7 ② 합성 `compositionend`가 contentDOM에서 유효한 조건. (EditContext 경로에선 `observers.compositionend`가 `if (view.observer.editContext) return`으로 **무시**된다 `:5146` — 폰 편집이 없으므로 범위 밖, P20) |
| C17 `[v3]` | `observers.focus`는 `!scrollTop && (lastScrollTop ∨ lastScrollLeft)`면 **`lastScrollLeft`를 복원** — 그 값은 `observers.scroll`(**scroll 이벤트**, 비동기)이 갱신 | view `:5120-5129` · `:4829-4832` | 줄바꿈 **끔** 모드에서 M7 D5가 `scrollLeft`를 프로그램적으로 옮긴 **직후** 우리 blur→focus가 끼면 한 프레임 전 값으로 되돌린다(E9). 켬 모드는 scrollLeft 0이라 무관 |
| C18 `[v3 → v4 F1 → v5 I6 재정정]` | `view.focus()` = `observer.ignore(() => { focusPreventScroll(contentDOM); docView.updateSelection(); })` · `ignore`는 `stop()` → `f()` → `start()` → `clear()`(대기 레코드 폐기). **그런데 `view.update()`도 비-Android 경로에서 매 dispatch마다 `this.observer.clear()`를 부른다** — 끊기 직후의 D7 ③/⑤ dispatch가 같은 레코드를 어차피 버린다. 게다가 `observers.compositionend`는 대기 레코드가 있을 때 flush를 **마이크로태스크**로 미루므로(`:5151-5158`) 동기 reconcile 안에서는 어느 쪽이든 flush 전에 ③이 돈다 | view `:8459-8464` · `:7168-7179` · `:7197-7200` · **`:7825-7835`** · `:5145-5158` | v4 F1의 "`view.focus()`는 레코드를 잃고 `contentDOM.focus()`는 안 잃는다"는 **성립하지 않는다** — 둘 다 같다. 결정 (b) `contentDOM.focus({preventScroll:true})`는 **실험 3이 실증한 경로라서** 유지하고, 차이(`updateSelection`)는 D7 ③/⑤의 selection 지정 dispatch가 채운다. ⚠ CLAUDE.md에 "`view.focus()` 금지"를 **사실로 적지 말 것**(D15에서 삭제) |
| C19 `[v3]` | `view.hasFocus` = `document.hasFocus() && root.activeElement == contentDOM` | view `:8447-8455` | 끊기 직후 동기적으로 true ✔ |
| C20 `[v3 · v4 H5 보강]` | history 병합: `input.type.compose`는 **항상** 직전 이벤트에 합쳐진다(단 **`.compose.start`는 제외** — 주석 "For compose (but not compose.start) events"), 그 밖은 `newGroupDelay 500` + `isAdjacent`. `joinableUserEvent`는 `input.type`·`delete` 계열 | commands `:482-491` · `:212` | D9 — 첫 자모(`.compose.start`)는 500ms 규칙(일반 타자와 같다), 이후 조합 삽입·삭제·재생은 한 그룹 ✔ |
| C21 `[v3]` | `applyDefaultInsert`의 userEvent: `view.composing ∨ (compositionPendingChange ∧ compositionEndedAt > now−50)`이면 `.compose` | view `:4327-4335` | 재생 직후(50ms 안) CM이 만든 삽입이 `.compose`로 찍힐 수 있다 — 우리 재생은 **자체 트랜잭션**이라 무관(`'input.type'` 고정) |
| C22 `[v4]` | 자동완성이 열린 채 `\frㅏ`가 되는 순간: `ActiveResult.update`가 `checkValid(validFor)` 실패로 **`ActiveSource(Pending)`**을 돌려주고, `CompletionDialog.build`는 `prev && active.some(isPending)`이면 **`prev.setDisabled()`** — 팝업은 남고 `cm-tooltip-autocomplete-disabled` 클래스만 붙는다(테마는 `li[aria-selected]` 배경색만). 재질의는 플러그인 `update`가 `activateOnTypingDelay`(기본 100) 타이머로 — 우리 삭제·재생 트랜잭션이 그 타이머를 **다시 시작**하므로 마지막 재생 100ms 뒤 `\fra`로 질의 → 결과 → enabled | autocomplete `:1004-1011` · `:842-847` · `:565` · `:1334` · `:1170` · `:379` | 한글 모드 타자 중 팝업은 **살아 있되** 글자마다 ~100ms disabled 톤. (c)로 blur 닫힘을 막는 것이 전제(안 막으면 10ms 뒤 **닫힌다**) → P23 |

### 1-D. 그 밖

| # | 사실 | 68a에 주는 것 |
|---|---|---|
| D-a | `lib/mathRegions.ts` — `mathRegionAt`은 `innerFrom ≤ pos ≤ innerTo`(**양끝 포함**) · 빈 `$$` 쌍은 길이 0 | 닫는 `$` 바로 앞·여는 `$` 바로 뒤 모두 "안". 닫는 `$` **뒤**(`r.to`)는 밖 ✔ |
| D-b | `lib/latexScan.ts` — `readGroup(text, openIdx)`·`skipEnvArgs` | `isInTextArg`의 인자 범위 |
| D-c | `lib/invisibles.ts:48` `INVISIBLE_SPECIAL_CHARS = /[…]\|[ᄀ-ᄒ](?![ᅠ-ᆧ])/` | 단독 초성 U+1100~1112만 점으로 — 조합 중 IME가 넣는 호환 자모(U+3131~)엔 닿지 않는다 |
| D-d | 아이콘 ICONS 표 **61종**(`scripts/gen-phosphor-paths.mjs:36-`) · `@phosphor-icons/core` regular에 `keyboard.svg` 있음 | +1 = 62종, `icons:gen` 재생성 |
| D-e | 테스트 스크립트 꼴: `"test:X": "tsc lib/X.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/X.test.mjs"` — tsc가 import를 따라간다(`test:tidy`가 blockTidy→mathRegions·proofread·mathInput을 함께 컴파일) | `test:mathascii`는 `lib/mathAscii.ts` 하나만 적으면 된다 |
| D-f | 다른 CM 인스턴스: `components/comment/LatexInputEditor.tsx` 하나 | D2 범위 밖 그대로 |
| D-g | 폰(`components/phone/`)에 편집 진입점 없음 | 폰 0 |

---

## 2. 결정 (최종 · ★ 권장 — P 항목과 짝)

### A. 원리

| # | 결정 |
|---|---|
| D1 | **원리**: 한글 IME를 켠 채로 둔다. 수식 영역 안에서는 IME가 만든 글자를 **그대로 두지 않고**, 눌린 물리 키의 US QWERTY 글자로 **사후 치환**한다 — 단 치환 전에 브라우저 조합을 끊는다(0-3의 두 실패가 이 순서를 강제한다). 수식 밖은 무접촉 |
| D2 | **적용 영역** `[v3 명문화]`: `mathRegionAt(scanMathRegions(doc), pos)`가 영역을 돌려주는 자리 전부(`$…$` · `$$` 펜스 · 한 줄 `$$…$$` · 빈 `$$` 쌍 · `\(…\)` · `\[…\]` · 미닫힘 포함) **−** `TEXT_CMDS` 인자 안(D13) **−** 댓글 `LatexInputEditor`(D-f). 판정 위치는 keydown에선 **커서 head**, 삽입에선 **삽입 시작 `fb`**(둘이 다를 수 있는 경계는 R7) |
| D3 | **키 분류**(`classifyKey`, 순서대로 첫 일치) `[v3 E6]`: ⓐ `ctrl·meta·alt` → `pass` ⓑ `code`가 US 표에 없다(Tab·Enter·Backspace·화살표·Escape·Space·Lang1/2·Shift…) → `pass` ⓑ′ **`key.length > 1 && key !== 'Process'`**(`Dead`·`HangulMode`·`Unidentified`·`Hanja`…) → `pass` ⓒ `key`가 ASCII 한 글자이고 `!isComposing && keyCode !== 229` → `latin`(**어떤 자판이든 손대지 않는다**) ⓓ `keyCode !== 229 && !isComposing`(비ASCII 한 글자 `key` — Mac 390 종성·`₩`) → `direct` ⓔ 그 밖(229·`Process`·isComposing) → `record`. ⚠ ⓑ′가 없으면 `Dead`(국제 자판의 `^`·`` ` `` 사자 키, `code:'Digit6'`)가 ⓓ로 떨어져 **US 글자를 넣고 사자 키를 삼킨다** — v2 테스트 ⓚ(`Dead → pass`)와 v2 사양이 서로 어긋나 있었다 |
| D4 | **경로 둘**: ① `direct` = `preventDefault` + 즉시 `typeText(ch)` ② `record` = 키를 FIFO에 `{ch, t}`로 기록만 하고 IME가 본문에 넣은 글자와 **시간 순으로** 짝짓는다(D5′) |
| D5′ `[v3 E2·E7·E14·E15 — v2 D5 대체]` | **짝짓기는 글자 수가 아니라 시간 순이다**(`pairInsertion`, 순수). 삽입 `I = {text, t}`에 대해 — ① **`t_prev < t_key ≤ t_I`인 기록 키 전부**를 꺼내(`t_prev` = 직전에 처리한 삽입의 시각) US 글자를 이어 붙인 것이 `rep`. 삽입 글자 수와 키 수를 **대응시키지 않는다** — reconcile(setTimeout 0)이 다음 keydown보다 늦으면 `ㅁ`→`마`처럼 **음절이 만들어진 채** 한 삽입으로 오고(2벌식 `마`=2키 · `뫄`=3키 · `닭`=4키, 390은 다른 수), 음절 1 = 키 1로 세면 키가 남아 다음 글자에 들러붙는다. 자판별 분해표는 두지 않는다(시간 순이면 필요 없다) ② 그 구간에 키가 **없고** `text`에 한글이 있으면: `age < INS_WAIT`(60ms) → **대기**(Safari — keydown이 뒤에 온다) / 대기 뒤 키가 생겼으면 **가장 오래된 키 하나만** 소비(Safari는 삽입 1 = 키 1) / 그래도 없으면 ③ ③ **메아리 판정**: `text === lastReplaced.text`(직전 치환으로 **지운 바로 그 글자열**) **이고** `sinceReplace < ECHO_WINDOW`(120ms)면 삭제 — 둘 다 만족할 때만(0-3 `[v3]` 근거). 아니면 **그대로 둔다**(사용자가 정말 넣은 한글 — iPad 가상 키보드 등 키가 안 잡히는 경로 포함) ④ `text`에 한글이 없고 ASCII뿐이면(Windows의 `,`·`(`, Mac의 Space 확정) 키가 있으면 `rep` = 키의 US 글자, 없으면 그대로(**정렬 유지가 목적**이지 글자 대조가 아니다) ⑤ **한글도 ASCII도 아닌 글자**(한자 변환·전각 `，`·이모지)는 **무접촉 + 키 소비 0**(v2는 이 갈래가 없어 미정의였다) ⑥ 기록 키가 `KEY_TTL`(250ms) 안에 어떤 삽입에도 쓰이지 못하면 버린다 ⑦ **삽입 항목이 겹치는 변경(Backspace 등)으로 큐에서 지워지면 그보다 오래된 키도 함께 버린다** — 안 버리면 TTL 안의 다음 삽입에 그 키가 **앞에 붙는다**. 한글 판정 `HANGUL_RE` = U+1100–11FF · 3130–318F · AC00–D7AF **+ A960–A97F · D7B0–D7FF(확장 자모) · FFA0–FFDC(반각)** |
| D6 | **재생 대상** = 수식 영역 안의 삽입 중 ⓐ 한글을 품었거나 ⓑ `userEvent`가 `input.type.compose`인 것. `input.paste`·`undo`·`redo`·우리 자신의 트랜잭션(annotation `mathAsciiTx`)·프로그램적 삽입(userEvent 없음)은 **보지 않는다**. `[v3 E13]` **토글이 꺼져 있으면 updateListener도 큐에 넣지 않는다**(v2 코드는 keydown만 게이트했다). `[v4 H3]` 재생이 일으키는 **2차 트랜잭션**은 자연히 걸러진다 — Phase 68 D20의 `{}` 삽입(userEvent 없음 · `isolateHistory`만) · D19의 `\frac` 치환(동일) · closeBrackets의 `()`(`input.type`이지만 한글 없음) — `needsReplay` ⓐⓑ 어느 쪽에도 안 걸린다. 단 **`mathAsciiTx`는 재생 1차(`typeText`의 `insert()`)에만** 붙는다는 점을 알고 둘 것(2차는 Phase 68 핸들러가 만든다) |
| D7 | **치환 절차**(`reconcile`, `setTimeout 0` — 트랜잭션 안에서 dispatch 금지): ① `view.compositionStarted`면 **끊기** — **`view.hasFocus`일 때만**(`[v4 F2]` — 포커스가 이미 딴 데 가 있으면 blur/focus가 포커스를 **되빼앗는다**; 그 경우 ②만) `breakingRef = true` → `contentDOM.blur()` → **`contentDOM.focus({ preventScroll: true })`**(실증 경로 — C18 `[v5]`: `view.focus()`와 레코드 측면은 같다) → `finally { breakingRef = false }`. `[v5 I5]` **`breakingRef = true`는 `hasFocus` 가드 *안*·`try` 안에서** — v4 의사코드는 가드 밖에서 켜고 가드가 거짓이면 끄지 않아 **다음 진짜 blur를 삼켰다**(R10 자기 함정 그대로). 브라우저가 진짜 `compositionend`를 낸다(0-1) ② 그래도 `compositionStarted`면 합성 `CompositionEvent('compositionend')`를 contentDOM에 dispatch(안전망 — 실험 3에서 0회 · 데스크톱은 전부 비-EditContext라 유효, C16) + 이상 카운터 ③ 삽입 범위가 아직 같은 글자열이면 **삭제**(`userEvent: 'input.type'` · annotation `mathAsciiTx` · `selection: {anchor: from}`) ④ `typeText(rep)`를 **글자 단위로** — inputHandler 체인(§4-2) ⑤ 범위가 사라졌으면(blur가 조합 글자를 지운 경우 — Safari 대비) 선택만 `from`으로 두고 ④만. `[v3 E16]` **③과 ④를 한 트랜잭션으로 합치지 말 것** — 첫 글자를 "범위 대체"로 넣으면 inputHandler가 **선택 있음**으로 읽어 D22(`(`·`[`·`{` → `\left…\right` 감싸기)와 closeBrackets의 선택 감싸기가 **지우려던 한글을 감싼다** |
| D8 | **직접 경로의 Safari 가드**: `direct` 키인데 큐에 `INS_WAIT` 안의 **짝 없는 한글 삽입**이 있으면(Safari가 insertText를 먼저 보낸 경우 — MutationObserver 마이크로태스크가 keydown 태스크보다 앞서 CM flush를 끝내므로 큐에 이미 있다) `preventDefault`하지 않고 `record`로 |
| D9 | **history**: 조합 삽입(`input.type.compose` — C20 "항상 병합")·삭제(`input.type`)·재생(`input.type`)이 `newGroupDelay 500` + `isAdjacent`로 **한 타자 그룹** — ⌘Z 1회 = 일반 타자와 같은 단위. 재생의 후위 변환 2차 dispatch는 Phase 68 그대로 `isolateHistory('before')`(⌘Z 1회면 `{}`만 풀린다 — 영문 IME와 동일) |
| D10′ `[v3 E5 — v2 D10 대체]` | **자동완성 보호 = 우리 blur·focus 이벤트를 CM이 못 보게 한다**(P14 (c) ★): 래퍼 div에 **capture** `blur`·`focus` 리스너를 두고 `breakingRef`가 참이면 `e.stopImmediatePropagation()`. blur·focus는 버블하지 않지만 **capture 단계는 조상을 지난다** → contentDOM에 걸린 CM `observers.blur/focus`와 자동완성 플러그인 `eventHandlers.blur`(C11 ①)가 **아예 불리지 않는다**. 효과 셋 — ⓐ 팝업이 안 닫힌다(autocompletion 설정 **무변경**, R9 소멸) ⓑ `observers.focus`의 `lastScrollLeft` 복원(C17·E9)이 안 돈다 ⓒ `updateForFocusChange` 10ms 타이머가 안 생긴다. 끊기에 필요한 것(브라우저의 `compositionend` → CM 관찰자)은 **별개 이벤트**라 그대로 도착한다. DOM 선택은 D7 ③/⑤의 dispatch가 되돌린다(`[v4 F1]`). `[v4 H1]` ⚠ (c)가 막는 것은 **blur로 인한 닫힘**뿐이다 — 한글이 본문에 있는 순간 자동완성 결과는 `validFor` 불일치로 Pending이 되고 팝업은 **닫히지 않고 disabled**가 된다(C22). 재질의가 `activateOnTypingDelay`(100ms) 뒤라 글자마다 ~100ms 동안 **선택 행 배경 톤만** 바뀐다. 수용(P23) 대안 (b) `closeOnBlur:false` + 자체 blur 핸들러(`tooltipHost().contains(relatedTarget)` 조건 복제)는 **폴백**으로 둔다(§4-2에 둘 다 적는다) |

### B. 설정·범위

| # | 결정 |
|---|---|
| D11 | **토글** `[v3 명문화]`: Row 2 `IconButton`(`keyboard` 도안 · `active={mathAscii}` · title `수식 안 자동 영문 입력 끄기` / `… 켜기`) · **줄바꿈 버튼 왼쪽**(항목 배열에서 `lineWrap` 앞) · 기본 **켬** · localStorage `mathory-editor-mathascii`(`'on'|'off'`, B1 꼴 그대로 — `useState(true)` + 마운트 후 반영) · 단축키 없음 · IME 조합 중 토글은 **막지 않는다**(Compartment 재구성이 없어 Phase 65 D12의 이유가 없다) |
| D12 | **자가 비활성은 없다** — 대신 **이상 카운터**(짝 없는 키 폐기 · 메아리 삭제 · 합성 compositionend 발화 · 범위 소실 ⑤)를 세션에 세고 **10건째에 dev 콘솔 경고 1회**(`[Phase68a] …`, 사용자 알림 없음) |
| D13 | **`TEXT_CMDS` 10종** `[v3 명문화]`: `text` · `textbf` · `textit` · `textrm` · `textsf` · `texttt` · `textnormal` · `textup` · `mbox` · `hbox`. 커서 앞에서 가장 가까운 `\cmd{`를 찾아 `readGroup`으로 닫힘을 구하고 그 안이면 제외(미닫힘이면 행 끝까지 제외). `\mathrm`·`\operatorname`은 **수식**(영문이 맞다) — 포함하지 않는다(P9). CapsLock은 `usCharFor(code, shift, caps)`가 영문자에 한해 `shift XOR caps`로 대소문자(한글 모드에서 CapsLock 상태는 OS가 보여 주지 않으므로 `getModifierState('CapsLock')`을 믿는다). 리스너는 래퍼 div **네이티브 capture**(C15) |
| D14 | 코드 배치: 순수 판정·짝짓기는 `lib/mathAscii.ts`(`test:mathascii`, import는 `./mathRegions` 타입 + `./latexScan`만), CM 배선(큐·reconcile·typeText·끊기·capture 억제)은 `MarkdownEditor.tsx`. 토글 상태는 `EditorView.tsx`(B1 꼴) |
| D15 | CLAUDE.md: 「핵심 패턴」 맨 앞 68a 절 — 원리(사후 치환) · **끊기 → 지우기 → 재생이 불변식인 이유**(0-3) · **삭제·재생 분리가 불변식인 이유**(E16) · 짝짓기는 **시간 순**(E2) · 네이티브 capture(C15) · **blur·focus capture 억제**(D10′ — "CM이 우리 blur를 보면 자동완성이 닫히고 scrollLeft가 되돌아간다") · 라틴 키 무접촉 · 390 종성 = 직접 경로 · EditContext는 Android 전용(C16) · "IME 글자를 보지 말고 물리 키를 보라"(기존 규약 확장) · M9 G 출처 추정 · `[v5]` 끊기의 focus는 `contentDOM.focus({preventScroll:true})`(실증) — `view.focus()`도 레코드 측면은 같다(`update()`가 매 dispatch에 `observer.clear()`), **"금지"로 적지 말 것**(C18) · 자동완성은 한글 순간 disabled일 뿐 닫히지 않는다(C22) · **보류 삽입의 좌표 매핑은 안쪽 결합(from +1 · to −1)이다 — `lib/mathSlots`의 바깥 결합(−1·+1)과 반대이며 의도다**(I1 — 자리는 "친 글자를 품어야" 하고 보류 삽입은 "옆에 온 글자를 품으면 안 된다") · 키 폐기는 **순수 삭제**에서만(I2) · 큐 관리는 `advanceQueue`(순수 · `test:mathascii`)가 소유, `MarkdownEditor`는 `iterChanges`를 배열로 모아 넘기기만(I4) |

---

## 3. 데이터 모델

없음. **서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 0 · 전처리 0 · 렌더 5사이트 0 · 폰 0 · 댓글 에디터 0.** localStorage 키 1 · 아이콘 +1(`keyboard`, 61 → 62종).

---

## 4. 구현 사양

### 4-1. `lib/mathAscii.ts` (신규 · 순수)

```ts
import type { MathRegion } from './mathRegions';
import { readGroup } from './latexScan';

/** 한글 — 첫가끝·호환 자모 · 음절 · 확장 자모 A/B · 반각 (D5′) */
export const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏가-힯ꥠ-꥿ힰ-퟿ﾠ-ￜ]/;

/** US QWERTY — code → [기본, Shift]. Space는 **없다**(IME 확정 키 — P11). 영문자는 caps XOR shift */
export const US_KEYS: Readonly<Record<string, readonly [string, string]>> = {
  // 영문자 26 — 'KeyA': ['a','A'] … 'KeyZ'
  // 숫자열 — Digit1:['1','!'] Digit2:['2','@'] Digit3:['3','#'] Digit4:['4','$'] Digit5:['5','%']
  //         Digit6:['6','^'] Digit7:['7','&'] Digit8:['8','*'] Digit9:['9','('] Digit0:['0',')']
  // 기호 — Minus:['-','_'] Equal:['=','+'] BracketLeft:['[','{'] BracketRight:[']','}'] Backslash:['\\','|']
  //        Semicolon:[';',':'] Quote:["'",'"'] Backquote:['`','~'] Comma:[',','<'] Period:['.','>'] Slash:['/','?']
  //        IntlBackslash:['\\','|']  (ISO 자판의 `<>` 자리 — 한국어 Mac에선 없음, 해 될 것 없다)
  // 숫자패드 — Numpad0~9:['0','0']… NumpadAdd:['+','+'] NumpadSubtract:['-','-'] NumpadMultiply:['*','*']
  //           NumpadDivide:['/','/'] NumpadDecimal:['.','.'] NumpadEqual:['=','=']
};
export function usCharFor(code: string, shift: boolean, caps: boolean): string | null;

export type KeyClass = 'pass' | 'latin' | 'direct' | 'record';
export interface KeyLike { key: string; code: string; keyCode: number; isComposing: boolean;
  ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; caps: boolean }
export function classifyKey(e: KeyLike): { cls: KeyClass; ch: string | null };              // D3 ⓐ~ⓔ

export interface RecordedKey { ch: string; t: number }
export interface PairInput { text: string; t: number; tPrev: number; keys: readonly RecordedKey[];
  now: number; lastReplaced: { text: string; t: number } | null }
export interface PairResult {
  rep: string;            // 치환 결과(= text면 무변경)
  consumed: number;       // 앞에서부터 소비한 키 수
  wait: boolean;          // Safari 순서 — 20ms 뒤 재시도
  echo: boolean;          // 메아리 → rep '' 로 삭제
  kept: number;           // 키 없이 남긴 한글 글자 수(이상 카운터용)
}
export function pairInsertion(p: PairInput): PairResult;                                   // D5′ ①~⑤
export function dropKeysBefore(keys: readonly RecordedKey[], t: number): RecordedKey[];     // D5′ ⑦
export function expireKeys(keys: readonly RecordedKey[], now: number): RecordedKey[];       // D5′ ⑥ (KEY_TTL)
export function needsReplay(text: string, userEvent: string | undefined): boolean;         // D6

/** [v5 I4] 큐 관리 — CM 없이 검증 가능하도록 순수 함수. `changes`는 updateListener가 `iterChanges`로 모은 것(옛 좌표 fa·ta 오름차순 · 서로 겹치지 않음). */
export interface PendingIns { from: number; to: number; text: string; t: number }
export interface ChangeDesc { fa: number; ta: number; fb: number; tb: number; ins: string; qualifies: boolean }  // qualifies = needsReplay ∧ 수식 안 ∧ \text 밖
export interface AdvanceResult { entries: PendingIns[]; dropKeysBeforeT: number | null; added: PendingIns[] }
/** ① 옛 좌표로 겹침 판정 → ② 겹친 항목 제거(변경이 **순수 삭제 또는 비자격 삽입**이면 그 항목의 t를 `dropKeysBeforeT`로 — 자격 삽입(ㅁ→마)은 키 보존)
 *  ③ 생존 항목을 **안쪽 결합**으로 매핑(삽입이 `from`에 닿으면 뒤로 밀리고, `to`에 닿아도 늘어나지 않는다) ④ 자격 삽입을 새 좌표(fb·tb)로 추가 */
export function advanceQueue(entries: readonly PendingIns[], changes: readonly ChangeDesc[], now: number): AdvanceResult;
export function isInTextArg(doc: string, pos: number, region: MathRegion): boolean;        // D13
export const TEXT_CMDS: readonly string[];
export const INS_WAIT_MS = 60, ECHO_WINDOW_MS = 120, KEY_TTL_MS = 250, ANOMALY_WARN_AT = 10;
```

- `pairInsertion`의 키 선택은 `keys.filter(k => k.t > p.tPrev && k.t <= p.t)`가 아니라 **앞에서부터 연속 소비**다(FIFO — 큐 머리의 키가 `t ≤ p.t`인 동안 꺼낸다). `tPrev`는 호출부가 큐를 이미 앞에서 잘라 두므로 결과가 같고, 호출부 `consumed`로 자르기 쉽다
- Safari 대기(②)는 **한글이 있고 소비 0일 때만**. 대기 뒤 재시도에서 `keys[0].t > p.t`인 키가 있으면 **1개**만 소비

### 4-2. `MarkdownEditor.tsx` 배선 (D4~D10′)

```ts
import { Annotation, Transaction } from '@codemirror/state';
import { classifyKey, pairInsertion, dropKeysBefore, expireKeys, needsReplay, isInTextArg,
         INS_WAIT_MS, ANOMALY_WARN_AT } from '../../lib/mathAscii';

const mathAsciiTx = Annotation.define<boolean>();

// refs (컴포넌트 안)
const mathAsciiRef = useRef(mathAscii);  mathAsciiRef.current = mathAscii;       // prop (lineWrap 꼴)
const keysRef = useRef<RecordedKey[]>([]);
const insRef  = useRef<{ from: number; to: number; text: string; t: number }[]>([]);
const timerRef = useRef<number | null>(null);
const lastReplacedRef = useRef<{ text: string; t: number } | null>(null);
const lastInsTRef = useRef(0);
const breakingRef = useRef(false);
const anomalyRef = useRef(0);

/** 재생 한 글자 — CM 기본 타자와 같은 체인(inputHandler facet 루프 → 기본 삽입).
 *  ⚠ `insert`는 **Transaction**을 돌려줘야 한다 — Phase 68 핸들러가 `view.dispatch(insert())`한다(:941). */
function typeText(view: EditorView, ch: string) {
  const { from, to } = view.state.selection.main;        // to === from (D7 ③이 선택을 접어 둔다)
  let tr: Transaction | null = null;
  const insert = () => tr || (tr = view.state.update(view.state.replaceSelection(ch),
    { userEvent: 'input.type', scrollIntoView: true, annotations: mathAsciiTx.of(true) }));
  if (!view.state.facet(EditorView.inputHandler).some((h) => h(view, from, to, ch, insert))) view.dispatch(insert());
}

// ① keydown — 래퍼 div capture (new EditorView 직후 등록 · cleanup에서 해제)
const onKeydown = (e: KeyboardEvent) => {
  const view = viewRef.current;
  if (!view || !mathAsciiRef.current || !view.contentDOM.contains(e.target as Node)) return;
  const { cls, ch } = classifyKey({ key: e.key, code: e.code, keyCode: e.keyCode, isComposing: e.isComposing,
    ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey, caps: e.getModifierState('CapsLock') });
  if (cls === 'pass' || cls === 'latin') return;
  const doc = view.state.doc.toString(), head = view.state.selection.main.head;
  const region = mathRegionAt(scanMathRegions(doc), head);
  if (!region || isInTextArg(doc, head, region)) return;
  const now = performance.now();
  if (cls === 'direct' && !insRef.current.some((h) => now - h.t < INS_WAIT_MS)) {   // D8
    e.preventDefault(); typeText(view, ch!); return;
  }
  keysRef.current.push({ ch: ch!, t: now }); schedule(0);
};

// ①′ blur·focus capture 억제 (D10′) — 같은 래퍼 div, capture
const swallowOwnFocusEvents = (e: FocusEvent) => { if (breakingRef.current) e.stopImmediatePropagation(); };
// editorRef.current.addEventListener('blur', swallowOwnFocusEvents, true); 'focus' 동일

// ② updateListener — [v5 I1~I4] 큐 관리는 advanceQueue(순수)가 한다. 여기서는 변경을 **모아서 넘길 뿐**이다.
//    ⚠ v3·v4 의사코드의 버그 셋: (I1) from/to를 CM 기본 assoc(−1/+1)로 매핑 → 보류 'ㅁ'[5,6) 뒤에 `{`가 6에 들어오면
//    to가 7로 **늘어나** still 검사가 깨지고 ⑤ 폴백이 'fㅁ{'를 만든다. (I2) 겹침이면 무조건 키 폐기 → 'ㅁ'→'마' 조합 **갱신**
//    (CM은 [5,6)→'마' 치환으로 보고한다)이 Backspace와 같이 취급돼 f가 버려지고 rep가 'k'가 된다. (I3) 매핑을 **먼저** 하고
//    옛 좌표(fa·ta)로 겹침을 쟀다 — 좌표계 불일치.
EditorView.updateListener.of((u) => {
  if (!u.docChanged) return;
  if (u.transactions.some((t) => t.isUserEvent('undo') || t.isUserEvent('redo'))) { insRef.current = []; keysRef.current = []; return; }
  const own = u.transactions.some((t) => t.annotation(mathAsciiTx));
  const paste = u.transactions.some((t) => t.isUserEvent('input.paste'));
  const ue = u.transactions.map((t) => t.annotation(Transaction.userEvent)).find(Boolean);
  const docStr = u.state.doc.toString(), regions = scanMathRegions(docStr);
  const changes: ChangeDesc[] = [];
  u.changes.iterChanges((fa, ta, fb, tb, ins) => {
    const s = ins.toString();
    const qualifies = !own && !paste && mathAsciiRef.current && !!s && needsReplay(s, ue)      // D6 (토글 게이트 포함 — E13)
      && (() => { const r = mathRegionAt(regions, fb); return !!r && !isInTextArg(docStr, fb, r); })();
    changes.push({ fa, ta, fb, tb, ins: s, qualifies });
  });
  const res = advanceQueue(insRef.current, changes, performance.now());
  insRef.current = res.entries;
  if (res.dropKeysBeforeT !== null) keysRef.current = dropKeysBefore(keysRef.current, res.dropKeysBeforeT);   // D5′ ⑦
  if (res.added.length) schedule(0);
});

// ③ reconcile — setTimeout (D7)
function reconcile(view: EditorView) {
  timerRef.current = null;
  if (!viewRef.current || view !== viewRef.current) return;                        // [v4 H4] 블록 언마운트 뒤 타이머
  const now = performance.now();
  keysRef.current = expireKeys(keysRef.current, now);
  while (insRef.current.length) {
    const h = insRef.current[0];
    const r = pairInsertion({ text: h.text, t: h.t, tPrev: lastInsTRef.current, keys: keysRef.current, now, lastReplaced: lastReplacedRef.current });
    if (r.wait) { schedule(20); return; }                                          // Safari 순서
    keysRef.current = keysRef.current.slice(r.consumed); insRef.current.shift(); lastInsTRef.current = h.t;
    anomalyRef.current += r.kept;
    if (r.rep === h.text) continue;
    if (view.compositionStarted) {                                                 // D7 ①
      if (view.hasFocus) {                                                         // [v4 F2] 포커스 강탈 금지
        try { breakingRef.current = true; view.contentDOM.blur(); view.contentDOM.focus({ preventScroll: true }); }   // [v5 I5] 켜는 것도 try 안
        finally { breakingRef.current = false; }                                   // 실증 경로(C18 — view.focus()와 레코드 측면은 같다)
      }
      if (view.compositionStarted) {                                               // D7 ② 안전망
        view.contentDOM.dispatchEvent(new CompositionEvent('compositionend', { data: '', bubbles: true }));
        anomalyRef.current++;
      }
    }
    const still = view.state.doc.sliceString(h.from, h.to) === h.text;
    if (still) view.dispatch({ changes: { from: h.from, to: h.to, insert: '' }, selection: { anchor: h.from },
                               userEvent: 'input.type', annotations: mathAsciiTx.of(true) });      // D7 ③
    else { view.dispatch({ selection: { anchor: h.from } }); anomalyRef.current++; }               // D7 ⑤
    for (const c of r.rep) typeText(view, c);                                                       // D7 ④
    lastReplacedRef.current = { text: h.text, t: performance.now() };
    if (r.echo) anomalyRef.current++;
  }
  if (keysRef.current.length) schedule(40);
  if (anomalyRef.current === ANOMALY_WARN_AT && process.env.NODE_ENV !== 'production') console.warn('[Phase68a] 이상 상태 10건 — 짝 없는 키·메아리·범위 소실');
}
```

- `schedule(ms)`: 기존 타이머가 있으면 그대로(가장 이른 것만 산다) — reconcile이 끝나면 `timerRef = null`
- 리스너 셋(keydown · blur · focus, 전부 capture)은 `new EditorView`(`:1252`) 직후 `editorRef.current`에, 해제는 cleanup(`:1299`)에 — `clearTimeout(timerRef)`도 거기
- **(b) 폴백**(P14에서 (c)가 기각될 때만): `latexAutocompletion`에 `closeOnBlur: false` + `EditorView.domEventHandlers({ blur(e, view) { if (breakingRef.current) return false; const rt = e.relatedTarget as Node | null; if (rt && tooltipHost().contains(rt)) return false; setTimeout(() => { if (!view.hasFocus) closeCompletion(view); }, 10); return false; } })` — `closeCompletion`은 `@codemirror/autocomplete` export(`:2109`), `:9` import에 추가. 이 갈래에선 C17의 scrollLeft 복원이 살아 있으므로 끊기 전후로 `scrollDOM.scrollLeft`를 저장·복원한다(E9)
- `compositionstart/end` 리스너는 **두지 않는다**(실험 3 — `compositionStarted`만으로 충분)
- `[v4 H6]` `lastInsTRef` 초기값 0 · reconcile 머리에서 `timerRef = null`(위 코드) · cleanup(`:1299`)의 `clearTimeout(timerRef.current)`는 **view.destroy() 앞**에
- `[v5 I4]` `advanceQueue`의 매핑 산술(CM `ChangeSet` 없이): 변경은 옛 좌표 오름차순·비중첩이므로 항목마다 **자기보다 앞선 변경의 길이 차 누적**(`Σ (tb−fb)−(ta−fa)`)을 더한다. 경계 규칙 — 삽입이 `h.from`에 닿으면(`ta === h.from`, 순수 삽입) **뒤로 민다**(assoc +1), `h.to`에 닿으면(`fa === h.to`) **늘리지 않는다**(assoc −1). CM `mapPos`의 치환 경계 규칙(`state dist :736-760` — 치환 `[5,6)→'마'`는 assoc 무관 `[5,6)`)과 결과가 같다
- `mathAscii` prop은 `lineWrap` 자리(`:439` 시그니처 · `:161` 타입)에
- inputHandler(`:914`)는 **무변경** — 재생이 체인을 타므로 D19~D22가 그대로 발화한다(C12 — 조합이 끝난 뒤에만 재생한다는 D7 순서가 전제)

### 4-3. `EditorView.tsx` · `UnifiedToolbar.tsx` (D11) `[v3 명문화]`

- `EditorView.tsx`: `MATH_ASCII_KEY = 'mathory-editor-mathascii'` + `getStoredMathAscii/setStoredMathAscii`(B1 `:244-253` 꼴) · `const [mathAscii, setMathAscii] = useState(true); useEffect(() => setMathAscii(getStoredMathAscii()), [])`(`:1108` 옆) · `toggleMathAscii`(조합 가드 없음) · `<MarkdownEditor mathAscii={mathAscii}>` 두 자리(`:1012`·`:3994`) · 툴바 `mathAscii`·`onToggleMathAscii`(`:3771` 옆)
- `UnifiedToolbar.tsx`: props 2개(`:214` 옆) · 항목 `{ key: 'mathAscii', node: <IconButton title=… onClick={onToggleMathAscii} active={mathAscii}><MathAsciiIcon/></IconButton> }`를 `lineWrap` 항목 **앞**에 · `MathAsciiIcon`은 `toolbarIcons.tsx`에 `LineWrapIcon`과 같은 꼴(20px · `PH.keyboard`)
- `scripts/gen-phosphor-paths.mjs` ICONS에 `keyboard: ['keyboard', 'regular'],  // MathAsciiIcon (Phase 68a)` → `npm run icons:gen` → 62종

### 4-4. 테스트 `tests/mathAscii.test.mjs` (`test:mathascii`) `[v3 보강]`

- `usCharFor`: `KeyA` → `a`/`A`(shift)/`A`(caps)/`a`(shift+caps) · `Digit2` shift → `@` · `Backslash` → `\` · `Space` → null · `Numpad7` → `7`
- `classifyKey` — **실험 로그의 실제 값**: ⓐ Mac `{key:'ᅡ',code:'KeyF',keyCode:229}` → record `f` ⓑ Mac `{key:'ᆼ',code:'KeyA',keyCode:65}` → direct `a` ⓒ Mac `{key:'ᆻ',code:'Digit2',keyCode:50}` → direct `2` ⓓ Win `{key:'Process',code:'Comma',keyCode:229}` → record `,` ⓔ Win `{key:'Process',code:'Space'}` → pass ⓕ Mac 조합 중 `{key:'{',code:'BracketLeft',keyCode:229,isComposing:true,shiftKey:true}` → record `{` ⓖ 영문 IME `{key:'x',code:'KeyX',keyCode:88}` → latin ⓗ QWERTZ `{key:'z',code:'KeyY'}` → latin ⓘ `{key:'₩',code:'Backslash',keyCode:220}` → direct `\` ⓙ ctrl 조합 → pass ⓚ **`{key:'Dead',code:'Digit6',keyCode:229}` → pass · `{key:'Dead',code:'Digit6',keyCode:54}` → pass**(D3 ⓑ′ — v2에선 뒤의 것이 direct `6`이 됐다) ⓛ `{key:'HangulMode',code:'Lang1'}` → pass ⓜ `{key:'Process',code:'KeyA',keyCode:229,isComposing:false}` → record `a`(Windows 조합 첫 키)
- `pairInsertion`(시간 순): `'ㅁ'@10 + [i@5]` → `i` consumed 1 · **`'마'@10 + [f@5, k@8]` → `fk` consumed 2** · **`'닭'@10 + [e@2,k@4,f@6,r@8]` → `ekfr`** · `'ㅔ{'@10 + [c@5, {@8]` → `c{` · `','@10 + [,@5]` → `,` · `'ㅁ'@10 + [i@5, k@12]` → `i` consumed 1(**뒤 키는 안 먹는다**) · `'ㅏ'@10 + []`, now 20 → wait · `'ㅏ'@10 + [k@15]`, now 80 → `k` consumed 1(Safari) · `'ㅏ'@10 + []`, now 80, lastReplaced `{text:'ㅏ', t:0}` → echo · 같은데 lastReplaced `{text:'ㅁ'}` → kept 1 rep `ㅏ`(**메아리 아님**) · `'漢'@10 + [a@5]` → rep `漢` consumed 0(D5′ ⑤) · `'ㅁa'@10 + [i@5]` → `ia`? — **아니다**: 키가 하나뿐이라 rep = `i` + 남은 ASCII `a` 그대로 = `ia`. 규칙을 고정: rep = 키 US 글자 전부 + **키 없이 남은 비한글 글자**(한글만 사라진다)
- `dropKeysBefore([a@1,b@5,c@9], 5)` → `[c@9]` · `expireKeys` TTL 경계
- `[v5 I4]` `advanceQueue`: ⓐ 보류 `{ㅁ [5,6) t=10}` + 변경 `{fa:6,ta:6,fb:6,tb:7,ins:'{',qualifies:true}` → entries `[{ㅁ [5,6)}, {'{' [6,7)}]`(**to 불변**, I1) · dropKeysBeforeT null ⓑ 같은 보류 + `{fa:5,ta:6,fb:5,tb:6,ins:'마',qualifies:true}` → entries `[{마 [5,6) t=now}]` · dropKeysBeforeT **null**(키 보존, I2) ⓒ 같은 보류 + `{fa:5,ta:6,fb:5,tb:5,ins:''}`(Backspace) → entries `[]` · dropKeysBeforeT 10 ⓓ 보류 `[5,6)` + 앞쪽 삽입 `{fa:2,ta:2,fb:2,tb:4,ins:'ab',qualifies:false}` → `[7,8)` ⓔ 보류 `[5,6)` + 정확히 `from`에 삽입 `{fa:5,ta:5,fb:5,tb:6,ins:'x',qualifies:false}` → `[6,7)`(뒤로 민다) ⓕ 보류 둘 `[5,6)`·`[6,7)` + 첫째 삭제 `{fa:5,ta:6,fb:5,tb:5,ins:''}` → `[{… [5,6)}]`(둘째가 당겨진다) ⓖ 비자격 치환(`qualifies:false`, `ins:'y'`)으로 보류를 덮음 → 제거 + dropKeysBeforeT ⓗ `own` 재생 삽입 at 5 + 보류 `[5,6)`(인접 다음 항목 시나리오) → `[6,7)`
- `needsReplay`: `("ㅁ",'input.type.compose')` ✔ · `(",",'input.type.compose')` ✔ · `("x",'input.type')` ✘ · `("ㅁ",'input.paste')` ✘ · `("ㅏ",'input.type')` ✔(Safari) · `("한",undefined)` ✘(프로그램적)
- `isInTextArg`: `$\text{한|글}$` ✔ · `$\text{a}|$` ✘ · `$\textbf{|}$` ✔ · `$\mathrm{|}$` ✘ · 미닫힘 `$\text{한|` ✔ · `$\left\{|$` ✘(`\{`는 명령이 아니다)

### 4-5. headless 실측 (임시 라우트 `app/dev68a` + CDP, 검증 뒤 삭제) `[v3 보강]`

`Input.dispatchKeyEvent`(229/Process) + `Input.imeSetComposition`/`insertText`로 Mac 식·Safari 식·Windows 식을 재생한다(실험 3 엔진과 같은 순서). ⚠ **진짜 IME의 버퍼 리셋은 CDP로 못 본다** — §9-3 실물.

① Mac 식 `\frac{a}{b}` ② `^` 229 키 → `^{}`(D20 — 재생이 체인을 탄다) ③ `(a+b)/` → `\frac{a+b}{}` ④ 수식 밖 229 키 → 한글 그대로 ⑤ `\text{|}` 안 → 한글 그대로 ⑥ **자동완성 열린 채**(`\fr` 상태) 조합 글자 → 팝업 유지 + 옵션 갱신(D10′) ⑦ Tab 가드: 치환 뒤 `view.composing === false` ⑧ 토글 off → 한글 그대로 **그리고 큐가 비어 있다**(E13) ⑨ ⌘Z 1회 = 타자 그룹(삭제·재생 포함) ⑩ Safari 순서(insertText 먼저, keydown 뒤) ⑪ Windows 순서(ASCII `,` 조합) → `,` 1개, 재생 경로 ⑫ 메아리 시나리오(치환 50ms 안 **같은** 글자 재삽입) → 삭제 / **다른** 글자 → 보존 ⑬ **음절 형성**(`imeSetComposition 'ㅁ'` → yield 없이 `'마'`로 갱신 → 그 뒤 reconcile) → `fk`(E2) ⑭ Backspace로 보류 삽입 제거 → 그 키가 다음 삽입에 안 붙는다(D5′ ⑦) ⑮ 줄바꿈 끔 + 긴 수식 + 타자 → 끊기 전후 `scrollLeft` 불변(E9·D10′ ⓑ) ⑯ 끊기 중 `.cm-focused` 클래스 불변 · `handleBlockFocus` 호출 0(B5 — 스파이) ⑰ 재생 1글자당 `onChange` 호출 수 기록(G3 — 기대: 삭제 1 + 글자 수) ⑱ `[v4 H2]` **Phase 68 자리 보존** — `sq` Tab으로 `\sqrt{▢}` 자리가 활성인 채 한글 모드로 `x`(Mac 390 종성 = 직접 경로)와 `f`(조합 = 기록 경로) 입력 → `\sqrt{xf}` · `slotsField`가 살아 있고 Tab이 탈출 자리로 간다(삭제·재생의 `mapPos(-1)/(+1)` 규칙과 자리 매핑이 맞물리는지) ⑲ `[v4 H1]` ⑥에서 한글 순간 팝업 DOM에 `cm-tooltip-autocomplete-disabled`가 붙었다가 재질의 뒤 떨어진다(닫히지 않는다) ⑳ `[v5 I1]` **보류 중 인접 삽입** — `imeSetComposition 'ㅁ'` → reconcile 전에(yield 없이) `insertText '{'`(Mac 식 커밋+삽입) → 결과 `f{`(`fㅁ{` 아님) ㉑ `[v5 I2]` **조합 갱신** — `imeSetComposition 'ㅁ'` → yield 없이 `imeSetComposition '마'` → `fk`(⑬과 같되 **키 폐기가 없음**을 `keysRef` 스파이로 확인) ㉒ `[v5 I5]` 제목 입력에 포커스를 둔 채 reconcile을 강제 호출(조합 플래그 모사) → 그 뒤 편집창 클릭 → 밖 클릭 시 `.cm-focused`가 풀린다(`breakingRef` 누수 없음)

---

## 5. 위험 `[v3]`

| # | 위험 | 대응 |
|---|---|---|
| R1 | 끊기 순서가 바뀌면(치환 뒤 blur) `cm.composing` 고착 → Tab·Enter·후위 변환 전부 정지 | D7 순서 **불변식**(CLAUDE.md). 테스트 ⑦ |
| R2 | blur/focus 부수 효과 | D10′ capture 억제로 CM·자동완성은 **보지 못한다**. 남는 것은 브라우저 레벨(DOM 선택·IME) — D7 ③/⑤ dispatch가 선택을 되돌린다(`[v4 F1]`). B5·B6으로 React 레벨 0. 실물 §9-3 ③·⑥ |
| R3 | 짝 밀림 | 시간 순 소비(D5′)로 "키 1 ↔ 글자 1" 가정 자체를 없앴다. 남는 경우: 키 하나가 삽입 **0개**(IME가 삼킨 경우)면 그 키는 다음 삽입에 붙는다 → TTL 250ms 안 다음 글자 하나가 틀리고 복구된다. 이상 카운터(D12) |
| R4 | Safari 미실측 | §0-4 → §9-3 ⑬. 구조상(조합 없음) 더 단순 |
| R5 | 390 한글 모드가 ASCII 기호를 QWERTY와 다른 자리에서 낸다면 `latin`으로 통과 | 실측에선 `{`·`}`·`,`·`^`·`+` 모두 QWERTY 자리 |
| R6 | 타이핑 속도 > TTL(250ms) | 키 폐기 → 그 글자가 한글로 남는다. 재현되면 TTL 상향(시간 순 소비라 상향의 부작용은 R3뿐) |
| R7 | 수식 밖에서 조합 중 커서가 수식 안으로(←) | 삽입 위치(`fb`)로 판정 — 밖에서 시작한 조합 글자는 밖에 남고, 안에서 이어 치면 그때부터 치환 |
| R8 | iPad 가상 키보드(`code` 빈 문자열) | pass. 키 없는 한글 삽입은 **보존**(D5′ ③ — 메아리 조건이 "같은 글자 + 120ms"라 삭제되지 않는다, E15). 물리 키보드는 Safari 경로 |
| R9 `[v3]` | ~~`closeOnBlur:false` 회귀~~ — D10′ (c)에선 **발생하지 않는다**(설정 무변경). (b) 폴백에서만 유효 → 실물 ⑭ |
| R10 `[v3]` | capture `stopImmediatePropagation`이 **진짜** blur를 삼키면 CM이 포커스 상태를 잃는다 | `breakingRef`가 참인 **동기 구간**(blur()·focus() 호출 사이)에서만 — `try/finally`로 반드시 false. 테스트 ⑯ + §9-3 14 |
| R11 `[v3]` | 재생이 dispatch N+1회 → `onChange` N+1회 → EditorView 리렌더 | 한글 1자당 ≤ 5회(음절+후위 변환). 지금도 키 1 = dispatch 1이라 **같은 차수**. 합치면 E16이 깨진다 — 수용(P19) |
| R12 `[v3]` | 재생 중 사용자가 커서를 옮긴다(이론상) | reconcile은 setTimeout 0 — 사람 손보다 빠르다. `still` 검사가 범위를 확인하고 틀리면 ⑤ |
| R13 `[v4]` | 끊기가 **포커스를 되빼앗는다**(조합 직후 다른 입력으로 간 경우) | D7 ① `view.hasFocus` 가드(F2) · 실물 17 |
| R14 `[v4 → v5 철회]` | ~~`view.focus()`를 쓰면 blur 직후 DOM 변경 레코드가 소실~~ — `update()`가 매 dispatch에 `clear()`를 부르므로 두 경로가 같다(C18). 위험 아님 | `contentDOM.focus()` 유지(실증). CLAUDE.md에 금지로 적지 않는다 |
| R15 `[v5]` | `advanceQueue`의 수제 매핑이 CM `ChangeSet.mapPos`와 어긋난다 | 변경이 비중첩·오름차순이라 누적 산술로 충분. 경계 규칙 테스트 ⓐⓔ + CDP ⑳㉑이 실물 ChangeSet과 대조 |

---

## 6. 범위 밖

- **C안**(비밀번호 칸 포커스 프록시) — Mac에서 한글로 안 돌아온다(0-3). 기록만
- 댓글 `LatexInputEditor` · 폰(편집 없음 · EditContext 경로 C16) · 영문 자판 배열 설정 · 수식 밖 역방향 · `$$\begin{…}` (c) 형태 · `\mathrm`·`\operatorname` 안 한글(P9)
- 2벌식 음절 분해표 — **필요 없다**(D5′ 시간 순 소비). v2 §6의 "끊기가 매 자모마다 들어가 음절이 만들어지기 전에 치환된다"는 **보장이 아니다**(reconcile이 다음 keydown보다 늦을 수 있다 — E2) → 보장 대신 시간 순 소비가 흡수한다

---

## 7. 덕수 판정 (★ 권장)

| # | 질문 | 권장 |
|---|---|---|
| P1 | B안 확정(실험 3) | ★ 확정 |
| P2 `[v3 → P14로 이관]` | — | — |
| P3 | Windows ASCII 조합도 재생(D6 ⓑ — closeBrackets·후위 변환 파리티) | ★ 예 |
| P4 | 토글 위치 | ★ Row 2 버튼(줄바꿈 왼쪽) |
| P5 | 토글 단축키 | ★ 없음 |
| P6 | 아이콘 | ★ `keyboard`(core regular에 있음 확인) |
| P7 | 기본값 | ★ 켬 |
| P8 | 이상 카운터(D12) 노출 | ★ dev 콘솔만 |
| P9 | `\text` 10종(D13 목록) · `\mathrm`·`\operatorname` 제외 | ★ 그대로 |
| P10 | 라틴 자판 무접촉 | ★ 그대로 |
| P11 | Space | ★ 가로채지 않음 |
| P12 | 하니스 | ★ `app/dev68a` + CDP |
| **P13** `[v3]` | **짝짓기 모델** — (a) 시간 순 소비(D5′) / (b) v2의 글자 수 대응 + 자판별 음절 분해표 | ★ **(a)** — (b)는 2벌식·390·391 분해표가 셋 필요하고 사용자 자판을 알 길이 없다 |
| **P14** `[v3]` | **자동완성 보호** — (c) 래퍼 capture에서 우리 blur·focus를 `stopImmediatePropagation`(D10′) / (b) `closeOnBlur:false` + 자체 blur 핸들러 / (a) 팝업이 조합마다 닫혔다 열리는 것 수용 | ★ **(c)** — autocompletion 설정 무변경 · C17의 scrollLeft 복원까지 같이 막힌다 · 코드 3줄. (b)는 CM 조건 복제 + scrollLeft 저장/복원이 더 든다 |
| **P15** `[v3]` | **메아리 삭제 조건** — (a) "직전 치환으로 지운 글자와 **같다** + 120ms 안" / (b) v2의 "120ms 안이면 삭제" | ★ **(a)** — (b)는 iPad·키 미기록 경로의 **정당한 한글을 지운다**. 실험 2의 메아리는 전부 같은 글자였다 |
| **P16** `[v3 → v4 → v5 I6 근거 교체]` | **포커스 복귀** — (a) `view.focus()` / (b) `contentDOM.focus({preventScroll:true})`(실험 3 그대로) | ★ **(b)** — **실증된 경로라서**. v4의 "레코드 소실" 논거는 틀렸다(`update()`가 매 dispatch에 `clear()` — 둘 다 같다, C18). 차이는 `updateSelection`뿐이고 D7 ③/⑤ dispatch가 그 몫을 한다 |
| **P17** `[v3]` | 한글 범위 확장(확장 자모 A/B · 반각) | ★ 포함 — 비용 0 |
| **P18** `[v3]` | 비한글 비ASCII(한자 변환·전각 기호) | ★ 무접촉 + 키 소비 0(D5′ ⑤) |
| **P19** `[v3]` | 재생의 dispatch N+1회 수용(R11) | ★ 수용 — 합치면 D22가 한글을 `\left…\right`로 감싼다(E16) |
| **P20** `[v3]` | EditContext(Android 전용, C16) | ★ 범위 밖 — 폰 편집이 없다. CLAUDE.md에 사실만 |
| **P21** `[v3]` | 프로브 2·3 HTML — 레포에 없다 | ★ 덕수가 `docs/phaseSketch/phase68a-ime-probe2.html`·`-probe3.html`로 넣어 주면 S4에서 보관 |
| **P22** `[v3]` | 이상 카운터 문턱 | ★ 10 |
| **P23** `[v4]` | 한글 모드 타자 중 자동완성이 글자마다 ~100ms **disabled 톤**(C22) — (a) 수용 / (b) `activateOnTypingDelay`를 20~30으로(영문 타자에도 적용 — 질의가 잦아지지만 소스는 동기·경량) | ★ **(a)** — 선택 행 배경 톤만 바뀐다. 실물 §9-3 3에서 거슬리면 (b)로 한 줄 |
| **P24** `[v4]` | reconcile 1차를 `setTimeout 0` 대신 `queueMicrotask`(updateListener 직후 · 페인트 전 보장) — (a) `setTimeout 0` 유지(실험 3 실증, 깜빡임 없음) / (b) microtask | ★ **(a)** — 실증된 경로. 깜빡임이 보고되면 (b)로 한 줄(Safari 대기 재시도는 어차피 타이머) |
| **P25** `[v5]` | 큐 관리(겹침·키 폐기·매핑)를 — (a) `lib/mathAscii.advanceQueue` 순수 함수 + `test:mathascii` 8표본 / (b) v4처럼 `MarkdownEditor` 안 인라인 | ★ **(a)** — v3·v4가 같은 자리에서 **세 판본 연속** 틀렸다(I1~I3). CM 없이 산술로 검증되는 곳은 lib로 |

---

## 8. 작업 순서

| Stage | 누가 | 내용 | 완료 조건 |
|---|---|---|---|
| S1 | CLI | `lib/mathAscii.ts` + `tests/mathAscii.test.mjs` + `package.json test:mathascii` | §4-4 전부 · 기존 23종 566건 무회귀 |
| S2 | CLI | `MarkdownEditor` 배선(D4~D10′ · prop · `advanceQueue` 호출) | §4-5 ①~㉒ |
| S3 | CLI | 토글(D11 — EditorView·UnifiedToolbar·toolbarIcons) + `keyboard` 아이콘(62종 · `icons:check` 통과) | §4-5 ⑧ · 버튼 2상태 |
| S4 | CLI | CLAUDE.md(D15) · roadmap · `docs/phasedocs/` 확정본 · 프로브 3종 보관(P21) · `app/dev68a` 삭제 | — |
| S5 | 덕수 | 실물 검수 §9-3 (Mac Chrome 390 → 2벌식 → Safari → Windows) | — |

---

## 9. 검증

### 9-1. 자동 — `test:mathascii` + 회귀 `test:mathinput`·`mathslots`·`tidy`·`mathregions`·`invisibles`(계 24종)

### 9-2. headless CDP — §4-5 ①~㉒

### 9-3. 실물 (한/영 키 금지)
1. Mac Chrome · 390: `$` 버튼 → `\frac{a}{b}, x^2+1` → Tab → 한글 문장 → 수식 안 영문·밖 한글, 깜빡임 없음(실험 3 재현)
2. `x^2` → `x^{2}` · `(a+b)/` → `\frac{a+b}{}` — **한글 모드에서도** 영문 모드와 같은 결과
3. `\fr` → 자동완성 팝업이 **살아 있고** 글자마다 좁혀지며 ↓·Enter로 수락
4. `sin` ←← `co` 중간 삽입 · Backspace가 자모 단위가 아니라 **영문 한 글자** 삭제
5. `$\text{` 안에서 한글 · `}` 뒤에서 영문
6. 줄바꿈 끔 모드 긴 수식 — 가로 중앙 추적이 **되돌아가지 않는다**(C17)
7. 토글 off/on · 새로고침 유지
8. ⌘Z 1회 = 타자 묶음 · ⌘⇧Z
9. 영문 IME로 바꿔 같은 입력 → 바이트 동일(inert)
10. 수식 밖에서 `\` → `₩`(현행 그대로 확인)
11. 30초간 **최대 속도** 타자(`\sum_{k=1}^{n} k^{2}` 반복) — 이상 카운터 0 · 음절이 섞여 들어와도 결과 동일(E2)
12. **2벌식**으로 전환해 1·2·4·11 반복
13. **Safari**: 1·3·4
14. 편집창 밖 클릭 → 자동완성 팝업이 닫히고 `.cm-focused`가 풀린다(R10 — 진짜 blur는 삼키지 않는다)
15. Windows Chrome(한글): 1·2·3 — `(`가 조합으로 들어와도 `()` 자동 닫힘(D6 ⓑ)
16. `[v4 H2]` `sq` Tab → 자리 안에서 한글 모드 `x+1` → Tab이 탈출 자리로(Phase 68 자리 보존)
17. `[v4 F2]` 한글 모드로 자모 하나 친 **직후**(수 ms 안) 제목 입력을 클릭 — 포커스가 편집창으로 되돌아오지 않는다
18. `[v5 I1]` 최대 속도로 `\frac{a}{b}` 반복 — `{` 앞 글자가 한글로 남거나 **두 벌**(`fㅁ{`)이 되는 일이 없다

---

## 10. 커밋 지침

- Stage별 1커밋, `feat(phase68a):` / `docs(phase68a):` · CLI는 커밋까지, push는 덕수
- 착수 시 HEAD가 `42dc261`보다 앞서 있으면 §1 줄 번호 재실측
- 임시 라우트 `app/dev68a`는 검증 뒤 삭제(dev 서버가 도는 동안은 삭제하지 말 것 — 메모리 규약)

---

## 부록 A. 프로브 3종 (전부 단일 HTML · 네트워크 0)

| 파일 | 용도 | 결과 | 레포 |
|---|---|---|---|
| `phase68a-ime-probe.html` | A안 성립 여부 · `key`/`keyCode` 실측 | 4환경 전부 불성립(0-2) | ✔ `docs/phaseSketch/` |
| `phase68a-ime-probe2.html` | CM 내장 B안(치환 → blur) · C안 | 끊기 필요 확정 · compositionend 부재 · C안 폐기(0-3) | ✘ 없음(P21) |
| `phase68a-ime-probe3.html` | B안 v3(blur → 삭제 → 재생) + Tab 가드 | **성립**(0-1) — §4-2의 원형 | ✘ 없음(P21) |

⚠ 프로브의 US 표에는 Space가 있고 본체(D3 ⓑ)에는 없다 — 프로브는 textarea/독립 CM이라 IME 확정 문제가 없었다.

## 부록 B. v2 → v3 정정·보완 요약

| # | 종류 | 내용 | 반영 |
|---|---|---|---|
| E1 | 정정 | v1·프로브 2·3이 레포에 없다 — v2가 참조로 떠넘긴 사양을 본문에 복원 | 머리말 · §1 · D2 · D11 · D13 · §4-1 US 표 · §4-3 |
| E2 | 정정 | D5 "한글 1글자 = 키 1개"는 음절 형성(reconcile 지연)에서 깨진다 — 자판별 분해표가 필요해지는 길 | D5′ 시간 순 소비 · 테스트 `마`·`닭` · CDP ⑬ · P13 |
| E3 | 보완 | EditContext는 Android 전용(C16) — 합성 compositionend가 데스크톱에서 유효한 조건 | C16 · D7 ② · P20 |
| E4 | 정정 | §4-2 ② updateListener가 **매핑 전에** 조기 반환 — 우리 삭제·재생·Phase 68 2차 dispatch가 보류 삽입의 좌표를 밀어 `still` 검사가 어긋난다 | §4-2 ② "매핑 → 분기" · undo/redo는 큐 비움 |
| E5 | 정정 | D10 `closeOnBlur:false`보다 **우리 blur·focus를 CM이 못 보게** 하는 쪽이 작고 안전(C11 ①·C17 둘 다 막힌다) · ~~포커스 복귀는 `view.focus()`(C18)~~ → **v4 F1에서 `contentDOM.focus()`로 되돌림** | D10′ · P14 · P16 · R9 삭제 |
| E6 | 정정 | D3에 `Dead`·`HangulMode` 등 길이>1 키 갈래가 없어 `Dead`가 `direct`로 떨어진다(v2 테스트 ⓚ와 사양 불일치) | D3 ⓑ′ · 테스트 ⓚⓛⓜ |
| E7 | 정정 | 한글·ASCII 밖의 글자(한자·전각) 갈래 미정의 | D5′ ⑤ · P18 |
| E8 | 보완 | 블록 `onFocus`는 `onClick`(EV `:993`) — 끊기가 `handleBlockFocus`를 안 부른다 | B5 · B6 · CDP ⑯ |
| E9 | 보완 | `observers.focus`의 `lastScrollLeft` 복원(C17) — 끔 모드 가로 추적 되돌림 위험 | D10′ ⓑ · (b) 폴백의 저장/복원 · CDP ⑮ · 실물 6 |
| E10 | 보완 | history 병합 규칙 실측(C20 — compose는 항상 병합) | D9 |
| E11 | 보완 | C21 — 재생 직후 50ms 안 CM 삽입이 `.compose`로 찍힐 수 있으나 우리 트랜잭션은 자체 userEvent | C21 |
| E12 | 보완 | C15 — 조합 첫 keydown은 CM keymap에 닿는다(바인딩 충돌 없음 확인) | C15 |
| E13 | 정정 | 토글 off 게이트가 keydown에만 — updateListener도 게이트 | D6 · CDP ⑧ |
| E14 | 정정 | Backspace로 보류 삽입이 사라진 뒤 그 키가 다음 삽입에 붙는다 | D5′ ⑦ · `dropKeysBefore` · CDP ⑭ |
| E15 | 정정 | 메아리 삭제가 "120ms 안이면"이라 정당한 한글(iPad·키 미기록)을 지운다 | D5′ ③ · P15 · R8 |
| E16 | 보완 | 삭제·재생을 한 트랜잭션으로 합치면 D22·closeBrackets가 한글을 감싼다 — 불변식으로 | D7 · A3 · P19 |
| E17 | 보완 | `typeText`의 `insert`는 Transaction을 돌려줘야 한다(Phase 68 핸들러가 `dispatch(insert())`) | §4-2 typeText |
| G1 | 보완 | US 표에 숫자패드·IntlBackslash | §4-1 |
| G2 | 보완 | 테스트 표본 추가(음절·Safari·메아리 양성/음성·한자·Dead·drop) | §4-4 |
| G3 | 보완 | 재생 1자 = dispatch N+1 = onChange N+1 — 차수 동일, 수용 | R11 · P19 · CDP ⑰ |
| G4 | 보완 | 부수 이득 — 수식 안 한글 IME 타자 중 린터·하이라이트·줄바꿈 토글·하단 재정렬의 `composing` 가드가 더는 멈추지 않는다 | A7 |
| G5 | 보완 | capture 억제의 자기 함정(R10) — `try/finally` + 실물 14 | R10 · §9-3 14 |
| G6 | 보완 | D11 토글은 조합 가드 불필요(Compartment 없음) | D11 |
| G7 | 보완 | `isInTextArg`가 `\left\{`를 명령 인자로 오인하지 않는지 테스트 | §4-4 |
| G8 | 보완 | dev 서버 중 `app/dev68a` 삭제 금지 | §10 |

## 부록 C. v3 → v4 정정·보완 요약 `[v4]`

v3의 실측 인용(ME·EV·UT·dist 줄 번호 32곳)을 origin/main `42dc261`과 dist에 대조 — **전부 일치**. E1~E17·G1~G8 전부 수용. 추가분:

| # | 종류 | 내용 | 반영 |
|---|---|---|---|
| F1 | 정정 | D7 ①·P16의 `view.focus()`는 `observer.ignore()` → `clear()`가 blur 직후 대기 DOM 레코드를 버린다(dist `:7168-7179`·`:7197-7200`). 실험 3이 실증한 `contentDOM.focus({preventScroll:true})`로 되돌린다 — **`[v5 I6]` 근거 철회**(`update()`도 `clear()`), 결정만 유지 | C18 · D7 · D10′ · §4-2 · P16 · R14 · D15 |
| F2 | 정정 | 끊기는 `view.hasFocus`일 때만 — 아니면 포커스를 되빼앗는다 | D7 ① · §4-2 · R13 · 실물 17 |
| F3 | 정정 | 머리말·다음 단계(v4 = 착수판) | 머리말 |
| F4 | 정정 | §4-2 ② 의사코드의 미정의 `isOwn` — 우리 삭제는 큐에서 shift한 뒤 dispatch하므로 자기 항목 충돌이 없다 | §4-2 ② |
| H1 | 보완 | 자동완성은 한글 순간 **닫히지 않고 disabled**(C22 실측) — (c)가 막는 것은 blur 닫힘뿐. ~100ms disabled 톤은 수용 | C22 · D10′ · P23 · CDP ⑲ |
| H2 | 보완 | Phase 68 `slotsField` 자리 안에서의 삭제·재생 — 자리 매핑 보존 검사 | CDP ⑱ · 실물 16 |
| H3 | 보완 | 재생이 일으키는 2차 트랜잭션(D20 `{}` · D19 · closeBrackets)이 `needsReplay`에서 자연히 걸러진다 — 명시 | D6 |
| H4 | 보완 | reconcile 타이머가 블록 언마운트 뒤 발화 — `viewRef` 가드 + cleanup `clearTimeout`을 `destroy()` 앞에 | §4-2 reconcile · H6 |
| H5 | 보완 | history: `input.type.compose`는 항상 병합이지만 **`.compose.start`는 예외**(commands `:484-489` 주석) — 첫 자모는 500ms 규칙 = 일반 타자와 동일. D9 결론 불변 | C20 |
| H6 | 보완 | `lastInsTRef` 초기값 · `timerRef` 초기화 위치 | §4-2 |
| H7 | 보완 | P24 — reconcile 1차 microtask 대안을 기록(채택 안 함) | P24 |
| H8 | 보완 | 프로브 2·3 HTML은 web이 이미 덕수에게 전달한 파일(`phase68a-ime-probe2.html`·`-probe3.html`) — P21 그대로(덕수가 `docs/phaseSketch/`에 복사) | 부록 A |

## 부록 D. v4 → v5 정정·보완 요약 `[v5]`

v4의 인용(C22 자동완성 disabled 경로 · H5 `.compose.start` 예외 · F2·F4·H1~H8)을 HEAD `42dc261`·dist에 대조 — 일치. 추가분:

| # | 종류 | 내용 | 반영 |
|---|---|---|---|
| I1 | 정정 | §4-2 ② 보류 삽입 매핑이 CM 기본 assoc(from −1 · to +1)이라 **`to`에 닿는 삽입이 범위를 늘린다** — 보류 `ㅁ[5,6)` 뒤 `{`@6 → `[5,7)` → `still` 실패 → ⑤ 폴백 → `fㅁ{`. 안쪽 결합(from +1 · to −1)으로 | §4-1 `advanceQueue` · §4-2 · 테스트 ⓐⓔ · CDP ⑳ · 실물 18 · D15 |
| I2 | 정정 | 겹침이면 무조건 키 폐기 → 조합 **갱신**(`ㅁ`→`마`, CM은 `[5,6)→'마'` 치환으로 보고)이 Backspace와 같이 취급돼 `f`가 버려진다. 키 폐기는 **순수 삭제·비자격 치환**에서만 | `advanceQueue` ② · 테스트 ⓑⓒⓖ · CDP ㉑ |
| I3 | 정정 | 매핑을 먼저 하고 옛 좌표(`fa`·`ta`)로 겹침을 쟀다 — 좌표계 불일치. 겹침 판정 → 제거 → 매핑 → 추가 순서로 | `advanceQueue` ①~④ |
| I4 | 보완 | 큐 관리를 순수 함수로 lib에 — CM 없이 산술로 검증(8표본). v3·v4가 같은 자리에서 세 판본 연속 틀린 곳 | §4-1 · §4-4 · P25 · R15 |
| I5 | 정정 | reconcile 의사코드가 `breakingRef = true`를 `hasFocus` 가드 **밖**에서 켜고 가드가 거짓이면 끄지 않는다 → 다음 진짜 blur를 삼킨다(R10 자기 함정) | D7 ① · §4-2 reconcile · CDP ㉒ |
| I6 | 정정 | F1의 근거 "`view.focus()`만 레코드를 잃는다" — `view.update()`가 비-Android 경로에서 **매 dispatch마다 `observer.clear()`**(`:7834`)라 D7 ③이 같은 레코드를 버린다. 결정 (b)는 실증 경로로 유지, CLAUDE.md의 "금지" 문구는 삭제 | C18 · D7 · D15 · P16 · R14 · 부록 C F1 |
| J1 | 보완 | `compositionend`의 flush는 대기 레코드가 있을 때 **마이크로태스크**(`:5151-5158`) — 동기 reconcile 안에서는 어느 focus 경로든 flush 전에 ③이 돈다 | C18 |
| J2 | 보완 | CM `mapPos` 치환 경계 실측(`state :736-760`) — `[5,6)→'마'`는 assoc 무관 `[5,6)`. 수제 매핑의 대조 기준 | §4-2 bullet · R15 |
| J3 | 보완 | §9-3 번호 순서(15·16·17) 정리 + 18 추가 | §9-3 |
| J4 | 보완 | S2 완료 조건 ①~㉒ | §8 |
| J5 | 보완 | D15에 "안쪽 결합은 `mathSlots`의 바깥 결합과 반대이며 의도" — 통일하고 싶어지는 자리 | D15 |

---

## 11. 구현 기록 `[CLI · 2026-10-08]` — 커밋 S1 `20dc47b` · S2 `108e1e3` · S3 `e465777` · S4(docs)

### 11-1. 계획과 달라진 것 (전부 CDP 실측에서 나왔다)

| # | 발견 | 처방 |
|---|---|---|
| K1 | **동기 조합은 CM이 체인을 이미 태운다** — compositionend가 CM flush보다 먼저 오면(Windows식 ASCII `^`·`(`·`/`, Mac의 조합 중 `{`) flush 때 `composing=-1`이라 Mathory 가드(`!view.composing`)·closeBrackets(`compositionStarted`)가 **통과**해 IME 글자에 대해 D20·closeBrackets가 돈다. 그 위에 D6 ⓑ대로 재생하면 **이중 적용**(실측: `^{}`가 두 번 돌아 커서가 `^|{}`에 남았다 — 두 번째 `^`는 다음 글자가 `{`라 D20이 붙지 않는다) | `needsReplay(text, ue, compositionLive)` — ASCII 조합은 **그 업데이트 때 `u.view.compositionStarted`가 참일 때만** 재생(조합이 살아 있던 flush = 체인이 건너뛴 flush). 한글은 live 무관 |
| K2 | **체인이 넣은 글자의 키가 고아로 남는다** — K1의 `(`→`()`·`{`→`{}`는 재생 대상이 아니라 기록 키 `(`·`{`가 큐에 남고, TTL 250ms 안의 다음 한글 삽입에 **앞에 붙는다**(실측 `(a`) | `consumeTypedKeys` — 재생하지 않은 삽입(우리 것 아님)이 큐 머리 키와 **같은 글자로 시작**하면 그 키 하나를 소비 |
| K3 | `rep === text`인 ASCII 조합(Windows `,`)도 체인을 태워야 영문 IME와 같다(D6 ⓑ) — v5 의사코드는 `continue` | `PairResult.replay` — `rep !== text` 또는 "키와 짝지어진 ASCII 조합"이면 참. reconcile은 `!r.replay`에서만 건너뛴다 |
| K4 | **CDP `Input.imeSetComposition`·keyCode 229 keyDown이 headless Mac Chrome의 브라우저 프로세스를 멎게 한다**(98% CPU · 1.4GB · 두 번째 조합부터, 렌더러는 멀쩡) | 조합·229 키는 하니스 페이지 안에서 합성(DOM 변이 + composition 이벤트 + 합성 KeyboardEvent)으로, latin 키·Tab·⌘Z·직접 경로 1건만 CDP 신뢰 이벤트로. 브라우저에 진짜 조합이 없어 blur가 compositionend를 내지 않는다 → 엔진의 합성 compositionend 안전망이 대신 돌았다(실험 3이 실기기에서 "blur → 진짜 compositionend"를 실증했고, 그 부분은 §9-3 실물 몫) |
| K5 | 하니스의 `__ime.start()` 뒤 `commit()`이 reconcile **뒤**에 와 옛 텍스트 노드 오프셋에 `replaceData`를 해 `$`를 덮어썼다(`$x,,`) — 실제 Windows IME는 start→commit이 한 이벤트 안에서 동기 | `__ime.type()`(동기 조합) + commit 방어. **엔진 결함이 아니다** |
| K6 | `$$`만 둔 문서에서 커서 1은 수식 **밖**이다 — R-$$ (a) 미닫힘 display 펜스(`innerFrom 2`) | 하니스 표본은 `본문 $$ 끝`(빈 인라인 쌍 (c)) · `$x$` |
| K7 | `$x$`에서 `(`는 영문 IME도 `()`가 안 된다 — closeBrackets `before` 규칙(다음 글자가 `$`) | 표본 `$x $` |
| K8 `[실물 검수 1차 · 2026-10-08]` | **`$` 버튼이 넣은 행 끝 `$\|$`에서 첫 글자만 한글로 남았다**(덕수: `함수 $ㅏ(x)$`). keydown의 영역 판정이 스캐너 R-$$ (a)에 걸려 `$$`+빈 행 나머지를 display 펜스로 읽어 커서를 "밖"으로 봤다 → 첫 키 미기록 → 글자가 들어간 뒤엔 `$ㅏ$`가 인라인이라 둘째 키부터 치환. 하니스 K6와 같은 함정을 **엔진 쪽**이 밟고 있었다 | keydown 판정을 **삽입 뒤의 문서**로(`probeInsertionRegion` — 글자 하나를 넣어 본 문서에서 `mathRegionAt(pos)`). updateListener가 삽입 시작 `fb`에서 판정하는 것과 기준이 같아진다. `test:mathascii` 32 · CDP ㉕(행 끝 `$\|$` · 아래 줄 있음 · 펜스 행 끝은 여전히 밖) |

### 11-2. 검증

- `test:mathascii` **32건**(계획 30 + `consumeTypedKeys` + `probeInsertionRegion`) · 로직 테스트 **24종 598건**(23종 566 + 32) · `tsc --noEmit` 무오류 · `icons:check` 62종
- headless Chrome CDP **29/29**(검수 후속 ㉕ 3건 포함): ① Mac식 `\frac{a}{b}`(₩ 직접 경로 = 신뢰 keydown preventDefault 포함) ② `^`→`^{}` 커서 안 ③ `(a+b)/`→`\frac{a+b}{}` ④ 수식 밖 보존 ⑤ `\text{}` 안 보존 ⑥⑲ 자동완성 열린 채 조합 → disabled → 재질의(닫히지 않음) ⑦ `composing=false` ⑧ 토글 off ⑨ ⌘Z 1회 ⑩ Safari 순서 ⑪ Windows `,` ⑫ 메아리 삭제/보존 ⑬ 음절 `마`→`ak`(키 보존) ⑭ Backspace 고아 키 ⑮ 끔 모드 scrollLeft · Windows `(`→`()` ⑯/㉒ 포커스 유지·밖이면 풀림 ⑰ onChange 3회 ⑱ 자리 안 재생 + Tab 탈출 ⑳ 보류 뒤 인접 `{`(안쪽 결합) ㉓ 동기 `(` 직후 한글 `(a)` ㉔ 조합 중 `{` 뒤 한글이 `{}` 안에 ㉕ 행 끝 `$|$`의 첫 글자(K8) · 줄 끝 `$|$` · 펜스 행 끝은 보존
- 임시 라우트 `app/dev68a` 삭제(dev 종료 뒤) · 프로브 3종은 `docs/phaseSketch/phase68a-ime-probe{,2,3}.html`

### 11-3. 알고 두는 것

- Windows Chrome·Safari 실기기 미실측(§0-4 → §9-3 13·15). K1의 "동기/비동기 조합" 두 갈래를 다 받도록 했으므로 어느 쪽이든 동작하되, 실기기에서 **어느 갈래로 오는지**를 적어 둘 것
- 한글 모드 타자 중 자동완성은 글자마다 ~100ms disabled 톤(C22 · P23 (a) 수용)
- 재생 1자 = dispatch 3회(조합·삭제·재생) = onChange 3회 — 키 1 = dispatch 1인 현행과 같은 차수(P19)
