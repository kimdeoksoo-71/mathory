# 개선묶음 M3 — 아이콘 정비 · 버그 수정 · 기능 개선 Final_V4 착수본

> 계보: 덕수 메모(`M3.md`) → v1(CLI 실측) → v2(CLI 확정) → v3(web 검증·`M3_plan_v3_final.md`) → **Final_V4(CLI 교차검증 = 착수본)**
> 실측 기준: 로컬 HEAD `845c13d`(줄번호는 이 기준 — web v3는 origin `b2f6015` 기준이었고 코드 인용은 전부 일치 확인).
> **구현·검수 완료(2026-09-05) — §4가 구현·검수 기록.** 배포 대기.
> **결정 전부 확정**: D1~D6·D8(v2, 덕수 수용) + D7′·D9=(b)·D11~D15(v3, 덕수 수용). **미결 0 — 이 문서대로 구현한다.**
> ⚠ 착수 전 덕수 `git push`(웹 검증 기준과 로컬을 맞춘다 — 규칙 3).

---

## 0. web v3 교차검증 결과 (Final_V4에서 더한 것)

v3의 정정·보강을 **전항 실측 승인**했다. 특히:

- **v2의 오류 2건은 web이 맞다** — ① EditorView에도 폭 스테퍼가 **있다**(`EditorView.tsx:3335-3382`, `{widthEm}em` `:3347`. v2의 "없다"는 grep 출력이 `head`에 잘려 매치가 묻힌 것) ② 배지 폰트는 11.
- **D7 기각 논리(마진 붕괴 반전) 승인** — 닫힌 `.outline-section`은 상하 패딩·보더가 없어 마지막 자식의 bottom margin이 밖으로 붕괴하고, 열리면 `padding-bottom`이 그 마진을 안에 가둔다. 높이 변화가 0.6em이 아니므로 음수 마진 상쇄는 정확히 되돌릴 수 없다. **D7′(상하도 상시 패딩)이 옳다.**
- **B1 렌더 사본 2벌 승인** — `lib/preprocess.ts`는 인쇄 전용(헤더 명시), 화면은 `EditorPreview.tsx:194-200` 자체 사본. `lib/ocr.ts:93`(4번째 변환 지점)도 확인.
- 신규 발견 승인: 5번째 💬 사이트(`PublicViewerShell.tsx:162-168` 로컬 `BubbleIcon`) · CSS 4중 로드 · `\gdef` 오염 → 팩토리(D13) · `:has()` 지원 확인.

Final_V4가 **v3에 더하는 것 3건**:

| # | 내용 |
|---|---|
| **F1** | v3의 오기 정정: `tests/caseBlock.test.mjs`는 42건이 아니라 **41건**(실행 실측) → B3 테스트 후 46건 |
| **F2** | **B4 "위쪽 밀림"의 최종 메커니즘 규명**: `hooks/useOutlineState.ts:49-61`의 스크롤 앵커가 클릭한 여닫이 줄의 화면 위치를 유지하려고 `scrollTop += delta`를 넣는다 — is-open 패딩이 여닫이 줄 **위**에 0.3em을 만들면 앵커가 그만큼 스크롤을 옮겨 **위쪽 내용이 밀려 보인다**. D7′로 레이아웃이 불변이면 delta=0이라 이 경로가 자연 무해화된다(코드 수정 불필요 — 검수에서 delta 0 확인) |
| **F3** | **CLAUDE.md 원칙 항목 보강 필요**: 어제 명문화한 인라인 `\displaystyle` 원칙이 `lib/preprocess.ts:168-175`만 가리키는데 화면 사본 `EditorPreview.tsx:230-235`가 따로 있다 — 두 주소를 함께 적어야 한쪽만 고치는 사고를 막는다(구현 스텝 0에서 정정) |

규모: **서버 0 · 규칙 0 · 스키마 0 · 전처리 파이프라인 0.** 신규 3(`lib/katexMacros.ts` · `components/editor/toolbarIcons.tsx` · `components/ui/SizeStepper.tsx`) · 수정 ~11파일 · 커밋 7.

---

## 1. 확정 결정 전체 (미결 0)

| # | 확정 | 근거 요지 |
|---|---|---|
| D1 | `IconComment` = 둥근 말풍선 + 점 2~3개(stroke dot, linecap round) | 네모 말풍선(코칭)과 윤곽 구분 |
| D2 | 팔레트 바탕 = `--accent-primary`(#c96442) 8~12% 틴트, open 한 단 진하게 | 조작 대상 UI 액센트 토큰 |
| D3 | 시그마 = 툴바 규격(viewBox 64·stroke 3.5) 인라인 SVG, 외곽선 시각 ≈1.2px | 2행 이웃과 같은 획 |
| D4 | 큰A작은A = styled `<span>`(`var(--font-ui)` = Pretendard) | 덕수 지정("글꼴 사용")에 충실 |
| D5 | A3 이후 수식 안 OCR 접근 불가 — 수용 | 메모 서술이 곧 사양 |
| D6→**D9=(b)** | 전문 여닫이 = `items.length > 0 && hasHiddenBlocks`(+ 열린 것은 닫기 항 유지) | *"요약은 요약일 뿐 — 전문은 요약 보기를 나가면 된다."* items 없는 전문은 지금과 같이 조용 |
| **D7′** | B4 = 상하 패딩·섹션 간 마진을 **상시**로(좌우와 같은 처방). is-open은 배경·radius·dot-fill만 | 마진 붕괴 반전·`:969` 특이도·배경 겹침이 음수 마진 상쇄(구 D7)를 기각 |
| D8 | B2 = `katex-frac-bar-and-vgap-v1.md` 정의 그대로 이식 | KaTeX 0.16.28 DOM·`:has()` 실검증 완료(v3 §5) |
| D11 | 공개 뷰어 로컬 `BubbleIcon` → `IconComment`로 통일(size 16) | 5번째 💬 사이트, 사본 제거 |
| D12 | `SVG_PROPS`·`CORNER_BRACKETS`·`SigmaIcon` → **`components/editor/toolbarIcons.tsx` 신설** | UnifiedToolbar→MathSymbolPalette 방향이라 역방향 import는 순환 |
| D13 | 매크로는 **팩토리** `katexMacros()`(호출마다 새 객체) | KaTeX가 `macros`를 in-place 수정 — 콘텐츠 `\gdef`가 공유 상수를 오염시키는 경로 차단 |
| D14 | 스테퍼 4곳(2파일×폭·글자) → **`components/ui/SizeStepper.tsx` 추출** | 꺾쇠 SVG가 두 파일 바이트 동일 사본. 스타일 차이(13/13.5·minWidth·borderLeft)는 prop·래퍼로 |
| D15 | 배지 아이콘 size **12**(버튼 13/16은 현행 크기 유지) | 11px 텍스트 캡 높이, 실측 후 ±1 조정 가능 |

## 2. 구현 사양 (파일별)

### 스텝 0 — 문서 정정 (F3)
CLAUDE.md 인라인 `\displaystyle` 원칙 항목에 화면 사본 주소 추가: *"주입은 사본 2벌 — 인쇄 `lib/preprocess.ts:168-175` · 화면 `EditorPreview.tsx:230-235`. 한쪽만 고치면 화면·인쇄 조판이 갈린다."*

### 스텝 1 — B4 (globals.css, D7′)
```css
.outline-section { /* 기존 좌우 상시 규칙에 추가 */ padding-top: 0.3em; padding-bottom: 0.3em; }
.outline-section.is-open { background: var(--block-bg); --case-dot-fill: var(--block-bg); border-radius: 6px; }
.outline-section + .outline-section { margin-top: 0.4em; }   /* :969의 .is-open 조건 제거 */
```
관문: 여닫이 클릭 전후 **위쪽 내용 rect 불변**(11/15/24px) + 스크롤 앵커 delta=0(F2) + 닫힌 목록 리듬 확인(과하면 마진 0.4→0.2em 조정 — 이 값만 조정 범위).

### 스텝 2 — B3 (`lib/solutionOutline.ts` + `OutlineSections.tsx`)
- `OutlineSection.hasHiddenBlocks` 필드 — `buildOutline`이 §v2-3의 판정 ①~⑤로 채운다(경우 구역·경우 body는 경우 클릭 담당이라 제외, 레거시 승격 텍스트 블록은 숨은 것).
- **판정 자체를 lib 헬퍼로**: `needsPrefaceToggle(sec) = sec.heading === null && sec.items.length > 0 && sec.hasHiddenBlocks` — JSX 조건은 `needsPrefaceToggle(sec) || (open && sec.blocks.length > 0)`(둘째 항 = 이미 연 전문을 닫는 길, 반드시 유지).
- 테스트 `test:case` 41 → **46건**: pinned 시작→false / 앞에 일반 텍스트→true / 레거시 라벨→true / 경우로만 시작→false / **items 없음+일반 텍스트만→false**(D9=(b) 명세 고정).
- 소비처 2곳(TabBody·ProblemTabContent) 모두 `OutlineSections` 경유 — 수정 1곳.

### 스텝 3 — A2 (`Icons.tsx` + 5곳)
`IconComment` 신설(24/1.8/currentColor, 둥근 말풍선+점) → 💬 교체 4곳(`EditorView:3312`(13) · `ProblemView:875`(13) · `FolderView:601`(12) · `ListView:200`(12)) + `PublicViewerShell.tsx` 로컬 `BubbleIcon` 삭제·`IconComment size 16`(D11). ⚠ 💬 옆 "AI" 유사 배지와의 시각 균형을 함께 볼 것.

### 스텝 4 — A1 (`CoachLabel.tsx` + globals)
아이콘 14→17 · 토글 스팬이 아이콘+라벨을 함께 감싼다(접힘 시 라벨 소멸 → 자연히 아이콘만). ⚠ `gap 0.35em`은 부모 `.coach-label` 소유 — 라벨을 토글 안으로 들이면 간격을 `.coach-toggle`에 재공급. 히트 규약(padding+음수 margin, `:688`) 유지.

### 스텝 5 — A3+A4 (`toolbarIcons.tsx` 신설 → `UnifiedToolbar` · `MathSymbolPalette`)
① `SVG_PROPS`·`CORNER_BRACKETS`를 `components/editor/toolbarIcons.tsx`로 이주 + `SigmaIcon` 신설(균일 획 고딕, 현행 대비 80%) — 순환 import 회피(D12).
② `MathSymbolPalette` 트리거: KaTeX `\sum` → `SigmaIcon`, `#f0f3fb`/`#e0e7ff`/`#ccc` 제거 → `--accent-primary` 틴트/진하게/외곽 ≈1.2px, **height 28 → 이웃 `ICON_BTN_BASE` 32 정렬**.
③ `ocr` 항목을 rightItems(`:851-858`)에서 좌측 else 갈래(`:922-930`, 블록 수식 뒤·구분선 앞)로. `ocrLoading`은 prop — 로딩 중 스왑되어 사라져도 진행은 계속(D5 수용).

### 스텝 6 — A5 (`SizeStepper.tsx` 신설 → 2파일 4스테퍼)
`components/ui/SizeStepper.tsx`(props: value·suffix?·min·max·onStep·titleUp/Down·icon·numberStyle?) → ProblemView `:650-733` · EditorView `:3335-3440` 교체. 폭 = `IconTextWidth` 신설(24/1.8, 좌우 세로바+양방향 화살표) + 숫자(em 제거, title 툴팁 유지) · 글자 = `'A a'` styled span. `borderLeft` 구분선은 EditorView 래퍼에 잔류.

### 스텝 7 — B2 (`lib/katexMacros.ts` + globals + rehype 2곳)
- `lib/katexMacros.ts`: **팩토리** `export function katexMacros()` — `{ '\\arraystretch': '1.8', ...FRAC_GAP_MACROS }` 새 객체 반환(D13). `EditorPreview:316` · `PrintableContent:137`이 `macros: katexMacros()`로(기존 `\arraystretch` 사본 2곳 해소).
- globals.css에 정의 문서의 CSS(`--frac-ext .25em`·`--frac-nest .3em` + 규칙 ①②) — 인쇄 같은 document라 한 곳이면 됨. 스코프 안 좁힘(검증 카드·폴더뷰 분수도 가로바 연장).
- 검증 카드(`katex-render.ts`)는 매크로 제외 — `\displaystyle` 주입도 없어 이미 본문과 조판이 다른 자리(v3 보강 근거).
- 관문: 목업 표본 8종(연분수·중첩·혼합·array+arraystretch·`\tag*`·`\dbinom`·`\cfrac`·인라인) 화면=목업 우측 · 인쇄 PDF 대조 · 인라인 번분수 줄간 11/15/24px · 기존 문항 3건 무회귀.

## 3. 커밋 단위 · 검수

**7커밋**: ⓪F3 포함 B4 / B3 / A2 / A1 / A3+A4 / A5 / B2. push는 덕수(규칙 3).
총관문: 로직 검증 10종(337→**342**건: case +5) · `tsc --noEmit` · `next build` · v2 §8 검수 ①~⑥ + 스텝별 관문.

---

## 4. 구현·검수 기록 (2026-09-05)

**커밋 12개** = 구현 7(`7517da0`~`d707712`, 스텝 1~7 각 1커밋) + 검수 반영 5(`86da086`·`98040c7`·`f637839`·`5e1ad5f`·`3546138`).
빌드 · 로직 검증 10종 **341건**(`test:case` 41→46) · tsc 전체 통과.

### 4-1. 구현 중 실증 1건 — D13의 근거를 프로브로 증명

`\gdef\evil{99}`를 렌더하자 넘긴 `macros` 객체에 `\evil`이 **실제로 잔류**했다(KaTeX in-place
수정 확인). 팩토리(호출마다 새 객체)에서는 다음 렌더에 새지 않았다 — `lib/katexMacros.ts` 주석에
"모듈 상수로 바꾸지 말 것"과 함께 기록. 렌더 프로브 7/7(번분수·3단 연분수·`\cfrac` 매크로
미적용·`\dbinom`·array+arraystretch·`\tag*`·`\tfrac` 혼합).

### 4-2. 덕수 검수 — 기능 전항 정상, 시각 조정 5차로 확정

B4·B3·B2·댓글 아이콘·OCR 이동: **1차에 전항 정상.** 시각 수치는 검수 왕복으로 확정했다
(계획서의 수치는 출발값이었고 **최종값은 아래가 진실**):

| 대상 | 최종값 |
|---|---|
| 코칭 Tip | 라벨 **상시 표시**(접힘에도) + 클릭 범위 포함 — `collapsed`는 aria-expanded만 나른다("접히면 라벨 소멸" 폐기) |
| 팔레트 트리거 | 버튼 높이 **26** · padding `0 3px` · gap 2. 시그마: 가로폭 유지·세로 29유닛(80%)·**획 5**(시각 ≈1.7px — 브라켓 1.2px보다 의도적으로 두껍다) |
| `IconTextWidth` | **27×15, viewBox=렌더 1:1**(꺾쇠와 같은 문법 — 두께가 물리적으로 같아야 해서). 세로바 획 **0.9** · 화살표 획 **1.4** · 가로선↔세로바 엣지 틈 ≈1px · 색 `--text-muted`. Icons.tsx 정사각 규격의 유일한 예외 |
| 글자크기 AA | 큰 A **19.5/500** · 작은 A **11.5/600** · 숫자와의 간격 **1px**(루트 gap 4를 marginRight −3으로 상쇄) |

### 4-3. 사고 기록 — dev 중 `npm run build` → `/` 404

구현 중 dev 서버가 도는 채로 build를 두 번 돌렸고, 다음 핫 리로드에서 `/`가 404로 떨어졌다
(같은 `.next` 공유 — **메모리에 이미 있던 금지 규칙을 어긴 것**). 처방: dev 종료 → `rm -rf .next`
→ 재시작. CLAUDE.md 작업 규칙 5에 증상·처방을 명문화했다.

---

*Final_V4 실행판 — web v3 전항 승인 + F1~F3 · 구현·검수 완료. 미결 0.*
