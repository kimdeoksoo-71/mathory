'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Problem, Block, ProblemWithBlocks, Folder, TabMeta, DEFAULT_TABS, tabSubcollection } from '../../types/problem';
import {
  getProblemWithBlocks, updateProblem,
  saveTabBlock, deleteBlock, deleteAllTabBlocks,
} from '../../lib/firestore';
import { DEFAULT_DIFFICULTY } from '../../lib/constants';
import MarkdownEditor, { MarkdownEditorHandle } from '../editor/MarkdownEditor';
import ChoicesBlock from '../editor/ChoicesBlock';
import EditorPreview from '../editor/EditorPreview';
import MathToolbar from '../editor/MathToolbar';
import FindReplacePanel from '../editor/FindReplacePanel';
import { uploadImage } from '../../lib/storage';
import '../print/PrintStyles.css';
import useSnippets from '../../hooks/useSnippets';
import {
  IconChevronLeft, IconSave, IconGrip, IconSplit, IconPlus,
  IconChevron, IconChevronDown, IconTrash,
  IconRename, IconSparkle, IconLoader,
  IconLineSplit,
} from '../ui/Icons';
import { splitDisplayMathAtCursor } from '../../lib/mathSplit';
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
  imageWidth?: number;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  heading: '제목',
  gana: '(가) (나) (다)',
  roman: 'ㄱ. ㄴ. ㄷ.',
  box: '글상자',
  choices: '선택지',
  image: '그림',
};

const BLOCK_TYPES: Block['type'][] = [
  'text', 'heading', 'gana', 'roman', 'box', 'choices', 'image',
];

/** 블록 생성 시 기본 내용 */
const BLOCK_PRESETS: Record<string, string> = {
  text: '',
  heading: '## ',
  gana: '(a) \n(b) \n(c) ',
  roman: '(i) \n(ii) \n(iii) ',
  box: '',
  choices: '',
  image: '',
};

/** 텍스트 기반 블록 (CodeMirror 에디터 사용) */
const TEXT_BASED_TYPES: Set<string> = new Set([
  'text', 'heading', 'gana', 'roman', 'box', 'choices',
]);

/** 블록 분할 허용 타입 (choices, image 제외) */
const SPLITTABLE_TYPES: Set<string> = new Set([
  'text', 'heading', 'gana', 'roman', 'box',
]);

/** 레거시 타입 → text 정규화 (DB 마이그레이션용) */
function normalizeBlockType(type: Block['type']): Block['type'] {
  if (type === 'math_block' || type === 'bullet') return 'text';
  return type;
}

/** 외곽 상자를 두르는 블록 타입 */
const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

const CHOICES_LABELS = ['①', '②', '③', '④', '⑤'];

const DEFAULT_CHOICES = CHOICES_LABELS.map((c) => `${c} `).join('\n');

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const FONT_SIZE_MIN = 11;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;

/* ═══ 수식 인덱싱: 원본 content에서 모든 수식의 {from, to} 추출 (출현 순서) ═══ */
interface MathRange { from: number; to: number; }

function buildMathIndex(content: string): MathRange[] {
  const ranges: MathRange[] = [];
  let i = 0;
  while (i < content.length) {
    // $$ 블록 수식
    if (content[i] === '$' && content[i + 1] === '$') {
      const start = i;
      const closeIdx = content.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    // $ 인라인 수식
    if (content[i] === '$' && content[i + 1] !== '$') {
      const start = i;
      let j = i + 1;
      let found = false;
      while (j < content.length) {
        if (content[j] === '$' && content[j - 1] !== '\\') {
          ranges.push({ from: start, to: j + 1 });
          i = j + 1;
          found = true;
          break;
        }
        if (content[j] === '\n' && j + 1 < content.length && content[j + 1] === '\n') break;
        j++;
      }
      if (!found) i = start + 1;
      continue;
    }
    // \[...\]
    if (content[i] === '\\' && content[i + 1] === '[') {
      const start = i;
      const closeIdx = content.indexOf('\\]', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    // \(...\)
    if (content[i] === '\\' && content[i + 1] === '(') {
      const start = i;
      const closeIdx = content.indexOf('\\)', i + 2);
      if (closeIdx !== -1) {
        ranges.push({ from: start, to: closeIdx + 2 });
        i = closeIdx + 2;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

function findMathIdAtCursor(ranges: MathRange[], cursor: number): number {
  for (let idx = 0; idx < ranges.length; idx++) {
    if (cursor >= ranges[idx].from && cursor <= ranges[idx].to) return idx;
  }
  return -1;
}

function getStoredFontSize(): number {
  if (typeof window === 'undefined') return FONT_SIZE_DEFAULT;
  const stored = localStorage.getItem(FONT_SIZE_KEY);
  if (!stored) return FONT_SIZE_DEFAULT;
  const n = parseInt(stored, 10);
  return isNaN(n) ? FONT_SIZE_DEFAULT : Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n));
}

function setStoredFontSize(size: number) {
  localStorage.setItem(FONT_SIZE_KEY, String(size));
  document.documentElement.style.setProperty('--content-font-size', size + 'px');
}

/* ═══ ImageBlockContent ═══ */

function ImageBlockContent({
  block,
  onImageUpload,
  onImageWidthChange,
  problemId,
}: {
  block: LocalBlock;
  onImageUpload: (file: File, blockId: string) => Promise<void>;
  onImageWidthChange: (blockId: string, width: number) => void;
  problemId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const imgWidth = block.imageWidth || 400;

  if (block.raw_text) {
    const srcMatch = block.raw_text.match(/src="([^"]+)"/);
    const src = srcMatch?.[1] || '';
    const maxW = 600; // 에디터 패널 내 최대 폭 기준
    return (
      <div ref={containerRef} style={{ padding: 8, textAlign: 'center' }}>
        <img src={src} alt="" style={{ width: Math.min(imgWidth, maxW), maxWidth: '90%', borderRadius: 8 }} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>크기</span>
          <input
            type="range"
            min={80}
            max={800}
            step={10}
            value={imgWidth}
            onChange={(e) => onImageWidthChange(block.id, Number(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 140, cursor: 'pointer' }}
          />
          <span>{imgWidth}px</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <label
            style={{
              display: 'inline-block', padding: '4px 12px',
              fontSize: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-light)',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            그림 변경
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError('');
                try {
                  await onImageUpload(file, block.id);
                } catch (err: any) {
                  setError(`업로드 실패: ${err.message || err}`);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 4 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{
      padding: 24, textAlign: 'center',
      border: '2px dashed var(--border-light)', borderRadius: 8, margin: 8,
    }}>
      {uploading ? (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>업로드 중...</span>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            이미지를 선택하세요
          </div>
          <label
            style={{
              display: 'inline-block', padding: '6px 16px',
              fontSize: 13, background: 'var(--accent-primary)', color: '#fff',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            파일 선택
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError('');
                try {
                  await onImageUpload(file, block.id);
                } catch (err: any) {
                  setError(`업로드 실패: ${err.message || err}`);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        </>
      )}
    </div>
  );
}

/* ═══ ChoicesPreview: 선택지 1열/2열 자동 레이아웃 ═══ */

function ChoicesPreview({
  rawText,
  locale,
  activeMathId,
  onClickMath,
}: {
  rawText: string;
  locale?: string;
  activeMathId?: number;
  onClickMath?: (mathId: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [twoRows, setTwoRows] = useState(false);

  // 선택지 파싱: ①~⑤ 라벨 기준
  const choices = useMemo(() => {
    const lines = rawText.split('\n');
    return CHOICES_LABELS.map((label, idx) => {
      const line = lines[idx] || '';
      const content = line.replace(/^[①②③④⑤]\s*/, '').trim();
      return { label, content };
    });
  }, [rawText]);

  // rawText 변경 시 초기화 → 5열 그리드로 먼저 렌더
  useEffect(() => {
    setTwoRows(false);
  }, [rawText]);

  // 높이 기반 overflow 감지: 5열 그리드의 높이가 단일행(~45px)을 초과하면 2행 전환
  useEffect(() => {
    if (twoRows) return;
    const el = gridRef.current;
    if (!el) return;
    let cancelled = false;
    const checkHeight = () => {
      if (cancelled || !el) return;
      if (el.scrollHeight > 45) {
        setTwoRows(true);
      }
    };
    checkHeight();
    const t1 = setTimeout(checkHeight, 250);
    const t2 = setTimeout(checkHeight, 700);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [rawText, twoRows]);

  /** 개별 선택지 아이템 렌더 */
  const ChoiceItem = ({ label, content }: { label: string; content: string }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6em' }}>
      <span style={{ flexShrink: 0 }}>{label}</span>
      <EditorPreview content={content} borderless locale={locale} />
    </div>
  );

  if (twoRows) {
    // 2행: 1행 ①②③ (3등분), 2행 ④⑤ (3등분), 행간 넓게
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 8px',
        }}>
          {choices.slice(0, 3).map((c, i) => (
            <ChoiceItem key={i} label={c.label} content={c.content} />
          ))}
        </div>
        <div style={{ height: 12 }} />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 8px',
        }}>
          {choices.slice(3, 5).map((c, i) => (
            <ChoiceItem key={i + 3} label={c.label} content={c.content} />
          ))}
        </div>
      </div>
    );
  }

  // 1열: 5등분 균등 배치
  return (
    <div style={{ padding: '8px 0' }}>
      <div ref={gridRef} style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0 8px',
      }}>
        {choices.map((c, i) => (
          <ChoiceItem key={i} label={c.label} content={c.content} />
        ))}
      </div>
    </div>
  );
}

/* ═══ SortableEditorBlock ═══ */

function SortableEditorBlock({
  block,
  index,
  isActive,
  canDelete,
  editorRefs,
  onFocus,
  onChange,
  onTypeChange,
  onTitleChange,
  onDelete,
  onToggleCollapse,
  onImageUpload,
  onImageWidthChange,
  problemId,
  onSnippetShortcut,
  onCursorActivity,
  onAIComplete,
  aiLoading,
  onSplitMathLines,
}: {
  block: LocalBlock;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  editorRefs: React.MutableRefObject<Record<string, MarkdownEditorHandle | null>>;
  onFocus: () => void;
  onChange: (val: string) => void;
  onTypeChange: (type: Block['type']) => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onImageUpload: (file: File, blockId: string) => Promise<void>;
  onImageWidthChange: (blockId: string, width: number) => void;
  problemId: string;
  onSnippetShortcut: (index: number) => void;
  onCursorActivity?: (info: { line: number; offset: number }) => void;
  onAIComplete?: () => void;
  aiLoading?: boolean;
  onSplitMathLines?: () => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 6,
    border: isActive
      ? '1.5px solid var(--accent-primary)'
      : '1px solid var(--border-light)',
    borderRadius: 10,
    background: 'var(--bg-card)',
    overflow: 'hidden',
  };

  const isTextBased = TEXT_BASED_TYPES.has(block.type);

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-editor-block-id={block.id}>
      {/* ── Block Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', background: 'var(--bg-secondary)',
          cursor: 'grab', fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)', userSelect: 'none',
        }}
        {...listeners}
      >
        <IconGrip size={12} />

        <button onClick={onToggleCollapse} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 2,
          display: 'flex', color: 'var(--text-muted)',
        }}>
          {block.collapsed ? <IconChevron size={12} /> : <IconChevronDown size={12} />}
        </button>

        <select
          value={block.type}
          onChange={(e) => onTypeChange(e.target.value as Block['type'])}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            border: 'none', background: 'none', fontSize: 11,
            color: 'var(--text-muted)', cursor: 'pointer', outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {isTextBased && (
          <button
            onClick={(e) => { e.stopPropagation(); onSplitMathLines?.(); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              padding: 2, display: 'flex', color: 'var(--text-faint)',
            }}
            title="수식행 분할 (⌘⇧L) — 커서가 위치한 $$...$$ 의 \\ 행을 각각 독립행 수식으로 분리"
          >
            <IconLineSplit size={12} />
          </button>
        )}

        {isTextBased && (
          <button
            onClick={(e) => { e.stopPropagation(); onAIComplete?.(); }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={aiLoading}
            style={{
              border: 'none', background: 'none',
              cursor: aiLoading ? 'wait' : 'pointer',
              padding: 2, display: 'flex',
              color: aiLoading ? 'var(--accent-primary)' : 'var(--text-faint)',
            }}
            title="AI 완성 (⌘J)"
          >
            {aiLoading ? <IconLoader size={12} /> : <IconSparkle size={12} />}
          </button>
        )}

        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              padding: 2, display: 'flex', color: 'var(--text-faint)',
            }}
            title="블록 삭제"
          >
            <IconTrash size={12} />
          </button>
        )}
      </div>

      {/* ── Block Content ── */}
      {!block.collapsed && (
        <div style={{ padding: block.type === 'image' ? 0 : '0' }} onClick={onFocus}>
          {block.type === 'image' ? (
            <ImageBlockContent
              block={block}
              onImageUpload={onImageUpload}
              onImageWidthChange={onImageWidthChange}
              problemId={problemId}
            />
          ) : (
            <MarkdownEditor
              ref={(el) => { editorRefs.current[block.id] = el; }}
              initialValue={block.raw_text}
              onChange={onChange}
              onSnippetShortcut={onSnippetShortcut}
              onCursorActivity={onCursorActivity}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ EditorViewProps ═══ */

interface EditorViewProps {
  problemId: string;
  folders: Folder[];
  onBack: () => void;
}

/* ═══ 메인 EditorView ═══ */

export default function EditorView({ problemId, folders, onBack }: EditorViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);

  // ── 동적 탭 ──
  const [tabs, setTabs] = useState<TabMeta[]>(DEFAULT_TABS);
  const [activeTab, setActiveTab] = useState('question');
  const [allBlocks, setAllBlocks] = useState<Record<string, LocalBlock[]>>({});
  const [origBlockIds, setOrigBlockIds] = useState<Record<string, string[]>>({});
  const [origTabs, setOrigTabs] = useState<TabMeta[]>(DEFAULT_TABS);

  // 탭 이름 편집
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');
  const tabLabelInputRef = useRef<HTMLInputElement>(null);

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

  // 활성 블록
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  // 찾기/바꾸기 패널
  const [searchOpen, setSearchOpen] = useState(false);

  // 블록 추가 드롭다운
  const [addBlockDropdownOpen, setAddBlockDropdownOpen] = useState(false);
  const addBlockDropdownRef = useRef<HTMLDivElement>(null);

  // 미리보기 활성 수식 인덱스
  const [activeMathId, setActiveMathId] = useState<number>(-1);

  const [aiLoadingBlockId, setAiLoadingBlockId] = useState<string | null>(null);

  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});
  const previewRef = useRef<HTMLDivElement>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // ── 수식 상용구 ──
  const { snippets, addSnippet, editSnippet, removeSnippet, getByShortcut } = useSnippets();

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

        const loadedTabs = data.tabs || DEFAULT_TABS;
        setTabs(loadedTabs);
        setOrigTabs(loadedTabs);

        const toLocal = (blocks: Block[]): LocalBlock[] =>
          blocks.map((b) => ({ ...b, type: normalizeBlockType(b.type), collapsed: false, title: b.title || '' }));

        const blocksMap: Record<string, LocalBlock[]> = {};
        const origIds: Record<string, string[]> = {};
        for (const tab of loadedTabs) {
          const blocks = data.tabBlocks[tab.id] || [];
          blocksMap[tab.id] = toLocal(blocks);
          origIds[tab.id] = blocks.map((b) => b.id);
        }
        setAllBlocks(blocksMap);
        setOrigBlockIds(origIds);

        // 첫 블록 활성화
        const firstTabBlocks = blocksMap[loadedTabs[0].id] || [];
        if (firstTabBlocks.length > 0) setActiveBlockId(firstTabBlocks[0].id);
      }
      setLoading(false);
    };
    load();
  }, [problemId]);

  /* ─── 현재 탭의 블록 ─── */
  const currentBlocks = allBlocks[activeTab] || [];
  const setCurrentBlocks = useCallback((updater: LocalBlock[] | ((prev: LocalBlock[]) => LocalBlock[])) => {
    setAllBlocks((prev) => ({
      ...prev,
      [activeTab]: typeof updater === 'function' ? updater(prev[activeTab] || []) : updater,
    }));
  }, [activeTab]);

  /* ─── AI 자동완성 ─── */
  const collectAIContext = useCallback((blockId: string) => {
    const questionBlocks = allBlocks['question'] || [];
    const questionContext = questionBlocks.map((b) => b.raw_text).filter(Boolean).join('\n');

    const blocks = allBlocks[activeTab] || [];
    const activeIdx = blocks.findIndex((b) => b.id === blockId);
    const previousBlocks = activeIdx > 0
      ? blocks.slice(0, activeIdx).map((b) => b.raw_text).filter(Boolean)
      : [];

    const ref = editorRefs.current[blockId];
    const fullText = ref?.getContent() || '';
    const cursorPos = ref?.getCursorPosition() ?? fullText.length;
    const currentText = fullText.slice(0, cursorPos);

    return { questionContext, previousBlocks, currentText };
  }, [allBlocks, activeTab]);

  const handleAIComplete = useCallback(async (blockId?: string) => {
    const targetId = blockId || activeBlockId;
    if (!targetId || aiLoadingBlockId) return;

    const { questionContext, previousBlocks, currentText } = collectAIContext(targetId);
    if (!currentText.trim()) return;

    setAiLoadingBlockId(targetId);
    try {
      const res = await fetch('/api/ai-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionContext, previousBlocks, currentText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { completion } = await res.json();
      if (completion) {
        const editor = editorRefs.current[targetId];
        if (editor) {
          editor.insertText(completion, completion.length);
        }
      }
    } catch (e: any) {
      console.error('[AI Complete] Error:', e);
      setStatus(`AI 오류: ${e.message}`);
    } finally {
      setAiLoadingBlockId(null);
    }
  }, [activeBlockId, aiLoadingBlockId, collectAIContext]);

  /* ─── 수식행 분할 ($$..$$ 를 \\ 단위로 분리) ─── */
  const handleSplitMathLines = useCallback((blockId?: string) => {
    const targetId = blockId || activeBlockId;
    if (!targetId) return;
    const editor = editorRefs.current[targetId];
    if (!editor) return;

    const content = editor.getContent();
    const cursor = editor.getCursorPosition();
    const result = splitDisplayMathAtCursor(content, cursor);
    if (result.ok !== true) {
      setStatus(result.reason);
      return;
    }
    editor.setContent(result.newContent);
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === targetId ? { ...b, raw_text: result.newContent } : b))
    );
  }, [activeBlockId, setCurrentBlocks]);

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
          // 선택지 자동 분류: (1)~(5) 패턴 감지
          const choicesMatch = raw_text.match(/\(1\)\s*([\s\S]*)/);
          if (choicesMatch) {
            const fromFirstChoice = choicesMatch[0];
            const lines = fromFirstChoice.split('\n');
            const extracted: string[] = [];
            for (const line of lines) {
              const m = line.match(/^\((\d)\)\s*(.*)/);
              if (m && Number(m[1]) >= 1 && Number(m[1]) <= 5) {
                extracted[Number(m[1]) - 1] = m[2].trim();
              }
            }
            if (extracted.filter(Boolean).length >= 2) {
              raw_text = CHOICES_LABELS.map((label, i) => `${label} ${extracted[i] || ''}`).join('\n');
            } else {
              raw_text = DEFAULT_CHOICES;
            }
          } else {
            raw_text = DEFAULT_CHOICES;
          }
        } else if (type === 'image' && b.type !== 'image') {
          raw_text = '';
        } else if (type !== b.type && BLOCK_PRESETS[type] !== undefined && !TEXT_BASED_TYPES.has(b.type)) {
          // 이미지→텍스트 계열 전환 시 프리셋 적용
          raw_text = BLOCK_PRESETS[type];
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

  const handleAddBlock = useCallback((type: Block['type'] = 'text') => {
    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      order: 0,
      type,
      raw_text: BLOCK_PRESETS[type] ?? '',
      title: '',
      collapsed: false,
      isNew: true,
    };
    if (type === 'choices') {
      newBlock.raw_text = DEFAULT_CHOICES;
    }
    setCurrentBlocks((prev) => {
      const activeIdx = activeBlockId ? prev.findIndex((b) => b.id === activeBlockId) : -1;
      const insertIdx = activeIdx !== -1 ? activeIdx + 1 : prev.length;
      const updated = [...prev];
      updated.splice(insertIdx, 0, newBlock);
      return updated;
    });
    setActiveBlockId(newBlock.id);
  }, [activeBlockId, setCurrentBlocks]);

  /** 이미지 크기 변경 */
  const handleImageWidthChange = useCallback((blockId: string, width: number) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, imageWidth: width } : b))
    );
  }, [setCurrentBlocks]);

  const handleSplitBlock = useCallback(() => {
    if (!activeBlockId) return;
    const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
    if (!activeBlock || !SPLITTABLE_TYPES.has(activeBlock.type)) return;

    const ref = editorRefs.current[activeBlockId];
    if (!ref) return;

    const cursor = ref.getCursorPosition();
    const content = ref.getContent();

    const before = content.slice(0, cursor);
    const after = content.slice(cursor);

    // 원본 블록의 CodeMirror 내용을 즉시 갱신 (before만 남김)
    ref.setContent(before);

    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      order: activeBlock.order + 1,
      type: 'text',
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
    setTimeout(() => {
      editorRefs.current[newBlock.id]?.focus();
    }, 50);
  }, [activeBlockId, currentBlocks, setCurrentBlocks]);

  /* ─── 이미지 업로드 ─── */
  const handleBlockImageUpload = useCallback(async (file: File, blockId: string) => {
    const pid = problemId || `temp-${Date.now()}`;
    try {
      const url = await uploadImage(file, pid);
      const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;
      setCurrentBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, raw_text: markdownImage } : b))
      );
    } catch (err: any) {
      console.error('[ImageUpload] 에러:', err);
      throw err;
    }
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

  /* ─── 수식 상용구 ─── */
  const handleSnippetInsert = (content: string) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]?.insertText(content, content.length);
    }
  };

  const handleSnippetShortcut = (index: number) => {
    const snippet = getByShortcut(index);
    if (snippet) {
      handleSnippetInsert(snippet.content);
    }
  };

  /* ─── 커서 활동 → 수식 하이라이트 ─── */
  const handleCursorActivity = useCallback((info: { line: number; offset: number; docChanged: boolean }) => {
    if (!activeBlockId) return;
    const ref = editorRefs.current[activeBlockId];
    if (!ref) return;
    const content = ref.getContent();
    const ranges = buildMathIndex(content);
    const mathId = findMathIdAtCursor(ranges, info.offset);
    setActiveMathId(mathId);
  }, [activeBlockId]);

  /* ─── 미리보기 수식 클릭 → 편집창 선택 ─── */
  const handlePreviewMathClick = useCallback((blockId: string, mathId: number) => {
    // 블록 펼침 + 활성화
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, collapsed: false } : b))
    );
    setActiveBlockId(blockId);

    // 다른 모든 블록의 선택 해제
    for (const [id, ref] of Object.entries(editorRefs.current)) {
      if (id !== blockId && ref) ref.clearSelection();
    }

    setTimeout(() => {
      const ref = editorRefs.current[blockId];
      if (!ref) return;
      const content = ref.getContent();
      const ranges = buildMathIndex(content);
      if (mathId < 0 || mathId >= ranges.length) return;

      const range = ranges[mathId];
      ref.setSelection(range.from, range.to);
      ref.focus();

      // 편집 패널에서 선택된 수식을 세로 중앙으로 스크롤
      requestAnimationFrame(() => {
        const coords = ref.getCursorCoords();
        const container = editorPanelRef.current;
        if (coords && container) {
          const containerRect = container.getBoundingClientRect();
          const cursorRelativeTop = coords.top - containerRect.top + container.scrollTop;
          const center = cursorRelativeTop - containerRect.height / 2;
          container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
        }
      });
    }, 100);
  }, [setCurrentBlocks]);

  /* ─── 블록 활성화 시 편집창에서 해당 블록을 세로 중앙으로 자동 스크롤 ─── */
  useEffect(() => {
    if (!activeBlockId) return;
    const timer = setTimeout(() => {
      const container = editorPanelRef.current;
      if (!container) return;
      const blockEl = container.querySelector(`[data-editor-block-id="${activeBlockId}"]`);
      if (!blockEl) return;
      const containerRect = container.getBoundingClientRect();
      const blockRect = (blockEl as HTMLElement).getBoundingClientRect();
      const blockCenter = blockRect.top + blockRect.height / 2 - containerRect.top + container.scrollTop;
      const target = blockCenter - containerRect.height / 2;
      container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeBlockId]);

  /* ─── 미리보기 하이라이트 cleanup + 편집창 선택 해제 (블록 전환 시) ─── */
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.querySelectorAll('.math-highlight-active').forEach((el) => {
      el.classList.remove('math-highlight-active');
    });
    for (const [id, ref] of Object.entries(editorRefs.current)) {
      if (id !== activeBlockId && ref) ref.clearSelection();
    }
  }, [activeBlockId]);

  /* ─── 미리보기 스크롤 동기화 ─── */
  useEffect(() => {
    if (activeMathId < 0 || !previewRef.current) return;
    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        const container = previewRef.current;
        if (!container) return;
        const highlighted = container.querySelector('.math-highlight-active') as HTMLElement;
        if (!highlighted) return;
        const containerRect = container.getBoundingClientRect();
        const highlightedRect = highlighted.getBoundingClientRect();
        const offset = highlightedRect.top - containerRect.top + container.scrollTop;
        const center = offset - containerRect.height / 2 + highlightedRect.height / 2;
        container.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [activeMathId, activeBlockId]);

  /* ─── 탭 전환 시 activeBlockId 갱신 ─── */
  useEffect(() => {
    const blocks = allBlocks[activeTab] || [];
    if (blocks.length > 0 && !blocks.find((b) => b.id === activeBlockId)) {
      setActiveBlockId(blocks[0].id);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ctrl+F 찾기/바꾸기 · Cmd+B 블록 분할 · Cmd+J AI 완성 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleSplitBlock();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        handleAIComplete();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        handleSplitMathLines();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSplitBlock, handleAIComplete, handleSplitMathLines]);

  // 블록 추가 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!addBlockDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (addBlockDropdownRef.current && !addBlockDropdownRef.current.contains(e.target as Node)) {
        setAddBlockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [addBlockDropdownOpen]);

  /* ═══ 탭 추가 ═══ */
  const handleAddTab = () => {
    // 다음 "풀이N" 번호 계산
    let maxSolNum = 1;
    for (const tab of tabs) {
      const match = tab.label.match(/^풀이(\d*)$/);
      if (match) {
        const num = match[1] ? parseInt(match[1]) : 1;
        maxSolNum = Math.max(maxSolNum, num);
      }
    }
    const newLabel = `풀이${maxSolNum + 1}`;

    // 다음 extra ID 계산
    const extraTabs = tabs.filter((t) => t.id.startsWith('extra_'));
    const maxExtraNum = extraTabs.reduce((max, t) => {
      const num = parseInt(t.id.split('_')[1]);
      return isNaN(num) ? max : Math.max(max, num);
    }, -1);
    const newId = `extra_${maxExtraNum + 1}`;

    const newTab: TabMeta = { id: newId, label: newLabel };
    setTabs((prev) => [...prev, newTab]);
    setAllBlocks((prev) => ({
      ...prev,
      [newId]: [{
        id: `new-${Date.now()}`,
        order: 0,
        type: 'text',
        raw_text: '',
        title: '',
        collapsed: false,
        isNew: true,
      }],
    }));
    setActiveTab(newId);
  };

  /* ═══ 탭 삭제 (3번째 이후만) ═══ */
  const handleDeleteTab = (tabId: string) => {
    const tabIdx = tabs.findIndex((t) => t.id === tabId);
    if (tabIdx < 2) return; // 문제/풀이 탭은 삭제 불가

    const tabLabel = tabs[tabIdx].label;
    if (!confirm(`'${tabLabel}' 탭을 삭제하시겠습니까? 탭 안의 모든 블록이 삭제됩니다.`)) return;

    setTabs((prev) => prev.filter((t) => t.id !== tabId));
    setAllBlocks((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });

    // 삭제된 탭이 활성 탭이면 이전 탭으로 이동
    if (activeTab === tabId) {
      setActiveTab(tabs[tabIdx - 1]?.id || 'question');
    }
  };

  /* ═══ 탭 이름 편집 (3번째 이후만) ═══ */
  const startEditTabLabel = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    setEditingTabId(tabId);
    setEditingTabLabel(tab.label);
    setTimeout(() => tabLabelInputRef.current?.focus(), 50);
  };

  const commitTabLabel = () => {
    if (editingTabId && editingTabLabel.trim()) {
      setTabs((prev) =>
        prev.map((t) => (t.id === editingTabId ? { ...t, label: editingTabLabel.trim() } : t))
      );
    }
    setEditingTabId(null);
  };

  /* ═══ 저장 ═══ */
  const savingRef = useRef(false);
  const handleSave = useCallback(async (silent = false) => {
    if (!problem) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    if (!silent) setStatus('');
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
        tabs,
      };
      await updateProblem(problem.id, updateData);

      // 삭제된 탭의 블록 정리
      for (const origTab of origTabs) {
        if (!tabs.find((t) => t.id === origTab.id)) {
          await deleteAllTabBlocks(problem.id, origTab.id);
        }
      }

      // 각 탭의 블록 저장 (delete all → re-add)
      for (const tab of tabs) {
        const subcol = tabSubcollection(tab.id);
        const origIds = origBlockIds[tab.id] || [];
        const blocks = allBlocks[tab.id] || [];

        // 기존 블록 전부 삭제
        for (const oldId of origIds) {
          try {
            await deleteBlock(problem.id, subcol, oldId);
          } catch (e) {
            // 이미 삭제된 블록은 무시
          }
        }

        // 새로 저장 (빈줄 trim 적용)
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          // 위아래 빈 줄 제거
          const trimmed = b.raw_text
            .replace(/^\s*\n/, '')   // 첫 비어있지 않은 행 위의 빈 행 제거
            .replace(/\n\s*$/, '');  // 마지막 비어있지 않은 행 아래의 빈 행 제거
          const saveData: Record<string, any> = {
            order: i, type: b.type, raw_text: trimmed,
            title: b.title || '',
          };
          if (b.type === 'image' && b.imageWidth) {
            saveData.imageWidth = b.imageWidth;
          }
          await saveTabBlock(problem.id, tab.id, saveData as any);
        }
      }

      // 저장 후 리프레시
      const refreshed = await getProblemWithBlocks(problem.id);
      if (refreshed) {
        setProblem(refreshed);
        const loadedTabs = refreshed.tabs || DEFAULT_TABS;
        setTabs(loadedTabs);
        setOrigTabs(loadedTabs);

        const toLocal = (blocks: Block[]): LocalBlock[] =>
          blocks.map((b, i) => ({
            ...b,
            type: normalizeBlockType(b.type),
            collapsed: (allBlocks[activeTab] || [])
              .find((lb) => lb.order === i)?.collapsed ?? false,
            title: b.title || '',
          }));

        const blocksMap: Record<string, LocalBlock[]> = {};
        const newOrigIds: Record<string, string[]> = {};
        for (const tab of loadedTabs) {
          blocksMap[tab.id] = toLocal(refreshed.tabBlocks[tab.id] || []);
          newOrigIds[tab.id] = (refreshed.tabBlocks[tab.id] || []).map((b) => b.id);
        }
        setAllBlocks(blocksMap);
        setOrigBlockIds(newOrigIds);
      }

      if (!silent) {
        setStatus('저장 완료');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [problem, tabs, origTabs, origBlockIds, allBlocks, activeTab, editTitle, editSource, editCategory, editDifficulty, editAnswer, editFolderId]);

  /* ─── 자동저장: 탭 전환 시 ─── */
  const switchTab = useCallback((nextTabId: string) => {
    if (nextTabId === activeTab) return;
    handleSave(true);
    setActiveTab(nextTabId);
  }, [activeTab, handleSave]);

  /* ─── 자동저장: EditorView 이탈(onBack) / unmount ─── */
  const handleBackWithSave = useCallback(() => {
    handleSave(true);
    onBack();
  }, [handleSave, onBack]);

  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);
  useEffect(() => {
    return () => { handleSaveRef.current(true); };
  }, []);

  /* ─── 로딩 / 에러 ─── */
  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }

  const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
  const showToolbar = activeBlock && TEXT_BASED_TYPES.has(activeBlock.type);

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
      {/* CSS 오버라이드 */}
      <style>{`
        .scaled-editor .cm-editor { font-size: ${contentFontSize}px !important; }
        .scaled-editor .cm-content { font-size: ${contentFontSize}px !important; }
        .scaled-preview > div > div > div { font-size: ${contentFontSize}px !important; }
        .math-highlight-active {
          background-color: rgba(229, 57, 53, 0.08) !important;
          box-shadow: 0 0 0 2px rgba(229, 57, 53, 0.4);
          border-radius: 3px;
        }
      `}</style>

      {/* ═══ Row 1: 메타 정보 ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button onClick={handleBackWithSave} style={{
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

        {status && (
          <span style={{ fontSize: 12, marginRight: 4,
            color: status.includes('에러') || status.includes('오류') ? 'var(--accent-danger)' : '#34a853',
          }}>{status}</span>
        )}

        {/* 저장 버튼 */}
        <button onClick={() => handleSave()} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
          background: saving ? 'var(--text-faint)' : 'var(--accent-primary)',
          color: '#fff', border: 'none', borderRadius: 8,
          cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
          fontFamily: 'var(--font-ui)', transition: 'background var(--transition-fast)',
        }}>
          <IconSave /> {saving ? '저장 중...' : '저장'}
        </button>

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

      {/* ═══ Row 2: Toolbar (좌) + Tabs (우) ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', flexShrink: 0,
        gap: 4,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          opacity: showToolbar ? 1 : 0.35,
          pointerEvents: showToolbar ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}>
          <MathToolbar
            onInsert={handleInsert}
            snippets={snippets}
            onSnippetInsert={handleSnippetInsert}
            onSnippetAdd={addSnippet}
            onSnippetEdit={editSnippet}
            onSnippetDelete={removeSnippet}
          />
        </div>
        <div style={{ width: 1, height: 24, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          title="찾기 / 바꾸기 (Ctrl+F)"
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: searchOpen ? '1px solid var(--accent-primary)' : '1px solid transparent',
            borderRadius: 6,
            background: searchOpen ? 'rgba(66, 133, 244, 0.08)' : 'transparent',
            cursor: 'pointer',
            color: searchOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: 16,
            transition: 'all 0.15s',
          }}
        >
          🔍
        </button>

        <div style={{ flex: 1 }} />

        {tabs.map((tab, tabIdx) => (
          <div key={tab.id} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
            transition: 'all var(--transition-fast)',
            position: 'relative',
          }}>
            {/* 탭 이름 편집 모드 */}
            {editingTabId === tab.id ? (
              <input
                ref={tabLabelInputRef}
                value={editingTabLabel}
                onChange={(e) => setEditingTabLabel(e.target.value)}
                onBlur={commitTabLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTabLabel();
                  if (e.key === 'Escape') setEditingTabId(null);
                }}
                style={{
                  padding: '10px 6px 10px 12px', border: '1px solid var(--accent-primary)',
                  background: 'var(--bg-input)', borderRadius: 4,
                  fontSize: 13.5, fontWeight: 600, outline: 'none',
                  fontFamily: 'var(--font-ui)', width: 80,
                  color: 'var(--text-primary)',
                }}
              />
            ) : (
              <button
                onClick={() => switchTab(tab.id)}
                style={{
                  padding: '10px 6px 10px 12px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)', transition: 'all var(--transition-fast)',
                }}
              >
                {`${tab.label} (${(allBlocks[tab.id] || []).length})`}
              </button>
            )}

            {/* 탭 이름 변경 (3번째 이후만) */}
            {tabIdx >= 2 && editingTabId !== tab.id && (
              <button
                onClick={(e) => { e.stopPropagation(); startEditTabLabel(tab.id); }}
                title="탭 이름 변경"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, border: 'none', background: 'none',
                  cursor: 'pointer', borderRadius: 4, padding: 0,
                  color: 'var(--text-faint)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                <IconRename size={11} />
              </button>
            )}

            {/* 탭 삭제 (3번째 이후만) */}
            {tabIdx >= 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}
                title="탭 삭제"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, border: 'none', background: 'none',
                  cursor: 'pointer', borderRadius: 4, padding: 0,
                  color: 'var(--text-faint)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; }}
              >
                <IconTrash size={11} />
              </button>
            )}
          </div>
        ))}

        {/* 탭 추가 버튼 */}
        <button
          onClick={handleAddTab}
          title="탭 추가"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, border: 'none', background: 'none',
            cursor: 'pointer', borderRadius: 6, padding: 0,
            color: 'var(--text-faint)', marginLeft: 4,
            transition: 'color 0.2s, background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-faint)'; e.currentTarget.style.background = 'none'; }}
        >
          <IconPlus size={14} />
        </button>
      </div>

      {/* ═══ Row 3: Split View (편집창 최소폭 미달 시 가로 스크롤) ═══ */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minHeight: 0 }}>

        {/* ─── Left: Editor ─── */}
        <div style={{
          flex: 1, minWidth: 420, borderRight: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}>
            편집
            <div style={{ flex: 1 }} />
            {/* ── 블록 추가 드롭다운 ── */}
            <div ref={addBlockDropdownRef} style={{ position: 'relative' }}>
              <span
                onClick={() => setAddBlockDropdownOpen((v) => !v)}
                style={{
                  cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)',
                  fontWeight: 600, letterSpacing: 0.5, userSelect: 'none',
                }}
              >
                + 블록 추가
              </span>
              {addBlockDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 100,
                  marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  minWidth: 140, overflow: 'hidden',
                }}>
                  {BLOCK_TYPES.map((t) => (
                    <div
                      key={t}
                      onClick={() => {
                        handleAddBlock(t);
                        setAddBlockDropdownOpen(false);
                      }}
                      style={{
                        padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      {BLOCK_TYPE_LABELS[t]}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span style={{ margin: '0 10px', color: 'var(--border-light)' }}>|</span>
            {/* ── 블록 분할 ── */}
            <span
              onClick={activeBlock && SPLITTABLE_TYPES.has(activeBlock.type) ? handleSplitBlock : undefined}
              style={{
                cursor: activeBlock && SPLITTABLE_TYPES.has(activeBlock.type) ? 'pointer' : 'default',
                fontSize: 11, color: 'var(--text-muted)',
                fontWeight: 600, letterSpacing: 0.5, userSelect: 'none',
                opacity: activeBlock && SPLITTABLE_TYPES.has(activeBlock.type) ? 1 : 0.35,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}
            >
              <IconSplit size={12} /> 블록 분할
            </span>
          </div>

          {/* ── 찾기/바꾸기 패널 ── */}
          <FindReplacePanel
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            editorRefs={editorRefs}
            blockIds={currentBlocks.map((b) => b.id)}
          />

          <div ref={editorPanelRef} className="scaled-editor" style={{ flex: 1, overflowY: 'auto', padding: '8px 16px', paddingBottom: '50vh', minHeight: 0 }}>
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
                    onImageWidthChange={handleImageWidthChange}
                    problemId={problemId}
                    onSnippetShortcut={handleSnippetShortcut}
                    onCursorActivity={handleCursorActivity}
                    onAIComplete={() => handleAIComplete(block.id)}
                    aiLoading={aiLoadingBlockId === block.id}
                    onSplitMathLines={() => handleSplitMathLines(block.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

        {/* ─── Right: Preview (고정 폭 30em + 좌우 패딩 64px) ─── */}
        <div style={{
          width: `calc(30em + 128px)`, flexShrink: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
          fontSize: contentFontSize,
        }}>
          <div style={{
            padding: '8px 64px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>
            미리보기
          </div>
          <div ref={previewRef} className="scaled-preview" style={{ flex: 1, overflowY: 'auto', padding: '20px 64px 50vh 64px', background: '#ffffff', minHeight: 0 }}>
            {currentBlocks.map((block, i) => {
              const isActivePreview = block.id === activeBlockId;
              const isBordered = BORDERED_TYPES.has(block.type);
              const headingTopPad = block.type === 'heading' && i !== 0 ? '1.5em' : undefined;
              return (
                <div key={block.id} data-block-id={block.id} style={{ paddingTop: headingTopPad }}>
                  {block.type === 'image' ? (
                    <div style={{ textAlign: 'center' }}>
                      {block.raw_text ? (
                        <img
                          src={block.raw_text.match(/src="([^"]+)"/)?.[1] || ''}
                          alt=""
                          style={{
                            width: block.imageWidth || 400,
                            maxWidth: '90%',
                            height: 'auto',
                          }}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(이미지 없음)</span>
                      )}
                    </div>
                  ) : isBordered ? (
                    <div style={{
                      border: '1.5px solid var(--text-muted, #888)',
                      borderRadius: 0, padding: '12px 16px', margin: '1.2em 0',
                    }}>
                      <EditorPreview
                        content={block.raw_text}
                        borderless
                        locale="ko"
                        activeMathId={isActivePreview ? activeMathId : undefined}
                        onClickMath={(mathId) => handlePreviewMathClick(block.id, mathId)}
                      />
                    </div>
                  ) : block.type === 'choices' ? (
                    <ChoicesBlock rawText={block.raw_text} locale="ko" />
                  ) : (
                    <EditorPreview
                      content={block.raw_text}
                      borderless
                      locale="ko"
                      activeMathId={isActivePreview ? activeMathId : undefined}
                      onClickMath={(mathId) => handlePreviewMathClick(block.id, mathId)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}