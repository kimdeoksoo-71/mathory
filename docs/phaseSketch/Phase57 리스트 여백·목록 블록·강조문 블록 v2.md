# Phase 57(잠정) — 리스트 여백 · '목록' 블록 · '강조문' 블록 · \tag 표준화 · 원문자 개선 · **v2 (CLI Claude, 실코드 전수 대조)**

> v1(웹 Claude 초안)을 라이브 레포 `8da5c42`(2026-08-14 15:42)와 **줄 단위로 대조**한 결과.
> 절차(Phase 55a·56과 동일): v1 초안 → **v2(본 문서, 실코드 검증)** → 덕수 승인 → 착수 → 확정본 `docs/phasedocs/`.
> 부록 A의 모든 라인 번호는 `8da5c42`에서 직접 확인함(v1의 번호는 대부분 맞았고, 틀린 것만 §0.2에 표기).

---

## 0. v1 대비 변경 요약 (먼저 읽을 것)

### 0.1 그대로 유지되는 판정

P1~P5 다섯 항목 모두 **타당·가능**하며 **순수 클라이언트**(Firestore 규칙·서버·마이그레이션 변경 0)라는 v1 결론은 유효하다. Phase 55a(Undo/Redo)와의 충돌도 없다(`handleAddBlock` 1548·`handleBlockTypeChange` 1526에 `pushUndo` 이미 배선).

### 0.2 v1의 **오류** — 그대로 구현하면 실패하는 것 (4건)

| # | v1의 서술 | 실제 | v2 대응 |
|---|---|---|---|
| **E1** | 인쇄 리스트 여백을 `.print-body ul, .print-body ol { margin: 8pt 0 14.4pt }` 한 줄로 | 현행 `.print-body ul`은 `margin: 4pt 0 4pt **1em**`(PrintStyles.css:55) — **좌측 1em이 shorthand에 묻혀 사라진다.** 불릿 좌여백이 화면과 어긋남 | ul/ol을 **분리**하고 ul에는 좌측 1em을 명시 (§2.3). CLAUDE.md의 "shorthand가 longhand를 조용히 덮어쓴다" 교훈과 동일 함정 |
| **E2** | P4/D6에서 "수식 안 `\tag` 번호는 `.tag .text`를 바꾸면 된다" | `\tag{n}`은 `preprocessMath`에서 **`\tag*{(n)}`**로 변환된다(preprocess.ts:120, EditorPreview.tsx:174). `(n)`은 **수학 모드**라 `.mopen/.mord/.mclose`로 렌더되고 **`.text`는 아예 생기지 않는다.** `.text` 규칙만 고쳐서는 글꼴이 1px도 안 바뀜 | `.tag` **서브트리 전체**(`.tag, .tag *`)를 타겟 (§5.2) |
| **E3** | P4를 "CSS만, 부작용 없음"으로 분류 | `.tag { bottom: 0.85em; line-height: 1 }`(globals.css:283-287)은 **14px 기준으로 눈맞춤한 값**이다. 글꼴·크기를 바꾸면 em 기준과 폰트 baseline 메트릭이 동시에 바뀌어 **참조번호 세로 위치가 어긋난다** | `bottom` 재보정을 P4의 **필수 하위 작업**으로 승격(0.85em → 0.79em 출발값 + 실측) (§5.3) |
| **E4** | 목록 프리셋 `"- \n- \n- \n\n① \n② \n③ "` | `preventSetextHeadings`의 판정식 `/^\s{0,3}-+\s*$/`에 **`- `(대시+공백) 줄이 정확히 걸린다**(preprocess.ts:97, EditorPreview.tsx:50 — 2곳). 2·3번째 `- ` 앞에 빈 줄이 강제 삽입돼 **loose list로 승격** → 항목 간격이 요구사항 1.2("일반 행간")와 어긋나고, 사용자가 내용을 채우면 `<li><p>` 구조로 바뀜 | `preventSetextHeadings`에 **리스트 컨텍스트 가드** 추가(신규 D11, §3.4). 프리셋을 빈 항목으로 유지하려면 이 수정이 선행 조건 |

### 0.3 v1이 **누락**한 것 (7건)

| # | 누락 | v2 위치 |
|---|---|---|
| **M1** | 인쇄 리스트는 항목마다 `margin-bottom: 3pt`(PrintStyles.css:54·56)가 붙어 있어 **화면(0)과 항목 간격이 이미 불일치**. 요구사항 1.2("항목 사이는 일반 행간")를 지키려면 이것도 제거 대상 | 신규 D8, §2.3 |
| **M2** | 타입 전환(`handleBlockTypeChange`)은 **소스가 텍스트 계열이면 프리셋을 적용하지 않는다**(EditorView.tsx:1518). 즉 빈 텍스트 블록을 '목록'으로 바꾸면 **빈 목록**이 나온다. 요구사항 2.2.1("추가하면 6줄이 들어있다")을 부분적으로 배신 | 신규 D9, §3.5 |
| **M3** | 강조문의 `p { margin: 0 }`을 화면에만 지정. 인쇄는 `.print-body p { margin: 0 0 6pt }`(50)라 **강조문 내부 행 간격이 화면/인쇄 불일치** | §4.2 |
| **M4** | ⑩~⑮는 **두 자리 숫자**. `width: 1.3em` 고정 원은 깨진다 | 신규 D12, §6.4 |
| **M5** | 합성 원문자를 `inline-flex`로 제안했으나, 선택지는 `alignItems:'baseline'` 플렉스 행(ChoicesBlock.tsx:36)에 놓인다 — inline-flex의 baseline 합성은 브라우저 간 편차가 크다 | `inline-block` + `line-height` 중앙정렬로 변경, §6.4 |
| **M6** | 인쇄에서 수식 내 `\tag` 번호가 **이미 깨져 있다**: PrintStyles는 `.tag .text`만 0.95em로 덮는데(96-99), 실제 렌더는 `.mord`라 globals의 `14px !important`(300-303)가 인쇄까지 관통한다 → 본문 10pt 대비 14px(≈10.5pt). P4는 이 잠복 버그도 함께 닫는다 | §5.4 |
| **M7** | D1(① 문단) 셀렉터 3종 중 가장 취약한 `:not(p:has(…)) + p:has(…)` 복합이 **불필요**하다 — margin-top을 전부 0으로 만들지 않으면 된다 | §2.4에서 단순화 |

### 0.4 v1의 **사실오인** (경미, 정정만)

- "`SnapshotView`에 분기 추가 필요" → **SnapshotView는 블록 타입 분기를 갖지 않는다.** 공유 경로는 `PublicViewerShell → ProblemTabContent` 하나뿐. 렌더 사이트는 정확히 **5곳**이 맞다.
- `ChoicesBlock.tsx:14·35` → 라벨 span은 **38행**(14는 파싱 정규식, 35는 map 시작).
- CLAUDE.md의 "수식 내 `\tag{n}` → `\tag*{…… ㉠}`" 서술은 **낡았다**. 실제는 `\tag*{(n)}`. (㉠ 계열은 `CIRCLED_CONSONANTS` 상수만 남고 현재 미사용.) → Phase 57 착수 시 CLAUDE.md도 정정.
- "`.preview-content`가 4개 사이트를 자동 커버" → **맞다**(EditorView 3190·3201, ProblemView 379·392, FolderView 284·293, ProblemTabContent 44·59 전부 `<EditorPreview>` 경유). 인쇄만 `.print-body` 자체 ReactMarkdown.

---

## 1. 결정표 (덕수 승인 필요)

| # | 결정 | v2 권고 | 대안 | v1 대비 |
|---|---|---|---|---|
| **D1** | ① 원문자 리스트 문단도 여백 정규화? | **포함** — 미포함 시 '목록' 블록의 ordered 파트만 간격이 벌어져 ul과 어긋남 | 제외 | 유지(셀렉터만 단순화) |
| **D2** | 강조문 구현 | **A안(블록 신설)** 확정 | B안(행 마커 `>> `) | 유지 |
| **D2′** | B안 병행 | **Phase 57 범위 밖.** 요구사항 3.2.1(수식 흐름 중간 한 행)의 진짜 해법이지만, 블록 3분할 비용이 실사용에서 아프면 그때 착수 | 지금 같이 | **신규 분리** |
| **D3** | 강조문 타입 키 | **`callout`** | `emphasis` | 유지 |
| **D4** | '목록' 프리셋 | **불릿 3 + 빈 줄 + ① 3 (빈 항목)**, 단 **D11 선행 필수** | 플레이스홀더 텍스트(`- 항목`) 채우기 | 조건 추가 |
| **D5** | 리스트 여백 CSS 스코프 | **`.preview-content` / `.print-body` 한정** | 전역 | 유지 |
| **D6** | 수식 내 `\tag`도 본문 글꼴로 통일 | **통일** (신·구 문서 혼재 시 참조번호 모양이 두 가지가 되는 것 방지) | 수식 안은 KaTeX_Main 유지 | 유지, 구현 정정(E2·E3) |
| **D7** | 원문자 개선 방식 | **O3 — 합성 원문자** (전처리 1패스 + CSS) | O2 크기 보정 / O1 유니코드 서브셋 폰트 | 유지, 구현 개선(M5) |
| **D8** | 인쇄 리스트 항목 간 `3pt` 제거 | **제거**(화면 parity, 요구사항 1.2) | 유지 | **신규** |
| **D9** | 빈 블록 타입 전환 시 프리셋 적용 | **적용** — `raw_text.trim() === ''`이면 대상 프리셋 주입. '목록'뿐 아니라 기존 (가)/ㄱ. 칩의 오래된 불편도 같이 해소 | 목록만 예외 처리 / 현행 유지 | **신규** |
| **D10** | `EmptyBlockChips` 라벨 | 칩은 **`(가)(나)`**로 축약 유지(fontSize 10, 폭 제약), 드롭다운·헤더만 정식 명칭 사용 | 칩도 정식 명칭 | **신규** |
| **D11** | `preventSetextHeadings`에 리스트 가드 | **추가**(2곳 동시) | 프리셋을 텍스트 채운 형태로 우회 | **신규** |
| **D12** | 두 자리 원문자(⑩~⑮) | **`min-width` + `border-radius:999px`**(2자리는 스타디움 형태 허용) | 1자리만 지원 / 축소 폰트 | **신규** |

---

## 2. P1 — 리스트 상하 여백

### 2.1 기준값 (실측 확인)

| | 위 | 아래 | 근거 |
|---|---|---|---|
| 화면 display 수식 | `1em` | `1.8em` | EditorPreview.tsx:443 (인라인 `<style>`, `!important`) |
| 인쇄 display 수식 | `8pt` | `14.4pt` | PrintStyles.css:65 |
| 화면 리스트(현행) | `0.4em` | `0.4em` | globals.css:209(ul) · 243(ol) — **전역 스코프** |
| 인쇄 리스트(현행) | `4pt` | `4pt` | PrintStyles.css:53 · 55 |

**em 기준 확인**: `.katex-display`(바깥 div)는 `.preview-content .katex`(안쪽 span, 1.15em) 선택자에 걸리지 않으므로 그 `1em/1.8em`은 **본문 font-size 기준**이다. `ul/ol`도 동일 기준 → **같은 픽셀값**이 나온다. (v1이 암묵적으로 가정만 했던 부분, 확인 완료.)

### 2.2 화면 (globals.css 신규)

```css
/* Phase 57 P1 — 리스트 상하 여백을 display 수식과 동일 기준으로.
   D5: 콘텐츠 스코프 한정 (전역 ul/ol 규칙 206·240은 앱 UI가 쓰므로 건드리지 않음).
   ⚠ shorthand 금지 — 전역 ul의 margin-left:1em을 지워버린다. */
.preview-content ul,
.preview-content ol {
  margin-top: 1em;
  margin-bottom: 1.8em;
}
/* 중첩 리스트는 현행(0.4em) 유지 — 특이도 (0,1,2) > (0,1,1) */
.preview-content li ul,
.preview-content li ol {
  margin-top: 0.4em;
  margin-bottom: 0.4em;
}
```

### 2.3 인쇄 (PrintStyles.css 신규) — **E1·M1 반영**

```css
/* Phase 57 P1 — 인쇄 parity. ul은 좌측 1em을 반드시 보존(현행 55행). */
.print-body ul { margin: 8pt 0 14.4pt 1em; }
.print-body ol { margin: 8pt 0 14.4pt; }
.print-body li ul { margin: 4pt 0 4pt 1em; }
.print-body li ol { margin: 4pt 0; }
/* D8 — 항목 사이는 "일반 행간"만 (요구사항 1.2). 화면은 이미 0. */
.print-body ul li,
.print-body ol li { margin-bottom: 0; }
```

> `.print-body ol`의 `padding-left: 24pt`, `.print-body ul`의 `padding-left: 1.4em`은 **그대로 둔다**(가로 체계는 이번 Phase 범위 밖).

### 2.4 D1 — ① 원문자 문단 정규화 (**M7 반영, 셀렉터 단순화**)

① 리스트는 markdown `ol`이 아니라 **`<p>` 나열**이다(EditorPreview.tsx:105·148, locale.ts:64·140-143이 강제 빈 줄로 문단을 쪼갬). 따라서 §2.2가 닿지 않는다.

v1은 `margin-top`을 전부 0으로 만든 뒤 "런의 첫 항목"에 1em을 복원하는 3규칙 구성이었다. 그러면 가장 취약한 `:not(p:has(…)) + p:has(…)` 복합 셀렉터가 필요해진다. **margin-top을 애초에 건드리지 않으면** 그 규칙이 통째로 사라진다:

```css
/* Phase 57 D1 — 연속 ① 문단을 "리스트 한 덩어리"로 취급 */
.preview-content p:has(.marker-circled) { margin-bottom: 0; }              /* 항목 사이 = 행간만 */
.preview-content p:has(.marker-circled) + p:has(.marker-circled) { margin-top: 0; }
/* 덩어리의 마지막 항목만 아래 여백 — 다음 문단의 1em과 collapse되어 1.8em */
.preview-content p:has(.marker-circled):not(:has(+ p .marker-circled)) { margin-bottom: 1.8em; }
```

- **위쪽 여백은 규칙이 필요 없다**: 첫 항목의 UA 기본 `margin-top: 1em`이 앞 문단의 `margin-bottom: 1em`과 collapse → 1em(= display 수식과 동일). 앞이 수식이면 1.8em(수식 규칙 그대로) — 이것도 올바른 동작.
- **`!important` 주의**: 기존 `p:has(.marker-circled)`(globals.css:264-268)가 `padding-left/text-indent/margin-left`에 `!important`를 걸고 있다. 위 규칙은 **반드시 longhand**로 쓸 것(`margin: 0` shorthand는 `margin-left: 1em !important`와 부분 충돌해 의도가 흐려진다).
- 인쇄 동일 규칙을 `.print-body p:has(.marker-circled)` 접두로 추가(`margin-bottom: 0` / 마지막 `14.4pt`). 현행 PrintStyles.css:104 바로 아래.
- **잔여 리스크**: `:has(+ p …)`(관계형 + 인접결합자). 현행 코드가 이미 `li:has(> p:first-child > .marker-case-sub)`(globals.css:227)를 쓰고 있어 `:has()` 의존은 신규 리스크가 아니다. 인접결합자 조합도 동일 스펙 레벨(Chrome 105+/Safari 15.4+/Firefox 121+)이라 2026-08 기준 안전. **불발 시 폴백**: 전처리에서 런의 마지막 span에 `marker-circled-last` 클래스를 붙여 단순 클래스 타게팅(전처리가 이미 행 단위 순회 구조라 5줄이면 됨).
- (가)/ㄱ. 마커(`marker-gana`/`marker-giyeok`)는 gana/roman **상자 블록** 안에서 쓰이므로 **이번 정규화에서 제외**(현행 유지).

### 2.5 검증 항목

문단→ul→문단 / 문단→①①①→문단 / 중첩 리스트 / display 수식과 나란히 놓고 눈금 비교 / 선택지 셀 내부(`.choices-grid .preview-content p { margin: 0 }` globals:335와의 상호작용) / **앱 UI 리스트(사이드바·드롭다운) 무영향**(D5 스코프 실증).

---

## 3. P2 — '목록' 블록 + 명칭 재조정

### 3.1 타입·상수 (EditorView.tsx)

```
types/problem.ts:157          → union에 'list' 추가
EditorView.tsx BLOCK_TYPE_LABELS(76-86)  → list: '목록'
EditorView.tsx BLOCK_TYPES(89-91)        → ['text','heading','list','callout','gana','roman','box','choices','image']
EditorView.tsx BLOCK_PRESETS(94-104)     → list: (§3.4)
EditorView.tsx TEXT_BASED_TYPES(107-109) → 추가
EditorView.tsx SPLITTABLE_TYPES(112-114) → 추가
```

**렌더 수정 불필요**: `list`는 `BORDERED_TYPES`(123)도 특수 타입도 아니므로 5개 사이트 전부 최종 else 가지(기본 markdown 렌더)로 자동 낙하한다. 5곳 분기 구조를 직접 확인함 — EditorView 3142-3208 / ProblemView 327-393 / FolderView 247-293 / ProblemTabContent 21-59 / PrintableContent 59-73. 전부 `image → svg → ggb → BORDERED → choices → 기본` 순서라 **누락 분기 없음**.

### 3.2 명칭 재조정 (라벨만, 타입 키 불변 → 저장 데이터·VCS diff·공유 스냅샷 영향 0)

| 타입 키 | 현행 라벨 | 변경 |
|---|---|---|
| `gana` | `(가) (나) (다)` | **`(가), (나) 상자`** |
| `roman` | `ㄱ. ㄴ. ㄷ.` | **`ㄱ, ㄴ 상자`** |
| `box` | `글상자` | **`빈 글상자`** |

수정 지점은 **`BLOCK_TYPE_LABELS`(76-86) 단 한 곳**이다. grep 결과 하드코딩 라벨은 `EmptyBlockChips`의 `'(가)(나)(다)'`(225) 하나뿐이고, 드롭다운(813·817·820)·헤더(791)·추가 메뉴(3098)는 전부 상수를 경유한다. → **D10**: 칩은 폭 제약(fontSize 10)상 `(가)(나)`로 축약.

### 3.3 P1 의존

'목록' 블록의 가독성은 P1 여백이 만든다. **P1 → P2 순서 고정.**

### 3.4 프리셋과 D11 (**E4 대응**)

권고 프리셋:

```
- 
- 
- 

① 
② 
③ 
```

이대로 두면 `preventSetextHeadings`가 2·3번째 `- ` 줄을 setext underline으로 오판해 앞에 빈 줄을 밀어넣는다(`/^\s{0,3}-+\s*$/`가 `- `에 매치). 결과는 loose list — 항목 간격이 요구사항과 어긋난다.

**D11 — 리스트 컨텍스트 가드** (`lib/preprocess.ts:88-107`과 `components/editor/EditorPreview.tsx:40-60` **양쪽 동일 수정**):

```js
const isSetextUnderline =
  /^\s{0,3}-+\s*$/.test(line) || /^\s{0,3}=+\s*$/.test(line);
// Phase 57 D11: 직전 줄이 리스트 항목이면 이 '-' 줄은 setext underline이 아니라
// 빈 리스트 항목이다. 빈 줄을 넣으면 loose list로 승격돼 항목 간격이 깨진다.
const prevIsListItem = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/.test(prevLine);

if (isSetextUnderline && prevLine.trim() !== '' && !prevIsListItem) {
  result.push('');
}
```

- 안전성: 가드가 좁다(직전 줄이 리스트 마커일 때만). 문단 아래 `-` 줄이라는 **원래 방어 대상은 그대로 방어**된다.
- CLAUDE.md의 "locale.ts와 EditorPreview.tsx 범위 동기화" 규칙과 같은 계열 — **2곳 동시 수정 필수**, 어느 한쪽만 고치면 화면/인쇄가 갈린다.
- `preventSetextHeadings`는 EditorPreview에서 코드펜스 보호(`protectFences` 68-81) **안쪽**에서 돌므로 펜스 오염 없음.

**ordered 파트에 markdown `1.`을 쓰지 않는 이유**(v1 근거 재확인, 유효): ① 리터럴이어야 기존 `marker-circled` 내어쓰기 파이프라인(globals 257-268 / PrintStyles 103-104)과 P5 합성 원문자 혜택을 동시에 받는다. `ol` decimal은 P5 대상 밖이라 요구사항 5(조화)에서 이탈한다.

### 3.5 D9 — 빈 블록 타입 전환 시 프리셋 (**M2 대응**)

현행 1518행 분기는 `!TEXT_BASED_TYPES.has(b.type)` 조건 탓에 **텍스트 계열 → 텍스트 계열 전환에서 프리셋을 절대 적용하지 않는다**. 빈 텍스트 블록을 '목록'으로 바꾸면 빈 블록이 나온다(기존 (가)/ㄱ. 칩도 동일 증상).

```js
// 1518 분기 앞에 추가 — 내용이 비어 있을 때만이므로 데이터 손실 불가
} else if (type !== b.type && !raw_text.trim() && BLOCK_PRESETS[type]) {
  raw_text = BLOCK_PRESETS[type];
  // 텍스트→텍스트 전환은 MarkdownEditor가 재마운트되지 않음 → CM 뷰 직접 갱신
  const finalText = raw_text;
  queueMicrotask(() => { editorRefs.current[blockId]?.setContent(finalText); });
}
```

CM 직접 갱신은 1510-1517(heading 전환)에서 이미 검증된 패턴을 그대로 재사용.

### 3.6 저장·호환

Firestore는 타입 문자열을 그대로 저장 → **additive, 규칙·마이그레이션 불필요**. 구버전 클라이언트가 `'list'`를 만나면 기본 markdown 렌더(무해). `toPersistedBlock`의 빈 줄 트림이 프리셋 내부 빈 줄(불릿↔① 구분선)을 갉지 않는지 **Stage 2에서 실측**.

---

## 4. P3 — '강조문' 블록 (D2 = A안)

### 4.1 타입·상수

`callout` / 라벨 `강조문` / 프리셋 `''` / TEXT_BASED + SPLITTABLE + BLOCK_TYPES 노출.

### 4.2 렌더 (5개 사이트) + CSS

BORDERED와 같은 자리에 `<div className="callout-block">` 래퍼(테두리 없음). BORDERED 래퍼가 **인라인 style**인 사이트(EditorView 3186·ProblemView 375·FolderView 281)에서도 강조문은 **클래스**로 통일한다 — 화면·인쇄 값을 한 곳에서 관리해야 display 수식과의 parity가 깨지지 않는다.

```css
/* 화면 (globals.css) */
.callout-block {
  margin: 1em 0 1.8em;   /* display 수식과 동일 상하 여백 */
  padding-left: 3em;     /* globals.css:186 .katex-display padding-left와 동일 값·동일 em 기준 */
  padding-right: 0;      /* \tag float:right 기준선을 컨테이너 우단에 맞춤 */
}
.callout-block p { margin: 0; }

/* 인쇄 (PrintStyles.css) — M3 반영 */
.print-body .callout-block {
  margin: 8pt 0 14.4pt;
  padding-left: 2em;     /* 인쇄 display 수식 fleqn 들여쓰기(PrintStyles.css:24)와 동일 */
  padding-right: 0;
  break-inside: avoid;
}
.print-body .callout-block p { margin: 0; }   /* 기본 .print-body p의 0 0 6pt 상쇄 */
```

- **들여쓰기 기준 확인**: 화면 `.katex-display { padding-left: 3em }`의 em은 본문 15px 기준(§2.1과 동일 논리) → `.callout-block`의 3em과 **동일 픽셀**. 인쇄는 `@media print` 안의 `.katex-display.fleqn > .katex { padding-left: 2em }`(24행)이고 `.print-body .katex { font-size: 1em }`(68) → 본문 10pt 기준 2em. **양쪽 다 일치.**
- `break-inside: avoid`는 강조문이 1~3행이라는 전제. 열 하나를 통째로 밀어낼 만큼 길어지면 제거를 검토.

### 4.3 `\tag{n}` — 추가 작업 없음

텍스트 행 끝 `\tag{n}` → `<span class="tag-marker">`(locale.ts:151-154, EditorPreview.tsx:160-162) 파이프라인이 **이미 동작**한다. 요구사항 3.2.2(수식 밖 문장에 `\text{}` 없이 참조번호)는 이것으로 충족. `float:right`가 `.callout-block`의 콘텐츠 박스 우단(= 우측 패딩 0이므로 컨테이너 우단)에 붙으므로 display 수식 `\tag` 위치와 일치한다 — Stage 3에서 나란히 놓고 실측.

### 4.4 강조문 안 display 수식 (`$$…$$`) — 이중 들여쓰기

`.katex-display`의 3em과 래퍼 3em이 겹친다.

```css
.callout-block .katex-display { padding-left: 0; }
.print-body .callout-block .katex-display.fleqn > .katex { padding-left: 0 !important; }
```

v1은 "권장 또는 사용 규칙으로 명시" 두 갈래였으나, **override로 확정**한다(사용 규칙은 지켜지지 않는다).

### 4.5 A안의 한계 — 정직한 기재

요구사항 3.2.1의 진짜 시나리오("여러 줄 display 수식 중 가운데 한 행만 참조번호")는 A안에서 **텍스트 블록 3분할**(수식前 / 강조문 / 수식後)을 요구한다. 보기에는 자연스러워지지만(상하 여백이 display 수식과 동일) 쓰기 불편은 남는다.

완화: `callout`을 SPLITTABLE에 넣으므로 **⌘B 분할**로 커서 위치에서 즉시 쪼갤 수 있다(⌘B는 추가가 아니라 분할, 1596행). 그래도 아프면 **D2′ — B안(`>> ` 행 마커)** 을 후속 Phase로. B안은 전처리 2곳 + CSS만으로 끝나고 렌더 5곳 수정이 필요 없다(marker-gana/circled/case-sub와 동일 전례). **blockquote(`>`) 재사용은 금지** — 인쇄에서 이미 `text-box`(테두리)로 매핑돼 있다(PrintableContent.tsx:103, PrintStyles.css:52).

---

## 5. P4 — `\tag` 참조번호를 본문 글꼴·크기로

### 5.1 현행 (실측)

| 위치 | 글꼴 | 크기 |
|---|---|---|
| 화면 텍스트 행 `.tag-marker` | `KaTeX_Main, serif` | **14px 고정** (globals.css:271-277) |
| 인쇄 텍스트 행 `.tag-marker` | `KaTeX_Main` | `0.95em` (PrintStyles.css:77-83) |
| 화면 수식 내 `\tag` | KaTeX 기본(KaTeX_Main) | **14px !important** (globals.css:300-303, `.tag`/`.text`/`.mord`) |
| 인쇄 수식 내 `\tag` | KaTeX 기본 | **`.text`만 0.95em → 실제 렌더되는 `.mord`는 globals의 14px가 관통** (M6) |

본문 글꼴: 화면 `--font-content = --font-ui = Pretendard`(globals.css:75-77), 인쇄 `--font-print = Noto Serif KR`(79).

### 5.2 구현 — **E2 반영**

`\tag{n}`은 `\tag*{(n)}`으로 변환되어 **수학 모드 `(1)`** 이 된다 → `.mopen`/`.mord`/`.mclose`. `.text`는 존재하지 않는다. 따라서 서브트리 전체를 잡는다:

```css
/* 화면 (globals.css) — 수식 밖 참조번호 */
.tag-marker {
  float: right;
  white-space: nowrap;
  margin-left: 2em;
  font-family: inherit;   /* 본문(Pretendard) */
  font-size: inherit;     /* 본문 크기 — .tag-marker는 .katex 밖이라 1.15배 스케일 무관 */
}

/* 화면 (globals.css) — D6: 수식 안 참조번호도 동일 모양.
   기존 295-303을 아래로 교체. font-size는 절대값이어야 한다:
   inherit/1em으로 주면 .katex의 --katex-scale(1.15) 스케일을 다시 물어 커진다. */
.katex-display > .katex > .katex-html > .tag,
.katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-content) !important;
  font-size: var(--content-font-size, 15px) !important;
}

/* 인쇄 (PrintStyles.css) — 77-83 및 96-99 교체 */
.print-body .tag-marker { font-family: inherit; font-size: inherit; }
.print-body .katex-display > .katex > .katex-html > .tag,
.print-body .katex-display > .katex > .katex-html > .tag * {
  font-family: var(--font-print) !important;
  font-size: 1em !important;   /* .print-body .katex가 1em(=10pt)이므로 본문과 동일 */
}
```

- `* { }`가 거친 선택으로 보이지만 `.tag` 서브트리는 참조번호 하나뿐이다. `.strut`은 `display:none`(288-290) 유지 — 이 규칙은 **건드리지 말 것**(무력화하면 번호가 수식 중앙축으로 되돌아간다).
- 기존 298-299 주석("`.text`만 지정하면 problem-content-toned에서 안 먹음")이 지목한 문제도 서브트리 전칭으로 함께 해소된다.
- 인쇄 규칙에 `.print-body` 접두를 붙여 **globals의 화면 규칙과 특이도로 확실히 이긴다**(현행은 접두가 없어 import 순서에 의존 — M6의 원인).

### 5.3 `bottom` 재보정 — **E3, 필수 하위 작업**

`.tag { top:auto; bottom: 0.85em; line-height: 1 }`(globals.css:283-287)은 **14px KaTeX_Main 기준으로 눈맞춘 값**이다. 글꼴(세리프→Pretendard)과 크기(14→15px)가 동시에 바뀌면 baseline이 어긋난다.

- **출발값**: 절대 오프셋 보존 기준 `0.85em × 14px = 11.9px`, `11.9 / 15 = **0.79em**`.
- 폰트 메트릭(x-height·descender)이 달라 이론값만으로는 부족하다 → **1행·2행·5행 display 수식 각각에서 마지막 행 baseline과 번호 baseline을 나란히 놓고 실측 보정**.
- 인쇄도 동일(현행 `.tag`가 globals의 14px를 물고 있어 `0.85em = 11.9px` → 변경 후 `1em = 10pt = 13.33px` 기준이 되므로 `0.85em ≈ 11.3px`. 재측정 필요).
- 이 작업 때문에 P4는 "CSS 한 줄"이 아니다. **Stage 4에 실측 루프를 명시적으로 배정**한다.

### 5.4 부수 효과 (의도된 것)

- 기존 모든 문항의 참조번호 모양이 일괄로 바뀐다(세리프 14px → Pretendard 15px). 신·구 문서 혼재 시 모양이 두 가지가 되는 것을 막으려는 D6의 목적 그 자체.
- `\ref{n}`은 텍스트에선 `(n)` 리터럴(locale.ts:147), 수식에선 `\text{(n)}` → `.katex .text`(globals 197-200)로 **이미 본문 글꼴·크기**. P4 이후 **다는 쪽(tag)과 인용하는 쪽(ref)이 처음으로 일치**한다 — 현행 불일치의 부수 개선.
- `float:right` 줄 높이: 14px×1.8 = 25.2px < 본문 라인박스 27px였고, 15px×1.8 = 27px = 27px. **라인박스 높이 불변** → v1 검증요청 6은 이론상 해소, Stage 4에서 확인만.

---

## 6. P5 — 원문자 ①~⑮ 가시성

### 6.1 질문에 대한 답 — "기본폰트에 고정된 것인가?"

**아니다.** ①~⑮는 유니코드 U+2460~ 문자이고, 폰트 스택 `--font-ui`(Pretendard Variable → 시스템 폰트, globals.css:75)에서 **해당 글리프를 가진 첫 폰트가 그린다**. 작아 보이는 이유는 폰트 품질이 아니라 **글리프 구조** — "원 + 숫자"를 한 글자 박스(1em)에 욱여넣으므로 숫자는 본문 숫자보다 훨씬 작게 디자인될 수밖에 없다. 따라서 (a) 해당 코드포인트만 다른 폰트로 매핑, (b) 크기 보정, (c) 글리프를 안 쓰고 합성 — 셋 다 가능하다.

### 6.2 방식 비교

| | 내용 | 장점 | 단점 |
|---|---|---|---|
| **O1** | `@font-face` + `unicode-range: U+2460-2473`으로 원문자만 별도 폰트 매핑 | 마크업 무변경, 편집창까지 자동 적용 | "원문자가 큰" 폰트를 찾아야 하는데 대부분 같은 구조적 한계를 공유 → 개선폭 불확실. 웹폰트 1종 추가 |
| **O2** | `.marker-circled`·선택지 라벨에 `font-size: 1.15~1.25em` | 1~2줄, 즉시 | 원과 숫자가 같이 커져 **행간 침범** 위험. 행 중간 ①에는 미적용. 근본 해결 아님 |
| **O3 (권고)** | **합성 원문자** — 전처리에서 `①` → `<span class="num-circle">1</span>`, CSS로 원+숫자 렌더 | **숫자가 본문 글꼴 숫자 그대로** → 요구사항 5("크기가 글꼴의 글자 크기에 일치")에 정확히 부합. 크기·굵기·선두께 전부 제어. 화면·인쇄 동일 원리 | 전처리 2곳 + CSS. 지름·정렬 실측 필요. 편집창(CM)은 원문 `①` 유지 |

### 6.3 O3 변환 — **단일 전역 패스** (v1 대비 단순화)

v1은 `convertCircledList` 내부를 고쳐 중첩 span을 만들라고 했으나, **행 중간 ①이 누락**되고 이중 변환 위험이 생긴다. 대신 **기존 변환 뒤에 전역 패스 1개**를 추가한다:

```js
// locale.ts preprocessLocale 3단계 — convertCircledList 직후
processed = convertCircledGlyphs(processed);

/** ①~⑮ 글리프 → 합성 원문자 마크업. 행 시작분은 이미 marker-circled로 감싸여 있어
 *  자동으로 <span class="marker-circled"><span class="num-circle">1</span></span> 중첩이 된다.
 *  글리프가 숫자로 소모되므로 이중 변환이 원천적으로 불가능. */
function convertCircledGlyphs(text: string): string {
  return text.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/g,
    (ch) => `<span class="num-circle">${ch.charCodeAt(0) - 0x245F}</span>`);
}
```

- **실행 위치**: `protectMath` 보호 구간 안(3단계) → 수식 내부 오염 없음. `insertMarkerLineBreaks`(`^[①…]` 판정)와 `convertCircledList`(`^([①…])\s*`)보다 **뒤**여야 한다(순서 고정).
- **EditorPreview.tsx의 자체 사본(147-149 직후)에 동일 코드** — CLAUDE.md의 2곳 동기화 규칙.
- 기존 `marker-circled`의 내어쓰기 체계(globals 257-268 / PrintStyles 103-104)는 **무변경**으로 유지된다.
- **선택지 라벨은 별도 경로**: React 텍스트 노드라 전처리를 안 탄다. `ChoicesBlock.tsx:38`의 `<span>{label}</span>`과 `PrintableContent.tsx:130`의 `<span className="print-choice-label">{c.label}</span>`을 각각 `num-circle` 마크업으로 교체. **파싱은 무영향** — `parseChoices`(ChoicesBlock.tsx:11-22)·인쇄 파서(115)는 `raw_text`의 ① 리터럴을 읽고, O3는 표시 단계 변환이다.
- **적용 범위(v1 검증요청 7의 답)**: 행 시작 마커·선택지 라벨·**행 중간 인용(“①과 ②에서…”)까지 전부**. 전역 패스라 자동으로 셋 다 커버되고, 모양이 갈리지 않는다.
- **미적용**: 편집창 CodeMirror(원문 `①` 유지 — 기존 locale 정책과 동일), 툴바 특수문자 입력(UnifiedToolbar.tsx:210, 입력 문자는 `①` 그대로).
- `\ref`/`\tag`와 무관 — 참조번호는 `(n)` 숫자 표기라 충돌 없음.

### 6.4 CSS — **M4·M5 반영**

```css
/* 화면 (globals.css) */
.num-circle {
  display: inline-block;          /* inline-flex 금지 — 선택지의 baseline 정렬에서 브라우저 편차 */
  box-sizing: border-box;
  min-width: 1.35em;              /* D12: 두 자리(⑩~⑮)는 가로로 늘어남 */
  height: 1.35em;
  line-height: 1.28em;            /* height - border*2 → 세로 중앙 */
  padding: 0 0.12em;
  text-align: center;
  border: 0.08em solid currentColor;
  border-radius: 999px;           /* 1자리=원, 2자리=스타디움 */
  font-size: 0.86em;              /* ← 실측 튜닝 대상 */
  font-weight: var(--weight-regular);   /* marker-circled의 600을 상속하지 않도록 */
  font-variant-numeric: tabular-nums;
  vertical-align: -0.22em;        /* ← 실측 튜닝 대상 */
}
/* 인쇄 (PrintStyles.css) — 동일 값. 테두리는 em이라 10pt에서 ≈0.28mm */
.print-body .num-circle { /* 위와 동일 선언 */ }
```

- `font-size: 0.86em`·`vertical-align: -0.22em`·`line-height`는 **본문 15px / 행간 1.8 기준 실측 보정**한다. 검증 기준: **행간(1.8)을 밀어내지 않을 것**, 선택지 3등분/5등분 그리드에서 라벨 baseline이 내용 baseline과 맞을 것, 인쇄 2단에서 동일할 것.
- `.marker-circled { min-width: 2em; font-weight: 600 }`은 유지 — 내어쓰기 폭 체계를 건드리지 않는다.

### 6.5 P4와의 합류

P4(참조번호 = 본문 글꼴)와 O3(원문자 숫자 = 본문 글꼴)를 함께 적용하면 본문에 등장하는 **모든 번호 체계(참조번호·원문자·선택지 라벨)가 본문 글꼴 하나로 통일**된다 → 요구사항 5의 "다른 글자들과의 조화" 완결.

---

## 7. 엣지 케이스 / 기존 기능과의 상호작용

- **Undo/Redo (Phase 55a)**: 신규 타입의 추가·타입 변경·삭제는 기존 `pushUndo` 배선(1536·1548, `handleBlockTypeChange` 1526)을 그대로 타므로 자동 커버. D9(프리셋 주입)도 같은 핸들러 안이라 추가 작업 없음.
- **저장 정화(`toPersistedBlock`)**: '목록' 프리셋의 내부 빈 줄(불릿↔① 구분)이 트림에 갉히지 않는지 **Stage 2 필수 확인**.
- **VCS diff**: `type` 필드 변경으로 정상 기록. 스냅샷 렌더는 `ProblemTabContent` 하나를 경유하므로 §3.1의 5곳에 이미 포함.
- **선택지 셀 내부 중첩 EditorPreview**: `.choices-grid .preview-content p { margin: 0 }`(globals:335)이 있어 P1의 p 여백과 충돌 없음. 다만 **리스트 여백 규칙이 선택지 셀 안까지 내려간다** → 셀 안 리스트가 1.8em을 먹지 않는지 확인(필요 시 `.choices-grid .preview-content ul/ol { margin: 0.4em 0 }` 예외).
- **편집창 CodeMirror**: 이번 Phase는 미리보기·인쇄 전용. 편집창 표시는 전부 무변경(P5 포함).
- **글꼴 크기 슬라이더**: 여백이 em, P4가 `var(--content-font-size)`, P5가 em 기반 → `--content-font-size` 스케일에 자동 대응.
- **`--content-font-size` 인쇄 누출 주의**: P4 화면 규칙이 `var(--content-font-size)`를 쓰므로, 인쇄 규칙에 반드시 `.print-body` 접두를 붙여 특이도로 이겨야 한다(§5.2).
- **`preventSetextHeadings` 가드(D11)**: 리스트가 아닌 문단 아래 `---` 구분선 용법에 영향 없음(직전 줄이 리스트 마커일 때만 발동).

---

## 8. 파일/모듈 목록 (확정)

```
# P1 (CSS만)
app/globals.css                       → .preview-content ul/ol 상하 여백 + D1(① 3규칙)
components/print/PrintStyles.css      → .print-body ul/ol (ul 좌 1em 보존!) + D8 항목 3pt 제거 + D1

# P2
types/problem.ts:157                  → 'list' 추가
components/editor/EditorView.tsx      → 상수 5곳(76·89·94·107·112) + EmptyBlockChips 라벨(225) + D9 분기(1518 앞)
lib/preprocess.ts:88-107              → D11 리스트 가드
components/editor/EditorPreview.tsx:40-60 → D11 동일 수정 (2곳 동기화)

# P3 (A안)
types/problem.ts                      → 'callout' 추가
components/editor/EditorView.tsx      → 상수 5곳 + 미리보기 분기(3185 부근)
components/problem/ProblemView.tsx    → 분기 (373 부근)
components/problem/FolderView.tsx     → 분기 (281 부근)
components/share/ProblemTabContent.tsx→ 분기 (38 부근)
components/print/PrintableContent.tsx → 분기 (67 부근)
app/globals.css / PrintStyles.css     → .callout-block (+ 내부 katex-display override)

# P4 (CSS + 실측 보정)
app/globals.css                       → .tag-marker(271-277) + .tag 서브트리(295-303 교체) + .tag bottom 재보정(285)
components/print/PrintStyles.css      → .tag-marker(77-83) + .tag 서브트리(96-99 교체, .print-body 접두) + bottom 재보정(88)

# P5 (O3)
lib/locale.ts                         → convertCircledGlyphs 추가 (convertCircledList 직후)
components/editor/EditorPreview.tsx   → 동일 패스 추가 (149행 직후) — 2곳 동기화
components/editor/ChoicesBlock.tsx:38 → 라벨 num-circle 마크업
components/print/PrintableContent.tsx:130 → print-choice-label 동일
app/globals.css / PrintStyles.css     → .num-circle
```

**Firestore 규칙 변경 0, 서버 변경 0, 마이그레이션 0** — 순수 클라이언트. 배포 순서 제약 없음.

---

## 9. 구현 순서

**Stage 1 · P1 리스트 여백 (CSS)**
화면 + 인쇄(E1 shorthand 함정 주의) + D8 + D1(§2.4 3규칙).
검증: 문단→ul→문단 / 문단→①①①→문단 / 중첩 리스트 / display 수식과 눈금 비교 / 선택지 셀 내부 / **앱 UI 리스트 무영향**.

**Stage 2 · P2 목록 블록 + D11 + D9 + 명칭 재조정**
D11(2곳)을 **먼저** 넣고 프리셋 렌더를 확인한 뒤 나머지.
검증: 추가 → 6줄이 tight list로(빈 줄 승격 없이) 렌더, 줄 삭제/추가 편집, 빈 텍스트→목록 전환 시 프리셋 주입(D9), 라벨 3종 변경, 저장→재로드→인쇄, undo 왕복.

**Stage 3 · P3 강조문**
타입 + 5곳 분기 + CSS(§4.2·4.4).
검증: 행간·상하 여백·들여쓰기를 display 수식과 나란히 비교, `\tag{n}` 우측 정렬이 수식 `\tag`와 같은 x좌표인지, 강조문 안 `$$…$$` 이중 들여쓰기 해소, ⌘B 분할, 인쇄 parity, 공유뷰.

**Stage 4 · P4 (+ bottom 실측 보정)**
§5.2 CSS → **1·2·5행 수식에서 참조번호 baseline 실측 → `bottom` 확정** → 인쇄 동일 절차.
검증: 텍스트 행 tag / 수식 내 tag / `\ref` 인용 세 가지를 한 화면에 놓고 글꼴·크기 일치, float 라인박스 높이 무변화, 인쇄 명조 반영, `problem-content-toned`(ProblemView·FolderView)에서도 동일.

**Stage 5 · P5 원문자**
전처리 2곳 + 선택지 2곳 + CSS → 치수 실측 보정.
검증: 본문 숫자와 크기 육안 비교, 행간 침범 없음, 선택지 3/5등분 baseline, 행 중간 ① 인용, 인쇄 2단, 편집창 원문 유지, 선택지 파싱 무영향.

**Stage 6 · 통합 검증**
다섯 기능이 공존하는 실제 문항으로 화면·인쇄 대조(§6.5 번호 체계 통일 확인). `docs/roadmap.md` 갱신, CLAUDE.md의 `\tag*{…… ㉠}` 서술 정정(§0.4).

---

## 부록 A. 실코드 사실관계 (`8da5c42` 직접 확인 완료)

**A-1. 블록 타입.** `'text'|'heading'|'math_block'|'bullet'|'gana'|'roman'|'box'|'choices'|'image'|'svg'|'ggb'` — types/problem.ts:157 ✓. `math_block`·`bullet`은 레거시 → text 정규화(EditorView.tsx:117-120) ✓. 상수: LABELS 76-86 / TYPES 89-91(7종 노출) / PRESETS 94-104 / TEXT_BASED 107-109 / SPLITTABLE 112-114 / BORDERED 123 ✓.

**A-2. 렌더 사이트 5곳** ✓ — EditorView 3138(`isBordered`)·3142-3208, ProblemView 325·327-393, FolderView 245·247-293, ProblemTabContent 38·21-59, PrintableContent 67·59-73. 공통 순서 `image → svg → ggb → BORDERED → choices → 기본`. **SnapshotView에는 타입 분기 없음**(v1 오인, §0.4).

**A-3. 앞 4곳은 `<EditorPreview borderless>` 경유** ✓ (3190·3201 / 379·392 / 284·293 / 44·59) → `.preview-content`(EditorPreview.tsx:445) 자동 커버. **인쇄만 자체 ReactMarkdown**(PrintableContent.tsx:86, `.print-body`).

**A-4. 리스트 CSS.** globals: `ul` 206-210 `margin: 0.4em 0 0.4em 1em`, 커스텀 불릿 211-220, `ol` 240-244 `margin: 0.4em 0; padding-left: 2em` — **전부 전역 스코프** ✓. 인쇄: `ol` 53(`margin:4pt 0; padding-left:24pt`), `ol li` 54(`margin-bottom:3pt`), **`ul` 55(`margin: 4pt 0 4pt 1em`)** ✓, `ul li` 56(`margin-bottom:3pt`).

**A-5. display 수식.** 화면 `margin-top:1em/bottom:1.8em !important`(EditorPreview.tsx:443, 인라인 `<style>`), `padding-left:3em`(globals 185-187) ✓. 인쇄 `margin: 8pt 0 14.4pt`(PrintStyles 65), fleqn `padding-left:2em`(24, `@media print` 내부) ✓. 화면 수식 크기 `--katex-scale: 1.15em`(88)은 `.preview-content .katex`(191-194)에만 — **`.katex-display` 자신은 본문 em 기준** ✓.

**A-6. ① 파이프라인.** 행 시작 ①~⑮ → 강제 빈 줄(EditorPreview.tsx:105 / locale.ts:64) + `<span class="marker-circled">`(EditorPreview.tsx:147-149 / locale.ts:140-143) ✓. CSS 내어쓰기 globals 257-268(`!important` 3종), PrintStyles 103-104 ✓. **p 마진 정규화 없음** ✓.

**A-7. `\tag`.** 텍스트 행 끝 → `<span class="tag-marker">(n)</span>`(locale.ts:151-154 / EditorPreview.tsx:160-162) ✓. **수식 내 → `\tag*{(n)}`**(preprocess.ts:120 / EditorPreview.tsx:174) → 수학 모드 `.mopen/.mord/.mclose`. 스타일: globals 271-277(14px)·283-303(`.tag`/`.text`/`.mord` 14px `!important` + `bottom:0.85em` + strut 무력화), PrintStyles 77-83·86-99(**`.mord` 대응 누락 — M6**).

**A-8. `preventSetextHeadings`.** preprocess.ts:88-107 및 **EditorPreview.tsx:40-60에 사본 존재** ✓. 판정식 `/^\s{0,3}-+\s*$/` — **`- `(대시+공백)에 매치됨**(E4). EditorPreview는 `protectFences`(68-81) 안쪽에서 호출(275행).

**A-9. blockquote.** 인쇄에서 `<div class="text-box">`(PrintableContent.tsx:103) + 테두리(PrintStyles 52). 화면은 정렬 규칙만(globals 308-314) → 화면·인쇄 불일치 기존 존재. **강조문 문법으로 재사용 금지** ✓.

**A-10. 프리셋 적용 규칙.** 신규 추가 시 `BLOCK_PRESETS[type]`(1554) ✓. 타입 변경 시 **소스가 비텍스트일 때만**(1518) — 텍스트→텍스트는 raw_text 유지(M2). heading 전환만 예외로 CM 직접 갱신 패턴 보유(1502-1517).

**A-11. 선택지.** `parseChoices` ①~⑤ 리터럴(ChoicesBlock.tsx:11-22 / PrintableContent.tsx:113-121), 라벨 span **ChoicesBlock.tsx:38** · PrintableContent.tsx:130(`print-choice-label`, 스타일 PrintStyles 131). 셀 내부 p 마진 0(globals 335 / PrintStyles 130·133).

**A-12. 글꼴 변수.** `--font-ui`(75) = Pretendard, `--font-content: var(--font-ui)`(77), `--font-print: 'Noto Serif KR'`(79), `--content-font-size`는 `setStoredFontSize`가 `documentElement`에 주입(EditorView.tsx:214-217, 기본 15px). `@media print`의 `.katex .text { font-size: 1em !important }`(PrintStyles 25).

**A-13. CSS 로드 순서.** `globals.css`는 `app/layout.tsx:1`, `PrintStyles.css`는 컴포넌트 3곳(PrintableContent 12 / PdfDownloadButton 6 / EditorView 45)에서 import → 동일 특이도면 PrintStyles가 뒤. **의존하지 말고 `.print-body` 접두로 특이도를 확보할 것**(§5.2).

**A-14. Phase 55a 공존.** `pushUndo`가 추가(1548)·타입변경(1526 deps)·삭제(1536)에 배선 완료 ✓ — 신규 타입 자동 커버.

## 부록 B. 로드맵 메모

- 의존: **P1 → P2** (여백이 목록 블록의 가독성을 만든다). **D11 → D4 프리셋**. P3·P4·P5는 상호 독립 → 분리 배포 가능.
- P4는 "CSS만"이 아니다(bottom 실측). P5도 치수 실측이 있다. Stage 4·5는 각각 눈맞춤 루프를 포함해 견적할 것.
- D2′(강조문 B안 `>> ` 행 마커)는 요구사항 3.2.1의 근본 해법으로 후속 Phase 후보로 남긴다.
- 다음 Phase 번호는 **57**이 맞다(phasedocs에 55·55a·56까지 존재).
