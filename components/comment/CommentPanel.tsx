'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TabComment, TabMeta, UserProfile } from '../../types/problem';
import {
  listAllComments, addComment, editCommentContent, deleteComment,
  toggleResolved, buildThreads,
} from '../../lib/comments';
import { getUserProfile } from '../../lib/users';
import EditorPreview from '../editor/EditorPreview';
import CommentEditor from './CommentEditor';

interface CommentPanelProps {
  problemId: string;
  ownerUid: string;
  tabs: TabMeta[];
  activeTabId: string;
  /** 패널 사용자의 uid */
  currentUid: string;
  /** 댓글 작성 가능? (owner OR commenter) */
  canComment: boolean;
  /** 본문 폰트 크기 — 댓글은 이보다 2pt 작게 표시 */
  bodyFontSize?: number;
  /** 사용자가 닫기 버튼 누르면 호출 */
  onClose: () => void;
  /** 댓글 개수 변경 시 부모에 알림 (탭 헤더 뱃지 동기화) */
  onCommentsChange?: (comments: TabComment[]) => void;
  /** 패널을 어느 탭으로 시작할지 */
  initialTabId?: string;
  onTabChange?: (tabId: string) => void;
}

export default function CommentPanel({
  problemId, ownerUid, tabs, activeTabId, currentUid, canComment,
  bodyFontSize = 15,
  onClose, onCommentsChange,
}: CommentPanelProps) {
  // 본문보다 2pt 작게 (최소 9px)
  const commentFontSize = Math.max(9, bodyFontSize - 2);
  const [comments, setComments] = useState<TabComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hideResolved, setHideResolved] = useState(false);

  const refresh = useCallback(async () => {
    const all = await listAllComments(problemId);
    setComments(all);
    onCommentsChange?.(all);
    // 모르는 uid의 프로필 로드
    const unknownUids = Array.from(new Set(all.map((c) => c.authorUid))).filter((u) => !profiles[u]);
    if (unknownUids.length > 0) {
      const fetched = await Promise.all(unknownUids.map((u) => getUserProfile(u).catch(() => null)));
      const map: Record<string, UserProfile> = { ...profiles };
      unknownUids.forEach((u, i) => { if (fetched[i]) map[u] = fetched[i]!; });
      setProfiles(map);
    }
  }, [problemId, profiles, onCommentsChange]);

  useEffect(() => {
    setLoading(true);
    refresh().catch((e) => console.error('댓글 로드 실패:', e)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  const tabComments = useMemo(() => comments.filter((c) => c.tabId === activeTabId), [comments, activeTabId]);
  const threads = useMemo(() => buildThreads(tabComments), [tabComments]);
  const visibleThreads = hideResolved ? threads.filter((t) => !t.parent.resolved) : threads;

  const isOwner = currentUid === ownerUid;

  const handleAdd = async (content: string, parentCommentId: string | null = null) => {
    await addComment({ problemId, tabId: activeTabId, authorUid: currentUid, content, parentCommentId });
    setReplyingTo(null);
    await refresh();
  };

  const handleEdit = async (commentId: string, content: string) => {
    await editCommentContent(problemId, commentId, content);
    setEditingId(null);
    await refresh();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    await deleteComment(problemId, commentId);
    await refresh();
  };

  const handleResolve = async (comment: TabComment) => {
    await toggleResolved(problemId, comment.id, !comment.resolved);
    await refresh();
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 380, maxWidth: '90vw',
      background: 'var(--bg-card, #fff)',
      borderLeft: '1px solid var(--border-light, #ddd)',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50,
      fontFamily: 'var(--font-ui)',
    }}>
      {/* 댓글 본문 스타일: 고딕(UI 폰트) + 본문 폰트보다 2pt 작게 + 톤다운 */}
      <style>{`
        .comment-body > div {
          font-family: var(--font-ui, 'Pretendard', sans-serif) !important;
          font-size: ${commentFontSize}px !important;
          line-height: 1.8 !important;
        }
        .comment-body { color: #6a6a6a; }
        /* 수식은 EditorView 미리보기와 동일하게 본문 기본색으로 */
        .comment-body .katex,
        .comment-body .katex * { color: var(--text-primary); }
      `}</style>
      {/* 헤더 — 사이드바·본문 상단바와 같은 52px */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        minHeight: 52, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border-light, #eee)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          댓글 — {tabs.find((t) => t.id === activeTabId)?.label || activeTabId}
        </div>
        {/* 토글 텍스트 (체크박스 제거, 글자 클릭으로 토글) */}
        <button
          onClick={() => setHideResolved((v) => !v)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', padding: '2px 4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary, #B8845C)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          {hideResolved ? '해결된 댓글 보이기' : '해결된 댓글 숨기기'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 20, padding: 0, lineHeight: 1,
          }}
          title="댓글 사이드바 닫기"
        >×</button>
      </div>

      {/* 댓글 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            불러오는 중…
          </div>
        ) : visibleThreads.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {threads.length === 0 ? '아직 댓글이 없습니다.' : '표시할 댓글이 없습니다.'}
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <CommentThreadView
              key={thread.parent.id}
              thread={thread}
              profiles={profiles}
              currentUid={currentUid}
              isOwner={isOwner}
              canComment={canComment}
              replyingToId={replyingTo}
              editingId={editingId}
              onSetReplying={setReplyingTo}
              onSetEditing={setEditingId}
              onReplySubmit={(content) => handleAdd(content, thread.parent.id)}
              onEditSubmit={(commentId, content) => handleEdit(commentId, content)}
              onDelete={handleDelete}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>

      {/* 신규 댓글 입력 */}
      {canComment ? (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-light, #eee)',
          background: 'var(--bg-primary, #FAF9F7)',
        }}>
          <CommentEditor
            placeholder="댓글 작성... (Ctrl+Enter 전송, 수식: $...$)"
            onSubmit={(content) => handleAdd(content, null)}
          />
        </div>
      ) : (
        <div style={{
          padding: 12, borderTop: '1px solid var(--border-light, #eee)',
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          댓글 작성 권한이 없습니다.
        </div>
      )}
    </div>
  );
}

/* ─── 스레드 단위 렌더 ─── */
function CommentThreadView({
  thread, profiles, currentUid, isOwner, canComment,
  replyingToId, editingId,
  onSetReplying, onSetEditing,
  onReplySubmit, onEditSubmit, onDelete, onResolve,
}: {
  thread: { parent: TabComment; replies: TabComment[] };
  profiles: Record<string, UserProfile>;
  currentUid: string;
  isOwner: boolean;
  canComment: boolean;
  replyingToId: string | null;
  editingId: string | null;
  onSetReplying: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
  onReplySubmit: (content: string) => Promise<void>;
  onEditSubmit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onResolve: (c: TabComment) => void;
}) {
  const { parent, replies } = thread;
  return (
    <div style={{
      marginBottom: 16,
      padding: 10,
      borderRadius: 8,
      background: parent.resolved ? 'var(--bg-hover, #f5f5f5)' : 'transparent',
      opacity: parent.resolved ? 0.65 : 1,
      border: parent.resolved ? '1px solid var(--border-light)' : '1px solid transparent',
    }}>
      <CommentItem
        comment={parent}
        profile={profiles[parent.authorUid]}
        currentUid={currentUid}
        isOwner={isOwner}
        canComment={canComment}
        isEditing={editingId === parent.id}
        isReplying={replyingToId === parent.id}
        onSetEditing={(v) => onSetEditing(v ? parent.id : null)}
        onSetReplying={(v) => onSetReplying(v ? parent.id : null)}
        onEditSubmit={(c) => onEditSubmit(parent.id, c)}
        onDelete={() => onDelete(parent.id)}
        onResolve={() => onResolve(parent)}
      />

      {replies.length > 0 && (
        <div style={{ marginLeft: 20, marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--border-light)' }}>
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              profile={profiles[r.authorUid]}
              currentUid={currentUid}
              isOwner={isOwner}
              canComment={canComment}
              isReply
              isEditing={editingId === r.id}
              isReplying={false}
              onSetEditing={(v) => onSetEditing(v ? r.id : null)}
              onSetReplying={() => {}}
              onEditSubmit={(c) => onEditSubmit(r.id, c)}
              onDelete={() => onDelete(r.id)}
              onResolve={() => {}}
            />
          ))}
        </div>
      )}

      {/* 답글 입력 폼 */}
      {replyingToId === parent.id && canComment && (
        <div style={{ marginLeft: 20, marginTop: 8 }}>
          <CommentEditor
            placeholder="답글…"
            submitLabel="답글"
            autoFocus
            onSubmit={onReplySubmit}
            onCancel={() => onSetReplying(null)}
          />
        </div>
      )}
    </div>
  );
}

/* ─── 댓글 한 개 ─── */
function CommentItem({
  comment, profile, currentUid, isOwner, canComment, isReply,
  isEditing, isReplying,
  onSetEditing, onSetReplying,
  onEditSubmit, onDelete, onResolve,
}: {
  comment: TabComment;
  profile?: UserProfile;
  currentUid: string;
  isOwner: boolean;
  canComment: boolean;
  isReply?: boolean;
  isEditing: boolean;
  isReplying: boolean;
  onSetEditing: (v: boolean) => void;
  onSetReplying: (v: boolean) => void;
  onEditSubmit: (content: string) => Promise<void>;
  onDelete: () => void;
  onResolve: () => void;
}) {
  const isMine = comment.authorUid === currentUid;
  const idOnly = (profile?.email || '').split('@')[0] || profile?.displayName || '익명';

  return (
    <div style={{ marginBottom: isReply ? 8 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {profile?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoURL} alt={idOnly} referrerPolicy="no-referrer"
            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
            background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: '#666',
          }}>{idOnly.charAt(0).toUpperCase()}</div>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{idOnly}</span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
          {formatRelative(comment.createdAt)}
          {comment.updatedAt.getTime() - comment.createdAt.getTime() > 60_000 && ' (수정됨)'}
        </span>
      </div>

      <div style={{ paddingLeft: 24 }}>
        {isEditing ? (
          <CommentEditor
            initialValue={comment.content}
            submitLabel="저장"
            clearOnSubmit={false}
            autoFocus
            onSubmit={onEditSubmit}
            onCancel={() => onSetEditing(false)}
          />
        ) : (
          <div className="comment-body">
            <EditorPreview content={comment.content} borderless autoHeight locale="ko" />
          </div>
        )}
      </div>

      {!isEditing && (
        <div style={{
          paddingLeft: 24, marginTop: 4,
          display: 'flex', gap: 12,
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          {!isReply && canComment && (
            <button onClick={() => onSetReplying(!isReplying)} style={miniLinkStyle}>
              {isReplying ? '답글 취소' : '답글'}
            </button>
          )}
          {!isReply && (isOwner || isMine) && (
            <button
              onClick={onResolve}
              style={{ ...miniLinkStyle, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={comment.resolved ? '해결 취소' : '해결됨으로 표시'}
            >
              <input
                type="checkbox"
                checked={comment.resolved}
                readOnly
                tabIndex={-1}
                style={{
                  margin: 0, width: 11, height: 11,
                  accentColor: 'var(--text-muted)',
                  cursor: 'pointer', pointerEvents: 'none',
                }}
              />
              해결됨
            </button>
          )}
          {isMine && (
            <>
              <button onClick={() => onSetEditing(true)} style={miniLinkStyle}>수정</button>
              <button onClick={onDelete} style={{ ...miniLinkStyle, color: 'var(--accent-danger)' }}>삭제</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const miniLinkStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer',
  padding: 0, fontSize: 11, color: 'var(--text-muted)',
  fontFamily: 'var(--font-ui)',
};

function formatRelative(d: Date): string {
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
