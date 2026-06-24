'use client';

import { useState } from 'react';
import { ShareWithSnapshot, createShare, revokeShare, EXPIRY_PRESET_DAYS } from '../../lib/shares';

interface WebShareListProps {
  shares: ShareWithSnapshot[];
  onChanged: () => void;
}

function fmtDate(d?: Date | null): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function expiryLabel(expiresAt: Date | null): string {
  if (expiresAt === null) return '무기한';
  if (expiresAt.getTime() <= Date.now()) return '만료됨';
  return `~${fmtDate(expiresAt)}`;
}

const PRESET_LABEL = (d: number | null) => (d === null ? '무기한' : `${d}일`);

/**
 * Phase 50: 웹에 공개 목록 (전용). shares 스냅샷 기반 — 제목/게시일/탭/만료/링크/중단.
 * 만료 변경은 update 불가 규칙상 revoke+재발급(shareId·링크 변경).
 */
export default function WebShareList({ shares, onChanged }: WebShareListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const urlFor = (id: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/shared/${id}` : `/shared/${id}`;

  const handleCopy = async (id: string) => {
    const url = urlFor(id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
  };

  const handleRevoke = async (s: ShareWithSnapshot) => {
    if (!confirm('이 공개를 중단하시겠습니까? 링크가 즉시 무효화됩니다.')) return;
    setBusyId(s.id);
    try { await revokeShare(s.id); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : '공개 중단 실패'); }
    finally { setBusyId(null); }
  };

  const handleReissue = async (s: ShareWithSnapshot, days: number | null) => {
    if (!confirm('만료일을 바꾸면 링크가 새로 발급되어 기존 링크는 무효화됩니다. 계속할까요?')) return;
    setBusyId(s.id);
    try {
      await revokeShare(s.id);
      await createShare({
        problemId: s.problemId,
        ownerUid: s.ownerUid,
        expiryHours: days == null ? null : days * 24,
        tabVisibility: s.tabVisibility,
      });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : '재발급 실패');
    } finally { setBusyId(null); }
  };

  return (
    <div style={{ padding: '8px 16px 32px', fontFamily: 'var(--font-ui)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
        fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-light, #e5e5e5)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>제목</div>
        <div style={{ width: 72, flexShrink: 0 }}>게시일</div>
        <div style={{ width: 90, flexShrink: 0 }}>만료</div>
        <div style={{ width: 150, flexShrink: 0 }} />
      </div>

      {shares.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          웹에 공개한 문항이 없습니다.
        </div>
      ) : shares.map((s) => (
        <div key={s.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
          borderBottom: '1px solid var(--border-light, #efefef)',
          opacity: busyId === s.id ? 0.5 : 1,
        }}>
          {/* 제목 → 뷰어 새 탭 */}
          <button
            onClick={() => window.open(urlFor(s.id), '_blank', 'noopener')}
            style={{
              flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)',
            }}
            title="새 탭에서 공개본 열기"
          >
            {s.snapshot?.title || '(제목 없음)'}
          </button>

          {/* 게시일 */}
          <div style={{ width: 72, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {fmtDate(s.createdAt)}
          </div>

          {/* 만료 칩 + 변경 */}
          <div style={{ width: 90, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11.5, color: s.expiresAt && s.expiresAt.getTime() <= Date.now() ? 'var(--accent-danger, #c33)' : 'var(--text-secondary)' }}>
              {expiryLabel(s.expiresAt)}
            </span>
            <select
              value=""
              disabled={busyId === s.id}
              onChange={(e) => { const v = e.target.value; if (v !== '') handleReissue(s, v === 'null' ? null : Number(v)); }}
              style={{
                fontSize: 10.5, padding: '1px 2px', border: '1px solid var(--border-light, #ddd)',
                borderRadius: 5, background: 'var(--bg-primary, #fff)', color: 'var(--text-muted)',
              }}
            >
              <option value="">만료 변경…</option>
              {EXPIRY_PRESET_DAYS.map((d) => (
                <option key={String(d)} value={d === null ? 'null' : String(d)}>{PRESET_LABEL(d)}</option>
              ))}
            </select>
          </div>

          {/* 액션 */}
          <div style={{ width: 150, flexShrink: 0, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => handleCopy(s.id)}
              disabled={busyId === s.id}
              style={btnStyle(false)}
            >
              {copiedId === s.id ? '복사됨' : '링크 복사'}
            </button>
            <button
              onClick={() => handleRevoke(s)}
              disabled={busyId === s.id}
              style={btnStyle(true)}
            >
              중단
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function btnStyle(danger: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 6,
    border: `1px solid ${danger ? 'var(--accent-danger, #c33)' : 'var(--border-primary)'}`,
    background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-ui)',
    color: danger ? 'var(--accent-danger, #c33)' : 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  };
}
