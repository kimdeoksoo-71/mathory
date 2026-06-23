'use client';

import { useState, useEffect } from 'react';
import { TabMeta } from '../../types/problem';
import { setMemberTabVisibility } from '../../lib/membership';
import { getProblem } from '../../lib/firestore';

interface ShareSettingsPanelProps {
  problemId: string;
  tabs: TabMeta[];
  /** 공유 대상(멤버) 관리 모달 열기 */
  onManageMembers: () => void;
}

/**
 * Phase 49 (D): 문항 단위 공유 설정 (인라인).
 * SharePanel을 대체 — 멤버 관리는 ShareTargetModal로, 웹 공개는 Phase 50으로 이관.
 * 여기서는 전역 탭 가시성만 다룬다.
 */
export default function ShareSettingsPanel({ problemId, tabs, onManageMembers }: ShareSettingsPanelProps) {
  const [tabVis, setTabVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, true])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const problem = await getProblem(problemId);
        if (cancelled) return;
        const mtv = problem?.memberTabVisibility;
        setTabVis(mtv
          ? Object.fromEntries(tabs.map((t) => [t.id, mtv[t.id] !== false]))
          : Object.fromEntries(tabs.map((t) => [t.id, true])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '공유 설정을 불러오지 못했습니다.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  const handleChange = async (tabId: string, visible: boolean) => {
    const prev = tabVis;
    const next = { ...tabVis, [tabId]: visible };
    setTabVis(next);
    setBusy(true); setError(null);
    try {
      await setMemberTabVisibility(problemId, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
      setTabVis(prev);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      <button
        onClick={onManageMembers}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 12,
          border: '1px solid var(--border-primary)', borderRadius: 8,
          background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}
      >
        공유 대상 관리…
      </button>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3, marginBottom: 6 }}>
        공유할 탭
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
        모든 공유 대상에게 공통 적용됩니다.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabs.map((t) => (
          <label key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
            borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: 12,
            color: 'var(--text-primary)',
          }}>
            <input
              type="checkbox"
              checked={tabVis[t.id] !== false}
              disabled={busy}
              onChange={(e) => handleChange(t.id, e.target.checked)}
              style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  );
}
