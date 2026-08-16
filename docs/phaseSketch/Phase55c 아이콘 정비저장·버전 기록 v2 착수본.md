# Phase 55c — 아이콘 정비: 저장(플로피→클라우드+체크) · 버전 기록(시계→IconRestore) **v2 착수본**

작성일: 2026-08-15 · 작성: CLI Claude (Opus 5) · **기준 커밋: `f7c4a37` (현 HEAD)**
계보: v1(web Claude, 기준 `f311121`) → **v2(CLI 실코드 검증 — 좌표 전면 재실측 + N1~N9)**

> **본 문서의 위상** — **최종 착수본. 이 파일 하나로 구현 가능하다.**
> v1의 설계 판단(클라우드+체크 / IconRestore 교체 / `checked` prop)은 **전부 승인**하고, 체크 경로 좌표도 기하학적으로 검산해 통과시켰다(N9).
> 다만 v1은 기준 커밋이 `f311121`인데 그 뒤 **Phase 55b 커밋 5개가 정확히 이 파일들을 건드려** 좌표가 전부 무효다(N1). 실제 누락 3건(N3·N4·N5)도 교정했다.
>
> 위상: **독립 상위 Phase 55c.** 순수 표시 변경 — 규칙·데이터·서버 무관. **전제였던 Phase 55b Stage 1a는 이미 완료·푸시됨**(`IconRestore` 존재) → 독립 커밋으로 진행(N8).

---

## 0. v1 검증 결과

### 0.1 설계 판단 — 전부 승인

| v1 결정 | 판정 | 근거 |
|---|---|---|
| 저장 = 클라우드+체크, 컴포넌트명 `IconSave` 유지 | ✅ | 이름이 도안이 아니라 의미를 가리킨다는 논거 타당. **클라우드 계열 기존 아이콘 0건**(grep 확인) → 충돌 없음 |
| `checked` boolean 상태 prop | ✅ | `IconPin.filled`과 같은 계열. 단 규약 문구 확장 필요 → **N4** |
| dirty = 구름만 / 저장 완료 = 구름+체크 | ✅ | `dirty`는 이미 같은 버튼 `style`에서 쓰이므로(`:2812`·`:2816`·`:2817`) 스코프 문제 없음 |
| 타임라인 `manual_save`는 무수정(기본값 `checked=true`) | ✅ | 기록된 버전은 전부 저장 완료. 호출 경로도 기본값을 타므로 실제로 무수정 — 단 구조가 바뀌었다 → **N2** |
| 버전 기록 버튼 `IconRecent` → `IconRestore` | ✅ | 사이드바 '최근 문항'(`Sidebar.tsx:1068`)과 같은 글리프였던 게 실제 문제. `IconRestore`는 55b에서 이미 신설됨 |
| `IconRestore` 중복 사용(상단바 17px / 타임라인 14px) 수용 | ✅ | 맥락 분리(버튼 vs 목록)·크기 차이. 덕수 판단 ②-(2) 존중 — 검증 항목만 추가 |
| 체크 좌표 확정, 구현 시 임의 조정 금지 | ✅ | 기하 검산 통과 → **N9** |

### 0.2 v2 신규 발견 (N1~N9)

| # | 심각도 | 내용 |
|---|---|---|
| **N1** | 🔴 | **좌표 전면 무효.** v1 기준 커밋 `f311121` 이후 Phase 55b 커밋 5개(`4c85685`~`f7c4a37`)가 `Icons.tsx`·`EditorView.tsx`·`VersionTimeline.tsx`를 전부 수정했다. EditorView는 **33행씩 밀렸다**(§0.3 표) |
| **N2** | 🟠 | **`VersionTimeline` 구조가 바뀌었다.** 55b Stage 1a에서 `TRIGGER_ICON`이 이모지 맵 → **컴포넌트 맵**이 됐다. v1의 "`:92`에서 `manual_save` 트리거 아이콘" 서술은 낡았다. 결론(무수정)은 유효하나 **타입 호환 확인이 필요**했다 → 확인 완료: `IconSave`에 `checked?: boolean`을 더해도 `React.ComponentType<{ size?: number }>`에 여전히 할당 가능(모든 prop이 optional이라 구조적으로 만족) ✅ |
| **N3** | 🟠 **누락** | **주석 2개가 거짓이 된다.** v1은 `:2797`(버전 기록) 주석만 갱신 대상으로 잡았으나, `:2808` "dirty면 빨강, 저장 완료면 회색"과 `:2821` "**아이콘 분기 불필요**"도 고쳐야 한다. `checked` prop이 바로 그 아이콘 분기이기 때문 |
| **N4** | 🟡 **누락** | **K5 규약 문구 확장 필요.** `Icons.tsx`의 규약 주석은 "상태 변형은 boolean prop + **fill 스위치**"로 한정돼 있다(55b 작성). `IconPin`은 fill 스위치지만 `IconSave`는 **요소 유무** 스위치라 규약에서 벗어난다. v1도 이를 인지했으나 **주석 수정 지시가 없다** → 문구를 "boolean prop으로 상태를 표현한다(fill 스위치 또는 요소 유무)"로 확장 |
| **N5** | 🟡 **누락** | **`docs/saveicontask.md`를 그대로 두면 함정이 된다.** 이 문서는 `> **확정안: A (셔터 + 라벨)**`로 시작하는 **이전 확정 지시서**다(2026-08-14, 커밋 `7baa8e8`). 55c가 그 결정을 뒤집는데 표시가 없으면 나중에 읽는 사람이 낡은 결정을 따른다. v1은 "수정하지 않음"이라 했으나 **상단 폐기 표시 1줄은 넣어야 한다** |
| **N6** | 🟢 | **`IconCheck`가 EditorView에서 미사용 import.** `:54`에 있으나 본문 사용 0건(grep 확인). 어차피 이 줄을 손대므로 함께 제거 |
| **N7** | 🟢 | **근거 정정.** v1은 체크 표시의 정당화로 "색약 대응도 겸한다"를 들었으나, 저장 버튼 **바로 왼쪽**(`:2792`)에 `SaveStatus`가 "저장됨 · 3분 전" / "미저장 변경" **텍스트**를 이미 띄운다 — 색약 논거는 이미 충족돼 있다. 실제 이득은 **아이콘 단독 판독성**(폭이 좁아 SaveStatus가 밀리거나 시선이 버튼에만 갈 때)이므로 근거를 그렇게 적는 게 정직하다. 채택 여부에는 영향 없음 |
| **N8** | 🟢 | **전제 조건 문구 정정.** v1의 "선행: 55b Stage 1a" / "같은 커밋에 병합 가능"은 이제 성립하지 않는다. 55b는 **완료·푸시 완료**이므로 전제는 이미 충족됐고 **독립 커밋만 가능** |
| **N9** | 🟢 | **체크 경로 기하 검산 — 통과.** Feather cloud의 `A8 8 0 1 0 9 20`이 만드는 왼쪽 로브는 현·호 기하로 풀면 **중심 (9,12)·r=8**이 맞다(v1 주장 확인). 체크 3점의 중심 거리는 (5.6,11.8)→3.41 · (8,14.2)→2.42 · (12.4,9.8)→4.05로 **전부 r=8 안쪽에 여유 있게** 들어간다 → 구름 외곽선과 겹치지 않는다 ✅ |

### 0.3 실측 좌표표 (`f7c4a37` 기준 — 구현은 이 표를 따를 것)

| 대상 | v1 표기 | **실제** | 비고 |
|---|---|---|---|
| `IconSave` 정의 | `Icons.tsx:190` | `Icons.tsx:190` | ✅ 일치 |
| `IconRecent` 정의 | `Icons.tsx:79-86` | `Icons.tsx:79-87` | ✅ (무변경 대상) |
| `IconRestore` 정의 | — | `Icons.tsx` 말미(55b Stage 1a) | 존재 확인 ✅ |
| K5 규약 주석 블록 | — | `Icons.tsx` Phase 55b 주석 | **N4** 수정 대상 |
| EditorView Icons import | `:52` | **`:50-55`** (`IconCheck…`는 `:54`) | **33행 밀림** |
| 버전 기록 버튼 주석 | `:2764` | **`:2797`** | |
| 버전 기록 버튼 `IconRecent` | `:2773` | **`:2806`** | |
| 저장 버튼 주석("dirty면 빨강…") | — | **`:2808`** | **N3** |
| 저장 버튼 `title`·`color` 분기 | — | `:2812`·`:2817` | `dirty` 스코프 확인 ✅ |
| 저장 버튼 인라인 주석("아이콘 분기 불필요") | — | **`:2821`** | **N3** |
| 저장 버튼 `IconSave` 렌더 | `:2789` | **`:2822`** | |
| `SaveStatus` 렌더 | — | `:2792` | **N7** 근거 |
| 타임라인 `TRIGGER_ICON` 맵 | `:92`(manual_save 아이콘) | **`:8-13`** (컴포넌트 맵) | **N2** |
| 타임라인 폴백 | — | `:72` (`|| IconSave`) | 기본값 경로 |
| 타임라인 렌더 | — | `:93` (`<TriggerIcon size={14} />`) | prop 미전달 → 기본값 |
| 사이드바 최근 문항 | `Sidebar.tsx:1068` | `Sidebar.tsx:1068` | ✅ 일치 · **무변경** |

---

## 1. P1 — 저장 아이콘: 플로피 → 클라우드 + 체크

### 1.1 배경

플로피디스크는 실물이 사라진 지 오래고, 이 앱의 저장은 실제로 **Firestore(클라우드) 확정**을 의미한다(`SaveStatus` 주석: *"저장됨의 기준은 Firestore 확정"*). 도안이 실제 동작과 일치하지 않는다.

사용처는 **2곳뿐**이다(grep 전수):

| 위치 | 크기 | 맥락 |
|---|---|---|
| `EditorView.tsx:2822` | 18 | 편집기 저장 버튼. `saving ? IconLoader : IconSave` |
| `VersionTimeline.tsx:9` (맵) → `:93` 렌더 | 14 | `manual_save` 트리거 표시 |

인라인 플로피 SVG 잔존 없음(`7baa8e8`에서 `IconSave`로 통합 완료), 클라우드 계열 기존 아이콘 없음 → **충돌 0**.

### 1.2 확정 코드

`components/ui/Icons.tsx`의 `IconSave`(`:190`) 본문을 **전체 교체**. 컴포넌트명은 유지한다 — `IconSave`는 도안이 아니라 의미(저장)를 가리키므로 `IconCloudSave` 같은 개명은 불필요하다.

```tsx
/**
 * 저장 — 클라우드(Firestore 확정) + 체크(저장 완료).
 * checked=false면 구름만 → 미저장(dirty) 상태.
 * ⚠️ IconCheck(단독 체크, 복사 완료 등)와 용도가 다르다. 여기 체크는 "구름 안의 완료 표시"다.
 */
export function IconSave({ size = 18, color = 'currentColor', checked = true }:
  IconProps & { checked?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 구름 (Feather cloud) */}
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      {/* 체크 = 저장 완료. 구름 왼쪽 로브(중심 9,12 · r8) 안쪽에 시각 중심 정렬.
          좌표는 미리보기(48·18·14·12px) 검수로 확정 — 임의 조정 금지. */}
      {checked && <path d="M5.6 11.8 8 14.2 12.4 9.8" />}
    </svg>
  );
}
```

### 1.3 호출부

| 호출부 | 변경 |
|---|---|
| `EditorView.tsx:2822` | `{saving ? <IconLoader size={16} /> : <IconSave size={18} checked={!dirty} />}` |
| `VersionTimeline.tsx` | **무수정** — `:93`이 `<TriggerIcon size={14} />`로 렌더하므로 기본값 `checked=true`가 적용된다. 기록된 버전은 전부 저장 완료 상태이므로 의미도 맞다 |

**3상태 정리** (저장 버튼):

| 상태 | 아이콘 | 색 | SaveStatus 텍스트 |
|---|---|---|---|
| `saving` | `IconLoader` (회전) | — | 저장 중… |
| `dirty` | 구름만 | `--accent-danger` | 미저장 변경 |
| 저장 완료 | 구름 + 체크 | `--text-faint` | 저장됨 · N분 전 |

세 채널(텍스트·색·체크)이 같은 사실을 말한다. **중복이지만 의도된 것** — SaveStatus는 창 폭이 좁으면 밀리고, 시선이 버튼에만 갈 때 아이콘 단독으로도 상태가 읽혀야 한다(N7).

---

## 2. P2 — 버전 기록 버튼: IconRecent(시계) → IconRestore

### 2.1 문제

`EditorView.tsx:2806`의 버전 기록 열기 버튼이 사이드바 **최근 문항**(`Sidebar.tsx:1068`)과 **같은 `IconRecent`**를 쓴다. Phase 55 Stage 4 당시 "사이드바와 통일"이라는 의도적 결정이었고 주석(`:2797`)에도 그렇게 적혀 있으나, 두 기능은 성격이 다르다 — 하나는 문항 목록, 하나는 버전 이력. **이번에 그 결정을 뒤집는다.**

`IconRestore`(55b 신설, 시계 테두리 + 반시계 호 + 시침)는 "이력으로 되돌아간다"는 의미가 버전 기록의 본질과 맞는다.

### 2.2 변경

1. `EditorView.tsx:2806` → `<IconRestore size={17} />` (크기 17 유지)
2. `EditorView.tsx:54` import: **`IconRecent` 제거**(EditorView 내 다른 사용처 0 — grep 확인) + `IconRestore` 추가 + **`IconCheck` 제거**(미사용 — N6)
3. `EditorView.tsx:2797` 주석 갱신:
   ```
   {/* 버전 기록 열기 — 아이콘은 IconRestore
       (Phase 55c: 사이드바 '최근 문항'과 구별, 이력 복원 의미) */}
   ```
4. `Sidebar.tsx`·`IconRecent` 정의 — **무변경**

### 2.3 IconRestore 중복 사용 — 수용

`IconRestore`가 두 곳에 쓰이게 된다: **버전 기록 열기 버튼**(상단바 17px)과 **`restore` 트리거 표시**(드로어 내 타임라인 14px). 맥락이 분리돼 있고(버튼 vs 목록 항목) 의미도 동족("버전 이력")이라 수용한다 — 덕수 판단 ②-(2).

다만 상단바 버튼이 *"누르면 복원이 실행된다"*로 오해될 여지는 있다. `title="버전 기록"`이 있어 실사용에서는 해소되겠지만, **검증 항목에 넣어 실물로 확인한다**(§4-5). 혼란이 확인되면 그때 트리거 쪽 도안을 분화한다 — 지금은 하지 않는다.

---

## 3. 부수 정리 (v1 누락분)

### 3.1 거짓이 되는 주석 2개 (N3)

| 위치 | 현재 | 수정 |
|---|---|---|
| `:2808` | `{/* 저장 버튼 — 아이콘만. dirty면 빨강, 저장 완료면 회색. */}` | `{/* 저장 버튼 — 아이콘만. dirty면 빨강·구름만, 저장 완료면 회색·구름+체크. */}` |
| `:2821` | `{/* dirty 여부는 버튼 style의 color가 currentColor로 전달 → 아이콘 분기 불필요 */}` | `{/* 색은 버튼 style의 color가 currentColor로 전달. 체크 유무만 checked prop으로 분기(Phase 55c) */}` |

### 3.2 K5 규약 문구 확장 (N4)

`Icons.tsx`의 Phase 55b 주석 블록에서:

```diff
- * 규약: 아이콘의 상태 변형은 boolean prop + fill 스위치로 표현한다(IconPin의 filled 참조).
+ * 규약: 아이콘의 상태 변형은 boolean prop으로 표현한다. 스위치 방식은 도안에 맞춘다 —
+ *   fill 전환(IconPin.filled) 또는 요소 유무(IconSave.checked).
```

### 3.3 낡은 지시서에 폐기 표시 (N5)

`docs/saveicontask.md` 최상단(제목 다음 줄)에 삽입:

```markdown
> ⚠️ **이 문서의 확정안(A: 셔터+라벨)은 Phase 55c에서 폐기됐다.**
> 현행 저장 아이콘은 **클라우드 + 체크**(`docs/phaseSketch/Phase55c 아이콘 정비… v2 착수본.md`).
> 아래 내용은 2026-08-14 시점의 이력으로만 보존한다.
```

`docs/mathorysaveicon.html`은 그 문서의 미리보기 산출물이므로 함께 이력 취급 — 수정하지 않는다.

---

## 4. 구현 순서 · 검증

**변경 파일 3개**
- `components/ui/Icons.tsx` — `IconSave` 본문 교체 + `checked` prop + 규약 주석 확장(3.2)
- `components/editor/EditorView.tsx` — `:54` import(3종 조정), `:2797`·`:2808`·`:2821` 주석, `:2806` IconRestore, `:2822` `checked={!dirty}`
- `docs/saveicontask.md` — 폐기 표시 1블록

**무변경**: `VersionTimeline.tsx` · `Sidebar.tsx` · `IconRecent` · `IconCheck` 정의 · `docs/mathorysaveicon.html`

**검증**

1. 저장 버튼(18px) **3상태 전이**: dirty=빨강·구름만 → 클릭 → saving=IconLoader → 저장 완료=회색·구름+체크. **타이핑 즉시 체크가 사라지는지**
2. 타임라인 `manual_save`(14px): 체크 포함 렌더 정상(기본값 경로) · 한 줄에 `IconSave`·`IconTag`·`IconPin`·`IconGithub` 공존 시 뭉개짐 없음
3. **체크가 구름 외곽선과 겹치지 않음** (12·14·18px) · 이웃 아이콘과 획 굵기 일치
   > 이 프로젝트에 **다크 모드는 없다**(레포 전체에 `prefers-color-scheme`·`data-theme`·`.dark` 0건).
   > `app/globals.css`의 팔레트는 아이보리·클레이·테라코타 단일 라이트 계열뿐이다. `:52` 주석의
   > "다크모드 확장 대비 역할 토큰 유지"는 **장래 대비**이지 현재 구현이 아니다 — 검증은 라이트만.
4. 상단바에서 **버전 기록(IconRestore 17px)과 저장(IconSave 18px)** 인접 배치 시 구별 명확
5. **버전 기록 버튼이 "복원 실행"으로 오해되지 않는지** (§2.3)
6. **사이드바 최근 문항과 버전 기록 버튼이 다른 아이콘으로 보임** — P2의 목적
7. grep: 플로피 도안 잔존 0 · `EditorView`의 `IconRecent`·`IconCheck` import 잔존 0 · `npx tsc --noEmit` 통과

**롤백**: 순수 표시 변경 — 커밋 revert만으로 완전 복구.

**문서**: roadmap에 Phase 55c 한 줄 기재(55b 절 뒤, `:1320` 이후) + Phase 55 비고에 "버전 기록 버튼 아이콘은 55c에서 교체" 각주. roadmap의 「UI 정리 (Phase 간 소규모)」 표에 2026-08-14자 *"저장 아이콘을 아이콘 시스템 규격으로 재설계"* 항목이 있는데, **그 행에도 55c에서 도안이 다시 바뀌었음을 덧붙일 것**(N5와 같은 취지 — 낡은 기록이 현행처럼 읽히지 않게).

## 5. 범위 밖

- `IconGithub`은 공식 마크라 유일하게 fill이다 — "굵기 통일" 작업에서 계속 제외(`prelaunch-bug-cleanup.md` 7번)
- `ContextMenu.tsx:7`의 `IconDownload` 로컬 중복 정의, `strokeWidth` 1.8/2 전면 통일, `components/viewer/`의 📌 이모지 → 모두 `prelaunch-bug-cleanup.md` 7번에 등록된 부채. 이번에 건드리지 않는다
