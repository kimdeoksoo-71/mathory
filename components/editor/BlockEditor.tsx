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
  type: 'text' | 'choices' | 'hint';
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    // problemId가 없으면 임시 ID 사용
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '8px 8px 0 0', border: '1px solid #ddd', borderBottom: 'none' }}>
        <MathToolbar onInsert={handleInsert} />
        <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 4px' }} />
        <ImageUploadButton onUpload={handleImageUpload} />
      </div>
      <div style={{ display: 'flex', gap: '16px', height: '500px', minWidth: 0 }}>
        {/* 왼쪽: 블록 목록 */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', border: '1px solid #ddd', borderRadius: '0 0 8px 8px' }}>
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

          <button
            onClick={handleAddBlock}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              border: 'none',
              borderTop: '1px solid #eee',
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
    </div>
  );
}