'use client';

import { useState, useEffect, useRef } from 'react';
import { ProblemWithBlocks } from '../../types/problem';
import { getProblemWithBlocks } from '../../lib/firestore';
import EditorPreview from '../editor/EditorPreview';
import DifficultyBadge from '../ui/DifficultyBadge';
import { IconDots, IconRename, IconEdit, IconFolderMove, IconTrash } from '../ui/Icons';

interface ProblemViewProps {
  problemId: string;
  onRename?: (problem: ProblemWithBlocks) => void;
  onEdit?: (problem: ProblemWithBlocks) => void;
  onMoveFolder?: (problem: ProblemWithBlocks) => void;
  onDelete?: (problem: ProblemWithBlocks) => void;
}

export default function ProblemView({ problemId, onRename, onEdit, onMoveFolder, onDelete }: ProblemViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      setProblem(data);
      setLoading(false);
    };
    load();
  }, [problemId]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        로딩 중...
      </div>
    );
  }

  if (!problem) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        문제를 찾을 수 없습니다.
      </div>
    );
  }

  // 선택지 블록은 \n → \n\n 변환 (마크다운에서 줄바꿈 보장)
  const blockToText = (b: typeof problem.question_blocks[0]) =>
    b.type === 'choices' ? b.raw_text.replace(/\n/g, '\n\n') : b.raw_text;

  const solutionContent = problem.solution_blocks.map(blockToText).join('\n\n');

  // 블록별 렌더링: text/image/choices는 합쳐서 하나로, box만 테두리 박스
  const renderBlocks = (blocks: typeof problem.question_blocks) => {
    const elements: React.ReactNode[] = [];
    let textBuffer = '';

    const flushText = () => {
      if (textBuffer.trim()) {
        elements.push(
          <EditorPreview key={`text-${elements.length}`} content={textBuffer.trim()} borderless />
        );
      }
      textBuffer = '';
    };

    blocks.forEach((block, i) => {
      if (block.type === 'box') {
        flushText();
        elements.push(
          <div key={block.id || `box-${i}`} style={{
            border: '1.5px solid var(--text-muted, #888)',
            borderRadius: 8, padding: '12px 16px', margin: '8px 0',
          }}>
            <EditorPreview content={block.raw_text} borderless />
          </div>
        );
      } else {
        textBuffer += (textBuffer ? '\n\n' : '') + blockToText(block);
      }
    });

    flushText();
    return elements;
  };

  const menuItems = [
    { label: '이름 변경', icon: <IconRename />, action: () => { setMenuOpen(false); onRename?.(problem); } },
    { label: '편집', icon: <IconEdit />, action: () => { setMenuOpen(false); onEdit?.(problem); } },
    { label: '폴더 변경', icon: <IconFolderMove />, action: () => { setMenuOpen(false); onMoveFolder?.(problem); } },
    { label: 'divider' },
    { label: '삭제', icon: <IconTrash />, action: () => { setMenuOpen(false); onDelete?.(problem); }, danger: true },
  ];

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      {/* Meta */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)',
            padding: '2px 8px', borderRadius: 6,
          }}>
            {problem.source || problem.exam_type}
          </span>
          <span style={{
            fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)',
            padding: '2px 8px', borderRadius: 6,
          }}>
            {problem.subject || problem.category}
          </span>
          <DifficultyBadge level={problem.difficulty} />
          {problem.answer && (
            <span style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-hover)',
              padding: '2px 8px', borderRadius: 6,
            }}>
              정답: {problem.answer}
            </span>
          )}
        </div>

        {/* 제목 + ⋯ 메뉴 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
            fontFamily: 'var(--font-ui)', flex: 1,
          }}>
            {problem.title}
          </h2>

          {/* 점 3개 메뉴 버튼 */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                border: 'none', background: menuOpen ? 'var(--bg-hover)' : 'transparent',
                cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                color: 'var(--text-muted)', lineHeight: 1,
                transition: 'background var(--transition-fast), color var(--transition-fast)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
              title="메뉴"
            >
              <IconDots size={16} />
            </button>

            {/* 드롭다운 메뉴 — ContextMenu와 동일 스타일 */}
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)',
                minWidth: 180, zIndex: 1000,
                padding: '4px 0',
                animation: 'fadeIn 0.1s ease',
              }}>
                {menuItems.map((item, i) =>
                  item.label === 'divider' ? (
                    <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 8px' }} />
                  ) : (
                    <button
                      key={i}
                      onClick={item.action}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 14px',
                        border: 'none', background: 'none', cursor: 'pointer',
                        fontSize: 13, fontFamily: 'var(--font-ui)',
                        color: item.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = item.danger
                          ? 'var(--accent-danger-bg)'
                          : 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'none';
                      }}
                    >
                      {item.icon && <span style={{ opacity: 0.7, display: 'flex' }}>{item.icon}</span>}
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question */}
      <div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12,
          letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
        }}>
          ► 문제
        </div>
        {renderBlocks(problem.question_blocks)}
      </div>

      {/* Solution Toggle */}
      {solutionContent && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowSolution(!showSolution)}
            style={{
              width: '100%', padding: '0',
              background: 'none',
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              textAlign: 'left', color: 'var(--text-muted)',
              letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
              marginBottom: showSolution ? 12 : 0,
              transition: 'background var(--transition-fast)',
            }}
          >
            {showSolution ? '▼ 풀이 접기' : '► 풀이 보기'}
          </button>
          {showSolution && (
            <div>
              {renderBlocks(problem.solution_blocks)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}