# Phase 72 — 시트 가져오기 원본 확장('Latex 변환') + 문항장부 ID 연결 구현 계획서 v4.1 (web 재검증 · CLI 착수판 — 2층 자동 해제 추가) — **확정본**

작성일: 2026-11-05 · 작성: **web v4**(CLI v3를 레포 4개 + **라이브 구글시트 3벌**로 재대조 — 백필 시뮬레이션을 독립 재현) · 기준 커밋: mathory **`26658b5`**(origin/main = v3 계획서 커밋 · 범위 안 파일 전부 불변 — 행 번호는 `4b1228a`와 같다) · `gas-project-latex-convert` `3cc4694` · `gas-project-problem-ledger` `90c88cf` · `gas-project-audition` `98b7f54`
계보: 덕수 질문 1~3 → 연구 메모 → 덕수 결정 §2 → CLI v1 → web v2(E1~E9 · B1~B9 · Q1~Q8) → CLI v3(F1~F10 · C1~C8 · R1~R6) → **web v4**(검증 결과 §부록 C-1 · 정정 G1~G4 · 보완 H1~H6 · 결정 R1~R6 + S1~S5) → **덕수 확정 "권장안대로"(2026-11-05 23:06)** → **v4.1**(덕수 요청 2026-11-05 23:15: 검색 조건을 바꾸면 U열 체크를 **자동 해제** — 문항장부 GAS 신규 파일 1개, 부록 D) → **CLI 구현(2026-11-05 — §10 구현 기록)**

> **확정본 안내**: 본문 §0~§9와 부록 C·D는 덕수가 확정한 v4.1 착수판 **원문 그대로**다. CLI가 구현하며 착수판과 달리 한 것·구현이 잡은 것·검증 현황·덕수 작업 목록은 **§10**에 있다. 작업물(연구 메모 · v1 · v2 요지 · v3)은 `docs/phaseSketch/_archive/Phase72/`(로컬).

> **이 Phase의 성격**(v1~v3 그대로): 서버는 여전히 **읽기만** 한다(`spreadsheets.readonly` 불변). Firestore 스키마는 **선택 필드 2개 추가**(마이그레이션 0 · 규칙 0 — `firestore.rules:99-100` create에 키 화이트리스트 없음). 세 레포에 걸치지만 **교차 파일 쓰기는 없다**. v4.1부터 문항장부 GAS에 **자기 시트만 만지는 `onEdit` 1개**가 더해진다(부록 D).
> 연결 작업이 끝난 뒤 **색인 누락 1건(`25X모의12_1공통20` = D5008, Data_DS **5686행**) 보충을 잊지 말 것**(§9-1).

---

## 부록 C. v3 → v4 변경 요지 (먼저 읽을 것)

### C-1. v3 검증 결과 — 라이브 시트로 독립 재현 (전항 일치)

| v3 주장 | web 재현(2026-11-05 22:50, Sheets API 라이브) | 판정 |
|---|---|---|
| F4 백필 시뮬레이션 | `jb_canonKey_` 규칙을 Python으로 옮겨 Data_DS A열 6,303행 × `_CroP색인` 1,815행에 돌림 → **채움 1,444 · 형식 아님 4,488 · 색인에 없음 371**(24X모의01·03·05·07·09·11·13·15 각 46 · 24X모의06 1 · 25X모의12 1 · 26X모의12 1) · **모호 0 · 색인 ID 형식 불량 0 · 색인 ✅ 미사용 0 · ✅ 고유 ID 1,444 · 같은 표준키 두 행 0** · CroP 행 **4490~6304** | **완전 일치** |
| F3 E 빈 행 0 · K FAIL 0 | K열 6,303행 전부 값 있음(`mcq_math` 4,356 · `short_int` 1,850 · `mcq_combo` 97) · FAIL 0 · **L·M·N 0건** | 일치 |
| C5 색인 헤더 | `파일키·문항ID·시트·행·사용세트식별·문서URL·문제파일ID·해설파일ID(순서대로)·해설조각수·상태`(A~J에 값, K~O 검증 열은 비어 있음) | 일치 — `JB.IDX_STATUS 10` |
| D11 W1·X1 자리 | 문제검색 1행 = 머리글·필터 혼합 행(`ID·(출)번호·X.·(사)과목…선택`), A2 FILTER, T2 `#N/A`, U 체크박스, **V열 이후 비어 있음** | W1·X1 자유 |
| V4 표본 | 색인 `25X서킷03_1공통14` → **D5006** ↔ Data_DS **5786행** `25서킷X03_1공통14` · 색인 `26X모의10_1공통15` → **D4827** ↔ Data_DS **6043행** `26모의X10_1공통15` · D5008 후보 = Data_DS **5686행** `25모의X12_1공통20`(색인 ❌) | 표본 확정(S5) |
| C2 규칙 | `firestore.rules:99-100` `allow create: isSignedIn() && authorUid == uid` — 키 제한 없음 | 일치 |
| F1·F2·F7·F8 인용 | `crop-image-insert.gs:255` · 모달 `:59`·`:371`·`:716`·`:720` · `nfc_` 2회(`:7`·`:49`) · `getScriptLock` 5곳 | 일치 |

### C-2. 정정 (G)

| # | v3 자리 | 문제 | v4 |
|---|---|---|---|
| G1 | V4 | 표본 키를 Data_DS 표기(`25서킷X03_…`)로만 적었다 — 색인 쪽은 `25X서킷03_…`라 손 대조 때 헷갈린다 | 표본 3건을 **양쪽 표기·행 번호**로 적는다(S5). D5008은 **음성 표본**(§9-1 전엔 L 빈칸이어야 정상) |
| G2 | F3·R1 근거 | "실패 시에도 E에 `r.stem` 보존"은 맞지만, E가 비는 창은 **send 완료 ~ normalize 완료 사이**(같은 런 안이지만 `yield` 구간이 있다 — `Pipeline.gs:436-444`)다. 파이프라인이 도는 **중에** Mathory가 새 행을 가져오면 경고가 보일 수 있다 | R1 철회는 유지. §7에 "파이프라인 중엔 새 행을 가져오지 말 것" 한 줄 |
| G3 | §5-1 ⑥ | `SpreadsheetApp.getUi().alert`는 **스크립트 편집기에서 실행하면 예외**(UI 없음) | `try { ui.alert } catch { }` + `Logger.log`는 항상(S2) |
| G4 | D4 · HL1 | 백필 전 L 경고가 현행 문구("L열 헤더가 `jangbu_id`가 아니라 `''`입니다 — 시트 구조가 바뀌었을 수 있습니다")로 나오면 **오진**이다 — 구조가 바뀐 게 아니라 백필을 안 돌린 것 | latex 프로파일의 L 누락은 전용 문구(S1 · §5-4) |

### C-3. 보완 (H)

| # | 내용 | 자리 |
|---|---|---|
| H1 | 모달에서 원본을 latex ↔ audition으로 오갈 때 **`includePreselected` 상태를 건드리지 않는다** — 요청·`canSubmit`은 파생값 `effectivePreselected = file === 'audition' && includePreselected`로. 상태를 false로 덮으면 audition으로 돌아왔을 때 기본 true가 사라진다 | §5-6(S3) |
| H2 | X1 수식에 **개수 불일치 경고**: 체크 수(`COUNTIF`)와 W1의 ID 수가 다르면 "검색 결과 밖(빈 A)에 체크가 남아 있다"는 뜻 — B3의 위치 의존 사고를 수식 하나로 잡는다 | D11(S4) |
| H3 | 백필 알림 기대값을 **정확 수치**로 §6 V3에 고정(C-1) — CLI가 실행 결과를 숫자로 비교한다 | §6 |
| H4 | C 단계(안 (1))는 A 단계 없이도 검증 가능 — V6의 `jangbu_id` 배지·저장만 A 뒤로 미룬다(V6를 V6a·V6b로 분리) | §6 · §8 |
| H5 | `_CroP색인` 읽기는 `getRange(2, 1, n, 10)`이면 충분(K~O 검증 열은 안 쓴다) — `getLastColumn()` 의존 없음 | §5-1 |
| H6 | V1′·C3(Vercel 값 2건)은 **덕수 확인 항목**으로 §5-7에 묶는다 — CLI는 Vercel을 못 본다 | §5-7 |

### C-4. 결정 — R1~R6(CLI v3) + S1~S5(web v4) · **전항 권장안 확정(덕수 2026-11-05)**

| # | 결정 | 확정 | 근거 |
|---|---|---|---|
| R1 | Q2(E 빈 행 배지 + 체크 해제) | **철회** | 라이브 재현 0건(C-1). 기존 `rowToDraft` 경고로 충분 |
| R2 | D9 조건부 분기 | **철회** · V1′만 | `IMAGE_FIG` 폴더 1개(v3 F5) |
| R3 | Q4 표본 대조 | **완료 처리** · 0.7% 수용 | v3 F6 전수 대조 |
| R4 | "색인에 없음 371" 표시 | **세트별 집계** + 앞 10개 키 | 한눈에 "24년 홀수 8세트" |
| R5 | 백필 범위 | **전 행** 1회 | 비용 0 · 옛 행이 CroP 이름으로 바뀌어도 잡힌다 |
| R6 | `ImportSource.file` | **`'latex'`만** | Q5 귀결 |
| S1 | latex 프로파일 L 누락 경고 문구 | **전용 문구** "L열 머리글 `jangbu_id`가 없습니다 — Latex 변환 메뉴 '🔗 문항장부 ID 채우기'를 아직 안 돌렸을 수 있습니다" | G4 |
| S2 | 백필 알림 | **`ui.alert` try/catch + Logger 항상** | G3 |
| S3 | 원본 전환 시 M체크 상태 | **상태 불변 · 파생값** | H1 |
| S4 | X1 개수 불일치 경고 | **채택**(LET 수식 1개) | H2 |
| S5 | V4 표본 | **D5006(5786행) · D4827(6043행) 양성 + D5008(5686행) 음성** | C-1 |


### 부록 D. v4 → v4.1 — 검색 조건 변경 시 U열 체크 자동 해제 (덕수 결정 2026-11-05 23:15)

- **배경**: 문제검색 U열 체크는 행 위치에 묶여 있어(B3) 검색 조건을 바꾸면 같은 자리에 다른 문항이 온다. v4까지는 "사람이 먼저 지운다 + X1 경고"였다 → 덕수가 **자동 해제**를 택했다.
- **실측(라이브)**: 문제검색 1행의 검색 조건 셀은 **B1·C1·E1·I1·L1·M1**(각각 `선택항목` 시트 드롭다운 — A·J·M·C·E·I열) · A2 = `IFERROR(SORT(FILTER(Data!A2:R, …B1·C1·E1·I1·L1·M1…)), "결과 없음")` · U열은 BOOLEAN 검증 체크박스 · 시트 ID `1830699354`. `problem-ledger`에 **`onEdit`은 없다**(`onOpen` 2개는 있음 — BACKLOG "전역 이름 중복"과 별개로, 단순 트리거 `onEdit`은 프로젝트에 하나만 있어야 하므로 **이 파일이 유일한 `onEdit`**이어야 한다).
- **설계 — `problem-ledger` 신규 `search-check-reset.gs`(단순 트리거, 설치 0)**:
  ```js
  /** 문제검색 시트: 검색 조건(B1·C1·E1·I1·L1·M1)이 바뀌면 U열 체크를 전부 해제한다.
   *  U열 체크는 행 위치에 묶여 있어 조건이 바뀌면 다른 문항을 가리킨다(Phase 72 D11′).
   *  ⚠ 단순 트리거 onEdit은 프로젝트에 하나뿐이어야 한다 — 다른 파일에 onEdit을 만들지 말 것. */
  const SCR = { SHEET: '문제검색', COND_COLS: [2, 3, 5, 9, 12, 13] /* B C E I L M */, COL_CHECK: 21 /* U */ };
  function onEdit(e) {
    try {
      const r = e && e.range; if (!r) return;
      const sh = r.getSheet(); if (sh.getName() !== SCR.SHEET) return;
      if (r.getRow() !== 1 || r.getNumRows() !== 1) return;                     // 1행 한 셀/구간만
      const c0 = r.getColumn(), c1 = c0 + r.getNumColumns() - 1;
      if (!SCR.COND_COLS.some(c => c >= c0 && c <= c1)) return;                 // 조건 셀이 아니면 무시
      const last = sh.getLastRow(); if (last < 2) return;
      const rng = sh.getRange(2, SCR.COL_CHECK, last - 1, 1);
      const vals = rng.getValues();
      if (!vals.some(v => v[0] === true)) return;                               // 켜진 체크가 없으면 쓰기 0
      rng.setValue(false);                                                      // clearContent 금지 — 체크박스 모양이 남아야 한다
    } catch (_) { /* 단순 트리거는 조용히 */ }
  }
  ```
  - 조건 셀이 아닌 1행 편집(라벨 수정)·2행 이하 편집·다른 시트는 **무동작**. 켜진 체크가 0이면 쓰기도 0(매 편집마다 U열을 다시 쓰지 않는다).
  - `setValue(false)` 한 번(범위 전체) — `clearContent`는 값만 지워 체크박스 검증은 남지만 "빈 셀"이 되어 `U2:U=TRUE`·`COUNTIF`가 그대로 0이긴 하다. 그래도 **`false`를 명시**해 X1·W1의 의미를 흔들지 않는다.
  - 단순 트리거는 **편집한 사용자 권한**으로 돌고 같은 파일만 만지므로 승인 팝업이 없다. 30초 제한은 U열 3,443행 1회 쓰기에 충분하다.
  - ⚠ **`clearTUVColumns`(`TUV열 지우기.gs`)와 무관**(문항이동 시트용·수동 메뉴). 합치지 않는다.
- **X1 경고는 그대로 둔다** — 자동 해제가 못 잡는 길(A2 수식 자체를 손으로 고침 · `Data` 시트 변경으로 FILTER 결과가 바뀜)의 안전망.
- **W1 수식 보강**: A2가 `"결과 없음"`(IFERROR 폴백)일 때 U2가 켜져 있으면 그 문자열이 목록에 섞인다 → `FILTER(A2:A, U2:U=TRUE, A2:A<>"결과 없음")`.
- 범위 변화: 문항장부 **GAS 신규 1파일(`onEdit`만)** · 그 밖은 v4 그대로. mathory·latex-convert 0.

---

## 0. 요약

지금 시트 가져오기는 '문제 검토' 파일의 Data_DS·Stack 두 시트만 읽는다(`route.ts:29` `SHEETS`, 환경변수 `AUDITION_SPREADSHEET_ID` 하나). 이번 Phase는 세 겹이다.

1. **원본 확장(안 (1))** — 원본 항목을 **'문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS'** 셋으로. 서버는 `source`(파일)+`sheet`로 어느 스프레드시트를 읽을지 고른다. 환경변수 `LATEX_SPREADSHEET_ID` 신설.
2. **데이터 연결(1층)** — Latex 변환 Data_DS **L열 `jangbu_id`**(문항장부 A열 ID, `D####`·`S####`)를 GAS 메뉴로 백필한다. 소스는 문항장부 `_CroP색인`(✅ 1,444건 · 대상 행 4490~6304). Mathory는 L열을 읽어 `ImportSource.jangbu_id`에 남긴다.
3. **선택 → 전달(2·3층)** — 문항장부 문제검색에서 체크한 ID를 수식 한 셀이 쉼표 목록으로 모으고, Mathory 모달의 **"문항장부 ID 목록"** 칸에 붙여 넣으면 서버가 L열로 행을 고른다(기존 행 범위·M체크와 **합집합**).

변경 파일 — mathory: `app/api/sheet-import/route.ts` · `lib/sheetImport.ts` · `types/problem.ts` · `components/import/SheetImportModal.tsx` · `tests/sheetImport.test.mjs` · `CLAUDE.md`. latex-convert GAS: **신규** `JangbuId.gs` · `MainMenu.gs`(항목 1). 문항장부: 문제검색 시트 **수식 2개 + 메모 1개 + `onEdit` 1파일**(`search-check-reset.gs` — 부록 D). **Firestore 규칙 0 · 그림 프록시 0 · 저장 경로 0 · 중복 판정 0 · `problem-ledger` 기존 GAS 수정 0(신규 1파일) · 문제 검토 파일·`gas-project-audition` 0.**

---

## 1. 현행 — 실측

### 1-1. mathory (`26658b5` · 범위 파일 행 번호 = `4b1228a`)

| 항목 | 자리 | 현행 |
|---|---|---|
| 원본 시트 집합 | `route.ts:29` | `SHEETS = ['Data_DS','Stack']` · 범위 `${sheet}!A1:P`(`:95`) · 스프레드시트 ID는 `AUDITION_SPREADSHEET_ID` 하나(`:48`) · `maxDuration 30`(`:27`) |
| 호출 순서 | `route.ts:119-124` | **`readEnv()` → `verifyUid(env.apiKey, env.allowedUids)` → body 파싱**. source를 알기 전에 env를 다 읽는다 |
| 요청 본문 | `route.ts:6` · `:127` · `:132` | `{ sheet, rows?, includePreselected? }` · 시트 아니면 400 · 둘 다 비면 400 |
| 행 선택 | `route.ts:154` · `:158` · `:141` | `wantedSet.has(rowIndex) \|\| (includePreselected && M체크)` 합집합 · A·E 둘 다 빈 행만 스킵 · 헤더 검사 |
| 응답 | `route.ts:7` · `:168` · `:33`·`:170` | `{ header, headerWarnings, rows:[{rowIndex, cells[16]}] }` · 4MB 상한 |
| 열 매핑 | `lib/sheetImport.ts:17-35` | 0-based 16열. **K(10)·L(11)·N(13)은 매핑에 없다** |
| 헤더 검사 | `:41-55` · `:138-151` | `EXPECTED_HEADERS` 13키 고정. 키 `solution_note`의 기대값은 시트 오타 **`'sloution_note'`**(`:54`). 경고 문구 `${letter}열 헤더가 "${expected}"가 아니라 "${actual}"입니다 — 시트 구조가 바뀌었을 수 있습니다`(`:148`) |
| 초안 변환 | `:423` `rowToDraft` | A→title/source/sourceId(`:424`) · E 비면 **경고만**(`:437`) · `stemHash`는 분할 전 E(`:440`) |
| 그림 참조 | `:195-218` `FIG_SCAN_RE` | 구형 `\includegraphics{}` + 신형 `![파일명](https://drive.google.com/…)` — Latex 변환 C열 형식과 **이미 호환** |
| 그림 프록시 | `figure/route.ts:56` · `:105` · `:133` · `:165` | `?name=` → `AUDITION_FIG_FOLDER_ID` 폴더 안 이름 검색 · `?url=` Mathpix CDN |
| 출처 기록 | `types/problem.ts:108-116` | `ImportSource { provider:'audition-sheet', sheet, row, source_id, stem_hash, imported_at }` |
| `import_source` 소비처 | `types/problem.ts:41` · 모달 `:31`·`:353`·`:360`·`:454`·`:472` | **중복 집합뿐**(`:95` `dupeKey`). 라벨·배지로 `sheet`를 읽는 곳 0 |
| `createProblem` | `lib/firestore.ts:31-36` | **최상위** undefined만 제거 — 중첩 객체 안 undefined는 Firestore가 거부 |
| Firestore 규칙 | `firestore.rules:99-100` | `problems` create = 로그인 + `authorUid` 일치. 키 화이트리스트 없음 |
| 모달 상태 | `:258-260` · `:269` · `:312` | `sheet` 기본 `'Stack'` · `includePreselected` 기본 true · `canSubmit = rowsText.trim() !== '' \|\| includePreselected` |
| 모달 요청·저장 | `:344-347` · `:454-461` | body 3필드 · `importSource.sheet = fetchedSheet` |
| 미리보기 후처리 | `:371-402` | `rowToDraft`(`:371`, stemHash 확정) → `stripInvisibles`(`:387`) → `tidyBlocks` → `dupeKey`(`:402`) |
| `PreviewItem` | `:59-70` | `rowIndex·draft·error·persisted·figNames·autoFixCount·dupe` — **`cells` 없음** → `jangbuId` 필드 추가 |
| 설정 화면 | `:652` FormPane · `:716` M체크 · `:720` Data_DS 힌트 | 원본 버튼 행 · 행 범위 · M체크 · 정돈 체크박스 |
| 테스트 | `package.json:34` `test:sheet` | 단독 tsc(import 0) + `tests/sheetImport.test.mjs`(R·N·**H1~H3**·D·S·L·F·G 군) |
| 환경변수 문서 | `CLAUDE.md:1578` | "환경변수 4종" — `.env.example` 없음 |

### 1-2. 'Latex 변환' 파일 Data_DS (`1wu8Gdvm…` · 라이브 2026-11-05 · GAS `3cc4694`)

| 항목 | 실측 |
|---|---|
| 헤더 | A~K `id · problem · given_solution · given_answer · problem_stem · choice1~5 · answer_type` · **L 없음 · M `get` · N `ID` · O·P 없음** |
| 값 | 데이터 2~6304행(6,303). **L·M·N 0건**. K 전부 값 있음(`mcq_math` 4,356 · `short_int` 1,850 · `mcq_combo` 97) · **FAIL 0 · A 있고 E 빈 행 0** |
| 키 형식 | **4490~6304행(1,815) 전부 CroP 이름**(`24서킷X05_3확통29` 류 · 번호 2자리) · **2~4489행(4,488) 전부 비-CroP**(`연구실01회조판1_1공통01` · `26년K34회_2_5기하23` 등 — 옛 Split 경로 `SPlit*->Data_DS에 기록.gs:26`) · 같은 표준키 두 행 0 |
| 쓰는 코드 | `Datalatex_To_Data_DS.gs:48`(DST A·B·C·D·K) · `normalizeProblem.gs:38`(OUT E~J·K) · `Pipeline.gs:566` `pl_stageSend_`(A:C 청크 `:614`) · Split 3종(A:C) — **L~P를 쓰는 코드 0** |
| 파이프라인 단계 | `Pipeline.gs:436-453` | send(A:C) → normalize(E~J·K, `yield` 있음) → answer(D) → archive. 실패 시 `writeNormResult_`(`normalizeProblem.gs:303-311`)가 E에 원문 보존·K에 사유 |
| 키 정규화 | `dlds_parseFilename_`(`:199`) | `nfc_`(`링크&파일명 추출(키워드).gs:7`·`:49` 중복 정의) → 확장자 제거 → `_문제`/`_해설` 제거 |
| 성격 | 누적형(append, 비워지지 않음) |
| 그림 | C열 `![파일명](Drive링크)`(패치 11) · 폴더 `PBMAI/IMAGE_FIG`(`Mathpix 그림 추출.gs:50`) — Drive에 `IMAGE_FIG` 폴더 **1개** `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`(v3 F5) |
| 메뉴·가드·락 | `MainMenu.gs` `onOpen` · `pl_isBusy_()`(`Pipeline.gs:774`) · 락 관례 `LockService.getScriptLock()`(`Pipeline.gs:279` 외 4곳) |

### 1-3. 문항장부 ↔ 문제 검토 파일

| 항목 | 실측 |
|---|---|
| `_CroP색인`(`1hlnZEB…`) | 1,815행 · A~J에 값(`파일키·문항ID·시트·행·사용세트식별·문서URL·문제파일ID·해설파일ID(순서대로)·해설조각수·상태`) · K~O 검증 열 비어 있음. ✅ 1,444 / ❌ 매칭없음 369 · 문제파일없음 1 · 중복 1. ✅ 고유 ID 1,444 · ID 형식 불량 0 · 모호 키 0 |
| 파일키 조립 | `crop-image-insert.gs:255` `fileKey = ${cropCanonExamName_(exam)}_${code}${subj}${no.padStart(2,'0')}` — 과목 글자 포함 · 번호 2자리 |
| 표준형 함수 | `cropParseExam_`(`:107`) · `cropMakeCanon_`(`:130`) · **`cropKeyAliases_`(`:161`, `[0]` = 표준)** · `cropNfc_`(`:661`). `cropNormKey_`(`:568`)는 시트 매칭키 — 쓰지 않는다 |
| ❌ 371 ↔ Data_DS | 24년 홀수 모의X 8세트 368 + `24X모의06` 1 + `25X모의12_1공통20`(D5008 실재, 색인 누락 · Data_DS 5686행) + `26X모의12_4미적28`(stray) — 백필 "색인에 없음 371"과 1:1 |
| 문제검색 | 1행 머리글·필터 혼합 · A2 `FILTER(Data!A2:R…)` · S 빈 열 · T2 `#N/A`(죽은 수식) · U `선택` 체크박스 · **V 이후 비어 있음** |
| ID 형식 | `generateIdsInColumnA.gs:58` `D${n.padStart(4,'0')}` — `S####`는 덕수 예정(코드 0) |
| 문제 검토 파일 | ID `1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk`(v3 C3). Data_DS·Stack N 머리글 **`problem_verdict`**. Data_DS 현재 비어 있음 · Stack 5,746행 |
| 문제 검토 ← Latex 변환 | `Pipelineverify.gs:794`(A~K 읽기) → `:818`(A~AC 클리어) → `:819`(A~K 쓰기) · Stack은 `mts_core_`(`Movetostack.gs:166`). v3 F6: Stack 5,746 중 Latex 변환 키 겹침 4,953 · E 동일 4,918 · 다름 35(`S팀.X05` 34 + 1) · v4 1,815문항 겹침 **0** |

---

## 2. 덕수 결정 (2026-11-05) → 요구사항

| # | 결정 | 반영 |
|---|---|---|
| 1 | 원본 확장은 **안 (1)** | D1·D2 · §5-3·5-6 |
| 2 | 연결 키는 **문항장부 A열 ID** | D4 |
| 3 | 문항장부 바운드 GAS 기존 파일 수정 0 — v4.1에서 **신규 `onEdit` 1파일**만 추가 | §5-2 · §5-9 |
| 4 | 미등록 문항은 **`S####`로 등록 예정** | D5 · 백필 멱등 |
| 5 | D5008 색인 누락은 **작업 종료 후 보충** | §9-1 |
| 6 | 문제검색 선택 수식은 U열 기준 | §5-2 |
| 7 | v2 Q1~Q8 전항 권장안 | 유지(Q2·Q4는 R1·R3로 재판정) |
| 8 | v3 R1~R6 · v4 S1~S5 | **전항 권장안 확정**(2026-11-05, 부록 C-4) |
| 9 | 검색 조건을 바꾸면 U열 체크 **자동 해제**(2026-11-05 23:15) | 부록 D · D11′ · §5-2 |

---

## 3. 결정 사항

### D1 — 원본 식별은 `source`(파일) + `sheet`(시트) 두 축 (확정)
- API body: `{ source?: 'audition' | 'latex', sheet: 'Data_DS' | 'Stack', rows?, includePreselected?, jangbuIds?: string[] }`. **`source` 생략 = `'audition'`**.
- `SOURCES = { audition: { envId: 'AUDITION_SPREADSHEET_ID', label: '문제 검토', sheets: ['Data_DS','Stack'] }, latex: { envId: 'LATEX_SPREADSHEET_ID', label: 'Latex 변환', sheets: ['Data_DS'] } } as const`. 조합이 표에 없으면 400.
- **환경변수 읽기 순서**: `readEnv()`는 공통 4종만 필수, `sheetIds: { audition?, latex? }`는 선택(정리 `trim().replace(/^\/+|\/+$/g,'')` 둘 다). `verifyUid` 뒤 body의 `source`로 `env.sheetIds[source]`가 없으면 `ApiError(500, '서버 환경변수가 설정되지 않았습니다: <envId>')`. `readSheet(sheet, sheetId, envId)` — 404 문구가 `envId`를 쓴다(`:101`).

### D2 — `ImportSource`에 선택 필드 2개, 마이그레이션 0 · 규칙 0 (확정)
```ts
export interface ImportSource {
  provider: 'audition-sheet';           // 불변
  /** 어느 스프레드시트인가. 없으면 문제 검토(Phase 61a~71 문서) — audition은 필드 자체를 두지 않는다(Q5·R6) */
  file?: 'latex';
  sheet: 'Data_DS' | 'Stack';
  row: number;
  source_id: string;
  stem_hash: string;
  /** 문항장부 A열 ID(D####·S####). file==='latex'이고 L열이 ID_RE에 맞을 때만 */
  jangbu_id?: string;
  imported_at: number;
}
```
- ⚠ **조립은 조건부 스프레드** — `buildImportSource`(§5-4)가 소유. `file: undefined`를 넣으면 `createProblem`(`lib/firestore.ts:31-36`)이 못 걸러 저장이 실패한다.

### D3 — 중복 판정은 그대로 `source_id|stem_hash`, 파일 무관 (확정 · v3 F6 실측)
- 문제 검토 Data_DS A~K는 Latex 변환 A~K의 복사본, Stack은 그 이동본 → 같은 문항은 `source_id`·`stem_hash`가 같다. 실측 4,918/4,953 동일(99.3%), 다른 35건은 한 세트(`S팀.X05`)의 재정규화 꼬리.
- 알려진 손실: Latex 변환 쪽을 재정규화하면 E가 바뀌어 새 문항으로 들어온다(현행과 같다). 안 바꾼다(R3).

### D4 — 연결 열은 Latex 변환 Data_DS **L열, 머리글 `jangbu_id`** (확정)
- L은 머리글·값 0, Mathory·GAS 어느 쪽도 읽지 않는다. **M(`get`)·N(`ID`)은 쓰지 않는다** — 문제 검토 배치에서 M은 체크박스, N은 `problem_verdict`(`Itemverification.gs:6` STEP 1 → N) 자리. Latex 변환 N의 `ID` 머리글은 값 0·쓰는 코드 0인 별개 머리글(그대로 둔다).
- `SHEET_COL.jangbu_id = 11`. `rowToDraft` **무변경** — 모달이 `cells[11]`을 읽는다.
- 헤더 검사: `checkHeaders(header, profile = 'audition')`. latex 프로파일은 `EXPECTED_HEADERS_LATEX`(A~K + L `jangbu_id`)만 보고 M·O·P는 검사하지 않는다. **L 누락은 전용 문구**(S1): "L열 머리글 `jangbu_id`가 없습니다 — Latex 변환 메뉴 '🔗 문항장부 ID 채우기'를 아직 안 돌렸을 수 있습니다"(HL1). 백필 ⑤가 머리글을 쓰면 0건(HL2).

### D5 — ID 형식 `^[DS]\d{4,5}$` · 정규화 (Q1)
- `parseJangbuIds(text): { ids; invalid }` — 쉼표·공백·줄바꿈·세미콜론, trim, `normalize('NFC')`, 대문자화, 중복 제거, 순서 유지. `JANGBU_ID_RE`·`JANGBU_ID_MAX = 500` export.
- 서버는 같은 함수로 재검증, invalid는 버리고 진행. 유효 ID 500 초과면 400.

### D6′ — 합집합 · 최소 하나 · `jangbuIds`는 latex 전용
- `source !== 'latex'`인데 `jangbuIds`가 비어 있지 않으면 **400** `"문항장부 ID 목록은 'Latex 변환 : Data_DS'에서만 쓸 수 있습니다"`.
- 선택식: `wantedSet.has(rowIndex) || (includePreselected && M체크) || jangbuSet.has(normId(cells[11]))` — `normId = s.trim().normalize('NFC').toUpperCase()`. 매칭 집합은 **선택 여부와 무관하게 전 행**에서 모아 `unmatched`를 낸다.
- 셋 다 비면 400(현행 문구 + "또는 문항장부 ID 목록"). 응답 `unmatched: string[]`(요청 순서). 매칭 0이어도 200. 옛 호출도 `unmatched: []`.
- 같은 ID가 L열에 둘 이상이면 전부 포함 — D3가 거른다(지금은 표준키마다 1행).

### D7 — 'Latex 변환 : Data_DS'에서는 M체크 옵션을 숨긴다 (확정 · S3)
- latex면 UI를 숨기고 요청에는 `includePreselected: false`를 **파생값**으로 싣는다 — **상태는 건드리지 않는다**(audition으로 돌아오면 직전 값 그대로). 서버 분기 없음. 기본 선택은 '문제 검토 : Stack'. Data_DS 비워짐 힌트(`:720`)는 '문제 검토 : Data_DS'일 때만(v3 C1).

### D8 — 1층 백필은 Latex 변환 GAS 메뉴 1개 (확정)
- `JangbuId.gs` `jb_backfillFromLedger()`: 문항장부를 `openById`로 **읽어** `_CroP색인` A~J 1회 `getValues`(H5), Data_DS A·L 1회 읽기(전 행 — R5), **표준 파일키**로 짝짓는다.
- 표준 파일키 = `cropKeyAliases_(key)[0]`의 이식 + 뒤 부분 `^(\d)(공통|확통|미적|기하)(\d{1,2})$` 2자리 패딩(안전망). 양쪽 키에 같은 함수. 자체 `jb_nfc_`.
- 상태 ✅만. L 빈 행만(스크립트 속성 `JB_OVERWRITE === 'true'`면 덮어씀 — Q6). 모호 키는 건너뛰고 보고(Q3 — 실측 0).
- 가드: `pl_isBusy_()` → 거부 · `LockService.getScriptLock().tryLock(10000)` 실패 → 거부 · `finally` 해제.
- 결과 **알림 1장(try/catch — S2) + Logger 항상**: 채움 · 이미 있음 · 형식 아님(**"옛 경로 행 — 정상"**) · 색인에 없음(**세트별 집계** + 앞 10개 키 — R4) · 모호 · 색인 ID 형식 불량 · 색인 ✅ 미사용.
- 접근권한: 실행 사용자(덕수)가 문항장부 편집자. 서비스 계정 무관.
- 후속(§9-2): `pl_stageSend_` 끝 자동 채움(Q7).

### D9 — 그림 프록시는 **그대로** (확정 · v3 F5)
- Drive에 `IMAGE_FIG` 폴더가 1개뿐이고 Latex 변환 그림의 부모가 그 폴더 → `AUDITION_FIG_FOLDER_ID` 하나로 두 파일의 그림을 다 찾는다. 조건부 분기 **철회**(R2). V1′: Vercel 값이 `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`인지 1회 확인(덕수).

### D10 — 서비스 계정 권한·환경변수 (덕수 작업)
- Latex 변환 파일(`1wu8GdvmpyxCqSKS5RiSlRhWGH4B2OMoPN0TGP94ti54`)에 `GOOGLE_SA_EMAIL`을 **뷰어**로 공유. Vercel(Production·Preview)·`.env.local`에 `LATEX_SPREADSHEET_ID`. C 단계 배포 **전**. `AUDITION_ALLOWED_UIDS` 그대로.

### D11′ — 2층은 문항장부 **수식 2개 + 메모 1개 + `onEdit` 1개** (확정 · S4 · 부록 D)
- 문제검색 **W1**: `=IFERROR(TEXTJOIN(",",TRUE,FILTER(A2:A, U2:U=TRUE, A2:A<>"결과 없음")),"")`
- **X1**: `=LET(n,COUNTIF(U2:U,TRUE),m,IF(W1="",0,COUNTA(SPLIT(W1,","))),IF(n>500,"⚠ 500개 초과 — 나눠서",IF(n<>m,"⚠ 체크 "&n&"개 ≠ ID "&m&"개 — 검색 결과 밖 체크를 해제하세요","선택 "&n&"개")))`
- V1 라벨 `선택 ID →` · V1 노트: "검색 → U열 체크 → W1 복사 → Mathory 시트 가져오기 'Latex 변환 : Data_DS' ID 목록에 붙여넣기. 검색 조건(1행)을 바꾸면 체크가 **자동으로 풀립니다** — 목록이 필요하면 바꾸기 전에 W1을 복사해 두세요. X1이 ⚠이면 결과 밖에 체크가 남은 상태". T2 삭제.
- **`search-check-reset.gs`**(부록 D): 1행 B·C·E·I·L·M 편집 → U2:U `false`. 단순 트리거라 설치 0.

---

## 4. 현행 규약 충돌 점검

| 규약 | 판정 |
|---|---|
| 서버는 시트를 **읽기만**(`route.ts:9-11`) | 유지 |
| `lib/sheetImport.ts` **import 0**(`:3-6`) | 유지 — `parseJangbuIds`·`checkHeaders(profile)`·`buildImportSource`는 순수. `ImportSource` 모양은 로컬 정의 |
| Firestore 저장은 클라의 기존 CRUD · 규칙 | 유지 — `problems` create에 키 제한 없음(`firestore.rules:99-100`) |
| 중복 판정 `source_id+stem_hash`(`types/problem.ts:101-105`) | 유지(D3) |
| 열 위치가 진실, 헤더는 경보(`sheetImport.ts:12-16`) | 유지 |
| GAS 열 하드코딩(열 끼우기 금지) | 준수 — 빈 열에 값만 |
| 문제 검토 Data_DS는 검증마다 비워진다(`Pipelineverify.gs:818`) | 영향 없음 |
| `_CroP색인`·`crop-image-insert.gs` | 읽기만 |
| `problem-ledger` 단순 트리거 | 프로젝트에 `onEdit` 없음(라이브·레포 확인) → 신규 파일이 유일한 `onEdit`. 문제검색 시트 자기 범위만 쓴다 |
| 락 관례 `getScriptLock()` | 준수 |

---

## 5. 구현 항목

### 5-1. latex-convert GAS — 신규 `JangbuId.gs` + `MainMenu.gs` 항목 1
```js
const JB = {
  LEDGER_ID: '1hlnZEB-v6MQ7FpkaZigblmAYy5_LBH6kqH6mflQRrj0',
  INDEX_SHEET: '_CroP색인', IDX_COLS: 10, IDX_KEY: 1, IDX_ID: 2, IDX_STATUS: 10,   // = crop-image-insert.gs CROP_IDX (헤더 라이브 일치)
  DST_SHEET: 'Data_DS', COL_KEY: 1, COL_JANGBU: 12 /* L */, HEADER: 'jangbu_id',
  OVERWRITE_PROP: 'JB_OVERWRITE',                                      // 'true'일 때만 덮어쓴다(Q6)
  ID_RE: /^[DS]\d{4,5}$/,                                              // Q1
  LOCK_MS: 10000, HEAD_N: 10,
};
```
- `jb_nfc_(s)` — `String(s == null ? '' : s).normalize('NFC')`(레포의 `nfc_`는 중복 정의라 쓰지 않는다).
- `jb_parseExam_`·`jb_makeCanon_` — `crop-image-insert.gs:107-134` 이식(주석에 출처·`90c88cf`).
- `jb_canonKey_(key)`:
  ```js
  function jb_canonKey_(key) {
    const k = jb_nfc_(key).trim();
    const i = k.indexOf('_'); if (i < 0) return null;
    const p = jb_parseExam_(k.slice(0, i)); if (!p) return null;          // X 규칙이 아니면 "형식 아님"(옛 경로 행)
    const m = k.slice(i + 1).match(/^(\d)(공통|확통|미적|기하)(\d{1,2})$/);
    if (!m) return null;
    return `${p.canon}_${m[1]}${m[2]}${String(parseInt(m[3], 10)).padStart(2, '0')}`;
  }
  ```
- `jb_backfillFromLedger()` — ① `pl_isBusy_()` → 거부(`pl_busyMessage_()`) · `LockService.getScriptLock().tryLock(JB.LOCK_MS)` 실패 → 거부 ② 색인 `getRange(2, 1, n, JB.IDX_COLS).getValues()` → `Map<canon, Set<ID>>`(✅만 · ID trim·대문자 · ID_RE 불일치 `idBad++`) ③ Data_DS A·L 1회(`lastRow = dlds_lastDataRow_(sh, 1)`) ④ 행마다: L 있고 덮어쓰기 아님 → `already++` / canon null → `notCrop++` / 맵에 없음 → `noIndex++`(세트별 `Map`) / Set ≥ 2 → `ambiguous` / 아니면 채움 ⑤ L 범위 1회 `setValues`(읽은 `lastRow`까지) + L1 비었으면 `jangbu_id` ⑥ 보고문 1개를 만들어 `Logger.log(msg)` **항상**, `try { SpreadsheetApp.getUi().alert(msg) } catch (_) {}`(S2) · `finally { lock.releaseLock() }`.
  보고문: `채움 n · 이미 있음 n · 형식 아님 n(옛 경로 행 — 정상) · 색인에 없음 n(세트별: 24X모의01 46 · … / 앞 10개 키) · 모호 n · 색인 ID 형식 불량 n · 색인 ✅ 미사용 n(앞 10개)`.
- `MainMenu.gs`: `pipeline_sheetcheck_menu` 아래 구분선 뒤 **'🔗 문항장부 ID 채우기 (Data_DS L열)'**. `RemoteApi.gs` 무변경.
- latex-convert 레포 커밋 · `clasp push`.

### 5-2. 문항장부 — 수식 2개 + 메모(수동) + `search-check-reset.gs`(신규)
- D11′ 그대로(W1 `결과 없음` 제외 조건 포함).
- `gas-project-problem-ledger`에 **`search-check-reset.gs`** 신규(부록 D 코드 그대로) → 커밋 · `clasp push`. 기존 파일 무수정. ⚠ 레포에 `onEdit`이 이미 있는지 push 전에 `grep -n "function onEdit" *.gs`로 한 번 더(지금은 0).

### 5-3. `app/api/sheet-import/route.ts`
- `SOURCES` 표 · `readEnv()` → `{ email, key, apiKey, allowedUids, sheetIds }`.
- body: `source`(기본 `'audition'`, 표 밖 400) · `sheet`(source의 `sheets` 밖 400 — 문구 `"'문제 검토' sheet는 Data_DS 또는 Stack이어야 합니다"` 꼴) · `jangbuIds`(배열 아니면 `[]`; `parseJangbuIds(arr.join(',')).ids`) · source≠latex & ids≥1 → 400 · ids>500 → 400.
- `sheetId = env.sheetIds[source]` 없으면 500 + envId · 최소 하나(D6′) · `readSheet(sheet, sheetId, envId)` · `checkHeaders(header, profile)` · 합집합 · `unmatched` · 응답 `{ header, headerWarnings, rows, unmatched }`.
- 헤더 주석(`:1-18`) 갱신. `maxDuration`·`MAX_PAYLOAD_BYTES` 유지.

### 5-4. `lib/sheetImport.ts`
- `SHEET_COL.jangbu_id: 11` + 주석. `EXPECTED_HEADERS_LATEX`(A~K 11키 + `jangbu_id`). `checkHeaders(headerRow, profile = 'audition')` — latex 프로파일에서 **`jangbu_id` 키의 불일치만** 전용 문구(S1), 나머지는 현행 문구.
- `JANGBU_ID_RE` · `JANGBU_ID_MAX` · `parseJangbuIds`.
- `buildImportSource(args: { file: 'audition' | 'latex'; sheet; row; sourceId; stemHash; jangbuCell?: string; now: number })` → 로컬 `ImportSourceShape`(`types/problem.ts` `ImportSource`와 같은 모양 — 주석으로 짝). audition이면 `file`·`jangbu_id` 키 자체 없음, latex면 `file: 'latex'` + 정규화한 셀이 ID_RE에 맞을 때만 `jangbu_id`.
- `rowToDraft` 무변경.

### 5-5. `types/problem.ts`
- D2의 두 줄 + 주석.

### 5-6. `components/import/SheetImportModal.tsx`
- `type SourceKey = 'audition:Data_DS' | 'audition:Stack' | 'latex:Data_DS'` · `SOURCES` 3항목(라벨 '문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS' · 셋째 힌트 "대량 변환 누적본 · 문항장부 ID로 고를 수 있음").
- 상태 `sourceKey`(기본 `'audition:Stack'`) · `jangbuText` · `fetched: { file, sheet }`. **`includePreselected` 상태는 불변**, 파생값 `effectivePreselected = file === 'audition' && includePreselected`(S3). latex면 M체크 UI 숨김. Data_DS 비워짐 힌트(`:720`)는 `'audition:Data_DS'`일 때만.
- `canSubmit = rowsText.trim() !== '' || effectivePreselected || (file === 'latex' && parsed.ids.length > 0)`.
- FormPane(latex): **"문항장부 ID 목록"** textarea(placeholder `D5006, D5008 …` · 힌트 "문제검색 W1을 붙여넣으세요 · S#### 가능 · 최대 500개") · `invalid` 경고("형식에 안 맞아 빼는 값 n개: …").
- fetchRows: body `source`·`sheet`·`includePreselected: effectivePreselected`·`jangbuIds`(latex만). `unmatched`가 있으면 경고 1줄 + v3 C6 문구("문항장부에는 있지만 Latex 변환 L열이 비어 있는 ID일 수 있습니다 — 색인 누락·아직 변환 안 된 S####").
- `PreviewItem`에 `jangbuId: string | null` 추가(`cells[SHEET_COL.jangbu_id]`, latex만). 미리보기 행 머리 배지 `D5006`(읽기 전용).
- saveOne: `buildImportSource({ file: fetched.file, sheet: fetched.sheet, row, sourceId, stemHash, jangbuCell: item.jangbuId ?? undefined, now: Date.now() })`.

### 5-7. 환경변수·배포·Vercel 확인 (덕수)
- D10(`LATEX_SPREADSHEET_ID` · 뷰어 공유).
- **Vercel 값 2건 확인**(H6): `AUDITION_FIG_FOLDER_ID` = `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`(V1′) · `AUDITION_SPREADSHEET_ID` = `1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk`(v3 C3).

### 5-8. 테스트·문서
- `tests/sheetImport.test.mjs`: **J1** `parseJangbuIds` 구분자 4종·대문자화·NFC·중복 제거·순서·invalid · **J2** 빈 입력 · 5자리 허용 · `D123`·`X9999`·`D123456` invalid · **HL1** latex 프로파일 백필 전(L `''`) 경고 **1건 · 전용 문구**(S1) · M·N 무시 · **HL2** 백필 후 0건 · 기존 H1~H3 불변 · **I1** `buildImportSource` audition 키 없음(`'file' in obj === false`) / latex 정상 / ` d5006 `→`D5006` / `X1`→키 없음.
- CLAUDE.md: 파일 구조 줄 2곳에 "(Phase 72 …)" · 핵심 패턴에 **D4(L열 · N은 problem_verdict 자리) · D3(두 파일 A~K 복사본 · 99.3% 실측) · E8(중첩 undefined는 `createProblem`이 못 거른다)** · `:1578` "4종"→**5종** · `test:sheet` 개수.
- 완료 시 확정본을 `docs/phasedocs/` · roadmap · 작업물(v1~v4·연구 메모)은 `docs/phaseSketch/_archive/Phase72/`.

### 5-9. 건드리지 않는 것
- `figure/route.ts` · `lib/apiAuth.ts` · `createProblem`/`saveTabBlock` · Firestore 규칙 · `rowToDraft`·`splitFigures`·`stemHash`·`FIG_SCAN_RE` · `problem-ledger` **기존** GAS 전부(`crop-image-insert.gs`·`TUV열 지우기.gs` 포함 — 신규 파일 1개만) · `RemoteApi.gs`·러너·`Pipeline.gs` · 문제 검토 파일·`gas-project-audition` 전부.

---

## 6. 검증 계획

| # | 무엇을 | 어떻게 | 합격 |
|---|---|---|---|
| V1′ | 그림 폴더(D9) | Vercel `AUDITION_FIG_FOLDER_ID` 값(덕수) | `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`. 아니면 그 값으로 고친다(코드 0) |
| V2 | `test:sheet` | J1·J2·HL1·HL2·I1 추가 후 전부 녹색 | 기존 전부 불변 |
| V3 | 백필 1회 | `jb_backfillFromLedger()` 보고문 | **채움 1,444 · 이미 있음 0 · 형식 아님 4,488 · 색인에 없음 371(24X모의01·03·05·07·09·11·13·15 각 46 · 24X모의06 1 · 25X모의12 1 · 26X모의12 1) · 모호 0 · 색인 ID 형식 불량 0 · 색인 ✅ 미사용 0**(v3 F4 = web 라이브 재현) |
| V3′ | 백필 멱등 | 2회차 | 채움 0 · 이미 있음 1,444 · 나머지 동일 |
| V4 | 백필 표본(S5) | Data_DS **5786행** `25서킷X03_1공통14` → L `D5006`(색인 `25X서킷03_1공통14`) · **6043행** `26모의X10_1공통15` → `D4827`(색인 `26X모의10_1공통15`) · **5686행** `25모의X12_1공통20` → **L 빈칸**(색인 ❌ — §9-1 전 정상) · 문항장부 Data에서 D5006·D4827의 (사)세트·번호 손 대조 | 3/3 |
| V5 | 옛 호출 호환 | `source` 없이 Stack | 현행 + `unmatched: []` |
| V6a | 'Latex 변환 : Data_DS' + 행 범위(A 단계 전 가능) | 4500-4505 | 미리보기 6행 · Drive 그림 표시(V1′ 뒤) · `file='latex'` 저장 성공 |
| V6b | 같은 요청(A 단계 뒤) | 4500-4505 | 배지 `D2023`·`D2012`·`D2140`… · `jangbu_id` 저장 |
| V7 | ID 목록 | `D5006, d5006, X9999, S0001` | rows = Data_DS 5786행 1건 · invalid `X9999`(클라) · unmatched `S0001` + C6 문구 |
| V8 | 합집합 | 행 범위 + ID 목록 겹침 | 1번 · 오름차순 |
| V9 | 중복 | Stack에서 가져온 문항을 Latex 변환에서 다시 | `dupe:'existing'` |
| V10 | 환경변수 누락 | `LATEX_SPREADSHEET_ID` 없는 로컬 | audition 정상 · latex만 500 + 변수명 |
| V11 | 2층 수식 | 3개 체크 → W1·X1 | 목록 · "선택 3개" · 0개면 빈 문자열 · 결과 없을 때 체크해도 `결과 없음`이 목록에 안 섞임 |
| V11′ | 자동 해제(부록 D) | 3개 체크 → M1 태그 변경 → U열 · 1행 라벨 셀(D1) 편집 → U열 · 2행 편집 → U열 | 조건 변경: 전부 FALSE · W1 빈 문자열 · X1 "선택 0개" / 라벨·2행 편집: 체크 유지 / 조건 변경 전 결과 밖 체크 시나리오는 X1 ⚠로만(자동 해제 뒤엔 발생 안 함) |
| V12 | 응답 크기 | ID 500개 | 413 아님 |
| V14 | audition에 ID 목록 | `{ source:'audition', sheet:'Stack', jangbuIds:['D5006'] }` | 400 |
| V15 | M체크 상태 보존(S3) | latex 선택 → audition:Stack 복귀 | M체크가 직전 값 그대로 |

---

## 7. 위험·트레이드오프

- 색인 파일키 ↔ Data_DS 표기 불일치 재발 → "형식 아님"으로 셈만 된다. 규칙 이중은 주석 상호 참조 + 커밋 해시.
- `S####` 등록 뒤 백필 재실행을 잊음 → §9-1. 멱등.
- L열을 사람이 지우거나 열을 끼움 → 머리글 경고(HL) · ID_RE가 마지막 방어선.
- Latex 변환 Data_DS 전량 읽기(~19MB) → `maxDuration 30` 안. 느려지면 `A1:N`.
- 같은 ID 두 행(재변환) → 둘 다 미리보기, D3가 거른다.
- 2층 체크의 위치 의존 → **`onEdit` 자동 해제**(부록 D) + X1 불일치 경고(S4). 남는 구멍은 A2 수식을 손으로 고치거나 `Data`가 바뀌어 FILTER 결과가 밀리는 경우뿐 — X1이 잡는다.
- **단순 트리거의 한계**: 다른 스크립트·API가 1행을 바꾸면 `onEdit`이 돌지 않는다(사람 편집만). 지금 1행은 드롭다운으로 사람만 바꾼다.
- D3의 0.7%(v3 F6): Latex 변환 쪽 재정규화 뒤 같은 문항이 두 벌 들어올 수 있다 — 알고 수용(R3).
- **파이프라인이 도는 중의 새 행**(G2): send 뒤 normalize 전 행은 E가 비어 'E열이 비어 있습니다' 경고가 난다 — 러너가 끝난 뒤 가져온다(상태는 `📋 파이프라인 상태`).

---

## 8. 커밋 가이드 (CLI)

push는 덕수 허락(2026-11-05) 아래 CLI가 하고 보고에 push 사실을 적는다.

| 단계 | 레포 | 내용 | 선행 |
|---|---|---|---|
| A | latex-convert | `JangbuId.gs` + 메뉴 · clasp push · 백필 1회(V3·V3′·V4) | — |
| B | 문항장부 | W1·X1·V1 노트 · T2 삭제(V11) · `search-check-reset.gs` 커밋 + clasp push(V11′) | — |
| C | mathory | 안 (1): `route.ts` SOURCES·env 분리 · `checkHeaders(profile)`·HL1·HL2 · 모달 3항목·`fetched`·파생 M체크(S3) · `ImportSource.file`·`buildImportSource`·I1(audition) (V5·V6a·V10·V15) | D10 · V1′ |
| D | mathory | ID 목록: `parseJangbuIds`·J1·J2 · `jangbuIds`·`unmatched`·400 · 모달 textarea·배지·C6 · `jangbu_id` 저장·I1(latex) (V6b·V7·V8·V9·V12·V14) | A · C |
| E | mathory | 문서: CLAUDE.md · roadmap · phasedocs 확정본 · `_archive/Phase72/` | D |

---

## 9. 후속 · 미해결

### 9-1. ⚠ 작업 종료 후 반드시 (덕수 지시 2026-11-05)
1. **색인 누락 `25X모의12_1공통20` → D5008 보충**(Data_DS 5686행) → 백필 재실행으로 "이미 있음 1,445"가 되는지 확인.
2. **`S####` 등록 뒤 백필 재실행**: 24년 홀수 모의X 368 + 25·26년 미변환분이 문항장부에 들어오면 `cropBuildIndex` 재실행(또는 수동) → 백필.

### 9-2. 이 Phase 밖
- `pl_stageSend_` 자동 L 채움(Q7).
- Q2 "본문 없음" 배지(R1 철회분) — E 빈 행이 실제로 생기면 그때.
- stray 2건: Data_DS `26모의X12_4미적28`(색인 없음) · 색인 `24X서킷24_3확통29`(Data_DS 없음) — 원인만 확인.
- 2~4489행(옛 경로 4,488행)의 문항장부 연결 — 키 형식이 CroP가 아니라 백필 밖. 필요하면 별도 매핑표.
- 문제 검토 Stack의 `S팀.X05` 34건 E 꼬리 — 그 세트를 Mathory로 가져올 때 두 벌 여부 확인.

---

## 10. 구현 기록 (CLI · 2026-11-05)

### 10-1. 커밋

| 단계 | 레포 | 커밋 | 내용 |
|---|---|---|---|
| A | `gas-project-latex-convert` | `57488dc` · `7136e38` | `JangbuId.gs` 신규(§5-1 그대로 — `JB` 상수 · `jb_nfc_`·`jb_parseExam_`·`jb_makeCanon_`·`jb_canonKey_` 이식 · `jb_backfillFromLedger` ①~⑥ · `jb_notify_` S2) + `MainMenu.gs` 항목 1(`pipeline_sheetcheck_menu` 아래 구분선 전). **clasp push 완료(2026-11-06 — 덕수가 스크립트 ID 제공, `.clasp.json` gitignore)** · 백필 V3·V3′·V4 통과 |
| B | `gas-project-problem-ledger` | `b4413d4` → `b220051` | `search-check-reset.gs` 신규(부록 D 코드 그대로) → **라이브 재pull 반영**(10-2 I1) → `clasp push -f` 21파일 → 재pull로 라이브 = 레포 전 파일 일치 확인(`onEdit` 유일) |
| C+D | `mathory` | `a13e0eb` | `route.ts`(SOURCES · `readEnv` sheetIds 선택 · `readSheet(sheet, sheetId, envId, env)` · body `source`·`jangbuIds` · latex 전용 400 · 500개 상한 400 · 합집합 · `unmatched` · 헤더 주석) · `lib/sheetImport.ts`(`SHEET_COL.answer_type/jangbu_id` · `EXPECTED_HEADERS_LATEX` · `HeaderProfile` · `checkHeaders(h, profile)` S1 · `JANGBU_ID_RE`·`JANGBU_ID_MAX`·`normalizeJangbuId`·`parseJangbuIds` · `ImportSourceShape`·`buildImportSource`) · `types/problem.ts`(`file?`·`jangbu_id?`) · 모달(§5-6 전부) · 테스트 J1·J2·HL1·HL2·I1 |
| E | `mathory` | (docs 커밋) | CLAUDE.md(구조 3줄 · 핵심 패턴 Phase 72 절 · 환경변수 5종 · `test:sheet` 78 · 현재 Phase) · roadmap · 이 확정본 · 작업물 `_archive/Phase72/`(로컬) |

C와 D는 같은 파일(route·lib·모달·테스트)을 나눠 고치는 셈이라 **한 커밋**으로 묶었다(검증 항목은 §6 그대로 둘로 본다).

### 10-2. 착수판과 달리 한 것 · 구현이 잡은 것

| # | 내용 | 처방 |
|---|---|---|
| I1 | **문항장부 라이브 스크립트가 로컬 pull(`90c88cf`, 11/05 낮) 뒤 11파일 바뀌어 있었다** — `generateIdsInColumnA.gs`(S#### 지원 · 중복 검사) · `이동이력보수기록.gs`(`^[DS]\d{4}$`) 외 9파일. 레포에서 그대로 `clasp push`했으면 **덕수의 S#### 준비 작업을 덮어썼다** | push 전에 라이브를 임시 폴더로 `clasp pull`해 `diff -rq` → 라이브를 레포에 먼저 반영(`b220051`) → 신규 파일만 얹어 push → 재pull 대조. **규약**: clasp push 전 라이브 pull 대조(CLAUDE.md 핵심 패턴에 기록) |
| I2 | `gas-project-latex-convert`에 `.clasp.json`이 없다(gitignore 대상이라 레포에도 없고 이 머신에도 없다 — 지금까지 덕수가 push해 온 레포). `clasp list`는 바운드 스크립트를 보여 주지 않고, 러너 config엔 웹앱 배포 URL(`AKfycb…`)뿐이라 스크립트 ID를 못 구한다 | **A 단계 clasp push는 덕수**(또는 Apps Script 편집기 → 프로젝트 설정 → 스크립트 ID를 주면 CLI가 `.clasp.json`을 만들어 push). V3·V3′·V4는 그 뒤 |
| I3 | `SHEET_COL`에 `answer_type: 10`(K) 추가 — `EXPECTED_HEADERS_LATEX`가 K를 검사하려면 키가 필요하다. `EXPECTED_HEADERS`(audition)에는 넣지 않아 기존 H1~H3 불변 | 테스트 HL2가 "audition 프로파일로 latex 헤더를 검사하면 O·P 불일치만"을 고정 |
| I4 | 색인 상태 판정은 `=== '✅'`가 아니라 **`/^✅/`** — 라이브 값은 정확히 `✅`(1,444)지만 `crop-image-insert.gs`가 자기 색인을 읽을 때 쓰는 관례(`:306`·`:460`·`:621`)와 같게 | — |
| I5 | 모달의 `unmatched` 경고는 별도 줄이 아니라 **`headerWarnings` 목록에 한 줄**로 합쳤다(같은 ⚠ 상자 — 앞 10개 ID + C6 문구) | — |
| I6 | latex일 때 "문항장부 ID 목록" textarea가 **M체크 라벨 자리**에 들어간다(둘이 같이 보이지 않는다). audition이면 종전 라벨 그대로, Data_DS 비워짐 힌트는 `audition:Data_DS`에서만(C1) | — |
| I7 | 서버 `jangbuIds`는 배열 원소를 `String()`으로 합쳐 `parseJangbuIds`에 넣는다(비문자열이 와도 400이 아니라 invalid로 버린다 — B8) | — |
| I8 | mathory 로컬 클론에 `node_modules`가 없었다(원격 동기화 뒤 처음) → `npm install` 뒤 `test:sheet`·`tsc` | — |
| I9 | 이 프로젝트에 ESLint 설정 파일이 없어 `next lint`가 설정 생성 프롬프트를 띄운다 — lint는 건너뛰고 `tsc --noEmit`(전체) + 프로덕션 빌드로 대신 | — |

### 10-3. 검증 현황

| # | 상태 | 비고 |
|---|---|---|
| V2 | **통과** | `test:sheet` 73 → **78**(J1·J2·HL1·HL2·I1) · `tsc --noEmit` 전체 통과 · 프로덕션 빌드(§10-4) |
| V11′ | 코드 push 완료 · **실물 대기(덕수)** | `onEdit` 라이브 반영 확인(재pull). 체크 3개 → M1 변경 → U열 FALSE 확인은 덕수 |
| V3 · V3′ · V4 | **통과(2026-11-06, 덕수)** — latex-convert clasp push(CLI, 스크립트 ID 덕수 제공 · 라이브 대조 뒤 push · 재pull 30파일 일치) → 메뉴 1회 채움 1,444 · 형식 아님 4,488 · 색인에 없음 371 · 모호 0 → 2회 채움 0 · 이미 있음 1,444 → 5786행 D5006 · 6043행 D4827 · 5686행 빈칸 | 백필 1층 완료 |
| V11 | **대기(덕수)** — W1·X1·V1 노트·T2 삭제는 시트 수동 | D11′ 수식 그대로 |
| V1′ · C3 · D10 | **대기(덕수)** — Vercel·`.env.local`·서비스 계정 뷰어 공유 | §5-7 |
| V5~V10 · V12 · V14 · V15 | **대기** — 배포 뒤 실물 | V6a는 A 단계 없이도 가능(D10 뒤) |

### 10-4. 덕수 작업 체크리스트 (순서대로)

1. ~~latex-convert clasp push → 백필 1회·2회 → 표본 3행~~ **완료(2026-11-06 — 전항 기대값 일치)**.
2. **문항장부 문제검색**: W1·X1 수식(D11′) · V1 라벨 `선택 ID →` + 노트 · T2 삭제 → 체크 3개 → W1·X1(V11) → M1 드롭다운 변경 → U열 전부 해제(V11′).
3. **Latex 변환 파일에 서비스 계정 뷰어 공유** · Vercel(Production·Preview)·`.env.local` `LATEX_SPREADSHEET_ID` = `1wu8GdvmpyxCqSKS5RiSlRhWGH4B2OMoPN0TGP94ti54` · Vercel `AUDITION_FIG_FOLDER_ID`·`AUDITION_SPREADSHEET_ID` 값 확인(V1′·C3).
4. 배포 뒤 실물 V5~V10 · V12 · V14 · V15.
5. ⚠ **작업 종료 후**: D5008 보충 → 백필 재실행 · `S####` 등록 뒤 `cropBuildIndex` → 백필 재실행(§9-1).
