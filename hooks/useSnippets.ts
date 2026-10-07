'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MathSnippet, SnippetInput } from '../types/snippet';
import { listSnippets, createSnippet, updateSnippet, deleteSnippet } from '../lib/snippets';
import { DEFAULT_ABBREVS } from '../lib/mathInput';
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
    async (data: SnippetInput) => {
      if (!user) return;
      await createSnippet(user.uid, data);
      await reload();
    },
    [user, reload]
  );

  const editSnippet = useCallback(
    async (snippetId: string, data: Partial<SnippetInput>) => {
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

  /** shortcutIndex(1~9)로 단축키 상용구 찾기 — hotkey만 */
  const getByShortcut = useCallback(
    (index: number): MathSnippet | undefined => {
      return snippets.find((s) => s.kind === 'hotkey' && s.shortcutIndex === index);
    },
    [snippets]
  );

  /* Phase 68 D5 — 수식 단축어 맵: 기본 8종 위에 사용자 것을 덮는다(같은 약어면 사용자 우선).
     MarkdownEditor의 Tab 핸들러가 ref로 읽는다. */
  const abbrevMap = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = { ...DEFAULT_ABBREVS };
    for (const s of snippets) if (s.kind === 'abbrev' && s.abbrev) out[s.abbrev] = s.content;
    return out;
  }, [snippets]);

  /** 사용자가 등록한 약어 집합(메뉴 "대체됨" 표시·중복 검사) */
  const userAbbrevs = useMemo<Set<string>>(
    () => new Set(snippets.filter((s) => s.kind === 'abbrev' && s.abbrev).map((s) => s.abbrev as string)),
    [snippets]
  );

  return {
    snippets,
    loading,
    addSnippet,
    editSnippet,
    removeSnippet,
    getByShortcut,
    abbrevMap,
    userAbbrevs,
    reload,
  };
}
