/**
 * AI 토론자 아바타 아이콘 — 공식 로고 SVG를 public/icons/ai/ 에서 로드.
 *
 * - google (Gemini): /icons/ai/gemini.svg
 * - openai (GPT):    /icons/ai/openai.svg
 * - anthropic (Claude): /icons/ai/claude.svg
 *
 * 알 수 없는 provider/모델은 fallback으로 avatarEmoji 표시.
 */

import React from 'react';

function svgPathFor(provider: string | undefined): string | null {
  if (provider === 'google') return '/icons/ai/gemini.svg';
  if (provider === 'openai') return '/icons/ai/openai.svg';
  if (provider === 'anthropic') return '/icons/ai/claude.svg';
  return null;
}

export function AIBrandIcon({
  provider,
  size = 18,
  fallbackEmoji,
}: {
  provider: string | undefined;
  size?: number;
  fallbackEmoji?: string;
}) {
  const src = svgPathFor(provider);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ display: 'inline-block', objectFit: 'contain', flexShrink: 0 }}
      />
    );
  }
  return (
    <span style={{ fontSize: Math.round(size * 0.85), lineHeight: 1 }}>
      {fallbackEmoji || '🤖'}
    </span>
  );
}
