'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   M3 A5(D14) — 글자크기·가로폭 스테퍼 공용.

   ProblemView·EditorView에 **바이트 동일** 꺾쇠 SVG 사본이 4벌 있던 것을 한 벌로.
   ⚠ 단위 표기(em·px)는 화면에서 없앴다(덕수: 일반인이 쓰지 않는 단위) —
     의미는 숫자 왼쪽의 icon과 숫자 span의 title 툴팁이 나른다.
   ⚠ 사이트별 숫자 스타일 차이(13 vs 13.5 · minWidth)는 numberStyle prop이 흡수한다.
     EditorView의 borderLeft 구분선은 그쪽 래퍼 소유 — 여기 넣지 말 것.
   ═══════════════════════════════════════════════════════════════ */

const CHEVRON_BTN: React.CSSProperties = {
  border: 'none', background: 'transparent', padding: 0, width: 14, height: 11,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)',
};

function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={up ? 'M1 5 L5 1 L9 5' : 'M1 1 L5 5 L9 1'} />
    </svg>
  );
}

/** 글자 크기 아이콘 — 큰 A + 작은 A.
 *  M3 D4: stroke SVG가 아니라 **글자 그 자체**다(덕수 지정: "글꼴은 기본글꼴인
 *  Pretendard 사용") — SVG <text>는 폰트 로딩·baseline 관리만 늘린다. 색만 이웃과 통일. */
export function FontSizeGlyph() {
  /* 검수 반영(2026-09-05): 큰A 13→19.5(1.5배) · 작은A 9.5→11.5(1.2배) ·
     숫자와의 간격: 루트 gap 4를 marginRight로 상쇄 — 2차 2px → 3차 유효 1px. */
  return (
    <span aria-hidden style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 1,
      fontFamily: 'var(--font-ui)', fontWeight: 600, lineHeight: 1,
      color: 'var(--text-muted)', userSelect: 'none',
      marginRight: -3,
    }}>
      <span style={{ fontSize: 19.5 }}>A</span>
      <span style={{ fontSize: 11.5 }}>A</span>
    </span>
  );
}

export default function SizeStepper({
  value, min, max, onStep, titleUp, titleDown, title, icon, numberStyle, style,
}: {
  value: number;
  min: number;
  max: number;
  onStep: (delta: 1 | -1) => void;
  titleUp: string;
  titleDown: string;
  /** 숫자 span의 툴팁 — 단위 설명은 화면 대신 여기 남는다(예: "본문 가로폭(em)") */
  title?: string;
  icon?: React.ReactNode;
  numberStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}) {
  const atMax = value >= max;
  const atMin = value <= min;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...style }}>
      {icon}
      <span
        style={{
          fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 500,
          color: 'var(--text-secondary)', textAlign: 'right', userSelect: 'none',
          ...numberStyle,
        }}
        title={title}
      >{value}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button
          onClick={() => onStep(1)} disabled={atMax} title={titleUp}
          style={{ ...CHEVRON_BTN, cursor: atMax ? 'not-allowed' : 'pointer', opacity: atMax ? 0.3 : 1 }}
        ><Chevron up /></button>
        <button
          onClick={() => onStep(-1)} disabled={atMin} title={titleDown}
          style={{ ...CHEVRON_BTN, cursor: atMin ? 'not-allowed' : 'pointer', opacity: atMin ? 0.3 : 1 }}
        ><Chevron up={false} /></button>
      </div>
    </div>
  );
}
