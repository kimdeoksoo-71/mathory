'use client';

/**
 * Phase 63 S4(D9) — 리스트 칼럼 prefs의 폴더별 영속.
 * localStorage `mathory.listPrefs.<scopeKey>` — scopeKey는 folder.id(가상 폴더 포함 —
 * Firestore 문서가 없는 폴더도 저장돼야 하므로 문서 경로가 아니라 localStorage다).
 * 공유 뷰는 `__shared_with_me__`/`__sent__` 단위로 병합 수용(Q16).
 * 검증·기본값은 lib/listColumns의 sanitizePrefs 한 곳(모르는 id 무시·새 id 뒤에 붙임).
 */

import { useCallback, useEffect, useState } from 'react';
import { type ListPrefs, sanitizePrefs } from '../lib/listColumns';

const keyFor = (scopeKey: string) => `mathory.listPrefs.${scopeKey}`;

function load(scopeKey: string, trash: boolean): ListPrefs {
  if (typeof window === 'undefined') return sanitizePrefs(null, { trash });
  try {
    return sanitizePrefs(JSON.parse(localStorage.getItem(keyFor(scopeKey)) ?? 'null'), { trash });
  } catch {
    return sanitizePrefs(null, { trash });
  }
}

export function useListPrefs(scopeKey: string, trash: boolean) {
  const [prefs, setPrefs] = useState<ListPrefs>(() => load(scopeKey, trash));

  // 폴더 전환 시 그 폴더의 저장값으로 교체
  useEffect(() => { setPrefs(load(scopeKey, trash)); }, [scopeKey, trash]);

  const updatePrefs = useCallback((mutate: (prev: ListPrefs) => ListPrefs) => {
    setPrefs((prev) => {
      const next = mutate(prev);
      try { localStorage.setItem(keyFor(scopeKey), JSON.stringify(next)); } catch {}
      return next;
    });
  }, [scopeKey]);

  return { prefs, updatePrefs };
}
