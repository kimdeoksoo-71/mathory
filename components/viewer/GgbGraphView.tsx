'use client';

/**
 * Phase 42: AI 토론 그래프 뷰어.
 * AI가 emit한 ```mathory-graph 펜스(JSON 명세)를 받아 GeoGebra applet에
 * evalCommand로 주입해 렌더한다. GgbViewer(파일 기반)와 달리 빈 applet에
 * 명령을 주입하는 방식. 활성화/전체화면/외부클릭 비활성화 패턴은 GgbViewer와 동일.
 *
 * onSaveAsBlock이 주어지면(편집 화면 경유) 💾 버튼으로 현재 그래프를
 * GGB/SVG/PNG 형식의 에디터 블록으로 내보낼 수 있다 (Step H).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GgbInitialCoords } from '../../types/problem';
import { loadGGB } from '../../lib/ggb-loader';
import { captureGgbView } from '../../lib/ggb-utils';

export type GraphBlockFormat = 'ggb' | 'svg' | 'png';

export interface GraphBlockSave {
  format: GraphBlockFormat;
  file: File;
  /** GGB 형식일 때 ggb_initial_coords로 이관할 현재 시야 (캡처 실패 시 null) */
  view: GgbInitialCoords | null;
}

interface GraphSpec {
  commands: string[];
  view: GgbInitialCoords;
}

interface GgbGraphViewProps {
  /** ```mathory-graph 펜스 내용 (JSON 문자열) */
  spec: string;
  /** true면 마운트 시 즉시 applet 로드 (최신 도착 응답의 첫 그래프 전용) */
  autoActivate?: boolean;
  /** 그래프 → 에디터 블록 저장. 반환값은 토스트에 표기할 탭 이름 (편집 화면에서만 전달) */
  onSaveAsBlock?: (save: GraphBlockSave) => Promise<string | void>;
}

const MAX_COMMANDS = 30;
const DEFAULT_VIEW: GgbInitialCoords = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const PREVIEW_HEIGHT = 240;
// GGB가 nav bar 자리를 graphics view에 안 돌려줘서 빈 공백이 남음 → 크게 만들고 잘라냄 (GgbViewer와 동일)
const EXTRA_BOTTOM = 50;

let graphContainerCounter = 0;
function nextContainerId(): string {
  graphContainerCounter += 1;
  return `mathory-ggb-graph-${Date.now().toString(36)}-${graphContainerCounter}`;
}

/** 명세 JSON 파싱 + 검증 — 실패 시 null (서버 sanitize를 통과했어도 클라이언트에서 재검증) */
function parseGraphSpec(raw: string): GraphSpec | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.commands)) return null;
    const commands = parsed.commands
      .filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0)
      .slice(0, MAX_COMMANDS);
    if (commands.length === 0) return null;
    const v = parsed.view;
    const view: GgbInitialCoords =
      v && ['xMin', 'xMax', 'yMin', 'yMax'].every((k) => typeof v[k] === 'number' && isFinite(v[k]))
        ? { xMin: v.xMin, xMax: v.xMax, yMin: v.yMin, yMax: v.yMax }
        : DEFAULT_VIEW;
    return { commands, view };
  } catch {
    return null;
  }
}

function base64ToFile(b64: string, name: string, type: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

export default function GgbGraphView({ spec, autoActivate = false, onSaveAsBlock }: GgbGraphViewProps) {
  const parsedSpec = useMemo(() => parseGraphSpec(spec), [spec]);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef<string>(nextContainerId());
  const appletRef = useRef<any>(null);
  const apiRef = useRef<any>(null);

  // autoActivate는 응답 도착 직후 prop이 늦게 true로 바뀔 수 있어(fresh id 전파 타이밍)
  // 초기값이 아닌 effect로 반영. false로 돌아가도 이미 활성화된 applet은 유지.
  useEffect(() => {
    if (autoActivate && parsedSpec) setActive(true);
  }, [autoActivate, parsedSpec]);

  // 외부 클릭 시 비활성화 (전체화면 중에는 무시)
  useEffect(() => {
    if (!active || isFullscreen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!hostRef.current) return;
      if (!hostRef.current.contains(e.target as Node)) {
        setActive(false);
        setSaveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [active, isFullscreen]);

  const cleanupApplet = useCallback(() => {
    const inst = appletRef.current;
    if (inst && typeof inst.remove === 'function') {
      try { inst.remove(); } catch { /* ignore */ }
    }
    appletRef.current = null;
    apiRef.current = null;
    const c = document.getElementById(containerIdRef.current);
    if (c) c.innerHTML = '';
  }, []);

  // 활성화 → GGB load + 빈 applet inject + 명령 주입
  useEffect(() => {
    if (!active || !parsedSpec) {
      cleanupApplet();
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setWarning('');
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
          height: Math.max(150, Math.floor(rect.height)) + EXTRA_BOTTOM,
          perspective: 'G',
          showToolBar: false,
          showAlgebraInput: false,
          showMenuBar: false,
          showResetIcon: true,
          enableLabelDrags: false,
          enableShiftDragZoom: true,
          enableRightClick: false,
          showZoomButtons: true,
          showFullscreenButton: false,
          showSuggestionButtons: false,
          showStartTooltip: false,
          allowStyleBar: false,
          showAnimationButton: false,
          showConstructionProtocol: false,
          showConstructionProtocolNavigation: false,
          enableUndoRedo: false,
          appletOnLoad: (api: any) => {
            if (cancelled) return;
            apiRef.current = api;
            try {
              if (typeof api.setNavBarVisible === 'function') api.setNavBarVisible(false);
            } catch {}
            const v = parsedSpec.view;
            try { api.setCoordSystem(v.xMin, v.xMax, v.yMin, v.yMax); } catch {}
            // 명령 순차 실행 — 개별 실패 수집 (LLM의 GGB 문법 오류는 흔함 → 부분 렌더 + 경고)
            const failed: string[] = [];
            for (const cmd of parsedSpec.commands) {
              let ok = false;
              try { ok = api.evalCommand(cmd); } catch { ok = false; }
              if (!ok) failed.push(cmd);
            }
            if (failed.length) {
              setWarning(`일부 명령 실패 (${failed.length}개)`);
              // eslint-disable-next-line no-console
              console.warn('[GgbGraphView] 실패 명령:', failed);
            }
            // 명령 실행이 시야를 옮겼을 수 있어 view 재적용
            try { api.setCoordSystem(v.xMin, v.xMax, v.yMin, v.yMax); } catch {}
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
  }, [active, parsedSpec, cleanupApplet]);

  // applet 리사이즈 (fullscreen 전환 + window resize) — GgbViewer와 동일 패턴
  useEffect(() => {
    if (!active) return;
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
  }, [isFullscreen, active]);

  // ESC: fullscreen 종료 → 활성 해제 순
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

  useEffect(() => {
    if (!active || isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, isFullscreen]);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveMenuOpen(false);
    setIsFullscreen((v) => !v);
  };

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    if (active) return;
    e.stopPropagation();
    setActive(true);
  };

  /* ─── 그래프 → 에디터 블록 저장 (Step H) ─── */
  const handleSave = async (format: GraphBlockFormat) => {
    const api = apiRef.current;
    if (!api || !onSaveAsBlock || saving) return;
    setSaveMenuOpen(false);
    setSaving(true);
    try {
      // 사용자가 줌·팬한 현재 시야 그대로 저장 (보고 있는 그대로가 직관적)
      const view = captureGgbView(api) ?? parsedSpec?.view ?? null;
      const ts = Date.now();
      let file: File;
      if (format === 'ggb') {
        const b64 = api.getBase64();
        if (typeof b64 !== 'string' || !b64) throw new Error('GGB 내보내기 실패');
        file = base64ToFile(b64, `ai-graph-${ts}.ggb`, 'application/vnd.geogebra.file');
      } else if (format === 'svg') {
        const svg = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('SVG 내보내기 시간 초과')), 10_000);
          try {
            api.exportSVG((s: string) => { clearTimeout(timer); resolve(s); });
          } catch (e) { clearTimeout(timer); reject(e); }
        });
        if (!svg || !svg.includes('<svg')) throw new Error('SVG 내보내기 실패');
        file = new File([new Blob([svg], { type: 'image/svg+xml' })], `ai-graph-${ts}.svg`, { type: 'image/svg+xml' });
      } else {
        const b64 = api.getPNGBase64(2, true, 72);
        if (typeof b64 !== 'string' || !b64) throw new Error('PNG 내보내기 실패');
        file = base64ToFile(b64, `ai-graph-${ts}.png`, 'image/png');
      }
      const tabLabel = await onSaveAsBlock({ format, file, view: format === 'ggb' ? view : null });
      showToast(true, tabLabel
        ? `"${tabLabel}" 탭에 블록 추가됨 (문제 저장 시 확정)`
        : '블록 추가됨 (문제 저장 시 확정)');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[GgbGraphView] 블록 저장 실패:', err);
      showToast(false, err?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  /* ─── 명세 파싱 실패 → 폴백 박스 (본문 렌더에는 영향 없음) ─── */
  if (!parsedSpec) {
    return (
      <div style={{
        margin: '8px 0', padding: '10px 12px',
        border: '1px dashed var(--border-light, #ddd)', borderRadius: 6,
        fontSize: 12, color: 'var(--text-muted, #888)', fontFamily: 'var(--font-ui)',
      }}>
        ⚠️ 그래프 명세 오류 — 표시할 수 없습니다.
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11 }}>원문 보기</summary>
          <pre style={{
            margin: '6px 0 0', padding: 8, fontSize: 11, overflowX: 'auto',
            background: 'var(--bg-hover, #f5f5f5)', borderRadius: 4,
          }}>{spec}</pre>
        </details>
      </div>
    );
  }

  const svgSupported = typeof apiRef.current?.exportSVG === 'function';

  return (
    <div
      ref={hostRef}
      style={isFullscreen ? {
        position: 'fixed', inset: 0, zIndex: 9998,
        width: '100vw', height: '100vh',
        background: '#fff',
        cursor: 'default',
      } : {
        position: 'relative',
        width: '100%',
        height: PREVIEW_HEIGHT,
        margin: '8px 0',
        background: '#fafafa',
        border: '1px solid var(--border-light, #e0e0e0)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: active ? '0 4px 14px rgba(0,0,0,0.08)' : 'none',
        cursor: active ? 'default' : 'pointer',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* GGB inject 컨테이너 */}
      <div
        id={containerIdRef.current}
        style={{ width: '100%', height: '100%', display: active ? 'block' : 'none' }}
      />

      {/* 비활성 placeholder — 클릭 시 활성화 */}
      {!active && (
        <div
          onClick={handlePlaceholderClick}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, color: 'var(--text-muted, #888)',
            fontSize: 13, fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 18 }}>▶</div>
          <div>그래프 보기</div>
        </div>
      )}

      {/* 로딩 */}
      {active && loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.85)',
          fontSize: 12, color: 'var(--text-muted, #888)',
          pointerEvents: 'none',
        }}>
          그래프 로드 중...
        </div>
      )}

      {/* 에러 */}
      {active && error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.95)',
          fontSize: 12, color: 'var(--accent-danger, #c33)',
        }}>
          {error}
        </div>
      )}

      {/* 일부 명령 실패 경고 배지 */}
      {active && !loading && !error && warning && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 9999,
          padding: '2px 8px', fontSize: 10,
          background: 'rgba(220,160,40,0.92)', color: '#fff',
          borderRadius: 4, pointerEvents: 'none',
        }}>
          {warning}
        </div>
      )}

      {/* 블록 저장 버튼 + 형식 드롭다운 (편집 화면에서만 = onSaveAsBlock 있을 때만) */}
      {onSaveAsBlock && active && !loading && !error && (
        <div
          style={{ position: 'absolute', top: 8, right: 46, zIndex: 9999 }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setSaveMenuOpen((v) => !v); }}
            disabled={saving}
            title="그래프를 에디터 블록으로 저장"
            style={{
              padding: '4px 10px', fontSize: 11,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid var(--border-light, #ccc)',
              borderRadius: 4, cursor: saving ? 'wait' : 'pointer',
              color: 'var(--text-secondary, #444)',
            }}
          >
            {saving ? '저장 중…' : '블록으로 저장'}
          </button>
          {saveMenuOpen && !saving && (
            <div style={{
              position: 'absolute', top: '110%', right: 0,
              minWidth: 170,
              background: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-light, #ccc)',
              borderRadius: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}>
              {([
                { format: 'ggb' as const, label: 'GGB 블록 (인터랙티브)', enabled: true },
                { format: 'svg' as const, label: 'SVG 블록 (벡터)', enabled: svgSupported },
                { format: 'png' as const, label: 'PNG 블록 (이미지)', enabled: true },
              ]).map((item) => (
                <button
                  key={item.format}
                  onClick={(e) => { e.stopPropagation(); if (item.enabled) handleSave(item.format); }}
                  disabled={!item.enabled}
                  title={item.enabled ? undefined : '이 환경에서 SVG 내보내기를 지원하지 않습니다'}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px', fontSize: 11,
                    background: 'transparent', border: 'none',
                    cursor: item.enabled ? 'pointer' : 'not-allowed',
                    color: item.enabled ? 'var(--text-secondary, #444)' : 'var(--text-faint, #bbb)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 전체화면 토글 */}
      {active && !loading && !error && (
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

      {toast && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '6px 14px', fontSize: 12,
          background: toast.ok ? 'rgba(40,140,60,0.92)' : 'rgba(180,40,40,0.92)',
          color: '#fff',
          borderRadius: 4, pointerEvents: 'none',
          maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
