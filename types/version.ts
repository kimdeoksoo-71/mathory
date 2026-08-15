import type { Timestamp } from 'firebase/firestore';
import type { Block, SvgInitialView, GgbInitialCoords } from './problem';

/**
 * Phase 55 — 자체 버전관리(VCS) 타입.
 * 스냅샷 콘텐츠는 "저장될 형태"(toPersistedBlock 통과본)를 담는다. block_key·last_editor_uid는 해시 제외.
 * content_hash(버전)는 저작권 computeContentHash와 별개(필드셋 다름, F8).
 */

export interface Participant {
  uid: string;
  display_name: string;        // 스냅샷 시점 캡처 (이후 개명돼도 기록 보존)
}

export type VersionTrigger = 'manual_save' | 'editor_exit' | 'named' | 'restore';

export interface VersionMeta {
  title: string;               // problem.title (D1)
  answer: string;              // problem.answer ?? ''
}

export interface VersionBlock {
  block_key: string;           // 매칭·복원 키. 해시 제외
  order: number;
  // 실 유입 11종. 레거시 math_block·bullet은 normalizeBlockType(EditorView)으로
  // 로드·저장 양쪽에서 text로 정규화된 뒤 들어오므로 payload엔 남지 않는다.
  type: Block['type'];
  raw_text: string;            // 저장될 형태
  title?: string;
  imageWidth?: number;
  imageTreatment?: 'frame';
  imageGray?: false;
  svg_initial_view?: SvgInitialView | null;
  svg_height?: number;
  ggb_initial_coords?: GgbInitialCoords | null;
  ggb_height?: number;
}

export interface VersionTab {
  key: string;                 // TabMeta.id
  title: string;               // TabMeta.label — 해시 포함
  last_editor_uid?: string;    // 해시 제외
  blocks: VersionBlock[];
}

export interface VersionContent {
  meta: VersionMeta;           // 제목·정답 (D1) — content_hash에만 포함
  tabs: VersionTab[];
}

/**
 * Phase 55b — /api/github/export 응답을 클라에서 다루는 형태.
 * 판별 유니온이 아니라 평평한 인터페이스인 이유: tsconfig가 strict:false라
 * `if (!res.ok)` 식의 좁히기가 동작하지 않는다.
 */
export interface ExportOutcome {
  ok: boolean;
  error?: string;
  commitUrl?: string | null;
  commitSha?: string | null;
  path?: string;
  skipped?: boolean;
  exportedAt?: string;
  repo?: string;
}

/** Phase 55b — GitHub 내보내기 기록. 사후 수정 허용 필드(규칙 hasOnly에 포함). */
export interface GithubExport {
  repo: string;
  path: string;          // versions/{seq:04d}.md
  commit_sha: string;
  exported_at: string;   // 서버 시각 ISO. md 파일에는 넣지 않는다(W1: 넣으면 skip 판정이 무효)
}

// 버전 메타 — content_hash·seq·created_*·trigger·parent_id 불변.
// 사후 수정은 name·pinned·github_export만 (firestore.rules의 hasOnly와 일치 유지).
export interface ProblemVersion {
  id: string;
  seq: number;
  problem_id: string;
  author_uid: string;          // 부모 authorUid 비정규화 (규칙 검사용)
  created_at: Timestamp;
  created_by: Participant;
  contributors: Participant[];
  trigger: VersionTrigger;
  name: string | null;
  pinned: boolean;
  content_hash: string;
  tab_hashes: Record<string, string>;
  parent_id: string | null;
  restored_from: string | null;
  changed_tabs: string[];
  byte_size: number;
  github_export?: GithubExport | null;   // Phase 55b
}

export interface VersionPayload {
  content: VersionContent;
  content_hash: string;
}

export type SnapshotResult =
  | { status: 'created'; version: ProblemVersion }
  | { status: 'unchanged' }
  | { status: 'named_existing'; versionId: string }
  | { status: 'error'; error: unknown };
