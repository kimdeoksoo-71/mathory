// ═══ 대단원 분류 ═══
export const CATEGORIES = [
  { code: '11', name: '지수함수와 로그함수' },
  { code: '12', name: '삼각함수' },
  { code: '13', name: '수열' },
  { code: '21', name: '함수의 극한과 연속' },
  { code: '22', name: '미분' },
  { code: '23', name: '적분' },
  { code: '31', name: '경우의 수' },
  { code: '32', name: '확률' },
  { code: '33', name: '통계' },
  { code: '41', name: '수열의 극한' },
  { code: '42', name: '미분법' },
  { code: '43', name: '적분법' },
  { code: '51', name: '이차곡선' },
  { code: '52', name: '평면벡터' },
  { code: '53', name: '공간도형과 공간좌표' },
] as const;

/** 드롭다운 option 값으로 사용: "11 지수함수와 로그함수" */
export const CATEGORY_OPTIONS = CATEGORIES.map((c) => `${c.code} ${c.name}`);

// ═══ 난이도 (배점) ═══
export const DIFFICULTIES = [
  { value: 2, label: '2점' },
  { value: 3, label: '3점' },
  { value: 4, label: '4점' },
] as const;

export const DEFAULT_DIFFICULTY = 3;