'use client';

/**
 * MathSymbolPalette — Phase 40 수식 기호 팔레트 (§12~14)
 *
 * 단일 트리거 버튼 → 팝업 패널(검색 + 4탭 + 기호 그리드).
 * 아이콘은 KaTeX 하이브리드 렌더(구조형은 displayLatex, 단일은 latex)로 렌더 + 캐시.
 * 클릭 시 onInsert(template, cursorOffset)로 삽입(패널 유지 → 연속 삽입).
 * 데이터: lib/math-symbols.ts (KaTeX MIT 시드 + 큐레이션). 기존 MathToolbar 대체.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { CURATED_SYMBOLS, DEFAULT_CATEGORIES } from '../../lib/math-symbols';
import type { MathSymbol } from '../../types/toolbar-config';

interface Props {
  onInsert: (template: string, cursorOffset: number) => void;
  /** 일반 텍스트 컨텍스트(대화 패널 등)에서 true → 삽입 시 $…$로 감쌈. 기본 false(에디터: 이미 수식 안). */
  wrapInDollar?: boolean;
  /** true → 팝업이 트리거 위로 열림(하단 입력창용). 기본 false(아래로). */
  openUp?: boolean;
}

// ── KaTeX 렌더 캐시 (세션 단위, 동일 LaTeX는 1회만 렌더) ──
const katexCache = new Map<string, string>();
function renderKatex(latex: string): string {
  const hit = katexCache.get(latex);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    html = '';
  }
  katexCache.set(latex, html);
  return html;
}

// ── 삽입 텍스트/커서 계산 ──
function buildInsert(sym: MathSymbol, wrap: boolean): { text: string; offset: number } {
  const isStructured = !!sym.displayLatex;
  if (wrap) {
    // 대화 패널 등 일반 텍스트: $…$로 감싸 삽입
    const text = '$' + sym.latex + '$';
    const offset = (isStructured && sym.cursorOffset != null)
      ? 1 + sym.cursorOffset   // 안쪽 placeholder로 이동 (앞 '$' 1칸 보정)
      : text.length;           // 단일 기호: 닫는 '$' 뒤로
    return { text, offset };
  }
  // 에디터(이미 수식 안): 구조형은 placeholder 포함 그대로, 단일 기호는 뒤 공백 한 칸.
  const text = isStructured ? sym.latex : sym.latex + ' ';
  const offset = sym.cursorOffset ?? text.length;
  return { text, offset };
}

function SymbolCell({ sym, onPick }: { sym: MathSymbol; onPick: (s: MathSymbol) => void }) {
  const html = renderKatex(sym.displayLatex ?? sym.latex);
  return (
    <button
      type="button"
      title={`${sym.name.ko} (${sym.latex})`}
      aria-label={`${sym.name.ko}, ${sym.name.en}`}
      onClick={() => onPick(sym)}
      style={{
        width: 40,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        border: '1px solid #eee',
        borderRadius: 6,
        background: '#fff',
        cursor: 'pointer',
        overflow: 'hidden',
        fontSize: 15,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#eee'; }}
    >
      {html
        ? <span dangerouslySetInnerHTML={{ __html: html }} />
        : <span>{sym.symbol || '?'}</span>}
    </button>
  );
}

export default function MathSymbolPalette({ onInsert, wrapInDollar = false, openUp = false }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(DEFAULT_CATEGORIES[0].id);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / Esc 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const visibleSymbols = useMemo(() => {
    if (q) {
      return CURATED_SYMBOLS.filter(
        (s) =>
          s.name.ko.toLowerCase().includes(q) ||
          s.name.en.toLowerCase().includes(q) ||
          s.latex.toLowerCase().includes(q),
      );
    }
    const cat = DEFAULT_CATEGORIES.find((c) => c.id === activeTab);
    if (!cat) return [];
    return CURATED_SYMBOLS.filter((s) => cat.fields.includes(s.field));
  }, [q, activeTab]);

  const handlePick = (sym: MathSymbol) => {
    const { text, offset } = buildInsert(sym, wrapInDollar);
    onInsert(text, offset);
    // 패널 유지 (연속 삽입). 닫으려면 Esc / 외부 클릭.
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="수식 기호 팔레트"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 10px',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          background: open ? '#eef2ff' : '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span dangerouslySetInnerHTML={{ __html: renderKatex('f(x)') }} />
        <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            ...(openUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
            left: 0,
            width: 340,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
            zIndex: 1000,
            padding: 10,
            animation: 'fadeIn 0.1s ease',
          }}
        >
          {/* 검색 */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 (이름 / LaTeX)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 30,
              padding: '0 10px',
              marginBottom: 8,
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 13,
              outline: 'none',
            }}
          />

          {/* 탭 (검색 중이 아닐 때만) */}
          {!q && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {DEFAULT_CATEGORIES.map((cat) => {
                const active = cat.id === activeTab;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    style={{
                      flex: 1,
                      height: 28,
                      fontSize: 12,
                      fontWeight: active ? 700 : 400,
                      color: active ? '#3730a3' : '#555',
                      background: active ? '#eef2ff' : '#f7f7f7',
                      border: active ? '1px solid #c7d2fe' : '1px solid transparent',
                      borderRadius: 6,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 기호 그리드 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 40px)',
              gap: 6,
              justifyContent: 'space-between',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {visibleSymbols.map((sym) => (
              <SymbolCell key={sym.id} sym={sym} onPick={handlePick} />
            ))}
          </div>

          {visibleSymbols.length === 0 && (
            <div style={{ padding: '16px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>
              검색 결과 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}
