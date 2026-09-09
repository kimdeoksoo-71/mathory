import type React from 'react';

/**
 * Phase 64 §7-4 — 워드마크 공용. 인라인 3벌을 픽셀 무변경으로 재현한다:
 *   MiniShell 19/600/`--mathory-red`/무그림자 · Sidebar 19/400/`#944728`/그림자 ·
 *   AppShell HomeView 48/400/`--mathory-red-dark`/그림자.
 * ⚠ 4번째 사양을 만들지 말 것 — 폰(PhoneShell·로그인 화면)은 MiniShell·HomeView 사양을 쓴다.
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
