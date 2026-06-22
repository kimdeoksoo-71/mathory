# Phase 47 — 댓글 / agent 분리

> 기존 통합 토론 패널을 **'댓글'**(사람 전용·문항당 단일 스레드)과 **'agent'**(AI·문항 단위 다중 세션)로 분리한다.
> 직전 phase는 **Phase 46(콘텐츠 이미지 배경 treatment)** → 이 문서가 **Phase 47**.
>
> **핵심 설계:** 토론은 이미 문항 단위(per-problem)로 존재하므로 그대로 재사용한다 — **세션에 `tabId`를 추가하지 않으며 마이그레이션이 없다.** 토론(특히 풀이)이 문제 내용을 참조하므로 agent의 자연스러운 컨텍스트 단위는 "탭"이 아니라 "문항 전체(문제+풀이)"다.
>
> **영속 식별자 유지 원칙:** Firestore 컬렉션명 `tab_comments`와 문서 필드 `tabId`는 **이름 그대로 유지**한다(데이터 마이그레이션 회피). 문항 단위로 의미가 바뀌었으나 데이터 호환을 위해 명칭만 보존하고, 코드 레벨 명칭은 전수 리네임한다(§11).

---

## 0. 선행 확인 (구현 직전 반드시 읽을 것 — 라인 번호는 작성 시점 기준, 변동 가능)

- `types/problem.ts` — `TabComment`(L32), `DiscussionSession`(L84, `type`에 `'comment'` 추가 예정), `Problem`(L1). **`resolved`(L38)는 유지.**
- `lib/comments.ts` — `addComment`(L69, `tabId` 필수 유지), `watchAllComments`(L102), `countByTab`(L145), `buildThreads`(L160). `resolved`(L42·76·148) **그대로 둠**.
- `lib/discussion-sessions.ts` — `createNormalSession`(L62)/`renameSession`/`deleteSession`/`listSessions`(L100). `ensurePublicSession`(L117)은 throw stub → **`ensureCommentSession`으로 신설 구현**.
- `components/comment/CommentPanel.tsx` — 세션 초기선택·탭 필터(L196~216 `c.tabId !== activeTabId`), `isAISession`(L225), 비용 집계(L228), pendingAI 필터(L233), AI 호출(`invokeOneAI`/`pendingAI`/`selectedModelIds`), 컨텍스트 수집 `fetchTabBlocksText`(활성탭 한정 → 전탭으로 보강), 입력창·LLM 모델 선택 UI, `isOwner`/`canComment`.
- `components/problem/ProblemView.tsx` — 제목행 `제목 + <BlockchainBadge>`(~L585), 탭 라벨행 `라벨 + 복사버튼 + 💬버튼`(~L640), `setCommentPanelTab`/`commentCounts`, `CommentPanel` 렌더(~L946).
- `components/editor/EditorView.tsx` — 토론 토글 버튼(~L2543 `setDiscussionOpen`/`commentCounts[activeTab]`), `CommentPanel` 렌더(~L2747).
- `firestore.rules` — `tab_comments`(L112~199), `discussion_sessions`(L208~). `resolved` 검사(L150·162·180·186) **유지**, `tabAllowedForMemberCmt`(L129) **제거 예정**.
- `app/globals.css` — Phase 44 시맨틱 시멘틱 토큰. 패널 배경 키 차별화용 토큰 추가.

---

## 1. 목표 & 결정

| 항목 | 결정 |
|---|---|
| **댓글** 세션 수 | **문항당 단 1개**(`type:'comment'`, 멱등 생성). 복수 생성 불가 |
| 댓글 범위 | **문항 전체 단일 스레드**(탭 필터 없음) |
| 댓글 입력창 | **LLM 아이콘/모델 선택 없음.** AI 호출 불가 |
| 댓글 쓰기 권한 | `역할 'commenter'` AND `commentsWritable`. 오너는 항상 가능 |
| 댓글 가시성 | 전원에게 보임. 오너가 `commentsVisible`로 숨김 가능 |
| **agent** 세션 | **문항 단위로 다수**(`type:'normal'`·`aiEnabled:true`). **탭과 무관**. 기존 normal 세션 그대로 사용 |
| agent 컨텍스트 | **문제 탭 + 풀이 탭 + extra 탭(들) 전체**를 AI에 전송. **합산 상한 15,000자** |
| agent 권한 | **오너 전용**(생성·읽기·쓰기 모두) |
| 시각 차별화 | **댓글 패널 배경 키를 agent 패널과 다르게** |

> extra_N = 문제/풀이 외 사용자가 추가한 **문서 탭**(풀이2·참고 등). AI 토론 내용이 아님([EditorView.tsx](../../components/editor/EditorView.tsx) `startsWith('extra_')`).

---

## 2. 데이터 모델

### 2-1. 세션 — `'comment'` 타입 신설
```
problems/{id}/discussion_sessions/{sid}
  ├─ type: 'comment' | 'normal' | 'public'   // 'public'은 옛 미구현 의미 → 미사용으로 잔존
  ├─ aiEnabled: boolean
  └─ name, createdBy, createdAt, updatedAt    // tabId 추가하지 않음
```
- **댓글 세션** = `type:'comment'`, `aiEnabled:false`, `createdBy: ownerUid`. **문항당 1개**(`ensureCommentSession` 멱등 생성).
- **agent 세션** = `type:'normal'`, `aiEnabled:true`. **문항당 다수**, 탭 무관. 기존 normal 세션 그대로 사용.
- `'public'`: Phase 37/38에서 구상됐으나 미구현. **신규 생성하지 않고** 타입 유니온에만 잔존.

### 2-2. 문항 레벨 토글 2개 (오너 댓글 제어)
```
problems/{id}
  ├─ commentsVisible:  boolean   // 기본 true. false = 댓글을 오너에게만
  └─ commentsWritable: boolean   // 기본 true. false = 멤버 댓글 작성 동결(오너는 가능)
```
- `Problem` 인터페이스에 옵셔널 필드 추가 + `setCommentsVisible`/`setCommentsWritable` setter 신설.
- 미설정은 클라이언트·규칙 모두 `true`로 간주(`get(..., true)`).

### 2-3. 마이그레이션 — 사실상 없음
- 세션 `tabId` 백필 **불필요**. 기존 normal 세션은 agent 세션으로 그대로 동작.
- 기존 세션 없는("legacy") 사람 댓글(`discussionSessionId == null`): 댓글 모드에서 댓글 세션 메시지와 **함께** 표시되어 별도 이관 없이 흡수됨.
- **영속 식별자(`tab_comments` 컬렉션, `tabId` 필드)는 변경하지 않음.** `tabId`는 이제 잔존 필드(필터·권한에 미사용).

---

## 3. UI — 패널 분리 (CommentPanel `mode` 분기)

대규모 리팩터링 대신 `mode` prop 분기. **기존 props 전부 보존** + `mode: 'comments' | 'agent'`. **두 모드 모두 문항 전체 범위 → 기존 `c.tabId !== activeTabId` 탭 필터(L210) 제거.**

### 3-1. mode='comments' (댓글)
- 데이터: 댓글 세션(`type:'comment'`) 메시지 + legacy(`discussionSessionId == null`). 문항 전체.
- UI: **세션 pill 없음**(세션 1개), **'+새 세션' 없음**, **입력창 LLM 아이콘/모델 선택 없음**, AI 경로 비활성. 사람 댓글 스레드(`parentCommentId`)만.
- 사용: 오너 + 멤버(가시성·쓰기권한 충족 시).

### 3-2. mode='agent'
- 데이터: 문항의 `'normal'` 세션 전부 + 메시지. 탭 무관.
- 컨텍스트: AI 호출 시 **문제 탭 + 풀이/extra 탭(들) 전체**를 전송. `fetchTabBlocksText`를 활성탭 한정에서 **모든 탭 수집**으로 보강. **합산 15,000자 상한** — question 탭 보존, 초과 시 solution→extra 순으로 뒤에서 잘림 + 잘림 로그.
- UI: 기존 토론 패널 그대로 — 세션 pill, '+새 세션'(이름 필수), 입력창 LLM 아이콘/모델 선택, AI 호출·비용.
- 사용: **오너 전용.**

### 3-3. 시각 차별화
- `globals.css`에 토큰 추가(단일 소스): `--bg-panel-agent`(기존 패널 키 유지) / `--bg-panel-comment`(다른 키 — 더 중립/차분한 화면). 패널 루트에 모드별 배경만 다르게.
- 정확한 색감은 Phase 44 디자인 시스템과 조화되게 디자인 단계에서 확정.

---

## 4. 진입 버튼 배치

### 4-1. ProblemView — 제목행에 두 버튼, 탭 라벨행 💬 제거
- 제목행(~L585) `제목 + <BlockchainBadge>` 오른쪽에 순서대로:
  1. **댓글 버튼**(블록체인 배지 바로 오른쪽). 카운트 = 문항 전체 댓글 수. 노출: `user && (isOwnerView || isMemberView)`(멤버는 `commentsVisible`일 때).
  2. **agent 버튼**(댓글 버튼 오른쪽). 카운트 = 문항의 agent 세션 수. 노출: **오너 전용**(`isOwnerView`).
- **탭 라벨행은 1행 그대로 간결하게**: `탭 라벨 + 복사 버튼`만. **기존 💬 버튼(~L666) 제거**(제목행으로 이동).

### 4-2. EditorView — 토글 버튼을 댓글로, 그 오른쪽에 agent
- **토글 토론 토글 버튼(~L2543 `setDiscussionOpen`)을 '댓글' 버튼으로** 전환. 카운트 = 문항 전체 댓글 수.
- **agent 버튼**을 그 **바로 오른쪽**에 신설. 카운트 = agent 세션 수.
- 상태: `drawerOpen` + `panelMode: 'comments' | 'agent'`. 토글형 — 두 버튼 모두 토글. EditorView는 오너 편집 화면이라 둘 다 노출.

---

## 5. 보안 규칙 (`firestore.rules`)

헬퍼:
```
function commentsVisible()  { return parentData().get('commentsVisible', true) == true; }
function commentsWritable() { return parentData().get('commentsWritable', true) == true; }
// 참조 세션이 댓글 세션인지 (멤버는 댓글 세션에만 작성 가능)
function isCommentSessionRef(sid) {
  return sid == null
    || get(/databases/$(database)/documents/problems/$(problemId)/discussion_sessions/$(sid)).data.type == 'comment';
}
```

**tab_comments**
- **`tabAllowedForMemberCmt` 제거** — 댓글이 문항 단위가 되었으므로 탭 가시성 검사 삭제(결정 5).
- **`resolved == false` 검사 유지**(결정 2 — resolved 스키마 유지).
```
allow read: if isOwnerCmt() || (isMemberCmt() && commentsVisible());

allow create: if (
  // 사람 댓글
  request.resource.data.get('authorType','human') == 'human'
  && request.resource.data.authorUid == request.auth.uid
  && request.resource.data.resolved == false
  && (
       isOwnerCmt()
       || ( isMemberCmt() && isCommenter() && commentsWritable()
            && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)) )
     )
) || (
  // AI 메시지 (agent) — 오너만
  request.resource.data.authorType == 'ai'
  && request.resource.data.authorUid.matches('^ai:.*')
  && request.resource.data.resolved == false
  && isOwnerCmt()
);

// update/delete: 기존 resolved 토글·content 수정·삭제 규칙 그대로 유지.
```
> 결정 6: 멤버 사람 댓글은 **댓글 세션 또는 legacy(null)** 에만 작성 가능(`isCommentSessionRef`). agent(normal) 세션 작성은 오너만.

**discussion_sessions**
```
// 댓글 세션(comment): 오너가 문항당 1개 (멱등 생성)
allow create: if request.resource.data.type == 'comment'
  && request.resource.data.aiEnabled == false
  && request.resource.data.createdBy == request.auth.uid
  && isOwnerSess();
// agent 세션(normal): 오너만 (tabId 없음)
allow create: if request.resource.data.type == 'normal'
  && request.resource.data.aiEnabled == true
  && request.resource.data.createdBy == request.auth.uid
  && isOwnerSess();
// read/update/delete: 기존 정책 유지(오너 OR 멤버 read 등)
```
- '문항당 1개' 일관성은 `ensureCommentSession` 멱등 로직으로 보장(존재 시 no-op), UI에 중복 생성 경로 없음.
- 오너 토글(`commentsVisible/Writable`)은 `problems` update → 기존 `isOwner()` 범위 내.

> **알려진 한계(개인용·공개 전 보류):** `tab_comments` read는 list 쿼리 사전검증 한계로 `오너 OR 멤버` 수준 유지 → 규칙 레벨에선 멤버가 agent AI 메시지도 읽을 수 있음. UI에서 agent 모드를 오너 전용으로 가려 차단. 오픈소스 공개 전 세션 단위 read 분리 재검토(§10).

---

## 6. lib / 헬퍼 변경

- `lib/discussion-sessions.ts`:
  - **`ensureCommentSession(problemId, ownerUid): Promise<string>` 신설** — 문항에 `type:'comment'` 세션 있으면 id 반환, 없으면 1개 생성 후 id 반환(`createdBy: ownerUid`). 기존 throw stub `ensurePublicSession` 제거.
  - `createNormalSession`/`listSessions` 시그니처 **변경 없음**(tabId 미추가).
- `lib/comments.ts`:
  - 댓글 스트림 = 댓글 세션 메시지 + `discussionSessionId == null`.
  - **`countComments(comments, commentSessionId)`**: `discussionSessionId`가 null이거나 댓글 세션 id인 댓글 수.
  - **`countAgentSessions(sessions)`**: `type === 'normal'` 세션 개수.
  - 기존 `countByTab`은 사용처 정리(§11 리네임 맵). `resolved`·`unresolvedOnly`는 유지.
- `lib/firestore.ts`: `setCommentsVisible`, `setCommentsWritable` setter 추가.
- `components/comment/CommentPanel.tsx`:
  - 컨텍스트 수집 활성탭 한정 → **문제+풀이+extra 전체**(15,000자 상한, §3-2).
  - 탭 필터(L210) 제거(두 모드 문항 전체).
  - 세션 초기선택/`LEGACY_SESSION_ID` 로직을 **모드별로 분리**(§9).

---

## 7. 오너 제어 UI
댓글 패널 헤더(오너에게만) 토글 2개: "댓글 보이기"(`commentsVisible`) / "댓글 쓰기 허용"(`commentsWritable`).

---

## 8. 세션 선택 상태기계 재작업 (결정 9)
- comments 모드: 세션 셀렉터 **없음**. `commentSessionId`(ensureCommentSession 결과) + legacy(null) 고정 표시.
- agent 모드: 기존 세션 셀렉터 유지(normal 세션 목록, '+새 세션', 이름변경/삭제).
- `LEGACY_SESSION_ID`·`initialSelectionDoneRef` 초기선택 로직은 agent 모드에만 적용. comments 모드는 선택 개념 자체가 없음.

---

## 9. 리스크 & 주의사항
- **컨텍스트 전탭 전송(15,000자 상한)**: question 보존, 초과 시 solution→extra 뒤에서 잘림 + 로그. 실제 문항은 대부분 상한 미만이라 무손실.
- **list 쿼리 안정성**: `commentsVisible`는 부모 문서 기반이라 안전. 댓글/agent 구분은 세션 `type`·`discussionSessionId`로 클라이언트 처리.
- **멤버 agent 읽기 한계**: §5 알려진 한계 — UI 차단, 공개 전 재검토.
- **props 드롭 회귀**: `CommentPanel`은 EditorView·ProblemView 양쪽 호출 → `mode` 추가 시 기존 props 누락 금지.
- **IME**: 입력창 `nativeEvent.isComposing` 가드 유지.
- **`resolved` 유지**: 제거하지 않음 — 규칙·타입·lib 그대로. (향후 기능 재활용 여지)

---

## 10. 향후 후속
- `tab_comments` read를 세션 단위로 분리(멤버가 agent AI 메시지 읽기 차단) — 오픈소스 공개 전.
- 컬렉션/필드 영속 명칭(`tab_comments`/`tabId`) 정식 리네임이 필요해지면 별도 마이그레이션 작업으로 분리(다운타임·스크립트).

---

## 11. 코드 리네임 맵 (코드 한정 — 영속 식별자 제외)

**유지(영속, 절대 변경 금지):** `tab_comments` 컬렉션, `tabId` 필드, `discussion_sessions` 컬렉션, `discussionSessionId` 필드.

**리네임(메모리상 코드 — TS 컴파일러가 누락 검출):**

| 현재 | 변경 | 비고 |
|---|---|---|
| `TabComment` (타입) | `ProblemComment` | 내부 `tabId` 필드는 잔존(영속) |
| `countByTab` | `countComments` + `countAgentSessions`로 분리 | §6 |
| `listByTab` | 사용처 확인 후 제거 또는 유지 | 탭 필터 소멸 |
| `activeTabId` 필터(CommentPanel) | 제거 | §8 |
| `tabAllowedForMemberCmt`(규칙) | 제거 | §5 |
| `setCommentPanelTab`/`commentCounts`(ProblemView) | `commentMode`/`commentCount`+`agentCount` | 문항 단위 반영 |
| `ensurePublicSession` | `ensureCommentSession` | §6 |
| `tabId` 스탬핑 | 현재 열린 탭 id 유지(잔존) | 필터·권한 미사용, 주석 명시 |

> 별도 "대규모 rename 커밋"을 두지 않고 각 기능 단계 커밋에 녹여서 처리(같은 파일을 만지므로).

---

## 12. 완료 기준 (체크리스트)
- [ ] 댓글 세션이 문항당 1개만 생성된다(`ensureCommentSession` 멱등, 중복 경로 없음)
- [ ] 댓글 패널에 세션 pill·'+세션'·LLM 아이콘이 없고, 문항 전체 단일 사람 댓글 스레드만 보인다
- [ ] agent 패널은 문항 단위로 세션 여러 개, 탭과 무관하게 동일 세션이 보인다
- [ ] agent AI 호출 시 문제+풀이+extra 전체가 컨텍스트로(15,000자 상한, question 보존) 전달된다
- [ ] agent 입력창에 LLM 아이콘/모델 선택이 있고 AI 호출이 기존과 동일하게 동작한다
- [ ] 댓글 패널과 agent 패널 배경 키가 시각적으로 구분된다
- [ ] ProblemView: 제목행에 [댓글][agent] 버튼, 탭 라벨행은 1행(라벨+복사)
- [ ] EditorView: 토글 토론 버튼 자리에 댓글 버튼, 그 오른쪽에 agent 버튼
- [ ] agent 버튼/패널은 오너에게만 보인다
- [ ] `commentsVisible=false`→멤버 댓글 숨김(오너만), `commentsWritable=false`→멤버 작성 차단(오너 가능)
- [ ] 'viewer' 멤버는 댓글 못 씀, 'commenter' 멤버는 `commentsWritable`일 때만 + 댓글 세션에만 씀
- [ ] 멤버가 agent(normal) 세션에 사람 댓글을 작성할 수 없다(`isCommentSessionRef`)
- [ ] `resolved`가 코드·규칙에 그대로 유지되고 댓글 생성이 정상 동작한다
- [ ] 세션 마이그레이션 없이 기존 토론 세션이 agent 패널에 그대로 표시된다
- [ ] 영속 식별자(`tab_comments`/`tabId`) 미변경, 코드 명칭은 §11대로 리네임됨
- [ ] `npm run build` 통과 + 멤버 댓글/AI 호출 회귀 없음

---

## 13. 커밋 & 푸시
- 구현·커밋까지만. `git push`/규칙 배포는 덕수 직접.
- 단계 커밋 권장:
  1. (데이터·lib) `comment` 타입 + `ensureCommentSession` + `countComments`/`countAgentSessions` + `commentsVisible/Writable` setter + 컨텍스트 전탭 수집(15k) + 탭필터 제거 + 코드 리네임
  2. (UI) CommentPanel `mode` 분기 + 세션 상태기계 분리 + 패널 배경 키
  3. (진입점) ProblemView/EditorView 버튼 재배치
  4. (규칙) `tabAllowedForMemberCmt` 제거 + `isCommentSessionRef` + 세션 create 규칙 + 오너 토글 UI
  - 각 커밋 후 빌드.
