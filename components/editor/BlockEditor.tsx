'use client';

import { useState, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableBlock from './SortableBlock';
import MathToolbar from './MathToolbar';
import EditorPreview from './EditorPreview';
import ImageUploadButton from './ImageUploadButton';
import { MarkdownEditorHandle } from './MarkdownEditor';
import { uploadImage } from '../../lib/storage';

export interface BlockData {
  id: string;
  type: 'text' | 'image' | 'choices' | 'box';
  raw_text: string;
}

interface BlockEditorProps {
  blocks: BlockData[];
  onChange: (blocks: BlockData[]) => void;
  problemId?: string;
}

export default function BlockEditor({ blocks, onChange, problemId }: BlockEditorProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    blocks.length > 0 ? blocks[0].id : null
  );
  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});

  const [editorHeight, setEditorHeight] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = editorHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = Math.max(200, Math.min(900, startHeight + (e.clientY - startY)));
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const previewContent = blocks.map((b) => b.raw_text).join('\n\n---\n\n');

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  const handleBlockChange = (blockId: string, value: string) => {
    onChange(blocks.map((b) => (b.id === blockId ? { ...b, raw_text: value } : b)));
  };

  const handleBlockTypeChange = (blockId: string, type: BlockData['type']) => {
    onChange(blocks.map((b) => (b.id === blockId ? { ...b, type } : b)));
  };

  const handleAddBlock = () => {
    const newBlock: BlockData = {
      id: `block-${Date.now()}`,
      type: 'text',
      raw_text: '',
    };
    onChange([...blocks, newBlock]);
    setActiveBlockId(newBlock.id);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) return;
    const newBlocks = blocks.filter((b) => b.id !== blockId);
    onChange(newBlocks);
    if (activeBlockId === blockId) {
      setActiveBlockId(newBlocks[0]?.id || null);
    }
  };

  const handleInsert = (template: string, cursorOffset: number) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]!.insertText(template, cursorOffset);
    }
  };

  const handleImageUpload = async (file: File) => {
    const pid = problemId || `temp-${Date.now()}`;
    const url = await uploadImage(file, pid);
    const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;

    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]!.insertText(markdownImage, markdownImage.length);
    }
  };

  const setEditorRef = (blockId: string, ref: MarkdownEditorHandle | null) => {
    editorRefs.current[blockId] = ref;
  };

  return (
    <div>
      {/* 툴바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '10px 8px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px 8px 0 0',
          border: '1px solid #ddd',
        }}
      >
        <MathToolbar onInsert={handleInsert} />
        <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 4px' }} />
        <ImageUploadButton onUpload={handleImageUpload} />
      </div>

      {/* Split View */}
      <div style={{ display: 'flex', gap: '16px', height: `${editorHeight}px`, minWidth: 0 }}>
        {/* 왼쪽: 블록 목록 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #ddd',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}
        >
          {/* 블록 리스트 스크롤 영역 */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block, index) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    index={index}
                    isActive={activeBlockId === block.id}
                    canDelete={blocks.length > 1}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChange={(value) => handleBlockChange(block.id, value)}
                    onTypeChange={(type) => handleBlockTypeChange(block.id, type)}
                    onDelete={() => handleDeleteBlock(block.id)}
                    setEditorRef={(ref) => setEditorRef(block.id, ref)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* 블록 추가 버튼: 하단 고정 */}
          <button
            onClick={handleAddBlock}
            style={{
              flexShrink: 0,
              width: '100%',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              border: 'none',
              borderTop: '1px solid #ddd',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#666',
            }}
          >
            + 블록 추가
          </button>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditorPreview content={previewContent} />
        </div>
      </div>

      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          height: '8px',
          cursor: 'ns-resize',
          backgroundColor: isResizing ? '#4285f4' : '#e8e8e8',
          borderRadius: '0 0 4px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.backgroundColor = '#ccc'; }}
        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.backgroundColor = '#e8e8e8'; }}
      >
        <div style={{ width: '40px', height: '3px', backgroundColor: '#bbb', borderRadius: '2px' }} />
      </div>
    </div>
  );
}
