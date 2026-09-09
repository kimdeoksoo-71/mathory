'use client';

import { useEffect, useState } from 'react';
import { PHONE_MEDIA_QUERY } from '../lib/device';

/** Phase 64 D4 — "PC 화면으로 보기" 탈출구 키. 탭 수명(sessionStorage) — 새 탭이면 다시 자동 판별.
 *  쓰는 쪽(⋯ 시트)은 키를 세운 뒤 location.reload()로 전환한다. */
export const FORCE_DESKTOP_KEY = 'mathory.forceDesktop';

/**
 * Phase 64 D2 — 폰 셸 여부의 단일 판별자.
 * 함정 1(hydration): 초기 상태는 반드시 서버 추정값(initialPhone)이고 보정은 effect에서만 —
 * 서버·클라 첫 렌더가 갈리면 React가 트리 불일치를 낸다.
 * F-5: forceDesktop을 matchMedia보다 먼저 읽고, 참이면 구독 자체를 건너뛴다 —
 * 순서가 뒤집히면 "PC 화면으로 보기" 직후 change 이벤트가 폰으로 되돌린다.
 */
export default function useIsPhone(initialPhone: boolean): boolean {
  const [isPhone, setIsPhone] = useState(initialPhone);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FORCE_DESKTOP_KEY) === '1') {
        setIsPhone(false);
        return;
      }
    } catch { /* 프라이빗 모드 등 접근 불가 — 자동 판별로 진행 */ }
    const mql = window.matchMedia(PHONE_MEDIA_QUERY);
    const apply = () => setIsPhone(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  return isPhone;
}
