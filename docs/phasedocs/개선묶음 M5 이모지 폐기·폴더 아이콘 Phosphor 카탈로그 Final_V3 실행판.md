# 개선묶음 M5 — 이모지(Twemoji) 폐기 · 폴더 아이콘 Phosphor 카탈로그 전환 Final_V3 착수판

> 계보: 덕수 메모(2026-09-06) → 범위 문답 2회 → v1 web → 덕수 확정 N1~N8 → v2 CLI 실측 교차검토(E1~E4 정정 · G1~G6 보완 · 덕수 확정 N9~N11) → **Final_V3 = 착수판**(v2 + 커밋 계획 §10). 구현·검수 기록은 §11에 추가한다.
> 기준: HEAD 4bd7a8b · `@phosphor-icons/core` **2.1.1 실물 대조 완료**. 결정 전항 닫힘(D1~D15 · N1~N11 ✅). 열린 것은 §7 실물 판정뿐.
> 상세 근거·실측 기록은 v2(`M5-folder-icon-phosphor-plan-v2.md`) §0-1을 본다 — 이 판은 실행에 필요한 전부를 자체 수록한다.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 취지(덕수) | Twemoji는 모양이 복잡하고 컬러가 다양해 "보수적인 차분함 · 착오 없이 작동하는 안정감"과 맞지 않는다 → 단색 Phosphor로 통일. 용도 둘 — 앱 버튼(M4 완료) · 폴더 아이콘 지정(M5) |
| 범위 | **Twemoji 전면 철거**(툴바 버튼 · 피커 · 렌더 플러그인 2 · CDN · 인쇄 대기 · CC BY 고지 · 의존성 2) + **폴더 아이콘 → Phosphor 카탈로그 피커** + Agent 라벨 → `lego-smiley` + `AIBrandIcon` 폴백 → `robot` + **ai-models 기본 avatarEmoji `''`(D15)**. 본문용 아이콘 문법은 만들지 않는다 |
| 무접촉 | 서버 0 · 규칙 0 · 스키마 0(`icon: string` 그대로, 값만 이름) · 프롬프트 0 · raw_text 0 · exportMd 0 · 기존 테스트 356건 0 |
| 핵심 결정 | regular+bold 3,024 자산 self-host(gitignore·빌드 생성) · 렌더는 **정적 SVG + CSS mask**(`currentColor` 유지) · 피커 regular 한정, **활성 폴더 행만 bold**(글자 700과 동일 조건) · 기본 폴더 3종(`folder`/`folder-simple`/`folder-open`) · brands 78종 피커 제외 · 한글 키워드 표 동커밋 |

## 1. 실측 요점 (v2에서 전수 확인 — 전항 일치)

- core 2.1.1(devDeps): regular/bold 각 1,512 · 카테고리 18(brands 78 · system 376 · 다중 소속 960) · **`folder-simple-open` 없음** · `folder-open`·`lego-smiley`·`robot` 존재, 대상 5종 regular·bold 전부 **단일 `<path>`·viewBox 256** · 자산 11.8 MB · 인덱스 163,014 B(gzip 26,768) · `*new*` 태그 실재.
- `TwemojiImg` 소비처 6곳: Sidebar :330(18)·:483(15) / ListView :351(16) / FolderView :559(18)·:701(14) / FolderPathBar :21(로컬 FolderGlyph). twemoji 접촉 파일 전수 = §5 목록과 누락 0.
- 아이콘 없는 폴더 트리 2곳(N10 편입): SheetImportModal :724·:728(`IconFolder`만) · **FolderPickerDialog(아이콘 0 — v2 발견)**.
- Agent 라벨: EditorView :3333(500/13, 옆 IconComment 17) · ProblemView :832(600, 옆 14) · FolderView :850(600). ListView 헤더 "Agent"(listColumns:28)는 글자 유지(N6).
- `avatarEmoji` 시각 소비처는 `AIBrandIcon`(components/comment/) 폴백 하나뿐(CommentPanel :400·:762·:1394 경유) → **D15 파급 0**. `ai-models.ts:27`이 `'🤖'`를 기본 채움하던 것이 D9를 죽은 코드로 만들던 원인(E1).
- exports 맵에 `./package.json` 없음 → 버전은 M4 방식(자산 dirname fs) 유지. `./assets/<weight>/*.svg` export 유효.
- next.config 부재 · rules `folders` 필드 검증 없음(:449) · `updateFolder`(firestore:452) `icon?: string` 무변경 · ICONS 49종 · `smiley` 소비처 UnifiedToolbar :65 단독.

## 2. 결정 D1~D15 (전항 ✅)

| # | 결정 |
|---|---|
| D1 | 범위 = §0. '아카이브' 항목 삭제. 본문 아이콘 문법 없음(Phosphor 코드포인트는 PUA라 교환 문자가 아니다 — E2 정정) |
| D2 (N7) | `--assets`가 core assets 3,024 파일을 `public/icons/phosphor/<ver>/{regular,bold}/`로 복사(+LICENSE 동봉). **gitignore** · `predev`·`build`에서 생성. 사용자 아이콘은 `<PhAsset>`(CSS mask + currentColor) · 시스템 아이콘은 M4대로 인라인 path |
| D3 | 피커 regular만. **활성 폴더 행**만 bold — 글자 700 조건(Sidebar `active`)과 동일 |
| D4 (N3) | 기본: 최상위 `folder` · 하위 `folder-simple` · 펼침(`hasChildren && expanded`) **depth 무관 `folder-open`** |
| D5 | `components/ui/FolderGlyph.tsx` 하나가 **8곳** 대체. 규칙은 `lib/folderIcon.ts`(import 0 · `test:foldericon`) |
| D6 (N1·N2·N5·N11) | `PhosphorIconPicker` — 검색(영문 name·tags + **한글 표 `lib/phosphor-ko.json` 동커밋**) · 카테고리 `<select>`(17종 한글명, **brands 제외**) · 최근(localStorage `mathory:folder-icon:recent`, 24) · 10열 그리드(폭 316) · 인덱스는 첫 오픈 동적 import |
| D7 (N4) | `Folder.icon` string 그대로. Phosphor 이름 `^[a-z0-9-]+$` ↔ 이모지 불겹침. 옛 유니코드 값 = 기본 아이콘 표시·데이터 무접촉 |
| D8 (N6) | `IconAgent = lego-smiley` — EditorView 17 · ProblemView 14 · FolderView 14. ListView 헤더는 글자. `title="agent 열기"` |
| D9 | `AIBrandIcon` 폴백: `fallbackEmoji ? 이모지 : <IconRobot/>` |
| D10 (N10) | SheetImportModal + **FolderPickerDialog** 둘 다 FolderGlyph — 폴더를 그리는 곳은 한 벌 |
| D11 | 저작권 고지 준칙 §6-7. Twemoji CC BY 문단 삭제(자산을 안 쓰면 고지 의무도 끝) |
| D12 (N7·E3) | `"build": "icons:check && icons:assets && next build"` · **`prebuild` 삭제**(이중 실행 방지) · `"predev": "icons:assets"`. 복사 멱등 · 3,024 assert |
| D13 | 경로에 core 버전 → 버전업 = URL 변경. next.config 없음 유지(ETag 304) |
| D14 (N8) | Twemoji 철거 §5. chatExtract :386은 주석만. `smiley` 키 제거(철거 커밋에서 — 소비처 소멸 후) |
| D15 (N9 · v2 신설) | `ai-models.ts:27` `?? '🤖'` → **`?? ''`** — IconRobot 폴백이 실제로 동작. 저장된 avatarEmoji는 무접촉 |

## 3. 전수 대상표

### 3-1. `FolderGlyph` 8곳
Sidebar :330(18 · `active`·`hasChildren&&expanded` 전달) · Sidebar FolderMoveMenu :483(15 · "최상위"의 `IconFolder 15`는 유지) · ListView :351(16) · FolderView 머리 :559(18 · 미지정·휴지통·공유 분기 그대로) · FolderView 칩 :701(14) · FolderPathBar :21(14 · 로컬 컴포넌트 삭제→공용) · SheetImportModal :724·:728(14 · "최상위(미지정)" 행 `IconFolder` 유지) · FolderPickerDialog 행(14 · "최상위(미지정)" `IconFolder` 유지).

### 3-2. ICONS 표: 49 − 1 + 7 = 55종
+`folderSimple`·`folderOpen`(regular) · +`folderBold`·`folderSimpleBold`·`folderOpenBold`(bold) · +`legoSmiley`·`robot`(regular) · −`smiley`(S5에서).

### 3-3. Agent·폴백·기본값
| 자리 | 후 |
|---|---|
| EditorView :3333 | `<IconAgent size={17}/>{n}` |
| ProblemView :832 | `<IconAgent size={14}/>{n}` |
| FolderView :850 | `<IconAgent size={14}/><span>{n}</span>` |
| AIBrandIcon :64 | `fallbackEmoji ? <span>…</span> : <IconRobot size={size}/>` |
| ai-models :27 | `?? ''` (D15) |

G1 잔존(교체 안 함): `VerifyReportCard:194`·`CommentPanel:800`의 `'🔍'` — `provider:'verify'` 단락으로 평소 미표시.

## 4. 구현 사양 (v2 §4 확정본)

- **생성기**: `--assets`(복사·멱등·3,024 assert·LICENSE 동봉·**구버전 삭제 전 사라진 이름 diff 경고 G3**) · 인덱스 `lib/phosphor-index.json`(`[{n,c,t}]`, `*` 태그 제거)은 `icons:gen`이 함께 쓰고 `icons:check`가 diff. `phosphorPaths.ts`에 `PH_CORE_VERSION` export.
- **`PhAsset`**: mask URL `/icons/phosphor/<ver>/<weight>/<name>[-bold].svg` · `backgroundColor: currentColor` · `WebkitMask` 병기 · **title 있으면 `role="img"`+`aria-label`, 없으면 `aria-hidden`(G4)** · 404는 빈칸(onError 없음 — 방어는 쓰기: 피커가 인덱스 이름만 / 읽기: 정규식 불일치 → 기본).
- **`lib/folderIcon.ts`**(import 0): `isPhosphorIconName`(`^[a-z0-9-]+$`) · `resolveFolderGlyph`(asset: `weight = active?'bold':'regular'` / inline: `expanded?'folderOpen':isRoot?'folder':'folderSimple'` + `bold:!!active`) · `searchIndex`(name 부분일치 우선 → 한글 표 → tags · brands 제외 · 상한 80).
- **`FolderGlyph`**: `resolveFolderGlyph({icon, isRoot: isRoot(folder), expanded, active})` → asset이면 `PhAsset title={folder.name}` / inline이면 `PhIcon d={PH[key(+Bold)]}`.
- **피커**: 구조는 EmojiPickerPanel 본뜸(검색 → 로딩 IconLoader → 최근 → 그리드) · 카테고리 `<select>` 17종 한글명(금융·자연·소통·지도·여행·사물·미디어·시스템·게임·디자인·편집·건강·기술·개발·사무·상거래·화살표·사람·날씨) · 다중 소속 그대로 중복 노출 · `PICKER_WIDTH 316` · 셀 `<PhAsset size={20}/>` · `FolderIconPicker`는 패널만 교체(위치·닫기·`onSelect(name)`·⋯ 메뉴 문구·`handleSetFolderIcon`·`updateFolder` 전부 무변경).
- **한글 표**: `lib/phosphor-ko.json` — 이름 구성어·태그 → 한글 사전 기반 생성(브랜드 제외 1,434종 대상, 커버 안 되는 항목은 영문 검색 폴백) · 표본 검수 후 커밋.
- **Sidebar bold 예열**: 마운트 시 사용자 아이콘 bold URL fetch 한 줄(Q3 실물 판정 대상).

## 5. Twemoji 철거 전수 (D14)

파일 삭제: `EmojiPickerPanel.tsx` · `lib/emoji-data.ts` · `lib/twemoji-url.ts`.
수정: UnifiedToolbar(`EmojiIcon` :64 · `EmojiPickerDropdown` :370~ · 그룹 `{key:'emoji'}` :724 · import) · EditorPreview(:10·:319~) · PrintableContent(:8·:140~) · pdfPrint(:105~113 decode 대기만 — 200ms·폰트 대기 유지) · globals.css(:1042~) · settings(:174~194 → MIT 한 줄) · Sidebar·ListView·FolderView·FolderPathBar import · chatExtract :386 주석만 · package.json(`@yuna0x0/rehype-twemoji`·`emojibase-data` 제거 → `npm install`) · gen 스크립트(`smiley` 키·컨택트시트 '이모지') · roadmap Phase 39 절 표기.
철거 후 `grep -rnw`: `TwemojiImg` `EmojiPickerPanel` `EMOJI_PANEL_WIDTH` `twemoji` `emojibase` `TWEMOJI` `loadEmoji` → 0. localStorage 고아 키 방치(G5).

## 6. 영향·문서

- 영향: v2 §5 그대로 — 본문 이모지는 OS 글꼴(N8 수용) · PDF 파이프 무변경 · 기존 테스트 356건 무접촉 · +`test:foldericon` · node_modules −49 MB · CDN 참조 0 · 인쇄 화면에 폴더 아이콘 없음 · Safari `-webkit-mask` 병기.
- **6-7 저작권 고지 준칙(CLAUDE.md 신설)**: ① 제3자 시각 자산은 `THIRD_PARTY_LICENSES.md`에 전문 ② 배포 산출물에 고지 동봉(생성 파일 헤더·정적 디렉터리 LICENSE) ③ 설정 "정보/라이선스" 한 줄 ④ 크레딧 의무형(CC BY)은 ③ 필수, MIT는 ①②로 충족 ⑤ 상표는 사용자 선택 목록 제외 ⑥ 버전은 lock 고정+경로에 버전 ⑦ 자산을 그만 쓰면 고지도 거둔다.
- CLAUDE.md 아이콘 체계 절 보완(mask 예외·기본 폴더 3종·bold 규칙·본문 렌더 계층 없음) · `types/problem.ts:279` 주석 · roadmap M5 절 · settings 한 줄.

## 7. 실물 판정 Q1~Q7 (`--sheet` M5 절)

Q1 기본 3종×weight×크기 대비 · Q2 하위 `folder-open` 모양 점프 · Q3 bold 첫 전환 공백(예열 유무) · Q4 system 376종 fetch 항주·`<select>` vs 칩 · Q5 `lego-smiley` vs IconComment 무게감(대안 robot·user-focus·chats-circle) · Q6 robot 폴백 · Q7 Row 2 간격.

## 8. 덕수 확정 N1~N11 (전항 ✅ — 근거는 v2 §8)

N1 brands 설치·피커 제외 / N2 한글 표 (b) / N3 하위 펼침 `folder-open` / N4 옛 값 기본 표시 / N5 `<select>` / N6 헤더 글자 / N7 build 명시 연결(+E3 prebuild 삭제) / N8 본문 이모지 OS 글꼴 수용 / N9 ai-models `''`(D15) / N10 폴더 트리 2곳 편입 / N11 한글 표 동커밋.

## 9. 범위 밖

본문 아이콘 문법 · light/thin/fill/duotone · 문항 아이콘·폴더 색 · avatarEmoji **데이터** 정리 · 로고/favicon · raw_text 이모지 일괄 정리 · G1 `'🔍'` 폴백 2곳.

## 10. 커밋 계획 S1~S7

| # | 내용 |
|---|---|
| S1 | 생성기 `--assets`(+G3 diff)·인덱스 출력 · `PH_CORE_VERSION` · ICONS +7 · package.json(`icons:assets`·`predev`·`build` 통합·`prebuild` 삭제) · `.gitignore` · phosphorPaths.ts·phosphor-index.json 재생성 |
| S2 | `lib/folderIcon.ts` + `tests/folderIcon.test.mjs` + `test:foldericon` |
| S3 | Icons.tsx `PhAsset`(G4)·`IconAgent`·`IconRobot` · `FolderGlyph` · 소비처 8곳 교체(N10 포함) |
| S4 | `PhosphorIconPicker` + Sidebar 패널 교체 + `lib/phosphor-ko.json` |
| S5 | Twemoji 철거 전수(§5) · `smiley` 키 삭제 · deps 제거·lock 갱신 · grep 0 확인 · dev 끄고 build 통과 |
| S6 | Agent 3곳 · AIBrandIcon 폴백 · ai-models `''`(D15) |
| S7 | 문서(CLAUDE.md 준칙 절·아이콘 절 보완 · roadmap · types 주석 · settings) · `--sheet` M5 절 · 컨택트시트 재생성 |

git push는 덕수가 직접(규칙 3). 완료 시 이 문서를 §11 구현 기록과 함께 phasedocs로 이관(규칙 7).

## 11. 구현·검수 기록

### 11-1. 구현 완료 (2026-09-06 · 커밋 S1~S7)

| # | 커밋 | 내용 |
|---|---|---|
| S1 | `80a3ab8` | 생성기 `--assets`(멱등·3,024 assert·LICENSE 동봉·G3 diff 경고)·`--index`(`lib/phosphor-index.json`) · `PH_CORE_VERSION` · ICONS +7(56종) · build 명시 연결·`prebuild` 삭제(E3)·`predev` · `.gitignore` |
| S2 | `2d44325` | `lib/folderIcon.ts`(import 0) + `test:foldericon` **9건** |
| S3 | `de78980` | `PhAsset`(mask·G4 a11y)·`phAssetUrl`·`IconAgent`·`IconRobot` · `FolderGlyph` · 소비처 8곳 교체(N10 포함 — FolderPickerDialog 미지정 행은 `IconInbox`, FolderView와 통일) · Sidebar bold 예열 fetch |
| S4 | `f00b9e6` | `PhosphorIconPicker`(`<select>` 17종·brands 제외·최근 24·10열 316) · Sidebar 패널 교체 · **`lib/phosphor-ko.json` 1,414/1,434 커버**(이름 구성어 사전 기반 1회 생성, 미커버 20종은 영문 폴백) |
| S5 | `c782fb9` | Twemoji 전면 철거 — 파일 3 삭제 · 플러그인 2 · pdfPrint 대기 · globals.css · settings MIT 한 줄 · deps 2 제거(−12패키지·node_modules −49 MB) · ICONS `smiley` 삭제(**55종**) · grep 7키워드 0 · `npm run build` 통과 |
| S6 | `a8ab6e6` | Agent 라벨 3곳 → `IconAgent`(17/14/14) · AIBrandIcon 폴백 `IconRobot` · **ai-models 기본 avatarEmoji `''`(D15)** |
| S7 | `6e984ba` | 문서(CLAUDE.md 규약 2절 신설 · roadmap M5 절+Phase 39 철거 표기 · types 주석 · Final_V3 §11) · 컨택트시트 M5-1~M5-5 절 |
| S8 | `f2a5f3f` | 검수 반영 — agent 드로어 1행 제목 왼쪽 `IconAgent 16`(댓글 모드 `IconComment 16`과 대칭) |

- 로직 검증 356 → **365건**. `tsc --noEmit` 3회 통과 · `test:extract` 42건 무회귀 확인.
- 계획 대비 이탈 0. 사양 그대로 구현됨(v2 E1~E4·G1~G6·N9~N11 전항 반영).
- ⚠ S5에서 `git add -A`가 기존 미추적 파일(덕수 개인 메모·m4 스케치·Phase62 HTML 백업)을
  쓸어 담았다가 amend로 제거 — M5 문서 3개(v1·v2·Final_V3)만 커밋에 남겼다.

### 11-2. 덕수 검수 (2026-09-06)

- [x] **Q1~Q7 전항 정상** — 덕수 판정. 후퇴 갈래(Q2 (b)·Q5 대안 도안) 발동 없음
- [x] 검수 반영 1건: **agent 우측 드로어 1행 제목 왼쪽에 `IconAgent 16`**(S8) —
  댓글 모드의 `IconComment 16` + '댓글'과 대칭 구조라 삼항 한 줄
- [x] 검수 반영 2건(S9): **Row 2 `$`·`$$`만 M3 자체 stroke 도안 복원 + 조정** — 덕수 판정
  "둘만 어색". M4 D7(currency-dollar-simple·비등방 x0.62 합성) 뒤집힘. 브라켓은 안
  붙인다(M4가 Row 2 전체에서 폐기한 장식). 크기 조정 왕복 2회(덕수 실물 판정):
  원본 viewBox 64(글리프 10px — 작다) → 44 크롭(14.5px — "너무 크다") → **52 크롭
  확정(12.3px = 중간)**. 렌더는 20px 유지(줄 리듬 불변) · stroke 3.25 = 시각 1.25px
  (Phosphor 동일 굵기) · **`$$` 두 달러 간격 6→2유닛(1/3)**. `SVG_PROPS`는 소비처 0이
  되어 삭제. 컨택트시트 Row 2·§6 갱신
- [x] 이 문서 `docs/phasedocs/` 이관 완료(규칙 7 — M4 전례대로 검수 완료 시점에. v1·v2는 phaseSketch)
- [ ] git push(덕수) · Vercel 빌드 로그에 `[icons:assets] OK — 3024개` 확인 후 Cmd+Shift+R → 배포 완료 표기
