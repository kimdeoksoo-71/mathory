# Phase 61e 타당성 검토 — v3 (web 재검증 · 최종)

> 작성: web(Claude) 2026-08-30 · 저본: CLI v2 확정판 · 계보 v1(web) → v2(CLI 실측 C1~C9·N1~N10·D15~D20) → **v3(web 재검증 Z1~Z8)**
> 검증 방법: GitHub `mathory` HEAD `b3a9612` clone에서 v2가 인용한 코드 위치를 전부 다시 열었고, **`lib/proofread.ts`를 단독 컴파일해 C2·N-2 프로브를 재실행**했다. v2가 열어 둔 O-1·O-2·O-3은 「문제 검토」 시트 실물(2026-08-30 20:37 KST 판)로 닫았다. GAS(G1~G10)와 시트(S1~S7)는 v1에서 web이 직접 실측한 것이므로 O-4·O-5도 닫는다.
> 덕수 선행 작업(Drive API 활성화·폴더 공유·환경변수)은 완료 보고됨(2026-08-30).

---

## 0. 판정 한 줄

**v2의 정정 9건·실측 10건·결정 20건을 전건 승인한다.** 재현·재확인에서 뒤집힌 항목은 없다. 다만 v2가 "신설"이라 적은 회귀 하니스는 **이미 존재**하고(Z1), 롤백 경로에 v2도 v1도 놓친 구멍이 하나 있으며(Z2), 열린 항목 5건을 실물로 닫으면서 D3′·D13의 문구가 확정된다(Z3~Z5). 구현 사양 변경은 **Z2 한 건(작은 추가)**뿐이다.

---

## 1. v2 재현·재확인 결과

| v2 항목 | 재검증 | 결과 |
|---|---|---|
| **C1** `hasImages` 죽은 필드 | `grep -rn hasImages app lib components` → `route.ts:116` 선언, `verifyFlow.ts:20,135` 송신 **2곳뿐**. 라우트 본문·`prompts.ts`에 소비처 없음 | **확인** — v1 §4 "의도한 방향" 문장은 삭제가 맞다(D19) |
| **C2** 자동 수정이 `\includegraphics` 파괴 | 단독 컴파일 후 재실행: `\includegraphics{연구실모의6회(260824)_문제_1공통07_fig1.jpg}` → `\$includegraphics${연구실모의$6$회(260824)_문제_$1$공통$07$_fig1.$jpg$}` (count 5). `\begin{itemize}…` → `\$begin${$itemize$}…` (count 5). **tabular 뒤 `\includegraphics`도 동일 파괴**(count 6 — 표 변환은 정상, 그림 태그만 깨짐) | **재현 성공** — D15 선행이 옳다 |
| **C4** 시트 라우트 JWT 싱글턴 | `route.ts:70-78` — `jwtClient` 모듈 스코프, scopes `spreadsheets.readonly` 단일 | **확인** — D20(별도 JWT) 지지 |
| **C5** `src="…"` 정규식 6곳 | 5파일 6건(EditorView 2건) | **확인** |
| **C6** 모달 분기 2갈래 | `SheetImportModal.tsx:621-628` — `choices` ? `ChoicesBlock` : `EditorPreview` | **확인** — D18 필요 |
| **C7** 전역 `img` 규칙 없음 | `globals.css`의 `img` 셀렉터는 `img.twemoji`(1023) 하나 | **확인** |
| **C9** 펼침은 단일 행 | `expanded: number \| null`(:154), `expanded === item.rowIndex`(:387) | **확인** — D16(지연 로딩) 지지 |
| **N-2** 마커 안전 | `ㄱ.`·`(가)`·`7.` 보존 / `f`→`$f$` / `① 1`→`① $1$` / `(ㄱ),(ㄴ)`→`(1),(2)` / `<img …>` 무변경 | **전부 재현** |
| **N-8** 빈 question 차단 | `batchPlan.ts:110` `questionBlockCount === 0 → 'empty_question'`, W6 주석(:101) | **확인** |
| **N-9** 600px 이하 무리사이즈 | `storage.ts:22` `img.width <= TARGET_WIDTH → resolve(file)` | **확인** |
| **D19(c)** 기각 근거 | `verifyFlow.ts:44-50` "서버 셈법과 같아야 한다 … 사본 금지" 주석 실재 | **확인** |
| **C3** `AUDITION_SPREADSHEET_ID` = 「문제 검토」 | web은 `.env.local`을 볼 수 없다. v2의 조회값이 v1 §1-3의 ID와 일치 | **정합 — 수용** |

---

## 2. 정정·보완 (Z1~Z8)

### Z1. `npm run test:proofread`·`tests/proofread.test.mjs`는 **이미 있다** — v2 D15·§4의 "신설"은 오기

`package.json:17` — `"test:proofread": "tsc lib/proofread.ts --outDir .test-build --rootDir . …"` 가 존재하고 `tests/proofread.test.mjs`에 **17개 케이스**(tabular·multicolumn·`\vert`·jamo 등)가 있다. `tsc`는 import를 따라가므로 `lib/proofread.ts` 하나만 지정해도 `latexScan.js`가 함께 나온다(재확인: 출력 디렉터리에 두 파일 생성).
⇒ D15의 하니스는 **신설이 아니라 증설**이다. §4 "신규" 목록에서 `tests/proofread.test.mjs`를 빼고 "수정(케이스 증설)"으로 옮긴다. 증설할 케이스는 최소 4개: C2의 두 입력 · tabular+`\includegraphics` 혼합 · `\\[6pt]`(제어열이 아님을 확인) — 그리고 **기존 17개 무회귀**.

### Z2. ⚠ **D7 롤백이 Storage 객체를 지우지 않는다** — v1·v2 모두 놓침

`lib/firestore.ts:24` `deleteProblem`은 Firestore(탭 블록·versions)만 캐스케이드하고 **Storage를 건드리지 않는다**(`deleteObject`·`listAll` 0건). 이번 Phase는 `createProblem` → `uploadImage(problems/{pid}/…)` → `saveTabBlock` 순서라, 블록 저장 실패로 롤백하면 **그림 파일이 고아로 남는다**. 편집창의 `temp-` 업로드가 이미 같은 고아를 만들고 있으니 새 종류의 문제는 아니지만, 가져오기는 일괄이라 양이 다르다.
⇒ **D7′**: 저장 단계는 방금 올린 Storage ref 목록을 들고 있다가, 롤백 시 `deleteProblem` 뒤에 **best-effort `deleteObject`** 를 돈다. 실패해도 집계만 하고 멈추지 않는다(D7의 "정리 실패 — 수동 삭제 필요"와 같은 규칙). Storage 규칙은 로그인 사용자의 삭제를 허용하는지 확인 — `storage.rules:13`은 `write`만 규정하므로 delete가 write에 포함된다(Firebase 규칙 의미론) → 규칙 변경 0.

### Z3. O-1 닫음 — 선택지 셀(F~J) 안 `\includegraphics`는 **현재 0건** → **D3′(i) 미구현 확정**

「문제 검토」 Data_DS 39행 F~J 전량 검색 0건. Stack은 그림 파이프라인(08-30) 이전 세트만 있어 구조적으로 0건이다. v2 규칙("실측 0건이면 (i) 코드를 넣지 않는다")대로 **(i)는 구현하지 않는다.**
다만 GAS `normalizeProblem.gs:194-201`이 `\includegraphics`로 시작하는 선지를 정상 취급하므로 **미래에 나타날 수 있는 형태**다. 그림 선지 문항(그래프 개형 고르기)이 들어왔을 때 조용히 깨진 `\$includegraphics$…`로 저장되는 것만 막으면 된다 → **choices 블록의 raw_text에 `\includegraphics`가 있으면 경고 배지 + 그 블록은 자동 수정 제외**(D15가 있으면 파괴는 안 되지만 렌더는 텍스트 그대로다). 렌더 분기는 실물이 생기면 그때 만든다.

### Z4. O-2 닫음 — B열 헤더는 `problem` → `EXPECTED_HEADERS.problem = 'problem'` 추가

시트 1행 B = `problem` (A `id`, C `given_solution` 과 같은 행에서 확인). v2는 "라벨 미확인이라 넣지 않는다"였는데 확인됐으므로 **넣는다** — Y5 규칙은 "확정 전까지 통과"이지 "확정 후에도 비움"이 아니다. `checkHeaders`는 경고만 내므로 위험 0.

### Z5. O-3 닫음 — 그림 문항 비중은 **Data_DS 39행 중 10행(26%)**, 파일 19개

문제 쪽 4행(07·13·26·29·30 중 30은 6개)·해설 쪽 6행. 세트 하나에 그림 19장이면 Stack 누적 후에는 세트당 15~20장 × 세트 수가 되므로 **D16(펼침 시 지연 로딩)의 체감 이득은 실재**한다. 결정 불변.

### Z6. O-4·O-5 닫음 — GAS·시트 실물은 v1에서 web이 직접 봤다

G1~G10은 GitHub `4dfa3aa` 소스 인용, S1~S7은 「문제 검토」 시트 본문과 Drive 메타데이터(19개 파일 크기·JPEG 헤더)에서 나왔다. v2가 "미검증"으로 남긴 것은 CLI의 접근 한계이지 사실 불확실성이 아니다. **닫는다.** 단 P1(패치 5 미push)은 여전히 열려 있다 — v3 시점에도 GitHub HEAD는 `4dfa3aa`.

### Z7. 문구 정정(사양 문서이므로 남긴다)

- v2 C8·D3′ "정지 ⑤ 뒤 / 정지 뒤" → **"선지 ⑤ 뒤 / 선지 뒤"**.
- v2 D7·§5-4 "검은 관문" → **"검수 관문"**(61a §6의 용어).
- v2 §5-0 "Vercel(Production·Preview)" → Development 포함 3환경(덕수가 이미 그렇게 등록).

### Z8. D15 구현 시 주의 두 가지 (승인에 덧붙임)

1. 보호 정규식 `(?<!\\)\\[A-Za-z]+\*?` 는 `\\`(줄바꿈)·`\$`·`\{`에 걸리지 않고 `\\[6pt]`도 통과한다(문자 `[`는 영문자가 아님). 증설 케이스로 못 박을 것.
2. 제어열의 중괄호 인자를 통째로 보호하면 **`\textbf{2개}`처럼 수식 밖 인자 안의 숫자·영문도 감싸지지 않는다.** 실데이터에서 수식 밖 제어열은 `\includegraphics`·`\begin`·`\item`·`\hline`이 사실상 전부라 실익이 없고, 반대로 인자를 열어 두면 C2가 재발한다. **전체 보호가 옳다** — 다만 이 트레이드오프를 `lib/proofread.ts` 주석에 남겨 훗날 "왜 `\textbf{3}`이 안 감싸지나"가 버그로 오인되지 않게 한다.

---

## 3. 확정 결정 (v2 20건 + v3 보정)

D1~D14 · D15~D20: **v2 그대로 확정.** 보정만 적는다.

| # | v3 보정 |
|---|---|
| **D3′** | (i) **미구현 확정**(Z3). 대신 choices raw_text에 `\includegraphics`가 있으면 경고 배지 + 자동 수정 제외. (ii) 선지 뒤 꼬리 그림 → choices 다음 독립 image 블록(불변) |
| **D7′** | 롤백 시 방금 올린 Storage 객체 best-effort `deleteObject` 추가(Z2). 규칙 변경 0 |
| **D13** | `SHEET_COL.problem = 1` **+ `EXPECTED_HEADERS.problem = 'problem'`**(Z4) |
| **D15** | 하니스는 **기존 `test:proofread` 증설**(Z1). 주석 규약(Z8-2) |

---

## 4. 영향 범위 (v3)

| 구분 | 내용 |
|---|---|
| 신규 | `app/api/sheet-import/figure/route.ts` |
| 수정 | `lib/proofread.ts`(D15) · `tests/proofread.test.mjs`(증설) · `lib/sheetImport.ts`(image DraftBlock · `problem` 열 · 분할 · choices 경고) · `tests/sheetImport.test.mjs`(증설) · `components/import/SheetImportModal.tsx`(프록시 fetch · 지연 로딩 · image 분기 · 자동 수정 토글 · 업로드 · **롤백 deleteObject**) · `.env` 1개 |
| 0건 | `firestore.rules` · `storage.rules` · `toPersistedBlock` · 렌더 5곳 · `app/api/sheet-import/route.ts` · `app/api/verify/*` · `package.json` 스크립트(이미 있음) · GAS 두 저장소 · 기존 문항 |
| 알고 두는 손실 | C1 — 그림이 image 블록이 되면 정밀 검증 모델이 그림 존재를 모른다. 61f 후보(D19) |

## 5. 작업 순서

v2 §5 그대로. 변경점: **1단계 관문에 "기존 17 케이스 무회귀 + 증설 4 케이스 통과"**, **5단계 관문에 "롤백 후 Storage `problems/{pid}/` 비어 있음"** 추가. 0단계(덕수 선행)는 완료됨 — P1(패치 5 push)만 남는다.

## 6. 남은 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| P1 | GAS 패치 5(`mergeHeader_`·`mpf_repairHeaders`) push | 열림 — 구현과 무관, 데이터 품질 |
| P2 | `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 열림 — GAS |
| P5 | J열 `diagram_boxes` 크기 필터(조각 그림 근본 대책) | 후속 |
| 61f | AI 교정 일괄(라우트 인증 + 결과 저장) · 검증용 `[그림]` 자리표시자(D19) | 후속 Phase |

---

*v3 최종 — 구현 착수 가능. 구현 계획서(v1 초안)는 이 문서의 §3·§4·§5를 사양으로 삼는다. 인용 원천: mathory `b3a9612` · gas-project-latex-convert `4dfa3aa` · 「문제 검토」 시트 2026-08-30.*
