/**
 * 날짜를 "~전" 형식으로 변환
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}달 전`;
  return `${Math.floor(diffDay / 365)}년 전`;
}

/**
 * 난이도에 따른 라벨과 색상
 */
export function getDifficultyInfo(level: number): { label: string; color: string } {
  const map: Record<number, { label: string; color: string }> = {
    1: { label: '쉬움', color: '#8BC34A' },
    2: { label: '보통', color: '#66BB6A' },
    3: { label: '어려움', color: '#FFB74D' },
    4: { label: '매우 어려움', color: '#FF8A65' },
    5: { label: '킬러', color: '#EF5350' },
  };
  return map[level] || { label: '미정', color: '#9C9585' };
}
