# Phase 59 — Structure at a Glance: 풀이 구조 보기 · '경우(Case)' 블록 **v4 착수본**

작성일: 2026-08-17 · 기준 커밋 **`459cbcb`** (main = origin, 미푸시 0건)
문서 계보: v1(web, 방향·Q1~Q4 확정) → v2(CLI, 실측 정정 24건) → v3(web, 레포 클론 재검증 · F1 발견 · D19 추가) → **v4(CLI, 최종 착수본)**

> **이 문서 하나만 보고 구현한다.** v1~v3는 이력으로만 남긴다 — v4는 세 문서의 확정분을 전부 접어 넣은 자립본이다.
>
> **v3 검증 결과: F1·F2·F3·F4·F5 전건 타당하며 수용한다.** 특히 **F1(래퍼 래핑으로 형제 인접성 붕괴)은 v2의 실제 구조 결함**이었고, v3의 배치 규칙(D15′)이 옳다. 그 위에 v4가 **정정 5건(G1·G3·G4·G5·G6)과 보강 4건(G2·G7·G8·G9)** 을 더한다. 가장 중요한 것은 **G1 — 덕수가 지시한 로고 레드 dot이 명암비 3:1을 통과하지 못한다**는 실측 결과다(§0-1). 색상 값 하나만 바꾸면 지시의 취지는 그대로 지켜진다.
>
> **미결 항목 없음.** Q1~Q4(v1) · Q5(v3) · D19(덕수 지시) 전부 확정. G1은 "지시 이행 방법의 정정"이지 재질의가 아니다 — 기본값대로 진행하면 된다.

---

## 0. v3 대비 변경 (G1~G9)

### 0-1. G1 ★ D19의 로고 레드는 명암비 3:1에 미달한다 — `--mathory-red-dark`로 교체

v3 §3-2는 "`--mathory-red`(#D97757)은 텍스트 기준 4.5:1엔 못 미치지만 dot는 비텍스트 UI 요소(3:1 기준)이므로 문제없다"고 단정했다. **계산이 없었다.** `CLAUDE.md`가 못박은 산식(`((c+0.055)/1.055)^2.4`)으로 실측하면:

| 전경 | 클레이 `#F4EFE7` | **카드 `#EDE6DA`** | 공유 `#FEFDFB` | 인쇄 백지 |
|---|---|---|---|---|
| `--mathory-red` **#D97757** | 2.73 ✗ | **2.52 ✗** | 3.07 △ | 3.12 |
| **`--mathory-red-dark` #BC5F3F** | 3.79 ✓ | **3.49 ✓** | 4.26 ✓ | 4.33 |
| `--accent-primary` #c96442 | 3.41 ✓ | 3.14 ✓ | 3.84 ✓ | 3.90 |

- **구속 조건은 FolderView 카드 `#EDE6DA`**(CLAUDE.md에 못박힌 그 조건)이고 거기서 **2.52:1**이다. 비텍스트 UI 최소 3:1(WCAG 1.4.11)에 미달한다. dot은 장식이 아니라 **열림/닫힘 상태 표시기**이므로 이 기준이 그대로 적용된다.
- 테두리만 남기는 닫힘 상태(D19)는 채움보다 인지 대비가 더 약하므로 실질 여유가 더 없다.
- **정정**: dot 색을 **이미 존재하는 로고 토큰 `--mathory-red-dark: #BC5F3F`**(globals.css:92)로 한다. 세 배경 전부 3.49 이상 통과하고, "Mathory 로고 레드"라는 D19의 지시는 그대로 지켜진다(같은 로고 팔레트의 dark 짝).
- 산식 신뢰도: 같은 스크립트가 CLAUDE.md에 기록된 `--text-primary` 실측치(12.51 / 11.54 / 14.08)를 **소수 둘째 자리까지 재현**했다. 부록 A에 스크립트 동봉.

### 0-2. 나머지 8건

| # | 성격 | 내용 |
|---|---|---|
| **G2** | 보강 | `--mathory-red*`는 지금까지 **로고 워드마크 전용**이었다(소비처 3곳: `AppShell.tsx:835`·`MiniShell.tsx:79`·`Sidebar.tsx:827` 전부 로고). globals.css:90의 "로고 전용 레드" 주석이 거짓이 되므로 **주석 1줄 갱신 필수** |
| **G3** ★ | 정정 | **하위경우의 테두리 dot은 구별되지 않는다.** v3 값(0.34em 지름 + 1.5px 테두리)은 15px에서 구멍 2.1px, **11px에서 구멍 0.7px = 사실상 채움**. 테두리를 px로 두면 글꼴 확대·축소에 따라 상태 구분이 무너진다 → **링 두께 `0.1em`, 하위 dot 0.34em → `0.4em`**(구멍 0.2em) |
| **G4** ★ | 정정 | **인쇄의 세로 기준은 0.9em이 아니라 `0.85em`이다.** `.print-body { line-height: 1.7 }`(PrintStyles.css:35) → 첫 행 중심 = 0.85em. 화면은 `.preview-content` 인라인 `line-height: 1.8`이라 0.9em이 맞다. v2·v3 모두 인쇄에 0.9em을 그대로 뒀다 |
| **G5** ★ | 정정 | **인쇄 dot은 `#000` 채움을 기본**으로 한다. ① 인쇄는 톤 시스템조차 의도적으로 100% 복원하는 "색 위계를 죽이는" 체계다(Phase 58 D6, PrintStyles:39-50) ② 흑백 프린터에서 로고 레드는 중간 회색으로 떨어져 구조 신호가 본문(#000)보다 약해진다 ③ 인쇄에는 접힘 상태가 없어 색이 전달할 상태 정보 자체가 없다. `--case-dot` 토큰 1줄로 컬러 인쇄 전환 가능(§4.2) |
| **G6** ★ | 정정 | **F5(라벨 열 1행)는 기본 2탭에서만 안전하다.** 탭 이름은 3번째 탭부터 사용자 편집이고 **길이 제한이 없다**(`commitTabLabel`, maxLength 없음). 톤 스코프가 `tabId !== 'question'`이라 **extra 탭에도 토글이 뜬다** → 긴 라벨이면 105px를 넘긴다. 라벨 열에 `flexWrap: 'wrap'`을 주어 **토글이 다음 행으로 자연 낙하**하게 한다(v1 원안 "라벨 바로 아래"와 합치) |
| **G7** | 보강 | F2의 collapse는 **3중 collapse**다: 블록 자신의 margin-bottom 1.1em ↔ 마지막 자식 `<p>`의 0.6em ↔ 다음 블록의 1.1em → 1.1em. **`.case-block`에 상하 padding을 1px라도 주면** 자식 마진이 갇혀 간격이 1.7em이 되고 `-1.1em` 브리지가 짧아진다 → CSS 주석 + CLAUDE.md에 명기 |
| **G8** | 보강 | **FolderView는 래퍼 em과 본문 px가 어긋난다.** `.problem-content-scaled > div { font-size: Npx !important }`(FolderView:562)가 블록 래퍼에 슬라이더 값을 강제하는데, 카드에는 `--content-font-size`가 없어 `.preview-content`는 **항상 15px 폴백**이다 → 슬라이더가 15가 아니면 dot y(0.9em)·rail x(1em)가 본문과 어긋난다. callout의 `padding-left: 3em`이 이미 갖고 있던 편차이며 신규 결함이 아니다 → **Phase 59에서 카드 글자 크기 동작을 바꾸지 않는다**(범위 밖). Stage 2에서 11/15/24 실측만 |
| **G9** | 수용 | F4 특이도 정정 수용: `.katex` 규칙은 (0,6,1)(클래스 3 + `:has()` 인자 2 + `.katex` 1, 요소 1). 색 규칙은 (0,5,1). 결론 불변 |

**v3에서 그대로 채택한 것**: D15′(클래스 배치 규칙) · D2′ 행 단위 스캔 · D19 상태 문법(채움/테두리) · 하위 dot `opacity` 삭제 · F2 실증 · V2(has-key 판정은 원본 blocks 기준).

---

## 1. 확정 결정표 (통합 최종)

| # | 결정 |
|---|---|
| D1 | 섹션 = `type === 'heading'` 블록 경계. 첫 제목 앞은 전문(前文) 섹션 |
| D1′ | 텍스트 블록 안의 마크다운 `## `는 섹션 경계가 아니다(블록 타입만 본다) |
| D2 | 구조 보기의 핵심문장은 `**…**` **발췌 렌더**(블록·문단 통째가 아니다) |
| D2′ | 레거시 Phase 54 라벨은 **행 단위 스캔**으로 case/subcase 항목 승격. 자동 번호 미부여 |
| D3 | 상태 `mode`+`openSections`+`openCases`, **비영속**. 키는 `block_key ?? id` |
| D4 | 적용 = ProblemView + ProblemTabContent(공유·스냅샷·실시간 공통). 편집창·FolderView·인쇄 제외 |
| D4′ | 탭 스코프 = `isToneScoped(tabId)` (문제 탭 제외) |
| D5 | 기본 상태 **full** — 기존 문항 화면 변화 0 |
| D6 | 명칭 **"구조 보기 / 전체 보기"**(편집창 '전체 접기'와 충돌 회피). ProblemView는 라벨 열, 공유뷰는 탭 콘텐츠 최상단 우측 |
| D7 | additive 타입 2종 `case`/`subcase`. depth 필드 없음. **규칙 0 · 마이그레이션 0 · 서버 0** |
| D8 | 한글 라벨 '경우' / '하위 경우' — Phase 54 D4가 미룬 한글화 결정의 답 |
| D9 | 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호는 raw_text에 넣지 않는다 |
| D9′ | **이어짓기**: 첫 줄이 빈 case/subcase는 직전 경우의 연속 — 번호·dot 없음, rail만 이어짐 |
| D10 | 번호 리셋은 섹션(heading) 단위 |
| D11 | rail + dot. 좌측 여백은 callout 기준값(화면 3em / 인쇄 2em) 재사용 |
| D11′ | 여백은 **K1 = 1.1em / 11pt** |
| D11″ | rail·dot은 **1em을 중심선으로 공유**(`margin-left:-1px` + `translate(-50%,-50%)`) |
| D12 | 하위경우 = 들여쓰기 1단 + 작은 dot |
| D12′ | **inner rail 없음** — 부모 rail 하나가 관통. 규칙이 case·subcase 동일 |
| D13 | 클릭 여닫이는 **outline 모드에서만** |
| D14 | 제목·key·경우가 전무하면 토글 비활성 + 툴팁 |
| D15 | 케이스 렌더 = **단일 `EditorPreview` + 라벨 span 주입**(2-div 분할 금지) |
| **D15′** | case 클래스는 **사이트별 최상위 블록 요소**에 붙인다(EditorView는 `data-block-id` 래퍼, PrintableContent는 `print-block` 래퍼) — 형제 인접성 보존 |
| D16 | 공유뷰·앱 뷰 **렌더러 통합 금지**(공유뷰엔 svg·ggb 분기가 없다) |
| D17 | rail 종단 기본 = 런의 마지막 블록 하단까지. "마지막 dot에서 끊기"는 1규칙 교체 |
| D18 | 자동 번호는 화면·인쇄 전용. `exportMd` 블록 주석에만 라벨 동봉 |
| **D19** | dot = 상태 표시기. **펼침 = 채움 / 접힘(outline) = 테두리만.** 색은 **`--mathory-red-dark`**(G1), 링 두께 `0.1em`(G3), 인쇄는 `#000` 채움(G5) |
| Q5 | 레거시 `Case 1.` 표기 유지 + 렌더 무변화. 신규는 `C-1.` |

---

## 2. 신설 모듈

### 2-1. `lib/caseBlock.ts` — 5개 렌더 사이트 공용

```ts
export type CaseKind = 'case' | 'subcase';
export function isCaseBlock(type: string): boolean;

/** blockKey(=block_key ?? id) → 'C-2' | 'C-2-a'. 이어짓기 블록은 항목 없음(=null 취급) */
export function buildCaseLabels(
  blocks: { id: string; block_key?: string; type: string; raw_text: string }[],
): Map<string, string>;

/** 첫 줄 / 나머지. 첫 줄이 공백뿐이면 title === '' (이어짓기) */
export function splitCaseTitle(raw: string): { title: string; body: string };

/** 첫 줄 앞에 라벨 span 주입. label === null이면 원문 그대로 반환 */
export function injectCaseLabel(raw: string, label: string | null): string;

/** Phase 54 레거시 라벨 정규식 — locale.ts와 공유(사본 금지) */
export const LEGACY_CASE_RE = /^\*\*Case\s+\d+[a-z]?\.\*\*/;
export const LEGACY_SUBCASE_RE = /^-\s+\*\*Case\s+\d+[a-z]\.\*\*/;
```

번호 규칙:

```
heading             → n = 0, sub = 0
case,    제목행 有   → n++, sub = 0,  label `C-${n}`
case,    제목행 無   → label 없음 (이어짓기)
subcase, 제목행 有   → sub++,        label `C-${n || 1}-${letters(sub)}`
subcase, 제목행 無   → label 없음
그 외 블록           → 상태 불변 (경우 사이 설명 문단이 번호를 끊지 않는다)
```

```ts
function letters(n: number): string {          // 1→'a', 26→'z', 27→'aa'
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(97 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
```

`injectCaseLabel` 출력:

```
<span class="case-label">C-2.</span> $a>1$인 경우
본문 첫 줄…
```

행 선두 인라인 `<span>` 주입은 `marker-gana`·`marker-circled`·`marker-case-sub`가 쓰는 확립된 방식이고 `rehypeRaw`(EditorPreview.tsx:302)가 파싱한다. **raw_text 불변**(Phase 54 D5 원칙).

### 2-2. `lib/solutionOutline.ts` — 열람 2뷰 공용

```ts
export interface OutlineItem {
  kind: 'case' | 'subcase' | 'keys';
  blockKey: string;
  label?: string;      // 'C-2.' (레거시 항목은 없음)
  content: string;     // EditorPreview에 그대로 넘길 문자열(마커 포함)
}
export interface OutlineSection {
  key: string;             // 섹션 첫 블록의 block_key ?? id
  heading: Block | null;   // null = 전문 섹션
  items: OutlineItem[];    // 접힘 상태에서 보일 것
  blocks: Block[];         // 펼침 상태 원본
}
export function buildOutline(blocks: Block[]): OutlineSection[];
export function hasOutlineContent(s: OutlineSection[]): boolean;   // D14 게이트
export function extractKeySentences(raw: string): string[];        // 마커 포함 반환
```

`extractKeySentences` 요건:
- `lib/keyTone.ts:21`의 `KEY_STRONG_RE`를 **export**하고, 추출용 `KEY_STRONG_RE_GLOBAL`(같은 패턴 + `g`)을 별도 상수로 둔다 — `lastIndex` 오염 방지(판정용 `test`와 분리).
- case/subcase 블록은 **본문(둘째 줄 이후)만** 대상(제목행 중복 방지).
- 안전망 필터: 발췌 결과가 마커 제거 후 `/^Case\s+\d+[a-z]?\.$/`면 버린다.

`buildOutline`의 **레거시 처리(D2′ · 행 단위)** — 텍스트 계열 블록을 행 단위로 훑는다:

```
행이 LEGACY_CASE_RE     → kind:'case'    항목 (content = 그 행 전체, 자동 번호 없음)
행이 LEGACY_SUBCASE_RE  → kind:'subcase' 항목 (동일)
그 외 행                 → key 발췌 대상
```

한 텍스트 블록에 `**Case 1.**`·`**Case 2.**`·`- **Case 2a.**`가 함께 있는 것이 Phase 54의 표준 형태이므로 **블록 단위 승격은 금지**한다(F3).

발췌는 섹션당 하나의 합성 문자열(`join('\n\n')`)로 묶어 `EditorPreview`를 **한 번**만 호출한다.

---

## 3. 렌더 배치 (D15·D15′)

### 3-1. 사이트별 클래스 부착 지점

| 사이트 | 최상위 블록 요소 | 조치 |
|---|---|---|
| ProblemView | `renderBlocks` 반환 div가 곧 형제 | 반환 div에 클래스 |
| FolderView | 동일 | 반환 div에 클래스 |
| ProblemTabContent | 동일(`tone-baseline` 직속) | 반환 div에 클래스 |
| **EditorView 미리보기** | **모든 블록이 `<div data-block-id>` 래퍼 안**(`:3162`) | **래퍼에 클래스 병기**, 내부는 분기만 교체 |
| **PrintableContent** | **모든 블록이 `<div className="print-block">` 안**(`:73`) | **`print-block`에 병기** |

래퍼 안쪽에 case div를 새로 만들면 `.case-block + .case-block`이 **한 번도 매칭되지 않아** 두 사이트에서 rail 브리징이 조용히 죽는다(F1). CSS는 §4 그대로 두고 배치만 지킨다.

```tsx
// 공통 클래스 계산
const caseCls = (block, label, closed) => [
  'case-block',
  block.type === 'subcase' && 'case-sub',
  !label && 'case-cont',
  closed && 'case-closed',          // outline 모드의 열람 2뷰만 true가 될 수 있다
].filter(Boolean).join(' ');
```

```tsx
// EditorView (3162 래퍼) — 래퍼에 병기, 내부는 EditorPreview 인자 그대로
<div key={block.id} data-block-id={block.id}
     className={isCaseBlock(block.type) ? caseCls(block, label, false) : undefined}
     style={{ paddingTop: headingTopPad }}>
  {/* … : isCaseBlock(block.type) ? (
        <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko"
                       activeMathId={isActivePreview ? activeMathId : undefined}
                       onClickMath={(id) => handlePreviewMathClick(block.id, id)} />
      ) : … */}
</div>

// PrintableContent (73 래퍼)
<div key={block.id}
     className={`print-block${isCaseBlock(block.type) ? ' ' + caseCls(block, label, false) : ''}`}
     style={heading ? { paddingTop: '1em' } : undefined}>

// 나머지 3곳
<div key={block.id} className={caseCls(block, label, closed)}>
  <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko" />
</div>
```

안전성 확인(실측): `.print-block`은 **CSS 규칙 0건**의 무스타일 래퍼다(grep 결과 선언부 1곳뿐). EditorView 래퍼에 `position: relative`·`padding-left`가 붙어도 Phase 56 스크롤은 `getBoundingClientRect` 기반(`EditorView.tsx:1833-1847`)이라 무영향이고, `data-block-id` 조회·활성 블록 매핑도 래퍼가 유지되므로 불변이다.

분기 삽입 지점은 5곳 모두 **callout 분기 바로 앞**(유일한 공통 앵커).

### 3-2. 상태 → 렌더 대응

| mode | 섹션 | 케이스 | 렌더 | dot |
|---|---|---|---|---|
| full | — | — | 전체 | 채움 |
| outline | 펼침(`openSections`) | — | 전체(full과 동일 경로) | 채움 |
| outline | 접힘 | 펼침(`openCases`) | 제목행 + 본문 전체 | 채움 |
| outline | 접힘 | 접힘 | 제목행 + 본문 key 발췌 | **테두리** |

`case-closed`는 "본문이 접힘"을 뜻하며 발췌 표시 여부와 무관하다. 편집창·FolderView·인쇄는 상태 개념이 없으므로 이 클래스를 만들지 않는다(코드 변경 0).

---

## 4. CSS (최종본)

### 4-1. 화면 — `app/globals.css`, callout 절(492-502) 다음

```css
/* ═══ Phase 59 — 경우(case) 블록 ═══
   rail·dot은 1em을 중심선으로 공유한다. 하위경우는 텍스트만 들여쓰므로
   레일 규칙 3개가 case·subcase에 동일하게 적용된다(D12′).
   ⚠ .case-block에 상하 padding을 주지 말 것 — 자식 <p>의 마진이 갇혀
     형제 간격이 1.1em → 1.7em이 되고 아래 -1.1em 브리지가 짧아진다(G7). */
.case-block {
  position: relative;
  margin: 1.1em 0;        /* K1 — .callout-block(493)과 동일 */
  padding-left: 3em;      /* .katex-display(291-293)·.callout-block(494)과 동일 */
  padding-right: 0;       /* \tag float:right 기준선 = 컨테이너 우단 */
}
.case-block.case-sub { padding-left: 6em; }     /* 텍스트만 한 단 더 */

/* rail — 기본: 자기 dot에서 자기 하단까지 */
.case-block::before {
  content: '';
  position: absolute;
  left: 1em; margin-left: -1px; width: 2px;
  top: 0.9em;             /* .preview-content line-height 1.8의 절반 */
  bottom: 0;
  background: currentColor; opacity: 0.28;
}
/* 연속 구간 브리징 — 형제 마진 collapse(1.1em)를 건너뛴다 */
.case-block:has(+ .case-block)::before { bottom: -1.1em; }
.case-block + .case-block::before      { top: 0; }

/* dot — 상태 표시기 (D19). 펼침 = 채움 / 접힘 = 테두리만
   ⚠ box-sizing 명시 필수: 전역 리셋 `*`(144-148)는 가상요소에 닿지 않는다.
     두 상태의 외곽 치수를 같게 유지하려면 여기서 직접 선언해야 한다.
   ⚠ 링 두께는 반드시 em — px로 두면 글꼴 11px에서 구멍이 사라져
     채움/테두리 구분이 무너진다(G3). */
.case-block::after {
  content: '';
  position: absolute;
  left: 1em; top: 0.9em;
  transform: translate(-50%, -50%);
  width: 0.5em; height: 0.5em; border-radius: 50%;
  box-sizing: border-box;
  background: var(--case-dot);
}
.case-block.case-closed::after {
  background: transparent;
  border: 0.1em solid var(--case-dot);
}
.case-block.case-sub::after  { width: 0.4em; height: 0.4em; }   /* 크기로만 구분 — opacity 금지 */
.case-block.case-cont::after { content: none; }                 /* 이어짓기(D9′) */

/* 라벨·제목행 */
.case-label {
  margin-right: 0.4em;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
.case-block p:has(> .case-label:first-child) { font-weight: var(--weight-medium); }
.case-block .katex-display { padding-left: 0; }   /* 이중 들여쓰기 방지 — callout(502) 전례 */

/* 톤 가드 — 케이스 제목행은 구조 신호다. h1~h3 가드(271-283)와 1:1 대응.
   색 규칙 (0,5,1) / 아래 수식 규칙 (0,6,1) > .solution-tone.has-key .katex (0,3,0) */
.solution-tone.has-key .case-label,
.solution-tone.has-key .case-block p:has(> .case-label:first-child) { color: var(--text-secondary); }
.solution-tone.has-key .case-block p:has(> .case-label:first-child) .katex { color: var(--text-primary); }

/* 구조 보기 발췌 — 발췌는 전부 <strong>이라 has-key 복귀 규칙(258-259)이
   자동으로 primary+600을 준다. 여기에는 레이아웃만 둔다. */
.outline-keys { margin: 0.35em 0; }
.outline-keys .preview-content p { margin-bottom: 0.35em; }
```

`:root`에 2줄:

```css
  /* 경우 블록 dot (Phase 59 D19). 로고 팔레트의 dark 짝을 쓴다 —
     #D97757은 클레이 배경에서 2.73:1 / 카드 #EDE6DA에서 2.52:1로
     비텍스트 UI 최소 3:1에 미달한다(G1). dark는 3.49~4.33으로 전부 통과. */
  --case-dot: var(--mathory-red-dark);
```

그리고 globals.css:90 주석 갱신(G2):

```css
  /* Brand — 로고 워드마크 + Phase 59 경우 dot(--case-dot) */
```

**D17 종단 전환**(스케치대로 마지막 dot에서 끊고 싶을 때) — 1규칙 추가:

```css
.case-block + .case-block:not(:has(+ .case-block))::before { bottom: auto; height: 0.9em; }
```

### 4-2. 인쇄 — `components/print/PrintStyles.css`, callout 절(135-143) 다음

```css
/* ── Phase 59: 경우(case) 블록 ──
   ⚠ 세로 기준은 0.85em — .print-body line-height는 1.7이다(35행). 화면(1.8→0.9em)과 다르다(G4).
   ⚠ dot은 #000 채움. 인쇄는 톤 시스템조차 100% 복원하는 체계이고(39-50행),
     흑백 프린터에서 컬러 dot은 중간 회색으로 떨어져 본문보다 약해진다(G5).
     컬러 인쇄를 원하면 아래 --case-dot 한 줄만 지우면 화면 색을 그대로 쓴다. */
.print-body .case-block {
  position: relative;
  margin: 11pt 0;          /* K1 인쇄 — .callout-block(137)과 동일 */
  padding-left: 2em;       /* 인쇄 fleqn 들여쓰기(24행)와 동일 */
  padding-right: 0;
  --case-dot: #000;
}
.print-body .case-block.case-sub { padding-left: 4em; }
.print-body .case-block::before {
  content: ''; position: absolute;
  left: 0.7em; margin-left: -0.125mm; width: 0.25mm;
  top: 0.85em; bottom: 0;
  background: #000; opacity: 0.55;
}
.print-body .case-block:has(+ .case-block)::before { bottom: -11pt; }
.print-body .case-block + .case-block::before      { top: 0; }
.print-body .case-block::after {
  content: ''; position: absolute;
  left: 0.7em; top: 0.85em;
  transform: translate(-50%, -50%);
  width: 0.42em; height: 0.42em; border-radius: 50%;
  box-sizing: border-box; background: var(--case-dot);
}
.print-body .case-block.case-sub::after  { width: 0.34em; height: 0.34em; }
.print-body .case-block.case-cont::after { content: none; }
/* 제목행 고아 방지만 — break-inside는 걸지 않는다(경우는 길 수 있다. callout과 반대 판단) */
.print-body .case-block p:has(> .case-label:first-child) { break-after: avoid; font-weight: 600; }
/* ⚠ 필수 — 없으면 이중 들여쓰기. @media print가 .katex-display를 0으로 죽이고
   .fleqn > .katex에 2em을 다시 주기 때문이다(23-24행). callout(143)과 동일 처방 */
.print-body .case-block .katex-display.fleqn > .katex { padding-left: 0 !important; }
```

---

## 5. 구조 보기 UI

### 5-1. 상태와 배치

```ts
const [mode, setMode] = useState<'full' | 'outline'>('full');     // D5
const [openSections, setOpenSections] = useState<Set<string>>(new Set());
const [openCases, setOpenCases] = useState<Set<string>>(new Set());
```

ProblemView는 탭이 여러 개이므로 **탭 본문을 `components/problem/TabBody.tsx`로 분리**하고 상태를 그 안에 둔다(ProblemView는 이미 1,061행이고 IIFE·인라인 style이 촘촘하다). 공유뷰는 `ProblemTabContent`가 이미 탭 단위 컴포넌트라 그대로 담는다.

### 5-2. 토글

- **공용 컴포넌트** `components/ui/OutlineToggle.tsx` (`mode` `onChange` `disabled` `compact`). 로직·토글만 공유하고 **렌더러는 통합하지 않는다**(D16).
- **아이콘**: `components/ui/Icons.tsx`에 `IconChevronsDown`(`polyline 6,6 12,12 18,6` + `6,13 12,19 18,13`)·`IconChevronsUp` 신설. viewBox 24 · strokeWidth 2 · `stroke="currentColor"` — 기존 3종(`:126-148`)과 동일 규격. **lucide는 의존성에 없다.**
- **ProblemView**: 라벨 열(`:703-733`)에 아이콘 버튼 추가 + 그 컨테이너에 **`flexWrap: 'wrap'`**. 기본 2탭('문제'·'풀이')은 1행에 들어가고(105px vs ≈76px), 사용자가 이름을 정한 extra 탭에서 길어지면 자동으로 2행이 된다(G6).
- **공유뷰**: `ProblemTabContent` 최상단 우측 1행. 공개 페이지는 발견성이 중요하므로 **아이콘 + "구조 보기" 텍스트**. 2단 레이아웃(`twoColumn`)에는 탭 바가 없으므로 셸이 아니라 여기여야 한다(E16).
- **게이트**: `isToneScoped(tabId)`가 false면 렌더 자체를 하지 않고(D4′), `hasOutlineContent()`가 false면 `disabled` + `title="제목·핵심문장·경우 블록이 없습니다"`(D14).

### 5-3. 여닫이·접근성

- outline 모드에서 제목행 hover → `var(--bg-hover)` + chevron 회전. 클릭 → 해당 섹션·경우 토글. 하위경우는 독립.
- full 모드는 무반응(D13) — 텍스트 선택·복사와 충돌하지 않는다.
- 전문 섹션: 항목이 있으면 위에 "⌄ 앞부분 펼치기" 행(Q4). 항목이 없으면 통째 숨김이므로 여닫이도 없다.
- 제목행 컨테이너에 `role="button"` `tabIndex={0}` `aria-expanded` `aria-controls` + Enter/Space. **실제 `<button>`으로 감싸면 안 된다** — 내부에 `<p>`·KaTeX(MathML)가 들어가 HTML이 무효가 된다.
- 모바일: chevron을 outline 모드에서 **상시 표시**. 제목행 상하 `padding: 0.4em`으로 터치 타깃 보정.
- **스크롤 앵커링**: 토글 직전 `titleEl.getBoundingClientRect().top`을 기억하고, 반영 후 `requestAnimationFrame`에서 같은 값이 되도록 컨테이너를 `scrollBy`. 컨테이너 ref는 ProblemView U-프레임(`:669-681`)·공유뷰 `ScrollColumn`(`PublicViewerShell.tsx:114-124`). mode 전환은 앵커 대상이 없어 보정하지 않는다.
- **dot와 chevron의 신호 중복**: 둘 다 열림/닫힘을 말한다. Stage 4에서 실물 확인 후 거슬리면 **케이스 행만 chevron 생략**(섹션 제목행 chevron은 유지) — 1줄.

---

## 6. Phase 54 레거시 정합

| 대상 | 처리 |
|---|---|
| 기존 `**Case 1.**` / `- **Case 1a.**` | **렌더 무변화.** `normalizeCaseBoundaries`·`convertSubcaseMarkers`·불릿 숨김 CSS 유지, 마이그레이션 없음 |
| 구조 보기에서 | 행 단위 스캔으로 case/subcase 항목 승격(D2′) → 레거시 문항도 즉시 동작 |
| 자동 번호 | 레거시 항목엔 부여하지 않는다(라벨이 원문에 이미 있다) |
| 정규식 | `locale.ts:91`·`:108`의 것을 `lib/caseBlock.ts` 상수로 추출해 **3곳 공유**(사본 이격 방지) |
| 신규 저작 | `case`/`subcase` 블록 권장. 레거시 규약은 "지원하되 권장 안 함" |
| 표기 혼재 | Q5 확정 — 문항 단위로 자연 정리. 자동 변환 도구는 후속 후보 |

`**Case n.**`의 `**`가 Phase 58 key 마커라는 사실(E1-b) 때문에 **케이스 분석을 쓴 기존 풀이는 이미 has-key 발동 상태**다. 톤·발췌 설계는 전부 이 전제 위에 있다.

---

## 7. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 제목·key·경우 전무 | D14 게이트로 토글 비활성 |
| key 마커가 경우 제목행에 있음 | 제목행은 항상 표시 → 발췌는 본문만 |
| 상위 case 없는 subcase | `C-1-a`로 렌더 + **편집창 미리보기에서만** 흐린 경고. 데이터 불변 |
| 이어짓기가 런의 첫 블록 | dot 없이 rail만 → 편집창에서만 경고 |
| 경우 사이에 일반 블록 | 번호 유지(D10), rail은 끊긴다 — **의도**(경우 밖 문단임을 알린다) |
| 경우 안 display 수식·리스트·① 밭 | 기존 K1 규칙 그대로. 이중 들여쓰기 override만 확인 |
| 경우 안 `\tag{n}` | `padding-right: 0`으로 float 기준선을 컨테이너 우단에(callout 전례) |
| ⌘B 분할 | 뒤 블록은 항상 `text`(`EditorView.tsx:1571-1580`) → 번호 안전 |
| 한 경우에 이미지·선택지 필요 | 블록 단위의 한계 → `case`(제목행 有) → `image` → `case`(이어짓기)로 잇는다(D9′) |
| Undo/Redo | additive라 기존 배선이 커버(Phase 57 A-14). outline 상태는 undo 대상 아님 |
| 저장 후 재로드 | outline 비영속. 키는 `block_key ?? id` |
| 공개 문항 ⌘P | 공개 뷰어엔 앱 인쇄 경로가 없어 화면 DOM이 그대로 인쇄된다 → 구조 보기 상태로 인쇄됨. **사양** |
| 공개 문항 ⌘F | 접힌 텍스트는 DOM에 없어 찾히지 않는다 → 기본값 full의 근거 |
| FolderView 글꼴 슬라이더 | 래퍼 em ≠ 본문 15px 편차(G8) — Stage 2 실측만, 동작 변경 없음 |
| 톤 dim | rail은 `currentColor`라 함께 흐려지고(의도), **dot은 동행하지 않는다**(구조 신호 불변) |

---

## 8. 파일 목록 (`459cbcb` 기준)

```
# 신설
lib/caseBlock.ts                           buildCaseLabels · splitCaseTitle · injectCaseLabel · letters · LEGACY_*_RE
lib/solutionOutline.ts                     buildOutline · hasOutlineContent · extractKeySentences
components/ui/OutlineToggle.tsx            공용 토글
components/problem/TabBody.tsx             ProblemView 탭 본문 + outline 상태

# 수정
types/problem.ts:158                       union에 'case' | 'subcase'
lib/keyTone.ts:21                          KEY_STRONG_RE export + _GLOBAL 변형
lib/locale.ts:91, :108                     정규식을 caseBlock.ts 상수로 교체(동작 불변)
components/ui/Icons.tsx:148 이후           IconChevronsDown · IconChevronsUp
components/editor/EditorView.tsx:80-125    상수 5곳 (LABELS·TYPES·PRESETS·TEXT_BASED·SPLITTABLE)
components/editor/EditorView.tsx:3162      래퍼에 case 클래스 병기 + callout 앞 분기 (D15′)
components/problem/ProblemView.tsx:385     callout 앞 분기
components/problem/ProblemView.tsx:693-755 TabBody 위임 + 토글(라벨 열 flexWrap)
components/problem/FolderView.tsx:288      callout 앞 분기 (접기 없음)
components/share/ProblemTabContent.tsx:57  callout 앞 분기 + 토글 + outline
components/print/PrintableContent.tsx:73   print-block에 case 클래스 병기 (D15′)
components/print/PrintableContent.tsx:86   callout 앞 분기
lib/version/exportMd.ts:67                 블록 주석에 라벨 동봉 (D18)
app/globals.css:90                         --mathory-red 주석 갱신 (G2)
app/globals.css:133 부근                   --case-dot 토큰 신설
app/globals.css:503 이후                   .case-block 일체 + 톤 가드 + .outline-keys
components/print/PrintStyles.css:144 이후  인쇄 .case-block 일체
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0.** P3~P4(경우 블록)와 P1~P2(구조 보기)는 독립 배포 가능하지만 구조 보기가 경우 제목행을 항목으로 쓰므로 **경우 블록 먼저**가 자연 순서다.

---

## 9. Stage 계획과 검증

**Stage 0** — 착수 시 `git log -1`이 `459cbcb`에서 움직였으면 §8 좌표만 재확인.

**Stage 1 · 경우 블록** — 타입·상수·5곳 분기·라벨 계산·주입.
- 경우 3 + 하위 2 문항에서 `C-1`~`C-3`·`C-2-a`·`C-2-b`
- 삽입·삭제·순서 변경 후 번호 재계산 / 이어짓기 억제 / 상위 없는 subcase 경고
- 저장→재로드 / undo 복원 / ⌘B가 `case + text`를 만드는지
- **E7 회귀**: 편집창 미리보기에서 제목행 수식과 본문 수식을 각각 클릭 → 각각 올바른 편집 위치
- **F1 회귀**: 5곳 각각에서 DevTools로 `.case-block + .case-block` 매칭 확인(특히 편집창·인쇄)
- 편집창 전체접기에서 "경우 · 제목행" 요약(`:736-744`)

**Stage 2 · 시각** — rail·dot·들여쓰기, 화면 + 인쇄.
- 스케치 대조 / 4경계(case→case, case→subcase, subcase→case, 런 마지막) 레일 연속성 / D17 두 안 비교
- **G3**: 글꼴 11·15·24px에서 하위경우 테두리 dot의 구멍이 보이는지
- **G4**: 인쇄 dot·rail이 첫 행 중심에 오는지(0.85em 검증)
- **G1**: dot이 클레이·카드·공유 3배경에서 충분히 읽히는지(수치는 통과, 육안 확인)
- **G5**: 흑백 인쇄에서 dot이 본문보다 약하지 않은지
- **G8**: FolderView 슬라이더 11/15/24에서 dot·rail 편차 관찰(기록만)
- **V1**: 래퍼 line-height 상속 확인 — 어긋나면 `.case-block { line-height: 1.8 }` 1줄
- callout과 나란히 둔 리듬 / 경우 안 수식·리스트·`\tag` / has-key에서 제목행·제목행 수식이 dim되지 않음(E17)
- **하위 dot↔텍스트 간격(5em)** 판정 — 멀면 (a) 들여쓰기 6em→5em (b) dot을 4em으로 옮기고 tick 추가

**Stage 3 · 구조 보기(ProblemView)** — 섹션 모델 + 토글 + 스켈레톤.
- 접기 → 제목·발췌·경우 제목행만 / 펼치기 → 픽셀 동일 / D14 게이트 / 전문 섹션
- **F3 회귀**: `**Case 1.** … **Case 2.** … - **Case 2a.**`가 **한 블록에 든** 레거시 문항에서 세 항목이 모두 뜨는지
- 문제 탭에 토글이 없는지(D4′) / 발췌가 primary+600인지

**Stage 4 · 여닫이** — hover·클릭·접근성·앵커링.
- 섹션·경우·하위경우 독립 토글 / full 무반응 / 모바일 탭·chevron 상시
- **D19**: 여닫을 때 dot 채움↔테두리가 즉시 전환 / chevron과 신호 중복 판정 / full 복귀 시 전부 채움
- 키보드·`aria-expanded` / 토글 전후 클릭 지점 y 유지

**Stage 5 · 공유뷰** — 1단·2단 양쪽 토글 / `/p`·`/shared` 동일 / 기존 공개 문항 무변화 / 공개 페이지 줄바꿈 무변화(`.tone-baseline`만 유지)
- **V2**: 모드 전환 시 has-key 컨테이너 클래스 불변(판정은 원본 blocks 기준)

**Stage 6 · 통합·문서**
- `roadmap.md` 갱신 · Phase 59를 `docs/phasedocs/`로 승격
- `docs/phasedocs/사용 가이드 — 강조와 톤.md`에 "핵심문장 마커는 문장 전체 단위" 한 줄
- **`CLAUDE.md` 정정 4건**: ① 블록 타입에 `case·subcase` ② "분기 순서는 5곳 모두 …" → 사이트별 차이(인쇄는 choices 선두, 공유뷰는 svg·ggb 없음) ③ 전처리 파이프라인에 `normalizeCaseBoundaries`·`convertSubcaseMarkers` 추가 ④ **"`.case-block`에 상하 padding 금지"**(G7)와 **"dot 색은 명암비 구속 조건 #EDE6DA에서 3:1"**(G1) 한 줄씩
- Phase 54 문서에 "D4의 한글화 미결은 Phase 59 D8로 결정됨" 한 줄

---

## 10. 확인 사항

**없음.** Q1~Q4(v1) · Q5(v3) · D19(덕수 지시) 확정. G1은 D19의 색상값 정정이며 지시의 취지(로고 레드 채움/테두리 상태 문법)는 유지된다 — 다른 색을 원하면 `--case-dot` 한 줄만 바꾸면 되고, 그때도 §부록 A 표에서 3:1 이상인 값을 고를 것.

---

## 11. 구현 중 개정 (2026-08-17, 덕수 승인 A~F)

1차 구현 뒤 실물 확인에서 나온 요구 4건을 반영했다. **§4·§6의 rail·dot 명세는 아래로 대체된다.**

| # | 결정 | 내용 |
|---|---|---|
| A | rail 관통 구간 | 한 섹션에서 **첫 경우 ~ 마지막 경우** 사이의 모든 블록. 사이에 낀 블록은 `.case-gap`을 받아 rail만 관통시킨다(들여쓰기는 주지 않는다 — 이미지가 중앙 정렬이라 밀린다). 제목 블록이 런을 끊는다 |
| B | rail 색 | **불투명 `--case-rail: #C9C4BA`**. 톤 시스템을 따라 흐려지지 않는다 → dot과 함께 "구조 신호는 톤 불변"으로 통일 |
| C | 경우 안 리스트 | display 수식과 **같은 좌단**(한 단 = 3em / 인쇄 2em). ① 원문자 밭도 동일 |
| D | 하위경우도 동일 원칙 | 본문 6em · 수식/리스트/① 9em (인쇄 4em · 6em) |
| E | 개재 이미지 들여쓰기 | 하지 않는다 |
| F | dot 크기 | 경우 `0.52em` / 하위 `0.3em` (지름비 58%, **면적비 34%**). 접힘 링은 `0.1em` / `0.075em` |

### 11-1. rail 모델 (§6.2 대체)

**런 = 첫 dot에서 시작해 마지막 dot에서 끝나는 하나의 선.** 블록마다 조각을 그리고 조각끼리 **위쪽으로** 이어 붙인다.

```css
.case-block::before, .case-gap::before { left: 1em; margin-left: -1px; width: 2px;
                                          top: 0.9em; bottom: 0; background: var(--case-rail); }
:is(.case-block, .case-gap) + :is(.case-block, .case-gap)::before { top: -1.5em; }
.case-block:not(:has(+ .case-block)):not(:has(+ .case-gap))::before { bottom: auto; height: 0; }
:is(.case-block, .case-gap) + .case-block:not(:has(+ .case-block)):not(:has(+ .case-gap))::before {
  bottom: auto; height: calc(1.5em + 0.9em); }
```

세 가지가 서로 맞물려 있다 — 하나만 바꾸면 깨진다:

- **브리지는 반드시 위쪽**이어야 한다. 아래로 뻗으면 마지막 블록 앞 간격의 크기에 따라 선이 마지막 dot을 지나쳐 삐져나온다. 위로 뻗으면 종단이 `height`로 결정돼 항상 정확하다.
- **색은 반드시 불투명**이어야 한다. 조각이 겹치는 구간에서 알파가 누적돼 그 부분만 진해지기 때문이다. 블록마다 마진이 달라(이미지 1.2em·SVG 0.8em·수식 1.1em…) 겹침을 피할 수 없다.
- **브리지 1.5em은 양쪽에서 물린 값**이다. 실제 최대 간격(1.2em)보다 크고, 최소 간격(0.8em) + 첫 dot 위치(0.9em)보다 작아야 한다 — 크면 런의 첫 dot 위로 선이 삐져나온다. 블록 마진을 바꾸면 재계산할 것. 인쇄는 같은 논리로 `14pt`.

### 11-2. 경우 안 들여쓰기 (§6.2 보완)

경우 블록 안에서는 **최상위와 똑같은 규칙**이 산다 → `.katex-display`에 아무 override도 두지 않는다(1차 구현의 `padding-left: 0`을 삭제). 리스트·① 밭만 기본 1em이 너무 약해 같은 한 단으로 올린다.

⚠ 강조문(`.callout-block`)은 반대로 `padding-left: 0`으로 죽인다. 한 줄짜리 강조 장치라 이중 들여쓰기가 군더더기이기 때문이다. **전례를 복사해 되돌리지 말 것.**
⚠ 인쇄의 ① 규칙은 `!important`가 필요하다 — globals.css의 `p:has(.marker-circled){margin-left:1em !important}`가 `.print-root` 서브트리에도 걸려 특이도로는 못 이긴다(실측 확인).

### 11-3. 실측 결과 (headless Chrome, 2026-08-17)

rail — 5개 시나리오(연속 3개 / 이미지 관통 / 단독 / 하위경우 포함 / 긴 본문) 전부 **위 삐짐 0.0px · 아래 삐짐 0.0px · 끊김 없음**. 단독 런은 선 길이 0(dot만). 인쇄도 동일.

들여쓰기 (마커·글자 기준):

| | 본문 | display 수식 | 리스트 | ① 밭 |
|---|---|---|---|---|
| 최상위 | 0 | 3em | 1em | 1em |
| 경우 | 3em | **6em** | **6em** | **6em** |
| 하위경우 | 6em | **9em** | **9em** | **9em** |
| 인쇄 경우 | 2em | **4em** | **4em** | **4em** |
| 인쇄 하위 | 4em | **6em** | **6em** | **6em** |

최상위 값이 변하지 않았으므로 경우 블록 밖에는 회귀가 없다. dot 실측: 경우 7.80px / 하위 4.50px(지름비 58%·면적비 33%), 색 `#BC5F3F`(인쇄 `#000`).

### 11-4. 실사용 확인에서 나온 수정 2건

**제목행 뒤 빈 줄을 렌더 시 보장한다.** 사용자가

```
$a>1$인 경우
$$
x = 1
$$
```

처럼 제목행 바로 다음 줄에 본문을 쓰면 마크다운이 **한 문단으로 묶어** `C-1. a>1인 경우 x=1`처럼 붙어 나온다. 들여쓰기도 먹지 않는다(문단 안 인라인이 되므로). 제목행 규약(D9)이 "첫 줄은 제목"이라고 정한 이상 사용자가 빈 줄까지 신경 쓰게 할 수 없으므로 `injectCaseLabel`이 렌더 시점에 빈 줄을 넣는다. Phase 54의 `normalizeCaseBoundaries`가 Case 라벨 앞에 빈 줄을 넣는 것과 같은 처방이며, 수식의 개수·순서를 바꾸지 않아 편집창 `data-math-id` 매핑에 영향이 없다.

**구조 보기 토글에 글자를 붙였다.** 아이콘만(22px, `--text-faint`) 두었더니 복사 버튼 옆에 묻혀 **덕수가 기능의 존재 자체를 찾지 못했다.** 라벨 열은 `flexWrap`이라 글자를 붙이면 '풀이' 아래 줄로 자연스럽게 내려간다. 공개 뷰어는 처음부터 글자를 달고 있었다.

> ⚠ 함께 확인된 기존 동작: **`$$x = 1$$`처럼 한 줄로 쓴 독립행 수식은 이 파이프라인에서 인라인으로 파싱된다**(경우 블록과 무관하게 최상위에서도 동일). `.katex-display`가 생기지 않으므로 들여쓰기·상하 여백 규칙이 전부 비껴간다. 독립행 수식은 `$$` / 내용 / `$$` 세 줄로 쓸 것.

### 11-5. 구조 보기 실사용 후 조정 3건 (덕수, 2026-08-17)

**접힘 dot의 속을 배경색으로 채운다.** 투명하게 두면 rail이 dot 한가운데를 관통해 지나가는 것이 그대로 보인다. `--case-dot-fill`을 두고 기본값은 앱의 클레이(`--bg-content`), 공개 뷰어는 `ProblemTabContent`가 `--bg-card`로 덮어쓴다. **접힘 상태는 구조 보기가 있는 두 곳에서만 생기므로 소비처도 이 둘뿐이다** — 편집창·카드·인쇄에는 `case-closed`가 아예 나오지 않는다.

**chevron은 어느 쪽도 내용을 밀지 않는다.**

| | 가로 | 세로 |
|---|---|---|
| 제목 줄 | chevron이 `1em` 폭을 차지 → **제목 좌단이 정확히 1em = 경우 rail 선**에 선다 | `align-items: baseline` |
| 경우 줄 | chevron을 `.case-block` 기준 `left: 1.5em`으로 **절대배치**(dot 1em 바로 오른쪽) → 흐름에서 빠져 제목행은 3em 그대로 | `top: 0.9em; translateY(-50%)` — dot과 같은 세로선 |

⚠ 제목 줄의 세로 정렬에 고정 높이를 쓰면 안 된다. h1/h2/h3는 font-size도 `margin-top`도 서로 다르고 **EditorPreview 인라인 style이라 CSS로 만질 수 없다**(Phase 58 D1′). `baseline` 정렬에 맡기면 세 크기가 전부 자동으로 글자 줄에 붙는다 — 실측 오차 0.3px.

실측: 제목 좌단 1.00em / chevron 세로 오차 −0.3px / 경우 제목행 좌단 3.00em(안 밀림) / 경우 chevron 세로 오차 0.0px / 접힘 dot 배경 `#F4EFE7`.

**확인 완료(덕수, 2026-08-17)**: ① 하위경우 접힘 dot 구멍 — Retina 2x 실측 스크린샷으로 11·13·15px 모두 링이 구별됨(F값 유지) ② 하위경우 display 수식 9em — 문제 없음 ③ 흑백 인쇄 rail·dot 농도 — 적절.

**남은 판단**: 하위경우의 dot(레일 위 1em)과 제목행 텍스트(6em) 사이가 5em이라 dot이 어느 행에 속하는지 다소 모호하다. 거슬리면 (a) 하위 들여쓰기 6em→5em (b) dot을 4em으로 옮기고 레일↔dot 연결 tick 추가 중 택일(§6.4).

---

## 부록 A. 명암비 실측 (재현 가능)

```python
def lin(c):
    c = c/255
    return ((c+0.055)/1.055)**2.4 if c > 0.03928 else c/12.92
def L(h):
    h = h.lstrip('#'); r,g,b = [int(h[i:i+2],16) for i in (0,2,4)]
    return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)
def cr(a,b):
    la, lb = L(a), L(b); hi, lo = max(la,lb), min(la,lb)
    return (hi+0.05)/(lo+0.05)
```

| 전경 | `#F4EFE7` | `#EDE6DA` | `#FEFDFB` | `#FFFFFF` |
|---|---|---|---|---|
| `--text-primary #2D2A23` | 12.51 | 11.54 | 14.08 | 14.31 |
| `--mathory-red #D97757` | 2.73 | **2.52** | 3.07 | 3.12 |
| `--mathory-red-dark #BC5F3F` | 3.79 | **3.49** | 4.26 | 4.33 |
| `--accent-primary #c96442` | 3.41 | **3.14** | 3.84 | 3.90 |

첫 행이 CLAUDE.md에 기록된 실측치와 일치하므로 산식·구현이 검증된다. **구속 조건은 `#EDE6DA` 열**이다.

## 부록 B. 문서 계보와 교차검증 기록

| 버전 | 작성 | 방법 | 산출 |
|---|---|---|---|
| v1 | web | 소스 스냅샷·이전 Phase 문서 | 방향 확립, Q1~Q4 확정. 좌표·형태는 미검증 선언 |
| v2 | CLI | 레포 전수 실측 | 정정 24건 — **Phase 54 중복 규약 발굴**, E7 수식 클릭 매핑, K1 값, 분기 순서, 톤 가드 |
| v3 | web | 레포 직접 클론 대조 | v2 전건 승인 + **F1 래퍼 인접성 결함** 발견, F3 행 단위, D19 추가 |
| **v4** | CLI | v3 신규 주장 재실측 | **G1 명암비 미달**(계산 근거), G3 링 두께, G4 인쇄 0.85em, G5 인쇄 색, G6 탭 라벨 가변, G7 padding 금지, G8 FolderView 편차 |

교차검증 워크플로(web ↔ CLI)의 네 번째 실행 사례. 이번 회차의 교훈: **"기준은 3:1이니 괜찮다"처럼 임계값만 인용하고 계산을 생략한 주장이 실제로는 미달**이었다 — 명암비는 반드시 수치를 남긴다.

## 부록 C. 후속 후보

레거시 `Case` 텍스트 → 블록 자동 변환 도구 · 펼침 애니메이션 · 편집창 미리보기 구조 보기 · FolderView 적용 · 구조 보기 상태 URL 공유 · callout B안(`>> `)과 경우 제목행 문법 통합 · Phase 58 P6 긴 display 수식 접기.
