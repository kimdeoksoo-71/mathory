# Phase 72 — 시트 가져오기 원본 확장('Latex 변환') + 문항장부 ID 연결 구현 계획서 v3 (CLI 교차검토판)

작성일: 2026-11-05 · 작성: **CLI v3**(web v2를 레포 4개 + 구글시트 xlsx 3벌로 재대조) · 기준 커밋: mathory **`20783a8`**(origin/main과 일치 확인, 범위 안 파일 전부 불변) · `gas-project-latex-convert` `3cc4694` · `gas-project-problem-ledger` `90c88cf` · `gas-project-audition` `98b7f54`
계보: 덕수 질문 1~3 → 연구 메모 → 덕수 결정 §2 → CLI v1 → web v2(정정 E1~E9 · 보완 B1~B9 · 결정 Q1~Q8 확정) → **CLI v3**(정정 F1~F10 · 보완 C1~C8 · 추가 결정 R1~R6 — §부록 B) → web v3 검토 → CLI 착수판
실측(v3 추가): 'Latex 변환' Data_DS 6,303행 전수(키 형식·E 빈 행·K FAIL) · `_CroP색인` 1,815행으로 **백필 시뮬레이션** · '문제 검토' 파일 xlsx 내보내기(`1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk`)로 Stack 5,746행 ↔ Latex 변환 **교차 대조** · Drive에서 `IMAGE_FIG` 폴더 전수 검색 + 그림 2건 부모 폴더 확인

> **이 Phase의 성격**(v1·v2 그대로): 서버는 여전히 **읽기만** 한다(`spreadsheets.readonly` 불변). Firestore 스키마는 **선택 필드 2개 추가**(마이그레이션 0 · 규칙 0 — C2). 세 레포에 걸치지만 **교차 파일 쓰기는 없다**.
> 연결 작업이 끝난 뒤 **색인 누락 1건(`25X모의12_1공통20` = D5008) 보충을 잊지 말 것**(§9-1).

---

## 부록 B. v2 → v3 변경 요지 (먼저 읽을 것)

### B-1. 정정 (F) — 실측으로 확인된 것

| # | v2 자리 | 문제 | v3 |
|---|---|---|---|
| F1 | §1-3 파일키 생성 | 인용 `crop-image-insert.gs:251`은 NFC 줄(`const name = cropNfc_(f.getName())`)이다 | 파일키 조립은 **`:255`** `fileKey = \`${cropCanonExamName_(exam)}_${code}${subj}${String(no).padStart(2,'0')}\`` — 번호는 색인 생성 때 이미 2자리라 `jb_canonKey_`의 패딩은 멱등(F9) |
| F2 | §1-1 모달 | `PreviewItem :40-56` · 후처리 `:379-402` · M체크 `:714` | **`:59-70`** · **`:371-402`**(`rowToDraft` `:371` · `stripInvisibles` `:387` · `dupeKey` `:402`) · **`:716`** |
| F3 | E7 · Q2 · V13 | "A 있고 E 빈 행이 생긴다"는 코드상 가능하지만 **실측 0건**(6,303행 중 A 있고 E 빈 행 0 · K `FAIL…` 0). `writeNormResult_`(`normalizeProblem.gs:303-311`)가 실패 시에도 E에 `r.stem` 원문을 보존하므로, E가 비는 것은 stem 자체가 없을 때뿐 | **Q2(배지 + 기본 체크 해제)를 범위에서 뺀다**(R1). 기존 `rowToDraft` 경고('E열(문제 본문)이 비어 있습니다' `:437`)가 이미 보이므로 모달·서버 변경 0. V13 삭제 |
| F4 | V3·V3′ | "채움 행 ≥ 1,444 · 형식 아님 ≈ 4,488 · 모호 ≤ 1"은 추정 | **시뮬레이션 확정값**(§6 V3): 채움 **= 1,444**(canon 키마다 Data_DS 행이 정확히 1개) · 형식 아님 **= 4,488**(2~4489행 전부 — `연구실01회조판1_1공통01`·`BELL25FS01조판1_…` 등 옛 경로) · 색인에 없음 **= 371**(24년 홀수 모의X 8세트 368 + `24X모의06` 1 + `25X모의12` 1(= D5008) + `26X모의12` 1(stray)) · 모호 **0** · 색인 ID 형식 불량 **0** · 색인 ✅ 미사용 **0** · ✅ 고유 ID 1,444 |
| F5 | D9 · V1 | "경로 ≠ 폴더 ID, 같은 이름 폴더 둘일 수 있다"는 가능성 | **실측 종결**: Drive 전체에 `IMAGE_FIG` 폴더 **1개**(`1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`, 2026-08-30 생성 · 부모 `1ydC151x…` = PBMAI) · Latex 변환 C열 그림 2건(`1xKK0fBT…`·`1dEOjEJW…`, 2026-10-30 업로드)의 부모가 그 폴더. → **D9 조건부 분기 철회**(R2). 남는 확인은 Vercel `AUDITION_FIG_FOLDER_ID` 값이 `1C1_6…`인지 1회(V1′) |
| F6 | D3 · Q4 · V9-0 | "표본 5건 사전 대조" 예정 | **전수 대조로 대체·완료**: 문제 검토 Stack 5,746행 중 Latex 변환 키와 겹침 **4,953** · E(정규화 후) 동일 **4,918** · 다름 **35**(0.7%) — 그중 **34건이 `S팀.X05` 한 세트**(Stack 쪽 E 끝에 `(1) 6 … * 메모 : [조건 수정]` 꼬리가 남아 있고 Latex 변환 쪽은 뒤에 재정규화돼 잘린 모양) + `HAJI.26FS03.초고` 1. 문제 검토 **Data_DS는 지금 비어 있다**(헤더뿐 · 서식 행 5,066). **대량변환 v4 1,815문항은 아직 문제 검토를 거치지 않았다**(겹침 0). → D3 유지, "재정규화 뒤 갈린다"는 v2 주석이 실측으로 확인됨. Q4 **완료 처리**(R3) |
| F7 | B1 · §1-2 | "Data_DS 쪽 `nfc_`가 이미 NFC" — 그 `nfc_`는 `링크&파일명 추출(키워드).gs:7`·`:49`에 **같은 파일 안에 두 번** 정의돼 있다(BACKLOG "GAS 전역 이름 중복") | `JangbuId.gs`는 **자체 `jb_nfc_`**를 쓴다(v2 §5-1 그대로) — 이유를 명기 |
| F8 | D8 · §5-1 | `LockService.getDocumentLock()` | 레포 관례는 **전부 `getScriptLock()`**(`Pipeline.gs:279` · `OcrConvert.gs:104`·`:214` · `Mathpix 그림 추출.gs:403` · `Mathpix 범위 자동변환.gs:361`). 파이프라인과 **같은 락**이어야 상호 배제가 된다 → `getScriptLock().tryLock(10000)` |
| F9 | E3 | `cropKeyAliases_[0]`의 `rest`는 패딩 없이 원문 그대로 | 맞다. 색인 쪽은 `:255`가 이미 2자리, Data_DS 쪽 CroP 이름도 2자리(`CROP_FILE_RE` `(\d{1,2})`이지만 실측 1,815행 전부 2자리) → `jb_canonKey_`의 `padStart(2)`는 **안전망**이지 변환이 아니다 |
| F10 | D4 | "N의 `ID` 머리글은 잔재" | 문제 검토 Data_DS·Stack의 N 머리글은 **`problem_verdict`**(xlsx 실측 · `tests/sheetImport.test.mjs:83` REAL_HEADER 동일). Latex 변환 N의 `ID`는 그 잔재가 **아니라 별개 머리글**(값 0건, 쓰는 코드 0). 결론(M·N 안 쓴다)은 같고 근거 문구만 정정 |

### B-2. 보완 (C)

| # | 내용 | 자리 |
|---|---|---|
| C1 | 모달 M체크 힌트 둘째 줄 "⚠ Data_DS는 검증을 새로 돌릴 때마다 M열 체크까지 비워집니다"(`:720`)는 **'문제 검토 : Data_DS'일 때만** 보인다(라벨이 셋이 되면 어느 Data_DS인지 흐려진다) | §5-6 |
| C2 | Firestore 규칙 `problems` 블록(`firestore.rules:67~`)에 데이터 키 화이트리스트(`hasOnly`·`keys()`)가 **없다** → `import_source`에 선택 필드를 더해도 규칙 변경 0. v2는 "규칙 0"이라고만 했고 근거가 없었다 | §4 |
| C3 | '문제 검토' 파일 ID `1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk`(Drive 실측 · `AUDITION_SPREADSHEET_ID`와 같은지 Vercel에서 1회 확인) · 시트 11개(`선택항목·Data1·Data_Latex·split_46·split_38·split_12·split·Data_DS·Stack·Stat·pmt·Pipeline_Log`) | §1-3 |
| C4 | 백필 알림의 "형식 아님 4,488"은 **옛 경로 행(연구실·BELL·QULUP·SSUM·MOBI…)이라 정상**이라는 안내 문구를 알림에 넣는다 — 안 넣으면 매번 오류로 읽힌다 | §5-1 ⑥ |
| C5 | `_CroP색인` 헤더 실측 = `파일키·문항ID·시트·행·사용세트식별·문서URL·문제파일ID·해설파일ID(순서대로)·해설조각수·상태·메시지·처리시각` — `JB.IDX_KEY 1 · IDX_ID 2 · IDX_STATUS 10` 일치 | §5-1 |
| C6 | `unmatched` 안내 문구: "문항장부에는 있지만 Latex 변환 L열이 비어 있는 ID(예: 색인 누락 D5008, 아직 변환 안 된 S####)일 수 있습니다" — 사용자가 오타로만 읽지 않게 | §5-6 |
| C7 | V9-0 절차를 **재현 가능한 스크립트**로 남긴다: 두 파일 xlsx 내보내기 → A열 교집합 → E `normalize('NFC')`·CRLF·trim·빈 줄 3+→2 정규화 뒤 비교. 결과(F6)는 §6에 기록. 코드 자체는 레포에 넣지 않는다(1회성) | §6 |
| C8 | 문제 검토 Stack 키 접두는 `QULUP.26FS01`·`SSUM.26FS01`·`MOBI.26FS03.`·`S팀.X05`·`BELL25FS01조판1` 등 — 24~26년 X 세트가 문제 검토를 거치면 **같은 CroP 이름 그대로** 복사된다(`Pipelineverify.gs:794→:819`) | §1-3 |

### B-3. 추가 결정 R1~R6 — 권장안 (덕수 확정 대기)

| # | 결정 | 권장 | 근거 |
|---|---|---|---|
| R1 | Q2("본문 없음" 배지 + 기본 체크 해제)를 유지할지 | **철회**(범위 밖·§9-2) | 실측 0건(F3). 기존 경고로 충분. 구현 0 |
| R2 | D9 조건부 분기(`LATEX_FIG_FOLDER_ID`·`&source=`)를 남길지 | **철회** · V1′(Vercel 값 1회 확인)만 | 폴더가 1개뿐(F5) |
| R3 | Q4 표본 5건 사전 대조 | **완료 처리**, 0.7% 차이(한 세트) 수용 | F6. 같은 문항이 두 벌 들어오는 손실은 알려진 것 |
| R4 | 백필 알림에 "색인에 없음 371"을 어떻게 보일지 | **세트별 집계**(`24X모의01 46 · … · 26X모의12 1`) + 앞 10개 키 | 371줄 나열은 읽히지 않고, 세트별이면 "24년 홀수 8세트 미등록"이 한눈에 보인다 |
| R5 | `jb_backfillFromLedger` 실행 범위 | **전 행**(2~lastRow) 1회 읽기 유지 — 4490부터로 좁히지 않는다 | 형식 아님 4,488은 정규식 한 번이라 비용 0. 좁히면 옛 행이 나중에 CroP 이름으로 바뀌었을 때 빠진다 |
| R6 | `ImportSource.file` 유니온 | v2대로 **`'latex'`만** | Q5 귀결. 셋째 파일이 오면 그때 넓힌다 |

### B-4. v2 주장 중 그대로 확인된 것(재검토 불필요)
E1(`REAL_HEADER` L=`''` `:80-84`) · E4(H1~H3 `:86·:90·:97`) · E5(`route.ts:119-124` 순서 · `:101` 하드코딩) · E6(`Pipelineverify.gs:794→:818→:819` · `Movetostack.gs:166`) · E8(`lib/firestore.ts:31-36` 최상위만) · E9 · B4(`import_source` 참조 = `types/problem.ts:41·:108` · 모달 `:31·:353·:360·:454·:472`뿐) · B5(`CLAUDE.md:1578` "4종" · `.env.example` 없음) · B7(`SPlit12->Data_DS에 기록.gs:26`) · Q1(`generateIdsInColumnA.gs:58`) · `cropParseExam_ :107` · `cropMakeCanon_ :130` · `cropKeyAliases_ :161` · `cropNormKey_ :568` · `cropNfc_ :661` · `Pipeline.gs:436-453 · :566 · :614 · :774` · `normalizeProblem.gs:310` · `DLDS.DST :48` · `Mathpix 그림 추출.gs:36·:50` · `Itemverification.gs:137-138` · `figure/route.ts:56·:105·:133·:165` · `package.json:34`.

---

## 0. 요약

지금 시트 가져오기는 '문제 검토' 파일의 Data_DS·Stack 두 시트만 읽는다(`route.ts:29` `SHEETS`, 환경변수 `AUDITION_SPREADSHEET_ID` 하나). 이번 Phase는 세 겹이다.

1. **원본 확장(안 (1))** — 원본 항목을 **'문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS'** 셋으로. 서버는 `source`(파일)+`sheet`로 어느 스프레드시트를 읽을지 고른다. 환경변수 `LATEX_SPREADSHEET_ID` 신설.
2. **데이터 연결(1층)** — Latex 변환 Data_DS **L열 `jangbu_id`**(문항장부 A열 ID, `D####`·`S####`)를 GAS 메뉴로 백필한다. 소스는 문항장부 `_CroP색인`(✅ 1,444건 · 대상 행 4490~6304). Mathory는 L열을 읽어 `ImportSource.jangbu_id`에 남긴다.
3. **선택 → 전달(2·3층)** — 문항장부 문제검색에서 체크한 ID를 수식 한 셀이 쉼표 목록으로 모으고, Mathory 모달의 **"문항장부 ID 목록"** 칸에 붙여 넣으면 서버가 L열로 행을 고른다(기존 행 범위·M체크와 **합집합**).

변경 파일 — mathory: `app/api/sheet-import/route.ts` · `lib/sheetImport.ts` · `types/problem.ts` · `components/import/SheetImportModal.tsx` · `tests/sheetImport.test.mjs` · `CLAUDE.md`. latex-convert GAS: **신규** `JangbuId.gs` · `MainMenu.gs`(항목 1). 문항장부: 문제검색 시트 **수식 2개 + 메모 1개**(GAS 0). **Firestore 규칙 0(C2) · 그림 프록시 0(F5 확정) · 저장 경로 0 · 중복 판정 0 · `problem-ledger` GAS 0 · 문제 검토 파일·`gas-project-audition` 0.**

---

## 1. 현행 — 실측

### 1-1. mathory (`20783a8`)

| 항목 | 자리 | 현행 |
|---|---|---|
| 원본 시트 집합 | `route.ts:29` | `SHEETS = ['Data_DS','Stack']` · 범위 `${sheet}!A1:P`(`:95`) · 스프레드시트 ID는 `AUDITION_SPREADSHEET_ID` 하나(`:48`) · `maxDuration 30`(`:27`) |
| 호출 순서 | `route.ts:119-124` | **`readEnv()` → `verifyUid(env.apiKey, env.allowedUids)` → body 파싱**. source를 알기 전에 env를 다 읽는다(E5) |
| 요청 본문 | `route.ts:6` · `:127` · `:132` | `{ sheet, rows?, includePreselected? }` · 시트 아니면 400 · 둘 다 비면 400 |
| 행 선택 | `route.ts:154` · `:158` · `:141` | `wantedSet.has(rowIndex) \|\| (includePreselected && M체크)` 합집합 · A·E 둘 다 빈 행만 스킵 · 헤더 검사 |
| 응답 | `route.ts:7` · `:168` · `:33`·`:170` | `{ header, headerWarnings, rows:[{rowIndex, cells[16]}] }` · 4MB 상한 |
| 열 매핑 | `lib/sheetImport.ts:17-35` | 0-based 16열. **K(10)·L(11)·N(13)은 매핑에 없다** |
| 헤더 검사 | `:41-55` · `:138-151` | `EXPECTED_HEADERS` 13키 고정. 키 `solution_note`의 기대값은 시트 오타 **`'sloution_note'`**(`:54`) |
| 초안 변환 | `:423` `rowToDraft` | A→title/source/sourceId(`:424`) · E 비면 **경고만**(`:437`) · `stemHash`는 분할 전 E(`:440`) |
| 그림 참조 | `:195-218` `FIG_SCAN_RE` | 구형 `\includegraphics{}` + 신형 `![파일명](https://drive.google.com/…)` — Latex 변환 C열 형식과 **이미 호환** |
| 그림 프록시 | `figure/route.ts:56` · `:105` · `:133` · `:165` | `?name=` → `AUDITION_FIG_FOLDER_ID` 폴더 안 이름 검색 · `?url=` Mathpix CDN |
| 출처 기록 | `types/problem.ts:108-116` | `ImportSource { provider:'audition-sheet', sheet, row, source_id, stem_hash, imported_at }` |
| `import_source` 소비처 | `types/problem.ts:41` · 모달 `:31`·`:353`·`:360`·`:454`·`:472` | **중복 집합뿐**(`:95` `dupeKey`). 라벨·배지로 `sheet`를 읽는 곳 0 |
| `createProblem` | `lib/firestore.ts:31-36` | **최상위** undefined만 제거(E8) |
| Firestore 규칙 | `firestore.rules:67~` | `problems`에 데이터 키 화이트리스트 없음(C2) |
| 모달 상태 | `:258-260` · `:269` · `:312` | `sheet` 기본 `'Stack'` · `includePreselected` 기본 true · `canSubmit = rowsText.trim() !== '' \|\| includePreselected` |
| 모달 요청·저장 | `:344-347` · `:454-461` | body 3필드 · `importSource.sheet = fetchedSheet` |
| 미리보기 후처리 | `:371-402` | `rowToDraft`(`:371`, stemHash 확정) → `stripInvisibles`(`:387`) → `tidyBlocks` → `dupeKey`(`:402`). `jangbu_id`는 본문이 아니라 무관 |
| `PreviewItem` | `:59-70` | `rowIndex·draft·error·persisted·figNames·autoFixCount·dupe` — **`cells` 없음** → `jangbuId` 보관 필드 추가 필요 |
| 설정 화면 | `:652` FormPane · `:716` M체크 · `:720` Data_DS 힌트 | 원본 버튼 행 · 행 범위 · M체크 · 정돈 체크박스 |
| 테스트 | `package.json:34` `test:sheet` | 단독 tsc(import 0) + `tests/sheetImport.test.mjs`(R·N·**H1~H3**·D·S·L·F·G 군) |
| 환경변수 문서 | `CLAUDE.md:1578` | "환경변수 4종" — `.env.example` 없음 |

### 1-2. 'Latex 변환' 파일 Data_DS (xlsx 2026-11-05 · GAS `3cc4694`)

| 항목 | 실측 |
|---|---|
| 헤더 | A~K `id · problem · given_solution · given_answer · problem_stem · choice1~5 · answer_type` · **L 없음 · M `get` · N `ID` · O·P 없음** |
| 값 | 데이터 2~6304행(6,303). **L·M·N 전부 0건**. **A 있고 E 빈 행 0 · K `FAIL…` 0**(F3) |
| 키 형식 | **4490~6304행(1,815) 전부 CroP 이름**(`24서킷X05_3확통29` 류 · 번호 2자리) · **2~4489행(4,488) 전부 비-CroP**(`연구실01회조판1_1공통01`·`BELL25FS01조판1_…` — 옛 Split 경로 `SPlit*->Data_DS에 기록.gs:26`) |
| 쓰는 코드 | `Datalatex_To_Data_DS.gs:48`(DST A·B·C·D·K) · `normalizeProblem.gs:38`(OUT E~J·K) · `Pipeline.gs:566` `pl_stageSend_`(A:C 청크 `:614`) · Split 3종(A:C) — **L~P를 쓰는 코드 0** |
| 파이프라인 단계 | `Pipeline.gs:436-453` | send(A:C) → normalize(E~J·K) → answer(D) → archive. 실패 시 `writeNormResult_`(`normalizeProblem.gs:303-311`)가 E에 원문 보존·K에 사유 |
| 키 정규화 | `dlds_parseFilename_`(`:199`) | `nfc_`(`링크&파일명 추출(키워드).gs:7`·`:49` 중복 정의) → 확장자 제거 → `_문제`/`_해설` 제거 |
| 성격 | 누적형(append, 비워지지 않음) |
| 그림 | C열 `![파일명](Drive링크)`(패치 11) · 폴더 `PBMAI/IMAGE_FIG`(`Mathpix 그림 추출.gs:50`, 속성 `MPF_FIG_FOLDER_PATH`, 없으면 만듦 `:36`) — **실측: Drive에 `IMAGE_FIG` 폴더 1개뿐 `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`**, 그림 2건 부모 일치(F5) |
| 메뉴·가드·락 | `MainMenu.gs` `onOpen` · `pl_isBusy_()`(`Pipeline.gs:774`) · 락 관례 `LockService.getScriptLock()`(`Pipeline.gs:279` 외 4곳) |

### 1-3. 문항장부 ↔ 문제 검토 파일

| 항목 | 실측 |
|---|---|
| `_CroP색인` | 15열(`CROP_IDX` `crop-image-insert.gs:86-93` · 헤더 실측 일치 C5). 1,815행. ✅ 1,444 / ❌ 371. ✅ 고유 ID 1,444 · ID 형식 불량 0 · 모호 키 0 |
| 파일키 조립 | **`:255`** `fileKey = ${cropCanonExamName_(exam)}_${code}${subj}${no.padStart(2,'0')}` — 과목 글자(공통·확통·미적·기하) 포함 · 번호 2자리 |
| 표준형 함수 | `cropParseExam_`(`:107`) · `cropMakeCanon_`(`:130`) · **`cropKeyAliases_`(`:161`, `[0]` = 표준)** · `cropNfc_`(`:661`). `cropNormKey_`(`:568`)는 시트 매칭키 — 쓰지 않는다 |
| ❌ 371 | 24년 홀수 모의X 8세트 368 + `24X모의06` 1 + `25X모의12_1공통20`(D5008 실재, 색인 누락) + `26X모의12_4미적28`(stray) — 백필 시뮬레이션 "색인에 없음 371"과 **1:1** |
| 문제검색 | A~R = `FILTER(Data!A2:R…)` · U열 `선택` 체크박스 3,443개 · S열 빈 열 · T2 죽은 수식 |
| ID 형식 | `generateIdsInColumnA.gs:58` `D${n.padStart(4,'0')}` — `S####`는 덕수 예정(코드 0) |
| 문제 검토 파일 | ID `1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk`(C3). Data_DS·Stack N 머리글 **`problem_verdict`**(F10). **Data_DS는 현재 비어 있음** · Stack 5,746행 |
| 문제 검토 ← Latex 변환 | `Pipelineverify.gs:794`(A~K 읽기) → `:818`(A~AC 클리어) → `:819`(A~K 쓰기) · Stack은 `mts_core_`(`Movetostack.gs:166`). **실측**: Stack 5,746 중 Latex 변환 키 겹침 4,953 · E 동일 4,918 · 다름 35(`S팀.X05` 34 + 1) · v4 1,815문항 겹침 **0**(아직 미검증) |

---

## 2. 덕수 결정 (2026-11-05) → 요구사항

| # | 결정 | 반영 |
|---|---|---|
| 1 | 원본 확장은 **안 (1)** | D1·D2 · §5-3·5-6 |
| 2 | 연결 키는 **문항장부 A열 ID** | D4 |
| 3 | 문항장부 바운드 GAS clasp 확보 — 이 Phase에서 수정 0 | §5-9 |
| 4 | 미등록 문항은 **`S####`로 등록 예정** | D5 · 백필 멱등 |
| 5 | D5008 색인 누락은 **작업 종료 후 보충** | §9-1 |
| 6 | 문제검색 선택 수식은 U열 기준 | §5-2 |
| 7 | v2 Q1~Q8 전항 권장안 | 유지. 단 **Q2·Q4는 v3 실측으로 재검토**(R1·R3) |
| 8 | v3 R1~R6 | **대기** |

---

## 3. 결정 사항

### D1 — 원본 식별은 `source`(파일) + `sheet`(시트) 두 축 (확정)
- API body: `{ source?: 'audition' | 'latex', sheet: 'Data_DS' | 'Stack', rows?, includePreselected?, jangbuIds?: string[] }`. **`source` 생략 = `'audition'`**.
- `SOURCES = { audition: { envId: 'AUDITION_SPREADSHEET_ID', sheets: ['Data_DS','Stack'] }, latex: { envId: 'LATEX_SPREADSHEET_ID', sheets: ['Data_DS'] } } as const`. 조합이 표에 없으면 400.
- **환경변수 읽기 순서(E5)**: `readEnv()`는 공통 4종만 필수, `sheetIds: { audition?, latex? }`는 선택(정리 `trim().replace(/^\/+|\/+$/g,'')` 둘 다). `verifyUid` 뒤 body의 `source`로 `env.sheetIds[source]`가 없으면 `ApiError(500, '서버 환경변수가 설정되지 않았습니다: <envId>')`. `readSheet(sheet, sheetId, envId)` — 404 문구가 `envId`를 쓴다(`:101`).

### D2 — `ImportSource`에 선택 필드 2개, 마이그레이션 0 · 규칙 0 (확정 · C2)
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
- ⚠ **조립은 조건부 스프레드**(E8) — `buildImportSource`(§5-4)가 소유. `file: undefined`를 넣으면 `createProblem`이 못 걸러 저장이 실패한다.

### D3 — 중복 판정은 그대로 `source_id|stem_hash`, 파일 무관 (확정 · F6 실측)
- 문제 검토 Data_DS A~K는 Latex 변환 A~K의 복사본, Stack은 그 이동본 → 같은 문항은 `source_id`·`stem_hash`가 같다. **실측 4,918/4,953 동일(99.3%)**, 다른 35건은 한 세트(`S팀.X05`)의 재정규화 꼬리.
- 알려진 손실: Latex 변환 쪽을 재정규화하면 E가 바뀌어 새 문항으로 들어온다(현행과 같다). 안 바꾼다.

### D4 — 연결 열은 Latex 변환 Data_DS **L열, 머리글 `jangbu_id`** (확정 · F10)
- L은 머리글·값 0, Mathory·GAS 어느 쪽도 읽지 않는다. **M(`get`)·N(`ID`)은 쓰지 않는다** — 문제 검토 배치에서 M은 체크박스, N은 `problem_verdict`(`Itemverification.gs:6` STEP 1 → N) 자리라 같은 `SHEET_COL`을 두 파일에 쓰는 전제가 깨진다. Latex 변환 N의 `ID` 머리글은 값 0건·쓰는 코드 0인 별개 머리글(그대로 둔다).
- `SHEET_COL.jangbu_id = 11`. `rowToDraft` **무변경** — 모달이 `cells[11]`을 읽는다.
- 헤더 검사: `checkHeaders(header, profile = 'audition')`. latex 프로파일은 `EXPECTED_HEADERS_LATEX`(A~K + L `jangbu_id`)만 보고 M·O·P는 검사하지 않는다. 백필 전에는 L 경고 1건이 정상(HL1), 백필 ⑤가 머리글을 쓰면 0건(HL2).

### D5 — ID 형식 `^[DS]\d{4,5}$` · 정규화 (Q1)
- `parseJangbuIds(text): { ids; invalid }` — 쉼표·공백·줄바꿈·세미콜론, trim, `normalize('NFC')`, 대문자화, 중복 제거, 순서 유지. `JANGBU_ID_RE`·`JANGBU_ID_MAX = 500` export.
- 서버는 같은 함수로 재검증, invalid는 버리고 진행(B8). 유효 ID 500 초과면 400.

### D6′ — 합집합 · 최소 하나 · `jangbuIds`는 latex 전용 (E1)
- `source !== 'latex'`인데 `jangbuIds`가 비어 있지 않으면 **400**.
- 선택식: `wantedSet.has(rowIndex) || (includePreselected && M체크) || (jangbuSet.size > 0 && jangbuSet.has(normId(cells[11])))` — `normId = s.trim().normalize('NFC').toUpperCase()`.
- 셋 다 비면 400. 응답 `unmatched: string[]`(요청 순서). 매칭 0이어도 200. 옛 호출도 `unmatched: []`.
- 같은 ID가 L열에 둘 이상이면 전부 포함 — D3가 거른다. (실측: 지금은 canon 키마다 1행 — F4)

### D7 — 'Latex 변환 : Data_DS'에서는 M체크 옵션을 숨긴다 (확정)
- latex면 `includePreselected` false 고정·UI 숨김. 서버 분기 없음. 기본 선택은 '문제 검토 : Stack'. Data_DS 비워짐 힌트는 '문제 검토 : Data_DS'일 때만(C1).

### D8 — 1층 백필은 Latex 변환 GAS 메뉴 1개 (확정 · F7·F8·R4·R5)
- `JangbuId.gs` `jb_backfillFromLedger()`: 문항장부를 `openById`로 **읽어** `_CroP색인` 전체 1회 `getValues`, Data_DS A·L 1회 읽기(전 행 — R5), **표준 파일키**로 짝짓는다.
- 표준 파일키 = `cropKeyAliases_(key)[0]`의 이식(E3) + 뒤 부분 `^(\d)(공통|확통|미적|기하)(\d{1,2})$` 2자리 패딩(안전망 — F9). 양쪽 키에 같은 함수. 자체 `jb_nfc_`(F7).
- 상태 ✅만. L 빈 행만(스크립트 속성 `JB_OVERWRITE === 'true'`면 덮어씀 — Q6). 모호 키는 건너뛰고 보고(Q3 — 실측 0).
- 가드: `pl_isBusy_()` → 거부 · **`LockService.getScriptLock().tryLock(10000)`**(F8) 실패 → 거부.
- 결과 **알림 1장 + Logger**: 채움 · 이미 있음 · 형식 아님(**"옛 경로 행 — 정상"** 문구, C4) · 색인에 없음(**세트별 집계** + 앞 10개 키, R4) · 모호 · 색인 ID 형식 불량 · 색인 ✅ 미사용.
- 접근권한: 실행 사용자(덕수)가 문항장부 편집자. 서비스 계정 무관.
- 후속(§9-2): `pl_stageSend_` 끝 자동 채움(Q7).

### D9 — 그림 프록시는 **그대로** (확정 · F5 실측 종결)
- Drive에 `IMAGE_FIG` 폴더가 1개뿐이고 Latex 변환 그림의 부모가 그 폴더 → `AUDITION_FIG_FOLDER_ID` 하나로 두 파일의 그림을 다 찾는다. 조건부 분기(`LATEX_FIG_FOLDER_ID`·`&source=`) **철회**(R2). V1′: Vercel 값이 `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`인지 1회 확인.

### D10 — 서비스 계정 권한·환경변수 (덕수 작업)
- Latex 변환 파일(`1wu8GdvmpyxCqSKS5RiSlRhWGH4B2OMoPN0TGP94ti54`)에 `GOOGLE_SA_EMAIL`을 **뷰어**로 공유. Vercel(Production·Preview)·`.env.local`에 `LATEX_SPREADSHEET_ID`. C 단계 배포 **전**. `AUDITION_ALLOWED_UIDS` 그대로.

### D11 — 2층은 문항장부 **수식 2개 + 메모 1개**, GAS 0 (확정 · B3)
- 문제검색 **W1**: `=IFERROR(TEXTJOIN(",",TRUE,FILTER(A2:A, U2:U=TRUE)),"")` · **X1**: `=IF(COUNTIF(U2:U,TRUE)>500,"⚠ 500개 초과 — 나눠서","선택 "&COUNTIF(U2:U,TRUE)&"개")` · V1 라벨 `선택 ID →` · V1 노트(검색 조건 바꾸기 전 체크 해제). T2 삭제.

---

## 4. 현행 규약 충돌 점검

| 규약 | 판정 |
|---|---|
| 서버는 시트를 **읽기만**(`route.ts:9-11`) | 유지 |
| `lib/sheetImport.ts` **import 0**(`:3-6`) | 유지 — `parseJangbuIds`·`checkHeaders(profile)`·`buildImportSource`는 순수. `ImportSource` 모양은 로컬 정의(B9) |
| Firestore 저장은 클라의 기존 CRUD · 규칙 | 유지 — `problems` 규칙에 키 화이트리스트 없음(C2) |
| 중복 판정 `source_id+stem_hash`(`types/problem.ts:101-105`) | 유지(D3 · F6) |
| 열 위치가 진실, 헤더는 경보(`sheetImport.ts:12-16`) | 유지 |
| GAS 열 하드코딩(열 끼우기 금지) | 준수 — 빈 열에 값만 |
| 문제 검토 Data_DS는 검증마다 비워진다(`Pipelineverify.gs:818`) | 영향 없음 |
| `_CroP색인`·`crop-image-insert.gs` | 읽기만 |
| 락 관례 `getScriptLock()` | 준수(F8) |

---

## 5. 구현 항목

### 5-1. latex-convert GAS — 신규 `JangbuId.gs` + `MainMenu.gs` 항목 1
```js
const JB = {
  LEDGER_ID: '1hlnZEB-v6MQ7FpkaZigblmAYy5_LBH6kqH6mflQRrj0',
  INDEX_SHEET: '_CroP색인', IDX_KEY: 1, IDX_ID: 2, IDX_STATUS: 10,   // = crop-image-insert.gs CROP_IDX (헤더 실측 일치)
  DST_SHEET: 'Data_DS', COL_KEY: 1, COL_JANGBU: 12 /* L */, HEADER: 'jangbu_id',
  OVERWRITE_PROP: 'JB_OVERWRITE',                                      // 'true'일 때만 덮어쓴다(Q6)
  ID_RE: /^[DS]\d{4,5}$/,                                              // Q1
  LOCK_MS: 10000,
};
```
- `jb_nfc_(s)` — `String(s == null ? '' : s).normalize('NFC')`(F7 — 레포의 `nfc_`는 중복 정의라 쓰지 않는다).
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
- `jb_backfillFromLedger()` — ① `pl_isBusy_()` → 거부 · `LockService.getScriptLock().tryLock(JB.LOCK_MS)` 실패 → 거부 ② 색인 1회 읽기 → `Map<canon, Set<ID>>`(✅만 · ID trim·대문자 · ID_RE 불일치 `idBad++`) ③ Data_DS A·L 1회(`lastRow = dlds_lastDataRow_(sh, 1)`) ④ 행마다: L 있고 덮어쓰기 아님 → `already++` / canon null → `notCrop++` / 맵에 없음 → `noIndex++`(세트별 집계) / Set ≥ 2 → `ambiguous` / 아니면 채움 ⑤ L 범위 1회 `setValues`(읽은 `lastRow`까지) + L1 비었으면 `jangbu_id` ⑥ `ui.alert` + `Logger.log`:
  `채움 n · 이미 있음 n · 형식 아님 n(옛 경로 행 — 정상) · 색인에 없음 n(세트별: 24X모의01 46 · … / 앞 10개 키) · 모호 n · 색인 ID 형식 불량 n · 색인 ✅ 미사용 n(앞 10개)`. `finally`에서 `lock.releaseLock()`.
- `MainMenu.gs`: `pipeline_sheetcheck_menu` 아래 구분선 뒤 **'🔗 문항장부 ID 채우기 (Data_DS L열)'**. `RemoteApi.gs` 무변경.
- latex-convert 레포 커밋 · `clasp push`.

### 5-2. 문항장부 시트 — 수식 2개 + 메모(수동 · GAS 0)
- D11 그대로.

### 5-3. `app/api/sheet-import/route.ts`
- `SOURCES` 표 · `readEnv()` → `{ email, key, apiKey, allowedUids, sheetIds }`(E5).
- body: `source`(기본 `'audition'`, 표 밖 400) · `sheet`(source의 `sheets` 밖 400, 문구에 source 라벨) · `jangbuIds`(배열 아니면 `[]`; `parseJangbuIds(arr.join(',')).ids`, B8) · source≠latex & ids≥1 → 400(E1) · ids>500 → 400.
- `sheetId = env.sheetIds[source]` 없으면 500 + envId · 최소 하나(D6′) · `readSheet(sheet, sheetId, envId)` · `checkHeaders(header, profile)` · 합집합 · `unmatched` · 응답 `{ header, headerWarnings, rows, unmatched }`.
- 헤더 주석(`:1-18`) 갱신. `maxDuration`·`MAX_PAYLOAD_BYTES` 유지.

### 5-4. `lib/sheetImport.ts`
- `SHEET_COL.jangbu_id: 11` + 주석. `EXPECTED_HEADERS_LATEX`(A~K 11키 + `jangbu_id`). `checkHeaders(headerRow, profile = 'audition')`.
- `JANGBU_ID_RE` · `JANGBU_ID_MAX` · `parseJangbuIds`.
- `buildImportSource(args: { file: 'audition' | 'latex'; sheet; row; sourceId; stemHash; jangbuCell?: string; now: number })` → 로컬 `ImportSourceShape`(`types/problem.ts` `ImportSource`와 같은 모양 — 주석으로 짝). audition이면 `file`·`jangbu_id` 키 자체 없음, latex면 `file: 'latex'` + 정규화한 셀이 ID_RE에 맞을 때만 `jangbu_id`(B9·E8).
- `rowToDraft` 무변경.

### 5-5. `types/problem.ts`
- D2의 두 줄 + 주석.

### 5-6. `components/import/SheetImportModal.tsx`
- `type SourceKey = 'audition:Data_DS' | 'audition:Stack' | 'latex:Data_DS'` · `SOURCES` 3항목(라벨 '문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS' · 셋째 힌트 "대량 변환 누적본 · 문항장부 ID로 고를 수 있음").
- 상태 `sourceKey`(기본 `'audition:Stack'`) · `jangbuText` · `fetched: { file, sheet }`. latex면 `includePreselected` false 고정·UI 숨김(D7). Data_DS 비워짐 힌트(`:720`)는 `'audition:Data_DS'`일 때만(C1).
- `canSubmit = rowsText.trim() !== '' || (file === 'audition' && includePreselected) || (file === 'latex' && parsed.ids.length > 0)`.
- FormPane(latex): **"문항장부 ID 목록"** textarea(placeholder `D5006, D5008 …` · 힌트 "문제검색 W1을 붙여넣으세요 · S#### 가능 · 최대 500개") · `invalid` 경고.
- fetchRows: body `source`·`sheet`·`jangbuIds`(latex만). `unmatched`가 있으면 경고 1줄 + **C6 문구**("문항장부에는 있지만 Latex 변환 L열이 비어 있는 ID일 수 있습니다").
- `PreviewItem`에 `jangbuId: string | null` 추가(`cells[SHEET_COL.jangbu_id]`, latex만). 미리보기 행 머리 배지 `D5006`(읽기 전용).
- saveOne: `buildImportSource({ file: fetched.file, sheet: fetched.sheet, row, sourceId, stemHash, jangbuCell: item.jangbuId ?? undefined, now: Date.now() })`.
- ~~Q2 배지·체크 해제~~ — R1(철회 권장).

### 5-7. 환경변수·배포 (덕수)
- D10. V1′(Vercel `AUDITION_FIG_FOLDER_ID` = `1C1_6…` 확인). C3(`AUDITION_SPREADSHEET_ID` = `1hrvhHVR…` 확인).

### 5-8. 테스트·문서
- `tests/sheetImport.test.mjs`: **J1** `parseJangbuIds` 구분자 4종·대문자화·NFC·중복 제거·순서·invalid · **J2** 빈 입력 · 5자리 허용 · `D123`·`X9999`·`D123456` invalid · **HL1** latex 프로파일 백필 전(L `''`) 경고 1건·M·N 무시 · **HL2** 백필 후 0건 · 기존 H1~H3 불변 · **I1** `buildImportSource` audition 키 없음 / latex 정상 / ` d5006 `→`D5006` / `X1`→키 없음.
- CLAUDE.md: 파일 구조 줄 2곳에 "(Phase 72 …)" · 핵심 패턴에 **D4(L열 · N은 problem_verdict 자리) · D3(두 파일 A~K 복사본 · 99.3% 실측) · E8(중첩 undefined)** · `:1578` "4종"→**5종** · `test:sheet` 개수.
- 완료 시 확정본을 `docs/phasedocs/` · roadmap · 작업물 `docs/phaseSketch/_archive/Phase72/`.

### 5-9. 건드리지 않는 것
- `figure/route.ts`(F5로 확정) · `lib/apiAuth.ts` · `createProblem`/`saveTabBlock` · Firestore 규칙 · `rowToDraft`·`splitFigures`·`stemHash`·`FIG_SCAN_RE` · `problem-ledger` GAS 전부 · `RemoteApi.gs`·러너·`Pipeline.gs` · 문제 검토 파일·`gas-project-audition` 전부.

---

## 6. 검증 계획

| # | 무엇을 | 어떻게 | 합격 |
|---|---|---|---|
| V1′ | 그림 폴더(D9) | Vercel `AUDITION_FIG_FOLDER_ID` 값 | `1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`(Drive 실측 F5). 아니면 그 값으로 고친다(코드 변경 0) |
| V2 | `test:sheet` | J1·J2·HL1·HL2·I1 추가 후 전부 녹색 | 기존 전부 불변 |
| V3 | 백필 1회 | `jb_backfillFromLedger()` 알림 | **채움 1,444 · 이미 있음 0 · 형식 아님 4,488 · 색인에 없음 371(24X모의01·03·05·07·09·11·13·15 각 46 · 24X모의06 1 · 25X모의12 1 · 26X모의12 1) · 모호 0 · 색인 ID 형식 불량 0 · 색인 ✅ 미사용 0**(시뮬레이션 F4와 일치) |
| V3′ | 백필 멱등 | 2회차 | 채움 0 · 이미 있음 1,444 · 나머지 동일 |
| V4 | 백필 표본 | D5006 ↔ `25서킷X03_1공통14` 등 5건을 문항장부 Data와 손으로 대조 | 5/5 |
| V5 | 옛 호출 호환 | `source` 없이 Stack | 현행 + `unmatched: []` |
| V6 | 'Latex 변환 : Data_DS' + 행 범위 | 4500-4505 | 미리보기 6행 · Drive 그림 표시(V1′ 뒤) · `file='latex'`·`jangbu_id` 저장 성공(E8) |
| V7 | ID 목록 | `D5006, d5006, X9999, S0001` | rows = D5006 1건 · invalid `X9999`(클라) · unmatched `S0001` + C6 문구 |
| V8 | 합집합 | 행 범위 + ID 목록 겹침 | 1번 · 오름차순 |
| ~~V9-0~~ | 교차 대조 | **완료(F6)**: Stack↔Latex 변환 4,953 겹침 중 4,918 동일 | — |
| V9 | 중복 | Stack에서 가져온 문항을 Latex 변환에서 다시 | `dupe:'existing'` |
| V10 | 환경변수 누락 | `LATEX_SPREADSHEET_ID` 없는 로컬 | audition 정상 · latex만 500 + 변수명 |
| V11 | 2층 수식 | 3개 체크 → W1·X1 | 목록 · "선택 3개" · 0개면 빈 문자열 |
| V12 | 응답 크기 | ID 500개 | 413 아님 |
| ~~V13~~ | E 빈 행 | **삭제**(F3·R1) | — |
| V14 | audition에 ID 목록 | `{ source:'audition', sheet:'Stack', jangbuIds:['D5006'] }` | 400 |

---

## 7. 위험·트레이드오프

- 색인 파일키 ↔ Data_DS 표기 불일치 재발 → "형식 아님"으로 셈만 된다. 규칙 이중은 주석 상호 참조 + 커밋 해시.
- `S####` 등록 뒤 백필 재실행을 잊음 → §9-1. 멱등.
- L열을 사람이 지우거나 열을 끼움 → 머리글 경고(HL) · ID_RE가 마지막 방어선.
- Latex 변환 Data_DS 전량 읽기(~19MB) → `maxDuration 30` 안. 느려지면 `A1:N`(B6).
- 같은 ID 두 행(재변환) → 둘 다 미리보기, D3가 거른다.
- 2층 체크의 위치 의존(B3) → X1 + 노트.
- **D3의 0.7%**(F6): Latex 변환 쪽 재정규화 뒤 같은 문항이 두 벌 들어올 수 있다 — 알고 수용(R3).

---

## 8. 커밋 가이드 (CLI)

push는 덕수 허락(2026-11-05) 아래 CLI가 하고 보고에 push 사실을 적는다.

| 단계 | 레포 | 내용 | 선행 |
|---|---|---|---|
| A | latex-convert | `JangbuId.gs` + 메뉴 · clasp push · 백필 1회(V3·V3′·V4) | — |
| B | 문항장부 시트 | W1·X1·V1 노트 · T2 삭제(V11) | — |
| C | mathory | 안 (1): `route.ts` SOURCES·env 분리 · `checkHeaders(profile)`·HL1·HL2 · 모달 3항목·`fetched`·C1 · `ImportSource.file`·`buildImportSource`·I1(audition) (V5·V6·V10) | D10 · V1′ |
| D | mathory | ID 목록: `parseJangbuIds`·J1·J2 · `jangbuIds`·`unmatched`·E1 400 · 모달 textarea·배지·C6 · `jangbu_id` 저장·I1(latex) (V7·V8·V9·V12·V14) | A · C |
| E | mathory | 문서: CLAUDE.md · roadmap · phasedocs 확정본 · `_archive/Phase72/` | D |

---

## 9. 후속 · 미해결

### 9-1. ⚠ 작업 종료 후 반드시 (덕수 지시 2026-11-05)
1. **색인 누락 `25X모의12_1공통20` → D5008 보충** → 백필 재실행으로 "이미 있음"에 포함 확인.
2. **`S####` 등록 뒤 백필 재실행**: 24년 홀수 모의X 368 + 25·26년 미변환분이 문항장부에 들어오면 `cropBuildIndex` 재실행(또는 수동) → 백필.

### 9-2. 이 Phase 밖
- `pl_stageSend_` 자동 L 채움(Q7).
- Q2 "본문 없음" 배지(R1 철회분) — E 빈 행이 실제로 생기면 그때.
- stray 2건: Data_DS `26모의X12_4미적28`(색인 없음) · 색인 `24X서킷24_3확통29`(Data_DS 없음) — 원인만 확인.
- 2~4489행(옛 경로 4,488행)의 문항장부 연결 — 키 형식이 CroP가 아니라 백필 밖. 필요하면 별도 매핑표.
- 문제 검토 Stack의 `S팀.X05` 34건 E 꼬리(`(1) 6 … * 메모`) — 그 세트를 Mathory로 가져올 때 두 벌 여부 확인.
