# Phase 61a 구현 계획서 — 스프레드시트 문항 가져오기 (v4 실행판)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`
> 계보: v1(CLI 초안) → v2(CLI 실측·정정 C1~C7) → v3(web 교차검토 X1~X9) → **v4 실행판(CLI 재실측)**
> v3 → v4: **X1을 되돌리고**(사실무근), X2를 부연으로 강등, X3~X9는 채택, 그 위에 v3에도 남아 있던
>   구멍 5건(Y1~Y5)을 막았다. 결정사항 D1~D10·G9는 전부 불변.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

Google Sheets(audition 스프레드시트의 `Data_DS`/`Stack`)를 서버 라우트가 **읽기 전용 스코프**로 가져오고,
클라이언트가 변환 → `toPersistedBlock`으로 **저장형 확정** → 미리보기 → 중복검사 → 기존 `lib/firestore.ts` CRUD 저장하는
가져오기 마법사를 만든다. **미리보기와 저장은 같은 배열을 본다.**

---

## 1. 아키텍처 (v1부터 불변)

**서버는 얇은 읽기 프록시, 저장은 클라이언트.**

- 서버 `app/api/sheet-import/route.ts` — 서비스 계정으로 시트를 읽어 행 데이터 JSON만 반환. **Firestore를 건드리지 않는다.**
- 클라이언트 — 변환(`lib/sheetImport.ts`) → 저장형 확정(`lib/blocks/normalize.ts`) → 미리보기 → 저장(`createProblem`/`saveTabBlock`/`createFolder`).

이유: (a) Admin SDK 불필요 → Firestore 보안 규칙·인증 체계 변경 0. (b) 저장 경로가 수동 문항 생성과 동일해져 규칙·VCS와 자연히 정합. (c) 서비스 계정 키는 서버에만 존재.

---

## 2. 실측으로 확정된 사실 (2026-08-22 CLI 재실측)

### 2-1. Mathory 코드베이스

| 사실 | 위치 |
|---|---|
| `Problem` 필수 = `title, year:number, exam_type, category, difficulty:number, tags:string[]`. `answer?`, `source?`, `folder_id?`, `tabs?`, `authorUid?`, `visibility?` 선택 | `types/problem.ts:1-41` |
| `TabMeta` = `{id,label}`, id 규약 `'question'|'solution'|'extra_0'|…`, 하위컬렉션 = `` `${tabId}_blocks` `` | `types/problem.ts:186-199` |
| `Block.type`에 `'text'`·`'choices'` 존재. 본문은 `raw_text`. `id: string`은 **필수 필드** | `types/problem.ts:152-186` |
| **`toPersistedBlock(b: Block, index: number): PersistedBlockData`** — `block_key: b.block_key \|\| nanoid()`, `order: index`, `title: b.title \|\| ''`, `raw_text`에 `normalizeDisplayMathSpacing` + 앞뒤 빈 줄 제거. **저장 경로와 버전 스냅샷의 단일 정형화 소스** | `lib/blocks/normalize.ts:13-52` |
| `normalizeDisplayMathSpacing`은 `$$…$$` 쌍을 토큰화해 앞뒤 빈 줄을 정규화. `$$`가 홀수면 나머지를 text로 두고 안전하게 통과 | `lib/preprocess.ts:35-` |
| 선택지 파싱 = `/^([①②③④⑤])\s*(.*)$/`, 내용 빈 줄 건너뜀, 최대 5개, **라벨은 기록된 순서 그대로**. 개수 기준 3등분/5등분 배치 | `components/editor/ChoicesBlock.tsx:10-22, 26-27` |
| **`EditorPreview`는 마크다운 문자열 렌더러 — choices를 모른다.** 블록 타입 분기는 `TabBody`가 담당(`EditorPreview` / `ChoicesBlock` 별도 import) | `components/problem/TabBody.tsx:9-10` |
| `createProblem(data)`는 undefined 필드를 사전 제거 | `lib/firestore.ts:29-42` |
| **`saveBlock`은 객체를 그대로 `addDoc` — undefined 제거 없음** | `lib/firestore.ts:332-341` |
| `saveTabBlock(problemId, tabId, block: Omit<Block,'id'>)` | `lib/firestore.ts:352-354` |
| `listProblems`는 `{ id, ...data, … }` 스프레드 매핑 → 임의 필드가 그대로 클라이언트에 도달 | `lib/firestore.ts:142-151` |
| `deleteProblem`은 **탭 블록 전체 + versions(payload 포함)** 까지 캐스케이드 삭제 | `lib/firestore.ts:101-115` |
| `createFolder({name,user_id,order?,parent_id?})` / `listFolders(userId)` | `lib/firestore.ts:384, 396` |
| **신규 문항 생성 관례**: `year: new Date().getFullYear()`, `difficulty: 3`, `answer: ''`, `exam_type:''`, `category:''`, `tags:[]`, `authorUid`, `visibility:'private'`, `...(folderId ? {folder_id} : {})`. 이어서 question·solution에 빈 text 블록 1개씩 | `components/layout/AppShell.tsx:320-333` |
| 신규 폴더 관례: `order: getChildren(folders, parentId).length` | `components/layout/AppShell.tsx:371-372, 383-384` |
| problems create 규칙 = `isSignedIn() && request.resource.data.authorUid == request.auth.uid` — **필드 화이트리스트 없음** | `firestore.rules:84-86` |
| folders 규칙도 `user_id`만 검사 | `firestore.rules:449-454` |
| 폴더 트리 유틸 `buildFolderTree`·`flattenVisible`·`getChildren`·`getDescendantIds`·`getFolderPath` | `lib/folder-tree.ts` |
| `FolderMovePicker`는 `Sidebar.tsx` 내부 **비-export** 로컬 함수, x/y 고정 팝오버 + 순환방지 특화 → 모달용 재사용 부적합 | `components/layout/Sidebar.tsx:401-` |
| **ID 토큰 릴레이 선례**: `Authorization: Bearer <ID token>` + `runtime='nodejs'` + `dynamic='force-dynamic'` + `maxDuration` + 오류 메시지 화이트리스트(`ApiError`). 호출부는 `await user.getIdToken()` | `app/api/github/export/route.ts:11-46`, `components/editor/EditorView.tsx:2806` |
| 기존 AI 라우트(`proofread`·`ocr`·`discuss`·`ai-complete`)는 **인증 없음** | 실측 |
| Firebase 웹 API 키 = `NEXT_PUBLIC_FIREBASE_API_KEY` (서버에서도 `process.env`로 읽힌다) | `lib/firebase.ts:6` |
| `nanoid`는 이미 dependency(`^5.1.11`). `googleapis`·`google-auth-library`는 미설치 | `package.json` |
| 단위 테스트 하니스 = `tsc <단일 파일> --outDir .test-build --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/*.test.mjs` (`test:export`·`test:case`는 `--rootDir` 없음, `test:locale`만 `--rootDir .`) | `package.json:8-11` |
| `.env.local`은 gitignore 됨 | `.gitignore:3` |

### 2-2. 시트(GAS) — ⚠️ v3의 X1 정정을 되돌린다

| 사실 | 위치 | 비고 |
|---|---|---|
| 데이터는 **2행부터**(1행 헤더) | `Movetostack.gs:28-29` | |
| `parseRowInput_` = `,` 분리 + `a-b` 범위(**역순도 min/max 흡수**) + Set 중복제거 + 오름차순 | `normalizeProblem.gs:36-52` | |
| GAS는 전부 **열 위치 하드코딩**: `SOLUTION:3(C), STEM:5(E), ANSWER_TYPE:11(K), P_VERDICT:14(N), P_DERIVED:15(O), P_NOTE:16(P), S_VERDICT:17(Q), S_ERROR:18(R)` | `Itemverification.gs:31-38` | |
| **`Movetostack`은 A~R = 18열 고정 복사** — `const numCols = 18; // A~R = 18열` (파일 상단 주석도 "A~R 데이터를 Stack 시트 하단에 이어붙이고") | `Movetostack.gs:5, 28` | **v3의 "24열"은 파일에 없는 값 → 무효** |
| **`ErrorViewer`도 18열 고정 읽기** `getRange(startRow, 1, numRows, 18)`. 주석에 `// A: 문제 출처` | `ErrorViewer.gs:29, 39` | **v3의 "A~S 19열"은 무효.** 단 D4(A열=출처)의 근거는 유효 |
| **G9 결론 불변**: M(13) ≤ R(18)이므로 `get` 체크박스는 Movetostack 복사 범위 안이며 Stack으로 자동 이월된다 | | v3와 결론은 같고 **근거만 정정** |
| **D2 결론 불변**: GAS 전체가 열 위치 고정이라 시트의 열은 움직일 수 없다 → 위치 고정 매핑 + 헤더 대조 경고가 옳다 | | |

> ℹ️ `~/Documents/gas-project-audition`은 git 저장소가 아니다(로컬 사본). 이 문서의 GAS 인용은 **로컬 파일 직접 읽기** 결과다.

---

## 3. 정정·검토 이력

### 3-1. v1 → v2 (C1~C7, 전부 유지)

| # | 요지 |
|---|---|
| C1 | 필수 메타 기본값은 AppShell 관례(`year: 올해`, `difficulty: 3`, `answer:''`, `visibility:'private'`)를 따른다 |
| C2 | `firestore.rules`는 필드 화이트리스트를 하지 않는다 → 규칙 변경 0 확정 |
| C3 | 저장 블록에 `block_key` 포함 (v4에서는 `toPersistedBlock`이 대행 → X4) |
| C4 | `source`에 A열(문제 출처)을 넣는다. 기계 태그는 `import_source` 전담 |
| C5 | "헤더 이름으로 읽어 열 추가에 안전"은 거짓 전제 → 위치 고정 + 헤더 대조 경고(D2) |
| C6 | `\[…\]` → `$$` 단순 치환은 `\\[6pt]`를 파괴 → 뒤돌아보기 `(?<!\\)` 필수 |
| C7 | 행 번호는 시트 실제 행(데이터 2행부터), 역순 범위 흡수 포함 |

### 3-2. v2 → v3 (web 교차검토) — 채택 판정

| # | 판정 | 내용 |
|---|---|---|
| **X1** | ❌ **기각(사실무근)** | "Movetostack A~X 24열 / ErrorViewer 19열"은 **파일에 없는 값**이다. 실측치는 둘 다 **18열**. 결론(G9·D2)은 어차피 불변이므로 **근거만 §2-2로 정정**한다 |
| **X2** | ⚠️ **부연으로 강등** | v2는 `accounts:lookup`에 선례가 있다고 한 적이 없다("토큰 릴레이 선례는 있으나 그 트릭은 못 쓴다"고 이미 적었다). 다만 X2가 덧붙인 설명은 정확하므로 §5.2 각주로 유지 |
| **X3** | ✅ 채택 | 미리보기 블록 렌더는 **타입 분기 필수** (`text`→`EditorPreview`, `choices`→`ChoicesBlock`). v2의 "EditorPreview로 렌더"는 과소 명세였다 |
| **X4** | ✅ **채택(가장 값어치 있음)** | 블록을 손으로 조립하지 말고 `toPersistedBlock` 재사용 → `block_key`·`order`·`title`·`$$` 정규화가 표준화 소스로 공급 |
| **X5** | ✅ 검증됨 | `listProblems`의 `...data` 스프레드로 `import_source`가 클라이언트에 도달 |
| **X6** | ✅ 검증됨 | `deleteProblem`이 블록·버전까지 캐스케이드 → D7 정리 수단으로 적합 |
| **X7** | ✅ 채택 | JWT 클라이언트를 모듈 스코프 싱글턴으로 (warm 인스턴스에서 토큰 캐시 재사용) |
| **X8** | ✅ 채택 | `lib/sheetImport.ts`는 import 0의 자기완결 모듈 |
| **X9** | ✅ 채택 | 오타 "타일럿" → "파일럿" |

### 3-3. v3 → v4 신규 보완 (Y1~Y5)

| # | 내용 |
|---|---|
| **Y1** | ⚠️ **X4의 부작용 — 미리보기/저장 불일치.** `toPersistedBlock`은 `raw_text`를 정규화해서 저장한다. 미리보기가 정규화 **전** 텍스트를 그리면 스텝 3 검수 관문이 "저장될 것과 다른 것"을 보게 된다. → **미리보기 진입 시점에 persisted 배열을 확정하고, 미리보기와 저장이 그 배열 하나를 공유한다**(§5.4). 부수 효과로 `block_key`도 미리보기 때 확정돼 재시도해도 안정적이다 |
| **Y2** | `DraftBlock` → `Block` 어댑터를 명시한다. `Block.id`가 필수라 `{ id: '', order: i, type, raw_text } as Block`으로 감싸 넘긴다. `PersistedBlockData`는 `Omit<Block,'id'>`에 구조적으로 대입 가능하므로 `saveTabBlock`에 그대로 넣힌다 |
| **Y3** | 블록이 생략될 수 있으므로(O 비면 AI풀이 블록1 없음) `order`는 **배열 인덱스로 재부여**한다. `toPersistedBlock(b, i)`의 `order: index`가 자동 처리 — 단 `map((b,i)=>toPersistedBlock(b,i))`로 **탭별로** 0부터 매길 것 |
| **Y4** | 클라이언트 호출부에 **`Authorization: Bearer ${await user.getIdToken()}`** 를 명시한다(v3는 서버 규격만 적고 호출부를 비워 뒀다). 미로그인 상태면 마법사 진입 자체를 막는다 |
| **Y5** | 헤더 기대 라벨 확정을 **스텝 1의 완료 기준에 포함**한다 — 첫 응답의 1행을 그대로 기록해 `EXPECTED_HEADERS`에 박고, 그 전까지 `checkHeaders`는 항상 통과시킨다(빈 기대값으로 오탐을 내지 않는다) |

### 3-4. 확정 결정사항 (D1~D10 + G9 — 전부 불변)

| # | 결정 |
|---|---|
| **D1** | 라우트 인증 = Firebase ID 토큰 릴레이 + `identitytoolkit accounts:lookup` 검증(**이 Phase에서 신규 작성**) + `AUDITION_ALLOWED_UIDS` 허용목록. 무인증은 시트 전문을 인터넷에 공개하므로 채택 불가 |
| **D2** | 열 매핑의 진실 원천은 **열 위치 고정**. 1행 헤더는 기대 라벨과 대조해 불일치 시 **경고만** |
| **D3** | 이미 가져온 `source_id`의 재가져오기는 **v1에서 skip 고정** |
| **D4** | A열을 `title`과 `source` 둘 다에 넣는다 |
| **D5** | `google-auth-library` + Sheets REST fetch |
| **D6** | AppShell 전역 모달 + 모달 안 인라인 폴더 트리 신규 작성 |
| **D7** | 블록 저장 실패 시 방금 만든 문항을 best-effort `deleteProblem` 후 실패 처리 |
| **D8** | 1회 가져오기 행 수 상한 없음 |
| **D9** | 미리보기는 요약 목록 + 클릭한 1건만 펼쳐 렌더 |
| **D10** | AI풀이 탭 블록1(O열) 앞에 `**AI 정답:** ` 접두를 붙인다 |
| **G9** | M열 `get` 체크박스는 이미 존재 → 덕수 작업 목록에서 제외 |

> ⚠️ **D10은 §7 "친절한 가공 금지"의 유일한 명시적 예외다.** O열은 정답 문자열 하나뿐이라 맥락 없이 놓이면 P열(AI 풀이)과 구분이 안 된다. 접두는 고정 문자열이며 O열 내용을 건드리지 않는다. 다른 열에는 어떤 접두도 붙이지 않는다.

---

## 4. 시트 사양

- 스프레드시트: gas-project-audition이 붙어 있는 문서. 시트 2개는 같은 열 구조: `Data_DS`(최근 세트, ≤50행), `Stack`(누적).
- **1행 헤더, 데이터는 2행부터. 열 위치는 고정이다(D2).**

| 열 | 인덱스(1-based) | 기대 헤더 라벨(잠정, Y5) | 가져오기 | 용도 |
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

---

## 5. 구현 항목

### 5.1 의존성 · 환경변수 · 수동 준비

```
npm i google-auth-library
```

| 변수 | 내용 |
|---|---|
| `GOOGLE_SA_EMAIL` | 서비스 계정 이메일 |
| `GOOGLE_SA_PRIVATE_KEY` | 개인키 PEM. 코드에서 `key.replace(/\\n/g, '\n')` |
| `AUDITION_SPREADSHEET_ID` | 대상 스프레드시트 ID |
| `AUDITION_ALLOWED_UIDS` | 쉼표 구분 Firebase uid 허용목록. 파싱 시 각 항목 `trim()` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 이미 존재 → D1 토큰 검증에 재사용 |

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
  header: string[],                                    // 1행 원문 (Y5 — 기대 라벨 확정용)
  headerWarnings: string[],                            // 기대 라벨과 다른 헤더 (D2)
  rows: Array<{ rowIndex: number; cells: string[] }>   // cells는 항상 길이 16으로 패딩
}
```

**인증 (D1)** — 순서대로:
1. `Authorization` 헤더 없으면 401.
2. `POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${NEXT_PUBLIC_FIREBASE_API_KEY}`, body `{ idToken }`.
   - non-2xx → 401 "로그인이 만료되었습니다 — 새로고침 후 다시 시도하세요"
   - `users[0].localId`가 uid
3. uid가 `AUDITION_ALLOWED_UIDS`에 없으면 403 "이 기능을 사용할 권한이 없습니다". 목록이 비면 **전원 거부**(fail-closed).
4. 오류 메시지는 화이트리스트만 노출 — 원본 에러 객체를 흘리지 않는다(`github/export`의 `ApiError` 관례).

> ℹ️ (X2) `github/export`는 릴레이한 토큰을 **Firestore REST에 그대로 써서** 보안 규칙이 인가를 대행하므로 검증 코드가 없다. sheet-import는 Firestore를 안 거쳐 그 대행이 불가능하다 — 그래서 `accounts:lookup` 검증을 **여기서 새로 쓴다**. 선례에서 가져오는 것은 릴레이 형식·route config·오류 화이트리스트다.

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
- `valueRenderOption=UNFORMATTED_VALUE` 명시 — 체크박스가 boolean, 수식 셀이 계산값으로 온다. 숫자 셀도 있으므로 **모든 셀을 `String(v ?? '')`로 정규화**.
- ⚠️ **ragged row**: Sheets는 행 끝의 빈 셀을 잘라서 준다. 인덱스 접근 전 **길이 16으로 패딩**.
- M열 값은 `true` / `'TRUE'` / `1` 어느 형태로 와도 참으로 판정.

**행 선택**:
- `rows` 파싱은 `parseRowInput_`와 동일 의미론: `,` 분리 → `a-b`는 `min..max` → 정수만 → Set → 오름차순.
- 선택 규칙: `rows`만 → 그 집합 / `includePreselected`만 → M열 참인 행 / **둘 다 → 합집합** / 둘 다 없으면 **400**.
- 헤더 행(1)은 결과에서 제외. `sheet` 값이 두 이름 중 하나가 아니면 400.
- **A·E가 모두 빈 행은 결과에서 제외**(시트 말미 빈 행 스킵).
- 행 수 상한 없음(D8). 응답은 선택된 행만 담으므로 페이로드는 선택량에 비례한다 — 전체 시트 읽기는 서버 안에서만 일어난다.

**오류 코드**: 400(sheet 부정/rows 파싱 실패/선택 조건 없음) · 401(토큰 없음·무효) · 403(허용목록 밖) · 500(env 미설정 — **어떤 변수가 없는지 이름만**) · 502(Sheets API 실패).

### 5.3 변환 모듈 — `lib/sheetImport.ts` (순수 함수, **import 0** — X8)

> **테스트 하니스**: `"test:sheet": "tsc lib/sheetImport.ts --outDir .test-build --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/sheetImport.test.mjs"`
> (import이 없으므로 `test:case` 패턴 그대로 — `--rootDir` 불필요)
> 이 파일은 firebase·react·nanoid를 import하지 않으며, 타입도 로컬 정의해 **import 문 자체가 없게** 한다.

```ts
export const SHEET_COL = { id:0, given_solution:2, given_answer:3, problem_stem:4,
  choice1:5, choice2:6, choice3:7, choice4:8, choice5:9, get:12,
  derived_answer:14, solution_note:15 } as const;   // 0-based, A1:P 기준

export const EXPECTED_HEADERS: Partial<Record<keyof typeof SHEET_COL, string>> = { /* Y5: 스텝1에서 확정 */ };

export interface ImportRow { rowIndex: number; cells: string[] }   // 길이 16 보장
export interface DraftBlock { type: 'text' | 'choices'; raw_text: string }
export interface DraftTab { id: string; label: string }
export interface ProblemDraft {
  sourceId: string;    // A열
  title: string;       // = sourceId
  source: string;      // = sourceId (D4)
  answer: string;      // D열
  tabs: DraftTab[];
  blocksByTab: Record<string, DraftBlock[]>;   // 배열 순서가 곧 order (Y3)
  warnings: string[];
}

export function rowToDraft(row: ImportRow): ProblemDraft | { rowIndex: number; error: string }
export function checkHeaders(headerRow: string[]): string[]   // 기대값이 빈 키는 통과 (Y5)
export function parseRowInput(text: string): number[]         // 서버·클라 공용
```

> ℹ️ **`DraftBlock`에 `order`를 두지 않는다** (Y3). 순서는 배열 인덱스가 소유하고, `toPersistedBlock(b, i)`가 `order: i`로 확정한다.

**변환 규칙**

1. **문제 탭 `question`**
   - 블록1 = `text`(E열). E가 비면 빈 블록을 두고 `warnings`에 "문제 본문이 비어 있음".
   - F~J 중 내용 있는 것이 1개 이상이면 블록2 = `choices`. `raw_text`는 내용 있는 선택지만 `① {F}` … `⑤ {J}` 형태로 **원래 라벨을 유지한 채** 줄로 나열(빈 선택지는 줄 자체 생략 — `parseChoices` 규격과 일치).
   - ⚠️ 중간이 비어 라벨이 건너뛰면(예: ①③④) `warnings`에 기록 — `ChoicesBlock`은 **개수** 기준 3등분/5등분 배치라 화면상 ①과 ③이 이웃한다. 데이터 이상 신호다.
   - F~J 전부 비면(단답형) choices 블록 없음.
2. **풀이 탭 `solution`** — 블록1 = `text`(C열). C가 비어도 빈 text 블록 1개(AppShell 관례). `warnings`에 기록.
3. **AI풀이 탭 `extra_0`** (label `AI풀이`) — O·P 중 하나라도 있으면 탭 생성.
   - 블록1 = `text`, `raw_text` = `` `**AI 정답:** ${O}` `` (D10). O가 비면 블록1 생략.
   - 블록2 = `text`(P열). P가 비면 블록2 생략. 둘 다 비면 탭 자체를 만들지 않는다.
4. **`tabs`는 항상 명시적으로 채운다** — `[{question,문제},{solution,풀이}]` (+ 조건부 `{extra_0,AI풀이}`).
5. **텍스트 정규화** (E·C·O·P 공통, 최소주의)
   - `(?<!\\)\\\(` → `$`, `(?<!\\)\\\)` → `$`
   - `(?<!\\)\\\[` → `$$`, `(?<!\\)\\\]` → `$$` — ⚠️ **`\\[6pt]` 보호를 위해 뒤돌아보기 필수(C6)**
   - CRLF → LF, 연속 3개 이상 빈 줄 → 2개, 앞뒤 `trim()`
   - 그 밖의 마커((가)·ㄱ.·① 등)는 건드리지 않는다 — 리터럴 보존 규약(CLAUDE.md)
   - 이상 징후(이스케이프되지 않은 `$` 홀수 개 등)는 **고치지 말고** `warnings`에 기록
   - ⚠️ **`$$` 앞뒤 빈 줄 정규화는 여기서 하지 않는다** — `toPersistedBlock`이 소유한다(Y1). 두 곳에서 하면 규칙이 갈린다.
6. **블록 추가 분할 금지** — 위 구성 외의 블록을 만들지 않는다.
7. **A열이 비면 오류 행**으로 반환 (제목도 중복 키도 없어 저장 불가).

### 5.4 가져오기 마법사 UI

- **배치 (D6)**: AppShell 전역 모달. 진입점은 Sidebar 하단 버튼(신규 폴더 버튼 근처 관례). 전용 라우트 없음. **미로그인이면 진입 차단**(Y4).
- **단계**
  1. **시트 선택** — `Data_DS(최근 세트)` / `Stack(누적)` 라디오
  2. **행 지정** — 텍스트 입력(`15-32`, `15, 17, 20-25`) + `[사전 선별(M열 체크 표시) 된 문제 포함하기]` 체크박스.
     안내문: "행 범위를 비워 두면 사전 선별 문제만 가져옵니다". 둘 다 비활성이면 다음 버튼 disabled.
  3. **폴더 선택** — `listFolders` + `lib/folder-tree.ts`로 모달 안 인라인 트리 신규 작성.
     하단 `[폴더 새로 만들기]` → 현재 선택 폴더를 `parent_id`로 `createFolder({… order: getChildren(folders, parentId).length })`.
     최상위(폴더 없음) 선택 가능 → 그 경우 `folder_id` 미포함.
  4. **미리보기 (D9 + X3 + Y1)**
     ```ts
     const idToken = await user.getIdToken();                                  // Y4
     const res = await fetch('/api/sheet-import', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
       body: JSON.stringify({ sheet, rows, includePreselected }),
     });
     // 응답 → rowToDraft → 저장형 확정 (Y1·Y2·Y3)
     const persisted: Record<string, PersistedBlockData[]> = {};
     for (const [tabId, blocks] of Object.entries(draft.blocksByTab)) {
       persisted[tabId] = blocks.map((b, i) =>
         toPersistedBlock({ id: '', order: i, type: b.type, raw_text: b.raw_text } as Block, i));
     }
     ```
     **이 `persisted` 배열이 미리보기와 저장이 공유하는 단일 진실이다** — 화면에 보인 것이 그대로 저장된다. `block_key`도 여기서 확정된다.
     목록 각 행: 제목(A) · 탭/블록 구성 요약 · warnings 배지 · 중복 배지 · 체크박스.
     행 클릭 시 그 1건만 펼쳐 렌더 — **블록 타입 분기 필수(X3)**: `text` → `EditorPreview`, `choices` → `ChoicesBlock rawText={…}`. 접으면 언마운트.
     헤더 경고(D2)는 목록 상단 배너. 오류 행은 회색 + 체크 불가.
  5. **실행** — 선택된 draft 저장. 진행률(`n/총`), 완료 후 결과 요약(성공·실패·건너뜀 + 사유).
- **저장 로직 (draft 1건당)**
  1. `createProblem({ title, source, answer, year: new Date().getFullYear(), exam_type:'', category:'', difficulty:3, tags:[], authorUid, visibility:'private', tabs, ...(folderId ? {folder_id: folderId} : {}), import_source })`
  2. 탭별로 `persisted[tabId]`를 순서대로 `saveTabBlock(problemId, tabId, p)`.
     `PersistedBlockData`는 `Omit<Block,'id'>`에 구조적으로 대입 가능하다(Y2). `saveBlock`이 정제하지 않는 undefined 문제도 `toPersistedBlock`이 조건부로만 키를 넣으므로 해소된다.
  3. **블록 저장 실패 시 (D7)**: 해당 문항을 `deleteProblem`으로 best-effort 정리(블록·버전 캐스케이드 확인됨 — X6) 후 실패 집계. 정리 자체가 실패하면 결과 요약에 "정리 실패 — 수동 삭제 필요".
  4. 문항 간 롤백 없음. 동시성은 **3~5 병렬** 제한.
  5. 완료 후 `loadData()` 갱신.

### 5.5 중복 검사 · import 메타

```ts
export interface ImportSource {
  provider: 'audition-sheet';
  sheet: 'Data_DS' | 'Stack';
  row: number;
  source_id: string;
  imported_at: number;      // Date.now() — 클라이언트 시계
}
// Problem 에: import_source?: ImportSource;
```
마이그레이션 0 · Firestore 규칙 0 (§2-1).

- **중복 판정 키는 `import_source.source_id`(A열)** — 세트가 Data_DS→Stack으로 이동하면 행 번호가 바뀌기 때문.
  미리보기 진입 시 `listProblems(userId)`로 `source_id` 집합을 만들어 대조(`import_source`가 매핑을 통과함은 검증됨 — X5). 별도 색인 불필요.
- **D3**: 중복 행은 배지 + 체크 해제 + **체크 불가(skip 고정)**. 덮어쓰기는 후속 Phase(탭 블록 전삭제와 VCS 스냅샷 의미가 얽힌다). 툴팁 "이미 가져온 문항입니다".
- **G8 — 시트 내부 중복**: 선택 집합 안에 같은 `source_id`가 2개 이상이면 경고 배지, 저장은 첫 행만 체크된 상태로.

---

## 6. 작업 순서 (파일럿 우선)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 의존성·env 배선 + 서버 라우트(인증 포함) | 로컬에서 **Data_DS·Stack 각각** 실제 행 JSON 응답 확인. 토큰 없이 401, 허용목록 밖 uid 403. **응답의 `header`를 기록해 `EXPECTED_HEADERS`에 확정(Y5)** |
| 2 | `lib/sheetImport.ts` + 스냅샷 테스트 (`npm run test:sheet`) | `rowToDraft` 출력이 기대 블록 구성과 일치. `\\[6pt]` 보호(C6)·라벨 건너뜀·단답형·AI풀이 생략 케이스 포함 |
| 3 | 미리보기까지의 마법사 (저장 없이) | **덕수 검수 관문**: 실데이터 5~10행을 펼쳐 수식·마커·선택지 그리드 렌더 확인. **화면에 보이는 것이 `toPersistedBlock` 통과 후 텍스트임을 확인(Y1)**. 변환 규칙 피드백 반영 |
| 4 | 폴더 선택 + 저장 + 중복 검사 | 파일럿 폴더에 실제 문항 생성(에디터에서 열어 3개 탭 확인), 재실행 시 중복 감지·skip 확인 |
| 5 | 결과 요약·부분 실패 처리·마무리 | 빈 행/깨진 행 섞인 범위로 부분 실패 시나리오 통과 (고아 문항 0) |

**스텝 3이 유일한 중간 관문이다** — 변환 규칙은 사양이 아니라 실물로 확정한다(기획서 A-4).

---

## 7. 하지 말 것 / 주의

- 시트에 **쓰기 금지.** 스코프 자체를 `spreadsheets.readonly`로 잠근다.
- GAS 프로젝트(gas-project-audition)는 수정하지 않는다.
- 서비스 계정 키를 클라이언트 번들·리포지터리에 노출 금지 (`NEXT_PUBLIC_` 접두 절대 금지). 채팅창 반입 금지.
- **블록 자동 분할·마커 변환 등 "친절한 가공" 금지** — 유일한 예외는 D10의 `**AI 정답:** ` 접두.
- **`$$` 정규화를 `sheetImport.ts`에 중복 구현하지 말 것** — `toPersistedBlock`이 소유한다(Y1).
- 블록을 손으로 조립하지 말 것 — `toPersistedBlock` 경유(X4).
- `Problem.import_source`는 additive로만 — 기존 문항 마이그레이션 없음.
- CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · git push는 덕수가 직접(커밋까지만) · 완료 시 `docs/roadmap.md` 갱신.

---

## 8. 이 Phase가 건드리지 않는 것

Firestore 보안 규칙 · 마이그레이션 · 기존 문항 · 렌더 사이트 5곳 · 전처리 파이프라인 · 인쇄 · 공개 뷰어. **전부 0건.**
신규 파일 3개(`app/api/sheet-import/route.ts`, `lib/sheetImport.ts`, 마법사 컴포넌트) + 테스트 1개(`tests/sheetImport.test.mjs`) + `types/problem.ts` 필드 1개 + `package.json` 의존성 1개·스크립트 1개 + AppShell·Sidebar 진입점.

---

## 9. 구현자가 정하고 기록할 것

1. 마법사 컴포넌트 파일 위치·이름, Sidebar 진입점의 정확한 배치
2. 저장 동시성 값(3~5 중)과 근거
3. 헤더 기대 라벨의 실제 문자열 → 스텝 1에서 `EXPECTED_HEADERS` 확정 (Y5)
4. `DraftBlock` → `Block` 어댑터의 최종 형태 (Y2)
5. 위 1~4를 포함해 완료 후 Phase 문서(61a 구현 결과 → 교차검토 → 최종) 작성

---

*v4 실행판 — X1 기각·X2 강등·X3~X9 채택 + Y1~Y5 보완. 결정 D1~D10·G9 불변. B축(정밀 검증)은 Phase 61b.*
