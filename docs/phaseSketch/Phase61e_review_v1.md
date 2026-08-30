# Phase 61e 타당성 검토 — 시트 가져오기에 그림 블록·교정(proofread) 연동 (v1)

> 작성: web(Claude) 2026-08-30 · 상위: Phase 61a 시트 가져오기(✅ 배포) · 관련: Phase 27 교정, Phase 61b/61d 정밀 검증
> 실측 원천: GitHub `kimdeoksoo-71/gas-project-latex-convert` **HEAD `4dfa3aa`**(2026-08-30), `kimdeoksoo-71/mathory` **HEAD `b3a9612`**(2026-08-30), `gas-project-audition` `b6b91f6`. 로컬 사본 인용 없음(Phase 61a v5 Z2 규칙).
> 관례대로 CLI Claude 실측 교차검토(v2) 대상. 단, GAS 레포는 CLI가 볼 수 없으므로 §1-1의 GAS 사실은 이 문서가 원천이다.

---

## 0. 결론 한 줄

**두 요구 모두 타당하고 기존 아키텍처(서버=얇은 읽기 프록시, 저장=클라이언트, `toPersistedBlock` 단일 정형화) 안에서 구현 가능하다.** 다만 착수 전에 전제 두 가지를 바로잡아야 한다.

1. **그림 파일은 Data_DS에 없다.** GAS 패치 3은 `\includegraphics{<stem>_figN.jpg}` **파일명 문자열**만 본문에 남기고, 실제 파일은 덕수 Drive `PBMAI/IMAGE_FIG`에 **비공개**로 저장한다. Drive 링크(N열)는 Data_Latex에만 있고 Data_DS로 넘어가지 않는다. → Mathory가 파일을 **가져올 경로**를 새로 만들어야 한다(§3 D1).
2. **Mathory의 "교정"은 두 층이다.** ① 결정적 자동 수정(`autoFixDeterministicIssues`: 숫자·영문 `$` 감싸기, 조사 띄어쓰기, `(ㄱ)→(1)`, tabular→표 — **본문을 즉시 고친다**) ② AI(haiku) 제안(spelling/spacing/other — **표시 전용, 저장 구조 없음**). 가져오기 시점에 자연스럽게 얹히는 것은 ①이고, ②는 결과를 담을 그릇이 없어 별도 설계가 필요하다(§3 D8·D10).

---

## 1. 실측으로 확정된 사실

### 1-1. gas-project-latex-convert (HEAD `4dfa3aa`)

| # | 사실 | 위치 |
|---|---|---|
| G1 | 그림 있는 문항은 v3/pdf mmd의 `![alt](cdn.mathpix…)`을 **`\includegraphics{<stem>_fig1.jpg}` 로 치환**한다. 옵션·URL 없이 **파일명만**. 확장자는 CDN URL 기준(jpg/png 등) | `Mathpix 그림 추출.gs:52, 195-206` |
| G2 | 그림 파일은 Drive `PBMAI/IMAGE_FIG`(스크립트 속성 `MPF_FIG_FOLDER_PATH`)에 저장. **공유 설정 없음(setSharing 0건)** → 소유자 외 접근 불가 | `:42, 88-101, 183-188` |
| G3 | `INTO_LATEX=true`: 그림이 1개 이상이면 Data_Latex **C열(latex) ← O열(latex_fig)**, 원본 v3/text는 D열 보관 | `:40, 255-266` |
| G4 | Data_Latex → Data_DS는 **C열(latex)만** 읽어 A·B·C(key·문제·해설)에 기록. I~O(has_diagram·fig_links 등)는 **읽지 않는다** | `Datalatex_To_Data_DS.gs:36-39, 106, 148` |
| G5 | 따라서 Data_DS에는 B(문제)·C(해설)·E(stem) 안에 `\includegraphics{파일명}` **텍스트만** 도달한다. `_해설` 행도 같은 경로를 타므로 **해설에도 그림이 올 수 있다** | G3+G4 |
| G6 | 정규화는 `\includegraphics`를 **제거하지 않는다**. 선지가 `\includegraphics`·`![`로 시작하면 `$…$`로 감싸지 않는다 → **선지 안 그림도 가능**(그래프 개형 고르기 등) | `normalizeProblem.gs:194-201` |
| G7 | 문항 1개에 그림 여러 개 가능(`_fig1`, `_fig2`…). 같은 URL 반복은 같은 이름으로 치환 | `:195-206` |
| G8 | 정규화 신규: 번호 기반 선판정(공통 1~15/23~28 mcq, 16~22/29~30 short), 전체 텍스트 `MARK_RE` 토크나이저 + 5연속 창 선택, `NEED_REVIEW:MCQ_*`(E=원문 유지, F~J 공란), itemize 언랩, `정답 (n)`→`정답 ⓝ` | `normalizeProblem.gs:53-90, 92-178, 240-243, 212-218, 256-267` |
| G9 | ⚠️ **GitHub HEAD에 `mergeHeader_`(패치 5 해설 머리 복구)·`mpf_repairHeaders`가 없다.** 메뉴에도 `mpf_runRange`/`mpf_stop` 미등록 | grep 0건 · `MainMenu.gs:19-25` |
| G10 | latex-convert와 audition은 **서로 다른 스프레드시트에 묶인 별개 프로젝트**이며 `openById`로 상대를 여는 코드가 없다 → Latex변환.Data_DS → audition.Data_DS 이관은 **수동**. audition의 `normalizeProblem.gs`는 개정 전 판본 | `OcrConvert.gs:11`, audition `Movetostack.gs:12-19` |

### 1-2. Mathory (HEAD `b3a9612`)

| # | 사실 | 위치 |
|---|---|---|
| M1 | 시트 가져오기: `DraftBlock.type = 'text' \| 'choices'` **뿐**. 서버 라우트는 audition 시트 `A1:P` 읽기 전용, Firestore 무접촉, 4 MB 페이로드 상한 | `lib/sheetImport.ts:66-69`, `app/api/sheet-import/route.ts:33, 95-97` |
| M2 | 저장은 클라이언트: 미리보기 진입 시 `toPersistedBlock` 통과 배열을 확정해 **미리보기와 저장이 같은 배열**(Y1) → `createProblem` → `saveTabBlock`, 실패 시 `deleteProblem` 롤백(D7), 동시성 4 | `components/import/SheetImportModal.tsx:229-233, 262-323` |
| M3 | 라우트 인증 `verifyUid`(ID 토큰 → `accounts:lookup` → `AUDITION_ALLOWED_UIDS`, fail-closed). `/api/verify`도 공유 | `lib/apiAuth.ts:24-47` |
| M4 | **그림 블록** = `type:'image'`, URL은 `raw_text`의 `<img src="…" alt="…" width="400" />` 문자열. 렌더 5곳 전부 `raw_text.match(/src="([^"]+)"/)`로 추출. 표시 폭은 `imageWidth \|\| 400`, 기본 treatment = multiply 블렌드 + **흑백** | `types/problem.ts:224-246`, `EditorView.tsx:1929`, `TabBody.tsx:119-134` |
| M5 | 업로드 `uploadImage(file, problemId)` — 클라이언트에서 600px로 리사이즈 후 Storage `problems/{problemId}/{ts}-{name}` 저장, 공개 읽기. 규칙: 로그인 + `image/*` + 10 MB | `lib/storage.ts:7, 85-110`, `storage.rules:11-19` |
| M6 | text 블록 안의 마크다운/HTML `<img>`도 렌더된다(`rehypeRaw`). `ChoicesBlock`은 각 선지를 `EditorPreview`로 렌더 → **선지 텍스트 안 `<img>`도 렌더 가능** | `EditorPreview.tsx:315`, `ChoicesBlock.tsx:26-55` |
| M7 | **교정 ①** `autoFixDeterministicIssues(text, {skipJamoRefs})` — 순서: `\[`→`$$` → tabular→표 → `(ㄱ)`→`(1)` → 숫자 `$n$` → 영문 `$x$`/`$\mathrm{X}$` → 위첨자 중괄호·쉼표 → 조사 띄어쓰기. **본문 즉시 수정**(에디터에서는 `editor.setContent`). `image/svg/ggb` 제외, `roman/choices`는 `skipJamoRefs` | `lib/proofread.ts:716-809`, `EditorView.tsx:1364, 1409-1436` |
| M8 | **교정 ②** `/api/proofread`: **무인증**, `claude-haiku-4-5`, 현재 탭 블록 전부를 한 요청. 결과는 React state에만 있고 **Firestore에 저장되지 않는다**. `spelling/spacing/other`는 표시 전용, `정정` 버튼은 josa/brace/comma 3종만 | `app/api/proofread/route.ts:17, 94-151`, `ProofreadResultBox.tsx:36` |
| M9 | 일괄 처리 선례 = `lib/batchVerify.ts`(preflight 4병렬 → AI 직렬 → 401/403·3연속 실패 중단) + 순수 계획층 `lib/verify/batchPlan.ts`. **일괄 교정은 없다** | `batchVerify.ts:128-260` |
| M10 | `has_diagram`·`includegraphics` 검색 0건. 검증은 런타임 `hasMedia(blocks)`(image/svg/ggb 존재)로만 그림 인지 → 그림 블록으로 들어오면 **정밀 검증이 "그림 필요" 판정을 할 수 있게 되는 부수 효과** | `lib/verifyFlow.ts:32-34`, `verify/prompts.ts:91` |
| M11 | `sheetImport.ts`는 **import 0** 규약(X8). `lib/proofread.ts`는 `./latexScan`을 import | `sheetImport.ts:1-9` |

### 1-3. 시트·Drive 실물 (v1 보강, 2026-08-30 덕수 제공 링크로 직접 확인)

대상: 스프레드시트 **「문제 검토」** `1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk` (소유 kimdeoksoo@gmail.com, 수정 2026-08-30 20:37 KST). 시트 구성 = 선택항목 · Data1 · Data_Latex(**8열, 구판**) · split_* 3종 · **Data_DS(24열, 39행)** · **Stack(26열)** · Stat · 프롬프트 시트 → **audition 프로젝트가 붙은 시트**다. Latex 변환 파이프라인의 신규 열(I~O)은 여기 없다 → G10(수동 이관)과 정합. `AUDITION_SPREADSHEET_ID`가 이 ID인지 덕수 확인 필요.

| # | 실물 사실 | 근거 |
|---|---|---|
| S1 | Data_DS 39행 중 **연구실모의6회(260824)** 세트가 `\includegraphics{…_figN.jpg}`를 **B·C·E 텍스트로** 갖고 있다(그림 링크 열 없음, ncols=24). G5 확인 | Data_DS 1공통07·09·12·13·14·21, 3확통29·30, 4미적26·28 |
| S2 | 그림 위치 유형 3가지: ① 본문 중간("그래프가 그림과 같다. `\includegraphics` 모든 실수…" — 07) ② 배점 뒤·선지 앞(4미적26) ③ **선지 ⑤ 뒤(1공통13)**. 해설은 풀이 흐름 중간(09·12·13·14·28) | 위 행 |
| S3 | ⚠️ **1공통13: `\includegraphics`가 선지 ⑤ 뒤에 있어 정규화가 trailer로 잘라냈다 → B에는 있으나 E·F~J 어디에도 없다.** E만 읽으면 그림이 사라진다 | B에 있고 E에 없음 |
| S4 | 그림 다수 문항: 3확통30 = `_fig1`~`_fig6` 6개(각 142×320px, ~10KB — 동전·주사위 아이콘 조각으로 추정), 3확통29 = 733×82px 띠(표준정규분포표 옆 조각). 1공통07 = 620×736 정상 그래프. **Mathpix 잘라내기 결과의 품질이 고르지 않다** | Drive 파일 크기·JPEG 헤더 |
| S5 | Drive `PBMAI/IMAGE_FIG` 폴더 ID **`1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`**, 파일 19개, 전부 `image/jpeg` 7~46KB, 소유자 덕수, 공유 없음 | Drive 검색 |
| S6 | 해설 머리(`9. 정답 ②`)가 살아 있다 → 패치 5는 **로컬 GAS에 적용돼 데이터에 반영됐지만 GitHub에는 없다**(G9). 단 1공통07 해설은 `7. - $\lim…`으로 시작해 정답 머리가 없다(D열은 채워짐) | Data_DS C열 |
| S7 | stem이 `7. 실수 전체의…`처럼 **문항 번호로 시작**한다 — 61a 때부터 그대로 들어오던 형태(마크다운 순서 목록으로 렌더될 수 있음). 이번 Phase 범위 밖이지만 D9의 자동 수정이 `7.`을 목록 마커로 보호하므로 악화되지는 않는다 | Data_DS E열 |

---

## 2. 설계 골격 (결정 D1~D14를 전제로 한 추천안)

### 2-1. 그림 → 그림 블록

```
Data_DS E/C 텍스트                          서버                       클라이언트
"…그림과 같이 \includegraphics{X_fig1.jpg} …"
        │ rowToDraft: 파일명에서 분할
        ▼
[text][image{figName}][text] (+choices)
        │ 미리보기: /api/sheet-import/figure?name=X_fig1.jpg ──► SA가 Drive IMAGE_FIG에서 이름 검색 → bytes
        │                                                          (verifyUid 동일 인증, drive.readonly)
        ▼
미리보기에 실제 그림 표시(blob URL)
        │ 저장: createProblem → uploadImage(blob→File, problemId) → URL
        ▼
toPersistedBlock({type:'image', raw_text:`<img src="${url}" alt="${figName}" width="400" />`})
```

- **변환(`lib/sheetImport.ts`)**: `\includegraphics\{([^}]+)\}` (+ 안전망으로 `![alt](url)`)를 경계로 E·C·O·P를 분할. `DraftBlock`에 `{ type:'image'; figName: string }` 추가. 빈 텍스트 조각은 버린다(Y3 — 배열 인덱스가 order). 파일명은 `warnings`가 아니라 draft에 남겨 미리보기 배지로 노출.
- **서버(신규 `app/api/sheet-import/figure/route.ts`)**: 기존 SA·`verifyUid` 재사용. Drive REST `files?q=name='…' and '<FOLDER_ID>' in parents and trashed=false` → `files/{id}?alt=media`. 스코프 `drive.readonly` 추가. 파일명은 화이트리스트 정규식(`^[\w가-힣()\-.]+_fig\d+\.(jpe?g|png|gif|webp)$`)으로 검사. 응답은 바이트 + content-type. 미발견 404.
- **저장(`SheetImportModal`)**: `createProblem` 직후 `problemId`로 `uploadImage` → 그때 `raw_text` 확정. **Y1 예외 1건을 명시**: 미리보기의 `src`(blob)와 저장의 `src`(Storage URL)만 다르고 나머지는 동일. 업로드 실패는 D7 롤백에 포함.
- **환경변수**: `AUDITION_FIG_FOLDER_ID` 1개. 덕수 작업: Drive API 활성화, `PBMAI/IMAGE_FIG`를 SA 이메일에 **뷰어** 공유, 폴더 ID 등록.
- **건드리지 않는 것**: Firestore 규칙·Storage 규칙·`toPersistedBlock`·렌더 5곳·GAS.

### 2-2. 가져온 문제·해설에 교정 실행

- **① 결정적 자동 수정(이번 Phase)**: `SheetImportModal`에서 `rowToDraft` 결과 → **`autoFixDeterministicIssues` → `toPersistedBlock`** 순으로 적용하고 그 결과를 미리보기와 저장이 공유(Y1 유지). 대상 = text 블록(문제·풀이·AI풀이), `choices`는 `skipJamoRefs:true`, image 제외 — 에디터 관례(M7)와 동일. 마법사 폼에 `[가져오면서 문법 자동 수정 적용]` 체크박스, 미리보기 행에 `자동 수정 n건` 배지.
  - `sheetImport.ts`의 import 0 규약을 지키기 위해 **호출은 모달에서**, `sheetImport.ts`는 순수 변환만.
  - `(ㄱ)→(1)` 변환이 여기서 일어난다 — 2026-08-30 "GAS에서는 (ㄱ)→(1) 변환 안 함" 결정과 정합(Mathory가 담당).
- **② AI 제안(후속 Phase 61f로 분리 권고)**: 결과를 담을 저장 구조가 없고 라우트가 무인증이라 일괄 호출에 부적합. 61f = `/api/proofread`에 `verifyUid` 인증 → `batchVerify` 골격을 본뜬 일괄 교정 → 결과를 `problems/{id}` 하위(예: `proofread_pending`)에 저장 → 에디터 진입 시 `ProofreadResultBox`로 복원. 가져오기 완료 화면에 "이 문항들 AI 교정 실행" 버튼으로 연결.

---

## 3. 결정해야 할 사항 (추천안 첫 번째)

| # | 결정 | 선택지 | 추천 · 근거 |
|---|---|---|---|
| **D1** | **그림 파일을 어떻게 얻나** | (a) SA가 Drive `IMAGE_FIG`에서 **파일명으로 검색** (b) GAS `Datalatex_To_Data_DS`가 Data_DS 빈 열(L)에 `fig_links`를 기록하고 Mathory가 file id로 읽기 (c) Drive 공개 링크(`uc?id=`)를 그대로 `<img src>` | **(a)**. 본문에 이미 파일명이 있고 stem이 시험지명을 포함해 유일하다. GAS·시트 스키마 변경 0, 수동 이관(G10)에도 무관. (b)는 이관 시 L열 보존이 필요하고 두 프로젝트를 동시에 고쳐야 한다. (c)는 Drive 공개화 + 외부 핫링크라 Mathory의 자체 호스팅 원칙과 어긋나고 삭제·권한 변경에 취약 |
| **D2** | 그림 블록 위치 | (a) **본문을 파일명 위치에서 분할**(text/image/text) (b) 본문 뒤에 일괄 배치 | **(a)**. 수능 문항은 "그림과 같이 …" 문장 뒤에 그림이 오고 이어서 조건이 나온다. (b)는 읽는 순서가 깨진다. "블록 자동 분할 금지"(61a §7)의 **명시적 예외**로 기록 — 이번 요구의 본질이 분할이다 |
| **D3** | 선지 안 그림 (G6) | (a) 선지 텍스트에 **inline `<img src=… width=…>`로 치환** (b) 경고만 남기고 문자열 유지 | **(a)**. `ChoicesBlock`이 `EditorPreview`로 렌더하므로 추가 코드 없이 표시된다(M6). 다만 폭은 본문 400이 아닌 작은 값(예: 160)이 필요 → D4와 함께 결정. 선지 5개 모두 그림인 문항은 미리보기에서 반드시 확인(검수 관문) |
| **D4** | 그림 블록 기본 속성 | (a) 기존 기본값 그대로(`imageWidth` 미설정=400, blend+흑백) (b) 가져오기 전용 기본값(예: 폭 300) | **(a)**. 시험지 그림은 흑백 선화라 multiply 블렌드가 맞고, 에디터에서 만든 그림과 규칙이 같아야 한다. 선지 inline만 별도 폭 |
| **D5** | 그림 파일 미발견·다운로드 실패 시 | (a) 경고 배지 + `\includegraphics{…}` **리터럴 유지**, 문항은 저장 (b) 해당 행 오류 처리(저장 불가) (c) 문항 저장 후 빈 image 블록 | **(a)**. 리터럴 보존 규약에 맞고, 나중에 검색(`includegraphics`)으로 되찾아 수동 보완할 수 있다. (c)는 `(이미지 없음)`만 렌더돼 원인 추적이 안 된다 |
| **D6** | 업로드 주체 | (a) **클라이언트 `uploadImage`**(서버는 바이트 프록시) (b) 서버가 Admin SDK로 Storage에 직접 저장 | **(a)**. 61a 아키텍처(저장=클라이언트) 유지, Storage 규칙 변경 0, Admin SDK 도입 불필요. 서버 프록시 응답은 이미지 1장씩(수백 KB)이라 4 MB 상한 무관 |
| **D7** | 미리보기에서 그림 | (a) **서버 프록시로 받아 실제 그림 표시** (b) 파일명 배지만 | **(a)**. 스텝 3 검수 관문(61a §6)에서 "저장될 실물"을 봐야 한다는 원칙. 프록시 결과를 캐시해 저장 시 재다운로드하지 않는다 |
| **D8** | **가져오기 시 교정 범위** | (a) **결정적 자동 수정만** (b) ①+② AI 제안까지 (c) 아무것도 안 하고 에디터에 맡김 | **(a)**. ②는 결과 저장 구조가 없어 가져오기 직후 사라진다(M8). (a)는 동기·무료·결정적이며 미리보기=저장 원칙과 양립. 사용자가 원한 "proofread 실행"의 실질(본문 정돈)은 ①이 담당 |
| **D9** | 자동 수정 기본값 | (a) **기본 ON + 해제 체크박스** (b) 기본 OFF | **(a)**. 에디터에서 교정 버튼을 누르면 어차피 적용되는 규칙이고, 미리보기에서 결과를 확인한다. 단 `자동 수정 n건` 배지로 개입 사실을 드러낸다 |
| **D10** | AI 교정(②)의 형태 | (a) **후속 61f: 라우트 인증 + 일괄 교정 + 결과 저장** (b) 에디터 첫 진입 시 자동 실행 (c) 가져오기 직후 AI 결과를 본문에 자동 적용 | **(a)**. (b)는 매 진입마다 비용·지연. (c)는 "표시 전용" 설계(M8)와 보수적 운영 철학을 깬다 — AI spelling 제안 자동 적용 금지 |
| **D11** | 읽는 스프레드시트 | (a) **audition 유지**(현행) (b) Latex변환 시트를 직접 읽기 | **(a)**. 파일명 텍스트는 수동 이관에도 그대로 살아남고(G5), 검증 결과(N~X)도 audition에만 있다. 그림 폴더는 어느 시트를 읽든 같은 Drive라 무관 |
| **D12** | 서버 프록시 인증·범위 | (a) **`verifyUid` + 허용목록 + 폴더 ID 고정 + 파일명 화이트리스트** (b) 파일명만 검사 | **(a)**. 무인증이면 Drive 폴더 전체가 인터넷에 노출된다(61a D1과 같은 이유). `name` 검색을 폴더 ID로 한정해 다른 폴더 파일이 새지 않게 한다 |
| **D13** | **선지 뒤 그림이 E에서 사라진 경우(S3)** | (a) **Mathory가 B열(problem)도 읽어 E·F~J에 없는 파일명을 찾아 문제 탭 끝(선지 블록 뒤)에 image 블록으로 붙이고 경고** (b) GAS `normalizeProblem`에서 `\includegraphics`만 남은 trailer를 stem 끝으로 이동 (c) 무시 | **(a)**, 가능하면 (b)도. (a)는 A1:P 범위 안(B=index 1)이라 라우트 변경 0이고 이미 이관된 세트에도 효과가 있다. (b)는 원천 교정이라 검증(N~X)에도 이롭지만 GAS 수정·push가 전제. 위치는 "선지 뒤"가 원문 순서(Mathpix 읽기 순서)이기도 하다 |
| **D14** | **품질이 낮은 조각 그림(S4)** | (a) **전부 가져오고 미리보기에 썸네일 + 그림 ≥3개 경고 배지, 삭제는 에디터에서** (b) 크기 임계(예: 200px 미만) 자동 제외 (c) 미리보기에서 그림별 체크박스 | **(a)**. 무엇이 진짜 그림인지 Mathory가 추측하지 않는다(보수적 운영). (b)는 작은 정상 그림(수직선·기호)을 잃을 수 있고, (c)는 UI 비용 대비 빈도가 낮다. 근본 대책은 GAS 쪽(J열 `diagram_boxes`의 크기로 사전 필터)이며 후속 검토 항목으로 남긴다 |

### 3-1. GAS 쪽 확인·보완 (구현 전제는 아님, 권고)

| # | 항목 | 비고 |
|---|---|---|
| P1 | **패치 5(`mergeHeader_`·`mpf_repairHeaders`)가 GitHub에 없다(G9).** 로컬에만 있으면 push 필요 — 해설 첫 줄(문항번호·정답)이 사라진 행은 D열(given_answer) 추출이 실패하고, Mathory 풀이 탭도 머리 없이 들어온다 | 이 Phase는 그 결과를 그대로 가져올 뿐 고치지 않는다 |
| P2 | `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 미등록 → `no_pdf`/`error` 행 재시도 경로가 UI에 없다 | 1줄 추가 |
| P3 | audition의 `normalizeProblem.gs`는 개정 전 판본 — 같은 행을 두 곳에서 정규화하면 결과가 다르다 | 정규화는 Latex변환에서만 하고 audition은 이관·검증 전용으로 두면 무관 |
| P5 | 3확통29·30처럼 표 옆 띠·아이콘 조각이 그림으로 잘리는 사례(S4) — 패치 1의 J열 `diagram_boxes`에 크기가 있으므로 GAS에서 최소 크기 임계로 걸러낼 수 있다 | D14의 근본 대책, 후속 |
| P4 | 파일명에 `(`·`)`·한글이 들어간다(`S팀모의6회(260722)_문제_1공통14_fig1.jpg`). Drive 검색 `q`에서 `'` 이스케이프, Storage 업로드 시 `uploadImage`가 이름을 그대로 쓰므로 URL 인코딩은 SDK가 처리 | 구현 시 테스트 케이스에 포함 |

---

## 4. 영향 범위

| 구분 | 내용 |
|---|---|
| 신규 | `app/api/sheet-import/figure/route.ts` · `tests` 케이스(분할·선지 inline·미발견) |
| 수정 | `lib/sheetImport.ts`(`DraftBlock` image 추가·분할) · `components/import/SheetImportModal.tsx`(그림 프록시·업로드·자동 수정 토글) · `app/api/sheet-import/route.ts`(JWT 스코프에 `drive.readonly` 추가 — 시트 라우트와 SA 공유) · `.env` 1개 |
| 0건 | `firestore.rules` · `storage.rules` · `toPersistedBlock` · 렌더 5곳 · `lib/proofread.ts` · GAS 두 프로젝트 · 기존 문항 |
| 부수 효과 | 그림 문항이 image 블록을 갖게 되어 정밀 검증(61b/61d)의 `hasImages`가 참이 된다(M10) — 검증 프롬프트가 "그림을 봐야 판단" 시 skip/uncertain 처리. 의도한 방향 |
| 중복 검사 | `stemHash`는 E 원문(파일명 포함)으로 계산 → 변경 없음. 같은 행 재가져오기는 기존 규칙 그대로 |

## 5. 작업 순서 (안)

1. 덕수: Drive API 활성화 · `IMAGE_FIG`(`1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`) 폴더를 SA에 뷰어 공유 · `AUDITION_FIG_FOLDER_ID` 등록 · (P1) 패치 5 push
   - Drive API 활성화 절차: Google Cloud 콘솔(console.cloud.google.com) → 상단 프로젝트 선택기에서 **Mathory Firebase 프로젝트(서비스 계정 `GOOGLE_SA_EMAIL`이 속한 프로젝트)** 선택 → 왼쪽 메뉴 **API 및 서비스 → 라이브러리** → "Google Drive API" 검색 → **사용(Enable)**. 새 키 발급·OAuth 동의 화면 설정은 필요 없다(서비스 계정 + 폴더 공유만으로 읽힌다).
   - 폴더 공유: Drive에서 `PBMAI/IMAGE_FIG` 우클릭 → 공유 → `GOOGLE_SA_EMAIL`(…@…iam.gserviceaccount.com) 추가, 역할 **뷰어**, 알림 해제.
   - 검증: 구현 스텝 3에서 라우트가 `연구실모의6회(260824)_문제_1공통07_fig1.jpg`를 200으로 돌려주면 완료. 403이면 공유 누락, `accessNotConfigured`면 API 미활성화.
2. `sheetImport.ts` 분할 + 테스트 → 3. figure 프록시 라우트(인증·404·화이트리스트) → 4. 미리보기에 그림·자동 수정 배지(**검수 관문**: 실데이터 그림 문항 5건 이상, 선지 그림 1건 이상) → 5. 저장(업로드→URL→블록) + 롤백 → 6. 결과 요약·문서

---

*v1 — web 초안. CLI 교차검토(v2)에서 특히 확인할 것: M4 `<img>` 형식·`uploadImage` 시그니처, `autoFixDeterministicIssues`를 `toPersistedBlock` 앞에 두었을 때 `$$` 정규화 소유권(Y1)과 충돌이 없는지, Drive REST 검색 쿼리 이스케이프.*
