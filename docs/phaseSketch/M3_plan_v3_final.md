# 개선묶음 M3 — 아이콘 정비 · 버그 수정 · 기능 개선 구현 계획서 v3 확정판 (web 검증 · 결정 반영)

> 계보: 덕수 메모(`M3.md`) → v1(CLI 실측) → v2(CLI 확정판, 결정 D1~D8) → v3(web 검증) → **v3 확정판(덕수 회신 2026-09-05 반영, 이 판)** → 착수판
> 덕수 결정: **D9 = (b)** ("요약은 요약일 뿐 — 전문은 요약 보기를 끄면 된다. 전문 여닫이를 더 만드는 것은 구조만 복잡해지고 실익이 없다"), **나머지(D7′·D11·D12·D13·D14·D15)는 권장안 전부 수용**. §9가 확정 표.
> 검증 기준: **origin/main `b2f6015`**(2026-09-04 16:32 KST). v2가 적은 `861d3c9`는 origin에 없다(미푸시 로컬 커밋). 그러나 v2가 인용한 **코드 줄번호는 전부 b2f6015와 일치**했으므로 861d3c9의 차이는 문서(`docs/phaseSketch/katex-frac-bar-and-vgap-v1.md`, CLAUDE.md 전처리 절)뿐인 것으로 본다. ⚠ 착수 전에 push(규칙 3: 덕수 수동).
> 방법: 레포 클론 후 파일·줄 단위 대조 + **KaTeX 0.16.28 실제 렌더**(Playwright 스크린샷 `katex-0-16-28-verify.png`).

---

## 0. 요약 — v2 판정

| 절 | 판정 | 한 줄 |
|---|---|---|
| §1 B1 | 사실 정확 · **참조 1건 정정** | 렌더 변환은 `lib/preprocess.ts:134`(인쇄)와 `EditorPreview.tsx:199`(화면) **두 사본** |
| §2 B4 | 원인 정확 · **처방(D7) 재고 필요** | 음수 마진 상쇄는 마진 붕괴 반전·`:969` 특이도·배경 겹침 세 가지에 걸린다 → D7′ 제안 |
| §3 B3 | 원인 정확 · 조건 인용 **불완전** · 판정 ①~⑤ 타당 | 실제 조건은 `items.length > 0 \|\| (open && blocks.length > 0)`. **D9 = (b)**: 첫째 항을 `items.length > 0 && hasHiddenBlocks`로 좁힌다(조용한 전문은 계속 조용) |
| §4 A1~A5 | 대체로 정확 · **오류 2건** | A5 "편집창엔 폭 컨트롤 없음"은 **거짓**(EditorView 3335-3382에 있음) · A2 배지 크기는 12~13이 아니라 **11** |
| §5 B2 | 정확 · 0.16.28 실렌더로 **선택자·팬텀 DOM 확인** | CSS 로드는 이중이 아니라 **4중** · 공유 매크로 모듈은 `\gdef` 전역 오염 대비 필요(D13) |
| §7 | 5건 전부 답함 | 아래 §7 |

규모: 서버 0 · 규칙 0 · 스키마 0 · 전처리 0은 유지. 신규 파일 **3개**(`lib/katexMacros.ts` · `components/editor/toolbarIcons.tsx` · `components/ui/SizeStepper.tsx` — D12·D14 확정).

---

## 1. B1 — `\[..\]` → `$$` (종결 유지, 참조 정정)

v2 §1의 사실은 전부 맞다. 정정 2건:

1. **렌더 전처리는 두 사본이다.** `lib/preprocess.ts`는 헤더(`:9-10`)에 명시된 대로 **PrintableContent 전용**이고, 화면(EditorPreview)은 자체 사본 `EditorPreview.tsx:194-200`(`:199`가 동일 정규식)을 쓴다. v2의 "`preprocessMath`(`lib/preprocess.ts:134`)가 렌더 전처리에서도 변환"은 인쇄에만 맞는 말이다 — 화면도 변환되지만 근거 줄은 `EditorPreview.tsx:199`다. B1 종결 결론은 그대로(정규화·[교정]·렌더 세 겹).
2. 변환 지점은 셋이 아니라 **넷**이다: `lib/ocr.ts:93`(OCR 삽입도 `autoFixDeterministicIssues`를 탄다). 작업 0에는 영향 없음.

관찰(작업 아님): 세 변환의 의미가 조금씩 다르다 — `sheetImport.ts:163`은 구분자 단위 + `(?<!\\)` 가드(`\\[6pt]` 보호), `proofread.ts:503`은 짝 맞춤 + `$…$`/코드 보호 + **가드 없음**, 렌더 사본 둘은 짝 맞춤 + 가드 없음(펜스만 보호). 수식 밖 `\\[6pt]`는 실사용에 없으므로 두되, 알고 있을 것.

## 2. B4 — 제목바 클릭 상하 떨림 (원인 확정, 처방 수정)

원인 인용은 정확하다(`globals.css:962-968`, `:969`, 주석 `:953-955`). 레포 전체에서 `.outline-section`/`.section-head`/`.case-head`를 건드리는 규칙은 `:921-999`뿐이며 다크·인쇄·컴포넌트 스코프 재정의는 없다. 노브(`.outline-chevron`)는 이미 삭제됐고(`:1000-1004`), `.section-head`의 transition은 background뿐이다.

### D7(음수 마진 상쇄)이 걸리는 세 가지

1. **마진 붕괴 반전** — 닫힘 상태의 `.outline-section`은 상하 패딩·보더가 없어 **마지막 자식의 bottom margin이 섹션 밖으로 붕괴**한다(`p 0.6em`(`:599`), `.case-block 1.1em 0`(`:776`), 그림 래퍼 `1.2em`(TabBody:122) 등). 열리면 `padding-bottom: 0.3em`이 그 마진을 **안에 가둔다**. 즉 실제 높이 변화는 0.6em이 아니라 `0.3 + 0.3 + (마지막 자식 bottom margin이 밖→안으로 이동)`이고, 형제 간격은 그 마진에서 0(또는 `:969`의 0.4em)으로 줄어든다. `margin: -0.3em 0`은 박스 높이는 되돌려도 **이 반전은 되돌리지 못한다**.
2. **`:969` 특이도** — `.is-open + .is-open`(0,4,0)이 `.is-open`(0,2,0)의 `margin-top: -0.3em`을 **덮어쓴다**. 인접 두 섹션이 열린 경우(= `:969`가 존재하는 바로 그 경우)에만 상쇄가 빠져 0.7em 차이가 난다.
3. **배경 겹침** — `.is-open`은 패딩 박스 전체에 `--block-bg`를 칠한다(`:963`). 위쪽 음수 마진은 그 톤 상자를 **이전 형제의 마지막 0.3em 위로** 끌어올려, 이전 섹션의 `.section-head:hover` 밴드(`:942`)나 열린 톤과 겹친다(S2 톤 사다리 `:938-941` 훼손).

히트 영역은 문제없다(클릭 대상은 `.section-head`라 상자와 함께 움직임). 좌우 상쇄(`:956-961`)가 **상시**인 이유를 적은 주석 `:953-955`가 바로 "조건부 상쇄는 흔들린다"는 기록이다.

### 확정 D7′ — 상하도 좌우처럼 **상시**로

```css
.outline-section { /* 좌우 상쇄 기존 유지 */ padding-top: 0.3em; padding-bottom: 0.3em; }
.outline-section.is-open { background: var(--block-bg); --case-dot-fill: var(--block-bg); border-radius: 6px; }  /* 패딩 제거 */
.outline-section + .outline-section { margin-top: 0.4em; }   /* :969를 무조건으로 */
```
열고 닫아도 박스·마진·붕괴 조건이 전부 불변이라 **정의상 떨림이 0**이다. 대가: 닫힌 섹션 사이 간격이 지금보다 0.4em+0.6em 넓어진다(닫힌 목록의 리듬 변화 — 검수에서 11/15/24px 확인). 이것이 과하면 `.outline-section + .outline-section`을 0.2em으로 낮추는 것까지가 조정 범위.

추가 실측 포인트: `hooks/useOutlineState.ts:49-61`의 **스크롤 앵커 보정**(`container.scrollTop += delta`)은 스크롤 가능한 조상이 있을 때만 작동하고(`:54` 조기 반환), 끝단에서는 clamp된다. 잔여 떨림이 이 경로일 수 있으니 D7′ 적용 후에도 남으면 여기를 본다.

## 3. B3 — '앞부분 펼치기' 헛표시 (원인 확정, 조건 인용 보완)

`OutlineSections.tsx:152`의 실제 조건은 `sec.items.length > 0 || (open && sec.blocks.length > 0)`이다. 둘째 항은 **이미 열린 전문 섹션을 닫을 수 있게** 두는 것이므로 처방 후에도 남겨야 한다(`needsPrefaceToggle(sec) || (open && …)`).

v2의 판정 ①~⑤는 `buildOutline`(`lib/solutionOutline.ts:79-163`)의 항목 생성 경로 4가지(제목 있는 case → `case` 항목 / 경우 밖 `showInSummary` → `block` 항목 / 레거시 라벨 행 → body 없는 `case` 항목 / 경우 아래 블록 → segment·pinned 흡수)와 정확히 대응한다. §7-2에서 빠진 구성을 점검했고 하나 보탠다(아래).

**확정 D9 = (b)**: 지금은 `items`가 비면 여닫이가 **아예 없고**(전문에 요약 항목 없는 일반 텍스트만 있으면 요약 보기에서 보이지 않음), 이것은 **의도된 동작으로 확정**한다 — 요약은 요약일 뿐이고 전문은 요약 보기를 끄면 된다. 따라서 D6은 헛표시만 없앤다: 조건을 `items.length > 0 && hasHiddenBlocks || (open && blocks.length > 0)`로. `items`가 0인 전문은 전과 같이 조용하다.

구현 형태: `OutlineSection.hasHiddenBlocks: boolean`을 `buildOutline`이 채우고, **표시 판정 자체를 `lib/solutionOutline.ts`의 헬퍼 `needsPrefaceToggle(sec)`(= `items.length > 0 && hasHiddenBlocks`)로 둔다**. JSX는 `needsPrefaceToggle(sec) || (open && sec.blocks.length > 0)`만 쓴다 — 판정이 lib에 있어야 `test:case`가 덮는다(JSX 조건은 어떤 테스트도 못 본다). 소비처 2곳(`TabBody.tsx:321-329` 앱, `ProblemTabContent.tsx:132-138` 공개 뷰어) 모두 `OutlineSections`를 거치므로 한 곳 수정으로 끝난다.

테스트: `tests/caseBlock.test.mjs`(42건)에는 전문 여닫이 표시 여부를 보는 케이스가 **없다**(가장 가까운 것은 `:316`). `needsPrefaceToggle` 5건 추가 — pinned 시작 → 없음(false) / 앞에 일반 텍스트 + 요약 블록 → 있음 / 레거시 라벨 → 있음 / 경우로만 시작 → 없음 / **items 없음 + 일반 텍스트만 → 없음**(`hasHiddenBlocks`는 true이되 판정은 false — (b)의 명세를 테스트가 고정).

## 4. A1~A5 — 정정·보완

| # | v2 | 검증 결과 |
|---|---|---|
| A1 | 아이콘 14→17, 토글 스팬이 아이콘+라벨을 감싼다, `gap 0.35em` 소유 이동 확인 | ✔ 현재 스팬은 **아이콘만**(`CoachLabel.tsx:30-46`), 라벨은 형제 스팬. `gap 0.35em`은 부모 `.coach-block .coach-label`(`globals.css:667-677`) 소유 — 라벨을 토글 안으로 옮기면 아이콘↔라벨 간격을 `.coach-toggle`에 다시 줘야 한다(`gap` 또는 `margin`). 히트 규약 `:688`(`padding 3px 5px; margin -3px -5px`) 그대로 |
| A2 | `IconComment` 신설, 💬 4곳, 배지 2곳 size 12~13 | ✔ 4곳 줄번호 정확. ✘ 크기는 **13/13/11/11**(EditorView·ProblemView 버튼 13, FolderView·ListView 배지 **11**) → 배지 아이콘은 11~12. ⚠ **5번째 사이트**: `components/share/PublicViewerShell.tsx:162-168`의 로컬 `BubbleIcon`(둥근 말풍선, stroke 2, 16px) — 공개 뷰어 댓글 버튼(`:64`). **D11 확정: `IconComment`로 통일**(로컬 `BubbleIcon` 삭제, size 16 유지). 배지 아이콘은 **12**(D15). 참고: 💬 옆에는 항상 "AI" 쌍둥이 배지(`fontWeight 600, letterSpacing 0.3`)가 있다 — SVG로 바꾸면 이 쌍의 시각 균형을 함께 본다. Icons.tsx 규격은 1.8이 지배적이나 보편은 아님(2/2.5/1.6 혼재) |
| A3 | `ocr`을 우측 목록에서 좌측 else 갈래로 | ✔ 구조 정확(`rightItems` 6번째 `:851-858`, else 갈래 `:922-930`, 스왑 조건은 prop `cursorInMath` 단일). `ocrLoading`은 로컬 state가 아니라 **prop**(`:274`, EditorView 소유) — 문구만 정정. else 갈래에 두면 수식 안에서 사라지는 것은 D5대로 수용 |
| A4 | 하드코딩 색 제거, 시그마 = UnifiedToolbar 내 인라인 SVG | ✔ 색은 `MathSymbolPalette.tsx:118-119`(`#f0f3fb`/`#e0e7ff`/`#ccc`)에 있다 — UnifiedToolbar가 아니다. `SVG_PROPS`(`UnifiedToolbar.tsx:22-33`, viewBox 64·stroke 3.5)와 `CORNER_BRACKETS`는 UnifiedToolbar에 있고, **UnifiedToolbar가 MathSymbolPalette를 import**하므로 반대 방향 import는 순환이다 → **D12 확정: `components/editor/toolbarIcons.tsx` 신설**에 `SVG_PROPS`·`CORNER_BRACKETS`·`SigmaIcon`을 옮기고 UnifiedToolbar(기존 아이콘 함수들은 그대로 두되 상수만 import)·MathSymbolPalette가 import. 트리거 높이 28 → 이웃 `ICON_BTN_BASE` 32(`:287-297`)에 맞춘다 |
| A5 | ProblemView `{widthEm}em`→숫자, `IconTextWidth`, 'A a' span — "편집창엔 폭 컨트롤 없음" | ✘ **EditorView에도 폭 스테퍼가 있다**(`EditorView.tsx:3335-3382`, 글자는 `:3383-3440`). ProblemView 스테퍼는 `:650-733`(875는 💬 줄). 꺾쇠 SVG는 두 파일이 바이트 동일, 숫자 스타일만 다름(13 vs 13.5, minWidth 26/18 vs 30/22, EditorView만 `borderLeft`·`font-ui`). → A5는 **두 파일 × (폭 아이콘 + 'A a')** 4곳. `IconTextWidth` 없음(신설 맞음), `--font-ui`(`:140`, Pretendard)·`--text-muted`(`:119`) 정의 확인. **D14 확정: `components/ui/SizeStepper.tsx` 공용 컴포넌트 추출** — props: `value`·`suffix?`·`min`·`max`·`onStep(±)`·`titleUp/Down`·`icon`(IconTextWidth 또는 'A a' span)·`numberStyle?`(13 vs 13.5, minWidth 차이 흡수). ProblemView `:650-733`·EditorView `:3335-3440`을 교체, `borderLeft` 구분선은 EditorView 쪽 래퍼에 남긴다 |

## 5. B2 — 번분수 가로바·세로 여백 (이식 사양 확정, 보강)

| 항목 | v2 | 검증 |
|---|---|---|
| KaTeX | 0.16.28, CSS 이중 로드 | ✔ 0.16.28(lock 일치, rehype-katex 7.0.1). ✘ CSS는 **4중**: `layout.tsx:24` CDN(0.16.28 핀) + `EditorPreview.tsx:18` + `PrintableContent.tsx:11` + `lib/katex-render.ts:7`. 동일 버전이라 실해는 없음 — 그대로 둔다(정리는 M3 범위 밖) |
| CSS 주입구 | globals 한 곳 | ✔ 인쇄는 같은 document(`globals.css:461`, `:1022`, `PdfDownloadButton.tsx:52 window.print`). `.preview-content`로 좁히지 않는 판단 유지 — 검증 카드(`renderInlineMathHtml`)·팔레트 시그마도 `.katex`라 가로바 연장을 받는다 |
| 매크로 주입구 | rehype 옵션 2곳 | ✔ `EditorPreview.tsx:316` · `PrintableContent.tsx:137` 줄 정확. 둘 다 `strict:false, trust:true`(+인쇄 `fleqn`) — 매크로 추가 시 유지. ⚠ 지금은 옵션 리터럴이 렌더마다 새 객체라 콘텐츠의 `\gdef`가 문서 밖으로 새지 않는다. **모듈 상수 하나를 공유하면 `\gdef`가 상수를 변형해 전역 오염**된다(KaTeX는 `macros` 객체를 in-place 수정). **D13 확정: 팩토리** — `export function katexMacros(): Record<string,string> { return { '\\arraystretch': '1.8', ...FRAC_GAP_MACROS }; }`(호출마다 새 객체). 두 rehype 옵션은 `macros: katexMacros()`로 |
| 검증 카드 | 매크로 제외 | ✔ 유지. 보강 근거: `renderInlineMathHtml`(`katex-render.ts:48-75`)은 `\displaystyle` 주입도 없어 카드 분수는 **이미 본문(항상 display)과 조판이 다르다**. 매크로만 맞춰도 일치하지 않으므로 제외가 맞다. 0.16.28 11px 카드 실렌더에서 CSS 가로바 연장만 적용됨을 확인(스크린샷 하단) |
| 인라인 `\displaystyle` | 3종 전부 적용 | ✔ 화면 사본 `EditorPreview.tsx:232-233`도 동일 주입. 인라인 번분수(`$\frac{\dfrac{2}{k}}{3}$`)는 매크로로 **줄 높이가 더 커진다**(스크린샷 우측 "따라서…" 줄) — 검수 항목 유지 |

### §7-③ 0.16.28 DOM 검증 결과 (실렌더)
- 팬텀 삽입 후 분자 직계 자식 = `mord | mord rlap` → `.mord:first-child:nth-last-child(2):has(+ .rlap) > .mfrac` **적중 1**(기대 1). 규칙 ①은 분수 6개(팬텀 포함) 적중. `CSS.supports(':has(+ .x)')` true(Chromium 최신; Safari 15.4+/Firefox 121+).
- 표본: 3단 연분수·중첩·`\frac`+`\dfrac` 혼합·`\begin{array}{l}`+`\arraystretch 1.8`(Mathory 다행 display 래핑)·`\tag*{(1)}`·`\dbinom`·`\cfrac`·인라인 `\displaystyle` — 전부 목업 정의와 같은 결과. `\dbinom` 괄호 안 여백 소폭 증가(알고 두는 손실, v2와 동일), `\cfrac`는 매크로 미적용·CSS ①만 적용.
- `\arraystretch` 행에 든 번분수는 행 높이가 콘텐츠를 따라 커지므로 겹침 없음.

## 6. 결정 확정 (v2 D1~D8 유지 · 이 판에서 보정)

D1·D2·D3·D4·D5·D6·D8 유지. **D7은 D7′로 대체**(§2). D6은 **D9 = (b)**로 의미 확정(§3). D11~D15는 §9.

## 7. web 검증(v3) 요청에 대한 답

1. **공유 뷰 스테퍼 사본** — 없음. `ProblemTabContent.tsx`·`app/p/**`·`app/shared/**` 어디에도 `widthEm`/글자 스테퍼 없음. 공개 뷰어는 `PublicViewerShell.tsx:138,144`에서 **35em·15px 고정**. 단 §4-A5대로 EditorView에는 폭 스테퍼가 **있으므로** 작업 대상은 2파일.
2. **B3 판정이 놓치는 구성** — 이어짓기(제목 없는 case)는 curCase가 있으면 segment로 흡수(닿음), 없으면 항목도 segment도 아니어서 숨음(판정 ②·③이 맞게 처리). 레거시 라벨 혼합은 ④. 경우 뒤 일반 텍스트는 segment(닿음). 놓친 것 1건: **items 없는 전문** — D9 = (b)로 "여닫이 없음 유지"가 명세가 됐고 테스트로 고정한다(§3). `heading` 섹션 제외는 맞다.
3. **0.16.28 DOM** — §5 실렌더로 확인.
4. **검증 카드 매크로 제외 반박** — 반박 없음. 카드는 `\displaystyle`도 없어 원래 다르다.
5. **D7 부작용** — hover 히트는 무관하나 **배경 겹침·특이도·마진 붕괴 반전** 세 가지가 실재 → D7′.

## 8. 작업 순서 · 검수 (v2 §8 갱신)

1. **B4**(D7′, globals.css 3규칙, 독립 커밋 — rect 대조 11/15/24px + 닫힌 목록 리듬 확인) → 2. **B3**(`hasHiddenBlocks` + `needsPrefaceToggle` in solutionOutline, JSX 조건 교체, test 5건) → 3. **A2**(IconComment 신설 + 💬 4곳 + PublicViewerShell `BubbleIcon` 교체, 배지 12) → 4. **A1** → 5. **A3+A4**(`toolbarIcons.tsx` 신설 → SigmaIcon → MathSymbolPalette 트리거 색·높이 → ocr 이동) → 6. **A5**(`SizeStepper.tsx` 신설 → ProblemView·EditorView 교체 → IconTextWidth·'A a') → 7. **B2**(`lib/katexMacros.ts` 팩토리 + globals.css + rehype 2곳 — 화면·인쇄 대조, 인라인 번분수 줄간 11/15/24px, `\dbinom`·`\cfrac` 각 1건).

커밋 단위: B4 / B3 / A2 / A1 / A3+A4 / A5 / B2 — 7커밋. push는 덕수(규칙 3).

---

## 9. 결정 확정 (2026-09-05 덕수 회신)

| # | 사항 | 확정 | 비고 |
|---|---|---|---|
| **D7′** | B4 처방 | **상하 패딩·형제 간격 상시**(§2) | v2 D7(음수 마진 상쇄) 폐기. 닫힌 목록 간격은 검수에서 0.4em→0.2em 범위 조정 가능 |
| **D9** | B3 여닫이 표시 의미 | **(b) `items.length > 0 && hasHiddenBlocks`** | "요약은 요약일 뿐, 전문은 요약 보기를 끈다." items 없는 전문은 계속 조용 — 테스트로 명세 고정 |
| **D11** | 공개 뷰어 `BubbleIcon` | **`IconComment`로 통일** | 로컬 함수 삭제, size 16 |
| **D12** | 시그마 SVG·`SVG_PROPS` 위치 | **`components/editor/toolbarIcons.tsx` 신설** | 순환 import 회피, 사본 금지 |
| **D13** | `lib/katexMacros.ts` 형태 | **팩토리 `katexMacros()`** | `\gdef` 전역 오염 차단 |
| **D14** | A5 스테퍼 4곳 | **`components/ui/SizeStepper.tsx` 추출** | 꺾쇠 SVG 사본 2벌 해소, 스타일 차이는 prop |
| D15 | 배지 아이콘 크기 | **12** | 11px 텍스트 캡 높이 맞춤, 실측 후 조정 |

*v3 확정판 — b2f6015 대조 · KaTeX 0.16.28 실렌더 · 오류 정정 4건(B1 참조, A2 크기, A4 색 위치, A5 편집창 폭) · 보강 5건(B4 마진 붕괴·특이도, B3 조건 둘째 항·items 없는 전문, B2 CSS 4중·\gdef, 5번째 💬 사이트) · 결정 7건 확정(D9=(b), 나머지 권장안). 다음: CLI 착수판(v4) → 구현 7커밋.*
