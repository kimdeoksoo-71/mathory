# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v5 최종 (확정 착수본)**

작성일: 2026-08-15 · 작성: web Claude (Fable) · 기준 커밋: `f311121`
계보: v1(web) → v2(CLI, E1~E9) → v3(web, W1~W9 + R1~R6 확정) → v4(CLI, X1~X12·Y1) → **v5(web 최종 — v4 전 항목 재실측 승인 + 신규 결함 Z1~Z6 반영)**

> **본 문서의 위상** — **확정 착수본. Claude Code 착수 가능.** v4의 X1~X12·Y1을 전부 레포에서 재실측해 승인(X3·X11은 보완)하고, v4에 남아 있던 결함 6건(Z1~Z6)을 교정한 통합본. R1~R6은 v3에서 덕수 확정 완료(§6) — 재론 불요. 본 문서를 `docs/phasedocs/`에 배치. 착수 시 HEAD가 `f311121`에서 이동했다면 §0.2 좌표 재실측 먼저.
>
> 다섯 라운드 모두에서 새 결함이 나왔다(E→W→X→Z). Z1·Z2는 v4의 X2 해법(툴바 이동) **자체에서** 파생된 것으로, 구현 중에도 같은 계열(파생 상태 정합)의 회귀를 경계할 것.

---

## 0. v4 검증 결과 (X1~X12 · Y1) — 웹 Claude 재실측

| # | 판정 | 근거 |
|---|---|---|
| **X1** content 출처 미명세 (🔴) | ✅ **승인 — v4 최대 성과** | `VersionDrawer.tsx:47-61` 실측 — 선택 시 `loadContent`로 `vContent`가 이미 로드됨. 툴바 배치로 "편집 상태가 섞일 경로가 없다"는 논증 타당. `getCurrentContent()`를 쓰면 최신 버전 외 모든 export가 409로 죽는다는 진단도 정확 |
| **X2** 타임라인 항목 = `<button>` (🔴) | ✅ 승인 | `VersionTimeline.tsx:73` 실측 — 항목 전체가 `<button>`. 버튼 중첩 무효 HTML + 버블링 진단 정확. 툴바(`VersionDrawer.tsx:128-143` — v{seq}·비교토글·복원이 이미 있는 줄) 이동 승인. **단 v4의 "타임라인 한 줄도 무변경" 주장은 자기 다이어그램과 모순 — Z2** |
| **X3** 빈 레포 브랜치 부재 (🟠) | ✅ 승인 + 보완 | X4가 모든 요청에 `branch`를 명시하므로 빈 레포는 404 확정. **보완**: 레포 생성 시 "Add a README" 체크 1회로 충분 — 별도 커밋 절차 불요 (§5 Stage 0) |
| **X4** branch 지정 누락 (🟠) | ✅ 승인 | GET `?ref=` · PUT body `branch` |
| **X5** `maxDuration = 30` (🟠) | ✅ 승인 | 왕복 7회 산정 타당 |
| **X6** 왕복 충실성 (🟡) | ✅ 승인 | `normalize.ts:33-47` optional 조건부 대입 실측 ✓ · `lib/firebase.ts`에 `ignoreUndefinedProperties` 부재 실측 ✓. "Stage 4 검증 1번" 배치 승인 |
| **X7** `lastId` doc 부재 시 error (🟡) | ✅ 승인 | `tx.update`는 커밋 시 throw → 외곽 catch → `{status:'error'}` |
| **X8~X12** | ✅ 승인 | X11은 부분-skip 엣지 보완(**Z5**) |
| **Y1** "13종"은 주석엔 틀리다 (W2 부분정정) | ✅ 승인 | `normalizeBlockType`(`EditorView.tsx:123-127`)이 로드(`:1090`)·저장(`:2448`) 양쪽 게이트 실측 ✓ · `BLOCK_TYPES` 9종(`:92-94`) ✓ · CLAUDE.md 블록 타입 절 존재 ✓. **version payload 실유입은 11종** — v3의 W2를 이렇게 확정한다. Stage 3 검증 문구 조정 승인 |
| `snapshotCurrent` 호출부 `:2478`·`:2505` | ✅ 실측 일치 | manual_save(handleSave 내)·editor_exit(handleBackWithSave 내) |

## 0.1. v5 신규 발견 (Z1~Z6)

| # | 심각도 | 내용 |
|---|---|---|
| **Z1** | 🟠 **파생 상태 정체** | v4 설계에서 `patchVersion`은 훅의 `versions` 배열만 갱신하는데, **툴바가 읽는 `selected`는 별도 state**다(`VersionDrawer.tsx:30`, 갱신 지점은 `:43`·`:48`뿐). 이름 저장(`named_existing`)·이름 변경·핀·export 직후 `selected`가 **구 객체로 남아** ① export 게이트(`selected.name != null`)가 방금 이름 붙인 버전에서 안 열리고 ② 툴바 배지·링크가 낡는다. **해법**: 툴바·게이트는 `selected`를 직접 읽지 말고 파생값을 쓴다 — `const sel = versions.find(x => x.id === selected?.id) ?? selected;` (렌더 시 1줄). `selected`는 "무엇이 선택됐는가"의 앵커로만 유지 (§3.2) |
| **Z2** | 🟡 자기모순 해소 | v4 §3.2 다이어그램은 타임라인 행에 🐙 배지를 그려 놓고 본문은 "VersionTimeline.tsx 한 줄도 고치지 않는다"고 주장. 현행 타임라인은 name·📌만 렌더(`:96-101`) — 🐙는 신규다. **확정**: 타임라인에 **표시 전용 배지 1개 추가**(`v.github_export && <span>` — 상호작용 없음이므로 X2와 무관). v4의 "무변경"은 "**상호작용 무변경·배지 1 span 추가**"로 정정 (§3.2) |
| **Z3** | 🟡 사양 공백 | **export 호출의 idToken 출처 미명세.** Drawer는 `user`를 모른다(props `:16-28`). **해법**: `onNamedSave` 패턴과 대칭으로 `onExport: (versionId: string, content: VersionContent) => Promise<ExportOutcome>`을 EditorView가 제공(내부에서 `user.getIdToken()` + fetch). 성공 시 **doc 기록은 Drawer가** `setVersionExport`(meta.ts에 헬퍼 추가) + `patchVersion`으로 수행 — 목록·배지 갱신 책임을 Drawer 한곳에 모은다 (§3.2·§4.1) |
| **Z4** | 🟢 게이트 보강 | 🐙는 `sel.name != null` **그리고 `!contentLoading && vContent != null`**일 때만 활성 — 선택 직후 payload 로드가 끝나기 전 클릭하면 null content를 보내게 되는 창을 닫는다 (§4.1) |
| **Z5** | 🟢 X11 보완 | `skipped: true`는 **3파일 전부 skip일 때만**. 일부만 커밋된 경우(직전 부분 실패 복구 등) `commitUrl`은 **md → json → index 우선순위의 첫 번째 비-skip 커밋** (§4.5) |
| **Z6** | 🟢 문면 정리 | X3 절차 간소화 — "README 1커밋으로 초기화"는 레포 **생성 다이얼로그의 'Add a README' 체크**로 갈음 (§5 Stage 0) |

## 0.2. 실측 좌표표

v4 §0.2 표를 **전 항목 승계**(v5 재확인 ✅). 추가분만:

| 대상 | 위치 | 메모 |
|---|---|---|
| Drawer `selected` state·갱신 지점 | `VersionDrawer.tsx:30, 43, 48` | **Z1 근거** — 파생값 `sel`로 대체 |
| 타임라인 name·📌 렌더(🐙 없음) | `VersionTimeline.tsx:96-101` | **Z2 근거** — 배지 1 span 추가 지점 |
| Drawer props(user 부재) | `VersionDrawer.tsx:16-28` | **Z3 근거** — `onNamedSave`·`onExport` 추가 |
| `snapshotCurrent` 호출부 | `EditorView.tsx:2478`(manual_save)·`:2505`(editor_exit) | v4 기재 실측 일치 |

---

## 1. 진척상황·범위 (v4 유지)

**완료** ✅ Phase 55 자체 VCS(Stage 0~6) · Phase 55a 블록 Undo/Redo(Stage 1~4)
**이번 범위**: **G0**(named 저장·핀 UI — 발화 0곳) + **G0′**(prune `name` 미보호, E2) + **G1**(GitHub 단방향 export)
**범위 제외(후속)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 contributors[] · G6 메타 편입 · G7 step_label · G8 전역 pruning · G9 원본인증 매핑(frontmatter `content_hash`로 연계 여지만 확보)

## 2. 목표·비목표 (v4 유지)

**목표**: `name != null` 버전을 별도 GitHub 콘텐츠 레포에 md+JSON으로 커밋하는 단방향 내보내기.
**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포 혼용 · 문항 삭제 시 레포 정리(의도적).

---

## 3. P0 — named 저장·핀 UI + prune 보호

### 3.1 현황 (v4 유지)

모델·배지 렌더·규칙·규칙 테스트까지 전부 준비 완료, `trigger:'named'`/`opts.name` 발화만 레포 전체 0곳.

### 3.2 설계 (X1·X2 + Z1·Z2·Z3 반영)

**UI 배치 원칙 — 조작은 전부 "선택 버전 툴바", 타임라인은 표시 전용(+배지 1 span)**

```
┌ VersionDrawer 헤더 (:102-112) ────────────────┐
│ 버전 기록          [🏷️ 이름 저장]         [×] │   ← (a)
├ 타임라인 (상호작용 무변경 · 🐙 배지 span만 추가) ─┤
│ v7 💾 「중간안」 📌 🐙   덕수      3분 전     │   ← 배지 표시만 (Z2)
├ 선택 버전 툴바 (:128-143) ────────────────────┤
│ v7  [이전 버전과 비교] [✏️][📌][🐙] [이 버전으로 복원] │   ← (b)(c)(d)
├ diff ─────────────────────────────────────────┤
```

- **X2 해소**: 조작 버튼이 `<button>` 항목 밖 → 중첩·버블링 원천 차단.
- **X1 해소**: 툴바 시점의 `vContent`는 `loadContent` 결과(`:52`) — 편집 상태가 섞일 경로 없음.
- **Z1 해소**: 툴바·게이트·배지는 파생값을 읽는다.
  ```ts
  const sel = versions.find((x) => x.id === selected?.id) ?? selected;  // 렌더 시 파생
  ```
  `patchVersion`(로컬 배열 갱신) 후 별도 동기화 코드 없이 즉시 반영된다. `selected`는 선택 앵커·`vContent` 로드 트리거로만 유지.

**(a) 이름 저장 버튼** — 헤더. 클릭 → 인라인 `<input>` → Enter/확인.
- props `onNamedSave: (name: string) => Promise<SnapshotResult>` 추가, EditorView(`:2707-2720`)에서 `snapshotCurrent` 재사용 전달.
- `snapshotCurrent`를 `(trigger, opts?)`로 확장 + `SnapshotResult` 반환(`:2348-2364`). 기존 호출부 `:2478`·`:2505`는 반환 무시 — 하위호환 ✅
- 한글 조합 Enter 이중발화: `e.nativeEvent.isComposing` 가드.
- `getCurrentContent()` null(탭 로드 실패, `adapter.ts:29-31`) → 버튼 비활성 + 안내.

**(b) `SnapshotResult` 4갈래 UX** (v4 유지 + Z1)

| status | 조건 | UI |
|---|---|---|
| `created` | 내용 변경 있음 → 새 버전(`trigger:'named'`) | "v{seq} 이름 저장됨" + `loadFirst()` |
| `named_existing` | 내용 동일 + `lastId` 존재 → 기존 doc에 name만 부착(`trigger` 불변 — E1) | "기존 v{seq}에 이름을 붙였습니다" + `patchVersion` → **`sel` 파생으로 툴바 게이트 즉시 개방(Z1)** |
| `unchanged` | 내용 동일 + `lastId` 부재 | 사실상 이론적 경로. 조용한 무반응 방지 안내 유지 |
| `error` | authorUid 부재 / `lastId` doc 실재하지 않아 `tx.update` throw(X7) | 에러 노출 |

**(c) 핀 토글 / 이름 변경·해제 / export 기록** — `createSnapshot` 경로 불가(E4: `pinned:false`·name 삭제를 절대 쓰지 않음). `lib/version/meta.ts` 신설(Z3로 헬퍼 3개):
```ts
export const setVersionName   = (pid, vid, name: string | null) => updateDoc(…, { name });
export const setVersionPinned = (pid, vid, pinned: boolean)     => updateDoc(…, { pinned });
export const setVersionExport = (pid, vid, ge: GithubExport)    => updateDoc(…, { github_export: ge });
```
name·pinned는 현행 규칙 통과, `github_export`는 Stage 2 규칙 확장 후.

**(d) 목록 갱신** — `useVersionHistory`에 `patchVersion(id, partial)` 추가(로컬 배열만). `created`일 때만 `loadFirst`. 매 변경 `loadFirst` 금지(`loadMore` 펼침 보존).

### 3.3 prune 보호 수정 (G0′ — v4 유지)

`prune.ts:22`에 `&& !v.name` · 입력 타입에 `name?: string | null` · `:42` 매핑에 `name` 추가. **G1보다 먼저.**

### 3.4 검증 (v4의 8항목 + Z1)

1. 변경 있는 상태 이름 저장 → 🏷️·배지·`trigger==='named'` 2. 무변경 이름 저장 → `named_existing`·기존 항목 배지·**직후 재선택 없이 🐙 게이트 열림(Z1)** 3. 핀 켜기/끄기 왕복 4. 이름 변경→해제 왕복 5. prune: `editor_exit`+이름만 부착→51개 초과→생존 6. 툴바 클릭이 버전 선택 재발동 안 함(X2) 7. 한글 Enter 1회=커밋 1회 8. `permission-denied` 0.

---

## 4. G1 — GitHub 내보내기 설계

### 4.1 전체 흐름 (v4 + Z3·Z4)

```
[클라·Drawer] 선택 버전 툴바 🐙
   게이트: sel.name != null && !contentLoading && vContent != null   ← Z1·Z4
   → onExport(sel.id, vContent)                                      ← Z3 (X1: 절대 getCurrentContent 아님)
[클라·EditorView의 onExport]
   → POST /api/github/export
        Authorization: Bearer {await user.getIdToken()}              ← W7 (user는 EditorView 소유)
        body { problemId, versionId, content }
[서버] app/api/github/export/route.ts
        runtime='nodejs' · dynamic='force-dynamic' · maxDuration=30  ← X5
   1. Authorization 헤더를 Firestore REST로 릴레이 → 401/403 그대로 반환 (규칙 verOwner 대행)
      → name·seq·content_hash·created_at 확보 (integerValue는 문자열 → Number())
   2. name == null → 403                                             ← E1
   3. canonicalize(content) → sha256 → content_hash 대조, 불일치 409  ← X6
      + block_key 결측·탭 내 중복 → 400 (클라 버그 조기 발견용)
   4. toMarkdown(content, { problemId, seq, name, contentHash, createdAt })  ← W1
   5. Contents API (전 요청 branch 지정 — X4):
        ① versions/{seq}.md ② versions/{seq}.json ③ index.md         ← W5
        파일별 GET→동일 skip / PUT (독립 판정 — X9)
        ③은 기존 index frontmatter version_seq ≤ 새 seq일 때만(파싱 실패 시 덮어씀 — W6)
   → 200 { commitUrl, commitSha, path, skipped, exportedAt }          ← X8·X11·Z5
[클라·Drawer] setVersionExport(pid, vid, { repo, path, commit_sha, exported_at: exportedAt })
   → patchVersion → sel 파생으로 배지·링크 즉시 갱신(Z1)              ← Z3
```

### 4.2 서버 API (v4 유지)

R3=(다) 확정. `runtime='nodejs'`·`force-dynamic`·`maxDuration=30`·crypto shim(X12, 실질 no-op·무해). payload 전체 REST 디코딩 안 함(스칼라 4개만: name·seq·content_hash·created_at). `canonicalize.ts` 서버 import 가능. title·answer는 `content.meta`에서 — `canonMeta`(`canonicalize.ts:10-12`)가 해시에 포함하므로 3번 대조로 함께 검증 ✅. W9 잔여 위험은 X1로 소멸(+ block_key 400 방어). 요청 검증: 필수 4개(헤더1+body3)·4MB 초과 413.

### 4.3 환경변수 (v4 유지)

`GITHUB_EXPORT_TOKEN`(fine-grained·콘텐츠 레포 1개·Contents RW만·만료 설정) · `GITHUB_CONTENT_REPO=kimdeoksoo-71/mathory-content`(private — R5) · `GITHUB_CONTENT_BRANCH=main`(**요청에 반드시 실을 것 — X4**) · `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 재사용. `.env.local` + Vercel 수동 등록. PAT 만료 401 → env 갱신 안내. 🔒 **PAT 값은 채팅에 붙여넣지 않는다.**

### 4.4 레포 레이아웃·변환 (v4 유지 — W1·Y1·X10)

```
problems/{problemId}/
  index.md                # 최대 seq named 버전 미러 + 안내 주석(frontmatter 종료 뒤 — X10)
  versions/{seq:04d}.md   # slug 없음(E8)
  versions/{seq:04d}.json # VersionContent 원본(무손실)
```

`toMarkdown(c, { problemId, seq, name, contentHash, createdAt })` — 순수·결정적(같은 입력 = 같은 바이트). frontmatter 7필드 전 값 `JSON.stringify()` 인용(YAML 방어), 종료 `---` 뒤 빈 줄 1개. 본문: 탭별 `## {tab.title}` → order 순 raw_text(사이 빈 줄 1) · 블록 title 있으면 `### {title}` · 블록 앞 `<!-- block: {type} -->` · 타입별 분기 없음(전 타입 raw_text 그대로 — 실유입 11종, legacy 2종도 안전). 이미지 Storage URL 참조(R4). JSON은 `JSON.stringify(content, null, 2) + '\n'` 고정. **부수 정정**: `types/version.ts:26` 주석 → Y1 문구("실 유입 11종…").

### 4.5 멱등성·기록 (v4 유지 + Z5)

- PUT 전 GET(`?ref=`): 404→신규 / 200→base64 비교 동일 skip(1MB 초과는 git blob sha 비교: `sha1("blob "+len+"\0"+content)`). base64는 `Buffer.from(s,'utf8')`. PUT body `branch`(X4).
- W1 효과: 무변경 재내보내기 = 3파일 skip = 커밋 0. 이름 변경 시에만 frontmatter 변화로 재커밋(의도).
- 순서(W5): md → json → index(항상 마지막). skip은 파일별 독립(X9). index 역행 방지: seq 비교, 파싱 실패 시 덮어씀(W6).
- 커밋 메시지(W8): 버전 `export: {title} v{seq} — {name} ({hash8})` / index `export: index → v{seq} ({problemId})`.
- **응답(X8·X11·Z5)**: `exportedAt`=서버 시각. `skipped: true`는 **3파일 전부 skip일 때만**, 이때 `commitUrl: null`. 일부만 커밋이면 `commitUrl`은 **md → json → index 우선순위의 첫 비-skip 커밋**.
- 기록: Drawer가 `setVersionExport`(Z3) → `patchVersion`. **W4 타입**: `ProblemVersion`에 `github_export?: { repo; path; commit_sha; exported_at } | null` + `:49` 주석 갱신. `createSnapshot` meta 리터럴은 optional이라 무변경 ✅.
- 규칙 확장: `firestore.rules:158` `hasOnly([...,'github_export'])`. **F3 교훈 — Stage 2 단독·선배포.**
- 서버 성공↔클라 기록 사이 크래시: 재export가 skip으로 수렴 — 허용.

### 4.6 실패 처리 (v4 표 유지)

401 로그인 만료 / 403 타인·이름 없음 / 409 해시 불일치(새로고침 안내)·blob sha 충돌(1회 자동 재시도) / 400 block_key 손상 / 404 레포·브랜치 부재(**X3 미초기화가 여기로 나온다**) / 413 과대 / GitHub 토큰 401·403(env 갱신 안내). 에러 메시지 화이트리스트 — 원본 에러 객체 전면 노출 금지(`copyright/register:60-79` 패턴 따르지 말 것).

### 4.7 명시적 비대응 (v4 유지)

문항·버전 삭제 시 레포 정리 없음 · GitHub 쪽 수동 편집은 다음 export가 덮어씀(미러).

---

## 5. 구현 순서 (Stages)

**Stage 0 · 준비** — §0.2 좌표 재실측(HEAD 이동 시). 덕수: **비공개** 레포 `mathory-content` 생성 시 **"Add a README" 체크(Z6 — X3의 main 초기화를 이것으로 갈음)** → fine-grained PAT 발급(해당 레포 1개·Contents RW) → `.env.local` + **Vercel env 수동 등록**.

**Stage 1 · P0 (§3)** — named/핀 UI + `meta.ts`(헬퍼 3) + `patchVersion` + **`sel` 파생(Z1)** + 타임라인 🐙 배지 span(Z2) + **prune `!v.name`**. 규칙 변경 없음·독립 배포. 검증 §3.4 8항목(Z1 포함).

**Stage 2 · 규칙 확장 (§4.5)** — 단독 커밋·**선배포**. `test:rules` 61(github_export 단독 허용)·62(name 동반 허용)·63(content_hash 동반 거부), 기존 60건 회귀 0.

**Stage 3 · 변환기** — `exportMd.ts` + `types/version.ts` 주석(Y1)·필드(W4). 검증: 실사용 11종 + legacy 2종 방어 · 다중 탭 · `---` 시작 raw_text · `:` 포함 제목 · **동일 입력 2회 → 바이트 동일**(W1).

**Stage 4 · 서버 API** — **검증 1번(최우선, X6)**: 실데이터 1건으로 `loadContent`→`canonicalize`→`sha256` == 저장된 `content_hash`. 이어 curl: 성공 / 헤더 누락 401 / 타인 403 / 이름 없음 403 / 해시 변조 409 / block_key 손상 400 / 레포 부재 404 / **동일 내용 재요청 `skipped:true`·커밋 0** / 토큰 미노출 / 브랜치 반영(X4).

**Stage 5 · UI 배선 + E2E** — 툴바 ✏️📌🐙(게이트 Z1·Z4) + 타임라인 배지. E2E: 이름 저장→내보내기→파일 3개 확인→무변경 재내보내기 커밋 0→수정 후 새 named 내보내기(index 갱신)→이름 변경 후 재내보내기(유령 파일 없음 — E8)→낮은 seq 내보내기(index 역행 없음)→`github_export` 기록·링크→툴바가 선택 재발동 안 함(X2)→**이름 저장 직후 재선택 없이 export 가능(Z1)**→**payload 로드 전 🐙 비활성(Z4)**.

**문서** — roadmap Phase 55b 기재 + `:1295` "(Phase 56+ 별도)"→"(Phase 55b)" 정정(E9·W3). 본 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 툴바 버튼만 제거. 규칙 확장은 상위호환.

---

## 6. 확정된 결정 (v3 §6 덕수 확정 — 재론 불요)

R1 **md+json 병행** · R2 **수동 버튼만** · R3 **(다) idToken 릴레이+REST+해시 대조** · R4 **Storage URL 참조만** · R5 **`kimdeoksoo-71/mathory-content` 비공개** · R6 **자동 핀 없음**

---

## 부록 A. v5 재실측 기록 (`f311121` · 웹 Claude 직접 확인)

- **A-1.** `EditorView.tsx:123-127` `normalizeBlockType`(math_block·bullet→text)·적용 지점 `:1090`(로드)·`:2448`(저장)·`BLOCK_TYPES` 9종(`:92-94`) — **Y1 전부 실측 승인.** CLAUDE.md 블록 타입 절 존재 확인.
- **A-2.** `VersionTimeline.tsx:73` 항목 `<button>`(onClick=onSelect) — **X2 승인.** `:96-101` 배지는 name·📌뿐, 🐙 없음 — **Z2 근거.**
- **A-3.** `VersionDrawer.tsx:30` `selected`는 별도 state, 갱신은 `:43`(초기화)·`:48`(선택)뿐 — **Z1 근거.** `:47-61` 선택 시 `loadContent`→`vContent` — **X1 해법 성립.** `:128-143` 툴바(v{seq}·비교토글·복원) 실재 — 버튼 추가 지점 승인. props(`:16-28`)에 user 부재 — **Z3 근거.**
- **A-4.** `EditorView.tsx:2478`(manual_save)·`:2505`(editor_exit) — snapshotCurrent 호출부 v4 기재 일치.
- **A-5.** `normalize.ts:33-47` optional 조건부 대입·`lib/firebase.ts` `ignoreUndefinedProperties` 부재 — **X6 근거 승인.**
- **A-6.** X3: X4(branch 명시) 하에서 빈 레포 404는 확정적. 레포 생성 시 README 체크로 무력화(Z6).
- **A-7.** E1·E2·E4·W1~W9의 근거 좌표 전부 v4 §0.2와 일치 — 승계.
