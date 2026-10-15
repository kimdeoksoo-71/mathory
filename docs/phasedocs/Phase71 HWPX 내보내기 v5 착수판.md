# Phase 71 HWPX 내보내기 — 구현 계획서 v5 착수판 (판정 전부 완료)

- 계보: v1·v2(web) → v3(CLI 교차검토 + 검증 턴) → v4·v4.1·v4.2(web 재검증 · 템플릿 2~6차 실측) → 덕수 판정 N1~N17 · R1~R10 · N7′ **전부 확정**(2026-10-15) → **이 문서(착수판)**
- 상태: **착수판 → 구현 완료(2026-10-15, §11) · 덕수 실물(Stage 0) 대기.** 설계 판정은 다시 열지 않는다. 남은 것은 Stage 0 실측(§6)뿐이며, 그 결과로 바뀌는 자리는 §6에 적힌 대로만 바뀐다. 구현 중 사실과 다른 것이 나오면 §11 구현 기록에 정정/보완으로 남긴다
- **이 문서가 유일한 사양이다.** v3는 사실 정정표(E1~E25)·검증 턴 기록(부록 B)·IR 가장자리 메모로만 참조하고, v4.x는 이력이다
- 기준: 코드 `origin/main` **`df45589`**(`lib/export/{ir,run,assets,layout,typst,latex}.ts` · `components/export/ExportDialog.tsx` · `components/problem/{FolderView,ListView}.tsx` · `lib/firestore.ts`). 템플릿 = **`Mathory_tmp.hwpx`(6차, 2026-10-15 14:48 KST 저장본의 hwpx 저장판, 한글 12.0.0.4426)** — §1-2에 실측값. md2hwp = `~/Documents/md2hwp/md_preprocessor.py`
- 범위: 문항 1개·여러 개 → `.hwpx`(브라우저 다운로드). **문제 탭 + 풀이 탭만.** 스타일은 템플릿의 15종을 이름 그대로 싣고 모양 조정은 한글 '스타일 덮어쓰기'
- 범위 밖: 시험지 조립(D5) · DOCX · 풀이2·AI풀이 등 추가 탭 · PDF/.typ 일괄 · md2hwp 개선(유지보수 종료) · 화면 `\boxed` 세로 정렬(KaTeX)

---

## 0. 요약

| 항목 | 현재(HEAD) | 71 뒤 |
|---|---|---|
| 형식 | PDF · MD · LaTeX · Overleaf · Typst | **+ HWPX** |
| 구조 | IR → typst/latex 직렬화기 | IR → **`hwpx/`** 직렬화기(셋째 벌) · IR에 **인용 표지 1건 추가**(R1, 70 산출물 바이트 불변) |
| 수식 | LaTeX → mitex | LaTeX → **한글 수식 스크립트**(md2hwp 이식) → `<hp:equation>` |
| 서식 | 템플릿 상수 | **템플릿 hwpx에서 추출한 뼈대**(스타일 15종·paraPr·tabPr·바탕쪽·쪽 설정 전부) |
| 진입 | ProblemView '내보내기…' | + **FolderView 선택 바 '내보내기…'**(일괄) |
| 옵션 | 탭 선택 | HWPX: 탭 체크박스 숨김 + **번호 매기기(제목 인식/순차) · 풀이 위치(좌단·우단 / 미주)** |

서버 0 · 규칙 0 · 스키마 0 · raw_text 규약 0 · 런타임 의존성 +0(fflate 재사용) · devDependency +1(`@xmldom/xmldom`). 정적 자산: **`docs/phasedocs/Mathory_tmp.hwpx`(스크럽 후 커밋, N7′)** + 추출본 `lib/export/hwpx/skeleton/`(≈60KB).

---

## 1. 선행 확인

### 1-1. 코드 (HEAD `df45589`)
- IR `lib/export/ir.ts:56-88` — ExportBlock kind 8종 · Flow 9종 · Inline 8종. `ExportTab.tone`(`:47-53`) = `isToneScoped` — 스타일 선택의 첫 축. `blockKinds.ts` = type 17종 → kind(단일 원천). 현재 IR은 `\ref{n}`을 텍스트 `(n)`·수식 `\text{(n)}`으로 **바꿔 버린다**(`ir.ts:227` 부근 `takeTag`·ref 처리) → R1에서 표지로 바꾼다
- `run.ts:12` `FileFormat`·`:55`(pdf·typ 외 → latex 경로) — HWPX는 **별도 진입점** `runHwpxExport`(FileFormat에 넣지 않는다)
- `ExportDialog.tsx:21` `ExportFormat` · `:38` `loadFormat` 화이트리스트 — **둘 다** `'hwpx'` 추가
- `FolderView.tsx:637-652` 선택 바(`selectable`=내 소유·비공유 뷰 뒤) · `:286-293` `folderProblems`는 카드 정렬 — 리스트 순서는 `ListView.tsx:203` `sorted` → `onOrderChange`로 올린다(N16)
- `firestore.ts:233` `getProblemWithBlocks`(모든 탭) → 일괄은 **`getProblemExportBlocks(id)`**(문항 doc + `question`·`solution` 하위 컬렉션만, G12 — 덤프 761문항 중 539가 추가 탭 보유)
- `assets.ts:15`(target typst|latex — HWPX는 **latex 집합**: svg·gif·webp→png, gray→png) · `:30` `safeFileName` · `:68` `zipFiles`(전 항목 level 6 — HWPX용 zip 따로) · `layout.ts:171-176` `imageWidthPt`(열 폭 인자로 확장)

### 1-2. 템플릿 `Mathory_tmp.hwpx` 실측 (6차 — 뼈대 원본)

**파일**: `mimetype`(stored) · `version.xml`(stored) · `Contents/{header.xml · masterpage0.xml · section0.xml · content.hpf}` · `Preview/{PrvText.txt(CRLF 2바이트) · PrvImage.png(stored)}` · `settings.xml` · `META-INF/{container.rdf · container.xml · manifest.xml}`. section 1개 · `secCnt="1"` · BinData 없음 · section0 = secPr+colPr 런을 품은 빈 바탕글 문단 1개. 개인 정보는 `content.hpf` 메타(creator·lastsaveby·날짜)뿐(N7′ 스크럽 대상).

**쪽 설정**: **A3 84188×119052(297×420mm)** · 여백 좌우 8787(31mm) · 위 15874(56mm) · 아래 8503(30mm) · 머리말 0 · 꼬리말 3826(13.5mm) · 2단 `sameGap 3316`(11.7mm) · **열 폭 31649**(lineseg `horzsize 31648`) · 미주 `END_OF_DOCUMENT` · 번호 `1)` · **미주 사이 간격 2834(10mm)** · 구분선 66614(전체 폭) · 70c PDF(`SUNEUNG_PAGE`)와 **같은 지면 규격**.

**바탕쪽**(`masterpage0.xml`, BOTH): 머리말 가로선(위 15023 = 53mm, 길이 66614, 0.2mm) · 단 구분 세로선(53mm에서 89291 = 315mm) · 꼬리말 쪽 번호 표 1×3(아래 9921 위, 너비 58408, 가운데 칸 5017에 `autoNum numType="PAGE"`, 양옆 공백 — **쪽 번호만, 전체 쪽수 없음**(R8)). 변환기는 손대지 않는다.

**글꼴**(상용 신명·한양, 받는 PC에 없으면 한글이 대체 — R13): HANGUL 0 `신명 견명조` · 1 `신명 중명조`. 변환기는 글꼴을 추가하지 않는다.

**스타일 16종**(⚠ 아래 id·paraPr·charPr·tabPr는 6차 값 — 코드는 **이름으로 찾는다**(G1). 2~6차 사이에 id가 전부 재배열됐다)
| 이름 | engName | 종류 | 문단 모양(HwpUnitChar) | 글자 모양 | 탭 |
|---|---|---|---|---|---|
| 바탕글 | `Normal` | PARA | 양쪽 · 160% | 11.5pt 중명조 자간 −10 | — |
| 문제-본문 | `MTQBody` | PARA | **내어쓰기 1170** · 뒤 1100 · 165% · 왼쪽 | charPr 3: 11.5pt 중명조 자간 −4 | 1700·1880·2551·2630 · autoR |
| 문제-이음 | `MTQCont` | PARA | 왼쪽 1150 · 뒤 1150 | 3 | 4000 · autoR |
| 문제-수식 | `MTQEq` | PARA | 왼쪽 4000 · 뒤 1150 | 3 | 4000 |
| 문제-번호 | `MTQNum` | **CHAR** | — | 13.5pt 견명조 · 오프셋 5% | — |
| 선지-5 | `MTQCh5` | PARA | 왼쪽 1100 · 내어쓰기 1130 · 양쪽 | 3 | **7256·13379·19502·25625**(4개) |
| 선지-3 | `MTQCh3` | PARA | 왼쪽 1130 · 내어쓰기 1133 · 양쪽 | 3 | **11338·21543** |
| 상자-글 | `MTBoxText` | PARA | 뒤 400 | charPr 2(= 3과 같은 값) | — |
| 상자-항목 | `MTBoxItem` | PARA | **내어쓰기 2340** · 뒤 400 | 2 | 6800 · **autoTabLeft=1** |
| 공통-그림 | `MTFig` | PARA | 가운데 · 뒤 1150 | 3 | 4000 |
| 해설-본문 | `MTSBody` | PARA | 왼쪽 0 · 뒤 1150 | 3 | 4000 |
| 해설-수식 | `MTSEq` | PARA | 왼쪽 4000 · 뒤 1150(= 문제-수식 paraPr) | 3 | 4000 |
| 해설-제목 | `MTSH1` | PARA | 왼쪽 0 · 뒤 1150 · next → 해설-본문 | 13.5pt 견명조 | 4000 |
| 해설-단계1 | `MTSStep1` | PARA | **왼쪽 1200 · 내어쓰기 2340** · 뒤 1150 | 3 | 4000 · **autoTabLeft=1** |
| 해설-단계2 | `MTSStep2` | PARA | **왼쪽 2400 · 내어쓰기 3800** · 뒤 1150 | 3 | 4000 · **autoTabLeft=1** |
| 해설-Tip | `MTSTip` | PARA | 왼쪽 0 · 뒤 1100 | 11.5pt 중명조 · 오프셋 5% | 1700 |
- charPr 7개 — **굵게·기울임 변형 없음**(변환기가 덧붙인다, §3-5). borderFill 9개 — 본문 표용 없음(변환기가 덧붙인다). 손 조정 paraPr(오른쪽 정렬·60%)은 바탕쪽용, 쓰지 않는다.
- 본문 세로선: 상자-항목 23.4pt · 해설-단계1 35.4pt · 해설-단계2 62pt(왼쪽 여백 + 내어쓰기). 한글의 내어쓰기 = 첫 줄은 왼쪽 여백, 둘째 줄부터 왼쪽 여백 + 내어쓰기(문제-본문 `left 0 · intent −1170`가 증거).

**본문 계약**(구 템플릿의 한글 산출물에서 읽은 모양 — v3 §1-4 "본문 계약" 그대로, 요지):
- 문단 `<hp:p id paraPrIDRef styleIDRef pageBreak columnBreak merged="0">` — paraPrIDRef = **스타일의 paraPr** · 런 `<hp:run charPrIDRef>` · 탭·줄바꿈은 **`<hp:t>`의 자식** `<hp:tab/>`·`<hp:lineBreak/>`(U+0009 날것 금지 — 한글 멈춤) · 객체(수식·rect·pic)로 끝나는 런엔 빈 `<hp:t/>`
- 번호: `<hp:run charPrIDRef="{문제-번호 charPr}"><hp:t charStyleIDRef="{문제-번호 style id}">N.<hp:tab/></hp:t></hp:run>` — **한 자리 탭 1 · 두 자리 탭 2**(템플릿 번호 22개 실측), 탭에서 런을 닫는다
- 선택지: 선지-5 문단 하나 `① `+내용+`<hp:tab/>`+`② `… / 3+2면 선지-3 두 문단(`①②③`·`④⑤`)
- 수식: `<hp:equation id zOrder numberingType="EQUATION" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" version="Equation Version 60" baseLine="85" textColor="#000000" baseUnit="1100" lineMode="CHAR" font="HYhwpEQ"><hp:sz …ABSOLUTE/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin …0/><hp:script>…</hp:script></hp:equation>` — `sz`는 자리값(한글이 열 때 다시 잰다: python-hwpx `oxml/paragraph.py:1173` docstring + 2026-09-26 실측) · shapeComment 없음 · script는 trim, `&<>` 이스케이프
- 글상자: `<hp:rect>` 자식 순서 `offset·orgSz·curSz·flip·rotationInfo·renderingInfo·lineShape·shadow·drawText·pt0~3·sz·pos·outMargin·shapeComment`(v3 E8) · `sz width="9900" widthRelTo="PARA"` · `height="3984" ABSOLUTE`(한글 고정값 — 자동 확장에 맡긴다, S-3) · `pos treatAsChar="1" flowWithText="0" allowOverlap="1"` · `lineShape width="33"` · `drawText` 안 `subList vertAlign="CENTER"` + `textMargin 1133/1133/1417/1417` · 담는 문단 런 끝 `<hp:t/>`
- 그림: `<hp:pic … reverse="0">` 자식 `offset·orgSz·curSz·flip·rotationInfo·renderingInfo·hc:img·imgRect·imgClip·inMargin·imgDim·effects·sz·pos·outMargin·shapeComment` · `orgSz`·`imgRect`·`imgClip`·`imgDim` = 원본 px×75 · `curSz`·`sz` = 표시 크기 · `hc:img binaryItemIDRef="image{n}" effect="REAL_PIC"`
- 표: `hp:tbl`(바깥 borderFill) · `hp:tc`(셀 borderFill) · 셀 자식 `subList·cellAddr·cellSpan·cellSz·cellMargin(510/510/141/141)` · 셀 문단 = 바탕글. borderFill 2개는 변환기가 덧붙인다(네 변 0.12mm 실선 / 바깥 NONE)
- 쪽/단 나눔: 문단 속성 `pageBreak="1"`·`columnBreak="1"`(템플릿 실사용 확인)
- zip(한글 순서): `mimetype`(stored) → `version.xml`(stored) → `Contents/header.xml` → `masterpage0.xml` → `BinData/*`(stored, 그것을 쓰는 section **앞**) → `section0.xml` → `Preview/PrvText.txt` → `settings.xml` → `META-INF/container.rdf` → `Contents/content.hpf` → `container.xml` → `manifest.xml` · mtime 전부 **1980-01-01**(fflate는 로컬 시각 getter — `new Date(1980,0,1)`로)

### 1-3. md2hwp 이식 범위
`LaTeXToHwpEquation`(`md_preprocessor.py:135-500`): GREEK 38 · MATH_FUNCS 25 · SYMBOLS 48 · ACCENTS 11 · `\frac`→`{a} over {b}` · `\sqrt[n]`→`root n of` · `\int/\sum/\lim` · 행렬 `left( matrix{…} right)` · `cases{… # …}`(`:423-441`, 열 구분 `&`) · prime(`:283`) · `\text{…}`→`"…"`(`:263-264`) · `\mathrm`→`rm{}`(`:266`) · `\mid`→`~ vert ~` · 화살표 백틱 보강 · 다중 문자 명령 우선. **버린다**: COM·GUI·이미지·`\tag`/`\ref` md 전처리(IR이 한다).

### 1-4. 참고 — python-hwpx 6.5.0(의존성 아님, 골든 대조 2차 기준): `oxml/paragraph.py:1173 add_equation` · `_document/shapes.py:125 add_endnote` · `:246 add_rectangle` · `ns/styles.py:558 column_break`. 2026-09-26 실측: 탭 날것 = 멈춤 / 수식·cases·행렬·eqalign·글자/문단 서식·표·글상자·글상자 안 수식 정상.

---

## 2. 확정 결정 (전부 덕수 판정 완료)

### 2-1. 방향
D1 TS·브라우저 `lib/export/hwpx/` · D2 수식 개체에 스타일 없음(baseUnit 1100 고정) · D3 상자 = **글상자**(조건·ㄱㄴㄷ 보기·(가)(나) 전부) · D4 문제-본문/이음 분리 · D5 수식 문단 2종 분리 · D6 배점 = 본문 텍스트 · D7·D17 해설-제목 하나(`[다른 풀이]`류는 해설-본문) · D13 유형-상자 없음 · D14 영문 키 영숫자만 · D18 **문제·풀이 2탭만** · D19 글상자 · **J1 일괄은 한 단에 한 문항(절대 원칙)**

### 2-2. 스타일·매핑
- **N1** 공통 스타일은 공통-그림뿐(표 셀 = 바탕글, 문제 탭 heading = 문제-이음 굵게) · **N4** 해설-Tip · **N5** 글상자 안 display도 문제-수식/해설-수식 · **N6′** 굵게·기울임은 **자리 스타일 charPr의 변형**을 쓰인 만큼 덧붙임(같은 내용이면 재사용) · **N11→H4** 경우 블록 = 해설-단계1/2(두 탭 공통), 코칭 = 해설-Tip(두 탭 공통) · **N13** `MTSH1`
- **R10** 경우 라벨·본문 인용: `C1→( i )`·`C2→( ii )`·`C3→( iii )` … / `C1a→( i - 1 )`·`C1b→( i - 2 )` …(ASCII 소문자 로마자, 괄호 안 공백) · **굵게 없음**, 제목행도 굵게 없음, 자리 스타일 글자 모양 그대로 · 본문 `caseRef`(`C1`·`C2a`)도 같은 표기, 굵게 없음. PDF·.typ·.tex는 `C1.` 그대로
- **N10** 마커·라벨 뒤 = **탭**(자동 탭 + 내어쓰기 템플릿 완비) · 라벨 없는 본문 문단 = 같은 스타일 + 선행 탭
- **N8·R1·R2** 행 끝 `\tag`·`\ref` = **`⋯⋯⋯ ㉠`** — IR에 인용 표지(Inline `ref` · 수식 안 내부 표지, 편집기 입력은 `\ref{n}` 그대로) · 본문 문단 끝 ` ⋯⋯⋯ ㉠`(U+22EF×3 + 공백 + ㉠) · display도 수식 밖 글자 ` ⋯⋯⋯ ㉠`(I19) · 본문 인용 → `㉠` · 수식 안 인용 → `㉠`(hwpEq) · 1~14 → ㉠~㉭ · 비숫자 → `(가)` 그대로 · typst/latex는 **지금과 같은 `(n)`으로 펼친다(출력 바이트 불변)**
- **N9** 긴 선택지 = 폭 추정 함수 + 템플릿 실례 보정(임계 ≈3000 HWPUNIT; 3+2 실례 3437~4995 vs 선지-5 ≤2741)
- **P4·D16** 빈칸 = 수식 `box{…}`(`\boxed{X}`·`\fbox{X}` → `box{X}`, `\text{(가)}` → `"(가)"`) · **R9** S-12 실패 시 **그대로 둔다**(대안 스타일 없음, 수작업)

### 2-3. 배치·번호·UI
- **T14** 옵션 A: 문항마다 `pageBreak`(첫 문항 제외) 문제 → `columnBreak` 풀이(풀이 비면 생략 — G11)
- **T15″** 옵션 B: 문항마다 **`columnBreak`**(첫 문항 제외) · 미주 기호 = 문제 탭 `[N점]` 문단 끝(없으면 선택지 제외 마지막 문단) · 미주 본문 = 풀이 탭 · 본문 끝 쪽 나눔 빈 문단으로 미주 새 쪽 좌단 시작(S-4) · 미주 첫 문단 "N번"(해설-제목, 번호 없으면 생략) · 해설 사이 = 템플릿 미주 10mm
- **N14·N15** 번호: 제목 인식 `/(?:^|\D)(\d{1,2})\s*번?\s*$/`(1~30, 덤프 694/761) / 순차. 실패 = **번호 런 없이 탭만** + 안내 1줄
- **N16** 일괄 순서 = 리스트 화면 순서(ListView `sorted`) · **T18′** 탭 = question+solution 고정, HWPX 선택 시 탭 체크박스 숨김 · **T19** 일괄 = HWPX만 · 일괄은 오너 전용(선택 바 게이트)
- **R8** 쪽 번호만(바탕쪽 그대로)

### 2-4. 뼈대·자산
- **T2″·G1** 뼈대 = `scripts/hwpxSkeleton.mjs docs/phasedocs/Mathory_tmp.hwpx` → `lib/export/hwpx/skeleton/*.ts` + `ids.ts`(이름→id). 이름 15종 검사(없으면 실패) · engName 비면 채움 · `secCnt=1` 확인 · PrvImage 버림 · content.hpf 메타 재작성(creator·lastsaveby `Mathory`, 날짜 비움) · settings CaretPosition 0
- **R6** hwpx 단일화 — hwtx는 어디에도 없다
- **N7′** 템플릿 hwpx **커밋**(`docs/phasedocs/Mathory_tmp.hwpx`) — 단 `hwpxSkeleton.mjs --scrub`으로 content.hpf의 creator·lastsaveby·날짜를 지운 판만. 스크럽 결과와 테스트가 `kimdeoksoo`·메일·이름 패턴 잔존 시 실패. **규칙: 템플릿을 한글에서 다시 저장하면 커밋 전에 반드시 scrub**(한글이 lastsaveby를 다시 쓴다)
- **T20″** 그림: latex 집합 수집 + `imageSize`(PNG IHDR·JPEG SOF) · 이름 전역 `image{n}` + URL 중복 제거(E21) · 폭 = `imageWidthPt`(열 폭 31649×90% 상한 — skeleton secPr에서 계산) · `frame` → pic lineShape(S-10′) · 실패 = 공통-그림 "[그림을 불러오지 못했습니다]"
- **T22″** hwpx 전용 zip(§1-2 순서 · stored 항목 · mtime 1980) · PrvText.txt 생성(평문 ~2KB) · 결정적 산출
- **T23′** `linesegarray` 없음 · rect·pic의 `renderingInfo`·`curSz`는 1단계는 "한글처럼"(G4), S-10′로 덜어 본다 · 객체 id·zOrder·instid 결정적 카운터(zOrder 1000부터) · 문단 id 전부 `0`
- **T24′** header 덧붙임 = 변형 charPr + 표 borderFill 2개 + **itemCnt 갱신**

---

## 3. 설계

### 3-1. 모듈
```
lib/export/hwpx/
  styles.ts      영문 키 ↔ 한글 이름 ↔ 종류 · 쓰임 (import 0)                          → test:exporthwpxstyles
  hwpEq.ts       LaTeX → 한글 수식 (md2hwp 이식 + box · "…" · lpile · 내부 ref 표지 → ㉠ · 크기 명령 삭제 · 예약어 경고) (import 0) → test:exporthwpeq
  choices.ts     긴 선택지 판정(폭 추정) (import 0)
  roman.ts       C{n}/C{n}{a} → "( i )" / "( i - 1 )" (import 0)
  imageSize.ts   PNG IHDR · JPEG SOF → {w,h} (import 0)
  xml.ts         이스케이프 · HWPUNIT · id 카운터 · 문단/런/탭/수식/글상자/그림/표/미주 빌더(§1-2 계약) (import 0)
  skeleton/      추출본 문자열 상수 + ids.ts (스크립트 생성물 — 손으로 고치지 말 것)
  zip.ts         hwpx 전용 zip
  hwpx.ts        (ExportDoc[], 옵션, 그림) → zip 바이트                                 → test:exporthwpx
  batch.ts       [브라우저] 문항 id[](화면 순서) → getProblemExportBlocks → ExportSource[]
lib/export/ir.ts            Inline { t:'ref', n } · 수식 안 내부 표지(R1)
lib/export/{typst,latex}.ts ref → "(n)" / "\text{(n)}" 펼치기(출력 불변)
lib/export/run.ts           runHwpxExport(sources[], opts) — 동적 import 뒤(G13)
lib/firestore.ts            getProblemExportBlocks(id)
components/export/ExportDialog.tsx   'hwpx'(ExportFormat · loadFormat) · 옵션 2줄 · 일괄 모드
components/problem/ListView.tsx      onOrderChange(ids)
components/problem/FolderView.tsx    선택 바 '내보내기…'
scripts/hwpxSkeleton.mjs    [--scrub] 템플릿 → skeleton/ · ids.ts (이름 15종 검사 · engName · 메타 · secCnt)
scripts/hwpxStage0.mjs      skeleton + 손짠 문단 → S-1·S-12 시험 파일 A·B·C(G10)
docs/phasedocs/Mathory_tmp.hwpx      스크럽된 템플릿(N7′)
tests/fixtures/export/hwpx/ 골든 조각(정규화 구조) · hwpEq fixture
```
- 모든 `hwpx/*.ts`는 import 0(skeleton·ir 제외) — `tsc` 단독 컴파일 테스트. skeleton(header 43KB)은 `run.ts` 동적 import 뒤에서만 로드.

### 3-2. 스타일 표 — §1-2의 15종(바탕글 제외) 그대로. 코드 키 = engName. 표 셀 = `Normal`.

### 3-3. 블록 → 스타일 매핑 (IR 기준 · 빠짐없이)

**A. kind**
| kind | 문제 탭 | 풀이 탭 |
|---|---|---|
| `para` | B표 | B표 |
| `heading` | 문제-이음 + 굵은 런 | 해설-제목 |
| `indent` | 문제-이음(P13) | 해설-단계2 + 선행 탭 |
| `admonition` | **해설-Tip** + 'Tip' 굵은 런 | 해설-Tip + 'Tip' 굵은 런 |
| `case` top / sub | **해설-단계1 / 해설-단계2**(두 탭 공통): `( i )`/`( i - 1 )` + 탭 + 제목 — **굵게 없음** · 본문 = 같은 스타일 + 선행 탭 · 이어짓기(label null, title 함께 판정 — v3 B-5) = 본문 규칙 | 〃 |
| `framed` gana·roman·plain | **글상자** — 안: 마커 문단 상자-항목 / 그 밖 상자-글 / display 문제-수식 | 글상자 — display 해설-수식 |
| `choices` | 1~3개 선지-3 한 문단 · 4~5개 선지-5 한 문단 · 긴 항목 선지-3 두 문단(3+2) · 6개+ 선지-5 + 경고 | 〃 |
| `figure` image·svg | 공통-그림(그림 개체) | 〃 |
| `figure` ggb · `placeholder` graph | 공통-그림 "[GeoGebra 그래프 — 화면에서 확인]" | 〃 |

**B. Flow**("자리 스타일" = 담은 kind가 정한 스타일)
| Flow | 문제 탭 | 풀이 탭 |
|---|---|---|
| `p` 탭 첫 Flow | 문제-본문(번호 런 + 탭 · 번호 없으면 탭만) — 첫 Flow가 `p`가 아니면 번호만 든 문제-본문 문단 먼저(G5) | 자리 스타일(기본 해설-본문) |
| `p` 그 밖 | 문제-이음 | 자리 스타일 |
| `p` + marker(gana·giyeok·circled) | 문제-이음: 마커 + **공백**(자동 탭 없음) · 글상자 안 상자-항목: 마커 + 탭 | 해설-단계1(자리가 단계2면 단계2): 마커 + 탭 · 글상자 안 상자-항목 |
| `.tag`(p·h·display) | 문단 끝 ` ⋯⋯⋯ ㉠` / display도 수식 뒤 글자 ` ⋯⋯⋯ ㉠`(I19) | 〃 |
| `h` 모든 level | 문제-이음 + 굵은 런 | 해설-제목 |
| `display` | 문제-수식(`rows` → `lpile{…#…}`) | 해설-수식 |
| `ul`/`ol` 1단계 | 문제-이음: `•`/`n.` + 공백 + 항목 | 해설-단계1: 글머리 + 탭 |
| `ul`/`ol` 2단계+ | 문제-이음(`◦`) | 해설-단계2 |
| `quote` | 글상자(안 상자-글; 글상자 안의 quote는 겹치지 않고 상자-글) | 〃 |
| `table` | 표 개체 · 셀 바탕글 · 머리 행 굵게 · `align` · 열 폭 균등 · 너비 열 폭 90% | 〃 |
| `hr` | 문제-이음 빈 문단 | 해설-본문 빈 문단 |
| `code` | 문제-이음(줄마다 lineBreak) | 해설-본문 |

**C. Inline**
| Inline | 처리 |
|---|---|
| `text` | `<hp:t>` |
| `math` | 수식 개체(`textStyle`도 같다) · `\boxed{\text{(가)}}` → `box{~"(가)"~}` |
| `strong` | 자리 charPr의 **굵게 변형** |
| `em` | 기울임 변형 |
| `code` | 자리 charPr 그대로 |
| `br` | `<hp:lineBreak/>` |
| `caseRef` | `( i )`·`( ii - 1 )` — **굵게 없음** |
| `ref`(신설) | `㉠`(1~14 → ㉠~㉭ · 비숫자 `(가)`) |
| `img` | 그림 개체(글자처럼) · 폭 `imageWidthPt`(widthPx 없으면 400px) |

**D. 문항·문서**: 번호(한 자리 탭 1 · 두 자리 탭 2) · 배점 텍스트 · 경계 A/B · 섹션 첫 문단 = secPr+colPr 런(G5) · 풀이 탭 라벨 없음.

### 3-4. `hwpEq.ts`
md2hwp `convert` 순서 이식 + `\boxed`·`\fbox` → `box{}` · `\text{…}` → `"…"` · rows → `lpile{…#…}` · `cases{}`(열 구분 `&`/`&&`는 S-7 fixture로 택일) · 내부 ref 표지 → `㉠` · `\displaystyle`·`\textstyle`·`\limits`·`\nolimits` 삭제(G9) · 한글 예약어 충돌(`pi it rm in or over box sum inf lim bar dot vec times prime …`) 경고(G8) · 미대응 명령은 그대로 + 경고 1회. 초기 fixture = md2hwp를 맥에서 `python3 -I md_preprocessor.py`로 돌린 기대값 + 구 템플릿 수식 20개(한글 정답형).

### 3-5. `hwpx.ts` 생성 순서
1. header: `ids.ts` 기준 charPr(3·2·번호·Tip …)마다 **쓰인** 변형(굵게·기울임·굵은 기울임) 덧붙임(같은 내용 재사용) · 표 있으면 borderFill 2개 · itemCnt 갱신 · `secCnt="1"`
2. section0: 첫 문단에 skeleton secPr 런 + colPr ctrl(G5) → 문항마다 §3-3 → 옵션 A/B
3. 객체 id·zOrder(1000~)·instid 결정적 카운터 · 문단 id `0`
4. 그림 → `BinData/image{n}` + content.hpf `opf:item … isEmbeded="1"`(jpg media-type S-10′)
5. PrvText.txt = 번호·텍스트·선택지 기호 평문(수식 자리 비움, CRLF, ~2KB)
6. zip(§1-2 순서) · 파일명 `assets.safeFileName` — 단일 `{제목}.hwpx` · 일괄 `{폴더명}.hwpx`

### 3-6. UI
- ExportDialog: `ExportFormat`·`loadFormat`에 `'hwpx'` · MAIN에 `HWPX (한글)` · 선택 시 탭 체크박스 숨김 + "문제·풀이 탭을 내보냅니다" · 옵션 두 줄(번호: 제목 인식 ◉ / 순차 · 풀이 위치: 문제 좌단·풀이 우단 ◉ / 미주) `localStorage['mathory-export-hwpx']`(try/catch)
- 일괄: props `batch?: { problemIds: string[]; folderName: string }`(화면 순서) · HWPX 외 비활성("일괄은 HWPX만") · 기억한 형식이 다르면 이 창에서만 HWPX · 진행 "n/N 불러오는 중…" · 중단 가능 · `tabLoadErrors`는 안내
- FolderView 선택 바: `내보내기… · 폴더 변경… · 휴지통 · 해제`(휴지통 폴더엔 없음) — 순서 = ListView `onOrderChange` id에서 선택분
- 폰 화면 무접촉

### 3-7. 보안·데이터 — 규칙·서버·스키마 0. 일괄 읽기 = 문항당 3회. 템플릿 커밋은 스크럽본만(N7′).

---

## 4. IR 변경(R1) — 70 산출물 불변 조건
- `ir.ts`: 텍스트 `\ref{n}` → `{ t:'ref', n }` · 수식 안 `\ref{n}` → 내부 표지(이름은 CLI 재량, 예 `\mathoryref{n}` — 사용자 입력·.tex·.typ에 절대 노출되지 않는다)
- `typst.ts`·`latex.ts`: `ref` → `(n)` · 수식 표지 → `\text{(n)}`(mitex 입력 전 치환) — **`test:exporttypst`·`test:exportlatex` 스냅샷 무변화**가 수용 조건
- 단독 커밋 `refactor(phase71): IR 인용 표지(출력 불변)` — 8단계 중 **0단계**

---

## 5. 위험 (요지 — v3 R1~R16 + v4 R17~R19 중 산 것)
| # | 위험 | 대응 |
|---|---|---|
| R1 | 한글 "응답 없음"(요소 하나 때문에) | 뼈대 기반 · 요소별 분리 시험(S-10′) · `<hp:t>` 안 U+0009 금지 테스트 |
| R2 | 덮어쓰기 매칭 키가 기대와 다름 | S-1 선행 · 한글 이름·영문 이름 둘 다 있다 |
| R3 | 수식 미대응 | S-7 · 문서는 열린다 · fixture 누적 |
| R13 | 상용 글꼴 없는 PC | 한글 대체 — 수용 |
| R14 | 긴 선택지 오판 | 보수적(애매하면 선지-3) · 수동 |
| R15 | 예약어 충돌 | 경고 · S-7 빈도 · 필요 시 `` ` `` 삽입 |
| R16 | 골든 비교가 템플릿 개정마다 깨짐 | 정규화 비교 · 스크립트 재실행 시 골든 재생성 |
| R18 | ㉠(HWPX) vs `(n)`(PDF) 표기 차이 | 덕수 의도(N8) — 번호 자체는 IR 한 곳에서 나와 어긋나지 않는다 |
| R19 | IR 변경이 70 산출물을 바꿀 가능성 | §4 스냅샷 무변화 조건 |
| R20 | 문항이 한 단을 넘김(J1 전제 위반) | 다음 단으로 흐른다(깨지지 않음) + 안내 1줄 |
| R21 | 템플릿 재저장 시 lastsaveby 복귀 | scrub 규칙 + 테스트 검사(N7′) |

---

## 6. Stage 0 — 실측 (한글 2022 · 덕수)
| # | 항목 | 언제 | 결과가 바꾸는 것 |
|---|---|---|---|
| **S-1** | 덮어쓰기 매칭 키(한글 이름 vs 영문) — A·B·C 시험 파일(CLI 1단계) · 절차: A(문제-본문 빨강) 열기 → F6 → 스타일 가져오기 → B(같은 한글 이름·다른 영문·파랑) 덮어쓰기 → 파래지면 한글 이름이 키 → C(다른 한글 이름·같은 영문·초록)로 영문 키 여부 | **1단계 뒤 즉시** | 문서 기록만(둘 다 등록돼 있어 설계 불변) |
| **S-12** | 덮어쓰기 뒤 굵게 변형 런이 ① 굵기 유지 ② 새 글꼴·크기 추종 | 1단계 뒤 즉시 | 실패해도 **그대로**(R9) — 기록만 |
| ~~S-2′·S-11~~ | 완료(덕수: 글자 스타일 덮어쓰기 반영됨 · engName 든 파일 수용) | | |
| S-3 | 글상자 높이 자동 확장(`sz 3984` 고정으로 열기) | 1단계 뒤 | 실패 시 추정식(줄 수×1898 + 2834 + 문단 뒤 합) |
| S-5′ | 마커·`( i )` 뒤 탭이 내어쓰기 위치에 서는가 · 라벨 없는 본문의 선행 탭 | 1단계 뒤 | 실패 시 첫 명시 탭 = 내어쓰기 폭으로 템플릿 보정 |
| S-6 | 선지-5 한 줄 · 선지-3 두 문단 | 1단계 뒤 | |
| S-10′ | 최소 요소 집합 이분: PrvImage 없음 · linesegarray 없음 · 수식 sz 자리값 · rect/pic renderingInfo·curSz 없음 · shapeComment 없음 · 문단 id 0 · `<hp:tab/>` 속성 없음 · imgClip/imgDim px×75 · jpg media-type · pic lineShape(frame) | 1단계 뒤 | 실패 요소는 "한글처럼"으로 되돌린다 |
| S-7 | 수식 대응률 ≥95%(70 P0-1 표본) · `lpile` · `cases` `&`/`&&` · `box{}` 두 형 · 수식 안 ㉠ 렌더 · 예약어 빈도 · 인라인 분수 크기 | 2단계 뒤 | fixture 보강 · 임계 조정 |
| S-4 | 옵션 B: 단 나눔 배치 · 본문 끝 쪽 나눔으로 미주 새 쪽 좌단 · 미주 안 수식·그림·글상자 · 미주 사이 10mm | 5단계 | 실패 시 endNoteShape 옵션 탐색 → 그래도 안 되면 §11에 기록하고 옵션 B를 "문서 끝 연속"으로 |

---

## 7. 검증
- 자동: `test:exporthwpxstyles`(이름 15종 · 키 유일 · §3-3 참조 키 전부 존재 · ids.ts 일치) · `test:exporthwpeq`(md2hwp 기대값 + 템플릿 수식 20 + ㉠ + box) · `test:exporthwpx`(kind 8 × tone 2 × 옵션 A/B × 번호 2 스냅샷 · **골든 구조 비교(G2)** · `@xmldom/xmldom` well-formed · `<hp:t>` 안 U+0009 금지 · itemCnt·secCnt · zip 첫 항목 stored mimetype · mtime 1980 · 결정성 · 일괄 그림 이름 충돌 없음 · 선택지 판정 = 템플릿 실례 · 로마자 라벨 · 커밋된 템플릿에 개인 정보 패턴 없음) · `test:exportir` ref 케이스 · **`test:exporttypst`·`test:exportlatex` 스냅샷 무변화** · 70 나머지 테스트 무변화
- 실물(덕수, 한글 2022): ① 단일 문항(경우·선지·글상자·그림·표) 열림 ② 스타일 창 15종 ③ 덮어쓰기 템플릿 1개로 전체 모양 일괄 변경 ④ 옵션 A 10문항: 쪽마다 좌단 문제·우단 풀이 ⑤ 옵션 B: 단마다 문항 · 미주 새 쪽 좌단 · 미주 안 수식·그림 · 미주 사이 10mm ⑥ 번호 제목 인식/순차/실패(탭만) ⑦ 멤버 숨김 탭 미포함(단일) ⑧ 긴 선택지 3+2 ⑨ `⋯⋯⋯ ㉠`·수식 안 ㉠ ⑩ `( i )`·`( i - 1 )` 정렬(탭) ⑪ 빈칸 `box{}` ⑫ 굵은 글씨가 덮어쓰기 뒤 어떻게 되는지(S-12 기록)

## 8. 작업 순서 · 커밋
**0** IR ref 표지 + typst/latex 펼치기 + 스냅샷 무변화(단독 커밋) → **1** `hwpxSkeleton.mjs`(+`--scrub`) + 스크럽 템플릿 커밋 + `skeleton/`·`ids.ts` + `styles.ts` + `xml.ts` + `zip.ts` + `roman.ts` + `test:exporthwpxstyles` + `hwpxStage0.mjs` → **S-1·S-12 시험 파일 전달** → S-3·S-5′·S-6·S-10′ → **2** `hwpEq.ts` + fixture → **3** `imageSize`·`choices` + `hwpx.ts` 단일·옵션 A + 골든 비교 + `runHwpxExport` + `test:exporthwpx` → **4** ExportDialog → **5** 옵션 B + S-4 → **6** `getProblemExportBlocks` + `batch.ts` + ListView `onOrderChange` + 선택 바 → **7** S-7 기록(`docs/phaseSketch/phase71-stage0.md`) → **8** 문서(CLAUDE.md 내보내기 절: 직렬화기 셋째 벌 · skeleton 재생성·scrub 절차 · 스타일 표 위치 · 옵션 A/B · "한 단 한 문항") · roadmap · phasedocs 확정본. 커밋 접두 `feat(phase71)` · 0단계 `refactor(phase71)`. push는 덕수.

## 9. 수용 체크리스트
- [ ] HWPX 단일·일괄 다운로드, 한글 2022에서 오류 없이 열림 · 골든 구조 비교 통과
- [ ] 스타일 15종 이름·순서 일치 · 덮어쓰기로 전체 모양 변경(③)
- [ ] 수식 대응률 ≥95%(S-7) · 미대응이 문서를 깨뜨리지 않음
- [ ] 옵션 A·B(한 단 한 문항)·번호 2종+실패 동작 · 긴 선택지 3+2 · `⋯⋯⋯ ㉠` · `( i )` 라벨·인용 · `box{}`
- [ ] 문제·풀이 탭만 · 멤버 숨김 탭 미포함(단일)
- [ ] 70 테스트 전부 통과(typst/latex 스냅샷 무변화) · 새 테스트 4종 통과 · 커밋된 템플릿에 개인 정보 없음
- [ ] skeleton 재생성·scrub 절차 README/CLAUDE.md

## 10. 다음 Phase에 넘기는 것
시험지 조립(D5: 유형-상자·머리글·쪽 번호 양식·PDF/.typ 일괄) · 추가 탭(풀이2·AI풀이) HWPX · `<보기>` 상자 머리표 · HWP 수식 크기 스타일 추종 · md→hwpx CLI(md2hwp 대체) · 화면 `\boxed` 세로 정렬 · 해설-Tip 등 해설 스타일의 세부 모양(덮어쓰기로 운영)

## 11. 구현 기록 (2026-10-15, CLI)

### 11-1. 커밋
| 단계 | 커밋 | 내용 |
|---|---|---|
| 0 | `da961f5` refactor | IR 인용 표지(텍스트 `⟦REF:n⟧` → Inline `ref` · 수식 `\mathoryref{n}`) · typst·latex `expandMathRefs` — **스냅샷 무변화**(표본에 텍스트·수식 `\ref` 둘 다 있다) |
| 1 | `9c7f5e8` | `hwpxSkeleton.mjs`(--scrub · --check) · 스크럽 템플릿 · `skeleton/{parts,ids}.ts` · `styles.ts` · `roman.ts` · `xml.ts` · `zip.ts` · `package.ts` · `hwpxStage0.mjs` · `test:exporthwpxstyles` 6 · devDependency `@xmldom/xmldom` 0.9.12 |
| 2 | `6a4f30e` | `hwpEq.ts` · `test:exporthwpeq` 11 |
| 3 | `bba2766` | `hwpx.ts` · `choices.ts` · `imageSize.ts` · `runHwpxExport` · `layout.imageWidthPtForColumn` · `test:exporthwpx` 19 |
| 4·6 | `cfa656a` | ExportDialog HWPX·옵션·일괄 · `getProblemExportBlocks` · `batch.ts` · ListView `onOrderChange` · 선택 바 '내보내기…' · CDP 하니스 12/12 |
| 5 | (3에 포함) | 옵션 B(미주)는 직렬화기에 함께 들어갔다 — S-4는 덕수 실물 |

### 11-2. 착수판 대비 이탈·보완
- **I1 N7′ 대 V3 피드백** — 덕수의 V3 피드백(`docs/phaseSketch/P71 V3 피드백.md`)은 "템플릿 원본 커밋 안 함", 착수판 N7′은 "스크럽본 커밋". **착수판을 따랐다**(스크럽 판은 내용이 빈 서식 — 개인 정보는 content.hpf 메타뿐이었고 지웠다). 뒤집을 때는 `docs/phasedocs/Mathory_tmp.hwpx`를 지우고 `.gitignore`에 넣은 뒤 `test:exporthwpxstyles` H3·H4의 경로를 로컬로
- **I2 골든 비교(G2)의 기준** — 6차 템플릿은 **본문이 비어 있다**(secPr 문단 하나). 옛 템플릿(문항이 든 1차)의 실물 조각은 다시 볼 수 없어(덮어써졌다), 골든은 **기록된 계약**(v3 E8·§1-2 — 글상자·그림 자식 순서 · 번호 런 모양 · 수식 속성)과 **python-hwpx 6.5.0의 real-Hancom 계약**(PyPI wheel을 세션 스크래치에 받아 읽었다 — 의존성 아님: 수식 · 미주 · 표)으로 고정했다
- **I3 수식 `shapeComment`** — 착수판 "없음" → **`수식입니다.`**(한글 기본값 · python-hwpx 그대로 — 사람 이름이 아니다). "한글처럼"(G4)을 우선. `S-최소`가 열리면 뺀다
- **I4 수식 `sz` 자리값** — python-hwpx 식(`0.45·baseUnit·max(6, 보이는 글자 수)` × `2.5·baseUnit`)
- **I5 미주 모양** — python-hwpx 계약: `<hp:endNote number suffixChar="41" instid>` + **미주 첫 문단 첫 런 앞 `<hp:autoNum numType="ENDNOTE">`**(그 주석: 없으면 한글이 미주를 그리지 않는다). 그래서 미주는 `1) 21번 …`처럼 자동 번호 뒤에 "N번"이 온다 — S-4에서 모양 판정
- **I6 hwpEq의 의도한 차이**(md2hwp 대비) — ① 명령 이름 단위 치환: **md2hwp가 `\left\langle a \right\rangle \le c`를 `leq ft langle …`로 망가뜨리는 것을 맥에서 실행해 확인** ② `\text` 보호 → `"…"` ③ `aligned` → `eqalign`(md2hwp는 줄을 지웠다) · `gathered` → `pile` · 한 열 `array` → `lpile/pile/rpile` ④ 행렬 칸 `&` · 행 `#`(md2hwp `#`/`##`) ⑤ `\,` → 백틱(가는 공백 — md2hwp `~`) ⑥ `\#` `\&` `\_` → 따옴표(한글 수식에서 `#`·`&`는 구분자). cases 열 구분자는 md2hwp의 `&`(한글 자체 출력은 `&&` — S-7)
- **I7 긴 선택지 임계** — 수식이 든 선택지 3000(템플릿 실례 7개가 전부 넘고 짧은 실례는 밑) · **글자뿐이면 5000**(`ㄱ, ㄴ, ㄷ` 합답형 추정 4620 — 실제 시험지는 5열)
- **I8 표 열 정렬(`align`)은 반영하지 않았다** — 셀 문단 정렬은 paraPr 변형이 있어야 한다(덧붙이는 목록이 하나 더 는다). 셀은 바탕글 그대로 · 머리 행 굵게 · 열 폭 균등. 알고 두는 손실
- **I9 문단 id** — 전부 `0`(한글도 `0`·`2147483648`을 섞는다 — 검증 턴 B-1 7)
- **I10 jpg media-type** — `image/jpg`(템플릿에 jpg 실례가 없다 — S-10′)
- **I11 그림 대체 문구** — 실패한 그림은 공통-그림 문단에 "[그림을 불러오지 못했습니다]" + 안내 1줄(안내는 그림 수)
- **I12 `imageWidthPtForColumn`** — `imageWidthPt`가 열 폭을 받는 판을 부른다(typst·latex 바이트 불변 — 스냅샷)
- **I14 수식 크기(실물 1·2차, 2026-10-15)** — 한글 2022는 hwpx를 열 때 수식 sz를 **다시 재지 않는다**(착수판 §1-2·T13″의 "자리값이면 한글이 잰다"는 틀렸다 — python-hwpx 문서 주장). 탐침 P-B~F(sz 0×0 · sz 없음 · Version 50 · version 없음)도 안 된다. ① KaTeX 측정(`1db3211`)은 한글과 구조가 달라 폭 0.81~1.23배 → ② 덕수가 수식 40개를 한글에서 다시 재게 해 저장 → 한글 정답으로 **한글 규칙 조판 모델 `hwpLayout.ts`**를 맞춤(`f0e54c4` — 폭 RMS 2.0% · holdout 5.6% · 위아래 0.02~0.04em) ③ 정확한 마무리 = **한글 스크립트 매크로** `docs/hwp-macro/수식크기바로잡기.js`(덕수 제안 — 실물 242/242, 본문·글상자·표·미주 전부)
- **I17 경우 라벨 `(ⅰ)`·`(ⅰ-1)`(덕수 실물 2026-10-15 — R10 개정)** — 유니코드 소문자 로마 숫자(U+2170~, 13 이상은 글자마다) · 괄호 안 공백 없음. R10의 `( i )`·`( i - 1 )`(ASCII 글자 + 공백)는 넓어서 해설-단계 탭 자리를 넘겨 짧은 제목이 다음 탭(오른쪽 끝)으로 밀렸다(T-B 실물)
- **I18 여러 줄 수식 → 행마다 문단(덕수 2026-10-15)** — display가 `aligned` 계열 환경 하나(+ 앞뒤 평평한 조각 `\text{ - }` 등)거나 맨 `\\` 행이면 행마다 문제-수식/해설-수식 문단 하나(`hwpEq.splitDisplayRows`). **정렬은 하지 않는다** — `&`는 지우고(칸 쌍 사이만 `\quad`) 모든 행이 스타일 왼쪽 여백에서 시작한다. 처음엔 행 앞에 한글 수식 공백(`~`·`` ` ``)을 채워 `&` 자리를 hwpLayout 폭으로 근사했으나 덕수 실물 판정으로 폐기(정확한 정렬이 어려우니 정책을 '정렬 없음'으로). 앞 조각은 첫 행 앞, 뒤 조각·번호는 마지막 행 · `\left\{`·바깥 환경·감싼 중괄호가 붙으면 한 수식 그대로(eqalign). 덤프 display 5,095개 중 1,325개가 행으로 나뉜다(남은 eqalign 33)
- **I19 display 번호 점은 수식 밖 글자(덕수 2026-10-15)** — 옛 판은 수식 끝 `cdots cdots cdots` + 수식 밖 ` ㉠`였다 → 수식 뒤 텍스트 ` ⋯⋯⋯ ㉠`(U+22EF×3 = 점 9개, 본문 문단 끝과 같은 글자). 여러 줄로 나눈 수식은 마지막 행 뒤
- **I16 S-1·S-12 결과(2026-10-15, 덕수)** — 한글의 스타일 덮어쓰기는 **한글 이름**으로 짝을 맞춘다(같은 영문 이름·다른 한글 이름은 새 스타일로 추가) → 템플릿을 고칠 때 한글 이름만 지키면 된다 · 영문 이름(engName)은 코드 키로만 남는다. 변형 charPr의 굵은 글씨는 덮어쓰기 뒤에도 굵기를 유지하고 새 스타일을 따라간다(N6′ 그대로 — R9 대안 불필요)
- **I15 `\text{~…~}`** — 한글 따옴표 안의 `~`는 글자로 찍힌다 → 공백(실데이터 QULUP.26FS02 26번)
- **I13 `\tag` 오른쪽 탭(G7·S-13)은 소멸** — N8이 `⋯⋯⋯ ㉠`(문단 끝 글자)로 확정되어 오른쪽 정렬 탭이 필요 없다

### 11-3. 검증 수치
- 로직 테스트: `test:exporthwpxstyles` 6 · `test:exporthwpeq` 11 · `test:exporthwpx` 19 · 70 테스트 무변화(`exportir` 24 · `exportlatex` 10 · `exporttypst` 12 · `exportassets` 5 · `exportkinds` 10)
- headless Chrome CDP 12/12(`docs/phaseSketch/phase71-cdp-harness.mjs` — 임시 라우트 `app/dev71`은 검증 뒤 삭제)
- S-7 자동분: 덤프 761문항 수식 **31,006개 · 미대응 명령 없는 수식 99.96%**(미대응 11: `\nrightarrow` 3 · `\square` 3 · `\underbrace` 2 · `\bigcirc` · `\oplus` · `\hline`) · 예약어 충돌 0
- Stage 0 기록: `docs/phaseSketch/phase71-stage0.md`(S-1 절차 포함)

### 11-4. 알고 두는 것 · 남은 일
- 일괄 내보내기는 Firestore 로그인이 필요해 하니스로 돌리지 않았다 — 실물 ④
- 덕수 실물: Stage 0 S-1·S-12·S-3·S-5′·S-6·S-10′·S-4·S-7(한글 화면) · §7 실물 ①~⑫
- 다음 판에서 뺄 수 있는 것: S-10′ 결과에 따라 renderingInfo·curSz·shapeComment

---

## 부록 A. 판정 대장 (전부 확정)
N1 공통 삭제 · N2 A3(템플릿) · N3 템플릿 정정 완료 · N4 해설-Tip · N5 수식 문단 · N6′ 변형 charPr · N7′ **커밋(스크럽)** · N8 `⋯⋯⋯ ㉠` · N9 폭 추정 · N10 탭 · N11→H4 경우 = 해설-단계 · N12 템플릿 입력 · N13 `MTSH1` · N14 '번' 허용 · N15 탭만 · N16 리스트 순서 · N17 → J1로 소멸 · R1 IR 표지 · R2 표기 세부 · R3·R4·R5 종결 · R6 hwpx 단일화 · R7 중명조 통일 · R8 쪽 번호만 · R9 실패 시 그대로 · R10 로마자·굵게 없음 · J1 한 단 한 문항

## 부록 B. 템플릿 정정 이력 — Z1~Z9 전부 완료(Z5 삭제). 6차 = 정본.

## 부록 C. 2026-09-26 HWPX 실측 기록(web 메모리 전사) — v4 부록 C 그대로.
