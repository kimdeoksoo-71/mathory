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
  // Stage 2 (멤버 공유)
  members?: Record<string, MemberRole>;       // uid → role
  memberUids?: string[];                       // array-contains 쿼리용 (members.keys()와 동기화)
  memberTabVisibility?: Record<string, boolean>; // tabId → 공개 여부 (없으면 전부 공개)
  // Phase 47: 문항 단위 댓글 제어 (오너 토글). 미설정 = true
  commentsVisible?: boolean;                   // false = 댓글을 오너에게만
  commentsWritable?: boolean;                  // false = 멤버 댓글 작성 동결(오너는 가능)
  // Phase 51: 문항 공개(실시간)
  publishedAt?: Date;                          // 실시간 공개 ON 시 스탬프 (PublishList 정렬용)
  commentSessionId?: string;                   // 댓글 세션 id 포인터(비정규화). 공개 뷰어 isCommentStream 필터용
  // Phase 52(N1): 공개 댓글 작성 opt-in. 미설정 = false. commentsWritable(멤버용)과 분리.
  publicCommentsEnabled?: boolean;             // true = 로그인 누구나 공개 댓글 작성 허용
}

export type MemberRole = 'viewer' | 'commenter';

// ═══ Stage 3: 문항 단위 댓글 (Phase 47에서 탭 단위 → 문항 단위로 전환) ═══

// 영속 식별자(Firestore 컬렉션 tab_comments, 필드 tabId)는 마이그레이션 회피를 위해
// 이름을 유지한다. tabId는 이제 잔존 필드 — 필터·권한에 사용하지 않는다.
export interface ProblemComment {
  id: string;
  tabId: string;                       // (잔존) 작성 당시 열린 탭. 필터·권한 미사용
  authorUid: string;                   // human: Firebase uid, AI: 'ai:{modelId}'
  // Phase 52(F3): 작성 시점 닉네임 비정규화. 공개 댓글에서 비로그인 열람자도 이름 표시.
  // 미설정(기존 댓글) = 프로필 백필 → '익명'. addComment/mapDoc 배선은 5단계.
  authorName?: string;
  // Phase 52(B1): 댓글 스트림(공개 대상) 여부 비정규화. true = 댓글세션/legacy 메시지.
  //   agent('normal' 세션) 메시지는 미설정(false) → 공개 뷰어 필터 쿼리·규칙에서 제외.
  //   addComment가 자동 세팅. 기존 댓글은 백필 필요(공개 문항 한정).
  commentStream?: boolean;
  content: string;                     // markdown + KaTeX (인라인 수식)
  parentCommentId: string | null;      // null = 최상위, 값 = 답글
  resolved: boolean;                   // 오너 또는 작성자가 토글
  createdAt: Date;
  updatedAt: Date;
  // Phase 37: AI 토론
  authorType?: 'human' | 'ai';         // 미설정은 'human'으로 간주 (마이그레이션 호환)
  modelId?: string;                     // authorType === 'ai'일 때 모델 ID
  discussionSessionId?: string;         // discussion_sessions/{id} 참조
  invokedModelIds?: string[];           // 사용자 메시지가 호출한 AI 목록
  aiUsage?: AIUsage;                    // AI 메시지에만 채워짐
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type Visibility = 'private' | 'link' | 'public';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
  // Phase 37: 토론용 닉네임. 기본값 'KDS'. AI 예약 닉네임(ai_models.nickname 전체) 사용 불가 — updateNickname()에서 검증
  nickname?: string;
  // Phase 48: 검색·전역 유일성 정규화 키 (= nickname.trim().toLowerCase())
  nickname_lower?: string;
}

// ═══ Phase 37: AI 토론 ═══

export interface AIModelConfig {
  modelId: string;                     // 'gemini-3.1-pro'
  displayName: string;                  // 'Gemini 3.1 Pro'
  nickname: string;                     // '민' (한 음절, 인간 사용 금지 예약어)
  provider: 'google' | 'openai' | 'deepseek' | 'xai' | 'anthropic';
  apiModelName: string;                 // 실제 API 호출 모델명
  enabled: boolean;
  maxTokens: number;
  appendPrompt: string;                 // 모델별 부록 프롬프트
  order: number;
  avatarEmoji: string;
  inputCostPerMillion: number;          // $/1M input tokens
  outputCostPerMillion: number;         // $/1M output tokens
}

export interface DiscussionSession {
  id: string;
  problemId: string;
  // Phase 47: 'comment' = 댓글 스레드(문항당 1개, AI 비활성), 'normal' = agent(사용자 생성, AI 활성)
  // 'public' = Phase 37/38 미구현 잔존(신규 생성 안 함)
  type: 'comment' | 'normal' | 'public';
  name: string;                          // 'comment'는 고정 라벨, 'normal'은 사용자 입력
  aiEnabled: boolean;                    // comment=false, normal=true
  createdBy: string;                     // 생성자 uid (comment/normal 모두 오너)
  createdAt: Date;
  updatedAt: Date;
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

export interface SvgInitialView {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface GgbInitialCoords {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Block {
  id: string;
  order: number;
  type: 'text' | 'heading' | 'math_block' | 'bullet' | 'gana' | 'roman' | 'box' | 'choices' | 'image' | 'svg' | 'ggb';
  raw_text: string;
  step_label?: string;
  title?: string;
  imageWidth?: number;
  /** 이미지 블록 전용: 배경 treatment. 미설정 = 'blend'(multiply, 기본), 'frame' = 액자 */
  imageTreatment?: 'frame';
  /** 이미지 블록 전용: 흑백 여부. 미설정/true = grayscale(기본), false = 컬러 유지 */
  imageGray?: boolean;
  /** SVG 블록 전용: 편집자가 저장한 초기 뷰 transform (없으면 fit-to-container) */
  svg_initial_view?: SvgInitialView | null;
  /** SVG 블록 전용: 표시 높이(px). 기본 300 */
  svg_height?: number;
  /** GGB 블록 전용: 편집자가 저장한 초기 좌표 영역 (없으면 .ggb 파일 기본 뷰) */
  ggb_initial_coords?: GgbInitialCoords | null;
  /** GGB 블록 전용: 표시 높이(px). 기본 350 */
  ggb_height?: number;
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
  icon?: string;              // 폴더 아이콘 이모지(순수 유니코드). 비어있으면 기본 폴더 아이콘 (Phase 39)
  parent_id?: string | null;  // 상위 폴더 id. null/undefined/'' = 최상위 (Phase 40)
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
  expiresAt: Date | null;              // null = 무기한
  tabVisibility: ShareTabVisibility;   // 탭 id → 공개 여부
}

// ═══ Phase 52: Bazaar 공용 광장 ═══

export type BazaarMode = 'live' | 'snapshot';

/**
 * 광장 게시물. 공개(visibility)와 별개의 명시적 등록(C1).
 * mode='live' → /p/{problemId} (실시간), mode='snapshot' → /shared/{shareId} (동결본).
 * 표시·검색용 비정규화 필드(authorNickname/title/tags)는 게시 시점 스냅샷 — 원본 변경 시 어긋날 수 있음(R4·R8).
 */
export interface BazaarPost {
  id: string;
  mode: BazaarMode;
  problemId: string;                   // 원본 문항(정렬·중복검사·실시간 라우팅)
  shareId?: string;                    // mode='snapshot'일 때만 존재 (shares/{shareId})
  ownerUid: string;
  authorNickname: string;              // 게시 시점 닉네임(비정규화). 피드 표시용
  authorNickname_lower: string;        // 검색용(= UserProfile.nickname_lower)
  title: string;                       // 비정규화(피드·검색)
  title_lower: string;                 // 제목 prefix 검색용(= title.trim().toLowerCase())
  tags: string[];                      // '#' 제거·정규화·중복제거. 최대 10개. 빈 배열 허용
  createdAt: Date;
  expiresAt?: Date | null;             // snapshot: share.expiresAt 동기화(만료 숨김). live: null
}

export interface ProblemWithBlocks extends Problem {
  question_blocks: Block[];
  solution_blocks: Block[];
  /** 모든 탭의 블록 (탭 ID → 블록 배열) */
  tabBlocks: Record<string, Block[]>;
}