'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProblemWithBlocks, deleteProblem } from '../../../lib/firestore';
import { ProblemWithBlocks } from '../../../types/problem';
import EditorPreview from '../../../components/editor/EditorPreview';
import useAuth from '../../../hooks/useAuth';
import LoginButton from '../../../components/auth/LoginButton';

export default function ProblemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const data = await getProblemWithBlocks(id as string);
      setProblem(data);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await deleteProblem(id as string);
    router.push('/problems');
  };

  if (loading) return <div style={{ padding: '24px' }}>로딩 중...</div>;
  if (!problem) return <div style={{ padding: '24px' }}>문제를 찾을 수 없습니다.</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => router.push('/problems')}
          style={{
            padding: '6px 14px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          ← 목록으로
        </button>
        <LoginButton user={user} />
      </div>

      {/* 문제 정보 */}
      <h1 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>{problem.title}</h1>
      <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
        {problem.year} {problem.exam_type} | {problem.category} | 난이도 {problem.difficulty}
        {problem.answer && ` | 정답: ${problem.answer}`}
      </p>

      {/* 문제 내용 */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>문제</h2>
        {problem.question_blocks.map((block, i) => (
          <div key={block.id} style={{ marginBottom: i < problem.question_blocks.length - 1 ? '3em' : 0 }}>
            <EditorPreview content={block.raw_text} />
          </div>
        ))}
      </div>

      {/* 풀이 토글 */}
      {solutionContent && (
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowSolution(!showSolution)}
            style={{
              width: '100%',
              padding: '12px 20px',
              backgroundColor: '#f8f9fa',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              textAlign: 'left',
            }}
          >
            {showSolution ? '▼ 풀이 접기' : '▶ 풀이 보기'}
          </button>
          {showSolution && (
            <div style={{ padding: '20px' }}>
              {problem.solution_blocks.map((block, i) => (
               <div key={block.id} style={{ marginBottom: i < problem.solution_blocks.length - 1 ? '3em' : 0 }}>
                 <EditorPreview content={block.raw_text} />
               </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 관리 버튼 */}
      {user && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => router.push(`/problems/${id}/edit`)}
            style={{
              padding: '8px 20px',
              backgroundColor: '#4285f4',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            편집
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 20px',
              backgroundColor: '#ea4335',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}