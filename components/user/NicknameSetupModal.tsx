'use client';

import { useState } from 'react';
import { updateNickname } from '../../lib/users';

interface NicknameSetupModalProps {
  uid: string;
  /** 현재 닉네임 (기본값 'KDS'면 빈 입력으로 시작) */
  currentNickname?: string;
  onClose: () => void;
  onSaved: (nickname: string) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

/**
 * Phase 48: 닉네임 설정 진입 가드 (소프트 넛지).
 * 기본값('KDS')이거나 정규화 키가 없는 사용자에게 1회 띄운다. "나중에"로 닫기 가능.
 */
export default function NicknameSetupModal({
  uid, currentNickname, onClose, onSaved,
}: NicknameSetupModalProps) {
  const initial = currentNickname && currentNickname !== 'KDS' ? currentNickname : '';
  const [nickname, setNickname] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const canSave = nickname.trim().length > 0 && status.kind !== 'saving';

  const handleSave = async () => {
    const value = nickname.trim();
    if (!value) return;
    setStatus({ kind: 'saving' });
    try {
      await updateNickname(uid, value);
      onSaved(value);
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.';
      setStatus({ kind: 'error', message });
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '90vw', background: 'var(--bg-primary, #fff)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.18)',
          padding: 24, fontFamily: 'var(--font-ui)',
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          대화명을 설정해주세요
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.55 }}>
          공유·토론에서 다른 사용자(AI 포함)가 당신을 부르는 이름입니다. 최대 20자, 전역에서 중복될 수 없습니다.
          <br />
          AI 토론자 이름(민, 섬, 식, 쳇, 락)은 사용할 수 없습니다.
        </p>

        <input
          type="text"
          autoFocus
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            if (status.kind === 'error') setStatus({ kind: 'idle' });
          }}
          maxLength={20}
          placeholder="대화명 입력"
          onKeyDown={(e) => {
            // 한글 IME 조합 중 Enter 무시
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && canSave) {
              handleSave();
            }
          }}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
            border: '1px solid var(--border-primary)', borderRadius: 8,
            background: 'var(--bg-primary, white)', color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
          }}
        />

        {status.kind === 'error' && (
          <p style={{ marginTop: 10, fontSize: 12.5, color: '#d33' }}>{status.message}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', fontSize: 13.5, fontWeight: 500,
              border: '1px solid var(--border-primary)', borderRadius: 8,
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            나중에
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '8px 18px', fontSize: 13.5, fontWeight: 600,
              border: 'none', borderRadius: 8,
              background: canSave ? 'var(--text-primary)' : 'var(--border-light, #ddd)',
              color: canSave ? 'var(--bg-primary, white)' : 'var(--text-muted, #999)',
              cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-ui)',
            }}
          >
            {status.kind === 'saving' ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
