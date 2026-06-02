'use client';

/**
 * useToolbarConfig — 사용자 수식 툴바 설정 로드/저장 (계획서 §5, §9-2)
 *
 * - 로그인 시: Firestore에서 로드. 미커스터마이징이면 config=null (팔레트는 기본 7탭 폴백).
 * - 로그아웃 시: config=null, isLoggedIn=false (커스터마이징 비활성).
 * - 모듈 캐시로 동일 uid 재마운트 시 재요청 방지(팔레트가 여러 곳에서 마운트되므로).
 */
import { useState, useEffect, useCallback } from 'react';
import useAuth from './useAuth';
import { getToolbarConfig, saveToolbarConfig } from '../lib/toolbar-config';
import { buildPresetConfig } from '../lib/toolbar-defaults';
import type { ToolbarConfig, PresetId } from '../types/toolbar-config';

// 모듈 캐시: { uid, config(null 가능) }
let cache: { uid: string; config: ToolbarConfig | null } | null = null;

export default function useToolbarConfig() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [config, setConfig] = useState<ToolbarConfig | null>(
    cache && cache.uid === uid ? cache.config : null,
  );
  const [loading, setLoading] = useState<boolean>(!!uid && !(cache && cache.uid === uid));

  useEffect(() => {
    if (!uid) { setConfig(null); setLoading(false); return; }
    if (cache && cache.uid === uid) { setConfig(cache.config); setLoading(false); return; }
    let active = true;
    setLoading(true);
    getToolbarConfig(uid)
      .then((c) => {
        if (!active) return;
        cache = { uid, config: c };
        setConfig(c);
      })
      .catch((err) => { console.error('toolbar config 로드 실패:', err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);

  const save = useCallback(async (next: ToolbarConfig) => {
    if (!uid) return;
    cache = { uid, config: next };
    setConfig(next);
    try { await saveToolbarConfig(uid, next); }
    catch (err) { console.error('toolbar config 저장 실패:', err); }
  }, [uid]);

  const applyPreset = useCallback(async (presetId: PresetId) => {
    await save(buildPresetConfig(presetId));
  }, [save]);

  return { config, loading, isLoggedIn: !!uid, save, applyPreset };
}
