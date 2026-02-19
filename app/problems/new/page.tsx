'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../../hooks/useAuth';
import LoginButton from '../../../components/auth/LoginButton';
import MarkdownEditor, { MarkdownEditorHandle } from '../../../components/editor/MarkdownEditor';
import EditorPreview from '../../../components/editor/EditorPreview';
import MathToolbar from '../../../components/editor/MathToolbar';
import { createProblem, saveQuestionBlock, saveSolutionBlock } from '../../../lib/firestore';

export default function NewProblemPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const questionEditorRef = useRef<MarkdownEditorHandle>(null);
  const solutionEditorRef = useRef<MarkdownEditorHandle>(null);

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(2025);
  const [examType, setExamType] = useState('수능');
  const [category, setCategory] = useState('미적분');
  const [difficulty, setDifficulty] = useState(3);
  const [answer, setAnswer] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [solutionText, setSolutionText] = useState('');
  const [activeEditor, setActiveEditor] = useState<'question' | 'solution'>('question');
  const [previewContent, setPreviewContent] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const handleQuestionChange = (value: string) => {
    setQuestionText(value);
    if (activeEditor === 'question') setPreviewContent(value);
  };

  const handleSolutionChange = (value: string) => {
    setSolutionText(value);
    if (activeEditor === 'solution') setPreviewContent(value);
  };

  const handleInsert = (template: string, cursorOffset: number) => {
    if (activeEditor === 'question') {
      questionEditorRef.current?.insertText(template, cursorOffset);
    } else {
      solutionEditorRef.current?.insertText(template, cursorOffset);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setStatus('제목을 입력해주세요.');
      return;
    }
    if (!questionText.trim()) {
      setStatus('문제 내용을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setStatus('저장 중...');

      const problemId = await createProblem({
        title,
        year,
        exam_type: examType,
        category,
        difficulty,
        tags: [],
        answer,
      });

      await saveQuestionBlock(problemId, {
        order: 0,
        type: 'text',
        raw_text: questionText,
      });

      if (solutionText.trim()) {
        await saveSolutionBlock(problemId, {
          order: 0,
          type: 'text',
          raw_text: solutionText,
          step_label: '풀이 1',
        });
      }

      setStatus('저장 완료!');
      setTimeout(() => {
        router.push(`/problems/${problemId}`);
      }, 1000);
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>로딩 중...</div>;

  if (!user) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>새 문제 작성</h1>
        <p style={{ color: '#888', marginBottom: '16px' }}>로그인이 필요합니다.</p>
        <LoginButton user={user} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>새 문제 작성</h1>
        <LoginButton user={user} />
      </div>

      {/* 문제 메타 정보 */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="문제 제목 (예: 2025 수능 수학 21번)"
          style={{
            flex: 2,
            minWidth: '250px',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{
            width: '80px',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
        <select
          value={examType}
          onChange={(e) => setExamType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="수능">수능</option>
          <option value="모의고사">모의고사</option>
          <option value="사관학교">사관학교</option>
          <option value="경찰대">경찰대</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value="미적분">미적분</option>
          <option value="확률과통계">확률과통계</option>
          <option value="기하">기하</option>
          <option value="수학Ⅰ">수학Ⅰ</option>
          <option value="수학Ⅱ">수학Ⅱ</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        >
          <option value={1}>난이도 1</option>
          <option value={2}>난이도 2</option>
          <option value={3}>난이도 3</option>
          <option value={4}>난이도 4</option>
          <option value={5}>난이도 5</option>
        </select>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="정답"
          style={{
            width: '80px',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
      </div>

      {/* 에디터 탭 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0' }}>
        <button
          onClick={() => { setActiveEditor('question'); setPreviewContent(questionText); }}
          style={{
            padding: '8px 20px',
            backgroundColor: activeEditor === 'question' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeEditor === 'question' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeEditor === 'question' ? 'bold' : 'normal',
          }}
        >
          문제
        </button>
        <button
          onClick={() => { setActiveEditor('solution'); setPreviewContent(solutionText); }}
          style={{
            padding: '8px 20px',
            backgroundColor: activeEditor === 'solution' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeEditor === 'solution' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeEditor === 'solution' ? 'bold' : 'normal',
          }}
        >
          풀이
        </button>
      </div>

      {/* 수식 툴바 + Split View */}
      <MathToolbar onInsert={handleInsert} />
      <div style={{ display: 'flex', gap: '16px', height: '500px', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ height: '100%', display: activeEditor === 'question' ? 'block' : 'none' }}>
            <MarkdownEditor ref={questionEditorRef} initialValue="" onChange={handleQuestionChange} />
          </div>
          <div style={{ height: '100%', display: activeEditor === 'solution' ? 'block' : 'none' }}>
            <MarkdownEditor ref={solutionEditorRef} initialValue="" onChange={handleSolutionChange} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditorPreview content={previewContent} />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 32px',
            backgroundColor: saving ? '#ccc' : '#4285f4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {status && <span style={{ color: status.includes('에러') ? '#ea4335' : '#34a853', fontSize: '14px' }}>{status}</span>}
      </div>
    </div>
  );
}