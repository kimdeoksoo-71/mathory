'use client';

import { useState, useEffect } from 'react';
import { ProblemWithBlocks } from '../../types/problem';
import { getProblemWithBlocks } from '../../lib/firestore';
import EditorPreview from '../editor/EditorPreview';
import DifficultyBadge from '../ui/DifficultyBadge';

interface ProblemViewProps {
  problemId: string;
}

export default function ProblemView({ problemId }: ProblemViewProps) {
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getProblemWithBlocks(problemId);
      setProblem(data);
      setLoading(false);
    };
    load();
  }, [problemId]);

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

  const questionContent = problem.question_blocks.map((b) => b.raw_text).join('\n\n');
  const solutionContent = problem.solution_blocks.map((b) => b.raw_text).join('\n\n');

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
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
          fontFamily: 'var(--font-ui)',
        }}>
          {problem.title}
        </h2>
      </div>

      {/* Question */}
      <div style={{
        background: 'var(--bg-input)', border: '1px solid var(--border-light)',
        borderRadius: 12, padding: 24,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12,
          letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
        }}>
          문제
        </div>
        <EditorPreview content={questionContent} />
      </div>

      {/* Solution Toggle */}
      {solutionContent && (
        <div style={{
          marginTop: 16, background: 'var(--bg-input)',
          border: '1px solid var(--border-light)', borderRadius: 12, overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowSolution(!showSolution)}
            style={{
              width: '100%', padding: '14px 24px',
              background: showSolution ? 'transparent' : 'var(--bg-secondary)',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              textAlign: 'left', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
              borderBottom: showSolution ? '1px solid var(--border-light)' : 'none',
              transition: 'background var(--transition-fast)',
            }}
          >
            {showSolution ? '▼ 풀이 접기' : '▶ 풀이 보기'}
          </button>
          {showSolution && (
            <div style={{ padding: 24 }}>
              <EditorPreview content={solutionContent} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
