'use client';

import { useState, useEffect, useRef } from 'react';
import { Problem, Block, ProblemWithBlocks, Folder } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, saveQuestionBlock, saveSolutionBlock, updateBlock, deleteBlock } from '../../lib/firestore';
import MarkdownEditor, { MarkdownEditorHandle } from '../editor/MarkdownEditor';
import EditorPreview from '../editor/EditorPreview';
import MathToolbar from '../editor/MathToolbar';
import DifficultyBadge from '../ui/DifficultyBadge';
import { IconChevronLeft, IconSave } from '../ui/Icons';

interface EditorViewProps {
  problemId: string;
  folders: Folder[];
  onBack: () => void;
}

export default function EditorView({ problemId, folders, onBack }: EditorViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  // 편집 상태: 블록별 raw_text
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>({});
  const [solutionTexts, setSolutionTexts] = useState<Record<string, string>>({});

  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      if (data) {
        setProblem(data);
        const qTexts: Record<string, string> = {};
        data.question_blocks.forEach((b) => { qTexts[b.id] = b.raw_text; });
        setQuestionTexts(qTexts);
        const sTexts: Record<string, string> = {};
        data.solution_blocks.forEach((b) => { sTexts[b.id] = b.raw_text; });
        setSolutionTexts(sTexts);
      }
      setLoading(false);
    };
    load();
  }, [problemId]);

  const handleInsert = (template: string, cursorOffset: number) => {
    // 현재 포커스된 에디터에 삽입
    const activeRefs = Object.values(editorRefs.current).filter(Boolean);
    if (activeRefs.length > 0) {
      activeRefs[0]?.insertText(template, cursorOffset);
    }
  };

  const handleSave = async () => {
    if (!problem) return;
    setSaving(true);
    setStatus('');
    try {
      // 블록 텍스트 업데이트
      for (const block of problem.question_blocks) {
        if (questionTexts[block.id] !== block.raw_text) {
          await updateBlock(problem.id, 'question_blocks', block.id, {
            raw_text: questionTexts[block.id],
          });
        }
      }
      for (const block of problem.solution_blocks) {
        if (solutionTexts[block.id] !== block.raw_text) {
          await updateBlock(problem.id, 'solution_blocks', block.id, {
            raw_text: solutionTexts[block.id],
          });
        }
      }
      await updateProblem(problem.id, {});
      setStatus('저장 완료');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>
    );
  }

  if (!problem) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>
    );
  }

  const currentBlocks = activeTab === 'question' ? problem.question_blocks : problem.solution_blocks;
  const currentTexts = activeTab === 'question' ? questionTexts : solutionTexts;
  const setCurrentTexts = activeTab === 'question' ? setQuestionTexts : setSolutionTexts;
  const previewContent = Object.values(currentTexts).join('\n\n');

  const folderName = folders.find((f) => f.id === problem.folder_id)?.name || '미분류';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* ═══ Row 1: Meta info ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={onBack}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4,
          }}
          title="뒤로"
        >
          <IconChevronLeft />
        </button>
        <span style={{
          fontSize: 12, color: 'var(--text-muted)',
          background: 'var(--bg-hover)', padding: '3px 10px', borderRadius: 6,
        }}>
          {folderName}
        </span>
        <span style={{
          fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
        }}>
          {problem.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {problem.source || problem.exam_type}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {problem.subject || problem.category}
        </span>
        <DifficultyBadge level={problem.difficulty} />
      </div>

      {/* ═══ Row 2: Tabs + Save ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 20px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
      }}>
        {(['question', 'solution'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13.5, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              fontFamily: 'var(--font-ui)', transition: 'all var(--transition-fast)',
            }}
          >
            {tab === 'question' ? '문제' : '풀이'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {status && (
          <span style={{
            fontSize: 12, marginRight: 12,
            color: status.includes('에러') ? 'var(--accent-danger)' : '#34a853',
          }}>
            {status}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
            background: saving ? 'var(--text-faint)' : 'var(--accent-primary)',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
            fontFamily: 'var(--font-ui)', transition: 'background var(--transition-fast)',
          }}
        >
          <IconSave /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* ═══ Row 3: Math Toolbar ═══ */}
      <MathToolbar onInsert={handleInsert} />

      {/* ═══ Row 4: Split View ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Editor */}
        <div style={{
          flex: 1, borderRight: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5,
          }}>
            편집
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {currentBlocks.map((block, i) => (
              <div key={block.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--text-muted)',
                    fontWeight: 600, letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
                  }}>
                    {block.type === 'text' ? '텍스트' : block.type === 'choices' ? '선택지' : block.type === 'hint' ? '힌트' : block.type}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-placeholder)' }}>블록 {i + 1}</span>
                </div>
                <div style={{
                  border: '1px solid var(--border-primary)', borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <MarkdownEditor
                    ref={(el) => { editorRefs.current[block.id] = el; }}
                    initialValue={currentTexts[block.id] || block.raw_text}
                    onChange={(val) => {
                      setCurrentTexts((prev) => ({ ...prev, [block.id]: val }));
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              style={{
                width: '100%', padding: 10, border: '1.5px dashed var(--text-placeholder)',
                borderRadius: 8, background: 'transparent', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)',
                transition: 'all var(--transition-fast)',
              }}
            >
              + 블록 추가
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5,
          }}>
            미리보기
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 20, background: 'var(--bg-card)' }}>
            {currentBlocks.map((block, i) => (
              <div key={block.id}>
                <div style={{ padding: '8px 0' }}>
                  <EditorPreview content={currentTexts[block.id] || block.raw_text} />
                </div>
                {i < currentBlocks.length - 1 && (
                  <div style={{
                    borderTop: '1px dashed var(--border-dashed)',
                    margin: '4px 0',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
