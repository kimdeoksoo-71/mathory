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
/* ═══ 본문 가로폭 조절 (개선묶음 M2 D24′) ═══
   ProblemView 열람뷰와 EditorView 미리보기가 **같은 값**을 쓴다 — 두 화면을 오갈 때
   본문 폭이 달라지면 "같은 문항인데 조판이 바뀐 것처럼" 보인다.
   ⚠ 최소가 기본값과 같은 35다: "현재 가로폭을 최소 한계로 하여 그 미만 축소 불가"(메모).
   ⚠ 최대 45 — 50이면 댓글 패널(420)과 동시 사용 시 필요 창폭이 실사용을 넘는다. */
export const WIDTH_EM_KEY = 'mathory-problem-width-em';
export const WIDTH_EM_DEFAULT = 35;
export const WIDTH_EM_MIN = 35;
export const WIDTH_EM_MAX = 45;
