# Phase 48 — 공유 기능 확장개편 (A) : 프로필 · 검색 · 인가 기반

> **공유 개편 3부작(Phase 48 · 49 · 50) 중 1부.** 데이터/인가 기반만 다룬다. 좌측 공유 트리·리스트 보기·SharePanel 제거는 **Phase 49(B)**, 웹 공개 UI 재배치는 **Phase 50(C)**.
> 댓글/agent 분리(**Phase 47**)는 이 공유 개편과 독립적이며 먼저 진행한다. 권장 순서: **47 → 48 → 49 → 50**.
> **이 문서는 단독으로 빌드·배포 가능해야 한다.** A를 먼저 배포해 두면 B/C가 안정적인 기반 위에서 진행된다.
> 레포 최신 기준 직전 phase는 Phase 47(댓글·agent 분리). 이 문서가 **48**.

## 0. 선행 확인 (구현 전 반드시 읽을 것)

기억이 아니라 현재 파일을 직접 읽고 시작한다.

- `types/problem.ts` — `UserProfile`, `Problem.members/memberUids/memberTabVisibility`, `MemberRole`, `Share`, `DiscussionSession`
- `lib/users.ts` — `upsertUserProfile`(신규 시 `nickname='KDS'` 부여), `getUserProfile`, `updateNickname`(현재 유일성·`nickname_lower` 없음), `DEFAULT_NICKNAME='KDS'`, `NICKNAME_MAX_LENGTH=20`
- `lib/membership.ts` — `searchUsersByEmailPrefix`, `lookupUserByEmail`, 멤버 CRUD(`addMember`/`removeMember`/`updateMemberRole`/`leaveAsMember`/`setMemberTabVisibility`), `listSharedWithMe`, `getMemberRole`/`canComment`/`canEdit`
- `lib/ai-models.ts` — `getReservedNicknames`
- `app/settings/page.tsx` — **기존 닉네임 편집 UI**(이미 `updateNickname` 호출, `e.message` 노출). 새 진입 가드 모달은 이것과 **별개의 두 번째 진입점**이 된다
- `firestore.rules` — `users`(≈9, read는 `request.auth != null`), `problems`, `discussion_sessions`, `shares` 규칙
- `firestore.indexes.json`

> **⚠️ 확인된 버그(코드 대조 완료):** 현재 `searchUsersByEmailPrefix`(membership.ts:26)의 범위 상한이 `where('email', '<', trimmed + '')`(빈 문자열 연결)이다. 그래서 `>= trimmed AND < trimmed` → **항상 빈 결과**(상한 sentinel `'\uf8ff'`가 빠짐). 신규 `searchUsers`는 반드시 상한을 `q + '\uf8ff'`로 둘 것. (기존 함수도 고치면 좋으나 본 작업은 `searchUsers`로 대체하므로 필수는 아님.)

## 1. 목표

공유 대상자를 **대화명(닉네임)으로 검색·선택**할 수 있게 하고, 그 전제가 되는 닉네임 체계를 정비한다.

| 항목 | 결정 |
|---|---|
| 닉네임 설정 | 본인이 직접 설정. 기본값 'KDS' 잔존 사용자는 진입 시 **소프트 넛지**(닫기 가능) |
| 닉네임 유일성 | **전역 유일 강제** (중복 시 거부) |
| 닉네임 검색 | 정규화 필드 `nickname_lower` + prefix 범위 쿼리 |
| 사용자 검색 | 이메일 prefix **+ 닉네임 prefix** 통합 |
| 마이그레이션 | **별도 admin 스크립트 없음.** 진입 가드가 `nickname_lower`를 그 자리에서 백필(§3, §4) |

## 2. 데이터 모델 변경

### 2-1. `users/{uid}` 필드 추가
```
users/{uid}
  ├─ displayName, email, photoURL, createdAt   (기존)
  ├─ nickname: string                          (기존, 기본 'KDS')
  └─ nickname_lower: string                    (★신규, 검색·유일성 정규화 키)
```
`nickname_lower = normalize(nickname)` — `trim().toLowerCase()`. 한글은 대소문자 개념이 없어 사실상 trim 결과와 동일.

> **이메일 검색 대소문자 한계(결정: `email_lower` 미도입):** `upsertUserProfile`은 `email`을 원본 그대로 저장한다(소문자화 안 함). 구글 로그인 이메일은 소문자이고 `searchUsers`/`lookupUserByEmail`도 query를 `toLowerCase()`하므로 실사용엔 문제없다. **"저장 이메일은 소문자 가정"** 이라는 한계만 인지하고 `email_lower`는 도입하지 않는다(필요 시 후속 phase에서 추가). 이 가정을 `searchUsers` 주석에 남길 것.

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
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    throw new Error(`대화명은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`);
  }
  if (NICK_BAD.test(nickname)) throw new Error('대화명에 사용할 수 없는 문자가 포함되어 있습니다.');

  const reserved = await getReservedNicknames();
  if (reserved.includes(nickname)) {
    throw new Error(`'${nickname}'은 AI 토론자 이름이라 사용할 수 없습니다.`);
  }

  const lower = normalizeNickname(nickname);

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid);
    const newResRef = doc(db, 'nicknames', lower);

    // 트랜잭션: 모든 read를 write보다 먼저 수행
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

> **마이그레이션: 별도 admin 스크립트 없음(결정 C1-B).** 레포에 `firebase-admin` 의존성이 없고 서비스 계정 키 취급은 보안 부담이 크다(채팅창 비밀값 금지 원칙과도 충돌). 1인 + 소수 사용자 규모이므로 **진입 가드(§4)가 로그인 시 `nickname_lower` 부재를 그 자리에서 클라이언트로 백필**한다. 즉 기존 사용자도 다음 로그인 시 자연 마이그레이션된다. 예약 문서(`nicknames/{lower}`)는 사용자가 실제 닉네임을 설정/저장하는 시점에만 생성된다.

## 4. 닉네임 설정 진입 가드 (소프트 넛지)

로그인 직후, 닉네임이 기본값('KDS')이거나 `nickname_lower`가 없거나 예약이 본인 것이 아니면 **대화명 설정 모달**을 띄운다. 단 **닫기 가능(소프트 넛지)** — 'KDS'여도 앱은 정상 동작하므로 하드 블록은 과하다. "나중에"로 닫으면 그 세션은 다시 띄우지 않고, 기존 `app/settings/page.tsx`에서 언제든 재설정 가능하다.

- 위치: `AppShell.tsx` 초기화 흐름 또는 인증 가드.
- `nickname_lower`가 없으면(기존 사용자) 이 시점에 클라이언트에서 백필(§3 마이그레이션 대체).
- 모달은 `updateNickname`을 호출하고 실패 메시지를 그대로 노출(settings 페이지와 동일 경로).
- 한글 IME 입력은 `nativeEvent.isComposing` 가드(기존 패턴).

## 5. `lib/membership.ts` — 검색 통합

```ts
/**
 * 이메일 또는 대화명 prefix 통합 검색 (dedupe by uid, 최대 8건).
 * 전제: 저장 이메일은 소문자(구글 로그인 기준). §2-1 참조.
 */
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
  // 두 결과를 병합 후 slice. email 8건이 가득 차면 nick 매칭이 밀릴 수 있으나
  // 실사용 영향 미미(§9). 정밀 union이 필요해지면 라운드로빈 병합으로 교체.
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

> **주의(코드 대조):** 레포에 `toProblem` 헬퍼는 **존재하지 않는다.** `listSharedWithMe`와 동일하게 **인라인 매핑**으로 `created_at/updated_at`을 Date로 변환한다.

```ts
/** 내가 멤버 공유한 문항 (보낸·개인). authorUid==me 중 멤버가 1명 이상 */
export async function listSharedByMe(uid: string): Promise<Problem[]> {
  const snap = await getDocs(query(collection(db, 'problems'),
    where('authorUid', '==', uid)));
  const list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as Problem;
  });
  return list
    .filter((p) => (p.memberUids?.length ?? 0) > 0)
    .sort((a, b) => (b.updated_at?.getTime() || 0) - (a.updated_at?.getTime() || 0));
}
```
(웹 공개 listing은 기존 `lib/shares.ts`의 `shares` `where(ownerUid==uid)` 경로 사용 — `lib/shares.ts` 확인 후 없으면 추가.)

## 7. 보안 규칙 변경 (`firestore.rules`)

### 7-1. `nicknames` 컬렉션 신설
```
match /nicknames/{nick} {
  allow read: if request.auth != null;                  // 중복확인·검색 (users read와 일관)
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['uid']);
  allow delete: if request.auth != null
    && resource.data.uid == request.auth.uid;
  allow update: if false;                                // 교체 = delete+create
}
```
- `read`는 `if request.auth != null`로 둔다(기존 `users` read와 동일 정책 — 검색은 로그인 후에만 일어남).
- `users/{uid}` 규칙은 그대로(본인만 write). `nickname_lower`는 본인 update 범위 내라 추가 규칙 불필요.

> **닉네임 스쿼팅(결정 C4: 지금은 수용):** 위 create 규칙은 `nicknames/{nick}` 문서 ID와 본인의 실제 `nickname_lower` 일치를 강제하지 않으므로, 이론상 임의 이름 선점이 가능하다. **개인/소수 사용 단계에서는 수용**하고, 오픈소스 공개 전 후속 과제로 둔다(무인증 API 업그레이드와 같은 성격의 잔여 항목).

### 7-2. (이관) AI 세션 생성 오너 제한 → Phase 47
`discussion_sessions` create를 오너 전용으로 좁히는 규칙은 **Phase 47(댓글/agent 분리)**에서 처리한다. agent(AI)가 오너 전용이라는 결정의 일부이므로 그쪽에 모은다. 이 문서(A)는 닉네임/검색 규칙만 다룬다.

## 8. 인덱스 (`firestore.indexes.json`)
`nickname_lower`·`email` 단일 필드 범위쿼리는 자동 단일 색인으로 충분(복합 인덱스 불필요). 변경 없음일 가능성이 높으나, 배포 후 콘솔 경고가 뜨면 안내된 색인 추가.

## 9. 리스크 & 주의사항
- **유일성 트랜잭션 실패 메시지**를 사용자 친화적으로(이미 사용 중/예약어/문자셋). 트랜잭션 재시도는 Firestore SDK 자동.
- **'KDS' 충돌**: 잔존 사용자 다수가 'KDS'일 수 있음 → 예약은 *재설정 시점*에만 생성하고, 진입 가드로 점진 해소. 일괄 강제 변경 금지.
- **마이그레이션 자연 처리**: admin 스크립트 없이 진입 가드 백필에 의존하므로, 한 번도 재로그인하지 않은 기존 사용자는 검색에 닉네임으로 노출되지 않을 수 있다(이메일로는 노출됨). 허용 가능한 한계.
- **이메일 검색 한계**: 저장 이메일이 소문자가 아니면 누락(`email_lower` 미도입, §2-1).
- **검색 dedupe와 limit 상호작용**: email 8건이 가득 차면 nick 매칭이 slice(8)에서 밀릴 수 있음. 실사용 영향 미미, 허용.
- **닉네임 문서 ID 안전성**: 문자셋 제한(3절 `NICK_BAD`)을 클라이언트·규칙 양쪽에서 가정. 규칙에서 문자셋 정규식 검증은 생략 가능하나, 최소한 길이/`hasOnly` 검증은 유지.

## 10. 수락 기준 (체크리스트)
- [ ] 새 사용자/'KDS' 사용자가 로그인하면 대화명 설정 모달이 뜬다(**닫기 가능**)
- [ ] 기존 사용자가 로그인하면 `nickname_lower`가 자동 백필된다(진입 가드)
- [ ] 이미 쓰는 대화명으로 설정하면 "이미 사용 중" 거부
- [ ] 대화명 변경 시 옛 예약이 해제되고 새 예약이 생성된다(트랜잭션)
- [ ] `searchUsers('홍')`이 대화명 '홍길동' 사용자를, `searchUsers('kim')`이 이메일/닉네임 매칭 사용자를 함께 반환(중복 제거)
- [ ] `searchUsers`의 이메일 분기가 빈 결과가 아니다(상한 `'\uf8ff'` 적용 확인)
- [ ] 기존 설정 화면(`app/settings/page.tsx`)에서도 새 `updateNickname`이 회귀 없이 동작
- [ ] 기존 멤버 공유/웹 공유/댓글 기능이 회귀 없이 동작(규칙 변경 영향 없음)
- [ ] `npm run build` 통과, 규칙 배포 후 권한 스모크 테스트 통과

## 11. 커밋 & 푸시
- 구현·커밋까지만 수행. `git push`는 덕수가 VSCode에서 직접.
- 제안 푸시: `git push origin main` (Vercel 자동 배포).
- 규칙 배포: `firebase deploy --only firestore:rules` 는 덕수가 직접 확인 후 실행.
