'use client';

/**
 * 찾기 및 바꾸기 패널
 *
 * 모든 편집 블록을 가로질러 텍스트를 검색/바꾸기합니다.
 * - 편집창 전체(모든 블록)에서 검색
 * - 현재 위치 / 전체 개수 표시
 * - 대소문자 일치, 전체 일치, 정규식 옵션
 * - 바꾸기, 모두 바꾸기
 */

import { useState, useEffect, useRef } from 'react';
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

export default function FindReplacePanel({
  open,
  onClose,
  editorRefs,
  blockIds,
}: FindReplacePanelProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const findInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // blockIds를 ref로 보관 (배열 비교 문제 방지)
  const blockIdsRef = useRef(blockIds);
  blockIdsRef.current = blockIds;

  // ── 패널 열릴 때 포커스 ──
  useEffect(() => {
    if (open && findInputRef.current) {
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    }
    if (!open) {
      setMatches([]);
      setCurrentIdx(-1);
    }
  }, [open]);

  // ── 핵심: 검색 함수 (ref 기반, 부작용 없음) ──
  function runSearch(searchQuery: string): Match[] {
    if (!searchQuery) return [];

    const ids = blockIdsRef.current;
    const results: Match[] = [];

    for (const blockId of ids) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;

      let content: string;
      try {
        content = handle.getContent();
      } catch {
        continue;
      }
      if (!content) continue;

      if (useRegex) {
        try {
          const flags = caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(searchQuery, flags);
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            if (m[0].length === 0) break;
            if (wholeWord && !isWholeWord(content, m.index, m[0].length)) continue;
            results.push({ blockId, from: m.index, to: m.index + m[0].length });
          }
        } catch {
          // 잘못된 정규식
        }
      } else {
        const haystack = caseSensitive ? content : content.toLowerCase();
        const needle = caseSensitive ? searchQuery : searchQuery.toLowerCase();
        let pos = 0;

        while (pos < haystack.length) {
          const idx = haystack.indexOf(needle, pos);
          if (idx === -1) break;
          if (wholeWord && !isWholeWord(content, idx, needle.length)) {
            pos = idx + 1;
            continue;
          }
          results.push({ blockId, from: idx, to: idx + needle.length });
          pos = idx + 1;
        }
      }
    }

    return results;
  }

  // ── 검색 트리거 (디바운스) ──
  // navigate=true일 때만 에디터로 포커스 이동 (사용자가 ‹ › Enter 클릭 시)
  function triggerSearch(navigate?: boolean) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const doIt = () => {
      const results = runSearch(query);
      setMatches(results);
      if (results.length > 0) {
        setCurrentIdx(0);
        if (navigate) {
          navigateToMatch(results[0]);
        }
      } else {
        setCurrentIdx(-1);
      }
    };

    if (navigate) {
      doIt();
    } else {
      searchTimerRef.current = setTimeout(doIt, 200);
    }
  }

  // ── query 변경 시 검색 (포커스 이동 없이 매치만 갱신) ──
  useEffect(() => {
    if (!open) return;
    triggerSearch(false);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, caseSensitive, wholeWord, useRegex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 전체 단어 일치 검사 ──
  function isWholeWord(text: string, pos: number, len: number): boolean {
    const before = pos > 0 ? text[pos - 1] : ' ';
    const after = pos + len < text.length ? text[pos + len] : ' ';
    const wordChar = /[\w가-힣]/;
    return !wordChar.test(before) && !wordChar.test(after);
  }

  // ── 매치로 이동 ──
  function navigateToMatch(match: Match) {
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;

    try {
      handle.focus();
      handle.setSelection(match.from, match.to);
    } catch {
      // 에디터가 마운트 해제된 경우
    }

    const blockEl = document.querySelector(`[data-block-id="${match.blockId}"]`);
    if (blockEl) {
      blockEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── 이전/다음 ──
  function goNext() {
    if (matches.length === 0) return;
    const next = (currentIdx + 1) % matches.length;
    setCurrentIdx(next);
    navigateToMatch(matches[next]);
  }

  function goPrev() {
    if (matches.length === 0) return;
    const prev = (currentIdx - 1 + matches.length) % matches.length;
    setCurrentIdx(prev);
    navigateToMatch(matches[prev]);
  }

  // ── 바꾸기 ──
  function doReplace() {
    if (currentIdx < 0 || currentIdx >= matches.length) return;
    const match = matches[currentIdx];
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;

    try {
      handle.replaceRange(match.from, match.to, replaceText);
    } catch {
      return;
    }

    // 바꾼 후 재검색 (포커스 이동 없이)
    setTimeout(() => triggerSearch(false), 80);
  }

  // ── 모두 바꾸기 ──
  function doReplaceAll() {
    if (matches.length === 0) return;

    // 블록별로 그룹핑 후 역순으로 바꾸기 (위치 꼬임 방지)
    const grouped: Record<string, Match[]> = {};
    for (const m of matches) {
      if (!grouped[m.blockId]) grouped[m.blockId] = [];
      grouped[m.blockId].push(m);
    }

    for (const blockId of Object.keys(grouped)) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;

      const sorted = grouped[blockId].sort((a, b) => b.from - a.from);
      for (const m of sorted) {
        try {
          handle.replaceRange(m.from, m.to, replaceText);
        } catch {
          // skip
        }
      }
    }

    setTimeout(() => triggerSearch(false), 80);
  }

  // ── 키보드 ──
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goPrev();
      } else {
        goNext();
      }
    }
  }

  if (!open) return null;

  /* ── 스타일 ── */

  const btnStyle: React.CSSProperties = {
    border: '1px solid var(--border-primary, #E0DCD6)',
    borderRadius: 4,
    padding: '3px 10px',
    backgroundColor: 'var(--bg-primary, #FAF9F7)',
    color: 'var(--text-secondary, #5D5647)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap' as const,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 120,
    border: '1px solid var(--border-primary, #E0DCD6)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 13,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    color: 'var(--text-primary)',
    background: 'var(--bg-input, #fff)',
  };

  const checkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap' as const,
  };

  const navBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: matches.length > 0 ? 'pointer' : 'default',
    padding: '2px 6px',
    fontSize: 18,
    color: matches.length > 0 ? 'var(--text-secondary)' : 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
    borderRadius: 4,
    lineHeight: 1,
  };

  const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent-primary)';
    e.target.style.boxShadow = '0 0 0 2px rgba(184,132,92,0.15)';
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border-primary, #E0DCD6)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        flexShrink: 0,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* ── 제목 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.3 }}>
          {showReplace ? '찾기 및 바꾸기' : '찾기'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowReplace(!showReplace)}
            style={{
              ...btnStyle, padding: '2px 8px', fontSize: 11,
              background: showReplace ? 'var(--bg-active)' : 'var(--bg-primary)',
            }}
          >
            {showReplace ? '찾기만' : '바꾸기'}
          </button>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 16, padding: '0 4px', lineHeight: 1,
            }}
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── 찾기 행 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showReplace ? 6 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            ref={findInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="찾기..."
            style={{ ...inputStyle, width: '100%' }}
            onFocus={focusHandler}
            onBlur={blurHandler}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 130, justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 12, color: 'var(--text-muted)',
            minWidth: 50, textAlign: 'center', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-ui)',
          }}>
            {matches.length > 0
              ? `${currentIdx + 1} / ${matches.length}`
              : query ? '0 / 0' : ''}
          </span>
          <button onClick={goPrev} style={navBtnStyle} title="이전 (Shift+Enter)">‹</button>
          <button onClick={goNext} style={navBtnStyle} title="다음 (Enter)">›</button>
        </div>
      </div>

      {/* ── 바꾸기 행 ── */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="바꾸기..."
              style={{ ...inputStyle, width: '100%' }}
              onFocus={focusHandler}
              onBlur={blurHandler}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 130, justifyContent: 'flex-end' }}>
            <button onClick={doReplace} style={btnStyle} disabled={currentIdx < 0} title="현재 항목 바꾸기">
              바꾸기
            </button>
            <button onClick={doReplaceAll} style={btnStyle} disabled={matches.length === 0} title="모두 바꾸기">
              모두 바꾸기
            </button>
          </div>
        </div>
      )}

      {/* ── 옵션 행 ── */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <label style={checkStyle}>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} style={{ width: 13, height: 13, margin: 0 }} />
          대소문자 일치
        </label>
        <label style={checkStyle}>
          <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} style={{ width: 13, height: 13, margin: 0 }} />
          전체 일치
        </label>
        <label style={checkStyle}>
          <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} style={{ width: 13, height: 13, margin: 0 }} />
          정규식
        </label>
      </div>
    </div>
  );
}
