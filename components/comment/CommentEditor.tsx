'use client';

import { useRef, useState } from 'react';
import EditorPreview from '../editor/EditorPreview';
import MiniMathToolbar from './MiniMathToolbar';

interface CommentEditorProps {
  /** 초기 내용 (편집 모드 시) */
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** 작성/저장 콜백. 반환 promise resolve 시 내부 상태 초기화 */
  onSubmit: (content: string) => Promise<void>;
  /** 취소 콜백 (있으면 취소 버튼 표시) */
  onCancel?: () => void;
  /** 작성 후 textarea 비울지 (답글 작성/신규 댓글: true, 편집: false) */
  clearOnSubmit?: boolean;
  autoFocus?: boolean;
}

export default function CommentEditor({
  initialValue = '',
  placeholder = '댓글 작성... (수식: $...$ )',
  submitLabel = '작성',
  onSubmit, onCancel,
  clearOnSubmit = true,
  autoFocus = false,
}: CommentEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      if (clearOnSubmit) setValue('');
      setShowPreview(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      border: '1px solid var(--border-light, #ddd)',
      borderRadius: 8, padding: 8,
      background: 'var(--bg-card, #fff)',
      fontFamily: 'var(--font-ui)',
    }}>
      <MiniMathToolbar textareaRef={textareaRef} onChange={setValue} />

      {showPreview ? (
        <div style={{
          minHeight: 60, padding: 6, fontSize: 13,
          border: '1px dashed var(--border-light, #ddd)', borderRadius: 4,
          background: 'var(--bg-input, #fafafa)',
        }}>
          {value.trim() ? (
            <EditorPreview content={value} borderless autoHeight locale="ko" />
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>(미리볼 내용 없음)</span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          style={{
            width: '100%', minHeight: 120,
            border: 'none', outline: 'none', resize: 'vertical',
            fontSize: 13, lineHeight: 1.5,
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-primary)', background: 'transparent',
            padding: 4, boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginTop: 4, paddingTop: 4,
        borderTop: '1px solid var(--border-light, #eee)',
      }}>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px',
          }}
        >
          {showPreview ? '편집' : '미리보기'}
        </button>
        <div style={{ flex: 1 }} />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px',
            }}
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !value.trim()}
          style={{
            padding: '5px 14px',
            border: 'none', borderRadius: 5,
            background: (submitting || !value.trim()) ? 'var(--text-faint, #ccc)' : 'var(--accent-primary, #B8845C)',
            color: '#fff',
            cursor: (submitting || !value.trim()) ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600,
          }}
        >
          {submitting ? '저장 중…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
