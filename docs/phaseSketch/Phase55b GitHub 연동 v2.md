# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v2**

작성일: 2026-08-15 · 작성: CLI Claude (Opus 5) · 기준 커밋: `f311121` (HEAD 일치 확인 ✅)
선행: `Phase55b GitHub 연동 v1.md` (web Claude / Fable)

> **본 문서의 위상** — v1을 실코드 기준으로 전수 검증한 **v2**. web Claude가 재검토할 대상.
> §0에 v1 대비 **정정 사항**을, §0.5에 **실측 좌표표**를 둔다. 이하 file:line은 모두 `f311121` 기준이며, 인용한 모든 라인은 이번에 직접 읽어 확인했다.
>
> **Phase 번호: 55b** (v1 결정 유지). Phase 55(자체 VCS)의 마무리 트랙.

---

## 0. v1 정정 사항 (⚠️ 필독 — 설계가 바뀌는 항목 포함)

| # | v1 서술 | 실측 | 영향 |
|---|---|---|---|
| **E1** | §4.1-2 / §4.2: 서버가 `trigger !== 'named'` 이면 403 거부 | `named_existing` 경로(`snapshot.ts:62-69`)는 **기존 버전 doc에 `name`만 update**한다. `trigger`는 `manual_save`/`editor_exit` 그대로 남는다 | 🔴 **치명적.** "무변경 상태에서 이름 저장"한 버전은 `name`이 있는데 `trigger !== 'named'` → export가 항상 403. **게이트를 `name != null`로 교체해야 한다** (§4.2) |
| **E2** | §0 표 / A-5: "named는 prune 면제 → export 대상 손실 없음" | `selectPruneVictims`(`prune.ts:20-26`)의 조건은 `trigger === 'editor_exit' && !pinned`뿐. **`name`은 보지 않는다** | 🔴 E1과 같은 뿌리. `editor_exit` 버전에 이름만 붙이면 상한 초과 시 **삭제된다**. `prune.ts`에 `&& !v.name` 추가 필요 (§3.4) |
| **E3** | §4.2: "서버에서 Firestore 읽기/쓰기 방법이 이 프로젝트 최초의 시도" | **전례 있음.** `app/shared/[shareId]/page.tsx:9-35`가 Firestore **REST API**로 서버에서 문서를 읽는다(Phase 53, firebase-admin 미설치 상태로) | 🟠 R3 선택지가 바뀐다. `firebase-admin` 없이도 서버 Firestore 읽기가 가능 → **(다) 하이브리드**를 신설·권장 (§4.2) |
| **E4** | §3.2: "`named_existing`이 기존 버전의 name을 써주는지 단순 반환만 하는지 CLI 확인 필요" | **써준다.** `snapshot.ts:63-67`이 `tx.update`로 `name`·`pinned`를 기록 | 🟢 확인 완료 — 보강 불필요. 단 `pinned: false`는 절대 기록되지 않아 **핀 해제는 불가** → 별도 `updateDoc` 필요 (§3.2c) |
| **E5** | §0 표: dedup 우회 조건 `snapshot.ts:38-40` | 실제 **37-39** | 🟢 무해 |
| **E6** | §0 표: VersionDrawer props `:16-38` | 실제 **16-28** (props 타입은 21-28) | 🟢 무해 |
| **E7** | §0 표: prune 보호 트리거 `prune.ts:7` | `:7`은 **주석**. 실제 로직은 `:22` | 🟢 무해하나 E2를 가린 원인 |
| **E8** | §4.4: 경로 `{seq:04d}-{name-slug}.md` | 이름은 사후 변경 가능(`name` update 허용) | 🟠 이름 변경 후 재export하면 **구 파일이 유령으로 잔존**. slug를 경로에서 제거 (§4.4) |
| **E9** | (누락) | `roadmap.md:1297`의 후속 과제가 "GitHub 연동(**Phase 56+** 별도)"로 적혀 있음 | 🟢 56·57이 이미 소진됨 → roadmap 문구도 55b로 정정 (§6 문서) |

**정확했던 항목**: `VersionTrigger`에 `'named'` 존재·발화 0곳 / `createSnapshot` 호출부 정확히 2곳 / 타임라인 `name`·`pinned` 표시 이미 구현 / rules `hasOnly(['name','pinned'])` 위치 / `firebase-admin`·`octokit` 부재 / `VERSION_CAP = 50` / API 라우트 5종 전부 무인증. → v1의 **G0 격차 진단 자체는 옳다.**

---

## 0.5. 실측 좌표표 (구현 시 이 표를 기준으로)

| 대상 | 위치 | 메모 |
|---|---|---|
| `VersionTrigger` (`'named'` 포함) | `types/version.ts:15` | 발화 0곳 |
| `ProblemVersion` (name·pinned 사후수정 주석) | `types/version.ts:49-67` | |
| `SnapshotResult` 4갈래 | `types/version.ts:74-78` | `created`/`unchanged`/`named_existing`/`error` |
| 라이브 포인터 4필드 | `types/problem.ts:35-38` | `version_seq`·`last_version_id`·`last_version_hash`·`last_version_tab_hashes` |
| `createSnapshot(…, opts?)` | `lib/version/snapshot.ts:25-31` | |
| 조기반환 dedup 우회 | `snapshot.ts:37-39` | `!opts?.name && !opts?.pinned` |
| 트랜잭션 dedup / `named_existing` | `snapshot.ts:62-71` (update 63-67) | **E1·E4의 근거** |
| 메타 작성(`trigger`,`name`,`pinned`) | `snapshot.ts:74-83` | `name: opts?.name ?? null` |
| prune 호출 | `snapshot.ts:103-105` | `seq > VERSION_CAP`일 때만 |
| `VERSION_CAP = 50` | `lib/version/prune.ts:10` | |
| **prune victim 조건** | `prune.ts:22` | `trigger==='editor_exit' && !pinned` — **E2** |
| `canonicalize` (순수·결정적) | `lib/version/canonicalize.ts:34-44` | 브라우저 의존 0 → 서버 재사용 가능 |
| `sha256` (Web Crypto) | `lib/version/hash.ts:5-8` | `crypto.subtle` — 서버 shim 검토(§4.2) |
| `loadContent` | `lib/version/read.ts:38-45` | |
| `collectCurrentContent` | `lib/version/adapter.ts:20-41` | `VersionLoadError` 던질 수 있음 |
| `snapshotCurrent(trigger)` | `EditorView.tsx:2348-2364` | opts 전달 경로 없음 → 확장 대상 |
| `createSnapshot` 호출부 ①② | `EditorView.tsx:2358`, `:2662` | |
| `handleRestore` | `EditorView.tsx:2657-2668` | |
| `<VersionDrawer …>` 마운트 | `EditorView.tsx:2707-2720` | props 배선 지점 |
| 드로어 열기 버튼 | `EditorView.tsx:2764-2773` | |
| VersionDrawer props | `components/version/VersionDrawer.tsx:16-28` | `actor`·`onNamedSave` 없음 → 확장 대상 |
| 드로어 헤더 (버튼 삽입 지점) | `VersionDrawer.tsx:102-112` | 높이 57, `버전 기록` + × |
| `useVersionHistory` | `hooks/useVersionHistory.ts:7-42` | **갱신 API 없음**(`loadFirst`/`loadMore`뿐) → `patchVersion` 필요 |
| 타임라인 name·pinned 렌더 | `VersionTimeline.tsx:8-19, 96-101` | 아이콘·라벨 이미 준비됨 |
| versions 규칙 블록 | `firestore.rules:144-166` | |
| **update 규칙** | `firestore.rules:157-158` | `hasOnly(['name','pinned'])` — §4.5 확장 대상 |
| payload update 금지 | `firestore.rules:164` | 불변 |
| 서버 API 전례(무인증·nodejs) | `app/api/copyright/register/route.ts:6-7, 13` | |
| **서버 Firestore REST 전례** | `app/shared/[shareId]/page.tsx:9-35` | **E3의 근거.** `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 사용 |
| 규칙 테스트 하니스 | `tests/firestore.rules.test.mjs` (466행, 케이스 60번까지) | versions는 46~60 |
| 의존성 | `package.json` | `firebase-admin`·`octokit`·`jose` 전부 부재 |

**환경**: Node v25.6.0(로컬), Next 14.2.5, `.env.local`은 `.gitignore` 등록됨 ✅

---

## 1. 진척상황 (v1 §1 유지 + 정정)

### 완료 ✅
- **Phase 55 자체 VCS** — Stage 0~6 전부 (`lib/version/` 8모듈, `components/version/` 4컴포넌트 실재 확인)
- **Phase 55a 블록 Undo/Redo** — Stage 1~4 전부

### 미완료

| # | 항목 | 55b 포함 |
|---|---|---|
| **G0** | **named 저장·핀 생성 UI 부재** — 모델·표시·보호·dedup 로직은 전부 있으나 **발화 경로 0곳** | ✅ **P0** |
| **G0'** | **[v2 신규] prune이 `name`을 보호하지 않음** (E2) | ✅ **P0 — G0와 같은 커밋** |
| **G1** | GitHub 연동 (단방향 export, `named` 한정) | ✅ 본 Phase 핵심 |
| G2 | 탭 단위 복원 | ❌ 후속 |
| G3 | 탭 reorder diff / canonicalize 정렬 정책 | ❌ 후속 (기능 자체가 없음) |
| G4 | 오프라인 persistence | ❌ 보류 |
| G5 | `contributors[]` 확장 누적 | ❌ 후속 (단일 사용자) |
| G6 | 나머지 메타(난이도·태그·출처) 버전관리 편입 | ❌ 후속 |
| G7 | `step_label` 보존 (F9) | ❌ 후속 |
| G8 | 전역 요약 pruning | ❌ 후속 |
| G9 | 원본인증(블록체인) 해시 매핑 (F8) | ❌ 후속. 단 export frontmatter에 `content_hash` 남겨 연계 여지 확보 |

---

## 2. 목표·비목표 (v1 유지)

**목표**: 이름이 붙은(`name != null`) 버전을 **별도 GitHub 콘텐츠 레포**에 사람이 읽을 수 있는 마크다운 + 무손실 JSON으로 커밋하는 **단방향 내보내기**. 앱 외부의 영구 백업·이력 아카이브.

**비목표 (명시적 선언)**
- GitHub → 앱 방향 동기화 없음 (레포는 read-only 미러)
- `manual_save`·`editor_exit` 자동 스냅샷의 export 없음
- 실시간·자동 동기화 없음 (명시적 버튼 조작만 — R2)
- 코드 레포(`kimdeoksoo-71/mathory`)와 콘텐츠 레포는 **별개**
- 문항 삭제 시 GitHub 레포 정리 없음 (아카이브의 성격상 의도적 — §4.7)

---

## 3. P0 — 이름 저장(named)·핀 UI + prune 보호

### 3.1 현황

`'named'` 트리거·타임라인 🏷️/라벨·`name` 배지·📌 렌더(`VersionTimeline.tsx:8-19, 96-101`)·rules의 `name`·`pinned` update 허용(`firestore.rules:157-158`)·규칙 테스트 51·52번까지 **전부 준비되어 있으나, `trigger:'named'` 또는 `opts.name`으로 부르는 곳이 레포 전체에 0곳**이다.

### 3.2 설계

**(a) "이름 저장" 버튼** — `VersionDrawer` 헤더(`:102-112`) `버전 기록` 라벨 오른쪽, × 버튼 왼쪽에 배치. 클릭 → 인라인 `<input>` → Enter/확인 시 상위 콜백 호출.

- **배선**: `VersionDrawer`는 `problemId`만 알고 `user`(actor)를 모른다(`:16-28`). → props에 `onNamedSave: (name: string) => Promise<SnapshotResult>` 추가하고, `EditorView.tsx:2707-2720`에서 `snapshotCurrent`를 재사용해 넘긴다.
- **`snapshotCurrent` 확장**: `(trigger, opts?)` 시그니처로 바꾸고 `createSnapshot(problem.id, content, trigger, actor, opts)` (`EditorView.tsx:2358`). 반환값을 `SnapshotResult`로 흘려보내 UI가 4갈래를 분기할 수 있게 한다(기존 두 호출부는 반환을 무시하므로 무해).
- **사전 저장 불필요**: 스냅샷 입력은 `collectCurrentContent`(현재 작업본, `adapter.ts:20-41`)이므로 Firestore 라이브 저장과 독립. dirty 상태에서 이름 저장해도 정상.
- **Korean IME**: 단축키가 아니라 입력창이므로 `event.code` 규칙 무관. 단 Enter 커밋 시 `e.nativeEvent.isComposing` 가드 필요(한글 조합 중 Enter가 두 번 발화).
- **`getCurrentContent()`가 null인 경우**(탭 로드 실패 → `VersionLoadError`, `adapter.ts:29-31`): 버튼 비활성 + 안내.

**(b) 결과 4갈래 UX** — `SnapshotResult`(`types/version.ts:74-78`)를 전부 다뤄야 한다.

| status | 발생 조건 | UI |
|---|---|---|
| `created` | 내용 변경 있음 → 새 버전(`trigger:'named'`) | "v{seq} 이름 저장됨" + 타임라인에 신규 항목 |
| `named_existing` | 내용 동일 + `last_version_id` 있음 → **기존 버전에 name만 부착** (`snapshot.ts:63-68`) | "기존 v{seq}에 이름을 붙였습니다" + 해당 항목 배지 갱신 |
| `unchanged` | 내용 동일 + `last_version_id` **없음**(레거시 문항) | ⚠️ **조용한 실패**. "저장된 버전이 없어 이름을 붙일 수 없습니다 — 먼저 저장하세요" 안내 필수 |
| `error` | authorUid 부재 등 | 에러 메시지 노출 |

**(c) 핀 토글 / 이름 변경·해제** — `createSnapshot` 경로로는 불가하다:
- `snapshot.ts:66`은 `opts.pinned ? { pinned: true } : {}` → **`pinned:false`를 절대 쓰지 않음** = 핀 해제 불가
- `name` 삭제도 동일

→ `lib/version/meta.ts` (신규, 얇음)에 두 헬퍼를 둔다. rules(`:157-158`)가 이미 허용하므로 규칙 변경 없음.
```ts
export const setVersionName = (pid, vid, name: string | null) =>
  updateDoc(doc(db,'problems',pid,'versions',vid), { name });
export const setVersionPinned = (pid, vid, pinned: boolean) =>
  updateDoc(doc(db,'problems',pid,'versions',vid), { pinned });
```
타임라인 항목에 📌 토글 + `name` 배지 클릭 → 인라인 수정.

**(d) 목록 갱신** — `useVersionHistory`(`hooks/useVersionHistory.ts:7-42`)에는 갱신 수단이 `loadFirst`(커서 리셋·전체 재조회)뿐이다. name/pinned/`github_export` 변경마다 재조회하면 `loadMore`로 펼친 페이지가 접힌다.
→ `patchVersion(id, partial: Partial<ProblemVersion>)`을 추가해 로컬 배열만 갱신. `created`일 때만 `loadFirst`.

### 3.3 prune 보호 수정 (G0' — E2)

`prune.ts:22`:
```diff
-    if (v.trigger === 'editor_exit' && !v.pinned) {
+    if (v.trigger === 'editor_exit' && !v.pinned && !v.name) {
```
`selectPruneVictims`의 입력 타입에도 `name?: string | null` 추가, `pruneProblemVersions`(`:42`)의 매핑에 `name: d.data().name` 추가.

> 이 한 줄이 없으면 "이름 붙인 버전이 GitHub에 export된 뒤 조용히 삭제"되는 시나리오가 성립한다. **G1보다 먼저 들어가야 한다.**

### 3.4 검증

1. 변경 있는 상태 이름 저장 → 타임라인 🏷️ + name 배지, `trigger==='named'`
2. **무변경 상태** 이름 저장 → `named_existing`, 기존 항목(💾)에 name 배지만 추가, `trigger`는 그대로
3. 레거시(포인터 없는) 문항 → `unchanged` 안내 노출, 무반응 아님
4. 핀 토글 켜기/**끄기** 왕복
5. 이름 변경 → 해제(`null`) 왕복
6. **prune 시나리오**: `editor_exit` 버전에 이름만 부착 → 51개 초과 유발 → **살아남는지** 확인 (수정 전이면 삭제됨)
7. 콘솔 `permission-denied` 0
8. 한글 이름 입력 중 Enter 1회 = 커밋 1회

---

## 4. G1 — GitHub 내보내기 설계

### 4.1 전체 흐름

```
[클라] 타임라인 항목(name != null)의 "GitHub 내보내기" 버튼
   → 게이트: v.name != null  (⚠️ trigger가 아니다 — E1)
   → POST /api/github/export
        { problemId, versionId, idToken, content }        ← (다)안
[서버] app/api/github/export/route.ts (runtime nodejs)
   1. idToken으로 Firestore REST GET  versions/{versionId}   ← 인증 = 규칙이 대신 수행
      → name·seq·content_hash·author_uid 확보. 401/403이면 그대로 반환
   2. name == null 이면 403 (서버가 읽은 값 기준 — 위조 불가)
   3. canonicalize(content) → sha256 → 서버가 읽은 content_hash와 대조. 불일치 시 409
   4. VersionContent → md/json 변환 (lib/version/exportMd.ts, 순수)
   5. GitHub Contents API: 기존 GET → 동일하면 skip, 아니면 PUT (파일 3개)
   → 200 { commitUrl, commitSha, path, skipped }
[클라] version doc에 github_export 기록(updateDoc) → 타임라인 배지·링크 갱신
```

### 4.2 서버 API — `app/api/github/export/route.ts`

**패턴**: `copyright/register/route.ts:6-7` 전례대로 `runtime='nodejs'`, `dynamic='force-dynamic'`, 서버 env, try/catch 정규화 응답.

**R3 재검토 (E3 반영)** — v1은 서버 Firestore 접근을 "이 프로젝트 최초"로 보았으나 **`app/shared/[shareId]/page.tsx:9-35`에 REST 전례가 있다.** 선택지를 다시 세운다.

| 안 | 인증 | 무결성 | 신규 의존성 | 평가 |
|---|---|---|---|---|
| (가) 클라가 content 전송, 서버는 GitHub만 | ❌ 없음 | ❌ 클라 위조 가능 | 0 | **부적합** — §4.2a 참조 |
| (나) `firebase-admin`으로 서버가 직접 읽기 | ✅ | ✅ | firebase-admin + 서비스계정 키 env | 과함 |
| **(다) 클라가 idToken 릴레이 + 서버가 Firestore REST로 메타 읽기 + 해시 대조** | ✅ **규칙이 강제** | ✅ **해시 대조** | **0** | ✅ **v2 권장** |

**(가)를 기각하는 이유** — `copyright/register`의 무인증(Phase 29 C2)과 위험도가 다르다. 그쪽은 *64자 해시 하나*를 자기 지갑으로 보내는 것이라 최악이 가스 낭비지만, export는 **임의의 문자열을 덕수의 GitHub 레포에 커밋**한다. 배포된 URL은 공개이므로 누구든 POST로 레포를 오염시킬 수 있고(스팸·저작권 침해물 업로드), 이는 GitHub 계정 리스크로 번진다. 오픈소스 공개 전이라도 **지금 막아야 한다.**

**(다)의 동작**
- 클라: `await user.getIdToken()` → body에 실어 보냄 (`firebase/auth`에 이미 있음, 의존성 0)
- 서버: `GET https://firestore.googleapis.com/v1/projects/{pid}/databases/(default)/documents/problems/{problemId}/versions/{versionId}` + `Authorization: Bearer {idToken}`
  - 토큰 위조·만료·타인 문항 → Firestore가 401/403 (규칙 `verOwner()`, `firestore.rules:153`) → **별도 검증 코드 0줄**
- ⚠️ **REST 응답 디코딩 주의**: Firestore REST는 값 타입 래핑 형식이다. 필요한 건 스칼라 3개뿐이라 `fields.name?.stringValue` / `fields.seq?.integerValue` / `fields.content_hash?.stringValue`로 충분. **`integerValue`는 숫자가 아니라 문자열**이므로 `Number(...)` 필수. (payload 전체를 REST로 읽으려면 중첩 `mapValue`/`arrayValue` 범용 디코더가 필요해지므로 — content는 클라에서 받고 해시로 검증하는 편이 코드가 훨씬 짧다.)
- ⚠️ **`crypto.subtle` 서버 가용성**: `hash.ts:5-8`은 전역 `crypto`를 쓴다. Node 18에서는 전역 노출이 불안정하므로 라우트 상단에 방어 shim을 둔다.
  ```ts
  import { webcrypto } from 'node:crypto';
  if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;
  ```
  `canonicalize.ts`는 순수 TS라 그대로 import 가능.

**요청 검증**
- 필수 필드: `problemId`·`versionId`·`idToken`·`content`
- body 크기: Vercel 서버리스 요청 본문 상한(~4.5MB) → `JSON.stringify(content).length`가 4MB 초과면 413 + 한국어 안내 (이미지가 URL 참조라 통상 수십 KB지만 가드는 둔다)
- `name == null` → 403 (**`trigger` 아님 — E1**)
- 해시 불일치 → 409 "버전 본문이 일치하지 않습니다 (앱을 새로고침 후 재시도)"

### 4.3 환경변수 (전부 서버 전용 — `NEXT_PUBLIC_` 금지)

| 이름 | 값 | 비고 |
|---|---|---|
| `GITHUB_EXPORT_TOKEN` | fine-grained PAT | **콘텐츠 레포 1개 한정, Contents: Read and write만.** 만료일 설정(최대 1년) |
| `GITHUB_CONTENT_REPO` | `kimdeoksoo-71/mathory-content` | R5에서 확정 |
| `GITHUB_CONTENT_BRANCH` | `main` | 미설정 시 기본 `main` |

기존 재사용: `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (`app/shared/[shareId]/page.tsx:15` 전례).

- 로컬 `.env.local`(`.gitignore` 등록 확인 ✅) + **Vercel 프로젝트 env 양쪽 등록**
- **PAT 만료 대비**: 401 응답 시 "GitHub 토큰이 만료되었거나 권한이 없습니다 — Vercel 환경변수 `GITHUB_EXPORT_TOKEN` 갱신 필요"로 원인을 특정해 노출
- 🔒 **PAT 값은 채팅에 붙여넣지 말 것.** Vercel 대시보드·로컬 파일에서만 다룬다

### 4.4 레포 파일 레이아웃·변환

```
problems/
  {problemId}/
    index.md                # 최신(최대 seq) named 버전 본문 — 사람용 진입점
    versions/
      {seq:04d}.md          # 버전별 마크다운 (사실상 불변)
      {seq:04d}.json        # VersionContent 원본 (무손실 재현)
```

**E8 반영 — 경로에서 slug 제거.** `name`은 사후 변경 가능(§3.2c)이므로 파일명에 넣으면 이름 변경 후 재export 시 구 파일이 유령으로 남는다. `seq`는 불변이므로 `{seq:04d}`만 쓰고, 이름은 frontmatter와 `index.md`에 표기한다. 4자리 패딩으로 사전순 = 시간순 보장(상한 50이라 충분).

**`lib/version/exportMd.ts` (순수 함수, 단위 테스트 가능)**
```ts
export function toMarkdown(c: VersionContent, meta: {
  problemId: string; seq: number; name: string; contentHash: string; exportedAt: string;
}): string
```
- `exportedAt`은 **인자 주입** — 함수 내부에서 시각을 만들면 결정성이 깨지고 동일내용 skip 판정이 무력해진다
- **frontmatter**: `problem_id`·`version_seq`·`version_name`·`content_hash`·`exported_at`·`title`·`answer`
  - ⚠️ **YAML 이스케이프**: 제목·이름·정답에 `:`·`#`·`"`·개행이 들어갈 수 있다. 모든 값을 `JSON.stringify(v)`로 감싸 인용한다(JSON 문자열은 유효한 YAML 스칼라)
  - ⚠️ **`---` 충돌**: `raw_text` 첫 줄이 `---`이면 frontmatter 종료로 오인될 수 있다 → frontmatter 종료 구분자 다음에 반드시 빈 줄 1개를 넣고 본문 시작
- **본문**: 탭별 `## {tab.title}` → 블록 `order` 순 `raw_text` 연결(블록 사이 빈 줄 1개). 블록 `title`이 있으면 `### {title}` 선행
- **블록 타입 11종**(`text·heading·list·callout·gana·roman·box·choices·image·svg·ggb`): 전부 `raw_text` 그대로. 타입은 HTML 주석 마커 `<!-- block: {type} -->`로 남겨 사람이 구분할 수 있게 한다(GitHub 렌더에는 안 보임)
- **렌더 재현은 목표가 아니다**(아카이브 목적). GitHub의 KaTeX가 `$$`를 일부만 처리하는 건 한계로 수용
- **이미지**: Firebase Storage URL 그대로 참조(R4). 레포 단독으로는 이미지가 깨질 수 있음을 index.md 상단 주석에 명기
- **JSON**: `JSON.stringify(content, null, 2) + '\n'` — 결정적 출력을 위해 들여쓰기·말미 개행 고정

### 4.5 멱등성·기록

- GitHub Contents API `PUT /repos/{repo}/contents/{path}`는 기존 파일 갱신 시 blob `sha`가 필요 → 선행 `GET`
  - GET 404 → 신규 생성 (`sha` 없이 PUT)
  - GET 200 → 응답 `content`(base64)를 새 내용과 비교, **동일하면 skip**(커밋 0개)
  - ⚠️ **1MB 초과 파일은 GET 응답의 `content`가 비고 `sha`만 온다.** 이 경우 git blob sha를 직접 계산해 비교: `sha1("blob " + byteLen + "\0" + content)` (Node `crypto.createHash('sha1')`)
- base64 인코딩은 **`Buffer.from(s, 'utf8').toString('base64')`** — 한글 필수
- **`index.md` 역행 방지**: 더 오래된 named 버전을 나중에 export할 수 있다. 기존 `index.md`의 frontmatter `version_seq`를 파싱해, **새 seq가 더 클 때만** 갱신한다
- **기록**: 성공 시 클라가 version doc에 `github_export: { repo, path, commit_sha, exported_at }` 기록
  - 서버 PUT 성공 후 클라 기록 전 크래시 → GitHub엔 파일이 있고 doc엔 기록 없음. 재export가 멱등(skip)이므로 자연 수렴. 허용
- **규칙 확장 필요**: `firestore.rules:158`
  ```diff
  -  .affectedKeys().hasOnly(['name', 'pinned']);
  +  .affectedKeys().hasOnly(['name', 'pinned', 'github_export']);
  ```
  `affectedKeys()`는 최상위 키만 보므로 중첩 map은 그대로 통과.
  ⚠️ **F3 교훈: 규칙 배포가 코드보다 선행** → Stage 2로 독립 커밋·선배포
- **타임라인 표시**: `github_export` 있으면 GitHub 아이콘 + 커밋 링크. 재내보내기는 항상 허용(내용 동일 시 skip 응답)

### 4.6 실패 처리

| 상황 | 코드 | 한국어 메시지 |
|---|---|---|
| idToken 만료/위조 | 401 | "로그인이 만료되었습니다 — 새로고침 후 재시도" |
| 타인 문항 / 규칙 거부 | 403 | "이 문항의 버전에 접근할 수 없습니다" |
| `name == null` | 403 | "이름이 붙은 버전만 내보낼 수 있습니다" |
| 해시 불일치 | 409 | "버전 본문이 일치하지 않습니다 — 새로고침 후 재시도" |
| GitHub 토큰 문제 | 401/403 | "GitHub 토큰 만료·권한 부족 — `GITHUB_EXPORT_TOKEN` 갱신 필요" |
| 레포/브랜치 부재 | 404 | "콘텐츠 레포 또는 브랜치를 찾을 수 없습니다: {repo}@{branch}" |
| blob sha 충돌 | 409 | sha 재조회 후 **1회 자동 재시도**, 재실패 시 surface |
| 본문 과대 | 413 | "버전 본문이 너무 큽니다" |

- **응답에 토큰 문자열이 절대 포함되지 않도록** 에러 메시지를 화이트리스트 방식으로 구성(`copyright/register:60-79`처럼 원본 에러를 통째로 흘리지 말 것 — GitHub 에러는 URL에 토큰을 담지 않지만 방어)
- **부분 실패**(md 성공·json 실패): 파일별 독립 PUT이라 발생 가능. 재실행이 멱등이므로 "다시 내보내기"로 수렴. Git Trees API 단일 커밋은 v1 범위 밖 — 파일당 1커밋 수용

### 4.7 명시적 비대응

- 문항/버전 **삭제 시 레포 파일 삭제 없음**. prune으로 사라진 버전의 md도 남는다 — 아카이브의 취지에 부합
- GitHub 쪽 수동 편집은 다음 export 시 덮어써진다(레포는 미러)

---

## 5. 범위 제외 항목 재배치

§1의 G2~G9는 본 Phase에서 손대지 않는다. 단 **G9 연계 여지**를 위해 export frontmatter에 `content_hash`를 반드시 포함(§4.4) — 이후 원본인증 매핑만 얹으면 되는 상태로 남긴다.

---

## 6. 구현 순서 (Stages)

**Stage 0 · 준비 (덕수 수동 + CLI 확인)**
- §0.5 좌표표 재확인(HEAD가 `f311121`에서 이동했다면 라인 재검증)
- 덕수: 콘텐츠 레포 생성(R5), fine-grained PAT 발급, `.env.local` + **Vercel env 등록**
  - ⚠️ Vercel env는 배포 파이프라인에 자동 포함되지 않는다 — 대시보드에서 직접 등록해야 Stage 4가 동작

**Stage 1 · P0 — named·핀 UI + prune 보호 (§3)** — 규칙 변경 없음, 독립 배포 가능
- `snapshotCurrent` opts 확장, `VersionDrawer` props 확장, `lib/version/meta.ts` 신설, `useVersionHistory.patchVersion`, **`prune.ts:22` `!v.name` 추가**
- 검증: §3.4 8항목 전부

**Stage 2 · 규칙 확장 (§4.5)** — `github_export` 키 허용. **단독 커밋 · 선배포 (F3 교훈)**
- `tests/firestore.rules.test.mjs`에 케이스 **61~63** 추가 (현재 60번까지):
  - 61. `github_export`만 update 허용
  - 62. `name` + `github_export` 동시 update 허용
  - 63. `github_export` + `content_hash` 동시 update 거부(불변성 유지)
- `npm run test:rules` 기존 60건 회귀 0

**Stage 3 · 변환기 `lib/version/exportMd.ts`** — 순수 함수, 네트워크 0
- 검증: 11종 블록 전부 포함한 실제 VersionContent → 다중 탭·수식·`---`로 시작하는 raw_text·제목에 `:` 포함 케이스. **동일 입력 → 동일 출력**(`exportedAt` 주입 확인)

**Stage 4 · 서버 API (§4.2·4.3·4.6)**
- 검증(curl): 성공 / idToken 누락(401) / 타인 문항(403) / `name` 없는 버전(403) / 해시 변조(409) / 존재하지 않는 레포(404) / 동일 내용 재요청(skip) / 토큰 미노출 확인

**Stage 5 · UI 배선 + E2E**
- 타임라인 named 항목에 내보내기 버튼 + 내보냄 배지·커밋 링크
- E2E: 이름 저장 → 내보내기 → GitHub 커밋·파일 3개(md/json/index.md) 확인 → **동일 버전 재내보내기(커밋 0)** → 내용 수정 후 새 named 내보내기(새 커밋, index.md 갱신) → **이름 변경 후 재내보내기(유령 파일 없음 — E8 검증)** → **더 낮은 seq 버전 내보내기(index.md 역행 안 함 — §4.5 검증)** → version doc `github_export` 기록·링크 동작

**문서**: `roadmap.md`에 Phase 55b 기재 + Phase 55 후속과제 목록 갱신(**"GitHub 연동(Phase 56+ 별도)" → "Phase 55b" 정정 — E9**). 확정본 `docs/phasedocs/` 배치.

**롤백**: Stage 1·2는 additive(기존 경로 무영향). Stage 4·5 문제 시 UI 버튼만 제거하면 API는 호출되지 않는다. 규칙은 되돌릴 필요 없음(`hasOnly` 확장은 상위호환).

---

## 7. 열린 결정 (덕수 확정 필요)

| # | 질문 | v2 제안 |
|---|---|---|
| R1 | export 포맷 | **md + json 병행** (v1 유지) |
| R2 | export 트리거 | **수동 버튼만** (v1 유지) |
| **R3** | 서버 Firestore 접근 | ⚠️ **변경: (가) → (다) 하이브리드.** 클라 idToken 릴레이 + 서버가 REST로 메타 읽기(인증) + 해시 대조(무결성). 의존성 0. 근거 §4.2·E3 |
| R4 | 이미지 | **v1은 Storage URL 참조만.** 레포 동봉은 후속 |
| **R5** | 콘텐츠 레포 | 이름 `mathory-content` · **공개/비공개 → 비공개(private) 권장.** 근거: export frontmatter에 **`answer`(정답)**가 들어가고 본문 전체가 평문이다. 시험문항 저작권·정답 노출 양쪽에서 public은 되돌릴 수 없다. 공개는 언제든 전환 가능하지만 그 반대는 사실상 불가 |
| **R6** | **[v2 신규] 이름 저장 시 자동 핀** | `pinned`를 함께 켜면 prune 보호가 이중이 되지만, §3.3 수정으로 `name` 단독 보호가 성립하므로 **자동 핀 불필요**에 무게. 덕수 선호 확인 |

---

## 부록 A. 점검 실측 요약 (`f311121`)

- **A-1.** `lib/version/` 8모듈 · `components/version/` 4컴포넌트 전부 실재 (Phase 55 Stage 0~6 산출물)
- **A-2.** `createSnapshot` 호출부 정확히 2곳(`EditorView.tsx:2358`·`:2662`). `trigger:'named'`·`opts.name`·`opts.pinned` 발화 **0곳** — G0 격차 확정
- **A-3.** `named_existing` 분기는 기존 doc에 `name`·`pinned`를 **실제로 update**한다(`snapshot.ts:63-67`). 단 `trigger`는 불변 → **E1의 근거**
- **A-4.** `selectPruneVictims`(`prune.ts:20-26`)는 `name`을 보지 않는다 → **E2의 근거**
- **A-5.** 서버 API 5종(ai-complete·copyright/register·discuss·ocr·proofread) 전부 무인증(Phase 29 C2). `firebase-admin`·`octokit`·`jose` 부재
- **A-6.** 서버 Firestore **REST** 접근 전례: `app/shared/[shareId]/page.tsx:9-35`(Phase 53, 비인증 world-readable 문서). 인증 문서 접근은 `Authorization: Bearer <idToken>` 추가로 확장 가능 → **E3의 근거**
- **A-7.** `canonicalize.ts`는 순수 TS(브라우저 API 0) → 서버 재사용 가능. `hash.ts`만 `crypto.subtle` 의존 → shim 필요
- **A-8.** `firestore.rules:144-166` versions 규칙 / `tests/firestore.rules.test.mjs` 466행 · versions 케이스 46~60번
- **A-9.** git workflow: Claude Code 커밋 → 덕수 push → Vercel 자동 배포. **Vercel env 등록은 이 흐름 밖의 수동 작업**
