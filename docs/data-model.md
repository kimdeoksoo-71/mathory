# Firestore 데이터 모델

## 컬렉션 구조
```
problems (collection)
└─ {problemId} (document)
    ├─ question_blocks (subcollection)
    │   └─ {blockId} (document)
    └─ solution_blocks (subcollection)
        └─ {blockId} (document)
```

## problems 문서 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| title | string | 문제 제목 | "2025 수능 수학 21번" |
| year | number | 출제 연도 | 2025 |
| exam_type | string | 시험 유형 | "수능" \| "모의고사" \| "사관학교" |
| category | string | 단원 분류 | "미적분" \| "확률과통계" \| "기하" |
| difficulty | number | 난이도 (1~5) | 4 |
| tags | string[] | 세부 태그 | ["정적분", "넓이"] |
| answer | string | 정답 | "24" |
| created_at | timestamp | 생성일 | |
| updated_at | timestamp | 수정일 | |

## question_blocks 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| order | number | 블록 순서 (0부터) |
| type | string | "text" \| "image" \| "table" \| "choices" |
| raw_text | string | Markdown + LaTeX 원문 |

### type별 raw_text 예시

**text**
```
함수 $f(x) = x^3 - 3x^2 + 2$에 대하여
$\int_0^2 f(x)\,dx$의 값을 구하시오.
```

**choices**
```
① $12$
② $14$
③ $16$
④ $18$
⑤ $20$
```

**image**
```
![그래프](/images/problem-001-graph.png)
```

## solution_blocks 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| order | number | 블록 순서 |
| type | string | "text" \| "image" \| "table" \| "hint" |
| raw_text | string | Markdown + LaTeX 원문 |
| step_label | string? | 풀이 구분 라벨 (예: "풀이 1", "별해") |

## 설계 결정

### subcollection을 선택한 이유

**장점**: 블록 하나만 수정할 때 전체 문서를 다시 쓰지 않아도 됨, 블록 수가 많아져도 읽기 비용 안정적

**단점**: 문제 하나를 통째로 읽을 때 3번의 쿼리 필요 (문서 + question_blocks + solution_blocks)

**대안 (embedded array)**: 블록 수가 적고 항상 전체를 읽는 패턴이면 embedded가 더 간단할 수 있음. 추후 사용 패턴에 따라 재평가.

## TypeScript 타입
```typescript
interface Problem {
  id: string;
  title: string;
  year: number;
  exam_type: 'suneung' | 'mock' | 'military' | string;
  category: string;
  difficulty: number;
  tags: string[];
  answer?: string;
  created_at: Date;
  updated_at: Date;
}

interface Block {
  id: string;
  order: number;
  type: 'text' | 'image' | 'table' | 'choices' | 'hint';
  raw_text: string;
  step_label?: string;
}
```
