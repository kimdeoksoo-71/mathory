# Phase 52 — 실시간 공개 + 로그인 회원 댓글

> 공유 개편 3부작(48·49·50) 이후 후속. **스냅샷 "웹에 공개"(Phase 50)와는 별개의 새 채널**이다.
> 범위: **(가) 실시간 공개**(원본 편집이 즉시 반영) + **(나) 로그인 회원 댓글**. 비로그인 댓글은 범위 밖(D7).
> 번호 주의: `Phase 51 수식 필기 입력` 스케치가 별도로 있어 이 문서는 **52**(조정 가능).
> **결정 확정:** D1~D7 모두 권장안 채택(§7).

## 0. 선행 확인 (구현 전 반드시 읽을 것)

기억이 아니라 현재 파일을 직접 읽고 시작한다.

- `types/problem.ts` — `Visibility = 'private' | 'link' | 'public'`(이미 존재), `Problem.visibility`, `commentsVisible`/`commentsWritable`(Phase 47), `memberTabVisibility`
- `firestore.rules` — **코드 대조 완료 사실**:
  - `problems` read: `isOwner() || isPublic() || isMember()`. **`isPublic()`은 인증 불요** → 비로그인 live 읽기 이미 가능.
  - 블록 서브컬렉션 read: `parentOwner() || parentIsPublic() || (member && 탭허용)`. **public이면 블록도 공개되나, 탭 가시성 필터는 멤버에게만 적용**(public은 전 탭 노출) → §4-1에서 보완.
  - `tab_comments` read: `isOwnerCmt() || (isMemberCmt() && commentsVisible())`. **비멤버·공개 사용자는 댓글 읽기 불가** → §4-2 추가.
  - `tab_comments` create: 오너 또는 commenter 멤버만 → §4-3 추가.
  - ⚠️ 주석(line 160): agent AI 메시지도 `tab_comments`에 있어 규칙 레벨에선 읽힘(현재 UI로만 차단). 공개에서 더 민감 → D3.
- `app/shared/[shareId]/page.tsx` — **스냅샷** 뷰어(Phase 50). 그대로 둠. live 뷰어는 새 라우트.
- `components/comment/CommentPanel.tsx` — `canComment` prop, `isOwner` 내부 파생. 멤버/오너 전제 → 공개 commenter 경로 추가.
- `lib/comments.ts` — `isCommentStream(c, commentSessionId)`(Phase 47). live 뷰어 댓글 필터에 재사용.
- `components/share/ShareSettingsPanel.tsx` — '웹에 공개'(스냅샷) 섹션 존재. "실시간 공개" 토글 추가 위치.
- `lib/membership.ts` — `canComment(problem, uid)`(현재 owner/commenter만 true) → public 경로 추가.
- `lib/firestore.ts` — `updateProblem`(visibility 토글), `getProblemWithBlocks`.

## 1. 목표 & 비목표

**목표**
1. 문항을 `visibility='public'`으로 켜면 **비로그인 포함 누구나 live 본문**을 본다(편집 즉시 반영).
2. **로그인한 사용자는 누구나**(멤버 아니어도) 그 공개 문항에 **댓글**을 단다.
3. 오너는 공개/비공개 토글 + 공개 링크(`/p/{problemId}`) 확보 + 악성 댓글 모더레이션.

**비목표(범위 밖)**
- 비로그인 댓글(D7 — 스팸·악용 방어는 별도 검토).
- 실시간 공동 편집(공개는 읽기 전용 live).
- 스냅샷 "웹에 공개"(Phase 50) 대체 — **둘은 공존**.
- agent 메시지 완전 차단을 위한 별도 컬렉션 분리(D3 — 더 큰 별도 작업).

## 2. 두 공개 채널의 구분 (UI 혼동 방지 — 중요)

| | 웹에 공개 (Phase 50) | 실시간 공개 (Phase 52) |
|---|---|---|
| 데이터 | `shares/{id}` 스냅샷(동결) | 살아있는 `problems/{id}` |
| 편집 반영 | ✗ (재공개 필요) | ✓ (저장 즉시) |
| 라우트 | `/shared/{shareId}` | `/p/{problemId}` |
| 댓글 | 불가 | **로그인 시 가능** |
| 만료 | 있음(칩) | 없음(토글 on/off) |
| 접근 | 링크 가진 누구나(비로그인) | 누구나 보기 / 로그인 시 댓글 |

> 라벨: 스냅샷 = **"웹에 공개(스냅샷)"**, live = **"실시간 공개"**. 공유 트리 `실시간 공개` 노드는 이번 범위 밖(D6) — 토글·링크만.

## 3. 데이터 모델 (변경 최소)

- `visibility` 재사용(`'public'`). 토글 = `updateProblem(id, { visibility: 'public' | 'private' })`.
- 공개 탭 범위: **`memberTabVisibility` 재사용**(오너가 고른 "공유할 탭"이 멤버·public 공통). 규칙에서 public 블록 읽기에도 탭 필터 적용(§4-1).
- 댓글 정책: `commentsVisible`/`commentsWritable`(Phase 47) 재사용. public 댓글도 이 플래그를 따른다.
- **비정규화 없음**(Phase 49 일관): 댓글 수는 클라 `countComments` 재사용.
- `'link'` visibility는 현재 미사용 — 이번엔 손대지 않음.

## 4. 보안 규칙 변경 (`firestore.rules`)

### 4-1. 블록 읽기에 public 탭 필터 적용 (D1)
```
function tabAllowedForPublic() {
  return parentData().get('memberTabVisibility', {}).get(tabIdFromSubcol(), true) == true;
}
allow read: if !isCommentsCol() && (
  parentOwner()
  || (parentIsPublic() && (!isBlocksSubcol() || tabAllowedForPublic()))
  || (parentIsMember() && (!isBlocksSubcol() || tabAllowedForMember()))
);
```
(`tabAllowedForPublic` == `tabAllowedForMember` 식 동일 — 비공개 탭 블록은 public도 못 읽음.)

### 4-2. tab_comments 읽기 — 공개 문항 + 로그인 (D2)
```
allow read: if isOwnerCmt()
  || (isMemberCmt() && commentsVisible())
  || (parentIsPublic() && isSignedIn() && commentsVisible());
```
> ⚠️ AI 메시지 누출(D3): 규칙 레벨에선 public 로그인 사용자가 agent 메시지를 읽을 수 있음(Firestore list 쿼리가 세션별 필터 불가). **공개 뷰어가 `isCommentStream`으로 필터**해 UI에서 가린다(현행 멤버 방식의 연장). 완전 차단은 범위 밖.

### 4-3. tab_comments 생성 — 비멤버 로그인 commenter (D2)
인간 댓글 생성 조건에 public 경로 추가(기존 (a)/(b)는 유지):
```
(
  request.resource.data.get('authorType','human') == 'human'
  && request.resource.data.authorUid == request.auth.uid
  && request.resource.data.resolved == false
  && (
    isOwnerCmt()
    || (isMemberCmt() && isCommenter() && commentsWritable()
        && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)))
    || (parentIsPublic() && isSignedIn() && commentsWritable()
        && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)))   // ← 신규
  )
)
```
- `isCommentSessionRef` 강제로 agent 세션 오염 방지. author 본인·human·resolved=false 동일.
- 단, `isCommentSessionRef(null)`도 통과(legacy) — public 작성은 **반드시 댓글 세션 id를 부여**하도록 클라에서 보장(§5).

### 4-4. 모더레이션 — 오너 delete 허용 (D4)
현재 delete는 작성 본인만. 공개 모더레이션 위해 **오너의 delete 허용 추가**:
```
allow delete: if (resource.data.authorUid == request.auth.uid) || isOwnerCmt();
```
(기존: 본인만. 변경: 본인 OR 오너. 멤버/공개 공통 적용 — 오너가 자기 문항의 악성 댓글 정리 가능.)

## 5. Live 공개 뷰어 (`app/p/[problemId]/page.tsx`)

- 살아있는 `problems/{id}` + 공개 탭 블록 + 댓글을 읽어 렌더(읽기 전용).
- **비로그인**: 본문 열람 + "댓글을 남기려면 로그인" 안내(Google 로그인 버튼).
- **로그인**: CommentPanel(공개 commenter 모드)로 작성/조회. **`isCommentStream` 필터로 agent 메시지 제외**.
  - public 작성 시 댓글 세션(`type=='comment'`) 보장: 없으면 생성(오너만 세션 생성 가능하던 Phase 47 규칙 확인 필요 — public 작성자는 세션 생성 권한이 없을 수 있음 → §9 리스크).
- **실시간**: 블록·댓글 `onSnapshot` 구독 → 편집/새 댓글 즉시 반영.
- **비공개 전환**: 규칙상 읽기 차단 → "비공개로 전환되었습니다" 안내.
- 헤더 Mathory 브랜드 + 회원가입 CTA(Phase 50 뷰어 톤 재사용).

> 구현(D5): **새 경량 `PublicProblemView`**. 본문 렌더는 `/shared` 뷰어의 TabContent 패턴 재사용, 댓글은 CommentPanel 재사용. ProblemView(편집 affordance 다수) 분기보다 가벼움.

## 6. 오너 UI (`ShareSettingsPanel` 확장)

- "실시간 공개" 토글을 **'웹에 공개(스냅샷)' 섹션과 시각적으로 분리**해 추가(혼동 방지).
  - ON → `updateProblem(id, { visibility: 'public' })` → 링크 `/p/{id}` 표시 + 복사.
  - OFF → `visibility: 'private'`.
- 댓글 허용(`commentsWritable`)·표시(`commentsVisible`) 토글을 public 맥락에서 노출(Phase 47 UI 재사용 가능 시).
- 공개 탭은 기존 "공유할 탭" 체크박스 공통.

## 7. 결정 (확정 — 모두 권장안)
- **D1.** public 블록 탭 필터 **적용**(멤버와 동일).
- **D2.** public 댓글 읽기/쓰기 규칙 **추가**(로그인 + 공개 + commentsVisible/Writable).
- **D3.** agent 메시지 누출 = **UI 필터(`isCommentStream`)로 한정**, 규칙 레벨 누출 수용. 완전 차단(agent 분리)은 범위 밖.
- **D4.** 오너 **모더레이션 delete 허용**(본인 OR 오너).
- **D5.** live 뷰어 = **새 경량 PublicProblemView**.
- **D6.** 공유 트리 `실시간 공개` 노드 = **이번엔 토글·링크만**, 트리 노드는 후속.
- **D7.** 비로그인 댓글 = **불가(범위 밖)** 확정.

## 8. 단계 (단계별 커밋)
중간 규모. 기존 visibility·댓글 인프라·`/shared` 패턴 재사용.
1. **규칙**: 블록 public 탭 필터(4-1) + tab_comments public read/create(4-2/4-3) + 오너 delete(4-4). 스모크 테스트.
2. **lib/권한**: `canComment`에 public 경로, ShareSettingsPanel "실시간 공개" 토글(+링크/복사).
3. **Live 뷰어**: `app/p/[problemId]` + PublicProblemView(본문 onSnapshot, 로그인 안내).
4. **공개 댓글**: CommentPanel public 모드(로그인 commenter, `isCommentStream` 필터, 댓글 세션 보장).
5. **마감**: 비공개 전환 안내 + CTA + 회귀(멤버/스냅샷/댓글) 점검 + build.

## 9. 리스크 & 주의사항
- **AI 메시지 누출(D3)**: 규칙 레벨에서 public 로그인 사용자가 `tab_comments`의 agent 메시지를 읽을 수 있음. UI 필터로 가리되 **"민감 문항은 공개 금지"** 안내. 완전 차단은 agent 메시지 분리(별도 Phase).
- **댓글 세션 생성 권한**: Phase 47 규칙상 `discussion_sessions` create가 오너로 좁혀졌을 수 있음. public 작성자는 댓글 세션을 만들 권한이 없을 수 있어, **오너가 공개 시 댓글 세션을 선제 생성**하거나 규칙에서 "공개 문항 댓글 세션은 로그인 사용자도 생성 가능"을 검토(§1 구현 시 firestore.rules의 `discussion_sessions` 블록 재확인 필수).
- **스팸/악용**: 로그인 강제로 추적성 확보. 누구나 댓글 가능 → 오너 모더레이션(D4)으로 대응. 신고/차단·레이트리밋은 후속(규칙으론 어려움).
- **공개 범위 오인**: 스냅샷 vs 실시간 2채널 → 라벨·경고로 명확히(§2).
- **regression**: 멤버 공유/스냅샷 공개/기존 댓글 동작 회귀 점검.

## 10. 수락 기준
- [ ] 오너가 "실시간 공개" ON → `/p/{id}` 링크 발급, 비로그인도 본문 열람
- [ ] 공개 탭 필터 적용(비공개 탭은 public에 안 보임)
- [ ] 로그인 사용자(비멤버 포함)가 댓글 작성/조회, agent 메시지는 안 보임
- [ ] 편집 저장 시 공개 뷰에 실시간 반영(onSnapshot)
- [ ] 오너가 악성 댓글 삭제(모더레이션) 가능
- [ ] 비공개 전환 시 공개 뷰 차단 + 안내
- [ ] 기존 멤버 공유/스냅샷 공개/댓글 회귀 없음, build 통과, 규칙 스모크 테스트 통과

## 11. 커밋 & 푸시
- 구현·커밋까지만. `git push`·규칙 배포(`firebase deploy --only firestore:rules`)는 덕수가 직접.
- **이번 Phase는 규칙 변경 있음** → 배포 전 권한 스모크 테스트 필수.
