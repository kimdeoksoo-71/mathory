'use client';

import { useState, useEffect } from 'react';
import { TabMeta, BazaarPost } from '../../types/problem';
import { setMemberTabVisibility } from '../../lib/membership';
import { getProblem, setProblemPublic, setCommentsVisible, setPublicCommentsEnabled } from '../../lib/firestore';
import { ensureCommentSession } from '../../lib/discussion-sessions';
import { getUserProfile, needsNicknameSetup } from '../../lib/users';
import {
  listBazaarPostsByProblem, createBazaarPost, deleteBazaarPost,
  updateBazaarTags, parseTagInput, cascadeOnUnpublish,
} from '../../lib/bazaar';
import {
  createShare, getShareByProblem, revokeShare, isShareExpired,
  ShareWithSnapshot, EXPIRY_PRESET_DAYS, DEFAULT_EXPIRY_DAYS,
} from '../../lib/shares';

interface ShareSettingsPanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  /** 공유 대상(멤버) 관리 모달 열기 */
  onManageMembers: () => void;
}

type PublishMode = 'live' | 'snapshot';

const PRESET_LABEL = (d: number | null) => (d === null ? '무기한' : `${d}일`);

/**
 * Phase 49 (D) + 50 + 51: 문항 단위 공유 설정 (인라인).
 * - 전역 탭 가시성 토글
 * - 공유 대상(멤버) 관리 진입
 * - 문항 공개: 방식 라디오(실시간/스냅샷)
 *     · 실시간(Phase 51): visibility='public' + publishedAt, /p/{id}, 댓글 공개 열람
 *     · 스냅샷(Phase 50): shares 발급, /shared/{id}, 만료
 */
export default function ShareSettingsPanel({ problemId, ownerUid, tabs, onManageMembers }: ShareSettingsPanelProps) {
  const [tabVis, setTabVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, true])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 방식
  const [mode, setMode] = useState<PublishMode>('live');

  // 실시간 공개 상태 (Phase 51)
  const [isPublic, setIsPublic] = useState(false);
  const [commentsVis, setCommentsVis] = useState(true);
  const [liveBusy, setLiveBusy] = useState(false);

  // 스냅샷 공개 상태 (Phase 50)
  const [webShare, setWebShare] = useState<ShareWithSnapshot | null>(null);
  const [webBusy, setWebBusy] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(DEFAULT_EXPIRY_DAYS);

  // Bazaar 게시 상태 (Phase 52, 3단계)
  const [bazaarPosts, setBazaarPosts] = useState<BazaarPost[]>([]);
  const [needsNick, setNeedsNick] = useState(false);
  const [pubComments, setPubComments] = useState(false);   // publicCommentsEnabled (N1/D1)
  const [tagInput, setTagInput] = useState('');
  const [bazaarBusy, setBazaarBusy] = useState(false);

  const liveBPost = bazaarPosts.find((p) => p.mode === 'live') ?? null;
  const snapBPost = bazaarPosts.find((p) => p.mode === 'snapshot' && p.shareId === webShare?.id) ?? null;

  const reloadBazaar = async () => {
    try { setBazaarPosts(await listBazaarPostsByProblem(problemId)); } catch { /* 무시 */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [problem, existing, profile, posts] = await Promise.all([
          getProblem(problemId),
          getShareByProblem(problemId, ownerUid).catch(() => null),
          getUserProfile(ownerUid).catch(() => null),
          listBazaarPostsByProblem(problemId).catch(() => []),
        ]);
        if (cancelled) return;
        const mtv = problem?.memberTabVisibility;
        setTabVis(mtv
          ? Object.fromEntries(tabs.map((t) => [t.id, mtv[t.id] !== false]))
          : Object.fromEntries(tabs.map((t) => [t.id, true])));
        const activeShare = existing && !isShareExpired(existing) ? existing : null;
        setWebShare(activeShare);
        const pub = problem?.visibility === 'public';
        setIsPublic(pub);
        setCommentsVis(problem?.commentsVisible !== false);
        setPubComments(problem?.publicCommentsEnabled === true);
        setNeedsNick(needsNicknameSetup(profile));
        setBazaarPosts(posts);
        // 초기 방식: 실시간 공개 중이면 실시간, 아니면 스냅샷이 있을 때만 스냅샷, 기본 실시간
        setMode(pub ? 'live' : activeShare ? 'snapshot' : 'live');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '공유 설정을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId, ownerUid]);

  const handleTabChange = async (tabId: string, visible: boolean) => {
    const prev = tabVis;
    const next = { ...tabVis, [tabId]: visible };
    setTabVis(next);
    setBusy(true); setError(null);
    try {
      await setMemberTabVisibility(problemId, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
      setTabVis(prev);
    } finally { setBusy(false); }
  };

  const snapshotUrl = (id: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/shared/${id}` : `/shared/${id}`;
  const liveUrl = () =>
    typeof window !== 'undefined' ? `${window.location.origin}/p/${problemId}` : `/p/${problemId}`;

  const handleCopyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  // ── 실시간 공개 (Phase 51) ──
  const handlePublishLive = async () => {
    setLiveBusy(true); setError(null);
    try {
      await setProblemPublic(problemId, true);
      // P1: commentSessionId 포인터를 공개 시점에 보장(없어도 깨지진 않으나 일관성)
      await ensureCommentSession(problemId, ownerUid).catch(() => {});
      setIsPublic(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '실시간 공개 실패');
    } finally { setLiveBusy(false); }
  };

  const handleUnpublishLive = async () => {
    const msg = liveBPost
      ? '실시간 공개를 중단하시겠습니까? 링크 접속이 즉시 차단되고 Bazaar 게시도 함께 내려갑니다.'
      : '실시간 공개를 중단하시겠습니까? 링크 접속이 즉시 차단됩니다.';
    if (!confirm(msg)) return;
    setLiveBusy(true); setError(null);
    try {
      await setProblemPublic(problemId, false);
      // D2: 공개 해제 시 관련 live 게시물 best-effort 삭제(고아 방지).
      await cascadeOnUnpublish(problemId, { mode: 'live' });
      setIsPublic(false);
      await reloadBazaar();
    }
    catch (e) { setError(e instanceof Error ? e.message : '중단 실패'); }
    finally { setLiveBusy(false); }
  };

  const handleToggleComments = async (next: boolean) => {
    const prev = commentsVis;
    setCommentsVis(next); setLiveBusy(true); setError(null);
    try { await setCommentsVisible(problemId, next); }
    catch (e) { setCommentsVis(prev); setError(e instanceof Error ? e.message : '댓글 표시 변경 실패'); }
    finally { setLiveBusy(false); }
  };

  // ── 스냅샷 공개 (Phase 50) ──
  const handlePublishSnapshot = async () => {
    setWebBusy(true); setError(null);
    try {
      const share = await createShare({
        problemId, ownerUid,
        expiryHours: expiryDays == null ? null : expiryDays * 24,
        tabVisibility: tabVis,
      });
      setWebShare(share);
    } catch (e) {
      setError(e instanceof Error ? e.message : '스냅샷 공개 실패');
    } finally { setWebBusy(false); }
  };

  const handleRevokeSnapshot = async () => {
    if (!webShare) return;
    const msg = snapBPost
      ? '스냅샷 공개를 중단하시겠습니까? 링크가 즉시 무효화되고 Bazaar 게시도 함께 내려갑니다.'
      : '스냅샷 공개를 중단하시겠습니까? 링크가 즉시 무효화됩니다.';
    if (!confirm(msg)) return;
    setWebBusy(true); setError(null);
    try {
      const sid = webShare.id;
      await revokeShare(sid);
      // D2: share revoke 시 해당 snapshot 게시물 best-effort 삭제.
      await cascadeOnUnpublish(problemId, { mode: 'snapshot', shareId: sid });
      setWebShare(null);
      await reloadBazaar();
    }
    catch (e) { setError(e instanceof Error ? e.message : '중단 실패'); }
    finally { setWebBusy(false); }
  };

  // ── Bazaar 게시 (Phase 52, 3단계) ──
  const handleRegisterBazaar = async (mode: PublishMode) => {
    setBazaarBusy(true); setError(null);
    try {
      const tags = parseTagInput(tagInput);
      if (mode === 'live') {
        // D1/N1: 공개 댓글 허용 토글값을 게시 시점에 반영.
        await setPublicCommentsEnabled(problemId, pubComments);
        await createBazaarPost({ mode: 'live', problemId, ownerUid, tags });
      } else {
        if (!webShare) throw new Error('스냅샷 공개가 먼저 필요합니다.');
        await createBazaarPost({
          mode: 'snapshot', problemId, ownerUid, tags,
          shareId: webShare.id, expiresAt: webShare.expiresAt,
        });
      }
      await reloadBazaar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bazaar 게시 실패');
    } finally { setBazaarBusy(false); }
  };

  const handleUnregisterBazaar = async (postId: string) => {
    if (!confirm('Bazaar 게시를 내리시겠습니까? (공개 자체는 유지됩니다)')) return;
    setBazaarBusy(true); setError(null);
    try { await deleteBazaarPost(postId); await reloadBazaar(); }
    catch (e) { setError(e instanceof Error ? e.message : '게시 내리기 실패'); }
    finally { setBazaarBusy(false); }
  };

  const handleSaveTags = async (postId: string) => {
    setBazaarBusy(true); setError(null);
    try { await updateBazaarTags(postId, parseTagInput(tagInput)); await reloadBazaar(); }
    catch (e) { setError(e instanceof Error ? e.message : '태그 저장 실패'); }
    finally { setBazaarBusy(false); }
  };

  const handleTogglePubComments = async (next: boolean) => {
    const prev = pubComments;
    setPubComments(next); setBazaarBusy(true); setError(null);
    try { await setPublicCommentsEnabled(problemId, next); }
    catch (e) { setPubComments(prev); setError(e instanceof Error ? e.message : '공개 댓글 설정 실패'); }
    finally { setBazaarBusy(false); }
  };

  const anyTabVisible = Object.values(tabVis).some((v) => v);

  // 등록된 게시물의 태그를 입력창에 프리필(모드/게시물 전환 시 동기화).
  useEffect(() => {
    const post = mode === 'live' ? liveBPost : snapBPost;
    setTagInput(post ? post.tags.map((t) => `#${t}`).join(' ') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveBPost?.id, snapBPost?.id]);

  const renderBazaar = (m: PublishMode) => {
    const post = m === 'live' ? liveBPost : snapBPost;
    const tagField = (
      <input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        disabled={bazaarBusy}
        placeholder="#태그 (공백·쉼표 구분, 최대 10개)"
        style={tagInputStyle}
      />
    );
    const commentToggle = m === 'live' && (
      <label style={{ ...toggleRowStyle, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={pubComments}
          disabled={bazaarBusy}
          onChange={(e) => (post ? handleTogglePubComments(e.target.checked) : setPubComments(e.target.checked))}
          style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
        />
        <span>공개 댓글 허용 (로그인 누구나)</span>
      </label>
    );
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light, #eee)' }}>
        <SectionLabel>Bazaar 광장 게시</SectionLabel>
        {needsNick ? (
          <div style={bazaarNoticeStyle}>
            Bazaar 게시에는 닉네임이 필요합니다.{' '}
            <a href="/settings" style={{ color: 'var(--accent-primary, #B8845C)', fontWeight: 600 }}>설정에서 지정</a>
          </div>
        ) : post ? (
          <div>
            <div style={{ fontSize: 11, color: 'var(--accent-primary, #B8845C)', fontWeight: 700, marginBottom: 6 }}>
              ✓ Bazaar 게시 중
            </div>
            {tagField}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => handleSaveTags(post.id)} disabled={bazaarBusy} style={{ ...primaryBtnStyle(bazaarBusy), flex: 1 }}>
                태그 저장
              </button>
              <button onClick={() => handleUnregisterBazaar(post.id)} disabled={bazaarBusy} style={{ ...dangerBtnStyle(bazaarBusy), width: 'auto', padding: '6px 12px' }}>
                게시 내리기
              </button>
            </div>
            {commentToggle}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
              광장에 등록하면 모든 로그인 사용자가 피드에서 발견할 수 있습니다(공개와 별개).
            </div>
            {tagField}
            {commentToggle}
            <button onClick={() => handleRegisterBazaar(m)} disabled={bazaarBusy} style={{ ...primaryBtnStyle(bazaarBusy), marginTop: 8 }}>
              {bazaarBusy ? '게시 중…' : 'Bazaar에 등록'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      <button
        onClick={onManageMembers}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 14,
          border: '1px solid var(--border-primary)', borderRadius: 8,
          background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}
      >
        공유 대상 관리…
      </button>

      <SectionLabel>공유할 탭</SectionLabel>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
        모든 공유 대상(멤버·공개)에게 공통 적용됩니다.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
        {tabs.map((t) => (
          <label key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
            borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: 12, color: 'var(--text-primary)',
          }}>
            <input
              type="checkbox"
              checked={tabVis[t.id] !== false}
              disabled={busy}
              onChange={(e) => handleTabChange(t.id, e.target.checked)}
              style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {/* ─── 문항 공개 (Phase 51) ─── */}
      <SectionLabel>문항 공개</SectionLabel>
      {loading ? (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>불러오는 중…</div>
      ) : (
        <>
          {/* 방식 라디오 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <ModeRadio
              label="실시간"
              hint="편집 반영·댓글 열람"
              active={mode === 'live'}
              badge={isPublic ? '공개 중' : undefined}
              onClick={() => setMode('live')}
            />
            <ModeRadio
              label="스냅샷"
              hint="발급 시점 동결"
              active={mode === 'snapshot'}
              badge={webShare ? '공개 중' : undefined}
              onClick={() => setMode('snapshot')}
            />
          </div>

          {mode === 'live' ? (
            isPublic ? (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    readOnly
                    value={liveUrl()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={urlInputStyle}
                  />
                  <button onClick={() => handleCopyUrl(liveUrl())} style={copyBtnStyle}>
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                  공개 중 — 편집이 즉시 반영됩니다. 비로그인 포함 누구나 열람·댓글 읽기 가능(작성은 멤버만).
                </div>
                <label style={toggleRowStyle}>
                  <input
                    type="checkbox"
                    checked={commentsVis}
                    disabled={liveBusy}
                    onChange={(e) => handleToggleComments(e.target.checked)}
                    style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
                  />
                  <span>댓글 공개 표시</span>
                </label>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 10px', lineHeight: 1.5 }}>
                  ⚠️ 켜면 기존 멤버 댓글이 비로그인 포함 누구나에게 보입니다(멤버·공개 공용 설정). 끄면 오너만.
                </div>
                <button onClick={handleUnpublishLive} disabled={liveBusy} style={dangerBtnStyle(liveBusy)}>
                  실시간 공개 중단
                </button>
                {renderBazaar('live')}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  실시간 공개하면 편집이 즉시 반영되고, 멤버 댓글을 비로그인 포함 누구나 읽을 수 있습니다(작성은 멤버만).
                  공개할 탭은 위 "공유할 탭"을 따릅니다.
                </div>
                <button
                  onClick={handlePublishLive}
                  disabled={liveBusy || !anyTabVisible}
                  style={primaryBtnStyle(liveBusy)}
                >
                  {liveBusy ? '공개 중…' : '실시간 공개'}
                </button>
              </div>
            )
          ) : (
            // 스냅샷 모드
            webShare ? (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    readOnly
                    value={snapshotUrl(webShare.id)}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={urlInputStyle}
                  />
                  <button onClick={() => handleCopyUrl(snapshotUrl(webShare.id))} style={copyBtnStyle}>
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                  {webShare.expiresAt === null
                    ? '공개 기간: 무기한'
                    : `만료: ${webShare.expiresAt.toLocaleDateString('ko-KR')}`}
                  <br />
                  만료일 변경은 공개 목록(공유 &gt; 문항 공개)에서 가능합니다.
                </div>
                <button onClick={handleRevokeSnapshot} disabled={webBusy} style={dangerBtnStyle(webBusy)}>
                  스냅샷 공개 중단
                </button>
                {renderBazaar('snapshot')}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>만료</span>
                  <select
                    value={expiryDays == null ? 'null' : String(expiryDays)}
                    onChange={(e) => setExpiryDays(e.target.value === 'null' ? null : Number(e.target.value))}
                    style={{
                      flex: 1, padding: '5px 6px', fontSize: 12, border: '1px solid var(--border-light, #ddd)',
                      borderRadius: 6, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
                    }}
                  >
                    {EXPIRY_PRESET_DAYS.map((d) => (
                      <option key={String(d)} value={d == null ? 'null' : String(d)}>{PRESET_LABEL(d)}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handlePublishSnapshot}
                  disabled={webBusy || !anyTabVisible}
                  style={primaryBtnStyle(webBusy)}
                >
                  {webBusy ? '공개 중…' : '스냅샷으로 공개'}
                </button>
              </div>
            )
          )}
        </>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ModeRadio({ label, hint, active, badge, onClick }: {
  label: string; hint: string; active: boolean; badge?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
        border: `1.5px solid ${active ? 'var(--accent-primary, #B8845C)' : 'var(--border-light, #ddd)'}`,
        background: active ? 'var(--accent-soft, rgba(184,132,92,0.08))' : 'var(--bg-primary, #fff)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: active ? 'var(--accent-primary, #B8845C)' : 'var(--text-primary)' }}>
          {label}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 4,
            background: 'var(--accent-primary, #B8845C)', color: '#fff', lineHeight: 1.6,
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</div>
    </button>
  );
}

const urlInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 11,
  border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'var(--bg-input, #f8f8f8)', fontFamily: 'monospace',
};

const copyBtnStyle: React.CSSProperties = {
  padding: '6px 10px', border: 'none', borderRadius: 6,
  background: 'var(--accent-primary, #B8845C)', color: '#fff',
  cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px',
  fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer',
};

const tagInputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
};

const bazaarNoticeStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, background: 'var(--bg-input, #f8f8f8)',
  fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '7px 0', border: 'none', borderRadius: 6,
    background: busy ? 'var(--text-faint, #ccc)' : 'var(--accent-primary, #B8845C)',
    color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
  };
}

function dangerBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '6px 0', border: '1px solid var(--accent-danger, #c33)',
    background: 'transparent', color: 'var(--accent-danger, #c33)',
    borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: 11.5, fontWeight: 600,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.3, marginBottom: 6 }}>
      {children}
    </div>
  );
}
