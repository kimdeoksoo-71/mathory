export interface Problem {
  id: string;
  title: string;
  year: number;
  exam_type: string;
  category: string;
  difficulty: number;
  tags: string[];
  answer?: string;
  source?: string;
  subject?: string;
  folder_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Block {
  id: string;
  order: number;
  type: 'text' | 'image' | 'choices' | 'box';
  raw_text: string;
  step_label?: string;
  title?: string;
}

export interface Folder {
  id: string;
  name: string;
  user_id: string;
  order: number;
  created_at?: Date;
}

export interface ProblemWithBlocks extends Problem {
  question_blocks: Block[];
  solution_blocks: Block[];
}