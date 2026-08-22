'use client';

/**
 * Phase 61a — 시트 가져오기 마법사 (스텝 3: 미리보기까지. 폴더 선택·저장은 스텝 4)
 *
 * ⚠️ **미리보기와 저장은 같은 배열을 본다(계획서 Y1).**
 *    `toPersistedBlock`이 `raw_text`를 정규화(`$$` 앞뒤 빈 줄)하므로, 정규화 **전** 텍스트를
 *    그리면 검수 관문이 "저장될 것과 다른 것"을 보게 된다. 그래서 미리보기 진입 시점에
 *    persisted 배열을 확정하고 화면과 저장이 그것을 공유한다. `block_key`도 여기서 정해진다.
 *
 * ⚠️ **블록 렌더는 타입 분기가 필수다(계획서 X3).** `EditorPreview`는 마크다운 문자열
 *    렌더러라 choices를 모른다 — 그냥 넘기면 선택지가 마크다운 원문으로 보인다.
 */

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Block } from '../../types/problem';
import {
  rowToDraft, isDraftError,
  type ImportRow, type ProblemDraft,
} from '../../lib/sheetImport';
import { toPersistedBlock, type PersistedBlockData } from '../../lib/blocks/normalize';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { IconClose, IconChevron, IconChevronDown } from '../ui/Icons';

type SheetName = 'Data_DS' | 'Stack';

interface ApiResponse {
  header: string[];
  headerWarnings: string[];
  rows: ImportRow[];
}

/** 한 행의 미리보기 단위. `persisted`가 화면과 저장이 공유하는 단일 진실이다(Y1). */
interface PreviewItem {
  rowIndex: number;
  draft: ProblemDraft | null;
  error: string | null;
  persisted: Record<string, PersistedBlockData[]>;
}

const SHEETS: { id: SheetName; label: string; hint: string }[] = [
  { id: 'Data_DS', label: 'Data_DS', hint: '최근 검사 세트' },
  { id: 'Stack', label: 'Stack', hint: '누적' },
];

/* ═══ 스타일 ═══ */

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  modal: {
    background: 'var(--bg-card, #fff)', borderRadius: 10,
    width: 'min(920px, 94vw)', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    fontFamily: 'var(--font-ui)',
  } as React.CSSProperties,
  head: {
    display: 'flex', alignItems: 'center', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderBottom: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  body: { padding: 16, overflowY: 'auto', flex: 1 } as React.CSSProperties,
  foot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderTop: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)', marginBottom: 6 } as React.CSSProperties,
  input: {
    width: '100%', padding: '8px 10px', fontSize: 13,
    fontFamily: 'var(--font-ui)', color: 'var(--text-primary, #222)',
    background: 'var(--bg-input, #fff)',
    border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  } as React.CSSProperties,
};

const btn = (kind: 'primary' | 'ghost', disabled = false): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
  fontFamily: 'var(--font-ui)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  border: kind === 'primary' ? 'none' : '1px solid var(--border-light, #ddd)',
  background: kind === 'primary' ? 'var(--mathory-red-dark, #BC5F3F)' : 'transparent',
  color: kind === 'primary' ? '#fff' : 'var(--text-primary, #222)',
});

const badge = (tone: 'warn' | 'muted'): React.CSSProperties => ({
  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  background: tone === 'warn' ? 'rgba(188,95,63,0.12)' : 'var(--bg-hover, #f3f3f3)',
  color: tone === 'warn' ? 'var(--mathory-red-dark, #BC5F3F)' : 'var(--text-muted, #888)',
});

/* ═══ 컴포넌트 ═══ */

export default function SheetImportModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [phase, setPhase] = useState<'form' | 'preview'>('form');
  const [sheet, setSheet] = useState<SheetName>('Stack');
  const [rowsText, setRowsText] = useState('');
  const [includePreselected, setIncludePreselected] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerWarnings, setHeaderWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubmit = rowsText.trim() !== '' || includePreselected;

  const fetchRows = async () => {
    setBusy(true); setError(null);
    try {
      // Y4: ID 토큰을 릴레이한다. 라우트가 accounts:lookup으로 검증하고 허용목록으로 좁힌다.
      const idToken = await user.getIdToken();
      const res = await fetch('/api/sheet-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sheet, rows: rowsText.trim(), includePreselected }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error ?? '시트를 가져오지 못했습니다'); return; }

      const data = json as ApiResponse;
      const next: PreviewItem[] = data.rows.map((row) => {
        const d = rowToDraft(row);
        if (isDraftError(d)) return { rowIndex: row.rowIndex, draft: null, error: d.error, persisted: {} };
        // Y1·Y2·Y3 — 저장형을 여기서 확정하고 화면이 그것을 그린다
        const persisted: Record<string, PersistedBlockData[]> = {};
        for (const [tabId, blocks] of Object.entries(d.blocksByTab)) {
          persisted[tabId] = blocks.map((b, i) =>
            toPersistedBlock({ id: '', order: i, type: b.type, raw_text: b.raw_text } as Block, i));
        }
        return { rowIndex: row.rowIndex, draft: d, error: null, persisted };
      });

      setItems(next);
      setHeaderWarnings(data.headerWarnings ?? []);
      setChecked(new Set(next.filter((i) => i.draft).map((i) => i.rowIndex)));
      setExpanded(null);
      setPhase('preview');
    } catch {
      setError('시트를 가져오는 중 문제가 생겼습니다 — 잠시 후 다시 시도하세요');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (rowIndex: number) => setChecked((prev) => {
    const n = new Set(prev);
    if (n.has(rowIndex)) n.delete(rowIndex); else n.add(rowIndex);
    return n;
  });

  const valid = items.filter((i) => i.draft);
  const failed = items.filter((i) => !i.draft);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── 1행: 제목 + 닫기 ── */}
        <div style={S.head}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #222)', flex: 1 }}>
            시트에서 가져오기
            {phase === 'preview' && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--text-muted, #888)' }}>
                미리보기 · {items.length}행
              </span>
            )}
          </div>
          <button onClick={onClose} title="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', display: 'flex' }}>
            <IconClose />
          </button>
        </div>

        <div style={S.body}>
          {phase === 'form' ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={S.label}>원본 시트</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {SHEETS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSheet(s.id)}
                      style={{
                        flex: 1, padding: '10px 12px', textAlign: 'left', borderRadius: 6, cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        border: `1px solid ${sheet === s.id ? 'var(--mathory-red-dark, #BC5F3F)' : 'var(--border-light, #ddd)'}`,
                        background: sheet === s.id ? 'rgba(188,95,63,0.06)' : 'transparent',
                        color: 'var(--text-primary, #222)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>{s.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={S.label}>행 범위</div>
                <input
                  style={S.input}
                  value={rowsText}
                  onChange={(e) => setRowsText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit && !busy) fetchRows(); }}
                  placeholder="예: 15-32  또는  15, 17, 20-25"
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 6 }}>
                  시트의 실제 행 번호입니다(1행은 헤더이므로 데이터는 2행부터).
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includePreselected}
                  onChange={(e) => setIncludePreselected(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-primary, #222)' }}>
                  사전 선별(M열 체크 표시)된 문제 포함하기
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>
                    행 범위를 비워 두면 사전 선별 문제만 가져옵니다. 둘 다 쓰면 합집합입니다.
                  </span>
                </span>
              </label>

              {error && <div style={{ marginTop: 14, ...badge('warn'), display: 'block', padding: '8px 10px' }}>{error}</div>}
            </>
          ) : (
            <>
              {headerWarnings.length > 0 && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 6, background: 'rgba(188,95,63,0.08)' }}>
                  {headerWarnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--mathory-red-dark, #BC5F3F)' }}>⚠ {w}</div>
                  ))}
                </div>
              )}

              {items.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted, #888)' }}>
                  조건에 맞는 행이 없습니다.
                </div>
              )}

              {items.map((item) => (
                <PreviewRow
                  key={item.rowIndex}
                  item={item}
                  checked={checked.has(item.rowIndex)}
                  expanded={expanded === item.rowIndex}
                  onToggleCheck={() => toggle(item.rowIndex)}
                  onToggleExpand={() => setExpanded(expanded === item.rowIndex ? null : item.rowIndex)}
                />
              ))}
            </>
          )}
        </div>

        {/* ── 하단: 진행 버튼 ── */}
        <div style={S.foot}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            {phase === 'preview' && (
              <>선택 {checked.size}건{failed.length > 0 && ` · 오류 ${failed.length}건`}</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {phase === 'preview' && (
              <button style={btn('ghost')} onClick={() => setPhase('form')}>뒤로</button>
            )}
            {phase === 'form' ? (
              <button style={btn('primary', !canSubmit || busy)} disabled={!canSubmit || busy} onClick={fetchRows}>
                {busy ? '불러오는 중…' : '미리보기'}
              </button>
            ) : (
              <button style={btn('primary', true)} disabled title="스텝 4에서 구현합니다">
                가져오기 (준비 중)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ 미리보기 한 행 ═══ */

function PreviewRow({
  item, checked, expanded, onToggleCheck, onToggleExpand,
}: {
  item: PreviewItem;
  checked: boolean;
  expanded: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
}) {
  const { draft, error, persisted } = item;

  const summary = useMemo(() => {
    if (!draft) return '';
    return draft.tabs
      .map((t) => `${t.label} ${persisted[t.id]?.length ?? 0}블록`)
      .join(' · ');
  }, [draft, persisted]);

  return (
    <div style={{
      border: '1px solid var(--border-light, #eee)', borderRadius: 6,
      marginBottom: 6, background: error ? 'var(--bg-hover, #f7f7f7)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
        <input type="checkbox" checked={checked} disabled={!draft} onChange={onToggleCheck} />
        <div
          onClick={draft ? onToggleExpand : undefined}
          style={{ flex: 1, cursor: draft ? 'pointer' : 'default', minWidth: 0 }}
        >
          <div style={{
            fontSize: 13, fontWeight: 600, color: error ? 'var(--text-muted, #888)' : 'var(--text-primary, #222)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ ...badge('muted'), marginRight: 6 }}>{item.rowIndex}행</span>
            {draft ? draft.title : `가져올 수 없음 — ${error}`}
          </div>
          {draft && (
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{summary}</span>
              {draft.answer && <span style={badge('muted')}>정답 {draft.answer}</span>}
              {draft.warnings.length > 0 && <span style={badge('warn')}>경고 {draft.warnings.length}</span>}
            </div>
          )}
        </div>
        {draft && (
          <span style={{ display: 'flex', color: 'var(--text-muted, #888)' }}>
            {expanded ? <IconChevronDown /> : <IconChevron />}
          </span>
        )}
      </div>

      {/* 접으면 언마운트 — KaTeX 인스턴스를 남기지 않는다 (D9) */}
      {expanded && draft && (
        <div style={{ borderTop: '1px solid var(--border-light, #eee)', padding: '12px 14px' }}>
          {draft.warnings.length > 0 && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
              {draft.warnings.map((w, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--mathory-red-dark, #BC5F3F)' }}>{w}</li>
              ))}
            </ul>
          )}
          {draft.tabs.map((tab) => (
            <div key={tab.id} style={{ marginBottom: 16 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>{tab.label}</div>
              <div style={{
                border: '1px solid var(--border-light, #eee)', borderRadius: 6,
                padding: '10px 14px', background: 'var(--bg-content, #fff)',
              }}>
                {(persisted[tab.id] ?? []).map((b, i) => (
                  /* X3 — 타입 분기 필수. EditorPreview는 choices를 모른다 */
                  b.type === 'choices'
                    ? <ChoicesBlock key={i} rawText={b.raw_text} locale="ko" />
                    : <EditorPreview key={i} content={b.raw_text} borderless locale="ko" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
