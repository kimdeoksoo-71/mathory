# Phase 50 — 공유 기능 확장개편 (C) : 웹에 공개 UI 재배치

> **공유 개편 3부작 중 3부.** Phase 48(A)·49(B) 배포 후 진행.
> 웹 공개의 **데이터 계층은 이미 완성**(`lib/shares.ts`, `shares/{shareId}` 스냅샷 모델, `app/shared/[shareId]`). 이 단계는 **UI 재배치 + 만료 정책 조정**이 핵심이다.
> **코드 대조 보완(이 문서 확정본):** 계획 초안의 "ListView 확장"·"ShareTargetModal 탭" 전제는 코드와 어긋나, **전용 `WebShareList` + `ShareSettingsPanel` 생성 UI** 구조로 변경한다(§A 결정).

## 0. 선행 확인 (구현 전 반드시 읽을 것)

- `lib/shares.ts` — `DEFAULT_EXPIRY_HOURS`(72, **현재 미사용**), `MAX_EXPIRY_DAYS`(30), `createShare({problemId, ownerUid, expiryHours, tabVisibility})`, `getShare`, `revokeShare`, `isShareExpired`, `getShareByProblem`(per-problem). **`where(ownerUid==uid)` 전체 listing은 없음 → 신설 필요.**
- `app/shared/[shareId]/page.tsx` — 비로그인 뷰어, 만료 시 "만료된 공유 링크입니다" 표시(이미 처리됨)
- `firestore.rules` — `shares` 규칙(read: any / create·delete: owner / update: false). **변경 불필요.**
- `firestore.indexes.json` — `shares` 인덱스 없음. `getShareByProblem`(2 equality + orderBy)은 콘솔 수동 인덱스로 추정. 신규 listing은 **클라 정렬로 인덱스 회피**.
- `components/share/ShareSettingsPanel.tsx`(Phase 49 D) — 문항 '공유 설정' 인라인. **여기에 "웹에 공개" 섹션을 복원**(구 SharePanel 웹 섹션 자리).
- `components/problem/ListView.tsx`(Phase 49) — Problem 기반. **웹 공개엔 부적합**(아래 §A2) → 재사용 안 함.
- 구 `SharePanel.tsx`는 Phase 49 D에서 **삭제됨** — 웹 생성 로직은 git 이력에서 참고만.

## A. 코드 대조 보완 (초안 → 확정 변경점)

- **A1. owner별 listing 신설:** `listSharesByOwner(uid)` — `where(ownerUid==uid)`만 쿼리하고 `createdAt` **클라 정렬**(복합 인덱스 회피, Phase 49 `listSharedWithMe` 패턴).
- **A2. 웹 리스트 = 전용 `WebShareList`:** ListView는 `Problem[]` 전제라 `ShareWithSnapshot[]`(스냅샷·만료·링크·revoke)과 안 맞는다. **전용 컴포넌트**로 구현.
- **A3. 생성 UI = `ShareSettingsPanel`:** 멤버 검색용 `ShareTargetModal`이 아니라, 문항 단위 '공유 설정'에 "웹에 공개" 섹션 복원.
- **A4. createShare 시그니처 유지:** `createShare({ problemId, ownerUid, expiryHours, tabVisibility })`. 일 프리셋 → `days*24`(시간) 변환. 무기한=`expiryHours: null`.
- **A5. 블록체인 배지 생략:** `ShareSnapshot`에 `blockchain` 없음 → 웹 리스트에 배지 미표시.
- **A6. 뷰어 만료 문구 통일:** "공개가 종료되었습니다"로 소폭 보강(기능은 이미 존재). 서버측 차단은 범위 밖(§5).

## 1. 목표 (결정 반영)

1. `공유 > 공유 보낸 > 웹에 공개` 노드 콘텐츠를 **전용 리스트(`WebShareList`)**로 표시.
2. **만료 칩 3 / 7 / 30 / 무기한, 기본값 무기한.**
3. 링크 복사 · 공개 중단(revoke).
4. 문항 '공유 설정'(ShareSettingsPanel)에서 **웹에 공개로 거는 경로** 제공(모달/버튼, DnD 보류).
5. 공유 탭은 **생성 시 스냅샷**이라 사후 변경 불가 → 읽기전용 + 재공개 안내.

## 2. 만료 정책 조정 (`lib/shares.ts`)

```ts
// 일 단위 프리셋 (null = 무기한), 기본 무기한
export const EXPIRY_PRESET_DAYS: (number | null)[] = [3, 7, 30, null];
export const DEFAULT_EXPIRY_DAYS: number | null = null;
```
- 기존 `DEFAULT_EXPIRY_HOURS=72`는 **현재 미사용**(SharePanel 삭제)이라 안전하게 무시/대체. `MAX_EXPIRY_DAYS=30` 유지.
- UI는 일 프리셋을 고르고 `createShare`에 `expiryHours = days==null ? null : days*24`로 전달.
- 만료일 = 게시 시점 + N일. 무기한은 `expiresAt = null`(모델이 이미 `Date | null` 지원).

> **공유 문서는 update 불가(규칙).** 만료일 변경은 **revoke + 재발급**(delete 후 create)으로 처리. 이때 **shareId가 바뀌어 기존 링크가 죽는다** → UI에서 "만료일을 바꾸면 링크가 새로 발급됩니다" 경고.

## 3. 신규 listing 함수 (`lib/shares.ts`)

```ts
/** 내가 웹 공개한 share 목록 (createdAt 내림차순, 클라 정렬 — 인덱스 회피) */
export async function listSharesByOwner(uid: string): Promise<ShareWithSnapshot[]> {
  const snap = await getDocs(query(collection(db, 'shares'), where('ownerUid', '==', uid)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        problemId: data.problemId,
        ownerUid: data.ownerUid,
        createdAt: toDateSafe(data.createdAt),
        expiresAt: toDateOrNull(data.expiresAt),
        tabVisibility: data.tabVisibility || {},
        snapshot: data.snapshot || { title: '', tabs: [], tabBlocks: {} },
        ownerDisplayName: data.ownerDisplayName || '',
        ownerPhotoURL: data.ownerPhotoURL || '',
      } as ShareWithSnapshot;
    })
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
}
```
(매핑은 기존 `getShare`/`getShareByProblem`과 중복 → 내부 `mapShareDoc` 헬퍼로 추출 권장.)

## 4. 웹 공개 리스트 (`components/share/WebShareList.tsx`, 전용)

AppShell의 `view.scope.kind === 'sent-web'`일 때 placeholder 대신 이 컴포넌트를 렌더. `listSharesByOwner(uid)` 결과를 받는다.

| 컬럼 | 동작 |
|---|---|
| 제목 (클릭) | 비로그인 뷰어(`/shared/{shareId}`) 새 탭 |
| 게시일 | `share.createdAt` |
| 공유 탭 | **읽기전용**(스냅샷 `tabVisibility`). 변경하려면 재공개 안내 |
| 만료 | **편집 칩** 3/7/30/무기한 → 변경 시 revoke+재발급 경고 다이얼로그 |
| 링크 복사 | `navigator.clipboard.writeText(절대 URL)` + 토스트 |
| 공개 중단 | `revokeShare`(문서 delete). 확인 다이얼로그 |

- 메타 컬럼 없음 / 블록체인·댓글 배지 없음(A5).
- 변경/중단 후 AppShell `loadData`(또는 별도 리프레시 콜백)로 목록 갱신.

## 5. My → 웹에 공개로 거는 경로 (`ShareSettingsPanel` 확장)

문항 '공유 설정'(ProblemView 우측 '공유' 펼침)에 **"웹에 공개" 섹션** 추가:
- `getShareByProblem(problemId, ownerUid)`로 기존 공개 여부 확인.
- **없으면:** 만료 프리셋(기본 무기한) 선택 → `createShare(...)` → shareId 발급 → 링크 즉시 복사 제공.
- **이미 공개 중이면(단일 활성 링크 정책):** 신규 생성 막고 **기존 링크 표시(링크 보기/복사) + 만료 변경(revoke+재발급 경고)**.
- 공유 탭은 현재 `ShareSettingsPanel`의 탭 가시성 토글 값을 `tabVisibility`로 사용.
- (보류) DnD: My 문항 → `웹에 공개` 노드 드롭 = 동일 생성 플로우. **모달 우선, DnD는 Phase 49와 동일하게 보류**(교차영역 DnD 미해결).

## 6. 만료 차단의 한계 (정직하게 명시)

만료 차단은 **뷰어의 클라이언트 `expiresAt` 검사 + 소유자 revoke**에 의존한다. 만료돼도 share 문서 자체가 남아있으면 직접 문서를 읽는 식의 접근은 가능(현실적 위험 낮음). 진짜 차단(스케줄 Cloud Function 자동 삭제 / SSR 뷰어)은 **이번 범위 밖**. 이번 C는 뷰어가 만료 시 **"공개가 종료되었습니다"** 안내를 확실히 띄우는 것까지 보장(기존 처리 문구 통일·보강, A6).

## 7. 리스크 & 주의사항
- **revoke+재발급으로 링크 변경:** "만료만 늘리고 싶다"는 흔한 기대와 어긋남 → 만료 변경 UI에 강한 경고.
- **스냅샷 정시성:** 웹 공개는 생성 시점 스냅샷. 원문 수정은 공개본에 반영 안 됨 → 리스트 "게시일"로 인지시키고, 최신 반영은 재공개.
- **clipboard API:** https/사용자 제스처 컨텍스트 필요 → 버튼 클릭 핸들러 내에서 호출.
- **shares 규칙 변경 불필요:** create/delete만으로 충족(update:false 유지).
- **인덱스:** `listSharesByOwner`는 클라 정렬이라 신규 인덱스 불필요(A1/B5).

## 8. 수락 기준 (체크리스트)
- [ ] `웹에 공개` 노드가 전용 리스트로 표시(제목/게시일/탭/만료/링크복사/중단)
- [ ] 새 공개 시 기본 만료 = 무기한, 프리셋 3/7/30/무기한 선택 가능
- [ ] 만료 변경 시 "링크 재발급" 경고 후 revoke+재발급(shareId 변경)
- [ ] 링크 복사 버튼이 절대 URL을 클립보드에 복사
- [ ] 공개 중단 시 share 문서 삭제 + 리스트에서 제거
- [ ] 문항 '공유 설정'에서 웹에 공개 생성/링크 확인, 한 문항 활성 링크 1건 유지
- [ ] 비로그인 사용자가 유효 링크로 뷰어 접근, 만료 링크는 "공개가 종료되었습니다" 안내
- [ ] `npm run build` 통과 + 기존 멤버/댓글 회귀 없음

## 9. 커밋 & 푸시
- 구현·커밋까지만. `git push`/규칙 배포는 덕수가 직접(이번 단계는 규칙 변경 없음).
- 권장 단계 커밋: (만료 정책+listing) → (WebShareList) → (ShareSettingsPanel 웹 섹션) → (뷰어 만료 안내 보강).

---

## 부록 — 공유 개편 전체 요약

| Phase | 범위 | 데이터 변경 | 핵심 산출 |
|---|---|---|---|
| 47 | 댓글 / agent 분리 | `commentsVisible`/`commentsWritable` | 댓글(사람)·agent(AI) 패널 분리 |
| 48 (A) | 프로필·검색·규칙 | `users.nickname_lower`, `nicknames` | 닉네임 전역 유일·검색·진입 가드 |
| 49 (B) | 공유 트리·모달·리스트 | 없음(기존 활용) | ShareTree, ShareTargetModal, ListView, SharePanel 제거 |
| 50 (C) | 웹에 공개 UI 재배치 | 없음(기존 `shares` 활용) | WebShareList, 만료칩(기본 무기한), 링크/중단, ShareSettingsPanel 웹 섹션 |

**확정 설계 결정**
- 탭 가시성: **전역**(`memberTabVisibility`, 문항당 1개).
- 권한(보기/댓글): **사람별**(`members[uid]`), 기본 댓글.
- 닉네임: **전역 유일**.
- **웹 공개 댓글: 불가** — 댓글은 멤버 공유 한정(로그인 + commenter). 웹 뷰어는 스냅샷 읽기 전용.
- 받은 문항: 사본/삭제 없음, **공유 떠나기**만.
- 댓글 배지 = 댓글 스트림 미해결 수(`countComments` 재사용, 비정규화 안 함).
- DnD: **모달(버튼) 경로 우선**, 교차영역 DnD 보류.
