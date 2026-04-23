'use client';

import { useState, useEffect, useCallback } from 'react';
import { Problem, Block, Folder } from '../../types/problem';
import { getQuestionBlocks, updateProblem, TRASH_FOLDER_ID, UNASSIGNED_FOLDER_ID } from '../../lib/firestore';
import { DIFFICULTIES, CATEGORY_OPTIONS } from '../../lib/constants';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import {
  IconEdit, IconRename, IconTrash, IconCopy, IconChevron, IconChevronLeft,
  IconFolder, IconInbox,
} from '../ui/Icons';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

/* ═══ 정렬 ═══ */
type SortKey = 'name' | 'updated';
type SortDir = 'asc' | 'desc';
interface SortState { key: SortKey; dir: SortDir; }
const SORT_KEY = 'mathory-folder-sort';
const DEFAULT_SORT: SortState = { key: 'updated', dir: 'desc' };
const SORT_KEY_LABELS: Record<SortKey, string> = { name: '이름', updated: '수정일' };

function loadSort(): SortState {
  if (typeof window === 'undefined') return DEFAULT_SORT;
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as SortState;
    if (parsed?.key && parsed?.dir) return parsed;
  } catch {}
  return DEFAULT_SORT;
}

function compareBySort(a: Problem, b: Problem, s: SortState): number {
  let v: number;
  if (s.key === 'name') {
    v = (a.title || '').localeCompare(b.title || '', 'ko');
  } else {
    const ta = a.updated_at ? a.updated_at.getTime() : 0;
    const tb = b.updated_at ? b.updated_at.getTime() : 0;
    v = ta - tb;
  }
  return s.dir === 'asc' ? v : -v;
}

interface FolderViewProps {
  folder: Folder;
  problems: Problem[];
  folders: Folder[];
  onEdit: (problem: Problem) => void;
  onView: (problem: Problem) => void;
  onProblemAction: (action: string, problem: Problem) => void;
  onEmptyTrash?: () => void;
  onUpdated?: () => void;
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
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} : ${hh}-${mi}`;
}

export default function FolderView({
  folder, problems, folders, onEdit, onView, onProblemAction, onEmptyTrash, onUpdated,
}: FolderViewProps) {
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [questionBlocksMap, setQuestionBlocksMap] = useState<Record<string, Block[]>>({});
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [rightOpen, setRightOpen] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  useEffect(() => { setSort(loadSort()); }, []);

  const updateSort = (next: SortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_KEY, JSON.stringify(next)); } catch {}
  };

  const isTrash = folder.id === TRASH_FOLDER_ID;
  const isUnassigned = folder.id === UNASSIGNED_FOLDER_ID;

  const folderProblems = problems
    .filter((p) => {
      if (isTrash) return p.folder_id === TRASH_FOLDER_ID;
      if (isUnassigned) return !p.folder_id || p.folder_id === '';
      return p.folder_id === folder.id;
    })
    .sort((a, b) => compareBySort(a, b, sort));

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
  }, []);

  useEffect(() => {
    if (folderProblems.length === 0) { setBlocksLoading(false); return; }
    setBlocksLoading(true);
    const loadBlocks = async () => {
      const map: Record<string, Block[]> = {};
      await Promise.all(
        folderProblems.map(async (p) => {
          try { map[p.id] = await getQuestionBlocks(p.id); } catch { map[p.id] = []; }
        })
      );
      setQuestionBlocksMap(map);
      setBlocksLoading(false);
    };
    loadBlocks();
  }, [folder.id, problems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectProblem = useCallback((problem: Problem) => {
    setSelectedProblemId(problem.id);
    setRightOpen(true);
  }, []);

  const selectedProblem = folderProblems.find((p) => p.id === selectedProblemId) || null;

  const updateField = async (patch: Record<string, any>) => {
    if (!selectedProblem) return;
    const clean: Record<string, any> = {};
    for (const k in patch) { clean[k] = patch[k] === undefined ? '' : patch[k]; }
    try {
      await updateProblem(selectedProblem.id, clean as any);
      onUpdated?.();
    } catch (err) {
      console.error('저장 실패:', err);
    }
  };

  const renderBlocks = (blocks: Block[]) => {
    return blocks.map((block, i) => {
      const isBordered = BORDERED_TYPES.has(block.type);
      const headingTopPad = block.type === 'heading' && i !== 0 ? '1.5em' : undefined;
      if (block.type === 'image') {
        const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
        return (
          <div key={block.id || `img-${i}`} style={{ textAlign: 'center', margin: '0.8em 0' }}>
            {src ? <img src={src} alt="" style={{ width: block.imageWidth || 400, maxWidth: '90%', height: 'auto' }} /> : null}
          </div>
        );
      }
      if (isBordered) {
        return (
          <div key={block.id || `b-${i}`} style={{ border: '1.5px solid var(--text-muted, #888)', borderRadius: 0, padding: '12px 16px', margin: '1.2em 0' }}>
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </div>
        );
      }
      if (block.type === 'choices') {
        return <div key={block.id || `c-${i}`}><ChoicesBlock rawText={block.raw_text} locale="ko" /></div>;
      }
      return (
        <div key={block.id || `t-${i}`} style={{ paddingTop: headingTopPad }}>
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
      );
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', border: '1px solid transparent',
    borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)', outline: 'none', transition: 'border-color 0.15s, background 0.15s',
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

  const menuItems = selectedProblem ? [
    ...(isTrash ? [
      { label: '복원', icon: <IconCopy size={14} />, action: () => { onProblemAction('restore', selectedProblem); setRightOpen(false); } },
      { label: '영구 삭제', icon: <IconTrash size={14} />, action: () => { onProblemAction('delete', selectedProblem); setRightOpen(false); }, danger: true },
    ] : [
      { label: '보기', icon: <IconChevron size={14} />, action: () => onView(selectedProblem) },
      { label: '편집', icon: <IconEdit size={14} />, action: () => onEdit(selectedProblem) },
      { label: '사본 만들기', icon: <IconCopy size={14} />, action: () => onProblemAction('duplicate', selectedProblem) },
      { label: '이름 변경', icon: <IconRename size={14} />, action: () => onProblemAction('rename', selectedProblem) },
      { label: '휴지통', icon: <IconTrash size={14} />, action: () => { onProblemAction('trash', selectedProblem); setRightOpen(false); }, danger: true },
    ]),
  ] : [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'row',
      flex: 1, minHeight: 0, width: '100%',
      background: '#ffffff', fontSize: contentFontSize,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ 왼쪽: 문제 리스트 스크롤 ═══ */}
      <div className="no-scrollbar" style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
      }}>
        <div style={{
          width: `calc(35em + 64px)`, margin: '0 auto',
          padding: '0 32px', boxSizing: 'border-box',
        }}>
          {/* 폴더명 헤더 (sticky) */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 5,
            background: '#ffffff', padding: '24px 0 12px 0',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: 24,
            fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
              {isUnassigned ? <IconInbox size={18} /> : isTrash ? <IconTrash size={18} /> : <IconFolder size={18} />}
            </span>
            <span>{folder.name}</span>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>
              ({folderProblems.length})
            </span>
            <div style={{ flex: 1 }} />
            {/* 정렬 컨트롤 */}
            <SortControls sort={sort} onChange={updateSort} />
            {isTrash && folderProblems.length > 0 && onEmptyTrash && (
              <button onClick={onEmptyTrash} style={{
                border: 'none', background: 'none',
                color: 'var(--accent-danger)', fontSize: 12, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontWeight: 500,
              }}>
                휴지통 비우기
              </button>
            )}
          </div>

          {blocksLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>로딩 중...</div>
          )}
          {!blocksLoading && folderProblems.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
              {isTrash ? '휴지통이 비어 있습니다.' : '이 폴더에 문항이 없습니다.'}
            </div>
          )}

          {!blocksLoading && folderProblems.map((problem) => {
            const blocks = questionBlocksMap[problem.id] || [];
            const isSelected = selectedProblemId === problem.id;
            return (
              <div key={problem.id} style={{ marginBottom: '5em' }}>
                <h2
                  onClick={() => handleSelectProblem(problem)}
                  onDoubleClick={() => onView(problem)}
                  style={{
                    fontSize: 18, fontWeight: 700, margin: '0 0 12px 0',
                    fontFamily: 'var(--font-ui)',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                >
                  {problem.title}
                </h2>
                <div className="problem-content-scaled">
                  <style>{`.problem-content-scaled > div { font-size: ${contentFontSize}px !important; }`}</style>
                  {renderBlocks(blocks)}
                </div>
              </div>
            );
          })}

          <div style={{ height: '70vh' }} />
        </div>
      </div>

      {/* ═══ 우측 패널 열기 버튼 ═══ */}
      {!rightOpen && (
        <button onClick={() => setRightOpen(true)} title="우측 패널 열기" style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border-light)', borderRadius: 8,
          background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
          <IconChevronLeft size={14} />
        </button>
      )}

      {/* ═══ 오른쪽 패널 ═══ */}
      {rightOpen && <div className="no-scrollbar" style={{
        flex: 1, minWidth: 150, maxWidth: 220,
        padding: '32px 16px', borderLeft: '1px solid var(--border-light)',
        overflowY: 'auto', fontSize: 13, fontFamily: 'var(--font-ui)',
        background: '#ffffff', position: 'relative',
      }}>
        <button onClick={() => setRightOpen(false)} title="우측 패널 닫기" style={{
          position: 'absolute', top: 8, right: 8, width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: 6, background: 'transparent',
          cursor: 'pointer', color: 'var(--text-faint)',
          transition: 'background 0.15s, color 0.15s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-faint)'; }}
        >
          <IconChevron size={14} />
        </button>

        {selectedProblem ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingRight: 24, color: 'var(--text-primary)' }}>
              {selectedProblem.title}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ ...metaLabelStyle, marginBottom: 8 }}>메뉴</div>
              {menuItems.map((item, i) => (
                <button key={i} onClick={item.action} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '7px 10px',
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'var(--font-ui)',
                  color: (item as any).danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                  borderRadius: 6, textAlign: 'left', transition: 'background 0.15s',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = (item as any).danger ? 'var(--accent-danger-bg, rgba(229,57,53,0.08))' : 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <span style={{ opacity: 0.7, display: 'flex' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {!isTrash && (
              <>
                <div style={metaRowStyle}>
                  <div style={metaLabelStyle}>폴더</div>
                  <select value={selectedProblem.folder_id || ''} onChange={(e) => updateField({ folder_id: e.target.value || '' })} onFocus={inputFocus} onBlur={inputBlur} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">미분류</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div style={metaRowStyle}>
                  <div style={metaLabelStyle}>대단원</div>
                  <select value={selectedProblem.category || ''} onChange={(e) => updateField({ category: e.target.value, subject: e.target.value })} onFocus={inputFocus} onBlur={inputBlur} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">선택</option>
                    {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div style={metaRowStyle}>
                  <div style={metaLabelStyle}>배점</div>
                  <select value={selectedProblem.difficulty} onChange={(e) => updateField({ difficulty: Number(e.target.value) })} onFocus={inputFocus} onBlur={inputBlur} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div style={metaRowStyle}>
                  <div style={metaLabelStyle}>정답</div>
                  <input
                    key={selectedProblem.id}
                    defaultValue={selectedProblem.answer || ''}
                    onBlur={(e) => { inputBlur(e); updateField({ answer: e.target.value }); }}
                    onFocus={inputFocus}
                    placeholder="정답"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-faint)', marginRight: 6 }}>생성</span>
                    {formatDate(selectedProblem.created_at)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--text-faint)', marginRight: 6 }}>최종수정</span>
                    {formatDateTime(selectedProblem.updated_at)}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
            문제 제목을 클릭하면<br />메타 정보가 표시됩니다.
          </div>
        )}
      </div>}
    </div>
  );
}

/* ═══ 정렬 컨트롤 ═══ */
function SortControls({ sort, onChange }: { sort: SortState; onChange: (s: SortState) => void }) {
  const selectStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
    outline: 'none', padding: '2px 4px', borderRadius: 4, fontWeight: 400,
  };
  const arrowBtnStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
    padding: '2px 4px', borderRadius: 4, minWidth: 16, lineHeight: 1, fontWeight: 400,
  };
  const toggleDir = () => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 4 }}>
      <select value={sort.key} onChange={(e) => onChange({ ...sort, key: e.target.value as SortKey })} style={selectStyle}>
        <option value="updated">{SORT_KEY_LABELS.updated}</option>
        <option value="name">{SORT_KEY_LABELS.name}</option>
      </select>
      <button onClick={toggleDir} style={arrowBtnStyle} title={sort.dir === 'asc' ? '오름차순' : '내림차순'}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}
