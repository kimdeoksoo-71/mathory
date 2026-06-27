'use client';

import { useCallback, useEffect, useState } from 'react';
import { BazaarPost } from '../../types/problem';
import {
  listBazaarFeed, deleteBazaarPost, BazaarFeedPage,
} from '../../lib/bazaar';

/**
 * Phase 52 4단계: Bazaar 전역 피드 + 검색/필터.
 * - filter='all': 모든 사용자 게시물(최신순). 검색(제목|닉네임) + 태그칩 필터.
 * - filter='mine': 내 게시물(ownerUid==uid). 링크복사·게시 내리기·스냅샷 만료칩.
 * 끊긴 행은 3단계 cascade가 1차 제거 — 드물게 남으면 클릭 시 뷰어가 not-found 처리(D2 v1).
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
      const page = await listBazaarFeed({
        ...buildQuery(),
        cursor: reset ? null : cursor,
      });
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

  // 필터/모드 변경 시 1페이지부터 재로드
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

  const clearFilters = () => {
    setSearchInput(''); setActiveTag(null); setActiveTitle(null); setActiveNickname(null);
  };

  const pickNickname = (nick: string) => {
    setSearchMode('nickname'); setSearchInput(nick);
    setActiveTag(null); setActiveTitle(null); setActiveNickname(nick.toLowerCase());
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
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <h2 style={h2Style}>{filter === 'mine' ? 'Bazaar · 내 게시물' : 'Bazaar'}</h2>

      {filter === 'all' && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as 'title' | 'nickname')}
              style={selectStyle}
            >
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px 16px' }}>
        {posts.map((p) => (
          <BazaarRow
            key={p.id}
            post={p}
            mine={filter === 'mine'}
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

        {loading && <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>}

        {hasMore && !loading && (
          <button onClick={() => load(false)} style={moreBtnStyle}>더 보기</button>
        )}
      </div>
    </div>
  );
}

function BazaarRow({
  post, mine, onPickTag, onPickNickname, onTakedown,
}: {
  post: BazaarPost;
  mine: boolean;
  onPickTag: (t: string) => void;
  onPickNickname: (n: string) => void;
  onTakedown: (p: BazaarPost) => void;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = post.mode === 'live' ? `/p/${post.problemId}` : `/shared/${post.shareId}`;
  const url = `${origin}${path}`;
  const expired = post.mode === 'snapshot' && post.expiresAt && post.expiresAt.getTime() <= Date.now();

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* 무시 */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={badgeStyle(post.mode)}>{post.mode === 'live' ? '실시간' : '스냅샷'}</span>
        <a href={path} target="_blank" rel="noreferrer" style={titleLinkStyle}>
          {post.title || '(제목 없음)'}
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: post.tags.length ? 6 : 0 }}>
        <button onClick={() => onPickNickname(post.authorNickname)} style={nickStyle} title="이 닉네임으로 검색">
          <span style={avatarStyle}>{(post.authorNickname || '?').charAt(0).toUpperCase()}</span>
          {post.authorNickname || '익명'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-faint, #bbb)' }}>{fmtDate(post.createdAt)}</span>
        {post.mode === 'snapshot' && post.expiresAt && (
          <span style={{ fontSize: 10.5, color: expired ? '#c33' : 'var(--text-muted)' }}>
            {expired ? '만료됨' : `~${post.expiresAt.toLocaleDateString('ko-KR')}`}
          </span>
        )}
      </div>
      {post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {post.tags.map((t) => (
            <button key={t} onClick={() => onPickTag(t)} style={tagChipStyle}>#{t}</button>
          ))}
        </div>
      )}
      {mine && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={copyLink} style={smallBtnStyle}>{copied ? '복사됨' : '링크 복사'}</button>
          <button onClick={() => onTakedown(post)} style={{ ...smallBtnStyle, color: '#c33', borderColor: '#e3b5b5' }}>
            게시 내리기
          </button>
        </div>
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
const rowStyle: React.CSSProperties = {
  background: 'var(--bg-primary, #fff)', borderRadius: 8, padding: '12px 14px',
  border: '1px solid var(--border-light, #eee)', fontFamily: 'var(--font-ui)',
};
const titleLinkStyle: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const nickStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none',
  cursor: 'pointer', padding: 0, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)',
};
const avatarStyle: React.CSSProperties = {
  width: 18, height: 18, borderRadius: '50%', background: '#e3d6c8',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 10, color: '#7a5b3a', fontWeight: 700,
};
const tagChipStyle: React.CSSProperties = {
  border: '1px solid var(--border-light, #ddd)', background: 'var(--bg-input, #f8f8f8)',
  borderRadius: 10, fontSize: 10.5, padding: '1px 8px', cursor: 'pointer', color: 'var(--text-secondary)',
};
const badgeStyle = (mode: string): React.CSSProperties => ({
  fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
  background: mode === 'live' ? 'var(--accent-primary, #B8845C)' : '#8a8a8a', color: '#fff',
});
const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-ui)',
};
const moreBtnStyle: React.CSSProperties = {
  margin: '4px auto 0', padding: '7px 18px', border: '1px solid var(--border-light, #ddd)',
  borderRadius: 6, background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const emptyStyle: React.CSSProperties = {
  background: 'var(--bg-primary, #fff)', borderRadius: 8, padding: 24, textAlign: 'center',
  color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border-light, #eee)',
};
