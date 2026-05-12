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
  tabs?: TabMeta[];
  created_at: Date;
  updated_at: Date;
  // Phase 29: 저작권 / 블록체인
  authorUid?: string;
  copyright?: CopyrightField;
  blockchain?: BlockchainField | null;
}

export interface CopyrightField {
  contentHash: string;
}

export interface BlockchainRecord {
  contentHash: string;
  registeredAt: string;        // ISO — 등록 요청 시각
  network: 'opentimestamps';
  status: 'pending' | 'confirmed';
  otsProof: string;            // base64-encoded .ots bytes
  // confirmed 시 채워짐
  bitcoinTx?: string;          // 비트코인 tx id
  confirmedAt?: string;        // ISO
}

export interface BlockchainField {
  history: BlockchainRecord[];
  latest: BlockchainRecord;
}

export interface Block {
  id: string;
  order: number;
  type: 'text' | 'heading' | 'math_block' | 'bullet' | 'gana' | 'roman' | 'box' | 'choices' | 'image';
  raw_text: string;
  step_label?: string;
  title?: string;
  imageWidth?: number;
}

/** 탭 메타데이터 */
export interface TabMeta {
  id: string;      // 'question', 'solution', 'extra_0', 'extra_1', ...
  label: string;   // '문제', '풀이', '풀이2', '참고', ...
}

/** 탭 ID → Firestore 하위 컬렉션명 변환 */
export function tabSubcollection(tabId: string): string {
  return `${tabId}_blocks`;
}

/** 기본 탭 구성 (tabs 필드 없을 때 fallback) */
export const DEFAULT_TABS: TabMeta[] = [
  { id: 'question', label: '문제' },
  { id: 'solution', label: '풀이' },
];

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
  /** 모든 탭의 블록 (탭 ID → 블록 배열) */
  tabBlocks: Record<string, Block[]>;
}