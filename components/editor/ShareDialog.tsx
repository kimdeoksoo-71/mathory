'use client';

import { useState, useEffect, useMemo } from 'react';
import { TabMeta, ShareTabVisibility } from '../../types/problem';
import {
  createShare, getShareByProblem, revokeShare, isShareExpired,
  DEFAULT_EXPIRY_HOURS, MAX_EXPIRY_DAYS, ShareWithSnapshot,
} from '../../lib/shares';

interface ShareDialogProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  onClose: () => void;
}

function formatRemaining(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return '만료됨';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${mins}분 남음`;
  return `${mins}분 남음`;
}

export default function ShareDialog({ problemId, ownerUid, tabs, onClose }: ShareDialogProps) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [existing, setExisting] = useState<ShareWithSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 설정값 (신규 생성용)
  const [expiryHours, setExpiryHours] = useState(DEFAULT_EXPIRY_HOURS);
  const [tabVis, setTabVis] = useState<ShareTabVisibility>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, true])),
  );

  useEffect(() => {
    (async () => {
      try {
        const cur = await getShareByProblem(problemId, ownerUid);
        if (cur && !isShareExpired(cur)) {
          setExisting(cur);
        } else if (cur) {
          // 만료된 잔여물 정리
          await revokeShare(cur.id);
        }
      } catch (e: any) {
        setError(e.message || '공유 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [problemId, ownerUid]);

  const shareUrl = useMemo(() => {
    if (!existing) return '';
    return `${window.location.origin}/shared/${existing.id}`;
  }, [existing]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const share = await createShare({
        problemId, ownerUid, expiryHours, tabVisibility: tabVis,
      });
      setExisting(share);
    } catch (e: any) {
      setError(e.message || '공유 링크 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!existing) return;
    if (!confirm('공유 링크를 해제하시겠습니까? 기존 링크는 즉시 접근 불가능해집니다.')) return;
    setCreating(true);
    try {
      await revokeShare(existing.id);
      setExisting(null);
    } catch (e: any) {
      setError(e.message || '해제 실패');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = shareUrl; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // expiry options: 1~30일 (24h 단위)
  const expiryOptions = useMemo(() => {
    const opts: { hours: number; label: string }[] = [];
    for (let d = 1; d <= MAX_EXPIRY_DAYS; d++) {
      opts.push({ hours: d * 24, label: `${d}일` });
    }
    return opts;
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, #fff)', borderRadius: 12, padding: 24,
          width: 460, maxWidth: '92vw', maxHeight: '92vh', overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>공유 링크</h3>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--text-muted)', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>불러오는 중…</div>
        ) : existing ? (
          <ActiveShareView
            share={existing}
            url={shareUrl}
            copied={copied}
            onCopy={handleCopy}
            onRevoke={handleRevoke}
            disabled={creating}
          />
        ) : (
          <CreateShareView
            tabs={tabs}
            tabVis={tabVis}
            setTabVis={setTabVis}
            expiryHours={expiryHours}
            setExpiryHours={setExpiryHours}
            expiryOptions={expiryOptions}
            onCreate={handleCreate}
            creating={creating}
          />
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 6,
            background: '#fdecea', color: '#a4322a', fontSize: 12,
          }}>{error}</div>
        )}
      </div>
    </div>
  );
}

/* ─── 활성 공유 표시 ─── */
function ActiveShareView({
  share, url, copied, onCopy, onRevoke, disabled,
}: {
  share: ShareWithSnapshot;
  url: string;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  disabled: boolean;
}) {
  const visibleTabIds = Object.entries(share.tabVisibility)
    .filter(([, v]) => v).map(([k]) => k);
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        공유 링크
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          readOnly value={url}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 12,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
            background: 'var(--bg-input, #f8f8f8)', fontFamily: 'monospace',
          }}
        />
        <button onClick={onCopy} style={{
          padding: '8px 14px', border: 'none', borderRadius: 6,
          background: 'var(--accent-primary, #B8845C)', color: '#fff',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {copied ? '복사됨!' : '링크 복사'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <div>만료: {share.expiresAt.toLocaleString('ko-KR')} ({formatRemaining(share.expiresAt)})</div>
        <div>공개 탭: {visibleTabIds.length > 0 ? visibleTabIds.join(', ') : '없음'}</div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-faint)' }}>
          ※ 이 링크는 공유 생성 시점의 스냅샷입니다. 이후 편집한 내용은 반영되지 않습니다.
          새 내용을 공유하려면 링크를 해제하고 다시 생성하세요.
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onRevoke} disabled={disabled} style={{
          padding: '7px 14px', border: '1px solid var(--accent-danger, #c33)',
          background: 'transparent', color: 'var(--accent-danger, #c33)',
          borderRadius: 6, cursor: disabled ? 'wait' : 'pointer',
          fontSize: 12, fontWeight: 600,
        }}>
          공유 해제
        </button>
      </div>
    </>
  );
}

/* ─── 신규 공유 생성 ─── */
function CreateShareView({
  tabs, tabVis, setTabVis, expiryHours, setExpiryHours, expiryOptions,
  onCreate, creating,
}: {
  tabs: TabMeta[];
  tabVis: ShareTabVisibility;
  setTabVis: (v: ShareTabVisibility) => void;
  expiryHours: number;
  setExpiryHours: (h: number) => void;
  expiryOptions: { hours: number; label: string }[];
  onCreate: () => void;
  creating: boolean;
}) {
  const anyVisible = Object.values(tabVis).some((v) => v);
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary, #333)' }}>
          만료 기간
        </div>
        <select
          value={expiryHours}
          onChange={(e) => setExpiryHours(Number(e.target.value))}
          style={{
            width: '100%', padding: '8px 10px', fontSize: 13,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
            background: 'var(--bg-input, #fff)',
          }}
        >
          {expiryOptions.map((opt) => (
            <option key={opt.hours} value={opt.hours}>
              {opt.label}{opt.hours === DEFAULT_EXPIRY_HOURS ? ' (기본)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary, #333)' }}>
          공개할 탭
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tabs.map((tab) => (
            <label key={tab.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6,
              background: 'var(--bg-hover, #f5f5f5)', cursor: 'pointer',
              fontSize: 13,
            }}>
              <input
                type="checkbox"
                checked={tabVis[tab.id] !== false}
                onChange={(e) => setTabVis({ ...tabVis, [tab.id]: e.target.checked })}
                style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
              />
              <span>{tab.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onCreate}
          disabled={creating || !anyVisible}
          style={{
            padding: '9px 18px', border: 'none', borderRadius: 6,
            background: (creating || !anyVisible) ? 'var(--text-faint, #ccc)' : 'var(--accent-primary, #B8845C)',
            color: '#fff', cursor: (creating || !anyVisible) ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          {creating ? '생성 중…' : '공유 링크 생성'}
        </button>
      </div>
    </>
  );
}
