'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProblemWithBlocks, deleteProblem } from '../../../lib/firestore';
import { ProblemWithBlocks, Block, TabMeta, DEFAULT_TABS } from '../../../types/problem';
import EditorPreview from '../../../components/editor/EditorPreview';
import useAuth from '../../../hooks/useAuth';
import LoginButton from '../../../components/auth/LoginButton';

const BORDERED_VIEW_TYPES = new Set(['gana', 'roman', 'box']);

function ProblemBlockView({ block }: { block: Block }) {
  if (block.type === 'image') {
    const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
    if (!src) return null;
    return (
      <div style={{ textAlign: 'center' }}>
        <img src={src} alt="" style={{ width: block.imageWidth || 400, maxWidth: '90%', height: 'auto' }} />
      </div>
    );
  }

  if (BORDERED_VIEW_TYPES.has(block.type)) {
    return (
      <div style={{
        border: '1.5px solid #888', borderRadius: 0,
        padding: '12px 16px', margin: '1.2em 0',
      }}>
        <EditorPreview content={block.raw_text} />
      </div>
    );
  }

  if (block.type === 'choices') {
    return <EditorPreview content={block.raw_text.replace(/\n/g, '\n\n')} />;
  }

  return <EditorPreview content={block.raw_text} />;
}

export default function ProblemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);

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

  const tabs: TabMeta[] = problem.tabs || DEFAULT_TABS;

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

      {/* 탭별 내용 */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
        {tabs.map((tab, tabIdx) => {
          const blocks = problem.tabBlocks[tab.id] || [];
          if (blocks.length === 0 && blocks.every((b) => !b.raw_text.trim())) return null;
          return (
            <div key={tab.id}>
              {/* 탭 간 간격 (첫 탭 제외) */}
              {tabIdx > 0 && <div style={{ height: '2.5em' }} />}
              {/* 탭 라벨 */}
              <div style={{
                fontSize: '15px', fontWeight: 700, marginBottom: '8px',
                paddingBottom: '4px', borderBottom: '1px solid #ccc',
                color: '#333',
              }}>
                {tab.label}
              </div>
              {/* 블록 내용 */}
              {blocks.map((block) => (
                <ProblemBlockView key={block.id} block={block} />
              ))}
            </div>
          );
        })}
      </div>

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
