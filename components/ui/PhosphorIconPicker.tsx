'use client';

/**
 * M5 D6 — 폴더 아이콘용 Phosphor 카탈로그 피커 패널.
 *
 * (삭제된) EmojiPickerPanel의 구조를 본떴다 — 트리거/위치는 소비자(Sidebar
 * FolderIconPicker)가 담당하고 여기는 패널 "내용"만. onSelect는 Phosphor 이름을 넘긴다.
 *
 * - 검색: 영문 name·tags + 한글 키워드 표(lib/phosphor-ko.json). 서열은
 *   lib/folderIcon.searchIndex가 소유한다(name → 한글 → tags · 상한 80).
 * - 카테고리: 탭이 아니라 <select>(N5 — 17종은 폭 316에 탭으로 못 들어간다).
 *   brands 78종은 목록에서 제외한다(N1 — 자산은 설치돼 있지만 상표라 내밀지 않는다).
 * - 메타데이터(163 KB·gzip 27 KB)는 첫 오픈 시 동적 import(emojibase 전례).
 * - 최근 사용: localStorage 'mathory:folder-icon:recent' 24개.
 */

import { useEffect, useMemo, useState } from 'react';
import { IconLoader, PhAsset } from './Icons';
import {
  searchIndex, BRANDS_CATEGORY, CATEGORY_LABELS_KO,
  type PhosphorIndexItem,
} from '../../lib/folderIcon';

const CELL = 30;                                   // 셀 크기(px) — EmojiPickerPanel과 동일
export const PICKER_WIDTH = 10 * CELL + 2 * 8;     // 10열 + 좌우 패딩 = 316

const RECENT_KEY = 'mathory:folder-icon:recent';
const RECENT_MAX = 24;

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((v) => typeof v === 'string') : [];
  } catch { return []; }
}

function pushRecent(name: string) {
  try {
    const next = [name, ...getRecent().filter((n) => n !== name)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* 저장 실패는 무해 */ }
}

/* 인덱스·한글 표 모듈 캐시 — 동적 import 자체도 캐시되지만 재파싱을 피한다. */
let cachedIndex: PhosphorIndexItem[] | null = null;
let cachedKo: Record<string, string[]> | undefined;

async function loadCatalog(): Promise<{ index: PhosphorIndexItem[]; ko?: Record<string, string[]> }> {
  if (!cachedIndex) {
    cachedIndex = (await import('../../lib/phosphor-index.json')).default as PhosphorIndexItem[];
    // 한글 표는 없어도 동작한다(N2 — 영문 폴백)
    try {
      cachedKo = (await import('../../lib/phosphor-ko.json')).default as Record<string, string[]>;
    } catch { cachedKo = undefined; }
  }
  return { index: cachedIndex, ko: cachedKo };
}

function IconGrid({ names, onPick }: { names: string[]; onPick: (name: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2 }}>
      {names.map((n) => (
        <button
          key={n}
          title={n}
          onClick={() => onPick(n)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: CELL, height: CELL, padding: 0,
            border: 'none', borderRadius: 4, background: 'transparent',
            cursor: 'pointer', color: 'var(--text-secondary, #555)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <PhAsset name={n} size={20} />
        </button>
      ))}
    </div>
  );
}

export function PhosphorIconPicker({
  onSelect,
  autoFocus = true,
}: {
  onSelect: (name: string) => void;
  autoFocus?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState<PhosphorIndexItem[]>([]);
  const [ko, setKo] = useState<Record<string, string[]> | undefined>(undefined);
  const [category, setCategory] = useState<string>(CATEGORY_LABELS_KO[0][0]);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setRecent(getRecent());
    loadCatalog()
      .then(({ index, ko }) => { if (alive) { setIndex(index); setKo(ko); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handlePick = (name: string) => {
    pushRecent(name);
    setRecent(getRecent());
    onSelect(name);
  };

  const searchResults = query.trim()
    ? searchIndex(index, query, { excludeBrands: true, ko })
    : null;

  const categoryNames = useMemo(
    () => index
      .filter((i) => i.c.includes(category) && !i.c.includes(BRANDS_CATEGORY))
      .map((i) => i.n),
    [index, category],
  );

  return (
    <div style={{ width: PICKER_WIDTH, fontFamily: 'var(--font-ui, sans-serif)' }}>
      {/* 검색 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="아이콘 검색 (예: 폴더, 별, star)"
        autoFocus={autoFocus}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13,
          border: '1px solid #ddd', borderRadius: 6, outline: 'none', marginBottom: 6,
        }}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <IconLoader />
        </div>
      ) : searchResults ? (
        searchResults.length ? (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <IconGrid names={searchResults.map((i) => i.n)} onPick={handlePick} />
          </div>
        ) : (
          <div style={{ padding: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
            검색 결과 없음
          </div>
        )
      ) : (
        <>
          {/* 카테고리 select (N5) */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '5px 6px', fontSize: 12.5,
              border: '1px solid #ddd', borderRadius: 6, marginBottom: 6,
              background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #222)',
              fontFamily: 'var(--font-ui, sans-serif)', cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS_KO.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* 최근 사용 */}
          {recent.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '0 2px 4px' }}>
                최근 사용
              </div>
              <IconGrid names={recent} onPick={handlePick} />
            </div>
          )}

          {/* 활성 카테고리 */}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            <IconGrid names={categoryNames} onPick={handlePick} />
          </div>
        </>
      )}
    </div>
  );
}
