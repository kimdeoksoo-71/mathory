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
  // Stage 0 (공유 기능 기반): 공개 범위
  visibility?: Visibility;
}

export type Visibility = 'private' | 'link' | 'public';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
}

export interface CopyrightField {
  contentHash: string;
}

export interface BlockchainRecord {
  txHash: string;              // Polygon 트랜잭션 해시 (0x...)
  contentHash: string;         // SHA-256 hash (64-char hex)
  registeredAt: string;        // ISO
  network: 'polygon';
  explorerUrl: string;         // https://polygonscan.com/tx/{txHash}
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

// ═══ Stage 1: 공유 ═══

/** 공유 링크에서 각 탭의 노출 여부 */
export type ShareTabVisibility = Record<string, boolean>;

export interface Share {
  id: string;                          // nanoid shareId
  problemId: string;
  ownerUid: string;
  createdAt: Date;
  expiresAt: Date;                     // 필수 (기본 72h, 최대 30일)
  tabVisibility: ShareTabVisibility;   // 탭 id → 공개 여부
}

export interface ProblemWithBlocks extends Problem {
  question_blocks: Block[];
  solution_blocks: Block[];
  /** 모든 탭의 블록 (탭 ID → 블록 배열) */
  tabBlocks: Record<string, Block[]>;
}