# Phase 60(예정) — list 로케일 블록 개편: (가)·(나) / ㄱ. ㄴ. **직접 입력** + 마커 공백 정규화 · **v3 (교차검토 — 전건 승인)**

작성일: 2026-08-18 · 작성: web Claude (Fable) — CLI v2를 재검토 · 기준 커밋: **`aff3bd2`** (v2와 동일 — 클론 HEAD가 정확히 일치, 미푸시 0건)

> **검증 방법** — 레포를 직접 클론해 세 층위로 대조했다:
> ① v2가 인용한 좌표·import 체인·캐스케이드 주장을 파일 단위로 **정적 실측**,
> ② `lib/locale.ts`를 컴파일해 **라이브 코드 실행**(§0.2 결함 재현·공백 동작·멱등성),
> ③ 실코드 CSS를 그대로 옮긴 페이지를 **Chromium(Playwright)으로 렌더 실측**(특이도·D14·마커 고정폭 가드 — v2가 "가장 값지다"고 지목한 §11-1·5 포함).
>
> 결과: **v2의 정정 F1~F15와 결정 D1~D14는 전건 사실이며 전부 승인한다.** v2가 판정을 유보한 검증 요청 8건도 전부 해소됐다(§2). 그 위에 v3는 다음을 더한다:
>
> - **해소 1건(반가운 쪽)**: **G2** — 앱에서 `/shared`로 가는 **클라이언트 내비게이션 경로가 아예 없다**(전부 새 탭/외부 URL = 하드 로드). v2가 걱정한 "진입 경로에 따라 겉모습이 달라진다"는 실앱에 해당 없음 — 대신 **공개 뷰어의 오정렬은 모든 실사용자에게 일관 재현**되므로 F3 수정의 정당성이 오히려 강해진다.
> - **정밀화 1건**: **G1** — D14의 근거 문장 교체. "매칭이 갈리는 입력이 없다"는 부정확하다 — **DOM 차원의 반례는 실존한다**(Chromium 측정). 다만 파이프라인 산출물에서는 도달 불가 — 결론(현행 형태 유지)은 그대로.
> - **보강 1건**: **G3** — §1.1 소비처 목록에 누락 2건(`PublicComments`·`editor-test`). 특히 PublicComments는 **공개 뷰어의 댓글도 지금 오정렬**임을 뜻한다 — 수정이 자동으로 함께 고친다.
> - 미세 지적 G4~G7 (§3).
>
> §1 검증표 → §2 검증 요청 8건 답변 → §3 보강 → §4 v2 대비 갱신표 (여기 명시된 갱신 외 **v2 전문이 착수 기준으로 유효**하다).

---

## 1. v2 검증 결과 — 전건 승인

| v2 주장 | v3 검증 방법 | 판정 |
|---|---|---|
| **F1** 좌표 전면 갱신 (`aff3bd2`) | 인용 좌표 전수 대조 — 프리셋 **116-117** · 라벨 91-92 · `insertMarkerLineBreaks` 59-74(패턴 65-66, `\s*` 잔존) · 변환 regex **121·125·134·138** · 원문자 148-151 · `preprocessLocale` 178-198 · globals **381-389**·392-397 · PrintStyles **124-128** · proofread **59** · EditorPreview 110-112·144·150·154-158·284·300 · EmptyBlockChips gana 칩 ~181 · 프리셋 소비 3곳(1514·1525·1561) 전부 일치. 오기 0건 (CommentPanel 1465는 실제 1463행 시작 요소의 prop 행 — 결론 무영향) | ✅ 승인 |
| **F2 ★** PrintStyles가 화면에도 로드 + 124-128은 `@media print` 밖 | import 4곳 전수 확인(**EditorView.tsx:51** · pdfPrint:3 · PrintableContent:12 · PdfDownloadButton:6) + **AppShell.tsx:34**의 EditorView 정적 import. `@media print` 블록은 10-26에서 닫힘 — 124-128은 전역. **Chromium 실측: 화면 마커에 min-width 40px(2.5em)·font-weight 600이 실제로 걸린다** | ✅ 승인 |
| **F3 ★** 정렬 결함은 공개 뷰어 한 곳 | `/shared/[shareId]/page.tsx` import는 SnapshotView·MiniShell뿐, 그 하위 체인(PublicViewerShell→ProblemTabContent→EditorPreview)에 PrintStyles importer 0건 — `.css` import 전수 grep과 교차 확인 | ✅ 승인 (+G3: 공개 **댓글**도 같은 결함) |
| **F4** globals 381-389는 특이도로 죽은 코드 → 화면 giyeok 내어쓰기 2.5em | **Chromium 실측** — 두 시트를 실코드 그대로 얹은 페이지에서 giyeok 문단 `padding-left: 40px = 2.5em`(2em 아님). **시트 로드 순서를 뒤집어도 동일**(특이도 (0,2,1) > (0,1,1)이 순서 무관 확정) | ✅ 승인 |
| **F5** Q4 전제 붕괴 → B 확정(D8′ `font-weight: inherit`) | F2·F4 실측의 따름정리 — 덕수가 본 "현행"은 누출된 600이었다. 취지 실현에는 명시 `inherit`가 필요하다는 판단 정확 | ✅ 승인 |
| **F6** 인쇄는 iframe이 아니다 | pdfPrint.tsx **40-68 실측** — 숨은 div 렌더 → `.print-root` clone → **`document.body.appendChild`** → `window.print()`. CLAUDE.md "iframe 방식" 은 낡은 기록 맞음(정정 항목 부록 A ③ 타당) | ✅ 승인 |
| **F7·D9** 리터럴 범위 10개 | 논리 검토 — 5개 상한은 GANA/GIYEOK 테이블(18-24)의 유산, 리터럴엔 테이블이 없다. "조용한 결함 > 가시적 오탐" 원칙 타당. 코드포인트 검증(ㄱ=U+3131 호환 자모 = 테이블 값과 동일)도 확인 | ✅ 승인 |
| **F8** 프리셋 소비 3곳 + 칩 | 1514(빈 텍스트→타입, CM 직접 갱신 포함)·1525(비텍스트→텍스트)·1561(`handleAddBlock`)·EmptyBlockChips 실측 일치 | ✅ 승인 |
| **F9** proofread `\s*` 버그 + autoWrap 구조적 이득 | proofread.ts 59 `\s*` 실측 — 개행 포함이라 내용 없는 연속 마커 행에서 둘째 라인 선두 판정을 건너뛴다는 분석 정확. autoWrapBareLetters 447-451의 명시 보호 목록 실측 — 한글 리터럴은 `[a-zA-Z]` 클래스 밖이라 애초 비대상 ✓ | ✅ 승인 |
| **F10** `solutionOutline.ts` SCANNED_TYPES에 gana·roman | 55-57 실측 일치. `**…**`만 발췌 → 마커 소실은 기존 한계(§7.3-1) 판정 타당 | ✅ 승인 |
| **F11·D12** 사본 이격 실존 → 정규식 상수만 공유 | locale.ts 65 `/^\s*…/` vs EditorPreview 111 `trimStart()+/^…/` 표기 이격 실측 ✓. `new RegExp(RE.source,'gm')` 관용구의 출처(solutionOutline.ts:72 `lastIndex` 격리)도 실코드 확인 | ✅ 승인 (+G5 미세 지적) |
| **F12·D13** `test:locale` 하니스 | package.json에 test:case·test:export 선례 실측 — 같은 꼴. locale.ts가 caseBlock의 `LEGACY_CASE_RE`를 import(10행)하므로 tsc 동반 컴파일 필요하다는 지적도 정확 | ✅ 승인 |
| **F15 ★** 손입력 `(가)`는 지금 문단이 뭉친다 | **라이브 코드 실행으로 재현** — 컴파일한 locale.js에 `'(가) 짝수인 경우\n(나) 홀수인 경우'`를 넣으면 **무변환 원문 그대로**(빈 줄 삽입 0·span 0) 통과. 레거시 `(a)`는 빈 줄+span으로 분리. remarkPlugins에 `remark-breaks` 없음(EditorPreview 300 · PrintableContent 126) → CommonMark soft break = 공백 = 한 줄 병합 확정. **P1 = 현존 결함 수정** 판정 성립, §7.2·T14 필요성도 성립 | ✅ 승인 |
| §2-5 멱등성 · §4.1 폴백 도달 불가 · §7.3 한계 5건 · D1~D8·D10·D11·D14 | 라이브 실행(레거시 멱등성 true 확인·행 중간 리터럴 무변환 확인) + 논리 검토. D11(circled 누출 불개입 — globals `!important`가 덮음)·D10(시트 소유권)·D14(G1로 정밀화) 전부 타당 | ✅ 승인 |

---

## 2. v2 검증 요청 8건에 대한 답변

| # | 요청 | 답변 |
|---|---|---|
| **1** | `:has()` 특이도 실측 | **v2가 옳다.** Chromium 측정: giyeok 문단 `padding-left` = 40px(**2.5em**), 마커 600·min-width 2.5em. 시트 순서를 바꿔도 동일 — globals 386-389는 PrintStyles가 로드된 모든 화면에서 죽은 코드다. §4.2·D4′·D8′ 전제 확정 |
| **2** | 시트 생존 범위 (클라이언트 내비게이션) | **우려 자체가 실앱에 없다 — G2.** `/shared` 진입 코드는 BazaarView **246** `<a target="_blank">`·PublishList **153** `window.open` 두 곳뿐(전수 grep) — 모두 **새 탭 = 하드 로드**이고, 외부 공유 링크는 본래 하드 로드다. 따라서 실사용자는 항상 PrintStyles 없는 상태로 공개 뷰어를 본다 → 오정렬이 "일관 재현"이므로 수정 가치는 더 크다. T2에서 이중 경로 비교는 불필요(하드 로드 확인만 남김 — T2′) |
| **3** | `(사)`·`[ㄱ-ㅊ]\.` 오탐 코퍼스 | 나도 Firestore 접근 불가 — 코퍼스 판정은 불가하다. 다만 판단 근거 보강: 피해 모드가 **즉시 가시적**(그 행만 내어쓰기)·**데이터 불변**·**행 선두 한정**이고, 수학 문항 본문에서 "(사)"가 행 선두에 오는 표기는 출처·저작권 문구 정도인데 그마저 피해가 내어쓰기뿐이다. 반대편(범위 축소)의 비용은 **조용한 결함**이다 — **D9 10개 승인.** 착수 후 실코퍼스에서 오탐이 보이면 그때 좁혀도 코드 1줄이다 |
| **4** | Phase 58 톤 정합 | **성립.** 톤은 전부 컨테이너 레벨이다 — `.tone-baseline{color:…}`(255-256)·`.solution-tone.has-key{color:…}`(279-282)·`.problem-content-toned{font-weight:…}`(259-263). 마커 span을 겨냥한 색·굵기 규칙은 어디에도 없고(전수 grep), `font-weight:inherit`는 부모의 계산값을 그대로 받는다 → dim 상태 포함 본문 톤을 정확히 따른다. `.katex` 예외 규칙들은 span과 무관 |
| **5** | D14 반례 탐색 | **DOM 차원 반례 실존 — G1.** `<p><em>x</em> <span class="marker-gana">…</span></p>`는 `p:has(.marker-gana)`에 매치되고 `p:has(> .marker-gana:first-child)`에는 안 된다(Chromium 측정 — 텍스트 노드 선행은 무관, **요소** 선행이 가른다). 그러나 파이프라인에서 span은 오직 `^` 행 시작 치환으로만 생기고, `insertMarkerLineBreaks`가 마커 행 앞에 빈 줄을 보장해 그 행이 항상 문단 첫머리가 된다(경우 제목행·blockquote·리스트 행은 `^\(` 불일치로 span 자체가 안 생김 — v2 §7.3-4와 정합). ⇒ **산출물에서 도달 불가 — D14(형태 유지) 결론 유지, 근거만 교체**. 단 이 보증은 "span은 반드시 전처리가 만든다"에 의존하므로, 사용자가 raw_text에 직접 `<span class="marker-gana">`를 쓰는 경우까지는 커버하지 않는다(수용 — 기존 rehypeRaw 정책의 일반 한계) |
| **6** | §0.2 결함 재현 | **라이브 실행으로 재현 완료**(§1 F15 행). 단정 승인 |
| **7** | P4 import 체인·SSR | **무해 — G4.** `caseBlock.ts`는 **import 0건**(실측) — 체인은 locale→caseBlock에서 끝나고 v2가 괄호로 적은 keyTone은 딸려 오지 않는다. locale.ts는 순수 함수·브라우저 API 0건, EditorPreview는 `'use client'`(1행) — `/shared`의 SnapshotView도 client(1행)라 서버 경계 문제 없음. 번들 증가는 소스 수 KB |
| **8** | 누락 경로 | **2건 발견 — G3.** EditorPreview 소비처 전수 grep(10곳): v2 목록 외 **`PublicComments.tsx:5`**(공개 뷰어 댓글 — F3 결함의 동반 피해자이자 수정의 동반 수혜자)와 **`app/editor-test/page.tsx`**(dev 페이지). 둘 다 EditorPreview 경유 → `.preview-content` 스코프가 자동 커버, **추가 작업 0**. ReactMarkdown 사용 파일 전수 grep — EditorPreview·PrintableContent 둘뿐이라 다른 렌더 경로는 없다 |

부수 확인 2건: ① CLAUDE.md "iframe 방식 인쇄" **오기 확정**(F6) — 부록 A ③ 정정 타당. ② PrintStyles **97-104**(`.tag-marker`)·**106-114**(`.katex-display .tag` 계열)도 무접두 전역 규칙 맞음 — 바로 아래 115-123이 `.print-body` 접두 규약을 지키는 것과 대조된다. globals에 동일 값이 있어 현재 무해 — **C-6 이월 타당**.

---

## 3. v3 보강 (신규)

### 3-1. G1 — D14 근거의 정밀화 (결론 불변)

§2-5 그대로. v2 §4.2(d)의 문장 "두 형태의 매칭 결과가 갈리는 입력이 없다"를 **"갈리는 DOM은 있으나(요소가 span에 선행하는 문단) 전처리 산출물에서는 만들어지지 않는다"**로 교체한다. 착수 시 주석도 이 문장으로.

### 3-2. G2 — `/shared` 진입은 전부 하드 로드 (§1.2 부작용 문단 폐기)

v2 §1.2 말미의 "클라이언트 내비게이션으로 들어오면 앞 라우트의 시트가 남아 … 진입 경로에 따라 달라진다"는 문단은 **해당 경로가 없어 삭제**한다(근거 §2-2). 효과 두 가지: ① F3 결함의 재현 조건이 "항상"으로 단순해진다 ② T2의 이중 경로 비교가 빠진다(T2′).

### 3-3. G3 — 소비처 목록 완성

v2 §1.1 표의 화면 소비처에 `PublicComments`(공개 댓글)·`editor-test`(dev)를 추가한다. 공개 뷰어에서는 **본문(ProblemTabContent)과 댓글(PublicComments)이 함께** 마커 오정렬 상태였고, §4.2(a)가 둘 다 고친다 — T2′에 댓글 확인 한 줄을 더한다.

### 3-4. G5 — `MARKER_LINE_RE`의 공백 클래스가 미세하게 좁아진다 (수용)

현행 locale.ts 65의 `^\s*`와 EditorPreview의 `trimStart()`는 NBSP(U+00A0)·전각 공백(U+3000) 선행도 마커 행으로 인식해 빈 줄을 삽입한다. 제안된 `^[ \t]*`는 이를 인식하지 않는다 — HWP·웹 붙여넣기에서 이런 공백이 섞이면 **문단 분리만** 달라진다(span은 현행에도 선행 공백 행엔 안 붙는다 — §7.3-2와 동일 계열). **판정: 수용** — Phase 57의 `[ \t]*` 규칙과 일관되고, 실피해는 §7.3-2보다 좁다. §7.3에 한 줄 병기 + 선택적으로 **L13**(NBSP 선행 행 스펙 고정) 추가.

### 3-5. 소소한 확인 3건

- **G6** — §4.2(a)의 `.preview-content` 커버리지: EditorPreview 반환 루트는 borderless 여부와 무관하게 항상 `className="preview-content"`(465 실측) → 화면 마커의 100%가 스코프 안이다. 버전 뷰(VersionDiff 등)는 raw_text를 마크다운 렌더 없이 표시하므로 마커 span 자체가 없다 — 스코프 밖이어도 무관.
- **G7** — 마커 고정폭 가드 실측: `min-width` + `text-indent:0` 조합에서 첫 줄 본문 시작점이 정확히 랩 라인(2.5em)과 일치함을 Chromium으로 측정(spanW=40px, textLeft=40px). CLAUDE.md "글자 주위 상자 금지"의 예외 사유(가드 유효) 실증 — §4.2(a) 주석의 주장 그대로.
- **G8** — 제안 규칙 간 캐스케이드 충돌 없음: 수정 후 앱 화면에는 `.preview-content …`(globals)와 `.print-body …`(PrintStyles)가 공존하지만 서로의 서브트리에 닿지 않고, 인쇄 시에는 `body > *:not(.print-root){display:none}`(PrintStyles 21)이 앱 트리를 치워 간섭이 없다.

---

## 4. 최종 갱신표 (v2 대비 변경분만 — 이 표 외 v2 전문 유효)

| # | 항목 | v3 확정 내용 | 출처 |
|---|---|---|---|
| §4.2(d)·D14 | 인쇄 선택자 근거 | 반례는 DOM 차원 실존, **파이프라인 도달 불가**로 문장 교체. 형태 유지 결론 불변 | G1 |
| §1.2 말미 | 시트 생존 부작용 | **문단 삭제** — `/shared` 클라이언트 내비게이션 경로 부재(전부 새 탭·외부 URL) | G2 |
| §1.1 표 | 화면 소비처 | `PublicComments`·`editor-test` 추가 — 공개 댓글도 결함·수정의 대상 | G3 |
| §3.4 | `MARKER_LINE_RE` | `[ \t]*` 채택 유지 + §7.3에 "NBSP·전각 공백 선행 행은 문단 분리 안 됨" 한 줄 병기, 선택적 L13 | G5 |
| §11-3·D9 | 리터럴 10개 | 승인 확정(코퍼스 판정 불가 — 피해 모드 논거로 결정). 착수 후 실오탐 발견 시 축소는 1줄 | §2-3 |
| §9.2 | T2 | **T2′로 간소화**: `/shared` 하드 로드 1경로만 + **공개 댓글(PublicComments) 마커 정렬 확인 추가** | G2·G3 |
| §9.1 | 테스트 | (선택) **L13**: NBSP/U+3000 선행 마커 행의 문단 분리 스펙 고정 | G5 |

---

## 5. 확인 사항 — **미결 없음, 착수 판정**

v1 Q1~Q5(덕수 확정) → v2 재실측·B 확정 → v3 교차검토 **전건 승인**. v2 헤더의 "CLI 재검증(v4, 필요 시)"은 **불필요하다** — v3의 갱신은 근거 정밀화·문단 삭제·목록 보강뿐이고 코드 스킴(§3~§6)·CSS(§4.2)·순서(§10)는 v2에서 한 글자도 바뀌지 않았다.

**착수 기준 = v2 전문 + 본 문서 §4 갱신표.** 덕수 승인 시 CLI가 v2 §10 커밋 분할(P4 상수 추출 → P1 → P2 regex → P2 CSS → P3 → 하니스 → 문서) 순서로 구현한다. 착수 시 `git log -1`이 `aff3bd2`에서 움직였으면 v2 부록 A 좌표만 재확인한다.

**덕수가 눈으로 확인할 겉모습 변화 3건**(v2 §10과 동일): ① 앱 마커 굵기가 본문과 같아지고 `ㄱ.` 내어쓰기가 2em으로(T13) ② 공개 뷰어 본문·**댓글**의 마커 정렬 수정(T2′) ③ 리터럴이 이미 든 기존 문항의 문단 분리(T14 — 뭉침 해소, 의도된 개선).
