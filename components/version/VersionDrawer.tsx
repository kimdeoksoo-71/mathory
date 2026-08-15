'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ProblemVersion, VersionContent, SnapshotResult } from '../../types/version';
import { useVersionHistory } from '../../hooks/useVersionHistory';
import { loadContent, resolveLivingParent } from '../../lib/version/read';
import { diffContent } from '../../lib/version/diff';
import { setVersionName, setVersionPinned } from '../../lib/version/meta';
import { IconTag, IconPin, IconRename, IconClose } from '../ui/Icons';
import VersionTimeline from './VersionTimeline';
import VersionDiff from './VersionDiff';
import RestoreConfirm from './RestoreConfirm';

/**
 * Phase 55 Stage 5 — 우측 버전 기록 드로어.
 * 타임라인 + 선택 버전 diff(기본: 부모와 비교 / 토글: 현재 작업본과 비교) + 비파괴 복원.
 *
 * Phase 55b — 조작 버튼의 스코프가 둘로 나뉜다:
 *   - 헤더 '이름 저장'   → 스코프: **현재 작업본**. 이름이 붙는 대상은 언제나 최신 버전이다.
 *   - 선택 버전 툴바     → 스코프: **선택된 버전**(이름 변경·핀).
 *   조작 버튼을 타임라인 항목 안에 두지 않는 이유: 항목 자체가 <button>이라 중첩이 무효 HTML이고
 *   클릭이 버블링돼 버전 선택이 함께 발동한다. 타임라인은 표시 전용으로 유지한다.
 */
export default function VersionDrawer({
  problemId,
  open,
  onClose,
  getCurrentContent,
  onRestore,
  onNamedSave,
}: {
  problemId: string;
  open: boolean;
  onClose: () => void;
  getCurrentContent: () => VersionContent | null;
  onRestore: (target: ProblemVersion, content: VersionContent) => Promise<void>;
  onNamedSave: (name: string) => Promise<SnapshotResult>;
}) {
  const { versions, loading, hasMore, loadFirst, loadMore, patchVersion } = useVersionHistory(problemId);
  const [selected, setSelected] = useState<ProblemVersion | null>(null);
  const [vContent, setVContent] = useState<VersionContent | null>(null);
  const [parentContent, setParentContent] = useState<VersionContent | null>(null);
  const [compareMode, setCompareMode] = useState<'parent' | 'current'>('parent');
  const [currentSnap, setCurrentSnap] = useState<VersionContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  // Phase 55b: 이름 입력기. scope='header' → 새 이름 저장 / 'toolbar' → 선택 버전 이름 변경
  const [nameEditor, setNameEditor] = useState<{ scope: 'header' | 'toolbar'; value: string } | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  /**
   * selected는 별도 state라 patchVersion(versions[] 갱신)이 반영되지 않는다.
   * 툴바·게이트·배지는 항상 이 파생값을 읽어 최신 메타를 본다. selected는 선택 앵커로만 쓴다.
   */
  const sel = useMemo(
    () => versions.find((x) => x.id === selected?.id) ?? selected,
    [versions, selected],
  );

  useEffect(() => {
    if (open) {
      loadFirst();
      setSelected(null); setVContent(null); setParentContent(null); setCompareMode('parent');
      setNameEditor(null); setNotice(null);
    }
  }, [open, loadFirst]);

  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSelect = async (v: ProblemVersion) => {
    setSelected(v);
    setVContent(null); setParentContent(null); setCompareMode('parent'); setCurrentSnap(null);
    setNameEditor((prev) => (prev?.scope === 'toolbar' ? null : prev));
    setContentLoading(true);
    try {
      const vc = await loadContent(problemId, v.id);
      setVContent(vc);
      const parent = await resolveLivingParent(problemId, v, versions);
      setParentContent(parent ? await loadContent(problemId, parent.id) : null);
    } catch (e) {
      console.error('[Phase55] 버전 본문 로드 실패:', e);
    } finally {
      setContentLoading(false);
    }
  };

  const toggleCompare = () => {
    if (compareMode === 'parent') {
      setCurrentSnap(getCurrentContent());
      setCompareMode('current');
    } else {
      setCompareMode('parent');
    }
  };

  const shownDiff = useMemo(() => {
    if (!vContent) return null;
    if (compareMode === 'current') return currentSnap ? diffContent(vContent, currentSnap) : null;
    return diffContent(parentContent, vContent);
  }, [compareMode, vContent, parentContent, currentSnap]);

  const restoreDiff = useMemo(() => {
    if (!restoreOpen || !vContent) return null;
    return diffContent(getCurrentContent(), vContent);
  }, [restoreOpen, vContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRestore = async () => {
    if (!selected || !vContent) return;
    setRestoreBusy(true);
    try {
      await onRestore(selected, vContent);
      setRestoreOpen(false);
    } finally {
      setRestoreBusy(false);
    }
  };

  /* ═══ Phase 55b: 이름 저장 (스코프 = 현재 작업본) ═══ */

  const openHeaderEditor = () => {
    // 탭 로드 실패 상태면 스냅샷 자체가 막힌다(collectCurrentContent가 던짐) → 미리 안내
    if (!getCurrentContent()) {
      flash('일부 탭을 불러오지 못해 이름 저장을 할 수 없습니다', 'error');
      return;
    }
    setNameEditor({ scope: 'header', value: '' });
  };

  const commitNamedSave = async (rawName: string) => {
    const name = rawName.trim();
    if (!name) { setNameEditor(null); return; }
    setMetaBusy(true);
    try {
      const res = await onNamedSave(name);
      setNameEditor(null);

      if (res.status === 'created') {
        flash(`v${res.version.seq} 이름 저장됨`);
        await loadFirst();
        // 이름이 붙은 대상은 언제나 최신 버전이므로, 곧바로 조작할 수 있도록 자동 선택한다.
        // (loadFirst 직후 versions는 아직 갱신 전일 수 있으나 resolveLivingParent가 getDoc으로 폴백한다)
        handleSelect(res.version);
      } else if (res.status === 'named_existing') {
        patchVersion(res.versionId, { name });
        const target = versions.find((v) => v.id === res.versionId);
        flash(target ? `기존 v${target.seq}에 이름을 붙였습니다` : '기존 버전에 이름을 붙였습니다');
        if (target) handleSelect(target);
      } else if (res.status === 'unchanged') {
        flash('저장된 버전이 없어 이름을 붙일 수 없습니다 — 먼저 저장하세요', 'error');
      } else {
        flash('이름 저장 실패', 'error');
      }
    } finally {
      setMetaBusy(false);
    }
  };

  /* ═══ Phase 55b: 선택 버전 메타 조작 (스코프 = 선택된 버전) ═══ */

  const commitRename = async (rawName: string) => {
    if (!sel) return;
    const next = rawName.trim() || null;   // 빈 입력 = 이름 해제
    setMetaBusy(true);
    try {
      await setVersionName(problemId, sel.id, next);
      patchVersion(sel.id, { name: next });
      setNameEditor(null);
      flash(next ? '이름을 변경했습니다' : '이름을 해제했습니다');
    } catch (e) {
      console.error('[Phase55b] 이름 변경 실패:', e);
      flash('이름 변경 실패', 'error');
    } finally {
      setMetaBusy(false);
    }
  };

  const togglePin = async () => {
    if (!sel) return;
    const next = !sel.pinned;
    setMetaBusy(true);
    try {
      await setVersionPinned(problemId, sel.id, next);
      patchVersion(sel.id, { pinned: next });
      flash(next ? '이 버전을 고정했습니다' : '고정을 해제했습니다');
    } catch (e) {
      console.error('[Phase55b] 핀 토글 실패:', e);
      flash('고정 변경 실패', 'error');
    } finally {
      setMetaBusy(false);
    }
  };

  const iconBtn = (active?: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border-light)', borderRadius: 5, padding: '3px 6px',
    background: 'transparent', cursor: metaBusy ? 'wait' : 'pointer',
    color: active ? 'var(--accent-primary, #e53935)' : 'var(--text-muted)',
  });

  const nameInput = (onCommit: (v: string) => void, placeholder: string) => (
    <input
      autoFocus
      value={nameEditor?.value ?? ''}
      placeholder={placeholder}
      disabled={metaBusy}
      onChange={(e) => setNameEditor((p) => (p ? { ...p, value: e.target.value } : p))}
      onKeyDown={(e) => {
        // Korean IME: 조합 중 Enter는 확정용이라 커밋으로 세면 안 된다
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onCommit(nameEditor?.value ?? '');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setNameEditor(null);
        }
      }}
      style={{
        flex: 1, minWidth: 0, fontSize: 12, padding: '3px 7px', borderRadius: 5,
        border: '1px solid var(--accent-primary, #e53935)', background: 'var(--bg-input, #fff)',
        color: 'var(--text-primary)', outline: 'none',
      }}
    />
  );

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, maxWidth: '92vw',
      transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.22s ease',
      background: 'var(--bg-panel, #fff)', borderLeft: '1px solid var(--border-light)',
      boxShadow: open ? '-6px 0 24px rgba(0,0,0,0.08)' : 'none',
      display: 'flex', flexDirection: 'column', zIndex: 1200,
    }}>
      {/* 헤더 — 스코프: 현재 작업본 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 57, padding: '0 14px',
        borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-functional)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
          버전 기록
        </span>

        {nameEditor?.scope === 'header' ? (
          nameInput(commitNamedSave, '이 버전의 이름 (Enter)')
        ) : (
          <button
            onClick={openHeaderEditor}
            disabled={metaBusy}
            title="현재 작업본에 이름 붙여 저장"
            aria-label="현재 작업본에 이름 붙여 저장"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4,
              border: '1px solid var(--border-light)', borderRadius: 5, padding: '3px 8px',
              background: 'transparent', color: 'var(--text-secondary)',
              cursor: metaBusy ? 'wait' : 'pointer', fontSize: 11, fontWeight: 600,
            }}
          ><IconTag size={13} />이름 저장</button>
        )}

        <button onClick={onClose} title="닫기" aria-label="닫기" style={{
          marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 4, lineHeight: 1, display: 'flex', flexShrink: 0,
        }}><IconClose size={16} /></button>
      </div>

      {/* 알림 */}
      {notice && (
        <div style={{
          flexShrink: 0, padding: '6px 14px', fontSize: 11,
          borderBottom: '1px solid var(--border-light)',
          background: notice.tone === 'error' ? 'var(--bg-warn, #fff8e1)' : 'var(--bg-functional, #fafafa)',
          color: notice.tone === 'error' ? 'var(--accent-danger, #e53935)' : 'var(--text-secondary)',
        }}>{notice.text}</div>
      )}

      {/* 타임라인 — 표시 전용 */}
      <div style={{ flex: selected ? '0 0 42%' : 1, overflowY: 'auto', minHeight: 0 }}>
        <VersionTimeline
          versions={versions} selectedId={selected?.id ?? null} onSelect={handleSelect}
          hasMore={hasMore} loading={loading} onLoadMore={loadMore}
        />
      </div>

      {/* 선택 버전 툴바 + diff + 복원 — 스코프: 선택된 버전 */}
      {sel && (
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          borderTop: '2px solid var(--border-light)', background: 'var(--bg-functional, #fafafa)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
            borderBottom: '1px solid var(--border-light)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>v{sel.seq}</span>

            {nameEditor?.scope === 'toolbar' ? (
              nameInput(commitRename, '이름 (비우면 해제)')
            ) : (
              <>
                <button onClick={toggleCompare} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
                  border: '1px solid var(--border-light)', background: 'transparent',
                  color: 'var(--text-muted)', flexShrink: 0,
                }}>
                  {compareMode === 'parent' ? '이전 버전과 비교' : '현재 작업본과 비교'}
                </button>

                <button
                  onClick={() => setNameEditor({ scope: 'toolbar', value: sel.name || '' })}
                  disabled={metaBusy}
                  title="이 버전의 이름 변경" aria-label="이 버전의 이름 변경"
                  style={iconBtn(!!sel.name)}
                ><IconRename size={13} /></button>

                <button
                  onClick={togglePin}
                  disabled={metaBusy}
                  title={sel.pinned ? '고정 해제' : '이 버전 고정'}
                  aria-label={sel.pinned ? '고정 해제' : '이 버전 고정'}
                  style={iconBtn(sel.pinned)}
                ><IconPin size={13} filled={!!sel.pinned} /></button>

                <button onClick={() => setRestoreOpen(true)} style={{
                  marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 5,
                  cursor: 'pointer', border: 'none', background: '#e53935', color: '#fff',
                  fontWeight: 600, flexShrink: 0,
                }}>이 버전으로 복원</button>
              </>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 12px' }}>
            {contentLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>본문 불러오는 중…</div>}
            {!contentLoading && shownDiff && <VersionDiff diff={shownDiff} />}
          </div>
        </div>
      )}

      {restoreOpen && sel && (
        <RestoreConfirm
          seq={sel.seq} diff={restoreDiff} busy={restoreBusy}
          onConfirm={doRestore} onCancel={() => setRestoreOpen(false)}
        />
      )}
    </div>
  );
}
