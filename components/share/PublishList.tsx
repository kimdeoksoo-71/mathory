'use client';

import { useMemo, useState } from 'react';
import { ShareWithSnapshot, createShare, revokeShare, EXPIRY_PRESET_DAYS } from '../../lib/shares';
import { updateProblem } from '../../lib/firestore';
import { useCommentCounts } from '../../hooks/useCommentCounts';
import { Problem } from '../../types/problem';
import { alertDialog, confirmDialog } from '../../lib/dialogs';

interface PublishListProps {
  /** 스냅샷 공개 (Phase 50) */
  shares: ShareWithSnapshot[];
  /** 실시간 공개 (visibility==='public') 문항 */
  publicProblems: Problem[];
  onChanged: () => void;
}

/** 통합 행 모델: 스냅샷 / 실시간 두 소스 */
type Row =
  | { kind: 'snapshot'; key: string; title: string; date: Date; share: ShareWithSnapshot }
  | { kind: 'live'; key: string; title: string; date: Date; problem: Problem };

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
 * Phase 51: 통합 "문항 공개" 목록.
 * 스냅샷(shares)과 실시간(visibility==='public')을 한 리스트에 방식 배지로 함께 노출.
 * 정렬은 publishedAt(실시간) / createdAt(스냅샷) 내림차순.
 */
export default function PublishList({ shares, publicProblems, onChanged }: PublishListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 실시간 행의 미해결 댓글 수 (행 표시용, §10: v1 비용 수용)
  const { commentCounts } = useCommentCounts(publicProblems, `publish:${publicProblems.length}`);

  const rows = useMemo<Row[]>(() => {
    const snapRows: Row[] = shares.map((s) => ({
      kind: 'snapshot' as const,
      key: `s:${s.id}`,
      title: s.snapshot?.title || '(제목 없음)',
      date: s.createdAt,
      share: s,
    }));
    const liveRows: Row[] = publicProblems.map((p) => ({
      kind: 'live' as const,
      key: `p:${p.id}`,
      title: p.title || '(제목 없음)',
      date: p.publishedAt ?? p.created_at, // 구 공개 문항(publishedAt 없음)은 created_at 폴백
      problem: p,
    }));
    return [...snapRows, ...liveRows].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [shares, publicProblems]);

  const originOf = (path: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  const handleCopy = async (rowKey: string, path: string) => {
    const url = originOf(path);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiedId(rowKey);
    setTimeout(() => setCopiedId((c) => (c === rowKey ? null : c)), 1600);
  };

  const handleRevokeSnapshot = async (s: ShareWithSnapshot) => {
    if (!await confirmDialog({
      title: '공개 중단', message: '이 공개를 중단하시겠습니까? 링크가 즉시 무효화됩니다.',
      danger: true, confirmLabel: '중단',
    })) return;
    setBusyId(`s:${s.id}`);
    try { await revokeShare(s.id); onChanged(); }
    catch (e) { await alertDialog(e instanceof Error ? e.message : '공개 중단 실패'); }
    finally { setBusyId(null); }
  };

  const handleReissue = async (s: ShareWithSnapshot, days: number | null) => {
    if (!await confirmDialog({
      title: '만료일 변경',
      message: '만료일을 바꾸면 링크가 새로 발급되어 기존 링크는 무효화됩니다. 계속할까요?',
      danger: true, confirmLabel: '변경',
    })) return;
    setBusyId(`s:${s.id}`);
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
      await alertDialog(e instanceof Error ? e.message : '재발급 실패');
    } finally { setBusyId(null); }
  };

  const handleUnpublishLive = async (p: Problem) => {
    if (!await confirmDialog({
      title: '실시간 공개 중단', message: '실시간 공개를 중단하시겠습니까? 링크 접속이 즉시 차단됩니다.',
      danger: true, confirmLabel: '중단',
    })) return;
    setBusyId(`p:${p.id}`);
    try { await updateProblem(p.id, { visibility: 'private' }); onChanged(); }
    catch (e) { await alertDialog(e instanceof Error ? e.message : '공개 중단 실패'); }
    finally { setBusyId(null); }
  };

  return (
    <div style={{ padding: '8px 16px 32px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
        fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-light, #e5e5e5)',
      }}>
        <div style={{ width: 52, flexShrink: 0 }}>방식</div>
        <div style={{ flex: 1, minWidth: 0 }}>제목</div>
        <div style={{ width: 72, flexShrink: 0 }}>공개일</div>
        <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>댓글</div>
        <div style={{ width: 90, flexShrink: 0 }}>만료</div>
        <div style={{ width: 150, flexShrink: 0 }} />
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          공개한 문항이 없습니다.
        </div>
      ) : rows.map((row) => {
        const path = row.kind === 'snapshot' ? `/shared/${row.share.id}` : `/p/${row.problem.id}`;
        const unresolved = row.kind === 'live' ? (commentCounts[row.problem.id] ?? 0) : 0;
        return (
          <div key={row.key} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
            borderBottom: '1px solid var(--border-light, #efefef)',
            opacity: busyId === row.key ? 0.5 : 1,
          }}>
            {/* 방식 배지 */}
            <div style={{ width: 52, flexShrink: 0 }}>
              <ModeBadge live={row.kind === 'live'} />
            </div>

            {/* 제목 → 뷰어 새 탭 */}
            <button
              onClick={() => window.open(originOf(path), '_blank', 'noopener')}
              style={{
                flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)',
              }}
              title="새 탭에서 공개본 열기"
            >
              {row.title}
            </button>

            {/* 공개일 */}
            <div style={{ width: 72, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtDate(row.date)}
            </div>

            {/* 댓글 (실시간만) */}
            <div style={{ width: 44, flexShrink: 0, textAlign: 'center', fontSize: 12, color: unresolved > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {row.kind === 'live' ? (unresolved > 0 ? unresolved : '·') : '—'}
            </div>

            {/* 만료 (스냅샷만 칩+변경) */}
            <div style={{ width: 90, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {row.kind === 'snapshot' ? (
                <>
                  <span style={{ fontSize: 11.5, color: row.share.expiresAt && row.share.expiresAt.getTime() <= Date.now() ? 'var(--accent-danger, #c33)' : 'var(--text-secondary)' }}>
                    {expiryLabel(row.share.expiresAt)}
                  </span>
                  <select
                    value=""
                    disabled={busyId === row.key}
                    onChange={(e) => { const v = e.target.value; if (v !== '') handleReissue(row.share, v === 'null' ? null : Number(v)); }}
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
                </>
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
              )}
            </div>

            {/* 액션 */}
            <div style={{ width: 150, flexShrink: 0, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleCopy(row.key, path)}
                disabled={busyId === row.key}
                style={btnStyle(false)}
              >
                {copiedId === row.key ? '복사됨' : '링크 복사'}
              </button>
              <button
                onClick={() => row.kind === 'snapshot' ? handleRevokeSnapshot(row.share) : handleUnpublishLive(row.problem)}
                disabled={busyId === row.key}
                style={btnStyle(true)}
              >
                중단
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModeBadge({ live }: { live: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 5,
      fontSize: 10.5, fontWeight: 700, lineHeight: 1.5,
      color: live ? 'var(--accent-primary, #2563eb)' : 'var(--text-muted)',
      background: live ? 'var(--accent-soft, rgba(37,99,235,0.1))' : 'var(--bg-subtle, #f1f1f1)',
      border: `1px solid ${live ? 'var(--accent-primary, #2563eb)' : 'var(--border-light, #ddd)'}`,
    }}>
      {live ? '실시간' : '스냅샷'}
    </span>
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
