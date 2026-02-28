export interface Problem {
  id: string;
  title: string;
  year: number;
  exam_type: string;
  category: string;
  difficulty: number;
  tags: string[];
  answer?: string;
  source?: string;      // Phase 6: 출처 (예: "2025 수능", "2024 6월 모의")
  subject?: string;     // Phase 6: 과목 (예: "수학I", "수학II", "미적분")
  folder_id?: string;   // Phase 6: 폴더 ID (null이면 미분류)
  created_at: Date;
  updated_at: Date;
}

export interface Block {
  id: string;
  order: number;
  type: 'text' | 'image' | 'table' | 'choices' | 'hint';
  raw_text: string;
  step_label?: string;
}

export interface ProblemWithBlocks extends Problem {
  question_blocks: Block[];
  solution_blocks: Block[];
}

export interface Folder {
  id: string;
  name: string;
  user_id: string;
  order: number;
  created_at: Date;
  updated_at: Date;
}
