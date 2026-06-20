# Phase 46 — 콘텐츠 이미지 배경 treatment

## 목적

래스터 이미지(JPEG/PNG 등)를 삽입하면 흰 배경이 Mathory의 클레이 바탕(`#F4EFE7`)에서 튀어 보인다. 클레이를 유지한 채 이 문제를 렌더타임 CSS만으로 해결한다. 변환 파이프라인 없음, 전부 가역적.

## 락된 결정

| 항목 | 결정 |
|------|------|
| **blend (기본)** | `mix-blend-mode: multiply` — 흰 배경이 뒤의 클레이로 녹는다. 클레이가 밝은 톤이라 컬러 감쇠 미미(검은 선 보존). |
| **frame (토글)** | 액자 처리(패딩+테두리+그림자). multiply가 어색한 사진/스크린샷 예외용. |
| **grayscale** | **기본 ON** (`filter: grayscale(1)`). 수학 이미지는 사실상 단색. per-image "컬러 유지" 토글로 끌 수 있음. |
| **폴백** | 기존 이미지 블록(레거시)도 필드 미설정 = 기본값(blend+grayscale) 자동 적용. |
| **스코프** | 래스터 이미지 한정. **GGB·SVG는 별도 기회**(이번 작업 대상 아님). |

### 설계 원칙 (중요 — v1에서 수정됨)
초안은 "이미지가 `.preview-content`(EditorPreview)를 거치므로 CSS 셀렉터 한 곳으로 끝"이라 가정했으나, **실제 코드에서는 틀린 전제**다(아래 "현재 코드 기준" 참조). 실제 설계:
- **상태는 `Block` 필드에 저장**한다. 기존 `imageWidth?`와 동일한 방식으로 `imageTreatment?`, `imageGray?` 추가.
- 기본값(`undefined` = blend + grayscale ON)일 땐 필드를 **저장하지 않는다.** 따라서 레거시 블록 = 기본값 = 폴백이 자동 일치, 마이그레이션 코드 불필요.
- treatment는 **각 이미지 렌더 지점의 inline `style`에 직접 반영**한다(셀렉터/data 속성 아님). 이미 모든 지점이 `width: block.imageWidth` 식으로 inline style을 만들고 있으므로 거기에 두 줄 추가.

---

## 현재 코드 기준 (레포 클론 확인, 2026-06-20)

> 프로젝트 지식 문서(EditorPreview 흰 배경 등)는 낡았음. 아래는 실제 레포 기준.

### 핵심 사실 — 이미지 블록은 `.preview-content`를 거치지 않는다
- **`type: 'image'`는 전용 블록 타입**이다(`types/problem.ts:128`). 파일 업로드 시 블록이 `type:'image'`로 전환되고(`EditorView.tsx:1526-1529`), `<img src=… width="400" />`는 `raw_text`에 들어가지만 **렌더는 raw_text를 ReactMarkdown으로 통과시키지 않고** 전용 분기에서 **bare `<img>`로 직접** 그린다.
- **width 출처가 두 갈래**: 화면은 `block.imageWidth` 필드(슬라이더가 갱신, `EditorView.tsx:1460`), 인쇄는 `raw_text`의 `width="400"`. treatment 상태도 화면 일관성을 위해 **필드**로 둔다.
- **`.preview-content img` 셀렉터(초안 Step 1)는 이미지 블록에 닿지 않는다.** `.preview-content`(EditorPreview)는 `text`/`box` 등 마크다운 블록 렌더 경로일 뿐, `type:'image'`는 그 밖이다. (단, 사용자가 *텍스트 블록 raw_text에 직접* `<img>`를 넣은 경우만 `.preview-content`를 탐 — 부차 케이스, 본 phase의 주력 아님.)

### 이미지 블록 렌더 지점 — 전부 bare `<img>`, 전부 `block` 필드 사용 (5곳)
| # | 위치 | surface | 비고 |
|---|------|---------|------|
| 1 | `EditorView.tsx:425-461` `MediaBlockContent` | 편집(활성) | 크기 슬라이더 + "그림 변경" 버튼 보유. **토글 UI 부착 지점.** inline style `borderRadius:8` 있음 |
| 2 | `EditorView.tsx:2607-2622` | 편집 화면 내 읽기전용 렌더 | bare `<img>`, `block.imageWidth` |
| 3 | `components/problem/ProblemView.tsx:297-309` | 문제 뷰 | bare `<img>`, `block.imageWidth` |
| 4 | `app/shared/[shareId]/page.tsx:159-171` | 공유 페이지 | bare `<img>`, `block.imageWidth` |
| 5 | `components/print/PrintableContent.tsx:195-210` `PrintImageBlock` | 인쇄 | `imageWidth` prop, `<img>` inline style |

> `PrintableContent.tsx:97-99`의 ReactMarkdown `img:` 오버라이드는 **텍스트 블록 내 인라인 마크다운 이미지**용(부차 케이스). 이미지 블록 인쇄는 위 5번 `PrintImageBlock`이 담당.

### 배경 / 스택 컨텍스트 (multiply 성립 확인됨 ✅)
- 활성 블록 `var(--block-bg-active) #EDE6DA`, 기본 블록 `var(--block-bg) = var(--bg-content) #F4EFE7` (`globals.css:37-40`).
- 편집 모드에서 스택 컨텍스트를 만드는 것은 **box-shadow가 아니라 dnd-kit의 `transform` + `opacity`**(`EditorView.tsx:683-699`). **다행히 클레이 배경(`background: …`)이 바로 그 `transform` 요소에 함께 칠해져 있어**, multiply가 같은 스택 컨텍스트 내부의 클레이에 정확히 섞인다 → 성립.
- 안전 성질: 어떤 surface의 배경이 흰색이면 multiply는 무변(흰×색=색), 즉 **최악의 경우 treatment가 no-op일 뿐 깨지지 않는다.**
- 프로필/아바타(`ProblemView.tsx:902`, shared `OwnerBadge` 등)는 이미지 블록 경로 밖 → 의도대로 영향 없음.

---

## 구현

### Step 1 — `Block` 타입에 필드 2개 추가 (`types/problem.ts`)
```ts
imageTreatment?: 'frame';   // 미설정 = 'blend'(기본). 'frame'일 때만 저장
imageGray?: boolean;        // 미설정 = true(흑백 기본). 컬러 유지 시 false 저장
```
> `imageWidth?`와 같은 줄에 추가. boolean이라도 "기본=흑백"을 `undefined→true`로 해석하는 것이 폴백 자동일치의 핵심.

### Step 2 — 공유 헬퍼: 필드 → inline style 조각
중복을 막기 위해 작은 헬퍼 하나(`lib/` 또는 `types` 인접)로 만들어 5개 지점에서 재사용:
```ts
// 이미지 블록 treatment → 추가 inline style
export function imageTreatmentStyle(b: { imageTreatment?: 'frame'; imageGray?: boolean }): React.CSSProperties {
  const gray = b.imageGray !== false;            // 미설정/true → 흑백
  if (b.imageTreatment === 'frame') {
    return {
      mixBlendMode: 'normal',
      filter: gray ? 'grayscale(1)' : 'none',
      background: '#faf9f5',
      padding: 12,
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    };
  }
  return {
    mixBlendMode: 'multiply',
    filter: gray ? 'grayscale(1)' : 'none',
  };
}
```
> frame일 때 `borderRadius:8`을 헬퍼가 직접 주므로, 1번 `MediaBlockContent`의 기존 inline `borderRadius:8`과 충돌 없음(같은 객체에 spread). 인라인 vs CSS 우선순위 문제 자체가 사라진다.

### Step 3 — 5개 렌더 지점에 헬퍼 병합
각 지점의 `<img style={{ … }}>`에 `...imageTreatmentStyle(block)`을 **기존 width 스타일 뒤에** spread:
```tsx
<img src={src} alt="" style={{ width: …, maxWidth: '90%', height: 'auto', ...imageTreatmentStyle(block) }} />
```
- 1 `MediaBlockContent`(`EditorView.tsx:431`) — `block` 접근 가능
- 2 `EditorView.tsx:2610` — `block` 접근 가능
- 3 `ProblemView.tsx:302` — `block` 접근 가능
- 4 shared `page.tsx:164` — `block` 접근 가능
- 5 `PrintImageBlock`(`PrintableContent.tsx:203`) — 현재 `imageWidth`만 prop으로 받음 → `imageTreatment`/`imageGray`도 prop으로 넘기거나 `block`을 통째로 넘기도록 시그니처 확장(`PrintableContent.tsx:59` 호출부도 함께).
  - **인쇄 권장 조정**: frame 시 그림자/배경 생략하고 얇은 테두리만(잉크 절약). 헬퍼에 `forPrint` 플래그를 받거나, 인쇄용은 boxShadow/background를 빼는 분기.

### Step 4 — 토글 UI (`MediaBlockContent`, `EditorView.tsx:432-461`)
기존 크기 슬라이더 + "그림 변경" 버튼이 있는 컨트롤 영역에 토글 2개 추가:
- **액자**: off(기본 blend) ↔ on(frame) → `onImageTreatmentChange(block.id, 'frame' | undefined)`
- **컬러 유지**: off(기본 흑백) ↔ on(컬러) → `onImageGrayChange(block.id, false | undefined)`

콜백은 기존 `onImageWidthChange`(`EditorView.tsx:1460`)와 **동일 패턴**으로 상위에서 `setBlocks(prev => prev.map(b => b.id===id ? {...b, imageTreatment:v} : b))` 갱신. 필드 변경 → 리렌더 → inline style 즉시 반영(별도 DOM 직접조작 불필요).

### Step 5 — 저장 반영 (`EditorView.tsx:2020` 인근 + `lib/firestore.ts`)
`saveData.imageWidth` 저장 로직(`EditorView.tsx:2020-2021`) 옆에 `imageTreatment`/`imageGray`도 **값이 있을 때만** 저장. Firestore 로드 시 필드 매핑 추가. 기본값은 미저장이므로 레거시 문서는 자동으로 기본 treatment.

---

## 검증 / 수용 기준

1. **기본 동작**: 흰 배경 도형(PNG/JPEG) 이미지 블록 삽입 → 흰 배경이 사라지고 도형이 클레이에 얹힌 듯. 검은 선 유지, 색 감쇠 미미.
2. **grayscale 기본 ON**: 컬러 도형은 단색 표시. "컬러 유지" 토글 → 원색 복원.
3. **액자 토글**: 사진/스크린샷에 액자 적용 시 흰 배경이 "의도된 도판"으로 읽히고 multiply 미적용.
4. **폴백**: 필드 없는 기존 이미지 블록도 자동으로 blend + grayscale.
5. **전 surface 일관**: 편집(활성/읽기전용) / `ProblemView` / 공유페이지 / 인쇄 5곳 동일 적용.
6. **width 공존**: 토글 후에도 크기 슬라이더·`imageWidth` 정상.
7. **아바타 제외**: 프로필 이미지 등 이미지 블록 밖은 영향 없음.
8. **활성 블록 검증**: 활성(`#EDE6DA`)·비활성(`#F4EFE7`) 모두에서 흰 배경이 정확히 클레이로 녹는지 육안 확인(메모리 원칙: CSS 캘리브레이션은 실환경 검증).

---

## 알려진 리스크 / 캘리브레이션 포인트

- **surface별 배경 차이**: `ProblemView`/공유페이지의 블록 배경이 클레이가 아니라면 multiply가 그 배경에 섞임. 다만 흰 배경이면 no-op일 뿐 파손은 아님(안전 성질). 5개 surface 실환경 육안 확인 필요.
- **인쇄 잉크**: 흰 종이에서 multiply는 무해(흰×흰=흰, 선 보존). frame은 그림자/배경 생략 권장(Step 3 5번).
- **frame + grayscale 동시**: `filter: grayscale(1)`이 frame 테두리/배경 색조까지 탈색. cream/`--border-subtle`이 거의 무채색이라 영향 미미.
- **JPEG 압축 노이즈**: 흰 배경 JPEG는 multiply 후 미세 mottling 가능. 이번 스코프 미처리(near-white 평탄화는 실익 대비 번거로움으로 폐기). 추후 필요 시 별도 phase.
- **부차 케이스(텍스트 블록 내 인라인 `<img>`)**: 이 경로만 `.preview-content`를 탐. 원하면 보조로 `globals.css`에 `.preview-content img { mix-blend-mode: multiply; filter: grayscale(1); }` 6줄을 추가해 기본 treatment를 공짜로 입힐 수 있음(토글은 없음). 본 phase 필수 아님.

---

## 변경 파일

- `types/problem.ts` — `Block`에 `imageTreatment?`, `imageGray?` 추가 (Step 1)
- `lib/`(또는 인접) — `imageTreatmentStyle` 헬퍼 신설 (Step 2)
- `components/editor/EditorView.tsx` — 5개 중 2곳(`MediaBlockContent` 431, 읽기전용 2610) 스타일 병합 + 토글 UI(432-461) + 콜백/저장(1460·2020 인근) (Step 3·4·5)
- `components/problem/ProblemView.tsx` — `:302` 스타일 병합 (Step 3)
- `app/shared/[shareId]/page.tsx` — `:164` 스타일 병합 (Step 3)
- `components/print/PrintableContent.tsx` — `PrintImageBlock` 시그니처 확장 + 스타일 병합(+인쇄용 frame 조정) (Step 3)
- `lib/firestore.ts` — `imageTreatment`/`imageGray` 로드·저장 매핑 (Step 5)
- (선택) `app/globals.css` — 부차 인라인 이미지용 `.preview-content img` 6줄

> `EditorView.tsx:1526/1570` 삽입 지점은 **수정 불필요**(기본값=무필드 설계). `raw_text`의 `width="400"`·기존 prop 보존 주의.
