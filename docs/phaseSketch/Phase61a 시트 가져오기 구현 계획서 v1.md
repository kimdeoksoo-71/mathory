# Phase 61a 구현 계획서 — 스프레드시트 문항 가져오기 (v1)

> 대상: CLI Claude (구현 담당) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`
> 범위: 기획서의 **A축(문항 가져오기)만**. B축(정밀 검증)·C축(대화→삽입)은 후속 Phase(61b, 61c)로 분리.
> 이 문서의 코드 참조는 2026-08-21 시점 main 기준. **작업 전 반드시 현재 파일을 다시 읽을 것** (CLAUDE.md 규칙 1).

---

## 0. 한 줄 요약

Google Sheets(audition 스프레드시트의 Data_DS/Stack 시트)를 서버 라우트가 **읽기 전용**으로 가져오고, 클라이언트가 변환·미리보기·중복검사 후 **기존 `lib/firestore.ts` CRUD로 저장**하는 가져오기 위저드를 만든다.

---

## 1. 아키텍처 결정 (핵심)

**서버는 얇은 읽기 프록시, 저장은 클라이언트.**

- 서버(`app/api/sheet-import/route.ts`): 서비스 계정으로 시트를 읽어 행 데이터 JSON만 반환. Firestore를 건드리지 않는다.
- 클라이언트(가져오기 위저드): 변환(`lib/sheetImport.ts`) → 미리보기(`EditorPreview` 재사용) → 저장(기존 `createProblem`/`saveTabBlock`/`createFolder`).

이유: (a) Admin SDK 도입 불필요 — Firestore 보안 규칙·인증 체계 변경 0. (b) 저장 경로가 수동 문항 생성과 동일해져 규칙·버전관리(version_seq 등)와 자연히 정합. (c) 서비스 계정 키는 서버에만 존재.

---

## 2. 확인된 코드베이스 사실 (구현 전 재확인할 것)

| 사실 | 위치 |
|---|---|
| `Problem`: `title`, `year:number`, `exam_type`, `category`, `difficulty`, `tags` 는 **필수 필드**. `answer?`, `source?`, `folder_id?`, `tabs?: TabMeta[]`, `authorUid?` 선택 | `types/problem.ts:1-41` |
| `TabMeta` id 규약: `'question' | 'solution' | 'extra_0' | 'extra_1' ...`, 블록 하위컬렉션명은 `tabSubcollection(tabId)` = `` `${tabId}_blocks` `` | `types/problem.ts:186-199` |
| `Block.type`에 `'text'`, `'choices'` 존재. `raw_text`가 본문 | `types/problem.ts:152-163` |
| **선택지 블록 raw_text 형식**: 줄 단위 `① 내용\n② 내용\n...` — `ChoicesBlock.tsx`의 `parseChoices()`가 `/^([①②③④⑤])\s*(.*)$/`로 파싱, 내용 빈 줄은 건너뜀, 최대 5개 | `components/editor/ChoicesBlock.tsx:10-22` |
| CRUD: `createProblem(data)` (undefined 필드 자동 제거), `saveTabBlock(problemId, tabId, block)`, `createFolder({name, user_id, order?, parent_id?})`, `listFolders(userId)`, `listProblems(userId, filter?)` | `lib/firestore.ts:29, 352, 384, 396, 126` |
| 폴더는 평면 배열 + `parent_id` 트리. 트리 빌드/자식 조회 유틸 존재 (`buildFolderTree`, `getChildren`) | `lib/folder-tree.ts` |
| API 라우트 패턴: `app/api/{name}/route.ts`, `NextRequest`/`NextResponse`, 모델·키는 `process.env` | `app/api/proofread/route.ts` |
| `googleapis` 패키지는 **아직 package.json에 없음** — 설치 필요 | `package.json` |

추가 확인 사항(구현 중): 폴더 탐색 UI가 이미 있는지 (`Sidebar.tsx` / 문항 이동 UI에 폴더 선택 모달이 있다면 재사용), `firestore.rules`가 problems 문서의 필드를 화이트리스트로 제한하는지 (새 필드 `import_source` 추가 가능 여부).

---

## 3. 시트 사양 (원본 데이터)

- 스프레드시트: gas-project-audition이 붙어 있는 문서. 시트 2개 모두 **같은 열 구조**: `Data_DS`(최근 세트, ≤50행), `Stack`(과거 세트 누적).
- 1행은 헤더. **열 위치가 아니라 헤더 이름으로 매핑할 것** (열 추가에 견디도록). 단, 헤더 라벨의 정확한 문자열은 아래 표의 영문 라벨과 다를 수 있으므로 구현 시 실제 시트의 1행을 읽어 확정하고, 매핑 테이블을 상수로 분리해 둘 것.

| 열 | 헤더(영문 라벨) | 가져오기 | 용도 |
|---|---|---|---|
| A | id | O | 문항 제목 (그대로) + **중복검사 키** |
| C | given_solution | O | 풀이 탭 블록1 (text) |
| D | given_answer | O | `Problem.answer` |
| E | problem_stem | O | 문제 탭 블록1 (text) |
| F~J | choice1~choice5 | O | 문제 탭 블록2 (choices) |
| M | get | 선별용 | 체크박스(불리언). 사전 선별 필터 |
| O | derived_answer | O | AI풀이 탭 블록1 (text) |
| P | sloution_note *(시트 원문 오타 그대로)* | O | AI풀이 탭 블록2 (text) |
| 그 외 (B, K, L, N, Q~X) | — | X | 읽지 않음 |

- 시트는 **읽기 전용**. 어떤 경우에도 쓰기 API를 호출하지 않는다.
- 체크박스 값: Sheets API에서 `TRUE`/`FALSE` 문자열 또는 boolean으로 옴 — 양쪽 다 처리.

---

## 4. 구현 항목

### 4.1 의존성·환경변수·수동 준비 (덕수 작업 포함)

- `npm i googleapis` (또는 경량 원하면 `google-auth-library` + REST fetch — 구현자가 택1, 이하 googleapis 기준).
- 환경변수 (Vercel + `.env.local`):
  - `GOOGLE_SA_EMAIL` — 서비스 계정 이메일
  - `GOOGLE_SA_PRIVATE_KEY` — 개인키 PEM (Vercel 저장 시 `\n` 이스케이프 주의: 코드에서 `key.replace(/\\n/g, '\n')`)
  - `AUDITION_SPREADSHEET_ID` — 대상 스프레드시트 ID
- **덕수가 할 일** (코드 밖, 안내 문서로 정리해 줄 것):
  1. Firebase 프로젝트가 속한 GCP 콘솔에서 Google Sheets API 활성화
  2. 서비스 계정 생성 + JSON 키 발급
  3. 대상 스프레드시트를 서비스 계정 이메일에 **뷰어**로 공유
  4. 위 환경변수 3종을 Vercel에 등록

### 4.2 서버 라우트 — `app/api/sheet-import/route.ts`

```
POST /api/sheet-import
요청: { sheet: 'Data_DS' | 'Stack', rows?: string, includePreselected?: boolean }
  - rows: "15-32" | "15, 17, 20-25" | 생략(빈 문자열)
  - includePreselected: M열 체크 행 포함 여부
응답: { headerMap: Record<string,number>, rows: Array<{ rowIndex: number, data: Record<string,string> }> }
  - data: 헤더 이름 → 셀 값 (가져오기 대상 + M열만)
오류: 400(sheet 값 불량 / rows 파싱 실패 / rows·includePreselected 둘 다 비활성), 502(Sheets API 실패 — 원인 메시지 포함), 500(env 미설정 — 어떤 변수가 없는지 명시)
```

- 행 범위 파서는 GAS의 `parseRowInput_` 의미론을 따른다: 쉼표 구분, `a-b` 범위, 중복 제거. **행 번호는 시트 실제 행 번호**(헤더=1행이므로 데이터는 2행부터).
- 선택 규칙: `rows`가 있으면 그 집합, `includePreselected`면 M열 TRUE 행 집합, **둘 다 있으면 합집합**, 둘 다 없으면 400.
- 전 범위를 한 번에 읽고(`values.get`, 범위 `A1:X{lastRow}` 수준) 서버에서 필터 — 행별 API 호출 금지.
- A·E가 모두 빈 행은 결과에서 제외(완전 빈 행 스킵).
- 인증 수준: 기존 AI 라우트들과 동일 수준으로 맞춘다(현재 라우트들이 별도 토큰 검증을 하지 않는다면 이 라우트도 동일하게 두되, 데이터가 읽기 전용 문항 텍스트임을 주석으로 명시). 기존 라우트에 검증 패턴이 있으면 그대로 따를 것.

### 4.3 변환 모듈 — `lib/sheetImport.ts` (순수 함수, UI 무의존)

```ts
interface ImportRow { rowIndex: number; data: Record<string, string> }
interface ProblemDraft {
  sourceId: string;            // A열
  title: string;               // = sourceId
  answer?: string;             // D열
  tabs: TabMeta[];             // question, solution [, extra_0(AI풀이)]
  blocksByTab: Record<string, Array<Pick<Block,'type'|'raw_text'|'order'>>>;
  warnings: string[];          // 변환 중 이상 징후 (미리보기에 표시)
}
function rowToDraft(row: ImportRow): ProblemDraft | { error: string }
```

변환 규칙 (기획서 A-3·A-4 확정 사항):

1. **문제 탭** (`question`): 블록1 = `text`(E열). F~J 중 내용 있는 것이 1개 이상이면 블록2 = `choices`, raw_text는 `① {F}\n② {G}\n③ {H}\n④ {I}\n⑤ {J}` — 빈 선택지는 줄 자체를 생략(`parseChoices` 규격과 일치). F~J 전부 비면(단답형) choices 블록 없음.
2. **풀이 탭** (`solution`): 블록1 = `text`(C열). C가 비어도 탭은 만들되 빈 블록 1개(기존 문항 생성 관례 확인 후 동일하게 — 빈 블록을 만들지 않는 게 관례면 그것을 따름).
3. **AI풀이 탭**: O·P 중 하나라도 있으면 `extra_0`/label `AI풀이` 탭 생성, 블록1 = `text`(O열: AI 정답), 블록2 = `text`(P열: AI 풀이). 둘 다 비면 탭 생성 안 함. (동적 탭 id는 기존 문항엔 충돌 여지가 없지만, 위저드는 항상 새 문항을 만들므로 `extra_0` 고정으로 충분.)
4. **텍스트 정규화** (E·C·O·P 공통, 최소주의):
   - `\(...\)` → `$...$`, `\[...\]` → `$$...$$`
   - CRLF → LF, 연속 3개 이상 빈 줄 → 2개, 앞뒤 trim
   - 그 외 마커((가)·ㄱ.·① 등)는 **건드리지 않는다** — Mathory는 리터럴 보존이 규약 (CLAUDE.md 전처리 절)
   - 정규화 이상(예: `$` 홀수 개)은 고치지 말고 `warnings`에 기록
5. 블록 추가 분할 금지 — 위 구성 외의 블록을 만들지 않는다.

이 모듈은 **파일럿 검증 대상**이므로 순수 함수로 두고, 실제 시트 5~10행 샘플로 스냅샷 테스트를 붙일 것(`tests/` 관례 확인).

### 4.4 가져오기 위저드 UI

- 진입점: My(폴더) 화면 쪽 — 기존 UI 관례에 맞는 위치를 구현자가 정하되(예: Sidebar 하단 버튼 또는 폴더 화면 메뉴), **모달 위저드** 형태 권장. 라우트 신설보다 기존 AppShell 안 모달이 관례에 맞는지 먼저 확인.
- 단계 (기획서 A-2 확정 플로우):
  1. **시트 선택**: `Data_DS(최근 세트)` / `Stack(누적)` 라디오
  2. **행 지정**: 행 범위 텍스트 입력 + `[사전 선별(M열 체크 표시) 된 문제 포함하기]` 체크박스. 안내문: "행 범위를 비워 두면 사전 선별 문제만 가져옵니다". 둘 다 비활성이면 다음 버튼 disabled
  3. **폴더 선택**: `listFolders` + `lib/folder-tree.ts`로 트리 탐색 UI. 기존에 폴더 선택 모달(문항 이동 등)이 있으면 **재사용**. 하단 `[폴더 새로 만들기]` — 현재 탐색 중인 폴더를 `parent_id`로 `createFolder`
  4. **미리보기**: fetch → `rowToDraft` 결과를 목록으로. 각 행: 제목(A), 탭·블록 구성 요약, `EditorPreview`로 문제·풀이 렌더 확인, warnings 표시, **중복 배지**(4.5) + 행별 체크박스(기본 전체 선택, 중복은 기본 해제)
  5. **실행**: 선택된 draft를 순차 저장, 진행 표시(n/총), 완료 후 결과 요약(성공/실패/건너뜀 행 목록과 이유)
- 저장 로직 (draft 1건당):
  1. `createProblem({...defaults, title, answer, source: 'audition-sheet', folder_id, tabs, authorUid, import_source})`
  2. 탭별로 `saveTabBlock(problemId, tabId, {type, raw_text, order})`
  3. 개별 실패는 해당 문항만 실패 처리하고 계속 진행 (전체 롤백 없음 — 결과 요약에 명시)
- **필수 필드 기본값** (Problem에 필수인 메타): `year: 0`, `exam_type: ''`, `category: ''`, `difficulty: 0`, `tags: []`. 기존 수동 문항 생성 코드의 기본값 관례가 있으면 그것을 따를 것.

### 4.5 중복 검사 · import 메타

- 새 필드 `Problem.import_source?: { sheet: 'Data_DS'|'Stack'; row: number; source_id: string; imported_at: number }` — `types/problem.ts`에 추가 (additive, 마이그레이션 불필요. `firestore.rules`가 필드 제한을 하지 않는지 확인).
- **중복 판정 키는 `source_id`(A열)** — 세트가 Data_DS→Stack으로 이동하면 행 번호가 바뀌기 때문. 구현: 미리보기 시점에 `listProblems(userId)`로 사용자 문항을 받아 `import_source.source_id` 집합을 만들어 대조 (문항 수 규모상 클라이언트 대조로 충분, 별도 인덱스 불필요).
- 중복 행은 미리보기에 "이미 가져옴(문항 제목/폴더)" 배지 + 기본 체크 해제. 사용자가 다시 체크하면 **새 문항으로 하나 더** 만들지 말고, 확인 다이얼로그 후 기존 문항을 덮어쓸지(블록 전체 교체) 선택 — 덮어쓰기 구현이 복잡하면 v1에서는 "중복은 가져오기 불가(강제 skip)"로 좁혀도 좋다. **어느 쪽으로 했는지 Phase 문서에 기록.**

---

## 5. 작업 순서 (파일럿 우선)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | 의존성·env 배선 + 서버 라우트 | 로컬에서 실제 시트 행 JSON 응답 확인 (덕수의 서비스 계정 준비 완료 후) |
| 2 | `lib/sheetImport.ts` + 실데이터 5~10행 스냅샷 테스트 | `rowToDraft` 출력이 기대 블록 구성과 일치 |
| 3 | 미리보기까지의 위저드 (저장 없이) | **덕수 검수 관문**: 실데이터 미리보기에서 수식·마커 렌더 확인, 변환 규칙 피드백 반영 |
| 4 | 폴더 선택 + 저장 + 중복 검사 | 파일럿 폴더에 실제 문항 생성, 재실행 시 중복 감지 확인 |
| 5 | 결과 요약·실패 처리·마무리 | 빈 행/깨진 행 섞인 범위로 부분 실패 시나리오 통과 |

스텝 3이 의도적 중간 관문 — 변환 규칙은 여기서 실물로 확정한다(기획서 A-4).

---

## 6. 하지 말 것 / 주의

- 시트에 **쓰기 금지** (append/update/clear 계열 API 호출 자체를 넣지 않는다).
- 시트 쪽 GAS 프로젝트(gas-project-audition)는 **수정하지 않는다**.
- 서비스 계정 키를 클라이언트 번들·리포지토리에 노출 금지 (`NEXT_PUBLIC_` 접두 금지, `.env.local`은 gitignore 확인).
- 블록 자동 분할·마커 변환 등 "친절한 가공" 금지 — 기획서가 정한 최소 변환만.
- CLAUDE.md 작업 규칙 준수: 수정 전 파일 읽기, git push는 덕수가 직접(커밋까지만), 완료 시 `docs/roadmap.md` 갱신.
- `Problem.import_source`는 additive로만 — 기존 문항 마이그레이션 없음.

---

## 7. 구현자가 정하고 기록할 것 (재량 + 문서화 의무)

1. 위저드 진입 위치와 컴포넌트 배치 (기존 모달/폴더 UI 관례 조사 후)
2. 중복 행 재가져오기: 덮어쓰기 vs v1에서는 skip 고정 (4.5)
3. 필수 메타 기본값이 기존 수동 생성 관례와 다를 경우 그 관례 채택
4. 헤더 라벨 실제 문자열 확정 → 매핑 상수에 반영
5. 완료 후 Phase 문서(61a v1 → 교차검토 → 최종) 작성, 위 1~4의 결정 내용 포함

---

*v1 — 기획서 v2(추가사항 1·2 반영판) 기준. B축(정밀 검증)은 Phase 61b 구현 계획서에서 다룬다.*
