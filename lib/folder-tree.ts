// Phase 40 — 하위 폴더 트리 유틸
// folders는 평면 배열, parent_id로 부모 연결. null/undefined/'' = 최상위.

import { Folder } from '../types/problem';

export interface FolderNode {
  folder: Folder;
  depth: number;
  children: FolderNode[];
}

/** 최상위 여부 (null/undefined/'' 모두 루트로 취급) */
export function isRoot(folder: Folder): boolean {
  return !folder.parent_id;
}

/** 평면 배열 → 트리(루트 노드 배열). 같은 부모 안에서는 order asc 정렬. */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const childrenOf = new Map<string, Folder[]>();
  const ROOT = '__root__';
  for (const f of folders) {
    const key = f.parent_id || ROOT;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(f);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const knownIds = new Set(folders.map((f) => f.id));

  const build = (parentKey: string, depth: number): FolderNode[] =>
    (childrenOf.get(parentKey) ?? []).map((folder) => ({
      folder,
      depth,
      children: build(folder.id, depth + 1),
    }));

  const roots = build(ROOT, 0);
  // 부모가 사라진 고아 폴더(데이터 정합성 방어) → 루트로 승격
  for (const f of folders) {
    if (f.parent_id && !knownIds.has(f.parent_id)) {
      roots.push({ folder: f, depth: 0, children: build(f.id, 1) });
    }
  }
  return roots;
}

/** 트리를 보이는 순서(DFS)로 평탄화. collapsed에 든 id의 자식은 제외. */
export function flattenVisible(nodes: FolderNode[], collapsed: Set<string>): FolderNode[] {
  const out: FolderNode[] = [];
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children.length && !collapsed.has(n.folder.id)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** 자기 자신 + 모든 자손 id 집합 */
export function getDescendantIds(folders: Folder[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    if (!childrenOf.has(f.parent_id)) childrenOf.set(f.parent_id, []);
    childrenOf.get(f.parent_id)!.push(f.id);
  }
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const childId of childrenOf.get(id) ?? []) {
      if (!out.has(childId)) { out.add(childId); stack.push(childId); }
    }
  }
  return out;
}

/** 직계 자식 폴더 (order 정렬) */
export function getChildren(folders: Folder[], parentId: string | null): Folder[] {
  const key = parentId || null;
  return folders
    .filter((f) => (f.parent_id || null) === key)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** 루트→대상까지의 경로(브레드크럼). 대상 포함. */
export function getFolderPath(folders: Folder[], folderId: string): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let cur = byId.get(folderId);
  const guard = new Set<string>(); // 순환 방어
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}
