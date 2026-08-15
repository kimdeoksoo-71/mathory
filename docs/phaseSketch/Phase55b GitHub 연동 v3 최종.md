# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v3 최종 (확정본)**

작성일: 2026-08-15 · 작성: web Claude (Fable) · 기준 커밋: `f311121`
계보: v1(web 초안) → v2(CLI 실코드 전수 검증, E1~E9) → v3(web 재검토 — v2 전 항목 레포 재실측 + 신규 결함 W1~W9 반영) → **v3 최종(덕수 R1~R6 전부 권장안 확정, 2026-08-15)**

> **본 문서의 위상** — **확정본. Claude Code 착수 가능.** v2의 정정(E1~E9)을 전부 레포에서 재확인·승인하고, v2 자체의 결함 9건(W1~W9)을 교정했으며, 열린 결정 R1~R6은 **전부 권장안대로 덕수 확정 완료**(§6). 본 문서를 `docs/phasedocs/`에 확정본으로 배치할 것. 착수 시 HEAD가 `f311121`에서 이동했다면 §0 좌표 재실측 먼저. (Phase 55a·56·57 전례대로 이번에도 매 라운드 새 결함이 나왔다 — W1은 v2의 skip 설계를 사문화하는 수준.)

---

## ✅ v2 → v3 변경 요약

### v2 정정사항(E1~E9) 재검증 결과 — **전부 승인**

| # | 재검증 |
|---|---|
| E1 (게이트 `name != null`) | ✅ `snapshot.ts:62-68` 실측 — `named_existing`은 기존 doc에 `name`만 update, `trigger` 불변. **게이트는 `v.name != null`이 맞다** |
| E2 (prune이 name 미보호) | ✅ `prune.ts:22` 실측 — `trigger==='editor_exit' && !pinned`뿐. `!v.name` 추가 필수. `pruneProblemVersions`의 매핑(`:42`)에 `name` 추가도 v2대로 |
| E3 (Firestore REST 전례) | ✅ `app/shared/[shareId]/page.tsx:15-22` 실측 — REST GET + `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 패턴 실재. (다)안 성립 |
| E4 (핀 해제 불가) | ✅ `snapshot.ts:65-66` — `opts.pinned ? { pinned: true } : {}`. `meta.ts` 헬퍼 신설 타당 |
| E5~E7 (라인 정정) | ✅ 전부 실측 일치 (dedup 우회 37-39, Drawer props 16-28, prune 로직 :22) |
| E8 (경로에서 slug 제거) | ✅ 승인 — `{seq:04d}`만. 유령 파일 원천 차단 |
| E9 (roadmap 문구 정정) | ✅ 단 라인은 **1295** (v2 표기 1297 — W3) |

### v3 신규 결함·보완 (W1~W9)

| # | 심각도 | 내용 |
|---|---|---|
| **W1** | 🟠 **설계 모순** | v2 §4.4·§4.5의 **`exported_at` frontmatter가 skip 판정을 사문화**한다. exportedAt을 "인자 주입"해도 그 값이 export 시각인 이상 매 호출마다 다르다 → md가 항상 달라져 "동일 내용 skip(커밋 0)"이 절대 발동하지 않고, 무변경 재내보내기마다 쓸모없는 커밋이 쌓인다. **해법: 파일 내용에는 버전의 불변 시각인 `created_at`(REST 응답 `createTime`/필드 `created_at`)만 넣고, `exported_at`은 파일에서 제거** — 그 정보는 version doc의 `github_export.exported_at`에만 기록한다. 이로써 md는 (내용, seq, name)의 순수 함수가 되어 skip이 성립하고, 이름 변경 시에만 frontmatter가 바뀌어 재커밋된다(의도된 동작) (§4.4·§4.5) |
| **W2** | 🟡 사실 교정 | 블록 타입은 11종이 아니라 **13종**: `text·heading·math_block·bullet·list·callout·gana·roman·box·choices·image·svg·ggb` (`types/problem.ts:158` 실측). v2의 "11종"은 `types/version.ts:26`의 **낡은 주석**("11종 — Block과 일치 유지" — Phase 57에서 list·callout 추가 후 미갱신)에 기인한 것으로 추정. v2가 누락한 `math_block`·`bullet`도 raw_text 그대로 export되므로 동작 영향은 없으나, **이번에 주석을 13종으로 정정**한다 (§4.4) |
| **W4** | 🟡 타입 누락 | `github_export`를 doc에 쓰려면 **`ProblemVersion` 타입에 필드 추가가 필요** — v2에 명시 없음. `github_export?: { repo: string; path: string; commit_sha: string; exported_at: string } | null` + `types/version.ts:49` 주석을 "사후 수정은 name·pinned·github_export만"으로 갱신 (§4.5) |
| **W5** | 🟡 순서 미정 | 파일 3개의 PUT 순서 규정: **`versions/{seq}.md` → `versions/{seq}.json` → `index.md` 마지막.** 진입점(index)은 본체 파일이 모두 성공한 뒤에만 갱신 — 부분 실패 시 index가 존재하지 않는 파일을 가리키는 상태 방지 (§4.5) |
| **W6** | 🟢 정책 보완 | `index.md` 역행 방지의 예외: 기존 index.md frontmatter **파싱 실패 시(수동 편집·손상) 그냥 덮어쓴다** — 레포는 미러라는 §4.7 원칙의 일관 적용 (§4.5) |
| **W7** | 🟢 권장 | idToken은 body가 아니라 **`Authorization: Bearer` 헤더**로 — 요청 로깅·에러 리포팅 경로에 body가 남을 때의 토큰 노출 면을 줄인다. 서버는 헤더에서 읽어 Firestore REST로 릴레이 (§4.2) |
| **W8** | 🟢 v1 복원 | v2에서 누락된 **커밋 메시지 규약** 복원: 버전 파일 `export: {title} v{seq} — {name} ({hash 앞 8})`, index `export: index → v{seq} ({problemId})` (§4.5) |
| **W9** | 🟢 한계 명시 | (다)안 해시 대조의 검증 범위: `canonicalize`는 `block_key`·`last_editor_uid`를 제외하므로(`canonicalize.ts:5`) 클라가 보낸 content의 이 두 필드는 대조 밖이다. **오너 인증(verOwner)이 선행되므로 보안 문제가 아니라 정합성 잔여**로만 기록 — JSON 파일의 block_key는 "그 시점 클라가 본 값"으로 수용 (§4.2) |
| W3 | 🟢 라인 | roadmap 후속과제 라인 **1295** (§6 문서) |

이하 본문은 v2를 승계하되 W1~W9를 반영한 **통합 완성본**이다.

---

## 0. 실측 좌표표 (구현 기준 — `f311121`)

v2 §0.5 표를 승계(전 항목 v3 재확인 ✅). 추가·정정분만:

| 대상 | 위치 | 메모 |
|---|---|---|
| `Block['type']` 13종 | `types/problem.ts:158` | **W2** — text·heading·math_block·bullet·list·callout·gana·roman·box·choices·image·svg·ggb |
| `VersionBlock.type` 낡은 주석 "11종" | `types/version.ts:26` | 이번에 "13종"으로 정정 |
| `canonicalize` 제외 필드 주석 | `lib/version/canonicalize.ts:5` | block_key·last_editor_uid·timestamp 제외 — **W9 근거** |
| roadmap 후속과제("GitHub 연동 Phase 56+") | `docs/roadmap.md:1295` | **W3** — 55b로 정정 대상 |
| 규칙 테스트 | `tests/firestore.rules.test.mjs` (466행) | versions 케이스 46~60 · 신규는 61~63 |

나머지(스냅샷·prune·드로어·훅·규칙·REST 전례·의존성 부재)는 v2 §0.5 그대로 유효.

---

## 1. 진척상황 (v2 유지)

**완료**: Phase 55 자체 VCS(Stage 0~6) ✅ · Phase 55a 블록 Undo/Redo(Stage 1~4) ✅
**이번 범위**: **G0**(named 저장·핀 UI — 발화 경로 0곳) + **G0′**(prune의 name 미보호, E2) + **G1**(GitHub 단방향 export).
**범위 제외(후속 유지)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 contributors[] · G6 메타 승격 · G7 step_label · G8 전역 pruning · G9 원본인증 매핑(단 frontmatter `content_hash`로 연계 여지 확보).

---

## 2. 목표·비목표 (v2 유지)

**목표**: `name != null`인 버전을 별도 GitHub 콘텐츠 레포에 md+JSON으로 커밋하는 **단방향 내보내기**.
**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포와의 혼용 · 문항 삭제 시 레포 정리(아카이브 취지 — 의도적).

---

## 3. P0 — named 저장·핀 UI + prune 보호 (v2 승계, 변경 없음)

v2 §3 전체를 그대로 승계한다. 요점만 재기술:

- **(a) 이름 저장 버튼** — Drawer 헤더(`:102-112`). `onNamedSave` props 신설, `snapshotCurrent(trigger, opts?)` 확장(`EditorView.tsx:2348-2364` — 기존 2 호출부는 반환 무시라 하위호환). 한글 조합 Enter 이중발화는 `e.nativeEvent.isComposing` 가드.
- **(b) `SnapshotResult` 4갈래 UX** — `created`(신규 🏷️) / `named_existing`(기존 항목에 배지 부착 — E1·E4) / `unchanged`(포인터 hash는 맞는데 id가 없는 비정상 상태에서만 도달하는 **사실상 이론적 경로**이나, 조용한 무반응 방지용 안내는 유지) / `error`.
- **(c) `lib/version/meta.ts`** — `setVersionName(pid,vid,name|null)`·`setVersionPinned(pid,vid,boolean)`. 핀 해제·이름 해제는 이 경로만 가능(E4). 규칙 변경 불필요.
- **(d) `useVersionHistory.patchVersion`** — 로컬 배열 패치로 `loadMore` 펼침 상태 보존. `created`일 때만 `loadFirst`.
- **prune 수정(G0′)** — `prune.ts:22`에 `&& !v.name`, `:42` 매핑에 `name` 추가. **G1보다 선행.**
- 검증: v2 §3.4의 8항목 그대로.

---

## 4. G1 — GitHub 내보내기 설계 (v2 승계 + W1·W5~W9)

### 4.1 전체 흐름

```
[클라] 타임라인 항목(v.name != null)의 "GitHub 내보내기" 버튼
   → POST /api/github/export
        Authorization: Bearer {idToken}          ← W7 (body 아님)
        body { problemId, versionId, content }
[서버] route.ts (nodejs · force-dynamic · crypto shim)
   1. idToken 릴레이로 Firestore REST GET versions/{versionId}
      → 401/403은 그대로 반환 (검증 코드 0줄 — 규칙 verOwner가 수행)
      → name·seq·content_hash·created_at 확보
   2. name == null → 403 (서버가 읽은 값 기준 — E1)
   3. canonicalize(content) → sha256 → content_hash 대조. 불일치 409
      (block_key·last_editor_uid는 해시 밖 — 오너 인증 전제라 수용, W9)
   4. toMarkdown(content, {seq, name, contentHash, createdAt})   ← W1: exported_at 없음
   5. Contents API: GET→비교→skip 또는 PUT.
      순서: versions/{seq}.md → {seq}.json → index.md (W5)
   → 200 { commitUrl, commitSha, path, skipped }
[클라] updateDoc(versions/{vid}, { github_export }) → patchVersion → 배지·링크
```

### 4.2 서버 API — `app/api/github/export/route.ts`

v2 (다)안 확정 승계: **(가) 무인증 기각**(임의 문자열이 덕수 레포에 커밋되는 공개 엔드포인트 — copyright/register와 위험도 등급이 다름), **(나) firebase-admin 과함**, **(다) idToken 릴레이 + REST 메타 읽기 + 해시 대조, 의존성 0** 채택.

v2의 구현 주의사항 전부 유지: REST 값 래핑 디코딩(`fields.name?.stringValue`, **`integerValue`는 문자열 → `Number()` 필수**), payload 전체 REST 디코딩은 하지 않음(content는 클라 전송 + 해시 검증이 코드가 짧다), `crypto.subtle` shim(`node:crypto`의 `webcrypto` — Vercel 기본 Node 20+에선 불요하나 방어), `canonicalize.ts` 순수 TS로 서버 import 가능, body 상한 가드(4MB → 413).

v3 추가:
- **W7**: idToken은 `Authorization: Bearer` 헤더. 서버는 이 값을 그대로 Firestore REST의 `Authorization`에 릴레이.
- **W1**: 버전 시각은 REST 응답에서 `created_at`(timestampValue)을 읽어 ISO 문자열로 md에 넣는다. `exported_at`은 파일에 넣지 않는다.

### 4.3 환경변수 (v2 유지)

`GITHUB_EXPORT_TOKEN`(fine-grained PAT, 콘텐츠 레포 1개·Contents RW만) · `GITHUB_CONTENT_REPO` · `GITHUB_CONTENT_BRANCH`(기본 main). `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 재사용. 로컬 `.env.local` + Vercel 대시보드 수동 등록. PAT 만료 시 401 메시지로 원인 특정. **PAT 값은 채팅에 붙여넣지 않는다.**

### 4.4 레포 레이아웃·변환 (W1·W2 반영)

```
problems/{problemId}/
  index.md                # 최신(최대 seq) named 버전 미러 — 사람용 진입점
  versions/{seq:04d}.md   # E8: slug 없음
  versions/{seq:04d}.json # VersionContent 원본 (무손실)
```

**`lib/version/exportMd.ts`** (순수·결정적 — 같은 (content, seq, name, createdAt)이면 바이트 동일):

```ts
export function toMarkdown(c: VersionContent, meta: {
  problemId: string; seq: number; name: string;
  contentHash: string; createdAt: string;      // W1: 버전 생성 시각(불변). exported_at 아님
}): string
```

- **frontmatter**: `problem_id`·`version_seq`·`version_name`·`content_hash`·`created_at`·`title`·`answer`. 전 값 `JSON.stringify()` 인용(YAML 이스케이프 — `:`·`#`·`"`·개행 방어). frontmatter 종료 `---` 뒤 빈 줄 1개(raw_text 첫 줄 `---` 오인 방지).
- **본문**: 탭별 `## {tab.title}` → order 순 raw_text(블록 사이 빈 줄 1). 블록 title 있으면 `### {title}` 선행. **13종 블록 전부**(W2) raw_text 그대로 + `<!-- block: {type} -->` 마커. 렌더 재현은 비목표(GitHub의 `$$` 부분 지원은 한계로 수용). 이미지는 Storage URL 참조(R4) — index.md 상단에 "레포 단독으론 이미지가 깨질 수 있음" 명기.
- **JSON**: `JSON.stringify(content, null, 2) + '\n'` 고정.
- **부수 정정**: `types/version.ts:26` 주석 "11종" → "13종" (W2).

### 4.5 멱등성·기록 (W1·W4~W6·W8 반영)

- PUT 전 GET: 404 → sha 없이 생성 / 200 → base64 비교 **동일하면 skip**. 1MB 초과는 `content`가 비므로 git blob sha(`sha1("blob "+len+"\0"+content)`)로 비교. base64는 `Buffer.from(s,'utf8')`(한글).
- **W1 효과**: 파일 내용에 export 시각이 없으므로 무변경 재내보내기 = 3파일 전부 skip = **커밋 0**이 실제로 성립한다. 이름 변경 시에만 frontmatter가 달라져 재커밋(의도된 갱신).
- **W5 순서**: `{seq}.md` → `{seq}.json` → `index.md`. 부분 실패 시 재실행이 멱등이라 수렴(v2 유지), 진입점은 항상 마지막.
- **index.md 역행 방지**: 기존 index frontmatter의 `version_seq` 파싱 → 새 seq가 크거나 같을 때만 갱신. **파싱 실패 시 덮어쓴다**(W6 — 미러 원칙).
- **W8 커밋 메시지**: 버전 파일 `export: {title} v{seq} — {name} ({contentHash.slice(0,8)})` / index `export: index → v{seq} ({problemId})`. title은 `content.meta.title`(해시 보호 범위 안).
- **기록**: 성공 시 클라가 `updateDoc`으로 `github_export: { repo, path, commit_sha, exported_at }` 기록(exported_at은 여기에만 — W1). **W4**: `ProblemVersion`에 필드 타입 추가 + `:49` 주석 갱신.
- **규칙 확장**: `firestore.rules:158` `hasOnly(['name','pinned'])` → `+ 'github_export'`. **F3 교훈: Stage 2로 단독 선배포.**
- 서버 성공↔클라 기록 사이 크래시: 재export가 skip으로 수렴 — 허용(v2 유지).

### 4.6 실패 처리 (v2 표 유지)

401(로그인 만료)·403(타인/이름 없음)·409(해시 불일치 — 새로고침 안내 / blob sha 충돌 — 1회 자동 재시도)·404(레포/브랜치)·413(과대)·GitHub 토큰 401/403(env 갱신 안내). 에러 메시지는 화이트리스트 구성 — 원본 에러 객체를 그대로 흘리지 않는다.

### 4.7 명시적 비대응 (v2 유지)

문항·버전 삭제 시 레포 정리 없음(아카이브) · GitHub 쪽 수동 편집은 다음 export가 덮어씀(미러).

---

## 5. 구현 순서 (Stages — v2 승계 + v3 반영)

**Stage 0 · 준비** — 좌표 재확인(HEAD 이동 시 재실측). 덕수: **비공개** 콘텐츠 레포 `mathory-content` 생성(R5 확정)·fine-grained PAT 발급(해당 레포 1개·Contents RW만)·`.env.local`+**Vercel env 수동 등록**.

**Stage 1 · P0 (§3)** — named/핀 UI + `meta.ts` + `patchVersion` + **prune `!v.name`**. 규칙 변경 없음, 독립 배포. 검증 8항목(v2 §3.4).

**Stage 2 · 규칙 확장 (§4.5)** — 단독 커밋·**선배포**. `test:rules` 61(github_export 단독 허용)·62(name 동시 허용)·63(content_hash 동시 거부) 추가, 기존 60건 회귀 0.

**Stage 3 · 변환기** — `exportMd.ts` + `types/version.ts` 주석·타입(W2·W4). 검증: **13종 블록** 전부·다중 탭·`---` 시작 raw_text·`:` 포함 제목·**동일 입력 2회 → 바이트 동일**(W1 결정성).

**Stage 4 · 서버 API** — curl 검증: 성공 / 토큰 누락 401 / 타인 403 / 이름 없음 403 / 해시 변조 409 / 레포 부재 404 / **동일 내용 재요청 → skipped:true·커밋 0**(W1) / 응답 토큰 미노출.

**Stage 5 · UI 배선 + E2E** — 내보내기 버튼(게이트 `v.name != null`)·배지·커밋 링크. E2E: 이름 저장→내보내기→파일 3개 확인→**무변경 재내보내기 커밋 0**→내용 수정 후 새 named 내보내기(index 갱신)→**이름 변경 후 재내보내기(같은 경로 갱신·유령 파일 없음 — E8)**→**낮은 seq 내보내기(index 역행 없음)**→`github_export` 기록·링크.

**문서** — roadmap Phase 55b 기재 + `:1295` "(Phase 56+)" → "(Phase 55b)" 정정(E9·W3). 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 버튼만 제거. 규칙 확장은 상위호환.

---

## 6. 확정된 결정 (덕수 확정 완료 — 2026-08-15, 전부 권장안 채택)

| # | 결정 | 확정 내용 |
|---|---|---|
| R1 | export 포맷 | ✅ **md + json 병행** — md는 사람용, json은 무손실 재현·복원 여지 |
| R2 | export 트리거 | ✅ **수동 버튼만** — named 생성 시 자동 export는 후속(실사용 후 판단) |
| R3 | 서버 접근 방식 | ✅ **(다) idToken 릴레이 + Firestore REST 메타 읽기 + 해시 대조** — 의존성 0, 인증은 규칙(verOwner)이 대행. (가) 무인증 기각·(나) firebase-admin 기각 확정 |
| R4 | 이미지 | ✅ **Storage URL 참조만** — 레포 동봉(다운로드·경로 재작성)은 후속 |
| R5 | 콘텐츠 레포 | ✅ **`kimdeoksoo-71/mathory-content` · 비공개(private)** — frontmatter에 `answer`·본문 전체 평문이므로 공개는 불가역 노출. 공개 전환은 추후 언제든 가능 |
| R6 | 이름 저장 시 자동 핀 | ✅ **자동 핀 없음** — §3 prune 수정(`!v.name`)으로 name 단독 보호가 성립하므로 불필요 |

---

## 부록 A. v3 재검증 기록 (`f311121` — 웹 Claude 직접 실측)

- **A-1.** `snapshot.ts:61-69`: dedup 분기에서 `(opts?.name || opts?.pinned) && lastId` → 기존 doc `tx.update`(name / pinned:true만) → `named_existing`. `trigger` 불변 — **E1·E4 승인.** `lastId` 없으면 `unchanged` — §3(b)의 이론적 경로 근거.
- **A-2.** `prune.ts:13-28`: victim 조건에 name 부재 — **E2 승인.** `:7` 주석("named 보호")과 로직 불일치가 v1 오판의 원인.
- **A-3.** `app/shared/[shareId]/page.tsx:15-36`: Firestore REST GET·값 래핑 디코딩·`NEXT_PUBLIC_FIREBASE_PROJECT_ID` — **E3 승인.**
- **A-4.** `canonicalize.ts:1-48`: 순수 TS·결정적(키 정렬·필드 화이트리스트). block_key·last_editor_uid 제외(주석 `:5`) — **W9 근거.** `hash.ts:5-8` `crypto.subtle` — shim 필요 승인.
- **A-5.** `types/problem.ts:158`: Block type **13종** — **W2 근거.** `types/version.ts:26` 주석 "11종"은 낡음.
- **A-6.** `tests/firestore.rules.test.mjs` 466행·마지막 케이스 60번(versions LIST) — Stage 2 번호 61~63 승인.
- **A-7.** `VersionDrawer.tsx:102-112` 헤더·`useVersionHistory.ts:7-42`(갱신 API 부재)·`types/problem.ts:35-38`(포인터 4필드) — v2 좌표 전부 일치.
- **A-8.** `docs/roadmap.md:1295` 후속과제 문구 — W3.
- **A-9.** exported_at 결정성 문제(W1)는 v2 §4.4 자체 서술("내부에서 시각을 만들면 skip 판정이 무력해진다")로부터 도출 — 인자 주입으로는 해결되지 않으며(주입값도 매 export 다름), 불변 시각(`created_at`) 채택 + 파일에서 export 시각 제거만이 skip을 성립시킨다.
