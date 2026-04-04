# Phase 23: AI 풀이 자동완성

> **목표**: 풀이 탭에서 문단 서두를 작성하면 AI가 나머지를 완성하는 기능  
> **핵심 컨셉**: "아이디어는 사람이, 수식 노가다는 AI가"  
> **상태**: 설계 완료, 구현 대기

---

## 1. 기능 개요

사용자가 풀이 블럭에 "삼각형 PQR에서 코사인법칙에 의하여"처럼 문단 서두를 작성한 뒤 트리거(Cmd+J 또는 블록 헤더 AI 버튼)를 실행하면, AI가 문제 내용과 이전 풀이를 참조하여 **해당 문단만** 이어서 완성한다.

### 컨텍스트 구성

AI에 전달되는 프롬프트 구조:

```
[System] 한국 고등학교 수학 풀이를 완성하는 역할.
         KaTeX 호환 LaTeX 수식 사용. 현재 문단만 완성할 것.

[User]
## 문제:
{question 탭 전체 블럭 내용}

## 이전 풀이:
{현재 탭에서 현재 블럭 위의 모든 블럭 내용}

## 현재 작성 중:
{현재 블럭의 커서 앞 텍스트}

위 내용의 현재 문단만 이어서 완성하세요.
```

### "현재 문단"의 정의

- 커서 위치에서 **위쪽으로 가장 가까운 빈 줄(또는 블록 시작)**부터 **커서 위치**까지가 "서두"
- AI 응답은 커서 위치에 이어붙이되, 한 문단 분량만 생성

---

## 2. 결정된 사항

| 항목 | 결정 |
|------|------|
| AI 모델 | Gemini 2.5 Flash (시작), 모델 교체 가능한 추상화 구조 |
| API 키 관리 | 서버 사이드 환경변수 (`GEMINI_API_KEY`), Vercel에 설정 |
| 응답 삽입 방식 | 일괄 삽입 (완성 후 한번에) |
| 트리거 UI | 단축키 `Cmd+J` + 블록 헤더 AI 버튼 (둘 다) |
| AI 버튼 위치 | 블록 헤더에서 삭제 버튼(🗑) 왼쪽 |
| 사용 범위 | 모든 탭에서 사용 가능 (question 탭은 항상 참조) |
| Undo | CodeMirror dispatch로 삽입 → Cmd+Z 자동 지원 |

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────────┐
│  EditorView.tsx (프론트엔드)                      │
│                                                   │
│  [Cmd+J] 또는 [AI 버튼]                           │
│       ↓                                           │
│  collectAIContext()                                │
│    - allBlocks['question'] → 문제 전체             │
│    - allBlocks[activeTab] → 현재 블럭 위 블럭들     │
│    - editorRefs → 현재 블럭 커서 앞 텍스트          │
│       ↓                                           │
│  POST /api/ai-complete                            │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  app/api/ai-complete/route.ts (서버)              │
│                                                   │
│  시스템 프롬프트 구성                               │
│       ↓                                           │
│  lib/ai-provider.ts                               │
│    ├─ GeminiProvider (활성)                        │
│    └─ ClaudeProvider (스텁)                        │
│       ↓                                           │
│  AI 응답 반환                                      │
└────────────────────┬────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│  EditorView.tsx                                   │
│                                                   │
│  editorRefs[activeBlockId].insertText(응답)        │
│  → CodeMirror dispatch → Undo 히스토리 포함        │
└─────────────────────────────────────────────────┘
```

---

## 4. 구현 계획

### Phase 23-A: AI 기본 완성 (RAG 없이)

#### Step 1: AI Provider 추상화

**새 파일**: `lib/ai-provider.ts`

```typescript
// 핵심 인터페이스
export interface AIProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

// 환경변수로 provider 선택
// AI_PROVIDER=gemini (기본) | claude
```

- `GeminiProvider`: Gemini 2.5 Flash API 호출 구현
- `ClaudeProvider`: 스텁 (나중에 활성화)
- Gemini API는 `@google/generative-ai` npm 패키지 사용

#### Step 2: Next.js API Route

**새 파일**: `app/api/ai-complete/route.ts`

- POST 요청 수신
- Request body:
  ```typescript
  {
    questionContext: string;   // question 탭 전체 블럭 내용
    previousBlocks: string;   // 현재 탭에서 현재 블럭 위의 모든 블럭
    currentText: string;       // 현재 블럭의 커서 앞 텍스트
  }
  ```
- 시스템 프롬프트:
  - 한국 고등학교 수학 풀이 완성 역할
  - KaTeX 호환 LaTeX 문법 사용 지시 (인라인: `$...$`, 블럭: `$$...$$`)
  - 현재 문단만 완성, 새로운 문단 시작 금지
  - Mathory 전용 매크로(`\tag{}`, `\ref{}`, locale 변환) 사용 금지 — 표준 KaTeX만
- 타임아웃: 30초
- 에러 핸들링: 적절한 HTTP 상태 코드 반환

#### Step 3: 프론트엔드 — 컨텍스트 수집

**수정 파일**: `components/editor/EditorView.tsx`

`collectAIContext()` 함수 추가:

```typescript
function collectAIContext(): {
  questionContext: string;
  previousBlocks: string;
  currentText: string;
} | null
```

- `allBlocks['question']`의 모든 블럭 `raw_text` 합산
- `allBlocks[activeTab]`에서 현재 블럭(`activeBlockId`) 위의 블럭들 `raw_text` 합산
- `editorRefs.current[activeBlockId].getContent()`에서 커서 앞 텍스트 추출
  - `getCursorPosition()`으로 커서 위치 확인
  - `getContent().substring(0, cursorPos)`

#### Step 4: 프론트엔드 — AI 완성 실행

**수정 파일**: `components/editor/EditorView.tsx`

`handleAIComplete()` 함수 추가:

- 상태: `isAILoading` (boolean)
- 흐름:
  1. `collectAIContext()` 호출
  2. `isAILoading = true`
  3. `fetch('/api/ai-complete', { method: 'POST', body })` 호출
  4. 응답 텍스트를 `editorRefs.current[activeBlockId].insertText(response, response.length)`로 삽입
  5. `isAILoading = false`
- 에러 시: 간단한 알림 표시 (alert 또는 status 메시지)

#### Step 5: UI 통합

**수정 파일**: `components/editor/EditorView.tsx`

1. **단축키 `Cmd+J`**: 기존 `useEffect` keydown 핸들러에 추가 (Cmd+B, Cmd+F 패턴과 동일)
2. **AI 버튼**: `SortableEditorBlock` 블록 헤더에 추가
   - 위치: 삭제 버튼(🗑) 왼쪽
   - 아이콘: ✨ 또는 별도 AI 아이콘 (Icons.tsx에 추가)
   - 로딩 중: 스피너로 변경 + 블록 테두리 색상 변경
3. **로딩 표시**: 블록 헤더의 AI 버튼이 스피너로 변경

#### Step 6: 환경변수 및 의존성

**수정 파일**: `package.json`
- `@google/generative-ai` 추가

**환경변수** (`.env.local` + Vercel):
```
GEMINI_API_KEY=your_gemini_api_key
AI_PROVIDER=gemini
```

---

### Phase 23-B: 기존 풀이 기반 RAG (선택적 후속 단계)

> Phase 23-A 사용 후 할루시네이션이 빈번하면 진행

#### 방식: 별도 표준 풀이 테이블 (장기 스케일링 우수)

Firestore에 `reference_solutions` 컬렉션 신설:

```typescript
{
  id: string;
  category: string;                    // 대단원 (수열, 미적분, 확률과통계 등)
  keywords: string[];                  // 검색용 태그 (코사인법칙, 이차방정식 등)
  technique: string;                   // 풀이 기법 분류
  content: string;                     // 정제된 표준 풀이 (500자 이내)
}
```

**검색 전략**:
- 1차 필터: `category` == 현재 문제의 category (Firestore 쿼리)
- 2차 필터: `keywords` array-contains 현재 문단의 키워드 (Firestore 쿼리)
- 매칭된 풀이 2~3개를 AI 프롬프트에 추가

**데이터 축적 방법**: 
- 기존 Mathory 풀이 중 표준으로 쓸 만한 것을 "표준 풀이로 등록" 버튼으로 복사
- 별도로 한꺼번에 500개를 만들 필요 없이 일상 작업 중 자연스럽게 축적

**RAG 있을 때와 없을 때의 AI 호출 비교**:

| | RAG 없이 | RAG 포함 |
|---|---|---|
| 입력 토큰 | ~1,350 | ~3,000~4,000 |
| 출력 토큰 | ~200 | ~200 |
| 응답 시간 | ~1.5초 | ~2~2.5초 |
| 1회 비용 (Gemini Flash) | ~$0.0001 | ~$0.0003 |
| 월 비용 (100회/일) | ~$0.30 | ~$0.90 |

---

## 5. 수정 대상 파일 목록

### Phase 23-A

| # | 파일 | 경로 | 작업 |
|---|------|------|------|
| 1 | ai-provider.ts | lib/ai-provider.ts | **새 파일** — AI 프로바이더 추상화 |
| 2 | route.ts | app/api/ai-complete/route.ts | **새 파일** — API 프록시 라우트 |
| 3 | EditorView.tsx | components/editor/EditorView.tsx | 수정 — 컨텍스트 수집, 핸들러, 단축키, AI 버튼 |
| 4 | Icons.tsx | components/ui/Icons.tsx | 수정 — AI 아이콘 추가 |
| 5 | package.json | package.json | 수정 — @google/generative-ai 추가 |

### Phase 23-B (후속)

| # | 파일 | 경로 | 작업 |
|---|------|------|------|
| 6 | firestore.ts | lib/firestore.ts | 수정 — reference_solutions CRUD |
| 7 | route.ts | app/api/ai-complete/route.ts | 수정 — RAG 컨텍스트 추가 |

---

## 6. 기술적 참고사항

### Cmd+J 충돌 없음
- 현재 사용 중: `Cmd+B` (블록 분할), `Cmd+F` (찾기/바꾸기)
- CodeMirror 기본 바인딩에 `Cmd+J` 없음 → 안전

### MarkdownEditorHandle 기존 메서드로 충분
- `getContent()` — 현재 블럭 텍스트
- `getCursorPosition()` — 커서 오프셋
- `insertText(text, cursorOffset)` — 텍스트 삽입 (dispatch 기반 → Cmd+Z undo 지원)
- 새로운 메서드 추가 불필요

### API 키 보안
- `GEMINI_API_KEY`는 `NEXT_PUBLIC_` 접두사 없이 설정
- `app/api/` 내에서만 접근 → 브라우저에 노출 안 됨

### Gemini 2.5 Flash 선택 이유
- 한국 고교 수학 수준의 풀이 완성에 충분
- Claude 대비 비용이 저렴하고 속도가 빠름
- 수학 추론이 부족하면 Gemini 2.5 Pro 또는 Claude로 교체 가능 (추상화 구조)

### KaTeX 문법 지시 포인트
- AI 출력은 표준 KaTeX만 사용
- Mathory 전용 전처리(`\tag{}`, `\ref{}`, locale 변환)는 사용자가 입력하는 것이므로 AI 출력에서 배제
- 인라인 수식: `$...$`, 블럭 수식: `$$...$$`

---

## 7. 미결정 사항 (구현 시 확인 필요)

| 항목 | 옵션 | 비고 |
|------|------|------|
| 로딩 상태 표시 | A: AI 버튼 스피너 + 테두리 변경 / B: 에디터 오버레이 | A 추천 |
| 에러 표시 | alert vs toast vs status 텍스트 | 기존 status 패턴 활용 추천 |
| AI 아이콘 디자인 | ✨ 이모지 vs SVG 아이콘 | Icons.tsx 스타일에 맞춰 결정 |
| question 탭에서 AI 버튼 표시 여부 | 표시하되 참조 없이 동작 / 숨김 | 표시 추천 (일반 텍스트 완성으로도 유용) |

---

## 8. RAG 방식 비교 (검토 완료)

### 기존 Mathory 풀이 활용 vs 별도 표준 풀이 테이블

| 항목 | 기존 풀이 활용 | 별도 표준 풀이 테이블 |
|------|---------------|---------------------|
| 초기 구축 비용 | 없음 | 500개 정리 필요 (큰 작업) |
| 자동완성 속도 | 1.7~2초 | 1.4~1.5초 |
| 데이터 1,000개일 때 | 약간 느려짐 | 변화 없음 |
| 데이터 5,000개일 때 | 눈에 띄게 느려짐 | 변화 없음 |
| 참고 풀이 품질 | 들쭉날쭉 | 균일하고 정제됨 |
| Firestore 읽기 비용 | 데이터 비례 증가 | 고정 |
| 유지보수 | 자동 축적 | 수동 관리 필요 |

**결론**: 장기적으로 별도 테이블이 우수. 단, "표준 풀이로 등록" 버튼으로 일상 작업 중 자연스럽게 축적하는 방식 채택.

---

## 9. Claude Code 작업 가이드

### 작업 시작 전 확인

```bash
# 레포 클론 (이미 있으면 pull)
cd /path/to/mathory && git pull

# 현재 브랜치 확인
git branch

# 의존성 설치
npm install
```

### 작업 순서

1. `lib/ai-provider.ts` 생성 → TypeScript 컴파일 확인
2. `app/api/ai-complete/route.ts` 생성 → 빌드 확인
3. `components/ui/Icons.tsx`에 AI 아이콘 추가
4. `components/editor/EditorView.tsx` 수정:
   - `isAILoading` 상태 추가
   - `collectAIContext()` 함수 추가
   - `handleAIComplete()` 함수 추가
   - keydown 핸들러에 `Cmd+J` 추가
   - `SortableEditorBlock`에 AI 버튼 추가
5. `package.json`에 `@google/generative-ai` 추가
6. `npm run build` 전체 빌드 확인

### 파일 교체 시 주의사항 (기존 교훈)

- **EditorView.tsx 수정 시**: 파일이 2,009줄로 매우 큼. 전체 교체보다 부분 수정(str_replace) 권장
- **기존 prop/메서드 누락 주의**: `borderless`, `autoHeight`, `getCursorPosition()`, `getContent()` 등 기존 기능이 누락되는 패턴이 반복됨 → 수정 전 현재 파일 반드시 확인
- **한국어 IME 단축키**: `event.key` 대신 `event.code` 사용 (기존 Cmd+B 패턴은 `event.key` 사용 중이므로 일관성 유지)

### 환경변수 설정

```bash
# .env.local에 추가
GEMINI_API_KEY=your_key_here
AI_PROVIDER=gemini

# Vercel 환경변수에도 동일하게 설정
# Vercel Dashboard → Settings → Environment Variables
```

### 테스트 시나리오

1. 풀이 탭에서 "코사인법칙에 의하여" 입력 → Cmd+J → 수식 완성 확인
2. AI 버튼 클릭으로 동일 동작 확인
3. 로딩 중 UI 표시 확인
4. 에러 시 (API 키 없음 등) 적절한 메시지 확인
5. Cmd+Z로 AI 삽입 텍스트 undo 확인
6. question 탭이 비어있을 때 동작 확인
7. 현재 블럭이 첫 번째 블럭일 때 (이전 블럭 없음) 확인