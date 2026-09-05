'use client';

import { useState } from 'react';
import { Problem, UserProfile, MemberRole } from '../../types/problem';
import { updateMemberRole, removeMember } from '../../lib/membership';
import VerifyBadge from '../ui/VerifyBadge';
import BlockchainBadge from '../ui/BlockchainBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import { IconDotsVertical, IconShare, IconCopy, IconTrash, IconSave, IconComment } from '../ui/Icons';
import { useCommentCounts } from '../../hooks/useCommentCounts';
import { alertDialog, confirmDialog } from '../../lib/dialogs';

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

/** 정렬 개선(2026-09-04) — 24시간 이내 수정이면 상대 시각. 그 밖(미래 시각 포함)은 null. */
function recentLabel(d?: Date): string | null {
  if (!d) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 0) return null;
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}시간 전` : null;
}

/** 수정일 칸 — 최근 24시간 안에 저장된 문항은 날짜 대신 저장 아이콘(구름+체크) + 상대 시각.
 *  정렬 기본값이 수정일 내림차순 → 제목 오름차순으로 바뀌면서(정렬 개선 메모 2-1) "방금 만진
 *  문항이 맨 위"라는 신호가 사라졌다 — 그 신호를 자리 이동 없이 이 칸이 대신 낸다.
 *  ⚠ 아이콘 색은 상태 표시기 3:1 규약(Phase 59 G1)에 맞는 --mathory-red-dark. 텍스트는 본문색. */
function UpdatedCell({ d }: { d?: Date }) {
  const recent = recentLabel(d);
  if (!recent) {
    return <div style={{ width: 86, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(d)}</div>;
  }
  return (
    <div style={{
      width: 86, flexShrink: 0, fontSize: 12, color: 'var(--text-primary)',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <IconSave size={13} color="var(--mathory-red-dark, #BC5F3F)" />
      {recent}
    </div>
  );
}

export default function ListView({
  problems, scopeKey, mode, recipientUid, profiles, onView, onProblemAction, onChanged,
}: ListViewProps) {
  const { commentCounts, agentCounts } = useCommentCounts(problems, scopeKey);
  // 정렬 개선(2026-09-04): 기본 = 제목 오름차순. "수정하면 맨 위로 튀는" 자동 정렬을 없앴다 —
  // 최근 수정 신호는 UpdatedCell(구름+체크 + 상대 시각)이 자리 이동 없이 낸다.
  // 헤더 클릭으로 수정일 정렬을 고르는 것은 그대로 된다(자동이 아니라 수동이므로).
  const [sort, setSort] = useState<SortState>({ key: 'title', dir: 'asc' });
  const [menu, setMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...problems].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    // numeric — "문제2"가 "문제10" 앞에 오게 (GAS 파일명 정렬과 같은 옵션)
    if (sort.key === 'title') return mul * (a.title || '').localeCompare(b.title || '', 'ko', { numeric: true, sensitivity: 'base' });
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
      if (!await confirmDialog({
        title: '공유 중단', message: '이 사용자와의 공유를 중단하시겠습니까?',
        danger: true, confirmLabel: '중단',
      })) return;
      setBusyId(p.id);
      try { await removeMember(p.id, recipientUid); onChanged(); }
      catch (e) { await alertDialog(e instanceof Error ? e.message : '공유 중단 실패'); }
      finally { setBusyId(null); }
      return;
    }
    onProblemAction(action, p);
  };

  const handleRoleChange = async (p: Problem, role: MemberRole) => {
    if (!recipientUid) return;
    setBusyId(p.id);
    try { await updateMemberRole(p.id, recipientUid, role); onChanged(); }
    catch (e) { await alertDialog(e instanceof Error ? e.message : '권한 변경 실패'); }
    finally { setBusyId(null); }
  };

  const showOwner = mode === 'received';
  const showPerm = mode === 'sent';

  return (
    /* Phase 62 D8 — 좌우 인셋 0. 행 폭 = 1136px = 제목바·하위폴더 행과 같은 컨테이너 폭이라
       문항 제목이 폴더 제목과 세로로 정렬된다. 상단 8px은 아래 sticky 래퍼가 갖는다. */
    <div style={{ padding: '0 0 32px', fontFamily: 'var(--font-ui)' }}>
      {/* 제목행 — sticky (Phase 62 D7).
          ⚠ 래퍼가 필요하다: 루트 상단 패딩을 제목행 '바깥'에 두면 스크롤된 행이 그 띠를 통과하며 보인다.
             래퍼가 아이보리를 칠해 위 8px과 라운드 모서리 바깥까지 덮는다.
          ⚠ 배경색은 --bg-hover가 아니라 --block-bg다 — --bg-hover(0.8349)는 클레이(0.8674)보다
             오히려 어둡고 hover 전용 토큰이라 의미가 꼬인다. 휘도 순서는
             아이보리 0.9829 > 행(클레이) 0.8674 > 제목행 0.8276 > hover 0.7439로 단조롭다. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        background: 'var(--bg-functional)',
        padding: '8px 0 4px',
      }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '6px 14px',
        fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
        background: 'var(--block-bg)', borderRadius: 8,
      }}>
        <HeaderCell label="제목" active={sort.key === 'title'} dir={sort.dir} onClick={() => toggleSort('title')} style={{ flex: 1, minWidth: 0 }} />
        {showOwner && <div style={{ width: 120, flexShrink: 0 }}>소유자</div>}
        {showPerm && <div style={{ width: 64, flexShrink: 0 }}>권한</div>}
        <HeaderCell label="수정일" active={sort.key === 'updated'} dir={sort.dir} onClick={() => toggleSort('updated')} style={{ width: 86, flexShrink: 0 }} />
        <div style={{ width: 28, flexShrink: 0 }} />
      </div>
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
          /* Phase 62 D6 — 행 = 가로로 긴 클레이 카드. 세로 두께는 현행 유지(라운드 때문에 좌우만 +4).
             hover는 globals.css `.folder-row:hover`가 담당한다(인라인 핸들러 제거).
             ⚠ `problem-card` 클래스를 붙이지 말 것 — Phase 59a Q5 예외(content:none)가 딸려온다. */
          <div
            key={p.id}
            className="folder-row"
            onClick={() => onView(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
              background: 'var(--card-surface, var(--bg-content))',
              border: '0.5px solid var(--border-content)',
              borderRadius: 8, marginBottom: 4,
              cursor: 'pointer',
              opacity: busyId === p.id ? 0.5 : 1,
              transition: 'background .15s, box-shadow .15s',
            }}
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
                <span title="미해결 댓글" style={badgeStyle}><IconComment size={12} /><span style={{ marginLeft: 1 }}>{cc}</span></span>
              )}
              {ac > 0 && (
                <span title="AI agent 대화" style={badgeStyle}>
                  <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>AI</span>
                  <span style={{ marginLeft: 1 }}>{ac}</span>
                </span>
              )}
              <VerifyBadge problem={p} size={11} />
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

            {/* 수정일 — 최근 24시간은 저장 아이콘 + 상대 시각 (정렬 개선 2-1-③) */}
            <UpdatedCell d={p.updated_at} />

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
