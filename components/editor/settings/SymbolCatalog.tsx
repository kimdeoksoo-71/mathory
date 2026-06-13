'use client';

/**
 * SymbolCatalog — 2단계 우측: 전체 기호 카탈로그 (계획서 §4-2)
 *
 * 552 기호를 분야 섹션으로 나열. 검색(이름/LaTeX), 등급 뱃지, 이미 그룹에 있으면 ✓.
 * 클릭 → 선택된 그룹에 추가(onPick). 선택 그룹 없으면 안내.
 */

import { useMemo, useState } from 'react';
import SymbolCell from './SymbolCell';
import { ALL_SYMBOLS, CATALOG_CATEGORIES } from '../../../lib/math-symbols';
import type { MathSymbol } from '../../../types/toolbar-config';

interface Props {
  inGroupIds: Set<number>;
  onPick: (sym: MathSymbol) => void;
  canPick: boolean;       // 선택된 그룹이 있는가
}

const RENDERABLE = ALL_SYMBOLS.filter((s) => s.katexSupported);

export default function SymbolCatalog({ inGroupIds, onPick, canPick }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return null;
    return RENDERABLE.filter(
      (s) =>
        s.name.ko.toLowerCase().includes(q) ||
        s.name.en.toLowerCase().includes(q) ||
        s.latex.toLowerCase().includes(q),
    );
  }, [q]);

  const sections = useMemo(() => {
    return CATALOG_CATEGORIES
      .map((cat) => ({
        key: cat.id,
        label: cat.ko,
        syms: RENDERABLE.filter((s) => s.catalogCategory === cat.id),
      }))
      .filter((sec) => sec.syms.length > 0);
  }, []);

  const handlePick = (sym: MathSymbol) => { if (canPick) onPick(sym); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="기호 검색 (이름 / LaTeX)"
          style={{
            width: '100%', boxSizing: 'border-box', height: 32, padding: '0 10px',
            border: '1px solid #ddd', borderRadius: 6, fontSize: 13, outline: 'none',
          }}
        />
        {!canPick && (
          <div style={{ fontSize: 11, color: '#c2741f', marginTop: 5 }}>
            왼쪽에서 그룹을 먼저 선택하면 기호를 추가할 수 있습니다.
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {searchResults ? (
          searchResults.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#999', fontSize: 13 }}>검색 결과 없음</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6 }}>
              {searchResults.map((s) => (
                <SymbolCell key={s.id} sym={s} onClick={handlePick} checked={inGroupIds.has(s.id)} showTier />
              ))}
            </div>
          )
        ) : (
          sections.map((sec) => (
            <div key={sec.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#999', margin: '0 0 6px', letterSpacing: 0.3 }}>
                {sec.label} <span style={{ color: '#ccc', fontWeight: 400 }}>({sec.syms.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6 }}>
                {sec.syms.map((s) => (
                  <SymbolCell key={s.id} sym={s} onClick={handlePick} checked={inGroupIds.has(s.id)} showTier />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
