'use client';

import { useCallback, useEffect, useState } from 'react';
import { BazaarPost } from '../../types/problem';
import { listBazaarFeed, deleteBazaarPost, BazaarFeedPage } from '../../lib/bazaar';
import { confirmDialog } from '../../lib/dialogs';

/* ═══════════════════════════════════════════════════════════════
   Phase 64 §6-5 — Bazaar 폰 화면(내용만 — 셸은 호출자: BazaarLanding·PhoneApp).
   BazaarView(데스크톱 표)의 폰 번역: 같은 listBazaarFeed 쿼리 4단계
   (tag > nickname > titlePrefix > 최신)를 2행 카드 목록으로 그린다.
   ⚠ 내 게시물 액션은 hover가 아니라 상시 버튼이다(v2 B-9 — 터치에 hover 없음).
   ⚠ 과목 칩은 보류(Q4) — 검색·태그 탭만.
   ═══════════════════════════════════════════════════════════════ */

export default function PhoneBazaar({ uid, onOpenPost }: {
  uid: string;
  /** 로그인 앱(PhoneApp)에서 게시물 탭 → 인앱 리더 전환. 미전달(비로그인 랜딩)이면 같은 탭 이동 */
  onOpenPost?: (post: BazaarPost) => void;
}) {
  const [posts, setPosts] = useState<BazaarPost[]>([]);
  const [cursor, setCursor] = useState<BazaarFeedPage['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchMode, setSearchMode] = useState<'title' | 'nickname'>('title');
  const [searchInput, setSearchInput] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [activeNickname, setActiveNickname] = useState<string | null>(null);

  const buildQuery = useCallback(() => {
    if (activeTag) return { tag: activeTag };
    if (activeNickname) return { nickname: activeNickname };
    if (activeTitle) return { titlePrefix: activeTitle };
    return {};
  }, [activeTag, activeNickname, activeTitle]);

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

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [activeTag, activeTitle, activeNickname]);

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

  const handleTakedown = async (post: BazaarPost) => {
    if (!await confirmDialog({
      title: 'Bazaar 게시 내리기',
      message: 'Bazaar 게시를 내리시겠습니까? (공개 자체는 유지됩니다)',
      danger: true, confirmLabel: '내리기',
    })) return;
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
    <div style={{ padding: '12px 10px 24px', fontFamily: 'var(--font-ui)' }}>
      {/* ── 검색 줄 (터치 타깃 44) ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as 'title' | 'nickname')}
          style={{
            height: 44, padding: '0 6px', fontSize: 13, border: '1px solid var(--border-light, #ddd)',
            borderRadius: 8, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
          }}
        >
          <option value="title">제목</option>
          <option value="nickname">닉네임</option>
        </select>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
          placeholder={searchMode === 'nickname' ? '닉네임 정확히' : '제목 시작 글자'}
          style={{
            flex: 1, minWidth: 0, height: 44, padding: '0 12px', fontSize: 14, boxSizing: 'border-box',
            border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
            background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
          }}
        />
        <button
          onClick={submitSearch}
          style={{
            height: 44, padding: '0 14px', border: 'none', borderRadius: 8,
            background: 'var(--accent-primary, #B8845C)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          검색
        </button>
      </div>

      {activeFilterLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <span>필터: <b>{activeFilterLabel}</b></span>
          <button
            onClick={clearFilters}
            style={{
              border: '1px solid var(--border-light, #ddd)', background: 'transparent', borderRadius: 6,
              fontSize: 11.5, padding: '3px 10px', cursor: 'pointer', color: 'var(--text-muted)',
            }}
          >
            해제
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'var(--accent-danger-bg, #FEF2F2)', color: 'var(--accent-danger, #C0392B)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── 2행 카드 목록 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {posts.map((p) => (
          <PhoneBazaarCard
            key={p.id}
            post={p}
            mine={!!uid && p.ownerUid === uid}
            onPickTag={pickTag}
            onTakedown={handleTakedown}
            onOpenPost={onOpenPost}
          />
        ))}
        {!loading && posts.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>게시물이 없습니다.</div>
        )}
      </div>

      {loading && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>불러오는 중…</div>}
      {hasMore && !loading && (
        <button
          onClick={() => load(false)}
          style={{
            display: 'block', width: '100%', marginTop: 10, height: 44,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
            background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          더 보기
        </button>
      )}
    </div>
  );
}

function PhoneBazaarCard({ post, mine, onPickTag, onTakedown, onOpenPost }: {
  post: BazaarPost;
  mine: boolean;
  onPickTag: (t: string) => void;
  onTakedown: (p: BazaarPost) => void;
  onOpenPost?: (post: BazaarPost) => void;
}) {
  const [copied, setCopied] = useState(false);
  const path = post.mode === 'live' ? `/p/${post.problemId}` : `/shared/${post.shareId}`;
  const expired = post.mode === 'snapshot' && post.expiresAt && post.expiresAt.getTime() <= Date.now();

  const copyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    try { await navigator.clipboard.writeText(`${origin}${path}`); } catch { /* 무시 */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const open = () => {
    if (onOpenPost) onOpenPost(post);
    else window.location.href = path;   // 비로그인 폰: 같은 탭 이동(뒤로가기가 모바일 관례)
  };

  return (
    <div
      onClick={open}
      role="link"
      style={{
        background: 'var(--bg-content)', border: '0.5px solid var(--border-content)',
        borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
      }}
    >
      {/* 1행: 배지 + 제목 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 }}>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: '#fff',
          background: post.mode === 'live' ? 'var(--accent-primary, #B8845C)' : 'var(--text-muted, #9C9585)',
        }}>
          {post.mode === 'live' ? '실시간' : '스냅샷'}
        </span>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {post.title || '(제목 없음)'}
        </span>
      </div>
      {/* 2행: 닉네임 · 날짜 · #태그 (+ 내 게시물 액션 상시) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ flexShrink: 0 }}>{post.authorNickname || '익명'}</span>
        <span style={{ flexShrink: 0, color: expired ? 'var(--accent-danger, #C0392B)' : 'var(--text-faint, #bbb)', fontSize: 11 }}>
          {expired ? '만료' : fmtDate(post.createdAt)}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {post.tags.map((t) => (
            <button
              key={t}
              onClick={(e) => { e.stopPropagation(); onPickTag(t); }}
              style={{
                border: '1px solid var(--border-light, #ddd)', background: 'var(--bg-input, #f8f8f8)',
                borderRadius: 10, fontSize: 10.5, padding: '1px 8px', cursor: 'pointer',
                color: 'var(--text-secondary)', flexShrink: 0,
              }}
            >
              #{t}
            </button>
          ))}
        </span>
        {mine && (
          <span style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
            <button onClick={(e) => { e.stopPropagation(); copyLink(); }} style={mineBtnStyle}>
              {copied ? '복사됨' : '링크'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTakedown(post); }}
              style={{ ...mineBtnStyle, color: 'var(--accent-danger, #C0392B)', borderColor: 'var(--accent-danger, #C0392B)' }}
            >
              내리기
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/* BazaarView의 fmtDate와 같은 표기(yy.mm.dd) — export가 없어 지역 사본. 표기만이라 무해 */
function fmtDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

const mineBtnStyle: React.CSSProperties = {
  padding: '3px 10px', border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'var(--bg-primary, #fff)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
};
