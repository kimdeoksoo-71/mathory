# Phase 51 — 수식 필기 입력 (Handwriting Math Input)

> 터치 매체(iPad·스마트폰·트랙패드·마우스)에서 **5줄 이내 수식을 손으로 그려 LaTeX로 변환·삽입**한다.
> 번호는 **잠정** — 공유 트릴로지(48~50)가 예약돼 있어 그 뒤로 두었음. 덕수가 현재 시퀀스에 맞춰 확정.
>
> **핵심 설계:** 신규 인프라가 아니다. **Phase 28 OCR 파이프라인(Mathpix 프록시 + `normalizeAndFix` + 커서 삽입)을 그대로 재사용**하고, 입력 경로만 "이미지(`/v3/text`)"에서 "스트로크(`/v3/strokes`)"로 추가한다. 인식 방식은 이미지 OCR보다 정확·저지연한 **스트로크 기반(online ink)**.
>
> **공용 모달 1개 원칙:** `HandwritingModal`은 인식 결과 LaTeX만 `onResult(latex)`로 넘기고 **삽입 방식은 모른다.** 삽입은 각 컨텍스트의 핸들(`insertText` / `insertAtCursor`)이 담당한다. 사이드바(토론·agent·댓글)는 `CommentEditor` 단일 컴포넌트이므로 **거기 한 곳만 배선하면 3곳 모두 적용**된다.

---

## 0. 선행 확인 (구현 직전 반드시 읽을 것 — 라인 번호는 작성 시점 기준, 변동 가능)

- `app/api/ocr/route.ts` — Mathpix 프록시 전체. 헤더(`app_id`/`app_key`), `formats:['text']`, `math_inline_delimiters:['$','$']`, `math_display_delimiters:['$$','$$']`, `rm_spaces:true`. **`/api/ink`의 복제 원본.**
- `lib/ocr.ts` — `normalizeAndFix`(L79, `\(`→`$`·`\[`→`$$` 치환 + `autoFixDeterministicIssues` 교정), `validateOcrFile`/`toDataUrl`(이미지 전용 — ink에선 불필요). **`normalizeAndFix`는 그대로 재사용.**
- `components/editor/EditorView.tsx`
  - L981~982 `ocrLoading`/`ocrInputRef` state — ink용 `inkOpen`/`inkLoading` 신설 위치
  - L1766~1810 `handleOcrClick`/`handleOcrFileChange` — `handleInkResult` 미러링 원본
  - L1801 `editorRefs.current[activeBlockId]?.insertText(payload, payload.length)` — 메인 에디터 삽입 핸들
  - L2429~2455 `UnifiedToolbar` 배선 + 숨김 `<input>` 패턴 — 모달 렌더 위치
- `components/editor/UnifiedToolbar.tsx` L810 — OCR `IconButton`(`onOcrClick`/`ocrLoading`/`OcrIcon`). **이 오른쪽에 ink 버튼 추가.**
- `components/editor/MarkdownEditor.tsx` L262 — `insertText(text, cursorOffset)` 구현. `view.dispatch({selection})`만 하고 **`scrollIntoView` 미사용**(autoHeight 함정 회피됨).
- `components/comment/CommentEditor.tsx`
  - L56~59 `ocrLoading`/`editorRef`/`ocrInputRef` — ink state 신설 위치
  - L92~130 `handleOcrClick`/`handleOcrFileChange` — 삽입은 `editorRef.current?.insertAtCursor(payload, payload.length)` + `setShowPreview(false)`
  - L146~205 `toolButtons` 묶음 — `MathSymbolPalette` → OCR `<button>` → 그림 버튼 순. **OCR `<button>` 오른쪽에 ink 버튼 추가.**
- `components/comment/LatexInputEditor.tsx` L13 — `insertAtCursor(text, cursorOffset?)` 핸들.
- `components/editor/ImageTypeSelectModal.tsx` — **모달 셸 패턴**(`position:fixed; inset:0; zIndex:9000`, 배경 `onClick={onCancel}`, 내부 `stopPropagation`, Escape `useEffect`).
- `CLAUDE.md` 주의사항 — ① dnd-kit + pointer: pointerdown 전파 차단 필수. ② autoHeight: `EditorView.scrollIntoView` 금지.

---

## 1. 목표 & 결정 (Q&A로 잠금)

| 항목 | 결정 |
|---|---|
| 인식 방식 | **스트로크 기반** (Mathpix `/v3/strokes`) |
| 세션 | **단발 호출** — `strokes_session_id` 미사용 (live 미리보기 안 함, 비용 최소) |
| 인증 | **서버 프록시**(`app_id`/`app_key` 헤더). app_token 불필요 — 기존 `/api/ocr`와 동일 |
| 입력 디바이스 | **펜·터치·마우스 모두 허용.** `pointerType` 필터 없음 |
| 멀티터치 | **활성 `pointerId` 1개만** 추적(팜리젝션). 나머지 포인터 무시 |
| 다행 처리 | **단일 캔버스 1회 호출.** Mathpix가 `\n`으로 행 분리 반환 |
| 삽입 형태 | Mathpix 구분자 옵션으로 단행 `$…$` / 다행 `$$…$$` 자동 결정 — `normalizeAndFix`가 블록 개행 정규화 |
| 미리보기 | 모달 하단 **KaTeX 렌더 + 원문 LaTeX 편집창**(확인 전 교정 가능) |
| 트리거 | **툴바 버튼만** (단축키는 후속) |
| 버튼 위치 ① | `UnifiedToolbar` — OCR 버튼 **오른쪽** (메인 2행 툴바) |
| 버튼 위치 ② | `CommentEditor` `toolButtons` — OCR 버튼 **오른쪽** (토론·agent·댓글 공용) |
| 게이팅 ① | 메인: `activeBlockId` AND `TEXT_BASED_TYPES.has(type)` |
| 게이팅 ② | 사이드바: 입력창이 열려 있으면 항상 가능(OCR과 동일) |

---

## 2. 데이터 모델

**Firestore 변경 없음.** 스트로크는 클라이언트 메모리 버퍼 → `/api/ink` → LaTeX 변환 후 **폐기**. 영구 저장하지 않으며 컬렉션·필드·룰 변경이 일절 없다.

---

## 3. 신규 파일

### 3-1. `app/api/ink/route.ts`
`/api/ocr` 복제. 입력 `{ strokes: { x: number[][]; y: number[][] } }`, 출력 `{ text, confidence } | { error }`.

```ts
// 핵심부 (의사코드)
const resp = await fetch('https://api.mathpix.com/v3/strokes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', app_id, app_key },
  body: JSON.stringify({
    strokes: { strokes: { x: body.strokes.x, y: body.strokes.y } },
    formats: ['text'],
    math_inline_delimiters: ['$', '$'],
    math_display_delimiters: ['$$', '$$'],
    rm_spaces: true,
  }),
});
// data.text 추출 → { text, confidence: data.confidence }
```
- 검증: `x`/`y`가 배열의 배열이고 각 쌍의 length 동일, 빈 입력(획 0개) 거부 → 422.
- 환경변수 미설정·Mathpix 오류 처리는 `/api/ocr`와 동일.

### 3-2. `lib/ink.ts`
스트로크 버퍼 → Mathpix 페이로드 변환 + 클라이언트 검증.

```ts
export interface Stroke { x: number[]; y: number[]; }          // 한 획
export type StrokeBuffer = Stroke[];

export const INK_MIN_POINTS = 4;                                // 최소 점 수(노이즈 컷)
export function toMathpixPayload(buf: StrokeBuffer): { strokes: { x: number[][]; y: number[][] } };
export function isEmpty(buf: StrokeBuffer): boolean;            // 점 총합 < INK_MIN_POINTS
```
- 좌표는 **CSS 픽셀**(`clientX - rect.left`)로 캡처. devicePixelRatio 스케일과 섞지 않는다.

### 3-3. `components/editor/HandwritingModal.tsx`
공용 모달. **삽입을 모름** — `onResult(latex)`만 호출.

```ts
interface Props {
  onResult: (latex: string) => void;   // 확인 시 정규화된 LaTeX 전달
  onClose: () => void;
}
```
구성:
- 셸: `ImageTypeSelectModal` 패턴 그대로(fixed·inset:0·zIndex≥9000·배경 클릭 취소·내부 stopPropagation·Escape).
- 캔버스: 고정 높이(≈5줄), `touch-action:none`. devicePixelRatio로 backing store 스케일(선명도), 입력 좌표는 CSS px.
- 포인터: `onPointerDown`에서 **`e.stopPropagation()`**(dnd-kit 충돌 차단) + `setPointerCapture`. 활성 `pointerId` 1개만 누적, 그 외 무시.
- 도구: **실행취소(획 단위 pop)**, **전체지우기**, **인식**(→ `/api/ink`), 로딩 표시.
- 미리보기: 인식 후 `normalizeAndFix(text)` 결과를 **편집 가능한 textarea + KaTeX 렌더**로 표시. 사용자가 고친 뒤 **확인**하면 `onResult(편집된 LaTeX)`.
- 빈 캔버스·인식 실패: 친절한 인라인 메시지(OCR과 동일 톤, `alert` 또는 모달 내 표기).

---

## 4. 변경 파일

### 4-1. `components/editor/EditorView.tsx`
```ts
const [inkOpen, setInkOpen] = useState(false);

const handleInkClick = () => {
  if (!activeBlockId) return;
  const b = currentBlocks.find((x) => x.id === activeBlockId);
  if (!b || !TEXT_BASED_TYPES.has(b.type)) return;
  setInkOpen(true);
};

const handleInkResult = (latex: string) => {        // 모달이 이미 normalizeAndFix 적용해 넘김
  if (!activeBlockId) return;
  const payload = `\n${latex}\n`;
  editorRefs.current[activeBlockId]?.insertText(payload, payload.length);
  setInkOpen(false);
};
```
- `UnifiedToolbar`에 `onInkClick={handleInkClick}` prop 추가.
- 렌더: `{inkOpen && <HandwritingModal onResult={handleInkResult} onClose={() => setInkOpen(false)} />}`.

### 4-2. `components/editor/UnifiedToolbar.tsx`
- `UnifiedToolbarProps`에 `onInkClick: () => void` 추가.
- OCR `IconButton`(L810) **오른쪽**에 ink `IconButton`(예: 펜+격자 아이콘, title "수식 필기"). `disabled`는 OCR과 동일하게 `showToolbar` 비활성 시.

### 4-3. `components/comment/CommentEditor.tsx`
```ts
const [inkOpen, setInkOpen] = useState(false);

const handleInkResult = (latex: string) => {
  const payload = `\n${latex}\n`;
  editorRef.current?.insertAtCursor(payload, payload.length);
  setShowPreview(false);                              // OCR과 동일
  setInkOpen(false);
};
```
- `toolButtons` 묶음에서 OCR `<button>` **오른쪽**에 ink `<button>`(동일 스타일·아이콘 규격) 추가.
- 컴포넌트 말미에 `{inkOpen && <HandwritingModal onResult={handleInkResult} onClose={() => setInkOpen(false)} />}`.
- **이 한 컴포넌트가 토론·agent·댓글 입력창 전부를 담당**하므로 추가 배선 없음.

---

## 5. 보안 규칙

`firestore.rules` / `storage.rules` 변경 **없음**. `/api/ink`는 `/api/ocr`와 동일하게 **서버 측 키만** 사용 — 클라이언트로 Mathpix 키 노출 없음. 스트로크는 인증 없는 좌표 배열이므로 별도 권한 검사 불요(원하면 로그인 게이트만 라우트 상단에 추가 가능, 현 OCR과 동일 수준 유지 권장).

---

## 6. 핵심 기술 제약 (레포 근거)

- 캔버스 `touch-action: none` — 페이지 스크롤·핀치줌 차단.
- 캔버스 컨테이너 `onPointerDown`에 **`stopPropagation()`** — dnd-kit `isDragging` 오발 방지(CLAUDE.md 명시 함정). 사이드바·블록 위에 모달이 떠도 드래그와 충돌 없음.
- 멀티터치: `setPointerCapture` + 활성 `pointerId` 단일 추적으로 팜리젝션.
- 좌표: CSS 픽셀 캡처, devicePixelRatio는 backing store 스케일에만 적용(획이 캔버스와 1:1로 보이도록).
- 삽입: `insertText` / `insertAtCursor`만 사용. **`EditorView.scrollIntoView` 호출 금지**(autoHeight 전파).
- 인식 버튼 디바운스/`inkLoading` 가드 — 연타로 인한 중복 과금 방지.

---

## 7. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| 5줄 다행 수식 행 분리 정확도 | 5줄 cap(캔버스 고정 높이)으로 복잡도 억제. 미리보기에서 사용자 교정 |
| 네트워크/인식 실패 | OCR과 동일한 친절 메시지 폴백. 스트로크 버퍼 유지해 재시도 가능 |
| 비용(호출당 과금) | 단발 호출 + `inkLoading` 가드 + 빈 입력 사전 차단 |
| 모달 zIndex 충돌(사이드바·기존 모달) | `ImageTypeSelectModal`와 동일 9000 이상, 필요 시 상향 |
| 손가락 입력 정확도(펜 대비 낮음) | 굵은 stroke 렌더 + 미리보기 교정 단계로 보완 |

---

## 8. 완료 체크리스트

- [ ] iPad Pencil / 폰 손가락 / 트랙패드 / 마우스 4종 입력 캡처 정상
- [ ] 활성 pointer 1개만 추적(두 번째 터치 무시) — 팜리젝션 확인
- [ ] 획 단위 실행취소 + 전체지우기
- [ ] 인식 → `normalizeAndFix` → KaTeX 미리보기 + 편집 → 확인 시 커서 삽입
- [ ] 메인 에디터: `TEXT_BASED_TYPES` 외 블록에서 버튼 비활성
- [ ] 사이드바: 토론·agent·댓글 입력창 3곳 모두 동작(단일 `CommentEditor` 배선)
- [ ] 빈 캔버스/인식 실패 시 친절한 메시지, 버퍼 보존
- [ ] 블록·사이드바 위 모달에서 dnd-kit 드래그 오발 없음
- [ ] `inkLoading` 중 인식 버튼 재클릭 차단

---

## 9. 커밋 가이드

- 구현·커밋까지 Claude Code, **push는 덕수가 VSCode에서 직접**.
- 권장 분할: ① `/api/ink` + `lib/ink.ts` ② `HandwritingModal` ③ EditorView/UnifiedToolbar 배선 ④ CommentEditor 배선.
- `docs/roadmap.md` 갱신, 본 phasedoc 번호 확정.
- 환경변수는 기존 `MATHPIX_APP_ID`/`MATHPIX_APP_KEY` 재사용 — 추가 설정 없음.
