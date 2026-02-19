'use client';

import { useState } from 'react';
import {
  createProblem,
  listProblems,
  saveQuestionBlock,
  saveSolutionBlock,
  getProblemWithBlocks,
  deleteProblem,
} from '../../lib/firestore';
import { ProblemWithBlocks } from '../../types/problem';

export default function FirebaseTestPage() {
  const [status, setStatus] = useState('');
  const [problems, setProblems] = useState<ProblemWithBlocks[]>([]);

  const handleCreate = async () => {
    try {
      setStatus('문제 생성 중...');

      // 1. 문제 생성
      const problemId = await createProblem({
        title: '2025 수능 수학 21번',
        year: 2025,
        exam_type: '수능',
        category: '미적분',
        difficulty: 4,
        tags: ['정적분', '넓이'],
        answer: '16',
      });

      // 2. 문제 블록 저장
      await saveQuestionBlock(problemId, {
        order: 0,
        type: 'text',
        raw_text: '함수 $f(x) = x^3 - 3x^2 + 2$에 대하여\n\n$$\\int_0^2 f(x)\\,dx$$\n\n의 값을 구하시오.',
      });

      await saveQuestionBlock(problemId, {
        order: 1,
        type: 'choices',
        raw_text: '① $12$\n② $14$\n③ $16$\n④ $18$\n⑤ $20$',
      });

      // 3. 풀이 블록 저장
      await saveSolutionBlock(problemId, {
        order: 0,
        type: 'text',
        raw_text: '## 풀이\n\n$$\\int_0^2 (x^3 - 3x^2 + 2)\\,dx = \\left[\\frac{x^4}{4} - x^3 + 2x\\right]_0^2 = 16$$',
        step_label: '풀이 1',
      });

      setStatus(`문제 생성 완료! ID: ${problemId}`);
    } catch (error) {
      setStatus(`에러: ${error}`);
    }
  };

  const handleLoad = async () => {
    try {
      setStatus('문제 목록 불러오는 중...');
      const list = await listProblems();

      const detailed: ProblemWithBlocks[] = [];
      for (const p of list) {
        const full = await getProblemWithBlocks(p.id);
        if (full) detailed.push(full);
      }

      setProblems(detailed);
      setStatus(`${detailed.length}개 문제 로드 완료`);
    } catch (error) {
      setStatus(`에러: ${error}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProblem(id);
      setProblems(problems.filter((p) => p.id !== id));
      setStatus('삭제 완료');
    } catch (error) {
      setStatus(`에러: ${error}`);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        Firebase 연동 테스트
      </h1>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={handleCreate}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4285f4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          샘플 문제 생성
        </button>
        <button
          onClick={handleLoad}
          style={{
            padding: '10px 20px',
            backgroundColor: '#34a853',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          문제 목록 불러오기
        </button>
      </div>

      <p style={{ color: '#666', marginBottom: '24px' }}>{status}</p>

      {problems.map((p) => (
        <div
          key={p.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>{p.title}</h2>
            <button
              onClick={() => handleDelete(p.id)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#ea4335',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              삭제
            </button>
          </div>
          <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
            {p.year} {p.exam_type} | {p.category} | 난이도 {p.difficulty} | 정답: {p.answer}
          </p>

          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px' }}>
            문제 블록 ({p.question_blocks.length}개)
          </h3>
          {p.question_blocks.map((b) => (
            <pre
              key={b.id}
              style={{
                backgroundColor: '#f8f9fa',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                marginTop: '4px',
                whiteSpace: 'pre-wrap',
              }}
            >
              [{b.type}] {b.raw_text}
            </pre>
          ))}

          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px' }}>
            풀이 블록 ({p.solution_blocks.length}개)
          </h3>
          {p.solution_blocks.map((b) => (
            <pre
              key={b.id}
              style={{
                backgroundColor: '#f0f8ff',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                marginTop: '4px',
                whiteSpace: 'pre-wrap',
              }}
            >
              [{b.step_label || b.type}] {b.raw_text}
            </pre>
          ))}
        </div>
      ))}
    </div>
  );
}