'use client';

/**
 * Phase 69 — iPad 필기 패드 `/ink`. **AppShell 밖**이다.
 *
 * ⚠ `claimSession`·`releaseSession`을 부르지 않는다 — 단일 활성 세션(lib/session)은 AppShell만 claim한다.
 *   이 페이지가 claim하면 데스크톱 편집창이 튕긴다(그래서 공개 라우트·폰 셸처럼 로그인만 한다).
 * ⚠ `useAuth`를 쓰지 않는다 — 그 훅은 구독마다 users/{uid} 프로필을 upsert한다. onAuthStateChanged 직접.
 * ⚠ 로그인은 팝업만 — authDomain(*.firebaseapp.com) + Vercel 호스팅은 Safari에서 리디렉트가 깨지는 구성이다.
 * 확정 디자인: 「Mathory Ink Pad」 v4 샘플(계획서 v4 §2 D4). 색은 앱 토큰.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import Wordmark from '../ui/Wordmark';
import { IconCheck, IconTrash, IconUndo, IconUserCircle } from '../ui/Icons';
import InkCanvas, { type InkCanvasHandle, type InkCanvasState } from './InkCanvas';
import { newInkJobId, sendInkJob, subscribePresence, subscribeReadyJobs } from '../../lib/inkJobs';
import {
  PRESENCE_RECHECK_MS, presenceMessage, presenceStatus, type PresenceDoc,
} from '../../lib/ink/presence';

/** Mathpix base64 이미지 상한 2MB — 넘으면 긴 변 1400으로 다시 내보낸다 */
const MAX_DATA_URL = 1_900_000;
/** 상단 바가 이보다 좁으면(Split View 등) 버튼 라벨·상태 문구를 숨긴다 — `@media` 금지 규약이라 ResizeObserver로 */
const COMPACT_BELOW = 640;

const TONE_COLOR = { ok: 'var(--accent-success, #5f6b3c)', warn: 'var(--mathory-red, #D97757)', off: 'var(--text-muted, #8E8577)' } as const;

export default function InkPad({ allowMouse }: { allowMouse: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // 페이지 전체 차단 세트(iOS Safari): 확대 제스처 · 길게 눌러 메뉴. 페이지 루트의 touch-action·선택 차단은 스타일로
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const types = ['gesturestart', 'gesturechange', 'gestureend'];
    for (const t of types) document.addEventListener(t, prevent, { passive: false } as AddEventListenerOptions);
    document.addEventListener('contextmenu', prevent);
    return () => {
      for (const t of types) document.removeEventListener(t, prevent);
      document.removeEventListener('contextmenu', prevent);
    };
  }, []);

  const login = async () => {
    setLoginError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setLoginError(e instanceof Error ? e.message : '로그인 실패'); }
  };

  return (
    <div
      className="ink-pad"
      style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-functional)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14,
        touchAction: 'none', overscrollBehavior: 'none',
        WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
      } as React.CSSProperties}
    >
      {user === undefined ? null : user === null ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Wordmark size={19} color="var(--wordmark-small, #944728)" shadow />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ink</span>
          </div>
          <button type="button" className="ink-btn primary" onClick={login}>Google로 로그인</button>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
            데스크톱 Mathory와 같은 계정으로 로그인하세요.
            {loginError && <><br /><span style={{ color: 'var(--accent-danger)' }}>{loginError}</span></>}
          </div>
        </div>
      ) : (
        <InkWorkspace user={user} allowMouse={allowMouse} />
      )}
    </div>
  );
}

function InkWorkspace({ user, allowMouse }: { user: User; allowMouse: boolean }) {
  const canvasRef = useRef<InkCanvasHandle>(null);
  const barRef = useRef<HTMLElement>(null);
  const [cs, setCs] = useState<InkCanvasState>({ strokeCount: 0, canUndo: false, zoom: 100, drawing: false });
  const [presence, setPresence] = useState<PresenceDoc | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(0);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => subscribePresence(user.uid, setPresence), [user.uid]);
  useEffect(() => subscribeReadyJobs(user.uid, (jobs) => setPending(jobs.length)), [user.uid]);
  // 스냅샷은 바뀔 때만 온다 → 만료는 스스로 다시 본다
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), PRESENCE_RECHECK_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const bar = barRef.current; if (!bar) return;
    const ro = new ResizeObserver(() => setCompact(bar.getBoundingClientRect().width < COMPACT_BELOW));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 1800);
  }, []);

  const send = async () => {
    const cv = canvasRef.current;
    if (!cv || sending || cs.strokeCount === 0) return;
    setSending(true);
    try {
      let exp = await cv.exportPng(2000);
      if (exp && exp.dataUrl.length > MAX_DATA_URL) exp = await cv.exportPng(1400);
      if (!exp) return;
      await sendInkJob({
        uid: user.uid, jobId: newInkJobId(user.uid),
        png: exp.blob, pngDataUrl: exp.dataUrl, strokesJson: cv.strokesJson(),
      });
      cv.resetAll();
      showToast('전송됨 ✓');
    } catch (e) {
      console.error('[ink] 전송 실패', e);
      showToast('전송 실패 — 다시 보내 주세요');
    } finally {
      setSending(false);
    }
  };

  const msg = presenceMessage(presenceStatus(presence, now));
  const statusText = pending > 0 ? `${msg.text} · 확인 대기 ${pending}건` : msg.text;
  const empty = cs.strokeCount === 0;

  return (
    <>
      <header
        ref={barRef}
        style={{
          flex: '0 0 auto', height: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
          background: 'var(--bg-content)', borderBottom: '0.5px solid var(--border-content)', position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
          <Wordmark size={19} color="var(--wordmark-small, #944728)" shadow />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ink</span>
        </div>
        <div
          title={statusText}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: TONE_COLOR[msg.tone], flex: '0 0 auto' }} />
          {!compact && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusText}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {cs.zoom > 100 && (
            <button type="button" className="ink-btn" title="원래 크기로" onClick={() => canvasRef.current?.resetView()}>
              {cs.zoom}%
            </button>
          )}
          <button type="button" className="ink-btn" title="되돌리기" disabled={!cs.canUndo} onClick={() => canvasRef.current?.undo()}>
            <IconUndo size={18} />{!compact && <span>되돌리기</span>}
          </button>
          <button type="button" className="ink-btn" title="모두 지우기" disabled={empty} onClick={() => canvasRef.current?.clear()}>
            <IconTrash size={18} />{!compact && <span>모두 지우기</span>}
          </button>
          <button type="button" className="ink-btn" title={user.email ?? '계정'} aria-expanded={accountOpen} onClick={() => setAccountOpen((v) => !v)}>
            <IconUserCircle size={18} />
          </button>
          <button type="button" className="ink-btn primary" disabled={empty || sending} onClick={send}>
            <IconCheck size={18} /><span>{sending ? '보내는 중…' : '완료'}</span>
          </button>
        </div>
        {accountOpen && (
          <div
            style={{
              position: 'absolute', top: 52, right: 8, zIndex: 20, minWidth: 220,
              background: 'var(--bg-card, #fff)', border: '1px solid var(--border-content)', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{user.email ?? user.displayName ?? user.uid}</div>
            <button type="button" className="ink-btn" style={{ alignSelf: 'flex-end' }} onClick={() => { setAccountOpen(false); signOut(auth).catch(() => {}); }}>
              로그아웃
            </button>
          </div>
        )}
      </header>

      <main style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
        <InkCanvas ref={canvasRef} allowMouse={allowMouse} onState={setCs} />
        {empty && !cs.drawing && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -24, textAlign: 'center', pointerEvents: 'none',
              color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7,
            }}
          >
            {allowMouse ? '마우스·Apple Pencil로 쓰세요 (개발용 마우스 허용)' : 'Apple Pencil로 쓰세요'}
            <br /><b style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>두 손가락으로 확대·이동 · 손바닥은 무시됩니다</b>
          </div>
        )}
        {toast && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 20, margin: '0 auto', width: 'fit-content',
              background: 'var(--text-primary)', color: '#fff', fontSize: 13, padding: '8px 14px', borderRadius: 8, pointerEvents: 'none',
            }}
          >
            {toast}
          </div>
        )}
      </main>
    </>
  );
}
