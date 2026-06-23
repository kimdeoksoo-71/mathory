'use client';

import { useState, useEffect, useRef } from 'react';
import { Problem, MemberRole, UserProfile } from '../../types/problem';
import {
  searchUsers, addMember, removeMember, updateMemberRole,
} from '../../lib/membership';
import { getProblem } from '../../lib/firestore';
import { getUserProfile } from '../../lib/users';

interface MemberRow {
  uid: string;
  role: MemberRole;
  displayName: string;
  nickname?: string;
  email: string;
  photoURL: string;
}

interface ShareTargetModalProps {
  problem: Problem;
  onClose: () => void;
  /** 멤버 변경 후 상위 목록 갱신 */
  onChanged: () => void;
}

/**
 * Phase 49: 받는 사람 검색 모달 (대화명/이메일).
 * 신규 공유와 대상 추가를 모두 처리 — DnD 없이도 공유를 거는 정식 경로.
 */
export default function ShareTargetModal({ problem, onClose, onChanged }: ShareTargetModalProps) {
  const ownerUid = problem.authorUid || '';
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addRole, setAddRole] = useState<MemberRole>('commenter');
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async (notify = false) => {
    const fresh = await getProblem(problem.id);
    const memberMap = fresh?.members || {};
    const uids = Object.keys(memberMap);
    const profiles = await Promise.all(uids.map((uid) =>
      getUserProfile(uid).then((p) => p ?? {
        uid, displayName: '', email: '', photoURL: '', createdAt: new Date(),
      } as UserProfile)));
    setMembers(uids.map((uid, i) => ({
      uid, role: memberMap[uid],
      displayName: profiles[i].displayName,
      nickname: profiles[i].nickname,
      email: profiles[i].email,
      photoURL: profiles[i].photoURL,
    })));
    if (notify) onChanged();
  };

  useEffect(() => {
    (async () => {
      try { await refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : '정보를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchInput.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchUsers(q);
        const memberSet = new Set(members.map((m) => m.uid));
        setResults(found.filter((u) => u.uid !== ownerUid && !memberSet.has(u.uid)));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput, members, ownerUid]);

  const handleAdd = async (u: UserProfile) => {
    setBusy(true); setError(null);
    try {
      await addMember(problem.id, u.uid, addRole);
      setSearchInput(''); setResults([]);
      await refresh(true);
    } catch (e) { setError(e instanceof Error ? e.message : '공유 추가 실패'); }
    finally { setBusy(false); }
  };

  const handleRoleChange = async (uid: string, role: MemberRole) => {
    setBusy(true); setError(null);
    try { await updateMemberRole(problem.id, uid, role); await refresh(true); }
    catch (e) { setError(e instanceof Error ? e.message : '권한 변경 실패'); }
    finally { setBusy(false); }
  };

  const handleRemove = async (uid: string) => {
    if (!confirm('이 사용자와의 공유를 해제하시겠습니까?')) return;
    setBusy(true); setError(null);
    try { await removeMember(problem.id, uid); await refresh(true); }
    catch (e) { setError(e instanceof Error ? e.message : '공유 해제 실패'); }
    finally { setBusy(false); }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto',
          background: 'var(--bg-primary, #fff)', borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,.18)', padding: 24, fontFamily: 'var(--font-ui)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          공유 대상 관리
        </h2>
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {problem.title || '(제목 없음)'}
        </p>

        {/* 검색 + 추가 권한 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            autoFocus
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="대화명 또는 이메일 (2자 이상)"
            style={{
              flex: 1, minWidth: 0, padding: '8px 10px', fontSize: 13,
              border: '1px solid var(--border-primary)', borderRadius: 8,
              background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
              boxSizing: 'border-box', fontFamily: 'var(--font-ui)',
            }}
          />
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as MemberRole)}
            title="추가 시 권한"
            style={{
              padding: '8px 6px', fontSize: 12, border: '1px solid var(--border-primary)',
              borderRadius: 8, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
            }}
          >
            <option value="commenter">댓글</option>
            <option value="viewer">보기</option>
          </select>
        </div>

        {/* 검색 결과 */}
        {searchInput.trim().length >= 2 && (
          <div style={{
            border: '1px solid var(--border-light, #ddd)', borderRadius: 8,
            maxHeight: 200, overflowY: 'auto', marginBottom: 14,
          }}>
            {searching ? (
              <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>검색 중…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>일치하는 사용자가 없습니다.</div>
            ) : (
              results.map((u) => (
                <button key={u.uid} onClick={() => handleAdd(u)} disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 10px', border: 'none', background: 'transparent',
                    cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Avatar photoURL={u.photoURL} name={u.nickname || u.displayName} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.nickname || u.displayName || '(이름 없음)'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--accent-primary, #B8845C)', fontWeight: 700 }}>+</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* 현재 공유 대상 */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          현재 공유 대상 ({members.length})
        </div>
        {loading ? (
          <div style={{ padding: 10, fontSize: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            아직 공유한 사용자가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {members.map((m) => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
                <Avatar photoURL={m.photoURL} name={m.nickname || m.displayName} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.nickname || m.displayName || '(이름 없음)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email}
                  </div>
                </div>
                <select value={m.role} disabled={busy}
                  onChange={(e) => handleRoleChange(m.uid, e.target.value as MemberRole)}
                  style={{
                    padding: '3px 4px', fontSize: 11, border: '1px solid var(--border-light, #ddd)',
                    borderRadius: 6, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)',
                  }}
                >
                  <option value="commenter">댓글</option>
                  <option value="viewer">보기</option>
                </select>
                <button onClick={() => handleRemove(m.uid)} disabled={busy}
                  title="공유 해제"
                  style={{
                    border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer',
                    color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, width: 20, height: 20,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: 8, borderRadius: 6, background: '#fdecea', color: '#a4322a', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose}
            style={{
              padding: '8px 18px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--text-primary)', color: 'var(--bg-primary, #fff)',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >
            완료
          </button>
        </div>
      </div>
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
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, color: '#666', fontWeight: 600,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
