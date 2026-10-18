'use client';
/**
 * M10 B — 브라우저 탭 아이콘: 정밀 검증(단건·일괄)이 도는 동안 'M'이 맥박치고, 다른 탭에 가 있는 사이 끝나면 오른쪽 아래에
 * 빨간 점이 붙는다(돌아오면 사라진다). 상태는 `lib/activityStore`(배선은 verifyFlow·batchVerify 두 곳), 도안은 `lib/faviconGlyph`.
 *
 * ⚠ SVG 파비콘의 SMIL·CSS 애니메이션은 Chrome이 재생하지 않는다 → canvas 프레임을 PNG data URL로 만들어 `link[rel=icon]`을 바꾼다.
 * ⚠ Next가 `app/icon.svg`로 주입한 링크는 `type="image/svg+xml"` — PNG로 바꿀 때 **type도 함께** 바꾸고 복원 때 둘 다 되돌린다.
 * ⚠ 백그라운드 탭의 **메인 스레드** 타이머는 Chrome이 1초 1회(숨긴 지 5분 뒤엔 1분 1회)로 묶는다 → 프레임 타이머는 **Worker**다
 *   (M10 M3 headless 실측: 숨김에서 메인 setInterval 1000ms · Worker 타이머와 메인의 메시지 수신 100ms). Worker를 못 만들면
 *   setInterval로 떨어진다(숨김이면 1초 간격 표본). "다른 탭에서 안 움직인다"는 보고는 Worker 폴백 여부부터. 완료 점은 정지 이미지.
 * ⚠ 이 컴포넌트 말고 파비콘 href를 만지지 말 것. link 요소는 캐시하지 않고 매번 다시 찾는다(Next가 head를 다시 그려도 산다).
 * Safari는 런타임 href 교체를 탭에 반영하지 않는다(검수 범위 밖 — 알고 두는 손실).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, acknowledge } from '../../lib/activityStore';
import {
  ICON_SIZE, ICON_RADIUS, BG, GLYPH, M_PATH, DONE_DOT, DOT_CX, DOT_CY, DOT_R, DOT_RING,
  FRAME_MS, pulseScale,
} from '../../lib/faviconGlyph';

/** 프레임 박자 — Worker 타이머(숨긴 탭에서도 제 속도). 만들지 못하면 메인 setInterval. 반환 = 정지 */
function startTicker(ms: number, onTick: () => void): () => void {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = onTick;
    return () => w.terminate();
  } catch {
    const t = setInterval(onTick, ms);
    return () => clearInterval(t);
  }
}

const findIconLink = () => document.querySelector<HTMLLinkElement>('link[rel~="icon"]');

let canvas: HTMLCanvasElement | null = null;
let glyph: Path2D | null = null;
function frame(scale: number, dot: boolean): string {
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = ICON_SIZE; canvas.height = ICON_SIZE; }
  if (!glyph) glyph = new Path2D(M_PATH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const S = ICON_SIZE, r = ICON_RADIUS, c = S / 2;
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(S - r, 0); ctx.quadraticCurveTo(S, 0, S, r);
  ctx.lineTo(S, S - r); ctx.quadraticCurveTo(S, S, S - r, S);
  ctx.lineTo(r, S); ctx.quadraticCurveTo(0, S, 0, S - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.translate(c, c); ctx.scale(scale, scale); ctx.translate(-c, -c);
  ctx.fillStyle = GLYPH;
  ctx.fill(glyph);
  ctx.restore();
  if (dot) {
    ctx.beginPath(); ctx.arc(DOT_CX, DOT_CY, DOT_R + DOT_RING, 0, Math.PI * 2); ctx.fillStyle = GLYPH; ctx.fill();
    ctx.beginPath(); ctx.arc(DOT_CX, DOT_CY, DOT_R, 0, Math.PI * 2); ctx.fillStyle = DONE_DOT; ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

export default function FaviconController() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  /** 원래 링크 값(첫 교체 때 기억 — 복원용) */
  const original = useRef<{ href: string; type: string | null } | null>(null);

  const apply = (href: string | null) => {
    const link = findIconLink();
    if (!link) return;
    if (href === null) {                                   // 복원
      if (!original.current) return;
      if (link.getAttribute('href') !== original.current.href) link.setAttribute('href', original.current.href);
      if (original.current.type === null) link.removeAttribute('type');
      else link.setAttribute('type', original.current.type);
      original.current = null;
      return;
    }
    if (!original.current) original.current = { href: link.getAttribute('href') || '', type: link.getAttribute('type') };
    if (link.getAttribute('type') !== 'image/png') link.setAttribute('type', 'image/png');
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  };

  // 돌아오면 완료 점을 끈다(보이는 탭 + 창 포커스)
  useEffect(() => {
    const check = () => { if (!document.hidden && document.hasFocus()) acknowledge(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  useEffect(() => {
    if (s.busy > 0) {
      const start = performance.now();
      const draw = () => apply(frame(Math.round(pulseScale(performance.now() - start) * 100) / 100, s.unseenDone));
      draw();
      return startTicker(FRAME_MS, draw);
    }
    apply(s.unseenDone ? frame(1, true) : null);
    return undefined;
  }, [s.busy > 0, s.unseenDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // 언마운트(로그아웃·폰 셸 전환) — 원래 아이콘으로
  useEffect(() => () => apply(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
