# Phase 59 — Structure at a Glance: 풀이 접기·펼치기 · '경우(Case)' 블록 **v2 (실측 대조본)**

작성일: 2026-08-17 · v1: web Claude(Fable) · **v2: CLI Claude — 레포 전수 실측 대조**
기준 커밋: `459cbcb` (main, origin과 동일 — 미푸시 0건)

> **v2의 성격** — v1은 스스로 "파일:행 좌표·형태 가정은 전부 v2의 착수 전 실측(T0) 대상"이라고 밝힌 방향 문서다. v2는 그 T0을 **실제로 수행한 결과**다. 좌표를 채우고, 틀린 전제를 정정하고, 누락된 상호작용을 보완했다. 아래 §1의 정정 24건은 전부 파일:행 근거를 단다.
>
> **v1의 확정 사항 Q1~Q4는 유지한다.** 덕수가 결정한 라벨('경우'/'하위 경우')·표기(`C-1.`)·클릭 스코프(outline만)·전문 섹션 여닫이는 건드리지 않았다. 다만 Phase 54 발견으로 **새로 생긴 질문 1건(Q5)** 만 §10에 올렸고, 그 답 없이도 착수할 수 있도록 기본값을 정했다.

---

## 0. 요약 — v1 → v2에서 무엇이 달라졌나

| 구분 | 건수 | 성격 |
|---|---|---|
| **치명적 정정** | 4 | Phase 54 중복 구현(E1) · 수식 클릭 매핑 파괴(E7) · K1 여백 값 오류(E2) · 톤 시스템이 케이스 제목을 흐림(E17) |
| 사실 오류 정정 | 8 | 분기 순서(E3) · dot 정렬(E4) · 문자 확장(E5) · rail 브리징(E6) · 키 안정성(E9) · lucide 부재(E10) · 이름 충돌(E11) · 다크모드 부재(E12) |
| 미확인 항목 해소 | 4 | Phase 58 배포 완료(E13) · SnapshotView 경로(E14) · Firestore 규칙(E19') · 분할 동작(E23) |
| 누락 보완 | 8 | 인쇄 fleqn(E15) · 공유뷰 2단 레이아웃(E16) · 내보내기 번호 소실(E18) · outline 스코프(E21) · 스크롤 앵커링(E20) · 이어짓기 규칙(S1) · Ctrl+F·인쇄 상호작용(S2) · 블록 단위의 한계(S4) |

가장 중요한 한 문장: **`case`/`subcase` 블록은 "신설"이 아니라 Phase 54가 만든 텍스트 규약(`**Case 1.**` / `- **Case 1a.**`)의 후속이다.** 이 사실이 라벨·번호·key 마커·outline 발췌 전부에 파급된다.

---

## 1. v1 정정 사항 (전건 파일:행 근거)

### E1 ★ Phase 54가 이미 '경우' 구조를 구현해 두었다 — v1 전체 누락

| 항목 | 위치 |
|---|---|
| 상위 케이스 경계 정규화 | `lib/locale.ts:86-99` `normalizeCaseBoundaries()` — `^\*\*Case\s+\d+[a-z]?\.\*\*` |
| 하위 케이스 마커 주입 | `lib/locale.ts:106-111` `convertSubcaseMarkers()` — `^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*` → `<span class="marker-case-sub">` |
| 파이프라인 편입 | `lib/preprocess.ts:196-197` (locale → **case 2단계** → math) |
| 화면 불릿 숨김 | `app/globals.css:328-336` |
| 인쇄 불릿 숨김 | `components/print/PrintStyles.css:78-80` |
| 착수 문서 | `docs/phasedocs/Phase54 Case 하위케이스 들여쓰기 렌더링.md` |

**즉 현행 규약은 이렇다.** 상위: `**Case 1.**` 일반 문단 / 하위: `- **Case 1a.**` 최상위 리스트 항목(불릿 숨김 + `ul` 들여쓰기 상속).

파급 3건:

- **(a) 2중 체계.** 신설 블록을 만들면 같은 문서 안에 `**Case 1.**`(텍스트)과 `C-1.`(블록)이 공존할 수 있다 → §5.5에 정합 규칙, §10 Q5.
- **(b) 레거시 케이스 라벨이 이미 Phase 58 key 마커다.** `**Case 1.**`의 `**`는 `lib/keyTone.ts:21` `KEY_STRONG_RE`에 그대로 걸린다 → **케이스 분석을 쓴 기존 풀이는 이미 has-key 발동 상태**이고 라벨이 key 색(primary)·굵기(600)로 렌더되고 있다. v1의 `extractKeySentences`를 그대로 쓰면 outline이 "Case 1. / Case 2. / Case 1a." 로 도배된다 → §3.3 필터 필수.
- **(c) Phase 54 D4가 "추후 별도 결정"으로 미룬 `Case → 경우` 한글화가 곧 Phase 59 Q1이다.** 덕수의 '경우' 확정은 그 미결의 답이므로, v2는 이를 **명시적 승계**로 기록한다.

### E2 ★ K1 여백 값이 틀렸다

v1 §6.2는 `.case-block { margin: 1.5em 0; /* K1 통일 기준 (Phase 57) */ }`이라 썼다. K1은 **화면 1.1em / 인쇄 11pt**다 — `app/globals.css:493` (`.callout-block { margin: 1.1em 0 }`), `PrintStyles.css:137`, `globals.css:447-453` 주석. 1.5em은 Phase 58 D2에서 **폐기된** 값(제목 블록 paddingTop 1.5em → 0.5em)이다.
→ 여백 1.1em/11pt, 레일 브리징 보정값도 `-1.1em`.

### E3 렌더 5곳의 분기 순서가 동일하다는 전제가 틀렸다

| 사이트 | 실제 분기 순서 | 위치 |
|---|---|---|
| EditorView 미리보기 | image → svg → ggb → BORDERED → callout → choices → 기본 | `EditorView.tsx:3163-3240` |
| ProblemView | image → svg → ggb → BORDERED → callout → choices → 기본 | `ProblemView.tsx:329-404` |
| FolderView | image → svg → ggb → BORDERED → callout → choices → 기본 | `FolderView.tsx:247-303` |
| **ProblemTabContent(공유)** | image → BORDERED → callout → choices → 기본 — **svg·ggb 분기 없음** | `ProblemTabContent.tsx:29-78` |
| **PrintableContent(인쇄)** | **choices → image** → svg → ggb → BORDERED → callout → 기본 | `PrintableContent.tsx:74-93` |

두 가지 귀결: ① case 분기를 넣을 자리는 사이트마다 다르다(**callout 바로 앞** 이 유일한 공통 앵커다). ② **공유뷰와 앱 뷰의 렌더러를 통합하면 안 된다**(§4.4) — 공개 페이지에 SVG 뷰어가 새로 등장하거나 앱 뷰에서 사라진다. `CLAUDE.md`의 "분기 순서는 5곳 모두 …" 문구도 Stage 6에서 정정.

### E4 dot이 rail 중심에 오지 않는다

v1: rail `left: 1em; width: 2px`, dot `left: -2em; width: 0.5em`. 레일은 `1em ~ 1em+2px`, dot은 `1em ~ 1.5em` → **dot 왼쪽 끝이 레일에 접할 뿐** 중심이 어긋난다(0.25em).
→ 레일을 `left: 1em; margin-left: -1px`로 **1em을 중심선**으로 만들고, dot은 `left: 1em; transform: translate(-50%, -50%)`. 단위 산식이 아니라 중심 기준을 공유해 재보정이 필요 없다.

### E5 `String.fromCharCode(96 + sub)`는 'aa'로 확장되지 않는다

v1 §5.3은 "27개 초과는 자연 확장(aa)만 코드로 허용"이라 썼지만 `fromCharCode(96+27)`은 `'{'`다. → §5.3에 base-26 함수. (실사용은 없지만 `{`가 나오는 것보다 3줄이 싸다.)

### E6 rail 브리징 CSS가 경계에서 깨진다

v1은 인접 마진을 음수 `top`으로 건너뛰고, 하위케이스에는 `::before`(자기 레일) + `::after`(부모 레일 통과)를 겹치며, 스스로 "마지막 하위케이스에서 `bottom: -1.5em`이 레일을 초과 연장한다 — v2 최대 검증 포인트"라고 적었다. 실제로 **인접 형제 마진은 collapse되어 간격이 1.1em이지 2.2em이 아니다**(`* { margin: 0 }` 리셋 아래서도 형제 collapse는 유효). 음수 오프셋 2개와 collapse 값이 동시에 맞아야 하는 구조는 유지 불가다.
→ §6.2에서 **margin collapse를 인정한 3규칙 스킴**(`:has(+ .case-block)`로 아래로 1.1em 연장 / `+ .case-block`은 자기 top 0에서 시작)으로 교체. 음수 top 없음, 하위케이스 전용 이중 레일 없음(E6' 참조).

### E6' 하위케이스 inner rail은 요구사항이 아니다 — 없애는 편이 안전하다

구상 2-3-5는 "하위케이스 들여쓰기 + 디자인 강구"이고 inner rail은 v1의 창작이다. inner rail을 두면 부모 레일 통과 구간을 세 번째 가상요소로 그려야 하는데 `::before`/`::after` 2개가 이미 레일·dot에 쓰인다.
→ **하위케이스 = 들여쓰기 1단 + 작은 dot(부모 레일 위) + inner rail 없음.** 레일 규칙이 case·subcase에 **완전히 동일**해져 §6.2 전체가 3규칙으로 줄고, "마지막 하위케이스 overshoot" 문제가 원천 소멸한다. 시각 판정은 Stage 2 실측(§6.4에 대안 2개).

### E7 ★ 제목/본문 2-div 분할은 편집창의 수식 클릭 매핑을 깨뜨린다

v1 §5.4는 `case-title` / `case-body` 두 div에 각각 `EditorPreview`를 둔다. 그러면:

- `EditorPreview.tsx:388-393` — `data-math-id`는 **인스턴스별로 0부터** 부여된다.
- `EditorView.tsx:1835` — `blockPreview.querySelector('.katex[data-math-id="…"]')`는 `[data-block-id]` 안의 **첫 매치**를 집는다.
- `lib/mathIndex.ts` — 편집창 좌표는 **블록 raw_text 전체** 기준 인덱스다.

→ 제목행에 `$a>1$`이 있는 case 블록에서 본문 수식을 클릭하면 제목 수식으로 스크롤·하이라이트된다(Phase 56 기능 회귀). 두 인스턴스의 id가 겹쳐 `activeMathId` 하이라이트도 오작동한다.

**정정: 단일 `EditorPreview` + 라벨 span 주입.** 렌더 사이트가 `raw_text`의 첫 줄 앞에 `<span class="case-label">C-1.</span>`를 끼워 넣은 문자열 하나를 넘긴다. 전례가 확립되어 있다 — `marker-gana`·`marker-circled`(`lib/locale.ts:115-131`)·`marker-case-sub`(`:106`) 전부 같은 방식이고, 행 선두 인라인 `<span>`은 remark가 문단 내 인라인 HTML로 파싱한다(Phase 54 §3 검증 1). 수식 인덱스는 한 인스턴스라 그대로 보존되고, `.case-title` 전용 p 마진 상쇄 규칙도 불필요해진다. 부작용 0.

### E9 `openSections` 키를 block id로 두면 저장마다 깨진다

v1 §7은 "섹션 id를 순번이 아닌 블록 id로 → 재로드·리렌더에 안전"이라 했으나 **doc id는 저장마다 재발급된다**(`types/problem.ts:154-155`: "doc id는 저장마다 재발급되므로 … block_key를 매칭 키로"). → 키는 `block_key ?? id`.

### E10 lucide 의존성이 없다

`package.json`에 lucide 없음. 크롬 아이콘은 `components/ui/Icons.tsx`의 자체 인라인 SVG(viewBox 24, `strokeWidth 2`, `stroke=currentColor`)이고 `IconChevron`(우) `IconChevronLeft` `IconChevronDown` 3종뿐(`:126-148`) — **이중 chevron 없음**. → `IconChevronsDown`/`IconChevronsUp` 2개를 같은 스타일로 신설(§4.2). (`CLAUDE.md`가 말하는 `UnifiedToolbar` 인라인 SVG 계열은 **편집 툴바** 세트로, 열람 화면 크롬과 다른 집합이다.)

### E11 '전체 접기'는 이미 편집창 기능 이름이다

`EditorView.tsx:922-923` `collapseMode`, `:1722` "전체 접기 / 펼치기 토글", 블록별 `collapsed`(`:72`), Phase 45. 같은 이름을 열람 화면에 쓰면 문서·UI가 즉시 혼선된다.
→ 신규 기능 명칭 **"구조 보기 / 전체 보기"**(내부 상태는 `mode: 'outline' | 'full'`). 버튼 라벨도 이 문구로 통일.

### E12 다크모드가 없다

`prefers-color-scheme`·`data-theme` 검색 0건. v1 §7의 "다크모드/톤" 엣지는 삭제. `currentColor` 채택 근거는 다크모드 대비가 아니라 **인쇄 흑백·톤 시스템 dim 추종**이다.

### E13 Stage 0의 선행 조건은 이미 충족

`git rev-list --count origin/main..main` = 0 → Phase 58은 커밋·푸시 완료(`459cbcb`). key 마커·톤 CSS·`--katex-scale 1.08em`·`size-adjust 88%` 전부 최종형. v1의 "Phase 58 배포 완료 후 착수" 게이트는 열려 있다.

### E14 SnapshotView는 독자 렌더러가 아니다

`SnapshotView.tsx:4` → `PublicViewerShell` → `ProblemTabContent`(`PublicViewerShell.tsx:78-96`). 실시간(`/p`, `PublicProblemView.tsx:6`)도 같은 셸. → **공유·스냅샷·실시간 3경로가 렌더러 하나를 공유**하므로 ProblemTabContent 한 곳만 고치면 된다. v1 §7의 미확인 항목 해소.

### E15 인쇄에 fleqn 개별 override가 필요하다

callout 전례는 두 줄이다: `PrintStyles.css:143` `.print-body .callout-block .katex-display.fleqn > .katex { padding-left: 0 !important }` + `globals.css:502` `.callout-block .katex-display { padding-left: 0 }`. 인쇄는 `@media print`에서 `.katex-display`를 0으로 죽이고 **`.fleqn > .katex`에 2em을 다시 주므로**(`PrintStyles.css:23-24`) 화면 규칙만 베끼면 case 안 display 수식이 이중 들여쓰기된다. v1은 "callout 전례 재사용"만 적어 이 줄을 빠뜨렸다.

### E16 공유뷰 2단 모드에는 탭 바가 없다

`PublicViewerShell.tsx:46` `twoColumn = wide && tabs.length === 2` → 넓은 화면·탭 2개면 문제/풀이가 좌우 단으로 갈리고 **탭 바가 렌더되지 않는다**(`:75-84`). v1의 "풀이 탭 콘텐츠 상단"은 이 화면에서 성립하지 않는다.
→ 토글은 셸이 아니라 **`ProblemTabContent` 내부 최상단 우측**에 둔다. 1단·2단·스냅샷·실시간 4경로가 자동으로 커버된다.

### E17 ★ 톤 시스템이 케이스 제목행을 흐린다

`globals.css:252-255`가 has-key일 때 본문 전체와 **`.katex`까지** (0,3,0)으로 dim한다. 케이스 제목행은 `strong`이 아니므로 dim으로 내려앉고, 제목행 안 수식(`$a>1$인 경우`가 표준형이다)도 dim된다 — 구조 신호가 본문보다 약해지는 역전. Phase 58은 정확히 같은 이유로 h1~h3 가드를 두었다(`globals.css:271-283`, D9′).
→ §6.3에 **케이스 제목행 가드**를 h1~h3 가드와 1:1 대응으로 신설. 특이도 계산까지 명시.

### E18 자동 번호는 복사·내보내기에서 사라진다

`ProblemView.tsx:246`(탭 MD 복사) `:281`(MD 다운로드)는 `raw_text`만 join하고, `lib/version/exportMd.ts:67`은 타입을 `<!-- block: case -->` 주석으로만 남긴다. → `C-1.`은 화면·인쇄에만 존재한다.
v1 ②(번호를 raw_text에 넣지 않는다)의 편집 내성 이득이 더 크므로 **결론은 유지**하되, 비용을 명시하고 값싼 보완 하나만 넣는다: `exportMd`의 블록 주석에 라벨 동봉(`<!-- block: case C-1 -->`). 1줄, 결정적 출력 유지, 아카이브 가독성 회복. (Phase 57 P5가 "원문 그대로 두면 내보내기까지 자동 일치"를 이득으로 꼽았던 것과 반대 방향의 트레이드오프임을 기록해 둔다.)

### E19 FolderView는 사실상 문제 탭만 렌더한다

`lib/firestore.ts:263-279` `getPreviewBlocks` — 탭 순서대로 훑어 **내용이 있는 첫 탭**을 채택. 즉 카드에 뜨는 것은 거의 항상 문제 탭이다. case 블록은 풀이에 쓰므로 노출 빈도는 낮지만 0은 아니다(문제 탭에 쓰면 뜬다). → 분기는 넣고 접기는 없음(v1 결론 유지, 근거 보강).

### E19' Firestore 규칙은 블록 type을 검증하지 않는다

`firestore.rules`에 블록 `type` 화이트리스트 없음(문서 필드 검증은 discussion_sessions의 `type`뿐, `:315-350`). `toPersistedBlock`(`lib/blocks/normalize.ts:28-47`)도 type을 그대로 흘린다. → **규칙 0 · 마이그레이션 0 · 서버 0** 확정.

### E20 outline↔full 전환 시 스크롤이 튄다 (누락)

콘텐츠 높이가 급변하는데 v1에 앵커링이 없다. 스크롤 주체: ProblemView는 U-프레임 div(`ProblemView.tsx:669-681`), 공유뷰는 `ScrollColumn`(`PublicViewerShell.tsx:114-124`). → §4.3에 최소 보정(클릭 타깃 y 고정, 약 15줄).

### E21 outline 스코프에 문제 탭이 들어가 있다 (누락)

문제 탭에서 `**`는 key 마커가 아니다 — `lib/keyTone.ts:39-41` `isToneScoped(tabId) = tabId !== 'question'`. 문제 탭에 `extractKeySentences`를 적용하면 "굵게 쓴 조건문"이 핵심문장으로 승격된다. → **토글 노출·outline 적용을 `isToneScoped(tabId)`로 게이트**(기존 함수 재사용, 신규 판정 금지).

### E22 케이스 제목행 굵기 600은 key와 같은 신호다

`globals.css:269` `.solution-tone.has-key strong { font-weight: 600 }`. 제목행 전체를 600으로 두면 "600 = key"라는 Phase 58 D5 신호가 흐려진다. → **라벨(`C-1.`)만 600, 제목행 텍스트는 500(`--weight-medium`)**. 제목행 안에 `**`를 쓰면 그 부분만 600으로 튀어 위계가 살아난다.

### E23 블록 분할은 번호를 중복시키지 않는다

`EditorView.tsx:1571-1580` — `handleSplitBlock`이 만드는 **두 번째 블록의 type은 항상 `'text'`**다. 따라서 case 블록을 ⌘B로 쪼개도 `case + text`가 되어 번호가 늘지 않는다. v1의 SPLITTABLE 편입 근거는 유효하고 부작용도 없다.

### E24 편집창 전체접기는 케이스 요약을 자동으로 보여준다

`EditorView.tsx:736-744` — 접힌 블록 헤더는 `BLOCK_TYPE_LABELS[type]` + `previewText`(첫 줄)를 표시. case 블록은 "경우 · $a>1$인 경우"로 자동 요약된다. 추가 작업 없음(Stage 1 확인 항목).

### 그 밖에 확인만 한 것

- `.problem-content-scaled`는 CSS 규칙이 없는 후크 클래스다(FolderView의 인라인 `<style>`만 소비, `FolderView.tsx:562`). ProblemView에서는 무동작 — 새 규칙을 여기에 걸지 말 것.
- 공개 뷰어에 앱 인쇄 경로가 없다(`rightSlot`은 ShareButton·오너 배지뿐). → §3.4.
- `--tone-dim: #675F52`(`globals.css:132`)는 이미 승격 적용 중. rail이 `currentColor`면 has-key 상태에서 함께 흐려진다 — 의도된 동행이다.

---

## 2. 결정표 (v2)

변경/신설은 **굵게**.

| # | 결정 | v2 값 | 근거 |
|---|---|---|---|
| D1 | 섹션 단위 | 제목 기준 섹션 모델. `type === 'heading'` 블록이 경계, 첫 제목 앞은 전문(前文) 섹션 | v1 유지 |
| D1′ | **텍스트 블록 안 `## `는 경계가 아니다** | 블록 타입만 본다. 마크다운 제목을 텍스트 블록에 직접 쓴 경우는 섹션이 되지 않는다(D2 제목 여백 산식과 동일 기준) | `EditorView.tsx:3160` 등 5곳이 `block.type === 'heading'`으로만 판정 |
| D2 | 핵심문장 표시 | C안 발췌 렌더(`**…**` 구간만) | v1 유지 |
| D2′ | **레거시 Case 라벨은 발췌에서 제외** | `^Case\s+\d+[a-z]?\.$` 형태의 강조는 구조 라벨이므로 key로 뽑지 않고, **케이스 제목 항목으로 승격**한다 | E1-b |
| D3 | 상태 모델 | `mode` + `openSections` + `openCases`, 비영속 | v1 유지 |
| D3′ | **상태 키는 `block_key ?? id`** | doc id는 저장마다 재발급 | E9 |
| D4 | 적용 범위 | ProblemView + ProblemTabContent(공유·스냅샷·실시간 공통) | v1 유지 · E14 |
| D4′ | **탭 스코프 = `isToneScoped(tabId)`** | 문제 탭 제외. 기존 함수 재사용 | E21 |
| D5 | 기본 상태 | full — 기존 문항 화면 변화 0 | v1 유지 |
| D6 | 토글 위치·명칭 | ProblemView: '풀이' 라벨 열 / 공유뷰: **탭 콘텐츠 최상단 우측**. 명칭 **"구조 보기 / 전체 보기"** | E11 · E16 |
| D7 | 데이터 모델 | additive 타입 2종 `case` / `subcase`. depth 필드 없음 | v1 유지 · E19′로 "규칙 0" 확정 |
| D8 | 한글 라벨 | '경우' / '하위 경우' — **Phase 54 D4가 미룬 한글화 결정의 답으로 기록** | Q1 확정 · E1-c |
| D9 | 제목행 규약 | 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호는 렌더 시 산출 | v1 유지 |
| D9′ | **이어짓기 규칙** | 첫 줄이 빈 case/subcase 블록은 **직전 경우의 연속**으로 본다 — 번호 증가 없음, dot 없음, rail만 이어짐 | S1(한 경우 안에 이미지·선택지 블록을 넣어야 할 때의 유일한 탈출구) |
| D10 | 번호 리셋 | 섹션(heading) 단위 | v1 유지 |
| D11 | 시각 표현 | rail + dot. 좌측 여백은 callout 기준값(화면 3em / 인쇄 2em) 재사용 | v1 유지 |
| D11′ | **여백은 K1 = 1.1em / 11pt** | 1.5em 아님 | E2 |
| D11″ | **rail·dot은 1em 중심선을 공유** | `margin-left: -1px` + `translate(-50%,-50%)` | E4 |
| D12 | 하위케이스 | 들여쓰기 1단 + 작은 dot | v1 유지 |
| D12′ | **inner rail 없음 — 부모 레일 하나로 통일** | 레일 규칙이 case·subcase 동일. 가상요소 2개로 충분 | E6′ |
| D13 | 클릭 스코프 | outline 모드에서만 | Q3 확정 |
| D14 | 빈 스켈레톤 가드 | 제목·key·경우가 전무하면 토글 비활성 + 툴팁 | v1 유지 |
| **D15** | **케이스 렌더 구조** | **단일 `EditorPreview` + 라벨 span 주입**(2-div 분할 폐기) | E7 |
| **D16** | **렌더러 통합 금지** | 공유·앱 뷰 렌더 분기는 계속 2벌. 공유하는 것은 **로직(라벨·outline)과 토글 컴포넌트**뿐 | E3 |
| **D17** | **런 마지막 레일 종단** | 기본은 **마지막 case 블록 하단까지**(구역을 감싼다). 스케치대로 "마지막 dot에서 끊기"로 바꾸려면 §6.2의 1규칙만 교체 | E6 · Stage 2 실측 |
| **D18** | **내보내기 번호** | 번호는 화면·인쇄 전용(수용). `exportMd`의 블록 주석에만 라벨 동봉 | E18 |

---

## 3. P1 — 섹션 모델 · 구조 보기

### 3.1 신설 모듈 2개

```
lib/caseBlock.ts        — 5개 렌더 사이트 공용 (라벨 계산 · 제목행 분리 · 라벨 주입)
lib/solutionOutline.ts  — 2개 열람 사이트 공용 (섹션 · 발췌)
```

`lib/caseBlock.ts`:

```ts
export type CaseKind = 'case' | 'subcase';
export function isCaseBlock(type: string): boolean;          // 'case' | 'subcase'

/** blockKey → 표시 라벨. 이어짓기(D9′)·제목행 없는 블록은 항목 자체가 없다. */
export function buildCaseLabels(
  blocks: { id: string; block_key?: string; type: string; raw_text: string }[],
): Map<string, string>;                                       // key = block_key ?? id, value = 'C-2' | 'C-2-a'

/** 첫 줄 / 나머지. 첫 줄이 비면 title === '' (이어짓기). */
export function splitCaseTitle(raw: string): { title: string; body: string };

/** 첫 줄 앞에 라벨 span을 끼운 문자열. label === null이면 원문 그대로. */
export function injectCaseLabel(raw: string, label: string | null): string;
```

번호 규칙(D10·D9′):

```
heading            → n = 0, sub = 0
case,    제목행 有  → n++, sub = 0, label `C-${n}`
case,    제목행 無  → label null (이어짓기)
subcase, 제목행 有  → sub++, label `C-${n || 1}-${letters(sub)}`
subcase, 제목행 無  → label null
그 외 블록          → 번호 상태 불변 (경우 사이에 설명 문단이 끼어도 번호가 이어진다)
```

`letters()`는 base-26: `a…z, aa, ab…`. `fromCharCode(96+n)` 단독 사용 금지(E5).

```ts
function letters(n: number): string {           // 1 → 'a', 26 → 'z', 27 → 'aa'
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(97 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
```

**엣지**: 상위 case 없이 등장한 subcase는 `n || 1`로 `C-1-a`를 렌더하고, **편집창 미리보기에서만** 제목행 옆에 흐린 경고("위에 '경우' 블록이 없습니다")를 붙인다. 데이터는 손대지 않는다.

`lib/solutionOutline.ts`:

```ts
export interface OutlineItem {
  kind: 'case' | 'subcase' | 'keys';
  blockKey: string;
  label?: string;        // 'C-2.'
  content: string;       // EditorPreview에 그대로 넘길 문자열 (마커 포함)
}
export interface OutlineSection {
  key: string;                 // 섹션 첫 블록의 block_key ?? id
  heading: Block | null;       // null = 전문 섹션
  items: OutlineItem[];        // 접힘 상태에서 보일 것들
  blocks: Block[];             // 펼침 상태 원본
}
export function buildOutline(blocks: Block[]): OutlineSection[];
export function hasOutlineContent(s: OutlineSection[]): boolean;   // D14 게이트
export function extractKeySentences(raw: string): string[];        // 마커 포함 반환
```

`extractKeySentences` 요건:

- `lib/keyTone.ts`의 `KEY_STRONG_RE`를 **export**해 재사용한다. 단 현행 정규식은 `g` 플래그가 없다(`keyTone.ts:21`) → `KEY_STRONG_RE_GLOBAL`을 같은 패턴 + `g`로 함께 export하고, 판정용(`test`)과 추출용을 분리해 `lastIndex` 오염을 막는다.
- **레거시 Case 라벨 제외**: 발췌 결과가 `/^Case\s+\d+[a-z]?\.$/`(마커 제거 후)면 버린다. 대신 `**Case n.**`으로 시작하는 텍스트 블록은 `kind:'case'` 항목으로, `- **Case na.**` 행은 `kind:'subcase'` 항목으로 승격한다 → **레거시 문항에서도 구조 보기가 바로 동작한다**(§5.5).
- case/subcase 블록은 **본문(둘째 줄 이후)만** 대상. 제목행은 항상 표시되므로 중복 방지.
- 발췌는 섹션당 하나의 합성 문자열로 묶어(`join('\n\n')`) `EditorPreview` **한 번**만 호출한다.

### 3.2 구조 보기 화면의 정의

접힌 섹션에 남는 것은 정확히 셋: **① 제목 블록 ② `**…**` 발췌 ③ 경우·하위경우 제목행**. 그 외(이미지·SVG·GGB·선택지·표·발췌 없는 텍스트)는 통째로 숨는다. 발췌 대상이 하나도 없는 섹션은 제목만 남는다(제목조차 없는 전문 섹션이면 아무것도 남지 않는다 → §4.3).

key 마커가 문장 일부만 감싸면 발췌도 그 일부만 보인다. 버그가 아니라 **마커 사용 지침**의 문제로 정리한다(Stage 6에서 `docs/phasedocs/사용 가이드 — 강조와 톤.md`에 "핵심문장 마커는 문장 전체 단위로" 한 줄 추가).

### 3.3 톤 상호작용 — 별도 CSS가 필요 없다

발췌는 마커를 **포함해** 렌더되므로 `<strong>`이 되고, `globals.css:258-259`가 primary + 600으로 되돌린다. v1이 예고한 "`.outline-keys`에 dim 무효화 1줄"은 **불필요**하다. `.outline-keys`에는 레이아웃(상하 여백)만 둔다.

### 3.4 인쇄·저장·검색 부작용

- **앱 PDF 경로는 무영향**: `PrintableContent`는 독립 렌더러이고 outline 상태를 받지 않는다(`ProblemView.tsx:297-322`가 blocks를 그대로 넘긴다).
- **공개 페이지의 브라우저 인쇄(⌘P)는 화면 DOM 그대로 나온다** — 공개 뷰어에 앱 인쇄 경로가 없기 때문이다. 구조 보기 상태로 인쇄하면 접힌 채 인쇄된다. **사양으로 둔다**(열람자가 고른 뷰). 문서에만 명기.
- **브라우저 ⌘F는 접힌 텍스트를 찾지 못한다.** outline은 DOM에서 제거하는 방식이므로 `hidden-until-found`류 대안이 없다. 열람 화면에 자체 찾기 기능은 없으므로(FindReplacePanel은 편집창 전용) 실사용 영향은 작다 — 기본값이 full인 근거를 하나 더 보강한다.

---

## 4. P2 — 토글과 개별 여닫이

### 4.1 상태

```ts
const [mode, setMode] = useState<'full' | 'outline'>('full');   // D5
const [openSections, setOpenSections] = useState<Set<string>>(new Set());
const [openCases, setOpenCases] = useState<Set<string>>(new Set());
```

`ProblemView`는 탭이 여러 개이므로 **탭별로** 상태를 가져야 한다 → `Record<tabId, State>` 또는 탭 콘텐츠를 작은 컴포넌트로 분리해 상태를 그 안에 둔다. **후자를 택한다**(`components/problem/TabBody.tsx` 신설) — ProblemView는 이미 1,061행이고 IIFE·인라인 style이 촘촘해 상태를 더 얹기 어렵다.

### 4.2 토글 UI

- **ProblemView**: 라벨 열(`labelColStyle`, 폭 `7 * contentFontSize`px)에 이미 라벨 + 복사 버튼이 있다(`:703-733`). 여기에 **아이콘 버튼 1개**를 같은 행 끝에 추가한다. 폭 실측 필요(15px 기준 105px에 라벨 24 + 복사 22 + 신규 22) — 넘치면 라벨 아래 2행으로 내린다. 텍스트 라벨("구조 보기")은 폭을 초과하므로 `title` 속성으로.
- **공유뷰**: `ProblemTabContent` 최상단에 우측 정렬 1행. 공개 페이지는 발견성이 중요하므로 **아이콘 + 텍스트**("구조 보기")를 쓴다.
- 아이콘: `components/ui/Icons.tsx`에 `IconChevronsDown`(`polyline 6,6 12,12 18,6` + `6,13 12,19 18,13`) / `IconChevronsUp`(상하 반전) 신설. viewBox 24 · strokeWidth 2 · `stroke="currentColor"` — 기존 3종과 동일 규격(E10).
- 공용 컴포넌트 `components/ui/OutlineToggle.tsx`(props: `mode` `onChange` `disabled` `compact`). 앱·공유 양쪽에서 임포트하되 **렌더러는 통합하지 않는다**(D16).
- D14 게이트: `hasOutlineContent()`가 false면 `disabled` + `title="제목·핵심문장·경우 블록이 없습니다"`.

### 4.3 개별 여닫이

- outline 모드에서 제목행 hover → 배경 `var(--bg-hover)` + chevron 회전. 클릭 → 해당 섹션 open/close.
- 경우 제목행도 동일. 하위 경우는 독립 토글.
- full 모드에서는 무반응(D13) — 텍스트 선택·복사와 충돌하지 않는다.
- 전문 섹션(heading 없음): 항목이 있으면 그 위에 "⌄ 앞부분 펼치기" 행 하나(Q4 확정). 항목이 없으면 통째로 숨김이므로 여닫이도 없다.
- 접근성: 제목행 컨테이너에 `role="button"` `tabIndex={0}` `aria-expanded` `aria-controls` + Enter/Space. 실제 `<button>`으로 감싸면 안 된다 — 내부에 `<p>`·KaTeX(MathML 포함)가 들어가 HTML이 무효가 된다.
- 모바일: hover 없는 환경 대비 chevron을 **outline 모드에서 상시 표시**. 탭 = 클릭. 제목행 자체가 타깃이라 최소 높이(44px)는 자연 충족(15px × line-height 1.8 = 27px이므로 **패딩 상하 0.4em 추가로 보정**).
- **스크롤 앵커링(E20)**: 토글 직전 `titleEl.getBoundingClientRect().top`을 기억하고, 상태 반영 후 `requestAnimationFrame`에서 같은 값이 되도록 스크롤 컨테이너를 `scrollBy`한다. 컨테이너는 ProblemView는 U-프레임 div, 공유뷰는 `ScrollColumn` — 각각 ref 1개 추가. 전체 토글(mode 전환)에서는 앵커 대상이 없으므로 보정하지 않는다(높이 급감은 브라우저가 clamp).

### 4.4 하지 않는 것

- 렌더 분기의 공유뷰/앱 통합(D16).
- 애니메이션(`max-height` 트랜지션). Phase 59 범위 밖 — 후속 후보.
- URL·localStorage 영속(D3).

---

## 5. P3 — '경우' 블록

### 5.1 타입·상수

```
types/problem.ts:158        → union에 'case' | 'subcase' 추가 (Phase 57 'list'|'callout' 주석 형식 따라 한 줄 주석)
EditorView.tsx:80-93        → BLOCK_TYPE_LABELS: case '경우', subcase '하위 경우'
EditorView.tsx:96-98        → BLOCK_TYPES: 'callout' 다음에 'case', 'subcase'
EditorView.tsx:101-115      → BLOCK_PRESETS: 둘 다 '' (callout과 동일)
EditorView.tsx:118-120      → TEXT_BASED_TYPES 추가
EditorView.tsx:123-125      → SPLITTABLE_TYPES 추가 (E23 — 분할 산출물은 text라 번호 안전)
```

`BORDERED_TYPES`(5곳 사본)는 건드리지 않는다.

### 5.2 raw_text 규약

```
첫 줄        → 제목행(조건).  예: $a>1$인 경우
둘째 줄부터   → 본문 (마크다운·수식·key 마커 전부 기존 문법)
첫 줄이 빈 줄 → 이어짓기 (D9′): 번호·dot 없이 직전 경우의 연속으로 렌더
```

번호는 raw_text에 넣지 않는다. 기존 문항이 손으로 쓴 "경우 1)" 류는 text 블록 그대로 → 영향 0.

**한계(S4)**: 한 case 블록의 내용은 한 CodeMirror 안이므로 **이미지·SVG·선택지 블록을 경우 안에 담을 수 없다**. 필요하면 `case`(제목행 有) → `image` → `case`(제목행 無 = 이어짓기)로 잇는다. 이것이 D9′의 존재 이유다.

### 5.3 렌더 (5곳) — D15 구조

`callout` 분기 **바로 앞**에 case 계열 분기를 넣는다(E3: 5곳의 공통 앵커).

```tsx
// 5곳 공통 형태. label은 buildCaseLabels(blocks).get(key) ?? null
if (isCaseBlock(block.type)) {
  return (
    <div key={block.id}
         className={['case-block',
                     block.type === 'subcase' ? 'case-sub' : '',
                     label ? '' : 'case-cont'].filter(Boolean).join(' ')}>
      <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko"
                     /* EditorView만: activeMathId·onClickMath 기존 인자 그대로 */ />
    </div>
  );
}
```

`injectCaseLabel`이 만드는 문자열:

```
<span class="case-label">C-2.</span> $a>1$인 경우
본문 첫 줄…
```

- 인스턴스가 하나라 `data-math-id`가 raw_text 전역 순서와 일치한다(E7 해소).
- 인쇄 사이트는 `EditorPreview` 대신 `PrintBlockRenderer`를 쓰지만 주입 문자열은 동일하다(`PrintableContent.tsx:86-90` callout 분기 형태를 그대로 복제).
- 주입은 렌더 시점 한정. `raw_text` 불변(Phase 54 D5와 동일 원칙).

**outline 모드(2곳만)**: 같은 래퍼에 content만 바꿔 넣는다 — `injectCaseLabel(titleLine, label)` + (본문 발췌가 있으면) `\n\n` + 발췌. 개별 펼침 시 full과 같은 경로. 인스턴스는 여전히 하나이고, outline이 있는 2곳은 `onClickMath`를 쓰지 않으므로 수식 매핑 이슈가 없다.

### 5.4 인쇄

`PrintStyles.css`의 callout 3규칙(`:136-143`)과 1:1 대응으로 case 규칙을 만든다. **fleqn override 포함**(E15).

### 5.5 Phase 54 레거시와의 정합

| 대상 | v2 처리 |
|---|---|
| 기존 `**Case 1.**` 문단 / `- **Case 1a.**` 리스트 | **렌더 무변화.** `normalizeCaseBoundaries`·`convertSubcaseMarkers`·불릿 숨김 CSS 전부 유지. 마이그레이션 없음 |
| 구조 보기에서의 취급 | 텍스트로 남기지 않고 **case/subcase 항목으로 승격**(D2′) → 레거시 문항도 구조 보기가 즉시 동작 |
| 신규 저작 | `case`/`subcase` 블록 권장. 레거시 텍스트 규약은 "지원하되 권장 안 함"으로 문서화 |
| 표기 불일치 | 레거시 `Case 1.` ↔ 신규 `C-1.` 공존 가능 → **§10 Q5** |
| 변환 도구 | Phase 59 범위 밖(후속 후보). 자동 변환은 첫 줄 판정·리스트 해체가 필요해 저렴하지 않다 |

---

## 6. P4 — rail · dot (CSS 명세)

값은 전부 **Stage 2 실측 대상**이다. `CLAUDE.md`의 "여백을 논하기 전에 기준선을 실측할 것"에 따라, 아래는 DevTools 확인 전의 출발점이다.

### 6.1 기하 기준

- 좌측 여백 3em(화면) / 2em(인쇄) — callout·`.katex-display`와 동일(`globals.css:291-293`, `:494`).
- **1em을 레일 중심선**으로 삼고 rail·dot이 이를 공유한다(E4).
- dot 세로 위치 = 첫 행 중심 ≈ `line-height 1.8em ÷ 2 = 0.9em`. `.preview-content`가 `line-height: 1.8`을 인라인으로 준다(`EditorPreview.tsx:457`) — 실측으로 확정.
- 하위케이스는 **텍스트만** 한 단 더 들여쓴다(박스는 그대로) → 레일 규칙이 case·subcase 동일(E6′).

### 6.2 화면 (`app/globals.css`, callout 절 다음)

```css
/* ═══ Phase 59 — 경우(case) 블록 ═══
   rail·dot은 1em을 중심선으로 공유한다. 하위케이스는 텍스트만 들여쓰므로
   레일 규칙 3개가 case·subcase에 동일하게 적용된다. */
.case-block {
  position: relative;
  margin: 1.1em 0;        /* K1 (globals.css:447-453) */
  padding-left: 3em;      /* .katex-display(291-293)·.callout-block(494)과 동일 */
  padding-right: 0;       /* \tag float:right 기준선 = 컨테이너 우단 */
}
.case-block.case-sub { padding-left: 6em; }   /* 텍스트만 한 단 더 */

/* rail — 기본: 자기 dot에서 자기 하단까지 */
.case-block::before {
  content: '';
  position: absolute;
  left: 1em; margin-left: -1px; width: 2px;
  top: 0.9em; bottom: 0;
  background: currentColor; opacity: 0.28;
}
/* 연속 구간 브리징 — 형제 마진 collapse(1.1em)를 건너뛴다 */
.case-block:has(+ .case-block)::before { bottom: -1.1em; }
.case-block + .case-block::before      { top: 0; }

/* dot */
.case-block::after {
  content: '';
  position: absolute;
  left: 1em; top: 0.9em;
  transform: translate(-50%, -50%);
  width: 0.5em; height: 0.5em; border-radius: 50%;
  background: currentColor;
}
.case-block.case-sub::after { width: 0.34em; height: 0.34em; opacity: 0.75; }
.case-block.case-cont::after { content: none; }    /* 이어짓기 — dot·번호 없음 */

/* 라벨·제목행 */
.case-label {
  margin-right: 0.4em;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
.case-block p:has(> .case-label:first-child) { font-weight: var(--weight-medium); }  /* E22 */
/* 이중 들여쓰기 방지 — callout(502) 전례 */
.case-block .katex-display { padding-left: 0; }
```

**D17 종단 전환**: 레일을 "마지막 dot에서 끊기"로 바꾸려면 아래 1규칙만 추가한다.

```css
.case-block + .case-block:not(:has(+ .case-block))::before { bottom: auto; height: 0.9em; }
```

`:has()`는 이 코드베이스가 이미 광범위하게 쓴다(`globals.css:333, 354, 371, 478-487`) → 지원 전제 동일.

### 6.3 톤 가드 (E17) — Phase 58 h1~h3 가드와 1:1

```css
/* 케이스 제목행은 구조 신호다. has-key 여부와 무관하게 현행 색에 고정한다.
   근거·형태는 globals.css:271-283(제목 가드)과 동일. */
.solution-tone.has-key .case-label,
.solution-tone.has-key .case-block p:has(> .case-label:first-child) { color: var(--text-secondary); }
/* 제목행 안 수식도 현행(primary) 유지 — .solution-tone.has-key .katex(0,3,0)를 이겨야 한다.
   아래 선택자는 (0,5,1)이라 특이도로 이긴다. */
.solution-tone.has-key .case-block p:has(> .case-label:first-child) .katex { color: var(--text-primary); }
```

제목행 안에 `**`를 쓰면 `.solution-tone.has-key strong`(0,3,0)이 그 부분만 primary + 600으로 올린다 — 의도된 동작.

### 6.4 하위케이스 dot 위치 — Stage 2 판정 항목

기본값은 "부모 레일 위 작은 dot + 텍스트 6em"이다. dot↔텍스트 간격이 5em(15px 기준 75px)이라 멀어 보일 수 있다. 실물 문항에서 판정하고, 멀면 둘 중 하나를 택한다.

- (a) 들여쓰기를 6em → **5em**으로 줄인다(1줄).
- (b) dot을 들여쓴 위치(4em)로 옮기고 레일↔dot 사이 수평 tick을 제목행 `p::before`로 그린다(3줄, 가상요소 예산 안에 들어간다 — `.case-block::after`를 tick으로 전용).

### 6.5 인쇄 (`components/print/PrintStyles.css`, callout 절 다음)

```css
.print-body .case-block {
  position: relative;
  margin: 11pt 0;          /* K1 인쇄 (137행과 동일) */
  padding-left: 2em;       /* 인쇄 fleqn 들여쓰기(24행)와 동일 */
  padding-right: 0;
}
.print-body .case-block.case-sub { padding-left: 4em; }
.print-body .case-block::before {
  content: ''; position: absolute;
  left: 0.7em; width: 0.25mm; top: 0.9em; bottom: 0;
  background: #000; opacity: 0.55;
}
.print-body .case-block:has(+ .case-block)::before { bottom: -11pt; }
.print-body .case-block + .case-block::before      { top: 0; }
.print-body .case-block::after {
  content: ''; position: absolute;
  left: 0.7em; top: 0.9em; transform: translate(-50%, -50%);
  width: 0.42em; height: 0.42em; border-radius: 50%; background: #000;
}
.print-body .case-block.case-sub::after { width: 0.3em; height: 0.3em; }
.print-body .case-block.case-cont::after { content: none; }
/* 제목행 고아 방지만 — break-inside는 걸지 않는다(경우는 길 수 있다, callout과 반대 판단) */
.print-body .case-block p:has(> .case-label:first-child) { break-after: avoid; font-weight: 600; }
/* ⚠ fleqn override 필수 (E15) — 없으면 이중 들여쓰기 */
.print-body .case-block .katex-display.fleqn > .katex { padding-left: 0 !important; }
```

인쇄 색은 `#000` 고정이다 — has-key 복원 규칙(`PrintStyles.css:48-49`)이 `color: inherit`을 쓰므로 `currentColor` 레일은 회색 톤을 물고 갈 위험이 있다. 명시값이 안전하다.

### 6.6 callout과의 구별

callout(들여쓰기만)과 case(들여쓰기 + rail + dot + 라벨)는 좌측 기준값을 공유한다. **강조의 두 축은 독립**이라는 Phase 58 D13이 그대로 유지된다 — case는 세 번째 축(구조)이다. 나란히 둔 실제 문항에서 리듬이 유지되는지 Stage 2에서 확인.

---

## 7. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 제목·key·경우 전무 | D14 게이트로 토글 비활성 |
| key 마커가 경우 제목행에 있음 | 제목행은 항상 표시 → 발췌는 본문(둘째 줄 이후)만 |
| 상위 case 없는 subcase | `C-1-a`로 렌더 + 편집창 미리보기 경고. 데이터 불변 |
| 이어짓기 블록이 런의 첫 블록 | dot 없고 레일이 top 0.9em에서 시작 → 부모 없는 레일 조각. 편집창에서만 흐린 경고 |
| 경우 사이에 일반 블록 | 번호 유지(D10). 레일은 끊긴다(`+ .case-block` 인접 조건 불성립) — **의도**: 경우 밖 문단임을 시각적으로 알린다 |
| 경우 안 display 수식·리스트·① 밭 | 기존 K1 규칙이 그대로 적용. 이중 들여쓰기 override만 확인 |
| 경우 안 `\tag{n}` | `padding-right: 0`으로 float 기준선을 컨테이너 우단에 맞춤(callout 전례, `globals.css:495`) |
| ⌘B 분할 | 뒤 블록은 `text`(E23) → 번호 안전 |
| Undo/Redo | additive라 기존 배선이 커버(Phase 57 A-14). outline 상태는 undo 대상 아님 |
| 저장 후 재로드 | outline 상태는 비영속. `openSections` 키는 `block_key` 우선(E9) |
| 공개 문항의 ⌘P·⌘F | §3.4 — 사양으로 문서화 |
| 톤 시스템 dim | rail·dot이 `currentColor`라 함께 흐려진다(의도). 과하면 opacity 재보정(Stage 2) |

---

## 8. 파일 목록 (좌표 실측 완료 · `459cbcb` 기준)

```
# 신설
lib/caseBlock.ts                          buildCaseLabels · splitCaseTitle · injectCaseLabel · letters
lib/solutionOutline.ts                    buildOutline · hasOutlineContent · extractKeySentences
components/ui/OutlineToggle.tsx           공용 토글 (앱·공유 공유, 렌더러는 통합 안 함)
components/problem/TabBody.tsx            ProblemView 탭 본문 + outline 상태 (§4.1)

# 수정
types/problem.ts:158                      union에 'case' | 'subcase'
lib/keyTone.ts:21                         KEY_STRONG_RE export + g 플래그 변형 추가
components/ui/Icons.tsx:148 이후          IconChevronsDown · IconChevronsUp
components/editor/EditorView.tsx:80-125   상수 5곳
components/editor/EditorView.tsx:3219     callout 분기 앞에 case 분기
components/problem/ProblemView.tsx:385    callout 분기 앞에 case 분기
components/problem/ProblemView.tsx:693-755 탭 행 → TabBody 위임 + 토글
components/problem/FolderView.tsx:288     callout 분기 앞에 case 분기 (접기 없음)
components/share/ProblemTabContent.tsx:57 callout 분기 앞에 case 분기 + 토글 + outline
components/print/PrintableContent.tsx:86  callout 분기 앞에 case 분기
lib/version/exportMd.ts:67                블록 주석에 라벨 동봉 (D18)
app/globals.css:503 이후                  .case-block 일체 + 톤 가드 + .outline-keys
components/print/PrintStyles.css:144 이후 인쇄 .case-block 일체 (fleqn 포함)
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0**(E19′). P3~P4(경우 블록)와 P1~P2(구조 보기)는 상호 독립 배포 가능하지만, 구조 보기가 경우 제목행을 항목으로 쓰므로 **경우 블록 먼저**가 자연 순서다.

---

## 9. 구현 순서 (Stage)

**Stage 0** — v1의 T0는 v2 작성으로 완료. 착수 시 `git log -1`이 `459cbcb` 이후로 움직였는지만 확인하고, 움직였으면 §8 좌표를 재확인한다.

**Stage 1 · P3 경우 블록** — 타입·상수·5곳 분기·라벨 계산·라벨 주입.
검증: 경우 3개 + 하위 2개 문항에서 `C-1`~`C-3`·`C-2-a`·`C-2-b` / 삽입·삭제·순서 변경 후 재계산 / 이어짓기(첫 줄 빈 블록) 번호·dot 억제 / 상위 없는 subcase 경고 / 저장→재로드 / undo 복원 / ⌘B 분할이 `case + text`를 만드는지 / **편집창 미리보기에서 제목행·본문 수식을 각각 클릭해 올바른 편집 위치로 가는지(E7 회귀 테스트)** / 편집창 전체접기에서 "경우 · 제목행" 요약(E24).

**Stage 2 · P4 시각** — rail·dot·들여쓰기, 화면 + 인쇄.
검증: 스케치와 나란히 육안 대조 / 연속 case·case→subcase·subcase→case·런 마지막 4경계의 레일 연속성 / D17 종단 두 안 비교 / §6.4 하위 dot 간격 판정 / callout과 나란히 둔 리듬 / 경우 안 display 수식·리스트·① 밭·`\tag` / **인쇄 fleqn 이중 들여쓰기 없음** / 인쇄 흑백 / has-key 상태에서 제목행·제목행 수식이 dim되지 않음(E17).

**Stage 3 · P1 구조 보기 (ProblemView)** — 섹션 모델 + 토글 + 스켈레톤.
검증: 접기 → 제목·발췌·경우 제목행만 / 펼치기 → 픽셀 동일 / D14 게이트 / 전문 섹션 / key 없는 섹션 통째 숨김 / **레거시 `**Case 1.**` 문항이 라벨 도배 없이 구조로 뜨는지(D2′)** / 문제 탭에 토글이 없는지(D4′) / 발췌가 primary + 600인지.

**Stage 4 · P2 개별 여닫이** — hover·클릭·접근성·스크롤 앵커링.
검증: 섹션·경우·하위경우 독립 토글 / full 모드 무반응 / 모바일 탭·chevron 상시 표시 / 키보드·`aria-expanded` / **토글 전후 클릭 지점 y 유지**.

**Stage 5 · 공유뷰** — ProblemTabContent 적용.
검증: 1단·2단(`twoColumn`) 양쪽에서 토글 위치 / `/p`(실시간)·`/shared`(스냅샷) 동작 동일 / 기존 공개 문항(경우 없음) 무변화 / 공개 페이지 줄바꿈 무변화(D14 `.tone-baseline` 원칙 유지).

**Stage 6 · 통합·문서** —
- `roadmap.md` 갱신, Phase 59 phasedocs 등록.
- `docs/phasedocs/사용 가이드 — 강조와 톤.md`에 "핵심문장 마커는 문장 전체 단위" 한 줄(§3.2).
- **`CLAUDE.md` 정정 3건**: ① 블록 타입 목록에 `case·subcase` ② "분기 순서는 5곳 모두 …" → 사이트별 차이 명기(E3) ③ 전처리 파이프라인 표기에 `normalizeCaseBoundaries`·`convertSubcaseMarkers` 누락 보완(`lib/preprocess.ts:196-197`).
- Phase 54 문서에 "D4의 한글화 미결은 Phase 59 D8로 결정됨" 한 줄 추가.

---

## 10. 확인 사항

v1의 Q1~Q4는 **확정 유지**. Phase 54 발견으로 새로 생긴 질문 하나만 남는다.

| # | 질문 | 기본값(이대로 진행 가능) | 대안 |
|---|---|---|---|
| **Q5** | 레거시 `Case 1.` 표기와 신규 `C-1.` 표기가 한 문서에 섞일 수 있다. 어떻게 할까 | **`C-1.` 유지 + 레거시 렌더 무변화.** 신규 저작만 블록을 쓰고, 표기 혼재는 문항 단위로 자연 정리된다 | (a) 신규 표기도 `경우 1.`로 해 한글 라벨과 맞춘다 (b) 레거시 `Case n.`도 렌더 시 `C-n.`으로 표기 통일한다(전처리 1줄, 다만 기존 문항 화면이 바뀐다) |

---

## 부록 A. v1 대비 폐기·대체된 설계

| v1 | v2 | 이유 |
|---|---|---|
| `case-title` / `case-body` 2-div | 단일 EditorPreview + 라벨 span 주입 | 수식 클릭 매핑 파괴(E7) |
| 하위케이스 inner rail + `::after` 부모 레일 | 부모 레일 단일화, 하위는 dot 크기·들여쓰기로 구분 | 가상요소 예산·경계 붕괴(E6·E6′) |
| 음수 `top`/`bottom` 브리징 | margin collapse 기반 3규칙 | 유지 불가(E6) |
| `.outline-keys` dim 무효화 CSS | 불필요(마커 유지 → strong 자동 복귀) | E17 아님, §3.3 |
| `margin: 1.5em` | `1.1em` / `11pt` | K1(E2) |
| lucide 아이콘 | Icons.tsx 자체 SVG 2종 신설 | 의존성 없음(E10) |
| "전체 접기/펼치기" 명칭 | "구조 보기 / 전체 보기" | 편집창 기능과 충돌(E11) |
| 공유·앱 렌더러 통합 | 로직·토글만 공유 | 공유뷰엔 svg·ggb 분기가 없다(E3·D16) |

## 부록 B. 로드맵 메모

- 의존: Stage 1(경우) → Stage 3(구조 보기). Phase 58은 이미 배포 완료(E13).
- 후속 후보: 레거시 `Case` 텍스트 → 블록 자동 변환 도구 · 펼침 애니메이션 · EditorView 미리보기 구조 보기 · FolderView 적용 · 구조 보기 상태 URL 공유 · callout B안(`>> `) 문법과 경우 제목행 문법 통합 검토 · **Phase 58 P6 긴 display 수식 접기**(별건, 우선순위 미정).
- Phase 번호 **59** (phasedocs 55·55a·55b·55c·56·57·58 다음).
