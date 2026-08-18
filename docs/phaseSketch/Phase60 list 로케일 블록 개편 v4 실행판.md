# Phase 60 — list 로케일 블록 개편: (가)·(나) / ㄱ. ㄴ. **직접 입력** + 마커 공백 정규화 · **v4 실행판**

작성: 2026-08-18 · CLI Claude(Claude Code) · 기준 커밋 **`aff3bd2`** (v2·v3와 동일, HEAD 미변동)

> **문서 성격**: **자체 완결 실행판.** v2·v3를 참조하지 않고 이 문서만으로 구현한다.
> 검증 이력: v1(web, `459cbcb` — Phase 59 이전) → v2(CLI, HEAD 재실측 · 정정 15건) → v3(web, 클론 대조 + Chromium 실측 · v2 전건 승인 + 보강 8건) → **v4(CLI, v3 재검증 · 정정 1건 + 개선 2건)**.
>
> ### v3 판정
> **G1·G3·G4·G6·G7·G8은 전건 승인**한다. Chromium 실측으로 v2의 §1.2 특이도 판정과 §0.2 결함 재현을 독립 확인해 준 것이 가장 값졌다.
> **G2는 과잉 정정이라 되돌린다(H1).** v3는 "`/shared`로 가는 클라이언트 내비게이션 경로가 없다"를 정확히 실측했지만, 그로부터 "실사용자는 항상 PrintStyles 없는 상태로 공개 뷰어를 본다 → 오정렬이 일관 재현"이라 결론했다. **틀렸다.** 같은 공개 뷰어 컴포넌트가 **앱 셸 임베드**로도 렌더되고(AppShell 723-726 → 783·791, Phase 53 E단계) 거기엔 PrintStyles가 **있다**. v2의 "진입 경로에 따라 겉모습이 달라진다"는 **결론이 옳고 메커니즘 설명만 틀렸다** — 라우트 전환이 아니라 *같은 컴포넌트의 두 렌더 환경*이다. v3 권고대로 문단을 삭제하면 사실에서 멀어진다.
> 덤으로 **결함 라우트가 하나 더 있다**: `/p/[problemId]`(실시간 공개 뷰어)도 PrintStyles가 없다. v2·v3 모두 `/shared`만 봤다.
> **G5는 v3의 "수용" 판정을 개선으로 대체한다(H2)** — `[ \t]*`로 좁히면 NBSP·전각 공백 들여쓰기가 회귀한다. 위치를 나누면 회귀 없이 규칙도 지킬 수 있다.
> **v4 자체 정정(H4)**: 그 대안으로 처음 적었던 `[ \t\u00A0\u3000]*` 열거도 **현행 `\s`보다 좁다** — en/thin space·U+202F·U+205F·U+1680·BOM·VT·FF 8종이 조용히 빠진다(node 실측). 최종안은 `[^\S\n\r]*` = "개행 아닌 공백" 하나다.

---

## 0. 요약

### 0.1 요구 2건

| # | 요구 | 비용 |
|---|---|---|
| **P1** | **직접 입력 전환** — (가)·(나) 상자에는 `(가)(나)`, ㄱ·ㄴ 상자에는 `ㄱ. ㄴ.`을 그대로 입력·저장. "국제 표준 입력 → 로케일 렌더" 가정을 버리고 **로케일 블록** 체계로 | 소 |
| **P2** | **마커 공백 정규화** — 라벨 뒤 띄어쓰기를 하건 안 하건 마커·본문 간격이 항상 같게 | 소 |

파생: **P3** proofread 마스킹 확장 · **P4** 정규식 상수 공유.

전부 **순수 클라이언트**. Firestore 규칙·서버·블록 타입 키(`gana`·`roman`) 무변경 → **데이터 영향 0**. 기존 raw_text 무수정.

### 0.2 P1을 정당화하는 현행 결함 — 라이브 코드로 재현됨

이름은 이미 한국식('(가), (나) 상자'·'ㄱ, ㄴ 상자' — [EditorView.tsx:91-92](components/editor/EditorView.tsx#L91))인데 프리셋만 국제 표준이라는 불일치가 출발점이다. 그런데 그보다 심한 것이 있다:

**지금 손으로 `(가)`를 입력하면 문단이 뭉친다.** `insertMarkerLineBreaks`는 `(a-e)`·`(i-v)`·`①-⑮`만 마커 행으로 인식하고([locale.ts:65-66](lib/locale.ts#L65)), 렌더 파이프라인에 `remark-breaks`가 없다([EditorPreview.tsx:300](components/editor/EditorPreview.tsx#L300) · [PrintableContent.tsx:126](components/print/PrintableContent.tsx#L126) = `[remarkMath, remarkGfm]`) → CommonMark soft break가 공백이 되어 연속 행이 한 문단으로 합쳐진다:

```
입력:  (가) 짝수인 경우          렌더:  (가) 짝수인 경우 (나) 홀수인 경우
      (나) 홀수인 경우                  ← 한 줄로 이어붙는다. 내어쓰기도 없다
```

v3가 `lib/locale.ts`를 컴파일해 라이브 실행으로 재현을 확인했다(리터럴 입력 → 빈 줄 삽입 0·span 0으로 무변환 통과 / 레거시 `(a)` → 빈 줄+span 분리). OCR 결과가 원래 한국 리터럴로 나오는 것([lib/ocr.ts](lib/ocr.ts))까지 감안하면 **P1은 편의 개선이 아니라 현존 결함 수정**이다. 동시에 기존 리터럴 문항의 렌더가 바뀌는 것이기도 하다 → §7.2·T14.

### 0.3 P2의 정체 — 두 원인, 두 처방

| 원인 | 증상 | 나타나는 곳 | 처방 |
|---|---|---|---|
| ① 마커 정규식이 뒤 공백을 흡수하지 않는다 | `(a) 내용`의 첫 줄이 공백 한 칸만큼 밀려 랩 라인과 **0.25em** 어긋난다 | **전 사이트 공통** | §4.1 regex |
| ② 화면용 마커 CSS가 인쇄 파일에 얹혀 있다 | 마커가 자연폭으로 렌더돼 첫 줄이 **0.8em** 어긋난다 | **독립 공개 라우트 2개** (`/shared`·`/p`) | §4.2 CSS 소유권 |

②가 이 Phase의 핵심 발견이다 → §1.2.

---

## 1. 현재 동작 — HEAD `aff3bd2` 실측

### 1.1 변환 사본 2곳

CLAUDE.md의 "locale.ts ↔ EditorPreview.tsx 동기화" 규칙이 걸리는 자리다.

| 경로 | 소비처 | 좌표 |
|---|---|---|
| `lib/locale.ts` → `lib/preprocess.ts` | **인쇄** ([PrintableContent.tsx:123](components/print/PrintableContent.tsx#L123) `preprocess()`) | 변환 함수 **119-151** · 메인 `preprocessLocale` **178-198** |
| `EditorPreview.tsx` 인라인 `preprocessLocale` | **화면 전부 — EditorPreview 소비처 10곳(전건 grep)** | **91-177** · 호출 **284** |

EditorPreview 소비처 10곳: `EditorView`(미리보기) · `TabBody`(ProblemView) · `FolderView` · `ProblemTabContent`(공개 본문) · `OutlineSections`(요약, Phase 59) · `ChoicesBlock` · `CommentEditor` · `CommentPanel` · **`PublicComments`(공개 댓글)** · `app/editor-test/page.tsx`(dev). ReactMarkdown 직접 사용은 `EditorPreview`·`PrintableContent` 둘뿐이라 다른 렌더 경로는 없다.

세부 좌표:

| 항목 | locale.ts | EditorPreview.tsx |
|---|---|---|
| `insertMarkerLineBreaks` (빈 줄 삽입 → 독립 `<p>` 보장) | **59-74** (패턴 **65-66**) | **106-119** (패턴 **110-112**) |
| gana 행 시작 → span | **121** `/^\(([a-e])\)/gm` | **144** |
| gana 행 중간 → 텍스트만 | **125** | **146** |
| giyeok 행 시작 → span | **134** `/^\((iii\|ii\|iv\|v\|i)\)/gm` | **150** |
| giyeok 행 중간 | **138** | **152** |
| 원문자 — **`[ \t]*` 흡수의 확립된 전례** | **148-151** | **154-158** |
| 헤더 "저장: 국제 표준" 철학 | **1-8** | — |

**두 사본의 정규식이 이미 문자열로 어긋나 있다**: locale.ts 65는 `/^\s*\(…\)/`, EditorPreview 111은 `/^\(…\)/.test(line.trimStart())`. 동작은 사실상 같지만 표기가 다르다 → §6에서 상수로 통일한다.

`EditorPreview`는 `locale` prop을 받지만(20·278) **284의 호출에서 참조하지 않는다** → 화면 경로는 locale 값과 무관하게 항상 ko 변환이 걸린다. 전 호출처가 `locale="ko"` 하드코딩이라 현재는 무해. **이번에도 손대지 않는다**(D7).

### 1.2 마커 CSS — 실제 캐스케이드

**시트 로드 사실** (`.css'` import 전건 grep):

| 시트 | import 지점 |
|---|---|
| `globals.css` | [app/layout.tsx:1](app/layout.tsx#L1) — **전 라우트** |
| `PrintStyles.css` | **[EditorView.tsx:51](components/editor/EditorView.tsx#L51)** · [pdfPrint.tsx:3](lib/pdfPrint.tsx#L3) · [PrintableContent.tsx:12](components/print/PrintableContent.tsx#L12) · PdfDownloadButton.tsx:6 |

전이적 import closure를 스크립트로 훑은 결과:

| 엔트리 | 파일 수 | PrintStyles 도달 |
|---|---|---|
| `components/layout/AppShell.tsx` (앱) | 123 | **도달** (EditorView:51 → AppShell:34 정적 import) |
| `app/shared/[shareId]/page.tsx` | 29 | **없음** |
| `app/p/[problemId]/page.tsx` | 36 | **없음** |

**그리고 `PrintStyles.css` 124-128은 `@media print` 밖의 전역 규칙이다** (그 블록은 **10-26**에서 닫히고 28행부터 `.print-body`가 시작한다):

```css
.marker-gana, .marker-giyeok { display:inline-block; min-width:2.5em; font-weight:600; text-indent:0 }   /* 124 */
p:has(> .marker-gana:first-child),
p:has(> .marker-giyeok:first-child) { padding-left:2.5em; text-indent:-2.5em }                           /* 125-126 */
```

`:has()`의 특이도는 인자 목록 중 최대값을 취한다(Selectors 4) → `p:has(> .marker-giyeok:first-child)` = **(0,2,1)** > [globals.css:386](app/globals.css#L386) `p:has(.marker-giyeok)` = **(0,1,1)**. **globals 381-389는 로드 순서와 무관하게 진다.**
→ v3가 두 시트를 그대로 옮긴 페이지를 Chromium으로 렌더해 독립 확인했다: giyeok 문단 `padding-left = 40px(2.5em)`(2em이 아니다) · 마커 `min-width 2.5em`·`font-weight 600`, **시트 로드 순서를 뒤집어도 동일**.

⇒ **현행 렌더 실태**:

| | **앱 셸 (편집·열람·요약·댓글 + 공개 뷰어 임베드)** | **독립 공개 라우트 `/shared`·`/p`** | **인쇄** |
|---|---|---|---|
| 적용 시트 | globals + **PrintStyles(누출)** | globals **only** | globals + PrintStyles |
| 마커 고정폭 | gana 2.5em · giyeok **2.5em** | **없음**(자연폭 gana ≈1.7em · giyeok ≈1.2em) | 2.5em · 2.5em |
| 마커 굵기 | **600** | 본문 굵기 | 600 |
| `p` 내어쓰기 | 2.5em · **2.5em** | 2.5em · **2em** | 2.5em · 2.5em |
| `(가)내용` | 정렬 맞음 | **0.8em 어긋남** | 정렬 맞음 |
| `(가) 내용` | **0.25em 어긋남 + 여분 한 칸** | 어긋남 | 0.25em 어긋남 |

### 1.2-1 같은 콘텐츠가 두 환경에서 다르게 보인다 (H1)

공개 뷰어 컴포넌트는 **두 곳에서** 렌더된다:

| 환경 | 경로 | PrintStyles | 마커 정렬 |
|---|---|---|---|
| **앱 셸 임베드** (Phase 53 E단계) | `AppShell:723-726` BazaarView `onOpenPost` → `AppShell:783` `PublicProblemView` / `791` `SnapshotView` | **있음** | 맞음 |
| **독립 라우트** | `app/p/[problemId]/page.tsx` · `app/shared/[shareId]/page.tsx` (→ MiniShell) | **없음** | **어긋남** |

BazaarView는 같은 카드에서 두 갈래로 갈린다 — `onOpenPost`가 주어지면 `<button>`(앱에서 열기), 없으면 [BazaarView.tsx:246](components/share/BazaarView.tsx#L246) `<a target="_blank">`(새 탭 = 하드 로드). PublishList도 [153](components/share/PublishList.tsx#L153) `window.open`으로 새 탭이다.

⇒ **같은 스냅샷을 "앱에서 열기"로 보면 정렬이 맞고, "새 탭"으로 보면 어긋난다.** `/shared` 라우트로 가는 클라이언트 내비게이션 경로는 없지만(v3 G2 실측 — 정확하다), 결론은 여전히 **"진입 경로에 따라 겉모습이 달라진다"**이다. 메커니즘이 라우트 전환이 아니라 *같은 컴포넌트의 두 렌더 환경*이었을 뿐이다.

`/p` 라우트는 본문(`ProblemTabContent`)뿐 아니라 **공개 댓글(`PublicComments`)**도 같은 결함을 안는다. §4.2(a)가 `.preview-content` 스코프라 셋(본문·댓글·앱 임베드)이 한 번에 정렬된다.

### 1.3 인쇄 경로 — iframe이 아니다

CLAUDE.md의 "iframe 방식 인쇄"는 **오기**다. [lib/pdfPrint.tsx:40-68](lib/pdfPrint.tsx#L40)은 숨은 div에 렌더 → `.print-root` clone → **`document.body.appendChild`** → `window.print()`. 따라서 **globals.css가 인쇄 노드에도 전부 적용**되고 PrintStyles는 특이도로만 이긴다(그래서 201-203이 `!important`를 쓴다). ⇒ "인쇄 CSS를 안 건드리니 인쇄는 안전"은 성립하지 않는다. 화면 규칙을 globals에 넣을 때 인쇄로 새지 않게 스코프해야 한다 → §4.2.

### 1.4 입력 프리셋과 소비처

```ts
// components/editor/EditorView.tsx
gana:  '(a) \n(b) \n(c) ',      // 116행
roman: '(i) \n(ii) \n(iii) ',   // 117행
```

소비처 **3곳 + 진입점 1개**: **1514-1518**(빈 텍스트 → 타입 변경, CM 뷰 직접 갱신 포함) · **1525-1527**(비텍스트 → 텍스트 계열) · **1561**(`handleAddBlock`) · `EmptyBlockChips` gana 칩(**181**, 같은 콜백). 전부 `BLOCK_PRESETS[type]` 조회 한 줄.

무변경 상수: `BLOCK_TYPE_LABELS`(82) · `BLOCK_TYPES`(101) · `TEXT_BASED_TYPES`(126) · `SPLITTABLE_TYPES`(132) · `BORDERED_TYPES`(143).

### 1.5 그 밖의 접점

- **proofread 마스킹**: [proofread.ts:59](lib/proofread.ts#L59) `/^\(([a-z]+|[ivx]+)\)\s*/` — 리터럴 미인식 → AI 교정에 노출.
- **자동 수식화 보호 목록**: `autoWrapBareNumbers` 360 · `autoWrapBareLetters` 447-448·451. `(a)`·`(i)`를 **명시 보호 목록으로 겨우** 막고 있다.
- **경우 블록 라벨**: [caseBlock.ts:96](lib/caseBlock.ts#L96) 주석 — *"행 선두 인라인 span 주입은 marker-gana·marker-circled·marker-case-sub가 쓰는 확립된 방식"* → 리터럴도 같은 전례.
- **요약 발췌**: [solutionOutline.ts:55-57](lib/solutionOutline.ts#L55) `SCANNED_TYPES`에 `gana`·`roman` 포함 → `**…**`만 발췌(기존 한계, §7.3-1).
- **저장 정형화**: `toPersistedBlock` — 수식 여백 정규화 + 앞뒤 빈 줄 트림뿐, 마커 무관 ✓
- **AI 프롬프트**: `app/api/` 전건 grep — 마커 표기 지시 없음 ✓
- **Phase 58 톤**: `.tone-baseline`(255-256) · `.problem-content-toned`(259-263) · `.solution-tone.has-key`(279-282) · key 복귀(285~). **마커 span을 겨냥한 색·굵기 규칙은 어디에도 없다**(전건 grep) → `font-weight: inherit`가 dim 상태까지 본문 톤을 정확히 따른다.
- **`lib/caseBlock.ts`는 import가 0건**이다 → `locale.ts` → `caseBlock.ts`에서 체인이 끝난다(`keyTone`은 딸려오지 않는다). `locale.ts`는 순수 함수·브라우저 API 0건 → §6의 상수 공유는 SSR·번들에 무해.

---

## 2. 공통 원칙

1. **raw_text 불변** — span 주입은 렌더 단계 전용. 바뀌는 것은 "새로 입력되는 원문이 무엇이냐"(D1)뿐이다.
2. **위치에 따라 공백 클래스를 나눈다** (H2·H4 — Phase 57 규칙의 정확한 적용). 규칙의 실체는 "`\s`가 **개행**을 삼킨다"이므로, 개행만 배제하면 나머지를 좁힐 이유가 없다:
   - **행 선두 들여쓰기 판정** → **`[^\S\n\r]*`** = "개행 아닌 공백". 현행 `\s*`/`trimStart()`와 **문자 집합이 정확히 동등**하고(node 실측), 개행 배제가 정규식에 박혀 있어 `/gm` 컨텍스트로 재사용해도 안전하다
   - **마커 뒤 공백 흡수** → **`[ \t]*`** (원문자 148-151의 확립된 전례). 흡수 대상이므로 범위를 넓힐 이유가 없다

   > ⚠ `[ \t\u00A0\u3000]*`처럼 **열거하면 현행보다 좁아진다** — `\s`에 속하는 en/thin space(U+2002·2009)·U+202F·U+205F·U+1680·BOM·VT·FF 8종이 빠져 리팩터 커밋이 무회귀가 아니게 된다(H4).

3. **불변식: 마커 고정폭 = 그 사이트의 `p` 내어쓰기 폭.** 이것만 지키면 값(화면 gana 2.5em / 화면 giyeok 2em / 인쇄 2.5em)은 사이트별로 달라도 된다.
4. **시트 소유권** — 화면 규칙은 `globals.css`가 `.preview-content` 스코프로, 인쇄 규칙은 `PrintStyles.css`가 `.print-body` 접두로. §1.3 때문에 양방향 격리가 필요하다.
5. **변환 순서 무관성** — 레거시 변환이 끝난 행은 `<span class="marker-…">`로 시작해 리터럴 패턴에 두 번 걸리지 않는다. **멱등**(v3가 라이브 실행으로 확인, L9로 고정).

---

## 3. P1 — 직접 입력 전환

### 3.1 프리셋 교체 ([EditorView.tsx:116-117](components/editor/EditorView.tsx#L116))

```ts
gana:  '(가) \n(나) \n(다) ',
roman: 'ㄱ. \nㄴ. \nㄷ. ',
```

라벨·드롭다운·칩·집합 3종 무변경. 타입 키 불변 → 데이터·Undo·버전·export 영향 0. trailing space는 원문자 프리셋(`'① '`)과 같은 관용구로 유지하고 §4.1이 무해화한다(D6).

### 3.2 리터럴 인식 (사본 2곳)

배치: `preprocessLocale` 3단계 안, `convertRomanList` 뒤 · `convertCircledList` 앞 → locale.ts는 **189행과 190행 사이**, EditorPreview는 **152행 뒤·154행 앞**. `locale !== 'ko'` 조기 반환 **안쪽**이라 로케일 블록 철학 유지(L12).

```ts
/** (가)~(차) 리터럴 → 행 시작 marker span. 행 중간은 이미 리터럴이라 변환 불필요 */
function convertGanaLiteral(text: string): string {
  return text.replace(new RegExp(GANA_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-gana">(${ch})</span>`);
}
/** ㄱ.~ㅊ. 리터럴 → 행 시작 marker span */
function convertGiyeokLiteral(text: string): string {
  return text.replace(new RegExp(GIYEOK_LITERAL_RE.source, 'gm'),
    (_, ch) => `<span class="marker-giyeok">${ch}.</span>`);
}
```

정규식은 §6의 공유 상수. `/g` 인스턴스는 `lastIndex`가 남으므로 `.source`로 새로 만든다 — [solutionOutline.ts:72](lib/solutionOutline.ts#L72)의 관용구. 렌더 결과가 레거시와 **완전히 같은 마크업**이라 CSS·내어쓰기·인쇄가 전부 자동 적용된다.

### 3.3 범위는 10개

| | 레거시 (매핑 테이블 有) | 리터럴 (매핑 無) |
|---|---|---|
| gana | `(a)`~`(e)` **5개 고정** | `(가)`~`(차)` **10개** |
| giyeok | `(i)`~`(v)` **5개 고정** | `ㄱ.`~`ㅊ.` **10개** |

5개 상한은 `GANA`/`GIYEOK` 테이블([locale.ts:18-24](lib/locale.ts#L18)) 크기의 유산이고 리터럴엔 테이블이 없다. 상한을 남기면 `(바)`를 쓴 사용자가 **그 줄만 내어쓰기가 빠지는 조용한 결함**을 디버깅해야 한다.

코드포인트 확인: `가`=U+AC00 계열 완성형 · `ㄱ`=U+3131 계열 **호환 자모**(= `GIYEOK` 테이블 값과 동일).

**알려진 오탐 하나**: `(사)`(사단법인). 행 **선두**에 와야 하고 피해는 그 줄의 내어쓰기뿐(데이터 불변·즉시 가시)이라 수용한다 — 범위를 좁혀 생기는 조용한 결함보다 낫다. v3도 같은 결론(코퍼스 확인은 Firestore 접근 불가라 양측 모두 불가). 착수 후 실사용에서 오탐이 보이면 범위 축소는 코드 1줄이다.

### 3.4 `insertMarkerLineBreaks` 확장 (사본 2곳)

§0.2의 문단 뭉침을 해소하는 핵심 한 걸음. 두 사본을 **문자 단위로 같은 형태**로 통일한다.

```ts
const isMarkerLine = MARKER_LINE_RE.test(line);   // §6 공유 상수
```

- locale.ts 65-66 두 줄 → 상수 한 줄. EditorPreview 110-112(`line.trimStart()` 변형)도 같은 상수로 대체.
- 들여쓰기 클래스는 **`[^\S\n\r]*`** (§2-2). 현행 `\s*`/`trimStart()`와 문자 집합이 동등하므로 **무회귀**다. `[ \t]*`로 좁히면 NBSP·전각 공백 들여쓰기 문항에서 문단 분리가 회귀하고, 열거형(`[ \t\u00A0\u3000]*`)도 8종이 빠져 마찬가지다(H4).
- 결과: 리터럴 프리셋 3행이 레거시와 똑같이 각각 독립 `<p>`가 되고 내어쓰기가 행마다 걸린다.

### 3.5 레거시 공존 (D5)

`convertAlphaList`·`convertRomanList`·행 중간 치환·매핑 테이블 전부 유지. 기존 (a)/(i) 문항의 렌더는 §4.1의 공백 흡수로 인한 **간격 균일화만** 달라진다(T5에서 "의도된 개선"으로 승인 후 통과). 마이그레이션 도구는 만들지 않는다.

[locale.ts 헤더 1-8](lib/locale.ts#L1) 철학 교체:

```
 * 저장: 작성 로케일의 표기를 그대로 (한국 문항 → (가)(나), ㄱ.ㄴ. 리터럴)
 *       — 국제 표준으로의 역변환은 하지 않는다
 *       (Phase 60 D1: "글로벌 통일을 버리고 로케일 블록으로" — 덕수 확정)
 * 표시: 레거시 국제 표기((a)/(i))는 여전히 (가)/ㄱ.로 변환해 옛 문항 호환을 유지
```

---

## 4. P2 — 마커 공백 정규화 + CSS 소유권 정리

### 4.1 정규식 측 (사본 2곳)

```ts
ALPHA_LINE_RE = /^\(([a-e])\)[ \t]*/         // locale.ts 121 · EditorPreview 144
ROMAN_LINE_RE = /^\((iii|ii|iv|v|i)\)[ \t]*/ // locale.ts 134 · EditorPreview 150
```

리터럴 2종은 §3.2 상수에 내장. **행 중간 치환은 손대지 않는다** — 문장 속 인용(`…조건 (가)에 의해…`)의 공백은 유의미하다.

- `(a)내용` / `(a) 내용` / `(a)  내용`이 **완전히 같은 HTML**이 된다.
- 프리셋의 trailing space는 `<p><span/></p>`가 된다 — 원문자 프리셋이 Phase 57부터 그 상태라 **전례 그대로, 겉모습 변화 없음.**
- locale.ts 122-123·135-136의 `korean ? … : (${ch})` 폴백은 alternation이 테이블 전건을 덮어 **도달 불가**다(v3 확인). 그대로 두고 주석 한 줄로 명시.

### 4.2 CSS 측 — 소유권 정리

#### (a) `app/globals.css` 381-389 → `.preview-content` 스코프 + 마커 고정폭 신설

```css
/* ═══ (가)(나) · ㄱ.ㄴ. 마커 — 화면 (Phase 60 P2) ═══
   이 규칙들은 지금까지 PrintStyles.css 124-128에 있었고, EditorView.tsx:51이 그 파일을
   import하는 덕에 "우연히" 앱 화면에도 걸려 있었다. 독립 공개 라우트(/shared·/p)는
   PrintStyles를 부르지 않아 규칙이 빠져 첫 줄이 0.8em 어긋났다 — 같은 스냅샷이
   "앱에서 열기"와 "새 탭"에서 다르게 보이던 원인이다.
   → 화면은 globals가 .preview-content 스코프로, 인쇄는 PrintStyles가 .print-body
     접두로 소유한다. 인쇄 노드는 document.body에 직접 붙으므로(iframe이 아니다)
     스코프가 없으면 화면 규칙이 인쇄로 샌다.
   ⚠ min-width는 반드시 아래 p 내어쓰기 폭과 같은 값이어야 한다.
   ⚠ text-indent:0 — p의 내어쓰기(-2.5em)가 inline-block 안쪽 첫 줄에 재적용되는 것을
     막는 가드. .marker-circled(392-397)의 확립된 전례이고, CLAUDE.md "글자 주위에
     상자를 두르지 말 것"의 예외 사유가 정확히 이 가드다(Phase 57 P5는 가드가 없어 깨졌다). */
.preview-content .marker-gana,
.preview-content .marker-giyeok {
  display: inline-block;
  text-indent: 0;
  /* D8′ — 화면 마커는 본문과 같은 굵기. PrintStyles에서 새어 들어와 화면에도 걸려 있던
     font-weight:600을 명시적으로 되돌린다. 인쇄만 600을 유지한다(의도된 예외).
     Phase 58 톤 시스템은 마커 span을 겨냥한 규칙이 없어 inherit가 dim 상태까지 따라간다. */
  font-weight: inherit;
}
.preview-content .marker-gana   { min-width: 2.5em; }
.preview-content .marker-giyeok { min-width: 2em; }   /* D4′ — `ㄱ.`이 `(가)`보다 좁다 */

.preview-content p:has(.marker-gana)   { padding-left: 2.5em; text-indent: -2.5em; }
.preview-content p:has(.marker-giyeok) { padding-left: 2em;   text-indent: -2em;   }
```

`.preview-content`는 [EditorPreview.tsx:465](components/editor/EditorPreview.tsx#L465)의 루트 클래스이고 `borderless` 여부와 무관하게 항상 붙는다(v3 G6) → 화면 마커의 **100%**가 스코프 안이다. 소비처 10곳 전부 + 앱 셸 임베드 + 독립 라우트가 한 규칙으로 정렬된다. 인쇄는 자체 ReactMarkdown이라 이 클래스가 없다.

#### (b) `PrintStyles.css` 124-126에 `.print-body` 접두

```css
.print-body .marker-gana, .print-body .marker-giyeok
  { display:inline-block; min-width:2.5em; font-weight:600; text-indent:0; }
.print-body p:has(> .marker-gana:first-child),
.print-body p:has(> .marker-giyeok:first-child)
  { padding-left:2.5em; text-indent:-2.5em; }
```

**인쇄 산출물 완전 불변**: 값 동일 + `.print-body`는 [PrintableContent.tsx:58](components/print/PrintableContent.tsx#L58)의 유일 래퍼(선택지 포함 전 블록)이고, 특이도가 (0,1,0)→(0,2,0)·(0,2,1)→(0,3,1)로 올라가 globals를 계속 이긴다. 인쇄 시 `body > *:not(.print-root){display:none}`(PrintStyles 21)이 앱 트리를 치므로 간섭도 없다(v3 G8).

#### (c) `.marker-circled`(PrintStyles 127-128)는 손대지 않는다 — D11

같은 누출이지만 [globals.css 392-402](app/globals.css#L392)가 동일 값 + `!important`로 이미 이겨 **관측 차이가 0**이고, 인쇄 쪽은 그 `!important`를 이기려 201-203이 다시 `!important`를 쓰는 구조다. 여기를 건드리면 Phase 57~59의 원문자 여백 체계가 흔들린다 → **범위 밖**, 부록 C-1로 이월.

#### (d) 인쇄 선택자의 `:first-child` 형태 유지 — D14

인쇄는 `p:has(> .marker-gana:first-child)`(자식+first-child), 화면은 `p:has(.marker-gana)`(후손)로 형태가 다르다. **매칭이 갈리는 DOM은 실존한다** — `<p><em>x</em> <span class="marker-gana">…</span></p>`는 후손형에만 걸린다(v3가 Chromium으로 확인: 텍스트 노드는 `:first-child` 판정에 무관, **요소**가 가른다). 그러나 **전처리 산출물에서는 만들어지지 않는다**: span은 오직 `^` 행 시작 치환으로만 생기고, `insertMarkerLineBreaks`가 마커 행 앞에 빈 줄을 보장해 그 행이 항상 문단 첫머리가 된다(경우 제목행·blockquote·리스트 항목은 `^\(` 불일치로 span 자체가 안 생긴다 → §7.3-3·4). 인쇄 산출물 보존이 우선이므로 **현행 형태 유지**하고 이 문장을 주석으로 남긴다.
※ 보증의 전제: 사용자가 raw_text에 `<span class="marker-gana">`를 직접 쓰는 경우는 커버하지 않는다(rehypeRaw 허용의 일반 한계).

### 4.3 목표 동작

| 입력 | 앱 셸 (편집·열람·요약·댓글·공개 임베드) | 독립 공개 라우트 `/shared`·`/p` | 인쇄 |
|---|---|---|---|
| `(가)내용` | 본문 = 2.5em 정렬 | **정렬(신규 수정)** | 2.5em 정렬 |
| `(가) 내용` / `(가)  내용` | **좌동** (공백 흡수) | 좌동 | 좌동 |
| `ㄱ.내용` / `ㄱ. 내용` | 본문 = 2em 정렬 | **정렬(신규 수정)** | 2.5em 정렬 |
| 연속 3행 리터럴 | 각각 독립 `<p>` + 내어쓰기 (**신규 수정**) | 좌동 | 좌동 |
| 행 중간 `…조건 (가)에…` | 그대로 | 그대로 | 그대로 |
| 마커 굵기 | **본문과 같게** (600 → inherit) | 본문과 같게 | 600 유지 |

---

## 5. P3 — proofread 마스킹 확장 ([proofread.ts:59](lib/proofread.ts#L59))

```ts
const markerMatch = text.slice(i).match(
  /^(?:\(([a-z]+|[ivx]+)\)|\((?:가|나|다|라|마|바|사|아|자|차)\)|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.)[ \t]*/
);
```

- 범위 10개 반영 + `\s*` → `[ \t]*`. `\s*`는 개행을 삼켜 `(가)`↵`(나)`처럼 **내용 없는 마커 행이 이어질 때 둘째 마커의 라인 선두 판정을 건너뛴다** — 새 프리셋이 정확히 그 형태다. (여기는 `.slice(i)` 위의 `/gm` 없는 매칭이지만 `\s*`가 개행을 소비해 `i`를 다음 줄 안쪽으로 밀어버린다 → `atLineStart` 판정이 깨진다.)
- placeholder push·복원 로직 무변경. 캡처 그룹 `([a-z]+|[ivx]+)`는 아무도 읽지 않으므로 리터럴 분기에 캡처를 두지 않아도 무해.
- **부수 이득**: `autoWrapBareLetters`가 `(a)`·`(i)`를 명시 보호 목록으로 겨우 막고 있었는데, 한글 리터럴은 `[A-Za-z0-9]`가 아니라 **애초에 자동 수식화 대상이 아니다** → P1이 이 위험군을 구조적으로 없앤다. 보호 목록(447-451)은 레거시용으로 **그대로 유지**.

---

## 6. P4 — 사본 이격 지점 축소

리터럴을 넣으면 "문자 단위로 같아야 하는 정규식"이 2쌍 → 4쌍이 된다. **정규식만** locale.ts의 export 상수로 뽑고 EditorPreview가 import한다.

```ts
// lib/locale.ts — 신설 export.
// /g 없이 정의하고 소비처가 new RegExp(RE.source, 'gm')로 인스턴스를 만든다
// (lastIndex 오염 차단 — solutionOutline.ts:72와 같은 처방).

/** 행 선두 들여쓰기 = "개행 아닌 공백". 현행 \s*·trimStart()와 문자 집합이 정확히 동등해
 *  무회귀이고, 개행 배제가 클래스 자체에 박혀 있어 /gm 컨텍스트로 재사용해도 안전하다.
 *  ⚠ [ \t\u00A0\u3000] 식으로 열거하면 \s보다 좁아진다(en/thin space·BOM 등 8종 누락). */
const IND = '[^\\S\\n\\r]*';

export const MARKER_LINE_RE = new RegExp(
  `^${IND}(?:\\((?:iii|ii|iv|v|i|[a-e])\\)` +
  `|\\((?:가|나|다|라|마|바|사|아|자|차)\\)` +
  `|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\\.` +
  `|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])`
);

/** 아래 4개는 /gm 치환용 — 뒤 공백은 [ \t]*만. \s*는 개행을 먹어 문단을 뭉친다. */
export const ALPHA_LINE_RE       = /^\(([a-e])\)[ \t]*/;
export const ROMAN_LINE_RE       = /^\((iii|ii|iv|v|i)\)[ \t]*/;
export const GANA_LITERAL_RE     = /^\((가|나|다|라|마|바|사|아|자|차)\)[ \t]*/;
export const GIYEOK_LITERAL_RE   = /^([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.[ \t]*/;
export const CIRCLED_NUM_LINE_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])[ \t]*/;
```

> 이름은 `CIRCLED_NUM_LINE_RE`로 한다 — locale.ts에 이미 `CIRCLED_CONSONANTS`(㉠㉡㉢)가 있어 `CIRCLED_*`만으로는 혼동된다.

**함수 통합은 하지 않는다(D12).** EditorPreview 인라인 `preprocessLocale`(91-177)은 locale.ts 판본과 단계 순서·`locale` 게이트 유무가 다르고 화면 전 사이트의 렌더 회귀 위험이 있다. 정규식만 공유하면 **이번 변경으로 늘어나는 이격 위험은 0**이 되고 통합은 별 Phase로 미룰 수 있다.

`locale.ts`는 순수 함수·브라우저 API 0건이고 `caseBlock.ts`는 import가 0건이라 체인이 거기서 끝난다 → EditorPreview(`'use client'`)가 import해도 서버 경계·번들에 문제가 없다(v3 G4).

EditorPreview 91행 위 주석 신설:
```
/* 정규식은 lib/locale.ts의 export 상수를 쓴다 (Phase 60 P4).
   단계 순서·locale 게이트 유무는 아직 사본이며 통합은 미정 (부록 C-3).
   ⚠ locale prop(20·278)은 284 호출에서 참조되지 않는다 — 두 번째 로케일 착수 시 살릴 지점. */
```

---

## 7. 파급 검토 · 후방 호환 · 알려진 한계

### 7.1 전 경로 파급

| 경로 | 판정 | 근거 |
|---|---|---|
| 버전 시스템 (snapshot·canonicalize·diff·prune) | **무영향·개선** | raw_text 무해석(grep 0건). diff·버전 기록이 한국 리터럴이라 읽기 쉬워진다 |
| `blocks/normalize.ts` `toPersistedBlock` | **무영향** | 수식 여백 정규화 + 앞뒤 빈 줄 트림뿐 |
| GitHub export (`exportMd`) | **무영향·개선** | raw_text 그대로 아카이브 |
| OCR (`lib/ocr.ts`) | **개선** | 한국 문항 결과가 원래 리터럴 → 지금은 뭉치는데(§0.2) 본 Phase 후 자동 적용 |
| AI 교정 (proofread) | §5로 해소 | 확장 전엔 리터럴 마커가 교정 대상에 노출 |
| AI discuss · ai-complete | **무영향** | 마커 표기 지시 없음 |
| `latex-linter` | **무영향** | 수식 내부 전용 |
| `search-highlight` · FindReplace | **무영향** | CodeMirror `raw_text` 대상(Decoration) |
| 요약 보기 (`solutionOutline`) | **무영향** (기존 한계 유지) | §7.3-1 |
| 목록(①)·choices·callout·case/subcase·rail | **무영향** | 별도 파이프라인·마커 무관. `.case-block` 형제 인접·padding 규칙 미접촉 |
| Undo/Redo · 블록 분할 | **무영향** | 프리셋 소비처 3곳 모두 문자열 조회 한 줄 |
| Firestore rules | **무영향** | 블록 type 화이트리스트 없음 |
| `data-math-id` 매핑 | **무영향** | span 주입은 수식 개수·순서 불변 |
| **인쇄 산출물** | **불변** | §4.2(b) 특이도 + PrintStyles 21의 앱 트리 차단. T4로 전/후 PDF 대조 |
| Phase 58 톤 시스템 | **정합** | 마커 span을 겨냥한 색·굵기 규칙 0건(전건 grep) → `inherit`가 dim 상태까지 본문 톤을 따른다 |
| **공개 뷰어 2라우트 + 앱 임베드** | **수정 대상** | §1.2-1. `.preview-content` 스코프로 셋이 한 번에 정렬 |

### 7.2 후방 호환 — 기존 콘텐츠의 렌더가 바뀌는 경우가 하나 있다

이미 리터럴 `(가)`·`ㄱ.`이 들어 있는 문항(손입력·OCR)은 지금 §0.2대로 **뭉쳐서** 렌더된다. 본 Phase 후에는 독립 문단 + 내어쓰기로 바뀐다.

- **판정: 개선.** 현재 모습(`(가) 짝수 (나) 홀수`가 한 줄)은 어떤 의도로도 정당화되지 않는다.
- **raw_text는 불변**이므로 되돌리기는 코드 되돌리기 한 번이고 데이터 손실 경로가 없다.
- **T14로 명시 확인**한다.

### 7.3 알려진 한계 (문서화하고 고치지 않음)

1. **요약 발췌에 마커가 없다** — `SCANNED_TYPES`에 gana·roman이 있어 `**…**`만 발췌한다. `(가) **핵심**`을 쓰면 요약에 `(가)`가 빠진다. Phase 59 기존 동작.
2. **행 선두 공백** — `  (가) 내용`은 레거시 `(a)`와 마찬가지로 span이 붙지 않는다(치환 regex는 `^\(` 고정). `MARKER_LINE_RE`만 걸려 **문단 분리는 되고 내어쓰기만 빠진다.** NBSP·전각 공백도 §2-2 덕에 문단 분리까지는 동일하게 동작한다.
3. **마커를 굵게 감싼 경우** — `**(가) 핵심**`은 행이 `*`로 시작해 span이 아예 안 생긴다(내어쓰기 없음). `(가) **핵심**`은 정상. 사용 가이드에 한 줄 필요(부록 C-7).
4. **경우 블록 제목행** — `injectCaseLabel`이 라벨 span을 먼저 앞에 붙이므로 제목행이 `(가)`로 시작해도 `^`에 걸리지 않는다. 레거시도 동일. 제목행은 조건 문장이라 실사용 영향 없음.
5. **NFD 분해형** — 리터럴은 호환 자모(U+3131…)·완성형(U+AC00…) 기준이다. 외부에서 붙여넣은 텍스트가 Hangul Jamo 초성(U+1100…)이나 NFD 분해형이면 매칭되지 않는다. 방어 비용(전역 `normalize()`)이 원문 변경을 수반하므로 **검증 항목(T11)으로만** 둔다.

---

## 8. 결정표

| # | 결정 | 판정 | 근거 |
|---|---|---|---|
| **D1** | 저장 철학 | **리터럴 저장 공식 채택**, 마이그레이션 없음 | 덕수 확정. 이중 유지는 변환층이 하나 더 생겨 요구의 취지(직관성)를 깬다 |
| **D2** | 리터럴 인식 스코프 | **전역**(모든 텍스트 계열 블록의 행 시작) | 레거시 (a)와 동일 스코프. blockType 배선 불필요 |
| **D3** | 공백 정규화 방식 | **regex가 `[ \t]*` 흡수 + CSS 고정폭** | 원문자 148-151·인쇄 124의 확립된 전례 |
| **D4′** | 화면 마커 고정폭 | **gana 2.5em / giyeok 2em** | 덕수 B 확정. §2-3 불변식. 앱 giyeok이 2.5em→2em으로 좁아진다(의도) |
| **D5** | 레거시 (a)/(i) | **유지** | 리터럴 패턴과 겹치지 않아 공존 무해 |
| **D6** | 프리셋 trailing space | **유지** | 원문자 프리셋과 동일 관용구, §4.1로 무해화 |
| **D7** | 로케일 추상화 | **이번엔 없음** — `locale` prop 미사용도 주석만 | 사용처 1곳뿐인 추상화는 YAGNI |
| **D8′** | 화면 마커 굵기 | **`font-weight: inherit`** — 인쇄만 600 | 덕수 B 확정. 취지("별도 강조는 부담스럽다") 실현에는 명시 변경이 필요했다 |
| **D9** | 리터럴 범위 | **10개** (가~차 / ㄱ~ㅊ) | 5개 상한은 매핑 테이블의 유산. v2·v3 동일 결론 |
| **D10** | CSS 소유권 | **화면 = globals `.preview-content` / 인쇄 = PrintStyles `.print-body`** | PrintStyles 118 주석의 기존 규약. 인쇄가 iframe이 아니므로 양방향 스코프 필요 |
| **D11** | `.marker-circled` 누출 | **범위 밖** | globals `!important`가 덮어 관측 차이 0 |
| **D12** | 사본 통합 범위 | **정규식 상수만 공유** | 이격 증가분을 0으로 만들면서 회귀 위험을 지지 않는다 |
| **D13** | 회귀 하니스 | **`npm run test:locale` 신설** | locale.ts는 테스트가 없다. Phase 59 `test:case` 전례 |
| **D14** | 인쇄 선택자 형태 | **`:first-child` 유지** | 갈리는 DOM은 실존하나 **파이프라인 산출물에서는 도달 불가**(§4.2d). 인쇄 산출물 보존이 우선 |
| **D15** | 들여쓰기 공백 클래스 | **판정 위치별로 분리** — 행 선두 `[^\S\n\r]*` / 뒤 공백 `[ \t]*` | **신설(H2·H4)**. `[ \t]*` 통일은 NBSP·전각 공백을, 열거형은 `\s` 소속 8종을 회귀시킨다. `[^\S\n\r]*`는 현행과 동등하면서 개행만 배제한다 |

---

## 9. 검증

### 9.1 `npm run test:locale` (신설)

```json
"test:locale": "tsc lib/locale.ts --outDir .test-build --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/locale.test.mjs"
```
locale.ts가 `caseBlock.ts`의 `LEGACY_CASE_RE`를 import하므로(10행) tsc가 따라 컴파일한다 — `test:case`가 검증한 경로다.

| # | 케이스 |
|---|---|
| L1 | 리터럴 gana 행 시작 → `<span class="marker-gana">(가)</span>`; 공백 **0·1·2칸 출력 동일** |
| L2 | 리터럴 giyeok 동일 |
| L3 | 확장 범위 `(바)`~`(차)` · `ㅂ.`~`ㅊ.` 인식 |
| L4 | 범위 밖 `(카)` · `ㅋ.` **무변환** |
| L5 | 행 중간 `조건 (가)에` · `…ㄱ. 참조` **무변환** |
| L6 | 레거시 `(a)`~`(e)` / `(i)`~`(v)` 무회귀 + `[ \t]*` 흡수 |
| L7 | 레거시 범위 밖 `(f)` · `(vi)` 무변환 유지 |
| L8 | `MARKER_LINE_RE`가 리터럴 프리셋 3행을 각각 분리 (§0.2 결함 회귀 방지) |
| L9 | **멱등성** `preprocessLocale(preprocessLocale(x)) === preprocessLocale(x)` |
| L10 | 수식 안 `$(a)$` · `$$ㄱ.$$` 보호(⟦MATH_n⟧) |
| L11 | 원문자 밭 · `\tag`/`\ref` · Fig./Table 무회귀 |
| L12 | `locale: 'international'`이면 리터럴도 무변환 |
| **L13** | **`\s` 소속 공백 전종(space·tab·NBSP·U+3000·en/thin·U+202F·U+205F·U+1680·BOM·VT·FF) 들여쓰기 마커 행이 문단 분리** — 현행 `\s*`와 동등함을 고정 (D15 회귀 방지) |
| **L14** | `[ \t]*` 자리에 개행이 오면 먹지 않는다 — `(가)\n\n다음` 문단 경계 보존 |

### 9.2 수동 검증

| # | 항목 |
|---|---|
| **T1** | **입력 동등성**: `(가)내용` / `(가) 내용` / `(가)  내용` → 화면 전 사이트 + 인쇄에서 픽셀 동일. ㄱ. 계열 동일 |
| **T2′** | **공개 뷰어 수정 — 3환경 대조**: 같은 스냅샷을 ① `/shared/<id>` 하드 로드 ② `/p/<id>` 하드 로드 ③ BazaarView "앱에서 열기"(앱 셸 임베드)로 열어 **마커 정렬이 셋 다 같은지**. ②에서는 **공개 댓글(PublicComments)**의 마커까지 확인 |
| **T3** | **내어쓰기 정렬**: 두 줄 넘는 항목에서 첫 줄 본문 시작점 = 랩 라인 시작점 (화면 gana 2.5em·giyeok 2em / 인쇄 2.5em) |
| **T4** | **인쇄 무변화**: 같은 문항으로 전/후 PDF를 뽑아 마커 폭·굵기·내어쓰기 동일 확인 |
| **T5** | **레거시 회귀**: 기존 (a)/(i) 문항 → 변환·5개 상한·행 중간 인용 전부 현행과 동일. 간격 균일화는 **의도된 개선**으로 승인 후 통과 |
| **T6** | **프리셋 4경로**: 신규 블록 추가(1561) · 빈 텍스트→타입 변경(1514) · 이미지→텍스트 계열(1525) · `EmptyBlockChips` gana 칩(181) |
| **T7** | **요약 보기**: gana 블록의 `**` 발췌에 마커가 빠지는 것(§7.3-1) 스펙 확인. 경우 블록·rail 무회귀 |
| **T8** | **proofread**: 마커 행이 AI 교정 결과에서 원형 보존. **내용 없는 연속 마커 행에서 둘째 마커까지** 마스킹 |
| **T9** | **회귀 없음**: ① 원문자·목록·choices·callout·case(Phase 54/59)·수식 보호·요약 스위치 |
| **T10** | **사본 동기화**: 공유 상수 6개를 EditorPreview가 import하고 자체 리터럴이 남지 않았는지 grep |
| **T11** | **정규화 스팟체크**: HWP·외부에서 붙여넣은 문항 2~3건에서 마커가 인식되는지 (§7.3-5). NBSP 들여쓰기 포함 |
| **T12** | **`[data-noscroll]` 경고 없음** — CSS 변경이 세로 overflow를 만들지 않는지 dev 콘솔 |
| **T13** | **D8′·D4′ 의도된 변화**: 앱 화면 마커 굵기가 본문과 같아졌고 `ㄱ.` 내어쓰기가 2em인지. **동시에 인쇄는 600·2.5em 유지**(T4와 짝) |
| **T14** | **후방 호환**: 리터럴이 이미 들어 있는 기존 문항 → 뭉쳐 있던 문단이 독립 문단 + 내어쓰기로 바뀐 것 확인(§7.2). 의도된 개선으로 승인 |

---

## 10. 실행 계획

### 10.1 커밋 6분할 (각 단계 독립 롤백 가능)

| # | 커밋 | 파일 | 동작 변화 |
|---|---|---|---|
| 1 | `Phase 60 P4: 마커 정규식을 locale.ts 공유 상수로` | locale.ts(상수 신설 + 65-66·121·134 교체) · EditorPreview(110-112·144·150 교체 + 91 주석) | **0** (순수 리팩터 — D15의 `[^\S\n\r]*`가 현행 `\s*`와 문자 집합 동등. L13이 이를 고정한다) |
| 2 | `Phase 60 P1: (가)·ㄱ. 직접 입력` | EditorView 116-117 · locale.ts(리터럴 2함수 + 189/190 사이 배치 + 헤더 1-8) · EditorPreview(152 뒤 삽입) | 프리셋·리터럴 인식·문단 분리 |
| 3 | `Phase 60 P2: 마커 뒤 공백 흡수` | (1에서 이미 상수에 반영 → 이 커밋은 2와 합칠 수 있다) | 간격 균일화 |
| 4 | `Phase 60 P2: 마커 CSS 소유권 분리 (화면 globals / 인쇄 print-body)` | globals 381-389 · PrintStyles 124-126 | **T2′·T4·T13 대상** |
| 5 | `Phase 60 P3: proofread 리터럴 마커 마스킹` | proofread.ts 59 | AI 교정 보호 |
| 6 | `Phase 60: test:locale 하니스 · 문서` | tests/locale.test.mjs · package.json · CLAUDE.md · roadmap.md | — |

> 3번은 `[ \t]*`가 §6 상수에 들어 있어 1번에서 이미 자리를 잡는다. 실제로는 **1에 흡수하거나 2와 합쳐 5커밋**이 자연스럽다 — 착수 시 판단.

### 10.2 착수 전 재확인

- `git log -1`이 `aff3bd2`에서 움직이지 않았으면 부록 A 좌표를 그대로 쓴다. 움직였으면 좌표만 재실측한다.
- 수정 후 `npm run dev` 재시작. **dev 중 `npm run build` 금지**(기존 규칙).

### 10.3 덕수가 눈으로 확인할 겉모습 변화 3건

1. **앱 마커** 굵기가 본문과 같아지고 `ㄱ.` 내어쓰기가 2em으로 좁아진다 (T13)
2. **공개 뷰어 정렬 수정** — `/shared`·`/p` 본문 + `/p` 댓글이 앱 임베드와 같아진다 (T2′)
3. **리터럴이 이미 든 기존 문항**의 뭉침이 풀린다 (T14)

나머지는 무변화다. **인쇄 PDF는 전/후 동일해야 한다** — 다르면 §4.2(b)를 되돌린다.

---

## 부록 A — 수정 파일·좌표 (`aff3bd2`)

| 파일 | 변경 |
|---|---|
| `lib/locale.ts` | 공유 상수 6개 + `IND`(= `[^\S\n\r]*`) 신설(§6) · 리터럴 변환 2함수 + **189/190 사이** 배치(§3.2) · `insertMarkerLineBreaks` **65-66** → `MARKER_LINE_RE`(§3.4) · 레거시 regex **121·134** 상수화 + `[ \t]*`(§4.1) · 헤더 **1-8** 철학 갱신(§3.5) · 폴백 도달 불가 주석(§4.1) |
| `components/editor/EditorPreview.tsx` | **110-112** → `MARKER_LINE_RE` · **144·150** → 공유 상수 · 리터럴 2단계 **152 뒤·154 앞** 삽입 · **91** 위 사본 범위 주석(§6) |
| `components/editor/EditorView.tsx` **116-117** | 프리셋 2줄 교체 (§3.1) |
| `app/globals.css` **381-389** | `.preview-content` 스코프 + `.marker-gana`·`.marker-giyeok` 고정폭·`font-weight:inherit` 신설 (§4.2a) |
| `components/print/PrintStyles.css` **124-126** | `.print-body` 접두 (§4.2b). **127-128(circled) 미접촉**(D11) |
| `lib/proofread.ts` **59** | 리터럴 2종 + 범위 10개 + `\s*`→`[ \t]*` (§5) |
| `tests/locale.test.mjs` · `package.json` | `test:locale` 하니스 (§9.1, L1~L14) |
| `CLAUDE.md` | ① 전처리 절에 리터럴 마커 ② **"PrintStyles.css는 화면에도 로드된다(EditorView:51) → 인쇄 전용 규칙은 `.print-body` 접두 필수"** ③ **"인쇄는 iframe이 아니라 `document.body`에 노드를 붙인다"**(기존 기술 정정) ④ 저장 철학(D1) ⑤ 사본 동기화 규칙에 "정규식은 locale.ts 상수 공유" ⑥ **"공개 뷰어는 앱 셸 임베드와 독립 라우트(`/shared`·`/p`) 두 환경에서 렌더된다 — CSS는 양쪽에 닿는지 확인할 것"** |
| `docs/roadmap.md` | Phase 60 절 추가 |

## 부록 B — 검증 이력 요약

| 판 | 작성 | 기준 | 결과 |
|---|---|---|---|
| v1 | web | `459cbcb` (**Phase 59 이전**) | 방향은 옳았으나 좌표 전면 어긋남 + §0.3 진단 오류 |
| v2 | CLI | `aff3bd2` 실측 | 정정 15건(F1~F15). 핵심: PrintStyles 화면 누출(F2) · 결함 위치(F3) · 특이도(F4) · Q4 전제 붕괴(F5) · 인쇄 비-iframe(F6) · 리터럴 문단 뭉침(F15) |
| v3 | web | 클론 + `locale.ts` 라이브 실행 + Chromium 렌더 | **v2 전건 승인** + 보강 8건(G1~G8). D14 근거 정밀화(G1) · 소비처 2건 추가(G3) · import 체인 정정(G4) · NBSP 지적(G5) |
| **v4** | CLI | v3 재검증 (import closure 스크립트) | **정정 1건 + 개선 3건**: **H1** G2 과잉 정정 되돌림 + `/p` 라우트 추가 · **H2** D15 신설(NBSP 회귀 방지) · **H4** 그 D15 초안의 열거형 클래스도 `\s`보다 좁다는 자체 정정 → `[^\S\n\r]*`로 확정 · **H3** `@media print` 구조 자기 정정(10-26에서 닫힌다) |

v4의 H1 상세: v3 G2는 "`/shared`로 가는 클라이언트 내비게이션 경로 없음"을 정확히 실측했으나, "따라서 실사용자는 항상 PrintStyles 없이 본다 → 오정렬 일관 재현"으로 결론했다. 전이적 import closure 실측 결과 **`AppShell` 엔트리(123파일)는 PrintStyles에 도달하고 `/p`(36파일)·`/shared`(29파일)는 도달하지 않는다.** 공개 뷰어 컴포넌트는 두 환경 모두에서 렌더되므로(AppShell 783·791) v2의 "진입 경로 의존" 결론이 유효하다.

## 부록 C — 후속 후보

1. **`.marker-circled` 누출 정리**(D11) — globals `!important`가 덮어 무해하나 같은 부채.
2. **인쇄 giyeok 폭 2.5em → 2em 통일** — 1줄. 인쇄 산출물이 바뀌므로 별도 승인.
3. **EditorPreview 인라인 `preprocessLocale` → locale.ts 통합**(D12).
4. **`locale` prop 되살리기** — 두 번째 로케일 착수 시.
5. **레거시 (a)/(i) → 리터럴 일괄 변환 도구** — 필요해지면 Phase 59 Q5와 묶어서.
6. **PrintStyles 97-114의 화면 누출** — `.tag-marker`·`.katex-display .tag`도 `@media print` 밖 무접두다. 바로 아래 115-123이 `.print-body` 접두 규약을 지키는 것과 대조된다. globals에 동일 값이 있어 현재 무해.
7. **사용 가이드 한 줄** — `**(가) 핵심**`은 마커가 안 붙는다(§7.3-3). `docs/사용 가이드 — 강조와 톤.md`에 추가.
8. **공개 라우트의 시트 격차 일반 점검** — `/p`·`/shared`가 AppShell보다 94·87개 적은 파일 그래프를 갖는다. 마커 외에도 앱에서만 걸리는 스타일이 있을 수 있다(부록 C-6이 그 후보).
