# Phase 68b 수식 입력 단축키 정비(Ctrl+M · Ctrl+Shift+M · Tab 탈출) 구현 계획서 v4 착수판

- 작성: CLI Claude · 2026-10-08 — web v3를 **HEAD `38672f0`**(68a 검수 종결)과 CM dist(`view 6.39.14` · `commands 6.10.2` · `w3c-keyname 2.2.8`)에 다시 대조. v3의 정정 F1~F3 · 보완 H1~H5 · Q11은 **전부 실측과 일치**(v3 §0-1 실행 프로브 11건을 CLI가 재실행 — 저장 정규화 5 · 스캐너 6 전부 같은 결과). v4는 **덕수 확정(Q1~Q11 전부 권장안, 2026-10-08)**을 결정으로 굳히고, 구현에 필요한 세부 셋(I1~I3 — `emptyDisplayDeleteRange` 범위·커서 · `exitRegionAt` ④ 가드 · 수치 보정)을 더했다(부록 E). 바뀐 곳은 `[v4]`
- 계보: 연구 v1(web) → 계획 v1(web) → **v2 CLI 교차검토 + 독립 검증 에이전트 1회**(E1~E13 · G1~G12 · R-1~R-5) → **v3 web 재검증**(F1~F3 · H1~H5 · Q11) → **v4 CLI 착수판**(본 문서)
- 관계: **68a와 독립**(코드 접점 0 — 68a keydown capture는 수정자 조합을 `pass`, updateListener는 우리 dispatch를 비자격으로 본다. A14·H3)
- 다음 단계: **CLI 착수**(§8 S1~S6) → 덕수 실물(§9-2)

---

## 0. 요약

| 기능 | 현행 | 변경 후 |
|---|---|---|
| 인라인 수식 삽입 | `Ctrl+N` → `M`(1초 연타) · 툴바 `$` | **`Ctrl+M`**(Mac도 Control) · Word 별칭 `Alt+=`(Win)·`Control+=`(Mac) · 툴바 `$`(동일 함수) |
| 독립행 수식 삽입 | `Ctrl+N` → `N` · 툴바 `$$`(**다른 삽입 경로** — C2) | **`Ctrl+Shift+M`** · 툴바 `$$`(같은 함수 — Q1) |
| 수식에서 한 번에 나오기 | `Shift+Esc`(가장 안쪽 괄호·수식) | **수식 안에서 `Ctrl+M`·`Ctrl+Shift+M`** · `Shift+Esc`는 HWP 호환 별칭(수식 나오기만 · 항상 소비). **빈 쌍 `$|$`·빈 블록 `$$\n|\n$$`에서는 지운다**(Q8·Q11) |
| 수식에서 한 칸씩 나오기 | Tab ⑤ 그룹 탈출 · ⑥ 인라인 `$` 밖 | 그대로 + **⑥′ 닫힌 display 식 끝에서 밖으로**(Q4) |
| 댓글 편집기 | `Ctrl+N` 연타 별도 구현 · 삽입 텍스트도 다름 | 같은 키 · **같은 삽입 함수**(Q2) |

고치는 이유 셋(연구 v1 §1): ① `Ctrl+N`은 Windows 브라우저 예약 키라 연타가 시작조차 안 된다 ② `Shift+Esc`는 탈출할 곳이 없으면 브라우저로 넘어가 Windows 작업 관리자가 뜬다 ③ 3타 → 2타, 손에 익은 M은 남는다.

**서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 0 · 전처리 0 · 렌더 5사이트 0 · 폰 0 · 아이콘 0 · localStorage 0.**
코드 수정 7파일(`lib/mathRegions.ts` · `lib/mathAscii.ts`(re-export) · `lib/mathInput.ts` · `lib/math-editor-extensions.ts` · `MarkdownEditor.tsx` · `EditorView.tsx` · `UnifiedToolbar.tsx`) + `LatexInputEditor.tsx` 2줄 + 테스트 2 + 문서 3 · 신규 0 · 순삭제 약 260줄. 테스트 수는 구현 시 확정(`test:mathregions` 10 → 12 · `test:mathinput` 13 → 25 안팎).

### 0-1. 덕수 확정 (2026-10-08) — Q1~Q11 전항 권장안

| # | 확정 | 결정 번호 |
|---|---|---|
| Q1 | 툴바 `$$` 버튼 = `insertDisplayMathBlock`(핸들 `insertBlockMath()`) | D2 |
| Q2 | 삽입 2함수를 `lib/math-editor-extensions.ts`로 — 댓글 편집기와 한 벌 | D11 |
| Q3 | 닫힌 `$$`에서 나올 때 다음 행이 없거나 비공백이면 `\n`을 넣어 빈 행을 만들고 그 행 | D5 ②-b |
| Q4 | Tab ⑥′는 닫힌 display 전부(`$$`는 다음 행 · `\[`는 `\]` 뒤) | D7 |
| Q5 | 미닫힘(행 끝 `$$\|` 포함)은 `region.to`로 이동만 | D5 ③ |
| Q6 | `findMathRegion` 사본 2벌 → `mathRegionAt(scanMathRegions)` | D10 |
| Q7 | `chordListener` 반환 삭제 · `LatexInputEditor` 2줄 | D11 |
| Q8 | 빈 쌍 `$\|$`에서 `Ctrl+M`·`Ctrl+Shift+M`·`Shift+Esc` = 쌍 삭제 | D5 ① |
| Q9 | `probeInsertionRegion`을 `lib/mathRegions.ts`로, `mathAscii`는 re-export | §4-1 |
| Q10 | `Shift-Escape`에 `stopPropagation` 없음(preventDefault뿐) | D6 |
| Q11 | 빈 블록 `$$\n\|\n$$`에서 같은 키 = 블록 삭제(Tab ⑥′는 나가기만) | D5 ①′ · D7 |

### 0-2. v2·v3 실행 프로브 재실행 (CLI, 2026-10-08 — 컴파일된 `lib/preprocess`·`lib/mathRegions`)

| 입력 | 결과 | 뒷받침 |
|---|---|---|
| `normalizeDisplayMathSpacing("abc $$\n\n$$\nfoo\n$$")` | `"abc\n\n$$\n\n$$\n\nfoo\n$$"` | R11 — 빈 쌍의 `$$`가 다음 블록과 짝지어진다 → Q8 삭제 |
| `…("foo $$x$$ bar")` | `"foo\n\n$$x$$\n\nbar"` | C5·F1 — 한 줄 `$$`도 저장에서 갈린다 |
| `…("a $$ b")` | 무변경 | (c) 빈 쌍은 정규화 무접촉 |
| `…("foo\n\n$$\n\n$$\n\nbar")` | 무변경 | ①′ 삭제 전 모양이 곧 정규형 — `emptyDisplayDeleteRange` 결과(`foo\n\nbar`)도 정규형 |
| `mathRegionAt("abc $$", 5)` | **OUT** | R-1 — 행 끝 `$|$`는 밖 → D5′ probe 필요 |
| `mathRegionAt("abc $x$", 5)` | inline closed inner 5-6 | probe가 안으로 돌린다 |
| `mathRegionAt("abc $$", 6)` | display **closed=false** inner 6-6 | H2 — 행 끝 `$$|`는 미닫힘 display 안 → Q5 |
| `mathRegionAt("$$$$", 2)` | display closed inner 2-2 | 한 줄 빈 블록도 ①′(`isEmptyDisplay`) |
| `mathRegionAt("a $$ b", 3)` | inline `$$` **empty=true** inner 3-3 to=4 | H1 — 행 중간 `$|$`는 probe 없이 ② |
| `mathRegionAt("foo\n\n$$\n\n$$\n\nbar", 8)` | display closed inner 7-9 to=11 | ①′ 대상 |

---

## 1. 선행 확인 — 실측 (HEAD `38672f0`)

### 1-A. 블록 편집기 `components/editor/MarkdownEditor.tsx` (1506행)

| # | 사실 | 위치 | 68b에 주는 것 |
|---|---|---|---|
| A1 | `insertInlineMathIn(view)` — 인접 `$` 공백 · 선택 감싸기 · `userEvent: 'input'` · `view.focus()`. 모듈 수준, `view`만 닫는다 | `:253-263` | **lib로 이동**. 핸들 `insertInlineMath()` `:544-548`이 툴바 `$` 경로. 인터페이스 `:207-210` |
| A2 | `findInnermostExit` — 모듈 수준 사본(주석 `:265`). 소비처 `Shift-Escape` `:930` 하나 | `:267-345` | 삭제 |
| A3 | `findMathRegion` — 모듈 수준 사본(주석 `:347`). 소비처 `jumpToNextBrace` `:401` 하나 | `:348-395` | 치환·삭제 |
| A4 | `jumpToNextBrace(view)` — Alt-Tab 전용, `view`만 닫는다 | `:398-412` | lib로 이동, 영역 판정만 치환 |
| A5 | `chordPendingRef`·`chordTimerRef` | `:486-487` | 삭제 |
| A6 | `mathTab` ⓪ composing → ① completion → ② abbrev → ③ `hasActiveSlots` → ④ env `&` → ⑤ `nextSlot` → ⑥ inline(`region.kind === 'inline' && region.closed && !region.empty`) → ⑦ | `:761-791`(⑥ `:785-788`) | ⑥′를 ⑥ 바로 뒤에 |
| A7 | `mathKeys = Prec.high(keymap.of([Tab, Enter]))` | `:812-815` | 무변경 |
| A8 | `insertDisplayMathBlock(view)` — 마운트 effect 안 지역 함수지만 `view` 외엔 닫지 않는다. 공백 흡수 · 문서 시작/끝 패딩 생략 · `$$\n\n$$` · 커서 빈 줄. `userEvent`·`scrollIntoView` 없음. **선택 무시**(`from`만) | `:885-903` | lib로 이동 + 선택(D2′) |
| A9 | `mathShortcuts = Prec.highest(keymap.of([...]))`: `Ctrl-n` `:907-923` · `Shift-Escape` `:925-940` · `Alt-Tab` `:942-945` · `Ctrl-Alt-1~9` `:946-956` | `:906-958` | 교체 |
| A10 | `chordListener` — `event.code === 'KeyM'/'KeyN'` | `:961-986` | 삭제 · 등록 `:1002` 삭제 |
| A11 | extensions `disableBuiltinSearch, mathShortcuts, chordListener, mathKeys, slotsField, basicSetup, …` | `:1000-1005` | 한 줄 빠진다 |
| A12 | cleanup `clearTimeout(chordTimerRef)` | `:1479` | 삭제 |
| A13 | 옛 키 주석 — `:207`·`:250`("Ctrl+N,M") · `:265` · `:347` · `:753`("Ctrl-m / mac Shift-Alt-m") · `:905`·`:941` | — | 갱신 |
| A14 | 68a 래퍼 capture keydown `onMathAsciiKeydown` `:1441-1462` → `classifyKey`(`lib/mathAscii.ts:82`) — **`ctrlKey‖metaKey‖altKey`면 첫 줄에서 `pass`**(preventDefault·stopPropagation 없음). updateListener(`:1129-1156`) — `needsReplay(s, ue, live)`(`mathAscii.ts:187-191`)는 한글 없는 삽입 + `input`을 비자격으로 보고, 한글이 든 삽입(D2′·인라인 감싸기)은 자격 판정 위치 `fb`(삽입 시작)가 `$`·패딩 자리라 `mathRegionAt`이 **밖** → 비자격(H3) | — | `Ctrl+M`·`Alt+=`·`$`·`$$` 삽입·`\n` 삽입·블록 삭제 전부 68a 무간섭 |
| A15 | 68a K8 `probeInsertionRegion(doc, pos)`(`lib/mathAscii.ts:256-259` · 주석 `:251-254` · `ProbeResult` `:255`): 글자 하나를 넣어 본 문서로 판정 | — | **나오기 판정의 원천**(D5′) |

### 1-B. 댓글 편집기

| # | 사실 | 위치 |
|---|---|---|
| B1 | `createMathShortcuts()` — `chordState` · `Ctrl-n`(2연타 = 블록) · `Shift-Escape`(`findInnermostExit`) · `Alt-Tab`(`findMathRegion`) · `chordListener`(M → `$$` 커서 가운데 / N → `\n$$\n\n$$\n`) | `lib/math-editor-extensions.ts:196-297` |
| B2 | `findInnermostExit`(`:25-96`) · `findMathRegion`(`:101-145`) export — 파일 밖 소비처 **0** | — |
| B3 | 소비처: `LatexInputEditor.tsx:58`(`shortcuts`·`chordListener` → extensions `:67-68`) → `CommentEditor.tsx:236` · `PublicComments.tsx:165` 둘뿐 | — |
| B4 | 댓글 편집기 keymap `keymap.of([Mod-Enter, ...historyKeymap, ...defaultKeymap])` — Windows `Ctrl-m` = `toggleTabFocusMode`가 산다 → `shortcuts`가 `Prec.highest`라 덮인다 | `LatexInputEditor.tsx:95-102` |
| B5 | import 그래프 — `mathRegions` → 0 · `latexScan` → 0 · `mathInput` → `mathRegions`·`latexScan` · `latex-completions` → `math-symbols`·`mathRegions` · `mathAscii` → `mathRegions`·`latexScan`. `math-editor-extensions`에 `./mathInput`·`./mathRegions`를 더해도 순환 없음 | — |
| B6 | 옛 키 주석 `:6-9`·`:23`·`:99`·`:189` | — |

### 1-C. 툴바·EditorView·저장 정규화·문서

| # | 사실 | 위치 |
|---|---|---|
| C1 | `$` 버튼 → `onInsertInlineMath` → EditorView `handleInsertInlineMath`(`:2504-2506`) → 핸들 `insertInlineMath()`. `$`·`$$` 버튼은 `!cursorInMath` 갈래라 수식 안에서는 보이지 않는다 | `UnifiedToolbar.tsx:640·865` |
| C2 | **`$$` 버튼 → `onInsert('$$\n\n$$', 3)`** → EditorView `handleInsert`(`:2498-2502`) → 핸들 `insertText`(`:517-539`) — 빈 줄 패딩·공백 흡수 **없음**, **dispatch 2회**(undo 2스텝). 주석 `:199-200` | `UnifiedToolbar.tsx:641·869` |
| C3 | OS 라벨 선례 `getModLabel()` — `typeof navigator` 가드 | `MathSnippetMenu.tsx:42-45·72` |
| C4 | 단축키 문서: CLAUDE.md 「편집창 Tab은 편집창 것이다」 · 「`$` 버튼은 인접 `$`일 때만」 · 「Korean IME + CodeMirror 단축키」 · 「편집창 수식 스캐너는 `lib/mathRegions.ts` 하나다」 사본 목록 · 68a 절 · `docs/roadmap.md:2199` · `:113-114` · `LatexInputEditor.tsx:57`. 저장소 그 밖 `Ctrl+N`·`Shift+Esc` 0건 | — |
| C5 | 저장 정규화 `toPersistedBlock`(`lib/blocks/normalize.ts:30-54`) → `normalizeDisplayMathSpacing`(`lib/preprocess.ts:35-87`) — `$$` 쌍을 `indexOf` 짝짓기로 잡아 **앞뒤 `\n\n` 강제** · `\n{3,}` → `\n\n` → 앞뒤 빈 줄 trim. 실행 결과는 §0-2 | — |
| C6 | EditorView window 핸들러(`:2822-2888`)는 Z·C·V·⌥Z뿐. document/window `Escape` 리스너 16곳은 전부 `shiftKey` 미검사 | — |

### 1-D. CodeMirror 키 매칭 — 왜 `event.code`가 아니어도 되는가 (dist 실측)

| # | 사실 | 위치 |
|---|---|---|
| D-a | `runHandlers`: 1차 `keyName(event)`(`event.key` 우선)에 `modifiers(name, ev, !isChar)`로 찾고, 실패하면 `isChar && (alt∨meta∨ctrl)`일 때 **`base[event.keyCode]`**로 다시 찾는다 — Windows `Ctrl+Alt`(AltGr)·**Mac `Alt` 단독** 제외 | view dist `:8985-9050`(폴백 `:9022-9035`) · `w3c-keyname/index.js:93-96` |
| D-b | 한글 IME `Ctrl+M`: `event.key 'ㅡ'` → 1차 `Ctrl-ㅡ` 불일치 → 2차 `base[77]='m'` → `Ctrl-m` 일치. 2벌식·390 무관 | — |
| D-c | `Ctrl+Shift+M`: `keyName 'M'` → 1차 `Ctrl-M`(isChar라 Shift 미부착) ≠ 정규형 `Shift-Ctrl-m` → 2차 `base[77]='m' ≠ 'M'` → `modifiers('m', ev, true)` = `Shift-Ctrl-m` 일치 | `:8864-8872` · `:9029` |
| D-d | Mac `Alt+=` → key `'≠'`, `browser.mac && altKey && !(ctrl‖meta)` → 폴백 제외 → `{ key: 'Alt-=', mac: 'Ctrl-=' }`(`buildKeymap` `b[platform] \|\| b.key` `:8973`) | — |
| D-e | `ignoreDuringComposition`: **`composing > 0`일 때만** key 이벤트를 버린다(+ Safari compositionend 100ms 창). 조합 밖 keyCode 229는 버리지 않지만 `base[229]`가 없어 keymap이 못 맞춘다(F3) | `:4544-4560` |
| D-f | `defaultKeymap`의 `Ctrl-m`(mac `Shift-Alt-m`) = `toggleTabFocusMode`. 완성 keymap은 `Escape`만 | commands `:1785` |
| D-g | keymap `run`이 true → CM이 **`preventDefault`만**. `stopPropagation`은 바인딩 옵션일 때만(`:9003-9005`) | `:4466-4476` |

---

## 2. 결정 (확정)

### A. 들어가기

| # | 결정 |
|---|---|
| D1 | **`Ctrl+M` = 인라인 수식**. `{ key: 'Ctrl-m', run }`(mac 지정 없음 → Mac도 Control). 수식 **밖**이면 `insertInlineMathIn`(A1 그대로) |
| D2 | **`Ctrl+Shift+M` = 독립행 수식**. `'Ctrl-Shift-m'`. 수식 **밖**이면 `insertDisplayMathBlock`. **툴바 `$$` 버튼도 같은 함수**(Q1 — 핸들 `insertBlockMath()`, undo 2 → 1스텝) |
| D2′ | 선택이 있으면 **선택 텍스트를 블록 안에** 넣고 커서는 그 끝(`$$\n선택\n$$`). 공백 흡수는 **선택 바깥쪽**(`sel.from`에서 왼쪽 · `sel.to`에서 오른쪽), 선택 본문은 `trim()` — "상하 빈 줄 정확히 1개"가 선택 유무와 무관. 선택 안의 `$`는 그대로 감싼다(인라인 감싸기의 현행 수준 — R13) |
| D3 | **Word 별칭** `{ key: 'Alt-=', mac: 'Ctrl-=', run: 인라인과 동일 }`. 툴팁엔 적지 않는다 |
| D4 | 세 바인딩 모두 `Prec.highest` keymap — D-f를 이긴다. `preventDefault`는 D-g로 자동 |

### B. 나오기

| # | 결정 |
|---|---|
| D5′ | **"안/밖" 판정의 원천은 `exitRegionAt(doc, pos)`(§4-1) 하나 — 68a와 같은 "삽입 뒤 문서" 기준**. 이유(R-1, §0-2 실측): `Ctrl+M`이 **행 끝**에 넣은 `$|$`는 스캐너가 밖이라 한다 → 두 번째 `Ctrl+M`이 `insertInlineMathIn`(인접 `$` 공백)을 돌려 `$ $|$ $`가 된다. 선택이 있으면 head·anchor 둘 다 — 하나라도 안이면 "나오기" |
| D5 | 수식 **안**에서 `Ctrl+M`·`Ctrl+Shift+M`·`Shift+Esc`·`Alt+=` = **`exitMath`**. 규칙: ① **빈 쌍**(`exitRegionAt`이 `empty`) → **쌍을 지운다**(Q8) ①′ **빈 블록**(`$$` display closed이고 안이 공백뿐 — `isEmptyDisplay`, 한 줄 `$$$$` 포함) → **블록을 지운다**(Q11 · `emptyDisplayDeleteRange` — I1) ② `$$` display **닫힘**(한 줄 `$$…$$`·펜스형·닫는 `$$` 앞에 글자가 있는 다행 — 펜스 여부 무관) → 닫는 `$$` 뒤 행 나머지가 비공백이면 `region.to`, 공백이면 **다음 행 시작**; 다음 행이 없거나 비공백이면 `\n`을 넣어 빈 행을 만들고 그 행(Q3) ③ 그 밖(인라인 `$`·`\(`·`\[`·미닫힘) → `region.to`(Q5). ②가 한 줄 `$$x$$`를 덮는 이유(F1): 저장(C5)에서 어차피 갈리므로 **화면에서도 처음부터 다음 행에 쓰게** — `region.to`든 다음 행이든 저장은 똑같이 갈린다. ⚠ 미닫힘은 이동 뒤에도 "안"이라 두 번째 키가 무동작 · 행 끝 `$$\|`(여는 `$$` 직후)도 미닫힘 display 안이라 무동작(H2) — 알고 두는 손실 |
| D6 | `Shift+Esc`는 **항상 `return true`**(수식 밖이면 소비만 → Windows 작업 관리자 차단). 괄호 탈출 역할은 빠진다(Tab ⑤). `findInnermostExit` 두 사본 삭제. "소비"는 `preventDefault`뿐(D-g · Q10) — document `Escape` 리스너 16곳(C6)은 오늘도 Shift+Esc에 반응한다(회귀 아님) |
| D7 | **Tab ⑥′**: ⑥ 뒤·⑦ 앞. 조건 = `region.kind === 'display'` ∧ `closed` ∧ `!empty` ∧ 커서 뒤부터 `innerTo`까지 공백뿐(Q4 — `$$`·`\[` 둘 다). 동작 = `mathExitPos` — `$$`는 ②(다음 행 등), **`\[…\]`는 ③ `\]` 뒤**(F2 — C5가 `\[`를 모르고 정돈 R3이 `$$`로 바꾸므로 다음-행 규칙을 `\[`에 두지 않는다). ⚠ `aligned` **본문 마지막 행 끝**은 ④(`findEnclosingEnv` `pos ≤ bodyTo`, `mathInput.ts:124`)가 먼저라 `&` — ⑥′로 나가는 자리는 **`\end{aligned}` 뒤**(R-4). 자리 활성(③)·식 중간(⑤)에서는 발동하지 않는다. **빈 블록 `$$\n\|\n$$`에서 Tab은 ⑥′로 나가기만**(블록은 남는다 — H5, Tab은 문서를 바꾸지 않는 "한 칸씩" 원칙). 지우는 쪽은 `Ctrl+M`·`Shift+Esc`(①′)뿐 |
| D8 | "펜스형" 판정 `isFencedDisplay(doc, region)`는 **정돈 R5 전용**(`layoutRowEnvs` `mathInput.ts:441-444`의 두 판정 치환). 나오기는 펜스 여부를 보지 않는다 |

### C. 정리

| # | 결정 |
|---|---|
| D9 | `Ctrl+N` 연타 **폐지**(블록·댓글 둘 다) |
| D10 | `Alt+Tab` 유지 · "Mac 전용" 문서화. 영역 판정은 `mathRegionAt(scanMathRegions)`로(Q6 — 옛 `findMathRegion`은 (c) 빈 쌍·`\[`·`\(`를 몰랐다, 개선 방향) |
| D11 | **댓글 편집기**도 같은 키 4종 + `Alt-Tab`. 삽입도 같은 함수(Q2). `chordListener` 반환은 빼고 `LatexInputEditor` 2줄(Q7) |
| D12 | 툴팁: `인라인 수식 ($…$) · Ctrl+M` / `블록 수식 ($$…$$) · Ctrl+Shift+M`. Mac `⌃M` / `⌃⇧M`. 지역 함수 + `typeof navigator` 가드 + `useMemo` |

---

## 3. 데이터 모델

없음. **서버 0 · Firestore 규칙 0 · 스키마 0 · localStorage 0 · 아이콘 0.**

---

## 4. 구현 사양

### 4-1. 순수 모듈 (`lib/mathRegions.ts` · `lib/mathInput.ts`)

```ts
// lib/mathRegions.ts (import 0 · test:mathregions) — 68a probeInsertionRegion을 여기로, mathAscii는 re-export(Q9)
export interface ProbeResult { region: MathRegion | null; probe: string }
export function probeInsertionRegion(doc: string, pos: number): ProbeResult;

/** D5′ — 나오기 판정. "삽입 뒤 문서" 기준(68a K8과 같다)
 *  ① mathRegionAt(doc)이 영역을 주고 empty=false → { kind:'region', region }
 *  ② mathRegionAt(doc)이 empty=true((c) 행 중간 `$|$`) → { kind:'empty', from: region.from, to: region.to }   (probe 불필요 — H1)
 *  ③ null이면 probe: probe.region이 null → 밖(null)
 *  ④ probe 영역이 inline ∧ 안이 probe 글자뿐 ∧ **doc[pos-1] === '$' ∧ doc[pos] === '$'**(I2 가드) → { kind:'empty', from: pos-1, to: pos+1 }  (행 끝 `$|$`)
 *  ⑤ 그 밖 → 밖(null) */
export type ExitRegion = { kind: 'region'; region: MathRegion } | { kind: 'empty'; from: number; to: number };
export function exitRegionAt(doc: string, pos: number): ExitRegion | null;

// lib/mathInput.ts (import mathRegions·latexScan · test:mathinput)
/** D8 — 정돈 R5 전용: 여는 `$$` 뒤 행 나머지 공백 ∧ 닫는 `$$` 앞 행 머리 공백 */
export function isFencedDisplay(doc: string, region: MathRegion): boolean;

/** D5 ①′ — `$$` display closed이고 안(innerFrom..innerTo)이 공백뿐(한 줄 `$$$$` 포함) */
export function isEmptyDisplay(doc: string, region: MathRegion): boolean;

/** D5 — 나오는 위치. insert가 있으면 호출부가 `{ from: at, insert }`를 함께 dispatch(pos는 적용 뒤 좌표)
 *  ③ inline(`$`·`\(`) · `\[` · 미닫힘                          → { pos: region.to }
 *  ② `$$` closed · 닫는 `$$` 뒤 행 나머지 비공백                → { pos: region.to }
 *  ②-a           · 다음 행 있고 공백뿐                           → { pos: 다음 행 시작 }
 *  ②-b           · 다음 행 없음 또는 비공백                      → { pos: lineEnd + 1, insert: '\n', at: lineEnd } */
export function mathExitPos(doc: string, region: MathRegion): { pos: number; insert?: '\n'; at?: number };

/** D7 — Tab ⑥′: 닫힌 비empty display 안, 커서 뒤가 innerTo까지 공백뿐일 때만 mathExitPos. 아니면 null */
export function displayTabExit(doc: string, pos: number, region: MathRegion): ReturnType<typeof mathExitPos> | null;

/** D5 ①′ — 빈 블록 삭제(I1). insertDisplayMathBlock의 역연산이되 흡수된 공백은 되살릴 수 없으므로 **문단 경계 하나**로 되돌린다
 *  · 다행(여는 `$$`·닫는 `$$`가 각자 행): a = region.from에서 왼쪽으로 공백(개행 포함) 끝까지, b = region.to에서 오른쪽으로 공백 끝까지.
 *    insert = (a === 0 || b === doc.length) ? '' : '\n\n'.  결과: `foo\n\n$$\n\n$$\n\nbar` → `foo\n\nbar` · `$$\n\n$$\n\nbar` → `bar` ·
 *    `foo\n\n$$\n\n$$` → `foo` · 단독 → ''.  각 결과에 normalizeDisplayMathSpacing + 앞뒤 trim을 돌려도 바이트 동일(테스트가 고정)
 *  · 한 줄 `$$$$`(a·b가 같은 행 안): region만 지운다(insert ''). 공백 정리는 하지 않는다(`foo $$$$ bar` → `foo  bar` — 드문 경우, 무해)
 *  커서 = a + insert.length === a 또는 a+2? → **a**(끊긴 문단의 끝 = `Ctrl+Shift+M`을 누르기 직전 자리) */
export function emptyDisplayDeleteRange(doc: string, region: MathRegion): { from: number; to: number; insert: '' | '\n\n'; cursor: number };
```

- 빈 쌍(①)의 dispatch: `{ changes: { from, to, insert: '' }, selection: { anchor: from } }` — 인접 `$` 공백(`$x$ $|$`)이 있었다면 그 공백은 남긴다(무해)
- 빈 블록(①′)의 dispatch: `emptyDisplayDeleteRange` 결과로 한 번, `selection: { anchor: cursor }`
- 호출부 공통 `dispatchExit(view, r)`: `{ changes: r.insert ? { from: r.at, insert: r.insert } : undefined, selection: { anchor: r.pos }, scrollIntoView: true }` — 한 dispatch = undo 1스텝. `slotsField`는 변경을 `mapPos`로 매핑하고 선택이 활성 자리 밖이면 해제(`lib/mathSlots.ts:31-48`) — 자리를 둔 채 나가면 조용히 풀린다
- `layoutRowEnvs`의 `openRest.trim()`·`closeLineStart` 두 판정(`mathInput.ts:441-444`)을 `isFencedDisplay`로 치환 — `test:tidy` 21이 회귀를 잡는다
- ⚠ ②-b의 `\n`·①·①′의 삭제는 **커서 이동 키가 문서를 바꾸는 세 자리**다. 전부 저장본이 C5로 같아지고 undo 1스텝
- ⚠ 세 함수 전부 `MathRegion` 타입과 문자열 연산만 — `test:mathinput`의 단독 tsc 컴파일 조건

### 4-2. `lib/math-editor-extensions.ts` — 삽입·나오기의 단일 원천

```ts
import { keymap, EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { scanMathRegions, mathRegionAt, exitRegionAt, type MathRegion, type ExitRegion } from './mathRegions';
import { mathExitPos, isEmptyDisplay, emptyDisplayDeleteRange } from './mathInput';
import { LATEX_COMPLETIONS, isInsideMath } from './latex-completions';   // 기존

export function insertInlineMathIn(view: EditorView): void        // MarkdownEditor :253-263 이동, 바이트 동일
export function insertDisplayMathBlock(view: EditorView): void     // :885-903 이동 + D2′ 선택 + `userEvent: 'input'`
export function dispatchExit(view: EditorView, r: ReturnType<typeof mathExitPos>): true
export function exitMath(view: EditorView, r: ExitRegion): true    // empty → 쌍 삭제 · region이 빈 블록 → 블록 삭제(①′) · 그 밖 → dispatchExit(mathExitPos)
export function exitRegionOfSelection(view: EditorView): ExitRegion | null   // head → 없으면 anchor(D5′)
export function jumpToNextBrace(view: EditorView): boolean         // :398-412 이동, 영역 = mathRegionAt(scanMathRegions)(D10)
export function createMathShortcuts(): { shortcuts: Extension }    // chordListener 제거(Q7)
```

- `createMathShortcuts()` 본문:
  ```ts
  const enter = (kind: 'inline' | 'display') => (view: EditorView) => {
    const r = exitRegionOfSelection(view);
    if (r) return exitMath(view, r);                                                   // D5′·D5
    if (kind === 'inline') insertInlineMathIn(view); else insertDisplayMathBlock(view);
    return true;
  };
  const shortcuts = Prec.highest(keymap.of([
    { key: 'Ctrl-m',        run: enter('inline') },                                    // D1
    { key: 'Ctrl-Shift-m',  run: enter('display') },                                   // D2
    { key: 'Alt-=', mac: 'Ctrl-=', run: enter('inline') },                             // D3
    { key: 'Shift-Escape',  run: (view) => { const r = exitRegionOfSelection(view); return r ? exitMath(view, r) : true; } },  // D6
    { key: 'Alt-Tab',       run: jumpToNextBrace },                                    // D10
  ]));
  return { shortcuts };
  ```
- 삭제: `findInnermostExit`(`:25-96`) · `findMathRegion`(`:101-145`) · `chordState` · `chordListener` · `MathShortcutsResult.chordListener`. 머리 주석 `:6-9`·`:23`·`:99`·`:189` 갱신
- `view.composing` 가드는 두지 않는다 — D-e로 keymap `run`에 조합 중 이벤트가 도달하지 않는다

### 4-3. `MarkdownEditor.tsx`

- import: `insertInlineMathIn, insertDisplayMathBlock, createMathShortcuts, dispatchExit` ← `../../lib/math-editor-extensions` · `displayTabExit` ← `../../lib/mathInput`(기존 import 줄)
- `mathShortcuts`(A9) = `[createMathShortcuts().shortcuts, Prec.highest(keymap.of(Ctrl-Alt-1~9))]` — 상용구 바인딩은 `snippetCallbackRef`를 닫으므로 컴포넌트에 남는다
- 핸들 `insertBlockMath()`: 인터페이스 `:207-210`에 1줄 + 구현(`insertDisplayMathBlock(view); view.focus()`)
- `mathTab` ⑥ 뒤 ⑥′: `const dx = displayTabExit(doc, pos, region); if (dx) return dispatchExit(view, dx);` — ⑥′의 region은 `mathTab`의 기존 `mathRegionAt`(비empty만 대상이라 probe 불필요)
- 삭제: A1(이동) · A2 · A3 · A4(이동) · A5 · A8(이동) · `Ctrl-n`·`Shift-Escape`·`Alt-Tab` 바인딩 · A10 · A11 등록 1줄 · A12 · 주석 A13

### 4-4. `EditorView.tsx` · `UnifiedToolbar.tsx`

- EditorView: `handleInsertBlockMath = () => editorRefs.current[activeBlockId]?.insertBlockMath()` · `<UnifiedToolbar onInsertBlockMath>`(`handleInsertInlineMath` `:2504` 옆)
- UnifiedToolbar: prop `onInsertBlockMath` · `:641` `insertBlockMath = () => onInsertBlockMath()` · 주석 `:199-200` 갱신 · 툴팁(D12):
  ```ts
  const keyLabel = useMemo(() => (k: string) =>
    typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? k.replace('Ctrl+Shift+', '⌃⇧').replace('Ctrl+', '⌃') : k, []);
  // :865 title={`인라인 수식 ($…$) · ${keyLabel('Ctrl+M')}`}   :869 title={`블록 수식 ($$…$$) · ${keyLabel('Ctrl+Shift+M')}`}
  ```

### 4-5. `LatexInputEditor.tsx` · `lib/mathAscii.ts`

- `LatexInputEditor.tsx:57-58`·`:68` — 주석 갱신 · `const { shortcuts: mathShortcuts } = createMathShortcuts()` · `chordListener` 등록 삭제. `CommentEditor`·`PublicComments` 무접촉
- `lib/mathAscii.ts:251-259` — 본문을 `mathRegions`로 옮기고 `export { probeInsertionRegion, type ProbeResult } from './mathRegions'`. `test:mathascii` 32 무회귀가 조건

### 4-6. 문서

- CLAUDE.md 「편집창 Tab은 편집창 것이다」: ⑥′ 추가(+ "aligned 마지막 행은 `&`, 밖은 `\end` 뒤" · "빈 블록에서 Tab은 나가기만, 지우기는 Ctrl+M") · "밖으로 나가는 길 … `Ctrl-m`/mac `Shift-Alt-m`" → **"Escape 뒤 2초 안 Tab(Mac은 `Shift-Alt-m`도) — `Ctrl-m`은 68b가 덮었다"** · 「`$` 버튼은 인접 `$`일 때만」 "Ctrl+N,M" → "Ctrl+M", "`$$` 버튼·Ctrl+Shift+M은 `insertDisplayMathBlock` 하나" · 「편집창 수식 스캐너는 … 하나다」 사본 목록에서 `MarkdownEditor findInnermostExit`·`math-editor-extensions` 제거 · 「Korean IME + CodeMirror 단축키」에 D-b 한 줄 · 68a 절의 `probeInsertionRegion` 소유처를 `mathRegions`로
- 새 절 「수식 단축키는 M이다 (Phase 68b)」: 표(§0) · `Ctrl+N` 폐지 이유 · `Shift+Esc` 항상 소비(preventDefault뿐) · `Alt+Tab` Mac 전용 · **나오기 판정은 `exitRegionAt`(삽입 뒤 문서) — `mathRegionAt` 직접 금지(행 끝 `$|$` 함정)** · 빈 쌍·빈 블록은 삭제(Tab은 나가기만) · 닫힌 `$$`는 펜스 여부 무관 다음 행(`\[`는 `\]` 뒤) · ②-b `\n` 삽입 · 미닫힘·`$$|` 손실 · 삽입·나오기 원천은 `lib/math-editor-extensions.ts`(MarkdownEditor 사본 금지) · 한 줄 `$$x$$`는 저장에서 어차피 갈린다(C5 실측)
- `docs/roadmap.md:2199` 키 표 · `:113-114`에 "(68b에서 Ctrl+M 체계로 대체)" · 파일 구조 절에 `lib/math-editor-extensions.ts` · Phase 68b 절
- phasedocs 확정본(v4 + §11 구현 기록)

---

## 5. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | Firefox(Win) `Ctrl+M` 음소거·`Ctrl+Shift+M` 반응형, Edge `Ctrl+M` 음소거·`Ctrl+Shift+M` 프로필 — `preventDefault`가 먹는지 | 예약 키(`Ctrl+N/T/W`) 밖은 페이지가 막을 수 있는 것이 일반 동작. **실물 §9-2 ①**. 막히는 브라우저는 `Alt+=` 안내(코드 0). `Ctrl+Alt+M`은 쓰지 않는다(Windows AltGr — D-a) |
| R2 | 한글 조합 중 `Ctrl+M` — CM이 버린다(D-e). 조합 밖 keyCode 229(F3)는 `base[229]` 부재로 못 맞춘다 — 결과는 같은 무동작 | OS IME가 수정자 조합에서 조합을 먼저 확정하고 실 keyCode를 주는 것이 통례. 실물 §9-2 ④(갈래 기록). 재현되면 `onMathAsciiKeydown`(`:1441`)의 `classifyKey` **앞**에서 `e.ctrlKey && !e.altKey && e.code === 'KeyM'`를 가로채는 자리 — 지금은 넣지 않는다 |
| R3 | `Ctrl+M`이 CM `toggleTabFocusMode`(Win)를 덮는다 | 편집창 밖으로 = Escape→Tab(68 E5). Mac `Shift-Alt-m`은 산다 |
| R4 | `Shift+Esc`가 수식 밖에서 무동작 키가 된다 | 의도(D6) |
| R5 | 선택이 수식 경계에 걸친 채 `Ctrl+M` | `exitRegionOfSelection`이 head·anchor 둘 다 — 하나라도 안이면 나오기 |
| R6 | ②-b `\n` 삽입·①′ 블록 삭제가 저장 정규화와 어긋남 | C5 — 저장본 무변화(`emptyDisplayDeleteRange` 결과가 정규형임을 테스트가 고정) |
| R7 | Q2로 댓글 편집기 삽입 텍스트가 바뀐다 | 댓글은 `toPersistedBlock`을 안 거치지만 렌더 동일. 한 벌의 이득이 크다 |
| R8 | Mac Chrome Cocoa 바인딩(`Ctrl+M` = 줄바꿈 가능성) | keydown에서 먹고 preventDefault(D-g). 실물 ③ |
| R9 | Q6로 Alt+Tab 영역 판정이 바뀐다 | 개선 방향. CDP ⑩ |
| R10 | D5′ 없이 가면 행 끝 `$|$`에서 `$ $|$ $` | D5′(§0-2 실측). §9-1 ⑬ |
| R11 | 빈 쌍을 `region.to`로 나가면 본문에 `$$`가 남고 저장 정규화가 다음 블록과 짝짓는다 | Q8 삭제(§0-2 실측). §9-1 ⑬ |
| R12 | 빈 블록을 남기고 나가면 `$$\n\n$$`가 본문에 남는다 | Q11 삭제. Tab ⑥′는 지우지 않는다(H5) |
| R13 | D2′·인라인 감싸기의 선택에 `$`가 있으면 중첩 오류 | 현행 인라인 감싸기(M7)와 같은 수준. 린터가 잡는다. 가드는 범위 밖 |

---

## 6. 범위 밖

- Tab 엔진(68 약어·자리)을 댓글 편집기에 이식 · `$` 자동 짝 넣기 · `Esc` 단독 나오기 · 미닫힘 자동 닫기 · `Alt+Tab` Windows 대체 키 · 단축키 사용자 설정 · 68a R2 합류 · document Escape 리스너 16곳의 `shiftKey` 검사 · 선택 안 `$` 가드(R13) · `\[…\]` 다음-행 규칙(F2)

---

## 7. 판정

v1 P1~P8(연구 v1) · v2~v3 Q1~Q11 **전항 덕수 확정(2026-10-08, 권장안)** — §0-1. 열린 판정 없음.

---

## 8. 작업 순서

| Stage | 내용 | 완료 조건 |
|---|---|---|
| S1 | `lib/mathRegions.ts` `probeInsertionRegion` 이관·`exitRegionAt` + `mathAscii` re-export · `lib/mathInput.ts` 5함수(`isFencedDisplay`·`isEmptyDisplay`·`mathExitPos`·`displayTabExit`·`emptyDisplayDeleteRange`) + `layoutRowEnvs` 치환 · 테스트 | `test:mathregions` · `test:mathinput` 추가분 통과 · `test:tidy` 21 · `test:mathascii` 32 무회귀 |
| S2 | `lib/math-editor-extensions.ts` — 삽입 2함수 이동(D2′) · `dispatchExit`·`exitMath`·`jumpToNextBrace` · `createMathShortcuts` 교체 · 사본 2·chord 삭제 · `LatexInputEditor` 2줄 | tsc 무오류 · §9-1 ⑪ |
| S3 | `MarkdownEditor.tsx` — import 전환 · ⑥′ · 핸들 `insertBlockMath` · 삭제 · 주석 · 실물 4용 임시 콘솔 한 줄 | §9-1 CDP ①~⑩·⑬·⑭ |
| S4 | `EditorView`·`UnifiedToolbar` — `$$` 버튼 경로 · 툴팁 | §9-1 ⑫ |
| S5 | CLAUDE.md · roadmap · phasedocs 확정본 · 임시 라우트·콘솔 삭제 | — |
| S6 | 덕수 실물 §9-2 | — |

---

## 9. 검증

### 9-1. 자동 + headless CDP (임시 라우트 `app/dev68b` — `app/dev68` 방식, 검증 뒤 삭제 · dev 서버 중 삭제 금지)

- `test:mathregions` +2: `exitRegionAt`(행 끝 `$|$` → empty 4-6 · 행 중간 `$|$x` → empty(probe 없이 ②) · `$x|$` → region · 본문 → null · `$$` 펜스 안 → region · 행 끝 `$$|` → region(미닫힘 display) · **I2 가드: `$|` 뒤에 `$`가 아닌 문자(`a $|b`)는 probe가 안이어도 null이 아니라 미닫힘 region**)
- `test:mathinput` +12 안팎: `isFencedDisplay`(펜스 ✓ · 한 줄 ✗ · `$$\begin` (c) ✗ · 닫는 `$$` 앞 글자 ✗) · `isEmptyDisplay`(`$$\n\n$$` ✓ · `$$\n \n$$` ✓ · `$$\nx\n$$` ✗ · 한 줄 `$$$$` ✓) · `mathExitPos`(인라인 → `$` 뒤 · 펜스 → 다음 행 · 행 끝 한 줄 `$$x$$` → 다음 행 · 닫는 `$$` 앞 글자 다행 → 다음 행 · 문서 끝 → `insert '\n'` · 다음 행 비공백 → `insert '\n'` · 닫는 `$$` 뒤 글자(`foo $$x$$ bar`) → `region.to` · 미닫힘 인라인 → 행 끝 · `\[x\]` → `\]` 뒤) · `displayTabExit`(식 끝 ✓ · 식 중간 null · 인라인 null · 행 끝 한 줄 `$$x|$$` ✓ · `\[x|\]` ✓ → `\]` 뒤 · `\end{aligned}|` ✓ · 빈 블록 ✓) · `emptyDisplayDeleteRange`(`foo\n\n$$\n\n$$\n\nbar` → `foo\n\nbar` 커서 3 · 문서 시작 `$$\n\n$$\n\nbar` → `bar` 커서 0 · 문서 끝 `foo\n\n$$\n\n$$` → `foo` 커서 3 · 단독 → `''` · 한 줄 `foo $$$$ bar` → `foo  bar` — **다행 4건은 `normalizeDisplayMathSpacing` + 앞뒤 trim을 한 번 더 돌려도 바이트 동일**)
- CDP(`Input.dispatchKeyEvent` — `modifiers` Alt 1 · Ctrl 2 · Meta 4 · Shift 8, `windowsVirtualKeyCode 77`, `code 'KeyM'`; 68a capture가 먼저 받지만 `pass`): ① 본문 `Ctrl+M` → `$|$` ② 선택 + `Ctrl+M` → `$선택$|` ③ `$x|$` → `$x$|` ④ `Ctrl+Shift+M` → `$$\n|\n$$` 빈 줄 규약 · 선택 + → `$$\n선택|\n$$` ⑤ 펜스 안 `Ctrl+M`·`Ctrl+Shift+M`·`Shift+Esc` → 다음 행(세 키 동일) · 문서 끝 펜스 → `\n` 삽입 ⑥ `\end{aligned}|` Tab → 밖 · aligned 마지막 행 끝 Tab → `&` · 식 중간 Tab → 현행 ⑦ 수식 밖 `Shift+Esc` → `defaultPrevented true` ⑧ `Ctrl+N` → 무반응 ⑨ `Alt+=`(Win 에뮬) → ①과 동일 · Mac `Ctrl+=` ⑩ `Alt+Tab` — 옛 표본 + (c) 빈 쌍 ⑪ 댓글 편집기 ①·④·⑤ ⑫ 툴바 `$$` 버튼 = ④ 결과 동일(undo 1스텝) · 툴팁 문자열(platform 에뮬) ⑬ 행 끝 빈 `$|$`에서 `Ctrl+M` 2회 → 본문 원복 · 행 중간 `$|$x` `Ctrl+M` → 삭제 · `$|$` `Shift+Esc` → 삭제 · 행 끝 한 줄 `$$x|$$` `Ctrl+M` → 다음 행 ⑭ `Ctrl+Shift+M` 2회 → 본문 원복(블록 삭제 · ⌘Z 1회로 블록 복귀 · 커서 = 누르기 직전 자리) · 빈 블록에서 Tab → 블록 밖(블록 잔존) · 빈 블록 + 한글 선택 감싸기(`$$\n한글\n$$`) 뒤 68a 큐 비어 있음(H3)
- 회귀: `test:mathslots`·`test:tidy`·`test:mathregions`·`test:mathascii`·tsc·`npm run build`(dev 종료 후)

### 9-2. 실물 (덕수)

1. **Windows Chrome·Edge·Firefox(Parallels)**: `Ctrl+M` → `$|$`이고 탭 음소거 안 됨 · `Ctrl+Shift+M` → 블록이고 프로필 메뉴/반응형 모드 안 뜸 · 수식 밖 `Shift+Esc` → 작업 관리자 안 뜸
2. 같은 환경에서 push 전 **현행** `Ctrl+N`→`M`이 새 창을 여는지(전제 확인, 10초)
3. Mac Chrome·Safari: `⌃M`·`⌃⇧M`·`⌃=` — 줄바꿈이 함께 들어가지 않는지(R8)
4. 한글 조합 중(`한` 직후) `Ctrl+M` — 2벌식·390(R2). **어느 갈래로 오는지 기록**(dev 콘솔 keyCode·isComposing 한 줄 — S3 임시, S5 제거)
5. 긴 `aligned` 블록: `\end{aligned}` 뒤 Tab → 블록 밖 · 마지막 행 끝 Tab → `&` · 중간 행 Tab → `&`
6. 행 끝에서 `Ctrl+M` 두 번 → 원복(Q8) · 한 번 누르고 `x` 치고 `Ctrl+M` → `$x$|` · `Ctrl+Shift+M` 두 번 → 원복(Q11)
7. 툴팁(Mac `⌃M`)
8. 댓글 편집기(댓글 패널·공개 페이지): `Ctrl+M`·`Ctrl+Shift+M`·나오기 · 삽입 결과가 블록 편집기와 같은지(Q2)
9. 툴바 `$$` 버튼 = `Ctrl+Shift+M`(Q1) · `⌃⌥1` 상용구 무변화 · `Alt+Tab`(Mac) 무변화

---

## 10. 커밋 지침

- Stage별 1커밋 `feat(phase68b):` / `docs(phase68b):` · CLI는 커밋까지, push는 덕수
- 착수 시 HEAD가 `38672f0`보다 앞서 있으면 §1 줄 번호 재실측
- 임시 라우트 `app/dev68b`·실물 4의 콘솔 한 줄은 S5에서 삭제
- 확정본은 `docs/phasedocs/Phase68b 수식 입력 단축키 정비 v4 착수판.md`(v4 + §11 구현 기록). v1~v3·연구 v1은 phaseSketch에 둔다

---

## 부록 A. v1 정정 (E1~E13) — v2 그대로

| # | v1 | 실측 | 처리 |
|---|---|---|---|
| E1 | 실측 기준 `42dc261` · P9 "68b 먼저" | HEAD `38672f0` — 68a 종결. MarkdownEditor 1331 → 1506행 | §1 재실측 · P9 삭제 · A14 |
| E2 | D2 "독립행 = `insertDisplayMathBlock` 그대로" | 툴바 `$$`는 `onInsert` → `insertText`(C2) | Q1 |
| E3 | "`findMathRegion` — lib" | MarkdownEditor에도 사본(`:348-395`) | A3 · Q6 |
| E4 | `if (view.composing) return true; // 안전망` | D-e로 도달 불가 | 제거 |
| E5 | D2′ 선택이 있으면 공백 흡수 안 함 | 빈 줄 3개 가능 | 바깥쪽 흡수 + trim |
| E6 | D5 "펜스형 → 다음 줄"의 세부 미정의 | 닫는 `$$` 뒤 글자 · 다음 행 비공백 · 다행 비펜스 | D5 ② |
| E7 | D5 "미닫힘 → `region.to`" | 이동 뒤에도 "안" → 두 번째 키 무동작 | Q5 |
| E8 | D7 "펜스형에서만" | 한 줄 `$$`·`\[` 비대칭 | Q4 |
| E9 | §1-D 줄 번호·D-c 설명 | `:8985-9050`, 폴백 `:9022-9035`; 1차 이름 `Ctrl-M` | 보정 |
| E10 | `UnifiedToolbar.tsx:842-847` · `roadmap.md:2182` | `:865·869` · `:2199` | 보정 |
| E11 | "밖으로 나가는 길 → Escape→Tab만" | Mac `Shift-Alt-m`은 산다 | 보정 |
| E12 | 주석·문서 누락 | A13 · B6 · `LatexInputEditor:57` · roadmap `:113-114` | §4-6 |
| E13 | D5 "수식 안 = `mathRegionAt(head)`" | 행 끝 `$|$`는 밖 → `$ $|$ $` | D5′ |

## 부록 B. v1 보완 (G1~G12) — v2 그대로

G1 D-g preventDefault/stopPropagation · G2 C5 저장 정규화 · G3 68a 무간섭 · G4 B4 댓글 `defaultKeymap` · G5 `insertDisplayMathBlock` `userEvent` · G6 `dispatchExit`·`exitMath` · G7 `exitRegionOfSelection` · G8 R8 Cocoa · G9 CDP 메모 · G10 `Ctrl+Alt+M` 제외 · G11 빈 쌍 정의 · G12 `$$` 버튼 undo 단위

## 부록 C. 독립 검증(v2) 요지 — 전항 v3·v4에서 실행 재현 ✓

R-1 행 끝 `$|$` → D5′ · R-2 빈 쌍 → Q8 · R-3 비펜스 닫힘 → D5 ② · R-4 aligned 마지막 행 → D7 ⚠ · R-5 한 줄 `$$` → D5 ②(논거는 F1로 정정)

## 부록 D. v3 정정·보완 (F1~F3 · H1~H5) — v4가 전부 수용

| # | 내용 | 반영 |
|---|---|---|
| F1 | R-5 논거 — 저장은 커서를 어디로 내보내든 갈린다(§0-2 재실행 확인). 규칙(② 다음 행)은 유지 | D5 |
| F2 | `\[…\]`는 ⑥′ 대상이되 목적지는 `\]` 뒤 | D7 · §6 |
| F3 | D-e는 `composing > 0`일 때만 버린다 — 조합 밖 229는 `base[229]` 부재로 못 맞춘다(dist `:4544-4560` 재확인) | D-e · R2 |
| H1 | `exitRegionAt` ②: `empty:true`면 probe 없이 빈 쌍 | §4-1 |
| H2 | 행 끝 `$$\|`는 미닫힘 display 안 → 무동작(§0-2 실측) | D5 |
| H3 | D2′ 한글 선택 감싸기 — 68a `needsReplay` 자격 위치 `fb`가 블록 밖이라 비자격(`needsReplay` `:187-191` · updateListener `fb` 판정 재확인) | A14 · §9-1 ⑭ |
| H4 | 선택 안 `$` — 현행 수준, 범위 밖 | R13 |
| H5 | 빈 블록에서 Tab ⑥′는 나가기만 | D7 · R12 |

## 부록 E. `[v4]` v3 → v4 구현 세부 (I1~I3)

| # | 종류 | 내용 | 반영 |
|---|---|---|---|
| **I1** | 보완 | `emptyDisplayDeleteRange`의 범위·대체 문자열·커서를 확정 — v3의 "한쪽 `\n\n`을 함께"는 문서 시작·끝·한 줄 `$$$$`에서 모호했다. 규칙: 다행은 `a`(왼쪽 공백 끝)~`b`(오른쪽 공백 끝)를 `''`(문서 시작/끝) 또는 `'\n\n'`으로 대체, 커서 `a`; 한 줄 `$$$$`는 region만. 결과가 C5 정규형임을 테스트가 고정(§0-2 넷째 행이 그 근거) | §4-1 · §9-1 |
| **I2** | 보완 | `exitRegionAt` ④에 **`doc[pos-1] === '$' ∧ doc[pos] === '$'` 가드** — probe가 "inline이고 안이 probe 글자뿐"이라 해도 `a $|b`(미닫힘 `$` 뒤)처럼 `$|$`가 아닌 자리를 빈 쌍으로 오인해 엉뚱한 두 글자를 지우면 안 된다. 그 자리는 ①에서 이미 미닫힘 region으로 잡히므로 ④에 오지 않지만, 가드는 테스트로 고정 | §4-1 · §9-1 |
| **I3** | 수치 | `lib/mathAscii.ts` `probeInsertionRegion` 함수 `:256-259`(`ProbeResult` `:255`, 주석 `:251-254`) · `test:mathinput` 추가 수는 구현 시 확정 | A15 · §0 |

---

## 11. 구현 기록 (CLI · 2026-10-09) — 5커밋 · headless CDP 44/44

| 커밋 | 내용 |
|---|---|
| S1 `72bcd01` | `lib/mathRegions.ts` `probeInsertionRegion` 이관(mathAscii re-export) · `exitRegionAt`(D5′, I2 가드) · `lib/mathInput.ts` `isFencedDisplay`(R5 치환)·`isEmptyDisplay`·`mathExitPos`·`displayTabExit`·`emptyDisplayDeleteRange`(I1) · `test:mathregions` 10 → 13 · `test:mathinput` 13 → 19 · `test:tidy` 21 · `test:mathascii` 32 무회귀 |
| S2 `2d5d8fd` | `lib/math-editor-extensions.ts` 재작성 — 삽입 2함수 이동(D2′) · `exitRegionOfSelection`·`exitMath`·`dispatchExit`·`jumpToNextBrace`(Q6) · `createMathShortcuts` 5바인딩 · `findInnermostExit`·`findMathRegion`·chord 삭제 · `LatexInputEditor` 2줄(Q7) |
| S3 `29184fe` | `MarkdownEditor.tsx` — import 전환 · Tab ⑥′ · 핸들 `insertBlockMath` · 사본 4벌·chord·ref·cleanup 삭제(1506 → 1264행) · 주석 |
| S4 `be7bb57` | `UnifiedToolbar`·`EditorView` — `$$` 버튼 → `insertBlockMath`(Q1) · 툴팁 `keyLabel`(D12) |
| 후속 `12ef6a5` | **K1** — 문서를 바꾸는 나오기 셋에 `isolateHistory.of('full')` |

### 11-1. 계획과 달라진 것 (CDP 실측)

| # | 발견 | 처방 |
|---|---|---|
| K1 | **CM history가 500ms 안의 인접 변경을 한 undo 그룹으로 합친다**(`addChanges` — userEvent가 없거나 `input.type`·`delete`면 join). "Ctrl+Shift+M 두 번(삽입 → 빈 블록 삭제)"이 ⌘Z 한 번에 통째로 풀렸다(§9-1 ⑭ 실측 — 원문 `foo\n\n|bar`로 돌아갔다) | `dispatchExit`(`\n` 삽입)·빈 쌍 삭제·빈 블록 삭제 dispatch에 `annotations: isolateHistory.of('full')`. 68 D19의 `isolateHistory.of('before')`와 같은 계열. 검사 3건 추가(⑬ ⌘Z로 `$|$` 복귀 · ⑤ `\n` 삽입만 풀림 · ⑭ 블록 복귀) |
| K2 | **Mac에서 `Ctrl+N`은 CM `defaultKeymap`의 Emacs `cursorLineDown`**이다 — chord 바인딩이 덮고 있던 것이 드러났다. 문서는 불변, 커서만 아래 행(한 행 문서면 끝)으로 | 의도 없음·회귀 없음(chord 이전 상태로 복귀). §9-1 ⑧의 기대값을 "문서 불변"으로. Windows는 브라우저가 가져간다(실물 2) |
| K3 | 하니스에서 Windows `Alt+=`는 재현 불가 — CM이 로드 시 `navigator.platform`으로 `mac`을 정하므로 Mac headless에서는 `mac: 'Ctrl-='` 갈래만 산다 | Mac `Ctrl+=` 2건으로 대체. `Alt+=`는 같은 바인딩 객체의 `key` 갈래 — 실물 1(Windows)에서 |
| K4 | 툴팁 문자열은 CDP로 보지 않았다(`UnifiedToolbar`를 하니스에 올리려면 prop 20여 개) — `keyLabel`은 `MathSnippetMenu.getModLabel`과 같은 판별식 | 실물 7 |

### 11-2. CDP 44/44 (2026-10-09 · `docs/phaseSketch/phase68b-cdp-harness.mjs` · 임시 라우트 `app/dev68b` — dev 종료 뒤 삭제)

① 본문 `Ctrl+M` → `$|$`(undo +1) ② 선택 → `$sel$|` ③ `$x|$` → `$x$|`(undo +0) ④ `Ctrl+Shift+M` 빈 줄 규약 · 선택은 블록 안 · 문서 시작/끝 패딩 없음 ⑤ 펜스 안 세 키 → 다음 행(동일) · 문서 끝 → `\n` 삽입(undo +1 · ⌘Z로 `\n`만) ⑥ `\end{aligned}|` Tab → 밖 · aligned 마지막 행 끝 Tab → `&` · 식 중간 제자리 · 펜스 식 끝 → 밖 · 인라인 ⑥ 기존 ⑦ 수식 밖 `Shift+Esc` `defaultPrevented true` ⑧ `Ctrl+N` 문서 불변(K2) ⑨ Mac `Ctrl+=` 삽입·나오기 ⑩ `Alt+Tab` 다음 `{`·순환·빈 쌍 무동작 ⑪ 댓글 편집기 `Ctrl+M`·`Ctrl+Shift+M`·`Shift+Esc` 나오기·행 끝 `$|$` 2회 원복 ⑫ 핸들 `insertBlockMath` = ④(undo +1) · `insertInlineMath` ⑬ 행 끝 `$|$` `Ctrl+M` 2회 원복(아래 줄 있어도) · ⌘Z로 `$|$` 복귀 · 행 중간 `$|$x` 삭제 · `Shift+Esc` 삭제 · 한 줄 `$$x|$$` → 다음 행 · `x` 치고 `Ctrl+M` → `$x$|` ⑭ `Ctrl+Shift+M` 2회 원복 · ⌘Z 1회로 블록 복귀 · 빈 블록 `Ctrl+M` 삭제 · 빈 블록 Tab 나가기만 · 한글 선택 감싸기(블록·인라인) 150ms 뒤 동일(68a 재생 0) · R5 걸친 선택 → 나오기

### 11-3. 남은 일

- 덕수 실물 §9-2 — 특히 **Windows Chrome·Edge·Firefox**에서 `Ctrl+M`(음소거)·`Ctrl+Shift+M`(프로필/반응형)·`Shift+Esc`(작업 관리자)가 페이지에 먹히는지, 한글 조합 중 `Ctrl+M`의 갈래
- dev 서버 종료 뒤 `app/dev68b` 삭제 → `npm run build` → push

### 11-4. 덕수 맥 크롬 검수(2026-10-09) — 21항 중 19항 정상 · 후속 2건

| # | 증상 | 원인 | 처방 |
|---|---|---|---|
| 17 | 한글 조합 중(`한` 직후) ⌃M → `한` 확정만 되고 끝 | 맥 한글 IME가 ⌃M을 조합 확정에 쓰고 keydown은 조합 중(`isComposing`·229)으로 온다. CM은 `composing > 0`이면 키 이벤트를 버린다(계획서 R2가 "재현되면 받을 자리"로 미뤄 둔 것) | `composingRescue`(lib/math-editor-extensions) — 편집기 루트 capture keydown에서 조합 중 Ctrl+M·Ctrl+Shift+M·별칭을 기억했다가 compositionend 뒤 CM 반영을 기다려 같은 명령 실행. preventDefault 없음 · 조합 밖 229(F3)도 처리 · `defaultPrevented`면 건너뜀 · 800ms 안에 확정이 없으면 버림. **68a 래퍼 capture가 아니라 CM 플러그인에 둔 이유**: 댓글 입력창에는 68a가 없다 |
| 21 | 댓글·agent 입력창 Tab이 다음 버튼으로 포커스 이동 | Phase 68 Tab 엔진이 `MarkdownEditor` 안에만 있었다 | Tab 엔진을 `mathTabCommand`·`mathShiftTabCommand`·`createMathTab`으로 lib에 옮겨 두 편집기 공용. 약어 맵은 `lib/abbrevStore`(신설) — `useSnippets`가 올리고, 편집창을 안 거친 화면은 사용자당 1회 읽는다. 입력창에서 `useAuth`를 쓰지 않는다(구독마다 프로필 upsert) |
| 21′ | (하니스에서 발견) 활성 자리를 둔 채 문서를 통째 교체하면 자리가 `[0, 끝]`으로 늘어 다음 Tab이 전체 선택 | `slotsField`의 바깥 결합 매핑 | `setValue`·`setContent`에 `setSlots.of(null)` — 실사용에선 자리가 살아 있는 채 댓글 전송 |

CDP 44 → **61/61**(⑰ 9건 · ㉑ 8건 추가 — 조합은 페이지 안 합성. ⚠ 진짜 IME의 이벤트 순서는 합성이 대신하지 못한다 — 17은 실물 재확인 필요). 댓글 입력창의 Enter(행 환경 ` \\`)·후위 변환은 아직 편집창 전용(검수 범위 밖).

### 11-5. 후속 2 — 자동 영문 입력(68a)도 두 편집기 공용으로 · 작업 규칙 9 (2026-10-09)

덕수 보고: 댓글·agent 입력창에서는 `$` 안 자동 영문 입력이 안 된다. 원인은 버그가 아니라 범위 — 68a v5 §6이 `LatexInputEditor`를 범위 밖으로 두었다(근거는 "다른 CM 인스턴스" 한 줄).

- `MarkdownEditor`에 흩어져 있던 68a 배선(헬퍼 `typeText`·상태 6종·reconcile·변경 큐·capture 리스너 3개, 약 200줄)을 `lib/math-editor-extensions.ts` `createMathAscii(enabled)` **ViewPlugin 하나**로 옮겼다. 로직은 줄 단위로 그대로, 바뀐 것은 상태 보관 위치(ref → 플러그인 인스턴스)와 capture 리스너 대상(래퍼 div → `view.dom`, 둘 다 contentDOM의 조상이라 순서 동일)뿐. `MarkdownEditor` 1264 → 1065행
- 켜고 끄기: 설정 키·읽기·쓰기를 lib(`MATH_ASCII_PREF_KEY`·`readMathAsciiPref`·`writeMathAsciiPref`)로. 댓글 입력창은 툴바가 없어 편집창 토글 저장값을 **누를 때마다** 읽는다
- 재생(`typeText`)은 그 편집기의 inputHandler 체인을 탄다 — 댓글 입력창에서는 그쪽 괄호 자동닫기가 발화한다(CDP 확인)
- CDP 61 → **76/76**: 68a 표본 6종 × 두 편집기(수식 안 · 음절 · 행 끝 `$|$`(K8) · 수식 밖 보존 · `\text{}` 보존 · 390 직접 경로) + 댓글 토글 끔/켬 + 재생 체인. ⚠ 조합의 **끊기(blur→focus)** 단계는 합성으로 못 본다(진짜 조합이 없다) — 실물 재확인 몫
- **작업 규칙 9 신설(덕수 원칙)**: 편집창과 댓글·agent 입력창의 수식 입력 방식은 같아야 한다. 수식 입력 동작은 lib에 두고 두 편집기가 import한다. 알려진 미통일 5종(행 환경 Enter · 후위 변환 · 괄호 자동닫기 규칙 · 붙여넣기 정규화 · 린트)을 CLAUDE.md 규칙 9에 목록으로 둔다

### 11-6. 후속 3 — 미통일 1~3 통일(덕수 지정, 2026-10-09)

| # | 통일 전 | 통일 후(기준 = 편집창 규칙) | 원천 |
|---|---|---|---|
| 1 | 행 환경 Enter(` \\`+줄바꿈+들여쓰기)가 편집창 전용 | 두 편집기 | `rowEnterCommand` → `createMathKeys`(Tab과 한 키 묶음) |
| 2 | 후위 변환(`^`·`_`→`^{}` · `(A)/`→`\frac{A}{}`) · 선택 `(`→`\left…\right` · `\left(`→`\right)` 짝이 편집창 전용 | 두 편집기 | 편집창 입력 처리기를 그대로 옮긴 `createMathInput` |
| 3 | 괄호: 편집창 = CM `closeBrackets`(뒤가 비었을 때만 짝 · 닫는 괄호 건너뛰기 · Backspace 짝 지우기) + 수식 밖 `(`·`[` 차단 + 수식 안 `{` 항상 짝 / 댓글 = 자체 처리기로 수식 안 `(`·`[`·`{` 무조건 짝 | 편집창 규칙 하나 | `createMathInput` = 입력 처리기 + `closeBrackets()` + `keymap.of(closeBracketsKeymap)` |

- ⚠ 댓글 입력창의 **눈에 띄는 변화**: 수식 안 `(`·`[`가 이제 **뒤가 비었을 때만**(공백·`)]}:;>`·줄 끝) 짝을 넣는다. `$|$` 안 `(`는 짝이 없다(뒤가 `$`) — 편집창이 원래 그랬다(68a K6). 대신 짝 지우기·건너뛰기·`\left` 쌍·후위 변환이 생겼다
- `closeBrackets()`는 모듈 상수를 돌려줘 편집창(basicSetup에도 있다)에 두 번 들어가도 하나로 합쳐진다. 댓글 입력창의 `markdown()` 언어는 closeBrackets 설정을 바꾸지 않는다(languageData = commentTokens뿐 — 확인)
- 댓글 입력창에서 `createMathKeys`를 `markdown()` **앞**에 — 그 언어의 Enter(목록 이어 쓰기)도 `Prec.high`라 배열 순서가 승부를 가른다
- CDP 76 → **108/108**: 16표본(Enter 3 · 후위 변환 5 · 선택 감싸기·`\left` 쌍 2 · 괄호 6) × 두 편집기 **같은 기대값**. `MarkdownEditor` 1065 → 948행
- 남은 미통일: 붙여넣기 비가시 문자 정규화 · LaTeX 린트(CLAUDE.md 작업 규칙 9 목록)

### 11-7. 맥 크롬 검수 종결 · 빌드 (2026-10-09)

- 덕수 맥 크롬: 21항 + 후속 재확인(조합 중 ⌃M · 댓글 Tab · 댓글 자동 영문 4항 · 통일 5항) **전항 정상**
- 검수 범위 결정(덕수): **맥 크롬 · 윈도우 11 크롬 두 곳만** — Edge·Firefox·Safari는 제외(§9-2 1·3의 다른 브라우저 항목 포함)
- dev 종료 → 임시 라우트 `app/dev68b` 삭제 → `npm run build` 통과(`[icons:check] OK — 62종`) → dev 재시작. 하니스 `docs/phaseSketch/phase68b-cdp-harness.mjs`(108건)와 임시 라우트 소스 `docs/phaseSketch/phase68b-dev68b-page.tsx.txt`를 함께 보관 — 되살리려면 후자를 `app/dev68b/page.tsx`로 복사하고 dev 서버에서 하니스를 돌린 뒤 지운다(라우트는 git에 커밋하지 않는다)
- 남은 일: push → 윈도우 11 크롬 검수

### 11-8. 윈도우 11 크롬 검수 (2026-10-09)

**1차(무효)** — 증상 대부분이 **옛 배포본**(68b 이전)의 동작과 정확히 일치했다. 결정적 단서는 Ctrl+Shift+M에 뜬 "No diagnostics" — 옛 코드에선 그 키가 CM `lintKeymap`의 `Mod-Shift-m`(린트 패널, 맥은 ⌘⇧M이라 안 겹친다)이고 새 코드에선 우리 `Prec.highest` 바인딩이 이긴다. 겹쳐서 MS 한글 IME가 **전각** 모드였다(검수 메모 자체가 `ｃｔｒｌ`·`＄＄`) — 전각 `＄`는 수식 구분자가 아니라 "손으로 친 `$`를 인식 못 함"·`＾`/`（` 무변환·댓글 수식 불가가 함께 설명됐다. 배포본 번들에 새 바인딩이 있음을 확인(`Ctrl-Shift-m`·`Alt-=`·설정 키), push 14:51.

**2차** — Ctrl+Shift+R + 반각으로 재검수: 12항 중 10항 정상. 남은 셋:

| # | 증상 | 원인 | 처방 |
|---|---|---|---|
| 신규 | 수식 단축어 + Tab이 "됐다 안 됐다" — 확장 안 된 `sqrt`·`lim`(백슬래시 없음)에 괄호가 엉뚱하게 섞임 | 윈도우 IME는 마지막 자모(`ㅡ`)를 확정하면서 Tab을 같은 순간 보낸다. 68a 치환은 setTimeout 뒤라 Tab이 `liㅡ`를 보고 단축어를 못 찾아 자리 이동으로 넘어갔다. 맥은 Tab이 한 박자 늦게 와 안 보였다. **CDP 재현**(자모 삽입 직후 같은 태스크에 Tab keydown) | `flushMathAscii(view)` — 수식 명령 머리에서 대기 중인 68a 치환을 즉시 끝낸다(Tab·행 Enter·Ctrl+M 계열·Shift+Esc). 레지스트리는 WeakMap |
| 7 | 조합 중 Ctrl+M → 확정만 | (추정) 윈도우는 Ctrl을 누르는 순간 확정(compositionend)을 **먼저** 내고 keydown이 뒤에 온다 → 이미 지나간 확정 신호를 기다리다 포기 | 조합이 살아 있지 않으면 60ms 뒤 실행(`RESCUE_END_GRACE_MS`). 실기기 순서는 진단 기록으로 확인 예정 |
| 5 | Alt+= → 크롬 메뉴 버튼 활성 | 미확인 — keydown이 페이지에 오지 않거나 다른 모양으로 온다(한국어 자판의 오른쪽 Alt는 한/영 키라는 점도 후보) | **진단 기록**으로 확인 후 결정 |

- **입력 진단 기록(신설, 꺼짐이 기본)**: 콘솔 `localStorage.setItem('mathory-input-diag','on')` → 새로고침 → 재현 → `copy(__mathoryInputDiag.dump())`. 키·조합·beforeinput·편집기 트랜잭션·rescue/flush 결정 최근 400줄. 꺼져 있으면 리스너 0, 서버 전송 없음
- CDP 108 → **118/118**(윈도우 순서 5표본 × 두 편집기). 하니스 표본 "확정 신호가 안 옴"이 조합을 열어 둔 채 끝나 다음 표본을 오염시키던 것을 정리(코드가 아니라 하니스 문제 — `compositionStarted` 판정은 유지)
