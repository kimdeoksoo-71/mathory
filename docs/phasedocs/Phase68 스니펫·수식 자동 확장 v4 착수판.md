# Phase 68 스니펫·수식 자동 확장 구현 계획서 v4 (CLI 착수판)

- 작성: CLI Claude · 2026-10-07 — web v3를 레포(HEAD `cceb767`)와 CodeMirror 설치본 실행 프로브로 재검증
- 계보: 덕수 스케치 `snippet_automation_sketch_261007.md` → v1 web → v2 CLI 교차검토 → v3 web 재검증 → **v4 CLI 착수판**(이 문서 하나로 착수)
- 실측: `@codemirror/autocomplete 6.20.0` · `view 6.39.14` · `commands 6.10.2` · `state 6.5.4` · KaTeX 0.16.28 (전부 node_modules 설치본으로 실행)
- 덕수 판정(2026-10-07): **P22 권장안 (a)** 확정 — P1~P21은 권장안 그대로. **착수(HEAD `cceb767`)**

---

## 0. v3 재검증 요약

### 0-1. 수용 — v3의 N1~N5는 맞다

| v3 | 재검증 |
|---|---|
| **N1** CM `snippet()`의 `\{`·`\}` 이스케이프 위치 버그 → CM 템플릿 미사용 | ✔ **재현**. v2 E2 규칙(전부 이스케이프)으로 `\int_{▢}^{▢}{▢ dx}`를 `abc` 뒤에 넣으면 자리가 `9·13·15·19`(정답 `9·12·14·19`), `b2`는 첫 자리 23(정답 22)·탈출 31(정답 29), `\frac{▢}{▢}`는 둘째 자리 12(정답 11). 원인은 v3 서술대로 — `Snippet.parse`(dist 1495-1500)의 이스케이프 제거 콜백이 **치환 전 문자열의 index**를 **이미 감소된 `pos.from`**과 비교해, 이스케이프가 둘 이상 앞서면 덜 뺀다. v2 프로브는 첫 자리만 봐서 놓쳤다. ⚠ v3의 "빈 문서에서 예외"는 내 프로브에서 **재현되지 않았다**(위치만 틀림) — 결론은 같다: **CM `snippet()`·`snippetKeymap`을 쓰지 않는다** |
| N2 Escape 단순화 | ✔ 자리 관리가 Escape를 쓰지 않으므로 R3 소멸 |
| N3 1차 dispatch는 inputHandler 5번째 인자 `insert()` | ✔ `view/dist/index.d.ts:1219` `insert: () => Transaction` · `applyDefaultInsert`가 `userEvent`·`scrollIntoView: true`를 붙인다(dist 4337) |
| N4 (c) 형태 `$$\begin{…}`(여는 `$$` 뒤에 내용) 안은 수식 밖으로 판정 | ✔ `mathRegions.ts:128-131` |
| N5 `()`·`[]`는 짝이 맞을 때만 그룹 | ✔ `[0, 1)` 구간 표기 |

### 0-2. 정정 (F) — v3대로 쓰면 어긋나는 것

| # | v3 | 실측 | 조치 |
|---|---|---|---|
| **F1** | D17′ "Shift+Enter = 그냥 줄바꿈" | basicSetup의 `standardKeymap`이 **`{key:'Enter', run: insertNewlineAndIndent, shift: insertNewlineAndIndent}`**(commands dist 1731)로 Shift까지 묶고 있다. 우리 Enter 바인딩에 `shift`를 두지 않으면 Shift+Enter는 그쪽으로 떨어진다 | "Shift+Enter = **기본 줄바꿈**(현재 행 들여쓰기 유지, `\\` 없음)"으로 정정. 탈출구로 충분하므로 우리가 `shift`를 따로 묶지 않는다 |
| **F2** | D11″ 형제 진입 대상 `{`·`[`·`(` | `(`를 넣으면 `\sqrt{2}(x+1)`에서 sqrt 안 Tab이 `(x+1)` **안으로** 들어간다 | 형제 진입은 **인수 그룹 `{`·`[`만**(`}{`·`}^{`·`}_{`·`]{`). `()`는 "커서 뒤의 빈 `()` 자리" 탐색에서만 |
| **F3** | §4-3 자리 스토어 `components/editor/mathSlots.ts` | CM StateField 모듈의 선례는 전부 `lib/`다(`lib/math-highlight.ts`·`lib/search-highlight.ts` — `@codemirror/state`·`view` import) | **`lib/mathSlots.ts`**. 테스트 산출물 `.test-build/lib/mathSlots.js` |
| **F4** | §4-3 `slotsField`: 효과 교체 · 변경 매핑 · 선택 이탈 해제 | ① **효과가 오면 매핑 없이 즉시 반환**해야 한다 — 효과의 좌표는 같은 트랜잭션의 변경 **뒤** 좌표라 다시 매핑하면 어긋난다(CM `snippetState` dist 1538-1540 선례) ② **undo·redo에서 해제**(`tr.isUserEvent('undo'/'redo')`) — 되돌리면 자리가 한 점으로 접혀 남고 Tab이 그리로 간다 | §4-3에 명시 |
| **F5** | 9-2 ⑫ "Escape 한 번 → Tab" | 자동완성 목록이 열려 있으면 Escape가 `closeCompletion`에 소비되어(Prec.highest) 내장 tab focus 핸들러(맨 뒤, dist 4610)에 닿지 않는다 | "자동완성이 닫힌 상태에서 Escape 한 번" |
| **F6** | §1-B "자동완성 keymap은 `Prec.highest`(autocomplete dist `:2058`)" | 줄 번호는 `completionKeymapExt` 정의 위치가 맞다 — 유지 | — |

### 0-3. 추가 판정 1건 — P22 (§7)

Tab이 할 일이 없을 때(순서 ⑥) **인라인 `$…$` 안이면 닫는 `$` 뒤로 탈출**할지. 권장 = 탈출(인라인만). `$x^{2}|$`에서 Tab 두 번이면 본문으로 돌아온다 — "그룹 탈출 우선" 원칙의 자연스러운 바깥 경계다. display `$$`는 제자리(줄을 넘어가는 이동은 놀랍다).

---

## 1. 현행 — 실측 (HEAD `cceb767`)

### A. 상용구
- 데이터 `users/{uid}/math_snippets/{id}` = `{name, shortcutIndex(1~9), content, order, created_at, updated_at}` — `types/snippet.ts:1-8` · `lib/snippets.ts:16-64`
- 규칙 `firestore.rules:29-32` 본인만 · 필드 검증 없음 → **규칙 0**
- 메뉴 `components/editor/MathSnippetMenu.tsx`: 구조 템플릿 `STRUCTURE_TEMPLATES :16-21`·렌더 `:172-190` · 헤더 `'수식 상용구'` `:150` · `+ 새 상용구 등록` `:310` · 단축키 칩 `s.shortcutIndex <= 9` `:225` · `getNextAvailableIndex :24-30`(`snippets.length + 1`) · 폼 `:317-444`
- 툴바 hover `title="상용구"` `UnifiedToolbar.tsx:685`(IconButton title = `useHoverTip` 말풍선, 네이티브 title 아님) · props `:183-187`
- 삽입 `EditorView.tsx:2497-2509` `handleSnippetInsert → insertText(content, content.length)` · 단축키 `MarkdownEditor.tsx:806-817` · hook `hooks/useSnippets.ts`(`getByShortcut`)
- ⚠ `listSnippets`가 `orderBy('shortcutIndex')`(`lib/snippets.ts:21`) — 필드 없는 문서는 결과에서 **빠진다**. `order: data.order ?? data.shortcutIndex`(`:28`)
- MarkdownEditor ↔ EditorView 사이에 `SortableEditorBlock` passthrough(`EditorView.tsx:1005-1011`, `onSnippetShortcut={onSnippetShortcut}`)

### B. Tab
- `tabHandler` `MarkdownEditor.tsx:692-732`: `tabStopsRef`(`:440`)가 꺼져 있으면 `return false` → 브라우저가 포커스를 밖으로 옮긴다
- 무장: `insertText` `:466-468`(`{}` 2개 이상) · 자동완성 apply `:394-396`(`__tabStopsActive`, `braceCount >= 2`)
- `Alt-Tab` `:802-805` · Command 더블탭 `metaListener :849-868`(등록 `:885` · `lastMetaDownRef :443`) — 둘 다 `jumpToNextBrace :349-362`(수식 안 모든 `{` 순회)
- 자동완성 keymap(`completionKeymap`)에 **Tab 없음**(Ctrl-Space·Escape·화살표·PageUp/Down·Enter) · `indentWithTab` 미등록
- CM 내장 tab focus 모드: Escape를 누르면 2초간(`view/dist 4835-4836`) Tab이 **모든 키 핸들러를 건너뛰어** 브라우저로 간다(dist 4503). `Ctrl-m`(mac `Shift-Alt-m`) 토글도 `defaultKeymap`(commands 1785)에 있다

### C. Enter — `standardKeymap`의 `insertNewlineAndIndent`(Shift도 같은 명령, commands dist 1731). 행 환경 처리 없음

### D. 입력 핸들러 `inputHandler :901-947`(`Prec.highest`)
- `\left(`·`\bigl[` 등 좌측 구분자 → `\right` 쌍 자동 완성(`:905-924`)
- 수식 밖 `(`·`[`: **선택을 `(`로 대체**(`:927-934`) — 선택 텍스트가 사라진다(네이티브 감각)
- 수식 안 `{`: **선택을 `{}`로 대체**(`:937-944`), IME 가드 없음
- 수식 안 `(`·`[`: basicSetup `closeBrackets`(선택이 있으면 `(선택)` 감싸기)
- ⚠ inputHandler는 **IME 조합 중에도 호출된다**(view dist 4257-4260: `composing++` 뒤 핸들러). `compositionend`에서 `composing = -1`로 즉시 내려간다(dist 5148)

### E. 정돈 `lib/blockTidy.ts` — R0~R4 · `MULTILINE_ENV_RE :51`(14종, `alignedat`·`align*` 없음). 환경 안 레이아웃 규칙 없음. 같은 성격의 목록이 `lib/mathSplit.ts:60 BLOCKED_ENVS`에도 있으나 "분할 차단" 의미라 **별개**

### F. 수식 영역 `lib/mathRegions.ts` — `$$` R-$$ 규칙: (a) 펜스(`$$` 뒤 행 나머지 공백) / (b) 한 줄 `$$…$$`(레거시 — 렌더는 인라인) / (c) 그 밖 = **빈 인라인 쌍**(안쪽은 수식 밖). `mathRegionAt(regions, pos)` export(`:162`) · `latex-completions.isInsideMath = mathRegionAt(scanMathRegions(doc), pos) !== null`(`:101-103`)

### G. 자동완성 템플릿 `lib/latex-completions.ts` — 환경 10종 `\begin{…}\n  \n\end{…}`(**공백 2칸**, `braceCount 0`, `cursorOffset`) · 나머지는 `math-symbols.ts`에서 생성. 툴바 n제곱근 `\sqrt[]{}` cursorOffset 6(`MathToolbar.tsx:38`) — 커서가 `[]` 안

### H. AI 완성 `EditorView.tsx:1488` · OCR `:2547`이 툴바용 `insertText`를 쓴다(결과에 `{}`가 있으면 커서가 거기로 튄다). 채팅 삽입은 Phase 61c가 `insertPlainText`(`:496-506`)를 만들어 피했다

### I. 린터 `lib/latex-linter.ts` — `checkRequiredArgs`(`:573-640`)는 **빈 `{}`도 인수로 센다**(`\frac{a}{}`·`x^{}` 무음) · `checkAmpersandOutsideEnv`(`:641`) · 인라인 `\\`는 환경 안이면 허용(`:800-`)

### J. KaTeX 실측 — `\begin{aligned}a&=1\\[b,c]&=2\end{aligned}` 한 줄은 **오류**(`Invalid size: 'b,c'`), `\\` 뒤 줄바꿈+들여쓰기면 정상 · 마지막 행 뒤 `\\`·`\\[4pt]`·`$$` 안 `align*`·빈 그룹(`x^{}`·`\sqrt[]{}`·`\lim_{ \to }{}`)·`{\overline{\mathrm{AB}}}^{2}` 전부 렌더 OK

### K. 댓글 `LatexInputEditor`는 `lib/math-editor-extensions.ts`를 쓴다 — 범위 밖

---

## 2. 결정 (최종 · D1~D24)

### A. 스니펫 개편

| # | 결정 |
|---|---|
| D1 | 표시 이름만: 툴바 hover `스니펫` · 메뉴 헤더 `스니펫` · `+ 새 스니펫 등록`. 코드 식별자(`MathSnippet`·`math_snippets`)·컬렉션 경로 불변 |
| D2 | 메뉴 두 절: **단축키 상용구**(현행 그대로, 수식 안팎, `⌃⌥1~9`) · **수식 단축어**(Tab 트리거는 수식 안에서만). 행 오른쪽 칩 = 단축키 또는 약어 |
| D3 | 구조 템플릿 3종과 그 절 삭제(`STRUCTURE_TEMPLATES` 소비처는 그 파일뿐) |
| D4 | `+ 새 스니펫 등록` → 종류 선택 2버튼 → 폼. 단축키 상용구 폼 = 현행. 수식 단축어 폼 = 이름 · 약어 · LaTeX 내용(`▢ 넣기` 버튼 — textarea 캐럿 위치에 `▢` 삽입). 편집에서 종류 변경 불가 |
| D5 | 기본 수식 단축어 8종 = `lib/mathInput.ts`의 `DEFAULT_ABBREVS`. 메뉴 수식 단축어 절에 "기본"으로 보이고 수정·삭제 없음. 사용자가 같은 약어를 등록하면 **사용자 우선**, 기본 행에 "대체됨"(P6) |
| D6 | 약어 `/^[A-Za-z][A-Za-z0-9]{0,9}$/`, 대소문자 구분. 사용자 약어끼리 중복이면 저장 거부(인라인 오류). 기본과 같은 것은 허용(D5) |
| D7 | 자리 해석 `parseSlots(content)` → `{text, slots}`: `▢`(U+25A2)가 있으면 그 위치들(문자는 지운다). 없으면 원문의 빈 `{}`·`[]`·`()` **안쪽**(등장 순). 끝에 **내용 끝**을 탈출 자리로 붙인다(마지막 자리가 이미 끝이면 생략). **이스케이프 없음** — CM 템플릿을 거치지 않는다(N1) |
| D8 | 메뉴 클릭도 같은 엔진(`insertMathSnippet`). 커서가 수식 밖이어도 그대로 넣는다 — "수식 안에서만"은 Tab 트리거의 조건(P16) |

### B. Tab · Shift+Tab

| # | 결정 |
|---|---|
| D9 | 편집창에 포커스가 있으면 Tab·Shift+Tab은 항상 편집창 것(`return true`). 밖으로 나가는 길 = **Escape → 2초 안 Tab**(CM 내장) · `Ctrl-m`/`Shift-Alt-m` |
| D10 | Tab 순서(첫 성공에서 멈춤): ⓪ IME 조합 중(`view.composing`) → 제자리 ① 자동완성 열림(`completionStatus === 'active'`) → `acceptCompletion`(P4) ② **수식 안** + 선택 없음 + 커서 앞 약어(`matchAbbrev`) → 확장(활성 자리 안에서도 — 중첩, 새 자리 목록이 옛 것을 대체) ③ **활성 자리**가 있으면 → 다음 자리(수식 안팎 무관 — 메뉴로 수식 밖에 넣은 것도 이동) ④ 수식 안 + 행 환경 본문 + 그룹 깊이 0 + `AMP_ENVS` → `&` 삽입(P15) ⑤ 수식 안 → D11 ⑥ 수식 안 + **인라인** 영역 + 닫혀 있음 → 닫는 `$` 뒤로(P22) ⑦ 제자리 |
| D11 | 자리 이동: 커서를 감싼 **가장 안쪽 그룹**(`{}`는 항상 · `()`·`[]`는 같은 수식 안에서 **같은 종류끼리 짝이 맞을 때만** — N5)이 있으면 → 닫는 괄호 뒤 3자 이내에 **`{` 또는 `[`**가 열리면 그 안으로(`}{`·`}^{`·`}_{`·`]{`, 비어 있지 않아도 진입 — 현행 tabHandler 감각), 아니면 **닫는 괄호 바로 뒤**(탈출). 그룹 밖이면 → 같은 수식 안 커서 **뒤**의 다음 **빈** `{}`·`[]`·`()` 안. 수식 경계를 넘지 않는다(F2) |
| D12 | 수식 밖(활성 자리 없음): 제자리(P2) |
| D13 | Shift+Tab: 활성 자리가 있으면 이전 자리, 아니면 제자리(P11) |
| D14 | 제거: `tabStopsRef`·`__tabStopsActive`·`insertText` 무장·Command 더블탭(`metaListener`·`lastMetaDownRef`). 유지: `Alt+Tab`(P3 — 채운 칸까지 도는 순회, 빈 칸만 보는 Tab과 용도가 다르다)·`Shift+Esc` |

### C. Enter · 정돈

| # | 결정 |
|---|---|
| D15 | 행 환경 단일 원천 `ROW_ENVS`(`lib/mathInput.ts`, P14): `aligned·alignedat·align·align*·alignat·alignat*·cases·dcases·rcases·drcases·array·darray·gathered·gather·gather*·split·matrix·pmatrix·bmatrix·vmatrix·Vmatrix·Bmatrix·smallmatrix` + `matrix*`·`pmatrix*`·`bmatrix*`·`vmatrix*`·`Vmatrix*`·`Bmatrix*`. `AMP_ENVS` = 그중 `gathered·gather·gather*` 제외. blockTidy R1 ①의 `MULTILINE_ENV_RE`를 `ROW_ENV_RE`로 교체. `mathSplit.BLOCKED_ENVS` 무접촉 |
| D16 | 환경 본문 안 Enter(`rowEnterPlan`): ⓐ 커서가 `\begin{…}` 헤더 행 끝 → 줄바꿈 + 한 단계(2칸) 들여쓰기 ⓑ 행이 비어 있음(들여쓰기뿐) → 줄바꿈 + 같은 들여쓰기(P17) ⓒ 커서 뒤 같은 행이 `\end{env}`(공백 허용) → ` \\` + 줄바꿈 + 들여쓰기(커서) + 줄바꿈 + **`\begin` 행의 들여쓰기** + `\end…`(P18; ⓑ 조건이면 ` \\` 없이) ⓓ 행 끝이 이미 `\\`(뒤 `[…]`·공백 허용) → 줄바꿈 + 같은 들여쓰기 ⓔ 그 밖 → ` \\` + 줄바꿈 + 같은 들여쓰기. **Shift+Enter = 기본 `insertNewlineAndIndent`**(F1). 자동완성 열림·IME 조합 중 무관여. 바인딩 `Prec.high`(완성 Enter는 `Prec.highest`라 먼저 간다) |
| D17 | 정돈 R5(`layoutRowEnvs`, R3 뒤·R4 앞): **펜스형 `$$`만**(P20) — `scanMathRegions`의 `delimiter '$$'`·`closed`·`!empty` + **원문 확인**(여는 `$$` 뒤 같은 행 나머지 공백 · 닫는 `$$` 앞 같은 행이 공백). (b) 한 줄 `$$…$$`은 렌더가 인라인이라 줄을 나누면 렌더가 바뀐다 → 무접촉. `\[…\]`는 R3(autoFix Step 0)이 먼저 `$$`로 바꾼다. 규칙은 §4-1 `layoutRowEnvs`. **멱등** |
| D18 | 들여쓰기 공백 2칸(환경 자동완성 템플릿 선례 `latex-completions.ts:35`) |

### D. 후위 변환 · 감싸기 (수식 안 · IME 조합 중 제외)

| # | 결정 |
|---|---|
| D19 | 자동 분수: `/` 입력 · 선택 없음 · 바로 앞 `)` · 짝 `(`는 **괄호 균형 스캔**(`\(`·`\)` 이스케이프 제외) · `(` 앞 글자가 없음·공백·`+ - = < > , & { ( [`·`\\`(줄바꿈)이면 `(A)/` → `\frac{A}{▢}`(P7). `f(x)/`·`\left(x\right)/`·`\frac{1}{2}(x)/`는 앞 글자가 문자·`}`라 무변환 |
| D20 | `^`·`_` → `^{▢}`·`_{▢}`. 예외: 다음 글자 `{` · 앞 글자 `\` · 선택 있음(P19) |
| D21 | 되돌리기: 1차 `view.dispatch(insert())`(inputHandler 5번째 인자 — `input.type` userEvent·`scrollIntoView`가 타자와 같다 → M7 D5 가로 중앙 추적 발화) → 2차 변환 dispatch에 `isolateHistory.of('before')`. ⌘Z 1회 = 변환만 풀리고 친 글자는 남는다 |
| D22 | 선택 감싸기: 선택 양끝이 **같은** 수식 영역 안이면 `(`→`\left(선택\right)` · `[`→`\left[선택\right]` · `{`→`\left\{선택\right\}`(P5). 한 트랜잭션, 결과 전체 선택 유지. 수식 밖은 현행(선택 대체) · 경계에 걸친 선택도 현행 |

### E. 부수

| # | 결정 |
|---|---|
| D23 | AI 완성(`EditorView.tsx:1488`)·OCR(`:2547`) → `insertPlainText`. 삽입 3분 규약: `insertText`(툴바·단축키 상용구 — `{}` 커서 점프) / `insertPlainText`(채팅·AI 완성·OCR) / `insertMathSnippet`(수식 단축어 — 자리) |
| D24 | 자리 장식: 기본 없음(P21 (a)). (b)를 고르면 `slotsField`가 `Decoration.mark` 제공 — 토큰 `--border-content` 밑줄 |

---

## 3. 데이터 모델

```ts
// types/snippet.ts
export type SnippetKind = 'hotkey' | 'abbrev';
export interface MathSnippet {
  id: string;
  kind: SnippetKind;        // 저장값 없음 → 'hotkey' (기존 문서 무이관)
  name: string;
  shortcutIndex?: number;   // hotkey만 (1~9, 9 초과는 단축키 없음 — 현행)
  abbrev?: string;          // abbrev만 (D6)
  content: string;          // abbrev는 `▢` 포함 가능 (D7)
  order: number;            // hotkey = shortcutIndex(현행) · abbrev = 생성 시각 ms
  created_at: Date; updated_at: Date;
}
```

- `lib/snippets.ts`: `listSnippets` — `orderBy` 제거(§1-A ⚠), `kind: data.kind ?? 'hotkey'`, `order: data.order ?? data.shortcutIndex ?? 0`; 클라 정렬(hotkey: shortcutIndex → abbrev: 약어 사전순). `createSnippet(userId, data: {kind, name, content, shortcutIndex?, abbrev?})` — **항상 `order`를 쓴다**, abbrev 문서에 `shortcutIndex`를 쓰지 않는다. `updateSnippet` 같은 폭
- `hooks/useSnippets.ts`: `getByShortcut`은 `kind === 'hotkey'`만 · `abbrevMap: Record<string,string>` = `{...DEFAULT_ABBREVS, ...사용자 abbrev}`(`useMemo`) · `userAbbrevs: Set<string>`(메뉴 "대체됨") · `addSnippet`·`editSnippet` 시그니처 확장
- `MathSnippetMenu.getNextAvailableIndex`·단축키 칩은 **hotkey만** 센다
- 소비처 시그니처: `UnifiedToolbar.tsx:185-186` · `MathSnippetMenu.tsx:9-10` · `EditorView.tsx:3735-3738`
- 이관 0 · 규칙 0

---

## 4. 구현 사양

### 4-1. `lib/mathInput.ts` (신규 · import `./mathRegions`·`./latexScan`만 · `npm run test:mathinput`)

```ts
export const ROW_ENVS: readonly string[];                 // D15
export const AMP_ENVS: ReadonlySet<string>;
export const ROW_ENV_RE: RegExp;                          // /\\begin\{(?:aligned|…)\}/ — blockTidy R1 ①이 쓴다
export const DEFAULT_ABBREVS: Readonly<Record<string, string>>;   // §4-2
export const SLOT_CHAR = '▢';

export function parseSlots(content: string): { text: string; slots: number[] };            // D7
export interface EnvInfo { name: string; beginFrom: number; bodyFrom: number; bodyTo: number; endFrom: number; beginIndent: string }
export function findEnclosingEnv(doc: string, pos: number, region: MathRegion): EnvInfo | null;
export function groupDepth(doc: string, from: number, pos: number): number;                  // from~pos 사이 {} () [] 깊이, `\{`·`\(` 제외
export function nextSlot(doc: string, pos: number, region: MathRegion): number | null;      // D11
export function matchAbbrev(doc: string, pos: number, abbrevs: Record<string, string>, region: MathRegion): { from: number; content: string } | null;
export function autoFracAt(doc: string, pos: number): { from: number; numerator: string } | null;   // pos = `/`가 들어갈 자리(= `)` 바로 뒤)
export function rowEnterPlan(doc: string, pos: number, region: MathRegion): { from: number; to: number; insert: string; cursor: number } | null;  // D16
export function layoutRowEnvs(text: string): { text: string; changed: boolean };          // D17
```

- `findEnclosingEnv`: 영역 안을 스택 스캔(`\begin{name}` → `skipEnvArgs`로 `[opt]`·`{args}` 통과 → `bodyFrom`; `\end{name}` → pop). 커서를 품는 가장 안쪽 `ROW_ENVS` 환경. 헤더(`beginFrom ≤ pos < bodyFrom`)도 돌려준다(D16 ⓐ 판정용). `beginIndent` = `\begin`이 있는 행의 선두 공백
- `matchAbbrev`: `pos`에서 왼쪽으로 `[A-Za-z0-9]` 런을 읽고, 런의 **접미사** 중 가장 긴 약어(런 전체가 약어가 아니어도 `2sq`→`sq`). 약어 바로 앞 글자가 영문자·`\`면 불일치(`\log`·`alog` ✗). 약어 시작이 `region.innerFrom` 미만이면 불일치
- `autoFracAt`: `doc[pos-1] === ')'`; 왼쪽으로 균형 스캔해 짝 `(`(이스케이프 `\(`·`\)`는 건너뜀); 못 찾거나 `(`가 영역 밖이면 null; `(` 앞 글자 검사(D19); numerator = 괄호 안 원문
- `rowEnterPlan`: D16 ⓐ~ⓔ. 들여쓰기 "같은" = 현재 행 선두 공백 · "한 단계" = `beginIndent + '  '`. ⓒ의 치환 범위는 `[pos, \end 시작)`(사이 공백 흡수)
- `layoutRowEnvs` 정규형(멱등의 정의):
  1. 대상 = D17의 펜스형 display 영역 각각의 `innerFrom..innerTo`
  2. 재귀 `layout(seg, depth)`: `seg`를 스캔하며 **중괄호 깊이 0**에서 `ROW_ENV_RE`를 만나면 — 그 앞 텍스트(trim, 비면 생략)를 한 줄 · `\begin{env}`+인수(`skipEnvArgs`)를 **자기 줄**(`ind(depth)`) · 본문을 **중괄호 깊이 0 · 중첩 환경 밖**의 `\\`(뒤 `[…]` 인수 포함)로 행 분리 · 각 행 = `ind(depth+1)` + `layout(행 trim, depth+1)` + (행 뒤에 `\\`가 있었으면 ` \\`+인수) · `\end{env}`를 **자기 줄**(`ind(depth)`) · 뒤 텍스트 계속. `ROW_ENVS` 밖 환경(`tabular` 등)과 `\text{…}` 안은 통째로 보존
  3. 빈 행(`\\ \\` 사이)은 `ind(depth+1) \\`로 남긴다 · 마지막 행 뒤 `\\`는 있던 대로
  4. `ind(d)` = 공백 `2d`칸 · 펜스 안 최상위 = depth 0 · 출력 각 행 끝 공백 제거 · 펜스 `$$` 두 줄과 영역 밖 텍스트는 바이트 불변
  5. 원문과 결과가 같으면 `changed: false`
  예: `$$\nx=\begin{cases} a & x>0 \\ \begin{aligned}b&=1\\c&=2\end{aligned} & x\le0 \end{cases}\n$$` →
  ```
  $$
  x=
  \begin{cases}
    a & x>0 \\
    \begin{aligned}
      b&=1 \\
      c&=2
    \end{aligned}
    & x\le0
  \end{cases}
  $$
  ```
  (중첩 환경이 든 행은 "앞 텍스트 / 환경 / 뒤 텍스트"가 각자 줄 — 수식 렌더는 공백·줄바꿈을 무시하므로 동일)

### 4-2. 기본 수식 단축어 (`DEFAULT_ABBREVS`)

| 약어 | 내용 | 자리(D7 → `parseSlots`) |
|---|---|---|
| `b1` | `\overline{\mathrm{▢}}` | 1 + 끝 |
| `b2` | `{\overline{\mathrm{▢}}}^{2}` | 1 + 끝 |
| `log` | `\log_{▢}{▢}` | 2 + 끝 |
| `sq` | `\sqrt{▢}` | 1 + 끝 |
| `root` | `\sqrt[▢]{▢}` | 2 + 끝 |
| `lim` | `\lim_{▢ \to ▢}{▢}` | 3 + 끝 |
| `int` | `\int_{▢}^{▢}{▢ dx}` | 3 + 끝 |
| `sum` | `\sum_{k=▢}^{▢}{▢}` | 3 + 끝 |

### 4-3. `lib/mathSlots.ts` (신규 · import `@codemirror/state`·`./mathInput`만 · `npm run test:mathslots`)

```ts
export interface SlotState { ranges: { from: number; to: number }[]; active: number }
export const setSlots: StateEffectType<SlotState | null>;
export const slotsField: StateField<SlotState | null>;
export function insertWithSlots(view: EditorView, from: number, to: number, content: string): void;
export const nextSlotCmd: Command;   // 활성 자리 없으면 false
export const prevSlotCmd: Command;
```

- `slotsField.update(value, tr)`: ① `setSlots` 효과가 있으면 **그 값을 매핑 없이 즉시 반환**(F4 ①) ② `value`가 없으면 null ③ `tr.isUserEvent('undo') || tr.isUserEvent('redo')` → null(F4 ②) ④ `tr.docChanged` → 각 자리 `from = mapPos(from, -1)` · `to = mapPos(to, 1)`(빈 자리에 친 글자가 자리에 포함된다) ⑤ `tr.selection`이 있고 `main`이 활성 자리 `[from, to]` 밖이면 null(마우스·화살표 이탈 = 해제, R8)
- `insertWithSlots`: `parseSlots` → ranges = `slots.map(p => {from: from+p, to: from+p})` → **한 트랜잭션** `{changes:{from,to,insert:text}, selection:{anchor: ranges[0].from}, effects: ranges.length > 1 ? setSlots.of({ranges, active:0}) : [], scrollIntoView: true, userEvent: 'input.complete'}`(undo 1단계). 자리가 탈출 하나뿐이면 커서만 끝에
- `nextSlotCmd`: `active+1`이 마지막(탈출)이면 효과 `null`, 선택은 `{anchor: r.from, head: r.to}`(채운 자리로 돌아가면 그 텍스트가 선택된다 — CM 선례). `prevSlotCmd` 대칭, `active === 0`이면 false
- 장식: P21 (a)면 없음. (b)면 `provide: f => EditorView.decorations.from(…)` — 이때만 `@codemirror/view` import가 생긴다(테스트는 state만 쓰므로 `provide`는 (b)에서도 테스트 밖)

### 4-4. `components/editor/MarkdownEditor.tsx`

- 핸들 추가 `insertMathSnippet(content: string)` → `insertWithSlots(view, sel.from, sel.to, content)` + `view.focus()`. 주석에 3분 규약(D23)
- prop 추가 `abbrevs?: Record<string, string>` → `abbrevsRef`(`snippetCallbackRef` 패턴, `useEffect`로 동기)
- `tabHandler`(`:692-732`) 교체: `Prec.high(keymap.of([{ key: 'Tab', run: mathTab, shift: mathShiftTab }]))`. `mathTab` = D10 순서 그대로(`completionStatus`·`acceptCompletion`은 `@codemirror/autocomplete`, 자리 명령은 `lib/mathSlots`, 판정은 `lib/mathInput`). `&`·자리 이동 dispatch는 `scrollIntoView: true`
- extensions에 `slotsField` 추가
- `Enter` 바인딩 `Prec.high(keymap.of([{ key: 'Enter', run: rowEnter }]))`: `view.composing || completionStatus(state) === 'active'` → false · 영역 없음 → false · `rowEnterPlan` null → false · 아니면 dispatch(`{changes, selection, scrollIntoView: true, userEvent: 'input'}`) → true. **`shift`를 묶지 않는다**(F1)
- `inputHandler`(`:901`) 서명을 5인자로(`(view, from, to, text, insert)`). 순서: `if (!view.composing) { D22 선택 감싸기 → D20 `^`/`_` → D19 `/` }` → `\left` 쌍(기존) → 기존 괄호 처리. D20·D19는 `view.dispatch(insert())` 뒤 2차 dispatch(`annotations: isolateHistory.of('before')`). D19 2차: `changes: {from: f.from, to: from + 1, insert: \`\\frac{${f.numerator}}{}\`}`, `selection: {anchor: f.from + 6 + f.numerator.length + 2}`
- 제거: `metaListener`(`:849-868`)·등록(`:885`)·`lastMetaDownRef`(`:443`)·`tabStopsRef`(`:440`)·`insertText`의 `braceCount`/`tabStopsRef`(`:467-468`)·자동완성 apply의 `__tabStopsActive`(`:394-396`). 유지: `jumpToNextBrace`·`findMathRegion`(Alt-Tab)·`findInnermostExit`(Shift-Esc)
- ⚠ `@codemirror/autocomplete`의 `snippet`·`snippetKeymap`·`clearSnippet` **import 금지** — 파일 주석에 N1 사유

### 4-5. `components/editor/MathSnippetMenu.tsx`

- props: `snippets` · `abbrevs`(병합 결과) · `userAbbrevs` · `onInsert(content)`(hotkey) · `onInsertAbbrev(content)` · `onAdd(data)` · `onEdit(id, data)` · `onDelete(id)`
- 모드 `list | pick-kind | add-hotkey | add-abbrev | edit`. 리스트 = [단축키 상용구 절] + [수식 단축어 절: 사용자 → 기본("기본" 라벨 · 사용자가 덮은 것은 "대체됨" 흐림 · 수정·삭제 버튼 없음)]. 빈 상태 문구 절별
- 수식 단축어 폼: 이름 · 약어(D6 검증, 중복 인라인 오류) · 내용 textarea + `▢ 넣기`
- 폭 320 · 목록 최대 높이 420 유지(현행 값)

### 4-6. `components/editor/EditorView.tsx`

- `useSnippets()`에서 `abbrevMap`·`userAbbrevs` 추가 수신(`:1248`)
- `handleSnippetInsert(content)`(hotkey, `insertText` 현행) · 신설 `handleInsertAbbrev(content)` → `insertMathSnippet`
- `UnifiedToolbar`에 `abbrevs`·`userAbbrevs`·`onInsertAbbrev` 전달(`:3735-3738`) → `MathSnippetMenu`
- `SortableEditorBlock` → `MarkdownEditor`에 `abbrevs={abbrevs}` passthrough(`:1005-1011`)
- D23: `:1488`·`:2547` `insertText` → `insertPlainText`

### 4-7. `lib/blockTidy.ts` — `MULTILINE_ENV_RE` → `ROW_ENV_RE`(import `./mathInput`) · R5 = R3 루프 뒤 `layoutRowEnvs`(SPLITTABLE 타입만, `changed`면 `stats.fixed++`) · 머리 주석 규칙 목록 갱신

### 4-8. 문서

- CLAUDE.md 「핵심 패턴」에 Phase 68 절: 키 표(Tab · Shift+Tab · Enter · Shift+Enter(기본) · Alt+Tab · Shift+Esc · **Escape→Tab = 편집창 밖** · Ctrl+N 계열 · ⌃⌥1~9) · 삽입 3분 규약 · "Command 더블탭 제거" · "CM `snippet()` 금지 — 이스케이프 위치 버그(N1·프로브 수치)" · "(c) 형태 `$$\begin…` 안은 수식 밖"(R10)
- 「핵심 파일 구조」에 `lib/mathInput.ts`·`lib/mathSlots.ts` · roadmap Phase 68 절 · 완료 시 확정본을 `docs/phasedocs/`로(작업 규칙 7)

---

## 5. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | 확장 시 세로 스크롤 튐(autoHeight 규약) | 자체 트랜잭션에 `scrollIntoView: true` — CM 타자(`applyDefaultInsert`)와 **같은 플래그·같은 경로**. 실물 ⑨ |
| R2 | 키보드 탈출 | **해소** — Escape → 2초 안 Tab(CM 내장) |
| R3 | Escape 이중 반응 | **해소** — 자리 관리가 Escape를 쓰지 않는다 |
| R4 | 중첩 확장 시 바깥 자리 소실 | 새 자리 목록이 대체. 남은 빈 칸은 D11이 이어받는다 |
| R5 | `^2` → `^{2}` 원문 변화 | 정본 형식(proofread `:149`). `test:proofread` 회귀 |
| R6 | 목록(`- `) 안 `$$`에서 R5 들여쓰기 파싱 | 실물 ⑨ |
| R7 | `\mathrm{int}`에서 Tab 확장 | 명시적 Tab일 때만 · ⌘Z 1회 |
| R8 | 화살표·클릭으로 활성 자리를 벗어나면 해제 | 의도. 그 뒤 Tab은 D11 |
| R9 | `x^2+1`을 치면 `x^{2+1}` | P1에서 수용. 체감이 나쁘면 후속("그룹 안 한 글자 뒤 연산자 입력 시 자동 탈출") |
| R10 | (c) 형태 `$$\begin{…}`(여는 `$$`와 내용이 같은 행) 안에서는 Tab·Enter·후위 변환이 안 된다 | 알고 두는 한계. 펜스형으로 쓰면 된다. 정돈 R5도 (c)를 승격하지 않는다 |
| R11 | `ROW_ENV_RE` 교체로 R1 ① 분할 대상이 `align*`·`alignedat` 등으로 넓어진다 | 의도된 확장. `test:tidy` 18건 무회귀 + 추가 |
| R12 | 한글 IME: 음절 조합 직후의 `/`·`^`는 `compositionend`에서 `composing = -1`이 된 뒤 도착하므로 변환된다. 단 Safari dead-key 지연(dist 5221-5223) 같은 플랫폼 차는 실측 | 실물 ⑬ |

---

## 6. 범위 밖

- 댓글 `LatexInputEditor` 키 체계 통일(블록 편집기에서 써 보고)
- 기본 단축어 숨기기·순서 변경 · 스니펫 내보내기/가져오기
- 수식 밖 Tab 목록 들여쓰기
- R9 자동 탈출 · R10 (c) 형태 지원·승격

---

## 7. 덕수 판정 (★ 권장)

| # | 질문 | 권장 |
|---|---|---|
| P1 | Tab 자리 이동 | ★ 그룹 탈출 우선 → 다음 빈 칸(D11) |
| P2 | 수식 밖 Tab | ★ 제자리 |
| P3 | Alt+Tab | ★ 유지(Command 더블탭만 제거) |
| P4 | 자동완성 열림 + Tab | ★ 수락 |
| P5 | 선택 후 `{` | ★ `\left\{…\right\}` |
| P6 | 사용자 약어 = 기본 약어 | ★ 사용자 우선, 기본 행 "대체됨" |
| P7 | 자동 분수 조건 | ★ `(`가 항의 시작일 때만 |
| P8 | `^`·`_` 예외 | ★ 다음 `{`·앞 `\` |
| P9 | 정돈 레이아웃 범위 | ★ `$$` 펜스형만(P20과 같은 질문) |
| P10 | 구조 템플릿 3종 | ★ 삭제 |
| P11 | Shift+Tab | ★ 이전 자리만, 그 외 제자리 |
| P12 | Command 더블탭 | ★ 제거 |
| P13 | 단축어 자리 표시 | ★ `▢` + 없으면 빈 괄호 자동 + 끝 탈출 자동 |
| P14 | 환경 목록 단일 원천 `ROW_ENVS`(blockTidy R1 ①까지) | ★ 예 |
| P15 | 환경 본문 깊이 0 Tab | ★ 항상 `&`(빈 칸은 Alt+Tab) |
| P16 | 메뉴 클릭 + 커서 수식 밖 | ★ 그대로 삽입(`$` 감싸지 않음) |
| P17 | 빈 본문 행 Enter | ★ `\\` 없이 줄바꿈만 |
| P18 | `\end` 앞 Enter | ★ 새 행 + `\end`는 자기 행 |
| P19 | 선택 + `^`·`_` | ★ 변환 없음(선택 대체) |
| P20 | R5 범위 | ★ 펜스형만 — 한 줄 `$$…$$`·`\[…\]` 무접촉 |
| P21 | 대기 중 빈 자리 표시 | ★ (a) 없음 — 커서로 충분 / (b) `--border-content` 밑줄 |
| **P22** `[v4]` | Tab이 더 할 일이 없을 때 인라인 `$…$`면 닫는 `$` 뒤로 탈출 | ★ (a) **탈출**(인라인만, display는 제자리) / (b) 제자리(Shift+Esc로만) |

---

## 8. 작업 순서 (Stage별 1커밋)

| Stage | 내용 | 완료 조건 |
|---|---|---|
| S0 | `lib/mathInput.ts` + `tests/mathInput.test.mjs` + `package.json` `test:mathinput` | §9-1 ① 통과 |
| S1 | `lib/mathSlots.ts` + `tests/mathSlots.test.mjs` + `test:mathslots` | §9-1 ② — 8종 왕복 위치 정확 |
| S2 | 데이터 모델 · `lib/snippets.ts` · `useSnippets`(abbrevMap) | 기존 상용구 목록·단축키 바이트 무변화 |
| S3 | 키·엔진: Tab·Shift+Tab·Enter(D9~D16) · `insertMathSnippet` · `abbrevs` prop · 제거 항목(D14) · D23 | §9-2 ①~④·⑦·⑩·⑫ |
| S4 | 메뉴(D1~D8) + EditorView 배선 | 등록·수정·삭제 · 클릭 = Tab 확장과 동일 |
| S5 | 후위 변환·감싸기(D19~D22) | §9-2 ⑤·⑥·⑬·⑭ |
| S6 | 정돈 R5 + `ROW_ENV_RE` 교체 + `test:tidy` 보강 | 멱등 · 렌더 동일 · ⑮ |
| S7 | CLAUDE.md · roadmap · 확정본 `docs/phasedocs/` 등록 | — |

`package.json` 스크립트 꼴(기존 패턴): `tsc lib/mathInput.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/mathInput.test.mjs` (mathSlots는 `lib/mathSlots.ts`, `@codemirror/state`는 cjs 진입점이 있어 그대로 require된다)

---

## 9. 검증

### 9-1. 자동

① `test:mathinput`
- `parseSlots`: 8종 **자리 오프셋 고정**(예: `\int_{▢}^{▢}{▢ dx}` → text `\int_{}^{}{ dx}`, slots `[6, 10, 12, 16]`) · `▢` 없음 → 빈 괄호 자리 + 끝 · 빈 괄호도 없음(`\alpha`) → 끝 하나 · `\left\{▢\right\}`·`a\\{b}`가 **원문 그대로**(이스케이프 0)
- `nextSlot`: `^{2|}` 탈출 · `\frac{a|}{}` 형제 진입 · `\sqrt[|]{}` `]{` 진입 · `\sqrt{2|}(x)` → **`}` 뒤**(`(` 비진입, F2) · 그룹 밖 다음 빈 칸(`{}`·`[]`·`()`) · `[0, 1|)` 그룹 아님(N5) · 수식 경계 불가 → null
- `matchAbbrev`: `\log` ✗ · `alog` ✗ · `2sq` ✓(`sq`) · 가장 긴 것(`b1` vs 사용자 `ab1`) · 영역 밖 시작 ✗
- `autoFracAt`: `(x+1)/` ✓ · `f(x)/` ✗ · `\left(x\right)/` ✗ · `=(a)(b)/` ✗(`)` 뒤 `(`는 항의 시작이 아니다) · `\frac{1}{2}(x)/` ✗ · 첫 글자 `(a)/` ✓ · `\\(a)/`(줄바꿈 뒤) ✓
- `findEnclosingEnv`·`groupDepth`: aligned 안 cases 중첩 → cases · `\begin{array}{|p{2cm}|l|}` 인수 통과(W2) · 헤더 위치 판정
- `rowEnterPlan`: ⓐ~ⓔ 각 1건 · `\\[4pt]` 뒤 · 환경 밖 null · 인라인 영역 안 환경도 동작
- `layoutRowEnvs`: 한 줄 `\begin{aligned}a&=1\\b&=2\end{aligned}` → 4행 · §4-1 중첩 예시 바이트 일치 · `\\[4pt]` 보존 · `\text{a\\b}`·`tabular` 무분할 · (b) 한 줄 `$$…$$`·인라인·(c) 무접촉 · 펜스 밖 텍스트 불변 · **멱등**(결과에 다시 돌리면 `changed: false`)

② `test:mathslots`: 8종 각각 "`insertWithSlots` → 자리마다 1~4글자 입력 → `nextSlotCmd`" 끝까지 순회해 **최종 문서와 각 단계 선택 범위**를 고정(N1 회귀 방지) · 자리 1개면 효과 없음 · 활성 자리 밖 선택 → null · undo userEvent → null · 효과 트랜잭션에서 매핑 안 함 · `prevSlotCmd`가 채운 자리를 선택

③ 회귀: `test:tidy`(18 → 23+) · `test:proofread` · `test:mathsplit` · `test:mathregions` · `test:invisibles` · `test:ocr` · `test:sheet`

### 9-2. 실물

1. `$x^2+1$` 그대로 치기 → `x^{2}` 후 Tab → `+1`이 그룹 밖 → Tab → 커서가 `$` 뒤(P22 (a))
2. `lim` Tab → `x` Tab → `0` Tab → `f(x)` Tab → 다음 입력이 수식 끝 바깥
3. `int` 셋째 자리에서 `sq` Tab(중첩) → 이후 Tab이 남은 빈 칸으로
4. aligned: 깊이 0 Tab = `&` · `\frac{}{}` 안 Tab = 다음 칸 · Enter = ` \\`+줄바꿈+들여쓰기 · Shift+Enter = 들여쓰기 유지 줄바꿈(`\\` 없음)
5. `(a+b)/` → `\frac{a+b}{}` → ⌘Z → `(a+b)/` · `f(x)/` 무변환 · `^` → `^{}` → ⌘Z → `^`
6. 수식 안 선택 + `(`·`[`·`{` 감싸기 · 수식 밖 선택 + `(` 현행(대체)
7. 수식 밖·IME 조합 중 Tab → 제자리, 포커스 유지 · Shift+Tab 포커스 유지
8. `⌃⌥1` 무변화 · 메뉴 hover·제목 `스니펫` · 구조 템플릿 없음 · 기본 8종 "기본" · 사용자 `sq` 등록 → 기본 행 "대체됨"
9. 긴 블록 하단 확장 시 화면 튐 없음 · 목록(`- `) 안 `$$` 정돈 렌더
10. AI 완성·OCR 삽입 후 커서 = 삽입 끝
11. 환경 자동완성 직후 빈 행 Enter → `\\` 없음 · 마지막 행 끝 Enter → 새 행 + `\end` 자기 행
12. 자동완성 닫힌 상태에서 Escape 한 번 → Tab → 편집창 밖(F5)
13. 한글 음절 직후 `^`·`/` 변환 됨 · 조합 중 Tab 제자리(Chrome · Safari 둘 다)
14. 줄바꿈 끔(⌥Z) 모드에서 긴 줄 끝 `(a)/` 변환 뒤 가로 중앙 추적 정상(D21 `insert()` 경로)
15. 시트 가져오기 → 정돈으로 들어온 한 줄 aligned가 펼쳐지고 렌더 동일 · 다시 정돈 → 변화 0

---

## 10. 커밋 지침

- Stage별 1커밋, 메시지 머리 `feat(phase68):` / `fix(phase68):` / `docs(phase68):`
- CLI는 커밋까지, push 명령만 제시 — push는 덕수가 VSCode에서
- dev 서버 가동 중 `npm run build` 금지(작업 규칙 5)

---

## 11. 구현 기록 (CLI · 2026-10-07)

### 11-1. 커밋 (7)

| Stage | 커밋 | 내용 |
|---|---|---|
| S0 | `974ce96` | `lib/mathInput.ts` + `tests/mathInput.test.mjs`(13) + `test:mathinput`·`test:mathslots` 스크립트 |
| S1 | `7642c8b` | `lib/mathSlots.ts` + `tests/mathSlots.test.mjs`(7) |
| S2 | `d59c7d1` | `types/snippet.ts`(`kind`·`abbrev`·`SnippetInput`) · `lib/snippets.ts`(orderBy 제거 · `order` 필수) · `hooks/useSnippets.ts`(`abbrevMap`·`userAbbrevs`) |
| S3 | `c50035a` | `MarkdownEditor.tsx` — Tab·Shift+Tab·Enter 엔진 · **후위 변환·선택 감싸기(계획의 S5를 흡수 — inputHandler 한 곳)** · `insertMathSnippet` · `abbrevs` prop · 탭스톱 무장·Command 더블탭·`__tabStopsActive` 제거 |
| S4 | `0f023bb` | `MathSnippetMenu.tsx` 전체 교체 · `UnifiedToolbar.tsx`(hover `스니펫`·props) · `EditorView.tsx`(`handleInsertAbbrev`·passthrough·D23 AI 완성/OCR `insertPlainText`) |
| S6 | `407e3d0` | `lib/blockTidy.ts` R5 + `MULTILINE_ENV_RE → ROW_ENV_RE` · `test:tidy` 18 → 21 |
| S7 | (이 커밋) | CLAUDE.md 핵심 패턴 6절·파일 구조·현재 Phase · roadmap · 이 확정본 |

S2~S4는 소비처 시그니처가 S4에서 바뀌어 **함께 컴파일**된다(각 커밋 메시지에 명시). `npx tsc --noEmit` 0 오류 · 로직 테스트 21종 543 → **23종 566건**(기존 스위트 전부 무회귀: tidy 21 · proofread 50 · mathsplit 16 · mathregions 10 · invisibles 8 · ocr 6 · sheet 73).

### 11-2. 계획 대비 이탈·확정

| # | 내용 |
|---|---|
| I1 | **S5가 S3에 흡수** — 후위 변환·감싸기는 `inputHandler` 한 함수 안이라 Tab·Enter와 같은 커밋이 자연스럽다. 커밋 수 8 → 7 |
| I2 | `autoFracAt`: **`(a)(b)/`는 무변환**으로 확정 — §9-1의 "`(b)`만" 기대는 D19와 모순이었다(`)`는 항의 시작 집합에 없다). 테스트·§9-1 정정 |
| I3 | `parseSlots` 기본 8종 오프셋 실측: `int` = `[6, 9, 11, 15]`(§9-1에 적은 `[6, 10, 12, 16]`은 `\int`를 5자로 센 오산) — 테스트가 실제 값을 고정 |
| I4 | `test:mathslots`는 `@codemirror/state`를 **`createRequire`(CJS)**로 읽는다 — ESM import는 컴파일된 lib와 다른 복사본이라 `Field is not present`(dual package hazard). 핵심 패턴에 기록 |
| I5 | `matchAbbrev`에 `region` 인자 추가(약어 시작이 영역 안인지 검사) · `autoFracAt`도 `region`을 받아 `(`를 영역 안에서만 찾는다 |
| I6 | R5는 `autoFix` 옵션과 **무관**하게 돈다(내용 변화 0인 레이아웃이라 시트 토글의 의미 밖). `stats.fixed`에 1을 더한다 |
| I7 | 블록 정돈 기존 테스트 "R1 ①" 기대값을 R5 레이아웃 반영으로 갱신(떼어 낸 display 조각이 R5를 받는 것이 의도) |
| I8 | `rowEnterPlan`: 현재 행이 `\begin` 행이면(한 줄 환경) 들여쓰기 = `beginIndent + 2칸`(계획의 "같은 들여쓰기"가 한 줄 환경에서는 0이라 보정) |

### 11-3. 실측 — headless Chrome CDP 31/31 (임시 라우트 `app/dev68`, 검증 뒤 삭제)

`Input.insertText`(타자 — inputHandler 경로) · `Input.dispatchKeyEvent`(Tab·Shift+Tab·Enter·Shift+Enter·Escape·⌘Z)로 §9-2 ①~⑦·⑪·⑫와 메뉴 경로(`insertMathSnippet`)를 돌렸다.

- ① `$x^2+1$` 그대로 → `^{}` · Tab 탈출 · Tab으로 `$` 밖(P22) · 밖 Tab 제자리·포커스 유지
- ② `lim` Tab → 자리 3 순회 → closeBrackets `()` 공존 → 탈출 자리 → `$` 밖
- ③ `int` 셋째 자리에서 `sq` Tab(중첩) → 탈출 → D11 `{ dx}` 탈출
- ④ aligned 깊이 0 Tab = `&` · Enter = ` \\`+줄바꿈+들여쓰기 · **Shift+Enter = 들여쓰기 유지 줄바꿈(`\\` 없음, F1 확인)** · `\frac{}{}` 안 Tab = 다음 칸
- ⑤ `(a+b)/` → `\frac{a+b}{}` → ⌘Z → `(a+b)/` · `f(x)/` 무변환 · `^` ⌘Z → `^` 남음 · `x{}`에서 `_` → 그냥
- ⑥ 선택 + `(`·`{` 감싸기 · 수식 밖 선택 + `(` = 현행(대체)
- ⑦ 수식 밖 Tab/Shift+Tab 제자리·포커스
- ⑫ Escape → Tab = 편집창 밖(CM 내장) — ⚠ **첫 실행은 실패였다**: 페이지에 포커스 가능한 요소가 편집창 하나뿐이라 브라우저 기본 Tab이 **자기에게 되돌아왔다**. 앞뒤에 `<input>`·`<button>`을 두니 통과 — 포커스 이탈 검사의 하니스 조건
- ⑪ 빈 행 Enter = 줄바꿈만 · `\end` 앞 Enter = 새 행 + `\end` 자기 행
- 메뉴 경로: `insertMathSnippet`이 수식 밖에서도 그대로(P16) · 수식 밖 자리도 Tab 이동(③ 안팎 무관)
- 첫 실행의 나머지 실패 7건은 전부 **하니스의 커서 인덱스 오산**(`\begin{aligned}` 15자 등)이었다 — 코드 수정 0

### 11-4. 덕수 실물 검수 — **종결(2026-10-08, "테스트해봤는데, 다 잘 작동해")**. 반영 0건. 검수 항목:

§9-2 ⑧ 메뉴(두 절·기본 8종·"대체됨"·종류 선택·`▢ 넣기`) · ⑨ 긴 블록 하단에서 확장 시 화면 튐 없음 · 목록(`- `) 안 `$$` 정돈 렌더 · ⑩ AI 완성·OCR 커서 = 삽입 끝 · ⑬ 한글 음절 직후 `^`·`/` 변환(Chrome·Safari) · ⑭ 줄바꿈 끔 모드 가로 중앙 추적 · ⑮ 시트 가져오기 정돈 → 한 줄 aligned 펼침·재정돈 변화 0.
