'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useAuth from '../../../../hooks/useAuth';
import LoginButton from '../../../../components/auth/LoginButton';
import BlockEditor, { BlockData } from '../../../../components/editor/BlockEditor';
import PdfDownloadButton from '../../../../components/print/PdfDownloadButton';
import {
  getProblemWithBlocks,
  updateProblem,
  saveQuestionBlock,
  saveSolutionBlock,
  deleteBlock,
} from '../../../../lib/firestore';

export default function EditProblemPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(2025);
  const [examType, setExamType] = useState('수능');
  const [category, setCategory] = useState('미적분');
  const [difficulty, setDifficulty] = useState(3);
  const [answer, setAnswer] = useState('');
  const [activeTab, setActiveTab] = useState<'question' | 'solution'>('question');
  const [questionBlocks, setQuestionBlocks] = useState<BlockData[]>([]);
  const [solutionBlocks, setSolutionBlocks] = useState<BlockData[]>([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // 기존 블록 ID 추적 (삭제된 블록 감지용)
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

      // 메타 정보 업데이트
      await updateProblem(id as string, {
        title, year, exam_type: examType, category, difficulty, answer,
      });

      // 삭제된 문제 블록 처리
      const currentQIds = questionBlocks.map((b) => b.id);
      for (const oldId of originalQuestionIds) {
        if (!currentQIds.includes(oldId)) {
          await deleteBlock(id as string, 'question_blocks', oldId);
        }
      }

      // 삭제된 풀이 블록 처리
      const currentSIds = solutionBlocks.map((b) => b.id);
      for (const oldId of originalSolutionIds) {
        if (!currentSIds.includes(oldId)) {
          await deleteBlock(id as string, 'solution_blocks', oldId);
        }
      }

      // 문제 블록: 기존 블록 삭제 후 새로 저장 (순서 보장)
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

      // 풀이 블록: 기존 블록 삭제 후 새로 저장
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
      // 새 블록 ID 갱신
      const updated = await getProblemWithBlocks(id as string);
      if (updated) {
        setOriginalQuestionIds(updated.question_blocks.map((b) => b.id));
        setOriginalSolutionIds(updated.solution_blocks.map((b) => b.id));
      }
    } catch (error) {
      setStatus(`에러: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || dataLoading) {
    return <div style={{ padding: '24px' }}>로딩 중...</div>;
  }

  if (!user) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>로그인이 필요합니다.</p>
        <LoginButton user={user} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>문제 편집</h1>
        <LoginButton user={user} />
      </div>

      {/* 메타 정보 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: '80px', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
        <select value={examType} onChange={(e) => setExamType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}>
          <option value="수능">수능</option>
          <option value="모의고사">모의고사</option>
          <option value="사관학교">사관학교</option>
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
        <BlockEditor blocks={questionBlocks} onChange={setQuestionBlocks} problemId={id as string} />
      </div>
      <div style={{ display: activeTab === 'solution' ? 'block' : 'none' }}>
        <BlockEditor blocks={solutionBlocks} onChange={setSolutionBlocks} problemId={id as string} />
      </div>

      {/* 저장 + PDF 다운로드 */}
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

        <PdfDownloadButton
          title={title || '수학 문제'}
          headerInfo={`${year}학년도 ${examType} | ${category}`}
          tabs={[
            { label: '문제', blocks: questionBlocks },
            { label: '풀이', blocks: solutionBlocks },
          ]}
          locale="ko"
        />

        {status && <span style={{ color: status.includes('에러') ? '#ea4335' : '#34a853', fontSize: '14px' }}>{status}</span>}
      </div>
    </div>
  );
}