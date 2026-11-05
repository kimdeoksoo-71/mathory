# Phase 72 — 시트 가져오기 원본 확장('Latex 변환') + 문항장부 ID 연결 구현 계획서 v1

작성일: 2026-11-05 · 작성: CLI v1(레포 실측) · 기준 커밋: **`46e5603`**(mathory main, Phase 67b 종결 직후)
계보: 덕수 질문 1(가져오기가 읽는 열) → 질문 2(원본 확장 3안 → **안 (1) 확정**) → 질문 3(문항장부 연결 가능성 연구 → `2026-11-05 문항장부↔Latex변환 Data_DS 연결 연구.md` §3 3층 권장) → 덕수 2차 결정 4항(§2) → **v1 계획서**
실측: mathory `46e5603` 작업 트리 전수 · `gas-project-latex-convert` `3cc4694` · `gas-project-audition` · `gas-project-problem-ledger` `90c88cf`(2026-11-05 clasp pull) · 구글시트 xlsx 내보내기 2벌(문항장부 `1hlnZEB-…` · Latex 변환 `1wu8Gdvm…`, 2026-11-05)

> **이 Phase의 성격**: 서버는 여전히 **읽기만** 한다(스코프 `spreadsheets.readonly` 불변). Firestore 스키마는 **선택 필드 2개 추가**(마이그레이션 0). 세 레포(mathory · latex-convert GAS · 문항장부 시트 수식)에 걸치지만 **교차 파일 쓰기는 없다** — 문항장부를 읽는 쪽은 Latex 변환 GAS 하나이고 그것도 `openById` 읽기다.
> 연결 작업이 모두 끝난 뒤 **색인 누락 1건(`25X모의12_1공통20` = D5008) 보충을 잊지 말 것**(§9-1 · BACKLOG 2026-11-05).

---

## 0. 요약

지금 시트 가져오기는 '문제 검토' 파일의 Data_DS·Stack 두 시트만 읽는다(`route.ts:30` `SHEETS`, 환경변수 `AUDITION_SPREADSHEET_ID` 하나). 이번 Phase는 세 겹이다.

1. **원본 확장(안 (1))** — 원본 항목을 **'문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS'** 셋으로. 서버는 `source`(파일)+`sheet`로 어느 스프레드시트를 읽을지 고른다. 환경변수 `LATEX_SPREADSHEET_ID` 신설.
2. **데이터 연결(1층)** — Latex 변환 Data_DS **L열 `jangbu_id`**(문항장부 A열 ID, `D####` 또는 `S####`)를 GAS 메뉴로 백필한다. 소스는 문항장부 `_CroP색인`(✅ 1,444건). Mathory는 L열을 읽어 `ImportSource.jangbu_id`에 남긴다.
3. **선택 → 전달(2·3층)** — 문항장부 문제검색에서 체크한 ID를 수식 한 셀이 쉼표 목록으로 모으고, Mathory 모달의 **"문항장부 ID 목록"** 칸에 붙여 넣으면 서버가 L열로 행을 고른다(기존 행 범위·M체크와 **합집합**).

변경 파일 — mathory: `app/api/sheet-import/route.ts` · `lib/sheetImport.ts` · `types/problem.ts` · `components/import/SheetImportModal.tsx` · `tests/sheetImport.test.mjs` · (조건부) `app/api/sheet-import/figure/route.ts`. latex-convert GAS: **신규** `JangbuId.gs` · `MainMenu.gs`(항목 1). 문항장부: 문제검색 시트 **수식 1개**(GAS 0). **Firestore 규칙 0 · 그림 프록시 0(조건부 §3 D9) · 저장 경로(createProblem/saveTabBlock) 0 · 중복 판정 0.**

---

## 1. 현행 — 실측

### 1-1. mathory (`46e5603`)

| 항목 | 자리 | 현행 |
|---|---|---|
| 원본 시트 집합 | `route.ts:30-31` | `SHEETS = ['Data_DS','Stack']` · 범위 `${sheet}!A1:P`(`:86`) · 스프레드시트 ID는 `AUDITION_SPREADSHEET_ID` 하나(`:48`) |
| 요청 본문 | `route.ts:5` · `:118-120` | `{ sheet, rows?, includePreselected? }` · 둘 다 비면 400(`:126`) |
| 행 선택 | `route.ts:138-148` | `wantedSet.has(rowIndex) || (includePreselected && M체크)` 합집합 · A·E 둘 다 빈 행 스킵(`:150`) |
| 응답 | `route.ts:5` | `{ header, headerWarnings, rows:[{rowIndex, cells[16]}] }` · 4MB 상한(`:33`) |
| 열 매핑 | `lib/sheetImport.ts:17-35` | 0-based 16열. **K(10)·L(11)·N(13)은 매핑에 없다** → 읽어도 쓰지 않는다 |
| 헤더 검사 | `:41-55` · `:138` | `EXPECTED_HEADERS` 13키 고정(get·derived_answer·sloution_note 포함) — 없으면 경고 |
| 초안 변환 | `:423` `rowToDraft` | A→title/source/sourceId · B 그림명 복구 · C/D/E/F~J/O/P |
| 그림 참조 | `:199-217` | 구형 `\includegraphics{}` + **신형 `![파일명](https://drive.google.com/…)`**(GAS 패치 11) 둘 다 인식 — Latex 변환 Data_DS C열의 Drive 링크 형식과 **이미 호환** |
| 그림 프록시 | `figure/route.ts:4-5` · `:56` · `:105` | `?name=` → `AUDITION_FIG_FOLDER_ID` 폴더에서 이름 검색(NFC/NFD) · `?url=` Mathpix CDN |
| 출처 기록 | `types/problem.ts:108-116` | `ImportSource { provider:'audition-sheet', sheet:'Data_DS'\|'Stack', row, source_id, stem_hash, imported_at }` |
| 중복 키 | `SheetImportModal.tsx:91` | `source_id\|stem_hash` — 파일·시트 무관 |
| 모달 상태 | `:48` · `:84-87` · `:254-256` | `SheetName` 2종 · `SHEETS` 라벨/힌트 · 기본 `'Stack'` · `includePreselected` 기본 true |
| 모달 요청·저장 | `:340-343` · `:440-447` | body 3필드 · `importSource.sheet = fetchedSheet` |
| 설정 화면 | `:640-720` | 원본 버튼 행 · 행 범위 입력 · M체크 체크박스(힌트에 "Data_DS는 M체크까지 비워진다") · 정돈 체크박스 |
| 테스트 | `package.json` `test:sheet` | `lib/sheetImport.ts` **단독 tsc**(import 0 규약) + `tests/sheetImport.test.mjs`(R·N·H 군) |

### 1-2. 'Latex 변환' 파일 Data_DS (xlsx 2026-11-05 · GAS `3cc4694`)

| 항목 | 실측 |
|---|---|
| 헤더 | A~K `id · problem · given_solution · given_answer · problem_stem · choice1~5 · answer_type` · **L 없음 · M `get` · N `ID` · O·P 없음** |
| 값 | 데이터 2~6304행. **L·M·N 전부 0건**(머리글만 있고 체크박스·값 없음) |
| 쓰는 코드 | `Datalatex_To_Data_DS.gs`(DLDS.DST A·B·C·D·K) · `normalizeProblem.gs`(DSN.OUT E~J·K) · `Pipeline.gs:566 pl_stageSend_`(A:C 청크 append) — **L~P를 쓰는 코드 0** |
| 성격 | 누적형(append, 비워지지 않음) — 문제 검토 Data_DS(검증마다 교체)와 다르다 |
| 그림 | C열에 `![파일명](Drive링크)`(패치 11) · 폴더 기본 `PBMAI/IMAGE_FIG`(`Mathpix 그림 추출.gs:51`, 속성 `MPF_FIG_FOLDER_PATH`로 덮어쓸 수 있음) · 문제 검토 쪽도 기본 `PBMAI/IMAGE_FIG`(`Itemverification.gs:138`) |
| 키 표기 | A열 = 실제 CroP 파일명 `24모의X06_1공통02` · `26서킷X03_…`(구 이름) |

### 1-3. 문항장부 (`1hlnZEB-…` · GAS `problem-ledger` 90c88cf)

| 항목 | 실측 |
|---|---|
| `_CroP색인` | 15열(`파일키·문항ID·시트·행·사용세트식별·문서URL·문제파일ID·해설파일ID·해설조각수·상태·메시지·처리시각·…`, `crop-image-insert.gs:86-93`). 1,815행 = 대량변환 v4 1,815문항. 상태 ✅ 1,444 / ❌ 371 |
| 파일키 | **스크립트가 만든 표준 세트명** `YYX모의NN` / `YYX서킷NN`(`cropMakeCanon_`) — 실제 PNG 이름이 아니다. `cropParseExam_()`(`:107-120`)이 구 이름(`26모의X14`)·신 이름 둘 다 표준형으로 읽는다 |
| ❌ 371 | 24년 홀수 모의X 8세트 368(문항장부 Data에 **미등록**) + `25X모의12_1공통20`(D5008 실재, 색인 누락) + 문제파일없음 1 + 중복 1 |
| 문제검색 | A~R = `FILTER(Data!A2:R…)` · **U열 `선택` 체크박스 3,443개** · S열 완전히 빈 열 · T2 `=filter($N:$N,$S:$S=true)`는 S가 비어 항상 `#N/A`(죽은 수식) |
| 바운드 GAS | 문항장부 Data 기준 열 A ID · E (사)세트 · F (사)과목 · G (사)번호 · N 문서링크 · P 이력. 문제검색·`_CroP색인`을 Mathory 쪽에서 쓸 때 필요한 GAS 변경 **0** |

---

## 2. 덕수 결정 (2026-11-05) → 요구사항

| # | 결정 | 이 계획서에서 |
|---|---|---|
| 1 | 원본 확장은 **안 (1)** — 항목 3개, 라벨 '문제 검토 : …' / 'Latex 변환 : Data_DS' | §3 D1·D2, §5-3·5-6 |
| 2 | 연결 키는 **문항장부 A열 ID** | §3 D4(L열 `jangbu_id`) |
| 3 | 문항장부 바운드 GAS clasp 확보 | **완료**(레포 `gas-project-problem-ledger`) — 이 Phase에서 그 GAS는 **수정하지 않는다** |
| 4 | 미등록 문항(24년 홀수 모의X 368 + 25·26년 미변환분)은 **신규 문항 `S####`로 등록 예정** | §3 D5(ID 형식 `^[DS]\d{4}$`) · 백필은 멱등(§5-1) |
| 5 | D5008 색인 누락은 **지금 넘어가고 작업 종료 후 보충** | §9-1 상기 항목 |
| 6 | 문제검색 선택 수식은 U열 기준으로 새로 쓴다 | §5-2 |

---

## 3. 결정 사항

### D1 — 원본 식별은 `source`(파일) + `sheet`(시트) 두 축 (기본안)
- API body: `{ source?: 'audition' | 'latex', sheet: 'Data_DS' | 'Stack', rows?, includePreselected?, jangbuIds?: string[] }`. **`source` 생략 = `'audition'`**(옛 호출 호환).
- 서버 표: `SOURCES = { audition: { envId: 'AUDITION_SPREADSHEET_ID', sheets: ['Data_DS','Stack'] }, latex: { envId: 'LATEX_SPREADSHEET_ID', sheets: ['Data_DS'] } }`. 조합이 표에 없으면 400.
- `readEnv()`는 **요청된 source의 ID만** 필수로 본다 — `LATEX_SPREADSHEET_ID`가 아직 없는 배포에서 '문제 검토' 가져오기가 500으로 죽지 않게.
- 기각: `sheet` 값을 `'Latex:Data_DS'`처럼 합성 — `ImportSource.sheet` 유니온이 더러워지고 Stack/Data_DS 분기 코드(`:150` 빈 행 스킵 등)를 전부 다시 읽어야 한다.

### D2 — `ImportSource`에 선택 필드 2개, 마이그레이션 0 (확정)
```ts
export interface ImportSource {
  provider: 'audition-sheet';           // 불변 — 소비처(listProblems 스프레드·중복 집합)가 이 리터럴을 본다
  /** 어느 스프레드시트인가. 없으면 'audition'(Phase 61a~71 문서) */
  file?: 'audition' | 'latex';
  sheet: 'Data_DS' | 'Stack';
  row: number;
  source_id: string;
  stem_hash: string;
  /** 문항장부 A열 ID(D####·S####). Latex 변환 L열에서 왔을 때만 */
  jangbu_id?: string;
  imported_at: number;
}
```
- `provider`를 `'latex-sheet'`로 나누지 않는다 — 중복 집합이 `provider`를 안 보고 `source_id|stem_hash`만 보므로 이득 0, 소비처 점검 비용만 생긴다.

### D3 — 중복 판정은 그대로 `source_id|stem_hash`, 파일 무관 (확정)
- 같은 문항이 '문제 검토 Stack'에도 'Latex 변환 Data_DS'에도 있으면 **같은 문항**이다(A열 id 동일 · E열 본문은 같은 `normalizeProblem.gs`가 만든다). 두 번 가져오지 않는 것이 맞다.
- ⚠ 본문이 다르면(재변환) `stem_hash`가 달라 **새 문항으로 들어온다** — 현행과 같은 성질이고, 이번에 바꾸지 않는다.

### D4 — 연결 열은 Latex 변환 Data_DS **L열, 머리글 `jangbu_id`** (확정 · 연구 §3 유지)
- 근거: L은 머리글도 값도 없고(§1-2) Mathory `SHEET_COL`·GAS 어느 쪽도 읽지 않는다. **M(`get`)·N(`ID`)은 쓰지 않는다** — 문제 검토 배치에서 M은 체크박스, **N은 verdict 자리**(`Itemverification.gs:6`, `Pipelineverify.gs:289`)라 같은 `SHEET_COL`을 두 파일에 쓰는 전제가 깨진다. N의 'ID' 머리글은 문제 검토 헤더의 잔재로 본다(값 0건).
- `SHEET_COL.jangbu_id = 11` 추가. `rowToDraft`는 **읽지 않는다**(초안에 안 싣는다) — 모달이 `cells[11]`을 `ImportSource.jangbu_id`로 옮긴다(§5-6). `sheetImport.ts`의 import 0 규약 유지.
- 헤더 검사: `checkHeaders(header, profile)` — `profile: 'audition' | 'latex'`. latex 프로파일은 `jangbu_id`(L)를 **기대**하고 `get`·`derived_answer`·`solution_note`를 **검사하지 않는다**(없는 열을 경고로 띄우면 매번 노이즈). 기본값 `'audition'`이라 기존 테스트 H1 불변.

### D5 — ID 형식 `^[DS]\d{4}$` · 대소문자·공백 정규화 (덕수 결정 4)
- `parseJangbuIds(text): string[]` — 쉼표·공백·줄바꿈·세미콜론 구분, trim, 대문자화, 형식 불일치는 버리고 `invalid[]`로 돌려준다(경고용), 중복 제거, 입력 순서 유지. `lib/sheetImport.ts`에 두고 `test:sheet`로 고정.
- 서버도 같은 함수로 **다시** 검증한다(클라를 믿지 않는다). 상한 500개(URL이 아니라 body라 길이 여유는 있지만 4MB 응답 상한 §1-1과 맞물린다 — 1,000행 권장 문구와 같은 선).

### D6 — 선택 방식 셋의 **합집합** · 최소 하나 (확정)
- `wantedSet.has(rowIndex) || (includePreselected && M체크) || jangbuSet.has(cells[11])`.
- 셋 다 비면 400(현행 문구에 "또는 문항장부 ID 목록" 추가).
- 응답에 `unmatched: string[]`(요청한 ID 중 L열에 없던 것) 추가 → 모달이 경고로 나열한다. **매칭 0이어도 200**(rows 빈 배열 + unmatched 전부) — 원인을 보여 주는 쪽이 낫다.
- 같은 ID가 L열에 **둘 이상**이면(재변환 중복) 전부 포함한다 — 중복은 D3가 거른다.

### D7 — 'Latex 변환 : Data_DS'에서는 M체크 옵션을 **숨긴다** (확정)
- 체크박스가 없고(§1-2) 누적형이라 "체크해서 가져오기" 운영이 없다. 모달에서 source=latex면 `includePreselected`를 false로 고정하고 UI를 감춘다. 서버는 일반 코드(M 전부 미체크 → 경고 1줄)라 분기 없음.
- 기본 선택은 현행대로 '문제 검토 : Stack'(바꿀 이유 없음).

### D8 — 1층 백필은 **Latex 변환 GAS 메뉴 1개**, 문항장부 GAS는 손대지 않는다 (확정)
- `JangbuId.gs` — `jb_backfillFromLedger()`: 문항장부를 `SpreadsheetApp.openById(JB.LEDGER_ID)`로 **읽어** `_CroP색인`의 `파일키 · 문항ID · 상태` 3열을 받고, Data_DS A열을 **표준형**으로 바꿔 짝짓는다. 표준형 규칙은 `crop-image-insert.gs`의 `cropParseExam_`·`cropMakeCanon_`과 같은 것을 **이식**(두 파일이 같은 규칙을 갖는다 — 의도적 이중, 주석에 출처 기재). 상태 ✅만 쓴다.
- 멱등: **L이 빈 행만** 채운다(기본). `JB.OVERWRITE=true`일 때만 덮어쓴다. 결과를 로그 시트가 아니라 **알림 1장 + Logger**로(건수: 채움·이미 있음·미매칭·색인에 없음).
- ⚠ 접근권한: Latex 변환 파일의 **실행 사용자**(덕수)가 문항장부 편집자이므로 `openById` 읽기는 추가 권한 없이 된다. 서비스 계정은 관여하지 않는다.
- 후속(이 Phase 밖): `pl_stageSend_` 끝에서 새 행의 L을 같은 함수로 채우기(러너 런마다 자동). v1은 메뉴 수동 — 러너·`latex-1.1.0` 계약을 건드리지 않는다.
- 기각: 문항장부 GAS가 Latex 변환에 쓰기(교차 파일 쓰기) · Mathory가 문항장부 직접 조인(연구 §3).

### D9 — 그림 프록시는 **그대로**, 폴더 동일성은 배포 전 확인 (조건부)
- 두 GAS의 기본 폴더가 같은 경로 `PBMAI/IMAGE_FIG`다(§1-2). 그러나 **경로가 같다 ≠ 폴더 ID가 같다**(같은 이름 폴더가 둘일 수 있고, 속성 `MPF_FIG_FOLDER_PATH`로 바뀌어 있을 수 있다).
- 확인 절차(§6 V1): Latex 변환 Data_DS의 `![파일명](https://drive.google.com/…/d/<fileId>/…)` 링크 5개에서 fileId를 뽑아 Drive API `files.get?fields=parents`로 부모 폴더 ID를 보고 `AUDITION_FIG_FOLDER_ID`와 대조.
- 같으면 변경 0. 다르면 `LATEX_FIG_FOLDER_ID` 신설 + 프록시에 `&source=latex` + 모달 그림 요청에 source 전달(작은 변경이라 v1 범위에 포함, 단 분기는 확인 결과가 나온 뒤에만 짠다).

### D10 — 서비스 계정 권한·환경변수 (덕수 작업)
- Latex 변환 파일(`1wu8GdvmpyxCqSKS5RiSlRhWGH4B2OMoPN0TGP94ti54`)에 서비스 계정 `GOOGLE_SA_EMAIL`을 **뷰어**로 공유. Vercel에 `LATEX_SPREADSHEET_ID` 추가. 둘 다 Mathory 배포 **전**에.
- `AUDITION_ALLOWED_UIDS`는 그대로 쓴다(허용 사용자 집합이 파일별로 다를 이유 없음).

### D11 — 2층은 문항장부 **수식 1개**, GAS 0 (확정)
- 문제검색 시트 빈 셀(권장 **W1**, 머리글 행이라 FILTER 결과와 안 겹친다): `=TEXTJOIN(",",TRUE,FILTER(A2:A, U2:U=TRUE))`. 체크 0개면 `#N/A` → `IFERROR(…, "")`로 감싼다.
- T2의 죽은 수식은 **삭제**(또는 `$S:$S`→`$U:$U`). 삭제를 권장 — N열 보기 URL 묶음은 이제 쓰임이 없다.
- `clearTUVColumns`(`TUV열 지우기.gs`)는 문항이동 시트용이라 무관.

---

## 4. 현행 규약 충돌 점검

| 규약 | 판정 |
|---|---|
| 서버는 시트를 **읽기만** (CLAUDE.md · `route.ts` 헤더) | 유지 — 스코프·JWT 변경 0. 파일이 하나 늘 뿐 |
| `lib/sheetImport.ts` **import 0** | 유지 — `parseJangbuIds`·`checkHeaders(profile)`는 순수 함수 |
| Firestore 저장은 클라의 기존 CRUD | 유지 — `createProblem` 호출 인자에 선택 필드 2개 |
| 중복 판정 `source_id+stem_hash` 둘 다 | 유지(D3) |
| 열 위치가 진실, 헤더는 경보 | 유지 — L열 추가도 **위치**로, 머리글은 `checkHeaders` 경보 |
| GAS 열 하드코딩(열 끼우기 금지) | 준수 — L은 **끝에 붙는 열**이 아니라 빈 열에 **값만** 쓴다. 열 삽입 0 |
| 문제 검토 Data_DS는 검증마다 비워진다(61e-2차 D27) | 영향 없음 — Latex 변환 Data_DS는 누적형, L열도 비워지지 않는다 |
| `_CroP색인`·`crop-image-insert.gs` | **읽기만**. `cropBuildIndex`가 색인을 다시 만들면 파일키는 같은 규칙으로 나오므로 백필 결과 불변 |

---

## 5. 구현 항목

### 5-1. latex-convert GAS — 신규 `JangbuId.gs` + `MainMenu.gs` 항목 1
- `const JB = { LEDGER_ID: '1hlnZEB-v6MQ7FpkaZigblmAYy5_LBH6kqH6mflQRrj0', INDEX_SHEET: '_CroP색인', DST_SHEET: 'Data_DS', COL_KEY: 1, COL_JANGBU: 12 /* L */, HEADER: 'jangbu_id', OVERWRITE: false, ID_RE: /^[DS]\d{4}$/ }`
- `jb_canonKey_(fileKey)` — `24모의X06_1공통02` · `24X모의06_1공통02` · `26서킷X03_…` · `써킷` 변형을 모두 `YYX모의NN_<과목><번호>` 표준형으로. `cropParseExam_`(`crop-image-insert.gs:107`)의 구/신 두 정규식을 그대로 옮기고 과목·번호 부분은 `cropNormKey_`(`:568`)와 같이 "과목 앞 숫자 + 번호 정수".
- `jb_backfillFromLedger()` — ① 색인 읽기(✅만, 파일키→문항ID 맵; ID_RE 불일치는 건너뛰고 셈) ② Data_DS A·L 읽기 1회 ③ L 비었고 맵에 있으면 채움 ④ L 범위 **1회 setValues** ⑤ L1 머리글이 비었으면 `jangbu_id` 기록 ⑥ 알림: 채움 n · 이미 있음 n · 색인 미매칭 n(앞 10개 키 예시) · 색인 쪽 미사용 n.
- `pl_isBusy_()`면 거부(패치 13 E-05와 같은 가드).
- `MainMenu.gs`: '🔗 문항장부 ID 채우기 (Data_DS L열)' 1항목. `RemoteApi` **무변경**(VERSION 그대로).
- 커밋은 latex-convert 레포(push 허용됨).

### 5-2. 문항장부 시트 — 수식 1개 (수동 · GAS 0)
- 문제검색 W1: `=IFERROR(TEXTJOIN(",",TRUE,FILTER(A2:A, U2:U=TRUE)),"")` · V1에 라벨 `선택 ID →`. T2 삭제.
- 사용법 한 줄을 문제검색 시트 메모(V1 셀 노트)에: "검색 → U열 체크 → W1 복사 → Mathory 시트 가져오기 'Latex 변환 : Data_DS' ID 목록에 붙여넣기".

### 5-3. `app/api/sheet-import/route.ts`
- `SOURCES` 표(D1) · `readEnv(source)`가 해당 envId만 필수.
- body 파싱: `source`(기본 `'audition'`) · `jangbuIds`(배열, `parseJangbuIds(…join(','))`로 재검증 · 500개 상한).
- 최소 하나 검사(D6) · 합집합 필터(D6) · `unmatched` 계산 · 응답 `{ header, headerWarnings, rows, unmatched }`.
- `checkHeaders(header, source === 'latex' ? 'latex' : 'audition')`.
- 헤더 주석의 body 설명·"읽기만 한다" 문단을 갱신. `maxDuration 30` 유지(Latex 변환 Data_DS 6,304행 × ~3KB ≈ 19MB 읽기 — Stack 12MB 1.5초 실측에서 외삽 ~2.5초. 응답은 선택 행만이라 4MB 상한은 그대로).

### 5-4. `lib/sheetImport.ts`
- `SHEET_COL.jangbu_id: 11` · `EXPECTED_HEADERS`는 그대로 두고 **`EXPECTED_HEADERS_LATEX`** 추가(A~K + `jangbu_id`; get·O·P 없음). `checkHeaders(headerRow, profile: 'audition'|'latex' = 'audition')`.
- `parseJangbuIds(text): { ids: string[]; invalid: string[] }`(D5). `JANGBU_ID_RE` export.
- `rowToDraft` 무변경.

### 5-5. `types/problem.ts`
- D2의 `file?`·`jangbu_id?` 두 줄 + 주석(없으면 audition).

### 5-6. `components/import/SheetImportModal.tsx`
- `type SourceKey = 'audition:Data_DS' | 'audition:Stack' | 'latex:Data_DS'`. `SHEETS` → `SOURCES: { key, file, sheet, label, hint }[]` 3항목. 라벨 '문제 검토 : Data_DS' · '문제 검토 : Stack' · 'Latex 변환 : Data_DS'. 힌트: 기존 둘 유지 · 셋째 "대량 변환 누적본 · 문항장부 ID로 고를 수 있음".
- 상태: `sourceKey`(기본 `'audition:Stack'`) · `jangbuText` · `fetched: { file, sheet }`. `includePreselected`는 latex면 false 고정·UI 숨김(D7).
- FormPane: latex일 때 **"문항장부 ID 목록"** textarea(placeholder `D5006, D5008 …` · 힌트 "문항장부 문제검색 W1을 붙여넣으세요 · S#### 가능"). 제출 가능 조건 = rowsText ∥ includePreselected ∥ ids≥1. `parseJangbuIds` 결과의 `invalid`를 입력 아래 경고로.
- fetchRows: body에 `source`·`sheet`·`jangbuIds`. 응답 `unmatched`가 있으면 `headerWarnings`와 같은 자리에 "문항장부 ID n개를 L열에서 찾지 못함: …" 1줄.
- saveOne: `importSource.file = fetched.file`(audition이면 **필드 생략** — 옛 문서와 모양 통일) · `jangbu_id = cells[SHEET_COL.jangbu_id]`가 ID_RE에 맞을 때만.
- 미리보기 행 머리(제목 옆)에 `jangbu_id`가 있으면 작은 배지 `D5006`(읽기 전용).

### 5-7. 환경변수·배포 (덕수)
- Vercel `LATEX_SPREADSHEET_ID` · 서비스 계정 뷰어 공유(D10). (조건부) `LATEX_FIG_FOLDER_ID`(D9).

### 5-8. 테스트·문서
- `tests/sheetImport.test.mjs`: **J1** `parseJangbuIds` 구분자·대소문자·중복·invalid · **J2** 상한·빈 입력 · **H2** latex 프로파일 헤더(실측 헤더 A~K + L `jangbu_id` → 경고 0 · M `get`·N `ID`는 무시) · **H3** audition 프로파일 불변(H1 그대로 통과).
- CLAUDE.md: 핵심 파일 구조의 `SheetImportModal.tsx`·`sheet-import/` 줄에 "(Phase 72: 원본 3개 · 문항장부 ID)" · 핵심 패턴에 **D4(L열·N은 verdict 자리)**·D3 한 줄.
- 완료 시 이 문서의 확정본을 `docs/phasedocs/`로(규칙 7) · roadmap.md 갱신(규칙 6).

### 5-9. 건드리지 않는 것
- `figure/route.ts`(D9 확인 전) · `lib/apiAuth.ts` · `createProblem`/`saveTabBlock` · Firestore 규칙 · `rowToDraft`·`splitFigures`·`stemHash` · `problem-ledger` GAS 전부 · `RemoteApi.gs`·러너 · 문제 검토 파일 전부.

---

## 6. 검증 계획

| # | 무엇을 | 어떻게 | 합격 |
|---|---|---|---|
| V1 | 그림 폴더 동일성(D9) | Latex 변환 C열 Drive 링크 5개 fileId → `files.get fields=parents` | 전부 `AUDITION_FIG_FOLDER_ID`와 같다 → 프록시 변경 0. 아니면 D9 조건부 분기 |
| V2 | `test:sheet` | J1·J2·H2·H3 추가 후 전부 녹색 | 기존 R·N·H1 불변 |
| V3 | 백필 | `jb_backfillFromLedger()` 1회 → L 채움 수 | **1,444 ± 색인 ID_RE 탈락분**, 미매칭 목록에 24년 홀수 모의X 8세트만 · 두 번째 실행은 "채움 0 · 이미 있음 1,444" |
| V4 | 백필 표본 | D5006 ↔ `25서킷X03_1공통14`(문제검색 3행 실측) 등 5건을 문항장부 Data와 손으로 대조 | 전부 일치 |
| V5 | 옛 호출 호환 | body에 `source` 없이 Stack 요청 | 현행과 같은 응답(`unmatched: []` 추가만) |
| V6 | 'Latex 변환 : Data_DS' + 행 범위 | 4500-4505 | 미리보기 6행 · 그림(Drive 링크) 표시 · `ImportSource.file='latex'` 저장 |
| V7 | ID 목록 | `D5006, d5006, X9999, S0001` | rows=D5006 1건(중복 입력 1회) · invalid `X9999` 경고 · unmatched `S0001` |
| V8 | 합집합 | 행 범위 + ID 목록 겹침 | 같은 행 1번만 · rowIndex 오름차순 |
| V9 | 중복 | Stack에서 이미 가져온 문항을 Latex 변환에서 다시 | `dupe:'existing'`으로 걸러짐(D3) |
| V10 | 환경변수 누락 | `LATEX_SPREADSHEET_ID` 없는 로컬에서 audition 요청 | 정상. latex 요청만 500 + 변수명 |
| V11 | 2층 수식 | 문제검색에서 3개 체크 → W1 | `D####,D####,D####` · 체크 0이면 빈 문자열 |
| V12 | 응답 크기 | ID 500개 | 413 아님(선택 행만 직렬화) |

---

## 7. 위험·트레이드오프

- **색인 파일키 ↔ Data_DS A열 표기 불일치가 재발**(새 업로드 규칙이 또 바뀌면) → `jb_canonKey_`가 못 읽는 키는 미매칭 목록에 **그대로** 나오게 해서 조용히 빠지지 않게 한다. 규칙을 `cropParseExam_`과 **같은 파일에 두지 못하는** 이중은 주석으로 상호 참조.
- **`S####` 등록 뒤 백필 재실행을 잊음** → §9-1에 D5008과 함께 묶어 상기. 재실행은 멱등(D8).
- **L열을 사람이 지우거나 열을 끼움** → Mathory는 머리글 `jangbu_id` 부재를 경고(H2), 값은 위치로 읽으므로 열 삽입 시 **엉뚱한 값이 ID 자리로** 온다 — ID_RE 검증이 마지막 방어선(모양이 안 맞으면 저장하지 않음).
- **Latex 변환 Data_DS 19MB 읽기** → `maxDuration 30` 안이지만 매 요청 전량 읽기다(현행 Stack도 같다). 느려지면 `A2:L`로 범위를 줄이는 것이 1순위(O·P가 없으니 손실 0) — v1은 `A1:P` 유지(코드 한 벌).
- **같은 ID가 두 행**(재변환) → 둘 다 미리보기에 오고 D3가 거른다. 미리보기에 두 번 보이는 것은 **의도**(어느 쪽이 새 본문인지 보게).

---

## 8. 커밋 가이드 (CLI)

단계마다 독립 배포 가능하게 쪼갠다. push는 덕수 허락(2026-11-05) 아래 CLI가 한다 — mathory CLAUDE.md 규칙 3은 그대로 두고 **보고에 push 사실을 적는다**.

| 단계 | 레포 | 내용 | 선행 |
|---|---|---|---|
| A | latex-convert | `JangbuId.gs` + 메뉴 · clasp push · 백필 1회(V3·V4) | — |
| B | 문항장부 시트 | W1 수식 · T2 삭제(V11) | — (A와 무관) |
| C | mathory | 안 (1): `route.ts` SOURCES·`readEnv(source)` · 모달 3항목 · `ImportSource.file` · H2·H3 (V5·V6·V10) | D10 환경변수 · V1 |
| D | mathory | ID 목록: `parseJangbuIds` · `jangbuIds`·`unmatched` · 모달 textarea·배지 · `jangbu_id` 저장 · J1·J2 (V7·V8·V9·V12) | A·C |
| E | mathory | 문서: CLAUDE.md · roadmap · phasedocs 확정본 | D |

커밋 메시지 접두 `Phase 72 A/C/D/E:`. C와 D를 한 커밋으로 합치지 않는다 — C만으로 안 (1)이 성립하고, D는 A가 돌아야 검증된다.

---

## 9. 후속 · 미해결

### 9-1. ⚠ 작업 종료 후 반드시 (덕수 지시 2026-11-05)
1. **색인 누락 `25X모의12_1공통20` → D5008 보충**: `_CroP색인`의 해당 행 문항ID·상태를 손으로 고치거나(문서URL은 Data N열에서), Data_DS L열에 `D5008`을 직접 기입. 그 뒤 `jb_backfillFromLedger()` 재실행으로 "이미 있음"에 포함되는지 확인. BACKLOG 2026-11-05 항목.
2. **`S####` 등록 뒤 백필 재실행**: 24년 홀수 모의X 368 + 25·26년 미변환분이 문항장부에 들어오면 `_CroP색인`에도 들어와야 한다(`cropBuildIndex` 재실행 또는 수동) → 그 다음 백필.

### 9-2. 이 Phase 밖
- `pl_stageSend_` 자동 L 채움(D8 후속) — 러너 런마다 수동 메뉴가 번거로워지면.
- stray 2건: Data_DS `26모의X12_4미적28`(색인 없음) · 색인 `24X서킷24_3확통29`(Data_DS 없음) — 원인만 확인.
- `_CroP색인`에 실제 파일명 열 추가(연구 §3 1층 둘째 항) — D8이 Latex 변환 쪽에서 정규화하므로 **불필요해졌다**. 철회.
- 문제 검토 파일의 Data_DS·Stack에도 `jangbu_id`를 두는 것 — 그 파일은 Data_DS가 검증마다 비워지므로 Stack만 후보. 필요가 생기면 같은 L열 규약으로.
