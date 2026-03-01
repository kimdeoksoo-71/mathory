'use client';

import { useState, useEffect, useRef } from 'react';
import { Problem, Block, ProblemWithBlocks, Folder } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, saveQuestionBlock, saveSolutionBlock, updateBlock, deleteBlock } from '../../lib/firestore';
import MarkdownEditor, { MarkdownEditorHandle } from '../editor/MarkdownEditor';
import EditorPreview from '../editor/EditorPreview';
import MathToolbar from '../editor/MathToolbar';
import ImageUploadButton from '../editor/ImageUploadButton';
import { uploadImage } from '../../lib/storage';
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

  // 메타 편집
  const [editTitle, setEditTitle] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editDifficulty, setEditDifficulty] = useState(3);
  const [editAnswer, setEditAnswer] = useState('');
  const [editFolderId, setEditFolderId] = useState<string>('');

  // 블록 편집
  const [questionTexts, setQuestionTexts] = useState<Record<string, string>>({});
  const [solutionTexts, setSolutionTexts] = useState<Record<string, string>>({});
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const editorRefs = useRef<Record<string, MarkdownEditorHandle | null>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      if (data) {
        setProblem(data);
        setEditTitle(data.title);
        setEditSource(data.source || data.exam_type || '');
        setEditSubject(data.subject || data.category || '');
        setEditDifficulty(data.difficulty);
        setEditAnswer(data.answer || '');
        setEditFolderId(data.folder_id || '');
        const qTexts: Record<string, string> = {};
        data.question_blocks.forEach((b) => { qTexts[b.id] = b.raw_text; });
        setQuestionTexts(qTexts);
        const sTexts: Record<string, string> = {};
        data.solution_blocks.forEach((b) => { sTexts[b.id] = b.raw_text; });
        setSolutionTexts(sTexts);
        if (data.question_blocks.length > 0) {
          setActiveBlockId(data.question_blocks[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, [problemId]);

  const handleInsert = (template: string, cursorOffset: number) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId]?.insertText(template, cursorOffset);
    } else {
      const activeRefs = Object.values(editorRefs.current).filter(Boolean);
      if (activeRefs.length > 0) {
        activeRefs[0]?.insertText(template, cursorOffset);
      }
    }
  };

  const handleImageUpload = async (file: File) => {
    const pid = problemId || `temp-${Date.now()}`;
    const url = await uploadImage(file, pid);
    const markdownImage = `<img src="${url}" alt="${file.name}" width="400" />`;
    handleInsert(markdownImage, markdownImage.length);
  };

  const handleSave = async () => {
    if (!problem) return;
    setSaving(true);
    setStatus('');
    try {
      // [수정2] 메타 저장 — undefined 대신 빈 문자열 또는 null 사용
      const updateData: Record<string, any> = {
        title: editTitle,
        source: editSource,
        subject: editSubject,
        exam_type: editSource,
        category: editSubject,
        difficulty: editDifficulty,
        answer: editAnswer,
      };
      // folder_id: 빈 문자열이면 null로 (미분류), 아니면 해당 ID
      if (editFolderId) {
        updateData.folder_id = editFolderId;
      } else {
        updateData.folder_id = null;
      }

      await updateProblem(problem.id, updateData);

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

      setStatus('저장 완료');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlock = async () => {
    if (!problem) return;
    const blockType = activeTab === 'question' ? 'question_blocks' : 'solution_blocks';
    const currentBlocks = activeTab === 'question' ? problem.question_blocks : problem.solution_blocks;
    const setTexts = activeTab === 'question' ? setQuestionTexts : setSolutionTexts;

    try {
      const newBlockData = { order: currentBlocks.length, type: 'text' as const, raw_text: '' };
      let newBlockId: string;
      if (activeTab === 'question') {
        newBlockId = await saveQuestionBlock(problem.id, newBlockData);
      } else {
        newBlockId = await saveSolutionBlock(problem.id, newBlockData);
      }
      const newBlock: Block = { id: newBlockId, ...newBlockData };
      setProblem((prev) => {
        if (!prev) return prev;
        return { ...prev, [blockType]: [...prev[blockType], newBlock] };
      });
      setTexts((prev) => ({ ...prev, [newBlockId]: '' }));
      setActiveBlockId(newBlockId);
    } catch (error) {
      console.error('블록 추가 에러:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }

  const currentBlocks = activeTab === 'question' ? problem.question_blocks : problem.solution_blocks;
  const currentTexts = activeTab === 'question' ? questionTexts : solutionTexts;
  const setCurrentTexts = activeTab === 'question' ? setQuestionTexts : setSolutionTexts;

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

  return (
    /* ═══ 최외곽: 부모(main)를 꽉 채우되 자체 스크롤 없음 ═══ */
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>

      {/* ═══ Row 1: 메타 정보 편집 ═══ */}
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
        <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
          placeholder="과목" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, width: 90, fontSize: 12 }}
        />
        <select value={editDifficulty} onChange={(e) => setEditDifficulty(Number(e.target.value))}
          style={{ ...metaInputStyle, fontSize: 12, cursor: 'pointer' }}>
          {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{'★'.repeat(d)} 난이도 {d}</option>)}
        </select>
        <input value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)}
          placeholder="정답" onFocus={focusHandler} onBlur={blurHandler}
          style={{ ...metaInputStyle, width: 70, fontSize: 12 }}
        />
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
            {tab === 'question' ? '문제' : '풀이'}
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', flexShrink: 0,
      }}>
        <MathToolbar onInsert={handleInsert} />
        <div style={{ width: 1, height: 24, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
        <ImageUploadButton onUpload={handleImageUpload} />
      </div>

      {/* ═══ Row 4: Split View — [수정3] 스크롤 완전 수정 ═══ */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden', /* 절대로 이 div 자체가 스크롤되면 안 됨 */
      }}>
        {/* Left: Editor */}
        <div style={{
          flex: 1, borderRight: '1px solid var(--border-light)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>
            편집
          </div>

          {/* 블록 리스트 — 유일한 스크롤 영역 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {currentBlocks.map((block, i) => (
              <div
                key={block.id}
                style={{ marginBottom: 12 }}
                onClick={() => setActiveBlockId(block.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--text-muted)',
                    fontWeight: 600, letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
                  }}>
                    {block.type === 'text' ? '텍스트' : block.type === 'choices' ? '선택지' : block.type === 'hint' ? '힌트' : block.type}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-placeholder)' }}>블록 {i + 1}</span>
                </div>
                {/* [수정3 핵심] 에디터 래퍼에 고정 높이 — height:100% 문제 해결 */}
                <div style={{
                  height: 200,
                  border: activeBlockId === block.id
                    ? '2px solid var(--accent-primary)'
                    : '1px solid var(--border-primary)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
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
          </div>

          {/* 블록 추가 — 하단 고정 */}
          <button onClick={handleAddBlock} style={{
            flexShrink: 0, width: '100%', padding: 12,
            border: 'none', borderTop: '1px solid var(--border-light)',
            background: 'var(--bg-card)', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)',
          }}>
            + 블록 추가
          </button>
        </div>

        {/* Right: Preview */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>
            미리보기
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-card)' }}>
            {currentBlocks.map((block, i) => (
              <div key={block.id}>
                <div style={{ padding: '8px 0' }}>
                  <EditorPreview content={currentTexts[block.id] || block.raw_text} />
                </div>
                {i < currentBlocks.length - 1 && (
                  <div style={{ borderTop: '1px dashed var(--border-dashed)', margin: '4px 0' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
