# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v8 착수본**

작성일: 2026-08-15 · 작성: CLI Claude (Opus 5) · 기준 커밋: `f311121` (HEAD 일치 재확인 ✅)
계보: v1(web) → v2(CLI, E) → v3(web, W) → v4(CLI, X·Y) → v5(web, Z) → v6(CLI, V·I) → v7(web, J) → **v8(CLI 최종 — J1~J5 승인, K1~K6 교정, 전 절 자립화)**

> **본 문서의 위상** — **최종 착수본. 이 파일 하나로 구현 가능하다.**
> v7의 J1~J5를 실코드로 검증해 전부 승인했다(J2는 `IconUndo` 점유 실측으로 확인). 다만 v7은 §4 전체를 "v6 승계"라는 한 줄로 압축해 **착수본의 자립성을 잃었다(K1)** — v8은 §4를 전량 재수록하고 누적 결함 색인표를 복원했다.
> 착수 시 HEAD가 `f311121`에서 이동했다면 §0.4 좌표 재실측 먼저.
>
> **수렴 선언**: 여덟 라운드, 누적 결함 60건. 설계 축은 v6에서(🔴 0), 아이콘 축은 v7에서(확정 코드) 수렴했고, v8 신규 6건은 **🔴 1 / 🟠 1 / 🟢 4**이며 🔴 K1은 문서 구조 문제로 이 파일에서 이미 해소됐다. **추가 교차검토 없이 착수한다.**

---

## 0. 검증 기록

### 0.1. v7 판정 (J1~J5)

| # | 판정 | 실측 근거 |
|---|---|---|
| **J1** `IconExportRepo`(상자+화살표) 기각 → `IconExport`(트레이+상향, Feather upload) | ✅ **승인** | `VersionTimeline.tsx:92-95`에서 `IconExit`(상자+우향 화살표)가 같은 줄에 렌더된다 — 12px 배지까지 "상자+화살표"면 쌍둥이가 된다는 진단 타당. `IconDownload:329`(Feather download)와 대칭쌍이 되는 것도 시스템 어휘로 자연스럽다. **단 K4 보강** |
| **J2** `IconRestore` 신설(IconUndo 재사용 철회) | ✅ **승인 — v7 최대 성과** | **`IconUndo`는 `EditorView.tsx:2868`(Phase 55a 블록 Undo 버튼)이 점유 중** — 실측 확인. I2(의미 점유 아이콘 재사용 금지)와 동일 사유. 도안도 확연히 다르다: `IconUndo`(`Icons.tsx:89-96`)는 좌향 화살표+갈고리 곡선, `IconRestore`는 시계 원+반시계 호+시침 |
| **J3** 굵기 혼재 허용(신규 1.8 / `IconRename` 2 유지) | ✅ 승인 | 13px 렌더 시 획 두께 차 0.11px — 실질 비가시. 전면 통일은 I8 부채로 분리 |
| **J4** 📌 잔존 경로를 `components/viewer/`로 정정 | ✅ 승인(단 **유령 정정 — K3**) | 실제 경로는 `components/viewer/SvgViewer.tsx:286`·`GgbViewer.tsx:407` ✅. 다만 v6은 디렉터리를 적지 않았으므로 "editor로 오기"한 적이 없다. 결과적으로 전체 경로 명시는 유익 |
| **J5** `IconPin`에 `filled` prop | ✅ 승인 | `IconProps & { filled?: boolean }` 확장 유효. 켜짐 상태에서 내부 디테일이 사라져 덩어리가 되는 것은 상태 표시로 오히려 바람직 |
| **J1~J5 SVG 코드 4종** | ✅ **검증 통과** | `Icons.tsx`에 `IconExport`·`IconTag`·`IconPin`·`IconRestore` **이름 충돌 없음** ✅ · 4종 전부 24 viewBox·1.8·round·`aria-hidden` 규격 준수 ✅ · path 데이터 유효(Feather upload/tag, Lucide pin/history) ✅ |
| V1~V8 재검증 | ✅ 전부 승인 | v7 §0.2 판정 승계 |

### 0.2. v8 신규 발견 (K1~K6)

| # | 심각도 | 내용 |
|---|---|---|
| **K1** | 🔴 **문서 구조 회귀** | v7 §4가 v6 §4.1~4.7 전체(환경변수 표·frontmatter 사양·멱등성 규칙·실패 처리 표·비대응)를 **"그대로 승계" 한 줄 + 요약 단락**으로 대체했다. v7을 `docs/phasedocs/`에 최종본으로 두면 **구현자가 사양을 잃는다.** 착수본은 자립해야 한다 → **v8에서 §4 전량 재수록으로 해소** |
| **K2** | 🟠 | v7이 v6 §0.3 **누적 결함 색인표**를 삭제했다. 8라운드 60건을 구현 중 대조할 체크리스트가 사라짐 → **§0.3 복원·갱신** |
| **K3** | 🟢 | J4는 유령 정정(v6은 디렉터리를 적은 적이 없다). 경로 자체는 정확하므로 v8은 전체 경로로 표기 |
| **K4** | 🟢 | **J1 보강** — `IconExport`(트레이+상향)는 `IconDownload`(트레이+하향)와 **거울상**이다. 현재 두 아이콘은 동시 노출되지 않으므로(`ContextMenu` vs 버전 드로어) 문제없지만, **한 화면에 놓이면 즉시 혼동**이 된다. `Icons.tsx`에 주석으로 못박아 미래의 사고를 막는다 |
| **K5** | 🟢 | `filled` prop은 현재 `IconPin` 하나뿐인 상태 변형 패턴이다. 두 번째가 생기면 규약이 갈리므로 **`Icons.tsx`에 규약 주석 1줄**("상태 변형은 boolean prop + `fill` 스위치") |
| **K6** | 🟢 | `IconProps`에 `className`이 선언돼 있으나(`Icons.tsx:6`) 어느 아이콘도 받지 않는다. 신규 4종도 받지 않으므로 **일관성 유지** ✅ — 새로 받게 만들지 말 것 |

### 0.3. 누적 결함 색인 (구현 중 대조용 — K2 복원)

| 라운드 | 🔴 | 🟠 | 🟡 | 🟢 | 핵심 |
|---|---|---|---|---|---|
| v2 (E1~E9) | **E1** export 게이트가 `trigger`면 안 됨 · **E2** prune이 `name` 미보호 | E3 REST 전례 존재 · E8 경로 slug 제거 | — | E4~E7·E9 | 설계 근간 |
| v3 (W1~W9) | — | **W1** `exported_at`이 skip 자기모순 · W2→Y1 | W4 타입 누락 · W5 PUT 순서 | W3·W6~W9 | 멱등성 성립 |
| v4 (X1~X12, Y1) | **X1** content 출처 미명시 · **X2** 버튼 중첩 | X3 빈 레포 · X4 branch 누락 · X5 타임아웃 | X6 왕복 충실성 · X7 | X8~X12·Y1 | 배치 변경으로 🔴 2건 동시 해소 |
| v5 (Z1~Z6) | — | Z1 `selected` stale | Z2 자기모순 · Z3 idToken 출처 | Z4~Z6 | 상태 동기화 |
| v6 (V1~V8, I1~I8) | — | V1 Z1 적용범위 · I1 🐙 폐기 · I2 의미 충돌 | V4 REST 인증 전제 · I3~I5 | V2·V3·V5~V8·I6~I8 | 아이콘 축 개시 |
| v7 (J1~J5) | — | J1 export 도안 · J2 IconUndo 점유 | J5 | J3·J4 | 아이콘 코드 확정 |
| **v8 (K1~K6)** | **K1** 문서 자립성(본 파일에서 해소) | K2 색인표 | — | K3~K6 | 수렴 |

**착수 전 최종 확인 4건**: E1(게이트는 `name != null`) · E2(`prune.ts:22`에 `!v.name`) · X1(content는 `loadContent` 결과) · W1(md에 `exported_at` 없음). 이 넷이 깨지면 각각 "이름 붙인 버전 export 불가" / "원본 소실" / "전부 409" / "skip 영구 무효"가 된다.

### 0.4. 실측 좌표표

| 대상 | 위치 | 메모 |
|---|---|---|
| `VersionTrigger`(`'named'` 발화 0곳) | `types/version.ts:15` | G0 근거 |
| `ProblemVersion`(사후수정 주석) | `types/version.ts:49-67` | **W4** 필드 추가 지점 |
| `VersionBlock.type` "11종" 로제 주석 | `types/version.ts:26` | **Y1** 문구 수정 |
| `SnapshotResult` 4갈래 | `types/version.ts:74-78` | |
| 라이브 포인터 4필드 | `types/problem.ts:35-38` | |
| `Block['type']` 유니온 13개 | `types/problem.ts:158` | legacy 2종 포함 |
| `normalizeBlockType` | `EditorView.tsx:123-127` · 적용 `:1090`(로드)·`:2448`(저장) | **Y1** — 실 유입은 11종 |
| `createSnapshot(…, opts?)` | `lib/version/snapshot.ts:25-31` | |
| dedup 조기반환 | `snapshot.ts:37-39` | `!opts?.name && !opts?.pinned` |
| **`named_existing`**(기존 doc update, `trigger` 불변) | `snapshot.ts:62-71`(update 63-67, return 68) | **E1·E4·V1·X7 근거.** 대상은 `live.last_version_id`(최신본) |
| `created` 결과 id | `snapshot.ts:75`(`metaRef.id`)·`:95` | **V1** 자동 선택 재료 |
| **prune victim 조건** | `lib/version/prune.ts:22` | **E2** — `!v.name` 추가 대상 |
| prune 매핑 | `prune.ts:42` | `name` 추가 |
| `canonicalize`/`canonBlock`/`canonMeta` | `lib/version/canonicalize.ts:34-44`/`:16-31`/`:10-12` | 순수·결정적. 제외필드 주석 `:5`(W9) |
| `sha256`(`crypto.subtle`) | `lib/version/hash.ts:5-8` | 서버 shim(X12) |
| `toPersistedBlock`(undefined 미생성) | `lib/blocks/normalize.ts:29-50` | **X6 근거** |
| `loadContent` | `lib/version/read.ts:38-45` | **X1: content의 유일한 출처** |
| `versionsPage` doc 전개 | `lib/version/read.ts:30` | **Z2** — `github_export` 자동 전달 |
| `resolveLivingParent` getDoc 폴백 | `lib/version/read.ts:59` | **V8** |
| `collectCurrentContent` | `lib/version/adapter.ts:20-41` | `VersionLoadError` 가능 |
| `snapshotCurrent(trigger)` | `EditorView.tsx:2348-2364` | opts 확장 대상 |
| `createSnapshot` 호출부 ①② | `EditorView.tsx:2358`·`:2662` | 기존 호출 `:2478`(manual_save)·`:2505`(editor_exit) |
| `<VersionDrawer>` 마운트 | `EditorView.tsx:2707-2720` | props 배선 |
| Drawer props(user 부재) | `VersionDrawer.tsx:16-28` | **Z3** — `onNamedSave`·`onExport` 추가 |
| Drawer `selected` state·갱신 지점 | `VersionDrawer.tsx:30` / `:43`·`:48` | **Z1** — `sel` 파생으로 대체 |
| `vContent`·`contentLoading` | `VersionDrawer.tsx:31`·`:35` | **Z4** 게이트 재료 |
| 선택 시 payload 로드 | `VersionDrawer.tsx:47-61`(`loadContent` `:52`) | **X1 해법 성립** |
| Drawer 헤더 | `VersionDrawer.tsx:102-112` | 이름 저장 버튼 자리 |
| **선택 버전 툴바** | `VersionDrawer.tsx:128-143` | 조작 버튼 자리 |
| 타임라인 항목 `<button>` | `VersionTimeline.tsx:73-117` | **X2 근거** |
| `TRIGGER_ICON`(이모지 맵) | `VersionTimeline.tsx:8-13` | 컴포넌트 맵으로 교체 |
| 트리거 렌더 삼항 | `VersionTimeline.tsx:92-95` | **J1 근거**(IconExit 동일 줄) |
| 배지(name·📌) | `VersionTimeline.tsx:96-101` | 📌 → `IconPin` |
| "SVG/이모지 혼재" 자인 주석 | `VersionTimeline.tsx:7` | 갱신 대상 |
| `useVersionHistory`(갱신 API 없음) | `hooks/useVersionHistory.ts:7-42` | `patchVersion` 추가 |
| **아이콘 시스템**(39개·1.8×9/2×25) | `components/ui/Icons.tsx`(410행) | I4 |
| `IconSave`·`IconExit`(1.8·`aria-hidden`) | `Icons.tsx:190`·`:204` | 규격 기준 |
| **`IconUndo`(Phase 55a 점유)** | `Icons.tsx:89-96` · 사용처 `EditorView.tsx:2868` | **J2 근거** — restore 재사용 금지 |
| `IconRename`(굵기 2) | `Icons.tsx:159` · `ContextMenu.tsx:35` | 재사용 대상 |
| `IconShare`(공유 점유) | `Icons.tsx:391` · `ShareTree.tsx:101,123`·`ListView.tsx:59,62,65` | **I2** 금지 |
| `IconDownload`(MD 다운로드 점유) | `Icons.tsx:329` · `ContextMenu.tsx:37` | **I2** 금지 · **K4** 거울상 주의 |
| `IconProps`(`className` 미사용) | `Icons.tsx:3-7` | **K6** |
| versions 규칙 / **update 규칙** | `firestore.rules:144-166` / `:157-158` | Stage 2 확장 |
| payload 규칙(update 금지) | `firestore.rules:162-165` | |
| 서버 API 전례(nodejs·무인증) | `app/api/copyright/register/route.ts:6-7,13` · 에러 전면노출 `:60-79` | 따르지 말 것 |
| **Firestore REST 전례(비인증)** | `app/shared/[shareId]/page.tsx:15-22` | **V4** — 인증 변형은 미검증 |
| 규칙 테스트(466행·60번까지) | `tests/firestore.rules.test.mjs` | 신규 61~63 |
| roadmap 후속과제 문구 | `docs/roadmap.md:1295` | E9·W3 |
| 범위 밖 📌(**K3** 전체 경로) | `components/viewer/SvgViewer.tsx:286`·`GgbViewer.tsx:407` | J4 |
| 범위 밖 중복 정의 | `ContextMenu.tsx:7`(`IconDownload` 로컬) | I8 |

---

## 1. 진척상황·범위

**완료** ✅ Phase 55 자체 VCS(Stage 0~6) · Phase 55a 블록 Undo/Redo(Stage 1~4)

**이번 범위**: **G0**(named 저장·핀 UI — 발화 0곳) + **G0′**(prune `name` 미보호, E2) + **G1**(GitHub 단방향 export) + **아이콘 SVG 통일**(I·J)

**범위 제외(후속)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 `contributors[]` · G6 메타 편입 · G7 `step_label` · G8 전역 pruning · G9 원본인증 매핑(frontmatter `content_hash`로 연계 여지만 확보)

## 2. 목표·비목표

**목표**: `name != null` 버전을 별도 GitHub 콘텐츠 레포에 md + JSON으로 커밋하는 **단방향 내보내기**. 앱 외부의 영구 백업·이력 아카이브.

**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포 혼용 · 문항 삭제 시 레포 정리(의도적)

---

## 3. P0 — named 저장·핀 UI + prune 보호 + 아이콘

### 3.1 현황

모델·배지 렌더·규칙·규칙 테스트까지 전부 준비 완료. `trigger:'named'` / `opts.name` 발화만 **레포 전체 0곳**.

### 3.2 설계

**UI 배치 원칙 — 조작은 전부 "선택 버전 툴바", 타임라인은 표시 전용**

```
┌ VersionDrawer 헤더 (:102-112) ─────────────────────────────────────┐
│ 버전 기록        [IconTag 이름 저장]                           [×] │  ← (a) 스코프: 현재 작업본
├ 타임라인 (상호작용 무변경 · IconExport 배지 span 추가) ────────────┤
│ v7 Save 「중간안」 Pin Export   덕수      3분 전                    │  ← 표시 전용
│ v6 Exit                        덕수      1시간 전                  │
├ 선택 버전 툴바 (:128-143) ─────────────────────────────────────────┤
│ v7 [이전 버전과 비교] [Rename][Pin][Export]   [이 버전으로 복원]    │  ← (c)(d) 스코프: 선택 버전
├ diff ──────────────────────────────────────────────────────────────┤
```
*아이콘명은 `Icons.tsx` 컴포넌트(§3.5). **이모지는 쓰지 않는다**(I1).*

- **X2 해소** — 조작 버튼이 `<button>` 항목 **밖**이라 중첩·버블링이 원천 차단된다. `VersionTimeline`의 변경은 표시 전용 둘뿐: ① 내보냄 배지 span 추가(**새 props 없음** — `read.ts:30`의 전개로 `v.github_export`가 이미 실려 온다) ② 이모지 3종 → SVG(I5).
- **X1 해소** — 툴바가 뜬 시점 `vContent`는 `loadContent` 결과(`:52`). 편집 상태가 섞일 경로 없음.
- **Z1 해소** — 툴바·게이트·배지는 파생값을 읽는다:
  ```ts
  const sel = versions.find((x) => x.id === selected?.id) ?? selected;   // 렌더 시 1줄
  ```
  `patchVersion` 직후 별도 동기화 없이 즉시 반영. `selected`는 선택 앵커·`vContent` 로드 트리거로만 유지.
- **V3** — 두 조작의 스코프가 다르므로 툴팁으로 구분: 헤더 `현재 작업본에 이름 붙여 저장` / 툴바 `IconRename` → `이 버전의 이름 변경`.

**(a) 이름 저장 버튼** — 헤더. 클릭 → 인라인 `<input>` → Enter/확인.
- props `onNamedSave: (name: string) => Promise<SnapshotResult>` 추가. `EditorView.tsx:2707-2720`에서 `snapshotCurrent` 재사용해 전달.
- `snapshotCurrent`를 `(trigger, opts?)`로 확장 + `SnapshotResult` 반환(`:2348-2364`). 기존 호출부 `:2478`·`:2505`는 반환 무시 → 하위호환 ✅
- 한글 조합 Enter 이중발화: `e.nativeEvent.isComposing` 가드
- `getCurrentContent()`가 null(탭 로드 실패, `adapter.ts:29-31`) → 버튼 비활성 + 안내

**(b) `SnapshotResult` 4갈래 + 자동 선택 (V1)**

> ⚠️ **이름이 붙는 대상은 언제나 최신 버전이지 `selected`가 아니다.** 헤더 버튼은 현재 작업본을 스냅샷하므로, 변경이 있으면 새 버전이 생기고 없으면 `last_version_id`(최신본)에 name이 붙는다. 저장 직후 곧바로 내보내려면 **결과 버전을 자동 선택**해야 한다.

| status | 조건 | 처리 |
|---|---|---|
| `created` | 내용 변경 있음 → 새 버전(`trigger:'named'`) | "v{seq} 이름 저장됨" · `await loadFirst()` → **`handleSelect(result.version)`**(`snapshot.ts:95`) |
| `named_existing` | 내용 동일 + `lastId` 존재 → 기존 최신본에 name만 부착, `trigger` 불변(E1) | "기존 v{seq}에 이름을 붙였습니다" · `patchVersion(lastId, { name })` → **해당 버전 자동 선택**(`result.versionId`, `snapshot.ts:68`) |
| `unchanged` | 내용 동일 + `lastId` 부재 | 사실상 이론적 경로(포인터 해시는 있는데 id가 없는 비정상). 조용한 무반응 방지용 안내 유지 |
| `error` | authorUid 부재 / `lastId` doc이 실재하지 않아 `tx.update` throw(X7) | 에러 노출 |

자동 선택 직후 `versions` state가 아직 갱신 전이면 `resolveLivingParent`가 `getDoc` 폴백으로 돌아 왕복 1회만 추가된다(**V8** — 동작 정상).

**(c) 핀 토글 / 이름 변경·해제 / export 기록** — `createSnapshot` 경로로는 불가(E4: `snapshot.ts:65-66`이 `pinned:false`·name 삭제를 절대 쓰지 않음). `lib/version/meta.ts` 신설:
```ts
export const setVersionName   = (pid, vid, name: string | null)  => updateDoc(…, { name });
export const setVersionPinned = (pid, vid, pinned: boolean)      => updateDoc(…, { pinned });
export const setVersionExport = (pid, vid, ge: GithubExport)     => updateDoc(…, { github_export: ge });
```
`name`·`pinned`는 현행 규칙 통과(`firestore.rules:157-158`). `github_export`는 Stage 2 규칙 확장 후 동작 — **호출부는 Stage 5뿐이므로 순서 안전** ✅

**(d) 목록 갱신** — `useVersionHistory`에 `patchVersion(id, partial)` 추가(로컬 배열만). `created`일 때만 `loadFirst`. 매 변경 `loadFirst` 금지(`loadMore` 펼침 보존).

### 3.3 prune 보호 수정 (G0′ — E2)

```diff
- if (v.trigger === 'editor_exit' && !v.pinned) {          // prune.ts:22
+ if (v.trigger === 'editor_exit' && !v.pinned && !v.name) {
```
`selectPruneVictims` 입력 타입에 `name?: string | null`, `:42` 매핑에 `name: d.data().name` 추가. **G1보다 먼저.**

### 3.4 검증

1. 변경 있는 상태 이름 저장 → `IconTag`·이름 배지·`trigger==='named'` · **결과 버전 자동 선택(V1)**
2. **무변경 상태** 이름 저장 → `named_existing` · 최신본(`IconSave` 유지)에 이름 배지만 · `trigger` 불변 · **자동 선택(V1)**
3. **옛 버전을 선택한 채로** 이름 저장 → 이름은 **최신본**에 붙고 선택이 최신본으로 이동(V1 회귀 방지)
4. 핀 켜기/**끄기** 왕복 · 5. 이름 변경 → **해제(`null`)** 왕복
6. prune: `editor_exit` + 이름만 부착 → 51개 초과 → **살아남는지**
7. 툴바 클릭이 **버전 선택을 재발동시키지 않는지**(X2 회귀)
8. 한글 이름 입력 중 Enter 1회 = 커밋 1회 · 9. `permission-denied` 0

### 3.5 아이콘 SVG 통일 — **확정 코드**

**신규 4종 · 재사용 1종.** 전부 시스템 규격: viewBox 24 · `fill="none"`(`IconPin` filled 예외) · `stroke={color}` 기본 `currentColor` · `strokeWidth="1.8"`(I4) · round cap/join · `aria-hidden`(I7).

| 컴포넌트 | 용도 | 도안 | 근거 |
|---|---|---|---|
| **`IconExport`** 신설 | 툴바 내보내기 버튼 · 타임라인 내보냄 배지 | 트레이+상향 화살표(Feather `upload`) | I1·I2·**J1**(상자+화살표는 `IconExit`과 쌍둥이라 기각) |
| **`IconTag`** 신설 | 헤더 이름 저장 버튼 · `named` 트리거 | 태그(Feather `tag`) | I5(🏷️ 대체) |
| **`IconPin`** 신설 | 툴바 핀 토글 · 핀 배지 | 압정(Lucide `pin`) · **`filled` prop** | I3·I5·**J5**(📌 대체) |
| **`IconRestore`** 신설 | `restore` 트리거 | 시계+반시계 호(Lucide `history`) | I5·**J2**(↩️ 대체 · `IconUndo`는 `EditorView.tsx:2868` 점유) |
| `IconRename` **재사용** | 툴바 이름 변경 | 기존 그대로(굵기 2 혼재 허용 — J3) | I3 |

```tsx
// components/ui/Icons.tsx 끝에 추가
//
// 규약(K5): 아이콘의 상태 변형은 boolean prop + fill 스위치로 표현한다(IconPin의 filled 참조).
// 주의(K4): IconExport(트레이+상향)와 IconDownload(트레이+하향)는 거울상이다.
//           현재 두 아이콘은 동시 노출되지 않는다(ContextMenu vs 버전 드로어).
//           한 화면에 함께 놓아야 할 일이 생기면 둘 중 하나를 반드시 다시 디자인할 것.

export function IconExport({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7,8 12,3 17,8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconTag({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.2" fill={color} stroke="none" />
    </svg>
  );
}

export function IconPin({ size = 14, color = 'currentColor', filled = false }:
  IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1z" />
    </svg>
  );
}

export function IconRestore({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
```

**금지**: 이모지 신규 사용(I1) · `IconShare`·`IconDownload`·`IconUndo` 재사용(I2·J2 — 전부 의미 점유)
**크기**(I6): 타임라인 트리거 14 · 배지 12 · 툴바 버튼 13
**접근성**(I7): 아이콘만 있는 버튼에 `title` + `aria-label` 둘 다. `className` prop은 받지 않는다(K6 — 기존 39개와 일관)
**부수 변경**: `VersionTimeline.tsx:7` 주석 갱신 + `TRIGGER_ICON`(`:8-13`) 이모지 맵 → 컴포넌트 맵(`:92-95` 삼항 단순화) + `:101` 📌 → `IconPin`
**범위 밖**(I8·J4·K3): `ContextMenu.tsx:7` 로컬 중복 정의 · `strokeWidth` 전면 통일 · `components/viewer/SvgViewer.tsx:286`·`GgbViewer.tsx:407`의 📌 → `docs/prelaunch-bug-cleanup.md` 등록만
**검증**: 라이트/다크에서 신규 4종이 `IconSave`·`IconExit`과 획 굵기·시각 무게 일치 · **12px 배지에서 IconExport ↔ IconExit 구별 명확**(J1의 목적) · IconRestore ↔ IconUndo 구별 명확(J2) · 핀 on/off 구분 · 타임라인 한 줄 아이콘 4개에 460px 무너짐 없음 · **이모지 잔존 0**

---

## 4. G1 — GitHub 내보내기 설계 (전량 수록 — K1)

### 4.1 전체 흐름

```
[클라·Drawer] 선택 버전 툴바 IconExport 버튼
   게이트: sel.name != null && !contentLoading && vContent != null      ← Z1·Z4
   → onExport(sel.id, vContent)                          ← Z3 (X1: 절대 getCurrentContent 아님)
[클라·EditorView의 onExport]
   → POST /api/github/export
        Authorization: Bearer {await user.getIdToken()}                 ← W7
        body { problemId, versionId, content }
[서버] app/api/github/export/route.ts
        runtime='nodejs' · dynamic='force-dynamic' · maxDuration=30      ← X5
   1. Authorization 헤더를 Firestore REST로 릴레이:                      ← V4
      GET /v1/projects/{projectId}/databases/(default)/documents
            /problems/{problemId}/versions/{versionId}
      → 401/403은 그대로 반환 (검증 코드 0줄 — 규칙 verOwner가 대행)
      → name · seq · content_hash · created_at 확보
        ⚠ integerValue는 문자열 → Number() 필수
   2. name == null → 403                                                ← E1 (trigger 아님)
   3. canonicalize(content) → sha256 → content_hash 대조, 불일치 409     ← X6
      + block_key 결측·탭 내 중복 → 400 (클라 버그 조기 발견용)
   4. toMarkdown(content, { problemId, seq, name, contentHash, createdAt })  ← W1
   5. Contents API (전 요청 branch 지정 — X4):
        ① versions/{seq}.md  ② versions/{seq}.json  ③ index.md          ← W5
        파일별 GET → 동일 skip / 아니면 PUT (독립 판정 — X9)
        ③은 기존 index frontmatter version_seq ≤ 새 seq일 때만
           (파싱 실패 시 덮어씀 — W6)
   → 200 { commitUrl, commitSha, path, skipped, exportedAt }            ← X8·X11·Z5
[클라·Drawer] setVersionExport(problemId, versionId, { repo, path, commit_sha, exported_at })
   → patchVersion → sel 파생으로 배지·링크 즉시 갱신                     ← Z1·Z3
```

### 4.2 서버 API — `app/api/github/export/route.ts`

**R3 = (다)** 확정. (가) 무인증은 *임의 문자열이 덕수 레포에 커밋되는 공개 엔드포인트*라 `copyright/register`(해시 하나를 자기 지갑으로 보내는 것)와 위험 등급이 다르고, (나) `firebase-admin`은 과하다. (다)는 **의존성 0**으로 인증(규칙이 대행)과 무결성(해시 대조)을 동시에 얻는다.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;                        // X5

import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;   // X12 (실질 no-op, 무해)
```

- `canonicalize.ts`는 순수 TS라 서버 import 가능. `hash.ts`의 `sha256`도 위 shim 뒤엔 그대로 동작.
- **payload 전체를 REST로 읽지 않는다** — 중첩 `mapValue`/`arrayValue` 범용 디코더가 필요해져 코드가 길어진다. 서버가 디코딩하는 값은 **스칼라 4개**(`name`·`seq`·`content_hash`·`created_at`)뿐.
- **W9 잔여 위험은 X1로 소멸** — content가 `loadContent` 결과(= Firestore payload 원본)이므로 `block_key`가 조작될 경로 자체가 없다. 방어적으로 "`block_key`가 빈 문자열이거나 탭 내 중복이면 400" 한 줄만 둔다.
- **`title`·`answer`는 `content.meta`에서 온다** — `canonMeta`(`canonicalize.ts:10-12`)가 해시에 포함하므로 3번 대조로 함께 검증된다 ✅
- 요청 검증: 필수 4개(헤더 1 + body 3) · `JSON.stringify(content).length > 4MB` → 413.

**V4 · 전제와 컨틴전시** — 이 설계는 **Firestore REST가 Firebase Auth ID 토큰을 `Authorization: Bearer`로 받아 보안 규칙을 평가한다**는 표준 동작에 의존한다. 같은 엔드포인트를 비인증으로 쓰는 전례는 있으나(`app/shared/[shareId]/page.tsx:15-22`) **인증 변형은 이 레포에서 처음**이다. Stage 4 검증 2번에서 오너 토큰 200 / 타인 토큰 403을 반드시 확인하고, **실패하면 폴백은 R3-(나) `firebase-admin`**(서비스계정 키 env 추가). 그 경우에도 §4.4~4.6은 그대로 재사용된다.

### 4.3 환경변수 (전부 서버 전용 — `NEXT_PUBLIC_` 금지)

| 이름 | 값 | 비고 |
|---|---|---|
| `GITHUB_EXPORT_TOKEN` | fine-grained PAT | **콘텐츠 레포 1개 한정 · Contents: Read and write만** · 만료일 설정 |
| `GITHUB_CONTENT_REPO` | `kimdeoksoo-71/mathory-content` | private (R5) |
| `GITHUB_CONTENT_BRANCH` | `main` | **모든 요청에 실을 것**(X4). 미설정 시 기본 `main` |

재사용: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. 로컬 `.env.local`(`.gitignore` 등록 ✅) + **Vercel 대시보드 수동 등록**. PAT 만료 → 401 → "`GITHUB_EXPORT_TOKEN` 갱신 필요"로 원인 특정.
🔒 **PAT 값은 채팅에 붙여넣지 않는다.**

### 4.4 레포 레이아웃·변환

```
problems/{problemId}/
  index.md                # 최대 seq named 버전 미러 + 안내 주석(frontmatter 종료 뒤 — X10)
  versions/{seq:04d}.md   # slug 없음(E8 — 이름은 사후 변경 가능)
  versions/{seq:04d}.json # VersionContent 원본(무손실)
```

**`lib/version/exportMd.ts`** — 순수·결정적(같은 입력 = 같은 바이트):
```ts
export function toMarkdown(c: VersionContent, meta: {
  problemId: string; seq: number; name: string;
  contentHash: string; createdAt: string;   // W1: 버전 생성 시각(불변). exported_at 없음
}): string
```

- **frontmatter 7필드**: `problem_id` · `version_seq` · `version_name` · `content_hash` · `created_at` · `title` · `answer`
  - **`exported_at` 없음**(W1) — 있으면 md가 매번 달라져 skip이 영구 무효화된다. export 시각은 version doc의 `github_export.exported_at`에만 기록
  - 전 값 `JSON.stringify()` 인용(YAML 이스케이프: `:` `#` `"` 개행) · 종료 `---` 뒤 빈 줄 1개(raw_text 첫 줄 `---` 오인 방지)
- **본문**: 탭별 `## {tab.title}` → `order` 순 `raw_text`(사이 빈 줄 1) · 블록 `title` 있으면 `### {title}` 선행 · 블록 앞 `<!-- block: {type} -->`
  - **타입별 분기 없음** — 전 타입 `raw_text` 그대로. 실 유입 11종, legacy 2종(`math_block`·`bullet`)도 통과(Y1). 렌더 재현은 비목표
- **이미지**: Storage URL 참조(R4)
- **index.md**: 해당 버전 md와 동일 + **frontmatter 종료 뒤** 안내 주석 1줄(X10)
  `<!-- 이 파일은 versions/{seq}.md의 미러입니다. 이미지는 Firebase Storage URL을 참조하므로 레포 단독으로는 표시되지 않을 수 있습니다. -->`
- **JSON**: `JSON.stringify(content, null, 2) + '\n'` 고정
- **부수 정정**: `types/version.ts:26` 주석 → Y1 문구
  ```ts
  type: Block['type'];   // 실 유입 11종. 레거시 math_block·bullet은 normalizeBlockType으로 text 정규화 후 들어온다
  ```

### 4.5 멱등성·기록

- **PUT 전 GET**(`?ref={branch}` — X4): 404 → sha 없이 생성 / 200 → base64 비교, **동일하면 skip**
  - 1MB 초과는 응답 `content`가 비므로 git blob sha 비교: `sha1("blob " + byteLen + "\0" + content)`
  - base64는 `Buffer.from(s, 'utf8').toString('base64')`(한글) · PUT body에 `branch` 포함
- **W1 효과**: 무변경 재내보내기 = 3파일 전부 skip = **커밋 0**. 이름 변경 시에만 frontmatter가 달라져 재커밋(의도)
- **순서**(W5): `{seq}.md` → `{seq}.json` → `index.md`(항상 마지막) · **skip은 파일별 독립**(X9)
- **index 역행 방지**: 기존 frontmatter `version_seq` 파싱 → 새 seq ≥ 기존일 때만 갱신 · **파싱 실패 시 덮어씀**(W6, 미러 원칙)
- **커밋 메시지**(W8 + V5 위생):
  - 버전 파일 `export: {safeTitle} v{seq} — {name} ({contentHash.slice(0,8)})`
  - index `export: index → v{seq} ({problemId})`
  - `safeTitle = title.replace(/\s+/g, ' ').trim().slice(0, 60)` — 개행이 섞이면 커밋 제목줄이 본문으로 쪼개진다
- **응답**(X8·X11·Z5): `exportedAt` = 서버 시각. `skipped: true`는 **3파일 전부 skip일 때만**이며 이때 `commitUrl: null`. 일부만 커밋됐으면 `commitUrl`은 **md → json → index 우선순위의 첫 비-skip 커밋**
- **기록**: Drawer가 `setVersionExport`(Z3) → `patchVersion`
  - **W4 타입**(`types/version.ts:50-67`) — **Stage 1에 배치**(V2):
    ```ts
    github_export?: { repo: string; path: string; commit_sha: string; exported_at: string } | null;
    ```
    `:49` 주석도 "사후 수정은 name·pinned·github_export만"으로 갱신. `createSnapshot`의 meta 리터럴(`snapshot.ts:74-83`)은 optional이라 무변경 ✅
- **규칙 확장**: `firestore.rules:158` `hasOnly(['name','pinned'])` → `+ 'github_export'`. `affectedKeys()`는 최상위 키만 보므로 중첩 map 통과. **F3 교훈 — Stage 2 단독·선배포**
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
| 레포/브랜치 부재 | 404 | "콘텐츠 레포 또는 브랜치를 찾을 수 없습니다: {repo}@{branch}" (**X3 미초기화가 여기로 나온다**) |
| blob sha 충돌 | 409 | sha 재조회 후 **1회 자동 재시도**, 재실패 시 surface |
| 본문 과대 | 413 | "버전 본문이 너무 큽니다" |

에러 메시지는 **화이트리스트 구성** — 원본 에러 객체를 그대로 흘리지 않는다(`copyright/register:60-79`의 전면 노출 패턴을 따르지 말 것).

### 4.7 명시적 비대응

- 문항·버전 삭제 시 레포 정리 없음(아카이브 취지)
- GitHub 쪽 수동 편집은 다음 export가 덮어씀(미러)
- **V6**: 버전 이름을 바꾼 뒤 재내보내기 전까지 **레포는 구 이름을 유지한다.** 수동 트리거(R2) + 미러 원칙의 귀결이며 의도된 동작 — "동기화 누락"이 아니다

---

## 5. 구현 순서 (Stages)

**Stage 0 · 준비**
- §0.4 좌표 재실측(HEAD 이동 시)
- 덕수: **비공개** 레포 `mathory-content` 생성 시 **"Add a README" 체크**(Z6 — 빈 레포면 첫 PUT이 404, X3) → fine-grained PAT 발급(해당 레포 1개·Contents RW) → `.env.local` + **Vercel env 수동 등록**
- 🔒 PAT 값은 채팅에 붙여넣지 않는다

**Stage 1 · P0 (§3)** — 규칙 변경 없음, 독립 배포
- **1a 아이콘(§3.5)**: `Icons.tsx`에 `IconExport`·`IconTag`·`IconPin`·`IconRestore` 신설(확정 코드 그대로) + K4·K5 주석 → `VersionTimeline`의 `TRIGGER_ICON`(`:8-13`) 컴포넌트 맵 교체 · `:101` 📌 → `IconPin` · `:7` 주석 갱신. **이모지 잔존 0 확인**
- **1b 기능**: named/핀 UI · `meta.ts` 헬퍼 3개 · **`ProblemVersion.github_export` 타입(V2)** · `patchVersion` · **`sel` 파생(Z1)** · **결과 버전 자동 선택(V1)** · 내보냄 배지 span(Z2) · **prune `!v.name`(G0′)**
- 검증: §3.4 9항목 + §3.5 아이콘 검증

**Stage 2 · 규칙 확장 (§4.5)** — **단독 커밋 · 선배포**
- `test:rules` 61(`github_export` 단독 허용) · 62(`name` 동반 허용) · 63(`content_hash` 동반 거부). 기존 60건 회귀 0

**Stage 3 · 변환기** — `lib/version/exportMd.ts` + `types/version.ts:26` 주석(Y1)
- 검증: 실사용 11종 + legacy 2종 방어 · 다중 탭 · `---`로 시작하는 raw_text · `:`·개행 포함 제목 · **동일 입력 2회 → 바이트 동일**(W1)

**Stage 4 · 서버 API**
1. **(최우선, X6)** 실데이터 1건으로 `loadContent` → `canonicalize` → `sha256` == 저장된 `content_hash` 확인. 깨지면 모든 export가 409로 죽으므로 여기서 멈춘다
2. **(V4)** 오너 idToken으로 Firestore REST GET 200 / 타인 토큰 403 — **인증 전제 성립 확인. 실패 시 R3-(나)로 전환**
3. curl: 성공 / 헤더 누락 401 / 이름 없음 403 / 해시 변조 409 / `block_key` 손상 400 / 레포 부재 404 / **동일 내용 재요청 `skipped:true`·커밋 0** / 응답 토큰 미노출 / 브랜치 반영(X4)

**Stage 5 · UI 배선 + E2E**
- 툴바 `IconRename`·`IconPin`·`IconExport`(게이트 Z1·Z4 · 툴팁 V3) + 타임라인 내보냄 배지
- E2E: 이름 저장 → 내보내기 → 파일 3개 → **무변경 재내보내기 커밋 0** → 수정 후 새 named 내보내기(index 갱신) → **이름 변경 후 재내보내기(같은 경로 갱신·유령 파일 없음 — E8)** → **낮은 seq 내보내기(index 역행 없음)** → `github_export` 기록·링크 → **툴바 클릭이 선택 재발동 없음(X2)** → **옛 버전 선택 상태에서 이름 저장 시 선택이 최신본으로 이동(V1)** → **payload 로드 전 내보내기 버튼 비활성(Z4)**

**문서** — roadmap Phase 55b 기재 + `:1295` "(Phase 56+ 별도)" → "(Phase 55b)" 정정(E9·W3) + `docs/prelaunch-bug-cleanup.md`에 I8·J4 부채 등록. 본 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 툴바 버튼만 제거. 규칙 확장은 상위호환.

---

## 6. 확정된 결정 (재론 불요)

| # | 결정 |
|---|---|
| R1 | **md + json 병행** — md는 사람용, json은 무손실 재현·복원 여지 |
| R2 | **수동 버튼만** — named 생성 시 자동 export는 하지 않음 |
| R3 | **(다) idToken 릴레이 + Firestore REST 메타 읽기 + 해시 대조** — 의존성 0, 인증은 규칙(verOwner)이 대행. **폴백 (나) firebase-admin**(V4) |
| R4 | **Storage URL 참조만** — 레포 동봉은 후속 |
| R5 | **`kimdeoksoo-71/mathory-content` · 비공개(private)** — frontmatter에 `answer`, 본문 전체가 평문 |
| R6 | **자동 핀 없음** — §3.3 prune 수정으로 `name` 단독 보호가 성립 |
| R7 | **아이콘 전부 SVG 통일**(덕수 2026-08-15) — §3.5 확정 코드 |

---

## 부록 A. v8 실측 기록 (`f311121` · CLI 직접 확인)

- **A-1.** **`IconUndo`는 `EditorView.tsx:2868`(Phase 55a 블록 Undo 버튼)이 점유 중** — `Icons.tsx:89-96` 정의, `EditorView.tsx:52` import. → **J2 승인 근거.** 도안도 다르다(좌향 화살표+갈고리 vs 시계+반시계 호)
- **A-2.** `Icons.tsx`에 `IconExport`·`IconTag`·`IconPin`·`IconRestore` **이름 충돌 없음** ✅ (grep 확인)
- **A-3.** 📌 잔존 3곳 실측: `components/viewer/GgbViewer.tsx:407` · `components/viewer/SvgViewer.tsx:286` · `components/version/VersionTimeline.tsx:101`. 앞 둘은 "초기뷰 저장" 라벨로 **범위 밖**(J4·K3)
- **A-4.** `IconProps`(`Icons.tsx:3-7`)에 `className`이 선언돼 있으나 39개 아이콘 중 실제로 받는 것은 없다 → 신규 4종도 받지 않아 일관(**K6**)
- **A-5.** `VersionTimeline.tsx:92-95`에서 `IconExit`이 트리거 자리에 렌더 → export 배지가 같은 줄에 서므로 "상자+화살표" 도안 기각(**J1**)이 타당
- **A-6.** `IconDownload:329`는 Feather `download`(트레이+하향) → `IconExport`(트레이+상향)와 **거울상**. 현재 동시 노출 없음(`ContextMenu.tsx:37` vs 버전 드로어) → **K4 주석으로 못박음**
- **A-7.** `read.ts:30` `{ id, ...d.data() }` 전개 → `github_export` 자동 전달(Z2, 새 props 불필요) · `read.ts:59` `getDoc` 폴백(V8) — 재확인
- **A-8.** `snapshot.ts:62-68` `named_existing` 대상 = `live.last_version_id`(최신본) — **V1 근거** 재확인
- **A-9.** E·W·X·Y·Z·V·I·J의 근거 좌표 전량 v4~v7 기재와 일치 → 승계. §0.4에 단일 표로 통합
