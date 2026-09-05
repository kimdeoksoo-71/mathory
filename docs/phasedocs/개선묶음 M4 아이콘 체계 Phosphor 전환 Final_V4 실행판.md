# 개선묶음 M4 — 아이콘 체계 Phosphor 전환 Final_V4 실행판

> 계보: 덕수 결정사항 메모(2026-09-05) → v1 web → v2 CLI 실측 교차검토 → v3 web 재검증·덕수 확정(N5~N8) → **Final_V4 CLI 재검증·착수판(2026-09-06)**. 이 문서가 유일한 기준이다 — v1~v3을 인용하기 전에 §9를 볼 것.
> 기준: origin/main **097f2eb** · `@phosphor-icons/core` **2.1.1** 실물 대조.
> **Final_V4 검증(CLI 실측)**: v3 신규 주장 전항 통과 — ① `TRIGGER_ICON` 맵 실물(`VersionTimeline.tsx:8-12` `editor_exit: IconExit`, `:93` `<TriggerIcon size={14}/>`) ② `require.resolve('@phosphor-icons/core/assets/regular/trash.svg')` 성공 ③ `sign-out` 실재·단일 path(대안 `door-open`·`arrow-square-out`도 실재 — 기각 근거 유효) ④ CoachLabel 단일 아이콘(17px) ⑤ `build`=`next build`·`prebuild` 없음·`.github/workflows` 없음 ⑥ AIBrandIcon 12/14/16 ⑦ 삭제 10종 단어 경계 grep 소비처 0. **v3 → V4 내용 변경 0**(§4-1 문안 1건 — "3단계 위"를 dirname 기준 2단계로 정리).
> **§10이 구현·검수 기록이다** — 구현 6커밋(2026-09-06) · 덕수 검수 전항 통과(2026-09-06). 중간 판본 v1~v3은 `docs/phaseSketch/`에 있다.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 문제의식(덕수) | EditorView 2행 툴바의 코너 브라켓이 **복잡한 모양으로 시각적 피로**를 주고 **직관적 인식 효율**을 떨어뜨린다. 브라켓을 없애고 아이콘을 단순화한다 — macOS 아이콘의 단순명료함을 **합법적인 선 안에서** 따른다 |
| 실측 | Row 2에 브라켓 아이콘 12종 × 8획 = **96개의 짧은 회색 선**이 글리프와 같은 굵기(≈1.2px)로 한 줄에 놓인다. 글리프는 64칸 중 안쪽 32칸만 쓰므로 22px 아이콘의 실제 그림은 ≈11px. 브라켓은 이미 일관된 체계도 아니다 — 같은 Row 2의 Undo·Redo(Icons.tsx 24·1.8)·Σ 트리거·BlockBottomToolbar·`IconSearchPlain`은 모두 브라켓 없이 나갔다 |
| 결정(덕수) | ① **Phosphor regular** 단일 ② 대안 도안 6종(D5) ③ IconSave 유지(D6) ④ 블록 수식 = `currency-dollar-simple` 가로 축소 ×2(D7) ⑤ 블록 분할 `split-vertical`(N1) · † 잔존은 컨택트시트 판정(N2) · `icons:check` prebuild(N3·N6) · **IconExit → `sign-out`**(N5) · 6개 스택 배포 후 착수(N7) · 미사용 판별 단어 경계 grep 규약(N8) |
| 범위 | `Icons.tsx` 실사용 **38종**(미사용 **10종** 삭제 + 죽은 import 1건 제거) + Row 2 툴바(브라켓 12종 + Σ + Undo·Redo) + 라이브러리 밖 인라인 SVG 9곳 + `AIBrandIcon` verify 폴백 + `VersionTimeline` 트리거 맵. **서버 0 · 규칙 0 · 스키마 0 · 프롬프트 0 · 로직 테스트 무접촉.** 순수 프런트 시각 변경 |
| 방식 | `@phosphor-icons/core@2.1.1`(MIT) **devDependency 고정** + 생성 스크립트 → `components/ui/phosphorPaths.ts`(path 문자열만, 커밋). 자산은 **`require.resolve` + fs 읽기**(§4-1). 런타임 의존 0 · `currentColor` 유지 · 컴포넌트 이름·props 불변 → 호출부 수정은 크기 숫자 ~22곳 + † 판정 7곳 + 사본 2곳 |
| 라이선스 | Phosphor — MIT. `THIRD_PARTY_LICENSES.md` 신설 + 생성 파일 헤더 고지. SF Symbols는 참고만 |

---

## 1. 현황 — 실측 (097f2eb)

### 1-1. 아이콘 계열이 넷으로 갈라져 있다

| 계열 | 규격 | 자리 | 시각 획(대표 크기) |
|---|---|---|---|
| A. `Icons.tsx` | viewBox 24 · stroke 1.8/2(대다수) · 0.9·1.4·1.6·2.5(소수) | 앱 전역 **38종** 실사용 · JSX 호출 125~127곳 | 14px에서 1.05~1.17px |
| B. 툴바 브라켓 계열 | viewBox 64 · stroke 3.5 + `CORNER_BRACKETS` | Row 2 12종(UnifiedToolbar) · CommentEditor OCR 사본 1 | 22px에서 1.2px |
| C. 브라켓 없는 64 글리프 | viewBox 64 · stroke 4 | BlockBottomToolbar 3종(15px) | 0.94px |
| D. 로컬 사본 | 24 · stroke 2 | `ContextMenu` IconDownload · `ShareButton` ShareIcon · `SizeStepper` 꺾쇠(10×6·1.8) | — |

M3(배포 대기)가 B 계열 위에 Σ 트리거(획 5)·`IconTextWidth`(27×15 예외)를 얹었다 — **M4가 대체**한다(§4-4·§4-5). Phase 63(배포 대기)은 `Icons.tsx` 의미 이름만 소비하므로 M4 전환이 자동 반영된다.

### 1-2. 실사용 크기 분포 (38종 · 097f2eb)

| 크기 | 호출부 | 비고 |
|---|---|---|
| **10px — 2곳** | FolderPathBar 꺾쇠 ×2 | regular 획 0.625px |
| **11px — 5곳** | MiniShell 꺾쇠 · ShareTree 꺾쇠 · EditorView 탭 hover 이름변경·삭제 ×2 · ProofreadResultBox 휴지통 | 0.69px |
| **12px — 15곳** | ShareTree 꺾쇠 · Sidebar 꺾쇠·그립 · EditorView 블록바 휴지통·그립 · CopyrightPanel ×2 · FolderView 댓글 · ListView 댓글 · ProblemView 꺾쇠 ×2 · VersionTimeline 핀·GitHub · CommentPanel 다운로드 · ProofreadResultBox 로더 (+`AIBrandIcon` 가변 — VerifyReportCard가 12를 넘긴다) | 0.75px |
| **13px — 10곳** | CopyrightPanel · TabBody 체크·복사 · EditorView 꺾쇠L · ProblemView 댓글 · VersionDrawer 태그·이름변경·핀·GitHub · ListView 저장(=IconSave, D6 유지라 하한 제외) | 0.81px |
| 14~16px | 대부분(명시 + 기본값 14·16·18). **VersionTimeline 트리거 아이콘 4종은 14**(`<TriggerIcon size={14}>` → IconSave·IconExit·IconTag·IconRestore) | 0.875~1.0px |
| 17~27px | Row 2(22) · Undo/Redo·Restore·Comment 17 · IconSidebar 20 · IconTextWidth 27 | 1.06~ |

Phosphor regular의 획 비율은 **0.0625**(256칸에 16) — 현행 A 계열(0.075~0.083)보다 17~25% 가늘다. 16px 이상은 문제없고, **14 미만 32곳**(유지 예외 IconSave 13 · IconGithub 12/13 제외 시 상향·판정 대상 **29곳**)이 유일한 시각 위험이다(D4).

### 1-3. 브라켓을 빼야 하는 이유 (기록)

브라켓은 Mathory 로고·초기 아이콘 세트(64 viewBox · 3.5 · 코너 브라켓 · #D97757)의 **브랜드 모티프**다. 브랜드 표현은 로고·빈 화면·마케팅 같은 접점에 두고, 하루 수백 번 보는 기능 버튼에서는 뺀다 — "안정감 있고 빈틈없이 보수적으로 작동하는 수학 글쓰기 도구 · 반복 사용에서 피로하지 않은 것이 우선"(설계 기준 2026-08-29). 부수 효과: 브라켓이 사라지면 `IconButton`의 active 1px 테두리가 **유일한 사각 프레임**이 되어 켜짐이 즉시 읽힌다.

### 1-4. "미사용" 판별 — 두 번 틀린 자리 (기록 · N8의 근거)

v1·v2의 미사용 판별은 `grep "<IconX"`(JSX 태그)였다. `Icons.tsx`의 아이콘은 **컴포넌트 값으로도 참조**된다 — `VersionTimeline.tsx`의 `TRIGGER_ICON: Record<VersionTrigger, ComponentType>` 맵이 `manual_save: IconSave, editor_exit: IconExit, named: IconTag, restore: IconRestore`로 넣고 `<TriggerIcon size={14}/>`로 그린다. 그래서 `IconExit`는 JSX 검색 0인데 **살아 있었다**(Final_V4 실물 재확인). 올바른 판별은 `grep -rnw IconX`(단어 경계, import 줄 제외)이고, 그 기준의 진짜 미사용은 **10종**: `IconUser` `IconSplit` `IconSplitAll` `IconImage` `IconBox` `IconTrashEmpty` `IconChoices` `IconLineSplit` `IconSparkle` `IconCoachCaution`. 죽은 import는 **Sidebar.tsx의 `IconUser` 1건**뿐이다.

---

## 2. 결정사항 (★ = 덕수 확정)

| # | 결정 | 내용 · 근거 |
|---|---|---|
| **D1 ★** | 라이브러리 | **Phosphor Icons regular** 단일 |
| **D2** | 도입 방식 | `@phosphor-icons/core` **2.1.1 고정** devDependency + 생성 스크립트 → `phosphorPaths.ts`(path 문자열만, 커밋). 자산 위치는 **`createRequire(import.meta.url).resolve('@phosphor-icons/core/assets/<weight>/<file>.svg')`** — exports 맵이 `./assets/*/*.svg`를 **내보내므로** 정석 대응(실측 ✔). 막힌 것은 `./package.json`뿐(ERR_PACKAGE_PATH_NOT_EXPORTED, 실측 ✔) → 버전은 resolve된 자산의 dirname(`assets/<weight>/`)에서 **두 단계 위** `package.json`을 fs로 읽는다. pnpm·호이스팅·워크스페이스 어디서든 경로 하드코딩 없이 재현된다. 버전 업데이트는 의도적 커밋으로만 |
| **D3 ★** | `Icons.tsx` 형태 | 공용 `<PhIcon d size color>`(viewBox 256 · fill currentColor) + **의미 이름 export 유지**. 미사용 **10종** 삭제(§1-4) + 죽은 import **1건**(Sidebar `IconUser`) 제거. **`IconExit`는 삭제 제외 → `sign-out`**(D23). 삭제 전 `grep -rnw IconX --include=*.tsx --include=*.ts`로 **단어 경계** 소비처 0 재확인(JSX 검색 금지 — N8) |
| **D4** | 14 미만 자리 | **regular 단일 weight + 최소 렌더 14px 규칙.** 12~13px 상향 가능 자리 ~22곳 → 14. 10~11px 7곳 + `AIBrandIcon` 가변 12는 † 표기 후 **컨택트시트 실물 판정** — 흐린 자리만 bold 예외, 상한 없음 |
| **D5 ★** | 대안 도안 6종 | `IconShare→share-fat` · `IconComment→chat-text` · `IconBlockchain→graph` · `IconRename→cursor-text` · `IconTextWidth→arrows-out-line-horizontal` · `IconCoachImportant→chat-centered-text`. 판정 항목: 댓글/코칭 구분이 "둥근 vs 네모" 윤곽에서 **꼬리 위치**로 바뀐다 → 12~17px 나란히(§4-6 항목 8). ⚠ `CoachLabel.tsx`는 타입 무관 `IconCoachImportant` 하나를 쓴다(17px, 실물 확인) → `coach_caution`도 같은 도안이므로 `chat-centered-text` 하나로 충분, `IconCoachCaution` 삭제와 정합 |
| **D6 ★** | `IconSave` | **현행 유지**(24 · 1.8 자체 도안). ⚠ **`checked` prop이 있다** — EditorView 저장 버튼이 `checked={!dirty}`로 체크 표시를 켜고 끈다. 유지하므로 영향 없지만 "props API 불변" 목록에 명기. 사용 3자리: EditorView 18(`checked`) · ListView 13(수정일 칸 상태 표시기, `--mathory-red-dark` 3:1) · VersionTimeline 트리거 맵 14. 리스트 행에서 Phosphor 이웃과 stroke 질감이 갈리는 것은 **알고 두는 손실** |
| **D7 ★** | 블록 수식 | `currency-dollar-simple` x 0.62배 ×2(§4-3). bbox x 56~200 · tx −2/99 — 3연 실측 일치 |
| **D8** | Row 2 렌더 크기 | **전 버튼 20px**(Undo·Redo 17→20, 버튼 32 유지). 20px에서 획 1.25px = 현행 브라켓 1.2px과 같은 무게. 실물 판정(Q2) |
| **D9** | OCR 도안 | **`scan`**. 글자 "OCR"은 계열 유일의 텍스트가 되어 통일을 깬다. CommentEditor 사본은 같은 컴포넌트 import |
| **D10** | 전체 접기/펼치기 | `arrows-in-line-vertical` / `arrows-out-line-vertical`. `CollapseAllIcon({collapsed})` 분기 유지 |
| **D11** | 찾기/돋보기 | **`magnifying-glass`** 하나로 세 자리 통합(`SearchReplaceIcon`·`IconSearch`·`IconSearchPlain`). `IconSearchPlain`은 별칭 유지 — `AIBrandIcon` verify 폴백(VerifyReportCard 12 · CommentPanel 14/16)이 소비 |
| **D12** | Σ 팔레트 트리거 | **Phosphor `sigma`**(bbox w145×h176). M3 자체 Σ(획 5)는 브라켓 1.2px 기준 — 기준이 사라지므로 재정의. 덕수 5차 검수 자리라 **실물 판정 필수**(Q3) |
| **D13** | `IconPin` 켜짐 | `push-pin` ↔ `push-pin-fill`(실재 ✔). `filled` prop 유지 |
| **D14** | `IconLoader` | `circle-notch` + `<animateTransform rotate 0/360, 128 128>` — **`<path>`의 자식**으로(현행 Icons.tsx와 동일 구조) |
| **D15** | 로컬 사본 | `ContextMenu` IconDownload · `ShareButton` ShareIcon → Icons.tsx import. `SizeStepper` 꺾쇠(10×6·1.8)는 유지(컨트롤 부품) |
| **D16** | BlockBottomToolbar | `plus` · **`split-vertical`** · `rows`. `split-vertical` 실물 대조: 가로선 + 위·아래로 나가는 화살표 — "여기서 위아래로 가른다"(⌘B) 정합, D10 펼치기(선 1 + 직선 화살표 쌍)와 구분(✔). 15px 유지. `rows` 은유는 실물 판정(Q4) |
| **D17** | 브랜드 마크 | `IconGoogle`·`IconGithub` 현행 유지(하한 비적용). `AIBrandIcon` AI 로고 3종(`public/icons/ai/*.svg` `<img>`) 무변경 |
| **D18** | active 배경색 | `UnifiedToolbar.tsx` `rgba(66, 133, 244, 0.08)`(구글 파랑 하드코딩) → `color-mix(in srgb, var(--accent-primary) 8%, transparent)`, 폴백 `rgba(201,100,66,0.08)` = `#c96442` 일치(✔) |
| **D19** | 브랜드 모티프 | 브라켓은 로고·favicon·빈 화면에만. `CORNER_BRACKETS` 삭제 |
| **D20 ★** | 순서 | **배포 대기 스택 6개** — ProblemView 디자인 개선(5건, 08-30) → 61e → 61e-2차 → 61f → M3 → Phase 63 — **전부 배포·하드 리프레시 확인 후 M4 별도 브랜치 착수**(N7). M3와 M4는 같은 파일(`toolbarIcons`·`SizeStepper`·`Icons`)을 만지므로 M3 배포본이 실물 검수 기준선이어야 한다 |
| **D21 ★** | `icons:check` 배선 | `"prebuild": "npm run icons:check"`. **착수 전 Vercel 확인 2건**(N6): ① Build Command가 `npm run build`(또는 자동 감지)인지 — `next build` 직접 지정이면 prebuild가 안 돈다 ② devDependencies가 설치되는지. 하나라도 어긋나면 `"build": "npm run icons:check && next build"`로 **명시 연결** |
| **D22** | `IconDots` | 실제 도안이 **세로 점**(cx 12 고정 · cy 6/12/18 — 재확인 ✔) → `dots-three-vertical` 통합, `IconDots = IconDotsVertical` 별칭. 소비처 Sidebar ×2 · FolderView · ListView ×2 |
| **D23 ★** | `IconExit` | **삭제하지 않고 Phosphor `sign-out`**(실재·단일 path ✔ — 문+나가는 화살표, 현행 "열린 상자+화살표" 은유 동일). 소비처 `VersionTimeline` `editor_exit` 트리거(14px). 대안 `door-open`·`arrow-square-out`은 "열림"·"외부 링크" 뜻이라 부적합(둘 다 실재 — 기각 근거 유효) |

---

## 3. 전수 대응표 (097f2eb · Icons.tsx 38종)

크기는 현행 → D4 적용 후. `*` = 대안 도안(D5). `†` = 14 미만 잔존 — 컨택트시트 판정. `(기본)` = size 미지정 호출.

| Icons.tsx | 호출 | 크기(현 → 후) | Phosphor regular | 비고 |
|---|---|---|---|---|
| IconChevron | 12 | 10×2†·11×2†·12×4·16·(기본14)×3 → 12는 14 | `caret-right` | FolderPathBar·MiniShell·ShareTree |
| IconChevronLeft | 3 | 13/14/16 → 14/14/16 | `caret-left` | |
| IconChevronDown | 1 | (기본14) | `caret-down` | |
| IconTrash | 11 | 11×2†·12·14×5·16·18·(기본14) → 12는 14 | `trash` | 11 = ProofreadResultBox·탭 hover |
| IconFolder | 10 | 14×3·15×2·16·18·(기본18)×3 — 무변경 | `folder` | |
| IconShare | 9 | 14×6·15×2·18 — 무변경 | `share-fat` * | |
| IconDownload | 8 | 12·14×4·16·(기본14)×2 → 12는 14 | `download-simple` | ContextMenu 사본 통합 |
| IconCopy | 7 | 13·14×5·(기본14) → 14 | `copy` | |
| IconComment | 6 | 12×2·13·16×2·17 → 14×3·16×2·17 | `chat-text` * | 12 = FolderView·ListView |
| IconLoader | 6 | 12·14×3·16·(기본14) → 14 | `circle-notch` | D14 |
| IconBlockchain | 4 | 12×2·13·(기본14) → 14 | `graph` * | |
| IconPlus | 4 | 14·16·(기본18)×2 | `plus` | |
| IconRename | 3 | 11†·13·(기본14) → †/14/14 | `cursor-text` * | |
| IconClose | 3 | 16·(기본16)×2 | `x` | |
| IconDotsVertical | 3 | 14·16×2 | `dots-three-vertical` | |
| IconFolderMove | 3 | 14×2·(기본14) | `folder-simple-dashed` | |
| IconSearch (+SearchPlain 별칭) | 2+1 | (기본18)×2 · AIBrandIcon 가변 12†/14/16 | `magnifying-glass` | D11 |
| IconBazaar | 2 | 15×2 | `storefront` | |
| IconDots | 2 | (기본16)×2 | `dots-three-vertical` | D22 별칭 |
| IconEdit | 2 | 14·(기본14) | `pencil-simple` | |
| IconSave | 2 (+트리거 맵) | 13(ListView 상태색)·18(`checked`)·14(VersionTimeline) — **유지** | **현행 유지** | D6 |
| IconGrip | 2 | 12×2 → 14 | `dots-six-vertical` | 폭 여유 실측(Q1) |
| IconInbox | 2 | 16·18 | `tray` | |
| IconGithub | 2 | 12·13 — **유지** | **현행 유지** | D17 |
| IconPin | 2 | 12·13 → 14 | `push-pin` / `push-pin-fill` | D13 |
| IconRestore | 2 (+트리거 맵) | 16·17·14 | `clock-counter-clockwise` | |
| IconTextWidth | 2 | 27(×15) → **24 정방** | `arrows-out-line-horizontal` * | §4-5 |
| IconSidebar | 1 | (기본20) | `sidebar-simple` | |
| IconRecent | 1 | (기본18) | `clock` | |
| IconUndo | 1 | 17 → 20 | `arrow-u-up-left` | D8 |
| IconRedo | 1 | 17 → 20 | `arrow-u-up-right` | D8 |
| IconGoogle | 1 | 14 — **유지** | **현행 유지** | D17 |
| IconCheck | 1 | 13 → 14 | `check` | |
| IconDocLines | 1 | 14 | `file-text` | |
| IconTag | 1 (+트리거 맵) | 13·14 → 14 | `tag` | |
| IconCoachImportant | 1 | 17 | `chat-centered-text` * | CoachLabel — 타입 무관 단일 |
| **IconExit** | **트리거 맵 1** | **14** | **`sign-out`** | **D23 — v1·v2의 삭제 목록에서 구출** |

수정 규모: 크기 상향 ~22곳 · † 판정 7곳(+AIBrandIcon 12) · 유지 예외 3종 무변경 · 삭제 10종 · 죽은 import 1건.

### 3-1. Row 2 편집 툴바 — 브라켓 12종 + Σ + Undo·Redo · 전 버튼 20px(D8)

| 도구 | 현행 | Phosphor regular |
|---|---|---|
| 실행취소 / 다시실행 | `IconUndo` `IconRedo`(17) | `arrow-u-up-left` / `arrow-u-up-right` |
| 인라인 수식 | `InlineMathIcon` | `currency-dollar-simple` |
| 블록 수식 | `BlockMathIcon` | **자체: `currency-dollar-simple` ×2 가로 축소**(D7) |
| 수식 읽기(OCR) | `OcrIcon` | `scan`(D9) |
| Σ 팔레트 트리거 | `SigmaIcon`(획 5) | `sigma`(D12·Q3) |
| 강조 | `KeySentenceIcon` | `highlighter` |
| 상용구 | `SnippetIcon` | `brackets-curly` |
| 특수문자 | `SpecialCharIcon` | `number-circle-one` |
| 이모지 | `EmojiIcon` | `smiley` |
| 표 삽입 | `TableAddIcon` | `table` |
| 맞춤법 검사 | `ProofreadIcon` | `list-checks` |
| AI 완성 | `AiMathGenIcon` | `sparkle` |
| 찾기/바꾸기 | `SearchReplaceIcon` | `magnifying-glass`(D11) |
| 전체 접기/펼치기 | `CollapseAllIcon({collapsed})` | `arrows-in-line-vertical` / `arrows-out-line-vertical`(D10) |

### 3-2. 라이브러리 밖 인라인 SVG·소비처

| 자리 | 현행 | 후 |
|---|---|---|
| `BlockBottomToolbar.tsx` 3종(15px) | 64 글리프 stroke 4 | `plus` · `split-vertical` · `rows`(D16) |
| `CommentEditor.tsx` OCR(18) | 브라켓+글자 사본 | `UnifiedToolbar` OCR 컴포넌트 export → import(`scan`) |
| `CommentEditor.tsx` 그림 삽입(18) | 액자+산+해(#888/#ccc 하드코딩) | `image` · `currentColor` |
| `ContextMenu.tsx` IconDownload | 로컬 사본 | `Icons.tsx` import |
| `ShareButton.tsx` ShareIcon(14) | 로컬 사본 | `IconShare`(`share-fat`) |
| `toolbarIcons.tsx` | `SVG_PROPS`(64·3.5) · `CORNER_BRACKETS` · `SigmaIcon` | 256·fill · **삭제** · `sigma` |
| `AIBrandIcon.tsx` | verify 폴백 = `IconSearchPlain`(12/14/16) · AI 로고 `<img>` | 별칭으로 자동 전환 · 로고 무변경 |
| `VersionTimeline.tsx` `TRIGGER_ICON` | IconSave·IconExit·IconTag·IconRestore(14) | IconSave 유지 · **IconExit→`sign-out`** · `tag` · `clock-counter-clockwise` — **맵 코드 무변경**(이름 유지) |

---

## 4. 구현 사양

### 4-1. 생성 스크립트 `scripts/gen-phosphor-paths.mjs` (신설)

```js
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);

// 입력: ICONS 표(Mathory 의미 이름 → phosphor 파일명 · weight) — 진실은 이 표 하나
const ICONS = {
  trash: ['trash', 'regular'], folder: ['folder', 'regular'], share: ['share-fat', 'regular'],
  pushPin: ['push-pin', 'regular'], pushPinFill: ['push-pin', 'fill'],           // D13
  collapseIn: ['arrows-in-line-vertical', 'regular'], collapseOut: ['arrows-out-line-vertical', 'regular'],
  splitBlock: ['split-vertical', 'regular'],                                      // D16
  exit: ['sign-out', 'regular'],                                                  // D23
  /* … §3 전수표 그대로 … */
};
// 자산 경로: exports 맵이 ./assets/<weight>/*.svg 를 내보내므로 resolve로 얻는다(pnpm·호이스팅 무관, 실측 ✔)
const file = (name, w) => require.resolve(`@phosphor-icons/core/assets/${w}/${name}${w === 'regular' ? '' : `-${w}`}.svg`);
// 버전: ./package.json은 exports에 없으므로(ERR_PACKAGE_PATH_NOT_EXPORTED ✔) 자산 dirname(assets/<weight>/)에서 두 단계 위를 fs로
const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(file('trash', 'regular')), '..', '..', 'package.json'), 'utf8'));
// 각 svg에서 <path d="…"> 추출 — 2.1.1 대조: 계획 49종 전원 <path> 1개(✔). 2개 이상이면 assert로 실패
// 출력 components/ui/phosphorPaths.ts — 헤더: Phosphor Icons © Phosphor Icons, MIT(전문 THIRD_PARTY_LICENSES.md) · core 버전 · 생성 시각
// --sheet: docs/icons-contact-sheet.html(§4-6)
```

`package.json`: `"icons:gen"` · `"icons:check"`(재생성 ↔ 커밋본 diff, 불일치 exit 1) · `"prebuild": "npm run icons:check"`(D21 — Vercel 전제 확인 후, 어긋나면 `build` 명시 연결). `@phosphor-icons/core@2.1.1` devDependencies 고정.

### 4-2. `components/ui/Icons.tsx`

```tsx
import { PH } from './phosphorPaths';

/** Phosphor 공용 셸 — viewBox 256 · fill=currentColor · 획은 weight 파일이 정한다(CSS로 못 바꿈) */
export function PhIcon({ d, size = 16, color = 'currentColor', style, ...rest }: PhIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} aria-hidden style={style} {...rest}>
      <path d={d} />
    </svg>
  );
}
export const IconTrash = (p: IconProps) => <PhIcon d={PH.trash} size={14} {...p} />;
export const IconExit  = (p: IconProps) => <PhIcon d={PH.exit}  size={14} {...p} />;   // D23 — 트리거 맵이 참조
export const IconPin   = ({ filled, ...p }: IconProps & { filled?: boolean }) =>
  <PhIcon d={filled ? PH.pushPinFill : PH.pushPin} size={14} {...p} />;
export const IconLoader = (p: IconProps) => (
  <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 256 256" fill={p.color ?? 'currentColor'} aria-hidden>
    <path d={PH.circleNotch}>
      <animateTransform attributeName="transform" type="rotate" from="0 128 128" to="360 128 128" dur="1s" repeatCount="indefinite" />
    </path>
  </svg>
);
export const IconSearchPlain = IconSearch;   // D11 — AIBrandIcon(verify)
export const IconDots = IconDotsVertical;     // D22
// IconSave(checked prop 포함) · IconGoogle · IconGithub — 현행 24 viewBox 코드 그대로(D6·D17)
```

- 기본 `size`는 종별 현행 기본값을 잇되 14 미만은 14로(D4). 명시 크기는 §3 "후" 열대로.
- 삭제 10종 + Sidebar `IconUser` import 1건. **제거 전 `grep -rnw` 단어 경계 검색으로 소비처 0 재확인**(N8) — 트리거 맵·객체 리터럴·`ComponentType` 변수 등 JSX 아닌 참조가 있다(§1-4).

### 4-3. 블록 수식 도안 (D7)

```tsx
/** $$ — currency-dollar-simple을 x 0.62배로 눌러 좌·우 배치. 비등방 scale은 fill path의 세로 획을
 *  가늘게 한다(16→9.9유닛, 20px에서 1.25→0.78px). 흐리면 대안: 0.8배 등방 축소 + 겹침(Q5) */
export function BlockMathIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden>
      <g transform="translate(-2 0) scale(0.62 1)"><path d={PH.dollarSimple} /></g>
      <g transform="translate(99 0) scale(0.62 1)"><path d={PH.dollarSimple} /></g>
    </svg>
  );
}
```
좌표: path x 56~200(폭 144·중심 128) · y 16~240. 0.62배 → 폭 89.3 · 간격 12 → 좌단 32.7 → tx −2 / 99.

### 4-4. `toolbarIcons.tsx` · `UnifiedToolbar.tsx`

- `ICON_SIZE = 20`(D8). `SVG_PROPS` = `{ width, height, viewBox: '0 0 256 256', fill: 'currentColor', 'aria-hidden': true }`. `CORNER_BRACKETS` 삭제. `SigmaIcon` → `<PhIcon d={PH.sigma} size={20} />`(D12).
- 12개 아이콘 컴포넌트 → `<PhIcon d={PH.…} size={ICON_SIZE} />`. `CollapseAllIcon({collapsed})` 분기 유지. `OcrIcon` export(CommentEditor가 import).
- `IconButton` active 배경 → D18. EditorView Undo·Redo 17 → 20.
- 상단 주석의 브라켓 규격 서술 → Phosphor 256 · fill · 20px에서 획 1.25px.

### 4-5. `IconTextWidth` → `arrows-out-line-horizontal` (D5 ★ · M3 예외 폐기)

M3의 27×15 예외는 스테퍼 꺾쇠(1.8)와 물리 획을 맞추기 위한 것이었고 Phosphor(fill)에서는 성립하지 않는다 → 정방 **24px**(획 1.5px). 꺾쇠와의 0.3px 차이는 수용(D15). `SizeStepper` `icon` 슬롯(현 27×15)·Row 1 내부 여백 실측(Q6). 안 되면 22. 이 도안의 유일 소비처는 IconTextWidth다(D16이 `split-vertical`로 가서 이중 배정 없음).

### 4-6. 컨택트시트 `docs/icons-contact-sheet.html` (생성물 · `--sheet`)

실사용 크기·실사용 배경 토큰(`--bg-functional` · `--text-muted`) 위에 나열. 판정 항목:

1. 38종 사다리(12/14/16/18/20) + Row 2 한 줄 실물
2. † 잔존 7곳 + AIBrandIcon 12 — regular 12 vs bold 12 vs 상향 14 삼자(D4·Q1)
3. Row 2 18/20/22 + 인라인 `$` 무게(Q2)
4. Σ: Phosphor `sigma` vs M3 자체 Σ(Q3 — 덕수)
5. `split-vertical`·`rows` 은유(Q4)
6. 블록 수식 x0.62 비등방 vs 0.8 등방+겹침(Q5)
7. `IconTextWidth` 24 정방 슬롯(Q6)
8. `chat-text` vs `chat-centered-text` 12~17px 나란히
9. `dots-three-vertical` 통합 후 Sidebar·리스트
10. **`sign-out` 14px — VersionTimeline 트리거 이웃(IconSave 유지 stroke 1.8 · `tag` · `clock-counter-clockwise`)과 한 줄**(같은 이웃에 두 계열이 섞이는 유일한 자리)

### 4-7. 문서·규약

- `THIRD_PARTY_LICENSES.md` 신설 — Phosphor Icons MIT 전문.
- `CLAUDE.md` 갱신(절 이름 지정): ① "툴바 아이콘은 `UnifiedToolbar.tsx` 안의 인라인 SVG…" 절(Phase 58 P3) → Phosphor 규약 ② M3 절의 브라켓 두께·`IconTextWidth` 예외·Σ 획 5 → "M4로 폐기" ③ 새 절: "아이콘 체계 — Phosphor regular 2.1.1 · viewBox 256 · fill currentColor · 최소 14px(† 예외 목록) · 켜짐은 fill weight · 유지 예외 IconSave/IconGoogle/IconGithub/AI 로고 · **미사용 판별은 단어 경계 grep(`-w`), JSX 태그 검색 금지 — IconExit 사례**(N8)".
- `docs/roadmap.md` M4 행.

---

## 5. 영향 범위·무회귀 점검

| 영역 | 영향 |
|---|---|
| 서버 · 규칙 · 스키마 · GAS · 프롬프트 | **0** |
| 로직 테스트(356건) | **0** — `icons:check`(prebuild)만 추가 |
| 호출부 | 이름·props 불변 → 크기 숫자 ~22곳 + † 7곳 + 사본 2곳 import + 죽은 import 1건. `TRIGGER_ICON` 맵 등 **참조 소비처는 코드 무변경** |
| 버전 타임라인 | `editor_exit` 아이콘이 `sign-out`으로 바뀐다(D23). 삭제했다면 TS 컴파일 오류로 빌드 실패 — 회귀 위험 해소 |
| 접근성 | `aria-hidden` 유지 · `currentColor` 승계. 12→14 상향은 클릭 목표에 유리. ListView IconSave 상태색(3:1) 불변 |
| 레이아웃 | 상향 자리(배지·탭 hover·DnD 핸들·리스트 행 댓글 셀) 폭 ~2px 증가 — 정렬 실측(Q1). Row 2 버튼 32 고정 |
| 빌드 | `prebuild` 전제 2건(D21) 확인. 어긋나면 `build` 명시 연결 |
| 번들 | 런타임 의존 0. path ≈49종 × 300~750B ≈ 25KB(gzip ≈8KB) |
| M3 산출물 | Σ·`IconTextWidth`·브라켓 규격 대체. 스테퍼·KaTeX·버그 수정 불변 |
| Phase 63 | 의미 이름 소비 → 자동 반영 |
| 브랜드 | 기능 UI 브라켓 0. 로고·favicon·AI 로고 무변경 |

---

## 6. 범위 밖 (기록)

- 로고 리디자인 · favicon — 브라켓 모티프 유지.
- 다크 테마 아이콘 톤.
- `SizeStepper` 꺾쇠(컨트롤 부품).
- KaTeX 팔레트 안의 수식 기호.
- `GgbGraphView.tsx`의 `<svg>` 문자열 조작 — GeoGebra export 후처리, 아이콘 아님.
- `AIBrandIcon` AI 로고 3종 — 상표.

## 7. 열린 질문 — 착수 중 컨택트시트 실물 판정 (결정은 전부 닫힘)

1. **Q1** † 잔존 7곳 + AIBrandIcon 12: regular / bold 예외 / 상향. 상향 자리 정렬.
2. **Q2** Row 2 18/20/22 실물, Undo·Redo와 `$` 무게.
3. **Q3** Σ: Phosphor `sigma` vs M3 자체 Σ — **덕수 판정**.
4. **Q4** `split-vertical`·`rows` 은유.
5. **Q5** 블록 수식 x0.62 비등방 vs 0.8 등방+겹침.
6. **Q6** `IconTextWidth` 24 슬롯·Row 1 높이.
7. **Q7(전제)** Vercel Build Command·devDependencies 설치 여부 — **덕수, 프로젝트 설정 화면 1분**(D21).

---

## 8. v3 신규 결정 — 덕수 확정 (2026-09-06 · 전부 권장안 (a))

| # | 결정 | 확정 |
|---|---|---|
| **N5 ★** | `IconExit` | Phosphor `sign-out`으로 전환·유지. "저장"과 "편집 종료 자동 저장"은 구분되는 트리거(Phase 55b가 4종 각각 아이콘을 둔 이유) |
| **N6 ★** | `icons:check` 연결 | `prebuild` + 착수 전 Vercel 설정 확인, 어긋나면 `build` 명시 연결 |
| **N7 ★** | 배포 순서 | 6개 스택 전부 배포 후 M4 착수(D20) |
| **N8 ★** | 미사용 판별 규약 | CLAUDE.md에 "단어 경계 grep, JSX 태그 검색 금지" 명문화 |

## 8-1. 착수 체크리스트 (순서대로 · 1~2는 덕수 몫)

1. **[덕수]** 6개 스택(ProblemView 디자인 개선 → 61e → 61e-2차 → 61f → M3 → Phase 63) **push → Vercel 배포 → Cmd+Shift+R** 확인(N7). 이 배포본이 실물 검수 기준선.
2. **[덕수]** Vercel 설정 확인(N6·Q7): Build Command가 `npm run build`(또는 자동 감지)인지 · devDependencies 설치되는지. 어긋나면 CLI가 `build` 명시 연결로 대응.
3. 브랜치 `m4-icons`. `@phosphor-icons/core@2.1.1` devDependency · `scripts/gen-phosphor-paths.mjs` · `icons:gen`/`icons:check`/`prebuild` · `THIRD_PARTY_LICENSES.md`.
4. `phosphorPaths.ts` 생성 → `Icons.tsx` 전환(§4-2 · IconExit→`sign-out` · IconSave/IconGoogle/IconGithub 유지) → 삭제 10종은 **`grep -rnw` 소비처 0 확인 후**(N8).
5. Row 2(`toolbarIcons` · `UnifiedToolbar` · EditorView Undo·Redo 20) → BlockBottomToolbar → CommentEditor → ContextMenu·ShareButton 사본 → D18 active 색.
6. `--sheet` 컨택트시트 → §7 Q1~Q6 실물 판정(Q3 Σ는 덕수) → 크기 상향 ~22곳 반영 · † 잔존 처리 확정.
7. CLAUDE.md(§4-7 ①②③ + N8 규약) · roadmap · 본 문서 §10 기록 → phasedocs 이관.

## 9. 판본 변경 기록 (요약)

- **v1 → v2 (CLI)**: 기준 655ba23→097f2eb 재실측(C1) · 14 미만 셈 정정(C2) · IconLoader 스니펫(C3) · CLAUDE.md 절 인용(C4) · Row 2 셈(C5) · 호출 수(C6) · **IconDots 세로 점 발견(C7·D22)** · AIBrandIcon 편입(B1) · N1 `split-vertical` · N2 판정제 · N3 prebuild · N4 배포 후 착수.
- **v2 → v3 (web)**: **`IconExit` 미사용 판정 오류 구출(C8·D23·N5)** — 트리거 맵 참조를 JSX grep이 놓쳤다. 삭제 11→10종, 죽은 import 2→1건 · 배포 스택 5→6개(C9) · require.resolve 정석 대응(C11) · D21 전제 2건(B10) · `checked` prop(B11) · CoachLabel 단일(B12) · 트리거 열 혼합 자리(B13) · N6~N8 확정.
- **v3 → Final_V4 (CLI)**: v3 신규 주장 **전항 실측 통과**(헤더 참조). 내용 변경 0 · 문안 1건(§4-1 package.json 상대 경로 서술을 dirname 기준 2단계로 통일).

## 10. 구현·검수 기록

### 10-1. 구현 (2026-09-06 · 브랜치 `m4-icons` · 커밋 6개 · 전체 707+/812−)

체크리스트 1(6개 스택 push)은 덕수 수행. 2(Vercel 설정)는 대시보드 확인이 안 와서 **prebuild로 배선하고 m4 첫 배포 빌드 로그에서 `> prebuild` 실행 여부로 Q7을 닫는다**(확인 방법은 덕수에게 전달됨 — Deployments → Build Logs의 install/build command 두 줄).

| 커밋 | 내용 |
|---|---|
| `b0e3e1e` S1 | 생성 파이프라인 — `scripts/gen-phosphor-paths.mjs`(gen/check/sheet) · `phosphorPaths.ts` 49종 생성 · `prebuild` 배선 · `THIRD_PARTY_LICENSES.md`. ⚠ **계획과 다른 것 1건**: 생성 파일 헤더에 **생성 시각을 넣지 않았다** — `icons:check`가 바이트 diff라 시각이 들어가면 재생성마다 불일치가 된다(§4-1 주석에 명문화). core 버전만 기록 |
| `dcb0a3b` S2 | Icons.tsx 전환 — 38종(팩토리 `phIcon(d, defaultSize)`) · 삭제 10종 · IconExit→`sign-out` · IconDots=IconDotsVertical 별칭 · 유지 3종(IconSave `checked` 포함) · Sidebar 죽은 import 제거. 삭제 전 `grep -rnw` 단어 경계 0 확인(N8) |
| `d954b34` S3 | Row 2 — toolbarIcons(256·fill·ICON_SIZE 20·`CORNER_BRACKETS` 삭제·SigmaIcon=sigma) · UnifiedToolbar 12종→PhIcon · BlockMathIcon 자체 도안(D7 tx −2/99) · `OcrIcon` export · EditorView Undo/Redo 17→20 · D18(ACTIVE_BG — `CSS.supports`로 color-mix 폴백) |
| `bdcc434` S4 | 라이브러리 밖 — BlockBottomToolbar 3종(`plus`·`split-vertical`·`rows`, 15px) · CommentEditor OCR 사본→import·그림 `image` currentColor · ContextMenu·ShareButton 로컬 사본 제거 |
| `b19c632` S5 | 크기 상향 22곳(12px 14곳 + 13px 8곳) + IconTextWidth 27→24 ×2곳. 적용은 파일:라인:패턴 3중 검증 스크립트로. 적용 후 grep 실측: 잔존 = † 7곳 + AIBrandIcon 12 + 유지 예외 3곳 — **§3 표와 정확히 일치** |
| `e09dffa` S6 | 컨택트시트 `docs/icons-contact-sheet.html`(§4-6 판정 항목 10종 전부 포함, bold 비교는 시트 전용으로 bold weight를 즉석 로드) |

검증: `icons:check` OK · `npx tsc --noEmit` exit 0 · 로직 테스트 무접촉(아이콘은 대상 밖).

### 10-2. 검수 — 덕수, 2026-09-06 · **전항 통과** ("모두 정상")

컨택트시트(판정 항목 10종) + dev 실물(편집창 Row 2·블록 하단바·버전 드로어/타임라인·리스트·
사이드바·댓글 에디터)로 Q1~Q6 전부 판정. **추가 반영 커밋 0** — 구현 상태 그대로 채택.

| 열린 질문 | 판정 |
|---|---|
| Q1 † 잔존 8곳(10~11px 7 + AIBrandIcon 12) | **regular 그대로** — bold 예외 0 |
| Q2 Row 2 크기 | **20px 확정**(Undo·Redo 포함) |
| Q3 Σ | **Phosphor `sigma` 채택** — M3 자체 Σ 폐기 확정 |
| Q4 `split-vertical`·`rows` 은유 | 통과 |
| Q5 블록 수식 | **비등방 x0.62 채택**(등방+겹침 기각) |
| Q6 IconTextWidth 24 정방 | 통과(스테퍼 슬롯·Row 1 수용) |
| Q7 Vercel prebuild | **유일한 잔여** — m4 첫 배포 빌드 로그의 `> icons:check` 줄로 확인 |

### 10-3. 문서 마감 (2026-09-06)

CLAUDE.md — "아이콘 체계는 Phosphor regular 단일" 절 신설(§4-7 ①③ + N8 규약) · M3 절의
브라켓 규격·IconTextWidth 예외·Σ 도안 수치에 M4 폐기 표기(②) · 현재 Phase = M4.
roadmap M4 절 추가. prelaunch-bug-cleanup §7(아이콘 잔여 부채) 중 ContextMenu 사본·굵기 혼재
해소 표기(📌 이모지 2곳만 잔존). 본 문서 phasedocs 이관. 6개 스택은 같은 날 배포 완료로 정정.
