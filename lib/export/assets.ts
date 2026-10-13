/**
 * Phase 70 §3-5 — 그림 자산 수집 · zip · 다운로드 (브라우저).
 *
 * ⚠ 이 파일은 ExportDialog가 **동적 import**한다(D18) — fflate가 진입 번들에 들어오지 않게.
 * ⚠ DOM·fetch는 함수 안에서만 쓴다 — 순수 함수(sniffImage·safeFileName·figureVariants·zipFiles)는 Node 테스트가 직접 부른다.
 * ⚠ 형식은 **매직 바이트로** 정한다(D23). 저장 경로(`lib/storage.ts`)는 png/jpg 확장자를 붙이지만 리사이즈가 필요 없던
 *   파일은 원본 바이트 그대로라(gif·webp가 .jpg 이름으로 저장될 수 있다), 확장자·URL로 판단하면 틀린다.
 * ⚠ 어떤 그림 실패도 내보내기를 죽이지 않는다 — 그 그림만 빈 상자 + 경고 목록.
 */

import { zipSync, strToU8 } from 'fflate';
import type { ExportDoc, ExportBlock, Flow, Inline } from './ir';

export type ImageKind = 'png' | 'jpeg' | 'svg' | 'gif' | 'webp' | 'unknown';
export type ExportTarget = 'typst' | 'latex';

export function sniffImage(bytes: Uint8Array): ImageKind {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  const head = new TextDecoder().decode(b.subarray(0, 512)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return 'unknown';
}

/** 파일 이름 위생 — ProblemView MD 다운로드(`ProblemView.tsx:509`)와 같은 치환 */
export function safeFileName(title: string, fallback = '수학 문제'): string {
  return String(title ?? '').replace(/[/\\:*?"<>|]/g, '_').trim() || fallback;
}

/** 그림 id별로 필요한 변형(원본·회색) — 회색은 image 블록의 imageGray에서만 온다 */
export function figureVariants(doc: ExportDoc): Map<string, { plain: boolean; gray: boolean }> {
  const out = new Map<string, { plain: boolean; gray: boolean }>();
  const need = (id: string | null, gray: boolean) => {
    if (!id) return;
    const v = out.get(id) ?? { plain: false, gray: false };
    if (gray) v.gray = true; else v.plain = true;
    out.set(id, v);
  };
  const inl = (xs: Inline[]): void => xs.forEach((x) => {
    if (x.t === 'img') need(x.ref, false);
    else if (x.t === 'strong' || x.t === 'em') inl(x.inline);
  });
  const flows = (fs: Flow[]): void => fs.forEach((f) => {
    if (f.t === 'p' || f.t === 'h') inl(f.inline);
    else if (f.t === 'ul' || f.t === 'ol') f.items.forEach(flows);
    else if (f.t === 'quote') flows(f.body);
    else if (f.t === 'table') [f.head, ...f.rows].forEach((r) => r.forEach(inl));
  });
  const block = (b: ExportBlock): void => {
    if (b.kind === 'figure') {
      if (b.variant === 'image') need(b.ref, b.gray);
      else if (b.variant === 'svg') need(b.ref, false);
    } else if (b.kind === 'choices') b.items.forEach((it) => inl(it.inline));
    else if (b.kind === 'case') { if (b.title) inl(b.title); flows(b.body); }
    else flows(b.body);
  };
  doc.tabs.forEach((t) => t.blocks.forEach(block));
  return out;
}

export function zipFiles(files: Record<string, Uint8Array | string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) entries[name] = typeof data === 'string' ? strToU8(data) : data;
  return zipSync(entries, { level: 6 });
}

/* ═══ 브라우저 전용 ═══ */

async function decode(bytes: Uint8Array, kind: ImageKind): Promise<HTMLImageElement> {
  const blob = new Blob([bytes as BlobPart], { type: kind === 'svg' ? 'image/svg+xml' : `image/${kind}` });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** canvas로 png 만들기 — svg는 2배로 래스터, gray면 회색조 */
async function toPng(bytes: Uint8Array, kind: ImageKind, opts: { scale: number; gray: boolean }): Promise<Uint8Array> {
  const img = await decode(bytes, kind);
  const w = Math.max(1, Math.round((img.naturalWidth || 400) * opts.scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 300) * opts.scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트 없음');
  if (opts.gray) ctx.filter = 'grayscale(1)';
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob 실패'))), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export interface CollectedFigures {
  /** zip에 넣을 파일(경로 → 바이트) */
  files: Record<string, Uint8Array>;
  /** 직렬화기에 넘길 경로 조회 — 못 받은 그림은 null */
  pathOf: (id: string, v: { gray: boolean }) => string | null;
  /** 실패한 그림(사용자 안내용) */
  failed: { id: string; url: string; reason: string }[];
}

/**
 * 그림을 받아 대상(Typst·LaTeX)에 맞는 파일로 만든다.
 * Typst: png·jpeg·svg는 그대로 · 그 밖(gif·webp)은 png · 회색은 png
 * LaTeX: png·jpeg는 그대로 · svg는 png 2배(Overleaf `\includesvg`는 shell-escape 의존이라 쓰지 않는다) · 그 밖은 png · 회색은 png
 */
export async function collectFigures(doc: ExportDoc, target: ExportTarget): Promise<CollectedFigures> {
  const variants = figureVariants(doc);
  const files: Record<string, Uint8Array> = {};
  const paths = new Map<string, string>();
  const failed: CollectedFigures['failed'] = [];
  for (const fig of doc.figures) {
    const need = variants.get(fig.id);
    if (!need) continue;
    try {
      const res = await fetch(fig.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const kind = sniffImage(bytes);
      if (kind === 'unknown') throw new Error('이미지 형식을 알 수 없음');
      if (need.plain) {
        const keep = kind === 'png' || kind === 'jpeg' || (kind === 'svg' && target === 'typst');
        const ext = keep ? (kind === 'jpeg' ? 'jpg' : kind) : 'png';
        const data = keep ? bytes : await toPng(bytes, kind, { scale: kind === 'svg' ? 2 : 1, gray: false });
        const path = `figures/${fig.id}.${ext}`;
        files[path] = data; paths.set(`${fig.id}|0`, path);
      }
      if (need.gray) {
        const path = `figures/${fig.id}-gray.png`;
        files[path] = await toPng(bytes, kind, { scale: kind === 'svg' ? 2 : 1, gray: true });
        paths.set(`${fig.id}|1`, path);
      }
    } catch (e) {
      failed.push({ id: fig.id, url: fig.url, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return {
    files,
    failed,
    pathOf: (id, v) => paths.get(`${id}|${v.gray ? 1 : 0}`) ?? null,
  };
}

/** 바이트·문자열을 파일로 내려받는다 */
export function downloadFile(data: Uint8Array | string, fileName: string, mime: string): void {
  const blob = new Blob([typeof data === 'string' ? data : (data as BlobPart)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
