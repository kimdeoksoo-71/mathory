# Phase 54 — Case 하위 케이스(sub-case) 들여쓰기 렌더링 **v3 (최종)**

작성일: 2026-07-05 · 개정: 2026-07-05(v2) → 2026-07-05(v3) · 기준 커밋: `0a4d131` (Phase 53 E단계)

> **v3 개정 요약** — v2를 원 저자(web Claude)가 재검토. v2의 핵심 변경 3건(경계 정규화·1단계 확정·스니펫 버튼)은 모두 실코드/실파이프라인으로 재검증되어 **승인·유지**. 여기에 정정 3건을 반영:
> **A** §4-2의 "펜스 보호" 주장 오류 정정 (protectMath는 수식만 보호 — 인쇄 경로 펜스 노출은 기존 조건으로 문서화),
> **B** §5-1 CSS 특이도 숫자 정정 ((0,2,2) → (0,1,2), 결론은 유효),
> **C** raw_text 저장 경로 오염 금지 조항 신설 (`EditorView.tsx:2141` 저장 체인에 신규 함수 추가 절대 금지) + 체크리스트 T12 추가.
> 상세는 문서 맨 끝 **§12(v2 변경 설명) · §13(v3 변경 설명)** 참조.

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
| `insertMarkerLineBreaks` (참고 패턴) | `lib/locale.ts:57` |
| `protectMath` / `restoreMath` export | `lib/locale.ts:153-165` (named export 목록에 포함됨) |
| 화면용 ul 불릿 CSS | `app/globals.css:202-216` (`ul { list-style:none }` + `ul li::before { content:"•" }`) |
| loose list 첫 `<p>` inline 처리 | `app/globals.css:221-224` |
| 인쇄용 ul 불릿 CSS | `components/print/PrintStyles.css:55-58` |
| 스니펫 삽입 경로 (원문 삽입, `$` 래핑 없음) | `components/editor/EditorView.tsx:1823-1826` (`handleSnippetInsert` → `insertText(content, content.length)`) |
| MathSnippetMenu 렌더/삽입 | `components/editor/MathSnippetMenu.tsx:8, 163-289`, 삽입 호출 `188-191` |
| UnifiedToolbar의 MathSnippetMenu 마운트 | `components/editor/UnifiedToolbar.tsx:783-793` |
| **⚠️ raw_text 저장 경로 (수정 금지 대상 — D8)** | `components/editor/EditorView.tsx:24, 2141` (`normalizeDisplayMathSpacing`이 저장 시 raw_text를 정규화해 Firestore에 씀) |
| `rehype-sanitize` 미사용 | EditorPreview / PrintableContent 모두 `rehype-raw`만 사용 (grep으로 확인됨) |
| proofread 라우트의 전처리 미사용 | `app/api/proofread/route.ts` — preprocess/locale 계열 import 없음 (grep으로 확인됨) |

---

## 1. 목표

수학 풀이 중 경우 분석(case analysis)에서 **하위 케이스(sub-case)를 한 단계 들여쓰기**해 렌더링한다.

국제 표준 관행(AMS 스타일):
- 상위 케이스: `**Case 1.**` → 들여쓰기 없는 일반 문단 (기존 규약, 변경 없음)
- 하위 케이스: `- **Case 1a.**` → **한 단계 들여쓰기, 1단계만** (v2에서 확정, §12 참조)

## 2. 확정 결정 사항 (변경 금지)

| # | 결정 | 내용 |
|---|---|---|
| D1 | 저장 canonical form | 하위 케이스는 **마크다운 리스트 항목**으로 저장: `- **Case 1a.** 본문…` 리스트 마커는 `- ` 만 인정 (`*`, `+` 불인정). 하위 케이스 라벨은 `Case <숫자><영소문자 1글자>.` 단일 형식 (예: `Case 1a.`, `Case 12b.`) |
| D2 | 들여쓰기 구현 방식 | **top-level 리스트 + 불릿 숨김**. 부모 `**Case 1.**` 는 문단(리스트 아님)이고, 하위 케이스들은 **최상위 `ul`** 이 된다. 들여쓰기는 중첩이 아니라 **기본 `ul` 스타일**(padding-left 1.4em + margin-left 1em ≈ 2.4em)이 제공 → 신규 들여쓰기 값 도입 금지 |
| D3 | 불릿 숨김 타게팅 | 전처리기가 하위 케이스 라벨을 `<span class="marker-case-sub">**Case 1a.**</span>` 로 감싸고, CSS `:has()`로 해당 `li`의 `::before` 불릿만 제거. **일반 불릿 리스트에는 영향 없어야 함** |
| D4 | 로케일 처리 | `Case` 표기는 국제/한국 로케일 모두 **영문 유지**. `Case → 경우` 한글화는 본 Phase 범위 밖. 따라서 변환 함수는 locale 분기 **밖에서 무조건 실행** |
| D5 | 원문 불변 | Firestore `raw_text` 는 절대 수정하지 않음. span 주입·경계 정규화는 렌더 직전 전처리에서만 반영 (기존 marker-gana 패턴과 동일) |
| D6 | proofread 격리 | 신규 변환/정규화 함수는 `preprocessLocale` 내부가 아닌 별도 함수이므로 proofread 경로에 영향 없음. 단, proofread 경로에서 이 함수들을 **호출하지 않는지** 실호출부로 확인할 것 (T8) |
| D7 | 경계 정규화 (v2 신규) | 하위 케이스 리스트 뒤에 오는 새 `**Case N.**` 라벨이 CommonMark **lazy continuation**으로 직전 리스트 항목에 흡수되는 것을 막기 위해, 최상위 `**Case …**` 라벨 행 앞에 빈 줄을 강제 삽입한다 (`insertMarkerLineBreaks`와 동일 패턴). §4-0 참조 |
| **D8** | **저장 경로 오염 금지 (v3 신규)** | `normalizeCaseBoundaries` / `convertSubcaseMarkers` 는 **렌더 파이프라인 전용**이다. `EditorView.tsx:2141` 의 raw_text 저장 체인(`normalizeDisplayMathSpacing` 후처리)을 포함해, **Firestore에 기록되는 어떤 경로에도 추가 금지**. 그 체인은 저장 raw_text를 실제로 수정하는 경로이므로 신규 함수 추가 시 D5 위반. "일관성"을 이유로 한 선의의 추가도 금지 (T12) |

## 3. 사전 검증 완료 사항 (실제 파이프라인으로 재확인됨)

`remark-parse + remark-gfm + remark-rehype(allowDangerousHtml) + rehype-raw` 조합으로 검증:

1. `- <span class="marker-case-sub">**Case 1a.**</span> 본문` →
   **tight list**: `<li><span class="marker-case-sub"><strong>Case 1a.</strong></span> 본문</li>`
   (span 안의 `**bold**`가 정상적으로 `<strong>` 파싱됨 → rehype-raw가 span을 재구성)
2. **loose list** (항목 사이 빈 줄): `<li><p><span class="marker-case-sub">…</p></li>` → span이 `<p>` 안으로 들어감. **CSS는 두 구조 모두 커버해야 함** (§5 두 셀렉터)
3. **paragraph interrupt (진입)**: `**Case 1.** 본문` 바로 다음 줄에 빈 줄 없이 `- **Case 1a.**` 가 와도 CommonMark 규칙상 bullet이 문단을 interrupt하여 리스트로 정상 분리됨 → **진입은 빈 줄 삽입 불필요**
4. **lazy continuation (탈출) — v2에서 반영, v3에서 재실증**: 하위 케이스 리스트 **뒤**에 빈 줄 없이 일반 문단(특히 `**Case 2.**` 같은 다음 케이스)이 오면, 그 줄이 직전 리스트 항목의 문단으로 **흡수**된다.
   예:
   ```
   **Case 1.** $x>0$ 가정.
   - **Case 1a.** …
   - **Case 1b.** …
   **Case 2.** 이제 …          ← 빈 줄 없음 → Case 2가 Case 1b 안으로 흡수됨(버그)
   ```
   → **D7 경계 정규화로 해결** (§4-0). 진입(3)과 달리 탈출은 반드시 처리해야 함.
   (v3 재검증: 흡수 현상과 빈 줄 삽입 후 정상 분리 모두 실파이프라인 재현 확인됨)

## 4. lib 변경

### 4-0. `lib/locale.ts` — 경계 정규화 함수 신설 (v2 신규 · D7)

`insertMarkerLineBreaks` (line 57) 아래에 추가하고 named export(line 153-165)에 포함:

```typescript
/** 하위 케이스 리스트 뒤 새 `**Case …**` 라벨이 lazy continuation으로
 *  직전 리스트 항목에 흡수되는 것을 방지 (D7, §3-4).
 *  - 대상: 행 시작이 `**Case <숫자>…**` 인 "최상위" 라벨 행
 *    (리스트 마커 `- ` 로 시작하는 하위 케이스 행은 `^\*\*` 에 걸리지 않으므로 자동 제외)
 *  - 이전 행이 비어있지 않을 때만 빈 줄 삽입 (insertMarkerLineBreaks와 동일 패턴)
 *  - 최상위 Case 문단 앞 빈 줄 삽입은 항상 무해 → 진입 케이스에도 부작용 없음
 *  - 수식이 placeholder로 보호된 뒤 호출되어야 안전 (§4-2 배치 참조)
 *  - ⚠️ 렌더 파이프라인 전용 — raw_text 저장 경로 호출 금지 (D8)
 *
 *  한계(문서화): `**Case …**` 형태가 아닌 자유 문단이 하위 케이스 뒤에
 *  빈 줄 없이 이어지면 여전히 CommonMark 표준대로 흡수됨(일반 리스트와 동일 동작).
 *  실무 지배 사례인 "연속된 Case 라벨"만 이 함수로 보증. 템플릿 버튼(§9)이 올바른
 *  줄바꿈을 유도해 이 한계 노출을 최소화한다.
 *
 *  참고: `[a-z]?` 로 인해 작성자가 `- `를 빠뜨린 최상위 `**Case 1a.**`(작성 실수)에도
 *  빈 줄이 삽입되지만 무해함 — 해당 행은 들여쓰기 없이 렌더되어 실수가 눈에 띈다. */
export function normalizeCaseBoundaries(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    // 최상위 Case 라벨: 행 시작 `**Case 1.**` / `**Case 1a.**` (리스트 `- ` 없음)
    const isTopCaseLabel = /^\*\*Case\s+\d+[a-z]?\.\*\*/.test(line);
    const prev = out.length > 0 ? out[out.length - 1] : '';
    if (isTopCaseLabel && prev.trim() !== '') {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
}
```

### 4-1. `lib/locale.ts` — 하위 케이스 마커 변환 함수 신설

`normalizeCaseBoundaries` 아래에 추가하고 named export에 포함:

```typescript
/** 하위 케이스 라벨 → marker span (불릿 숨김 + 들여쓰기 타게팅용)
 *  `- **Case 1a.** …` 형태의 최상위 리스트 항목만 매칭.
 *  상위 케이스(`**Case 1.**`, 리스트 밖)는 변환하지 않음.
 *  로케일 무관 → preprocessLocale 밖에서 무조건 호출됨 (D4).
 *  ⚠️ 렌더 파이프라인 전용 — raw_text 저장 경로 호출 금지 (D8) */
export function convertSubcaseMarkers(text: string): string {
  return text.replace(
    /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
  );
}
```

주의:
- `**…**` 를 span **안쪽에 유지**해야 remark가 strong으로 파싱함 (§3 검증 1 참조)
- 라벨의 마침표는 span 안에 포함 (`**Case 1a.**` 전체가 볼드)

### 4-2. `lib/preprocess.ts` — 파이프라인에 단계 추가

`preprocess()` (line 171) 의 2단계(locale)와 3단계(math) 사이에 삽입.
수식 내부 오변환 방지를 위해 `protectMath`/`restoreMath` 로 감쌈 (이미 `lib/locale.ts:153-165`에서 export됨 → import 문에 `protectMath, restoreMath, normalizeCaseBoundaries, convertSubcaseMarkers` 추가):

```typescript
// 2.5단계: 하위 케이스 경계 정규화(D7) + marker span (로케일 무관 — D4)
const { cleaned, placeholders } = protectMath(localized);
const bounded = normalizeCaseBoundaries(cleaned);        // ← v2: lazy continuation 방지
const withSubcase = restoreMath(convertSubcaseMarkers(bounded), placeholders);

// 3단계: 수식 문법 변환 — 입력을 localized → withSubcase 로 교체
const processed = preprocessMath(withSubcase);
```

> `normalizeCaseBoundaries` 는 `**Case`(리스트 마커 없는 최상위)만 건드리고,
> `convertSubcaseMarkers` 는 `- **Case Nx.**`(리스트 항목)만 건드리므로 **순서 무관·상호 비간섭**.
> 단 둘 다 `protectMath` 보호 구간 안에서 실행해야 `$$…- **Case…**…$$` 오변환을 막을 수 있음.

> **⚠️ v3 정정 (A) — 펜스 보호 범위**: `protectMath` 는 **수식만** 보호하며 코드펜스는 보호하지 않는다.
> `protectFences` 는 Phase 42에서 **EditorPreview 인라인 파이프라인에만** 추가되었고,
> `lib/preprocess.ts` 경로(PrintableContent → PDF 인쇄)에는 펜스 보호가 존재하지 않는다.
> 따라서 인쇄 경로에서 코드펜스 안에 `- **Case 1a.**` / `**Case N.**` 형태의 행이 있으면 변환된다.
> 이는 기존 마커 변환((가), (ㄱ), ① 등)도 동일하게 노출되어 온 **기존 조건**이며,
> Case 정규식은 행 시작 앵커라 실제 발생 가능성이 낮으므로 **본 Phase에서 신규 보호를 추가하지 않고
> 기존 노출로 문서화**한다 (§8 리스크 표 참조). 인쇄 경로 펜스 보호 도입은 별도 Phase 대상.

### 4-3. `components/editor/EditorPreview.tsx` — 인라인 파이프라인에 동일 로직 추가

EditorPreview는 자체 인라인 전처리를 사용하므로(`lib/preprocess.ts:10` 주석 참조) 동일 변환을 별도 반영해야 함. `\tag` 가 3곳에 중복 구현된 것과 같은 기존 패턴.

인라인 `preprocessLocale` (line 84) 내부, **2단계(마커 행 빈 줄 삽입, line ~99-112) 이후 / 3단계(gana 변환) 이전**에 추가 (이미 수식이 `⟦MATH_n⟧`로 보호된 상태이고 `protectFences`(line 253) 이후이므로 이 경로에서는 코드펜스도 보호됨):

```typescript
// 2.5. (v2) 하위 케이스 경계 정규화 — 최상위 `**Case …**` 라벨 행 앞 빈 줄 강제
{
  const bl = t.split('\n');
  const acc: string[] = [];
  for (const ln of bl) {
    const isTopCase = /^\*\*Case\s+\d+[a-z]?\.\*\*/.test(ln);
    const pv = acc.length > 0 ? acc[acc.length - 1] : '';
    if (isTopCase && pv.trim() !== '') acc.push('');
    acc.push(ln);
  }
  t = acc.join('\n');
}

// 2.6. 하위 케이스 라벨 → marker span (수식 보호 구간 내에서 실행)
t = t.replace(
  /^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
  (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`
);
```

- **`lib/locale.ts` 의 함수를 import해 재사용하지 말 것**: EditorPreview 인라인 전처리는 의도적으로 독립 구현(기존 구조 유지). 정규식·로직은 두 곳이 반드시 동일해야 함 → §11 체크리스트 T7로 검증
- 인라인 판의 정규화 블록과 lib의 `normalizeCaseBoundaries` 는 **로직·정규식이 동일**해야 함 (T7 범위에 포함)

## 5. CSS 변경 (2곳)

### 5-1. `app/globals.css` — 화면용

`ul ul li::before` (line 214-216) 블록 아래에 추가:

```css
/* ─── Case 하위 케이스(sub-case) — 불릿 숨김 들여쓰기 (Phase 54) ───
   tight list: li > span / loose list: li > p > span → 두 구조 모두 커버.
   자식 결합자를 사용해 (혹시 모를) 중첩 span이 상위 li 매칭을 트리거하지 않도록 함.
   들여쓰기 자체는 기존 top-level ul 규칙이 제공 → 추가 padding/margin 금지 (D2). */
li:has(> .marker-case-sub)::before,
li:has(> p:first-child > .marker-case-sub)::before {
  content: none;
}
```

- `:has()` 는 이미 프로젝트에서 사용 중 (`app/globals.css:234` `p:has(.marker-gana)`) → 브라우저 지원 이슈 없음
- **특이도 (v3 정정 B)**: `:has()` 는 인자 목록 중 가장 높은 특이도를 취한다.
  첫 셀렉터 `li:has(> .marker-case-sub)::before` = li(0,0,1) + :has(인자 `.marker-case-sub` = (0,1,0)) + ::before(0,0,1) = **(0,1,2)**
  둘째 셀렉터 `li:has(> p:first-child > .marker-case-sub)::before` = li + :has(인자 = (0,2,1)) + ::before = **(0,2,3)**
  기존 `ul li::before` = (0,0,3) → **두 셀렉터 모두 이김** (결론 유효, v2의 (0,2,2) 표기만 정정)
- `content: none` 시 `::before` 박스 자체가 생성 안 됨 → 불릿과 함께 hanging-indent 음수 마진도 사라져 라벨+본문이 자연 들여쓰기로 흐름 (의도된 동작)
- `.marker-case-sub` 자체엔 스타일 불필요 (볼드는 `<strong>` 이 담당)

### 5-2. `components/print/PrintStyles.css` — 인쇄용

`.print-body ul ul li::before` (line 58) 아래에 추가:

```css
.print-body li:has(> .marker-case-sub)::before,
.print-body li:has(> p:first-child > .marker-case-sub)::before { content: none; }
```

- 특이도: `.print-body li:has(> .marker-case-sub)::before` = (0,2,2) > 기존 `.print-body ul li::before` (0,1,3) → 이김 (v3 재계산 결과 이 값은 정확함)

## 6. 데이터 모델 / Firestore 규칙 변경

**없음.** raw_text 저장 형식은 순수 마크다운(D1)이므로 스키마·보안 규칙 무관.

## 7. 범위 선언 (Out of scope — 구현 금지)

- `Case → 경우` 한글화 (D4, 추후 Phase)
- 상위 케이스(`**Case 1.**`)의 상단 여백 등 타이포그래피 폴리싱
- 하위 케이스 2단계 이상 중첩 (v2에서 **1단계로 확정**, §12 참조)
- EditorPreview 인라인 전처리와 lib/preprocess.ts 통합 리팩터링
- **인쇄 경로(lib/preprocess.ts)에 펜스 보호(`protectFences`) 도입** (v3 신규 명시 — §4-2 정정 A 참조, 기존 조건이므로 별도 Phase 대상)

## 8. 리스크

| 리스크 | 대응 |
|---|---|
| 일반 불릿 리스트의 불릿이 사라짐 | 셀렉터가 `.marker-case-sub` 포함 li 만 매칭 → T4로 검증 |
| `- **Case 1a.**` 가 아닌 유사 패턴 오변환 (본문 중간 `**Case 1a.**`) | 정규식이 `^-\s+` 로 리스트 항목 시작만 매칭 |
| 최상위 `**Case`가 아닌 자유 문단이 하위 케이스 뒤 흡수 | D7 한계로 문서화. 지배 사례(연속 Case 라벨)는 보증. 템플릿 버튼이 올바른 줄바꿈 유도 |
| 수식 내부 오변환 | lib 경로는 protectMath 감쌈, EditorPreview 경로는 기존 보호 구간 내 실행 (T9) |
| **인쇄 경로 코드펜스 내부 오변환 (v3 정정 A)** | **기존 조건** — lib 경로엔 원래 펜스 보호가 없어 기존 마커 변환들도 동일 노출. Case 정규식은 행 앵커라 위험도 낮음. 본 Phase 범위 밖으로 문서화 (§7) |
| **저장 raw_text 오염 (v3 신규 · D8)** | 신규 함수를 `EditorView.tsx:2141` 저장 체인 등 Firestore 기록 경로에 추가 금지 → T12로 검증 |
| tight/loose 구조 차이로 CSS 미적용 | 두 셀렉터 모두 명시 (§3 검증 2, §5) |
| 두 구현 지점의 정규식/로직 불일치 (drift) | T7 (정규화 블록 + 변환 정규식 모두 대조) |

## 9. MathSnippetMenu — Case/하위 케이스 템플릿 버튼 (v2 신규)

### 9-0. 설계 근거 (실코드 확인됨 · v3에서 원 저자 재검증 완료)

- 스니펫 삽입은 `handleSnippetInsert` → `insertText(content, content.length)` 로 **원문을 그대로 삽입** (`$…$` 래핑 없음). 확인: `components/editor/EditorView.tsx:1823-1826`. → Case 템플릿은 순수 마크다운이므로 **그대로 삽입 가능**
- `MathSnippetMenu.onInsert(content: string)` 하나로 삽입 (`components/editor/MathSnippetMenu.tsx:8, 188-191`)
- 기존 사용자 상용구는 Firestore(`users/{uid}/math_snippets`) CRUD이고 단축키 ⌃⌥1-9를 소비. Case 템플릿은 **내장 상수**로, 사용자 상용구와 분리·단축키 미소비

### 9-1. 구현 방식 — 리스트 모드 상단 "구조 템플릿" 내장 그룹

`MathSnippetMenu` 의 `mode === 'list'` 블록(line 163-289) 안, 사용자 상용구 목록(line 165-257) **위**에 내장 템플릿 섹션을 추가. CRUD 대상이 아니므로 편집/삭제 버튼 없이 클릭 시 `onInsert` 만 호출.

내장 상수 (컴포넌트 상단 모듈 스코프):

```typescript
// 내장 구조 템플릿 (사용자 상용구와 별개 · 단축키 미소비)
const STRUCTURE_TEMPLATES: { label: string; insert: string }[] = [
  { label: 'Case (상위)',      insert: '**Case 1.** ' },
  { label: 'Case 하위 (a)',    insert: '- **Case 1a.** ' },
  { label: 'Case 하위 (b)',    insert: '- **Case 1b.** ' },
];
```

렌더 (리스트 모드 최상단, 사용자 목록 위):

```tsx
{mode === 'list' && (
  <>
    {/* 내장 구조 템플릿 */}
    <div style={{ padding: '4px 0', borderBottom: '1px solid #f0efe9' }}>
      <div style={{ padding: '4px 14px', fontSize: 11, color: '#aaa' }}>구조 템플릿</div>
      {STRUCTURE_TEMPLATES.map((t) => (
        <div
          key={t.label}
          style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', cursor: 'pointer', gap: 8 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f4f0'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          onClick={() => { onInsert(t.insert); onClose(); }}
        >
          <span style={{ flex: 1, fontSize: 13, color: '#3D3929' }}>{t.label}</span>
          <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'monospace' }}>{t.insert.trim()}</span>
        </div>
      ))}
    </div>

    {/* 기존 사용자 상용구 목록 (line 165~257) 그대로 이어짐 */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {/* … 기존 코드 … */}
    </div>
    {/* … 기존 "새 상용구 등록" 하단 버튼 … */}
  </>
)}
```

### 9-2. 삽입 문자열·커서 주의

- 삽입 문자열은 **끝에 공백 1개** 포함(`'- **Case 1a.** '`) → 사용자가 곧바로 본문 타이핑
- `handleSnippetInsert` 는 커서를 삽입 끝으로 이동(`content.length`) → 라벨 뒤에 커서가 위치, 자연스러움
- 하위 케이스 템플릿은 `- ` 로 시작하므로, 커서가 줄 중간이면 리스트가 정상 분리되도록 사용자가 새 줄에서 삽입하는 것을 권장 (버튼 라벨/툴팁으로 안내). **자동 개행 삽입은 커서 위치 예측이 어려워 본 Phase 범위 밖** — 필요 시 후속에서 `\n` prefix 검토

### 9-3. 범위 제한

- 번호 자동 증가(1a, 1b, 2a …)나 컨텍스트 인식은 **범위 밖**. 고정 문자열 3종만 제공
- 단축키 부여 없음 (사용자 상용구 ⌃⌥1-9 체계와 분리)

## 10. 커밋 가이드

- 커밋 1: `lib/locale.ts` + `lib/preprocess.ts` (경계 정규화 + 변환 함수 + 파이프라인)
- 커밋 2: `components/editor/EditorPreview.tsx` (인라인 전처리 동일 반영)
- 커밋 3: `app/globals.css` + `components/print/PrintStyles.css` (불릿 숨김 CSS)
- 커밋 4: `components/editor/MathSnippetMenu.tsx` (구조 템플릿 버튼)
- 커밋 메시지 접두: `Phase 54:`
- **git push 는 덕수가 VSCode에서 직접 수행** — CLI는 커밋까지만 하고 push 명령어를 제안할 것

## 11. 수용 체크리스트

- [ ] T1: `**Case 1.**` 문단 + `- **Case 1a.**` / `- **Case 1b.**` 입력 시, 에디터 미리보기에서 하위 케이스가 한 단계 들여쓰기되고 **불릿(•)이 보이지 않음**, 라벨은 볼드
- [ ] T2: 하위 케이스 항목 사이에 빈 줄을 넣어도(loose list) T1과 동일하게 렌더링
- [ ] T3: 하위 케이스 본문에 `$…$` 인라인 수식 포함 시 정상 렌더 (displaystyle 적용 포함)
- [ ] T4: Case 와 무관한 일반 `- 항목` 리스트는 기존처럼 • 불릿 표시 (회귀 없음)
- [ ] T5: ProblemView(문제 보기) 및 Bazaar 공개 뷰어에서 T1 동일 확인 (둘 다 EditorPreview 경유)
- [ ] T6: PDF 인쇄 미리보기(PrintableContent)에서 T1 동일 확인 → §5-2 CSS 적용 검증
- [ ] T7: `lib/locale.ts` 와 `EditorPreview.tsx` 의 **경계 정규화 로직 + 하위 케이스 변환 정규식**이 문자 단위로 동일
- [ ] T8: proofread 경로에서 `normalizeCaseBoundaries` / `convertSubcaseMarkers` 가 호출되지 않음 (raw_text 오염 없음) — 실호출부로 확인
- [ ] T9: 수식 `$$…$$` 블록 내부에 `- **Case` 형태 문자열이 있어도 변환/개행 삽입되지 않음
- [ ] T10: 하위 케이스 리스트 바로 뒤에 빈 줄 없이 `**Case 2.**` 를 이어 써도, Case 2가 앞 항목에 흡수되지 않고 독립 문단으로 렌더 (lazy continuation 방지 검증)
- [ ] T11: MathSnippetMenu 상단 "구조 템플릿"에서 Case/하위 케이스 클릭 시 커서 위치에 해당 마크다운이 삽입되고, 삽입 후 미리보기가 T1과 동일
- [ ] **T12 (v3 신규 · D8): `normalizeCaseBoundaries` / `convertSubcaseMarkers` 의 호출부가 렌더 파이프라인(§4-2, §4-3의 2곳)뿐임을 grep으로 확인. 특히 `EditorView.tsx:2141` 의 raw_text 저장 체인(`normalizeDisplayMathSpacing` 후처리)에 추가되지 않았음. 저장 → 재로드 후 raw_text 에 빈 줄·span 이 유입되지 않음**

## 12. v2 변경 설명 (검토자용)

v1 → v2 개정 사유와 내용 요약. **① ②** 는 v1 검토에서 확인된 실제 결함, **③** 은 기능 요청.

### ① lazy continuation 탈출 결함 → 경계 정규화 신설 (D7 · §4-0 · §3-4 · T10)

- **문제**: v1 §3 은 리스트 **진입**(paragraph interrupt)만 검증하고 **탈출**을 놓쳤음. canonical 형식대로 하위 케이스 리스트 뒤에 빈 줄 없이 `**Case 2.**` 를 쓰면, CommonMark **lazy continuation** 규칙상 그 줄이 직전 리스트 항목(`Case 1b`)의 문단으로 흡수되어 Case 2가 들여쓰기된 채 잘못 렌더된다. 실제 HWP 이관 문서는 빈 줄이 불규칙해 빈번히 발생 가능.
- **해결**: `normalizeCaseBoundaries(text)` 신설 — 최상위 `**Case …**` 라벨 행 앞에 (이전 행이 비어있지 않으면) 빈 줄을 강제 삽입. 기존 `insertMarkerLineBreaks`(`lib/locale.ts:57`)와 동일한 line-based 패턴이라 검증된 방식. 최상위 Case 문단 앞 빈 줄은 항상 무해하므로 진입 케이스에도 부작용 없음.
- **배치**: lib 파이프라인은 `protectMath` 보호 구간 안(§4-2), EditorPreview는 인라인 보호 구간 안(§4-3)에서 실행. 두 곳 로직 동일(T7).
- **문서화된 한계**: `**Case …**` 형태가 아닌 자유 문단이 하위 케이스 뒤에 빈 줄 없이 이어지면 여전히 표준대로 흡수됨. 이는 일반 리스트와 동일한 CommonMark 동작이며 과도한 전처리를 피하기 위해 지배 사례(연속 Case 라벨)만 보증. 템플릿 버튼이 올바른 줄바꿈을 유도.

### ② "최대 2단계 중첩" 철회 → 1단계 확정 (§1 · §7 · D2)

- **문제**: v1 §1 은 "최대 2단계 중첩"을 명시했으나 (a) D1 은 라벨을 `Case <숫자><소문자 1글자>.` 단일 형식으로만 정의해 2단계 문법이 없고, (b) 변환 정규식 `^(-\s+)` 는 열 0의 `- ` 만 매칭하므로 들여쓴 중첩 `  - ` 는 span을 못 받는다. 스펙·구현 모순.
- **해결**: 하위 케이스는 **1단계 들여쓰기로 확정**. §1·§7에서 2단계 문구 삭제. 정규식을 `^(\s*-\s+)` 로 여는 방안은 무관한 깊은 리스트를 오탐하므로 **채택하지 않음**.
- **부수 정정 (D2)**: v1 은 D2 를 "nested list"로 서술했으나 실제로는 부모 `**Case 1.**` 가 문단이라 하위 케이스는 **최상위 `ul`** 이다. 들여쓰기는 중첩이 아니라 기본 `ul` 스타일이 제공. CSS도 `ul ul` 이 아닌 `li:has()` 를 사용하므로 top-level 기준이 맞다. D2 서술과 §5-1 주석을 이에 맞게 정정.

### ③ MathSnippetMenu Case/하위 케이스 템플릿 버튼 추가 (§9 · T11)

- v1 §7 에서 "후속 검토"로 미뤘던 스니펫 버튼을 v2 범위로 편입.
- **실코드 확인 결과** 스니펫 삽입 경로(`EditorView.tsx:1823-1826`)가 원문을 `$` 래핑 없이 그대로 삽입하므로 마크다운 템플릿을 그대로 넣을 수 있음을 확인 → 구현 리스크 없음.
- 사용자 Firestore 상용구와 분리된 **내장 상수 3종**(상위/하위 a/하위 b)을 리스트 모드 상단 "구조 템플릿" 그룹으로 노출. 단축키 미소비, 자동 번호 증가 없음(범위 제한).

## 13. v3 변경 설명 (원 저자 재검토 결과)

v2를 원 저자(web Claude)가 최신 클론(`0a4d131`)과 실파이프라인으로 재검토한 결과.

### 검증 통과 — v2 핵심 변경 3건 모두 승인·유지

- **① lazy continuation**: 실파이프라인으로 결함 재현 + 해결책(빈 줄 삽입 후 독립 `<p>` 분리) 재검증 완료. v1의 실제 누락이 맞음.
- **②**: v1의 "최대 2단계"는 "Case + 하위 = 총 2레벨" 의도였으나 문구가 오해 소지 있었음 — 1단계 확정 문구가 더 명확. "nested list → top-level ul" 정정도 구조적으로 정확.
- **③**: §9의 file:line 인용(`EditorView.tsx:1823-1826`, `MathSnippetMenu.tsx:8/163-289/188-191`, `UnifiedToolbar.tsx:783-793`) 전수 검증 통과. 삽입 경로가 원문 그대로 삽입임도 확인.
- v2의 file:line 참조는 모두 정확했음.

### 정정 A — §4-2 "펜스 보호" 주장 오류

- v2는 "수식/**펜스** 내부 오변환 방지를 위해 protectMath로 감쌈"이라 서술했으나, `protectMath`(`lib/locale.ts:31`)는 **수식만** 보호한다. `protectFences`는 Phase 42에서 EditorPreview에만 추가되었고 `lib/preprocess.ts` 경로에는 펜스 보호가 없다.
- 인쇄 경로의 펜스 노출은 기존 마커 변환들도 공유하는 **기존 조건**이며 Case 정규식은 행 앵커라 위험도 낮음 → 문구 정정 + §7 범위 밖 명시 + §8 리스크 표에 기존 조건으로 문서화. 신규 보호 도입은 별도 Phase 대상.

### 정정 B — §5-1 특이도 숫자 오류

- 화면용 첫 셀렉터 `li:has(> .marker-case-sub)::before` 는 (0,2,2)가 아니라 **(0,1,2)** (`:has()`는 인자 중 최고 특이도를 취하며, 인자가 클래스 1개). 둘째 셀렉터는 (0,2,3).
- 결론("기존 `ul li::before` (0,0,3)을 이긴다")은 그대로 유효 — 숫자만 정정. 인쇄용 (0,2,2) > (0,1,3) 계산은 재계산 결과 정확했음.

### 정정 C — 저장 경로 오염 금지 조항 신설 (D8 · T12)

- 재검토 중 확인: `EditorView.tsx:24, 2141` 은 `normalizeDisplayMathSpacing` 을 **raw_text 저장 경로**에서 호출해 정규화 결과를 Firestore에 실제로 기록한다.
- v2에는 이 경로에 대한 언급이 없어, CLI가 "정규화 일관성"을 이유로 `normalizeCaseBoundaries` 를 저장 체인에도 추가할 위험이 있었음 — 이는 D5(원문 불변) 위반이며, 저장 raw_text에 빈 줄이 영구 주입된다.
- **D8 신설 + 함수 주석에 경고 + T12 검증 항목 추가**로 3중 방지. proofread 라우트(`app/api/proofread/route.ts`)는 전처리 계열을 import하지 않음도 grep으로 확인 (T8은 구현 후 재확인용으로 유지).
