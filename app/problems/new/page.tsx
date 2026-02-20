'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../../hooks/useAuth';
import LoginButton from '../../../components/auth/LoginButton';
import BlockEditor, { BlockData } from '../../../components/editor/BlockEditor';
import { createProblem, saveQuestionBlock, saveSolutionBlock } from '../../../lib/firestore';

export default function NewProblemPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(2025);
  const [examType, setExamType] = useState('수능');
  const [category, setCategory] = useState('미적분');
  const [difficulty, setDifficulty] = useState(3);
  const [answer, setAnswer] = useState('');
  const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
  const [questionBlocks, setQuestionBlocks] = useState<BlockData[]>([
    { id: 'q-1', type: 'text', raw_text: '' },
  ]);
  const [solutionBlocks, setSolutionBlocks] = useState<BlockData[]>([
    { id: 's-1', type: 'text', raw_text: '' },
  ]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setStatus('제목을 입력해주세요.');
      return;
    }
    const hasContent = questionBlocks.some((b) => b.raw_text.trim());
    if (!hasContent) {
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

      for (let i = 0; i < questionBlocks.length; i++) {
        const b = questionBlocks[i];
        if (b.raw_text.trim()) {
          await saveQuestionBlock(problemId, {
            order: i,
            type: b.type,
            raw_text: b.raw_text,
          });
        }
      }

      for (let i = 0; i < solutionBlocks.length; i++) {
        const b = solutionBlocks[i];
        if (b.raw_text.trim()) {
          await saveSolutionBlock(problemId, {
            order: i,
            type: b.type,
            raw_text: b.raw_text,
            step_label: `풀이 ${i + 1}`,
          });
        }
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

      {/* 메타 정보 */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="문제 제목 (예: 2025 수능 수학 21번)"
          style={{ flex: 2, minWidth: '250px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: '80px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <select value={examType} onChange={(e) => setExamType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="수능">수능</option>
          <option value="모의고사">모의고사</option>
          <option value="사관학교">사관학교</option>
          <option value="경찰대">경찰대</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="미적분">미적분</option>
          <option value="확률과통계">확률과통계</option>
          <option value="기하">기하</option>
          <option value="수학Ⅰ">수학Ⅰ</option>
          <option value="수학Ⅱ">수학Ⅱ</option>
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
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
          style={{ width: '80px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={() => setActiveTab('question')}
          style={{
            padding: '8px 20px',
            backgroundColor: activeTab === 'question' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeTab === 'question' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'question' ? 'bold' : 'normal',
          }}
        >
          문제 ({questionBlocks.length}블록)
        </button>
        <button
          onClick={() => setActiveTab('solution')}
          style={{
            padding: '8px 20px',
            backgroundColor: activeTab === 'solution' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeTab === 'solution' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'solution' ? 'bold' : 'normal',
          }}
        >
          풀이 ({solutionBlocks.length}블록)
        </button>
      </div>

      {/* 블록 에디터 */}
      <div style={{ display: activeTab === 'question' ? 'block' : 'none' }}>
        <BlockEditor blocks={questionBlocks} onChange={setQuestionBlocks} />
      </div>
      <div style={{ display: activeTab === 'solution' ? 'block' : 'none' }}>
        <BlockEditor blocks={solutionBlocks} onChange={setSolutionBlocks} />
      </div>

      {/* 저장 */}
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