'use client';

/**
 * Phase 62 D6~D8 — 행 = 가로로 긴 클레이 카드, 행 폭 = 제목바 컨테이너 폭(1136).
 * Phase 63 S2(D42) — 칼럼 헤더(ListHeader)는 제목바 행 2(스크롤 밖)에서 렌더된다.
 * Phase 63 S4(D5) — 본문은 grid + subgrid 행: 열 폭의 진실은 본문 grid 루트 하나이고
 *   헤더는 실측 템플릿(D43, FolderView가 getComputedStyle로 읽어 내림)을 받는다.
 *   좌우 인셋 14 = 가장자리 2px 스페이서 트랙 + columnGap 12 (subgrid에 컨테이너 패딩을
 *   주면 첫·끝 트랙이 부모와 어긋난다 — buildGridTemplate 주석 참조).
 */

import { useRef, useState } from 'react';
import { Problem, Folder, UserProfile, MemberRole } from '../../types/problem';
import { updateMemberRole, removeMember } from '../../lib/membership';
import VerifyBadge from '../ui/VerifyBadge';
import BlockchainBadge from '../ui/BlockchainBadge';
import ContextMenu, { ContextMenuAction } from '../ui/ContextMenu';
import { IconDotsVertical, IconShare, IconCopy, IconTrash, IconSave, IconComment, IconFolder, IconFolderMove } from '../ui/Icons';
import { TwemojiImg } from '../editor/EmojiPickerPanel';
import { useCommentCounts } from '../../hooks/useCommentCounts';
import { alertDialog, confirmDialog } from '../../lib/dialogs';
import { Draggable, Droppable, dndId, DROP_RING, DROP_TINT } from '../ui/dnd';
import {
  type ListPrefs, LIST_COLUMNS, MIN_COL_WIDTH,
  columnLabel, visibleColumns, buildGridTemplate,
  movedOrder, verifyRank, blockchainRank,
} from '../../lib/listColumns';

/* Phase 63 D2 — 'trash' 추가: 휴지통도 리스트가 기본이 되면서 전용 메뉴(복원·영구 삭제)를
   ListView가 흡수했다(카드 메뉴 FolderView cardMenuItems의 isTrash 갈래와 동일 구성). */
export type ListMode = 'my' | 'received' | 'sent' | 'trash';

/** Phase 63 D11·D15 — 폴더 행 데이터. count는 직속 문항 수, updated는 하위 트리 문항의
 *  max(updated_at)(비면 폴더 문서의 updated_at → created_at) — 계산은 FolderView가 한다. */
export interface FolderRowData {
  folder: Folder;
  count: number;
  updated?: Date;
}

interface ListViewProps {
  problems: Problem[];
  scopeKey: string;
  mode: ListMode;
  /** Phase 63 S4(D9) — 칼럼·정렬 prefs. FolderView 소유(useListPrefs — 폴더별 저장) */
  prefs: ListPrefs;
  /** Phase 63 D43 — 본문 grid 루트 ref. FolderView가 실측해 헤더 템플릿으로 쓴다 */
  bodyGridRef?: React.Ref<HTMLDivElement>;
  /** Phase 63 D11 — 문항 행 위에 그릴 하위 폴더 행(일반 폴더 리스트 전용) */
  folderRows?: FolderRowData[];
  onSelectFolder?: (f: Folder) => void;
  /** Phase 63 D24 — 이 uid 소유 문항만 드래그 가능. null이면 드래그 전부 비활성(공유 뷰) */
  dragUid?: string | null;
  /** Phase 63 D16(S5) — 다중 선택. 상태는 FolderView 소유(선택 바가 행 1에 살기 때문).
   *  onSelectionChange가 없으면 체크박스 열 자체가 없다(공유 뷰) */
  selectedIds?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  /** sent 모드: 이 뷰가 묶인 수신자 uid (권한 변경·공유 중단 대상) */
  recipientUid?: string;
  /** received 모드: 소유자 프로필 (uid → profile) */
  profiles?: Record<string, UserProfile>;
  onView: (p: Problem) => void;
  onProblemAction: (action: string, p: Problem) => void;
  onChanged: () => void;
}

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
 *  ⚠ 아이콘 색은 상태 표시기 3:1 규약(Phase 59 G1)에 맞는 --mathory-red-dark. 텍스트는 본문색.
 *  Phase 63 S4 — 고정 폭 86 삭제: 폭은 grid 트랙(max-content)이 소유한다(A-8 사본 해소). */
function UpdatedCell({ d }: { d?: Date }) {
  const recent = recentLabel(d);
  if (!recent) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(d)}</div>;
  }
  return (
    <div style={{
      fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <IconSave size={13} color="var(--mathory-red-dark, #BC5F3F)" />
      {recent}
    </div>
  );
}

export default function ListView({
  problems, scopeKey, mode, prefs, bodyGridRef, folderRows = [], onSelectFolder, dragUid = null,
  selectedIds, onSelectionChange,
  recipientUid, profiles, onView, onProblemAction, onChanged,
}: ListViewProps) {
  const { commentCounts, agentCounts } = useCommentCounts(problems, scopeKey);
  const [menu, setMenu] = useState<{ x: number; y: number; problem: Problem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Shift-클릭 범위 앵커(D16 — 범위는 체크박스 위에서만)
  const lastCheckRef = useRef<string | null>(null);

  const selectable = !!onSelectionChange;
  const sort = prefs.sort;
  const visible = visibleColumns(prefs, mode);
  const template = buildGridTemplate(visible, prefs.widths, selectable);
  // 트랙 번호: 1 = 좌 스페이서, (선택 시 2 = 체크박스), lead+2+i = visible[i],
  // lead+len+2 = ⋮/설정, 마지막 = 우 스페이서
  const lead = selectable ? 1 : 0;
  const trackOf = (id: string) => 2 + lead + visible.indexOf(id);

  /** 서열 칼럼의 정렬 값(D4 — 규칙은 listColumns, 필드 접근은 여기) */
  const rankOf = (p: Problem, key: string): number => {
    switch (key) {
      case 'blockchain': {
        const latest = p.blockchain?.latest;
        const hasTx = !!latest?.txHash;
        const modified = hasTx && !!p.copyright?.contentHash && p.copyright.contentHash !== latest!.contentHash;
        return blockchainRank(hasTx, modified);
      }
      case 'verify_problem': return verifyRank(p.verification?.problem?.verdict, p.verification?.problem?.stale);
      case 'verify_solution': return verifyRank(p.verification?.solution?.verdict, p.verification?.solution?.stale);
      case 'agent': return agentCounts[p.id] ?? 0;
      case 'comments': return commentCounts[p.id] ?? 0;
      default: return 0;
    }
  };

  const byTitle = (a: Problem, b: Problem) =>
    // numeric — "문제2"가 "문제10" 앞에 오게 (GAS 파일명 정렬과 같은 옵션)
    (a.title || '').localeCompare(b.title || '', 'ko', { numeric: true, sensitivity: 'base' });

  const sorted = [...problems].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    let v: number;
    if (sort.key === 'title') v = byTitle(a, b);
    else if (sort.key === 'updated') v = (a.updated_at?.getTime() || 0) - (b.updated_at?.getTime() || 0);
    else v = rankOf(a, sort.key) - rankOf(b, sort.key);
    // D10 — 동률은 제목 오름차순 tie-break(서열 칼럼이 사실상 무순서가 되는 것 방지)
    return mul * v || byTitle(a, b);
  });

  // Phase 63 D14 — 폴더 정렬은 폴더끼리만(문항과 섞이지 않는다). title·updated에만 반응.
  const sortedFolders = [...folderRows].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'updated') return mul * ((a.updated?.getTime() || 0) - (b.updated?.getTime() || 0));
    const v = a.folder.name.localeCompare(b.folder.name, 'ko', { numeric: true, sensitivity: 'base' });
    return sort.key === 'title' ? mul * v : v; // 그 외 키면 이름순(order 대신 — 이름이 곧 안정 기준)
  });

  /** 체크박스 토글(D16) — Shift면 마지막 체크 앵커와의 범위를 클릭 대상의 새 상태로 통일 */
  const handleCheck = (id: string, shift: boolean) => {
    if (!onSelectionChange) return;
    const prev = selectedIds ?? new Set<string>();
    const next = new Set(prev);
    const anchor = lastCheckRef.current;
    if (shift && anchor && anchor !== id) {
      const ids = sorted.map((p) => p.id);
      const a = ids.indexOf(anchor);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const on = !prev.has(id);
        for (let k = Math.min(a, b); k <= Math.max(a, b); k++) {
          if (on) next.add(ids[k]); else next.delete(ids[k]);
        }
      }
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    lastCheckRef.current = id;
    onSelectionChange(next);
  };

  const menuItemsFor = (p: Problem): ContextMenuAction[] => {
    if (mode === 'trash') return [
      { label: '복원', icon: <IconCopy size={14} />, action: 'restore' },
      { label: '영구 삭제', icon: <IconTrash size={14} />, action: 'delete', danger: true },
    ];
    if (mode === 'received') return [
      { label: '공유 받기 해제', icon: <IconShare size={14} />, action: 'leave_shared', danger: true },
    ];
    if (mode === 'sent') return [
      { label: '이 사용자와 공유 중단', icon: <IconShare size={14} />, action: 'stop_share', danger: true },
    ];
    return [
      { label: '공유', icon: <IconShare size={14} />, action: 'share' },
      { label: '사본 만들기', icon: <IconCopy size={14} />, action: 'duplicate' },
      // Phase 63 D17(A-21) — '폴더 변경'은 ContextMenu 기본 메뉴엔 있었는데 이 자체 메뉴가
      // 덮어써 빠져 있었다(사이드바 최근 문항 ⋮에만 노출되던 것을 여기도)
      { label: '폴더 변경', icon: <IconFolderMove size={14} />, action: 'move' },
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

  /** 문항 행의 칼럼별 셀 내용. 값이 없으면 빈 셀(배지 컴포넌트가 null 반환) */
  const cellFor = (id: string, p: Problem) => {
    switch (id) {
      case 'title':
        return (
          <span style={{
            fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
          }}>
            {p.title || '(제목 없음)'}
          </span>
        );
      case 'blockchain':
        return <BlockchainBadge problem={p} size={12} />;
      case 'verify_problem':
        return <VerifyBadge problem={p} kinds={['problem']} size={11} />;
      case 'verify_solution':
        return <VerifyBadge problem={p} kinds={['solution']} size={11} />;
      case 'agent': {
        // 덕수 지시(T5 후속) — 셀에는 숫자만("Agent" 라벨은 헤더가 이미 말한다)
        const ac = agentCounts[p.id] ?? 0;
        return ac > 0 ? <span title="AI agent 대화" style={badgeStyle}>{ac}</span> : null;
      }
      case 'comments': {
        const cc = commentCounts[p.id] ?? 0;
        return cc > 0 ? (
          <span title="미해결 댓글" style={badgeStyle}><IconComment size={12} /><span style={{ marginLeft: 1 }}>{cc}</span></span>
        ) : null;
      }
      case 'owner': {
        const owner = profiles?.[p.authorUid || ''];
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Avatar photoURL={owner?.photoURL} name={owner?.nickname || owner?.displayName || '?'} size={20} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {owner?.nickname || owner?.displayName || '사용자'}
            </span>
          </div>
        );
      }
      case 'perm': {
        const role = recipientUid ? p.members?.[recipientUid] : undefined;
        return (
          <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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
        );
      }
      case 'updated':
        return <UpdatedCell d={p.updated_at} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={bodyGridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: template,
        columnGap: 12,
        padding: '0 0 72px', // 하단 72 = 바닥 정렬 슬랙(한 행 피치 이상 — FolderView 정렬 주석 참조)
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* 상단 8px 아이보리 마스크(sticky) — 행 간격(4px)보다 넓은 정렬 여백(8px) 틈으로
          이전 행 꼬리가 비치는 것을 가린다(Phase 62 D7 래퍼의 "위 8px 덮기"를 띠만 되살림).
          흐름 높이 8이 첫 행 위치·JS 정렬 목표선(SNAP_TOP_GAP 8)을 공급한다. */}
      <div aria-hidden style={{ gridColumn: '1 / -1', position: 'sticky', top: 0, height: 8, background: 'var(--bg-functional)', zIndex: 1 }} />

      {/* 유령 라벨 행(D5) — 자동폭(max-content) 트랙이 "헤더 라벨 폭"까지 포함하게 한다.
          헤더는 별도 grid(실측 템플릿 소비자)라, 이 장치가 없으면 본문 트랙이 라벨보다
          좁게 실측돼 헤더 라벨이 잘린다. 높이 0·불가시 — 화면·스냅·간격에 영향 없음.
          ' ▲'는 정렬 화살표 자리 몫. 사용자 지정 px 트랙에는 영향 없다(고정 트랙이 이긴다). */}
      <div aria-hidden style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid', columnGap: 12, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
        {visible.map((id) => (id === 'title' ? null : (
          <span key={id} style={{ gridColumn: trackOf(id), fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)' }}>
            {columnLabel(id)} ▲
          </span>
        )))}
      </div>

      {/* ═══ 폴더 행 (Phase 63 D11~D13) — 문항 행 위. 테두리·클레이 없음(아이보리 = "문항 밖"),
          클릭 = 진입, hover 이름 밑줄은 globals.css `.list-folder-row`. 드롭 타깃(D25) +
          [data-snap-row] 스냅 참여(D15′). 셀은 제목·수정일 두 트랙에만 명시 배치(D12). */}
      {sortedFolders.map(({ folder: f, count, updated }) => (
        <Droppable key={f.id} id={dndId.folderRow(f.id)} data={{ type: 'folder', folder: f }}>
          {({ setNodeRef, isOver }) => (
            <div
              ref={setNodeRef}
              className="list-folder-row"
              data-snap-row=""
              onClick={() => onSelectFolder?.(f)}
              style={{
                gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid', columnGap: 12,
                alignItems: 'center',
                padding: '9px 0', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                background: isOver ? DROP_TINT : 'transparent',
                boxShadow: isOver ? DROP_RING : 'none',
              }}
            >
              <div style={{ gridColumn: trackOf('title'), minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {f.icon ? <TwemojiImg emoji={f.icon} label={f.name} size={16} /> : <IconFolder size={16} />}
                </span>
                <span className="list-folder-name" style={{
                  fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                }}>
                  {f.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>({count})</span>
              </div>
              <div style={{ gridColumn: trackOf('updated'), fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {fmtDate(updated)}
              </div>
            </div>
          )}
        </Droppable>
      ))}

      {/* 행 */}
      {sorted.length === 0 && sortedFolders.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {/* D2 — 카드 빈 상태(FolderView)와 같은 문구 체계 */}
          {mode === 'trash' ? '휴지통이 비어 있습니다.'
            : mode === 'received' ? '공유 받은 문항이 없습니다.'
            : mode === 'sent' ? '문항이 없습니다.'
            : '이 폴더에 문항이 없습니다.'}
        </div>
      ) : sorted.map((p, i) => {
        return (
          /* Phase 62 D6 — 행 = 가로로 긴 클레이 카드. hover는 globals.css `.folder-row:hover`.
             ⚠ `problem-card` 클래스 금지 — Phase 59a Q5 예외(content:none)가 딸려온다.
             Phase 63 D24 — 드래그 소스(내 소유·비공유 뷰). 클릭 우선이라 커서 pointer 유지.
             Phase 63 D33 — zebra는 렌더 인덱스 홀짝(폴더 행·마스크는 세지 않는다). */
          <Draggable
            key={p.id}
            id={dndId.problemRow(p.id)}
            // D18 Finder 의미론 — 끌기 시작한 행이 선택에 있으면 선택 전체, 아니면 그 한 건
            data={selectedIds?.has(p.id) && selectedIds.size > 1
              ? { type: 'problems', problems: problems.filter((x) => selectedIds.has(x.id)) }
              : { type: 'problem', problem: p }}
            disabled={!dragUid || p.authorUid !== dragUid}
          >
            {({ setNodeRef, attributes, listeners, isDragging }) => {
            // D30 — 전역 KeyboardSensor의 onKeyDown 활성자는 제외(카드와 같은 규약)
            const { onKeyDown: _kbdActivator, ...pointerListeners } = (listeners ?? {}) as Record<string, unknown>;
            return (
          <div
            ref={setNodeRef}
            {...attributes}
            {...pointerListeners}
            className={`folder-row${i % 2 === 1 ? ' is-alt' : ''}`}
            data-snap-row=""
            onClick={() => onView(p)}
            style={{
              gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'subgrid', columnGap: 12,
              alignItems: 'center',
              padding: '9px 0',
              background: 'var(--card-surface, var(--bg-content))',
              border: '0.5px solid var(--border-content)',
              borderRadius: 8, marginBottom: 4,
              cursor: 'pointer',
              opacity: isDragging ? 0.4 : busyId === p.id ? 0.5 : 1,
              transition: 'background .15s, box-shadow .15s',
            }}
          >
            {/* 체크박스 열(D16) — 행 클릭(onView)·드래그 시작과 분리(전파 차단) */}
            {selectable && (
              <div
                style={{ gridColumn: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds?.has(p.id) ?? false}
                  onClick={(e) => handleCheck(p.id, e.shiftKey)}
                  onChange={() => {}}
                  style={{ accentColor: 'var(--mathory-red, #D97757)', cursor: 'pointer' }}
                />
              </div>
            )}

            {visible.map((id) => (
              /* overflow hidden — 사용자가 트랙을 좁혔을 때 셀 내용이 옆 칸으로 넘치지 않게 */
              <div key={id} style={{ gridColumn: trackOf(id), minWidth: 0, overflow: 'hidden' }}>
                {cellFor(id, p)}
              </div>
            ))}

            {/* 액션 — ⋮ 트랙 */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenu({ x: r.right, y: r.bottom + 4, problem: p });
              }}
              title="더보기"
              style={{
                gridColumn: visible.length + lead + 2,
                border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <IconDotsVertical size={16} />
            </button>
          </div>
            );
            }}
          </Draggable>
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

/* ═══ Phase 63 S2(D42)·S4 — 칼럼 헤더 카드 ═══
   FolderView 제목바 행 2(리스트 모드)에서 렌더 — 스크롤 밖이라 고무줄 오버스크롤에 부동.
   시각은 Phase 62 D7 그대로(--block-bg · radius 8). 템플릿은 본문 실측값(D43)을 받고,
   도착 전 한 프레임은 같은 산식(buildGridTemplate)의 폴백이라 어긋나도 즉시 수렴한다. */
export function ListHeader({ mode, prefs, template, checkbox = false, selectAll, onToggleSort, onPrefsChange }: {
  mode: ListMode;
  prefs: ListPrefs;
  /** 본문 grid의 실측 gridTemplateColumns(px 목록). null이면 자체 산식 폴백 */
  template: string | null;
  /** 본문에 체크박스 열(D16)이 있는가 — 트랙 오프셋을 맞춘다 */
  checkbox?: boolean;
  /** T6 검수 반영(덕수) — 체크박스 트랙의 전체선택. 일부 선택이면 중간 상태 */
  selectAll?: { checked: boolean; indeterminate: boolean; onToggle: () => void };
  onToggleSort: (key: string) => void;
  onPrefsChange: (mutate: (p: ListPrefs) => ListPrefs) => void;
}) {
  const visible = visibleColumns(prefs, mode);
  const lead = checkbox ? 1 : 0;
  const sortableIds = new Set(['title', 'updated', ...LIST_COLUMNS.filter((c) => c.kind === 'optional').map((c) => c.id)]);
  const adjustable = new Set([...LIST_COLUMNS.filter((c) => c.kind === 'optional').map((c) => c.id), 'updated']);

  const resize = (id: string, w: number) => onPrefsChange((p) => ({ ...p, widths: { ...p.widths, [id]: w } }));
  const resetWidth = (id: string) => onPrefsChange((p) => {
    const widths = { ...p.widths };
    delete widths[id];
    return { ...p, widths };
  });

  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'grid',
      gridTemplateColumns: template ?? buildGridTemplate(visible, prefs.widths, checkbox),
      columnGap: 12, alignItems: 'center',
      padding: '6px 0',
      fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
      background: 'var(--block-bg)', borderRadius: 8,
      fontFamily: 'var(--font-ui)',
    }}>
      {/* 전체선택(T6 검수 반영) — 체크박스 트랙(2번). 일부 선택 = 중간 상태(indeterminate) */}
      {checkbox && selectAll && (
        <div style={{ gridColumn: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="checkbox"
            ref={(el) => { if (el) el.indeterminate = selectAll.indeterminate; }}
            checked={selectAll.checked}
            onChange={selectAll.onToggle}
            title="전체 선택"
            style={{ accentColor: 'var(--mathory-red, #D97757)', cursor: 'pointer' }}
          />
        </div>
      )}
      {visible.map((id, i) => (
        <div key={id} style={{ gridColumn: 2 + lead + i, position: 'relative', minWidth: 0, display: 'flex', alignItems: 'center' }}>
          {sortableIds.has(id) ? (
            <button
              onClick={() => onToggleSort(id)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 11.5, fontWeight: 600,
                color: prefs.sort.key === id ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 3, padding: 0,
                minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
              }}
            >
              {columnLabel(id)}
              {prefs.sort.key === id && <span style={{ fontSize: 9 }}>{prefs.sort.dir === 'asc' ? '▲' : '▼'}</span>}
            </button>
          ) : (
            <span style={{ whiteSpace: 'nowrap' }}>{columnLabel(id)}</span>
          )}
          {adjustable.has(id) && (
            <ColResizeHandle id={id} onResize={resize} onReset={resetWidth} />
          )}
        </div>
      ))}
      {/* ⋮ 트랙 = 칼럼 설정(D8 — 헤더 드래그 재배열 대신 팝오버 체크박스 + ▲▼) */}
      <ColumnSettings gridColumn={visible.length + lead + 2} prefs={prefs} onPrefsChange={onPrefsChange} />
    </div>
  );
}

/** 폭 조절 핸들(D7) — 시각 1px 선 + 히트 ±4px. setPointerCapture(P7)·touchAction none.
 *  더블클릭 = 자동폭 복귀(Q3). 헤더 셀(position:relative)의 우변에 겹친다. */
function ColResizeHandle({ id, onResize, onReset }: {
  id: string;
  onResize: (id: string, w: number) => void;
  onReset: (id: string) => void;
}) {
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  return (
    <span
      onPointerDown={(e) => {
        e.stopPropagation(); e.preventDefault();
        const cell = (e.currentTarget as HTMLElement).parentElement;
        if (!cell) return;
        dragRef.current = { startX: e.clientX, startW: cell.getBoundingClientRect().width };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        onResize(id, Math.max(MIN_COL_WIDTH, Math.round(d.startW + (e.clientX - d.startX))));
      }}
      onPointerUp={(e) => {
        dragRef.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onDoubleClick={(e) => { e.stopPropagation(); onReset(id); }}
      title="드래그: 폭 조절 · 더블클릭: 자동 폭"
      style={{
        position: 'absolute', top: -6, bottom: -6, right: -10, width: 9,
        cursor: 'col-resize', touchAction: 'none', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ width: 1, alignSelf: 'stretch', margin: '2px 0', background: 'var(--border-light)' }} />
    </span>
  );
}

/** 칼럼 설정 팝오버(D8) — optional 5개 체크박스 + ▲▼. FolderIconPicker의 fixed 팝오버 문법. */
function ColumnSettings({ gridColumn, prefs, onPrefsChange }: {
  gridColumn: number;
  prefs: ListPrefs;
  onPrefsChange: (mutate: (p: ListPrefs) => ListPrefs) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos((prev) => (prev ? null : { x: r.right, y: r.bottom + 4 }));
  };

  const toggleHidden = (id: string) => onPrefsChange((p) => ({
    ...p,
    hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id],
  }));
  const move = (id: string, delta: -1 | 1) => onPrefsChange((p) => ({ ...p, order: movedOrder(p.order, id, delta) }));

  const WIDTH = 210;
  const left = pos ? Math.max(8, Math.min(pos.x - WIDTH, (typeof window !== 'undefined' ? window.innerWidth : 9999) - WIDTH - 8)) : 0;

  return (
    <>
      <button
        onClick={open}
        title="칼럼 설정"
        style={{
          gridColumn,
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        }}
      >
        <IconDotsVertical size={14} />
      </button>
      {pos && (
        <>
          {/* 바깥 클릭 닫기 — fixed 덮개(팝오버 아래) */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} onMouseDown={() => setPos(null)} />
          <div
            ref={panelRef}
            style={{
              position: 'fixed', left, top: pos.y, zIndex: 10000, width: WIDTH,
              background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #ddd)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px 0',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <div style={{ padding: '2px 12px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              칼럼 보이기 · 순서
            </div>
            {prefs.order.map((id, i) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!prefs.hidden.includes(id)}
                    onChange={() => toggleHidden(id)}
                    // T5 검수 반영 — 브라우저 기본 파랑 대신 Mathory 로고 레드(덕수 지정)
                    style={{ accentColor: 'var(--mathory-red, #D97757)' }}
                  />
                  {columnLabel(id)}
                </label>
                <button
                  onClick={() => move(id, -1)}
                  disabled={i === 0}
                  style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--text-faint)' : 'var(--text-muted)', padding: '0 2px', fontSize: 11 }}
                >▲</button>
                <button
                  onClick={() => move(id, 1)}
                  disabled={i === prefs.order.length - 1}
                  style={{ border: 'none', background: 'none', cursor: i === prefs.order.length - 1 ? 'default' : 'pointer', color: i === prefs.order.length - 1 ? 'var(--text-faint)' : 'var(--text-muted)', padding: '0 2px', fontSize: 11 }}
                >▼</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
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
