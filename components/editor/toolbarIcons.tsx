/**
 * M3 D12 — 툴바 아이콘 공용 규격.
 *
 * `SVG_PROPS`·`CORNER_BRACKETS`는 UnifiedToolbar가 갖고 있었지만, 팔레트 트리거의
 * `SigmaIcon`(M3 A4)이 같은 규격을 써야 하는데 **UnifiedToolbar → MathSymbolPalette**
 * 방향으로 import가 이미 있어 역방향은 순환이다 → 규격을 셋째 파일로 내렸다.
 *
 * ⚠ 별도 `.svg` 파일로 빼지 말 것 — `currentColor`가 끊긴다(Phase 58 P3 규약).
 * ⚠ 시각 획 두께 = 3.5 × (렌더 px / 64). ICON_SIZE 22에서 ≈1.2px — 이 값이
 *   "2행 버튼들의 브라켓 두께"이고 팔레트 트리거의 외곽선 두께 기준이다(D3).
 */

export const ICON_SIZE = 22;

export const SVG_PROPS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: '0 0 64 64',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 3.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const CORNER_BRACKETS = (
  <>
    <path d="M8 20 L8 8 L20 8" />
    <path d="M44 8 L56 8 L56 20" />
    <path d="M56 44 L56 56 L44 56" />
    <path d="M20 56 L8 56 L8 44" />
  </>
);

/** 수식 기호 팔레트 트리거의 시그마 (M3 A4).
 *  KaTeX `\sum` 렌더(세리프·획 대비)를 버리고 이웃 아이콘과 같은 규격의 균일 획으로.
 *  ⚠ 렌더 박스는 이웃과 같은 22를 유지하고 **글리프만 80% 영역**에 그린다 —
 *    svg를 작게 렌더하면 획이 1.2px 아래로 가늘어져 "선 두께 통일"이 깨진다. */
export function SigmaIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M45 14 H19 L34 32 L19 50 H45" />
    </svg>
  );
}
