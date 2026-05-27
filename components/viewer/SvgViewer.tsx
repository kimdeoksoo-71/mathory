'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { fetchAndSanitizeSvg } from '../../lib/svg-sanitizer';
import { SvgInitialView } from '../../types/problem';

interface SvgViewerProps {
  url: string;
  initialView?: SvgInitialView | null;
  height?: number;
  /** 편집모드에서만 "이 뷰를 초기 뷰로 저장" 버튼 노출 */
  onSaveInitialView?: (view: SvgInitialView) => void;
  /** 열람모드: 확장 아이콘 노출 여부 */
  enableFullscreen?: boolean;
  /** false면 줌/팬 불가, 저장된 초기 뷰만 표시 (미리보기·정적 출력용) */
  interactive?: boolean;
}

const INLINE_SVG_STYLE_ID = 'mathory-inline-svg-style';
function ensureInlineSvgStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(INLINE_SVG_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = INLINE_SVG_STYLE_ID;
  // react-zoom-pan-pinch의 내부 CSS 모듈이 wrapper/content를 `fit-content`로 강제하므로
  // 우리 컨테이너 안에서는 100% × 100%로 강제 오버라이드해야 inline SVG가 잘림 없이 fit됨.
  style.textContent = `
    .mathory-svg-host .react-transform-wrapper {
      width: 100% !important;
      height: 100% !important;
    }
    .mathory-svg-host .react-transform-component {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }
    .mathory-inline-svg {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mathory-inline-svg > svg {
      width: 100% !important;
      height: 100% !important;
      max-width: 100%;
      max-height: 100%;
      display: block;
    }
  `;
  document.head.appendChild(style);
}

const ZOOM_CONFIG = {
  initialScale: 1,
  minScale: 0.3,
  maxScale: 10,
  wheel: { step: 0.0075, smoothStep: 0.0004 },
  panning: { velocityDisabled: true },
  pinch: { disabled: false },
  doubleClick: { mode: 'zoomIn' as const, step: 0.7 },
  limitToBounds: false,
  centerOnInit: false, // 우리가 직접 초기 transform 적용
  velocityAnimation: { disabled: true },
};

export default function SvgViewer({
  url,
  initialView,
  height = 300,
  onSaveInitialView,
  enableFullscreen = false,
  interactive = true,
}: SvgViewerProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => { ensureInlineSvgStyles(); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAndSanitizeSvg(url)
      .then((m) => { if (!cancelled) setSvgMarkup(m); })
      .catch((e) => { if (!cancelled) setError(e.message || '로드 실패'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 12,
      }}>
        SVG 로드 중...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-danger, #c33)', fontSize: 12,
      }}>
        SVG 로드 실패: {error}
      </div>
    );
  }

  return (
    <>
      <InlineSvgPanel
        svgMarkup={svgMarkup}
        initialView={initialView}
        height={height}
        onSaveInitialView={onSaveInitialView ? (v) => {
          onSaveInitialView(v);
          setSavedToast(true);
          setTimeout(() => setSavedToast(false), 1600);
        } : undefined}
        onRequestFullscreen={enableFullscreen ? () => setFullscreen(true) : undefined}
        interactive={interactive}
        savedToast={savedToast}
      />
      {fullscreen && (
        <FullscreenOverlay
          svgMarkup={svgMarkup}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

function InlineSvgPanel({
  svgMarkup, initialView, height, onSaveInitialView, onRequestFullscreen,
  interactive, savedToast,
}: {
  svgMarkup: string;
  initialView?: SvgInitialView | null;
  height: number;
  onSaveInitialView?: (v: SvgInitialView) => void;
  onRequestFullscreen?: () => void;
  interactive: boolean;
  savedToast: boolean;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);
  const initializedRef = useRef(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  // interactive 모드에서 클릭으로 활성화/비활성화 토글
  const [active, setActive] = useState(false);
  // 비-interactive면 활성화 개념 자체가 의미 없음 (FolderView, EditorPreview 등)
  const effectiveActive = interactive && active;

  // 활성 상태에서 외부 클릭 시 비활성화
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

  const applyView = useCallback(() => {
    if (!transformRef.current) return;
    if (initialView) {
      transformRef.current.setTransform(
        initialView.positionX,
        initialView.positionY,
        initialView.scale,
        0
      );
    } else {
      transformRef.current.centerView(1, 0);
    }
  }, [initialView]);

  // 최초 1회 초기 transform
  const applyInitial = useCallback(() => {
    if (initializedRef.current) return;
    applyView();
    initializedRef.current = true;
  }, [applyView]);

  // 비-interactive 모드: initialView가 바뀌면 즉시 반영 (편집창과 미리보기 동기화)
  useEffect(() => {
    if (!interactive && initializedRef.current) {
      applyView();
    }
  }, [initialView, interactive, applyView]);

  // 클릭(드래그 아님) 감지 → 활성/비활성 토글
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return;
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!interactive) return;
    const down = downPosRef.current;
    downPosRef.current = null;
    if (!down) return;
    const dx = Math.abs(e.clientX - down.x);
    const dy = Math.abs(e.clientY - down.y);
    if (dx < 4 && dy < 4) setActive((v) => !v);
  };

  return (
    <div
      ref={hostRef}
      className="mathory-svg-host"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: '#fff',
        border: '1px solid var(--border-light, #e0e0e0)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: effectiveActive ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
        cursor: interactive ? (active ? 'grab' : 'pointer') : 'default',
        transition: 'box-shadow 0.15s',
      }}>
      <TransformWrapper
        {...ZOOM_CONFIG}
        wheel={{ ...ZOOM_CONFIG.wheel, disabled: !effectiveActive }}
        panning={{ ...ZOOM_CONFIG.panning, disabled: !effectiveActive }}
        pinch={{ ...ZOOM_CONFIG.pinch, disabled: !effectiveActive }}
        doubleClick={{ ...ZOOM_CONFIG.doubleClick, disabled: !effectiveActive }}
        onInit={(ref) => { transformRef.current = ref; applyInitial(); }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <div
            className="mathory-inline-svg"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </TransformComponent>
      </TransformWrapper>

      {onSaveInitialView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!transformRef.current) return;
            const s = transformRef.current.state;
            onSaveInitialView({
              scale: s.scale,
              positionX: s.positionX,
              positionY: s.positionY,
            });
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          title="현재 뷰를 초기 뷰로 저장"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
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

      {onRequestFullscreen && (
        <button
          onClick={(e) => { e.stopPropagation(); onRequestFullscreen(); }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          title="전체화면으로 보기"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--border-light, #ccc)',
            borderRadius: 4, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}
        >
          ⛶
        </button>
      )}

      {savedToast && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 3,
          padding: '4px 10px', fontSize: 11,
          background: 'rgba(0,0,0,0.7)', color: '#fff',
          borderRadius: 4, pointerEvents: 'none',
        }}>
          초기뷰 저장됨
        </div>
      )}
    </div>
  );
}

function FullscreenOverlay({
  svgMarkup, onClose,
}: {
  svgMarkup: string;
  onClose: () => void;
}) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // body scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="mathory-svg-host" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <TransformWrapper
        {...ZOOM_CONFIG}
        onInit={(ref) => {
          transformRef.current = ref;
          ref.centerView(1, 0);
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100vw', height: '100vh' }}
          contentStyle={{ width: '100vw', height: '100vh' }}
        >
          <div
            className="mathory-inline-svg"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </TransformComponent>
      </TransformWrapper>

      <button
        onClick={onClose}
        title="닫기 (ESC)"
        style={{
          position: 'fixed', top: 16, right: 16, zIndex: 10000,
          width: 40, height: 40,
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 6, cursor: 'pointer',
          fontSize: 18,
        }}
      >
        ✕
      </button>
    </div>
  );
}
