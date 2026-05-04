import { Block, TabMeta } from '../types/problem';

export interface CopyrightHashInput {
  authorUid: string;
  createdAt: string; // ISO
  tabs: TabMeta[];
  tabBlocks: Record<string, Block[]>;
}

/**
 * 문제 내용으로부터 결정적 SHA-256 해시 생성.
 * authorUid + createdAt + 모든 탭의 블록(order 정렬)을 정규화 JSON으로 직렬화.
 * 블록 ID는 매 저장마다 갱신되므로 해시 입력에서 제외.
 */
export async function computeContentHash(input: CopyrightHashInput): Promise<string> {
  const normalized = {
    v: 1,
    authorUid: input.authorUid,
    createdAt: input.createdAt,
    tabs: input.tabs.map((t) => ({
      id: t.id,
      blocks: (input.tabBlocks[t.id] || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((b) => ({
          order: b.order,
          type: b.type,
          raw_text: b.raw_text,
          title: b.title || '',
          imageWidth: b.imageWidth ?? null,
        })),
    })),
  };
  const json = JSON.stringify(normalized);
  const buf = new TextEncoder().encode(json);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function formatRegisteredAt(iso: string): string {
  try {
    const d = new Date(iso);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}
