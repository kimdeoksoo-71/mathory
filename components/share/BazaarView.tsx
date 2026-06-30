'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BazaarPost } from '../../types/problem';
import {
  listBazaarFeed, deleteBazaarPost, BazaarFeedPage,
} from '../../lib/bazaar';

/**
 * Phase 52 4단계 + 다듬기: Bazaar 전역 피드 + 검색/필터.
 * - filter='all': 모든 사용자 게시물(최신순). 검색(제목|닉네임) + 태그칩 필터.
 * - filter='mine': 내 게시물. 링크복사·게시 내리기(hover 노출)·스냅샷 만료칩.
 * - 표 형태(1줄/행): 방식·제목·게시자·일시·태그. 좁아지면 태그→일시 순으로 숨김.
 */
export default function BazaarView({ uid, filter }: { uid: string; filter: 'all' | 'mine' }) {
  const [posts, setPosts] = useState<BazaarPost[]>([]);
  const [cursor, setCursor] = useState<BazaarFeedPage['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 검색/필터 상태 (전체 모드 전용)
  const [searchMode, setSearchMode] = useState<'title' | 'nickname'>('title');
  const [searchInput, setSearchInput] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [activeNickname, setActiveNickname] = useState<string | null>(null);

  // 반응형 열 숨김(컨테이너 폭 기준)
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const showTags = width >= 620;
  const showDate = width >= 480;

  const buildQuery = useCallback(() => {
    if (filter === 'mine') return { ownerUid: uid };
    if (activeTag) return { tag: activeTag };
    if (activeNickname) return { nickname: activeNickname };
    if (activeTitle) return { titlePrefix: activeTitle };
    return {};
  }, [filter, uid, activeTag, activeNickname, activeTitle]);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true); setError(null);
    try {
      const page = await listBazaarFeed({ ...buildQuery(), cursor: reset ? null : cursor });
      setPosts((prev) => (reset ? page.posts : [...prev, ...page.posts]));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : '피드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQuery]);

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [filter, activeTag, activeTitle, activeNickname]);

  const submitSearch = () => {
    const v = searchInput.trim().toLowerCase();
    setActiveTag(null);
    if (!v) { setActiveTitle(null); setActiveNickname(null); return; }
    if (searchMode === 'nickname') { setActiveNickname(v); setActiveTitle(null); }
    else { setActiveTitle(v); setActiveNickname(null); }
  };

  const pickTag = (tag: string) => {
    setSearchInput(''); setActiveTitle(null); setActiveNickname(null);
    setActiveTag((cur) => (cur === tag ? null : tag));
  };

  const pickNickname = (nick: string) => {
    setSearchMode('nickname'); setSearchInput(nick);
    setActiveTag(null); setActiveTitle(null); setActiveNickname(nick.toLowerCase());
  };

  const clearFilters = () => {
    setSearchInput(''); setActiveTag(null); setActiveTitle(null); setActiveNickname(null);
  };

  const handleTakedown = async (post: BazaarPost) => {
    if (!confirm('Bazaar 게시를 내리시겠습니까? (공개 자체는 유지됩니다)')) return;
    try {
      await deleteBazaarPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 내리기 실패');
    }
  };

  const activeFilterLabel = activeTag ? `#${activeTag}`
    : activeNickname ? `@${activeNickname}`
    : activeTitle ? `“${activeTitle}”` : null;

  return (
    <div ref={containerRef} style={{ height: '100%', overflowY: 'auto' }}>
      <h2 style={h2Style}>{filter === 'mine' ? 'Bazaar · 내 게시물' : 'Bazaar'}</h2>

      {filter === 'all' && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={searchMode} onChange={(e) => setSearchMode(e.target.value as 'title' | 'nickname')} style={selectStyle}>
              <option value="title">제목</option>
              <option value="nickname">닉네임</option>
            </select>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              placeholder={searchMode === 'nickname' ? '닉네임 정확히' : '제목 시작 글자'}
              style={searchInputStyle}
            />
            <button onClick={submitSearch} style={searchBtnStyle}>검색</button>
          </div>
          {activeFilterLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span>필터: <b style={{ color: 'var(--accent-primary, #B8845C)' }}>{activeFilterLabel}</b></span>
              <button onClick={clearFilters} style={clearBtnStyle}>해제</button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ margin: '0 16px 10px', padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 11.5 }}>
          {error}
        </div>
      )}

      <div style={{ padding: '0 16px 16px' }}>
        <div style={tableStyle}>
          {/* 열 헤더 */}
          <div style={headerRowStyle}>
            <span style={{ ...cellBadge, color: 'var(--text-faint, #bbb)' }}>방식</span>
            <span style={{ ...cellTitle, fontWeight: 600 }}>제목</span>
            <span style={cellNick}>게시자</span>
            {showDate && <span style={cellDate}>일시</span>}
            {showTags && <span style={cellTags}>태그</span>}
          </div>

          {posts.map((p) => (
            <BazaarRow
              key={p.id}
              post={p}
              mine={filter === 'mine'}
              showDate={showDate}
              showTags={showTags}
              onPickTag={pickTag}
              onPickNickname={pickNickname}
              onTakedown={handleTakedown}
            />
          ))}

          {!loading && posts.length === 0 && (
            <div style={emptyStyle}>
              {filter === 'mine' ? '아직 Bazaar에 게시한 문항이 없습니다.' : '게시물이 없습니다.'}
            </div>
          )}
        </div>

        {loading && <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>}
        {hasMore && !loading && (
          <button onClick={() => load(false)} style={moreBtnStyle}>더 보기</button>
        )}
      </div>
    </div>
  );
}

function BazaarRow({
  post, mine, showDate, showTags, onPickTag, onPickNickname, onTakedown,
}: {
  post: BazaarPost;
  mine: boolean;
  showDate: boolean;
  showTags: boolean;
  onPickTag: (t: string) => void;
  onPickNickname: (n: string) => void;
  onTakedown: (p: BazaarPost) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = post.mode === 'live' ? `/p/${post.problemId}` : `/shared/${post.shareId}`;
  const url = `${origin}${path}`;
  const expired = post.mode === 'snapshot' && post.expiresAt && post.expiresAt.getTime() <= Date.now();

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* 무시 */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={dataRowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={cellBadge}>
        <span style={badgeStyle(post.mode)}>{post.mode === 'live' ? '실시간' : '스냅샷'}</span>
      </span>
      <a href={path} target="_blank" rel="noreferrer" style={{ ...cellTitle, ...titleLinkStyle }}>
        {post.title || '(제목 없음)'}
      </a>
      <button onClick={() => onPickNickname(post.authorNickname)} style={{ ...cellNick, ...nickStyle }} title="이 닉네임으로 검색">
        {post.authorNickname || '익명'}
      </button>
      {showDate && (
        <span style={{ ...cellDate, color: expired ? '#c33' : 'var(--text-faint, #bbb)' }}>
          {post.mode === 'snapshot' && expired ? '만료' : fmtDate(post.createdAt)}
        </span>
      )}
      {showTags && (
        <span style={cellTags}>
          {post.tags.map((t) => (
            <button key={t} onClick={() => onPickTag(t)} style={tagChipStyle}>#{t}</button>
          ))}
        </span>
      )}
      {mine && hovered && (
        <span style={actionOverlayStyle}>
          <button onClick={copyLink} style={smallBtnStyle}>{copied ? '복사됨' : '링크 복사'}</button>
          <button onClick={() => onTakedown(post)} style={{ ...smallBtnStyle, color: '#c33', borderColor: '#e3b5b5' }}>
            게시 내리기
          </button>
        </span>
      )}
    </div>
  );
}

function fmtDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

const h2Style: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, margin: 0, padding: '14px 16px 8px',
  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
const selectStyle: React.CSSProperties = {
  padding: '6px 6px', fontSize: 12, border: '1px solid var(--border-light, #ddd)',
  borderRadius: 6, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
};
const searchInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12,
  border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
};
const searchBtnStyle: React.CSSProperties = {
  padding: '6px 12px', border: 'none', borderRadius: 6,
  background: 'var(--accent-primary, #B8845C)', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const clearBtnStyle: React.CSSProperties = {
  border: '1px solid var(--border-light, #ddd)', background: 'transparent',
  borderRadius: 5, fontSize: 10.5, padding: '1px 6px', cursor: 'pointer', color: 'var(--text-muted)',
};

const tableStyle: React.CSSProperties = {
  background: 'var(--bg-primary, #fff)', borderRadius: 8,
  border: '1px solid var(--border-light, #eee)', overflow: 'hidden', fontFamily: 'var(--font-ui)',
};
const headerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
  borderBottom: '1px solid var(--border-light, #eee)', background: 'var(--bg-input, #fafafa)',
  fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600,
};
const dataRowStyle: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 12px', borderBottom: '1px solid var(--border-light, #f0f0f0)',
};
// 열 폭
const cellBadge: React.CSSProperties = { width: 46, flexShrink: 0, fontSize: 11 };
const cellTitle: React.CSSProperties = { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const cellNick: React.CSSProperties = { width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' };
const cellDate: React.CSSProperties = { width: 52, flexShrink: 0, fontSize: 11, textAlign: 'right' };
const cellTags: React.CSSProperties = { width: 168, flexShrink: 0, display: 'flex', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap' };

const titleLinkStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none',
};
const nickStyle: React.CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer', padding: 0,
  fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
};
const tagChipStyle: React.CSSProperties = {
  border: '1px solid var(--border-light, #ddd)', background: 'var(--bg-input, #f8f8f8)',
  borderRadius: 10, fontSize: 10.5, padding: '1px 8px', cursor: 'pointer',
  color: 'var(--text-secondary)', flexShrink: 0,
};
const badgeStyle = (mode: string): React.CSSProperties => ({
  fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
  background: mode === 'live' ? 'var(--accent-primary, #B8845C)' : '#8a8a8a', color: '#fff',
});
const actionOverlayStyle: React.CSSProperties = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  display: 'flex', gap: 6, background: 'var(--bg-primary, #fff)',
  paddingLeft: 16, boxShadow: '-12px 0 10px -6px rgba(0,0,0,0.08)',
};
const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: '#fff', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
};
const moreBtnStyle: React.CSSProperties = {
  display: 'block', margin: '10px auto 0', padding: '7px 18px',
  border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const emptyStyle: React.CSSProperties = {
  padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
};
