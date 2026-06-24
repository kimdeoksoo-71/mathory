# Phase 48 — 공유 기능 확장개편 (A) : 프로필 · 검색 · 인가 기반

> **공유 개편 3부작(Phase 48 · 49 · 50) 중 1부.** 데이터/인가 기반만 다룬다. 좌측 공유 트리·리스트 보기·SharePanel 제거는 **Phase 49(B)**, 웹 공개 UI 재배치는 **Phase 50(C)**.
> 댓글/agent 분리(**Phase 46**)는 이 공유 개편과 독립적이며 먼저 진행한다. 권장 순서: **46 → 48 → 49 → 50**.
> **이 문서는 단독으로 빌드·배포 가능해야 한다.** A를 먼저 배포해 두면 B/C가 안정적인 기반 위에서 진행된다.
> 레포 최신 기준 직전 phase는 Phase 45(블록 전체 접기). 댓글/agent 분리가 46 → 이 문서가 **48**.

## 0. 선행 확인 (구현 전 반드시 읽을 것)

기억이 아니라 현재 파일을 직접 읽고 시작한다.

- `types/problem.ts` — `UserProfile`, `Problem.members/memberUids/memberTabVisibility`, `MemberRole`, `Share`, `DiscussionSession`
- `lib/users.ts` — `upsertUserProfile`(신규 시 `nickname='KDS'` 부여), `getUserProfile`, `updateNickname`(현재 유일성·`nickname_lower` 없음), `DEFAULT_NICKNAME='KDS'`, `NICKNAME_MAX_LENGTH=20`
- `lib/membership.ts` — `searchUsersByEmailPrefix`, `lookupUserByEmail`, 멤버 CRUD(`addMember`/`removeMember`/`updateMemberRole`/`leaveAsMember`/`setMemberTabVisibility`), `listSharedWithMe`, `getMemberRole`/`canComment`/`canEdit`
- `lib/ai-models.ts` — `getReservedNicknames`
- `firestore.rules` — `users`(≈9), `problems`, `discussion_sessions`(≈208), `shares` 규칙
- `firestore.indexes.json`

> **⚠️ 확인된 버그(재검토):** 현재 `searchUsersByEmailPrefix`(membership.ts:26)의 범위 상한이 `where('email', '<', trimmed + '')`이다. 이는 `>= trimmed AND < trimmed`라 **항상 빈 결과**(`'\uf8ff'` 상한이 빠짐). 신규 `searchUsers`는 반드시 상한을 `q + '\uf8ff'`로 둘 것. (기존 함수도 고치면 좋으나 본 작업은 `searchUsers`로 대체하므로 필수는 아님.)

## 1. 목표

공유 대상자를 **대화명(닉네임)으로 검색·선택**할 수 있게 하고, 그 전제가 되는 닉네임 체계를 정비한다.

| 항목 | 결정 |
|---|---|
| 닉네임 설정 | 본인이 직접 설정. 기본값 'KDS' 잔존 사용자는 진입 시 설정 유도 |
| 닉네임 유일성 | **전역 유일 강제** (중복 시 거부) |
| 닉네임 검색 | 정규화 필드 `nickname_lower` + prefix 범위 쿼리 |
| 사용자 검색 | 이메일 prefix **+ 닉네임 prefix** 통합 |

## 2. 데이터 모델 변경

### 2-1. `users/{uid}` 필드 추가
```
users/{uid}
  ├─ displayName, email, photoURL, createdAt   (기존)
  ├─ nickname: string                          (기존, 기본 'KDS')
  └─ nickname_lower: string                    (★신규, 검색·유일성 정규화 키)
```
`nickname_lower = normalize(nickname)` — `trim().toLowerCase()`. 한글은 대소문자 개념이 없어 사실상 trim 결과와 동일.

> **이메일 검색 정규화(재검토):** `upsertUserProfile`은 `email`을 원본 그대로 저장한다(소문자화 안 함). 대부분 구글 계정 이메일은 소문자라 prefix 검색이 동작하지만, 대문자 섞인 이메일이 있으면 누락된다. 견고하게 하려면 `email_lower`도 함께 저장·검색하는 것을 권장(범위는 작음, 선택). 미적용 시 "이메일은 소문자 가정" 한계를 인지.

### 2-2. 닉네임 예약 컬렉션 (유일성 보장)
쿼리 기반 중복확인은 경합 조건(race)이 있으므로, **예약 문서로 원자적 유일성**을 강제한다.
```
nicknames/{nickname_lower}
  └─ uid: string
```
- 문서 ID = `nickname_lower`. 따라서 닉네임 문자셋을 제한해야 안전한 문서 ID가 됨.
- **닉네임 검증 규칙(클라이언트 + 서버):** 1~20자, `/ \ . # $ [ ]` 및 제어문자 금지, 공백 단독 금지, AI 예약 닉네임 금지(기존 `getReservedNicknames`).

## 3. `lib/users.ts` — 닉네임 정비

`updateNickname(uid, raw)`를 **트랜잭션 기반 유일성 교체**로 재작성한다. (현재 구현은 단순 `updateDoc({nickname})`이라 유일성·정규화 필드가 없음.)

```ts
import { runTransaction, doc } from 'firebase/firestore';

const NICK_BAD = /[\/\\.#$\[\]\u0000-\u001f]/;

function normalizeNickname(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 닉네임 변경: 전역 유일 강제 + nickname_lower/예약문서 동기화 (원자적) */
export async function updateNickname(uid: string, raw: string): Promise<void> {
  const nickname = raw.trim();
  if (!nickname) throw new Error('대화명을 입력해주세요.');
  if (nickname.length > 20) throw new Error('대화명은 20자 이하여야 합니다.');
  if (NICK_BAD.test(nickname)) throw new Error('대화명에 사용할 수 없는 문자가 포함되어 있습니다.');

  const reserved = await getReservedNicknames();
  if (reserved.includes(nickname)) {
    throw new Error(`'${nickname}'은 AI 토론자 이름이라 사용할 수 없습니다.`);
  }

  const lower = normalizeNickname(nickname);

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid);
    const newResRef = doc(db, 'nicknames', lower);

    const newResSnap = await tx.get(newResRef);
    if (newResSnap.exists() && newResSnap.data().uid !== uid) {
      throw new Error('이미 사용 중인 대화명입니다.');
    }

    const userSnap = await tx.get(userRef);
    const oldLower: string | undefined = userSnap.data()?.nickname_lower;

    if (oldLower && oldLower !== lower) {
      tx.delete(doc(db, 'nicknames', oldLower)); // 옛 예약 해제
    }
    tx.set(newResRef, { uid });
    tx.update(userRef, { nickname, nickname_lower: lower });
  });
}
```

`upsertUserProfile`도 보강: 신규 사용자에 `nickname_lower`도 함께 백필(기본 'KDS' → 'kds'). 단 'KDS'는 **예약 문서를 만들지 않는다**(다수가 공유하는 기본값이므로). 유일 강제는 4절 진입 가드에서 실제 설정 시점에 적용.

> **마이그레이션 스크립트** (`scripts/backfill-nicknames.ts`, 1회성): 기존 `users` 전체 순회 → `nickname_lower` 없으면 채움. 'KDS' 외 고유 닉네임은 `nicknames/{lower}` 예약 생성, 'KDS' 또는 충돌은 예약 생성하지 말고(진입 가드에서 재설정 유도) 로그만 남긴다.

## 4. 닉네임 설정 진입 가드

로그인 직후, 닉네임이 기본값('KDS')이거나 `nickname_lower`가 없거나 예약이 본인 것이 아니면 **대화명 설정 모달**을 띄워 설정을 강제(또는 강하게 유도)한다. 위치: `AppShell.tsx` 초기화 흐름 또는 인증 가드. 모달은 `updateNickname`을 호출하고 실패 메시지를 그대로 노출. 한글 IME 입력은 `nativeEvent.isComposing` 가드(기존 패턴).

## 5. `lib/membership.ts` — 검색 통합

```ts
/** 이메일 또는 대화명 prefix 통합 검색 (dedupe by uid, 최대 8건) */
export async function searchUsers(queryStr: string): Promise<UserProfile[]> {
  const q = queryStr.trim().toLowerCase();
  if (q.length < 2) return [];

  const byEmail = query(collection(db, 'users'),
    where('email', '>=', q), where('email', '<', q + '\uf8ff'),   // ← 상한 '\uf8ff' 필수
    orderBy('email'), limit(8));
  const byNick = query(collection(db, 'users'),
    where('nickname_lower', '>=', q), where('nickname_lower', '<', q + '\uf8ff'),
    orderBy('nickname_lower'), limit(8));

  const [es, ns] = await Promise.all([getDocs(byEmail), getDocs(byNick)]);
  const map = new Map<string, UserProfile>();
  for (const d of [...es.docs, ...ns.docs]) {
    if (map.has(d.id)) continue;
    const x = d.data();
    map.set(d.id, {
      uid: d.id, displayName: x.displayName || '', email: x.email || '',
      photoURL: x.photoURL || '',
      createdAt: (x.createdAt as Timestamp)?.toDate() || new Date(),
      nickname: typeof x.nickname === 'string' ? x.nickname : undefined,
    });
  }
  return [...map.values()].slice(0, 8);
}
```
기존 `searchUsersByEmailPrefix`/`lookupUserByEmail`은 보존(다른 호출처 영향 방지). (이메일 대소문자 한계는 §2-1 참조.)

## 6. 공유 보낸 문항 listing (Phase 49(B)에서 사용할 기반 함수)

```ts
/** 내가 멤버 공유한 문항 (보낸·개인). authorUid==me 중 멤버가 1명 이상 */
export async function listSharedByMe(uid: string): Promise<Problem[]> {
  const snap = await getDocs(query(collection(db, 'problems'),
    where('authorUid', '==', uid)));
  return snap.docs
    .map(toProblem) // created_at/updated_at Date 변환 (기존 패턴 재사용)
    .filter((p) => (p.memberUids?.length ?? 0) > 0)
    .sort((a, b) => (b.updated_at?.getTime() || 0) - (a.updated_at?.getTime() || 0));
}
```
(웹 공개 listing은 기존 `shares` `where(ownerUid==uid)` 경로 사용 — `lib/shares.ts` 확인 후 없으면 추가.)

## 7. 보안 규칙 변경 (`firestore.rules`)

### 7-1. `nicknames` 컬렉션 신설
```
match /nicknames/{nick} {
  allow read: if true;                                  // 중복확인·검색
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['uid']);
  allow delete: if request.auth != null
    && resource.data.uid == request.auth.uid;
  allow update: if false;                                // 교체 = delete+create
}
```
`users/{uid}` 규칙은 그대로(본인만 write). `nickname_lower`는 본인 update 범위 내라 추가 규칙 불필요.

### 7-2. (이관) AI 세션 생성 오너 제한 → Phase 46
`discussion_sessions` create를 오너 전용으로 좁히는 규칙(현재 `isOwnerSess() || isMemberSess()` → `isOwnerSess()`)은 **Phase 46(댓글/agent 분리)**에서 처리한다. agent(AI)가 오너 전용이라는 결정의 일부이므로 그쪽에 모은다. 이 문서(A)는 닉네임/검색 규칙만 다룬다.

## 8. 인덱스 (`firestore.indexes.json`)
`nickname_lower`·`email` 단일 필드 범위쿼리는 자동 단일 색인으로 충분(복합 인덱스 불필요). 변경 없음일 가능성이 높으나, 배포 후 콘솔 경고가 뜨면 안내된 색인 추가.

## 9. 리스크 & 주의사항
- **유일성 트랜잭션 실패 메시지**를 사용자 친화적으로(이미 사용 중/예약어/문자셋). 트랜잭션 재시도는 Firestore SDK 자동.
- **'KDS' 충돌**: 잔존 사용자 다수가 'KDS'일 수 있음 → 예약은 *재설정 시점*에만 생성하고, 진입 가드로 점진 해소. 일괄 강제 변경 금지.
- **이메일 검색 한계(재검토)**: 저장 이메일이 소문자가 아니면 누락. `email_lower` 도입은 선택(§2-1).
- **닉네임 문서 ID 안전성**: 문자셋 제한(3절 `NICK_BAD`)을 클라이언트·규칙 양쪽에서 가정. 규칙에서 문자셋 정규식 검증은 생략 가능하나, 최소한 길이/`hasOnly` 검증은 유지.

## 10. 수락 기준 (체크리스트)
- [ ] 새 사용자/‘KDS’ 사용자가 로그인하면 대화명 설정 모달이 뜬다
- [ ] 이미 쓰는 대화명으로 설정하면 "이미 사용 중" 거부
- [ ] 대화명 변경 시 옛 예약이 해제되고 새 예약이 생성된다(트랜잭션)
- [ ] `searchUsers('홍')`이 대화명 '홍길동' 사용자를, `searchUsers('kim')`이 이메일/닉네임 매칭 사용자를 함께 반환(중복 제거)
- [ ] `searchUsers`의 이메일 분기가 빈 결과가 아니다(`'\uf8ff'` 상한 적용 확인)
- [ ] 기존 멤버 공유/웹 공유/댓글 기능이 회귀 없이 동작(규칙 변경 영향 없음)
- [ ] `npm run build` 통과, 규칙 배포 후 권한 스모크 테스트 통과

## 11. 커밋 & 푸시
- 구현·커밋까지만 수행. `git push`는 덕수가 VSCode에서 직접.
- 제안 푸시: `git push origin main` (Vercel 자동 배포).
- 규칙 배포: `firebase deploy --only firestore:rules` 는 덕수가 직접 확인 후 실행.
