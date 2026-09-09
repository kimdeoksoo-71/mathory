import { headers } from 'next/headers';
import { guessPhoneFromHeaders } from '../../lib/device';
import BazaarLanding from '../../components/share/BazaarLanding';

/**
 * Phase 64 F-1 — 서버 컴포넌트: headers()로 폰 첫 렌더를 고른다(D2 ①).
 * 클라이언트 본문(리다이렉트·필터·셸)은 components/share/BazaarLanding.tsx.
 * ⚠ headers()를 읽는 순간 이 라우트는 동적(ƒ)이다 — 실질 무해(본문이 원래 클라이언트).
 */
export default function BazaarPage() {
  const h = headers();
  const initialPhone = guessPhoneFromHeaders(h.get('user-agent'), h.get('sec-ch-ua-mobile'));
  return <BazaarLanding initialPhone={initialPhone} />;
}
