# Phase 59a — Case 블록 레이아웃 체계 수정 · 강조 체계 정비 (**v5 최종 확정판**)

작성일: 2026-08-21 · 검증 기준: fdeac85(계획 기준) + **bc7004e(구현) + 733f0fa(HEAD, 인쇄 검수)** · 작성: web(v4 전건 3차 검증 + 구현 대조)
문서 계보: v1(web, 방향) → v2(CLI, 실측 C1~C17) → v3(web, 재검증 F1~F6) → v4(CLI, 재검증 + 착수판) → **v5(web, 3차 검증 + 구현 대조 확정)**

> **판정: 구현 완료 — v4 사양과 전 항목 일치. 이 문서로 Phase 59a 계획 계보를 종결한다.**
>
> **v5의 핵심 사실(H1): v4는 '착수판'이지만, 검증 시점의 main에는 구현이 이미 올라가 있다.**
> `fdeac85`(v4 기준 커밋) → **`bc7004e` "Phase 59a: Case 레이아웃 거터 이주 · 강조 체계 정비"(구현)**
> → **`733f0fa` "docs: Phase 59a 인쇄 검수 …"(HEAD)**. 따라서 v5는 착수판의 4차 수정이 아니라
> **① v4 판정의 3차 독립 검증 + ② 구현이 사양과 일치하는지의 전수 대조**를 수행한 확정판이다.
>
> - **v4의 판정은 전건 타당하다** — F1 특이도 검산 독립 재계산 일치 · F2 기각(G1) 실물 확인 ·
>   F3 좌표 실측 일치 · G2 인벤토리 정확 (§0-2).
> - **구현은 v4 사양을 전 항목 충실히 따랐고**, Stage 5 산출물(CLAUDE.md·사용 가이드·별건 C-1·
>   확정 문서)까지 전부 반영되어 있다 (§0-3).
> - 신규 확인 H3~H6: 소스 순서 의존의 **실재 사이트 특정**(H3) · 좌표 드리프트(H4) ·
>   테스트 실물(H5) · 잔여 작업 0(H6).

---

## 0. v5 검증 결과

### 0-1. 검증 방법 (H1)

레포를 두 시점으로 대조했다: **계획 시점 `fdeac85`**(v4의 모든 좌표·주장 검증)과 **HEAD `733f0fa`**(구현 결과 대조). v4가 "실측"이라 적은 항목을 전부 독립적으로 다시 열어 확인했고, 특이도 검산은 문서를 보지 않고 재계산한 뒤 대조했다.

### 0-2. v4 판정의 3차 검증 — **전건 승인**

| v4 항목 | v5 판정 | 독립 확인 내용 |
|---|---|---|
| **F1 검산** (v2 C6 처방 기각, `:where()` 채택) | **승인** | 독립 재계산 일치: `.solution-tone.solution-tone .katex`(0,3,0)는 클래스 수 3 > 2로 강조 안 수식(0,2,1)·제목 안 수식(0,2,1)을 죽인다. `:where()` 기준선(0,1,0)은 dim(0,2,0)에 지고, 복귀(0,2,1)는 dim을 이기고, 인쇄(0,3,0)는 순서 무관 승리 — v4 §0-2 표와 완전 일치 |
| **F2 기각 / G1** (가이드 파일명) | **승인** | `git ls-tree fdeac85 docs/phasedocs/` 실물: `사용 가이드 — 강조와 톤.md` 존재, `강조와 키` 부재. (구현 후 파일 내부 H1은 "강조와 **요약**"으로 개정됨 — 파일명은 유지, §0-3) |
| **F3 좌표** (PrintStyles 삭제 대상) | **승인** | fdeac85 실측: case padding **163-164** · `.case-sub` **167** · `.case-gap` **168** · `.case-gap-body` 3규칙 **170-173** 전부 일치. fleqn override는 `@media print`:24 · callout:151 두 곳뿐 — case 절 부재 확인 |
| **F5 산술** (EditorView 채널) | **승인** | 현행(fdeac85) `width: calc(35em+64px)` · `marginLeft:24` · `padding:'20px 32px'` 실측 일치. 24 + 3.5em@15px(52.5) = 76.5px ≠ 80 — v4의 근거 교체가 옳다 |
| **F6** (`.outline-chevron` base) | **승인** | fdeac85 globals **752-758**: `display:inline-flex; align-items:center`뿐, `justify-content` 부재 확인 |
| **G2** (`.katex` color 전수 7건) | **승인 — 정확** | fdeac85 globals에서 `.katex`에 color를 주는 규칙 = **262 · 288 · 292 · 314-316 · 673** — v4 목록과 자리까지 일치. `.problem-content-toned .katex`(331-336)는 font-size만(G9 뒷받침) |
| **G5** (`caseGapClassName` 시그니처 유지) | **승인** | fdeac85: `GAP_MEDIA_TYPES` 분기 실존(:155-165) → HEAD: `(type: string)` 시그니처 유지한 채 `'case-gap'` 상수 반환(:167-169) — 사양대로 |
| **G6** (`padding-right: 0` 동반 삭제) | **승인** | fdeac85 globals 571 · PrintStyles 164에 짝 실존 확인 → HEAD에서 소멸 |
| **G7** (EditorView em 기준 일치) | **승인** | 외곽 열(`fontSize: contentFontSize`)이 width·paddingLeft의 공통 base — fdeac85·HEAD 양쪽 확인 |
| **G3 · G8 · G9 · G4** | **승인** | G3: 케이스 가드(0,5,1) > 인쇄 복원(0,3,0) — 논리 재계산 일치. G9: CLAUDE.md:115에 정정 반영 확인. G4: 무효 규약 목록 전량 CLAUDE.md 개정 확인(§0-3) |

### 0-3. 구현 대조 (H2) — v4 사양 vs `bc7004e`~HEAD, **전 항목 일치**

| 사양(v4) | 구현 실물(HEAD) | 판정 |
|---|---|---|
| `--case-rail-x: -1.8em` · `--case-chevron-x: -0.7em` | globals **:177-178** | ✓ |
| 기준선 `.tone-baseline :where(.katex)` (F1) | globals **:295** (계획 시점 262에서 이동 — H4) | ✓ |
| `.has-key` 소멸 · doubling 금지 | globals·PrintStyles 전량 소멸, 주석 특이도 재기술(globals:310, PrintStyles:45) | ✓ |
| `.outline-keys` 절 삭제 | 소멸 + 폐기 사유 주석(globals:760) | ✓ |
| rail `left: var(--case-rail-x)` + `margin-left:-0.5px` 헤어라인 유지 | globals:674, 699 | ✓ |
| `.problem-card` rail·dot 미표시 3줄 (Q5) · FolderView.tsx 무변경 | globals:728-730 | ✓ |
| chevron base `justify-content:center` + svg 0.8em (F6·C5) | globals chevron 절 (주석에 -0.7em 열 정렬 명시 :766) | ✓ |
| `keyTone.ts` 축소: RE 2종·`solutionHasKey` 삭제, `toneClass(tabId)` 단일 인자 | keyTone.ts:33-34 + 폐기 사유 주석(:12) | ✓ |
| `solutionOutline.ts` keys 계열 삭제 · 스캔 축소 · `SCANNED_TYPES`에 coach 2종 | :21 주석, :74 | ✓ |
| OutlineSections keys·firstCase/lastCase 삭제 | :115-116 주석과 함께 소멸 | ✓ |
| 라벨 '들여쓰기'·'글상자' | EditorView:91, :101 (사유 주석 포함) | ✓ |
| 버튼 `'강조 (**…**)'` | UnifiedToolbar **:800** (계획 시점 798 — H4) | ✓ |
| 요약 스위치: heading·case 계열 비노출 (R5) | EditorView:753 `isHeading || isCaseBlock(block.type) ? null : …` | ✓ |
| EditorView 미리보기 `padding '20px 32px 20px 3.5em'` · `width calc(38.5em+32px)` · `marginLeft 24` (Q3) | EditorView:3367, 3371 (실측 착지값 주석 :3358) | ✓ |
| TabBody `LABEL_GAP = 2.8 * contentFontSize` (Q6) | `LABEL_GAP_EM = 2.8` + em/px 함정 경고 주석 | ✓ |
| 코칭 블록: 타입 2종·라벨·아이콘·토큰 `#6639ba`/`#a40e26`·인쇄 흑백 바 | types/problem.ts:162 · Icons.tsx:489,501 · globals:187,608-615 · PrintStyles:158-174 (`--coach-accent: #000`) | ✓ |
| 인쇄 rail -1.2em (Q4) | PrintStyles:177-178 (12pt≈4.23mm 근거 주석까지) | ✓ |
| CLAUDE.md 무효 규약 개정 (G4 목록) | 전량 반영 — `#E8DFCE`·3.28 정정(:114), G9 정정(:115), 블록 타입 목록(:131), 4분법·'강조' 낱말 규약(:134), 코칭 규약(:136), dot 3.28(:155) | ✓ |
| 사용 가이드 전면 개정 (4분법 + 이어짓기 우회로) | `사용 가이드 — 강조와 톤.md` 개정 완료 — H1 "강조와 요약", "네 가지 장치가 각각 한 가지 일만 한다" | ✓ |
| 별건 C-1 (FolderView 페이드) | `rgba(232,223,206,0)` 수정 완료(:603) | ✓ |
| 테스트 개정 (C8) | `tests/caseBlock.test.mjs` keys 발췌 테스트 재편 — 아래 H5 | ✓ |
| Phase 문서 | `docs/phasedocs/Phase59a Case 레이아웃·강조 체계 정비.md` 확정본 존재 | ✓ |
| 인쇄 검수 (Stage 3·G3 포함) | HEAD 커밋 `733f0fa` "docs: Phase 59a 인쇄 검수" | ✓ |

**불일치 0건.** 구현이 사양에서 이탈한 곳을 찾지 못했다.

### 0-4. 신규 확인 (H3~H6)

| # | 내용 |
|---|---|
| **H3** | **§0-2 "잔여 소스 의존 1건"은 관념적 안전판이 아니라 실제 구속이다.** `.tone-baseline`과 `.solution-tone`이 **같은 요소**에 함께 붙는 사이트가 실존한다 — TabBody:242 (`"… tone-baseline ${toneClass(tab.id)}"`) · ProblemTabContent:125 (동일 패턴). 이 두 곳에서 글자색 동률(0,1,0) vs (0,1,0)은 오직 **같은 파일 안 절 순서**로 dim이 이긴다. (EditorView는 두 클래스가 다른 요소라 근접성으로도 dim — 순서 무관.) → v4가 못 박은 "§3-3 절 순서를 바꾸지 말 것" 주석은 유지 필수. 삭제·리팩터링 금지 |
| **H4** | **좌표 드리프트 — 오류 아님.** v4의 좌표는 fdeac85 기준으로 전부 정확했고, 구현 커밋이 주석을 늘리며 이동했다: 기준선 262→**295** · UnifiedToolbar 798→**800** · EditorView 미리보기 3345→**3367** 등. 이후 이 문서를 참조할 때는 **HEAD 좌표(§0-3 표)** 를 쓸 것 |
| **H5** | **테스트 실물이 계획을 상회한다.** v4는 "27 → 약 23~24개"로 예상했으나 HEAD의 `caseBlock.test.mjs`는 `test(` 35개 — 발췌 폐기를 못 박는 회귀 가드(`assert.equal(item.keys, undefined)` :186)와 레거시 `**Case n.**` 승격 검증이 추가됐다. 계획 대비 증가는 **개선**이며, "keys가 다시 생기지 않는다"를 테스트가 지키는 구조가 됐다 |
| **H6** | **잔여 작업 0.** v4 §6 Stage 1~5의 산출물을 전수 추적한 결과 미반영 항목 없음. 이 계획 계보(v1~v5)는 여기서 종결하고, 이후의 사실 원천은 `docs/phasedocs/Phase59a Case 레이아웃·강조 체계 정비.md`(확정본)와 CLAUDE.md다 |

---

## 1. 확정 사양 (v4 §1~§7 — 구현 반영 완료, 기록으로 보존)

이하는 v4의 사양 본문이다. **전 항목 구현 완료**(§0-3)이므로 수정 없이 보존하되, 좌표는 fdeac85 기준임을 유의할 것(H4).

### 1-1. Case 블록 레이아웃 (v4 §1)

- rail·dot·chevron을 본문 왼쪽 바깥 거터로 이주: `--case-rail-x: -1.8em` · `--case-chevron-x: -0.7em`. 경우·하위 경우 본문 좌단 = 일반 텍스트와 동일한 **0**. 2단 들여쓰기 체계(3/6em, 인쇄 2/4em)·`.case-gap-body`·케이스 내부 ul/① override(`!important` 2건 포함)·`padding-right:0` 짝(G6) 전량 삭제.
- chevron: base에 `justify-content:center`(F6) + `svg 0.8em`(C5), `.case-head .outline-chevron`은 `width:1em; left:calc(var(--case-chevron-x) - 0.5em)` — 두 chevron 열이 -0.7em 한 열에 픽셀 정렬.
- 하위 경우 구분은 dot 크기(0.52/0.3em) + 라벨(C1/C1a)로만 (Q1).
- 사이트별 여백: ProblemView `LABEL_GAP = 2.8 * contentFontSize`(Q6) · EditorView `padding-left 3.5em`, `width calc(38.5em+32px)`, `marginLeft 24` 유지(Q3·F5) · 공유 ContentCard 좌 40px, `maxWidth calc(35em+76px)` · FolderView 카드는 rail·dot 미표시 CSS 3줄(Q5, 확대 적용 금지) · 인쇄 rail -1.2em(Q4).
- `caseGapClassName`은 상수 `'case-gap'` 반환, 시그니처 유지(G5).

### 1-2. 명칭 (v4 §2)

callout '강조문'→**'들여쓰기'**, box '빈 글상자'→**'글상자'**. UI 라벨만 — 타입 id·CSS 클래스·DB 불변. '강조'라는 낱말을 레이아웃 장치에서 퇴출(R2).

### 1-3. 강조·요약·톤 (v4 §3)

- 4분법: 들여쓰기 블록=**위치** · `**`=**색·굵기** · 코칭 블록=**신호** · '요약에 넣기'=**요약 구성**.
- 버튼 `'강조 (**…**)'`. 요약 보기의 `**` 발췌 전면 삭제(keys 계열 코드·CSS·테스트 단언 일괄).
- **톤 기본화(F1)**: has-key 조건 제거. 기준선을 `.tone-baseline :where(.katex)`(0,1,0)로 낮추고 dim은 (0,1,0)/(0,2,0) 그대로 — 복귀 규칙 3군(강조·제목·케이스 가드)과 인쇄 복원이 전부 순서 무관 승리. 유일한 소스 순서 의존은 글자색 동률 1건이며 **실재 사이트 2곳**(H3) 때문에 절 순서 주석을 유지한다.
- 의도된 외관 변화(Q7): `**` 없는 풀이의 본문 소폭·수식 대폭 dim. 과하면 `--tone-dim: #5D5647` 토큰 1줄 폴백.
- '요약에 넣기'는 블록 단위로만: 자동 포함 = 제목·경우·하위 경우 제목행, heading·case 계열은 스위치 비노출(R5).

### 1-4. 코칭 블록 (v4 §4)

additive 타입 `coach_important`·`coach_caution` — Firestore 규칙 0·마이그레이션 0·서버 0. 구조 = 바 0.25em + 안쪽 패딩 1em(들여쓰기 아님 — 글상자 규약) + 아이콘·라벨 제목 줄. 색 `#6639ba`/`#a40e26`(카드 배경 `#E8DFCE`에서 5.55/5.95 — 부록 A). 라벨 식별은 색이 아니라 **아이콘 + 600 굵기**(dim 대비 1.2:1뿐). 톤: 본문 dim·라벨/바/아이콘 톤 불변. 인쇄: 바 `#000` 0.3mm + 라벨 700, `break-inside` 없음·제목 줄만 `break-after: avoid`. 요약 자동 포함 없음.

### 1-5. 결정 사항 종결 (v4 §7)

Q1~Q8 전부 확정값으로 구현 완료. 폴백은 하나도 발동하지 않았다 (Stage 검증에서 문제 미발견 — 인쇄 검수 `733f0fa` 포함).

---

## 부록 A. 명암비 (배경 `#E8DFCE` · v2 산출, v3·v4·v5 3중 확인)

| 전경 | 클레이 `#F4EFE7` | **카드 `#E8DFCE`** | 공유 `#FEFDFB` | 백지 |
|---|---|---|---|---|
| GitHub Important `#8250df` | 4.41 | **3.81 ✗** | 4.96 | 5.05 |
| **채택 `#6639ba`** | 6.42 | **5.55 ✓** | 7.22 | 7.34 |
| GitHub Caution `#cf222e` | 4.68 | **4.05 ✗** | 5.27 | 5.36 |
| **채택 `#a40e26`** | 6.87 | **5.95 ✓** | 7.74 | 7.87 |
| `--tone-dim #675F52` (참고) | 5.50 | **4.76 ✓** | 6.19 | 6.30 |
| `--case-dot #BC5F3F` (참고) | 3.79 | **3.28 ✓** (여유 0.28) | 4.26 | 4.33 |

## 부록 B. 문서 계보 (종결)

| 버전 | 작성 | 방법 | 산출 |
|---|---|---|---|
| v1 | web | 레포 클론 대조 | 방향·구조·R1~R8 진단, Q1~Q4 |
| v2 | CLI | 레포 전수 실측 | C1~C17 · Q5~Q7 확정 |
| v3 | web | v2 재검증 | F1(C6 처방이 복귀 규칙을 죽인다) · F3·F5·F6 보정 |
| v4 | CLI | v3 재검증 + 착수판 | F1 기계 검산 확정 · F2 기각(G1) · G2~G9 · 착수 판정 |
| **v5** | **web** | **v4 3차 검증 + 구현 대조** | **v4 전건 승인 · 구현 대조 불일치 0 · H3(순서 의존 실재 사이트) · H4~H6 · 계보 종결** |

이번 회차의 교훈 둘. ① v4의 것을 계승한다 — 특이도 조정은 "그 규칙이 이기는가"만이 아니라 "그 규칙을 이겨야 하는 규칙들이 여전히 이기는가"까지 전수로 본다. ② v5의 추가 — **교차검토 문서는 기준 커밋을 명시하고, 검토 시점의 HEAD와 대조부터 한다.** 착수판을 받아 든 시점에 구현이 이미 끝나 있을 수 있다(이번이 그랬다). 계획 좌표는 계획 커밋에서만 유효하고, 확정판은 as-built 좌표로 말해야 한다.
