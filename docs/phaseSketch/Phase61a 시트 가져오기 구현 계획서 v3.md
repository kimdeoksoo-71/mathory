# Phase 61a 구현 계획서 — 스프레드시트 문항 가져오기 (v3)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`
> v2 → v3: web Claude가 **양쪽 레포 최신 커밋(mathory 2026-08-21 · audition 2026-07-30)으로 재실측**해
>   v2의 사실오류 2건(X1·X2)을 정정하고 보완 7건(X3~X9)을 반영. 결정사항 D1~D10·G9는 전부 유지.
> 범위: 기획서의 **A축(문항 가져오기)만**. B축(정밀 검증)·C축(대화→삽입)은 Phase 61b·61c.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

Google Sheets(audition 스프레드시트의 `Data_DS`/`Stack`)를 서버 라우트가 **읽기 전용 스코프**로 가져오고,
클라이언트가 변환·미리보기·중복검사 후 **기존 `lib/firestore.ts` CRUD로 저장**하는 가져오기 마법사를 만든다.

---

## 1. 아키텍처 결정 (v1에서 유지)

**서버는 얇은 읽기 프록시, 저장은 클라이언트.**

- 서버 `app/api/sheet-import/route.ts` — 서비스 계정으로 시트를 읽어 행 데이터 JSON만 반환. **Firestore를 건드리지 않는다.**
- 클라이언트 — 변환(`lib/sheetImport.ts`) → 미리보기 → 저장(`createProblem`/`saveTabBlock`/`createFolder`).

이유: (a) Admin SDK 도입 불필요 → Firestore 보안 규칙·인증 체계 변경 0. (b) 저장 경로가 수동 문항 생성과 동일해져 규칙·VCS(version_seq)와 자연히 정합. (c) 서비스 계정 키는 서버에만 존재.

---

## 2. 실측으로 확정된 코드베이스 사실 (v3에서 재검증 완료)

| 사실 | 위치 | 비고 |
|---|---|---|
| `Problem` 필수 필드 = `title, year:number, exam_type, category, difficulty:number, tags:string[]`. `answer?`, `source?`, `folder_id?`, `tabs?`, `authorUid?`, `visibility?` 선택 | `types/problem.ts:1-41` | |
| `TabMeta` = `{id,label}`, id 규약 `'question'|'solution'|'extra_0'|…`, 하위컬렉션 = `` `${tabId}_blocks` `` (`tabSubcollection`) | `types/problem.ts:186-199` | |
| `Block.type`에 `'text'`, `'choices'` 존재. 본문은 `raw_text` | `types/problem.ts:152-186` | |
| `Block.block_key?`는 Phase 55 VCS의 영속 정체성. `lib/blocks/normalize.ts:35`의 `toPersistedBlock`이 lazy backfill | `types/problem.ts:154` | → X4 |
| **`toPersistedBlock(b, index)`가 저장 블록의 표준형**: `block_key || nanoid()`, `order:index`, `title: b.title || ''`, raw_text의 `$$` 주변 빈 줄 정규화 포함 | `lib/blocks/normalize.ts:30-46` | **v2 누락 → X4** |
| 선택지 파싱 = `/^([①②③④⑤])\s*(.*)$/`, 내용 빈 줄 건너뜀, 최대 5개, 라벨은 기록된 순서 그대로 | `components/editor/ChoicesBlock.tsx:10-22` | |
| **`EditorPreview`는 마크다운 문자열 렌더러 — choices 블록을 모른다.** 열람 화면의 블록 타입 분기는 `TabBody.tsx`가 담당(text→EditorPreview, choices→ChoicesBlock, …) | `components/problem/TabBody.tsx:9-10` | **v2 누락 → X3** |
| `createProblem(data)`는 undefined 필드를 사전 제거한다 | `lib/firestore.ts:29-42` | |
| **`saveBlock`은 객체를 그대로 `addDoc`한다 — undefined 제거 없음** | `lib/firestore.ts:331-341` | 블록 객체에 undefined 금지 |
| `saveTabBlock(problemId, tabId, block)` / `createFolder({name,user_id,order?,parent_id?})` / `listFolders(userId)` / `listProblems(userId, filter?)` | `lib/firestore.ts:352, 384, 396, 126` | |
| **`listProblems`는 `...data` 스프레드로 매핑** → 새 필드 `import_source`가 그대로 클라이언트에 도달한다. 중복 대조에 별도 조치 불필요 | `lib/firestore.ts:142-151` | **v3에서 검증 → X5** |
| **`deleteProblem`은 탭 블록 전체 + 버전(payload 포함)까지 캐스케이드 삭제** → D7의 best-effort 정리에 그대로 적합 | `lib/firestore.ts:101-116` | **v3에서 검증 → X6** |
| **신규 문항 생성 관례**: `year: new Date().getFullYear()`, `difficulty: 3`, `answer: ''`, `exam_type:''`, `category:''`, `tags:[]`, `authorUid`, `visibility:'private'`, `...(folderId ? {folder_id} : {})`. 이어서 question·solution 탭에 **빈 text 블록 1개씩** | `components/layout/AppShell.tsx:320-333` | |
| 신규 폴더 관례: `order: getChildren(folders, parentId).length` | `components/layout/AppShell.tsx:371-372, 383-384` | |
| `firestore.rules`의 problems create = `isSignedIn() && request.resource.data.authorUid == request.auth.uid` — **필드 화이트리스트 없음** | `firestore.rules:85-86` | additive 필드 자유 → 규칙 변경 0 |
| folders 규칙도 `user_id`만 검사 | `firestore.rules` (folders match) | |
| 폴더 트리 유틸: `buildFolderTree`, `flattenVisible`, `getChildren`, `getDescendantIds`, `getFolderPath` | `lib/folder-tree.ts` | |
| `FolderMovePicker`는 `Sidebar.tsx` 내부 로컬 함수(비-export), x/y 고정 팝오버 + 순환방지 특화 | `components/layout/Sidebar.tsx:401-` | 모달용 재사용 부적합 → D6 |
| **ID 토큰 릴레이 선례** = `Authorization: Bearer <ID token>` + `runtime='nodejs'` + `dynamic='force-dynamic'` + `maxDuration` + **오류 메시지 화이트리스트**. 단, 그 라우트의 토큰 *검증*은 Firestore REST에 릴레이해 **보안 규칙이 대행**하며 검증 코드가 없다(route.ts 주석 명시) — sheet-import는 Firestore를 안 거치므로 이 대행이 불가능하고, **`accounts:lookup` 검증은 이 Phase에서 새로 쓰는 코드다** | `app/api/github/export/route.ts:11-31` 주석, 호출부 `components/editor/EditorView.tsx:2806` (`user.getIdToken()`) | **v2 정정 → X2** |
| 기존 AI 라우트(`proofread`·`ocr`·`discuss`·`ai-complete`)는 인증이 없다 | 실측 | D1의 배경 |
| Firebase 웹 API 키 = `NEXT_PUBLIC_FIREBASE_API_KEY` (서버에서도 `process.env`로 읽힌다) | `lib/firebase.ts:6` | D1 검증에 사용 |
| `googleapis`·`google-auth-library` 미설치. **`nanoid`는 이미 dependency(^5.x)** | `package.json` | |
| 단위 테스트 하니스 = `tsc <단일 파일> --outDir .test-build --module commonjs … && node --test tests/*.test.mjs` (`test:export`·`test:case`·`test:locale` 3개 선례. locale은 `--rootDir .` 사용) | `package.json:8-11` | → G11 제약 |
| `.env.local`은 gitignore 됨 | `.gitignore` | |

### 2-1. 시트(GAS) 쪽 실측 — X1 정정 반영

| 사실 | 위치 |
|---|---|
| 데이터는 **2행부터**(1행 헤더) | `Movetostack.gs` (`getRange(2, 1, …)`) |
| 행 입력 파서 `parseRowInput_` = `,` 분리 + `a-b` 범위(**역순도 min/max로 흡수**) + Set 중복제거 + 오름차순 정렬 | `normalizeProblem.gs:36-52` |
| GAS는 전부 **열 위치 하드코딩**: `STEM:5(E), SOLUTION:3(C), ANSWER_TYPE:11(K), P_VERDICT:14(N), P_DERIVED:15(O), P_NOTE:16(P), …` | `Itemverification.gs` VCONFIG.COL |
| **`Movetostack`은 A~X 24열 고정 복사** (`numCols = 24`, 주석 "v2: 19 → 24 확장" — v2 문서의 "A~R 18열"은 구버전 기준 오기). M열(13)이 복사 범위에 포함되므로 `get` 체크 값은 Stack으로 자동 이월 — G9 결론 유지 | `Movetostack.gs:30-36` |
| `ErrorViewer`는 **A~S 19열** 고정 읽기 (v2의 "18열"은 오기), 주석에 `// A: 문제 출처` — D4(A열=source)의 근거 | `ErrorViewer.gs:29, 39` |
| **결론은 불변**: GAS 전체가 열 위치 고정이므로 시트의 열은 움직일 수 없다 → D2(위치 고정 매핑 + 헤더 대조 경고)가 옳다 | |

---

## 3. 정정·결정 이력

### 3-1. v1 → v2 정정 (C1~C7, CLI Claude — 전부 유지)

| # | 요지 |
|---|---|
| C1 | 필수 메타 기본값은 AppShell 관례(`year: 올해`, `difficulty: 3`, `answer:''`, `visibility:'private'`)를 따른다 |
| C2 | `firestore.rules`는 필드 화이트리스트를 하지 않는다 — 규칙 변경 0 확정 |
| C3 | 저장 블록에 `block_key` 포함 (없으면 첫 스냅샷 diff가 전부 '신규') |
| C4 | `source`에는 A열(문제 출처)을 넣는다. 기계 태그는 `import_source` 전담 |
| C5 | "헤더 이름으로 읽어 열 추가에 안전"은 거짓 전제 → 위치 고정 + 헤더 대조 경고 (D2) |
| C6 | `\[…\]` → `$$…$$` 단순 치환은 `\\[6pt]`를 파괴 → 음성 뒤돌아보기 `(?<!\\)` 필수 |
| C7 | 행 번호는 시트 실제 행(데이터 2행부터), 역순 범위 흡수 포함 |

### 3-2. v2 → v3 정정·보완 (X1~X9, web Claude 교차검토)

| # | 구분 | 내용 |
|---|---|---|
| **X1** | 정정 | §2-1 시트 실측치: Movetostack은 **A~X 24열**(18열 아님), ErrorViewer는 **19열**(A~S). 결론(D2)은 불변 |
| **X2** | 정정 | `accounts:lookup` 검증은 github/export의 선례가 **아니다** — 그 라우트는 검증 코드 없이 Firestore 규칙이 인가를 대행한다. sheet-import는 Firestore 미경유라 대행 불가 → lookup 검증을 **신규 작성**하는 것이 맞고, 선례에서 가져오는 것은 릴레이 형식·route config·오류 화이트리스트다 |
| **X3** | 보완 | 미리보기의 블록 렌더는 **타입 분기 필수**: `text` → `EditorPreview`, `choices` → `ChoicesBlock`(rawText prop). `EditorPreview` 단독으로는 선택지가 마크다운 원문으로 보인다. `TabBody` 재사용은 부적합 — outline 상태·case rail·요약 보기와 결합이 깊다 |
| **X4** | 보완 | 마법사 저장부는 블록 객체를 손으로 조립하지 말고 **`toPersistedBlock`(lib/blocks/normalize.ts)을 재사용**한다 — `block_key`(nanoid)·`title:''`·`order`·`$$` 주변 빈 줄 정규화가 표준형으로 공짜. G11 제약은 `sheetImport.ts`에만 해당하고 마법사 컴포넌트는 자유롭게 import 가능 |
| **X5** | 검증 | `listProblems`가 `...data` 스프레드 매핑이므로 `import_source`가 클라이언트에 그대로 도달 — 중복 대조(6.5) 전제 성립 확인 |
| **X6** | 검증 | `deleteProblem`은 블록·버전까지 캐스케이드 — D7의 정리 수단으로 적합 확인 |
| **X7** | 보완 | JWT 클라이언트는 **모듈 스코프 싱글턴**으로 생성 (warm 인스턴스에서 토큰 캐시 재사용, 요청마다 재발급 방지) |
| **X8** | 보완 | `lib/sheetImport.ts`는 **import 0의 완전 자기완결**로 작성 (`DraftBlock` 등 로컬 타입 정의, v2도 이미 그 방향). `import type`조차 불필요하게 만들면 tsc 단독 컴파일이 최단 경로. 테스트 스크립트는 `test:locale`처럼 `--rootDir .` 사용 |
| **X9** | 오타 | §7 제목 "타일럿" → "파일럿" |

### 3-3. 확정 결정사항 (D1~D10 + G9 — 전부 유지)

| # | 결정 |
|---|---|
| **D1** | 라우트 인증 = Firebase ID 토큰 릴레이 + `identitytoolkit accounts:lookup` 검증(신규 작성, X2) + `AUDITION_ALLOWED_UIDS` 허용목록. 무인증은 시트 전문을 인터넷에 공개하므로 채택 불가 |
| **D2** | 열 매핑의 진실 원천은 **열 위치 고정**. 1행 헤더는 기대 라벨과 대조해 불일치 시 **경고만**(가져오기는 계속) |
| **D3** | 이미 가져온 `source_id`의 재가져오기는 **v1에서 skip 고정** (덮어쓰기 미구현) |
| **D4** | A열을 `title`과 `source` 둘 다에 넣는다 |
| **D5** | `google-auth-library` + Sheets REST fetch (googleapis 미채택) |
| **D6** | AppShell 전역 모달 + 모달 안 인라인 폴더 트리 신규 작성. `FolderMovePicker` 추출·재사용 안 함 |
| **D7** | 블록 저장 실패 시 방금 만든 문항을 best-effort `deleteProblem` 후 실패 처리 |
| **D8** | 1회 가져오기 행 수 상한 없음 |
| **D9** | 미리보기는 요약 목록 + 클릭한 1건만 펼쳐 렌더 |
| **D10** | AI풀이 탭 블록1(O열) 앞에 `**AI 정답:** ` 접두를 붙인다 |
| **G9** | M열 `get` 체크박스는 이미 존재 → 덕수 작업 목록에서 제외 (24열 이월 확인, X1) |

> ⚠️ **D10은 §8 "친절한 가공 금지"의 유일한 명시적 예외다.** O열은 정답 문자열 하나만 들어 있어 맥락 없이 블록에 놓이면 P열(AI 풀이)과 구분이 안 된다. 접두는 고정 문자열이며 O열 내용을 건드리지 않는다. 다른 열에는 어떤 접두도 붙이지 않는다.

---

## 4. 시트 사양 (원본 데이터)

- 스프레드시트: gas-project-audition이 붙어 있는 문서. 시트 2개는 같은 열 구조: `Data_DS`(최근 세트, ≤50행), `Stack`(과거 세트 누적).
- **1행 헤더, 데이터는 2행부터. 열 위치는 고정이다(D2).**

| 열 | 인덱스(1-based) | 기대 헤더 라벨 | 가져오기 | 용도 |
|---|---|---|---|---|
| A | 1 | `id` | O | 문항 **제목** + **`source`** + **중복검사 키** |
| C | 3 | `given_solution` | O | 풀이 탭 블록1 (text) |
| D | 4 | `given_answer` | O | `Problem.answer` |
| E | 5 | `problem_stem` | O | 문제 탭 블록1 (text) |
| F~J | 6~10 | `choice1`~`choice5` | O | 문제 탭 블록2 (choices) |
| M | 13 | `get` | 선별용 | 체크박스. 사전 선별 필터 |
| O | 15 | `derived_answer` | O | AI풀이 탭 블록1 (text, 접두 D10) |
| P | 16 | `sloution_note` *(시트 원문 오타 그대로)* | O | AI풀이 탭 블록2 (text) |
| B, K, L, N, Q~X | — | — | X | 읽지 않음 |

- 읽기 범위는 **`A1:P`**(16열). Q~X는 검증 결과라 불필요.
- **읽기 전용은 스코프로 강제**: `https://www.googleapis.com/auth/spreadsheets.readonly`. 쓰기 API를 "부르지 않는" 것보다 **부를 수 없는** 것이 낫다.
- **헤더 대조(D2)**: 1행을 읽어 기대 라벨과 대조. 다르면 `headerWarnings`에 담아 응답하고 미리보기 상단에 배너. 가져오기는 막지 않는다.

---

## 5. 구현 항목

### 5.1 의존성 · 환경변수 · 수동 준비

```
npm i google-auth-library
```

환경변수(`.env.local` + Vercel):

| 변수 | 내용 |
|---|---|
| `GOOGLE_SA_EMAIL` | 서비스 계정 이메일 |
| `GOOGLE_SA_PRIVATE_KEY` | 개인키 PEM. 코드에서 `key.replace(/\\n/g, '\n')` |
| `AUDITION_SPREADSHEET_ID` | 대상 스프레드시트 ID |
| `AUDITION_ALLOWED_UIDS` | 쉼표 구분 Firebase uid 허용목록 (D1) — 파싱 시 각 항목 `trim()` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 이미 존재 — D1 토큰 검증에 재사용 |

**덕수가 할 일** (코드 밖):
1. Firebase 프로젝트가 속한 GCP 콘솔에서 Google Sheets API 활성화
2. 서비스 계정 생성 + JSON 키 발급
3. 대상 스프레드시트를 서비스 계정 이메일에 **뷰어**로 공유
4. 위 환경변수 4종을 `.env.local`과 Vercel에 등록
5. 본인 Firebase uid를 확인해 `AUDITION_ALLOWED_UIDS`에 넣기

> 🔒 **`GOOGLE_SA_PRIVATE_KEY`를 채팅창에 붙여넣지 말 것.** 덕수가 직접 파일·Vercel 콘솔에 입력하고 "등록 완료"만 알린다. (2026-05-13 사고 이력)
> M열 체크박스는 이미 있으므로 시트 작업은 없다.

### 5.2 서버 라우트 — `app/api/sheet-import/route.ts`

```
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

POST /api/sheet-import
headers: Authorization: Bearer <Firebase ID token>
body: { sheet: 'Data_DS' | 'Stack', rows?: string, includePreselected?: boolean }
응답: {
  headerWarnings: string[],                            // 기대 라벨과 다른 헤더 (D2)
  rows: Array<{ rowIndex: number; cells: string[] }>   // cells는 항상 길이 16으로 패딩
}
```

**인증 (D1)** — 순서대로:
1. `Authorization` 헤더 없으면 401.
2. `POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${NEXT_PUBLIC_FIREBASE_API_KEY}`, body `{ idToken }`.
   - non-2xx → 401 "로그인이 만료되었습니다 — 새로고침 후 다시 시도하세요"
   - `users[0].localId`가 uid
3. uid가 `AUDITION_ALLOWED_UIDS`에 없으면 403 "이 기능을 사용할 권한이 없습니다".
   목록이 비어 있으면 **전원 거부**(fail-closed).
4. 오류 메시지는 화이트리스트만 노출 — 원본 에러 객체를 흘리지 않는다(`github/export`의 `ApiError` 관례).

**시트 읽기 (D5 + X7)**:
```ts
// 모듈 스코프 싱글턴 (X7) — warm 인스턴스에서 액세스 토큰 캐시 재사용
const jwt = new JWT({
  email: process.env.GOOGLE_SA_EMAIL,
  key: process.env.GOOGLE_SA_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
// 핸들러 안:
const { token } = await jwt.getAccessToken();
const range = encodeURIComponent(`${sheet}!A1:P`);
const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`
          + `?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;
```
- `valueRenderOption=UNFORMATTED_VALUE` 명시 — 체크박스가 boolean으로, 수식 셀이 계산값으로 온다. 숫자 셀(D열이 정수인 경우 등)은 number로 오므로 각 셀을 `String(v ?? '')`로 정규화.
- ⚠️ **ragged row**: Sheets는 행 끝의 빈 셀을 잘라서 준다. 인덱스 접근 전에 길이 16으로 패딩.
- M열 값은 `true` / `'TRUE'` / `1` 어느 형태로 와도 참으로 판정.

**행 선택**:
- `rows` 파싱은 `parseRowInput_`와 동일 의미론: `,` 분리 → `a-b`는 `min..max` → 정수만 → Set → 오름차순.
- 선택 규칙: `rows`만 있으면 그 집합 / `includePreselected`만 있으면 M열 참인 행 / **둘 다면 합집합** / 둘 다 없으면 400.
- 헤더 행(1)은 결과에서 제외. `sheet` 값이 두 이름 중 하나가 아니면 400.
- A·E가 모두 빈 행은 결과에서 제외(시트 말미 빈 행 스킵).
- 행 수 상한 없음(D8). 응답은 선택된 행만 담으므로 페이로드는 선택량에 비례.

**오류 코드**: 400(sheet 부정/rows 파싱 실패/선택 조건 없음) · 401(토큰 없음·무효) · 403(허용목록 밖) · 500(env 미설정 — 어떤 변수가 없는지 **이름만**) · 502(Sheets API 실패).

### 5.3 변환 모듈 — `lib/sheetImport.ts` (순수 함수, **import 0** — X8)

> **G11 제약**: `npm run test:sheetImport` = `tsc lib/sheetImport.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/sheetImport.test.mjs` (기존 `test:locale` 관례).
> 이 파일은 firebase·react·nanoid를 import하지 않으며, 타입도 로컬로 정의해 **import 문 자체가 없게** 한다(X8).

```ts
export const SHEET_COL = { id:0, given_solution:2, given_answer:3, problem_stem:4,
  choice1:5, choice2:6, choice3:7, choice4:8, choice5:9, get:12,
  derived_answer:14, solution_note:15 } as const;   // 0-based, A1:P 기준

export const EXPECTED_HEADERS: Record<keyof typeof SHEET_COL, string> = { … };

export interface ImportRow { rowIndex: number; cells: string[] }   // 길이 16 보장
export interface DraftBlock { type: 'text' | 'choices'; raw_text: string; order: number }
export interface DraftTab { id: string; label: string }
export interface ProblemDraft {
  sourceId: string;                          // A열
  title: string;                             // = sourceId
  source: string;                            // = sourceId (D4)
  answer: string;                            // D열
  tabs: DraftTab[];
  blocksByTab: Record<string, DraftBlock[]>;
  warnings: string[];
}

export function rowToDraft(row: ImportRow): ProblemDraft | { rowIndex: number; error: string }
export function checkHeaders(headerRow: string[]): string[]        // 불일치 라벨 경고 목록
export function parseRowInput(text: string): number[]              // 서버·클라 공용
```

**변환 규칙**

1. **문제 탭 `question`**
   - 블록1 = `text`(E열). E가 비면 빈 블록을 두고 `warnings`에 "문제 본문이 비어 있음".
   - F~J 중 내용 있는 것이 1개 이상이면 블록2 = `choices`,
     `raw_text` = 내용 있는 선택지만 `① {F}` … `⑤ {J}` 형태로 원래 라벨을 유지한 채 줄로 나열.
     (빈 선택지는 줄 자체를 생략 — `parseChoices` 규격과 일치)
   - ⚠️ 중간이 비어 라벨이 건너뛰는 경우(예: ①③④) `warnings`에 기록 — `ChoicesBlock`은 개수 기준 배치라 화면상 ①과 ③이 이웃한다. 데이터 이상 신호.
   - F~J 전부 비면(단답형) choices 블록 없음.
2. **풀이 탭 `solution`** — 블록1 = `text`(C열). C가 비어도 빈 text 블록 1개(AppShell 관례). `warnings`에 기록.
3. **AI풀이 탭 `extra_0`** (label `AI풀이`) — O·P 중 하나라도 있으면 탭 생성.
   - 블록1 = `text`, `raw_text` = `` `**AI 정답:** ${O}` `` (D10). O가 비면 블록1 생략.
   - 블록2 = `text`(P열). P가 비면 블록2 생략. 둘 다 비면 탭 자체를 만들지 않는다.
4. **`tabs`는 항상 명시적으로 채운다** — `[{question,문제},{solution,풀이}]` (+ 조건부 `{extra_0,AI풀이}`).
5. **텍스트 정규화** (E·C·O·P 공통, 최소주의)
   - `(?<!\\)\\\(` → `$`, `(?<!\\)\\\)` → `$`
   - `(?<!\\)\\\[` → `$$`, `(?<!\\)\\\]` → `$$` — ⚠️ `\\[6pt]` 보호를 위해 뒤돌아보기 필수(C6)
   - CRLF → LF, 연속 3개 이상 빈 줄 → 2개, 앞뒤 `trim()`
   - 그 밖의 마커((가)·ㄱ.·① 등)는 건드리지 않는다 — 리터럴 보존 규약(CLAUDE.md)
   - 이상 징후(이스케이프되지 않은 `$` 홀수 개 등)는 고치지 말고 `warnings`에 기록
6. **블록 추가 분할 금지** — 위 구성 외의 블록을 만들지 않는다.
7. **A열이 비면 오류 행**으로 반환 (제목도 중복 키도 없어 저장 불가).

### 5.4 가져오기 마법사 UI

- **배치 (D6)**: AppShell 전역 모달. 진입점은 Sidebar 하단 버튼(신규 폴더 버튼 근처 관례). 전용 라우트 없음.
- **단계**
  1. **시트 선택** — `Data_DS(최근 세트)` / `Stack(누적)` 라디오
  2. **행 지정** — 텍스트 입력(`15-32`, `15, 17, 20-25`) + `[사전 선별(M열 체크 표시) 된 문제 포함하기]` 체크박스.
     안내문: "행 범위를 비워 두면 사전 선별 문제만 가져옵니다". 둘 다 비활성이면 다음 버튼 disabled.
  3. **폴더 선택** — `listFolders` + `lib/folder-tree.ts`로 모달 안 인라인 트리 신규 작성.
     하단 `[폴더 새로 만들기]` → 현재 선택 폴더를 `parent_id`로 `createFolder({… order: getChildren(folders, parentId).length })`.
     최상위(폴더 없음) 선택 가능 — 그 경우 `folder_id` 미포함.
  4. **미리보기 (D9 + X3)** — fetch → `rowToDraft`. 목록 각 행: 제목(A) · 탭/블록 구성 요약 · warnings 배지 · 중복 배지 · 체크박스.
     행 클릭 시 그 1건만 펼쳐 렌더 — **블록 타입 분기 필수(X3)**: `text` → `EditorPreview`, `choices` → `ChoicesBlock`. 접으면 언마운트.
     헤더 경고(D2)는 목록 상단 배너. 오류 행은 회색 + 체크 불가.
  5. **실행** — 선택된 draft 저장. 진행률(`n/총`), 완료 후 결과 요약(성공·실패·건너뜀 + 사유).
- **저장 로직 (draft 1건당)**
  1. `createProblem({ title, source, answer, year: new Date().getFullYear(), exam_type:'', category:'', difficulty:3, tags:[], authorUid, visibility:'private', tabs, ...(folderId ? {folder_id: folderId} : {}), import_source })`
  2. 탭별 순서대로 **`toPersistedBlock` 재사용(X4)**: `DraftBlock`을 `Block` 형태로 감싸 `toPersistedBlock(b, index)`를 통과시킨 뒤 `saveTabBlock(problemId, tabId, persisted)`.
     — `block_key`(nanoid)·`title:''`·`$$` 빈 줄 정규화가 표준형으로 처리되고, undefined 필드 걱정도 사라진다(`saveBlock`은 정제하지 않음 — §2).
  3. **블록 저장 중 실패 시 (D7)**: 해당 문항을 `deleteProblem`으로 best-effort 정리(블록·버전 캐스케이드 확인됨 — X6) 후 실패 집계.
     정리 자체가 실패하면 결과 요약에 "정리 실패 — 수동 삭제 필요".
  4. 문항 간 롤백 없음. 동시성은 **3~5 병렬** 제한.
  5. 완료 후 `loadData()` 갱신.

### 5.5 중복 검사 · import 메타

- `types/problem.ts`에 additive 추가:
  ```ts
  export interface ImportSource {
    provider: 'audition-sheet';
    sheet: 'Data_DS' | 'Stack';
    row: number;
    source_id: string;
    imported_at: number;      // Date.now()
  }
  // Problem 에: import_source?: ImportSource;
  ```
  마이그레이션 0 · Firestore 규칙 0 (§2).
- **중복 판정 키는 `import_source.source_id`(A열)** — 세트가 Data_DS→Stack으로 이동하면 행 번호가 바뀌기 때문.
  미리보기 진입 시 `listProblems(userId)`로 `source_id` 집합을 만들어 대조 (`import_source`가 매핑을 통과함은 검증됨 — X5). 별도 색인 불필요.
- **D3**: 중복 행은 배지 + 체크 해제 + 체크 불가(skip 고정). 덮어쓰기는 후속 Phase (탭 블록 전삭제와 VCS 스냅샷 의미가 얽힘). 툴팁 "이미 가져온 문항입니다".
- **G8 — 시트 내부 중복**: 선택 집합 안에 같은 `source_id`가 2개 이상이면 경고 배지, 저장은 첫 행만 체크된 상태로.

---

## 6. 작업 순서 (파일럿 우선)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 의존성·env 배선 + 서버 라우트(인증 포함) | 로컬에서 **Data_DS·Stack 각각** 실제 행 JSON 응답 확인. 토큰 없이 401, 허용목록 밖 uid 403 |
| 2 | `lib/sheetImport.ts` + 스냅샷 테스트 (`npm run test:sheetImport`) | `rowToDraft` 출력이 기대 블록 구성과 일치. `\\[6pt]` 보호(C6)·라벨 건너뜀·단답형·AI풀이 생략 케이스 포함 |
| 3 | 미리보기까지의 마법사 (저장 없이) | **덕수 검수 관문**: 실데이터 5~10행을 펼쳐 수식·마커·선택지 그리드 렌더 확인, 변환 규칙 피드백 반영 |
| 4 | 폴더 선택 + 저장 + 중복 검사 | 파일럿 폴더에 실제 문항 생성(에디터에서 열어 3개 탭 확인), 재실행 시 중복 감지·skip 확인 |
| 5 | 결과 요약·부분 실패 처리·마무리 | 빈 행/깨진 행 섞인 범위로 부분 실패 시나리오 통과 (고아 문항 0) |

**스텝 3이 유일한 중간 관문이다** — 변환 규칙은 사양이 아니라 실물로 확정한다(기획서 A-4).

---

## 7. 하지 말 것 / 주의

- 시트에 **쓰기 금지.** 스코프 자체를 `spreadsheets.readonly`로 잠근다.
- GAS 프로젝트(gas-project-audition)는 수정하지 않는다.
- 서비스 계정 키를 클라이언트 번들·리포지터리에 노출 금지 (`NEXT_PUBLIC_` 접두 절대 금지). 채팅창 반입 금지.
- 블록 자동 분할·마커 변환 등 "친절한 가공" 금지 — 유일한 예외는 D10의 `**AI 정답:** ` 접두.
- `Problem.import_source`는 additive로만 — 기존 문항 마이그레이션 없음.
- `saveBlock`에 undefined 필드를 넘기지 말 것 (X4의 `toPersistedBlock` 경유가 안전판).
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · git push는 덕수가 직접(커밋까지만) · 완료 시 `docs/roadmap.md` 갱신.

---

## 8. 이 Phase가 건드리지 않는 것

Firestore 보안 규칙 · 마이그레이션 · 기존 문항 · 렌더 사이트 5곳 · 전처리 파이프라인 · 인쇄 · 공개 뷰어. **전부 0건.**
신규 파일 3개(`app/api/sheet-import/route.ts`, `lib/sheetImport.ts`, 마법사 컴포넌트) + 테스트 1개(`tests/sheetImport.test.mjs`) + `types/problem.ts` 필드 1개 + `package.json` 의존성 1개·스크립트 1개 + AppShell·Sidebar 진입점.

---

## 9. 구현자가 정하고 기록할 것 (재량 + 문서화 의무)

1. 마법사 컴포넌트 파일 위치·이름, Sidebar 진입점의 정확한 배치
2. 저장 동시성 값(3~5 중)과 근거
3. 헤더 기대 라벨의 실제 문자열 — 첫 실행 시 1행을 읽어 `EXPECTED_HEADERS`에 확정 반영
4. `toPersistedBlock` 재사용 시 `DraftBlock`→`Block` 어댑터의 형태 (X4)
5. 위 1~4를 포함해 완료 후 Phase 문서(61a 구현 결과, 교차검토 → 최종) 작성

---

*v3 — web Claude 교차검토 완료 (X1~X9). 결정 D1~D10·G9 유지. B축(정밀 검증)은 Phase 61b 구현 계획서에서 다룬다.*
