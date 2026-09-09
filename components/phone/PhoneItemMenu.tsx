'use client';

import { useState } from 'react';
import { Folder, Problem } from '../../types/problem';
import BottomSheet from '../ui/BottomSheet';
import FolderPickerDialog from '../ui/FolderPickerDialog';
import { moveProblemToFolder } from '../../lib/firestore';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 §6-7 — 문항 행 ⋯ 시트: 공유 링크 복사 · 편집(비활성) · 폴더 이동.
   ⚠ '편집'은 비활성이 사양이다(E4 — 폰 편집 없음). 지우지 말 것 — 조용히 없는 것은
     "구현이 안 됐다"와 구별되지 않는다(61b 게이트 로깅 규약과 같은 정신).
   ⚠ 폴더 픽커는 FolderPickerDialog 공용(Z_DIALOG 10500 > Z_SHEET 9500 — 시트 위에 뜬다).
   ═══════════════════════════════════════════════════════════════ */

export default function PhoneItemMenu({ problem, folders, open, onClose, onMoved }: {
  problem: Problem | null;
  folders: Folder[];
  open: boolean;
  onClose: () => void;
  /** 폴더 이동 성공 후 목록 재로드 */
  onMoved: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!problem) return null;

  const publicUrl = problem.visibility === 'public'
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${problem.id}`
    : null;

  const copyLink = async () => {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); } catch { /* 무시 */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <BottomSheet open={open} height="auto" onClose={onClose} title={problem.title || '(제목 없음)'}>
        <div style={{ padding: '0 8px 12px', fontFamily: 'var(--font-ui)' }}>
          {publicUrl && (
            <button onClick={copyLink} style={rowStyle}>
              <span style={labelStyle}>{copied ? '복사됨 ✓' : '공유 링크 복사'}</span>
            </button>
          )}
          <div style={{ ...rowStyle, cursor: 'default' }}>
            <span style={{ ...labelStyle, color: 'var(--text-faint, #bbb)' }}>편집</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-faint, #bbb)' }}>PC·태블릿에서</span>
          </div>
          <button onClick={() => setPicking(true)} style={rowStyle}>
            <span style={labelStyle}>폴더 이동</span>
          </button>
        </div>
      </BottomSheet>
      {picking && (
        <FolderPickerDialog
          folders={folders}
          currentFolderId={problem.folder_id}
          onPick={async (folderId) => {
            try { await moveProblemToFolder(problem.id, folderId); } catch { /* 실패 시 목록 불변 */ }
            setPicking(false);
            onClose();
            onMoved();
          }}
          onCancel={() => setPicking(false)}
        />
      )}
    </>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', minHeight: 48, padding: '0 12px', boxSizing: 'border-box',
  border: 'none', borderBottom: '1px solid var(--border-light, #eee)',
  background: 'none', cursor: 'pointer', textAlign: 'left',
};
const labelStyle: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
