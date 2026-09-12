import type React from 'react';

/**
 * Phase 64 §7-4 — 워드마크 공용. 사양은 두 벌뿐이다(M8 D1·Q3에서 옛 MiniShell 사양 폐기):
 *   작은 19/400/`--wordmark-small`/그림자 — Sidebar · PhoneShell 상단 바 · MiniShell
 *   큰   48/400/`--mathory-red-dark`/그림자 — AppShell HomeView · 폰 로그인 화면
 * ⚠ 3번째 사양을 만들지 말 것. weight 600 갈래는 소비처 0이지만 prop은 남겨 둔다.
 * ⚠ shadow는 조건부 스프레드가 아니라 항상 명시한다('none') — 값이 사라질 때 구멍이
 *   남는 함정(CLAUDE.md shorthand/longhand 절)의 예방과 같은 방침.
 */
export default function Wordmark({ size, weight = 400, color, shadow = false, as = 'span', style }: {
  size: number;
  weight?: 400 | 600;
  color: string;
  shadow?: boolean;
  as?: 'span' | 'div' | 'h1';
  style?: React.CSSProperties;
}) {
  const Tag = as;
  return (
    <Tag
      style={{
        fontSize: size, fontWeight: weight, color,
        letterSpacing: '-0.03em', fontFamily: 'var(--font-logo)',
        textShadow: shadow ? '0 1px 0 rgba(0,0,0,0.06)' : 'none',
        ...style,
      }}
    >
      Mathory
    </Tag>
  );
}
