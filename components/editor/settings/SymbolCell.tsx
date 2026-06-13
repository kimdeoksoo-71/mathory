'use client';

/**
 * SymbolCell — 기호 셀 공유 컴포넌트 (계획서 §4-2, §9-1)
 *
 * 팔레트·카탈로그·그룹편집 공용. KaTeX 하이브리드 렌더 + 등급 뱃지 + ✓(이미 추가) + ×(삭제).
 */

import { useState } from 'react';
import { symbolPreviewHtml } from '../../../lib/katex-render';
import type { MathSymbol, Tier } from '../../../types/toolbar-config';

// 등급 시각 구분 (§4-2): 색 + 좌상단 점 (색맹 대응)
const TIER_BG: Record<Tier, string> = { 1: '#fff', 2: '#eff6ff', 3: '#f4f4f5', 4: '#f4f4f5' };
const TIER_DOTS: Record<Tier, string> = { 1: '', 2: '', 3: '·', 4: '··' };

interface Props {
  sym: MathSymbol;
  onClick?: (s: MathSymbol) => void;
  /** 있으면 hover 시 × 삭제 버튼 노출 */
  onRemove?: (s: MathSymbol) => void;
  /** 우상단 ✓ (이미 그룹에 있음) */
  checked?: boolean;
  /** 등급 뱃지(배경/점) 표시 */
  showTier?: boolean;
  size?: number;
}

export default function SymbolCell({ sym, onClick, onRemove, checked, showTier, size = 40 }: Props) {
  const [hover, setHover] = useState(false);
  const html = symbolPreviewHtml(sym);
  const bg = showTier ? TIER_BG[sym.tier] : '#fff';

  return (
    <div
      style={{ position: 'relative', width: size, height: size }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        title={`${sym.name.ko} (${sym.latex}) ★${sym.tier}`}
        aria-label={`${sym.name.ko}, ${sym.name.en}, 등급 ${sym.tier}`}
        onClick={onClick ? () => onClick(sym) : undefined}
        style={{
          width: '100%', height: '100%',
          // safe center: 박스에 맞으면 가운데, 넘치면 시작(왼쪽) 정렬 → 큰 기호도 앞부분 보임
          display: 'flex', alignItems: 'center', justifyContent: 'safe center',
          padding: 2, border: '1px solid #eee', borderRadius: 6,
          background: hover && onClick ? '#f0f4ff' : bg,
          borderColor: hover && onClick ? '#c7d2fe' : '#eee',
          cursor: onClick ? 'pointer' : 'default', overflow: 'hidden',
          fontSize: 15, lineHeight: 1,
        }}
      >
        {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <span>{sym.symbol || '?'}</span>}
      </button>

      {/* 등급 점(3·4) */}
      {showTier && TIER_DOTS[sym.tier] && (
        <span style={{
          position: 'absolute', top: 1, left: 3, fontSize: 11, lineHeight: 1,
          color: '#9ca3af', pointerEvents: 'none', letterSpacing: -1,
        }}>{TIER_DOTS[sym.tier]}</span>
      )}

      {/* 이미 추가됨 ✓ */}
      {checked && !hover && (
        <span style={{
          position: 'absolute', top: -4, right: -4, width: 15, height: 15,
          borderRadius: '50%', background: '#22c55e', color: '#fff',
          fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>✓</span>
      )}

      {/* hover 시 × 삭제 */}
      {onRemove && hover && (
        <button
          type="button"
          aria-label="삭제"
          onClick={(e) => { e.stopPropagation(); onRemove(sym); }}
          style={{
            position: 'absolute', top: -6, right: -6, width: 16, height: 16,
            borderRadius: '50%', background: '#ef4444', color: '#fff', border: '1.5px solid #fff',
            fontSize: 11, lineHeight: 1, cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>
      )}
    </div>
  );
}
