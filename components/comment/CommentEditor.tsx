'use client';

import { useRef, useState, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import EditorPreview from '../editor/EditorPreview';
import MathSymbolPalette from '../editor/MathSymbolPalette';
import LatexInputEditor, { LatexInputEditorHandle } from './LatexInputEditor';
import {
  OCR_ACCEPT, OCR_LANGUAGES, validateOcrFile, toDataUrl, normalizeAndFix,
} from '../../lib/ocr';
import { uploadImage } from '../../lib/storage';

export interface CommentEditorHandle {
  focus(): void;
}

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
  /** 상단 바 좌측에 들어갈 노드(예: AI 모델 칩 리스트). 우측엔 수식·미리보기·작성 버튼이 붙는다. */
  headerLeft?: ReactNode;
  /** 그림 업로드 시 Storage 경로용. 미지정 시 그림 버튼 숨김. */
  problemId?: string;
  /** 입력 글자수 상한 (기본 1000). 토론 답변이 지나치게 길어지는 것을 방지 */
  maxLength?: number;
  /** 입력창 세로 높이(px). 메인 작성 영역은 패널에서 드래그 리사이즈로 제어, 답글은 기본 120 */
  inputHeight?: number;
}

const CommentEditor = forwardRef<CommentEditorHandle, CommentEditorProps>(function CommentEditor({
  initialValue = '',
  placeholder = '댓글 작성... (수식: $...$ )',
  submitLabel = '작성',
  onSubmit, onCancel,
  clearOnSubmit = true,
  autoFocus = false,
  headerLeft,
  problemId,
  maxLength = 1000,
  inputHeight = 120,
}, ref) {
  const [value, setValue] = useState(initialValue);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const editorRef = useRef<LatexInputEditorHandle>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 부모(CommentPanel)가 답글 버튼 클릭 시 메인 입력창에 포커스를 줄 수 있도록
  useImperativeHandle(ref, () => ({
    focus() {
      editorRef.current?.focus();
    },
  }));

  const handleImageClick = () => {
    if (imageUploading || !problemId) return;
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !problemId) return;
    setImageUploading(true);
    try {
      const url = await uploadImage(file, problemId);
      const baseName = file.name.replace(/"/g, '');
      const markdownImage = `<img src="${url}" alt="${baseName}" width="400" />`;
      const payload = `\n${markdownImage}\n`;
      editorRef.current?.insertAtCursor(payload, payload.length);
      setShowPreview(false);
    } catch (err) {
      alert(`이미지 업로드 중 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImageUploading(false);
    }
  };

  const handleOcrClick = () => {
    if (ocrLoading) return;
    ocrInputRef.current?.click();
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    const err = validateOcrFile(file);
    if (err) { alert(err); return; }
    setOcrLoading(true);
    try {
      const src = await toDataUrl(file);
      const resp = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, languages: OCR_LANGUAGES }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.error || 'OCR 실패');
        return;
      }
      const normalized = normalizeAndFix(data.text as string);
      const payload = `\n${normalized}\n`;
      editorRef.current?.insertAtCursor(payload, payload.length);
      // 미리보기 모드였다면 편집 모드로 전환 (insert 결과 보기 위해)
      setShowPreview(false);
    } catch (err) {
      alert(`OCR 처리 중 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    // 즉시 입력창 비우기 — AI 응답을 기다리지 않고 사용자에게 "전송됨"을 시각화
    if (clearOnSubmit) {
      setValue('');
      editorRef.current?.setValue('');
      setShowPreview(false);
    }
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      fontFamily: 'var(--font-ui)',
    }}>
      {/* ── 상단 바: (좌) headerLeft(AI 모델 칩 등)  ·  (우) 수식·미리보기/편집·작성 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{headerLeft}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Phase 40-4: 통일 수식 팔레트 (일반 텍스트라 $…$ 래핑, 위로 펼침) */}
          <MathSymbolPalette
            wrapInDollar
            openUp
            alignRight
            onInsert={(text, offset) => editorRef.current?.insertAtCursor(text, offset)}
          />
          <button
            type="button"
            onClick={handleOcrClick}
            disabled={ocrLoading}
            title="이미지에서 수식·텍스트 인식 (OCR)"
            style={{
              border: 'none',
              background: 'transparent',
              borderRadius: 4,
              cursor: ocrLoading ? 'wait' : 'pointer',
              color: ocrLoading ? 'var(--text-faint)' : 'var(--text-secondary)',
              padding: 2,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* 편집창 툴바와 동일한 OCR 아이콘 (UnifiedToolbar.tsx 참조) */}
            <svg
              width="18" height="18" viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 20 L8 8 L20 8" />
              <path d="M44 8 L56 8 L56 20" />
              <path d="M56 44 L56 56 L44 56" />
              <path d="M20 56 L8 56 L8 44" />
              <text
                x="32" y="38"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight="700"
                fontSize="18"
                fill="currentColor"
                stroke="none"
                letterSpacing="1"
              >OCR</text>
            </svg>
          </button>
          <input
            ref={ocrInputRef}
            type="file"
            accept={OCR_ACCEPT}
            onChange={handleOcrFileChange}
            style={{ display: 'none' }}
          />
          {problemId && (
            <>
              <button
                type="button"
                onClick={handleImageClick}
                disabled={imageUploading}
                title="그림 삽입"
                style={{
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  cursor: imageUploading ? 'wait' : 'pointer',
                  color: imageUploading ? 'var(--text-faint)' : 'var(--text-secondary)',
                  padding: 2,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {/* 그림 삽입 아이콘 — 액자 + 산봉우리 + 해 (회색 모노톤) */}
                <svg
                  width="18" height="18" viewBox="0 0 64 64"
                  fill="none"
                  stroke="#888"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="8" y="12" width="48" height="40" rx="3" />
                  <circle cx="22" cy="24" r="3.5" fill="#888" stroke="none" />
                  <path d="M8 44 L24 30 L36 40 L46 32 L56 42 L56 52 L8 52 Z"
                    fill="#ccc" />
                  <path d="M8 44 L24 30 L36 40 L46 32 L56 42" stroke="#888" />
                </svg>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleImageFileChange}
                style={{ display: 'none' }}
              />
            </>
          )}
        </div>
      </div>

      {/* 에디터는 항상 마운트 상태 유지 (미리보기 토글 시 내용·커서·undo 히스토리 보존).
          미리보기 표시 중에는 CSS로만 숨김. */}
      <div style={{ display: showPreview ? 'none' : 'block' }}>
        <LatexInputEditor
          ref={editorRef}
          initialValue={initialValue}
          fontSize={13}
          minHeight={inputHeight}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxLength={maxLength}
          onChange={setValue}
          onSubmit={handleSubmit}
        />
      </div>
      {showPreview && (
        <div style={{
          minHeight: inputHeight, padding: 6, fontSize: 13,
        }}>
          {value.trim() ? (
            <EditorPreview content={value} borderless autoHeight locale="ko" />
          ) : (
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>(미리볼 내용 없음)</span>
          )}
        </div>
      )}

      {/* ── 하단 바: (우) 미리보기·취소·작성 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 6, marginTop: 6,
      }}>
        <span style={{
          fontSize: 11, marginRight: 'auto',
          color: value.length >= maxLength ? 'var(--accent-danger, #c0392b)' : 'var(--text-faint)',
        }}>
          {value.length}/{maxLength}
        </span>
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
          {submitLabel}
        </button>
      </div>
    </div>
  );
});

export default CommentEditor;
