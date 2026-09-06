# 개선묶음 M5 — 이모지(Twemoji) 폐기 · 폴더 아이콘 Phosphor 카탈로그 전환 구현 계획서 v2 (CLI 실측 교차검토판)

> 계보: 덕수 메모 "이모지 시스템 교체"(2026-09-06) → 범위 문답 2회 → v1 web(2026-09-06) → **덕수 확정 N1~N8** → **v2 CLI 실측 교차검토(2026-09-06) — 오류 정정 E1~E4 · 보완 G1~G6 · 덕수 추가 확정 N9~N11**. 다음: web 재검증 v3.
> 기준: `kimdeoksoo-71/mathory` **HEAD 4bd7a8b**(0f64647 + docs 1커밋) · `@phosphor-icons/core` **2.1.1 node_modules 실물 대조 완료**(assets·dist 메타데이터·SVG 내용).
> 결정은 전부 닫혔다(§2 D1~D15 · §8 N1~N11 ✅). 열린 것은 §7의 착수 시 실물 판정뿐이다.

---

## 0. 요약

| 항목 | 내용 |
|---|---|
| 취지(덕수) | 현재 이모지(Twemoji)는 모양이 복잡하고 컬러가 다양해 "보수적인 차분함 · 착오 없이 작동하는 안정감"과 맞지 않는다 → 단색 Phosphor로 **통일**. 아이콘 용도는 두 가지 — 앱 버튼(M4 완료) · 폴더 아이콘 지정(M5) |
| 범위(문답 확정) | **Twemoji 전면 철거**(툴바 '이모지' 버튼 · 폴더 아이콘 피커 · 본문 렌더 플러그인 · CDN · 인쇄 대기 · CC BY 고지 · 의존성 2개) + **폴더 아이콘을 Phosphor 카탈로그(검색 피커)로** + Agent 라벨 → `lego-smiley` + `AIBrandIcon` 폴백. '아카이브 아이콘'은 대상이 못 된 최상위 폴더였으므로 항목 삭제. 본문에 Phosphor를 넣는 문법은 만들지 않는다(§1-3 ①) |
| 실측(v2 재확인) | `Folder.icon`을 `TwemojiImg`로 그리는 자리 **6곳**(전부 좌표 일치) + **아이콘 없는 폴더 트리 2곳**(SheetImportModal · **FolderPickerDialog — v1이 놓친 세 번째 트리**, N10으로 편입) + 툴바 버튼 1 + 렌더 플러그인 2(EditorPreview·PrintableContent) + `pdfPrint` 대기 + `globals.css` 규칙 + 설정 고지. "Agent"는 아이콘이 아니라 **글자 라벨** 3곳 + 폴백 1곳 |
| 결정(덕수 확정) | ① 카탈로그 = regular 1,512 + bold 1,512 전부 설치(self-host) ② 사용자 선택은 regular, **활성 폴더 행에서만 bold** ③ 기본 폴더: 최상위 `folder` · 하위 `folder-simple` · 펼침 `folder-open` ④ 렌더는 **정적 SVG + CSS mask**(`currentColor` 유지) ⑤ 데이터 무접촉 ⑥ 저작권 고지 준칙 명문화 ⑦ N1~N8 + **N9 ai-models 기본 avatarEmoji `''`** · **N10 폴더 트리 2곳도 FolderGlyph** · **N11 한글 키워드 표는 구현 커밋에 포함** |
| 무접촉 | 서버 0 · Firestore 규칙 0 · 스키마 0(`icon: string` 그대로, 값만 이름으로) · 프롬프트 0 · raw_text 0 · exportMd 0 · 로직 테스트 기존분 0 |

---

## 0-1. v2 실측 대조 기록 (CLI · 2026-09-06)

v1의 실측 주장을 저장소·패키지 실물로 전수 대조했다. **아래 항목 전부 일치** — v1 수치를 그대로 신뢰해도 된다:

- `@phosphor-icons/core@2.1.1` **devDependencies 설치 확인**(package.json:61). regular 1,512 · bold 1,512(`ls | wc -l`). 카테고리 **18**(brands **78** · system **376** · objects 374), 다중 소속 **960**. `folder-simple-open` **부재**, `folder-open`·`folder-simple`·`lego-smiley`·`robot`·`user-focus`·`chats-circle` 존재. 대상 5종(regular·bold) **전부 단일 `<path>` · viewBox 256 · fill currentColor**.
- 자산 용량 regular 5.9 MB + bold 5.9 MB = **11.8 MB**. 인덱스 JSON(name·categories·`*` 태그 제거 tags) **163,014 B · gzip 26,768 B** — v1의 163 KB/27 KB 그대로. `*new*` 태그 실재(필터 타당).
- `TwemojiImg` 소비처 6곳 좌표 전부 정확(Sidebar :330·:483 / ListView :351 / FolderView :559·:701 / FolderPathBar :21). twemoji·emojibase 접촉 파일 전수 grep = **14개, §3-4 목록과 누락 0 일치**.
- Agent 라벨 3곳(EditorView :3333 "통짜 13/500" 주석 포함 · ProblemView :832 · FolderView :850) · `listColumns.ts:28` · `CommentPanel:800`(`emoji:'🔍'`·`provider:'verify'` 단락 확인) · SheetImportModal :724·:728 `IconFolder` 전용 · `types/problem.ts:279` · `firestore.rules` folders 필드 검증 없음(:449) · `isRoot`(folder-tree :13) · **next.config 부재** · settings CC BY 문단(:174~194) · `pdfPrint` :105~113 · `globals.css:1042` · `chatExtract:386` · ICONS **49종** · `smiley` 소비처 UnifiedToolbar :65 단독 · Sidebar 활성 700(:305) — 전항 일치.
- exports 맵에 `./package.json`이 없어 require가 막히는 함정은 **M4 스크립트가 이미 우회**(자산 dirname에서 fs로 두 단계 위 — 스크립트 헤더 주석에 명문). `./assets/<weight>/*.svg` export 실측 확인 — `require.resolve` 경로 유효.
- `avatarEmoji`의 시각 소비처는 **AIBrandIcon 폴백 하나뿐**(CommentPanel :400·:762·:1394 경유) — N9의 파급 0 근거.

### v2 정정 (E1~E4)

| # | 정정 | 내용 |
|---|---|---|
| **E1 (중대)** | D9 논리 구멍 → **D15 신설(N9)** | `lib/ai-models.ts:27`이 `avatarEmoji`를 `'🤖'` **문자열로 기본 채움**한다 → `fallbackEmoji`는 AI 모델 경로에서 항상 비어 있지 않아, v1 D9("없으면 IconRobot")대로면 `IconRobot`은 **죽은 코드**다. 기본값을 `''`로 바꾼다(파급 0 실측). Firestore에 `avatarEmoji`를 명시 저장한 모델만 이모지 유지 |
| **E2 (문구)** | §1-3 ① 근거 | "유니코드 코드포인트가 없으므로"는 부정확 — Phosphor는 **PUA 코드포인트**를 가진다(아이콘 폰트용, `folder-star`=60038). 진짜 이유: **PUA라 교환 가능한 문자가 아니어서** raw_text에 넣으면 다른 렌더러·폰트에서 무의미. 결론(본문 문법 안 만든다)은 불변 |
| **E3 (스크립트)** | N7 이중 실행 | `prebuild: icons:check`를 남긴 채 build에 `icons:check &&…`를 넣으면 검사 2회. → **`prebuild` 삭제** + `"build": "npm run icons:check && npm run icons:assets && next build"` 통합. `"predev": "npm run icons:assets"`는 신설 그대로 |
| **E4 (좌표)** | 경로·행 | `AIBrandIcon`은 **`components/comment/`**(ui 아님) · `EmojiPickerDropdown`은 UnifiedToolbar **:370** |

### v2 보완 (G1~G6)

| # | 보완 | 내용 |
|---|---|---|
| **G1** | 코드 소유 이모지 잔존 목록 | `VerifyReportCard:194 fallbackEmoji="🔍"` · `CommentPanel:800 emoji:'🔍'` — 둘 다 `provider:'verify'`가 `IconSearchPlain`으로 **단락되어 평소 미표시**, provider 미상일 때만 OS 이모지로 보인다. **알고 두는 손실**(교체 안 함) |
| **G2** | 세 번째 폴더 트리 | `components/ui/FolderPickerDialog.tsx`(M2 문항 이동 · Phase 63 다중 이동, AppShell:1029 · FolderView:916)는 현재 **아이콘 0**(텍스트 행). N10 확정으로 `FolderGlyph` 편입(§3-1) |
| **G3** | 미래 core 업그레이드 함정 | 아이콘 이름이 후속 버전에서 사라지면 저장된 `Folder.icon`이 **무이벤트로 영구 빈칸**(CSS mask 404는 onError가 없다). `--assets`가 버전 교체 시 **이전 버전 대비 사라진 이름 diff를 경고 출력**(1줄 보완). 수용 손실로 기록 |
| **G4** | `PhAsset` 접근성 | `title` 없으면 `role="img"`에 이름이 없어 위반 → **title 부재 시 `aria-hidden` + role 생략**(§4-2 반영) |
| **G5** | 고아 localStorage | 이모지 최근 사용 키는 정리하지 않는다(무해 · 데이터 무접촉 방침의 연장) |
| **G6** | 부수 이득 기록 | `emojibase-data` 제거로 node_modules **49 MB** 절감(개발 환경) · jsDelivr CDN 참조 0 |

---

## 1. 현황 — 실측 (v2 재확인)

### 1-1. 이모지 시스템의 세 갈래와 처분

| 갈래 | 저장 | 표시 | 자리 | M5 |
|---|---|---|---|---|
| A. 폴더 아이콘(Phase 39 후반) | `Folder.icon` 순수 유니코드 | `TwemojiImg`(jsDelivr `jdecked/twemoji@17.0.2` SVG `<img>`) | 6곳(§3-1) + 피커 `FolderIconPicker`(Sidebar ⋯ "아이콘 변경") | **Phosphor로 교체** |
| B. 본문 이모지(Phase 39) | raw_text 유니코드 | `rehype-twemoji`(EditorPreview :319 · PrintableContent :140) + `pdfPrint` decode 대기(:105~113) + `globals.css img.twemoji`(:1042) | 툴바 `EmojiPickerDropdown`(:370) · `EmojiIcon`(`smiley`, :64) · 그룹 등록 :724 | **철거**(문답 ②). 데이터 무접촉 |
| C. UI 글자 이모지 | 코드 상수 | 시스템 글꼴 | `AIBrandIcon`(components/comment/) 폴백 `'🤖'`(:64) · `lib/ai-models.ts:27` 기본값 · G1 잔존 목록 | 폴백 교체(D9) + **기본값 `''`(D15)** |

A·B가 공유하는 `EmojiPickerPanel.tsx`(검색·카테고리·최근·그리드) · `lib/emoji-data.ts`(emojibase ko 동적 import) · `lib/twemoji-url.ts`는 M5 후 소비처가 0이 된다 → 파일 삭제 · `emojibase-data`·`@yuna0x0/rehype-twemoji` 의존성 제거(§3-4).

### 1-2. 폴더 아이콘 소비처 6곳 + 아이콘 없는 트리 2곳

| 파일:줄 | 형태 | 크기 | 맥락 |
|---|---|---|---|
| `Sidebar.tsx:330` | `icon ? TwemojiImg : <IconFolder/>` | 18 | 폴더 행. `active`·`expanded`·`hasChildren`·`depth` prop 전부 있음 |
| `Sidebar.tsx:483` | 〃 | 15 | `FolderMoveMenu` 대상 목록. "최상위" 항목은 `IconFolder 15`(:472) |
| `ListView.tsx:351` | 〃 | 16 | Phase 63 리스트 폴더 행(하위 폴더) |
| `FolderView.tsx:559` | 〃 | 18 | 머리 제목 앞(미지정·휴지통·공유는 별도 아이콘) |
| `FolderView.tsx:701` | 〃 | 14 | 하위 폴더 칩(카드 모드) |
| `FolderPathBar.tsx:21` | `FolderGlyph` 로컬 컴포넌트 | 14 | 브레드크럼 — 유일하게 함수로 뺐다 |
| `SheetImportModal.tsx:724·728` | `IconFolder`만(사용자 아이콘 무시) | 14 | **N10 편입** — `FolderGlyph` 통일 |
| `FolderPickerDialog.tsx`(행 버튼) | **아이콘 없음**(텍스트 전용) | — | **N10 편입(v2 발견)** — 문항 이동·다중 이동 픽커 |

### 1-3. 메모 검토 — 지적 7건 (E2 정정 반영)

1. **Phosphor는 이모지가 아니다.** UI 아이콘 1,512종이며 코드포인트는 **PUA**(아이콘 폰트용)라 교환 가능한 문자가 아니다(E2). 본문(raw_text)에 넣으려면 `:ph-folder:` 같은 전용 문법 + rehype 플러그인 + PDF·exportMd·chatExtract·GAS 계약을 전부 열어야 한다 → "저장은 유니코드만, 렌더 시점 변환" 계약이 깨진다. 본문에 아이콘을 쓸 일이 없다고 확인되었으므로 **만들지 않는다**(기록만).
2. **"빠짐없이 설치"는 가능하되 방식이 바뀌어야 한다.** M4처럼 path 문자열 인라인이면 regular 639 KB(gzip 189 KB), bold까지 1.28 MB(gzip 378 KB) — 폴더 아이콘 몇 개에 매 세션이 이 청크를 받는 건 과하다. 정적 SVG self-host + CSS mask로 간다(D2). CLAUDE.md의 "별도 `.svg`로 빼면 `currentColor`가 끊긴다"는 `<img>` 얘기이고 **mask는 유지된다**(alpha만 쓰고 색은 `background-color: currentColor`) → 규약 문서에 보완한다(§4-7).
3. **`brands` 카테고리 78종은 사용자 선택에서 빼는 게 안전하다.** `apple-logo`·`google-logo`·`github-logo` 등 각사 로고다. 도안은 MIT와 별개로 상표라, "폴더 아이콘으로 고르세요"라고 내미는 목록에 넣지 않는 편이 메모의 "저작권법 준수" 취지에 맞다. 자산은 설치(빠짐없이)하되 피커에서만 숨긴다 → N1.
4. **한국어 검색이 사라진다.** emojibase는 한글 label·tags를 줬지만 Phosphor 메타데이터의 tags는 영어뿐이다. 카테고리 이름만 한글로 붙이면 "폴더·별·책" 같은 한글 검색은 안 된다 → N2 + **N11(구현 커밋에 표 포함)**.
5. **`folder-simple`에는 open 변형이 없다**(2.1.1 실물 재확인: `folder-open`만 있고 `folder-simple-open` 없음). "펼쳐지면 folder-open"을 하위 폴더에도 적용하면 탭(귀) 있는 모양 → 탭 없는 모양으로 **가족이 바뀐다** → N3 (a) 확정, 모양 점프는 Q2 실물에서만 확인.
6. **기존 값.** 이미 이모지가 저장된 폴더가 있다. 스키마는 `string`이라 그대로 두고 값만 Phosphor 이름(`^[a-z0-9-]+$`)으로 쓰면 되지만, 옛 유니코드 값을 어떻게 보일지 정해야 했다 → N4 (a) 확정.
7. **Twemoji 철거의 대가.** raw_text에 이미 든 이모지 문자(있다면)는 그대로 남고 미리보기·PDF에서 **OS 글꼴 이모지**로 보인다(macOS·Windows·모바일 모양이 다르다 — Phase 39가 없애려던 편차). 본문에 이모지를 쓸 일이 없다는 전제이므로 수용하되, 문서에 남긴다 → N8. 대안(렌더 플러그인만 잔존)은 CDN·CC BY 고지·의존성이 남아 "통일"이 아니다.

부속 지적: "Agent 아이콘 교체"는 **글자 라벨 → 아이콘**이다. "Agent" 글자는 검수 13차(M2)에서 "통짜 13/500"으로 확정한 자리라, 교체는 그 확정을 폐기하는 결정임을 기록한다(D8).

---

## 2. 결정사항 (✅ = 덕수 확정 — N1~N11 반영)

| # | 결정 | 내용 · 근거 |
|---|---|---|
| **D1 ✅** | 범위 | Twemoji 전면 철거(§3-4) + 폴더 아이콘(갈래 A) Phosphor 카탈로그 + Agent 라벨 + `AIBrandIcon` 폴백. 본문용 아이콘 문법은 만들지 않음. '아카이브' 항목 삭제 |
| **D2 ✅** (N7) | 카탈로그 공급 방식 | `scripts/gen-phosphor-paths.mjs --assets`가 `@phosphor-icons/core/assets/{regular,bold}` **3,024 파일**을 `public/icons/phosphor/<core 버전>/{regular,bold}/`로 복사(+ `LICENSE` 동봉). **gitignore**(11.8 MB 산출물) → `predev`·`build`에서 생성. 사용자 선택 아이콘은 `<PhAsset name weight size>`(CSS mask + `currentColor`)로 그린다. 시스템 아이콘(기본 폴더 3종·bold 3종·lego-smiley·robot)은 M4대로 **인라인 path**(첫 페인트에 fetch 0·깜빡임 0). 기각안: (a) 전량 인라인 청크 1.28 MB (b) Firestore에 path 문자열 동봉(데이터에 도안을 넣는 것 — "저장은 의미값만" 위반) (c) 외부 sprite(650 KB 정적 사례로 (a)와 같음) |
| **D3 ✅** | weight | 피커는 **regular만** 노출. **활성(선택) 폴더 행**의 아이콘만 bold — 글자가 700으로 굵어지는 조건(Sidebar `active`, :305)과 동일하라 규칙이 하나. 사용자 선택 아이콘도 활성 행에서는 같은 이름의 bold 파일로 |
| **D4 ✅** | 기본 폴더 아이콘 | 최상위(`isRoot`) `folder` · 하위 `folder-simple` · 펼침(`hasChildren && expanded`) `folder-open`. **하위 폴더도 펼치면 `folder-open`(N3 (a) ✅)** — 모양 점프는 Q2 실물에서만 확인 |
| **D5** | 공용 컴포넌트 | `components/ui/FolderGlyph.tsx` 하나가 **8곳**(6곳 + SheetImportModal + FolderPickerDialog, N10)의 삼항식을 대체. 입력 `{ folder, size, active?, expanded? }` — 규칙은 `lib/folderIcon.ts`(import 0, 단위 테스트) |
| **D6 ✅** (N1·N2·N5·N11) | 피커 | `components/ui/PhosphorIconPicker.tsx` 신설 — 검색(영문 name·tags + **한글 키워드 표 `lib/phosphor-ko.json`, N11: 구현 커밋에 CLI가 생성·표본 검수해 포함**) · 카테고리 **`<select>`(N5 ✅, 17종 한글명 — 브랜드 제외)** · 최근 사용(localStorage `mathory:folder-icon:recent`, 24) · 10열 그리드(셀 30 → 폭 316). 메타데이터 `lib/phosphor-index.json`(163 KB · gzip 27 KB)은 **첫 오픈 시 동적 import**(emojibase 전례). **`brands` 78종은 피커에서 제외(N1 ✅ — 자산은 설치)** |
| **D7 ✅** (N4) | 값 표현 | `Folder.icon`은 그대로 `string`. Phosphor 이름은 `^[a-z0-9-]+$` → 유니코드 이모지와 절대 겹치지 않는다. 쓰기는 피커만(인덱스에 있는 이름만). Firestore 규칙 무변경(`folders`는 필드 검증 없음, rules:449). **옛 유니코드 값은 기본 아이콘으로 보이고 데이터는 그대로(N4 ✅)** |
| **D8 ✅** (N6) | Agent | `IconAgent = lego-smiley`. EditorView Row1(:3333, **17** = 옆 `IconComment 17`) · ProblemView 제목행(:832, **14**) · FolderView 카드 배지(:850, **14**). ListView 칼럼 헤더 "Agent"(`listColumns.ts:28`)는 **글자 유지** — 다른 헤더("댓글"·"원본인증")도 글자다(N6). `title="agent 열기"` 툴팁으로 단어는 남는다 |
| **D9** | `AIBrandIcon` 폴백 | `'🤖'` 글자 → Phosphor `robot`(tags: automaton·ai). 파일은 **`components/comment/AIBrandIcon.tsx`**(E4). `fallbackEmoji`가 있으면 그대로(데이터 존중), 없으면 `<IconRobot/>` — **D15가 이 갈래를 실제로 살린다** |
| **D10 ✅** (N10) | 아이콘 없는 폴더 트리 2곳 | `SheetImportModal`(:724·:728) **그리고 `FolderPickerDialog`**(v2 발견, G2) 둘 다 `FolderGlyph`로 통일 — 폴더를 그리는 곳은 전부 한 벌. 각 2줄 수준 |
| **D11** | 저작권 고지 준칙 | §4-7. Phosphor(MIT)는 **고지 동봉** 의무 → `THIRD_PARTY_LICENSES.md`(있음) + 생성 파일 헤더(있음) + **`public/icons/phosphor/<ver>/LICENSE` 동봉(신규)** + 설정 "정보/라이선스" 한 줄(신규). **Twemoji CC BY 문단 삭제**(자산을 더 쓰지 않으므로 고지 의무도 끝난다) |
| **D12 ✅** (N7·E3) | 빌드 배선 | 자산 복사는 실패가 눈에 보이는 단계(없으면 사용자 아이콘 전부 빈칸)라 **명시 연결**: `"build": "npm run icons:check && npm run icons:assets && next build"` · **기존 `prebuild` 삭제**(이중 실행 방지, E3) · `"predev": "npm run icons:assets"`. 복사는 멱등·3,024개 카운트 assert. M4 Q7이 prebuild의 Vercel 실행을 실증했으므로 명시 연결로 옮겨도 잃는 것 없음 |
| **D13** | 캐시 | 경로에 core 버전(`/icons/phosphor/2.1.1/…`) → 버전 오르면 곧 URL 변경. `next.config.mjs`가 **없으므로**(실측) 헤더 규칙은 더하지 않고 Next 기본(ETag 304)으로. 선택: `headers()` immutable 1년 → v3 판정 |
| **D14 ✅** (N8) | Twemoji 철거 | §3-4 전수. `chatExtract.ts:386`의 `img → alt` 분기는 **일반 규칙**(이미지 alt를 텍스트로)이라 코드는 두고 주석만 고친다(`test:extract` 무접촉). `smiley` 키는 ICONS 표에서 제거(툴바 이모지 버튼이 사라지므로 소비처 0 — 단어 경계 grep 후) |
| **D15 ✅** (N9 · **v2 신설**) | ai-models 기본값 | `lib/ai-models.ts:27`의 `String(data.avatarEmoji ?? '🤖')` → **`String(data.avatarEmoji ?? '')`**. 시각 소비처가 AIBrandIcon 폴백 하나뿐(실측: CommentPanel :400·:762·:1394)이라 파급 0. avatarEmoji를 명시 저장한 모델만 이모지 유지, 나머지는 `IconRobot` |

---

## 3. 전수 대상표

### 3-1. 폴더 아이콘 소비처 → `FolderGlyph` (8곳)

| 자리 | 크기 | `active` | `expanded` | 비고 |
|---|---|---|---|---|
| Sidebar 폴더 행(:330) | 18 | `active` prop | `hasChildren && expanded` | 유일하게 bold·open이 다 걸리는 자리 |
| Sidebar `FolderMoveMenu`(:483) | 15 | — | — | "최상위" 항목 `IconFolder 15` 유지(폴더가 아님) |
| ListView 폴더 행(:351) | 16 | — | — | 하위 폴더이므로 `folder-simple`이 기본 |
| FolderView 머리(:559) | 18 | — | — | 미지정·휴지통·공유 분기 앞은 그대로 |
| FolderView 하위 칩(:701) | 14 | — | — | |
| FolderPathBar(:21) | 14 | — | — | 로컬 `FolderGlyph` 삭제 → 공용 import |
| SheetImportModal(:724·:728) | 14 | — | — | **N10** — 현행은 `IconFolder`만 |
| FolderPickerDialog(행 버튼) | 14 | — | — | **N10 · v2 발견** — 현행은 아이콘 0. "최상위(미지정)" 행은 `IconFolder` 유지 |

### 3-2. 시스템 아이콘 변경분 (ICONS 표 · 인라인)

| 키 | 파일 · weight | 소비 |
|---|---|---|
| `folder` | folder · regular | 기존(IconFolder) |
| `folderSimple` · `folderOpen` | 각 regular | 하위·펼침 기본 |
| `folderBold` · `folderSimpleBold` · `folderOpenBold` | 각 **bold** | 활성 행 기본 아이콘(D3) |
| `legoSmiley` | lego-smiley · regular | IconAgent(D8) |
| `robot` | robot · regular | AIBrandIcon 폴백(D9·D15) |
| ~~`smiley`~~ | — | **삭제**(툴바 이모지 버튼 철거, D14) |

49 − 1 + 7 = **55종**. 2.1.1 실물: 대상 5종 regular·bold 전부 단일 `<path>`·viewBox 256(**v2 확인 완료** — 생성기 assert는 그대로 유지).

### 3-3. Agent 라벨 3곳 + 폴백 1곳 + 기본값 1곳

| 자리 | 현행 | 후 |
|---|---|---|
| `EditorView.tsx:3333` | `<span 500/13>Agent</span>{n}` | `<IconAgent size={17}/>{n}` — 옆 `IconComment 17`과 같은 규격 |
| `ProblemView.tsx:832` | `<span 600>Agent</span>{n}` | `<IconAgent size={14}/>{n}` — 옆 `IconComment 14` |
| `FolderView.tsx:850` | `<span 600>Agent</span><span>{n}</span>` | `<IconAgent size={14}/><span>{n}</span>` |
| `components/comment/AIBrandIcon.tsx:64` | `{fallbackEmoji \|\| '🤖'}` | `fallbackEmoji ? <span>…</span> : <IconRobot size/>` |
| `lib/ai-models.ts:27` | `?? '🤖'` | **`?? ''`(D15)** |

G1 잔존(교체 안 함): `VerifyReportCard:194 fallbackEmoji="🔍"` · `CommentPanel:800 emoji:'🔍'` — `provider:'verify'` 단락으로 평소 미표시.

### 3-4. Twemoji 철거 전수 (D14 · v2 grep 전수 일치 확인)

| 자리 | 처분 |
|---|---|
| `components/editor/EmojiPickerPanel.tsx`(`EmojiPickerPanel`·`TwemojiImg`·`EMOJI_PANEL_WIDTH`) | **파일 삭제** |
| `lib/emoji-data.ts` · `lib/twemoji-url.ts` | **파일 삭제** |
| `UnifiedToolbar.tsx` `EmojiIcon`(:64) · `EmojiPickerDropdown`(:370~) · 그룹 `{ key: 'emoji' }`(:724) · import(:18) | 삭제. Row 2 버튼 하나 줄어든다(실물 Q7) |
| `EditorPreview.tsx:10·:319~` · `PrintableContent.tsx:8·:140~` | `rehypeTwemoji` 항목·import 삭제 |
| `lib/pdfPrint.tsx:105~113` | `img.twemoji` decode 대기 삭제(200 ms 지연·`waitForPrintFonts`는 그대로) |
| `app/globals.css:1042~` | `img.twemoji` 규칙 삭제 |
| `app/settings/page.tsx:174~194` | Twemoji CC BY 문단 → Phosphor MIT 한 줄로 교체(D11) |
| `Sidebar.tsx` · `ListView.tsx` · `FolderView.tsx` · `FolderPathBar.tsx` | `TwemojiImg` import 삭제(§3-1로 대체) |
| `lib/chatExtract.ts:386` | 주석만 "이미지는 alt를 텍스트로"(코드 무변경) |
| `package.json` | `@yuna0x0/rehype-twemoji`(:38) · `emojibase-data`(:42) 제거 → `npm install`로 lock 갱신(node_modules −49 MB, G6) |
| `scripts/gen-phosphor-paths.mjs` | `smiley` 키(:77)·컨택트시트 '이모지' 항목(:158) 삭제 |
| `docs/roadmap.md` Phase 39 절(:1026) | "M5에서 철거" 표기(역사는 남긴다) |

철거 후 `grep -rnw` 대조: `TwemojiImg` `EmojiPickerPanel` `EMOJI_PANEL_WIDTH` `twemoji` `emojibase` `TWEMOJI` `loadEmoji` → 전부 0(M4 N8 규약). 이모지 최근 사용 localStorage 키는 고아로 방치(G5).

---

## 4. 구현 사양

### 4-1. 생성기 확장 `scripts/gen-phosphor-paths.mjs`

```
--assets   @phosphor-icons/core/assets/regular/*.svg · bold/*-bold.svg → public/icons/phosphor/<ver>/{regular,bold}/
           + core LICENSE → public/icons/phosphor/<ver>/LICENSE
           멱등(같은 내용이면 무쓰기) · 완료 후 파일 수 3,024 assert
           구 버전 디렉터리 삭제 전 **이름 diff 출력**(사라진 이름 → 저장된 Folder.icon 영구 빈칸 경고, G3)
--index    require('@phosphor-icons/core').icons(UMD, 1,512건 실측) → lib/phosphor-index.json
           [{ n, c:[categories], t:[tags에서 '*' 접두 제거] }] — 163,014 B(실측) · 커밋 대상 · icons:check diff 포함
```

- 자산 위치는 M4대로 `require.resolve('@phosphor-icons/core/assets/regular/folder.svg')`의 dirname(exports 맵 실측 유효). `./package.json`은 exports에 없으므로(실측 재확인) 버전은 M4 방식대로 자산 dirname에서 fs로 읽는다.
- `phosphorPaths.ts`에 `export const PH_CORE_VERSION = '2.1.1'` — `PhAsset` URL과 복사 디렉터리가 같은 원소를 본다. 버전 고정은 package-lock이 담당(core가 2.1.2로 오르면 icons:check 바이트 diff가 빌드를 세운다 — 기존 M4 장치).
- `package.json`: `"icons:assets"` · `"icons:index"`(`icons:gen`에 포함) · `"predev"` 신설 · **`"prebuild"` 삭제** · `"build"` 명시 연결(D12). `.gitignore`에 `public/icons/phosphor/`.

### 4-2. `components/ui/Icons.tsx` 추가

```tsx
/** 카탈로그 아이콘 — 정적 SVG를 CSS mask로 씌워 currentColor를 유지한다(사용자 선택 폴더 아이콘 전용).
 *  UI 상시 아이콘에는 쓰지 말 것 — 그쪽은 PhIcon(인라인 path). */
export function PhAsset({ name, weight = 'regular', size = 16, title }: {
  name: string; weight?: 'regular' | 'bold'; size?: number; title?: string;
}) {
  const url = `/icons/phosphor/${PH_CORE_VERSION}/${weight}/${name}${weight === 'bold' ? '-bold' : ''}.svg`;
  const mask = `url("${url}") center / contain no-repeat`;
  return (
    <span
      {...(title ? { role: 'img', 'aria-label': title, title } : { 'aria-hidden': true })}  // G4
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        backgroundColor: 'currentColor', WebkitMask: mask, mask,
      }} />
  );
}
export const IconAgent = (p: IconProps) => <PhIcon d={PH.legoSmiley} size={14} {...p} />;
export const IconRobot = (p: IconProps) => <PhIcon d={PH.robot} size={14} {...p} />;
```

- mask는 alpha만 쓰므로 회색(`--text-muted`)·액센트·opacity 0.75(Sidebar 비활성) 전부 텍스트 색을 따른다 — 인라인 `PhIcon`과 같은 인관.
- 404(있을 수 없는 이름)는 **빈칸**으로 보인다 — mask에는 onError가 없다. 방어는 쓰기 쪽(피커가 인덱스에 있는 이름만)과 읽기 쪽(`isPhosphorIconName` 불일치 → 기본 폴더) + G3(버전 교체 diff 경고)에서.
- 활성화 시 bold 파일 첫 요청 1프레임 빈칸 가능 → Sidebar 마운트 시 사용자 아이콘 bold URL 예열 fetch 한 줄(Q3 실물).

### 4-3. `lib/folderIcon.ts` (import 0 · `npm run test:foldericon`)

```ts
export const isPhosphorIconName = (v: string | undefined | null): v is string => !!v && /^[a-z0-9-]+$/.test(v);
export type FolderGlyphSpec =
  | { kind: 'inline'; key: 'folder' | 'folderSimple' | 'folderOpen'; bold: boolean }
  | { kind: 'asset'; name: string; weight: 'regular' | 'bold' };
export function resolveFolderGlyph(a: { icon?: string | null; isRoot: boolean; expanded?: boolean; active?: boolean }): FolderGlyphSpec {
  if (isPhosphorIconName(a.icon)) return { kind: 'asset', name: a.icon, weight: a.active ? 'bold' : 'regular' };
  // 옛 유니코드 값·빈 값 → 기본 아이콘(N4)
  const key = a.expanded ? 'folderOpen' : a.isRoot ? 'folder' : 'folderSimple';   // N3 (a) — 펼침이면 depth 무관 folder-open
  return { kind: 'inline', key, bold: !!a.active };
}
export function searchIndex(index: IndexItem[], q: string, opts: { excludeBrands: boolean; ko?: Record<string, string[]> }): IndexItem[] { /* name 부분일치 우선 → 한글 표 → tags · 상한 80 */ }
```

테스트: 루트/하위/펼침/활성 8조합 · 유니코드 값 → 기본(N4) · `folder-star`(regular/bold) · 검색(brands 제외·상한·한글 표 유무).

한글 키워드 표(N2 ✅ · **N11 ✅ 구현 커밋 포함**) `lib/phosphor-ko.json`: `{ "folder-star": ["폴더","별","즐겨찾기"], … }` — 1,434종(브랜드 제외) × 2~4개, **구현 중 CLI가 카테고리·영문 tags 기반으로 전량 생성 · 표본 검수 후 커밋**(Mathory 자체 데이터 · 라이선스 부담 0). `searchIndex`는 표가 없으면 영문만으로 동작하므로 생성이 다른 커밋을 막지 않는다.

### 4-4. `components/ui/FolderGlyph.tsx`

```tsx
export function FolderGlyph({ folder, size = 16, active, expanded }: { folder: Folder; size?: number; active?: boolean; expanded?: boolean }) {
  const s = resolveFolderGlyph({ icon: folder.icon, isRoot: isRoot(folder), expanded, active });
  if (s.kind === 'asset') return <PhAsset name={s.name} weight={s.weight} size={size} title={folder.name} />;
  return <PhIcon d={PH[s.bold ? `${s.key}Bold` : s.key]} size={size} />;
}
```

`isRoot`는 `lib/folder-tree.ts:13`(실측 확인). Sidebar 행만 `active`·`hasChildren && expanded`를 넘기고 나머지는 `folder`·`size`만.

### 4-5. `components/ui/PhosphorIconPicker.tsx`

- 구조는 (삭제되는) `EmojiPickerPanel`을 본뜬다 — 검색 인풋 → 로딩 `IconLoader`(실측 존재, Icons.tsx:81) → 최근 → 그리드. 차이: 카테고리는 탭이 아니라 **`<select>`**(N5 ✅ — 17종은 폭 316에 탭으로 못 들어간다) · 그리드 10열(열 30 → `PICKER_WIDTH = 316`) · 셀은 `<PhAsset name size={20}/>` · `onSelect(name)`.
- 카테고리 한글명 17(브랜드 제외, N1 ✅): 금융 · 자연 · 소통 · 지도·여행 · 사물 · 미디어 · 시스템 · 게임 · 디자인 · 편집 · 건강 · 기술·개발 · 사무 · 상거래 · 화살표 · 사람 · 날씨. 한 아이콘이 여러 카테고리에 속한다(960종 실측) → 그대로 중복 노출.
- 한 카테고리 최대 376종(system, 실측) → mask URL 376건 동시 fetch(각 ≈500 B, 동일 출처 HTTP/2). 부담이면 행 단위 `IntersectionObserver` 마운트(Q4 실물).
- `FolderIconPicker`(Sidebar :493)는 패널만 갈아 끼운다 — 위치·외부 클릭 닫기·`onSelect(name)` 그대로. `EMOJI_PANEL_WIDTH` → `PICKER_WIDTH`. ⋯ 메뉴의 "아이콘 변경"·"기본 아이콘으로" 문구 그대로. `AppShell.handleSetFolderIcon`(:475) · `updateFolder`(lib/firestore.ts:452, `icon?: string`) 무변경(문자열).

### 4-6. Agent · 폴백 · D15 (§3-3) — 5곳, 각 1~2줄. Twemoji 철거(§3-4) — 삭제 위주.

### 4-7. 문서·규약

- **저작권 고지 준칙(CLAUDE.md 신설 절 · D11)**: ① 제3자 시각 자산을 들일 때 `THIRD_PARTY_LICENSES.md`에 라이선스 **전문** ② 배포 산출물에 고지 **동봉**(생성 파일 헤더 · 정적 디렉터리 `LICENSE`) ③ 설정 "정보/라이선스"에 한 줄(이름·출처 링크·라이선스) ④ **크레딧 의무형**(CC BY 등)은 ③이 필수, MIT형은 ①②로 충족·③은 관례 ⑤ **상표(브랜드 로고)는 사용자 선택 목록에서 제외** ⑥ 버전은 `package.json` 고정 + 경로에 버전 ⑦ 자산을 그만 쓰면 고지도 같이 거둔다(Twemoji 전례).
- `app/settings/page.tsx` 정보 섹션: "아이콘은 Phosphor Icons(phosphoricons.com)를 사용하며 MIT 라이선스로 배포됩니다" 한 줄(Twemoji 문단 대체).
- CLAUDE.md "아이콘 체계" 절 보완: "별도 `.svg` 파일을 `<img>`로 쓰면 `currentColor`가 끊긴다 → **카탈로그(사용자 선택)는 CSS mask로 씌워 색을 유지한다**(`PhAsset`). UI 상시 아이콘은 계속 인라인 path." · 기본 폴더 3종·bold 규칙 · `Folder.icon` = Phosphor 이름 · 피커 regular 한정 · **본문에는 아이콘·이모지 렌더 계층이 없다(M5에서 Twemoji 철거 — raw_text의 이모지 문자는 OS 글꼴)**.
- `types/problem.ts:279` 주석: "폴더 아이콘 — Phosphor 이름(`^[a-z0-9-]+$`). 옛 유니코드 값은 기본 아이콘으로 보인다(M5)".
- `docs/roadmap.md` M5 절 + Phase 39 절에 철거 표기.

---

## 5. 영향 범위·무회귀 점검

| 영역 | 영향 |
|---|---|
| 서버 · 규칙 · 스키마 · GAS · 프롬프트 · raw_text | **0** |
| 본문 렌더 | `rehypeTwemoji` 제거 → 이모지 문자는 OS 글꼴(N8). KaTeX·rehypeRaw 순서 무변경 |
| PDF | decode 대기 삭제 → 인쇄 파이프 나머지(200 ms·폰트 대기·스냅샷) 무변경 |
| exportMd · chatExtract | 0(chatExtract는 주석만 — `test:extract` 무접촉) |
| 로직 테스트 | +`test:foldericon`(import 0 규약). 기존 356건 무접촉 |
| 호출부 | 폴더 아이콘 8곳(N10 포함) → `FolderGlyph` · Agent 3곳 · 폴백 1곳 · **ai-models 기본값 1곳(D15)** · Sidebar 피커 패널 교체 · 툴바 그룹 1개 제거 |
| 빌드 | `build` 명시 연결 + `prebuild` 삭제(E3). Vercel Build Command가 `next build` 직접 지정이면 `icons:assets`가 안 돌아 **사용자 아이콘 전부 빈칸** → 착수 체크리스트 1번 |
| 정적 산출물 | `public/icons/phosphor/2.1.1/` 3,024 파일 11.8 MB(git 제외, 배포 포함). 첫 페인트 fetch = 사용자 아이콘 개수 × ≈500 B |
| 번들 | 인라인 path +6종 ≈ 3.5 KB. 피커 인덱스 163 KB는 첫 오픈 시 동적 import(gzip 27 KB). **−** emojibase 청크 · rehype-twemoji · CDN 요청 0 · node_modules −49 MB(G6) |
| 접근성 | `PhAsset` — title 있으면 `role="img"`+`aria-label`, 없으면 `aria-hidden`(G4) |
| 브라우저 | CSS mask — Chrome/Edge 무제한, Safari `-webkit-mask` 병기. 인쇄 화면에는 폴더 아이콘이 없다 |
| 외부 의존 | jsDelivr CDN 참조 0 → 오프라인·차단망에서도 아이콘이 나온다(self-host) |
| 미래 core 업그레이드 | 사라진 이름 → 저장 값 영구 빈칸(무이벤트). `--assets` diff 경고가 알린다(G3) — 수용 손실 |

---

## 6. 범위 밖 (기록)

- 본문용 아이콘 문법(§1-3 ①) — 만들지 않는다.
- Phosphor light·thin·fill·duotone weight — 설치하지 않는다(사용자 regular · 시스템 bold).
- 문항(problem) 단위 아이콘 · 폴더 색상.
- `ai_models.avatarEmoji` 데이터 정리(D15는 **기본값**만 바꾼다 — 저장된 값은 무접촉).
- 로고·favicon.
- raw_text에 남은 이모지 문자의 일괄 정리(있는지조차 조사하지 않는다 — 데이터 무접촉 원칙).
- G1 잔존 `'🔍'` 폴백 2곳 — provider 단락으로 평소 미표시, 교체 안 함.

---

## 7. 열린 질문 → 착수 시 실물 판정 (컨택트시트 `--sheet`에 M5 절 추가)

1. **Q1** 기본 폴더 3종 × regular/bold × 14/15/16/18 — Sidebar 활성 행에서 bold가 글자 700과 한 덩어리로 읽히는지, 비활성 opacity 0.75에서 대비.
2. **Q2** `folder-open` 하위 폴더 적용(N3 (a))의 모양 점프 — 탭 있는 가족 ↔ 없는 가족 전환 실물.
3. **Q3** `PhAsset` bold 전환 1프레임 공백 — 예열 fetch 유무 비교.
4. **Q4** 피커: `system` 376종 스크롤 시 fetch 항주 체감 · `<select>` vs 칩 2행 실물 비교.
5. **Q5** `lego-smiley` 17/14 — `IconComment`(chat-text)와 병렬 무게감. 대안 후보 `robot`·`user-focus`·`chats-circle`(전부 2.1.1 실물 존재 확인)은 실물에서만(덕수).
6. **Q6** `robot` 폴백 14/16 — CommentPanel 참여자 칩.
7. **Q7** Row 2에서 '이모지' 버튼이 빠진 뒤 특수문자·표 사이 간격.

---

## 8. 덕수 확정 — N1~N8(v1) + N9~N11(v2)

| # | 결정 | 확정 · 근거 |
|---|---|---|
| **N1 ✅** | `brands` 78종 | **(a) 자산은 설치·피커에서 제외**. 로고는 MIT와 무관하게 상표. "빠짐없이 설치"는 지키고 노출만 막는다 |
| **N2 ✅** | 한국어 검색 | **(b) `lib/phosphor-ko.json`(이름 → 한글 키워드 2~4개, 1,434종) 생성·커밋 후 검색에 병합**. 표가 없으면 영문만으로 동작 → 코드는 생성과 독립 |
| **N3 ✅** | 하위 폴더 펼침 | **(a) 메모대로 `folder-open`(모든 depth)** — 펼침 신호를 depth에 따라 다르게 주면 "저 위만 열리는"가 된다. 모양 점프는 Q2 실물에서 걸러 (b)로 후퇴 가능 |
| **N4 ✅** | 옛 유니코드 값 | **(a) 기본 아이콘으로 보이고 데이터는 그대로**("아이콘 변경"으로 덮으면 됨) |
| **N5 ✅** | 피커 카테고리 UI | **(a) `<select>`**. 17종·폭 316 → 보수적·레이아웃 위험 0. Q4 실물에서 (b) 비교 |
| **N6 ✅** | ListView "Agent" 헤더 | **(a) 글자 유지**. 다른 헤더가 전부 글자 |
| **N7 ✅** | `build` 명시 연결 | **(a) `icons:check && icons:assets && next build`**. 자산 누락은 사용자 아이콘 전부 빈칸이라 확인 의존을 없앤다. **v2 정정(E3): `prebuild`는 삭제**(이중 실행 방지) |
| **N8 ✅** | 본문 기존 이모지 | **(a) OS 글꼴로 두고 수용**(데이터·렌더 무접촉). (b) 플러그인 잔존은 통일이 아니다 |
| **N9 ✅** (v2) | ai-models 기본 avatarEmoji | **(a) `''`로 변경 = D15**. 시각 소비처가 AIBrandIcon 폴백 하나뿐(파급 0 실측). 명시 저장한 모델만 이모지 유지 — IconRobot 폴백이 실제로 동작한다 |
| **N10 ✅** (v2) | 아이콘 없는 폴더 트리 | **(a) SheetImportModal + FolderPickerDialog 둘 다 `FolderGlyph`**. 폴더를 그리는 곳은 전부 한 벌 — "갈래를 없앤다"(M2·M4 방침). 각 2줄 |
| **N11 ✅** (v2) | 한글 키워드 표 시점 | **(a) 구현 커밋에 포함** — CLI가 카테고리·영문 tags 기반 전량 생성·표본 검수 후 커밋. 첫 배포부터 한글 검색 |

---

## 9. 착수 체크리스트 (CLI · 순서대로)

1. Vercel Build Command 확인(`npm run build`인지) — N7 (a)면 안전하지만 기록에 남긴다. M4 배포본 하드 리프레시 확인.
2. 브랜치 `m5-icons-catalog`. 생성기 `--assets`(+G3 diff 경고)·`--index` · `PH_CORE_VERSION` · ICONS +7/−1 · `package.json`(`icons:assets` · `predev` 신설 · **`prebuild` 삭제** · `build` 명시 연결 · 의존성 2개 제거) · `.gitignore` · `public/…/LICENSE`.
3. `lib/folderIcon.ts` + `tests/folderIcon.test.mjs` + `test:foldericon`.
4. `Icons.tsx` `PhAsset`(G4 a11y 반영)·`IconAgent`·`IconRobot` → `FolderGlyph` → 소비처 6곳 교체.
5. `PhosphorIconPicker` → Sidebar `FolderIconPicker` 패널 교체(브랜드 제외 · `<select>` · 한글 표 병합 경로).
5-1. `lib/phosphor-ko.json` 생성(N11 — 1,434종 · 표본 검수). 영문 검색은 표와 독립이므로 이 커밋이 늦어도 5까지는 동작한다.
6. N10 — SheetImportModal · FolderPickerDialog `FolderGlyph` 편입(각 2줄).
7. Twemoji 철거(§3-4) → `grep -rnw` 7개 키워드 0 확인 → `npm install`(lock) → dev 끄고 `npm run build` 통과(CLAUDE.md 규칙 5).
8. Agent 3곳 · `AIBrandIcon` 폴백 · **`lib/ai-models.ts:27` 기본값 `''`(D15)**.
9. `--sheet` M5 절 → Q1~Q7 실물 판정(덕수).
10. 설정 정보 줄 · CLAUDE.md(준칙 절 신설 · 아이콘 체계 절 보완) · 타입 주석 · roadmap(M5 + Phase 39 철거 표기) · 스탬프.
