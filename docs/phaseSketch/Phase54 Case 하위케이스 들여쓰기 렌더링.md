# Phase 54 — Case 하위 케이스(sub-case) 들여쓰기 렌더링

작성일: 2026-07-05 · 기준 커밋: `0a4d131` (Phase 53 E단계)

---

## 0. 선행 확인 (CLI 필수)

구현 시작 전 반드시 최신 레포를 클론하고 아래 위치가 본 문서와 일치하는지 확인할 것.
불일치 시 **구현을 멈추고 보고** (이 문서의 file:line은 커밋 `0a4d131` 기준).

| 확인 항목 | 위치 |
|---|---|
| EditorPreview 인라인 `preprocessLocale` | `components/editor/EditorPreview.tsx:84` |
| EditorPreview 파이프라인 호출부 | `components/editor/EditorPreview.tsx:253-254` (`protectFences` → `preprocessLocale` → `preprocessMath`) |
| 공용 `preprocessLocale` | `lib/locale.ts:131` |
| 공용 파이프라인 `preprocess()` | `lib/preprocess.ts:171` |
| `protectMath` / `restoreMath` export | `lib/locale.ts:153-165` (named export 목록에 포함됨) |
| 화면용 ul 불릿 CSS | `app/globals.css:202-216` (`ul { list-style:none }` + `ul li::before { content:"•" }`) |
| loose list 첫 `<p>` inline 처리 | `app/globals.css:221-225` |
| 인쇄용 ul 불릿 CSS | `components/print/PrintStyles.css:55-58` |
| `rehype-sanitize` 미사용 | EditorPreview / PrintableContent 모두 `rehype-raw`만 사용 (grep으로 확인됨) |

---

## 1. 목표

수학 풀이의 경우 분석(case analysis)에서 **하위 케이스(sub-case)를 한 단계 들여쓰기**해 렌더링한다.

국제 표준 관행(AMS 스타일):
- 상위 케이스: `**Case 1.**` — 들여쓰기 없는 일반 문단 (기존 규약, 변경 없음)
- 하위 케이스: `**Case 1a.**` — 한 단계 들여쓰기, 최대 2단계 중첩 (기존 규약)

## 2. 확정 결정 사항 (변경 금지)

| # | 결정 | 내용 |
|---|---|---|
| D1 | 저장 canonical form | 하위 케이스는 **마크다운 리스트 항목**으로 저장: `- **Case 1a.** 본문…` 리스트 마커는 `- ` 만 인정 (`*`, `+` 불인정). 하위 케이스 라벨은 `Case <숫자><영문소문자 1글자>.` 단일 형식 (예: `Case 1a.`, `Case 12b.`) |
| D2 | 들여쓰기 구현 방식 | **nested list + 불릿 숨김** (선택지 1번). 들여쓰기 폭은 기존 `ul` 규칙(padding-left 1.4em + margin-left 1em)을 그대로 상속 — 신규 들여쓰기 값 도입 금지 |
| D3 | 불릿 숨김 타겟팅 | 전처리기가 하위 케이스 라벨을 `<span class="marker-case-sub">**Case 1a.**</span>` 로 감싸고, CSS `:has()`로 해당 li의 `::before` 불릿만 제거. **일반 불릿 리스트에는 영향 없어야 함** |
| D4 | 로케일 처리 | `Case` 표기는 국제/한국 로케일 모두 **원문 유지**. `Case → 경우` 한글화는 본 Phase 범위 밖 (추후 별도 결정). 따라서 변환 함수는 locale 분기 **밖에서 무조건 실행** |
| D5 | 원문 불변 | Firestore `raw_text` 는 절대 수정하지 않음. span 주입은 렌더 시점 전처리에서만 발생 (기존 marker-gana 패턴과 동일) |
| D6 | proofread 경로 | 신규 변환 함수는 `preprocessLocale` 내부가 아닌 별도 함수이므로 proofread 경로에 영향 없음. 단, proofread 경로에서 이 함수를 **호출하지 않도록** 확인할 것 |

## 3. 사전 검증 완료 사항 (실제 파이프라인으로 재현 확인됨)

`remark-parse + remark-gfm + remark-rehype(allowDangerousHtml) + rehype-raw` 조합으로 검증:

1. `- <span class="marker-case-sub">**Case 1a.**</span> 본문` →
   **tight list**: `<li><span class="marker-case-sub"><strong>Case 1a.</strong></span> 본문</li>`
   (span 안의 `**bold**`가 정상적으로 `<strong>` 파싱됨 — rehype-raw가 span을 재구성)
2. **loose list** (항목 사이 빈 줄): `<li><p><span class="marker-case-sub">…</p></li>` — span이 `<p>` 안으로 들어감. **CSS는 두 구조 모두 커버해야 함** (아래 5절 셀렉터 참고)
3. **paragraph interrupt**: `**Case 1.** 본문` 바로 다음 줄에 빈 줄 없이 `- **Case 1a.**` 가 와도 CommonMark 규칙상 리스트로 정상 분리됨 → **빈 줄 강제 삽입 전처리 불필요** (전처리 최소화)

## 4. lib 변경

### 4-1. `lib/locale.ts` — 신규 함수 추가

`convertTableLabels` (line 123) 아래에 추가하고 named export 목록(line 153-165)에 포함:

```typescript
/** 하위 케이스 라벨 → marker span (불릿 숨김 + 들여쓰기 타겟팅용)
 *  `- **Case 1a.** …` 행 시작 리스트 항목만 매칭.
 *  상위 케이스(`**Case 1.**`, 리스트 밖)는 변환하지 않음.
 *  로케일 무관 — preprocessLocale 밖에서 무조건 호출됨 (D4). */
export function convertSubcaseMarkers(text: string): string {
  return text.replace(
    /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
  );
}
```

주의:
- `**…**` 를 span **안쪽에 유지**해야 remark가 strong으로 파싱함 (3절 검증 1 참조)
- 라벨의 마침표는 span 안에 포함 (`**Case 1a.**` 전체가 볼드)

### 4-2. `lib/preprocess.ts` — 파이프라인에 단계 추가

`preprocess()` (line 171) 의 2단계(locale)와 3단계(math) 사이에 삽입.
수식 내부 오탐 방지를 위해 `protectMath`/`restoreMath` 로 감쌈 (이미 `lib/locale.ts:153-165` 에서 export 됨 — import 문에 추가 필요):

```typescript
// 2.5단계: 하위 케이스 marker (로케일 무관 — D4)
const { cleaned, placeholders } = protectMath(localized);
const withSubcase = restoreMath(convertSubcaseMarkers(cleaned), placeholders);

// 3단계: 수식 문법 변환 — 입력을 localized → withSubcase 로 교체
const processed = preprocessMath(withSubcase);
```

### 4-3. `components/editor/EditorPreview.tsx` — 인라인 파이프라인에 동일 로직 추가

EditorPreview는 자체 인라인 전처리를 사용하므로(파일 상단 주석 및 `lib/preprocess.ts:10` 주석 참조) 동일 변환을 별도 반영해야 함. `\tag` 가 3개 구현 지점에 중복된 것과 같은 기존 패턴.

인라인 `preprocessLocale` (line 84) 내부, **2단계(마커 행 빈 줄 삽입, line ~98-113) 직후 / 3단계(gana 변환) 직전**에 추가:

```typescript
// 2.5. 하위 케이스 라벨 → marker span (수식 보호 구간 내에서 실행)
t = t.replace(
  /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
  (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
);
```

- 이 지점은 이미 수식이 `⟦MATH_n⟧` 으로 보호된 상태이며, `protectFences` (line 253) 이후이므로 코드펜스도 보호됨 — 추가 보호 불필요
- **`lib/locale.ts` 의 함수를 import 해서 재사용하지 말 것**: EditorPreview 인라인 전처리는 의도적으로 독립 구현 (기존 구조 유지). 정규식 리터럴이 두 곳에서 반드시 동일해야 함 — 수용 체크리스트에 diff 확인 항목 있음

## 5. CSS 변경 (2곳)

### 5-1. `app/globals.css` — 화면용

`ul ul li::before` (line 214-216) 블록 아래에 추가:

```css
/* ═══ Case 하위 케이스 (sub-case) — 불릿 숨김 들여쓰기 (Phase 54) ═══
   tight list: li > span / loose list: li > p > span — 두 구조 모두 커버.
   직계 자식 셀렉터를 사용해 중첩 리스트 내부 span의 상위 li 오탐 방지. */
li:has(> .marker-case-sub)::before,
li:has(> p:first-child > .marker-case-sub)::before {
  content: none;
}
```

- `:has()` 는 이미 프로젝트에서 사용 중 (`app/globals.css:234` `p:has(.marker-gana)`) — 브라우저 지원 이슈 없음
- 들여쓰기 자체는 기존 `ul` 규칙이 제공하므로 **추가 padding/margin 금지** (D2)
- `.marker-case-sub` 자체에는 스타일 불필요 (볼드는 `<strong>` 이 담당)

### 5-2. `components/print/PrintStyles.css` — 인쇄용

인쇄 경로는 자체 `li::before` 정의가 있음 (line 57). `ul ul li::before` (line 58) 아래에 추가:

```css
.print-body li:has(> .marker-case-sub)::before,
.print-body li:has(> p:first-child > .marker-case-sub)::before { content: none; }
```

## 6. 데이터 모델 / Firestore 규칙 변경

**없음.** raw_text 저장 형식은 순수 마크다운(D1)이므로 스키마·보안 규칙 무관.

## 7. 범위 제외 (Out of scope — 구현 금지)

- `Case → 경우` 한글화 (D4, 추후 Phase)
- 상위 케이스(`**Case 1.**`)의 상단 여백 등 타이포그래피 폴리시
- MathSnippetMenu 에 Case/sub-case 스니펫 버튼 추가 (편의 기능, 후속 검토)
- EditorPreview 인라인 전처리와 lib/preprocess.ts 통합 리팩터링

## 8. 리스크

| 리스크 | 대응 |
|---|---|
| 일반 불릿 리스트의 불릿이 사라짐 | 셀렉터가 `.marker-case-sub` 포함 li 만 매칭 — 수용 테스트 T4로 검증 |
| `- **Case 1a.**` 가 아닌 유사 패턴 오탐 (예: 본문 중간의 `**Case 1a.**`) | 정규식이 `^-\s+` 행 시작 앵커 — 리스트 항목 시작만 매칭 |
| 수식/코드펜스 내부 오변환 | lib 경로는 protectMath 감쌈, EditorPreview 경로는 기존 보호 구간 내 실행 |
| tight/loose 구조 차이로 CSS 미적용 | 두 셀렉터 모두 명시 (3절 검증 2, 5절) |
| 두 구현 지점의 정규식 불일치 (drift) | 수용 체크리스트 T7 |

## 9. 수용 체크리스트

- [ ] T1: `**Case 1.**` 문단 + `- **Case 1a.**` / `- **Case 1b.**` 입력 시, 에디터 미리보기에서 하위 케이스가 한 단계 들여쓰기되고 **불릿(•)이 보이지 않음**, 라벨은 볼드
- [ ] T2: 하위 케이스 항목 사이에 빈 줄을 넣어도(loose list) T1과 동일하게 렌더링
- [ ] T3: 하위 케이스 본문에 `$…$` 인라인 수식 포함 시 정상 렌더 (displaystyle 적용 포함)
- [ ] T4: Case 와 무관한 일반 `- 항목` 리스트는 기존처럼 • 불릿 표시 (회귀 없음)
- [ ] T5: ProblemView(문제 보기) 및 Bazaar 공개 뷰어에서 T1 동일 확인 (둘 다 EditorPreview 경유)
- [ ] T6: PDF 인쇄 미리보기(PrintableContent)에서 T1 동일 확인 — 5-2 CSS 적용 검증
- [ ] T7: `lib/locale.ts` 와 `EditorPreview.tsx` 의 하위 케이스 정규식 리터럴이 문자 단위로 동일
- [ ] T8: proofread 경로에서 `convertSubcaseMarkers` 가 호출되지 않음 (raw_text 오염 없음)
- [ ] T9: 수식 `$$…$$` 블록 내부에 `- **Case` 형태 문자열이 있어도 변환되지 않음

## 10. 커밋 가이드

- 커밋 1: `lib/locale.ts` + `lib/preprocess.ts` (전처리 함수 + 파이프라인)
- 커밋 2: `components/editor/EditorPreview.tsx` (인라인 전처리)
- 커밋 3: `app/globals.css` + `components/print/PrintStyles.css` (불릿 숨김 CSS)
- 커밋 메시지 접두: `Phase 54:`
- **git push 는 덕수가 VSCode에서 직접 수행** — CLI는 커밋까지만 하고 push 명령어를 제시할 것
