# Phase 61c 구현 계획서 — 대화 → 편집창 삽입 (v2 확정판 · CLI 실측 교차검토)

> 대상: web Claude(v3 재검증·판정) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **C축**
> 계보: v1(web, 2026-08-23) → **v2 확정판(CLI 실측 + 덕수 결정 5건 확정, 2026-08-23)** → v3(web 재검증·판정) 예정
> 상태: **결정 요청 0건 — 그대로 착수 가능.**
> 진실 원천: mathory **origin/main `4ad2207`** · 실측은 설치된 `node_modules`(rehype-katex 7.0.1 · katex 0.16.28 · react-markdown 10)로 **실제 remark/rehype 파이프라인을 돌려** 얻었다.
> 범위: v1과 동일(기획서 D 진행표 단계 5).

---

## 0. 판정 한 줄

**v1의 골격(§1 재판정 · 이중 복원 · 개수 게이트 · prop 게이트 · DOM 워커)은 그대로 유효하다.**
다만 ⓐ 순서 스큐는 "위험"이 아니라 **실측 상수**이고(마스킹 없이는 폴백이 주경로가 된다),
ⓑ 직렬화 규칙표에 실물 DOM과 어긋나는 항목이 5건 있으며,
ⓒ **v1이 통째로 놓친 충돌이 둘**(검증 카드 `onClick` 점프 · `insertText`의 `{}` 탭스톱) 있다.
아래 C1~C18이 정정, D1~D14가 개정 결정이고, **§11의 5건은 덕수 승인(2026-08-23)으로 전부 확정**되어 본문에 반영돼 있다.

---

## 1. 실측 결과 요약 (v1 §10 Q1~Q8 응답)

측정 방법: `unified().use(remarkParse).use(remarkMath).use(remarkGfm).use(remarkRehype,{allowDangerousHtml}).use(rehypeRaw).use(rehypeKatex,{strict:false,trust:true,macros})`
— **`EditorPreview`의 플러그인 구성과 옵션을 그대로** 옮기고, 그 앞에 `protectFences → preventSetextHeadings → preprocessLocale → preprocessMath → restoreFences` 사본을 붙였다.
(하니스는 세션 스크래치패드에 `probe61c*.mjs`로 남겼다. §8 스텝 1의 테스트로 승격할 것.)

| # | 답 |
|---|---|
| **Q1** | ✅ **annotation 실재.** `node_modules/rehype-katex/lib/index.js:87`은 `katex.renderToString(value, {...settings, displayMode, throwOnError:true})` — `settings`는 `EditorPreview`가 넘긴 `{strict,trust,macros}`뿐이고 `output`이 없다 → 기본 `htmlAndMathml` → `.katex-mathml > annotation[encoding="application/x-tex"]`. **D1 폴백 재설계 불필요.** |
| **Q2** | ❌ **스큐는 실재하고 흔하다.** 무보정 `buildMathIndex`는 코드펜스(python 검산·`mathory-graph`)·인라인 코드가 있는 메시지에서 **전부** 어긋났다. §2 표 참조. **마스킹을 넣으면** 17개 표본 중 14개가 정확히 일치하고, 남은 3종은 개수 게이트가 잡는다. 인라인 코드 근사는 `` `[^`\n]*` ``가 아니라 **백틱 런 매칭** `` /(`+)(?:[^`]|(?!\1)`)*?\1/g ``를 쓸 것 — 다중 백틱(`` ``a `$x$` b`` ``)에서 근사가 깨진다(실측). |
| **Q3** | ✅ `- **Case 1a.** 본문` → `<li><span class="marker-case-sub"><strong>Case 1a.</strong></span> 본문</li>`. v1 전제 맞음. |
| **Q4** | ✅ **접힘 블록은 `MarkdownEditor` 자체가 언마운트**된다(`EditorView.tsx:912` `{!block.collapsed && …}`) → `editorRefs.current[id] === null`. **추가**: `image`·`svg`·`ggb` 블록은 애초에 `MediaBlockContent`라 ref가 없다 → no-target 분기가 미디어 블록도 덮는다. |
| **Q5** | 브라우저 실측 불가(헤드리스 없음). `onMouseDown`+`preventDefault`는 표준 동작이라 유지하되, **선택 스냅샷을 mousedown에서 떠 두는 방어**(D10′)를 추가한다 — preventDefault가 듣지 않는 환경에서도 동작한다. 터치는 v1대로 후순위. |
| **Q6** | 재량 확정: **ol 번호·중첩 모두 구현**(§6.2). `<ol start>`까지 본다. 20줄이면 되고, 안 하면 AI가 자주 쓰는 번호 목록이 전부 `- `로 뭉개진다. |
| **Q7** | 부여 effect의 deps는 `[processed]`이고 content가 바뀔 때마다 다시 돈다. StrictMode 이중 실행도 **같은 값을 두 번 쓸 뿐**이라 무해. 다만 안전망으로 **`data-math-id`가 없는 `.katex`는 그 요소만 폴백**으로 내린다(게이트와 별개, D1′). |
| **Q8** | 선례 확정 = `AIChipBar`의 비용 확인 팝오버(`CommentPanel.tsx:1338-1344`): `border:1px solid var(--border-primary)` · `background:var(--bg-card)` · `borderRadius:6` · `boxShadow:0 4px 16px rgba(0,0,0,0.12)` · `fontSize:11.5`. 버튼은 취소=아웃라인(`--border-primary`/투명), 실행=`--accent-primary` 채움·흰 글씨·`fontWeight:600`. ⚠ v1이 적은 `--border-light`가 아니다. |

---

## 2. 순서 스큐 실측표 (Q2 근거)

`old` = 무보정 `buildMathIndex(원본)` 개수, `new` = 마스킹 후 개수, `katex` = 실제 렌더된 `.katex` 개수.

| 표본 | katex | old | new | 판정 |
|---|---|---|---|---|
| ```` ```python ```` 펜스 안 `$5 and $10` | 1 | **2** | 1 | 마스킹으로 해결 |
| ```` ```mathory-graph ```` 펜스 안 `"$x$"` | 1 | **2** | 1 | 〃 |
| 인라인 코드 `` `$x$` `` | 1 | **2** | 1 | 〃 |
| 다중 백틱 `` ``a `$x$` b`` `` | 1 | **2** | 1 | 〃(백틱 런 매칭 필요) |
| `~~~` 펜스 | 1 | **2** | 1 | 〃(`~~~`도 마스킹할 것 — `protectFences`는 모른다) |
| 인용문·제목·링크·표·리스트·HTML span 안 수식 | 일치 | 일치 | 일치 | 문제 없음 |
| `$$` 안에 빈 줄 | 2 | 2 | 2 | 문제 없음 |
| 홀수 `$`·통화 `$5 … $10` | 일치 | 일치 | 일치 | remark와 `buildMathIndex`가 **같게** 판정한다 |
| 4칸 들여쓰기 코드블록 | 1 | 2 | **2** | ❌ 게이트가 잡음 |
| 미닫힘 펜스 | 0 | 2 | **2** | ❌ 게이트가 잡음 |
| `$\$5$` (KaTeX 파싱 실패) | 1 + **error 1** | 2 | **2** | ❌ 게이트가 잡음 |

---

## 3. v1 정정 목록 (C1~C18)

| # | v1 서술 | 정정 |
|---|---|---|
| **C1** | Q1 미확인 | ✅ annotation 실재 확정(§1 Q1). §1의 "전제는 절반만 참" 판정도 **그대로 유효**하다 — annotation은 전처리된 TeX가 맞다(실측: `$x^2+1$` → `\displaystyle x^2+1`). |
| **C2** | 스큐를 "위험(3-6)"으로만 표기 | **상수다.** AI 메시지에는 검산 python 부록·`mathory-graph` 펜스·백틱 인용이 일상적이다. 마스킹을 안 넣으면 **1순위 경로가 사실상 죽는다**. `buildRenderedMathIndex`의 마스킹은 선택이 아니라 필수. |
| **C3** | (없음) | **새 스큐 원인: `.katex-error`.** rehype-katex는 파싱 실패 시 `.katex` 클래스가 **없는** `<span class="katex-error">`를 낸다(`lib/index.js:120-129`). 게이트는 `.katex` 개수만이 아니라 **`.katex-error`가 1개라도 있으면 폴백**으로 가야 한다. |
| **C4** | "placeholder 길이 불일치로 오프셋이 움직여도 무방" | 맞지만 **동일 길이 마스킹(공백 채움)** 을 쓸 것. 그러면 `{from,to}`가 원본 오프셋으로 유효해져 `latex` 슬라이스 외에 위치까지 쓸 수 있다(디버깅·향후 재앵커). 비용 0. |
| **C5** | `stripPreviewArtifacts` = 선두 `\displaystyle` + array 언랩 + `\tag*` + `\text{(n)}` | **누락**: `preprocessMath:202-211`이 `\begin{cases}` 안의 `\sum·\int·\prod·\iint·\iiint·\oint·\bigcup·\bigcap` 앞에도 `\displaystyle`을 주입한다(실측 확인). → **`\displaystyle\s+` 전역 제거**로 셋을 한 번에 처리할 것. 사용자가 직접 쓴 `\displaystyle`도 지워지지만 `preprocessMath`가 렌더 시 다시 넣으므로 **표시 차이 0**이다. |
| **C6** | "정확히 `\begin{array}{l}…\end{array}` 래퍼만 언랩" | **그 조건으로는 사용자 array를 오언랩한다**(실측: `$$\n\begin{array}{l}\n1 \\ 2\n\end{array}\n$$` → `1 \\ 2`로 파괴). 판정을 좁힐 것: ① `\begin{array}{l}\n\displaystyle `로 **시작**하고 ② 안쪽에 `\begin{`가 **없어야** 한다. `preprocessMath:189`가 `hasEnvironment`면 래핑을 건너뛰므로 ②는 항상 참이다 — 즉 이 두 조건은 우리 래퍼를 정확히 특징짓는다. |
| **C7** | `.tag-marker` → `` ` \tag{n}` `` (앞 공백 포함) | **앞 공백을 넣지 말 것.** `preprocessLocale:167`의 `\\tag\{(\d+)\}\s*$`는 앞 공백을 소비하지 않아 원문의 공백이 **텍스트 노드로 남는다**(실측: `"x는 1이다 "` + `<span class="tag-marker">(3)</span>`). 넣으면 공백이 둘이 된다. |
| **C8** | 마커 span은 "textContent = 원문" | **절반만 맞다.** `GANA_LITERAL_RE`·`GIYEOK_LITERAL_RE`·`CIRCLED_NUM_LINE_RE`가 전부 `[ \t]*`로 **마커 뒤 공백을 흡수**하고 치환문은 그것을 되돌려 놓지 않는다 → DOM은 `<span>(가)</span>첫 항목`이다. 그대로 직렬화하면 `(가)첫 항목`이 되어 **덕수가 쓰는 표기와 다르다**(렌더 결과는 동일하지만 원문이 낯설어진다). → **마커 span 뒤에 한 칸을 복원**할 것(다음 문자가 공백·개행이 아닐 때만). |
| **C9** | `br` → `\n` | **아무것도 내지 말 것.** mdast→hast의 `break` 핸들러는 `<br>` **뒤에 `"\n"` 텍스트 노드를 함께** 넣는다(실측: `<br>` + `TEXT "\n둘째 줄"`). `\n`을 또 내면 빈 줄이 생긴다. |
| **C10** | 블록 경계 = `p` | **검증 카드는 `p`가 하나도 없다** — 전부 `div`다(`VerifyReportCard.tsx` 전체). `p`만 처리하면 카드 안 드래그가 **한 줄로 뭉친다**. 블록 태그 집합을 두고 `p·h1~h6·blockquote·table·ul·ol` → `\n\n`, `div·li·tr·summary` → `\n`으로 구분할 것. |
| **C11** | "`.comment-body`(또는 카드)" — 둘을 형제로 상정 | **카드는 `.comment-body` 안에 있다**(`CommentPanel.tsx:1683-1691`: `.comment-body > [EditorPreview, VerifyReportCard]`). 따라서 ① D4의 "하나의 댓글 안" 판정은 `.comment-body`로 맞고 ② **개수 게이트의 스코프는 `.comment-body`가 아니라 `.preview-content`**여야 한다(카드 안 `.katex`는 `data-math-id`가 없어 게이트를 오염시킨다). |
| **C12** | 게이트 선례 = "61b D12 `onRunVerify`" | **stale이다.** `ProblemView.tsx:1000`은 `onRunVerify`·`verifyCharCount`를 **넘긴다**(CLAUDE.md의 "칩은 편집창·열람뷰 둘 다에 있다"가 맞고, `CommentPanel.tsx:59-60`의 JSDoc "편집 화면에서만 전달"이 낡았다). 살아 있는 편집창 전용 선례는 **`onInsertGraphBlock` 하나**다. D3의 근거를 그것으로 교체할 것. (부수 작업으로 `onRunVerify` JSDoc도 고치는 것을 권함 — 다음 사람이 또 속는다.) |
| **C13** | `insertText(text, text.length)` 그대로 사용 | ⚠ **`insertText`에는 숨은 동작이 있다**(`MarkdownEditor.tsx:326-345`): 텍스트에 `{}`가 있으면 **커서를 첫 `{}` 안으로 점프**시키고, `{}`가 2개 이상이면 **탭스톱을 무장**해 이후 Tab 키 동작이 바뀐다. 툴바 템플릿 전용 규약이다. AI 대화문에는 `x^{}`·`\left\{\right\}` 같은 것이 실제로 섞인다 → **채팅 삽입에는 쓰면 안 된다.** → D12′(§11-1 확정). |
| **C14** | (없음) | ⚠ **v1이 통째로 놓친 충돌**: `VerifyReportCard`의 `FindingRow`는 **행 전체에 `onClick`**이 걸려 있고(`VerifyReportCard.tsx:208`) 편집창·열람뷰 모두 `onJumpToBlock`을 넘긴다 → **카드 안에서 드래그하면 mouseup에서 점프가 발화**해 탭 전환·블록 펼침·`ref.focus()`까지 일어나고 대화창 선택이 날아간다. 인용(quote)을 뽑는 것이 T6의 핵심 시나리오인데 **바로 그 자리가 막혀 있다**. → D11′로 가드. |
| **C15** | 팝업 토큰 `--border-light` | `--border-primary`(§1 Q8). |
| **C16** | "접힘·전체접기에서 ref가 없을 수 있다" | 확정: **없다**(Q4). 그리고 **미디어 블록(image·svg·ggb)** 도 ref가 없다 — no-target 문구를 "텍스트 블록을 선택하세요"로 할 것. 선례 문구는 OCR의 `alert('먼저 편집할 블록을 선택해 주세요.')`(`EditorView.tsx:2160`). |
| **C17** | (없음) | **복원 불가능한 손실 3종을 명시할 것**: `\ref{n}`→`(n)`(평문, 리터럴 `(3)`과 구별 불가) · `Fig.N`→`[그림N]` · `Table N`→`[표N]`. 셋 다 재렌더해도 같은 결과라 **표시상 무해**하지만, "무손실 복원"이라는 문구를 수식에 한정해 쓸 것. |
| **C18** | 라인 인용 | 정정: EditorPreview 파이프라인 `278-283`·플러그인 `295-308` / `preprocessMath` `178-222` / `data-math-id` `386-392` / `buildMathIndex` `19-72` / 패널 루트 `777-787` / `messagesScrollRef` 선언 `138`·엘리먼트 `895` / `CommentItem` `1529` / `.comment-body` `1683` / `verify` 판정 `1560`·본문 소스식 `1685` / `ProblemView` 마운트 `990`. |

---

## 4. 확정 사실 (v1 3-1~3-18 갱신본, 전부 `4ad2207` 실측)

v1의 3-1·3-2·3-3·3-4·3-5·3-8·3-9·3-10·3-11·3-13·3-14·3-15·3-16·3-17·3-18은 **모두 확인됨**(라인만 C18로 정정).
3-6·3-7·3-12는 위 C2·C3 / C8 / C12로 개정. 아래는 **v2가 새로 확정한 것**.

| # | 사실 | 위치 |
|---|---|---|
| 4-1 | rehype-katex 7.0.1은 `output`을 지정하지 않는다 → annotation 보장 | `node_modules/rehype-katex/lib/index.js:87,108` |
| 4-2 | 파싱 실패 → `.katex` 없는 `<span class="katex-error">` | 〃 `:118-129` |
| 4-3 | 접힘 블록·미디어 블록은 `MarkdownEditor` 미마운트 → ref null | `EditorView.tsx:912, 916-935` |
| 4-4 | `insertText`의 `{}` 탭스톱·커서 점프 | `MarkdownEditor.tsx:323-345` |
| 4-5 | `FindingRow` 행 전체 `onClick` = 점프 | `VerifyReportCard.tsx:206-221` |
| 4-6 | `ProblemView`도 `onRunVerify`를 넘긴다(JSDoc stale) | `ProblemView.tsx:1000` vs `CommentPanel.tsx:59-60` |
| 4-7 | 삽입 → CM dispatch → `handleBlockChange` → `setCurrentBlocks` → `allBlocks` → dirty effect. **CM 히스토리 1스텝**(선택 dispatch는 히스토리에 안 들어간다) → 3-10 성립 | `EditorView.tsx:1524-1527, 1097-1104` |
| 4-8 | 클립보드 선례 = `navigator.clipboard.writeText` + 로컬 state 2초 플래시. **토스트 시스템은 없다** | `ProblemView.tsx:341-352` · `CommentItem`의 `flashStatus` |
| 4-9 | `.comment-body > div`에 `font-size !important`가 걸려 있다 — 팝업을 `.comment-body` 안에 넣지 말 것 | `CommentPanel.tsx:789-793` |
| 4-10 | 패널 루트가 `zIndex:50` 스태킹 컨텍스트를 만든다. 팝업은 `position:fixed`로 두되 **패널 루트의 직계 자식**으로 둘 것(`messagesScrollRef` 안에 두면 `overflowY:auto`가 자른다) | `CommentPanel.tsx:777-787, 895` |

---

## 5. 결정 (D1~D14 — v1 개정본)

| # | 결정 | 변경 |
|---|---|---|
| **D1** | **수식 복원 이중화 + 게이트.** ① 1순위 = `data-math-id` → `buildRenderedMathIndex(source)` 같은 순번 슬라이스. ② 폴백 = annotation + `stripPreviewArtifacts`. **게이트(댓글 단위)**: `.preview-content .katex` 개수 === 인덱스 길이 **AND** `.preview-content .katex-error` 0건 → ①, 아니면 댓글 전체를 ②로. | C2·C3·C11 |
| **D1′** | **요소 단위 안전망**: 게이트를 통과했더라도 그 `.katex`에 `data-math-id`가 없거나 인덱스 범위를 벗어나면 **그 요소만** ②로 내린다. | Q7 |
| **D2** | **소스 대응**: `.comment-body`에 `data-comment-id` 스탬프. 직렬화 시 패널의 comments 상태에서 찾아 **`verify ? extractVerifyReport(content).body : content`**(`CommentPanel.tsx:1685`와 동일식)를 소스로 쓴다. **카드 안 `.katex`는 소스가 없다** — 항상 ② 경로(거기 annotation은 전처리를 안 거친 원본 latex다). | C11 유지 |
| **D3** | **게이트 = `onInsertToEditor` prop 유무**, 선례는 **`onInsertGraphBlock`**(편집창 전용으로 실제 남아 있는 유일한 prop). 단 **팝업 자체는 항상 마운트**하고 `[편집창에 삽입]` 버튼만 prop으로 게이트한다 → 열람뷰에서 `[복사]`가 산다. **(§11-2 확정)** | C12 |
| **D4** | **선택은 단일 `.comment-body` 안으로 제한.** `range.commonAncestorContainer.closest('.comment-body')`가 없으면 팝업 미표시. (카드는 그 안에 있으므로 카드 선택도 통과한다.) | C11 |
| **D5** | **삽입 대상 = `activeBlockId`의 편집기.** ref가 null이면(활성 없음·접힘·미디어 블록) 삽입하지 않고 팝업에 1줄 안내 "텍스트 블록을 먼저 선택하세요". | C16 |
| **D6** | **수식 경계 확장** — Range 양끝이 `.katex` 내부에 걸치면 그 `.katex` 전체를 포함(`node.closest('.katex')`로 판정, `.katex-mathml`·`.katex-html`은 그 하위라 자동 포함). | 유지 |
| **D7** | **구분자 정규화는 삽입 텍스트에만.** `\(…\)`→`$…$`, `\[…\]`→`$$…$$`. `(?<!\\)` 뒤돌아보기 필수(`\\[6pt]` 보호). **`$$` 앞뒤 빈 줄 정규화는 하지 않는다** — `toPersistedBlock` 소유(61a Y1). | 유지 |
| **D8** | **직렬화 규칙표(§6.2)가 범위를 못 박는다.** 표에 없는 요소는 자식 재귀, 잎이면 textContent. 위젯(`GgbGraphView`·`pre`·카드 버튼)은 스킵. | C10으로 표 확장 |
| **D9** | **`selection.toString()` 사용 금지.** 근거를 정정: 1차 이유는 "우리는 평문이 아니라 **마크다운**이 필요하다"이고(마커·강조·수식 복원이 전부 죽는다), MathML 중복은 브라우저별로 갈리는 부차적 이유다. | 근거 정정 |
| **D10** | 팝업 버튼 `onMouseDown={e => e.preventDefault()}`. | 유지 |
| **D10′** | **추가 방어**: 팝업을 띄우는 시점에 Range를 `range.cloneRange()`로 **스냅샷**해 두고, 버튼은 그 스냅샷으로 직렬화한다. preventDefault가 듣지 않는 환경에서도 동작한다. | Q5 |
| **D11′** | **`FindingRow` 점프 가드(신규)**: `onClick` 진입부에서 `const s = window.getSelection(); if (s && !s.isCollapsed && s.toString().trim()) return;` — 드래그로 만든 선택이 있으면 점프하지 않는다. **`VerifyReportCard.tsx` 3줄 변경**이며, 이 Phase가 그 파일을 건드리는 유일한 이유다. | C14 |
| **D12′** | **삽입 API(신규)**: `insertText` 대신 `MarkdownEditorHandle`에 `insertPlainText(text: string)`을 추가한다 — `{from,to}` 선택 대체 + 커서를 `from+text.length`로 + `focus()`. `{}` 탭스톱·커서 점프 없음. 8줄. **(§11-1 확정)** | C13 |
| **D13′** | **직렬화 코어를 `lib/chatExtract.ts`에 전부 넣는다**(v1은 워커를 컴포넌트에 뒀다). 코어는 DOM이 아니라 **미니 노드 트리**(`{tag, cls, text, children, mathId?}`)를 받는다. DOM→미니트리 어댑터(Range 절단 포함)만 컴포넌트에 남는다. 이유: 규칙표가 이 Phase의 회귀 위험 전부인데 v1 구조에서는 **테스트가 닿지 않는다**. | 신규 |
| **D14′** | **테스트는 왕복(round-trip)으로.** `tests/chatExtract.test.mjs`가 실제 `unified` 파이프라인으로 마크다운 → hast를 만들고, hast → 미니트리 → `serializeNodes` → **원본 마크다운과 비교**한다. 규칙표 단위 테스트보다 훨씬 강하다(위 §2·C6~C10이 전부 이 방식으로 잡힌 것들이다). **(§11-3 확정)** | 신규 |

---

## 6. 구현 항목 (개정)

### 6.1 `lib/chatExtract.ts` — 순수 코어 (import 0, DOM 0)

```ts
/* ⚠ 이 파일에 import 문을 두지 말 것 — npm run test:extract가 tsc로 단독 컴파일한다
      (61a lib/sheetImport.ts · 61b lib/verify/* 와 같은 규약).
   ⚠ 그래서 buildMathIndex는 "재사용"이 아니라 이 파일 안에 사본을 둔다.
      lib/mathIndex.ts와 반드시 일치시킬 것(preventSetextHeadings 사본 관례). */

export interface RenderedMath { from: number; to: number; latex: string; display: boolean }

/** 렌더러가 실제로 수식으로 본 것만, 출현 순서로. (§2 실측)
 *  ① ``` 펜스 마스킹 — EditorPreview.protectFences와 동일 정규식
 *  ②  ~~~ 펜스 마스킹 (protectFences는 모르지만 remark는 안다)
 *  ③ 인라인 코드 마스킹 — 백틱 런 매칭 /(`+)(?:[^`]|(?!\1)`)*?\1/g
 *  마스킹은 **동일 길이 공백**으로 → from/to가 원본 오프셋으로 유효하다 (C4) */
export function buildRenderedMathIndex(source: string): RenderedMath[]

/** annotation(②경로) 역변환.
 *  ① array{l} 언랩 — `\begin{array}{l}\n\displaystyle `로 시작 AND 안쪽에 `\begin{` 없음일 때만 (C6)
 *  ② `\displaystyle\s+` **전역** 제거 (인라인·array 각 행·cases 안 \sum 주입까지 한 번에, C5)
 *  ③ `\tag*{(n)}` → `\tag{n}`
 *  ④ `\text{(n)}` → `\ref{n}`  ← 오검 가능(사용자가 직접 쓴 \text{(3)})이라 ②경로가 2순위인 이유 */
export function stripPreviewArtifacts(tex: string): string

/** \(…\)→$…$, \[…\]→$$…$$ — (?<!\\) 뒤돌아보기 필수 (61a C6, `\\[6pt]` 보호) */
export function normalizeMathDelimiters(text: string): string

/** 미니 노드 트리 — DOM에서 어댑터가 만든다 */
export interface SNode {
  tag: string | null;          // null이면 텍스트 노드
  cls: string[];
  text: string | null;         // 텍스트 노드의 (범위 절단된) 값
  children: SNode[];
  math?: { latex: string; display: boolean } | null;  // .katex일 때 어댑터가 채워 준다
}
export function serializeNodes(nodes: SNode[]): string
```

### 6.2 직렬화 규칙표 (D8 개정)

| DOM | 출력 |
|---|---|
| 텍스트 노드 | 그대로(범위 절단 반영). `\n`도 그대로 — 소프트 브레이크가 원문 개행이다 |
| `.katex` | `math.latex`. `display`면 앞뒤 `\n\n`. **서브트리 스킵**(`.katex-mathml`·`.katex-html` 중복 방지) |
| `.katex-error` | textContent(원문 수식 소스가 그대로 들어 있다) |
| `.tag-marker` | `\tag{n}` — **앞 공백 없이**(C7). 서브트리 스킵 |
| `.marker-case-sub` | `**` + textContent + `**`. 서브트리 스킵(내부 `<strong>` 중복 방지) |
| `.marker-gana`·`.marker-giyeok`·`.marker-circled` | textContent + **다음 문자가 공백/개행이 아니면 한 칸**(C8). 서브트리 스킵 |
| `strong`·`b` / `em`·`i` | `**…**` / `*…*` |
| `del` | `~~…~~` |
| `code`(인라인, `pre` 밖) | `` `…` `` |
| `a[href]` | `[텍스트](href)` |
| `img` | `alt`가 있으면 alt(twemoji), `src`가 있고 alt가 없으면 `![](src)` |
| `br` | **아무것도 내지 않는다**(C9) |
| `p`·`h1~h6`·`blockquote`·`ul`·`ol`·`table` | 블록: 앞뒤 `\n\n`. `h*`는 `#`×level 접두, `blockquote`는 각 행 `> ` 접두 |
| `li` | 부모가 `ol`이면 `{start+i}. `, `ul`이면 `- `. 중첩 깊이×2칸 들여쓰기. 뒤에 `\n` |
| `div`·`tr`·`summary` | 줄 경계: `\n` (검증 카드가 전부 div다 — C10) |
| `table` **전체**가 범위 안 | GFM 표로 복원(헤더 + `---` 구분행). 일부만 걸치면 셀 텍스트를 ` `로 이음 |
| `pre`·`.ggb-*`(그래프 위젯)·`button`·`select`·`input` | 스킵 |
| 그 밖 | 자식 재귀 → 잎이면 textContent |

마무리: 앞뒤 `trim`, `\n{3,}` → `\n\n`, `normalizeMathDelimiters` 적용(D7). 빈 결과면 `null`.

### 6.3 팝업 — `components/comment/SelectionInsertPopup.tsx`

- **패널 루트의 직계 자식**으로 마운트(`messagesScrollRef` 안이 아니다 — 4-10). `position: fixed` + `getClientRects()` 마지막 rect 기준 좌표, `zIndex: 60`.
- 트리거: `document`의 `selectionchange`(rAF 디바운스) + `pointerup`. 조건 = 비어 있지 않은 Range **AND** `.comment-body` 하나 안(D4). `messagesScrollRef`의 `scroll`·패널 리사이즈·`selectionchange`로 접힘 시 숨김.
- 버튼: **[편집창에 삽입]**(`onInsertToEditor`가 있을 때만 — §11-2) · **[복사]**. 스타일은 §1 Q8 토큰. 다크 토큰 없음.
- **[복사]는 마크다운 1종**(§11-5): `navigator.clipboard.writeText(serialized)`. `try/catch` + 실패 시 `console.error`는 4-8 선례 그대로. `text/html` 동시 적재는 하지 않는다.
- 피드백: 토스트가 없으므로 **버튼 라벨을 2초간 "삽입됨"/"복사됨"으로 교체**(4-8 선례). no-target이면 팝업 안 1줄 안내(D5).
- D10 + D10′(Range 스냅샷).
- ⚠ **`scrollIntoView` 금지**(CLAUDE.md) — 좌표는 rect 계산으로만.

### 6.4 배선

- `CommentPanelProps`에 `onInsertToEditor?: (text: string) => 'inserted' | 'no-target'`.
  주석은 **`onInsertGraphBlock` 선례**를 인용할 것(`onRunVerify`는 이제 열람뷰에도 간다 — C12).
- `CommentItem`의 `.comment-body` div에 `data-comment-id={comment.id}`(D2).
- `MarkdownEditorHandle`에 `insertPlainText`(D12′ · §11-1):

```ts
// components/editor/MarkdownEditor.tsx — useImperativeHandle 안, insertText 바로 아래
/** 채팅→편집창 삽입 전용(Phase 61c). `insertText`와 달리 `{}` 탭스톱·커서 점프가 없다 —
 *  그쪽은 툴바 템플릿 규약이고 AI 대화문에는 `x^{}` 같은 것이 실제로 섞인다. */
insertPlainText(text: string) {
  const view = viewRef.current;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text } });   // 히스토리 1스텝
  view.dispatch({ selection: { anchor: from + text.length } });
  view.focus();
},
```

- `VerifyReportCard.FindingRow`에 선택 가드(D11′) — **이 Phase가 이 파일을 건드리는 유일한 이유**:

```ts
// VerifyReportCard.tsx:208 onClick 진입부
onClick={canJump ? (() => {
  /* Phase 61c: 카드 안에서 드래그로 인용을 뽑는 중이면 점프하지 않는다.
     행 전체에 onClick이 걸려 있어 mouseup이 곧 점프였고, 탭 전환·ref.focus()가
     대화창 선택을 통째로 날렸다. */
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) return;
  onJumpToBlock!(finding.blockKey!, finding.quote);
}) : undefined}
```
- `EditorView`:

```ts
const handleInsertFromChat = useCallback((text: string) => {
  const ref = activeBlockId ? editorRefs.current[activeBlockId] : null;
  if (!ref) return 'no-target' as const;      // 활성 없음 · 접힘 · 미디어 블록 (4-3)
  ref.insertPlainText(text);                  // → onChange → dirty → CM undo 1스텝 (4-7)
  return 'inserted' as const;
}, [activeBlockId]);
```

- `package.json`:

```jsonc
// scripts — test:verify의 다중 파일 선례를 그대로 따른다
"test:extract": "tsc lib/chatExtract.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/chatExtract.test.mjs",

// devDependencies — 현재 전이 의존으로만 설치돼 있다. 왕복 테스트가 직접 import하므로
// 명시할 것(설치된 실물 버전 그대로: 새로 받는 것이 없다). §11-3 확정
"unified": "^11.0.5", "remark-parse": "^11.0.0", "remark-rehype": "^11.1.2"
```

### 6.5 표 직렬화 상세 (§11-4 확정)

`<table>` **전체**가 선택 범위 안일 때만 GFM으로 복원한다. 판정은 `range.containsNode(tableEl, false)`.

```
| 헤더1 | 헤더2 |
| --- | --- |
| 셀 | 셀 |
```

- 셀 내용은 같은 규칙표로 재귀 직렬화한다(셀 안 수식·강조도 복원된다).
- 셀 안의 `|`는 `\|`로 이스케이프하고, 셀 안 개행은 공백으로 접는다 — GFM 표는 한 줄이 한 행이다.
- `thead`가 없으면 첫 `tr`을 헤더로 쓴다(`remarkGfm`이 만드는 표에는 항상 `thead`가 있다).
- 정렬(`th[style="text-align:…"]`)은 무시한다 — `EditorPreview`의 `th`/`td` 컴포넌트가 `style`을 통과시키지만
  구분행의 `:---:` 표기까지 복원할 실익이 없다(수용 손실, §7에 추가).
- **일부만 걸치면** 표 문법을 만들지 않고 셀 텍스트를 공백으로 잇는다 — 반쪽짜리 `|` 행을 편집창에 꽂으면
  `remarkGfm`이 표로 보지 않아 파이프가 그대로 보인다.

---

---

## 7. 수용 손실 (문서화 필수)

| 손실 | 이유 | 영향 |
|---|---|---|
| `\ref{n}` → `(n)` | `preprocessLocale:164`가 평문으로 치환. 리터럴 `(3)`과 구별 불가 | 재렌더 결과 동일 |
| `Fig.N`→`[그림N]` · `Table N`→`[표N]` | 〃 `:158,161` | 〃 |
| 사용자가 직접 쓴 `\displaystyle` 소실(②경로) | `\displaystyle\s+` 전역 제거(C5) | `preprocessMath`가 재주입 → 표시 동일 |
| `\\[6pt]` 뒤 공백 → 개행(②경로) | array 언랩의 부산물(실측) | LaTeX 의미 동일 |
| 표 정렬 표기(`:---:`) | GFM 구분행의 정렬 기호를 복원하지 않는다(§6.5) | 표는 그대로, 정렬만 기본값 |
| 마커 뒤 공백 정확도 | 원문이 2칸이었어도 1칸으로 복원(C8) | 렌더 동일(CSS 고정폭) |
| `\[…\]`/`$$…$$` display 여부(②경로) | `.katex-display` 조상으로만 판정 | 한 줄 `$$x$$`은 원래도 인라인 렌더다(CLAUDE.md) |

---

## 8. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 0 | ~~전제 실측~~ **완료**(§1·§2). 스크래치패드의 `probe61c*.mjs`를 `tests/`로 승격 | — |
| 1 | `lib/chatExtract.ts` + `tests/chatExtract.test.mjs` + `npm run test:extract` | §2 표본 17종 + §6.2 규칙표 왕복 테스트 통과 |
| 2 | 팝업 + DOM→미니트리 어댑터 — **[복사]만 먼저** | 실 대화(수식·마커·리스트·표·검증 카드)에서 복사 결과를 편집창에 붙여넣어 원문 규약대로 렌더. **유일한 중간 관문: 덕수 실물 검수** |
| 3 | `insertPlainText`(D12′) + `onInsertToEditor` 배선 + [편집창에 삽입] | 드래그 → 삽입 → 커서 위치·dirty·undo 1회. no-target 안내 |
| 4 | `FindingRow` 가드(D11′) · 경계 확장(D6) 엣지 · `onRunVerify` JSDoc 정정 · roadmap·CLAUDE.md 갱신 | §9 체크리스트 통과 |

---

## 9. 검증 체크리스트 (v1 T1~T10 + 신규)

T1 인라인 수식만 선택 → `$…$` 원문(displaystyle 흔적 0) ·
T2 다행 display → `$$…\\…$$` 원문(array{l} 흔적 0) ·
T3 수식 중간 드래그 → 수식 통째(D6) ·
T4 `\tag{n}`·(가)·ㄱ.·①·`**Case na.**` 역변환(**마커 뒤 한 칸 확인**) ·
T5 코드펜스·인라인 코드 `$` 메시지 → 오염 0(마스킹으로 **1순위 유지**되는지 확인. 폴백으로 떨어지면 마스킹 버그) ·
T6 검증 카드 인용 선택 → `$` 규약 복원 ·
**T6′ 검증 카드 안에서 드래그해도 점프가 발화하지 않는다(D11′)** ·
T7 삽입 후 undo 1회 복원, dirty·자동저장 정상 ·
**T7′ `x^{}`처럼 `{}` 든 텍스트를 삽입해도 커서가 튀지 않고 Tab 동작이 그대로다(D12′)** ·
T8 전체접기·활성 없음·**미디어 블록** → no-target 안내 ·
T9 여러 댓글에 걸친 선택 → 팝업 미표시 ·
T10 ProblemView(열람) → [복사]만 보이고 [편집창에 삽입] 없음(§11-2) ·
**T11 4칸 들여쓰기 코드블록·미닫힘 펜스·`$\$5$` 메시지 → 게이트가 폴백으로 내리고 결과가 멀쩡하다** ·
**T12 표를 통째로 선택 → GFM 표로, 일부만 선택 → 셀 텍스트로**.

---

## 10. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · `EditorPreview` · 인쇄 · 공개 뷰어 · discuss/proofread/verify 라우트·프롬프트. **전부 0건.**

변경 총량: 신규 2(`lib/chatExtract.ts`·`components/comment/SelectionInsertPopup.tsx`) + 테스트 1 +
`CommentPanel`(prop 1·스탬프 1·마운트 1·JSDoc 1) + `EditorView`(콜백 1) +
`MarkdownEditor`(핸들 1) + `VerifyReportCard`(가드 3줄) + `package.json`(스크립트 1·devDep 3).
v1 대비 **`MarkdownEditor`·`VerifyReportCard` 2파일이 늘었다** — 둘 다 v1이 놓친 충돌(C13·C14) 때문이다.

**ProblemView 변경 0건**(§11-2가 팝업을 항상 마운트하고 버튼만 게이트하므로 그 파일을 열 이유가 없다).
`npm install`로 새로 받는 패키지도 0개다(§11-3의 devDep 3종은 이미 전이 의존으로 설치돼 있고, 버전을
명시만 한다). Firestore 규칙 0 · 마이그레이션 0 · 서버 0.

---

## 11. 확정 결정 (덕수 승인 2026-08-23 — 5건 전부 추천안 채택)

| # | 사항 | **확정** | 근거 · 반영 위치 |
|---|---|---|---|
| **11-1** | 삽입 API | **`insertPlainText` 신설**(8줄). 기존 `insertText`는 툴바 전용으로 그대로 둔다 | `{}` 탭스톱은 툴바 템플릿 전용 규약인데 AI 대화문에는 `x^{}`·`\left\{\right\}`가 실제로 섞인다 — 조용히 커서가 튀고 Tab이 이상해지는 종류의 버그다. → C13 · D12′ · §6.4 |
| **11-2** | 열람뷰(ProblemView) | **팝업은 항상 마운트, `[편집창에 삽입]` 버튼만 `onInsertToEditor` 게이트** | 61b가 "검증 칩은 편집창 전용"으로 시작했다가 실사용에서 곧바로 어긋나 둘 다에 넣은 전례가 있다. `[복사]`는 열람뷰에서도 명백히 쓸모 있고 **ProblemView 변경은 0**이다. → D3 · §6.3 · T10 |
| **11-3** | 테스트 하니스 | **실 파이프라인 왕복 테스트** + devDep 3개 명시(`unified`·`remark-parse`·`remark-rehype`) | 이 v2가 잡아낸 정정 C2·C6·C8·C9는 **전부 왕복 실측으로만 드러났고** 규칙표를 눈으로 읽어서는 하나도 안 보였다. 셋 다 이미 전이 의존으로 설치돼 있어 실질 설치 비용 0. → D14′ · §6.4 · §8 스텝 1 |
| **11-4** | 표(table) 직렬화 | **GFM 표로 복원**(전체가 범위 안일 때). 일부만 걸치면 셀 텍스트를 공백으로 이음 | AI가 표를 자주 쓰고, 깨진 표를 편집창에 붙이면 손으로 고치는 비용이 더 크다. 20줄. → §6.2 표 항목 · §6.5 · T12 |
| **11-5** | `[복사]` 형식 | **마크다운 1종**(`navigator.clipboard.writeText`) | 목적지가 Mathory 편집창이다. 리치텍스트(`text/html` 동시 적재)는 외부 앱용인데 이 Phase의 용도가 아니다. → §6.3 |

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 초안 — §1 전제 재판정 · 사실표 3-1~3-18 · D1~D10 · 검증 요청 Q1~Q8 |
| **v2 확정판** | **CLI** | **실측 교차검토 — Q1~Q8 응답 · 정정 C1~C18 · 결정 D1~D14 개정 · 수용 손실표 · 확정 결정 §11-1~5(덕수 승인) · 구현 스니펫** |
| v3 | web | 재검증·판정 (예정) |

*v2 확정판 — 실측은 설치된 node_modules로 실제 파이프라인을 돌려 얻었다. 사실 분쟁 시 `probe61c*.mjs`(세션 스크래치패드)를 재실행해 대조할 것.
미결 0건이므로 v3(web 재검증)을 기다리지 않고 §8 스텝 1부터 착수할 수 있다.*
