/**
 * M5 — 폴더 아이콘 규칙 (D3·D4·D7 · import 0 순수 모듈).
 *
 * `npm run test:foldericon`이 이 파일 하나를 tsc로 단독 컴파일한다 — import 문을 두지 말 것.
 *
 * - `Folder.icon`은 Phosphor 이름(`^[a-z0-9-]+$`)이거나 옛 유니코드 이모지다.
 *   두 표기는 절대 겹치지 않으므로 정규식 하나로 가른다. 옛 값·빈 값은 기본 아이콘(N4).
 * - weight: 활성(선택) 폴더 행만 bold — 글자가 700으로 굵어지는 조건과 동일(D3).
 * - 기본 아이콘: 펼침(depth 무관) folder-open → 최상위 folder → 하위 folder-simple(D4·N3).
 *   ⚠ `folder-simple-open`은 core 2.1.1에 없다 — 펼침을 depth로 가르지 말 것.
 */

export type FolderGlyphSpec =
  | { kind: 'inline'; key: 'folder' | 'folderSimple' | 'folderOpen'; bold: boolean }
  | { kind: 'asset'; name: string; weight: 'regular' | 'bold' };

/** Phosphor 아이콘 이름 판별 — 유니코드 이모지와 불겹침(D7). */
export function isPhosphorIconName(v: string | undefined | null): v is string {
  return !!v && /^[a-z0-9-]+$/.test(v);
}

export function resolveFolderGlyph(a: {
  icon?: string | null;
  isRoot: boolean;
  expanded?: boolean;
  active?: boolean;
}): FolderGlyphSpec {
  if (isPhosphorIconName(a.icon)) {
    return { kind: 'asset', name: a.icon, weight: a.active ? 'bold' : 'regular' };
  }
  const key = a.expanded ? 'folderOpen' : a.isRoot ? 'folder' : 'folderSimple';
  return { kind: 'inline', key, bold: !!a.active };
}

// ───────────────────────── 피커 검색 (D6) ─────────────────────────

/** lib/phosphor-index.json의 항목 — n:이름 · c:카테고리 · t:영문 태그. */
export interface PhosphorIndexItem {
  n: string;
  c: string[];
  t: string[];
}

export const BRANDS_CATEGORY = 'brands'; // N1 — 상표 로고는 사용자 선택 목록에서 제외

export const SEARCH_LIMIT = 80;

/**
 * 검색 서열: name 부분일치 → 한글 키워드 표(phosphor-ko.json) → 영문 tags. 상한 80.
 * 한글 표가 없거나(로드 실패) 항목이 비어도 영문만으로 동작한다(N2·N11).
 */
export function searchIndex(
  index: PhosphorIndexItem[],
  query: string,
  opts: { excludeBrands: boolean; ko?: Record<string, string[]> },
): PhosphorIndexItem[] {
  const q = query.trim().toLowerCase();
  const pool = opts.excludeBrands ? index.filter((i) => !i.c.includes(BRANDS_CATEGORY)) : index;
  if (!q) return pool.slice(0, SEARCH_LIMIT);

  const byName: PhosphorIndexItem[] = [];
  const byKo: PhosphorIndexItem[] = [];
  const byTag: PhosphorIndexItem[] = [];
  for (const item of pool) {
    if (item.n.includes(q)) byName.push(item);
    else if (opts.ko && (opts.ko[item.n] || []).some((k) => k.includes(q))) byKo.push(item);
    else if (item.t.some((t) => t.includes(q))) byTag.push(item);
    if (byName.length >= SEARCH_LIMIT) break;
  }
  return [...byName, ...byKo, ...byTag].slice(0, SEARCH_LIMIT);
}

/** 카테고리 → 피커 한글명(N1 — brands 제외 17종). 순서가 곧 <select> 순서다. */
export const CATEGORY_LABELS_KO: ReadonlyArray<readonly [string, string]> = [
  ['system', '시스템'],
  ['objects', '사물'],
  ['editor', '편집'],
  ['design', '디자인'],
  ['maps & travel', '지도·여행'],
  ['commerce', '상거래'],
  ['office', '사무'],
  ['communications', '소통'],
  ['media', '미디어'],
  ['arrows', '화살표'],
  ['technology & development', '기술·개발'],
  ['finances', '금융'],
  ['health & wellness', '건강'],
  ['people', '사람'],
  ['nature', '자연'],
  ['games', '게임'],
  ['weather', '날씨'],
];
