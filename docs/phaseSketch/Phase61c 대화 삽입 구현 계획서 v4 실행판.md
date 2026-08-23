# Phase 61c 구현 계획서 — 대화 → 편집창 삽입 (v4 실행판)

> 대상: 구현자(CLI Claude) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **C축**
> 계보: v1(web) → v2 확정판(CLI 실측) → v3 최종(web 재검증) → **v4 실행판(CLI, 2026-08-23)**
> 진실 원천: mathory **origin/main `4ad2207`** · 실측은 설치된 `node_modules`로 **실제 remark/rehype 파이프라인을 구동**해 얻었다.
> **이 문서 하나가 구현 기준이다** — v1~v3을 함께 펼칠 필요 없다(근거가 필요할 때만 참조).
> 미결 0건 · 신규 설치 0건 · 착수 가능. 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

agent 대화창(메시지 본문·검증 리포트 카드)에서 영역을 드래그하면 미니 팝업([편집창에 삽입] · [복사])이 뜨고,
선택 영역을 **Mathory 표기 규약의 마크다운으로 직렬화**(렌더된 수식 → 원본 `$…$` 복원)해 활성 블록의 커서 위치에 꽂는다.
**서버 0 · Firestore 0 · 전처리 파이프라인 무변경 · ProblemView 무변경 · npm install 신규 0.**

---

## 1. v3 판정 (W1~W3 · D13′)

| # | v3 주장 | v4 판정 |
|---|---|---|
| **W1** | `Range.containsNode`는 존재하지 않는다(v2 §6.5가 잘못 썼다) | ✅ **채택.** `containsNode(node, allowPartial)`는 `Selection`의 메서드이고 `Range`에는 없다. v2 코드 그대로면 표 직렬화가 첫 실행에서 TypeError로 죽는다. 다만 v3이 제시한 `compareBoundaryPoints` 판정은 **방향을 거꾸로 쓰기 쉬운 API**다 → §4.5에서 `comparePoint` 기반으로 교체(등가, 훨씬 덜 헷갈린다) |
| **W2** | `.katex-error`는 구분자 없는 **원시** 수식 소스를 담으므로, `el.closest('.math-display')`로 display를 판정해 `$$…$$`/`$…$`로 감싼다 | ⚠️ **관찰은 옳고 처방은 둘 다 틀렸다(실측 반증).** ⓐ `.math-display` 요소는 rehype-katex가 **splice로 제거**한다(`lib/index.js`의 `parent.children.splice(index,1,...result)`) → `closest('.math-display')`는 **어느 경우에도 걸리지 않는다**(실측: 인라인 에러의 조상은 `p`, display 에러의 조상은 **없음**). ⓑ 에러 span의 텍스트는 원시 소스가 아니라 **전처리된 TeX**다(실측: `$\$5$` → `"\displaystyle \\"`) → 그대로 넣으면 §2가 경계한 `\displaystyle` 오염이 그대로 들어간다. → **§2-1의 훨씬 나은 해법으로 교체한다.** |
| **W3** | 왕복 테스트는 DOM 어댑터를 커버하지 못한다 | ✅ **채택**(한계 문서화 + 스텝 2 실물 검수가 정탐). 덧붙여 §2-1이 어댑터에서 `data-math-id` 조회를 **없애** 어댑터 표면적이 줄었다 |
| **D13′** | `chatExtract.ts`는 import 0 + `buildMathIndex` 사본 | ⚠️ **import 0은 채택, '사본'은 아니다.** 구현 중 실측으로 remark-math와의 이스케이프 규칙 차이가 드러나 별도 판본(`scanRenderedMath`)이 됐다 — §2-1′ |
| D12′ 부기 | `changes`+`selection`을 한 dispatch로 합쳐도 된다 | ✅ 맞다(CM6은 `selection`을 changes 적용 **후** 문서 기준으로 해석한다). §4.4에서 한 dispatch로 확정 |
| D11′ 부기 | 다른 곳 선택이 남아 클릭이 오차단되는 엣지는 mousedown이 선택을 먼저 없애 자연 해소 | ✅ 맞다. 가드는 단순 유지 |

**v3의 나머지(C1~C18 전건 수용, devDep 버전 확인, §4~§7)는 그대로 유효하다.**

---

## 2. v4가 바꾸는 것 — `.katex-error`는 "폴백 트리거"가 아니라 "인덱스 소비자"다

### 2-1. 핵심 정정 (v2 C3 · D1 · v3 W2를 함께 대체)

v2는 "`.katex-error`가 1건이라도 있으면 댓글 전체를 폴백(annotation)으로" 했고, v3은 그 폴백 안에서 에러 span을 어떻게 감쌀지 고민했다. **둘 다 필요 없다.**

실패한 수식도 **소스 인덱스를 정확히 한 칸 소비한다**. 그러니 `.katex`만 세지 말고 **`.katex`와 `.katex-error`를 문서 순서로 함께** 세면 대응이 그대로 유지되고, 실패한 수식조차 **원본 슬라이스(구분자 포함)** 로 복원된다.

실측(5/5 일치):

| 표본 | hosts | index | [0] | [1] | [2] |
|---|---|---|---|---|---|
| `값 $a=1$ 과 $$\nb=2\n$$ 끝` | 2 | 2 | katex→`$a=1$` | katex→`$$\nb=2\n$$` | |
| `$\frac{1}{$ 는 깨진 수식` | 1 | 1 | **error**→`$\frac{1}{$` | | |
| `$a=1$ 그리고 $\frac{1}{$ 그리고 $c=3$.` | 3 | 3 | katex→`$a=1$` | **error**→`$\frac{1}{$` | katex→`$c=3$` |
| `$$\n\begin{foo}…\end{foo}\n$$` + `$y=2$` | 2 | 2 | **error**→`$$\n\begin{foo}…$$` | katex→`$y=2$` | |
| 에러 2연속 + 정상 1 | 3 | 3 | error | error | katex |

### 2-1′. 구현 중 발견 — 개수가 맞아도 **대응이 틀릴 수 있다** (`\$` 이스케이프)

스텝 1 왕복 테스트가 잡은 것. `가격 $\$5$ 그리고 $b=2$.`에서 개수는 2:2로 맞았지만 **짝이 어긋나** 있었다.
원인은 `lib/mathIndex.ts`의 `buildMathIndex`와 remark-math가 **이스케이프를 반대로 본다**는 것이다:

| | 수식 **밖**의 `\$` | 수식 **안**의 `\$` |
|---|---|---|
| `lib/mathIndex.ts` | 여는 구분자로 본다 | 건너뛴다(`content[j-1] !== '\\'`) |
| **remark-math(실물)** | **마크다운 문자 이스케이프**라 수식을 못 연다 | **수식을 닫는다**(math-text는 코드 스팬 규칙이라 백슬래시를 안 본다) |

→ `lib/chatExtract.ts`의 스캐너는 **사본이 아니라** remark 규칙을 모사한 별도 판본(`scanRenderedMath`)이다.
수식 밖에서는 `\X`를 두 글자씩 건너뛰고(`\\[6pt]`가 `\[`로 오인되는 것도 여기서 함께 막힌다), 수식 안에서는
이스케이프를 보지 않는다. `\[`·`\(`만 예외다 — `preprocessMath`가 remark보다 먼저 `$$…$$`/`$…$`로 바꾼다.

⚠ **교훈**: 개수 게이트는 필요조건이지 충분조건이 아니다. 스캐너가 렌더러의 토큰화를 모사하지 못하면
게이트를 통과하면서 내용이 뒤바뀐다 — 가장 나쁜 실패 형태다. 그래서 왕복 테스트(내용 비교)가 필요했다.

⚠ `lib/mathIndex.ts`에도 같은 어긋남이 남아 있다(편집창↔미리보기 하이라이트가 `\$` 든 수식에서 밀린다).
   **이 Phase의 범위가 아니라 손대지 않았다** — 별건으로 다룰 것.

### 2-2. 그래서 `data-math-id`를 쓰지 않는다

`EditorPreview:386-392`의 부여 effect는 `querySelectorAll('.katex')`만 훑으므로 **에러 span을 건너뛴 번호**를 매긴다 → 에러가 하나라도 있으면 `data-math-id`와 소스 순번이 어긋난다.
대신 팝업이 **직접** `preview.querySelectorAll('.katex, .katex-error')`로 호스트 목록을 만든다(`querySelectorAll`은 문서 순서를 보장한다).

부수 효과 — v2의 걱정 두 개가 **사라진다**:
- **D1′(부여 effect 미완료 시 폴백) 불필요** — 우리가 그 자리에서 세므로 effect 타이밍과 무관하다. Q7(StrictMode) 쟁점 소멸.
- **C3(에러 = 폴백 트리거) 폐기** — 에러는 이제 정상 참가자다.

⚠ **`data-math-id`를 지우지는 말 것** — Phase 56의 편집창↔미리보기 하이라이트가 쓰는 기존 자산이다. 이 Phase가 **안 쓸 뿐**이다.

### 2-3. 게이트 최종형

```
hosts = preview.querySelectorAll('.katex, .katex-error')      // preview = 그 댓글의 .preview-content
index = buildRenderedMathIndex(source)                        // source = D2의 소스식
게이트 통과 ⇔ hosts.length === index.length
  통과 → ① 슬라이스 경로: hosts[i] ↔ index[i].latex (구분자 포함 원문 그대로)
  실패 → ② 폴백 경로: 그 댓글의 모든 수식을 annotation/textContent + stripPreviewArtifacts로
```

게이트가 실패하는 경우는 실측 3종뿐이다: **4칸 들여쓰기 코드블록 · 미닫힘 코드펜스 · (마스킹이 못 잡는 그 밖의 코드 구간)**. 흔한 원인이던 ```` ``` ```` 펜스·인라인 코드·`~~~`·KaTeX 파싱 실패는 전부 ①에서 처리된다.

### 2-4. 폴백(②) 경로의 에러 span 처리

폴백에서는 소스 대응이 없으므로 최선을 다한다:

| 대상 | 처리 |
|---|---|
| `.katex` | `annotation` → `stripPreviewArtifacts` → `.katex-display` 조상이면 `$$\n…\n$$`, 아니면 `$…$` |
| `.katex-error` (`.preview-content` 안) | `textContent` → **`stripPreviewArtifacts` 필수**(전처리된 TeX다) → 개행이 있으면 `$$\n…\n$$`, 없으면 `$…$` |
| `.katex` · `.katex-error` (검증 카드 안) | 카드는 전처리를 거치지 않는다 → annotation/textContent 그대로, **항상 `$…$`**(카드는 전부 `displayMode:false`로 그린다) |

⚠ 폴백에서 display 판정을 **조상 클래스로 하지 말 것**(W2 반증). `.katex`는 `.katex-display` 조상이 실재하지만(실측 확인), **에러 span에는 조상 단서가 없다** — 개행 유무가 유일하게 남은 신호다. 수용 손실로 §5에 적는다.

---

## 3. 결정 최종표

| # | 결정 |
|---|---|
| **D1** | **수식 복원 이중화 + 개수 게이트.** ① 슬라이스(1순위) / ② annotation·textContent 역변환(폴백). 게이트는 §2-3. **조용한 오염 금지** — 게이트 실패면 그 댓글 전체를 ②로 |
| ~~D1′~~ | **폐기** — §2-2(우리가 직접 세므로 effect 타이밍 무관) |
| **D2** | **소스 대응**: `CommentItem`의 `.comment-body`에 `data-comment-id`. 직렬화 시 패널 comments 상태에서 찾아 **`verify ? extractVerifyReport(content).body : content`**(`CommentPanel.tsx:1685`와 동일식)를 소스로. 검증 카드 안 선택은 소스가 없으므로 항상 ② |
| **D3 · 11-2** | **팝업은 항상 마운트**, `[편집창에 삽입]` 버튼만 `onInsertToEditor` prop 게이트 → 열람뷰에서 `[복사]`가 산다. 선례 인용은 **`onInsertGraphBlock`**(`onRunVerify`는 열람뷰에도 간다 — JSDoc이 낡았다) |
| **D4** | 선택은 **단일 `.comment-body`** 안으로 제한. 아니면 팝업 미표시 |
| **D5** | 삽입 대상 = `activeBlockId`의 편집기. ref가 null이면(활성 없음·접힘·**미디어 블록**) 삽입하지 않고 팝업에 1줄 안내 "텍스트 블록을 먼저 선택하세요" |
| **D6** | **수식 경계 확장**: Range 양끝이 `node.closest('.katex, .katex-error')` 안이면 그 호스트 전체를 포함. 수식은 자르지 않는다 |
| **D7** | **구분자 정규화는 삽입 텍스트에만**: `\(…\)`→`$…$`, `\[…\]`→`$$…$$`. `(?<!\\)` 뒤돌아보기 필수(`\\[6pt]` 보호). **`$$` 앞뒤 빈 줄 정규화 금지** — `toPersistedBlock` 소유(61a Y1) |
| **D8** | 직렬화 규칙표(§4.2)가 범위를 못 박는다. 표에 없는 요소는 자식 재귀, 잎이면 textContent. 위젯은 스킵 |
| **D9** | **`selection.toString()` 금지.** 1차 근거: 우리는 평문이 아니라 **마크다운**이 필요하다(마커·강조·수식 복원이 전부 죽는다) |
| **D10 · D10′** | 팝업 버튼 `onMouseDown`에서 `preventDefault` + 팝업을 띄운 시점의 **Range 스냅샷**(`cloneRange()`)으로 직렬화 |
| **D11′** | **`FindingRow` 점프 가드** — 드래그 선택이 살아 있으면 점프하지 않는다(§4.4). 이 Phase가 `VerifyReportCard.tsx`를 건드리는 유일한 이유 |
| **D12′ · 11-1** | **`insertPlainText` 신설**. `insertText`는 툴바 전용으로 존치(`{}` 탭스톱·커서 점프 규약) |
| **D13′** | 코어는 **미니 노드 트리**를 받는다. `lib/chatExtract.ts`는 **import 0**. 수식 스캐너는 사본이 아니라 remark 규칙을 모사한 별도 판본(§2-1′) |
| **D14′ · 11-3** | **실 파이프라인 왕복 테스트** + devDep 3종 명시. 한계(W3)는 §4.6에 문서화 |
| **11-4** | 표는 **전체가 범위 안일 때만** GFM으로 복원(§4.5) |
| **11-5** | `[복사]` = **마크다운 1종** |

---

## 4. 구현 항목

### 4.1 `lib/chatExtract.ts` — 순수 코어 (import 0 · DOM 0)

```ts
/* ⚠ 이 파일에 import 문을 두지 말 것 — npm run test:extract가 tsc로 단독 컴파일한다
      (61a lib/sheetImport.ts · 61b lib/verify/* 와 같은 규약).
   ⚠ 수식 스캐너는 lib/mathIndex.ts의 **사본이 아니다** — remark-math의 토큰화를 모사하도록
      두 곳을 의도적으로 바꿨다(§2-1′). 저쪽을 베껴 오지 말 것. */

export interface RenderedMath { from: number; to: number; latex: string }

/** 렌더러가 실제로 수식으로 본 것만, 출현 순서로.
 *  ① ``` 펜스 마스킹 — EditorPreview.protectFences와 동일 정규식
 *  ② ~~~ 펜스 마스킹 — protectFences는 모르지만 remark는 안다
 *  ③ 인라인 코드 마스킹 — 백틱 런 매칭 /(`+)(?:[^`]|(?!\1)`)*?\1/g
 *     ⚠ `[^`\n]*` 근사는 다중 백틱(``a `$x$` b``)에서 깨진다(실측)
 *  마스킹은 **동일 길이 공백**으로 → from/to가 원본 오프셋으로 유효하다 */
export function buildRenderedMathIndex(source: string): RenderedMath[]

/** ②경로 역변환.
 *  ① array{l} 언랩 — `\begin{array}{l}\n\displaystyle `로 시작 AND 안쪽에 `\begin{` 없음일 때만
 *     (preprocessMath:189가 hasEnvironment면 래핑을 건너뛰므로 이 두 조건이 우리 래퍼를 특징짓는다)
 *  ② `\displaystyle\s+` **전역** 제거 — 인라인 주입·array 각 행·cases 안 \sum 주입을 한 번에
 *  ③ `\tag*{(n)}` → `\tag{n}`
 *  ④ `\text{(n)}` → `\ref{n}`  ← 오검 가능(사용자가 직접 쓴 \text{(3)})이라 ②가 2순위인 이유 */
export function stripPreviewArtifacts(tex: string): string

/** \(…\)→$…$, \[…\]→$$…$$ — (?<!\\) 뒤돌아보기 필수(61a C6) */
export function normalizeMathDelimiters(text: string): string

/** 미니 노드 트리 — DOM 어댑터가 만든다(테스트는 hast에서 만든다) */
export interface SNode {
  tag: string | null;             // null이면 텍스트 노드
  cls: string[];
  text: string | null;            // 텍스트 노드의 (범위 절단된) 값
  attrs?: Record<string, string>; // href·alt·start 등 필요한 것만
  children: SNode[];
  /** 수식 호스트일 때 어댑터가 채워 준다(슬라이스 또는 역변환 결과, 구분자 포함) */
  math?: { latex: string; display: boolean } | null;
}
export function serializeNodes(nodes: SNode[]): string
```

### 4.2 직렬화 규칙표 (D8)

| DOM | 출력 |
|---|---|
| 텍스트 노드 | 그대로(범위 절단 반영). `\n`도 그대로 — 소프트 브레이크가 원문 개행이다. **살아남은 `$`는 리터럴 달러이므로 `\$`로 이스케이프**한다(수식은 전부 math 호스트로 빠지므로 텍스트에 남은 `$`는 수식 구분자가 아니다 — 그대로 두면 편집창에서 다시 수식으로 읽힌다) |
| `.katex` · `.katex-error` | `math.latex`. `display`면 앞뒤 `\n\n`. **서브트리 스킵**(`.katex-mathml`·`.katex-html` 중복 방지) |
| `.tag-marker` | `\tag{n}` — **앞 공백 없이**(원문 공백은 앞 텍스트 노드에 살아 있다). 서브트리 스킵 |
| `.marker-case-sub` | `**` + textContent + `**`. 서브트리 스킵(내부 `<strong>` 중복 방지) |
| `.marker-gana`·`.marker-giyeok`·`.marker-circled` | textContent + **다음 문자가 공백/개행이 아니면 한 칸**(전처리 정규식이 마커 뒤 공백을 흡수했다). 서브트리 스킵 |
| `strong`·`b` / `em`·`i` | `**…**` / `*…*` |
| `del` | `~~…~~` |
| `code`(인라인, `pre` 밖) | `` `…` `` |
| `a[href]` | `[텍스트](href)` |
| `img` | `alt`가 있으면 alt(twemoji), 없고 `src`가 있으면 `![](src)` |
| `br` | hard break 표식 **두 칸만** 낸다 — 개행은 hast의 `break` 핸들러가 `<br>` 뒤에 붙이는 `"\n"` 텍스트 노드가 공급한다(실측). 뒤가 개행이 아니면(raw HTML의 맨 `<br>`) 개행까지 직접 넣는다 |
| `p`·`h1~h6`·`blockquote`·`ul`·`ol`·`table` | 블록: 앞뒤 `\n\n`. `h*`는 `#`×level 접두, `blockquote`는 각 행 `> ` 접두 |
| `li` | 부모가 `ol`이면 `{start+i}. `, `ul`이면 `- `. 중첩 깊이×2칸 들여쓰기. 뒤에 `\n` |
| `div`·`tr`·`summary` | 줄 경계: `\n` — **검증 카드는 `<p>`가 0건이고 전부 `div`다** |
| `table` 전체가 범위 안 | GFM 표로 복원(§4.5) |
| `pre`·그래프 위젯·`button`·`select`·`input` | 스킵 |
| 그 밖 | 자식 재귀 → 잎이면 textContent |

마무리: 앞뒤 `trim` → `\n{3,}`을 `\n\n`으로 → `normalizeMathDelimiters`(D7). 빈 결과면 `null`.

### 4.3 팝업 — `components/comment/SelectionInsertPopup.tsx`

- **패널 루트의 직계 자식**으로 마운트한다. `messagesScrollRef`(`overflowY:auto`) 안에 두면 잘린다.
  `position: fixed` + `getClientRects()` 마지막 rect 기준 좌표, `zIndex: 60`(패널 루트가 50).
- 트리거: `document`의 `selectionchange`(rAF 디바운스) + `pointerup`. 조건 = 비어 있지 않은 Range **AND** 단일 `.comment-body` 안(D4). `messagesScrollRef` 스크롤·패널 리사이즈·선택 해제 시 숨김.
- 스타일(선례 = `AIChipBar` 비용 팝오버 `CommentPanel.tsx:1338-1344`):
  `border:1px solid var(--border-primary)` · `background:var(--bg-card)` · `borderRadius:6` ·
  `boxShadow:0 4px 16px rgba(0,0,0,0.12)` · `fontSize:11.5`. **다크 토큰 없음**(이 프로젝트에 다크 모드는 없다).
- 버튼: **[편집창에 삽입]**(prop 있을 때만) · **[복사]**. 둘 다 `onMouseDown={e => e.preventDefault()}`(D10).
- 피드백: 토스트 시스템이 없으므로 **버튼 라벨을 2초간 "삽입됨"/"복사됨"으로 교체**(선례: `ProblemView:341-352`, `CommentItem.flashStatus`).
- `[복사]` = `navigator.clipboard.writeText(serialized)` + `try/catch` (11-5, 마크다운 1종).
- ⚠ **`scrollIntoView` 금지**(CLAUDE.md) — 좌표는 rect 계산으로만.

### 4.4 배선

**① `MarkdownEditor.tsx` — `insertPlainText` 신설**(`MarkdownEditorHandle`에 시그니처 추가, `useImperativeHandle` 안 `insertText` 바로 아래)

```ts
/** 채팅→편집창 삽입 전용(Phase 61c). `insertText`와 달리 `{}` 탭스톱·커서 점프가 없다 —
 *  그쪽은 툴바 템플릿 규약이고 AI 대화문에는 `x^{}`·`\left\{\right\}`가 실제로 섞인다. */
insertPlainText(text: string) {
  const view = viewRef.current;
  if (!view) return;
  const { from, to } = view.state.selection.main;
  // CM6은 selection을 changes 적용 **후** 문서 기준으로 해석한다 → 한 dispatch면 된다(= undo 1스텝)
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  });
  view.focus();
},
```

**② `VerifyReportCard.tsx` — `FindingRow` 점프 가드**(D11′)

```ts
// :208 onClick 교체
onClick={canJump ? (() => {
  /* Phase 61c: 카드 안에서 드래그로 인용을 뽑는 중이면 점프하지 않는다.
     행 전체에 onClick이 걸려 있어 mouseup이 곧 점프였고, 탭 전환·ref.focus()가
     대화창 선택을 통째로 날렸다. 평범한 클릭은 mousedown이 선택을 먼저 접으므로
     여기 도달할 때 isCollapsed가 참이다. */
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.toString().trim()) return;
  onJumpToBlock!(finding.blockKey!, finding.quote);
}) : undefined}
```

**③ `CommentPanel.tsx`**
- `CommentPanelProps`에 `onInsertToEditor?: (text: string) => 'inserted' | 'no-target'`
  (주석의 선례는 **`onInsertGraphBlock`**으로 쓸 것).
- `CommentItem`의 `.comment-body` div에 `data-comment-id={comment.id}`(D2).
- 패널 루트 직계 자식으로 `<SelectionInsertPopup …/>` 마운트(D3 — prop 없어도 마운트).
- 부수: `onRunVerify`·`onJumpToBlock` JSDoc의 "편집 화면에서만 전달"을 정정한다(`ProblemView:1000-1001`이 실제로 넘긴다).

**④ `EditorView.tsx`**

```ts
const handleInsertFromChat = useCallback((text: string) => {
  const ref = activeBlockId ? editorRefs.current[activeBlockId] : null;
  if (!ref) return 'no-target' as const;   // 활성 없음 · 접힘(언마운트) · 미디어 블록(ref 미등록)
  ref.insertPlainText(text);               // → onChange → handleBlockChange → dirty → CM undo 1스텝
  return 'inserted' as const;
}, [activeBlockId]);
```
`<CommentPanel … onInsertToEditor={handleInsertFromChat} />`.

**⑤ `package.json`**

```jsonc
"test:extract": "tsc lib/chatExtract.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/chatExtract.test.mjs",

// devDependencies — 이미 전이 의존으로 설치돼 있다(설치된 실물 버전 그대로: 새로 받는 것 0)
"unified": "^11.0.5", "remark-parse": "^11.0.0", "remark-rehype": "^11.1.2"
```

### 4.5 표 직렬화 (11-4) — W1 정정 포함

전체 포함 판정. **`Range.containsNode`는 존재하지 않는다**(W1):

```ts
/** range가 node를 통째로 품는가.
 *  ⚠ Range에는 containsNode가 없다(그건 Selection의 메서드다).
 *  comparePoint(node, offset): 그 점이 range보다 앞이면 -1, 안이면 0, 뒤면 1.
 *  → 노드의 시작점이 앞이 아니고(>=0) 끝점이 뒤가 아니면(<=0) 통째로 들어 있다. */
function rangeContainsNode(range: Range, node: Node): boolean {
  try {
    return range.comparePoint(node, 0) >= 0
        && range.comparePoint(node, node.childNodes.length) <= 0;
  } catch { return false; }   // 다른 트리에 있으면 throw
}
```

복원 규칙:
- 셀 내용은 **같은 규칙표로 재귀 직렬화**한다(셀 안 수식·강조도 복원된다).
- 셀 안의 `|`는 `\|`로 이스케이프, 셀 안 개행은 공백으로 접는다 — GFM 표는 한 줄이 한 행이다.
- `thead`가 없으면 첫 `tr`을 헤더로 쓴다(`remarkGfm` 산출물에는 항상 `thead`가 있다).
- **일부만 걸치면** 표 문법을 만들지 않고 셀 텍스트를 공백으로 잇는다 — 반쪽짜리 `|` 행은 편집창에서 표로 렌더되지 않아 파이프가 그대로 보인다.

### 4.6 테스트 (`tests/chatExtract.test.mjs`) — D14′

실제 파이프라인 왕복:
`마크다운 → (protectFences→preventSetextHeadings→preprocessLocale→preprocessMath→restoreFences 사본) → unified(remark-parse·remark-math·remark-gfm·remark-rehype{allowDangerousHtml}·rehype-raw·rehype-katex{strict:false,trust:true,macros}) → hast → 미니트리 → serializeNodes → 원본과 비교`

필수 케이스: **§2-1의 5종(에러 인덱스 소비)** · 펜스/인라인 코드/다중 백틱/`~~~` 스큐 · 들여쓰기 코드블록·미닫힘 펜스(게이트 실패 확인) · `\\[6pt]` 보호 · array{l} 언랩(**사용자 array는 비언랩**) · `\tag*` 역변환 · 4형태 구분자 정규화 · 홀수 `$` · 마커 4종(뒤 공백 복원) · `br` · ol 번호·중첩 · 표 전체/일부.

⚠ **한계(W3)**: 이 테스트가 검증하는 것은 `serializeNodes` 코어와 규칙표뿐이다. **DOM→미니트리 어댑터**(Range 절단·`closest` 판정·스킵)는 변환기가 다르므로 커버되지 않는다.
→ ⓐ 테스트용 hast 변환기와 어댑터 양쪽에 "규칙이 한 벌임"을 상호 참조 주석으로 남기고, ⓑ 어댑터의 실물 검증은 **스텝 2 관문**이 전담한다(경계가 텍스트 중간·수식 중간·표 중간에 걸리는 절단 케이스를 반드시 포함).

---

## 5. 수용 손실

| 손실 | 이유 | 영향 |
|---|---|---|
| `\ref{n}` → `(n)` | `preprocessLocale:164`가 평문 치환. 리터럴 `(3)`과 구별 불가 | 재렌더 결과 동일 |
| `Fig.N`→`[그림N]` · `Table N`→`[표N]` | 〃 `:158,161` | 〃 |
| 사용자가 쓴 `\displaystyle` 소실(②경로) | `\displaystyle\s+` 전역 제거 | `preprocessMath`가 재주입 → 표시 동일 |
| `\\[6pt]` 뒤 공백 → 개행(②경로) | array 언랩의 부산물 | LaTeX 의미 동일 |
| 사용자가 손으로 쓴 `array{l}`+선두 `\displaystyle`(②경로) | 언랩 조건에 걸린다 | 재렌더 시 `preprocessMath`가 다시 감싼다. **단 2행 이후에도 `\displaystyle`이 붙으므로 완전 동일은 아니다**(극단 엣지) |
| 마커 뒤 공백 정확도 | 원문이 2칸이어도 1칸으로 복원 | 렌더 동일(CSS 고정폭) |
| 표 정렬 표기(`:---:`) | 복원하지 않는다 | 표는 그대로, 정렬만 기본값 |
| `$` 외의 마크다운 활성 문자(`*`·`_`·`[`) 미이스케이프 | 과잉 이스케이프가 평범한 문장을 더 망친다 | 원문이 `\*`였다면 `*`로 돌아온다(재렌더 시 기울임이 될 수 있다 — 드묾) |
| **②경로 에러 span의 display 판정** | 조상 단서가 없어 **개행 유무**로만 판정(§2-4) | 게이트를 통과하면(대다수) ①이 정확한 구분자를 준다 |

---

## 6. 작업 순서

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | `lib/chatExtract.ts`(+`buildMathIndex` 사본·양방향 주석) + `tests/chatExtract.test.mjs` + `npm run test:extract` | §4.6 필수 케이스 전부 통과 |
| 2 | 팝업 + DOM→미니트리 어댑터 — **[복사]만 먼저** | 실 대화(수식·마커·리스트·표·검증 카드·검산 펜스)에서 복사 결과가 편집창에 붙여넣어 원문 규약대로 렌더. **유일한 중간 관문: 덕수 실물 검수** — W3 때문에 어댑터는 여기서만 검증된다. 절단 케이스 필수 |
| 3 | `insertPlainText` + `onInsertToEditor` 배선 + [편집창에 삽입] | 삽입·커서 위치·dirty·undo 1회·no-target 안내 |
| 4 | `FindingRow` 가드 · 표 직렬화(§4.5) · `onRunVerify` JSDoc 정정 · roadmap·CLAUDE.md 갱신 | §7 체크리스트 통과 |

---

## 7. 검증 체크리스트

T1 인라인 수식만 선택 → `$…$` 원문(displaystyle 흔적 0) ·
T2 다행 display → `$$…\\…$$` 원문(array{l} 흔적 0) ·
T3 수식 중간에 걸친 드래그 → 수식 통째(D6) ·
T4 `\tag{n}`·(가)·ㄱ.·①·`**Case na.**` 역변환 — **마커 뒤 한 칸 확인** ·
T5 코드펜스·인라인 코드 `$` 포함 메시지 → 오염 0이면서 **①이 유지**된다(폴백으로 떨어지면 마스킹 버그) ·
T6 검증 카드 인용 선택 → `$` 규약 복원 ·
T6′ **카드 안에서 드래그해도 점프가 발화하지 않는다**(D11′) ·
T7 삽입 후 undo 1회로 복원, dirty·자동저장 정상 ·
T7′ **`x^{}` 든 텍스트를 삽입해도 커서가 튀지 않고 Tab 동작이 그대로다**(D12′) ·
T8 전체접기·활성 없음·**미디어 블록** → no-target 안내 ·
T9 여러 댓글에 걸친 선택 → 팝업 미표시 ·
T10 ProblemView(열람) → [복사]만 보이고 [편집창에 삽입] 없음 ·
T11 들여쓰기 코드블록·미닫힘 펜스 메시지 → 게이트가 ②로 내리고 결과가 멀쩡하다 ·
T12 표 전체 선택 → GFM 표 / 일부 선택 → 셀 텍스트 ·
**T13 `$\$5$`처럼 파싱이 깨진 수식을 포함한 선택 → `$\$5$` 원문 그대로 복원되고 `\displaystyle`이 없다**(§2-1) ·
**T14 표 판정이 스냅샷 이후 선택 변화에 흔들리지 않는다**(D10′ — 스냅샷으로 판정) ·
**T15 검산 python 부록·`mathory-graph` 펜스가 있는 실제 AI 메시지에서 ①이 유지된다**.

---

## 8. 하지 말 것

- **`EditorPreview`·전처리 파이프라인 수정 금지** — 렌더 사이트 5곳 공유. 이 Phase가 EditorPreview에 더하는 것은 **0**이다(`data-math-id`도 기존 것이고, 이번엔 쓰지도 않는다 — 그렇다고 **지우지도 말 것**, Phase 56이 쓴다).
- **`Range.containsNode` 호출 금지** — 존재하지 않는다(W1).
- **`.katex-error`를 폴백 트리거로 삼지 말 것** — 인덱스 소비자다(§2-1). 반대로 **`.katex`만 세는 것도 금지**.
- **에러 span의 textContent를 역변환 없이 쓰지 말 것** — 전처리된 TeX다(W2 반증).
- **`selection.toString()` 금지**(D9) · **annotation 무역변환 삽입 금지** · **게이트 실패 시 슬라이스 강행 금지**.
- **`$$` 앞뒤 빈 줄 정규화 중복 구현 금지** — `toPersistedBlock` 소유(61a Y1).
- **`insertText`를 채팅 삽입에 쓰지 말 것**(`{}` 탭스톱).
- 팝업에서 `scrollIntoView` 금지 · 다크 토큰 금지.
- `stripForHistory`·`extractVerifyReport`·검증 카드 렌더(가드 3줄 외) 무변경. 마커 리터럴을 "친절히" 다른 표기로 바꾸지 말 것(61a §7).
- 사본(`buildMathIndex`·테스트용 hast 변환기) 수정 시 원본과 동시 수정.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · **커밋까지만(push는 덕수)** · 완료 시 roadmap 갱신.

---

## 9. 이 Phase가 건드리지 않는 것

서버 라우트 · Firestore(규칙·스키마·마이그레이션) · 전처리 파이프라인 · `EditorPreview` · 인쇄 · 공개 뷰어 · **ProblemView** · discuss/proofread/verify 라우트·프롬프트. **전부 0건.**

변경 총량: 신규 2(`lib/chatExtract.ts` · `components/comment/SelectionInsertPopup.tsx`) + 테스트 1 +
`CommentPanel`(prop 1 · 스탬프 1 · 마운트 1 · JSDoc 정정) + `EditorView`(콜백 1 · prop 전달 1) +
`MarkdownEditor`(핸들 1) + `VerifyReportCard`(가드 3줄) + `lib/mathIndex.ts`(동기화 주석 1) + `package.json`(스크립트 1 · devDep 3).
**Firestore 규칙 0 · 마이그레이션 0 · 서버 0 · `npm install` 신규 패키지 0.**

---

## 부록. 문서 계보와 교훈

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 초안 — "annotation ≠ 원본" 재판정 · 이중 복원 골격 · D1~D10 · Q1~Q8 |
| v2 확정판 | CLI | 실 파이프라인 구동 실측 — Q1~Q8 응답 · C1~C18 · D11′~D14′ · 덕수 확정 5건 |
| v3 최종 | web | C1~C18 전건 재검증(tarball·package-lock) · **W1(존재하지 않는 API)** · W2 · W3 |
| **v4 실행판** | **CLI** | **W1 채택(구현 교체) · W2 실측 반증 → `.katex-error`=인덱스 소비자로 재설계 · W3 채택 · D1′/C3 폐기 · 단일 착수 문서로 통합** |

**교훈(61a·61b 계승 + 신규 2건)**
1. **세 검증 수단(소스 정독 / 실행 실측 / 명세 대조)은 서로를 대체하지 못한다.** v1은 소스를 읽어 구조를 세웠고, v2는 파이프라인을 **돌려** 소스 읽기로는 안 보이는 것(스큐 빈도, `br`+`\n`, 마커 공백)을 잡았고, v3은 **명세**로 존재하지 않는 API를 잡았다. 어느 하나만 돌리면 나머지 둘의 몫이 남는다.
2. **관찰이 옳아도 처방은 틀릴 수 있다 — 처방도 실측할 것.** v3의 W2는 "구분자가 사라진다"는 관찰이 정확했지만, 처방(`closest('.math-display')`)은 **rehype-katex가 그 요소를 splice로 지운다는 사실**과 정면으로 어긋났다. 관찰만 검증하고 처방을 검증하지 않으면 버그를 다른 버그로 바꿔 놓는다.
3. **계획서의 결정은 구현 뒤 실물과 다시 대조해야 한다** — v2의 C12(61b D12 "prop 유무가 게이트"가 구현에서 이미 깨져 있었다)가 그 사례다. 선례 인용은 계획서가 아니라 **코드에서 딸 것**.

*v4 실행판 — 미결 0건. 스텝 1부터 착수 가능. 실측 프로브(`probe61c*.mjs`)는 세션 스크래치패드에 있고, 스텝 1에서 `tests/chatExtract.test.mjs`로 승격한다.*
