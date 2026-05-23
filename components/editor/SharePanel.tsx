'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { TabMeta, MemberRole, UserProfile } from '../../types/problem';
import {
  createShare, getShareByProblem, revokeShare, isShareExpired,
  ShareWithSnapshot,
} from '../../lib/shares';
import {
  searchUsersByEmailPrefix, addMember, removeMember, updateMemberRole,
  setMemberTabVisibility,
} from '../../lib/membership';
import { getProblem } from '../../lib/firestore';
import { getUserProfile } from '../../lib/users';

/* ─── 공개기간 옵션 (1/3/7/30일/무기한) ─── */
interface ExpiryOption { hours: number | null; label: string; }
const EXPIRY_OPTIONS: ExpiryOption[] = [
  { hours: 24, label: '1일' },
  { hours: 72, label: '3일' },
  { hours: 168, label: '7일' },
  { hours: 720, label: '30일' },
  { hours: null, label: '무기한' },
];
const DEFAULT_OPTION_INDEX = 1; // 3일

interface SharePanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
}

function formatRemaining(expiresAt: Date | null): string {
  if (expiresAt === null) return '무기한';
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return '만료됨';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 남음`;
  return `${totalMin}분 남음`;
}

export default function SharePanel({ problemId, ownerUid, tabs }: SharePanelProps) {
  // 통합 탭 가시성 (problem.memberTabVisibility) — 외부공개·멤버공유 양쪽에 공통 적용
  const [tabVis, setTabVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, true])),
  );
  const [tabVisBusy, setTabVisBusy] = useState(false);

  // 하위 탭 선택: web / members
  const [activeTab, setActiveTab] = useState<'web' | 'members'>('web');

  // 멤버 목록 (멤버 섹션용. 탭 가시성도 같은 problem에서 로드)
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memLoading, setMemLoading] = useState(true);
  const [topError, setTopError] = useState<string | null>(null);

  const refreshProblem = async () => {
    const problem = await getProblem(problemId);
    if (!problem) return;
    // 탭 가시성 동기화
    const mtv = problem.memberTabVisibility;
    if (mtv) {
      const next: Record<string, boolean> = {};
      for (const t of tabs) next[t.id] = mtv[t.id] !== false;
      setTabVis(next);
    } else {
      setTabVis(Object.fromEntries(tabs.map((t) => [t.id, true])));
    }
    // 멤버 동기화
    const memberMap = problem.members || {};
    const uids = Object.keys(memberMap);
    const profiles = await Promise.all(uids.map((uid) =>
      getUserProfile(uid).then((p) => p ?? { uid, displayName: '', email: '', photoURL: '', createdAt: new Date() })));
    setMembers(uids.map((uid, i) => ({
      uid, role: memberMap[uid],
      displayName: profiles[i].displayName,
      email: profiles[i].email,
      photoURL: profiles[i].photoURL,
    })));
  };

  useEffect(() => {
    (async () => {
      try { await refreshProblem(); }
      catch (e: any) { setTopError(e.message || '정보를 불러오지 못했습니다.'); }
      finally { setMemLoading(false); }
    })();
  }, [problemId]);

  const handleTabVisChange = async (tabId: string, visible: boolean) => {
    const next = { ...tabVis, [tabId]: visible };
    const prev = tabVis;
    setTabVis(next);
    setTabVisBusy(true); setTopError(null);
    try {
      await setMemberTabVisibility(problemId, next);
    } catch (e: any) {
      setTopError(e.message || '탭 가시성 저장 실패');
      setTabVis(prev);
    } finally { setTabVisBusy(false); }
  };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* ─── 세부항목 1: 공유할 탭 설정 ─── */}
      <SectionLabel>공유할 탭</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {tabs.map((t) => (
          <label key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 6,
            cursor: tabVisBusy ? 'wait' : 'pointer',
            fontSize: 12,
          }}>
            <input type="checkbox" checked={tabVis[t.id] !== false}
              disabled={tabVisBusy}
              onChange={(e) => handleTabVisChange(t.id, e.target.checked)}
              style={{ accentColor: 'var(--accent-primary, #B8845C)' }}
            />
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {/* ─── 세부항목 2: 웹에 공개 / 멤버에 공유 탭 ─── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-light, #ddd)', marginBottom: 12 }}>
        <SubTab active={activeTab === 'web'} onClick={() => setActiveTab('web')}>웹에 공개</SubTab>
        <SubTab active={activeTab === 'members'} onClick={() => setActiveTab('members')}>멤버에 공유</SubTab>
      </div>

      {activeTab === 'web' ? (
        <WebShareSection problemId={problemId} ownerUid={ownerUid} currentTabVis={tabVis} />
      ) : (
        <MemberShareSection
          problemId={problemId}
          ownerUid={ownerUid}
          members={members}
          loading={memLoading}
          onChanged={refreshProblem}
        />
      )}

      {topError && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 11 }}>
          {topError}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
      letterSpacing: 0.3, marginBottom: 6, fontFamily: 'var(--font-ui)',
    }}>
      {children}
    </div>
  );
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 10px', border: 'none', background: 'transparent',
      borderBottom: active ? '2px solid var(--accent-primary, #B8845C)' : '2px solid transparent',
      marginBottom: -1,
      color: active ? 'var(--accent-primary, #B8845C)' : 'var(--text-muted)',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   웹에 공개 (구 링크 공유)
   ═══════════════════════════════════════════════════════ */

function WebShareSection({
  problemId, ownerUid, currentTabVis,
}: {
  problemId: string; ownerUid: string; currentTabVis: Record<string, boolean>;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<ShareWithSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [optionIndex, setOptionIndex] = useState(DEFAULT_OPTION_INDEX);

  useEffect(() => {
    (async () => {
      try {
        const cur = await getShareByProblem(problemId, ownerUid);
        if (cur && !isShareExpired(cur)) setExisting(cur);
        else if (cur) await revokeShare(cur.id);
      } catch (e: any) {
        setError(e.message || '공유 정보를 불러오지 못했습니다.');
      } finally { setLoading(false); }
    })();
  }, [problemId, ownerUid]);

  const shareUrl = useMemo(() => {
    if (!existing) return '';
    return `${window.location.origin}/shared/${existing.id}`;
  }, [existing]);

  const handleCreate = async () => {
    setBusy(true); setError(null);
    try {
      const share = await createShare({
        problemId, ownerUid,
        expiryHours: EXPIRY_OPTIONS[optionIndex].hours,
        tabVisibility: currentTabVis,
      });
      setExisting(share);
    } catch (e: any) {
      setError(e.message || '생성 실패');
    } finally { setBusy(false); }
  };

  const handleRevoke = async () => {
    if (!existing) return;
    if (!confirm('공유 링크를 해제하시겠습니까?')) return;
    setBusy(true);
    try {
      await revokeShare(existing.id);
      setExisting(null);
    } catch (e: any) {
      setError(e.message || '해제 실패');
    } finally { setBusy(false); }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  if (loading) return <div style={{ padding: 10, fontSize: 11, color: 'var(--text-muted)' }}>불러오는 중…</div>;

  return (
    <div>
      {existing ? (
        <>
          <SectionLabel>공유 링크</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input readOnly value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              style={{
                flex: 1, padding: '6px 8px', fontSize: 11,
                border: '1px solid var(--border-light, #ddd)', borderRadius: 5,
                background: 'var(--bg-input, #f8f8f8)', fontFamily: 'monospace',
                minWidth: 0,
              }}
            />
            <button onClick={handleCopy} style={{
              padding: '6px 10px', border: 'none', borderRadius: 5,
              background: 'var(--accent-primary, #B8845C)', color: '#fff',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 10 }}>
            <div>
              {existing.expiresAt === null
                ? '공개 기간: 무기한'
                : `만료: ${existing.expiresAt.toLocaleDateString('ko-KR')} (${formatRemaining(existing.expiresAt)})`}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
              ※ 링크는 생성 시점의 스냅샷입니다. 이후 편집은 반영되지 않습니다.
            </div>
          </div>

          <button onClick={handleRevoke} disabled={busy} style={{
            width: '100%', padding: '6px 0', border: '1px solid var(--accent-danger, #c33)',
            background: 'transparent', color: 'var(--accent-danger, #c33)',
            borderRadius: 5, cursor: busy ? 'wait' : 'pointer',
            fontSize: 11, fontWeight: 600,
          }}>
            공유 해제
          </button>
        </>
      ) : (
        <>
          <SectionLabel>공개기간</SectionLabel>
          <select value={optionIndex} onChange={(e) => setOptionIndex(Number(e.target.value))}
            style={{
              width: '100%', padding: '6px 8px', fontSize: 12, marginBottom: 12,
              border: '1px solid var(--border-light, #ddd)', borderRadius: 5,
              background: 'var(--bg-input, #fff)', boxSizing: 'border-box',
            }}
          >
            {EXPIRY_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>{opt.label}</option>
            ))}
          </select>

          <button onClick={handleCreate}
            disabled={busy || !Object.values(currentTabVis).some((v) => v)}
            style={{
              width: '100%', padding: '7px 0', border: 'none', borderRadius: 5,
              background: busy ? 'var(--text-faint, #ccc)' : 'var(--accent-primary, #B8845C)',
              color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600,
            }}
          >
            {busy ? '생성 중…' : '공유 링크 생성'}
          </button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   멤버에 공유
   ═══════════════════════════════════════════════════════ */

interface MemberRow {
  uid: string;
  role: MemberRole;
  displayName: string;
  email: string;
  photoURL: string;
}

function MemberShareSection({
  problemId, ownerUid, members, loading, onChanged,
}: {
  problemId: string;
  ownerUid: string;
  members: MemberRow[];
  loading: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchInput.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsersByEmailPrefix(q);
        const memberUidSet = new Set(members.map((m) => m.uid));
        setSearchResults(results.filter((u) => u.uid !== ownerUid && !memberUidSet.has(u.uid)));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput, members, ownerUid]);

  const handleAdd = async (user: UserProfile) => {
    setBusy(true); setError(null);
    try {
      await addMember(problemId, user.uid, 'commenter');
      setSearchInput(''); setSearchResults([]);
      await onChanged();
    } catch (e: any) { setError(e.message || '멤버 추가 실패'); }
    finally { setBusy(false); }
  };

  const handleRoleChange = async (uid: string, role: MemberRole) => {
    setBusy(true); setError(null);
    try { await updateMemberRole(problemId, uid, role); await onChanged(); }
    catch (e: any) { setError(e.message || '역할 변경 실패'); }
    finally { setBusy(false); }
  };

  const handleRemove = async (uid: string) => {
    if (!confirm('이 멤버를 제거하시겠습니까?')) return;
    setBusy(true); setError(null);
    try { await removeMember(problemId, uid); await onChanged(); }
    catch (e: any) { setError(e.message || '제거 실패'); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 10, fontSize: 11, color: 'var(--text-muted)' }}>불러오는 중…</div>;

  return (
    <div>
      {/* 멤버 검색 */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="이메일 입력 (2자 이상)"
          style={{
            width: '100%', padding: '6px 8px', fontSize: 12,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 5,
            background: 'var(--bg-input, #fff)', boxSizing: 'border-box',
          }}
        />
        {searchInput.trim().length >= 2 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: 2, background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-light, #ddd)', borderRadius: 5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: 180, overflowY: 'auto', zIndex: 20,
          }}>
            {searching ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>검색 중…</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>일치 없음</div>
            ) : (
              searchResults.map((u) => (
                <button key={u.uid} onClick={() => handleAdd(u)} disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%', padding: '6px 8px', border: 'none',
                    background: 'transparent', cursor: busy ? 'wait' : 'pointer',
                    fontSize: 11, textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName || '(이름 없음)'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 멤버 목록 */}
      <SectionLabel>현재 멤버 ({members.length})</SectionLabel>
      {members.length === 0 ? (
        <div style={{ padding: 10, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          추가된 멤버가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {members.map((m) => (
            <div key={m.uid} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', borderRadius: 5,
            }}>
              <Avatar photoURL={m.photoURL} name={m.displayName} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.displayName || '(이름 없음)'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>
              </div>
              <select value={m.role} disabled={busy}
                onChange={(e) => handleRoleChange(m.uid, e.target.value as MemberRole)}
                style={{
                  padding: '2px 4px', fontSize: 10,
                  border: '1px solid var(--border-light, #ddd)',
                  borderRadius: 4, background: 'var(--bg-input, #fff)',
                }}
              >
                <option value="viewer">보기</option>
                <option value="commenter">댓글</option>
              </select>
              <button onClick={() => handleRemove(m.uid)} disabled={busy}
                style={{
                  border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer',
                  color: 'var(--text-muted)', fontSize: 14, padding: 0, lineHeight: 1,
                  width: 18, height: 18,
                }}
                title="제거"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 5, background: '#fdecea', color: '#a4322a', fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Avatar({ photoURL, name, size = 28 }: { photoURL: string; name: string; size?: number }) {
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, color: '#666', fontWeight: 600,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
