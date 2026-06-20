import type { CSSProperties } from 'react';
import type { Block } from '../types/problem';

/**
 * 이미지 블록 배경 treatment → inline style 조각.
 * 기본(blend): 흰 배경을 뒤의 클레이로 녹이고(multiply) 단색화(grayscale).
 * frame: 액자 처리(패딩+테두리+그림자). multiply 해제.
 * 미설정 필드 = 기본값이므로 레거시 블록도 자동으로 기본 treatment 적용.
 *
 * 각 이미지 렌더 지점의 `<img style>`에 `...imageTreatmentStyle(block)`으로 병합한다.
 * width 등 기존 스타일 뒤에 spread해 mixBlendMode/filter만 추가한다.
 */
export function imageTreatmentStyle(
  b: Pick<Block, 'imageTreatment' | 'imageGray'>,
  opts?: { print?: boolean }
): CSSProperties {
  const gray = b.imageGray !== false; // 미설정/true → 흑백
  const filter = gray ? 'grayscale(1)' : 'none';

  if (b.imageTreatment === 'frame') {
    // 인쇄: 잉크 절약 위해 그림자/배경 생략, 얇은 테두리만
    if (opts?.print) {
      return { mixBlendMode: 'normal', filter, padding: 8, border: '1px solid var(--border-subtle)' };
    }
    return {
      mixBlendMode: 'normal',
      filter,
      background: '#faf9f5',
      padding: 12,
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    };
  }

  return { mixBlendMode: 'multiply', filter };
}
