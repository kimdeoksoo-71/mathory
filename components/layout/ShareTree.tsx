'use client';

import { useState } from 'react';
import { UserProfile } from '../../types/problem';
import { ShareScope } from '../../lib/share-scope';
import { IconChevron, IconShare } from '../ui/Icons';

export interface ShareGroup {
  uid: string;
  count: number;
}

interface ShareTreeProps {
  receivedTotal: number;
  receivedGroups: ShareGroup[];
  sentGroups: ShareGroup[];
  profiles: Record<string, UserProfile>;
  activeScopeKey: string | null;
  onSelectScope: (scope: ShareScope) => void;
}

/**
 * Phase 49: 좌측 `공유` 트리 — 받은(출처별)·보낸(대상별) 그룹 + 웹 전체공개 노드.
 * 카테고리 [+]/DnD는 보류(카드 '공유' 버튼이 정식 경로).
 */
export default function ShareTree({
  receivedTotal, receivedGroups, sentGroups, profiles, activeScopeKey, onSelectScope,
}: ShareTreeProps) {
  const [open, setOpen] = useState(true);
  const [receivedOpen, setReceivedOpen] = useState(true);
  const [sentOpen, setSentOpen] = useState(true);

  const sentTotal = sentGroups.reduce((s, g) => s + g.count, 0);
  const labelFor = (uid: string) => {
    const p = profiles[uid];
    return p?.nickname || p?.displayName || '사용자';
  };

  return (
    <div>
      {/* 공유 카테고리 헤더 — My 헤더와 동일 스타일(동렬 최상위) */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center',
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)',
            letterSpacing: 0.3, fontFamily: 'var(--font-ui)', padding: '4px 0',
            textAlign: 'left',
          }}
        >
          공유
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? '접기' : '펼치기'}
          style={{
            border: 'none', background: 'none', cursor: 'pointer', display: 'flex',
            color: 'var(--text-muted)', padding: 2,
            transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .15s',
          }}
        >
          <IconChevron size={12} />
        </button>
      </div>

      {open && (
        <div>
          {/* ── 받은 ── */}
          <ParentRow
            label="공유 받은 문항"
            icon={<span style={{ display: 'flex', transform: 'scaleX(-1)' }}><IconShare size={15} /></span>}
            count={receivedTotal}
            active={activeScopeKey === 'received-all'}
            expandable={receivedGroups.length > 0}
            expanded={receivedOpen}
            onToggleExpand={() => setReceivedOpen((v) => !v)}
            onClick={() => onSelectScope({ kind: 'received-all' })}
          />
          {receivedOpen && receivedGroups.map((g) => (
            <PersonRow
              key={g.uid}
              label={labelFor(g.uid)}
              photoURL={profiles[g.uid]?.photoURL}
              count={g.count}
              active={activeScopeKey === `received-by:${g.uid}`}
              onClick={() => onSelectScope({ kind: 'received-by', uid: g.uid })}
            />
          ))}

          {/* ── 보낸 ── */}
          <ParentRow
            label="공유 보낸 문항"
            icon={<IconShare size={15} />}
            count={sentTotal}
            active={false}
            expandable
            expanded={sentOpen}
            onToggleExpand={() => setSentOpen((v) => !v)}
            onClick={() => setSentOpen((v) => !v)}
          />
          {sentOpen && (
            <>
              <SubRow
                label="웹에 공개"
                active={activeScopeKey === 'sent-web'}
                onClick={() => onSelectScope({ kind: 'sent-web' })}
              />
              <SubRow label="개인" muted />
              {sentGroups.map((g) => (
                <PersonRow
                  key={g.uid}
                  label={labelFor(g.uid)}
                  photoURL={profiles[g.uid]?.photoURL}
                  count={g.count}
                  indent={2}
                  active={activeScopeKey === `sent-by:${g.uid}`}
                  onClick={() => onSelectScope({ kind: 'sent-by', uid: g.uid })}
                />
              ))}
              {sentGroups.length === 0 && (
                <div style={{ padding: '4px 12px 4px 58px', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  공유한 문항이 없습니다
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function rowBg(active: boolean) {
  return active ? 'var(--bg-active)' : 'transparent';
}

function ParentRow({
  label, icon, count, active, expandable, expanded, onToggleExpand, onClick,
}: {
  label: string; icon: React.ReactNode; count: number; active: boolean;
  expandable: boolean; expanded: boolean; onToggleExpand: () => void; onClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
        style={{
          width: 16, flexShrink: 0, border: 'none', background: 'transparent',
          cursor: expandable ? 'pointer' : 'default', display: 'flex', alignItems: 'center',
          color: 'var(--text-muted)', padding: 0,
          visibility: expandable ? 'visible' : 'hidden',
          transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .15s',
        }}
      >
        <IconChevron size={11} />
      </button>
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
          padding: '7px 12px 7px 4px', border: 'none', borderRadius: 8, cursor: 'pointer',
          background: rowBg(active),
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: 13, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ flexShrink: 0, display: 'flex', opacity: active ? 1 : 0.75 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {count > 0 && <Badge n={count} />}
      </button>
    </div>
  );
}

function SubRow({ label, active, muted, onClick }: { label: string; active?: boolean; muted?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        display: 'flex', alignItems: 'center', width: '100%',
        padding: '6px 12px 6px 46px', border: 'none', borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default', background: rowBg(!!active),
        color: muted ? 'var(--text-muted)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12.5, fontWeight: active ? 700 : muted ? 600 : 500, fontFamily: 'var(--font-ui)',
      }}
      onMouseEnter={(e) => { if (onClick && !active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (onClick && !active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function PersonRow({
  label, photoURL, count, active, indent = 1, onClick,
}: {
  label: string; photoURL?: string; count: number; active: boolean; indent?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: `5px 12px 5px ${indent === 2 ? 58 : 34}px`, border: 'none', borderRadius: 8,
        cursor: 'pointer', background: rowBg(active),
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Avatar photoURL={photoURL} name={label} size={20} />
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count > 0 && <Badge n={count} />}
    </button>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--badge-bg)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
      {n}
    </span>
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
