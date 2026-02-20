'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '../../hooks/useAuth';
import LoginButton from '../../components/auth/LoginButton';
import { listProblems, ProblemFilter } from '../../lib/firestore';
import { Problem } from '../../types/problem';

export default function ProblemsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 상태
  const [searchText, setSearchText] = useState('');
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [examTypeFilter, setExamTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<number | ''>('');

  const loadProblems = async () => {
    setLoading(true);
    try {
      const filter: ProblemFilter = {};
      if (yearFilter) filter.year = yearFilter;
      if (examTypeFilter) filter.exam_type = examTypeFilter;
      if (categoryFilter) filter.category = categoryFilter;
      if (difficultyFilter) filter.difficulty = difficultyFilter;
      if (searchText.trim()) filter.searchText = searchText.trim();

      const results = await listProblems(filter);
      setProblems(results);
    } catch (error) {
      console.error('문제 목록 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, [yearFilter, examTypeFilter, categoryFilter, difficultyFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProblems();
  };

  const handleReset = () => {
    setSearchText('');
    setYearFilter('');
    setExamTypeFilter('');
    setCategoryFilter('');
    setDifficultyFilter('');
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>문제 목록</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {user && (
            <button
              onClick={() => router.push('/problems/new')}
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
              + 새 문제
            </button>
          )}
          <LoginButton user={user} />
        </div>
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="제목 또는 태그로 검색..."
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            검색
          </button>
        </div>
      </form>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">연도 전체</option>
          {[2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={examTypeFilter}
          onChange={(e) => setExamTypeFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">유형 전체</option>
          <option value="수능">수능</option>
          <option value="모의고사">모의고사</option>
          <option value="사관학교">사관학교</option>
          <option value="경찰대">경찰대</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">카테고리 전체</option>
          <option value="미적분">미적분</option>
          <option value="확률과통계">확률과통계</option>
          <option value="기하">기하</option>
          <option value="수학Ⅰ">수학Ⅰ</option>
          <option value="수학Ⅱ">수학Ⅱ</option>
        </select>

        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">난이도 전체</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>난이도 {d}</option>
          ))}
        </select>

        <button
          onClick={handleReset}
          style={{
            padding: '8px 14px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          초기화
        </button>
      </div>

      {/* 결과 */}
      {loading ? (
        <p style={{ color: '#888' }}>로딩 중...</p>
      ) : problems.length === 0 ? (
        <p style={{ color: '#888' }}>문제가 없습니다.</p>
      ) : (
        <>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
            {problems.length}개 문제
          </p>
          {problems.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/problems/${p.id}`)}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '10px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold' }}>{p.title}</h2>
                <span style={{
                  padding: '2px 10px',
                  backgroundColor: '#e8f0fe',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#4285f4',
                }}>
                  난이도 {p.difficulty}
                </span>
              </div>
              <p style={{ color: '#888', fontSize: '13px', marginTop: '6px' }}>
                {p.year} {p.exam_type} | {p.category}
                {p.tags.length > 0 && ` | ${p.tags.join(', ')}`}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}