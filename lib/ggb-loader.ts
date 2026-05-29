/**
 * deployggb.js lazy loader.
 * - 페이지 전체에서 한 번만 다운로드
 * - 실패 시 promise 캐시 해제하여 재시도 가능
 */

const DEPLOYGGB_URL = 'https://www.geogebra.org/apps/deployggb.js';

let loadPromise: Promise<void> | null = null;

export function isGgbLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).GGBApplet);
}

export function loadGGB(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('GGB cannot be loaded on the server'));
  }
  if (isGgbLoaded()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${DEPLOYGGB_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => { loadPromise = null; reject(new Error('GGB script error')); }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = DEPLOYGGB_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loadPromise = null; reject(new Error('GGB script failed to load')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}
