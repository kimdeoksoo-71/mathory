import { useState, useCallback, useRef } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { ProblemVersion } from '../types/version';
import { versionsPage } from '../lib/version/read';

/** Phase 55 — 버전 목록·페이지네이션 상태. */
export function useVersionHistory(problemId: string) {
  const [versions, setVersions] = useState<ProblemVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await versionsPage(problemId, null);
      setVersions(page.versions);
      cursorRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch (e) {
      console.error('[Phase55] 버전 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current) return;
    setLoading(true);
    try {
      const page = await versionsPage(problemId, cursorRef.current);
      setVersions((prev) => [...prev, ...page.versions]);
      cursorRef.current = page.lastDoc;
      setHasMore(page.hasMore);
    } catch (e) {
      console.error('[Phase55] 버전 더보기 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  return { versions, loading, hasMore, loadFirst, loadMore };
}
