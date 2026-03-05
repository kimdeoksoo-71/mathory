'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useAuth from '../../../../hooks/useAuth';
import LoginButton from '../../../../components/auth/LoginButton';
import BlockEditor, { BlockData } from '../../../../components/editor/BlockEditor';
import {
  getProblemWithBlocks,
  updateProblem,
  saveQuestionBlock,
  saveSolutionBlock,
  deleteBlock,
} from '../../../../lib/firestore';
import { CATEGORY_OPTIONS, DIFFICULTIES, DEFAULT_DIFFICULTY } from '../../../../lib/constants';

export default function EditProblemPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(2025);
  const [examType, setExamType] = useState('수능');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [answer, setAnswer] = useState('');
  const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
  const [questionBlocks, setQuestionBlocks] = useState<BlockData[]>([]);
  const [solutionBlocks, setSolutionBlocks] = useState<BlockData[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [originalQuestionIds, setOriginalQuestionIds] = useState<string[]>([]);
  const [originalSolutionIds, setOriginalSolutionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const problem = await getProblemWithBlocks(id as string);
      if (!problem) {
        setStatus('문제를 찾을 수 없습니다.');
        setDataLoading(false);
        return;
      }

      setTitle(problem.title);
      setYear(problem.year);
      setExamType(problem.exam_type);
      setCategory(problem.category);
      setDifficulty(problem.difficulty);
      setAnswer(problem.answer || '');

      const qBlocks: BlockData[] = problem.question_blocks.length > 0
        ? problem.question_blocks.map((b) => ({ id: b.id, type: b.type as BlockData['type'], raw_text: b.raw_text }))
        : [{ id: 'q-new-1', type: 'text', raw_text: '' }];

      const sBlocks: BlockData[] = problem.solution_blocks.length > 0
        ? problem.solution_blocks.map((b) => ({ id: b.id, type: b.type as BlockData['type'], raw_text: b.raw_text }))
        : [{ id: 's-new-1', type: 'text', raw_text: '' }];

      setQuestionBlocks(qBlocks);
      setSolutionBlocks(sBlocks);
      setOriginalQuestionIds(problem.question_blocks.map((b) => b.id));
      setOriginalSolutionIds(problem.solution_blocks.map((b) => b.id));
      setDataLoading(false);
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      setStatus('제목을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setStatus('저장 중...');

      await updateProblem(id as string, {
        title, year, exam_type: examType, category, difficulty, answer,
      });

      const currentQIds = questionBlocks.map((b) => b.id);
      for (const oldId of originalQuestionIds) {
        if (!currentQIds.includes(oldId)) {
          await deleteBlock(id as string, 'question_blocks', oldId);
        }
      }

      const currentSIds = solutionBlocks.map((b) => b.id);
      for (const oldId of originalSolutionIds) {
        if (!currentSIds.includes(oldId)) {
          await deleteBlock(id as string, 'solution_blocks', oldId);
        }
      }

      for (const oldId of originalQuestionIds) {
        if (currentQIds.includes(oldId)) {
          await deleteBlock(id as string, 'question_blocks', oldId);
        }
      }
      for (let i = 0; i < questionBlocks.length; i++) {
        const b = questionBlocks[i];
        if (b.raw_text.trim()) {
          await saveQuestionBlock(id as string, {
            order: i, type: b.type, raw_text: b.raw_text,
          });
        }
      }

      for (const oldId of originalSolutionIds) {
        if (currentSIds.includes(oldId)) {
          await deleteBlock(id as string, 'solution_blocks', oldId);
        }
      }
      for (let i = 0; i < solutionBlocks.length; i++) {
        const b = solutionBlocks[i];
        if (b.raw_text.trim()) {
          await saveSolutionBlock(id as string, {
            order: i, type: b.type, raw_text: b.raw_text,
            step_label: `풀이 ${i + 1}`,
          });
        }
      }

      setStatus('저장 완료!');
      setTimeout(() => {
        router.push(`/problems/${id}`);
      }, 1000);
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || dataLoading) return <div style={{ padding: '24px' }}>로딩 중...</div>;

  if (!user) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>문제 편집</h1>
        <p style={{ color: '#888', marginBottom: '16px' }}>로그인이 필요합니다.</p>
        <LoginButton user={user} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push(`/problems/${id}`)}
            style={{ padding: '6px 14px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            ← 돌아가기
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>문제 편집</h1>
        </div>
        <LoginButton user={user} />
      </div>

      {/* 메타 정보 */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문제 제목"
          style={{ flex: 2, minWidth: '250px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: '80px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
        <select value={examType} onChange={(e) => setExamType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="수능">수능</option>
          <option value="모의고사">모의고사</option>
          <option value="사관학교">사관학교</option>
          <option value="경찰대">경찰대</option>
        </select>

        {/* Phase 10: 대단원 분류 */}
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="">대단원 선택</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* Phase 10: 난이도 2점/3점/4점 */}
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="정답"
          style={{ width: '80px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => setActiveTab('question')}
          style={{
            padding: '8px 20px',
            backgroundColor: activeTab === 'question' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeTab === 'question' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: '14px',
            fontWeight: activeTab === 'question' ? 'bold' : 'normal',
          }}>
          문제 ({questionBlocks.length}블록)
        </button>
        <button onClick={() => setActiveTab('solution')}
          style={{
            padding: '8px 20px',
            backgroundColor: activeTab === 'solution' ? '#fff' : '#e8e8e8',
            border: '1px solid #ddd',
            borderBottom: activeTab === 'solution' ? '1px solid #fff' : '1px solid #ddd',
            borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: '14px',
            fontWeight: activeTab === 'solution' ? 'bold' : 'normal',
          }}>
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
        <button onClick={handleSave} disabled={saving}
          style={{
            padding: '10px 32px',
            backgroundColor: saving ? '#ccc' : '#4285f4',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '15px', fontWeight: 'bold',
          }}>
          {saving ? '저장 중...' : '저장'}
        </button>
        {status && <span style={{ color: status.includes('에러') ? '#ea4335' : '#34a853', fontSize: '14px' }}>{status}</span>}
      </div>
    </div>
  );
}