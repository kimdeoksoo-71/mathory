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
import { IconSearchPlain, IconRobot } from '../ui/Icons';

/**
 * Phase 61b — API 모델명 → provider.
 *
 * 검증은 env로 고정한 모델을 쓰므로 Firestore `ai_models` 문서가 없다 → `AIModelConfig.provider`를
 * 못 읽는다. 모델명 문자열에서 직접 유추해 토론 참여자(민·쳇·클)와 **같은 아이콘**을 쓴다.
 */
export function providerFromModelName(name: string | undefined | null): string | undefined {
  const n = String(name ?? '').toLowerCase();
  if (!n) return undefined;
  if (n.includes('gemini') || n.includes('google')) return 'google';
  if (n.includes('claude') || n.includes('anthropic') || n.includes('opus')
      || n.includes('sonnet') || n.includes('haiku')) return 'anthropic';
  if (n.includes('gpt') || n.includes('openai') || n.startsWith('o1') || n.startsWith('o3')) return 'openai';
  return undefined;
}

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
  // Phase 61b: 검증은 특정 벤더가 아니라 **기능**이다 — 브랜드 로고 대신 돋보기(툴바 찾기와 동일 계열)
  if (provider === 'verify') return <IconSearchPlain size={size} />;

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
  // M5 D9 — 이모지를 명시 지정한 데이터만 글자로, 나머지는 robot 아이콘.
  // ai-models의 avatarEmoji 기본값이 ''가 된 것(D15)이 이 갈래가 실제로 사는 전제다.
  if (fallbackEmoji) {
    return (
      <span style={{ fontSize: Math.round(size * 0.85), lineHeight: 1 }}>
        {fallbackEmoji}
      </span>
    );
  }
  return <IconRobot size={size} />;
}
