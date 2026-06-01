'use client';

/**
 * Phase 39 — 재사용 이모지 피커 패널 (Twemoji)
 *
 * 트리거/위치는 소비자가 담당하고, 이 컴포넌트는 패널 "내용"만 렌더한다.
 *  - 입력 툴바: IconButton + 드롭다운으로 감쌈
 *  - 사이드바 폴더 아이콘: ⋯ 메뉴에서 팝오버로 감쌈
 * onSelect는 순수 유니코드 이모지를 넘긴다(최근 사용 갱신은 내부에서 처리).
 */

import { useEffect, useState } from 'react';
import {
  loadEmoji, searchEmoji, getRecent, pushRecent,
  type EmojiItem, type EmojiGroup,
} from '../../lib/emoji-data';
import { twemojiSvgUrl } from '../../lib/twemoji-url';
import { IconLoader } from '../ui/Icons';

const EMOJI_CELL = 30; // 셀 크기(px)
export const EMOJI_PANEL_WIDTH = 8 * EMOJI_CELL + 2 * 8;

export function TwemojiImg({ emoji, label, size }: { emoji: string; label: string; size: number }) {
  // onError → 네이티브 글리프 폴백(렌더 플러그인과 파일명 엣지케이스 어긋날 때 깨짐 방지)
  return (
    <img
      src={twemojiSvgUrl(emoji)}
      alt={emoji}
      title={label}
      loading="lazy"
      draggable={false}
      width={size}
      height={size}
      style={{ display: 'block' }}
      onError={(e) => { e.currentTarget.replaceWith(document.createTextNode(emoji)); }}
    />
  );
}

function EmojiGrid({ items, onPick }: { items: EmojiItem[]; onPick: (emoji: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
      {items.map((it, i) => (
        <button
          key={`${it.emoji}-${i}`}
          title={it.label}
          onClick={() => onPick(it.emoji)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <TwemojiImg emoji={it.emoji} label={it.label} size={22} />
        </button>
      ))}
    </div>
  );
}

export function EmojiPickerPanel({
  onSelect,
  autoFocus = true,
}: {
  onSelect: (emoji: string) => void;
  autoFocus?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<EmojiGroup[]>([]);
  const [flat, setFlat] = useState<EmojiItem[]>([]);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  // 마운트 시 1회 로드 (패널은 열릴 때만 렌더되므로 = 첫 오픈 시 로드)
  useEffect(() => {
    let alive = true;
    setRecent(getRecent());
    if (!groups.length) {
      setLoading(true);
      loadEmoji()
        .then(({ groups, flat }) => {
          if (!alive) return;
          setGroups(groups);
          setFlat(flat);
          setActiveGroup(groups[0]?.key ?? null);
        })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (emoji: string) => {
    pushRecent(emoji);
    setRecent(getRecent());
    onSelect(emoji);
  };

  const searchResults = query.trim() ? searchEmoji(flat, query) : null;
  const activeItems = activeGroup != null
    ? (groups.find((g) => g.key === activeGroup)?.items ?? [])
    : [];

  return (
    <div style={{ width: EMOJI_PANEL_WIDTH, fontFamily: 'var(--font-ui, sans-serif)' }}>
      {/* 검색 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이모지 검색 (예: 웃음, 하트)"
        autoFocus={autoFocus}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '6px 8px',
          fontSize: 13,
          border: '1px solid #ddd',
          borderRadius: 6,
          outline: 'none',
          marginBottom: 6,
        }}
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <IconLoader />
        </div>
      ) : searchResults ? (
        searchResults.length ? (
          <EmojiGrid items={searchResults} onPick={handlePick} />
        ) : (
          <div style={{ padding: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
            검색 결과 없음
          </div>
        )
      ) : (
        <>
          {/* 카테고리 탭 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 6 }}>
            {groups.map((g) => (
              <button
                key={g.key}
                title={g.name}
                onClick={() => setActiveGroup(g.key)}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  padding: '4px 0',
                  display: 'flex',
                  justifyContent: 'center',
                  border: 'none',
                  borderBottom: activeGroup === g.key
                    ? '2px solid var(--accent-primary, #4285f4)'
                    : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <TwemojiImg emoji={g.items[0]?.emoji ?? '⬜'} label={g.name} size={18} />
              </button>
            ))}
          </div>

          {/* 최근 사용 */}
          {recent.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '0 2px 4px' }}>
                최근 사용
              </div>
              <EmojiGrid
                items={recent.map((emoji) => ({ emoji, label: emoji, tags: [], group: -1 }))}
                onPick={handlePick}
              />
            </div>
          )}

          {/* 활성 그룹 */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', padding: '0 2px 4px' }}>
            {groups.find((g) => g.key === activeGroup)?.name ?? ''}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <EmojiGrid items={activeItems} onPick={handlePick} />
          </div>
        </>
      )}
    </div>
  );
}
