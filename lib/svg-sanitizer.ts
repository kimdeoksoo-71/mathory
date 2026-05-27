import DOMPurify from 'dompurify';

const SVG_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: ['onload', 'onclick', 'onerror', 'onmouseover', 'onfocus'],
} as const;

export function sanitizeSvg(svgString: string): string {
  if (typeof window === 'undefined') return svgString;
  return DOMPurify.sanitize(svgString, SVG_CONFIG as any) as unknown as string;
}

export async function fetchAndSanitizeSvg(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SVG fetch failed: ${res.status}`);
  const text = await res.text();
  return normalizeSvgSize(sanitizeSvg(text));
}

/**
 * 루트 <svg>를 컨테이너에 잘림 없이 fit되도록 정규화.
 *
 * 핵심: viewBox가 없으면 잘림 발생. width/height 픽셀값에서 자동으로 생성한다.
 *   - viewBox가 있으면 → 그대로 유지하고 width/height만 100%로 교체
 *   - viewBox가 없고 width/height가 픽셀값 → viewBox="0 0 W H" 신규 생성
 *   - viewBox 없고 픽셀값도 없으면 → preserveAspectRatio만 보장 (불완전 SVG는 어쩔 수 없음)
 */
export function normalizeSvgSize(svgMarkup: string): string {
  return svgMarkup.replace(/<svg\b([^>]*)>/i, (_m, rawAttrs) => {
    let attrs: string = rawAttrs;
    const hasViewBox = /\bviewBox\s*=/i.test(attrs);

    // width/height 픽셀값 추출 (viewBox 생성용)
    const wMatch = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
    const hMatch = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i);
    const parseNum = (s?: string): number | null => {
      if (!s) return null;
      const m = s.match(/^\s*([0-9.]+)/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      return isFinite(n) && n > 0 ? n : null;
    };
    const wNum = parseNum(wMatch?.[1]);
    const hNum = parseNum(hMatch?.[1]);

    // width/height 속성 제거
    attrs = attrs
      .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, '')
      .replace(/\s(width|height)\s*=\s*'[^']*'/gi, '');

    // viewBox 신규 생성 (없을 때만)
    if (!hasViewBox && wNum && hNum) {
      attrs += ` viewBox="0 0 ${wNum} ${hNum}"`;
    }

    if (!/preserveAspectRatio\s*=/i.test(attrs)) {
      attrs += ' preserveAspectRatio="xMidYMid meet"';
    }

    // 100%/100% 강제
    return `<svg${attrs} width="100%" height="100%">`;
  });
}
