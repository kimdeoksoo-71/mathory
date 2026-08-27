'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Problem, Block, ProblemWithBlocks, Folder, TabMeta, ProblemComment, DiscussionSession, DEFAULT_TABS, tabSubcollection, VerifyKind, VerifyReport } from '../../types/problem';
import {
  getProblemWithBlocks, updateProblem, setVerification,
  saveTabBlock, deleteBlock, deleteAllTabBlocks,
} from '../../lib/firestore';
import { watchAllComments, countComments, countAgentSessions, addComment } from '../../lib/comments';
import { listSessions } from '../../lib/discussion-sessions';
import { canComment as canCommentOnProblem } from '../../lib/membership';
import CommentPanel from '../comment/CommentPanel';
import { buildReportMarkdown } from '../comment/VerifyReportCard';
import { runVerifyFlow, computeVerifyHashes, verifyCharCountOf } from '../../lib/verifyFlow';
import { findQuoteRange } from '../../lib/verify/parse';
import { DEFAULT_DIFFICULTY } from '../../lib/constants';
import MarkdownEditor, { MarkdownEditorHandle, CursorActivityInfo } from '../editor/MarkdownEditor';
import ChoicesBlock from '../editor/ChoicesBlock';
import EditorPreview from '../editor/EditorPreview';
import MathToolbar from '../editor/MathToolbar';
import UnifiedToolbar from '../editor/UnifiedToolbar';
import BlockBottomToolbar from '../editor/BlockBottomToolbar';
import FolderPathBar from '../editor/FolderPathBar';
import FindReplacePanel from '../editor/FindReplacePanel';
import ProofreadResultBox, { ProofreadBoxData } from '../editor/ProofreadResultBox';
import { maskForProofread, autoFixDeterministicIssues, ProofreadIssue } from '../../lib/proofread';
import { nanoid } from 'nanoid';
import { toPersistedBlock } from '../../lib/blocks/normalize';
import { toneClass } from '../../lib/keyTone';
import { coachClassName, isCoachBlock } from '../../lib/coachBlock';
import CoachLabel from '../ui/CoachLabel';
import { blockKeyOf, buildCaseGapKeys, buildCaseLabels, caseClassName, caseGapClassName, injectCaseLabel, isCaseBlock } from '../../lib/caseBlock';
import { buildMathIndex, findMathIdAtCursor } from '../../lib/mathIndex';
import { collectCurrentContent, VersionLoadError, versionContentToLocal } from '../../lib/version/adapter';
import { createSnapshot, setCachedLastHash } from '../../lib/version/snapshot';
import { canonicalize } from '../../lib/version/canonicalize';
import { sha256, hashPerTab } from '../../lib/version/hash';
import { writeDraft, readDraft, clearDraft } from '../../lib/version/draft';
import { fastScrollTo, computeBlockAwareScrollTop, computeMathCenterScrollTop } from '../../lib/editorScroll';
import SaveStatus from './SaveStatus';
import ToggleSwitch from '../ui/ToggleSwitch';
import VersionDrawer, { VERSION_DRAWER_WIDTH } from '../version/VersionDrawer';
import { useBlockHistory } from '../../hooks/useBlockHistory';
import type { HistoryEntry } from '../../hooks/useBlockHistory';
import type {
  Participant, VersionContent, VersionTrigger, ProblemVersion, SnapshotResult, ExportOutcome,
} from '../../types/version';
import { validateOcrFile, toDataUrl, normalizeAndFix, OCR_ACCEPT, OCR_LANGUAGES } from '../../lib/ocr';
import { uploadImage, uploadSvg, uploadGgb } from '../../lib/storage';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import type { GraphBlockSave } from '../viewer/GgbGraphView';
import SvgViewer from '../viewer/SvgViewer';
import GgbViewer from '../viewer/GgbViewer';
import ImageTypeSelectModal, { ImageMediaKind } from './ImageTypeSelectModal';
import { computeContentHash } from '../../lib/copyright';
import '../print/PrintStyles.css';
import useSnippets from '../../hooks/useSnippets';
import useAuth from '../../hooks/useAuth';
import { useDrawerResize } from '../../hooks/useDrawerResize';
import DrawerResizeHandle from '../ui/DrawerResizeHandle';
import {
  IconChevronLeft, IconGrip, IconPlus,
  IconTrash,
  IconRename, IconLoader,
  IconRestore, IconSave, IconUndo, IconRedo,
} from '../ui/Icons';
import { splitDisplayMathToRows } from '../../lib/mathSplit';
import { isInsideMath } from '../../lib/latex-completions';
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

/** 개선묶음 M1 B — `.mathory-range`의 진행 구간 비율.
 *  ⚠ `::-moz-range-progress`는 Firefox에만 있어, 두 엔진을 한 규칙으로 덮으려면
 *    그라디언트 정지점을 CSS 변수로 넘기는 방식뿐이다. */
const rangeFill = (value: number, min: number, max: number): React.CSSProperties =>
  ({ ['--p' as string]: `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties);

const SVG_BLOCK_HEIGHT = 300;
const GGB_BLOCK_HEIGHT = 350;

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  heading: '제목',
  list: '목록',
  // Phase 59a: '강조문' → '들여쓰기'. 애초 도입 목적이 "수식/독립 문장에 참조번호를
  //   붙이기 좋게 별도 들여쓴 문단"이라 강조 개념이 아니었다. '강조'는 이제 인라인
  //   `**` 하나만 가리킨다 — 타입 id·클래스·DB는 그대로다(라벨만 바뀐다).
  callout: '들여쓰기',
  // Phase 59a: 코칭 — 강조 4축 중 '신호'. 색·아이콘은 GitHub alert 문법을 가져왔다
  coach_important: '코칭 (Important)',
  coach_caution: '코칭 (Caution)',
  // Phase 59: 첫 줄이 제목행(조건), 둘째 줄부터 본문. 번호는 렌더 시 자동 부여
  case: '경우',
  subcase: '하위 경우',
  // Phase 57: 명칭 재조정 — 테두리 상자를 두른다는 사실이 이름에 드러나도록
  gana: '(가), (나) 상자',
  roman: 'ㄱ, ㄴ 상자',
  box: '글상자',                        // Phase 59a: '빈 글상자' → '글상자'
  choices: '선택지',
  image: '그림',
  svg: 'SVG',
  ggb: 'GeoGebra',
};

/** 사용자가 드롭다운에서 직접 선택 가능한 타입. svg는 '그림' 블록에서 종류 모달로만 진입. */
const BLOCK_TYPES: Block['type'][] = [
  'text', 'heading', 'list', 'callout', 'coach_important', 'coach_caution',
  'case', 'subcase', 'gana', 'roman', 'box', 'choices', 'image',
];

/** 블록 생성 시 기본 내용 */
const BLOCK_PRESETS: Record<string, string> = {
  text: '',
  heading: '## ',
  // Phase 57 '목록': unordered 3줄 + ordered(① 리터럴) 3줄. 필요 없는 줄은 지우고 쓴다.
  // `- ` 빈 항목이 setext underline으로 오판되지 않도록 preventSetextHeadings에 D11 가드가 있음.
  list: '- \n- \n- \n\n① \n② \n③ ',
  callout: '',
  // 코칭도 빈 프리셋 — 라벨(Important/Caution)은 렌더 시 붙으므로 raw_text는 본문만이다
  coach_important: '',
  coach_caution: '',
  // 경우 블록은 빈 프리셋 — 첫 줄에 조건을 쓰면 그 줄이 제목행이 된다(D9).
  case: '',
  subcase: '',
  // Phase 60 P1: 이름(그리고 렌더 결과)이 한국식이므로 입력도 한국 리터럴로.
  //   저장되는 raw_text도 그대로다 — 국제 표준으로의 역변환은 하지 않는다(D1).
  gana: '(가) \n(나) \n(다) ',
  roman: 'ㄱ. \nㄴ. \nㄷ. ',
  box: '',
  choices: '',
  image: '',
  svg: '',
  ggb: '',
};

/** 텍스트 기반 블록 (CodeMirror 에디터 사용) */
const TEXT_BASED_TYPES: Set<string> = new Set([
  'text', 'heading', 'list', 'callout', 'coach_important', 'coach_caution',
  'case', 'subcase', 'gana', 'roman', 'box', 'choices',
]);

/** 블록 분할 허용 타입 (choices, image 제외)
 *  case 계열도 허용한다 — 분할로 생기는 뒤 블록은 항상 'text'라 번호가 늘지 않는다. */
const SPLITTABLE_TYPES: Set<string> = new Set([
  'text', 'heading', 'list', 'callout', 'coach_important', 'coach_caution',
  'case', 'subcase', 'gana', 'roman', 'box',
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

/* 수식 인덱싱(buildMathIndex·findMathIdAtCursor)은 Phase 58에서 lib/mathIndex.ts로
   옮겼다 — P3의 "핵심문장" 토글이 같은 수식 경계를 봐야 하기 때문이다. */

/* typewriter 스크롤 임계값 (Phase 56 D8‴) — 발화선 ≠ 착지선이어야 재발화가 없다 */
const TYPING_TRIGGER_MARGIN = 80;   // 패널 하단 80px 안으로 들어오면 발화
const TYPING_LANDING_RATIO = 0.45;  // 패널 높이의 45% 지점에 착지

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

/* ═══ EmptyBlockChips: 빈 텍스트 블록에 그림/선택지 빠른 전환 칩 ═══ */

function EmptyBlockChips({ onPick }: { onPick: (type: Block['type']) => void }) {
  const CHIPS: Array<{ type: Block['type']; label: string }> = [
    { type: 'heading', label: '제목' },
    { type: 'image', label: '그림' },
    { type: 'gana', label: '(가)(나)' },   // Phase 57 D10: 칩 폭 제약상 축약형 유지
  ];
  return (
    <div style={{ display: 'flex', gap: 3, marginLeft: 4, alignItems: 'center' }}>
      {CHIPS.map((c) => (
        <button
          key={c.type}
          onClick={(e) => { e.stopPropagation(); onPick(c.type); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            padding: '0 6px', height: 16, fontSize: 10, lineHeight: '14px',
            background: 'var(--bg-hover, #efefef)',
            border: '1px solid var(--border-light, #ddd)',
            borderRadius: 8, cursor: 'pointer',
            color: 'var(--text-secondary, #666)',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'nowrap',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ═══ MediaBlockContent (image + svg 통합) ═══ */

const ACCEPT_BY_KIND: Record<ImageMediaKind, string> = {
  raster: 'image/png,image/jpeg,image/gif,image/webp',
  svg: 'image/svg+xml,.svg',
  ggb: '.ggb',
};

function MediaBlockContent({
  block,
  onMediaUpload,
  onImageWidthChange,
  onImageTreatmentChange,
  onImageGrayChange,
  onSaveSvgInitialView,
  onSvgHeightChange,
  onSaveGgbInitialView,
  onGgbHeightChange,
  problemId,
}: {
  block: LocalBlock;
  onMediaUpload: (file: File, kind: ImageMediaKind, blockId: string) => Promise<void>;
  onImageWidthChange: (blockId: string, width: number) => void;
  onImageTreatmentChange: (blockId: string, treatment: 'frame' | undefined) => void;
  onImageGrayChange: (blockId: string, gray: boolean | undefined) => void;
  onSaveSvgInitialView: (blockId: string, view: { scale: number; positionX: number; positionY: number }) => void;
  onSvgHeightChange: (blockId: string, height: number) => void;
  onSaveGgbInitialView: (blockId: string, coords: { xMin: number; xMax: number; yMin: number; yMax: number }) => void;
  onGgbHeightChange: (blockId: string, height: number) => void;
  problemId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingKindRef = useRef<ImageMediaKind | null>(null);
  const imgWidth = block.imageWidth || 400;
  const isFrame = block.imageTreatment === 'frame';
  const isColor = block.imageGray === false;

  const openTypeModal = () => setShowTypeModal(true);
  const cancelTypeModal = () => setShowTypeModal(false);

  const handleTypeSelected = (kind: ImageMediaKind) => {
    setShowTypeModal(false);
    pendingKindRef.current = kind;
    // input의 accept를 동적으로 변경한 뒤 click
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPT_BY_KIND[kind];
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const kind = pendingKindRef.current;
    pendingKindRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file || !kind) return;
    setUploading(true);
    setError('');
    try {
      await onMediaUpload(file, kind, block.id);
    } catch (err: any) {
      setError(`업로드 실패: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  // ─── SVG 블록 ───
  if (block.type === 'svg' && block.raw_text) {
    const svgHeight = block.svg_height || SVG_BLOCK_HEIGHT;
    return (
      <div style={{ padding: '8px 16px' }}>
        <SvgViewer
          url={block.raw_text}
          initialView={block.svg_initial_view}
          height={svgHeight}
          onSaveInitialView={(v) => onSaveSvgInitialView(block.id, v)}
        />
        <div style={{
          marginTop: 6, display: 'flex', justifyContent: 'center',
          alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>높이</span>
          <input
            type="range"
            className="mathory-range"
            min={150}
            max={800}
            step={20}
            value={svgHeight}
            onChange={(e) => onSvgHeightChange(block.id, Number(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 140, ...rangeFill(svgHeight, 150, 800) }}
          />
          <span>{svgHeight}px</span>
          <button
            onClick={openTypeModal}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '4px 12px', fontSize: 12,
              background: 'var(--bg-hover, #f0f0f0)',
              border: '1px solid var(--border-light, #ddd)',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            그림 변경
          </button>
        </div>
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{error}</div>}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={handleFileChange}
        />
        {showTypeModal && (
          <ImageTypeSelectModal onSelect={handleTypeSelected} onCancel={cancelTypeModal} />
        )}
      </div>
    );
  }

  // ─── GGB 블록 ───
  if (block.type === 'ggb' && block.raw_text) {
    const ggbHeight = block.ggb_height || GGB_BLOCK_HEIGHT;
    return (
      <div style={{ padding: '8px 16px' }}>
        <GgbViewer
          url={block.raw_text}
          initialCoords={block.ggb_initial_coords}
          height={ggbHeight}
          onSaveInitialView={(c) => onSaveGgbInitialView(block.id, c)}
        />
        <div style={{
          marginTop: 6, display: 'flex', justifyContent: 'center',
          alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>높이</span>
          <input
            type="range"
            className="mathory-range"
            min={200}
            max={800}
            step={20}
            value={ggbHeight}
            onChange={(e) => onGgbHeightChange(block.id, Number(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 140, ...rangeFill(ggbHeight, 200, 800) }}
          />
          <span>{ggbHeight}px</span>
          <button
            onClick={openTypeModal}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '4px 12px', fontSize: 12,
              background: 'var(--bg-hover, #f0f0f0)',
              border: '1px solid var(--border-light, #ddd)',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            그림 변경
          </button>
        </div>
        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{error}</div>}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={handleFileChange}
        />
        {showTypeModal && (
          <ImageTypeSelectModal onSelect={handleTypeSelected} onCancel={cancelTypeModal} />
        )}
      </div>
    );
  }

  // ─── 일반 이미지 블록 ───
  if (block.type === 'image' && block.raw_text) {
    const srcMatch = block.raw_text.match(/src="([^"]+)"/);
    const src = srcMatch?.[1] || '';
    const maxW = 600;
    return (
      <div style={{ padding: '8px 16px', textAlign: 'center' }}>
        <img src={src} alt="" style={{ width: Math.min(imgWidth, maxW), maxWidth: '90%', borderRadius: 8, ...imageTreatmentStyle(block) }} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
        }}>
          <span>크기</span>
          <input
            type="range"
            className="mathory-range"
            min={80}
            max={800}
            step={10}
            value={imgWidth}
            onChange={(e) => onImageWidthChange(block.id, Number(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ width: 140, ...rangeFill(imgWidth, 80, 800) }}
          />
          <span>{imgWidth}px</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
          <button
            onClick={() => onImageTreatmentChange(block.id, isFrame ? undefined : 'frame')}
            onPointerDown={(e) => e.stopPropagation()}
            title="흰 배경 사진/스크린샷을 액자(테두리)로 감쌉니다"
            style={{
              padding: '4px 12px', fontSize: 12,
              background: isFrame ? 'var(--accent-primary)' : 'var(--bg-hover)',
              color: isFrame ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-light)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            액자
          </button>
          <button
            onClick={() => onImageGrayChange(block.id, isColor ? undefined : false)}
            onPointerDown={(e) => e.stopPropagation()}
            title="기본은 흑백입니다. 켜면 원래 색을 유지합니다"
            style={{
              padding: '4px 12px', fontSize: 12,
              background: isColor ? 'var(--accent-primary)' : 'var(--bg-hover)',
              color: isColor ? '#fff' : 'var(--text-primary)',
              border: '1px solid var(--border-light)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            컬러 유지
          </button>
          {/* 개선묶음 M1 B — 토글 2개와 한 줄에. 토글이 아니므로 배경을 한 단계 어둡게 해 구별한다 */}
          <button
            onClick={openTypeModal}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '4px 12px', fontSize: 12,
              background: 'var(--bg-active)', color: 'var(--text-primary)',
              border: '1px solid var(--border-light)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            그림 변경
          </button>
        </div>

        {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 4 }}>{error}</div>}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={handleFileChange}
        />
        {showTypeModal && (
          <ImageTypeSelectModal onSelect={handleTypeSelected} onCancel={cancelTypeModal} />
        )}
      </div>
    );
  }

  // ─── 빈 그림 블록 ───
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
            그림을 추가하세요
          </div>
          <button
            onClick={openTypeModal}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              padding: '6px 16px', fontSize: 13,
              background: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            파일 선택
          </button>
          {error && <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={handleFileChange}
      />
      {showTypeModal && (
        <ImageTypeSelectModal onSelect={handleTypeSelected} onCancel={cancelTypeModal} />
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
  collapseMode,
  selected,
  hideTopLine,
  onFocus,
  onChange,
  onTypeChange,
  onTitleChange,
  onDelete,
  onToggleCollapse,
  onBarClick,
  onMediaUpload,
  onImageWidthChange,
  onImageTreatmentChange,
  onImageGrayChange,
  onSummaryChange,
  onSaveSvgInitialView,
  onSvgHeightChange,
  onSaveGgbInitialView,
  onGgbHeightChange,
  problemId,
  onSnippetShortcut,
  onCursorActivity,
  onSplitMathLines,
  blockTypes,
  onAddBlock,
  onSplitBlock,
  canSplitBlock,
}: {
  block: LocalBlock;
  index: number;
  isActive: boolean;
  canDelete: boolean;
  editorRefs: React.MutableRefObject<Record<string, MarkdownEditorHandle | null>>;
  collapseMode: boolean;
  selected: boolean;
  /* 위쪽 가로선을 그리지 않는다: 첫 블록이거나, 직전이 활성 카드라 그쪽 아래 테두리가 선을 담당할 때 */
  hideTopLine: boolean;
  onFocus: () => void;
  onChange: (val: string) => void;
  onTypeChange: (type: Block['type']) => void;
  onTitleChange: (title: string) => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  /* Phase 45a D5-d — 클릭 하나에 prop 3개를 두지 않고 수식어를 넘겨 부모가 분기한다 */
  onBarClick: (mods: { shift: boolean; alt: boolean }) => void;
  onMediaUpload: (file: File, kind: ImageMediaKind, blockId: string) => Promise<void>;
  onImageWidthChange: (blockId: string, width: number) => void;
  onImageTreatmentChange: (blockId: string, treatment: 'frame' | undefined) => void;
  onImageGrayChange: (blockId: string, gray: boolean | undefined) => void;
  onSummaryChange: (blockId: string, show: boolean | undefined) => void;
  onSaveSvgInitialView: (blockId: string, view: { scale: number; positionX: number; positionY: number }) => void;
  onSvgHeightChange: (blockId: string, height: number) => void;
  onSaveGgbInitialView: (blockId: string, coords: { xMin: number; xMax: number; yMin: number; yMax: number }) => void;
  onGgbHeightChange: (blockId: string, height: number) => void;
  problemId: string;
  onSnippetShortcut: (index: number) => void;
  onCursorActivity?: (info: CursorActivityInfo) => void;
  onSplitMathLines: () => void;
  blockTypes: { type: string; label: string }[];
  onAddBlock: (type: string) => void;
  onSplitBlock: () => void;
  canSplitBlock: boolean;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: block.id });

  const isHeading = block.type === 'heading';

  /* ─── Phase 45a E형 블록 인셋 ───────────────────────────────────────────
     이중 외곽(클레이 프레임 세로선 ≥ 블록 세로선 + 그 사이 16px 완충대)을
     안쪽에서 푼다. 비활성 블록의 세로선을 지우면 화면에 남는 닫힌 윤곽은
     활성 카드뿐 — 활성=인테리어(둥근 진한 면), 비활성=공통영역(면+가로선).
     선택 블록은 활성과 같은 문법을 쓴다(전체접기 모드 재배치용 표시).

     ⚠ 구분선은 블록 사이에 **하나만** 둔다 (덕수 검수 2·2-1).
       그래서 가로선은 **위쪽만** 그린다 — 아래쪽까지 그리면 인접한 두 블록이
       각자 선을 내어 2줄이 된다. 위쪽만 그리면 자연스럽게
         · 첫 블록은 상단 선이 없고(클레이 영역 경계에 밀착)
         · 마지막 블록 아래는 열려 클레이로 이어진다.
       직전이 활성 카드면 그 카드의 아래 테두리가 이미 선을 담당하므로
       이 블록의 위쪽 선은 지운다 → hideTopLine.
     ⚠ 비활성의 네 변 0.5px은 transparent로 '자리를 잡아 둔다'. 테두리를 아예
        빼면 활성 전환 순간 내용물이 밀린다 (덕수 검수 1에서 확인된 불변식).
     ⚠ 0.5px = 레티나 1물리픽셀. 1px은 2물리픽셀이라 부담스럽다(덕수 검수 3).
     ⚠ 그림자는 쓰지 않는다(덕수 검수 2). 활성 신호는 배경·라운드·테두리 3중. */
  const emphasized = isActive || selected;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    /* ⚠ 네 변을 항상 '전부' 적는다 — 조건부 스프레드로 longhand를 얹지 말 것.
       `border` shorthand 위에 borderTopColor를 스프레드로 얹었더니, hideTopLine이
       false→true로 바뀔 때 React가 그 longhand만 제거(= '')하고 shorthand는
       변경이 없어 다시 쓰지 않았다. 결과: border-top-color가 빈 구멍으로 남아
       초기값 currentColor(본문 검정 #2D2A23)로 떨어져 진한 선이 생겼다.
       첫 렌더는 멀쩡하고 활성 블록을 옮긴 뒤부터 나타나 추적이 어려웠다.
       (DevTools 실측 2026-08-18: 활성 카드 아래 블록 Top = rgb(45,42,35))
     ⚠ 활성 카드의 네 변은 같은 색일 것 — 둥근 모서리에서 인접 두 변의 색이
       다르면 브라우저가 곡선 구간을 대각선으로 전환시켜 코너가 흐려진다. */
    borderTop: `0.5px solid ${emphasized
      ? 'var(--block-border-active)'
      : hideTopLine ? 'transparent' : 'var(--block-hairline)'}`,
    borderRight: `0.5px solid ${emphasized ? 'var(--block-border-active)' : 'transparent'}`,
    borderBottom: `0.5px solid ${emphasized ? 'var(--block-border-active)' : 'transparent'}`,
    borderLeft: `0.5px solid ${emphasized ? 'var(--block-border-active)' : 'transparent'}`,
    borderRadius: emphasized ? 8 : 0,
    background: emphasized ? 'var(--block-bg-active)' : 'var(--block-bg)',
    overflow: 'hidden',
  };

  // 상단바 표시: 활성 블록 + 전체접기 모드(모든 블록)
  const showBar = isActive || collapseMode;
  // 요약에 넣은 블록은 비활성일 때도 그 사실이 보여야 한다 → 스위치만 있는 얇은 바를 남긴다
  const showSummaryOnlyBar = !showBar && !isHeading && block.showInSummary === true;

  /* 요약에 넣기 스위치. 헤더가 dnd-kit 드래그 핸들 영역이라 바깥 span이 pointerdown을 막는다.
     Phase 45a D3-c: click의 stopPropagation은 dblclick을 막지 않는다(별개 이벤트 타입) →
     바의 onDoubleClick(개별 펼침)이 걸리지 않도록 따로 차단한다.
     ⚠ 제목 블록과 경우 계열에는 두지 않는다 — 둘 다 요약의 '뼈대'라 항상 들어가고,
       buildOutline이 showInSummary를 아예 읽지 않는다(heading은 즉시 continue,
       case 계열은 `!isCaseBlock` 조건으로 제외). 스위치가 아무 일도 하지 않으면서
       오해만 주는 자리다 (Phase 59a R5 — 제목 블록의 선례를 경우까지 넓힌 것).
     ⚠ 이어짓기(제목행 없는 case)도 마찬가지로 요약에 남지 않는다. 남기고 싶은 내용은
       경우 **사이 블록**에 두고 그 블록의 스위치를 켜면 된다. */
  const summaryToggle = isHeading || isCaseBlock(block.type) ? null : (
    <span
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', marginRight: 2 }}
    >
      <ToggleSwitch
        label="요약에 넣기"
        on={block.showInSummary === true}
        onToggle={() => onSummaryChange(block.id, block.showInSummary ? undefined : true)}
        title={block.showInSummary
          ? '요약 보기에서 뺍니다'
          : '요약 보기에도 이 블록을 남깁니다 (요약은 제목·경우만 남기는 것이 기본)'}
      />
    </span>
  );

  /* 삭제 버튼 — 접힘 바·펼침 바 공용 (Phase 45a D3-a) */
  const deleteButton = canDelete ? (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}   // D3-c
      style={{
        border: 'none', background: 'none', cursor: 'pointer',
        padding: 2, display: 'flex', color: 'var(--text-faint)',
      }}
      title="블록 삭제"
    >
      <IconTrash size={12} />
    </button>
  ) : null;

  // 접힌 상단바에 보여줄 첫 줄 미리보기 (## 등 마크다운 기호 제거)
  const previewText = useMemo(() => {
    const line = block.raw_text.split('\n').map((l) => l.trim()).find(Boolean) || '';
    return line.replace(/^#{1,6}\s*/, '').replace(/[*_`>]/g, '').slice(0, 50);
  }, [block.raw_text]);

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-editor-block-id={block.id}>
      {/* 비활성이지만 요약에 넣은 블록 — 상단바의 '요약에 넣기'만 남긴다.
          배경·구분선은 두지 않는다(활성 헤더처럼 보이면 안 된다). */}
      {showSummaryOnlyBar && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '2px 16px 0', position: 'relative', zIndex: 1,   // D6″-g 정렬
        }}>
          {summaryToggle}
        </div>
      )}

      {/* ── Block Header — 활성 블록 또는 전체접기 모드일 때 표시 ── */}
      {showBar && (
      <div
        onClick={(e) => onBarClick({ shift: e.shiftKey, alt: e.altKey })}
        onDoubleClick={() => { if (collapseMode) onToggleCollapse(); }}
        /* D5-e: 일반 모드에서는 수식어가 무시되므로 힌트도 걸지 않는다 */
        title={collapseMode
          ? '클릭: 선택 · Shift+클릭: 범위 · Alt+클릭: 개별 토글'
          : undefined}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 4,
          // E형 D6″-g: 좌우 16px = .cm-content 패딩과 같은 선. 바와 본문의 좌변이 맞는다
          padding: '4px 16px',
          /* 펼침 바는 카드 내부 헤더 틴트를 유지하고, 접힘 바는 투명으로 두어
             래퍼 배경(활성/선택 = 진한 면, 비활성 = 플랫 행)이 그대로 비치게 한다 */
          background: block.collapsed ? 'transparent' : 'var(--block-bg-active)',
          fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'var(--font-ui)', userSelect: 'none',
          /* 본문이 보일 때만 헤더↔에디터 구분선.
             1px·--block-border-active는 두껍고 진했고(덕수 검수 1차),
             0.5px·--border-primary는 활성 배경(#E8DFCE)에서 1.06:1이라 아예 안 보였다(2차).
             두께만 절반으로 줄이고 색은 카드 선 계열을 유지한다 = 0.5px·2.03:1.
             하단 툴바 borderTop도 같은 값으로 맞춰 블록 위아래를 대칭으로 둔다. */
          borderBottom: !block.collapsed ? '0.5px solid var(--block-border-active)' : 'none',
          // 활성 카드일 때만 첫 둥근 모서리 유지 (비활성 플랫 행은 직각)
          borderTopLeftRadius: emphasized ? 7.5 : 0, borderTopRightRadius: emphasized ? 7.5 : 0,
        }}
      >
        {/* 제목 블록 접힘 표시 (D7″-c: 거터가 사라져 돌출 문법 자체가 소멸 → 바 내부 인라인) */}
        {block.collapsed && isHeading && (
          <span style={{
            fontSize: 13, fontWeight: 700, lineHeight: 1,
            color: 'var(--accent-primary)', pointerEvents: 'none',
          }}>§</span>
        )}

        {/* 앞쪽 드래그 존 (여기서만 드래그 시작) */}
        <span
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title="드래그하여 이동"
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '2px 2px' }}
        >
          <IconGrip size={12} />
        </span>

        {block.collapsed ? (
          <>
            <span style={{ fontWeight: 600 }}>{BLOCK_TYPE_LABELS[block.type] || block.type}</span>
            {previewText && (
              <span style={{
                color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', flex: 1, minWidth: 0,
              }}>{previewText}</span>
            )}

            {/* D3-b: previewText가 비면 위 span 자체가 렌더되지 않아 버튼이 라벨에
                달라붙는다 → 스페이서는 무조건 둔다 */}
            <div style={{ flex: 1 }} />

            {summaryToggle}
            {deleteButton}
          </>
        ) : (
          <>
            <select
              value={block.type}
              onChange={(e) => onTypeChange(e.target.value as Block['type'])}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                border: 'none', background: 'none', fontSize: 11,
                color: 'var(--text-muted)', cursor: 'pointer', outline: 'none',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
              ))}
              {/* 기존 svg/ggb 블록은 옵션 목록에 없으므로 현재 값 보존용으로 표시 */}
              {block.type === 'svg' && (
                <option value="svg">{BLOCK_TYPE_LABELS.svg}</option>
              )}
              {block.type === 'ggb' && (
                <option value="ggb">{BLOCK_TYPE_LABELS.ggb}</option>
              )}
            </select>

            {block.type === 'text' && !block.raw_text && (
              <EmptyBlockChips onPick={onTypeChange} />
            )}

            <div style={{ flex: 1 }} />

            {summaryToggle}
            {deleteButton}
          </>
        )}
      </div>
      )}

      {/* ── Block Content ── */}
      {!block.collapsed && (
        <div style={{ padding: 0 }} onClick={onFocus}>
          {(block.type === 'image' || block.type === 'svg' || block.type === 'ggb') ? (
            <MediaBlockContent
              block={block}
              onMediaUpload={onMediaUpload}
              onImageWidthChange={onImageWidthChange}
              onImageTreatmentChange={onImageTreatmentChange}
              onImageGrayChange={onImageGrayChange}
              onSaveSvgInitialView={onSaveSvgInitialView}
              onSvgHeightChange={onSvgHeightChange}
              onSaveGgbInitialView={onSaveGgbInitialView}
              onGgbHeightChange={onGgbHeightChange}
              problemId={problemId}
            />
          ) : (
            <MarkdownEditor
              ref={(el) => { editorRefs.current[block.id] = el; }}
              initialValue={block.raw_text}
              onChange={onChange}
              onSnippetShortcut={onSnippetShortcut}
              onCursorActivity={onCursorActivity
                ? (info) => onCursorActivity({ ...info, blockId: block.id })
                : undefined}
            />
          )}
        </div>
      )}

      {/* ── Block Bottom Toolbar — 활성 + 펼친 블록만 ── */}
      {isActive && !block.collapsed && (
        <BlockBottomToolbar
          blockTypes={blockTypes}
          onAddBlock={onAddBlock}
          onSplitBlock={onSplitBlock}
          canSplitBlock={canSplitBlock}
          onSplitMathLines={onSplitMathLines}
        />
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
  const { user } = useAuth();
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
  const [dirty, setDirty] = useState(false);
  // Phase 55(F7): 로드 실패 탭 — 스냅샷 전 가드용 (collectCurrentContent가 참조)
  const tabLoadErrorsRef = useRef<Record<string, string>>({});
  // Phase 55 계층1: 자동저장 상태
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [recoverableDraft, setRecoverableDraft] = useState<VersionContent | null>(null);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);  // Stage 4
  // Phase 44 Step D → Phase 62 D11: 토론 패널 드래그 리사이즈 (조기 return보다 위에 선언 — 훅 규칙)
  // 폭은 세션 내 상태로만 유지 (Firestore 저장 범위 밖). 기본 420px (75% of 560).
  const comment = useDrawerResize({
    defaultWidth: 420, min: 360, max: () => window.innerWidth * 0.9, anchor: 'right',
  });
  // Phase 62 D13 — 버전 드로어도 같은 문법으로 조절한다(폭 수치만 별도).
  const version = useDrawerResize({
    defaultWidth: VERSION_DRAWER_WIDTH, min: 360, max: () => window.innerWidth * 0.9, anchor: 'right',
  });
  // 초기 load 시 effect 1회 skip + 저장 성공 후 skip용 플래그
  const skipDirtyRef = useRef(true);
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

  // 토론 패널 (편집 중에도 AI 토론·댓글 참조 가능)
  // 활성 탭과 동기 — 사용자가 편집 탭을 바꾸면 토론 탭도 따라감
  // Phase 47: 패널 모드 — 'comments'(댓글) | 'agent' | null(닫힘)
  const [panelMode, setPanelMode] = useState<'comments' | 'agent' | null>(null);
  const discussionOpen = panelMode !== null;
  /* 우측 패널이 차지하는 폭 — 댓글·agent와 버전 기록 드로어가 같은 규약을 쓴다.
     둘 다 덮지 않고 편집·미리보기를 왼쪽으로 밀어낸다(기타 개선 3-2).
     동시에 열리면 넓은 쪽 기준(드로어가 zIndex 110으로 앞에 온다). */
  const rightPanelWidth = Math.max(
    discussionOpen ? comment.width : 0,
    versionDrawerOpen ? version.width : 0,
  );
  const rightPanelOpen = rightPanelWidth > 0;
  /* Phase 62 D15 — 핸들은 하나만 그린다: rightPanelWidth를 소유한(더 넓은) 쪽.
     동률이면 드로어(zIndex 110으로 위에 있다). 좁은 쪽 핸들은 어차피 넓은 패널에
     가려지거나 패널 한복판에 떠서 혼란만 준다. */
  const activeResizeHandle: 'comment' | 'version' | null =
    rightPanelWidth === 0 ? null
      : (versionDrawerOpen && version.width >= (discussionOpen ? comment.width : 0))
        ? 'version' : 'comment';
  const rightPanelDragging = comment.dragging || version.dragging;
  const [allComments, setAllComments] = useState<ProblemComment[]>([]);
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const commentSessionId = useMemo(
    () => sessions.find((s) => s.type === 'comment')?.id ?? null,
    [sessions],
  );
  const commentCount = useMemo(
    () => countComments(allComments, commentSessionId, { unresolvedOnly: true }),
    [allComments, commentSessionId],
  );
  const agentCount = useMemo(() => countAgentSessions(sessions), [sessions]);
  const loadSessions = useCallback(() => {
    if (!problem?.id) return;
    listSessions(problem.id).then(setSessions).catch(() => setSessions([]));
  }, [problem?.id]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // 활성 블록
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  // Phase 25 Step 1: 활성 블록 커서가 $...$ / $$...$$ 내부인지 (구분자 안쪽만)
  const [cursorInMath, setCursorInMath] = useState(false);

  // 전체 접기 모드 + 다중선택 (세션 한정, 새로고침/탭전환 시 초기화)
  const [collapseMode, setCollapseMode] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  /* Phase 45a D4 — collapseMode를 콜백 deps에 넣으면 토글할 때마다 콜백이 새로 만들어져
     전 블록이 리렌더된다. useBlockHistory의 captureRef 관용대로 ref로 읽는다. */
  const collapseModeRef = useRef(collapseMode);
  collapseModeRef.current = collapseMode;
  /* Phase 45a D5 — 범위 선택 앵커(마지막 일반 클릭 블록). id 유효성은 쓸 때
     indexOf로 재검증하므로 별도 무효화 로직이 필요 없다(undo 세대 교체에도 자동 대응). */
  const selectionAnchorRef = useRef<string | null>(null);

  // 찾기/바꾸기 패널
  const [searchOpen, setSearchOpen] = useState(false);

  // 교정 결과: tabId → blockId → 결과
  const [proofreadResults, setProofreadResults] = useState<Record<string, Record<string, ProofreadBoxData>>>({});
  const [proofreading, setProofreading] = useState(false);

  // OCR (Phase 28)
  const [ocrLoading, setOcrLoading] = useState(false);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // 블록 추가 드롭다운

  // 미리보기 활성 수식 인덱스
  const [activeMathId, setActiveMathId] = useState<number>(-1);

  const [aiLoadingBlockId, setAiLoadingBlockId] = useState<string | null>(null);

  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});
  // 자동 정정 중에는 handleBlockChange의 이슈 자동 제거 필터를 건너뛰기 위한 플래그
  const autoFixInProgressRef = useRef<boolean>(false);
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

  /* ─── dirty 추적: 블록/메타 변경 시 setDirty(true) ─── */
  useEffect(() => {
    if (!problem) return; // load 전 무시
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setDirty(true);
  }, [problem, allBlocks, editTitle, editSource, editCategory, editDifficulty, editAnswer, editFolderId]);

  const handleFontSizeChange = (delta: number) => {
    setContentFontSize((prev) => {
      const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, prev + delta));
      setStoredFontSize(next);
      return next;
    });
  };

  // ─── Phase 55a: 블록 구조 Undo/Redo 히스토리 ───
  const applyGenRef = useRef(0);   // apply 세대 카운터 (early return 위에 둬야 hooks 순서 안정)
  const captureHistory = (): HistoryEntry | null => {
    try {
      return {
        content: collectCurrentContent({
          tabs, blocksByTab: allBlocks, title: editTitle, answer: editAnswer,
          tabLoadErrors: tabLoadErrorsRef.current,
        }),
        activeTab,
        activeBlockKey: (allBlocks[activeTab] || []).find((b) => b.id === activeBlockId)?.block_key ?? null,
      };
    } catch { return null; }   // C4: 로드 실패 탭 → push/undo 스킵
  };
  const {
    pushUndo, undo: undoBlocks, redo: redoBlocks, reset: resetHistory, canUndo, canRedo,
  } = useBlockHistory(
    captureHistory,
    (entry) => applyVersionContent(entry.content, {
      activeTab: entry.activeTab, activeBlockKey: entry.activeBlockKey ?? undefined,
    }),
  );

  /* ─── 데이터 로드 ─── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      if (data) {
        setProblem(data);
        // Phase 55: dedup 캐시 초기화 + 로드 실패 탭 보관(F7) + 계층1 상태
        if (data.last_version_hash) setCachedLastHash(problemId, data.last_version_hash);
        tabLoadErrorsRef.current = data.tabLoadErrors || {};
        resetHistory();   // Phase 55a(C9): 문항 전환 시 undo 히스토리 초기화
        setLastSavedAt(data.updated_at ? data.updated_at.getTime() : null);
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
          blocks.map((b) => ({ ...b, block_key: b.block_key || nanoid(), type: normalizeBlockType(b.type), collapsed: false, title: b.title || '' }));

        const blocksMap: Record<string, LocalBlock[]> = {};
        const origIds: Record<string, string[]> = {};
        for (const tab of loadedTabs) {
          const blocks = data.tabBlocks[tab.id] || [];
          blocksMap[tab.id] = toLocal(blocks);
          origIds[tab.id] = blocks.map((b) => b.id);
        }
        setAllBlocks(blocksMap);
        setOrigBlockIds(origIds);

        // Phase 55 계층1: 크래시 복구 감지 — localStorage 드래프트가 서버본과 다르면 배너
        try {
          const draft = readDraft(problemId);
          if (draft) {
            const loaded = collectCurrentContent({
              tabs: loadedTabs, blocksByTab: blocksMap,
              title: data.title, answer: data.answer || '',
              tabLoadErrors: data.tabLoadErrors,
            });
            const [dh, lh] = await Promise.all([
              sha256(canonicalize(draft.content)),
              sha256(canonicalize(loaded)),
            ]);
            if (dh !== lh) setRecoverableDraft(draft.content);   // 미저장 변경 존재
            else clearDraft(problemId);                          // 서버본과 동일 → 정리
          }
        } catch {
          /* 로드 실패 탭 등 → 복구 감지 스킵 */
        }

        // 첫 블록 활성화
        const firstTabBlocks = blocksMap[loadedTabs[0].id] || [];
        if (firstTabBlocks.length > 0) setActiveBlockId(firstTabBlocks[0].id);

      }
      setLoading(false);
    };
    load();
  }, [problemId]);

  // 댓글 실시간 구독 — 삭제·추가가 즉시 반영되도록
  useEffect(() => {
    if (!problemId) return;
    let unsub: (() => void) | null = null;
    try {
      unsub = watchAllComments(problemId, setAllComments);
    } catch {
      setAllComments([]);
    }
    return () => { if (unsub) unsub(); };
  }, [problemId]);

  /* ─── 현재 탭의 블록 ─── */
  const currentBlocks = allBlocks[activeTab] || [];
  /* Phase 59 — 경우 블록 자동 번호. 편집 중 실시간 재계산이 목적이므로
     currentBlocks 참조가 바뀔 때마다 다시 돈다(블록 수십 개 규모라 비용 무시 가능). */
  const caseLabels = useMemo(() => buildCaseLabels(currentBlocks), [currentBlocks]);
  /* 경우 사이에 낀 블록 — rail이 관통해야 한다(이미지를 경우 안에 끼운 구성) */
  const caseGaps = useMemo(() => buildCaseGapKeys(currentBlocks), [currentBlocks]);
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

  /* ─── 교정 (Phase 27) ─── */
  // 자동 수정 대상에서 제외할 타입 (image는 텍스트 없음)
  const AUTOFIX_EXCLUDED_TYPES = useMemo(() => new Set(['image', 'svg', 'ggb']), []);
  // Claude API 교정 대상에서 제외할 타입 (choices는 ①②③④⑤ 라벨이 오탈자로 오인됨)
  const API_EXCLUDED_TYPES = useMemo(() => new Set(['image', 'svg', 'ggb', 'choices']), []);

  const callProofreadApi = useCallback(async (
    targets: { id: string; rawText: string }[],
  ): Promise<Record<string, ProofreadBoxData>> => {
    const now = Date.now();
    // 마스킹 (결정적 규칙은 이미 호출 측에서 자동 적용됨)
    const apiBlocks: { id: string; masked: string }[] = [];
    for (const t of targets) {
      const { masked } = maskForProofread(t.rawText);
      apiBlocks.push({ id: t.id, masked });
    }

    const out: Record<string, ProofreadBoxData> = {};
    try {
      const res = await fetch('/api/proofread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: apiBlocks }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json() as { results: Record<string, { status: 'ok'; issues: ProofreadIssue[] }> };
      for (const t of targets) {
        const apiResult = json.results?.[t.id];
        out[t.id] = { status: 'ok', issues: apiResult?.issues || [], timestamp: now };
      }
    } catch (e: any) {
      for (const t of targets) {
        out[t.id] = {
          status: 'failed',
          issues: [],
          timestamp: now,
          error: e?.message || '알 수 없는 오류',
        };
      }
    }
    return out;
  }, []);

  /* 결정적 규칙(josa-space, latex-brace) 자동 적용 후, 수정된 rawText 배열 반환 */
  const applyDeterministicAutoFix = useCallback((
    blocks: { id: string; raw_text: string; type: string }[],
  ): { targets: { id: string; rawText: string }[]; autoFixCount: number } => {
    let autoFixCount = 0;
    const targets: { id: string; rawText: string }[] = [];
    for (const b of blocks) {
      /* 개선묶음 M1 D12′: `(ㄱ)`→`(1)`는 보기 라벨을 그렇게 적는 블록에서만 끈다.
         ⚠ OCR 삽입 경로(lib/ocr.ts)는 블록 타입을 모르므로 기본(변환)으로 돈다 — 알고 두는 한계다. */
      const { fixed, count } = autoFixDeterministicIssues(b.raw_text, {
        skipJamoRefs: b.type === 'roman' || b.type === 'choices',
      });
      if (count > 0) {
        autoFixCount += count;
        const editor = editorRefs.current[b.id];
        autoFixInProgressRef.current = true;
        try {
          if (editor) editor.setContent(fixed);
        } finally {
          autoFixInProgressRef.current = false;
        }
        setCurrentBlocks((prev) =>
          prev.map((pb) => (pb.id === b.id ? { ...pb, raw_text: fixed } : pb))
        );
      }
      targets.push({ id: b.id, rawText: fixed });
    }
    return { targets, autoFixCount };
  }, [setCurrentBlocks]);

  const handleRunProofread = useCallback(async () => {
    if (proofreading) return;
    // 자동 수정 대상: image 제외 (choices 포함 — 숫자 자동 수식화 등 적용)
    const autoFixBlocks = (allBlocks[activeTab] || []).filter(
      (b) => !AUTOFIX_EXCLUDED_TYPES.has(b.type) && b.raw_text.trim()
    );
    if (autoFixBlocks.length === 0) {
      setStatus('교정할 텍스트가 없습니다');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    const tabIdAtStart = activeTab;

    // 결정적 규칙 자동 적용 (choices 포함)
    const { targets, autoFixCount } = applyDeterministicAutoFix(autoFixBlocks);

    // Claude API 호출 대상: choices 추가 제외
    const apiTargets = targets.filter((t) => {
      const b = autoFixBlocks.find((bb) => bb.id === t.id);
      return b && !API_EXCLUDED_TYPES.has(b.type);
    });

    // 로딩 박스 즉시 표시 (API 호출 대상에 한해)
    setProofreadResults((prev) => {
      const tab = { ...(prev[tabIdAtStart] || {}) };
      for (const t of apiTargets) {
        tab[t.id] = { status: 'loading', issues: [], timestamp: Date.now() };
      }
      return { ...prev, [tabIdAtStart]: tab };
    });
    setProofreading(true);

    const out = await callProofreadApi(apiTargets);

    setProofreadResults((prev) => {
      const tab = { ...(prev[tabIdAtStart] || {}) };
      for (const [id, data] of Object.entries(out)) tab[id] = data;
      return { ...prev, [tabIdAtStart]: tab };
    });
    setProofreading(false);
    if (autoFixCount > 0) {
      setStatus(`문법 자동 수정 ${autoFixCount}건`);
      setTimeout(() => setStatus(''), 2000);
    }
  }, [proofreading, allBlocks, activeTab, callProofreadApi, applyDeterministicAutoFix, AUTOFIX_EXCLUDED_TYPES, API_EXCLUDED_TYPES]);

  const handleRetryProofreadBlock = useCallback(async (blockId: string) => {
    const block = (allBlocks[activeTab] || []).find((b) => b.id === blockId);
    if (!block) return;
    const tabIdAtStart = activeTab;

    const { targets, autoFixCount } = applyDeterministicAutoFix([
      { id: block.id, raw_text: block.raw_text, type: block.type },
    ]);

    setProofreadResults((prev) => ({
      ...prev,
      [tabIdAtStart]: {
        ...(prev[tabIdAtStart] || {}),
        [blockId]: { status: 'loading', issues: [], timestamp: Date.now() },
      },
    }));

    const out = await callProofreadApi(targets);
    setProofreadResults((prev) => ({
      ...prev,
      [tabIdAtStart]: { ...(prev[tabIdAtStart] || {}), [blockId]: out[blockId] },
    }));
    if (autoFixCount > 0) {
      setStatus(`문법 자동 수정 ${autoFixCount}건`);
      setTimeout(() => setStatus(''), 2000);
    }
  }, [allBlocks, activeTab, callProofreadApi, applyDeterministicAutoFix]);

  const handleDismissProofreadIssue = useCallback((blockId: string, issueIndex: number) => {
    setProofreadResults((prev) => {
      const tab = prev[activeTab];
      const data = tab?.[blockId];
      if (!data || data.status !== 'ok') return prev;
      const remaining = data.issues.filter((_, i) => i !== issueIndex);
      const nextTab = { ...tab };
      if (remaining.length === 0) delete nextTab[blockId];
      else nextTab[blockId] = { ...data, issues: remaining };
      return { ...prev, [activeTab]: nextTab };
    });
  }, [activeTab]);

  const handleAutoFixProofreadIssue = useCallback((blockId: string, issueIndex: number) => {
    const tab = activeTab;
    const data = proofreadResults[tab]?.[blockId];
    if (!data || data.status !== 'ok') return;
    const issue = data.issues[issueIndex];
    if (!issue) return;

    const editor = editorRefs.current[blockId];
    const currentText = editor
      ? editor.getContent()
      : (allBlocks[tab] || []).find((b) => b.id === blockId)?.raw_text ?? '';

    const idx = currentText.indexOf(issue.original);
    if (idx === -1) {
      // 본문에 더 이상 일치 없음 → 해당 항목만 제거
      setProofreadResults((prev) => {
        const t = prev[tab];
        const d = t?.[blockId];
        if (!d || d.status !== 'ok') return prev;
        const remaining = d.issues.filter((_, i) => i !== issueIndex);
        const nextTab = { ...t };
        if (remaining.length === 0) delete nextTab[blockId];
        else nextTab[blockId] = { ...d, issues: remaining };
        return { ...prev, [tab]: nextTab };
      });
      return;
    }

    const newText =
      currentText.slice(0, idx) + issue.suggestion + currentText.slice(idx + issue.original.length);

    autoFixInProgressRef.current = true;
    try {
      if (editor) editor.setContent(newText);
    } finally {
      // setContent → onChange(handleBlockChange) 는 동기이므로 즉시 해제 안전
      autoFixInProgressRef.current = false;
    }
    // 상태 동기화 (onChange가 발화하지 않는 경로 대비)
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, raw_text: newText } : b))
    );
    // 해당 항목 제거 (동일 suggestion이 남아 있을 수 있으므로 보수적으로 index 기준)
    setProofreadResults((prev) => {
      const t = prev[tab];
      const d = t?.[blockId];
      if (!d || d.status !== 'ok') return prev;
      const remaining = d.issues.filter((_, i) => i !== issueIndex);
      const nextTab = { ...t };
      if (remaining.length === 0) delete nextTab[blockId];
      else nextTab[blockId] = { ...d, issues: remaining };
      return { ...prev, [tab]: nextTab };
    });
  }, [activeTab, proofreadResults, allBlocks, setCurrentBlocks]);

  const handleDismissProofreadBox = useCallback((blockId: string) => {
    setProofreadResults((prev) => {
      const tab = prev[activeTab];
      if (!tab || !tab[blockId]) return prev;
      const nextTab = { ...tab };
      delete nextTab[blockId];
      return { ...prev, [activeTab]: nextTab };
    });
  }, [activeTab]);

  /* ─── 수식행 분할 ($$..$$ 를 \\ 단위로 분리) ─── */
  /**
   * 개선묶음 M1 — 결과는 **들여쓰기(callout) 블록 1개**이고 행마다 `$…$` 한 줄, 행 사이는 빈 줄이다.
   *
   * ⚠ 소스에는 빈 줄을 넣지 않는다. 대신 `insertMarkerLineBreaks`가 **연속된 수식 전용 행** 사이에
   *   렌더 시 빈 줄을 넣는다 — 그것이 없으면 `remark-breaks` 부재로 세 행이 한 문단으로 합쳐진다.
   *   들여쓰기 블록의 `p { margin: 0 }`이 그 문단들을 "행간만"으로 그려 주고,
   *   행 꼬리의 `\tag{n}`은 `.tag-marker`가 우단에 붙인다 — 이 블록이 원래 그 용도로 만들어졌다.
   *
   * ⚠ **자기 타입 변경(`before`가 비었을 때 X를 callout으로)은 `text`·`callout`에만** 한다(D3‴).
   *   `case`/`subcase`의 타입이 사라지면 rail·자동 번호(`buildCaseLabels`)가 바뀐다.
   *
   * ⚠ 블록 구조를 바꾸므로 `pushUndo()`가 필요하다 — 예전 판은 이것이 없어 Undo로 되돌릴 수 없었다.
   */
  const handleSplitMathLines = useCallback((blockId?: string) => {
    const targetId = blockId || activeBlockId;
    if (!targetId) return;
    const editor = editorRefs.current[targetId];
    if (!editor) return;
    const target = currentBlocks.find((b) => b.id === targetId);
    if (!target) return;

    const content = editor.getContent();
    const cursor = editor.getCursorPosition();
    const result = splitDisplayMathToRows(content, cursor);
    if (result.ok !== true) {
      setStatus(result.reason);
      setTimeout(() => setStatus(''), 2000);   // 다른 호출부와 같은 리셋
      return;
    }

    pushUndo();

    // 소스는 붙여 쓴다(덕수 요청). 렌더의 행 분리는 insertMarkerLineBreaks가 공급한다
    const rowsRaw = result.rows.join('\n');
    const beforeText = result.before.replace(/\s+$/, '');
    const afterText = result.after.replace(/^\s+/, '');
    const selfConvert = !beforeText && (target.type === 'text' || target.type === 'callout');

    const calloutId = `new-${Date.now()}`;
    const tailId = `new-${Date.now() + 1}`;

    setCurrentBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === targetId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const inserted: LocalBlock[] = [];

      if (selfConvert) {
        updated[idx] = { ...updated[idx], type: 'callout', raw_text: rowsRaw };
      } else {
        updated[idx] = { ...updated[idx], raw_text: beforeText };
        inserted.push({
          id: calloutId,
          block_key: nanoid(),               // 파생 블록은 새 키 (원본은 키 유지) — Phase55 F9
          order: target.order + 1,
          type: 'callout',
          raw_text: rowsRaw,
          title: '',
          collapsed: false,
          isNew: true,
        });
      }
      if (afterText) {
        inserted.push({
          id: tailId,
          block_key: nanoid(),
          order: target.order + 2,
          type: 'text',
          raw_text: afterText,
          title: '',
          collapsed: false,
          isNew: true,
        });
      }
      if (inserted.length > 0) updated.splice(idx + 1, 0, ...inserted);
      return updated;
    });

    // X가 그대로 남는 경우에만 CodeMirror 내용을 갱신한다(새 블록은 새로 마운트된다)
    editor.setContent(selfConvert ? rowsRaw : beforeText);

    const focusId = selfConvert ? targetId : calloutId;
    setActiveBlockId(focusId);
    setTimeout(() => { editorRefs.current[focusId]?.focus(); }, 50);
  }, [activeBlockId, currentBlocks, setCurrentBlocks, pushUndo]);

  /* ─── 블록 조작 핸들러 ─── */
  const handleBlockChange = useCallback((blockId: string, value: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, raw_text: value } : b))
    );
    if (autoFixInProgressRef.current) return;
    // 교정 항목 자동 닫힘 규칙:
    //   "original 부재 AND suggestion 존재" 일 때만 해당 항목 제거.
    //   - original만 검사하면 편집 중간 상태(삭제 직후)나 인접 항목 컨텍스트 공유로 오삭제 발생
    //   - suggestion 추가 검사로 "수정이 실제로 완성된 시점"만 포착
    setProofreadResults((prev) => {
      const tab = prev[activeTab];
      const data = tab?.[blockId];
      if (!data || data.status !== 'ok') return prev;
      const remaining = data.issues.filter((iss) => {
        if (!iss.suggestion || iss.suggestion === iss.original) return true;
        const fixed = !value.includes(iss.original) && value.includes(iss.suggestion);
        return !fixed;
      });
      if (remaining.length === data.issues.length) return prev;
      const nextTab = { ...tab };
      if (remaining.length === 0) delete nextTab[blockId];
      else nextTab[blockId] = { ...data, issues: remaining };
      return { ...prev, [activeTab]: nextTab };
    });
  }, [setCurrentBlocks, activeTab]);

  const handleBlockTypeChange = useCallback((blockId: string, type: Block['type']) => {
    const _cur = currentBlocks.find((b) => b.id === blockId);
    if (_cur && _cur.type !== type) pushUndo();   // C3: 실제 타입 변경일 때만
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
        } else if (type === 'svg' && b.type !== 'svg') {
          raw_text = '';
        } else if (type === 'ggb' && b.type !== 'ggb') {
          raw_text = '';
        } else if (type === 'heading' && b.type !== 'heading' && TEXT_BASED_TYPES.has(b.type)) {
          // 텍스트 계열 → 제목: 첫 줄 맨 앞에 '## ' 자동 부착 (이미 #/## 헤더이면 유지)
          const trimmedStart = raw_text.trimStart();
          if (trimmedStart === '') {
            raw_text = '## ';
          } else if (!/^#{1,6}\s/.test(trimmedStart)) {
            raw_text = '## ' + raw_text;
          }
          // 텍스트→텍스트 전환은 MarkdownEditor가 재마운트되지 않으므로
          // 이미 마운트된 CodeMirror 뷰를 직접 갱신
          if (raw_text !== b.raw_text) {
            const finalText = raw_text;
            queueMicrotask(() => {
              editorRefs.current[blockId]?.setContent(finalText);
            });
          }
        } else if (type !== b.type && !raw_text.trim() && BLOCK_PRESETS[type]) {
          // Phase 57 D9: 내용이 빈 블록을 다른 타입으로 바꾸면 그 타입의 프리셋을 넣어준다.
          // (기존 1518 분기는 소스가 "비텍스트"일 때만 적용해서, 빈 텍스트 → 목록/(가) 전환 시
          //  빈 블록이 나오는 불편이 있었다.) 내용이 빌 때만이라 데이터 손실 불가.
          raw_text = BLOCK_PRESETS[type];
          // 텍스트→텍스트 전환은 MarkdownEditor가 재마운트되지 않으므로 CM 뷰를 직접 갱신
          // (heading 전환 1502-1517에서 검증된 패턴)
          const finalText = raw_text;
          queueMicrotask(() => {
            editorRefs.current[blockId]?.setContent(finalText);
          });
        } else if (type !== b.type && BLOCK_PRESETS[type] !== undefined && !TEXT_BASED_TYPES.has(b.type)) {
          // 이미지→텍스트 계열 전환 시 프리셋 적용
          raw_text = BLOCK_PRESETS[type];
        }

        return { ...b, type, raw_text };
      })
    );
  }, [setCurrentBlocks, currentBlocks, pushUndo]);

  const handleBlockTitleChange = useCallback((blockId: string, title: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, title } : b))
    );
  }, [setCurrentBlocks]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (currentBlocks.length <= 1) return;   // C3: 마지막 블록은 삭제 안 함(no-op)
    pushUndo();

    /* Phase 45a D1 — 부수효과는 전부 updater 밖에서. updater 안에서 setState·ref를
       건드리면 StrictMode 이중 실행에서 안전성을 따져야 하는데, currentBlocks가
       이미 스코프에 있으므로(위 가드가 그것을 읽는다) 들어갈 이유가 없다. */
    const idx = currentBlocks.findIndex((b) => b.id === blockId);
    if (idx !== -1 && activeBlockId === blockId) {
      // 삭제 자리를 이어받는 블록(다음 → 없으면 이전). 첫 블록으로 튀지 않는다.
      const nextId = currentBlocks[idx + 1]?.id ?? currentBlocks[idx - 1]?.id ?? null;
      skipNextBlockScrollRef.current = true;   // D2: 삭제는 시야를 움직이지 않는다
      setActiveBlockId(nextId);
    }
    // stale id가 남으면 handleDragEnd의 size>1 묶음 판정이 어긋난다
    setSelectedBlockIds((prev) => {
      if (!prev.has(blockId)) return prev;
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });

    setCurrentBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }, [setCurrentBlocks, activeBlockId, currentBlocks, pushUndo]);

  const handleAddBlock = useCallback((type: Block['type'] = 'text') => {
    pushUndo();   // Phase 55a: 구조 조작 직전 (no-op 없음)
    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      block_key: nanoid(),
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
  }, [activeBlockId, setCurrentBlocks, pushUndo]);

  /** 이미지 크기 변경 */
  const handleImageWidthChange = useCallback((blockId: string, width: number) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, imageWidth: width } : b))
    );
  }, [setCurrentBlocks]);

  /** 이미지 액자 토글 — undefined(기본 blend) ↔ 'frame' */
  const handleImageTreatmentChange = useCallback((blockId: string, treatment: 'frame' | undefined) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, imageTreatment: treatment } : b))
    );
  }, [setCurrentBlocks]);

  /** 이미지 컬러 유지 토글 — undefined(기본 흑백) ↔ false(컬러) */
  const handleImageGrayChange = useCallback((blockId: string, gray: boolean | undefined) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, imageGray: gray } : b))
    );
  }, [setCurrentBlocks]);

  /** Phase 59: 요약에 넣기 토글 — undefined(숨김) ↔ true.
   *  블록 종류를 가리지 않는다(그림·표를 담은 텍스트·글상자 …). */
  const handleSummaryChange = useCallback((blockId: string, show: boolean | undefined) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, showInSummary: show } : b))
    );
  }, [setCurrentBlocks]);

  const handleSplitBlock = useCallback(() => {
    if (!activeBlockId) return;
    const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
    if (!activeBlock || !SPLITTABLE_TYPES.has(activeBlock.type)) return;

    const ref = editorRefs.current[activeBlockId];
    if (!ref) return;

    pushUndo();   // C3: 모든 가드 통과 후 분할(mutate) 직전

    const cursor = ref.getCursorPosition();
    const content = ref.getContent();

    const before = content.slice(0, cursor);
    const after = content.slice(cursor);

    // 원본 블록의 CodeMirror 내용을 즉시 갱신 (before만 남김).
    // 커서가 끝이면 내용이 그대로이므로 불필요한 문서 전체 교체를 건너뛴다.
    if (before !== content) ref.setContent(before);

    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      block_key: nanoid(),                 // 분할로 파생된 블록은 새 키 (원본은 키 유지) — Phase55 F9
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
  }, [activeBlockId, currentBlocks, setCurrentBlocks, pushUndo]);

  /* ─── 미디어 업로드 (image | svg) ─── */
  const handleBlockMediaUpload = useCallback(async (file: File, kind: ImageMediaKind, blockId: string) => {
    const pid = problemId || `temp-${Date.now()}`;
    try {
      if (kind === 'svg') {
        const url = await uploadSvg(file, pid);
        pushUndo();   // C3: 업로드 성공 후, 블록 변경 직전
        setCurrentBlocks((prev) =>
          prev.map((b) => (b.id === blockId
            ? { ...b, type: 'svg', raw_text: url, svg_initial_view: null }
            : b))
        );
      } else if (kind === 'ggb') {
        const url = await uploadGgb(file, pid);
        pushUndo();
        setCurrentBlocks((prev) =>
          prev.map((b) => (b.id === blockId
            ? { ...b, type: 'ggb', raw_text: url, ggb_initial_coords: null }
            : b))
        );
      } else {
        const url = await uploadImage(file, pid);
        const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;
        pushUndo();
        setCurrentBlocks((prev) =>
          prev.map((b) => (b.id === blockId
            ? { ...b, type: 'image', raw_text: markdownImage }
            : b))
        );
      }
    } catch (err: any) {
      console.error('[MediaUpload] 에러:', err);
      throw err;
    }
  }, [problemId, setCurrentBlocks, pushUndo]);

  /* ─── AI 그래프 → 블록 저장 (Phase 42) ─── */
  // 토론창 GgbGraphView의 💾 저장 → 업로드 후 현재 활성 탭 블록 목록 맨 끝에 append.
  // 반환값(탭 이름)은 GgbGraphView 토스트에 표기. 영구 저장은 기존 문제 저장 버튼 흐름.
  const handleInsertGraphBlock = useCallback(async (
    { format, file, view }: GraphBlockSave,
  ): Promise<string> => {
    const pid = problemId || `temp-${Date.now()}`;
    const newBlock: LocalBlock = {
      id: `new-${Date.now()}`,
      block_key: nanoid(),
      order: 0,
      type: 'text',
      raw_text: '',
      title: '',
      collapsed: false,
      isNew: true,
    };
    if (format === 'ggb') {
      const url = await uploadGgb(file, pid);
      newBlock.type = 'ggb';
      newBlock.raw_text = url;
      // 저장 시점에 사용자가 보던 시야를 초기뷰로 이관
      newBlock.ggb_initial_coords = view ?? null;
      newBlock.ggb_height = GGB_BLOCK_HEIGHT;
    } else if (format === 'svg') {
      const url = await uploadSvg(file, pid);
      newBlock.type = 'svg';
      newBlock.raw_text = url;
      newBlock.svg_initial_view = null;
    } else {
      const url = await uploadImage(file, pid);
      newBlock.type = 'image';
      newBlock.raw_text = `<img src="${url}" alt="AI 그래프" width="400" />`;
    }
    pushUndo();   // C3: 업로드 성공 후, 블록 추가 직전
    setCurrentBlocks((prev) => [...prev, newBlock]);
    return tabs.find((t) => t.id === activeTab)?.label || activeTab;
  }, [problemId, setCurrentBlocks, tabs, activeTab, pushUndo]);

  /* ─── SVG 초기뷰 저장 ─── */
  const handleSaveSvgInitialView = useCallback(
    (blockId: string, view: { scale: number; positionX: number; positionY: number }) => {
      setCurrentBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, svg_initial_view: view } : b))
      );
    },
    [setCurrentBlocks]
  );

  const handleSvgHeightChange = useCallback((blockId: string, height: number) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, svg_height: height } : b))
    );
  }, [setCurrentBlocks]);

  /* ─── GGB 초기뷰 저장 ─── */
  const handleSaveGgbInitialView = useCallback(
    (blockId: string, coords: { xMin: number; xMax: number; yMin: number; yMax: number }) => {
      setCurrentBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, ggb_initial_coords: coords } : b))
      );
    },
    [setCurrentBlocks]
  );

  const handleGgbHeightChange = useCallback((blockId: string, height: number) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ggb_height: height } : b))
    );
  }, [setCurrentBlocks]);

  /* ─── Phase 58 P3 — 핵심문장(`**…**`) 토글 ───
     경계 규칙은 MarkdownEditor.toggleKeyWrap이 갖고 있다(공백 정돈·`\tag` 제외·
     문단 제약·수식 경계 가드). 여기서는 활성 블록의 에디터로 넘기고,
     거부되면 버튼을 흔들어 조용히 실패하지 않게 한다. */
  const [keyToggleRejected, setKeyToggleRejected] = useState(false);
  const handleToggleKey = useCallback(() => {
    if (!activeBlockId) return;
    const editor = editorRefs.current[activeBlockId];
    if (!editor) return;
    const result = editor.toggleKeyWrap();
    if (result === 'rejected') {
      setKeyToggleRejected(false);
      // 다음 프레임에 다시 켜야 같은 거부가 연속될 때도 애니메이션이 재생된다
      requestAnimationFrame(() => setKeyToggleRejected(true));
      setTimeout(() => setKeyToggleRejected(false), 400);
    }
  }, [activeBlockId]);

  /* ─── 전체 접기 / 펼치기 토글 ─── */
  const handleToggleCollapseAll = useCallback(() => {
    setCollapseMode((on) => {
      const next = !on;
      setCurrentBlocks((prev) => prev.map((b) => ({ ...b, collapsed: next })));
      // D5-c: 켤 때도 초기화 — 이전 모드에서 남은 선택이 따라 들어오면 안 된다
      setSelectedBlockIds(new Set());
      return next;
    });
  }, [setCurrentBlocks]);

  /* ─── 개별 블록 접기/펼치기 (상단바 더블클릭) ─── */
  const handleToggleBlockCollapse = useCallback((blockId: string) => {
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, collapsed: !b.collapsed } : b))
    );
  }, [setCurrentBlocks]);

  // 블록 활성화 시 스크롤 지속 시간 (수식/검색 220ms 대비 길게 — 타자 흐름 방해 최소화)
  const BLOCK_SCROLL_MS = 450;
  // 다음 useEffect[activeBlockId]의 기본 스크롤을 1회 스킵 (핸들러가 직접 처리한 경우)
  const skipNextBlockScrollRef = useRef<boolean>(false);

  /* ─── 미리보기: 블록 상단을 미리보기 상단 ~80px 아래로 스크롤 (상단바 클릭용) ─── */
  const scrollPreviewToBlockTop = useCallback((blockId: string) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        const container = previewRef.current;
        if (!container) return;
        const blockPreview = container.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        if (!blockPreview) return;
        const containerRect = container.getBoundingClientRect();
        const targetRect = blockPreview.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + container.scrollTop;
        const target = offset - 80;
        fastScrollTo(container, target, BLOCK_SCROLL_MS);
      });
    }, 50);
  }, []);

  /* ─── 편집창: 블록 상단을 편집창 상단 ~80px 아래로 스크롤 (상단바 클릭용) ─── */
  const scrollEditorToBlockTop = useCallback((blockId: string) => {
    setTimeout(() => {
      const container = editorPanelRef.current;
      if (!container) return;
      const blockEl = container.querySelector(`[data-editor-block-id="${blockId}"]`) as HTMLElement | null;
      if (!blockEl) return;
      const containerRect = container.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();
      const blockTop = blockRect.top - containerRect.top + container.scrollTop;
      fastScrollTo(container, blockTop - 80, BLOCK_SCROLL_MS);
    }, 50);
  }, []);

  /* ─── 편집창: 커서 라인을 편집창 세로 중앙으로 스크롤 (콘텐츠 클릭용)
        — 단, 활성 블록 상단이 가려지지 않도록 computeBlockAwareScrollTop 로 클램프 ─── */
  const scrollEditorToCursorCenter = useCallback((blockId: string) => {
    setTimeout(() => {
      const ref = editorRefs.current[blockId];
      const container = editorPanelRef.current;
      if (!ref || !container) return;
      const coords = ref.getCursorCoords();
      const blockEl = container.querySelector(`[data-editor-block-id="${blockId}"]`) as HTMLElement | null;
      if (!coords || !blockEl) return;
      const target = computeBlockAwareScrollTop(container, blockEl, coords.top);
      fastScrollTo(container, target, BLOCK_SCROLL_MS);
    }, 50);
  }, []);

  /* ─── 미리보기: 블록을 미리보기 세로 중앙으로 스크롤 (콘텐츠 클릭용)
        — 정확한 행 매핑이 없으므로 블록 단위 중앙 정렬 ─── */
  const scrollPreviewToBlockCenter = useCallback((blockId: string) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        const container = previewRef.current;
        if (!container) return;
        const blockPreview = container.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        if (!blockPreview) return;
        const containerRect = container.getBoundingClientRect();
        const targetRect = blockPreview.getBoundingClientRect();
        const blockCenter = targetRect.top - containerRect.top + container.scrollTop + targetRect.height / 2;
        fastScrollTo(container, blockCenter - containerRect.height / 2, BLOCK_SCROLL_MS);
      });
    }, 50);
  }, []);

  /* ─── 편집창: 클릭한 수식을 세로 중앙으로 (D5‴ — 미리보기와 대칭)
        일반 자동 스크롤과 달리 computeMathCenterScrollTop 을 쓴다.
        사유: 양쪽 패널이 "같은 수식을 같은 높이"에 두는 것이 목적이므로,
        블록이 패널보다 클 때는 상단 클램프를 포기해야 대칭이 성립한다. ─── */
  const scrollEditorToMathCenter = useCallback((blockId: string) => {
    setTimeout(() => {
      const ref = editorRefs.current[blockId];
      const container = editorPanelRef.current;
      if (!ref || !container) return;
      const coords = ref.getCursorCoords();
      const blockEl = container.querySelector(`[data-editor-block-id="${blockId}"]`) as HTMLElement | null;
      if (!coords || !blockEl) return;
      const target = computeMathCenterScrollTop(
        container.getBoundingClientRect(), container.scrollTop,
        blockEl.getBoundingClientRect(), coords.top,
      );
      fastScrollTo(container, target, BLOCK_SCROLL_MS);
    }, 50);
  }, []);

  /* ─── 미리보기: 클릭한 수식을 세로 중앙으로 (D5‴ — 편집창과 동일 규칙) ─── */
  const scrollPreviewToMathCenter = useCallback((blockId: string, mathId: number) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        const container = previewRef.current;
        if (!container) return;
        const blockPreview = container.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        if (!blockPreview) return;
        const mathEl = blockPreview.querySelector(`.katex[data-math-id="${mathId}"]`) as HTMLElement | null;
        if (!mathEl && process.env.NODE_ENV !== 'production') {
          // 폴백이 상시 발동하면 기능이 조용히 죽으므로 개발 중엔 알린다 (v2 R9)
          console.warn('[Phase56] 미리보기에서 수식 요소를 찾지 못해 블록 중앙으로 폴백:', { blockId, mathId });
        }
        const targetEl = mathEl ?? blockPreview;
        const targetRect = targetEl.getBoundingClientRect();
        const target = computeMathCenterScrollTop(
          container.getBoundingClientRect(), container.scrollTop,
          blockPreview.getBoundingClientRect(),
          targetRect.top + targetRect.height / 2,   // 수식의 세로 중심을 기준점으로
        );
        fastScrollTo(container, target, BLOCK_SCROLL_MS);
      });
    }, 50);
  }, []);

  /* ─── typewriter 스크롤 (D8‴): 타자 중 커서가 패널 하단에 닿으면 위쪽으로 재정렬 ───
        발화선(하단 80px)과 착지선(패널 높이의 45%)을 다르게 둔다(히스테리시스).
        같게 두면 재정렬 결과가 곧 발화 조건이 되어 매 키입력마다 재발화한다.
        computeBlockAwareScrollTop 을 쓰지 않는 이유: 블록이 패널보다 길면
        caretVisibleMin 이 이겨 커서가 하단 60px에 눌어붙어 중앙 정렬이 되지 않는다.
        타자 중에는 블록 상단 가시성이 요구사항이 아니므로 순수 비율 정렬이 맞다. ─── */
  const maybeRecenterOnBottomTyping = useCallback((blockId: string) => {
    requestAnimationFrame(() => {   // CM 자체의 최소 가시화 스크롤이 반영된 뒤 측정
      const ref = editorRefs.current[blockId];
      const container = editorPanelRef.current;
      if (!ref || !container) return;
      if (!ref.hasFocus()) return;      // 사용자 타이핑에만 적용 (프로그램적 문서 변경 제외)
      if (ref.isComposing()) return;    // 한글 IME 조합 중 스크롤은 조합을 깨뜨린다 (dad2588)
      const coords = ref.getCursorCoords();
      if (!coords) return;
      const rect = container.getBoundingClientRect();
      if (coords.top < rect.bottom - TYPING_TRIGGER_MARGIN) return;
      const cursorRel = coords.top - rect.top + container.scrollTop;
      fastScrollTo(container, cursorRel - rect.height * TYPING_LANDING_RATIO, 260);
    });
  }, []);

  /* ─── 상단바 클릭: 단일 선택(활성화) + 범위 선택 앵커 지정 ─── */
  const handleSelectBlockBar = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    setActiveMathId(-1);   // D16: handleBlockFocus를 거치지 않는 경로 — stale 강조 제거
    setSelectedBlockIds(new Set());
    selectionAnchorRef.current = blockId;   // D5-a
    /* Phase 45a D4 — 전체접기 모드에서는 시야를 고정한다. 자동 스크롤 effect는
       collapseMode를 보고 멈추지만 아래 두 줄은 직접 호출이라 가드를 우회했고,
       그래서 바를 누를 때마다 목록이 튀었다. skipNext 세팅도 같은 게이트 안에
       둔다 — 밖에 두면 소비되지 않은 플래그가 남는다. */
    if (collapseModeRef.current) return;
    skipNextBlockScrollRef.current = true;
    scrollEditorToBlockTop(blockId);
    scrollPreviewToBlockTop(blockId);
  }, [scrollEditorToBlockTop, scrollPreviewToBlockTop]);

  /* ─── Alt+클릭: 개별 토글(비연속 선택) ─── */
  const handleToggleSelectBlock = useCallback((blockId: string) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  /* ─── Shift+클릭: 앵커~대상 연속 구간으로 선택집합 교체 (Phase 45a D5-b) ───
        activeBlockId는 건드리지 않는다 — handleDragEnd의 묶음 판정(1962)은
        '드래그한 블록'이 선택집합에 있는지만 보므로 활성 블록과 무관하고,
        활성을 옮기면 불필요한 스크롤·리렌더가 따라온다. */
  const handleRangeSelectBlock = useCallback((blockId: string) => {
    const ids = currentBlocks.map((b) => b.id);
    const to = ids.indexOf(blockId);
    if (to === -1) return;
    const from = selectionAnchorRef.current ? ids.indexOf(selectionAnchorRef.current) : -1;
    if (from === -1) {
      // 앵커 소실(삭제·탭 전환·undo) → 대상 1개만 선택하고 새 앵커로
      setSelectedBlockIds(new Set([blockId]));
      selectionAnchorRef.current = blockId;
      return;
    }
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    // 앵커는 유지 — 같은 앵커로 범위를 넓혔다 좁혔다 할 수 있어야 한다
    setSelectedBlockIds(new Set(ids.slice(lo, hi + 1)));
  }, [currentBlocks]);

  /* ─── DnD ─── */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // C3: 실제 이동 여부 사전 판정(제자리·묶음 내부 드롭 no-op) → 이동일 때만 push
    {
      const isGroupMove = selectedBlockIds.size > 1 && selectedBlockIds.has(activeId);
      const movingSet = new Set(isGroupMove
        ? currentBlocks.filter((b) => selectedBlockIds.has(b.id)).map((b) => b.id)
        : [activeId]);
      const noMove = (isGroupMove && movingSet.has(overId)) || (!isGroupMove && activeId === overId);
      if (!noMove) pushUndo();
    }

    setCurrentBlocks((prev) => {
      // 다중선택 묶음 이동: 드래그한 블록이 선택집합에 포함되고 2개 이상일 때
      const isGroupMove = selectedBlockIds.size > 1 && selectedBlockIds.has(activeId);
      const movingIds = isGroupMove
        ? prev.filter((b) => selectedBlockIds.has(b.id)).map((b) => b.id) // 문서 순서 유지
        : [activeId];
      const movingSet = new Set(movingIds);

      // 묶음 내부로 드롭하면 무시
      if (movingSet.has(overId) && isGroupMove) return prev;
      if (!isGroupMove && activeId === overId) return prev;

      const activeIdx = prev.findIndex((b) => b.id === activeId);
      const overIdx = prev.findIndex((b) => b.id === overId);
      if (activeIdx === -1 || overIdx === -1) return prev;

      const movingBlocks = prev.filter((b) => movingSet.has(b.id));
      const remaining = prev.filter((b) => !movingSet.has(b.id));
      const overIdxInRemaining = remaining.findIndex((b) => b.id === overId);
      if (overIdxInRemaining === -1) return prev;
      // 아래로 이동이면 over 뒤에, 위로 이동이면 over 앞에 삽입
      const insertAt = activeIdx < overIdx ? overIdxInRemaining + 1 : overIdxInRemaining;
      remaining.splice(insertAt, 0, ...movingBlocks);
      return remaining;
    });
  }, [setCurrentBlocks, selectedBlockIds, currentBlocks, pushUndo]);

  /* ─── MathToolbar ─── */
  const handleInsert = (template: string, cursorOffset: number) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]?.insertText(template, cursorOffset);
    }
  };

  /* ─── Phase 61c: agent 대화 선택 영역 → 활성 블록에 삽입 ─── */
  const handleInsertFromChat = useCallback((text: string): 'inserted' | 'no-target' => {
    const ref = activeBlockId ? editorRefs.current[activeBlockId] : null;
    /* ref가 없는 경우 = 활성 블록 없음 · 접힌 블록(MarkdownEditor 언마운트) ·
       미디어 블록(image·svg·ggb는 MediaBlockContent라 ref를 등록하지 않는다) */
    if (!ref) return 'no-target';
    /* ⚠ insertText가 아니라 insertPlainText다 — 그쪽은 `{}` 탭스톱을 무장하는 툴바 규약이고
       AI 대화문에는 `x^{}`가 실제로 섞인다. 이후 경로(onChange → dirty → CM undo 1스텝)는 동일. */
    ref.insertPlainText(text);
    return 'inserted';
  }, [activeBlockId]);

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

  /* ─── OCR (Phase 28) ─── */
  const handleOcrClick = () => {
    if (!activeBlockId) return;
    const activeBlock = currentBlocks.find((b) => b.id === activeBlockId);
    if (!activeBlock || !TEXT_BASED_TYPES.has(activeBlock.type)) return;
    ocrInputRef.current?.click();
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;

    const err = validateOcrFile(file);
    if (err) { alert(err); return; }

    if (!activeBlockId || !editorRefs.current[activeBlockId]) {
      alert('먼저 편집할 블록을 선택해 주세요.');
      return;
    }

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
      // 커서 위치에 \n + 결과 + \n 삽입, 커서는 삽입 끝으로 이동
      const payload = `\n${normalized}\n`;
      editorRefs.current[activeBlockId]?.insertText(payload, payload.length);
    } catch (e: any) {
      alert(`OCR 처리 중 오류: ${e?.message || e}`);
    } finally {
      setOcrLoading(false);
    }
  };

  /* ─── 커서 활동 → 수식 하이라이트(시각용)만. 미리보기 동기화는 onFocus에서 처리 ─── */
  const handleCursorActivity = useCallback((info: CursorActivityInfo) => {
    const ref = editorRefs.current[info.blockId];
    if (!ref) return;
    /* D3': 선택만 바꾸는 "비포커스" dispatch는 무시한다.
       블록 전환 effect가 이전 블록에 거는 clearSelection()이 selectionSet를 발생시켜
       activeMathId를 -1로 덮어써 cross-block 수식 강조가 즉시 풀리던 것이 버그2-2의 원인.
       문서를 바꾼 프로그램적 변경(교정 자동수정·블록 분할 등)은 통과시켜야 하므로
       docChanged는 예외로 둔다. */
    if (!ref.hasFocus() && !info.docChanged) return;
    const content = ref.getContent();
    const ranges = buildMathIndex(content);
    const mathId = findMathIdAtCursor(ranges, info.offset);
    /* D11: mousedown 시점엔 activeBlockId가 아직 이전 블록이므로, 여기서 무조건
       setActiveMathId 하면 이전 블록 미리보기가 한 프레임 엉뚱한 수식을 칠한다.
       cross-block 설정은 handleBlockFocus(D4)가 책임진다. */
    if (info.blockId === activeBlockId) {
      setActiveMathId(mathId);
      setCursorInMath(isInsideMath(content, info.offset));
      /* D5‴·D7: 같은 블록 안에서 마우스로 수식을 "클릭 완료"했을 때만 양쪽 중앙 정렬.
         화살표 키 이동으로도, 드래그로 범위를 잡는 중에도 발동하지 않는다
         (pointerSelect는 mouseup + 빈 선택일 때만 true — D17). */
      if (info.pointerSelect && mathId >= 0) {
        scrollEditorToMathCenter(info.blockId);
        scrollPreviewToMathCenter(info.blockId, mathId);
      }
    }
    // D8‴: 타자로 커서가 하단에 닿으면 세로 위치 자동 조정
    if (info.docChanged) maybeRecenterOnBottomTyping(info.blockId);
  }, [activeBlockId, scrollEditorToMathCenter, scrollPreviewToMathCenter,
      maybeRecenterOnBottomTyping]);

  /* ─── 블록 포커스 진입 (콘텐츠 클릭): 커서 라인 / 블록을 양쪽 패널 세로 중앙으로 ─── */
  const handleBlockFocus = useCallback((blockId: string) => {
    const ref = editorRefs.current[blockId];
    if (blockId !== activeBlockId) {
      skipNextBlockScrollRef.current = true;
      setActiveBlockId(blockId);
      /* D4: cross-block 수식 강조는 여기서 명시적으로 설정한다.
         click은 mouseup 이후이므로 커서는 이미 클릭 위치로 이동해 있다. */
      const mathId = ref
        ? findMathIdAtCursor(buildMathIndex(ref.getContent()), ref.getCursorPosition())
        : -1;
      setActiveMathId(mathId);
      /* D17: 드래그로 범위를 잡고 끝난 경우엔 스크롤하지 않는다.
         click은 mouseup 뒤에 오므로 드래그 종료 시에도 여기 도달하는데,
         방금 잡은 선택 영역이 화면에서 움직이면 오히려 방해가 된다. */
      if (ref && !ref.isSelectionEmpty()) {
        // 활성화·강조만 반영하고 뷰는 그대로 둔다
      } else if (mathId >= 0) {
        // D5‴: 다른 블록의 수식을 클릭한 경우도 양쪽 수식 중앙 정렬
        scrollEditorToMathCenter(blockId);
        scrollPreviewToMathCenter(blockId, mathId);
      } else {
        // D6: 비수식 클릭은 기존 동작 유지 (커서 중앙 + 블록 중앙)
        scrollEditorToCursorCenter(blockId);
        scrollPreviewToBlockCenter(blockId);
      }
    }
    // Phase 25 Step 1: 포커스 진입 시 즉시 수식 안/밖 갱신
    if (ref) {
      setCursorInMath(isInsideMath(ref.getContent(), ref.getCursorPosition()));
    }
  }, [activeBlockId, scrollEditorToCursorCenter, scrollPreviewToBlockCenter,
      scrollEditorToMathCenter, scrollPreviewToMathCenter]);

  /* ─── 찾기/바꾸기 매치 이동 → 활성 블록·수식 강조 동기화 (D15) ───
        검색 입력창이 포커스를 갖고 있어 setSelection이 유발하는 cursorActivity는
        D3' 게이트에 막힌다. FindReplacePanel이 이미 blockId·offset을 알고 있으므로
        여기서 직접 반영해 미리보기 강조가 매치를 따라오게 한다. ─── */
  const handleSearchNavigate = useCallback((blockId: string, offset: number) => {
    skipNextBlockScrollRef.current = true;   // 스크롤은 FindReplacePanel이 직접 처리
    setActiveBlockId(blockId);
    const ref = editorRefs.current[blockId];
    setActiveMathId(ref
      ? findMathIdAtCursor(buildMathIndex(ref.getContent()), offset)
      : -1);
  }, []);

  /* ─── 미리보기 수식 클릭 → 편집창 선택 ─── */
  const handlePreviewMathClick = useCallback((blockId: string, mathId: number) => {
    // 블록 펼침 + 활성화
    setCurrentBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, collapsed: false } : b))
    );
    setActiveBlockId(blockId);
    setActiveMathId(mathId);   // D4: 전달받은 mathId를 명시 설정 (D3' 게이트 우회 보정)

    // 다른 모든 블록의 선택/하이라이트 해제
    for (const [id, ref] of Object.entries(editorRefs.current)) {
      if (id !== blockId && ref) { ref.clearSelection(); ref.clearMathHighlight(); }
    }

    setTimeout(() => {
      const ref = editorRefs.current[blockId];
      if (!ref) return;
      const content = ref.getContent();
      const ranges = buildMathIndex(content);
      if (mathId < 0 || mathId >= ranges.length) return;

      const range = ranges[mathId];
      // D4: focus()를 setSelection보다 먼저 — D3' 게이트(hasFocus)를 통과시켜
      //     이 dispatch가 유발하는 cursorActivity가 정상 처리되게 한다
      ref.focus();
      // 파란 텍스트 선택 대신: 커서만 두고 행 회색 + 수식 노랑 하이라이트
      ref.setSelection(range.from, range.from);
      ref.highlightMath(range.from, range.to);

      // D5‴: 양쪽 패널 모두 수식 중앙으로 (기존에는 편집창만 스크롤했다)
      scrollEditorToMathCenter(blockId);
      scrollPreviewToMathCenter(blockId, mathId);
    }, 100);
  }, [setCurrentBlocks, scrollEditorToMathCenter, scrollPreviewToMathCenter]);

  /* ─── 블록 활성화 시 기본 자동 스크롤 (탭 전환·초기 진입 등) ─── */
  // 핸들러(handleBlockFocus / handleSelectBlockBar)가 직접 스크롤을 처리한 경우엔 skip
  useEffect(() => {
    /* Phase 45a D2 — 플래그는 반드시 맨 앞에서 소비한다. collapseMode 가드 뒤에 두면
       전체접기 중엔 소비되지 않고 남아, 나중에 접기를 푸는 순간(deps에 collapseMode가
       있다) 엉뚱한 전환 하나를 삼킨다. activeBlockId가 null이 되는 삭제 경로에서도
       플래그가 정리되도록 !activeBlockId 가드보다도 앞이다. */
    if (skipNextBlockScrollRef.current) {
      skipNextBlockScrollRef.current = false;
      return;
    }
    if (!activeBlockId) return;
    if (collapseMode) return;
    const timer = setTimeout(() => {
      const container = editorPanelRef.current;
      if (!container) return;
      const blockEl = container.querySelector(`[data-editor-block-id="${activeBlockId}"]`);
      if (!blockEl) return;
      const containerRect = container.getBoundingClientRect();
      const blockRect = (blockEl as HTMLElement).getBoundingClientRect();
      const blockTop = blockRect.top - containerRect.top + container.scrollTop;
      fastScrollTo(container, blockTop - 80, BLOCK_SCROLL_MS);
    }, 80);
    return () => clearTimeout(timer);
  }, [activeBlockId, collapseMode]);

  /* ─── 블록 전환 시 다른 블록의 편집창 선택 해제 ─── */
  // (미리보기 하이라이트는 각 EditorPreview의 자체 useEffect[activeMathId]가 관리하므로
  //  여기서 querySelectorAll로 와이프하면 자식 effect가 막 적용한 cross-block 하이라이트가
  //  부모 effect에 의해 즉시 제거되어 cross-block 포커싱이 깨졌음.)
  useEffect(() => {
    for (const [id, ref] of Object.entries(editorRefs.current)) {
      if (id !== activeBlockId && ref) ref.clearSelection();
    }
  }, [activeBlockId]);

  /* ─── 불변식 감시(트립와이어): [data-noscroll] 컨테이너는 세로로 스크롤되면 안 된다 ───
     이들은 overflow:hidden 이라 사용자가 되돌릴 수 없다. 즉시 0으로 복원하고,
     개발 중엔 경고를 남긴다. 정상 상태에서는 scroll 이벤트가 한 번도 발생하지 않으므로
     비용 0. 경고가 뜬다면 어떤 요소가 세로 overflow를 다시 만든 것이니 그 원인을 제거할 것.
     (Phase 56 — 과거 편집 패널의 paddingBottom:100vh 가 그 원인이었다) */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-noscroll]'));
    const onScroll = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop === 0) return;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Phase56] noscroll 컨테이너가 세로 스크롤됨:', el.dataset.noscroll, {
          scrollTop: el.scrollTop,
          vOver: el.scrollHeight - el.clientHeight,
        });
      }
      el.scrollTop = 0;
    };
    els.forEach((el) => el.addEventListener('scroll', onScroll));
    return () => els.forEach((el) => el.removeEventListener('scroll', onScroll));
  }, []);

  /* ─── 탭 전환 시 activeBlockId 갱신 + 전체접기/선택 초기화 ─── */
  useEffect(() => {
    const blocks = allBlocks[activeTab] || [];
    if (blocks.length > 0 && !blocks.find((b) => b.id === activeBlockId)) {
      setActiveBlockId(blocks[0].id);
    }
    setActiveMathId(-1);   // D16: 탭 전환도 handleBlockFocus를 거치지 않는 경로
    setCollapseMode(false);
    setSelectedBlockIds(new Set());
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ctrl+F 찾기/바꾸기 · Cmd+B 블록 분할 · Cmd+J AI 완성 · Cmd+Z 블록 undo/redo ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Phase 55a: 블록 구조 undo/redo. C5(e.code — Korean IME) + C6(포커스 가드).
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        const el = document.activeElement as HTMLElement | null;
        const inTextEditing = !!el && (
          el.closest('.cm-editor') !== null ||               // 블록 CM·토론창 에디터
          el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || // 제목·정답·탭이름·찾기/바꾸기
          el.isContentEditable
        );
        if (!inTextEditing) {                                // 텍스트 편집 중이면 CM/브라우저 undo에 위임(D4)
          e.preventDefault();
          e.shiftKey ? redoBlocks() : undoBlocks();
        }
        return;
      }
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
  }, [handleSplitBlock, handleAIComplete, handleSplitMathLines, undoBlocks, redoBlocks]);

  /* ═══ 탭 추가 ═══ */
  const handleAddTab = () => {
    pushUndo();   // C3: 탭 추가 (no-op 없음)
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
        block_key: nanoid(),
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

    pushUndo();   // C3: confirm 통과 후
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
      const trimmed = editingTabLabel.trim();
      const cur = tabs.find((t) => t.id === editingTabId);
      if (cur && cur.label !== trimmed) pushUndo();   // C3: 실제 변경일 때만
      setTabs((prev) =>
        prev.map((t) => (t.id === editingTabId ? { ...t, label: trimmed } : t))
      );
    }
    setEditingTabId(null);
  };

  /* ═══ 저장 ═══ */
  // Phase 55: 현재 작업본으로 스냅샷 생성 (manual_save·editor_exit 공용). dedup으로 무변경은 no-op.
  // Phase 55b: opts(name·pinned)를 받고 SnapshotResult를 반환한다. 기존 두 호출부는
  //   반환을 무시하므로 하위호환. '이름 저장' UI가 4갈래(created/named_existing/unchanged/error)를 분기한다.
  const snapshotCurrent = useCallback(async (
    trigger: VersionTrigger,
    opts?: { name?: string; pinned?: boolean },
  ): Promise<SnapshotResult> => {
    if (!problem || !user) return { status: 'error', error: new Error('문항·사용자 없음') };
    try {
      const content = collectCurrentContent({
        tabs, blocksByTab: allBlocks, title: editTitle, answer: editAnswer,
        tabLoadErrors: tabLoadErrorsRef.current,
      });
      const actor: Participant = {
        uid: user.uid, display_name: user.displayName || user.email || '사용자',
      };
      const snap = await createSnapshot(problem.id, content, trigger, actor, opts);
      if (snap.status === 'error') console.error('[Phase55] 스냅샷 실패:', snap.error);
      return snap;
    } catch (e) {
      if (e instanceof VersionLoadError) console.warn('[Phase55] 스냅샷 생략(탭 로드 실패):', e.failedTabs);
      else console.error('[Phase55] 스냅샷 예외:', e);
      return { status: 'error', error: e };
    }
  }, [problem, user, tabs, allBlocks, editTitle, editAnswer]);

  const savingRef = useRef(false);
  /** Phase 61b: 직전 저장의 성공 여부. setSaveError는 state라 같은 tick에 못 읽는다. */
  const lastSaveOkRef = useRef(true);
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

        // 저장 형태 정형화 — 스냅샷 해시와 단일 소스 (lib/blocks/normalize.ts, Phase55 F4).
        // block_key 포함 외 기존 저장 결과와 필드 단위 동일.
        for (let i = 0; i < blocks.length; i++) {
          const saveData = toPersistedBlock(blocks[i], i);
          await saveTabBlock(problem.id, tab.id, saveData as any);
        }
      }

      // 저장 후 리프레시
      const refreshed = await getProblemWithBlocks(problem.id);
      if (refreshed) {
        // Phase 29: contentHash 자동 갱신 (authorUid 가 있는 문제만)
        if (refreshed.authorUid) {
          try {
            const newHash = await computeContentHash({
              authorUid: refreshed.authorUid,
              createdAt: refreshed.created_at.toISOString(),
              tabs: refreshed.tabs || DEFAULT_TABS,
              tabBlocks: refreshed.tabBlocks,
            });
            if (newHash !== refreshed.copyright?.contentHash) {
              await updateProblem(refreshed.id, { copyright: { contentHash: newHash } } as any);
              refreshed.copyright = { contentHash: newHash };
            }
          } catch (e) {
            console.error('contentHash 갱신 실패:', e);
          }
        }

        setProblem(refreshed);
        tabLoadErrorsRef.current = refreshed.tabLoadErrors || {};   // Phase 55(F7)
        const loadedTabs = refreshed.tabs || DEFAULT_TABS;
        setTabs(loadedTabs);
        setOrigTabs(loadedTabs);

        const toLocal = (blocks: Block[]): LocalBlock[] =>
          blocks.map((b, i) => ({
            ...b,
            block_key: b.block_key || nanoid(),
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
        // 저장 시 블록 ID가 갱신되어 교정 결과 매칭이 깨지므로 초기화
        setProofreadResults({});

        /* ─── Phase 61b: 검증 stale 판정 ───
           ⚠ "질문 탭을 저장하면" 같은 분기를 둘 수 없다 — 위 루프가 매 저장마다 **전 탭**을
             다시 쓴다. 그래서 저장 경로 훅이 아니라 **탭 정규화 해시 비교**로 정한다.
             목록은 불리언만 읽으므로 렌더 비용은 그대로 0이고, 되돌리면 자동 해제된다.
           ⚠ collectCurrentContent는 탭 로드 실패 시 VersionLoadError를 던진다 → 저장 자체를
             깨뜨리지 않도록 통째로 감싼다. 실패하면 stale은 손대지 않는다. */
        const verif = refreshed.verification;
        if (verif && (verif.problem || verif.solution)) {
          try {
            const hashes = await computeVerifyHashes({
              tabs: loadedTabs, blocksByTab: blocksMap,
              title: editTitle, answer: editAnswer,
              tabLoadErrors: refreshed.tabLoadErrors || {},
            });
            for (const kind of ['problem', 'solution'] as VerifyKind[]) {
              const cur = verif[kind];
              const now = hashes[kind];
              if (!cur || now === undefined) continue;
              const next = now !== cur.contentHash;
              if (next !== !!cur.stale) {
                await setVerification(problem.id, kind, { ...cur, stale: next });
              }
            }
          } catch (e) {
            console.warn('[Phase61b] 검증 stale 계산 생략:', e);
          }
        }
      }

      // 저장 성공: dirty 해제. setAllBlocks가 effect를 다시 트리거할 수 있으므로
      // skipDirtyRef로 그 한 번을 무시.
      skipDirtyRef.current = true;
      setDirty(false);
      lastSaveOkRef.current = true;

      // Phase 55 계층1: 저장 성공 → 상태 갱신 + 드래프트 정리 (서버본과 동기화됨)
      setSaveError(false);
      setLastSavedAt(Date.now());
      setRecoverableDraft(null);
      clearDraft(problem.id);

      // Phase 55: 명시 저장 = manual_save 스냅샷 (블록 커밋 완료 후). 실패는 비치명(블록은 이미 저장됨).
      if (!silent) await snapshotCurrent('manual_save');

      if (!silent) {
        setStatus('저장 완료');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (error) {
      setStatus(`에러: ${error}`);
      setSaveError(true);   // Phase 55 계층1: 저장 실패 표시
      lastSaveOkRef.current = false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [problem, tabs, origTabs, origBlockIds, allBlocks, activeTab, editTitle, editSource, editCategory, editDifficulty, editAnswer, editFolderId, user, snapshotCurrent]);

  /* ─── 자동저장: 탭 전환 시 ─── */
  const switchTab = useCallback((nextTabId: string) => {
    if (nextTabId === activeTab) return;
    handleSave(true);
    setActiveTab(nextTabId);
  }, [activeTab, handleSave]);

  /* ═══ Phase 61b: 정밀 검증 ═══ */

  /** 칩이 팝오버를 열기 **전에** 부른다 — 비용 0으로 막을 수 있는 것을 호출 뒤에 알리지 않는다 */
  const verifyCharCount = useCallback(
    (kind: VerifyKind) => verifyCharCountOf(allBlocks, kind),
    [allBlocks],
  );

  const handleRunVerify = useCallback(async (kind: VerifyKind, sessionId: string) => {
    if (!problem || !user) throw new Error('문항 정보를 불러오지 못했습니다');

    /* ⚠ 검증 대상은 **저장본**이다. 미저장 편집이 있으면 "지금 화면"을 검증했다고 믿는데
         서버본이 검증되고 지적 위치도 어긋난다. 저장이 실패하면 실행하지 않는다.
         덤으로 toPersistedBlock이 block_key를 영속시켜 리포트 앵커가 안정된다.
         (열람뷰에는 이 단계가 없다 — 거기서는 애초에 저장본만 보인다) */
    if (dirty) {
      await handleSave(true);
      if (!lastSaveOkRef.current) throw new Error('저장에 실패해 검증을 중단했습니다');
    }

    const { report, commentId } = await runVerifyFlow({
      kind, problemId: problem.id, sessionId, tabId: activeTab,
      idToken: await user.getIdToken(),
      tabs, blocksByTab: allBlocks,
      title: editTitle, answer: editAnswer || '',
      tabLoadErrors: tabLoadErrorsRef.current,
      buildMarkdown: buildReportMarkdown,
    });

    setProblem((prev) => (prev ? {
      ...prev,
      verification: {
        ...(prev.verification || {}),
        [kind]: {
          verdict: report.verdict, verifiedAt: report.verifiedAt,
          contentHash: '', stale: false, reportCommentId: commentId,
        },
      },
    } : prev));
  }, [problem, user, dirty, handleSave, allBlocks, editAnswer, editTitle, tabs, activeTab]);

  /**
   * 리포트 지적 → **그 인용이 있는 자리**로.
   *
   * 블록 상단으로만 보내면 긴 블록에서 엉뚱한 내용이 화면 중앙에 온다 → `findQuoteRange`로
   * 글자 범위를 찾아 거기로 간다. 강조·중앙 정렬은 "미리보기 수식 클릭" 경로가 이미 갖춘
   * 장치를 그대로 쓴다(`highlightMath` = 행 회색 + 구간 노랑, `activeMathId` = 미리보기 강조).
   *
   * ⚠ 앵커는 `block_key`다 — doc id는 저장마다 갈린다.
   */
  const handleJumpToBlock = useCallback((blockKey: string, quote: string) => {
    for (const t of tabs) {
      const blk = (allBlocks[t.id] || []).find((b) => blockKeyOf(b) === blockKey);
      if (!blk) continue;
      if (t.id !== activeTab) switchTab(t.id);   // ⚠ switchTab은 자동저장을 동반한다

      /* 접힌 블록은 펴야 편집창·미리보기 모두에 그려진다 (수식 클릭 경로와 동일).
         ⚠ `setCurrentBlocks`를 쓰면 안 된다 — 그쪽은 클로저의 `activeTab`에 쓰므로
            방금 `switchTab`한 경우 **이전 탭**을 건드린다. 대상 탭을 명시한다. */
      setAllBlocks((prev) => ({
        ...prev,
        [t.id]: (prev[t.id] || []).map((b) => (b.id === blk.id ? { ...b, collapsed: false } : b)),
      }));
      setActiveBlockId(blk.id);
      // 다른 블록에 남은 선택·하이라이트 정리
      for (const [id, ref] of Object.entries(editorRefs.current)) {
        if (id !== blk.id && ref) { ref.clearSelection(); ref.clearMathHighlight(); }
      }
      /* Phase 45a 계약 — 직접 스크롤을 호출하는 핸들러는 자동 스크롤 effect의 게이트를
         우회하므로 같은 조건(collapseMode)을 자기 안에 다시 적는다. */
      if (collapseModeRef.current) return;
      skipNextBlockScrollRef.current = true;

      setTimeout(() => {
        const ref = editorRefs.current[blk.id];
        if (!ref) return;
        const content = ref.getContent();
        const range = findQuoteRange(content, quote);
        if (!range) {
          // 인용을 못 찾으면 블록 중앙으로라도 보낸다 (아무 일도 안 일어난 것보다 낫다)
          setActiveMathId(-1);
          scrollEditorToBlockTop(blk.id);
          scrollPreviewToBlockCenter(blk.id);
          return;
        }

        ref.focus();
        ref.setSelection(range.from, range.from);
        ref.highlightMath(range.from, range.to);

        /* 인용이 수식 안이면 미리보기에서도 그 수식을 칠하고 중앙에 둔다.
           수식이 아니면(산문 인용) 미리보기는 블록 중앙까지만 — 문장 단위 앵커가 없다. */
        const mathId = findMathIdAtCursor(buildMathIndex(content), range.from);
        if (mathId >= 0) {
          setActiveMathId(mathId);
          scrollEditorToMathCenter(blk.id);
          scrollPreviewToMathCenter(blk.id, mathId);
        } else {
          setActiveMathId(-1);
          scrollEditorToCursorCenter(blk.id);
          scrollPreviewToBlockCenter(blk.id);
        }
      }, 120);
      return;
    }
    setStatus('그 블록은 더 이상 없습니다');
    setTimeout(() => setStatus(''), 2500);
  }, [tabs, allBlocks, activeTab, switchTab,
      scrollEditorToBlockTop, scrollEditorToCursorCenter, scrollEditorToMathCenter,
      scrollPreviewToBlockCenter, scrollPreviewToMathCenter]);

  /* ─── 자동저장: EditorView 이탈(onBack) / unmount ─── */
  const skipUnmountSaveRef = useRef<boolean>(false);
  const handleBackWithSave = useCallback(async () => {
    skipUnmountSaveRef.current = true; // 명시적 저장 후 언마운트 중복 저장 방지
    await handleSave(true);
    await snapshotCurrent('editor_exit'); // Phase 55 D5: 제어된 이탈 스냅샷(dedup으로 무변경은 no-op)
    onBack();
  }, [handleSave, onBack, snapshotCurrent]);

  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);
  useEffect(() => {
    return () => {
      if (skipUnmountSaveRef.current) return;
      handleSaveRef.current(true);
    };
  }, []);

  // Phase 55 계층1: localStorage 드래프트 기록(디바운스 500ms). Firestore 상시 저장 없음(D2).
  useEffect(() => {
    if (!problemId || !dirty) return;
    const h = setTimeout(() => {
      try {
        writeDraft(problemId, collectCurrentContent({
          tabs, blocksByTab: allBlocks, title: editTitle, answer: editAnswer,
          tabLoadErrors: tabLoadErrorsRef.current,
        }));
      } catch { /* 로드 실패 탭 등 → 드래프트 스킵 */ }
    }, 500);
    return () => clearTimeout(h);
  }, [problemId, dirty, allBlocks, tabs, editTitle, editAnswer]);

  // Phase 55 계층1: 창 닫힘 best-effort flush(sync) — 마지막 타이핑까지 보존.
  useEffect(() => {
    const handler = () => {
      if (!problemId || !dirty) return;
      try {
        writeDraft(problemId, collectCurrentContent({
          tabs, blocksByTab: allBlocks, title: editTitle, answer: editAnswer,
          tabLoadErrors: tabLoadErrorsRef.current,
        }));
      } catch { /* skip */ }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [problemId, dirty, allBlocks, tabs, editTitle, editAnswer]);

  /* ─── 로딩 / 에러 ─── */
  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }
  // Stage 2: 멤버(=비오너)는 편집창 접근 불가
  if (user && problem.authorUid && user.uid !== problem.authorUid) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>이 문항은 보기 전용으로 공유되었습니다.</div>
        <button onClick={onBack} style={{
          padding: '7px 14px', border: '1px solid var(--border-light, #ddd)',
          background: 'transparent', color: 'var(--text-primary)',
          borderRadius: 6, cursor: 'pointer', fontSize: 12,
        }}>
          뒤로 가기
        </button>
      </div>
    );
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


  // Phase 55: 버전 콘텐츠를 작업본에 적용 (드래프트 복구·복원 공용). block_key 유지 → diff 연속성.
  // Phase 55a(C1+F1): 세대 id로 매 apply 전면 리마운트(비제어 CM 갱신) + activeBlockId 항상 재설정
  const applyVersionContent = (
    content: VersionContent,
    ui?: { activeTab?: string; activeBlockKey?: string },
  ) => {
    const gen = ++applyGenRef.current;
    const { tabs: vTabs, blocksByTab, title, answer } = versionContentToLocal(content);
    const map: Record<string, LocalBlock[]> = {};
    for (const t of vTabs) {
      map[t.id] = (blocksByTab[t.id] || []).map((b) => ({
        ...b, id: `v${gen}-${b.block_key}`, collapsed: false, title: b.title || '',
      })) as LocalBlock[];
    }
    setTabs(vTabs);
    setAllBlocks(map);
    setEditTitle(title);
    setEditAnswer(answer);
    const nextTab = ui?.activeTab && vTabs.some((t) => t.id === ui.activeTab)
      ? ui.activeTab : (vTabs[0]?.id || 'question');
    setActiveTab(nextTab);
    // F1: 같은 탭 apply에선 [activeTab] 보정 effect가 안 돌아 stale id 잔류 → 항상 유효값으로
    const found = ui?.activeBlockKey
      ? (map[nextTab] || []).find((b) => b.block_key === ui.activeBlockKey)
      : undefined;
    setActiveBlockId(found?.id ?? map[nextTab]?.[0]?.id ?? null);
    setCollapseMode(false);            // Stage 4: 전체접기 상태 동기화(블록은 collapsed:false로 적용됨)
    setSelectedBlockIds(new Set());    // 새 세대 id로 리마운트 → 이전 선택 무효
    setDirty(true);
  };

  // Phase 55b: GitHub 내보내기. user(ID 토큰)를 아는 곳이 여기뿐이라 Drawer가 아니라
  //   EditorView가 fetch를 맡고, Drawer는 결과로 doc 기록·배지 갱신만 한다.
  //   content는 반드시 Drawer가 loadContent로 읽은 payload 원본이다 — 현재 편집 상태를
  //   보내면 최신 버전 외 전부 서버 해시 대조에서 409로 막힌다.
  const handleExport = async (versionId: string, content: VersionContent): Promise<ExportOutcome> => {
    if (!problem || !user) return { ok: false, error: '로그인이 필요합니다' };
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/github/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ problemId: problem.id, versionId, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data?.error || '내보내기에 실패했습니다' };
      return { ok: true, ...data };
    } catch (e) {
      console.error('[Phase55b] export 요청 실패:', e);
      return { ok: false, error: '네트워크 오류로 내보내지 못했습니다' };
    }
  };

  // 계층1 복구 배너 [복구]
  const applyRecoveredDraft = (content: VersionContent) => {
    applyVersionContent(content);
    setRecoverableDraft(null);
  };

  // Phase 55 Stage 5: 비파괴 복원. 직전 보존 → 대상 적용(in-memory) → 복원 스냅샷.
  const handleRestore = async (target: ProblemVersion, targetContent: VersionContent) => {
    if (!problem || !user) return;
    const actor: Participant = { uid: user.uid, display_name: user.displayName || user.email || '사용자' };
    await snapshotCurrent('manual_save');                 // 1) 복원 직전 보존(무변경이면 dedup)
    applyVersionContent(targetContent);                   // 2) 대상 적용(라이브 쓰기는 이후 저장이 수행)
    const snap = await createSnapshot(problem.id, targetContent, 'restore', actor, { restoredFrom: target.id }); // 3) 복원 스냅샷
    if (snap.status === 'error') console.error('[Phase55] 복원 스냅샷 실패:', snap.error);
    setLastSavedAt(Date.now());
    setVersionDrawerOpen(false);
    setStatus(`v${target.seq}(으)로 복원됨 — 저장하면 반영됩니다`);
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', background: 'var(--bg-functional)',
    }}>
      {/* CSS 오버라이드 */}
      <style>{`
        .scaled-editor .cm-editor { font-size: ${contentFontSize}px !important; }
        .scaled-editor .cm-content { font-size: ${contentFontSize}px !important; }
        .scaled-preview > div > div > div { font-size: ${contentFontSize}px !important; }
      `}</style>

      {/* Phase 55 계층1: 크래시 복구 배너 */}
      {recoverableDraft && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
          background: 'var(--bg-warn, #fff8e1)', borderBottom: '1px solid var(--border-light)',
          fontSize: 13, color: 'var(--text-primary)', flexShrink: 0,
        }}>
          <span>복구되지 않은 변경이 있습니다.</span>
          <button onClick={() => applyRecoveredDraft(recoverableDraft)} style={{
            padding: '3px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
            background: '#e53935', color: '#fff', fontSize: 12,
          }}>복구</button>
          <button onClick={() => { clearDraft(problemId); setRecoverableDraft(null); }} style={{
            padding: '3px 10px', border: '1px solid var(--border-light)', borderRadius: 5,
            cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
          }}>버림</button>
        </div>
      )}

      {/* Phase 55 Stage 4·5: 버전 기록 드로어. 루트 기준 absolute — 덮지 않고
          편집·미리보기를 밀어낸다(rightPanelWidth). agent 패널과 같은 규약. */}
      <VersionDrawer
        problemId={problemId}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        getCurrentContent={() => {
          try {
            return collectCurrentContent({
              tabs, blocksByTab: allBlocks, title: editTitle, answer: editAnswer,
              tabLoadErrors: tabLoadErrorsRef.current,
            });
          } catch { return null; }
        }}
        onRestore={handleRestore}
        onNamedSave={(name) => snapshotCurrent('named', { name })}
        onExport={handleExport}
        width={version.width}
        resizeHandle={activeResizeHandle === 'version' ? (
          /* Phase 62 D14 — 드로어 **안쪽** 좌변. 핸들 좌표계가 드로어 기준이라 offset이 음수다.
             ⚠ -5(드로어 좌변 중앙)가 아니라 **-13**이다: 밀어내기 때문에 클레이 우측 경계선은
                드로어 좌변보다 8px 왼쪽(rightPanelWidth + 8)에 있다. strip 가운데를 거기 맞춰야
                댓글·agent 핸들(offset = width + 3 → 가운데 width + 8)과 활성선 위치가 통일된다.
             ⚠ zIndex는 기본값(100)을 유지할 것 — 드로어의 스태킹 컨텍스트(110) 안이라
                RestoreConfirm(fixed·1400)이 핸들 위를 덮는다. */
          <DrawerResizeHandle
            side="left"
            offset={-13}
            active={version.dragging || version.hover}
            {...version.handleProps}
          />
        ) : undefined}
      />

      {/* ═══ Row 1: 메타 정보 ═══
          높이 57px — 사이드바 헤더(padding 14×2 + 버튼 28 + border 1) + 토론 패널 헤더와 동일 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px',
        minHeight: 57, boxSizing: 'border-box',
        // 토론 패널이 열리면 우측 여백 확보 (저장/글꼴크기 버튼이 패널 왼쪽으로 밀려나도록)
        paddingRight: rightPanelOpen ? `calc(${rightPanelWidth}px + 40px)` : 16,
        transition: rightPanelDragging ? 'none' : 'padding-right 0.2s',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-functional)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button onClick={handleBackWithSave} style={{
          border: 'none', cursor: 'pointer',
          background: 'var(--accent-primary)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '4px 10px 4px 6px', borderRadius: 999,
          fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 600,
          lineHeight: 1, whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
          title="보기 화면으로"
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-primary)'; }}
        >
          <IconChevronLeft size={13} color="#fff" />
          <span>보기</span>
        </button>

        <FolderPathBar
          folders={folders}
          currentFolderId={editFolderId}
          onMove={(folderId) => setEditFolderId(folderId || '')}
        />

        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
          placeholder="문제 제목" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, flex: 1, minWidth: 120, fontSize: 15, fontWeight: 600 }}
        />

        {status && (
          <span style={{ fontSize: 12, marginRight: 4,
            color: status.includes('에러') || status.includes('오류') ? 'var(--accent-danger)' : 'var(--accent-success)',
          }}>{status}</span>
        )}

        {/* Phase 55 계층1: 저장 상태 표시 */}
        <SaveStatus
          status={saving ? 'saving' : saveError ? 'error' : dirty ? 'unsaved' : 'saved'}
          lastSavedAt={lastSavedAt}
        />

        {/* 저장 · 버전 기록 묶음 (Phase 55c 후속)
            한 쌍으로 묶은 이유: ① 둘의 간격만 좁히려면 행의 gap:8과 분리돼야 한다
            (여기 gap 3 + 각 버튼 padding 4 = 글리프 사이 11px, 묶기 전 16px의 약 2/3)
            ② flexWrap 시 둘이 갈라지지 않는다. 순서는 저장 → 버전 기록. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {/* 저장 버튼 — 아이콘만. dirty면 빨강·구름만, 저장 완료면 회색·구름+체크. */}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            title={saving ? '저장 중...' : dirty ? '변경사항 저장' : '저장됨'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', padding: 4,
              cursor: saving ? 'wait' : (dirty ? 'pointer' : 'default'),
              color: dirty ? 'var(--accent-danger)' : 'var(--text-faint)',
              transition: 'color 0.2s',
            }}
          >
            {/* 색은 버튼 style의 color가 currentColor로 전달. 체크 유무만 checked prop으로 분기(Phase 55c) */}
            {saving ? <IconLoader size={16} /> : <IconSave size={18} checked={!dirty} />}
          </button>

          {/* 버전 기록 열기 — 아이콘은 IconRestore
              (Phase 55c: 사이드바 '최근 문항'과 같은 IconRecent였던 것을 교체. 이력 복원 의미) */}
          <button
            onClick={() => setVersionDrawerOpen(true)}
            title="버전 기록"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
              color: 'var(--text-faint)',
            }}
          ><IconRestore size={17} /></button>
        </div>

        {/* ─── 글꼴 크기 조절: 숫자 + 위/아래 꺾쇠 ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginLeft: 4,
          borderLeft: '1px solid var(--border-light, #ddd)',
          paddingLeft: 8,
        }}>
          <span style={{
            fontSize: 13.5,
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            minWidth: 22,
            textAlign: 'right',
            userSelect: 'none',
          }}>
            {contentFontSize}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={() => handleFontSizeChange(FONT_SIZE_STEP)}
              disabled={contentFontSize >= FONT_SIZE_MAX}
              title="글꼴 확대"
              style={{
                border: 'none', background: 'transparent', padding: 0,
                width: 14, height: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: contentFontSize >= FONT_SIZE_MAX ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                opacity: contentFontSize >= FONT_SIZE_MAX ? 0.3 : 1,
              }}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 5 L5 1 L9 5" />
              </svg>
            </button>
            <button
              onClick={() => handleFontSizeChange(-FONT_SIZE_STEP)}
              disabled={contentFontSize <= FONT_SIZE_MIN}
              title="글꼴 축소"
              style={{
                border: 'none', background: 'transparent', padding: 0,
                width: 14, height: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: contentFontSize <= FONT_SIZE_MIN ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                opacity: contentFontSize <= FONT_SIZE_MIN ? 0.3 : 1,
              }}
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 1 L5 5 L9 1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Row 2: Toolbar (좌) + Tabs (우) ═══
          높이 41px — 토론 패널 세션바와 동일 (둘째 가로선 정렬) */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        minHeight: 41, boxSizing: 'border-box',
        paddingRight: rightPanelOpen ? `calc(${rightPanelWidth}px + 40px)` : 16,
        transition: rightPanelDragging ? 'none' : 'padding-right 0.2s',
        background: 'var(--bg-functional)', flexShrink: 0,
        gap: 4,
      }}>
        {/* Phase 55a: 블록 실행취소/재실행 (Row 2 맨 왼쪽) */}
        <button onClick={undoBlocks} disabled={!canUndo} title="실행취소 (⌘Z)" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', padding: 4,
          cursor: canUndo ? 'pointer' : 'default',
          color: canUndo ? 'var(--text-secondary)' : 'var(--text-faint)',
        }}><IconUndo size={17} /></button>
        <button onClick={redoBlocks} disabled={!canRedo} title="다시실행 (⌘⇧Z)" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', padding: 4,
          cursor: canRedo ? 'pointer' : 'default',
          color: canRedo ? 'var(--text-secondary)' : 'var(--text-faint)',
        }}><IconRedo size={17} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border-light)', margin: '0 4px' }} />

        <UnifiedToolbar
          cursorInMath={cursorInMath}
          showToolbar={!!showToolbar}
          onInsert={handleInsert}
          snippets={snippets}
          onSnippetInsert={handleSnippetInsert}
          onSnippetAdd={addSnippet}
          onSnippetEdit={editSnippet}
          onSnippetDelete={removeSnippet}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen(!searchOpen)}
          proofreading={proofreading}
          onRunProofread={handleRunProofread}
          ocrLoading={ocrLoading}
          onOcrClick={handleOcrClick}
          onAIComplete={() => handleAIComplete()}
          aiLoading={aiLoadingBlockId !== null}
          collapseMode={collapseMode}
          onToggleCollapseAll={handleToggleCollapseAll}
          onToggleKey={handleToggleKey}
          keyToggleRejected={keyToggleRejected}
        />
        <input
          ref={ocrInputRef}
          type="file"
          accept={OCR_ACCEPT}
          onChange={handleOcrFileChange}
          style={{ display: 'none' }}
        />

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
                {tab.label}
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

        {/* Phase 47: 댓글 버튼 + agent 버튼 (편집 화면은 오너 전용이라 둘 다 노출) */}
        {user && problem && (
          <>
            <button
              onClick={() => setPanelMode((m) => m === 'comments' ? null : 'comments')}
              title="댓글 열기"
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '2px 4px', borderRadius: 4,
                fontSize: 11,
                color: panelMode === 'comments' ? 'var(--accent-primary)' : 'var(--text-faint)',
                fontFamily: 'var(--font-ui)',
                transition: 'color 0.15s',
                marginLeft: 'auto',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => {
                if (panelMode !== 'comments') (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
              }}
            >
              💬{commentCount ? ` ${commentCount}` : ''}
            </button>
            <button
              onClick={() => setPanelMode((m) => m === 'agent' ? null : 'agent')}
              title="agent 열기"
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '2px 4px', borderRadius: 4,
                fontSize: 11,
                color: panelMode === 'agent' ? 'var(--accent-primary)' : 'var(--text-faint)',
                fontFamily: 'var(--font-ui)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => {
                if (panelMode !== 'agent') (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
              }}
            >
              <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>AI</span>{agentCount ? ` ${agentCount}` : ''}
            </button>
          </>
        )}
      </div>

      {/* ═══ Row 3: Split View — 외부 래퍼(아이보리 백드롭, 토론 패널 자리 확보) ═══ */}
      <div style={{
        flex: 1, display: 'flex', minHeight: 0,
        paddingRight: rightPanelOpen ? `calc(${rightPanelWidth}px + 8px)` : 0, // 우측 패널 + 8px 여백
        transition: rightPanelDragging ? 'none' : 'padding-right 0.2s',
      }}>

        {/* ─── U자 컨텐츠 프레임: 클레이 + 3면 경계(상·좌·우) + 상단 14px 라운드, 하단 열림 ─── */}
        <div className="content-frame" data-noscroll="content-frame" style={{
          flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', minHeight: 0,
          background: 'var(--bg-content)',
          borderTop: '0.5px solid var(--border-content)',
          borderLeft: '0.5px solid var(--border-content)',
          borderRight: '0.5px solid var(--border-content)',
          // Phase 45a — 전폭 직각 블록이 상단에 밀착하므로 프레임도 직각(3곳 동일)
        }}>

        {/* ─── Left: Editor ─── */}
        <div data-noscroll="left-column" style={{
          flex: 1, minWidth: 420,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
          // FindReplacePanel 팝업 기준 컨테이너
          position: 'relative',
        }}>
          {/* ── 찾기/바꾸기 패널 ── */}
          <FindReplacePanel
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            editorRefs={editorRefs}
            blockIds={currentBlocks.map((b) => b.id)}
            editorPanelRef={editorPanelRef}
            onNavigate={handleSearchNavigate}
          />

          <div ref={editorPanelRef} className="scaled-editor no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px', minHeight: 0 }}>
            <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {currentBlocks.map((block, i, arr) => {
                  const proofData = proofreadResults[activeTab]?.[block.id];
                  /* 블록 사이 구분선은 하나뿐이다 — 위쪽만 그리므로 첫 블록은 선이 없고,
                     직전이 활성 카드면 그 카드의 아래 테두리가 이미 선을 담당한다.
                     ⚠ CSS 형제 선택자(.flat + .flat)로는 못 한다 — 아래 <div key>가
                       블록 루트끼리의 형제 관계를 끊는다(Phase 59 D15′와 같은 함정). */
                  const prev = i > 0 ? arr[i - 1] : null;
                  const hideTopLine = !prev
                    || activeBlockId === prev.id || selectedBlockIds.has(prev.id);
                  return (
                  <div key={block.id}>
                  <SortableEditorBlock
                    block={block}
                    index={i}
                    isActive={activeBlockId === block.id}
                    canDelete={currentBlocks.length > 1}
                    editorRefs={editorRefs}
                    collapseMode={collapseMode}
                    selected={selectedBlockIds.has(block.id)}
                    hideTopLine={hideTopLine}
                    onFocus={() => handleBlockFocus(block.id)}
                    onChange={(val) => handleBlockChange(block.id, val)}
                    onTypeChange={(type) => handleBlockTypeChange(block.id, type)}
                    onTitleChange={(title) => handleBlockTitleChange(block.id, title)}
                    onDelete={() => handleDeleteBlock(block.id)}
                    onToggleCollapse={() => handleToggleBlockCollapse(block.id)}
                    onBarClick={(mods) => {
                      /* D5-c: 선택 조작은 전체접기 모드에서만. 일반 모드에서 Shift+클릭이
                         선택집합을 만들면 (전체접기를 켜도 지워지지 않아) 유령 선택이 된다. */
                      if (collapseMode && mods.shift) handleRangeSelectBlock(block.id);
                      else if (collapseMode && mods.alt) handleToggleSelectBlock(block.id);
                      else handleSelectBlockBar(block.id);
                    }}
                    onMediaUpload={handleBlockMediaUpload}
                    onImageWidthChange={handleImageWidthChange}
                    onImageTreatmentChange={handleImageTreatmentChange}
                    onImageGrayChange={handleImageGrayChange}
                    onSummaryChange={handleSummaryChange}
                    onSaveSvgInitialView={handleSaveSvgInitialView}
                    onSvgHeightChange={handleSvgHeightChange}
                    onSaveGgbInitialView={handleSaveGgbInitialView}
                    onGgbHeightChange={handleGgbHeightChange}
                    problemId={problemId}
                    onSnippetShortcut={handleSnippetShortcut}
                    onCursorActivity={handleCursorActivity}
                    onSplitMathLines={() => handleSplitMathLines(block.id)}
                    blockTypes={BLOCK_TYPES.map((t) => ({ type: t, label: BLOCK_TYPE_LABELS[t] }))}
                    onAddBlock={(type) => handleAddBlock(type as Block['type'])}
                    onSplitBlock={handleSplitBlock}
                    canSplitBlock={SPLITTABLE_TYPES.has(block.type)}
                  />
                  {proofData && (
                    <ProofreadResultBox
                      data={proofData}
                      onDismiss={() => handleDismissProofreadBox(block.id)}
                      onDismissIssue={(idx) => handleDismissProofreadIssue(block.id, idx)}
                      onAutoFixIssue={(idx) => handleAutoFixProofreadIssue(block.id, idx)}
                      onRetry={() => handleRetryProofreadBlock(block.id)}
                    />
                  )}
                  </div>
                  );
                })}
              </SortableContext>
            </DndContext>
            </div>
            {/* 문서 끝 여백 — 패널 자신에 paddingBottom:100vh 를 주면 border-box 규칙상
                박스 최소높이가 100vh로 고정돼 overflow:hidden 부모(좌측 칼럼)에 복구 불가한
                스크롤 틈이 생기고, CodeMirror scrollRectIntoView가 매 키입력마다 이를
                밀어붙여 상단이 잘린다. 반드시 스페이서로 둘 것. (Phase 56) */}
            <div aria-hidden style={{ height: '100vh', flexShrink: 0 }} />
          </div>
        </div>

        {/* ─── Right: Preview (고정 폭 35em + 좌 3.5em / 우 32px) ───
              marginLeft = 편집창 블록 띠와의 채널. Phase 45a에서 편집 패널의 우측
              패딩 16px이 사라져(전폭) 띠 우측 끝 → 미리보기 첫 글자가 48px → 32px로
              좁아졌고, 기타 개선 4(83c8f47)에서 56px로 되돌렸다.
              Phase 59a: 그 채널 안으로 경우 rail(거터 2.06em)이 들어온다 → 좌측 패딩만
              3.5em으로 키운다. 실측 착지값(15px 기준):
                띠 → rail 빈 공간 = 24 + 52.5 − 30.9 = 45.6px  (≈ Phase 45a 이전 채널 48px)
                띠 → 본문 첫 글자 = 24 + 52.5 = 76.5px
              ⚠ 편집 패널에 우측 패딩을 주는 식으로 벌리면 안 된다 — 블록이 좌측만
                붙고 우측은 들어가 비대칭이 된다.
              ⚠ 패딩을 키운 만큼 width도 키울 것 — 안 그러면 본문 측정폭 35em이 깎인다.
                width의 em과 paddingLeft의 em은 이 열의 fontSize(contentFontSize)를
                같은 base로 쓰므로 글꼴을 바꿔도 35em이 보존된다. */}
        <div data-noscroll="preview-column" style={{
          width: `calc(38.5em + 32px)`, flexShrink: 0, marginLeft: 24,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
          fontSize: contentFontSize,
        }}>
          <div ref={previewRef} className="scaled-preview no-scrollbar problem-content-toned tone-baseline" style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 20px 3.5em', background: 'var(--bg-content)', minHeight: 0, ['--content-font-size' as any]: `${contentFontSize}px` }}>
            {/* Phase 58 P2 — 톤 스코프. 미리보기는 활성 탭 하나만 렌더하므로 activeTab으로 판정한다 */}
            <div className={toneClass(activeTab)} style={activeTab === 'question' ? {
              background: 'var(--bg-content)', padding: '20px 24px', borderRadius: 8,
            } : undefined}>
            {currentBlocks.map((block, i) => {
              const isActivePreview = block.id === activeBlockId;
              const isBordered = BORDERED_TYPES.has(block.type);
              // Phase 58 D2: 1.5em → 0.5em. 체감 여백은 [앞 블록 이월 마진 0.6~1.1em] +
              // [이 paddingTop] + [h2 marginTop 1.08em]의 3항 합이다 (5개 렌더 사이트 동일).
              const headingTopPad = block.type === 'heading' && i !== 0 ? '0.5em' : undefined;
              // Phase 59 D15′ — case 클래스는 이 래퍼에 병기한다. 래퍼 안에 새 div를
              // 만들면 .case-block끼리 형제가 아니게 되어 rail 브리징이 통째로 죽는다.
              const caseLabel = isCaseBlock(block.type) ? (caseLabels.get(blockKeyOf(block)) ?? null) : null;
              const caseCls = isCaseBlock(block.type)
                ? caseClassName(block.type, !!caseLabel)
                : (caseGaps.has(blockKeyOf(block)) ? caseGapClassName(block.type) : undefined);
              return (
                <div key={block.id} data-block-id={block.id}
                  className={caseCls}
                  style={{ paddingTop: headingTopPad }}>
                  {block.type === 'image' ? (
                    <div style={{ textAlign: 'center', margin: '1.2em 0' }}>
                      {block.raw_text ? (
                        <img
                          src={block.raw_text.match(/src="([^"]+)"/)?.[1] || ''}
                          alt=""
                          style={{
                            width: block.imageWidth || 400,
                            maxWidth: '90%',
                            height: 'auto',
                            ...imageTreatmentStyle(block),
                          }}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(이미지 없음)</span>
                      )}
                    </div>
                  ) : block.type === 'svg' ? (
                    <div>
                      {block.raw_text ? (
                        <SvgViewer
                          url={block.raw_text}
                          initialView={block.svg_initial_view}
                          height={block.svg_height || SVG_BLOCK_HEIGHT}
                          interactive={false}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(SVG 없음)</div>
                      )}
                    </div>
                  ) : block.type === 'ggb' ? (
                    <div>
                      {block.raw_text ? (
                        <GgbViewer
                          url={block.raw_text}
                          initialCoords={block.ggb_initial_coords}
                          height={block.ggb_height || GGB_BLOCK_HEIGHT}
                          interactive={false}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(GeoGebra 없음)</div>
                      )}
                    </div>
                  ) : isBordered ? (
                    <div style={{
                      border: '0.7px solid var(--text-primary)',
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
                  ) : isCaseBlock(block.type) ? (
                    /* Phase 59: 경우 — 래퍼(위)가 이미 .case-block이다. 여기서는 라벨만 주입한다.
                       ⚠ 제목행과 본문을 두 EditorPreview로 쪼개면 data-math-id가 인스턴스별로
                         0부터 다시 매겨져 "미리보기 수식 클릭 → 편집 위치" 매핑이 깨진다. */
                    <EditorPreview
                      content={injectCaseLabel(block.raw_text, caseLabel)}
                      borderless
                      locale="ko"
                      activeMathId={isActivePreview ? activeMathId : undefined}
                      onClickMath={(mathId) => handlePreviewMathClick(block.id, mathId)}
                    />
                  ) : isCoachBlock(block.type) ? (
                    /* Phase 59a: 코칭 — 라벨(Important/Caution)은 raw_text가 아니라 렌더가 붙인다 */
                    <div className={coachClassName(block.type)}>
                      <CoachLabel type={block.type} />
                      <EditorPreview
                        content={block.raw_text}
                        borderless
                        locale="ko"
                        activeMathId={isActivePreview ? activeMathId : undefined}
                        onClickMath={(mathId) => handlePreviewMathClick(block.id, mathId)}
                      />
                    </div>
                  ) : block.type === 'callout' ? (
                    /* Phase 57: 들여쓰기 블록(구 '강조문') — 테두리 없이 display 수식과 같은 좌단·상하 여백 */
                    <div className="callout-block">
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
            {/* 문서 끝 여백 — 편집창과 동일 사유. 조건부 style 객체 안에 paddingBottom을
                넣으면 padding shorthand가 뒤에서 덮어써 무효가 되므로 스페이서로 둘 것.
                (Phase 56) */}
            <div aria-hidden style={{ height: '100vh', flexShrink: 0 }} />
          </div>
        </div>
        </div>
      </div>

      {/* 댓글/agent 패널 — 우측 슬라이드 (ProblemView와 동일 패턴) */}
      {panelMode && user && problem && (
        <CommentPanel
          problemId={problem.id}
          ownerUid={problem.authorUid || ''}
          tabs={tabs}
          activeTabId={activeTab}
          currentUid={user.uid}
          canComment={canCommentOnProblem(problem, user.uid)}
          mode={panelMode}
          bodyFontSize={contentFontSize}
          onClose={() => { setPanelMode(null); loadSessions(); }}
          onCommentsChange={setAllComments}
          onInsertGraphBlock={handleInsertGraphBlock}
          onInsertToEditor={handleInsertFromChat}
          onRunVerify={handleRunVerify}
          onJumpToBlock={handleJumpToBlock}
          verifyCharCount={verifyCharCount}
          width={comment.width}
        />
      )}

      {/* ─── Phase 62 D12: 토론 패널 좌측변 드래그 리사이즈 핸들 ───
          offset = panelWidth + 3 → 10px strip의 가운데가 U자 컨텐츠 우측 경계선(panelWidth+8)에 온다 */}
      {activeResizeHandle === 'comment' && (
        <DrawerResizeHandle
          side="right"
          offset={comment.width + 3}
          active={comment.dragging || comment.hover}
          {...comment.handleProps}
        />
      )}
    </div>
  );
}