# Phase 37: AI 토론 기능 (v3)

> **목표**: 기존 댓글 패널을 '토론' 패널로 확장하여, 사용자와 복수 AI 모델이 수학 풀이에 대해 비판적으로 토론하는 기능
> **상태**: 설계 확정 (v3), 구현 대기
> **이전 버전**: v2 → v3에서 세션 구조 / AI 호출 방식 / 공유 시스템 연계 보완
> **연계 Phase**: 공개 등급/공유 시스템은 **Phase 38**로 분리. Phase 37은 비공개 문제 단독으로 동작 가능하도록 설계, Phase 38에서 공유 게이트 통합.

---

## 0. 변경 이력

### v2 → v3 변경사항 (현재)

| # | 항목 | v2 | v3 |
|---|------|-----|-----|
| 1 | 세션 구조 | 단일 흐름, "새 토론 시작" 버튼으로 세션 갱신 | **세션 = 별도 컬렉션**. 공개토론(공유 문제만, AI 불가) + 일반 토론(이름 필수, AI 가능) 분리 |
| 2 | AI 호출 방식 | 패널 상단에서 참여 AI 토글 → 매 질문 시 전원 자동 응답 | **메시지 단위 선택**. 입력창 위 AI 칩을 켜고 보내면 그 메시지만 해당 AI들에게 전송 (한 명 호출도 가능) |
| 3 | AI 토론 활성 조건 | 모든 문제에서 가능 | **비공개/팀 공유 문제만**. 공개 문제(Phase 38 도입)는 AI 토론 불가 |
| 4 | 닉네임 닉 충돌 방지 | 미정 | AI 5개 닉네임(민/섬/식/쳇/락) **예약어** — 사람이 사용 불가 |
| 5 | 닉네임 호명 규칙 | 미정 | AI는 서로/사용자를 **닉네임 한 음절**로 호명 |

### v1 → v2 변경사항

| # | 항목 | v1 | v2 |
|---|------|-----|----|
| 1 | AI 모델 라인업 | Grok 4.1 Fast | Grok 4.3 (4.1 Fast deprecated 2026-05-15) |
| 2 | 모델 API ID | `gemini-3.1-pro-latest` 등 추정값 | 공식 ID로 확정 (WebSearch 검증) |
| 3 | 토론 세션 | 없음 (영구 누적) | `discussionSessionId` 도입 |
| 4 | turnIndex 필드 | 도입 | 제거 (createdAt만 사용) |
| 5 | 컨텍스트 히스토리 | 최근 10턴 | 최근 5턴 (조정 가능) |
| 6 | 탭별 컨텍스트 | "question + 현재 탭" 일률 적용 | 탭 종류별 차등 (§3.3) |
| 7 | 닉네임 UI | 토론 패널/설정 메뉴 | 개인설정 페이지 신설 |
| 8 | 비용 추적 | 미정 | 세션별 누적 토큰 + 비용 표시 |
| 9 | 보안 모델 | Admin SDK 권장 | 클라이언트 직접 쓰기, 공개 전 전환 TODO |

---

## 1. 기능 개요

### 1.1 사용자 시나리오 (v3 개정)

1. 사용자가 토론 패널을 연다. **세션 목록**이 상단에 표시됨:
   - **공개토론** (공유된 문제에만 자동 생성, 최상단 고정, AI 불가, 이름/삭제 불가)
   - 일반 토론 세션들 (사용자가 만든 것, AI 가능)
2. 사용자가 **+ 버튼**으로 일반 토론 세션을 생성 (예: "오답 검토", "별해 탐색"). 이름 필수 입력, 추후 변경/삭제 가능.
3. 일반 세션에 진입 → 입력창 위에 **AI 칩 5개**(민/섬/식/쳇/락). 클릭으로 ON/OFF 토글. 이 칩 상태는 **이번 메시지에 호출할 AI**를 의미.
4. 사용자가 메시지 입력 → 켜진 AI들에게만 (1명이든 5명이든) 동시 전송. 칩이 다 꺼져 있으면 AI 호출 없이 사람끼리의 메모/대화만 저장.
5. AI 응답은 **도착 순서대로** 표시 (모델별 "생각 중..." 인디케이터). 응답 도착 전에도 사용자는 다음 메시지를 계속 보낼 수 있음.
6. 다음 메시지를 보낼 때 AI 칩 선택을 바꿔도 됨 (예: 첫 메시지엔 민·쳇만, 두 번째엔 식만 호출).

### 1.2 메시지 호출 규칙 (v3 개정)

- v2의 "턴" 개념 제거. **메시지 단위로 AI 호출이 독립**.
- 메시지 = "사용자 발화 1개 + 그 메시지가 호출한 AI들의 응답 N개"
- AI 호출 여부는 사용자가 칩 토글로 명시적으로 결정 → 침묵하는 메시지(메모성) 가능
- 비용 예측: `Σ(메시지별 호출 AI 수 × (컨텍스트 토큰 + 응답 토큰))`

### 1.3 세션 구조 (v3 개정)

**두 종류의 세션**:

| 종류 | 자동 생성 | AI 참여 | 이름 변경 | 삭제 | 권한 |
|------|-----------|---------|-----------|------|------|
| 공개토론 | 공유 문제(Team/Public)만 자동 생성, 최상단 고정 | ❌ 불가 | ❌ 불가 | ❌ 불가 | 문제 접근 가능자 전원 |
| 일반 토론 | 사용자가 + 버튼으로 생성 (이름 필수) | ✅ 가능 (단 비공개/Team 문제만) | ✅ 가능 | ✅ 가능 | 비공개=소유자만, Team=팀원 |

- 비공개 문제: 공개토론 세션은 생성되지 않음. 일반 토론 세션만 존재.
- Phase 37 단독 동작 시점에는 모든 문제가 비공개 취급 → 일반 토론 세션만 구현/테스트.
- Phase 38 합류 후 공개토론 세션 자동 생성 로직과 AI 활성 게이트를 동시에 켬.

### 1.4 컨텍스트 구성

AI에게 한 메시지 호출 시 전달되는 프롬프트 구조:

```
[System] 공통 기본 규칙 프롬프트 + 모델별 부록 + 참여 토론자 닉네임 목록 + 본인 닉네임

[User]
## 문제:
{question 탭 전체 블록 내용}

## 현재 풀이 (탭: {활성 탭 이름}):
{컨텍스트 규칙에 따른 탭 내용 — §3.3 참조}

## 토론 히스토리 (현재 세션, 최근 5메시지):
[KDS] 이 풀이의 논리적 결함을 지적해줘
[민] ...이전 응답...
[쳇] ...이전 응답...
[KDS] 방금 민이 준 아이디어에 대해 어떻게 생각해?

## 현재 메시지:
{사용자의 새 입력}
```

### 1.4 컨텍스트 구성

AI에게 매 턴 전달되는 프롬프트 구조:

```
[System] 공통 기본 규칙 프롬프트 + 모델별 부록

[User]
## 문제:
{question 탭 전체 블록 내용}

## 현재 풀이 (탭: {활성 탭 이름}):
{컨텍스트 규칙에 따른 탭 내용 — §3.3 참조}

## 토론 히스토리 (현재 세션, 최근 5턴):
[사용자] 이 풀이의 논리적 결함을 지적해줘
[Gemini 3.1 Pro] ...이전 응답...
[GPT-5.4] ...이전 응답...
[사용자] 방금 Gemini가 준 아이디어에 대해 어떻게 생각해?

## 현재 질문:
{사용자의 새 입력}
```

---

## 2. 확정된 결정 사항

| 항목 | 결정 |
|------|------|
| UI 명칭 | "댓글" → "토론" (헤더 텍스트, 버튼 툴팁 일괄 변경) |
| 패널 폭 | 380px → `35em` (콘텐츠 창과 동일) |
| 응답 순서 | 도착순 표시 (병렬 요청, 먼저 오는 것부터 렌더) |
| 호출 단위 | **메시지 단위** AI 칩 토글 (한 메시지에 1~5명 자유 선택, 0명도 가능) |
| 프롬프트 설계 | 공통 기본규칙 + 모델별 부록 |
| 닉네임 | `users/{uid}.nickname` 필드, 기본값 'KDS', 개인설정 페이지에서 수정 |
| AI 식별 | `authorType: 'human' \| 'ai'`, `modelId` 필드 분리 |
| 모델 관리 | 초기엔 Firestore 콘솔에서 직접 관리, 관리자 UI는 추후 |
| 탭 참조 | **탭 종류별 차등** (§3.3) |
| 세션 관리 | **별도 컬렉션** `discussion_sessions`. 공개토론(자동/잠금) + 일반 토론(사용자 생성/편집) |
| AI 활성 조건 | 비공개·Team 공유 문제만 (공개 문제는 Phase 38에서 차단) |
| turnIndex | **사용 안 함** (createdAt만 사용, 필요해지면 추가) |
| 컨텍스트 히스토리 | 현재 세션의 최근 5턴 (이후 사용 경험 보고 조정) |
| 비용 관리 | 출력 가이드 프롬프트 + 세션별 누적 토큰/비용 실시간 표시 + 누적 비용 페이지 |
| 보안 규칙 | 클라이언트 직접 쓰기 (`authorType=='ai'` 허용 룰 추가) |
| Admin SDK 전환 | **오픈소스 공개 전 TODO** (`project_phase29_auth_followup`와 같은 트랙) |
| AI 댓글 편집 | 수정/삭제 불가, "해결됨" 토글만 가능 |
| 에러 처리 | UI에만 표시, 재시도 버튼 제공 (Firestore에 영속화 안 함) |
| KaTeX 렌더링 | 기존 댓글 패널의 KaTeX 지원 그대로 활용 |
| ai_models 캐싱 | 앱 시작 시 1회 로드 + 메모리 캐시 |

---

## 3. 핵심 규칙

### 3.1 AI 응답에서 금지/권장

- `\tag{}`, `\ref{}` 등 Mathory 전용 매크로 **금지** (표준 KaTeX만)
- 곱셈은 `\times`, 분수는 `\dfrac` 사용
- 메타 표현 ("AI로서", "제 생각에는") 금지 → 본론 직진
- 응답 길이 800자 내외 권장 (프롬프트로 가이드)

### 3.2 모델 라인업 (확정)

| # | 표시명 | 닉네임 | modelId | provider | apiModelName | 입력/출력 ($/1M) | 비고 |
|---|--------|--------|---------|----------|--------------|------------------|------|
| 1 | Gemini 3.1 Pro | **민** | `gemini-3.1-pro` | google | `gemini-3.1-pro-preview` | $2 / $12 | 수학 벤치 최상위 |
| 2 | Gemini 3.5 Flash | **섬** | `gemini-3.5-flash` | google | `gemini-3.5-flash` | ~$1.5 / $9 | 사용자 검증 완료 |
| 3 | DeepSeek V4 Pro | **식** | `deepseek-v4-pro` | deepseek | `deepseek-v4-pro` | $0.435 / $0.87 | 최저가, HMMT 95.2% |
| 4 | GPT-5.4 | **쳇** | `gpt-5.4` | openai | `gpt-5.4-2026-03-05` | $2.50 / $15 | 체계적 설명 |
| 5 | Grok 4.3 | **락** | `grok-4.3` | xai | `grok-4.3` | $1.25 / $2.50 | reasoning 기본 활성 |

**닉네임 사용 정책**: AI들이 서로를 언급할 때 닉네임으로 호명 (예: "민의 지적은 타당하지만 쳇의 대안이 더 깔끔함"). 토론 패널 UI에서도 닉네임을 메시지 헤더에 표시하고 전체 모델명은 툴팁으로.

**예약 닉네임 (인간 사용 금지)**: 위 5개 닉네임(민/섬/식/쳇/락)은 사람이 자신의 닉네임으로 설정할 수 없음. `ai_models.nickname` 필드의 모든 값을 동적 예약 목록으로 간주(하드코딩 X) → 모델 추가/변경 시 자동 확장. 검증은 `lib/users.ts`의 `updateNickname()`에서 수행, 비교 시 trim 처리. 이는 **사람이 AI인 척하는 1차 UX 방어**이며, 클라이언트 조작으로 `authorType: 'ai'` 레코드 자체를 위조하는 시나리오는 별개로 [[project_phase29_auth_followup]] 트랙(Admin SDK 전환)에서 처리.

### 3.3 탭별 컨텍스트 규칙 (v2 확정)

| 활성 탭 | AI에 전송되는 컨텍스트 |
|---------|------------------------|
| `question` | question 블록만 (중복 방지) |
| `solution` | question + solution |
| `extra_N` | question + extra_N (solution 제외) |

**근거**: extra 탭은 별해/대안 풀이이므로 정해 풀이(solution)와 독립적으로 검토되어야 함. 메모/참고는 별도 탭이 아닌 풀이 탭 내에 작성하는 것이 정책.

### 3.4 프롬프트 - 공통 기본 규칙

```
당신은 한국 고등학교 수학 토론에 참여하는 전문가입니다.

토론 규칙:
1. 수식은 KaTeX 호환 LaTeX로 작성하세요. 인라인: $...$, 블록: $$...$$
2. 토론 히스토리의 모든 발언(사람, AI 구분 없이)을 전체 맥락으로 읽고, 비판적으로 평가하세요.
3. 다른 참여자의 의견에 동의하면 그 이유를, 반대하면 논리적 근거를 명확히 제시하세요.
4. 풀이의 논리적 결함, 비약, 계산 오류를 예리하게 지적하세요.
5. 대안적 풀이 방법이 있다면 제시하세요.
6. 답변은 간결하게 핵심만 전달하세요 (800자 이내 권장).
7. "AI로서", "제 생각에는" 같은 메타 표현은 쓰지 마세요. 바로 본론으로 들어가세요.
8. 곱셈 기호는 \times, 분수에서는 \dfrac를 사용하세요.
9. \tag{}, \ref{} 등 Mathory 전용 매크로는 사용하지 마세요. 표준 KaTeX만 사용하세요.
10. 다른 토론자를 언급할 때는 **닉네임(한 음절)** 으로 부르세요. 참여 중인 토론자 닉네임은 아래에 명시됩니다. "Gemini 3.1 Pro가 말한 것처럼"이 아니라 "민이 말한 것처럼"으로.

참여 토론자: {참여자 닉네임 목록을 매 요청 시 동적으로 주입 — 예: "민(Gemini 3.1 Pro), 쳇(GPT-5.4), 식(DeepSeek V4 Pro)"}
당신의 닉네임: {요청받은 모델의 닉네임}
```

### 3.5 모델별 부록 (appendPrompt)

| 모델 | 부록 |
|------|------|
| Gemini 3.1 Pro | "수식의 계산 검증에 특히 집중하세요. 숫자 대입과 연산 과정을 꼼꼼히 확인하세요." |
| Gemini 3.5 Flash | "핵심 포인트를 빠르고 간결하게 짚어주세요." |
| DeepSeek V4 Pro | "풀이의 수학적 엄밀성과 논리 전개의 완결성에 집중하세요." |
| GPT-5.4 | "풀이의 전체 논리 구조와 대안적 접근법에 집중하세요." |
| Grok 4.3 | "직관적이고 핵심을 찌르는 짧은 코멘트를 해주세요." |

---

## 4. 데이터 모델

### 4.1 UserProfile 확장

```typescript
// types/problem.ts
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  nickname?: string;          // 🆕 사용자 설정 닉네임 (기본값 'KDS'). AI 예약 닉네임(ai_models.nickname 전체) 사용 불가 — updateNickname()에서 검증
  createdAt: Date;
}
```

### 4.2 TabComment 확장

```typescript
// types/problem.ts
export interface TabComment {
  id: string;
  tabId: string;
  authorUid: string;                   // human: Firebase uid, AI: 'ai:{modelId}'
  authorType: 'human' | 'ai';         // 🆕
  modelId?: string;                    // 🆕 AI일 때 모델 ID
  content: string;
  parentCommentId: string | null;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  // 🆕 토론 세션 관리 (v3: 별도 컬렉션 참조)
  discussionSessionId?: string;        // 🆕 discussion_sessions/{id} 참조
  // 🆕 메시지가 호출한 AI 목록 (사용자 메시지에만 채워짐, AI 메시지는 빈 배열)
  invokedModelIds?: string[];          // 🆕 예: ['gemini-3.1-pro', 'gpt-5.4']
  // turnIndex는 v2에서 제거 — createdAt으로 순서 표현
}
```

### 4.3 DiscussionSession (v3 신규)

```typescript
// Firestore: problems/{problemId}/discussion_sessions/{sessionId}
export interface DiscussionSession {
  id: string;
  problemId: string;
  type: 'public' | 'normal';    // 'public' = 공개토론, 'normal' = 일반 토론
  name: string;                  // 'public' 타입은 '공개토론' 고정, 'normal'은 사용자 입력
  aiEnabled: boolean;            // public=false, normal=true (Phase 38에서 문제 가시성 체크 추가)
  createdBy: string;             // 생성자 uid (public 타입은 'system')
  createdAt: Date;
  updatedAt: Date;
}
```

**규칙**:
- `type === 'public'` 세션은 시스템이 자동 생성 (Phase 38에서 공유 문제 생성/공유 시점에). 이름 변경/삭제 불가.
- `type === 'normal'` 세션은 사용자가 생성, 이름 변경/삭제 가능.
- 한 문제에 `type === 'public'` 세션은 최대 1개.

### 4.5 AIModelConfig (신규)

```typescript
// Firestore: ai_models/{modelId}
export interface AIModelConfig {
  modelId: string;
  displayName: string;
  nickname: string;             // 🆕 한 음절 토론자 호칭 (예: '민', '쳇', '식', '섬', '락')
  provider: 'google' | 'openai' | 'deepseek' | 'xai';
  apiModelName: string;
  enabled: boolean;
  maxTokens: number;
  appendPrompt: string;
  order: number;
  avatarEmoji: string;
  // 비용 추적용 ($/1M tokens)
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}
```

### 4.6 Firestore 보안 규칙

```javascript
// tab_comments create 규칙 확장
allow create: if (
  // 기존: 인간 댓글
  (request.resource.data.authorType == 'human'
   && request.resource.data.authorUid == request.auth.uid
   && request.resource.data.resolved == false
   && (isOwnerCmt() || (isMemberCmt() && isCommenter()
       && tabAllowedForMemberCmt(request.resource.data.tabId))))
  ||
  // 신규: AI 댓글 (문제 소유자만 AI 토론 가능)
  (request.resource.data.authorType == 'ai'
   && request.resource.data.authorUid.matches('^ai:.*')
   && isOwnerCmt()
   && request.resource.data.resolved == false)
);

// AI 댓글은 수정/삭제 불가, resolved 토글만 허용
allow update: if (
  resource.data.authorType == 'ai'
    ? (request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['resolved', 'updatedAt']))
    : (기존 인간 댓글 update 규칙)
);

// ai_models 컬렉션: 읽기 전용
match /ai_models/{modelId} {
  allow read: if request.auth != null;
  allow write: if false;  // 콘솔에서만 관리
}

// discussion_sessions 컬렉션 (v3 신규)
match /problems/{pid}/discussion_sessions/{sid} {
  // 읽기: 문제 접근 권한과 동일 (Phase 38에서 가시성 규칙 통합)
  allow read: if isProblemAccessible(pid);
  // 생성: 'normal' 타입은 사용자가, 'public' 타입은 시스템 경로(서버)에서만
  allow create: if request.resource.data.type == 'normal'
                && request.resource.data.aiEnabled == true
                && request.resource.data.createdBy == request.auth.uid
                && isProblemAccessible(pid);
  // 수정/삭제: 'public' 타입은 불가, 'normal'은 생성자 또는 문제 소유자만
  allow update, delete: if resource.data.type == 'normal'
                        && (resource.data.createdBy == request.auth.uid
                            || isProblemOwner(pid));
}
```

**TODO (오픈소스 공개 전)**: AI 댓글 위조 방지 위해 Firebase Admin SDK 기반 서버 쓰기로 전환. 현재는 1인 사용 환경이라 무해. [[project_phase29_auth_followup]] 트랙에 합류.

---

## 5. 아키텍처

```
┌──────────────────────────────────────────────────────┐
│  DiscussionPanel.tsx (프론트엔드)                     │
│                                                      │
│  [사용자 입력] "이 풀이의 논리적 결함을 지적해줘"      │
│       ↓                                              │
│  selectedModels = ['gemini-3.1-pro', 'gpt-5.4', ...]│
│       ↓                                              │
│  ├─ Promise 1 ─→ POST /api/discuss  {model: gemini} │
│  ├─ Promise 2 ─→ POST /api/discuss  {model: gpt}    │
│  └─ Promise 3 ─→ POST /api/discuss  {model: deepseek}│
│                                                      │
│  각 Promise 완료 시 → Firestore에 저장 + UI 즉시 추가│
│  (도착순 렌더링)                                      │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│  app/api/discuss/route.ts (서버)                     │
│                                                      │
│  1. Firestore에서 ai_models/{modelId} 설정 로드     │
│  2. 공통 시스템 프롬프트 + appendPrompt 결합        │
│  3. provider별 분기:                                 │
│     ├─ google  → @google/generative-ai              │
│     ├─ openai  → OpenAI SDK                          │
│     ├─ deepseek → OpenAI 호환 (base_url 변경)       │
│     └─ xai     → OpenAI 호환 (base_url 변경)        │
│  4. 응답 + 사용 토큰 수 반환                          │
└──────────────────────────────────────────────────────┘
```

### 5.1 Provider별 API 호출 패턴

**Google (Gemini)**: 기존 `@google/generative-ai` SDK 그대로 사용

**OpenAI / DeepSeek / xAI**: 모두 OpenAI 호환 API → 하나의 `OpenAICompatProvider`로 통합

```typescript
class OpenAICompatProvider implements AIProvider {
  constructor(apiKey: string, baseUrl: string, model: string) { ... }
}

// base_url
// OpenAI:   https://api.openai.com/v1
// DeepSeek: https://api.deepseek.com/v1
// xAI:      https://api.x.ai/v1
```

→ 신규 의존성: `openai` npm 패키지 1개로 3개 provider 커버

### 5.2 비용 추적 (v2 신규)

- API 응답에서 토큰 사용량 추출 (`usage.input_tokens`, `usage.output_tokens`)
- Firestore에 `tab_comments.aiUsage: { inputTokens, outputTokens, costUsd }` 필드로 저장
- 토론 패널 헤더에 **현재 세션 누적 비용** 표시 (예: "이 세션: $0.012")
- 개인설정 페이지에 **전체 누적 비용** 추가 (Phase 37.5에서 구현)

---

## 6. 단계별 작업 계획

### 📌 Phase 37-A: 데이터 모델 + AI 모델 인프라 (반나절)

**목표**: 코드/UI 변경 없이 백엔드 기반만 깔기. 끝나면 단위 테스트 가능.

| Step | 파일 | 작업 |
|------|------|------|
| A-1 | `types/problem.ts` | UserProfile, TabComment 확장 + AIModelConfig + **DiscussionSession** 신규 |
| A-2 | `lib/ai-models.ts` (신규) | Firestore ai_models 컬렉션 CRUD + 메모리 캐시 |
| A-3 | `lib/ai-provider.ts` | OpenAICompatProvider 추가, getProviderForModel() |
| A-4 | `package.json` | `openai` 패키지 추가, `npm install` |
| A-5 | `.env.local` | OPENAI_API_KEY, DEEPSEEK_API_KEY, XAI_API_KEY 추가 |
| A-6 | Vercel | 동일한 환경변수 3개 등록 |
| A-7 | Firestore 콘솔 | `ai_models` 컬렉션에 5개 모델 문서 수동 추가 (§3.2 표 기준) |

**완료 기준**: `lib/ai-models.ts`의 `getEnabledModels()`가 5개 모델 반환.

---

### 📌 Phase 37-B: 토론 API 라우트 (반나절)

**목표**: HTTP로 토론 요청을 보내면 AI 응답이 돌아오는 단계.

| Step | 파일 | 작업 |
|------|------|------|
| B-1 | `app/api/discuss/route.ts` (신규) | POST handler 구현 (요청 검증 + provider 호출 + 응답) |
| B-2 | 토큰 사용량 측정 | 각 provider 응답에서 usage 추출 + 비용 계산 |
| B-3 | 에러 처리 | 타임아웃(30초), API 실패, 잘못된 modelId 처리 |
| B-4 | 수동 테스트 | curl/Postman으로 5개 모델 각각 호출 검증 |

**완료 기준**: 5개 모델 모두 POST 요청 → 정상 응답 + 토큰 사용량 반환.

---

### 📌 Phase 37-C: 댓글 → 토론 데이터 레이어 (반나절)

**목표**: 기존 댓글 시스템에 AI/세션 필드를 얹기. UI는 미변경.

| Step | 파일 | 작업 |
|------|------|------|
| C-1 | `lib/comments.ts` | mapDoc()에 authorType/modelId/discussionSessionId/invokedModelIds/aiUsage 매핑 |
| C-2 | `lib/comments.ts` | AddCommentInput 확장, addComment()에 새 필드 저장 로직 |
| C-3 | `firestore.rules` | AI 댓글 create 규칙 + AI 댓글 update 제한 + ai_models 읽기 전용 |
| C-4 | 배포 | `firebase deploy --only firestore:rules` |

**완료 기준**: Firestore 콘솔에서 수동으로 AI 댓글 문서 생성 가능, 클라이언트에서도 정상 조회.

---

### 📌 Phase 37-D: 토론 세션 관리 레이어 (반나절) — v3 신규

**목표**: 세션 CRUD 라이브러리 + 보안 규칙. UI 미변경.

| Step | 파일 | 작업 |
|------|------|------|
| D-1 | `lib/discussion-sessions.ts` (신규) | `createNormalSession(problemId, name)`, `renameSession(id, name)`, `deleteSession(id)`, `listSessions(problemId)` |
| D-2 | 동 파일 | `ensurePublicSession(problemId)` — Phase 37 단계엔 호출 안 함 (Phase 38에서 공유 문제 생성 훅에 연결). 함수 시그니처만 정의 |
| D-3 | `firestore.rules` | `discussion_sessions` 컬렉션 규칙 추가 (§4.6 참고) |
| D-4 | 수동 테스트 | 콘솔에서 normal 세션 생성/이름변경/삭제 |

**완료 기준**: 한 문제에 대해 normal 세션 2개 생성 → 이름변경 → 삭제까지 클라이언트에서 가능.

---

### 📌 Phase 37-E: 닉네임 + 개인설정 페이지 (반나절)

**목표**: 토론 UI에 앞서 닉네임 인프라부터 완성.

| Step | 파일 | 작업 |
|------|------|------|
| E-1 | `lib/users.ts` | upsertUserProfile()에 nickname 보존, updateNickname() 추가 (입력값 trim 후 ai_models.nickname 예약 목록과 대조 → 충돌 시 "'쳇'은 AI 토론자 이름이라 사용할 수 없습니다" 에러), 신규 사용자 기본값 'KDS' |
| E-2 | `app/settings/page.tsx` (신규) | 개인설정 페이지 (닉네임 편집만, 나중에 확장) |
| E-3 | `components/layout/Sidebar.tsx` | 사이드바 하단 구글 아바타 클릭 → `/settings`로 이동 |
| E-4 | 수동 테스트 | 닉네임 변경 → 새로고침 → 유지 확인 |

**완료 기준**: 사이드바 아바타 클릭 → 설정 페이지 진입 → 닉네임 수정 가능.

---

### 📌 Phase 37-F: 토론 패널 UI - 세션 + 메시지 (1.5일) — v3 개정

**목표**: 기존 CommentPanel을 토론 패널로 확장. 세션 목록 + 메시지 단위 AI 칩.

| Step | 파일 | 작업 |
|------|------|------|
| F-1 | `components/comment/CommentPanel.tsx` | 헤더 "댓글" → "토론", 패널 폭 380 → 35em |
| F-2 | 동 파일 | **세션 목록 영역**: 상단에 세션 탭/리스트 UI. 공개토론 세션이 있으면 최상단 고정·아이콘 강조, 일반 세션들 나열, + 버튼 |
| F-3 | 동 파일 | + 버튼 → 이름 입력 모달 → `createNormalSession()` 호출, 활성 세션으로 전환 |
| F-4 | 동 파일 | 일반 세션 이름변경/삭제 컨텍스트 메뉴 (생성자 또는 문제 소유자만) |
| F-5 | 동 파일 | **메시지 입력창 위에 AI 칩 5개** — ai_models 캐시 기반, 클릭으로 ON/OFF 토글. 칩 상태는 컴포넌트 로컬 상태(보내고 나서도 유지) |
| F-6 | 동 파일 | `handleSendMessage()` — 사용자 메시지 저장(`invokedModelIds` 포함) → 칩이 켜진 AI들에게 병렬 `/api/discuss` → 도착순 Firestore 저장 |
| F-7 | 동 파일 | "생각 중..." 인디케이터 — 호출된 AI별로 스켈레톤 메시지 |
| F-8 | 동 파일 | 응답 대기 중에도 사용자가 새 메시지 보낼 수 있도록 입력창 잠금 X (각 응답은 독립적으로 도착) |
| F-9 | `components/comment/CommentItem` | authorType==='ai'일 때 닉네임/아바타/모델명 툴팁 + 수정·삭제 버튼 숨김 |
| F-10 | KaTeX 렌더링 확인 | AI 응답 수식이 기존 댓글 KaTeX 파이프라인에서 렌더링되는지 검증 |

**완료 기준**: 일반 세션 2개 생성/이름변경/삭제 → 세션 진입 → AI 2개 선택 후 메시지 전송 → 도착순 응답 확인 → 다음 메시지에선 AI 1개만 선택 → 새로고침 후 보존.

**보류**: 공개토론 세션 UI는 Phase 38에서 활성화 (지금은 자동 생성되지 않으므로 화면에 안 보임).

---

### 📌 Phase 37-G: 컨텍스트 조립 로직 (반나절)

**목표**: 탭별 차등 규칙(§3.3) + 세션 히스토리 5메시지 컷오프 + 닉네임 주입 구현.

| Step | 작업 |
|------|------|
| G-1 | `CommentPanel.tsx` 내 `buildContext()` 헬퍼 — 활성 탭에 따라 question/solution/extra_N 조합 |
| G-2 | `buildHistory()` 헬퍼 — 현재 세션의 최근 5메시지 추출 (createdAt asc) |
| G-3 | `/api/discuss` 요청 페이로드에 위 두 값 + 호출되는 AI들의 닉네임 목록(시스템 프롬프트용) 포함 |
| G-4 | 시나리오별 수동 테스트: question 탭/solution 탭/extra 탭 각각 토론 |

**완료 기준**: solution 탭에서 토론 시 AI가 question 내용을 인지하고 응답, 응답 내에서 다른 AI를 닉네임으로 호명.

---

### 📌 Phase 37-H: 비용 표시 + 폴리싱 (반나절)

| Step | 작업 |
|------|------|
| H-1 | 토론 패널 헤더에 "이 세션: $X.XXX" 실시간 표시 (현재 세션 메시지의 `aiUsage.costUsd` 합산) |
| H-2 | 에러 메시지 UI ("Gemini 응답 실패 — 재시도" 버튼) |
| H-3 | 모델별 아바타 이모지, 배경색 미세 차이로 인간/AI 시각 구분 |
| H-4 | 빈 상태 ("AI를 선택하고 메시지를 입력하세요") UI |
| H-5 | 세션 전환 시 칩 선택 초기화 정책 결정/구현 (기본: 전 세션의 칩 상태 유지) |

**완료 기준**: 한 문제에 대해 2개 세션 만들고, 각 세션 비용 확인.

---

### 📌 Phase 37-I: 최종 통합 테스트 + roadmap.md 업데이트 (반나절)

| 시나리오 | 확인 |
|----------|------|
| 1 | AI 칩 5개 모두 선택 → 메시지 → 5개 응답 도착순 표시 |
| 2 | 한 모델 API 키 의도적 오설정 → 그 모델만 에러, 나머지 정상 |
| 3 | AI 칩 0개로 메시지 → AI 호출 없이 메시지만 저장 (메모) |
| 4 | AI 응답 대기 중 다음 메시지 전송 가능 확인 |
| 5 | 일반 세션 생성/이름변경/삭제 정상 동작 |
| 6 | 후속 메시지 → AI가 같은 세션의 이전 맥락 참조, 다른 세션 내용은 무시 |
| 7 | extra 탭 토론 시 solution 내용 누락 확인 |
| 8 | 닉네임 변경 → AI 프롬프트에 반영, 예약어("쳇") 시도 → 거부 |
| 9 | KaTeX 수식 정상 렌더링 |
| 10 | 모바일/태블릿 반응형 (35em 패널 폭 적정성) |

마지막: `docs/roadmap.md`에 Phase 37 완료 추가. Phase 38 시작 시 공개토론 세션 자동 생성 및 AI 활성 게이트 통합.

---

## 7. 수정/생성 파일 요약

| # | 파일 | 경로 | 작업 |
|---|------|------|------|
| 1 | problem.ts | types/problem.ts | 수정 — 타입 확장 |
| 2 | ai-models.ts | lib/ai-models.ts | **신규** |
| 3 | ai-provider.ts | lib/ai-provider.ts | 수정 — OpenAICompatProvider 추가 |
| 4 | route.ts | app/api/discuss/route.ts | **신규** |
| 5 | comments.ts | lib/comments.ts | 수정 — 신규 필드 매핑 (invokedModelIds 포함) |
| 6 | discussion-sessions.ts | lib/discussion-sessions.ts | **신규** — 세션 CRUD |
| 7 | users.ts | lib/users.ts | 수정 — 닉네임 CRUD + 예약어 검증 |
| 8 | settings/page.tsx | app/settings/page.tsx | **신규** |
| 9 | Sidebar.tsx | components/layout/Sidebar.tsx | 수정 — 아바타 클릭 라우팅 |
| 10 | CommentPanel.tsx | components/comment/CommentPanel.tsx | **대폭 수정** — 세션 목록 + 토론 UI |
| 11 | firestore.rules | firestore.rules | 수정 — AI 댓글 + discussion_sessions 규칙 |
| 12 | package.json | package.json | 수정 — openai 패키지 |
| 13 | .env.local | .env.local | 수정 — 3개 API 키 추가 |

---

## 8. 미해결 사항 (구현 중 확인)

| 항목 | 옵션 | 추천 |
|------|------|------|
| AI 칩 위치 | A. 입력창 바로 위 / B. 패널 최상단 | A (메시지 단위 선택이라 입력창과 인접해야 자연스러움) |
| "생각 중..." 표시 | A. 메시지 영역 스켈레톤 / B. 모델명 옆 스피너 | A (위치 일관성) |
| 토론/댓글 모드 전환 | A. 탭으로 분리 / B. 하나의 타임라인에 공존 | B (단순) |
| Gemini 3.5 Flash API 모델명 | 사용자가 현재 사용 중인 정확한 ID 확인 | 구현 직전 확인 |

---

## 9. 기술적 참고

### 9.1 OpenAI 호환 API 패턴

```typescript
import OpenAI from 'openai';

class OpenAICompatProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async complete(system: string, user: string, maxTokens = 1024) {
    const res = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return {
      content: res.choices[0]?.message?.content || '',
      inputTokens: res.usage?.prompt_tokens || 0,
      outputTokens: res.usage?.completion_tokens || 0,
    };
  }
}
```

### 9.2 컨텍스트 토큰 추정

- 문제: ~500 토큰
- 풀이: ~1000 토큰
- 히스토리(5턴): ~1500 토큰
- 시스템 프롬프트: ~300 토큰
- **총 입력**: ~3300 토큰
- 출력: 1024 토큰 (max_tokens 제한)

**1턴 × 5개 모델 비용 추정**:
- Gemini 3.1 Pro: 3300 × $2 + 1024 × $12 = $0.0189
- Gemini 3.5 Flash: 3300 × $1.5 + 1024 × $9 = $0.0142
- DeepSeek V4 Pro: 3300 × $0.435 + 1024 × $0.87 = $0.0023
- GPT-5.4: 3300 × $2.5 + 1024 × $15 = $0.0236
- Grok 4.3: 3300 × $1.25 + 1024 × $2.5 = $0.0067

**총합 ≈ $0.066 / 턴** (5개 모델 전부 사용 시).

> **컨텍스트 한도 메모**: 모든 모델이 1M 컨텍스트 지원 → 입력 토큰 한도는 실질적 제약 아님 (우리 사용량은 0.3% 수준). 단 **Gemini 3.1 Pro는 200K 초과 시 단가 2배** ($2/$12 → $4/$18). `max_tokens`(출력)이 실제 제약이며 모델별 `ai_models.maxTokens`로 조정. Rate limit은 실사용 후 문제 시 대응.

### 9.3 ai_models 캐싱 전략

- 앱 시작 시 `getEnabledModels()` 1회 호출 → React Context 또는 zustand에 저장
- `enabled` 플래그 변경/모델 추가 시 페이지 새로고침으로 반영
- avatarEmoji, displayName 등 UI 표시는 캐시에서 즉시 조회

### 9.4 보안 트랙

[[project_phase29_auth_followup]] — `/api/copyright/register` 무인증 이슈와 함께 묶어서 처리.
- 오픈소스 공개 전: AI 댓글을 Firebase Admin SDK 기반 서버 쓰기로 전환
- 동일 PR에서 copyright register 인증화 함께 처리 권장

---

## 10. 출처

- [Gemini 3.1 Pro Preview API](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview)
- [GPT-5.4 OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4)
- [DeepSeek V4 API docs](https://api-docs.deepseek.com/quick_start/pricing)
- [xAI Models docs](https://docs.x.ai/developers/models)
- [Grok 4.3 migration guide](https://help.apiyi.com/en/grok-4-3-release-xai-api-model-retirement-en.html)
