# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v4 (착수본)**

작성일: 2026-08-15 · 작성: CLI Claude (Opus 5) · 기준 커밋: `f311121` (HEAD 일치 재확인 ✅)
계보: v1(web) → v2(CLI 실코드 검증, E1~E9) → v3(web 재검토, W1~W9 + R1~R6 확정) → **v4(CLI 3차 검증 — W 판정 + 신규 결함 X1~X12·Y1)**

> **본 문서의 위상** — v3의 W1~W9를 실코드로 재검증(8건 승인·1건 부분정정)하고, **v3에도 남아 있던 결함 12건**을 추가했다. 그중 🔴 2건(X1·X2)은 **v2·v3 공통 사양 공백**이며 그대로 구현하면 각각 "모든 export가 409" / "핀 버튼을 누르면 버전 선택이 같이 발동"으로 이어진다.
> §0~§0.2가 검증 기록, §1 이하가 착수용 통합 본문. 착수 시 HEAD가 `f311121`에서 이동했다면 §0.2 좌표 재실측 먼저.

---

## 0. v3 검증 결과 (W1~W9)

| # | 판정 | 근거 |
|---|---|---|
| **W1** `exported_at` skip 자기모순 | ✅ **승인 — v3 최대 성과** | v2 §4.4의 "인자 주입"은 결정성을 회복시키지 못한다. 주입값도 매 호출 달라지므로 md 바이트가 매번 바뀌고 skip이 영구 무효. `created_at`(버전 불변 시각)으로 교체하고 파일에서 export 시각 제거가 정답. v4 채택 |
| **W2** 블록 타입 11종 → 13종 | 🟠 **부분정정 → Y1** | `types/problem.ts:158` 유니온이 13개인 것은 사실. 그러나 `VersionBlock`에 **실제로 담기는 값은 11종**뿐이다(아래 Y1). 주석 문구가 v3 지시대로 가면 오히려 부정확해진다 |
| **W4** `ProblemVersion.github_export` 타입 선언 | ✅ 승인 | v2가 빠뜨린 것 맞음. `types/version.ts:50-67`에 optional 필드 추가 필요 |
| **W5** PUT 순서 (본체 → index 마지막) | ✅ 승인 | 부분 실패 시 index가 없는 파일을 가리키는 상태 방지 |
| **W6** index frontmatter 파싱 실패 시 덮어씀 | ✅ 승인 | 미러 원칙(§4.7)과 일관 |
| **W7** idToken을 `Authorization` 헤더로 | ✅ 승인 | body 로깅 경로에서 토큰 노출 면적 감소. 서버가 Firestore REST로 그대로 릴레이하는 구조와도 자연스럽다 |
| **W8** 커밋 메시지 규약 | ✅ 승인 | |
| **W9** 해시 대조의 검증 범위 한계 | ✅ 승인 | `canonicalize.ts:5` 주석 확인. `block_key`·`last_editor_uid`는 해시 밖 → 대조 불가. 단 v4는 **X1 설계 변경으로 이 위험이 사실상 소멸**한다(content가 Firestore payload 그대로이므로 클라 조작 여지 없음) |
| **W3** roadmap `:1295` | ✅ 승인 | 실측 `docs/roadmap.md:1295` |
| E1~E9 재확인 | ✅ | v3의 재검증 전부 실측과 일치 |

### Y1 · W2 부분정정 — "13종"은 export 코드엔 맞고 주석엔 틀리다

- `Block['type']` 유니온 = **13개** (`types/problem.ts:158`) ✅ v3 실측 정확
- 그러나 `normalizeBlockType`(`EditorView.tsx:123-127`)이 **로드(`:1090`)와 저장(`:2448`) 양쪽 게이트에서** `math_block`·`bullet` → `text`로 정규화한다. `collectCurrentContent`의 입력은 항상 로드 게이트를 통과한 뒤이므로 **Phase 55 이후 생성된 어떤 version payload에도 legacy 2종은 들어가지 않는다.**
- 사용자 선택 가능 타입은 9종(`BLOCK_TYPES`, `EditorView.tsx:92-94`), `svg`·`ggb`가 별도 경로로 추가돼 **실사용 11종** — CLAUDE.md 기재와 일치.
- **결론**: `types/version.ts:26` 주석은 "13종"이 아니라 다음으로 고친다.
  ```ts
  type: Block['type'];   // 실 유입 11종. 레거시 math_block·bullet은 normalizeBlockType으로 text 정규화 후 들어온다
  ```
- **동작 영향 0** — `exportMd`는 어차피 타입별 분기 없이 `raw_text`를 그대로 흘리므로 13종을 받아도 안전하다. v3의 "13종 전부 검증" 지시는 fixture를 과하게 만들 뿐 해롭지 않으니, Stage 3 검증은 **"실사용 11종 + legacy 2종 방어 케이스"**로 표현만 조정한다.

---

## 0.1. v4 신규 발견 (X1~X12)

| # | 심각도 | 내용 |
|---|---|---|
| **X1** | 🔴 **사양 공백** | **클라가 서버로 보내는 `content`의 출처가 v2·v3 어디에도 없다.** 반드시 `loadContent(problemId, versionId)`(`read.ts:38-45`) 결과여야 한다. `getCurrentContent()`(현재 편집 상태)를 쓰면 최신 버전 외 **모든 export가 409**로 죽는다. → §4.1·§3.2에 못박고, **버튼 위치를 바꿔 구조적으로 차단**(X2와 동시 해결) |
| **X2** | 🔴 **구현 함정** | v2 §3.2(c)·v3 §3(c)가 핀 토글·이름 배지 조작을 **타임라인 항목 안**에 두라고 했으나, 항목 자체가 `<button>`이다(`VersionTimeline.tsx:73-117`). **버튼 중첩은 무효 HTML이고 클릭이 버블링돼 버전 선택이 함께 발동**한다. `stopPropagation`으로 때우면 접근성·포커스가 깨진다 → **핀·이름·내보내기 조작을 전부 "선택 버전 툴바"(`VersionDrawer.tsx:128-143`)로 이동.** `VersionTimeline`은 배지 표시(이미 구현됨)만 담당 → **컴포넌트 무변경** |
| **X3** | 🟠 배포 차단 | **새로 만든 빈 레포에는 브랜치가 존재하지 않는다.** `branch: main`을 지정한 첫 PUT은 404로 실패한다. Stage 0에 "README 1커밋으로 `main` 초기화" 명시 |
| **X4** | 🟠 API 사양 누락 | GitHub Contents API 호출에 **브랜치 지정이 빠졌다**. GET은 `?ref={branch}`, PUT은 body의 `branch`. 없으면 항상 기본 브랜치로 가서 `GITHUB_CONTENT_BRANCH` env가 무의미 |
| **X5** | 🟠 런타임 한계 | 최대 왕복 7회(Firestore REST 1 + GitHub GET 3 + PUT 3). **Vercel 서버리스 기본 타임아웃 10초**에 걸릴 수 있다 → `export const maxDuration = 30;` |
| **X6** | 🟡 검증 전제 | (다)안의 409 게이트는 **payload 왕복 충실성**에 전적으로 의존한다. Firestore 저장→읽기 후 `canonicalize`+sha256이 원 `content_hash`와 같아야 **단 한 번이라도** export가 성공한다. 코드상 성립 근거는 확인했으나(아래) **Stage 4 검증 1번 항목**으로 못박는다 |
| **X7** | 🟡 엣지 | `named_existing` 경로에서 `last_version_id`가 가리키는 doc이 없으면 `tx.update`가 던져 `{status:'error'}`가 된다(`snapshot.ts:64-67`). prune은 최신본을 지우지 않으므로 데이터 손상 시에만 도달 — §3(b) 표에 한 줄 |
| **X8** | 🟢 개선 | 서버 200 응답에 `exportedAt`(서버 시각)을 포함해 클라가 `github_export.exported_at`에 그대로 쓰게 한다. 클라 시계 의존 제거 |
| **X9** | 🟢 명확화 | **skip 판정은 파일별 독립.** `versions/{seq}.md`가 skip돼도 `index.md` 갱신 단계는 seq 비교로 별도 판단해야 한다(v3 문면은 "3파일 전부 skip"만 상정) |
| **X10** | 🟢 명확화 | `index.md`의 "이미지는 Storage URL 참조" 안내 주석은 **frontmatter 종료 뒤**에 넣는다(앞에 넣으면 `version_seq` 파싱이 깨진다). 이로써 index.md는 versions md와 바이트가 다르지만, index.md는 **자기 자신의 이전 내용과** 비교하므로 결정성·skip 모두 성립 |
| **X11** | 🟢 사양 | `commitUrl`은 **`versions/{seq}.md`의 커밋**을 반환(본체). 3파일 전부 skip이면 `{ skipped: true, commitUrl: null }` |
| **X12** | 🟢 정보 | `package.json`에 `engines` 없음 → Vercel 기본 Node(22.x). `crypto.subtle` shim(W/v2·v3)은 실질 no-op이나 무해하므로 유지 |

### X6 상세 — 왕복 충실성이 성립하는 근거 (그래도 검증할 것)

| 위험 | 실측 |
|---|---|
| `undefined` 필드 → Firestore write 거부 | `toPersistedBlock`(`normalize.ts:29-50`)은 optional 필드를 **조건부로만 대입**해 `undefined`를 절대 만들지 않는다. `lib/firebase.ts`가 `ignoreUndefinedProperties`를 켜지 않았는데도 Phase 55가 동작해 온 이유 ✅ |
| 정수/실수 왕복 | JS SDK는 안전정수를 `integerValue`, 나머지를 `doubleValue`로 저장. 양쪽 다 읽으면 JS `number` → `JSON.stringify` 결과 동일 ✅ |
| 키 순서 | `canonicalize`(`canonicalize.ts:34-44`)·`canonBlock`(`:16-31`)이 키를 **직접 나열해 재구성**하므로 원본 순서와 무관 ✅ |
| `title: ''` vs 부재 | `canonBlock:18`이 `'' `을 부재와 동치 처리(F4) ✅ |
| 탭/블록 배열 순서 | `canonicalize`가 `key` 사전순·`order` 오름차순 정렬 ✅ |

→ 이론상 안전하지만, **깨지면 export 기능 전체가 409로 사망**하는 단일 실패점이므로 실데이터 1건으로 반드시 먼저 확인한다.

---

## 0.2. 실측 좌표표 (v2 §0.5 + v3 §0 통합 · 전 항목 v4 재확인 ✅)

| 대상 | 위치 | 메모 |
|---|---|---|
| `VersionTrigger` (`'named'` 발화 0곳) | `types/version.ts:15` | G0 근거 |
| `ProblemVersion` (사후수정 주석 포함) | `types/version.ts:49-67` | **W4** 필드 추가 지점 |
| `VersionBlock.type` "11종" 로제 주석 | `types/version.ts:26` | **Y1** 문구 수정 |
| `SnapshotResult` 4갈래 | `types/version.ts:74-78` | |
| 라이브 포인터 4필드 | `types/problem.ts:35-38` | |
| `Block['type']` 유니온 13개 | `types/problem.ts:158` | legacy 2종 포함 |
| `normalizeBlockType` | `EditorView.tsx:123-127` | 적용: 로드 `:1090` · 저장 `:2448` → **Y1 근거** |
| `BLOCK_TYPES`(사용자 선택 9종) | `EditorView.tsx:92-94` | |
| `createSnapshot(…, opts?)` | `lib/version/snapshot.ts:25-31` | |
| dedup 조기반환 | `snapshot.ts:37-39` | `!opts?.name && !opts?.pinned` |
| `named_existing` (기존 doc update) | `snapshot.ts:62-71` (update 63-67) | **E1·E4·X7 근거**. `trigger` 불변 |
| **prune victim 조건** | `lib/version/prune.ts:22` | `trigger==='editor_exit' && !pinned` — **E2** |
| prune 매핑 | `prune.ts:42` | `name` 추가 대상 |
| `canonicalize` / `canonBlock` | `lib/version/canonicalize.ts:34-44` / `:16-31` | 순수·결정적. 제외필드 주석 `:5`(**W9**) |
| `sha256` (`crypto.subtle`) | `lib/version/hash.ts:5-8` | 서버 shim(X12) |
| `toPersistedBlock` | `lib/blocks/normalize.ts:29-50` | **X6 근거** |
| `loadContent` | `lib/version/read.ts:38-45` | **X1: content의 유일한 출처** |
| `collectCurrentContent` | `lib/version/adapter.ts:20-41` | `VersionLoadError` 가능 |
| `snapshotCurrent(trigger)` | `EditorView.tsx:2348-2364` | opts 확장 대상 |
| `createSnapshot` 호출부 ①② | `EditorView.tsx:2358`, `:2662` | |
| `<VersionDrawer>` 마운트 | `EditorView.tsx:2707-2720` | props 배선 |
| Drawer 헤더(이름 저장 버튼 자리) | `VersionDrawer.tsx:102-112` | |
| **선택 버전 툴바** (핀·이름·내보내기 자리) | `VersionDrawer.tsx:128-143` | **X1·X2 해법.** 이미 v{seq}·비교토글·복원 버튼이 있는 줄 |
| 선택 시 본문 로드 (`vContent`) | `VersionDrawer.tsx:47-61` | **X1: 재사용 대상** |
| 타임라인 항목이 `<button>` | `VersionTimeline.tsx:73-117` | **X2 근거** |
| 타임라인 name·pinned 배지 | `VersionTimeline.tsx:8-19, 96-101` | 표시는 이미 구현 → 무변경 |
| `useVersionHistory` (갱신 API 없음) | `hooks/useVersionHistory.ts:7-42` | `patchVersion` 추가 |
| versions 규칙 / **update 규칙** | `firestore.rules:144-166` / `:157-158` | `hasOnly(['name','pinned'])` |
| payload 규칙(update 금지) | `firestore.rules:162-165` | |
| 서버 API 전례(nodejs·무인증) | `app/api/copyright/register/route.ts:6-7, 13` | |
| **Firestore REST 전례** | `app/shared/[shareId]/page.tsx:15-36` | E3 |
| 규칙 테스트(466행·60번까지) | `tests/firestore.rules.test.mjs` | 신규 61~63 |
| roadmap 후속과제 문구 | `docs/roadmap.md:1295` | W3 |
| 의존성 (`firebase-admin`·`octokit`·`jose` 부재) | `package.json` | `engines` 없음(X12) |

---

## 1. 진척상황·범위

**완료** ✅ Phase 55 자체 VCS(Stage 0~6) · Phase 55a 블록 Undo/Redo(Stage 1~4)

**이번 범위**: **G0**(named 저장·핀 UI — 발화 경로 0곳) + **G0′**(prune이 `name` 미보호, E2) + **G1**(GitHub 단방향 export)

**범위 제외(후속 유지)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 `contributors[]` · G6 메타 편입 · G7 `step_label` · G8 전역 pruning · G9 원본인증 매핑(단 frontmatter `content_hash`로 연계 여지 확보)

---

## 2. 목표·비목표

**목표**: `name != null`인 버전을 별도 GitHub 콘텐츠 레포에 md + JSON으로 커밋하는 **단방향 내보내기**. 앱 외부의 영구 백업·이력 아카이브.

**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포와 혼용 · 문항 삭제 시 레포 정리(아카이브 취지상 의도적)

---

## 3. P0 — named 저장·핀 UI + prune 보호

### 3.1 현황

`'named'` 트리거·타임라인 🏷️/라벨·name 배지·📌 렌더(`VersionTimeline.tsx:8-19, 96-101`)·rules의 `name`·`pinned` update 허용(`firestore.rules:157-158`)·규칙 테스트 51·52까지 **전부 준비되어 있으나 `trigger:'named'`/`opts.name` 발화가 레포 전체에 0곳**.

### 3.2 설계 (X1·X2 반영)

**UI 배치 원칙 — 조작은 전부 "선택 버전 툴바"에, 타임라인은 표시 전용**

```
┌ VersionDrawer 헤더 (:102-112) ────────────────┐
│ 버전 기록          [🏷️ 이름 저장]         [×] │   ← (a)
├ 타임라인 (VersionTimeline — 무변경) ──────────┤
│ v7 💾 「중간안」 📌 🐙   덕수      3분 전     │   ← 배지 표시만
│ v6 🚪                   덕수      1시간 전    │
├ 선택 버전 툴바 (:128-143) ────────────────────┤
│ v7  [이전 버전과 비교] [✏️][📌][🐙] [이 버전으로 복원] │   ← (b)(c)(d)
├ diff ─────────────────────────────────────────┤
```

이 배치가 두 결함을 동시에 없앤다:
- **X2 해소** — 조작 버튼이 `<button>` 항목 밖에 있으므로 중첩·버블링이 원천적으로 발생하지 않는다. `VersionTimeline.tsx`는 **한 줄도 고치지 않는다.**
- **X1 해소** — 툴바는 선택 상태에서만 뜨고, 그 시점 `vContent`는 이미 `loadContent`로 로드돼 있다(`VersionDrawer.tsx:52`). 내보내기가 쓸 content는 **정의상 payload 원본**이며 편집 상태가 섞일 경로가 없다.

**(a) 이름 저장 버튼** — 헤더(`:102-112`). 클릭 → 인라인 `<input>` → Enter/확인.
- 배선: `VersionDrawer` props에 `onNamedSave: (name: string) => Promise<SnapshotResult>` 추가. `EditorView.tsx:2707-2720`에서 `snapshotCurrent`를 재사용해 전달.
- `snapshotCurrent`를 `(trigger, opts?)`로 확장하고 `SnapshotResult`를 반환(`EditorView.tsx:2348-2364`). 기존 두 호출부(`:2478`·`:2505`)는 반환을 무시하므로 하위호환 ✅
- 한글 조합 중 Enter 이중발화 방지: `e.nativeEvent.isComposing` 가드
- `getCurrentContent()`가 null이면(탭 로드 실패, `adapter.ts:29-31`) 버튼 비활성 + 안내

**(b) `SnapshotResult` 4갈래 UX**

| status | 조건 | UI |
|---|---|---|
| `created` | 내용 변경 있음 → 새 버전(`trigger:'named'`) | "v{seq} 이름 저장됨" + `loadFirst()` |
| `named_existing` | 내용 동일 + `lastId` 존재 → **기존 버전에 name만 부착**, `trigger` 불변(E1) | "기존 v{seq}에 이름을 붙였습니다" + `patchVersion` |
| `unchanged` | 내용 동일 + `lastId` 부재 | 사실상 이론적 경로(포인터 해시는 있는데 id가 없는 비정상). 조용한 무반응 방지용 안내는 유지 |
| `error` | authorUid 부재 / **`lastId` doc이 실재하지 않아 `tx.update`가 던진 경우(X7)** | 에러 메시지 노출 |

**(c) 핀 토글 / 이름 변경·해제** — `createSnapshot` 경로로는 불가하다. `snapshot.ts:65-66`이 `opts.pinned ? { pinned: true } : {}`라 **`false`를 절대 쓰지 않고**, name 삭제도 불가(E4).
→ `lib/version/meta.ts`(신규, 얇음). rules(`:157-158`)가 이미 허용하므로 규칙 변경 없음.
```ts
export const setVersionName   = (pid, vid, name: string | null) =>
  updateDoc(doc(db,'problems',pid,'versions',vid), { name });
export const setVersionPinned = (pid, vid, pinned: boolean) =>
  updateDoc(doc(db,'problems',pid,'versions',vid), { pinned });
```

**(d) 목록 갱신** — `useVersionHistory`(`:7-42`)의 갱신 수단은 `loadFirst`(커서 리셋)뿐이라, 매 변경마다 부르면 `loadMore`로 펼친 페이지가 접힌다.
→ `patchVersion(id, partial: Partial<ProblemVersion>)`으로 로컬 배열만 갱신. `created`일 때만 `loadFirst`.

### 3.3 prune 보호 수정 (G0′ — E2)

`prune.ts:22`:
```diff
-    if (v.trigger === 'editor_exit' && !v.pinned) {
+    if (v.trigger === 'editor_exit' && !v.pinned && !v.name) {
```
`selectPruneVictims` 입력 타입에 `name?: string | null` 추가, `pruneProblemVersions`(`:42`) 매핑에 `name: d.data().name` 추가.

> 이 한 줄이 없으면 "이름 붙인 버전을 GitHub에 export한 뒤 원본이 조용히 삭제"가 성립한다. **G1보다 먼저.**

### 3.4 검증

1. 변경 있는 상태 이름 저장 → 🏷️ + name 배지, `trigger==='named'`
2. **무변경 상태** 이름 저장 → `named_existing`, 기존 항목(💾)에 name 배지만 추가, `trigger` 불변
3. 핀 토글 켜기/**끄기** 왕복 · 4. 이름 변경 → **해제(`null`)** 왕복
5. **prune 시나리오**: `editor_exit` 버전에 이름만 부착 → 51개 초과 유발 → **살아남는지**
6. 툴바 버튼 클릭이 **버전 선택을 재발동시키지 않는지**(X2 회귀)
7. 한글 이름 입력 중 Enter 1회 = 커밋 1회
8. 콘솔 `permission-denied` 0

---

## 4. G1 — GitHub 내보내기 설계

### 4.1 전체 흐름

```
[클라] 선택 버전 툴바의 🐙 (게이트: selected.name != null)
   content = vContent            ← X1: loadContent 결과. 절대 getCurrentContent 아님
   → POST /api/github/export
        Authorization: Bearer {await user.getIdToken()}      ← W7
        body { problemId, versionId, content }
[서버] app/api/github/export/route.ts
        runtime='nodejs' · dynamic='force-dynamic' · maxDuration=30   ← X5
   1. Authorization 헤더를 그대로 Firestore REST로 릴레이:
      GET /v1/projects/{pid}/databases/(default)/documents/problems/{pid2}/versions/{vid}
      → 401/403이면 그대로 반환 (검증 코드 0줄 — 규칙 verOwner가 대행)
      → name · seq · content_hash · created_at 확보
         ⚠ integerValue는 문자열 → Number() 필수
   2. name == null → 403                            ← E1 (trigger 아님)
   3. canonicalize(content) → sha256 → content_hash 대조. 불일치 409   ← X6
   4. toMarkdown(content, { problemId, seq, name, contentHash, createdAt })  ← W1
   5. Contents API (전부 ?ref / branch 지정 — X4):
        ① versions/{seq}.md  ② versions/{seq}.json  ③ index.md      ← W5
        각 파일 GET → 동일하면 skip, 아니면 PUT (파일별 독립 판정 — X9)
        ③은 기존 index frontmatter의 version_seq ≤ 새 seq일 때만
   → 200 { commitUrl, commitSha, path, skipped, exportedAt }        ← X8·X11
[클라] updateDoc(versions/{vid}, { github_export }) → patchVersion → 배지·링크
```

### 4.2 서버 API — `app/api/github/export/route.ts`

**R3 = (다)** 확정(v3 §6). (가) 무인증은 *임의 문자열이 덕수 레포에 커밋되는 공개 엔드포인트*라 `copyright/register`와 위험 등급이 다르고, (나) `firebase-admin`은 과하다. (다)는 **의존성 0**으로 인증(규칙이 대행)과 무결성(해시 대조)을 동시에 얻는다.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;                        // X5

import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;   // X12 (실질 no-op, 무해)
```

- `canonicalize.ts`는 순수 TS라 서버 import 가능. `hash.ts`의 `sha256`도 위 shim 뒤엔 그대로 동작.
- **payload 전체를 REST로 읽지 않는다** — 중첩 `mapValue`/`arrayValue` 범용 디코더가 필요해져 코드가 길어진다. content는 클라가 보내고 해시로 검증하는 편이 짧다. 서버가 REST로 디코딩하는 값은 스칼라 4개뿐(`name`·`seq`·`content_hash`·`created_at`).
- **W9 잔여 위험은 X1로 소멸** — content가 `loadContent` 결과(= Firestore payload 원본)이므로 `block_key`가 조작될 경로 자체가 없다. 방어적으로 "`block_key`가 빈 문자열이거나 탭 내 중복이면 400" 한 줄만 둔다(클라 버그 조기 발견용).
- **`title`·`answer`는 `content.meta`에서 온다** — `canonMeta`(`canonicalize.ts:10-12`)가 해시에 포함하므로 3번 대조로 함께 검증된다 ✅
- 요청 검증: 필수 필드 4개(헤더 1 + body 3), `JSON.stringify(content).length > 4MB` → 413(Vercel 본문 상한 방어)

### 4.3 환경변수 (전부 서버 전용 — `NEXT_PUBLIC_` 금지)

| 이름 | 값 | 비고 |
|---|---|---|
| `GITHUB_EXPORT_TOKEN` | fine-grained PAT | **콘텐츠 레포 1개 한정 · Contents: Read and write만.** 만료일 설정 |
| `GITHUB_CONTENT_REPO` | `kimdeoksoo-71/mathory-content` | private (R5) |
| `GITHUB_CONTENT_BRANCH` | `main` | 미설정 시 기본 `main`. **반드시 요청에 실릴 것 — X4** |

재사용: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`(REST용, `app/shared/[shareId]/page.tsx:15` 전례)
로컬 `.env.local`(`.gitignore` 등록 ✅) + **Vercel 대시보드 수동 등록**. PAT 만료 시 401 → "환경변수 `GITHUB_EXPORT_TOKEN` 갱신 필요"로 원인 특정.
🔒 **PAT 값은 채팅에 붙여넣지 않는다.**

### 4.4 레포 레이아웃·변환 (W1·W2/Y1·X10)

```
problems/{problemId}/
  index.md                # 최대 seq named 버전의 미러 + 안내 주석
  versions/{seq:04d}.md   # E8: slug 없음 (이름은 사후 변경 가능)
  versions/{seq:04d}.json # VersionContent 원본 (무손실)
```

**`lib/version/exportMd.ts`** — 순수·결정적. 같은 `(content, seq, name, createdAt, problemId)`이면 **바이트 동일**.

```ts
export function toMarkdown(c: VersionContent, meta: {
  problemId: string; seq: number; name: string;
  contentHash: string; createdAt: string;   // W1: 버전 생성 시각(불변). exported_at 없음
}): string
```

- **frontmatter**: `problem_id` · `version_seq` · `version_name` · `content_hash` · `created_at` · `title` · `answer`
  - 전 값 `JSON.stringify()` 인용 (YAML 이스케이프 — `:` `#` `"` 개행 방어)
  - 종료 `---` 뒤 **빈 줄 1개** (raw_text 첫 줄이 `---`일 때 오인 방지)
- **본문**: 탭별 `## {tab.title}` → `order` 순 `raw_text`(블록 사이 빈 줄 1). 블록 `title`이 있으면 `### {title}` 선행. 각 블록 앞 `<!-- block: {type} -->` 마커(GitHub 렌더 비표시)
  - **타입별 분기 없음** — 전 타입 `raw_text` 그대로. 렌더 재현은 비목표(아카이브). GitHub의 `$$` 부분 지원은 한계로 수용
- **이미지**: Storage URL 참조(R4)
- **index.md**: 해당 버전 md와 동일하되, **frontmatter 종료 뒤**에 안내 주석 1줄 삽입(X10)
  `<!-- 이 파일은 versions/{seq}.md의 미러입니다. 이미지는 Firebase Storage URL을 참조하므로 레포 단독으로는 표시되지 않을 수 있습니다. -->`
- **JSON**: `JSON.stringify(content, null, 2) + '\n'` 고정
- **부수 정정**: `types/version.ts:26` 주석 → Y1 문구

### 4.5 멱등성·기록 (W1·W4~W6·W8·X4·X9·X11)

- **PUT 전 GET** (`?ref={branch}` — X4): 404 → sha 없이 생성 / 200 → base64 비교, **동일하면 skip**
  - 1MB 초과 파일은 응답 `content`가 비므로 git blob sha로 비교: `sha1("blob " + byteLen + "\0" + content)`
  - base64는 `Buffer.from(s, 'utf8').toString('base64')` (한글)
  - PUT body에 `branch` 포함 (X4)
- **W1 효과**: 파일 내용에 export 시각이 없으므로 **무변경 재내보내기 = 3파일 전부 skip = 커밋 0**이 실제로 성립. 이름 변경 시에만 frontmatter가 달라져 재커밋(의도된 동작)
- **순서**(W5): `{seq}.md` → `{seq}.json` → `index.md`. 지시자를 항상 마지막에 → 부분 실패 시 index가 없는 파일을 가리키지 않음
- **skip은 파일별 독립**(X9): 본체가 skip돼도 index 갱신 단계는 seq 비교로 별도 판단
- **index 역행 방지**: 기존 index frontmatter `version_seq` 파싱 → 새 seq ≥ 기존일 때만 갱신. **파싱 실패 시 덮어씀**(W6 — 미러 원칙)
- **커밋 메시지**(W8):
  - 버전 파일 `export: {title} v{seq} — {name} ({contentHash.slice(0,8)})`
  - index `export: index → v{seq} ({problemId})`
- **응답**(X8·X11): `commitUrl`/`commitSha`는 `versions/{seq}.md`의 커밋. 3파일 전부 skip이면 `{ skipped: true, commitUrl: null }`. `exportedAt`은 서버 시각
- **기록**: 클라가 `updateDoc(versions/{vid}, { github_export: { repo, path, commit_sha, exported_at } })`
  - **W4 타입 추가** (`types/version.ts:50-67`):
    ```ts
    github_export?: { repo: string; path: string; commit_sha: string; exported_at: string } | null;
    ```
    `:49` 주석도 "사후 수정은 name·pinned·github_export만"으로 갱신
  - `createSnapshot`의 meta 리터럴(`snapshot.ts:74-83`)은 optional이므로 무변경 ✅
- **규칙 확장**: `firestore.rules:158` `hasOnly(['name','pinned'])` → `+ 'github_export'`. `affectedKeys()`는 최상위 키만 보므로 중첩 map 통과. **F3 교훈 — Stage 2로 단독·선배포**
- 서버 성공 ↔ 클라 기록 사이 크래시: 재export가 skip으로 수렴 → 허용

### 4.6 실패 처리

| 상황 | 코드 | 메시지 |
|---|---|---|
| idToken 누락/만료/위조 | 401 | "로그인이 만료되었습니다 — 새로고침 후 재시도" |
| 타인 문항 / 규칙 거부 | 403 | "이 문항의 버전에 접근할 수 없습니다" |
| `name == null` | 403 | "이름이 붙은 버전만 내보낼 수 있습니다" |
| 해시 불일치 | 409 | "버전 본문이 일치하지 않습니다 — 새로고침 후 재시도" |
| `block_key` 결측·중복 | 400 | "버전 본문이 손상되었습니다" |
| GitHub 토큰 만료·권한 부족 | 401/403 | "`GITHUB_EXPORT_TOKEN` 갱신 필요" |
| 레포/브랜치 부재 | 404 | "콘텐츠 레포 또는 브랜치를 찾을 수 없습니다: {repo}@{branch}" (**X3 초기화 누락이 여기로 나온다**) |
| blob sha 충돌 | 409 | sha 재조회 후 **1회 자동 재시도**, 재실패 시 surface |
| 본문 과대 | 413 | "버전 본문이 너무 큽니다" |

에러 메시지는 **화이트리스트 구성** — 원본 에러 객체를 그대로 흘리지 않는다(`copyright/register:60-79`의 전면 노출 패턴을 따르지 말 것).

### 4.7 명시적 비대응

문항·버전 삭제 시 레포 정리 없음(아카이브) · GitHub 쪽 수동 편집은 다음 export가 덮어씀(미러)

---

## 5. 구현 순서 (Stages)

**Stage 0 · 준비**
- §0.2 좌표 재실측(HEAD 이동 시)
- 덕수: **비공개** 레포 `mathory-content` 생성 → **README 1커밋으로 `main` 브랜치 초기화(X3 — 빈 레포면 첫 PUT이 404)** → fine-grained PAT 발급(해당 레포 1개·Contents RW) → `.env.local` + **Vercel env 수동 등록**

**Stage 1 · P0 (§3)** — named/핀 UI + `meta.ts` + `patchVersion` + **prune `!v.name`**. 규칙 변경 없음, 독립 배포. `VersionTimeline.tsx` 무변경(X2). 검증 §3.4 8항목.

**Stage 2 · 규칙 확장 (§4.5)** — **단독 커밋·선배포**. `test:rules` 61(github_export 단독 허용) · 62(name 동반 허용) · 63(content_hash 동반 거부) 추가, 기존 60건 회귀 0.

**Stage 3 · 변환기** — `exportMd.ts` + `types/version.ts` 주석(Y1)·필드(W4).
검증: 실사용 11종 블록 + legacy 2종 방어 케이스 · 다중 탭 · `---`로 시작하는 raw_text · `:` 포함 제목 · **동일 입력 2회 → 바이트 동일**(W1 결정성)

**Stage 4 · 서버 API**
- **검증 1번(최우선, X6)**: 실데이터 버전 1건으로 `loadContent` → `canonicalize` → `sha256` == 저장된 `content_hash` **확인**. 여기서 깨지면 이후 전부 무의미
- 이어서 curl: 성공 / 헤더 누락 401 / 타인 403 / 이름 없음 403 / 해시 변조 409 / 레포 부재 404 / **동일 내용 재요청 → `skipped:true`·커밋 0**(W1) / 응답에 토큰 미노출 / 브랜치 지정 반영(X4)

**Stage 5 · UI 배선 + E2E**
- 선택 버전 툴바에 ✏️·📌·🐙 (게이트 `selected.name != null`), 타임라인은 배지만
- E2E: 이름 저장 → 내보내기 → 파일 3개 확인 → **무변경 재내보내기 커밋 0** → 내용 수정 후 새 named 내보내기(index 갱신) → **이름 변경 후 재내보내기(같은 경로 갱신·유령 파일 없음 — E8)** → **낮은 seq 내보내기(index 역행 없음)** → `github_export` 기록·링크 → **툴바 버튼이 버전 선택을 재발동시키지 않음(X2)**

**문서** — roadmap Phase 55b 기재 + `:1295` "(Phase 56+ 별도)" → "(Phase 55b)" 정정(E9·W3). 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 툴바 버튼만 제거. 규칙 확장은 상위호환이라 되돌릴 필요 없음.

---

## 6. 확정된 결정 (v3 §6 유지 — 재론 불요)

| # | 결정 |
|---|---|
| R1 | **md + json 병행** — md는 사람용, json은 무손실 재현·복원 여지 |
| R2 | **수동 버튼만** — named 생성 시 자동 export는 하지 않음 |
| R3 | **(다) idToken 릴레이 + Firestore REST 메타 읽기 + 해시 대조** — 의존성 0, 인증은 규칙(verOwner)이 대행 |
| R4 | **Storage URL 참조만** — 레포 동봉은 후속 |
| R5 | **`kimdeoksoo-71/mathory-content` · 비공개(private)** — frontmatter에 `answer`, 본문 전체가 평문 |
| R6 | **자동 핀 없음** — §3.3 prune 수정으로 `name` 단독 보호가 성립 |

---

## 부록 A. v4 실측 기록 (`f311121` · CLI 직접 확인)

- **A-1.** `types/problem.ts:158` Block 유니온 13개 확인 → W2 사실 인정. 단 `EditorView.tsx:123-127`의 `normalizeBlockType`이 **로드(`:1090`)·저장(`:2448`) 양쪽**에 걸려 있어 version payload 유입은 11종 → **Y1**
- **A-2.** `normalize.ts:29-50` `toPersistedBlock`이 optional 필드를 조건부로만 대입 → `undefined` 미생성. `lib/firebase.ts`에 `ignoreUndefinedProperties` 없이도 Phase 55가 동작해온 근거이자 **X6 안전 근거**
- **A-3.** `VersionTimeline.tsx:73-117` 항목이 `<button>` → 내부에 버튼을 넣을 수 없음 → **X2**
- **A-4.** `VersionDrawer.tsx:47-61`이 선택 시 `loadContent`로 `vContent`를 이미 채운다 → 툴바 배치가 **X1을 구조적으로 해소**
- **A-5.** `snapshot.ts:62-71` 재확인 — `named_existing`은 기존 doc에 name/pinned만 update, `trigger` 불변(E1·E4). `lastId` doc 부재 시 `tx.update` throw → `error`(**X7**)
- **A-6.** `prune.ts:20-26` victim 조건에 `name` 없음 재확인(E2). `:7` 주석과 로직 불일치가 v1 오판의 원인
- **A-7.** `canonicalize.ts:5` 제외 필드 주석(W9) · `:10-12` `canonMeta`가 title·answer를 해시에 포함 → frontmatter의 title·answer도 대조로 함께 검증됨
- **A-8.** `docs/roadmap.md:1295` 후속과제 문구 확인(W3) · `tests/firestore.rules.test.mjs` 466행·마지막 케이스 60번 확인
- **A-9.** `package.json`에 `engines` 없음 → Vercel 기본 Node. `firebase-admin`·`octokit`·`jose` 전부 부재 재확인
