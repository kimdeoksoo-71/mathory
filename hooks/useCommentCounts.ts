'use client';

import { useState, useEffect } from 'react';
import { Problem } from '../types/problem';
import { listAllComments, countComments, countAgentSessions } from '../lib/comments';
import { listSessions } from '../lib/discussion-sessions';

export interface CommentCounts {
  /** 문항별 미해결 댓글 수 (댓글 스트림) */
  commentCounts: Record<string, number>;
  /** 문항별 agent(AI) 세션 수 */
  agentCounts: Record<string, number>;
}

/**
 * Phase 49: 문항 목록의 미해결 댓글 수 + agent 세션 수를 병렬 로드.
 * FolderView 카드 그리드와 ListView가 공유하는 훅 (실패는 0으로).
 * @param key 재로드 트리거 키 (스코프/폴더 식별자 등). problems 길이 변화와 함께 의존.
 */
export function useCommentCounts(problems: Problem[], key: string): CommentCounts {
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (problems.length === 0) { setCommentCounts({}); setAgentCounts({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        problems.map(async (p) => {
          try {
            const [comments, sessions] = await Promise.all([
              listAllComments(p.id),
              listSessions(p.id),
            ]);
            const commentSessionId = sessions.find((s) => s.type === 'comment')?.id ?? null;
            const c = countComments(comments, commentSessionId, { unresolvedOnly: true });
            const a = countAgentSessions(sessions);
            return [p.id, c, a] as const;
          } catch {
            return [p.id, 0, 0] as const;
          }
        }),
      );
      if (cancelled) return;
      const cMap: Record<string, number> = {};
      const aMap: Record<string, number> = {};
      for (const [id, c, a] of entries) { cMap[id] = c; aMap[id] = a; }
      setCommentCounts(cMap);
      setAgentCounts(aMap);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, problems.length]);

  return { commentCounts, agentCounts };
}
