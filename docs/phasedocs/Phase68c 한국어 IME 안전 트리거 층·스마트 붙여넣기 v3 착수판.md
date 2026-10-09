# Phase 68c 한국어 IME 안전 트리거 층·스마트 붙여넣기 — v3 착수판 (확정본 · 구현 기록 §11)

- 계보: 카탈로그 v1 우선순위 3·4 → v1 web(`fbe6eac`) → v2 CLI 교차검토(정정 E1~E18 · 보완 G1~G20 · Q1~Q11) → v3 web 재검증 착수판(정정 F1~F8 · 보완 H1~H8 · Q12~Q14) → **구현(2026-10-09, CLI — §11)**
- 작업물: `docs/phaseSketch/Phase68c … 구현 계획서 v1.md`·`v2.md`(v3 원문은 web 대화). **이 문서가 유일한 사양이다**
- 덕수 판정: P2(실측 — Mac Chrome 390 한글 모드 ⌘B·⌘J·⌘F 정상, `e.code` 전환은 통일·Windows 대비로 유지) · P6(a) · **P9(b) 동적 import** · 나머지 P1~P14·Q1~Q11 권장안 · **Q12·Q13·Q14 권장안(2026-10-09)**

---

## 0. 요약 (구현된 상태)

| 묶음 | 68c 이전 | 68c 뒤 |
|---|---|---|
| A. React 입력창 Enter | 가드 없음 9곳 · `isComposing`만 6곳(Safari 꼬리 keydown 229를 못 거른다) | `lib/imeKey.isImeKey` 15곳 통일 |
| A. window 단축키 | `⌘F`·`⌘B`·`⌘J`가 `e.key` · 조합 가드 0 · `⌘⇧B`는 옛 `'b'` 비교가 암묵 배제 | `e.code` + `!shift·!alt·!repeat` · 문서를 바꾸는 셋(`⌘B`·`⌘J`·`⌘⇧L`)은 **항상** 핸들 `whenSettled` — 조합 중이면 compositionend 뒤, 아니면 `flushMathAscii` 후 즉시 · 최신 핸들러 ref |
| A. 편집기 삽입 핸들 | 조합 가드 0 | 여섯(편집창 `insertText`·`insertInlineMath`·`insertBlockMath`·`insertPlainText`·`insertMathSnippet` + 댓글 `insertAtCursor`) 머리에 `commitComposition` |
| A. 조합 대기 로직 | `composingRescue`(68b) 안에만 | 공용 `runAfterComposition`(skipIf·defer) — `composingRescue`가 그 위로 재작성(동작 동일, CDP 118/118) |
| B. 평문 붙여넣기 | 편집창 `stripInvisibles`만 · 댓글 필터 0 | 두 편집기 `createMathPaste` — `stripInvisibles` → 구분자 정규화(`\(`→`$` · `\[`→펜스형 `$$`) → 수식 안 유니코드→LaTeX·전각→ASCII |
| B. HTML 붙여넣기 | 없음(text/plain만) | `<math`가 있을 때만: `DOMParser` → `lib/snodeDom.htmlToSNodes`(수식 호스트 정규화) → **61c `serializeNodes`**(굵게·목록·표·링크까지) → 같은 정규화. annotation 없는 `<math>`는 `mathml-to-latex` **동적 import** |

**서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 규약 0 · 렌더 5사이트 0 · 폰 0 · 아이콘 0 · localStorage 0.** 신설 `lib/imeKey.ts`(import 0) · `lib/mathPaste.ts`(순수) · `lib/snodeDom.ts`(브라우저 — 61c 어댑터 이관) + 테스트 2(`test:imekey` 6 · `test:mathpaste` 10) · 의존성 +1(`mathml-to-latex` 1.8.0, MIT — 지연 청크 전용). 작업 규칙 9 미통일 ①(붙여넣기 정규화) **해소**.

---

## 1. 실측 근거 (구현 시 재확인 — HEAD `4283b69` 기준)

- **CM 붙여넣기**: `handlers.paste`는 `observer.flush()` 뒤 text/plain(없으면 uri-list)만 읽어 `doPaste` → `clipboardInputFilter(text, state)` → `userEvent 'input.paste'`. drop도 같은 필터(`dropText`). 플러그인 `domEventHandlers`는 내장보다 먼저 돌고 `true`면 `preventDefault` + 중단(view dist `computeHandlers`·`runHandlers`)
- **CM 조합**: keymap·키 핸들러는 `composing > 0`이면 돌지 않는다(`ignoreDuringComposition`, 키 이벤트만). compositionend 관찰자는 동기(`composing = -1`), 남은 DOM 변경 flush는 microtask. Safari 꼬리 Enter는 CM이 `compositionPendingKey` 100ms 창으로 거른다
- **68a 리스너**는 한글이 들면 userEvent 무관하게 큐에 올리고 `input.paste`·자기 트랜잭션만 뺀다 → 붙여넣기 dispatch는 **반드시** `input.paste`
- **미리보기·인쇄는 렌더 시 `\(`→`$`·`\[`→`$$`를 이미 한다**(`EditorPreview.preprocessMath`·`lib/preprocess.ts`) — 붙여넣기 변환의 근거는 화면이 아니라 **저장 정본 통일**·정돈 R3가 `\[`만 다룸·인용 앵커·68b 나오기 ③
- **61c에 같은 직렬화기가 있다** — `lib/chatExtract.serializeNodes`(수식 호스트·`strong`·목록·표·`$` 이스케이프·`SKIP`)와 DOM 어댑터 `fallbackMath`·`toSNodes`(annotation → `stripPreviewArtifacts` → display 판정). 붙여넣기는 이것을 **재사용**한다(Q12)
- **`ALL_SYMBOLS`**: 564 중 1코드포인트 비ASCII 448 · 백슬래시 명령 443(전부 katexSupported) · 구조형 9(`˙→\dot{}`…) · 표에 없음 `≠`·`⋯`·`·`·`″` · 정본과 다름 `√→\surd`·`°→\degree`·`′→\prime`. 68c 필터(순수 명령 또는 ASCII 한 글자) 기준 표 **388종**, 중복 기호 **43종**(v2의 42 + `∗`의 `*`/`\ast`)
- **`math-symbols`는 이미 공용 확장의 import 범위**(`latex-completions` 경유) — 붙여넣기 표가 공개 라우트 번들을 늘리지 않는다
- **prelaunch 1번**(`docs/prelaunch-bug-cleanup.md` — 조합 중 ⌘B 끝글자 중복 `# 수정은`→`# 수정은은`): 과거 **blur 강제 커밋 · 60ms 고정 지연 + forceFlush가 효과 없었고 CDP로 재현되지 않는다**. v1~v3 모두 이 기록을 보지 않았다(§11-2 I7)

---

## 2. 결정 (구현된 그대로)

### A. IME 안전 트리거 층

| # | 결정 |
|---|---|
| D1 | `lib/imeKey.isImeKey(e)` = `isComposing ‖ nativeEvent?.isComposing ‖ keyCode === 229`. React 입력창 Enter는 `if (e.key === 'Enter' && !isImeKey(e))` — 15곳(FindReplacePanel·탭 이름·UnifiedToolbar 2·UserGroupEditor·BazaarView·SheetImportModal·PhoneBazaar·settings · DialogHost·NicknameSetupModal·VersionDrawer·CommentPanel 2·FolderView) |
| D2″ | window 단축키(`EditorView`): `⌘F`·`⌘B`·`⌘J` = `e.code` + `plain`(`!shift && !alt && !repeat` — `⌘⇧B` Chrome 북마크 바·`⌘⌥B`는 브라우저에). `⌘⇧L`은 `shift && !repeat && KeyL`. 문서를 바꾸는 셋은 **항상** `settled(run)` → 활성 블록 핸들 `whenSettled(run, { composingAtKey: isImeKey(e) })`(핸들 없으면 즉시). `run`은 **`latestShortcutRef`**(매 렌더 최신 `handleSplitBlock`·`handleAIComplete`·`handleSplitMathLines`·`activeBlockId`)를 부른다. `⌘J`·`⌘⇧L`은 키 시점 블록 id를 고정. `preventDefault`는 keydown에서 |
| D2a | `whenSettled`: 편집기에 **포커스가 없으면 즉시**(조합은 제목·탭 이름 입력창의 것) · 있으면 `runAfterComposition` |
| D2b | `runAfterComposition(view, fn, { composingAtKey, defer, skipIf, label })`: `!composingAtKey && !defer && !live`면 `flushMathAscii` 후 **동기 즉시**. 아니면 20ms 폴링으로 `!composing && !compositionStarted`를 기다리고, `composingAtKey`인데 compositionend를 못 봤으면 60ms grace(윈도우 순서), 800ms 포기, 지연 실행은 `hasFocus`일 때만, 실행 직전 `flushMathAscii`. 반환 = 취소 함수. `composingRescue`는 `defer: true` · `composingAtKey: 키 시점 조합` · `skipIf: ev.defaultPrevented` · 새 키가 오면 옛 대기 취소 |
| D3 | `commitComposition(view)`: `compositionStarted && hasFocus`면 `contentDOM.blur()` → `focus({preventScroll})`, 그래도 `compositionStarted`면 합성 compositionend(68a와 같은 안전망) → **`flushMathAscii`**. 반환 = 끊었는가. 삽입 핸들 여섯 머리 + 핸들 메서드(두 편집기). **키 경로에는 쓰지 않는다**(E7 — IME가 그 키로 확정 중) |
| D4 | "조합 중 무시"가 아니라 "확정 뒤 실행". 키 경로 = 지연(D2b), 프로그램 경로 = 즉시 확정(D3) |

### B. 스마트 붙여넣기

| # | 결정 |
|---|---|
| D5 | `lib/mathPaste.smartPasteText(text, doc, from, to)`: ① `stripInvisibles` ② `normalizeMathDelimitersForPaste` — 순차 스캐너: 코드 펜스·인라인 코드·기존 `$$…$$`·`$…$`·`\\`·`\$` 보존, `\(…\)`→`$…$`(안쪽 trim · 인접 `$`면 공백 하나), `\[…\]`→`$$\n…\n$$`(같은 줄 앞뒤에 글자가 있으면 줄바꿈 하나씩 — §11 I3), 닫는 짝 탐색은 `\\`를 짝으로 건너뜀(`\\[4pt]`), 인라인은 빈 줄을 넘지 않음, 미닫힘·빈 짝 무접촉 ③ 붙인 결과 문서를 `scanMathRegions`로 스캔해 **붙인 구간과 겹치는 영역 안** − `\text{…}` 계열 인자(`TEXT_CMDS` + `readGroup`)만 `convertUnicodeMath` |
| D6′ | 표 = `ALL_SYMBOLS` 필터(1코드포인트 비ASCII · katexSupported · 순수 명령 `\[A-Za-z]+`·`\기호` 또는 ASCII 한 글자 · 항등 제외) → **최단형, 동률이면 id 오름차순** → `PREFERRED`(`∥→\parallel` `∣→\mid` `⊥→\perp` `←→\leftarrow` `△→\triangle` `∅→\varnothing` `¬→\neg` `∧→\wedge` `∨→\vee` `…→\cdots` `∫→\int` `†→\dagger` `‡→\ddagger` `⊨→\models` `□→\square` `◊→\lozenge`) → `OVERRIDES`(`≠→\ne` `⋯→\cdots` `·`·`⋅→\cdot` `×→\times` `÷→\div` `−→-` `′→'` `″→''` `‴→'''` `°→^\circ`). `√` → `\sqrt` + `(…)`는 `{…}`(재귀 변환), `{`면 그대로, 아니면 다음 토큰 하나(숫자 런·영문자·`\명령`·표의 유니코드). 첨자 런(위 `⁰-⁹⁺⁻⁼⁽⁾ⁿⁱ`, 아래 `₀-₉₊₋₌₍₎`·`ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼ`) → `^{…}`·`_{…}`. 전각 U+FF01–FF5E → ASCII(**`＄` 제외** — Q9) · U+3000 → 공백. 변환된 `\명령` 바로 뒤가 영숫자면 공백 하나. 한글·이미 명령형 무접촉 |
| D7″ | `createMathPaste()`(공용 확장): `paste` 핸들러는 `text/html`에 `<math`가 **있을 때만** — `DOMParser` → `htmlToSNodes(doc)` → `serializeNodes` → `smartPasteText` → dispatch(`userEvent: 'input.paste'`, `scrollIntoView`). `clipboardInputFilter`는 평문(내장 paste·drop) |
| D7a | annotation 없는 `<math>`가 있으면 `true`를 먼저 돌려주고 `import('mathml-to-latex')`(모듈 단위 1회 · 실패하면 다음 붙여넣기에 재시도) → `htmlToSNodes(doc, convert)`로 다시 → `view.state.doc === docAtPaste`면 원래 `from/to`, 아니면 **현재 주 선택**(Q14). 로드 실패면 `textContent` 폴백. 편집기가 파기됐으면(`!view.dom.isConnected`) 버린다 |
| D7b | `htmlToSNodes`: 호스트 = `.katex, .katex-error, mjx-container, .mwe-math-element, math` 중 **바깥 것**. `.katex` 계열은 61c `fallbackMath`, 나머지는 `annotation[encoding=application/x-tex·TeX·application/x-latex]` → 위키는 `img[alt]` → 없으면 bare. `{\displaystyle …}` 껍질 벗김(§11 I2) → `stripPreviewArtifacts`. display = `.katex-display` 조상 ‖ `math[display=block]` ‖ `[display=true]` ‖ `.mwe-math-fallback-image-display`. 호스트 노드는 `{tag:'span', cls:['katex'], children:[], math}`(61c 무수정). `[aria-hidden=true]` 건너뜀(시각 사본) · `head/meta/title/link/template` 버림 · `pre` → `div`+textContent(D8a) · 텍스트 노드는 HTML 공백 규칙으로 접고 블록 컨테이너의 공백뿐 노드는 버림(§11 I1) · 표는 `complete` |
| D8′ | `<math` 없는 HTML은 보지 않는다(평문). `<math` 있는 HTML은 61c 규칙대로 굵게·목록·표·링크·인용도 마크다운(Q12) |
| D9 | 두 편집기 같은 확장. 편집창의 옛 `clipboardInputFilter.of(stripInvisibles)`는 흡수 |
| D10·D11 | drop은 평문 필터만 · undo 1스텝 · 토글 없음 · `⌘⇧V`는 평문 경로(Mathory 미리보기 복사의 text/plain은 KaTeX 글자 나열 — 알고 두는 손실) |
| D12′ | CLAUDE.md: 「Korean IME」 절 68c 단락 · 「붙여넣기는 `createMathPaste` 하나다」 절 · 「삽입은 3분 규약」 절 한 줄 · 파일 구조 · 작업 규칙 9 목록 ① 삭제 |

---

## 3. 위험 (남은 것만)

| # | 위험 | 상태 |
|---|---|---|
| R1 | `commitComposition` blur를 CM이 본다(자동완성 닫힘 · 끔 모드 scrollLeft 복원) | 수용 — 삽입 직전. 실물 §9-3 3 |
| R3 | 수식 안 의도된 유니코드가 명령으로 | 수용 — 같은 모양. 빼려면 `PREFERRED`/`OVERRIDES`/필터 |
| R7 | annotation 없는 `<math>` | `mathml-to-latex`(`\leq` 꼴 출력 — 정본 `\le`와 다른 긴 꼴이 들어온다, 알고 두는 차이) |
| R12 | 번들 | **확인됨** — 라이브러리 본체(xmldom·변환기)는 지연 청크 2개(약 170KB)에만, 진입 청크에는 `import()` 참조 한 줄 |
| R17 | HTML 경로의 텍스트 속 날것 `\[…\]`는 61c `normalizeMathDelimiters`가 한 줄 `$$…$$`로 만든다(평문 경로는 펜스형) | 수용 — 61c 무수정 |
| R19 | ~~prelaunch 1번은 미검증~~ | **해결(2026-10-09 덕수 실물 — Mac 크롬 "아주 완벽하게 작동")**. 과거 실패한 고정 60ms 지연과 달리 실제 compositionend를 기다린 것이 처방 — 되돌리지 말 것 |

---

## 8. 작업 순서 (실행됨)

S0 `isImeKey`·15곳·`runAfterComposition` → S1 `lib/mathPaste` → S2 `lib/snodeDom`(61c 이관)·`mathml-to-latex` → S3 `createMathPaste`·`commitComposition`·핸들 → S4 window 단축키 → 후속 1(포커스 없는 `whenSettled` 즉시) → S5 문서

## 9. 검증

### 9-1. 자동 — +16건(`test:imekey` 6 · `test:mathpaste` 10) · 실측 26종(test:rules 제외) **573건 전부 통과**(2026-10-09 — 68b 문서의 "606"은 다른 기준으로 센 값이라 그대로 더하지 않는다)

- `test:mathpaste` 10: 구분자(펜스형 · `\\[4pt]` · 이스케이프 · 미닫힘 · 빈 짝 · 코드 · 기존 수식 · 인접 `$`) · 표 대표 28종 · 결합 문자·항등·한글 부재 · **중복 43종 스냅샷** · 변환(공백 · 첨자 런 · `√` 토큰 · 전각 · `＄`) · 영역(수식 안 커서 · 본문 · 평문 `$` · 본문 전각 · 기존 수식 · `\text{}` · 선택 대체) · URL·파일명 · 폭 0
- 회귀: `test:extract` 42(v3가 적은 52는 오기) · `test:invisibles` 8 · `test:proofread` 50 · `test:mathregions` 13 · `test:mathascii` 32 · `test:mathinput` 19 · `test:tidy` 21 · tsc · `npm run build`(`[icons:check] OK — 62종`)

### 9-2. headless CDP — 68c **35/35** · 68b **118/118**

하니스 `docs/phaseSketch/phase68c-cdp-harness.mjs` + 라우트 소스 `phase68c-dev68c-page.tsx.txt`(복사해 `app/dev68c/page.tsx`, 같은 폴더에 `OldSIP.tsx` = `git show 5690a77:components/comment/SelectionInsertPopup.tsx`). 붙여넣기는 페이지 안 합성 `ClipboardEvent` + `DataTransfer`(KaTeX 표본은 `katex.renderToString`). window 단축키는 dev 페이지의 ⌘B 리스너(EditorView D2″와 같은 꼴 — 실행 시점 문서를 기록)로.

- 평문 7: `\(a\)` · `\[a\]` 펜스형 · 수식 안 `α≤β` · 본문 무변환 · 수식 안 한글 68a 무재생 · 댓글 2
- HTML 12: KaTeX 인라인(평문 글자 나열 안 들어감) · Mathory 흔적(`\displaystyle`) · display + `\tag*{(1)}` → `\tag{1}` · MathJax 3 · 위키(껍질 · 한 번) · 굵게·목록·표 혼합 · `pre` + `\$5` · annotation 유니코드 ③ · `<math` 없음 → 평문 · 한글 68a 무재생 · 댓글 · `maxLength` 차단
- bare 2: 로드 중 문서 수정 → 현재 커서(Q14) · display → 펜스형
- window 7: 평소 즉시(동기) · `code`만 맞는 `ㅠ` · `⌘⇧B`·`⌘⌥B` 미발화 · 조합 중 → compositionend 뒤(확정 글자 포함 · 키 시점 미발화) · compositionend 미도착 → 미실행 · 윈도우 순서 grace · 즉시 갈래 68a flush
- 핸들 5: 조합 중 `insertPlainText`·`insertMathSnippet`·`insertInlineMath`·댓글 `insertAtCursor`(확정 뒤 · 고착 없음) · 평소 undo 1
- 61c 1: `serializeSelection` 이관 전후 **바이트 동일**(수식·표·목록·`\tag`·`\$`·마커 문단)
- ⚠ 이 하니스는 **합성 composition**이다 — prelaunch 1번(실 IME 전용)은 못 본다

### 9-3. 실물 (덕수)

1. Windows Chrome 한글 모드 `Ctrl+B`·`Ctrl+J`·`Ctrl+F` 발화(Breevy·PowerToys 끈 채)
2. 한글 `함수 f` 조합 끝나기 전 `⌘B` → `함수 f` 뒤에서 갈리고 유실·중복 없음 · `⌘J` 동일
2′. ✅ **(2026-10-09 통과 — prelaunch 1번 해결)** **prelaunch 1번 재현 표본 그대로** — `# 수정은`의 `은`을 조합 중(밑줄)인 채 `⌘B` → `# 수정은은`이 되는가. 안 되면 prelaunch 1번을 해결로 옮긴다(68c D2″의 효과). 되면 원인이 실행 시점이 아니라 CM 조합 반영 자체 — prelaunch 문서의 이분 탐색 계획으로
3. 끔 모드 긴 수식에서 조합 중 툴바 `\frac` 클릭 → 가로 위치가 커서를 따라간다
4. 찾기 패널 한글 질의 중 Enter — 마지막 글자 살고 "다음" 한 번(Safari 특히)
5. 탭 이름 `풀이2` 입력 중 Enter
6. ChatGPT 답변 복사 → `\( \)`·`\[ \]` 변환, 수식은 원 LaTeX, 평문 기호 나열 없음, 굵게·목록 마크다운
7. Mathory ProblemView 복사 → 흔적 없음 · 표·굵게 마크다운 · 위키 수식 문단 · Math StackExchange(MathJax)
8. HWP 문단(`（가）`·`×`·`≤`) — 본문 전각 그대로, `$…$` 안만
9. 그림 드롭·URL 붙여넣기 무변화
10. Safari: 2·4 + 조합 중 툴바 클릭(조합 유실·중복 없음)

---

## 11. 구현 기록 (2026-10-09 CLI)

### 11-1. 커밋

| 커밋 | 내용 |
|---|---|
| `5690a77` S0 | `isImeKey` + 15곳 · `runAfterComposition` + `composingRescue` 재작성 · CDP 68b 118/118 |
| `b3c308d` S1 | `lib/mathPaste` + `test:mathpaste` 10 |
| `7e4758b` S2 | `lib/snodeDom`(61c 어댑터 이관 + `htmlToSNodes`) · `mathml-to-latex` |
| `3a5e7aa` S3 | `createMathPaste` · `commitComposition` · 핸들 · 두 편집기 · CDP 68c 35/35 |
| `650275d` S4 | window 단축키 |
| `e954e1f` 후속 | 포커스 없는 `whenSettled` 즉시 |
| S5 | 문서(이 확정본 · CLAUDE.md · roadmap · prelaunch 1번 메모) |

### 11-2. v3 대비 이탈·보완 (I1~I8)

| # | 내용 |
|---|---|
| I1 | **HTML 공백 접기** — 61c는 React DOM이라 소스 공백이 거의 없었지만 외부 페이지 HTML은 텍스트 노드에 줄바꿈·들여쓰기가 남는다. 어댑터가 `[ \t\n\r\f]+` → 공백, 블록 컨테이너의 공백뿐 노드는 버림(표본: 목록·표 혼합) |
| I2 | **위키 `{\displaystyle …}` 껍질** — `stripPreviewArtifacts`는 `\displaystyle`만 지워 `{…}`가 남는다 → 바깥 중괄호째 벗김 |
| I3 | **`\[…\]` 펜스는 자기 줄** — 문장 중간이면 `$$`가 행 중간이라 remark-math가 display로 안 읽는다 → 같은 줄 앞뒤 글자가 있으면 줄바꿈 하나씩(빈 줄은 저장 정규화 몫 그대로) |
| I4 | **`defer` 옵션** — v3 `composingAtKey` 하나로는 `composingRescue`의 조합 밖 229(68b F3)가 20ms → 60ms(grace)로 바뀐다. "즉시 갈래 금지"와 "grace"를 분리 |
| I5 | **`whenSettled` 포커스 없음 → 즉시** — 조합이 다른 입력창의 것이면 지연 갈래의 `hasFocus` 조건에 걸려 ⌘B가 사라졌다 |
| I6 | **`commitComposition` 합성 compositionend 안전망** — 68a와 같은 장치. 합성 조합 하니스에서는 이것 없이 `compositionStarted`가 고착됐다 |
| I7 | **prelaunch 1번** — v1~v3가 놓쳤다. 과거 실패한 처방(blur 강제 커밋 · 고정 60ms 지연)과 68c 키 경로(실제 compositionend 대기)의 차이를 R19·§9-3 2′로 |
| I8 | 수치 정정 — 표 388종 · 중복 43종(필터 기준) · `test:extract` 42(v3 "52") · 아래첨자 영문자(`ₙ`·`ᵢ`…) 추가(`aₙ₊₁` → `a_{n+1}`) |

### 11-3. 알고 두는 것

- `mathml-to-latex`는 긴 꼴(`\leq`)을 낸다 — ③은 유니코드만 바꾸므로 그대로 들어간다
- `α≤β` → `\alpha\le\beta`(명령 사이 공백 없음 — TeX상 유효. 뒤가 영숫자일 때만 공백)
- `\le3`이 KaTeX 오류라는 v1 서술은 틀렸다(TeX 명령 이름은 글자만) — 공백은 가독성 때문에 둔다
- 하니스는 dev 페이지 리스너로 window 단축키 모델을 본다 — `EditorView` 본체의 ⌘B·⌘J 경로는 실물(§9-3 2)
