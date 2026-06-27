'use client';

import { useEffect, useMemo, useState } from 'react';
import EditorPreview from '../editor/EditorPreview';
import { watchCommentStream, isCommentStream, buildThreads } from '../../lib/comments';
import { getUserProfile } from '../../lib/users';
import { ProblemComment, UserProfile } from '../../types/problem';

/**
 * Phase 51 5단계: 공개 문항의 읽기 전용 댓글.
 * - Phase 52(B1): watchCommentStream(commentStream==true 필터 쿼리)로 구독 → agent('normal' 세션)
 *   메시지는 규칙·쿼리 모두에서 제외(규칙레벨 노출 차단). isCommentStream은 방어적 2차 필터로 유지.
 * - 작성 입력창·답글·해결·삭제 등 쓰기 UI 없음(완전 읽기 전용)
 * - 작성자 표시명: users 문서는 비로그인 read 불가(규칙) → 비로그인 방문자에겐 '익명'으로 폴백
 *   (v2: 작성 시 authorName 비정규화로 해소 가능)
 */
export default function PublicComments({
  problemId,
  commentSessionId,
}: {
  problemId: string;
  commentSessionId: string | null;
}) {
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const unsub = watchCommentStream(problemId, setComments);
    return () => unsub();
  }, [problemId]);

  // 댓글 스트림(오너/멤버 댓글 + legacy)만, AI 방어적 제외
  const stream = useMemo(
    () => comments.filter((c) => isCommentStream(c, commentSessionId) && c.authorType !== 'ai'),
    [comments, commentSessionId],
  );
  const threads = useMemo(() => buildThreads(stream), [stream]);

  // 인간 작성자 프로필 백필 (비로그인 시 실패 → '익명')
  useEffect(() => {
    const uids = Array.from(new Set(stream.map((c) => c.authorUid)));
    const missing = uids.filter((u) => !profiles[u]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((u) => getUserProfile(u).catch(() => null))).then((res) => {
      if (cancelled) return;
      setProfiles((prev) => {
        const m = { ...prev };
        missing.forEach((u, i) => { if (res[i]) m[u] = res[i]!; });
        return m;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const nameOf = (uid: string) => {
    const p = profiles[uid];
    return p?.nickname || (p?.email || '').split('@')[0] || p?.displayName || '익명';
  };

  const total = stream.length;

  return (
    <div style={{
      width: 'calc(35em + 72px)', margin: '20px 0 0', boxSizing: 'border-box',
      fontFamily: 'var(--font-ui, sans-serif)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#444', margin: '0 0 10px' }}>
        댓글 {total > 0 && <span style={{ color: 'var(--accent-primary, #B8845C)' }}>{total}</span>}
      </div>

      {threads.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 8, padding: 24, textAlign: 'center',
          color: '#999', fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          아직 댓글이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {threads.map(({ parent, replies }) => (
            <div key={parent.id} style={{
              background: '#fff', borderRadius: 8, padding: '14px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <CommentRow c={parent} name={nameOf(parent.authorUid)} />
              {replies.length > 0 && (
                <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: '2px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {replies.map((r) => (
                    <CommentRow key={r.id} c={r} name={nameOf(r.authorUid)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function CommentRow({ c, name }: { c: ProblemComment; name: string }) {
  return (
    <div style={{ opacity: c.resolved ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: '#e3d6c8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#7a5b3a', fontWeight: 700, flexShrink: 0,
        }}>
          {(name || '?').charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#333' }}>{name}</span>
        <span style={{ fontSize: 11, color: '#aaa' }}>{fmt(c.createdAt)}</span>
        {c.resolved && (
          <span style={{ fontSize: 10, color: '#888', border: '1px solid #ddd', borderRadius: 4, padding: '0 4px' }}>
            해결됨
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, paddingLeft: 30 }}>
        <EditorPreview content={c.content} borderless locale="ko" />
      </div>
    </div>
  );
}
