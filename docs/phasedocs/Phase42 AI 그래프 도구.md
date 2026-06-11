# Phase 42: AI 토론자 그래프 도구

> **목표**: 토론창에서 AI에게 함수·좌표 그래프를 그리게 하고, 대화창에 작은 인터랙티브 그림으로 표시. 확대 버튼으로 전체화면 탐색.
> **상태**: 권장안으로 결정표 확정 (2026-06-11). 외부(웹 Claude) 검토 → 보완 후 **새 세션에서 구현 착수 예정**.
> **선행 의존**: Phase 37 (AI 토론), Phase 34 (GGB 뷰어 인프라)
> **검산(Phase 41)과의 관계**: **완전히 분리된 별도 기능.** 검산은 SymPy 기호 정확값 검증, 그래프는 시각화. 트리거·프롬프트·렌더 경로 모두 독립.

---

## 1. 핵심 설계 결정 — "C 방식: 클라이언트 렌더" (승인됨)

세 후보(A: 샌드박스 stdout SVG / B: 샌드박스 파일 다운로드 / C: 클라이언트 렌더) 중 **C**로 결정.

- AI는 **그래프 명세(spec)만 텍스트로 emit** → 코드 실행 안 함 → 토큰 비용 거의 0, 잘림 위험 없음
- 브라우저가 그 명세를 받아 **클라이언트에서 벡터 그래프로 렌더** → 확대·축소·팬 내장
- 코드 실행이 불필요하므로 **민·쳇뿐 아니라 모든 모델(섬·식·락 포함)에 적용 가능** — 검산보다 적용 범위가 넓음

### 1.1 렌더러 선택 — GeoGebra 재사용 (권장) vs function-plot (대안)

| 렌더러 | 장점 | 단점 |
|--------|------|------|
| **GeoGebra (GgbViewer 재사용)** ⭐ | 전체화면·줌·팬·로딩 이미 구현됨([components/viewer/GgbViewer.tsx](../../components/viewer/GgbViewer.tsx)). 함수+기하(점·선분·각) 모두 표현. `evalCommand`로 명령 주입. 새 의존성 0 | applet 로딩이 무겁다(CDN), 작은 미리보기엔 다소 과함 |
| function-plot (D3 기반) | 가볍고 빠름, 순수 SVG | 새 의존성 추가, 함수 그래프 위주(기하 도형 약함), 전체화면·팬 직접 구현 필요 |

**확정: GeoGebra 재사용.** Phase 34 인프라(`loadGGB`, `GgbViewer`의 fullscreen/zoom)를 그대로 활용하면 요구사항 1·2·3을 신규 코드 최소로 만족한다. AI는 `.ggb` 파일 대신 **GGB 명령 배열**을 emit하고, `GgbViewer` 변형이 `evalCommand`로 주입한다.

> ✅ 결정표(11절) 권장안으로 모두 확정됨.

---

## 2. 동작 흐름

```
사용자가 토론 입력창에 그래프 요청 (예: "y=x^2-4 그래프 그려줘")
   ↓
[/api/discuss] currentMessage에 그래프 트리거 감지 → 시스템 프롬프트 #13(그래프 도구) 활성
   (코드 실행 불필요 — 모든 모델 가능)
   ↓
AI가 응답에 그래프 명세를 특수 코드펜스로 emit:
   본문: "아래로 볼록한 포물선, 꼭짓점 (0,-4), x절편 ±2."
   ```mathory-graph
   { "commands": ["f(x)=x^2-4", "A=(2,0)", "B=(-2,0)"],
     "view": { "xMin": -5, "xMax": 5, "yMin": -6, "yMax": 6 } }
   ```
   ↓
[서버] 그대로 통과 (명세가 이미 텍스트 — 직렬화 불필요). 선택: JSON 유효성 1차 검증
   ↓
[토론 패널] EditorPreview가 ```mathory-graph 펜스를 가로채 GgbGraphView 렌더
   - 대화창엔 작은 그림 (max-width ~320px, height ~240px)
   - ⛶ 확대 버튼 → 브라우저 전체화면 (GgbViewer fullscreen 재사용)
```

---

## 3. 트리거 감지

```typescript
// app/api/discuss/route.ts
const GRAPH_TRIGGER_RE = /그래프|그려\s*줘|graph|plot|좌표평면|도식화/i;
const graphRequested = GRAPH_TRIGGER_RE.test(body.currentMessage);
```

정책 (검산과 동일 철학):
- 트리거 있으면 user message 끝에 강제 지침 부착(`USER_MESSAGE_GRAPH_SUFFIX`) — 반드시 `mathory-graph` 펜스로 출력
- 트리거 없어도 AI 자체 판단으로 그래프가 설명에 도움되면 자유롭게 emit 가능
- 그래프 명세는 코드 실행이 아니므로 **provider 분기 불필요** (시스템 프롬프트만 추가)

---

## 4. 그래프 명세(spec) 포맷

```jsonc
{
  // GeoGebra 명령 배열 — 순서대로 evalCommand 실행
  "commands": [
    "f(x)=x^2-4",      // 함수
    "A=(2,0)",          // 점
    "Segment(A,B)"      // 기하 객체
  ],
  // 초기 좌표 영역 (선택). 없으면 GGB 자동
  "view": { "xMin": -5, "xMax": 5, "yMin": -6, "yMax": 6 }
}
```

- **GGB 문법을 그대로 사용** — 함수, 점, 선분, 원, 각 등 풍부하게 표현 가능
- 명세는 보통 수백 바이트 → 메시지 content에 인라인 펜스로 그대로 저장. **Firestore 1MB 부담 없음, Storage 불필요**

### 4.1 function-plot 대안 시 포맷 (참고)
```jsonc
{ "functions": [{ "fn": "x^2 - 4" }], "domain": { "x": [-5,5], "y": [-6,6] } }
```

---

## 5. 시스템 프롬프트 추가 지침 (#13)

검산 지침(#12)과 **독립**. 그래프 트리거 시 또는 항상(모든 모델) 부착:

```
13. 그래프 도구 (좌표 시각화):
- 사용자가 "그래프 그려줘", "그려줘", "plot" 등을 명시하면 반드시 그래프 명세를 출력.
- 명시가 없어도 함수·도형의 형태를 시각적으로 보이는 게 설명에 크게 도움되면 자유롭게 추가 가능.
- 출력 형식: 본문(자연어 설명) 다음에 아래 코드펜스 한 개:
  ```mathory-graph
  { "commands": ["f(x)=...", "A=(...)"], "view": { "xMin":.., "xMax":.., "yMin":.., "yMax":.. } }
  ```
- commands는 GeoGebra 문법. 함수는 f(x)=..., 점은 A=(x,y), 선분은 Segment(A,B) 등.
- view는 핵심 특징(꼭짓점·절편·교점)이 잘 보이도록 적절히 설정.
- ⚠️ 본문에는 그래프 명세(JSON/명령)를 자연어로 또 풀어 적지 말 것. 그림은 펜스로 자동 렌더됨.
- 그래프가 불필요한 질문엔 펜스를 넣지 말 것.
```

---

## 6. 렌더링 — EditorPreview 코드펜스 가로채기

### 6.1 EditorPreview에 code 렌더러 추가

[components/editor/EditorPreview.tsx](../../components/editor/EditorPreview.tsx)의 `components`에 `code` 렌더러 추가:

```tsx
code: ({ className, children, ...props }) => {
  // ```mathory-graph 펜스 감지 → GgbGraphView
  if (className === 'language-mathory-graph') {
    return <GgbGraphView spec={String(children)} />;
  }
  // 그 외(python 검산 코드 등)는 기본 렌더
  return <code className={className} {...props}>{children}</code>;
},
```

- 검산 코드(```python)는 영향 없음 — `language-python`은 기본 경로
- EditorPreview를 쓰는 모든 곳에서 동작 → 토론창이 주 사용처, 부수적으로 문제/풀이 본문에도 그래프 삽입 가능(보너스)

### 6.2 신규 컴포넌트 `GgbGraphView.tsx`

`GgbViewer`를 기반으로 한 변형. 차이점:
- 입력: `.ggb` 파일 URL 대신 **명세 문자열(JSON)** → 파싱해 `commands`/`view` 추출
- 로딩: `applet.inject` 후 `appletOnLoad`에서 `api.evalCommand(cmd)` 순회 + `api.setCoordSystem(view)`
- 작은 미리보기 크기(height ~240), 전체화면 토글 버튼은 `GgbViewer`와 동일 패턴 재사용
- placeholder "▶ 그래프 활성화" — 무거운 GGB applet을 클릭 시에만 로드(성능)

> 재사용 극대화: `GgbViewer`를 `{ url }` 또는 `{ commands, view }` 둘 다 받도록 일반화하는 방안도 검토(11절).

---

## 7. 전체화면 (요구사항 3)

`GgbViewer`에 이미 구현된 fullscreen 로직 재사용:
- `position: fixed; inset: 0; z-index: 9998` 오버레이 + `api.setSize(window.innerWidth, innerHeight)`
- ESC 종료, body overflow 잠금
- GGB 자체 줌 버튼(`showZoomButtons`) + shift-drag 줌(`enableShiftDragZoom`)으로 확대·이동

요구사항의 "브라우저 전체화면으로 SVG가 뜬다"는 **인앱 풀스크린 오버레이**로 구현(새 탭/별도 파일 불필요). GGB는 내부적으로 벡터 렌더라 확대해도 깨지지 않음.

---

## 8. 비용·성능

- **토큰 비용**: 명세 텍스트(~수백 바이트)만 출력 → 사실상 무시 가능. 검산(코드+출력)보다 훨씬 저렴
- **GGB applet 로딩**: CDN에서 deployggb.js 로드(수백 KB). 클릭 시 lazy load로 첫 페인트 부담 회피
- **저장**: 명세 인라인 → Firestore 문서 작음, Storage 미사용

---

## 9. 보안·안정성

- `evalCommand`는 **GeoGebra applet 샌드박스** 안에서만 실행 — 임의 JS 실행 아님. XSS 위험 없음
- 명세 JSON 파싱 실패 시 그래프 영역에 "그래프 명세 오류" 표시하고 본문은 정상 렌더(폴백)
- commands 문자열은 GGB가 자체 파싱 — 추가로 길이/개수 상한(예: 명령 ≤ 30개) 두어 남용 방지 권장

---

## 10. 구현 단계

| Step | 파일 | 작업 |
|------|------|------|
| A | `components/viewer/GgbGraphView.tsx` (신규) | 명세 문자열 → 파싱 → GGB inject + evalCommand 순회 + setCoordSystem. 작은 미리보기 + 전체화면(GgbViewer 패턴 재사용) |
| B | `components/editor/EditorPreview.tsx` | `code` 렌더러 추가 — `language-mathory-graph` 가로채 GgbGraphView 렌더 (python 등 기존 경로 보존) |
| C | `app/api/discuss/route.ts` | 시스템 프롬프트 #13(그래프 도구) + `GRAPH_TRIGGER_RE` + `USER_MESSAGE_GRAPH_SUFFIX`(트리거 시 강제). 검산 로직과 독립 분기 |
| D | `app/api/discuss/route.ts` | (선택) 서버에서 `mathory-graph` 펜스 JSON 1차 검증 — 깨진 JSON이면 펜스 제거 또는 경고 주석 |
| E | (성능) | GgbGraphView lazy-load(클릭 활성화) 확인 + 메시지 다수 시 동시 applet 수 제한 검토 |
| F | (검증) | 민·쳇·섬에 "y=x^2-4 그래프 그려줘" → 작은 그래프 표시 + ⛶ 전체화면 + 줌 동작 확인 |

---

## 11. 결정표 (✅ 확정 — 2026-06-11)

| 항목 | 옵션 | **확정** |
|------|------|-----------|
| 렌더러 | GeoGebra 재사용 / function-plot 신규 | ✅ **GeoGebra 재사용** (인프라 있음) |
| 컴포넌트 구조 | GgbGraphView 신규 / GgbViewer 일반화(url\|commands) | ✅ **GgbGraphView 신규** 후 공통화 검토 (위험 분리) |
| 적용 모델 | 전체(섬·식·락 포함) / 민·쳇만 | ✅ **전체** (코드 실행 불필요) |
| 그래프 위치 | 토론창만 / EditorPreview 전역(문제·풀이 포함) | ✅ **전역 허용** (코드펜스라 자연 확장) |
| 명세 포맷 | GGB 명령 배열 / 추상 함수 스펙 | ✅ **GGB 명령 배열** (표현력) |
| 전체화면 방식 | 인앱 오버레이 / 새 탭 SVG | ✅ **인앱 오버레이** (GgbViewer 재사용) |

> 외부 검토 시 위 확정안에 이견이 있으면 해당 행을 재논의. 확정안 전제로 10절 구현 단계가 작성됨.

---

## 12. 검증 시나리오

| # | 입력 | 기대 동작 |
|---|------|-----------|
| 1 | "y=x^2-4 그래프 그려줘" | 본문 설명 + 작은 포물선 그래프. ⛶ 클릭 시 전체화면, 줌 동작 |
| 2 | 트리거 없이 일반 질문 | 그래프 없이 일반 답변 (불필요한 펜스 안 나옴) |
| 3 | 두 함수 교점 시각화 요청 | commands에 두 함수 + Intersect, 교점 표시 |
| 4 | 명세 JSON 깨짐 | 그래프 영역 "명세 오류" 폴백, 본문은 정상 |
| 5 | 섬·식·락에 동일 요청 | (코드 실행 불필요하므로) 동일하게 그래프 emit 가능 |
| 6 | 검산 + 그래프 동시 요청 | #12 검산 코드 부록 + #13 그래프 펜스 둘 다 독립 표시 |

---

## 13. 후속·확장

- **Phase 42.5**: 그래프를 PDF 인쇄(PrintableContent)에 정적 이미지로 포함 (GGB → PNG export)
- **Phase 42.6**: 편집창에서 그래프 펜스 직접 삽입 UX (토론 없이 문제/풀이에 그래프)
- **Phase 42.7**: AI가 그린 그래프를 GGB 블록(Phase 34)으로 "저장"해 영구 자료화
