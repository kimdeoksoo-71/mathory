'use client';

/* ═══════════════════════════════════════════════════════════════
   Phase 70a — 내보내기 다이얼로그 (옛 PdfDialog 대체 · D17′)

   형식: PDF(기본) · Markdown · ── 추가 형식 ›(사이드바 chevron · LaTeX .tex · Overleaf에서 열기 · Typst .typ) — D6
   탭: 넘겨받은 tabs(멤버 가시성 필터 뒤)만 고른다 — 모든 형식이 선택 탭만 내보낸다(Q15).

   ⚠ 규격은 components/ui/dialogStyles(M2 A — 새 규격 금지). 옛 PdfDialog의 자체 스타일은 승계하지 않는다.
   ⚠ .tex·.typ·Overleaf의 무거운 코드(unified·remark·fflate·직렬화기)는 확인을 누를 때 **동적 import**(D18).
   ⚠ Overleaf: 그림을 받는 동안 클릭의 사용자 활성이 끊긴다 → await 전에 빈 창을 먼저 연다(reserveOverleafWindow).
   ⚠ 오류는 alertDialog가 아니라 이 다이얼로그 안에 쓴다 — 같은 Z_DIALOG 계층에서 겹치는 순서를 피한다.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { TabMeta, Block } from '../../types/problem';
import { IconDownload, IconChevron } from '../ui/Icons';
import { dialogOverlay, dialogBody, dialogHead, dialogContent, dialogFoot, dialogBtn } from '../ui/dialogStyles';
import { reserveOverleafWindow, OVERLEAF_WINDOW } from '../../lib/export/overleaf';

export type ExportFormat = 'pdf' | 'md' | 'tex' | 'overleaf' | 'typ';

const FORMAT_KEY = 'mathory-export-format';
const MAIN_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'md', label: 'Markdown' },
];
const EXTRA_FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'tex', label: 'LaTeX (.tex)', hint: 'A4 1단 원고 · XeLaTeX' },
  { id: 'overleaf', label: 'Overleaf에서 열기', hint: '새 탭에 프로젝트로 열기' },
  { id: 'typ', label: 'Typst (.typ)', hint: 'PDF와 같은 A3 2단' },
];
const isExtra = (f: ExportFormat) => EXTRA_FORMATS.some((x) => x.id === f);

function loadFormat(): ExportFormat {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    if (v === 'pdf' || v === 'md' || v === 'tex' || v === 'overleaf' || v === 'typ') return v;
  } catch { /* 비공개 창 등 */ }
  return 'pdf';
}
function saveFormat(f: ExportFormat) {
  try { localStorage.setItem(FORMAT_KEY, f); } catch { /* 무시 */ }
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 멤버 가시성 필터 뒤의 탭 */
  tabs: TabMeta[];
  tabBlocks: Record<string, Block[]>;
  /** Markdown(기존 원문 이어붙임) */
  onMarkdown: (tabIds: string[]) => void;
}

const STAGE_LABEL: Record<string, string> = {
  compiler: '조판기 불러오는 중…', fonts: '글꼴 받는 중…', typeset: '조판 중…', isolate: '수식 점검 중…',
};

export default function ExportDialog({ open, onClose, title, tabs, tabBlocks, onMarkdown }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [extraOpen, setExtraOpen] = useState(false);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const f = loadFormat();
    setFormat(f);
    setExtraOpen(isExtra(f));
    const next: Record<string, boolean> = {};
    tabs.forEach((t) => { next[t.id] = true; });
    setSelection(next);
    setMessage(null);
  }, [open, tabs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const selectedIds = tabs.filter((t) => selection[t.id]).map((t) => t.id);
  const confirmLabel = busy ? (stage ? STAGE_LABEL[stage] ?? '준비 중…' : '준비 중…') : format === 'overleaf' ? '열기' : '다운로드';

  const pick = (f: ExportFormat) => { setFormat(f); saveFormat(f); setMessage(null); };

  const run = async () => {
    if (busy || selectedIds.length === 0) return;
    setMessage(null);
    if (format === 'md') { onMarkdown(selectedIds); onClose(); return; }
    // Overleaf: await 전에 창을 확보한다(사용자 활성)
    const win = format === 'overleaf' ? reserveOverleafWindow() : null;
    setBusy(true);
    try {
      const { runFileExport } = await import('../../lib/export/run');
      const src = {
        title,
        tabs: tabs.filter((t) => selection[t.id]).map((t) => ({ id: t.id, label: t.label, blocks: tabBlocks[t.id] || [] })),
      };
      const res = await runFileExport(format, src, { overleafTarget: win ? OVERLEAF_WINDOW : '_blank', onStage: setStage });
      if (res.notices.length) setMessage({ kind: 'info', text: res.notices.join('\n') });
      else onClose();
    } catch (e) {
      console.error('[Phase70 내보내기] 실패', e);
      win?.close();
      setMessage({ kind: 'error', text: `내보내기에 실패했습니다 — ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const radio = (id: ExportFormat, label: string, hint?: string) => (
    <label key={id} style={{
      display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', cursor: busy ? 'default' : 'pointer',
      fontSize: 13.5, color: 'var(--text-primary)',
    }}>
      <input type="radio" name="export-format" checked={format === id} disabled={busy} onChange={() => pick(id)} />
      <span>{label}</span>
      {hint ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span> : null}
    </label>
  );

  return (
    <div style={dialogOverlay} onClick={() => { if (!busy) onClose(); }}>
      <div style={{ ...dialogBody, width: 420 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="내보내기">
        <div style={dialogHead}>
          <IconDownload size={16} /> 내보내기
        </div>
        <div style={{ ...dialogContent, whiteSpace: 'normal' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>형식</div>
          {MAIN_FORMATS.map((f) => radio(f.id, f.label))}
          <button
            type="button"
            onClick={() => setExtraOpen((v) => !v)}
            disabled={busy}
            aria-expanded={extraOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 2px', padding: 0,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
            }}
          >
            {/* 사이드바 섹션 헤더(SidebarSectionHeader)와 같은 chevron — 14 · --text-muted · 열리면 90° */}
            <span style={{
              display: 'flex', color: 'var(--text-muted)',
              transform: extraOpen ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform var(--transition-fast, .15s)',
            }}>
              <IconChevron size={14} />
            </span>
            추가 형식
          </button>
          {extraOpen ? <div style={{ paddingLeft: 18 }}>{EXTRA_FORMATS.map((f) => radio(f.id, f.label, f.hint))}</div> : null}

          <div style={{ borderTop: '1px solid var(--border-light, #eee)', margin: '12px 0 8px' }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>포함할 탭</div>
          {tabs.map((tab) => (
            <label key={tab.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', cursor: 'pointer',
              fontSize: 13.5, color: 'var(--text-secondary)',
            }}>
              <input
                type="checkbox"
                checked={selection[tab.id] !== false}
                disabled={busy}
                onChange={(e) => setSelection((prev) => ({ ...prev, [tab.id]: e.target.checked }))}
              />
              {tab.label}
            </label>
          ))}

          {message ? (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12.5, whiteSpace: 'pre-line',
              background: message.kind === 'error' ? 'var(--bg-warn)' : 'var(--accent-soft)',
              color: message.kind === 'error' ? 'var(--accent-danger, #C0392B)' : 'var(--text-primary)',
            }}>{message.text}</div>
          ) : null}
        </div>
        <div style={dialogFoot}>
          <button type="button" style={dialogBtn('ghost', busy)} disabled={busy} onClick={onClose}>
            {message?.kind === 'info' ? '닫기' : '취소'}
          </button>
          <button type="button" style={dialogBtn('primary', busy || selectedIds.length === 0)} disabled={busy || selectedIds.length === 0} onClick={run}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
