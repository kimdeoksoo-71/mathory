# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v1**

작성일: 2026-08-15 · 작성: web Claude (Fable) · 기준 커밋: `f311121` (Phase 57 P5 재구현)

> **본 문서의 위상** — v1 초안. CLI Claude가 실코드 기준으로 검토·검증 후 v2를 작성하고, v2를 web Claude가 재검토하는 워크플로우(Phase 55a·56·57과 동일). 본 문서의 file:line은 모두 커밋 `f311121` 기준. 검토 시 최신 HEAD와의 불일치 여부를 §0에서 먼저 확인할 것.
>
> **Phase 번호: 55b** (덕수 확정 2026-08-15). Phase 55(자체 VCS)의 마무리 트랙 — 55a(블록 Undo/Redo)와 같은 계열. "56·57"은 이미 각각 수식 정렬·조판 Phase가 사용.

---

## 1. 진행상황 점검 — 버전 관리 트랙 (2026-08-15 실측)

### 완료 ✅

| Phase | 내용 | 근거 |
|---|---|---|
| **55 자체 VCS** | 스냅샷(트랜잭션·dedup·해시 캐시), 계층1 자동저장 draft, 드로어/타임라인/diff(block_key 매칭)/비파괴 복원, prune(상한 50·보호 트리거), 보안 규칙(F10·F11 포함) — Stage 0~6 전부 | roadmap.md:1280-1295 ✅, `lib/version/` 8개 모듈 + `components/version/` 4개 존재 |
| **55a 블록 Undo/Redo** | Stage 1~4 전부 (C1+F1 개조로 Phase 55 restore/draft 잠재 버그도 해소) | 커밋 `e2cd18e`→`3f95239`, roadmap `8da5c42` 기재 ✅ |

### 미완료 (Phase 55 §9 후속 목록 + 이번 점검 발견)

| # | 항목 | 이번 55b 포함 여부 |
|---|---|---|
| G0 | **[점검 신규 발견] 이름 저장(named)·핀 생성 UI 부재** — 모델·표시·보호·dedup 로직은 전부 있으나 **생성 경로가 0곳** (§3 상세) | ✅ **P0 선행 필수** |
| G1 | **GitHub 연동** — Phase 55 §9 지침: "서버 API·별도 콘텐츠 레포·`named` 한정·토큰 서버 env만" | ✅ 본 Phase 핵심 |
| G2 | 탭 단위 복원 (현재 전체 복원만) | ❌ 후속 유지 |
| G3 | 탭 reorder diff / canonicalize 정렬 정책 재검토 | ❌ 후속 유지 (탭 reorder 기능 자체가 없음) |
| G4 | 오프라인 persistence | ❌ 보류 유지 (Firestore 전역 초기화 변경 위험) |
| G5 | contributors[] 협업 누적 | ❌ 후속 유지 (단일 사용자 운영 중) |
| G6 | 나머지 메타(난이도·태그·출처) 버전관리 승격 | ❌ 후속 유지 |
| G7 | step_label 보존 (F9) | ❌ 후속 유지 |
| G8 | 전역 예약 pruning | ❌ 후속 유지 |
| G9 | 원본인증(블록체인) 해시 매핑 (F8 — 두 해시는 별개 유지) | ❌ 후속 유지. 단 §4.5 export 메타에 `content_hash`를 남겨 연계 여지 확보 |

**결론**: 버전 관리 시스템의 "남은 작업"은 실질적으로 **G0(named UI) + G1(GitHub 연동)**이며, 이 둘은 의존 관계다(GitHub 연동이 `named` 한정이므로 named 생성 수단이 선행되어야 함). 나머지는 필요가 생길 때 각각 독립 Phase로.

---

## 0. 선행 확인 (CLI 필수)

구현 전 아래 위치가 본 문서와 일치하는지 확인. 불일치 시 구현을 멈추고 보고.

| 확인 항목 | 위치 | 본 문서의 전제 |
|---|---|---|
| `VersionTrigger`에 `'named'` 존재 | `types/version.ts:15` | 타입만 있고 발화 0곳 |
| `ProblemVersion.name·pinned` + "사후 수정 name·pinned만" 주석 | `types/version.ts:50-67` | |
| `createSnapshot` 시그니처 `opts?: { name, pinned, restoredFrom }` | `lib/version/snapshot.ts:25-31` | opts 전달 호출부 restore 1곳뿐 |
| named 의도 시 dedup 우회 (`!opts?.name && !opts?.pinned` 조기반환 조건) | `snapshot.ts:38-40` | 같은 해시여도 named는 진행 |
| `named_existing` 분기 (동일 해시 + name 의도 → 기존 버전 재사용?) | `snapshot.ts:68` | **CLI: 이 분기가 기존 버전에 name을 써주는지, 단순 반환만 하는지 실동작 확인** — §3.2의 설계가 갈림 |
| `createSnapshot` 호출부 전수 (2곳) | `EditorView.tsx:2358` (manual_save·editor_exit 공용), `:2662` (restore) | named 호출부 없음 |
| `snapshotCurrent(trigger)` | `EditorView.tsx:2348-2364` | |
| VersionDrawer props·구조 | `components/version/VersionDrawer.tsx:16-38` | 이름 저장 버튼·내보내기 버튼 삽입 지점 |
| 타임라인의 name·pinned 표시 (🏷️·📌) | `VersionTimeline.tsx:11,17,96-101` | 표시는 이미 있음 |
| versions update 규칙 — `hasOnly(['name','pinned'])` | `firestore.rules:156-158` | §4.5 규칙 확장 대상 |
| payload update 금지 | `firestore.rules:164` | 불변 — 건드리지 않음 |
| `loadContent(problemId, versionId)` | `lib/version/read.ts:38` | export 시 payload 로드에 재사용 |
| `VERSION_CAP = 50` · 보호 트리거(named 포함) | `lib/version/prune.ts:7,10` | named는 prune 면제 → export 대상 소실 없음 |
| 서버 API 선례 패턴 (runtime nodejs·force-dynamic·서버 env·**인증 없음 임시 정책 Phase 29 C2**) | `app/api/copyright/register/route.ts:1-35` | §4.2가 이 패턴 승계 |
| `firebase-admin`·`octokit` 의존성 **부재** | `package.json` | fetch 직접 호출로 의존성 0 추가 |
| git workflow: Claude Code 커밋 → 덕수 VSCode push → Vercel 자동 배포 | Phase 55 문서 부록 | Vercel env 추가 필요(§4.3) |

---

## 2. 목표·범위

**목표**: `named` 버전을 **별도 GitHub 콘텐츠 레포**에 사람이 읽을 수 있는 마크다운(+무손실 JSON)으로 커밋하는 **단방향 내보내기**. 앱 외부에 영구 백업·이력 아카이브를 만든다.

**비목표 (명시적 제외)**:
- GitHub → 앱 방향 동기화 없음 (레포는 read-only 미러. 레포에서 고쳐도 앱에 반영 안 됨)
- `manual_save`·`editor_exit` 자동 스냅샷의 export 없음 (`named` 한정 — Phase 55 §9 확정 지침)
- 실시간·자동 동기화 없음 (명시적 버튼 조작만 — R2)
- 코드 레포(`kimdeoksoo-71/mathory`)와 콘텐츠 레포는 **별개** (Phase 55 §9 확정 지침)

---

## 3. P0 — 이름 저장(named)·핀 UI (선행 격차 해소)

### 3.1 현상 (점검 실측)

- `VersionTrigger`에 `'named'`가 있고, 타임라인은 🏷️/'이름 저장' 라벨·name 뱃지·📌을 렌더하며(`VersionTimeline.tsx:11,17,96-101`), prune은 named·pinned를 보호한다(`prune.ts:7`).
- 그러나 `createSnapshot`을 `trigger:'named'` 또는 `opts.name`으로 부르는 곳이 **레포 전체에 0곳**. 핀 토글 UI도 없다(표시만 존재).
- 규칙은 이미 준비됨: 사후 update는 `name`·`pinned`만 허용(`firestore.rules:156-158`).

### 3.2 설계

**(a) "이름 저장" 버튼** — VersionDrawer 헤더부에 배치. 클릭 → 이름 입력(인라인 input, Korean IME 주의 — 단축키 배선 없음이므로 `e.code` 이슈 없음) → `snapshotCurrent` 확장 또는 별도 함수로 `createSnapshot(problemId, content, 'named', actor, { name })`.
- 현재 작업본이 dirty면 먼저 저장 흐름과의 순서 정의 필요 — **제안**: 이름 저장은 "현재 작업본"을 캡처하므로 별도 사전 저장 불필요(스냅샷은 collectCurrentContent 기준). 단 draft·dirty 상태 표시와의 상호작용은 CLI가 확인.
- 동일 해시 + name 의도 시 `named_existing` 분기(snapshot.ts:68)의 실동작에 따라: 기존 버전에 name을 부여(update)하는 보강이 필요할 수 있음 — **CLI 확인 항목(§0)**. 필요 시 `renameVersion(problemId, versionId, name)` 헬퍼 신설(update 규칙은 이미 허용).

**(b) 핀 토글** — 타임라인 각 행에 📌 토글. `updateDoc(versions/{id}, { pinned })`. 규칙 통과 확인만.

**(c) 이름 변경·해제** — name 뱃지 클릭 → 인라인 수정. `{ name: string | null }` update.

### 3.3 검증

이름 저장 → 타임라인 🏷️ 행 생성(무변경 상태에서도) → 새로고침 후 잔존 → prune 상황(51개 초과)에서 named 생존 → 핀 토글 왕복 → 규칙 거부 없음(콘솔 permission-denied 0).

---

## 4. G1 — GitHub 내보내기 설계

### 4.1 전체 흐름

```
[클라] VersionTimeline named 행 "GitHub 내보내기" 버튼
   → POST /api/github/export  { problemId, versionId }
[서버] route.ts (nodejs runtime)
   1. Firestore에서 version meta + payload 로드 (문항 title 포함)
   2. trigger !== 'named' 이면 403 거부 (named 한정 강제)
   3. VersionContent → 마크다운 변환 (lib/version/exportMd.ts, 순수 함수)
   4. GitHub Contents API PUT ×2 (md + json) — 기존 파일이면 sha 조회 후 update
   5. version doc에 github_export 필드 기록 (repo·path·commit_sha·exported_at)
   → 200 { commitUrl }
[클라] 해당 행에 내보냄 표시(커밋 링크) 갱신
```

### 4.2 서버 API — `app/api/github/export/route.ts`

- 패턴은 `copyright/register` 선례 승계: `runtime='nodejs'`, `dynamic='force-dynamic'`, 서버 env, try/catch 정규화 응답.
- **서버에서 Firestore 읽기/쓰기 방법이 이 프로젝트 최초의 쟁점** — 현재 서버 route들은 Firestore를 전혀 안 만짐. 선택지:
  - **(가) [제안] 클라가 meta+content를 body로 전송, 서버는 GitHub만 담당.** 서버 Firestore 접근 0 → firebase-admin 불필요, 규칙 변경도 클라 update(`github_export` 필드) 기준. 단점: 클라가 보낸 내용을 신뢰(변조 가능) — 단일 사용자 임시 정책(C2) 하에서 수용 가능.
  - (나) 서버가 firebase-admin으로 직접 읽기 — 무결성 보장되나 신규 의존성 + 서비스 계정 키 env + 규칙 우회 관리 부담.
  - **v1 제안: (가)**, 공개 전 보안 정리 때 (나) 승격 검토. → **R3**
- 요청 검증: `problemId`·`versionId`·`content_hash` 형식 검사, `trigger === 'named'` 필드 확인((가)안에서는 클라 자기신고 — C2 전제).

### 4.3 환경변수 (전부 서버 전용 — `NEXT_PUBLIC_` 금지)

| 이름 | 값 예 | 비고 |
|---|---|---|
| `GITHUB_EXPORT_TOKEN` | fine-grained PAT | **콘텐츠 레포 1개 한정, Contents: Read and write 권한만.** 만료 설정 권장 |
| `GITHUB_CONTENT_REPO` | `kimdeoksoo-71/mathory-content` | R5에서 이름 확정 |
| `GITHUB_CONTENT_BRANCH` | `main` | |

로컬 `.env.local` + Vercel 프로젝트 env 양쪽 등록. **배포 워크플로우 주의**: Vercel env 추가는 덕수 수동 작업(Stage 0 체크리스트).

### 4.4 레포 파일 레이아웃·변환

```
problems/
  {problemId}/
    index.md                      # 최신 named 버전 본문 (사람용 진입점, 매 export 갱신)
    versions/
      {seq:04d}-{name-slug}.md    # 버전별 마크다운 (불변 — 한 번 쓰면 갱신 안 함)
      {seq:04d}-{name-slug}.json  # VersionContent 원본 (무손실 재현용)
```

- **md 변환** (`lib/version/exportMd.ts`, 순수 함수 — 단위 검증 가능):
  - frontmatter: `problem_id`·`version_seq`·`version_name`·`content_hash`·`exported_at`·`title`·`answer`
  - 본문: 탭별 `## {tab.title}` → 블록 order 순 `raw_text` 연결(블록 사이 빈 줄). 블록 `title` 있으면 `### {title}`.
  - 특수 블록(svg·ggb·choices 등 11종): raw_text 그대로 + frontmatter에 타입 명시. **렌더 재현은 목표 아님**(아카이브 목적) — GitHub에서 KaTeX가 안 그려지는 건 한계로 수용. `$$` 수식은 GitHub 자체 수식 렌더로 일부 표시됨.
  - 이미지: Firebase Storage URL 그대로 참조 (**R4** — 동봉은 후속).
- slug: name → 한글 유지 + 공백/`/` → `-` (GitHub 경로는 유니코드 허용). seq 4자리 패딩으로 정렬 보장.

### 4.5 멱등성·기록

- Contents API `PUT /repos/{repo}/contents/{path}`는 update 시 기존 blob `sha` 필수 → 사전 GET으로 존재 확인. **내용 동일하면 skip**(base64 비교 또는 GET의 sha와 신규 blob sha 비교).
- 성공 시 version doc에 기록: `github_export: { repo, path, commit_sha, exported_at }`.
- **규칙 확장 필요**: `firestore.rules:158` `hasOnly(['name','pinned'])` → `hasOnly(['name','pinned','github_export'])`. **Phase 55 교훈(F3) 승계: 규칙 배포가 코드보다 선행** — Stage 2를 독립 배포.
- 타임라인 표시: `github_export` 있으면 행에 GitHub 아이콘 + 커밋 링크. 재내보내기 허용(내용 갱신 시 새 커밋).

### 4.6 실패 처리

- 401/403(토큰)·404(레포/브랜치)·409(sha 충돌)·422 각각 한국어 메시지로 surface. 409는 1회 재시도(sha 재조회).
- 부분 실패(md 성공·json 실패): 각 파일 독립 PUT이므로 발생 가능 — 재실행이 멱등이라 "다시 내보내기"로 수렴. 트랜잭션 흉내(Git Trees API로 단일 커밋)는 **후속** — v1은 파일당 1커밋 수용. → CLI 이견 있으면 v2에서.

---

## 5. 범위 제외 항목의 재배치 (§1 표의 G2~G9)

전부 이번 Phase에서 손대지 않는다. 단 G9(원본인증 연계)를 위해 export frontmatter에 `content_hash`를 반드시 포함(§4.4)— 이후 매핑만 추가하면 되는 상태를 만들어 둔다. G3(탭 reorder)은 기능 자체가 미도입이므로 canonicalize 정렬 정책도 그대로.

---

## 6. 구현 순서 (Stages)

**Stage 0 · 준비 (덕수 수동 + CLI 확인)**
- §0 선행 확인 전수. 불일치 보고.
- 덕수: 콘텐츠 레포 생성(R5), fine-grained PAT 발급, `.env.local`·Vercel env 등록.

**Stage 1 · P0 — named·핀 UI (§3)** — 독립 배포 가능(규칙 변경 없음).
- 검증: §3.3 시나리오 전부.

**Stage 2 · 규칙 확장 (§4.5)** — `github_export` 키 허용. **단독 커밋·선행 배포 (F3 교훈)**.
- 검증: `test:rules`에 named update + github_export update 케이스 추가, 기존 회귀 0.

**Stage 3 · 변환기 (`lib/version/exportMd.ts`)** — 순수 함수.
- 검증: 실제 문항 VersionContent로 md 생성 → 11종 블록 타입·다중 탭·수식 포함 케이스 육안 확인. 같은 입력 → 같은 출력(결정성, 타임스탬프는 인자 주입).

**Stage 4 · 서버 API (§4.2·4.3·4.6)**
- 검증: curl로 성공/토큰 오류/존재하지 않는 레포/동일 내용 skip/409 재시도. 응답에 토큰 미노출.

**Stage 5 · UI 배선 + E2E**
- 타임라인 named 행 버튼 + 내보냄 표시.
- 검증 E2E: 이름 저장 → 내보내기 → GitHub에서 커밋·파일 확인 → 같은 버전 재내보내기(skip) → 내용 수정 후 새 named 버전 내보내기(새 커밋) → index.md 갱신 확인 → version doc `github_export` 기록·타임라인 링크.

**문서**: roadmap에 Phase 55b 기재 + Phase 55 §9 후속 목록 갱신. 본 확정본 `docs/phasedocs/` 배치.

---

## 7. 열린 결정 (덕수 확정 필요)

| # | 질문 | 제안 |
|---|---|---|
| R1 | export 포맷 | **md + json 병행** (md=사람용, json=무손실 재현·복원 여지) |
| R2 | export 트리거 | **수동 버튼만.** named 생성 시 자동 export는 후속(실사용 후 판단) |
| R3 | 서버 Firestore 접근 | **(가) 클라 전송 + 서버는 GitHub만** — C2 임시 정책과 일관, 의존성 0. 공개 전 보안 정리 때 (나) firebase-admin 승격 재론 |
| R4 | 이미지 | **v1은 Storage URL 참조만.** 레포 동봉(다운로드·경로 재작성)은 후속 |
| R5 | 콘텐츠 레포 | 이름(`mathory-content`?)·공개/비공개 — 공개 시 저작권·문항 출처 표기 검토 필요 |

---

## 부록 A. 점검 실측 요약 (`f311121`)

- **A-1.** `lib/version/`: adapter·canonicalize·diff·draft·hash·prune·read·snapshot (8모듈). `components/version/`: Drawer·Timeline·Diff·RestoreConfirm (4컴포넌트). Phase 55 Stage 0~6 산출물 전부 현존.
- **A-2.** `createSnapshot` 호출부 2곳뿐(EditorView 2358·2662). `trigger:'named'`·`opts.name`·`opts.pinned` 발화 0곳 — **G0 격차의 직접 근거.**
- **A-3.** 서버 API 선례 5종(ai-complete·copyright/register·discuss·ocr·proofread) 모두 서버 env 사용·클라 인증 없음(Phase 29 C2 임시 정책). firebase-admin·octokit 의존성 없음.
- **A-4.** `firestore.rules:144-165` versions 규칙: create 정합 검사, update `hasOnly(['name','pinned'])`, payload update 금지, LIST는 verOwner()(F11).
- **A-5.** prune 보호: manual_save·named·restore·pinned (`prune.ts:7`) — named는 export 후에도 소실되지 않음.
- **A-6.** git workflow(Phase 55 부록): Claude Code 커밋 → 덕수 push → Vercel 자동 배포. **Vercel env 등록은 이 흐름 밖의 수동 작업**이므로 Stage 0 체크리스트에 명시.
