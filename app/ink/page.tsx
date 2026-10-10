import type { Metadata, Viewport } from 'next';
import InkPad from '../../components/ink/InkPad';

/**
 * Phase 69 — iPad 필기 보조 입력. 데스크톱 Mathory 편집 중 옆에 둔 iPad + Apple Pencil로 수식을 쓰고 '완료'하면
 * 데스크톱 편집창에 확인 카드가 뜬다. **AppShell 밖**(단일 세션 claim 없음 — components/ink/InkPad 머리 주석).
 * `?input=mouse`는 개발·하니스용 마우스 허용(노출하지 않는다).
 */
export const metadata: Metadata = {
  title: 'Mathory Ink',
  robots: { index: false, follow: false },
};

// 쓰기 면이다 — 페이지 확대는 막는다(iOS는 maximumScale을 무시하므로 실효 차단은 InkPad의 touch-action·gesture 차단)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function InkPage({ searchParams }: { searchParams?: { input?: string } }) {
  return <InkPad allowMouse={searchParams?.input === 'mouse'} />;
}
