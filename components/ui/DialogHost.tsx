'use client';

import { useEffect, useRef, useState } from 'react';
import {
  subscribeDialogs, resolveDialog,
  type DialogRequest, type DialogMessage,
} from '../../lib/dialogs';
import {
  dialogOverlay, dialogBody, dialogHead, dialogContent, dialogFoot,
  dialogInput, dialogBtn,
} from './dialogStyles';

/* 개선묶음 M2 A — `lib/dialogs.ts`가 요청하는 다이얼로그를 실제로 그리는 곳 (D3′·D4′).
   `app/layout.tsx`의 <body> 안에 한 번만 마운트한다(admin 라우트 포함 전 화면 커버).

   ⚠ 입력형은 NicknameSetupModal 원형 승계(D4′): autoFocus + 전체 선택 + Enter 확정 +
     `isComposing` IME 가드 + Escape 취소. 한글 조합 중 Enter가 확정으로 새면
     "가"만 치고 확정되는 사고가 난다 — 이 앱의 확립된 규약이다.
   ⚠ Escape·오버레이 클릭 = 취소. alert도 같다(네이티브 alert의 Escape와 같은 감각). */

function MessageBody({ message }: { message: DialogMessage }) {
  const lines = Array.isArray(message) ? message : [message];
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 0 : 6 }}>{line}</div>
      ))}
    </>
  );
}

export default function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ⚠ cancel은 Escape 효과보다 **위**에 둔다. 아래(early return 뒤)에 두면
     effect 클로저가 TDZ 밖이라 동작은 하지만, 읽는 사람이 순서를 의심하게 된다. */
  const cancel = () => {
    if (!req) return;
    resolveDialog(req.kind === 'confirm' ? false : req.kind === 'prompt' ? null : undefined);
  };

  useEffect(() => {
    subscribeDialogs((next) => {
      setReq(next);
      setError(null);
      setValue(next && next.kind === 'prompt' ? (next.defaultValue ?? '') : '');
    });
    return () => subscribeDialogs(null);
  }, []);

  // 열릴 때 입력 전체 선택 — 개명 프롬프트에서 곧바로 덮어쓸 수 있어야 한다.
  useEffect(() => {
    if (req?.kind === 'prompt') {
      const el = inputRef.current;
      if (el) { el.focus(); el.select(); }
    }
  }, [req]);

  // Escape는 document 레벨에서 받는다 — 포커스가 버튼/입력 어디에 있든 닫혀야 한다.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;

  const submitPrompt = () => {
    if (req.kind !== 'prompt') return;
    const v = value.trim();
    if (!v) return;                                   // 빈 값은 확정 불가(네이티브와 같다)
    const err = req.validate?.(v) ?? null;
    if (err) { setError(err); return; }
    resolveDialog(v);
  };

  return (
    <div style={dialogOverlay} onClick={cancel} role="presentation">
      <div
        style={{ ...dialogBody, width: 420 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 머리글은 항상 그린다 — head/body/foot 3단이 이 앱 모달의 공통 문법이다 */}
        <div style={dialogHead}>
          {req.title ?? (req.kind === 'confirm' ? '확인' : '알림')}
        </div>

        <div style={dialogContent}>
          {req.kind === 'prompt' ? (
            <>
              {req.message && (
                <div style={{ marginBottom: 10, color: 'var(--text-secondary)', fontSize: 12.5 }}>
                  <MessageBody message={req.message} />
                </div>
              )}
              <input
                ref={inputRef}
                type="text"
                value={value}
                maxLength={req.maxLength}
                placeholder={req.placeholder}
                onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
                onKeyDown={(e) => {
                  // 한글 IME 조합 중 Enter 무시 (NicknameSetupModal 규약)
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
                style={dialogInput}
              />
              {error && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: '#d33' }}>{error}</div>
              )}
            </>
          ) : (
            <MessageBody message={req.message} />
          )}
        </div>

        <div style={dialogFoot}>
          {req.kind !== 'alert' && (
            <button onClick={cancel} style={dialogBtn('ghost')}>
              {req.kind === 'confirm' ? (req.cancelLabel ?? '취소') : '취소'}
            </button>
          )}
          <button
            onClick={() => {
              if (req.kind === 'prompt') submitPrompt();
              else resolveDialog(req.kind === 'confirm' ? true : undefined);
            }}
            disabled={req.kind === 'prompt' && !value.trim()}
            style={dialogBtn(
              req.kind === 'confirm' && req.danger ? 'danger' : 'primary',
              req.kind === 'prompt' && !value.trim(),
            )}
          >
            {req.kind === 'confirm' ? (req.confirmLabel ?? '확인')
              : req.kind === 'prompt' ? (req.confirmLabel ?? '확인')
              : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
