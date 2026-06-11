/**
 * Phase 42: GeoGebra Apps API 공용 유틸.
 * GgbViewer(블록 뷰어)와 GgbGraphView(AI 토론 그래프)가 공유한다.
 */

import type { GgbInitialCoords } from '../types/problem';

/**
 * 현재 applet의 좌표 시야(xMin~yMax)를 읽는다.
 * GGB 버전에 따라 API가 달라 두 가지 방법을 폴백으로 시도:
 *   1) getXmin/getXmax/getYmin/getYmax 개별 getter
 *   2) getViewProperties(1) — 모던 GGB 클래식 (xMin + width×invXscale로 계산)
 * 캡처 실패 시 null.
 */
export function captureGgbView(api: any): GgbInitialCoords | null {
  try {
    let xMin = NaN, xMax = NaN, yMin = NaN, yMax = NaN;

    // 1) 개별 getter
    if (typeof api.getXmin === 'function') {
      try { xMin = api.getXmin(1); xMax = api.getXmax(1); yMin = api.getYmin(1); yMax = api.getYmax(1); }
      catch { xMin = api.getXmin(); xMax = api.getXmax(); yMin = api.getYmin(); yMax = api.getYmax(); }
    }

    // 2) getViewProperties(viewId)
    // 반환 예: {"invXscale":0.05,"invYscale":0.05,"xMin":-10,"yMin":-10,"width":600,"height":400}
    if (![xMin, xMax, yMin, yMax].every((n) => isFinite(n)) && typeof api.getViewProperties === 'function') {
      try {
        const raw = api.getViewProperties(1);
        const props = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (props) {
          // invXscale = 픽셀당 x단위 (1px == invXscale 단위)
          const invX: number | null =
            typeof props.invXscale === 'number' ? props.invXscale
            : (typeof props.xscale === 'number' ? 1 / props.xscale
              : (typeof props.scale === 'number' ? 1 / props.scale : null));
          const invY: number | null =
            typeof props.invYscale === 'number' ? props.invYscale
            : (typeof props.yscale === 'number' ? 1 / props.yscale : null);

          if (typeof props.xMin === 'number') xMin = props.xMin;
          if (typeof props.yMin === 'number') yMin = props.yMin;
          if (typeof props.xMax === 'number') xMax = props.xMax;
          if (typeof props.yMax === 'number') yMax = props.yMax;

          if (!isFinite(xMax) && typeof props.xMin === 'number'
              && typeof props.width === 'number' && invX != null) {
            xMax = props.xMin + props.width * invX;
          }
          if (!isFinite(yMax) && typeof props.yMin === 'number'
              && typeof props.height === 'number' && invY != null) {
            yMax = props.yMin + props.height * invY;
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ggb-utils] getViewProperties 파싱 실패:', e);
      }
    }

    if (![xMin, xMax, yMin, yMax].every((n) => typeof n === 'number' && isFinite(n))) {
      return null;
    }
    return { xMin, xMax, yMin, yMax };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ggb-utils] captureGgbView 실패:', err);
    return null;
  }
}
