import { nanoid } from 'nanoid';
import type { Block, SvgInitialView, GgbInitialCoords } from '../../types/problem';
import { normalizeDisplayMathSpacing } from '../preprocess';

/**
 * Phase 55 — 블록의 "저장될 형태(persisted form)".
 * 저장 경로(EditorView.handleSave)와 버전 스냅샷 수집(collectCurrentContent)의 단일 정형화 소스.
 * 이후 저장 정형화 규칙이 바뀌어도 스냅샷 해시가 자동 동행한다.
 *
 * ⚠️ handleSave 기존 로직과 결과가 필드 단위로 정확히 일치해야 한다 (block_key 추가분만 예외).
 *    step_label은 현행 handleSave가 저장하지 않으므로 여기서도 포함하지 않는다 (Phase55 F9).
 */
export interface PersistedBlockData {
  block_key: string;
  order: number;
  type: Block['type'];
  raw_text: string;
  title: string;
  imageWidth?: number;
  imageTreatment?: 'frame';
  imageGray?: false;
  showInSummary?: boolean;
  svg_initial_view?: SvgInitialView | null;
  svg_height?: number;
  ggb_initial_coords?: GgbInitialCoords | null;
  ggb_height?: number;
}

export function toPersistedBlock(b: Block, index: number): PersistedBlockData {
  // $$ ... $$ 독립수식 앞·뒤 빈 줄 정규화 → 위아래 빈 줄 제거 (handleSave와 동일)
  const trimmed = normalizeDisplayMathSpacing(b.raw_text)
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '');
  const out: PersistedBlockData = {
    block_key: b.block_key || nanoid(),   // lazy backfill (Phase55 F1)
    order: index,
    type: b.type,
    raw_text: trimmed,
    title: b.title || '',
  };
  if (b.type === 'image' && b.imageWidth) out.imageWidth = b.imageWidth;
  if (b.type === 'image' && b.imageTreatment) out.imageTreatment = b.imageTreatment;
  if (b.type === 'image' && b.imageGray === false) out.imageGray = false;
  // Phase 59: 요약 보기 노출 플래그. true일 때만 기록해 문서를 깨끗하게 유지한다
  if (b.showInSummary) out.showInSummary = true;
  if (b.type === 'svg' && b.svg_initial_view) out.svg_initial_view = b.svg_initial_view;
  if (b.type === 'svg' && b.svg_height) out.svg_height = b.svg_height;
  if (b.type === 'ggb' && b.ggb_initial_coords) out.ggb_initial_coords = b.ggb_initial_coords;
  if (b.type === 'ggb' && b.ggb_height) out.ggb_height = b.ggb_height;
  return out;
}
