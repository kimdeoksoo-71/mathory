# Phase 41 — 다중 AI 교차검증 기반 계산·표기 오류 검출 (오류 찾기)

> Phase 25/37(다중 AI 토론)의 **별도 기능으로 추가**되는 단계.
> 기존 토론 기능은 그대로 유지하며, 토론창 위에 '오류 찾기' 세션을 신설한다.
> 본 문서는 Claude.ai 기획 → Claude Code 구현 인계용 phasedoc이며, **2026-06-09 검토 회의에서 확정된 결정**을 반영한 수정본이다.
> 작성: 2026-06-08 / 확정 수정: 2026-06-09

---

## 0. 기존 토론 기능과의 관계 (중요)

- **기존 AI 토론 기능은 그대로 둔다.** 토론창 UI 위에서 '오류 찾기'는 별도 세션 타입으로 얹힌다.
- 토론창은 두 종류의 세션을 가진다: **(1) 기존 토론(discussion)**, **(2) 신규 오류 찾기(error_finding)**.
- `sessionType` 으로 같은 `tab_comments` 컬렉션에서 구분한다.

---

## 1. 목적

수능·모의고사 수학 문제의 풀이(raw_text)에서 **단순 계산 오류와 표기 오류**를 다중 AI 교차검증으로 찾아내고, 확정된 오류를 토론창에 스레드로 보고하며, 사용자가 편집창에서 수정하면 자동 추적·완료 처리하는 기능.

핵심 원칙:
- 거창한 의견 토론이 아니라 **검증 가능한 좁은 대상**(계산·표기)에 집중.
- **오류 1건 = 스레드 1개** (1:1 매칭). 검출→검증→보고→해소까지 한 스레드가 책임.
- 모든 지점은 **raw_text의 원문 조각(anchor)에 고정**된다.

---

## 2. ⚙️ 2026-06-09 확정 결정 요약 (구현 기준)

| # | 항목 | 확정 내용 |
|---|------|-----------|
| **A** | 백그라운드 실행 | ❌ **삭제.** 토론창이 열린 동안만 동작. 창을 닫으면 작업 취소. 작업 시작 시 대화창 첫 줄에 경고 표시. 뱃지 깜빡임 알림(구 §5.2)도 삭제. → 오케스트레이션은 **클라이언트 주도**(브라우저가 단계별 API 순차 호출, 각 호출이 개별 요청). Vercel 백그라운드 워커 불필요. |
| **B** | 검출자 모델 | **`gemini-3.1-pro-preview`** (닉네임 민). code_execution + SymPy 지원 확인됨. model string은 config로 분리해 추후 A/B. |
| **C** | Gemini SDK | ⚠️ **`@google/generative-ai`(deprecated) → `@google/genai`(신 SDK)로 교체 필수.** code_execution 응답 파트(`executableCode`/`codeExecutionResult`/`text`) 파싱과 thought_signature 멀티턴이 신 SDK 기준. **기존 discuss/proofread/ai-complete 회귀 테스트를 선행 단계로 둔다.** |
| **D** | code_execution | `tools: [{ codeExecution: {} }]`. 실행환경에 sympy/scipy/mpmath/numpy 포함 확인. 실행 30초·모델 재생성 최대 5회. thought_signature는 SDK chat 세션 사용 시 자동 처리(수동 history 조립 회피). |
| **E** | 검증자(GPT) | **코드 실행 없이 텍스트 검증(번역 충실성 검토)만.** 독립 재계산은 후속으로 미룸. |
| **F** | 보고자(Claude) | ✅ **실연결 완료.** `claude-haiku-4-5`(ai_models 문서 `claude-reporter`, 닉네임 `클`). verified 건만 결론+근거 요약. |
| **G** | blockId 귀속 | ❌ 모델이 blockId를 반환하지 **않는다.** 모델은 오류+verbatim anchor만 반환, **anchor→blockId는 코드에서 결정론적 매핑.** 같은 anchorText가 여러 블록에 있을 때만 짧은 라벨 `[B1]`,`[B2]`를 컨텍스트에 주입해 모델이 라벨만 태깅(라벨→blockId 맵은 코드 보유). 풀 경로 주입 금지(주의 분산·환각 방지). |
| **H** | notation 정의 | **문제에서 의미를 부여한 변수 문자·수식 문자의 오기, 누락**만 notation. **단위 누락·정의역 표기 누락은 제외.** **괄호·첨자의 오기는 calc(계산 오류)로 분류.** notation은 의미 이해 한계가 있어 calc보다 태생적으로 오탐/미탐이 큼 → §9 측정에서 calc와 분리 측정. |
| **I** | 중복 실행 | **세션당 1회만 허용.** 실행 후 "+오류 찾기" 버튼 비활성/상태 전환. |
| **J** | 자동 resolved | anchor 소멸 감지는 **힌트(깜빡임 해제)로만.** 정식 해결은 사용자 수동 확인이 기본값. |
| **K** | 상한·동시성 | 탭당 **최대 검출 후보 10개**(Gemini 1회 호출 반환), **하위 검증 호출 동시성 5개**, 예상 비용 사전 고지. |
| **L** | 미리보기 하이라이트 | ❌ **삭제.** 대신 스레드 클릭 → 편집창에서 해당 블록 펼침+활성화+anchor 위치로 커서 이동. 편집창 블록 포커스가 미리보기를 블록 단위로 자동 스크롤(기존 `scrollPreviewToBlockTop`). 정확한 위치는 사용자가 찾음. → §5.5의 KaTeX/`$$`/tag 충돌 문제 전부 해소. |
| **M** | 검증 정족수 | **찬성 ≥ 1 → verified.** 현재 검증자 GPT 1인이라 "GPT 동의=확인". 검증자 확장 대비 임계값은 config화(≥2 등). |
| **N** | 검증 반대 | rejected('오류 의심')는 **절대 보존**, 접힌 상태로 표시. |

---

## 3. 데이터 모델 — tab_comments 확장

기존 필드(`authorType`, `modelId`, ...)에 추가:

```
sessionId       string   오류 찾기 세션 ID
sessionType     enum     discussion | error_finding   (기존 토론과 구분)
critiqueId      string   오류 스레드 고유 ID (1:1 매칭 축)
role            enum     critic | verifier | reporter | user
status          enum     detected | verified | rejected | reported | resolved
errorType       enum     calc | notation
anchor          object   { blockId, anchorText, occurrenceIndex }
                         · anchorText = raw_text에서 그대로 복사한 부분 문자열(verbatim)
                         · occurrenceIndex = 블록 내 동일 조각의 N번째
                         · blockId = 코드가 매핑(모델 반환 아님, §2-G)
                         · snapshot = 검출 기준 raw_text(해소 추적 기준)
payload         string   역할별 발언 (검출 지적 / 검증 판정 / 보고 요약)
evidence        object?  calc 전용: { sympyCode, sympyOutput, verdict }  (Firestore 1MB 한도 고려)
```

- `watchAllComments`는 **`sessionType` 쿼리 필터를 분리**해 error_finding 스레드가 기존 토론 기본 목록에 섞이지 않게 한다.
- `data-critique-id` 등 DOM 주입 값은 escape/검증.

### 상태머신

```
detected ──찬성≥1──▶ verified ──Claude 정리──▶ reported ──사용자 수정──▶ resolved
    │
    └──찬성=0──▶ rejected (보존·접힘)
```

---

## 4. 역할 구조 (명시적 포함 방식)

논리적으로 Critic→Verifier→Reporter 3역. **현재 3사 구성**(Qwen 보류).

| 역할 | 모델 | 코드 실행 | 담당 |
|------|------|-----------|------|
| **검출자** Critic | Gemini (`gemini-3.1-pro-preview`) | ✅ 내장 code_execution + SymPy | 블록 전체 맥락으로 오류 후보 검출. calc는 code_execution으로 SymPy 검산, 코드+출력+판정 반환 |
| **검증자** Verifier | GPT (5.4) | ❌ 텍스트 검증만(§2-E) | 검출 지점의 타당/반박 판정. calc는 **번역 충실성**(LaTeX→SymPy 이식이 맞는지) 검토. 독립 재계산은 후속 |
| **보고자** Reporter | Claude (`claude-haiku-4-5`) | ❌ | verified 건만 결론+근거 요약(calc는 정답값 포함). 토론 비참여 제3자라 이해충돌 없음 |

> Qwen 합류는 Alibaba Cloud API 키 발급 후. 합류 시 검증자 2인 체제 → 정족수 임계값(§2-M) 재검토.

---

## 5. 검증 파이프라인

### 5.1 errorType별 분기

```
Gemini(검출자): 블록 전체 맥락 입력 → 오류 후보 검출 (최대 10개, §2-K)
  │
  ├─ calc:
  │     Gemini가 code_execution으로 SymPy 검산
  │       → 응답 parts에서 executableCode / codeExecutionResult / text 구조적 분리
  │       → 코드 출력과 텍스트 결론의 일관성 체크 (불일치 시 INDETERMINATE)
  │       SymPy 판정 3종:
  │         CONFIRMED_OK    → rejected 자동 기각 (실행 성공·SymPy 일치 → 최고 가치)
  │         CONFIRMED_ERROR → "강한 의심"으로 검증자(GPT) 전달
  │                            GPT: 번역 충실성 검토(이식이 원문과 등가인가)
  │                            → 찬성 ≥ 1 이면 verified
  │         INDETERMINATE   → 검증자(GPT) 일반 판정으로 폴백
  │
  └─ notation (§2-H 정의):
        GPT 검증 (찬성 ≥ 1 → verified / 0 → rejected)

Claude(보고자): verified 건만 결론+근거 정리(calc는 정답값) → reported
사용자: 편집창 수정 → anchorText 소멸 감지(힌트) → 수동 확인 시 resolved
```

설계 의도:
- SymPy는 calc의 **1차 필터 + 실행 방패**이지 최종심이 아니다(검출자 추출 오역 가능성 때문).
- 검증자는 "계산이 맞나"(LLM 약점)가 아니라 **"이식이 맞나"**(번역 충실성, LLM 강점)를 본다.
- "검증 가능한 것만 검증": 여러 줄 변형·기하 그림 의존·애매한 라즈음은 SymPy에 넣지 말고 INDETERMINATE.

### 5.2 실행 최소 수준 (확정)

- **추출 1회 + CONFIRMED_OK 자동 기각** 경량 버전으로 시작.
- 오측 오류율 본 뒤 필요하면 "추출 2회 교차"로 승격(후속).

### 5.3 SymPy 계산 규칙 (검출자 Gemini 프롬프트에 포함)

- 등식 비교는 `==`가 아니라 **`.equals()`** (sin(2x) vs 2sin(x)cos(x) 등 대칭 인식).
- 수치 리터럴은 float 금지 → **`Rational`/`Integer`**, `parse_expr(..., rational=True)` 병용.
- 블록의 암묵 정의·조건(단, x>0 등)을 전제로 함께 코드에 반영.
- 결과는 반드시 3종(CONFIRMED_ERROR/OK/INDETERMINATE) 중 하나.
- 계산 코드와 출력을 응답에 그대로 포함(토론창 증거 첨부용).

### 5.4 Gemini code_execution 메모 (신 SDK `@google/genai` 기준)

- 호출 시 `config: { tools: [{ codeExecution: {} }] }` 명시 선언.
- 실행환경에 sympy 포함, 실행 1회 30초·재프롬프트 없이 5회 한도.
- thought_signature: SDK chat 세션 사용 시 자동. 수동 history 조립 회피.
- calc 의심 건에만 도구를 쓰게 비용·지연 통제.

---

## 6. UI 동작

### 6.1 "+오류 찾기" 버튼 & 세션 실행

- 토론창 **상단 둘째 줄(댓글, +토론 줄 옆)에 "+오류 찾기" 버튼**.
- 클릭 → 오류 찾기 세션 생성 + 해당 탭 전체 검출 스레드 생성이 **자동 시작**(라운드 수동 X).
- **세션당 1회만**(§2-I) — 실행 후 버튼 비활성/상태 전환.
- **작업 중 대화창 첫 줄에 경고**: "창을 닫으면 작업이 취소됩니다"(§2-A).
- 백그라운드·뱃지 알림 없음(§2-A).

### 6.2 토론창 (오류 찾기 세션 내부)

- 스레드 목록 = 오류 목록. 스레드 카드에 status 배지(오류 확인 / 오류 의심 / 보고됨 / 해소됨).
- calc 건은 계산 코드+출력을 접이식 첨부, **"계산됨" 배지**로 구분(머릿속 추론 ≠ 도구 계산 ≠ 증거 등급).
- rejected('오류 의심')는 접힌 상태로 보존, 펼쳐볼 수 있게.

### 6.3 스레드 클릭 → 편집창 커서 이동 (미리보기 하이라이트 대체, §2-L)

- 스레드 클릭 → 대상 블록 펼침(`collapsed:false`) + `setActiveBlockId` + anchor 위치로 커서 이동.
  - 구현은 기존 [EditorView.tsx `handlePreviewMathClick`](../../components/editor/EditorView.tsx) 패턴 재사용(setSelection → focus → 스크롤).
- 블록 포커스 진입이 [`scrollPreviewToBlockTop`](../../components/editor/EditorView.tsx)을 트리거 → 미리보기가 **블록 단위로 자동 스크롤**(상단 80px). 정확한 줄은 사용자가 찾음.
- anchor 오프셋 계산은 유지: `blockId + anchorText + occurrenceIndex` → 블록 문서 내 N번째 출현의 char offset. `Decoration.mark` 없이 커서 배치만이라 단순.

### 6.4 신규 인프라

- **`blockId → EditorView ref` 레지스트리** 필요(블록마다 CodeMirror 인스턴스가 따로라, 대상 블록 에디터로만 커서/스크롤 라우팅).

### 6.5 완료 추적

- raw_text 변경 시 각 reported 스레드의 anchorText 존재 여부 검사(debounce).
- 소멸 → **힌트(깜빡임 해제)**. 정식 resolved는 사용자 수동 확인(§2-J). 자동 resolve는 양방향 취약(값만 고치면 안 사라짐 / 무관 편집으로 거짓 해소)하므로 기본값 아님.

---

## 7. 구현 단계

| 단계 | 내용 | 상태 |
|------|------|------|
| **0. 선행** | **Gemini SDK 교체**(`@google/generative-ai`→`@google/genai`) + 기존 discuss/proofread/ai-complete 회귀 테스트 | ⏳ |
| **A. 검출** | 검출자(Gemini) 반환 포맷 확정 + 세션/스레드 생성 + 토론창 목록 표시. blockId 코드 매핑(라벨 보조) | |
| **B. 계산** | calc: code_execution 연동, 3종 판정, 일관성 체크, 증거 첨부 | |
| **C. 검증·보고** | GPT 검증(찬성≥1, calc=번역 충실성 / notation=일반) + Claude 건별 즉시 보고 | |
| **D. UI·세션** | "+오류 찾기" 버튼, 세션 자동 실행, 창 닫으면 취소 경고 | |
| **E. 커서 이동** | 스레드 클릭 → 편집창 커서+블록 단위 미리보기 스크롤. blockId→EditorView 레지스트리 | |
| **F. 완료 추적** | anchor 소멸 감지(힌트) → 수동 확인 시 resolved | |

선결 완료분(이번 단계에서 처리):
- ✅ **Claude provider 실구현** ([lib/ai-provider.ts](../../lib/ai-provider.ts)) — `claude-haiku-4-5` 라이브 검증.
- ✅ **proofread Claude 재전환** ([app/api/proofread/route.ts](../../app/api/proofread/route.ts)) — tool_use 강제.
- ✅ **ai_models `claude-reporter` 등록** (닉네임 `클`, enabled true).

### PoC (단계 A·B 이전)

1. 신 SDK `@google/genai`로 Gemini code_execution을 켜고, 일부러 틀린 식이 든 풀이 1개 입력.
2. "SymPy로 검산해 3종으로 보고" 프롬프트 → 응답 parts에서 executableCode/codeExecutionResult/text 분리 확인.
3. anchorText verbatim 반환 안정성 확인(한국어+LaTeX 혼합 원문 기준).

---

## 8. PoC 합격 기준 / 측정 (§2-9)

- **GPT 단독 판정의 오탐률/미탐률**을 측정 항목으로 둔다.
- **calc와 notation을 분리 측정**(notation은 의미 이해 한계로 태생적 오차 큼).
- 측정 수치로 **Qwen 합류 우선순위**를 결정.
- 합격이면 단계 A·B 진입.

---

## 9. 알려진 한계

- **추출 오역**: 검출자가 LaTeX를 잘못된 SymPy 식으로 옮기면 SymPy가 "틀린 식을 정확히" 계산. 대응 = 코드 증거 공개 + 검증자 번역 충실성 검토 + 3종 보수 판정.
- **검증자 1인 한계**: 현재 GPT 단독이라 "찬성≥1=GPT 동의". 교차검증 본 취지(서로 다른 맹점)는 Qwen 합류 전까지 약함. PoC에서 수용하되 오측률 높으면 Qwen 우선.
- **의미 이해 한계**: 코드 실행은 강하나 의미·표기 이해는 약함. notation은 일반 LLM 판정 유지.
- **float 오염**: 입력에 float 있으면 SymPy 무력. 프롬프트 규칙 + rational=True 이중 방어.
- **anchorText 중복/불일치**: occurrenceIndex로 보완, AI가 verbatim을 어기면 위치 고정 실패 → PoC #3 검증.
- **창 닫으면 취소**(§2-A): 백그라운드 없음. 클라이언트 주도라 탭 유지 필요.

---

## 10. 미해결·후속

- **Qwen 합류**: Alibaba Cloud API 키 발급 후. 검증자 2인 → 정족수 임계값 재검토.
- **GPT 독립 재계산**(Code Interpreter / Responses API): OpenAICompatProvider가 chat completions 기반이라 별도 API 표면 필요. 후속.
- **추출 2회 교차 승격**: 오측률 보고 판단.
- **Gemini SDK 마이그레이션 회귀**: 기존 기능 영향 범위가 넓으니 별도 선행 단계로 분리.
