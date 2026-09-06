# 개선묶음 M5 — 이모지(Twemoji) 폐기 · 폴더 아이콘 Phosphor 카탈로그 전환 구현 계획서 v1 (덕수 확정 · N1~N8)

> 계보: 덕수 메모 "이모지 시스템 교체"(2026-09-06) → 범위 문답 2회(2026-09-06: ① 폴더 아이콘이 대상 · '아카이브'는 취소 · bold = 활성 폴더 행 ② **Twemoji는 없애고 Phosphor로 통일** · 본문에 아이콘을 쓸 일은 없음) → v1 web(2026-09-06) → **덕수 확정(2026-09-06): N1~N8 전부 권장안, N3는 (a)** — 이 판이 v1 완성판이다. 다음: CLI 실측 교차검토 v2 → web 재검증 v3.
> 기준: `kimdeoksoo-71/mathory` **origin/main 0f64647**(M4 완료 커밋, 2026-09-06 03:08 KST) · `@phosphor-icons/core` **2.1.1** 실물 대조(assets·dist 메타데이터).
> 결정은 전부 닫혔다(§2 D1~D14 · §8 N1~N8 ★). 열린 것은 §7의 착수 시 실물 판정뿐이다.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 취지(덕수) | 현재 이모지(Twemoji)는 모양이 복잡하고 컬러가 다양해 "보수적인 차분함 · 착오 없이 작동하는 안정감"과 맞지 않는다 → 단색 Phosphor로 **통일**. 아이콘 용도는 두 가지 — 앱 버튼(M4 완료) · 폴더 아이콘 지정(M5) |
| 범위(문답 확정) | **Twemoji 전면 철거**(툴바 '이모지' 버튼 · 폴더 아이콘 피커 · 본문 렌더 플러그인 · CDN · 인쇄 대기 · CC BY 고지 · 의존성 2개) + **폴더 아이콘을 Phosphor 카탈로그(검색 피커)로** + Agent 라벨 → `lego-smiley` + `AIBrandIcon` 폴백. '아카이브 아이콘'은 덕수가 만든 최상위 폴더였으므로 항목 삭제. 본문에 Phosphor를 넣는 문법은 만들지 않는다(§1-3 ①) |
| 실측 | `Folder.icon`(유니코드)을 `TwemojiImg`로 그리는 자리 **6곳**(같은 삼항식 6번 복제) + 툴바 버튼 1 + 렌더 플러그인 2(EditorPreview·PrintableContent) + `pdfPrint` 대기 + `globals.css` 규칙 + 설정 고지. "Agent"는 아이콘이 아니라 **글자 라벨** 4곳 |
| 결정(덕수 확정) | ① 카탈로그 = Phosphor **regular 1,512 + bold 1,512 전부 설치**(self-host) ② 사용자 선택은 regular, **활성 폴더 행에서만 시스템이 bold** ③ 기본 폴더: 최상위 `folder` · 하위 `folder-simple` · 펼침 `folder-open` ④ 렌더는 **정적 SVG + CSS mask**(`currentColor` 유지) — 인라인 path는 시스템 아이콘에만 ⑤ Twemoji 철거는 데이터 무접촉(raw_text의 이모지 문자는 남고 OS 글꼴로 보인다) ⑥ 저작권 고지 준칙 명문화 ⑦ **N1~N8 확정**: 브랜드 로고 78종 피커 제외 · 한글 키워드 표 1회 생성 · 하위 폴더 펼침도 `folder-open` · 옛 유니코드 값은 기본 아이콘 · 카테고리 `<select>` · ListView "Agent" 헤더 글자 유지 · `build` 명시 연결 · 본문 기존 이모지는 OS 글꼴 수용 |
| 지적(§1-3) | ① Phosphor는 이모지가 아니라 **UI 아이콘**(유니코드 없음) ② "빠짐없이 설치"는 가능하나 **`brands` 78종(각사 로고)은 사용자 선택에서 제외** 권고(상표) ③ Phosphor 태그는 영어뿐 — 한글 검색은 표 생성 필요(N2) ④ `folder-simple`에는 **open 변형이 없다**(N3) ⑤ 기존 이모지 값이 든 폴더(N4) ⑥ 인라인 path로 1,512×2를 실으면 1.28 MB — 방식 전환(D2) ⑦ Twemoji 철거 후 **본문의 기존 이모지 문자는 OS 글꼴**로 — Phase 39가 없애려던 "OS마다 다른 모양"이 돌아오지만 본문에 이모지를 쓸 일이 없다는 전제(N8) |
| 무접촉 | 서버 0 · Firestore 규칙 0 · 스키마 0(`icon: string` 그대로, 값만 이름으로) · 프롬프트 0 · raw_text 0 · exportMd 0 · 로직 테스트 기존분 0 |

---

## 1. 현황 — 실측 (0f64647)

### 1-1. 이모지 시스템의 세 갈래와 처분

| 갈래 | 저장 | 표시 | 자리 | M5 |
|---|---|---|---|---|
| A. 폴더 아이콘(Phase 39 후반) | `Folder.icon` 순수 유니코드 | `TwemojiImg`(jsDelivr `jdecked/twemoji@17.0.2` SVG `<img>`) | 6곳(§3-1) + 피커 `FolderIconPicker`(Sidebar ⋯ "아이콘 변경") | **Phosphor로 교체** |
| B. 본문 이모지(Phase 39) | raw_text 유니코드 | `rehype-twemoji`(EditorPreview :319 · PrintableContent :140) + `pdfPrint` decode 대기(:105~113) + `globals.css img.twemoji`(:1042) | 툴바 `EmojiPickerDropdown`(:370) · `EmojiIcon`(`smiley`, :64) · 그룹 등록 :724 | **철거**(문답 ②). 데이터 무접촉 |
| C. UI 글자 이모지 | 코드 상수 | 시스템 글꼴 | `AIBrandIcon` 폴백 `'🤖'`(:64) · `lib/ai-models.ts:27` 기본값 · CommentPanel `emoji: '🔍'`(:800 — `provider: 'verify'`라 `IconSearchPlain`으로 단락, 글자가 보이지 않음) | 폴백 1곳만 교체(D9) |

A·B가 공유하는 `EmojiPickerPanel.tsx`(검색·카테고리·최근·그리드) · `lib/emoji-data.ts`(emojibase ko 806 KB 동적 import) · `lib/twemoji-url.ts`(버전·URL·`TWEMOJI_IGNORE`)는 M5 후 소비처가 0이 된다 → 파일 삭제 · `emojibase-data`·`@yuna0x0/rehype-twemoji` 의존성 제거(§3-4).

### 1-2. 폴더 아이콘 소비처 6곳 — 같은 삼항식의 복제

| 파일:줄 | 현행 | 크기 | 맥락 |
|---|---|---|---|
| `Sidebar.tsx:330` | `icon ? TwemojiImg : <IconFolder/>` | 18(기본) | 폴더 행. `active`·`expanded`·`hasChildren`·`depth` prop 전부 있음(:203~219) |
| `Sidebar.tsx:483` | 〃 | 15 | `FolderMoveMenu` 대상 목록. "최상위" 항목은 `IconFolder 15`(:472) |
| `ListView.tsx:351` | 〃 | 16 | Phase 63 리스트 폴더 행(현재 폴더의 하위) |
| `FolderView.tsx:559` | 〃 | 18 | 머리 제목 옆(미지정·휴지통·공유는 별도 아이콘) |
| `FolderView.tsx:701` | 〃 | 14 | 하위 폴더 칩 |
| `FolderPathBar.tsx:21` | `FolderGlyph` 로컬 컴포넌트 | 14 | 브레드크럼 — 유일하게 함수로 뺐다 |

`SheetImportModal.tsx:724·728`은 폴더 트리를 그리지만 **`IconFolder`만** 쓰고 사용자 아이콘을 무시한다(현행 불일치 — D10 선택 항목).

### 1-3. 메모 검토 — 지적 7건

1. **Phosphor는 이모지가 아니다.** 메모의 "phosphor의 모든 이모지"는 UI 아이콘 1,512종이다. 유니코드 코드포인트가 없으므로 본문(raw_text)에 넣으려면 `:ph-folder:` 같은 Mathory 전용 문법 + rehype 플러그인 + PDF·exportMd·chatExtract·GAS 계약을 전부 열어야 한다 — "저장은 유니코드만, 렌더 시점 변환" 계약(Phase 39·`preprocessLocale`·`\tag` 공통 철학)이 깨진다. 본문에 아이콘을 쓸 일이 없다고 확인됐으므로 **만들지 않는다**(기록만).
2. **"빠짐없이 설치"는 가능하지만 방식이 바뀌어야 한다.** M4는 49종의 path 문자열을 `phosphorPaths.ts`에 인라인했다. 같은 방식으로 1,512종을 실으면 regular **639 KB(gzip 189 KB)**, bold까지 **1.28 MB(gzip 378 KB)** — 폴더 아이콘 몇 개를 그리려고 매 세션 이 청크를 받는 건 과하다. 정적 SVG self-host + CSS mask로 간다(D2). CLAUDE.md의 "별도 `.svg`로 빼면 `currentColor`가 끊긴다"는 `<img>` 얘기이고 **mask는 유지된다**(alpha만 쓰고 색은 `background-color: currentColor`) — 규약 문안을 보완한다(§4-7).
3. **`brands` 카테고리 78종은 사용자 선택에서 빼는 게 안전하다.** `apple-logo`·`google-logo`·`github-logo` 등 각사 로고다. 도안의 MIT와 별개로 로고는 상표라, "폴더 아이콘으로 고르세요"라고 내미는 목록에 두지 않는 편이 메모의 "저작권법 준수" 취지에 맞다. 자산은 설치(빠짐없이)하되 피커에서만 숨긴다 — N1.
4. **한국어 검색이 사라진다.** emojibase는 한글 label·tags를 줬지만 Phosphor 메타데이터(`dist/index`)의 tags는 영어뿐이다. 카테고리 18개 이름만 한글로 붙이면 "폴더·별·책" 같은 한글 검색은 안 된다 — N2.
5. **`folder-simple`에는 open 변형이 없다**(2.1.1 실물: `folder-open`만 있고 `folder-simple-open` 없음). "펼쳐지면 folder-open"을 하위 폴더에도 적용하면 탭(귀) 없는 모양 → 탭 있는 모양으로 **가족이 바뀐다** — N3.
6. **기존 값.** 이미 이모지가 저장된 폴더가 있다. 스키마는 `string`이라 그대로 두고 값만 Phosphor 이름(`^[a-z0-9-]+$`)으로 쓰면 되지만, 옛 유니코드 값을 어떻게 보일지 정해야 한다 — N4.
7. **Twemoji 철거의 대가.** raw_text에 이미 든 이모지 문자(있다면)는 그대로 남고 미리보기·PDF에서 **OS 글꼴 이모지**로 보인다(macOS·Windows·모바일 모양이 다르다 — Phase 39가 없애려던 현상). 본문에 이모지를 쓸 일이 없다는 전제이므로 수용하되, 문서에 남긴다 — N8. 대안(렌더 플러그인만 잔존)은 CDN·CC BY 고지·의존성이 남아 "통일"이 아니다.

부수 지적: "Agent 아이콘 교체"는 **글자 라벨 → 아이콘**이다. "Agent" 글자는 검수 13차(M2)에서 "통짜 13/500"으로 확정했던 자리라, 교체는 그 판정을 폐기하는 것임을 기록한다(D8).

---

## 2. 결정사항 (★ = 덕수 확정 — 2026-09-06 N1~N8 포함)

| # | 결정 | 내용 · 근거 |
|---|---|---|
| **D1 ★** | 범위 | Twemoji 전면 철거(§3-4) + 폴더 아이콘(갈래 A) Phosphor 카탈로그 + Agent 라벨 + `AIBrandIcon` 폴백. 본문용 아이콘 문법은 만들지 않음. '아카이브' 항목 삭제 |
| **D2 ★** (N7) | 카탈로그 공급 방식 | `scripts/gen-phosphor-paths.mjs --assets`가 `@phosphor-icons/core/assets/{regular,bold}` **3,024 파일**을 `public/icons/phosphor/<core 버전>/{regular,bold}/`로 복사(+ `LICENSE` 동봉). **gitignore**(12 MB 생성물) → `predev`·`build`에서 생성. 사용자 선택 아이콘은 `<PhAsset name weight size>`(CSS mask + `currentColor`)로 그린다. 시스템 아이콘(기본 폴더 3종·bold 3종·lego-smiley·robot)은 M4대로 **인라인 path**(첫 페인트에 fetch 0·깜빡임 0). 기각안: (a) 전량 인라인 청크 1.28 MB (b) Firestore에 path 문자열 동봉(데이터에 도안을 넣는 것 — "저장은 의미값만" 위반) (c) 외부 `<svg><use href=sprite#id>`(650 KB 선적재로 (a)와 같음) |
| **D3 ★** | weight | 피커는 **regular만** 노출. **활성(선택) 폴더 행**의 아이콘만 bold — 글자가 700으로 굵어지는 조건(Sidebar `active`, :64·:302)과 동일하라 규칙이 하나. 사용자 선택 아이콘도 활성 행에서는 같은 이름의 bold 파일로 |
| **D4 ★** | 기본 폴더 아이콘 | 최상위(`isRoot`) `folder` · 하위 `folder-simple` · 펼침(`hasChildren && expanded`) `folder-open`. **하위 폴더도 펼치면 `folder-open`(N3 (a) ★)** — 모양 점프는 Q2 실물에서만 확인 |
| **D5** | 공용 컴포넌트 | `components/ui/FolderGlyph.tsx` 하나가 6곳(+SheetImportModal)의 삼항식을 대체. 입력 `{ folder, size, active?, expanded? }` → 규칙은 `lib/folderIcon.ts`(import 0, 단위 테스트) |
| **D6 ★** (N1·N2·N5) | 피커 | `components/ui/PhosphorIconPicker.tsx` 신설 — 검색(영문 name·tags + **한글 키워드 표 `lib/phosphor-ko.json`(N2 ★ — 표가 오기 전엔 영문만으로 같은 코드가 동작)**) · 카테고리 **`<select>`(N5 ★, 17종 한글명 — 브랜드 제외)** · 최근 사용(localStorage `mathory:folder-icon:recent`, 24) · 10열 그리드(셀 30 → 폭 316). 메타데이터 `lib/phosphor-index.json`(163 KB · gzip 27 KB)을 **첫 오픈 시 동적 import**(emojibase 선례). **`brands` 78종은 피커에서 제외(N1 ★ — 자산은 설치)** |
| **D7 ★** (N4) | 값 형식 | `Folder.icon`은 그대로 `string`. Phosphor 이름은 `^[a-z0-9-]+$` — 유니코드 이모지와 절대 겹치지 않는다. 쓰기는 피커만(인덱스에 있는 이름만). Firestore 규칙 무변경(`folders`는 필드 검증 없음, rules:449). **옛 유니코드 값은 기본 아이콘으로 보이고 데이터는 그대로(N4 ★)** |
| **D8 ★** (N6) | Agent | `IconAgent = lego-smiley`. EditorView Row1(:3333, **17** = 옆 `IconComment 17`) · ProblemView 제목행(:832, **14**) · FolderView 카드 배지(:850, **14** = 옆 `IconComment 14`). ListView 칼럼 헤더 "Agent"(`listColumns.ts:28`)는 **글자 유지** — 다른 헤더("댓글"·"원본인증")도 글자다(N6). `title="agent 열기"` 툴팁으로 단어는 남는다 |
| **D9** | `AIBrandIcon` 폴백 | `'🤖'` 글자 → Phosphor `robot`(tags: automaton·ai). `ai_models.avatarEmoji` **데이터 무변경**(알 수 없는 provider일 때만 폴백이 보인다) · `lib/ai-models.ts:27` 기본값 문자열 무변경 |
| **D10** | SheetImportModal 폴더 트리 | `FolderGlyph`로 통일(현행은 사용자 아이콘 무시). 선택 — 비용 2줄 |
| **D11** | 저작권 고지 준칙 | §4-7. Phosphor(MIT)는 **고지 동봉** 의무 → `THIRD_PARTY_LICENSES.md`(있음) + 생성 파일 헤더(있음) + **`public/icons/phosphor/<ver>/LICENSE` 동봉(신규)** + 설정 "정보/라이선스" 한 줄(신규). **Twemoji CC BY 4.0 줄은 삭제**(자산을 더 쓰지 않으므로 고지 의무도 끝난다) |
| **D12 ★** (N7) | 빌드 배선 | 자산 복사는 실패가 **눈에 보이는** 단계(없으면 사용자 아이콘 전부 빈칸)라 `prebuild` 의존을 끊고 `"build": "npm run icons:check && npm run icons:assets && next build"`로 **명시 연결**(M4 N6의 (b)). `"predev": "npm run icons:assets"`. 복사는 멱등·3,024개 카운트 assert |
| **D13** | 캐시 | 경로에 core 버전(`/icons/phosphor/2.1.1/…`) → 버전 업이 곧 URL 변경. `next.config.mjs`가 **없으므로**(실측) 헤더 규칙은 두지 않고 Next 기본(ETag 304)으로. 선택: `headers()`로 immutable 1년 — v2 판정 |
| **D14 ★** (N8) | Twemoji 철거 | §3-4 전수. `chatExtract.ts:386`의 `img → alt` 분기는 **일반 규칙**(이미지 alt를 텍스트로)이라 코드는 두고 주석만 고친다(`test:extract` 무접촉). `smiley` 키는 ICONS 표에서 제거(툴바 이모지 버튼이 사라지므로 소비처 0 — 단어 경계 grep 후) |

---

## 3. 전수 대응표

### 3-1. 폴더 아이콘 소비처 → `FolderGlyph`

| 자리 | 크기 | `active` | `expanded` | 비고 |
|---|---|---|---|---|
| Sidebar 폴더 행(:330) | 18 | `active` prop | `hasChildren && expanded` | 유일하게 bold·open이 다 걸리는 자리 |
| Sidebar `FolderMoveMenu`(:483) | 15 | — | — | "최상위" 항목 `IconFolder 15` 유지(폴더가 아님) |
| ListView 폴더 행(:351) | 16 | — | — | 하위 폴더이므로 `folder-simple`이 기본 |
| FolderView 머리(:559) | 18 | — | — | 미지정·휴지통·공유 분기 앞에 그대로 |
| FolderView 하위 칩(:701) | 14 | — | — | |
| FolderPathBar(:21) | 14 | — | — | 로컬 `FolderGlyph` 삭제 → 공용 import |
| SheetImportModal(:724·728) | 14 | — | — | D10 선택 |

### 3-2. 시스템 아이콘 변경분 (ICONS 표 · 인라인)

| 키 | 파일 · weight | 소비 |
|---|---|---|
| `folder` | folder · regular | 기존(IconFolder) |
| `folderSimple` · `folderOpen` | 각 regular | 하위·펼침 기본 |
| `folderBold` · `folderSimpleBold` · `folderOpenBold` | 각 **bold** | 활성 행 기본 아이콘(D3) |
| `legoSmiley` | lego-smiley · regular | IconAgent(D8) |
| `robot` | robot · regular | AIBrandIcon 폴백(D9) |
| ~~`smiley`~~ | — | **삭제**(툴바 이모지 버튼 철거, D14) |

49 − 1 + 7 = **55종**. 2.1.1 실물: 전부 실재·단일 `<path>`(생성기 assert — v2 실측).

### 3-3. Agent 라벨 3곳 + 폴백 1곳

| 자리 | 현행 | 후 |
|---|---|---|
| `EditorView.tsx:3333` | `<span 500/13>Agent</span>{n}` | `<IconAgent size={17}/>{n}` — 왼쪽 `IconComment 17`과 같은 규격 |
| `ProblemView.tsx:832` | `<span 600>Agent</span>{n}` | `<IconAgent size={14}/>{n}` — 왼쪽 `IconComment 14` |
| `FolderView.tsx:850` | `<span 600>Agent</span><span>{n}</span>` | `<IconAgent size={14}/><span>{n}</span>` |
| `AIBrandIcon.tsx:64` | `<span>{fallbackEmoji \|\| '🤖'}</span>` | `fallbackEmoji`가 있으면 그대로(데이터), 없으면 `<IconRobot size/>` |

### 3-4. Twemoji 철거 전수 (D14)

| 자리 | 처분 |
|---|---|
| `components/editor/EmojiPickerPanel.tsx` (`EmojiPickerPanel`·`TwemojiImg`·`EMOJI_PANEL_WIDTH`) | **파일 삭제** |
| `lib/emoji-data.ts` · `lib/twemoji-url.ts`(`TWEMOJI_*`·`toTwemojiCodepoint`·`TWEMOJI_IGNORE`) | **파일 삭제** |
| `UnifiedToolbar.tsx` `EmojiIcon`(:64) · `EmojiPickerDropdown`(:366~417) · 그룹 `{ key: 'emoji' }`(:724) · import(:18) | 삭제. Row 2 버튼 하나 줄어든다(실물 Q7) |
| `EditorPreview.tsx:10~11·:319~325` · `PrintableContent.tsx:8~9·:140~146` | `rehypeTwemoji` 항목·import 삭제. `rehypeKatex` 뒤 순서 무관해짐 |
| `lib/pdfPrint.tsx:105~113` | `img.twemoji` decode 대기 삭제(200 ms 지연·`waitForPrintFonts`는 그대로) |
| `app/globals.css:1040~1048` | `img.twemoji` 규칙 삭제 |
| `app/settings/page.tsx:173~194` | Twemoji CC BY 문단 → Phosphor MIT 한 줄로 교체(D11) |
| `Sidebar.tsx:15` · `ListView.tsx:19` · `FolderView.tsx:31` · `FolderPathBar.tsx:17` | `TwemojiImg` import 삭제(§3-1로 대체) |
| `lib/chatExtract.ts:386` | 주석 "twemoji는 alt에…" → "이미지는 alt를 텍스트로" (코드 무변경) |
| `package.json` | `@yuna0x0/rehype-twemoji` · `emojibase-data` 제거 → `npm install`로 lock 갱신 |
| `scripts/gen-phosphor-paths.mjs` | `smiley` 키·컨택트시트 Row 2의 '이모지' 항목 삭제 |
| `docs/roadmap.md` Phase 39 절 | "M5에서 철거" 표기(역사는 남긴다) |

철거 후 `grep -rnw` 대상: `TwemojiImg` `EmojiPickerPanel` `EMOJI_PANEL_WIDTH` `twemoji` `emojibase` `TWEMOJI` `loadEmoji` — 전부 0이어야 한다(M4 N8 규약).

---

## 4. 구현 사양

### 4-1. 생성기 확장 `scripts/gen-phosphor-paths.mjs`

```
--assets   @phosphor-icons/core/assets/regular/*.svg · bold/*-bold.svg → public/icons/phosphor/<ver>/{regular,bold}/
           + core LICENSE → public/icons/phosphor/<ver>/LICENSE
           멱등(같은 내용이면 무쓰기) · 완료 후 파일 수 3,024 assert · 옛 버전 디렉터리는 삭제
--index    dist/index(icons 메타) → lib/phosphor-index.json  [{ n, c:[categories], t:[tags(*new*·*updated* 제거)] }]
           163 KB · 커밋 대상 · icons:check의 diff 대상에 포함
```

- 자산 위치는 M4대로 `require.resolve('@phosphor-icons/core/assets/regular/folder.svg')`의 dirname에서(exports 맵이 `./assets/<weight>/*.svg`를 내보냄 — M4 C11 실측). 메타는 패키지 메인 `require('@phosphor-icons/core').icons`(UMD, 1,512건 실측 · `name`·`categories`·`tags`·`alias`).
- `phosphorPaths.ts`에 `export const PH_CORE_VERSION = '2.1.1'` — `PhAsset`의 URL과 복사 디렉터리가 같은 상수를 본다.
- `package.json`: `"icons:assets"` · `"icons:index"`(`icons:gen`에 포함) · `"predev"` · `"build"` 명시 연결(D12). `.gitignore`에 `public/icons/phosphor/`.

### 4-2. `components/ui/Icons.tsx` 추가

```tsx
/** 카탈로그 아이콘 — 정적 SVG를 CSS mask로 씌워 currentColor를 유지한다(사용자 선택 폴더 아이콘 전용).
 *  UI 상수 아이콘에는 쓰지 말 것 — 그쪽은 PhIcon(인라인 path). */
export function PhAsset({ name, weight = 'regular', size = 16, title }: {
  name: string; weight?: 'regular' | 'bold'; size?: number; title?: string;
}) {
  const url = `/icons/phosphor/${PH_CORE_VERSION}/${weight}/${name}${weight === 'bold' ? '-bold' : ''}.svg`;
  const mask = `url("${url}") center / contain no-repeat`;
  return (
    <span role="img" aria-label={title} title={title} style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      backgroundColor: 'currentColor', WebkitMask: mask, mask,
    }} />
  );
}
export const IconAgent = (p: IconProps) => <PhIcon d={PH.legoSmiley} size={14} {...p} />;
export const IconRobot = (p: IconProps) => <PhIcon d={PH.robot} size={14} {...p} />;
```

- mask는 alpha만 쓰므로 회색(`--text-muted`)·액센트·opacity 0.75(Sidebar 비활성) 전부 텍스트 색을 따른다 — 인라인 `PhIcon`과 같은 외관.
- 404(있을 수 없는 이름)는 **빈칸**으로 보인다 — mask에는 onError가 없다. 방어는 쓰기 쪽(피커가 인덱스에 있는 이름만 쓴다)과 읽기 쪽(`isPhosphorIconName` 불일치 → 기본 폴더)에서.
- 활성화 시 bold 파일을 처음 받는 순간 1프레임 비어 보일 수 있다 — Sidebar 마운트 시 사용자 아이콘의 bold URL을 `fetch`로 미리 데워 두는 한 줄(Q3 실물).

### 4-3. `lib/folderIcon.ts` (import 0 · `npm run test:foldericon`)

```ts
export const isPhosphorIconName = (v: string | undefined | null): v is string => !!v && /^[a-z0-9-]+$/.test(v);
export type FolderGlyphSpec =
  | { kind: 'inline'; key: 'folder' | 'folderSimple' | 'folderOpen'; bold: boolean }
  | { kind: 'asset'; name: string; weight: 'regular' | 'bold' };
export function resolveFolderGlyph(a: { icon?: string | null; isRoot: boolean; expanded?: boolean; active?: boolean }): FolderGlyphSpec {
  if (isPhosphorIconName(a.icon)) return { kind: 'asset', name: a.icon, weight: a.active ? 'bold' : 'regular' };
  // 옛 유니코드 값·빈 값 → 기본 아이콘(N4)
  const key = a.expanded ? 'folderOpen' : a.isRoot ? 'folder' : 'folderSimple';   // N3 (a) 확정 — 펼침이면 depth 무관 folder-open
  return { kind: 'inline', key, bold: !!a.active };
}
export function searchIndex(index: IndexItem[], q: string, opts: { excludeBrands: boolean; ko?: Record<string, string[]> }): IndexItem[] { /* name 부분일치 우선 → tags → (ko 표) · 상한 80 */ }
```

테스트: 루트/하위/펼침/활성 8조합 · 유니코드 값 → 기본(N4) · `folder-star`(regular/bold) · 검색(brands 제외·상한·한글 표 유무).

한글 키워드 표(N2 ★) `lib/phosphor-ko.json`: `{ "folder-star": ["폴더","별","즐겨찾기"], … }` — 1,434종(브랜드 제외) × 2~4개. 덕수의 LLM 파이프라인으로 1회 생성해 커밋(Mathory 자체 데이터). `searchIndex`는 표가 없으면 영문만으로 동작하므로 생성 시점이 착수를 막지 않는다. 검색 순서: name 부분일치 → 한글 표 → tags · 상한 80.

### 4-4. `components/ui/FolderGlyph.tsx`

```tsx
export function FolderGlyph({ folder, size = 16, active, expanded }: { folder: Folder; size?: number; active?: boolean; expanded?: boolean }) {
  const s = resolveFolderGlyph({ icon: folder.icon, isRoot: isRoot(folder), expanded, active });
  if (s.kind === 'asset') return <PhAsset name={s.name} weight={s.weight} size={size} title={folder.name} />;
  return <PhIcon d={PH[s.bold ? `${s.key}Bold` : s.key]} size={size} />;
}
```

`isRoot`는 `lib/folder-tree.ts:13`(있음). Sidebar 행은 `active`·`hasChildren && expanded`를 넘기고 나머지는 `folder`·`size`만.

### 4-5. `components/ui/PhosphorIconPicker.tsx`

- 구조는 (삭제되는) `EmojiPickerPanel`을 본뜬다 — 검색 인풋 → 로딩 `IconLoader` → 최근 → 그리드. 차이: 카테고리는 탭이 아니라 **`<select>`**(N5 ★ — 17종은 폭 316에 탭으로 못 들어간다) · 그리드 10열(셀 30 → `PICKER_WIDTH = 316`) · 셀은 `<PhAsset name size={20}/>` · `onSelect(name)`.
- 카테고리 한글명 17(브랜드 제외, N1 ★): 금융 · 자연 · 소통 · 지도·여행 · 사물 · 미디어 · 시스템 · 게임 · 디자인 · 편집 · 건강 · 기술·개발 · 사무 · 상거래 · 화살표 · 사람 · 날씨. 한 아이콘이 여러 카테고리에 속한다(960종) — 그대로 중복 노출.
- 한 카테고리 최대 376종(system) → mask URL 376건 동시 fetch(각 ≈500 B, 동일 출처). Twemoji 피커는 CDN에서 같은 규모를 `loading="lazy"`로 받았다. 부담이면 행 단위 `IntersectionObserver` 마운트(Q4 실물).
- `FolderIconPicker`(Sidebar :493)는 패널만 갈아 끼운다 — 위치·외부 클릭 닫기·`onSelect` 그대로. `EMOJI_PANEL_WIDTH` → `PICKER_WIDTH`. ⋯ 메뉴의 "아이콘 변경"·"기본 아이콘으로" 문구 그대로. `AppShell.handleSetFolderIcon`(:475) 무변경(문자열).

### 4-6. Agent · 폴백 (§3-3) — 4곳, 각 1~2줄. Twemoji 철거(§3-4) — 삭제 위주.

### 4-7. 문서·규약

- **저작권 고지 준칙(CLAUDE.md 신설 절 · D11)**: ① 제3자 시각 자산을 들일 때 `THIRD_PARTY_LICENSES.md`에 라이선스 **전문** ② 배포 산출물에 고지 **동봉**(생성 파일 헤더 · 정적 디렉터리 `LICENSE`) ③ 설정 "정보/라이선스"에 한 줄(이름·출처 링크·라이선스) ④ **크레딧 의무형**(CC BY 등)은 ③이 필수, MIT형은 ①②로 충족·③은 관례 ⑤ **상표(브랜드 로고)는 사용자 선택 목록에서 제외** ⑥ 버전은 `package.json` 고정 + 경로에 버전 ⑦ 자산을 그만 쓰면 고지도 같이 거둔다(Twemoji 선례).
- `app/settings/page.tsx` 정보 섹션: "아이콘은 Phosphor Icons(phosphoricons.com)를 사용하며 MIT 라이선스로 배포됩니다" 한 줄(Twemoji 문단 대체).
- CLAUDE.md "아이콘 체계" 절 보완: "별도 `.svg` 파일은 `<img>`에서 `currentColor`가 끊긴다 — **카탈로그(사용자 선택)는 CSS mask로 색을 잇는다**(`PhAsset`). UI 상수 아이콘은 계속 인라인 path." · 기본 폴더 3종·bold 규칙 · `Folder.icon` = Phosphor 이름 · 피커 regular 한정 · **본문에는 아이콘·이모지 렌더 계층이 없다(M5에서 Twemoji 철거 — raw_text의 이모지 문자는 OS 글꼴)**.
- `types/problem.ts:279` 주석: "폴더 아이콘 — Phosphor 이름(`^[a-z0-9-]+$`). 옛 유니코드 값은 기본 아이콘으로 보인다(M5)".
- `docs/roadmap.md` M5 절 + Phase 39 절에 철거 표기.

---

## 5. 영향 범위·무회귀 점검

| 영역 | 영향 |
|---|---|
| 서버 · 규칙 · 스키마 · GAS · 프롬프트 · raw_text | **0** |
| 본문 렌더 | `rehypeTwemoji` 제거 → 이모지 문자는 OS 글꼴(N8). KaTeX·rehypeRaw 순서 무변경 |
| PDF | decode 대기 삭제 — 인쇄 파이프 나머지(200 ms·폰트 대기·스냅샷) 무변경 |
| exportMd · chatExtract | 0(chatExtract는 주석만) |
| 로직 테스트 | +`test:foldericon`(import 0 규약). 기존 356+건 무접촉(`test:extract` 포함) |
| 호출부 | 폴더 아이콘 6곳(+1) → `FolderGlyph` · Agent 3곳 · 폴백 1곳 · Sidebar 피커 패널 교체 · 툴바 그룹 1개 제거 |
| 빌드 | `build` 명시 연결(D12). Vercel Build Command가 `next build` 직접 지정이면 `icons:assets`가 안 돌아 **사용자 아이콘 전부 빈칸** — 착수 체크리스트 1번(M4 Q7 결과가 기록에 없다) |
| 정적 산출물 | `public/icons/phosphor/2.1.1/` 3,024 파일 12 MB(git 제외, 배포 포함). 첫 페인트 fetch = 사용자 아이콘 개수 × ≈500 B |
| 번들 | 인라인 path +6종 ≈ 3.5 KB. 피커 인덱스 163 KB는 첫 오픈 시 동적 import(gzip 27 KB). **−** emojibase 806 KB 청크 · rehype-twemoji · CDN 요청 0 |
| 접근성 | `PhAsset`은 `role="img"` + `aria-label`(폴더명) — `TwemojiImg`의 `alt`와 동급 |
| 브라우저 | CSS mask — Chrome/Edge 120+ 무접두, Safari `-webkit-mask` 병기. 인쇄 화면에는 폴더 아이콘이 없다 |
| 다크 테마 | `currentColor` 승계 — 무변경 |
| 외부 의존 | jsDelivr CDN 참조 0 → 오프라인·차단망에서도 아이콘이 나온다(self-host) |

---

## 6. 범위 밖 (기록)

- 본문용 아이콘 문법(§1-3 ①) — 만들지 않는다.
- Phosphor light·thin·fill·duotone weight — 설치하지 않는다(사용자 regular · 시스템 bold).
- 문항(problem) 단위 아이콘 · 폴더 색상.
- `ai_models.avatarEmoji` 데이터 정리.
- 로고·favicon.
- raw_text에 남은 이모지 문자의 일괄 정리(있는지조차 조사하지 않는다 — 데이터 무접촉 원칙).

---

## 7. 열린 질문 — 착수 시 실물 판정 (컨택트시트 `--sheet`에 M5 절 추가)

1. **Q1** 기본 폴더 3종 × regular/bold × 14/15/16/18 — Sidebar 활성 행에서 bold가 글자 700과 한 덩어리로 읽히는지, 비활성 opacity 0.75와의 대비.
2. **Q2** `folder-open` 하위 폴더 적용(N3 (a))의 모양 점프 — 접힘 `folder-simple` ↔ 펼침 `folder-open` 나란히.
3. **Q3** `PhAsset` bold 전환 1프레임 공백 — 예열 fetch 유무 비교.
4. **Q4** 피커: `system` 376종 스크롤 시 fetch 폭주 체감 · `<select>` vs 칩 행.
5. **Q5** `lego-smiley` 17/14 — `IconComment`(chat-text) 옆 무게. 대안 후보 `robot`·`user-focus`·`chats-circle`은 실물에서만(덕수).
6. **Q6** `robot` 폴백 14/16 — CommentPanel 참여자 칩.
7. **Q7** Row 2에서 '이모지' 버튼이 빠진 뒤 특수문자·표 사이 간격.

---

## 8. 덕수 확정 — N1~N8 (2026-09-06 · 전부 권장안)

| # | 결정 | 선택지 | 확정 · 근거 |
|---|---|---|---|
| **N1 ★** | `brands` 78종 | (a) **자산은 설치·피커에서 제외** (b) 전부 노출 | **(a) 확정**. 로고는 MIT와 무관하게 상표. "빠짐없이 설치"는 지키고 노출만 막는다 |
| **N2 ★** | 한국어 검색 | (a) 영문 name·tags + 한글 카테고리명만 (b) **`lib/phosphor-ko.json`(이름 → 한글 키워드 2~4개, 1,434종) 1회 생성·커밋 후 검색에 병합** (c) 표는 후속 | **(b) 확정**. 덕수의 LLM 파이프라인으로 1회 생성(Mathory 자체 데이터·라이선스 부담 0). 품질 검수 전엔 (a)로 출발해도 코드는 같다 — 표 유무만 다름 |
| **N3 ★** | 하위 폴더 펼침 | (a) **메모대로 `folder-open`(모든 depth)** (b) 하위는 `folder-simple` 유지, 꺾쇠만 회전 | **(a) 확정** — 펼침 신호를 depth에 따라 다르게 주면 "왜 위만 열리나"가 된다. 모양 점프는 Q2 실물에서 걸러 (b)로 후퇴 가능 |
| **N4 ★** | 옛 유니코드 값 | (a) **기본 아이콘으로 보이고 데이터는 그대로**("아이콘 변경"으로 덮어쓰면 됨) (b) 마이그레이션으로 빈 값 처리 | **(a) 확정**. Twemoji가 사라지므로 "계속 보임" 선택지는 없다. (b)는 쓰기 작업이 필요 없는데 하는 것 |
| **N5 ★** | 피커 카테고리 UI | (a) **`<select>`** (b) 칩 2행 (c) 탭 가로 스크롤 | **(a) 확정**. 17종·폭 316 — 보수적·레이아웃 위험 0. Q4 실물에서 (b) 비교 |
| **N6 ★** | ListView "Agent" 헤더 | (a) **글자 유지** (b) 아이콘 | **(a) 확정**. 다른 헤더가 전부 글자 |
| **N7 ★** | `build` 명시 연결 | (a) **`icons:check && icons:assets && next build`** (b) `prebuild` 유지 + Vercel 확인 | **(a) 확정**. 자산 누락은 사용자 아이콘 전부 빈칸이라 확인 의존을 없앤다 |
| **N8 ★** | 본문 기존 이모지 | (a) **OS 글꼴로 두고 수용**(데이터·렌더 무접촉) (b) `rehype-twemoji`만 남김(CDN·CC BY·의존성 잔존) | **(a) 확정**. 문답 ②의 "없애고 통일"에 맞고, 본문에 이모지를 쓸 일이 없다는 전제. (b)는 통일이 아니다 |

---

## 9. 착수 체크리스트 (CLI · 순서대로)

1. Vercel Build Command 확인(`npm run build`인지) — N7 (a)면 안전하지만 기록은 남긴다. M4 배포본 하드 리프레시 확인.
2. 브랜치 `m5-icons-catalog`. 생성기 `--assets`·`--index` · `PH_CORE_VERSION` · ICONS +7/−1 · `package.json`(`icons:assets`·`predev`·`build` · 의존성 2개 제거) · `.gitignore` · `public/…/LICENSE`.
3. `lib/folderIcon.ts` + `tests/folderIcon.test.mjs` + `test:foldericon`.
4. `Icons.tsx` `PhAsset`·`IconAgent`·`IconRobot` → `FolderGlyph` → 소비처 6(+1)곳 교체.
5. `PhosphorIconPicker` → Sidebar `FolderIconPicker` 패널 교체(브랜드 제외 · `<select>` · 한글 표 병합 경로).
5-1. (병행·덕수) `lib/phosphor-ko.json` 생성 — 1,434종 한글 키워드. 없어도 5의 코드는 영문 검색으로 동작한다.
6. Twemoji 철거(§3-4) → `grep -rnw` 7개 키워드 0 확인 → `npm install`(lock) → `npm run build` 통과.
7. Agent 3곳 · `AIBrandIcon` 폴백.
8. `--sheet` M5 절 → Q1~Q7 실물 판정.
9. 설정 정보 줄 · CLAUDE.md(준칙 절 신설 · 아이콘 체계 절 보완) · 타입 주석 · roadmap(M5 + Phase 39 철거 표기) · 실행판.
