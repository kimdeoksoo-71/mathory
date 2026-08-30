# Phase 61e — 시트 가져오기 × 그림 블록 · 교정 연동 (v5 실행판 = 구현 기록)

> 계보: v1(web 타당성) → v2(CLI 실측 교차검토 C1~C9 · N1~N10 · D15~D20) → v3(web 재검증 Z1~Z8)
> → v4(CLI 착수판) → **v5 실행판 = 실제로 구현된 것.** 이전 판을 인용하기 전에 §3(계획 번복)을 볼 것.
> 구현·검수 완료 2026-08-30 · 덕수 실물 검수 통과. 커밋 6개(0~5).
> 인용 원천: mathory `b3a9612` 기준 · gas-project-latex-convert `4dfa3aa` · 「문제 검토」 시트 2026-08-30.

---

## 0. 한 줄

**Data_DS 본문에 문자열로만 남아 있던 `\includegraphics{…}`를 Drive에서 실물로 받아 image 블록으로
바꾸고, 가져오는 김에 편집창의 결정적 자동 수정을 한 번 태운다.**

서버 라우트 1개 신설(읽기 프록시) · **Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 ·
블록 타입 union 0 · 전처리 파이프라인 0 · 렌더 5곳 0.**
⚠ **Storage 규칙은 1건 변경**했다(§2 커밋 0) — v1~v3이 "0건"으로 적었던 자리다.

---

## 1. 이 Phase가 실제로 고친 두 가지 사실

### 1-1. 그림은 Data_DS에 없다

GAS 패치 3이 v3/pdf mmd의 `![alt](cdn.mathpix…)`를 **`\includegraphics{<stem>_figN.jpg}` 파일명
문자열로 치환**하고 실물은 Drive `PBMAI/IMAGE_FIG`에 **비공개로** 저장한다. Drive 링크(N열)는
Data_Latex에만 있고 `Datalatex_To_Data_DS`가 **C열(latex)만** 읽으므로 Data_DS로 넘어오지 않는다.
→ Mathory가 **파일명으로 실물을 가져오는 경로**를 새로 만들었다.

### 1-2. ⚠ 자동 수정이 그 파일명을 파괴하고 있었다 (이 Phase의 가장 값비싼 발견)

`autoWrapBareLetters`·`autoWrapBareNumbers`의 보호 목록에 수식·HTML·URL·코드·`\tag`/`\ref`는
있었지만 **일반 LaTeX 제어열이 없었다.** 실행 프로브 결과:

```
IN : \includegraphics{S학모의6회(260722)_문제_1공통14_fig1.jpg}
OUT: \$includegraphics${$\mathrm{S}$학모의$6$회(260722)_문제_$1$공통$14$_fig1.$jpg$}   count 6
IN : \begin{itemize}\n\item 첫째 조건\n\end{itemize}
OUT: \$begin${$itemize$}\n\$item$ 첫째 조건\n\$end${$itemize$}                          count 6
```

편집창에도 이미 있던 버그다. 다만 가져오기는 **수십 문항에 일괄로, 사람이 각 문항을 보지 않은 채**
적용한다 — 파일명이 조각나면 `includegraphics`로 **검색조차 되지 않아** 복구 경로(D5)가 소멸한다.
그래서 **커밋 1이 이 보호**이고, 그것이 커밋 4·5의 실패 폴백이 성립하는 전제다.

---

## 2. 커밋별 구현 기록

### 커밋 0 — `storage.rules`의 `write`를 `create,update` / `delete`로 분리 (`bde960d`)

롤백에서 Storage 객체를 지우려면 규칙을 갈라야 한다.

```
allow create, update: if request.auth != null && request.resource.size < 10MB && (…contentType…);
allow delete:         if request.auth != null;
```

⚠ **delete 요청에는 `request.resource`가 없다**(쓰이는 객체가 없으므로 null). null의 `.size`를
읽으면 조건이 **오류로 평가되어 거부**된다 → `deleteObject`가 100% 실패하는데 best-effort 호출이라
**조용히 실패한다**("지우는 줄 알았는데 아무것도 안 지워지는" 가장 나쁜 형태).
⚠ `delete` 조건이 `request.auth != null`뿐인 것은 **권한 완화가 아니다** — `create,update`가 이미
같은 조건이라 로그인 사용자는 남의 객체를 덮어쓸 수 있었다. Storage 규칙은 Firestore를 못 읽고
경로에 uid가 없어(`problems/{problemId}/…`) 소유자 단위로 좁힐 수단이 없다. 경로 설계부터 바꿔야 한다.

**규칙 선배포**(`firebase deploy --only storage` → `mathory-d7d03`)를 코드보다 먼저 했다.
`create,update` 조건이 기존 `write`와 글자 그대로 같고 delete를 부르는 코드가 아직 없어 안전하다.

### 커밋 1 — `lib/proofread.ts` LaTeX 제어열 보호 (`bb34d2c`)

공용 헬퍼 `collectControlSeqRanges` 하나를 `autoWrapBareNumbers`·`autoWrapBareLetters`가 부른다.

- 제어열 본체 `(?<!\\)\\[A-Za-z]+\*?` → `\\`(줄바꿈)·`\$`·`\{`에 걸리지 않고 `\\[6pt]`도 무사하다.
- 뒤따르는 `[opt]`·`{arg}`를 흡수한다. **중괄호는 `readGroup`(lib/latexScan.ts)의 균형 스캔**으로
  — 정규식 `\{[^}]*\}`는 `\frac{\frac{1}{2}}{3}` 같은 중첩에서 잘못 끊긴다(개선묶음 M1 W2).
- `readGroup`이 −1(짝 없음)이면 제어열 본체까지만 보호하고 변환하지 않는다.

⚠ **트레이드오프**: 인자를 통째로 보호하므로 **`\textbf{2개}`의 `2`는 수식화되지 않는다.**
실데이터의 텍스트 영역 제어열은 `\includegraphics`·`\begin`·`\item`·`\hline`이 사실상 전부라
잃는 것이 없고, 인자를 열어 두면 위 파괴가 재발한다. **"왜 `\textbf{3}`은 안 감싸지나"를 버그로
오인하지 말 것** — 파일 주석에 남겼다.

⚠ **`convertJamoRefs`에는 넣지 않았다.** 그쪽은 `\text{(ㄱ)}`처럼 제어열 인자 안의 참조까지
변환하는 것이 **명시된 사양**이다(덕수 2026-08-26). 세 함수가 `collectMathRanges`를 공유해
"통일"하고 싶어지는 자리인데, 통일하면 그 결정이 조용히 뒤집힌다. 테스트 P-8이 고정한다.

### 커밋 2 — `lib/sheetImport.ts` 분할 · B열 · 경고 (`59e078d`)

```ts
export interface DraftBlock { type: 'text' | 'choices' | 'image'; raw_text: string; figName?: string }
export function splitFigures(text): { blocks, figNames, warnings }
export function scanFigureNames(text): string[]
SHEET_COL.problem = 1            // B — 본문으로 쓰지 않고 그림 파일명 복구에만
EXPECTED_HEADERS.problem = 'problem'
```

- **그림이 하나도 없으면 원문 그대로 text 블록 1개**를 돌려준다(빈 문자열이어도). 61a의 기존
  동작과 비트 단위로 같아야 하므로 **이 갈래를 없애지 말 것.**
- 빈/공백뿐인 조각은 버린다(순서는 배열 인덱스가 소유 — Y3).
- **`stemHash`는 분할 전 값**이다. 분할·자동 수정이 앞서면 가져오기 옵션에 따라 중복 키가 바뀌어
  같은 문항이 **두 벌** 저장된다. 테스트 G1이 고정한다.
- **D13 B열 복구**: GAS 정규화가 선택지 뒤 `\includegraphics`를 trailer로 잘라내 E에서 사라지지만
  원문인 B에는 남는다. B에만 있는 이름을 문제 탭 **맨 끝**(= 선택지 뒤)에 붙이고 경고한다.
- **D21**: `![](url)` 잔재는 **분할하지 않는다** — 오늘도 `EditorPreview`가 마크다운 이미지로
  렌더하고, 분할하려면 Drive가 아닌 외부 URL 경로가 필요해져 프록시의 폴더 고정(D12)이 무너진다.
- **O열(AI 정답)은 분할하지 않는다** — 고정 접두 `**AI 정답:** `가 떨어져 나간다. 경고만.
- `INCLUDEGRAPHICS_RE`가 `\{[^}]*\}`를 쓰는 것은 **M1 W2 규약의 예외가 아니라 적용 대상이 아니다**
  — GAS가 만드는 이름은 `<stem>_figN.<ext>`뿐이라 중괄호가 들어갈 수 없다.

### 커밋 3 — `app/api/sheet-import/figure/route.ts` 신설 (`866d1cf`)

```
GET /api/sheet-import/figure?name=<파일명>   headers: Authorization: Bearer <ID token>
200 이미지 바이트 (Content-Type 원본 · Cache-Control private,no-store · X-Fig-Duplicates: n)
400 화이트리스트 위반 · 401/403 인증 · 404 미발견 · 502 Drive
```

- **자기 JWT 싱글턴**, 스코프 `drive.readonly` **단독**. ⚠ `../route.ts`(시트 읽기)는 **한 줄도
  건드리지 않았다** — 그쪽 JWT는 `spreadsheets.readonly` 하나로 잠겨 있어 "안 부르는" 게 아니라
  "못 부른다". 공용 JWT에 스코프를 더하면 그 잠금이 시트 라우트에서도 느슨해진다.
- 4중 게이트: `verifyUid` + 허용목록 + 폴더 ID 고정 + 파일명 화이트리스트
  `/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ()._\-]{1,200}_fig\d+\.(jpe?g|png|gif|webp)$/`.
  **작은따옴표를 배제**해 Drive 검색 `q`의 이스케이프를 아예 불필요하게 만들었다 —
  "이스케이프를 올바로 하기"보다 **"이스케이프할 문자가 못 들어오게 하기"** 가 안전하다.
- **Drive는 동명 파일을 허용한다**(GAS 재실행). `orderBy=modifiedTime desc&pageSize=2`로 최신을
  고르고 개수를 `X-Fig-Duplicates`로 알린다. 정렬 없이 `files[0]`을 쓰면 판본이 불확정이다.
- 환경변수 `AUDITION_FIG_FOLDER_ID` 추가. `readEnv()`는 **핸들러 안에서만** 부른다(61a 규약 —
  변수가 없어도 빌드가 깨지지 않고 호출 시 500으로 이름만 알린다).

### 커밋 4·5 — `SheetImportModal` · `lib/storage.ts` (`9f158a0`)

**미리보기(D7·D16·D18)**
- **행을 펼칠 때 그 행의 그림만** 받는다. 미리보기는 원래 펼친 행 하나만 렌더하므로
  (`expanded`는 단일 rowIndex) 전건 선다운로드는 아무도 안 볼 그림 수백 장을 받는 것이다.
- 렌더 분기를 **셋으로**: `choices` / `image` / 그 외. image를 `EditorPreview`에 raw로 흘리면
  컬러 400px로 뜨고 저장 후엔 흑백 multiply라 "미리보기 = 저장될 실물"이 깨진다 →
  `TabBody`와 같은 마크업 + `imageTreatmentStyle`.
- ⚠ "렌더 5곳"에 **여섯 번째를 만든 것이 아니다** — 모달은 미리보기 전용이고 스타일 함수를 공유한다.
- 인증 헤더가 필요하므로 `<img src="/api/…">`는 **불가**(401) → `fetch` → `blob()` →
  `createObjectURL`. blob URL은 언마운트에서 `revokeObjectURL`.

**자동 수정(D8·D9)**
- 3단계에 `[가져오면서 문법 자동 수정 적용]` 체크박스, **기본 ON**. 미리보기에 건수 배지.
- **순서가 규칙이다**: `rowToDraft → splitFigures → autoFix → toPersistedBlock`.
  autoFix가 `\[..\]`·tabular를 새 `$$`로 바꾸고 `toPersistedBlock`이 그 `$$` 앞뒤 빈 줄을 소유한다.
- 제외는 편집창과 같다(`image`·`svg`·`ggb`). `choices`는 `skipJamoRefs`만 켠다.
  `\includegraphics`가 남은 choices는 통째로 건너뛴다(D3′).
- 호출부는 **모달**이다 — `lib/sheetImport.ts`는 **import 0 규약**이라 `proofread`를 못 부른다.

**저장(D6·D17·D7″)**
- 파일명 → Storage URL 맵으로 **문항 안에서 한 번씩만** 올린다(문제·해설이 같은 그림을 가리키는
  것이 정상이다). content-type을 `File`에 실어야 `uploadImage`가 확장자를 옳게 고른다.
- `persisted[tab][i]`와 `draft.blocksByTab[tab][i]`의 **인덱스 정렬**로 파일명을 찾는다
  (`persisted`를 `.map()`으로 만들기 때문). **그 정렬을 깨지 말 것.**
- 그림 실패는 **저장을 막지 않고** 그 블록만 `text` + `\includegraphics{…}` 리터럴로 되돌린다.
  ⚠ **그 리터럴이 온전한 것은 커밋 1 덕분이다** — 보호를 걷어내면 복구 경로가 통째로 죽는다.
- 롤백에서 방금 올린 Storage 객체를 best-effort 삭제. `lib/storage.ts`에 `deleteUploadedFile` 신설
  (`ref(storage, url)`은 https 다운로드 URL을 그대로 받는다 — 경로를 직접 조립하지 말 것).

⚠ **`setFigs`는 비동기 반영이라 저장은 스냅샷을 직접 들고 간다** — state를 기다리면 첫 문항이
그림 없이 저장된다. 다운로드 로직은 모듈 함수 `fetchFigures` **하나**를 미리보기·저장이 공유한다.

⚠ **`FigEntry`의 판별자는 문자열이다** — tsconfig가 `strict: false`라 boolean 리터럴(`ok: true`)로는
좁혀지지 않는다(실측: `Property 'error' does not exist on type 'FigEntry'`).

---

## 3. 계획을 뒤집은 것 (v1~v4를 인용하기 전에 읽을 것)

| # | 계획 | 실제 | 이유 |
|---|---|---|---|
| **R1** | v1~v3: `storage.rules` **0건** | **1건 변경 + 선배포** | delete에는 `request.resource`가 없어 기존 `write` 조건이 오류로 죽는다. 그대로 뒀으면 롤백 삭제가 **조용히 100% 실패**했다 |
| **R2** | v1 §4: 그림 블록화로 정밀 검증이 "그림 필요"를 알게 된다(의도한 방향) | **반대다. 손실로 기록** | `hasImages`는 `route.ts:116`에 선언만 있고 아무도 읽지 않는 **죽은 필드**. image 블록은 `verifyBlocksOf`가 걸러내므로 모델은 그림의 **존재조차 모르게** 된다 |
| **R3** | v2 D15: `test:proofread` **신설** | **기존 하니스 증설**(17 → 26) | v3 Z1 — 이미 있었다 |
| **R4** | v1 D3: 선택지에 인라인 `<img>` | **(i) 미구현, 경고만** | O-1 실측 0건(F~J 열 전량). S3(1공통13)은 "선택지 **안**"이 아니라 "선택지 **뒤**"였다 — 두 현상을 v1이 뭉뚱그렸다 |
| **R5** | v1 §2-1: `![](url)`도 경계로 삼는다 | **분할하지 않고 경고만**(D21) | 오늘도 마크다운 이미지로 렌더된다. 분할하려면 외부 URL 다운로드 경로가 필요해져 프록시의 폴더 고정이 무너진다 |
| **R6** | v1 §2-1: E·C·O·P 분할 | **E·C·P만. O는 경고만** | O는 정답 값 한 줄이고 `**AI 정답:** ` 고정 접두가 붙는다 — 쪼개면 접두가 떨어져 나간다 |
| **R7** | v4 §3-1: 제어열 본체 + `{arg}` 보호 | **`[opt]`도 흡수** | `\includegraphics[width=5cm]{name}`에서 `{` 흡수가 시작되지 않아 **파일명까지 통째로 무방비**가 됐다. 실데이터엔 옵션이 없지만 실패 모드가 심하다 |
| **R8** | v4 §3-2: N-8 경고 | **그림이 있을 때만 발화** | E가 통째로 비면 "E열이 비어 있습니다"와 **함께** 울려 같은 사실을 두 번 말하고 원인을 흐렸다(기존 테스트 D7이 잡았다) |
| **R9** | v2 §4: `app/api/sheet-import/route.ts` 수정(스코프 추가) | **0건** | figure 라우트가 자기 JWT를 갖는다. 공용 JWT 확장은 시트 라우트의 잠금까지 느슨하게 한다 |

---

## 4. 검증

**로직 검증 262 → 289개** (`test:proofread` 17→26 · `test:sheet` 35→53). 나머지 8종 무회귀.
`tsc --noEmit` 클린.

**라우트 실측**(dev 서버 + 실제 Drive, ID 토큰 발급해 9경로):

| 경로 | 결과 |
|---|---|
| 토큰 없음 / 잘못된 토큰 | 401 |
| 허용목록 밖 uid | 403 |
| `연구실모의6회(260824)_문제_1공통07_fig1.jpg` | **200 · image/jpeg · 23,379B · dup=1** |
| 없는 이름 | 404 |
| `../../etc/passwd` · `_figN` 없음 · 작은따옴표 주입 · `name` 누락 | 400 |

**실데이터 파이프라인 프로브**(Data_DS 38행):

| 항목 | 결과 |
|---|---|
| 그림 문항 | **10행**(v3 Z5의 26%와 일치) |
| D13 B열 복구 | **1행** — 1공통13, 블록 구성 `question:[text, choices, image]`(선택지 뒤) |
| B열 헤더 실측 | `"problem"`(Z4 확인) |
| 제어열 파괴 | **0건**(전 행 전 블록 스캔) |
| `stemHash` | 전 행 분할 전후 불변 |
| 최대 그림 수 | 3확통30 = 6개(`_fig1`~`_fig6`, S4 확인) |

**덕수 실물 검수 통과**(2026-08-30) — 미리보기 = 저장 실물, 지연 로딩, 자동 수정 결과 전항.

**계측 방법(재사용 가치 있음)**: 서비스 계정 키로 Firebase custom token을 서명해
`accounts:signInWithCustomToken`으로 ID 토큰을 얻으면 **브라우저 로그인 없이** 인증 라우트를
때릴 수 있다(허용목록 밖 uid로 403 경로까지 확인 가능). 61b `verifyProbe.mjs`의 연장이다.
⚠ 스크립트는 `node_modules` 때문에 **저장소 루트**에서 돌려야 하고, 확인 후 삭제할 것.

⚠ **`lib/proofread.ts`는 `file(1)`이 `data`로 판정한다**(내부 `⟦M0⟧` 등 비ASCII 제어 문자열) →
**맨 `grep`이 매치를 조용히 감춘다.** `grep -a`를 쓸 것. 이 저장소에서 "분명히 있는데 0건"이면
이 함정을 먼저 의심할 것.

---

## 5. 남은 항목

| # | 항목 | 상태 |
|---|---|---|
| **O-A** | **`[4점]` 배점의 숫자가 `[$4$점]`으로 수식화된다** | **미결.** 편집창 [교정]과 같은 기존 동작이라 회귀는 아니지만, 배점은 모든 문항에 있어 일괄 가져오기에서 전 문항에 박힌다. `autoWrapBareNumbers`의 `(n)` 보호 옆에 `\[\d+점\]` 한 줄이면 되지만 **편집창 동작도 함께 바뀐다** → 덕수 판단 대기 |
| **O-B** | 동명 파일 2건일 때 `X-Fig-Duplicates: 2` | 미검증 — Drive에 중복 파일을 만들어야 한다. `dup=1`로 헤더 경로는 확인 |
| P1 | GAS 패치 5(`mergeHeader_`·`mpf_repairHeaders`) push | 어림 — 데이터 품질, 구현과 무관 |
| P2 | `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 어림 — GAS |
| P5 | J열 `diagram_boxes` 크기 필터(조각 그림 근본 대책) | 후속 |
| 61f | AI 교정 일괄(라우트 인증 + 결과 저장) · 검증용 `[그림]` 자리표시자(R2) | 후속 Phase |

---

*v5 실행판 = 구현 기록. §3의 9건이 계획과 실제의 차이다.*
*배포 전 확인: Vercel `AUDITION_FIG_FOLDER_ID` 등록 완료(2026-08-30) · Storage 규칙 배포 완료.*
