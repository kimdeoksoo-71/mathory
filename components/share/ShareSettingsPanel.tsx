'use client';

import { useState, useEffect } from 'react';
import { TabMeta } from '../../types/problem';
import { setMemberTabVisibility } from '../../lib/membership';
import { getProblem } from '../../lib/firestore';
import {
  createShare, getShareByProblem, revokeShare, isShareExpired,
  ShareWithSnapshot, EXPIRY_PRESET_DAYS, DEFAULT_EXPIRY_DAYS,
} from '../../lib/shares';

interface ShareSettingsPanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  /** 공유 대상(멤버) 관리 모달 열기 */
  onManageMembers: () => void;
}

const PRESET_LABEL = (d: number | null) => (d === null ? '무기한' : `${d}일`);

/**
 * Phase 49 (D) + 50: 문항 단위 공유 설정 (인라인).
 * - 전역 탭 가시성 토글
 * - 공유 대상(멤버) 관리 진입
 * - 웹에 공개 (생성/링크/만료 변경/중단) — Phase 50
 */
export default function ShareSettingsPanel({ problemId, ownerUid, tabs, onManageMembers }: ShareSettingsPanelProps) {
  const [tabVis, setTabVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, true])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 웹에 공개 상태
  const [webShare, setWebShare] = useState<ShareWithSnapshot | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [webBusy, setWebBusy] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(DEFAULT_EXPIRY_DAYS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [problem, existing] = await Promise.all([
          getProblem(problemId),
          getShareByProblem(problemId, ownerUid).catch(() => null),
        ]);
        if (cancelled) return;
        const mtv = problem?.memberTabVisibility;
        setTabVis(mtv
          ? Object.fromEntries(tabs.map((t) => [t.id, mtv[t.id] !== false]))
          : Object.fromEntries(tabs.map((t) => [t.id, true])));
        setWebShare(existing && !isShareExpired(existing) ? existing : null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '공유 설정을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setWebLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, ownerUid]);

  const handleTabChange = async (tabId: string, visible: boolean) => {
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

  const urlFor = (id: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/shared/${id}` : `/shared/${id}`;

  const handleCopy = async () => {
    if (!webShare) return;
    const url = urlFor(webShare.id);
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const handlePublish = async () => {
    setWebBusy(true); setError(null);
    try {
      const share = await createShare({
        problemId, ownerUid,
        expiryHours: expiryDays == null ? null : expiryDays * 24,
        tabVisibility: tabVis,
      });
      setWebShare(share);
    } catch (e) {
      setError(e instanceof Error ? e.message : '웹 공개 실패');
    } finally { setWebBusy(false); }
  };

  const handleRevoke = async () => {
    if (!webShare) return;
    if (!confirm('웹 공개를 중단하시겠습니까? 링크가 즉시 무효화됩니다.')) return;
    setWebBusy(true); setError(null);
    try { await revokeShare(webShare.id); setWebShare(null); }
    catch (e) { setError(e instanceof Error ? e.message : '중단 실패'); }
    finally { setWebBusy(false); }
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      <button
        onClick={onManageMembers}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 14,
          border: '1px solid var(--border-primary)', borderRadius: 8,
          background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}
      >
        공유 대상 관리…
      </button>

      <SectionLabel>공유할 탭</SectionLabel>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
        모든 공유 대상(멤버·웹)에게 공통 적용됩니다.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
        {tabs.map((t) => (
          <label key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
            borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: 12, color: 'var(--text-primary)',
          }}>
            <input
              type="checkbox"
              checked={tabVis[t.id] !== false}
              disabled={busy}
              onChange={(e) => handleTabChange(t.id, e.target.checked)}
              style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {/* ─── 웹에 공개 (Phase 50) ─── */}
      <SectionLabel>웹에 공개</SectionLabel>
      {webLoading ? (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>불러오는 중…</div>
      ) : webShare ? (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              readOnly
              value={urlFor(webShare.id)}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{
                flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 11,
                border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
                background: 'var(--bg-input, #f8f8f8)', fontFamily: 'monospace',
              }}
            />
            <button onClick={handleCopy} style={{
              padding: '6px 10px', border: 'none', borderRadius: 6,
              background: 'var(--accent-primary, #B8845C)', color: '#fff',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8 }}>
            {webShare.expiresAt === null
              ? '공개 기간: 무기한'
              : `만료: ${webShare.expiresAt.toLocaleDateString('ko-KR')}`}
            <br />
            만료일 변경은 공개 목록(공유 &gt; 웹에 공개)에서 가능합니다.
          </div>
          <button onClick={handleRevoke} disabled={webBusy} style={{
            width: '100%', padding: '6px 0', border: '1px solid var(--accent-danger, #c33)',
            background: 'transparent', color: 'var(--accent-danger, #c33)',
            borderRadius: 6, cursor: webBusy ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600,
          }}>
            웹 공개 중단
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>만료</span>
            <select
              value={expiryDays == null ? 'null' : String(expiryDays)}
              onChange={(e) => setExpiryDays(e.target.value === 'null' ? null : Number(e.target.value))}
              style={{
                flex: 1, padding: '5px 6px', fontSize: 12, border: '1px solid var(--border-light, #ddd)',
                borderRadius: 6, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
              }}
            >
              {EXPIRY_PRESET_DAYS.map((d) => (
                <option key={String(d)} value={d == null ? 'null' : String(d)}>{PRESET_LABEL(d)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePublish}
            disabled={webBusy || !Object.values(tabVis).some((v) => v)}
            style={{
              width: '100%', padding: '7px 0', border: 'none', borderRadius: 6,
              background: webBusy ? 'var(--text-faint, #ccc)' : 'var(--accent-primary, #B8845C)',
              color: '#fff', cursor: webBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
            }}
          >
            {webBusy ? '공개 중…' : '웹에 공개'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3, marginBottom: 6 }}>
      {children}
    </div>
  );
}
