# Phase 52 — 실시간 공개 + 로그인 회원 댓글 (초안)

> 공유 개편 3부작(48·49·50) 이후 후속. **스냅샷 "웹에 공개"(Phase 50)와는 별개의 새 채널**이다.
> 범위: **(가) 실시간 공개**(원본 편집이 즉시 반영) + **(나) 로그인 회원 댓글**(비로그인 댓글은 범위 밖).
> 번호 주의: `Phase 51 수식 필기 입력` 스케치가 이미 있어 **52**로 둠(조정 가능).

## 0. 선행 확인 (구현 전 반드시 읽을 것)

- `types/problem.ts` — `Visibility = 'private' | 'link' | 'public'`(이미 존재), `Problem.visibility`, `commentsVisible`/`commentsWritable`(Phase 47), `memberTabVisibility`
- `firestore.rules` — **이미 확인된 사실(아래)**:
  - `problems` read: `isOwner() || isPublic() || isMember()`. **`isPublic()`은 인증 불요** → 비로그인 live 읽기 가능.
  - 블록 서브컬렉션 read: `parentOwner() || parentIsPublic() || (member && 탭허용)`. **public이면 블록도 공개되나, 탭 가시성 필터는 멤버에게만 적용**(public은 전 탭 노출).
  - `tab_comments` read: `isOwnerCmt() || (isMemberCmt() && commentsVisible())`. **비멤버·공개 사용자는 댓글 읽기 불가** → 규칙 추가 필요.
  - `tab_comments` create: 오너 또는 commenter 멤버만. **비멤버 로그인 사용자는 작성 불가** → 규칙 추가 필요.
  - ⚠️ 주석(line 160): agent AI 메시지도 `tab_comments`에 있어 규칙 레벨에선 읽힘(UI로 차단). **공개 댓글에서 이 누출이 더 민감** → §5 결정.
- `app/shared/[shareId]/page.tsx` — **스냅샷** 뷰어(Phase 50). 이건 그대로 두고, **live 뷰어는 새 라우트** 신설.
- `components/comment/CommentPanel.tsx` — `canComment` prop, `isOwner` 내부 파생. 멤버/오너 전제 → 공개 commenter 경로 추가 필요.
- `components/share/ShareSettingsPanel.tsx` — '웹에 공개'(스냅샷) 섹션 존재. 여기에 "실시간 공개" 토글 추가 위치.
- `lib/membership.ts` — `canComment(problem, uid)`(현재 owner/commenter만 true).

## 1. 목표 & 비목표

**목표**
1. 문항을 `visibility='public'`으로 켜면, **비로그인 포함 누구나 live 본문**을 본다(편집 즉시 반영).
2. **로그인한 사용자는 누구나** 그 공개 문항에 **댓글**을 달 수 있다(멤버가 아니어도).
3. 오너는 공개/비공개 토글 + 공개 링크(`/p/{problemId}`) 확보.

**비목표(이번 범위 밖)**
- 비로그인 댓글(스팸·악용 방어 필요 → 별도 검토).
- 실시간 공동 편집(공개는 읽기 전용 live).
- 스냅샷 "웹에 공개"(Phase 50) 대체 — **둘은 공존**.

## 2. 두 공개 채널의 구분 (UI 혼동 방지 — 중요)

| | 웹에 공개 (Phase 50) | 실시간 공개 (Phase 52) |
|---|---|---|
| 데이터 | `shares/{id}` 스냅샷(동결) | 살아있는 `problems/{id}` |
| 편집 반영 | ✗ (재공개 필요) | ✓ (저장 즉시) |
| 라우트 | `/shared/{shareId}` | `/p/{problemId}` |
| 댓글 | 불가 | **로그인 시 가능** |
| 만료 | 있음(칩) | 없음(토글 on/off) |
| 접근 | 링크 가진 누구나(비로그인) | 누구나 보기 / 로그인 시 댓글 |

> 라벨 제안: 스냅샷 = **"웹에 공개(스냅샷)"**, live = **"실시간 공개"**. 공유 트리에도 `실시간 공개` 노드 추가 여부는 §7 결정.

## 3. 데이터 모델

- `visibility` 필드 재사용(`'public'`). 토글 = `updateProblem(id, { visibility: 'public' | 'private' })`.
- 공개 탭 범위: **`memberTabVisibility` 재사용**(오너가 고른 "공유할 탭"이 멤버·public 공통). → 규칙에서 public 블록 읽기에도 탭 필터 적용(§4-1).
- 댓글 정책: `commentsVisible`/`commentsWritable`(Phase 47) 재사용. public 댓글도 이 플래그를 따른다.
- (선택) `publicCommentCount` 등 비정규화는 **하지 않음**(Phase 49 결정 일관 — 클라 `countComments` 재사용).

## 4. 보안 규칙 변경 (`firestore.rules`)

### 4-1. 블록 읽기에 public 탭 필터 적용 (결정 D1)
현재 `parentIsPublic()`는 전 탭 노출. 멤버와 동일하게 탭 가시성 적용:
```
allow read: if !isCommentsCol() && (
  parentOwner()
  || (parentIsPublic() && (!isBlocksSubcol() || tabAllowedForPublic()))
  || (parentIsMember() && (!isBlocksSubcol() || tabAllowedForMember()))
);
// tabAllowedForPublic() = tabAllowedForMember()와 동일 식(memberTabVisibility 기준)
```

### 4-2. tab_comments 읽기 — 공개 문항 + 로그인 (결정 D2)
```
allow read: if isOwnerCmt()
  || (isMemberCmt() && commentsVisible())
  || (parentIsPublic() && isSignedIn() && commentsVisible());
```
> ⚠️ AI 메시지 누출(line 160)이 public에서 더 민감. **D3 결정 필요**: (a) UI 차단만 유지(현행 방식 연장), (b) agent 메시지를 별도 컬렉션으로 분리(규모 큼, 범위 밖), (c) public 댓글 read를 댓글 세션으로 제한(규칙 list 쿼리 한계로 어려움). **권장: (a) — 공개 뷰어가 `isCommentStream`으로 필터(Phase 47 헬퍼)**, 누출은 "이론상 규칙 레벨"로 한정.

### 4-3. tab_comments 생성 — 비멤버 로그인 commenter (결정 D2)
인간 댓글 생성 조건에 public 경로 추가:
```
(isOwnerCmt()
 || (isMemberCmt() && isCommenter() && commentsWritable() && isCommentSessionRef(...))
 || (parentIsPublic() && isSignedIn() && commentsWritable() && isCommentSessionRef(...)))
```
- author 본인(`authorUid == request.auth.uid`), `authorType=='human'`, `resolved==false`는 기존 그대로.
- **댓글 세션 참조 강제**(`isCommentSessionRef`)로 agent 세션 오염 방지.

### 4-4. 수정/삭제
- 기존 유지(본인 content 수정, 본인/오너 resolved 토글, 본인 삭제). public 댓글도 동일.
- **모더레이션 결정 D4**: 현재 오너는 남의 댓글 **삭제 불가**(resolve만). 공개에선 악성 댓글 삭제 권한이 필요할 수 있음 → 오너에게 public 댓글 delete 허용 추가 여부. **권장: 오너 delete 허용**(공개 모더레이션). 규칙 1줄 추가.

## 5. Live 공개 뷰어 (`app/p/[problemId]/page.tsx`)

- 살아있는 `problems/{id}` + 공개 탭 블록 + 댓글을 읽어 렌더.
- 비로그인: 본문 읽기 + "댓글을 남기려면 로그인" 안내(Google 로그인 버튼).
- 로그인: CommentPanel(공개 commenter 모드)로 댓글 작성/조회. **`isCommentStream` 필터로 agent 메시지 제외**(§4-2 (a)).
- 실시간: 블록·댓글 `onSnapshot` 구독 → 편집/새 댓글 즉시 반영.
- 만료 없음. 비공개로 바뀌면 규칙상 읽기 차단 → "비공개로 전환되었습니다" 안내.
- 헤더에 Mathory 브랜드/회원가입 CTA(Phase 50 뷰어와 동일 톤).

> 구현 방식 결정 D5: (a) **새 경량 PublicProblemView**(권장 — ProblemView는 편집 UI가 많아 무거움), (b) ProblemView를 public 모드로 분기. 권장 (a): 본문 렌더는 `/shared` 뷰어의 TabContent 패턴 + CommentPanel 재사용.

## 6. 오너 UI (`ShareSettingsPanel` 확장)

- "실시간 공개" 토글(현 '웹에 공개' 스냅샷 섹션과 **시각적으로 분리**, 혼동 방지).
  - ON → `updateProblem(id, { visibility: 'public' })` → 링크 `/p/{id}` 표시 + 복사.
  - OFF → `visibility: 'private'`(또는 'link') 복귀.
- 댓글 허용 토글(`commentsWritable`)·표시 토글(`commentsVisible`)을 public 맥락에서도 노출(Phase 47 UI 재사용 가능 시).
- 공개 탭은 기존 "공유할 탭" 체크박스 공통 적용.

## 7. 결정 사항 (요약)
- **D1. public 블록 탭 필터**: 적용(멤버와 동일). **권장: 적용**.
- **D2. public 댓글 읽기/쓰기 규칙 추가**: 로그인 + 공개 + commentsVisible/Writable. **권장: 채택**.
- **D3. agent AI 메시지 누출**: UI 필터(`isCommentStream`)로 한정, 규칙 레벨 누출은 수용. **권장: (a)**. (완전 차단은 agent 분리 컬렉션 — 범위 밖)
- **D4. 오너 모더레이션 delete**: 공개 댓글 한정 오너 delete 허용. **권장: 허용**.
- **D5. live 뷰어 구현**: 새 PublicProblemView. **권장: 신규 경량**.
- **D6. 공유 트리 `실시간 공개` 노드**: 추가할지(공개 중인 내 문항 목록). **권장: 이번엔 토글·링크만, 트리 노드는 후속**(범위 관리).
- **D7. 비로그인 댓글**: **불가(범위 밖)** 확정.

## 8. 작업 규모 & 단계 (예상)
중간 규모. 단계별 커밋:
1. **규칙**: 블록 public 탭 필터 + tab_comments public read/create(+오너 delete). 에뮬레이터/스모크 테스트.
2. **lib/UI 권한**: `canComment`에 public 경로, ShareSettingsPanel "실시간 공개" 토글.
3. **Live 뷰어**: `app/p/[problemId]` + PublicProblemView(본문 onSnapshot) + 로그인 안내.
4. **댓글**: CommentPanel public 모드(로그인 commenter, `isCommentStream` 필터).
5. **마감**: 비공개 전환 안내, CTA, 회귀(멤버/스냅샷/댓글) 점검, build.

## 9. 리스크 & 주의사항
- **AI 메시지 누출(D3)**: 규칙 레벨에서 public 로그인 사용자가 `tab_comments`의 agent 메시지를 읽을 수 있음(list 쿼리 한계). UI 필터로 가리되, **민감 문항은 공개하지 말 것** 안내. 완전 차단 원하면 agent 메시지 분리(별도 Phase).
- **스팸/악용**: 로그인 강제로 추적성은 확보되나, 누구나 댓글 가능 → 오너 모더레이션(D4) + 신고/차단은 후속. 레이트리밋은 규칙으로 어려움.
- **공개 범위 오인**: 스냅샷 vs 실시간 2채널 → 라벨·경고로 명확히(§2).
- **비정규화 없음**: 댓글 수는 클라 계산(Phase 49 일관).
- **visibility 'link' 상태**: 현재 미사용. 이번엔 'public'만 토글, 'link'는 손대지 않음.

## 10. 수락 기준 (초안)
- [ ] 오너가 "실시간 공개" ON → `/p/{id}` 링크 발급, 비로그인도 본문 열람
- [ ] 공개 탭 필터 적용(비공개 탭은 public에 안 보임)
- [ ] 로그인 사용자(비멤버 포함)가 댓글 작성/조회, agent 메시지는 안 보임
- [ ] 편집 저장 시 공개 뷰에 실시간 반영(onSnapshot)
- [ ] 오너가 악성 댓글 삭제(모더레이션) 가능
- [ ] 비공개 전환 시 공개 뷰 차단 + 안내
- [ ] 기존 멤버 공유/스냅샷 공개/댓글 회귀 없음, build 통과, 규칙 스모크 테스트 통과

---
**다음 절차:** D1~D7 결정 → 이 초안을 확정해 `phasedocs/`에 등록 → 단계별 구현.
