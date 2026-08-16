# 작업 지시서 — EditorView 저장 아이콘 교체

> ⚠️ **폐기됨 — 이 문서의 확정안(A: 셔터 + 라벨)은 Phase 55c(2026-08-15)에서 뒤집혔다.**
> 현행 저장 아이콘은 **클라우드 + 체크**다. 플로피디스크 은유 자체를 버렸다 — 이 앱의 저장은
> 실제로 Firestore 확정을 뜻하기 때문. 상세: `docs/phaseSketch/Phase55c 아이콘 정비저장·버전 기록 v2 착수본.md`
> 아래 내용은 2026-08-14 시점의 이력으로만 보존한다. **이 지시서를 따라 구현하지 말 것.**

> **확정안: A (셔터 + 라벨)** · viewBox 24 / strokeWidth 1.8 / round
> 검토했던 B(셔터+허브)·C(채운 라벨)안은 채택하지 않음.
> 작성: web Claude · 2026-08-14

---

## 0. 선행 확인

`CLAUDE.md` 작업 규칙 1번에 따라 **아래 두 파일을 먼저 읽고**, 지시서와 실제 코드가
일치하는지 확인할 것. 불일치 시 구현을 멈추고 보고.

| 확인 항목 | 위치 (참고용, 검색으로 찾을 것) |
|---|---|
| `IconSave` 함수 정의 | `components/ui/Icons.tsx:171-179` |
| Icons import 목록 | `components/editor/EditorView.tsx:46-51` |
| 저장 버튼 인라인 SVG 2벌 | `components/editor/EditorView.tsx:2690-2706` |
| 저장 버튼 style의 `color` 분기 | `components/editor/EditorView.tsx:2686` |

`IconSave`가 현재 **어디서도 import되지 않는 미사용 함수**라는 점을 확인할 것
(`grep -rn "IconSave" --include=*.tsx` → 정의 1건만 나와야 정상).

---

## 1. 배경 — 왜 바꾸는가

저장 버튼 아이콘이 인라인 SVG 두 벌(기본/dirty)로 하드코딩돼 있고, 프로젝트의 다른
아이콘 39개가 쓰는 규격에서 혼자 벗어나 있음. 사용자가 "선 굵기·모양이 거칠다"고
지적한 원인은 아래 다섯 가지가 겹친 결과다.

1. **선이 이웃보다 가늘다** — `viewBox 64` + `strokeWidth 3.5`를 18px로 렌더하면
   유효 선 굵기 `3.5 × 18/64 = 0.98px`. 바로 옆 `IconRecent`(`1.8 × 17/24 = 1.28px`)와
   `IconChevronLeft`(`2 × 16/24 = 1.33px`)보다 가늘어 픽셀 그리드에 안 맞고 흐리게 뭉갠다.
2. **모서리 반경이 0** — 나머지 아이콘은 전부 `rx=2~3`. 이 아이콘만 직각 + 날카로운
   45° 챔퍼라 각져 보인다. `strokeLinejoin="round"`가 걸려 있으나 직각이라 무효.
3. **라벨이 윗변에 밀착** — `<rect y="6">`이 바디 윗변 `y=6`과 겹쳐 선이 이중으로 그려진다.
4. **허브 원이 과대** — `r=9`는 아이콘 폭의 28%. 채운 점 하나가 시선을 다 가져간다.
5. **dirty가 면 채움** — 주변이 전부 선 아이콘인데 혼자 덩어리로 떠서 튄다.

**교체 방침**: viewBox 24 / strokeWidth 1.8 / round 계열로 통일. dirty는 면 채움을
없애고 **선 색만** 변경 — 버튼 style의 `color`가 `currentColor`로 이미 전달되므로
아이콘 쪽 삼항 분기가 통째로 사라진다.

---

## 2. `components/ui/Icons.tsx`

기존 `IconSave` 함수를 아래로 **전체 교체**.

```tsx
export function IconSave({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 바디 — 우상단 45° 노치, 전 모서리 r=2 필렛 */}
      <path d="M5 3 H15.17 a2 2 0 0 1 1.42 .59 l3.83 3.83 a2 2 0 0 1 .58 1.41 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
      {/* 상단 셔터 */}
      <path d="M7.5 3 v4.5 a1 1 0 0 0 1 1 h4 a1 1 0 0 0 1 -1 V3" />
      {/* 하단 라벨 */}
      <path d="M17 21 v-6.5 a1 1 0 0 0 -1 -1 H8 a1 1 0 0 0 -1 1 V21" />
    </svg>
  );
}
```

기본 `size`가 16 → 18로 바뀐다. 현재 호출부가 없으므로 실사용 영향 없음.

**path 좌표를 임의로 반올림하거나 "정리"하지 말 것.** `15.17` / `1.42` / `.59` /
`3.83` / `1.41`은 45° 노치에 반경 2 필렛을 접하게 붙이기 위한 값이다
(접선 길이 `t = 2 × tan(22.5°) = 0.828`에서 유도). 바꾸면 모서리가 어긋난다.

---

## 3. `components/editor/EditorView.tsx` — import 추가

46~51행 import 목록에 `IconSave` 추가.

```tsx
import {
  IconChevronLeft, IconGrip, IconPlus,
  IconTrash,
  IconRename, IconLoader,
  IconCheck, IconRecent, IconSave,
} from '../ui/Icons';
```

---

## 4. `components/editor/EditorView.tsx` — 저장 버튼 본문

2690~2706행. 아래 블록을 찾아서

```tsx
          {saving ? <IconLoader size={16} /> : dirty ? (
            // 활성: 외곽 채움(빨강) + 라벨/허브를 비워서 반전 효과
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none" stroke="currentColor"
              strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 6 L44 6 L58 20 L58 58 L10 58 Z" fill="currentColor" />
              <rect x="18" y="6" width="22" height="16" rx="1" fill="#fff" stroke="none" />
              <circle cx="34" cy="42" r="9" fill="#fff" stroke="none" />
            </svg>
          ) : (
            // 기본(회색): 외곽 비움 + 허브 채움
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none" stroke="currentColor"
              strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 6 L44 6 L58 20 L58 58 L10 58 Z" />
              <rect x="18" y="6" width="22" height="16" rx="1" fill="none" stroke="currentColor" />
              <circle cx="34" cy="42" r="9" fill="currentColor" stroke="none" />
            </svg>
          )}
```

아래 한 줄로 대체:

```tsx
          {/* dirty 여부는 버튼 style의 color가 currentColor로 전달 — 아이콘 분기 불필요 */}
          {saving ? <IconLoader size={16} /> : <IconSave size={18} />}
```

---

## 5. 색상 하드코딩 정리

같은 버튼 2686행. `#e53935`는 다크 모드 대비가 부족하고, 이 파일 2656행이 이미
`var(--accent-danger)`를 쓰고 있어 표기가 갈린다. 토큰으로 통일:

```tsx
            color: dirty ? 'var(--accent-danger)' : 'var(--text-faint)',
```

---

## 6. 검증

- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과
- [ ] `grep -rn "0 0 64 64" components/editor/EditorView.tsx` → **0건** (인라인 SVG 잔존 없음)
- [ ] 저장 버튼 3상태 육안 확인
      — 기본(회색 선) / dirty(빨간 **선**, 면 채움 없음) / saving(`IconLoader` 회전)
- [ ] 좌측 `IconRecent`(17px)와 선 굵기가 같은 계열로 보이는지 확인
- [ ] 라이트 / 다크 모드 양쪽 확인
- [ ] 버튼 클릭 시 저장이 정상 동작하는지 (아이콘만 바뀌었으므로 회귀 없어야 정상)

---

## 7. 손대지 말 것

- `handleSave` 및 저장 체인 일체 — **raw_text 저장 경로 불가침**
  (Phase 54 D8 / Phase 56 D10 승계)
- `SaveStatus` 컴포넌트
- 저장 버튼의 `onClick` / `disabled` / `title` / `cursor` 로직
- `components/editor/UnifiedToolbar.tsx`의 viewBox 64 아이콘 계열
  — 그쪽은 22px 렌더라 유효 굵기 `3.5 × 22/64 = 1.20px`로 이미 정합. 이번 작업 범위 밖.
- `components/comment/CommentEditor.tsx`의 OCR·그림 아이콘 — 같은 이유로 범위 밖.

---

## 8. 마무리

- `docs/roadmap.md` 업데이트 (`CLAUDE.md` 작업 규칙 6번).
  Phase 신설까지는 불필요한 소규모 UI 정리이므로, 적절한 기존 항목에 한 줄 추가하거나
  판단이 서지 않으면 덕수에게 물어볼 것.
- 커밋까지만 수행. **`git push`는 덕수가 직접** (`CLAUDE.md` 작업 규칙 3번).
- 커밋 메시지 예: `fix(ui): 저장 아이콘을 아이콘 시스템 규격(viewBox 24/stroke 1.8)으로 재설계`
