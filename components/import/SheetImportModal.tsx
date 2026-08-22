'use client';

/**
 * Phase 61a — 시트 가져오기 마법사
 * 시트 선택 → 행 지정 → 폴더 선택 → 미리보기 → 저장.
 *
 * ⚠️ **미리보기와 저장은 같은 배열을 본다(계획서 Y1).**
 *    `toPersistedBlock`이 `raw_text`를 정규화(`$$` 앞뒤 빈 줄)하므로, 정규화 **전** 텍스트를
 *    그리면 화면과 저장 결과가 갈린다. 미리보기 진입 시점에 persisted 배열을 확정하고
 *    화면과 저장이 그것을 공유한다. `block_key`도 여기서 정해져 재시도에 안정적이다.
 *
 * ⚠️ **블록 렌더는 타입 분기가 필수다(계획서 X3).** `EditorPreview`는 마크다운 문자열
 *    렌더러라 choices를 모른다 — 그냥 넘기면 선택지가 마크다운 원문으로 보인다.
 *
 * ⚠️ **중복 판정 키는 `source_id` 단독이 아니다(계획서 D11).** 실측에서 시트에 id가 같고
 *    본문이 다른 그룹이 67개 나왔다 — id만 보면 서로 다른 문항을 조용히 건너뛴다.
 *
 * ⚠️ **휴지통 문항은 중복이 아니다(D15).** Mathory의 '삭제'는 영구 삭제가 아니라 휴지통
 *    이동(`folder_id = TRASH_FOLDER_ID`)이라 문서가 그대로 남는다. 이를 중복으로 세면
 *    "지웠는데도 다시 가져올 수 없는" 상태가 된다 — 실제로 그렇게 막혔다.
 *    또한 중복이어도 **체크를 막지는 않는다**. 기본만 해제하고 판단은 사용자에게 남긴다.
 */

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Block, Folder, ImportSource } from '../../types/problem';
import {
  rowToDraft, isDraftError,
  type ImportRow, type ProblemDraft,
} from '../../lib/sheetImport';
import { toPersistedBlock, type PersistedBlockData } from '../../lib/blocks/normalize';
import { createProblem, saveTabBlock, deleteProblem, createFolder, listProblems, TRASH_FOLDER_ID } from '../../lib/firestore';
import { buildFolderTree, flattenVisible, getChildren } from '../../lib/folder-tree';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { IconClose, IconChevron, IconChevronDown, IconFolder, IconPlus } from '../ui/Icons';

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
  /** none=새 문항 · existing=내 문항에 있음 · inSelection=이번 선택 안 중복 · trashed=휴지통에만 있음 */
  dupe: 'none' | 'existing' | 'inSelection' | 'trashed';
}

interface SaveOutcome {
  rowIndex: number;
  title: string;
  status: 'ok' | 'fail';
  detail?: string;
}

const SHEETS: { id: SheetName; label: string; hint: string }[] = [
  { id: 'Data_DS', label: 'Data_DS', hint: '최근 검사 세트' },
  { id: 'Stack', label: 'Stack', hint: '누적' },
];

/** 저장 동시성. 문항 1건이 문서 1 + 블록 2~5개라 왕복이 많다. 너무 높이면
 *  Firestore 클라이언트가 큐를 쌓고 진행률이 뭉텅이로 뛴다. */
const SAVE_CONCURRENCY = 4;

const dupeKey = (sourceId: string, stemHash: string) => `${sourceId}|${stemHash}`;

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

const ACCENT = 'var(--mathory-red-dark, #BC5F3F)';

const btn = (kind: 'primary' | 'ghost', disabled = false): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
  fontFamily: 'var(--font-ui)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  border: kind === 'primary' ? 'none' : '1px solid var(--border-light, #ddd)',
  background: kind === 'primary' ? ACCENT : 'transparent',
  color: kind === 'primary' ? '#fff' : 'var(--text-primary, #222)',
});

const badge = (tone: 'warn' | 'muted' | 'ok'): React.CSSProperties => ({
  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  background: tone === 'warn' ? 'rgba(188,95,63,0.12)' : tone === 'ok' ? 'rgba(60,130,80,0.12)' : 'var(--bg-hover, #f3f3f3)',
  color: tone === 'warn' ? ACCENT : tone === 'ok' ? '#3c8250' : 'var(--text-muted, #888)',
});

/* ═══ 컴포넌트 ═══ */

export default function SheetImportModal({
  user, folders: initialFolders, onClose, onImported,
}: {
  user: User;
  folders: Folder[];
  onClose: () => void;
  /** 저장이 하나라도 성공하면 호출 — AppShell이 목록·카운트를 다시 읽는다 */
  onImported: () => void;
}) {
  const [phase, setPhase] = useState<'form' | 'preview' | 'saving' | 'done'>('form');
  const [sheet, setSheet] = useState<SheetName>('Stack');
  const [rowsText, setRowsText] = useState('');
  const [includePreselected, setIncludePreselected] = useState(true);

  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [folderId, setFolderId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerWarnings, setHeaderWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [fetchedSheet, setFetchedSheet] = useState<SheetName>('Stack');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<SaveOutcome[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'saving') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const canSubmit = rowsText.trim() !== '' || includePreselected;
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? '') : '최상위(미지정)';

  /* ── 폴더 새로 만들기 (AppShell 관례와 동일: prompt + order = 형제 수) ── */
  const handleNewFolder = async () => {
    const parent = folderId ?? null;
    const label = parent ? `"${folders.find((f) => f.id === parent)?.name}" 안에 만들 하위 폴더 이름:` : '새 폴더 이름:';
    const name = prompt(label);
    if (!name?.trim()) return;
    try {
      const id = await createFolder({
        name: name.trim(), user_id: user.uid,
        order: getChildren(folders, parent).length, parent_id: parent,
      });
      const created: Folder = { id, name: name.trim(), user_id: user.uid, order: 0, parent_id: parent };
      setFolders((prev) => [...prev, created]);
      setFolderId(id);
      onImported();                       // 사이드바 폴더 목록 갱신
    } catch {
      setError('폴더를 만들지 못했습니다');
    }
  };

  /* ── 미리보기 ── */
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

      // 이미 가져온 문항 집합. import_source는 listProblems의 `...data` 스프레드로 그대로 온다.
      // D15: 휴지통 문항은 살아 있는 문항과 따로 센다 — 지운 것을 다시 가져올 수 있어야 한다.
      const existing = new Set<string>();
      const trashed = new Set<string>();
      try {
        const mine = await listProblems(user.uid);
        for (const p of mine) {
          const src = p.import_source as ImportSource | undefined;
          if (!src?.source_id) continue;
          const key = dupeKey(src.source_id, src.stem_hash ?? '');
          (p.folder_id === TRASH_FOLDER_ID ? trashed : existing).add(key);
        }
      } catch {
        setError('기존 문항을 읽지 못해 중복 검사를 건너뜁니다 — 저장 전에 확인하세요');
      }

      const seen = new Set<string>();
      const next: PreviewItem[] = data.rows.map((row) => {
        const d = rowToDraft(row);
        if (isDraftError(d)) {
          return { rowIndex: row.rowIndex, draft: null, error: d.error, persisted: {}, dupe: 'none' as const };
        }
        // Y1·Y2·Y3 — 저장형을 여기서 확정하고 화면이 그것을 그린다
        const persisted: Record<string, PersistedBlockData[]> = {};
        for (const [tabId, blocks] of Object.entries(d.blocksByTab)) {
          persisted[tabId] = blocks.map((b, i) =>
            toPersistedBlock({ id: '', order: i, type: b.type, raw_text: b.raw_text } as Block, i));
        }
        const key = dupeKey(d.sourceId, d.stemHash);
        const dupe: PreviewItem['dupe'] =
          existing.has(key) ? 'existing'
          : seen.has(key) ? 'inSelection'
          : trashed.has(key) ? 'trashed'          // 휴지통에만 있음 → 가져올 수 있다
          : 'none';
        seen.add(key);
        return { rowIndex: row.rowIndex, draft: d, error: null, persisted, dupe };
      });

      setItems(next);
      setFetchedSheet(sheet);
      setHeaderWarnings(data.headerWarnings ?? []);
      // D3′(D15): 중복은 기본 해제. 다만 **막지는 않는다** — 배지로 알리고 선택은 사용자가 한다.
      //   휴지통에만 있는 것은 사실상 지운 문항이므로 기본 선택에 포함한다.
      setChecked(new Set(
        next.filter((i) => i.draft && (i.dupe === 'none' || i.dupe === 'trashed')).map((i) => i.rowIndex),
      ));
      setExpanded(null);
      setPhase('preview');
    } catch {
      setError('시트를 가져오는 중 문제가 생겼습니다 — 잠시 후 다시 시도하세요');
    } finally {
      setBusy(false);
    }
  };

  /* ── 저장 ── */
  const runImport = async () => {
    const targets = items.filter((i) => i.draft && checked.has(i.rowIndex));
    if (targets.length === 0) return;

    setPhase('saving'); setProgress(0); setError(null);
    const results: SaveOutcome[] = [];

    const saveOne = async (item: PreviewItem) => {
      const d = item.draft!;
      let problemId: string | null = null;
      try {
        const importSource: ImportSource = {
          provider: 'audition-sheet',
          sheet: fetchedSheet,
          row: item.rowIndex,
          source_id: d.sourceId,
          stem_hash: d.stemHash,
          imported_at: Date.now(),
        };
        problemId = await createProblem({
          title: d.title,
          source: d.source,                        // D4 — A열은 문자 그대로 "문제 출처"
          answer: d.answer,                        // D12 — D열만 쓴다. 비면 빈 값
          year: new Date().getFullYear(),          // 이하 AppShell 신규 문항 관례
          exam_type: '', category: '', difficulty: 3, tags: [],
          authorUid: user.uid,
          visibility: 'private',
          tabs: d.tabs,
          ...(folderId ? { folder_id: folderId } : {}),
          import_source: importSource,
        });
        for (const tab of d.tabs) {
          for (const block of item.persisted[tab.id] ?? []) {
            await saveTabBlock(problemId, tab.id, block);
          }
        }
        results.push({ rowIndex: item.rowIndex, title: d.title, status: 'ok' });
      } catch {
        // D7: 블록이 없는 고아 문항을 남기지 않는다. 방금 만든 것이라 잃을 게 없다.
        let detail = '저장 실패';
        if (problemId) {
          try { await deleteProblem(problemId); }
          catch { detail = '저장 실패 — 만들다 만 문항이 남았습니다. 수동 삭제가 필요합니다'; }
        }
        results.push({ rowIndex: item.rowIndex, title: d.title, status: 'fail', detail });
      } finally {
        setProgress((n) => n + 1);
      }
    };

    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(SAVE_CONCURRENCY, targets.length) }, async () => {
        while (cursor < targets.length) await saveOne(targets[cursor++]);
      }),
    );

    results.sort((a, b) => a.rowIndex - b.rowIndex);
    setOutcomes(results);
    setPhase('done');
    if (results.some((r) => r.status === 'ok')) onImported();
  };

  const toggle = (rowIndex: number) => setChecked((prev) => {
    const n = new Set(prev);
    if (n.has(rowIndex)) n.delete(rowIndex); else n.add(rowIndex);
    return n;
  });

  const failedRows = items.filter((i) => !i.draft).length;
  const dupeRows = items.filter((i) => i.dupe === 'existing' || i.dupe === 'inSelection').length;
  const trashedRows = items.filter((i) => i.dupe === 'trashed').length;
  const targetCount = items.filter((i) => i.draft && checked.has(i.rowIndex)).length;

  return (
    <div style={S.overlay} onClick={phase === 'saving' ? undefined : onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        <div style={S.head}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #222)', flex: 1 }}>
            시트에서 가져오기
            {phase === 'preview' && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--text-muted, #888)' }}>
                미리보기 · {items.length}행 → {folderName}
              </span>
            )}
          </div>
          {phase !== 'saving' && (
            <button onClick={onClose} title="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', display: 'flex' }}>
              <IconClose />
            </button>
          )}
        </div>

        <div style={S.body}>
          {phase === 'form' && (
            <FormPane
              sheet={sheet} setSheet={setSheet}
              rowsText={rowsText} setRowsText={setRowsText}
              includePreselected={includePreselected} setIncludePreselected={setIncludePreselected}
              folders={folders} folderId={folderId} setFolderId={setFolderId}
              onNewFolder={handleNewFolder}
              onEnter={() => { if (canSubmit && !busy) fetchRows(); }}
              error={error}
            />
          )}

          {phase === 'preview' && (
            <>
              {headerWarnings.map((w, i) => (
                <div key={i} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>
                  ⚠ {w}
                </div>
              ))}
              {error && <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>{error}</div>}
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

          {phase === 'saving' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary, #222)', marginBottom: 12 }}>
                가져오는 중… {progress} / {targetCount}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover, #eee)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${targetCount ? (progress / targetCount) * 100 : 0}%`, background: ACCENT, transition: 'width .2s' }} />
              </div>
            </div>
          )}

          {phase === 'done' && <DonePane outcomes={outcomes} folderName={folderName} />}
        </div>

        <div style={S.foot}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            {phase === 'preview' && (
              <>
                선택 {checked.size}건
                {dupeRows > 0 && ` · 이미 가져옴 ${dupeRows}건`}
                {trashedRows > 0 && ` · 휴지통에 있음 ${trashedRows}건`}
                {failedRows > 0 && ` · 오류 ${failedRows}건`}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {phase === 'preview' && <button style={btn('ghost')} onClick={() => setPhase('form')}>뒤로</button>}
            {phase === 'form' && (
              <button style={btn('primary', !canSubmit || busy)} disabled={!canSubmit || busy} onClick={fetchRows}>
                {busy ? '불러오는 중…' : '미리보기'}
              </button>
            )}
            {phase === 'preview' && (
              <button style={btn('primary', targetCount === 0)} disabled={targetCount === 0} onClick={runImport}>
                {targetCount}건 가져오기
              </button>
            )}
            {phase === 'done' && <button style={btn('primary')} onClick={onClose}>닫기</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ 설정 화면 ═══ */

function FormPane({
  sheet, setSheet, rowsText, setRowsText, includePreselected, setIncludePreselected,
  folders, folderId, setFolderId, onNewFolder, onEnter, error,
}: {
  sheet: SheetName; setSheet: (s: SheetName) => void;
  rowsText: string; setRowsText: (s: string) => void;
  includePreselected: boolean; setIncludePreselected: (b: boolean) => void;
  folders: Folder[]; folderId: string | null; setFolderId: (id: string | null) => void;
  onNewFolder: () => void; onEnter: () => void; error: string | null;
}) {
  const tree = useMemo(() => flattenVisible(buildFolderTree(folders), new Set()), [folders]);

  const row = (active: boolean, depth: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '6px 10px', paddingLeft: 10 + depth * 14,
    border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
    fontSize: 13, fontFamily: 'var(--font-ui)',
    fontWeight: active ? 700 : 500,
    background: active ? 'rgba(188,95,63,0.10)' : 'transparent',
    color: active ? ACCENT : 'var(--text-primary, #222)',
  });

  return (
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
                border: `1px solid ${sheet === s.id ? ACCENT : 'var(--border-light, #ddd)'}`,
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

      <div style={{ marginBottom: 12 }}>
        <div style={S.label}>행 범위</div>
        <input
          style={S.input}
          value={rowsText}
          onChange={(e) => setRowsText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
          placeholder="예: 15-32  또는  15, 17, 20-25"
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 6 }}>
          시트의 실제 행 번호입니다(1행은 헤더이므로 데이터는 2행부터).
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 18 }}>
        <input type="checkbox" checked={includePreselected} onChange={(e) => setIncludePreselected(e.target.checked)} style={{ marginTop: 2 }} />
        <span style={{ fontSize: 13, color: 'var(--text-primary, #222)' }}>
          사전 선별(M열 체크 표시)된 문제 포함하기
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>
            행 범위를 비워 두면 사전 선별 문제만 가져옵니다. 둘 다 쓰면 합집합입니다.
          </span>
        </span>
      </label>

      <div>
        <div style={S.label}>저장할 폴더</div>
        <div style={{
          border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
          maxHeight: 200, overflowY: 'auto', padding: 4,
        }}>
          <button style={row(folderId === null, 0)} onClick={() => setFolderId(null)}>
            <IconFolder size={14} /> 최상위(미지정)
          </button>
          {tree.map((n) => (
            <button key={n.folder.id} style={row(folderId === n.folder.id, n.depth + 1)} onClick={() => setFolderId(n.folder.id)}>
              <IconFolder size={14} /> {n.folder.name}
            </button>
          ))}
        </div>
        <button
          onClick={onNewFolder}
          style={{
            marginTop: 6, display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
            background: 'transparent', color: 'var(--text-primary, #222)',
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}
        >
          <IconPlus /> 폴더 새로 만들기
        </button>
      </div>

      {error && <div style={{ marginTop: 14, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>{error}</div>}
    </>
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
  const { draft, error, persisted, dupe } = item;
  const warned = dupe === 'existing' || dupe === 'inSelection';
  // D15: 중복이어도 체크는 막지 않는다. 막을 것은 초안이 아예 없는 오류 행뿐이다.
  const blocked = !draft;

  const summary = useMemo(
    () => (draft ? draft.tabs.map((t) => `${t.label} ${persisted[t.id]?.length ?? 0}블록`).join(' · ') : ''),
    [draft, persisted],
  );

  return (
    <div style={{
      border: '1px solid var(--border-light, #eee)', borderRadius: 6,
      marginBottom: 6, background: blocked || warned ? 'var(--bg-hover, #f7f7f7)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
        <input
          type="checkbox" checked={checked} disabled={blocked} onChange={onToggleCheck}
          title={dupe === 'existing' ? '이미 가져온 문항입니다 — 체크하면 한 벌 더 만듭니다'
               : dupe === 'inSelection' ? '이 선택 안에서 앞선 행과 같은 문항입니다'
               : dupe === 'trashed' ? '전에 가져왔지만 지금은 휴지통에 있습니다' : undefined}
        />
        <div onClick={draft ? onToggleExpand : undefined} style={{ flex: 1, cursor: draft ? 'pointer' : 'default', minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: blocked || warned ? 'var(--text-muted, #888)' : 'var(--text-primary, #222)',
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
              {dupe === 'existing' && <span style={badge('warn')}>이미 가져옴</span>}
              {dupe === 'inSelection' && <span style={badge('warn')}>선택 안 중복</span>}
              {dupe === 'trashed' && <span style={badge('muted')}>휴지통에 있음</span>}
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
              {draft.warnings.map((w, i) => <li key={i} style={{ fontSize: 12, color: ACCENT }}>{w}</li>)}
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

/* ═══ 결과 ═══ */

function DonePane({ outcomes, folderName }: { outcomes: SaveOutcome[]; folderName: string }) {
  const ok = outcomes.filter((o) => o.status === 'ok');
  const fail = outcomes.filter((o) => o.status === 'fail');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <span style={{ ...badge('ok'), fontSize: 12, padding: '4px 10px' }}>성공 {ok.length}</span>
        {fail.length > 0 && <span style={{ ...badge('warn'), fontSize: 12, padding: '4px 10px' }}>실패 {fail.length}</span>}
        <span style={{ ...badge('muted'), fontSize: 12, padding: '4px 10px' }}>{folderName}</span>
      </div>
      {fail.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={S.label}>실패한 행</div>
          {fail.map((o) => (
            <div key={o.rowIndex} style={{ fontSize: 12, color: ACCENT, marginBottom: 3 }}>
              {o.rowIndex}행 · {o.title} — {o.detail}
            </div>
          ))}
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <div style={S.label}>가져온 문항</div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {ok.map((o) => (
              <div key={o.rowIndex} style={{ fontSize: 12, color: 'var(--text-primary, #222)', marginBottom: 3 }}>
                <span style={{ ...badge('muted'), marginRight: 6 }}>{o.rowIndex}행</span>{o.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
