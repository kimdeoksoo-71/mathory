'use client';

import { useState } from 'react';
import { Problem, ProblemWithBlocks, BlockchainRecord, DEFAULT_TABS } from '../../types/problem';
import { computeContentHash, formatRegisteredAt } from '../../lib/copyright';
import { getProblemWithBlocks, updateProblem } from '../../lib/firestore';
import { IconBlockchain } from '../ui/Icons';

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

  // Polygon 레코드만 유효 — 과거 OpenTimestamps 레코드(txHash 없음)는 무시하여 재등록 유도
  const rawLatest = problem.blockchain?.latest;
  const latest = rawLatest && (rawLatest as any).txHash ? rawLatest : null;
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
        network: 'polygon',
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

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-light)',
    background: 'var(--bg-card, #fff)',
    cursor: registering ? 'not-allowed' : 'pointer',
    fontSize: 11,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'background 0.15s',
    opacity: registering ? 0.7 : 1,
  };

  // 정밀한 일시: yyyy-mm-dd : hh-mm-ss
  const formatFullDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} : ${hh}-${mi}-${ss}`;
    } catch { return iso; }
  };

  // 2·3행 들여쓰기를 1행 아이콘+간격(13+6=19)과 일치시켜 텍스트 시작 x 정렬
  const INDENT = 19;

  return (
    <div>
      {latest ? (
        <>
          {/* 1행: 아이콘 + 텍스트(Polygonscan 링크) */}
          <a
            href={latest.explorerUrl}
            target="_blank"
            rel="noreferrer"
            title="Polygonscan에서 확인"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11,
              color: isModified ? 'var(--accent-danger, #e53935)' : 'var(--text-primary)',
              marginBottom: 4,
              textDecoration: 'none',
              transition: 'color 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary, #B8845C)';
              const span = (e.currentTarget as HTMLElement).querySelector('span');
              if (span) (span as HTMLElement).style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = isModified
                ? 'var(--accent-danger, #e53935)'
                : 'var(--text-primary)';
              const span = (e.currentTarget as HTMLElement).querySelector('span');
              if (span) (span as HTMLElement).style.textDecoration = 'none';
            }}
          >
            <IconBlockchain size={13} />
            <span style={{ fontWeight: 500 }}>
              {isModified ? '블록체인 원본인증완료 (수정됨)' : '블록체인 원본인증완료'}
            </span>
          </a>
          {/* 2행: 들여쓰기 + 정밀 일시 */}
          <div style={{
            marginLeft: INDENT, fontSize: 11,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            {formatFullDateTime(latest.registeredAt)}
          </div>
          {isOwner && isModified && (
            <button onClick={handleRegister} disabled={registering} style={{ ...btnStyle, marginTop: 10 }}>
              {registering ? '기록 중...' : (<><IconBlockchain size={12} /> 변경사항 재인증</>)}
            </button>
          )}
        </>
      ) : isOwner ? (
        <button onClick={handleRegister} disabled={registering} style={btnStyle}>
          {registering ? '원본인증 중...' : (<><IconBlockchain size={12} /> 원본인증</>)}
        </button>
      ) : null}

      {error && (
        <div style={{ fontSize: 11, color: 'var(--accent-danger, #e53935)', marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}