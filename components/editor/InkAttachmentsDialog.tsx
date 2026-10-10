'use client';

/**
 * Phase 69 D14 — 문항의 필기 첨부(= iPad에서 받아 삽입한 `inserted` job) 목록 · 크게 보기 · 삭제.
 *
 * 열 때 1회 조회(`problemId` 단일 조건 + 클라 필터 — 복합 인덱스 0). 삭제 = 문서 + Storage 2파일이고
 * **본문에 이미 들어간 LaTeX는 그대로**다(첨부는 원본 기록일 뿐).
 * ⚠ 포털 없이 인라인 · z 9000(SheetImport·BatchVerify 선례) — 그 안에서 여는 confirmDialog(10500)가 DOM 순서와 무관하게 위에 뜬다.
 */

import { useEffect, useState } from 'react';
import EditorPreview from './EditorPreview';
import { dialogBody, dialogBtn, dialogContent, dialogHead } from '../ui/dialogStyles';
import { confirmDialog } from '../../lib/dialogs';
import { deleteAttachment, listAttachments, type InkJob } from '../../lib/inkJobs';
import type { TabMeta } from '../../types/problem';
import { IconClose } from '../ui/Icons';

const fmt = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export default function InkAttachmentsDialog({ uid, problemId, tabs, onClose }: {
  uid: string;
  problemId: string;
  tabs: TabMeta[];
  onClose: () => void;
}) {
  const [items, setItems] = useState<InkJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<InkJob | null>(null);

  useEffect(() => {
    let alive = true;
    listAttachments(uid, problemId)
      .then((r) => { if (alive) setItems(r); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [uid, problemId]);

  const tabLabel = (id?: string) => tabs.find((t) => t.id === id)?.label ?? id ?? '';

  const remove = async (j: InkJob) => {
    const ok = await confirmDialog({
      message: ['이 필기 첨부를 삭제할까요?', '원본 이미지가 지워집니다. 본문에 이미 들어간 LaTeX는 그대로 남습니다.'],
      danger: true,
      confirmLabel: '삭제',
    });
    if (!ok) return;
    try {
      await deleteAttachment(uid, j);
      setItems((cur) => (cur ? cur.filter((x) => x.id !== j.id) : cur));
      setSel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div role="dialog" aria-label="필기 첨부" style={{ ...dialogBody, width: 720 }}>
        <div style={dialogHead}>
          {sel && (
            <button type="button" style={{ ...dialogBtn('ghost'), padding: '4px 10px' }} onClick={() => setSel(null)}>← 목록</button>
          )}
          <span style={{ flex: 1 }}>필기 첨부{items ? ` · ${items.length}건` : ''}</span>
          <button type="button" aria-label="닫기" onClick={onClose}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
            <IconClose size={18} />
          </button>
        </div>
        <div style={{ ...dialogContent, whiteSpace: 'normal' }}>
          {error && <div style={{ color: 'var(--accent-danger)', marginBottom: 8 }}>{error}</div>}
          {items === null && !error && <div style={{ color: 'var(--text-muted)' }}>불러오는 중…</div>}
          {items && items.length === 0 && <div style={{ color: 'var(--text-muted)' }}>이 문항에 보관된 필기가 없습니다.</div>}
          {sel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <img src={sel.imageUrl} alt="필기 원본" style={{ width: '100%', maxHeight: '44vh', objectFit: 'contain', background: '#fff', border: '0.5px solid var(--border-content)', borderRadius: 6 }} />
              {sel.finalText && <EditorPreview content={sel.finalText} borderless autoHeight />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <span>{tabLabel(sel.tabId)} 탭에 삽입 · {fmt(sel.insertedAtMs)}</span>
                <button type="button" style={dialogBtn('danger')} onClick={() => remove(sel)}>삭제</button>
              </div>
            </div>
          ) : items && items.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {items.map((j) => (
                <button key={j.id} type="button" onClick={() => setSel(j)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: 8, textAlign: 'left', cursor: 'pointer',
                    border: '0.5px solid var(--border-content)', borderRadius: 8, background: 'var(--bg-functional)',
                    font: 'inherit', color: 'inherit',
                  }}>
                  <img src={j.imageUrl} alt="" style={{ width: '100%', height: 96, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tabLabel(j.tabId)} · {fmt(j.insertedAtMs)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono, monospace)' }}>
                    {j.finalText}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
