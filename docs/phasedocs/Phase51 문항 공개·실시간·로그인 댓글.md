# Phase 51 — 문항 공개: 스냅샷 + 실시간 + 로그인 댓글

> 공유 개편 후속. **Phase 50의 "웹에 공개(스냅샷)"를 흡수해, 하나의 "문항 공개" 개념으로 통합**한다.
> 핵심 추가: **(가) 실시간 공개**(원본 편집 즉시 반영) + **(나) 로그인 회원 댓글**. 비로그인 댓글은 범위 밖(D7).
> 번호: 기존 `Phase 51 수식 필기 입력` 스케치는 **추후 덕수가 52로 이동** 예정 → 이 문서가 **51**.
> 결정 확정: D1~D8 모두 권장안(§8).

## 핵심 UX 결정: "문항 공개" 하나로 통합 (D8)

스냅샷/실시간을 **별도 카테고리로 나누지 않는다.** 사용자에겐 "이 문항을 공개했는가"가 하나의 개념이고, 스냅샷·실시간은 그 공개의 **방식(속성)**일 뿐이다.

- 사이드바 노드: **"문항 공개"** 1개 (현 "웹에 공개" 대체).
- **같은 리스트**에 스냅샷 공개 + 실시간 공개를 함께 나열, 각 행에 `[스냅샷]` / `[실시간]` **방식 배지**.
- 생성 UI: 문항 '공유 설정'의 "문항 공개" 섹션에서 **라디오로 방식 선택** 후 발급.

| 방식 | 스냅샷으로 공개 (Phase 50 기존) | 실시간 공개 (Phase 51 신규) |
|---|---|---|
| 저장 | `shares/{shareId}` (문항당 **여러 개 가능**) | `problems/{id}.visibility='public'` (문항당 **1개**) |
| 편집 반영 | ✗ (재발급 필요) | ✓ (저장 즉시) |
| 링크 | `/shared/{shareId}` | `/p/{problemId}` |
| 댓글 | 불가 | **로그인 시 가능** |
| 만료 | 있음(칩) | 없음(on/off) |
| 고유 동작 | 만료 변경·재발급 | 비공개 전환·댓글 |

> **한 문항이 여러 행으로 보일 수 있음**(스냅샷 N개 + 실시간 1개). 막지 않고 방식 배지로 구분해 나열한다. 자연스러운 결과로 수용.

## 0. 선행 확인 (구현 전 반드시 읽을 것)

기억이 아니라 현재 파일을 직접 읽고 시작한다.

- `types/problem.ts` — `Visibility = 'private' | 'link' | 'public'`(존재), `Problem.visibility`, `commentsVisible`/`commentsWritable`(Phase 47), `memberTabVisibility`
- `firestore.rules` — **코드 대조 완료**:
  - `problems` read: `isOwner() || isPublic() || isMember()`. **`isPublic()`은 인증 불요** → 비로그인 live 읽기 이미 가능.
  - 블록 서브컬렉션 read: public이면 블록 공개되나 **탭 가시성 필터가 멤버에게만 적용**(public은 전 탭 노출) → §4-1 보완.
  - `tab_comments` read: `isOwnerCmt() || (isMemberCmt() && commentsVisible())` → 비멤버 공개 사용자 불가, §4-2 추가.
  - `tab_comments` create: 오너/commenter 멤버만 → §4-3 추가.
  - `discussion_sessions` create: **오너로 좁혀졌을 가능성**(Phase 47) → 공개 작성자의 댓글 세션 생성 경로 §9 재확인 필수.
  - ⚠️ agent AI 메시지도 `tab_comments`에 있어 규칙 레벨에선 읽힘(UI 차단) → D3.
- `lib/shares.ts` — `listSharesByOwner`(Phase 50), `createShare`, `revokeShare`, `getShareByProblem`, `EXPIRY_PRESET_DAYS`
- `components/share/WebShareList.tsx`(Phase 50) — **`PublishList`로 확장**해 실시간 항목도 포함(§5)
- `components/share/ShareSettingsPanel.tsx`(Phase 50) — '웹에 공개' 섹션 → **"문항 공개"(방식 라디오)**로 개편(§7)
- `components/layout/AppShell.tsx` — `sent-web` scope(Phase 49/50) → 라벨 "문항 공개", 데이터에 실시간 항목 합류
- `components/layout/ShareTree.tsx` — "웹에 공개" 라벨 → "문항 공개"
- `app/shared/[shareId]/page.tsx` — 스냅샷 뷰어(그대로). live 뷰어는 새 라우트 `app/p/[problemId]`
- `components/comment/CommentPanel.tsx` — `canComment` prop, `isOwner` 내부 파생. 공개 commenter 경로 추가
- `lib/comments.ts` — `isCommentStream`(Phase 47): live 뷰어 댓글 필터에 재사용
- `lib/membership.ts` — `canComment(problem, uid)`(owner/commenter만) → public 경로 추가

## 1. 목표 & 비목표

**목표**
1. "문항 공개" 단일 개념으로 스냅샷·실시간을 **한 리스트**에서 관리(방식 배지).
2. 실시간 공개(`visibility='public'`): 비로그인 포함 누구나 live 본문 열람, 편집 즉시 반영.
3. 로그인 사용자(비멤버 포함)가 공개 문항에 댓글.
4. 오너: 방식 선택 공개 + 링크 + 비공개/중단 + 악성 댓글 모더레이션.

**비목표(범위 밖)**
- 비로그인 댓글(D7).
- 실시간 공동 편집(공개는 읽기 전용).
- agent 메시지 완전 차단을 위한 별도 컬렉션 분리(D3 — 별도 Phase).

## 2. 통합 "문항 공개" 리스트 (`PublishList`)

`WebShareList`(Phase 50)를 확장 → 두 소스를 합쳐 렌더:
- 스냅샷: `listSharesByOwner(uid)` → 각 share = `[스냅샷]` 행.
- 실시간: 내 문항 중 `visibility==='public'` → `[실시간]` 행. (AppShell `allProblems`에서 필터 가능 — 추가 쿼리 불필요.)
- 정렬: 공개일(스냅샷=createdAt, 실시간=문항 updated_at 또는 별도 publishedAt) 내림차순. **publishedAt 없으니 실시간은 updated_at 사용**(§3 결정).

| 컬럼 | 공통 | 스냅샷 전용 | 실시간 전용 |
|---|---|---|---|
| 방식 배지 | `[스냅샷]`/`[실시간]` | | |
| 제목(클릭) | 해당 뷰어 새 탭 | `/shared/{id}` | `/p/{id}` |
| 공개일 | ✓ | createdAt | updated_at |
| 만료 | | 칩(변경=재발급) | — |
| 댓글 | | — | 미해결 수(클라 `countComments`) |
| 링크 복사 | ✓ | | |
| 중단 | ✓ | revoke(delete) | `visibility='private'` |

- 메타 컬럼·블록체인 배지 없음(스냅샷엔 데이터 없음, Phase 50 일관).

## 3. 데이터 모델 (변경 최소)
- `visibility='public'` 재사용. 토글 = `updateProblem(id, { visibility })`.
- 공개 탭: **`memberTabVisibility` 재사용**(멤버·실시간 공통). 규칙에서 public 블록 읽기에도 탭 필터 적용(§4-1). (스냅샷은 생성 시 `tabVisibility` 동결 — 기존대로.)
- 댓글 정책: `commentsVisible`/`commentsWritable`(Phase 47) 재사용.
- 정렬용 `publishedAt`은 **신설하지 않음** — 실시간 행은 `updated_at` 사용(단순). 필요 시 후속.
- 비정규화 없음(Phase 49 일관): 댓글 수 클라 계산.

## 4. 보안 규칙 변경 (`firestore.rules`)

### 4-1. 블록 읽기 public 탭 필터 (D1)
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

### 4-2. tab_comments 읽기 — 공개 + 로그인 (D2)
```
allow read: if isOwnerCmt()
  || (isMemberCmt() && commentsVisible())
  || (parentIsPublic() && isSignedIn() && commentsVisible());
```
⚠️ agent 메시지 누출(D3): 공개 뷰어가 `isCommentStream`으로 UI 필터. 규칙 레벨 누출 수용.

### 4-3. tab_comments 생성 — 비멤버 로그인 commenter (D2)
인간 댓글 create 조건에 public 경로 추가(기존 유지):
```
|| (parentIsPublic() && isSignedIn() && commentsWritable()
    && isCommentSessionRef(request.resource.data.get('discussionSessionId', null)))
```
author 본인·human·resolved=false 동일. 댓글 세션 참조 강제(agent 세션 오염 방지).

### 4-4. 모더레이션 — 오너 delete 허용 (D4)
```
allow delete: if (resource.data.authorUid == request.auth.uid) || isOwnerCmt();
```

## 5. Live 공개 뷰어 (`app/p/[problemId]/page.tsx`)
- 살아있는 `problems/{id}` + 공개 탭 블록 + 댓글 렌더(읽기 전용), `onSnapshot`으로 실시간 반영.
- 비로그인: 본문 + "댓글은 로그인 후" 안내(Google 로그인).
- 로그인: CommentPanel(공개 commenter 모드), **`isCommentStream` 필터로 agent 메시지 제외**.
- 비공개 전환 시: 읽기 차단 → "비공개로 전환되었습니다" 안내.
- 헤더: Phase 50 스냅샷 뷰어와 동일한 로고/슬로건(메인과 통일된 스타일).
- 구현(D5): **새 경량 `PublicProblemView`** — `/shared` 뷰어 TabContent 패턴 + CommentPanel 재사용.

## 6. 오너 UI (`ShareSettingsPanel` → "문항 공개")
- 현 '웹에 공개' 섹션을 **"문항 공개"**로 개편. 방식 **라디오: ○ 스냅샷으로 공개  ○ 실시간 공개**.
  - 스냅샷: 만료 프리셋(기본 무기한) → `createShare(...)` → `/shared/{id}` 링크.
  - 실시간: `updateProblem(id,{visibility:'public'})` → `/p/{id}` 링크. 댓글 허용/표시 토글(`commentsWritable`/`commentsVisible`) 노출.
- 공개 탭은 기존 "공유할 탭" 체크박스 공통.
- 라벨/설명으로 "스냅샷=동결, 실시간=편집 반영·댓글" 차이를 명시.

## 7. (참고) Phase 50 기존 자산 개편 맵
- `WebShareList` → `PublishList`(두 소스 통합, 방식 배지).
- ShareTree/AppShell "웹에 공개" 라벨 → "문항 공개", `sent-web` scope 데이터에 실시간 합류.
- ShareSettingsPanel '웹에 공개' 섹션 → "문항 공개"(방식 라디오) + 실시간 토글.
- 스냅샷 관련 로직(`lib/shares.ts`, `/shared` 뷰어)은 그대로 유지.

## 8. 결정 (확정 — 모두 권장안)
- **D1.** public 블록 탭 필터 **적용**.
- **D2.** public 댓글 읽기/쓰기 규칙 **추가**.
- **D3.** agent 메시지 누출 = **UI 필터(`isCommentStream`)로 한정**, 규칙 레벨 누출 수용.
- **D4.** 오너 **모더레이션 delete 허용**.
- **D5.** live 뷰어 = **새 경량 PublicProblemView**.
- **D6.** 공유 트리에 방식별 하위 노드 **두지 않음** — "문항 공개" 단일 노드 + 방식 배지.
- **D7.** 비로그인 댓글 **불가**.
- **D8.** **스냅샷·실시간을 "문항 공개" 하나로 통합**(별 카테고리 금지), 한 리스트·방식 속성.

## 9. 단계 (단계별 커밋)
중간 규모. 기존 visibility·댓글·shares·`/shared` 자산 재사용.
1. **규칙**: 블록 public 탭 필터(4-1) + tab_comments public read/create(4-2/4-3) + 오너 delete(4-4) + **`discussion_sessions` 공개 댓글 세션 경로 확인/보완**(§리스크). 스모크 테스트.
2. **통합 리스트**: `WebShareList`→`PublishList`(스냅샷+실시간 행, 방식 배지), ShareTree/AppShell 라벨 "문항 공개".
3. **오너 UI**: ShareSettingsPanel "문항 공개"(방식 라디오 + 실시간 토글), `canComment` public 경로.
4. **Live 뷰어**: `app/p/[problemId]` + PublicProblemView(onSnapshot, 로그인 안내).
5. **공개 댓글**: CommentPanel public 모드(`isCommentStream` 필터, 댓글 세션 보장).
6. **마감**: 비공개 전환 안내 + 회귀(멤버/스냅샷/댓글) 점검 + build + 규칙 배포 스모크.

## 10. 리스크 & 주의사항
- **AI 메시지 누출(D3)**: 규칙으론 세션 필터 불가 → UI 필터 의존. "민감 문항 공개 금지" 안내. 완전 차단은 agent 분리(별도 Phase).
- **댓글 세션 생성 권한**: Phase 47에서 `discussion_sessions` create가 오너로 좁혀졌으면, public 작성자가 댓글 세션을 못 만든다. **대안 (a)** 오너가 실시간 공개 시 댓글 세션 선제 생성, **(b)** 규칙에 "공개 문항 댓글 세션은 로그인 사용자 생성 허용" 추가. 1단계에서 규칙 재확인 후 택1.
- **한 문항 다중 행**: 스냅샷 여러 개 + 실시간 → 정상. 방식 배지로 구분, 중단은 각 행 단위.
- **스팸/악용**: 로그인 강제로 추적성 확보 + 오너 모더레이션(D4). 신고/차단·레이트리밋은 후속.
- **공개 범위 오인**: 방식 배지·설명으로 스냅샷(동결) vs 실시간(반영·댓글) 차이 명확히.
- **regression**: 멤버 공유/스냅샷 공개/기존 댓글 회귀 점검.

## 11. 수락 기준
- [ ] "문항 공개" 노드 하나에 스냅샷·실시간이 방식 배지와 함께 한 리스트로 보임
- [ ] 오너가 방식 라디오로 스냅샷/실시간 선택 공개, 각 링크 발급
- [ ] 실시간: 비로그인 본문 열람, 공개 탭 필터 적용, 편집 즉시 반영(onSnapshot)
- [ ] 로그인 사용자(비멤버 포함) 댓글 작성/조회, agent 메시지 비노출
- [ ] 오너 악성 댓글 삭제(모더레이션)
- [ ] 비공개/중단 시 해당 뷰 차단 + 안내, 리스트에서 제거
- [ ] 기존 멤버/스냅샷/댓글 회귀 없음, build 통과, 규칙 스모크 테스트 통과

## 12. 커밋 & 푸시
- 구현·커밋까지만. `git push`·규칙 배포(`firebase deploy --only firestore:rules`)는 덕수가 직접.
- **규칙 변경 있음** → 배포 전 권한 스모크 테스트 필수.

---
> **외부 검토 요청 포인트(웹 Claude Code용):** ① D8 통합 리스트가 두 데이터원(shares vs public problems)을 한 화면에 섞는 설계의 타당성, ② D3 agent 메시지 누출을 UI 필터로만 막는 것의 위험 수용 여부, ③ 댓글 세션 생성 권한(§10) 처리 방식 (a/b), ④ 한 문항 다중 행 UX.
