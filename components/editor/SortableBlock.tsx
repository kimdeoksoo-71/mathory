'use client';

import { useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MarkdownEditor, { MarkdownEditorHandle } from './MarkdownEditor';
import { BlockData } from './BlockEditor';

interface SortableBlockProps {
  block: BlockData;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onTypeChange: (type: BlockData['type']) => void;
  onDelete: () => void;
  setEditorRef: (ref: MarkdownEditorHandle | null) => void;
  onSnippetShortcut?: (index: number) => void;
}

export default function SortableBlock({
  block,
  index,
  isActive,
  canDelete,
  onFocus,
  onChange,
  onTypeChange,
  onDelete,
  setEditorRef,
  onSnippetShortcut,
}: SortableBlockProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    setEditorRef(editorRef.current);
  }, [editorRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      style={{
        ...style,
        borderBottom: '1px solid #eee',
        backgroundColor: isActive ? '#fafbff' : '#fff',
      }}
      onClick={onFocus}
    >
      {/* 블록 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: isActive ? '#eef0ff' : '#f8f9fa',
          borderBottom: '1px solid #eee',
          fontSize: '12px',
        }}
      >
        {/* 드래그 핸들 */}
        <span
          {...attributes}
          {...listeners}
          tabIndex={-1}
          style={{
            cursor: 'grab',
            fontSize: '16px',
            color: '#999',
            userSelect: 'none',
            padding: '2px 4px',
          }}
        >
          ⠿
        </span>

        <span style={{ color: '#888' }}>블록 {index + 1}</span>

        <select
          value={block.type}
          onChange={(e) => onTypeChange(e.target.value as BlockData['type'])}
          style={{
            padding: '2px 6px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            backgroundColor: '#fff',
          }}
        >
          <option value="text">텍스트</option>
          <option value="choices">선택지</option>
          <option value="image">그림</option>
          <option value="box">글상자</option>
        </select>

        <div style={{ flex: 1 }} />

        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              padding: '2px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#999',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ea4335';
              e.currentTarget.style.borderColor = '#ea4335';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#999';
              e.currentTarget.style.borderColor = '#ddd';
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 에디터 */}
      <div style={{ height: '150px' }}>
        <MarkdownEditor
          ref={editorRef}
          initialValue={block.raw_text}
          onChange={onChange}
          onSnippetShortcut={onSnippetShortcut}
        />
      </div>
    </div>
  );
}