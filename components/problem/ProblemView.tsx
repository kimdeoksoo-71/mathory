'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ProblemWithBlocks, TabMeta, DEFAULT_TABS, Folder, Block } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, TRASH_FOLDER_ID } from '../../lib/firestore';
import { DIFFICULTIES, CATEGORY_OPTIONS } from '../../lib/constants';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import PdfDialog from './PdfDialog';
import { printProblemPdf, PdfPrintTab } from '../../lib/pdfPrint';
import {
  IconEdit, IconRename, IconFolderMove, IconTrash, IconCopy, IconCheck, IconDownload,
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
  const base = formatDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${base} : ${hh}-${mi}`;
}

export default function ProblemView({
  problemId, folders, onRename, onEdit, onDuplicate, onTrash, onUpdated, onNavigateFolder,
}: ProblemViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [openTabs, setOpenTabs] = useState<Record<string, boolean>>({});
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
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
    }
    setLoading(false);
  }, [problemId]);

  useEffect(() => { load(); }, [load]);

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
          <div key={block.id} style={{ textAlign: 'center', margin: '0.8em 0' }}>
            {src ? (
              <img src={src} alt="" style={{
                width: block.imageWidth || 400, maxWidth: '90%', height: 'auto',
              }} />
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(이미지 없음)</span>
            )}
          </div>
        );
      }
      if (isBordered) {
        return (
          <div key={block.id} style={{
            border: '1.5px solid var(--text-muted, #888)',
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

  const tabs = problem.tabs || DEFAULT_TABS;

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

  const menuItems = [
    { label: '편집', icon: <IconEdit size={14} />, action: () => onEdit?.(problem) },
    { label: '사본 만들기', icon: <IconCopy size={14} />, action: () => onDuplicate?.(problem) },
    { label: '이름 변경', icon: <IconRename size={14} />, action: () => onRename?.(problem) },
    { label: 'PDF 다운로드', icon: <IconDownload size={14} />, action: () => setPdfOpen(true) },
    { label: 'MD 다운로드', icon: <IconDownload size={14} />, action: handleDownloadMarkdown },
    { label: '휴지통', icon: <IconTrash size={14} />, action: () => onTrash?.(problem), danger: true },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'row',
      flex: 1, minHeight: 0, width: '100%',
      background: '#ffffff', fontSize: contentFontSize,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ 왼쪽 + 가운데: 본문 스크롤 컨테이너 (sticky 호환을 위해 비-flex) ═══ */}
      <div className="no-scrollbar" style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
        background: 'var(--bg-primary, #FAF9F7)',
      }}>
        {/* ─── 가운데 영역: 각 행이 [라벨 | 본문] 구조 ─── */}
        <div style={{
          width: 'fit-content',
          margin: '0 auto',
          padding: '0 32px',
          boxSizing: 'border-box',
        }}>
          {(() => {
            const fid = problem.folder_id || '';
            const isTrash = fid === TRASH_FOLDER_ID;
            const folderLabel = isTrash
              ? '휴지통'
              : (folders.find((f) => f.id === fid)?.name || '미분류');
            const targetId = isTrash ? TRASH_FOLDER_ID : (fid || '__unassigned__');

            const LABEL_GAP = 28; // 라벨↔본문 간격
            const labelColStyle: React.CSSProperties = {
              width: '7em', flexShrink: 0,
              textAlign: 'left', fontFamily: 'var(--font-ui)',
            };
            const mainColStyle: React.CSSProperties = {
              width: '35em', flexShrink: 0,
            };

            return (
              <>
                {/* 헤더 행: [폴더명 | 제목] — 스크롤 시 최상단 고정 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: LABEL_GAP,
                  marginBottom: 24,
                  position: 'sticky', top: 0, zIndex: 5,
                  background: 'var(--bg-primary, #FAF9F7)',
                  paddingTop: 32, paddingBottom: 16,
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ ...labelColStyle, display: 'flex', justifyContent: 'flex-start' }}>
                    <div
                      onClick={() => onNavigateFolder?.(targetId)}
                      style={{
                        fontSize: 12, color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      title="폴더로 이동"
                    >
                      <IconChevronLeft size={14} />
                      {folderLabel}
                    </div>
                  </div>
                  <h1
                    onClick={() => onEdit?.(problem)}
                    style={{
                      ...mainColStyle,
                      fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
                      margin: 0, lineHeight: 1.2,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer', transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    title="클릭하여 편집"
                  >
                    {problem.title}
                  </h1>
                </div>

                {/* 탭 행: [탭 라벨 | 탭 본문] — 라벨은 항상 표시, 본문은 토글 */}
                {tabs.map((tab, tabIdx) => {
                  const blocks = problem.tabBlocks[tab.id] || [];
                  const count = blocks.length;
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
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyTabMarkdown(tab.id); }}
                          title="Markdown 복사"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, border: 'none', background: 'none',
                            cursor: 'pointer', borderRadius: 4, padding: 0,
                            color: copiedTab === tab.id ? '#34a853' : 'var(--text-faint)',
                            transition: 'color 0.2s',
                          }}
                        >
                          {copiedTab === tab.id ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
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
                          {tab.label} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({count})</span>
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{
                          ...mainColStyle,
                          ...(isQuestion ? {
                            background: '#ffffff',
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

                {/* 하단 여백 */}
                <div style={{ height: '70vh' }} />
              </>
            );
          })()}
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
        borderLeft: '1px solid var(--border-light)',
        overflowY: 'auto',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        background: '#ffffff',
        position: 'relative',
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
        {/* 메뉴 모음 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...metaLabelStyle, marginBottom: 8 }}>메뉴</div>
          {menuItems.map((item, i) =>
            item.label === 'divider' ? (
              <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '8px 0' }} />
            ) : (
              <button
                key={i}
                onClick={item.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '7px 10px',
                  border: 'none', background: 'none', cursor: 'pointer',
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
                {item.label}
              </button>
            )
          )}
        </div>

        {/* 메타 데이터 */}
        <div style={metaRowStyle}>
          <div style={metaLabelStyle}>폴더</div>
          <select
            value={problem.folder_id || ''}
            onChange={(e) => updateField({ folder_id: e.target.value || undefined } as any)}
            onFocus={inputFocus}
            onBlur={inputBlur}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">미분류</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div style={metaRowStyle}>
          <div style={metaLabelStyle}>대단원</div>
          <select
            value={problem.category || ''}
            onChange={(e) => updateField({ category: e.target.value, subject: e.target.value } as any)}
            onFocus={inputFocus}
            onBlur={inputBlur}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">선택</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div style={metaRowStyle}>
          <div style={metaLabelStyle}>배점</div>
          <select
            value={problem.difficulty}
            onChange={(e) => updateField({ difficulty: Number(e.target.value) } as any)}
            onFocus={inputFocus}
            onBlur={inputBlur}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div style={metaRowStyle}>
          <div style={metaLabelStyle}>정답</div>
          <input
            value={problem.answer || ''}
            onChange={(e) => setProblem({ ...problem, answer: e.target.value })}
            onBlur={(e) => { inputBlur(e); updateField({ answer: e.target.value } as any); }}
            onFocus={inputFocus}
            placeholder="정답"
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-faint)', marginRight: 6 }}>생성</span>
            {formatDate(problem.created_at)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-faint)', marginRight: 6 }}>최종수정</span>
            {formatDateTime(problem.updated_at)}
          </div>
        </div>
      </div>}

      <PdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        tabs={tabs}
        onConfirm={handlePdfConfirm}
        isPrinting={isPrinting}
      />
    </div>
  );
}
