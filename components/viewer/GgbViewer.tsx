'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GgbInitialCoords } from '../../types/problem';
import { loadGGB } from '../../lib/ggb-loader';

interface GgbViewerProps {
  url: string;
  initialCoords?: GgbInitialCoords | null;
  height?: number;
  interactive?: boolean;
  onSaveInitialView?: (coords: GgbInitialCoords) => void;
}

let containerCounter = 0;
function nextContainerId(): string {
  containerCounter += 1;
  return `mathory-ggb-${Date.now().toString(36)}-${containerCounter}`;
}

export default function GgbViewer({
  url,
  initialCoords,
  height = 350,
  interactive = true,
  onSaveInitialView,
}: GgbViewerProps) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef<string>(nextContainerId());
  const appletRef = useRef<any>(null);
  const apiRef = useRef<any>(null);
  // initialCoords를 ref로 추적 — 저장 클릭 시 prop이 바뀌어도 applet을 re-mount 하지 않음
  const initialCoordsRef = useRef(initialCoords);
  initialCoordsRef.current = initialCoords;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const effectiveActive = interactive && active;

  // 외부 클릭 시 비활성화
  useEffect(() => {
    if (!active) return;
    const onDocDown = (e: MouseEvent) => {
      if (!hostRef.current) return;
      if (!hostRef.current.contains(e.target as Node)) {
        setActive(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [active]);

  const cleanupApplet = useCallback(() => {
    const inst = appletRef.current;
    if (inst && typeof inst.remove === 'function') {
      try { inst.remove(); } catch { /* ignore */ }
    }
    appletRef.current = null;
    apiRef.current = null;
    // 컨테이너 DOM 비우기 (GGB가 남긴 iframe 등 제거)
    const c = document.getElementById(containerIdRef.current);
    if (c) c.innerHTML = '';
  }, []);

  // 활성화 → GGB load + applet inject
  useEffect(() => {
    if (!effectiveActive) {
      cleanupApplet();
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    loadGGB()
      .then(() => {
        if (cancelled) return;
        const GGBApplet = (window as any).GGBApplet;
        if (!GGBApplet) throw new Error('GGBApplet not available');
        const container = document.getElementById(containerIdRef.current);
        if (!container) throw new Error('container not found');

        const rect = container.getBoundingClientRect();
        const params: Record<string, any> = {
          appName: 'classic',
          width: Math.max(200, Math.floor(rect.width)),
          // 빈 nav bar 영역을 overflow로 잘라내기 위해 EXTRA만큼 더 크게
          height: Math.max(150, Math.floor(rect.height)) + EXTRA_BOTTOM,
          // 기하 영역만 표시 (파일에 저장된 perspective 무시)
          perspective: 'G',
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          showResetIcon: true,
          enableLabelDrags: false,
          enableShiftDragZoom: true,
          enableRightClick: false,
          showZoomButtons: true,
          // GGB 내장 fullscreen 버튼은 사용하지 않음 (위치 불안정) — 외부 버튼으로 대체
          showFullscreenButton: false,
          showSuggestionButtons: false,
          showStartTooltip: false,
          allowStyleBar: false,
          showAnimationButton: false,
          // 구성단계 내비게이션 바 (26/26 ▶ 2s 같은 것) 강제 숨김
          showConstructionProtocol: false,
          showConstructionProtocolNavigation: false,
          enableUndoRedo: false,
          filename: url,
          appletOnLoad: (api: any) => {
            apiRef.current = api;

            // 구성단계 내비게이션 바 강제 숨김 (.ggb 파일이 켜둔 경우 덮어쓰기)
            try {
              if (typeof api.setNavBarVisible === 'function') {
                api.setNavBarVisible(false);
              }
            } catch {}
            // DOM 폴백: 내비게이션/상태 바 element를 찾아 숨김 (구조 요소는 건드리지 않음)
            const hideAuxBars = () => {
              const container = document.getElementById(containerIdRef.current);
              if (!container) return;
              const selectors = [
                // 구성단계 내비게이션(외곽 + 변형) — 홈/줌 버튼은 다른 panel이라 영향 없음
                '.consProtNav',
                '[class*="consProtNav"]',
                '.GeoGebraConstructionProtocolNavigation',
                '[class*="constructionProtocolNavigation"]',
                '[class*="ConstructionProtocolNavigation"]',
                '.applet_navbar',
                // 상태바
                '.statusBar', '.statusbar',
                '.appletFooterPanel', '.applet_footer',
              ];
              let hiddenAny = false;
              const hide = (root: Document | HTMLElement) => {
                selectors.forEach((sel) => {
                  root.querySelectorAll(sel).forEach((el) => {
                    const html = el as HTMLElement;
                    if (html.style.display !== 'none') {
                      html.style.display = 'none';
                      hiddenAny = true;
                    }
                  });
                });
              };
              hide(container);
              container.querySelectorAll('iframe').forEach((iframeEl) => {
                try {
                  const doc = (iframeEl as HTMLIFrameElement).contentDocument;
                  if (doc) hide(doc);
                } catch { /* cross-origin: 무시 */ }
              });
              // 숨겨진 element가 있었다면 GGB에게 레이아웃 재계산 트리거
              if (hiddenAny) {
                const rect = container.getBoundingClientRect();
                try {
                  api.setSize?.(Math.floor(rect.width), Math.floor(rect.height));
                } catch {}
              }
            };
            hideAuxBars();
            setTimeout(hideAuxBars, 300);
            setTimeout(hideAuxBars, 1000);
            setTimeout(hideAuxBars, 2000);
            // .ggb 파일의 view 초기화가 늦게 끝날 수 있어 여러 번 적용 + 두 가지 방법 병용
            const apply = (tag: string) => {
              const ic = initialCoordsRef.current;
              if (!ic) return;
              try {
                if (typeof api.setCoordSystem === 'function') {
                  api.setCoordSystem(ic.xMin, ic.xMax, ic.yMin, ic.yMax);
                }
                if (typeof api.evalCommand === 'function') {
                  api.evalCommand(`ZoomIn(${ic.xMin}, ${ic.yMin}, ${ic.xMax}, ${ic.yMax})`);
                }
                // eslint-disable-next-line no-console
                console.log(`[GgbViewer] applied initial coords [${tag}]`, ic);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(`[GgbViewer] applyView failed [${tag}]:`, err);
              }
            };
            apply('t=0');
            setTimeout(() => apply('t=150'), 150);
            setTimeout(() => apply('t=500'), 500);
            setTimeout(() => apply('t=1500'), 1500);
            setLoading(false);
          },
        };
        const applet = new GGBApplet(params, true);
        appletRef.current = applet;
        applet.inject(containerIdRef.current);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'GGB 로드 실패');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      cleanupApplet();
    };
  }, [effectiveActive, url, cleanupApplet]);
  // ↑ initialCoords는 ref로 추적하므로 의존성에서 제외 (저장 클릭 시 applet 재로딩 방지)

  // applet 리사이즈 (fullscreen 전환 + window resize)
  // GGB가 nav bar 자리를 graphics view에 안 돌려줘서 빈 공백이 남음.
  // 우회: iframe 자체를 컨테이너보다 EXTRA만큼 크게 만들고 overflow:hidden으로 자름.
  const EXTRA_BOTTOM = 50;
  useEffect(() => {
    const resize = () => {
      const api = apiRef.current;
      const container = document.getElementById(containerIdRef.current);
      if (!api || !container) return;
      const w = isFullscreen
        ? window.innerWidth
        : Math.floor(container.getBoundingClientRect().width);
      const baseH = isFullscreen
        ? window.innerHeight
        : Math.floor(container.getBoundingClientRect().height);
      const h = baseH + EXTRA_BOTTOM;
      try { api.setSize?.(w, h); } catch {}
      container.querySelectorAll('iframe').forEach((el) => {
        const iframe = el as HTMLIFrameElement;
        iframe.style.width = `${w}px`;
        iframe.style.height = `${h}px`;
        iframe.setAttribute('width', String(w));
        iframe.setAttribute('height', String(h));
      });
      Array.from(container.children).forEach((child) => {
        const el = child as HTMLElement;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      });
    };
    requestAnimationFrame(resize);
    setTimeout(resize, 100);
    setTimeout(resize, 300);
    setTimeout(resize, 700);

    if (isFullscreen) {
      const onWinResize = () => resize();
      window.addEventListener('resize', onWinResize);
      return () => window.removeEventListener('resize', onWinResize);
    }
  }, [isFullscreen]);

  // ESC로 fullscreen 종료
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen((v) => !v);
  };

  // 활성화는 비활성 상태의 placeholder 클릭으로만. 활성 상태에선 GGB 내부 동작을 방해하지 않음.
  // 비활성화는 외부 클릭(document mousedown) 또는 ESC로만.
  const handlePlaceholderClick = (e: React.MouseEvent) => {
    if (!interactive || active) return;
    e.stopPropagation();
    setActive(true);
  };

  // 활성 상태에서 ESC로 비활성화
  useEffect(() => {
    if (!active || isFullscreen) return;  // fullscreen 중에는 ESC가 fullscreen 종료에 우선
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, isFullscreen]);

  const showToast = (ok: boolean, msg: string) => {
    setSavedToast({ ok, msg });
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleSaveInitialView = (e: React.MouseEvent) => {
    e.stopPropagation();
    const api = apiRef.current;
    if (!api || !onSaveInitialView) {
      // eslint-disable-next-line no-console
      console.warn('[GgbViewer] save 클릭됨, api 없음', { api: !!api, cb: !!onSaveInitialView });
      showToast(false, !api ? 'GGB API 준비 안됨' : '저장 콜백 없음');
      return;
    }
    try {
      const candidates = ['getXmin', 'getXmax', 'getYmin', 'getYmax',
        'getCoordSystem', 'getViewProperties', 'getValueString',
        'setCoordSystem', 'evalCommand'];
      const availableMethods = candidates.filter((m) => typeof (api as any)[m] === 'function');
      // eslint-disable-next-line no-console
      console.log('[GgbViewer] 사용 가능한 API:', availableMethods);

      let xMin = NaN, xMax = NaN, yMin = NaN, yMax = NaN;

      // 1) 개별 getter
      if (typeof api.getXmin === 'function') {
        try { xMin = api.getXmin(1); xMax = api.getXmax(1); yMin = api.getYmin(1); yMax = api.getYmax(1); }
        catch { xMin = api.getXmin(); xMax = api.getXmax(); yMin = api.getYmin(); yMax = api.getYmax(); }
      }

      // 2) getViewProperties(viewId) — 모던 GGB 클래식
      // 반환 예: {"invXscale":0.05,"invYscale":0.05,"xMin":-10,"yMin":-10,"width":600,"height":400}
      if (![xMin, xMax, yMin, yMax].every((n) => isFinite(n)) && typeof api.getViewProperties === 'function') {
        try {
          const raw = api.getViewProperties(1);
          // eslint-disable-next-line no-console
          console.log('[GgbViewer] getViewProperties(1) raw:', raw);
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
            // eslint-disable-next-line no-console
            console.log('[GgbViewer] 파싱 결과:', { xMin, xMax, yMin, yMax, invX, invY });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[GgbViewer] getViewProperties 파싱 실패:', e);
        }
      }

      // eslint-disable-next-line no-console
      console.log('[GgbViewer] 최종 캡처:', { xMin, xMax, yMin, yMax });
      if (![xMin, xMax, yMin, yMax].every((n) => typeof n === 'number' && isFinite(n))) {
        showToast(false, `좌표 캡처 실패 (${availableMethods.join(',') || 'API 없음'})`);
        return;
      }
      onSaveInitialView({ xMin, xMax, yMin, yMax });
      showToast(true, `초기뷰 저장됨 (${xMin.toFixed(1)},${xMax.toFixed(1)},${yMin.toFixed(1)},${yMax.toFixed(1)})`);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[GgbViewer] save error:', err);
      showToast(false, `에러: ${err?.message || err}`);
    }
  };

  return (
    <div
      ref={hostRef}
      style={isFullscreen ? {
        // 브라우저 viewport 전체 오버레이 (Mac OS 메뉴바는 그대로 표시됨)
        position: 'fixed', inset: 0, zIndex: 9998,
        width: '100vw', height: '100vh',
        background: '#fff',
        cursor: 'default',
      } : {
        position: 'relative',
        width: '100%',
        height,
        background: '#fafafa',
        border: '1px solid var(--border-light, #e0e0e0)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: effectiveActive ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
        cursor: interactive ? (active ? 'default' : 'pointer') : 'default',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* GGB inject 컨테이너 */}
      <div
        id={containerIdRef.current}
        style={{ width: '100%', height: '100%', display: effectiveActive ? 'block' : 'none' }}
      />

      {/* 비활성 상태 placeholder — 클릭 시 활성화 */}
      {!effectiveActive && (
        <div
          onClick={handlePlaceholderClick}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, color: 'var(--text-muted, #888)',
            fontSize: 13, fontFamily: 'var(--font-ui)',
            cursor: interactive ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontSize: 18 }}>▶</div>
          <div>{interactive ? 'GeoGebra 활성화 — 클릭' : 'GeoGebra 블록 (편집창에서 조작)'}</div>
        </div>
      )}

      {/* 로딩 인디케이터 */}
      {effectiveActive && loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.85)',
          fontSize: 12, color: 'var(--text-muted, #888)',
          pointerEvents: 'none',
        }}>
          GeoGebra 로드 중...
        </div>
      )}

      {/* 에러 */}
      {effectiveActive && error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.95)',
          fontSize: 12, color: 'var(--accent-danger, #c33)',
        }}>
          {error}
        </div>
      )}

      {/* 초기뷰 저장 버튼 (편집모드만, 활성 상태에서만) */}
      {onSaveInitialView && effectiveActive && !loading && !error && (
        <button
          onClick={handleSaveInitialView}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          title="현재 좌표 영역을 초기 뷰로 저장"
          style={{
            position: 'absolute', top: 8, right: 46, zIndex: 9999,
            padding: '4px 10px', fontSize: 11,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--border-light, #ccc)',
            borderRadius: 4, cursor: 'pointer',
            color: 'var(--text-secondary, #444)',
          }}
        >
          📌 초기뷰 저장
        </button>
      )}

      {/* 전체화면 토글 버튼 (항상 표시) */}
      {effectiveActive && !loading && !error && (
        <button
          onClick={toggleFullscreen}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          title={isFullscreen ? '전체화면 종료' : '전체화면으로 보기'}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 9999,
            width: 30, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--border-light, #ccc)',
            borderRadius: 4, cursor: 'pointer',
            color: 'var(--text-secondary, #444)',
            fontSize: 14, lineHeight: 1,
          }}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      )}

      {savedToast && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '6px 14px', fontSize: 12,
          background: savedToast.ok ? 'rgba(40,140,60,0.92)' : 'rgba(180,40,40,0.92)',
          color: '#fff',
          borderRadius: 4, pointerEvents: 'none',
          maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {savedToast.msg}
        </div>
      )}
    </div>
  );
}
