'use client';

import { useState } from 'react';
import { Problem, ProblemWithBlocks, BlockchainRecord, DEFAULT_TABS } from '../../types/problem';
import { computeContentHash, formatRegisteredAt } from '../../lib/copyright';
import { getProblemWithBlocks, updateProblem } from '../../lib/firestore';

interface Props {
  /** 표시에 필요한 최소 정보. ProblemWithBlocks 면 등록 시 추가 fetch 생략. */
  problem: Problem | ProblemWithBlocks;
  isOwner: boolean;
  /** authorUid 가 없는 기존 문제를 등록할 때 채워 넣을 사용자 UID */
  currentUserUid?: string;
  onUpdated?: () => void;
}

function hasBlocks(p: Problem | ProblemWithBlocks): p is ProblemWithBlocks {
  return (p as ProblemWithBlocks).tabBlocks !== undefined;
}

export default function CopyrightPanel({ problem, isOwner, currentUserUid, onUpdated }: Props) {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = problem.blockchain?.latest;
  const currentHash = problem.copyright?.contentHash;
  const isModified = !!latest && !!currentHash && latest.contentHash !== currentHash;

  const handleRegister = async () => {
    const authorUid = problem.authorUid || currentUserUid;
    if (!authorUid) {
      setError('로그인 정보를 확인할 수 없습니다.');
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      // 블록이 없으면 fetch
      let withBlocks: ProblemWithBlocks;
      if (hasBlocks(problem)) {
        withBlocks = problem;
      } else {
        const fetched = await getProblemWithBlocks(problem.id);
        if (!fetched) throw new Error('문제 데이터를 불러올 수 없습니다.');
        withBlocks = fetched;
      }

      const hash = await computeContentHash({
        authorUid,
        createdAt: withBlocks.created_at.toISOString(),
        tabs: withBlocks.tabs || DEFAULT_TABS,
        tabBlocks: withBlocks.tabBlocks,
      });

      if (latest && latest.contentHash === hash) {
        setError('이미 현재 내용 그대로 등록되어 있습니다.');
        setRegistering(false);
        return;
      }

      const res = await fetch('/api/copyright/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentHash: hash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '등록 실패');

      const record: BlockchainRecord = {
        txHash: data.txHash,
        contentHash: data.contentHash,
        registeredAt: data.registeredAt,
        network: data.network,
        explorerUrl: data.explorerUrl,
      };
      const newHistory = [...(problem.blockchain?.history || []), record];

      const updatePayload: Record<string, any> = {
        copyright: { contentHash: hash },
        blockchain: { history: newHistory, latest: record },
      };
      if (!problem.authorUid && currentUserUid) {
        updatePayload.authorUid = currentUserUid;
      }
      await updateProblem(problem.id, updatePayload as any);

      onUpdated?.();
    } catch (e: any) {
      setError(e?.message || '등록 중 오류 발생');
    } finally {
      setRegistering(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: 0.3,
    marginBottom: 8,
    fontFamily: 'var(--font-ui)',
  };
  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
    background: 'var(--bg-card, #fff)',
    cursor: registering ? 'not-allowed' : 'pointer',
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'background 0.15s',
    opacity: registering ? 0.7 : 1,
  };

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
      <div style={labelStyle}>저작권</div>

      {latest ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              marginBottom: 4,
              color: isModified ? 'var(--accent-danger, #e53935)' : 'var(--text-primary)',
            }}
          >
            <span>🔒</span>
            <span>{isModified ? '블록체인 등록됨 (수정됨)' : '블록체인 등록됨'}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {formatRegisteredAt(latest.registeredAt)}
          </div>
          <a
            href={latest.explorerUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 11,
              color: 'var(--accent-primary)',
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 8,
            }}
          >
            Polygonscan에서 확인 →
          </a>
          {isOwner && isModified && (
            <button onClick={handleRegister} disabled={registering} style={btnStyle}>
              {registering ? '⏳ 기록 중...' : '🔗 변경사항 재등록'}
            </button>
          )}
        </>
      ) : isOwner ? (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            아직 블록체인에 등록되지 않은 문제입니다.
          </div>
          <button onClick={handleRegister} disabled={registering} style={btnStyle}>
            {registering ? '⏳ 블록체인 기록 중...' : '🔗 블록체인 등록하기'}
          </button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>미등록</div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: 'var(--accent-danger, #e53935)', marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
