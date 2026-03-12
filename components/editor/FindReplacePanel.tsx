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
  blockIds: string[]; // 현재 탭의 블록 ID 순서
}

export default function FindReplacePanel({
  open,
  onClose,
  editorRefs,
  blockIds,
}: FindReplacePanelProps) {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [showReplace, setShowReplace] = useState(false);

  // 검색 옵션
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const findInputRef = useRef<HTMLInputElement>(null);

  // ── 패널 열릴 때 포커스 ──
  useEffect(() => {
    if (open && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [open]);

  // ── 검색 실행 ──
  const doSearch = useCallback(() => {
    if (!query) {
      setMatches([]);
      setCurrentIdx(-1);
      return;
    }

    const results: Match[] = [];

    for (const blockId of blockIds) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;

      const content = handle.getContent();
      if (!content) continue;

      if (useRegex) {
        try {
          const flags = caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(query, flags);
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            if (wholeWord && !isWholeWord(content, m.index, m[0].length)) continue;
            results.push({ blockId, from: m.index, to: m.index + m[0].length });
            if (m[0].length === 0) break; // 무한 루프 방지
          }
        } catch {
          // 잘못된 정규식 — 무시
        }
      } else {
        const searchIn = caseSensitive ? content : content.toLowerCase();
        const searchFor = caseSensitive ? query : query.toLowerCase();
        let pos = 0;

        while (pos < searchIn.length) {
          const idx = searchIn.indexOf(searchFor, pos);
          if (idx === -1) break;
          if (wholeWord && !isWholeWord(content, idx, searchFor.length)) {
            pos = idx + 1;
            continue;
          }
          results.push({ blockId, from: idx, to: idx + searchFor.length });
          pos = idx + 1;
        }
      }
    }

    setMatches(results);
    setCurrentIdx(results.length > 0 ? 0 : -1);

    // 첫 번째 결과로 이동
    if (results.length > 0) {
      goToMatch(results[0]);
    }
  }, [query, blockIds, editorRefs, caseSensitive, wholeWord, useRegex]);

  // ── query나 옵션 변경 시 자동 검색 ──
  useEffect(() => {
    doSearch();
  }, [doSearch]);

  // ── 전체 단어 일치 검사 ──
  function isWholeWord(text: string, pos: number, len: number): boolean {
    const before = pos > 0 ? text[pos - 1] : ' ';
    const after = pos + len < text.length ? text[pos + len] : ' ';
    const wordChar = /[\w가-힣]/;
    return !wordChar.test(before) && !wordChar.test(after);
  }

  // ── 특정 매치로 이동 ──
  function goToMatch(match: Match) {
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;
    handle.focus();
    handle.setSelection(match.from, match.to);

    // 해당 블록 요소를 뷰포트에 스크롤
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
    goToMatch(matches[next]);
  }

  function goPrev() {
    if (matches.length === 0) return;
    const prev = (currentIdx - 1 + matches.length) % matches.length;
    setCurrentIdx(prev);
    goToMatch(matches[prev]);
  }

  // ── 바꾸기 (현재 항목) ──
  function doReplace() {
    if (currentIdx < 0 || currentIdx >= matches.length) return;

    const match = matches[currentIdx];
    const handle = editorRefs.current[match.blockId];
    if (!handle) return;

    handle.replaceRange(match.from, match.to, replace);

    // 매치 목록 갱신 후 다음으로 이동
    // 짧은 딜레이로 에디터 상태 반영 대기
    setTimeout(() => {
      doSearch();
    }, 50);
  }

  // ── 모두 바꾸기 ──
  function doReplaceAll() {
    if (matches.length === 0) return;

    // 역순으로 바꿔야 위치가 안 꼬임 (같은 블록 내)
    const grouped: Record<string, Match[]> = {};
    for (const m of matches) {
      if (!grouped[m.blockId]) grouped[m.blockId] = [];
      grouped[m.blockId].push(m);
    }

    let totalReplaced = 0;
    for (const blockId of Object.keys(grouped)) {
      const handle = editorRefs.current[blockId];
      if (!handle) continue;

      // 역순 정렬
      const sorted = grouped[blockId].sort((a, b) => b.from - a.from);
      for (const m of sorted) {
        handle.replaceRange(m.from, m.to, replace);
        totalReplaced++;
      }
    }

    setTimeout(() => {
      doSearch();
    }, 50);
  }

  // ── 키보드 단축키 ──
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goPrev();
      } else {
        goNext();
      }
    }
  }

  if (!open) return null;

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
    whiteSpace: 'nowrap',
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

  const checkLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap',
  };

  const navBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: matches.length > 0 ? 'pointer' : 'default',
    padding: '2px 6px',
    fontSize: 16,
    color: matches.length > 0 ? 'var(--text-secondary)' : 'var(--text-faint)',
    fontFamily: 'var(--font-ui)',
    borderRadius: 4,
    lineHeight: 1,
  };

  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-card)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* ── 제목 줄 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          letterSpacing: 0.3,
        }}>
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
              color: 'var(--text-muted)', fontSize: 16, padding: '0 4px',
              lineHeight: 1,
            }}
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── 찾기 행 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showReplace ? 6 : 0 }}>
        <input
          ref={findInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="찾기..."
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-primary)';
            e.target.style.boxShadow = '0 0 0 2px rgba(184,132,92,0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-primary)';
            e.target.style.boxShadow = 'none';
          }}
        />

        {/* 현재/전체 카운트 */}
        <span style={{
          fontSize: 12, color: 'var(--text-muted)',
          minWidth: 50, textAlign: 'center', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-ui)',
        }}>
          {matches.length > 0 ? `${currentIdx + 1} / ${matches.length}` : query ? '0 / 0' : ''}
        </span>

        {/* 이전/다음 */}
        <button onClick={goPrev} style={navBtnStyle} title="이전 (Shift+Enter)">
          ‹
        </button>
        <button onClick={goNext} style={navBtnStyle} title="다음 (Enter)">
          ›
        </button>
      </div>

      {/* ── 바꾸기 행 ── */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="바꾸기..."
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-primary)';
              e.target.style.boxShadow = '0 0 0 2px rgba(184,132,92,0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-primary)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={doReplace}
            style={btnStyle}
            disabled={currentIdx < 0}
            title="현재 항목 바꾸기"
          >
            바꾸기
          </button>
          <button
            onClick={doReplaceAll}
            style={btnStyle}
            disabled={matches.length === 0}
            title="모두 바꾸기"
          >
            모두 바꾸기
          </button>
        </div>
      )}

      {/* ── 옵션 행 ── */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <label style={checkLabelStyle}>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            style={{ width: 13, height: 13, margin: 0 }}
          />
          대소문자 일치
        </label>
        <label style={checkLabelStyle}>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
            style={{ width: 13, height: 13, margin: 0 }}
          />
          전체 일치
        </label>
        <label style={checkLabelStyle}>
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
            style={{ width: 13, height: 13, margin: 0 }}
          />
          정규식
        </label>
      </div>
    </div>
  );
}
