'use client';

import type React from 'react';
import useIsPhone from '../../hooks/useIsPhone';

/**
 * Phase 64 D7 — 공개 라우트의 셸 스위치. 서버 추정(initialPhone)으로 첫 렌더를 고르고
 * 클라 보정은 useIsPhone이 맡는다(함정 1 — hydration 불일치 0).
 * ⚠ 함정 6 — phone/desktop 둘 다 엘리먼트로 "생성"되지만 마운트는 한쪽만이다:
 *   useEffect 구독(watchProblem 등)은 마운트된 쪽만 시작하고, 분기 전환 시
 *   이전 쪽은 언마운트되어 cleanup이 돈다.
 */
export default function ResponsiveShell({ initialPhone, phone, desktop }: {
  initialPhone: boolean;
  phone: React.ReactNode;
  desktop: React.ReactNode;
}) {
  const isPhone = useIsPhone(initialPhone);
  return <>{isPhone ? phone : desktop}</>;
}
