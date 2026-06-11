# Phase 42: AI 토론자 그래프 도구 (v4 — 구현 완료)

> **목표**: 토론창에서 AI(민·쳇)에게 함수·좌표 그래프를 그리게 하고, 대화창의 작은 인터랙티브 그림으로 표시. 확대 버튼으로 전체화면 탐색. **AI가 그린 그래프를 클릭으로 에디터 블록(GGB/SVG/PNG)으로 저장.**
> **상태**: Step A~I 구현 완료 (2026-06-11). 남은 것: 검증 시나리오 실사용 확인 (§11)
> **선행 의존**: Phase 37 (AI 토론), Phase 34 (GGB 뷰어 인프라 + ggb/svg/image 블록), Phase 41 (검산)
> **버전 이력**: v1 → v2 코드 대조 검토 반영 / v2 → v3 그래프→블록 저장(구 42.7) 편입 / v3 → v4 코드 재대조 보완 + 구현 완료

---

## 0. 확정된 결정

| 항목 | 결정 |
|------|------|
| 렌더러 | **GeoGebra 재사용** (GgbViewer 패턴) |
| 컴포넌트 구조 | **GgbGraphView 신규** (`components/viewer/GgbGraphView.tsx`) |
| 적용 모델 | **민(google)·쳇(openai)만** — `isGraphModel`. 식은 structured output(JSON 강제)과 충돌하므로 제외, 섬·락도 우선 제외 |
| 그래프 위치 | EditorPreview 전역 (코드펜스라 자연 확장 — 토론창이 주 사용처) |
| 명세 포맷 | **GGB 명령 배열** + `view` 필수 |
| 전체화면 방식 | **인앱 오버레이** (GgbViewer 패턴 재사용) |
| #12/#13 충돌 | **#12에 carve-out 추가**: "```mathory-graph 펜스는 코드 블록 금지 규칙의 예외" |
| 라운드 내 중복 | 민·쳇 동시 선택 시 그래프 최대 2개 → 허용 (의도된 사양, 병렬 호출이라 상호 인지 불가) |
| applet 활성화 | **방금 도착한 응답의 첫 그래프만 auto-load** (패널 재오픈·페이지 재진입 시엔 모두 ▶ placeholder — GGB CDN 자동 로딩 방지). 나머지는 클릭 활성화 |
| 외부 클릭 동작 | GgbViewer와 동일하게 **외부 클릭 시 비활성화(cleanup)** 유지 |
| 그래프 → 블록 저장 | **GGB·SVG·PNG 3형식 모두 지원**. 저장 버튼은 **편집 화면(EditorView)에서만 노출** — 콜백 prop 유무로 자동 분기 (ProblemView·공유 페이지에선 숨김) |
| 블록 삽입 위치 | **현재 활성 탭(activeTab)의 블록 목록 맨 끝**에 append. 영구 저장은 기존 문제 저장 버튼 흐름 |

### 코드 재대조 검토에서 확정된 보완 (v3 → v4)

1. **전처리 위치**: EditorPreview는 `lib/preprocess.ts`가 아닌 **자체 인라인 전처리**를 사용 → `protectFences`/`restoreFences`를 EditorPreview의 `processed` useMemo에 삽입. PrintableContent는 범위 제외
2. **블록 생성 규칙**: `id: new-${Date.now()}`, `order: 0`, `isNew: true` (기존 `handleAddBlock` 패턴 — nanoid 아님)
3. **sanitize 적용 조건**: `graphEnabled`(민·쳇)일 때만 — 식의 JSON 펜스 처리(`formatStructuredResponse`)와 간섭 방지
4. **미종결 펜스 판정은 줄 단위 파서로**: regex 짝맞춤은 검산 `<details>` 안의 ```` ```python ````과 오인됨. 닫는 펜스는 CommonMark 규칙(info string 없는 ``` 줄)만 인정
5. **좌표 캡처 유틸 추출**: `lib/ggb-utils.ts` `captureGgbView(api)` — GgbViewer 초기뷰 저장과 GgbGraphView 블록 저장이 공유
6. **autoActivate 식별은 내용 비교 방식**: 렌더러 내 카운터는 StrictMode 이중 렌더에 깨짐 → `processed`의 첫 펜스 내용과 spec 문자열 비교

---

## 1. 핵심 설계 — "C 방식: 클라이언트 렌더"

- AI는 **그래프 명세(spec)만 텍스트로 emit** → 코드 실행 안 함 → 토큰 비용 거의 0
- 브라우저가 명세를 받아 **GGB applet에서 벡터 렌더** → 줌·축소·팬 내장
- 검산(Phase 41)과 **완전히 분리된 별도 기능**. 단, 두 지침이 같은 모델(민·쳇)에 동시 부착되므로 프롬프트 차원의 충돌 해소 필수 (#12 carve-out)

## 2. 동작 흐름

```
사용자가 토론 입력창에 그래프 요청 (예: "y=x^2-4 그래프 그려줘")
   ↓
[/api/discuss] 민·쳇 호출 시 시스템 프롬프트 #13(그래프 도구) 부착
   GRAPH_TRIGGER_RE 매치 시 USER_MESSAGE_GRAPH_SUFFIX로 출력 강제
   ↓
AI가 응답 본문 끝에 명세를 펜스로 emit:
   본문: "아래로 볼록한 포물선, 꼭짓점 (0,-4), x절편 ±2."
   ```mathory-graph
   { "commands": ["f(x)=x^2-4", "A=(2,0)", "B=(-2,0)"],
     "view": { "xMin": -5, "xMax": 5, "yMin": -6, "yMax": 6 } }
   ```
   ↓
[서버] sanitizeGraphFences — 미종결 펜스 제거, JSON 1차 검증, 명령 30개 상한
   ↓
[토론 패널] EditorPreview가 pre 렌더러에서 펜스를 가로채 GgbGraphView 렌더
   - 방금 도착한 응답의 첫 그래프: 자동 활성화 (작은 미리보기 240px)
   - 그 외: "▶ 그래프 보기" placeholder, 클릭 시 로드
   - ⛶ 확대 → 인앱 전체화면 / 💾 저장 → GGB/SVG/PNG 블록 (편집 화면만)
```

## 3. 구현 내역 (파일별)

### 3.1 `app/api/discuss/route.ts` (Step A·B)

- `isGraphModel(config)`: google·openai — `isCodeExecutionModel`과 현재 동일하나 향후 분리 가능성 때문에 별도 함수
- `GRAPH_TRIGGER_RE`: `/(그래프|좌표\s*평면|개형)\s*(을|를|으로|로)?\s*(좀\s*)?(그려|그리|보여|시각화)|도시해|plot\b/i` — **그리기 동사 결합형**. "이 그래프 문제 검토해줘" 같은 그래프에 *관한* 질문은 강제하지 않음 (AI 자율 판단은 #13에 명시)
- `USER_MESSAGE_GRAPH_SUFFIX`: 트리거 매치 시 user message 끝에 부착 — 펜스 출력 강제 + matplotlib 금지. 검산 suffix와 동시 부착 가능 (둘 다 "본문 자연어/펜스는 별도" 구조라 충돌 없음)
- 시스템 프롬프트 `GRAPH_INSTRUCTION`(#13): 출력 형식, GGB Classic 문법 few-shot(Intersect 인덱스 포함), view 필수, 히스토리 중복 금지, 글자수 제한 비포함, #12 예외 명시
- `CODE_EXEC_INSTRUCTION`(#12) 끝에 carve-out 한 줄 추가
- `sanitizeGraphFences(content)`: 줄 단위 파서 —
  1. 미종결 펜스(maxTokens 잘림) → 펜스 시작부터 제거 + `_(그래프 명세가 토큰 한도로 잘려 제거되었습니다)_`
  2. JSON 검증 실패 → 펜스를 `_(그래프 명세가 손상되어 표시할 수 없습니다)_`로 치환 (Firestore에 깨진 명세 영구 저장 방지)
  3. 유효 → 명령 30개 상한 적용 후 정규화 재직렬화
  - `graphEnabled`일 때만, `formatStructuredResponse` 이후에 적용

### 3.2 `components/viewer/GgbGraphView.tsx` (신규, Step C·H)

- Props: `spec`(JSON 문자열), `autoActivate?`, `onSaveAsBlock?: (save: GraphBlockSave) => Promise<string | void>` (반환값 = 토스트용 탭 이름)
- `parseGraphSpec`: 클라이언트 재검증 (서버 통과본도 신뢰하지 않음). 실패 시 "⚠️ 그래프 명세 오류" 박스 + 원문 `<details>` (본문 렌더에 영향 없음)
- 빈 applet inject (`filename` 없음) → `appletOnLoad`에서 `setCoordSystem(view)` → `evalCommand` 순차 실행 → **개별 실패 수집** (부분 렌더 + "일부 명령 실패 (N개)" 경고 배지 + console.warn) → view 재적용
- `autoActivate`는 effect로 반영 (fresh id 전파가 늦게 도착하는 타이밍 대응). false로 돌아가도 이미 활성화된 applet은 유지
- 크기: 240px(미리보기), max-width 320. 전체화면·외부클릭 비활성화·ESC·EXTRA_BOTTOM(50) 잘라내기 모두 GgbViewer 패턴
- 💾 저장 (active && onSaveAsBlock일 때만): 드롭다운 GGB/SVG/PNG
  - GGB: `api.getBase64()` → `.ggb` File. view는 `captureGgbView(api)`(사용자가 줌·팬한 **현재 시야**) ?? spec.view
  - SVG: `api.exportSVG(callback)` — `typeof api.exportSVG === 'function'` 가드, 미지원 시 메뉴 비활성. 10초 타임아웃
  - PNG: `api.getPNGBase64(2, true, 72)` (2배 스케일)
  - 드롭다운 wrapper에 `onMouseDown/onPointerDown stopPropagation` — 외부클릭 비활성화 오작동 방지

### 3.3 `lib/ggb-utils.ts` (신규)

- `captureGgbView(api): GgbInitialCoords | null` — getXmin 개별 getter → getViewProperties(1) 폴백. GgbViewer의 초기뷰 저장 로직을 추출한 것 (GgbViewer도 이를 사용하도록 리팩토링, 동작 동일)

### 3.4 `components/editor/EditorPreview.tsx` (Step D)

- `protectFences`/`restoreFences`: 전처리 파이프라인 맨 앞/맨 뒤에서 ``` 펜스 영역을 `⟦FENCE_n⟧`로 보호 (수식 보호 `⟦MATH_n⟧`과 동일 기법, 충돌 없음 확인). mathory-graph JSON과 검산 python 부록이 locale/math regex에 변형되지 않음
- `pre` 렌더러에서 `language-mathory-graph` 가로채기 (children 배열 `join('')` — 콤마 끼임 방지). 검산 ```python 등 일반 코드는 기본 `<pre>` 경로 유지
- Props 추가: `graphAutoActivate?`, `onSaveGraphAsBlock?`
- 첫 펜스 식별: `firstGraphSpec` (processed에서 regex 추출) — spec 내용 비교로 autoActivate 대상 결정

### 3.5 `components/comment/CommentPanel.tsx` (Step E)

- `stripForHistory(content)`: `buildHistory()`에서 그래프 펜스 → `[그래프 첨부됨]`, 검산 `<details>` → `[검산 코드 첨부됨]` 치환. **Firestore 저장본은 건드리지 않음** — 히스토리 조립 시에만. (토큰 낭비 + 펜스 모방 역류 차단)
- `freshAiCommentId` state: `invokeOneAI`의 `addComment` 반환 id를 기록 — 가장 최근 도착 1개만. 패널 unmount 시 소멸 → 재오픈 시 전부 placeholder
- prop 체인: CommentPanel(`onInsertGraphBlock`) → CommentThreadView → CommentItem → EditorPreview(`graphAutoActivate`, `onSaveGraphAsBlock`)

### 3.6 `components/editor/EditorView.tsx` (Step I)

- `handleInsertGraphBlock({format, file, view})`: format별 `uploadGgb`/`uploadSvg`/`uploadImage`(problemId) → 새 LocalBlock(`new-${Date.now()}`, `isNew: true`)을 현재 탭 블록 맨 끝 append → 탭 이름 반환 (토스트 표기용)
  - GGB: `ggb_initial_coords: view`(저장 시점 시야), `ggb_height: 350`
  - SVG: `svg_initial_view: null` / PNG: `<img src="…" alt="AI 그래프" width="400" />`
- CommentPanel에 `onInsertGraphBlock` 전달. ProblemView는 미전달 → 저장 버튼 자동 숨김

### 3.7 운영 (Step F — 코드 외)

- Firestore `ai_models` 민·쳇 `maxTokens` 8192 — **완료**

## 9. 비용·성능·보안

- **토큰**: 명세 수백 바이트 — 무시 가능. maxTokens 8192로 미종결 펜스 위험 낮음 (sanitize가 2중 방어)
- **GGB 로딩**: `ggb-loader.ts` 단일 로드 재사용. auto-load 최신 도착 1개뿐 + 외부 클릭 비활성화로 동시 applet 1~2개
- **저장**: 펜스 인라인 → Firestore 부담 없음. 블록 저장 시에만 Storage 업로드
- **보안**: `evalCommand`는 GGB 샌드박스 내 실행 — 임의 JS 불가. 명령 상한 30. (`Button` 등 UI 명령 차단 목록은 단일 사용자 앱이라 이번 범위 제외)

## 10. 단위 검증 (구현 시 수행 — 9/9 통과)

sanitize·protectFences 로직: 정상 펜스 정규화 보존 / 깨진 JSON 치환 / 미종결 제거+안내 / 그래프+검산 details 공존 / 명령 30개 상한 / view 누락 통과(클라 폴백) / 펜스 내부 locale 마커 보호 / 이중 펜스 분리 / 멀티 펜스 처리

## 11. 검증 시나리오 (실사용 확인 — 남은 작업)

| # | 입력 | 기대 동작 |
|---|------|-----------|
| 1 | 민에게 "y=x^2-4 그래프 그려줘" | 본문 설명 + 작은 포물선 **자동 표시**(방금 도착 응답). ⛶ 전체화면·줌 동작 |
| 2 | 같은 세션에서 추가 메시지 전송 | 이전 그래프는 ▶ placeholder로 비활성화, 새 응답 그래프만 활성 |
| 3 | 민·쳇 둘 다 선택 후 그래프 요청 | 둘 다 펜스 출력(최대 2개) → 정상. auto-load는 더 늦게 도착한 1개만 |
| 4 | 쳇에게 "검산하고 그래프도 그려줘" | 본문 자연어 + 검산 `<details>` 부록 + mathory-graph 펜스 모두 정상 동시 표시 (#12 carve-out 검증) |
| 5 | 그래프 트리거 없는 일반 질문 / "이 그래프 문제 풀이 검토해줘" | 펜스 강제 안 됨 (정규식 검증) |
| 6 | 식·섬·락에 동일 요청 | #13 미부착 → 펜스 출력 없음, 일반 답변 |
| 7 | 명세 JSON 깨짐 | "그래프 명세 오류" 폴백, 본문 정상 |
| 8 | commands에 잘못된 GGB 문법 1개 포함 | 나머지 명령은 그려지고 "일부 명령 실패" 경고 배지 |
| 9 | maxTokens를 일부러 낮춰 펜스 잘림 유발 | 서버가 미종결 펜스 제거 + 안내 문구, 메시지 렌더 안 깨짐 |
| 10 | 그래프 응답 후 다음 라운드 진행 | 히스토리에 `[그래프 첨부됨]`으로 치환되어 전달 (네트워크 탭 페이로드 확인) |
| 11 | 두 함수 교점 시각화 요청 | "P=Intersect(f,g,1)" 형태로 교점 표시 |
| 12 | 그래프 활성 상태에서 채팅 다른 곳 클릭 | applet 비활성화(cleanup) — GgbViewer와 동일 |
| 13 | 편집 화면에서 그래프 줌·팬 후 💾 → GGB 블록 | 현재 탭 맨 끝에 ggb 블록 생성, **저장 시점 시야가 초기뷰로 승계**. 문제 저장 후 재진입해도 유지 |
| 14 | 💾 → SVG 블록 / PNG 블록 | 각각 svg/image 블록 생성, 미리보기 정상. PNG는 2배 스케일로 선명 |
| 15 | ProblemView(보기 화면)·공유 페이지에서 그래프 활성화 | 💾 저장 버튼 **미노출** (콜백 부재) |
| 16 | 저장 드롭다운 열고 항목 클릭 | 외부클릭 비활성화가 오작동하지 않고 저장 완료 토스트("○○ 탭에 블록 추가됨") 표시 |

## 12. 후속·확장 (이번 범위 제외)

- **Phase 42.5**: 토론창 그래프의 PDF 인쇄 직접 포함 — 단, PNG 블록으로 저장하면 현행 인쇄에 이미 포함되므로 필요성 낮음
- **Phase 42.6**: 편집창에서 그래프 펜스 직접 삽입 UX
- 식·락 확장, evalCommand 차단 목록, GgbViewer/GgbGraphView 공통 코어 추출
