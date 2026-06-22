# Phase 46 — 콘텐츠 이미지 배경 treatment

> 커밋: `69bd173` · 10개 파일 변경 (+274 / −6)
> 설계: Claude.ai (스케치 `docs/phaseSketch/Phase46 콘텐츠 이미지 배경 treatment.md`) · 구현: Claude Code CLI · 검수: 덕수 (시각 확인)

---

## 0. 목표

래스터 이미지(JPEG/PNG 등)를 삽입하면 흰 배경이 Mathory의 클레이 바탕(`#F4EFE7`)에서 튀어
보인다. 클레이를 유지한 채 **렌더타임 CSS만으로** 해결한다. 변환 파이프라인 없음, 전부 가역적.

| 항목 | 결정 |
|------|------|
| **blend (기본)** | `mix-blend-mode: multiply` — 흰 배경이 뒤의 클레이로 녹는다. 클레이가 밝은 톤이라 컬러 감쇠 미미(검은 선 보존) |
| **frame (토글)** | 액자 처리(패딩+테두리+그림자). multiply가 어색한 사진/스크린샷 예외용 |
| **grayscale** | **기본 ON**(`filter: grayscale(1)`). 수학 이미지는 사실상 단색. per-image "컬러 유지" 토글로 끔 |
| **폴백** | 기본값일 땐 필드 미저장 → 레거시 이미지 블록도 자동으로 기본 treatment 적용 |
| **스코프** | 래스터 이미지 한정. GGB·SVG는 대상 아님 |

---

## 1. 설계 핵심 — 상태는 `Block` 필드, 적용은 inline style

스케치 초안은 "이미지가 `.preview-content`(EditorPreview)를 거치므로 `.preview-content img`
셀렉터 한 곳이면 끝"이라 가정했으나, **실제 코드 검증에서 틀린 전제로 판명**됐다.

- `type: 'image'`는 **전용 블록 타입**(`types/problem.ts`)이고, 파일 업로드 시 블록이 그 타입으로
  전환된다(`EditorView.tsx:1526`). `<img>`는 `raw_text`에 들어가지만 렌더는 ReactMarkdown을
  거치지 않고 **bare `<img>`로 직접** 그린다 → `.preview-content` 셀렉터가 닿지 않는다.
- width 출처도 화면은 `block.imageWidth` 필드, 인쇄는 `raw_text`의 `width="400"`로 두 갈래.

그래서 treatment 상태도 **`Block` 필드**로 두고(`imageWidth`와 동일 패턴), 각 렌더 지점의
inline `style`에 직접 병합하는 방식으로 설계했다.

```ts
// types/problem.ts
imageTreatment?: 'frame';   // 미설정 = 'blend'(multiply, 기본)
imageGray?: boolean;        // 미설정/true = grayscale(기본), false = 컬러 유지
```

기본값(`undefined`)일 땐 필드를 **저장하지 않으므로**, 레거시 블록 = 기본값 = 폴백이 자동
일치한다. 마이그레이션 코드 불필요.

## 2. 공유 헬퍼 (`lib/imageTreatment.ts` 신규)

필드 → `CSSProperties` 변환을 한 곳에 모아 모든 렌더 지점에서 재사용한다.

```ts
imageTreatmentStyle(b: Pick<Block,'imageTreatment'|'imageGray'>, opts?: { print?: boolean })
```

- 기본(blend): `{ mixBlendMode: 'multiply', filter: grayscale|none }`
- frame: `mixBlendMode: 'normal'` + cream 배경·패딩·테두리·그림자·`borderRadius: 8`
- **인쇄 분기**(`print: true`): 잉크 절약 위해 그림자/배경 생략, 얇은 테두리만
- frame이 `borderRadius: 8`을 직접 주므로, `MediaBlockContent`의 기존 inline `borderRadius`와
  충돌 없음(같은 객체에 spread) — 인라인 vs CSS 우선순위 문제 자체가 사라짐.

## 3. 렌더 지점 6곳 적용

이미지 블록은 전부 bare `<img>` + `block` 필드를 읽는다. 각 `<img style>`에
`...imageTreatmentStyle(block)`을 width 스타일 뒤에 spread.

| # | 위치 | surface |
|---|------|---------|
| 1 | `EditorView.tsx` `MediaBlockContent` | 편집(활성) — 토글 UI 부착 지점 |
| 2 | `EditorView.tsx` 읽기전용 렌더 | 편집 화면 내 읽기전용 |
| 3 | `components/problem/ProblemView.tsx` | 문제 뷰 |
| 4 | `app/shared/[shareId]/page.tsx` | 공유 페이지 |
| 5 | `components/problem/FolderView.tsx` | 폴더 미리보기 (계획 외 6번째 지점, 일관성 위해 포함) |
| 6 | `components/print/PrintableContent.tsx` `PrintImageBlock` | 인쇄 (`print: true`) |

> 인쇄 경로는 `ProblemView.tsx`가 블록을 `PdfPrintTab`으로 매핑 → `printProblemPdf` →
> `PrintableContent`로 흐른다. 매핑·타입(`PdfPrintTab`, `PrintBlock`)에도 필드를 추가했다.

## 4. 토글 UI (`MediaBlockContent`)

기존 크기 슬라이더 아래에 토글 버튼 2개 추가.

- **액자**: off(기본 blend) ↔ on(frame) → `onImageTreatmentChange(id, 'frame' | undefined)`
- **컬러 유지**: off(기본 흑백) ↔ on(컬러) → `onImageGrayChange(id, false | undefined)`
- 콜백은 `onImageWidthChange`와 동일 패턴으로 상위에서 `setCurrentBlocks` 갱신 → 리렌더로 inline
  style 즉시 반영(DOM 직접 조작 불필요). 활성 시 `--accent-primary` 채움으로 상태 표시.

## 5. 저장 (`EditorView.tsx`, `lib/firestore.ts`)

`imageWidth` 저장 로직 옆에 **값이 있을 때만** 저장(기본값 미저장). Firestore 로드는
`{ id, ...d.data() }` 스프레드라 신규 필드 자동 로드. 문제 복제(`duplicateProblem`)에도 필드 전달.

---

## multiply 성립 근거 (검증됨)

편집 모드에서 스택 컨텍스트를 만드는 것은 box-shadow가 아니라 **dnd-kit의 `transform` +
`opacity`**(`EditorView.tsx:683`)다. 다행히 클레이 배경(`background: var(--block-bg)`)이 바로
그 `transform` 요소에 함께 칠해져 있어, multiply가 같은 스택 컨텍스트 내부의 클레이에 정확히
섞인다. 또한 어떤 surface 배경이 흰색이면 multiply는 무변(흰×색=색)이라 **최악의 경우 no-op일
뿐 깨지지 않는** 안전 성질을 가진다.

## 결정 사항 요약

| # | 결정 |
|---|------|
| 상태 저장 | `Block` 필드(`imageTreatment`/`imageGray`), 기본값 미저장 → 자동 폴백 |
| 적용 방식 | 셀렉터/CSS 파일 아님 → 렌더 지점 inline style 병합(`imageTreatmentStyle`) |
| 기본값 | blend(multiply) + grayscale ON |
| 인쇄 frame | 그림자/배경 생략, 테두리만 |
| 스코프 | 래스터 한정 (GGB·SVG 제외) |

## 변경 파일

- `types/problem.ts` — `Block.imageTreatment?` / `imageGray?`
- `lib/imageTreatment.ts` (신규) — 필드 → inline style 헬퍼
- `components/editor/EditorView.tsx` — 렌더 2곳 + 토글 UI + 콜백/핸들러 + 저장
- `components/problem/ProblemView.tsx` — 화면 렌더 + 인쇄 매핑
- `app/shared/[shareId]/page.tsx` — 공유 페이지 렌더
- `components/problem/FolderView.tsx` — 폴더 미리보기 렌더
- `components/print/PrintableContent.tsx` — `PrintImageBlock` + `PrintBlock` 타입
- `lib/pdfPrint.tsx` — `PdfPrintTab` 타입 필드
- `lib/firestore.ts` — 복제 저장 필드
- `docs/phaseSketch/Phase46 콘텐츠 이미지 배경 treatment.md` (스케치)
