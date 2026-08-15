# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v6 (착수본)**

작성일: 2026-08-15 · 작성: CLI Claude (Opus 5) · 기준 커밋: `f311121` (HEAD 일치 재확인 ✅)
계보: v1(web) → v2(CLI, E1~E9) → v3(web, W1~W9 + R1~R6 확정) → v4(CLI, X1~X12·Y1) → v5(web, Z1~Z6) → **v6(CLI 4차 검증 — Z 판정 + 신규 V1~V8)**

> **본 문서의 위상** — v5의 Z1~Z6을 실코드로 재검증(6건 전부 승인, **Z1은 적용 범위 보정 필요 — V1**)하고, v5에도 남아 있던 8건(V1~V8)을 교정한 뒤, **덕수가 제기한 아이콘 정비(I1~I8, §0.2.5·§3.5)를 신설**한 통합본. **web Claude의 v7 검토 대상.**
> §0은 누적 결함 대장(E·W·X·Y·Z·V·I 전량), §1 이하가 구현 본문. 착수 시 HEAD가 `f311121`에서 이동했다면 §0.4 좌표 재실측 먼저.
>
> **수렴 판단**: 여섯 라운드 누적 49건. 🔴 4건(E1·E2·X1·X2)은 모두 3회 이상 교차 확인됐고, 설계 검토 축(V1~V8)에서는 **처음으로 🔴이 나오지 않았다**(🟠1/🟡1/🟢6) — 이 축은 수렴한 것으로 본다. 반면 **아이콘 축(I1~I8)은 이번에 처음 열렸으므로 미수렴**이며, v7의 주 검토 대상은 §3.5다.
>
> **v7 검토 요청 사항**: ① §3.5의 신규 아이콘 4개 도안 방향이 기존 39개와 어울리는지 ② `IconRename` 재사용(굵기 2)과 신규 4개(굵기 1.8)가 한 툴바에 섞이는 것을 허용할지, 아니면 신규도 2로 갈지(I4 재론) ③ `IconTag`까지 넣어 이모지를 전멸시키는 범위가 과한지 ④ V1~V8 재검증.

---

## 0. 누적 결함 대장

### 0.1. v5 검증 결과 (Z1~Z6)

| # | 판정 | 근거 |
|---|---|---|
| **Z1** `selected`가 별도 state라 stale | ✅ **승인 — v5 최대 성과** | `VersionDrawer.tsx:30` 별도 state, 갱신 지점은 `:43`(open 초기화)·`:48`(선택)뿐. `patchVersion`이 `versions[]`만 고쳐도 `selected`는 구 객체로 남는다. `sel` 파생 1줄 해법 타당 |
| | ⚠️ **단, 적용 범위 보정 → V1** | v5 §3.2(b)·§3.4-2의 "이름 저장 직후 재선택 없이 🐙 게이트 열림"은 **`selected`가 우연히 최신본일 때만** 참이다. 헤더 이름 저장이 이름을 붙이는 대상은 언제나 **최신 버전**이지 `selected`가 아니다 |
| **Z2** v4의 "타임라인 무변경" 자기모순 | ✅ 승인 | `VersionTimeline.tsx:96-101`은 `name`·📌만 렌더. 🐙는 신규. **다만 새 props는 필요 없다** — `v.github_export`가 이미 버전 객체에 실려 온다(`read.ts:30` 전개) → 표시 전용 span 1개, 상호작용 무변경 |
| **Z3** export의 idToken 출처 미명시 | ✅ 승인 | Drawer props(`:16-28`)에 `user` 없음. `onNamedSave`와 대칭인 `onExport` 주입이 자연스럽다 |
| **Z4** payload 로드 전 클릭 가드 | ✅ 승인 | `contentLoading`(`:35`)·`vContent`(`:31`) 둘 다 이미 존재 → 게이트 조건에 그대로 사용 가능 |
| **Z5** 부분 skip 시 `commitUrl` | ✅ 승인 | X11의 엣지 보완 타당 |
| **Z6** README 체크박스로 간소화 | ✅ 승인 | X3의 절차만 가벼워짐. 효과 동일 |

### 0.2. v6 신규 발견 (V1~V8)

| # | 심각도 | 내용 |
|---|---|---|
| **V1** | 🟠 **흐름 오류(Z1 보정)** | 헤더 "이름 저장"은 **현재 작업본**을 스냅샷한다. 따라서 이름이 붙는 대상은 **항상 최신 버전** — `created`면 새로 만든 버전, `named_existing`이면 `problem.last_version_id`가 가리키는 최신본(`snapshot.ts:63-68`). **`selected`와는 무관하다.** v5가 기대한 "저장 직후 툴바 게이트 개방"은 우연히 최신본을 선택 중일 때만 일어난다. → **해법: 성공 시 결과 버전을 자동 선택.** 두 갈래 모두 id를 준다(`created`→`result.version.id` `snapshot.ts:75,95`, `named_existing`→`result.versionId` `:68`) → `await loadFirst()` 후 해당 버전으로 `handleSelect`. Z1의 `sel` 파생은 핀·이름 변경(둘 다 `selected` 대상)에 여전히 필요하므로 **함께 유지** |
| **V2** | 🟢 Stage 순서 | v5 Stage 1이 `meta.ts` 헬퍼 3개(`setVersionExport` 포함)를 넣는데, 그 인자 타입 `GithubExport`(W4)는 Stage 3에 배치돼 있다 → **`ProblemVersion.github_export` 타입 추가를 Stage 1로 이동**(타입 선언뿐이라 무해). Stage 3은 `exportMd.ts` + Y1 주석만 남는다 |
| **V3** | 🟢 UX 모호 | 같은 드로어에 **스코프가 다른 두 조작**이 공존한다 — 헤더는 "현재 작업본", 툴바는 "선택 버전". 라벨로 구분: 헤더 툴팁 `현재 작업본에 이름 붙여 저장`, 툴바 ✏️ 툴팁 `이 버전의 이름 변경` |
| **V4** | 🟡 검증 전제 + 컨틴전시 | (다)안의 대전제 — **Firestore REST가 Firebase Auth ID 토큰을 `Authorization: Bearer`로 받아 보안 규칙을 평가한다.** 표준 동작이고 `app/shared/[shareId]/page.tsx:15-22`가 같은 엔드포인트를 (비인증으로) 이미 쓰므로 URL·네트워크 경로는 검증됐지만 **인증 변형은 이 레포에서 처음**이다. Stage 4 검증 2번(오너 토큰 200 / 타인 토큰 403)에서 확인하고, **실패 시 폴백은 R3-(나) firebase-admin**임을 미리 명시 |
| **V5** | 🟢 커밋 메시지 위생 | W8의 `{title}`은 `content.meta.title` 원문이라 **개행·과길이**가 들어올 수 있다. 개행이 섞이면 커밋 제목줄이 본문으로 쪼개진다 → `title.replace(/\s+/g, ' ').trim().slice(0, 60)` |
| **V6** | 🟢 명확화 | **이름 변경 후 재내보내기 전까지 레포는 구 이름을 유지한다.** 수동 트리거(R2) + 미러 원칙(§4.7)의 귀결이며 의도된 동작 — §4.7에 명기해 "동기화 누락" 오인을 막는다 |
| **V7** | 🟢 표기 | v4·v5 흐름도의 REST 경로에서 `{pid}`가 **프로젝트 id와 문항 id 양쪽**에 쓰여 혼동을 준다 → `{projectId}` / `{problemId}`로 분리 표기 |
| **V8** | 🟢 정보 | V1의 자동 선택에서 `await loadFirst()` 직후 `versions` state는 아직 갱신 전일 수 있다. `handleSelect`가 `versions`를 `resolveLivingParent`에 넘기므로 stale이면 **직접 `getDoc` 폴백**(`read.ts:59`)이 돌아 왕복 1회가 추가될 뿐 동작은 정상 |

### 0.2.5. 아이콘 정비 (I1~I8) — 덕수 제기, v6 신규

> v4~v6이 내보내기 표시로 **🐙(문어 이모지)**를 쓴 것은 잘못이다. 이 프로젝트에는 이미 SVG 아이콘 시스템(`components/ui/Icons.tsx`, 39개)이 있고, VersionTimeline은 그 규격을 **부분적으로만** 따르고 있다(`:7` 주석이 그 사실을 자인). 상세 설계는 §3.5.

| # | 심각도 | 내용 |
|---|---|---|
| **I1** | 🟠 | **🐙 폐기.** GitHub 옥토캣 연상이지만 실제로는 문어 이모지이고, 플랫폼별(Apple/Windows/Android) 글리프가 제각각이며 흑백 UI 톤에 컬러 이모지가 튄다. `Icons.tsx` 규격 SVG로 대체 |
| **I2** | 🟠 | **`IconShare`·`IconDownload` 재사용 금지 — 의미가 이미 점유됐다.** `IconShare`는 공유 링크·공유받기 해제(`ShareTree.tsx:101,123` · `Sidebar.tsx:12` · `ListView.tsx:59,62,65`), `IconDownload`는 "MD 다운로드"(`ContextMenu.tsx:37`). 내보내기에 돌려쓰면 기존 의미와 충돌 → **신규 `IconExportRepo` 필요** |
| **I3** | 🟡 | **신규 4개 · 재사용 1개**(§3.5 표). 내보내기 · 핀(📌 대체) · 복원(↩️ 대체) · 태그(🏷️ 대체) — 넷째까지 넣어야 이모지가 전멸한다(I5). **이름 변경은 `IconRename` 재사용**(`ContextMenu.tsx:35`가 이미 "이름 변경"으로 점유 → 의미 일치) |
| **I4** | 🟡 | **`strokeWidth`가 1.8/2로 혼재**(파일 전체 1.8이 9곳, 2가 25곳). 다수는 2지만, 신규 아이콘이 나란히 서는 상대는 `IconSave`·`IconExit`(둘 다 **1.8**, `:190`·`:204`)다 → **1.8 채택**(Phase 52·53 계열과도 일치) |
| **I5** | 🟡 | **VersionTimeline 이모지/SVG 혼재를 이번에 끝낸다.** 배지 1개만 SVG로 넣으면 같은 줄에 `🏷️`·`📌`·SVG가 섞여 더 어색해진다. `named`(🏷️)·`restore`(↩️)·`pinned`(📌)를 전부 SVG화하면 **이모지 전멸** — 신규 3개면 끝나므로 비용이 작다. `VersionTimeline.tsx:7` 주석도 갱신 |
| **I6** | 🟢 | **크기**: 타임라인 트리거 아이콘 14(`IconSave size={14}` 기존값), 배지 12, 툴바 버튼 13(폰트 11px 줄에 맞춤) |
| **I7** | 🟢 | **접근성**: 신규 SVG에 `aria-hidden`(`IconSave`·`IconExit` 선례) + 부모 `<button>`에 `title`. 아이콘만 있는 버튼은 `aria-label` 필수 |
| **I8** | 🟢 | **기존 부채(범위 밖)**: `ContextMenu.tsx:7`에 `IconDownload`가 **로컬 중복 정의**돼 있다(`Icons.tsx:329`와 별개 구현). 이번 Phase에서 건드리지 말고 `docs/prelaunch-bug-cleanup.md` 후보로만 등록 |

### 0.3. 누적 결함 색인 (구현 시 체크리스트)

| 라운드 | 🔴 | 🟠 | 🟡 | 🟢 | 핵심 |
|---|---|---|---|---|---|
| v2 (E1~E9) | E1 export 게이트가 `trigger`면 안 됨 · E2 prune이 `name` 미보호 | E3 REST 전례 존재 · E8 경로 slug 제거 | — | E4~E7·E9 | 설계 근간 2건 |
| v3 (W1~W9) | — | W1 `exported_at`이 skip 자기모순 · W2→Y1 | W4 타입 누락 · W5 PUT 순서 | W3·W6~W9 | 멱등성 성립 |
| v4 (X1~X12, Y1) | X1 content 출처 미명시 · X2 버튼 중첩 | X3 빈 레포 · X4 branch 누락 · X5 타임아웃 | X6 왕복 충실성 · X7 | X8~X12·Y1 | 배치 변경으로 🔴 2건 동시 해소 |
| v5 (Z1~Z6) | — | Z1 `selected` stale | Z2 자기모순 · Z3 idToken 출처 | Z4~Z6 | 상태 동기화 |
| **v6 (V1~V8)** | **—** | **V1 Z1 적용범위 보정** | **V4 REST 인증 전제** | V2·V3·V5~V8 | 수렴 |
| **v6 (I1~I8, 덕수 제기)** | **—** | **I1 🐙 폐기 · I2 아이콘 의미 충돌** | I3~I5 신규 아이콘·규격·이모지 정리 | I6~I8 | 아이콘 시스템 편입 |

---

## 0.4. 실측 좌표표

v4 §0.2 + v5 §0.2 전 항목 v6 재확인 ✅. 이번 라운드 추가·강조분:

| 대상 | 위치 | 메모 |
|---|---|---|
| Drawer `selected` state·갱신 지점 | `VersionDrawer.tsx:30` / `:43`(open 초기화) `:48`(선택) | **Z1 근거** — `sel` 파생으로 대체 |
| `contentLoading` · `vContent` | `VersionDrawer.tsx:35` / `:31` | **Z4** 게이트 재료(기존 state 그대로) |
| 선택 시 payload 로드 | `VersionDrawer.tsx:47-61` (`loadContent` `:52`) | **X1 해법 성립** |
| 선택 버전 툴바 | `VersionDrawer.tsx:128-143` | 조작 버튼 배치 지점 |
| Drawer props(user 부재) | `VersionDrawer.tsx:16-28` | **Z3** — `onNamedSave`·`onExport` 추가 |
| 타임라인 항목 `<button>` | `VersionTimeline.tsx:73-117` | **X2 근거** — 상호작용 무변경 |
| 타임라인 배지(name·📌만) | `VersionTimeline.tsx:96-101` | **Z2** — 내보냄 배지 span 1개 추가, 새 props 불필요 |
| `versionsPage` 전개 | `lib/version/read.ts:30` | `github_export`가 자동 실려 옴 |
| `resolveLivingParent` getDoc 폴백 | `lib/version/read.ts:59` | **V8** |
| `created` 결과 id | `snapshot.ts:75`(`metaRef.id`) · `:95` | **V1** 자동 선택 재료 |
| `named_existing` 결과 id | `snapshot.ts:68`(`versionId: lastId`) | **V1** — 대상은 **최신본**, `selected` 아님 |
| `normalizeBlockType` 게이트 | `EditorView.tsx:123-127` / 적용 `:1090`·`:2448` | **Y1** |
| `toPersistedBlock` optional 조건부 | `lib/blocks/normalize.ts:33-47` | **X6** 근거 |
| `canonMeta`(title·answer 해시 포함) | `lib/version/canonicalize.ts:10-12` | frontmatter title·answer도 대조로 검증됨 |
| Firestore REST 전례 | `app/shared/[shareId]/page.tsx:15-22` | **V4** — 비인증 변형만 검증됨 |
| versions update 규칙 | `firestore.rules:157-158` | Stage 2 확장 대상 |
| roadmap 후속과제 문구 | `docs/roadmap.md:1295` | W3 |
| **아이콘 시스템**(39개·24×24·`fill=none`·`stroke=currentColor`) | `components/ui/Icons.tsx` (410행) | **I1~I7** |
| `IconSave` · `IconExit` (strokeWidth **1.8** · `aria-hidden`) | `Icons.tsx:190` · `:204` | **I4·I7** 규격 기준 |
| `IconRename` (strokeWidth 2) | `Icons.tsx:159` · 사용처 `ContextMenu.tsx:35` | **I3** 재사용 대상 |
| `IconShare` (의미 점유: 공유) | `Icons.tsx:391` · `ShareTree.tsx:101,123` `ListView.tsx:59,62,65` | **I2** 재사용 금지 |
| `IconDownload` (의미 점유: MD 다운로드) | `Icons.tsx:329` · `ContextMenu.tsx:37` | **I2** 재사용 금지 |
| 타임라인 이모지 3종 | `VersionTimeline.tsx:11`(🏷️) `:12`(↩️) `:101`(📌) | **I5** 대체 대상 |
| "SVG/이모지 혼재" 자인 주석 | `VersionTimeline.tsx:7` | **I5** 갱신 대상 |
| `IconDownload` 로컬 중복 정의 | `ContextMenu.tsx:7` | **I8** 범위 밖(부채 등록만) |

---

## 1. 진척상황·범위

**완료** ✅ Phase 55 자체 VCS(Stage 0~6) · Phase 55a 블록 Undo/Redo(Stage 1~4)

**이번 범위**: **G0**(named 저장·핀 UI — 발화 0곳) + **G0′**(prune `name` 미보호, E2) + **G1**(GitHub 단방향 export)

**범위 제외(후속)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 `contributors[]` · G6 메타 편입 · G7 `step_label` · G8 전역 pruning · G9 원본인증 매핑(frontmatter `content_hash`로 연계 여지만 확보)

---

## 2. 목표·비목표

**목표**: `name != null` 버전을 별도 GitHub 콘텐츠 레포에 md + JSON으로 커밋하는 **단방향 내보내기**. 앱 외부의 영구 백업·이력 아카이브.

**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포 혼용 · 문항 삭제 시 레포 정리(의도적)

---

## 3. P0 — named 저장·핀 UI + prune 보호

### 3.1 현황

모델·배지 렌더·규칙·규칙 테스트까지 전부 준비 완료. `trigger:'named'` / `opts.name` 발화만 **레포 전체 0곳**.

### 3.2 설계 (X1·X2 + Z1~Z4 + V1·V3)

**UI 배치 원칙 — 조작은 전부 "선택 버전 툴바", 타임라인은 표시 전용**

```
┌ VersionDrawer 헤더 (:102-112) ─────────────────────────┐
│ 버전 기록        [Tag  이름 저장]                  [×] │  ← (a) 스코프: 현재 작업본
├ 타임라인 (상호작용 무변경 · ExportRepo 표시 span 추가) ─┤
│ v7 Save 「중간안」 Pin Repo   덕수      3분 전          │  ← 표시 전용 (Z2)
│ v6 Exit                      덕수      1시간 전        │
├ 선택 버전 툴바 (:128-143) ─────────────────────────────┤
│ v7 [이전 버전과 비교] [Rename][Pin][ExportRepo]  [이 버전으로 복원] │  ← (c)(d) 스코프: 선택 버전
├ diff ──────────────────────────────────────────────────┤
```
*아이콘 명은 `Icons.tsx`의 컴포넌트를 가리킨다(§3.5). **이모지는 쓰지 않는다** — I1.*

- **X2 해소** — 조작 버튼이 `<button>` 항목 밖 → 중첩·버블링 원천 차단. `VersionTimeline.tsx`는 **상호작용 무변경**이며, 변경은 표시 전용 두 가지뿐: ① 내보냄 배지 span 1개 추가(새 props 없음 — `v.github_export`가 이미 실려 온다) ② 이모지 3종 → SVG 교체(I5).
- **X1 해소** — 툴바가 뜬 시점 `vContent`는 `loadContent` 결과(`:52`). 편집 상태가 섞일 경로 없음.
- **Z1 해소** — 툴바·게이트·배지는 파생값을 읽는다:
  ```ts
  const sel = versions.find((x) => x.id === selected?.id) ?? selected;   // 렌더 시 1줄
  ```
  `patchVersion` 직후 별도 동기화 없이 즉시 반영. `selected`는 선택 앵커·`vContent` 로드 트리거로만 유지.
- **V3** — 두 조작의 스코프가 다르므로 툴팁으로 구분: 헤더 `현재 작업본에 이름 붙여 저장` / 툴바 `IconRename` → `이 버전의 이름 변경`.

**(a) 이름 저장 버튼** — 헤더. 클릭 → 인라인 `<input>` → Enter/확인.
- props `onNamedSave: (name: string) => Promise<SnapshotResult>` 추가. `EditorView.tsx:2707-2720`에서 `snapshotCurrent` 재사용해 전달.
- `snapshotCurrent`를 `(trigger, opts?)`로 확장 + `SnapshotResult` 반환(`:2348-2364`). 기존 호출부 `:2478`(manual_save)·`:2505`(editor_exit)는 반환 무시 → 하위호환 ✅
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

**(c) 핀 토글 / 이름 변경·해제 / export 기록** — `createSnapshot` 경로로는 불가(E4: `pinned:false`·name 삭제를 절대 쓰지 않음). `lib/version/meta.ts` 신설:
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
입력 타입에 `name?: string | null`, `:42` 매핑에 `name: d.data().name` 추가. **G1보다 먼저.**

### 3.4 검증

1. 변경 있는 상태 이름 저장 → `IconTag`·이름 배지·`trigger==='named'` · **결과 버전이 자동 선택되어 툴바가 뜬다(V1)**
2. **무변경 상태** 이름 저장 → `named_existing`, 기존 최신본(`IconSave` 유지)에 이름 배지만 추가·`trigger` 불변 · **그 버전이 자동 선택된다(V1)**
3. **v3(옛 버전)을 선택한 채로** 이름 저장 → 이름은 **최신본**에 붙고 선택이 최신본으로 이동(V1 회귀 방지)
4. 핀 켜기/**끄기** 왕복 · 5. 이름 변경 → **해제(`null`)** 왕복
6. prune: `editor_exit` + 이름만 부착 → 51개 초과 → **살아남는지**
7. 툴바 클릭이 **버전 선택을 재발동시키지 않는지**(X2 회귀)
8. 한글 이름 입력 중 Enter 1회 = 커밋 1회 · 9. `permission-denied` 0

### 3.5 아이콘 정비 (I1~I8)

**현황** — `components/ui/Icons.tsx`(410행·39개)는 24×24 viewBox · `fill="none"` · `stroke={color}`(기본 `currentColor`) · `strokeLinecap="round"` 규격이나 `strokeWidth`가 **1.8(9곳)과 2(25곳)로 혼재**한다. `VersionTimeline`은 `manual_save`·`editor_exit`만 SVG(`IconSave`·`IconExit`)이고 `named`·`restore`·`pinned`는 이모지 — `:7` 주석이 그 사실을 자인하고 있다. **이번 Phase가 이 줄에 배지를 하나 더 얹으므로, 미루면 혼재가 굳는다.**

**신규 3개 · 재사용 1개** (전부 `strokeWidth="1.8"` · `aria-hidden` — I4·I7)

| 컴포넌트 | 용도 | 도안 방향 | 근거 |
|---|---|---|---|
| **`IconExportRepo`** (신규) | 툴바 내보내기 버튼 · 타임라인 내보냄 배지 | **상자 밖으로 나가는 화살표**(`IconExit`의 상자+화살표 어휘를 재사용하되 화살표를 우상향으로) — "외부 저장소로 보냄"이 한눈에 읽힌다. GitHub 로고를 그리지 않는다: ① 상표이고 ② 나중에 대상이 바뀌면 아이콘이 거짓말이 된다 | **I1·I2** |
| **`IconPin`** (신규) | 툴바 핀 토글 · 타임라인 핀 배지 | 압정 — 원형 머리 + 수직 침. 켜짐은 `fill=currentColor`, 꺼짐은 `fill=none`으로 **한 컴포넌트에 `filled` prop** | **I3·I5** (📌 대체) |
| **`IconRestore`** (신규) | 타임라인 `restore` 트리거 | 반시계 화살표(원호 + 화살촉). `IconUndo`(`:89`)와 **다른 도안**이어야 한다 — Undo는 편집 되돌리기, Restore는 버전 복원으로 의미가 다르다 | **I5** (↩️ 대체) |
| `IconTag` (신규) | 타임라인 `named` 트리거 · 헤더 이름 저장 버튼 | 태그(마름모 잘린 사각형 + 구멍 점) | **I5** (🏷️ 대체) |
| `IconRename` **재사용** | 툴바 이름 변경 | 신규 불필요 — `ContextMenu.tsx:35`가 이미 "이름 변경"으로 점유해 의미가 일치한다. `strokeWidth`가 2지만 **의미 일치가 굵기 통일보다 우선**(굵기 통일은 별건) | **I3** |

> 신규가 3개가 아니라 4개인 이유: `IconTag`까지 넣어야 `VersionTimeline`에서 이모지가 **전멸**한다(I5). 3개만 하면 🏷️ 하나가 남아 혼재가 그대로다.

**금지 사항**
- 🐙·📌·🏷️·↩️ 등 **이모지 신규 사용 금지**(I1). 기존 `GgbViewer.tsx:407`·`SvgViewer.tsx:286`의 📌는 이번 범위 밖이므로 건드리지 않는다
- **`IconShare`·`IconDownload` 재사용 금지**(I2) — 각각 "공유"·"MD 다운로드"로 의미가 점유돼 있어, 돌려쓰면 사이드바·컨텍스트 메뉴의 기존 의미와 충돌한다

**크기**(I6): 타임라인 트리거 14(기존 `IconSave size={14}`와 동일) · 타임라인 배지 12 · 툴바 버튼 13(폰트 11px 줄)

**접근성**(I7): 신규 SVG에 `aria-hidden`(`IconSave`·`IconExit` 선례). 아이콘만 있는 버튼에는 `title` + `aria-label` 둘 다.

**부수 변경**: `VersionTimeline.tsx:7` 주석을 "트리거 4종 전부 아이콘 시스템 SVG"로 갱신하고, `TRIGGER_ICON` 상수(`:8-13`)를 이모지 맵에서 컴포넌트 맵으로 교체 → `:92-95`의 삼항 분기가 단순해진다.

**범위 밖**(I8): `ContextMenu.tsx:7`의 `IconDownload` 로컬 중복 정의(`Icons.tsx:329`와 별개 구현), `strokeWidth` 1.8/2 전면 통일 → 둘 다 `docs/prelaunch-bug-cleanup.md`에 등록만 하고 이번 Phase에서 건드리지 않는다.

**검증**: 라이트/다크 양쪽에서 4개 신규 아이콘이 `IconSave`·`IconExit`와 **획 굵기·시각 무게가 일치**하는지 · 핀 on/off 상태가 구분되는지 · 타임라인 한 줄에 아이콘 4개(트리거+이름+핀+내보냄)가 들어가도 460px 폭이 넘치지 않는지.

---

## 4. G1 — GitHub 내보내기 설계

### 4.1 전체 흐름 (V7 표기 정리)

```
[클라·Drawer] 선택 버전 툴바 IconExportRepo 버튼                        ← I1·I2
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

### 4.2 서버 API

**R3 = (다)** 확정. `runtime='nodejs'` · `force-dynamic` · `maxDuration = 30`(X5) · crypto shim(X12, 실질 no-op·무해):
```ts
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) (globalThis as any).crypto = webcrypto;
```
- payload 전체 REST 디코딩은 하지 않는다 — 서버가 디코딩하는 값은 **스칼라 4개**(`name`·`seq`·`content_hash`·`created_at`)뿐. 중첩 `mapValue`/`arrayValue` 범용 디코더 불필요.
- `canonicalize.ts`는 순수 TS라 서버 import 가능. `title`·`answer`는 `content.meta`에서 오고 `canonMeta`(`canonicalize.ts:10-12`)가 해시에 포함하므로 **3번 대조로 함께 검증**된다 ✅
- W9 잔여 위험은 X1로 소멸(+ `block_key` 400 방어).
- 요청 검증: 필수 4개(헤더 1 + body 3) · `JSON.stringify(content).length > 4MB` → 413.

**V4 · 전제와 컨틴전시** — 이 설계는 **Firestore REST가 Firebase Auth ID 토큰을 `Authorization: Bearer`로 받아 보안 규칙을 평가한다**는 표준 동작에 의존한다. 같은 엔드포인트를 비인증으로 쓰는 전례는 있으나(`app/shared/[shareId]/page.tsx:15-22`) **인증 변형은 이 레포에서 처음**이다. Stage 4 검증 2번에서 오너 토큰 200 / 타인 토큰 403을 반드시 확인하고, **실패하면 폴백은 R3-(나) `firebase-admin`**(서비스계정 키 env 추가). 그 경우에도 §4.4·4.5·4.6은 그대로 재사용된다.

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
  versions/{seq:04d}.md   # slug 없음(E8)
  versions/{seq:04d}.json # VersionContent 원본(무손실)
```

`toMarkdown(c, { problemId, seq, name, contentHash, createdAt })` — 순수·결정적(같은 입력 = 같은 바이트).

- **frontmatter 7필드**: `problem_id` · `version_seq` · `version_name` · `content_hash` · `created_at` · `title` · `answer`
  - **`exported_at` 없음**(W1) — 있으면 md가 매번 달라져 skip이 영구 무효화된다. export 시각은 version doc의 `github_export.exported_at`에만 기록
  - 전 값 `JSON.stringify()` 인용(YAML 이스케이프: `:` `#` `"` 개행) · 종료 `---` 뒤 빈 줄 1개(raw_text 첫 줄 `---` 오인 방지)
- **본문**: 탭별 `## {tab.title}` → `order` 순 `raw_text`(사이 빈 줄 1) · 블록 `title` 있으면 `### {title}` 선행 · 블록 앞 `<!-- block: {type} -->`
  - **타입별 분기 없음** — 전 타입 `raw_text` 그대로. 실 유입 11종, legacy 2종(`math_block`·`bullet`)도 그냥 통과(Y1). 렌더 재현은 비목표
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
- **커밋 메시지**(W8 + **V5 위생**):
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

에러 메시지는 **화이트리스트 구성** — 원본 에러 객체 전면 노출 금지(`copyright/register:60-79` 패턴을 따르지 말 것).

### 4.7 명시적 비대응

- 문항·버전 삭제 시 레포 정리 없음(아카이브 취지)
- GitHub 쪽 수동 편집은 다음 export가 덮어씀(미러)
- **V6**: 버전 이름을 바꾼 뒤 재내보내기 전까지 **레포는 구 이름을 유지한다.** 수동 트리거(R2) + 미러 원칙의 귀결이며 의도된 동작 — "동기화 누락"이 아니다

---

## 5. 구현 순서 (Stages)

**Stage 0 · 준비**
- §0.4 좌표 재실측(HEAD 이동 시)
- 덕수: **비공개** 레포 `mathory-content` 생성 시 **"Add a README" 체크**(Z6 — X3의 브랜치 초기화를 이것으로 갈음) → fine-grained PAT 발급(해당 레포 1개·Contents RW) → `.env.local` + **Vercel env 수동 등록**

**Stage 1 · P0 (§3)** — 규칙 변경 없음, 독립 배포
- **1a 아이콘(§3.5)**: `Icons.tsx`에 `IconExportRepo`·`IconPin`·`IconRestore`·`IconTag` 신규 4개(전부 `strokeWidth 1.8`·`aria-hidden`) → `VersionTimeline`의 `TRIGGER_ICON`(`:8-13`)을 컴포넌트 맵으로 교체 + `:101` 📌 → `IconPin` + `:7` 주석 갱신. **이모지 전멸 확인**
- **1b 기능**: named/핀 UI · `meta.ts` 헬퍼 3개 · **`ProblemVersion.github_export` 타입 추가(V2)** · `patchVersion` · **`sel` 파생(Z1)** · **결과 버전 자동 선택(V1)** · 타임라인 내보냄 배지 span(Z2) · **prune `!v.name`(G0′)**
- 검증: §3.4 9항목 + §3.5 아이콘 4항목

**Stage 2 · 규칙 확장 (§4.5)** — **단독 커밋 · 선배포**
- `test:rules` 61(`github_export` 단독 허용) · 62(`name` 동반 허용) · 63(`content_hash` 동반 거부). 기존 60건 회귀 0

**Stage 3 · 변환기** — `lib/version/exportMd.ts` + `types/version.ts:26` 주석(Y1)
- 검증: 실사용 11종 + legacy 2종 방어 · 다중 탭 · `---`로 시작하는 raw_text · `:`·개행 포함 제목 · **동일 입력 2회 → 바이트 동일**(W1 결정성)

**Stage 4 · 서버 API**
1. **(최우선, X6)** 실데이터 1건으로 `loadContent` → `canonicalize` → `sha256` == 저장된 `content_hash` 확인. 깨지면 모든 export가 409로 죽으므로 여기서 멈춘다
2. **(V4)** 오너 idToken으로 Firestore REST GET 200 / 타인 토큰 403 — **인증 전제 성립 확인. 실패 시 R3-(나)로 전환**
3. curl: 성공 / 헤더 누락 401 / 이름 없음 403 / 해시 변조 409 / `block_key` 손상 400 / 레포 부재 404 / **동일 내용 재요청 `skipped:true`·커밋 0** / 응답 토큰 미노출 / 브랜치 반영(X4)

**Stage 5 · UI 배선 + E2E**
- 툴바 `IconRename`·`IconPin`·`IconExportRepo`(게이트 Z1·Z4 · 툴팁 V3) + 타임라인 내보냄 배지
- E2E: 이름 저장 → 내보내기 → 파일 3개 → **무변경 재내보내기 커밋 0** → 수정 후 새 named 내보내기(index 갱신) → **이름 변경 후 재내보내기(같은 경로 갱신·유령 파일 없음 — E8)** → **낮은 seq 내보내기(index 역행 없음)** → `github_export` 기록·링크 → **툴바 클릭이 선택 재발동 없음(X2)** → **옛 버전 선택 상태에서 이름 저장 시 선택이 최신본으로 이동(V1)** → **payload 로드 전 내보내기 버튼 비활성(Z4)**

**문서** — roadmap Phase 55b 기재 + `:1295` "(Phase 56+ 별도)" → "(Phase 55b)" 정정(E9·W3). 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 툴바 버튼만 제거. 규칙 확장은 상위호환.

---

## 6. 확정된 결정 (v3 §6 — 재론 불요)

R1 **md + json 병행** · R2 **수동 버튼만** · R3 **(다) idToken 릴레이 + REST 메타 읽기 + 해시 대조**(폴백 (나) — V4) · R4 **Storage URL 참조만** · R5 **`kimdeoksoo-71/mathory-content` 비공개** · R6 **자동 핀 없음**

---

## 부록 A. v6 실측 기록 (`f311121` · CLI 직접 확인)

- **A-1.** `VersionDrawer.tsx:30` `selected` 별도 state, 갱신 지점 `:43`(open 초기화)·`:48`(선택)뿐 → **Z1 승인.** `:31` `vContent`·`:35` `contentLoading` 존재 → **Z4 재료 확보.**
- **A-2.** `snapshot.ts:63-68` — `named_existing`의 대상은 `live.last_version_id`(**최신본**)이며 `selected`와 무관. `:75`·`:95`가 `created`의 id, `:68`이 `named_existing`의 id 제공 → **V1 근거 및 해법 재료.**
- **A-3.** `VersionTimeline.tsx:96-101` name·📌만 렌더, 🐙 없음 → **Z2 승인.** 단 `read.ts:30`이 doc 전체를 전개하므로 `v.github_export`가 이미 실려 온다 → **새 props 불필요**(v5보다 더 가벼운 변경).
- **A-4.** `VersionDrawer.tsx:16-28` props에 `user` 없음 → **Z3 승인.**
- **A-5.** `read.ts:59` `resolveLivingParent`의 `getDoc` 폴백 → **V8**(자동 선택 시 stale 배열이어도 정상 동작).
- **A-6.** `canonicalize.ts:10-12` `canonMeta`가 title·answer를 해시에 포함 → frontmatter의 두 값도 3번 대조로 함께 검증됨(v4 기재 재확인).
- **A-7.** `app/shared/[shareId]/page.tsx:15-22` REST GET은 **비인증** 경로 → 인증 변형은 미검증 → **V4 컨틴전시 명시 근거.**
- **A-8.** E1·E2·E4·W1~W9·X1~X12·Y1의 근거 좌표 전량 v4·v5 기재와 일치 → 승계.
- **A-9.** `components/ui/Icons.tsx` 410행·`export function Icon*` **39개** 실측. `strokeWidth="1.8"` 9곳 / `"2"` 25곳 → **혼재 확인**(I4). `IconSave:190`·`IconExit:204`만 `aria-hidden` 보유(I7 선례). **`IconPin`·`IconGithub`/`IconExport` 계열 아이콘은 존재하지 않는다** → 신규 필요(I3).
- **A-10.** `IconShare:391`은 `ShareTree.tsx:101,123` · `Sidebar.tsx:12` · `ListView.tsx:59,62,65`에서 공유 의미로, `IconDownload:329`는 `ContextMenu.tsx:37`에서 "MD 다운로드"로 점유 → **I2 근거.** 별개로 `ContextMenu.tsx:7`에 `IconDownload` 로컬 중복 정의 발견 → **I8**(범위 밖).
- **A-11.** 이모지 잔존 실측: `VersionTimeline.tsx:11`(🏷️ named)·`:12`(↩️ restore)·`:101`(📌 pinned) → **I5 대체 대상 3곳.** 그 외 `GgbViewer.tsx:407`·`SvgViewer.tsx:286`의 📌는 "초기뷰 저장" 버튼 라벨로 **이번 Phase 범위 밖.**
