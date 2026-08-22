/**
 * API 라우트 공용 인증 (Phase 61a에서 sheet-import가 세운 관례를 Phase 61b가 공용화)
 *
 * ⚠️ Firestore를 거치지 않는 라우트는 **여기서 직접** 인증해야 한다.
 *    `app/api/github/export`는 릴레이받은 ID 토큰을 Firestore REST에 그대로 써서
 *    보안 규칙이 인가를 대행하므로 검증 코드가 없다. 시트 프록시·검증 라우트는
 *    Firestore를 안 거쳐 그 대행이 불가능하다 → `identitytoolkit accounts:lookup`으로
 *    토큰을 검증하고 허용목록으로 좁힌다.
 */

/** 사용자에게 그대로 보여줄 수 있는 오류만 만든다 — 원본 에러 객체는 절대 흘리지 않는다
 *  (github/export의 ApiError 관례). */
export class ApiError extends Error {
  constructor(public status: number, public userMessage: string) { super(userMessage); }
}

/**
 * Firebase ID 토큰을 검증하고 uid를 돌려준다.
 *
 * @param authorization  `Authorization` 헤더 원문 (`Bearer <token>`)
 * @param apiKey         `NEXT_PUBLIC_FIREBASE_API_KEY`
 * @param allowedUids    허용 uid 목록. **비어 있으면 전원 거부**(fail-closed)
 */
export async function verifyUid(
  authorization: string | null,
  apiKey: string,
  allowedUids: string[],
): Promise<string> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new ApiError(401, '로그인이 필요합니다');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new ApiError(401, '로그인이 만료되었습니다 — 새로고침 후 다시 시도하세요');

  const uid = (await res.json())?.users?.[0]?.localId;
  if (typeof uid !== 'string' || !uid) throw new ApiError(401, '로그인 정보를 확인하지 못했습니다');

  // 허용목록이 비어 있으면 전원 거부(fail-closed). 열어 두는 쪽으로 실패하지 않는다.
  if (!allowedUids.includes(uid)) throw new ApiError(403, '이 기능을 사용할 권한이 없습니다');
  return uid;
}
