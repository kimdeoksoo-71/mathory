'use client';

import { useState, useEffect, useCallback } from 'react';
import { MathSnippet } from '../types/snippet';
import { listSnippets, createSnippet, updateSnippet, deleteSnippet } from '../lib/snippets';
import useAuth from './useAuth';

export default function useSnippets() {
  const { user } = useAuth();
  const [snippets, setSnippets] = useState<MathSnippet[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setSnippets([]);
      setLoading(false);
      return;
    }
    try {
      const list = await listSnippets(user.uid);
      setSnippets(list);
    } catch (err) {
      console.error('Failed to load snippets:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addSnippet = useCallback(
    async (data: { name: string; shortcutIndex: number; content: string }) => {
      if (!user) return;
      await createSnippet(user.uid, data);
      await reload();
    },
    [user, reload]
  );

  const editSnippet = useCallback(
    async (snippetId: string, data: Partial<{ name: string; shortcutIndex: number; content: string }>) => {
      if (!user) return;
      await updateSnippet(user.uid, snippetId, data);
      await reload();
    },
    [user, reload]
  );

  const removeSnippet = useCallback(
    async (snippetId: string) => {
      if (!user) return;
      await deleteSnippet(user.uid, snippetId);
      await reload();
    },
    [user, reload]
  );

  /** shortcutIndex(1~9)로 상용구 찾기 */
  const getByShortcut = useCallback(
    (index: number): MathSnippet | undefined => {
      return snippets.find((s) => s.shortcutIndex === index);
    },
    [snippets]
  );

  return {
    snippets,
    loading,
    addSnippet,
    editSnippet,
    removeSnippet,
    getByShortcut,
    reload,
  };
}