# Phase 61c 구현 계획서 — 대화 → 편집창 삽입 (v1)

> 대상: CLI Claude (실측 교차검토 → 구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **C축**
> 계보: **v1(web, 2026-08-23)** → v2(CLI 실측 교차검토) → v3(web 재검증·판정) 예정
> 진실 원천: mathory **origin/main `4ad2207`** (Phase 61b 구현 반영 후. 인용 라인은 전부 이 해시 기준)
> 범위: 기획서 D 진행표의 **단계 5(삽입 기능)** 전부. A축(61a)·B축(61b)은 완료 상태를 전제로 한다.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

agent 대화창(메시지 본문·검증 리포트 카드)에서 영역을 드래그하면 선택 근처에 미니 팝업([편집창에 삽입] · [복사])이 뜨고,
선택 영역을 **Mathory 표기 규약의 마크다운으로 직렬화**(렌더된 수식 → 원본 `$...$` 무손실 복원)해서
현재 활성 블록의 커서 위치에 `insertText`로 꽂는다. **서버 0 · Firestore 0 · 전처리 파이프라인 무변경.**

---

## 1. 기획서 전제의 실측 판정 — "원본 LaTeX 보존"은 절반만 참이다

기획서 C-2는 "렌더된 수식 안에 원본이 보존되어 있어 추측 변환이 아니라 무손실 복원"이라고 썼다. 실측 결과:

- **보존 자체는 사실이다.** KaTeX는 기본 output(`htmlAndMathml`)에서 `.katex-mathml` 안에
  `<annotation encoding="application/x-tex">`로 입력 TeX를 남긴다. `EditorPreview`의 rehype-katex 옵션(:300)은
  `{ strict:false, trust:true, macros }`뿐이라 output 기본값이 유지된다.
- **그러나 annotation에 든 것은 원본이 아니라 전처리된 TeX다.** `EditorPreview`의 `preprocessMath`(:178-227)가
  KaTeX에 닿기 전에 원문을 변형한다 —
  - 인라인 `$x$` → `$\displaystyle x$` (:216-222)
  - 다행 display `$$…\\…$$` → `$$\n\begin{array}{l}\n\displaystyle …\n\end{array}\n$$` 래핑 (:186-199)
  - `\tag{n}` → `\tag*{(n)}`, `\ref{n}` → `\text{(n)}` (:180-183)

  annotation을 그대로 삽입하면 편집창 원문이 `\displaystyle`·`array{l}` 찌꺼기로 오염된다. **"annotation = 원본" 경로는 그대로는 못 쓴다.**

**무손실 복원의 진짜 경로는 이미 코드에 있다 — Phase 56 인프라.** `EditorPreview`는 렌더 후 모든 `.katex`에
출현 순서대로 `data-math-id`를 부여하고(:385-392), `lib/mathIndex.ts`의 `buildMathIndex(source)`는 원본 문자열에서
같은 출현 순서로 수식 구간 `{from,to}`를 인덱싱한다. 이 대응은 Phase 56의 편집창↔미리보기 수식 하이라이트가
이미 실사용으로 검증한 것이다. 따라서:

> **선택된 `.katex`의 `data-math-id` → 소스 문자열의 같은 순번 수식 구간을 슬라이스 = 구분자까지 포함한 원문 그대로.**

annotation은 이 경로가 실패할 때의 **폴백**(역변환 동반)으로 강등한다. → §4 D1.

---

## 2. 아키텍처

**전부 클라이언트. 추출(직렬화) 코어는 순수 모듈, 팝업은 CommentPanel 소유, 삽입 콜백은 EditorView 주입 전용.**

- `lib/chatExtract.ts` — DOM 없는 순수 함수(수식 인덱스·annotation 역변환·구분자 정규화). `node --test` 대상.
- `components/comment/SelectionInsertPopup.tsx` — 선택 감지·팝업·DOM 직렬화 워커. CommentPanel 안에 마운트.
- `EditorView` — `onInsertToEditor` 콜백 1개 주입(`onInsertGraphBlock`·`onRunVerify` 선례 = 61b D12).
  **prop 유무가 곧 게이트** — ProblemView·공유뷰 변경 0.

이유: (a) 저장·서버·규칙을 전혀 건드리지 않는 순수 UI 기능이다. (b) 직렬화 규칙은 회귀가 잦을 부위라
순수 코어를 테스트 하니스(61a·61b 관례)에 태운다. (c) 게이트를 prop 주입으로 하면 열람뷰에서는 코드 경로 자체가 없다.

---

## 3. 확정 사실 (실측, 전부 `4ad2207`)

| # | 사실 | 위치 |
|---|---|---|
| 3-1 | 댓글 본문 렌더 = `EditorPreview` 재사용. content는 `verify ? verify.body : comment.content` — **검증 리포트 댓글의 본문 소스는 comment.content가 아니라 펜스 제거된 `verify.body`다** | `CommentPanel.tsx:1683-1692` |
| 3-2 | `EditorPreview` 파이프라인: `protectFences → preventSetextHeadings → preprocessLocale → preprocessMath → restoreFences → ReactMarkdown(remarkMath·remarkGfm, rehypeRaw·rehypeKatex)` | `EditorPreview.tsx:277-282, 295-301` |
| 3-3 | `preprocessMath`의 변형 3종(§1) 때문에 annotation ≠ 원본 | `EditorPreview.tsx:178-227` |
| 3-4 | 렌더 후 `.katex` 전부에 출현 순서 `data-math-id` 부여. **인스턴스(=댓글 1개)별 독립 카운터** — contentRef 범위 | `EditorPreview.tsx:385-392` |
| 3-5 | `buildMathIndex`는 `$$…$$`·`$…$`·`\[…\]`·`\(…\)` 4형태를 출현 순서로 인덱싱. 인라인 `$`는 빈 줄에서 포기 | `lib/mathIndex.ts:19-73` |
| 3-6 | **순서 스큐 위험**: `protectFences`(:78-86)는 ``` 펜스 안 `$`를 렌더에서 제외하지만 `buildMathIndex`는 펜스를 모른다. 인라인 코드 `` `$…$` ``도 remark가 code로 먹어 `.katex`가 안 생긴다 → 소스 인덱스와 DOM 순번이 어긋날 수 있다 | `EditorPreview.tsx:73-86` + remark 동작 |
| 3-7 | 마커 span은 렌더 전용이고 원문은 리터럴 보존: `marker-gana`("(가)")·`marker-giyeok`("ㄱ.")·`marker-circled`("①")는 textContent = 원문. **예외 2종**: `tag-marker`는 "(n)"으로 바뀌어 원문 `\tag{n}` 소실, `marker-case-sub`는 내부 `**`가 strong으로 렌더돼 소실 | `EditorPreview.tsx:137-171` · CLAUDE.md 전처리 절 |
| 3-8 | 삽입측 API 완비: `MarkdownEditorHandle.insertText(text, cursorOffset)` = 현재 selection 대체 + 커서 이동 + `view.focus()`. MathToolbar가 같은 규약으로 사용 | `MarkdownEditor.tsx:321-346` · `EditorView.tsx:2122-2126` |
| 3-9 | `activeBlockId`는 blur로 해제되지 않는다 — 대화창에서 드래그해도 마지막 활성 블록이 유지된다. `setActiveBlockId(null)` 경로는 탭 전환 폴백뿐 | `EditorView.tsx:1042, 2940` |
| 3-10 | 삽입 → CM dispatch → onChange → dirty·자동저장·CM undo에 **자연 편입** (툴바 삽입과 동일 경로, 추가 배선 0) | `EditorView.tsx:1096-1103` |
| 3-11 | 접힌 블록·전체접기에서는 편집기 ref가 없을 수 있다 — `handleJumpToBlock`이 점프 전에 collapsed를 풀어주는 것이 그 증거 | `EditorView.tsx:2735-2751` |
| 3-12 | `CommentPanel` 마운트 2곳: `EditorView.tsx:3650` · `ProblemView.tsx:990`. 게이트 선례 = prop 유무(61b D12) | 실측 |
| 3-13 | `VerifyReportCard`는 EditorPreview 밖에서 자체 렌더: `renderInlineMathHtml`이 `$…$`/`$$…$$`를 찾아 `katex.renderToString(latex, displayMode:false)` — **여기 annotation은 전처리를 안 거친 원본 latex(trim만)다.** `data-math-id` 없음 | `VerifyReportCard.tsx:174` · `lib/katex-render.ts:16, 48-77` |
| 3-14 | 메시지 리스트 스크롤 컨테이너 = `messagesScrollRef`(:895), 패널 루트는 `position:absolute; zIndex:50`(:878-891) — 팝업 앵커·좌표계로 사용 가능 | `CommentPanel.tsx` |
| 3-15 | 단일 댓글 렌더러 = `CommentItem`(:1529), 본문 div = `.comment-body`(:1683) — 소스 대응 스탬프를 붙일 자리 | `CommentPanel.tsx` |
| 3-16 | 그래프 펜스는 `GgbGraphView` 위젯으로, `mathory-verify` 펜스는 카드로 렌더 — 텍스트 직렬화 대상이 아니다 | `CommentPanel.tsx:1556-1561` |
| 3-17 | 테스트 하니스 관례: `tsc <파일들> --outDir .test-build --rootDir . …` + `node --test` (`test:verify`가 다중 파일 선례) | `package.json:8-14` |
| 3-18 | 이 프로젝트에 다크 모드는 없다 — 팝업에 다크 토큰을 만들지 말 것 | CLAUDE.md |

---

## 4. 결정 (D1~D10 — v1 제안, 교차검토 대상)

| # | 결정 | 근거 |
|---|---|---|
| **D1** | **수식 복원 이중화**: ① 1순위 = `data-math-id` → `buildRenderedMathIndex(source)` 같은 순번 슬라이스(구분자 포함 원문 그대로). ② 폴백 = annotation + `stripPreviewArtifacts` 역변환. **①은 개수 대조 관문을 통과할 때만** — 해당 댓글 DOM의 `.katex` 개수 ≠ 인덱스 개수면 순서 스큐가 의심되므로 ① 전체를 버리고 ②로 간다(조용한 오염 금지) | §1 · 사실 3-6 |
| **D2** | **소스 대응은 data 스탬프로**: `CommentItem`의 `.comment-body`에 `data-comment-id`를 붙이고, 직렬화 시 comments 상태에서 content를 찾아 **`verify ? extractVerifyReport(content).body : content`**(사실 3-1과 동일식)를 소스로 쓴다. `VerifyReportCard` 내부 선택은 슬라이스 경로 없이 annotation 경로 전용(사실 3-13 — 거기 annotation은 원본이다) | 3-1 · 3-13 · 3-15 |
| **D3** | **게이트 = `onInsertToEditor` prop 유무** (EditorView 주입 전용, 61b D12 선례). 팝업 자체를 prop이 있을 때만 마운트 — v1에서 [복사]도 편집 화면 전용이 된다. ProblemView 확장은 후속 판단 | 3-12 |
| **D4** | **선택은 단일 댓글 안으로 제한**: Range가 `.comment-body`(또는 카드) 하나 안에 들어 있지 않으면 팝업 미표시. 기획서 C의 용도("구절·수식")에 여러 메시지에 걸친 선택은 없다 — 직렬화 소스가 하나로 고정되어 D1·D2가 단순해진다 | 단순화 |
| **D5** | **삽입 대상 = `activeBlockId`의 편집기.** ref가 없으면(활성 블록 없음·접힘·전체접기) 삽입하지 않고 팝업에 짧은 안내("블록을 먼저 선택하세요"). insertText가 편집기 내 기존 선택을 대체하는 것은 툴바와 동일 규약으로 수용(같은 undo 1회로 복원) | 3-8 ~ 3-11 |
| **D6** | **수식 경계 확장(기획서 C-3)**: Range 양끝이 `.katex`(또는 `.katex-display`·`.katex-mathml`·`.katex-html`) 내부에 걸치면 그 수식 요소 전체를 포함하도록 경계를 넓힌다. 수식은 자르지 않는다 | 기획서 C-3 |
| **D7** | **구분자 정규화는 삽입 텍스트에만**: 슬라이스가 `\(…\)`/`\[…\]`형이면 `$…$`/`$$…$$`로 통일(기획서 C-3, 61a C6의 `(?<!\\)` 뒤돌아보기 재사용). **`$$` 앞뒤 빈 줄 정규화는 하지 않는다 — `toPersistedBlock`이 소유한다(61a Y1과 동일 소유권 규칙)** | C-3 · 61a Y1·C6 |
| **D8** | **직렬화 규칙표(§5.2)로 범위를 못 박는다**: text·수식·p/br/li·strong/em·인라인 code·마커 span 역변환까지. 그 밖의 요소는 textContent로 강등, 위젯(그래프·이미지·카드 안 버튼류)은 스킵 | 3-7 · 3-16 |
| **D9** | **`selection.toString()` 사용 금지** — KaTeX DOM은 `.katex-mathml`(annotation 포함)과 `.katex-html`(글리프)이 중복 존재해 브라우저 기본 직렬화가 수식을 두 번 뱉는다. 반드시 D8 워커로 직렬화한다 | KaTeX DOM 구조 |
| **D10** | **팝업 버튼은 `onMouseDown`에서 `preventDefault`** — mousedown 기본 동작이 선택을 해제하면 click 시점에 Range가 사라진다. 직렬화는 mousedown 시점의 Range로 수행 | 브라우저 동작 |

---

## 5. 구현 항목

### 5.1 `lib/chatExtract.ts` — 순수 코어 (DOM 없음)

```ts
export interface RenderedMath { latex: string; display: boolean }   // latex = 구분자 포함 원문 슬라이스

/** 렌더 순서와 일치하는 수식 목록.
 *  ⚠ buildMathIndex를 바로 쓰면 안 된다(사실 3-6) — 렌더러와 같은 순서로 보이게 먼저 가린다:
 *  ① 코드펜스 보호: EditorPreview.protectFences와 동일 정규식(사본 + "반드시 일치" 주석 —
 *     preventSetextHeadings 사본 관례. lib 추출로 사본을 없애는 안은 CLI 판단, 단 렌더 사이트 파급 0이 조건)
 *  ② 인라인 코드 보호: `[^`\n]*` 근사 (검증 요청 Q2)
 *  그 후 buildMathIndex(lib/mathIndex.ts 재사용)로 슬라이스. placeholder 길이 불일치로 오프셋이
 *  움직여도 무방 — 필요한 것은 순서와 슬라이스 문자열뿐이다. */
export function buildRenderedMathIndex(source: string): RenderedMath[]

/** annotation 폴백용 역변환: 선두 \displaystyle 제거(각 행), 정확히
 *  `\begin{array}{l}…\end{array}` 래퍼( preprocessMath가 만든 형태)만 언랩,
 *  \tag*{(n)} → \tag{n}, \text{(n)} → \ref{n}.
 *  ⚠ 사용자가 직접 쓴 array·\text{(…)}와의 오검 가능성이 폴백을 2순위로 두는 이유다(D1) */
export function stripPreviewArtifacts(tex: string): string

/** \(…\)→$…$, \[…\]→$$…$$ — 61a C6의 (?<!\\) 뒤돌아보기 필수(\\[6pt] 보호) */
export function normalizeMathDelimiters(text: string): string
```

테스트(`npm run test:extract`, 사실 3-17 하니스):
`tsc lib/chatExtract.ts lib/mathIndex.ts --outDir .test-build --rootDir . …` + `tests/chatExtract.test.mjs`.
필수 케이스: 펜스 안 `$` 스큐 · 인라인 코드 `$` 스큐 · `\\[6pt]` 보호 · array{l} 언랩(사용자 array는 비언랩) ·
`\tag*` 역변환 · 4형태 구분자 정규화 · 홀수 `$`.

### 5.2 직렬화 워커 (`SelectionInsertPopup.tsx` 내부)

`serializeRange(range, ctx): string | null` — Range를 D6로 확장한 뒤 TreeWalker로 순회:

| DOM | 출력 |
|---|---|
| 텍스트 노드 | 그대로 (범위 절단 반영) |
| `.katex` (최상위) | D1 경로로 latex 복원. display 판정 = `closest('.katex-display')` 또는 슬라이스 접두(`$$`/`\[`). 서브트리 스킵 |
| `.tag-marker` | textContent "(n)" → ` \tag{n}` 역변환. 스킵 |
| `.marker-case-sub` | `**${textContent}**` (내부 strong 중복 방지 위해 서브트리 스킵) |
| `.marker-gana`·`.marker-giyeok`·`.marker-circled` | textContent 그대로(원문 리터럴, 사실 3-7) |
| `strong` / `em` | `**…**` / `*…*` 래핑 |
| 인라인 `code` | `` `…` `` 래핑 |
| `p`·블록 경계 | `\n\n` (기획서 C-3 "문단 경계는 빈 줄") · `br` → `\n` |
| `li` | `- ` 접두 (ol 번호·중첩은 CLI 재량 — Q6) |
| `img`(twemoji 포함) | alt 텍스트, 없으면 스킵 |
| `pre`·그래프 위젯·카드 버튼류 | 스킵 (D8) |
| 기타 요소 | 자식 재귀, 모르면 textContent |

마무리: 앞뒤 trim, 3연속 이상 개행 → 2, `normalizeMathDelimiters` 적용(D7). 빈 결과면 null.

### 5.3 팝업 — `components/comment/SelectionInsertPopup.tsx`

- CommentPanel 루트(이미 `position:absolute`) 안에 마운트, `messagesScrollRef`를 prop으로 받는다.
- `document.selectionchange`(rAF 디바운스) + `mouseup`: 비어 있지 않은 Range가 **하나의** `.comment-body`
  또는 검증 카드 안에 있으면(D4) `range.getClientRects()` 마지막 rect 근처에 표시. 스크롤·collapsed 시 숨김.
- 버튼: **[편집창에 삽입]** · **[복사]**. 스타일은 기존 팝오버 관례(작은 카드, `var(--bg-card)`·`var(--border-light)`,
  zIndex는 패널(50) 위). 다크 토큰 없음(사실 3-18).
- 삽입: `serializeRange` → `onInsertToEditor(text)` → `'inserted'`면 selection collapse(편집기 focus가 이어서 처리),
  `'no-target'`이면 팝업 안에 1줄 안내(D5).
- 복사: `navigator.clipboard.writeText(직렬화 결과)` — 브라우저 기본 복사(수식 중복, D9)보다 나은 마크다운 복사.
- D10: 두 버튼 모두 `onMouseDown={e => e.preventDefault()}`.

### 5.4 배선

- `CommentPanelProps`에 `onInsertToEditor?: (text: string) => 'inserted' | 'no-target'` 추가(61b 주석 관례대로
  "편집 화면에서만 전달 — prop 유무가 곧 게이트" 명기). `CommentItem` 본문 div에 `data-comment-id` 스탬프(D2).
- `EditorView`에 `handleInsertFromChat` 신설:

```ts
const handleInsertFromChat = useCallback((text: string) => {
  const ref = activeBlockId ? editorRefs.current[activeBlockId] : null;
  if (!ref) return 'no-target' as const;
  ref.insertText(text, text.length);   // selection 대체·focus·onChange→dirty·undo까지 기존 경로(사실 3-8·3-10)
  return 'inserted' as const;
}, [activeBlockId]);
```

- ProblemView·공유뷰·인쇄 변경 0.

---

## 6. 작업 순서 (파일럿 우선)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | **전제 실측**(코드 변경 0): 실제 agent 메시지 DOM에서 ① annotation 실재 ② `data-math-id` 순번 ↔ 소스 수식 순번 대응 ③ 스큐 유발 샘플(펜스·인라인 코드 포함 메시지) 채집 | §1 전제가 실물에서 성립. 스큐 샘플 목록 확보 (Q1·Q2) |
| 1 | `lib/chatExtract.ts` + `npm run test:extract` | §5.1 필수 케이스 전부 통과 |
| 2 | 팝업 + 직렬화 워커 — **[복사]만 먼저** | 실 대화(수식·마커·리스트·리포트 카드 포함)에서 복사 결과 마크다운이 편집창에 붙여넣어 원문 규약대로 렌더됨. **유일한 중간 관문: 덕수가 실물 대화로 직렬화 품질 검수** |
| 3 | `onInsertToEditor` 배선 + [편집창에 삽입] | 드래그 → 삽입 → 커서 위치 반영·dirty·undo 1회 복원. no-target 안내 동작 |
| 4 | 마무리: 검증 카드 내부 선택 · 경계 확장(D6) 엣지 · roadmap·Phase 문서 | §8 체크리스트 통과 |

---

## 7. 하지 말 것 / 주의

- **`EditorPreview` 전처리 파이프라인 수정 금지** — 렌더 사이트 5곳 공유 부위다. 이번 Phase가 EditorPreview에 더하는 것은 없다(data-math-id도 기존 것).
- **`selection.toString()` 금지**(D9) · annotation을 역변환 없이 삽입 금지(§1) · 순서 스큐 의심 시 슬라이스 경로 강행 금지(D1 관문).
- **`$$` 앞뒤 빈 줄 정규화 중복 구현 금지** — `toPersistedBlock` 소유(61a Y1). 삽입 텍스트는 D7 구분자 통일까지만.
- `stripForHistory`·`extractVerifyReport`·검증 카드 렌더 무변경. 마커 리터럴을 "친절히" 다른 표기로 바꾸지 말 것(61a §7 규칙).
- 팝업에서 `scrollIntoView` 금지(CLAUDE.md) — 좌표는 rect 계산으로만. 다크 토큰 금지(3-18).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 8. 검증 체크리스트 (스텝 4)

T1 인라인 수식만 선택 → `$…$` 원문 그대로 (displaystyle 흔적 0) ·
T2 다행 display 수식 → `$$…\\…$$` 원문 그대로 (array{l} 흔적 0) ·
T3 수식 중간에 걸친 드래그 → 수식 통째 포함(D6) ·
T4 `\tag{n}` 행·(가)·ㄱ.·①·`**Case na.**` 역변환 ·
T5 코드펜스·인라인 코드 `$` 포함 메시지에서 오염 0 (폴백 강등 확인) ·
T6 검증 카드 인용(quote) 선택 → `$` 규약 복원 ·
T7 삽입 후 undo 1회로 복원, dirty·자동저장 정상 ·
T8 전체접기·활성 블록 없음 → no-target 안내 ·
T9 여러 댓글에 걸친 선택 → 팝업 미표시 ·
T10 ProblemView(열람)에서 팝업 코드 경로 부재.

## 9. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · 인쇄 · 공개 뷰어 · ProblemView ·
discuss/proofread/verify 라우트·프롬프트. **전부 0건.**
신규 파일 2개(`lib/chatExtract.ts` · `components/comment/SelectionInsertPopup.tsx`) + 테스트 1개 +
`CommentPanel`(prop 1·스탬프 1·마운트 1) + `EditorView`(콜백 1) + `package.json` 스크립트 1.

---

## 10. CLI 검증 요청 (v2에서 답할 것)

| # | 요청 |
|---|---|
| Q1 | rehype-katex 설치 버전에서 annotation 실재를 DOM으로 실측 (output 기본값이 버전에 따라 다를 수 있다 — 만약 mathml이 없다면 D1 폴백 전면 재설계 필요) |
| Q2 | 순서 스큐 실측: 실제 AI 메시지(검산 python 부록·mathory-graph 펜스·인라인 코드)에서 `.katex` 개수 ↔ `buildRenderedMathIndex` 개수 대조. 인라인 코드 보호 근사(`` `[^`\n]*` ``)가 remark의 코드스팬 규칙(다중 백틱 등)과 어긋나는 실사례가 있는지 |
| Q3 | `marker-case-sub` 내부 DOM 실측 (`**`가 strong으로 렌더되는지 — §5.2 규칙의 전제) |
| Q4 | 접힘 블록·전체접기에서 `editorRefs` 실재 여부 실측 (D5의 no-target 분기 조건 확정) |
| Q5 | D10(mousedown preventDefault)로 선택이 유지되는지 브라우저 실측. 터치 기기 판정(v1은 데스크톱 우선 — 터치 지원 여부·방식 재량) |
| Q6 | ol 번호·중첩 리스트 직렬화 재량 확정 (§5.2) |
| Q7 | StrictMode 이중 렌더에서 `data-math-id` 부여 effect가 선택 시점에 항상 완료돼 있는지 (미부여 `.katex`를 만나면 D1 폴백으로 가는지 확인) |
| Q8 | 팝업 위치·스타일의 기존 팝오버 관례 대조 (61b 비용 팝오버와 시각 일관성) |

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| **v1** | **web** | 초안 — 기획서 C-2 전제 재판정(§1) · 사실표 3-1~3-18 · D1~D10 제안 · 검증 요청 Q1~Q8 |
| v2 | CLI | 실측 교차검토 (예정) |
| v3 | web | 재검증·판정 (예정) |

*v1 — 교차검토 대기. 61a·61b 교훈 승계: 인용은 전부 origin/main `4ad2207` 기준, 사실 분쟁 시 "각자 무엇을 읽었는가"부터 대조할 것.*
