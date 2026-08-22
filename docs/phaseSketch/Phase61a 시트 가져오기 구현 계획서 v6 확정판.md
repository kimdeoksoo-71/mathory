# Phase 61a 구현 계획서 — 스프레드시트 문항 가져오기 (v6 확정판)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`
> 계보: v1(CLI 초안) → v2(CLI 실측, C1~C7) → v3(web 교차검토, X1~X9) → v4(CLI 실행판, Y1~Y5 · **X1 오기각**)
>   → v5(web 재검증, Z1~Z5 · X1 재확정) → **v6(CLI가 origin/main 직접 인출로 분쟁 종결 + 오염 범위 전량 재검증, W1~W3)**
> **X1 분쟁은 종결됐다. v5가 옳고 v4가 틀렸다. 근거는 §0-1에 재현 가능한 형태로 박아 두었다.**
> 구현 사양은 v4/v5와 **동일하다(변경 0)**. 달라진 것은 근거의 등급과, 그 과정에서 새로 드러난 W1~W3이다.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. 한 줄 요약

Google Sheets(audition 스프레드시트의 `Data_DS`/`Stack`)를 서버 라우트가 **읽기 전용 스코프**로 가져오고,
클라이언트가 변환 → `toPersistedBlock`으로 **저장형 확정** → 미리보기 → 중복검사 → 기존 `lib/firestore.ts` CRUD 저장하는
가져오기 마법사를 만든다. **미리보기와 저장은 같은 배열을 본다(Y1).**

---

## 0-1. X1 분쟁 최종 판정 — 종결

### 판정

**v5가 옳다. v4의 기각은 오류였다.** `Movetostack.gs`는 **24열(A~X)**, `ErrorViewer.gs`는 **19열(A~S)**이다.
v4가 v3/v5의 인용을 "파일에 없는 문자열"이라 단정한 것은 **v4 자신이 stale한 로컬 사본을 읽었기 때문**이며,
v3/v5의 인용문은 원본과 **한 글자도 다르지 않다.**

### 증거 — 재현 가능한 1차 인출

이 문서를 검토하는 누구든 아래를 그대로 실행해 같은 결과를 얻을 수 있다. 논쟁이 아니라 관측이다.

```bash
# 1) 저장소·기본 브랜치·최신 커밋 확인
curl -s https://api.github.com/repos/kimdeoksoo-71/gas-project-audition | grep default_branch
curl -s "https://api.github.com/repos/kimdeoksoo-71/gas-project-audition/commits?per_page=1"

# 2) 원문 인출 (파일은 저장소 루트에 있다 — main/ 하위가 아니다)
curl -s https://raw.githubusercontent.com/kimdeoksoo-71/gas-project-audition/main/Movetostack.gs
curl -s https://raw.githubusercontent.com/kimdeoksoo-71/gas-project-audition/main/ErrorViewer.gs
```

**실행 결과 (2026-08-22, CLI Claude 직접 인출):**

- 저장소: 공개, `"default_branch": "main"`, HTTP 200
- 최신 커밋: **`b6b91f6e64074161f2b727173d73bfabddeeab87` · 2026-07-30T08:06:30Z · "난이도 통계 Stat 시트 추가"**
  → v5가 지목한 커밋 해시·날짜·메시지와 **정확히 일치**
- 저장소 트리에 **`QualityVerification.gs`·`QualityRunner.html`·`StatCalc.gs`·`Diagnostic503.gs` 존재**
  → v5가 인용한 STEP3 파일이 실재

`Movetostack.gs` 원문 (인출본 그대로):
```
 * Data_DS의 A~X(24열) 데이터를 Stack 시트 하단에 이어붙이고,          ← 파일 상단 주석
  // v2: 19 → 24 확장
  //  - 기존 버그 수정: numCols=19라 T열(모델명)이 이관에서 누락되고 있었음
  //  - STEP3 결과 열 U~X(21~24) 포함
  const numCols = 24;                // A~X = 24열
```
`ErrorViewer.gs` 원문:
```
  // A열(1)부터 S열(19)까지 한 번에 가져옴
  var data = sheet.getRange(startRow, 1, numRows, 19).getValues();
  var source = row[0];   // A: 문제 출처
  var thinking_tokens = row[18]; // S: thinking 토큰 수
```

### 근본 원인 — v4는 왜 틀렸나

v4가 읽은 `~/Documents/gas-project-audition/main/`은 **git 저장소가 아닌 로컬 사본**이고, 파일 타임스탬프는 **2026-04-08 / 04-19**다.
저장소의 최신 커밋은 2026-07-30 — **약 4개월 stale**이었다. 그 사이 열 폭이 `18 → 19(S·T 추가) → 24(U~X 추가)`로 두 번 확장됐다.
사본에는 `QualityVerification.gs`가 **아예 없다**. 즉 v4가 본 18열은 *거짓*이 아니라 *과거*였다.

**v4의 진짜 실수는 숫자를 잘못 읽은 것이 아니라 추론 단계에 있다.**
"이 폴더는 git 저장소가 아니다"라는 관측에서 v4는 *"그러므로 상대의 근거가 조작이다"* 로 건너뛰었다.
같은 관측에서 나왔어야 할 결론은 정반대다 — *"그러므로 **내 사본이** 어느 시점인지 알 수 없다."*
git 저장소가 아니라는 것은 상대의 출처를 무너뜨리는 사실이 아니라 **내 출처의 신뢰도를 낮추는 사실**이었다.
두 관측이 충돌할 때 먼저 물을 것은 "누가 맞나"가 아니라 **"각자 무엇을 읽었나"** 다.

### 파급 — X1 하나로 끝나지 않았다

v4의 §4 열 매핑표·§2-2 GAS 사실은 **전부 같은 stale 사본에서 나왔다.** 따라서 X1만 고치는 것으로는 부족하다.
v6는 GAS 관련 전제를 **origin/main에서 전량 재인출해 재검증했다**(§2-2). 결과: **구현 사양 변경 0**, 단 새 사실 3건(W1~W3)이 드러났다.

### 항구 조치

- **이후 GAS 인용은 GitHub origin/main만을 원천으로 하고, 인용마다 커밋 해시를 남긴다.** 이 문서의 GAS 인용은 전부 `b6b91f6` 기준이다.
- ~~`~/Documents/gas-project-audition`은 stale이므로 교체할 것~~ → **2026-08-22 완료.** `git clone`으로 교체했고
  `Movetostack.gs:35 numCols = 24` · `ErrorViewer.gs:29 …, 19)` · 신규 4파일 존재를 확인했다.
  ⚠️ **교체 후 파일은 `main/` 하위가 아니라 저장소 루트에 있다** — 경로가 바뀌었다.
- **3중 일치 확인 (2026-08-22)**: 덕수가 라이브 GAS를 push해 `Everything already up-to-date` 응답을 받았다
  → ① 라이브 Apps Script == ② GitHub `b6b91f6` == ③ 로컬 클론. GitHub가 라이브보다 stale할 위험은 이 시점에 없다.
  단 이 등식은 **시점 보증**일 뿐이다 — GAS를 다시 손보면 push 전까지 다시 벌어진다.

---

## 1. 아키텍처 (v1부터 불변)

**서버는 얇은 읽기 프록시, 저장은 클라이언트.**

- 서버 `app/api/sheet-import/route.ts` — 서비스 계정으로 시트를 읽어 행 데이터 JSON만 반환. **Firestore를 건드리지 않는다.**
- 클라이언트 — 변환(`lib/sheetImport.ts`) → 저장형 확정(`lib/blocks/normalize.ts`) → 미리보기 → 저장(`createProblem`/`saveTabBlock`/`createFolder`).

이유: (a) Admin SDK 불필요 → Firestore 보안 규칙·인증 체계 변경 0. (b) 저장 경로가 수동 문항 생성과 동일해져 규칙·VCS와 자연히 정합. (c) 서비스 계정 키는 서버에만 존재.

---

## 2. 실측으로 확정된 사실

### 2-1. Mathory 코드베이스 (2026-08-22 CLI 실측 — v4/v5와 동일)

| 사실 | 위치 |
|---|---|
| `Problem` 필수 = `title, year:number, exam_type, category, difficulty:number, tags:string[]`. `answer?`, `source?`, `folder_id?`, `tabs?`, `authorUid?`, `visibility?` 선택 | `types/problem.ts:1-41` |
| `TabMeta` = `{id,label}`, id 규약 `'question'|'solution'|'extra_0'|…`, 하위컬렉션 = `` `${tabId}_blocks` `` | `types/problem.ts:186-199` |
| `Block.type`에 `'text'`·`'choices'` 존재. 본문은 `raw_text`. **`id: string`은 필수 필드** | `types/problem.ts:152-186` |
| **`toPersistedBlock(b: Block, index: number): PersistedBlockData`** — `block_key: b.block_key \|\| nanoid()`, `order: index`, `title: b.title \|\| ''`, `raw_text`에 `normalizeDisplayMathSpacing` + 앞뒤 빈 줄 제거. **저장 경로와 버전 스냅샷의 단일 정형화 소스** | `lib/blocks/normalize.ts:13-52` |
| `normalizeDisplayMathSpacing`은 `$$…$$` 쌍을 토큰화해 앞뒤 빈 줄을 정규화. `$$`가 홀수면 나머지를 text로 두고 안전 통과 | `lib/preprocess.ts:35-` |
| 선택지 파싱 = `/^([①②③④⑤])\s*(.*)$/`, 내용 빈 줄 건너뜀, 최대 5개, **라벨은 기록된 순서 그대로**. **개수** 기준 3등분/5등분 배치 | `components/editor/ChoicesBlock.tsx:10-22, 26-27` |
| **`EditorPreview`는 마크다운 문자열 렌더러 — choices를 모른다.** 블록 타입 분기는 `TabBody`가 담당 | `components/problem/TabBody.tsx:9-10` |
| `createProblem(data)`는 undefined 필드를 사전 제거 | `lib/firestore.ts:29-42` |
| **`saveBlock`은 객체를 그대로 `addDoc` — undefined 제거 없음** | `lib/firestore.ts:332-341` |
| `saveTabBlock(problemId, tabId, block: Omit<Block,'id'>)` | `lib/firestore.ts:352-354` |
| `listProblems`는 `{ id, ...data, … }` 스프레드 매핑 → 임의 필드가 그대로 클라이언트에 도달 | `lib/firestore.ts:142-151` |
| `deleteProblem`은 **탭 블록 전체 + versions(payload 포함)** 캐스케이드 삭제 | `lib/firestore.ts:101-115` |
| `createFolder({name,user_id,order?,parent_id?})` / `listFolders(userId)` | `lib/firestore.ts:384, 396` |
| **신규 문항 생성 관례**: `year: new Date().getFullYear()`, `difficulty: 3`, `answer: ''`, `exam_type:''`, `category:''`, `tags:[]`, `authorUid`, `visibility:'private'`, `...(folderId ? {folder_id} : {})`. 이어서 question·solution에 빈 text 블록 1개씩 | `components/layout/AppShell.tsx:320-333` |
| 신규 폴더 관례: `order: getChildren(folders, parentId).length` | `components/layout/AppShell.tsx:371-372, 383-384` |
| problems create 규칙 = `isSignedIn() && request.resource.data.authorUid == request.auth.uid` — **필드 화이트리스트 없음** | `firestore.rules:84-86` |
| folders 규칙도 `user_id`만 검사 | `firestore.rules:449-454` |
| 폴더 트리 유틸 `buildFolderTree`·`flattenVisible`·`getChildren`·`getDescendantIds`·`getFolderPath` | `lib/folder-tree.ts` |
| `FolderMovePicker`는 `Sidebar.tsx` 내부 **비-export** 로컬 함수 → 모달용 재사용 부적합 | `components/layout/Sidebar.tsx:401-` |
| **ID 토큰 릴레이 선례**: `Authorization: Bearer <ID token>` + `runtime='nodejs'` + `dynamic='force-dynamic'` + `maxDuration` + 오류 메시지 화이트리스트(`ApiError`). 호출부는 `await user.getIdToken()` | `app/api/github/export/route.ts:11-46`, `components/editor/EditorView.tsx:2806` |
| 기존 AI 라우트(`proofread`·`ocr`·`discuss`·`ai-complete`)는 **인증 없음** | 실측 |
| Firebase 웹 API 키 = `NEXT_PUBLIC_FIREBASE_API_KEY` (서버에서도 `process.env`로 읽힌다) | `lib/firebase.ts:6` |
| `nanoid`는 이미 dependency(`^5.1.11`). `googleapis`·`google-auth-library`는 미설치 | `package.json` |
| 단위 테스트 하니스 = `tsc <단일 파일> --outDir .test-build --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/*.test.mjs` (`test:export`·`test:case`는 `--rootDir` 없음) | `package.json:8-11` |
| `.env.local`은 gitignore 됨 | `.gitignore:3` |

### 2-2. 시트(GAS) — **origin/main `b6b91f6`에서 전량 재인출·재검증 (2026-08-22)**

| # | 사실 | 위치 | 상태 |
|---|---|---|---|
| G-1 | 데이터는 **2행부터**(1행 헤더) | `Movetostack.gs` (`getRange(2, 1, …)`) | 불변 |
| G-2 | `parseRowInput_` = `,` 분리 + `a-b` 범위(**역순도 min/max 흡수**) + Set 중복제거 + 오름차순 | `normalizeProblem.gs:36-52` | **로컬 사본과 `diff` 결과 "동일"** — C7·행 파싱 사양 안전 |
| G-3 | STEP1·2 열: `SOLUTION:3(C)`, `STEM:5(E)`, `ANSWER_TYPE:11(K)`, `P_VERDICT:14(N)`, `P_DERIVED:15(O)`, `P_NOTE:16(P)`, `S_VERDICT:17(Q)`, `S_ERROR:18(R)`, **`THINKING_TOKENS:19(S)`**, **`MODEL_NAME:20(T)`** | `Itemverification.gs:85-96` | **A~P 구간 불변**, S·T가 신규 |
| G-4 | STEP3 열: `Q_VERDICT:21(U)`, `Q_REPORT:22(V)`, `Q_AUDIT:23(W)`, `JUDGE_MODEL:24(X)` | `QualityVerification.gs:75-82` | 신규 파일 |
| G-5 | **`Movetostack`은 A~X = 24열 고정 복사** (`const numCols = 24; // A~X = 24열`) | `Movetostack.gs:35` | **X1 확정** |
| G-6 | `ErrorViewer`는 **A~S = 19열** 고정 읽기 | `ErrorViewer.gs:29` | **X1 확정** |
| G-7 | `var source = row[0]; // A: 문제 출처` | `ErrorViewer.gs:39` | D4 근거 유지 |
| G-8 | GAS 전체가 **열 위치 하드코딩** — 중간 열 삽입은 GAS를 먼저 깨뜨린다 | 전 파일 | **D2 결론 불변** |
| **W1** | ⚠️ **GAS 코드 어디에도 M열(13)을 `get`으로 읽는 곳이 없다.** (`StatCalc.gs:71`의 `col: 13`은 **Stat 시트**의 난이도 통계 열이라 Data_DS와 무관) | 전 파일 grep | **G9는 코드로 검증 불가** — §아래 |
| **W2** | `Movetostack` 주석: *"Stack 시트 1행 헤더(T~X)는 **수동으로 추가**할 것 (코드는 헤더를 다루지 않음)"* | `Movetostack.gs:30-34` | **두 시트의 헤더 행이 다를 수 있다** — §아래 |
| **W3** | `Movetostack` 주석: *"과거 19열로 이관된 Stack 기존 행의 T~X는 빈칸으로 둠(소급 백필 없음)"* | `Movetostack.gs:30-34` | Stack에 열 폭이 다른 세대가 섞여 있다. **A~P만 읽으므로 우리에겐 무영향** — 재론 금지 |

#### W1의 처리 — G9는 증언 근거이지 코드 근거가 아니다

M열 `get` 체크박스는 **GAS가 전혀 쓰지 않는, 덕수가 손으로 켜는 열**이다. 따라서 존재 여부를 코드로 확인할 방법이 없고,
G9("이미 있음")는 **덕수의 확인 진술**에만 근거한다. 이건 결함이 아니라 성격이다 — 다만 **검증 시점을 못 박아야 한다**:

> **스텝 1 완료 기준에 추가**: 실제 응답에서 **Data_DS·Stack 두 시트의 M열 값**을 확인한다.
> M열이 비어 있거나 헤더가 `get`이 아니면 `includePreselected` 경로가 조용히 0건을 반환한다 —
> "사전 선별 문제만 가져오기"가 아무 일도 안 하는 것으로 보이므로 **원인 짚기가 어렵다.**
> 서버는 `includePreselected`가 참인데 M열 참인 행이 **0건**이면 `headerWarnings`에
> `"M열(get)에 선택된 행이 없습니다 — 시트의 체크박스를 확인하세요"`를 담아 돌려준다.

#### W2의 처리 — `EXPECTED_HEADERS`는 시트별로 확인한다

Stack의 헤더는 코드가 아니라 사람이 채운다. 따라서 Data_DS와 Stack의 1행이 **서로 다를 수 있다**.
드리프트가 알려진 구간은 T~X라 우리가 읽는 A~P와는 겹치지 않지만, **가정하지 말고 확인한다**:

> **스텝 1 완료 기준에 추가**: `header`를 **두 시트 각각** 기록해 대조한다.
> A~P 구간이 동일하면 `EXPECTED_HEADERS` 하나를 공유하고, 다르면 시트별 기대값으로 분리한다(Y5의 확장).

---

## 3. 정정·검토 이력

### 3-1. v1 → v2 (C1~C7, 전부 유지)

| # | 요지 |
|---|---|
| C1 | 필수 메타 기본값은 AppShell 관례(`year: 올해`, `difficulty: 3`, `answer:''`, `visibility:'private'`) |
| C2 | `firestore.rules`는 필드 화이트리스트를 하지 않는다 → 규칙 변경 0 확정 |
| C3 | 저장 블록에 `block_key` 포함 (v4부터 `toPersistedBlock`이 대행) |
| C4 | `source`에 A열(문제 출처). 기계 태그는 `import_source` 전담 |
| C5 | "헤더 이름으로 읽어 열 추가에 안전"은 거짓 전제 → 위치 고정 + 헤더 대조 경고(D2) |
| C6 | `\[…\]` → `$$` 단순 치환은 `\\[6pt]`를 파괴 → 뒤돌아보기 `(?<!\\)` 필수 |
| C7 | 행 번호는 시트 실제 행(데이터 2행부터), 역순 범위 흡수 포함 — **G-2로 origin/main 재확인** |

### 3-2. X1~X9 (v3, web) — v6 최종 판정

| # | v4 판정 | **v6 최종** |
|---|---|---|
| **X1** | 기각(사실무근) | **✅ 확정 — v3/v5가 옳다.** origin/main `b6b91f6` 직접 인출로 종결(§0-1). v4의 기각은 stale 로컬 사본에 기인한 오판이며, 인용 조작 의심은 **철회한다** |
| **X2** | 부연으로 강등 | **부연 유지** — v2도 lookup을 선례라 하지 않았다. 다만 X2가 덧붙인 설명이 정확하므로 §5.2 각주로 존치. 실질 쟁점 없음 |
| X3~X9 | 채택 | **유지** (X4가 Y1을 낳았다) |

### 3-3. Y1~Y5 (v4, CLI) — v5 전건 승인, v6 유지

| # | 내용 |
|---|---|
| **Y1** | **미리보기/저장 불일치 차단** — `toPersistedBlock`이 `raw_text`를 정규화하므로, 미리보기 진입 시점에 persisted 배열을 확정하고 **미리보기와 저장이 그 배열 하나를 공유**한다. `block_key`도 이때 확정 |
| **Y2** | `DraftBlock`→`Block` 어댑터: `{ id: '', order: i, type, raw_text } as Block`. `PersistedBlockData`는 `Omit<Block,'id'>`에 구조적 대입 가능 |
| **Y3** | `DraftBlock`에 `order`를 두지 않고 배열 인덱스가 순서를 소유. `toPersistedBlock(b,i)`가 `order:i` 확정 — **탭별로 0부터** |
| **Y4** | 클라이언트 호출부 `Authorization: Bearer ${await user.getIdToken()}` 명시 + 미로그인 진입 차단 |
| **Y5** | `EXPECTED_HEADERS`는 스텝 1에서 실물로 확정, 그전까지 `checkHeaders`는 빈 기대값 통과. 응답에 `header: string[]` 추가. **W2로 "시트별 확인"까지 확장** |

### 3-4. Z1~Z2 (v5, web) — v6 승인

| # | 내용 |
|---|---|
| **Z1** | X1 재확정 → **v6가 1차 인출로 독립 확증** |
| **Z2** | 출처 규칙(GAS는 origin/main만) → **v6가 채택하고 커밋 해시 명기 의무까지 강화**(§0-1 항구 조치) |

### 3-5. W1~W3 (v6, CLI) — 신규

§2-2 참조. **W1(M열은 코드 미참조 → 스텝 1 실물 확인 + 0건 경고)** 과 **W2(헤더는 시트별 확인)** 는 작업 순서에 반영했다.

### 3-6. 확정 결정사항 (D1~D10 + G9 — 전부 불변)

| # | 결정 |
|---|---|
| **D1** | 라우트 인증 = Firebase ID 토큰 릴레이 + `identitytoolkit accounts:lookup` 검증(**이 Phase에서 신규 작성**) + `AUDITION_ALLOWED_UIDS` 허용목록 |
| **D2** | 열 매핑의 진실 원천은 **열 위치 고정**. 1행 헤더는 대조해 불일치 시 **경고만** |
| **D3** | 이미 가져온 문항의 재가져오기는 **v1에서 skip 고정**. ⚠️ **판정 키는 `source_id` 단독이 아니라 `source_id` + `stem_hash`다(D11)** — 실측에서 id 충돌 67건이 나왔다 |
| **D4** | A열을 `title`과 `source` 둘 다에 넣는다 |
| **D5** | `google-auth-library` + Sheets REST fetch |
| **D6** | AppShell 전역 모달 + 모달 안 인라인 폴더 트리 신규 작성 |
| **D7** | 블록 저장 실패 시 방금 만든 문항을 best-effort `deleteProblem` 후 실패 처리 |
| **D8** | 1회 가져오기 행 수 상한 없음 |
| **D9** | 미리보기는 요약 목록 + 클릭한 1건만 펼쳐 렌더 |
| **D10** | AI풀이 탭 블록1(O열) 앞에 `**AI 정답:** ` 접두를 붙인다 |
| **G9** | M열 `get` 체크박스는 이미 존재 — **단 코드 근거가 아니라 덕수 증언 근거다(W1)** → 스텝 1에서 실물 확인 |

> ⚠️ **D10은 §7 "친절한 가공 금지"의 유일한 명시적 예외다.** O열은 정답 문자열 하나뿐이라 맥락 없이 놓이면 P열(AI 풀이)과 구분이 안 된다. 접두는 고정 문자열이며 O열 내용을 건드리지 않는다. 다른 열에는 어떤 접두도 붙이지 않는다.

---

## 4. 시트 사양

- 스프레드시트: gas-project-audition이 붙어 있는 문서. `Data_DS`(최근 세트, ≤50행) / `Stack`(누적).
- **1행 헤더, 데이터는 2행부터. 열 위치는 고정이다(D2·G-8).**
- **시트는 현재 X열(24)까지 쓴다.** 우리는 그중 A~P만 읽는다.

| 열 | 인덱스(1-based) | 기대 헤더 라벨 **(2026-08-22 실측 확정)** | 가져오기 | 용도 |
|---|---|---|---|---|
| A | 1 | `id` | O | 문항 **제목** + **`source`** + **중복검사 키** |
| C | 3 | `given_solution` | O | 풀이 탭 블록1 (text) |
| D | 4 | `given_answer` | O | `Problem.answer` |
| E | 5 | `problem_stem` | O | 문제 탭 블록1 (text) |
| F~J | 6~10 | `choice1`~`choice5` | O | 문제 탭 블록2 (choices) |
| M | 13 | `get` | 선별용 | 체크박스. 사전 선별 필터 (**W1** — GAS 미참조, 스텝 1에서 실물 확인) |
| O | 15 | `derived_answer` | O | AI풀이 탭 블록1 (text, 접두 D10) |
| P | 16 | `sloution_note` *(시트 원문 오타 그대로)* | O | AI풀이 탭 블록2 (text) |
| B, K, L, N, Q~X | — | — | X | 읽지 않음 (Q~X = 검증 결과·모델명·STEP3) |

- 읽기 범위는 **`A1:P`**(16열).
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
| `AUDITION_SPREADSHEET_ID` | 대상 스프레드시트 ID. 주소 `…/spreadsheets/d/<ID>/edit`의 `<ID>`만 — **앞뒤 `/`를 포함하면 요청 URL이 깨져 404가 난다**. 라우트가 방어적으로 정리한다(아래) |
| `AUDITION_ALLOWED_UIDS` | 쉼표 구분 Firebase uid 허용목록. 파싱 시 각 항목 `trim()` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 이미 존재 → D1 토큰 검증에 재사용 |

**덕수가 할 일** (코드 밖):
1. Firebase 프로젝트가 속한 GCP 콘솔에서 Google Sheets API 활성화
2. 서비스 계정 생성 + JSON 키 발급
3. 대상 스프레드시트를 서비스 계정 이메일에 **뷰어**로 공유
4. 위 환경변수 4종을 `.env.local`과 Vercel에 등록
5. 본인 Firebase uid를 확인해 `AUDITION_ALLOWED_UIDS`에 넣기
6. ~~`~/Documents/gas-project-audition` 교체~~ → **2026-08-22 완료** (§0-1). 1~5도 완료됨

> 🔒 **`GOOGLE_SA_PRIVATE_KEY`를 채팅창에 붙여넣지 말 것.** 덕수가 직접 파일·Vercel 콘솔에 입력하고 "등록 완료"만 알린다. (2026-05-13 사고 이력)
> M열 체크박스는 이미 있다는 확인을 받았으므로 시트 작업은 없다 — 다만 스텝 1에서 실물로 재확인한다(W1).

### 5.2 서버 라우트 — `app/api/sheet-import/route.ts`

```
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

POST /api/sheet-import
headers: Authorization: Bearer <Firebase ID token>
body: { sheet: 'Data_DS' | 'Stack', rows?: string, includePreselected?: boolean }
응답: {
  header: string[],                                    // 1행 원문 (Y5·W2 — 기대 라벨 확정용)
  headerWarnings: string[],                            // 기대 라벨 불일치 + M열 0건 경고(W1)
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

> ℹ️ (X2) `github/export`는 릴레이한 토큰을 **Firestore REST에 그대로 써서** 보안 규칙이 인가를 대행하므로 검증 코드가 없다. sheet-import는 Firestore를 안 거쳐 그 대행이 불가능하다 → `accounts:lookup` 검증을 **여기서 새로 쓴다**. 선례에서 가져오는 것은 릴레이 형식·route config·오류 화이트리스트다.

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
// 스프레드시트 ID 방어적 정리 — 붙여넣기 실수(앞뒤 `/`·공백)를 원인 모를 404로 만들지 않는다
const id = (process.env.AUDITION_SPREADSHEET_ID ?? '').trim().replace(/^\/+|\/+$/g, '');
const range = encodeURIComponent(`${sheet}!A1:P`);
const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`
          + `?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;
```
- `valueRenderOption=UNFORMATTED_VALUE` 명시 — 체크박스가 boolean, 수식 셀이 계산값으로 온다. 숫자 셀도 있으므로 **모든 셀을 `String(v ?? '')`로 정규화**.
- ⚠️ **ragged row**: Sheets는 행 끝의 빈 셀을 잘라서 준다. 인덱스 접근 전 **길이 16으로 패딩**.
- M열 값은 `true` / `'TRUE'` / `1` 어느 형태로 와도 참으로 판정.

**행 선택**:
- `rows` 파싱은 `parseRowInput_`와 동일 의미론(G-2로 origin/main 확인): `,` 분리 → `a-b`는 `min..max` → 정수만 → Set → 오름차순.
- 선택 규칙: `rows`만 → 그 집합 / `includePreselected`만 → M열 참인 행 / **둘 다 → 합집합** / 둘 다 없으면 **400**.
- **`includePreselected`가 참인데 M열 참인 행이 0건이면 `headerWarnings`에 안내를 담는다(W1).** 오류는 아니다.
- 헤더 행(1)은 결과에서 제외. `sheet` 값이 두 이름 중 하나가 아니면 400.
- **A·E가 모두 빈 행은 결과에서 제외**(시트 말미 빈 행 스킵).
- 행 수 상한 없음(D8). 응답은 선택된 행만 담으므로 페이로드는 선택량에 비례한다.

**오류 코드**: 400(sheet 부정/rows 파싱 실패/선택 조건 없음) · 401(토큰 없음·무효) · 403(허용목록 밖) · 500(env 미설정 — **어떤 변수가 없는지 이름만**) · 502(Sheets API 실패).

### 5.3 변환 모듈 — `lib/sheetImport.ts` (순수 함수, **import 0** — X8)

> **테스트 하니스**: `"test:sheet": "tsc lib/sheetImport.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/sheetImport.test.mjs"`
> ⚠️ **`--rootDir .`이 필요하다** — 없으면 tsc가 rootDir을 `lib/`로 추론해 산출물이 `.test-build/sheetImport.js`로 떨어진다.
> 다른 테스트가 전부 `.test-build/lib/*.js`를 import하므로 경로 규약을 맞춘다(`test:locale`과 동일).
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

- **배치 (D6)**: AppShell 전역 모달. 진입점은 Sidebar 하단 버튼. 전용 라우트 없음. **미로그인이면 진입 차단**(Y4).
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
     `headerWarnings`(D2·W1·W2)는 목록 상단 배너. 오류 행은 회색 + 체크 불가.
  5. **실행** — 선택된 draft 저장. 진행률(`n/총`), 완료 후 결과 요약(성공·실패·건너뜀 + 사유).
- **저장 로직 (draft 1건당)**
  1. `createProblem({ title, source, answer, year: new Date().getFullYear(), exam_type:'', category:'', difficulty:3, tags:[], authorUid, visibility:'private', tabs, ...(folderId ? {folder_id: folderId} : {}), import_source })`
  2. 탭별로 `persisted[tabId]`를 순서대로 `saveTabBlock(problemId, tabId, p)`.
     `PersistedBlockData`는 `Omit<Block,'id'>`에 구조적으로 대입 가능(Y2). `saveBlock`이 정제하지 않는 undefined 문제도 `toPersistedBlock`이 조건부로만 키를 넣으므로 해소된다.
  3. **블록 저장 실패 시 (D7)**: 해당 문항을 `deleteProblem`으로 best-effort 정리(블록·버전 캐스케이드 — X6) 후 실패 집계. 정리 자체가 실패하면 결과 요약에 "정리 실패 — 수동 삭제 필요".
  4. 문항 간 롤백 없음. 동시성은 **3~5 병렬** 제한.
  5. 완료 후 `loadData()` 갱신.

### 5.5 중복 검사 · import 메타

```ts
export interface ImportSource {
  provider: 'audition-sheet';
  sheet: 'Data_DS' | 'Stack';
  row: number;              // 가져온 시점의 행 번호. 식별자가 아니다(세트 이동 시 바뀐다)
  source_id: string;        // A열
  stem_hash: string;        // 정규화된 E열의 해시 — lib/sheetImport.ts의 stemHash (D11)
  imported_at: number;      // Date.now() — 클라이언트 시계
}
// Problem 에: import_source?: ImportSource;
```
마이그레이션 0 · Firestore 규칙 0 (§2-1).

- **중복 판정 키는 `import_source.source_id`(A열)** — 세트가 Data_DS→Stack으로 이동하면 행 번호가 바뀌기 때문(Movetostack이 실제로 그렇게 동작함을 G-5로 확인).
  미리보기 진입 시 `listProblems(userId)`로 `source_id` 집합을 만들어 대조(X5). 별도 색인 불필요.
- **D3**: 중복 행은 배지 + 체크 해제 + **체크 불가(skip 고정)**. 덮어쓰기는 후속 Phase. 툴팁 "이미 가져온 문항입니다".
- **G8 — 시트 내부 중복**: 선택 집합 안에 같은 `source_id`가 2개 이상이면 경고 배지, 저장은 첫 행만 체크된 상태로.

---

## 6. 작업 순서 (파일럿 우선)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 의존성·env 배선 + 서버 라우트(인증 포함) | 로컬에서 **Data_DS·Stack 각각** 실제 행 JSON 응답 확인. 토큰 없이 401, 허용목록 밖 uid 403. **① `header`를 두 시트 각각 기록해 `EXPECTED_HEADERS` 확정(Y5·W2) ② M열 실물 확인 — `includePreselected`로 1건 이상 잡히는지(W1)** |
| 2 | `lib/sheetImport.ts` + 스냅샷 테스트 (`npm run test:sheet`) | `rowToDraft` 출력이 기대 블록 구성과 일치. `\\[6pt]` 보호(C6)·라벨 건너뜀·단답형·AI풀이 생략 케이스 포함 |
| 3 | 미리보기까지의 마법사 (저장 없이) | **덕수 검수 관문**: 실데이터 5~10행을 펼쳐 수식·마커·선택지 그리드 렌더 확인. **화면에 보이는 것이 `toPersistedBlock` 통과 후 텍스트임을 확인(Y1)**. 변환 규칙 피드백 반영 |
| 4 | 폴더 선택 + 저장 + 중복 검사 | 파일럿 폴더에 실제 문항 생성(에디터에서 열어 3개 탭 확인), 재실행 시 중복 감지·skip 확인 |
| 5 | 결과 요약·부분 실패 처리·마무리 | 빈 행/깨진 행 섞인 범위로 부분 실패 시나리오 통과 (고아 문항 0) |

**스텝 3이 유일한 중간 관문이다** — 변환 규칙은 사양이 아니라 실물로 확정한다(기획서 A-4).

---

## 7. 하지 말 것 / 주의

- 시트에 **쓰기 금지.** 스코프 자체를 `spreadsheets.readonly`로 잠근다.
- GAS 프로젝트(gas-project-audition)는 수정하지 않는다.
- **GAS 코드 인용·판단은 GitHub origin/main만을 원천으로 하고 커밋 해시를 남긴다(§0-1).** `~/Documents`의 로컬 사본은 2026-04자 stale — 교체 전까지 어떤 판단의 근거로도 쓰지 않는다.
- 서비스 계정 키를 클라이언트 번들·리포지터리에 노출 금지 (`NEXT_PUBLIC_` 접두 절대 금지). 채팅창 반입 금지.
- **블록 자동 분할·마커 변환 등 "친절한 가공" 금지** — 유일한 예외는 D10의 `**AI 정답:** ` 접두.
- **`$$` 정규화를 `sheetImport.ts`에 중복 구현하지 말 것** — `toPersistedBlock`이 소유한다(Y1).
- 블록을 손으로 조립하지 말 것 — `toPersistedBlock` 경유(X4).
- **Stack에 T~X가 빈칸인 과거 세대 행이 섞여 있다(W3). A~P만 읽으므로 무관 — 재론 금지.**
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
3. 헤더 기대 라벨의 실제 문자열 → 스텝 1에서 `EXPECTED_HEADERS` 확정, 두 시트 동일 여부까지 (Y5·W2)
4. `DraftBlock` → `Block` 어댑터의 최종 형태 (Y2)
5. M열 실물 확인 결과 (W1)
6. 위 1~5를 포함해 완료 후 Phase 문서(61a 구현 결과 → 교차검토 → 최종) 작성

---

## 부록. 문서 계보와 교훈

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | CLI | 초안(아키텍처·플로우) |
| v2 | CLI | 실측 정정 C1~C7 · 결정 D1~D10 |
| v3 | web | 교차검토 X1~X9 (X4 → `toPersistedBlock` 재사용) |
| v4 | CLI | 실행판 Y1~Y5 (Y1: 미리보기=저장 단일 배열) · **X1 오기각** |
| v5 | web | X1 재확정(Z1) · 출처 규칙(Z2) · Y1~Y5 승인 |
| **v6** | **CLI** | **origin/main 1차 인출로 X1 종결 · 오염 범위 전량 재검증 · 신규 W1~W3 · 확정판** |

### 교훈 — 두 관측이 충돌할 때

X1의 왕복은 양쪽 다 "실측"을 했는데도 일어났다. 한쪽은 origin/main을, 한쪽은 git 저장소도 아닌 4개월 된 로컬 사본을 읽었다.

1. **사실 분쟁이 생기면 "누가 맞나"보다 "각자 무엇을 읽었나"를 먼저 대조하라.** 두 실측이 다르면 대개 한쪽이 거짓말한 게 아니라 **다른 것을 보고 있다.**
2. **자기 출처의 신뢰도를 낮추는 관측을, 상대 출처를 깎는 근거로 오독하지 말라.** v4는 "내 폴더가 git이 아니다"에서 "상대가 조작했다"로 건너뛰었다. 같은 사실이 가리키던 것은 정반대였다.
3. **인용에는 커밋 해시(또는 인출 경로)를 남겨라.** 그러면 왕복 없이 한 번에 끝난다 — §0-1의 curl 두 줄이 이 분쟁 전체를 3분 만에 종결시켰다.
4. **오염된 출처를 발견하면 그 출처에서 나온 것을 전부 다시 보라.** X1만 고쳤다면 §4 열 매핑표는 여전히 4월 사본 근거로 남았을 것이다. 재검증 결과 A~P는 불변이었지만, 그건 **확인한 뒤에야 할 수 있는 말**이다.

---

## 10. 구현 기록 — 스텝 1·2 (2026-08-22)

### 10-1. 완료된 것

| 산출물 | 상태 |
|---|---|
| `google-auth-library@^11.0.2` | 설치 |
| `lib/sheetImport.ts` | import 0 · strict 타입체크 통과 |
| `tests/sheetImport.test.mjs` + `npm run test:sheet` | **29/29 통과** |
| `app/api/sheet-import/route.ts` | 토큰 없음 → 401, 위조 토큰 → 401 확인 |
| `types/problem.ts` | `ImportSource` + `Problem.import_source?` 추가 (additive) |

**200 경로는 스텝 3(마법사 UI)에서 확인한다** — 유효한 Firebase ID 토큰이 필요하고, 그 토큰은
`user.getIdToken()`으로 UI가 얻는다. 시트 읽기 자체는 동일한 URL·파라미터·자격증명으로 프로브에서 증명됐다.

### 10-2. 실물 실측 (스텝 1 완료 기준 ①②)

- **헤더 확정 — Data_DS·Stack이 동일했다(W2 해소).** `EXPECTED_HEADERS`를 코드·테스트에 박았다.
  `A id · B problem · C given_solution · D given_answer · E problem_stem · F~J choice1~5 ·
   K answer_type · L (빈 문자열) · M get · N problem_verdict · O derived_answer · P sloution_note`
  P열 오타(`sloution_note`)는 계획서 예측대로였다.
- **M열 실물 — 체크된 행 0건(W1).** Data_DS 0/2,224 · Stack 0/3,982. 지금 `includePreselected`를 쓰면
  0건이 나오므로 계획대로 안내를 응답에 담는다. **덕수가 시트에서 체크박스를 켜야 이 경로가 쓰인다.**
- **행 수**: Data_DS 유효 38행(전체 2,224행 — 체크박스가 전 행에 깔려 lastRow가 크게 잡힌다) ·
  Stack 유효 3,944행(전체 3,982행).
- **ragged row 실증**: Data_DS 2,186/2,224 · Stack 574/3,982이 16칸 미만으로 온다. **패딩 필수**가 사실로 확인됐다.
- **응답 크기**: 행당 약 3KB. 100행 ≈ 0.3MB. Stack 전량은 12.15MB로 **Vercel 한도(4.5MB) 초과** →
  라우트가 4MB에서 413 + "범위를 나눠서 가져오세요"로 멈춘다(D8의 "상한 없음"은 유지 — 행 수를 캡하지 않고 한도에서 정직하게 실패한다).
- **Sheets 왕복**: Data_DS 0.5초 · Stack 1.5초(12.6MB). `maxDuration = 30`으로 충분하다.

### 10-3. 새로 드러난 사실과 결정 (D11·D12)

| # | 사실 | 결정 |
|---|---|---|
| **D11** | ⚠️ **`source_id`는 유일 키가 아니다.** Stack의 중복 id 906그룹 중 **67그룹은 문항 본문이 서로 다르다**(id 충돌). `source_id` 단독 판정이면 서로 다른 문항을 "이미 가져옴"으로 **조용히 건너뛴다** | **중복 키 = `source_id` + `stem_hash`**(정규화된 E열 해시). 실측 검증: 진짜 중복 839그룹은 여전히 뭉치고, 충돌 67그룹은 분리돼 **68문항을 되찾았다**. Data_DS→Stack 이동은 본문이 같으므로 여전히 중복으로 잡힌다 — 원래 목적 유지 |
| **D12** | **D열(공식 정답)이 사실상 비어 있다.** Data_DS **0/38** · Stack 152/3,944(3.9%). 반면 O열(AI가 구한 답)은 차 있다 | **`answer`는 D열만 쓴다.** 비면 빈 값. AI 추정답을 공식 정답으로 등록하면 나중에 둘을 구분할 수 없다. O열 값은 AI풀이 탭 블록1에 `**AI 정답:** `로 들어간다 |
| **D13** | **Data_DS 38행이 Stack에 100% 이미 있다.** 기획서의 "Stack = 최근 세트를 *제외한* 누적"이 현재 성립하지 않는다 | 기능 변경 없음. 어느 시트를 골라도 같은 문항이며, 한쪽에서 가져온 뒤 다른 쪽에서 또 고르면 전부 skip되는 것이 **정상 동작**이다 |

### 10-4. 구현 중 잡은 함정

- ⚠️ **M열은 원시값으로 판정해야 한다.** `UNFORMATTED_VALUE`는 체크 해제를 boolean `false`로 주는데,
  모든 셀을 `String(v ?? '')`로 먼저 정규화하면 `"false"` — **비어 있지 않은 문자열** — 이 되어
  truthy 검사가 전부 참이 된다. 라우트는 패딩 **전**의 원시값으로 판정하고, 허용값을 화이트리스트로 둔다.
- ⚠️ **`AUDITION_SPREADSHEET_ID`에 `/`가 섞이면 원인 모를 404가 된다.** 라우트가 앞뒤 `/`·공백을 정리한다.
- ⚠️ **dev 서버가 도는 중에 `npm i`를 하면 그 서버가 죽는다.** 모듈 해석이 깨진다 — 의존성 추가 후에는 dev를 재시작할 것.

### 10-5. 스텝 3 검수에서 잡힌 것 — 선택지 라벨 중복 (D14)

덕수 검수(2026-08-22)에서 선택지가 **`① ① 39`** 처럼 라벨이 두 번 나왔다.

원인: **시트의 F~J는 원문자를 포함한 셀과 포함하지 않은 셀이 섞여 있다.**
`ChoicesBlock`은 `raw_text` 맨 앞의 원문자를 라벨로 읽어 별도 span으로 그리는데,
이미 라벨이 든 셀에 위치 기준 라벨을 덧붙이니 두 번 나왔다.

실측(Stack 선택지 2,740행):

| 구분 | 행 수 |
|---|---|
| 셀에 원문자 **없음** (우리가 붙이는 것이 맞음) | 2,238 |
| 셀에 원문자 **있음** (덧붙이면 중복) | 502 |
| 한 행 안에서 섞임 | 0 |
| **셀의 라벨이 열 위치와 어긋남** | **0** |

마지막 줄이 결정적이다 — 라벨과 위치가 항상 일치하므로 **셀의 라벨을 떼어내도 정보 손실이 없다.**

**D14**: `stripChoiceLabel`이 셀 앞머리의 원문자를 떼고, 라벨은 **열 위치 기준으로만** 붙인다.
라벨만 있고 내용이 없는 셀은 건드리지 않는다(빈 선택지로 떨어져 줄이 사라지는 것을 막는다).
정규식은 `[ \t]*`를 쓴다 — `\s*`는 개행을 포함해 여러 줄짜리 선택지의 다음 줄을 빨아들인다(CLAUDE.md 규약).

검증: Stack 2,740행 · 선택지 13,700줄 전량에서 **중복 라벨 0건**.

### 10-6. Stack 전량 변환 결과 (초안 품질)

3,944행 전량이 오류 없이 초안으로 변환됐다(A열 빈칸 0건).

- 선택지 블록 생성(객관식): 2,740 / 3,944
- AI풀이 탭 생성: 3,503
- `answer`(D열) 채워짐: 152
- **경고 있는 행: 221 (5.6%)** — C열(풀이) 비어 있음 185건 · `$` 개수 홀수 36건.
  `$` 홀수는 시트 원본이 깨진 것이므로 **고치지 않고 알리기만 한다**(계획서 §5.3-5).

---

*v6 확정판 — X1 종결(v5 인용이 원문과 완전 일치, v4 기각 철회). 스텝 1·2 구현 완료(§10), 신규 결정 D11~D13 반영. 다음은 스텝 3(미리보기 마법사, 덕수 검수 관문). B축(정밀 검증)은 Phase 61b.*
