# Phase 60(예정) — list 로케일 블록 개편: (가)·(나) / ㄱ. ㄴ. **직접 입력** + 마커 공백 정규화 · **v2 계획서**

> **문서 성격**: 자체 완결 계획서. v1(웹 Claude/Fable, `459cbcb` 클론 대조) → **v2(CLI Claude, 라이브 레포 HEAD `aff3bd2` 재실측)**.
> **다음 절차**: v2 → **웹 Claude 교차검토(v3)** → CLI 재검증(v4, 필요 시) → 덕수 승인 → 착수 → 확정본을 `docs/phasedocs/`로.
> **기준 커밋**: `aff3bd2` (Phase 59 마무리, 2026-08-17 22:22). 본문·부록의 모든 행 번호는 이 커밋 실측이다.
> **교차검토자에게**: 본 문서는 단독으로 읽을 수 있게 썼다. §11에 검증 요청 8건을 정리했고, v1과의 차이 내역은 부록 B에 provenance로 남겼다. **v1을 읽지 않아도 §1~§10만으로 검토가 가능하다.**
>
> ### 확정 기록
> - **2026-08-17 덕수**: v1 Q1~Q5 전건 확정 — 마이그레이션 도구 안 만듦(Q1) · 인쇄 giyeok 폭 유지(Q2) · 국제 로케일 역변환 안 함(Q3) · 화면 마커를 별도로 강조하지 않음(Q4의 **취지**) · 로케일 레지스트리는 두 번째 로케일 착수 시(Q5).
> - **2026-08-18 덕수**: 화면 마커 규격 **B 확정** — 굵기 `inherit`(본문과 같게) · gana `2.5em` · giyeok `2em`. 인쇄는 600·2.5em 불변. (v1 Q4는 "현행 유지"로 적혔으나 현행이 실측과 달랐다 → 부록 B F2·F5)
> - ⇒ **미결 항목 없음.** 남은 절차는 교차검토뿐이다.

---

## 0. 요약

### 0.1 요구 2건과 판정

| # | 요구 | 판정 | 비용 |
|---|---|---|---|
| **P1** | **직접 입력 전환** — (가)·(나) 상자에는 `(가)(나)`를, ㄱ·ㄴ 상자에는 `ㄱ. ㄴ.`을 그대로 입력·저장한다. "국제 표준 입력 → 로케일 렌더"라는 가정을 버리고 **로케일 블록** 체계로 간다 | **타당·가능** | 소 (프리셋 2줄 + 변환 2함수) |
| **P2** | **마커 공백 정규화** — 라벨 뒤 띄어쓰기를 하건 안 하건 마커·본문 간격이 항상 같아야 한다 | **타당·가능** | 소 (regex 4곳 + CSS 소유권 정리) |

파생 작업: **P3** proofread 마스킹 확장(AI 교정이 마커를 건드리지 못하게) · **P4** 정규식 상수 공유(사본 이격 구조적 차단).

전부 **순수 클라이언트**. Firestore 규칙·서버·블록 타입 키(`gana`·`roman`) 무변경 → **데이터 영향 0**. 기존 문항의 raw_text도 손대지 않는다.

### 0.2 P1을 정당화하는 현행 결함 (실측)

이름은 이미 한국식('(가), (나) 상자' · 'ㄱ, ㄴ 상자' — [EditorView.tsx:91-92](components/editor/EditorView.tsx#L91))인데 프리셋만 국제 표준(`(a) (b) (c)`)이라는 불일치가 요구의 출발점이다. 그런데 실측 결과 그보다 심한 것이 있다:

**지금 손으로 `(가)`를 입력하면 문단이 뭉친다.** `insertMarkerLineBreaks`는 `(a-e)`·`(i-v)`·`①-⑮`만 마커 행으로 인식한다([locale.ts:65-66](lib/locale.ts#L65)). 리터럴 `(가)`는 인식되지 않고, 렌더 파이프라인에 `remark-breaks`가 없어(EditorPreview 300 · PrintableContent 126 = `[remarkMath, remarkGfm]`) 연속 행이 한 문단으로 합쳐진다:

```
입력:  (가) 짝수인 경우          렌더:  (가) 짝수인 경우 (나) 홀수인 경우
      (나) 홀수인 경우                  ← 한 줄로 이어붙는다. 내어쓰기도 없다
```

OCR 결과가 원래 한국 리터럴로 나오는 것([lib/ocr.ts](lib/ocr.ts) — `['ko']` 기본)까지 감안하면, P1은 편의 개선이 아니라 **현존 결함의 수정**이다. 반대로 기존 리터럴 문항의 렌더가 바뀌는 것이기도 하다 → §7 후방 호환·T14.

### 0.3 P2의 정체 — 두 원인, 두 처방

요구가 말하는 "빈칸 한 칸"은 원인이 둘이고 나타나는 곳이 다르다.

| 원인 | 증상 | 나타나는 곳 | 처방 |
|---|---|---|---|
| ① 마커 정규식이 뒤 공백을 흡수하지 않는다 | `(a) 내용`의 첫 줄이 공백 한 칸만큼 밀려 랩 라인과 **0.25em** 어긋난다. 공백 유무로 간격이 흔들린다 | **전 사이트 공통** | §4.1 regex `[ \t]*` |
| ② 화면용 마커 CSS가 인쇄 파일에 얹혀 있다 | 마커가 자연폭으로 렌더돼 첫 줄이 **0.8em** 어긋난다 | **공개 뷰어 `/shared` 전용** | §4.2 CSS 소유권 정리 |

②가 v2의 핵심 발견이다 → §1.2.

---

## 1. 현재 동작 — HEAD `aff3bd2` 실측

### 1.1 변환 사본 2곳

CLAUDE.md의 "locale.ts ↔ EditorPreview.tsx 동기화" 규칙이 걸리는 자리다.

| 경로 | 소비처 | 좌표 |
|---|---|---|
| `lib/locale.ts` → `lib/preprocess.ts` | **인쇄** ([PrintableContent.tsx:123](components/print/PrintableContent.tsx#L123) `preprocess()`) | 변환 함수 **119-151** · 메인 `preprocessLocale` **178-198** |
| `EditorPreview.tsx` 인라인 `preprocessLocale` | **화면 전부** — CLAUDE.md 렌더 4사이트(EditorView 미리보기 · ProblemView→TabBody · FolderView · ProblemTabContent) + `OutlineSections`(요약 보기, Phase 59) + `ChoicesBlock`(40) + 댓글 2곳(CommentEditor 282 · CommentPanel 1465) | **91-177** · 호출 **284** |

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

**두 사본의 정규식이 이미 문자열로 어긋나 있다**: locale.ts 65는 `/^\s*\(…\)/`, EditorPreview 111은 `/^\(…\)/.test(line.trimStart())`. 동작은 같지만 표기가 다르고, `\s*`는 CLAUDE.md 금지 표기다(여기선 단발 `.test()`라 실질 무해). 리터럴 패턴을 추가하면 이격 지점이 2쌍 → 4쌍으로 늘어난다 → §6.

`EditorPreview`는 `locale` prop을 받지만(20·278) **284의 호출에서 참조하지 않는다** → 화면 경로는 locale 값과 무관하게 항상 ko 변환이 걸린다. 전 호출처가 `locale="ko"` 하드코딩이라 현재는 무해. **이번에도 손대지 않는다**(D7) — 다만 "로케일 블록" 철학상 이 prop이 언젠가 살아나야 하므로 §6에서 주석으로 못 박는다.

### 1.2 마커 CSS — 실제 캐스케이드

**시트 로드 사실** (grep으로 전건 확인: `.css'` import는 아래가 전부):

| 시트 | import 지점 | 도달 범위 |
|---|---|---|
| `globals.css` | [app/layout.tsx:1](app/layout.tsx#L1) | **전 라우트** |
| `PrintStyles.css` | **[EditorView.tsx:51](components/editor/EditorView.tsx#L51)** · [pdfPrint.tsx:3](lib/pdfPrint.tsx#L3) · [PrintableContent.tsx:12](components/print/PrintableContent.tsx#L12) · PdfDownloadButton.tsx:6 | **앱 전 페이지** (AppShell:34이 EditorView를 정적 import) |
| — | — | `/shared/[shareId]`는 **PrintStyles 없음** (page.tsx는 SnapshotView·MiniShell만 import, 그 하위 PublicViewerShell→ProblemTabContent에도 없음) |

**그리고 `PrintStyles.css` 124-128은 `@media print` 밖의 전역 규칙이다** (그 블록은 10-26·28-37에서 닫힌다):

```css
.marker-gana, .marker-giyeok { display:inline-block; min-width:2.5em; font-weight:600; text-indent:0 }   /* 124 */
p:has(> .marker-gana:first-child),
p:has(> .marker-giyeok:first-child) { padding-left:2.5em; text-indent:-2.5em }                           /* 125-126 */
```

`:has()`의 특이도는 인자 목록 중 최대값을 취한다(Selectors 4) → `p:has(> .marker-giyeok:first-child)` = **(0,2,1)** > [globals.css:386](app/globals.css#L386) `p:has(.marker-giyeok)` = **(0,1,1)**. **globals 381-389는 로드 순서와 무관하게 진다.**

⇒ **현행 렌더 실태**:

| | **앱 4사이트 + 요약 보기 + 댓글** | **공개 뷰어 `/shared`** | **인쇄** |
|---|---|---|---|
| 적용 시트 | globals + **PrintStyles(누출)** | globals **only** | globals + PrintStyles |
| 마커 고정폭 | gana 2.5em · giyeok **2.5em** | **없음**(자연폭 gana ≈1.7em · giyeok ≈1.2em) | 2.5em · 2.5em |
| 마커 굵기 | **600** | 본문 굵기 | 600 |
| `p` 내어쓰기 | 2.5em · **2.5em** | 2.5em · **2em** | 2.5em · 2.5em |
| `(가)내용` | 정렬 맞음 | **0.8em 어긋남** | 정렬 맞음 |
| `(가) 내용` | **0.25em 어긋남 + 여분 한 칸** | 어긋남 | 0.25em 어긋남 |

부작용 하나 더: 클라이언트 내비게이션으로 `/shared`에 들어오면 앞 라우트의 시트가 문서에 남아 정렬돼 보일 수 있다 → **공개 뷰어의 겉모습이 진입 경로에 따라 달라진다.** (§11-2 검증 요청)

**PrintStyles [118행 주석](components/print/PrintStyles.css#L118)이 이미 규약을 못 박아 뒀다**: *"⚠ `.print-body` 접두 필수 — CSS 로드 순서에 의존하지 않고 특이도로 화면 규칙을 이긴다."* **124-128이 그 규약을 어긴 자리**다.

### 1.3 인쇄 경로 — iframe이 아니다

CLAUDE.md의 "iframe 방식 인쇄"는 **낡은 기록**이다. [lib/pdfPrint.tsx:40-68](lib/pdfPrint.tsx#L40)은 숨은 div에 렌더 → `.print-root`를 **`document.body`에 직접 붙여** `window.print()`를 부른다. 따라서 **globals.css가 인쇄 노드에도 전부 적용**되고, PrintStyles는 특이도로만 이긴다(그래서 201-203이 `!important`를 쓴다 — CLAUDE.md에 기록된 사실). ⇒ "인쇄 CSS를 안 건드리니 인쇄는 안전"이라는 추론은 **성립하지 않는다.** 화면 규칙을 globals에 넣을 때 인쇄로 새지 않게 스코프해야 한다 → §4.2.

### 1.4 입력 프리셋과 소비처

```ts
// components/editor/EditorView.tsx
gana:  '(a) \n(b) \n(c) ',      // 116행
roman: '(i) \n(ii) \n(iii) ',   // 117행
```

소비처는 **3곳 + 진입점 1개**: **1514-1518**(빈 텍스트 → 타입 변경, Phase 57 D9) · **1525-1527**(비텍스트 → 텍스트 계열) · **1561**(`handleAddBlock` 신설) · `EmptyBlockChips`의 gana 칩(**181**, 같은 콜백 경유). 전부 `BLOCK_PRESETS[type]` 조회 한 줄이라 문자열만 갈면 된다.

무변경 상수: `BLOCK_TYPE_LABELS`(82) · `BLOCK_TYPES`(101) · `TEXT_BASED_TYPES`(126) · `SPLITTABLE_TYPES`(132) · `BORDERED_TYPES`(143 = gana·roman·box).

### 1.5 그 밖의 접점

- **proofread 마스킹**: [proofread.ts:59](lib/proofread.ts#L59) `/^\(([a-z]+|[ivx]+)\)\s*/` — 라인 선두 마커만. 리터럴 미인식 → AI 교정에 노출.
- **자동 수식화 보호 목록**: `autoWrapBareNumbers` 360(`\(\d+\)`) · `autoWrapBareLetters` 447-448(`\([a-zA-Z]\)`·`\([ivxlcdmIVXLCDM]{1,5}\)`)·451(괄호 없는 로마 숫자). `(a)`·`(i)`를 **명시 보호 목록으로 겨우** 막고 있다.
- **경우 블록 라벨**: [caseBlock.ts:96](lib/caseBlock.ts#L96) 주석이 *"행 선두 인라인 span 주입은 marker-gana·marker-circled·marker-case-sub가 쓰는 확립된 방식"*이라 명시 → 리터럴 span도 같은 전례.
- **요약 발췌**: [solutionOutline.ts:55-57](lib/solutionOutline.ts#L55) `SCANNED_TYPES`에 `gana`·`roman` 포함 → `**…**`만 발췌하므로 발췌문에 마커가 없다(기존 한계, §7).
- **저장 정형화**: [blocks/normalize.ts](lib/blocks/normalize.ts) `toPersistedBlock` — `normalizeDisplayMathSpacing` + 앞뒤 빈 줄 트림뿐, 마커 무관 ✓
- **AI 프롬프트**: `app/api/` 전체 grep — 마커 표기를 지시하는 프롬프트 없음(`discuss/route.ts:98`의 산문 `(a)` 한 건뿐) ✓

---

## 2. 공통 원칙

1. **raw_text 불변** — span 주입은 렌더 단계 전용. 바뀌는 것은 "새로 입력되는 원문이 무엇이냐"(D1)뿐이다.
2. **행 단위 전처리에 `\s*` 금지, `[ \t]*`** (Phase 57 확립) — 이번에 `locale.ts:65-66`·`proofread.ts:59`의 잔존 `\s*`까지 정리한다.
3. **불변식: 마커 고정폭 = 그 사이트의 `p` 내어쓰기 폭.** 이것만 지키면 값 자체(화면 gana 2.5em / 화면 giyeok 2em / 인쇄 2.5em)는 사이트별로 달라도 된다. "화면·인쇄 수치까지 동일"은 Q2(인쇄 유지)와 충돌하므로 원칙으로 세우지 않는다.
4. **시트 소유권** — 화면 규칙은 `globals.css`가 `.preview-content` 스코프로, 인쇄 규칙은 `PrintStyles.css`가 `.print-body` 접두로. 양방향 격리(§1.3 때문에 필요하다).
5. **변환 순서 무관성** — 리터럴 변환은 레거시 변환 뒤에 두지만, 레거시 변환이 끝난 행은 `<span class="marker-…">`로 시작해 `^\(`·`^[ㄱ-ㅊ]\.`에 두 번 걸리지 않는다. **멱등**이며 T-L9로 고정한다.

---

## 3. P1 — 직접 입력 전환

### 3.1 프리셋 교체 ([EditorView.tsx:116-117](components/editor/EditorView.tsx#L116))

```ts
gana:  '(가) \n(나) \n(다) ',
roman: 'ㄱ. \nㄴ. \nㄷ. ',
```

라벨·드롭다운·칩·집합 3종 전부 무변경. 타입 키 불변 → 데이터·Undo·버전·export 경로 영향 0. trailing space는 원문자 프리셋(`'① '`)과 같은 관용구로 유지하고 §4.1이 무해화한다(D6).

### 3.2 리터럴 인식 (사본 2곳)

배치: `preprocessLocale` 3단계 안, `convertRomanList` 뒤 · `convertCircledList` 앞. `locale !== 'ko'` 조기 반환 **안쪽**에 두어 로케일 블록 철학 유지(T-L12로 고정).

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

정규식은 §6의 공유 상수. `/g` 인스턴스는 `lastIndex`가 남으므로 `.source`로 새로 만든다 — [solutionOutline.ts:72](lib/solutionOutline.ts#L72)가 같은 이유로 쓰는 관용구다. 렌더 결과는 레거시와 **완전히 동일한 마크업**이라 CSS·내어쓰기·인쇄가 전부 자동 적용된다.

### 3.3 범위는 10개

| | 레거시 (매핑 테이블 有) | 리터럴 (매핑 無) |
|---|---|---|
| gana | `(a)`~`(e)` **5개 고정** | `(가)`~`(차)` **10개** |
| giyeok | `(i)`~`(v)` **5개 고정** | `ㄱ.`~`ㅊ.` **10개** |

5개 상한은 `GANA`/`GIYEOK` 테이블([locale.ts:18-24](lib/locale.ts#L18)) 크기에서 온 것이고 리터럴엔 테이블이 없다. 상한을 남기면 `(바)`를 쓴 사용자가 **그 줄만 내어쓰기가 빠지는 조용한 결함**을 디버깅해야 한다. 확장 비용은 문자 클래스 다섯 자.

문자 코드포인트: `가`=U+AC00 계열 완성형, `ㄱ`=U+3131 계열 **호환 자모** — `GIYEOK` 테이블 값과 동일 코드포인트임을 확인했다.

**알려진 오탐 하나**: `(사)`는 사단법인 약어로도 쓰인다. 행 **선두**에 와야 하고 피해는 "그 줄이 2.5em 내어쓰기된다"뿐(데이터 불변·즉시 가시)이라 수용한다. 범위를 좁혀 생기는 조용한 결함보다 낫다. (§11-3 검증 요청)

### 3.4 `insertMarkerLineBreaks` 확장 (사본 2곳)

§0.2의 문단 뭉침을 해소하는 핵심 한 걸음. 두 사본을 **문자 단위로 같은 형태**로 통일한다.

```ts
const isMarkerLine = MARKER_LINE_RE.test(line);   // §6 공유 상수
// = /^[ \t]*(?:\((?:iii|ii|iv|v|i|[a-e])\)|\((?:가|나|다|라|마|바|사|아|자|차)\)
//     |[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/
```

- locale.ts 65의 `\s*` → `[ \t]*` (금지 표기 정리).
- EditorPreview 110-112의 `line.trimStart()` 변형도 같은 상수로 대체.
- 결과: 리터럴 프리셋 3행이 레거시와 똑같이 각각 독립 `<p>`가 되고 내어쓰기가 행마다 걸린다.

### 3.5 레거시 공존 (D5)

`convertAlphaList`·`convertRomanList`·행 중간 치환·매핑 테이블 전부 유지. 기존 (a)/(i) 문항의 렌더는 §4.1의 공백 흡수로 인한 **간격 균일화만** 달라진다(T5에서 "의도된 개선"으로 승인 후 통과). 마이그레이션 도구는 만들지 않는다(Q1 확정).

[locale.ts 헤더 1-8](lib/locale.ts#L1)의 철학을 교체:

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
ALPHA_LINE_RE = /^\(([a-e])\)[ \t]*/        // locale.ts 121 · EditorPreview 144
ROMAN_LINE_RE = /^\((iii|ii|iv|v|i)\)[ \t]*/ // locale.ts 134 · EditorPreview 150
```

리터럴 2종은 §3.2 상수에 이미 내장. **행 중간 치환은 손대지 않는다** — 문장 속 인용(`…조건 (가)에 의해…`)의 공백은 유의미하다.

- 효과: `(a)내용` / `(a) 내용` / `(a)  내용`이 **완전히 같은 HTML**이 된다.
- 프리셋의 trailing space는 span 뒤 텍스트가 사라져 `<p><span/></p>`가 된다 — 원문자 프리셋이 Phase 57부터 그 상태이므로 **전례 그대로, 겉모습 변화 없음.**
- locale.ts 122-123·135-136의 `korean ? … : (${ch})` 폴백은 alternation이 테이블 전건을 덮어 **도달 불가**다. `[ \t]*`가 붙으면 폴백 경로에서만 공백이 사라지지만 그 경로는 실행되지 않는다 → 그대로 두고 주석 한 줄로 명시.

### 4.2 CSS 측 — 소유권 정리

#### (a) `app/globals.css` 381-389 → `.preview-content` 스코프 + 마커 고정폭 신설

```css
/* ═══ (가)(나) · ㄱ.ㄴ. 마커 — 화면 (Phase 60 P2) ═══
   이 규칙들은 지금까지 PrintStyles.css 124-128에 있었고, EditorView.tsx:51이 그 파일을
   import하는 덕에 "우연히" 화면에도 걸려 있었다. 공개 뷰어(/shared)는 PrintStyles를
   부르지 않아 규칙이 빠져 첫 줄이 0.8em 어긋났다.
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
     font-weight:600을 명시적으로 되돌린다. 인쇄만 600을 유지한다(의도된 예외). */
  font-weight: inherit;
}
.preview-content .marker-gana   { min-width: 2.5em; }
.preview-content .marker-giyeok { min-width: 2em; }   /* D4′ — `ㄱ.`이 `(가)`보다 좁다 */

.preview-content p:has(.marker-gana)   { padding-left: 2.5em; text-indent: -2.5em; }
.preview-content p:has(.marker-giyeok) { padding-left: 2em;   text-indent: -2em;   }
```

`.preview-content`는 [EditorPreview.tsx:465](components/editor/EditorPreview.tsx#L465)의 루트 클래스이고, 화면 마커가 렌더되는 **모든** 경로가 EditorPreview를 경유한다(§1.1 표에서 ChoicesBlock·OutlineSections·댓글까지 확인). 인쇄는 자체 ReactMarkdown이라 이 클래스가 없다.

#### (b) `PrintStyles.css` 124-126에 `.print-body` 접두

```css
.print-body .marker-gana, .print-body .marker-giyeok
  { display:inline-block; min-width:2.5em; font-weight:600; text-indent:0; }
.print-body p:has(> .marker-gana:first-child),
.print-body p:has(> .marker-giyeok:first-child)
  { padding-left:2.5em; text-indent:-2.5em; }
```

**인쇄 산출물 완전 불변**: 값 동일 + `.print-body`는 [PrintableContent.tsx:58](components/print/PrintableContent.tsx#L58)의 유일 래퍼(선택지 포함 전 블록을 감싼다)이고, 특이도가 (0,1,0)→(0,2,0)·(0,2,1)→(0,3,1)로 올라가 globals를 계속 이긴다.

#### (c) `.marker-circled`(PrintStyles 127-128)는 손대지 않는다 — D11

같은 누출이지만 [globals.css 392-402](app/globals.css#L392)가 동일 값 + `!important`로 이미 이기고 있어 **관측 차이가 0**이고, 인쇄 쪽은 그 `!important`를 이기려 201-203이 다시 `!important`를 쓰는 구조(CLAUDE.md 기록)다. 여기를 건드리면 Phase 57~59의 원문자 여백 체계가 흔들린다 → **범위 밖**, 부록 C-1로 이월.

#### (d) 인쇄 선택자의 `:first-child` 형태 유지 — D14

인쇄은 `p:has(> .marker-gana:first-child)`(자식+first-child), 화면은 `p:has(.marker-gana)`(후손)로 형태가 다르다. 마커 span은 항상 행 선두에서 생성되어 첫 요소 자식이므로 **두 형태의 매칭 결과가 갈리는 입력이 없다**(반례 탐색 실패 — §11-5 검증 요청). 인쇄 산출물을 바이트 단위로 보존하는 것이 우선이므로 **현행 형태 유지**하고, 비대칭 사실만 주석으로 남긴다.

### 4.3 목표 동작

| 입력 | 앱 4사이트 · 요약 · 댓글 | 공개 뷰어 | 인쇄 |
|---|---|---|---|
| `(가)내용` | 본문 = 2.5em 정렬 | **정렬(신규 수정)** | 2.5em 정렬 |
| `(가) 내용` / `(가)  내용` | **좌동** (공백 흡수) | 좌동 | 좌동 |
| `ㄱ.내용` / `ㄱ. 내용` | 본문 = 2em 정렬 | **정렬(신규 수정)** | 2.5em 정렬 |
| 연속 3행 리터럴 | 각각 독립 `<p>` + 내어쓰기 (**신규 수정** — §0.2) | 좌동 | 좌동 |
| 행 중간 `…조건 (가)에…` | 그대로 | 그대로 | 그대로 |
| 마커 굵기 | **본문과 같게** (600 → inherit) | 본문과 같게 | 600 유지 |

---

## 5. P3 — proofread 마스킹 확장 ([proofread.ts:59](lib/proofread.ts#L59))

```ts
const markerMatch = text.slice(i).match(
  /^(?:\(([a-z]+|[ivx]+)\)|\((?:가|나|다|라|마|바|사|아|자|차)\)|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.)[ \t]*/
);
```

- 범위 10개 반영 + `\s*` → `[ \t]*`. `\s*`는 개행을 삼켜 `(가)`↵`(나)`처럼 **내용 없는 마커 행이 이어질 때 둘째 마커의 라인 선두 판정을 건너뛴다** — 새 프리셋이 정확히 그 형태다.
- placeholder push·복원 로직 무변경(기존 `(a)` 마스킹과 동일 경로). 캡처 그룹 `([a-z]+|[ivx]+)`는 현재 아무도 읽지 않으므로 리터럴 분기에 캡처를 두지 않아도 무해(확인 완료).
- **부수 이득**: `autoWrapBareLetters`가 `(a)`·`(i)`를 명시 보호 목록으로 겨우 막고 있었는데(§1.5), 한글 리터럴은 `[A-Za-z0-9]`가 아니라 **애초에 자동 수식화 대상이 아니다** → P1이 이 위험군을 구조적으로 없앤다. 보호 목록(447-451)은 레거시용으로 **그대로 유지**.

---

## 6. P4 — 사본 이격 지점 축소

리터럴을 넣으면 "문자 단위로 같아야 하는 정규식"이 2쌍 → 4쌍이 된다. **정규식만** locale.ts의 export 상수로 뽑고 EditorPreview가 import한다.

```ts
// lib/locale.ts — 신설 export. /g 없이 정의하고 소비처가 new RegExp(RE.source, 'gm')로
// 인스턴스를 만든다 (lastIndex 오염 차단 — solutionOutline.ts:72와 같은 처방).
export const MARKER_LINE_RE    = /^[ \t]*(?:\((?:iii|ii|iv|v|i|[a-e])\)|\((?:가|나|다|라|마|바|사|아|자|차)\)|[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]\.|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/;
export const ALPHA_LINE_RE     = /^\(([a-e])\)[ \t]*/;
export const ROMAN_LINE_RE     = /^\((iii|ii|iv|v|i)\)[ \t]*/;
export const GANA_LITERAL_RE   = /^\((가|나|다|라|마|바|사|아|자|차)\)[ \t]*/;
export const GIYEOK_LITERAL_RE = /^([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.[ \t]*/;
export const CIRCLED_LINE_RE   = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])[ \t]*/;
```

**함수 통합은 하지 않는다(D12).** EditorPreview 인라인 `preprocessLocale`(91-177)은 locale.ts 판본과 단계 순서·`locale` 게이트 유무가 다르고, 화면 전 사이트의 렌더 회귀 위험이 있다. 정규식만 공유하면 **이번 변경으로 늘어나는 이격 위험은 0**이 되고 통합은 별 Phase로 미룰 수 있다.

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
| `blocks/normalize.ts` `toPersistedBlock` | **무영향** | 수식 여백 정규화 + 앞뒤 빈 줄 트림뿐 (실측) |
| GitHub export (`exportMd`) | **무영향·개선** | raw_text 그대로 아카이브 → 미러 md 가독성 향상 |
| OCR (`lib/ocr.ts`) | **개선** | Mathpix 한국 문항 결과가 원래 리터럴로 나온다 → 지금은 span·빈 줄이 안 걸려 뭉치는데(§0.2) 본 Phase 후 자동 적용 |
| AI 교정 (proofread) | §5로 해소 | 확장 전엔 리터럴 마커가 Claude 교정 대상에 노출 |
| AI discuss · ai-complete | **무영향** | `app/api/` 전체 grep — 마커 표기 지시 없음 |
| `latex-linter` | **무영향** | 수식 내부 전용 린트 (grep 확인) |
| `search-highlight` · FindReplace | **무영향** | CodeMirror `raw_text` 대상(Decoration), 렌더 HTML 미개입 |
| 요약 보기 (`solutionOutline`) | **무영향** (기존 한계 유지) | §7.3-1 |
| 목록(①)·choices·callout·case/subcase·rail | **무영향** | 별도 파이프라인·마커 무관. `.case-block` 형제 인접·padding 규칙 미접촉 |
| Undo/Redo · 블록 분할 | **무영향** | 프리셋 소비처 3곳 모두 문자열 조회 한 줄 |
| Firestore rules | **무영향** | 블록 type 화이트리스트 없음 (Phase 59 E19′ 재사용) |
| `data-math-id` 매핑 | **무영향** | span 주입은 수식 개수·순서 불변 (`injectCaseLabel`과 동일 논거) |
| **인쇄 산출물** | **불변** | §4.2(b) `.print-body` 접두가 특이도를 올려 값 유지. T4로 전/후 PDF 대조 |
| Phase 58 톤 시스템 (`.tone-baseline`·`.problem-content-toned`) | **정합** | `font-weight: inherit`·색 미지정이라 마커가 본문 톤을 정확히 따라간다 — D8′의 의도 그대로. §11-4 검증 요청 |

### 7.2 후방 호환 — **기존 콘텐츠의 렌더가 바뀌는 경우가 하나 있다**

이미 리터럴 `(가)`·`ㄱ.`이 들어 있는 문항(손입력·OCR 결과)은 지금 §0.2대로 **뭉쳐서** 렌더된다. 본 Phase 후에는 독립 문단 + 내어쓰기로 바뀐다.

- **판정: 개선.** 현재 모습(`(가) 짝수 (나) 홀수`가 한 줄)은 어떤 의도로도 정당화되지 않는다.
- 단 **raw_text는 불변**이므로 되돌리기는 코드 되돌리기 한 번이고 데이터 손실 경로가 없다.
- 그래도 "기존 문항의 겉모습이 바뀐다"는 사실이므로 **T14로 명시 확인**한다.

### 7.3 알려진 한계 (문서화하고 고치지 않음)

1. **요약 발췌에 마커가 없다** — `SCANNED_TYPES`에 gana·roman이 있어 `**…**`만 발췌한다. `(가) **핵심**`을 쓰면 요약에 `(가)`가 빠진다. Phase 59 기존 동작이고 P1/P2가 바꾸지 않는다.
2. **행 선두 공백** — `  (가) 내용`은 레거시 `(a)`와 마찬가지로 span이 붙지 않는다(`^\(` 고정). `MARKER_LINE_RE`만 걸려 빈 줄이 들어가므로 문단 분리는 되고 내어쓰기만 빠진다.
3. **마커를 굵게 감싼 경우** — `**(가) 핵심**`은 행이 `*`로 시작해 span이 아예 안 생긴다(내어쓰기 없음). 반대로 `(가) **핵심**`은 정상. 사용 가이드에 한 줄 필요.
4. **경우 블록 제목행** — `injectCaseLabel`이 렌더 사이트에서 라벨 span을 먼저 앞에 붙이므로 제목행이 `(가)`로 시작해도 `^`에 걸리지 않는다. 레거시도 동일. 제목행은 조건 문장이라 실사용 영향 없음.
5. **NFC/NFD** — 리터럴은 호환 자모(U+3131…)·완성형(U+AC00…) 기준이다. HWP·타 시스템에서 붙여넣은 텍스트가 Hangul Jamo 초성(U+1100…)이나 NFD 분해형이면 매칭되지 않는다. 방어 비용(전역 `normalize()`)이 원문 변경을 수반하므로 **검증 항목(T11)으로만** 둔다.

---

## 8. 결정표

| # | 결정 | 판정 | 근거 |
|---|---|---|---|
| **D1** | 저장 철학 | **리터럴 저장 공식 채택** — locale.ts 헤더·CLAUDE.md에 "로케일 블록" 철학 기록. 마이그레이션 없음 | 덕수 확정(Q1·Q3). 이중 유지(입력 리터럴 / 저장 국제)는 변환층이 하나 더 생겨 요구의 취지(직관성)를 깬다 |
| **D2** | 리터럴 인식 스코프 | **전역**(모든 텍스트 계열 블록의 행 시작) | 레거시 (a)와 동일 스코프. blockType 배선 불필요, 산문의 행 선두 인용도 레거시와 같게 동작 |
| **D3** | 공백 정규화 방식 | **regex가 `[ \t]*` 흡수 + CSS 고정폭** | 원문자(148-151)·인쇄(124)의 확립된 전례. "공백 1칸으로 치환"은 첫 줄·랩 라인 정렬을 못 맞춘다 |
| **D4′** | 화면 마커 고정폭 | **gana 2.5em / giyeok 2em** | 덕수 B 확정. §2-3 불변식. 앱 giyeok이 2.5em→2em으로 좁아진다(의도) |
| **D5** | 레거시 (a)/(i) | **유지** — 변환·5개 상한·행 중간 치환 전부 보존 | 리터럴 패턴과 겹치지 않아 공존 무해. 제거하면 옛 문항이 깨진다 |
| **D6** | 프리셋 trailing space | **유지** | 원문자 프리셋과 동일 관용구, §4.1로 무해화 |
| **D7** | 로케일 추상화 | **이번엔 없음** — 상수 6종은 EditorView 상단 유지, `locale` prop 미사용도 주석만 | 사용처 1곳뿐인 추상화는 YAGNI. 두 번째 로케일 착수 시(Q5) |
| **D8′** | 화면 마커 굵기 | **`font-weight: inherit`** — 인쇄만 600 유지 | 덕수 B 확정. 지시의 취지("별도 강조는 부담스럽다")를 실현하려면 현행 유지가 아니라 **명시 변경**이 필요했다(부록 B F2·F5) |
| **D9** | 리터럴 범위 | **10개** (가~차 / ㄱ~ㅊ) | §3.3. 5개 상한은 매핑 테이블의 유산이고 리터럴엔 근거가 없다 |
| **D10** | CSS 소유권 | **화면 = globals `.preview-content` / 인쇄 = PrintStyles `.print-body`** | PrintStyles 118 주석의 기존 규약. 인쇄가 iframe이 아니므로(§1.3) 양방향 스코프가 필요 |
| **D11** | `.marker-circled` 누출 | **범위 밖** | globals `!important`가 덮어 관측 차이 0. Phase 57~59 여백 체계 리스크 |
| **D12** | 사본 통합 범위 | **정규식 상수만 공유, 함수 통합은 별 Phase** | 이격 위험 증가분을 0으로 만들면서 회귀 위험을 지지 않는다 |
| **D13** | 회귀 하니스 | **`npm run test:locale` 신설** | locale.ts는 테스트가 없다. Phase 59 `test:case` 전례 |
| **D14** | 인쇄 선택자 형태 | **`:first-child` 형태 유지** | 매칭 결과가 갈리는 입력이 없다(반례 탐색 실패). 인쇄 산출물 보존이 우선. 비대칭은 주석으로 기록 |

---

## 9. 검증

### 9.1 `npm run test:locale` (신설 — Phase 59 `test:case` 패턴)

```json
"test:locale": "tsc lib/locale.ts --outDir .test-build --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/locale.test.mjs"
```
locale.ts는 `caseBlock.ts`의 `LEGACY_CASE_RE`를 import하므로 tsc가 따라 컴파일한다 — `test:case`가 solutionOutline→caseBlock+keyTone으로 검증한 경로다.

| # | 케이스 |
|---|---|
| L1 | 리터럴 gana 행 시작 → `<span class="marker-gana">(가)</span>`; 공백 **0·1·2칸 출력 동일** |
| L2 | 리터럴 giyeok 동일 (`ㄱ.` → `<span class="marker-giyeok">ㄱ.</span>`) |
| L3 | 확장 범위 `(바)`~`(차)` · `ㅂ.`~`ㅊ.` 인식 |
| L4 | 범위 밖 `(카)` · `ㅋ.` **무변환** (경계 고정) |
| L5 | 행 중간 `조건 (가)에` · `…ㄱ. 참조` **무변환** |
| L6 | 레거시 `(a)`~`(e)` / `(i)`~`(v)` 무회귀 + `[ \t]*` 흡수 |
| L7 | 레거시 범위 밖 `(f)` · `(vi)` 무변환 유지 |
| L8 | `MARKER_LINE_RE`가 리터럴 프리셋 3행을 각각 분리 (§0.2 결함 회귀 방지) |
| L9 | **멱등성** `preprocessLocale(preprocessLocale(x)) === preprocessLocale(x)` (리터럴·레거시 혼재) |
| L10 | 수식 안 `$(a)$` · `$$ㄱ.$$` 보호(⟦MATH_n⟧) |
| L11 | 원문자 밭 · `\tag`/`\ref` · Fig./Table 무회귀 |
| L12 | `locale: 'international'`이면 리터럴도 무변환 (조기 반환 안쪽 배치 확인) |

### 9.2 수동 검증

| # | 항목 |
|---|---|
| **T1** | **입력 동등성**: `(가)내용` / `(가) 내용` / `(가)  내용` → 화면 전 사이트 + 인쇄에서 픽셀 동일. ㄱ. 계열 동일 |
| **T2** | **공개 뷰어 수정**: `/shared/<id>`를 **하드 로드**해 마커 정렬 확인. 앱에서 클라이언트 내비게이션으로 들어온 경우와 **같아야** 한다 |
| **T3** | **내어쓰기 정렬**: 두 줄 넘는 항목에서 첫 줄 본문 시작점 = 랩 라인 시작점 (화면 gana 2.5em·giyeok 2em / 인쇄 2.5em) |
| **T4** | **인쇄 무변화**: 같은 문항으로 전/후 PDF를 뽑아 마커 폭·굵기·내어쓰기 동일 확인 (§4.2b 특이도 검증) |
| **T5** | **레거시 회귀**: 기존 (a)/(i) 문항 → 변환·5개 상한·행 중간 인용 전부 현행과 동일. 간격 균일화는 **의도된 개선**으로 승인 후 통과 |
| **T6** | **프리셋 4경로**: 신규 블록 추가(1561) · 빈 텍스트→타입 변경(1514) · 이미지→텍스트 계열(1525) · `EmptyBlockChips` gana 칩(181) |
| **T7** | **요약 보기**: gana 블록의 `**` 발췌에 마커가 빠지는 것(§7.3-1) 스펙 확인. 경우 블록·rail 무회귀 |
| **T8** | **proofread**: 마커 행이 AI 교정 결과에서 원형 보존. **내용 없는 연속 마커 행에서 둘째 마커까지** 마스킹(`\s*` 버그) |
| **T9** | **회귀 없음**: ① 원문자·목록·choices·callout·case(Phase 54/59)·수식 보호·요약 스위치 |
| **T10** | **사본 동기화**: 공유 상수 6개를 EditorPreview가 import하고 자체 리터럴이 남지 않았는지 grep |
| **T11** | **정규화 스팟체크**: HWP·외부에서 붙여넣은 문항 2~3건에서 마커가 인식되는지 (§7.3-5) |
| **T12** | **`[data-noscroll]` 경고 없음** — CSS 변경이 세로 overflow를 만들지 않는지 dev 콘솔 |
| **T13** | **D8′·D4′ 의도된 변화**: 앱 화면 마커 굵기가 본문과 같아졌고 `ㄱ.` 내어쓰기가 2em인지. **동시에 인쇄는 600·2.5em 유지**(T4와 짝) — §4.2 격리의 최종 확인 |
| **T14** | **후방 호환**: 리터럴이 이미 들어 있는 기존 문항 → 뭉쳐 있던 문단이 독립 문단 + 내어쓰기로 바뀐 것 확인(§7.2). 의도된 개선으로 승인 |

---

## 10. 착수 계획

**순서**: P4(§6 상수 추출) → P1(§3) → P2 regex(§4.1) → P2 CSS(§4.2) → P3(§5) → 하니스(§9.1) → 문서(부록 A).
상수를 먼저 뽑아 두면 이후 모든 정규식 수정이 **사본 1곳**으로 끝난다.

**커밋 분할 제안** (각 단계가 독립적으로 되돌릴 수 있게):
1. `Phase 60 P4: 마커 정규식을 locale.ts 공유 상수로` — 동작 변화 0, 순수 리팩터
2. `Phase 60 P1: (가)·ㄱ. 직접 입력 (프리셋·리터럴 인식·행 분리)`
3. `Phase 60 P2: 마커 뒤 공백 흡수`
4. `Phase 60 P2: 마커 CSS 소유권 분리 (화면 globals / 인쇄 print-body)` ← T4·T13 대상
5. `Phase 60 P3: proofread 리터럴 마커 마스킹`
6. `Phase 60: test:locale 하니스 · 문서`

**덕수가 눈으로 봐야 하는 겉모습 변화는 셋**: ① 앱 마커 굵기·`ㄱ.` 여백(T13) ② 공개 뷰어 정렬 수정(T2) ③ 리터럴 기존 문항의 문단 분리(T14). 나머지는 무변화다.

---

## 11. 웹 Claude(Fable) 교차검토 요청

라이브 레포를 클론해 아래를 대조해 주기 바란다. **1·2·5가 가장 값지다** — 내 결론이 명세·정적 분석 기반이라 브라우저 실측으로 뒤집힐 수 있는 자리다.

1. **`:has()` 특이도 판정** — `p:has(> .marker-giyeok:first-child)`를 (0,2,1), `p:has(.marker-giyeok)`를 (0,1,1)로 계산해 **globals 381-389가 죽은 코드**이고 화면 giyeok 내어쓰기가 2em이 아니라 **2.5em**이라고 결론했다(§1.2). DevTools Computed/Styles 패널로 실측 확인. 여기가 틀리면 §4.2 전체와 D4′·D8′가 흔들린다.
2. **시트 생존 범위** — `/shared/<id>`를 ① 하드 로드 ② 앱에서 클라이언트 내비게이션, 두 경로로 진입해 `PrintStyles.css` `<link>`가 문서에 남는지. 내가 "남을 수 있다(진입 경로 의존)"고 쓴 것이 실제로 관측되는지, 아니면 App Router가 제거하는지.
3. **리터럴 범위 10개의 오탐** — `(사)`(사단법인)처럼 행 선두에 올 수 있는 비마커 표기, `[ㄱ-ㅊ]\.`로 시작하는 비마커 행이 실제 문항에 있는지. 레포로는 확인 불가(Firestore) → 판단 근거를 보강해 주거나 범위 축소를 제안해 달라.
4. **Phase 58 톤 시스템과의 정합** — `font-weight: inherit` + 색 미지정이면 마커가 `.tone-baseline`(globals 255-256)·`.problem-content-toned`(259·326)의 본문 톤을 정확히 따라가는가. 특히 풀이 톤 낮추기가 발동한 상태에서 마커가 본문과 같은 색인지.
5. **D14 반례 탐색** — 인쇄 `p:has(> .marker-gana:first-child)`와 화면 `p:has(.marker-gana)`의 매칭이 갈리는 입력을 찾아 달라. 나는 "마커 span은 항상 첫 요소 자식"이라 결론했는데(§4.2d), 반례가 있으면 인쇄에서 내어쓰기가 조용히 빠지는 경로가 된다.
6. **§0.2 결함 재현** — `remark-breaks` 부재를 근거로 "손입력 `(가)` 연속 행이 한 문단으로 뭉친다"고 단정했다(EditorPreview 300 · PrintableContent 126). 실제 미리보기에서 재현되는지. P1의 정당화와 T14가 여기에 걸려 있다.
7. **P4 상수 공유의 번들·SSR 영향** — `EditorPreview.tsx`가 `lib/locale.ts`를 import하면 locale.ts → `caseBlock.ts` → (`keyTone.ts`)가 딸려 온다. 서버 컴포넌트 경계·번들 크기·`/shared` SSR에 문제가 없는지.
8. **누락 경로** — §7.1 표에 빠진 소비처가 있는지. 특히 Phase 59 이후 신설된 것(`OutlineSections`·`ToggleSwitch`·`showInSummary` 경로)과 댓글 렌더 2곳.

부수 확인: ① CLAUDE.md "iframe 방식 인쇄"가 오기라는 §1.3 판정 ② PrintStyles 98-113(`.tag-marker`·`.katex-display .tag`)도 같은 종류의 무접두 누출인지(부록 C-6).

---

## 부록 A — 수정 파일·좌표 (`aff3bd2` 기준)

| 파일 | 변경 |
|---|---|
| `lib/locale.ts` | 공유 상수 6개 신설(§6) · 리터럴 변환 2함수 + 3단계 배치(§3.2) · `insertMarkerLineBreaks` **65-66**을 상수로 교체(§3.4) · 레거시 regex **121·134** 상수화 + `[ \t]*`(§4.1) · 헤더 **1-8** 철학 갱신(§3.5) |
| `components/editor/EditorPreview.tsx` | **110-112**를 `MARKER_LINE_RE`로 · **144·150**을 공유 상수로 · 리터럴 2단계 삽입(**152 뒤, 154 앞**) · **91** 위 사본 범위 주석(§6) |
| `components/editor/EditorView.tsx` **116-117** | 프리셋 2줄 교체 (§3.1) |
| `app/globals.css` **381-389** | `.preview-content` 스코프로 이동 + `.marker-gana`·`.marker-giyeok` 고정폭·`font-weight:inherit` 신설 (§4.2a) |
| `components/print/PrintStyles.css` **124-126** | `.print-body` 접두 (§4.2b). **127-128(circled)은 손대지 않음**(D11) |
| `lib/proofread.ts` **59** | 리터럴 2종 + 범위 10개 + `\s*`→`[ \t]*` (§5) |
| `tests/locale.test.mjs` · `package.json` | `test:locale` 하니스 신설 (§9.1) |
| `CLAUDE.md` | ① 전처리 절에 리터럴 마커 ② **"PrintStyles.css는 화면에도 로드된다 → 인쇄 전용 규칙은 `.print-body` 접두 필수"** ③ **"인쇄는 iframe이 아니라 `document.body`에 노드를 붙인다"**(기존 기술 정정) ④ 저장 철학(D1) ⑤ 사본 동기화 규칙에 "정규식은 locale.ts 상수 공유" |
| `docs/roadmap.md` | Phase 60 절 추가 (착수 시) |

## 부록 B — v1 → v2 정정·보강 대장 (provenance)

v1은 **Phase 59 착수 이전 커밋 `459cbcb`**(2026-08-17 16:19)를 대조했다. HEAD `aff3bd2`(22:22)까지 커밋 17개가 쌓여 좌표와 진단이 어긋났다.

| # | 구분 | 내용 |
|---|---|---|
| **F1** | 정정 | 기준 커밋이 Phase 59 이전 → v1 전편의 행 번호 갱신 (globals 354-362 → **381-389** · 프리셋 108-109 → **116-117** · 변환 함수 114-145 → **119-151** · `.marker-circled` 365-370 → **392-397** 등) |
| **F2** | **정정(중대)** | **`PrintStyles.css`는 화면에도 로드된다** — `EditorView.tsx:51` + AppShell 정적 import. 124-128은 `@media print` 밖 → `.marker-gana{min-width:2.5em; font-weight:600}`이 **이미 화면에 걸려 있다.** v1 §0.3의 "화면: 규칙 없음 → 자연폭·본문 굵기"는 사실이 아니다 |
| **F3** | **정정(중대)** | **실제 정렬 결함은 공개 뷰어 한 곳뿐** — `/shared/[shareId]`만 PrintStyles를 안 끌어온다. 앱 4사이트는 이미 정렬돼 있고 남은 증상은 0.25em(공백)뿐 |
| **F4** | 정정 | globals 381-389는 **특이도로 진다** → 화면 giyeok 내어쓰기는 2em이 아니라 **2.5em**. v1 D4의 "화면 기존 값과 1:1 일치" 근거 소멸 |
| **F5** | 정정 | **Q4 전제 붕괴** — 덕수가 본 "현행"은 인쇄 값 누출(600)이었다. "현행 유지"와 "본문과 같게"가 다른 결과를 낸다 → 재상정 → **B 확정**(D8′) |
| **F6** | 정정 | **인쇄는 iframe이 아니다**(§1.3) → v1 §5의 "인쇄 CSS 무변경이니 안전" 전제 무효 |
| **F7** | 보강 | **리터럴에서 5개 제한은 근거 없음** — 조용한 결함이 된다 → 10개(D9) |
| **F8** | 보강 | 프리셋 소비처는 2곳이 아니라 **3곳 + 진입점 1개**(§1.4) |
| **F9** | 보강 | proofread 위험 하나 줄고 하나 늘었다 — `autoWrap*`은 한글 리터럴을 애초에 안 잡는다(이득) / `maskForProofread`의 `\s*`는 연속 빈 마커 행에서 둘째를 놓친다(v1은 "확인만"으로 미뤘다 → 고치는 게 맞다) |
| **F10** | 보강 | v1이 못 본 Phase 59 자산 `lib/solutionOutline.ts` — `SCANNED_TYPES`에 gana·roman (§7.3-1) |
| **F11** | 보강 | 사본 2개의 정규식이 이미 문자열로 어긋나 있다 → 상수 공유(P4·D12) |
| **F12** | 보강 | locale.ts에 테스트가 없다 → `test:locale` 신설(D13) |
| **F13** | 확인 | v1 §5 파급 검토 전건 타당. AI 프롬프트 마커 지시 없음을 grep으로 확정 |
| **F14** | 확인 | 리터럴 코드포인트 확인 — `ㄱ`=U+3131 호환 자모(테이블과 동일) · `가`=U+AC00 완성형 |
| **F15** | **보강(신규)** | **지금 손으로 `(가)`를 입력하면 문단이 뭉친다** — `insertMarkerLineBreaks` 미인식 + `remark-breaks` 부재. P1은 편의 개선이 아니라 **현존 결함 수정**이고, 동시에 기존 리터럴 문항의 렌더가 바뀐다(§0.2·§7.2·T14). v1·v2 초판 모두 놓쳤다 |

## 부록 C — 후속 후보 (본 Phase 범위 밖)

1. **`.marker-circled` 누출 정리**(D11) — globals `!important`가 덮어 무해하나 같은 부채. 원문자 여백 체계(Phase 57~59)와 얽혀 별 작업.
2. **인쇄 giyeok 폭 2.5em → 2em 통일** — 화면과 값을 맞추려면 1줄. 인쇄 산출물이 바뀌므로 별도 승인(Q2 유지 결정).
3. **EditorPreview 인라인 `preprocessLocale` → locale.ts 통합**(D12) — 정규식은 공유했지만 단계 순서·`locale` 게이트는 여전히 사본.
4. **`locale` prop 되살리기** — EditorPreview가 prop을 안 읽는다(§1.1). 두 번째 로케일 착수 시(Q5).
5. **레거시 (a)/(i) → 리터럴 일괄 변환 도구**(Q1에서 "안 만든다") — 필요해지면 Phase 59 Q5의 "레거시 → 블록 자동 변환 도구"와 묶어서.
6. **PrintStyles 98-113의 화면 누출** — `.tag-marker`·`.katex-display .tag`도 `@media print` 밖 무접두다. globals에 동일 값이 있어 현재는 무해하나 같은 종류의 부채.
7. **사용 가이드 한 줄** — `**(가) 핵심**`은 마커가 안 붙는다(§7.3-3). `docs/사용 가이드 — 강조와 톤.md`에 추가.
