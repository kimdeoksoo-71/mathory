# Phase 68c 한국어 IME 안전 트리거 층·스마트 붙여넣기 구현 계획서 v2

- 작성: CLI Claude · 2026-10-09 — v1(web, `fbe6eac` 기준)을 **HEAD `4283b69`**(68b 윈도우 검수 종결 커밋)에서 전수 재실측해 교차검토. CodeMirror `@codemirror/view 6.39.14` dist 대조 · `lib/math-symbols.ts`를 컴파일해 집계 · npm 실측
- 계보: 카탈로그 v1 우선순위 3·4 → v1 web → **v2 CLI 교차검토(이 문서)** → v3 web 재검증 착수판
- v1 → v2 차이: **정정 18건(부록 A E1~E18) · 보완 20건(부록 B G1~G20) · 결정 항목 14 → 25(§7 P1~P14 개정 + Q1~Q11 신설)**. 본문은 정정·보완을 반영한 완성형이고, 부록이 "무엇이 왜 바뀌었나"를 든다
- 관계: 68(Tab·스니펫)·68a(자동 영문)·68b(수식 단축키)가 편집창 **안**의 IME 안전을 거의 다 세웠다(§1-A). 68c는 ① 그 **바깥**(window 단축키·React 입력창·핸들)의 구멍 ② 붙여넣기. 코드 접점은 `lib/math-editor-extensions.ts`(두 편집기 공용 — 작업 규칙 9)와 `MarkdownEditor`·`LatexInputEditor`·`EditorView`·React 입력창 15곳

---

## 0. 요약

| 묶음 | 지금 (HEAD `4283b69`) | 68c 뒤 |
|---|---|---|
| **A. IME 안전** — 편집창 안 | Tab·Shift+Tab·행 Enter·후위 변환·closeBrackets·린터·하이라이트·줄바꿈 토글·하단 재정렬·Ctrl+M 계열(`composingRescue`)·**수식 명령 직전 `flushMathAscii`** 전부 가드됨(68·68a·68b + 윈도우 검수 후속 `667596e`) | 무변경 |
| A — window 단축키 | `⌘F`·`⌘B`·`⌘J`가 **`e.key`** 비교(한글 모드에서 `ㅠ`·`ㅓ`로 와 죽을 수 있다 — 68b가 `Ctrl-m`에서 `ㅡ`를 실측) · `⌘⇧B`·`⌘⌥B` 암묵 배제가 `e.code`로 바꾸면 풀린다 · 조합 중 발화 가드 0 | 셋 다 `e.code` + `!shift·!alt·!repeat` · 문서를 바꾸는 셋(`⌘B`·`⌘J`·`⌘⇧L`)은 **조합이 끝난 뒤 실행**(68b `composingRescue`와 같은 모델 — 공용 헬퍼로 뽑는다) |
| A — 편집기 핸들 | `MarkdownEditor` 삽입 핸들 5 + **`LatexInputEditor.insertAtCursor`**(댓글 OCR·그림·툴바) 조합 가드 0. 툴바 클릭은 Chrome에선 포커스 이동이 조합을 먼저 확정하지만 **Safari/macOS는 버튼 클릭이 포커스를 옮기지 않는다** → 조합 중 호출이 실재 | 핸들 진입에서 `commitComposition(view)` = 끊기(blur→focus) + **`flushMathAscii`** |
| A — React 입력창 Enter | 가드 없음 **9곳** · 가드 있음 6곳(그중 5곳이 `nativeEvent.isComposing`만 — Safari 꼬리 keydown(229·`isComposing:false`)을 못 거른다) | 공용 `isImeKey(e)` 한 줄로 15곳 통일 |
| **B. 스마트 붙여넣기** | `stripInvisibles`만(편집창) · 댓글 입력창은 필터 0 | + 구분자 정규화(`\(`→`$` · `\[`→**펜스형** `$$`) · 수식 안 유니코드→LaTeX(표 443 + 보정 — `≠`·`⋯`·`·`·`″`·`√`·`°`는 표에 없거나 다른 명령이라 보정이 덮는다) · 전각→ASCII(수식 안) · **HTML 클립보드 `<math>` annotation → LaTeX**(KaTeX·MathJax·위키·ChatGPT·Mathory 미리보기 — Mathory 것은 61c `stripPreviewArtifacts`로 전처리 흔적 제거) · 두 편집기 같은 확장 |

**서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 규약 0(정본으로 수렴시키는 변환) · 렌더 5사이트 0 · 폰 0 · 아이콘 0 · localStorage 0.** 신규 `lib/imeKey.ts`·`lib/mathPaste.ts`(순수) + 테스트 2 · 수정 약 16파일 · 의존성 +1 선택(P9).

---

## 1. 선행 확인 — 실측 (HEAD `4283b69`)

### 1-A. 이미 안전한 것 (무접촉)

| # | 사실 | 위치 |
|---|---|---|
| A1 | CM keymap `run`은 조합 중(`composing > 0`) 도달하지 않는다(`ignoreDuringComposition` — **키 이벤트만**, `event.synthetic`은 예외) | view dist `:4544-4560` · `math-editor-extensions.ts:30` |
| A2 | 조합 중 Ctrl+M 계열은 `composingRescue`가 **blur 없이** compositionend를 기다렸다가(20ms 폴링 · 800ms 포기 · 윈도우 순서 60ms 갈래) 실행 | `math-editor-extensions.ts:283-347` |
| A3 | `mathTabCommand`·`mathShiftTabCommand` `if (view.composing) return true` · `rowEnterCommand` 조합·완성 열림 가드 · 수식 명령 전부 머리에 `flushMathAscii(view)`(`667596e`) | `:220` · `:256` · `:673` · flush `:393` |
| A4 | `createMathInput` inputHandler — 변환은 `!view.composing` 안에서만 | `:565-576` |
| A5 | 68a `createMathAscii` — 끊기(blur→focus) 순서 불변식 · `breaking` try 구간 · view.dom capture 억제 | `:397-545`(끊기 `:502-510` · 억제 `:439`) |
| A6 | 린터 조합 중 직전 진단 반환 · 하이라이트 `composing` 가드 | `MarkdownEditor.tsx:258-275` · `lib/latex-highlight.ts:107` |
| A7 | `toggleLineWrap` 조합 중 무시 · 하단 재정렬 `ref.isComposing()` 가드 · 핸들 `isComposing()` | `EditorView.tsx:1311` · `:2343` · `MarkdownEditor.tsx:208`·`:463` |
| A8 | 툴바 버튼 `onMouseDown` 0건(UnifiedToolbar·MathSymbolPalette·BlockBottomToolbar) → **Chrome·Edge·Firefox**는 클릭이 포커스를 버튼으로 옮겨 조합이 먼저 확정된다. ⚠ **Safari/macOS는 버튼 클릭이 포커스를 옮기지 않는다**(플랫폼 규약) → 조합 중 핸들 호출이 **실재**(E9) | — |
| A9 | CM `handlers.paste`는 `view.observer.flush()` 뒤 **text/plain(없으면 text/uri-list)만** 읽어 `doPaste` → `clipboardInputFilter(text, state)` → `userEvent 'input.paste'`. **drop도 같은 필터**(`dropText`) | dist `:5017-5027` · `:4797-4826` · `:4966-4983` |
| A10 | 플러그인 `domEventHandlers`는 내장보다 **먼저** 돌고(`computeHandlers`가 플러그인 뒤에 내장을 붙인다) `true`면 `preventDefault` + 중단 | dist `:4466-4478` · `:4590-4614` |
| A11 | React 입력창 중 가드 있음 6곳: `DialogHost.tsx:113` · `NicknameSetupModal.tsx:82` · `VersionDrawer.tsx:267` · `CommentPanel.tsx:1392·1426`(`nativeEvent.isComposing`) · `FolderView.tsx:338`(document keydown 행 Enter 진입 — 네이티브 `e.isComposing`, 입력창 아님) | — |
| A12 | CM은 **조합 중에도** compositionupdate마다 문서를 반영한다 — 68a reconcile의 `still` 검사(`doc.sliceString(h.from,h.to) === h.text`)가 그 전제. compositionend 관찰자는 동기(`composing = -1`), 남은 변경 flush는 microtask. `view.observer`는 **d.ts에 없다**(internal) — 동기 flush를 우리가 부를 수는 없다 | dist `:5145-5160` · `index.d.ts`(observer 0건 · `compositionStarted:778`) |
| A13 | 미리보기·인쇄는 렌더 시 `\(…\)`→`$…$`·`\[…\]`→`$$…$$`를 **이미 변환**한다 | `EditorPreview.tsx:198-199` · `lib/preprocess.ts:134-137` |

### 1-B. 구멍 — IME

| # | 사실 | 위치 | 68c |
|---|---|---|---|
| B1 | window keydown: `⌥Z`·`⌘Z`·`⌘C/V`·`⌘⇧L`은 `e.code`, **`⌘F`(`e.key==='f'`) · `⌘B`(`'b'`) · `⌘J`(`'j'`)** 는 `e.key`. `isComposing`·229 검사 0. ⚠ 옛 `'b'` 비교는 Shift면 `'B'`라 `⌘⇧B`를 암묵 배제했다 — `e.code`로 바꾸면 `⌘⇧B`·`⌘⌥B`가 분할로 떨어진다 | `EditorView.tsx:2823-2888`(F `:2871` · B `:2875` · J `:2879` · L `:2883`) | D2 |
| B2 | `⌘B`=`handleSplitBlock`(`:2029`) — `getContent()`·`getCursorPosition()` 뒤 **`setContent(before)`**: 조합 중이면 contentDOM이 통째로 교체돼 **IME 조합 상태가 고아**가 된다(다음 keydown의 compositionupdate가 새 DOM에서 엉뚱한 자리에). `⌘J`=`handleAIComplete`(`:1480`) — keydown 시점 `collectAIContext`가 읽는 텍스트 + 응답 도착 시 `insertPlainText`(B3) **두 시점**. `⌘⇧L`=`handleSplitMathLines`(`:1772`) — `getContent`·커서 | — | D2·D3 |
| B3 | 핸들 `insertText`(`:313-334`, dispatch 3회) · `insertInlineMath`·`insertBlockMath`(`:340-349`) · `insertPlainText`(`:350-360` — AI 완성 `:1508` · 61c 삽입 `:2516` · OCR `:2578`) · `insertMathSnippet`(`:361-367`) 조합 가드 0. **댓글 편집기 `LatexInputEditor.insertAtCursor`**(`CommentEditor.tsx:92` 그림 · `:127` OCR · `:163` 툴바)도 같다 — 작업 규칙 9 | `MarkdownEditor.tsx` · `LatexInputEditor.tsx:145-155` | D3 |
| B4 | React 입력창 Enter **가드 없음 9곳**: `FindReplacePanel.tsx:294`(찾기 질의) · `EditorView.tsx:3823`(탭 이름) · `UnifiedToolbar.tsx:460·475`(`type=number`) · `settings/UserGroupEditor.tsx:154` · `share/BazaarView.tsx:137` · `import/SheetImportModal.tsx:698` · `phone/PhoneBazaar.tsx:110` · `app/settings/page.tsx:134`. (`CoachLabel:50`·`OutlineSections:57`·`ProblemView:929`는 버튼 Enter/Space — 제외. `onKeyPress`·`"Enter"` 꼴 0건) | — | D1 |
| B5 | A11의 5곳(`FolderView` 제외)도 `keyCode === 229`는 안 본다 — Safari는 compositionend **뒤에** `isComposing:false`·`keyCode 229`인 keydown Enter를 한 번 더 낸다(CM 자신도 이 꼬리를 `compositionPendingKey` 100ms 창으로 거른다 — dist `:4549-4557`) | — | D1 |
| B6 | document `Escape` 리스너 16곳(68b C6) `isComposing` 미검사 | — | 범위 밖(§6) |
| B7 | 68a 리스너의 `needsReplay`는 **한글이 들면 userEvent 무관 참** — `input.paste`·자기 트랜잭션만 제외 | `math-editor-extensions.ts:452-466` · `lib/mathAscii.ts:187-191` | D7 `input.paste` 필수(E12) · `insertPlainText`가 수식 안에 한글을 넣는 경로는 잠복(§6) |

### 1-C. 구멍 — 붙여넣기

| # | 사실 | 위치 | 68c |
|---|---|---|---|
| C1 | 편집창 `clipboardInputFilter.of((text) => stripInvisibles(text))` | `MarkdownEditor.tsx:615` · `lib/invisibles.ts:29-37` | D4 |
| C2 | 댓글·agent 입력창 `LatexInputEditor` 필터 0 | `LatexInputEditor.tsx:71-116` extensions | D4(공용) |
| C3 | `\[…\]`→`$$…$$` 변환기 **둘**: `proofread.normalizeDisplayMathDelimiters`(`:387-`, 코드 펜스·인라인 코드·`$`/`$$` 보존, **`{fixed,count}` 반환**, 한 줄 `$$x$$` 출력, `(?<!\\)` 없음) · `chatExtract.normalizeMathDelimiters`(`:142-146`, `\(`도 처리, **`(?<!\\)` 뒤돌아보기**(61a C6 — `\\[6pt]`의 `\[`를 여는 구분자로 먹는 함정), 코드 보존 없음, 한 줄 출력). 둘 다 그대로는 못 쓴다(E3) | — | D5 신설(둘의 장점 합) |
| C4 | ~~미리보기가 `\(`를 못 그린다~~ → **A13으로 철회**. 붙여넣기 변환의 근거는 ① 저장 raw_text 정본 통일 ② 정돈 R3가 `\[`만 처리 ③ 찾기/바꾸기·일괄 검증 인용 앵커의 문자열 일관성 ④ 68b `exitMath` ③·Tab ⑥이 `\(`에서는 "닫는 구분자 뒤"로만 간다 | — | P5 근거 교체 |
| C5 | `ALL_SYMBOLS` 564 중 `symbol`이 1코드포인트 비ASCII **448**, 그중 `latex`가 `\`로 시작 **443**(전부 `katexSupported`), 결합·구조형(`{`) **9**(`˙→\dot{}`·`⃗→\vec{}`…) 제외 대상, 비백슬래시 5(`−→-`·`∗→*`·`∣→|`·`ȷ`·`ı` 항등 2). **중복 기호는 12종이 아니라 42종**(E4 — `≤` `\leq`/`\le` · `→` `\to`/`\rightarrow` · `∥` 6종 · `∣` 5종 · `△` 3종 · `∫` 3종 · `∅` `\varnothing`/`\emptyset` · `∧∨¬⊥∼≈□ℏ∋‡†£…` 등). **표에 없는 것**: `≠`·`⋯`·`·`(U+00B7)·`″`. **표의 명령이 정본과 다른 것**: `√→\surd`·`°→\degree`·`′→\prime` | `lib/math-symbols.ts:184-` · 컴파일 집계 2026-10-09 | D6 |
| C6 | KaTeX는 `≤`·`α`·`→`·`∞` 유니코드를 입력으로 받아 그린다 → 지금은 화면이 안 깨지고 원문에 두 표기가 섞인다. 정본은 명령형(교정 G12 · 내보내기 변환기 전제) | — | D6 근거 |
| C7 | rehype-katex(기본 `htmlAndMathml`)·ChatGPT·위키·MathJax의 HTML 클립보드엔 `<math>` 안 `<annotation encoding="application/x-tex">`. **Mathory 미리보기의 annotation은 전처리된 TeX**(`\displaystyle` 주입 · `\tag*{(n)}` · `\text{(n)}` · `array{l}` 래핑 — 61c 실측) → 61c `stripPreviewArtifacts`(`lib/chatExtract.ts:128`, import 0)가 역변환을 소유한다 | — | D7 ⓐ′ |
| C8 | `mathml-to-latex` **1.8.0 MIT**, 의존 `@xmldom/xmldom ^0.9.10`, unpacked **517K**(npm 실측) | — | P9 |
| C9 | 이 레포에 `DOMParser` 사용 0건 · `mathml-to-latex` 미설치 · Node 25.6 `node --test` · 테스트 스크립트 규약 `tsc <file> --outDir .test-build --rootDir . …`(의존 파일도 따라 컴파일 — `test:tidy`가 proofread를 끌고 가는 전례) | `package.json:13-39` | §4 |

---

## 2. 결정 (★ 권장 — §7과 짝)

### A. IME 안전 트리거 층

| # | 결정 |
|---|---|
| D1 | **`lib/imeKey.ts`**(순수 · import 0 · `test:imekey`): `isImeKey(e)` = `isComposing ‖ nativeEvent?.isComposing ‖ keyCode === 229`. B4 9곳 + A11 5곳(`FolderView`는 네이티브 `e.isComposing`이라 그대로 두거나 같은 함수 — 통일) 전부 `if (e.key === 'Enter' && !isImeKey(e))`. 숫자 입력 2곳도 통일 |
| D2 | **window 단축키**(`EditorView.tsx:2871-2886`): `⌘F`·`⌘B`·`⌘J`를 `e.code`(`KeyF`·`KeyB`·`KeyJ`) + **`!e.shiftKey && !e.altKey && !e.repeat`**(E15 — 옛 `'b'`가 암묵 배제하던 `⌘⇧B`를 명시 배제). 문서를 바꾸는 셋(`⌘B`·`⌘J`·`⌘⇧L`)은 **조합이 끝난 뒤 실행** — `editorRefs.current[id]?.whenSettled(fn)`(핸들 신설) → `runAfterComposition(view, fn)`(G2 공용 헬퍼 = `composingRescue`의 tick 로직 일반화: 조합 중이 아니면 즉시, 아니면 20ms 폴링으로 `!composing && !compositionStarted`를 기다려 실행 · 800ms 포기 · 윈도우 순서 60ms 갈래 · 실행 직전 `flushMathAscii`). ⚠ **blur 강제 확정이 아니다**(E7 — Mac은 keydown이 compositionend보다 **먼저** 오고 IME가 그 키로 확정 중이라, 거기에 blur를 얹는 것은 68b가 검증한 적 없는 경로). `⌘F`는 패널 열기뿐이라 가드 불필요 |
| D3 | **핸들 `commitComposition()`** 신설(`MarkdownEditorHandle` + `LatexInputEditorHandle`) + 삽입 핸들 **여섯**(B3 — `insertAtCursor` 포함) 첫 줄에서 호출. 본체 `commitComposition(view): boolean`(`lib/math-editor-extensions.ts`) — `view.compositionStarted && view.hasFocus`면 `contentDOM.blur(); contentDOM.focus({preventScroll:true})`(68a 끊기와 같은 경로) 뒤 **`flushMathAscii(view)`**(G1 — 확정 직후 삽입이 68a 치환 전 문서를 보지 않게 · 68b 윈도우 검수 교훈). 68a 억제 밖이라 CM이 blur를 본다 → 자동완성 닫힘 · 끔 모드 `scrollLeft` 복원 가능(68a C17) — 삽입 직전이라 무해(P3). A12에 따라 blur 직후 같은 틱에서 doc를 읽어도 조합 글자가 들어 있다(확정은 글자를 바꾸지 않는다 · "블러가 조합 글자를 지운 경우"는 68a `still` 실패 갈래와 같은 예외) |
| D4 | 가드의 **반대 방향**(조합 중 무시)은 두지 않는다 — Phase 65 D12의 "반응이 늦는 느낌"은 리플로우를 유발하는 토글 얘기이고, 삽입·분할·전송은 **확정 뒤 실행**이 의도와 같다. 단 D2는 "확정을 기다린다"(지연), D3는 "확정시킨다"(즉시) — 둘이 다른 이유는 E7 |

### B. 스마트 붙여넣기

| # | 결정 |
|---|---|
| D5 | **`lib/mathPaste.ts`**(순수 · import `./mathRegions`·`./mathAscii`(`isInTextArg`·`TEXT_CMDS`)·`./math-symbols`·`./invisibles`·`./chatExtract`(`stripPreviewArtifacts`) · `test:mathpaste`): `smartPasteText(text, doc, from, to): string` — 순서 ① `stripInvisibles` ② **구분자 정규화** `normalizeMathDelimitersForPaste(text)`(신설 — C3 두 함수의 장점 합: 코드 펜스·인라인 코드·기존 `$`/`$$` 보존 + `(?<!\\)` 뒤돌아보기 + 짝이 맞을 때만. **`\[…\]`는 펜스형 `$$\n…\n$$`**(E3 — 한 줄 `$$x$$`는 렌더가 인라인. 앞뒤 빈 줄은 저장 정규화 `normalizeDisplayMathSpacing`의 몫이라 여기서 안 넣는다) · `\(…\)`→`$…$`) ③ **수식 안 정규화**(D6) — 붙인 결과 문서(`doc.slice(0,from) + text + doc.slice(to)`)를 `scanMathRegions`로 스캔해 **붙인 구간 `[from, from+text.length)`와 겹치는 수식 영역 안**만 변환(붙이는 자리가 수식 안이면 평문 전체 · 평문이 `$`를 품으면 그 안만 · 둘 다 아니면 무접촉). `TEXT_CMDS` 인자 안 제외(`isInTextArg` 재사용 — `\text{α}`의 α는 둔다) |
| D6 | **유니코드 → LaTeX 표**(`UNICODE_TO_LATEX`, 모듈 로드 시 `ALL_SYMBOLS`에서 생성 → `PREFERRED` → **보정 override** 순 — 뒤가 앞을 덮는다, E4): ⓐ C5 443에서 `{`가 든 9종 제외, 비백슬래시 중 `−→-`·`∗→*`는 포함(항등 2종 제외) ⓑ **중복 42종**은 규칙 "최단형 우선" + **명시 override**(`∥→\parallel`(최단 `\|`는 GFM 표 셀 함정 M1 W1) · `∣→\mid` · `⊥→\perp` · `←→\leftarrow` · `△→\triangle` · `∅→\varnothing`(Q6) · `¬→\neg` · `∧→\wedge` · `∨→\vee` · `…→\cdots`(Q5) · `∫→\int` · `†→\dagger` · `⊨→\models` · `□→\square`) — **42종 전부를 테스트가 스냅샷으로 고정**(Q5) ⓒ **보정**(표에 없거나 표와 다른 것 — 표를 덮는다): `≠→\ne` · `⋯→\cdots` · `·`(U+00B7)·`⋅`(U+22C5)→`\cdot` · `×→\times` · `÷→\div` · `−`(U+2212)→`-` · `′→'`(표 `\prime` 덮음) · `″→''` · `°→^\circ`(표 `\degree` 덮음, Q7) · `√→\sqrt`(표 `\surd` 덮음) + 뒤에 `{`·`(`가 없으면 **다음 토큰 하나**(숫자 런 · 영문자 하나 · 괄호 그룹)를 `{}`로 감싼다(`√x`→`\sqrt{x}` · `√2x`→`\sqrt{2}x` · `√(x+1)`→`\sqrt{x+1}` · `√{x}`→`\sqrt{x}`) · 위첨자 런 `⁰-⁹⁺⁻ⁿ`→`^{…}` · 아래첨자 런 `₀-₉₊₋`→`_{…}` · **전각 ASCII**(U+FF01–FF5E)→ASCII · 전각 공백 U+3000→공백(⚠ 전각 `＄`는 **안 바꾼다** — Q9) ⓓ 명령 뒤가 영숫자면 공백 하나(`≤3`→`\le 3`) ⓔ 이미 명령형인 것 무접촉 ⓕ 한글·한자·가나 무접촉 |
| D7 | **HTML 클립보드 경로** — `createMathPaste()`(공용 확장, `lib/math-editor-extensions.ts`) = `EditorView.domEventHandlers({ paste })` + `clipboardInputFilter`. `paste`: `clipboardData.getData('text/html')`에 `<math`가 **있을 때만** 개입(아니면 `return false` → 내장·필터). 변환 `htmlToPasteText(html)`(`DOMParser` 래퍼 — 브라우저 전용) → `domToPasteText(root)`(`lib/mathPaste.ts`, 좁은 노드 인터페이스라 테스트가 리터럴 트리를 넣는다): ⓐ `<math>` → `annotation[encoding="application/x-tex"]` 텍스트, 없으면 폴백(P9) → `display="block"`이면 `\n$$\n…\n$$\n`, 아니면 `$…$` **ⓐ′ annotation에 `stripPreviewArtifacts`**(C7 — Mathory 미리보기 복사의 `\displaystyle`·`\tag*{(n)}`·`array{l}` 흔적 제거. 다른 출처엔 그 흔적이 없어 no-op) ⓑ `[aria-hidden="true"]`·`script`·`style`·`.katex-html`·`mjx-math` 건너뜀. ⚠ `mjx-assistive-mml`은 건너뛰지 **않는다** — MathJax 3는 `mjx-container > mjx-math`(시각, aria-hidden)+`mjx-assistive-mml > math`(annotation 있음)라 **`mjx-math`만** 건너뛰고 `math`는 받는다(P13 표본으로 고정) ⓒ 블록 요소(`p`·`div`·`li`·`tr`·`br`·`h1~6`·`pre`) 줄바꿈 ⓓ 그 밖은 `textContent`. 결과를 `smartPasteText`에 통과(③) → `view.dispatch({changes, selection, userEvent: 'input.paste', scrollIntoView: true})` — `input.paste`라 68a가 건너뛴다(B7 — **빼면 한글이 든 결과가 68a 큐에 오른다**) · 댓글의 `maxLength` changeFilter는 dispatch라 자동 적용 |
| D8 | HTML에 `<math`가 없으면 HTML→Markdown 변환을 **하지 않는다**(P10). 평문 경로 |
| D9 | **댓글·agent 입력창도 같은 확장**(`LatexInputEditor` extensions에 `createMathPaste()` — `createMathInput()` 옆). 편집창 `:615`의 `clipboardInputFilter.of(stripInvisibles)`는 `createMathPaste()` 안으로 흡수(①). **작업 규칙 9 미통일 ①(붙여넣기 정규화)이 이것으로 닫힌다** — CLAUDE.md 목록에서 지운다(G17) |
| D10 | 드롭도 `clipboardInputFilter`를 탄다(A9) — ②③은 `\(`·`$`·수식 안에만 작용해 URL·파일명 무접촉. HTML 경로는 drop에 두지 않는다 |
| D11 | undo = 붙여넣기 1스텝(한 dispatch). 원문 보존 없음 — `⌘⇧V`(서식 없이)는 평문 경로라 D5만 적용. 토글 없음(P11). ⚠ Mathory 미리보기 복사의 text/plain은 KaTeX 글자 나열이라 `⌘⇧V`면 수식이 두 벌로 들어간다(알고 두는 손실 — 그래서 기본 `⌘V`가 HTML 우선) |

### C. 문서

| # | 결정 |
|---|---|
| D12 | CLAUDE.md 「Korean IME + CodeMirror 단축키」 절(`:392`)에 68c 단락: `isImeKey` 규약(React 입력창 Enter는 **반드시**) · window 단축키 `e.code`+`!shift·!alt` · 조합 처리 두 모델(D2 지연 / D3 확정)과 갈린 이유(E7) · `commitComposition` 뒤 `flushMathAscii` 필수. 「삽입은 3분 규약」 절에 "여섯 핸들 머리 `commitComposition`" 한 줄. 새 절 「붙여넣기는 `createMathPaste` 하나다 (Phase 68c)」: 경로 둘 · 순서 ①~③ · `\[`는 펜스형 · `PREFERRED`+보정 override 순서 · `input.paste` 필수 이유(B7) · `stripPreviewArtifacts` 재사용 · "`<math` 없으면 HTML은 안 본다". 작업 규칙 9 미통일 목록 ① 삭제 |

---

## 3. 데이터 모델

없음. **서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 규약 0 · localStorage 0 · 아이콘 0.** 의존성 `mathml-to-latex`는 P9에 따라 0 또는 1(동적 import).

---

## 4. 구현 사양

### 4-1. `lib/imeKey.ts` (신규 · import 0)

```ts
export interface ImeKeyLike { isComposing?: boolean; keyCode?: number; nativeEvent?: { isComposing?: boolean } }
/** React·DOM 공용. Safari 꼬리 keydown(compositionend 뒤 isComposing:false·keyCode 229)까지 거른다 */
export function isImeKey(e: ImeKeyLike): boolean {
  return !!(e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229);
}
```

적용 15곳(B4 9 + A11 6) — 한 줄 치환. `CommentPanel.tsx:1392·1426`은 가드 줄 자체를 `isImeKey`로.

### 4-2. `lib/math-editor-extensions.ts` 추가·개편

```ts
/** 조합이 끝난 뒤 fn — 조합 중이 아니면 즉시. composingRescue의 tick 로직을 일반화(RESCUE_* 상수 공유).
 *  Mac(keydown → compositionend)·Windows(compositionend → keydown 60ms 갈래) 두 순서를 68b가 검증한 그대로.
 *  실행 직전 flushMathAscii. 800ms 안에 조합이 안 끝나면 버린다(반환 false) */
export function runAfterComposition(view: EditorView, fn: () => void, opts?: { composingAtKey?: boolean }): void

/** 조합을 지금 확정시킨다(68a 끊기와 같은 경로) + flushMathAscii. 프로그램 호출 삽입 직전 용도 — keydown 경로는 runAfterComposition */
export function commitComposition(view: EditorView): boolean {
  let broke = false;
  if (view.compositionStarted && view.hasFocus) {
    view.contentDOM.blur();
    view.contentDOM.focus({ preventScroll: true });
    broke = true;
  }
  flushMathAscii(view);
  return broke;
}

export function createMathPaste(): Extension {
  return [
    EditorView.domEventHandlers({
      paste(event, view) {
        const html = event.clipboardData?.getData('text/html');
        if (!html || !/<math[\s>]/i.test(html)) return false;          // A10 — 내장 경로
        const text = htmlToPasteText(html);                            // DOMParser → domToPasteText
        if (text == null) return false;
        const { from, to } = view.state.selection.main;
        const out = smartPasteText(text, view.state.doc.toString(), from, to);
        view.dispatch({ changes: { from, to, insert: out }, selection: { anchor: from + out.length },
                        userEvent: 'input.paste', scrollIntoView: true });
        return true;
      },
    }),
    EditorView.clipboardInputFilter.of((text, state) => {
      const { from, to } = state.selection.main;
      return smartPasteText(text, state.doc.toString(), from, to);
    }),
  ];
}
```

- `composingRescue`는 `runAfterComposition`으로 **재작성**(동작 동일 — CDP 118/118 회귀가 S0 완료 조건, Q11)
- ⚠ `clipboardInputFilter`는 다중 선택이면 범위마다 같은 평문(byLine) — `state.selection.main`으로 판정(수용)
- `MarkdownEditor.tsx:615` → `createMathPaste()` · `LatexInputEditor.tsx` extensions에 `createMathPaste()`
- 핸들: `MarkdownEditorHandle`에 `commitComposition(): boolean`·`whenSettled(fn): void` · `LatexInputEditorHandle`에 `commitComposition(): boolean`

### 4-3. `lib/mathPaste.ts` (신규 · 순수)

| export | 역할 |
|---|---|
| `UNICODE_TO_LATEX: ReadonlyMap<string, string>` | D6 — 표 → `PREFERRED` → 보정 순으로 덮어쓴 결과 |
| `PREFERRED: Record<string, string>` | D6 ⓑ 명시 override(최단형 규칙의 예외만) |
| `OVERRIDES: Record<string, string>` | D6 ⓒ 보정(표에 없거나 표와 다른 것) |
| `normalizeMathDelimitersForPaste(text)` | D5 ② — 코드 보존 + `(?<!\\)` + `\[`는 펜스형 |
| `convertUnicodeMathIn(text, ranges)` | 주어진 구간 안에서만 D6(ⓓ 공백 · `√`·첨자 런) |
| `smartPasteText(text, doc, from, to)` | D5 ①~③ |
| `domToPasteText(root: PasteNode): string` | D7 ⓐ~ⓓ — `PasteNode = { nodeType; nodeName; getAttribute?(n): string∣null; childNodes: ArrayLike<PasteNode>; textContent: string∣null }` |
| `htmlToPasteText(html)` | 브라우저 전용(`DOMParser`) — 테스트 밖. Chrome HTML 클립보드의 `<meta>`·`<!--StartFragment-->` 래퍼는 DOMParser가 삼킨다 |

### 4-4. `EditorView.tsx` (D2)

- `:2871` `e.key === 'f'` → `e.code === 'KeyF' && !e.shiftKey && !e.altKey` · `:2875` `KeyB` · `:2879` `KeyJ`(+ `!e.repeat`)
- `⌘B`·`⌘J`·`⌘⇧L` 분기: `const h = editorRefs.current[activeBlockId!]; if (h?.isComposing()) { h.whenSettled(handleX); return; } handleX();`
- 주석 C5 갱신("F·B·J도 e.code · 조합은 지연 실행")

### 4-5. `MarkdownEditor.tsx` · `LatexInputEditor.tsx` (D3)

- 핸들 인터페이스에 `commitComposition`·`whenSettled` · 구현은 lib 위임
- 삽입 핸들 여섯 첫 줄 `commitComposition(view);`
- `:615` 교체(4-2)

---

## 5. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | `commitComposition`의 blur·focus를 CM이 본다 → 자동완성 닫힘·끔 모드 `scrollLeft` 복원(68a C17) | 호출 자리가 전부 "삽입 직전" — 삽입 dispatch의 `scrollIntoView`가 가로 위치를 다시 잡는다. 실물 §9-3 3 |
| R2 | `e.key`→`e.code`로 비QWERTY 라틴 자판에서 물리 키가 달라진다 | `⌘Z`·`⌘C/V`·`⌘⇧L`이 이미 그 길(C5). 일관성 우선 |
| R3 | 유니코드 변환이 의도된 유니코드를 바꾼다 | 결과는 같은 모양의 정본 명령. 수식 밖·`\text{}` 안 무접촉. `PREFERRED`·`OVERRIDES`에서 빼면 된다 |
| R4 | `√` 토큰 감싸기 오판 | 한 토큰만(수학 관례 `√2x` = `\sqrt{2}x`). 테스트 고정 |
| R5 | 위첨자 런 `x²³`→`x^{23}` | 의도 |
| R6 | HTML 경로가 페이지 전체 복사(표·목록)를 뭉갠다 | `<math` 있을 때만 · 블록 줄바꿈. 범위 밖 P10 |
| R7 | annotation 없는 `<math>`(Word 변환물·일부 CMS) | P9 |
| R8 | 68a 큐 충돌 | `input.paste`(B7). HTML 경로 dispatch도 같은 userEvent |
| R9 | 필터가 drop에도 돌아 URL을 건드린다 | ②③은 `\(`·`$`·수식 안에만. 테스트에 URL 표본 |
| R10 | `runAfterComposition`으로 `composingRescue`를 재작성하다 68b 동작이 바뀐다 | CDP 118/118 재실행이 S0 완료 조건. 표본·기대값 무변경 |
| R11 | `⌘J` 지연 실행 중 사용자가 블록을 옮긴다(800ms 안) | `handleAIComplete(targetId)`가 keydown 시점 `activeBlockId`를 닫아 든다 — 이미 그렇게 돼 있다(`blockId ‖ activeBlockId`). `whenSettled(() => handleAIComplete(id))`로 id를 고정 |
| R12 | `mathml-to-latex` 번들(P9 (b)) | 동적 import — annotation 없는 첫 붙여넣기에만 |
| R13 | `math-symbols.ts`(9,239행)를 `test:mathpaste`가 매번 컴파일 | 실측 수 초 — 수용. 표를 빌드 산출물로 빼는 것은 범위 밖 |
| R14 | `stripPreviewArtifacts` ④ `\text{(n)}`→`\ref{n}` 오검(사용자 `\text{(3)}`) | 61c가 알고 둔 2순위 손실과 같다 — KaTeX 복사 출처가 Mathory일 때만 의미 있고 그 땐 원문이 `\ref`였다 |

---

## 6. 범위 밖

- document `Escape` 리스너 16곳(B6) · `insertPlainText`가 수식 안에 한글을 넣으면 68a 큐에 오르는 잠복(B7 — AI 완성·OCR 결과에 수식 안 한글은 드물다) · 음성·손글씨 · HTML→Markdown(P10) · Word OMML · HWP 수식 스크립트 · 드롭 HTML 경로(D10) · `clipboardOutputFilter`(복사 쪽) · 변환 끄기 토글(P11) · 붙여넣기 미리보기 확인창 · 전각 `＄` 구분자(Q9) · 표 데이터의 빌드 산출화(R13)

---

## 7. 덕수 판정 (★ 권장)

### 7-1. v1 P1~P14 개정

| # | 질문 | 선택지 | 권장 |
|---|---|---|---|
| P1 | 조합 중 window 단축키(`⌘B`·`⌘J`·`⌘⇧L`) | (a) 조합 끝난 뒤 실행 / (b) 조합 중 무시 | ★ **(a)** — 의도 보존(D4). **실행 모델은 Q1** |
| P2 | `⌘F`·`⌘B`·`⌘J`를 `e.code`로 | (a) 바꾼다 / (b) 현행 | ★ **(a)** — 68b가 `Ctrl-m`에서 `ㅡ`를 실측했으니 `ㅠ`·`ㅓ`·`ㄹ`도 같다(실물 §9-3 1에서 10초 확인). **동반 가드는 Q10** |
| P3 | `commitComposition`이 CM에 보이는 blur·focus(R1) | (a) 수용 / (b) 68a 억제 공유 | ★ **(a)** |
| P4 | `isImeKey`에 `keyCode === 229` 포함 | (a) 포함 / (b) `isComposing`만 | ★ **(a)** — Safari 꼬리(B5). CM도 같은 꼬리를 100ms 창으로 거른다 |
| P5 | `\(`·`\[`→`$` 변환을 붙여넣기에서 | (a) 한다 / (b) 정돈·교정에만 | ★ **(a)** — 근거는 **C4 교체본**(정본 통일·R3 `\[`만·앵커 일관성·68b 나오기 ③). "화면이 깨진다"는 틀렸다(A13). **출력형은 Q3** |
| P6 | 수식 안 유니코드→LaTeX | (a) 한다 / (b) 안 한다 | ★ **(a)** |
| P7 | 중복 기호 정본 | (a) 짧은 꼴 / (b) 긴 꼴 | ★ **(a)** — 단 42종이라 **규칙+override+스냅샷**(Q5) |
| P8 | 전각 ASCII | (a) 수식 안만 / (b) 전부 / (c) 안 함 | ★ **(a)** |
| P9 | `<math>` annotation 없을 때 | (a) `textContent` / (b) `mathml-to-latex` 동적 import(MIT · 517K · xmldom 동반) / (c) 자체 미니 변환기 | ★ **(a)로 시작** — 주 경로가 KaTeX·MathJax·위키·ChatGPT·Mathory 전부를 덮고, 실물에서 annotation 없는 출처가 잡히면 (b) |
| P10 | `<math` 없는 HTML | (a) 평문 / (b) 간단 Markdown | ★ **(a)** |
| P11 | 변환 끄기 토글 | (a) 없음 / (b) Row 2 토글 | ★ **(a)** — `⌘⇧V`의 손실(D11)은 알고 둔다 |
| P12 | `commitComposition` 적용 범위 | (a) 핸들 여섯 전부 / (b) 프로그램 호출만 | ★ **(a)** — **Safari는 툴바 클릭이 포커스를 안 옮긴다**(A8)라 (b)는 Safari에서 구멍 |
| P13 | `domToPasteText` 건너뜀 목록 | (a) `aria-hidden`+`script`+`style`+`.katex-html`+`mjx-math` / (b) `aria-hidden`만 | ★ **(a)** — `mjx-assistive-mml`은 건너뛰지 **않는다**(그 안의 `math`가 annotation을 든다). 표본 셋(KaTeX·MathJax 3·위키)을 테스트로 고정 |
| P14 | 하니스 | (a) `app/dev68c` + CDP(단축키 `Input.dispatchKeyEvent` · 클립보드는 페이지 안 합성 `ClipboardEvent` + `DataTransfer`) / (b) Node만 | ★ **(a)** — 68b 하니스(`docs/phaseSketch/phase68b-cdp-harness.mjs`·`phase68b-dev68b-page.tsx.txt`)를 복사해 시작 |

### 7-2. v2 신설 Q1~Q11

| # | 질문 | 선택지 | 권장 |
|---|---|---|---|
| Q1 | **window 단축키의 조합 처리 모델** | (a) 68b `composingRescue`형 **지연**(compositionend를 기다린다 — 맥·윈도우 두 순서 검증 완료) / (b) v1 D3 blur 강제 확정 / (c) 무시 | ★ **(a)** — (b)는 Mac에서 IME가 이미 그 키로 확정 중인 순간에 blur를 얹는 미검증 경로(E7). 68b가 CDP·실물로 닫은 모델을 그대로 |
| Q2 | **핸들(프로그램 호출) 경로의 모델** | (a) blur→focus 확정 + `flushMathAscii`(68a 끊기와 같은 경로) / (b) 지연 | ★ **(a)** — AI 응답·OCR 결과는 사용자가 타자 중일 때 도착할 수 있어 (b)면 삽입이 조합 끝날 때까지 밀리고 그 사이 커서가 움직인다 |
| Q3 | `\[…\]` 붙여넣기 출력형 | (a) 펜스형 `$$\n…\n$$`(앞뒤 빈 줄은 저장 정규화 몫) / (b) C3 그대로 한 줄 `$$…$$` | ★ **(a)** — (b)는 렌더가 인라인(Phase 59 실측)이라 저장 전 미리보기가 어긋난다 |
| Q4 | KaTeX annotation의 Mathory 전처리 흔적 | (a) 61c `stripPreviewArtifacts` 재사용 / (b) 그대로 | ★ **(a)** — 다른 출처엔 no-op, Mathory 미리보기→편집창 복사에서 `\displaystyle`·`\tag*{(n)}`이 raw_text로 새는 것을 막는다 |
| Q5 | `PREFERRED` 구성 방식(42종) | (a) "최단형" 규칙 + 명시 override 14 + **42종 스냅샷 테스트** / (b) 42종 전부 명시 | ★ **(a)** — 표가 자라도 규칙이 따라가고, 스냅샷이 "조용한 변경"을 막는다. `…`(U+2026)는 수식 안이면 `\cdots`(phasedoc 관례 30:5) |
| Q6 | `∅` | (a) `\varnothing`(둥근 공집합 — 한국 교과서) / (b) `\emptyset`(최단) | ★ **(a)** |
| Q7 | `°` | (a) `^\circ` / (b) 표의 `\degree` | ★ **(a)** — 교재 관례. 둘 다 KaTeX OK |
| Q8 | `′`·`″` | (a) `'`·`''` / (b) 표의 `\prime` | ★ **(a)** — `f'(x)` 관례 |
| Q9 | 전각 `＄`(68b 윈도우 검수에서 나온 함정) | (a) 안 바꾼다 / (b) 영역 밖에서도 `$`로 | ★ **(a)** — 본문 통화 기호 오변환 위험 > 이득. 전환 안내(Shift+Space)가 답 |
| Q10 | `e.code` 전환의 동반 가드 | (a) `!shift·!alt·!repeat` 추가 / (b) 없이 | ★ **(a)** — 옛 `'b'` 비교가 암묵 배제하던 `⌘⇧B`가 (b)면 분할로 떨어진다(E15) |
| Q11 | `composingRescue`를 `runAfterComposition`으로 재작성 | (a) 재작성(한 벌, CDP 118 회귀) / (b) 복제해 둘 | ★ **(a)** — 두 벌이면 윈도우 60ms 갈래 같은 수정이 한쪽에만 간다 |

---

## 8. 작업 순서

| Stage | 내용 | 완료 조건 |
|---|---|---|
| S0 | `lib/imeKey.ts` + `tests/imeKey.test.mjs` + `test:imekey` · 15곳 치환(D1) · **`runAfterComposition` 추출 + `composingRescue` 재작성**(Q11) | 테스트 6건 · tsc · **CDP 68b 118/118 무회귀** |
| S1 | `lib/mathPaste.ts` + `tests/mathPaste.test.mjs` + `test:mathpaste`(D5·D6·D7 순수부) | §9-1 전부 |
| S2 | `commitComposition`·`createMathPaste` · 두 편집기 핸들·extensions(D3·D7·D9) | tsc · CDP ①~⑥·⑩ |
| S3 | `EditorView.tsx` window 단축키(D2) | CDP ⑦~⑨·⑪·⑫ |
| S4 | CLAUDE.md(D12) · roadmap · phasedocs 확정본 · `app/dev68c` 삭제(dev 종료 뒤) | — |
| S5 | 덕수 실물 §9-3(Mac Chrome 390 → **Safari**(A8·B5) → Win Chrome) | — |

---

## 9. 검증

### 9-1. 자동

- `test:imekey`: `{isComposing:true}` ✓ · `{keyCode:229}` ✓ · `{nativeEvent:{isComposing:true}}` ✓ · `{isComposing:false,keyCode:13}` ✗ · `{}` ✗ · React 합성 꼴 ✓
- `test:mathpaste`
  - 구분자: `\(x\)`→`$x$` · `\[x\]`→`$$\nx\n$$`(**펜스형**) · `\[\n a \\[4pt] b \n\]`→펜스형 하나(안의 `\\[4pt]` 보존 — 61a C6) · `a \\[6pt] b` 본문 무접촉 · `\\(` 무접촉 · 미닫힘 `\(x` 무접촉 · 코드 펜스·인라인 코드 안 무접촉 · 기존 `$…$` 안의 `\(` 무접촉 · 혼합 문단
  - 영역 판정: 커서 `$…|…$` 안 + `α≤β`→`\alpha \le \beta` · 본문 커서 + `α≤β`→무접촉 · 본문 커서 + `x $α$ y`→`x $\alpha$ y` · `\text{α}` 안 무접촉 · 붙인 구간 밖의 기존 `$≤$` 무접촉 · 붙인 평문이 기존 수식을 닫는 경우(`$a` 뒤에 `b$`)
  - 표: `≤→\le` `≥→\ge` `≠→\ne` `→→\to` `←→\leftarrow` `∞→\infty` `π→\pi` `△→\triangle` `∠→\angle` `…→\cdots` `⋯→\cdots` `×→\times` `·→\cdot` `⋅→\cdot` `−→-` `∗→*` `′→'` `″→''` `°→^\circ` `∅→\varnothing` `∥→\parallel` `∣→\mid` `⊥→\perp` · `≤3`→`\le 3` · `≤(`→`\le(` · `x²`→`x^{2}` · `x²³`→`x^{23}` · `x⁻¹`→`x^{-1}` · `a₁₂`→`a_{12}` · `√x`→`\sqrt{x}` · `√2x`→`\sqrt{2}x` · `√(x+1)`→`\sqrt{x+1}` · `√{x}`→`\sqrt{x}` · 전각 `（ｘ＋１）`→`(x+1)` · 전각 `＄` 무접촉 · 한글 무접촉 · `\alpha` 무접촉 · 결합 문자 `˙`·`⃗` 무접촉 · **42종 중복 스냅샷**(`UNICODE_TO_LATEX`에서 42개 키 전부를 기대값과 대조)
  - `domToPasteText`(리터럴 트리): KaTeX 꼴(`span.katex > span.katex-mathml > math > semantics > mrow + annotation` + `span.katex-html[aria-hidden]`)→annotation만 · **Mathory 꼴**(annotation `\displaystyle x^{2}`·`\tag*{(1)}`)→`x^{2}`·`\tag{1}` · `display="block"`→`\n$$\n…\n$$\n` · 위키 꼴(`span.mwe-math-element > math + img`) · MathJax 3 꼴(`mjx-container > mjx-math[aria-hidden] + mjx-assistive-mml > math`)→`math`의 annotation · annotation 없음→P9 갈래 · `<p>`·`<br>` 줄바꿈 · `<script>` 건너뜀 · 수식 둘인 문단
  - 드롭 표본: `https://drive.google.com/…`·`a_fig1.jpg` 무접촉(R9)
- 회귀: `test:invisibles`·`test:proofread`·`test:mathregions`·`test:mathascii`·`test:mathinput`·`test:extract`·tsc·`npm run build`(dev 종료 뒤)

### 9-2. headless CDP (`app/dev68c` — 68b 하니스 복사, 검증 뒤 삭제 · dev 서버 중 삭제 금지)

① 평문 `\(a\)` 붙여넣기→`$a$` · `\[a\]`→펜스형 ② 수식 안 커서 + `α≤β`→변환 · 본문 커서→무변환 ③ 합성 `ClipboardEvent('paste', {clipboardData: new DataTransfer()})`(`text/html` KaTeX 꼴 + `text/plain` 기호 나열)→LaTeX만 들어가고 평문은 **안** 들어간다 · 트랜잭션 `userEvent === 'input.paste'` · 68a 큐 비어 있음 ④ `<math` 없는 HTML→평문 경로(③과 대조) ⑤ 댓글 입력창에서 ①③ + `maxLength` 초과 차단 ⑥ ⌘Z 1회 = 붙여넣기 통째 ⑦ 조합 합성 중(페이지 안 composition 이벤트 — 68a·68b 방식) `⌘B`→**지연 뒤** 확정 글자가 분할 앞 블록 끝에 있고 조합 잔재 없음 · 800ms 안에 compositionend가 안 오면 미실행 ⑧ 같은 상태 `⌘J`→전송 본문에 확정 글자 포함(fetch 스파이) · id 고정(R11) ⑨ `⌘F`·`⌘B`·`⌘J`가 `code`만 맞는 keydown(key `'ㅂ'`)으로 발화 · `⌘⇧B`·`⌘⌥B`는 **미발화**(Q10) ⑩ 조합 합성 중 `insertPlainText`·댓글 `insertAtCursor` 호출→확정 뒤 삽입 · 글자 중복 없음 · 68a 보류 삽입이 있으면 flush 뒤 삽입 ⑪ 찾기 패널: 조합 중 Enter(229)→`goNext` 미발화 · 조합 끝 뒤→발화 · 꼬리 keydown(229·`isComposing:false`)→미발화 ⑫ 탭 이름 동일 ⑬ **68b 하니스 118건 재실행**(S0 뒤)

### 9-3. 실물 (덕수)

1. **(push 전 현행)** Mac Chrome 390 한글 모드에서 `⌘B`·`⌘J`·`⌘F` 발화 여부 — 10초
2. 한글 모드 `함수 f` 치고 조합 끝나기 전 `⌘B`→블록이 `함수 f` 뒤에서 갈리고 유실·중복 없음 · `⌘J` 동일
3. 끔 모드 긴 수식에서 조합 중 툴바 `\frac` 클릭→삽입 뒤 가로 위치가 커서를 따라간다(R1)
4. 찾기 패널 한글 질의 중 Enter — 마지막 글자 살아 있고 "다음" 한 번만(**Safari에서 특히**)
5. 탭 이름 `풀이2` 입력 중 Enter
6. ChatGPT 답변 복사→붙여넣기: `\( \)`→`$ $`, 수식은 원 LaTeX, 평문 기호 나열 없음
7. **Mathory ProblemView 복사→편집창**: `\displaystyle`·`\tag*{(n)}` 흔적 없음(Q4) · 위키 수식 문단
8. HWP 문단(`（가）`·`×`·`≤`): 본문 전각 그대로, `$…$` 안만 변환(P8)
9. 그림 드롭·URL 붙여넣기 무변화
10. **Safari**: 2(툴바 경로 — A8)·4
11. Windows Chrome(한글): 2·4·6 · `⌘` 대신 Ctrl · **Breevy·PowerToys 끈 채**(68b 교훈)

---

## 10. 커밋 지침

- Stage별 1커밋 `feat(phase68c):` / `fix(phase68c):` / `docs(phase68c):` · CLI는 커밋까지, push는 덕수
- 착수 시 HEAD가 `4283b69`보다 앞서 있으면 §1 줄 번호 재실측
- `app/dev68c`는 S4에서 삭제(dev 서버가 도는 동안 삭제 금지)

---

## 부록 A. v1 정정 (E1~E18 — HEAD `4283b69` 실측)

| # | v1 | 실측 | 영향 |
|---|---|---|---|
| E1 | 기준 `fbe6eac` · `composingRescue :239-280` · `createMathAscii :325-460`(끊기 `:430-441` · 억제 `:366`) · `:167·:202·:591` · `:483·:494` | HEAD `4283b69`(+2 커밋: `667596e` flushMathAscii·윈도우 순서 60ms·진단 기록, `4283b69` docs). `composingRescue :283-347` · `createMathAscii :397-545`(끊기 `:502-510` · 억제 `:439`) · Tab `:220`·`:256` · Enter `:673` · input `:565-576` · **`flushMathAscii :393` 신설**(v1이 모르는 함수) | §1-A · D3·G1 |
| E2 | C4 "미리보기가 `\(`를 못 그려 붙이면 화면이 깨진다" | `EditorPreview.tsx:199`·`preprocess.ts:137`이 렌더 시 `\(`→`$` 변환 — 안 깨진다 | P5 근거 교체(C4′) |
| E3 | C3 `normalizeDisplayMathDelimiters` 재사용(string 반환으로 적음) | `{fixed,count}` 반환 · 출력이 한 줄 `$$x$$` = 렌더 **인라인**(Phase 59) · `(?<!\\)` 없음. `chatExtract.normalizeMathDelimiters`는 뒤돌아보기가 있으나 코드 보존 없음 | D5 ② 신설(Q3) |
| E4 | C5 중복 12종 · 표에 `≠`·`√`·`°`가 있다고 가정(§9-1 표본) | 중복 **42종** · `≠`·`⋯`·`·`·`″` **부재** · `√→\surd`·`°→\degree`·`′→\prime`(표가 정본과 다르다) · 비백슬래시 `−→-`·`∗→*` 존재 · `∥` 최단형 `\|`(GFM 함정) | D6 순서(표→PREFERRED→보정이 덮음) · Q5~Q8 |
| E5 | B4 "10곳" · 합 16 | 텍스트 입력 **9곳** · 가드 6곳(`FolderView:338`은 입력창이 아닌 document keydown) · 합 15 | D1 |
| E6 | B3 핸들 5(편집창만) | 댓글 편집기 `LatexInputEditor.insertAtCursor`(OCR·그림·툴바 3곳 호출) 누락 — 작업 규칙 9 | D3 여섯 |
| E7 | D3 "window 단축키도 `commitComposition`(blur)" | 68b `composingRescue`는 **blur 없이 compositionend를 기다린다**. Mac은 keydown이 먼저 오고 IME가 그 키로 확정 중 — 거기에 blur를 얹는 경로는 미검증 | D2 지연 모델(Q1) · D4 두 모델 구분 |
| E8 | (암묵) 확정 뒤 doc를 동기로 읽는다 | `view.observer`는 d.ts에 없어(internal) 동기 flush 불가. 단 CM은 조합 중에도 문서를 반영하고(68a `still` 전제) compositionend 관찰자가 동기라 핸들 경로는 blur 직후 읽어도 된다 | A12 · D3 근거 |
| E9 | A8 "툴바 클릭이 포커스를 옮겨 조합을 확정 → 사실상 안전" | Chrome·Edge·Firefox만. **Safari/macOS는 버튼 클릭이 포커스를 안 옮긴다** | P12 (a) 근거 강화 · S5 Safari 항목 |
| E10 | B2 "조합 글자가 문서에 섞인 채 분할·전송" | `handleSplitBlock`의 진짜 실패는 조합 중 `setContent(before)`가 contentDOM을 교체해 IME 상태가 고아가 되는 것. `handleAIComplete`는 keydown 시점 `collectAIContext`와 응답 도착 `insertPlainText` **두 시점** | B2 · R11 |
| E11 | — | `insertText`는 dispatch 3회(undo 3스텝) — 68c가 머리에 줄을 넣는 자리라 기록만(범위 밖) | — |
| E12 | D7 "`input.paste`라 68a가 건너뛴다(68b A14)" | 근거를 실코드로: 68a 리스너는 `needsReplay`가 **한글이면 userEvent 무관 참**이고 `input.paste`·자기 트랜잭션만 제외(B7) → 빼면 한글 든 결과가 큐에 오른다. `insertPlainText`(userEvent 없음)의 같은 잠복은 §6 | D7 강조 |
| E13 | 4-2 `clipboardInputFilter` 시그니처·drop | `(text, state)` 맞음 · drop도 `dropText`가 같은 필터(A9 실측 `:4967`) | 그대로 |
| E14 | B1 ⌘B `e.key==='b'` 전환 | 옛 비교는 Shift면 `'B'`라 `⌘⇧B`·`⌘⌥B`를 암묵 배제 — `e.code`로 바꾸면 풀린다 | Q10 가드 |
| E15 | §9-2 ⑦ "확정 글자가 분할 앞 블록 끝" | 지연 모델이라 "지연 뒤"로 · 800ms 미도착 시 미실행 표본 추가 | §9-2 ⑦ |
| E16 | C8 미압축 460K | npm 실측 unpacked **517K** · `@xmldom/xmldom ^0.9.10` | P9 |
| E17 | D7 ⓑ 건너뜀에 `mjx-math` | MathJax 3는 `mjx-assistive-mml > math`에 annotation이 있다 — `mjx-math`만 건너뛰고 `math`는 받아야 한다(P13 표본으로 고정 — 버전 불확실) | D7 ⓑ |
| E18 | A1 "`:30` 주석" | `:30` 맞음(재실측) | — |

## 부록 B. v1 보완 (G1~G20)

| # | 보완 | 근거 |
|---|---|---|
| G1 | `commitComposition` 뒤 **`flushMathAscii` 필수** | 68b 윈도우 검수: 확정 직후 명령이 68a 치환 전 문서(`liㅡ`)를 봤다. 삽입도 같은 경합 |
| G2 | `runAfterComposition(view, fn)` 공용 헬퍼 — `composingRescue` tick 로직 일반화(RESCUE_* 공유) | window 단축키(D2)와 68b 단축키가 한 벌(Q11) |
| G3 | 핸들 API `whenSettled(fn)`·`commitComposition()` 둘 — EditorView는 view를 못 보므로 핸들이 위임 | D2·D3 |
| G4 | 댓글 `maxLength` changeFilter는 HTML 경로 dispatch에도 자동 적용 — §9-2 ⑤ 표본 | D7 |
| G5 | `PasteNode` 좁은 인터페이스 명시(4-3) · Chrome HTML 클립보드 래퍼(`<meta>`·`StartFragment`)는 DOMParser가 삼킨다 | 테스트 가능성 |
| G6 | KaTeX annotation의 Mathory 전처리 흔적 → `stripPreviewArtifacts` 재사용(Q4) | 61c 실측 "annotation은 원본이 아니다" |
| G7 | `⌘⇧V` 손실 명시(D11): Mathory 미리보기의 text/plain은 KaTeX 글자 나열 | — |
| G8 | 영역 판정은 붙인 구간 **`[from, from+text.length)`와 겹치는 영역** — "붙인 평문이 기존 미닫힘 수식을 닫는" 표본 추가 | §9-1 |
| G9 | 첨자 런에 `⁻¹`·`ⁿ`·`₊` 포함 표본 | D6 ⓒ |
| G10 | 전각 `＄`는 수식 구분자로 인식조차 안 돼 영역 밖 → 변환 대상이 아니다. 바꾸지 않는다(Q9) | 68b 윈도우 검수 |
| G11 | 테스트 표본: `\[ … \\[4pt] … \]` 펜스형 하나 · 본문 `a \\[6pt] b` 무접촉 · 결합 문자 무접촉 · 42종 스냅샷 | 61a C6 · E4 |
| G12 | `handleAIComplete(targetId)` id 고정으로 지연 중 블록 이동 대비(R11) | E10 |
| G13 | 숫자 입력 2곳 `isImeKey` 통일(무해) | D1 |
| G14 | CDP 클립보드: `new ClipboardEvent('paste', {clipboardData: new DataTransfer()})`를 contentDOM에 dispatch — CM `eventBelongsToEditor`가 target만 보고 `ignoreDuringComposition`은 키 이벤트만이라 합성 paste가 통한다 | dist `:4457` |
| G15 | Safari 검수 항목 신설(S5·§9-3 10) — A8·B5가 Safari 전용 | E9 |
| G16 | `test:mathpaste`의 `math-symbols.ts` 컴파일 비용(R13) 기록 | C9 |
| G17 | CLAUDE.md 작업 규칙 9 미통일 목록 ① 삭제 · 「삽입은 3분 규약」 절 한 줄 | D9·D12 |
| G18 | §9-2 ⑬ 68b 하니스 118건 재실행(S0 완료 조건) | R10 |
| G19 | `commitComposition` 반환값은 "끊었는가" — 호출부가 쓸 일은 없고 진단 로그용(`diag`) | — |
| G20 | 윈도우 검수는 Breevy·PowerToys를 끈 채(68b 교훈 — Tab keydown을 삼킨다) | 메모리 규약 |
