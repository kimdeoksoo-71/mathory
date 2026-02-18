# 아키텍처

## 기술 스택

| 레이어 | 선택 | 비고 |
|--------|------|------|
| 프레임워크 | Next.js 14+ (App Router) | TypeScript strict mode |
| 스타일링 | Tailwind CSS + shadcn/ui | |
| 에디터 | CodeMirror 6 | Markdown + LaTeX 구문 하이라이팅 |
| 수식 렌더링 | KaTeX | 실시간 미리보기에 적합한 빠른 렌더링 |
| DB | Firebase Firestore | NoSQL, 실시간 sync |
| 인증 | Firebase Auth | Google / 이메일 로그인 |
| 배포 | Vercel | GitHub 연동 자동 배포 |
| 코드 관리 | GitHub | main / dev 브랜치 전략 |

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # 홈
│   ├── problems/
│   │   ├── page.tsx                  # 문제 목록/검색
│   │   ├── [id]/page.tsx            # 문제 보기
│   │   ├── [id]/edit/page.tsx       # 문제 편집
│   │   └── new/page.tsx             # 새 문제 작성
│   └── globals.css
├── components/
│   ├── editor/
│   │   ├── MarkdownEditor.tsx       # CodeMirror 6 기반 에디터
│   │   ├── EditorPreview.tsx        # KaTeX 실시간 미리보기
│   │   ├── SplitView.tsx            # 에디터 + 미리보기 레이아웃
│   │   ├── MathToolbar.tsx          # 수식 편집기 버튼 바
│   │   └── BlockEditor.tsx          # 블록 단위 에디터 래퍼
│   ├── problem/
│   │   ├── ProblemCard.tsx          # 목록용 카드
│   │   ├── ProblemView.tsx          # 문제 렌더링
│   │   └── SolutionView.tsx         # 풀이 렌더링
│   └── ui/                          # shadcn/ui 컴포넌트
├── lib/
│   ├── firebase.ts                  # Firebase 초기화
│   ├── firestore.ts                 # CRUD 함수
│   ├── markdown.ts                  # Markdown + KaTeX 렌더 유틸
│   └── math-templates.ts           # 수식 템플릿 정의
├── hooks/
│   ├── useProblem.ts               # 문제 CRUD 훅
│   └── useEditor.ts               # 에디터 상태 관리
└── types/
    └── problem.ts                  # TypeScript 타입
```

## 렌더링 파이프라인
```
raw_text (Firestore 저장값)
  → react-markdown 파싱
  → remark-math로 $...$ / $$...$$ 감지
  → rehype-katex로 수식 렌더링
  → HTML 출력 (화면에서만, DB에는 저장 안 함)
```

## 핵심 원칙

1. **raw_text만 저장** — 렌더된 HTML은 DB에 절대 저장하지 않는다
2. **블록 단위 편집** — 문제/풀이를 독립 블록으로 분리하여 개별 CRUD
3. **클라이언트 렌더링** — 렌더링은 항상 프론트엔드에서 수행
