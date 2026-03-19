'use client';

/**
 * FindReplacePanel — Phase 18
 *
 * VSCode + 구글스프레드시트 스타일 커스텀 찾기/바꾸기 패널
 * - CodeMirror Decoration 기반 매치 하이라이트 (활성=주황, 비활성=노란)
 * - 블록 전체 검색/바꾸기
 * - Ctrl+F 열기, Esc 닫기, Enter 다음, Shift+Enter 이전
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownEditorHandle } from './MarkdownEditor';

/* ── 타입 ── */

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

/* ── 전체 단어 일치 검사 ── */

function isWholeWord(text: string, pos: number, len: number): boolean {
  const before = pos > 0 ? text[pos - 1] : ' ';
  const after = pos + len < text.length ? text[pos + len] : ' ';
  const wordChar = /[\w가-힣]/;
  return !wordChar.test(before) && !wordChar.test(after);
}

/* ── 컴포넌트 ── */

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

  // 옵션
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const findInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockIdsRef = useRef(blockIds);
  blockIdsRef.current = blockIds;

  // ── 모든 에디터의 하이라이트 해제 ──
  const clearAllHighlights = useCallback(() => {
    for (const id of blockIdsRef.current) {
      const handle = editorRefs.current[id];
      if (handle) {
        try { handle.clearSearchHighlights(); } catch { /* skip */ }
        try { handle.clearSelection(); } catch { /* skip */ }
      }
    }
  }, [editorRefs]);

  // ── 패널 열릴 때 포커스, 닫힐 때 정리 ──
  useEffect(() => {
    if (open && findInputRef.current) {
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    }
    if (!open) {
      clearAllHighlights();
      setMatches([]);
      setCurrentIdx(-1);
      setQuery('');
      setReplaceText('');
      setShowReplace(false);
    }
  }, [open, clearAllHighlights]);

  // ── 검색 함수 (순수: 부작용 없음) ──
  function runSearch(searchQuery: string): Match[] {
    if (!searchQuery) return [];

    const ids = blockIdsRef.current;
    const results: Match[] = [];

    for (const blockId of ids) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;

      let content: string;
      try { content = handle.getContent(); } catch { continue; }
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
          // 잘못된 정규식 무시
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

  // ── 하이라이트 적용: 블록별로 Decoration 설정 ──
  const applyHighlights = useCallback((allMatches: Match[], activeIdx: number) => {
    // 블록별로 그룹핑
    const grouped: Record<string, { matches: { from: number; to: number }[]; activeLocalIdx: number }> = {};

    for (const id of blockIdsRef.current) {
      grouped[id] = { matches: [], activeLocalIdx: -1 };
    }

    let globalIdx = 0;
    for (const m of allMatches) {
      if (!grouped[m.blockId]) {
        grouped[m.blockId] = { matches: [], activeLocalIdx: -1 };
      }
      const localIdx = grouped[m.blockId].matches.length;
      grouped[m.blockId].matches.push({ from: m.from, to: m.to });
      if (globalIdx === activeIdx) {
        grouped[m.blockId].activeLocalIdx = localIdx;
      }
      globalIdx++;
    }

    // 각 블록에 하이라이트 적용
    for (const [blockId, data] of Object.entries(grouped)) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;
      try {
        if (data.matches.length > 0) {
          handle.setSearchHighlights(data.matches, data.activeLocalIdx);
        } else {
          handle.clearSearchHighlights();
        }
      } catch { /* skip */ }
    }
  }, [editorRefs]);

  // ── 검색 트리거 ──
  const doSearch = useCallback((searchQuery: string, navigate: boolean) => {
    const results = runSearch(searchQuery);
    setMatches(results);
    if (results.length > 0) {
      const idx = 0;
      setCurrentIdx(idx);
      applyHighlights(results, idx);
      if (navigate) {
        navigateToMatchDirect(results[idx], idx, results);
      }
    } else {
      setCurrentIdx(-1);
      clearAllHighlights();
    }
  }, [applyHighlights, clearAllHighlights]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── query / 옵션 변경 시 재검색 (디바운스) ──
  useEffect(() => {
    if (!open) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(query, false), 150);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, caseSensitive, wholeWord, useRegex, open, doSearch]);

  // ── 매치로 이동 (직접 데이터 전달 — stale closure 방지) ──
  function navigateToMatchDirect(match: Match, idx: number, allMatches: Match[]) {
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;

    // 하이라이트 갱신 (활성 인덱스 변경)
    applyHighlights(allMatches, idx);

    // 선택만 적용 (scrollToPos 사용 금지 — autoHeight 모드에서 페이지 전체가 스크롤됨)
    try {
      handle.setSelection(match.from, match.to);
    } catch { /* skip */ }

    // .scaled-editor 컨테이너 내에서만 수동 스크롤
    requestAnimationFrame(() => {
      const coords = handle.getCursorCoords();
      const blockEl = document.querySelector(`[data-block-id="${match.blockId}"]`);
      const scroller = blockEl?.closest('.scaled-editor') as HTMLElement | null;
      if (!scroller) return;

      const scrollRect = scroller.getBoundingClientRect();

      if (coords) {
        // 커서 좌표 기반 정밀 스크롤 (커서가 컨테이너 밖이면 중앙으로 이동)
        if (coords.top < scrollRect.top + 40 || coords.top > scrollRect.bottom - 40) {
          const cursorRelTop = coords.top - scrollRect.top + scroller.scrollTop;
          const center = cursorRelTop - scrollRect.height / 2;
          scroller.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
        }
      } else if (blockEl) {
        // 좌표를 못 구한 경우 블록 요소 기준으로 스크롤
        const blockRect = blockEl.getBoundingClientRect();
        if (blockRect.top < scrollRect.top || blockRect.bottom > scrollRect.bottom) {
          const offset = blockRect.top - scrollRect.top + scroller.scrollTop;
          const center = offset - scrollRect.height / 2 + blockRect.height / 2;
          scroller.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
        }
      }
    });
  }

  // ── 이전/다음 ──
  function goNext() {
    if (matches.length === 0) return;
    const next = (currentIdx + 1) % matches.length;
    setCurrentIdx(next);
    navigateToMatchDirect(matches[next], next, matches);
  }

  function goPrev() {
    if (matches.length === 0) return;
    const prev = (currentIdx - 1 + matches.length) % matches.length;
    setCurrentIdx(prev);
    navigateToMatchDirect(matches[prev], prev, matches);
  }

  // ── 바꾸기 ──
  function doReplace() {
    if (currentIdx < 0 || currentIdx >= matches.length) return;
    const match = matches[currentIdx];
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;

    try {
      handle.replaceRange(match.from, match.to, replaceText);
    } catch { return; }

    // 바꾼 후 재검색
    setTimeout(() => doSearch(query, false), 80);
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
        try { handle.replaceRange(m.from, m.to, replaceText); } catch { /* skip */ }
      }
    }

    setTimeout(() => doSearch(query, false), 80);
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

  /* ══════════ 렌더링 ══════════ */

  const hasMatches = matches.length > 0;
  const hasQuery = query.length > 0;
  const regexError = useRegex ? (() => {
    try { new RegExp(query); return false; } catch { return true; }
  })() : false;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-light, #e0e0e0)',
        background: 'var(--bg-card, #fff)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        flexShrink: 0,
        display: 'flex',
        gap: 6,
        alignItems: 'flex-start',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* ── 펼침 토글 (바꾸기 표시/숨기기) ── */}
      <button
        onClick={() => setShowReplace(!showReplace)}
        title={showReplace ? '바꾸기 숨기기' : '바꾸기 표시'}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: '4px 2px',
          fontSize: 14,
          color: 'var(--text-secondary, #5D5647)',
          lineHeight: 1,
          flexShrink: 0,
          marginTop: 1,
          transition: 'transform 0.15s',
          transform: showReplace ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      >
        ›
      </button>

      {/* ── 입력 영역 ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>

        {/* ── 찾기 행 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            border: regexError
              ? '1px solid var(--accent-danger, #e53935)'
              : '1px solid var(--border-primary, #d4d0ca)',
            borderRadius: 4,
            background: 'var(--bg-input, #fff)',
            overflow: 'hidden',
          }}>
            <input
              ref={findInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="찾기"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '5px 8px',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-primary)',
                background: 'transparent',
                minWidth: 0,
              }}
            />

            {/* 옵션 토글 버튼들 (VSCode 스타일) */}
            <OptionToggle
              label="Aa"
              title="대소문자 구별"
              active={caseSensitive}
              onClick={() => setCaseSensitive(!caseSensitive)}
            />
            <OptionToggle
              label="ab"
              title="전체 단어 일치"
              active={wholeWord}
              onClick={() => setWholeWord(!wholeWord)}
              underline
            />
            <OptionToggle
              label=".*"
              title="정규 표현식"
              active={useRegex}
              onClick={() => setUseRegex(!useRegex)}
            />
          </div>

          {/* 오른쪽 컨트롤: 카운터 + 이동 + 닫기 (바꾸기 행과 동일 너비) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 168, justifyContent: 'flex-end', flexShrink: 0 }}>
            <span style={{
              fontSize: 12,
              color: hasQuery && !hasMatches ? 'var(--accent-danger, #e53935)' : 'var(--text-muted, #999)',
              minWidth: 52,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-ui)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {hasQuery
                ? hasMatches
                  ? `${currentIdx + 1} / ${matches.length}`
                  : '결과 없음'
                : ''}
            </span>

            <NavButton label="‹" title="이전 (Shift+Enter)" disabled={!hasMatches} onClick={goPrev} />
            <NavButton label="›" title="다음 (Enter)" disabled={!hasMatches} onClick={goNext} />

            <button
              onClick={onClose}
              title="닫기 (Esc)"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #999)',
                fontSize: 16,
                padding: '2px 4px',
                lineHeight: 1,
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── 바꾸기 행 ── */}
        {showReplace && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              border: '1px solid var(--border-primary, #d4d0ca)',
              borderRadius: 4,
              background: 'var(--bg-input, #fff)',
              overflow: 'hidden',
            }}>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="바꾸기"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  padding: '5px 8px',
                  fontSize: 13,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  minWidth: 0,
                }}
              />
            </div>

            {/* 오른쪽 컨트롤 (찾기 행과 동일 너비) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 168, justifyContent: 'flex-end', flexShrink: 0 }}>
              <ActionButton
                label="바꾸기"
                title="현재 항목 바꾸기"
                disabled={currentIdx < 0}
                onClick={doReplace}
              />
              <ActionButton
                label="모두 바꾸기"
                title="모두 바꾸기"
                disabled={!hasMatches}
                onClick={doReplaceAll}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════ 하위 컴포넌트 ══════════ */

/** 옵션 토글 버튼 (Aa, ab, .*) */
function OptionToggle({
  label, title, active, onClick, underline,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  underline?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        border: active ? '1px solid var(--accent-primary, #5b6abf)' : '1px solid transparent',
        background: active ? 'rgba(91, 106, 191, 0.12)' : 'transparent',
        color: active ? 'var(--accent-primary, #5b6abf)' : 'var(--text-muted, #999)',
        cursor: 'pointer',
        padding: '2px 5px',
        fontSize: 12,
        fontFamily: 'monospace',
        borderRadius: 3,
        lineHeight: 1.3,
        transition: 'all 0.12s',
        flexShrink: 0,
        textDecoration: underline ? 'underline' : 'none',
        fontWeight: underline ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
}

/** 이전/다음 이동 버튼 */
function NavButton({
  label, title, disabled, onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        border: 'none',
        background: 'none',
        cursor: disabled ? 'default' : 'pointer',
        width: 28,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 300,
        color: disabled ? 'var(--text-faint, #ccc)' : 'var(--text-secondary, #5D5647)',
        fontFamily: 'var(--font-ui)',
        borderRadius: 4,
        lineHeight: 1,
        flexShrink: 0,
        transition: 'color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

/** 바꾸기 / 모두 바꾸기 버튼 */
function ActionButton({
  label, title, disabled, onClick,
}: {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        border: '1px solid var(--border-primary, #d4d0ca)',
        borderRadius: 4,
        padding: '4px 10px',
        backgroundColor: disabled ? 'var(--bg-hover, #f0ece8)' : 'var(--bg-primary, #FAF9F7)',
        color: disabled ? 'var(--text-faint, #ccc)' : 'var(--text-secondary, #5D5647)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontFamily: 'var(--font-ui)',
        transition: 'background 0.12s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}