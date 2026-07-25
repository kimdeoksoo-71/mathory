import type { VersionContent, VersionTab, VersionBlock, VersionMeta } from '../../types/version';

/**
 * Phase 55 — 결정적 정규화. 키·배열 순서만 정렬하고 값은 건드리지 않는다.
 * block_key·last_editor_uid·timestamp는 제외(정체성/시간은 내용이 아님).
 * meta(제목·정답)는 canonicalize(전체 해시)에만 포함 — canonicalizeTab(탭별 해시)에는 없음.
 */

// 제목·정답은 저장 경로가 트림하지 않으므로(persisted form) 여기서도 트림하지 않는다.
function canonMeta(m: VersionMeta) {
  return { title: m.title || '', answer: m.answer || '' };
}

export function canonBlock(b: VersionBlock) {
  const o: Record<string, unknown> = { order: b.order, type: b.type, raw_text: b.raw_text };
  if (b.title != null && b.title !== '') o.title = b.title;      // ''/부재 동치 (F4)
  if (b.imageWidth != null) o.imageWidth = b.imageWidth;
  if (b.imageTreatment != null) o.imageTreatment = b.imageTreatment;
  if (b.imageGray === false) o.imageGray = false;                // true/부재 동치 (F4)
  if (b.svg_initial_view != null) {
    const v = b.svg_initial_view;
    o.svg_initial_view = { scale: v.scale, positionX: v.positionX, positionY: v.positionY };
  }
  if (b.svg_height != null) o.svg_height = b.svg_height;
  if (b.ggb_initial_coords != null) {
    const c = b.ggb_initial_coords;
    o.ggb_initial_coords = { xMin: c.xMin, xMax: c.xMax, yMin: c.yMin, yMax: c.yMax };
  }
  if (b.ggb_height != null) o.ggb_height = b.ggb_height;
  return o;
}

export function canonicalize(content: VersionContent): string {
  const meta = canonMeta(content.meta);
  const tabs = [...content.tabs]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((t) => ({
      key: t.key,
      title: t.title,
      blocks: [...t.blocks].sort((a, b) => a.order - b.order).map(canonBlock),
    }));
  return JSON.stringify({ meta, tabs });
}

export function canonicalizeTab(t: VersionTab): string {
  const blocks = [...t.blocks].sort((a, b) => a.order - b.order).map(canonBlock);
  return JSON.stringify({ key: t.key, title: t.title, blocks });
}

export function diffTabKeys(now: Record<string, string>, prev: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(now), ...Object.keys(prev)]);
  return [...keys].filter((k) => now[k] !== prev[k]);
}
