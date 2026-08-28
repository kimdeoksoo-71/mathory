# 개선묶음 M2 구현 계획서 — 기능 개편 7건 (v2 CLI 실측 교차검토판)

> 계보: 스케치 메모 「M2 기능 개편 모음」(2026-08-28) → v1(web) → **v2(CLI 실측 교차검토, 2026-08-28)** → v3(착수판) 예정
> 진실 원천: mathory **origin/main `af918fa`** (2026-08-27). 본문의 모든 `파일:라인`은 이 해시에서 **CLI로 재실측**했다.
> v1 대비: **사실 오류 8건 정정 · 계획 누락 5건 보강 · 결정 14건 추가 확정(Q1~Q14, 덕수 2026-08-28 전항 승인)**
> 착수 시 CLAUDE.md 규칙 1에 따라 대상 파일을 반드시 다시 읽을 것. push는 덕수. 다크 모드 없음 — 새 색 토큰에 다크 정의 금지.

| 항목 | 내용 | 난이도 |
|---|---|---|
| **A** | 팝업창 일원화 (네이티브 alert/confirm/prompt → 자체 다이얼로그) | 중 (호출부 수가 비용) |
| **B** | 선택지 블록 세로 정렬 (baseline → center) | 하 |
| **C** | 참조 인용 hover 말풍선 | 중 |
| **D** | ProblemView 보기 개편 (탭별 카드·폭 조절·스크롤 자동접힘) | 상 |
| **E** | 폴더뷰 카드보기 열수 제한 해제 | 하 |
| **F** | 왼쪽 사이드바 자동접힘 제거 | 하 (D에 편승) |
| **G** | 코칭블록 단일화(Tip) + 접힘/펼침 | 하~중 |

---

## 0. 덕수 결정

### 0-1. 방향 결정 (E-M2-1 ~ E-M2-4, v1에서 확정 — 변경 없음)

| # | 결정 |
|---|---|
| **E-M2-1** | (C) 참조 인식 범위 = **텍스트 참조 자동 인식**. `\ref{n}`·`C1` 명시 표기 + 본문 중간의 `①`·`(가)`·`ㄱ` 자동 인식. **수식 내부(`$…$` 안) 참조는 제외** |
| **E-M2-2** | (D) 개편 범위 = **ProblemView만, 모바일 제외**. EditorView는 현행 U-프레임 유지 |
| **E-M2-3** | (F) 자동접힘 **완전 제거 + 가로 스크롤 보완**(구현은 D에 편승) |
| **E-M2-4** | (G) 하위호환 = **타입 id 유지, 표시만 통일**. 배치 마이그레이션 0 |

### 0-2. v2 확정 결정 (Q1~Q14, 2026-08-28 — 전항 권장안 채택)

| # | 쟁점 | 확정 |
|---|---|---|
| **Q1** | (A) 새 다이얼로그 스타일 | **기존 8종에 맞춘다** — radius 10 · 테두리 없음 · `0 8px 32px rgba(0,0,0,0.2)` · `var(--bg-card)`. 원천은 `dialogStyles.ts` 신설(SheetImportModal 값 복제), **기존 2파일은 이번에 손대지 않는다** |
| **Q2** | (A) A-4 재정의 | prompt의 정체는 **폴더 이동이 아니라 문항의 폴더 이동**이다 → 픽커 요건은 순환 방지가 아니라 ① 동명 폴더 구분 ② '미지정' 선택 ③ 휴지통 제외 |
| **Q3** | (A) 죽은 `PdfDownloadButton` | **치환 대상에서 제외**, 별건 삭제 후보로 기록 → 실치환 **56곳 / 14파일** |
| **Q4** | (B) 2줄 wrap 시 라벨이 셀 전체 중앙 | **수용**. 검수 T3에서 실물 확인 후 뒤집을 여지만 남김 |
| **Q5** | (C) `.ref-marker` 시각 표시 | **`cursor: help`만.** 밑줄·색 없음 — 5사이트+인쇄에 다 새고 조판이 시끄러워진다 |
| **Q6** | (C) 리스너 부착 | **`document` 위임 1개 + `[data-ref-tooltip]` 조상 게이트.** `.case-ref`에는 `convertCaseRefs`가 `data-reftype="case"`를 붙여 선택자를 하나로 통일 |
| **Q7** | (C) 정의부 중복 시 | **참조보다 앞선 것 중 가장 가까운 것**(문서 순서 역방향) → 없으면 문서 첫 번째 → 그래도 없으면 무음 |
| **Q8** | (C) 지연 | **1000ms**(메모 사양) 상수화. 벗어나면 즉시 닫힘 |
| **Q9** | (D) 제목행 자동접힘과 댓글·AI 버튼 | **슬림 바 방식**: 접힘 = 제목·폴더경로만 사라지고 **버튼 줄(높이 36px)은 남는다** |
| **Q10** | (D) 풀이 라벨 열 sticky | **1차는 `top: 0`으로 단순화.** 문제 카드 높이 연동은 v3에서 실물 보고 판단 |
| **Q11** | (D) 카드화 폭 순증 | 카드 좌우 패딩 **40/36 유지**, 바깥 컨테이너 패딩을 **`0 32px` → `0 16px`** 로 낮춰 순증을 **+44px**로. 폭 조절 max는 **45em** |
| **Q12** | (G) 레거시 `coach_caution` | **`normalizeBlockType`에 1줄 추가**(`coach_caution → coach_important`). `math_block`·`bullet` 전례와 동일. `<select>` 현재값 보존 폴백은 **불필요해져 폐기** |
| **Q13** | (G) 폴더뷰 카드 기본 접힘 | **폴더뷰만 항상 펼침.** 접힘은 ProblemView·공개 뷰어에만 |
| **Q14** | (G) caution 잔재 | `.coach-caution` CSS 규칙·`--coach-caution` 토큰 **삭제**, `IconCoachCaution`은 **파일에 보존** |

### 0-3. v1 소결정 (S1~S6, 유지 — S2만 Q2로 개정)

S1 3종+Promise API · ~~S2~~→Q2 · S3 화면·인쇄 동시 수정 3조건 실측 · S4 카드보기만 maxWidth 해제 · S5 접힘 비영속 · S6 단일 색 = `#6639ba`.

---

## 1. v1 사실 오류 정정 (추적용 — 아래 §2 사실표에 이미 반영됨)

| # | v1 서술 | 실측 정정 |
|---|---|---|
| **정정1** | A-1 `prompt 6 · confirm 14 · alert 37` | **prompt 6 · confirm 17 · alert 34** (총 57 ✓). §3-A 목록의 AppShell prompt 4 → **5** |
| **정정2** | A-7 "confirm 동기 15곳" / D5 "예외 = ShareSettingsPanel:154·195, ListView:75" | 그 셋은 **이미 async**다. 진짜 sync는 **2곳뿐** — `EditorView.tsx:2557` `handleDeleteTab`, `AppShell.tsx:661` 인라인 `onSheetImport`. `PdfDownloadButton:20`도 `useCallback(async …)` |
| **정정3** | A-2 / S2 / D6 "`AppShell:563` = 폴더 이동" | **문항의 폴더 이동**이다(`handleProblemAction` case `'move'`). 폴더 재부모화 `handleMoveFolder(:402)`는 prompt를 쓰지 않는다(사이드바 DnD 전용) → D6의 "순환 이동 금지(`:406` alert)를 픽커가 원천 차단"은 **성립하지 않는다**(문항엔 자손이 없다) |
| **정정4** | A-5 "BatchVerifyDialog 사본 상수 승격" | 원본은 **`SheetImportModal.tsx:76-108`**, BatchVerifyDialog가 사본(`:26-59`). 또한 v1 D1이 제시한 값(radius 12 · `0.5px` 테두리 · shadow `0 12px 40px`)은 **두 전례 어느 쪽과도 다르다** — 둘 다 radius 10 · 테두리 없음 |
| **정정5** | A-6 "최고 10000(사이드바 컨텍스트 메뉴)" | 10000 = `Sidebar.tsx` 2곳 **+ `SvgViewer` 전체화면**. `components/ui/ContextMenu.tsx`는 **1000**이다. 3000(`UnifiedToolbar`·`BlockBottomToolbar`)도 목록 누락. **`Z_DIALOG = 10500` 결론은 유효** |
| **정정6** | D11④ `[ㄱ-ㅊ]` | 호환 자모 순서상 **ㄲ·ㄸ·ㅃ·ㅆ·ㅉ이 범위 안**이다. 기존 `GIYEOK_LITERAL_RE`가 명시 10자 클래스를 쓰는 이유가 그것 → **`[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]`** |
| **정정7** | D12 "자기 보호는 M1 D19″ 그대로" | `convertCaseRefs`의 **요소 통째 보호는 `.case-label` 하나뿐**(`caseBlock.ts:56`). 새 스캐너는 **앞 단계가 만든 marker span 전부**를 요소 통째로 빼야 한다 |
| **정정8** | F-3 "본문 722px" | `LABEL_GAP`은 Phase 59a에서 **`2.8 × contentFontSize`** 로 비례화됐다(`TabBody.tsx:36`) — fs15에서 28이 아니라 **42px**. 실제 **736px**. §5 폭 표 전량 재계산 |

부수 정정: B-1 "6개 사이트" = 화면 5 + 인쇄 사본 1 · D-12의 `[data-noscroll]`은 **EditorView 전용** 규약(트립와이어도 `EditorView.tsx:2445`에만) · CLAUDE.md의 ProblemView 라인번호(`:672`·`:730`·`:777`)는 실제(**656 · 712 · 769**)와 ~16행 어긋난다 · `PdfDownloadButton`은 **어디서도 import되지 않는 죽은 파일**.

---

## 2. 확정 사실 (전부 `af918fa` CLI 실측)

### A. 팝업

| # | 사실 | 위치 |
|---|---|---|
| A-1′ | 네이티브 팝업 **57곳 / 15파일** = **prompt 6 · confirm 17 · alert 34**. `window.` 접두 0건 | 전수 §4-A |
| A-2′ | prompt 6곳은 전부 "이름/대상 입력": 폴더 생성·하위폴더 생성·폴더 개명·**문항 개명**·**문항의 폴더 이동**·시트 가져오기 내 폴더 생성 | `AppShell.tsx:381·393·420·494·563`, `SheetImportModal.tsx:171` |
| A-3′ | Tailwind 없음. 모달은 인라인 style + `globals.css` CSS 변수. 공통 관례: 오버레이 `fixed inset 0` + `rgba(0,0,0,0.35~0.4)` + flex center, 본체 `var(--bg-card)`/`var(--bg-panel)` · **radius 10** · **테두리 없음** · shadow `0 8px 32px` 또는 `0 12px 40px` · 오버레이 클릭 닫기 + `stopPropagation` | `SheetImportModal.tsx:76-108`, `RestoreConfirm.tsx:26-73` |
| A-4′ | 입력 모달 원형 = `NicknameSetupModal`(input + Enter 확정 + `isComposing` IME 가드 + 에러 슬롯). 확인 모달 원형 = `RestoreConfirm`(header/body/footer 3단 + 위험 버튼 `#e53935`) | — |
| A-5′ | **스타일 상수의 원본은 `SheetImportModal.tsx:76-108`**, `BatchVerifyDialog.tsx:26-59`가 그 사본(주석이 "export돼 있지 않아 사본"이라 명시) → 승격의 출발점은 **원본 쪽** | — |
| A-6′ | z-index 실측: 1000(ContextMenu 등 11곳) · 1400 · 2000 · 3000(툴바 2곳) · 9000(SheetImport·BatchVerify·ImageTypeSelect) · 9998/9999(Ggb·Svg 전체화면·툴바) · **10000(Sidebar 2곳 + SvgViewer 전체화면)**. 토큰 없음 | 전역 |
| A-7′ | 57곳 중 **sync 핸들러는 2곳뿐**: `EditorView.tsx:2557 handleDeleteTab`(단일 onClick 호출자 `:3393`, `stopPropagation`은 await 전에 끝나므로 async 전환 안전) · `AppShell.tsx:661` 인라인 `onSheetImport`(prop 타입 `() => void`에 `() => Promise<void>` 할당 가능). 나머지 55곳은 이미 async 핸들러 안 | — |
| A-8′ | `switch/case` 안 호출: `AppShell.tsx:417-458`(폴더) · `491-588`(문항) — `await` 도입 시 `break` 위치 재확인. 다행 메시지(`\n` 포함) 4곳: `admin:65` · `CommentPanel:454` · `AppShell:441(lines.join)` · `AppShell:596` | — |
| A-9 | **`components/print/PdfDownloadButton.tsx`는 import 0** — 죽은 파일(alert 1 포함) | — |
| A-10 | `app/layout.tsx`는 **서버 컴포넌트**('use client' 없음). 클라이언트 컴포넌트를 자식으로 마운트하는 것은 정상 → `DialogHost`에 `'use client'`만 붙이면 된다 (v1 Q6 해소) | `app/layout.tsx` |

### B. 선택지 정렬

| # | 사실 | 위치 |
|---|---|---|
| B-1′ | 화면 렌더는 `ChoicesBlock.tsx` 단일 구현, **화면 5사이트 공유**(EditorView·TabBody·FolderView·ProblemTabContent·SheetImportModal) + **인쇄 사본 1**(`PrintChoicesBlock`) | `ChoicesBlock.tsx`, `PrintableContent.tsx:159-184` |
| B-2′ | 그리드 `repeat(3|5, 1fr)` — 파서가 5개에서 끊으므로 **그리드 행은 항상 1행**(셀 내용은 2줄로 wrap될 수 있다) | `ChoicesBlock.tsx:27-34` |
| B-3′ | **어긋남의 원인**: 셀 내부 flex `alignItems:'baseline'`. 큰 수식(`.base:has(.mfrac,.sqrt,.op-symbol.large-op)`의 `padding .4em` + inline-block)이 든 셀은 첫 라인박스 베이스라인이 아래로 내려가 원문자 y가 셀마다 달라진다 | `ChoicesBlock.tsx:36`, `globals.css:548-552` |
| **B-4′** | **`center`가 통하는 근거(v1 누락)**: 그리드 아이템은 기본 `align-items: stretch`라 **5개 셀의 높이가 이미 동일**하다 → 셀을 flex 컨테이너로 보면 교차축 크기가 행 높이로 같으므로, `alignItems:'center'`는 5개 라벨을 **정확히 같은 y**에 놓는다. 이것이 검수 T1의 판정 근거다 | CSS 사양 |
| B-5′ | 인쇄 사본도 같은 baseline 구조. **`.print-choice-item`에는 `.print-body` 접두가 원래 없다** — 그 클래스는 `PrintableContent`에만 존재하므로 화면 누출이 없다 | `PrintStyles.css:254-258` |
| B-6′ | `.print-choice-content`의 `display:inline`은 flex 아이템이라 blockify돼 무력하다(현재도 그렇다) → center 전환에 영향 없음 | `PrintStyles.css:262` |
| **B-7** | **center 효과 실측(2026-08-28, Chrome)** — 셀 5개를 `log · 적분 · 번분수 · 숫자 · 루트`로 구성(메모의 실패 사례):<br>`baseline` 라벨 top 최대편차 **11px에서 9.33 · 15px에서 12.81 · 24px에서 20.91** → `center`는 **세 조건 모두 정확히 0.00px**. 셀 높이 집합도 단일값(11px 38.9 / 15px 53.0 / 24px 84.9)으로 **그리드 stretch 전제(B-4′)가 확인**됐다 → D8′는 완전 해결책이다 | 실측 |

### C. 참조 인용

| # | 사실 | 위치 |
|---|---|---|
| C-1′ | 전처리는 사본 2벌: `lib/locale.ts:223-246`(공용·인쇄) ↔ `EditorPreview.tsx:95-181` 인라인. **정규식 상수만 공유, 단계 순서는 손 동기화**(현재도 Fig/Table 위치가 서로 다르다) | — |
| C-2′ | **정의부(원본)는 이미 전부 span/요소로 래핑**: 수식 내 `\tag{n}` → KaTeX `.tag`(`preprocess.ts:128`이 `\tag*{(n)}`으로) / 텍스트 행 끝 `\tag{n}` → `.tag-marker`(`locale.ts:201-206`) / 행 시작 `①` → `.marker-circled`(`:190-192`) / `(가)` → `.marker-gana`(`:176-178`) / `ㄱ.` → `.marker-giyeok`(`:182-184`) / 경우 제목 → `.case-label`(`caseBlock.ts:140-155`) | — |
| C-3′ | **재인용부는 `.case-ref`(C1)만 마크업 존재.** `\ref{n}`은 **텍스트에서는 평문 `(n)`**(`locale.ts:196-198`), **수식 안에서는 `\text{(n)}`**(`preprocess.ts:131` · `EditorPreview.tsx:189`) → E-M2-1의 "수식 내부 제외"는 곧 **수식 안 `\ref`는 hover 대상이 아니다**는 뜻이다(사용 가이드에 명시할 것) | — |
| C-4′ | 자기 보호 치환의 전례 = `convertCaseRefs`. 보호 순서 = 코드펜스 → **`.case-label` 요소 통째** → 남은 낱개 태그 → 인라인 코드(백틱 런). **요소 통째 보호는 `.case-label` 하나뿐이다** | `caseBlock.ts:42-65` |
| C-5′ | `protectMath`가 `preprocessLocale` 진입부에서 수식을 `⟦MATH_n⟧`로 이미 뺀다 → E-M2-1의 "수식 제외"는 **공짜로 성립**한다 | `locale.ts:80-92` |
| C-6′ | 떠 있는 팝업 배치 전례 = `SelectionInsertPopup`(rect 기반 + `innerWidth` 클램프 + 스크롤 시 접기) | — |
| C-7′ | ⚠ `globals.css:857-858`: 수식 영역 hover를 **JS state로 하지 말 것** — 리렌더가 innerHTML을 다시 써서 드래그 선택이 죽는다 → 이벤트 위임 + 포탈, 프리뷰 리렌더 유발 금지 | — |
| **C-8′** | **말풍선은 CSS 스코프를 잃는다(v1 누락)**: `cloneNode`한 KaTeX를 `document.body` 포탈에 그냥 넣으면 `.preview-content .katex{font-size:var(--katex-scale)}` · `.tone-baseline` · `--content-font-size`가 전부 끊겨 **크기·색·`\tag` 세로 앵커가 달라진다** | `globals.css`, CLAUDE.md M1 D16 |
| **C-9** | **마크업은 5개 렌더 사이트 전부에 생긴다** — `preprocessLocale`이 공용이므로. 리스너만 2곳이다 → `.ref-marker`에 시각 스타일을 주면 **인쇄에도 샌다**(인쇄는 iframe이 아니라 같은 document) | CLAUDE.md |
| C-10 | `npm run test:locale`이 `lib/locale.ts`를 단독 컴파일한다 → 새 스캐너는 **회귀 하니스를 공짜로 얻는다** | `package.json` |
| **C-11** | **`\tag` 정의부 DOM 실측(2026-08-28, katex 0.16.28 + Chrome)**: `\tag*{(3)}` → `<span class="tag"><span class="strut"></span><span class="mord text"><span class="mord">(3)</span></span></span>`. **`textContent`가 정확히 `"(3)"` 한 개의 텍스트 노드**다 — 공백도, 원자 분할도 없다. 단일행·`\frac`·`array`·`aligned`·두 자리 번호 5조건 전부 동일 → **텍스트 매칭이 안전하다** | 실측 |
| **C-12** | ⚠ **`globals.css:515-517` 주석이 틀렸다**: "실제 노드는 `.mopen/.mord/.mclose`이고 `.text`는 생기지 않는다" → 실측은 정반대로 **`mord text > mord` 하나**이고 `.mopen`·`.mclose`는 **생기지 않는다**(`\tag*`의 인자는 텍스트 모드로 조판된다). 처방(서브트리 전칭 `.tag *`)은 어느 쪽이든 옳게 동작하므로 **동작 영향 0, 주석만 stale** | `globals.css:514-522` |
| **C-13** | 인라인 모드(`displayMode:false`)의 `\tag*`는 **`katex-error`가 되고 `.tag`가 생기지 않는다** → 인라인 `\tag`는 애초에 정의부를 만들지 않는다(D15′의 "미발견 시 무음"으로 충분히 덮인다) | 실측 |
| **C-14** | **클론 충실도 실측(본문 24px 조건)**: 스코프 없이 `document.body`에 클론하면 `.tag`가 `font-size: 15px`(`var(--content-font-size, 15px)`의 **폴백**)로 떨어지고 `bottom`도 `3.12px → 1.95px`로 달라진다. **D17′ 방식(`.preview-content tone-baseline` 래핑 + `--content-font-size` 복사)은 원본과 `font`·`bottom`·행바닥 어긋남이 전부 동일**하다 → D17′는 필요조건이자 충분조건 | 실측 |
| **C-15** | **이중 감쌈 실측(프로토타입, 2026-08-28)** — 실제 `lib/locale.ts`를 컴파일해 `protectMath → insertMarkerLineBreaks → gana/giyeok/circled 변환` 뒤에 스캐너를 끼워 돌렸다. **현행 보호 목록(`.case-label`만)으로는 정의부가 5회 재감쌈**된다(`(가)`·`(나)`·`ㄱ.`·`ㄴ.`·`①` 전부 참조로 둔갑, 참조 9개 중 5개가 가짜). **D12′ 확장 목록에서는 0회**, 참조 4개 = 의도한 것만. 수식 안·인라인 코드 안 오염은 양쪽 모두 0(protectMath와 백틱 보호가 제 일을 한다) | 실측 |
| **C-16** | ⚠ **D11′④의 경계 조건이 한국어 조사와 충돌한다(실측)** — 뒤쪽 lookahead가 한글 음절을 배제하면 `ㄱ이`·`ㄱ은`·`ㄷ에서`·`ㄴ의`가 **전부 안 잡힌다**(표본 7개 중 4개 놓침). 한국어에서 자모 참조 뒤에는 거의 항상 조사가 붙으므로 이 규칙은 실사용에서 기능하지 않는다 | 실측 |

### D. ProblemView

| # | 사실 | 위치(실측) |
|---|---|---|
| D-1′ | 골격: 루트(아이보리 `--bg-functional`, `overflow:hidden`, `position:relative`) → **제목행**(`minHeight 98`, `flexShrink 0`) → **컨텐츠 행**(`:656`, `display:flex row`) → **클레이 U-프레임 = 스크롤 컨테이너**(`contentScrollRef`, `overflowY:auto` · `overflowX:hidden` · 상·좌·우 `0.5px --border-content` · `display:flex` · `justifyContent: panelMode ? 'unsafe flex-end' : 'center'`) → 가운데 영역 **`display:'table'` + `padding:'0 32px'` + `flexShrink:0`** → 하단 스페이서 `height:70vh, width:0` | `ProblemView.tsx:523-710` |
| **D-2′** | **제목행에 댓글(💬)·agent(AI) 버튼이 들어 있다** — ProblemView에서 그 두 패널의 **유일한 진입점**이고, `제목 클릭 → 편집`(`isOwnerView`)·폴더경로도 같은 행에 있다 | `ProblemView.tsx:604-651` |
| D-3′ | 탭은 이미 세로 배열. 탭 1행 = `[라벨 열 7em | gap 2.8em | 본문 열]` flex, 라벨 클릭 = 접기/펼치기(`openTabs`, **로드 시 전 탭 펼침**, 비영속) | `TabBody.tsx:179-228`, `ProblemView.tsx:189-192·249-251` |
| D-4′ | 본문 열 = **`35 × contentFontSize` 고정**(`flexShrink:0`), 라벨 열 `7 × fs`, gap **`2.8 × fs`** | `TabBody.tsx:36·60-66·181` |
| D-5′ | `question` 탭에만 이미 카드형 분기(배경 `--bg-content`·`padding 20/24`·radius 8·`marginLeft:-24`) — 배경이 클레이와 같아 사실상 안 보인다 | `TabBody.tsx:230-239` |
| D-6′ | sticky 전례는 `ListView.tsx:107` 한 곳(제목행 sticky + "래퍼가 아이보리를 칠해 위 8px·라운드 바깥을 덮는다" 함정 주석) | `ListView.tsx:100-122` |
| D-7′ | 접기 시 시야 튐 보정 전례 = `useOutlineState`의 `keepAnchor` + `useLayoutEffect` rect 델타 보정(+ `scrollParentOf`) | `useOutlineState.ts:47-63` |
| D-8′ | 폴더뷰 카드 규격: `background: var(--card-surface, var(--bg-content))` · `0.5px solid --border-content` · radius 12 · `padding '18px 22px'` · `height 320` · `overflow:hidden` · hover `--block-bg-active #E8DFCE` + shadow | `FolderView.tsx:546-566`, `globals.css:752-755` |
| D-9′ | 경우 rail·dot·chevron은 본문 좌측 **바깥 −1.8em**, 필요 거터 **2.06em(실사용 2.2em)**. 좌측만 넓힌 해법 전례 = `PublicViewerShell` ContentCard **`padding: '32px 36px 32px 40px'` + `maxWidth: calc(35em + 76px)`** | `globals.css:167-178`, `PublicViewerShell.tsx:127-137` |
| D-10′ | `--case-dot-fill` 기본값이 클레이 → 카드 배경이 바뀌면 컨테이너에서 재정의(전례 `ProblemTabContent.tsx:126`이 `--bg-card`로) | `globals.css:161` |
| D-11′ | `handleJumpToBlock`이 `contentScrollRef` 기준 좌표로 **세로 중앙 정렬** 점프 → sticky 헤더 도입 시 오프셋 보정 필수 | `ProblemView.tsx:298-345` |
| D-12′ | 우측 단 `useDrawerResize({defaultWidth:220,min:150,max:360})` · 댓글 패널 `{defaultWidth:420,min:360}` · 글자크기 `11~24`(기본 15) | `ProblemView.tsx:37-39·158-162` |
| D-13 | localStorage 키 관례는 **하이픈**: `mathory-content-font-size`(`:35`) · `mathory-problem-info-open`(`:138`) → v1의 `mathory.problemWidthEm`(점)은 관례 위반 |`ProblemView.tsx` |
| D-14 | `[data-noscroll]` 규약과 트립와이어는 **EditorView 전용**이다(`EditorView.tsx:2445·3482·3492·3599`) — ProblemView엔 해당 없음 | — |
| D-15 | 반응형 media query 전무(공개 뷰어 셸 880px 하나뿐). `.case-block` 상하 padding 금지 · `paddingBottom:100vh` 금지(스페이서 div) | CLAUDE.md |
| **D-16** | **슬림 바 실물 스케치 실측(2026-08-28)**: 제목바 `98px → 36px` = **62px 회수**(문제 카드 접힘까지 더하면 문항에 따라 100~300px). **A안(버튼만)은 좌측이 텅 비고 버튼이 무엇에 속한 것인지 읽히지 않으며, 스크롤 중 어느 문항인지 알 수 없다.** B안(축약 제목 + 버튼)은 12.5px `--text-secondary`로 후퇴시키면 본문을 방해하지 않는다 | 실측 |
| **D-17** | ⚠ **B안 첫 구현에서 결함 2개가 재현됐다**: ① `text-overflow:ellipsis`를 flex **컨테이너**에 걸면 말줄임이 안 나오고 그냥 잘린다 — **텍스트를 담은 자식 `<span>`**에 `overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0`을 줘야 한다 ② 긴 제목이 폭을 다 먹으면 **버튼이 밀려나 사라진다** — A안이 피하려던 바로 그 손실이 B안에서 재발한다. `.btns`에 **`flex-shrink:0`** 필수, 컨테이너에 `min-width:0` 필수. 수정 후 재실측에서 두 결함 모두 해소 | 실측 |
| **D-18** | **제목 정렬 제약(v1·v2 본문 누락)**: 제목바 안쪽 패딩은 현재 `'22px 32px 0'`이고 가운데 영역 패딩 `'0 32px'`와 같아서 제목과 본문 좌단이 맞는다(둘 다 179px). **D22′로 가운데 패딩이 16이 되고 D21′로 카드가 좌 40을 더하면 본문 좌단은 203px**이 되므로, 제목바도 `padding-left: 16` + 라벨 105 + gap 42 + **카드 좌패딩 40만큼의 들여쓰기**를 함께 줘야 정렬이 유지된다 | 실측 |
| **D-19** | **⚠ sticky가 지금 구조에서는 동작하지 않는다(실측)** — 원인은 "flex라서"가 아니라 **flex 기본 `align-items: stretch`가 자식 높이를 컨테이너 높이로 눌러** sticky가 움직일 여지를 잃기 때문이다. 실측: 현행 구조(flex+stretch)에서 300px 스크롤 후 sticky 요소가 **−220px로 흘러간다**. `align-items:flex-start`(또는 자식 `align-self:flex-start`)를 주면 자식 높이가 640으로 살아나며 **0.0px 고정 ✓**. `display:block` 전환도 같은 결과 ✓ → **D25′는 D23′에 의존한다** | 실측 |

### E. 폴더뷰 열수

| # | 사실 | 위치 |
|---|---|---|
| E-1′ | grid = `repeat(auto-fill, 520px)` + `justifyContent:center` + `gap 20` + `paddingTop 28` + `paddingBottom '20vh'`. media query·minmax 없음 | `FolderView.tsx:529-538` |
| E-2′ | **2열 제한의 진범 = 콘텐츠 래퍼 `maxWidth:1200`**: 가용 `1200−64=1136`, 3열 필요 `520×3+20×2=1600` → 항상 2열 | `FolderView.tsx:503` |
| E-3′ | 그 래퍼 하나가 **리스트보기와 카드 그리드를 함께** 감싼다 → 조건부로 열어도 리스트보기는 안 건드려진다 | `FolderView.tsx:503-575` |
| E-4′ | 제목바 래퍼는 별도(`:379`, 같은 `maxWidth 1200`). Phase 62 D8의 정렬 기준선은 **리스트보기** 행↔제목 정렬이다 — 카드보기는 grid가 center라 지금도 제목과 좌단이 안 맞는다 | `FolderView.tsx:379`, `ListView.tsx:97-98` |
| E-5′ | 조건부 style 함정: longhand는 키 제거 금지, 항상 값을 줄 것 | CLAUDE.md |
| E-6′ | FolderView는 2곳 마운트(폴더 화면 `AppShell.tsx:736` · 공유 스코프 `:783`) — 래퍼가 FolderView 내부라 자동 동반 | Phase 62 C-8 |

### F. 사이드바

| # | 사실 | 위치 |
|---|---|---|
| F-1′ | 자동 접힘 = `useEffect([view])` → `setCollapsed(true)` (`AppShell.tsx:620-625`) + 명령형 3곳(`:349·370·371`). 강제 펼침 4곳(`:368·376·616·829`). **useEffect가 매 view 변경마다 돌므로 명령형 3곳은 사실상 중복이다** | `AppShell.tsx` |
| F-2′ | 사이드바 폭 260/56, 리사이즈 `200 ~ min(480, 33%)`, 폭 비영속 | Phase 62 D13 |
| **F-3′** | **Phase 62 K1**: ProblemView 본문은 고정폭 + `justifyContent:center` + `overflowX:hidden` → 가용폭 부족 시 **좌측이 잘린 채 스크롤로 닿을 수 없다**. 실측 최소폭은 **722가 아니라 736px**(fs15, `LABEL_GAP = 2.8 × fs = 42`) | `ProblemView.tsx:666-678`, `TabBody.tsx:36` |
| F-4′ | ⚠ `overflowX:'auto'`만 바꾸면 **flex `justifyContent:center`의 좌측 넘침에는 여전히 닿을 수 없다** → 컨테이너를 block + 자식 `margin:'0 auto'` 구조로 바꿔야 전 범위에 닿는다 | CSS 사양 |
| F-5′ | EditorView 쪽은 `content-frame`이 이미 `overflowX:'auto'` — 잘림 없음 | `EditorView.tsx:3482-3489` |
| **F-6** | **F-4′를 실측으로 확증**(2026-08-28) — 컨테이너 600px / 내용 780px 조건: `flex + justify-content:center`는 `overflow-x`를 `hidden`에서 **`auto`로 바꿔도 그대로 잘린다**. `scrollWidth`가 **690**(자식 폭 780인데도)으로 나와 **좌측 넘침 90px이 스크롤 영역에 아예 포함되지 않는다**. `block + width:fit-content + margin:0 auto`와 `block + width:max-content + margin:0 auto`는 둘 다 `scrollWidth 780 · maxScrollLeft 180 · 좌단 0px · 우단 0px`로 **양끝 도달**. 넓은 창(1000px)에서는 4종 모두 좌우 여백 110/110으로 **중앙 정렬이 동일하게 유지**된다 | 실측 |

### G. 코칭블록

| # | 사실 | 위치 |
|---|---|---|
| G-1′ | 종류 2종: `COACH_LABELS`(Important/Caution) + `isCoachBlock` + `coachClassName`. 라벨은 렌더 시 부착, `raw_text`는 본문만 | `lib/coachBlock.ts:17-31` |
| G-2′ | 메모의 "네모 말풍선 안 느낌표" = **`IconCoachImportant`가 정확히 그것**(둥근 사각 말풍선 + 꼬리 + 느낌표) | `Icons.tsx:508-518` |
| G-3′ | 렌더 5사이트 모두 `CoachLabel` 공용. 색은 CSS `--coach-accent` 소유 — 인라인 색 금지(인쇄가 `#000`으로 덮는다) | `CoachLabel.tsx:14-21`, `PrintStyles.css:166-182` |
| G-4′ | 5사이트: `EditorView:3692-3699` · `TabBody:148-155` · `FolderView:340-347` · `ProblemTabContent:86-93` · `PrintableContent:105-110` | — |
| G-5′ | `.coach-block .coach-label` 특이도 (0,2,0) 필수(`.solution-tone` 동률 회피) | `globals.css:639-649` |
| **G-6′** | **`coach_caution`은 `EditorView` 상수 5곳에 있다**: `BLOCK_TYPE_LABELS:105` · `BLOCK_TYPES:121` · `BLOCK_PRESETS:135` · `TEXT_BASED_TYPES:152` · `SPLITTABLE_TYPES:159`. **추가로 `lib/solutionOutline.ts:74`** | — |
| **G-7′** | **`normalizeBlockType`(`EditorView.tsx:164-167`)은 레거시 타입 은퇴의 확립된 전례다**(`math_block`·`bullet` → `text`). 호출은 로드(`:1184`)와 `:2710` 두 곳 → 여기 1줄이면 편집창을 연 문항의 caution 블록이 자연히 정규화되고 다음 저장에 확정된다. **배치 마이그레이션 0** | — |
| G-8′ | `<select>` 현재값 보존 폴백 전례(`:900-906`)는 **Q12 채택으로 불필요**해졌다 — 쓰면 "코칭 (Tip)" 옵션이 목록에 두 번 뜬다 | — |
| G-9′ | 접힘 상태 키 전례 `blockKeyOf(b) = block_key || id` · Toggler(`aria-expanded`) · `keepAnchor` | `caseBlock.ts:75-77`, `OutlineSections.tsx:36-70` |
| G-10 | `lib/coachBlock.ts:15-16` 주석("라벨 어절은 영문 그대로, v4 Q2")을 **이번에 번복**한다. 근거: 종류가 1개가 되면 GitHub 어휘 체계(Important/Caution 대비)가 소멸하므로 원문 유지의 이유가 사라진다 | — |

---

## 3. 결정표 (v2 확정)

### A. 팝업창 일원화

| # | 결정 |
|---|---|
| **D1′** | 신규 `components/ui/dialogStyles.ts` — **`SheetImportModal.tsx:76-108`의 값을 그대로 복제**해 단일 원천으로: 오버레이 `fixed inset 0` + `rgba(0,0,0,0.4)` + flex center · 본체 `var(--bg-card, #fff)` · **radius 10** · **테두리 없음** · `boxShadow '0 8px 32px rgba(0,0,0,0.2)'` · `fontFamily var(--font-ui)` · head/foot `minHeight 57` · `padding '0 16px'` · `1px solid var(--border-light)` 구분선 · body `padding 16`. 위험 버튼은 `RestoreConfirm` 전례(`#e53935`). **기존 2파일(SheetImport·BatchVerify)은 이번에 손대지 않는다**(Q1) |
| **D2′** | `Z_DIALOG = 10500` (dialogStyles가 소유·export). 현행 최고 10000(Sidebar 2곳·SvgViewer 전체화면) 위. **기존 z-index 재배치는 범위 외** — 값 조사표만 CLAUDE.md에 기록 |
| **D3′** | 신규 `lib/dialogs.ts`(모듈 싱글턴 + Promise API) + `components/ui/DialogHost.tsx`(`'use client'`, `app/layout.tsx`의 `<body>` 안에 마운트 — admin 라우트 포함 전 화면 커버). API: `alertDialog(message)` → `Promise<void>` · `confirmDialog({title?, message, danger?, confirmLabel?})` → `Promise<boolean>` · `promptDialog({title, message?, defaultValue?, placeholder?, validate?})` → `Promise<string|null>`. `message: string | string[]`(다행은 배열). **큐 처리**: 중첩·연속 호출은 순차 |
| **D4′** | PromptDialog는 `NicknameSetupModal` 승계(Enter 확정 + `isComposing` IME 가드 + Escape 취소 + autoFocus·전체 선택). ConfirmDialog는 `RestoreConfirm` 3단 레이아웃 승계. Escape/오버레이 클릭 = 취소(`false`/`null`) |
| **D5′** | 치환 **56곳 / 14파일**(`PdfDownloadButton` 제외, Q3): confirm 17 → `await confirmDialog` · prompt 5(문항 이동 제외) → `await promptDialog` · alert 34−1=33 → `await alertDialog`. **async 전환이 필요한 곳은 2곳뿐**(A-7′): `EditorView.tsx:2557` · `AppShell.tsx:661`. `switch/case` 안 `await`는 `break` 위치 재확인 |
| **D6′** | **A-4 = 문항의 폴더 이동**(Q2): `AppShell.tsx:563`의 "이름 타이핑 매칭" prompt를 폐기하고 신규 `FolderPickerDialog`로 교체. 트리는 `lib/folder-tree.ts`의 `buildFolderTree`/`flattenVisible` 재사용, **UI 전례는 `SheetImportModal.tsx:448-458`의 폴더 트리 행 스타일**. 요건 3가지 — ① 동명 폴더를 계층으로 구분(현행 prompt는 이름 매칭이라 동명이면 오작동) ② **'미지정'(folder_id 없음) 선택 가능** ③ **휴지통 제외** ④ 현재 폴더는 비활성. **순환 방지는 불필요**(문항엔 자손이 없다) |
| **D7′** | CLAUDE.md에 규약 추가: "`alert`/`confirm`/`prompt` 직접 호출 금지 — `lib/dialogs.ts` 경유". **기존 모달 8종의 재작성은 범위 외** — 신규 3종 + 픽커만. `PdfDownloadButton`은 죽은 파일로 표시(별건 삭제 후보) |

### B. 선택지 정렬

| # | 결정 |
|---|---|
| **D8′** | `ChoicesBlock.tsx:36` `alignItems: 'baseline'` → `'center'`. 라벨 `lineHeight:1` 유지 |
| **D9′** | `PrintStyles.css:256` `.print-choice-item { align-items: baseline }` → `center`. **`.print-body` 접두를 새로 붙이지 말 것**(B-5′ — 그 클래스는 인쇄 전용이라 누출이 없고, 접두는 특이도만 바꾼다) |
| **D10′** | 2줄 wrap 시 라벨이 콘텐츠 전체 높이 중앙에 오는 것은 **의도된 동작으로 수용**(Q4). 검수 T3에서 실물 확인 |

### C. 참조 인용 hover

| # | 결정 |
|---|---|
| **D11′** | 재인용 마크업: `<span class="ref-marker" data-reftype="tag|circled|gana|giyeok" data-ref="…">…</span>`. 인식 규칙 — ① `\ref{n}`(텍스트 영역) → 기존 평문 치환을 span 치환으로 변경(`reftype=tag`, `data-ref=n`) ② 행 시작이 아닌 위치의 `[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]` → `circled` ③ 행 시작이 아닌 `(가)~(차)` → `gana` ④ 행 시작이 아닌 낱자 **`[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ]`**(앞뒤가 한글 음절·자모가 아닐 것, 뒤따르는 `.` 선택 포함) → `giyeok`. **범위 표기 `[ㄱ-ㅊ]` 금지**(정정6) ⑤ `C1`은 `.case-ref` 재사용 — `convertCaseRefs`가 `data-reftype="case"`를 함께 붙이도록 1줄 확장(Q6). **평문 `(3)` 숫자는 자동 인식하지 않는다** |
| **D12′** | 삽입 위치: `preprocessLocale` 사본 2벌에서 **마커 변환 전부 뒤 · `convertCaseRefs` 직전**. 자기 보호는 `convertCaseRefs` 방식을 따르되 **요소 통째 보호 목록을 확장**(정정7): 코드펜스 → **`marker-gana`·`marker-giyeok`·`marker-circled`·`marker-case-sub`·`tag-marker`·`case-label` span 요소 통째** → 남은 낱개 태그 → 인라인 코드. 수식은 이미 `⟦MATH_n⟧`이라 기보호. **정규식·스캐너는 `lib/locale.ts`가 소유하고 EditorPreview 사본은 import한다 — 사본에 재작성 금지** |
| **D13′** | hover 동작: `.ref-marker, .case-ref { cursor: help }` → **1000ms 지속 후** 말풍선(Q8, 상수 `REF_TOOLTIP_DELAY_MS`). 마커 또는 말풍선 위에 있는 동안 유지, 벗어나면 닫힘. **스크롤 시 즉시 닫힘** |
| **D14′** | 신규 `components/ui/RefTooltip.tsx` — **`document.body` 포탈 1개 + `document` 이벤트 위임 1개**(mouseover/mouseout, `closest('[data-reftype]')`). 활성 게이트는 **`closest('[data-ref-tooltip]')`**(Q6) → 공개 뷰어의 다중 스크롤 컨테이너 문제가 사라진다. **React state를 EditorPreview·TabBody에 추가 금지**(C-7′). 위치는 `getBoundingClientRect` + 화면 클램프. z-index `Z_DIALOG − 100` |
| **D15′** | 원본 조회는 **DOM 탐색**(자료구조 신설 없음): `[data-ref-tooltip]` 서브트리에서 reftype별 정의부 선택자(`.tag-marker` / KaTeX `.tag` / `.marker-circled` / `.marker-gana` / `.marker-giyeok` / `.case-label`)를 훑어 **공백 제거 텍스트가 일치**하는 마커를 찾는다. 후보가 여럿이면 **참조보다 문서 순서상 앞선 것 중 가장 가까운 것**, 없으면 문서 첫 번째, 그래도 없으면 **무음**(Q7). 표시 대상은 그 마커가 속한 블록(가장 가까운 `p` · `.katex-display` · 경우 제목행)을 `cloneNode(true)`로 복제. **원문 인덱스 포함은 자동 충족** |
| **D16′** | 적용 화면 = **ProblemView(`TabBody`) + 공개 뷰어(`ProblemTabContent`)** — 두 곳의 컨테이너에 `data-ref-tooltip` 속성만 붙인다. 편집 미리보기·인쇄·폴더뷰 카드는 속성을 붙이지 않아 **마크업은 있어도 아무 일도 일어나지 않는다** |
| **D17′** | 말풍선 스타일: `var(--bg-card)` + `0.5px solid var(--border-light)` + radius 8 + shadow, `maxWidth: min(35em, 80vw)` · `maxHeight 40vh` · `overflow:auto`. **⚠ 내부를 `<div class="preview-content tone-baseline">`로 감싸고 원본의 `--content-font-size`를 복사할 것**(C-8′) — 안 하면 복제한 수식의 크기·색·`\tag` 앵커가 원본과 달라진다 |
| **D18′** | **시각 표시는 `cursor:help`만**(Q5). 밑줄·색·배경 금지 — 마크업이 5사이트+인쇄에 다 생기므로 스타일은 곧 전역 조판 변경이다 |
| **D19′** | 회귀 테스트를 `tests/locale.test.mjs`에 추가(C-10): ① 정의부 재감쌈 없음(`(가)`·`ㄱ.`·`①` 행 시작) ② 자모 범위(ㄲ·ㄸ·ㅃ·ㅆ·ㅉ 미인식) ③ 수식 내부 미인식(`$…$`·`$$…$$`) ④ 코드펜스·인라인 코드 보호 ⑤ `\ref{2}` → `reftype=tag` ⑥ 멱등성(두 번 돌려도 같은 결과) |

### D. ProblemView 보기 개편

| # | 결정 |
|---|---|
| **D20′** | **배경 전환**: 클레이 U-프레임(3면 테두리 포함) 제거 → 스크롤 컨테이너 배경을 **아이보리 `--bg-functional`** 로. 탭 본문 열을 카드로: `background: var(--bg-content)` · `0.5px solid var(--border-content)` · `borderRadius 12`(폴더뷰 카드와 같은 문법, D-8′). **`var(--card-surface, …)`를 쓰지 않는다** — 그 변수는 폴더뷰 카드·행의 hover 계약이라 여기 끌어오면 의미가 꼬인다. 카드 컨테이너에 `--case-dot-fill: var(--bg-content)` 재정의(D-10′). **EditorView는 무변경**(E-M2-2) → CLAUDE.md의 "U-프레임 2곳 공유" 규약에 **예외 기록** |
| **D21′** | **카드 기하**: 본문 폭 `W = widthEm × contentFontSize` 유지, 카드 = 본문 + **`padding '20px 36px 20px 40px'`**(좌 40px ≥ 2.2em@15 — 경우 거터 잘림 방지, D-9′ 전례). **카드에 `overflow:hidden` 금지.** `question` 탭의 기존 `marginLeft:-24` 분기는 **제거**(모든 탭이 카드가 되므로 불필요). 카드 간 세로 여백 `2em`(접힘 시 `1em`). 탭 라벨 열은 **카드 밖 좌측**(현행 위치 유지 = 메모의 "탭 레이블은 클레이 영역 밖으로" 충족) |
| **D22′** | **폭 순증 억제**(Q11): 카드가 좌우 76px을 더하는 대신 **가운데 영역 패딩 `'0 32px'` → `'0 16px'`** → 순증 **+44px**(fs15 736 → 780). 아이보리 바탕이라 컨테이너 여백이 줄어도 답답해지지 않는다 |
| **D23′** | **컨테이너 개편**: 스크롤 컨테이너 `display:flex` → **`display:block` + `overflowX:'auto'`**, 가운데 영역 `display:'table'` → **일반 block + `width:'fit-content'` + `margin:'0 auto'`**(F-4′). 패널 열림 시의 `justifyContent:'unsafe flex-end'`는 **`margin:'0 0 0 auto'`** 로 등가 이전. ⚠ **넘침 방향이 바뀐다** — 기존은 좌측(닿을 수 없음), 신규는 우측(가로 스크롤로 닿음). 그것이 K1 해소의 실체다. **하단 스페이서 div(70vh)는 필수 유지**(아래 D26′의 전제) |
| **D24′** | **가로폭 조절**: 상태 `widthEm`(기본 35, **min 35, max 45**, 1em 단위 — Q11). UI는 우측 상단 글자크기 스테퍼 옆에 −/+ 한 벌. `localStorage` 키는 관례대로 **`mathory-problem-width-em`**(하이픈, D-13). 전역 영속(문항별 아님). `TabBody`의 `mainColStyle` 상수 `35`를 prop으로 승격 |
| **D25′** | **문제 카드**: 첫 카드, 스크롤 컨테이너 안 `position:sticky; top:0`. **⚠ sticky 래퍼가 아이보리를 칠해 위 여백과 라운드 바깥을 덮어야 한다**(`ListView.tsx:100-107` 함정 전례). 라벨('문제') **클릭**으로 접기/펼치기 토글(`openTabs.question` 재사용) — **wheel로는 토글되지 않는다**(메모 사양). 접힘 = 본문 첫 줄만(`maxHeight` 1행 + `overflow:hidden` + 하단 페이드) + 카드 배경 `--block-bg-active #E8DFCE`. ⚠ 그 값은 **현행 화면 최악 배경과 같은 값**이라 Phase 58·59a의 명암비 계산(`--case-dot` 3.28 / `--tone-dim` 4.76)이 그대로 유효하다 — **더 어둡게 내리지 말 것** |
| **D26′** | **풀이·풀이2 카드**: sticky 없음, 접기/펼치기 없음(접힘은 문제 카드 전용 — 기존 `openTabs`의 풀이 탭 라벨 클릭 토글은 제거). 스크롤하면 sticky 문제 카드 아래로 밀려 들어가며 사라진다. **라벨 열은 `position:sticky; top:0`**(Q10 — 1차 단순화. 문제 카드 접힘 높이 연동은 ResizeObserver가 필요하고 자동접힘 중에 라벨이 따라 튀므로 v3에서 실물 보고 판단) |
| **D27′** | **스크롤 자동접힘**(문제 탭만): `contentScrollRef`의 `onScroll` 1곳에서 처리. 순방향 `scrollTop > T1`(≈80px) → ① **제목행을 슬림 바로 접고**(Q9 — 제목·폴더경로만 사라지고 **댓글💬·AI 버튼 줄 36px은 남는다**, D-2′) ② **300ms 시차** 후 문제 카드 접힘. 역방향 `scrollTop < T2`(≈8px) → ① 문제 펼침 ② 이어서 제목행 복원. **히스테리시스**: `T1 ≠ T2` + 접힘·펼침 각각 쿨다운, 높이 급변은 `keepAnchor`(D-7′) 방식으로 scrollTop 보정. **사용자 수동 토글을 덮어쓰지 않는다** — 수동 조작 후에는 최상단 복귀까지 자동접힘 보류 |
| **D28′** | ⚠ **하단 스페이서(70vh)가 D27′의 전제다**(v1 누락): 제목행 접힘은 scrollTop이 아니라 컨테이너 `clientHeight`를 키우므로, 스크롤 여유가 없으면 브라우저가 scrollTop을 클램프해 `T1` 아래로 떨어뜨리고 **flapping**이 난다. 스페이서를 줄이거나 없애지 말 것 |
| **D29′** | `handleJumpToBlock`(D-11′)에 **sticky 문제 카드 높이 + 슬림 바 높이**만큼 오프셋 보정 추가(점프 대상이 헤더 뒤로 숨지 않게). 현재는 세로 중앙 정렬이라 상단 근처 블록이 특히 위험하다 |
| **D30′** | 우측 단(220)·댓글 패널·글자크기 조절의 절대배치 좌표는 현행 유지, 개편 후 실측으로 어긋남만 보정. ⚠ **컨텐츠 행(`:656`)에 `position:relative`를 주지 말 것** — 글자크기 컨트롤(`:712`)·우측 단 토글(`:769`)이 그 행 안에 있으면서 **루트 기준** `top:16`/`top:52`라 제목바 높이(98px)만큼 내려간다(Phase 62 규약). 모바일 무대응이되 임계값·애니메이션은 상수화 |

### E. 폴더뷰 열수

| # | 결정 |
|---|---|
| **D31′** | `FolderView.tsx:503` 래퍼: `maxWidth: effectiveViewMode === 'card' ? 'none' : 1200`(longhand 항상 값 지정, E-5′). 제목바 래퍼(`:379`)·리스트보기·grid 정의(520px 고정 트랙·gap 20·`justifyContent:center`)·카드 규격은 **전부 무변경**. 결과: 사이드바 260 기준 **1924px에서 3열, 2444px에서 4열** |

### F. 사이드바 자동접힘 제거

| # | 결정 |
|---|---|
| **D32′** | `AppShell.tsx:620-625` useEffect 삭제 + 명령형 `setCollapsed(true)` 3곳(`:349·370·371`) 삭제 + 강제 펼침 `setCollapsed(false)` 4곳(`:368·376·616·829`) 삭제 → **접힘 상태는 사용자 토글만이 바꾼다**. `collapsed` 상태·토글 버튼·`DrawerResizeHandle` 게이트(`:692`)·Sidebar 접힘 분기는 전부 유지 |
| **D33′** | 좁은 창 잘림 보완은 **D23′이 담당**한다 → **F는 D와 같은 스텝**이다. F만 먼저 나가면 K1 잘림이 실결함으로 승격되므로 **단독 선행 금지** |

### G. 코칭블록

| # | 결정 |
|---|---|
| **D34′** | 표시 단일화: `COACH_LABELS` 두 키 모두 `'Tip'` · `CoachLabel`은 타입 무관 `IconCoachImportant` · `coachClassName`은 두 타입 모두 `'coach-block coach-important'` 반환(색 = 보라 `#6639ba` 단일, S6). `globals.css`의 **`.coach-caution` 규칙과 `--coach-caution` 토큰 삭제**, `IconCoachCaution`은 **파일 보존**(Q14). G-10의 번복 사유를 `coachBlock.ts` 주석·CLAUDE.md에 기록 |
| **D35′** | **레거시 정규화**(Q12): `normalizeBlockType`(`EditorView.tsx:164-167`)에 `if (type === 'coach_caution') return 'coach_important';` 1줄 추가 — `math_block`·`bullet` 전례와 동일. **배치 마이그레이션 0**(편집창을 연 문항만 다음 저장에 확정). `<select>` 현재값 보존 폴백은 **쓰지 않는다**(G-8′) |
| **D36′** | 에디터 상수: `BLOCK_TYPES`(`:121`)에서 `coach_caution` **제거**, `BLOCK_TYPE_LABELS.coach_important`(`:104`) = `'코칭 (Tip)'`. **⚠ `BLOCK_TYPE_LABELS.coach_caution` · `BLOCK_PRESETS`(`:135`) · `TEXT_BASED_TYPES`(`:152`) · `SPLITTABLE_TYPES`(`:159`) · `solutionOutline.ts:74`의 `coach_caution`은 유지**(G-6′) — 정규화 이전에 로드된 블록의 편집·분할·요약이 죽지 않게. 타입 union·Firestore·`exportMd` 무변경 |
| **D37′** | 접힘/펼침: 신규 `components/ui/CoachBlock.tsx` — 기존 5사이트 공통 패턴(`div.coach-block > CoachLabel + EditorPreview`)을 흡수하고 `collapsible` prop 추가. 접힘 = **아이콘만**(라벨 어절·본문 숨김), 펼침 = 아이콘+라벨+본문. 아이콘 클릭 토글(`role="button"` + `aria-expanded` + Enter/Space). **기본 접힘.** 상태는 컴포넌트 로컬 `useState`(비영속, S5) — 렌더 사이트가 `key={block.id}`를 주므로 인스턴스 수명이 블록과 일치한다 |
| **D38′** | 사이트별 적용(Q13): **`TabBody`·`ProblemTabContent` = `collapsible`(기본 접힘)** / **`FolderView` = 항상 펼침**(320px 축약 카드에서 아이콘 하나만 남으면 무엇이 있는지 알 수 없다) / **`EditorView` 미리보기·`PrintableContent` = 항상 펼침 + 토글 UI 없음**(인쇄에 버튼 금지). 아이콘 색·크기는 기존 `.coach-label` 토큰 그대로, **클릭 영역만 패딩으로 확대**. 특이도 (0,2,0) 유지(G-5′) |

### H. Q-A · Q-E 실측 확정 (2026-08-28)

| # | 결정 |
|---|---|
| **D39′** | **Q-A = B안 확정**(슬림 바 = 축약 제목 + 버튼). 사양: 높이 36px · 하단 `0.5px solid var(--border-light)` · 제목 `12.5px / 600 / var(--text-secondary)` · 버튼은 현행 13px에서 **12px**로. 근거는 D-16 — A안은 버튼의 소속과 "지금 보는 문항"을 동시에 잃는다. **구현 주의 2건(D-17)을 그대로 지킬 것**: 컨테이너 `min-width:0`, 제목 span에 말줄임 3종, `.btns { flex-shrink: 0 }` |
| **D40′** | **제목바 좌측 정렬을 카드 좌단(203px)에 맞춘다**(D-18). 슬림 바·펼침 상태 **둘 다** 같은 기준을 쓴다 — 접힘/펼침에서 제목이 가로로 움직이면 안 된다 |
| **D41′** | **Q-E = `\tag` 정의부를 1차 지원에 포함**(D11′①의 `reftype=tag`가 수식·텍스트 양쪽 정의부를 모두 가리킨다). 근거 C-11 — `.tag`의 `textContent`가 `"(3)"` 단일 텍스트 노드라 공백 정규화조차 필요 없다. 다만 **탐색 시에는 다른 정의부와 같은 규칙(공백 제거 후 비교)을 그대로 적용**해 경로를 하나로 유지한다 |
| **D42′** | **Q-F = D17′ 방식 확정**(C-14 실측). 말풍선 내부는 `<div class="preview-content tone-baseline">`로 감싸고 원본에서 **`--content-font-size`를 읽어 복사**한다. ⚠ **복제 단위는 `.katex-display` 이상**이어야 한다 — `.tag` 정렬 규칙이 `.katex-display > .katex > .katex-html > .tag`라는 **정확한 조상 체인**을 요구하므로 `.katex`만 떼어내면 번호가 어긋난다. `$$…$$`는 `<p>` 안에 들어가지 않으므로 D15′의 "가장 가까운 `p`" 경로로는 잡히지 않는다 — `.katex-display` 폴백이 필수 |
| **D43′** | `globals.css:514-522`의 `.mopen/.mord/.mclose` 주석을 **실측값으로 정정**(C-12). 규칙 자체는 손대지 않는다 |

### I. 2차 실측 확정 (2026-08-28, ROUND A~D)

| # | 결정 |
|---|---|
| **D44′** | **D8′·D9′ 확정 — center는 완전 해결책이다**(B-7). 편차가 세 글꼴 크기 모두 정확히 0이므로 v1이 남겨 둔 "어긋나면 `lineHeight: inherit` 재검토" 유보는 **불필요**하다. 라벨 `lineHeight:1`을 그대로 둔다 |
| **D45′** | **D23′ 정정 — 자식 폭은 `fit-content`가 아니라 `max-content`를 쓴다.** 둘 다 실측 통과하지만(F-6), `fit-content`는 정의상 가용폭으로 **클램프**하는 성질이 있어 지금은 카드 행이 고정폭이라 우연히 같은 결과가 나올 뿐이다. 나중에 카드 폭을 %·유동으로 바꾸면 `fit-content`는 **조용히 잘리기 시작**한다. 의미가 곧 의도인 `max-content`가 옳다 |
| **D46′** | **D25′는 D23′ 없이 성립하지 않는다**(D-19). 컨테이너를 block으로 바꾸지 않은 채 문제 카드에 `position:sticky`만 달면 **조용히 실패**한다(스크롤 후 −220px로 흘러감). 만약 어떤 이유로 flex를 유지해야 한다면 **`align-items: flex-start`가 필수 조건**이다 — 그 사실을 코드 주석에 남길 것. D33′("D와 F는 같은 스텝")의 근거가 하나 더 늘었다 |
| **D47′** | **D11′④ 정규식 정정**(C-16). 자모 참조의 경계 조건을 아래로 바꾼다 — 뒤쪽에서 **한글 음절을 배제하지 않는다**(조사가 붙는 것이 정상 표기이므로):<br>`(?<![가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9])([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.?(?![ㄱ-ㅎㅏ-ㅣA-Za-z0-9])`<br>실측 11개 표본에서 **통과 10 · 놓침 0 · 오탐 0**(원안은 놓침 4). 유일한 잔여 오탐 후보는 `ㄱ자 모양`인데, **정의부가 없으면 무음**(D15′)이고 **시각 표시도 없어**(D18′) 사용자에게 드러나지 않는다 — 수용한다 |
| **D48′** | **D12′ 확장 보호 목록을 그대로 확정**(C-15). 프로토타입에서 현행 목록은 이중 감쌈 5회, 확장 목록은 0회였다. 회귀 테스트(D19′)의 ①항은 이 5개 사례를 그대로 고정한다 |

---

## 4. 구현 항목

### 4-A. 팝업 (신규 4파일 + 호출부 14파일)

```
components/ui/dialogStyles.ts         // D1′ — SheetImportModal 값 복제 + Z_DIALOG(D2′)
lib/dialogs.ts                        // D3′ — 모듈 싱글턴: subscribe/open + 큐
components/ui/DialogHost.tsx          // D3′ — 'use client', app/layout.tsx <body> 안
components/ui/FolderPickerDialog.tsx  // D6′ — buildFolderTree/flattenVisible + SheetImportModal:448 행 스타일
```

치환 대상(전수, **56곳 / 14파일**):
`AppShell.tsx`(prompt **5** · confirm 4 · alert 10) · `CommentPanel.tsx`(confirm 2 · alert 5) · `PublishList.tsx`(confirm 3 · alert 3) · `EditorView.tsx`(confirm 1 · alert 4) · `CommentEditor.tsx`(alert 4) · `ShareSettingsPanel.tsx`(confirm 3) · `ListView.tsx`(confirm 1 · alert 2) · `ImageUploadButton.tsx`(alert 3) · `lib/pdfPrint.tsx`(alert 1) · `ShareTargetModal.tsx`(confirm 1) · `BazaarView.tsx`(confirm 1) · `ProblemView.tsx`(alert 1) · `SheetImportModal.tsx`(prompt 1) · `app/admin/migrate/page.tsx`(confirm 1)
**제외**: `components/print/PdfDownloadButton.tsx`(alert 1) — 죽은 파일(Q3)

### 4-B. 선택지 (2줄)

`ChoicesBlock.tsx:36` `'baseline'`→`'center'` · `PrintStyles.css:256` 동일(접두 추가 금지).

### 4-C. 참조 hover

```
lib/locale.ts                 // D11′·D12′ — REF_* 정규식 + convertRefMarkers(text) export
lib/caseBlock.ts              // D11′⑤ — convertCaseRefs가 data-reftype="case" 병기
components/editor/EditorPreview.tsx  // 인라인 사본에 같은 단계 삽입(상수는 import)
components/ui/RefTooltip.tsx  // D13′~D18′ — 포탈 1 + document 위임 1
TabBody.tsx / ProblemTabContent.tsx  // 컨테이너에 data-ref-tooltip 속성 — D16′
app/globals.css               // .ref-marker, .case-ref { cursor: help } + 말풍선 스타일
tests/locale.test.mjs         // D19′ — 6항목
```

### 4-D·F. ProblemView (동일 스텝)

```
ProblemView.tsx   // D20′ 프레임 제거·배경 전환 / D23′ 컨테이너 block+fit-content+margin auto+overflowX auto
                  // D24′ widthEm 상태+스테퍼+localStorage / D27′ onScroll 자동접힘 + 슬림 바
                  // D29′ 점프 오프셋 / D30′ 절대배치 재실측
TabBody.tsx       // D21′ 카드화(question 분기 제거·전 탭 카드)·D22′ 패딩·라벨 열 sticky(D26′)·widthEm prop
AppShell.tsx      // D32′ — 자동접힘·강제 펼침 7곳 삭제
app/globals.css   // 카드·접힘 페이드·제목행 슬림 바 트랜지션
```

### 4-E. 폴더뷰 (1줄)

`FolderView.tsx:503` `maxWidth: effectiveViewMode === 'card' ? 'none' : 1200`.

### 4-G. 코칭블록

```
lib/coachBlock.ts             // D34′ — 라벨 'Tip'·className 단일화·번복 사유 주석
components/ui/CoachBlock.tsx  // D37′ — 공통 패턴 흡수 + collapsible
5개 렌더 사이트                // D38′ — 패턴 치환(분기 순서는 사이트별 현행 유지)
EditorView.tsx                // D35′ normalizeBlockType 1줄 + D36′ BLOCK_TYPES·라벨
app/globals.css               // .coach-caution 규칙·--coach-caution 토큰 삭제 + 접힘 스타일
```

---

## 5. 폭 예산 (정정 — E·F·D 상호작용)

fs15 · 사이드바 260 기준. 본문 행 = `라벨 7em + gap 2.8em + 본문 35em + 컨테이너 패딩`.

| 화면 | v1 표기 | **현행 실측** | **D21′·D22′ 이후(+44)** |
|---|---|---|---|
| ProblemView 본문만 | 722 | **736** | **780** |
| ProblemView + 사이드바 260 | 982 | **996** | **1040** |
| + 댓글 패널(기본 420 + 8) | 1350 | **1424** | **1468** |
| + 폭 45em까지 확대(D24′) | — | — | **1618**(패널 포함) |
| 폴더뷰 3열 | 1924 | **1924** ✓ | — |
| 폴더뷰 4열 | — | **2444** | — |
| EditorView | 1314 | 1314(기존 내부 가로 스크롤) | — |

초과분은 **D23′의 가로 스크롤로 전 범위 도달 가능**(K1 해소). 글꼴 24px에서 카드화 후 본문 행은 **1259px**이므로 좁은 창에서는 가로 스크롤이 상시 나타난다 — 정상 동작이다.

---

## 6. 실행 순서 (그룹 단위로 커밋·검수)

| 스텝 | 항목 | 완료 기준 |
|---|---|---|
| **1** | **B + E + G** (상태 3건) | T1~T11′. 그룹 끝에 덕수 실물 검수 ① |
| **2** | **A** (신규 4파일 + 치환 56곳 + 픽커) | T12~T16. 검수 ② — 특히 문항 이동 픽커·시트 모달 안 프롬프트 |
| **3** | **C** (참조 hover) | T17~T21 + `npm run test:locale`. 검수 ③ |
| **4** | **D + F** (ProblemView 개편 — 반드시 동일 스텝, D33′) | T22~T31. 검수 ④ (최대 관문) |
| 5 | 문서: §9 매핑 + CLAUDE.md 규약 갱신 | 커밋(push는 덕수) |

---

## 7. 검증 체크리스트

**B** · T1 로그·적분·번분수·짧은 수식 혼재 5지선다에서 원문자 y 일치(**11·15·24px 3조건 실측**, 근거 = B-4′) · T2 인쇄 미리보기 동일 · T3 2줄 wrap 선택지 실물 확인(D10′)

**E** · T4 1920/2560 창에서 3/4열 · T5 리스트보기 폭 불변(1136) · T6 공유 스코프 화면(`AppShell.tsx:783`)도 동일 · T7 hover·페이드·rail 미표시 예외 회귀 0

**G** · T8′ 기존 caution 문항 → Tip 라벨·보라·Important 아이콘 렌더 + **편집창을 열면 타입이 coach_important로 정규화되고 저장 후에도 편집·분할 정상**(D35′·D36′) · T9′ 기본 접힘(아이콘만) → 클릭 펼침, 키보드 토글 · T10′ 인쇄·편집 미리보기·**폴더뷰 카드**는 항상 펼침 + 인쇄에 버튼 없음(D38′) · T11′ 접힘/펼침이 요약 보기(outline)와 충돌 없음

**A** · T12 confirm 17곳 각 취소/확정 경로 · T13 prompt IME(한글 조합 중 Enter) · T14 시트 모달(z 9000)·SvgViewer 전체화면(z 10000) 위에서 다이얼로그가 위에 뜸 · T15 다행 메시지(폴더 삭제·휴지통·admin) 줄바꿈 · T16 **문항 이동 픽커** — 동명 폴더 계층 구분·미지정 선택·휴지통 미표시·현재 폴더 비활성

**C** · T17 4종 reftype 각각 hover → 1초 후 말풍선 + **원문 인덱스 포함**(`\tag` 정의부 포함, D41′) · T18 자모 경계(D47′): **`ㄱ이`·`ㄱ은`·`ㄷ에서`·`ㄴ의`가 모두 인식**되고 **ㄲ/ㄸ/ㅃ/ㅆ/ㅉ·ㅋㅋ·모음에는 미부착** · 선택지 블록·경우 라벨·`\mathrm` 잔재 오탐 0 · T19 **정의부 재감쌈 없음**(행 시작 `(가)`·`(나)`·`ㄱ.`·`ㄴ.`·`①` 5개 — C-15가 고정한 사례) · T20 말풍선 안 수식이 **원본과 같은 크기·색**(D17′·D42′) — **본문 24px 조건에서 반드시 확인**(15px에서는 폴백값이 우연히 일치해 결함이 안 보인다, C-14) · T21 말풍선 위에서 드래그 선택 생존(C-7′) · 스크롤 시 닫힘 · 화면 가장자리 클램프 · `npm run test:locale` 통과

**D·F** · T22 카드 색·테두리·radius가 폴더뷰 카드와 같은 문법 · T23 경우 블록 rail·dot이 카드 좌측 패딩 안에서 안 잘림 + dot-fill 관통 없음 · T24 문제 카드 sticky + **래퍼가 위 여백·라운드 바깥을 덮어 스크롤된 카드가 비치지 않음** · T25 라벨 클릭 토글(wheel로는 안 됨) + 접힘 첫 줄·페이드·진한 배경 · T26 순방향: **슬림 바로 접힘(축약 제목 + 댓글💬·AI 버튼 잔존, D39′)** — **아주 긴 제목에서 버튼이 살아남는지 반드시 확인**(D-17) · 접힘/펼침에서 제목 좌단이 가로로 안 움직이는지(D40′) → 300ms 후 문제 접힘 / 역방향 최상단: 역순 복원 / **경계 scrollTop에서 진동 0** · T27 짧은 문항(스페이서만 있는 경우)에서도 flapping 0(D28′) · T28 풀이 카드 라벨 sticky · T29 폭 스테퍼 35→45em·35 미만 불가·새로고침 복원 · T30 **좁은 창(1200px)에서 가로 스크롤로 본문 좌단 도달 가능**(K1 해소, F-6) — `scrollWidth`가 본문 행 폭 이상인지 함께 확인 · T30b 넓은 창에서 중앙 정렬 유지 · T31 검증 리포트 점프가 sticky 뒤에 안 숨음(D29′) + 사이드바: 문항 진입·이탈 시 접힘 상태 불변, 수동 토글만 동작

**공통** · 글꼴 11·15·24px 3조건 · EditorView↔ProblemView 전환 시 기능 회귀 0(배경 차이는 수용, E-M2-2) · `npm run build` 통과

---

## 8. 하지 말 것

- (A) 기존 모달 8종을 이번에 재작성하지 말 것(D7′). z-index 전면 재배치 금지(토큰 + 조사표만). **`FolderPickerDialog`에 순환 방지를 넣지 말 것** — 문항 이동에는 자손 개념이 없다(정정3).
- (B) 그리드↔래퍼 구조(`display:contents`·서브그리드) 변경 금지 — **stretch가 깨지면 center의 근거가 사라진다**(B-4′). `.print-choice-item`에 `.print-body` 접두를 새로 붙이지 말 것.
- (C) hover를 React state로 만들지 말 것(C-7′). **범위 표기 `[ㄱ-ㅊ]` 금지**(정정6). **요소 통째 보호 목록에서 marker span을 빠뜨리지 말 것**(정정7 — 정의부가 참조로 둔갑한다). 평문 `(3)` 자동 인식 금지. 사본 2벌 중 한쪽만 고치지 말 것. **`.ref-marker`에 시각 스타일 금지**(Q5).
- (D) 카드에 `overflow:hidden` 금지 · `.case-block`에 상하 padding 금지 · `paddingBottom:100vh` 금지 · **하단 스페이서 70vh 축소·삭제 금지**(D28′) · **컨텐츠 행에 `position:relative` 금지**(D30′) · 접힘 배경을 `#E8DFCE`보다 어둡게 내리지 말 것(D25′).
- (F) **D 없이 F만 선행 배포 금지**(D33′) — K1 잘림이 실결함이 된다.
- (G) `CoachLabel`에 인라인 색 금지(인쇄 `#000`이 못 이긴다, G-3′). 타입 union·Firestore·`exportMd` 건드리지 말 것. **`BLOCK_PRESETS`·`TEXT_BASED_TYPES`·`SPLITTABLE_TYPES`·`solutionOutline.ts`의 `coach_caution`을 지우지 말 것**(D36′).
- 공통: `PrintStyles.css`는 화면에도 로드 → 새 규칙은 `.print-body` 접두 필수. 조건부 style의 longhand는 항상 값 지정. 새 색 토큰에 다크 정의 금지.

---

## 9. 문서 갱신 매핑 (스텝 5)

| 항목 | 갱신 |
|---|---|
| A | CLAUDE.md: 네이티브 팝업 금지 규약 + `lib/dialogs.ts` 사용법 + `Z_DIALOG` 토큰 + z-index 조사표 + `PdfDownloadButton` 죽은 파일 표기 |
| B | Phase61a 문서에 ChoicesBlock 정렬 규약 1줄(근거 = 그리드 stretch) |
| C | **`globals.css:514-522` 주석 정정(D43′) · CLAUDE.md의 "`\tag{n}`은 수학 모드라 `.mopen/.mord/.mclose`" 문장도 같은 실측으로 정정** · CLAUDE.md: `ref-marker` 규약(전처리 순서·**marker span 요소 통째 보호**·평문 숫자 비인식·수식 안 `\ref` 비대상) · `사용 가이드 — 강조와 톤.md`에 hover 안내 |
| D·F | CLAUDE.md: **U-프레임 공유 규약에 예외 기록**(ProblemView는 카드 구조, EditorView만 U-프레임) + 자동접힘 제거 + `mathory-problem-width-em` 키 + **ProblemView 라인번호 정정(656·712·769)** · Phase62 문서 K1·T8″에 "M2에서 해소" 표기 |
| E | Phase62 문서 D8·D10 옆에 카드보기 maxWidth 해제 표기 |
| G | CLAUDE.md 블록 타입 절(코칭 = Tip 단일 표시, id 2종 유지 + `normalizeBlockType` 정규화) · `사용 가이드 — 강조와 톤.md` 코칭 절 개정 · `coachBlock.ts`에 G-10 번복 주석 |
| 공통 | `docs/roadmap.md`에 M2 절(M1 관례) · 확정본을 `docs/phasedocs/`로 승격 |

---

## 10. v3(착수판)에서 확정할 것

> **Q-A · Q-E · Q-F는 2026-08-28 실물 실측으로 해소**됐다 → §3-H(D39′~D43′). 남은 5건은 아래와 같다.

| # | 질문 |
|---|---|
| **Q-B** | (D) 제목행 접힘 애니메이션 방식(height vs transform)과 그때 sticky 카드 `top` 재계산 비용 |
| **Q-C** | (D) 자동접힘 임계값 `T1`/`T2`·시차 300ms·쿨다운의 실측치, 트랙패드 관성 스크롤에서의 진동 여부 |
| **Q-D** | (D) 풀이 라벨 열 sticky를 `top:0`으로 두었을 때 문제 카드와 겹치는지(Q10 유보분) |
| **Q-G** | (A) `lib/pdfPrint.tsx`의 alert가 `.print-root`를 body에 붙인 상태에서 뜬다 — 다이얼로그 노드가 인쇄 스냅샷에 섞이지 않는지 |
| **Q-H** | (G) FolderView 카드(높이 320 고정)에서 항상 펼침일 때 미리보기 잘림 지점이 자연스러운지 |

---

## 부록. 문서 계보

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web (2026-08-28) | 초안 — 사실표 A~G · 결정 D1~D33 · E-M2-1~4 · S1~S6 · Q1~Q10 |
| **v2** | **CLI (2026-08-28)** | **실측 교차검토 — 사실 오류 8건 정정 · 누락 5건 보강 · Q1~Q14 확정 · 결정 D1′~D38′ · 폭 예산 재계산 · 검수 T1~T31**<br>**v2.1: Q-A·Q-E·Q-F 실물 실측 해소 → C-11~C-14 · D-16~D-18 · D39′~D43′**<br>**v2.2: 2차 실측(ROUND A~D) → B-7 · C-15~C-16 · D-19 · F-6 · D44′~D48′. 계획 결함 2건 추가 정정** |
| v3 | web/CLI | 착수판 (예정 — §10 Q-A~Q-H 확정 후) |

*v2 = 착수 직전 판본. 신규 env·비밀 0 · Firestore 규칙 0 · 서버 0 · 배치 마이그레이션 0 · 블록 타입 union 0.*
