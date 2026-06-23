'use client';

import { useState } from 'react';
import { Problem, UserProfile, MemberRole } from '../../types/problem';
import { updateMemberRole, removeMember } from '../../lib/membership';
import BlockchainBadge from '../ui/BlockchainBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import { IconDotsVertical, IconShare, IconCopy, IconTrash } from '../ui/Icons';
import { useCommentCounts } from '../../hooks/useCommentCounts';

export type ListMode = 'my' | 'received' | 'sent';

interface ListViewProps {
  problems: Problem[];
  scopeKey: string;
  mode: ListMode;
  /** sent 모드: 이 뷰가 묶인 수신자 uid (권한 변경·공유 중단 대상) */
  recipientUid?: string;
  /** received 모드: 소유자 프로필 (uid → profile) */
  profiles?: Record<string, UserProfile>;
  onView: (p: Problem) => void;
  onProblemAction: (action: string, p: Problem) => void;
  onChanged: () => void;
}

type SortKey = 'title' | 'updated';
interface SortState { key: SortKey; dir: 'asc' | 'desc'; }

function fmtDate(d?: Date): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function ListView({
  problems, scopeKey, mode, recipientUid, profiles, onView, onProblemAction, onChanged,
}: ListViewProps) {
  const { commentCounts, agentCounts } = useCommentCounts(problems, scopeKey);
  const [sort, setSort] = useState<SortState>({ key: 'updated', dir: 'desc' });
  const [menu, setMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...problems].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'title') return mul * (a.title || '').localeCompare(b.title || '');
    return mul * ((a.updated_at?.getTime() || 0) - (b.updated_at?.getTime() || 0));
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'title' ? 'asc' : 'desc' });
  };

  const menuItemsFor = (p: Problem): ContextMenuAction[] => {
    if (mode === 'received') return [
      { label: '공유 받기 해제', icon: <IconShare size={14} />, action: 'leave_shared', danger: true },
    ];
    if (mode === 'sent') return [
      { label: '이 사용자와 공유 중단', icon: <IconShare size={14} />, action: 'stop_share', danger: true },
    ];
    return [
      { label: '공유', icon: <IconShare size={14} />, action: 'share' },
      { label: '사본 만들기', icon: <IconCopy size={14} />, action: 'duplicate' },
      { label: '휴지통', icon: <IconTrash size={14} />, action: 'trash', danger: true },
    ];
  };

  const handleMenuAction = async (action: string, p: Problem) => {
    setMenu(null);
    if (action === 'stop_share' && recipientUid) {
      if (!confirm('이 사용자와의 공유를 중단하시겠습니까?')) return;
      setBusyId(p.id);
      try { await removeMember(p.id, recipientUid); onChanged(); }
      catch (e) { alert(e instanceof Error ? e.message : '공유 중단 실패'); }
      finally { setBusyId(null); }
      return;
    }
    onProblemAction(action, p);
  };

  const handleRoleChange = async (p: Problem, role: MemberRole) => {
    if (!recipientUid) return;
    setBusyId(p.id);
    try { await updateMemberRole(p.id, recipientUid, role); onChanged(); }
    catch (e) { alert(e instanceof Error ? e.message : '권한 변경 실패'); }
    finally { setBusyId(null); }
  };

  const showOwner = mode === 'received';
  const showPerm = mode === 'sent';

  return (
    <div style={{ padding: '8px 16px 32px', fontFamily: 'var(--font-ui)' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px',
        fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-light, #e5e5e5)',
      }}>
        <HeaderCell label="제목" active={sort.key === 'title'} dir={sort.dir} onClick={() => toggleSort('title')} style={{ flex: 1, minWidth: 0 }} />
        {showOwner && <div style={{ width: 120, flexShrink: 0 }}>소유자</div>}
        {showPerm && <div style={{ width: 64, flexShrink: 0 }}>권한</div>}
        <HeaderCell label="수정일" active={sort.key === 'updated'} dir={sort.dir} onClick={() => toggleSort('updated')} style={{ width: 72, flexShrink: 0 }} />
        <div style={{ width: 28, flexShrink: 0 }} />
      </div>

      {/* 행 */}
      {sorted.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          문항이 없습니다.
        </div>
      ) : sorted.map((p) => {
        const owner = profiles?.[p.authorUid || ''];
        const role = recipientUid ? p.members?.[recipientUid] : undefined;
        const cc = commentCounts[p.id] ?? 0;
        const ac = agentCounts[p.id] ?? 0;
        return (
          <div
            key={p.id}
            onClick={() => onView(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
              borderBottom: '1px solid var(--border-light, #efefef)', cursor: 'pointer',
              opacity: busyId === p.id ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* 제목 + 배지 */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
              }}>
                {p.title || '(제목 없음)'}
              </span>
              {cc > 0 && (
                <span title="미해결 댓글" style={badgeStyle}>💬<span style={{ marginLeft: 1 }}>{cc}</span></span>
              )}
              {ac > 0 && (
                <span title="AI agent 대화" style={badgeStyle}>
                  <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>AI</span>
                  <span style={{ marginLeft: 1 }}>{ac}</span>
                </span>
              )}
              <BlockchainBadge problem={p} size={12} />
            </div>

            {/* 소유자 (received) */}
            {showOwner && (
              <div style={{ width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <Avatar photoURL={owner?.photoURL} name={owner?.nickname || owner?.displayName || '?'} size={20} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {owner?.nickname || owner?.displayName || '사용자'}
                </span>
              </div>
            )}

            {/* 권한 (sent: 사람별 변경) */}
            {showPerm && (
              <div style={{ width: 64, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {role ? (
                  <select
                    value={role}
                    disabled={busyId === p.id}
                    onChange={(e) => handleRoleChange(p, e.target.value as MemberRole)}
                    style={{
                      width: '100%', padding: '2px 4px', fontSize: 11,
                      border: '1px solid var(--border-light, #ddd)', borderRadius: 5,
                      background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
                    }}
                  >
                    <option value="commenter">댓글</option>
                    <option value="viewer">보기</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            )}

            {/* 수정일 */}
            <div style={{ width: 72, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtDate(p.updated_at)}
            </div>

            {/* 액션 */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenu({ x: r.right, y: r.bottom + 4, problem: p });
              }}
              title="더보기"
              style={{
                width: 28, flexShrink: 0, border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <IconDotsVertical size={16} />
            </button>
          </div>
        );
      })}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItemsFor(menu.problem)}
          onAction={(action) => handleMenuAction(action, menu.problem)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 2,
  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1, flexShrink: 0,
};

function HeaderCell({
  label, active, dir, onClick, style,
}: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...style, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 11.5, fontWeight: 600, color: active ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 3, padding: 0,
      }}
    >
      {label}{active && <span style={{ fontSize: 9 }}>{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );
}

function Avatar({ photoURL, name, size }: { photoURL?: string; name: string; size: number }) {
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, color: '#666', fontWeight: 600,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
