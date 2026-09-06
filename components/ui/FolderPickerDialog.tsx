'use client';

import { useMemo, useState } from 'react';
import { Folder } from '../../types/problem';
import { buildFolderTree, flattenVisible } from '../../lib/folder-tree';
import { TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID } from '../../lib/firestore';
import {
  dialogOverlay, dialogBody, dialogHead, dialogContent, dialogFoot, dialogBtn,
} from './dialogStyles';
import { IconInbox } from './Icons';
import FolderGlyph from './FolderGlyph';

/* ═══════════════════════════════════════════════════════════════
   개선묶음 M2 A-4 — 문항의 폴더 이동 픽커 (D6′ · Q2)

   ⚠ 이것은 **문항**을 옮기는 픽커다. 폴더 재부모화(`AppShell.handleMoveFolder`)가
     아니다 — 그쪽은 사이드바 DnD로만 하고 prompt를 쓰지 않는다.
     따라서 **순환(자기 자손으로 이동) 방지가 필요 없다**: 문항에는 자손이 없다.
     v1 계획서가 이 둘을 섞어 "픽커가 순환을 원천 차단한다"고 적었던 것은 오류다.

   대체하는 것: `AppShell.tsx`의 "이동할 폴더 이름 (…)" prompt.
   그 방식의 실제 결함이 픽커의 요건이 된다 —
     ① 이름 문자열 매칭이라 **동명 폴더가 있으면 엉뚱한 곳으로 간다** → 계층으로 고른다
     ② 오타를 내면 아무 일도 안 일어난다(무음 실패) → 목록에서 고르므로 불가능
     ③ '미지정'(폴더 없음)으로 되돌릴 방법이 없었다 → 첫 항목으로 제공
     ④ 휴지통이 후보로 보였다 → 제외(삭제는 휴지통 메뉴가 한다)
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = 'var(--mathory-red-dark, #BC5F3F)';

export interface FolderPickerProps {
  folders: Folder[];
  /** 지금 이 문항이 들어 있는 폴더. 그 행은 비활성 + '현재 위치'로 표시한다. */
  currentFolderId?: string | null;
  title?: string;
  onPick: (folderId: string | null) => void;
  onCancel: () => void;
}

export default function FolderPickerDialog({
  folders, currentFolderId, title = '폴더 이동', onPick, onCancel,
}: FolderPickerProps) {
  // 휴지통·미지정은 실제 폴더 문서가 아니라 가상 폴더다 — 트리에서 제외한다.
  const real = useMemo(
    () => folders.filter((f) => f.id !== TRASH_FOLDER_ID && f.id !== UNASSIGNED_FOLDER_ID),
    [folders],
  );
  const rows = useMemo(
    () => flattenVisible(buildFolderTree(real), new Set()),
    [real],
  );

  const cur = currentFolderId || null;
  const [picked, setPicked] = useState<string | null>(cur);

  const rowStyle = (active: boolean, disabled: boolean, depth: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '7px 10px', paddingLeft: 10 + depth * 14,
    border: 'none', borderRadius: 4, textAlign: 'left',
    fontSize: 13, fontFamily: 'var(--font-ui)',
    fontWeight: active ? 700 : 500,
    background: active ? 'rgba(188,95,63,0.10)' : 'transparent',
    color: disabled ? 'var(--text-faint, #b8afa4)'
      : active ? ACCENT : 'var(--text-primary, #222)',
    cursor: disabled ? 'default' : 'pointer',
  });

  // M5 N10 — 폴더 행에 FolderGlyph(사용자 아이콘 반영), 미지정 행은 IconInbox(FolderView와 동일)
  const row = (folder: Folder | null, name: string, depth: number) => {
    const id = folder ? folder.id : null;
    const isCurrent = id === cur;
    return (
      <button
        key={id ?? '__none__'}
        onClick={() => { if (!isCurrent) setPicked(id); }}
        disabled={isCurrent}
        style={rowStyle(picked === id, isCurrent, depth)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {folder ? <FolderGlyph folder={folder} size={14} /> : <IconInbox size={14} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {isCurrent && (
          <span style={{ fontSize: 11, color: 'var(--text-faint, #b8afa4)', flexShrink: 0 }}>현재 위치</span>
        )}
      </button>
    );
  };

  return (
    <div style={dialogOverlay} onClick={onCancel} role="presentation">
      <div
        style={{ ...dialogBody, width: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={dialogHead}>{title}</div>

        <div style={{ ...dialogContent, whiteSpace: 'normal', padding: 8 }}>
          {row(null, '미지정 (폴더 없음)', 0)}
          {rows.length > 0 && (
            <div style={{ height: 1, background: 'var(--border-light, #eee)', margin: '6px 8px' }} />
          )}
          {rows.map((n) => row(n.folder, n.folder.name, n.depth))}
          {rows.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              만들어 둔 폴더가 없습니다.
            </div>
          )}
        </div>

        <div style={dialogFoot}>
          <button onClick={onCancel} style={dialogBtn('ghost')}>취소</button>
          <button
            onClick={() => onPick(picked)}
            disabled={picked === cur}
            style={dialogBtn('primary', picked === cur)}
          >
            이동
          </button>
        </div>
      </div>
    </div>
  );
}
