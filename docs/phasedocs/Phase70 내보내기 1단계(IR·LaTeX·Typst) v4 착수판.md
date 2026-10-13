# Phase 70 내보내기 1단계 — IR · LaTeX · Typst(.typ/PDF) · 인쇄 엔진 교체 — 구현 계획서 v4 착수판 (CLI 재검증)

- 계보: 타당성 검토 v1(2026-09-26, web) → 이슈 문서(2026-10-13, web) → 브레인스토밍 결정 D1~D6(2026-10-13) → web v1(`phase70-export-plan-v1.md`) → CLI v2(레포 실측 + Typst 실측 · 판정 P1′~Q21 덕수 확정 2026-10-13 전항 권장안) → web v3(v2 주장 전수 대조 · 정정 F1~F9 · 보완 H1~H9 · 신규 판정 N1~N5) → 덕수 판정 N1~N5 **전항 권장안**(2026-10-13) → web v3 착수판(`phase70-export-plan-v3-final.md`) → **이 문서(CLI v4 착수판 — v3 전수 대조 + Typst 0.14.2 실측 · 정정 J1~J13 · 보완 L1~L9 · 신규 판정 N6~N8)**
- 상태: **착수판 — 판정 전부 완료.** v2 판정(§6-1)·v3 판정(§6-2 N1~N5)·v4 판정(§6-3 N6~N8·N3′, 덕수 2026-10-13 전항 권장안)이 모두 확정이고 다시 열지 않는다. CLI는 §8 순서대로 착수한다. 구현 중 사실과 다른 것이 나오면 부록 G·H 형식(정정/보완)으로 §11 구현 기록에 남긴다
- **이 문서가 유일한 사양이다** — v1·v2·v3는 이력이다
- v4 검증 방법(CLI): v3의 새 주장(D24~D27·F1~F9·H1~H9·§9)을 레포·원문·**Typst 0.14.2**(`typst-ts-node-compiler` 0.7.0 = 브라우저와 같은 엔진) + mitex **0.2.7 배포판** + Noto Serif/Sans KR Subset OTF(커밋 고정 URL)로 다시 확인 · 수능 템플릿 판들(`suneung-typst/` 폴더 · `suneung-typst-v5.zip` · `suneung-template-v1.zip`)을 diff · **기준 = `docs/phaseSketch/suneung-template-v1/`**(덕수 정정 2026-10-13 — `suneung-template-v1.zip`과 8파일 바이트 동일) · 그 `sample.typ`를 0.14.2로 컴파일 — 결과는 부록 I
- v3 검증 방법(이력): v2의 모든 file:line·수치 주장을 `origin/main` `b983022`에서 다시 읽음 · mitex 원본(GitHub `mitex-rs/mitex` packages/mitex, typst.toml 0.2.7) · Overleaf `/devs` 원문 · noto-cjk `Serif/LICENSE` · **Typst 실측**(typst-py 0.15.0 + 시스템 Noto Serif CJK KR — 부록 D). 결과 요약은 부록 D-1
- 기준: `main` **`58e1bd6`**(v1의 `b983022` 뒤 docs 커밋 1개 — 코드 행 번호는 같다). ⚠ v3 시점 `origin/main`은 아직 `b983022`다(58e1bd6은 미push 로컬 커밋) — 코드 행 번호가 같으므로 v3도 같은 번호를 쓴다. 아래 file:line은 전부 이 HEAD에서 다시 읽었다. v1의 행 번호 중 틀린 것은 부록 A-E25에 모았다
- ⚠ 타당성 검토 v1·이슈 문서는 **레포에 없다**(web 쪽 산출물)
- 실측 도구(v2·v4): `@myriaddreamin/typst-ts-node-compiler@0.7.0`(= 브라우저 컴파일러와 같은 **Typst 0.14.2**) + mitex 0.2.7 배포판(packages.typst.org tarball) + Noto Serif KR Subset OTF(jsDelivr) — scratchpad, 레포 무접촉. 결과는 부록 C(v2)·부록 I(v4). ⚠ v3의 Typst 실측(부록 D)은 **typst-py 0.15.0**이라 엔진이 다르다 — 숫자가 같았던 것은 부록 I에서 0.14.2로 재확인했다
- 범위·범위 밖: v1과 같다 — **70a**(IR + LaTeX + Typst 직렬화 + .typ/.tex + Overleaf + 내보내기 다이얼로그) · **Stage 0** · **70b**(브라우저 컴파일 + 폰트 + PDF 교체 + 레거시 인쇄 철거). 시험지 조립(D5)·HWPX(71)·DOCX·공개 뷰어·폰은 밖

---

## 0. 요약

| 항목 | 현재(HEAD) | 70a 뒤 | 70b 뒤 |
|---|---|---|---|
| 내보내기 형식 | PDF(CSS `window.print`) · MD(raw 이어붙임) | + **LaTeX(.tex/zip) · Overleaf 열기 · Typst(.typ/zip)** | PDF = **Typst 컴파일 산출물**(파일 다운로드) |
| 공통 구조 | 없음(인쇄는 ReactMarkdown 사본 렌더) | **IR**(`lib/export/ir.ts`) — **렌더와 같은 remark 파서를 주입받아** mdast → IR(v1 자체 스캐너에서 변경, E1) | 그림 자산 수집 · 컴파일러 로더 |
| 블록 → 출력 | 렌더 5사이트 타입별 분기 | **kind 8종 매핑표** 하나(D2) | 동일 |
| 진입 UI | 'PDF 다운로드'·'MD 다운로드' 2항 + `PdfDialog` | **'내보내기…'** 하나 → `ExportDialog`(dialogStyles 규격, E23) | 동일 |
| 레거시 인쇄 | `lib/pdfPrint.tsx`·`PrintableContent`·`PrintStyles.css`·`PdfDownloadButton`(호출 0) | 그대로 | **철거**(단독 커밋) + `--font-print` 토큰 삭제(E16) |
| 글꼴 | 인쇄 = Noto Serif KR(+원문자 MathoryCircled) | — | **명조 Noto Serif KR 한 가족 + 수식 New Computer Modern Math** — D24 글꼴 원칙(덕수 2026-10-13) |

**서버 0 · Firestore 규칙 0 · Storage 규칙 0 · 스키마 0 · raw_text 규약 0 · 저장 경로 0.** 전부 브라우저.
의존성: 70a +1(`fflate` 0.8.3, MIT) · 70b +1(`@myriaddreamin/typst.ts` 0.7.0 + `typst-ts-web-compiler` 0.7.0 — **정확 고정**, 같은 레포의 쌍이라 한 묶음) · devDependency +1(`@myriaddreamin/typst-ts-node-compiler` 0.7.0 — 프로브·컴파일 회귀 테스트용, Q19 확정).
정적 자산: wasm 28.3MB(node_modules에서 복사 · gitignore) · mitex 0.2.7 벤더링(112KB, 커밋) · 폰트(jsDelivr 커밋 고정 · Q13 확정 — 레포에 넣지 않는다).

---

## 1. 선행 확인 (HEAD `58e1bd6` 실측)

### 1-1. 블록 타입 = 활성 15 + 레거시 2
- `types/problem.ts:238` union 17종(v1의 296행은 틀림). 드롭다운 `BLOCK_TYPES`(`EditorView.tsx:149-152`) 12종. `normalizeBlockType`(`:201-205`)은 **편집창을 연 문항만** 정규화 → Firestore에 레거시가 남는다 → 매핑표는 17종 전부.
- ⚠ v1이 선례로 든 `tests/exportMd.test.mjs:21-24` `ALL_TYPES`는 **13종**이다(coach 2·case 2 없음 — 그 테스트가 Phase 59 전에 멈췄다). "17종 전부" 검사는 `test:exportkinds`가 **union 원문을 직접 파싱**해 대조한다(사본 목록 금지).
- 타입별 의미: v1 §1-1 그대로 유효. 보탤 것 —
  - `image`: `imageWidth`(기본 400, 상한 600 · `PrintableContent.tsx:235-258`) · **`imageTreatment?: 'frame'`**(테두리) · `imageGray`. v1 IR은 frame을 빠뜨렸다.
  - `svg`: 인쇄는 **고정 높이 상자**(`svg_height` 기본 300px) + `svg_initial_view` 변환(`PrintableContent.tsx:177-216` — 주석이 "열 폭이 다르면 오차"를 인정). v1 IR은 폭만 있었다(E20).
  - 경우 제목행은 **행 전체가 굵다**(인쇄 `PrintStyles.css:234` 600 · 화면 `globals.css:992` medium) — 라벨만이 아니다(E18).
  - `mathory-graph` 코드펜스(Phase 42 그래프 — `EditorPreview.tsx:305,322`)는 화면에서 GgbGraphView로 그려진다. IR이 `code`로 두면 **JSON이 PDF에 찍힌다**(E27).

### 1-2. 렌더 전처리 — 두 벌이고, 화면 쪽이 정답이다
- 화면 = `EditorPreview.tsx` **인라인 사본**(`preprocessLocale` 96-191 · `preprocessMath` 193-240 · `protectFences` 80 · 파서 `[remarkMath, remarkGfm]` 314 — 옵션 없음 · v3 확인 ✓).
- ✓ v3 확인(H1): IR이 쓰는 `chatExtract.normalizeMathDelimiters`(142-146)는 렌더 `preprocessMath`(198-201)와 **같은 모양**(`$$inner$$`·`$inner$`, 개행 추가 없음)을 만든다 — 차이는 뒤돌아보기 하나뿐이라 D7′의 구조 동치 전제가 성립한다. (68c 붙여넣기의 "펜스형 `$$`" 변환과는 다른 함수다 — 혼동 금지.) 인쇄 = `lib/preprocess.ts`(179-206) + `lib/locale.ts`. v1은 인쇄 쪽만 봤다.
- ⚠ **로케일 게이트**(E3): `lib/locale.ts:344-345` `preprocessLocale`은 `locale !== 'ko'`면 **아무것도 안 한다** — 마커 행 분리·텍스트 `\tag`·Fig 변환이 전부 ko 전용. 렌더 사이트는 전부 `locale="ko"` **하드코딩**(`TabBody.tsx:176-215` · `FolderView.tsx:536-572` · `pdfPrint.tsx:81`). → ExportDoc의 locale은 사실상 상수 `'ko'`.
- 두 사본의 차이(내보내기에 걸리는 것만):
  - Fig 변환: 화면 `/\bFig\.(\d+)/` vs 인쇄 `/\b(?:Fig\.|Figure)\s*(\d+)/gi`(`locale.ts:328-336`). `Figure 3`·`fig. 3`만 갈린다 → 내보내기는 **export된 `convertFigureLabels`·`convertTableLabels` 재사용**, 차이는 알고 둔다.
  - 코드펜스 보호: 화면만 있다(`protectFences`). IR은 mdast 위에서 일하므로 코드는 애초에 텍스트 변환을 안 받는다(E1의 부수 이득).
- 재사용(전부 export 확인 — v3 재확인 ✓. ⚠ `CASE_REF_RE`는 **`/g` 플래그가 붙은 상수**다(`caseBlock.ts:30`) — IR에서 `.test()`/`.exec()`로 재사용하면 `lastIndex`가 오염된다. `matchAll` 또는 `new RegExp(CASE_REF_RE.source, 'g')`로 쓴다, H7): `MARKER_LINE_RE`·`GANA_LITERAL_RE`·`GIYEOK_LITERAL_RE`·`CIRCLED_NUM_LINE_RE`·`MATH_ONLY_LINE_RE`(`locale.ts:42-88`) · `insertMarkerLineBreaks`·`normalizeCaseBoundaries`·`convertFigureLabels`·`convertTableLabels`·`protectMath`·`restoreMath`(`locale.ts:374-` export 블록) · `caseBlock`의 `splitCaseTitle`·`buildCaseLabels`(110-136)·`blockKeyOf`·`CASE_REF_RE`(30) · `coachBlock` `COACH_LABELS`(24-27) · `chatExtract.normalizeMathDelimiters`(142 — `(?<!\\)` 뒤돌아보기 있는 판).
- 재사용 **안 함**: span 주입 전부 · `convertRefMarkers` · `preprocessMath` · `katexMacros`(화면 보정 — `\frac` 팬텀·`\arraystretch 1.8`, `katexMacros.ts:19`).
- 🔎 부수 발견(70 범위 밖 → prelaunch 목록 후보): 렌더 사본 두 벌의 `\[…\]`→`$$` 정규식에는 `(?<!\\)`가 **없다**(`preprocess.ts:134` · `EditorPreview.tsx:198` — v3 정정 F6. 같은 결함이 수식 **보호** 정규식에도 있다: `EditorPreview.tsx:105` · `locale.ts` `protectMath`). 61a C6이 `chatExtract`에서 고친 "행바꿈 `\\[4pt]`의 `\[`를 여는 구분자로 먹는" 함정이 렌더에 남아 있다(Phase 68 행 Enter가 `\\[4pt]`류를 만든다). IR은 고친 판을 쓴다.

### 1-3. 현행 PDF 경로
- 진입: `ProblemView.tsx:614`(오너)·`:621`(비오너) 'PDF 다운로드' → `PdfDialog`(`:1267`) → `handlePdfConfirm`(`:522-547`) → `printProblemPdf`(`lib/pdfPrint.tsx:58-114`).
- `PdfDialog`에 넘기는 `tabs`는 **멤버 가시성 필터 뒤**(`ProblemView.tsx:558-561`)다. 반면 `handleDownloadMarkdown`(`:498-519`)은 `problem.tabs` **전체**를 돈다 → 멤버에게 숨긴 탭이 MD로 나간다(현행 잠복, UI 수준 필터라 블록은 로드돼 있다). E22 · Q15 확정(모든 형식이 선택 탭=가시 탭만).
- 문항 **제목은 현 PDF에 없다** — `PrintableContent`가 `title` prop을 받고도 그리지 않는다(54-73). 탭 라벨만 있다. E26 · Q16 확정(PDF·.typ 없음 / .tex만 머리에).
- 인쇄 규격 실측(`PrintStyles.css`) — v1 §1-3 표에 **빠졌던 값**:
  - display 수식: 상하 11pt(89) · fleqn **2em**(24) — v1 Typst에 들여쓰기 누락
  - ① 밭: `padding-left 2em; text-indent -2em; margin-left 1em`(151) · 밭 위아래 11pt · 항목 사이 0(154-156) — v1은 margin-left 1em 누락
  - `(가)`·`ㄱ.`: 2.5em 내어쓰기 · 마커 600(145-147)
  - callout: 상하 11pt · 좌 2em(160-166) · 코칭: 상하 11pt · 왼쪽 바 **0.3mm** · 라벨 700(175-185) — v1 Typst 1.5pt는 틀림
  - 테두리 상자: 0.3mm · padding 6pt 8pt · 상하 **12pt**(240-249) · quote(`>`)도 같은 테두리(69)
  - 경우: 상하 11pt · rail −1.2em 0.15mm `#8a8a8a` · dot 0.44em(하위 0.26em) 검정 · 제목행 600(198-234) — **v1이 rail·dot을 통째로 누락**(Q14 확정: dot만 재현)
  - 표: 9.5pt · 셀 테두리 0.2mm · 패딩 3pt 6pt · 가운데 · th 600 + `#f5f5f5`(97-99)
  - 목록: ul 들여쓰기 1em + `•`/`◦` 1.4em(75-81) · ol 24pt(73)
  - heading 블록(첫 블록 제외) 위 1em(`PrintableContent.tsx:86-88`)
  - 풀이 탭 `strong` 700(54) · 본문 `word-break: keep-all`(67-68)
  - case-ref `C1` 600(271)
  - **선택지**(v4 L1): 라벨↔내용 **세로 가운데**(`.print-choice-item { display:flex; align-items:center; gap:0.5em }` — 개선묶음 M2 B, `PrintStyles.css:257-266`) · 열 간격 8pt · 위아래 6pt · 라벨 400(250-267). ⚠ baseline 정렬이면 분수가 든 칸의 라벨만 내려앉는다(M2 B가 고친 바로 그 결함 — Typst에서 `① $…$`를 한 문단에 쓰면 재발, 부록 I-4)
  - **코칭 라벨**(v4 L2): 현행 인쇄는 아이콘(`IconCoachImportant` = Phosphor `chat-centered-text`, 17px · `CoachLabel.tsx:37`) + 'Tip' — 글꼴은 `.coach-block .coach-label`의 **`--font-ui`(고딕)** · 자간 0.01em(`globals.css:752-763`)을 그대로 물고 굵기만 700(`PrintStyles.css:181-184`)
- ⚠ **①~⑳ 글리프는 Noto Serif KR이 아니다**(E17): `--font-print`(`globals.css:164`) 스택 맨 앞이 `MathoryCircled`(`globals.css:37-45` — AppleGothic/Apple SD Gothic Neo/Malgun Gothic/Noto Sans KR woff2, **size-adjust 88%**)이고 `waitForPrintFonts`가 U+2460 문자로 그것을 로드한다(`pdfPrint.tsx:46`). Typst PDF에서는 Noto Serif KR 글리프로 바뀐다 → Q17 확정(글리프 수용 + 크기 88%).
- `PdfDownloadButton.tsx`: 호출처 0(grep 실측, 자기 파일만). 죽은 코드.

### 1-4. 그림 자산
- `uploadImage`는 **png/jpg로만** 저장(`lib/storage.ts:49`(리사이즈 출력 형식)·`:91`(확장자) — v3 정정 F6). 그러나 `raw_text`의 `src`는 그 밖의 URL일 수 있다(시트 가져오기·AI 그래프 등) → 자산 수집은 **매직 바이트로 판별**하고 png/jpg/svg 외는 canvas로 png 변환.
- CORS(`cors.json`): GET 허용 origin = `localhost:3000` · `mathory.app`·`www.` · `mathory.net`·`www.` · `mathory.vercel.app` · `*.vercel.app`. dev는 **3000 포트만**.
- Overleaf는 URL이 아니라 **data URL로 zip을 받는다**(§3-5, E9) — v1의 "Storage URL 그대로 넘긴다"는 svg 그림(LaTeX엔 png가 필요)에서 성립하지 않았다.
- **회색조(`imageGray`)는 Typst·LaTeX 모두 이미지 필터가 없다** → 수집 단계에서 canvas로 회색 png를 만든다(E20).

### 1-5. MD 다운로드 — 세 벌, IR을 거치지 않는다
- `ProblemView.tsx:498` `handleDownloadMarkdown` · `AppShell.tsx:66,734-743` `download_md`(**사이드바 '최근 문항' ⋮ 메뉴** — v4 J4: FolderView·ListView의 자체 메뉴(`FolderView.tsx:460-475` · `ListView.tsx:274-292`)에는 'MD 다운로드'가 없고, `ContextMenu` 기본 항목(`ContextMenu.tsx:26`)을 쓰는 곳은 `Sidebar.tsx:651` 최근 문항뿐이다. 목록은 `listRecentProblems`(`firestore.ts:184-190`, `authorUid == uid`)라 **본인 문항만** — 멤버 누출 없음. 추가 탭을 버리고 문제·풀이만 내보내는 것은 사실 → prelaunch 후보) · `lib/version/exportMd.ts`(55b). 목적이 다르므로 IR 밖. 다이얼로그의 Markdown 항목은 **`handleDownloadMarkdown`을 탭 인자를 받게 고쳐** 연결한다(Q15 확정).

### 1-6. 테스트 하니스 — v1 §1-6의 전제는 틀렸다 (E1)
- `tests/chatExtract.test.mjs:21-27`이 **이미** `unified`·`remark-parse`·`remark-math`·`remark-gfm`·`remark-rehype`·`rehype-raw`·`rehype-katex`를 ESM import해 실제 렌더 파이프라인을 돌린다(`test:extract` 42건). 테스트 파일이 `.mjs`라 ESM 충돌이 없다. 로컬 Node는 **v25.6**(require(esm) 기본 지원)이기도 하다.
- 따라서 "remark를 쓰면 하니스와 충돌한다"는 근거는 없다. 오히려 chatExtract가 정한 모양 — **lib는 import 0, 파서는 테스트·호출부가 주입** — 이 그대로 쓸 수 있는 선례다.

### 1-7. 외부 라이브러리 (2026-10-13 실측)
| 항목 | 값 | 출처 |
|---|---|---|
| `@myriaddreamin/typst.ts` · `typst-ts-web-compiler` · `typst-ts-node-compiler` | 0.7.0 (2026-06-29) · Apache-2.0 | `npm view` |
| 내장 Typst | **0.14.2** | typst.ts `v0.7.0` Cargo.toml:70-81 |
| `typst_ts_web_compiler_bg.wasm` | **28,325,178 B**(원본) — v1 "≈10MB대"는 원본이 아니다. 전송 크기는 Vercel 압축 여부에 달림(P0-2) | unpkg 메타 |
| mitex | 0.2.7 · 패키지 112KB(`mitex.wasm` 280,797 B) · entrypoint `lib.typ` · export `mitex, mitext, mimath, mi, mitex-convert, mitex-scope` | packages.typst.org tarball |
| mitex `\displaystyle` | **지원**(`specs/latex/standard.typ:176` → `math.display`) — 실측 통과 | 부록 C t3 |
| mitex `\tag` | **조용히 버린다**(`standard.typ:104` `handle: ignore-me`) — 실측 `x^2 \tag{3}` → (3) 소멸 | 부록 C t3 |
| mitex `array`·`aligned`·`cases` | 지원(1034·1065·1074) — 실측 통과 | 부록 C t3 |
| mitex `\arraystretch` | ⚠ **0.2.7 배포판은 오류**("error unexpected: arraystretch" → 문서 전체 실패, 부록 I-2) — v3의 "무시(`ignore-command`, `standard.typ:1207`)"는 0.2.7 **이후의 GitHub HEAD**였다(v4 J2). 어느 쪽이든 행간은 **Typst 쪽 `math.cases`·`math.mat` 설정으로만** 낸다(D27) | v4 실측 |
| ⚠ mitex 실패 양상 | **수식 하나의 미지원 명령이 문서 전체 컴파일을 죽인다** — 같은 문서의 정상 수식도 함께 사라진다(`\foo`·`\textcircled` 실측, 부록 I-2). Typst에는 try/catch가 없다 → D28 수식 단위 격리 | v4 실측(J3) |
| ⚠ mitex 행 번호 | v2의 104·176은 0.2.7 tarball, v3 확인은 GitHub HEAD(2026-10-11, typst.toml 0.2.7)라 107·180 — 내용 동일 | v3 |
| mitex 입력 | `str` 또는 raw(`get-elem-text`) — **문자열 리터럴 가능** | `mitex.typ` |
| fflate | 0.8.3 · MIT | `npm view` |
| tex2typst | 0.6.2 · Apache-2.0(D1 대체 후보) | `npm view` |
| Noto Serif KR Subset OTF | Regular 7,669,020 B · SemiBold 7,610,748 · Bold 7,910,236 | GitHub API `notofonts/noto-cjk` |
| 고정 커밋·해시(v4 L3) | `Serif/SubsetOTF/KR`의 마지막 변경 커밋 **`9b0f1436e455d902de067a2501422e5dc71ad16b`**(2024-07-30) · Regular SHA-256 `5ea012e15cb7eacc1f680aee1703f3b164791b1443ea3e52b65080cca5d179cf` · Bold `263408609ef416d597718ea91055379867d3e7086fa32f049996995d4e715e55` — 고정 URL과 `@main` 바이트 동일 확인 | v4 실측 |
| 수능 템플릿 엔진 | 최신판 `sample.pdf` Creator = **Typst 0.15.0** · 0.14.2에서도 오류 0으로 컴파일되지만 선택지 숫자가 ①보다 약 3pt 뜬다(부록 I-5) | v4 실측(J6) |
| jsDelivr 경유 | `cdn.jsdelivr.net/gh/notofonts/noto-cjk@…/Serif/SubsetOTF/KR/NotoSerifKR-Regular.otf` → 200 · `font/otf` · **`access-control-allow-origin: *`** | curl 실측 |
| Overleaf | `snip_uri`에 **data URL(base64) 허용, zip도 가능** · `engine`=`xelatex` · `main_document` — v3 원문 재확인 ✓. 크기 상한은 본문에 없고 페이지 설정값에 `maxUploadSize 52428800`(50MB)만 보인다(snip_uri 적용 여부 미확인 → P0-5) | overleaf.com/devs |
| Overleaf 한글 글꼴 | **"Noto Serif CJK KR"**(Google Fonts판 이름 "Noto Serif KR" 아님) · NanumMyeongjo · UnBatang 등 | Overleaf fontspec 목록 |
- `next.config.*` 없음 → wasm은 `public/`에 두고 URL로 로드(v1과 같음). ⚠ 빌드 배선은 `prebuild`가 아니다 — `package.json` `"build": "npm run icons:check && npm run icons:assets && next build"`, dev는 `"predev"`. `export:assets`는 **두 체인 모두**에 넣는다(E24). Vercel Build Command를 직접 지정하면 빈다는 M5 함정 그대로.
- 런타임 CDN 글꼴의 선례: 앱 UI의 Pretendard가 이미 jsDelivr에서 로드된다(`THIRD_PARTY_LICENSES.md:11` · `app/layout.tsx`).

---

## 2. 결정

### 2-1. 확정(덕수 2026-10-13) — v1 그대로
D1 mitex 우선(전환 순서) · D2 kind 매핑표 · D3 Noto Serif KR · D4 70a/70b · D5 시험지 조립 별도 · D6 PDF·.typ 둘 다(.typ는 '추가 형식').
- D3 재확인(2026-10-13, 수능 템플릿 작업 중 실물 비교): 함초롬바탕(조판 품질 조악)·KoPub World 바탕·나눔명조·리디바탕을 같은 문항으로 조판해 비교한 뒤 **Noto Serif KR 유지**로 덕수 확정. 수식 글꼴은 STIX Two Math(MS Word·SAT 인상)를 기각하고 **New Computer Modern Math 유지**.

### 2-2. 기술 결정 — v1 D7~D18 개정판
| # | 결정 | 근거 / v1 대비 |
|---|---|---|
| **D7′** | IR 빌더 = **구조 전처리(문자열) → 주입된 remark 파서(mdast) → IR**. `lib/export/ir.ts`는 **import 0~소수 순수 모듈**이고 파서는 인자로 받는다(`buildExportDoc(input, { parse })`). 호출부(브라우저)와 테스트(.mjs)가 `unified().use(remarkParse).use(remarkMath).use(remarkGfm)`을 만들어 넘긴다 — **렌더와 같은 파서** | v1 D7(자체 스캐너 + `mathRegions`) 철회. ① ESM 근거는 사실이 아니다(§1-6) ② `mathRegions`는 **편집창** 스캐너이고 헤더가 "렌더 경로는 별개"라 명시한다 — R-$$ (c) 빈 인라인 쌍·미닫힘 `$` 행 끝까지 등 remark-math와 판정이 다르다(`mathRegions.ts:1-22`). v1 목표("화면과 문단 수가 같아야")와 정면 충돌 ③ 자체 스캐너는 중첩 목록·lazy continuation·표·HTML에서 R6 위험을 스스로 만든다 → 파서를 공유하면 구조가 **정의상** 같다. **P1′ 확정** |
| D8′ | IR 수식 = LaTeX 문자열 그대로. 인라인/display + `tag` + `rows`. **`\tag`는 IR이 반드시 뗀다** — mitex가 조용히 버린다(§1-7 실측). 수식 안은 `\tag\*?\{([^{}]*)\}` 전부(화면 KaTeX는 `\tag{가}`도 그린다 — 렌더 `\tag*` 변환은 숫자만이지만 KaTeX가 나머지를 그대로 처리), 텍스트 행 끝은 렌더와 같이 **숫자만**(`\\tag\{(\d+)\}[ \t]*$`, `locale.ts:322-327`) | v1 D8 + 실측 근거 |
| D9 | 인라인 수식 `\displaystyle` 주입은 내보내기에도 — **덕수 원칙(2026-09-05)이라 판정 대상 아님**(v1 P3 삭제). mitex `\displaystyle` 지원 실측 → v1의 `math.display` 대체안 불필요 | CLAUDE.md 원칙 · 부록 C t3 |
| D10 | 규격: PDF·.typ = 현행 인쇄(A3 세로 · 상하 30/좌우 20mm · 2단 10mm · 10pt · 탭마다 단 바꿈) / .tex = A4 1단 | v1 그대로(P2) |
| D11 | 그림이 있으면 .typ/.tex는 zip(`main.typ`/`main.tex` + `figures/`), 없으면 단일 파일. `fflate.zipSync` | v1 그대로 |
| D12 | mitex 0.2.7을 `public/typst/packages/preview/mitex/0.2.7/`에 **커밋**(112KB · LICENSE 동봉). .typ에는 `#import "@preview/mitex:0.2.7": mitex, mi` | v1 그대로 + 크기 실측 |
| D13′ | 폰트는 **정적 OTF**(가변 금지) · 첫 내보내기 때 지연 로드 → Cache Storage. **출처 = jsDelivr `gh/notofonts/noto-cjk@<커밋 SHA>/Serif/SubsetOTF/KR/`의 Regular·Bold 2파일 + 코드에 SHA-256 상수 + 불일치 시 중단**(Q13·P4 확정). 커밋 SHA·해시값은 v4가 실측해 둔 값(§1-7 L3)을 `compile.ts` 상수로 쓴다 — 70b 착수 때 한 번 더 내려받아 일치만 확인한다. 수식 폰트(New Computer Modern Math)는 typst.ts 자체 기본 폰트 로더가 jsDelivr `typst-assets`에서 받는지 P0-2에서 확인하고, 되면 그 경로를 쓴다(직접 벤더링 0) | v1의 "/public 커밋"은 공개 레포에 15MB+ 바이너리를 영구히 넣는다 |
| D14 | 70b PDF = 파일 다운로드(`{제목}.pdf`). 시스템 인쇄 다이얼로그 소멸 | v1 그대로 |
| D15′ | 레거시 인쇄 70b 철거(단독 커밋). **`--font-print` 토큰도 삭제**(소비처가 PrintStyles·pdfPrint뿐 — 원문자 size-adjust는 `@font-face MathoryCircled`에 있고 `--font-ui`가 계속 쓴다) | v1의 "`--font-print` 남긴다" 근거 오류(E16) |
| D16′ | ggb 블록 **+ `mathory-graph` 코드펜스** = 자리표시 상자("GeoGebra — 화면에서 확인"). 스냅샷은 후속 | v1 + E27 |
| D17′ | ProblemView 메뉴 '내보내기…' 하나(오너·비오너 둘 다). 사이드바 '최근 문항' ⋮의 MD 그대로(J4). **ExportDialog는 `components/ui/dialogStyles` 규격**(`dialogOverlay`·`dialogBody`·`dialogHead`·`dialogFoot`·`dialogBtn`) — PdfDialog의 자체 스타일(zIndex 1000·radius 12)은 승계하지 않는다 | M2 A 규약 "새 규격 금지"(E23) |
| D18 | 무거운 코드는 동적 import(fflate·typst.ts·컴파일러·폰트). 공개 라우트·편집창 번들 0 증가. 70a의 PDF 갈래는 기존 `printProblemPdf` 그대로 | v1 그대로 |
| **D19** | **레이아웃 수치의 정본은 `PrintStyles.css` 실측표(§1-3)** — 직렬화기 두 벌(.tex는 A4 1단이라 적용 가능한 것만)이 같은 상수 표 하나(`lib/export/layout.ts`, import 0)를 읽는다 | v1은 수치를 본문에 흩어 적었고 일부가 틀렸다(코칭 1.5pt · ① margin · display 2em) |
| **D20** | 그림 폭은 **직렬화기가 숫자로 계산**한다: 폭 = min(px × 0.75pt, 상한). 상한 = Typst A3 2단 열 폭 (297−40−10)/2 = 123.5mm의 90% = **111.15mm** · LaTeX A4 1단 170mm의 90% = **153mm** | v1 `calc.min(…pt, 90%)`는 **컴파일 오류**("cannot compare ratio and length", 부록 C t1) · LaTeX `\dimexpr` 꼼수도 불필요. 그림은 최상위 블록뿐이라 열 폭이 확정이다 |
| **D21** | Typst 한글 어절 줄바꿈 = **템플릿 show 규칙 한 줄** `#show regex("[\p{Hangul}]+"): it => box(it)` — 원고 본문에 `#box[]`를 흩뿌리지 않는다 | 실측: 기본은 음절 사이에서 끊는다("이때 조/건을"), show 규칙으로 어절 단위 확인(부록 C t2) · v1 P10의 본문 감싸기보다 .typ 가독성이 낫다 |
| **D22** | Typst 텍스트는 **마크업 이스케이프** + `#set smartquote(enabled: false)`. mitex 인자는 **문자열 리터럴**(`"…"`, `\`·`"`만 이스케이프) | v1의 raw 백틱 늘리기는 백틱 3개부터 첫 낱말이 언어 태그로 먹힌다. 이스케이프 전수는 §3-4 |
| **D23** | 자산 수집은 매직 바이트로 형식 판별 · png/jpg/svg 외 → png · `imageGray` → canvas 회색 png · LaTeX용 svg → png(2배). 실패한 그림은 빈 상자 + 경고(내보내기 계속) | §1-4 |
| **D24** | **글꼴 원칙(덕수 2026-10-13)** (N1·N4 확정): ① 글꼴 개수 최소화 ② 그 안에서 원본에 가장 가깝게 ③ 장평은 고려하지 않는다 ④ 자간은 원본 실측에 맞춘다. → 70의 PDF·.typ는 **명조 한 가족(Noto Serif KR Regular·Bold) + 수식(New Computer Modern Math)**. 고딕(Noto Sans KR)은 시험지 양식(D5)에서만 들어온다(N4) | 수능 템플릿 v1 작업에서 확정 — 70의 "원본"은 현행 CSS 인쇄라 자간 기준은 N1 |
| **D25** | **인라인 수식은 줄을 넘기지 않는다**: `#show math.equation.where(block: false): box` — 현행 인쇄 `PrintStyles.css:95-96`(`.katex { display: inline-block }`, "수식 중간 줄바꿈 방지")의 Typst 대응. 열 폭보다 긴 인라인 수식만 예외로 끊긴다(N5) | v2 누락(F2). 실측: box 없으면 `f(x)=x³+3ax²−` / `9a²x+…`로 연산자에서 끊김, box면 통째로 다음 줄(부록 D t2) |
| **D26** | **세로 간격 변환 규칙**: Typst의 `par.spacing`·`block(above/below)`은 **줄 상자 끝↔끝** 간격이라 CSS 마진과 뜻이 다르다. 문단 사이 = `leading + 6pt`(CSS `p { margin-bottom: 6pt }` + 행간), 그 밖의 블록 간격(display·callout·코칭·경우 11pt · 테두리 상자 12pt · 탭 라벨 8pt · heading 위 1em)도 `layout.ts`에 **CSS 값과 변환식 하나**(`typstGap(css) = css + LEADING` 시작값)로 두고 P0-8′에서 기준선 간격으로 확정 | v2 `par(spacing: 6pt)`는 문단 사이가 **줄 사이보다 좁아진다**(실측 13.3pt < 17pt, F1) · 수정값 `0.97em + 6pt` → 23.0pt = CSS 17 + 6 ✓(부록 D t1) |
| **D27** | **cases·행렬 행간**: mitex가 `\arraystretch`를 반영하지 않으므로(0.2.7은 오류 — J2) 템플릿에 `#set math.cases(gap: 1em)` · `#set math.mat(row-gap: 1em)` 시작값, 현행 인쇄(KaTeX 1.8)와 실물 대조로 확정(N2) | Typst 기본 cases 행간은 현행 인쇄보다 눈에 띄게 좁다 — 수능 템플릿 비교에서 1em이 원본에 가까웠다(부록 D t4) · v4 0.14.2 실측: mitex `cases`에 실제로 걸린다 — 행 피치 기본 12.0pt → 1em 20.0pt@10pt(KaTeX `\arraystretch 1.8` ≈ 21.6pt, 부록 I-3) |
| **D28** | **mitex 실패 수식 격리**(N6): 컴파일 진단에 `mitex-convert`가 보이면 **수식 단위로 이분 탐색**(문서의 수식만 모은 작은 문서를 반씩 컴파일)해 실패 수식을 찾고, 그 수식만 **대체 표시**(원문 LaTeX를 고정폭 글자 + 0.3mm 테두리 상자, 앞에 `⚠`)로 바꿔 재컴파일한다. 다이얼로그에 "변환하지 못한 수식 k개"와 앞 40자를 보인다. `.typ` 다운로드도 70b부터 같은 경로를 거친다(70a의 .typ는 무검증 — 알고 둔다). 실패율이 P0-1에서 높으면 대체 표시 앞에 tex2typst 재시도를 끼운다(D1 순서와 같은 방향) | v4 실측: 미지원 명령 하나가 문서 전체를 죽인다(J3). v1~v3의 D1 "<90%면 엔진 교체"는 실패가 수식 단위로 갈린다는 전제였다 |
| **D29** | **선택지 = 라벨·내용 2칸 grid**: `grid(columns: (1fr,)*n, column-gutter: 8pt, ..items.map(i => grid(columns: (auto, 1fr), column-gutter: 0.5em, align: horizon, label, content)))` — 현행 인쇄의 세로 가운데(M2 B)를 그대로 | v4 실측: 한 문단에 `① $\frac{3}{8}$`를 쓰면 baseline 정렬이라 ④가 내려앉는다 · 2칸 grid는 분수·근호·음수 분수 모두 가운데(부록 I-4) |
| **D30** | **display 수식 정렬 = set 규칙**: `#show math.equation.where(block: true): set align(left)` + `set block(above: …, below: …)` + `it => pad(left: 2em, it)` | ⚠ v2가 넣고 v3가 계승한 `it => block(…, pad(left: 2em, align(left, it)))`는 컴파일은 되지만 **수식을 가운데에 세운다**(부록 I-1 — v2 부록 C t6은 진단 0만 보고 모양을 안 봤다, J1) |
| **D32** | **cases 조건 열 간격 = `\quad`**: Typst 직렬화기는 `cases`·`dcases`·`rcases`·`drcases` 안의 **깊이 0 `&`** 앞에 `\quad `를 넣어 mitex에 넘긴다(중괄호 깊이는 `lib/latexScan` 규칙으로 센다 · `latex.ts`는 무변경 — LaTeX cases는 원래 `\quad` 열 간격) | v4 실측: Typst `cases`는 조건 열 앞 간격이 **0**이라 `x^2-3x+a(x ≥ 1)`처럼 붙는다(mitex·네이티브 둘 다) · KaTeX cases는 `@{}l@{\quad}l@{}` · 삽입 후 LaTeX와 같은 모양(부록 I-7). array·aligned는 이상 없음 |
| **D31** | **코칭 라벨 = 아이콘 + 'Tip'(명조 700)**(N7): 아이콘은 Phosphor `chat-centered-text` path(`components/ui/phosphorPaths.ts`의 `chatCenteredText`)를 SVG 문자열로 `image(bytes(…), format: "svg", height: 1.1em)` · 현행 인쇄의 고딕 라벨은 D24①·N4에 따라 명조로 | CLAUDE.md 코칭 규약: "라벨 식별은 색이 아니라 **아이콘 + 굵기**가 담당" — 흑백 인쇄에서 아이콘을 빼면 신호가 굵기 하나로 준다 |

---

## 3. 설계

### 3-1. 모듈 배치
```
lib/export/
  blockKinds.ts   D2 매핑표 (import 0)                       → test:exportkinds (types/problem.ts union 원문 파싱 대조)
  layout.ts       D19 인쇄 실측 상수 표 (import 0)
  prepare.ts      구조 전처리 — 문자열 → 문자열 (import: locale 상수·insertMarkerLineBreaks·normalizeCaseBoundaries, chatExtract.normalizeMathDelimiters)
  ir.ts           mdast → ExportDoc (import: caseBlock · coachBlock · blockKinds · prepare. 파서는 주입) → test:exportir
  latex.ts        IR → .tex (import: layout)                                                    → test:exportlatex
  typst.ts        IR → .typ (import: layout)                                                    → test:exporttypst
  assets.ts       [브라우저] 그림 fetch · 형식 판별 · svg/gray → png · zip(fflate) · 파일명 위생
  overleaf.ts     [브라우저] data URL 폼 POST
  compile.ts      [70b · 브라우저] typst.ts 로더 · 접근 모델 · 폰트 · PDF 바이트
components/export/ExportDialog.tsx   (PdfDialog 대체 · dialogStyles 규격)
public/typst/                        [70b] wasm(export:assets 복사 · gitignore) · packages/preview/mitex/0.2.7/(커밋)
scripts/exportProbe.mjs              [Stage 0] mitex 대응률 — typst-ts-node-compiler 0.7.0(= 0.14.2)으로
tests/fixtures/export/*.json         블록 배열 표본(17종·마커·tag·rows·표·그림·mathory-graph·동형 자모)
```
- ⚠ `ir.ts`가 import하는 `caseBlock`·`coachBlock`·`locale`은 import 0~1이라 `--rootDir .`로 함께 컴파일된다(`test:locale` 선례). `chatExtract`도 import 0이다.
- ⚠ `ir.ts`에 `unified`·`remark-*`를 **정적 import하지 말 것** — 주입 구조를 깨면 테스트는 통과해도(Node 25 require(esm)) Vercel 빌드 Node·번들 경로가 달라진다. 브라우저 쪽 파서 생성은 `ExportDialog`의 동적 import 안에서(react-markdown이 같은 패키지를 이미 번들에 갖고 있어 추가 비용 ~0).

### 3-2. 블록 kind 매핑표 (D2) — v1 표 그대로 + 보탬
| kind | type | variant | 보탬 |
|---|---|---|---|
| `para` | text · math_block · bullet · list | — | |
| `heading` | heading | — | 첫 블록이 아니면 위 1em(인쇄 실측) |
| `indent` | callout | — | 상하 11pt · 좌 2em · 안의 display는 추가 들여쓰기 없음 |
| `admonition` | coach_important · coach_caution | `tip` | 바 **0.3mm** · 라벨 = 아이콘 + 'Tip' 명조 700(D31) |
| `case` | case · subcase | `top` / `sub` | 제목행 **전체 굵게** · 라벨 `C1.`/`C1a.` · **dot만**(Q14) — 제목행 왼쪽 −1.2em에 `#place` 원 0.44em(하위 0.26em) 검정 · 이어짓기(라벨 없음)는 dot 없음 · rail 없음 |
| `framed` | gana · roman · box | `gana`/`roman`/`plain` | 상하 12pt |
| `choices` | choices | — | 1~3개 3열 · 4~5개 5열 · 라벨 400 · **라벨·내용 2칸 grid 세로 가운데**(D29) · 열 간격 8pt · 위아래 6pt |
| `figure` | image · svg · ggb | `image`/`svg`/`ggb` | image: `widthPx`·`frame`·`gray` / svg: `heightPx`(기본 300) / ggb: 자리표시 |

### 3-3. IR — `lib/export/ir.ts`
```ts
export interface ExportDoc { title: string; locale: 'ko' | 'international'; tabs: ExportTab[]; figures: FigureRef[] }
export interface ExportTab { id: string; label: string; tone: 'question' | 'solution'; blocks: ExportBlock[] }   // tone = isToneScoped(id) — 풀이 strong 700용
export type ExportBlock =
  | { kind: 'para' | 'indent'; body: Flow[] }
  | { kind: 'heading'; level: 1|2|3; inline: Inline[]; first: boolean }
  | { kind: 'admonition'; variant: 'tip'; label: string; body: Flow[] }
  | { kind: 'case'; variant: 'top'|'sub'; label: string | null; title: Inline[] | null; body: Flow[] }
  | { kind: 'framed'; variant: 'gana'|'roman'|'plain'; body: Flow[] }
  | { kind: 'choices'; items: { label: string; inline: Inline[] }[] }
  | { kind: 'figure'; variant: 'image'; ref: string | null; widthPx: number; frame: boolean; gray: boolean }
  | { kind: 'figure'; variant: 'svg'; ref: string | null; heightPx: number }
  | { kind: 'figure'; variant: 'ggb' | 'graph' };                                      // 'graph' = mathory-graph 펜스(D16′)
export type Flow =
  | { t: 'p'; marker?: { kind: 'gana'|'giyeok'|'circled'; text: string }; inline: Inline[]; tag?: string }
  | { t: 'display'; latex: string; tag?: string; rows?: string[] }
  | { t: 'ul' | 'ol'; start?: number; items: Flow[][] }
  | { t: 'quote'; body: Flow[] }
  | { t: 'table'; align: ('left'|'center'|'right'|null)[]; rows: Inline[][][] }
  | { t: 'hr' } | { t: 'code'; text: string } | { t: 'placeholder'; what: 'graph' };
export type Inline =
  | { t: 'text'; text: string } | { t: 'math'; latex: string }
  | { t: 'strong'|'em'|'code'; inline: Inline[] } | { t: 'br' }
  | { t: 'ref'; n: string } | { t: 'caseRef'; text: string }          // caseRef = 본문 C1·C2a(인쇄 600, Q20)
  | { t: 'img'; ref: string };                                         // 본문 안 <img>(rehype-raw로 그려지는 것)
export interface FigureRef { id: string; url: string; path: string; kind: 'raster' | 'svg' }   // ext는 수집 단계에서 매직 바이트로 확정
```

빌더 단계(**화면과 문단 수·순서가 같아야 한다** — 같은 파서를 쓰므로 구조 동치는 ①~③이 렌더와 같은 문자열을 만드는지로 환원된다):
1. 블록 → `BLOCK_KIND[type]`(미지의 type → `para` + `console.warn`).
2. `stripInvisibles`(Q18 확정 · `lib/invisibles.ts` import 0) — 편집·저장 경로와 같은 정규화. 화면엔 영향 없음.
3. **구조 전처리**(`prepare.ts`, locale `ko`일 때 렌더와 같은 순서): `preventSetextHeadings`(사본 2벌 중 `lib/preprocess.ts` 쪽을 export해 재사용) → 코드펜스 보호 → `protectMath` → `insertMarkerLineBreaks` → `normalizeCaseBoundaries` → 텍스트 행 끝 `\tag{n}` → 사설 표지 `⟦TAG:n⟧`(파서를 통과해 텍스트 노드에 남는다) → `restoreMath` → 펜스 복원 → `normalizeMathDelimiters`(`\[`→`$$`·`\(`→`$`, 뒤돌아보기 판).
   - ⚠ span 주입·`\tag*`·`\displaystyle`·katexMacros·`**Case**` 변환은 **하지 않는다**(v1 11번 유지).
   - ⚠ 경우 블록은 `splitCaseTitle`로 제목행을 먼저 떼고 본문만 이 단계에 넣는다(렌더의 `injectCaseLabel` 빈 줄 보장과 같은 효과).
4. `parse(prepared)` → mdast. 노드 매핑: `paragraph`→`p` · `heading` · `list`(ordered·start) · `blockquote`→`quote` · `table`(align) · `thematicBreak`→`hr` · `code`(lang `mathory-graph` → `placeholder`) · `math`(display) · `inlineMath` · `strong`/`emphasis`/`inlineCode` · `break` · `html`(아래).
   - 한 줄 `$$x$$`는 remark-math가 **인라인**으로 준다 — 화면과 같다(별도 규칙 불필요).
   - `html` 노드: `<img src>` → `img`(그림 수집 대상) · `<br>` → `br` · 그 밖의 태그는 **태그만 벗기고 텍스트 유지** + warn 1회(조용한 소실 금지).
5. 문단 첫 텍스트가 `GANA_LITERAL_RE`·`GIYEOK_LITERAL_RE`·`CIRCLED_NUM_LINE_RE`에 걸리면 `marker`로 뗀다(비ASCII 공백 소비 규칙 그대로).
6. `⟦TAG:n⟧` → 그 문단의 `tag` · display 안 `\tag…{X}` → `tag`(D8′) · `\ref{n}` → 텍스트에선 `ref`, 수식 안에선 `\text{(n)}`.
7. display bare `\\`(환경 없음): `rows` 분할 — 판정은 렌더와 같은 정규식(`hasLineBreak = /\\\\(?![a-zA-Z])/`, `hasEnvironment = /\\begin\s*\{/`), 꼬리 `\\` 제거.
8. 텍스트에 `convertFigureLabels`·`convertTableLabels`(ko) · `CASE_REF_RE` → `caseRef`.
9. `case`: 탭 단위 `buildCaseLabels`(heading 리셋) · 레거시 `**Case n.**`는 본문 그대로(P7).
10. `choices`: `PrintChoicesBlock`과 같은 파싱(`PrintableContent.tsx:150-160`). 항목 내용은 3·4단계를 거쳐 inline.
11. `figure`: image `src="…"`(`PrintImageBlock`과 같음) · svg는 `raw_text`가 URL. 같은 URL은 한 번, 경로 `figures/fig-N.<ext>`(ext는 수집 후 확정 — IR엔 확장자 없는 stem).

### 3-4. 직렬화기 (공통: IR만 본다 · 결정적 · 수치는 `layout.ts`)

**`latex.ts`** (A4 1단, XeLaTeX)
```latex
\documentclass[10pt,a4paper]{article}
\usepackage[margin=20mm]{geometry}
\usepackage{kotex}                         % XeLaTeX → xetexko(fontspec 포함)
\usepackage[fleqn]{amsmath}                % ⚠ 한 번만 — v1처럼 두 번 부르면 Option clash(E11)
\usepackage{amssymb,graphicx,framed,tabularx,changepage}
\setlength{\mathindent}{2em}
\IfFontExistsTF{Noto Serif CJK KR}{\setmainfont{Noto Serif CJK KR}\setmainhangulfont{Noto Serif CJK KR}}
  {\IfFontExistsTF{Noto Serif KR}{\setmainfont{Noto Serif KR}\setmainhangulfont{Noto Serif KR}}
  {\setmainhangulfont{UnBatang}}}         % Overleaf 이름은 "Noto Serif CJK KR"(E10)
\renewcommand{\arraystretch}{1.3}          % P5
\setlength{\parindent}{0pt}\setlength{\parskip}{6pt}
```
- 문서 머리: `\begin{document}` 직후 `\section*{<제목 이스케이프>}`(Q16 — PDF·.typ에는 제목을 내지 않는다). 탭은 `\subsection*{<탭 라벨>}`. 그래서 본문 제목 블록은 한 단 내린다 — h1·h2 → `\subsubsection*` · h3 → `\paragraph*`(v1의 h2 → `\section*`는 문서 제목과 같은 층이 되어 폐기).
- 매핑은 v1 §3-4와 같되 정정: 경우 제목행 `\textbf{C1.\ 제목행}`(행 전체) · 코칭 바 0.3mm(`leftbar` 재정의 `\FrameRule`) · 그림 `width=` 숫자(D20) · 회색·svg는 png 경로 · `caseRef` → `\textbf{}` · 문단 `tag` → `\hfill\mbox{(n)}`.
- 텍스트 이스케이프: `\`→`\textbackslash{}` · `{ } # $ % & _` 앞 `\` · `~`→`\textasciitilde{}` · `^`→`\textasciicircum{}`. 수식 문자열은 손대지 않는다.

**`typst.ts`** (D10 규격, Typst 0.14.2로 검증)
```typst
// Mathory 내보내기 — Typst 0.14.2에서 검증 · 글꼴: Noto Serif KR(또는 Noto Serif CJK KR) · New Computer Modern Math
#import "@preview/mitex:0.2.7": mitex, mi
#set page(paper: "a3", margin: (top: 30mm, bottom: 30mm, x: 20mm), columns: 2)
#set columns(gutter: 10mm)
#set text(font: ("Noto Serif KR", "Noto Serif CJK KR"), size: 10pt, lang: "ko")
#set par(leading: 0.97em, spacing: 0.97em + 6pt, justify: false)   // P6 0.97em → 기준선 17.0pt 실측(부록 D t1) · spacing = leading + CSS 6pt(D26) → 23.0pt
#set smartquote(enabled: false)
#show regex("[\p{Hangul}]+"): it => box(it)               // D21 — 어절 단위 줄바꿈
#show regex("[①-⑳]"): set text(size: 0.88em)           // Q17 — 현행 인쇄 MathoryCircled size-adjust 88%와 같은 크기 · P0-3 실물로만 조정
#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif KR"))
#show math.equation.where(block: false): box               // D25·N5 — 인라인 수식 중간 줄바꿈 금지(현행 인쇄 inline-block). 열 폭보다 긴 것만 끊긴다
// 자간(tracking)·어절 간격(spacing)은 설정하지 않는다 — N1: 현행 CSS 인쇄와 같은 0. KICE 실측값은 시험지 양식(D5)용
#set math.cases(gap: 1em)                                  // D27·N2 — 시작값 1em, P0-10 실물로 한 값 확정 · mitex는 \arraystretch를 반영하지 않는다(0.2.7은 오류 — J2)
#set math.mat(row-gap: 1em)
#show math.equation.where(block: true): set align(left)          // D30 — v2·v3의 block(pad(align(left, it)))는 가운데로 섰다(J1)
#show math.equation.where(block: true): set block(above: 11pt, below: 11pt)   // 값은 typstGap()(D26)
#show math.equation.where(block: true): it => pad(left: 2em, it)
#show heading: set text(weight: 600)
```
- 실패 수식 대체 표시(D28): 직렬화기는 `#mi("…")`/`#mitex("…")` 대신 `#mathFail("…", block: false|true)`를 낼 수 있어야 한다(템플릿 머리에 정의 — 고정폭 원문 + 테두리 + `⚠`). 어느 수식이 대체될지는 compile.ts가 정해 IR 수식 id 집합으로 넘긴다
- 세로 간격(D26): 아래 매핑의 `above: 11pt, below: 11pt` 등 **CSS 값을 그대로 적은 자리는 전부 `layout.ts`의 `typstGap()`을 거친 값**으로 바꿔 쓴다(문단 사이와 같은 이유). v2 템플릿의 리터럴 11pt는 시작 표기일 뿐이다.
- `leading` 근거(E8): v1의 0.65em은 Typst **기본값**이지 1.7의 근사가 아니다. Typst 기본 줄 상단 = cap-height, 하단 = baseline이라 기준선 간격 ≈ leading + cap-height(≈0.7em) → 1.7em이 되려면 leading ≈ 1.0em. 시작값 0.97em, P0-8로 확정.
- 문서 머리: 제목 없음(Q16 — 현행 인쇄와 같다). 탭마다 `#colbreak()`(첫 탭 제외) + 탭 라벨(12pt 600 · 아래 0.15mm `#999` 선 · 간격 8pt).
- 매핑(v1에서 바뀐 것만): 인라인 → `#mi("…")` · display → `#mitex("…")`(D22) · `tag` → `#grid(columns: (1fr, auto), align: (left + horizon, right + horizon), […], [(n)])` · 마커 → `#grid(columns: (2.5em, 1fr), …)`(① 2em + 밭 왼쪽 1em · 밭 위아래 11pt) · 선택지 → D29 2칸 grid · 코칭 → `#block(stroke: (left: 0.3mm), inset: (left: 1em, y: 4pt), above: 11pt, below: 11pt)[#box(image(bytes(COACH_SVG), format: "svg", height: 1.1em)) #text(weight: 700)[Tip] …]`(D31) · 경우 → 제목행 `#text(weight: 600)[C1. 제목행]` + dot `#place(dx: -1.2em, dy: <첫 행 중심>, circle(radius: 0.22em, fill: black))`(하위 0.13em · 이어짓기 없음 · Q14 — 세로 좌표는 첫 행 중심, 실물로 확정) · 그림 → `#image("figures/fig-1.png", width: 315pt)`(D20 숫자) / svg `#image(…, height: Hpt, fit: "contain")` · `placeholder` → 점선 상자 · 풀이 탭 `strong` 700.
- 텍스트 이스케이프(D22, v1 목록 보완): `\ # $ * _ ` + "`" + ` < > @ [ ] ~ / = - + '` 앞 `\` · 단축 표기 `--`·`---`·`...`·`-?`는 `-`·`.`을 이스케이프해 깨뜨린다 · 행머리 `숫자.`(번호 목록)·`/ `(용어 목록)·`= `(제목)·`- `·`+ ` 이스케이프 · `//`·`/*` 주석 개시 이스케이프. 결정성 테스트가 이 표를 고정한다.
- CJK–라틴 자동 간격(`cjk-latin-spacing`)은 **한글에 적용되지 않는다**(실측 무차이, 부록 C t4) — 설정 불필요.

### 3-5. 브라우저 — `assets.ts`·`overleaf.ts`
- 그림: `fetch(url)` → 매직 바이트(PNG `89 50 4E 47` · JPEG `FF D8 FF` · SVG `<svg`/`<?xml`) → Typst용(png/jpg/svg 그대로, gray는 png) · LaTeX용(svg·gray → png 2배). 실패 → 빈 상자 + 경고.
- zip: `fflate.zipSync({ 'main.typ'|'main.tex': …, 'figures/fig-1.png': … })`. 파일명 위생 = `ProblemView.tsx:509` 치환과 같은 정규식(공용 헬퍼로 뽑는다).
- **Overleaf(E9)**: 숨은 폼 하나 — `snip_uri = data:application/zip;base64,<main.tex + figures/>` · `engine=xelatex` · `main_document=main.tex` · `target=_blank`. 그림 유무와 관계없이 **항상 zip**(갈래 하나). 다중 `snip_uri[]`·Storage URL·svg 래스터 문제 소멸. 남는 확인은 크기 상한(P0-5).

### 3-6. UI — `ExportDialog`
- v1 §3-6 그대로 + 정정: dialogStyles 규격(D17′) · Markdown 갈래도 **선택 탭**을 따른다(Q15) · 형식 기억 `localStorage['mathory-export-format']`(try/catch).
- 메뉴(`ProblemView.tsx:612-622`): 오너 `편집 · 사본 만들기 · 내보내기… · 휴지통 · spacer · 공유`, 비오너 `내보내기…`. 아이콘 `IconDownload`.

### 3-7. 70b — `compile.ts`
- 로더: `await import('@myriaddreamin/typst.ts')` → `createTypstCompiler()` + `init({ getModule: () => '/typst/typst_ts_web_compiler_bg.wasm', beforeBuild: [...] })`. 접근 모델·패키지 레지스트리 훅(벤더링 mitex를 `@preview/mitex:0.2.7`로 해석)·기본 폰트 로더 API는 **P0-2에서 실측해 §11에 적는다**.
- `export:assets`: `node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm` → `public/typst/`(gitignore) — `predev`·`build` 체인 둘 다(E24).
- 폰트: jsDelivr 고정 경로(Q13)에서 `fetch` → SHA-256 검증 → Cache Storage(`mathory-export-fonts-v1`) → `addFont`. 실패 시 알림 후 중단(폴백 조판 금지 — v1 근거 유지).
- **실패 수식 격리(D28)**: 1차 컴파일 진단에 `mitex-convert`가 있으면 → 수식 목록(IR 순서)을 반씩 나눈 "수식만 있는 문서"를 컴파일해 실패 집합을 좁힌다(실패 k개면 약 k·log₂N회) → 해당 id를 `mathFail`로 바꿔 재직렬화·재컴파일 → 결과 + 실패 목록을 다이얼로그로. 진단에 `mitex-convert`가 없는 실패는 첫 진단 한 줄로 중단(v1과 같음)
- 메인 스레드 블로킹: 28MB wasm 컴파일 + 조판. P0-2 수치가 기준을 넘으면 Worker로(v1과 같음).
- 철거(단독 커밋): `lib/pdfPrint.tsx` · `components/print/`(3파일 + CSS) · `EditorView.tsx:63` import · `components/problem/PdfDialog.tsx` · `--font-print`(`globals.css:164` + `:31` 주석) · CLAUDE.md(렌더 사이트 5→4 · `BORDERED_TYPES` 사본 수 · "현재 PDF 규격" · `waitForPrintFonts` · "PrintStyles는 화면에도 로드" 절들).
  - 철거 위험 실측: `PrintStyles.css` 선택자는 전부 `.print-*`·`.print-body …`·`@media print`(grep) — 화면 규칙 누수 없음. ⚠ 부수 변화 하나: `@media print { body > *:not(.print-root) { display: none } }`(21)가 사라져 브라우저 ⌘P가 "빈 페이지" → "앱 화면 인쇄"가 된다(알고 둔다). `globals.css`의 M1 E 상쇄 규칙(`.preview-content .marker-* { font-weight: inherit }`)은 의미를 잃지만 무해 — 주석만 고친다.

### 3-8. 보안·데이터
v1 그대로(규칙·서버·스키마 0). 덧붙임: 내보내기는 **다이얼로그가 받은 `tabs`(멤버 가시성 필터 뒤)** 만 다룬다 — PDF·.tex·.typ·MD 모두(Q15).

### 3-9. 라이선스 고지 (`THIRD_PARTY_LICENSES.md`)
- 70a: fflate(MIT). 70b: typst.ts(Apache-2.0) · mitex 0.2.7(Apache-2.0, 벤더링 — LICENSE 동봉) · Noto Serif KR(OFL 1.1 — 파일은 jsDelivr에서 받아 재배포하지 않으므로 출처·커밋 SHA·라이선스 링크만 기록, Pretendard 항목과 같은 형식) · New Computer Modern(GUST Font License). ✓ v3 확인(F4): `notofonts/noto-cjk` `Serif/LICENSE`에는 **Reserved Font Name 선언 자체가 없다**(OFL 전문만, 저작권 줄 없음) — v2의 "RFN = 'Source'" 전제는 원문과 다르지만 결론(서브셋해도 이름 변경 의무 없음)은 같다. 70은 파일을 재배포하지 않으므로(jsDelivr) 무관하고, 후속 서브셋(§9)에서만 의미가 있다.

---

## 4. Stage 0 — 실측 (70a와 병행, 70b 전 완료)

| # | 항목 | 방법 | 판정 | v1 대비 |
|---|---|---|---|---|
| P0-1 | mitex 대응률 | `exportProbe.mjs`: 표본(Q19′ — (가) 시트 Data_DS·Stack(61a 서비스 계정, 읽기 전용) + (나) Mathory 덤프(임시 개발 페이지 → 덕수 브라우저에서 JSON 내려받기) · 대표 13문항은 §4-1)에서 수식 전수 수집 → **typst-ts-node-compiler 0.7.0**(0.14.2)으로 **수식 하나씩** 컴파일(⚠ v1~v3의 "50개씩 묶어"는 하나만 실패해도 묶음 전체가 실패해 집계가 무너진다 — J3) → 실패 명령·**문항 단위 실패율**(그 문항 PDF가 D28 대체 표시를 몇 개 갖게 되는가) 집계 | ≥95% 확정 · <90% 또는 aligned·cases·array 체계 실패 → tex2typst | `brew install typst`는 최신판이라 **브라우저 엔진과 버전이 다르다**(E14) |
| P0-2 | typst.ts 브라우저 구동 | 임시 라우트 `app/dev70`(소스는 phaseSketch) — wasm 로드·**전송 크기(`Content-Encoding`)**·패키지 훅·기본 폰트 로더·컴파일 시간 | 첫 로드 ≤15초 · 재방문 ≤2초 · 문항 1개 ≤3초 | + 전송 크기·폰트 로더 |
| P0-3 | 폰트 | 실측 완료분: 크기(§1-7) · **굵기 600 요청 → Bold 파일 선택**(pdffonts) · **①·⑮·⑳ 글리프가 Noto Serif KR 서브셋에 있음**(부록 I-3). 남은 것: 88% 크기가 현 인쇄와 체감이 맞는지(Q17) | 88%가 어긋나면 이 한 값만 실물로 조정 | 크기는 끝남 |
| P0-4 | `\displaystyle`·`array{l}`·`\text{한글}` | **이 검토에서 통과 확인**(부록 C t3). 남은 것: 표본 고정 케이스 20개를 P0-1에 합류 | | 대부분 종료 |
| P0-5 | Overleaf data URL zip | 그림 3장 문항으로 1회 제출 · **크기 상한**(폼 POST) 탐색 | 실패 시 그림 없는 main.tex만 + 안내 | v1 다중 `snip_uri[]` 문제는 소멸 |
| P0-6 | Typst 한글 줄바꿈 | **실측 완료** — 음절 분리 확인 → D21 채택 | | 종료 |
| P0-7 | xetexko 어절 줄바꿈 | Overleaf 샘플 .tex(덕수) | 음절 분리면 프리앰블 옵션 | 그대로 |
| **P0-8** | Typst 기준선 간격 | `leading` 0.97em에서 연속 10행 기준선 간격 측정(pdftotext -bbox) → 17pt@10pt | ±0.3pt | 신설(E8) · **v3 선측정: 17.0pt**(typst-py 0.15.0) · **v4 0.14.2 + Subset OTF 재측정: 줄 16.99pt · 문단 22.99pt**(부록 I-3) — 종료 |
| **P0-8′** | 블록 간격(D26) | 문단↔문단 23pt · 본문↔display · 본문↔테두리 상자 · 본문↔코칭/경우 · 탭 라벨 아래 · heading 위 — 현행 CSS PDF와 같은 문항의 **기준선 간격 대조**(pdfplumber `top`) | ±0.5pt | v3 신설 |
| **P0-10** | cases·행렬 행간(D27·N2) | 경우·조건 문항 3개를 현행 CSS PDF와 나란히 — `gap` 한 값 확정 | 덕수 실물 | v3 신설 |
| **P0-11** | 실패 격리 비용(D28) | 실패 수식 0·1·3개를 심은 40수식 문항으로 재컴파일 횟수·총 시간 | 실패 1개일 때 추가 시간 ≤ 첫 컴파일의 2배 | v4 신설 |
| **P0-9** | 렌더 동치 | 표본 30블록을 화면 파이프라인(EditorPreview 사본 경로 → remark → hast)과 IR에 함께 넣어 **문단·수식 개수와 순서 비교**(chatExtract 테스트 방식) | 전부 일치, 불일치는 IR을 고친다 | 신설 — v1 R6의 실측화 |

Stage 0 결과는 **§11과 `docs/phaseSketch/phase70-stage0.md`에 숫자로**.

### 4-1. Stage 0 대표 문항 (덕수 지정 2026-10-13 · 폴더 `MY\검증\26K32\`)
P0-1(수식 단위 대응률)·P0-8′·P0-9·P0-10·P0-11과 실물 검수 ⑤⑨⑩⑪의 **고정 표본**이다. 덤프(Q19′ (나))에서 제목으로 찾는다(같은 폴더라 제목 중복 없음).

| # | 제목 | 선정 이유(덕수) | 주로 보는 결정 |
|---|---|---|---|
| 1 | 26K32_1공통01 | 복잡한 지수 | D9·D25(인라인 display·box) · P0-1 |
| 2 | 26K32_1공통04 | case 환경 | D27·D32(cases 행간·조건 열 간격) · P0-10 |
| 3 | 26K32_1공통13 | ㄱ, ㄴ, ㄷ 합답형 | 마커 `ㄱ.` 내어쓰기 · 선택지 D29 · Q18 동형 자모 |
| 4 | 26K32_1공통15 | 가나 조건 | `(가)`·`(나)` 마커 · framed(gana) 상자 |
| 5 | 26K32_1공통20 | 빈칸, 글상자 | framed·quote 상자 · 빈칸 표기 · `\tag`/㉠ 인용(D8′) |
| 6 | 26K32_1공통22 | 가나 조건 | 4와 같은 갈래의 두 번째 표본(긴 문항 · 단 넘김) |
| 7 | 26K32_3확통27 | 분산, 경우나눔, dfrac | `\dfrac`·cases · 경우 블록 dot(Q14) |
| 8 | 26K32_3확통28 | 복잡한 괄호와 여집합 | `\left…\right`·위첨자 `^C` · 집합 기호 · P0-1 |
| 9 | 26K32_3확통29 | 확률분포표 | GFM 표 → Typst `table`·LaTeX `tabular`(9.5pt · 0.2mm) |
| 10 | 26K32_3확통30 | 글상자 | framed·quote 상자 안 display·마커 |
| 11 | 26K32_4미적26 | 그림, 2행 선택지 | figure(D20·D23 자산 수집·폭 계산) · 선택지 2행 배치(D29) |
| 12 | 26K32_4미적29 | 시그마, 복잡분수 | `\sum` display 극한 · 번분수 `\dfrac` · rows(bare `\\`) |
| 13 | 26K32_5기하30 | 벡터 | `\vec`·`\overrightarrow` 등 벡터 표기 mitex 대응 · P0-1 |

⚠ "2행 선택지"(11)는 현행 인쇄가 **1~3개 3열 · 4~5개 5열**만 안다(`PrintableContent.tsx:150-160`) — 선택지가 길어 화면에서 두 줄로 놓이는 문항이 Typst에서 어떻게 넘치는지 이 표본으로 본다(5열 고정이면 칸 안 줄바꿈). 현행 CSS PDF와 같은 모양이면 통과, 다르면 §11에 기록하고 덕수 판정.

---

## 5. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | mitex 미대응 명령 | P0-1 · D1 전환 순서 · .tex 경로 상시 생존 |
| R2 | 첫 로드 = wasm 28.3MB(원본) + 폰트 15.6MB(2파일) | D18 · Cache Storage · 3단계 진행 문구 · P0-2 전송 크기 |
| R3 | 버전 드리프트(typst.ts·컴파일러·mitex·폰트 커밋) | 정확 고정 · 올릴 때 fixtures 전량 재컴파일 + 부록 C 프로브 재실행 |
| R4 | KaTeX 화면 보정과의 조판 차이(분수 팬텀·arraystretch·cases 안 `\sum` displaystyle 주입) | 알고 두는 손실(v1 그대로) · P5·P6 실물 조율 |
| R5 | 한글 줄바꿈 | Typst는 D21로 해결 확인 · xetexko는 P0-7 |
| R6 | IR ↔ 화면 구조 어긋남 | D7′(같은 파서)로 구조 원천 제거 · 남는 차이는 구조 전처리 문자열 → P0-9 |
| R7 | 철거 회귀 | 단독 커밋 · 선택자 전수 실측으로 위험 낮음(§3-7) · 화면 스냅샷 비교 유지 |
| R8 | 그림 fetch 실패 | 빈 상자 + 경고 · dev는 3000 포트 |
| **R9** | 런타임 CDN 의존(Q13) | 커밋 SHA 고정 + SHA-256 검증 + Cache Storage — 첫 1회만 네트워크 · 실패 시 명확한 오류 |
| **R10** | 렌더의 `\[` 정규식 잠복 버그(§1-2)와 IR(고친 판)이 갈리는 문항 | 그 문항은 화면이 틀린 것 — prelaunch 목록에 등록하고 IR은 고친 판 유지 |
| **R12** | mitex 미지원 명령 하나가 PDF 전체를 죽인다(J3) | D28 격리 · P0-1 수식 단위 집계 · P0-11 비용 |
| **R13** | 수능 템플릿(0.15.0)과 브라우저 엔진(0.14.2)의 차 — 선택지 숫자 3pt 들뜸(J6) | 70 범위 밖 — §9 D5 인계 |
| **R11** | 열 폭(123.5mm)보다 긴 인라인 수식 | D25 box여도 Typst가 마지막 수단으로 끊는다(실측 — CSS inline-block은 넘쳐 잘린다). 끊기는 쪽이 낫다(N5) · 그런 문항은 display로 고치는 것이 맞다 |

---

## 6. 판정

### 6-1. 확정 (덕수 2026-10-13, 전항 권장안) — v3에서 다시 열지 않음

v1 P1~P12 개정 + 신규 Q13~Q21. **★ = v1에서 권장안이 바뀐 것.** 반영 위치를 함께 적는다.

| # | 질문 | 확정 | 반영 |
|---|---|---|---|
| **P1′ ★** | IR 파서 | **렌더와 같은 remark 파서 주입**(v1의 자체 스캐너 철회) | D7′ · §3-3 · P0-9 |
| P2 | .tex 규격 | A4 1단 | D10 |
| ~~P3~~ | 인라인 `\displaystyle` | 판정 대상 아님 — 덕수 원칙(2026-09-05) | D9 |
| P4 | 굵기 파일 | **Regular + Bold 2파일(15.6MB)** — 600(제목·마커·경우 제목행·탭 라벨·case-ref)은 Bold로 흡수 | D13′ · `layout.ts` |
| P5 | `\arraystretch` 1.3 · `stack.spacing` 0.4em | 그대로, 실물 조율 (v3: Typst cases·행렬 행간은 별도 — D27·N2) | §3-4 |
| P6 ★ | Typst `leading` | **시작값 0.97em** · P0-8로 확정 | §3-4 · P0-8 |
| P7 | 레거시 `**Case n.**` | 변환 없음(본문 그대로) | §3-3 9 |
| P8 | ggb · `mathory-graph` | 자리표시 상자 | D16′ |
| P9 ★ | 그림 폭 | **직렬화기 숫자 계산** — Typst 상한 111.15mm(≈315pt) · LaTeX 153mm | D20 |
| P10 ★ | 한글 어절 줄바꿈 | **템플릿 show 규칙 한 줄** | D21 |
| P11 | 다이얼로그 형식 | 기본 PDF · 마지막 선택 기억(localStorage, try/catch) | §3-6 |
| P12 | 레거시 인쇄 철거 | 70b 안 **단독 커밋** | §3-7 |
| **Q13** | 폰트 출처 | **jsDelivr `gh/notofonts/noto-cjk@<커밋 SHA>` + 코드에 SHA-256 + Cache Storage** — 레포 커밋·빌드 다운로드 없음 | D13′ · §3-7 · R9 · §3-9 |
| **Q14** | 경우 rail·dot | **dot만**(0.44em / 하위 0.26em · 검정 · 이어짓기 없음) — rail은 70 범위 밖 | §3-2 · §3-4 · §9 |
| **Q15** | 탭 범위 | **모든 형식(PDF·.tex·.typ·Overleaf·MD)이 선택 탭 = 가시 탭만** — `handleDownloadMarkdown`에 탭 인자 추가, 멤버 숨김 탭 누출 잠복을 함께 닫는다 | §1-5 · §3-6 · §3-8 · 실물 ④ |
| **Q16** | 문항 제목 | **PDF·.typ 없음(현행 인쇄와 같음) / .tex만 머리에 `\section*{제목}`** | §3-4 |
| **Q17** | ①~⑳ 글리프 | **Noto Serif KR 글리프 수용 + `#show regex("[①-⑳]"): set text(size: 0.88em)`** — 88%는 P0-3 실물에서만 조정 | §3-4 · P0-3 |
| **Q18** | `stripInvisibles` | **적용**(IR 2단계) | §3-3 2 |
| **Q19′** | Stage 0 표본·도구 | **(가) 시트 Data_DS·Stack**(61a 서비스 계정 `spreadsheets.readonly` — 양) **+ (나) Mathory 덤프**(70a 중 임시 개발 페이지 — 덕수가 로그인한 브라우저에서 본인 문항 원문을 JSON으로 내려받아 CLI에 전달, 비밀값 이동 0, 다 쓰면 페이지 삭제) · 대표 **13문항**(§4-1, 덕수 지정 2026-10-13) · `typst-ts-node-compiler` 0.7.0을 **devDependency로 고정**. ⚠ v2~v4의 `mathory-content` 아카이브는 실측 **문항 4개**(파일 17 — 55b로 내보낸 문항만)라 표본 출처에서 뺐다(덕수 확인 2026-10-13) | P0-1 · §4-1 · §7-1 |
| **Q20** | 본문 `C1`·`C2a` | **굵게 유지**(`CASE_REF_RE` → `caseRef`) | §3-3 8 |
| **Q21** | svg 초기 뷰 | **`svg_initial_view` 무시 + `svg_height`(기본 300px)만** | §3-3 11 · §3-4 |

### 6-2. 신규 판정 — v3 (덕수 확정 2026-10-13, 전항 권장안)
| # | 질문 | 확정 | 기각한 대안 | 근거 |
|---|---|---|---|---|
| **N1** | 70 PDF·.typ의 **자간**(D24 ④) | **0 — 현행 CSS 인쇄 그대로**. 70의 "원본"은 현행 인쇄이고 그 자간이 0이다. KICE 실측 자간(−0.048em)은 시험지 양식(D5)에서 쓴다 | KICE 실측값을 70에도 적용 | 70은 문항 1개 인쇄의 엔진 교체(D15) — 같은 문항이 현행 PDF와 나란히 대조된다(실물 ⑤) |
| **N2** | cases·행렬 행간 시작값(D27) | **1em**, P0-10 실물로 한 값 확정 | 0.8em·1.2em | 수능 템플릿에서 1em이 KICE 원본에 가까웠다 |
| **N3** | 수능 템플릿 v1(`suneung-template.typ`·`sample.typ`·README)을 레포에 | **`docs/phaseSketch/suneung-template-v1/`에 참고본으로 커밋**(70a 8단계 docs 커밋에 동승) — 런타임·빌드 0, D5 Phase의 출발점 | 프로젝트 문서에만 둔다 | 다음 Phase 착수 때 CLI가 레포만 보고 시작할 수 있다 |
| **N4** | 70에 고딕을 넣는가 | **넣지 않는다** — 현행 인쇄의 탭 라벨·제목은 명조 600이다. 고딕(Noto Sans KR)은 D5에서 | 탭 라벨만 고딕 | D24 ① 글꼴 최소화 · 폰트 다운로드 +7MB 회피 |
| **N5** | 열 폭보다 긴 인라인 수식(R11) | **Typst 기본(끊김) 수용** | 넘쳐도 끊지 않기(`box` + `width` 고정) | 넘치면 옆 단을 침범해 내용이 가려진다 — 현행 CSS의 결함을 옮길 이유가 없다 |

### 6-3. 신규 판정 — v4 (덕수 확정 2026-10-13, 전항 권장안)
| # | 질문 | 확정 | 기각한 대안 | 근거 |
|---|---|---|---|---|
| **N6** | mitex 실패 수식 처리 | **수식 단위 격리 + 대체 표시**(D28) — PDF는 항상 나오고, 변환 못 한 수식만 원문 LaTeX 상자로 + 목록 고지. 실패율이 높으면 tex2typst 재시도를 사이에 끼운다 | (b) 실패하면 PDF를 포기하고 목록만 안내 (c) 처음부터 수식마다 tex2typst 병행 | 미지원 명령 하나가 문서 전체를 죽인다(J3) — (b)는 한 수식 때문에 문항 전체를 못 내보낸다 · (c)는 의존성·번들이 늘고 두 엔진의 조판이 섞인다 |
| **N7** | 코칭 라벨 | **아이콘 + 'Tip' 명조 700**(D31) | 'Tip' 텍스트만 | 코칭 규약: 식별은 아이콘 + 굵기 — 흑백 인쇄에서 아이콘은 형태 신호다 · 아이콘은 SVG path라 글꼴 추가 0(D24① 위반 아님) |
| **N8** | 템플릿 이전 판 정리 | **기준 `suneung-template-v1/`만 남기고 옛 판 셋(`suneung-typst/` 폴더 · `suneung-typst.zip` · `suneung-typst-v5.zip`)과 중복인 `suneung-template-v1.zip`을 `_archive/Phase70/`로** — 덕수 확인 뒤 CLI가 옮긴다(지우지 않는다) | 그대로 둔다 | 같은 계열 이름이 넷이면 다음에 또 옛 판을 집는다(이번 왕복이 그랬다 — 옛 판에는 v3 §9의 KICE 실측값(자간 −0.048em·어절 168%·W-* 굵기·명조 번호·수식 뒤 0.14em)이 없다, 부록 I-6) |
| **N3′** | N3 개정 — 템플릿을 어디에 무엇을 커밋하나 | **`docs/reference/suneung-typst-v1/`에 `suneung-template.typ` + `README.md`만 커밋**(README의 파일 목록을 그에 맞게 고친다). `sample.typ`·`sample.pdf`·`compare-*.png`는 `docs/phaseSketch/_archive/Phase70/`(로컬 · gitignore) | v3 N3 그대로(`docs/phaseSketch/suneung-template-v1/`에 zip 전부) | ① `sample.typ`·`sample.pdf`는 **2026학년도 수능 실제 문항**이고 `compare-*.png`는 **KICE 원본 지면 캡처**다 — 공개 레포 재배포는 피한다 ② CLAUDE.md 작업 규칙 7(2026-10-10): phaseSketch는 정리 대상이고 공개 레포에 검수 스크린샷을 커밋하지 않는다 — D5의 출발점이 정리 때 휩쓸리지 않게 `docs/reference/` ③ 템플릿 본체에는 실측 상수뿐이라 문제없다 |

⚠ 덕수에게 남은 준비물(착수 전): ① ~~Stage 0 대표 문항 지정~~ — **13문항 지정 완료**(§4-1) · 덤프 페이지가 생기면 내려받기 1회 ② P0-7 Overleaf 샘플 컴파일 1회(.tex는 70a 4단계 뒤 CLI가 준비) ③ ~~`suneung-template-v1.zip` 전달~~ — **`docs/phaseSketch/suneung-template-v1/`에 있다**(덕수 정정 · v4 확인). N8·N3′ 확정(2026-10-13) — N8 정리는 확정 직후 수행(§11)

## 7. 검증

### 7-1. 자동
- `test:exportkinds`(union 원문 파싱 대조 — 사본 목록 금지) · `test:exportir`(**실제 remark 파서 주입**: 마커·`⟦TAG⟧`·display tag(숫자·비숫자)·rows·case 라벨·choices·figure·mathory-graph·html 벗기기·레거시 타입·locale) · `test:exportlatex`·`test:exporttypst`(이스케이프 전수 · kind 8종 스냅샷 · 결정성 · 문자열 리터럴 이스케이프).
- **P0-9 동치 테스트**를 `test:exportir`에 상주시킨다(화면 경로와 문단·수식 개수·순서 일치).
- `test:exporttypst`에 **실패 격리 고정 표본**: `\textcircled{1}`이 든 문항 → 1차 실패 · 격리 후 PDF 생성 · 대체 수식 1개 · 정상 수식 보존(D28). cases `&` 앞 `\quad` 삽입(D32 — 깊이 0만, `\begin{cases}` 안의 중첩 `aligned` `&`는 건드리지 않는다) 문자열 스냅샷. 선택지 2칸 grid·display 왼쪽 정렬은 컴파일 결과의 **SVG 출력 좌표**(`compiler.svg`)로 검사한다(poppler 의존 없이)
- `test:exporttypst`가 devDependency 컴파일러(`typst-ts-node-compiler` 0.7.0 · 벤더링 mitex · 폰트는 테스트 시 Cache 없이 로컬 경로)로 스냅샷 .typ를 **실제 컴파일**해 진단 0을 확인한다(Q19). 폰트 파일이 없으면 그 한 건만 skip하고 이유를 출력한다.

### 7-2. 실물(덕수)
- 70a: ① .tex → Overleaf 열기(그림·경우·선택지 문항 각 1) ② .typ 로컬 컴파일(**Typst 0.14.2**, 폰트 설치) ③ 다이얼로그 '추가 형식'·기억 ④ 멤버 계정에서 숨긴 탭이 어떤 형식으로도 안 나가는지(Q15).
- 70b: ⑤ PDF — 현행 CSS PDF와 **나란히 대조**(같은 3문항 + 긴 풀이 1) ⑥ 첫 로드·두 번째 즉시 ⑦ 철거 후 편집·열람·공유·폰 화면 무변화 ⑧ 원문자·경우 dot 실물(Q14·Q17) ⑨ 블록 간격(P0-8′)·cases 행간(P0-10)·긴 인라인 수식이 현행 PDF와 같은 자리에서 줄을 바꾸는지(D25) ⑩ 분수·근호가 든 선택지의 라벨 세로 위치(D29) · display 수식이 왼쪽 2em에 서는지(D30) · 코칭 아이콘(D31) · cases 조건 열 간격(D32) ⑪ 미지원 명령이 든 문항(예: `\textcircled`)이 PDF로 나오고 경고가 뜨는지(D28).

---

## 8. 작업 순서 · 커밋
**70a**: 1 `blockKinds`+`layout` · 2 `prepare`+`ir` + fixtures + `test:exportir`(P0-9 포함) · 3 `latex` · 4 `typst` · 5 `assets`·`overleaf` + fflate · 6 `ExportDialog` + 메뉴 교체 + `handleDownloadMarkdown` 탭 인자 · 7 임시 덤프 페이지(`app/dev70-dump` — 로그인 사용자 본인 문항의 블록 원문을 JSON 한 파일로 내려받기 · 커밋하지 않고 Stage 0 뒤 삭제, 68b 하니스 선례처럼 소스는 phaseSketch에) + `exportProbe`(시트 + 덤프 · 대표 13문항 §4-1) + Stage 0 기록(`docs/phaseSketch/phase70-stage0.md`) · 8 CLAUDE.md·THIRD_PARTY_LICENSES · `docs/reference/suneung-typst-v1/`(N3′ — `docs/phaseSketch/suneung-template-v1/`의 `suneung-template.typ` + 고친 `README.md`만, 런타임·빌드 0) · ~~N8 정리~~(2026-10-13 판정 직후 수행 — §11)
**70b**(Stage 0 수치 뒤): 1 `export:assets` + mitex 벤더링 · 2 `compile.ts` + 폰트 로더 + **D28 실패 격리** · 3 PDF 갈래 교체 · 4 **철거 단독 커밋** · 5 CLAUDE.md·roadmap · phasedocs 확정본
커밋 접두 `feat(phase70a)` / `feat(phase70b)` / `chore(phase70b): 레거시 인쇄 철거`. push는 덕수.

## 9. 다음 Phase에 넘기는 것
v1 그대로(HWPX·시험지 조립·ggb 스냅샷·폰트 서브셋·Pretendard). 덧붙임: **렌더 `\[` 정규식 뒤돌아보기**(prelaunch) · 경우 rail(Q14로 70에서는 dot만).

**시험지 조립(D5)에 넘기는 것 — 수능 템플릿 v1(2026-10-13, web) 결과**
- 용지: **A3 세로** — KICE 배포 PDF(2511) 실측 297×420.2mm 기준(덕수 확정). 실제 시험지는 B4~A3 사이로 축소 인쇄되지만 Mathory는 인쇄·활용이 편한 A 계열 용지를 쓴다.
- KICE 지면 실측: 좌우 여백 31mm · 머리글 괘선 52mm(표지면 77mm) · 2단 간격 11mm + 세로 괘선 · 본문 끝 376.5mm · 본문 11.5pt · 행 간격 20.2pt · 문항 번호 13pt · 선택지 5등분 · 쪽 번호 사선 상자 18×7.8mm.
- KICE 글꼴(PDF 내장 이름): 본문 신명 중명조·한양신명조 · 번호 한양견명조 · 머리글 신명 디나루·견명조·한양견고딕·태고딕 · 수식 HyhwpEQ — 전부 상용/HWP 동봉이라 배포 불가 → **명조 Noto Serif KR · 고딕 Noto Sans KR · 수식 New Computer Modern Math**(D24).
- 자간·간격(KICE 실측 → 템플릿 상수): 본문 한글 글자 간격 0.918em → `tracking −0.048em` · 어절 간격 0.429em → `spacing 168%` · 머리글 `tracking −0.04em` · 행 간격은 `top-edge: ascender / bottom-edge: descender` + `leading 0.69em`.
- 머리글 굵기: 원본보다 2단계 가볍게(제목 Medium · 형 상자 Regular · 시험명 DemiLight) · 문항 번호 명조 Bold(덕수 확정).
- Typst 기법: 한글 어절 줄바꿈 show regex(D21과 같음) · 인라인 수식 box(D25) · cases gap 1em(D27) · 수식 뒤 조사 간격 0.14em(KICE 원본 실측 — 70에는 적용 안 함) · 표지면 float + `<suneung-cover>` 라벨로 머리글 분기 · 섹션별 쪽 번호.
- 원본: 프로젝트 문서 `suneung-template.typ (… v1, 2026-10-13)` · 레포 `docs/reference/suneung-typst-v1/`(N3′, 70a 8단계).
- ⚠ 엔진 버전(v4 J6): 템플릿은 Typst **0.15.0**으로 만들어졌고 Mathory 브라우저 엔진은 **0.14.2**(typst.ts 0.7.0)다. 0.14.2에서도 오류 없이 컴파일되지만 **선택지 숫자가 ①보다 약 3pt 뜬다**(0.15에선 정렬, 부록 I-5). 템플릿 선택지는 `box({① h(2.1mm) it})`를 `align: horizon` 칸에 넣고 본문이 `top-edge: ascender`라 엔진마다 결과가 갈린다 → D5 착수 때 70의 D29(라벨·내용 2칸 grid)로 바꾸거나 typst.ts를 0.15 계열로 올린 뒤 재측정
- ⚠ 템플릿 선택지도 baseline 계열이라 **분수 선택지에서 라벨이 내려앉는** M2 B 결함을 갖는다(부록 I-4 표본) — D29 한 벌로 맞출 것
- 미해결: 내년 수능 형식 변경에 따른 새 양식 · 원문자 실물 · 그래프 그림 배치.

---

## 부록 A — v1 정정 (E)

| # | v1 서술 | 실측 | 처리 |
|---|---|---|---|
| E1 | "ESM 전용 패키지는 하니스에서 require 실패 → remark 불가" · "수식 영역은 `mathRegions`(편집창과 같은 것)" | `tests/chatExtract.test.mjs:21-27`이 remark 파이프라인을 이미 import · Node 25.6 · `mathRegions.ts:1-8` "렌더 경로는 별개", R-$$ (c) 등 remark-math와 판정이 다름 | D7′ |
| E2 | `protectMath`/`restoreMath` 367~368 | export 블록 `locale.ts:374-`(함수 정의 100·112) | 행 번호 |
| E3 | locale 'ko'·'international' 두 갈래 | `preprocessLocale` ko 전용 게이트(344-345) · 렌더 사이트 전부 `"ko"` 하드코딩 | §1-2 |
| E4 | `calc.min(…px*0.75pt, 90%)` | 컴파일 오류 "cannot compare ratio and length"(부록 C t1) | D20 |
| E5 | `\tag`는 "IR에서 떼므로 통과 불필요" — 맞으나 근거 부족 · 텍스트·수식 정규식 미구분 | mitex가 `\tag`를 **조용히 삭제**(standard.typ:104, t3) · 렌더 `\tag*`는 숫자만, KaTeX는 비숫자도 그림 | D8′ |
| E6 | `\displaystyle` 실패 시 `math.display` 대안 · raw 백틱 늘리기 | mitex `\displaystyle` 지원(176, t3) · `mi`는 str을 받는다 · 백틱 3개부터 언어 태그 함정 | D9·D22 |
| E7 | 한글 어절은 본문 `#box[…]` 감싸기 | 음절 분리 실측 · show regex 한 줄로 해결 실측 | D21 |
| E8 | `par.leading 0.65em` = "1.7 근사" | 0.65em은 Typst 기본값(≈1.35배) | P6 |
| E9 | Overleaf: `snip` + 다중 `snip_uri[]`(Storage URL) | 공식 문서: data URL·zip 허용 · svg는 URL로 줄 png가 없다 | §3-5 |
| E10 | `\setmainfont{Noto Serif KR}` | Overleaf 이름은 "Noto Serif CJK KR" → 컴파일 실패 | §3-4 프리앰블 |
| E11 | `\usepackage{amsmath,…}` + `\usepackage[fleqn]{amsmath}` | LaTeX Option clash | 한 번만 |
| E12 | 폰트 "합계 ≤25MB면 그대로" | Regular 7.67 + Bold 7.91 = 15.6MB(SemiBold 7.61) | P4 수치 |
| E13 | wasm ≈10MB대 · "Typst 0.13+" | 원본 28.3MB · 내장 Typst 0.14.2 | §1-7 |
| E14 | P0-1을 `brew install typst`로 | 최신 CLI ≠ 브라우저 0.14.2 | node-compiler 0.7.0 |
| E15 | `mathory-content` 아카이브(접근 전제) | 비공개(API 404) · 55b 내보낸 문항만 | Q19 |
| E16 | `--font-print` 남김(원문자 size-adjust 공유) | size-adjust는 `@font-face`, `--font-print` 소비처는 철거 대상뿐 | D15′ |
| E17 | 원문자 = Noto Serif KR 글리프 존재 여부만 | 현 인쇄는 MathoryCircled(AppleGothic 계열·88%) | Q17 |
| E18 | 경우 = `*C1.* 제목행` · rail·dot 언급 없음 | 제목행 전체 600 · rail·dot 인쇄에 있음 | §3-2·Q14 |
| E19 | 코칭 바 1.5pt · ① 2em만 · display 들여쓰기 없음 | 0.3mm · ① margin-left 1em·밭 11pt · fleqn 2em | D19 |
| E20 | figure = 폭·gray만 | image `frame` · svg 고정 높이 · gray는 필터 없음 | §3-3·D23·Q21 |
| E21 | 그림 ext를 URL로 판단 | 저장은 png/jpg지만 src는 임의 URL | 매직 바이트 |
| E22 | Markdown은 탭 선택 무시(현행 보존) | 현행이 멤버 숨김 탭까지 내보냄 | Q15 |
| E23 | ExportDialog = PdfDialog 승계 | PdfDialog는 dialogStyles 밖 자체 규격 | D17′ |
| E24 | "prebuild `export:assets`" | `prebuild` 없음 — `build` 체인·`predev` | §3-7 |
| E25 | 행 번호 | union 238(≠296) · PrintStyles import `EditorView.tsx:63`(≠56) · `COACH_LABELS` 24-27(≠28) · `buildCaseLabels` 110-136(≠123-155) · `preprocessLocale` 344(≠330) · `convertTextTags` 322(≠280) · `download_md` 734-743 · `ALL_TYPES` 13종 | 본문 반영 |
| E26 | `ExportDoc.title` 출력 위치 미정 | 현 PDF에 제목 없음 | Q16 |
| E27 | `code` Flow 그대로 출력 | `mathory-graph` 펜스는 화면에서 그래프 | D16′ |
| E28 | 메모리 `areas/exam-paper-assembly` | 이 레포의 Claude Code 메모리에는 없다(web 쪽 메모리) | 참조만 유지 |

## 부록 B — v1 대비 보완 (G)
- G1 IR 단계에 `stripInvisibles`(Q18) · G2 `html` 노드 처리 규칙 · G3 `⟦TAG:n⟧` 표지로 텍스트 행 끝 tag를 파서 너머로 운반 · G4 레이아웃 상수 표 `layout.ts`(D19) · G5 P0-8·P0-9 신설 · G6 Typst `smartquote` 끄기 · G7 Overleaf 항상 zip 한 갈래 · G8 멤버 가시성을 모든 형식에 · G9 철거 부수 변화(⌘P) 명시 · G10 렌더 `\[` 잠복 버그 기록(R10) · G11 `ExportTab.tone`(풀이 strong 700) · G12 표 `align`·목록 `start` 보존

## 부록 C — 이 검토의 Typst 실측 (2026-10-13, typst-ts-node-compiler 0.7.0 = Typst 0.14.2 · mitex 0.2.7 로컬 · Noto Serif KR Subset OTF)
| # | 입력 | 결과 |
|---|---|---|
| t1 | `#image("x.png", width: calc.min(300pt, 90%))` · `#let w = calc.min(300pt, 90%)` | **FAIL** "cannot compare ratio and length"(둘 다) |
| t2 | 60mm 폭에 한글 문장 | 음절 분리: "…계산하여라 이때 조 / 건을 만족시키는…" |
| t2b | 같은 문장 + `#show regex("[\p{Hangul}]+"): it => box(it)` | 어절 분리: "…이때 / 조건을…" |
| t3 | `#mi("\displaystyle \frac{1}{2} + \sum_{k=1}^{n} k")` · `#mitex(array{l} + \displaystyle 2행)` · `cases` · `x^2 \tag{3}` · `#mi("\text{(가)} \text{ 한글 } x")` · `aligned` | 전부 컴파일 OK · `\sum` 극한 위아래(display 적용) · **`(3)` 소멸** · 한글 `\text` 정상 |
| t4 | `가나ABC다라 x한글` 기본 vs `cjk-latin-spacing: none` | 렌더 동일(한글엔 자동 간격 없음) |
| t5 | `page(paper: "a3", …, columns: 2)` + `columns(gutter: 10mm)` + `par(leading, spacing)` + `#colbreak()` | OK |
| t6 | **§3-4 v2 템플릿 머리 전체** + `#show regex("[①-⑳]")` + tag `#grid` + 코칭 `#block` + `#image(…svg, width: 315pt)` | 컴파일 OK · 진단 0 · 직선 따옴표 유지 · `(3)` 우측 정렬(v2 템플릿에 새 오류 없음 확인) |

---

## 부록 D — web v3 실측 (2026-10-13, typst-py 0.15.0 · 시스템 Noto Serif CJK KR · 70mm 열 · 10pt)

### D-1. v2 주장 대조 요약
- **맞음(✓)**: union 17종 `types/problem.ts:238` · `ALL_TYPES` 13종 · locale 게이트 `locale.ts:344` · 렌더 사이트 `locale="ko"` 하드코딩(TabBody·FolderView·pdfPrint) · 인쇄 실측표 §1-3 전항(코칭 바 0.3mm·라벨 700, 경우 rail −1.2em 0.15mm `#8a8a8a`·dot 0.44/0.26em·제목행 600, 테두리 12pt, ① margin-left 1em, display fleqn 2em) · 화면 제목행 500(`globals.css:992`) · MathoryCircled 88%(`globals.css:37-45`) · `--font-print` 소비처(globals 31·164·1129 주석, pdfPrint 41 주석, PrintStyles) · 멤버 탭 필터 `ProblemView.tsx:558-561` · `PrintableContent` 제목 미표시 · `chatExtract.test.mjs` remark import · `mathRegions` 헤더 "렌더 경로 별개" · `normalizeMathDelimiters` 142 · `isToneScoped`(keyTone) · `stripInvisibles`(invisibles 30) · `dialogStyles`(`dialogBtn`은 함수) · `package.json` build/predev 체인 · `PrintStyles` import `EditorView.tsx:63` · typst.ts 0.7.0 / web-compiler 언팩 28.4MB · mitex `\tag` 무시·`\displaystyle`·cases·array·aligned 지원 · Overleaf data URL·zip·`main_document`·`engine` · leading 0.97em → 17.0pt
- **틀림/보완**: 부록 E F1~F9

### D-2. Typst 실측
| # | 입력 | 결과 |
|---|---|---|
| t1 | `par(leading: 0.97em, spacing: 6pt)` 3문단 | 줄 사이 17.0pt · **문단 사이 13.3pt**(줄보다 좁음) |
| t1′ | `spacing: 0.97em + 6pt` | 문단 사이 **23.0pt** = CSS(17 + 6) ✓ |
| t2 | 긴 인라인 수식(`f(x)=x^3+3ax^2-9a^2x+4+…`) 기본 | 연산자 뒤에서 **두 줄로 끊김** |
| t2′ | `#show math.equation.where(block: false): box` | 수식이 통째로 다음 줄로 · 열 폭보다 길 때만 끝에서 끊김(R11) |
| t3 | `$f(x)$에` 행 끝 + show regex 한글 box | 조사가 수식과 함께 다음 줄로(조사만 떨어지지 않음) |
| t4 | 수능 템플릿: cases `gap` 기본 vs 1em, KICE 원본 대조 | 기본은 원본보다 좁다 · 1em이 원본에 가깝다(compare 이미지, 템플릿 v1) |

## 부록 E — v2 정정 (web v3, F)

| # | v2 서술 | 실측(v3) | 처리 |
|---|---|---|---|
| F1 | Typst `#set par(leading: 0.97em, spacing: 6pt)` | `spacing`은 줄 상자 끝↔끝 간격이라 **문단 사이(13.3pt)가 줄 사이(17pt)보다 좁아진다**. `0.97em + 6pt` → 23.0pt(= CSS 17 + 6) 실측 | D26 · §3-4 |
| F2 | (인라인 수식 줄바꿈 처리 없음) | Typst는 인라인 수식을 연산자에서 끊는다(실측). 현행 인쇄는 `inline-block`으로 금지(`PrintStyles.css:95-96`) | D25 · §3-4 |
| F3 | P5 "`stack.spacing` 0.4em"으로 행간을 다룸 | `stack`은 rows(bare `\\`)용이다. cases·행렬은 mitex가 `\arraystretch`를 무시(`standard.typ:1207`)하므로 `math.cases`·`math.mat`를 따로 설정해야 한다 | D27 · N2 |
| F4 | Noto CJK OFL RFN = 'Source' | `Serif/LICENSE`에 RFN 선언 없음(결론은 같음) | §3-9 |
| F5 | 기준 HEAD `58e1bd6` | `origin/main`은 `b983022`(58e1bd6 미push) — 코드 행 번호는 같다 | 머리 |
| F6 | `preprocess.ts:131` · `storage.ts:27` | 134 · 49/91. `\[` 보호 정규식(`EditorPreview.tsx:105`)도 뒤돌아보기 없음 | §1-2·§1-4 |
| F7 | (CASE_REF_RE 재사용 주의 없음) | `/g` 상수 — `.test()` 재사용 시 lastIndex 오염 | §1-2 |
| F8 | §3-4 템플릿의 블록 간격 리터럴(11pt 등) | F1과 같은 이유로 CSS 값 그대로는 좁다 | D26 · P0-8′ |
| F9 | mitex 행 번호 104·176 | 0.2.7 tarball 기준 — GitHub HEAD는 107·180(내용 동일) | §1-7 |

## 부록 F — v2 대비 보완 (web v3, H)
- H1 IR의 `\[`/`\(` 정규화 함수가 렌더와 같은 모양을 만든다는 확인(D7′ 전제 보강)
- H2 글꼴 원칙 D24 · 70 글꼴 구성 확정(명조 한 가족 + 수식) · 기각 후보 기록
- H3 cases·행렬 행간 D27 + P0-10
- H4 세로 간격 변환 D26 + P0-8′
- H5 인라인 수식 줄바꿈 금지 D25 + R11
- H6 시험지 조립(D5)에 넘길 KICE 실측·템플릿 기법(§9)
- H7 `CASE_REF_RE` `/g` 함정
- H8 (범위 밖 확인 요청 — CLI · **v4 J4가 정정: 진입은 사이드바 최근 문항 ⋮, 본인 문항만**) FolderView/ListView 우클릭 'MD 다운로드'는 `AppShell.downloadMarkdown`(66-)으로 **문제·풀이 블록만** 내보내고 추가 탭을 버린다. 멤버 문항에서도 그 메뉴가 뜨는지 확인해 Q15와 같은 누출이 있으면 prelaunch 목록에 등록
- H9 Overleaf 크기 상한 단서(페이지 설정 `maxUploadSize` 50MB) — P0-5에서 확인

---

## 부록 G — v3 정정 (CLI v4, J)

| # | v3 서술 | 실측(v4) | 처리 |
|---|---|---|---|
| J1 | §3-4 `#show math.equation.where(block: true): it => block(above: 11pt, below: 11pt, pad(left: 2em, align(left, it)))`(v2가 넣고 v3 계승) | 컴파일은 되지만 **display가 가운데에 선다** — 태그 grid 안에서도 마찬가지(부록 I-1). v2 부록 C t6은 진단 0만 확인했다(CLI v2의 실수) | D30 |
| J2 | mitex `\arraystretch` = 무시(`standard.typ:1207`) | 0.2.7 배포판은 **오류 → 문서 전체 실패**. 1207행 근거는 0.2.7 이후 GitHub HEAD | §1-7 · D27 근거 |
| J3 | (실패 양상 서술 없음) · P0-1 "50개씩 묶어 컴파일" | 미지원 명령 하나가 **같은 문서의 정상 수식까지 전부** 죽인다(`\foo`·`\textcircled`) — 묶음 집계도 같은 이유로 무너진다 | D28 · N6 · P0-1 · P0-11 · R12 |
| J4 | H8 "FolderView/ListView 우클릭 'MD 다운로드'" · D17′ "FolderView 우클릭 MD 그대로" | 그 두 메뉴엔 MD가 없다. 유일한 진입은 사이드바 '최근 문항' ⋮이고 본인 문항만(누출 없음) | §1-5 · D17′ |
| J5 | N3 "덕수가 넘기는 `suneung-template-v1.zip`" | 이미 `docs/phaseSketch/`에 있다 — 덕수 정정(2026-10-13)으로 **기준 폴더 = `suneung-template-v1/`**(zip과 바이트 동일, 15:24판). 옛 `suneung-typst/`(14:46, `suneung-typst.zip`과 동일)·`suneung-typst-v5.zip`(15:19)은 이전 판 | N8 · N3′ |
| J6 | §9 "Typst 기법 … 템플릿 v1" — 엔진 언급 없음 | 템플릿 Creator = Typst 0.15.0 · 0.14.2에서 선택지 숫자 약 3pt 들뜸 | §9 · R13 |
| J7 | §3-2 choices = 3열/5열만 | 현행 인쇄는 라벨·내용 세로 가운데(M2 B). 한 문단 배치는 분수 칸 라벨이 내려앉는다 | D29 |
| J8 | 코칭 = `#text(weight: 700)[Tip]` | 현행 인쇄는 아이콘 + 고딕 라벨 — 아이콘이 빠져 있었다 | D31 · N7 |
| J9 | §3-7 "P0-2에서 실측해 v3/착수판에 적는다" · §4 "Stage 0 결과는 v3에 숫자로" | v3가 착수판이 된 뒤 남은 낡은 지시 | §11로 |
| J10 | 부록 D 실측 엔진 = typst-py 0.15.0 | 브라우저는 0.14.2 — 기준선 17.0 / 문단 23.0pt는 0.14.2에서도 같다(부록 I-3) | P0-8 종료 |
| J11 | D13′ "커밋 SHA·해시는 70b 착수 때" | 지금 확정 가능 — 커밋 `9b0f143…`·SHA-256 2개 실측 | §1-7 · D13′ |
| J12 | P0-3 "Regular/Bold 구분하는지 · ①~⑳ 글리프 존재" 미확인 | 600 → Bold 파일 선택 · ①⑮⑳ 글리프 존재 | P0-3 축소 |
| J13 | (cases 열 간격 서술 없음 — D27은 행간만) | Typst `cases`의 조건 열 앞 간격 0 — 조건이 식에 붙는다 | D32 |

## 부록 H — v3 대비 보완 (CLI v4, L)
- L1 선택지 인쇄 실측(§1-3) → D29 · L2 코칭 라벨 인쇄 실측 → D31 · L3 폰트 고정 커밋·해시 · L4 실패 수식 격리 D28 + 대체 표시 `mathFail` + P0-11 · L5 `test:exporttypst` 고정 표본(격리·선택지·display 정렬, SVG 좌표 검사) · L6 실물 검수 ⑩·⑪ · L7 수능 템플릿 엔진 차·선택지 결함을 D5에 인계 · L8 템플릿 커밋 범위(N3′ — 실제 수능 문항·KICE 지면 캡처 제외) · L9 cases 열 간격 D32 + 고정 표본

## 부록 I — CLI v4 실측 (2026-10-13 · typst-ts-node-compiler 0.7.0 = Typst 0.14.2 · mitex 0.2.7 배포판 · Noto Serif/Sans KR Subset OTF 커밋 `9b0f143`)

**I-1. display 정렬(J1)** — 같은 문서 두 벌을 PNG로 대조
| 규칙 | 결과 |
|---|---|
| `it => block(above:11pt, below:11pt, pad(left:2em, align(left, it)))`(v2·v3) | 단독 display·태그 grid 안 display **둘 다 가운데** |
| `set align(left)` + `set block(above, below)` + `it => pad(left: 2em, it)`(D30) | 둘 다 왼쪽 2em · 태그 `(3)`은 오른쪽 끝·세로 가운데 |

**I-2. mitex 실패 양상(J2·J3)** — 수식 하나씩 컴파일
| 입력 | 결과 |
|---|---|
| `정상 #mi("x^2") 그리고 #mi("\foo{x}")` | **FAIL** "unknown command: \foo" — 정상 수식도 함께 소멸(문서 전체) |
| `\textcircled{1}` | **FAIL** "unknown command: \textcircled" |
| `\renewcommand{\arraystretch}{1.8} \begin{cases}…` | **FAIL** "error unexpected: arraystretch" |
| `\newcommand{\R}{\mathbb{R}} \R` · `\boxed` · `\overset{\frown}{AB}` · `\color{red}` · `\dfrac`·`\tfrac` · `\overline`·`\angle`·`\triangle` · `\vphantom` · `\text{일 때}` · `\left( \frac{1}{2} \right)` · `\lim_{x \to 0+}` · `\text{\$}` · `x \tag*{(1)}` | 전부 OK |

**I-3. 간격·글꼴(J10·J12)**
| 항목 | 결과 |
|---|---|
| `par(leading: 0.97em, spacing: 0.97em + 6pt)` · 10pt · 123.5mm 열 | 줄 사이 기준선 **16.99pt** · 문단 사이 **22.99pt**(= CSS 17 + 6) |
| mitex `cases` 행 피치 | 기본 **12.0pt** → `set math.cases(gap: 1em)` **20.0pt**(KaTeX 1.8 ≈ 21.6pt) |
| `text(weight: 600)` · `700` | pdffonts: Regular + **Bold**만 내장 — 600은 Bold로 |
| ① ⑮ ⑳ | Noto Serif KR 서브셋 글리프로 조판(대체 글꼴 내장 없음) |
| `#show math.equation.where(block: false): box`(D25) · 70mm 열 긴 인라인 | 없으면 `−` 뒤에서 끊김 · 있으면 통째로 다음 줄(v3 D-2 t2와 같음) |
| inline baseline: 기본 · `box` · `box(math.display(it))` · mitex `\displaystyle` ± box | 다섯 줄 모두 본문과 기준선 일치(D9 + D25 조합 무해) |

**I-4. 선택지(J7)**
| 배치 | 결과 |
|---|---|
| 한 칸에 `① #mi("\displaystyle \frac{3}{8}")`(한 문단) | ④가 분수 기준선으로 **내려앉음**(M2 B 결함 재현) |
| D29 라벨·내용 2칸 grid `align: horizon` | `1`·`√3`·`3`·`3/8`·`−3√10/10` 모두 라벨 세로 가운데 |

**I-5. 수능 템플릿(J5·J6)**
| 항목 | 결과 |
|---|---|
| 판 diff | `suneung-typst/` = `suneung-typst.zip`(옛, 14:46) · `suneung-typst-v5.zip`(15:19) ≈ 최신 − 용지 주석 2줄 · **`suneung-template-v1/` = `suneung-template-v1.zip`(15:24, 최신 — 기준)** |
| 최신판 `sample.typ` → 0.14.2 | 컴파일 OK · 5쪽 A3 · 글꼴 7종 내장(명조 R/B · 고딕 DemiLight/R/Medium/B · NewCMMath) |
| 0.15.0(동봉 `sample.pdf`) vs 0.14.2 | 쪽 구성·줄바꿈 같음 · **선택지 숫자가 ①보다 약 3pt 위**(0.14.2만) |

**I-7. cases 열 간격(J13)** — `f(x)=\begin{cases} 3x-2 & (x<1) \\ x^2-3x+a & (x \ge 1) \end{cases}`
| 변형 | 결과 |
|---|---|
| mitex 그대로 · Typst 네이티브 `cases(… & …)` | 둘 다 조건 열 앞 간격 0 — 둘째 행이 `x²−3x+a(x ≥ 1)`로 붙는다 |
| `&` 앞 `\quad`(D32) | 조건 열이 1em 띄고 왼쪽 정렬 — LaTeX·KaTeX와 같은 모양 · `-f(x)`/`f(x)` 표본도 같음 |
| `array{cc}` · `aligned` | 이상 없음(D32 대상 아님) |
| v4 §3-4 템플릿 머리 전체를 문서에서 뽑아 컴파일 | 진단 0 · display 왼쪽 2em · 태그 오른쪽·세로 가운데 · 선택지 가운데 · ① 88% — **모양까지 확인**(J1의 교훈) |

**I-6. 옛 판 → 최신판 차이(N8 근거)** — 옛 판(`suneung-typst/` · 이번 왕복에 첨부된 README·sample.pdf)에 없고 기준 `suneung-template-v1/`에만 있는 것: 글꼴 원칙 주석 · `TRACKING −0.048em` · `WORD-SPACING 168%` · `HEAD-TRACKING −0.04em` · 굵기 상수 `W-*`(제목 Medium 500 · 상자 Regular · 시험명 DemiLight 350) · **문항 번호 명조 Bold**(옛 판은 고딕 Bold) · 수식 뒤 `h(0.14em)` · `set math.cases(gap: 1em)` · 글꼴 목록에서 KoPub·Pretendard 제거 · sample의 조사 붙여 쓰기(`$f(x)$에`)

---

## 11. 구현 기록 (CLI가 채운다)

### 11-1. 70a 커밋 (2026-10-13)
| # | 커밋 | 내용 |
|---|---|---|
| 1 | `12f244b` | blockKinds(D2) · layout(D19) + test:exportkinds 9 |
| 2 | `c2eaf85` | prepare · ir + test:exportir 24(P0-9 상주) |
| 3 | `5044eb4` | latex(A4 1단) + test:exportlatex 10 · 스냅샷 |
| 4 | `c2d2079` | typst(A3 2단) + test:exporttypst(실제 컴파일) · devDependency node-compiler · mitex 벤더링 |
| 5 | `2cea588` | assets · overleaf + test:exportassets 5 · fflate |
| 6 | `483f5c6` | ExportDialog · ProblemView '내보내기…' · run.ts · PdfDialog 삭제 · CDP 13/13 |
| 7 | `37ab69b` | probe:export · 덤프 페이지 소스 · normalizeEnvsForMitex · Stage 0 기록 |
| 8 | (이 커밋) | docs/reference/suneung-typst-v1 · THIRD_PARTY_LICENSES · CLAUDE.md · prelaunch 9·10 · .gitignore |

### 11-2. 착수판 대비 이탈·보완 (I)
| # | 착수판 | 구현 | 이유 |
|---|---|---|---|
| I1 | IR `Inline.ref`(텍스트 `\ref`) | prepare가 `(n)` 글자로 바꾸고 `ref` 타입은 없앴다 | 말풍선용 장식이라 내보내기엔 글자만 — 소비처 0 타입 금지 |
| I2 | heading kind = `level·inline` | `heading { first, body: Flow[] }` + Flow `h` | 텍스트 블록 안 `## `도 제목이라 Flow에 `h`가 필요했다 |
| I3 | fixtures `*.json` | `tests/fixtures/export/sampleProblem.mjs`(String.raw) | 백슬래시 이스케이프 지옥 |
| I4 | mitex 벤더링 70b-1 | 70a-4 | test:exporttypst가 실제 컴파일하려면 지금 필요 |
| I5 | PdfDialog 철거 70b | 70a-6 삭제 | ExportDialog로 대체돼 즉시 호출처 0 |
| I6 | rows → `#stack` | `\begin{array}{l}` + 행마다 `\displaystyle`를 mitex 하나로 | 렌더와 같은 꼴 · mitex array 통과(P0-4) · 행간은 math.mat row-gap |
| I7 | D21 `[\p{Hangul}]+` | `[^\s]*\p{Hangul}[^\s]*` | `[4점]`이 `[4`/`점]`으로 끊겼다(PNG 확인) — 수능 템플릿과 같은 regex |
| I8 | (없음) | 인라인 `#식` 끝 `;` | 뒤 글자 `(가)`가 호출로 읽혀 컴파일 실패("unknown variable: 가") |
| I9 | (없음) | `normalizeEnvsForMitex` — ROW_ENVS 29종 중 13종 | mitex 0.2.7 "unknown environment" · Vmatrix 구분자 오류 |
| I10 | 표 폭 미지정 | `columns: (1fr,) * n` | 현행 인쇄 `table { width: 100% }` |
| I11 | IR `img` 폭 없음 | `img.widthPx`(`<img width>`) | 본문 그림 폭을 버리고 있었다(스냅샷 리뷰) |
| I12 | 표본 = Data_DS·Stack | 기본 Stack | Data_DS 0행(처리 후 비움) |
| I13 | `unified`·`remark-parse` | devDependencies → dependencies | 앱 코드(run.ts)가 import |
| I14 | 7-1 SVG 좌표 검사 | 실제 컴파일 + `query`로 이스케이프 원문 대조 + PNG 육안(CDP·표본) | 좌표 추출이 과했다 — 모양은 P0-8′·실물 ⑧~⑩ |

### 11-3. Stage 0 (→ `docs/phaseSketch/phase70-stage0.md`)
P0-1 Stack 5,746문항 · 수식 161,237(고유 40,898) · **99.99%** · 실패 고유 9 · 실패 문항 8 → mitex 확정. (나) 덤프·대표 13문항 대기.
- **2026-10-13 Stage 0 표본 확정**: 대표 13문항(§4-1) · 표본 출처 Q19′((가) 시트 + (나) 덤프 — `mathory-content`는 4문항뿐이라 제외)
- **2026-10-13 N8 수행**: `suneung-typst/` · `suneung-typst.zip` · `suneung-typst-v5.zip` · `suneung-template-v1.zip` → `docs/phaseSketch/_archive/Phase70/`(로컬 · gitignore · 삭제 없음). phaseSketch에는 기준 `suneung-template-v1/`만 남는다
- 커밋 · v4 착수판 대비 이탈·보완(I1~) · 알고 두는 것 · Stage 0 수치(P0-1~P0-11) · P0-2에서 확정한 typst.ts 접근 모델·패키지 레지스트리·기본 폰트 로더 API

### 11-4. 70b 커밋 (2026-10-13)
| # | 커밋 | 내용 |
|---|---|---|
| 후속 | `1360e54` | 빈 수식·빈 행이 Typst 문서 전체를 죽이던 것(Stage 0 덤프) |
| 후속 | `8bb46d5` | '추가 형식' 토글을 사이드바 chevron으로(덕수) |
| 1 | `8750006` | typst.ts·web-compiler 0.7.0 · `export:assets`(wasm → public/typst/…0.7.0.wasm · predev·build · gitignore) |
| 2 | `a3b371b` | `compile.ts`(글꼴 3종 SHA-256 · Cache Storage · mitex·그림 mapShadow) · `isolate.ts`(D28 이분 탐색) · Y11·Y12 |
| 3 | `61e73d0` | PDF = Typst · .typ도 같은 점검 · 진행 문구 · 원문 상자에 주입 `\displaystyle` 제거 · CDP 16/16 |
| 4 | `69c6302` | **레거시 인쇄 철거 단독 커밋**(pdfPrint · components/print 3파일 · `--font-print` · 렌더 사이트 5 → 4) |
| 5 | (이 커밋) | CLAUDE.md · roadmap · 이 확정본 |

### 11-5. 70b 이탈·보완 (I, 계속)
| # | 착수판 | 구현 | 이유 |
|---|---|---|---|
| I15 | 벤더링 mitex를 패키지 레지스트리 훅으로 `@preview/mitex:0.2.7`에 매핑 | **`mapShadow` 가상 파일** `/mitex/…` + PDF용 .typ는 `/mitex/lib.typ` import(다운로드용은 `@preview` 그대로) | typst.ts `FetchPackageRegistry`는 **동기 XHR**로 packages.typst.org를 친다 · resolve가 동기라 비동기 벤더 파일을 못 넣는다 |
| I16 | 수식 글꼴은 typst.ts 기본 로더 | 기본 묶음(text 17파일)을 끄고 NewCMMath-Regular 하나만 같은 출처(typst-assets v0.13.1)에서 SHA-256 고정 | 첫 로드 용량 · 결정성 |
| I17 | `@myriaddreamin/typst.ts` 루트 import | **`/compiler` 서브패스** + `dist/esm/options.init.mjs`(loadFonts) | 루트 index가 설치하지 않은 렌더러 peer(`typst-ts-renderer`)를 끌고 온다 |
| I18 | wasm `public/typst/typst_ts_web_compiler_bg.wasm` | 파일명에 버전(`…0.7.0.wasm`) · `export:assets`가 옛 판 정리 | 브라우저·CDN 캐시가 판 사이에 섞이지 않게 |
| I19 | (없음) | 빈 수식은 내지 않음 · display 빈 행은 `{}` | mitex "cannot calculate sum of empty array" — Stage 0 덤프 실측 |
| I20 | (없음) | 원문 상자(`math-fail`)에는 앞머리 `\displaystyle`을 뗀 원문 | 주입한 것이 사용자 원문처럼 보였다(PNG 확인) |

### 11-6. 70b 실측
- P0-2(localhost · 빈 프로필): 첫 PDF **2.5초**(wasm 28MB 로컬 + 글꼴 약 16.7MB jsDelivr) · 두 번째 **0.4초** · 내장 글꼴 정확히 3종 — 배포 환경 전송 크기(`Content-Encoding`)는 실물 단계
- 빌드: `/` 첫 로드 888 → 887kB(레거시 인쇄 제거) · 내보내기 코드는 별도 지연 청크(초기 청크 29개에 0)
- 남은 실물(덕수): ⑤ PDF를 옛 인쇄와 나란히(같은 3문항 + 긴 풀이) ⑥ 첫 로드·두 번째 체감 ⑦ 철거 후 편집·열람·공유·폰 화면 무변화 ⑧ 원문자·경우 dot ⑨ 블록 간격·cases 행간·긴 인라인 ⑩ 선택지·display·코칭·cases 조건 열 ⑪ 미지원 명령 문항의 안내

- **실물 결과(2026-10-13, 덕수)**: ⑥ 두 번째 빠름 · ⑦ 화면 무변화 · ⑧~⑩ 원문자·dot·간격·cases·선택지·코칭 정상 · ⑪ 미지원 명령 안내 정상 — **70b 종결**. 같은 보고에 양식 요청이 붙어 70c가 됐다

### 11-7. 70c — PDF·.typ 수능 시험지 양식 (2026-10-13, 덕수 요청 → 권장안 A~H)
요청 원문: `docs/phaseSketch/PDF 조판 기능 테스트 결과와 요청사항.md`(로컬). **D10(PDF·.typ = 옛 CSS 인쇄 규격)과 N1(자간 0)을 뒤집었다** — 70의 "원본"이 옛 인쇄에서 수능 시험지로 바뀌었다(덕수). D5(시험지 조립 Phase)는 그대로 — 70c는 **문항 1개를 시험지 쪽 규격에** 담을 뿐이고 여러 문항 배치·문항 번호·표지는 아니다.

| 결정 | 내용 |
|---|---|
| A 쪽·글자 | 수능 양식(`docs/reference/suneung-typst-v1/`)에서 머리말(쪽 번호·과목·시험명·홀수형)·'5지선다형'/'단답형' 상자·확인 사항·저작권 문구 제외. 남김: A3 · 좌우 31mm · 위 가로 괘선 52mm(0.4mm) · 본문 56~376.5mm · 2단 · 단 간격 11mm · 가운데 세로 괘선(0.3mm) · 하단 중앙 쪽 번호 상자(18×7.8mm 사선 `n/전체`). **모든 쪽 같은 규격**(1쪽 큰 머리말 없음). 글자 11.5pt · 자간 −0.048em · 어절 간격 168%(원본 실측) |
| B 행간 | 템플릿 줄 상자(`top-edge: ascender` · `bottom-edge: descender`) + leading **0.69em** → 평범한 줄 기준선 간격 **20.8pt**(수능 원본 20.2 · 옛 PDF는 10pt에 0.97em). **가변 행간은 따로 만들 것이 없다** — Typst가 줄마다 상자 높이를 재므로 큰 인라인 수식 줄은 저절로 벌어진다(실측 분수 23.5 · 시그마 27.8 · 적분 28.7 · 번분수 29.2pt). 수식이 든 모든 줄을 같은 높이로 맞추는 '고정 최대 행간'은 기각(평범한 줄이 함께 벌어진다) |
| C 탭 제목 | `tabTitle` — 문제 탭 '문제' · 풀이 탭 **'해설'**(시험지 관례 · 앱 화면은 '풀이' 그대로) · 그 밖은 탭 이름. 13pt Bold · 밑줄 없음. 문제는 1쪽 왼쪽 단, 해설은 단 바꿈으로 오른쪽 단부터(현행 `colbreak` 그대로) |
| D 블록 간격 | `typstGap(css) = css × 1.15 + leading` — 글자 비율로 키운다 |
| E 마커 | `(가)`·`ㄱ.`·`①` 본문 굵기(`WEIGHT.marker` 600 → 400) — 화면과 같아졌다(M1 E "PDF 600" 예외 소멸) |
| F 선택지 | 4~5개는 5열, **한 항목이라도 5열 칸을 넘으면 3열**(Typst `layout`+`measure` — 3+2) |
| G .tex | 상자 선 0.13mm · `FrameSep` 3.5mm · 마커 본문 굵기 · 탭 제목('해설'). A4 1단은 그대로(원고용 D10) |
| H 단 바꿈 | 현행 그대로(탭마다 `colbreak`) |
| 상자 | 글상자·ㄱㄴㄷ·가나·상자 선 0.3 → **0.13mm**(템플릿 BOX-STROKE) · 안쪽 위아래·좌우 **3.5mm** · 바깥 간격 유지. 코칭 왼쪽 바 0.3mm는 신호라 그대로 |
| 표 | 열 `1fr` 균등 → **내용 폭**(`columns: n`) · `block(width: 100%)` + `align(center)` · 11pt |

| # | 착수판 대비 이탈·보완 | 이유 |
|---|---|---|
| I21 | 경우 dot `xEm` −1.2 → **−0.9em** | 오른쪽 단의 dot이 가운데 세로 괘선(단 간격 11mm의 한가운데 ≈ 15.6pt)에 닿았다(`26K32_3확통29` PNG) |
| I22 | dot 세로 `centerFromTopEm` 0.78 | 줄 상자가 ascender부터라 cap-height 기준 옛 값보다 깊다(PNG 확인) |
| I23 | 표 가운데는 `#show table`이 아니라 블록 안 `align(center)` | 시험판(proto)의 `show` 규칙은 블록이 내용 폭으로 줄어 가운데가 안 됐다 |
| I24 | `TYPST_PAGE`·`TAB_LABEL` 삭제 → `SUNEUNG_PAGE`·`TAB_TITLE` | 옛 인쇄 규격 상수의 소비처 0 |

- 실측: 덤프 761문항 **문서 단위** 컴파일 760(실패 1 = 알려진 원문 결함 `$\mathrm{A}$$(e,~2e)$` — 앱은 `isolate.ts`가 그 수식만 원문 상자로) · 수식 단위 프로브 대표 13문항 실패 0 · CDP **16/16**(브라우저 PDF가 새 양식임을 PNG로 확인 · 글꼴 3종 내장) · 열 폭 112mm · 그림 상한 285.73pt
- 알고 두는 것: 열 폭이 옛 123.5mm → 112mm로 좁아져 같은 문항의 줄바꿈·쪽 수가 달라진다 · 글자가 커져(10 → 11.5pt) 쪽 수가 늘 수 있다 · 문항 번호는 원문에 있는 그대로(`22.` 등 — 시험지 조립 Phase 몫)
- **실물 피드백 2(2026-10-13, 덕수)**: 행간 체감·상자 두께·좌우 여백·표·선택지 배치·쪽 번호 상자 적절. 반영 둘 — ① 상자 안쪽 **위아래 3.5 → 7mm**(좌우 3.5 그대로 · `FRAMED_INSET_MM`). .tex는 framed `FrameSep`이 상하좌우 한 값이라 좌우 값(3.5mm)에 맞춘다 ② **경우 dot 제거**(I21의 −0.9em도 가운데 세로 괘선과 가까워 보였다 — rail처럼 없앤다. `CASE_DOT` 삭제, 경우는 제목행 `C1.` 번호 + 굵기만 = .tex와 같다)
