// emojibase-data(ko) 동적 로드 + 한국어 검색 + 최근 사용.
// 첫 호출 시 1회 로드 후 메모리 캐시 → 초기 번들 영향 0.
//
// 검증(2026-06-01) emojibase-data ko/data.json 항목 필드:
//   { label(한글), tags(한글 배열), emoji, group(0~9), order, hexcode }
//   group 2 = Component(스킨톤 등) → 제외. group undefined(지역지표 등) → 제외.
//   messages.json groups: { key, message(한글), order } → order로 group 매핑.

export interface EmojiItem {
  emoji: string;   // 순수 유니코드
  label: string;   // 한국어 라벨
  tags: string[];  // 한국어 검색 키워드
  group: number;   // 카테고리 인덱스
}
export interface EmojiGroup { key: number; name: string; items: EmojiItem[]; }

let _cache: { groups: EmojiGroup[]; flat: EmojiItem[] } | null = null;

export async function loadEmoji(): Promise<{ groups: EmojiGroup[]; flat: EmojiItem[] }> {
  if (_cache) return _cache;
  const [data, messages] = await Promise.all([
    import('emojibase-data/ko/data.json').then((m) => m.default),
    import('emojibase-data/ko/messages.json').then((m) => m.default),
  ]);
  const groupNames = new Map<number, string>(
    (messages as any).groups.map((g: any) => [g.order, g.message])
  );
  const flat: EmojiItem[] = (data as any[])
    .filter((e) => e.group !== undefined && e.group !== 2 && typeof e.emoji === 'string' && e.emoji)
    .map((e) => ({
      emoji: e.emoji,
      label: e.label ?? '',
      tags: Array.isArray(e.tags) ? e.tags : [],
      group: e.group,
    }));
  const byGroup = new Map<number, EmojiItem[]>();
  for (const it of flat) {
    if (!byGroup.has(it.group)) byGroup.set(it.group, []);
    byGroup.get(it.group)!.push(it);
  }
  const groups: EmojiGroup[] = Array.from(byGroup.keys())
    .sort((a, b) => a - b)
    .map((key) => ({ key, name: groupNames.get(key) ?? `그룹 ${key}`, items: byGroup.get(key)! }));
  _cache = { groups, flat };
  return _cache;
}

export function searchEmoji(flat: EmojiItem[], query: string): EmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flat
    .filter((e) => e.label.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
    .slice(0, 60);
}

// 최근 사용 (localStorage — 인증과 무관, 브라우저 단위)
const RECENT_KEY = 'mathory:emoji:recent';
const RECENT_MAX = 24;
export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
export function pushRecent(emoji: string): void {
  try {
    const next = [emoji, ...getRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}
