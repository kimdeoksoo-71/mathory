'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ProblemWithBlocks, TabMeta, DEFAULT_TABS, Folder, Block } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, TRASH_FOLDER_ID } from '../../lib/firestore';
import { getFolderPath } from '../../lib/folder-tree';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import { DIFFICULTIES, CATEGORY_OPTIONS } from '../../lib/constants';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import SvgViewer from '../viewer/SvgViewer';
import GgbViewer from '../viewer/GgbViewer';
import PdfDialog from './PdfDialog';
import CopyrightPanel from './CopyrightPanel';
import BlockchainBadge from '../ui/BlockchainBadge';
import useAuth from '../../hooks/useAuth';
import { printProblemPdf, PdfPrintTab } from '../../lib/pdfPrint';
import SharePanel from '../editor/SharePanel';
import CommentPanel from '../comment/CommentPanel';
import { getUserProfile } from '../../lib/users';
import { watchAllComments, countByTab } from '../../lib/comments';
import { canComment as canCommentOnProblem } from '../../lib/membership';
import { UserProfile, TabComment } from '../../types/problem';
import {
  IconEdit, IconRename, IconFolderMove, IconTrash, IconCopy, IconCheck, IconDownload, IconShare,
  IconDocLines,
  IconChevron, IconChevronLeft,
} from '../ui/Icons';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

interface ProblemViewProps {
  problemId: string;
  folders: Folder[];
  onRename?: (problem: ProblemWithBlocks) => void;
  onEdit?: (problem: ProblemWithBlocks) => void;
  onDuplicate?: (problem: ProblemWithBlocks) => void;
  onMoveFolder?: (problem: ProblemWithBlocks) => void;
  onTrash?: (problem: ProblemWithBlocks) => void;
  onUpdated?: () => void;
  onNavigateFolder?: (folderId: string) => void;
}

function formatDate(d?: Date): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDateTime(d?: Date): string {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} : ${hh}-${mi}-${ss}`;
}

/** 하단 정보 한 줄: [라벨(고정 폭)] [값] — 라벨 폭 통일로 값 시작 x 정렬 */
function BottomRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 6, fontSize: 11, color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
    }}>
      <span style={{ color: 'var(--text-faint)', width: 52, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

/** 문제정보 한 줄: [라벨 ......... [값(고정 폭, 우측 정렬)]] */
function CompactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', fontSize: 12,
      fontFamily: 'var(--font-ui)',
      color: 'var(--text-muted)',
    }}>
      <span style={{ color: 'var(--text-faint)', flex: 1 }}>{label}</span>
      <div style={{
        width: 130, flexShrink: 0,
        display: 'flex', justifyContent: 'flex-end',
      }}>
        {children}
      </div>
    </div>
  );
}

export default function ProblemView({
  problemId, folders, onRename, onEdit, onDuplicate, onTrash, onUpdated, onNavigateFolder,
}: ProblemViewProps) {
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [openTabs, setOpenTabs] = useState<Record<string, boolean>>({});
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Phase 40: 폴더 라벨 hover 시 상위 폴더 경로 펼침
  // 레이아웃 폭은 절대 불변(라벨 박스 7em 고정) → 제목은 transform 슬라이드, 경로는 absolute 오버레이.
  // (가운데 컨테이너가 width:fit-content + margin:auto라 폭이 커지면 좌측으로 재정렬되므로 폭 불변이 필수)
  const [folderPathHover, setFolderPathHover] = useState(false);
  const folderPathRef = useRef<HTMLDivElement>(null);   // 경로 자연폭 측정
  const labelBoxRef = useRef<HTMLDivElement>(null);     // 라벨 박스(7em) 실폭 측정
  const [titleSlide, setTitleSlide] = useState(0);      // 제목을 우측으로 밀 px
  // 제목 슬라이드량 = 경로가 라벨 박스(7em)를 넘어서는 폭 (경로폭 - 라벨박스폭)
  useEffect(() => {
    if (folderPathRef.current) {
      const pathW = folderPathRef.current.scrollWidth;
      const boxW = labelBoxRef.current?.offsetWidth ?? 0;
      setTitleSlide(Math.max(0, pathW - boxW));
    }
  }, [problem, folders]);

  // Phase 1.5: 문제정보 펼침 상태 (localStorage 기억, 기본 접힘)
  const PROBLEM_INFO_KEY = 'mathory-problem-info-open';
  const [problemInfoOpen, setProblemInfoOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROBLEM_INFO_KEY);
      if (stored === '1') setProblemInfoOpen(true);
    } catch {}
  }, []);
  const toggleProblemInfo = () => {
    setProblemInfoOpen((v) => {
      const next = !v;
      try { localStorage.setItem(PROBLEM_INFO_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };
  // 저자 프로필
  const [authorProfile, setAuthorProfile] = useState<UserProfile | null>(null);
  // 댓글 — 패널 열림 여부, 활성 탭, 카운트
  const [commentPanelTab, setCommentPanelTab] = useState<string | null>(null);
  // Phase 44: 댓글 패널 드래그 리사이즈 (우측). 기본 420px (75% of 560)
  const [panelWidth, setPanelWidth] = useState(420);
  const [resizeHover, setResizeHover] = useState(false);
  const [resizeDragging, setResizeDragging] = useState(false);
  const [allComments, setAllComments] = useState<TabComment[]>([]);
  const commentCounts = useMemo(
    () => countByTab(allComments, { unresolvedOnly: true }),
    [allComments],
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  /* ─── 데이터 로드 ─── */
  const load = useCallback(async () => {
    setLoading(true);
    const data = await getProblemWithBlocks(problemId);
    setProblem(data);
    if (data) {
      const tabs = data.tabs || DEFAULT_TABS;
      // 기본: 모든 탭 펼침
      const next: Record<string, boolean> = {};
      tabs.forEach((t) => { next[t.id] = true; });
      setOpenTabs(next);
      // 저자 프로필 로드 (실패는 조용히 무시)
      if (data.authorUid) {
        getUserProfile(data.authorUid).then(setAuthorProfile).catch(() => setAuthorProfile(null));
      }
    }
    setLoading(false);
  }, [problemId]);

  useEffect(() => { load(); }, [load]);

  // 댓글 실시간 구독 — 삭제·추가가 즉시 반영되도록 (권한 오류는 조용히 빈 배열)
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

  /* ─── 글꼴 크기 로드 ─── */
  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FONT_SIZE_KEY && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (!isNaN(n)) setContentFontSize(n);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /* ─── 탭 토글 ─── */
  const toggleTab = (tabId: string) => {
    setOpenTabs((prev) => ({ ...prev, [tabId]: !prev[tabId] }));
  };

  /* ─── 탭 Markdown 복사 ─── */
  const handleCopyTabMarkdown = async (tabId: string) => {
    if (!problem) return;
    const blocks = problem.tabBlocks[tabId] || [];
    const markdown = blocks.map((b) => b.raw_text).join('\n\n');
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedTab(tabId);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  /* ─── 메타 인라인 편집 (undefined 는 빈 문자열로 변환 — Firestore가 undefined 거부) ─── */
  const updateField = async (patch: Record<string, any>) => {
    if (!problem) return;
    const clean: Record<string, any> = {};
    for (const k in patch) {
      clean[k] = patch[k] === undefined ? '' : patch[k];
    }
    setProblem({ ...problem, ...clean } as ProblemWithBlocks);
    try {
      await updateProblem(problem.id, clean as any);
      onUpdated?.();
    } catch (err) {
      console.error('저장 실패:', err);
    }
  };

  /* ─── MD 다운로드 ─── */
  const handleDownloadMarkdown = () => {
    if (!problem) return;
    const tabs = problem.tabs || DEFAULT_TABS;
    let md = `# ${problem.title}\n\n`;
    for (const tab of tabs) {
      const blocks = problem.tabBlocks[tab.id] || [];
      if (blocks.length === 0) continue;
      md += `## ${tab.label}\n\n`;
      md += blocks.map((b) => b.raw_text).join('\n\n');
      md += '\n\n';
    }
    const safeTitle = problem.title.replace(/[\/\\:*?"<>|]/g, '_').trim() || '수학 문제';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ─── PDF ─── */
  const handlePdfConfirm = async (selectedTabIds: string[]) => {
    if (!problem) return;
    setIsPrinting(true);
    try {
      const tabs = problem.tabs || DEFAULT_TABS;
      const printTabs: PdfPrintTab[] = tabs
        .filter((t) => selectedTabIds.includes(t.id))
        .map((t) => ({
          label: t.label,
          blocks: (problem.tabBlocks[t.id] || []).map((b) => ({
            id: b.id, type: b.type, raw_text: b.raw_text, imageWidth: b.imageWidth,
            imageTreatment: b.imageTreatment, imageGray: b.imageGray,
            svg_initial_view: b.svg_initial_view, svg_height: b.svg_height,
            ggb_initial_coords: b.ggb_initial_coords, ggb_height: b.ggb_height,
          })),
        }));
      await printProblemPdf({ title: problem.title, tabs: printTabs });
    } catch (e) {
      console.error('PDF 생성 오류:', e);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
      setPdfOpen(false);
    }
  };

  /* ─── 블록 렌더 (EditorView 미리보기와 동일 규칙) ─── */
  const renderBlocks = (blocks: Block[]) => {
    return blocks.map((block, i) => {
      const isBordered = BORDERED_TYPES.has(block.type);
      const headingTopPad = block.type === 'heading' && i !== 0 ? '1.5em' : undefined;
      if (block.type === 'image') {
        const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
        return (
          <div key={block.id} style={{ textAlign: 'center', margin: '1.2em 0' }}>
            {src ? (
              <img src={src} alt="" style={{
                width: block.imageWidth || 400, maxWidth: '90%', height: 'auto',
                ...imageTreatmentStyle(block),
              }} />
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(이미지 없음)</span>
            )}
          </div>
        );
      }
      if (block.type === 'svg') {
        return (
          <div key={block.id} style={{ margin: '0.8em 0' }}>
            {block.raw_text ? (
              <SvgViewer
                url={block.raw_text}
                initialView={block.svg_initial_view}
                height={block.svg_height || 300}
                enableFullscreen
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(SVG 없음)</div>
            )}
          </div>
        );
      }
      if (block.type === 'ggb') {
        return (
          <div key={block.id} style={{ margin: '0.8em 0' }}>
            {block.raw_text ? (
              <GgbViewer
                url={block.raw_text}
                initialCoords={block.ggb_initial_coords}
                height={block.ggb_height || 350}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(GeoGebra 없음)</div>
            )}
          </div>
        );
      }
      if (isBordered) {
        return (
          <div key={block.id} style={{
            border: '0.7px solid var(--text-primary)',
            borderRadius: 0, padding: '12px 16px', margin: '1.2em 0',
          }}>
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </div>
        );
      }
      if (block.type === 'choices') {
        return (
          <div key={block.id}>
            <ChoicesBlock rawText={block.raw_text} locale="ko" />
          </div>
        );
      }
      return (
        <div key={block.id} data-block-id={block.id} style={{ paddingTop: headingTopPad }}>
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
      );
    });
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }

  const allTabs = problem.tabs || DEFAULT_TABS;
  // Stage 2: 멤버는 memberTabVisibility에 따라 일부 탭만 봄. 오너는 항상 모두.
  const isOwnerView = !!user && (!problem.authorUid || user.uid === problem.authorUid);
  const tabs = isOwnerView
    ? allTabs
    : allTabs.filter((t) => problem.memberTabVisibility?.[t.id] !== false);
  const isMemberView = !isOwnerView && !!user && (problem.memberUids?.includes(user.uid) ?? false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
    boxSizing: 'border-box',
  };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'var(--accent-primary)';
    e.target.style.background = 'var(--bg-hover)';
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'transparent';
    e.target.style.background = 'transparent';
  };

  const metaLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    letterSpacing: 0.3, marginBottom: 4, fontFamily: 'var(--font-ui)',
  };
  const metaRowStyle: React.CSSProperties = { marginBottom: 14 };

  const compactInputStyle = (editable: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none', background: 'transparent',
    fontSize: 12, color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)', textAlign: 'right',
    cursor: editable ? 'pointer' : 'default',
    padding: '2px 0', outline: 'none',
    boxSizing: 'border-box',
  });

  interface MenuItem {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    danger?: boolean;
    /** 공유 항목 — 클릭 시 인라인 펼침. > 기호가 우측에 표시되고 ↓로 회전. */
    kind?: 'share' | 'spacer';
  }

  const menuItems: MenuItem[] = isOwnerView ? [
    { label: '편집', icon: <IconEdit size={14} />, action: () => onEdit?.(problem) },
    { label: '사본 만들기', icon: <IconCopy size={14} />, action: () => onDuplicate?.(problem) },
    { label: 'PDF 다운로드', icon: <IconDownload size={14} />, action: () => setPdfOpen(true) },
    { label: 'MD 다운로드', icon: <IconDownload size={14} />, action: handleDownloadMarkdown },
    { label: '휴지통', icon: <IconTrash size={14} />, action: () => onTrash?.(problem), danger: true },
    { label: 'spacer', icon: null, action: () => {}, kind: 'spacer' },
    { label: '공유', icon: <IconShare size={14} />, action: () => setShareOpen((v) => !v), kind: 'share' },
  ] : [
    // 멤버 / 공유받은 사용자: 편집 관련 메뉴 제거. 다운로드는 허용.
    { label: 'PDF 다운로드', icon: <IconDownload size={14} />, action: () => setPdfOpen(true) },
    { label: 'MD 다운로드', icon: <IconDownload size={14} />, action: handleDownloadMarkdown },
  ];

  // ─── Phase 44: 댓글 패널 드래그 리사이즈 핸들러 (우측 패널만) ───
  const PANEL_MIN = 360;
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeDragging(true);
    const onMove = (ev: PointerEvent) => {
      // 핸들 = U자 컨텐츠 우측 경계선(콘텐츠 우측 끝 = panelWidth + 24px 갭). 경계선을 커서에 맞춤.
      const next = window.innerWidth - ev.clientX - 24;
      setPanelWidth(Math.max(PANEL_MIN, Math.min(window.innerWidth * 0.9, next)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizeDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const resizeActive = resizeHover || resizeDragging;

  // ─── 제목바용 계산값 (IIFE에서 컴포넌트 스코프로 호이스팅) ───
  const fid = problem.folder_id || '';
  const isTrash = fid === TRASH_FOLDER_ID;
  const folderLabel = isTrash ? '휴지통' : (folders.find((f) => f.id === fid)?.name || '미분류');
  const targetId = isTrash ? TRASH_FOLDER_ID : (fid || '__unassigned__');
  const folderPath = (!isTrash && fid) ? getFolderPath(folders, fid) : [];
  const hasAncestors = folderPath.length > 1;
  const expanded = folderPathHover && hasAncestors;
  const LABEL_GAP = 28; // 라벨↔본문 간격
  const labelColStyle: React.CSSProperties = {
    width: 7 * contentFontSize, flexShrink: 0,
    textAlign: 'left', fontFamily: 'var(--font-ui)',
  };
  const mainColStyle: React.CSSProperties = {
    width: 35 * contentFontSize, flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0, width: '100%',
      background: 'var(--bg-functional)', fontSize: contentFontSize,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ 제목바: U자 밖 아이보리 chrome — [폴더경로 | 제목]. 아래 빈 공간은 추후 메타데이터 ═══ */}
      <div style={{
        flexShrink: 0, background: 'var(--bg-functional)',
        minHeight: 98, // EditorView(제목 57 + 탭 41)와 가로 경계선 Y 일치
        paddingRight: commentPanelTab ? `calc(${panelWidth}px + 24px)` : 0,
        transition: 'padding-right 0.18s ease',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: LABEL_GAP,
          padding: '22px 32px 0', boxSizing: 'border-box', // 제목을 위에서 내림(#7), 아래 빈 공간은 추후 메타데이터
        }}>
          {/* 헤더 라벨 박스 — 폭 7em 고정. 경로는 absolute 오버레이, 제목은 transform 슬라이드 */}
          <div
            ref={labelBoxRef}
            onMouseEnter={() => { if (hasAncestors) setFolderPathHover(true); }}
            onMouseLeave={() => setFolderPathHover(false)}
            style={{
              ...labelColStyle,
              position: 'relative', height: '1.5em',
              display: 'flex', alignItems: 'center',
            }}
          >
            {/* 접힘: ‹ leaf 폴더명 */}
            <div
              onClick={() => onNavigateFolder?.(targetId)}
              style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer',
                opacity: expanded ? 0 : 1, pointerEvents: expanded ? 'none' : 'auto',
                transition: 'opacity 0.15s, color 0.15s',
                maxWidth: '7em', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title={hasAncestors ? '폴더로 이동 (hover 시 전체 경로)' : '폴더로 이동'}
            >
              <IconChevronLeft size={14} />
              {folderLabel}
            </div>
            {/* 펼침: 전체 경로 (측정용으로 항상 렌더, 평소 opacity 0) */}
            {hasAncestors && (
              <div
                ref={folderPathRef}
                style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none',
                  transition: 'opacity 0.2s',
                  background: 'var(--bg-functional)', paddingRight: 8, zIndex: 2,
                }}
              >
                {folderPath.map((seg, i) => (
                  <span key={seg.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
                    <span
                      onClick={() => onNavigateFolder?.(seg.id)}
                      style={{
                        cursor: 'pointer', transition: 'color 0.15s',
                        fontWeight: i === folderPath.length - 1 ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      title={`${seg.name}(으)로 이동`}
                    >
                      {seg.name}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <h1
            onClick={() => { if (isOwnerView) onEdit?.(problem); }}
            style={{
              ...mainColStyle,
              fontSize: 22, fontWeight: 600, color: 'var(--text-primary)',
              margin: 0, lineHeight: 1.2,
              fontFamily: 'var(--font-ui)',
              cursor: isOwnerView ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center',
              transform: expanded ? `translateX(${titleSlide}px)` : 'translateX(0)',
              transition: 'color 0.15s, transform 0.25s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            title="클릭하여 편집"
          >
            <span>{problem.title}</span>
            <BlockchainBadge problem={problem} size={16} />
          </h1>
        </div>
      </div>

      {/* ═══ 컨텐츠 행: 본문 + 메타 (패널·핸들은 컨테이너 직속, 전체 높이) ═══ */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
      {/* ═══ 왼쪽 + 가운데: 본문 스크롤 컨테이너 ═══ */}
      {/* 외부 래퍼: 패널 자리 확보(아이보리 백드롭), 경계선 없음 — 패널과 컨텐츠가 절대 겹치지 않음 */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', minHeight: 0,
        paddingRight: commentPanelTab ? `calc(${panelWidth}px + 24px)` : 0,
        transition: 'padding-right 0.18s ease',
      }}>
        {/* 내부 U-프레임: 클레이 + 3면 경계 + 상단 14px 라운드 (스크롤). 패널 열려도 경계선 유지 */}
        <div className="no-scrollbar" style={{
          flex: 1, minWidth: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'var(--bg-content)',
          borderTop: '0.5px solid var(--border-content)',
          borderLeft: '0.5px solid var(--border-content)',
          borderRight: '0.5px solid var(--border-content)',
          borderTopLeftRadius: 10, borderTopRightRadius: 10,
          display: 'flex',
          // 패널 열림: 우측 정렬 → 컨텐츠 우측 끝이 경계선에 붙어 함께 왼쪽으로 이동(가려지지 않음)
          justifyContent: commentPanelTab ? 'unsafe flex-end' : 'center',
        }}>
        {/* ─── 가운데 영역: 각 행이 [라벨 | 본문] 구조 ─── */}
        <div style={{
          display: 'table',
          padding: '0 32px', // 좌우 32px 유지 — 우측 경계선과 컨텐츠 사이 여백 보존
          boxSizing: 'border-box',
          flexShrink: 0,
        }}>
          {(() => {
            return (
              <>
                {/* 탭 행: [탭 라벨 | 탭 본문] — 라벨은 항상 표시, 본문은 토글 */}
                {tabs.map((tab, tabIdx) => {
                  const blocks = problem.tabBlocks[tab.id] || [];
                  const isOpen = !!openTabs[tab.id];
                  const isQuestion = tab.id === 'question';
                  return (
                    <div key={tab.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: LABEL_GAP,
                      marginTop: tabIdx === 0 ? 24 : 0,
                      marginBottom: isOpen ? '5em' : '1.5em',
                    }}>
                      <div style={{
                        ...labelColStyle,
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4,
                        paddingTop: isOpen ? 14 : 0,
                      }}>
                        <span
                          onClick={() => toggleTab(tab.id)}
                          style={{
                            fontSize: 12, fontWeight: 600,
                            color: isOpen ? 'var(--text-muted)' : 'var(--text-faint)',
                            letterSpacing: 0.5,
                            cursor: 'pointer', userSelect: 'none',
                          }}
                          title={isOpen ? '탭 접기' : '탭 펼치기'}
                        >
                          {tab.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyTabMarkdown(tab.id); }}
                          title="Markdown 복사"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, border: 'none', background: 'none',
                            cursor: 'pointer', borderRadius: 4, padding: 0,
                            color: copiedTab === tab.id ? 'var(--accent-success)' : 'var(--text-faint)',
                            transition: 'color 0.2s',
                          }}
                        >
                          {copiedTab === tab.id ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                        {/* 댓글 버튼 — 로그인했고 본인 문항 OR 멤버일 때만 표시 */}
                        {user && (isOwnerView || isMemberView) && (
                          <button
                            onClick={() => setCommentPanelTab((cur) => cur === tab.id ? null : tab.id)}
                            title="댓글 열기"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 2,
                              border: 'none', background: 'none', cursor: 'pointer',
                              padding: '2px 4px', borderRadius: 4,
                              fontSize: 11, color: commentPanelTab === tab.id ? 'var(--accent-primary)' : 'var(--text-faint)',
                              fontFamily: 'var(--font-ui)',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                            onMouseLeave={(e) => {
                              if (commentPanelTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)';
                            }}
                          >
                            💬{commentCounts[tab.id] ? ` ${commentCounts[tab.id]}` : ''}
                          </button>
                        )}
                      </div>
                      {isOpen && (
                        <div style={{
                          ...mainColStyle,
                          ...(isQuestion ? {
                            background: 'var(--bg-content)',
                            padding: '20px 24px',
                            borderRadius: 8,
                            marginLeft: -24,
                          } : {}),
                        }}>
                          <div className="problem-content-scaled problem-content-toned">
                            <style>{`.problem-content-scaled > div { font-size: ${contentFontSize}px !important; }`}</style>
                            {renderBlocks(blocks)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 하단 여백 — width:0으로 fit-content 부모의 폭 계산에 영향 안 주도록 */}
                <div style={{ height: '70vh', width: 0 }} />
              </>
            );
          })()}
        </div>
        </div>
      </div>

      {/* ═══ 오른쪽 단 열기 버튼 (닫혔을 때만) ═══ */}
      {!rightOpen && (
        <button
          onClick={() => setRightOpen(true)}
          title="우측 패널 열기"
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-light)', borderRadius: 8,
            background: 'var(--bg-card)', cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          <IconChevronLeft size={14} />
        </button>
      )}

      {/* ═══ 오른쪽 단: 독립 스크롤, 탭 + 메뉴 + 메타 ═══ */}
      {rightOpen && <div style={{
        flex: 1, minWidth: 150, maxWidth: 220,
        padding: '32px 16px',
        overflowY: 'auto',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        background: 'var(--bg-functional)',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 우측 패널 닫기 버튼 */}
        <button
          onClick={() => setRightOpen(false)}
          title="우측 패널 닫기"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 6,
            background: 'transparent', cursor: 'pointer',
            color: 'var(--text-faint)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
        >
          <IconChevron size={14} />
        </button>
        {/* ───── 메뉴 모음 (편집/사본/PDF/MD/휴지통 → spacer → 공유) ───── */}
        <div style={{ marginBottom: 18 }}>
          {menuItems.map((item, i) => {
            if (item.kind === 'spacer') {
              return <div key={i} style={{ height: 14 }} />;
            }
            const isShare = item.kind === 'share';
            const isExpanded = isShare && shareOpen;
            return (
              <div key={i}>
                <button
                  onClick={item.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '7px 10px',
                    border: 'none', background: 'none',
                    cursor: 'pointer',
                    fontSize: 13, fontFamily: 'var(--font-ui)',
                    color: item.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                    borderRadius: 6, textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = item.danger
                      ? 'var(--accent-danger-bg, rgba(229,57,53,0.08))'
                      : 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'none';
                  }}
                >
                  <span style={{ opacity: 0.7, display: 'flex' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isShare && (
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)',
                      transition: 'transform 0.15s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>
                      <IconChevron size={12} />
                    </span>
                  )}
                </button>
                {isShare && isExpanded && user && (
                  <div style={{ padding: '6px 10px 10px' }}>
                    <SharePanel
                      problemId={problem.id}
                      ownerUid={user.uid}
                      tabs={allTabs}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ───── 문제정보 (폴더/대단원/배점/정답 통합, 접힘 토글) ───── */}
        <div style={{ marginBottom: 18 }}>
          <button onClick={toggleProblemInfo}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 10px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              color: 'var(--text-primary)', borderRadius: 6, textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <span style={{ opacity: 0.7, display: 'flex' }}><IconDocLines size={14} /></span>
            <span style={{ flex: 1 }}>문제정보</span>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'transform 0.15s',
              transform: problemInfoOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              <IconChevron size={12} />
            </span>
          </button>

          {problemInfoOpen && (
            <div style={{ padding: '6px 10px 4px' }}>
              <CompactRow label="폴더">
                <select
                  value={problem.folder_id || ''}
                  onChange={(e) => updateField({ folder_id: e.target.value || undefined } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  <option value="">미분류</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="대단원">
                <select
                  value={problem.category || ''}
                  onChange={(e) => updateField({ category: e.target.value, subject: e.target.value } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  <option value="">선택</option>
                  {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="배점">
                <select
                  value={problem.difficulty}
                  onChange={(e) => updateField({ difficulty: Number(e.target.value) } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="정답">
                <input
                  value={problem.answer || ''}
                  onChange={(e) => setProblem({ ...problem, answer: e.target.value })}
                  onBlur={(e) => updateField({ answer: e.target.value } as any)}
                  placeholder="정답"
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                />
              </CompactRow>
            </div>
          )}
        </div>

        {/* ───── 하단 정보 묶음: 저자 / 생성 / 수정 / 원본인증 — 사이드바 맨 아래로 ───── */}
        <div style={{
          marginTop: 'auto', paddingTop: 14,
          borderTop: '1px solid var(--border-light)',
        }}>
          {/* 저자 / 생성 / 수정 — 라벨 width 동일하게 맞춰 값 시작 x 정렬 */}
          {problem.authorUid && (
            <BottomRow label="Writer">
              {authorProfile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authorProfile.photoURL} alt={authorProfile.displayName}
                  referrerPolicy="no-referrer"
                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 600, color: '#666',
                }}>
                  {((authorProfile?.email || authorProfile?.displayName || '?').charAt(0)).toUpperCase()}
                </div>
              )}
              <span style={{ color: 'var(--text-secondary)' }}>
                {(authorProfile?.email || '').split('@')[0] || authorProfile?.displayName || '—'}
              </span>
            </BottomRow>
          )}
          <BottomRow label="Created">{formatDateTime(problem.created_at)}</BottomRow>
          <BottomRow label="Modified">{formatDateTime(problem.updated_at)}</BottomRow>
          <div style={{ height: 10 }} />
          {/* 원본인증 */}
          <CopyrightPanel
            problem={problem}
            isOwner={!!user && (!problem.authorUid || user.uid === problem.authorUid)}
            currentUserUid={user?.uid}
            onUpdated={load}
          />
        </div>
      </div>}
      </div>

      <PdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        tabs={tabs}
        onConfirm={handlePdfConfirm}
        isPrinting={isPrinting}
      />

      {/* 댓글 패널 — 우측 슬라이드 */}
      {commentPanelTab && user && (
        <CommentPanel
          problemId={problem.id}
          ownerUid={problem.authorUid || ''}
          tabs={tabs}
          activeTabId={commentPanelTab}
          currentUid={user.uid}
          canComment={canCommentOnProblem(problem, user.uid)}
          bodyFontSize={contentFontSize}
          onClose={() => setCommentPanelTab(null)}
          onCommentsChange={setAllComments}
          width={panelWidth}
        />
      )}

      {/* 댓글 패널 좌측변 드래그 리사이즈 핸들 (우측 패널만) */}
      {commentPanelTab && (
        <div
          onPointerEnter={() => setResizeHover(true)}
          onPointerLeave={() => setResizeHover(false)}
          onPointerDown={handleResizeStart}
          style={{
            position: 'absolute', top: 0, bottom: 0,
            right: `calc(${panelWidth}px + 19px)`, // U자 컨텐츠 우측 경계선(panelWidth+24) 위에 strip 걸침
            width: 10, zIndex: 100, cursor: 'col-resize',
            display: 'flex', justifyContent: 'center',
          }}
        >
          <div style={{
            width: resizeActive ? 1.5 : 0, height: '100%',
            background: 'var(--border-content-active)', transition: 'width 0.1s',
          }} />
        </div>
      )}
    </div>
  );
}
