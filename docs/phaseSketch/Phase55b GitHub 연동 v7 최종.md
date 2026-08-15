# Phase 55b — GitHub 연동 (버전 관리 시스템 마무리) **v7 최종 (확정 착수본)**

작성일: 2026-08-15 · 작성: web Claude (Fable) · 기준 커밋: `f311121`
계보: v1(web) → v2(CLI, E) → v3(web, W) → v4(CLI, X·Y) → v5(web, Z) → v6(CLI, V·I) → **v7(web 최종 — V1~V8 전부 승인·I1~I8 병합 판정 J1~J5·아이콘 SVG 통일안 확정)**

> **본 문서의 위상** — **확정 착수본. Claude Code 착수 가능.** v6의 V1~V8을 레포 재실측으로 전부 승인하고, v6가 요청한 4개 검토 문항에 회답했으며(§0.1), v5·v6에서 갈라졌던 아이콘안을 병합해 **신규 4종의 SVG 도안을 코드로 확정**했다(§3.5). 본 문서를 `docs/phasedocs/`에 배치. 착수 시 HEAD가 `f311121`에서 이동했다면 §0.4 좌표 재실측 먼저.
>
> **수렴 선언**: 설계 축은 v6에서(V축 🔴 0), 아이콘 축은 본 판(도안 코드 확정)에서 수렴. 일곱 라운드 누적 결함 54건(E9·W9·X12·Y1·Z6·V8·I8+J5의 판정) 전부 본문에 반영 완료 — **추가 교차검토 없이 착수한다.**

---

## 0. v6 검증 결과

### 0.1. v6의 검토 요청 4문항 회답

| # | 문항 | 회답 |
|---|---|---|
| ① | 신규 아이콘 도안이 기존 39개와 어울리는가 | 4개 중 3개(Tag·Pin·Restore) 승인. **`IconExportRepo`의 "상자+화살표" 도안만 기각(J1)** — 타임라인 같은 줄에 `IconExit`(상자+우향 화살표)가 editor_exit 트리거로 상시 렌더되는데, export 배지(12px)까지 상자+화살표면 두 아이콘이 실질 동형이 된다. **Feather 'upload'(트레이+상향 화살표) 도안 채택** — 기존 `IconDownload`(Feather 'download')의 정확한 대칭쌍이라 시스템 어휘로도 자연스럽고, IconExit·IconSave 어느 쪽과도 혼동 없음. 컴포넌트명은 용도명 **`IconExport`**(글리프명 IconUpload로 하면 이미지 '업로드' 기능과 향후 의미 충돌 여지 — I2의 교훈 선제 적용) |
| ② | `IconRename`(굵기 2)과 신규(1.8)의 혼재 허용 여부 | **혼재 허용(J3).** 툴바 13px 렌더 시 실제 획폭 2→1.083px vs 1.8→0.975px, 차이 약 0.11px로 비지각. 신규는 I4대로 1.8, `IconRename`은 무수정. 전면 굵기 통일은 I8 부채로 `prelaunch-bug-cleanup.md` 등록만 |
| ③ | `IconTag`까지 넣는 이모지 전멸 범위가 과한가 | **과하지 않음 — 이미 덕수 확정 사항.** 덕수가 2026-08-15에 "새로 등장하는 아이콘·배지 전부 SVG 통일"을 명시 선택했다(v5 반영분 — v6는 이 확정을 모른 채 같은 결론에 독립 도달). 범위 유지 |
| ④ | V1~V8 재검증 | 아래 표 — **전부 승인** |

### 0.2. V1~V8 재실측 판정

| # | 판정 | 근거 (웹 Claude 직접 실측) |
|---|---|---|
| **V1** 이름이 붙는 대상은 최신본, `selected` 아님 | ✅ **승인 — v6 최대 성과** | `snapshot.ts:62-68` 재확인: `named_existing`의 update 대상은 `live.last_version_id`. v5 §3.4-2의 "저장 직후 게이트 개방"은 최신본 선택 중일 때만 참 — v5 오류 인정. **결과 버전 자동 선택** 해법 승인(`created`→`result.version.id`, `named_existing`→`result.versionId`) |
| **V2** `github_export` 타입을 Stage 1로 | ✅ 승인 | `meta.ts`의 `setVersionExport` 인자 타입이 Stage 1에서 필요 — 타입 선언은 무해 |
| **V3** 스코프 구분 툴팁 | ✅ 승인 | 헤더=현재 작업본 / 툴바=선택 버전 |
| **V4** REST 인증 전제 + (나) 폴백 | ✅ 승인 | `shared/[shareId]/page.tsx:15-22`는 비인증 변형만 검증 — Stage 4 검증 2번 배치·폴백 명시 타당 |
| **V5** 커밋 메시지 title 위생 | ✅ 승인 | `safeTitle` 처리 |
| **V6** 이름 변경 후 레포 구 이름 유지 명기 | ✅ 승인 | 미러+수동 트리거의 귀결 |
| **V7** `{projectId}`/`{problemId}` 분리 표기 | ✅ 승인 | |
| **V8** 자동 선택 시 stale 배열 무해 | ✅ 승인 | `read.ts:59` `getDoc` 폴백 직접 확인 — 왕복 1회 추가뿐 |
| Z2 보강(새 props 불필요) | ✅ 승인 | `read.ts:30` `{ id, ...d.data() }` 전개 직접 확인 — `github_export` 자동 전달 |

### 0.3. v7 신규 판정 (J1~J5)

| # | 내용 |
|---|---|
| **J1** | **export 도안 교체** — `IconExportRepo`(상자+화살표) 기각, **`IconExport` = Feather 'upload' 도안** 채택. 근거 §0.1-①. GitHub 로고를 그리지 않는 원칙(상표·대상 변경 대비)은 v6와 동일 |
| **J2** | **`IconRestore` 신설 승인 + v5 철회** — v5는 restore ↩️를 기존 `IconUndo`(`Icons.tsx:89`)로 교체하려 했으나, **IconUndo는 Phase 55a가 에디터 툴바 Row 2 블록 Undo 버튼으로 이미 점유** — I2(의미 점유 아이콘 재사용 금지)와 동일 원리로 철회. 도안은 IconUndo(꺾인 화살촉+반원 호)와 명확히 구별되는 **시계+반시계 호 화살표**(Lucide 'history' 계열) — "시간을 되돌린다"는 버전 복원 의미에 정합 |
| **J3** | 굵기 혼재 허용 — §0.1-② |
| **J4** | v6 A-11 **경로 정정**: 범위 밖 📌 잔존은 `components/editor/`가 아니라 **`components/viewer/`** `SvgViewer.tsx`·`GgbViewer.tsx`(레포 전수 grep 재확인). 범위 밖 판정 자체는 유지 |
| **J5** | **`IconPin`의 `filled` prop 채택**(v6 안) — 켜짐 `fill=currentColor`/꺼짐 `fill=none`. v5의 색 단독 구분보다 우월(형태+색 이중 구분, 색약 대응). 툴바 토글 색 규칙(`pinned ? accent : muted`)은 보조로 병용 |

### 0.4. 실측 좌표표

v6 §0.4 **전 항목 승계**(v7 재확인 ✅ — J4의 viewer 경로 정정 1건 반영). 추가분:

| 대상 | 위치 | 메모 |
|---|---|---|
| `IconUndo` — Phase 55a 에디터 툴바 점유 | `Icons.tsx:89-97`(1.8) · 에디터 Row 2 배선 | **J2 근거** — restore에 재사용 금지 |
| `IconDownload` 도안(Feather 'download') | `Icons.tsx:329-338` | **J1** — IconExport는 이것의 상향 대칭쌍 |
| `versionsPage` doc 전개 | `read.ts:30` | Z2 — 새 props 불필요 확정 |
| 범위 밖 📌 | `components/viewer/SvgViewer.tsx`·`GgbViewer.tsx` | **J4 경로 정정** |

---

## 1. 진척상황·범위 (v6 유지)

**완료** ✅ Phase 55 자체 VCS(Stage 0~6) · Phase 55a 블록 Undo/Redo(Stage 1~4)
**이번 범위**: **G0**(named 저장·핀 UI) + **G0′**(prune `name` 미보호) + **G1**(GitHub 단방향 export) + **아이콘 정비(I·J)**
**범위 제외(후속)**: G2 탭 단위 복원 · G3 탭 reorder diff · G4 오프라인 persistence(보류) · G5 contributors[] · G6 메타 편입 · G7 step_label · G8 전역 pruning · G9 원본인증 매핑(frontmatter `content_hash`로 연계 여지만)

## 2. 목표·비목표 (v6 유지)

**목표**: `name != null` 버전을 별도 GitHub 콘텐츠 레포에 md+JSON으로 커밋하는 단방향 내보내기.
**비목표**: 역방향 동기화 · 자동 스냅샷 export · 자동 트리거 · 코드 레포 혼용 · 문항 삭제 시 레포 정리(의도적).

---

## 3. P0 — named 저장·핀 UI + prune 보호

### 3.1 현황 (v6 유지)

모델·배지 렌더·규칙·규칙 테스트 전부 준비 완료. `trigger:'named'`/`opts.name` 발화만 레포 전체 0곳.

### 3.2 설계 (X1·X2 + Z1~Z4 + V1·V3 — v6 승계, 아이콘명만 J1 반영)

**UI 배치 원칙 — 조작은 전부 "선택 버전 툴바", 타임라인은 표시 전용**

```
┌ VersionDrawer 헤더 (:102-112) ─────────────────────────┐
│ 버전 기록        [IconTag 이름 저장]               [×] │  ← (a) 스코프: 현재 작업본
├ 타임라인 (상호작용 무변경 · IconExport 배지 span 추가) ─┤
│ v7 Save 「중간안」 Pin Export   덕수    3분 전          │  ← 표시 전용 (Z2 — 새 props 불필요)
│ v6 Exit                        덕수    1시간 전        │
├ 선택 버전 툴바 (:128-143) ─────────────────────────────┤
│ v7 [이전 버전과 비교] [Rename][Pin][Export] [이 버전으로 복원] │  ← (c)(d) 스코프: 선택 버전
├ diff ──────────────────────────────────────────────────┤
```
*아이콘명은 `Icons.tsx` 컴포넌트(§3.5). **이모지는 쓰지 않는다**(I1).*

- **X2 해소** — 조작 버튼이 `<button>` 항목 밖. 타임라인 변경은 표시 전용 둘뿐: ① export 배지 span 추가(새 props 없음 — `read.ts:30` 전개로 `v.github_export` 자동 전달) ② 이모지 3종→SVG(I5).
- **X1 해소** — 툴바 시점 `vContent`는 `loadContent` 결과(`:52`).
- **Z1 해소** — 파생값: `const sel = versions.find((x) => x.id === selected?.id) ?? selected;`
- **V3** — 툴팁: 헤더 `현재 작업본에 이름 붙여 저장` / 툴바 IconRename `이 버전의 이름 변경`.

**(a) 이름 저장 버튼** — 헤더. 클릭→인라인 input→Enter/확인. props `onNamedSave` 추가, `snapshotCurrent`를 `(trigger, opts?)`+반환으로 확장(`:2348-2364`, 기존 호출부 `:2478`·`:2505` 하위호환). `isComposing` 가드. `getCurrentContent()` null이면 비활성+안내.

**(b) `SnapshotResult` 4갈래 + 자동 선택(V1)** — v6 표 그대로. **이름이 붙는 대상은 언제나 최신본** — `created`면 `loadFirst()` 후 `handleSelect(result.version)`, `named_existing`이면 `patchVersion(lastId,{name})` 후 해당 버전 자동 선택. `unchanged`(이론적 경로) 안내 유지, `error`(X7 포함) 노출. 자동 선택 직후 stale 배열은 `resolveLivingParent` getDoc 폴백으로 무해(V8).

**(c) `lib/version/meta.ts`** — `setVersionName`·`setVersionPinned`·`setVersionExport` 3헬퍼(v6 코드 그대로). name·pinned는 현행 규칙 통과, `github_export`는 Stage 2 후(호출부는 Stage 5뿐 — 순서 안전).

**(d) `useVersionHistory.patchVersion`** — 로컬 배열만. `created`일 때만 `loadFirst`.

### 3.3 prune 보호 수정 (G0′ — v6 유지)

`prune.ts:22`에 `&& !v.name` · 입력 타입 `name?` · `:42` 매핑 추가. **G1보다 먼저.**

### 3.4 검증 (v6의 9항목 유지)

1. 변경 있음 이름 저장 → IconTag·배지·`trigger==='named'`·**자동 선택(V1)** 2. 무변경 이름 저장 → `named_existing`·최신본에 배지·**자동 선택(V1)** 3. **옛 버전 선택 채로** 이름 저장 → 최신본에 부착·선택 이동(V1 회귀) 4. 핀 켜기/끄기 왕복 5. 이름 변경→해제 왕복 6. prune 생존 7. 툴바 클릭 선택 재발동 없음(X2) 8. 한글 Enter 1회=커밋 1회 9. `permission-denied` 0.

### 3.5 아이콘 SVG 통일안 — **확정 (I1~I8 + J1·J2·J5)**

**신규 4종 · 재사용 1종.** 전부 시스템 규격: viewBox 24 · `fill="none"`(IconPin filled 예외) · `stroke={color}` 기본 `currentColor` · `strokeWidth="1.8"`(I4) · round cap/join · `aria-hidden`(I7).

| 컴포넌트 | 용도 | 도안 | 근거 |
|---|---|---|---|
| **`IconExport`** 신설 | 툴바 내보내기 버튼 · 타임라인 내보냄 배지 | 트레이+상향 화살표(Feather 'upload') — `IconDownload`의 대칭쌍 | I1·I2·**J1**(상자+화살표안은 IconExit와 동형 위험으로 기각) |
| **`IconTag`** 신설 | 헤더 이름 저장 버튼 · named 트리거 | 태그(잘린 사각형+구멍 점, Feather 'tag') | I5 (🏷️ 대체) |
| **`IconPin`** 신설 | 툴바 핀 토글 · 핀 배지 | 압정(머리+침). **`filled` prop** — 켜짐 fill, 꺼짐 outline | I3·I5·**J5** (📌 대체) |
| **`IconRestore`** 신설 | restore 트리거 | 시계+반시계 호 화살표(Lucide 'history' 계열) — **IconUndo와 별도안** | I5·**J2** (↩️ 대체 · IconUndo는 Phase 55a 에디터 툴바 점유) |
| `IconRename` 재사용 | 툴바 이름 변경 | 기존 그대로(굵기 2 혼재 허용 — J3) | I3 |

```tsx
// components/ui/Icons.tsx 에 추가 — 4종 확정 도안
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

**금지**: 이모지 신규 사용 금지(I1) · `IconShare`·`IconDownload`·`IconUndo` 재사용 금지(I2·J2 — 전부 의미 점유).
**크기**(I6): 타임라인 트리거 14 · 배지 12 · 툴바 버튼 13. **접근성**(I7): 아이콘만 있는 버튼에 `title`+`aria-label`.
**부수 변경**: `VersionTimeline.tsx:7` 주석 갱신 + `TRIGGER_ICON`(`:8-13`) 이모지 맵→컴포넌트 맵(`:92-95` 삼항 단순화) + `:101` 📌→`IconPin`.
**범위 밖**(I8·J4): `ContextMenu.tsx:7` IconDownload 로컬 중복 정의 · strokeWidth 전면 통일 · `components/viewer/` Svg·GgbViewer의 📌 — `docs/prelaunch-bug-cleanup.md` 등록만.
**검증**: 라이트/다크에서 신규 4종이 IconSave·IconExit와 획 굵기·시각 무게 일치 · **12px 배지에서 IconExport↔IconExit 구별 명확(J1의 목적)** · IconRestore↔IconUndo 구별 명확(J2) · 핀 on/off 구분 · 타임라인 한 줄 아이콘 4개에 460px 무넘침 · 이모지 잔존 0.

---

## 4. G1 — GitHub 내보내기 설계 (v6 §4 전체 승계 — 변경 1건: 아이콘명)

v6 §4.1~4.7을 **그대로 승계**한다(흐름·서버 API·V4 컨틴전시·환경변수·레이아웃·변환·멱등성·실패 처리·비대응 전부). 유일한 변경: 흐름도·UI의 `IconExportRepo` → **`IconExport`**(J1).

요지(체크리스트용): 게이트 `sel.name != null && !contentLoading && vContent != null`(Z1·Z4) → `onExport(sel.id, vContent)`(Z3·X1) → `Authorization: Bearer idToken`(W7) → 서버 REST 메타 4스칼라(V4·V7 표기) → `name==null` 403(E1) → 해시 대조 409(X6)+block_key 400 → `toMarkdown`(W1: `created_at`만, `exported_at` 없음) → Contents API branch 명시(X4)·md→json→index 순(W5)·파일별 skip(X9)·index 역행 방지(W6) → 응답 `{commitUrl, commitSha, path, skipped, exportedAt}`(X8·X11·Z5) → `setVersionExport`+`patchVersion`. 커밋 메시지 `safeTitle`(V5·W8). 규칙 확장 Stage 2 선배포(F3). 이름 변경 후 재export 전 레포는 구 이름 유지(V6).

---

## 5. 구현 순서 (Stages — v6 승계 + 아이콘명 반영)

**Stage 0 · 준비** — §0.4 좌표 재실측(HEAD 이동 시). 덕수: **비공개** 레포 `mathory-content` 생성 시 "Add a README" 체크(Z6) → fine-grained PAT(해당 레포 1개·Contents RW) → `.env.local`+**Vercel env 수동 등록**. 🔒 PAT 값은 채팅에 붙여넣지 않는다.

**Stage 1 · P0 (§3)** — 규칙 변경 없음·독립 배포.
- **1a 아이콘(§3.5)**: `IconExport`·`IconTag`·`IconPin`·`IconRestore` 신설(확정 도안 그대로) → `TRIGGER_ICON` 컴포넌트 맵 교체 + 📌→IconPin + `:7` 주석 갱신. 이모지 전멸 확인.
- **1b 기능**: named/핀 UI · `meta.ts` 3헬퍼 · **`github_export` 타입(V2 — Stage 1 배치)** · `patchVersion` · `sel` 파생(Z1) · **자동 선택(V1)** · export 배지 span(Z2) · prune `!v.name`(G0′).
- 검증: §3.4 9항목 + §3.5 아이콘 검증.

**Stage 2 · 규칙 확장** — 단독 커밋·**선배포**. `test:rules` 61·62·63 추가, 기존 60건 회귀 0.

**Stage 3 · 변환기** — `exportMd.ts` + `types/version.ts:26` 주석(Y1). 검증: 실사용 11종+legacy 2종 · 다중 탭 · `---` 시작 raw_text · `:`·개행 제목 · 동일 입력 2회 바이트 동일(W1).

**Stage 4 · 서버 API** — 1) **(X6 최우선)** 실데이터 해시 왕복 확인 2) **(V4)** 오너 토큰 200/타인 403 — 실패 시 R3-(나) firebase-admin 전환 3) curl 전 케이스(v6 목록 그대로).

**Stage 5 · UI 배선 + E2E** — 툴바 IconRename·IconPin·IconExport(게이트·툴팁) + 배지. E2E: v6 목록 그대로(무변경 커밋 0 · 이름 변경 재export · 낮은 seq 역행 없음 · V1 자동 선택 · Z4 비활성 · X2 무재발동).

**문서** — roadmap Phase 55b 기재 + `:1295` 정정(E9·W3) + `prelaunch-bug-cleanup.md`에 I8·J4 부채 등록. 본 확정본 `docs/phasedocs/` 배치.

**롤백** — Stage 1·2 additive. Stage 4·5 문제 시 툴바 버튼만 제거. 규칙 확장은 상위호환.

---

## 6. 확정된 결정 (재론 불요)

R1 **md+json 병행** · R2 **수동 버튼만** · R3 **(다) idToken 릴레이+REST+해시 대조**(폴백 (나) — V4) · R4 **URL 참조만** · R5 **`kimdeoksoo-71/mathory-content` 비공개** · R6 **자동 핀 없음** · **아이콘 전부 SVG 통일(덕수 2026-08-15) — 도안은 §3.5 확정 코드**

---

## 부록 A. v7 재실측 기록 (`f311121` · 웹 Claude 직접 확인)

- **A-1.** `read.ts:30` `{ id, ...d.data() }` 전개 — `github_export` 자동 전달(Z2 새 props 불필요) ✓. `read.ts:59` `getDoc` 폴백(V8) ✓.
- **A-2.** `snapshot.ts:62-68` `named_existing` 대상 = `live.last_version_id`(최신본) — **V1 승인 근거** 재확인.
- **A-3.** `Icons.tsx` 39개·strokeWidth 1.8×9/2×25 실측 — v6 A-9와 일치(I4). `IconUndo:89-97`(1.8) — Phase 55a 에디터 툴바 점유 — **J2 근거**. `IconDownload:329` Feather 'download' 도안 — **J1의 대칭쌍 근거**.
- **A-4.** 📌 잔존 전수 grep: `VersionTimeline.tsx` + **`components/viewer/`** `SvgViewer.tsx`·`GgbViewer.tsx` — v6 A-11의 editor 경로 표기를 **viewer로 정정(J4)**, 범위 밖 판정 유지.
- **A-5.** 타임라인 트리거 줄에 `IconExit`(editor_exit)가 상시 렌더됨(`VersionTimeline.tsx:92-95`) — export 배지가 같은 줄에 서므로 상자+화살표 도안 기각(**J1**)의 직접 근거.
- **A-6.** V2·V3·V5~V7은 문면 검토로 승인(코드 반증 요소 없음). E·W·X·Y·Z 좌표 전량 v6 기재와 일치 — 승계.
