import { headers } from 'next/headers';
import AppShell from '../components/layout/AppShell';
import PhoneApp from '../components/phone/PhoneApp';
import ResponsiveShell from '../components/layout/ResponsiveShell';
import { guessPhoneFromHeaders } from '../lib/device';

/**
 * Phase 64 P1·D8 — 서버 컴포넌트: headers()로 폰 첫 렌더를 고른다(빌드 출력 ○→ƒ, 실질 무해).
 * ⚠ 폰 분기는 AppShell "안"이 아니라 여기(ResponsiveShell)다 — AppShell 최상단 조기 반환은
 *   isPhone이 바뀔 때 훅 수를 바꿔 Rules of Hooks를 깬다. 스위치로 가르면 전환이
 *   언마운트/마운트라 안전하고, AppShell은 한 줄도 안 바뀐다(P2의 목적 그대로).
 */
export default function HomePage() {
  const h = headers();
  const initialPhone = guessPhoneFromHeaders(h.get('user-agent'), h.get('sec-ch-ua-mobile'));
  return (
    <ResponsiveShell
      initialPhone={initialPhone}
      desktop={<AppShell />}
      phone={<PhoneApp />}
    />
  );
}
