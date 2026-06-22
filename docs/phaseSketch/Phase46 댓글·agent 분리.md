# Phase 46 — 댓글 / agent 분리

> 기존 통합 토론 패널을 **'댓글'**(사람 전용·문항당 단일 세션)과 **'agent'**(AI·**문항 단위** 다중 세션)로 분리한다.
> 레포 최신 기준 직전 phase는 **Phase 45(블록 전체 접기)** → 이 문서가 **Phase 46**.
> **핵심 설계:** 세션은 지금도 문항 단위(per-problem)로 존재하므로 그대로 재사용한다 — **세션에 `tabId`를 추가하지 않으며, 마이그레이션이 없다.** 토론(특히 풀이)이 문제 내용을 참조하므로 agent의 자연스러운 컨텍스트 단위는 "탭"이 아니라 "문항 전체(문제+풀이)"다.

## 0. 선행 확인 (구현 전 반드시 읽을 것 — 행 번호는 작성 시점 기준, 변동 가능)

- `types/problem.ts` — `TabComment`(`authorType`, `discussionSessionId`, `tabId`), `DiscussionSession`(`type 'public'|'normal'`, `aiEnabled`), `Problem`
- `lib/comments.ts` — **현재 댓글 스키마 확인 필수.** `resolved` 잔존 여부(§5·§8)
- `lib/discussion-sessions.ts` — `createNormalSession`/`renameSession`/`deleteSession`/`listSessions`. `ensurePublicSession`은 throw하는 미구현 stub(이번에 구현)
- `components/comment/CommentPanel.tsx` — 세션 pill, AI 호출(`invokeOneAI`/`pendingAI`/`selectedModelIds`), 입력창·LLM 모델 선택 UI, `activeTabId` 댓글 필터(≈210), `isAISession`(≈225), 컨텍스트 수집 `fetchTabBlocksText`(≈367)·활성탭 분기(≈388), `isOwner`/`canComment`
- `components/problem/ProblemView.tsx` — 제목행 `제목 + <BlockchainBadge>`(≈585~587), 탭 라벨행 `라벨 + 복사버튼 + 💬버튼`(≈640~685), `setCommentPanelTab`/`commentCounts`, `CommentPanel` 렌더(≈946)
- `components/editor/EditorView.tsx` — 툴바 저장(≈2313)·글꼴크기(≈2345), 토론 토글 버튼(≈2540~2562, `setDiscussionOpen`/`commentCounts[activeTab]`), `CommentPanel` 렌더(≈2747)
- `firestore.rules` — `tab_comments`, `discussion_sessions` 규칙
- `app/globals.css` — 시맨틱 색 토큰(Phase 44). 패널 배경 톤 차별화용 토큰 추가

## 1. 목표 & 결정

| 항목 | 결정 |
|---|---|
| **댓글** 세션 수 | **문항당 유일하게 1개**. 복수 생성 불가(기존 `'public'` 세션으로 구현) |
| 댓글 범위 | **문항 전체 단일 스레드**(탭 필터 없음) |
| 댓글 입력창 | **LLM 아이콘/모델 선택 없음.** AI 호출 불가 |
| 댓글 쓰기 | 결정 (A): `역할 'commenter'` AND `commentsWritable`. 오너 항상 가능 |
| 댓글 가시성 | 접속자 모두에게 보임. 오너가 `commentsVisible`로 숨김 가능 |
| **agent** 세션 | **문항 단위로 다수**(이름 붙는 세션). `'normal'`·`aiEnabled`. **탭과 무관** |
| agent 컨텍스트 | 항상 **문제 탭 + 풀이 탭(들) 전체**를 AI에 전송 |
| agent 입력창 | 기존 토론 패널과 동일 — **LLM 아이콘/모델 선택 있음** |
| agent 권한 | **오너 전용** (생성·열람 모두) |
| 시각 차별화 | **댓글 패널 배경 톤을 agent 패널과 다르게** |

> 폐기: 다자 사람+AI 토론(요구 1) — agent가 오너 단독이므로 자동 성립. / 탭별 세션 스코핑 폐기 — 풀이 토론이 문제를 참조하므로 문항 전체가 올바른 컨텍스트 단위.

## 2. 데이터 모델

### 2-1. 세션 — 기존 구조 그대로 (변경 없음)
```
problems/{id}/discussion_sessions/{sid}
  ├─ type: 'public' | 'normal'
  ├─ aiEnabled: boolean
  └─ name, createdBy, createdAt, updatedAt        // tabId 추가하지 않음
```
- **댓글 세션** = `type:'public'`, `aiEnabled:false`. **문항당 1개**(§6 `ensurePublicSession` 멱등 생성).
- **agent 세션** = `type:'normal'`, `aiEnabled:true`. **문항당 다수**, 탭 무관. 기존 normal 세션을 그대로 사용.

### 2-2. 문항 레벨 토글 2개 (오너 댓글 제어)
```
problems/{id}
  ├─ commentsVisible:  boolean   // 기본 true. false = 댓글을 오너에게만
  └─ commentsWritable: boolean   // 기본 true. false = 멤버 댓글 작성 동결(오너는 가능)
```
미설정은 `true`로 간주(`get(...,true)`).

### 2-3. 마이그레이션 — 사실상 없음
- 세션 `tabId` 백필 **불필요**(추가 안 하므로). 기존 normal 세션은 agent 세션으로 그대로 동작.
- 기존 세션 없는("legacy") 사람 댓글: 런타임에 댓글 모드에서 `discussionSessionId == null`도 함께 표시하면 별도 이관 없이 흡수됨. (또는 최초 진입 시 댓글 세션에 귀속.)

## 3. UI — 패널 분리 (CommentPanel `mode` 분기)

큰 리팩터링 대신 `mode` prop 분기 권장. **기존 props 전부 보존** + `mode: 'comments' | 'agent'`. **두 모드 모두 문항 전체 범위 → 기존 `c.tabId !== activeTabId` 필터(≈210)를 제거**(탭 필터 폐지). `tabId`는 데이터에 남되 표시 필터로는 쓰지 않음.

### 3-1. mode='comments' (댓글)
- 데이터: 댓글 세션(`public`) 메시지 + legacy(`discussionSessionId==null`). 문항 전체.
- UI: **세션 pill 없음**(세션 1개), **'+새 세션' 없음**, **입력창 LLM 아이콘/모델 선택 없음**, AI 경로 비활성. 사람 댓글 스레드(`parentCommentId`)만.
- 사용: 오너 + 멤버(가시성 충족 시).

### 3-2. mode='agent'
- 데이터: 문항의 `'normal'` 세션 전부 + 메시지. 탭 무관.
- 컨텍스트: AI 호출 시 **문제 탭 + 풀이 탭(들) 전체**를 보냄. `fetchTabBlocksText`를 활성 탭만이 아니라 모든 탭에 대해 수집하도록 보강(현재 활성탭 분기 ≈388 수정).
- UI: 기존 토론 패널 그대로 — 세션 pill, '+새 세션'(이름 필수), 입력창 LLM 아이콘/모델 선택, AI 호출·비용.
- 사용: **오너 전용.**

### 3-3. 시각 차별화 (요구 2.3)
- `globals.css`에 토큰 추가(단일 소스): `--bg-panel-agent`(기존 패널 톤 유지) / `--bg-panel-comment`(다른 톤 — 더 중립/차분한 표면). 패널 루트에 모드별 배경만 다르게.
- 정확한 색값은 Phase 44 색 시스템과 조화되게 디자인 단계에서 확정.

## 4. 진입 버튼 배치

### 4-1. ProblemView — 제목행에 두 버튼, 탭 라벨은 1행 유지
- 제목행(≈585~587) `제목 + <BlockchainBadge>` 오른쪽에 순서대로:
  1. **댓글 버튼** (블록체인 배지 바로 오른쪽). 카운트 = 문항 전체 댓글 수. 노출: `user && (isOwnerView || isMemberView)`(멤버는 `commentsVisible`일 때).
  2. **agent 버튼** (댓글 버튼 오른쪽). 카운트 = 문항의 agent 세션 수(대화 개수). 노출: **오너 전용**(`isOwnerView`).
- **탭 라벨행은 1행 그대로 간결하게**: `탭 라벨(토글) + 복사 버튼`만. **기존 💬 버튼(≈666~685)은 제거**(제목행으로 이동).

### 4-2. EditorView — 현행 버튼을 댓글로, 그 오른쪽에 agent
- **현행 토론 토글 버튼(≈2543, `setDiscussionOpen`)을 '댓글' 버튼으로** 전환(같은 자리, 2행). 카운트 = 문항 전체 댓글 수.
- **agent 버튼**을 그 **바로 오른쪽(2행)**에 신설. 카운트 = agent 세션 수.
- 상태: `drawerOpen` + `panelMode: 'comments' | 'agent'`. 드로어 하나, 두 버튼이 모드 전환. EditorView는 오너 편집 화면이라 둘 다 노출.
- (저장↔글꼴크기 사이 배치안은 폐기 — 두 버튼을 2행에 나란히 두는 것으로 단순화.)

## 5. 보안 규칙 (`firestore.rules`)

헬퍼:
```
function commentsVisible()  { return parentData().get('commentsVisible', true) == true; }
function commentsWritable() { return parentData().get('commentsWritable', true) == true; }
```

**tab_comments**
```
allow read: if isOwnerCmt() || (isMemberCmt() && commentsVisible());

allow create: if (
  // 사람 댓글 (댓글 세션 / legacy)
  request.resource.data.get('authorType','human') == 'human'
  && request.resource.data.authorUid == request.auth.uid
  && ( isOwnerCmt()
       || ( isMemberCmt() && isCommenter() && commentsWritable()
            && tabAllowedForMemberCmt(request.resource.data.tabId) ) )
) || (
  // AI 메시지 (agent) — 오너만
  request.resource.data.authorType == 'ai'
  && request.resource.data.authorUid.matches('^ai:.*')
  && isOwnerCmt()
);
```
> **⚠️ resolved 정리:** clone 시점 규칙에 create 조건 `request.resource.data.resolved == false`가 있었음. `resolved`가 데이터에서 제거됐다면 **규칙의 `resolved` 검사도 함께 제거**(안 그러면 `undefined`라 댓글 작성이 전면 거부됨). update/delete의 resolved 분기도 정리.

**discussion_sessions**
```
// 댓글 세션(public): 오너가 문항당 1개만 (멱등 생성)
allow create: if request.resource.data.type == 'public'
  && request.resource.data.aiEnabled == false
  && isOwnerSess();
// agent 세션(normal): 오너만 (tabId 없음)
allow create: if request.resource.data.type == 'normal'
  && request.resource.data.aiEnabled == true
  && request.resource.data.createdBy == request.auth.uid
  && isOwnerSess();
```
- '문항당 1개' 유일성은 `ensurePublicSession` 멱등 로직으로 보장(존재 시 no-op), UI에 중복 생성 경로 없음.
- 오너 토글(`commentsVisible/Writable`)은 `problems` update — 기존 `isOwner()` 범위 내.

## 6. lib / 헬퍼 변경

- `lib/discussion-sessions.ts`:
  - `ensurePublicSession(problemId, ownerUid)` **구현**: 문항에 `type:'public'` 세션 없으면 1개 생성, 있으면 id 반환(throw stub 제거).
  - `createNormalSession`/`listSessions` **시그니처 변경 없음**(tabId 미추가).
- `components/comment/CommentPanel.tsx`:
  - 컨텍스트 수집을 **활성 탭 한정 → 문제+풀이 전체**로 보강(§3-2). 작은 문항이라 토큰 부담 미미.
  - 탭 필터(≈210) 제거(두 모드 문항 전체).
- `lib/comments.ts`:
  - 댓글 모드 조회 = 댓글 세션 메시지 + `discussionSessionId==null`.
  - `commentCount` 비정규화(선택): **댓글 스트림만** 카운트(agent 메시지 제외).
- 오너 토글 setter: `setCommentsVisible`, `setCommentsWritable`.

## 7. 오너 제어 UI
댓글 패널 헤더(오너에게만) 토글 2개: "댓글 보이기"(`commentsVisible`) / "댓글 쓰기 허용"(`commentsWritable`).

## 8. 리스크 & 주의사항
- **resolved 미동기화 시 댓글 작성 전면 차단** — §5 경고대로 코드·규칙 동시 정리.
- **컨텍스트 전체 탭 전송**: 풀이2·3까지 있는 문항은 컨텍스트가 다소 커질 수 있음 — 사실상 드물고 작은 분량이라 무방. 필요 시 "현재 풀이 + 문제"로 좁히는 옵션은 후속.
- **list 쿼리 안전성**: `commentsVisible`는 부모 문서 기반이라 안전. 댓글/agent 구분은 세션 `type`·`discussionSessionId` 쿼리 제약으로 처리.
- **props 드롭 회귀**: `CommentPanel`은 EditorView·ProblemView 양쪽 호출 — `mode` 추가 시 기존 props 누락 금지.
- **IME**: 입력창 `nativeEvent.isComposing` 가드 유지.

## 9. 수락 기준 (체크리스트)
- [ ] 댓글 세션은 문항당 1개만 생성된다(중복 경로 없음)
- [ ] 댓글 패널엔 세션 pill·'+세션'·LLM 아이콘이 없고, 문항 전체 단일 사람 댓글 스레드만 보인다
- [ ] agent 패널은 문항 단위로 세션을 여러 개 만들 수 있고, 탭과 무관하게 동일 세션이 보인다
- [ ] agent AI 호출 시 문제+풀이 전체가 컨텍스트로 전달된다
- [ ] agent 입력창엔 LLM 아이콘/모델 선택이 있고 AI 호출이 동작한다(기존과 동일)
- [ ] 댓글 패널과 agent 패널 배경 톤이 시각적으로 구분된다
- [ ] ProblemView: 제목행에 [댓글][agent] 버튼 순으로 위치, 탭 라벨은 1행(라벨+복사)
- [ ] EditorView: 현행 토론 버튼 자리에 댓글 버튼, 그 오른쪽 2행에 agent 버튼
- [ ] agent 버튼/패널은 오너에게만 보인다
- [ ] `commentsVisible=false`→멤버 댓글 숨김(오너만), `commentsWritable=false`→멤버 작성 차단(오너 가능)
- [ ] '보기' 역할 멤버는 댓글 못 씀, '댓글' 역할 멤버는 `commentsWritable`일 때만 씀
- [ ] `resolved` 제거가 코드·규칙에서 동기화되어 댓글 작성 정상
- [ ] 세션 마이그레이션 없이 기존 토론 세션이 agent 패널에 그대로 표시된다
- [ ] `npm run build` 통과 + 멤버 공유/AI 호출 회귀 없음

## 10. 커밋 & 푸시
- 구현·커밋까지만. `git push`/규칙 배포는 덕수가 직접.
- 단계 커밋 권장: (ensurePublicSession 구현 + 컨텍스트 전체탭 + 탭필터 제거) → (CommentPanel mode 분기 + 패널 톤) → (버튼 재배치 ProblemView/EditorView) → (오너 토글 + 규칙 + resolved 정리). 각 커밋 후 빌드.
