'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Problem, Block, ProblemWithBlocks, Folder } from '../../types/problem';
import {
  getProblemWithBlocks, updateProblem,
  saveQuestionBlock, saveSolutionBlock,
  updateBlock, deleteBlock,
} from '../../lib/firestore';
import { CATEGORY_OPTIONS, DIFFICULTIES, DEFAULT_DIFFICULTY } from '../../lib/constants';
import MarkdownEditor, { MarkdownEditorHandle } from '../editor/MarkdownEditor';
import EditorPreview from '../editor/EditorPreview';
import MathToolbar from '../editor/MathToolbar';
import ImageUploadButton from '../editor/ImageUploadButton';
import { uploadImage } from '../../lib/storage';
import {
  IconChevronLeft, IconSave, IconGrip, IconSplit, IconPlus,
  IconChevron, IconChevronDown, IconTrash,
} from '../ui/Icons';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ═══ 타입 & 상수 ═══ */

interface LocalBlock extends Block {
  collapsed: boolean;
  isNew?: boolean;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  image: '그림',
  choices: '선택지',
  box: '글상자',
};

const BLOCK_TYPES = ['text', 'image', 'choices', 'box'] as const;

const CHOICES_LABELS = ['①', '②', '③', '④', '⑤'];

const DEFAULT_CHOICES = CHOICES_LABELS.map((c) => `${c} `).join('\n');

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const FONT_SIZE_MIN = 11;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;

/* ═══ Font Size 유틸 ═══ */

function getStoredFontSize(): number {
  if (typeof window === 'undefined') return FONT_SIZE_DEFAULT;
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!isNaN(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) return n;
  }
  return FONT_SIZE_DEFAULT;
}

function setStoredFontSize(size: number) {
  localStorage.setItem(FONT_SIZE_KEY, String(size));
  // CSS 변수도 설정 (ProblemView에서 사용)
  document.documentElement.style.setProperty('--content-font-size', size + 'px');
}

/* ═══ Props ═══ */

interface EditorViewProps {
  problemId: string;
  folders: Folder[];
  onBack: () => void;
}

/* ═══ SortableEditorBlock ═══ */

function SortableEditorBlock({
  block, index, isActive, canDelete, editorRefs,
  onFocus, onChange, onTypeChange, onTitleChange,
  onDelete, onToggleCollapse,
  onImageUpload, problemId,
}: {
  block: LocalBlock;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  editorRefs: React.MutableRefObject<Record<string, MarkdownEditorHandle | null>>;
  onFocus: () => void;
  onChange: (value: string) => void;
  onTypeChange: (type: Block['type']) => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onImageUpload: (file: File, blockId: string) => void;
  problemId: string;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const headerBg = isActive ? 'var(--accent-primary, #5b6abf)' : 'var(--bg-hover, #f0ece8)';
  const headerColor = isActive ? '#fff' : 'var(--text-muted)';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 8 }}
      onClick={onFocus}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: headerBg,
        borderRadius: block.collapsed ? 8 : '8px 8px 0 0',
        fontSize: 12, color: headerColor,
        transition: 'background 0.15s',
      }}>
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', display: 'flex', padding: '2px 2px', flexShrink: 0, opacity: 0.7 }}
          title="드래그하여 이동"
        >
          <IconGrip size={13} />
        </span>

        <select
          value={block.type}
          onChange={(e) => onTypeChange(e.target.value as Block['type'])}
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '1px 4px', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 4, fontSize: 11, cursor: 'pointer',
            background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-card, #fff)',
            color: isActive ? '#fff' : 'var(--text-secondary)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <span style={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }}>
          {index + 1}
        </span>

        <input
          value={block.title || ''}
          onChange={(e) => onTitleChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="블록 이름..."
          style={{
            flex: 1, minWidth: 60,
            border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: 11, padding: '2px 4px',
            color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
          }}
        />

        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', padding: 2, borderRadius: 4,
              color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)',
            }}
            title="블록 삭제"
          >
            <IconTrash size={12} />
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', padding: 2, borderRadius: 4,
            color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
            transition: 'transform 0.15s',
            transform: block.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
          title={block.collapsed ? '펼치기' : '접기'}
        >
          <IconChevronDown size={13} />
        </button>
      </div>

      {!block.collapsed && (
        <div style={{
          border: isActive
            ? '2px solid var(--accent-primary, #5b6abf)'
            : '1px solid var(--border-primary, #ddd)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
          transition: 'border-color 0.15s',
        }}>
          {(block.type === 'text' || block.type === 'box') && (
            <MarkdownEditor
              ref={(el) => { editorRefs.current[block.id] = el; }}
              initialValue={block.raw_text}
              onChange={onChange}
              autoHeight
            />
          )}

          {block.type === 'image' && (
            <ImageBlockContent
              rawText={block.raw_text}
              onUpload={(file) => onImageUpload(file, block.id)}
            />
          )}

          {block.type === 'choices' && (
            <ChoicesBlockContent
              rawText={block.raw_text}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ 그림 블록 내용 ═══ */

function ImageBlockContent({
  rawText, onUpload,
}: {
  rawText: string;
  onUpload: (file: File) => void;
}) {
  const imgMatch = rawText.match(/src="([^"]+)"/);
  const imgUrl = imgMatch ? imgMatch[1] : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div style={{ padding: 16, textAlign: 'center', minHeight: 120 }}>
      {imgUrl ? (
        <div>
          <img
            src={imgUrl}
            alt="블록 이미지"
            style={{ maxWidth: 400, width: '100%', borderRadius: 8, marginBottom: 12 }}
          />
          <div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', background: 'var(--bg-hover)', borderRadius: 6,
              cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
            }}>
              🔄 이미지 교체
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      ) : (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: 24,
          border: '2px dashed var(--border-light)', borderRadius: 12,
          cursor: 'pointer', color: 'var(--text-muted)', minHeight: 100,
        }}>
          <span style={{ fontSize: 28, opacity: 0.5 }}>🖼️</span>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-ui)' }}>클릭하여 이미지 업로드</span>
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );
}

/* ═══ 선택지 블록 내용 ═══ */

function ChoicesBlockContent({
  rawText, onChange,
}: {
  rawText: string;
  onChange: (value: string) => void;
}) {
  const parseChoices = (text: string): string[] => {
    const lines = text.split('\n');
    const choices: string[] = ['', '', '', '', ''];
    lines.forEach((line, i) => {
      if (i < 5) {
        const match = line.match(/^[①②③④⑤]\s?(.*)/);
        choices[i] = match ? match[1] : line.replace(/^[①②③④⑤]\s?/, '');
      }
    });
    return choices;
  };

  const [choices, setChoices] = useState(() => parseChoices(rawText || DEFAULT_CHOICES));

  const handleChange = (index: number, value: string) => {
    const updated = [...choices];
    updated[index] = value;
    setChoices(updated);
    const text = updated.map((c, i) => `${CHOICES_LABELS[i]} ${c}`).join('\n');
    onChange(text);
  };

  return (
    <div style={{ padding: 12 }}>
      {CHOICES_LABELS.map((label, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
        }}>
          <span style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)',
            width: 24, textAlign: 'center', flexShrink: 0,
          }}>
            {label}
          </span>
          <input
            value={choices[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            placeholder="입력..."
            style={{
              flex: 1, border: '1px solid var(--border-light)', borderRadius: 6,
              padding: '6px 10px', fontSize: 14, fontFamily: 'var(--font-ui)',
              outline: 'none', color: 'var(--text-primary)',
              background: 'var(--bg-input, #fff)',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-light)'; }}
          />
        </div>
      ))}
    </div>
  );
}

/* ═══ 메인 EditorView ═══ */

export default function EditorView({ problemId, folders, onBack }: EditorViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // 메타 편집
  const [editTitle, setEditTitle] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDifficulty, setEditDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [editAnswer, setEditAnswer] = useState('');
  const [editFolderId, setEditFolderId] = useState<string>('');

  // 글꼴 크기
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);

  // 블록 상태
  const [questionBlocks, setQuestionBlocks] = useState<LocalBlock[]>([]);
  const [solutionBlocks, setSolutionBlocks] = useState<LocalBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // 원본 블록 ID 추적
  const [origQuestionIds, setOrigQuestionIds] = useState<string[]>([]);
  const [origSolutionIds, setOrigSolutionIds] = useState<string[]>([]);

  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});
  const previewRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  /* ─── 글꼴 크기 초기화 ─── */
  useEffect(() => {
    const size = getStoredFontSize();
    setContentFontSize(size);
    document.documentElement.style.setProperty('--content-font-size', size + 'px');
  }, []);

  const handleFontSizeChange = (delta: number) => {
    setContentFontSize((prev) => {
      const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, prev + delta));
      setStoredFontSize(next);
      return next;
    });
  };

  /* ─── 데이터 로드 ─── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      if (data) {
        setProblem(data);
        setEditTitle(data.title);
        setEditSource(data.source || data.exam_type || '');
        setEditCategory(data.category || '');
        setEditDifficulty(data.difficulty);
        setEditAnswer(data.answer || '');
        setEditFolderId(data.folder_id || '');

        const toLocal = (blocks: Block[]): LocalBlock[] =>
          blocks.map((b) => ({ ...b, collapsed: false, title: b.title || '' }));

        const qBlocks = toLocal(data.question_blocks);
        const sBlocks = toLocal(data.solution_blocks);
        setQuestionBlocks(qBlocks);
        setSolutionBlocks(sBlocks);
        setOrigQuestionIds(data.question_blocks.map((b) => b.id));
        setOrigSolutionIds(data.solution_blocks.map((b) => b.id));
        if (qBlocks.length > 0) setActiveBlockId(qBlocks[0].id);
      }
      setLoading(false);
    };
    load();
  }, [problemId]);

  /* ─── 현재 탭의 블록 ─── */
  const currentBlocks = activeTab === 'question' ? questionBlocks : solutionBlocks;
  const setCurrentBlocks = activeTab === 'question' ? setQuestionBlocks : setSolutionBlocks;

  /* ─── 블록 조작 핸들러 ─── */
  const handleBlockChange = useCallback((blockId: string, value: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, raw_text: value } : b))
    );
  }, [setCurrentBlocks]);

  const handleBlockTypeChange = useCallback((blockId: string, type: Block['type']) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        let raw_text = b.raw_text;
        if (type === 'choices' && b.type !== 'choices') {
          raw_text = DEFAULT_CHOICES;
        }
        if (type === 'image' && b.type !== 'image') {
          raw_text = '';
        }
        return { ...b, type, raw_text };
      })
    );
  }, [setCurrentBlocks]);

  const handleBlockTitleChange = useCallback((blockId: string, title: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, title } : b))
    );
  }, [setCurrentBlocks]);

  const handleToggleCollapse = useCallback((blockId: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, collapsed: !b.collapsed } : b))
    );
  }, [setCurrentBlocks]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setCurrentBlocks((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((b) => b.id !== blockId);
      if (activeBlockId === blockId) {
        setActiveBlockId(filtered[0]?.id || null);
      }
      return filtered;
    });
  }, [setCurrentBlocks, activeBlockId]);

  const handleAddBlock = useCallback(() => {
    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      order: 0,
      type: 'text',
      raw_text: '',
      title: '',
      collapsed: false,
      isNew: true,
    };
    setCurrentBlocks((prev) => {
      const activeIdx = activeBlockId ? prev.findIndex((b) => b.id === activeBlockId) : -1;
      const insertIdx = activeIdx !== -1 ? activeIdx + 1 : prev.length;
      const updated = [...prev];
      updated.splice(insertIdx, 0, newBlock);
      return updated;
    });
    setActiveBlockId(newBlock.id);
  }, [activeBlockId, setCurrentBlocks]);

  const handleSplitBlock = useCallback(() => {
    if (!activeBlockId) return;
    const ref = editorRefs.current[activeBlockId];
    if (!ref) return;

    const cursor = ref.getCursorPosition();
    const content = ref.getContent();

    const before = content.slice(0, cursor);
    const after = content.slice(cursor);

    const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
    if (!activeBlock) return;

    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      order: activeBlock.order + 1,
      type: activeBlock.type === 'text' || activeBlock.type === 'box' ? activeBlock.type : 'text',
      raw_text: after,
      title: '',
      collapsed: false,
      isNew: true,
    };

    setCurrentBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === activeBlockId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], raw_text: before };
      updated.splice(idx + 1, 0, newBlock);
      return updated;
    });

    setActiveBlockId(newBlock.id);
  }, [activeBlockId, currentBlocks, setCurrentBlocks]);

  /* ─── 이미지 업로드 ─── */
  const handleBlockImageUpload = useCallback(async (file: File, blockId: string) => {
    const pid = problemId || `temp-${Date.now()}`;
    const url = await uploadImage(file, pid);
    const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, raw_text: markdownImage } : b))
    );
  }, [problemId, setCurrentBlocks]);

  /* ─── DnD ─── */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCurrentBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, [setCurrentBlocks]);

  /* ─── MathToolbar ─── */
  const handleInsert = (template: string, cursorOffset: number) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]?.insertText(template, cursorOffset);
    }
  };

  const handleToolbarImageUpload = async (file: File) => {
    const pid = problemId || `temp-${Date.now()}`;
    const url = await uploadImage(file, pid);
    const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;
    handleInsert(markdownImage, markdownImage.length);
  };

  /* ─── 미리보기 스크롤 동기화 ─── */
  useEffect(() => {
    if (!activeBlockId || !previewRef.current) return;
    const container = previewRef.current;
    const el = container.querySelector(`[data-block-id="${activeBlockId}"]`) as HTMLElement;
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [activeBlockId]);

  /* ─── 탭 전환 시 activeBlockId 갱신 ─── */
  useEffect(() => {
    const blocks = activeTab === 'question' ? questionBlocks : solutionBlocks;
    if (blocks.length > 0 && !blocks.find((b) => b.id === activeBlockId)) {
      setActiveBlockId(blocks[0].id);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── 저장 ─── */
  const handleSave = async () => {
    if (!problem) return;
    setSaving(true);
    setStatus('');
    try {
      const updateData: Record<string, any> = {
        title: editTitle,
        source: editSource,
        exam_type: editSource,
        category: editCategory,
        subject: editCategory,
        difficulty: editDifficulty,
        answer: editAnswer,
        folder_id: editFolderId || null,
      };
      await updateProblem(problem.id, updateData);

      const curQIds = questionBlocks.map((b) => b.id);
      for (const oldId of origQuestionIds) {
        if (!curQIds.includes(oldId)) {
          await deleteBlock(problem.id, 'question_blocks', oldId);
        }
      }
      for (const oldId of origQuestionIds) {
        if (curQIds.includes(oldId)) {
          await deleteBlock(problem.id, 'question_blocks', oldId);
        }
      }
      for (let i = 0; i < questionBlocks.length; i++) {
        const b = questionBlocks[i];
        await saveQuestionBlock(problem.id, {
          order: i, type: b.type, raw_text: b.raw_text,
          title: b.title || '',
        });
      }

      const curSIds = solutionBlocks.map((b) => b.id);
      for (const oldId of origSolutionIds) {
        if (!curSIds.includes(oldId)) {
          await deleteBlock(problem.id, 'solution_blocks', oldId);
        }
      }
      for (const oldId of origSolutionIds) {
        if (curSIds.includes(oldId)) {
          await deleteBlock(problem.id, 'solution_blocks', oldId);
        }
      }
      for (let i = 0; i < solutionBlocks.length; i++) {
        const b = solutionBlocks[i];
        await saveSolutionBlock(problem.id, {
          order: i, type: b.type, raw_text: b.raw_text,
          title: b.title || '',
        });
      }

      const refreshed = await getProblemWithBlocks(problem.id);
      if (refreshed) {
        setProblem(refreshed);
        const toLocal = (blocks: Block[]): LocalBlock[] =>
          blocks.map((b, i) => ({
            ...b,
            collapsed: (activeTab === 'question' ? questionBlocks : solutionBlocks)
              .find((lb) => lb.order === i)?.collapsed ?? false,
            title: b.title || '',
          }));
        setQuestionBlocks(toLocal(refreshed.question_blocks));
        setSolutionBlocks(toLocal(refreshed.solution_blocks));
        setOrigQuestionIds(refreshed.question_blocks.map((b) => b.id));
        setOrigSolutionIds(refreshed.solution_blocks.map((b) => b.id));
      }

      setStatus('저장 완료');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  /* ─── 로딩 / 에러 ─── */
  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }

  const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
  const showToolbar = activeBlock && (activeBlock.type === 'text' || activeBlock.type === 'box');

  const metaInputStyle: React.CSSProperties = {
    border: '1px solid transparent', borderRadius: 6, padding: '3px 8px',
    fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
    background: 'transparent', outline: 'none', transition: 'border-color 0.15s, background 0.15s',
  };
  const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent-primary)';
    e.target.style.background = 'var(--bg-input)';
  };
  const blurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'transparent';
    e.target.style.background = 'transparent';
  };

  /* ─── 글꼴 크기 버튼 스타일 ─── */
  const fontBtnStyle: React.CSSProperties = {
    border: '1px solid var(--border-light, #ddd)',
    background: 'var(--bg-hover, #f5f5f5)',
    cursor: 'pointer',
    borderRadius: 4,
    width: 24, height: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)',
    }}>
      {/* CSS 오버라이드: EditorPreview의 inline fontSize를 동적으로 덮어씀 */}
      <style>{`
        .scaled-editor .cm-editor { font-size: ${contentFontSize}px !important; }
        .scaled-editor .cm-content { font-size: ${contentFontSize}px !important; }
        .scaled-preview > div > div > div { font-size: ${contentFontSize}px !important; }
      `}</style>

      {/* ═══ Row 1: 메타 정보 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button onClick={onBack} style={{
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4,
        }} title="뒤로">
          <IconChevronLeft />
        </button>

        <select value={editFolderId} onChange={(e) => setEditFolderId(e.target.value)} style={{
          ...metaInputStyle, fontSize: 12, color: 'var(--text-muted)',
          background: 'var(--bg-hover)', cursor: 'pointer',
        }}>
          <option value="">미분류</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
          placeholder="문제 제목" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, flex: 1, minWidth: 120, fontSize: 15, fontWeight: 600 }}
        />

        <input value={editSource} onChange={(e) => setEditSource(e.target.value)}
          placeholder="출처" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, width: 120, fontSize: 12 }}
        />

        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{
          ...metaInputStyle, fontSize: 12, cursor: 'pointer',
          background: 'var(--bg-hover)', minWidth: 160,
        }}>
          <option value="">대단원 선택</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        <select value={editDifficulty} onChange={(e) => setEditDifficulty(Number(e.target.value))} style={{
          ...metaInputStyle, fontSize: 12, cursor: 'pointer',
          background: 'var(--bg-hover)',
        }}>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <input value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)}
          placeholder="정답" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, width: 70, fontSize: 12 }}
        />

        {/* ─── 글꼴 크기 조절 ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginLeft: 4,
          borderLeft: '1px solid var(--border-light, #ddd)',
          paddingLeft: 8,
        }}>
          <button
            onClick={() => handleFontSizeChange(-FONT_SIZE_STEP)}
            disabled={contentFontSize <= FONT_SIZE_MIN}
            style={{
              ...fontBtnStyle,
              opacity: contentFontSize <= FONT_SIZE_MIN ? 0.3 : 1,
              cursor: contentFontSize <= FONT_SIZE_MIN ? 'not-allowed' : 'pointer',
            }}
            title="글꼴 축소"
          >
            A-
          </button>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
            minWidth: 28, textAlign: 'center',
          }}>
            {contentFontSize}
          </span>
          <button
            onClick={() => handleFontSizeChange(FONT_SIZE_STEP)}
            disabled={contentFontSize >= FONT_SIZE_MAX}
            style={{
              ...fontBtnStyle,
              opacity: contentFontSize >= FONT_SIZE_MAX ? 0.3 : 1,
              cursor: contentFontSize >= FONT_SIZE_MAX ? 'not-allowed' : 'pointer',
            }}
            title="글꼴 확대"
          >
            A+
          </button>
        </div>
      </div>

      {/* ═══ Row 2: Tabs + Save ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 20px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', flexShrink: 0,
      }}>
        {(['question', 'solution'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-ui)', transition: 'all var(--transition-fast)',
          }}>
            {tab === 'question' ? `문제 (${questionBlocks.length})` : `풀이 (${solutionBlocks.length})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {status && (
          <span style={{ fontSize: 12, marginRight: 12,
            color: status.includes('에러') ? 'var(--accent-danger)' : '#34a853',
          }}>{status}</span>
        )}
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
          background: saving ? 'var(--text-faint)' : 'var(--accent-primary)',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-ui)', transition: 'background var(--transition-fast)',
        }}>
          <IconSave /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* ═══ Row 3: Math Toolbar ═══ */}
      {showToolbar && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px',
          borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', flexShrink: 0,
        }}>
          <MathToolbar onInsert={handleInsert} />
          <div style={{ width: 1, height: 24, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
          <ImageUploadButton onUpload={handleToolbarImageUpload} />
        </div>
      )}

      {/* ═══ Row 4: Split View ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ─── Left: Editor ─── */}
        <div style={{
          flex: 1, borderRight: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>
            편집
          </div>

          <div className="scaled-editor" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', minHeight: 0 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {currentBlocks.map((block, i) => (
                  <SortableEditorBlock
                    key={block.id}
                    block={block}
                    index={i}
                    isActive={activeBlockId === block.id}
                    canDelete={currentBlocks.length > 1}
                    editorRefs={editorRefs}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChange={(val) => handleBlockChange(block.id, val)}
                    onTypeChange={(type) => handleBlockTypeChange(block.id, type)}
                    onTitleChange={(title) => handleBlockTitleChange(block.id, title)}
                    onDelete={() => handleDeleteBlock(block.id)}
                    onToggleCollapse={() => handleToggleCollapse(block.id)}
                    onImageUpload={handleBlockImageUpload}
                    problemId={problemId}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div style={{
            flexShrink: 0, display: 'flex',
            borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)',
          }}>
            <button onClick={handleAddBlock} style={{
              flex: 1, padding: '10px 0', border: 'none',
              background: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background var(--transition-fast)',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <IconPlus size={14} /> 블록 추가
            </button>

            <div style={{ width: 1, background: 'var(--border-light)' }} />

            <button onClick={handleSplitBlock} style={{
              flex: 1, padding: '10px 0', border: 'none',
              background: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: activeBlock && (activeBlock.type === 'text' || activeBlock.type === 'box') ? 1 : 0.4,
              pointerEvents: activeBlock && (activeBlock.type === 'text' || activeBlock.type === 'box') ? 'auto' : 'none',
              transition: 'background var(--transition-fast)',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <IconSplit size={14} /> 블록 분할
            </button>
          </div>
        </div>

        {/* ─── Right: Preview ─── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>
            미리보기
          </div>
          <div ref={previewRef} className="scaled-preview" style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-card)', minHeight: 0 }}>
            {currentBlocks.map((block, i) => (
              <div key={block.id} data-block-id={block.id}>
                {block.type === 'box' ? (
                  <div style={{
                    border: '1.5px solid var(--text-muted, #888)',
                    borderRadius: 8, padding: '12px 16px', margin: '8px 0',
                    background: 'var(--bg-input, #fafafa)',
                  }}>
                    <EditorPreview content={block.raw_text} borderless />
                  </div>
                ) : block.type === 'choices' ? (
                  <div style={{ padding: '8px 0' }}>
                    <EditorPreview content={block.raw_text.replace(/\n/g, '\n\n')} />
                  </div>
                ) : (
                  <div style={{ padding: '8px 0' }}>
                    <EditorPreview content={block.raw_text} />
                  </div>
                )}
                {i < currentBlocks.length - 1 && (
                  <div style={{ borderTop: '1px dashed var(--border-dashed, #ddd)', margin: '4px 0' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}