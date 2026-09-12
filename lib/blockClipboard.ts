/**
 * M7 D15~D17 — 블록 클립보드(메모리 싱글턴). import 0.
 *
 * 시스템 클립보드에는 **쓰지 않는다**(D15): 마크다운을 병기하면 그 뒤 다른 텍스트를 복사했을 때
 * "블록 ⌘V가 옛 블록을 붙인다"는 혼선이 생기고, readText는 권한 프롬프트를 띄운다.
 * 메모리 싱글턴은 탭 전환·문항 전환·저장에도 살아남아 문항 간 복사가 공짜다(페이지 새로고침에는 비운다).
 *
 * ClipBlock = Block에서 `id·block_key·order`(자리·정체성)와 LocalBlock의 `collapsed·isNew`를 뺀 것.
 * 미디어 블록(image·svg·ggb)도 그대로 — raw_text의 URL을 **공유**한다(D17). 편집창은 Storage를
 * 지우지 않고 읽기는 공개라 지금은 무해하다. ⚠ 장래 "블록 삭제 시 Storage 정리"를 넣으면 참조 수 문제가 생긴다.
 */

export interface ClipBlock {
  type: string;
  raw_text: string;
  title?: string;
  imageWidth?: number;
  imageTreatment?: string;
  imageGray?: boolean;
  showInSummary?: boolean;
  svg_initial_view?: unknown;
  svg_height?: number;
  ggb_initial_coords?: unknown;
  ggb_height?: number;
}

const CLIP_KEYS: (keyof ClipBlock)[] = [
  'type', 'raw_text', 'title', 'imageWidth', 'imageTreatment', 'imageGray', 'showInSummary',
  'svg_initial_view', 'svg_height', 'ggb_initial_coords', 'ggb_height',
];

const state: { blocks: ClipBlock[]; copiedAt: number } = { blocks: [], copiedAt: 0 };

function deepClone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** 블록(어떤 모양이든)에서 ClipBlock 필드만 추린다 — id·block_key·order·collapsed·isNew는 버린다 */
export function toClipBlock(b: Record<string, unknown>): ClipBlock {
  const out: Record<string, unknown> = {};
  for (const k of CLIP_KEYS) {
    if (b[k] !== undefined) out[k] = deepClone(b[k]);
  }
  return out as unknown as ClipBlock;
}

/** 깊은 복사로 보관. 개수 반환 */
export function copyBlocks(blocks: ClipBlock[]): number {
  state.blocks = blocks.map((b) => deepClone(b));
  state.copiedAt = Date.now();
  return state.blocks.length;
}

/** 깊은 복사 반환 — 붙여넣은 뒤 편집해도 클립보드는 그대로다 */
export function readClipboard(): ClipBlock[] {
  return state.blocks.map((b) => deepClone(b));
}

export function clipboardSize(): number {
  return state.blocks.length;
}
