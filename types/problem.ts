export interface Problem {
  id: string;
  title: string;
  year: number;
  exam_type: string;
  category: string;
  difficulty: number;
  tags: string[];
  answer?: string;
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