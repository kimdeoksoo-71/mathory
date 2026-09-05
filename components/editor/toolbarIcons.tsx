/**
 * M4 — 툴바 아이콘 공용 규격 (Phosphor 전환 · Final_V4 §4-4).
 *
 * M3까지의 규격(viewBox 64 · stroke 3.5 · CORNER_BRACKETS)은 M4에서 폐기됐다 —
 * 브라켓은 브랜드 모티프로 로고·favicon·빈 화면에만 남는다(D19).
 * 현행: Phosphor regular · viewBox 256 · fill currentColor · ICON_SIZE 20
 * (20px에서 시각 획 20/256×16 = 1.25px — 옛 브라켓 1.2px과 같은 무게, D8).
 *
 * 이 파일이 셋째 파일인 이유(M3 D12 그대로): UnifiedToolbar → MathSymbolPalette 방향
 * import가 있어 SigmaIcon 규격을 UnifiedToolbar에 두면 역방향 순환이 된다.
 * ⚠ 별도 `.svg` 파일로 빼지 말 것 — `currentColor`가 끊긴다(Phase 58 P3 규약).
 */
import { PhIcon } from '../ui/Icons';
import { PH } from '../ui/phosphorPaths';

export const ICON_SIZE = 20;

/** 브라켓 없는 커스텀 도안(BlockMathIcon 등)이 쓰는 공통 svg props. */
export const SVG_PROPS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: '0 0 256 256',
  fill: 'currentColor',
  'aria-hidden': true,
} as const;

/** 수식 기호 팔레트 트리거 (D12) — M3 자체 Σ(획 5)를 Phosphor sigma로 교체.
 *  자체 Σ의 존재 이유였던 "브라켓 1.2px 기준 굵기"가 브라켓과 함께 사라졌다. */
export function SigmaIcon() {
  return <PhIcon d={PH.sigma} size={ICON_SIZE} />;
}
