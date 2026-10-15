'use client';

/* ═══════════════════════════════════════════════════════════════
   Phase 70a — 내보내기 다이얼로그 (옛 PdfDialog 대체 · D17′)

   형식: PDF(기본) · Markdown · HWPX(한글 — Phase 71) · ── 추가 형식 ›(사이드바 chevron · LaTeX .tex · Overleaf에서 열기 · Typst .typ) — D6
   탭: 넘겨받은 tabs(멤버 가시성 필터 뒤)만 고른다 — 모든 형식이 선택 탭만 내보낸다(Q15).
       ⚠ HWPX는 예외 — 탭 체크박스를 숨기고 문제·풀이 두 탭만 낸다(Phase 71 D18·T18′).
   일괄(Phase 71 — FolderView 선택 바): `batch`를 넘기면 HWPX만 고를 수 있고, 확인을 누르면 문항을 순서대로 읽는다.

   ⚠ 규격은 components/ui/dialogStyles(M2 A — 새 규격 금지). 옛 PdfDialog의 자체 스타일은 승계하지 않는다.
   ⚠ .tex·.typ·Overleaf·HWPX의 무거운 코드(unified·remark·fflate·직렬화기)는 확인을 누를 때 **동적 import**(D18).
   ⚠ Overleaf: 그림을 받는 동안 클릭의 사용자 활성이 끊긴다 → await 전에 빈 창을 먼저 연다(reserveOverleafWindow).
   ⚠ 오류는 alertDialog가 아니라 이 다이얼로그 안에 쓴다 — 같은 Z_DIALOG 계층에서 겹치는 순서를 피한다.
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import type { TabMeta, Block } from '../../types/problem';
import { IconDownload, IconChevron } from '../ui/Icons';
import { dialogOverlay, dialogBody, dialogHead, dialogContent, dialogFoot, dialogBtn } from '../ui/dialogStyles';
import { reserveOverleafWindow, OVERLEAF_WINDOW } from '../../lib/export/overleaf';

export type ExportFormat = 'pdf' | 'md' | 'hwpx' | 'tex' | 'overleaf' | 'typ';

const FORMAT_KEY = 'mathory-export-format';
const HWPX_KEY = 'mathory-export-hwpx';
const MAIN_FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'md', label: 'Markdown' },
  { id: 'hwpx', label: 'HWPX (한글)' },
];
const EXTRA_FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'tex', label: 'LaTeX (.tex)', hint: 'A4 1단 원고 · XeLaTeX' },
  { id: 'overleaf', label: 'Overleaf에서 열기', hint: '새 탭에 프로젝트로 열기' },
  { id: 'typ', label: 'Typst (.typ)', hint: 'PDF와 같은 A3 2단' },
];
const isExtra = (f: ExportFormat) => EXTRA_FORMATS.some((x) => x.id === f);
const EMPTY_TABS: TabMeta[] = [];
const EMPTY_BLOCKS: Record<string, Block[]> = {};

function loadFormat(): ExportFormat {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    if (v === 'pdf' || v === 'md' || v === 'hwpx' || v === 'tex' || v === 'overleaf' || v === 'typ') return v;
  } catch { /* 비공개 창 등 */ }
  return 'pdf';
}
function saveFormat(f: ExportFormat) {
  try { localStorage.setItem(FORMAT_KEY, f); } catch { /* 무시 */ }
}

interface HwpxPrefs { numbering: 'title' | 'sequential'; placement: 'column' | 'endnote' }
const HWPX_DEFAULT: HwpxPrefs = { numbering: 'title', placement: 'column' };
function loadHwpx(): HwpxPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(HWPX_KEY) || '{}');
    return {
      numbering: v.numbering === 'sequential' ? 'sequential' : 'title',
      placement: v.placement === 'endnote' ? 'endnote' : 'column',
    };
  } catch { return HWPX_DEFAULT; }
}
function saveHwpx(p: HwpxPrefs) {
  try { localStorage.setItem(HWPX_KEY, JSON.stringify(p)); } catch { /* 무시 */ }
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** 단일 = 문항 제목 · 일괄 = 폴더 이름(파일 이름) */
  title: string;
  /** 멤버 가시성 필터 뒤의 탭(일괄이면 비운다) */
  tabs?: TabMeta[];
  tabBlocks?: Record<string, Block[]>;
  /** Markdown(기존 원문 이어붙임) */
  onMarkdown?: (tabIds: string[]) => void;
  /** Phase 71 — 일괄 HWPX(문항 id는 리스트 화면 순서) */
  batch?: { problemIds: string[] };
}

const STAGE_LABEL: Record<string, string> = {
  compiler: '조판기 불러오는 중…', fonts: '글꼴 받는 중…', typeset: '조판 중…', isolate: '수식 점검 중…',
};

export default function ExportDialog({ open, onClose, title, tabs = EMPTY_TABS, tabBlocks = EMPTY_BLOCKS, onMarkdown, batch }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [extraOpen, setExtraOpen] = useState(false);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [hwpx, setHwpx] = useState<HwpxPrefs>(HWPX_DEFAULT);
  const abortRef = useRef(false);

  // ⚠ deps는 batch 객체가 아니라 불리언 — 부모가 매 렌더 새 객체를 넘겨도 진행 중 상태가 초기화되지 않게
  const isBatch = !!batch;
  useEffect(() => {
    if (!open) return;
    const f = isBatch ? 'hwpx' : loadFormat();
    setFormat(f);
    setExtraOpen(isExtra(f));
    const next: Record<string, boolean> = {};
    tabs.forEach((t) => { next[t.id] = true; });
    setSelection(next);
    setHwpx(loadHwpx());
    setMessage(null);
    abortRef.current = false;
  }, [open, tabs, isBatch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const isHwpx = format === 'hwpx';
  const selectedIds = tabs.filter((t) => selection[t.id]).map((t) => t.id);
  const canRun = isHwpx ? (batch ? batch.problemIds.length > 0 : tabs.some((t) => t.id === 'question' || t.id === 'solution')) : selectedIds.length > 0;
  const confirmLabel = busy ? (stage ? STAGE_LABEL[stage] ?? stage : '준비 중…') : format === 'overleaf' ? '열기' : '다운로드';

  const pick = (f: ExportFormat) => {
    if (batch && f !== 'hwpx') return;
    setFormat(f);
    if (!batch) saveFormat(f);
    setMessage(null);
  };
  const setPref = (patch: Partial<HwpxPrefs>) => setHwpx((prev) => { const next = { ...prev, ...patch }; saveHwpx(next); return next; });

  const runHwpx = async () => {
    const { runHwpxExport } = await import('../../lib/export/run');
    let sources;
    const pre: string[] = [];
    if (batch) {
      const { loadExportSources } = await import('../../lib/export/hwpx/batch');
      const res = await loadExportSources(batch.problemIds, (d, n) => setStage(`${d}/${n} 불러오는 중…`), () => abortRef.current);
      if (res.aborted) return { notices: [], aborted: true };
      sources = res.sources;
      pre.push(...res.notices);
    } else {
      sources = [{
        title,
        tabs: tabs.filter((t) => t.id === 'question' || t.id === 'solution').map((t) => ({ id: t.id, label: t.label, blocks: tabBlocks[t.id] || [] })),
      }];
    }
    setStage('만드는 중…');
    const res = await runHwpxExport(sources, { ...hwpx, fileName: title });
    return { notices: [...pre, ...res.notices], aborted: false };
  };

  const run = async () => {
    if (busy || !canRun) return;
    setMessage(null);
    if (format === 'md') { onMarkdown?.(selectedIds); onClose(); return; }
    // Overleaf: await 전에 창을 확보한다(사용자 활성)
    const win = format === 'overleaf' ? reserveOverleafWindow() : null;
    abortRef.current = false;
    setBusy(true);
    try {
      if (isHwpx) {
        const res = await runHwpx();
        if (res.aborted) { setMessage({ kind: 'info', text: '내보내기를 멈췄습니다.' }); return; }
        if (res.notices.length) setMessage({ kind: 'info', text: res.notices.join('\n') });
        else onClose();
        return;
      }
      const { runFileExport } = await import('../../lib/export/run');
      const src = {
        title,
        tabs: tabs.filter((t) => selection[t.id]).map((t) => ({ id: t.id, label: t.label, blocks: tabBlocks[t.id] || [] })),
      };
      const res = await runFileExport(format as 'pdf' | 'tex' | 'typ' | 'overleaf', src, { overleafTarget: win ? OVERLEAF_WINDOW : '_blank', onStage: setStage });
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

  /** 일괄 불러오는 중에는 취소 = 멈춤(문항 경계에서) */
  const cancel = () => {
    if (busy) { if (batch) abortRef.current = true; return; }
    onClose();
  };

  const radio = (id: ExportFormat, label: string, hint?: string) => {
    const off = busy || (!!batch && id !== 'hwpx');
    return (
      <label key={id} style={{
        display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0', cursor: off ? 'default' : 'pointer',
        fontSize: 13.5, color: off && batch && id !== 'hwpx' ? 'var(--text-muted)' : 'var(--text-primary)',
      }}>
        <input type="radio" name="export-format" checked={format === id} disabled={off} onChange={() => pick(id)} />
        <span>{label}</span>
        {hint ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span> : null}
      </label>
    );
  };

  const option = <T extends string>(name: string, value: T, current: T, label: string, onPick: (v: T) => void) => (
    <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: busy ? 'default' : 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
      <input type="radio" name={name} checked={current === value} disabled={busy} onChange={() => onPick(value)} />
      {label}
    </label>
  );

  const subHead = (text: string) => <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{text}</div>;

  return (
    <div style={dialogOverlay} onClick={() => { if (!busy) onClose(); }}>
      <div style={{ ...dialogBody, width: 420 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="내보내기">
        <div style={dialogHead}>
          <IconDownload size={16} /> 내보내기{batch ? ` — 문항 ${batch.problemIds.length}개` : ''}
        </div>
        <div style={{ ...dialogContent, whiteSpace: 'normal' }}>
          {subHead(batch ? '형식 · 일괄은 HWPX만' : '형식')}
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
          {isHwpx ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>문제·풀이 탭을 내보냅니다.</div>
              {subHead('문항 번호')}
              {option('hwpx-numbering', 'title', hwpx.numbering, '제목 끝의 번호(1~30)', (v) => setPref({ numbering: v }))}
              {option('hwpx-numbering', 'sequential', hwpx.numbering, batch ? '1부터 차례로' : '1', (v) => setPref({ numbering: v }))}
              <div style={{ height: 8 }} />
              {subHead('풀이 위치')}
              {option('hwpx-placement', 'column', hwpx.placement, '문제는 왼쪽 단 · 풀이는 오른쪽 단', (v) => setPref({ placement: v }))}
              {option('hwpx-placement', 'endnote', hwpx.placement, '풀이는 미주로 모아서', (v) => setPref({ placement: v }))}
            </>
          ) : (
            <>
              {subHead('포함할 탭')}
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
            </>
          )}

          {message ? (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12.5, whiteSpace: 'pre-line',
              background: message.kind === 'error' ? 'var(--bg-warn)' : 'var(--accent-soft)',
              color: message.kind === 'error' ? 'var(--accent-danger, #C0392B)' : 'var(--text-primary)',
            }}>{message.text}</div>
          ) : null}
        </div>
        <div style={dialogFoot}>
          <button type="button" style={dialogBtn('ghost', busy && !batch)} disabled={busy && !batch} onClick={cancel}>
            {busy && batch ? '멈추기' : message?.kind === 'info' ? '닫기' : '취소'}
          </button>
          <button type="button" style={dialogBtn('primary', busy || !canRun)} disabled={busy || !canRun} onClick={run}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
