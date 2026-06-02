'use client';

/**
 * MathSymbolPalette — Phase 40 수식 기호 팔레트 (§12~14, §3)
 *
 * 단일 트리거(f(x)) → 팝업 패널(검색 + 탭 + 기호 그리드 + ⚙ 설정).
 * 탭: 로그인 사용자가 설정(config.groups)했으면 그 그룹, 아니면 기본 7탭(CURATED_SYMBOLS).
 * 아이콘은 KaTeX 하이브리드 렌더(공유 캐시). 클릭 시 onInsert(template, cursorOffset).
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { renderKatexCached } from '../../lib/katex-render';
import { CURATED_SYMBOLS, ALL_SYMBOLS, DEFAULT_CATEGORIES } from '../../lib/math-symbols';
import useToolbarConfig from '../../hooks/useToolbarConfig';
import SymbolSettingsModal from './settings/SymbolSettingsModal';
import SymbolCell from './settings/SymbolCell';
import type { MathSymbol } from '../../types/toolbar-config';

interface Props {
  onInsert: (template: string, cursorOffset: number) => void;
  /** 일반 텍스트 컨텍스트(대화 패널 등)에서 true → 삽입 시 $…$로 감쌈. 기본 false(에디터: 이미 수식 안). */
  wrapInDollar?: boolean;
  /** true → 팝업이 트리거 위로 열림(하단 입력창용). 기본 false(아래로). */
  openUp?: boolean;
  /** true → 팝업을 트리거 오른쪽 끝 기준 왼쪽으로 펼침(우측 정렬 트리거용). 기본 false(왼쪽 기준). */
  alignRight?: boolean;
}

// ── 삽입 텍스트/커서 계산 ──
function buildInsert(sym: MathSymbol, wrap: boolean): { text: string; offset: number } {
  const isStructured = !!sym.displayLatex;
  if (wrap) {
    const text = '$' + sym.latex + '$';
    const offset = (isStructured && sym.cursorOffset != null)
      ? 1 + sym.cursorOffset
      : text.length;
    return { text, offset };
  }
  const text = isStructured ? sym.latex : sym.latex + ' ';
  const offset = sym.cursorOffset ?? text.length;
  return { text, offset };
}

export default function MathSymbolPalette({ onInsert, wrapInDollar = false, openUp = false, alignRight = false }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { config, isLoggedIn, applyPreset, save } = useToolbarConfig();
  const byId = useMemo(() => new Map(ALL_SYMBOLS.map((s) => [s.id, s])), []);

  // 탭 도출: 사용자 설정 그룹 우선, 없으면 기본 7탭
  const tabs = useMemo<{ id: string; label: string; symbols: MathSymbol[] }[]>(() => {
    if (config && config.groups.length) {
      return config.groups
        .slice().sort((a, b) => a.order - b.order)
        .map((g) => ({
          id: g.id,
          label: g.name,
          symbols: g.symbolIds.map((id) => byId.get(id)).filter(Boolean) as MathSymbol[],
        }));
    }
    return DEFAULT_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      symbols: CURATED_SYMBOLS.filter((s) => c.fields.includes(s.field)),
    }));
  }, [config, byId]);

  // 외부 클릭 / Esc 닫기 (설정 모달 열려있으면 유지)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (settingsOpen) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !settingsOpen) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, settingsOpen]);

  const q = query.trim().toLowerCase();
  const activeId = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0]?.id;
  const searchPool = config ? ALL_SYMBOLS : CURATED_SYMBOLS;
  const visibleSymbols = useMemo(() => {
    if (q) {
      return searchPool.filter(
        (s) =>
          s.name.ko.toLowerCase().includes(q) ||
          s.name.en.toLowerCase().includes(q) ||
          s.latex.toLowerCase().includes(q),
      );
    }
    return tabs.find((t) => t.id === activeId)?.symbols ?? [];
  }, [q, activeId, tabs, searchPool]);

  const handlePick = (sym: MathSymbol) => {
    const { text, offset } = buildInsert(sym, wrapInDollar);
    onInsert(text, offset);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="수식 기호 팔레트"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          height: 28, padding: '0 10px',
          fontSize: 13, fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          background: open ? '#e0e7ff' : '#f0f3fb',
          border: '1px solid #ccc', borderRadius: 4,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: renderKatexCached('\\sum') }} />
        <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            ...(openUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
            ...(alignRight ? { right: 0 } : { left: 0 }),
            width: 340,
            background: '#fff', border: '1px solid #ddd', borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14)', zIndex: 1000,
            padding: 10, animation: 'fadeIn 0.1s ease',
          }}
        >
          {/* 검색 + 설정 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색 (이름 / LaTeX)"
              style={{
                flex: 1, boxSizing: 'border-box', height: 30, padding: '0 10px',
                border: '1px solid #ddd', borderRadius: 6, fontSize: 13, outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="기호 설정"
              style={{
                width: 30, height: 30, flexShrink: 0,
                border: '1px solid #ddd', borderRadius: 6, background: '#fff',
                cursor: 'pointer', fontSize: 15, lineHeight: 1,
              }}
            >⚙</button>
          </div>

          {/* 탭 (검색 중이 아닐 때) */}
          {!q && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {tabs.map((t) => {
                const active = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      flex: '0 0 auto', height: 28, padding: '0 10px',
                      fontSize: 12, fontWeight: active ? 700 : 400,
                      color: active ? '#3730a3' : '#555',
                      background: active ? '#eef2ff' : '#f7f7f7',
                      border: active ? '1px solid #c7d2fe' : '1px solid transparent',
                      borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 기호 그리드 */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)',
              gap: 6, justifyContent: 'space-between',
              maxHeight: 240, overflowY: 'auto',
            }}
          >
            {visibleSymbols.map((sym) => (
              <SymbolCell key={sym.id} sym={sym} onClick={handlePick} />
            ))}
          </div>

          {visibleSymbols.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>
              {q ? '검색 결과 없음' : '이 그룹에 기호가 없습니다'}
            </div>
          )}
        </div>
      )}

      <SymbolSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isLoggedIn={isLoggedIn}
        config={config}
        onApplyPreset={applyPreset}
        onSave={save}
      />
    </div>
  );
}
