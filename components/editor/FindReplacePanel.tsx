'use client';

/**
 * FindReplacePanel — Phase 18 (refactored)
 *
 * 검색 옵션·쿼리를 ref로 관리하여 stale closure 문제 완전 제거.
 * 모든 검색 트리거는 triggerSearch() 직접 호출.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownEditorHandle } from './MarkdownEditor';

interface Match {
  blockId: string;
  from: number;
  to: number;
}

interface FindReplacePanelProps {
  open: boolean;
  onClose: () => void;
  editorRefs: React.MutableRefObject<Record<string, MarkdownEditorHandle | null>>;
  blockIds: string[];
}

function isWholeWord(text: string, pos: number, len: number): boolean {
  const before = pos > 0 ? text[pos - 1] : ' ';
  const after = pos + len < text.length ? text[pos + len] : ' ';
  const wordChar = /[\w가-힣]/;
  return !wordChar.test(before) && !wordChar.test(after);
}

export default function FindReplacePanel({
  open, onClose, editorRefs, blockIds,
}: FindReplacePanelProps) {
  // 렌더링용 state (UI 표시)
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  // 검색 로직용 ref (stale closure 방지)
  const queryRef = useRef('');
  const csRef = useRef(false);
  const wwRef = useRef(false);
  const reRef = useRef(false);
  const matchesRef = useRef<Match[]>([]);
  const currentIdxRef = useRef(-1);

  const findInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIdsRef = useRef(blockIds);
  blockIdsRef.current = blockIds;

  // ── 하이라이트 해제 ──
  const clearAllHighlights = useCallback(() => {
    for (const id of blockIdsRef.current) {
      const handle = editorRefs.current[id];
      if (handle) {
        try { handle.clearSearchHighlights(); } catch {}
        try { handle.clearSelection(); } catch {}
      }
    }
  }, [editorRefs]);

  // ── 하이라이트 적용 ──
  const applyHighlights = useCallback((allMatches: Match[], activeIdx: number) => {
    const grouped: Record<string, { matches: { from: number; to: number }[]; activeLocalIdx: number }> = {};
    for (const id of blockIdsRef.current) {
      grouped[id] = { matches: [], activeLocalIdx: -1 };
    }
    let gi = 0;
    for (const m of allMatches) {
      if (!grouped[m.blockId]) grouped[m.blockId] = { matches: [], activeLocalIdx: -1 };
      const li = grouped[m.blockId].matches.length;
      grouped[m.blockId].matches.push({ from: m.from, to: m.to });
      if (gi === activeIdx) grouped[m.blockId].activeLocalIdx = li;
      gi++;
    }
    for (const [blockId, data] of Object.entries(grouped)) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;
      try {
        if (data.matches.length > 0) handle.setSearchHighlights(data.matches, data.activeLocalIdx);
        else handle.clearSearchHighlights();
      } catch {}
    }
  }, [editorRefs]);

  // ── queryRef를 DOM에서 동기화 (stale ref 방어) ──
  function syncQueryFromDom() {
    if (findInputRef.current) queryRef.current = findInputRef.current.value;
  }

  // ── 순수 검색 함수 (ref에서 읽음) ──
  function runSearch(): Match[] {
    syncQueryFromDom();
    const q = queryRef.current;
    if (!q) return [];
    const cs = csRef.current;
    const ww = wwRef.current;
    const re = reRef.current;
    const ids = blockIdsRef.current;
    const results: Match[] = [];

    for (const blockId of ids) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;
      let content: string;
      try { content = handle.getContent(); } catch { continue; }
      if (!content) continue;

      if (re) {
        try {
          const flags = cs ? 'g' : 'gi';
          const regex = new RegExp(q, flags);
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            if (m[0].length === 0) break;
            if (ww && !isWholeWord(content, m.index, m[0].length)) continue;
            results.push({ blockId, from: m.index, to: m.index + m[0].length });
          }
        } catch {}
      } else {
        const haystack = cs ? content : content.toLowerCase();
        const needle = cs ? q : q.toLowerCase();
        let pos = 0;
        while (pos < haystack.length) {
          const idx = haystack.indexOf(needle, pos);
          if (idx === -1) break;
          if (ww && !isWholeWord(content, idx, needle.length)) { pos = idx + 1; continue; }
          results.push({ blockId, from: idx, to: idx + needle.length });
          pos = idx + 1;
        }
      }
    }
    return results;
  }

  // ── 매치로 이동 ──
  function navigateToMatch(match: Match, idx: number, allMatches: Match[]) {
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;
    applyHighlights(allMatches, idx);
    try { handle.setSelection(match.from, match.to); } catch {}

    requestAnimationFrame(() => {
      const coords = handle.getCursorCoords();
      const scroller = document.querySelector('.scaled-editor') as HTMLElement | null;
      if (!scroller) return;
      const scrollRect = scroller.getBoundingClientRect();
      if (coords) {
        const cursorRelTop = coords.top - scrollRect.top + scroller.scrollTop;
        const center = cursorRelTop - scrollRect.height / 2;
        scroller.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
      }
    });
  }

  // ── 핵심: 검색 트리거 (ref에서 직접 읽으므로 stale 없음) ──
  function triggerSearch(navigate = false, startIdx = 0) {
    const results = runSearch();
    matchesRef.current = results;
    setMatches(results);
    if (results.length > 0) {
      const idx = Math.min(startIdx, results.length - 1);
      currentIdxRef.current = idx;
      setCurrentIdx(idx);
      applyHighlights(results, idx);
      if (navigate) navigateToMatch(results[idx], idx, results);
    } else {
      currentIdxRef.current = -1;
      setCurrentIdx(-1);
      clearAllHighlights();
    }
  }

  // ── 쿼리 변경 (디바운스) ──
  function handleQueryChange(newQuery: string) {
    setQuery(newQuery);
    queryRef.current = newQuery;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => triggerSearch(), 150);
  }

  // ── 옵션 토글 (즉시 재검색) ──
  function toggleCaseSensitive() {
    const next = !csRef.current;
    csRef.current = next;
    setCaseSensitive(next);
    triggerSearch();
  }
  function toggleWholeWord() {
    const next = !wwRef.current;
    wwRef.current = next;
    setWholeWord(next);
    triggerSearch();
  }
  function toggleUseRegex() {
    const next = !reRef.current;
    reRef.current = next;
    setUseRegex(next);
    triggerSearch();
  }

  // ── 이전/다음 ──
  function goNext() {
    const m = matchesRef.current;
    if (m.length === 0) return;
    const next = (currentIdxRef.current + 1) % m.length;
    currentIdxRef.current = next;
    setCurrentIdx(next);
    navigateToMatch(m[next], next, m);
  }
  function goPrev() {
    const m = matchesRef.current;
    if (m.length === 0) return;
    const prev = (currentIdxRef.current - 1 + m.length) % m.length;
    currentIdxRef.current = prev;
    setCurrentIdx(prev);
    navigateToMatch(m[prev], prev, m);
  }

  // ── 바꾸기 ──
  function doReplace() {
    const idx = currentIdxRef.current;
    const m = matchesRef.current;
    if (idx < 0 || idx >= m.length) return;
    const match = m[idx];
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;
    try { handle.replaceRange(match.from, match.to, replaceText); } catch { return; }

    const nextIdx = idx;
    setTimeout(() => triggerSearch(true, nextIdx), 80);
  }

  // ── 모두 바꾸기 ──
  function doReplaceAll() {
    const m = matchesRef.current;
    if (m.length === 0) return;
    const grouped: Record<string, Match[]> = {};
    for (const match of m) {
      if (!grouped[match.blockId]) grouped[match.blockId] = [];
      grouped[match.blockId].push(match);
    }
    for (const blockId of Object.keys(grouped)) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;
      const sorted = grouped[blockId].sort((a, b) => b.from - a.from);
      for (const match of sorted) {
        try { handle.replaceRange(match.from, match.to, replaceText); } catch {}
      }
    }
    setTimeout(() => triggerSearch(), 80);
  }

  // ── 패널 열기/닫기 ──
  useEffect(() => {
    if (open && findInputRef.current) {
      setTimeout(() => { findInputRef.current?.focus(); findInputRef.current?.select(); }, 50);
    }
    if (!open) {
      clearAllHighlights();
      setMatches([]); setCurrentIdx(-1); setQuery(''); setReplaceText('');
      setShowReplace(false); setCaseSensitive(false); setWholeWord(false); setUseRegex(false);
      queryRef.current = ''; csRef.current = false; wwRef.current = false; reRef.current = false;
      matchesRef.current = []; currentIdxRef.current = -1;
    }
  }, [open, clearAllHighlights]);

  // ── 키보드 ──
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? goPrev() : goNext(); }
  }

  if (!open) return null;

  const hasMatches = matches.length > 0;
  const hasQuery = query.length > 0;
  const regexError = useRegex ? (() => { try { new RegExp(query); return false; } catch { return true; } })() : false;

  return (
    <div style={{
      padding: '8px 12px', borderBottom: '1px solid var(--border-light, #e0e0e0)',
      background: 'var(--bg-card, #fff)', fontFamily: 'var(--font-ui)', fontSize: 13,
      flexShrink: 0, display: 'flex', gap: 6, alignItems: 'flex-start',
    }} onKeyDown={handleKeyDown}>
      <button onClick={() => setShowReplace(!showReplace)} title={showReplace ? '바꾸기 숨기기' : '바꾸기 표시'}
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 2px',
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1, flexShrink: 0, marginTop: 1,
          transition: 'transform 0.15s', transform: showReplace ? 'rotate(90deg)' : 'rotate(0deg)' }}>
        ›
      </button>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* 찾기 행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center',
            border: regexError ? '1px solid var(--accent-danger)' : '1px solid var(--border-primary, #d4d0ca)',
            borderRadius: 4, background: 'var(--bg-input, #fff)', overflow: 'hidden' }}>
            <input ref={findInputRef} type="text" value={query}
              onChange={(e) => handleQueryChange(e.target.value)} placeholder="찾기"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '5px 8px',
                fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
                background: 'transparent', minWidth: 0 }} />
            <OptionToggle label="Aa" title="대소문자 구별" active={caseSensitive} onClick={toggleCaseSensitive} />
            <OptionToggle label="ab" title="전체 단어 일치" active={wholeWord} onClick={toggleWholeWord} underline />
            <OptionToggle label=".*" title="정규 표현식" active={useRegex} onClick={toggleUseRegex} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 168, justifyContent: 'flex-end', flexShrink: 0 }}>
            <span style={{ fontSize: 12,
              color: hasQuery && !hasMatches ? 'var(--accent-danger)' : 'var(--text-muted)',
              minWidth: 52, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)',
              fontVariantNumeric: 'tabular-nums' }}>
              {hasQuery ? hasMatches ? `${currentIdx + 1} / ${matches.length}` : '결과 없음' : ''}
            </span>
            <NavButton label="‹" title="이전 (Shift+Enter)" disabled={!hasMatches} onClick={goPrev} />
            <NavButton label="›" title="다음 (Enter)" disabled={!hasMatches} onClick={goNext} />
            <button onClick={onClose} title="닫기 (Esc)" style={{ border: 'none', background: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '2px 4px',
              lineHeight: 1, borderRadius: 4, flexShrink: 0 }}>✕</button>
          </div>
        </div>

        {/* 바꾸기 행 */}
        {showReplace && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center',
              border: '1px solid var(--border-primary, #d4d0ca)', borderRadius: 4,
              background: 'var(--bg-input, #fff)', overflow: 'hidden' }}>
              <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
                placeholder="바꾸기" style={{ flex: 1, border: 'none', outline: 'none', padding: '5px 8px',
                  fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
                  background: 'transparent', minWidth: 0 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 168, justifyContent: 'flex-end', flexShrink: 0 }}>
              <ActionButton label="바꾸기" title="현재 항목 바꾸기" disabled={currentIdx < 0} onClick={doReplace} />
              <ActionButton label="모두 바꾸기" title="모두 바꾸기" disabled={!hasMatches} onClick={doReplaceAll} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionToggle({ label, title, active, onClick, underline }: {
  label: string; title: string; active: boolean; onClick: () => void; underline?: boolean;
}) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title}
      style={{ border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
        background: active ? 'rgba(91,106,191,0.12)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
        cursor: 'pointer', padding: '2px 5px', fontSize: 12, fontFamily: 'monospace',
        borderRadius: 3, lineHeight: 1.3, transition: 'all 0.12s', flexShrink: 0,
        textDecoration: underline ? 'underline' : 'none', fontWeight: underline ? 700 : 400 }}>
      {label}
    </button>
  );
}

function NavButton({ label, title, disabled, onClick }: {
  label: string; title: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ border: 'none', background: 'none', cursor: disabled ? 'default' : 'pointer',
        width: 28, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 300,
        color: disabled ? 'var(--text-faint)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)', borderRadius: 4, lineHeight: 1, flexShrink: 0 }}>
      {label}
    </button>
  );
}

function ActionButton({ label, title, disabled, onClick }: {
  label: string; title: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ border: '1px solid var(--border-primary, #d4d0ca)', borderRadius: 4,
        padding: '4px 10px',
        backgroundColor: disabled ? 'var(--bg-hover)' : 'var(--bg-primary)',
        color: disabled ? 'var(--text-faint)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer', fontSize: 12, fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {label}
    </button>
  );
}
