# Phase 55c — 아이콘 정비: 저장(플로피→클라우드+체크) · 버전 기록(시계→IconRestore) **v1 최종 (확정본)**

작성일: 2026-08-15 · 작성: web Claude (Fable) · 기준 커밋: `f311121`
**확정: 덕수, 2026-08-15 — 미리보기 3회 검수(체크 위치 2회 조정 포함) 후 최종 승인. Claude Code 착수 가능.**
위상: **독립 소형 Phase (구 "55b 부속A"를 흡수·승격).** 순수 표시 변경 — 규칙·데이터·서버 무관. **선행 조건: Phase 55b Stage 1a**(IconRestore가 거기서 신설되므로). 55b Stage 1a와 같은 커밋에 병합해도 무방하고, 55b 완료 후 독립 커밋도 안전.

> 덕수 결정 2건 (2026-08-15):
> ① "플로피디스크는 시대에 뒤떨어졌다 — 클라우드+체크로 모든 저장 플로피 아이콘을 대체한다."
> ② "버전 기록(VCS) 버튼이 사이드바 '최근 문항'과 같은 시계 아이콘을 써 왔는데, IconRestore(시계 테두리+화살표)로 바꾼다. (1) 최근 문항과 시각적으로 구별되고 의미가 직관적으로 전달된다. (2) restore 트리거와 같은 아이콘을 쓰는 데 따른 혼란이 다소 우려되나 크게 걱정할 정도는 아니라고 판단."

---

## 1. P1 — 저장 아이콘: 플로피 → 클라우드+체크

### 1.1 사용처 전수 (레포 실측 — 2곳뿐)

| 위치 | 크기 | 맥락 |
|---|---|---|
| `components/editor/EditorView.tsx:2789` | 18 | 편집기 저장 버튼. `saving ? IconLoader : IconSave`. dirty 색 분기는 버튼 style의 color → currentColor 전달(2784, 주석 2788) — 아이콘 내부 분기 없음 |
| `components/version/VersionTimeline.tsx:92` | 14 | `manual_save` 트리거 아이콘 |

인라인 플로피 SVG 별도 존재 없음(`7baa8e8`에서 `IconSave`로 통합 완료). 클라우드 계열 기존 아이콘 없음 — 충돌 없음.

### 1.2 교체 방식 — **글리프 in-place 교체 (컴포넌트명 유지) + `checked` 상태 prop**

`IconSave`라는 이름은 도안이 아니라 의미(저장)를 가리키므로 이름을 유지하고 SVG 내용만 교체한다. (신규 이름 `IconCloudSave` 안 기각.)

**덕수 확정 (2026-08-15, 미리보기 검수 후 2건)**:
- 체크 위치: 초안(우하단 치우침) → 1차 조정(왼쪽 위) → **최종: 클라우드 왼쪽 원의 정중앙 정렬.** 왼쪽 대원호의 중심은 경로 기하에서 (9, 12)·r8로 도출되며, 체크의 bounding box 중심을 이 점에 맞췄다(크기·형태 불변, 평행이동만).
- **상태 분기: dirty(미저장) 상태에서는 체크 없이 구름만, 저장 완료 시에만 구름+체크.** → `IconPin.filled`와 같은 계열의 **boolean 상태 prop `checked`** 도입(K5 규약의 두 번째 사례 — 수단만 fill 스위치가 아니라 요소 표시).

**확정 도안** — 시스템 규격(viewBox 24 · stroke 1.8 · round · `aria-hidden`):

```tsx
export function IconSave({ size = 18, color = 'currentColor', checked = true }:
  IconProps & { checked?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 구름 (Feather cloud) — 클라우드(Firestore) 저장 은유 */}
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      {/* 체크 = 저장 완료 표시. dirty(미저장)면 구름만.
          위치: 왼쪽 대원(중심 9,12 · r8 — 경로 기하에서 도출)의 정중앙에 체크 bbox 중심 정렬 */}
      {checked && <path d="M5.6 11.8 8 14.2 12.4 9.8" />}
    </svg>
  );
}
```

**호출부 반영 (2곳 중 1곳만 수정)**:

| 호출부 | 변경 |
|---|---|
| `EditorView.tsx:2789` 저장 버튼 | `<IconSave size={18} checked={!dirty} />` — dirty면 구름만(빨강), 저장 완료면 구름+체크(회색). saving 중 IconLoader는 기존대로 |
| `VersionTimeline.tsx:92` manual_save 트리거 | **무수정** — 기록된 버전은 정의상 저장 완료이므로 기본값 `checked=true` 그대로 |

- 상태 의미 정합: 버튼 색(dirty 빨강)과 체크 유무가 같은 사실(미저장/저장됨)을 이중 채널로 전달 — 색약 대응도 겸한다.
- **좌표 확정** — 미리보기(48·18·14·12px) 덕수 검수 완료. 구현 시 좌표를 임의 조정하지 말 것. 실렌더에서 브라우저별 렌더 이상이 발견될 때만 보고 후 조정.
- 55b §3.5의 K4·K5 주석 블록에 한 줄 추가: `IconSave는 클라우드(+체크=저장 완료, checked prop) — IconCheck(단독 체크)와 용도 구분. 상태 변형 prop 규약(K5)의 두 번째 사례.`
- (미리보기: 세션 산출물 `phase55b-icons-preview.html` — 체크 위치·상태 분기 반영판으로 덕수 검수)

## 2. P2 — 버전 기록 버튼: IconRecent(시계) → IconRestore

### 2.1 현황 (레포 실측)

| 위치 | 현재 | 문제 |
|---|---|---|
| `components/editor/EditorView.tsx:2773` | `<IconRecent size={17} />` — 버전 기록 드로어 열기 버튼, `title="버전 기록"` | 사이드바 **최근 문항**(`Sidebar.tsx:1068`)과 동일 아이콘. 주석 `:2764`이 "아이콘은 사이드바 '최근 문항'과 통일"이라 자인(Phase 55 Stage 4 당시 결정 — **이번에 폐기**) |
| `components/layout/Sidebar.tsx:1068` | `<IconRecent />` — 최근 문항 | **무변경** (IconRecent의 정당한 자리) |

`IconRecent`(`Icons.tsx:79-86`) = 원+시계바늘. `IconRestore`(55b Stage 1a 신설) = 시계 테두리+반시계 호 화살표+시침 — "이력으로 되돌아간다"는 의미가 버전 기록의 본질과 정합.

### 2.2 변경 내용

1. `EditorView.tsx:2773` → `<IconRestore size={17} />` (크기 17 유지).
2. `EditorView.tsx:52` import 목록: `IconRecent` 제거(EditorView 내 다른 사용처 0 — 실측), `IconRestore` 추가.
3. 주석 `:2764` 갱신: `{/* Phase 55 Stage 4: 버전 기록 열기 */}` → `{/* 버전 기록 열기 — 아이콘은 IconRestore(Phase 55c: '최근 문항'과 구별, 이력 복원 의미) */}`
4. `Sidebar.tsx`·`IconRecent` 정의 — **무변경.**

### 2.3 중복 사용 수용 기록 (덕수 판단 ②-(2))

`IconRestore`가 두 곳에 쓰이게 된다: **버전 기록 열기 버튼**(에디터 상단바, 17px)과 **restore 트리거 아이콘**(드로어 내부 타임라인, 14px). 맥락이 분리되어 있고(버튼=드로어 밖·title 툴팁 보유 / 트리거=드로어 안 목록), 의미도 동족("버전 이력")이므로 **수용**. 실사용에서 혼란이 확인되면 트리거 쪽 도안 분화를 후속 검토 — 지금은 하지 않는다.

## 3. 구현·배치

- **선행**: 55b Stage 1a(IconRestore 신설). 같은 커밋 병합 가능(권장 — P1·P2 모두 Stage 1a가 만지는 파일과 겹침: `Icons.tsx`·`VersionTimeline.tsx`·`EditorView.tsx` 상단바).
- 변경 파일 전체: `components/ui/Icons.tsx`(IconSave 본문 교체+`checked` prop+주석 1줄) · `components/editor/EditorView.tsx`(:52 import, :2764 주석, :2773 IconRestore 교체, **:2789 `checked={!dirty}` 추가**) · 이상 끝. VersionTimeline은 무수정(체크 기본값 경로).
- **롤백**: 순수 표시 변경 — 커밋 revert만으로 완전 복구.

## 4. 검증 체크리스트

1. 편집기 저장 버튼(18px): **dirty = 빨강·구름만(체크 없음) / 저장 완료 = 회색·구름+체크 / saving = IconLoader** — 3상태 전환 정상, 타이핑 시작 즉시 체크가 사라지는지
2. 타임라인 manual_save(14px): 체크 포함 렌더 정상(기본값 경로) · 한 줄에 IconSave·IconTag·IconPin·IconExport 공존 가독
3. **상단바에서 버전 기록(IconRestore 17px)·저장(IconSave 18px) 인접 배치 구별 명확**
4. **사이드바 최근 문항(IconRecent)과 버전 기록 버튼이 다른 아이콘으로 보임** — P2의 목적
5. 체크가 구름 윤곽과 겹치지 않음(12·14·18px) · 라이트/다크 양쪽 획 굵기 일치
6. 레포 전체 grep: 플로피 도안 잔존 0 · EditorView에 `IconRecent` import 잔존 0

## 5. 범위 밖

- `docs/saveicontask.md`·`docs/mathorysaveicon.html` — 플로피 시절 이력 문서, 수정하지 않음.
- 사이드바 `IconRecent`·`IconExit`·`IconCheck` — 무변경.
- roadmap: Phase 55c 항목 신설(한 줄 — "아이콘 정비: 저장 클라우드+체크, 버전 기록 IconRestore") + Phase 55 비고에 "버전 기록 버튼 아이콘은 55c에서 교체" 소급 주석.
