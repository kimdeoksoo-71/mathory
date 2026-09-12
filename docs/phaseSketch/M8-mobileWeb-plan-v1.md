# 개선묶음 M8 — 모바일 웹 디자인·기능 개선 구현 계획서 v1 (CLI 실측)

> 계보: 덕수 메모 `docs/phaseSketch/M8-mobileWeb-design-improving.md`(2026-09-12) → **v1 CLI**(이 문서 — 메모 4항을 Phase 64 코드와 대조하고 결정·함정·검수를 세웠다). 다음: 덕수 판정 Q1~Q4 → 착수(§7).
> 기준: `kimdeoksoo-71/mathory` **HEAD `5ff3828`**(origin 대비 ahead 1 — 문서 정리 커밋, 코드 무관). 폰 화면은 전부 Phase 64 산출물(`components/phone/*` · `PhoneShell` · `BottomSheet`)이고 **Phase 64는 검수 종결·Stage 5까지 끝났다**(§8-3 — 2026-09-12 해소).
> ⚠ 2026-09-12 갱신: Phase 64는 덕수 검수 종결("모두 정상") 후 **Stage 5 완료** — 실행판이 `docs/phasedocs/Phase64 휴대폰 열람 전용 화면(모바일 웹) v4 실행판.md`로 이관됐고 CLAUDE.md에 폰 셸 절이 생겼다. 아래 §8-3의 전제는 해소됐다(S5는 M8 §8-2만 올리면 된다).
> 메모의 "ProblemView"는 폰에서 **`PhoneReader`**다(앱 열람 `PhoneApp` + 공개 `/p`·`/shared` 세 경로가 같은 컴포넌트를 쓴다). 데스크톱 `ProblemView.tsx`는 이 묶음이 건드리지 않는다.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 취지 | Phase 64로 만든 폰 셸을 실사용한 덕수 판정 4건 — **로고 사양 뒤처짐 · 탭 행과 중복된 이동 버튼 2종 · 시트 속 상자(이중 크롬) · 가로 보기에서 크롬이 화면의 1/4~1/3** — 을 한 묶음으로 닫는다 |
| 범위 | 메모 4항 → 결정 D1~D9(§3). 수정 **6파일**(`PhoneShell` · `PhoneReader` · `PhoneApp` · `CommentPanel` · `PublicProblemView` · `Wordmark` 주석) + 신설 **2**(`lib/chromeAutoHide.ts` 순수 모듈 · 테스트) + `globals.css` 토큰 1(G1 채택 시) |
| 무접촉 | 서버 0 · Firestore 규칙 0 · 스키마 0 · raw_text 0 · 전처리 0 · 렌더 5사이트 0 · **데스크톱 픽셀 0**(`CommentPanel` 새 prop 기본값 = 현행, `Wordmark` 컴포넌트 무변경, `BottomSheet` 무변경, `PhoneMoreSheet` 무변경) |
| 핵심 실측 | ① 폰 상단 바 워드마크는 **옛 MiniShell 사양(19/600/`--mathory-red`/무그림자)** — 로고 정돈 커밋 `1c171ad`(2026-09-07)가 사이드바·홈만 고쳤고 폰은 이틀 뒤 S2에서 옛 사양을 "픽셀 재현"했다 ② 댓글·agent 시트의 상자는 `CommentPanel` 루트의 **드로어 크롬(inset 8 · radius 10 · border · 그림자 · X) + `maxWidth: 90vw`** 가 시트 안에서 그대로 살아 있는 것 — 393px 폰에서 패널 폭이 354px로 잘려 좌측에 ~31px 빈 띠가 생긴다 ③ `[풀이 보기]`·`[문제 보기]`를 지우면 **문제 보기 시트(`sheet==='question'`)가 도달 불가**가 되어 함께 삭제 대상 ④ 가로 보기 크롬 = 상단 바 52 + 탭 행 44 = **96px**, iPhone 15 가로(852×393)에서 뷰포트의 **24%**(Safari 자체 바가 보이는 동안은 ~35%) |
| 남은 판정 | **Q1** 가로 보기 크롬 복귀 조건(위로 스크롤 즉시 / 맨 위 도달 시) · **Q2** 탭별 읽던 위치 기억(버튼 삭제의 대가) · **Q3** MiniShell 워드마크도 새 사양으로 · **Q4** 가로 safe-area 인셋 |

---

## 1. 현행 — 실측 (HEAD `5ff3828`)

### A. 워드마크

| # | 사실 | 위치 |
|---|---|---|
| A1 | `Wordmark` 공용 컴포넌트: `size · weight(400\|600, 기본 400) · color · shadow(기본 false) · as`. 그림자 값 `0 1px 0 rgba(0,0,0,0.06)`, `letterSpacing -0.03em`, `--font-logo` | `components/ui/Wordmark.tsx` |
| A2 | 소비처 5곳 — **사이드바** 19/400/`#944728`/shadow · **홈 히어로** 48/400/`--mathory-red-dark`/shadow · **MiniShell** 19/600/`--mathory-red`/무그림자 · **PhoneShell 상단 바** 19/600/`--mathory-red`/무그림자(MiniShell 사양 복제, 주석 "4번째 사양을 만들지 않는다") · **폰 로그인 화면** 48/400/`--mathory-red-dark`/shadow(홈 히어로 사양) | `Sidebar.tsx:772` · `AppShell.tsx:1071` · `MiniShell.tsx:34` · `PhoneShell.tsx:66` · `PhoneApp.tsx:210` |
| A3 | 메모의 "최근 로고 개선"은 커밋 **`1c171ad`(2026-09-07)**: 600→400(얇게), `--mathory-red`(2.73:1)→`--mathory-red-dark`(3.28:1, 진하게), 그림자 추가(띄움). **19px 작은 글자만 한 단계 더 진한 `#944728`**("획이 얇아 배경이 비쳐 같은 색이 더 밝아 보이는 보정"). 두 곳(사이드바·홈)만 고쳤다 | `git show 1c171ad` |
| A4 | `#944728`은 **토큰이 아니라 리터럴**이다 — M6 색 정리(2026-09-09)가 남겨 둔 hex. M6 규약 "새 색은 토큰으로"의 새 소비처가 생기는 자리 | `Sidebar.tsx:772` |

→ 폰 상단 바(19px)는 사이드바와 **같은 크기·같은 배경 계열**이라 A3의 "작은 글자 보정"이 그대로 해당한다. 로그인 화면(48)은 이미 새 사양이다(변경 0).

### B. PhoneReader — 탭 행과 이동 버튼

| # | 사실 | 위치 |
|---|---|---|
| B1 | 탭 행: `tabs.length > 1`일 때 상단 바 아래 44px 2등분 버튼(활성 accent 2px 밑줄). 항상 보인다 | `PhoneReader.tsx:135-156` |
| B2 | 문제 탭 하단 `[{nextTab.label} 보기]` 48px 버튼 — `isQuestionActive && nextTab` | `:215-229` |
| B3 | 풀이 계열 상단 `[문제 보기]` 알약 32px(`--accent-primary` 배경, 흰 글자) → `setSheet('question')` → **문제 카드를 80% 바텀 시트에** 렌더(hold-to-peek의 폰 번역, D10) | `:197-211` · `:171-177` |
| B4 | 풀이 계열을 볼 때 문제 카드를 `visibility:hidden + position:absolute`로 **DOM에 남긴다**(M2 C 참조 말풍선 정의부 보존 — R4). 이것은 B3과 별개이며 **지우면 안 된다** | `:191-195` |
| B5 | 본문은 `PhoneShell`의 단일 스크롤러(`flex:1; overflowY:auto`)이고 탭을 바꿔도 같은 스크롤러가 남는다 → `scrollTop`이 새 콘텐츠 높이로 **클램프될 뿐 복원되지 않는다**. 풀이 1200px 지점에서 문제 탭(높이 500)으로 갔다 돌아오면 풀이는 ~500 지점에 선다 | `PhoneShell.tsx:86` |

→ B2·B3은 탭 행(B1)과 **같은 목적지로 가는 두 번째 경로**다. B3의 시트는 "읽던 자리를 잃지 않고 문제를 잠깐 본다"는 가치가 있었고, 지우면 그 가치는 B5의 손실로 돌아온다(→ D4·Q2).

### C. 댓글·agent 바텀 시트

| # | 사실 | 위치 |
|---|---|---|
| C1 | `BottomSheet`: 딤 + 시트(`--bg-drawer` · `--drawer-shadow` · radius 12 상단 · safe-area 하단) + **그립 행 32px(그립 36×4 + 우측 X 40×32 `IconClose 16`)** + 옵션 title + 내용 스크롤러. 닫기 3경로(딤·드래그 60px·X) | `BottomSheet.tsx:72-134` |
| C2 | 앱 경로: `PhoneApp.panelSlot`이 `<div position:relative; height:100%; paddingLeft:8>` 안에 `CommentPanel width="100%" selectionPopup={false}`. 주석 "함정 3 — CommentPanel 루트가 top/right/bottom:8을 스스로 갖는다 → 우·상하 8은 시트 여백으로 흡수, 좌측만 paddingLeft:8" | `PhoneApp.tsx:363-379` |
| C3 | `PhoneReader`는 댓글 슬롯을 또 `<div padding:'0 12px 12px'; height:100%>`로 감싼다(agent 슬롯은 안 감싼다) | `PhoneReader.tsx:160-164` vs `:167-169` |
| C4 | `CommentPanel` 루트 = **떠 있는 드로어 카드**: `position:absolute; top/right/bottom: DRAWER_INSET(8)` · `width` · **`maxWidth:'90vw'`** · `--bg-drawer` · `borderRadius DRAWER_RADIUS(10)` · `border DRAWER_BORDER(1px)` · `boxShadow --drawer-shadow` · `zIndex 50`. 1행(`minHeight DRAWER_ROW1_H 48` · 아이콘+제목 · 세션 비용 배지 · **X `×` 20px**) · 2행(댓글 = 오너 토글 바 41 / agent = `SessionTabBar` 41) | `CommentPanel.tsx:880-1000` |
| C5 | 합성 결과(393px 폰, 댓글): 시트 radius 12 상자 **안에** 드로어 radius 10 상자 — 좌 8+12=20 · 우 8+12=20 · 상하 8 여백, 그리고 `maxWidth 90vw`가 폭을 354px로 잘라 **좌측에 추가 빈 띠**(패널이 right:8 기준이라 왼쪽이 빈다). X는 그립 행(시트)과 1행(패널) **두 개** | 합성 |
| C6 | 공개 경로(`/p`)의 댓글 슬롯은 `PublicComments` — 루트에 상자가 **없고**(`width:100%`만) 안의 스레드가 각자 카드다. C3의 12px 패딩이 여기서는 카드 좌우 여백 역할을 한다 | `PublicProblemView.tsx:95-101` · `PublicComments.tsx:113-135` |

→ 메모의 "상자 속 상자"는 정확히 C4가 시트 안에서 드로어 크롬을 그대로 입고 있는 것이고, "공간 낭비"는 C2+C3+C4+`maxWidth` 4겹이다.

### D. 가로 보기

| # | 사실 | 위치 |
|---|---|---|
| D-1 | 폰 판별 `w ≤ 599 ∨ (h ≤ 599 ∧ coarse)` — iPhone 15 가로(852×393)는 둘째 항으로 폰. `matchMedia` change로 회전 즉시 재판별 | `lib/device.ts` · `hooks/useIsPhone.ts` |
| D-2 | `PhoneShell` = `100dvh` flex 열: 상단 바 **52**(고정) → 탭 행(리더만, **44**) → 본문(유일 스크롤러) → footer(리더에는 없음). 루트 `position:relative; overflow:hidden`, 시트는 루트 직계 `absolute inset:0` | `PhoneShell.tsx:36-103` |
| D-3 | 가로에서 크롬 96px / 뷰포트 393 = **24.4%**. Safari 가로는 스크롤 시 자체 바를 숨기므로 `dvh`가 늘어 비율이 24%까지 내려가고, 바가 보이는 동안(≈340px)은 ~28%. 메모의 "절반 가까이"는 Safari 바 + 우리 크롬을 합쳐 본 체감이다 | 계산 |
| D-4 | `orientation`·`safe-area-inset-left/right`를 읽는 곳 **0**. `viewportFit:'cover'`(D5)는 하단 footer 때문이었고, 가로에서는 노치(Dynamic Island) 쪽 인셋을 아무도 펴지 않는다 → 가로에서 본문·상단 바가 노치 아래로 들어갈 수 있다(실기기 판정 필요, Q4) | `app/layout.tsx:10` · grep 0건 |
| D-5 | CLAUDE.md 규약 "ProblemView는 스크롤로 레이아웃이 변하지 않는다(`scrollTop` 읽는 곳 0)"는 **데스크톱 `ProblemView.tsx`** 조항이다. 폰 셸에는 해당 조항이 없고, 메모는 스크롤 연동 크롬 숨김을 **명시적으로 요구**한다. 다만 그 조항의 근거("카드가 나타나고 사라지는 순간 화면이 튄다")는 여기서도 실재하는 위험이라 D5의 4중 가드가 그 대답이다 | CLAUDE.md |

---

## 2. 요청 검토 — 타당성·정정

| # | 메모 | 판정 | 비고 |
|---|---|---|---|
| 1 | 로고 최근 개선 반영 | **타당·그대로** | 대상은 `PhoneShell` 상단 바 한 줄. 로그인 화면은 이미 반영돼 있다. 사양은 "4번째"가 아니라 **사이드바 사양 재사용**(같은 19px·같은 보정 근거) |
| 2 | `[풀이 보기]`·`[문제 보기]` 삭제 | **타당** | 도달 불가가 되는 문제 보기 시트도 함께 삭제. **대가 = 읽던 위치 손실(B5)** → D4로 보상 제안(Q2). 정의부 보존 div(B4)는 유지 |
| 3 | 시트 속 상자·테두리·X 제거, 1·2행 유지 | **타당** | 원인은 4겹(C5). 처방은 `CommentPanel`에 크롬 모드 prop 하나 — 데스크톱 기본값 무변경. 시트의 그립 행 X는 **남긴다**(시트 공통 닫기 경로 · 더 보기 시트와 일관), 없어지는 X는 패널 1행의 것. 공개 경로(`PublicComments`)는 상자가 없으므로 **무변경**(패딩만 제자리로 옮긴다) |
| 4 | 가로 보기 크롬 자동 숨김 | **타당·조건부** | "정방향 스크롤 → 사라짐"은 확정. **"역방향 스크롤을 하면 마지막에 다시 나타남"은 두 독법**이 있다 — (a) 위로 조금만 밀어도 즉시(iOS Safari 방식) (b) 맨 위에 닿았을 때만. (a)를 권장(긴 풀이 중간에서 탭을 바꾸려면 (b)는 맨 위까지 올라가야 한다). **세로 보기는 무접촉**(메모 범위대로) |

---

## 3. 결정 (D1~D9)

### 로고

| # | 결정 | 근거 |
|---|---|---|
| **D1** | `PhoneShell.tsx:66` → **사이드바 사양** `<Wordmark as="div" size={19} color={…} shadow />`(weight 기본 400). `Wordmark.tsx` 헤더 주석의 "폰은 MiniShell·HomeView 사양"을 "폰 상단 바 = Sidebar 사양 / 폰 로그인 = HomeView 사양"으로 정정. 컴포넌트 코드 무변경 | A2·A3 |
| **G1(권장)** | `#944728`을 토큰 **`--wordmark-small`**(`globals.css :root`, 주석에 `1c171ad` 근거)로 올리고 `Sidebar.tsx:772`·`PhoneShell`이 함께 읽는다. 값 동일 → 사이드바 픽셀 0. M6 "hex 금지" 규약의 새 소비처를 만들지 않기 위함 | A4 |
| **Q3** | `MiniShell.tsx:34`(데스크톱 공개 셸)만 옛 사양으로 남는다. 메모 범위 밖이라 덕수 판정 — 권장은 **같이 옮김**(D1과 같은 한 줄, 그러면 19px 워드마크 사양이 하나가 된다) | A2 |

### 리더 이동 버튼

| # | 결정 | 근거 |
|---|---|---|
| **D2** | `PhoneReader`에서 삭제: `[다음 탭 보기]` 블록(:215-229) · `[문제 보기]` 알약(:197-211) · 문제 보기 `BottomSheet`(:171-177) · `sheet` union의 `'question'` · `nextTab`·`activeIdx`. **`questionTab`·`isQuestionActive`·정의부 보존 div(:191-195)는 유지** | B2·B3·B4 |
| **D3** | 탭 행이 유일한 이동 경로가 된다. `tabs.length === 1`(풀이 없는 문항)은 탭 행도 없고 버튼도 없던 화면 → 변화 0 | B1 |
| **D4 (Q2)** | **탭별 읽던 위치 기억**: `PhoneReader`가 `posRef: Record<tabId, number>`에 떠나는 탭의 `scrollTop`을 저장하고, `useLayoutEffect([activeTabId])`에서 새 탭의 저장값(없으면 0)으로 복원. 스크롤러는 `PhoneShell`이 **imperative handle `{ getScrollTop, scrollTo }`** 로 노출(D5의 무시 창과 한 몸 — 아래). 문제 보기 시트를 지운 대가를 5~10줄로 되돌린다. 권장 **포함** | B5 |

### 시트 크롬

| # | 결정 | 근거 |
|---|---|---|
| **D6** | `CommentPanel`에 **`chrome?: 'drawer' \| 'sheet'`**(기본 `'drawer'` = 현행 바이트 동일). `'sheet'`: 루트 `position:relative · width:100% · height:100% · maxWidth 없음 · borderRadius 0 · border none · boxShadow none`(배경·zIndex·overflow·flex 열은 유지) · **1행의 X 버튼 미렌더**(`onClose`는 prop으로 남는다 — 시트의 X·딤·드래그가 닫는다) · 1행·2행·행 구분선·세션 비용 배지·`selectionPopup` 처리는 그대로 | C4·C5 |
| **D7** | 호출부 여백 제거: `PhoneApp.panelSlot`의 `paddingLeft:8` 래퍼 → `height:100%`만 남기고 `chrome="sheet"` 전달("함정 3" 주석 폐기). `PhoneReader:161`의 `padding:'0 12px 12px'` 래퍼 제거 → 슬롯을 agent와 같이 **맨몸으로** 렌더. 공개 경로는 `PublicProblemView:95`에서 `PublicComments`를 **자기가** `<div style={{padding:'0 12px 12px'}}>`로 감싼다 → 공개 댓글 시트 픽셀 0 | C2·C3·C6 |
| **D8** | `BottomSheet` **무변경**. 그립 행(32) + X는 시트 공통 닫기 경로다. "1행 유지" = 패널의 1행(아이콘·제목·비용 배지 48)이고, 그 위에 시트 그립 행이 하나 더 있는 구조는 현행 그대로(메모 "행 구분 가로선 및 기타 디자인 요소는 그대로") | C1 |

### 가로 보기 크롬 자동 숨김

| # | 결정 | 근거 |
|---|---|---|
| **D5** | **`PhoneShell`에 `chromeAutoHide?: boolean`**(기본 false — 리스트·Bazaar·로그인 화면 무접촉). `PhoneReader`만 true. 동작: (1) `matchMedia('(orientation: landscape)')`가 참일 때만 활성, 세로로 돌아오면 즉시 표시 상태로 리셋 (2) 상단 바+탭 행을 **한 래퍼**(`flexShrink:0`)로 묶고 `marginTop: hidden ? -chromeH : 0` + `transition: margin-top .2s ease`(높이는 `ResizeObserver`로 실측 — 탭 행 유무·제목 줄 수와 무관) (3) 본문 스크롤러 `onScroll` → 순수 리듀서 `nextChromeState`(§4-1)가 hide/show를 결정 (4) **4중 가드** — ① 러버밴드 무시(`y < 0 ∨ y > scrollHeight − clientHeight`) ② 토글 직후 **300ms 무시 창**(크롬이 접히면 `clientHeight`가 96 늘어 브라우저가 `scrollTop`을 클램프하며 역방향 scroll 이벤트를 낸다 — 이것을 '위로 스크롤'로 읽으면 **접힘↔펼침이 진동**한다) ③ **히스테리시스 24px**(같은 방향 누적이 문턱을 넘을 때만 토글, 방향이 바뀌면 누적 리셋) ④ **콘텐츠가 `clientHeight + chromeH + 40`보다 짧으면 절대 숨기지 않는다**(짧은 문항은 숨겨도 얻는 게 없고 ②의 클램프가 커진다). `y ≤ 0`이면 무조건 표시 | D-2·D-3·D-5 |
| **Q1** | 복귀 조건 — 권장 **(a) 위로 24px 이상 스크롤 시 즉시**. (b) "맨 위 도달 시만"을 고르면 리듀서의 show 분기 하나가 `y ≤ 0`으로 좁아질 뿐(코드 차이 2줄) — 판정 뒤 어느 쪽이든 같은 구조 | §2-4 |
| **D4′** | D4의 `scrollTo(y)`는 무시 창(가드 ②)을 먼저 세우고 `scrollTop`을 쓴다 — 탭 전환 복원이 "아래로 1100px 스크롤"로 읽혀 **탭을 누른 순간 크롬이 접히는** 오동작 차단. `getScrollTop`은 러버밴드 값을 그대로 돌려주지 않고 0으로 클램프 | D5-② |
| **D9 (Q4)** | 가로 safe-area: `PhoneShell` 루트에 `paddingLeft/Right: env(safe-area-inset-left/right)`. 세로에서는 두 값이 0이라 **세로 픽셀 0**, 가로에서만 노치 쪽 인셋이 열린다. 기기 모드에서는 항상 0이라(Phase 64 T-6) **실기기로만 판정** — 메모 범위 밖이지만 "가로 보기 화면 전체를 쓴다"는 취지의 전제라 함께 넣기를 권장 | D-4 |

**알고 두는 손실**: ① 크롬이 접히는 0.2s 동안 본문이 96px 위로 따라 올라간다(의도된 이동 — Safari 자체 바와 같은 문법) ② 접힌 상태에서 탭을 바꾸려면 위로 24px 밀어야 한다 ③ D4를 빼면(Q2=아니오) 탭을 오갈 때 읽던 위치가 클램프된다 ④ agent·댓글 시트 폭이 넓어진 만큼 `CommentPanel` 안 코드 블록·표의 가로 스크롤 임계가 달라진다(내용 폭이 늘어나는 쪽이라 무해).

---

## 4. 아키텍처

### 4-1. 신설

| 파일 | 내용 |
|---|---|
| `lib/chromeAutoHide.ts` | **import 0 순수 리듀서**. `type ChromeState = { hidden: boolean; lastY: number; acc: number; ignoreUntil: number }` · `nextChromeState(s, { y, scrollHeight, clientHeight, chromeH, now, mode: 'reveal-on-up' \| 'reveal-at-top' })` → `{ state, action: 'hide' \| 'show' \| null }`. 상수 `HYSTERESIS_PX 24` · `IGNORE_MS 300` · `MIN_EXTRA_PX 40`. `PhoneShell`은 ref에 상태를 들고 `action`이 있을 때만 `setHidden` — 매 스크롤 리렌더 0(61c "리렌더 자체가 버그" 규약) |
| `tests/chromeAutoHide.test.mjs` + `package.json "test:chrome"` | 8건: 아래로 24 미만 → 유지 / 24 이상 → hide / 러버밴드 음수·초과 → 무시 / 무시 창 안 역방향 → 유지 / 방향 반전 시 누적 리셋 / `y ≤ 0` → show 강제 / 콘텐츠 짧음 → hide 금지 / `reveal-at-top` 모드에서 위로 스크롤만으로는 show 안 됨 |

### 4-2. 기존 파일 수정

| 파일 | 변경 | 데스크톱 영향 |
|---|---|---|
| `components/layout/PhoneShell.tsx` | D1 워드마크 한 줄 · D5 `chromeAutoHide` prop + 크롬 래퍼 + `orientation` 구독 + `ResizeObserver` + `onScroll` 배선 · D4 `forwardRef` handle · D9 safe-area 좌우 | 폰 전용 파일 |
| `components/phone/PhoneReader.tsx` | D2 삭제 5곳 · D4 `posRef` + `useLayoutEffect` · D7 댓글 슬롯 래퍼 패딩 제거 · `chromeAutoHide` 전달 | 폰 전용 |
| `components/phone/PhoneApp.tsx` | D7 `panelSlot` 래퍼 단순화 + `chrome="sheet"` | 폰 전용 |
| `components/comment/CommentPanel.tsx` | D6 `chrome` prop(기본 `'drawer'`) — 루트 style 분기 + 1행 X 조건부 | **0**(기본값 경로 바이트 동일 — `providerParams` 스냅샷과 같은 성격이라 착수 시 `git diff`로 drawer 갈래 무변경 확인) |
| `components/share/PublicProblemView.tsx` | D7 `PublicComments` 패딩 래퍼(폰 갈래 안) | 0 |
| `components/ui/Wordmark.tsx` | 주석만(D1) | 0 |
| `app/globals.css` | G1 토큰 1줄(채택 시) + `Sidebar.tsx:772` 참조 교체 | 값 동일 → 0 |

무변경: `BottomSheet` · `PhoneMoreSheet` · `PhoneList/Bazaar/ItemMenu` · `SnapshotView`(댓글 슬롯 없음 — D2만 `PhoneReader` 경유로 적용) · `PublicComments` · `lib/device` · `useIsPhone` · `ResponsiveShell` · 데스크톱 전부.

### 4-3. 함정 (구현 중 상시 참조)

1. **진동**: 크롬 접힘 → `clientHeight` +96 → 브라우저 클램프 → 역방향 scroll 이벤트. 가드 ②(무시 창)가 없으면 접자마자 펼친다. 무시 창은 transition 200ms보다 길어야 한다(300). **합성 휠·기기 모드에서는 클램프 이벤트가 안 날 수 있다** — 실기기 iOS에서 문항 맨 아래 근처를 왕복해 판정할 것(Phase 65 거터 튕김의 교훈: 스크롤 값이 안 변하는 시각 효과는 계측으로 못 본다 → 영상).
2. **러버밴드**: iOS는 `scrollTop`이 음수·초과로 간다. 가드 ①이 없으면 맨 위에서 당길 때 hide, 맨 아래에서 당길 때 show가 튄다.
3. **`marginTop` 음수 vs `transform`**: transform으로 크롬을 올리면 본문이 자리를 채우지 않는다(구멍) — 흐름에서 실제로 빼야 하므로 margin. 래퍼 밖 루트가 `overflow:hidden`이라 위로 나간 부분은 잘린다.
4. **D4 복원이 D5를 오발**: `scrollTo` 없이 `el.scrollTop = y`를 직접 쓰면 탭 탭 순간 크롬이 접힌다(D4′). 두 기능은 같은 ref·같은 무시 창을 써야 한다.
5. **`CommentPanel` sheet 모드의 높이**: 루트가 `position:relative`가 되면 `top/bottom` 인셋이 높이를 주지 않으므로 **`height:100%`를 명시**해야 내부 스크롤러(메시지 목록 `flex:1; minHeight:0`)가 산다. 안 주면 패널이 내용 높이로 자라 BottomSheet 바깥 스크롤러가 대신 스크롤한다(입력창이 화면 밖으로).
6. **`maxWidth: '90vw'`를 drawer 갈래에서 지우지 말 것** — 데스크톱 리사이즈 상한이다. sheet 갈래에서만 뺀다.
7. **정의부 보존 div(B4)를 "문제 보기 시트와 한 묶음"으로 착각해 지우지 말 것** — 지우면 풀이의 `(가)`·`①` 참조 말풍선이 한꺼번에 무음(M2 C).
8. **`orientation` 미디어 쿼리는 판별용 `@media` 금지 규약(Phase 64 함정 2)의 예외가 아니다** — CSS에 쓰지 않고 훅(JS `matchMedia`)에서만 읽는다. `[data-phone]` 스코프는 그대로.
9. **가로 safe-area(D9)**: `paddingLeft/Right`를 루트에 주면 `BottomSheet`(absolute inset:0)는 패딩 안쪽이 아니라 **루트 박스 전체**에 붙는다 — 시트 내용 좌우가 노치 아래로 들어갈 수 있으니 시트 내용 래퍼에도 같은 인셋을 줄지 실기기에서 판정(가로에서 시트를 여는 빈도가 낮아 1차는 루트만).
10. **`ResizeObserver`로 크롬 높이 실측**: 96을 상수로 박으면 제목이 두 줄이 되거나 탭 행이 없는 문항(D3)에서 어긋난다.

---

## 5. 화면 사양 (변경 후)

| 화면 | 구성 |
|---|---|
| 폰 상단 바(전 화면) | 워드마크 19/400/`--wordmark-small`(#944728)/그림자 — 사이드바와 동일 |
| 열람·문제(세로) | 상단 바 · 탭 행 · 문제 카드 · 메타 · 슬로건. **`[풀이 보기]` 없음** |
| 열람·풀이(세로) | 상단 바 · 탭 행 · 풀이 카드(직각). **`[문제 보기]` 알약 없음**. 탭을 오가면 각자 읽던 위치(D4) |
| 열람(가로) | 처음엔 세로와 같음 → 아래로 24px 밀면 상단 바+탭 행이 0.2s에 위로 접히고 본문이 전폭·전고 → 위로 24px 밀면 복귀(Q1=a) · 맨 위에서는 항상 표시 · 짧은 문항은 접히지 않음 |
| 댓글·agent 시트 | 딤 · 시트(radius 12 상단 · 그립 행 32 + X) · **패널 1행(아이콘·제목·비용 배지, X 없음) · 2행(토글 / 세션 바) · 내용 — 시트 좌우 0, 테두리·그림자·둥근 모서리 없음** |
| 공개 `/p` 댓글 시트 | 현행 그대로(카드형 스레드 · 좌우 12) |

---

## 6. 검수 (A = Chrome 기기 모드 iPhone 15 393×852 · R = 실기기 iPhone Safari + Galaxy Chrome)

| # | 항목 | 방법 |
|---|---|---|
| T1 | 워드마크 — 폰 상단 바 = 사이드바(400·#944728·그림자) | A: 두 화면 DevTools computed `font-weight`·`color`·`text-shadow` 대조. **데스크톱 사이드바·홈·MiniShell(Q3 미채택 시) 픽셀 동일** |
| T2 | 문제 탭 하단 버튼 없음 · 풀이 탭 상단 알약 없음 · `'question'` 시트 코드 잔재 0(`grep -n "'question'" PhoneReader.tsx` = 탭 id 용례만) | A + grep |
| T3 | 정의부 보존 — 풀이 탭에서 `(가)`·`①` 참조 말풍선이 뜬다 | R(탭) / A(마우스) |
| T4 | D4 — 풀이 1000px 지점 → 문제 → 풀이: 같은 지점. 문제→풀이 첫 진입은 0 | A |
| T5 | 시트 — 패널이 시트 좌우 0에 붙고 테두리·그림자·radius 없음 · X는 그립 행 하나 · 1행·2행·구분선 유지 · **입력창(댓글)·세션 바(agent)가 화면 안에 있고 메시지 목록만 스크롤** | A(댓글·agent 둘 다, 오너·멤버) |
| T6 | 데스크톱 `CommentPanel` 무변경 — 편집창·열람뷰 드로어 3종 픽셀 동일(리사이즈 상한 90vw 포함) | 데스크톱 |
| T7 | 공개 `/p` 댓글 시트 픽셀 동일(패딩 12 유지) | A |
| T8 | 가로 — 아래 24px에 접힘 · 위 24px에 복귀(Q1) · 맨 위 항상 표시 · 짧은 문항 미접힘 · 회전으로 세로 복귀 시 즉시 표시 · **맨 아래 근처 왕복에서 진동 0**(영상) · 접힌 채 시트 열기/닫기 정상 · 접힌 채 글자 크기 변경(⋯ 시트) 뒤 크롬 높이 재실측 | A(회전 버튼) + **R 필수**(러버밴드·클램프·Safari 자체 바 연동) |
| T9 | 세로 — 리더·리스트·Bazaar·로그인 화면 현행 동일(auto-hide 비활성) | A |
| T10 | D9 — 가로에서 본문·상단 바가 노치를 피한다 · 세로 픽셀 0 | **R만**(기기 모드 인셋 0) |
| T11 | `npm run test:chrome` 8건 · `npx tsc --noEmit` · 로직 검증 387 → **395** 무회귀 | CLI |

---

## 7. 단계

| S | 내용 | 검수 |
|---|---|---|
| S1 | D1 + G1(토큰) + Q3 결과 | T1 |
| S2 | D2·D3·D4·D4′ — `PhoneShell` handle · `PhoneReader` 삭제·복원 | T2·T3·T4 |
| S3 | D6·D7·D8 — `CommentPanel chrome` · `PhoneApp`·`PhoneReader`·`PublicProblemView` 래퍼 | T5·T6·T7 |
| S4 | `lib/chromeAutoHide.ts` + 테스트 + `PhoneShell` D5 배선 + D9 | T8·T9·T10·T11 |
| S5 | 문서 — CLAUDE.md(§8-2) · `docs/phasedocs/` 실행판 · roadmap · **Phase 64 Stage 5 미완분 동반 처리**(§8-3) | 배포 후 ⇧⌘R + 폰 캐시 삭제 |

각 S는 배포 가능 단위. S1~S3은 삭제·한 줄 교체라 반나절, S4가 실기기 왕복이 필요한 본체.

---

## 8. 판정 요청 · 후속 · 문서

### 8-1. 덕수 판정 (착수 전)

| Q | 질문 | 권장 |
|---|---|---|
| **Q1** | 가로 크롬 복귀 — (a) 위로 24px 즉시 / (b) 맨 위 도달 시만 | **(a)** — 긴 풀이 중간에서 탭 전환 가능. (b)면 리듀서 모드 값만 바뀐다 |
| **Q2** | 탭별 읽던 위치 기억(D4) 포함 여부 | **포함** — 버튼 삭제의 유일한 대가를 되돌린다. 비용 ~10줄 |
| **Q3** | MiniShell(데스크톱 공개 셸) 워드마크도 새 사양으로 | **포함** — 옛 사양이 한 곳만 남는 상태를 없앤다. 메모 범위 밖이라 판정 |
| **Q4** | 가로 safe-area(D9) 포함 여부 | **포함** — 실기기에서 노치 침범이 확인되면 필수, 아니면 무해(세로 0) |

### 8-2. CLAUDE.md 개정 항목 (S5)

1. 「핵심 패턴」에 **"폰 셸의 스크롤 연동 크롬 숨김은 `lib/chromeAutoHide.ts` 리듀서가 소유한다(가로 보기 전용 · 4중 가드: 러버밴드 무시·토글 후 300ms 무시 창·히스테리시스 24·짧은 콘텐츠 금지). 데스크톱 ProblemView의 '스크롤로 레이아웃 불변' 조항은 그대로이며 이 기능은 그 예외가 아니라 별개 컴포넌트다. 프로그램적 스크롤은 반드시 `PhoneShell` handle의 `scrollTo`(무시 창 동반)로"**.
2. 우측 드로어 규약에 **"`CommentPanel chrome='sheet'`는 크롬 없는 갈래(폰 시트 전용). drawer 갈래의 `maxWidth 90vw`는 리사이즈 상한이라 유지"**.
3. 워드마크 절: "사양은 3벌(홈 48 · 작은 19 = 사이드바·폰 상단 바·(Q3)MiniShell · 폰 로그인 = 홈) · 작은 글자 색은 `--wordmark-small`".
4. 「블록 타입」 아래 폰 절: "`PhoneReader`의 이동 경로는 탭 행 하나 — `[풀이 보기]`·`[문제 보기]` 시트를 되살리지 말 것(M8). 정의부 보존 div는 그와 무관하게 필수(M2 C)".

### 8-3. 전제 — Phase 64 Stage 5 미완

`grep "Phase 64" docs/roadmap.md` = 0건, `docs/phasedocs/`에 64 문서 없음, CLAUDE.md에 폰 셸 절 없음. 착수판 v4 §11의 9개 항목(판별식·`[data-phone]` 규약·`next/dynamic ssr:false`·`FONT_SIZE_*` 소유 등)이 아직 코드에만 있다. M8 S5에서 **Phase 64 §11 + M8 §8-2를 한 번에** 올리는 것을 권장(둘 다 같은 절에 산다). 착수판 v4는 `phasedocs/`로 옮기고 §12 구현 기록을 실행판으로 삼는다.

### 8-4. 후속(이번 묶음 밖)

세로 보기 크롬 숨김(메모가 가로로 한정) · 시트 내용의 가로 safe-area(함정 9) · Phase 64 §10 잔여(PWA · 큰/작은 폰 튜닝 · 폰 알림).
