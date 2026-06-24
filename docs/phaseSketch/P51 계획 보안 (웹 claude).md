계획서는 전반적으로 정확하지만, **공개 뷰어의 댓글 세션 식별** 부분에 실제 코드와 충돌하는 핵심 결함이 하나 있고, 데이터 계층·SEO에서 비어 있는 부분이 있습니다.

## 1. 타당성 검증 — §0 "선행 확인" 주장 vs 실제 코드

대조 결과 계획서의 규칙 진단은 **거의 정확**합니다.

| §0 주장                                                      | 실제 코드                                                    | 판정               |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------ |
| `Visibility='private'|'link'|'public'` 존재                  | `types/problem.ts:60` 동일                                   | ✓                  |
| `problems` read = `isOwner()||isPublic()||isMember()`, `isPublic()` 인증 불요 | `firestore.rules` 동일 → 비로그인 live 읽기 가능             | ✓                  |
| 블록 서브컬렉션: public이면 **탭 필터 없이 전 탭 노출**      | `allow read: ... || parentIsPublic() || (parentIsMember() && (!isBlocksSubcol() || tabAllowedForMember()))` — public에만 탭 게이트 없음 | ✓ §4-1 필요        |
| `tab_comments` read = `isOwnerCmt()||(isMemberCmt() && commentsVisible())` | 동일                                                         | ✓ §4-2 필요        |
| `tab_comments` create = 오너/commenter 멤버만                | 동일(+AI는 오너)                                             | ✓ §4-3 필요        |
| `discussion_sessions` create가 오너로 좁혀짐                 | **comment·normal 둘 다 `isOwnerSess()` 강제**                | ✓ §10 리스크 실재  |
| `canComment`=owner/commenter만                               | `membership.ts` 동일                                         | ✓ public 경로 필요 |
| `WebShareList`·AppShell `sent-web`→`listSharesByOwner`, `/shared`=스냅샷 | 동일, `allProblems`에 오너 문항 보유 → 실시간 행은 추가 쿼리 불필요 | ✓ §2 타당          |

여기까지는 계획서대로 진행해도 됩니다.

## 2. 결함·보완 (우선순위순)

### 🔴 P1. 공개 뷰어가 댓글 세션 ID를 알 수 없어 agent 필터가 깨진다 — 가장 큰 구멍

계획서가 §10에서 걱정한 건 댓글 세션 *생성* 권한인데, 실제 막히는 지점은 **읽기/식별**입니다.

- `discussion_sessions` read 규칙 = `isOwnerSess() || isMemberSess()` — **공개 비멤버는 세션을 못 읽음.**
- 그런데 §5의 agent 차단은 `isCommentStream(c, commentSessionId)`에 의존하고, 이 함수는 `commentSessionId`가 있어야 (a) 댓글 세션에 태깅된 오너·멤버 댓글을 *보여주고* (b) agent 메시지(real session id)를 *숨긴다.*
- 공개 뷰어가 `commentSessionId=null`을 넘기면, agent는 잘 숨겨지지만 **댓글 세션 ID가 박힌 오너/멤버 댓글까지 숨겨진다** (`isCommentStream`이 `sid===null`만 통과시키므로).

**권장(firm): `problems/{id}.commentSessionId` 단일 포인터를 비정규화하라.** `ensureCommentSession`이 세션을 만들 때 `updateProblem(id,{commentSessionId})`로 한 번만 기록. 공개 뷰어는 public-readable한 problem 문서에서 이 값을 읽어 `isCommentStream`에 넘긴다. §3의 "비정규화 없음" 원칙과 충돌하지만, 세션 리스트 쿼리 의미를 건드리지 않는 **단일 포인터**라 정당화됩니다. (대안으로 "공개 문항의 `type=='comment'` 세션만 public read 허용" 규칙 추가도 가능하나, list 쿼리·agent 세션명 열람 위험이 생겨 비추천.)

### 🔴 P2. "편집 즉시 반영(onSnapshot)"을 받칠 블록 구독 헬퍼가 아예 없다

- `lib/firestore.ts`에 블록용 `onSnapshot`이 **전무**합니다. 전부 `getDocs`(`getPreviewBlocks`, `getProblemWithBlocks`)이고, 실시간 구독은 `watchAllComments`(댓글)만 존재.
- D5가 재사용하겠다는 `/shared` 뷰어는 **동결 스냅샷**(`share.snapshot.tabBlocks`)이라 live-read 코드가 0입니다. 재사용 가능한 건 `TabContent` **렌더링뿐**.
- 또 `getPreviewBlocks`는 "내용 있는 첫 탭만" 반환하고 권한 에러를 조용히 삼키므로 live 다중 탭 뷰어에 부적합.

**권장: `lib/firestore.ts`에 `watchTabBlocks(problemId, tabId, cb)` (visible 탭별 `onSnapshot`) 신설**을 §5·lib 변경·9단계 4에 명시. 이게 Phase 51의 실제 신규 작업 분량의 핵심입니다(계획서가 "재사용"으로 과소평가).

### 🟠 P3. `discussion-sessions.ts`의 `mapDoc`이 `'comment'` 타입을 버린다 (현재 load-bearing 버그)

```
type: data.type === 'public' ? 'public' : 'normal',   // 'comment' → 'normal' 로 뭉개짐
```

- 결과: `CommentPanel:209`의 `sessions.find(s=>s.type==='comment')`가 **항상 null** → `commentSessionId` 항상 null → 인간 댓글은 전부 legacy null-sid로 저장(현재 사실상 이렇게 동작 중) → 그리고 `ensureCommentSession`이 만든 'comment' 세션이 `normalSessions`에 섞여 **agent 패널에 유령 "댓글" 세션 카드**로 보일 가능성.

지금은 "전부 null-sid라 모두 표시"라서 우연히 댓글 기능이 돌지만, Phase 51의 필터 설계가 이 버그에 **묵시적으로 의존**합니다. P1을 제대로 고치려면 이 mapDoc부터 `'comment'`를 보존하도록 고쳐야 합니다. **에디터 UI에서 유령 agent 세션이 보이는지 먼저 확인**하시고, Phase 51 1단계에 mapDoc 수정을 포함하길 권합니다.

### 🟠 P4. §4-3 규칙 문구 "댓글 세션 참조 강제"는 실제로 null을 허용 (모순이지만 그게 맞다)

`isCommentSessionRef(null)`은 `true`입니다. 즉 공개 댓글은 `discussionSessionId=null`로 그냥 작성하면 되고, **세션을 미리 만들 필요가 없습니다.** → §10의 (a)/(b) 세션 생성 논쟁은 사실상 불필요. agent 세션 id를 넘기면 `type=='normal'`이라 차단되므로 오염 방지도 유지됩니다. **결론: 공개 댓글은 null-sid로 작성 + P1(포인터)로 뷰어 필터 보정** 조합이 가장 단순합니다. 계획서의 "참조 강제" 표현만 "null 또는 댓글 세션 참조 허용"으로 정정하세요.

### 🟡 P5. §4-4 delete 규칙 교체 시 AI-삭제 분기 회귀 주의

현재 delete 규칙은 `(human && 본인) || (ai && isOwnerCmt())` 두 갈래입니다. 계획서 §4-4 스니펫(`authorUid==uid || isOwnerCmt()`)으로 **통째 교체하면 AI 분기 의도가 흐려질 수 있음.** `|| isOwnerCmt()`가 AI도 커버하긴 하나, 머지 시 AI 분기를 명시 보존하고, "오너가 타인 인간 댓글 삭제 가능"으로 정책이 바뀌는 점(기존 주석은 "오너도 남의 댓글 삭제 불가")을 모더레이션 의도로 주석 갱신하세요.

### 🟡 P6. public 탭 노출이 멤버 탭 노출과 동일 설정에 묶임

§3·§6은 `memberTabVisibility`를 멤버·공개 공용으로 재사용합니다. 즉 **멤버에게 숨긴 탭은 공개에서도 숨겨지고, 그 반대 조합 불가.** v1은 수용 가능하나, "멤버용 ≠ 공개용 탭 노출" 요구가 나오면 별 필드가 필요합니다. 알려진 제약으로 §10에 명시 권장.

## 3. 비어있거나 최신 트렌드상 꼭 필요한 추가

### ⭐ P7. `/p/{id}` SSR 메타데이터 / Open Graph — 가장 중요한 누락

`/shared`도 그렇지만 `/p/[problemId]`를 그대로 `'use client'`로 만들면 **카카오톡·메신저 공유 시 미리보기(제목/설명/썸네일) 전무, 크롤링 불가.** HWP 대체 + 공개 공유를 지향하는 제품에서 치명적입니다.

**권장: `/p/[problemId]`를 서버 컴포넌트 셸로 만들고 `generateMetadata`로 문항 제목을 OG 태그에 주입**(Firestore Admin 또는 public REST read), 그 안에서 client `PublicProblemView` 렌더. 댓글/onSnapshot은 client에서. 이게 "최신 트렌드 반영"의 핵심 한 방입니다.

### P8. 공개 댓글 스팸 방어가 "추적성+모더레이션"뿐

로그인 강제만으로는 부족. v1에서 **클라이언트 측 길이 상한 + uid별 레이트 가드(연속 작성 쿨다운)**는 비용이 거의 0이니 지금 넣고, 신고/차단·서버측 레이트리밋은 후속으로. §10에 한 줄 추가 권장.

### P9. live 행 정렬을 `updated_at`으로 하면 편집할 때마다 리스트 상단으로 튐

`updated_at`은 모든 저장마다 갱신되므로 공개 리스트 순서가 출렁입니다. 한 번만 찍는 `publishedAt`이 안정적. 후속으로 미뤄도 되나 인지하고 계세요.

### P10. 단일 활성 세션(`lib/session.ts`)과 공개 뷰어 충돌 가능성

오너가 다른 탭에서 자기 `/p/{id}`를 열어 로그인 상태로 댓글을 달면, 단일 세션 모델이 에디터 탭을 로그아웃시킬 수 있습니다. 공개 뷰어가 기존 세션 강제 로직 범위에 들어가는지 확인 필요(사소하나 실제 UX papercut).

## 한 줄 권고

**P1(댓글 세션 포인터 비정규화) + P2(`watchTabBlocks` 신설) + P3(mapDoc `'comment'` 보존)** 세 개를 1단계 규칙 작업과 함께 phasedoc에 명시한 뒤 진행하세요. 이 셋이 빠지면 "로그인 댓글·agent 비노출·실시간 반영" 수락 기준이 실제로 충족되지 않습니다. P7(OG/SSR)은 같은 Phase에 넣을지, 별도 후속으로 뺄지만 결정하면 됩니다.

phasedoc에 반영할 수정 문안(§4-1~4-4 규칙 + §5 lib 신설 + 새 §4-5 commentSessionId 포인터)을 바로 작성해 드릴까요, 아니면 P1·P3 수정이 기존 댓글 회귀에 미치는 영향부터 코드로 더 파고들까요?