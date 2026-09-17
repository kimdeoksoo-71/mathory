'use client';

import { UserProfile } from '../../types/problem';
import { ShareScope } from '../../lib/share-scope';
import { IconChevron, IconShare, IconBazaar } from '../ui/Icons';
import SidebarSectionHeader from './SidebarSectionHeader';
import SectionSlide from './SectionSlide';

export interface ShareGroup {
  uid: string;
  count: number;
}

/** Phase 67 D7 — 공유 하위(Bazaar·받은·보낸)의 펼침 키 */
export type ShareSubKey = 'bazaar' | 'received' | 'sent';
export type ShareSubOpen = Record<ShareSubKey, boolean>;
/** 기본값 = 옛 내부 useState 초깃값(Phase 63 D32 이전부터의 "하위는 펼침") */
export const SHARE_SUB_OPEN_DEFAULT: ShareSubOpen = { bazaar: true, received: true, sent: true };

interface ShareTreeProps {
  receivedTotal: number;
  receivedGroups: ShareGroup[];
  sentGroups: ShareGroup[];
  profiles: Record<string, UserProfile>;
  activeScopeKey: string | null;
  onSelectScope: (scope: ShareScope) => void;
  /** Phase 67 D7 — 제어형. 상태는 Sidebar가 소유한다(접힘으로 이 트리가 언마운트돼도 산다) */
  open: boolean;
  onToggleOpen: () => void;
  subOpen: ShareSubOpen;
  onToggleSub: (key: ShareSubKey) => void;
  /** Phase 67 — 공유 헤더의 peek hover·chevron title(SidebarSectionHeader 규격 그대로 전달) */
  headerProps?: {
    onPointerEnter?: React.PointerEventHandler<HTMLDivElement>;
    onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
    chevronTitle?: string | null;
  };
  /** Phase 67b — 열림·닫힘 상하 슬라이드(Sidebar가 peek 중에만 참) */
  slide?: boolean;
}

/**
 * Phase 49: 좌측 `공유` 트리 — 받은(출처별)·보낸(대상별) 그룹.
 * Phase 52(2단계): 최상단 `Bazaar`(전체/내 게시물) 승격. 기존 `문항 공개`(sent-web) 제거.
 * 카테고리 [+]/DnD는 보류(카드 '공유' 버튼이 정식 경로).
 * Phase 67 D7 — **제어 컴포넌트**. 옛 내부 useState 4개(open·bazaar·received·sent)는 접힘마다 이 트리가
 *   언마운트되어 리셋됐다 → hover peek의 "직전 상태 그대로"(R8)가 불가능. 상태는 Sidebar가 들고 내려준다.
 *   기본값은 그대로(open false — Phase 63 D32 세션 내·영속 없음 / 하위 true×3).
 */
export default function ShareTree({
  receivedTotal, receivedGroups, sentGroups, profiles, activeScopeKey, onSelectScope,
  open, onToggleOpen, subOpen, onToggleSub, headerProps, slide = false,
}: ShareTreeProps) {
  const bazaarOpen = subOpen.bazaar;
  const receivedOpen = subOpen.received;
  const sentOpen = subOpen.sent;

  const sentTotal = sentGroups.reduce((s, g) => s + g.count, 0);
  const labelFor = (uid: string) => {
    const p = profiles[uid];
    return p?.nickname || p?.displayName || '사용자';
  };

  return (
    <div>
      {/* 공유 카테고리 헤더 — M6 D22: My·최근 문항과 같은 SidebarSectionHeader(동렬 최상위) */}
      <SidebarSectionHeader
        icon={<IconShare size={16} />}
        label="공유"
        open={open}
        onToggle={onToggleOpen}
        onPointerEnter={headerProps?.onPointerEnter}
        onPointerLeave={headerProps?.onPointerLeave}
        chevronTitle={headerProps?.chevronTitle}
      />

      <SectionSlide open={open} animate={slide}>
        <div>
          {/* ── Bazaar (Phase 52: 문항 공개 승격, 최상단) ── */}
          <ParentRow
            label="Bazaar"
            icon={<IconBazaar size={15} />}
            count={0}
            active={false}
            expandable
            expanded={bazaarOpen}
            onToggleExpand={() => onToggleSub('bazaar')}
            onClick={() => onSelectScope({ kind: 'bazaar', filter: 'all' })}
          />
          {bazaarOpen && (
            <>
              <SubRow
                label="전체"
                active={activeScopeKey === 'bazaar:all'}
                onClick={() => onSelectScope({ kind: 'bazaar', filter: 'all' })}
              />
              <SubRow
                label="내 게시물"
                active={activeScopeKey === 'bazaar:mine'}
                onClick={() => onSelectScope({ kind: 'bazaar', filter: 'mine' })}
              />
            </>
          )}

          {/* ── 받은 ── */}
          <ParentRow
            label="공유 받은 문항"
            /* M6 D24 — 받은 = 보낸의 180° 회전(오른쪽 위 → 왼쪽 아래). scaleX(-1)은 화살표가 위로 향해 '받는다'로 읽히지 않았다 */
            icon={<span style={{ display: 'flex', transform: 'rotate(180deg)' }}><IconShare size={15} /></span>}
            count={receivedTotal}
            active={activeScopeKey === 'received-all'}
            expandable={receivedGroups.length > 0}
            expanded={receivedOpen}
            onToggleExpand={() => onToggleSub('received')}
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
            onToggleExpand={() => onToggleSub('sent')}
            onClick={() => onToggleSub('sent')}
          />
          {sentOpen && (
            <>
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
                <div style={{ padding: '4px 12px 4px 46px', fontSize: 11.5, color: 'var(--text-muted)' }}>
                  공유한 문항이 없습니다
                </div>
              )}
            </>
          )}
        </div>
      </SectionSlide>
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
    /* Phase 63 D37 — 직속 들여쓰기 12 제거(공유 헤더와 같은 좌단). chevron 16 + 버튼 padL 4
       → 아이콘 x20 = My 트리 depth-0 폴더 아이콘과 일치 */
    <div style={{ display: 'flex', alignItems: 'center' }}>
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
        padding: '6px 12px 6px 34px', border: 'none', borderRadius: 8, /* D40 — 12px 당김(상대 단차 보존) */
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
        padding: `5px 12px 5px ${indent === 2 ? 46 : 22}px`, border: 'none', borderRadius: 8, /* D40 — 12px 당김 */
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
      background: 'var(--bg-active, #ddd)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, color: 'var(--text-secondary, #666)', fontWeight: 600,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
