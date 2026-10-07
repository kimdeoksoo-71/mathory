import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { MathSnippet, SnippetInput, SnippetKind } from '../types/snippet';

function snippetsCollection(userId: string) {
  return collection(db, 'users', userId, 'math_snippets');
}

/* Phase 68 — ⚠ `orderBy('shortcutIndex')`를 쓰지 않는다. Firestore는 orderBy 필드가 **없는 문서를 결과에서 뺀다** —
   수식 단축어(abbrev) 문서에는 shortcutIndex가 없어 등록은 되는데 메뉴에 안 뜬다. 컬렉션이 작으니 클라에서 정렬한다:
   hotkey(shortcutIndex 오름차순) → abbrev(약어 사전순). */
export async function listSnippets(userId: string): Promise<MathSnippet[]> {
  const snap = await getDocs(snippetsCollection(userId));
  const list = snap.docs.map((d) => {
    const data = d.data();
    const kind: SnippetKind = data.kind === 'abbrev' ? 'abbrev' : 'hotkey';
    return {
      id: d.id,
      kind,
      name: data.name,
      shortcutIndex: kind === 'hotkey' ? data.shortcutIndex : undefined,
      abbrev: kind === 'abbrev' ? data.abbrev : undefined,
      content: data.content,
      order: data.order ?? data.shortcutIndex ?? 0,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as MathSnippet;
  });
  return list.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'hotkey' ? -1 : 1;
    if (a.kind === 'hotkey') return (a.shortcutIndex ?? 99) - (b.shortcutIndex ?? 99) || a.order - b.order;
    return (a.abbrev ?? '').localeCompare(b.abbrev ?? '') || a.order - b.order;
  });
}

/** 문서에 쓸 필드만 고른다 — abbrev 문서에 shortcutIndex를, hotkey 문서에 abbrev를 쓰지 않는다 */
function toFields(data: Partial<SnippetInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.kind !== undefined) out.kind = data.kind;
  if (data.name !== undefined) out.name = data.name;
  if (data.content !== undefined) out.content = data.content;
  if (data.kind === 'abbrev' || (data.kind === undefined && data.abbrev !== undefined)) {
    if (data.abbrev !== undefined) out.abbrev = data.abbrev;
  }
  if (data.kind === 'hotkey' || (data.kind === undefined && data.shortcutIndex !== undefined)) {
    if (data.shortcutIndex !== undefined) { out.shortcutIndex = data.shortcutIndex; out.order = data.shortcutIndex; }
  }
  return out;
}

export async function createSnippet(userId: string, data: SnippetInput): Promise<string> {
  const fields = toFields(data);
  // ⚠ order는 항상 쓴다 — listSnippets의 `order ?? shortcutIndex` 폴백이 abbrev에서는 undefined다
  if (fields.order === undefined) fields.order = Date.now();
  const docRef = await addDoc(snippetsCollection(userId), {
    ...fields,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSnippet(
  userId: string,
  snippetId: string,
  data: Partial<SnippetInput>
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'math_snippets', snippetId), {
    ...toFields(data),
    updated_at: serverTimestamp(),
  });
}

export async function deleteSnippet(userId: string, snippetId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'math_snippets', snippetId));
}
