'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';
import { getUserProfile, updateNickname } from '../../lib/users';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [initialNickname, setInitialNickname] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const profile = await getUserProfile(user.uid);
        const current = profile?.nickname || '';
        setNickname(current);
        setInitialNickname(current);
      } catch (e) {
        setStatus({ kind: 'error', message: '프로필을 불러오지 못했습니다.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, router]);

  const dirty = nickname.trim() !== initialNickname.trim();

  const handleSave = async () => {
    if (!user) return;
    setStatus({ kind: 'saving' });
    try {
      await updateNickname(user.uid, nickname);
      setInitialNickname(nickname.trim());
      setNickname(nickname.trim());
      setStatus({ kind: 'success' });
      // 잠시 후 idle로 복귀
      setTimeout(() => setStatus({ kind: 'idle' }), 2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.';
      setStatus({ kind: 'error', message });
    }
  };

  if (authLoading || loading) {
    return (
      <main style={{ padding: 24, fontFamily: 'var(--font-ui)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>불러오는 중…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '40px 24px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <button
        onClick={() => router.push('/')}
        style={{
          marginBottom: 16,
          padding: '6px 10px',
          fontSize: 13,
          background: 'transparent',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        ← 홈으로
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>개인 설정</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 28px' }}>
        {user?.email}
      </p>

      <section
        style={{
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>닉네임</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
          토론에서 다른 참여자(AI 포함)가 당신을 부르는 이름입니다. 최대 20자.
          <br />
          AI 토론자 이름(민, 섬, 식, 쳇, 락)은 사용할 수 없습니다.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              if (status.kind !== 'idle') setStatus({ kind: 'idle' });
            }}
            maxLength={30}
            placeholder="닉네임 입력"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              background: 'var(--bg-primary, white)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty && status.kind !== 'saving') {
                handleSave();
              }
            }}
          />
          <button
            onClick={handleSave}
            disabled={!dirty || status.kind === 'saving'}
            style={{
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              borderRadius: 6,
              background: dirty && status.kind !== 'saving' ? 'var(--text-primary)' : 'var(--border-light, #ddd)',
              color: dirty && status.kind !== 'saving' ? 'var(--bg-primary, white)' : 'var(--text-muted, #999)',
              cursor: dirty && status.kind !== 'saving' ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {status.kind === 'saving' ? '저장 중…' : '저장'}
          </button>
        </div>

        {status.kind === 'error' && (
          <p style={{ marginTop: 10, fontSize: 12.5, color: '#d33' }}>{status.message}</p>
        )}
        {status.kind === 'success' && (
          <p style={{ marginTop: 10, fontSize: 12.5, color: '#2a8' }}>저장되었습니다.</p>
        )}
      </section>

      <section
        style={{
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>정보 / 라이선스</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          이모지 이미지는{' '}
          <a
            href="https://github.com/jdecked/twemoji"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-primary)' }}
          >
            Twemoji
          </a>
          {' '}(jdecked/twemoji)를 사용하며,{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-primary)' }}
          >
            CC BY 4.0
          </a>
          {' '}라이선스로 배포됩니다.
        </p>
      </section>
    </main>
  );
}
