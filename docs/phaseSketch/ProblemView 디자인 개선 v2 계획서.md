# ProblemView 디자인 개선 — v2 계획서 (교차검토판)

> 계보: 스케치 메모 「ProblemView 디자인 개선」(2026-08-29) → 방향 수정(항목 1, 덕수)
>       → v1(CLI, 2026-08-29) → **v2(교차검토, 2026-08-29)** → v3(재검증·착수판) 예정
> 진실 원천: mathory **origin/main `17f1128`**(v1과 같은 해시 — 재실측 결과 v1 이후 새 커밋 없음).
> 본문의 파일:라인은 이 해시에서 다시 읽었다.
> 전제: 개선묶음 M2 배포 완료(`51cb12f`). M2 규약은 `docs/phasedocs/개선묶음 M2 기능 개편 v4 실행판.md`.
>
> **설계 기준(덕수)**: *"Mathory는 안정감 있고 빈틈없이 보수적으로 작동하는 수학 글쓰기 도구여야 한다."*
> v2는 이 문장을 v1보다 한 번 더 밀어붙였다 — **화면이 튀는 순간을 0으로** 만드는 것이
> 이번 작업의 합격선이고, 그 기준으로 v1의 핵심 배선 하나(P2 임계값)를 뒤집었다.

---

## 0. v1 → v2 변경 요약 (여기만 읽어도 된다)

| # | 구분 | v1 | v2 | 근거 |
|---|---|---|---|---|
| **R-1** | **오류** | P2: `scrollTop > T1(80)`에서 카드를 숨긴다 | **카드가 화면 위로 완전히 빠져나간 뒤**에 숨긴다 + 같은 프레임에 scrollTop 보정 | 80px에서 숨기면 아직 화면에 보이는 카드(≈300px)가 사라지며 **본문이 그만큼 튄다**. E-P4(흐름)를 택한 순간 이 방식만 무진동이다 (§2 P2·P3) |
| **R-2** | **오류** | P6·V1: `lastQHRef` 델타 보정을 **삭제**하고 "보정 없이 자리가 유지되는가"를 묻는다 | 보정은 **남긴다**(형태만 바뀐다). 답: 유지되지 않는다 — 카드 높이만큼 위로 당겨진다 | 흐름 카드는 sticky 카드와 똑같이 "흐름상의 자리가 최상단"이라 높이가 사라지면 아래가 전부 올라온다(`ProblemView.tsx:427-431` 주석의 원리는 그대로 유효). 다만 R-1로 **카드가 화면 밖에 있을 때만** 사라지므로 보정이 **눈에 보이지 않는다**(§2 P3) |
| **R-3** | **오류** | R4: 공개 뷰어 `ContentCard`도 "같은 구조 — 함께 볼 것" | 공개 뷰어는 **B-1 결함이 없다** — `fontSize: 15` 고정(`PublicViewerShell.tsx:140`)이라 px/em 혼합이 성립하지 않는다. R3(em화)의 대상이 아니다 | 실측 (§1 B-3) |
| **R-4** | **오류** | E-2: "EditorView Row1의 **'뒤로'** 알약" | 라벨은 **'보기'**다(`EditorView.tsx:3213-3229`, `IconChevronLeft` + "보기", title "보기 화면으로"). 새 알약 '문제 보기'와 **낱말이 겹친다** → §6 V5′에서 답할 것 | 실측 |
| **R-5** | **누락** | R2: `--case-rail-x` 변경을 ProblemView 일로 적는다 | 이 토큰은 **`:root`**(`globals.css:204`)라 **EditorView 미리보기·공개 뷰어에도 동시에** 적용된다. 범위를 명시하고 선택지를 둔다 (§2 R2) | 실측 |
| **R-6** | **불일치** | R2 `-1.3em` = "카드 좌단과 본문 좌단의 중간" + R3 `CARD_PAD_L = 2.8em` | 2.8em의 중간은 **-1.4em**이다. -1.3em은 40px@15(2.67em)에서 나온 값 → 짝을 맞춘다: **`2.6em` / `-1.3em`**(정확히 중간) | 산술 (§2 R2·R3) |
| **R-7** | **누락** | S2: "펼침(상시) = 1단계" | **경우(case)에는 상시 톤을 줄 수 없다** — 펼친 구역은 `React.Fragment`로 형제로 흘러(`OutlineSections.tsx:133-136`) 감쌀 노드가 없고, 감싸면 rail 인접이 끊긴다(D15′). 상시 톤은 **섹션(제목 단위)에만** | 실측 (§2 S2) |
| **R-8** | **누락** | P절이 "카드 클릭 = 접기"(M2 보완 2)와 라벨 클릭의 거취를 안 정한다 | **카드 클릭 토글·hover 톤 제거**, 라벨 클릭 = 알약과 같은 동작. 조작 하나에 상태 하나 (§2 P8) | 설계 기준 |
| **R-9** | **누락** | Q절이 선·페이드의 **현재 위치**를 "sticky 래퍼(아이보리)"로만 적는다 | 그 래퍼는 **문제 행 래퍼**다(`ProblemView.tsx:996-1025`). P6으로 그 래퍼가 sticky를 잃으면 선·페이드가 **함께 흐름으로 떨어진다** → 별도 sticky 요소가 필요하다 (§2 Q2) | 실측 |
| **R-10** | **누락** | `handleJumpToBlock`의 sticky 오프셋만 지운다 | 지적 인용이 **문제 탭**을 가리키는데 카드가 숨겨져 있으면 **먼저 카드를 되살려야** 한다(`openTabs`와 같은 선처리) (§2 P9) | 실측 `ProblemView.tsx:366-417` |
| **R-11** | **보완** | P1 "항상 `minHeight 98`" | **`height: 98`**(현행과 같이 고정 + `overflow:hidden`). `minHeight`면 줄바꿈 시 커져 EditorView와의 **y=98 가로선 정렬**(CLAUDE.md 드로어 규약)이 깨진다 | 규약 |
| **R-12** | **정정** | A-1 "sticky 배선 12곳" | 실측 **16곳**(`HEADER_H` 3 · `questionRowRef` 4 · `qStickyH`/`setQStickyH` 4 · `lastQHRef` 3 · `--m2-q-sticky-h` 2) + TabBody 1. 결론은 같다 — 덜어내는 작업 | 실측 |

---

## 1. 확정 사실 (`17f1128` 재실측 — v1 표를 승계하고 보강)

v1 A-1~E-2는 위 R-3·R-4·R-12를 제외하고 **전부 유효**하다. 아래는 추가·정정분.

| # | 사실 |
|---|---|
| **A-4** | 자동접힘의 상태 배선은 `headerSlim` 23곳 외에 `questionCollapsed` 7 · `M2_COLLAPSE` 7 · `manualQuestionRef` 3 · `collapseTimerRef`/`lastFlipRef` · TabBody의 `collapsedPreview`/`compactTop` prop + 내부 absolute/visibility 분기(`TabBody.tsx:295-297, 308-317`)가 있다. **전부 이번에 사라진다** |
| **A-5** | 참조 말풍선은 정의부를 `root.querySelectorAll` + `textContent` 비교로 찾고 **`host.cloneNode(true)`를 `document.body`에 붙인다**(`RefTooltip.tsx:104-134`). `visibility:hidden`은 조상에서 걸어도 복제본에 **따라가지 않는다**(복제본의 조상은 body). `--content-font-size`는 `getComputedStyle`로 읽으므로 hidden 노드에서도 산다 → **숨김을 문제 행 래퍼(ProblemView)로 끌어올려도 A-2 처방은 그대로 성립**한다 |
| **A-6** | 문제 탭은 `openTabs`가 false면 카드가 **언마운트**된다(`TabBody.tsx:270 {isOpen && …}`). M2가 문제 라벨 클릭을 접힘 토글로 우회한 이유가 이것이다(`ProblemView.tsx:310-319`). 새 설계에서도 문제 탭의 `openTabs`는 **항상 true**여야 한다 |
| **B-3** | 공개 뷰어 `ContentCard`는 `fontSize: 15` **고정**(`PublicViewerShell.tsx:140`) — 글꼴 조절이 없어 40px는 항상 2.67em이다. B-1(px/em 혼합)은 **앱 ProblemView에만** 있는 결함이다 |
| **B-4** | `--case-rail-x`·`--case-chevron-x`는 `:root` 토큰(`globals.css:204-205`)이고 소비처는 `.case-block::before/::after`(rail·dot)·`.case-head .outline-chevron`. 렌더 사이트 5곳 중 인쇄(`-1.2em` 리터럴)·FolderView(`content:none`)를 뺀 **3곳(ProblemView·EditorView 미리보기·공개 뷰어)이 같은 값을 본다**. EditorView 미리보기는 거터용 좌측 패딩 **3.5em**(`EditorView.tsx:3718-3728`)이라 rail을 안쪽으로 옮겨도(덜 음수) 잘림 위험은 없다 |
| **B-5** | 경우 줄 chevron 상자는 `left: calc(-0.7em − 0.5em) = −1.2em`에서 시작한다. rail을 `-1.3em`으로 옮기면 dot 우단이 `-1.04em` → **chevron과 0.16em 겹친다**. S1(경우 chevron 제거)이 R2의 **전제**다 — 순서를 바꿀 수 없다 |
| **B-6** | 접힘/펼침 상태는 chevron 없이도 **dot이 이미 나른다**(펼침 = 채움 / 접힘 = 테두리, `globals.css:812-831` D19). D-3의 모바일 우려는 dot이 흡수한다 |
| **C-3** | 현재 선·페이드는 **문제 행 sticky 래퍼**(`ProblemView.tsx:996-1025`)의 하단에 절대배치돼 있다. 좌표 `lineLeft = 7em + LABEL_GAP − 10`, 폭 `cardW + 20`(카드보다 좌우 10px 넓다). 페이드는 `top: calc(100% + 1px)` — 선 **아래**에서 시작한다(선 위에 얹히면 선이 흐려진다는 주석) |
| **C-4** | `TabBody.tsx:213` 주석("래퍼도 8 → 4로")은 낡았다 — 실제 래퍼 `paddingBottom`은 **8**이다(`ProblemView.tsx:1001`, "4 → 8"). 문제↔풀이 간격은 `1em + 8px`(fs15에서 23px). 이 총량은 **보존**한다 |
| **D-4** | 요약 보기의 섹션 래퍼는 `<div key={sec.key}>`(`OutlineSections.tsx:143`) 하나뿐이고 클래스가 없다. 섹션 단위 상시 톤은 여기에 클래스를 붙이면 된다. 경우 항목은 `CaseItem` + trailing 블록이 **Fragment 형제**(`:133-136`)라 감쌀 수 없다 |
| **D-5** | `.section-head`·`.case-head`는 `position`이 없고(`globals.css:915-942`), rail·dot은 `.case-block`(relative)의 `::before/::after`(absolute)다. **positioned 요소는 비positioned 블록 배경보다 뒤에 그려진다** → 톤 배경을 카드 전폭으로 넓혀도 rail·dot은 그 **위**에 남는다. v1 V4의 답이다 |
| **E-3** | 흰 글자 알약 후보 재계산(`((c+0.055)/1.055)^2.4`): `--accent-primary #c96442` **3.90** · `--mathory-red-dark #BC5F3F` **4.33** · `--accent-danger #C0392B` 5.44. 12px/600 흰 글자는 WCAG "large text"(14pt bold ≈ 18.7px)가 아니므로 엄밀히는 4.5 기준이다. 기존 '보기' 알약도 같은 3.90으로 이미 쓰고 있다 |
| **E-4** | 톤 사다리 휘도: 클레이 `#F4EFE7` 0.8674 > `--bg-hover #F0EBE3` 0.8349 > `--block-bg #F0EAE0` 0.8275 > `--block-bg-active #E8DFCE` 0.7439. 현행 hover(`--bg-hover`)는 `--block-bg`보다 **밝다**. S2 사다리로 바꾸면 hover 대비가 한 단 강해지는 셈이다(클레이→active 차 0.12) |

---

## 2. 결정표 (v2)

### P. 제목행 고정 + 문제 카드 숨김/복원

| # | 결정 |
|---|---|
| **P1** | 제목행 자동접힘 철거. `headerSlim`·`HEADER_H`·`M2_COLLAPSE`·슬림 축약 제목·`borderBottom` 분기·D49 컨트롤 top 연동(`:1051` → `16` 고정)·`font-size`/`height` 트랜지션 삭제. 제목행은 **`height: 98` 고정**(R-11) |
| **P2** | ⚠⚠ **숨김 임계값은 "카드가 화면 위로 완전히 나갔을 때"** 다(R-1). `onScroll`에서 `rowRef.getBoundingClientRect().bottom <= container.getBoundingClientRect().top`이면 `setQuestionShown(false)`. 숫자 임계값(T1)은 **없다**. 카드가 조금이라도 보이는 동안은 흐름 그대로 위아래로 스크롤된다 |
| **P3** | ⚠⚠ **숨김 = 문제 행 래퍼**를 `position:absolute; visibility:hidden; pointerEvents:none; aria-hidden`(DOM 유지, A-5). 높이가 흐름에서 빠지는 순간 **같은 프레임에서** `useLayoutEffect`로 `scrollTop -= (이전 scrollHeight − 현재 scrollHeight)` (R-2). 빠지는 높이가 전부 뷰포트 **위**에 있으므로 화면은 픽셀 단위로 그대로다. `scrollTop − h ≥ 0`이 항상 성립해(카드가 나갔다 = `scrollTop ≥ 카드 하단`) **클램프·진동이 원리적으로 없다** — 하단 스페이서 70vh에 기대지 않는다(§6 V1) |
| **P4** | 복원은 버튼/라벨로만(E-P3). **복원 시 최상단으로 스크롤**(`fastScrollTo(container, 0, 300)`) — '문제 보기'를 눌렀는데 아무것도 안 보이면(보정으로 상쇄) 버튼이 죽은 것처럼 읽히고, 보정 없이 두면 본문이 카드 높이만큼 튄다. 두 함정 사이의 유일한 답이다 |
| **P5** | **자동 숨김은 반복 허용**(수동 복원 뒤 다시 스크롤해 카드가 나가면 다시 숨는다). 전이가 눈에 보이지 않으므로 해로울 것이 없고, 알약 라벨이 항상 실제 상태와 일치한다. `manualQuestionRef` 류의 보류 플래그는 두지 않는다. 문항 전환(`problemId`)에서 `questionShown=true`·`hiddenOnce=false` 초기화 |
| **P6** | 알약: `--accent-primary` · 흰 글자 12px/600 · radius 999 · `padding 4px 10px`(기존 '보기' 알약과 같은 규격, hover `--accent-hover`). 라벨 `questionShown ? '문제 감추기' : '문제 보기'`. **`hiddenOnce`가 true일 때만 렌더**(Q8). `<h1>` 안에 두므로 `e.stopPropagation()` 필수(h1 클릭 = 편집 진입) + 자기 `title` 지정(h1의 "클릭하여 편집"이 상속된다) |
| **P7** | 제목 span `minWidth:0` + 말줄임, 배지·💬·AI·알약 `flexShrink:0`(v1 P5 승계). 알약 위치는 **`marginLeft:auto`로 h1 우측 끝** = 카드 우측 경계에 정렬(§6 V6에서 덕수 판정) |
| **P8** | (R-8) **문제 카드의 클릭 토글·`cursor:pointer`·`title`·`.problem-tab-card:hover` 톤을 제거**한다 — 접힘 막대가 사라지면 카드 전체 과녁이 존재할 이유가 없고, 눌러서 사라지는 카드는 보수적이지 않다. 문제 **라벨** 클릭은 알약과 **같은 함수**를 부른다(조작 둘, 상태 하나). `openTabs['question']`은 항상 true(A-6) |
| **P9** | (R-10) `handleJumpToBlock`: 대상이 문제 탭이고 `!questionShown`이면 `setQuestionShown(true)`를 먼저 하고 기존 `setTimeout(60)+rAF` 경로를 탄다. sticky 오프셋(`stickyH`, D29′)은 삭제 |
| **P10** | 문제 카드 sticky 해제(E-P4). `questionRowRef`(측정용으로만 유지, sticky 아님)·`qStickyH`·`--m2-q-sticky-h`·`lastQHRef`·TabBody `collapsedPreview`/`compactTop`/`COLLAPSED_CARD_H`/내부 absolute 분기 삭제. 풀이 라벨 열 sticky top은 **`12` 고정**(P7 승계) |
| **P11** | 첫 행 상단 여백(24)은 `tabIdx===0` 조건이 아니라 **흐름 컨테이너 첫머리의 스페이서 div(24px)** 로 옮긴다 — 문제 행이 숨겨지면 "첫 행"이 풀이가 되는데 `tabIdx`는 1이라 여백이 0이 된다. 문제 행 래퍼의 `paddingTop 12/marginTop −12`(sticky 배경용)는 삭제, 문제↔풀이 간격 `1em + 8px`는 TabBody 문제 행 `marginBottom: calc(1em + 8px)`로 접어 총량 보존(C-4). 낡은 주석 `TabBody.tsx:213`도 고친다 |

### Q. 풀이 카드 상단 선·페이드

| # | 결정 |
|---|---|
| **Q1** | 선은 **별도 sticky 요소**(R-9): 흐름 컨테이너의 **첫 자식**(24px 스페이서보다 앞)으로 `position:sticky; top:0; height:0; zIndex:3`, 안에 absolute 1px 선(`left: lineLeft; width: cardW+20; background: var(--border-content)`). 첫 자식이어야 자연 위치가 y=0이라 **즉시** 붙는다(스페이서 뒤에 두면 24px 동안 선이 카드 위에 떠 있다) |
| **Q2** | 선은 `scrolled`일 때만 보인다: **마운트/언마운트가 아니라 `opacity`**(트랜지션 0.15s). 임계값 **on ≥ 6px / off ≤ 1px** 히스테리시스 — 트랙패드 미세 스크롤 깜빡임(V2) 대책 |
| **Q3** | 페이드는 **카드 안**으로(v1 Q3 승계, 구조 확정): 카드 div의 **첫 자식**(콘텐츠 div 앞)에 `position:sticky; top:15px; height:0` 래퍼, 그 안에 absolute 띠 `top:-14px; height:14px; left: -CARD_PAD_L; right: -CARD_PAD_R; zIndex:1; background: linear-gradient(to bottom, var(--card-surface, var(--bg-content)), transparent)`. 자연 위치에서는 카드 상단 패딩(20px) 안 y+6~+20에 놓여 **클레이 위 클레이 = 보이지 않고**, 붙으면 y=1~15(선 바로 아래)에 온다. `top:-14`가 없으면 자연 위치에서 첫 줄 글자 위 14px를 덮는다 |
| **Q4** | 페이드 색은 **카드 배경과 같은 식** `var(--card-surface, var(--bg-content))` — 리터럴 토큰 이름이 아니라 카드가 쓰는 식을 그대로. `zIndex:1`이어야 rail·dot(positioned, z auto)보다 **뒤가 아니라 앞**에 그려져 rail도 함께 흐려진다. 하드코딩 rgba 금지(`78a780f`) |
| **Q5** | 페이드는 **모든 탭 카드**(풀이·풀이2…)에 들어간다 — 각자 자기 카드 안에서만 붙고 카드 끝에서 함께 밀려 나간다. 카드 사이 8px 틈은 아이보리 그대로(v1 T10 자동 충족). 문제 카드에도 넣되 해로울 것은 없다(숨겨지면 함께 숨는다) |
| **Q6** | `scrolled` 게이트는 **선에만** 건다. 페이드는 자연 위치에서 이미 보이지 않으므로 게이트가 필요 없고, 게이트를 걸면 6px 구간에서 켜지는 순간이 보인다 |

### R. 좌측 라벨 간격 · rail 좌표 · 카드 패딩

| # | 결정 |
|---|---|
| **R1** | `LABEL_GAP_EM 2.8 → 1.4`(fs15에서 42 → 21px). `TabBody.tsx:31-35` 주석의 "rail이 이 틈으로 나온다"는 M2 이전 서술 → 함께 고친다 |
| **R2** | `--case-rail-x: -1.8em → -1.3em`(R-6: R3와 짝). ⚠ **`:root` 토큰이라 EditorView 미리보기·공개 뷰어도 함께 움직인다**(B-4). 권고: **전역으로 바꾼다** — 인쇄 rail이 이미 `-1.2em`이라 화면이 인쇄에 **가까워지는** 방향이고, 토큰을 두 값으로 가르면 "좌표는 토큰 둘이 전부"라는 Phase 59a 규약이 깨진다. 대안(ProblemView 카드·공개 ContentCard 스코프 override)은 §6 V3′ |
| **R3** | `CARD_PAD_L 40px → CARD_PAD_L_EM = 2.6`(fs15에서 39px ≈ 현행) · `CARD_PAD_R 36px → CARD_PAD_R_EM = 2.4`(36px). 상수는 **em 숫자**로 export하고 소비처 5곳(`TabBody.tsx:284,297` · `ProblemView.tsx:855-856,993`)이 `× contentFontSize`로 px화한다(`LABEL_GAP`과 같은 문법). 카드 폭 산식 `widthEm*fs + padL + padR`도 함께. 검산: rail 위치(카드 좌단 기준) = `(2.6 − 1.3)em = 1.3em` — **11/15/24px 전부 카드 안**, dot 좌단 `1.04em` |
| **R4** | (R-3) 공개 뷰어는 **R3 제외**(fontSize 15 고정). R2가 전역이면 공개 카드의 rail은 `40 − 19.5 = 20.5px`(카드 좌단 기준) — 앱 카드 19.5px과 1px 차. 무시 가능. 굳이 맞추려면 `paddingLeft 39` |
| **R5** | 그 밖에 `--case-rail-x`를 읽는 CSS(`globals.css:194-203` 주석의 여유 계산 "-1.54 → -1.2 = 0.34em")는 S1 이후 chevron이 없으므로 **주석을 갱신**한다 |

### S. 요약 보기 chevron 제거 + 톤 사다리

| # | 결정 |
|---|---|
| **S1** | **경우 줄 chevron만 제거**(v1 승계). `Toggler`에 `chevron?: boolean` prop → `case-head`는 false. CSS 정리: `.case-head .outline-chevron`(`:943-951`) · `.case-head[aria-expanded] .outline-chevron`(`:954`) · `.case-head.is-static .outline-chevron`(`:968`) 삭제. `--case-chevron-x` 토큰은 소비처가 `:948` 하나뿐이라 **함께 삭제**하고 `globals.css:194-203` 주석에 기록한다(소비처 없는 토큰 금지 — CLAUDE.md 다크 토큰 전례). 제목 줄 chevron은 흐름 안 flex 항목이라 이 토큰을 읽지 않는다. R2의 **전제**(B-5) |
| **S2** | (R-7) 톤 사다리: 카드 `--bg-content` → 1단 `--block-bg` → 2단 `--block-bg-active`. **hover(제목 줄·경우 줄) = 2단**, **펼친 섹션 = 1단 상시**. 경우 구역에는 상시 톤 **없음**(Fragment 형제, D-4) — 펼친 경우는 dot 채움 + 본문 등장으로 읽힌다. `.section-head:hover, .case-head:hover { background: var(--bg-hover) }`(`:955-956`)를 `--block-bg-active`로 |
| **S3** | 톤 영역 카드 전폭: `OutlineSections`의 섹션 래퍼에 `className="outline-section"` + open이면 `is-open`. CSS `.outline-section.is-open { background: var(--block-bg); margin: 0 calc(-1 * var(--card-pad-r)) 0 calc(-1 * var(--card-pad-l)); padding: 0 var(--card-pad-r) 0 var(--card-pad-l); }`. `--card-pad-l/r`은 **TabBody가 카드 인라인 style에 `${CARD_PAD_L_EM}em`으로 세운다** — TS 상수 하나가 카드 패딩과 CSS 음수 마진을 함께 공급(v1 "같은 상수 참조"의 구체형). `.section-head`·`.case-head`도 같은 식으로 전폭. `.section-head`의 `padding-left 1.6em / margin-left −1.6em`(D-2)은 이 식에 **흡수**된다 |
| **S4** | 공개 뷰어의 요약 보기(`ProblemTabContent`)도 `.outline-section`을 쓰게 되므로 `ContentCard`에도 `--card-pad-l: 40px; --card-pad-r: 36px`를 세운다. 안 세우면 `var(--card-pad-l, 0)`으로 폭이 본문에 머문다 — 깨지진 않지만 두 화면이 다르게 보인다 |
| **S5** | 얼룩 관찰(v1 S4 승계). 완화 장치를 미리 둔다: 상시 톤은 **radius 6**·상하 `padding 0.3em`, 인접 두 섹션이 모두 열리면 `+ .outline-section.is-open { margin-top: 0.4em }`으로 띄운다. 실물 판정에서 과하면 상시 톤을 통째로 끈다(hover만 남김) — 이 스위치는 CSS 한 줄이다 |

---

## 3. 상태 기계 (P절의 전부)

```
상태: questionShown (기본 true) · hiddenOnce (기본 false) · scrolled (기본 false)

[shown]  --(스크롤: 카드 하단 ≤ 컨테이너 상단)-->  [hidden]   자동 · scrollTop -= Δh (불가시)
[shown]  --(알약 '문제 감추기' / 문제 라벨)------->  [hidden]   수동 · scrollTop = max(0, scrollTop − Δh)
[hidden] --(알약 '문제 보기' / 지적 점프가 문제 탭)-> [shown]    수동 · 최상단으로 스크롤(점프는 대상 블록으로)
[hidden] --(스크롤)-------------------------------> [hidden]   자동 복원 없음 (E-P3)
hiddenOnce: 첫 [hidden] 진입 시 true → 알약 렌더 시작 (Q8)
문항 전환: 셋 다 초기화
```

진동이 불가능한 이유: 자동 전이가 **한 방향**뿐이고, 그 전이는 뷰포트 밖에서만 일어나며, 보정 후 `scrollTop`이 임계 조건을 다시 만족시킬 상태 변수 자체가 없다.

---

## 4. 사라지는 것 / 추가되는 것

**삭제**: `headerSlim`(23) · `HEADER_H` · `M2_COLLAPSE` · `questionCollapsed` · `manualQuestionRef` · `collapseTimerRef`/`lastFlipRef` · 슬림 축약 제목 · D49 top 연동 · sticky 문제 행(+ 아이보리 배경·paddingTop/marginTop 해크) · `qStickyH`/`setQStickyH` · `--m2-q-sticky-h` · `lastQHRef` 델타 보정(→ P3의 1회성 보정으로 대체) · D29′ 점프 오프셋 · TabBody `collapsedPreview`/`compactTop`/`COLLAPSED_CARD_H`/내부 absolute 분기 · 카드 클릭 토글·hover 톤 · `.case-head .outline-chevron` 3규칙 · `--case-chevron-x`.

**추가**: `questionShown`·`hiddenOnce`·`scrolled` 상태 3개 · 알약 1개 · sticky 선 요소 1개 · 카드 내 페이드 1개(TabBody) · `--card-pad-l/r` 변수 · `.outline-section` 클래스. **서버 0 · Firestore 0 · 스키마 0 · 전처리 0.**

---

## 5. 실행 순서 (의존성)

1. **S1**(경우 chevron 제거) → 2. **R2·R3**(좌표·패딩 em화) → 3. **R1** → 4. **P1~P11** → 5. **Q1~Q6** → 6. **S2~S5**.
S1이 R2보다 앞이어야 하고(B-5), R3가 S3보다 앞이어야 한다(`--card-pad-*` 공급). P와 Q는 같은 파일(`ProblemView.tsx`)의 같은 영역이라 한 커밋으로 묶어도 된다.

---

## 6. 검증 체크리스트

- **P** T1 제목행이 스크롤 전후 픽셀 불변(y=98 선 유지) · T2 카드가 화면 밖으로 나간 **직후** 프레임에서 본문이 1px도 안 움직임(CDP `Page.captureScreenshot` 전후 diff) · T3 최상단 복귀해도 카드 없음 + 풀이 카드 위 24px 여백 · T4 '문제 보기' → 최상단 + 카드 + 라벨 '문제 감추기' · T5 다시 스크롤 → 다시 숨김(P5) · T6 긴 제목에서 알약·💬·AI 생존 · T7 ⚠ **숨김 상태에서 풀이의 `ㄱ`·`(가)`·`①` 말풍선 전부 동작**(A-2) · T8 지적 클릭이 문제 탭 블록을 가리킬 때 카드 복원 후 점프(P9) · T9 풀이가 30vh보다 짧은 문항은 **카드가 영영 안 숨는다**(정상 — 숨길 이유가 없다) · T10 문항 전환 시 초기화
- **Q** T11 최상단: 선·페이드 없음, 풀이 카드 라운드·상단 테두리 정상 · T12 6px 이상 스크롤 시 선 등장(깜빡임 없음, 트랙패드) · T13 페이드가 **카드 색**이고 카드 좌우 테두리는 흐려지지 않음(폴더뷰와 같은 문법) · T14 카드 사이 틈 아이보리 · T15 풀이2 카드에서도 페이드 · T16 rail이 선 아래에서 함께 흐려짐(Q4 zIndex)
- **R** T17 11·15·24px에서 rail·dot이 카드 안(계산 1.3em/1.04em) · T18 EditorView 미리보기 rail 위치 변화 확인·수용(R2 전역) · T19 공개 뷰어 `/p`·`/shared`·앱 임베드 3경로
- **S** T20 경우 줄 chevron 없이 dot으로 접힘/펼침 읽힘 · T21 hover 2단·펼친 섹션 1단 · T22 톤 영역 카드 전폭, rail·dot이 톤 **위**에 남음(D-5) · T23 인접 섹션 다수 펼침 얼룩 실물 판정(S5 스위치) · T24 공개 뷰어 요약 보기 동일(S4)
- **공통** `npm run test:*` 무회귀(M2 v4 §5 기준 262개; `package.json`에는 `test:rules` 포함 11 스크립트) · `tsc` 0건 · `[data-noscroll]` 경고 0

---

## 7. 하지 말 것

- **숫자 임계값(T1)으로 카드를 숨기지 말 것** — 보이는 카드가 사라지면 본문이 튄다(R-1). 임계는 "카드 하단 ≤ 컨테이너 상단" 하나다.
- **문제 카드를 언마운트하지 말 것**(A-2·A-5). `openTabs['question']`을 false로 만들지 말 것(A-6).
- **최상단 복귀 자동 복원 금지**(E-P3). 복원 시 scrollTop 보정으로 상쇄하지 말 것(P4 — 버튼이 죽은 것처럼 보인다).
- S1 전에 R2를 하지 말 것(B-5). R3 전에 S3를 하지 말 것.
- `CARD_PAD_*`를 px로 되돌리지 말 것 · 톤 마진에 숫자를 굳히지 말 것(`--card-pad-*` 경유).
- 제목 줄 chevron까지 없애지 말 것 · 경우 구역을 div로 감싸 톤을 주지 말 것(rail 인접이 끊긴다, D15′).
- 선을 마운트/언마운트로 깜빡이지 말 것(opacity) · 페이드에 `scrolled` 게이트를 걸지 말 것(Q6).
- 제목행을 `minHeight`로 두지 말 것(R-11).
- M2 규약(우측 패널 4종 규격 · 밝기 3단 서열 · 드로어 1행 48 · 본문 컨테이너 block · 하단 스페이서)은 건드리지 않는다.

---

## 8. v3에서 답할 것 (v1 V1~V5의 답 + 신규)

| # | 질문 | v2의 답 / 남은 것 |
|---|---|---|
| V1 | 보정 없이 자리가 유지되는가 | **아니오**. 그러나 P2·P3로 보정이 **불가시**가 됐고 스페이서에 의존하지 않는다. 남은 것: CDP 전후 스크린샷 diff로 T2 확인 |
| V2 | `scrolled` 4px 깜빡임 | on 6 / off 1 히스테리시스 + opacity 트랜지션(Q2). 실사용 확인만 남음 |
| V3 | `-1.3em` 균형 | 2.6em 패딩과 짝을 맞춰 **정확히 중간**(R-6). 실물 판정 |
| **V3′** | R2를 전역으로 할지, ProblemView·공개 카드 스코프로 한정할지 | 권고 전역(인쇄 −1.2em과 수렴, 토큰 단일). **덕수 판정** |
| V4 | 톤 배경이 rail을 덮는가 | **덮지 않는다**(D-5, 페인팅 순서). 단 톤 요소에 `position`을 주면 뒤집히므로 주지 말 것 |
| V5 | 알약 3.90:1 수용 vs `--mathory-red-dark` 4.33 | 기존 '보기' 알약과 같은 3.90 권고(앱에 알약 색 한 갈래). **덕수 판정** |
| **V5′** | (R-4) 편집창 '보기'와 열람뷰 '문제 보기'의 낱말 겹침 | '보기'는 화면 이동, '문제 보기'는 카드 복원. 겹침이 신경 쓰이면 '문제 펼치기/접기'가 대안이나 M2 접힘 어휘와 또 겹친다. **덕수 판정**(Q7 확정 여부) |
| **V6** | 알약 위치: h1 우측 끝(카드 우측 경계 정렬) vs 제목 바로 오른쪽 | 권고 우측 끝(`marginLeft:auto`) — 제목·배지·💬·AI 묶음과 분리되고 카드 경계라는 앵커가 있다. **덕수 판정** |
| **V7** | 자동 숨김 반복 허용(P5) vs 1회만 | 권고 반복(라벨 정합·전이 불가시). 1회만 원하면 `hiddenOnce`를 게이트로 쓰면 되므로 코드 차이는 조건 하나 |
| **V8** | 카드 클릭 토글 제거(P8)에 동의하는지 | M2 보완 2의 근거(막대 과녁)가 사라졌다. **덕수 판정** |
